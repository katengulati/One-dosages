import { load } from 'cheerio/slim';
import policy from '../../site/catalog-policy.json';
import locales from '../../site/manifest.json';

const oldOrigin = 'https://peptidedosages.com';
const productOrigin = 'https://oneaminos.com';
const localOrigins = new Set(['peptidedosages.com', 'www.peptidedosages.com']);
const archived = new Set(policy.archived);
const products = new Map(Object.entries(policy.products));
const keys = new Map(Object.entries(locales).flatMap(([key, paths]) => [
  [paths.en, key], [paths.es, key]
] as const));
const retainedProtocols = Object.keys(policy.products).filter((key) => key.includes('__'));
const singleCount = retainedProtocols.filter((key) => key.startsWith('single-peptide-dosages__')).length;
const blendCount = retainedProtocols.length - singleCount;

function pageKey(href: string) {
  if (!href || href.startsWith('#')) return undefined;
  try {
    const url = new URL(href, oldOrigin);
    if (!localOrigins.has(url.hostname)) return undefined;
    const path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/?$/, '/').toLowerCase();
    return keys.get(path) ?? path.split('/').filter(Boolean).join('__');
  } catch {
    return undefined;
  }
}

export function isArchivedCatalogPage(href: string) {
  const key = pageKey(href);
  return key !== undefined && archived.has(key);
}

function productUrl(handle: string) {
  return `${productOrigin}/products/${handle}`;
}

const linkedLegacyProducts = new Map(Object.entries({
  'bac-water-10ml': 'bacteriostatic-water',
  'buy-5-amino-1mq': '5-amino-1mq',
  'buy-adamax-10mg': 'adamax',
  'buy-aod-9604-5mg': 'aod',
  'buy-bpc-157-10mg': 'bpc157',
  'buy-cagrilintide-10mg': 'cagrilintide',
  'buy-cartalax-20mg': 'cartalax',
  'buy-cjc1295-no-dac-ipamorelin-10mg-blend': 'cjc-ipa',
  'buy-dsip-10mg': 'dsip',
  'buy-epithalon-10mg': 'epithalon',
  'buy-ghk-cu-100mg': 'ghkcu',
  'buy-ghk-cu-50mg': 'ghkcu',
  'buy-glow-70mg-blend': 'glow',
  'buy-igf-1-lr3-1mg': 'igf1lr3',
  'buy-ipamorelin-10mg': 'ipamorelin',
  'buy-kisspeptin-10mg': 'kisspeptin',
  'buy-klow-80mg': 'klow',
  'buy-kpv-10mg': 'kpv',
  'buy-melanotan-2-10mg': 'mt2',
  'buy-mots-c-10mg': 'motsc',
  'buy-mots-c-40mg': 'motsc',
  'buy-nad-1000mg': 'nad-plus',
  'buy-nad-plus-500mg': 'nad-plus',
  'buy-pt-141-10mg': 'pt141',
  'buy-selank-10mg': 'selank',
  'buy-semax-10mg': 'semax',
  'buy-snap-8-10mg': 'snap-8',
  'buy-ss-31-10mg': 'ss31',
  'ss-31-50mg': 'ss31',
  'buy-tb-500-10mg': 'tb500',
  'buy-tesamorelin-10mg': 'tesamorelin',
  'buy-tesamorelin-20mg': 'tesamorelin'
}));

const formerSupplier = /(?:purelabpeptides\.com|(?:^|[/.])amazon\.com(?:[/:]|$)|(?:^|\/)a\.co(?:[/:]|$))/i;
const archivedCard = 'tr[data-protocol-id], article.catalog-card, article.post-card, .blog-post-card, .mega-post-card, li, .pdh-related-card';

export function applyCatalog(html: string, pathname: string) {
  const $ = load(html);
  const spanish = $('html').attr('lang')?.startsWith('es') === true;
  const key = pageKey(pathname);
  const handle = key && products.get(key);
  const cta = spanish ? 'Ver producto en One Aminos' : 'View product at One Aminos';

  $('a[href]').each((_, element) => {
    const a = $(element);
    const href = a.attr('href') ?? '';
    if (isArchivedCatalogPage(href)) {
      const card = a.closest(archivedCard);
      if (card.length) card.remove();
      else if (a.closest('.dose-links, .strengths, .pdpb-variant-pills, nav, .oa-guide-grid').length) a.remove();
      else a.replaceWith(a.contents());
      return;
    }
    if (!formerSupplier.test(href)) return;
    // Keep a citation's original provenance. Commerce links are resolved independently.
    const citation = a.closest('#references, #bibliografia, .references, .pd-references').length > 0 ||
      /^(?:view source|ver fuente|source|fuente)$/i.test(a.text().trim());
    const oldSlug = href.split(/[?#]/)[0].split('/').filter(Boolean).at(-1) ?? '';
    const mapped = linkedLegacyProducts.get(oldSlug);
    const destination = a.is('.quick-vial-link') ? handle : mapped;
    if (!citation && destination) {
      a.attr('href', productUrl(destination)).attr('aria-label', cta);
      if (a.text().trim()) a.text(cta);
    } else if (a.is('.supplier') || /^(?:view source|ver fuente)$/i.test(a.text().trim())) a.remove();
    else a.replaceWith(a.contents());
  });

  $('[data-nav-url]').each((_, element) => {
    if (isArchivedCatalogPage($(element).attr('data-nav-url') ?? '')) $(element).remove();
  });
  $('.peptide-family-item.has-variants').each((_, element) => {
    const family = $(element);
    const count = family.find('.peptide-variant-list a[href]').length;
    if (!count) family.remove();
    else family.find('.peptide-family-count').text(spanish
      ? `${count} tamaños`
      : `${count} ${count === 1 ? 'strength' : 'strengths'}`);
  });
  $('.home-card').each((_, card) => {
    if (!$(card).find('.dose-links a[href]').length) $(card).remove();
  });
  // The original citations occasionally contain a commercial URL as a separate image.
  $('img, source, a, link, iframe, meta').each((_, element) => {
    for (const name of ['src', 'srcset', 'data-src', 'href', 'content']) {
      if (formerSupplier.test($(element).attr(name) ?? '')) $(element).removeAttr(name);
    }
  });
  if (handle && !$('main a.oa-product-link').length) {
    const target = $('#intro-card .quick-body, #intro-card .section-body, .pdpb-variant-shell, main article header').first();
    const productLink = $('<a class="oa-solid-link oa-product-link"></a>')
      .attr({ href: productUrl(handle), target: '_blank', rel: 'noopener' }).text(cta);
    if (target.length) target.append(productLink);
    else $('main h1, #main-content h1').first().after(productLink);
  }

  $('.catalog-intro').text(spanish
    ? 'Consulta los protocolos del catálogo de One Aminos y las excepciones de investigación.'
    : 'Browse protocols for the One Aminos catalog and selected research references.');
  $('.catalog-description').text(spanish
    ? 'Encuentra tablas y guías por compuesto y tamaño de vial.'
    : 'Find charts and guides by compound and vial size.');
  const cards = $('main .catalog-card').length;
  $('.catalog-hero .stat-number').each((_, element) => {
    if (!$(element).attr('id')) $(element).text(String(cards));
  });
  for (const [id, value] of [
    ['pdh-stat-total', retainedProtocols.length], ['pdh-stat-single', singleCount], ['pdh-stat-blends', blendCount],
    ['pdh-stat-stacks', 0], ['total-protocols', retainedProtocols.length], ['single-count', singleCount],
    ['blend-count', blendCount], ['stack-count', 0]
  ] as const) {
    $(`#${id}`).text(String(value));
  }
  $('.pdh-hero-desc, .pdh-intro').text(spanish
    ? 'Busca por péptido o tamaño de vial y abre el protocolo para ver la referencia completa.'
    : 'Search by peptide or vial size, then open a protocol for the full reference.');
  $('.catalog-grid, .blog-post-list, .posts-grid').each((_, element) => {
    if (!$(element).find('a[href]').length) {
      $(element).append($('<p></p>').text(spanish
        ? 'No hay entradas activas en esta sección.'
        : 'There are no active entries in this section.'));
    }
  });
  if (key === 'dosages' || key === 'single-peptide-dosages') {
    const prefix = spanish ? '/es/' : pathname.startsWith('/en/') ? '/en/' : '/';
    $('.catalog-intro').first().append(' ', $('<a></a>').attr('href', `${prefix}lipo-c/`).text(
      spanish ? 'Ver referencias de Lipo C' : 'View Lipo C references'
    ));
  }
  return $.html();
}
