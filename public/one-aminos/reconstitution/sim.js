// Reconstitution simulator. Uses the real One Aminos vial photos, draws liquid,
// powder, bubbles and a syringe on top, and animates the mixing steps.
// Mixing math only: it never suggests an amount to use.
const root = document.querySelector('[data-sim]');
if (root) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const DATA = JSON.parse(document.getElementById('sim-data').textContent);
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Elements
  const stage = $('.sim-stage');
  const pepBox = $('.sim-pep'), bacBox = $('.sim-bac');
  const pepImg = $('#sim-pep-img');
  const caps = $$('.sim-cap');
  const openSrc = (u) => u.replace('/product-images-labeled/', '/sim-vials/').replace(/\.png$/, '.webp');
  const syr = $('.sim-syringe');
  const swab = $('.sim-swab');
  const sticker = $('.sim-sticker');
  const check = $('.sim-check');
  const shine = $('.sim-shine');
  const hudSyr = $('#sim-hud-syr'), hudVial = $('#sim-hud-vial');
  const stepEls = $$('.sim-step');
  const caption = $('#sim-caption'), captionTitle = $('#sim-caption-title');
  const playBtn = $('#sim-play'), resetBtn = $('#sim-reset');
  const waterIn = $('#sim-water'), waterOut = $('#sim-water-out');
  const sizeWrap = $('#sim-sizes');
  const out = { strength: $('#sim-strength'), unit: $('#sim-unit'), total: $('#sim-total'), calc: $('#sim-calc') };

  // ── Choice state
  let pick = DATA[0], sizeIdx = 0, water = Number(waterIn.value);
  const mg = () => pick.s[sizeIdx][2];
  const cap = () => (water <= 1 ? 1 : 3);

  // ── Scene state (render() draws from this)
  const S = {};
  const fresh = () => Object.assign(S, {
    syrFrom: 'park', syrTo: 'park', syrT: 1, syrA: 0, syrFill: 0,
    swabFrom: 'swabPark', swabTo: 'swabPark', swabT: 1, swabWipe: 0, swabOn: 0,
    pepML: 0, bacML: 10, powder: 1, cloud: 0, tilt: 0, amp: 0, phase: 0, stream: 0,
    shine: -1, check: 0, sticker: 0, sparkle: [0, 0], cap: [0, 0],
  });

  // ── Geometry (px) from the stage size
  let G = {};
  const layout = () => {
    const W = stage.clientWidth, H = stage.clientHeight;
    const narrow = W / H < 1.2;
    const v = narrow ? Math.min(H * 0.6, W * 0.56) : Math.min(H * 0.66, W * 0.44), b = v * (narrow ? 0.66 : 0.74);
    const pep = { x: W * (narrow ? 0.64 : 0.66) - v / 2, y: H * 0.97 - v, s: v };
    const bac = { x: W * (narrow ? 0.17 : 0.22) - b / 2, y: H * 0.97 - b, s: b };
    const sh = Math.min(H * 0.46, v * 1.15);
    G = { W, H, pep, bac, sh, sw: (sh * 40) / 300 };
    for (const [el, r] of [[pepBox, pep], [bacBox, bac]]) Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.s + 'px', height: r.s + 'px' });
    Object.assign(syr.style, { width: G.sw + 'px', height: sh + 'px' });
  };
  // Named positions: syringe needle tip / swab centre
  const cap0 = (r) => ({ x: r.x + r.s * 0.5, y: r.y + r.s * 0.125 });
  const anchor = (n) => {
    const p = cap0(G.pep), b = cap0(G.bac);
    return {
      park: { x: G.W * 0.95, y: G.H * 0.97 - G.pep.s * 0.12 },
      aboveBac: { x: b.x, y: b.y - G.H * 0.05 },
      inBac: { x: b.x, y: b.y + G.bac.s * 0.13 },
      abovePep: { x: p.x + G.pep.s * 0.03, y: p.y - G.H * 0.05 },
      inPep: { x: p.x + G.pep.s * 0.02, y: p.y + G.pep.s * 0.07 },
      swabPark: { x: G.W * 0.06, y: -G.H * 0.2 },
      swabBac: { x: b.x, y: b.y - G.bac.s * 0.02 },
      swabPep: { x: p.x, y: p.y - G.pep.s * 0.02 },
    }[n];
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpP = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

  // ── Vial overlays (SVG in image space 0..100)
  const BODY = { x0: 33.6, x1: 66.4, top: 31, bot: 93.2 };
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
  const overlay = (box, id) => {
    const svg = mk('svg', { viewBox: '0 0 100 100', class: 'sim-ov', 'aria-hidden': 'true' });
    const defs = mk('defs', {}, svg);
    const cp = mk('clipPath', { id: id + '-clip' }, defs);
    mk('rect', { x: BODY.x0, y: BODY.top, width: BODY.x1 - BODY.x0, height: BODY.bot - BODY.top, rx: 2.6 }, cp);
    const gr = mk('linearGradient', { id: id + '-g', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    mk('stop', { offset: 0, 'stop-color': '#8fc2f2', 'stop-opacity': 0.55 }, gr);
    mk('stop', { offset: 1, 'stop-color': '#5f9fdf', 'stop-opacity': 0.5 }, gr);
    const psvg = mk('svg', { viewBox: '0 0 100 100', class: 'sim-pow', 'aria-hidden': 'true' });
    const pdefs = mk('defs', {}, psvg);
    const pcp = mk('clipPath', { id: id + '-pclip' }, pdefs);
    mk('rect', { x: BODY.x0, y: BODY.top, width: BODY.x1 - BODY.x0, height: BODY.bot - BODY.top, rx: 2.6 }, pcp);
    const pg = mk('linearGradient', { id: id + '-pg', x1: 0, y1: 0, x2: 0, y2: 1 }, pdefs);
    mk('stop', { offset: 0, 'stop-color': '#ffffff' }, pg);
    mk('stop', { offset: 0.6, 'stop-color': '#f4f5f8' }, pg);
    mk('stop', { offset: 1, 'stop-color': '#dfe2e8' }, pg);
    const pgrp = mk('g', { 'clip-path': `url(#${id}-pclip)` }, psvg);
    const g = mk('g', { 'clip-path': `url(#${id}-clip)` }, svg);
    const o = {
      powder: mk('path', { fill: `url(#${id}-pg)`, stroke: '#c3c8d2', 'stroke-width': 0.45 }, pgrp),
      specks: mk('g', { fill: '#fff', stroke: '#c9cdd6', 'stroke-width': 0.25 }, pgrp),
      cloud: mk('g', { fill: '#fff', stroke: '#c3c8d2', 'stroke-width': 0.22 }, pgrp),
      liquid: mk('path', { fill: `url(#${id}-g)` }, g),
      bubbles: mk('g', { fill: 'none', stroke: '#5f9fdf', 'stroke-width': 0.45 }, g),
      line: mk('path', { fill: 'none', stroke: '#3f7fc4', 'stroke-width': 0.7, 'stroke-opacity': 0.75 }, g),
      gloss: mk('path', { fill: 'none', stroke: '#fff', 'stroke-width': 0.9, 'stroke-opacity': 0.8 }, g),
      stream: mk('path', { fill: 'none', stroke: '#4f92d8', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-dasharray': '3 2.4' }, svg),
    };
    const capEl = box.querySelector('.sim-cap');
    box.insertBefore(psvg, capEl);
    box.insertBefore(svg, capEl);
    return o;
  };
  const PO = overlay(pepBox, 'simp'), BO = overlay(bacBox, 'simb');
  BO.powder.remove(); BO.specks.remove(); BO.cloud.remove(); BO.stream.remove();

  // Fixed random speck + cloud positions
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const specks = Array.from({ length: 34 }, (_, i) => ({ x: BODY.x0 + 1.5 + rnd(i) * 29.5, y: 0.15 + rnd(i + 50) * 0.75, r: 0.45 + rnd(i + 99) * 0.7 }));
  const flecks = Array.from({ length: 54 }, (_, i) => ({ x: BODY.x0 + 1 + rnd(i + 7) * 31, y: rnd(i + 70), r: 0.4 + rnd(i + 140) * 0.7, s: 0.6 + rnd(i + 210) }));
  specks.forEach((p) => mk('circle', { r: p.r }, PO.specks));
  flecks.forEach((p) => mk('circle', { r: p.r }, PO.cloud));
  let bubbles = [];

  const levelY = (ml, full) => BODY.bot - Math.min(1, ml / full) * (BODY.bot - BODY.top - 4);
  const surface = (y, k, amp, ph) => {
    const pts = [];
    for (let x = BODY.x0 - 1; x <= BODY.x1 + 1; x += 1.5) pts.push([x, y + (x - 50) * k + amp * Math.sin(x * 0.42 + ph) + amp * 0.5 * Math.sin(x * 0.9 - ph * 1.7)]);
    return pts;
  };
  const drawLiquid = (o, ml, full, k, amp, ph) => {
    if (ml <= 0.001) { o.liquid.setAttribute('d', ''); o.line.setAttribute('d', ''); o.gloss.setAttribute('d', ''); return BODY.bot; }
    const y = levelY(ml, full), pts = surface(y, k, amp, ph);
    const top = 'M' + pts.map((p) => p.join(' ')).join(' L');
    o.liquid.setAttribute('d', `${top} L${BODY.x1 + 1} 100 L${BODY.x0 - 1} 100 Z`);
    o.line.setAttribute('d', top);
    o.gloss.setAttribute('d', `M${BODY.x0 + 2.2} ${Math.min(BODY.bot - 2, y + 2)} L${BODY.x0 + 2.2} ${BODY.bot - 3}`);
    return y;
  };

  // ── Syringe SVG (viewBox 0 0 40 300, needle tip at 20,300)
  const SY = { empty: 228, full: 30 };
  syr.innerHTML = '';
  const ssvg = mk('svg', { viewBox: '0 0 40 300', overflow: 'visible', 'aria-hidden': 'true' }, syr);
  mk('rect', { x: 19.3, y: 244, width: 1.4, height: 56, fill: '#a7adb5' }, ssvg);
  mk('rect', { x: 14, y: 230, width: 12, height: 17, rx: 2, fill: '#eef1f5', stroke: '#9aa1aa', 'stroke-width': 1 }, ssvg);
  const sRod = mk('rect', { x: 17.5, width: 5, fill: '#4a4a4a', rx: 1 }, ssvg);
  const sThumb = mk('rect', { x: 7, width: 26, height: 6, rx: 2, fill: '#2f2f2f' }, ssvg);
  mk('rect', { x: 9, y: 18, width: 22, height: 214, rx: 3.5, fill: 'rgba(255,255,255,.82)', stroke: '#7d848d', 'stroke-width': 1.3 }, ssvg);
  const sFill = mk('rect', { x: 10.4, width: 19.2, fill: 'rgba(95,159,223,.6)' }, ssvg);
  const sTicks = mk('g', { stroke: '#30353b', 'stroke-width': 0.9 }, ssvg);
  for (let i = 0; i <= 20; i++) { const y = SY.empty - (i * (SY.empty - SY.full)) / 20; mk('line', { x1: 31, x2: i % 5 ? 26.5 : 23, y1: y, y2: y }, sTicks); }
  const sStop = mk('rect', { x: 10.4, width: 19.2, height: 8, rx: 1.6, fill: '#262626' }, ssvg);
  mk('rect', { x: 2, y: 14, width: 36, height: 5, rx: 2, fill: '#d4d9df', stroke: '#9aa1aa', 'stroke-width': 0.8 }, ssvg);
  mk('rect', { x: 11.5, y: 22, width: 2.2, height: 200, rx: 1, fill: '#fff', opacity: 0.85 }, ssvg);

  // ── Render
  const render = () => {
    if (!G.pep) return;
    // syringe
    const tip = lerpP(anchor(S.syrFrom), anchor(S.syrTo), S.syrT);
    Object.assign(syr.style, { left: tip.x - G.sw / 2 + 'px', top: tip.y - G.sh + 'px', transform: `rotate(${S.syrA}deg)` });
    const sb = SY.empty - S.syrFill * (SY.empty - SY.full);
    sFill.setAttribute('y', sb); sFill.setAttribute('height', Math.max(0, 230 - sb));
    sStop.setAttribute('y', sb - 8);
    sRod.setAttribute('y', sb - 8 - 205); sRod.setAttribute('height', 205);
    sThumb.setAttribute('y', sb - 8 - 211);
    // swab
    const sp = lerpP(anchor(S.swabFrom), anchor(S.swabTo), S.swabT);
    Object.assign(swab.style, { left: sp.x + 'px', top: sp.y + 'px', opacity: S.swabOn, transform: `translate(-50%,-50%) translateX(${S.swabWipe * G.pep.s * 0.09}px) rotate(${-8 + S.swabWipe * 10}deg)` });
    $$('.sim-spark').forEach((e, i) => { const a = anchor(i ? 'swabPep' : 'swabBac'); Object.assign(e.style, { left: a.x + 'px', top: a.y + 'px', opacity: S.sparkle[i], transform: `translate(-50%,-50%) scale(${0.6 + S.sparkle[i] * 0.6})` }); });
    // flip-off caps
    caps.forEach((c, i) => { const t = S.cap[i]; const lift = t < 0.25 ? (t / 0.25) * 0.12 : 0.12 + ((t - 0.25) / 0.75) * 2.4; c.style.transform = `translate(${t * (i ? 70 : -70)}%, ${-lift * 100}%) rotate(${t * (i ? 38 : -38)}deg)`; c.style.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; });
    // vial swirl
    pepBox.style.transform = `rotate(${S.tilt}deg)`;
    const k = -Math.tan((S.tilt * Math.PI) / 180);
    const y = drawLiquid(PO, S.pepML, 6, k, S.amp, S.phase);
    drawLiquid(BO, S.bacML, 11, 0, 0, 0);
    // powder cake
    const h = 10 * S.powder;
    let top = '';
    for (let x = BODY.x0; x <= BODY.x1 + 0.1; x += 2.05) { const bump = Math.sin(x * 1.7) * 0.6 + Math.sin(x * 0.55 + 1) * 0.9; const dome = 2.6 * Math.sin(((x - BODY.x0) / (BODY.x1 - BODY.x0)) * Math.PI); top += ` L${x.toFixed(2)} ${(BODY.bot - h - (dome + bump) * S.powder).toFixed(2)}`; }
    PO.powder.setAttribute('d', S.powder > 0.01 ? `M${BODY.x0} ${BODY.bot}${top} L${BODY.x1} ${BODY.bot} Z` : '');
    PO.powder.setAttribute('opacity', Math.min(1, S.powder * 1.6));
    [...PO.specks.children].forEach((c, i) => { const p = specks[i]; c.setAttribute('cx', p.x); c.setAttribute('cy', BODY.bot - p.y * h); c.setAttribute('opacity', S.powder); });
    // cloudiness while dissolving
    [...PO.cloud.children].forEach((c, i) => {
      const p = flecks[i]; const span = BODY.bot - y - 2;
      c.setAttribute('cx', p.x + Math.sin(S.phase * p.s + i) * 2.4);
      c.setAttribute('cy', BODY.bot - 1 - ((p.y + S.phase * 0.05 * p.s) % 1) * Math.max(0, span));
      c.setAttribute('opacity', S.cloud * (0.6 + 0.4 * p.s / 1.6));
    });
    // bubbles
    PO.bubbles.innerHTML = '';
    for (const b of bubbles) mk('circle', { cx: b.x, cy: b.y, r: b.r, opacity: b.o }, PO.bubbles);
    // stream down the glass wall
    const sy = Math.max(BODY.top + 4, y - 0.5);
    PO.stream.setAttribute('d', S.stream > 0 ? `M47.5 12 Q 36.5 18 35.2 31 L35.2 ${sy}` : '');
    PO.stream.setAttribute('opacity', S.stream);
    PO.stream.style.strokeDashoffset = -S.phase * 6;
    // shine, check, sticker
    shine.style.opacity = S.shine >= 0 && S.shine <= 1 ? 1 : 0;
    shine.style.transform = `translateX(${(S.shine * 2.2 - 1.1) * 100}%) skewX(-16deg)`;
    check.style.opacity = S.check; check.style.transform = `translate(-50%,-50%) scale(${0.4 + 0.6 * S.check})`;
    sticker.style.opacity = S.sticker; sticker.style.transform = `translate(-50%,-50%) translateY(${(1 - S.sticker) * 26}px) rotate(${(1 - S.sticker) * -6 - 2}deg) scale(${0.88 + 0.12 * S.sticker})`;
    sticker.style.visibility = S.sticker > 0.01 ? 'visible' : 'hidden';
    // HUD
    hudSyr.textContent = `${(S.syrFill * cap()).toFixed(2)} mL`;
    hudVial.textContent = `${S.pepML.toFixed(2)} mL`;
  };

  // ── Bubble physics (runs every frame while playing)
  const stepBubbles = (dt, spawn, x, yb) => {
    if (spawn && Math.random() < spawn) bubbles.push({ x: x + (Math.random() - 0.5) * 3, y: yb, r: 0.35 + Math.random() * 0.8, vy: 4 + Math.random() * 7, o: 0.9 });
    const top = levelY(S.pepML, 6) + 0.6;
    bubbles = bubbles.filter((b) => { b.y -= b.vy * dt; b.x += Math.sin(b.y * 0.8) * 0.05; if (b.y <= top) b.o -= dt * 4; return b.o > 0 && b.y > BODY.top; });
  };

  // ── Tween engine
  const ease = { in2: (t) => t * t, io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2), out: (t) => 1 - (1 - t) ** 3, lin: (t) => t, back: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2 };
  let run = 0;
  const speed = reduce ? 6 : 1;
  const tween = (ms, fn, e = ease.io) => new Promise((res, rej) => {
    const id = run, t0 = performance.now(); let last = t0;
    const tick = (now) => {
      if (id !== run) return rej(new Error('stopped'));
      const t = Math.min(1, (now - t0) / (ms / speed)); const dt = Math.min(0.05, (now - last) / 1000) * speed; last = now;
      fn(e(t), dt, t); render();
      t < 1 ? requestAnimationFrame(tick) : res();
    };
    requestAnimationFrame(tick);
  });
  const moveSyr = (to, ms, a = S.syrA) => { S.syrFrom = S.syrTo; S.syrTo = to; S.syrT = 0; const a0 = S.syrA; return tween(ms, (t) => { S.syrT = t; S.syrA = lerp(a0, a, t); }); };
  const moveSwab = (to, ms) => { S.swabFrom = S.swabTo; S.swabTo = to; S.swabT = 0; return tween(ms, (t) => { S.swabT = t; }); };

  // ── Steps
  const STEPS = [
    ['Open and clean', 'Flip the plastic caps off both vials. Wipe each rubber stopper with an alcohol swab and let it dry.'],
    ['Draw the water', 'Pull the plunger back slowly to fill the syringe with the water you planned.'],
    ['Add it slowly', 'Aim at the glass wall so the water runs down the side, not onto the powder.'],
    ['Swirl, don’t shake', 'Gently swirl the vial until all of the powder has dissolved.'],
    ['Check it', 'It should look clear, with nothing floating in it.'],
    ['Label and chill', 'Write the name, strength and date on it, then keep it in the fridge.'],
  ];
  const setStep = (i, extra = '') => {
    stepEls.forEach((e, j) => { e.classList.toggle('is-active', j === i); e.classList.toggle('is-done', j < i); });
    captionTitle.textContent = i < 0 ? 'Ready when you are' : `Step ${i + 1} of ${STEPS.length}: ${STEPS[i][0]}`;
    caption.textContent = i < 0 ? '' : STEPS[i][1] + extra; caption.hidden = i < 0;
  };

  const fmt = (n) => (Math.round(n * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
  // Suggested water: keeps the strength a round number and the vial easy to read.
  const suggestML = (m) => (m <= 10 ? Math.max(1, Math.ceil((m / 5) * 2) / 2) : Math.min(5, Math.max(1, Math.round((m / 10) * 2) / 2)));
  const results = () => {
    const strength = mg() / water, perUnit = (strength * 1000) / 100;
    const sug = suggestML(mg());
    $('#sim-suggest-ml').textContent = `${fmt(sug)} mL`;
    $('#sim-suggest').disabled = sug === water;
    out.strength.textContent = `${fmt(strength)} mg per mL`;
    out.unit.textContent = `${fmt(perUnit)} mcg`;
    out.total.textContent = `${fmt(mg())} mg in ${fmt(water)} mL`;

    $('#sim-sticker-name').textContent = pick.n;
    $('#sim-sticker-mix').textContent = `${fmt(mg())} mg + ${fmt(water)} mL water`;
    $('#sim-sticker-str').textContent = `${fmt(strength)} mg per mL`;
    $('#sim-sticker-date').textContent = 'Mixed ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    out.calc.href = `/calculator/?mg=${mg()}`;
  };

  const play = async () => {
    run++; fresh(); bubbles = []; results(false); render();
    root.classList.add('is-playing'); playBtn.querySelector('span').textContent = 'Playing…'; playBtn.disabled = true;
    try {
      // 1. clean
      setStep(0);
      await tween(650, (t) => { S.cap[0] = t; }, ease.in2);
      await tween(650, (t) => { S.cap[1] = t; }, ease.in2);
      S.swabOn = 1; await moveSwab('swabBac', 700);
      await tween(900, (t) => { S.swabWipe = Math.sin(t * Math.PI * 6); }, ease.lin);
      S.swabWipe = 0; await tween(260, (t) => { S.sparkle[0] = Math.sin(t * Math.PI); });
      await moveSwab('swabPep', 650);
      await tween(900, (t) => { S.swabWipe = Math.sin(t * Math.PI * 6); }, ease.lin);
      S.swabWipe = 0; await tween(260, (t) => { S.sparkle[1] = Math.sin(t * Math.PI); });
      await moveSwab('swabPark', 600); S.swabOn = 0;
      // 2–3. draw + add, in as many syringe loads as needed
      const loads = Math.ceil(water / cap() - 1e-9);
      let left = water;
      for (let n = 0; n < loads; n++) {
        const amt = Math.min(cap(), left); left -= amt;
        const tag = loads > 1 ? ` This is syringe ${n + 1} of ${loads}.` : '';
        setStep(1, tag);
        await moveSyr('aboveBac', 850, 0);
        await moveSyr('inBac', 520, 0);
        const bac0 = S.bacML;
        await tween(1500, (t) => { S.syrFill = (amt / cap()) * t; S.bacML = bac0 - amt * t; }, ease.io);
        await moveSyr('aboveBac', 450, 0);
        setStep(2, tag);
        await moveSyr('abovePep', 900, -16);
        await moveSyr('inPep', 520, -16);
        await tween(250, (t) => { S.stream = t; });
        const pep0 = S.pepML, f0 = S.syrFill;
        await tween(2100, (t, dt) => {
          S.syrFill = f0 * (1 - t); S.pepML = pep0 + amt * t; S.phase += dt * 3; S.amp = 0.35;
          S.powder = Math.max(0.55, S.powder - dt * 0.05);
          stepBubbles(dt, 0.35, 37, BODY.bot - 2);
        }, ease.lin);
        await tween(260, (t, dt) => { S.stream = 1 - t; S.phase += dt * 3; stepBubbles(dt, 0, 0, 0); });
        await moveSyr('abovePep', 420, -16);
      }
      await moveSyr('park', 750, 0);
      // 4. swirl
      setStep(3);
      const p0 = S.powder;
      await tween(3200, (t, dt) => {
        const env = Math.sin(t * Math.PI);
        S.tilt = 7 * env * Math.sin(t * Math.PI * 6);
        S.amp = 0.5 + 1.4 * env; S.phase += dt * 7;
        S.powder = p0 * (1 - ease.io(Math.min(1, t * 1.15)));
        S.cloud = Math.min(1, t * 3) * (1 - Math.max(0, (t - 0.55) / 0.45));
        stepBubbles(dt, 0.12 * env, 40 + Math.random() * 20, BODY.bot - 3);
      }, ease.lin);
      S.tilt = 0; S.powder = 0;
      await tween(900, (t, dt) => { S.amp = 0.5 * (1 - t); S.cloud *= 0.9; S.phase += dt * 3; stepBubbles(dt, 0, 0, 0); }, ease.out);
      S.cloud = 0; S.amp = 0; bubbles = [];
      // 5. check
      setStep(4);
      await tween(1000, (t) => { S.shine = t; }, ease.io);
      S.shine = -1;
      await tween(420, (t) => { S.check = t; }, ease.back);
      await tween(600, () => {});
      // 6. label
      setStep(5);
      results(true);
      await tween(380, (t) => { S.check = 1 - t; });
      await tween(650, (t) => { S.sticker = t; }, ease.back);
      $$('.sim-result').forEach((e) => { e.classList.remove('is-pop'); void e.offsetWidth; e.classList.add('is-pop'); });
      stepEls.forEach((e) => { e.classList.add('is-done'); e.classList.remove('is-active'); });
    } catch (e) { if (e.message !== 'stopped') throw e; }
    root.classList.remove('is-playing'); playBtn.disabled = false; playBtn.querySelector('span').textContent = 'Play again';
  };

  const reset = () => {
    run++; fresh(); bubbles = []; render(); setStep(-1); results(false);
    root.classList.remove('is-playing'); playBtn.disabled = false; playBtn.querySelector('span').textContent = 'Play';
  };

  // ── Pickers
  const renderSizes = () => {
    sizeWrap.innerHTML = pick.s.map((v, i) => `<button type="button" class="category-pill${i === sizeIdx ? ' is-selected' : ''}" aria-pressed="${i === sizeIdx}" data-i="${i}">${v[0]}</button>`).join('');
    pepImg.src = openSrc(pick.s[sizeIdx][1]); pepImg.alt = `${pick.n} ${pick.s[sizeIdx][0]} vial`;
    $('#sim-picked').textContent = `${pick.n}, ${pick.s[sizeIdx][0]}`;
  };
  $$('.sim-vial-pick').forEach((b) => b.addEventListener('click', () => {
    pick = DATA.find((d) => d.h === b.dataset.h); sizeIdx = 0;
    $$('.sim-vial-pick').forEach((x) => { x.classList.toggle('is-selected', x === b); x.setAttribute('aria-pressed', x === b); });
    renderSizes(); reset();
  }));
  sizeWrap.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; sizeIdx = Number(b.dataset.i); renderSizes(); reset(); });
  const setWater = () => { water = Number(waterIn.value); waterOut.textContent = `${fmt(water)} mL`; waterIn.style.setProperty('--p', ((water - waterIn.min) / (waterIn.max - waterIn.min)) * 100 + '%'); };
  waterIn.addEventListener('input', () => { setWater(); reset(); });
  $('#sim-suggest').addEventListener('click', () => { waterIn.value = suggestML(mg()); setWater(); reset(); });

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  // Let the browser handle trackpad and touch gestures in their native directions.
  const rail = $('.sim-vials');
  const back = $('#vials-back'), next = $('#vials-next');
  const updatePaging = () => {
    back.disabled = rail.scrollLeft <= 1;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
  };
  const page = (direction) => rail.scrollBy({
    left: direction * Math.max(1, rail.clientWidth - rail.firstElementChild.offsetWidth),
    behavior: reduce ? 'instant' : 'smooth'
  });
  back.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  rail.addEventListener('scroll', updatePaging, { passive: true });
  new ResizeObserver(updatePaging).observe(rail);
  updatePaging();

  rail.addEventListener('keydown', event => {
    const card = event.target.closest('.sim-vial-pick');
    if (!card) return;
    const targets = { ArrowLeft: card.previousElementSibling, ArrowRight: card.nextElementSibling,
      Home: rail.firstElementChild, End: rail.lastElementChild };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    const target = targets[event.key];
    if (!target) return;
    target.focus({ preventScroll: true });
    const r = target.getBoundingClientRect(), viewport = rail.getBoundingClientRect();
    if (r.left < viewport.left) rail.scrollLeft += r.left - viewport.left;
    else if (r.right > viewport.right) rail.scrollLeft += r.right - viewport.right;
  });

  let drag = null, suppressClick = false;
  rail.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.target.closest('.sim-vial-pick')) return;
    drag = { id: event.pointerId, x: event.clientX, left: rail.scrollLeft };
  });
  rail.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!suppressClick && Math.abs(dx) < 6) return;
    if (!suppressClick) {
      rail.setPointerCapture(drag.id);
      rail.classList.add('is-dragging');
      suppressClick = true;
    }
    rail.scrollLeft = drag.left - dx;
  });
  const endDrag = () => { drag = null; rail.classList.remove('is-dragging'); };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);
  rail.addEventListener('lostpointercapture', endDrag);
  rail.addEventListener('click', event => {
    if (!suppressClick || !event.detail) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);

  // Start from ?h= (peptide page link) when given
  const want = new URLSearchParams(location.search).get('h');
  const start = want && root.querySelector(`.sim-vial-pick[data-h="${CSS.escape(want)}"]`);
  if (start) { start.click(); rail.scrollLeft = start.offsetLeft - rail.clientWidth / 2 + start.offsetWidth / 2; }

  fresh(); layout(); setWater(); renderSizes(); setStep(-1); results(false); render();
  new ResizeObserver(() => { layout(); render(); }).observe(stage);
}
