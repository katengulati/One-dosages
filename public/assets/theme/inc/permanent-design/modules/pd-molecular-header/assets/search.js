var oaES = /^es\b/i.test(document.documentElement.lang || '');
(() => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function rank(items, query) {
    const q = normalize(query), compact = q.replace(/ /g, ''), terms = q.split(' ');
    if (compact.length < 2) return {protocols: [], articles: []};
    const groups = {protocols: [], articles: []};
    items.forEach(item => {
      if (!groups[item.group]) return;
      const title = normalize(item.title), words = title.split(' '), tight = title.replace(/ /g, '');
      const termsMatch = terms.every(term => /^\d+$/.test(term) ? words.includes(term) : words.some(word => word.startsWith(term)));
      const compactMatch = terms.length === 1 && !/^\d+$/.test(q) && tight.includes(compact);
      if (!termsMatch && !compactMatch) return;
      const score = (title.startsWith(q) ? 100 : tight.startsWith(compact) ? 90 : termsMatch ? 60 : 40) - title.length / 1000;
      groups[item.group].push({...item, score});
    });
    for (const list of Object.values(groups)) list.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, undefined, {numeric: true}));
    return groups;
  }
  function safeItems(rows, origin) {
    if (!Array.isArray(rows)) return [];
    return rows.filter(item => {
      if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || !['protocols', 'articles'].includes(item.group)) return false;
      try { const url = new URL(item.url, origin); return url.origin === origin && ['http:', 'https:'].includes(url.protocol); } catch { return false; }
    }).map(({title, url, group, kind}) => ({title: title.slice(0, 300), url, group, kind: String(kind || '').slice(0, 40)}));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {normalize, rank, safeItems};
  if (typeof document === 'undefined') return;
  const wrap = document.querySelector('#siteHeader .pdmh-search-wrap');
  if (!wrap) return;
  const input = wrap.querySelector('input'), form = wrap.querySelector('form');
  const panel = wrap.querySelector('.pdmh-suggestions'), listbox = wrap.querySelector('[role=listbox]');
  const status = wrap.querySelector('[role=status]'), closeButton = wrap.querySelector('.pdmh-search-close');
  const desktop = matchMedia('(min-width:1025px)');
  let indexPromise, options = [], active = -1, timer, revision = 0;
  function open() { panel.hidden = false; input.setAttribute('aria-expanded', 'true'); }
  function resetActive() {
    active = -1; input.removeAttribute('aria-activedescendant');
    options.forEach(option => option.setAttribute('aria-selected', 'false'));
  }
  function close() {
    revision++; clearTimeout(timer); panel.hidden = true; input.setAttribute('aria-expanded', 'false'); resetActive(); indexPromise = null;
  }
  function message(text) {
    options = []; resetActive();
    for (const group of ['protocols', 'articles']) {
      const node = document.createElement('p'); node.className = 'pdmh-search-empty'; node.textContent = text;
      wrap.querySelector('[data-results="' + group + '"]').replaceChildren(node);
      wrap.querySelector('[data-count="' + group + '"]').textContent = '';
    }
    status.textContent = text;
  }
  async function loadIndex() {
    if (!indexPromise) {
      indexPromise = (async () => {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(wrap.dataset.indexUrl, {credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: {Accept: 'application/json'}});
          if (!response.ok) throw new Error('Search index unavailable');
          const data = await response.json();
          if (!Array.isArray(data.items)) throw new Error('Invalid search index');
          return safeItems(data.items, location.origin);
        } finally { clearTimeout(timeout); }
      })().catch(error => { indexPromise = null; throw error; });
    }
    return indexPromise;
  }
  function render(groups) {
    options = []; resetActive();
    for (const group of ['protocols', 'articles']) {
      const container = wrap.querySelector('[data-results="' + group + '"]');
      const count = groups[group].length; container.replaceChildren();
      wrap.querySelector('[data-count="' + group + '"]').textContent = String(count);
      if (!count) {
        const empty = document.createElement('p'); empty.className = 'pdmh-search-empty';
        empty.textContent = group === 'protocols' ? (oaES ? 'No hay títulos de dosificación que coincidan. Prueba con otro péptido o mira todos los resultados.' : 'No matching dosage titles. Try another peptide or view all search results.') : (oaES ? 'No hay títulos de artículos que coincidan. Mira todos los resultados para buscar también en el texto.' : 'No matching article titles. View all results to search article text too.');
        container.append(empty);
      }
      groups[group].slice(0, 5).forEach(item => {
        const link = document.createElement('a'); link.className = 'pdmh-search-result';
        link.href = item.url; link.id = 'pdmh-result-' + options.length; link.tabIndex = -1;
        link.setAttribute('role', 'option'); link.setAttribute('aria-selected', 'false');
        link.setAttribute('aria-label', item.title + ', ' + item.kind); link.title = item.title;
        const title = document.createElement('span'); title.className = 'pdmh-result-title';
        title.textContent = group === 'protocols' ? item.title.replace(/\s+Dosage Protocol$/i, '') : item.title;
        const kind = document.createElement('span'); kind.className = 'pdmh-result-kind'; kind.textContent = item.kind;
        link.append(title, kind); options.push(link); container.append(link);
      });
    }
    status.textContent = (oaES ? groups.protocols.length + ' coincidencias de dosificación y ' + groups.articles.length + ' de artículos. Se muestran hasta cinco por grupo. Usa las flechas para explorar, Intro para abrir o Escape para cerrar.' : groups.protocols.length + ' dosage matches and ' + groups.articles.length + ' article matches. Showing up to five per group. Use the arrow keys to explore, Enter to open, or Escape to close.');
  }
  async function update() {
    const query = input.value.trim(), id = ++revision;
    if (!desktop.matches || normalize(query).replace(/ /g, '').length < 2 || document.activeElement !== input) { close(); return; }
    open(); message(oaES ? 'Buscando coincidencias...' : 'Finding matches...'); listbox.setAttribute('aria-busy', 'true');
    try {
      const items = await loadIndex();
      if (id !== revision || !desktop.matches || document.activeElement !== input || input.value.trim() !== query) return;
      render(rank(items, query));
    } catch {
      if (id === revision) message(oaES ? 'Las sugerencias no están disponibles por ahora. Pulsa Intro o usa Ver todos los resultados.' : 'Suggestions are temporarily unavailable. Press Enter or use See all results.');
    } finally { if (id === revision) listbox.removeAttribute('aria-busy'); }
  }
  input.addEventListener('input', () => { revision++; resetActive(); clearTimeout(timer); timer = setTimeout(update, 100); });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) update(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); event.preventDefault(); return; }
    if (panel.hidden) { if (event.key === 'ArrowDown') { event.preventDefault(); update(); } return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      active = event.key === 'ArrowDown' ? (active + 1) % options.length : (active < 0 ? options.length - 1 : (active - 1 + options.length) % options.length);
      options.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault(); options[active].click(); close();
    }
  });
  panel.addEventListener('pointerdown', event => { if (event.target.closest('.pdmh-search-result')) event.preventDefault(); });
  panel.addEventListener('click', event => { if (event.target.closest('.pdmh-search-result')) close(); });
  closeButton.addEventListener('click', () => { input.focus(); close(); });
  form.addEventListener('submit', close);
  wrap.addEventListener('focusout', () => { setTimeout(() => { if (!wrap.contains(document.activeElement)) close(); }, 0); });
  document.addEventListener('pointerdown', event => { if (!wrap.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  desktop.addEventListener('change', () => { if (!desktop.matches) close(); });
})();
