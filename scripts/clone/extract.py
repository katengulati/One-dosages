"""Step 2: collect every translatable unit from the cleaned pages.

    python3 scripts/clone/extract.py <clean_dir> <units.json>

Output: {"<id>": {"en": "<html or text>", "kind": "block|text|attr", "count": N, "pages": [...]}}
"""
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from common import normalize, unit_id  # noqa: E402
from units import block_html, parse, text_value, walk  # noqa: E402


def extract_one(path: str):
    with open(path, encoding="utf8") as f:
        soup = parse(f.read())
    found = []
    walk(
        soup,
        on_block=lambda el: found.append(("block", block_html(el))),
        on_text=lambda s: found.append(("text", text_value(s))),
        on_attr=lambda el, a: found.append(("attr", normalize(el[a]))),
    )
    return os.path.basename(path)[:-5], found


def main(src: str, out: str) -> None:
    files = sorted(os.path.join(src, f) for f in os.listdir(src) if f.endswith(".html"))
    units: dict = {}
    with ProcessPoolExecutor() as ex:
        for page, found in ex.map(extract_one, files, chunksize=4):
            for kind, en in found:
                uid = unit_id(en)
                u = units.setdefault(uid, {"en": en, "kind": kind, "count": 0, "pages": []})
                u["count"] += 1
                if page not in u["pages"]:
                    u["pages"].append(page)
    with open(out, "w", encoding="utf8") as f:
        json.dump(units, f, ensure_ascii=False, indent=0)
    chars = sum(len(u["en"]) for u in units.values())
    print(f"{len(units)} unique units, {chars} chars, from {len(files)} pages")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
