var oaES = /^es\b/i.test(document.documentElement.lang || '');
/* A progressive mobile writing view. The original textarea and form own the draft. */
(() => {
  'use strict';
  const message = document.querySelector('body.pdmc-contact [data-pdmc-form] #pd_message');
  if (!message || message.dataset.pdmcComposer || !window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) return;
  const form = message.form;
  const field = message.closest('.pd-cf-field');
  if (!form || !field) return;
  message.dataset.pdmcComposer = 'ready';
  const mobile = window.matchMedia('(max-width: 1024px)');
  const viewport = window.visualViewport;
  const dialog = document.createElement('dialog');
  dialog.className = 'pdmc-composer';
  dialog.setAttribute('aria-labelledby', 'pdmc-composer-title');
  dialog.innerHTML = (oaES ? '<div class="pdmc-composer-bar"><h2 id="pdmc-composer-title">Tu mensaje</h2><button type="button" class="pdmc-composer-done">Listo <span aria-hidden="true">&#10003;</span></button></div><div class="pdmc-composer-editor"></div><p class="pdmc-composer-hint">Toca Listo para volver al formulario. Tu mensaje se conserva aquí.</p>' : '<div class="pdmc-composer-bar"><h2 id="pdmc-composer-title">Your Message</h2><button type="button" class="pdmc-composer-done">Done <span aria-hidden="true">&#10003;</span></button></div><div class="pdmc-composer-editor"></div><p class="pdmc-composer-hint">Tap Done to return to the form. Your message stays here.</p>');
  document.body.append(dialog);
  const editor = dialog.querySelector('.pdmc-composer-editor');
  const done = dialog.querySelector('.pdmc-composer-done');
  const anchor = document.createComment('pdmc-original-message-position');
  let saved = null;
  let closing = false;
  let frame = 0;
  let restoreFocus = true;
  const attributes = ['form', 'aria-labelledby', 'autofocus'];
  const restoreAttribute = (element, name, value) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value);
  function fitViewport() {
    if (!dialog.open) return;
    // VisualViewport shrinks above the iOS/Android keyboard and moves when the
    // browser pans to the caret. No hard-coded keyboard or phone dimensions.
    dialog.style.setProperty('--pdmc-editor-top', Math.max(0, viewport ? viewport.offsetTop : 0) + 'px');
    dialog.style.setProperty('--pdmc-editor-left', Math.max(0, viewport ? viewport.offsetLeft : 0) + 'px');
    dialog.style.setProperty('--pdmc-editor-width', (viewport ? viewport.width : window.innerWidth) + 'px');
    dialog.style.setProperty('--pdmc-editor-height', (viewport ? viewport.height : window.innerHeight) + 'px');
  }
  function scheduleFit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fitViewport);
  }
  function restore() {
    if (!saved || dialog.open) return;
    closing = true;
    const previous = saved;
    const textScroll = message.scrollTop;
    saved = null;
    message.blur();
    anchor.replaceWith(message);
    attributes.forEach(name => restoreAttribute(message, name, previous.attributes[name]));
    message.scrollTop = textScroll;
    document.body.classList.remove('pdmc-writing');
    document.documentElement.classList.remove('pdmc-writing');
    if (previous.pageTop) document.body.style.setProperty('--pdmc-page-top', previous.pageTop);
    else document.body.style.removeProperty('--pdmc-page-top');
    if (previous.generatedFormId) form.removeAttribute('id');
    cancelAnimationFrame(frame);
    window.scrollTo(previous.x, previous.y);
    if (restoreFocus) {
      // Focus a non-editable return point so Done dismisses the keyboard rather
      // than immediately re-opening the writing view.
      const oldTabindex = field.getAttribute('tabindex');
      field.setAttribute('tabindex', '-1');
      field.classList.add('pdmc-composer-return');
      field.focus({preventScroll: true});
      restoreAttribute(field, 'tabindex', oldTabindex);
      field.addEventListener('blur', () => field.classList.remove('pdmc-composer-return'), {once: true});
    }
    requestAnimationFrame(() => { closing = false; });
  }
  function finish(focus = true) {
    if (!saved) return;
    closing = true;
    restoreFocus = focus;
    if (dialog.open) dialog.close();
    restore();
  }
  function open() {
    if (!mobile.matches || saved || closing || document.body.classList.contains('pdmc-writing')) return;
    saved = {
      x: window.scrollX, y: window.scrollY,
      attributes: Object.fromEntries(attributes.map(name => [name, message.getAttribute(name)])),
      pageTop: document.body.style.getPropertyValue('--pdmc-page-top'),
      generatedFormId: !form.id,
      start: message.selectionStart, end: message.selectionEnd, direction: message.selectionDirection,
      textScroll: message.scrollTop
    };
    restoreFocus = true;
    if (!form.id) {
      let id = 'pdmc-contact-form', suffix = 0;
      while (document.getElementById(id)) id = 'pdmc-contact-form-' + (++suffix);
      form.id = id;
    }
    message.before(anchor);
    message.setAttribute('form', form.id);
    message.setAttribute('aria-labelledby', 'pdmc-composer-title');
    message.setAttribute('autofocus', '');
    editor.append(message);
    document.body.style.setProperty('--pdmc-page-top', -saved.y + 'px');
    document.body.classList.add('pdmc-writing');
    document.documentElement.classList.add('pdmc-writing');
    try {
      dialog.showModal();
      fitViewport();
      // Synchronous focus preserves the original user gesture for mobile keyboards.
      message.focus({preventScroll: true});
      message.setSelectionRange(saved.start, saved.end, saved.direction);
      message.scrollTop = saved.textScroll;
      scheduleFit();
    } catch (_) {
      // A browser without working modal support keeps the regular usable form.
      finish(false);
    }
  }
  message.addEventListener('focus', open);
  // Allows a second tap to re-open after an orientation change without blur.
  message.addEventListener('click', open);
  done.addEventListener('click', () => finish());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    // Keep hardware-keyboard navigation on the two composer controls.
    event.preventDefault();
    (document.activeElement === message ? done : message).focus({preventScroll: true});
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  dialog.addEventListener('close', restore);
  window.addEventListener('resize', scheduleFit, {passive: true});
  window.addEventListener('orientationchange', scheduleFit, {passive: true});
  window.addEventListener('pagehide', () => finish(false));
  if (viewport) {
    viewport.addEventListener('resize', scheduleFit, {passive: true});
    viewport.addEventListener('scroll', scheduleFit, {passive: true});
  }
  const breakpointChanged = () => { if (!mobile.matches) finish(); };
  if (mobile.addEventListener) mobile.addEventListener('change', breakpointChanged);
  else mobile.addListener(breakpointChanged);
})();
