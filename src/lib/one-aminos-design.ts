import { load } from 'cheerio/slim';
import { applyHomePresentation, applyLearningFeatures } from './learning-features';
import { applyCatalog } from './catalog';
import { applySharePreview } from './share-preview';
import { applyGuidePresentation } from './guide-presentation';

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

export function applyOneAminosDesign(html: string, pathname: string, origin: string) {
  const spanish = /<html\b[^>]*\blang="es(?:-[^"]+)?"/i.test(html);
  const researchUse = spanish ? 'Solo para investigación y educación' : 'For research and education';
  const homeLabel = spanish ? 'Inicio de One Aminos' : 'One Aminos home';
  const strip = `<div class="oa-research-band">${researchUse}</div>`;

  const themed = applyLearningFeatures(html, spanish)
    .replace('</head>', () => presentation + '</head>')
    .replace(/<nav\b[^>]*\bclass="(?:site-breadcrumbs|breadcrumb)"[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<body\b([^>]*)>/i, (tag, attributes: string) => {
      if (/\bclass="/.test(attributes)) return tag.replace('class="', 'class="oa-library ');
      return `<body class="oa-library"${attributes}>`;
    })
    .replace(/<header\b[^>]*\bid="siteHeader"/i, (header) => strip + header)
    .replace(/(<a\b[^>]*\bclass="header-logo"[^>]*>)[\s\S]*?<\/a>/i, (_, opening: string) =>
      opening.replace(/aria-label="[^"]*"/i, `aria-label="${homeLabel}"`) + '</a>')
    .replace(/(<a\b[^>]*\bclass="footer-logo"[^>]*>)[\s\S]*?<\/a>/gi, (_, opening: string) =>
      opening.replace(/aria-label="[^"]*"/i, `aria-label="${homeLabel}"`) +
      '<img src="/one-aminos/wordmark.png" width="108" height="49" loading="lazy" alt=""></a>')
    .replace(/<section class="hero-section">[\s\S]*?<\/section>/i, (hero) => {
      const heading = hero.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1];
      const browseHref = hero.match(/<a\b(?=[^>]*\bclass="primary-cta")[^>]*\bhref="([^"]+)"/i)?.[1];
      if (!heading || !browseHref) return hero;
      return renderHomeIntro(spanish ? 'Dosificación de péptidos basada en investigación' : heading, browseHref, spanish);
    })
    .replace(/<link\b[^>]*href="[^"]*\/home-reconstitution-v4-[^"]+"[^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*id="pdhome-interactions-js"[^>]*>\s*<\/script>\s*/i, '');
  const $ = load(themed);
  $('script:not([src])').filter((_, element) => $(element).text().trim().startsWith('window.pdAuth=')).remove();
  $(':is(.pa-actual-controls, .pa-action-dock, .pa-actual-footer, .pa-return-card, .pa-dialog-host, .pa-share-dialog, .pa-share-trigger, .pa-google-button), [data-pd-google-source], #pd-page-actions-contexts, #pd-page-actions-js, a[href*="google.com/preferences/source"]').remove();
  $('.pa-meta-empty').remove();
  $('.pa-head-details').filter((_, element) => !$(element).children().length).remove();
  $('main p').filter((_, element) => {
    const copy = $(element).text().trim();
    return /^(?:Important:\s*All information on PeptideDosages\.com|Educational scope:\s*This page explains research calculations and general handling concepts)/i.test(copy);
  }).remove();
  $('.site-footer :is(.footer-disclaimer, .footer-about p)').remove();
  const newsletterColumn = $('.site-footer .footer-newsletter-col');
  $('.site-footer .footer-about').append(newsletterColumn.children());
  newsletterColumn.remove();
  $('.site-footer .footer-copyright').each((_, element) => {
    const copyright = $(element);
    copyright.html(copyright.html()?.replace('Peptide Dosages', 'One Aminos') ?? '');
  });
  applyGuidePresentation($, pathname);
  applyCatalog($, pathname);
  applyHomePresentation($, pathname);
  const branded = $.html()
    .replace(/[a-z0-9._%+-]+@(?:www\.)?peptidedosages\.com\b/gi, 'support@oneaminos.com')
    .replace(/https?:\\?\/\\?\/(?:www\.)?peptidedosages\.com\b/gi, origin)
    .replace(/https?%3a%2f%2f(?:www\.)?peptidedosages\.com\b/gi, encodeURIComponent(origin))
    .replace(/\b(?:www\.)?peptidedosages\.com\b/gi, 'One Aminos Peptide Dosages');
  return applySharePreview(branded, pathname, origin);
}
