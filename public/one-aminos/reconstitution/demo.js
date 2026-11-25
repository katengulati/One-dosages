// Canvas drawing adapted from the saved Peptide Dosages simulator (e955468).
// The playback controller drives the same bench scenes without user input.
const W = 380;
const TAU = Math.PI * 2;
const SUPPORTED_CAPACITIES = [3, 5, 10];
const fmtMl = (n) => String(Math.round(n * 100) / 100);
const prettyDate = (date) => date.toLocaleDateString(document.documentElement.lang, { month: 'short', day: 'numeric' });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
function setFont(c, weight, size, stretch) {
  c.font = `${weight} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  try { c.fontStretch = stretch || 'normal'; } catch (e) {}
}
function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

let k = 1, sc = 1, Hw = 640, bg = null;
function offscreenW(w, h) {
  const c = document.createElement('canvas'); const s = sc * k;
  c.width = Math.max(1, Math.ceil(w * s)); c.height = Math.max(1, Math.ceil(h * s));
  const g = c.getContext('2d'); g.scale(s, s); return { c, g };
}
function buildBg() {
  const o = offscreenW(W, Hw), g = o.g;
  const light = g.createRadialGradient(W * 0.46, Hw * 0.30, 0, W / 2, Hw / 2, Math.max(W, Hw) * 0.86);
  light.addColorStop(0, '#ffffff');
  light.addColorStop(0.76, '#f2f2f2');
  light.addColorStop(1, '#e8e8e8');
  g.fillStyle = light;
  g.fillRect(0, 0, W, Hw);
  bg = o;
}

/* bottle geometry, in local units before scaling */
const GEO = {
  pep: { hw: 20, nk: 11, neck: -26, sh: -9, bot: 44, crimp: -35, cw: 30, cap: -44.5, capw: 26, l0: -5, l1: 16 },
  bac: { hw: 27, nk: 12, neck: -44, sh: -24, bot: 58, crimp: -53, cw: 32, cap: -62.5, capw: 28, l0: -12, l1: 32 }
};
function glassPath(g, G) {
  g.beginPath();
  g.moveTo(-G.nk, G.neck); g.lineTo(-G.nk, G.sh - 11);
  g.bezierCurveTo(-G.nk, G.sh - 5, -G.hw, G.sh - 6, -G.hw, G.sh);
  g.lineTo(-G.hw, G.bot - 6); g.quadraticCurveTo(-G.hw, G.bot, -G.hw + 6, G.bot);
  g.lineTo(G.hw - 6, G.bot); g.quadraticCurveTo(G.hw, G.bot, G.hw, G.bot - 6);
  g.lineTo(G.hw, G.sh); g.bezierCurveTo(G.hw, G.sh - 6, G.nk, G.sh - 5, G.nk, G.sh - 11);
  g.lineTo(G.nk, G.neck); g.closePath();
}
const GERMS = [[-7, 0.6, 1.7, '#7FB54A'], [5, -0.8, 1.5, '#9B6AD0'], [-1, 1.4, 1.2, '#7FB54A'], [9, 0.9, 1.3, '#D86A4A'], [-11, -0.4, 1.1, '#9B6AD0'], [2, 0.1, 1.6, '#D86A4A']];
function drawContents(g, o, G) {
  const bodyTop = G.sh, bodyH = G.bot - G.sh;
  if (o.powder > 0) {
      const customPowder = o.powderColor && o.powderColor.toUpperCase() !== '#FBFBF8';
    const powderReach = G.hw + (customPowder ? 2 : 0);
    const ph = 9 * o.powder, y0 = G.bot - ph;
    g.beginPath(); g.moveTo(-powderReach, G.bot); g.lineTo(-powderReach, y0 + 1.5);
    for (let x = -powderReach; x <= powderReach; x += 4) g.lineTo(x, y0 + Math.sin(x * 0.9) * 1.1);
    g.lineTo(powderReach, y0 + Math.sin(powderReach * 0.9) * 1.1);
    g.lineTo(powderReach, G.bot); g.closePath();
    g.fillStyle = o.powderColor || '#FBFBF8'; g.fill(); g.strokeStyle = 'rgba(18,62,89,.12)'; g.lineWidth = 0.6; g.stroke();
  }
  if (o.liquid > 0) {
    let ly = G.bot - bodyH * Math.min(1, o.liquid) * 0.92;
    const tl = o.tilt || 0;
    // when the whole vial is tilted, turn back so the surface stays level with the bench
    if (tl) { g.save(); g.rotate(-tl); ly *= Math.cos(tl); }
    const tint = o.kind === 'bac' ? 'rgba(160,210,232,.42)' : rgba(o.solutionColor || '#96CEE8', 0.5 + 0.14 * (o.see || 0));
    const lw = tl ? G.hw * 3 : G.hw + 2, lh = tl ? G.bot * 2 : G.bot - ly + 2;
    const vo = tl ? 0 : (o.vortex || 0);
    if (vo > 0.02) {
      // swirling: the surface dips into a funnel and streaks spin around it
      const d = vo * (G.bot - ly) * 0.62, rim = ly - vo * 1.6;
      const surf = () => { g.moveTo(-lw, rim); g.quadraticCurveTo(-G.hw * 0.28, rim, 0, ly + d); g.quadraticCurveTo(G.hw * 0.28, rim, lw, rim); };
      g.beginPath(); surf(); g.lineTo(lw, G.bot + 2); g.lineTo(-lw, G.bot + 2); g.closePath();
      g.fillStyle = tint; g.fill();
      if (o.cloud > 0) { g.fillStyle = `rgba(255,255,255,${0.6 * o.cloud})`; g.fill(); }
      g.beginPath(); surf(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.1; g.stroke();
      for (let i = 0; i < 4; i++) {
        const yy = ly + d * 0.35 + (G.bot - ly - d * 0.35) * (0.12 + i * 0.22), rx = G.hw * (0.86 - i * 0.1), a0 = (o.vphase || 0) * (1.5 - i * 0.22) + i * 1.7;
        g.beginPath(); g.ellipse(0, yy, rx, 1.8 + i * 0.35, 0, a0, a0 + 1.9); g.strokeStyle = `rgba(255,255,255,${0.5 * vo})`; g.lineWidth = 1; g.stroke();
      }
      g.beginPath(); g.moveTo(-4 * vo, rim + 1); g.quadraticCurveTo(-1, ly + d * 0.7, 0, ly + d * 1.12); g.quadraticCurveTo(1, ly + d * 0.7, 4 * vo, rim + 1); g.closePath(); g.fillStyle = `rgba(255,255,255,${0.3 * vo})`; g.fill();
    } else {
      g.fillStyle = tint; g.fillRect(-lw, ly, lw * 2, lh);
      if (o.cloud > 0) { g.fillStyle = `rgba(255,255,255,${0.6 * o.cloud})`; g.fillRect(-lw, ly, lw * 2, lh); }
      g.beginPath(); g.ellipse(0, ly, tl ? G.hw * 1.4 : G.hw, 1.6, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    }
    if (o.specks && !tl) for (const p of o.specks) { if (!p.on) continue; const sx = vo > 0.02 ? Math.cos(p.a) * p.rad * (G.hw - 2) : p.x * G.hw; g.beginPath(); g.arc(sx, ly + (G.bot - ly) * p.y + (vo > 0.02 ? Math.sin(p.a) * 1.2 : 0), p.r, 0, TAU); g.fillStyle = o.powderColor || '#FBFBF8'; g.fill(); g.lineWidth = 0.3; g.strokeStyle = 'rgba(18,62,89,.25)'; g.stroke(); }
    if (o.foam > 0) {
      const n = Math.min(26, Math.round(o.foam * 30));
      for (let i = 0; i < n; i++) { const fx0 = ((i * 37) % 23) / 23 * 2 - 1, r = 1.2 + ((i * 13) % 7) / 7 * 1.8; g.beginPath(); g.arc(fx0 * (G.hw - 2), ly - r * 0.6 + ((i * 7) % 3), r, 0, TAU); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); g.lineWidth = 0.35; g.strokeStyle = 'rgba(18,62,89,.3)'; g.stroke(); }
    }
    if (tl) g.restore();
  }
}
// Follow the photographed vial's lower contour. The label wraps around the
// cylinder, so its lower edge sits slightly higher at the sides than in the
// center. The shallow bowed top fills only that exposed clear-glass gap, while
// the original six-unit bottle curve is preserved at the bottom.
/* o: kind, x, y, s, rot, cap (0 on, 1 gone, between = flying), dirt, wet, name, sub, color, liquid 0..1, cloud, powder, specks (array), foam, roll, jiggle */
function drawBottle(g, o) {
  const G = GEO[o.kind];
  g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0);
  if (o.jiggle) g.rotate(Math.sin(performance.now() / 28) * 0.06 * o.jiggle);
  g.scale(o.s, o.s);
  // shadow on the pad
  if (!o.rot && !o.tilt) { g.beginPath(); g.ellipse(0, G.bot + 2, G.hw * 1.05, 4, 0, 0, TAU); g.fillStyle = 'rgba(18,62,89,.12)'; g.fill(); }
  glassPath(g, G);
  const gl = g.createLinearGradient(-G.hw, 0, G.hw, 0);
  gl.addColorStop(0, 'rgba(196,222,232,.75)'); gl.addColorStop(0.3, 'rgba(250,253,254,.9)'); gl.addColorStop(1, 'rgba(176,208,220,.72)');
  g.fillStyle = gl; g.fill();
  g.save(); glassPath(g, G); g.clip();
  drawContents(g, o, G);
  if (o.inner) o.inner(g);
  // Use actual One Aminos label artwork, leaving the moving liquid visible below it.
  const label = labels[o.kind];
  const labelTop = G.sh + 1;
  const labelHeight = (G.bot - labelTop) * (o.see ? 0.56 : 0.72);
  g.fillStyle = '#f8f8f8';
  g.fillRect(-G.hw - 1, labelTop, G.hw * 2 + 2, labelHeight);
  if ((o.kind === 'pep' && V.P.name !== 'GHK-Cu') || (o.kind === 'pep' && V.P.mg !== 50) || (o.kind === 'bac' && V.target > 3)) {
    g.fillStyle = '#151515'; g.textAlign = 'center'; g.textBaseline = 'middle';
    setFont(g, 700, 8, 'normal');
    g.fillText(o.kind === 'pep' ? V.P.name : 'BAC WATER', 0, labelTop + labelHeight * .45, G.hw * 1.8);
    setFont(g, 600, 6, 'normal');
    g.fillText(o.kind === 'pep' ? V.P.mg + ' mg' : '10 mL', 0, labelTop + labelHeight * .68, G.hw * 1.8);
  } else if (label.complete && label.naturalWidth) {
    // The label turns with an inverted vial and rolls with its rotation.
    const offset = o.roll ? Math.sin(o.roll) * G.hw * 0.13 : 0;
    g.drawImage(label, -G.hw * 0.93 + offset, labelTop + 1, G.hw * 1.86, labelHeight - 2);
  }
  g.restore();
  glassPath(g, G); g.lineWidth = 1.1 / Math.max(0.6, o.s / 2); g.strokeStyle = 'rgba(18,62,89,.45)'; g.stroke();
  g.beginPath(); g.moveTo(-G.hw + 5, G.sh + 4); g.lineTo(-G.hw + 5, G.bot - 7); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke();
  // aluminum crimp
  g.beginPath(); rrect(g, -G.cw / 2, G.crimp, G.cw, G.neck - G.crimp, 2);
  const cr = g.createLinearGradient(-G.cw / 2, 0, G.cw / 2, 0);
  cr.addColorStop(0, '#7C8E99'); cr.addColorStop(0.35, '#F4F7F8'); cr.addColorStop(0.7, '#AEBBC2'); cr.addColorStop(1, '#6A7C87');
  g.fillStyle = cr; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(18,62,89,.45)'; g.stroke();
  // rubber stopper, seen from slightly above (only once the cap is coming off)
  const rx = G.cw / 2 - 3.5, sy = G.crimp;
  if ((o.cap === undefined ? 0 : o.cap) > 0) {
  g.beginPath(); g.ellipse(0, sy, rx, 3.4, 0, 0, TAU);
  const rb = g.createLinearGradient(0, sy - 3.4, 0, sy + 3.4); rb.addColorStop(0, '#8E969C'); rb.addColorStop(1, '#5E676E');
  g.fillStyle = rb; g.fill();
  g.beginPath(); g.ellipse(0, sy, rx * 0.42, 1.4, 0, 0, TAU); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.6; g.stroke();
  if (o.dirt > 0) for (let i = 0; i < GERMS.length; i++) {
    const a = clamp(o.dirt * GERMS.length - i, 0, 1); if (a <= 0) continue;
    const [gx, gy, gr, gc] = GERMS[i];
    g.globalAlpha = a; g.beginPath(); g.arc(gx * rx / 12, sy + gy * 1.6, gr, 0, TAU); g.fillStyle = gc; g.fill();
    g.beginPath(); g.arc(gx * rx / 12 - gr * 0.3, sy + gy * 1.6 - gr * 0.3, gr * 0.3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
  }
  g.globalAlpha = 1;
  if (o.wet > 0) { g.beginPath(); g.ellipse(-rx * 0.3, sy - 0.9, rx * 0.45, 1, -0.1, 0, TAU); g.fillStyle = `rgba(255,255,255,${0.75 * o.wet})`; g.fill(); }
  }
  // flip-off cap
  const capOn = o.cap === undefined ? 0 : o.cap;
  if (capOn < 1) {
    const f = capOn;
    g.save(); g.translate(f * 26, -f * 60 + f * f * 40); g.rotate(f * 2.4); g.globalAlpha = 1 - f * 0.9;
    g.beginPath(); rrect(g, -G.capw / 2, G.cap, G.capw, G.crimp - G.cap + 1, 3.5);
    const cg = g.createLinearGradient(-G.capw / 2, 0, G.capw / 2, 0);
    cg.addColorStop(0, '#e4e4e4'); cg.addColorStop(0.45, '#ffffff'); cg.addColorStop(1, '#acacac');
    g.fillStyle = cg; g.fill(); g.lineWidth = 0.9; g.strokeStyle = '#989898'; g.stroke();
    g.beginPath(); g.moveTo(-G.capw / 2 + 4, G.cap + 2); g.lineTo(G.capw / 2 - 6, G.cap + 2); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.1; g.stroke();
    g.restore();
  }
  g.restore();
}
function drawStream(g, th, fill, flow, tx, ty, sc0) {
  if (flow <= 0.02) return;
  const G = GEO.pep, ly = G.bot - (G.bot - G.sh) * Math.min(1, fill) * 0.92, lyW = ly * Math.cos(th), wx = G.hw - 1.5;
  const yWall = clamp((lyW - wx * Math.sin(th)) / Math.cos(th), G.sh, G.bot);
  g.beginPath(); g.lineCap = 'round';
  if (flow > 1.2) { g.moveTo(tx, ty); g.lineTo(2, G.bot - 7); g.lineWidth = (2 + flow * 2) / sc0; }
  else { g.moveTo(tx, ty); g.quadraticCurveTo(wx, G.sh, wx, Math.max(G.sh, yWall)); g.lineWidth = (1.2 + flow * 3) / sc0; }
  g.strokeStyle = 'rgba(120,190,226,.9)'; g.stroke();
}
/* a small cutaway panel so players can see the solution behind the label */
function syringeGeo(u, ppm, ln, capacity) {
  const cap = SUPPORTED_CAPACITIES.includes(Number(capacity)) ? Number(capacity) : 3;
  const Ln = (ln || 38) * u, hub = 12 * u, z0 = Ln + hub;
  return { Ln, hub, z0, bw: 24 * u, ppm, capacity: cap, zEnd: z0 + (cap + 0.15) * ppm, stop: 10 * u, rod: (cap + 0.15) * ppm + 16 * u };
}
function drawSyringe(g, o) {
  const u = o.u, S = syringeGeo(u, o.ppm, o.ln, o.capacity);
  g.save(); g.translate(o.x, o.y); g.rotate(o.ang || 0);
  // needle and hub
  g.beginPath(); g.moveTo(-0.9 * u, S.Ln); g.lineTo(-0.9 * u, 3 * u); g.lineTo(0, 0); g.lineTo(0.9 * u, 3 * u); g.lineTo(0.9 * u, S.Ln); g.closePath();
  g.fillStyle = '#B9C4CA'; g.fill(); g.strokeStyle = 'rgba(18,62,89,.35)'; g.lineWidth = 0.5; g.stroke();
  g.beginPath(); rrect(g, -5 * u, S.Ln, 10 * u, S.hub + 1, 2 * u); g.fillStyle = '#F2C230'; g.fill(); g.strokeStyle = 'rgba(18,62,89,.35)'; g.stroke();
  // barrel
  const bx = -S.bw / 2;
  g.beginPath(); rrect(g, bx - 2 * u, S.z0 - 3 * u, S.bw + 4 * u, S.zEnd - S.z0 + 3 * u, 4 * u);
  const bgd = g.createLinearGradient(bx, 0, -bx, 0); bgd.addColorStop(0, 'rgba(214,232,240,.75)'); bgd.addColorStop(0.3, 'rgba(255,255,255,.92)'); bgd.addColorStop(1, 'rgba(200,222,232,.75)');
  g.fillStyle = bgd; g.fill();
  // contents
  const zp = S.z0 + o.vol * S.ppm;
  const air = Math.min(o.air || 0, o.vol);
  if (o.vol > 0.001) {
    let lz0 = S.z0;
    if (o.airTop && air > 0.001) lz0 = S.z0 + air * S.ppm;
    g.fillStyle = 'rgba(120,190,226,.5)'; g.fillRect(bx, lz0, S.bw, zp - lz0);
    if (o.airTop && air > 0.001) { g.beginPath(); g.ellipse(0, lz0, S.bw / 2, 2 * u, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); }
    if (o.bubbles) for (const b of o.bubbles) {
      const z = lerp(S.z0 + b.r * u + 1, zp - b.r * u - 1, b.f);
      g.beginPath(); g.arc(b.x * (S.bw / 2 - b.r * u - 1), z, b.r * u, 0, TAU); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); g.strokeStyle = 'rgba(18,62,89,.35)'; g.lineWidth = 0.6; g.stroke();
    }
  }
  // graduations
  g.strokeStyle = 'rgba(18,62,89,.75)'; g.fillStyle = '#123E59';
  const minorMl = S.capacity <= 3 ? 0.1 : S.capacity <= 5 ? 0.2 : 0.5;
  const majorMl = S.capacity <= 3 ? 0.5 : 1;
  const ticks = Math.round(S.capacity / minorMl);
  for (let i = 0; i <= ticks; i++) {
    const value = i * minorMl, z = S.z0 + value * S.ppm;
    const major = Math.abs(value / majorMl - Math.round(value / majorMl)) < 0.001;
    g.beginPath(); g.moveTo(bx, z); g.lineTo(bx + (major ? 11 : 5.5) * u, z); g.lineWidth = major ? 1.1 : 0.7; g.stroke();
    if (major && value > 0 && o.labels) { setFont(g, 700, 7.6 * u, 'normal'); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(fmtMl(value), bx + 13 * u, z); }
  }
  if (o.labels) { setFont(g, 700, 6.5 * u, 'normal'); g.textAlign = 'left'; g.fillText('mL', bx + 13 * u, S.z0 + 0.25 * S.ppm); }
  if (o.target !== undefined) {
    const z = S.z0 + o.target * S.ppm; g.setLineDash([3 * u, 3 * u]); g.beginPath(); g.moveTo(bx - 8 * u, z); g.lineTo(-bx + 8 * u, z); g.strokeStyle = 'rgba(17,140,196,.9)'; g.lineWidth = 1.4; g.stroke(); g.setLineDash([]);
  }
  // plunger: rubber tip, rod, thumb press
  g.beginPath(); rrect(g, bx + 0.5, zp, S.bw - 1, S.stop, 2 * u); g.fillStyle = '#2B3238'; g.fill();
  g.fillStyle = '#454E55'; g.fillRect(bx + 0.5, zp + S.stop * 0.35, S.bw - 1, 1.4 * u); g.fillRect(bx + 0.5, zp + S.stop * 0.7, S.bw - 1, 1.4 * u);
  const rodEnd = zp + S.stop + S.rod;
  g.fillStyle = 'rgba(236,242,244,.95)'; g.fillRect(-3.2 * u, zp + S.stop, 6.4 * u, S.rod); g.fillRect(-S.bw / 2 + 3 * u, zp + S.stop, 1.2 * u, S.rod); g.fillRect(S.bw / 2 - 4.2 * u, zp + S.stop, 1.2 * u, S.rod);
  g.strokeStyle = 'rgba(18,62,89,.3)'; g.lineWidth = 0.6; g.strokeRect(-3.2 * u, zp + S.stop, 6.4 * u, S.rod);
  g.beginPath(); rrect(g, -S.bw / 2 - 4 * u, rodEnd, S.bw + 8 * u, 6 * u, 3 * u); g.fillStyle = o.thumbColor || '#F7FAFB'; g.fill(); g.strokeStyle = 'rgba(18,62,89,.45)'; g.lineWidth = 0.8; g.stroke();
  // barrel outline and finger flange
  g.beginPath(); rrect(g, bx - 2 * u, S.z0 - 3 * u, S.bw + 4 * u, S.zEnd - S.z0 + 3 * u, 4 * u); g.strokeStyle = 'rgba(18,62,89,.5)'; g.lineWidth = 1; g.stroke();
  g.beginPath(); g.moveTo(bx + 3 * u, S.z0 + 2 * u); g.lineTo(bx + 3 * u, S.zEnd - 4 * u); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.8 * u; g.stroke();
  g.beginPath(); rrect(g, -S.bw / 2 - 14 * u, S.zEnd, S.bw + 28 * u, 5 * u, 2.5 * u); g.fillStyle = '#EEF3F5'; g.fill(); g.strokeStyle = 'rgba(18,62,89,.5)'; g.lineWidth = 0.9; g.stroke();
  g.restore();
  return { S, zp, rodEnd };
}
function drawPad(g, x, y, s, wet) {
  g.save(); g.translate(x, y); g.rotate(-0.12);
  g.beginPath(); rrect(g, -17 * s, -17 * s, 34 * s, 34 * s, 5 * s); g.fillStyle = '#FFFFFF'; g.fill();
  g.strokeStyle = 'rgba(18,62,89,.3)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = `rgba(160,210,232,${0.25 + 0.35 * wet})`; g.beginPath(); rrect(g, -13 * s, -13 * s, 26 * s, 26 * s, 3 * s); g.fill();
  setFont(g, 800, 6.4 * s, 'condensed'); g.fillStyle = '#0875A9'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('70% IPA', 0, 0);
  g.restore();
}
function dispGeo() {
  const u = clamp((Hw - top) / 560, 0.62, 1.1), bw = 150 * u, bh = 175 * u, bx = W * 0.54, by = Hw - 24 - bh;
  return { u, box: { x: bx, y: by, w: bw, h: bh }, slot: { x: bx + 22 * u, y: by + 6 * u, w: bw - 44 * u, h: 18 * u }, sx: W * 0.42, sy: top + 60 + 200 * u };
}
function drawSharps(c, g, front) {
  const b = g.box, u = g.u;
  if (!front) {
    c.beginPath(); rrect(c, b.x - 4 * u, b.y - 6 * u, b.w + 8 * u, 32 * u, 8 * u); c.fillStyle = '#B83224'; c.fill();
    c.beginPath(); rrect(c, g.slot.x, g.slot.y, g.slot.w, g.slot.h, 6 * u); c.fillStyle = '#3A1410'; c.fill();
    return;
  }
  c.beginPath(); rrect(c, b.x, b.y + 22 * u, b.w, b.h - 22 * u, 10 * u);
  const gr = c.createLinearGradient(b.x, 0, b.x + b.w, 0); gr.addColorStop(0, '#E0523F'); gr.addColorStop(0.5, '#D23F2E'); gr.addColorStop(1, '#A92C1F');
  c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; c.stroke();
  c.beginPath(); rrect(c, b.x + 14 * u, b.y + 60 * u, b.w - 28 * u, 62 * u, 8 * u); c.fillStyle = '#FFFFFF'; c.fill();
  const tx = b.x + b.w / 2, ty = b.y + 80 * u;
  c.beginPath(); c.moveTo(tx, ty - 12 * u); c.lineTo(tx + 12 * u, ty + 9 * u); c.lineTo(tx - 12 * u, ty + 9 * u); c.closePath(); c.fillStyle = '#D23F2E'; c.fill();
  setFont(c, 800, 11 * u, 'normal'); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', tx, ty + 1.5 * u);
  setFont(c, 800, 10.5 * u, 'condensed'); c.fillStyle = '#A92C1F'; c.fillText(copy.sharps, tx, ty + 24 * u);
}
/* step 9: label and fridge */
function storeGeo() {
  const h = Hw - top, s = clamp((h - 60) / 150, 1.1, 2.5);
  return { s, vx: W * 0.27, vy: top + h * 0.55, fr: { x: W * 0.54, y: top + 24, w: W * 0.42, h: h - 48 }, st: { x: W * 0.27 + 26 * s, y: top + h * 0.55 - 20 * s, w: 96, h: 60 } };
}

/* step 1: clean */
function cleanGeo() {
  const h = Hw - top, sB = clamp(h / 430 * 2.1, 1.3, 2.5), sP = sB * 1.1, y = top + h * 0.56;
  return [{ kind: 'bac', x: W * 0.71, y, s: sB }, { kind: 'pep', x: W * 0.30, y: y + GEO.bac.bot * sB - GEO.pep.bot * sP, s: sP }];
}
/* step 3: draw */
function drawGeo() {
  const u = clamp((Hw - top - 30) / 454, 0.44, 1.05), capacity = V.syringe;
  const sB = 1.1 * u, by = top + 58 * sB;
  return { u, capacity, ppm: 46 * u * 3 / capacity, bac: { kind: 'bac', x: W * 0.46, y: by, s: sB }, tip: { x: W * 0.46, y: by + 53 * sB - 22 * sB } };
}
/* step 4: inject */
function injGeo() {
  const capacity = V ? V.syringe : 3, vol = V && V.drawn ? Math.min(capacity, V.drawn) : capacity;
  const fraction = clamp(vol / capacity, 0, 1), th = V && V.c && V.c.tilt !== undefined ? V.c.tilt : 0, x0 = W * 0.3;
  let u = clamp((Hw - top - 30) / (415 + 138 * fraction), 0.5, 1.2);
  const ppm = 46 * u * 3 / capacity;
  // zoom out as the vial tilts so the leaning syringe stays on screen
  const out = V && V.c && V.c.phase && (V.c.phase === 'tilt' || V.c.phase === 'insert') ? 1 - (V.c.ins || 0) : 0;
  const reach = Math.sin(th + 0.1) * (312 + 138 * fraction + 60 * out) + 40;
  u = Math.min(u, (W - 14 - x0) / reach);
  const sV = 2.4 * u;
  return { u, ppm, capacity, sV, vial: { kind: 'pep', x: x0, y: Hw - 26 - 44 * sV, s: sV }, tipL: { x: 6 * sV, y: -17 * sV }, ang: Math.PI - 0.1, lift: 60 * u, ln: 60 };
}
/* where the syringe is: vial-local and world points along its axis */
function syrPose(g, c) {
  const insP = c.phase === 'tilt' || c.phase === 'insert' ? c.ins : 1;
  const dx = -Math.sin(g.ang), dy = Math.cos(g.ang);              // from the needle tip toward the plunger
  const tip = { x: g.tipL.x + dx * g.lift * (1 - insP), y: g.tipL.y + dy * g.lift * (1 - insP) };
  const S0 = syringeGeo(g.u, g.ppm, g.ln, g.capacity), th = c.tilt;
  const at = (z) => rotP(tip.x + dx * z, tip.y + dy * z, th, g.vial.x, g.vial.y);
  const rodEnd = S0.z0 + c.rem * g.ppm + S0.stop + S0.rod;
  const nw = { x: -(dx * Math.cos(th) - dy * Math.sin(th)), y: -(dx * Math.sin(th) + dy * Math.cos(th)) }; // world unit vector toward the needle
  return { tip, insP, barA: at(S0.z0), barB: at(S0.zEnd), flange: at(S0.zEnd + 2.5 * g.u), thumb: at(rodEnd + 3 * g.u), nw, bw: S0.bw };
}
/* holding the plunger = pinching the finger flange, or the plunger rod above it */
/* the needle past the stopper, in the vial's own units, drawn behind the glass */
function drawInnerNeedle(gg, tx, ty, ang, stopY, w) {
  const dx = -Math.sin(ang), dy = Math.cos(ang); if (dy >= 0 || ty <= stopY) return;
  const len = (stopY - ty) / dy, bx = tx + dx * len, by = ty + dy * len;
  gg.save(); gg.lineCap = 'butt';
  gg.beginPath(); gg.moveTo(bx, by); gg.lineTo(tx - dx * w * 2.2, ty - dy * w * 2.2); gg.strokeStyle = '#9FAEB7'; gg.lineWidth = w * 1.8; gg.stroke();
  gg.beginPath(); gg.moveTo(bx + dy * w * 0.35, by - dx * w * 0.35); gg.lineTo(tx - dx * w * 2.2 + dy * w * 0.35, ty - dy * w * 2.2 - dx * w * 0.35); gg.strokeStyle = 'rgba(255,255,255,.55)'; gg.lineWidth = w * 0.45; gg.stroke();
  gg.beginPath(); gg.moveTo(tx - dx * w * 2.2 - dy * w * 0.9, ty - dy * w * 2.2 + dx * w * 0.9); gg.lineTo(tx - dx * w * 2.2 + dy * w * 0.9, ty - dy * w * 2.2 - dx * w * 0.9); gg.lineTo(tx, ty); gg.closePath(); gg.fillStyle = '#9FAEB7'; gg.fill();
  gg.restore();
}
const rotP = (x, y, a, cx, cy) => ({ x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a) });
/* step 5: mix */
function mixGeo() { const h = Hw - top, s = clamp((h - 84) / 124, 1.3, 3.4); return { kind: 'pep', x: W / 2, y: top + 18 + 62 * s, s }; }
function draw() {
  const c = ctx, s = sc * k;
  c.setTransform(s, 0, 0, s, 0, 0);
  if (bg) c.drawImage(bg.c, 0, 0, W, Hw);
  const key = STEPS[V.step].key, st = V.c, P = V.P;
  const bacCap = '#118CC4';
  if (key === 'clean' || key === 'find' || key === 'prep') {
    const [b0, b1] = cleanGeo();
    if (key === 'clean') {
      const zoom = 1 + 0.27 * ease(progressIn(V.elapsed, 0.2, 1.15));
      const pivotY = Math.max(42, b0.y + GEO.bac.crimp * b0.s);
      c.translate(W / 2, pivotY);
      c.scale(zoom, zoom);
      c.translate(-W / 2, -pivotY);
    }
    const cl = key === 'clean' ? st : key === 'prep' ? { caps: [0, 0], clean: [0, 0], phase: 'idle' } : { caps: [0, 0], clean: [1, 1], phase: 'idle' };
    const wet = (i) => cl.phase === 'dry' ? clamp(cl.dryT / 1.4, 0, 1) : cl.clean[i] >= 1 ? 1 : cl.clean[i] * 0.8;
    c.save();
    if (key === 'find') c.globalAlpha = 0.28;
    drawBottle(c, { ...b0, cap: cl.caps[0], capColor: bacCap, dirt: 1 - cl.clean[0], wet: key === 'clean' ? wet(0) : 0, name: 'Bacteriostatic Water', sub: '3 mL', color: bacCap, liquid: 0.9 });
    drawBottle(c, { ...b1, cap: cl.caps[1], capColor: P.color, dirt: 1 - cl.clean[1], wet: key === 'clean' ? wet(1) : 0, name: P.name, sub: `${P.mg} mg`, color: P.color, powder: 1, powderColor: P.powder, solutionColor: P.solution });
    c.restore();
    if (key === 'prep') {
      const reveal = ease(V.elapsed / 1.5);
      c.globalAlpha = reveal;
      drawPad(c, lerp(37, 58, reveal), Hw - 42, 0.85, 0);
      drawSyringe(c, { x: W * 0.93, y: Hw - 39, ang: Math.PI / 2, u: 0.60, ppm: 25, capacity: V.syringe, vol: 0, labels: true });
      c.globalAlpha = 1;
    }
    if (key === 'clean') {
      [b0, b1].forEach((b, i) => {
        const G = GEO[b.kind], hy = b.y + (cl.phase === 'caps' ? (G.cap + G.crimp) / 2 : G.crimp) * b.s;
        if (cl.phase === 'swab' && st.clean[i] > 0 && st.clean[i] < 1) {
          c.beginPath(); c.arc(b.x, b.y + G.bot * b.s + 16, 9, -Math.PI / 2, -Math.PI / 2 + TAU * st.clean[i]); c.strokeStyle = '#118CC4'; c.lineWidth = 3; c.stroke();
        }
        if (cl.phase === 'dry') { c.beginPath(); c.arc(b.x, hy, 18 * b.s * 0.8, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(st.dryT / 1.4, 0, 1)); c.strokeStyle = 'rgba(47,127,214,.7)'; c.lineWidth = 2.5; c.stroke(); }
      });
      if (st.pad) drawPad(c, st.pad.x, st.pad.y, 1.15, Math.min(1, (st.clean[0] + st.clean[1]) / 2 + 0.3));
    }
  } else if (key === 'draw') {
    const g = drawGeo();
    drawBottle(c, { ...g.bac, rot: Math.PI, cap: 1, dirt: 0, name: 'Bacteriostatic Water', sub: '3 mL', color: bacCap, liquid: 0.85 * (1 - st.vol / V.target),
      inner: (gg) => drawInnerNeedle(gg, 0, GEO.bac.crimp + (g.bac.y - GEO.bac.crimp * g.bac.s - g.tip.y) / g.bac.s, Math.PI, GEO.bac.crimp, g.u / g.bac.s) });
    const syr = { x: g.tip.x, y: g.tip.y, ang: 0, u: g.u, ppm: g.ppm, capacity: g.capacity, vol: st.vol, air: st.air, airTop: st.airTop, bubbles: st.bubbles, labels: true, target: V.marker ? V.target : undefined, thumbColor: st.drag ? '#CDEAF8' : '#F7FAFB' };
    const bacStopY = g.bac.y - GEO.bac.crimp * g.bac.s;
    c.save(); c.beginPath(); c.rect(0, bacStopY + 0.5, W, Hw); c.clip(); drawSyringe(c, syr); c.restore();
    // magnifier on the reading edge
    const S0 = syringeGeo(g.u, g.ppm, undefined, g.capacity), edgeY = g.tip.y + S0.z0 + st.vol * g.ppm;
    const R = 42 * g.u, Z = 2.3, lx = Math.min(W - R - 12, g.tip.x + 96 * g.u), ly = clamp(edgeY, top + R + 6, Hw - R - 30);
    c.save(); c.beginPath(); c.arc(lx, ly, R, 0, TAU); c.fillStyle = '#F7FAFB'; c.fill(); c.clip();
    c.translate(lx, ly); c.scale(Z, Z); c.translate(-g.tip.x, -edgeY); drawSyringe(c, syr); c.restore();
    c.beginPath(); c.arc(lx, ly, R, 0, TAU); c.lineWidth = 3; c.strokeStyle = '#123E59'; c.stroke();
    c.beginPath(); c.moveTo(lx - R, ly); c.lineTo(lx - R + 8, ly); c.moveTo(lx + R - 8, ly); c.lineTo(lx + R, ly); c.strokeStyle = '#D23F2E'; c.lineWidth = 2; c.stroke();
    setFont(c, 700, 10, 'normal'); c.fillStyle = '#527086'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(copy.zoom, lx, ly + R + 5);
    c.beginPath(); c.moveTo(g.tip.x + S0.bw / 2 + 3, edgeY); c.lineTo(lx - R, ly); c.strokeStyle = 'rgba(18,62,89,.25)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
  } else if (key === 'inject') {
    const g = injGeo(), th = st.tilt, sV = g.sV;
    const fill = st.inj / (V.vial * 1.2);
    const held = st.phase === 'inject';
    const pose = syrPose(g, st);
    const pinching = !!st.grabB || (st.phase === 'inject' && held);
    c.save(); c.translate(g.vial.x, g.vial.y); c.rotate(th);
    const tipX = pose.tip.x, tipY = pose.tip.y;
    const vialO = { kind: 'pep', x: 0, y: 0, s: sV, tilt: th, see: S.see, cap: 1, name: P.name, sub: `${P.mg} mg`, color: P.color, liquid: fill, powder: Math.max(0.35, 1 - 0.5 * st.inj / Math.max(0.5, V.drawn)), powderColor: P.powder, solutionColor: P.solution, cloud: 0.5 * Math.min(1, st.inj / Math.max(0.5, V.drawn)), foam: st.foam };
    const flowNow = st.phase === 'inject' ? st.flow : 0;
    const stopY = GEO.pep.crimp + 0.4;
    drawBottle(c, { ...vialO, inner: (gg) => { drawStream(gg, th, fill, flowNow, tipX / sV, tipY / sV, sV); drawInnerNeedle(gg, tipX / sV, tipY / sV, g.ang, stopY, g.u / sV); } });
    // the needle tip seen through the glass, below the rubber plug
    c.save(); c.scale(sV, sV); c.beginPath(); c.rect(-40, -24.2, 80, 40); c.clip(); c.globalAlpha = 0.75;
    drawInnerNeedle(c, tipX / sV, tipY / sV, g.ang, stopY, g.u / sV); c.restore();
    c.save(); c.beginPath(); c.rect(-3000, -4000, 6000, 4000 + stopY * sV); c.clip();
    drawSyringe(c, { x: tipX, y: tipY, ang: g.ang, u: g.u, ppm: g.ppm, ln: g.ln, capacity: g.capacity, vol: st.rem, air: V.airCarry > 0.015 && !st.airHit ? V.airCarry : 0, airTop: true, labels: false, thumbColor: held ? '#CDEAF8' : '#F7FAFB' });
    c.restore();
    c.restore();
    // fingertips pinching the flange and plunger, and prompts
    const f = pose.flange, n = pose.nw, pp = { x: -n.y, y: n.x }, ang2 = Math.atan2(n.y, n.x);
    if (pinching) {
      const tip3 = [
        { x: f.x + pp.x * (pose.bw / 2 + 12), y: f.y + pp.y * (pose.bw / 2 + 12) },
        { x: f.x - pp.x * (pose.bw / 2 + 12), y: f.y - pp.y * (pose.bw / 2 + 12) },
        { x: pose.thumb.x - n.x * 4, y: pose.thumb.y - n.y * 4 }
      ];
      for (const t of tip3) { c.save(); c.translate(t.x, t.y); c.rotate(ang2); c.beginPath(); c.ellipse(0, 0, 9, 6.5, 0, 0, TAU); c.fillStyle = 'rgba(236,198,172,.92)'; c.fill(); c.strokeStyle = 'rgba(120,78,58,.4)'; c.lineWidth = 1; c.stroke(); c.restore(); }
    }
  } else if (key === 'mix') {
    const g = mixGeo();
    drawBottle(c, { ...g, x: g.x + st.off.x, y: g.y + st.off.y, rot: st.off.x * 0.004, cap: 1, name: P.name, sub: `${P.mg} mg`, color: P.color, liquid: V.drawn / (V.vial * 1.2), cloud: 0.55 * (1 - st.prog), powder: 0.5 * Math.max(0, 1 - st.prog * 1.6), powderColor: P.powder, solutionColor: P.solution, specks: V.specks, foam: st.foam, jiggle: st.jiggle, vortex: st.vort, vphase: st.vphase, labelTop: true, see: S.see });
    const bw = 170, bx = g.x - bw / 2, by = Math.min(Hw - 34, g.y + 62 * g.s + 8);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); rrect(c, bx - 10, by - 8, bw + 20, 34, 12); c.fill();
    c.fillStyle = '#E3ECEF'; c.beginPath(); rrect(c, bx, by + 12, bw, 7, 4); c.fill();
    c.fillStyle = '#118CC4'; c.beginPath(); rrect(c, bx, by + 12, Math.max(7, bw * st.prog), 7, 4); c.fill();
    setFont(c, 700, 10.5, 'normal'); c.fillStyle = '#123E59'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText((st.prog < 1 ? (copy.lang === 'es' ? 'El polvo se disuelve' : 'Powder dissolving') : copy.dissolved), bx, by - 3);
  }
  else if (key === 'dispose') {
    const g = dispGeo(), u = g.u;
    drawSharps(c, g, false);
    if (st.drop < 1) {
      const dy = st.drop > 0 ? st.drop * 160 * u : 0;
      const capacity = V ? V.syringe : 3, ppm = 46 * u * 3 / capacity;
      drawSyringe(c, { x: st.tx, y: st.ty + dy, ang: st.ang, u, ppm, capacity, vol: 0, labels: false, thumbColor: st.grab ? '#CDEAF8' : '#F7FAFB' });
    }
    drawSharps(c, g, true);
  } else if (key === 'inspect') {
    const avail = Hw - 30 - top;
    const s2 = clamp(avail / 100, 0.9, 3), vx = W / 2, vy = top + 4 + avail / 2 - 16 * st.lift;
    const glow = c.createRadialGradient(vx, vy, 10, vx, vy, 68 * s2); glow.addColorStop(0, 'rgba(255,250,226,.95)'); glow.addColorStop(1, 'rgba(255,250,226,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(vx, vy, 68 * s2, 0, TAU); c.fill();
    drawBottle(c, { kind: 'pep', x: vx, y: vy, s: s2, cap: 1, name: P.name, sub: `${P.mg} mg`, color: P.color, liquid: V.drawn / (V.vial * 1.2), powderColor: P.powder, solutionColor: P.solution, foam: V.foam, see: S.see });
  } else if (key === 'store') {
    const g = storeGeo(), s2 = g.s, fr = g.fr;
    c.beginPath(); rrect(c, fr.x, fr.y, fr.w, fr.h, 14);
    const fg = c.createLinearGradient(fr.x, 0, fr.x + fr.w, 0); fg.addColorStop(0, '#FFFFFF'); fg.addColorStop(1, '#E1EAEE');
    c.fillStyle = fg; c.fill(); c.strokeStyle = 'rgba(18,62,89,.25)'; c.lineWidth = 1.2; c.stroke();
    const inn = { x: fr.x + 10, y: fr.y + 44, w: fr.w - 20, h: fr.h - 58 };
    c.beginPath(); rrect(c, inn.x, inn.y, inn.w, inn.h, 10); c.fillStyle = '#EAF6FB'; c.fill(); c.strokeStyle = 'rgba(18,62,89,.12)'; c.stroke();
    [0.5, 0.78].forEach(f => { c.beginPath(); c.moveTo(inn.x + 4, inn.y + inn.h * f); c.lineTo(inn.x + inn.w - 4, inn.y + inn.h * f); c.strokeStyle = 'rgba(18,62,89,.18)'; c.lineWidth = 2; c.stroke(); });
    c.beginPath(); rrect(c, fr.x + fr.w / 2 - 36, fr.y + 11, 72, 24, 6); c.fillStyle = '#123E59'; c.fill();
    setFont(c, 800, 12, 'normal'); c.fillStyle = '#8FD3A8'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('2\u20138 \u00B0C', fr.x + fr.w / 2, fr.y + 23.5);
    let vx = g.vx + st.off.x, vy = g.vy + st.off.y, vs = s2;
    if (st.inF >= 0) { const e = Math.min(1, st.inF); vx = lerp(vx, inn.x + inn.w / 2, e); vy = lerp(vy, inn.y + inn.h * 0.5 - 44 * s2 * 0.55, e); vs = lerp(s2, s2 * 0.55, e); }
    drawBottle(c, { kind: 'pep', x: vx, y: vy, s: vs, cap: 1, name: P.name, sub: `${P.mg} mg`, color: P.color, liquid: V.drawn / (V.vial * 1.2), powderColor: P.powder, solutionColor: P.solution });
    const lines = [`${copy.mixed} ${prettyDate(new Date())}`, `+${fmtMl(V.target)} mL ${copy.water}`, P.conc];
    const onVial = { x: vx - 17 * vs, y: vy + 14 * vs, w: 34 * vs, h: 19 * vs };
    const drawSticker = (r, full, chars) => {
      c.save(); c.shadowColor = 'rgba(18,62,89,.25)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
      c.beginPath(); rrect(c, r.x, r.y, r.w, r.h, Math.min(8, r.h * 0.2)); c.fillStyle = '#FFFDF6'; c.fill(); c.restore();
      c.strokeStyle = 'rgba(18,62,89,.2)'; c.lineWidth = 1; c.beginPath(); rrect(c, r.x, r.y, r.w, r.h, Math.min(8, r.h * 0.2)); c.stroke();
      if (full) {
        let left = chars, fs = r.h * 0.19; setFont(c, 700, fs, 'normal');
        const widest = Math.max(...lines.map(ln => c.measureText(ln).width)); if (widest > r.w * 0.86) { fs *= r.w * 0.86 / widest; setFont(c, 700, fs, 'normal'); }
        c.fillStyle = '#123E59'; c.textAlign = 'left'; c.textBaseline = 'middle';
        lines.forEach((ln, i) => { const t = ln.slice(0, Math.max(0, left)); left -= ln.length; c.fillText(t, r.x + r.w * 0.07, r.y + r.h * (0.25 + i * 0.25)); });
      } else { c.strokeStyle = 'rgba(18,62,89,.35)'; c.lineWidth = Math.max(0.6, r.h * 0.05); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(r.x + r.w * 0.12, r.y + r.h * (0.3 + i * 0.22)); c.lineTo(r.x + r.w * (0.88 - i * 0.12), r.y + r.h * (0.3 + i * 0.22)); c.stroke(); } }
    };
    const total = lines.join('').length;
    if (st.phase === 'write' || st.phase === 'writing') {
      drawSticker(g.st, true, st.phase === 'write' ? 0 : Math.floor(total * st.wr));
    } else if (st.phase === 'apply') {
      const e = st.apply, r = { x: lerp(g.st.x, onVial.x, e), y: lerp(g.st.y, onVial.y, e), w: lerp(g.st.w, onVial.w, e), h: lerp(g.st.h, onVial.h, e) };
      drawSticker(r, true, total);
    } else drawSticker(onVial, true, total);
  }
}

// Each scene receives elapsed playback time. Time spent paused or offscreen is excluded.
const copy = new URLSearchParams(location.search).get('lang') === 'es' ? {
  lang: 'es', play: 'Reproducir', pause: 'Pausar', resume: 'Continuar', replay: 'Repetir',
  complete: 'Demostración completa', ready: 'Lista para reproducir',
  error: 'No se pudo cargar la demostración.',
  zoom: 'Ampliación', sharps: 'PUNZOCORTANTES', dissolved: 'Disuelto', mixed: 'Mezclado', water: 'de agua',
  reference: 'Referencia rápida', volume: 'AGUA BACTERIOSTÁTICA A AÑADIR', concentration: 'CONCENTRACIÓN',
  note: 'Demostración de laboratorio con tiempo acelerado',
  count: (index, total) => `Paso ${index} de ${total}`,
  captions: [
    ['Prepara el espacio', 'Revisa las etiquetas y reúne el material.'],
    ['Consulta el protocolo', 'Comprueba el agua y la concentración del vial seleccionado.'],
    ['Limpia los tapones', 'Retira las tapas, limpia los tapones y deja secar.'],
    ['Mide el agua', 'Observa cómo sube el líquido en la jeringa.'],
    ['Añade el agua', 'Observa cómo baja el líquido por la pared del vial.'],
    ['Desecha la jeringa', 'La jeringa va al contenedor de punzocortantes.'],
    ['Disuelve el polvo', 'Gira el vial suavemente y observa cómo se disuelve el polvo.'],
    ['Revisa la solución', 'Sostén el vial a la luz para ver si quedan partículas.'],
    ['Etiqueta y guarda el vial', 'Anota la fecha y sigue las indicaciones de almacenamiento.']
  ]
} : {
  lang: 'en', play: 'Play', pause: 'Pause', resume: 'Resume', replay: 'Replay',
  complete: 'Demo complete', ready: 'Ready to play',
  error: 'The demo couldn’t load.',
  zoom: 'Zoom', sharps: 'SHARPS', dissolved: 'Dissolved', mixed: 'Mixed', water: 'BAC water',
  reference: 'Quick reference', volume: 'BAC WATER TO ADD', concentration: 'CONCENTRATION',
  note: 'Time-lapse lab demonstration',
  count: (index, total) => `Step ${index} of ${total}`,
  captions: [
    ['Set up the workspace', 'Check the vial labels and lay out the supplies.'],
    ['Check the protocol', 'Check the water amount and concentration for the selected vial.'],
    ['Clean the stoppers', 'Remove the caps, wipe the stoppers, and let them dry.'],
    ['Measure the water', 'Watch the liquid rise in the syringe.'],
    ['Add the water', 'Watch the liquid run down the inside wall of the vial.'],
    ['Discard the syringe', 'The syringe goes straight into the sharps container.'],
    ['Dissolve the powder', 'Gently swirl the vial and watch the powder dissolve.'],
    ['Inspect the solution', 'Hold the vial to the light to check for particles.'],
    ['Label and store it', 'Record the date and follow the storage directions.']
  ]
};

const STEPS = [
  { key: 'prep', duration: 5 },
  { key: 'find', duration: 6 },
  { key: 'clean', duration: 6.8 },
  { key: 'draw', duration: 4.6 },
  { key: 'inject', duration: 7.7 },
  { key: 'dispose', duration: 4.5 },
  { key: 'mix', duration: 5.2 },
  { key: 'inspect', duration: 4.5 },
  { key: 'store', duration: 4.5 }
];
const totalTime = STEPS.reduce((total, step) => total + step.duration, 0);
const progressIn = (time, start, duration) => clamp((time - start) / duration, 0, 1);
const ease = (value) => value * value * (3 - 2 * value);
const top = 20;
const S = { real: 0, see: 0 };
let V;
let frameId = null;
let last;
let inView = false;
let playback = 'waiting';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const board = document.querySelector('#board');
const ctx = board.getContext('2d');
const player = document.querySelector('#player');
const heading = document.querySelector('#step-title');
const detail = document.querySelector('#step-detail');
const count = document.querySelector('#step-count');
const reference = document.querySelector('#reference');
const progress = document.querySelector('#progress');
const toggle = document.querySelector('#toggle');
const replay = document.querySelector('#replay');
const chapterList = document.querySelector('#chapters ol');
const clock = document.querySelector('#clock');
const speed = document.querySelector('#speed');
const phaseStarts = STEPS.map((_, i) => STEPS.slice(0, i).reduce((sum, step) => sum + step.duration, 0));
const stamp = time => Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0');
const labels = { pep: new Image(), bac: new Image() };

function animateClean(time) {
  const caps = [ease(progressIn(time, 0.3, 0.5)), ease(progressIn(time, 0.94, 0.5))];
  const clean = [progressIn(time, 1.65, 1.05), progressIn(time, 2.95, 1.05)];
  const phase = time < 1.5 ? 'caps' : time < 4.05 ? 'swab' : 'dry';
  let pad = null;
  if (phase === 'swab') {
    const [water, peptide] = cleanGeo();
    // A new swab enters the frame for the second vial.
    const bottle = time < 2.82 ? water : peptide;
    const localTime = time - (time < 2.82 ? 1.5 : 2.82);
    const enter = ease(progressIn(localTime, 0, 0.17));
    const leave = ease(progressIn(localTime, 1.05, 0.18));
    pad = {
      x: bottle.x + Math.sin(localTime * 18) * 8,
      y: bottle.y + GEO[bottle.kind].crimp * bottle.s - 4 - 55 * (1 - enter + leave)
    };
  }
  V.c = { caps, clean, phase, pad, flip: caps.map(Boolean), dryT: Math.max(0, 5.25 - time) };
}

function animateTransfer(time) {
  const tilt = 0.52 * ease(progressIn(time, 0.35, 1.15));
  const ins = ease(progressIn(time, 1.5, 0.9));
  const poured = ease(progressIn(time, 2.4, 4.75));
  const phase = time < 1.5 ? 'tilt' : ins < 1 ? 'insert' : 'inject';
  const flow = poured > 0 && poured < 1 ? Math.sin(Math.PI * poured) * 0.54 + 0.12 : 0;
  V.c = { tilt, ins, phase, inj: V.target * poured, rem: V.target * (1 - poured), flow, grabB: phase === 'insert' };
}

function animateDisposal(time) {
  const scene = dispGeo();
  const move = ease(progressIn(time, 0.24, 1.35));
  const drop = progressIn(time, 1.65, 0.55);
  V.c = {
    tx: lerp(scene.sx, scene.slot.x + scene.slot.w / 2, move),
    ty: lerp(scene.sy, scene.slot.y - 8 * scene.u, move),
    ang: lerp(Math.PI - 0.55, Math.PI, move),
    drop: time < 1.65 ? -1 : drop
  };
}

function animateMix(time) {
  const prog = ease(progressIn(time, 0.5, 4.1));
  const spin = Math.sin(Math.PI * progressIn(time, 0.05, 5.02));
  const angle = time * 6;
  const off = { x: Math.cos(angle) * 20 * spin, y: Math.sin(angle) * 12 * spin };
  for (const speck of V.specks) {
    speck.a = speck.angle + angle * 0.8;
    speck.on = speck.th > prog;
  }
  V.c = { prog, off, vort: spin * 0.72, vphase: angle };
}

function animateStore(time) {
  const wr = progressIn(time, 0.2, 1.05);
  const apply = ease(progressIn(time, 1.45, 1.05));
  const intoFridge = ease(progressIn(time, 2.85, 1.1));
  const phase = time < 1.45 ? 'writing' : time < 2.65 ? 'apply' : 'fridge';
  V.c = { phase, wr, apply, inF: intoFridge, off: { x: 0, y: 0 } };
}

function poseScene() {
  const key = STEPS[V.step].key;
  const time = V.elapsed;
  S.see = key === 'mix' || key === 'inject' || key === 'inspect' ? 1 : 0;
  switch (key) {
    case 'clean': animateClean(time); break;
    case 'draw': V.c = { vol: V.target * ease(progressIn(time, 0.5, 3.5)), air: 0 }; break;
    case 'inject': animateTransfer(time); break;
    case 'dispose': animateDisposal(time); break;
    case 'mix': animateMix(time); break;
    case 'inspect': V.c = { lift: ease(progressIn(time, 0.25, 1.2)) }; break;
    case 'store': animateStore(time); break;
    default: V.c = {};
  }
}

const choice = document.querySelector('#vial-choice');
const opening = document.querySelector('.opening-photo');
const sceneStill = document.querySelector('#scene-still');
let selected;

function sceneImage(step) {
  const photo = selected.photo ? '../product-photos/' + selected.photo : '';
  const original = selected.name === 'GHK-Cu' && selected.mg === 50;
  if (step === 'prep' || step === 'find') return original ? '../article-covers/reconstitution.webp' : photo;
  if (step === 'clean') return '../protocol-art/swabs.webp';
  if (step === 'inject') return '../product-photos/bacteriostatic-water-10ml.webp';
  if (step === 'draw' && selected.ml > 3) return '../product-photos/bacteriostatic-water-10ml.webp';
  if (['mix','store'].includes(step) && !original) return photo;
  return './scenes/' + step + '.webp';
}

function updatePhotos(step) {
  const src = sceneImage(step);
  for (const image of [opening,sceneStill]) {
    image.hidden = !src;
    if (src && image.getAttribute('src') !== src) image.src = src;
  }
  player.dataset.packshot = String(src.includes('product-photos'));
}

function setScene(index) {
  updatePhotos(STEPS[index].key);
  V.step = index;
  V.elapsed = 0;
  player.dataset.step = STEPS[index].key;
  chapterList.querySelector('[aria-current]')?.removeAttribute('aria-current');
  chapterList.children[index]?.firstElementChild.setAttribute('aria-current', 'step');
  count.textContent = copy.count(index + 1, STEPS.length);
  heading.textContent = copy.captions[index][0];
  detail.textContent = copy.captions[index][1];
  reference.hidden = STEPS[index].key !== 'find';
  reference.classList.remove('emphasize');
  poseScene();
}

const cleanCues = copy.lang === 'es'
  ? ['Retira las tapas para ver los tapones.', 'Limpia el primer tapón.', 'Usa una toallita nueva para el segundo tapón.', 'Deja secar ambos tapones al aire.']
  : ['Remove the caps to expose the stoppers.', 'Wipe the first stopper.', 'Use a fresh swab for the second stopper.', 'Let both stoppers air-dry.'];

function update() {
  poseScene();
  if (STEPS[V.step].key === 'find') reference.classList.toggle('emphasize', V.elapsed > 0.85);
  if (STEPS[V.step].key === 'clean') {
    const line = cleanCues[V.elapsed < 1.5 ? 0 : V.elapsed < 2.82 ? 1 : V.elapsed < 4.05 ? 2 : 3];
    if (detail.textContent !== line) detail.textContent = line;
  }
  progress.value = String(S.real);
  clock.textContent = stamp(S.real) + ' / ' + stamp(totalTime);
  progress.setAttribute('aria-valuetext', stamp(S.real) + ' — ' + heading.textContent);
}

function frame(now) {
  frameId = null;
  const dt = last === undefined ? 0 : Math.min((now - last) / 1000, 0.1);
  last = now;
  const advance = dt * Number(speed.value);
  S.real += advance;
  V.elapsed += advance;

  if (V.elapsed >= STEPS[V.step].duration) {
    if (V.step === STEPS.length - 1) {
      V.elapsed = STEPS[V.step].duration;
      S.real = totalTime;
      setPlayback('complete');
      count.textContent = copy.complete;
      update();
      draw();
      return;
    }
    const overrun = V.elapsed - STEPS[V.step].duration;
    setScene(V.step + 1);
    V.elapsed = overrun;
  }

  update();
  draw();
  scheduleFrame();
}

function scheduleFrame() {
  if (playback === 'playing' && inView && !document.hidden && frameId === null) {
    frameId = requestAnimationFrame(frame);
  }
}

function stopFrame() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  last = undefined;
}

function setPlayback(state) {
  playback = state;
  player.dataset.playback = state;
  toggle.textContent = {
    waiting: copy.play, playing: copy.pause, paused: copy.resume, complete: copy.replay
  }[state];
  if (state === 'playing') scheduleFrame();
  else stopFrame();
}

function syncVisibility() {
  if (playback === 'waiting' && inView && !reducedMotion.matches) setPlayback('playing');
  if (inView && !document.hidden) scheduleFrame();
  else stopFrame();
}

function restart() {
  stopFrame();
  S.real = 0;
  progress.value = 0;
  setScene(0);
  draw();
  setPlayback('playing');
}

function layout() {
  const width = board.clientWidth;
  const height = board.clientHeight;
  if (!width || !height || !V) return;
  k = Math.min(devicePixelRatio || 1, 2);
  sc = width / W;
  Hw = height / sc;
  board.width = Math.round(width * k);
  board.height = Math.round(height * k);
  buildBg();
  poseScene();
  draw();
}

async function boot() {
  document.documentElement.lang = copy.lang;
  document.title = copy.lang === 'es' ? 'Demostración de reconstitución | One Aminos' : 'Reconstitution Demo | One Aminos';
  const spanish = copy.lang === 'es';
  document.querySelector('#speed-label').textContent = spanish ? 'Velocidad' : 'Speed';
  const download = document.querySelector('#film-download');
  download.href = './reconstitution-' + copy.lang + '.mp4';
  download.textContent = spanish ? 'Descargar vídeo (MP4)' : 'Download video (MP4)';
  const chaptersTitle = spanish ? 'Capítulos' : 'Chapters';
  document.querySelector('#chapter-title').textContent = chaptersTitle;
  document.querySelector('#chapters').setAttribute('aria-label', chaptersTitle);
  progress.setAttribute('aria-label', copy.lang === 'es' ? 'Progreso' : 'Playback progress');
  progress.max = totalTime;
  toggle.textContent = copy.play;
  replay.textContent = copy.lang === 'es' ? 'Reiniciar' : 'Restart';
  count.textContent = copy.ready;

  labels.pep.src = './peptide-label.webp';
  labels.bac.src = './water-label.webp';

  try {
    const response = await fetch('/api/demo-products/');
    if (!response.ok) throw new Error('Product list unavailable');
    const products = await response.json();
    const requested = new URLSearchParams(location.search).get('product');
    selected = products.find(product => product.slug === requested) ||
      products.find(product => product.name === 'GHK-Cu' && product.mg === 50);
    for (const product of products) choice.add(new Option(product.name + ' · ' + product.mg + ' mg', product.slug));
    choice.value = selected.slug;
    choice.disabled = false;
    document.querySelector('#choice-title').textContent = spanish ? 'Péptido y cantidad por vial' : 'Peptide and vial strength';
    V = {
      P: {},
      specks: Array.from({ length: 34 }, () => ({
        x: Math.random() * 1.7 - 0.85, y: 0.15 + Math.random() * 0.8,
        r: 0.5 + Math.random() * 0.9, th: Math.random(), angle: Math.random() * TAU,
        rad: 0.15 + Math.random() * 0.8
      }))
    };
    const applySelection = () => {
      V.P = {name: selected.name, mg: selected.mg, conc: selected.conc, powder: '#999', solution: '#777'};
      V.target = V.drawn = selected.ml;
      V.syringe = selected.syringe_ml;
      V.vial = selected.vial_ml;
      document.querySelector('#product').textContent = selected.name + ' ' + selected.mg + ' mg';
      document.querySelector('#volume-value').textContent = fmtMl(selected.ml) + ' mL';
      document.querySelector('#concentration-value').textContent = selected.conc;
      download.textContent = spanish ? 'Vídeo de ejemplo · GHK-Cu 50 mg (MP4)' : 'Example video · GHK-Cu 50 mg (MP4)';
    };
    applySelection();
    choice.addEventListener('change', () => {
      selected = products.find(product => product.slug === choice.value);
      applySelection();
      const url = new URL(location.href);
      url.searchParams.set('product', selected.slug);
      history.replaceState(null, '', url);
      seek(phaseStarts[1]);
      setPlayback('paused');
    });
    await Promise.allSettled(Object.values(labels).map((label) => label.decode()));
  } catch (error) {
    count.textContent = copy.error;
    return;
  }

  document.querySelector('#product').textContent = `${V.P.name} ${V.P.mg} mg`;
  document.querySelector('#volume-key').textContent = copy.volume;
  document.querySelector('#volume-value').textContent = `${fmtMl(V.target)} mL`;
  document.querySelector('#concentration-key').textContent = copy.concentration;
  document.querySelector('#concentration-value').textContent = V.P.conc;
  reference.querySelector('h2').textContent = copy.reference;

  function seek(time) {
    stopFrame();
    S.real = clamp(time, 0, totalTime);
    const index = phaseStarts.findLastIndex(start => start <= S.real);
    setScene(index);
    V.elapsed = S.real - phaseStarts[index];
    update();
    draw();
    if (S.real >= totalTime) setPlayback('complete');
    else if (playback === 'complete' || playback === 'waiting') setPlayback('paused');
    else scheduleFrame();
  }
  copy.captions.forEach(([title], index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = title;
    const time = document.createElement('span');
    time.textContent = stamp(phaseStarts[index]);
    button.append(time);
    button.addEventListener('click', () => seek(phaseStarts[index]));
    item.append(button);
    chapterList.append(item);
  });
  progress.addEventListener('input', () => seek(Number(progress.value)));
  toggle.disabled = replay.disabled = false;
  setScene(0);
  update();
  layout();
  new ResizeObserver(layout).observe(board);
  if (window.parent !== window) {
    new ResizeObserver(() => {
      window.parent.postMessage({ type: 'oa-demo-height', height: player.offsetHeight }, location.origin);
    }).observe(player);
  }
  // IntersectionObserver also clips the target against the containing iframe and page.
  new IntersectionObserver(([entry]) => {
    inView = entry.intersectionRatio >= 0.42;
    syncVisibility();
  }, { threshold: [0.42] }).observe(document.querySelector('.stage'));
  document.addEventListener('visibilitychange', syncVisibility);
  toggle.addEventListener('click', () => {
    if (playback === 'complete' || playback === 'waiting') restart();
    else setPlayback(playback === 'playing' ? 'paused' : 'playing');
  });
  replay.addEventListener('click', restart);
}

boot();
