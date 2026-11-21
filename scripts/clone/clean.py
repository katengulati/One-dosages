"""Step 1: clean the downloaded pages.

    python3 scripts/clone/clean.py <raw_pages_dir> <out_dir>

- removes analytics/tracking scripts, WordPress API discovery links and the
  bot-check form script (they point at the original site's backend)
- points every asset at the local copy (/wp-content/...) and .png uploads at .webp
- leaves page links absolute (https://peptidedosages.com/...) so the build
  step can map them to /en/... or /es/...
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import ORIGIN_RE  # noqa: E402

REMOVE_PATTERNS = [
    # Analytics, tracking, bot protection, comment/API discovery
    r"<script[^>]*id=['\"](?:pd-lightweight-ga4|vja-[\w-]+|pdas|pd-preferred-sources)[\w-]*['\"][^>]*>.*?</script>",
    r"<script[^>]*src=['\"][^'\"]*(?:pd-lightweight-ga4|visitor-journey-analytics|pd-audience-security|googletagmanager|challenges\.cloudflare)[^'\"]*['\"][^>]*>\s*</script>",
    r"<link[^>]*(?:oembed|EditURI|shortlink|api\.w\.org|wp-json/wp/v2)[^>]*/?>",
    r"<link[^>]*href=['\"][^'\"]*pd-audience-security[^'\"]*['\"][^>]*/?>",
    r"<script type=\"speculationrules\">.*?</script>",
]


def clean(doc: str) -> str:
    for pat in REMOVE_PATTERNS:
        doc = re.sub(pat, "", doc, flags=re.S | re.I)
    # Inline scripts that only configure trackers (identified by their globals).
    doc = re.sub(
        r"<script\b[^>]*>(?:(?!</script>).)*?(?:PD_GA4_CONFIG|VJA_CONFIG|window\.PDAS\b|gtag\()(?:(?!</script>).)*</script>",
        "",
        doc,
        flags=re.S,
    )
    # Uploaded PNGs were converted to WebP.
    doc = re.sub(
        r"((?:" + ORIGIN_RE + r")?(?:/|\\/)wp-content(?:/|\\/)uploads(?:/|\\/)[^\"'\s)>,]*?)\.png\b",
        r"\1.webp",
        doc,
    )
    # Assets → local paths (plain and JSON-escaped forms).
    doc = re.sub(ORIGIN_RE + r"(/|\\/)(wp-content|wp-includes)\b", r"\1\2", doc)
    # Header search index → local per-language JSON.
    doc = re.sub(ORIGIN_RE + r"/wp-json/pd-header/v1/index", "/data/__LOCALE__/search-index.json", doc)
    return doc


def main(src: str, out: str) -> None:
    os.makedirs(out, exist_ok=True)
    n = 0
    for name in sorted(os.listdir(src)):
        if not name.endswith(".html"):
            continue
        with open(os.path.join(src, name), encoding="utf8") as f:
            doc = f.read()
        with open(os.path.join(out, name), "w", encoding="utf8") as f:
            f.write(clean(doc))
        n += 1
    print(f"cleaned {n} pages -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
