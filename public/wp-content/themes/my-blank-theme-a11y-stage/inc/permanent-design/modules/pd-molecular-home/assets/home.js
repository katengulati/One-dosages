/* Homepage-only enhancement. Retain the theme's single carousel timer, controls and calculator. */
(function () {
  'use strict';
  function enhance() {
    if (!document.body.classList.contains('pdhome-studio')) return;
    var root = document.querySelector('.hero-slideshow');
    var toggle = root && root.querySelector('.slide-toggle');
    if (!toggle || root.hasAttribute('data-pdhome-autoplay')) return;
    root.setAttribute('data-pdhome-autoplay', 'true');
    // Start once, including the owner's requested gentle reduced-motion presentation.
    // All subsequent manual pause, focus/hover pause, swipe and visibility behavior
    // remains owned by the original theme. Never add a second timer or auto-resume
    // after a visitor deliberately pauses the carousel.
    if (toggle.getAttribute('aria-pressed') === 'true') toggle.click();
    function label() {
      toggle.title = toggle.getAttribute('aria-pressed') === 'true' ? 'Resume slideshow' : 'Pause slideshow';
    }
    label();
    toggle.addEventListener('click', label);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, {once: true});
  else enhance();
})();
