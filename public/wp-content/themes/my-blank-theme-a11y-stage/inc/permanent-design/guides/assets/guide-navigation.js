/* Add presentation only. The theme retains heading IDs, deep links, tracking,
   mobile disclosure, focus management and all original article content. */
(function () {
  'use strict';
  function init() {
    if (!document.body.classList.contains('pdmg-studio')) return;
    var list = document.getElementById('toc');
    var panel = document.getElementById('page-toc-panel');
    if (!list || !panel || document.querySelector('.page-content')?.closest('[inert]')) return;
    var desktop = window.matchMedia('(min-width: 1025px)');
    var previous = null;
    function reveal(force) {
      if (!desktop.matches || !panel.clientHeight) return;
      var current = list.querySelector('a[aria-current="location"]');
      if (!current || (!force && previous === current)) return;
      previous = current;
      var viewport = panel.getBoundingClientRect();
      var link = current.getBoundingClientRect();
      var top = viewport.top + panel.clientTop + 8;
      var bottom = viewport.top + panel.clientTop + panel.clientHeight - 8;
      if (link.top < top) panel.scrollTop += link.top - top;
      else if (link.bottom > bottom) panel.scrollTop += link.bottom - bottom;
    }
    new MutationObserver(function () { reveal(false); }).observe(list, {subtree:true, childList:true, attributes:true, attributeFilter:['aria-current']});
    desktop.addEventListener('change', function () { reveal(true); });
    reveal(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
