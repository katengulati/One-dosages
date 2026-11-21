(function () {
  'use strict';
  var root = document.querySelector('[data-pd-page-actions-preview]');
  var configNode = document.getElementById('pd-page-actions-contexts');
  if (!configNode) return;
  var config;
  try { config = JSON.parse(configNode.textContent); } catch (_) { return; }
  var realDraft = config.realPage === true && config.privateDraft === true && config.pageId === 3975;
  var privateLayout = config.realPage === true && config.privateLayout === true && config.pageId === 908;
  var protectedReview = realDraft || privateLayout;
  var publicReal = config.realPage === true && config.publicPage === true && Number.isInteger(config.pageId) && config.pageId > 0
    && config.privateDraft !== true && config.privateLayout !== true && document.body.classList.contains('pd-page-actions-live');
  if (config.realPage === true && !protectedReview && !publicReal) return;
  if (publicReal) root = document;
  if (!root) return;
  var select = document.getElementById('pa-context');
  var trigger = root.querySelector('.pa-share-trigger');
  var dialog = document.getElementById('pd-page-share-dialog');
  var status = document.getElementById('pa-share-status');
  var readerStatus = document.getElementById('pa-reader-status');
  var fallback = root.querySelector('.pa-copy-fallback');
  var returnCard = root.querySelector('.pa-return-card');
  if (!trigger || !dialog || !status || !readerStatus || !fallback || (!returnCard && !publicReal)) return;
  var returnFocus = null, current, busy = false;
  var embedded = window.self !== window.top;

  function publicPage(c) {
    if (!c || typeof c.url !== 'string' || typeof c.title !== 'string') return false;
    try {
      var u = new URL(c.url);
      return u.protocol === 'https:' && u.hostname === 'peptidedosages.com' && !u.username && !u.password && !u.port && !u.search && !u.hash;
    } catch (_) { return false; }
  }
  function message(text) { status.textContent = text; }
  function updateLinks() {
    if (protectedReview) {
      root.querySelectorAll('[data-pa-share]').forEach(function(node) { node.removeAttribute('href'); node.setAttribute('aria-disabled', 'true'); if (node.tagName === 'BUTTON') node.disabled = true; else node.setAttribute('tabindex', '-1'); });
      dialog.querySelector('.pa-native-share').disabled = true;
      dialog.querySelector('.pa-share-help').textContent = privateLayout ? 'This is a private layout preview. Open the published page to share it.' : 'This page is an unpublished draft. Sharing will be available after publication.';
      document.getElementById('pa-copy-link-field').value = '';
      return;
    }
    var url = current.url, title = current.title;
    var text = title + '\n' + url;
    var links = {
      sms: 'sms:?body=' + encodeURIComponent(text),
      whatsapp: 'https://wa.me/?text=' + encodeURIComponent(text),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
      x: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url),
      email: 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url),
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url)
    };
    Object.keys(links).forEach(function (key) { root.querySelector('[data-pa-share="' + key + '"]').href = links[key]; });
    document.getElementById('pa-copy-link-field').value = url;
  }
  // Decode only isolated entity tokens; never parse a whole title as HTML.
  function readableTitle(value) {
    return value.replace(/&(?:#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi, function (entity) {
      var text = document.createElement('textarea');
      text.innerHTML = entity;
      return text.value;
    });
  }
  function applyContext(key) {
    var c = config.contexts[key];
    if (c && typeof c.title === 'string') c = Object.assign({}, c, { title: readableTitle(c.title) });
    if (protectedReview) {
      if (!c || typeof c.title !== 'string' || c.url !== '') return false;
      current = c; document.getElementById('pa-share-description').textContent = c.title; updateLinks(); return true;
    }
    if (!publicPage(c)) return false;
    if (publicReal) {
      current = c;
      document.getElementById('pa-share-description').textContent = c.title;
      trigger.setAttribute('data-share-url', c.url);
      trigger.setAttribute('data-share-title', c.title);
      updateLinks(); return true;
    }
    current = c;
    root.setAttribute('data-pa-context', key);
    document.getElementById('pa-page-title').textContent = c.title;
    document.getElementById('pa-page-kicker').textContent = c.kicker;
    document.getElementById('pa-page-description').textContent = c.description;
    document.getElementById('pa-share-description').textContent = c.title;
    trigger.setAttribute('data-share-url', c.url);
    trigger.setAttribute('data-share-title', c.title);
    root.querySelectorAll('.pa-content-card h2').forEach(function (node, i) { node.textContent = c.cards[i] || ''; });
    document.getElementById('pa-sample-caption').textContent = key === 'explorer' ? 'Explorer canvas' : 'Within the page';
    updateLinks();
    return true;
  }
  if (!applyContext(config.current)) return;
  // Reuse the same controls at both widths, preserving one Share handler and source CTA.
  if ((protectedReview || publicReal) && typeof window.matchMedia === 'function' && typeof trigger.closest === 'function') {
    var hero = root.querySelector('.page-head, .pa-generic-hero');
    var titleRow = hero && hero.querySelector('.molecular-title-row');
    var metadata = hero && hero.querySelector('.article-meta');
    var dock = trigger.closest('.pa-action-dock');
    var googleAction = dock && dock.querySelector('[data-pd-google-source]');
    if (titleRow && metadata && dock && googleAction) {
      var divider = dock.querySelector('.pa-action-divider');
      var markerNames = ['data-vja-campaign', 'data-vja-placement', 'data-pd-action-surface'];
      var originalMarkers = markerNames.map(function(name) { return googleAction.getAttribute(name); });
      var narrow = window.matchMedia('(max-width: 820px)');
      function placePageActions() {
        if (narrow.matches) {
          titleRow.insertBefore(trigger, titleRow.firstChild);
          metadata.appendChild(googleAction);
          trigger.classList.add('pa-title-share');
          googleAction.classList.add('pa-meta-google');
          if (!publicReal) markerNames.forEach(function(name) { var value = dock.getAttribute(name); if (value !== null) googleAction.setAttribute(name, value); });
        } else {
          dock.insertBefore(googleAction, divider || dock.firstChild);
          dock.appendChild(trigger);
          trigger.classList.remove('pa-title-share');
          googleAction.classList.remove('pa-meta-google');
          if (!publicReal) markerNames.forEach(function(name, i) { if (originalMarkers[i] === null) googleAction.removeAttribute(name); else googleAction.setAttribute(name, originalMarkers[i]); });
        }
      }
      placePageActions();
      if (typeof narrow.addEventListener === 'function') narrow.addEventListener('change', placePageActions);
      else if (typeof narrow.addListener === 'function') narrow.addListener(placePageActions);
    }
  }
  if (select) select.addEventListener('change', function () { if (dialog.open) close(); applyContext(select.value); readerStatus.textContent = ''; });
  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  trigger.addEventListener('click', function () {
    returnFocus = document.activeElement;
    fallback.hidden = true; message(''); updateLinks();
    dialog.showModal();
    dialog.querySelector('.pa-share-close').focus({ preventScroll: true });
  });
  dialog.querySelector('.pa-share-close').addEventListener('click', close);
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) { var r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } });
  async function copy(success) {
    if (protectedReview) { message(privateLayout ? 'This private layout preview cannot be shared.' : 'This unpublished draft cannot be shared.'); return false; }
    if (embedded) { message('Use Open current page to test copying and sharing. This workspace stays isolated.'); return false; }
    var copied = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(current.url); copied = true; } } catch (_) {}
    if (!copied) {
      var field = document.createElement('textarea'); field.value = current.url; field.setAttribute('readonly',''); field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select();
      try { copied = document.execCommand('copy'); } catch (_) {}
      field.remove();
    }
    fallback.hidden = !!copied;
    message(copied ? success : 'Copy the public page link below.');
    if (!copied) { var input = document.getElementById('pa-copy-link-field'); input.focus(); input.select(); }
    return copied;
  }
  root.querySelector('[data-pa-share="copy"]').addEventListener('click', function () { copy('Link copied. Ready to share.'); });
  root.querySelector('[data-pa-share="instagram"]').addEventListener('click', function () { copy('Link copied. Paste it into Instagram.'); });
  dialog.querySelector('.pa-native-share').addEventListener('click', async function () {
    if (busy) return;
    if (protectedReview) { message('This unpublished draft cannot be shared.'); return; }
    if (embedded) { message('Use Open current page to test copying and sharing. This workspace stays isolated.'); return; }
    busy = true;
    try {
      if (navigator.share) {
        try { await navigator.share({ title: current.title, url: current.url }); close(); return; }
        catch (error) { if (error && error.name === 'AbortError') return; }
      }
      await copy('Link copied. Paste it anywhere.');
    } finally { busy = false; }
  });
  root.querySelectorAll('[data-pa-share]').forEach(function (node) { if (node.tagName === 'A') node.addEventListener('click', function(e) { if (protectedReview) { e.preventDefault(); message('This unpublished draft cannot be shared.'); } else if (embedded) { e.preventDefault(); message('Use Open current page to test copying and sharing. This workspace stays isolated.'); } }); });
  root.querySelectorAll('[data-pd-google-source]').forEach(function (node) { node.addEventListener('click', function (e) { if (embedded) { e.preventDefault(); readerStatus.textContent = 'Use Open current page to try the Google button. This workspace stays isolated.'; } else readerStatus.textContent = 'Google opens in a new tab. Your choice is confirmed there.'; }); });
  if (returnCard && root.querySelector('.pa-hide-invitation')) root.querySelector('.pa-hide-invitation').addEventListener('click', function () { returnCard.hidden = true; readerStatus.textContent = publicReal ? 'Invitation hidden. Share and Add on Google remain available above.' : 'Invitation hidden for this preview. Share and Add on Google remain available above.'; });
  var reset = document.getElementById('pa-preview-reset');
  if (reset) reset.addEventListener('click', function () { if (dialog.open) close(); returnCard.hidden = false; readerStatus.textContent = ''; select.value = config.current; applyContext(config.current); });
}());
