import { isRetiredLearningPage } from './learning-features';
import { isArchivedCatalogPage } from './catalog';
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

function card(item: SearchPage) {
  const post = item.kind === 'Article';
  const protocol = !post && item.kind.toLowerCase().includes('peptide');
  const type = post ? 'post' : 'page';
  const kind = post ? 'Blog Post' : protocol ? 'Dosage Protocol' : 'Page';
  const action = post ? 'View Article' : protocol ? 'View Protocol' : 'View Page';
  const url = html(item.path);
  return `<article class="result-card" data-type="${type}">
    <span class="result-type ${type}">${kind}</span>
    <h2 class="result-title"><a href="${url}">${html(item.title)}</a></h2>
    <div class="result-excerpt">${html(item.summary)}</div>
    <a class="result-link" href="${url}">${action} <i aria-hidden="true" class="fas fa-arrow-right"></i></a>
  </article>`;
}

export async function renderSearch(query: string, pageNumber: number) {
  const { template, pages } = await loadSearch();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = pages.flatMap((item) => {
    const title = item.title.toLowerCase();
    if (!terms.length || !terms.every((term) => title.includes(term) || item.body.includes(term))) return [];
    return [{ item, score: terms.reduce((score, term) => score + (title.includes(term) ? 20 : 1), 0) }];
  });
  hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  const count = hits.length;
  const first = (pageNumber - 1) * pageSize;
  const current = hits.slice(first, first + pageSize).map(({ item }) => item);
  const articles = current.filter((item) => item.kind === 'Article').length;
  const pager = [[pageNumber - 1, 'Previous'], [pageNumber + 1, 'Next']] as const;
  const links = pager.filter(([number]) => number > 0 && number <= Math.ceil(count / pageSize))
    .map(([number, label]) => `<a class="page-numbers" href="/?${html(new URLSearchParams({ s: query, page: String(number) }).toString())}">${label}</a>`)
    .join(' ');
  const results = `<div class="search-container">
    <div class="search-info">
      <div class="search-count" data-total="${count}" data-page-count="${current.length}" role="status" aria-live="polite">
        Found <strong>${count}</strong> results. <span class="search-page-count">Showing ${current.length} on this page.</span>
      </div>
      <div class="search-filters">
        <button class="filter-tab active" type="button" data-filter="all" data-label="results" aria-pressed="true">This page (${current.length})</button>
        <button class="filter-tab" type="button" data-filter="pages" data-label="pages" aria-pressed="false">Pages (${current.length - articles})</button>
        <button class="filter-tab" type="button" data-filter="posts" data-label="blog posts" aria-pressed="false">Blog (${articles})</button>
      </div>
    </div>
    <div class="pd-search-results-grid">${current.map(card).join('') || '<p>No results found. Try another search.</p>'}</div>
    <nav class="pagination" aria-label="Search results pages">${links}</nav>
  </div>`;
  return template.replaceAll('%%QUERY%%', () => html(query)).replace('%%RESULTS%%', () => results);
}
