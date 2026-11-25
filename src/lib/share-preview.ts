const title = 'One Aminos Peptide Dosages';
const descriptions = {
  en: 'Research guides, dosage charts, and a reconstitution calculator from One Aminos.',
  es: 'Guías de investigación, tablas de dosificación y una calculadora de reconstitución de One Aminos.'
};
const defaultOrigin = 'http://localhost:4322';

export function localizedPreviewOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : defaultOrigin);
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function applySharePreview(html: string, pathname: string, origin: string) {
  const home = /^\/(?:en\/|es\/)?$/.test(pathname);
  const description = pathname.startsWith('/es/') ? descriptions.es : descriptions.en;
  const existingTitle = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const innerTitle = existingTitle.replace(/\s*(?:\||[-–])\s*(?:peptidedosages\.com|(?:One Aminos )?Peptide Dosages)\s*$/i, '');
  const pageTitle = home || !innerTitle ? title : `${innerTitle} | ${title}`;
  const canonical = escapeAttribute(new URL(pathname, origin).href);
  const image = escapeAttribute(new URL('/one-aminos/share-card.jpg', origin).href);

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${pageTitle}</title>`)
    .replace(/<link\b[^>]*\brel="canonical"[^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\b(?:property|name)="(?:og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, '')
    .replace('</head>', () => `<link rel="canonical" href="${canonical}">
      <meta property="og:type" content="website">
      <meta property="og:title" content="${pageTitle.replaceAll('"', '&quot;')}">
      <meta property="og:site_name" content="${title}">
      <meta property="og:description" content="${description}">
      <meta property="og:url" content="${canonical}">
      <meta property="og:image" content="${image}">
      <meta property="og:image:type" content="image/jpeg">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      <meta property="og:image:alt" content="One Aminos Peptide Dosages">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${pageTitle.replaceAll('"', '&quot;')}">
      <meta name="twitter:description" content="${description}">
      <meta name="twitter:image" content="${image}">
    </head>`);
}
