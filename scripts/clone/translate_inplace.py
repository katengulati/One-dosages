"""Apply Spanish translations to the built Spanish pages in place.

    python3 scripts/clone/translate_inplace.py [site_dir]

site/es/*.html were built while most units were still untranslated, and have been
edited since, so instead of rebuilding from the original capture this walks each
built Spanish page with the same unit rules as build.py and swaps every English
unit that now has a translation (translations/es/units/*.json). It also translates
table data-label attributes (translations/es/data-labels.json) and the strings in
schema.org JSON-LD blocks (translations/es/jsonld.json). Units that are already
Spanish simply have no entry and stay as they are.
"""
import glob
import html as htmlmod
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from bs4 import BeautifulSoup, NavigableString  # noqa: E402
from bs4.formatter import HTMLFormatter  # noqa: E402
from build import TR, rebuild  # noqa: E402
from common import normalize, unit_id  # noqa: E402
from units import parse, skeleton, walk  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")


def load(name):
    path = os.path.join(ROOT, "translations/es", name)
    return json.load(open(path, encoding="utf8")) if os.path.exists(path) else {}


DATA_LABELS = load("data-labels.json")
JSONLD = load("jsonld.json")


class KeepOrder(HTMLFormatter):
    """Serialize attributes in their original order (bs4 sorts them by default)."""

    def attributes(self, tag):
        return list(tag.attrs.items())


FORMAT = KeepOrder(entity_substitution=HTMLFormatter.REGISTRY["minimal"].entity_substitution)


def translate_soup(soup, stats):
    blocks, texts, attrs = [], [], []
    walk(soup, on_block=blocks.append, on_text=texts.append, on_attr=lambda el, a: attrs.append((el, a)))

    def lookup(en):
        es = TR.get(unit_id(en))
        stats["hit" if es is not None else "miss"] += 1
        return es

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
    for el in soup.find_all(attrs={"data-label": True}):
        es = DATA_LABELS.get(normalize(el["data-label"]))
        if es:
            el["data-label"] = es


def translate_jsonld(doc):
    if not JSONLD:
        return doc

    def fix(value):
        if isinstance(value, dict):
            return {k: fix(v) for k, v in value.items()}
        if isinstance(value, list):
            return [fix(v) for v in value]
        if isinstance(value, str):
            return JSONLD.get(value, value)
        return value

    def block(m):
        try:
            data = json.loads(m.group(2))
        except ValueError:
            return m.group(0)
        out = json.dumps(fix(data), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        return m.group(1) + out + m.group(3)

    return re.sub(r'(<script\b[^>]*application/ld\+json[^>]*>)(.*?)(</script>)', block, doc, flags=re.S)


TITLE_EN = re.compile(r"\b(the|and|of|with|for|your|to|peptide|dosage|research|guide|policy|us|calculator|blog|health|loss|weight|benefits|safety|chart|protocol|explained|glossary|questions|hormone|simulator)\b", re.I)
TITLE_OVERRIDES = {"Blog": "Blog de investigación sobre péptidos"}


def translate_title(doc, en_doc=""):
    """Browser-tab titles were never units; an English one becomes the page's Spanish H1."""
    title = re.search(r"<title>(.*?)</title>", doc, re.S)
    heading = re.search(r"<h1\b[^>]*>(.*?)</h1>", doc, re.S)
    if not title or not heading:
        return doc
    text = re.sub(r"(PeptideDosages(?:\.com)?|peptidedosages\.com|Peptide Dosages|One Aminos)", "", htmlmod.unescape(title.group(1)))
    en_title = re.search(r"<title>(.*?)</title>", en_doc, re.S)
    same_as_english = bool(en_title) and normalize(en_title.group(1)) == normalize(title.group(1))
    if not same_as_english and not TITLE_EN.search(text):
        return doc
    h1 = normalize(htmlmod.unescape(re.sub(r"<[^>]+>", "", heading.group(1))))
    h1 = TITLE_OVERRIDES.get(h1, h1)
    if not h1 or TITLE_EN.search(h1) and not re.search(r"[áéíóúñ¿]", h1):
        return doc
    return doc[: title.start(1)] + htmlmod.escape(h1, quote=False) + " | PeptideDosages.com" + doc[title.end(1):]


def main(site_dir):
    totals = {"hit": 0, "miss": 0, "bad": 0}
    changed = 0
    for path in sorted(glob.glob(os.path.join(site_dir, "es", "*.html"))):
        doc = open(path, encoding="utf8").read()
        soup = parse(doc)
        stats = {"hit": 0, "miss": 0, "bad": 0}
        translate_soup(soup, stats)
        en_path = os.path.join(site_dir, "en", os.path.basename(path))
        en_doc = open(en_path, encoding="utf8").read() if os.path.exists(en_path) else ""
        out = translate_title(translate_jsonld(soup.decode(formatter=FORMAT) if stats["hit"] or soup.find(attrs={"data-label": True}) else doc), en_doc)
        for k in totals:
            totals[k] += stats[k]
        if out != doc:
            open(path, "w", encoding="utf8").write(out)
            changed += 1
    print(f"{changed} pages updated; units {totals['hit']} translated, {totals['bad']} invalid")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site"))
