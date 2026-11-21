"""Shared helpers for the site-clone pipeline (see scripts/clone/README.md)."""
import hashlib
import html
import re

ORIGIN = "https://peptidedosages.com"
ORIGIN_RE = r"https?:(?://|\\/\\/)(?:www\.)?peptidedosages\.com"

# Tags whose text is never translated.
SKIP_TAGS = {"script", "style", "noscript", "svg", "code", "pre", "textarea", "template", "math"}
# Inline tags: text inside them is translated together with the surrounding block.
INLINE_TAGS = {
    "a", "abbr", "b", "bdi", "bdo", "br", "cite", "data", "dfn", "em", "i", "img", "kbd", "mark",
    "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr", "del", "ins",
}
TRANSLATABLE_ATTRS = ("alt", "title", "aria-label", "placeholder", "data-tooltip", "aria-description", "aria-roledescription")
META_CONTENT = {"description", "og:title", "og:description", "twitter:title", "twitter:description", "og:image:alt", "twitter:image:alt"}

LETTERS = re.compile(r"[A-Za-z]{2}")


def key_for_path(path: str) -> str:
    path = path.strip("/")
    return path.replace("/", "__") if path else "index"


def unit_id(text: str) -> str:
    return hashlib.sha1(normalize(text).encode("utf8")).hexdigest()[:16]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def needs_translation(text: str) -> bool:
    t = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return bool(LETTERS.search(t))
