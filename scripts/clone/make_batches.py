"""Step 3a: split untranslated units into batch files for translators.

    python3 scripts/clone/make_batches.py <units.json> <translations_dir> <batches_dir> [max_chars]

Units already present in <translations_dir>/*.json are skipped, so this can be
re-run to pick up only what is still missing.
"""
import glob
import json
import os
import sys


def main(units_path, tr_dir, out_dir, max_chars=40000):
    units = json.load(open(units_path, encoding="utf8"))
    done = {}
    for f in glob.glob(os.path.join(tr_dir, "*.json")):
        done.update(json.load(open(f, encoding="utf8")))
    todo = [(k, v) for k, v in units.items() if k not in done]
    # Group by first page so each batch has related context.
    todo.sort(key=lambda kv: kv[1]["pages"][0])
    os.makedirs(out_dir, exist_ok=True)
    for f in glob.glob(os.path.join(out_dir, "*.json")):
        os.remove(f)
    batch, size, n = {}, 0, 0
    for k, v in todo:
        if size + len(v["en"]) > max_chars and batch:
            n += 1
            json.dump(batch, open(os.path.join(out_dir, f"batch-{n:03d}.json"), "w", encoding="utf8"), ensure_ascii=False, indent=0)
            batch, size = {}, 0
        batch[k] = v["en"]
        size += len(v["en"])
    if batch:
        n += 1
        json.dump(batch, open(os.path.join(out_dir, f"batch-{n:03d}.json"), "w", encoding="utf8"), ensure_ascii=False, indent=0)
    print(f"{len(todo)} units to translate in {n} batches ({len(done)} already done)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 40000)
