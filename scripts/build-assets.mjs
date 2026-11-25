// Builds the asset registry that replaces the captured WordPress stylesheets and
// scripts. Every legacy CSS/JS file (and the WordPress core inline <style> blocks) is
// path-rewritten, stripped of rules no page uses, minified and stored by id; pages then
// load one bundle per run of files (see src/lib/asset-bundles.ts and /bundle/[file]).
//
// Run automatically before `next build` and `next dev`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { transform } from 'esbuild';
import { PurgeCSS } from 'purgecss';
import { rewriteLegacyPaths } from './legacy-paths.mjs';

const root = process.cwd();
const generated = join(root, 'src', 'generated');

function walk(dir, test, found = []) {
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, test, found);
    else if (test(name)) found.push(path);
  }
  return found;
}

const publicUrl = (file) => '/' + relative(join(root, 'public'), file).split('\\').join('/');

// Sources: theme + plugin CSS/JS, the old language pill CSS, the preview forms script
// and the trimmed Font Awesome stylesheet (subset fonts live in public/assets/icons).
const legacyDirs = ['public/assets/theme', 'public/assets/plugins'].map((dir) => join(root, dir));
const cssFiles = legacyDirs.flatMap((dir) => walk(dir, (name) => name.endsWith('.css')))
  .concat(join(root, 'public', 'pd-lang.css'));
const jsFiles = legacyDirs.flatMap((dir) => walk(dir, (name) => name.endsWith('.js')))
  .concat(join(root, 'public', 'preview', 'forms.js'));

// Every token that could name a class, id, tag or attribute anywhere a page is built.
const contentFiles = [
  ...walk(join(root, 'site'), (name) => /\.(html|json)$/.test(name)),
  ...walk(join(root, 'src'), (name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')),
  ...walk(join(root, 'public'), (name) => name.endsWith('.js') && !name.endsWith('.min.js')),
  join(root, 'search-template.html')
].filter((file) => existsSync(file) && !file.includes(`${join('src', 'generated')}`));

const tokens = new Set();
const inlineStyles = new Map();
const inlineStylePattern = /<style\b[^>]*\bid="((?:wp-[a-z0-9-]+|classic-theme-styles|global-styles)-inline-css)"[^>]*>([\s\S]*?)<\/style>/g;
for (const file of contentFiles) {
  const text = readFileSync(file, 'utf8');
  for (const token of text.match(/[A-Za-z0-9_-]+/g) ?? []) {
    tokens.add(token);
    tokens.add('#' + token); // attribute selectors such as a[href="#section"]
  }
  // Whole attribute values (single words only, since tokens are space-separated).
  for (const [, value] of text.matchAll(/=\\?["']([^"'\s<>\\]{1,120})\\?["']/g)) tokens.add(value);
  if (file.endsWith('.html')) {
    for (const [, id, css] of text.matchAll(inlineStylePattern)) {
      const key = inlineKey(css);
      if (!inlineStyles.has(key)) inlineStyles.set(key, { name: id, css });
    }
  }
}
const raw = [...tokens].join(' ');

export function inlineKey(css) {
  return createHash('sha1').update(css.trim()).digest('hex').slice(0, 12);
}

// Classes assembled at runtime by the legacy scripts.
const safelist = { standard: [], deep: [], greedy: [/^pd-prep-mode-/, /^opt-/, /^ref-/, /^section-/] };

async function purge(css) {
  const [result] = await new PurgeCSS().purge({
    content: [{ raw, extension: 'html' }],
    css: [{ raw: css }],
    defaultExtractor: (content) => content.split(' '),
    safelist,
    fontFace: false,
    keyframes: false,
    variables: false
  });
  return result.css;
}

function absolutizeUrls(css, fileUrl) {
  const base = posix.dirname(fileUrl);
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, target) => {
    if (/^(data:|https?:|\/|#)/.test(target)) return match;
    return `url("${posix.normalize(posix.join(base, target))}")`;
  });
}

const registry = { css: {}, js: {}, inline: {}, code: [] };

async function addCss(key, css, url) {
  const prepared = rewriteLegacyPaths(url ? absolutizeUrls(css, url) : css);
  const purged = await purge(prepared);
  const { code } = await transform(purged, { loader: 'css', minify: true, legalComments: 'none' });
  registry.code.push(code);
  return registry.code.length - 1;
}

for (const file of cssFiles) {
  const url = publicUrl(file);
  registry.css[url] = await addCss(url, readFileSync(file, 'utf8'), url);
}
registry.css['/assets/icons/font-awesome.css'] = await addCss('fa', readFileSync(join(root, 'assets-src', 'font-awesome.css'), 'utf8'));
for (const [key, { css }] of inlineStyles) registry.inline[key] = await addCss(key, css);

for (const file of jsFiles) {
  const source = rewriteLegacyPaths(readFileSync(file, 'utf8'));
  // No format: top-level names stay global, so inline handlers keep working.
  const { code } = await transform(source, { loader: 'js', minify: true, legalComments: 'none', target: 'es2018' });
  registry.code.push(code.trim().replace(/;?$/, ';'));
  registry.js[publicUrl(file)] = registry.code.length - 1;
}

registry.version = createHash('sha1').update(JSON.stringify(registry.code)).digest('hex').slice(0, 10);
mkdirSync(generated, { recursive: true });
const { code: bundleCode, ...index } = registry;
// The page pipeline only needs the small index; the code is read by /bundle/[file].
writeIfChanged(join(generated, 'asset-index.json'), JSON.stringify(index));
writeIfChanged(join(generated, 'asset-code.json'), JSON.stringify(bundleCode));

function writeIfChanged(file, text) {
  if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
}

const before = [...cssFiles, ...jsFiles].reduce((sum, file) => sum + statSync(file).size, 0);
const after = registry.code.reduce((sum, code) => sum + code.length, 0);
console.log(`asset registry ${registry.version}: ${cssFiles.length + 1} css, ${jsFiles.length} js, ${inlineStyles.size} inline; ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
