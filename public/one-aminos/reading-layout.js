(() => {
  const frames = Array.from(document.querySelectorAll('iframe.oa-reconstitution-demo'));
  if (frames.length) window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.data?.type !== 'oa-demo-height') return;
    const frame = frames.find(item => item.contentWindow === event.source);
    if (frame && Number.isFinite(event.data.height)) {
      frame.style.height = Math.ceil(Math.max(200, Math.min(2200, event.data.height))) + 2 + 'px';
    }
  });

  const sidebar = document.querySelector('nav.toc,nav.toc-container');
  const header = document.querySelector('#siteHeader');
  if (!sidebar || !header) return;
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--oa-sticky-top', header.offsetHeight + 10 + 'px');
  }).observe(header);
  if (sidebar.matches('nav.toc')) {
    const title = sidebar.querySelector('.toc-title');
    const list = sidebar.querySelector('.toc-scroll');
    if (title && list) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oa-contents-toggle';
      button.textContent = title.textContent.trim();
      list.id ||= 'oa-protocol-contents-list';
      button.setAttribute('aria-controls', list.id);
      button.setAttribute('aria-expanded', 'false');
      title.append(button);
      const expand = open => {
        sidebar.classList.toggle('oa-mobile-open', open);
        button.setAttribute('aria-expanded', String(open));
      };
      button.addEventListener('click', () => expand(!sidebar.classList.contains('oa-mobile-open')));
      list.addEventListener('click', event => { if (event.target.closest('a')) expand(false); });
    }
  }
  const scroller = sidebar.querySelector('.nav-list-wrapper,.toc-scroll');
  if (!scroller) return;
  let pending = false;
  new MutationObserver(() => {
    if (pending || !matchMedia('(min-width: 992px)').matches) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const active = scroller.querySelector('a[aria-current]:not([aria-current="false"]),a.active,li.active > a,a.is-active');
      if (!active || sidebar.contains(document.activeElement)) return;
      const row = active.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      if (row.bottom > viewport.bottom) scroller.scrollTop += row.bottom - viewport.bottom + 6;
      else if (row.top < viewport.top) scroller.scrollTop -= viewport.top - row.top + 6;
    });
  }).observe(scroller, { subtree: true, attributes: true, attributeFilter: ['class','aria-current'] });
})();
