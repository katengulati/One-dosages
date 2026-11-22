const presentation = '<link rel="stylesheet" href="/one-aminos/design.css">' +
  '<script src="/one-aminos/hero.js" defer></script>';

const vial = `<div class="oa-vial" aria-hidden="true">
  <img src="/one-aminos/hero-vial.png" alt="" width="1200" height="1200" fetchpriority="high">
  <canvas class="oa-vial-particles"></canvas>
</div>`;

export function applyOneAminosDesign(html: string) {
  const spanish = /<html\b[^>]*\blang="es(?:-[^"]+)?"/i.test(html);
  const researchUse = spanish ? 'Solo para investigación y educación' : 'For research and education';
  const strip = `<div class="oa-research-band">${researchUse}</div>`;

  return html
    .replace('</head>', () => presentation + '</head>')
    .replace(/<body\b([^>]*)>/i, (tag, attributes: string) => {
      if (/\bclass="/.test(attributes)) return tag.replace('class="', 'class="oa-library ');
      return `<body class="oa-library"${attributes}>`;
    })
    .replace(/<header\b[^>]*\bid="siteHeader"/i, (header) => strip + header)
    .replace(/<div class="hero-text">(?=\s*<h1>)/i, (opening) => vial + opening);
}
