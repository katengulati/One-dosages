"""Find translatable text in an HTML document.

A "unit" is the inner HTML of the smallest block element that holds text,
including its inline markup (links, bold, ...), so sentences are translated
whole. Attributes such as alt/title/aria-label and SEO meta tags are units too.

The same walk is used to extract units (English) and to apply translations,
so both sides always agree on what a unit is.
"""
import os
import sys

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

sys.path.insert(0, os.path.dirname(__file__))
from common import INLINE_TAGS, META_CONTENT, SKIP_TAGS, TRANSLATABLE_ATTRS, needs_translation, normalize  # noqa: E402


def parse(doc: str) -> BeautifulSoup:
    return BeautifulSoup(doc, "html.parser")


def _has_direct_text(el: Tag) -> bool:
    return any(
        isinstance(c, NavigableString) and not isinstance(c, Comment) and c.strip() for c in el.children
    )


def _is_inline_only(el: Tag) -> bool:
    """True if el contains only text and inline tags (recursively)."""
    for d in el.descendants:
        if isinstance(d, Tag) and (d.name not in INLINE_TAGS or d.name in SKIP_TAGS):
            return False
    return True


def walk(soup: BeautifulSoup, on_block, on_text, on_attr):
    """Call on_block(el) for inline-only text blocks, on_text(navstring) for
    loose text in mixed blocks, on_attr(el, attr) for translatable attributes."""

    def visit(el: Tag):
        if el.name in SKIP_TAGS:
            return
        for attr in TRANSLATABLE_ATTRS:
            v = el.get(attr)
            if isinstance(v, str) and needs_translation(v):
                on_attr(el, attr)
        if el.name == "meta":
            name = el.get("name") or el.get("property")
            if name in META_CONTENT and needs_translation(el.get("content", "")):
                on_attr(el, "content")
            return
        if el.name == "input" and el.get("type") in ("submit", "button") and needs_translation(el.get("value", "")):
            on_attr(el, "value")

        if el.name not in INLINE_TAGS and el.name not in ("[document]", "html", "head", "body") and _is_inline_only(el):
            if needs_translation(el.decode_contents()):
                on_block(el)
                # attributes of inline children (e.g. link titles, image alts)
                for d in el.find_all(True):
                    for attr in TRANSLATABLE_ATTRS:
                        v = d.get(attr)
                        if isinstance(v, str) and needs_translation(v):
                            on_attr(d, attr)
            return

        for c in list(el.children):
            if isinstance(c, Tag):
                visit(c)
            elif isinstance(c, NavigableString) and not isinstance(c, Comment) and type(c) is NavigableString:
                if el.name not in ("[document]", "html", "head") and needs_translation(str(c)):
                    on_text(c)

    visit(soup)


VOID = {"br", "img", "wbr"}


def skeleton(el: Tag):
    """Inner HTML of el with inline tags replaced by numbered placeholders.

    '<a href="/x">BPC-157</a> is <strong>new</strong>' -> '<t1>BPC-157</t1> is <t2>new</t2>'
    Returns (skeleton, [tags in document order]).
    """
    tags: list = []

    def render(node) -> str:
        out = []
        for c in node.children:
            if isinstance(c, Comment):
                continue
            if isinstance(c, NavigableString):
                out.append(str(c).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            elif isinstance(c, Tag):
                tags.append(c)
                n = len(tags)
                if c.name in VOID:
                    out.append(f"<t{n}/>")
                else:
                    out.append(f"<t{n}>{render(c)}</t{n}>")
        return "".join(out)

    return normalize(render(el)), tags


def block_html(el: Tag) -> str:
    return skeleton(el)[0]


def text_value(s: NavigableString) -> str:
    return normalize(str(s))
