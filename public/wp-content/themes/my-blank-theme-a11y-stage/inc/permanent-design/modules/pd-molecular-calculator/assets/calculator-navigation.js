/* Presentation only: reveal the original current-section link inside its new
   list scrollport. The original calculator and heading tracker remain intact. */
(function () {
  'use strict';
  function init() {
    if (!document.body.classList.contains('pdmcalc-studio')) return;
    var list = document.querySelector('.toc-container > #toc');
    if (!list || list.closest('[inert]')) return;
    var desktop = window.matchMedia('(min-width: 1024px)');
    var previous = null;
    function reveal(force) {
      if (!desktop.matches || !list.clientHeight) return;
      var current = list.querySelector('a[aria-current="location"]');
      if (!current || (!force && current === previous)) return;
      previous = current;
      var viewport = list.getBoundingClientRect();
      var link = current.getBoundingClientRect();
      var top = viewport.top + list.clientTop + 8;
      var bottom = viewport.top + list.clientTop + list.clientHeight - 8;
      if (link.top < top) list.scrollTop += link.top - top;
      else if (link.bottom > bottom) list.scrollTop += link.bottom - bottom;
    }
    new MutationObserver(function () { reveal(false); }).observe(list, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current']
    });
    desktop.addEventListener('change', function () { reveal(true); });
    reveal(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
