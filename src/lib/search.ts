import { isRetiredLearningPage } from './learning-features';
import { isArchivedCatalogPage, searchCover } from './catalog';
import { lipoReferenceTitles } from './lipo-references';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findPage, renderPage } from './site';

type SearchPage = {
  path: string;
  title: string;
  body: string;
  summary: string;
  kind: string;
  /** English path of a Spanish entry (used for the retired/archived filters). */
  source?: string;
};

const pageSize = 10;
const searchData: { en?: Promise<{ template: string; pages: SearchPage[] }>; es?: Promise<{ template: string; pages: SearchPage[] }> } = {};

/** Spanish results render inside the Spanish home shell (Spanish header, footer and lang="es"). */
function spanishTemplate() {
  const shell = renderPage('es', findPage('es', '/es/') ?? 'index');
  return shell.replace(/(<main\b[^>]*>)[\s\S]*<\/main>/i, (_, open: string) => `${open}<!-- Search Hero -->%%RESULTS%%</main>`);
}

function loadSearch(spanish: boolean) {
  const locale = spanish ? 'es' : 'en';
  searchData[locale] ??= Promise.all([
    spanish ? Promise.resolve(spanishTemplate()) : readFile(join(process.cwd(), 'search-template.html'), 'utf8'),
    readFile(join(process.cwd(), spanish ? 'search-corpus.es.json' : 'search-corpus.json'), 'utf8')
  ]).then(([template, corpus]): { template: string; pages: SearchPage[] } => ({
    template,
    pages: ([
      spanish
        ? { path: '/es/categorias-de-peptidos/', source: '/peptide-categories/', title: 'Categorías de péptidos', kind: 'Guide',
          summary: 'Explora los compuestos por tema de investigación.', body: 'péptidos categorías pérdida de grasa recuperación concentración piel sueño envejecimiento hormonas señalización' }
        : { path: '/peptide-categories/', title: 'Peptide Categories', kind:'Guide',
          summary:'Browse compounds by research topic.', body:'peptides categories fat loss recovery focus skin sleep aging hormone signaling' },
      spanish
        ? { path: '/es/como-leer-un-coa/', source: '/how-to-read-a-coa/', title: 'Cómo leer un certificado de análisis (COA)', kind: 'Article',
          summary: 'Comprueba el lote y aprende a interpretar la identidad, la pureza y el contenido neto.', body: 'COA certificado de análisis lote pureza verificación contenido neto de péptido laboratorio' }
        : { path: '/how-to-read-a-coa/', title: 'How to Read a Certificate of Analysis (COA)', kind: 'Article',
          summary: 'Verify the batch and read identity, purity and net content in a real report.', body: 'COA batch lot purity verification net peptide content laboratory' },
      ...(JSON.parse(corpus) as SearchPage[]),
      ...Object.entries(lipoReferenceTitles).map(([slug, title]) => ({
        path: spanish ? `/es/${slug}/` : `/${slug}/`, source: `/${slug}/`, title, body: title, kind: 'Article',
        summary: spanish ? 'Referencia de Lipo C de One Aminos.' : 'One Aminos Lipo C reference.'
      }))
    ] as SearchPage[])
      .filter((page) => !isRetiredLearningPage(page.source ?? page.path) && !isArchivedCatalogPage(page.source ?? page.path))
      .map((page) => ({ ...page, body: page.body.toLowerCase() }))
  }));
  return searchData[locale]!;
}

function html(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]!);
}

type Group = 'protocols' | 'articles' | 'pages';

function group(item: SearchPage): Group {
  if (item.kind === 'Article') return 'articles';
  return /peptide|blend|stack/i.test(item.kind) ? 'protocols' : 'pages';
}

const groups = {
  protocols: { label: 'Dosage protocols', badge: 'Dosage protocol', action: 'View protocol' },
  articles: { label: 'Articles', badge: 'Article', action: 'Read article' },
  pages: { label: 'Guides & pages', badge: 'Guide', action: 'Open page' }
} as const;

const spanishGroups = {
  protocols: { label: 'Protocolos de dosificación', badge: 'Protocolo de dosificación', action: 'Ver protocolo' },
  articles: { label: 'Artículos', badge: 'Artículo', action: 'Leer artículo' },
  pages: { label: 'Guías y páginas', badge: 'Guía', action: 'Abrir página' }
} as const;

function card(item: SearchPage, spanish = false) {
  const meta = (spanish ? spanishGroups : groups)[group(item)];
  const url = html(item.path);
  const cover = searchCover(item.source ?? item.path);
  const media = cover.kind === 'coa'
    ? '<span aria-hidden="true" class="oa-coa-cover"><img alt="" src="/one-aminos/wordmark.png"><b>COA</b><small>' + (spanish ? 'Certificado de análisis' : 'Certificate of Analysis') + '</small></span>'
    : `<img alt="" src="${cover.src}" loading="lazy" decoding="async" width="720" height="720" class="${cover.kind === 'photo' ? 'is-photo' : 'is-cover'}">`;
  return `<li><a class="oa-result" href="${url}">
    <span class="oa-result__media">${media}</span>
    <span class="oa-result__body">
      <span class="oa-result__badge">${meta.badge}</span>
      <span class="oa-result__title">${html(item.title)}</span>
      <span class="oa-result__summary">${html(item.summary)}</span>
      <span class="oa-result__action">${meta.action}</span>
    </span>
  </a></li>`;
}

function searchUrl(query: string, type: string, pageNumber = 1, spanish = false) {
  const params = new URLSearchParams({ s: query });
  if (spanish) params.set('lang', 'es');
  if (type !== 'all') params.set('type', type);
  if (pageNumber > 1) params.set('page', String(pageNumber));
  return html(`/?${params.toString()}`);
}

export async function renderSearch(query: string, pageNumber: number, requestedType = 'all', spanish = false) {
  const { template, pages } = await loadSearch(spanish);
  const t = (en: string, es: string) => spanish ? es : en;
  const link = (q: string, key: string, n = 1) => searchUrl(q, key, n, spanish);
  const type = requestedType in groups ? requestedType as Group : 'all';
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = pages.flatMap((item) => {
    const title = item.title.toLowerCase();
    if (!terms.length || !terms.every((term) => title.includes(term) || item.body.includes(term))) return [];
    return [{ item, score: terms.reduce((score, term) => score + (title.includes(term) ? 20 : 1), 0) }];
  });
  hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  const counts = { all: hits.length, protocols: 0, articles: 0, pages: 0 };
  for (const { item } of hits) counts[group(item)]++;
  const filtered = type === 'all' ? hits : hits.filter(({ item }) => group(item) === type);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(pageNumber, pageCount);
  const shown = filtered.slice((current - 1) * pageSize, current * pageSize).map(({ item }) => item);

  const pills = (['all', 'protocols', 'articles', 'pages'] as const)
    .filter((key) => key === 'all' || counts[key] > 0)
    .map((key) => {
      const label = key === 'all' ? t('All', 'Todo') : (spanish ? spanishGroups : groups)[key].label;
      const active = key === type;
      return `<a class="oa-search__pill${active ? ' is-active' : ''}" href="${link(query, key)}"${active ? ' aria-current="true"' : ''}>${label} <span>${counts[key]}</span></a>`;
    }).join('');
  const summary = !query
    ? t('Type a peptide, protocol or topic to search.', 'Escribe un péptido, protocolo o tema para buscar.')
    : spanish
      ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'} para “${html(query)}”`
      : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'} for “${html(query)}”`;
  const pager = pageCount > 1 ? `<nav class="oa-search__pager" aria-label="${t('Search results pages', 'Páginas de resultados')}">
      ${current > 1 ? `<a class="oa-link-button" href="${link(query, type, current - 1)}">${t('Previous', 'Anterior')}</a>` : '<span></span>'}
      <span class="oa-search__page">${spanish ? `Página ${current} de ${pageCount}` : `Page ${current} of ${pageCount}`}</span>
      ${current < pageCount ? `<a class="oa-link-button" href="${link(query, type, current + 1)}">${t('Next', 'Siguiente')}</a>` : '<span></span>'}
    </nav>` : '';
  const empty = query ? `<div class="oa-search__empty">
      <p>${spanish ? `No hay resultados para “${html(query)}”. Prueba con el nombre de un péptido, como BPC-157, o explora todo el contenido.` : `No results for “${html(query)}”. Try a peptide name such as BPC-157, or browse everything.`}</p>
      <div class="oa-link-row"><a class="oa-link-button" href="${t('/dosages/', '/es/dosis/')}">${t('Browse protocols', 'Explorar protocolos')}</a><a class="oa-link-button" href="${t('/blog/', '/es/blog/')}">${t('Read the blog', 'Leer el blog')}</a></div>
    </div>` : '';

  const body = `<section class="oa-search" aria-labelledby="oa-search-title">
    <h1 id="oa-search-title" class="oa-search__title">${t('Search', 'Buscar')}</h1>
    <form action="/" class="oa-search__form" method="get" role="search">
      ${spanish ? '<input type="hidden" name="lang" value="es">' : ''}
      <label class="screen-reader-text" for="pd-search-results-input">${t('Search the site', 'Buscar en el sitio')}</label>
      <input id="pd-search-results-input" name="s" type="search" value="${html(query)}" placeholder="${t('Search peptides, protocols and guides', 'Busca péptidos, protocolos y guías')}" required>
      <button type="submit">${t('Search', 'Buscar')}</button>
    </form>
    <p class="oa-search__summary" role="status">${summary}</p>
    ${hits.length ? `<div class="oa-search__pills">${pills}</div>` : ''}
    ${shown.length ? `<ul class="oa-search__grid">${shown.map((item) => card(item, spanish)).join('')}</ul>` : empty}
    ${pager}
  </section>`;
  return template.replace(/<!-- Search Hero -->[\s\S]*%%RESULTS%%/, () => body).replaceAll('%%QUERY%%', () => html(query));
}
