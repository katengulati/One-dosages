import type { CheerioAPI } from 'cheerio/slim';
import policy from '../../site/catalog-policy.json';
import locales from '../../site/manifest.json';
import photoFiles from '../../site/product-photos.json';
import blogCards from '../../site/blog-cards.json';
import blogArtworkMarks from '../../site/blog-artwork-marks.json';
import { improveProtocolReading } from './protocol-reading';
import { isLipoReference } from './lipo-references';

const oldOrigin = 'https://peptidedosages.com';
const productOrigin = 'https://oneaminos.com';
const localOrigins = new Set(['peptidedosages.com', 'www.peptidedosages.com']);
const archived = new Set(policy.archived);
const products = new Map(Object.entries(policy.products));
const photos = new Map(Object.entries(photoFiles));
const artworkMarks = new Map(Object.entries(blogArtworkMarks));
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
const archivedCard = 'tr[data-protocol-id], article.catalog-card, article.post-card, .blog-post-card, .featured-hero, .mega-post-card, li, .pdh-related-card';
const directoryPages = new Set(['dosages', 'single-peptide-dosages', 'peptide-blend-dosages']);
const retiredLinks = /^(?:sign in|log in|sign up|register|my account|account|request (?:a )?protocol|keep this chart close)$/i;

function applyCatalogDirectory($: CheerioAPI, key: string, spanish: boolean, pathname: string) {
  $('#main-content').addClass('oa-catalog-directory');
  $('.catalog-description, .catalog-intro, .catalog-title i[aria-hidden="true"]').remove();
  // The captured directory script writes to the hidden statistics.
  $('.catalog-stats').attr('hidden', '');
  $('.toggle-buttons br.mobile-break').replaceWith(' ');
  if (key === 'peptide-blend-dosages') return;

  const to = pathname.startsWith('/en/') || spanish ? locales['lipo-c'][spanish ? 'es' : 'en'] : '/lipo-c/';
  const grid = $('.catalog-grid').first();
  const card = $('<article class="catalog-card" data-letter="L"></article>');
  const photoPair = $('<div class="catalog-card-image oa-lipo-photo-pair"></div>');
  for (const [reference, name] of [['lipo-c-b12', 'Lipo C + B12'], ['lipo-c-fat-blaster', 'Lipo C Fat Blaster']]) {
    photoPair.append($('<img loading="lazy" decoding="async">')
      .attr({ src: `/one-aminos/product-photos/${photos.get(reference)}`, alt: name }));
  }
  const link = $('<a class="catalog-btn"></a>').attr('href', to).text(spanish ? 'Ver referencias' : 'View References');
  card.append(photoPair, $('<div class="catalog-card-content"><h2>Lipo C</h2></div>').append(link));
  const letter = grid.children('#letter-L');
  const next = grid.children('.catalog-card[data-letter]').filter((_, el) => ($(el).attr('data-letter') ?? '') > 'L').first();
  if (letter.length) letter.after(card);
  else if (next.length) next.before(card);
  else grid.append(card);
}

function populateBlogMenu($: CheerioAPI, spanish: boolean, pathname: string) {
  const grid = $('#desktop-blog-submenu .mega-menu-grid').empty();
  const mobile = $('#mobile-blog-submenu');
  const viewAll = mobile.find('.mobile-view-all').closest('li').remove();
  mobile.empty();
  for (const post of blogCards.filter(post => !isArchivedCatalogPage(post.path)).slice(0, 3)) {
    const key = pageKey(post.path) as keyof typeof locales;
    const href = (spanish || pathname.startsWith('/en/')) ? locales[key]?.[spanish ? 'es' : 'en'] ?? post.path : post.path;
    const link = $('<a class="mega-post-card"></a>').attr('href', href);
    link.append($('<span class="mega-post-thumb"></span>').append('<img alt="" width="100" height="100" loading="lazy" src="/one-aminos/article-covers/new-to-peptides.webp">'),
      $('<span class="mega-post-title"></span>').text(spanish && post.path === '/how-to-read-a-coa/' ? 'Cómo leer un certificado de análisis (COA)' : post.title));
    grid.append($('<li></li>').append(link));
    mobile.append($('<li></li>').append($('<a></a>').attr('href', href).text(spanish && post.path === '/how-to-read-a-coa/' ? 'Cómo leer un certificado de análisis (COA)' : post.title)));
  }
  mobile.append(viewAll);
}

function applyBlogDirectory($: CheerioAPI, spanish: boolean, pathname: string) {
  const list = $('.blog-post-list').first();
  if (!list.length) return;
  $('.blog-main > :is(.featured-hero, .blog-pagination)').remove();
  list.empty();
  for (const post of blogCards) {
    if (isArchivedCatalogPage(post.path)) continue;
    const key = pageKey(post.path) as keyof typeof locales | undefined;
    const localized = pathname !== '/blog/' && key ? locales[key]?.[spanish ? 'es' : 'en'] : undefined;
    const cover = $('<img alt="" loading="lazy" decoding="async" width="960" height="600">')
      .attr('src', '/one-aminos/article-covers/new-to-peptides.webp');
    list.append($('<a class="blog-post-card"></a>').attr('href', localized ?? post.path).append(
      $('<div class="card-thumb"></div>').append(cover),
      $('<div class="card-body"></div>').append(
        $('<h2 class="card-title"></h2>').text(spanish && post.path === '/how-to-read-a-coa/' ? 'Cómo leer un certificado de análisis (COA)' : post.title),
        $('<p class="card-excerpt"></p>').text(spanish && post.path === '/how-to-read-a-coa/' ? 'Comprueba el lote y aprende a interpretar la identidad, la pureza y el contenido neto.' : post.excerpt),
        $('<span class="card-cta"></span>').text(spanish ? 'Leer artículo' : 'Read Article')
      )
    ));
  }
}

function brandBlogIllustrations($: CheerioAPI) {
  $('.post-content img[src]').each((_, element) => {
    const image = $(element);
    const source = image.attr('src') ?? '';
    const marks = artworkMarks.get(source);
    const graphic = image.closest('picture').length ? image.closest('picture') : image;
    graphic.wrap('<span class="oa-article-visual"></span>');
    const frame = graphic.parent();
    for (const [x, y, width, height] of marks ?? []) {
      const left = Math.max(0, x - 0.018);
      const top = Math.max(0, y - 0.009);
      const right = Math.min(1, x + width + 0.016);
      const bottom = Math.min(1, y + height + 0.009);
      const style = `left:${left * 100}%;top:${top * 100}%;width:${(right - left) * 100}%;height:${(bottom - top) * 100}%`;
      frame.append($('<span class="oa-article-mark" aria-hidden="true"></span>').attr('style', style));
    }
    if (!marks?.length) frame.append('<span class="oa-article-mark oa-article-mark-footer" aria-hidden="true"></span>');
  });
}

function applyStorePhotos($: CheerioAPI, key: string | undefined, handle: string | null | undefined, cta: string) {
  $('main .catalog-card').each((_, element) => {
    const card = $(element);
    if (card.find('.oa-lipo-photo-pair').length) return;
    const reference = pageKey(card.find('a.catalog-btn[href]').attr('href') ?? '');
    const photo = reference && photos.get(reference);
    const frame = card.find('.catalog-card-image');
    if (!photo) {
      frame.addClass('oa-catalog-image-empty').empty().attr('aria-hidden', 'true');
      return;
    }
    const name = card.find('h2').text().trim();
    frame.empty().append($('<img class="oa-store-photo" loading="lazy" decoding="async" width="720" height="720">')
      .attr({ src: `/one-aminos/product-photos/${photo}`, alt: name }));
  });

  function replaceImage(image: ReturnType<CheerioAPI>, file: string) {
    image.attr('src', `/one-aminos/product-photos/${file}`)
      .removeAttr('srcset sizes data-src data-srcset style').addClass('oa-store-photo');
  }
  $('.featured-hero, .blog-post-card, article.post-card, .mega-post-card').each((_, element) => {
    const card = $(element);
    const link = card.is('a') ? card : card.find('a[href]').first();
    const reference = pageKey(link.attr('href') ?? '');
    const photo = reference && photos.get(reference);
    const image = card.find('img').first();
    if (!image.length) return;
    if (reference === 'how-to-read-a-coa') {
      image.replaceWith('<span aria-hidden="true" class="oa-coa-cover"><img alt="" src="/one-aminos/wordmark.png"><b>COA</b></span>');
      return;
    }
    if (photo) replaceImage(image, photo);
    else image.attr('src', '/one-aminos/article-covers/new-to-peptides.webp')
      .removeAttr('srcset sizes data-src data-srcset');
    image.attr('alt', '');
  });
  const blogCover = $('main .single-post-layout .featured-image img').first();
  if (blogCover.length && (!key || !photos.has(key))) {
    blogCover.attr('src', '/one-aminos/article-covers/new-to-peptides.webp')
      .removeAttr('srcset sizes data-src data-srcset').attr('alt', '');
  }

  if (!key || !products.has(key)) return;
  const photo = photos.get(key);
  const vial = $('main :is(.quick-photo, .intro-image img, .single-post-layout .featured-image img)').first();
  const original = vial.attr('src')?.split('&')[0];
  if (vial.length && photo && handle) {
    replaceImage(vial, photo);
    if (vial.closest('.featured-image').length) {
      vial.attr('alt', `One Aminos vial for ${$('.oa-catalog-hero h1').text().split(':')[0]}`);
    }
    const link = vial.closest('a');
    if (link.length) link.attr({ href: productUrl(handle), 'aria-label': cta, target: '_blank', rel: 'noopener' });
    else if (!vial.closest('.single-post-layout').length) {
      vial.wrap($('<a class="oa-store-photo-link"></a>')
        .attr({ href: productUrl(handle), 'aria-label': cta, target: '_blank', rel: 'noopener' }));
    }
  } else if (vial.length && !photo && key.includes('__')) {
    vial.closest('.quick-vial, .intro-image').remove();
    vial.remove();
  }

  $('main :is(.products .product, .product-card) img').each((_, element) => {
    const image = $(element);
    const card = image.parent();
    const water = /bacteriostatic water/i.test(image.attr('alt') ?? '');
    const sameVial = original && image.attr('src')?.split('&')[0] === original;
    if (!water && !sameVial) return;
    const file = water ? photos.get('bacteriostatic-water') : photo;
    const destination = water ? 'bacteriostatic-water' : handle;
    if (!file || !destination) {
      image.remove();
      return;
    }
    replaceImage(image, file);
    const href = productUrl(destination);
    const link = card.find('a[href]').first();
    if (link.length) link.attr({ href, 'aria-label': cta, target: '_blank', rel: 'noopener' });
    else card.append($('<a class="oa-solid-link"></a>').attr({ href, target: '_blank', rel: 'noopener' }).text(cta));
    if (!image.closest('a').length) image.wrap($('<a></a>').attr({ href, 'aria-label': cta, target: '_blank', rel: 'noopener' }));
  });

  if (isLipoReference(key) && photo && handle) {
    $('.oa-lipo-reference > header').after($('<a class="oa-lipo-product-photo"></a>')
      .attr({ href: productUrl(handle), 'aria-label': cta, target: '_blank', rel: 'noopener' })
      .append($('<img class="oa-store-photo" decoding="async">')
        .attr({ src: `/one-aminos/product-photos/${photo}`, alt: $('.oa-lipo-reference h1').text() })));
  }
}

function simplifyCatalogHero($: CheerioAPI) {
  const hero = $('#main-content :is(#pdms-pilot > .hero-band, .page-hero, .post-hero, .oa-lipo-reference > header)').first();
  if (!hero.length) return;
  hero.addClass('oa-catalog-hero');
  hero.find(':is(.eyebrow, .article-meta, .pa-public-meta, .lede, .page-intro, .post-excerpt, .molecular-title-art, .jump-new, .jump-links svg[aria-hidden="true"])').remove();
  hero.find('.pa-head-details').filter((_, element) => !$(element).children().length).remove();
  if (hero.parent().is('.oa-lipo-reference')) hero.after(hero.children('p'));
}

export function applyCatalog($: CheerioAPI, pathname: string) {
  const spanish = $('html').attr('lang')?.startsWith('es') === true;
  const key = pageKey(pathname);
  const handle = key && products.get(key);
  const cta = spanish ? 'Ver producto en One Aminos' : 'View product at One Aminos';
  $('.pdma-favorite-bar, .request-protocol-btn, .header-auth, .pdmh-mobile-account, .pdmh-account, .toggle-btn[data-target="stacks"], .toggle-section#stacks, [data-f="peptide-stack-dosages"], [data-type="peptide-stack-dosages"]').remove();
  $('#pdh-stat-stacks').closest('.pdh-stat').remove();
  $('.blog-hero :is(.blog-subtitle, .hero-accent-line, .blog-title i[aria-hidden="true"])').remove();
  if (key && (products.has(key) || isLipoReference(key))) simplifyCatalogHero($);
  if (handle === 'wolverine') {
    $('title, .oa-catalog-hero h1').each((_, element) => {
      const heading = $(element);
      heading.text(heading.text().replace(/BPC-157 (?:\+|and) TB-500(?: \((20 mg Blend)\))?/, (_, strength?: string) =>
        `BPC-157 + TB-500 (Wolverine)${strength ? ` · ${strength}` : ''}`));
    });
  }

  $('a[href]').each((_, element) => {
    const a = $(element);
    const href = a.attr('href') ?? '';
    if (isArchivedCatalogPage(href)) {
      const card = a.closest(archivedCard);
      if (card.length) card.remove();
      else if (a.closest('.dose-links, .strengths, .pdpb-variant-pills, nav, .oa-guide-grid').length ||
        pageKey(href) === 'peptide-stack-dosages' || retiredLinks.test(a.text().trim())) a.remove();
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
  $('#featured-protocols .home-card').each((_, card) => {
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

  if (key && products.has(key)) improveProtocolReading($, key, handle, spanish);
  if (key && directoryPages.has(key)) applyCatalogDirectory($, key, spanish, pathname);
  if (key === 'blog') applyBlogDirectory($, spanish, pathname);
  populateBlogMenu($, spanish, pathname);
  applyStorePhotos($, key, handle, cta);
  $('img[src*="bpc-tb-evidence"]').closest('figure').remove();
  brandBlogIllustrations($);
  for (const [id, value] of [
    ['pdh-stat-total', retainedProtocols.length], ['pdh-stat-single', singleCount], ['pdh-stat-blends', blendCount],
    ['pdh-stat-stacks', 0], ['total-protocols', retainedProtocols.length], ['single-count', singleCount],
    ['blend-count', blendCount], ['stack-count', 0]
  ] as const) {
    $(`#${id}`).text(String(value));
  }
  $('.pdh-hero-desc, .pdh-intro').remove();
  $('.catalog-grid, .blog-post-list, .posts-grid').each((_, element) => {
    if (!$(element).find('a[href]').length) {
      $(element).append($('<p></p>').text(spanish
        ? 'No hay entradas activas en esta sección.'
        : 'There are no active entries in this section.'));
    }
  });
}
