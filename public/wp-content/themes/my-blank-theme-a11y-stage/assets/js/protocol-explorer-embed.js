/* Theme-owned full-width host below canonical navigation. */
(() => {
  'use strict';
  const shell = document.querySelector('.pd-explorer-shell');
  const frame = document.querySelector('.pd-explorer-frame');
  if (!shell || !frame) return;
  let scheduled = false;
  let lastTop = -1;
  let lastHeight = -1;
  const measure = () => {
    scheduled = false;
    const viewport = window.visualViewport;
    const viewportTop = viewport ? viewport.offsetTop : 0;
    const viewportHeight = viewport ? viewport.height : window.innerHeight;
    // Preserve the layout while a reader pinch-zooms; do not repack under them.
    if (viewport && Math.abs(viewport.scale - 1) > .01) return;
    let top = viewportTop;
    for (const element of [document.getElementById('wpadminbar'), document.getElementById('siteHeader')]) {
      if (!element) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0) {
        top = Math.max(top, rect.bottom);
      }
    }
    const height = Math.max(1, Math.floor(viewportTop + viewportHeight - top));
    top = Math.round(top);
    if (top !== lastTop) {
      shell.style.setProperty('--pd-explorer-top', top + 'px');
      lastTop = top;
    }
    if (Math.abs(height - lastHeight) > 1) {
      shell.style.setProperty('--pd-explorer-height', height + 'px');
      lastHeight = height;
    }
  };
  const queue = () => {
    if (!scheduled) { scheduled = true; window.requestAnimationFrame(measure); }
  };
  window.addEventListener('resize', queue, {passive:true});
  window.addEventListener('load', queue, {once:true});
  frame.addEventListener('load', queue);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', queue, {passive:true});
    window.visualViewport.addEventListener('scroll', queue, {passive:true});
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(queue);
    for (const id of ['wpadminbar', 'siteHeader']) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
  }
  queue();
})();
