"""Build the Spanish search data from the translated Spanish pages.

    python3 scripts/clone/es_search.py

- search-corpus.es.json: one entry per search-corpus.json entry, with the Spanish URL,
  title (page H1), summary (meta description) and body text, used by the results page.
- public/data/es/search-index.json: header suggestion titles refreshed from the H1s.
Run after scripts/clone/translate_inplace.py.
"""
import html as htmlmod
import json
import os
import re

from bs4 import BeautifulSoup

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SITE = os.path.join(ROOT, "site")
manifest = json.load(open(os.path.join(SITE, "manifest.json"), encoding="utf8"))
by_es_url = {v["es"]: k for k, v in manifest.items()}


def key_for(path):
    p = path.strip("/")
    return p.replace("/", "__") if p else "index"


def page(key):
    path = os.path.join(SITE, "es", f"{key}.html")
    return BeautifulSoup(open(path, encoding="utf8").read(), "html.parser") if os.path.exists(path) else None


def clean(text):
    return re.sub(r"\s+", " ", htmlmod.unescape(text or "")).strip()


def heading(soup):
    h1 = soup.find("h1")
    return clean(h1.get_text()) if h1 else None


corpus = json.load(open(os.path.join(ROOT, "search-corpus.json"), encoding="utf8"))
out = []
for entry in corpus:
    key = key_for(entry["path"])
    soup = page(key) if key in manifest else None
    if soup is None:
        continue
    meta = soup.find("meta", attrs={"name": "description"})
    for tag in soup(["script", "style", "noscript", "svg", "header", "nav", "footer"]):
        tag.decompose()
    main = soup.find("main") or soup.body or soup
    body = clean(main.get_text(" "))[: max(len(entry["body"]), 2000)]
    out.append({
        "path": manifest[key]["es"],
        "title": heading(soup) or entry["title"],
        "summary": clean(meta["content"]) if meta and meta.get("content") else entry["summary"],
        "body": body,
        "kind": entry["kind"],
        "source": entry["path"],
    })
json.dump(out, open(os.path.join(ROOT, "search-corpus.es.json"), "w", encoding="utf8"), ensure_ascii=False)

index_path = os.path.join(ROOT, "public/data/es/search-index.json")
index = json.load(open(index_path, encoding="utf8"))
renamed = 0
for item in index["items"]:
    key = by_es_url.get(item["url"])
    soup = page(key) if key else None
    title = heading(soup) if soup else None
    if title and title != item["title"]:
        item["title"] = title
        renamed += 1
json.dump(index, open(index_path, "w", encoding="utf8"), ensure_ascii=False)
print(f"search corpus: {len(out)} Spanish entries; suggestions: {renamed} titles updated of {len(index['items'])}")
