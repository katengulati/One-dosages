"""Check translated batches against their English source.

    python3 scripts/clone/validate.py <batch.json> <translated.json>   (one pair)
    python3 scripts/clone/validate.py <batches_dir> <translations_dir> (all pairs)

Fails a unit if an id is missing, the <tN> placeholders differ, or any number
from the English text is missing (dose values must never change).
"""
import glob
import json
import os
import re
import sys

PH = re.compile(r"</?t\d+/?>")
NUM = re.compile(r"\d+(?:[.,]\d+)*")


def check(src: dict, dst: dict):
    problems = []
    for k, en in src.items():
        es = dst.get(k)
        if not isinstance(es, str):
            problems.append((k, "missing"))
            continue
        if sorted(PH.findall(en)) != sorted(PH.findall(es)):
            problems.append((k, "placeholders differ"))
            continue
        en_nums = sorted(NUM.findall(re.sub(PH, " ", en)))
        es_nums = sorted(NUM.findall(re.sub(PH, " ", es)))
        if en_nums != es_nums:
            # allow 1,250 -> 1.250 / 1 250 thousands formatting but nothing else
            norm = lambda xs: sorted(x.replace(",", "").replace(".", "") for x in xs)
            if norm(en_nums) != norm(es_nums):
                problems.append((k, f"numbers differ {en_nums} vs {es_nums}"))
    return problems


def main(a, b):
    pairs = []
    if os.path.isdir(a):
        for f in sorted(glob.glob(os.path.join(a, "*.json"))):
            pairs.append((f, os.path.join(b, os.path.basename(f))))
    else:
        pairs.append((a, b))
    total = 0
    for s, d in pairs:
        if not os.path.exists(d):
            print(f"{os.path.basename(s)}: NOT TRANSLATED")
            total += 1
            continue
        try:
            dst = json.load(open(d, encoding="utf8"))
        except Exception as e:  # noqa: BLE001
            print(f"{os.path.basename(s)}: invalid JSON ({e})")
            total += 1
            continue
        probs = check(json.load(open(s, encoding="utf8")), dst)
        total += len(probs)
        if probs:
            print(f"{os.path.basename(s)}: {len(probs)} problems")
            for k, p in probs[:15]:
                print(f"  {k}: {p}")
    print("OK" if total == 0 else f"{total} problems")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
