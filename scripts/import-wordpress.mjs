#!/usr/bin/env node
// Imports a WordPress export (Tools → Export → All content, a WXR .xml file)
// into content/en/*.json.
//
//   npm run import:wordpress -- wordpress-export/site.xml
//
// Every published page, post and category becomes one JSON file. URLs keep
// the original WordPress paths, so /en/ matches the live site. Links inside
// the content that point at the original domain are rewritten to /en/... .
// Spanish versions go in content/es/ with the same "key" (see README).

import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run import:wordpress -- <export.xml>");
  process.exit(1);
}

const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: "__cdata", textNodeName: "#text" });
const xml = parser.parse(fs.readFileSync(file, "utf8"));
const channel = xml.rss.channel;
const siteUrl = String(text(channel.link)).replace(/\/$/, "");

function text(v) {
  if (v == null) return "";
  if (typeof v === "object") return v.__cdata ?? v["#text"] ?? "";
  return String(v);
}
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const slugFromUrl = (url) => new URL(url, siteUrl).pathname.replace(/^\/|\/$/g, "");
const keyFor = (slug) => slug.replaceAll("/", "__") || "index";

function rewriteLinks(html) {
  const escaped = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/^https?/, "https?");
  return html
    // Links to uploads keep pointing at /wp-content/... (copy uploads into public/).
    .replace(new RegExp(`${escaped}(/wp-content/)`, "g"), "$1")
    .replace(new RegExp(`(href=["'])${escaped}/`, "g"), "$1/en/");
}

// WordPress stores paragraphs as blank lines in classic-editor content.
function autop(html) {
  if (/<(p|div|h\d|ul|table|figure)\b/i.test(html) || html.includes("<!-- wp:")) return html;
  return html
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

const categories = new Map();
for (const c of arr(channel["wp:category"])) {
  categories.set(text(c["wp:category_nicename"]), text(c["wp:cat_name"]));
}

const outDir = path.join(process.cwd(), "content", "en");
fs.mkdirSync(outDir, { recursive: true });
const counts = { page: 0, post: 0, category: 0, skipped: 0 };

for (const item of arr(channel.item)) {
  const type = text(item["wp:post_type"]);
  const status = text(item["wp:status"]);
  if (!["page", "post"].includes(type) || status !== "publish") {
    counts.skipped++;
    continue;
  }
  const slug = slugFromUrl(text(item.link));
  if (!slug) {
    counts.skipped++; // the front page is built in React (src/app/[locale]/page.tsx)
    continue;
  }
  const meta = Object.fromEntries(arr(item["wp:postmeta"]).map((m) => [text(m["wp:meta_key"]), text(m["wp:meta_value"])]));
  const cats = arr(item.category).filter((c) => c["@_domain"] === "category").map((c) => c["@_nicename"]);
  const entry = {
    key: keyFor(slug),
    slug,
    type,
    title: text(item.title),
    description: meta._yoast_wpseo_metadesc || text(item["excerpt:encoded"]) || undefined,
    html: rewriteLinks(autop(text(item["content:encoded"]))),
    category: cats[0],
    updated: text(item["wp:post_modified_gmt"]).replace(" ", "T") + "Z",
  };
  fs.writeFileSync(path.join(outDir, `${entry.key}.json`), JSON.stringify(entry, null, 2) + "\n");
  counts[type]++;
}

for (const [nicename, name] of categories) {
  const slug = `category/${nicename}`;
  const entry = { key: keyFor(slug), slug, type: "category", title: name, html: "" };
  fs.writeFileSync(path.join(outDir, `${entry.key}.json`), JSON.stringify(entry, null, 2) + "\n");
  counts.category++;
}

console.log(`Imported from ${siteUrl}:`, counts);
console.log("Next: npm run i18n:status to see which pages still need Spanish versions.");
