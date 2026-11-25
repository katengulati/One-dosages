import { createHash } from 'node:crypto';
import index from '@/generated/asset-index.json';

// Replaces the captured WordPress stylesheets/scripts with bundles served by
// /bundle/[file] (built by scripts/build-assets.mjs). Order is preserved exactly: each
// uninterrupted run of known files becomes one bundle at the run's first position, and
// anything unknown (design.css, page-specific files) stays where it was.

type Index = { version: string; css: Record<string, number>; js: Record<string, number>; inline: Record<string, number> };
const assets = index as Index;

/** Same mapping as scripts/legacy-paths.mjs (old WordPress URLs to their new homes). */
export function rewriteLegacyPaths(text: string) {
  return text
    .replace(/(\\?\/)wp-content\1uploads\1([^"'\s)<>,?#]+?)\.png\b/g, (_, s: string, path: string) => `${s}media${s}${path}-png.webp`)
    .replace(/(\\?\/)wp-content\1uploads\1/g, (_, s: string) => `${s}media${s}`)
    .replace(/(\\?\/)wp-content\1themes\1my-blank-theme-a11y-stage\1/g, (_, s: string) => `${s}assets${s}theme${s}`)
    .replace(/(\\?\/)wp-content\1plugins\1/g, (_, s: string) => `${s}assets${s}plugins${s}`);
}

const fontAwesome = /font-awesome\/[\d.]+\/css\/all(?:\.min)?\.css/;
const googleFonts = /fonts\.googleapis\.com|\/vendor\/google-fonts\.css/;

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'))?.[2];
}

function stylesheetId(tag: string): number | null | undefined {
  const href = attribute(tag, 'href');
  if (!href) return undefined;
  const media = attribute(tag, 'media');
  if (media && media !== 'all') return undefined;
  if (googleFonts.test(href)) return null; // fonts the design no longer uses (and CSP blocks)
  if (fontAwesome.test(href)) return assets.css['/assets/icons/font-awesome.css'];
  const path = href.replace(/&amp;/g, '&').replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
  return assets.css[path];
}

function bundleLink(ids: number[], type: 'css' | 'js') {
  const file = `${ids.map((id) => id.toString(36)).join('.')}-${assets.version}.${type}`;
  return type === 'css' ? `<link rel="stylesheet" href="/bundle/${file}">` : `<script defer src="/bundle/${file}"></script>`;
}

/** Collapse runs of known assets. `classify` returns an id, null to drop, or undefined to keep in place. */
function collapse(html: string, pattern: RegExp, classify: (tag: string, inner: string) => number | null | undefined, type: 'css' | 'js') {
  const parts: string[] = [];
  let run: number[] = [];
  let last = 0;
  const flush = () => {
    if (run.length) parts.push(bundleLink(run, type));
    run = [];
  };
  for (const match of html.matchAll(pattern)) {
    const id = classify(match[0], match[2] ?? '');
    // Other markup between tags doesn't affect cascade or deferred order, so it stays
    // put and the run continues; the bundle lands where the run ends.
    const between = html.slice(last, match.index);
    if (between.trim()) parts.push(between);
    last = match.index! + match[0].length;
    if (id === null) continue;
    if (id === undefined) {
      flush();
      parts.push(match[0]);
      continue;
    }
    if (!run.includes(id)) run.push(id);
  }
  flush();
  parts.push(html.slice(last));
  return parts.join('');
}

export function bundleAssets(html: string) {
  const rewritten = rewriteLegacyPaths(html);
  const headEnd = rewritten.search(/<\/head>/i);
  if (headEnd < 0) return rewritten;
  const head = collapse(
    rewritten.slice(0, headEnd),
    /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>|<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
    (tag, css) => {
      if (tag.startsWith('<link')) return stylesheetId(tag);
      const key = createHash('sha1').update(css.trim()).digest('hex').slice(0, 12);
      return assets.inline[key];
    },
    'css'
  );
  // Deferred scripts run in document order after parsing, so only other deferred
  // scripts can break a run; inline and JSON scripts are left untouched.
  const body = collapse(
    rewritten.slice(headEnd),
    /<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi,
    (tag) => {
      if (!/\bdefer\b/i.test(tag) || /\b(async|type=["']module)/i.test(tag)) return undefined;
      const src = attribute(tag, 'src')!.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
      return assets.js[src];
    },
    'js'
  );
  return head + body;
}
