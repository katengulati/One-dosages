(function () {
  'use strict';

  var year = document.getElementById('currentYear');
  var button = document.getElementById('backToTop');
  if (year) year.textContent = String(new Date().getFullYear());

  var footerAccordionQuery = window.matchMedia('(max-width: 768px)');
  var footerAccordionTriggers = Array.prototype.slice.call(document.querySelectorAll('.footer-accordion-trigger[aria-controls]'));

  function setFooterAccordionMode(event) {
    var mobile = event.matches;
    footerAccordionTriggers.forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;

      if (mobile) {
        trigger.disabled = false;
        trigger.removeAttribute('tabindex');
        trigger.setAttribute('aria-expanded', 'false');
        panel.hidden = true;
      } else {
        trigger.disabled = true;
        trigger.setAttribute('tabindex', '-1');
        trigger.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
      }
    });
  }

  footerAccordionTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      if (!footerAccordionQuery.matches) return;
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;

      var expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      panel.hidden = expanded;
    });
  });

  setFooterAccordionMode(footerAccordionQuery);
  if (typeof footerAccordionQuery.addEventListener === 'function') {
    footerAccordionQuery.addEventListener('change', setFooterAccordionMode);
  } else if (typeof footerAccordionQuery.addListener === 'function') {
    footerAccordionQuery.addListener(setFooterAccordionMode);
  }

  if (!button) return;

  var reduceMotion = document.defaultView && document.defaultView.matchMedia
    ? document.defaultView.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var ticking = false;

  function updateButton() {
    var visible = document.documentElement.scrollTop > 300;
    button.hidden = !visible;
    button.classList.toggle('visible', visible);
    ticking = false;
  }

  document.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateButton);
  }, { passive: true });

  button.addEventListener('click', function () {
    document.documentElement.scrollTo({
      top: 0,
      behavior: reduceMotion && reduceMotion.matches ? 'auto' : 'smooth'
    });
    var main = document.getElementById('main-content');
    if (main) {
      window.setTimeout(function () {
        main.focus({ preventScroll: true });
      }, reduceMotion && reduceMotion.matches ? 0 : 350);
    }
  });

  updateButton();
})();
