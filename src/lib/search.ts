import { isRetiredLearningPage } from './learning-features';
import { isArchivedCatalogPage, searchCover } from './catalog';
import { lipoReferenceTitles } from './lipo-references';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type SearchPage = {
  path: string;
  title: string;
  body: string;
  summary: string;
  kind: string;
};

const pageSize = 10;
let searchData: Promise<{ template: string; pages: SearchPage[] }> | undefined;

function loadSearch() {
  searchData ??= Promise.all([
    readFile(join(process.cwd(), 'search-template.html'), 'utf8'),
    readFile(join(process.cwd(), 'search-corpus.json'), 'utf8')
  ]).then(([template, corpus]) => ({
    template,
    pages: [
      { path: '/peptide-categories/', title: 'Peptide Categories', kind:'Guide',
        summary:'Browse compounds by research topic.', body:'peptides categories fat loss recovery focus skin sleep aging hormone signaling' },
      { path: '/how-to-read-a-coa/', title: 'How to Read a Certificate of Analysis (COA)', kind: 'Article',
        summary: 'Verify the batch and read identity, purity and net content in a real report.', body: 'COA batch lot purity verification net peptide content laboratory' },
      ...(JSON.parse(corpus) as SearchPage[]),
      ...Object.entries(lipoReferenceTitles).map(([slug, title]) => ({
        path: `/${slug}/`, title, body: title, kind: 'Article',
        summary: 'One Aminos Lipo C reference.'
      }))
    ]
      .filter((page) => !isRetiredLearningPage(page.path) && !isArchivedCatalogPage(page.path))
      .map((page) => ({ ...page, body: page.body.toLowerCase() }))
  }));
  return searchData;
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

function card(item: SearchPage) {
  const meta = groups[group(item)];
  const url = html(item.path);
  const cover = searchCover(item.path);
  const media = cover.kind === 'coa'
    ? '<span aria-hidden="true" class="oa-coa-cover"><img alt="" src="/one-aminos/wordmark.png"><b>COA</b><small>Certificate of Analysis</small></span>'
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

function searchUrl(query: string, type: string, pageNumber = 1) {
  const params = new URLSearchParams({ s: query });
  if (type !== 'all') params.set('type', type);
  if (pageNumber > 1) params.set('page', String(pageNumber));
  return html(`/?${params.toString()}`);
}

export async function renderSearch(query: string, pageNumber: number, requestedType = 'all') {
  const { template, pages } = await loadSearch();
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
      const label = key === 'all' ? 'All' : groups[key].label;
      const active = key === type;
      return `<a class="oa-search__pill${active ? ' is-active' : ''}" href="${searchUrl(query, key)}"${active ? ' aria-current="true"' : ''}>${label} <span>${counts[key]}</span></a>`;
    }).join('');
  const summary = !query
    ? 'Type a peptide, protocol or topic to search.'
    : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'} for “${html(query)}”`;
  const pager = pageCount > 1 ? `<nav class="oa-search__pager" aria-label="Search results pages">
      ${current > 1 ? `<a class="oa-link-button" href="${searchUrl(query, type, current - 1)}">Previous</a>` : '<span></span>'}
      <span class="oa-search__page">Page ${current} of ${pageCount}</span>
      ${current < pageCount ? `<a class="oa-link-button" href="${searchUrl(query, type, current + 1)}">Next</a>` : '<span></span>'}
    </nav>` : '';
  const empty = query ? `<div class="oa-search__empty">
      <p>No results for “${html(query)}”. Try a peptide name such as BPC-157, or browse everything.</p>
      <div class="oa-link-row"><a class="oa-link-button" href="/dosages/">Browse protocols</a><a class="oa-link-button" href="/blog/">Read the blog</a></div>
    </div>` : '';

  const body = `<section class="oa-search" aria-labelledby="oa-search-title">
    <h1 id="oa-search-title" class="oa-search__title">Search</h1>
    <form action="/" class="oa-search__form" method="get" role="search">
      <label class="screen-reader-text" for="pd-search-results-input">Search the site</label>
      <input id="pd-search-results-input" name="s" type="search" value="${html(query)}" placeholder="Search peptides, protocols and guides" required>
      <button type="submit">Search</button>
    </form>
    <p class="oa-search__summary" role="status">${summary}</p>
    ${hits.length ? `<div class="oa-search__pills">${pills}</div>` : ''}
    ${shown.length ? `<ul class="oa-search__grid">${shown.map(card).join('')}</ul>` : empty}
    ${pager}
  </section>`;
  return template.replace(/<!-- Search Hero -->[\s\S]*%%RESULTS%%/, () => body).replaceAll('%%QUERY%%', () => html(query));
}
