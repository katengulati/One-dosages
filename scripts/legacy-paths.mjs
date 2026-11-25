// Maps the old WordPress URLs to the files' new homes. Shared by the asset build and
// the page pipeline (src/lib/asset-bundles.ts keeps an identical copy for TypeScript).
//   /wp-content/uploads/…/x.png  -> /media/…/x-png.webp   (PNG uploads were re-encoded)
//   /wp-content/uploads/…        -> /media/…
//   /wp-content/themes/my-blank-theme-a11y-stage/… -> /assets/theme/…
//   /wp-content/plugins/…        -> /assets/plugins/…
// Handles plain and JSON-escaped (\/) slashes.
export function rewriteLegacyPaths(text) {
  return text
    .replace(/(\\?\/)wp-content\1uploads\1([^"'\s)<>,?#]+?)\.png\b/g, (_, s, path) => `${s}media${s}${path}-png.webp`)
    .replace(/(\\?\/)wp-content\1uploads\1/g, (_, s) => `${s}media${s}`)
    .replace(/(\\?\/)wp-content\1themes\1my-blank-theme-a11y-stage\1/g, (_, s) => `${s}assets${s}theme${s}`)
    .replace(/(\\?\/)wp-content\1plugins\1/g, (_, s) => `${s}assets${s}plugins${s}`);
}
