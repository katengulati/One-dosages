#!/usr/bin/env node
// Lists which English pages have a Spanish version in content/es/ and which don't.
//   npm run i18n:status

import fs from "node:fs";
import path from "node:path";

const read = (locale) => {
  const dir = path.join(process.cwd(), "content", locale);
  if (!fs.existsSync(dir)) return new Map();
  return new Map(
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const e = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        return [e.key, e];
      }),
  );
};

const en = read("en");
const es = read("es");
const missing = [...en.keys()].filter((k) => !es.has(k));
const slugs = new Map();
for (const e of es.values()) {
  if (slugs.has(e.slug)) console.warn(`Duplicate Spanish slug "${e.slug}": ${slugs.get(e.slug)} and ${e.key}`);
  slugs.set(e.slug, e.key);
}

console.log(`English pages: ${en.size}`);
console.log(`Translated to Spanish: ${en.size - missing.length}`);
console.log(`Missing Spanish: ${missing.length}`);
for (const k of missing) console.log(`  - ${k}  (${en.get(k).title})`);
