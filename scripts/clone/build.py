"""Step 4: build the final English and Spanish pages.

    python3 scripts/clone/build.py <clean_dir> <out_dir>

Reads translations/es/units/*.json and translations/es/slugs.json, writes
<out_dir>/<locale>/<key>.html plus <out_dir>/<locale>/_header.html (the site
header shared by every page, stored once and referenced by <!--@header-->).
"""
import glob
import html as htmlmod
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from bs4 import BeautifulSoup, NavigableString  # noqa: E402
from common import ORIGIN_RE, key_for_path, normalize, unit_id  # noqa: E402
from units import parse, skeleton, walk  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
LOCALES = ("en", "es")
HEADER_MARK = "<!--@header-->"
SITE = "__SITE_URL__"  # replaced at serve time with NEXT_PUBLIC_SITE_URL

SLUGS: dict = json.load(open(os.path.join(ROOT, "translations/es/slugs.json"), encoding="utf8"))
KNOWN = set(SLUGS)


def load_translations() -> dict:
    tr = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "translations/es/units/batch-[0-9][0-9][0-9].json"))):
        tr.update(json.load(open(f, encoding="utf8")))
    overrides = os.path.join(ROOT, "translations/es/overrides.json")
    if os.path.exists(overrides):
        tr.update({k: v for k, v in json.load(open(overrides, encoding="utf8")).items() if not k.startswith("_")})
    return tr


TR = load_translations()

PLACEHOLDER = re.compile(r"<(/?)t(\d+)(/?)>")


def localized_path(locale: str, path: str) -> str | None:
    p = path.strip("/")
    if p not in KNOWN:
        return None
    s = p if locale == "en" else SLUGS[p]
    return f"/{locale}/{s}/" if s else f"/{locale}/"


# ---------------------------------------------------------------- translate

def rebuild(skel: str, tags: list) -> str:
    """Turn a translated skeleton back into HTML using the original tags."""
    out, pos = [], 0
    for m in PLACEHOLDER.finditer(skel):
        out.append(skel[pos:m.start()])
        closing, n, void = m.group(1), int(m.group(2)), m.group(3)
        tag = tags[n - 1]
        if closing:
            out.append(f"</{tag.name}>")
        else:
            attrs = "".join(
                f' {k}="{htmlmod.escape(" ".join(v) if isinstance(v, list) else v, quote=True)}"' if v is not None else f" {k}"
                for k, v in tag.attrs.items()
            )
            out.append(f"<{tag.name}{attrs}>" if not void else f"<{tag.name}{attrs}>")
        pos = m.end()
    out.append(skel[pos:])
    return "".join(out)


def translate_doc(doc: str, stats: dict) -> str:
    soup = parse(doc)
    blocks, texts, attrs = [], [], []
    walk(soup, on_block=blocks.append, on_text=texts.append, on_attr=lambda el, a: attrs.append((el, a)))

    def lookup(en: str):
        es = TR.get(unit_id(en))
        stats["hit" if es is not None else "miss"] += 1
        return es

    # Attributes first: blocks are rebuilt from their (already translated) tags.
    for el, a in attrs:
        es = lookup(normalize(el[a]))
        if es is not None:
            el[a] = htmlmod.unescape(es)
    for s in texts:
        es = lookup(normalize(str(s)))
        if es is not None:
            lead = str(s)[: len(str(s)) - len(str(s).lstrip())]
            trail = str(s)[len(str(s).rstrip()):]
            s.replace_with(NavigableString(lead + htmlmod.unescape(es) + trail))
    for el in blocks:
        skel, tags = skeleton(el)
        es = lookup(skel)
        if es is None:
            continue
        try:
            new_html = rebuild(es, tags)
        except IndexError:
            stats["bad"] += 1
            continue
        frag = BeautifulSoup(new_html, "html.parser")
        el.clear()
        for c in list(frag.contents):
            el.append(c)
    return str(soup)


# ---------------------------------------------------------------- links

ABS_LINK = re.compile(ORIGIN_RE + r"((?:(?:/|\\/)[\w.%\-]*)+)")


def rewrite_links(doc: str, locale: str) -> str:
    def abs_link(m):
        raw = m.group(1)
        escaped = "\\/" in raw
        target = localized_path(locale, raw.replace("\\/", "/"))
        if target is None:
            return m.group(0)  # not part of the clone: keep pointing at the original site
        return target.replace("/", "\\/") if escaped else target

    # Absolute links to pages of the original site (plain and JSON-escaped).
    doc = ABS_LINK.sub(abs_link, doc)
    # Root-relative page links (href="/bpc-157-peptide/").
    def rel(m):
        target = localized_path(locale, m.group(2))
        return f'{m.group(1)}{target}' if target else m.group(0)

    doc = re.sub(r'(href=["\'])(/(?!wp-|data/|en/|es/|_next/)[\w./-]*)(?=[?#"\'])', rel, doc)
    return doc


# ---------------------------------------------------------------- head / chrome


def finish(doc: str, locale: str, path: str) -> str:
    alts = {l: localized_path(l, path) or f"/{l}/" for l in LOCALES}
    doc = doc.replace("__LOCALE__", locale)
    doc = re.sub(r'<html lang="[^"]*"', f'<html lang="{"en-US" if locale == "en" else "es"}"', doc, count=1)
    # canonical / og:url / hreflang
    doc = re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', f'<link rel="canonical" href="{SITE}{alts[locale]}" />', doc)
    doc = re.sub(r'<meta property="og:url" content="[^"]*"', f'<meta property="og:url" content="{SITE}{alts[locale]}"', doc)
    doc = re.sub(r'<meta property="og:locale" content="[^"]*"', f'<meta property="og:locale" content="{"en_US" if locale == "en" else "es_ES"}"', doc)
    hreflang = "".join(f'<link rel="alternate" hreflang="{l}" href="{SITE}{alts[l]}" />' for l in LOCALES)
    hreflang += f'<link rel="alternate" hreflang="x-default" href="{SITE}{alts["en"]}" />'
    doc = doc.replace("</head>", hreflang + '<link rel="stylesheet" href="/pd-lang.css" />\n</head>', 1)
    # Language switcher: in the desktop header next to search, and in the mobile panel.
    # The server fills these markers with links to this page in each language,
    # so the header stays identical on every page and is stored once.
    # Desktop toggle goes at the end of the primary nav (the header is a fixed grid).
    nav = doc.find('<nav class="main-nav"')
    if nav >= 0:
        end = doc.find("</nav>", nav)
        doc = doc[:end] + "<!--@lang-->" + doc[end:]
    doc = re.sub(r'(<nav\s+class="mobile-nav-panel"[^>]*>)', r"\1<!--@lang-mobile-->", doc, count=1)
    if locale == "es":
        # Scripts and the protocol-builder iframe that have a Spanish copy
        # (public/.../name.es.js, peptide-prep.es.html) are swapped in.
        def swap(m):
            p = m.group(2)
            base, ext = os.path.splitext(p)
            es = f"{base}.es{ext}"
            return m.group(1) + (es if os.path.exists(os.path.join(ROOT, "public", es.lstrip("/"))) else p)

        doc = re.sub(r'((?:src)=["\'])(/wp-content/[^"\'?]+\.(?:js|html))', swap, doc)
        doc = apply_inline_script_strings(doc)
    return doc


INLINE_PATH = os.path.join(ROOT, "translations/es/inline-scripts.json")
INLINE = json.load(open(INLINE_PATH, encoding="utf8")) if os.path.exists(INLINE_PATH) else []


def apply_inline_script_strings(doc: str) -> str:
    """Replace English string literals inside inline <script> blocks."""
    if not INLINE:
        return doc

    def fix(m):
        body = m.group(2)
        for en, es in INLINE:
            body = body.replace(en, es)
        return m.group(1) + body + m.group(3)

    return re.sub(r"(<script\b(?![^>]*\bsrc=)[^>]*>)(.*?)(</script>)", fix, doc, flags=re.S)


def build_page(args):
    src, out_dir = args
    key = os.path.basename(src)[:-5]
    path = "" if key == "index" else key.replace("__", "/")
    doc = open(src, encoding="utf8").read()
    results, stats = {}, {"hit": 0, "miss": 0, "bad": 0}
    for locale in LOCALES:
        d = translate_doc(doc, stats) if locale == "es" else doc
        d = rewrite_links(d, locale)
        d = finish(d, locale, path)
        results[locale] = d
    return key, results, stats


def split_header(pages: dict) -> tuple[str, dict]:
    """Find the shared header (body start up to the breadcrumb) and replace it with a marker."""
    starts = {}
    for k, d in pages.items():
        b = d.find("<body")
        be = d.find(">", b) + 1
        starts[k] = be
    candidates = [k for k, d in pages.items() if "pdmh-header" in d]
    common = os.path.commonprefix([pages[k][starts[k]:] for k in candidates])
    cut = common.rfind("</nav>")
    cut = common.find("\n", cut) + 1 if cut > 0 else 0
    header = common[:cut]
    if len(header) < 10000:
        return "", pages
    out = {}
    for k, d in pages.items():
        s = starts[k]
        out[k] = d[:s] + HEADER_MARK + d[s + len(header):] if d[s:].startswith(header) else d
    return header, out


def main(src_dir, out_dir):
    files = sorted(glob.glob(os.path.join(src_dir, "*.html")))
    per_locale = {l: {} for l in LOCALES}
    totals = {"hit": 0, "miss": 0, "bad": 0}
    with ProcessPoolExecutor() as ex:
        for key, results, stats in ex.map(build_page, [(f, out_dir) for f in files], chunksize=2):
            for l in LOCALES:
                per_locale[l][key] = results[l]
            for k in totals:
                totals[k] += stats[k]
    for l in LOCALES:
        d = os.path.join(out_dir, l)
        os.makedirs(d, exist_ok=True)
        for f in glob.glob(os.path.join(d, "*.html")):
            os.remove(f)
        header, pages = split_header(per_locale[l])
        open(os.path.join(d, "_header.html"), "w", encoding="utf8").write(header)
        for k, doc in pages.items():
            open(os.path.join(d, f"{k}.html"), "w", encoding="utf8").write(doc)
        shared = sum(HEADER_MARK in p for p in pages.values())
        print(f"{l}: {len(pages)} pages, header {len(header)//1000} KB shared by {shared}")
    print(f"es units: {totals['hit']} translated, {totals['miss']} still English, {totals['bad']} invalid")
    # page list for the Next.js route
    manifest = {}
    for key in per_locale["en"]:
        path = "" if key == "index" else key.replace("__", "/")
        manifest[key] = {l: localized_path(l, path) for l in LOCALES}
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
