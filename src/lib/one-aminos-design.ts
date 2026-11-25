import { load } from 'cheerio/slim';
import locales from '../../site/manifest.json';
import { applyHomePresentation, applyLearningFeatures } from './learning-features';
import { applyCatalog } from './catalog';
import { applySharePreview } from './share-preview';
import { applyArticlePresentation } from './article-presentation';
import { applyCalculatorPresentation } from './calculator-presentation';
import { applyGuideArticleLayout, applyGuidePresentation } from './guide-presentation';
import { bundleAssets } from './asset-bundles';

const assetVersion = process.env.OA_ASSET_VERSION ?? 'dev';
const presentation = `<link rel="stylesheet" href="/one-aminos/design.css?v=${assetVersion}">`;

/** Desktop search starts as an icon; the first click opens the field instead of submitting. */
const searchToggleScript = `<script>(function(){
  var wrap = document.querySelector('#siteHeader .pdmh-search-wrap');
  if (!wrap) return;
  var input = wrap.querySelector('input[type=search]');
  var button = wrap.querySelector('form button[type=submit]');
  if (!input || !button) return;
  function open() { wrap.classList.add('oa-search-open'); input.focus(); }
  function close() { if (!input.value.trim()) wrap.classList.remove('oa-search-open'); }
  button.addEventListener('click', function (event) {
    if (!wrap.classList.contains('oa-search-open') || !input.value.trim()) { event.preventDefault(); open(); }
  });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { input.value = ''; close(); button.focus(); }
  });
  document.addEventListener('pointerdown', function (event) { if (!wrap.contains(event.target)) close(); });
})();</script>`;

const localePaths = new Map(Object.values(locales as Record<string, { en: string; es: string }>)
  .flatMap((paths) => [[paths.en, paths], [paths.es, paths]] as const));

/** Storefront-style "EN / ES" switch. Unprefixed English pages stay unprefixed. */
function renderLanguageSwitch(pathname: string, spanish: boolean) {
  const path = pathname.replace(/\/?$/, '/');
  const unprefixed = !/^\/(?:en|es)\//.test(path);
  const paths = localePaths.get(unprefixed ? `/en${path}` : path);
  const english = unprefixed ? path : paths?.en ?? '/en/';
  const spanishHref = paths?.es ?? '/es/';
  const option = (href: string, code: 'en' | 'es', name: string, current: boolean) =>
    `<a class="oa-lang__opt" href="${href}" hreflang="${code}" lang="${code}" title="${name}"` +
    ` onclick="document.cookie='NEXT_LOCALE=${code};path=/;max-age=31536000;samesite=lax'"` +
    `${current ? ' aria-current="true"' : ''}>${code.toUpperCase()}</a>`;
  return `<nav class="oa-lang" aria-label="${spanish ? 'Idioma' : 'Language'}">` +
    option(english, 'en', 'English', !spanish) +
    '<span class="oa-lang__sep" aria-hidden="true">/</span>' +
    option(spanishHref, 'es', 'Español', spanish) + '</nav>';
}

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
  const readLabel = spanish ? 'Leer la guía' : 'Read guide';
  const cards = articles.map((article, index) => {
    const { path, title } = article[spanish ? 'es' : 'en'];
    // The first row is above the fold on desktop and phones, so it should not wait for lazy loading.
    const loading = index < 3 ? 'eager' : 'lazy';
    return `<li>
      <a class="oa-guide-card" href="${prefix}${path}/">
        <img src="/one-aminos/article-covers/${article.image}.webp" width="960" height="600" alt="" loading="${loading}" decoding="async">
        <h3>${title.replaceAll('&', '&amp;')}</h3>
        <span class="oa-guide-card__action" aria-hidden="true">${readLabel}</span>
      </a>
    </li>`;
  }).join('\n');

  return `<section class="oa-home-hero" aria-labelledby="oa-home-title">
    <h1 id="oa-home-title">${heading}</h1>
    <a class="oa-browse-button" href="${browseHref}"><span>${spanish ? 'Explorar protocolos' : 'Browse Protocols'}</span><span class="oa-browse-button__arrow" aria-hidden="true">→</span></a>
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
  // One header-level language switch on every page, replacing the older pill switchers.
  $('#siteHeader .pd-lang, .pd-lang-mobile').remove();
  // Right-hand header group (search icon + EN / ES) so the nav can sit in the true center.
  const headerInner = $('#siteHeader .header-inner').first();
  const actions = $('<div class="oa-header-actions"></div>');
  actions.append(headerInner.children('.pdmh-search-wrap'), renderLanguageSwitch(pathname, spanish));
  headerInner.append(actions);
  if (actions.find('.pdmh-search-wrap').length) $('body').append(searchToggleScript);
  // The slide-out menu keeps its own brand row: use the One Aminos wordmark and repeat the switch there.
  $('.mobile-nav-brand').attr('aria-label', homeLabel)
    .html('<img class="oa-menu-wordmark" src="/one-aminos/wordmark.png" width="108" height="49" alt="">');
  $('.mobile-nav-header .mobile-close-btn').first().before(renderLanguageSwitch(pathname, spanish));
    $('script:not([src])').filter((_, element) => $(element).text().trim().startsWith('window.pdAuth=')).remove();
  $(':is(.pa-actual-controls, .pa-action-dock, .pa-actual-footer, .pa-return-card, .pa-dialog-host, .pa-share-dialog, .pa-share-trigger, .pa-google-button), [data-pd-google-source], #pd-page-actions-contexts, #pd-page-actions-js, a[href*="google.com/preferences/source"]').remove();
  $('.pa-meta-empty').remove();
  $('.pa-head-details').filter((_, element) => !$(element).children().length).remove();
  $('main p').filter((_, element) => {
    const copy = $(element).text().trim();
    return /^(?:Important:\s*All information on PeptideDosages\.com|Educational scope:\s*This page explains research calculations and general handling concepts)/i.test(copy);
  }).remove();
  $('.mobile-app-nav, .site-footer :is(.footer-disclaimer, .footer-about p)').remove();
  const newsletterColumn = $('.site-footer .footer-newsletter-col');
  $('.site-footer .footer-about').append(newsletterColumn.children());
  newsletterColumn.remove();
  $('.site-footer .footer-copyright').each((_, element) => {
    const copyright = $(element);
    copyright.html(copyright.html()?.replace('Peptide Dosages', 'One Aminos') ?? '');
  });
  $('.pdmh-trigger-new-badge, .pdmh-new-badge, .pdh-disc, .pdc-disc, .section-head > .section-number, .section-head > .section-icon').remove();
  // Spanish search forms go to the shared results page with lang=es (the /es/ routes are static).
  if (spanish) {
    $('form[role="search"]').filter((_, form) => /^\/(?:es\/)?$/.test($(form).attr('action') ?? '')).each((_, element) => {
      const form = $(element).attr('action', '/');
      if (!form.find('input[name="lang"]').length) form.prepend('<input type="hidden" name="lang" value="es">');
    });
  }
  applyCalculatorPresentation($, spanish);
  applyGuidePresentation($, pathname);
  applyCatalog($, pathname);
  applyHomePresentation($, pathname);
  applyGuideArticleLayout($, pathname);
  applyArticlePresentation($);
  $('main .jump-links').each((_, element) => {
    const jumps = $(element);
    const sidebar = jumps.closest('main').find('nav.toc, nav.toc-container').first();
    if (!sidebar.length) return;
    const targets = new Set(sidebar.find('a').map((_, a) => $(a).attr('href')).get());
    jumps.find('a').filter((_, a) => targets.has($(a).attr('href') || '')).remove();
    if (!jumps.find('a').length) {
      const parent = jumps.parent();
      jumps.remove();
      if (parent.hasClass('pa-head-details') && !parent.children().length) parent.remove();
    }
  });
  if ($('iframe.oa-reconstitution-demo, nav.toc, nav.toc-container').length) {
    $('body').append(`<script defer src="/one-aminos/reading-layout.js?v=${assetVersion}"></script>`);
  }
  // Owner direction (Nov 25): links that stand alone in a paragraph or block are
  // actions, so they use the silver storefront button instead of an underline.
  $('main a[href]').each((_, element) => {
    const link = $(element);
    if (link.attr('class')) return;
    if (link.closest('nav, .toc, .toc-container, .oa-guide-sidebar, table, sup, figure, header, li, .dose-links, .pdh-cta').length) return;
    if (link.find('h1, h2, h3, h4, h5, h6, p, div, img, strong').length) return;
    const parent = link.parent();
    if (!parent.is('p, div')) return;
    const other = parent.contents().filter((_, node) =>
      node.type === 'text' ? (node.data ?? '').trim() !== '' : !(node.type === 'tag' && node.name === 'a'));
    if (other.length) return;
    parent.addClass('oa-link-row');
    link.addClass('oa-link-button');
  });
  const branded = $.html()
    .replace(/[a-z0-9._%+-]+@(?:www\.)?peptidedosages\.com\b/gi, 'support@oneaminos.com')
    .replace(/https?:\\?\/\\?\/(?:www\.)?peptidedosages\.com\b/gi, origin)
    .replace(/https?%3a%2f%2f(?:www\.)?peptidedosages\.com\b/gi, encodeURIComponent(origin))
    .replace(/\b(?:www\.)?peptidedosages\.com\b/gi, 'One Aminos Peptide Dosages');
  const localized = spanish ? branded.replaceAll('<small>Certificate of Analysis</small>', '<small>Certificado de análisis</small>') : branded;
  const shared = applySharePreview(localized, pathname, origin);
  // Former WordPress assets: new paths, then one bundle per run of files.
  return bundleAssets(shared);
}
