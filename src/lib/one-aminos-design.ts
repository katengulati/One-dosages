const presentation = '<link rel="stylesheet" href="/one-aminos/design.css">';

const articles = [
  {
    image: 'new-to-peptides',
    en: { path: 'beginners-guide-peptides', title: 'New to Peptides?' },
    es: { path: 'guia-principiantes-peptidos', title: '¿Nuevo en los péptidos?' }
  },
  {
    image: 'reconstitution',
    en: { path: 'reconstitution-guide-peptides', title: 'Reconstitution Guide' },
    es: { path: 'guia-reconstitucion-peptidos', title: 'Guía de reconstitución' }
  },
  {
    image: 'measurements',
    en: { path: 'syringe-measurement-guide', title: 'Syringe & Measurement Guide' },
    es: { path: 'guia-medicion-jeringa', title: 'Guía de jeringas y medición' }
  },
  {
    image: 'storage',
    en: { path: 'peptide-storage-guide', title: 'Peptide Storage Guide' },
    es: { path: 'guia-almacenamiento-peptidos', title: 'Guía de almacenamiento' }
  },
  {
    image: 'ghk-cu',
    en: { path: 'ghk-cu-peptide', title: 'What Is GHK-Cu?' },
    es: { path: 'peptido-ghk-cu', title: '¿Qué es GHK-Cu?' }
  },
  {
    image: 'retatrutide',
    en: { path: 'retatrutide-peptide', title: 'What Is Retatrutide?' },
    es: { path: 'peptido-retatrutide', title: '¿Qué es la retatrutida?' }
  }
] as const;

function renderHomeIntro(heading: string, browseHref: string, spanish: boolean) {
  const prefix = spanish ? '/es/' : browseHref.startsWith('/en/') ? '/en/' : '/';
  const cards = articles.map((article) => {
    const { path, title } = article[spanish ? 'es' : 'en'];
    return `<li>
      <a class="oa-guide-card" href="${prefix}${path}/">
        <img src="/one-aminos/article-covers/${article.image}.webp" width="960" height="600" alt="" loading="lazy" decoding="async">
        <h3>${title.replaceAll('&', '&amp;')}</h3>
      </a>
    </li>`;
  }).join('\n');

  return `<section class="oa-home-hero" aria-labelledby="oa-home-title">
    <h1 id="oa-home-title">${heading}</h1>
    <a class="oa-browse-button" href="${browseHref}">${spanish ? 'Explorar protocolos' : 'Browse Protocols'}</a>
  </section>
  <section class="oa-home-guides" aria-labelledby="oa-home-guides-title">
    <h2 id="oa-home-guides-title">${spanish ? 'Guías y artículos' : 'Guides and Articles'}</h2>
    <ul class="oa-guide-grid">${cards}</ul>
  </section>`;
}

export function applyOneAminosDesign(html: string) {
  const spanish = /<html\b[^>]*\blang="es(?:-[^"]+)?"/i.test(html);
  const researchUse = spanish ? 'Solo para investigación y educación' : 'For research and education';
  const homeLabel = spanish ? 'Inicio de One Aminos' : 'One Aminos home';
  const strip = `<div class="oa-research-band">${researchUse}</div>`;

  return html
    .replace('</head>', () => presentation + '</head>')
    .replace(/<body\b([^>]*)>/i, (tag, attributes: string) => {
      if (/\bclass="/.test(attributes)) return tag.replace('class="', 'class="oa-library ');
      return `<body class="oa-library"${attributes}>`;
    })
    .replace(/<header\b[^>]*\bid="siteHeader"/i, (header) => strip + header)
    .replace(/(<a\b[^>]*\bclass="header-logo"[^>]*>)[\s\S]*?<\/a>/i, (_, opening: string) =>
      opening.replace(/aria-label="[^"]*"/i, `aria-label="${homeLabel}"`) + '</a>')
    .replace(/<section class="hero-section">[\s\S]*?<\/section>/i, (hero) => {
      const heading = hero.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1];
      const browseHref = hero.match(/<a\b(?=[^>]*\bclass="primary-cta")[^>]*\bhref="([^"]+)"/i)?.[1];
      if (!heading || !browseHref) return hero;
      return renderHomeIntro(spanish ? 'Dosificación de péptidos basada en investigación' : heading, browseHref, spanish);
    })
    .replace(/<link\b[^>]*href="[^"]*\/home-reconstitution-v4-[^"]+"[^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*id="pdhome-interactions-js"[^>]*>\s*<\/script>\s*/i, '');
}
