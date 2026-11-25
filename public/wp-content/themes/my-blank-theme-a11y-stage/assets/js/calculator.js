(function(){
  'use strict';
  var X0 = 68, SPAN = 364;               // barrel interior in viewBox units
  var SIZES = {
    30:  { cap: 30,  minor: 0.5, major: 5,  hint: '30-unit (0.3 mL): finest marks, every ½ unit. Most accurate choice for small draws, up to about 25 units.' },
    50:  { cap: 50,  minor: 1,   major: 5,  hint: '50-unit (0.5 mL): 1-unit marks. A good middle ground for draws of roughly 15–45 units.' },
    100: { cap: 100, minor: 2,   major: 10, hint: '100-unit (1 mL): marks every 2 units. Fits the largest draws, but is the least precise for very small ones.' }
  };
  var size = 100;

  function el(id){ return document.getElementById(id); }
  function num(id){ var v = parseFloat(el(id).value); return (isNaN(v) || v < 0) ? 0 : v; }
  function fmt(n, d){ return parseFloat(n.toFixed(d)).toString(); }
  function fmtMcg(mcg){
    if (mcg >= 1000) return fmt(mcg/1000, 3) + ' mg';
    return fmt(mcg, 2) + ' mcg';
  }
  function pulse(node){
    node.classList.remove('pdc-pulse');
    void node.offsetWidth;
    node.classList.add('pdc-pulse');
  }

  /* ── Syringe ticks, rebuilt per barrel size ── */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function buildTicks(){
    var g = el('pdTicks'), cfg = SIZES[size];
    while (g.firstChild) g.removeChild(g.firstChild);
    for (var u = 0; u <= cfg.cap + 1e-9; u += cfg.minor) {
      u = Math.round(u * 2) / 2;
      var x = X0 + (u / cfg.cap) * SPAN;
      var isMajor = (u % cfg.major === 0);
      var t = document.createElementNS(SVGNS, 'line');
      t.setAttribute('x1', x); t.setAttribute('x2', x);
      t.setAttribute('y1', 41);
      t.setAttribute('y2', isMajor ? 59 : 51);
      t.setAttribute('class', 'tick' + (isMajor ? ' major' : ''));
      g.appendChild(t);
      if (isMajor) {
        var l = document.createElementNS(SVGNS, 'text');
        l.setAttribute('x', x); l.setAttribute('y', 100);
        l.setAttribute('text-anchor', 'middle');
        l.setAttribute('class', 'ticklbl');
        l.textContent = u;
        g.appendChild(l);
      }
    }
  }

  /* ── Segmented syringe control ── */
  var segBtns = Array.prototype.slice.call(el('d-syr').querySelectorAll('button'));
  function setSize(s, silent){
    size = s;
    segBtns.forEach(function(b){ b.setAttribute('aria-pressed', String(parseInt(b.getAttribute('data-size'), 10) === s)); });
    el('d-syrhint').textContent = SIZES[s].hint;
    buildTicks();
    if (!silent) calc();
  }
  segBtns.forEach(function(b){
    b.addEventListener('click', function(){ setSize(parseInt(b.getAttribute('data-size'), 10)); });
    b.addEventListener('mouseenter', function(){ el('d-syrhint').textContent = SIZES[parseInt(b.getAttribute('data-size'), 10)].hint; });
    b.addEventListener('mouseleave', function(){ el('d-syrhint').textContent = SIZES[size].hint; });
  });

  /* ── Core math ── */
  var last = {};
  function calc(){
    var pep = num('r-pep');          // mg in vial
    var water = num('r-water');      // mL added
    var concMgMl = water > 0 ? pep / water : 0;
    var mcgPerUnit = concMgMl * 10;  // 1 unit = 0.01 mL

    el('r-conc').textContent = fmt(concMgMl, 3) + ' mg/mL';
    el('r-perunit').textContent = fmtMcg(mcgPerUnit);
    el('r-perten').textContent = fmtMcg(mcgPerUnit * 10);

    var dose = num('d-dose');
    var doseMcg = el('d-doseunit').value === 'mg' ? dose * 1000 : dose;
    var doseMg = doseMcg / 1000;
    var invalid=[];
    [['r-pep',pep,'vial amount'],['r-water',water,'water volume'],['d-dose',dose,'target dose']].forEach(function(item){
      var field=el(item[0]);
      var isInvalid=!(item[1]>0);
      field.setAttribute('aria-invalid',String(isInvalid));
      if(isInvalid)invalid.push(item[2]);
    });
    var validation=el('pdc-validation');
    validation.hidden=invalid.length===0;
    validation.textContent=invalid.length?'Enter a value greater than zero for '+invalid.join(', ')+'.':'';
    var vol = concMgMl > 0 ? doseMg / concMgMl : 0;   // mL
    var units = vol * 100;                             // U-100 scale
    var cfg = SIZES[size];

    var unitsTxt = fmt(units, 2);
    if (el('d-units').textContent !== unitsTxt) {
      el('d-units').textContent = unitsTxt;
      pulse(el('d-units').parentNode);
    }
    el('d-vol').textContent = fmt(vol, 3) + ' mL';

    var dosesPerVial = doseMg > 0 ? Math.floor(pep / doseMg) : 0;
    el('d-perv').textContent = doseMg > 0 ? String(dosesPerVial) : 'Not set';

    var freq = parseFloat(el('d-freq').value);
    if (doseMg > 0 && freq > 0 && dosesPerVial > 0) {
      var days = dosesPerVial * 7 / freq;
      el('d-dur').textContent = days >= 21 ? ('≈ ' + fmt(days/7, 1) + ' wks') : ('≈ ' + Math.round(days) + ' days');
    } else {
      el('d-dur').textContent = 'Not set';
    }

    /* syringe drawing */
    var frac = Math.max(0, Math.min(1, units / cfg.cap));
    var sealX = frac * SPAN;
    el('pdLiquid').style.transform = 'scaleX(' + frac + ')';
    el('pdSeal').style.transform = 'translateX(' + sealX + 'px)';
    el('pdArrow').style.transform = 'translateX(' + sealX + 'px)';
    el('pdArrow').style.opacity = units > 0 ? 1 : 0;
    var rodStart = X0 + sealX + 14;
    el('pdRod').setAttribute('x', rodStart);
    el('pdRod').setAttribute('width', Math.max(18, 532 - rodStart));
    el('pdBarrel').classList.toggle('over', units > cfg.cap);

    /* guidance */
    var mark = el('d-mark'), note = el('d-note'), rec = el('d-rec'), recBtn = el('d-recbtn');
    mark.textContent = ''; mark.className = 'pdc-mark';
    note.textContent = ''; note.className = 'pdc-note';
    rec.style.display = 'none';

    if (units > 0 && concMgMl > 0) {
      if (units > cfg.cap) {
        note.className = 'pdc-note alert';
        if (units <= 100) {
          var fits = units <= 30 ? 30 : (units <= 50 ? 50 : 100);
          note.textContent = 'That\u2019s ' + unitsTxt + ' units  -  more than a ' + cfg.cap + '-unit syringe holds. Switch to the ' + fits + '-unit barrel, or use less water for a higher concentration.';
          recBtn.textContent = 'Switch to the ' + fits + '-unit syringe \u2192';
          recBtn.setAttribute('data-apply', fits);
          rec.style.display = 'block';
        } else {
          note.textContent = 'That\u2019s ' + unitsTxt + ' units  -  more than even a 100-unit (1 mL) syringe holds. Use less water for a higher concentration, or split the dose into two draws.';
        }
      } else {
        var nearest = Math.round(units / cfg.minor) * cfg.minor;
        nearest = Math.max(0, Math.min(cfg.cap, Math.round(nearest * 100) / 100));
        var doseAtMark = nearest * mcgPerUnit;
        var dev = doseMcg > 0 ? (doseAtMark - doseMcg) / doseMcg * 100 : 0;
        if (Math.abs(dev) < 0.5) {
          mark.className = 'pdc-mark ok';
          mark.textContent = '\u2713 Lands exactly on the ' + fmt(nearest, 2) + '-unit mark.';
        } else {
          mark.className = 'pdc-mark off';
          mark.textContent = 'Nearest mark: ' + fmt(nearest, 2) + ' units = ' + fmtMcg(doseAtMark) + ' (' + (dev > 0 ? '+' : '\u2212') + fmt(Math.abs(dev), 1) + '% vs target).';
          if (Math.abs(dev) > 4) {
            note.textContent = 'Tip: adjust the water volume slightly so your dose lands on a mark. Marks are much easier to hit consistently than the space between them.';
          }
        }
        if (units < 3) {
          note.textContent = 'A draw under 3 units is hard to measure accurately. Use less water for a higher concentration and a larger, easier draw.';
        }
        var best = units <= 25 ? 30 : (units <= 45 ? 50 : 100);
        if (best !== size) {
          recBtn.textContent = 'Better fit: ' + best + '-unit syringe (' + (best === 30 ? '\u00bd-unit' : best === 50 ? '1-unit' : '2-unit') + ' marks) \u2192';
          recBtn.setAttribute('data-apply', best);
          rec.style.display = 'block';
        }
      }
    }

    last = { pep: pep, water: water, concMgMl: concMgMl, doseMcg: doseMcg, vol: vol, units: units, dosesPerVial: dosesPerVial, freq: freq };
    el('pdc-status').textContent=invalid.length?'':('Calculated draw: '+unitsTxt+' units, '+fmt(vol,3)+' mL, '+dosesPerVial+' full doses per vial.');
  }

  el('d-recbtn').addEventListener('click', function(){
    setSize(parseInt(this.getAttribute('data-apply'), 10));
  });

  /* ── Quick chips ── */
  Array.prototype.forEach.call(document.querySelectorAll('.pdc-chips button[data-water]'), function(b){
    b.addEventListener('click', function(){ el('r-water').value = b.getAttribute('data-water'); calc(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.pdc-chips button[data-dose]'), function(b){
    b.addEventListener('click', function(){
      el('d-dose').value = b.getAttribute('data-dose');
      el('d-doseunit').value = 'mcg';
      calc();
    });
  });

  /* ── Tooltips: tap/click toggle for touch, Esc / outside click to close ── */
  function closeTip(tip,suppress){
    tip.classList.remove('open');
    tip.classList.toggle('suppressed',!!suppress);
    var button=tip.querySelector('.pdc-tip-btn');
    if(button)button.setAttribute('aria-expanded','false');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.pdc-tip-btn'), function(b){
    b.setAttribute('aria-expanded','false');
    b.addEventListener('focus',function(){b.parentNode.classList.remove('suppressed');});
    b.addEventListener('blur',function(){b.parentNode.classList.remove('suppressed');});
    b.parentNode.addEventListener('mouseleave',function(){b.parentNode.classList.remove('suppressed');});
    b.addEventListener('click', function(e){
      e.stopPropagation();
      var tip = b.parentNode, wasOpen = tip.classList.contains('open');
      Array.prototype.forEach.call(document.querySelectorAll('.pdc-tip.open'), function(t){closeTip(t,false);});
      if (!wasOpen) {tip.classList.add('open');b.setAttribute('aria-expanded','true');}
    });
  });
  document.addEventListener('click', function(){
    Array.prototype.forEach.call(document.querySelectorAll('.pdc-tip.open'), function(t){closeTip(t,false);});
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') Array.prototype.forEach.call(document.querySelectorAll('.pdc-tip.open'), function(t){closeTip(t,true);});
  });

  /* ── Copy summary ── */
  el('pdc-copy').addEventListener('click', function(){
    var L = last, btn = this;
    var sizeLbl = size + '-unit (' + (SIZES[size].cap / 100) + ' mL) U-100 insulin syringe';
    var lines = [
      'One Aminos Peptide Dosages',
      'Reconstitution: ' + fmt(L.pep, 2) + ' mg + ' + fmt(L.water, 2) + ' mL BAC water = ' + fmt(L.concMgMl, 3) + ' mg/mL (' + fmtMcg(L.concMgMl * 10) + ' per unit)',
      'Dose: ' + fmtMcg(L.doseMcg) + ' = ' + fmt(L.vol, 3) + ' mL  -  draw to ' + fmt(L.units, 2) + ' units on a ' + sizeLbl
    ];
    if (L.doseMcg > 0) {
      var dur = '';
      if (L.freq > 0 && L.dosesPerVial > 0) {
        var days = L.dosesPerVial * 7 / L.freq;
        dur = ' (lasts \u2248 ' + (days >= 21 ? fmt(days/7, 1) + ' weeks' : Math.round(days) + ' days') + ')';
      }
      lines.push('Doses per vial: ' + L.dosesPerVial + dur);
    }
    var text = lines.join('\n');
    function done(){
      btn.classList.add('done');
      btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied';
      setTimeout(function(){
        btn.classList.remove('done');
        btn.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i> Copy protocol summary';
      }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function(){ fallback(); });
    } else { fallback(); }
    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
      done();
    }
  });

  /* ── Wire inputs ── */
  ['r-pep','r-water','d-dose','d-doseunit','d-freq'].forEach(function(id){
    var n = el(id);
    n.addEventListener('input', calc);
    n.addEventListener('change', calc);
  });

  setSize(100, true);
  calc();
})();

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  var tocList = document.getElementById('toc');
  var content = document.querySelector('.page-content');
  var tocNav = tocList ? tocList.closest('.toc-container') : null;

  if (!tocList || !content || content.closest('[inert]')) {
    return;
  }

  var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));
  if (!headings.length) {
    if (tocNav) tocNav.hidden = true;
    return;
  }

  function slugify(text) {
    var slug = (text || '').toLowerCase();
    if (slug.normalize) {
      slug = slug.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    }
    return slug
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
  }

  var headingSet = new Set(headings);
  var usedIds = new Set();
  document.querySelectorAll('[id]').forEach(function(element) {
    if (!headingSet.has(element) && element.id) usedIds.add(element.id);
  });

  headings.forEach(function(heading, index) {
    var base = heading.id || slugify(heading.textContent) || 'calculator-section-' + (index + 1);
    var candidate = base;
    var suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = base + '-' + suffix;
      suffix += 1;
    }
    heading.id = candidate;
    heading.setAttribute('tabindex', '-1');
    heading.style.scrollMarginTop = '100px';
    usedIds.add(candidate);
  });

  var links = new Map();
  var desktopToc = window.matchMedia('(min-width: 1024px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var framePending = false;
  var trackingScroll = false;

  function setCurrent(id, reveal) {
    links.forEach(function(link, headingId) {
      var isCurrent = headingId === id;
      link.classList.toggle('active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');

      if (isCurrent && reveal && desktopToc.matches) {
        var wrapper = link.closest('.toc-container');
        if (wrapper) {
          var top = link.offsetTop;
          var bottom = top + link.offsetHeight;
          if (top < wrapper.scrollTop || bottom > wrapper.scrollTop + wrapper.clientHeight) {
            wrapper.scrollTo({
              top: Math.max(0, top - wrapper.clientHeight / 2 + link.offsetHeight / 2),
              behavior: reduceMotion.matches ? 'auto' : 'smooth'
            });
          }
        }
      }
    });
  }

  function focusHashDestination() {
    if (!window.location.hash) return;
    var id;
    try {
      id = decodeURIComponent(window.location.hash.substring(1));
    } catch (error) {
      id = window.location.hash.substring(1);
    }
    var target = document.getElementById(id);
    if (target && target.matches('.page-content h2, .page-content h3')) {
      target.focus({ preventScroll: true });
    }
  }

  headings.forEach(function(heading) {
    var item = document.createElement('li');
    var link = document.createElement('a');
    var icon = document.createElement('i');
    var sourceIcon = heading.querySelector('i');

    link.href = '#' + heading.id;
    icon.className = sourceIcon ? sourceIcon.className : (heading.tagName === 'H3' ? 'fas fa-angle-double-right' : 'fas fa-angle-right');
    icon.setAttribute('aria-hidden', 'true');
    link.appendChild(icon);
    link.appendChild(document.createTextNode(heading.textContent.trim()));
    link.addEventListener('click', function() {
      setCurrent(heading.id, false);
      window.setTimeout(focusHashDestination, 0);
    });

    item.appendChild(link);
    tocList.appendChild(item);
    links.set(heading.id, link);
  });

  setCurrent(headings[0].id, false);
  window.addEventListener('hashchange', focusHashDestination);
  window.setTimeout(focusHashDestination, 0);

  function updateCurrentSection() {
    framePending = false;
    if (!desktopToc.matches) return;

    var current = headings[0].id;
    headings.forEach(function(heading) {
      if (heading.getBoundingClientRect().top < 150) current = heading.id;
    });
    setCurrent(current, true);
  }

  function requestSectionUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateCurrentSection);
  }

  function syncScrollTracking() {
    if (desktopToc.matches && !trackingScroll) {
      window.addEventListener('scroll', requestSectionUpdate, { passive: true });
      trackingScroll = true;
    } else if (!desktopToc.matches && trackingScroll) {
      window.removeEventListener('scroll', requestSectionUpdate);
      trackingScroll = false;
    }
    requestSectionUpdate();
  }

  syncScrollTracking();
  if (desktopToc.addEventListener) desktopToc.addEventListener('change', syncScrollTracking);
  else if (desktopToc.addListener) desktopToc.addListener(syncScrollTracking);
});
