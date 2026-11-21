"""Step 5: per-language data files used by the site's scripts.

    python3 scripts/clone/data.py <search-index.json> <presets_dir>

- public/data/<locale>/search-index.json   header search suggestions
- public/data/<locale>/presets/<mode>[-<id>].json   protocol-builder registry
- patches peptide-prep(.es).html to read those static files instead of the
  WordPress REST endpoint
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import build  # noqa: E402  (reuses slugs + translations)
from common import ORIGIN_RE, unit_id  # noqa: E402

PUBLIC = os.path.join(build.ROOT, "public")
STRINGS_PATH = os.path.join(build.ROOT, "translations/es/data-strings.json")
STRINGS = json.load(open(STRINGS_PATH, encoding="utf8")) if os.path.exists(STRINGS_PATH) else {}


def es_text(en: str) -> str:
    if en in STRINGS:
        return STRINGS[en]
    return build.TR.get(unit_id(en)) or build.TR.get(unit_id(f"<t1>{en}</t1>"), "").replace("<t1>", "").replace("</t1>", "") or en


def local_url(url: str, locale: str) -> str:
    m = re.match(ORIGIN_RE + r"(/.*)$", url)
    if not m:
        return url
    return build.localized_path(locale, m.group(1)) or url


def main(index_path, presets_dir):
    index = json.load(open(index_path, encoding="utf8"))
    for locale in build.LOCALES:
        out = os.path.join(PUBLIC, "data", locale)
        os.makedirs(os.path.join(out, "presets"), exist_ok=True)
        items = []
        for it in index["items"]:
            it = dict(it, url=local_url(it["url"], locale))
            if locale == "es":
                it["title"] = es_text(it["title"])
                it["kind"] = es_text(it.get("kind", ""))
            items.append(it)
        json.dump(dict(index, items=items), open(os.path.join(out, "search-index.json"), "w", encoding="utf8"), ensure_ascii=False)

        for f in glob.glob(os.path.join(presets_dir, "*.json")):
            data = json.load(open(f, encoding="utf8"))
            for r in data.get("records", []):
                if "url" in r:
                    r["url"] = local_url(r["url"], locale)
                if locale == "es":
                    for k in ("diluent", "evidence_source", "label", "name"):
                        if isinstance(r.get(k), str):
                            r[k] = es_text(r[k])
                    if isinstance(r.get("unit"), str):
                        r["unit"] = r["unit"].replace(" in ", " en ")
            json.dump(data, open(os.path.join(out, "presets", os.path.basename(f)), "w", encoding="utf8"), ensure_ascii=False)
    print(f"search index: {len(index['items'])} items; presets: {len(glob.glob(os.path.join(presets_dir, '*.json')))} files per language")

    # Point the protocol builder at the static preset files.
    old = re.compile(
        r"const endpoint = new URL\(privatePreview \? .*?\);\n\s*endpoint\.searchParams\.set\('mode', MODE\);\n\s*if \(RECORD_ID\) endpoint\.searchParams\.set\('id', String\(RECORD_ID\)\);",
        re.S,
    )
    for name, locale in (("peptide-prep.html", "en"), ("peptide-prep.es.html", "es")):
        p = os.path.join(PUBLIC, "wp-content/plugins/pd-protocol-builder/assets", name)
        if not os.path.exists(p):
            continue
        t = open(p, encoding="utf8").read()
        new = (
            f"const endpoint = new URL(location.origin + '/data/{locale}/presets/' + MODE + (RECORD_ID ? '-' + RECORD_ID : '') + '.json');"
        )
        t2 = old.sub(new, t)
        if t2 != t or new in t:
            open(p, "w", encoding="utf8").write(t2)
            print(f"patched {name}")
        else:
            print(f"WARNING: could not patch {name}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
