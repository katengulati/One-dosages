/**
 * Presentation adapter for the allowlisted public catalog only.
 * It never reads the catalog seed, guesses a compound, or promotes review state.
 */
function pdExplorerProjectCatalog(config) {
  const raw = config && config.catalog;
  const strings = value => Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];
  const rows = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.values(value) : [];
  const scopes = ['human_research','regulated_label','formulation_context','case_report','preclinical','mechanistic','related_molecule','component_context','site_identity','site_context'];
  const localURL = value => {
    if (typeof value !== 'string' || !value) return '';
    try { const u = new URL(value, config.site_url || location.origin);
      return /^https?:$/.test(u.protocol) && u.origin === new URL(config.site_url || location.origin).origin && !u.username && !u.password ? u.href : '';
    } catch (_) { return ''; }
  };
  const sourceURL = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; }
  };
  const D = {base:'',asOf:'',scopes,t:[],c:[],e:[],s:[],protocolCount:0,pendingCount:0,available:!!(raw && Array.isArray(raw.protocols)),revision:raw?.revision || ''};
  if (!D.available) return D;
  const sourceIndex=new Map(), topicIndex=new Map(), compoundIndex=new Map(), publicCompounds=new Map(), publicTopics=new Map();
  rows(raw.sources).forEach(value => {
    const url=sourceURL(value.url);
    if (typeof value.id !== 'string' || typeof value.title !== 'string' || !url) return;
    sourceIndex.set(value.id,D.s.length); D.s.push([value.title,Number.isFinite(value.year)?value.year:null,url]);
  });
  rows(raw.topics).forEach(value => { if(typeof value.id==='string' && typeof value.label==='string')publicTopics.set(value.id,value); });
  rows(raw.compounds).forEach(value => { if(typeof value.id==='string' && typeof value.name==='string')publicCompounds.set(value.id,value); });
  const types={single:'Single peptide protocol',blend:'Premixed blend protocol',stack:'Separate-vial stack protocol'};
  const seenPages=new Set();
  for(const p of raw.protocols) {
    const url=localURL(p?.url), id=Number(p?.page_id);
    if(!url || !Number.isInteger(id) || id<1 || seenPages.has(id) || typeof p.title!=='string')continue;
    seenPages.add(id); D.protocolCount++;
    const approved=typeof p.compound_id==='string' ? publicCompounds.get(p.compound_id) : null;
    const key=approved ? approved.id : 'protocol-page-'+id;
    if(!compoundIndex.has(key)) {
      const art=approved ? localURL(approved.article_url) : '';
      const name=approved ? approved.name : p.title.replace(/\s+Dosage\s+Protocol$/i,'').trim();
      const row=[name,approved?strings(approved.aliases):[],approved?.type || types[p.kind] || 'Published protocol',approved?.summary || '',art,[],[],key,'',approved?.evidence_note || ''];
      row.push(!approved, !approved);
      compoundIndex.set(key,D.c.length);D.c.push(row);
    }
    const c=D.c[compoundIndex.get(key)];
    c[5].push([approved && typeof p.strength==='string' && p.strength ? p.strength : p.title,url]);
    if(!c[8])c[8]=url;
  }
  // Article-only identities are accepted only when the public API supplies a live article URL.
  for(const c of publicCompounds.values()) {
    if(compoundIndex.has(c.id))continue;
    const article=localURL(c.article_url);
    if(!article)continue;
    compoundIndex.set(c.id,D.c.length);
    D.c.push([c.name,strings(c.aliases),c.type || 'Research article',c.summary || '',article,[],[],c.id,article,c.evidence_note || '',false,false]);
  }
  for(const [id,ci] of compoundIndex) {
    const source=publicCompounds.get(id); if(!source)continue;
    for(const association of Array.isArray(source.associations)?source.associations:[]) {
      const topic=publicTopics.get(association.topic_id); if(!topic)continue;
      const evidence=(Array.isArray(association.evidence)?association.evidence:[]).filter(e=>scopes.includes(e.scope));
      if(!evidence.length)continue;
      const scopeMask=evidence.reduce((mask,e)=>mask | (1<<scopes.indexOf(e.scope)),0);
      const refs=[...new Set(evidence.flatMap(e=>strings(e.source_ids)).filter(id=>sourceIndex.has(id)).map(id=>sourceIndex.get(id)))];
      const notes=[...new Set([...strings(association.context_notes),...evidence.map(e=>e.note).filter(n=>typeof n==='string' && n)])];
      const sourceScopes=evidence.map(e=>({scope:e.scope,refs:strings(e.source_ids).filter(id=>sourceIndex.has(id)).map(id=>sourceIndex.get(id))}));
      if(!topicIndex.has(topic.id)){
        const kinds=strings(topic.kinds);
        const kind=kinds.some(k=>['research_topic','discovery_topic','clinical_context','related_molecule_topic'].includes(k))?0:kinds.includes('mechanism')?1:2;
        topicIndex.set(topic.id,D.t.length);D.t.push([topic.label,strings(topic.aliases),kind,topic.id]);
      }
      D.e.push([ci,topicIndex.get(topic.id),scopeMask,refs,notes,sourceScopes]);
    }
    const components=Array.isArray(source.components)?source.components:[];
    D.c[ci][6]=components.filter(part=>part && typeof part.name==='string').map(part=>[compoundIndex.has(part.compound_id)?compoundIndex.get(part.compound_id):-1,part.name]);
  }
  const connected=new Set(D.e.map(e=>e[0]));
  D.c.forEach((c,i)=>{c[10]=!connected.has(i);if(c[10])D.pendingCount++;});
  return D;
}

(() => {
'use strict';

/* ------------------------------------------------------------------ data */
const CONFIG = JSON.parse(document.getElementById('pd-data').textContent);
const D = pdExplorerProjectCatalog(CONFIG);
const FONT = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u03b1-\u03c9]+/g, ' ').trim();
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = mulberry(20261001);

const SC = D.scopes;
const SCOPE_UI = {
  human_research: ['Human research', 'A human study exists for this connection. It may be small, negative or limited to one group, so it is not proof of a benefit.', 'a'],
  regulated_label: ['Drug label', 'From a regulated medicine\u2019s label for a specific use. It does not make a research vial equivalent.', 'a'],
  formulation_context: ['Formulation study', 'Studied as part of a specific formulation, not as the isolated ingredient.', 'a'],
  case_report: ['Case report', 'Reported in individual cases. It does not show cause and effect.', 'a'],
  preclinical: ['Preclinical', 'Animal or cell research, including human-derived cell cultures.', 'b'],
  mechanistic: ['Mechanism', 'Research on a mechanism or target, not on an outcome.', 'b'],
  related_molecule: ['Related molecule', 'Research on a parent compound, an analog or a different formulation. It is not direct evidence for this compound.', 'b'],
  component_context: ['Via ingredient', 'Research on an ingredient of this blend or stack, not on the combination itself.', 'c'],
  site_identity: ['Classification', 'Describes what the compound is or how it is classified.', 'c'],
  site_context: ['Discovery topic', 'A curated topic associated with this entry. It is not independently established by the sources selected for this connection.', 'c'],
};

const T = D.t.map((r, i) => ({ i, label: r[0], aliases: r[1], kind: r[2], id: r[3], comps: [], n: norm(r[0]), an: r[1].map(norm) }));
const C = D.c.map((r, i) => ({ i, name: r[0], aliases: r[1], type: r[2], summary: r[3], art: r[4], prots: r[5], parts: r[6], id: r[7], main: r[8], context: r[9] || '', pending: !!r[10], protocolOnly: !!r[11], tags: [], partOf: [], n: norm(r[0]), an: r[1].map(norm) }));
const EDGE = new Map();
for (const [ci, ti, mask, refs, notes = [], sourceScopes = []] of D.e) { C[ci].tags.push(ti); T[ti].comps.push(ci); EDGE.set(`${ci}:${ti}`, { mask, refs, notes, sourceScopes }); }
for (const c of C) for (const [pi] of c.parts) if (pi >= 0 && pi !== c.i && !C[pi].partOf.includes(c.i)) C[pi].partOf.push(c.i);
const S = D.s;
const tagById = new Map(T.map(t => [t.id, t]));
const compById = new Map(C.map(c => [c.id, c]));
const MAXC = Math.max(2, ...T.map(t => t.comps.length));
const edge = (ci, ti) => EDGE.get(`${ci}:${ti}`);
const bestScope = mask => { for (let i = 0; i < SC.length; i++) if (mask & (1 << i)) return i; return SC.length - 1; };
const scopesOf = mask => SC.map((s, i) => (mask & (1 << i)) ? i : -1).filter(i => i >= 0);
const srcUrl = u => u.startsWith('pm:') ? 'https://pubmed.ncbi.nlm.nih.gov/' + u.slice(3) + '/' : u;
const pageUrl = rel => /^https?:/.test(rel) ? rel : D.base + rel;
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const cap = s => (/^[a-z][a-z]*(\s|-|$)/.test(s) ? s[0].toUpperCase() + s.slice(1) : s);

/* --------------------------------------------------------------- words */
const words = [];
function mkWord(kind, ref, text) {
  const w = {
    kind, ref, text, i: words.length,
    x: 0, y: 0, s: 0, a: 0, vx: 0, vy: 0, vs: 0,
    tx: 0, ty: 0, ts: 0, ta: 0, wt: 400, cw: 400, go: 0,
    role: 0, depth: .5,
    ph1: rand() * 6.283, ph2: rand() * 6.283, f1: .6 + rand() * .7, f2: .6 + rand() * .7,
    hl: 0, hlT: 0, dim: 0, dimT: 0, sh: 0, shT: 0, hf: 0,
    mw: null, dx: 0, dy: 0, ds: 0, dw: 0, dh: 0, alpha: 0, fk: '', font: '',
  };
  words.push(w);
  return w;
}
T.forEach(t => { t.w = mkWord('t', t, t.label); });
C.forEach(c => { c.w = mkWord('c', c, c.name); });

const mctx = document.createElement('canvas').getContext('2d');
// The font has an optical-size axis that browsers apply automatically, so glyph widths change with
// font size. Measure every word at five sizes and two weights, then interpolate.
const MS = [12, 20, 32, 52, 96], LMS = MS.map(Math.log);
function measureAll() {
  for (const w of words) {
    const m = new Float32Array(10);
    MS.forEach((sz, k) => {
      mctx.font = `300 ${sz}px ${FONT}`; m[k] = mctx.measureText(w.text).width * 100 / sz;
      mctx.font = `800 ${sz}px ${FONT}`; m[5 + k] = mctx.measureText(w.text).width * 100 / sz;
    });
    w.mw = m;
  }
}
function textW(w, size, wt) {
  const ls = Math.log(clamp(size, 12, 96)), m = w.mw;
  let k = 0; while (k < 3 && ls > LMS[k + 1]) k++;
  const f = (ls - LMS[k]) / (LMS[k + 1] - LMS[k]);
  const a3 = m[k] + (m[k + 1] - m[k]) * f, a8 = m[5 + k] + (m[6 + k] - m[5 + k]) * f;
  return size / 100 * (a3 + (a8 - a3) * (wt - 300) / 500);
}
function weightFor(size, kind) {
  const k = clamp((size - 12) / 48, 0, 1), e = k * k * (3 - 2 * k);
  let wt = 370 + 420 * e;
  if (kind === 'c') wt = Math.min(800, wt + 90);
  if (compactMQ.matches) wt = Math.max(500, wt);
  return Math.round(wt / 10) * 10;
}
function fitSize(w, size, wt, maxW) {
  const tw = textW(w, size, wt);
  const fitted = tw > maxW ? size * maxW / tw : size;
  // Long labels that cannot fit at a readable size are omitted from the cloud,
  // not reduced to tiny type. Their full text remains in search, List and details.
  return compactMQ.matches ? Math.max(12, fitted) : fitted;
}

/* ------------------------------------------------------------- packing */
// Occupancy-grid packer: each word takes the free spot nearest the centre (by a slightly noisy
// superellipse distance), checked in O(1) with a summed-area table. Largest words go first.
const orderCache = new Map();
function cellOrder(gw, gh, seed) {
  const key = gw + 'x' + gh + ':' + seed;
  if (orderCache.has(key)) return orderCache.get(key);
  // counting sort on a quantised distance keeps this linear
  const rnd = mulberry(seed), n = gw * gh, NB = 2048, bucket = new Int32Array(n), cnt = new Int32Array(NB + 1);
  for (let j = 0; j < gh; j++) {
    const v = Math.pow(Math.abs((j + .5) / gh * 2 - 1), 2.4);
    for (let i = 0; i < gw; i++) {
      const u = Math.pow(Math.abs((i + .5) / gw * 2 - 1), 2.4);
      const d = Math.pow(u + v, 1 / 2.4) * (1 + (rnd() - .5) * .1) / 1.35;
      const bk = Math.min(NB - 1, (d * NB) | 0), k = j * gw + i;
      bucket[k] = bk; cnt[bk + 1]++;
    }
  }
  for (let q = 1; q <= NB; q++) cnt[q] += cnt[q - 1];
  const idx = new Int32Array(n);
  for (let k = 0; k < n; k++) idx[cnt[bucket[k]]++] = k;
  if (orderCache.size > 12) orderCache.clear();
  orderCache.set(key, idx);
  return idx;
}
function pack(items, B, seed, maxUp) {
  if (B.w <= 0 || B.h <= 0) return [];
  const mobile = compactMQ.matches;
  const res = Math.max(3, Math.sqrt(B.w * B.h / 48000));
  const gw = Math.max(8, Math.floor(B.w / res)), gh = Math.max(6, Math.floor(B.h / res)), n = gw * gh, W1 = gw + 1;
  const occ = new Uint8Array(n), rp = new Int32Array(gh * W1);
  for (let j = 0; j < gh; j++) {
    const v = (j + .5) / gh * 2 - 1, v4 = v * v * v * v;
    for (let i = 0; i < gw; i++) { const u = (i + .5) / gw * 2 - 1; if (u * u * u * u + v4 > 1) occ[j * gw + i] = 1; }
  }
  const rowPrefix = (j, from) => {
    const o = j * gw, r = j * W1; let acc = rp[r + from];
    for (let i = from; i < gw; i++) { acc += occ[o + i]; rp[r + i + 1] = acc; }
  };
  for (let j = 0; j < gh; j++) rowPrefix(j, 0);
  const ord = cellOrder(gw, gh, seed).slice();
  let len = n;
  const compact = () => { let m = 0; for (let k = 0; k < len; k++) { const c = ord[k]; if (!occ[c]) ord[m++] = c; } len = m; };
  compact();
  const out = []; let fails = 0;
  const cxCell = gw >> 1, cyCell = gh >> 1;
  for (const it of items) {
    const tw = textW(it.w, it.size, it.wt), th = it.size * .88;
    const pad = mobile ? 2 + it.size * .07 : 2 + it.size * .085;
    // Compact labels use a dense map; the touch preview magnifies the current
    // word without enlarging every hit area or shifting its neighbours.
    const cw = Math.ceil((tw + pad * 2) / res);
    const ch = Math.ceil((mobile ? th + pad * 1.2 : th + pad) / res);
    const hx = cw >> 1, hy = ch >> 1;
    const free = (ci, cj) => {
      const x0 = ci - hx, y0 = cj - hy, x1 = x0 + cw, y1 = y0 + ch;
      if (x0 < 0 || y0 < 0 || x1 > gw || y1 > gh) return false;
      for (let j = y0; j < y1; j++) { const r = j * W1; if (rp[r + x1] !== rp[r + x0]) return false; }
      return true;
    };
    let px = -1, py = -1;
    if (cw <= gw && ch <= gh) {
      if (it.fixed && free(cxCell, cyCell)) { px = cxCell; py = cyCell; }
      else {
        for (let k = 0; k < len; k++) {
          const c = ord[k];
          if (occ[c]) continue;
          const cj = (c / gw) | 0, ci = c - cj * gw;
          if (free(ci, cj)) { px = ci; py = cj; break; }
        }
      }
    }
    if (px < 0) { if (it.opt && ++fails >= 12 && !mobile) break; continue; }
    fails = 0;
    const x0 = px - hx, y0 = py - hy;
    for (let j = y0; j < y0 + ch; j++) { occ.fill(1, j * gw + x0, j * gw + x0 + cw); rowPrefix(j, x0); }
    out.push({ w: it.w, x: B.x + (x0 + cw / 2) * res, y: B.y + (y0 + ch / 2) * res, size: it.size, wt: it.wt, role: it.role || 1, hw: mobile ? tw / 2 + pad : tw / 2, hh: mobile ? th / 2 + pad * .6 : th / 2 });
    if (out.length % 8 === 0) compact();
  }
  if (!out.length) return out;
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of out) { x0 = Math.min(x0, o.x - o.hw); x1 = Math.max(x1, o.x + o.hw); y0 = Math.min(y0, o.y - o.hh); y1 = Math.max(y1, o.y + o.hh); }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const s = clamp(Math.min(B.w * .96 / (x1 - x0), B.h * .94 / (y1 - y0)), 1, maxUp || 1);
  for (const o of out) { o.x = cx + (o.x - mx) * s; o.y = cy + (o.y - my) * s; o.size *= s; }
  return out;
}

/* ------------------------------------------------------------- layouts */
function sizeRange(B) {
  const area = B.w * B.h, small = B.w < 560 || B.h < 360;
  if (compactMQ.matches) return { area, minF: 12, maxF: clamp(Math.sqrt(area) * .067, 22, 30) };
  return { area, minF: small ? 13 : 14, maxF: clamp(Math.sqrt(area) * (small ? .09 : .076), 32, 68) };
}
function cloudBudget(B) { return compactMQ.matches ? clamp(Math.floor(B.w * B.h / 800), 16, 160) : Infinity; }
// Equal counts get equal sizes; the scale is geometric so only the broadest topics get large.
function curve(c, minF, maxF, k) { return minF * Math.pow(maxF / minF, Math.pow((c - 1) / (MAXC - 1), compactMQ.matches ? 6 : .7) * (k || 1)); }
function depthFor(size, minF, maxF) { return clamp(1 - Math.log(size / minF) / Math.log(maxF * .6 / minF), 0, 1); }

function layoutIdle(B) {
  const { area, minF, maxF } = sizeRange(B);
  const limit = cloudBudget(B);
  const h = i => mulberry(i * 7919 + 13)();
  const cands = T.slice().sort((a, b) => b.comps.length - a.comps.length || a.kind - b.kind || h(a.i) - h(b.i));
  const items = []; let used = 0;
  for (const t of cands) {
    if (items.length >= limit) break;
    let size = curve(t.comps.length, minF, B.w < 560 ? maxF * .9 : maxF, t.kind === 2 ? .82 : 1);
    const wt = weightFor(size, 't');
    size = fitSize(t.w, size, wt, B.w * .9);
    used += textW(t.w, size, wt) * size * 1.42;
    if (used > area * (compactMQ.matches ? 1.5 : 1.02)) break;
    items.push({ w: t.w, size, wt, opt: true });
  }
  return finish(pack(items, B, 7, 1.12), minF, maxF);
}

function layoutTag(t, B) {
  const { area, minF, maxF } = sizeRange(B);
  const limit = cloudBudget(B);
  const items = [];
  let cs = maxF * 1.04, cw = weightFor(cs, 't');
  cs = fitSize(t.w, cs, cw, B.w * .8);
  items.push({ w: t.w, size: cs, wt: cw, fixed: true, role: 2 });
  const comps = t.comps.map(ci => C[ci]).sort((a, b) => bestScope(edge(a.i, t.i).mask) - bestScope(edge(b.i, t.i).mask) || a.name.localeCompare(b.name));
  const sumLen = comps.reduce((s, c) => s + c.name.length, 0);
  const compF = clamp(Math.sqrt(area * .26 / (.66 * sumLen + 1)), minF, Math.max(minF + 2, Math.min(26, maxF * .5)));
  let used = textW(t.w, cs, cw) * cs * 1.5;
  for (const c of comps) {
    if (items.length >= limit) break;
    const wt = weightFor(compF, 'c'), size = fitSize(c.w, compF, wt, B.w * .9);
    used += textW(c.w, size, wt) * size * 1.5;
    items.push({ w: c.w, size, wt });
  }
  const ov = new Map();
  for (const c of comps) for (const ti of c.tags) if (ti !== t.i) ov.set(ti, (ov.get(ti) || 0) + 1);
  const rel = [...ov].sort((a, b) => b[1] - a[1] || T[b[0]].comps.length - T[a[0]].comps.length || a[0] - b[0]);
  const maxOv = rel.length ? rel[0][1] : 1;
  for (const [ti, o] of rel) {
    if (items.length >= limit) break;
    const k = maxOv > 1 ? (o - 1) / (maxOv - 1) : 0;
    const tw = T[ti].w;
    let size = minF + (maxF * .5 - minF) * Math.pow(k, .85), wt = weightFor(size, 't');
    size = fitSize(tw, size, wt, B.w * .9);
    used += textW(tw, size, wt) * size * 1.42;
    if (used > area * .7) break;
    items.push({ w: tw, size, wt, opt: true });
  }
  return finish(pack(items, B, 101 + t.i, 1.3), minF, maxF);
}

function relatedComps(c) {
  const seen = new Set([c.i]), out = [];
  const push = (i, why) => { if (i >= 0 && !seen.has(i)) { seen.add(i); out.push({ i, why }); } };
  c.parts.forEach(([pi]) => push(pi, 'part'));
  c.partOf.forEach(pi => push(pi, 'in'));
  const ov = new Map(), mine = new Set(c.tags);
  for (const ti of c.tags) for (const ci of T[ti].comps) if (ci !== c.i) ov.set(ci, (ov.get(ci) || 0) + 1);
  [...ov].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6).forEach(([ci]) => push(ci, 'overlap'));
  return out.slice(0, 9);
}

function layoutComp(c, B) {
  const { area, minF, maxF } = sizeRange(B);
  const limit = cloudBudget(B);
  const items = [];
  let cs = maxF * .95, cw = weightFor(cs, 'c');
  cs = fitSize(c.w, cs, cw, B.w * .82);
  items.push({ w: c.w, size: cs, wt: cw, fixed: true, role: 2 });
  const tags = c.tags.map(ti => T[ti]).sort((a, b) => b.comps.length - a.comps.length || a.label.localeCompare(b.label));
  for (const t of tags) {
    if (items.length >= limit) break;
    let size = curve(t.comps.length, minF + 1.5, maxF * .5), wt = weightFor(size, 't');
    size = fitSize(t.w, size, wt, B.w * .9);
    items.push({ w: t.w, size, wt });
  }
  for (const r of relatedComps(c)) {
    if (items.length >= limit) break;
    const w = C[r.i].w, size0 = clamp(maxF * .24, minF, 18), wt = weightFor(size0, 'c');
    items.push({ w, size: fitSize(w, size0, wt, B.w * .9), wt, opt: true });
  }
  return finish(pack(items, B, 503 + c.i, 1.6), minF, maxF);
}

function finish(out, minF, maxF) {
  for (const o of out) o.depth = o.role === 2 ? 0 : o.w.kind === 'c' ? Math.min(.3, depthFor(o.size, minF, maxF)) : depthFor(o.size, minF, maxF);
  return out;
}

/* ---------------------------------------------------------------- state */
const app = $('app'), cv = $('cloud'), ctx = cv.getContext('2d'), tipEl = $('tip'), live = $('live');
const panel = $('panel'), pbody = $('pbody'), backBtn = $('back'), closeBtn = $('close');
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const compactMQ = matchMedia('(max-width: 820px), (max-height: 500px) and (max-width: 1100px)');
let VW = 0, VH = 0, DPR = 1;
let B = { x: 0, y: 0, w: 100, h: 100 };
let view = { type: 'idle' };
const hist = [];
let panelOpen = false, sheet = 'half';
let cloudAvailable = true;
let touchSession = null;
const ptr = { x: -1e4, y: -1e4, inside: false, overUI: false };
const lens = { x: 0, y: 0, s: 0 }, par = { x: 0, y: 0 };
let hovered = null, assocHover = null, assocTimer = 0, focused = null, hot = null, qMatches = null, filterScope = -1;
let baseLinks = [], hoverLinks = [], hoverLinkF = 0, linkKey = '';
let center = null, pulse = null, ready = false, time = 0;
let userPaused = false, displayMode = T.length ? 'cloud' : 'list', browseType = T.length ? 'topics' : 'compounds', browseLimit = 72;
let focusOrigin = null, keyboardMode = false;
const motion = () => !reduceMQ.matches && !userPaused;
document.addEventListener('keydown', () => { keyboardMode = true; }, true);
document.addEventListener('pointerdown', () => { keyboardMode = false; }, true);

function sheetPx(state) {
  const barHeight = document.querySelector('.bar').offsetHeight;
  const available = Math.max(0, VH - barHeight - 8);
  if (state === 'peek') return Math.min(170, available);
  if (state === 'full') return available;
  return Math.min(available, Math.round(VH * .54), Math.max(80, available - 112));
}
function computeBounds() {
  const compact = compactMQ.matches;
  const bar = document.querySelector('.bar').getBoundingClientRect();
  const foot = document.querySelector(compact ? '.foot' : '.legend').getBoundingClientRect();
  const origin = app.getBoundingClientRect();
  const top = bar.bottom - origin.top + (compact ? 6 : 14);
  let bottom = foot.top - origin.top - (compact ? 6 : 12);
  app.style.setProperty('--panel-top', `${top + 3}px`);
  app.style.setProperty('--browse-top', `${top}px`);
  let left = compact ? 8 : 26, right = VW - (compact ? 8 : 26);
  if (panelOpen && !compact) right = VW - panel.offsetWidth - parseFloat(getComputedStyle(panel).right) - 20;
  if (panelOpen && compact) bottom = VH - sheetPx(sheet) - 6;
  B = { x: left, y: top, w: Math.max(compact ? 0 : 120, right - left), h: Math.max(compact ? 0 : 90, bottom - top) };
  cloudAvailable = !compact || (B.w >= 160 && B.h >= 96);
  app.style.setProperty('--cloud-right', Math.max(0, VW - right) + 'px');
  app.classList.toggle('is-cloud-cramped', !cloudAvailable);
  updateSheetButton();
}

/* ------------------------------------------------------------ transitions */
function relayout(opts = {}) {
  if (!ready) return;
  cancelTouchPreview();
  computeBounds();
  let placed;
  if (!cloudAvailable) placed = [];
  else if (view.type === 'tag') placed = layoutTag(T[view.i], B);
  else if (view.type === 'comp') placed = layoutComp(C[view.i], B);
  else placed = layoutIdle(B);
  apply(placed, opts);
  buildLinks();
  updateEmphasis();
  wake();
}

function apply(placed, opts) {
  const now = performance.now();
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  const maxD = Math.hypot(B.w, B.h) / 2;
  const inSet = new Set();
  center = null;
  placed.forEach((p, n) => {
    const w = p.w; inSet.add(w);
    const entering = w.ta === 0 && w.a < .04;
    w.tx = p.x; w.ty = p.y; w.ts = p.size; w.wt = p.wt; w.role = p.role; w.depth = p.depth; w.ta = 1;
    if (p.role === 2) center = w;
    const d = Math.hypot(p.x - cx, p.y - cy) / maxD;
    if (entering) {
      const k = compactMQ.matches ? 1 : opts.intro ? .04 : .82;
      w.x = cx + (p.x - cx) * k; w.y = cy + (p.y - cy) * k;
      w.s = p.size * (compactMQ.matches ? 1 : opts.intro ? .25 : .6); w.cw = p.wt; w.vx = w.vy = w.vs = 0; w.a = 0;
      if (opts.intro && !compactMQ.matches) { w.x += (rand() - .5) * 30; w.y += (rand() - .5) * 20; }
    }
    if (opts.instant || !motion()) { w.x = p.x; w.y = p.y; w.s = p.size; w.vx = w.vy = w.vs = 0; w.cw = p.wt; }
    w.go = motion() ? now + (opts.intro ? 90 + n * 2.4 + d * 260 : p.role === 2 ? 0 : 40 + d * 200 + rand() * 70) : now;
    if (!motion()) w.a = 1;
  });
  for (const w of words) {
    if (inSet.has(w) || (w.ta === 0 && w.a < .01)) continue;
    w.ta = 0; w.role = 0;
    if (!motion()) { w.a = 0; continue; }
    w.tx = cx + (w.x - cx) * 1.1; w.ty = cy + (w.y - cy) * 1.1; w.ts = w.ts || w.s; w.go = now + rand() * 90;
  }
  if (center && !opts.intro && motion()) pulse = { w: center, t0: now + 160 };
}

function buildLinks() {
  baseLinks = [];
  if (!center) return;
  if (view.type === 'tag') for (const ci of T[view.i].comps) { const w = C[ci].w; if (w.ta) baseLinks.push([center, w, .2]); }
  if (view.type === 'comp') for (const ti of C[view.i].tags) { const w = T[ti].w; if (w.ta) baseLinks.push([center, w, .085]); }
}

// Words connected to w (other kind) that are on screen right now.
function connectedVisible(w) {
  const out = [];
  if (w.kind === 'c') { for (const ti of w.ref.tags) if (T[ti].w.ta) out.push(T[ti].w); }
  else for (const ci of w.ref.comps) if (C[ci].w.ta) out.push(C[ci].w);
  return out;
}
function relatedTagsOf(t) {
  const set = new Set();
  for (const ci of t.comps) for (const ti of C[ci].tags) set.add(T[ti].w);
  return set;
}

function updateEmphasis() {
  wake();
  const src = hot || focused || hovered;
  let emph = null, teal = null, links = [];
  if (qMatches && qMatches.size) { emph = qMatches; teal = qMatches; }
  else if (src && view.type !== 'idle' && src.ta) {
    emph = new Set([src]);
    if (center) emph.add(center);
    for (const w of connectedVisible(src)) { emph.add(w); if (src !== center && w !== center) links.push([src, w]); }
    if (src !== center && (src.kind !== center?.kind)) links.push([src, center]);
  } else if (assocHover && view.type === 'idle') {
    emph = relatedTagsOf(assocHover.ref);
  }
  const fl = filterScope >= 0 && view.type === 'tag' ? filterScope : -1;
  for (const w of words) {
    let d = emph ? (emph.has(w) ? 0 : (view.type === 'idle' && !qMatches ? .72 : 1)) : 0;
    if (fl >= 0 && w.kind === 'c' && w.role === 1) {
      const e = edge(w.ref.i, view.i);
      if (!e || !(e.mask & (1 << fl))) d = Math.max(d, .85);
    }
    w.dimT = d;
    w.shT = teal && teal.has(w) ? 1 : 0;
    w.hlT = w === src ? 1 : 0;
  }
  const key = links.map(l => l[0].i + '-' + l[1].i).join(',');
  if (key !== linkKey) { linkKey = key; hoverLinks = links; hoverLinkF = 0; }
  // mirror in the panel
  pbody.querySelectorAll('.row.is-hot').forEach(r => r.classList.remove('is-hot'));
  if (src && src.kind === 'c') { const r = pbody.querySelector(`.row[data-c="${src.ref.i}"]`); if (r) r.classList.add('is-hot'); }
}

/* --------------------------------------------------------------- physics */
function update(dt, now) {
  const m = motion();
  const K = 150, Dm = 2 * Math.sqrt(K) * .8;
  const fa = 1 - Math.exp(-dt * 7.5), fo = 1 - Math.exp(-dt * 10), fh = 1 - Math.exp(-dt * 13), fw = 1 - Math.exp(-dt * 5);
  for (const w of words) {
    if (w.ta === 0 && w.a < .002) { w.a = 0; continue; }
    if (now >= w.go) {
      if (m) {
        let ac = K * (w.tx - w.x) - Dm * w.vx; w.vx += ac * dt; w.x += w.vx * dt;
        ac = K * (w.ty - w.y) - Dm * w.vy; w.vy += ac * dt; w.y += w.vy * dt;
        const ts = w.ta ? w.ts : w.ts * .8;
        ac = K * (ts - w.s) - Dm * w.vs; w.vs += ac * dt; w.s += w.vs * dt;
      } else { w.x = w.tx; w.y = w.ty; w.s = w.ta ? w.ts : w.s; }
      w.a += (w.ta - w.a) * (w.ta > w.a ? fa : fo);
      w.cw += (w.wt - w.cw) * fw;
    }
    w.dim += (w.dimT - w.dim) * fo;
    w.hl += (w.hlT - w.hl) * fh;
    w.sh += (w.shT - w.sh) * fh;
  }
  // lens follows a smoothed pointer and eases in and out
  const lensOn = ptr.inside && !ptr.overUI && fineMQ.matches && m;
  lens.s += ((lensOn ? 1 : 0) - lens.s) * (1 - Math.exp(-dt * 5));
  const fl = 1 - Math.exp(-dt * 15);
  if (lensOn) { lens.x += (ptr.x - lens.x) * fl; lens.y += (ptr.y - lens.y) * fl; }
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  const fp = 1 - Math.exp(-dt * 3);
  par.x += ((lensOn ? ptr.x - cx : 0) - par.x) * fp;
  par.y += ((lensOn ? ptr.y - cy : 0) - par.y) * fp;
  hoverLinkF += (1 - hoverLinkF) * (1 - Math.exp(-dt * 7));
}

/* -------------------------------------------------------------- drawing */
const INK = [24, 62, 89], SOFT = [67, 105, 130], COR = [207, 57, 46], CORS = [199, 95, 78], TEAL = [13, 116, 174], COR_D = [172, 39, 32];
function lensR() { return clamp(Math.min(B.w, B.h) * .24, 120, 220); }

function place(w) {
  let X = w.x, Y = w.y, s = w.s;
  if (motion()) {
    const amp = compactMQ.matches ? .9 : 1.2 + 2.4 * w.depth;
    X += Math.sin(time * .42 * w.f1 + w.ph1) * amp;
    Y += Math.cos(time * .35 * w.f2 + w.ph2) * amp * .7;
    const near = 1 - w.depth, k = .005 + .016 * near;
    X -= par.x * k; Y -= par.y * k;
  }
  let lf = 0, room = 1;
  if (lens.s > .002) {
    // Long-tailed radial push: r' = r(1 + A·g), g = 1/(1+(r/σ)²). Space opens near the pointer and the
    // slight compression is spread far out, so nothing piles up at a lens edge. Each word may only grow
    // as much as the push opens up around it, which keeps neighbours from touching.
    const sig = lensR() * .55, A = .5 * lens.s;
    const dx = X - lens.x, dy = Y - lens.y, q2 = (dx * dx + dy * dy) / (sig * sig);
    const g = 1 / (1 + q2), tang = 1 + A * g, rad = 1 + A * (1 - q2) * g * g;
    X = lens.x + dx * tang; Y = lens.y + dy * tang;
    room = Math.min(tang, rad);
    lf = g * lens.s;
    const want = 1 + clamp(16.5 / Math.max(s, 1) - 1, 0, .6) * lf;
    s *= Math.min(want, Math.max(room, .9));
  }
  if (w.hl > .002) s *= 1 + Math.max(0, Math.min(s < 30 ? .06 : .025, room - 1 + .02)) * w.hl;
  if (compactMQ.matches) s = Math.max(12, s);
  w.hf = lf; w.dx = X; w.dy = Y; w.ds = s;
  w.dw = textW(w, s, w.cw) / 2; w.dh = s * .44;
}

function colorOf(w) {
  const soft = w.role === 2 ? 0 : w.depth * (1 - w.hf) * (1 - w.sh) * .95;
  let c = w.kind === 'c' ? mix(COR, CORS, soft * .7) : mix(INK, SOFT, soft);
  const h = Math.max(w.hl, w.sh);
  if (h > .002) c = mix(c, w.kind === 'c' ? COR_D : TEAL, h);
  return c;
}

function edgeT(w, dx, dy) {
  const hw = w.dw + 6, hh = w.dh + 5;
  return Math.min(Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : 1e9);
}
function drawLink(a, b, alpha, width, dot) {
  const dx = b.dx - a.dx, dy = b.dy - a.dy;
  if (Math.hypot(dx, dy) < 2) return;
  const ea = edgeT(a, dx, dy), eb = edgeT(b, -dx, -dy) * (dot ? 1 : 1.25);
  if (ea + eb >= .98) return;
  const sx = a.dx + dx * ea, sy = a.dy + dy * ea, ex = b.dx - dx * eb, ey = b.dy - dy * eb;
  const bend = dot ? .12 : .07;
  const qx = (sx + ex) / 2 - (ey - sy) * bend, qy = (sy + ey) / 2 + (ex - sx) * bend;
  if (dot) ctx.strokeStyle = `rgba(10,135,147,${alpha})`;
  else {
    // ambient rays fade out before they reach the word, so they never read as underlines
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, `rgba(10,135,147,${alpha})`); g.addColorStop(.7, `rgba(10,135,147,${alpha * .45})`); g.addColorStop(1, 'rgba(10,135,147,0)');
    ctx.strokeStyle = g;
  }
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(qx, qy, ex, ey); ctx.stroke();
  if (dot) { ctx.fillStyle = `rgba(10,135,147,${Math.min(1, alpha * 1.8)})`; ctx.beginPath(); ctx.arc(ex, ey, 1.9, 0, 6.2832); ctx.fill(); }
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const drawList = [];
const glowEl = $('glow'); let glowOn = false;
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  if (!ready) return;
  if (!cloudAvailable) { drawList.length = 0; return; }
  // soft light that follows the pointer: a composited DOM layer, so it costs the canvas nothing
  if (lens.s > .01 || glowOn) {
    glowOn = lens.s > .01;
    const R = lensR() * 1.8;
    glowEl.style.opacity = glowOn ? lens.s.toFixed(3) : '0';
    glowEl.style.transform = `translate3d(${(lens.x - R).toFixed(1)}px,${(lens.y - R).toFixed(1)}px,0) scale(${(R / 200).toFixed(3)})`;
  }
  drawList.length = 0;
  for (const w of words) {
    if (w.a < .004 || w.s < .5) continue;
    place(w);
    const depthFade = w.role === 2 ? 1 : 1 - .12 * w.depth * (1 - w.hf) * (1 - w.sh);
    w.alpha = w.a * (1 - .84 * w.dim) * depthFade;
    w.z = w.hl > .5 ? 4 : w.role === 2 ? 3 : w.dim > .5 ? 0 : w.kind === 'c' ? 2 : 1;
    drawList.push(w);
  }
  drawList.sort((a, b) => a.z - b.z);

  // halo behind the selected word
  if (center && center.a > .01) {
    const c = center, rx = c.dw * 1.2 + 26, ry = c.dh * 2.6 + 16;
    ctx.save(); ctx.translate(c.dx, c.dy); ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1), col = c.kind === 'c' ? '238,75,66' : '10,135,147';
    g.addColorStop(0, `rgba(${col},${.12 * c.a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  if (pulse && motion()) {
    const p = (now - pulse.t0) / 1000;
    if (p >= 1) pulse = null;
    else if (p > 0) {
      const c = pulse.w, e = 1 - Math.pow(1 - p, 3), pad = 8 + e * 40;
      ctx.strokeStyle = c.kind === 'c' ? `rgba(238,75,66,${.45 * (1 - p) * (1 - p)})` : `rgba(10,135,147,${.45 * (1 - p) * (1 - p)})`;
      ctx.lineWidth = 1.5;
      rrect(c.dx - c.dw - pad, c.dy - c.dh - pad * .7, (c.dw + pad) * 2, (c.dh + pad * .7) * 2, c.dh + pad * .7); ctx.stroke();
    }
  }
  // connection threads
  const hovering = hoverLinks.length > 0;
  for (const [a, b, al] of baseLinks) {
    const k = Math.min(a.a, b.a) * (1 - .55 * b.dim) * (hovering ? .45 : 1);
    if (k > .01) drawLink(a, b, al * k, 1, false);
  }
  for (const [a, b] of hoverLinks) {
    const k = Math.min(a.a, b.a) * hoverLinkF;
    if (k > .01) drawLink(a, b, .55 * k, 1.25, true);
  }
  // words
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const w of drawList) {
    if (w.alpha < .004) continue;
    const fs = w.ts || w.s, wq = Math.round(w.cw / 20) * 20, key = wq + '|' + fs;
    if (w.fk !== key) { w.fk = key; w.font = `${wq} ${fs.toFixed(2)}px ${FONT}`; }
    ctx.font = w.font;
    const sc = w.ds / fs, c = colorOf(w);
    ctx.setTransform(DPR * sc, 0, 0, DPR * sc, w.dx * DPR, (w.dy + w.ds * .04) * DPR);
    ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${w.alpha.toFixed(3)})`;
    ctx.fillText(w.text, 0, 0);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (focused && focused.a > .05) {
    const f = focused;
    ctx.strokeStyle = 'rgba(10,135,147,.9)'; ctx.lineWidth = 2;
    rrect(f.dx - f.dw - 8, f.dy - f.dh - 6, (f.dw + 8) * 2, (f.dh + 6) * 2, 10); ctx.stroke();
  }
  positionTip();
}

/* ------------------------------------------------------------------ tip */
let tipFor = null;
const short = s => { const m = s.match(/^(.{0,120}?[.!?])(\s|$)/); return m ? m[1] : s.length > 120 ? s.slice(0, 117).replace(/\s+\S*$/, '') + '\u2026' : s; };
function tipHTML(w) {
  if (w.kind === 't') {
    const t = w.ref; let sub = plural(t.comps.length, 'compound', 'compounds');
    if (view.type === 'tag' && w.role === 1) {
      const mine = T[view.i].comps, n = t.comps.filter(ci => mine.includes(ci)).length;
      sub = `${n} shared`;
    } else if (view.type === 'comp' && w.role === 1) {
      const e = edge(view.i, t.i);
      if (e) sub = SCOPE_UI[SC[bestScope(e.mask)]][0];
    }
    return esc(sub);
  }
  const c = w.ref;
  return `<b>${esc(c.name)}</b><span class="tip-s">${esc(short(c.summary))}</span>`;
}
function showTip(w) {
  if (w === tipFor) return;
  tipFor = w;
  if (!w || (!fineMQ.matches && w !== focused)) { tipEl.classList.remove('on'); return; }
  tipEl.innerHTML = tipHTML(w);
  tipEl.classList.toggle('mini', w.kind === 't');
  tipEl.classList.add('on');
  positionTip();
}
function positionTip() {
  const w = tipFor;
  if (!w || !tipEl.classList.contains('on')) return;
  if (w.a < .3) { tipEl.classList.remove('on'); tipFor = null; return; }
  const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let x, y;
  if (w.kind === 't') { x = w.dx + w.dw - Math.min(tw * .55, w.dw); y = w.dy - w.dh - th - 1; if (x + tw > VW - 8) x = VW - 8 - tw; if (y < 6) y = w.dy + w.dh + 4; }
  else { x = w.dx - tw / 2; y = w.dy - w.dh - th - 14; if (y < 8) y = w.dy + w.dh + 14; }
  x = clamp(x, 8, VW - tw - 8);
  tipEl.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
}

/* --------------------------------------------------------------- panel */
const NOTE = 'A connection marks a topic that has been researched or covered for a compound. It is not a proven benefit or a recommendation.';
const ICON_MAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.6"/><circle cx="19.5" cy="5" r="1.6"/><circle cx="18.5" cy="18.5" r="1.6"/><circle cx="5" cy="18" r="1.6"/><path d="M6 7l4 3.4M17.9 6.2l-4 3.9M16.9 17.2l-3-3.2M6.4 16.8l3.6-3"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const listJoin = arr => arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
const noteHTML = () => `<p class="p-note">${NOTE} Protocol links follow the current published catalog.</p>`;

function evPill(i) { const [l, d, tone] = SCOPE_UI[SC[i]]; return `<span class="ev tone-${tone}" title="${esc(d)}">${l}<span class="sr-only">. ${esc(d)}</span></span>`; }
function contextHTML(notes) { return notes?.length ? `<details class="edge-context"><summary>About this connection</summary>${notes.map(n => `<p>${esc(n)}</p>`).join('')}</details>` : ''; }
function srcLi(k) {
  const [title, year, u] = S[k];
  return `<li><a href="${esc(srcUrl(u))}" target="_blank" rel="noopener">${esc(title)}</a>${year ? ` <span class="yr">${year}</span>` : ''}</li>`;
}
function edgeSourceLi(k, e) {
  const labels = [...new Set((e.sourceScopes || []).filter(item=>item.refs.includes(k)).map(item=>SCOPE_UI[item.scope]?.[0]).filter(Boolean))];
  return srcLi(k).replace('</li>', labels.length ? '<span class="source-scope">Connection context: ' + esc(labels.join(', ')) + '</span></li>' : '</li>');
}
function protPills(c) {
  const MAX = 6, list = c.prots, cut = list.length > MAX + 1;
  let h = list.map((p, k) => `<a class="pill" href="${esc(pageUrl(p[1]))}" target="_top" data-open="${c.i}" data-kind="protocol"${cut && k >= MAX ? ' hidden' : ''}>${esc(p[0])}</a>`).join('');
  if (cut) h += `<button class="pill" type="button" data-more>+${list.length - MAX} more</button>`;
  return h;
}
function compBtn(i, name) {
  return i >= 0 ? `<button type="button" data-comp="${i}" data-hot-c="${i}">${esc(name || C[i].name)}</button>` : `<span class="np">${esc(name)}</span>`;
}
function rowHTML(c, e) {
  const refs = e.refs || [];
  return `<li class="row" data-c="${c.i}" data-scopes="${e.mask}">
<div class="row-head"><button class="row-name" type="button" data-comp="${c.i}" aria-label="Explore ${esc(c.name)}">${esc(c.name)}</button><button class="row-map" type="button" data-comp="${c.i}" aria-label="Show the topics connected to ${esc(c.name)}" title="Show its topics">${ICON_MAP}</button></div>
<p class="row-type">${esc(c.type)}</p>
<p class="row-sum">${esc(c.summary)}</p>
<div class="row-ev">${scopesOf(e.mask).map(evPill).join('')}${refs.length ? `<button class="src-btn" type="button" aria-expanded="false">${plural(refs.length, 'source', 'sources')}${ICON_DOWN}</button>` : ''}</div>
${refs.length ? `<ol class="srcs" hidden>${refs.map(k => edgeSourceLi(k, e)).join('')}</ol>` : ''}
${contextHTML(e.notes)}
${c.prots.length ? `<div class="row-links"><span class="pl">${c.prots.length > 1 ? 'Protocols' : 'Protocol'}</span>${protPills(c)}</div>` : ''}
${!c.prots.length && c.art ? `<a class="overview-link" href="${esc(pageUrl(c.art))}" target="_top" data-open="${c.i}" data-kind="article">Read research overview ↗</a>` : ''}
</li>`;
}
function tagHTML(t) {
  const rows = t.comps.map(ci => { const e = edge(ci, t.i); return { c: C[ci], e, b: bestScope(e.mask) }; })
    .sort((a, b) => a.b - b.b || a.c.name.localeCompare(b.c.name));
  const counts = new Map();
  rows.forEach(r => scopesOf(r.e.mask).forEach(i => counts.set(i, (counts.get(i) || 0) + 1)));
  const chips = counts.size > 1 ? `<div class="filters" role="group" aria-label="Filter by type of connection"><button class="chip" type="button" data-f="-1" aria-pressed="true">All <span>${rows.length}</span></button>${[...counts].sort((a, b) => a[0] - b[0]).map(([i, n]) => `<button class="chip" type="button" data-f="${i}" aria-pressed="false" title="${esc(SCOPE_UI[SC[i]][1])}">${SCOPE_UI[SC[i]][0]} <span>${n}</span></button>`).join('')}</div>` : '';
  return `<h2 class="p-title" tabindex="-1">${esc(cap(t.label))}</h2>
<p class="p-meta">${plural(rows.length, 'compound', 'compounds')} connected to this topic</p>
${t.aliases.length ? `<p class="p-alias">Also searched as ${esc(listJoin(t.aliases))}</p>` : ''}
${chips}
<ul class="rows">${rows.map(r => rowHTML(r.c, r.e)).join('')}</ul>
${noteHTML()}`;
}
function compHTML(c) {
  const rel = relatedComps(c).filter(r => r.why === 'overlap');
  const groups = new Map();
  for (const ti of c.tags) { const b = bestScope(edge(c.i, ti).mask); if (!groups.has(b)) groups.set(b, []); groups.get(b).push(T[ti]); }
  const refs = [...new Set(c.tags.flatMap(ti => edge(c.i, ti).refs))].sort((a, b) => (S[b][1] || 0) - (S[a][1] || 0));
  const mp = c.prots.find(p => p[1] === c.main);
  const primary = c.prots.length > 1
    ? `<button class="btn btn-primary" type="button" data-choose-strength>Choose a protocol strength <span aria-hidden="true">↓</span></button>`
    : `<a class="btn btn-primary" href="${esc(pageUrl(c.main))}" target="_top" data-open="${c.i}" data-kind="primary">${c.prots.length ? `Open the ${esc(c.prots[0][0])} protocol` : 'Read the research overview'} <span aria-hidden="true">↗</span></a>`;
  return `<h2 class="p-title is-c" tabindex="-1"><span class="p-dot" aria-hidden="true"></span>${esc(c.name)}</h2>
<p class="p-meta">${esc(c.type)}${c.pending ? ' · Topics pending review' : ', connected to ' + plural(c.tags.length, 'topic', 'topics')}</p>
${c.aliases.length ? `<p class="p-alias">Also known as ${esc(listJoin(c.aliases))}</p>` : ''}
${c.summary ? `<p class="p-sum">${esc(c.summary)}</p>` : ''}
${c.pending ? '<p class="catalog-pending">This protocol is available now. Its research-topic connections are awaiting review.</p>' : ''}
${primary}
${c.prots.length ? `<span class="lbl" id="protocolStrengths" tabindex="-1">${c.prots.length > 1 ? 'Dosage protocols by vial strength' : 'Dosage protocol'}</span><div class="pills">${protPills(c)}</div>` : ''}
${c.prots.length && c.art ? `<a class="overview-link" href="${esc(pageUrl(c.art))}" target="_top" data-open="${c.i}" data-kind="article">Read research overview <span aria-hidden="true">↗</span></a>` : ''}
${c.context ? `<p class="identity-note">${esc(c.context)}</p>` : ''}
${c.parts.length ? `<p class="parts">Contains ${listJoin(c.parts.map(([pi, name]) => compBtn(pi, name)))}.</p>` : ''}
${c.partOf.length ? `<p class="parts">Also in ${listJoin(c.partOf.map(pi => compBtn(pi)))}.</p>` : ''}
${rel.length ? `<p class="parts">Shares the most topics with ${listJoin(rel.map(r => compBtn(r.i)))}.</p>` : ''}
${c.tags.length ? `<h3 class="p-h3">Connected topics<small>${c.tags.length}</small></h3>` : ''}
<div class="tgroups">${[...groups].sort((a, b) => a[0] - b[0]).map(([b, ts]) => `<div class="tg">${evPill(b)}<div class="tlist">${ts.sort((x, y) => y.comps.length - x.comps.length || x.label.localeCompare(y.label)).map(t => `<button class="tchip" type="button" data-tag="${t.i}" data-hot-t="${t.i}">${esc(t.label)}</button>`).join('')}</div></div>`).join('')}</div>
${refs.length ? `<details class="srcbox"><summary>Research sources (${refs.length})${ICON_DOWN}</summary><ol class="srcs">${refs.map(srcLi).join('')}</ol></details>` : ''}
${noteHTML()}`;
}
function renderPanel() {
  backBtn.hidden = !hist.length;
  if (hist.length) { const p = hist[hist.length - 1]; $('backLbl').textContent = p.type === 'tag' ? cap(T[p.i].label) : p.type === 'comp' ? C[p.i].name : 'All protocols and topics'; }
  if (view.type === 'tag') pbody.innerHTML = tagHTML(T[view.i]);
  else if (view.type === 'comp') pbody.innerHTML = compHTML(C[view.i]);
  pbody.scrollTop = 0;
}
function openPanel(open) {
  const was = panelOpen;
  panelOpen = open;
  panel.classList.toggle('open', open);
  app.classList.toggle('is-open', open);
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
  if (open && !was) sheet = 'half';
  panel.style.setProperty('--sheet-h', sheetPx(sheet) + 'px');
  app.style.setProperty('--sheet-h', sheetPx(sheet) + 'px');
  updateSheetButton();
}
function setFilter(i) {
  filterScope = i;
  pbody.querySelectorAll('.chip').forEach(ch => ch.setAttribute('aria-pressed', String(+ch.dataset.f === i)));
  pbody.querySelectorAll('.row').forEach(r => { r.hidden = i >= 0 && !(+r.dataset.scopes & (1 << i)); });
  updateEmphasis();
}
pbody.addEventListener('click', e => {
  const el = e.target.closest('a[data-open],[data-tag],[data-comp],[data-f],.src-btn,[data-more],[data-choose-strength]');
  if (!el) return;
  if (el.matches('a[data-open]')) { track('topic_explorer_open_page', { pd_compound: C[+el.dataset.open].id, pd_link: el.dataset.kind, pd_from: view.type === 'tag' ? T[view.i].id : '' }); return; }
  if (el.hasAttribute('data-choose-strength')) { const label = $('protocolStrengths'); label.scrollIntoView({ block: 'nearest', behavior: motion() ? 'smooth' : 'auto' }); pbody.querySelector('.pills a')?.focus({ preventScroll: true }); }
  else if (el.dataset.tag != null) setView({ type: 'tag', i: +el.dataset.tag });
  else if (el.dataset.comp != null) setView({ type: 'comp', i: +el.dataset.comp });
  else if (el.dataset.f != null) setFilter(+el.dataset.f);
  else if (el.classList.contains('src-btn')) {
    const ol = el.closest('.row').querySelector('.srcs'), open = el.getAttribute('aria-expanded') !== 'true';
    el.setAttribute('aria-expanded', String(open)); ol.hidden = !open;
  } else if (el.dataset.more != null) { el.parentElement.querySelectorAll('.pill[hidden]').forEach(p => { p.hidden = false; }); el.remove(); }
});
function setHot(w) { if (w === hot) return; hot = w; updateEmphasis(); }
pbody.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest('[data-hot-c],[data-hot-t],.row');
  let w = null;
  if (el) w = el.dataset.hotT != null ? T[+el.dataset.hotT].w : el.dataset.hotC != null ? C[+el.dataset.hotC].w : C[+el.dataset.c].w;
  setHot(w && w.ta ? w : null);
});
pbody.addEventListener('pointerleave', () => setHot(null));

/* ---------------------------------------------------------------- views */
function setView(v, opts = {}) {
  cancelTouchPreview();
  const restoreFocus = v.type === 'idle' && panel.contains(document.activeElement);
  if (v.type !== 'idle' && view.type === 'idle' && document.activeElement instanceof HTMLElement) focusOrigin = document.activeElement;
  if (v.type === view.type && v.i === view.i) { if (center) pulse = { w: center, t0: performance.now() }; return; }
  if (opts.push !== false && view.type !== 'idle') hist.push(view);
  if (v.type === 'idle') hist.length = 0;
  if (hist.length > 40) hist.shift();
  view = v; filterScope = -1; hot = null; hovered = null; assocHover = null;
  app.classList.remove('is-hover');
  showTip(null);
  openPanel(v.type !== 'idle');
  renderPanel();
  relayout();
  if (focused && document.activeElement === $('cloudFocus')) setFocus(center || nearestCenter());
  else focused = null;
  if (!opts.external) updateHash(opts.push !== false);
  updateHint(); updateContext(); renderBrowse();
  if (v.type !== 'idle' && keyboardMode) pbody.querySelector('h2')?.focus({ preventScroll: true });
  if (restoreFocus) {
    const target = focusOrigin && focusOrigin.isConnected && focusOrigin !== document.body && focusOrigin.getClientRects().length && !focusOrigin.closest('[hidden],[inert]') ? focusOrigin : qEl;
    // Closing a touch-opened detail should reveal the cloud, not summon the
    // phone keyboard and cover it with a new suggestion menu.
    const returnTarget = target === qEl && !keyboardMode ? $('cloudView') : target;
    returnTarget.focus({ preventScroll: true });
    hideSugg();
  }
  if (v.type === 'tag') { live.textContent = `${T[v.i].label}: ${plural(T[v.i].comps.length, 'connected compound', 'connected compounds')}`; track('topic_explorer_topic', { pd_topic: T[v.i].id }); }
  else if (v.type === 'comp') { live.textContent = `${C[v.i].name}: ${plural(C[v.i].tags.length, 'connected topic', 'connected topics')}`; track('topic_explorer_compound', { pd_compound: C[v.i].id }); }
  else live.textContent = 'Showing all topics';
}
function activate(w) {
  if (!w) return;
  if (w.role === 2) { pulse = { w, t0: performance.now() }; return; }
  setView(w.kind === 't' ? { type: 'tag', i: w.ref.i } : { type: 'comp', i: w.ref.i });
}
function goBack() {
  if (hist.length && history.state?.pdExplorer) history.back();
  else if (hist.length) setView(hist.pop(), { push: false });
  else if (view.type !== 'idle') setView({ type: 'idle' });
}
backBtn.addEventListener('click', goBack);
closeBtn.addEventListener('click', () => setView({ type: 'idle' }));

// When embedded on a page of the same site, the explorer reads ?topic= / #topic= from that page and
// keeps the page's #hash in step, so a selection can be shared or bookmarked.
const OWNQ = new URLSearchParams(location.search), SYNC = OWNQ.get('sync') === '1';
function parentLoc() {
  try { if (window.parent !== window && window.parent.location.host === location.host) return window.parent.location; } catch (e) { /* cross-origin */ }
  return null;
}
function updateHash(push = false) {
  const h = view.type === 'tag' ? '#topic=' + T[view.i].id : view.type === 'comp' ? '#compound=' + C[view.i].id : '';
  const query = new URLSearchParams(location.search);
  query.delete('topic'); query.delete('compound');
  const search = query.size ? '?' + query.toString() : '';
  try {
    if (location.hash !== h || location.search !== search) history[push ? 'pushState' : 'replaceState']({ pdExplorer: true, pdTrail: hist.slice() }, '', location.pathname + search + h);
  } catch (e) { /* sandboxed */ }
  const pl = SYNC && parentLoc();
  if (pl && (h || /topic=|compound=/.test(pl.hash))) {
    try { window.parent.history.replaceState(window.parent.history.state, '', pl.pathname + pl.search + h); } catch (e) { /* ignore */ }
  }
}
function resolveTerm(s, type) {
  if (!s) return null;
  if (type === 't' && tagById.has(s)) return tagById.get(s);
  if (type === 'c' && compById.has(s)) return compById.get(s);
  const n = norm(s), list = type === 't' ? T : C;
  return list.find(x => x.n === n || x.an.includes(n)) || null;
}
function readInitial() {
  const srcs = [new URLSearchParams(location.hash.slice(1)), OWNQ];
  const pl = parentLoc();
  if (pl && SYNC) srcs.unshift(new URLSearchParams(pl.hash.slice(1)), new URLSearchParams(pl.search));
  for (const p of srcs) {
    const t = resolveTerm(p.get('topic'), 't');
    if (t) return { type: 'tag', i: t.i };
    const c = resolveTerm(p.get('compound'), 'c');
    if (c) return { type: 'comp', i: c.i };
  }
  return null;
}
function updateHint() {
  const fine = fineMQ.matches;
  $('hint').textContent = displayMode === 'list' ? 'Choose a topic or compound to explore.' : compactMQ.matches
    ? 'Touch and slide to explore. Release to open.' : view.type === 'idle'
    ? (fine && motion() ? 'Hover to magnify. Click a word to see its compounds.' : fine ? 'Choose a word to see its compounds.' : 'Tap a word to see its compounds.')
    : (fine ? 'Hover a word to trace its connections.' : 'Tap any word to explore it.');
}
function track(name, params) {
  // The existing site analytics owner can listen after its consent checks.
  // Do not dispatch raw search text or send a second analytics event directly.
  const { pd_query, ...structured } = params;
  app.dispatchEvent(new CustomEvent('pd:explorer', { bubbles: true, detail: { event: name, ...structured } }));
}

/* ---------------------------------------------------------- cloud input */
let down = null;
const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const touchPointers = new Set();
let touchBlocked = false;
const isTouchPointer = e => e.pointerType === 'touch' || e.pointerType === 'pen';
const touchPreview = document.createElement('div');
touchPreview.id = 'touchPreview'; touchPreview.className = 'touch-preview';
touchPreview.hidden = true; touchPreview.setAttribute('aria-hidden', 'true');
const touchTitle = document.createElement('strong'), touchMeta = document.createElement('span'), touchInstruction = document.createElement('span');
touchTitle.className = 'touch-preview-title'; touchMeta.className = 'touch-preview-meta'; touchInstruction.className = 'touch-preview-instruction';
touchInstruction.textContent = 'Slide to explore · Release to open';
touchPreview.append(touchTitle, touchMeta, touchInstruction); app.append(touchPreview);

function inTouchCloud(x, y, bounds = B) {
  return cloudAvailable && displayMode === 'cloud' && !(panelOpen && sheet === 'full') &&
    x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
}
// Distances are measured against frozen label rectangles, not enlarged hit
// boxes. A small hysteresis margin prevents flicker between adjacent words.
function nearestTouchWord(x, y, targets, current) {
  const score = t => {
    const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
    return Math.hypot(Math.max(0, dx - t.hw), Math.max(0, dy - t.hh) * 1.35) + Math.hypot(dx, dy * 1.35) * .06;
  };
  let best = null, distance = Infinity;
  for (const target of targets) { const d = score(target); if (d < distance) { best = target; distance = d; } }
  if (!best || distance > 64) return null;
  if (current && current !== best && score(current) <= distance + 5) return current;
  return best;
}
function touchPreviewPosition(x, y, width, height, bounds, viewportWidth) {
  let left = clamp(x - width / 2, 8, Math.max(8, viewportWidth - width - 8));
  let top = y - height - 34, anchor = 'above';
  if (top < bounds.y + 4) {
    anchor = 'top'; top = Math.max(8, Math.min(bounds.y - height - 8, y - height - 24));
    // A very short landscape viewport may have no vertical space above the
    // finger. Anchor on its opposite side rather than cover the touched word.
    if (top + height > y - 20) left = x < viewportWidth / 2 ? viewportWidth - width - 8 : 8;
  }
  return { left, top, anchor };
}
function paintTouchPreview(x, y) {
  if (!touchSession) return;
  const session = touchSession;
  session.current = inTouchCloud(x, y, session.bounds) ? nearestTouchWord(x, y, session.targets, session.current) : null;
  if (!session.current) { touchPreview.hidden = true; return; }
  const w = session.current.w;
  touchTitle.textContent = w.text;
  touchMeta.textContent = w.kind === 't' ? 'Research topic' : 'Peptide / compound';
  touchPreview.dataset.kind = w.kind;
  touchPreview.style.maxWidth = Math.max(120, Math.min(272, VW - 24)) + 'px';
  touchPreview.hidden = false;
  let width = touchPreview.offsetWidth, height = touchPreview.offsetHeight;
  if (y - height - 24 < 8) {
    const sideRoom = Math.max(x - 24, VW - x - 24);
    if (sideRoom >= 140 && sideRoom < width) {
      touchPreview.style.maxWidth = sideRoom + 'px';
      width = touchPreview.offsetWidth; height = touchPreview.offsetHeight;
    }
  }
  const position = touchPreviewPosition(x, y, width, height, session.bounds, VW);
  touchPreview.style.left = position.left + 'px'; touchPreview.style.top = position.top + 'px';
  touchPreview.dataset.anchor = position.anchor;
}
function cancelTouchPreview() {
  if (!touchSession) return;
  const id = touchSession.id;
  touchSession = null; down = null;
  touchPreview.hidden = true; app.classList.remove('is-touch-preview');
  try { if (cv.hasPointerCapture(id)) cv.releasePointerCapture(id); } catch (error) { /* Already cancelled by the browser. */ }
  wake();
}
function beginTouchPreview(e) {
  down = null;
  if (touchBlocked || touchSession || e.isPrimary === false || touchPointers.size > 1) { cancelTouchPreview(); return; }
  const [x, y] = local(e);
  if (!inTouchCloud(x, y) || !ready) return;
  const targets = drawList.filter(w => w.ta && w.alpha >= .14).map(w => ({ w, x: w.dx, y: w.dy, hw: w.dw, hh: w.dh }));
  if (!targets.length) return;
  setHover(null); showTip(null); clearTimeout(assocTimer);
  touchSession = { id: e.pointerId, bounds: { ...B }, targets, current: null };
  if (raf) cancelAnimationFrame(raf); raf = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (error) { cancelTouchPreview(); return; }
  app.classList.add('is-touch-preview');
  paintTouchPreview(x, y);
}
function finishTouchPreview(e) {
  if (!touchSession || touchSession.id !== e.pointerId) return;
  const [x, y] = local(e);
  const valid = !touchBlocked && inTouchCloud(x, y, touchSession.bounds);
  if (valid) paintTouchPreview(x, y);
  const selected = valid && touchSession.current ? touchSession.current.w : null;
  cancelTouchPreview();
  if (selected) activate(selected);
}
// Observe additional contacts even when they land on a toolbar. These passive
// listeners never prevent browser pinch zoom or other document gestures.
document.addEventListener('pointerdown', e => {
  if (!isTouchPointer(e)) return;
  touchPointers.add(e.pointerId);
  if (touchPointers.size > 1 || e.isPrimary === false) { touchBlocked = true; cancelTouchPreview(); }
}, { capture: true, passive: true });
function releaseTouchPointer(e) {
  if (!isTouchPointer(e)) return;
  touchPointers.delete(e.pointerId);
  if (e.type === 'pointercancel') cancelTouchPreview();
  if (!touchPointers.size) touchBlocked = false;
}
document.addEventListener('pointerup', releaseTouchPointer, { capture: true, passive: true });
document.addEventListener('pointercancel', releaseTouchPointer, { capture: true, passive: true });
window.addEventListener('blur', () => { cancelTouchPreview(); touchPointers.clear(); touchBlocked = false; });
cv.addEventListener('lostpointercapture', e => { if (touchSession?.id === e.pointerId) cancelTouchPreview(); });
function pick(x, y) {
  if (!cloudAvailable) return null;
  let best = null, bd = 1e9;
  for (const w of drawList) {
    if (!w.ta || w.alpha < .14) continue;
    const hw = compactMQ.matches ? Math.max(22, w.dw + 8) : w.dw + 4;
    const hh = compactMQ.matches ? Math.max(22, w.dh + 8) : w.dh + 4;
    const ex = Math.abs(x - w.dx) / hw, ey = Math.abs(y - w.dy) / hh;
    if (ex <= 1 && ey <= 1) { const d = ey + ex * .5 - w.z * .05; if (d < bd) { bd = d; best = w; } }
  }
  return best;
}
function setHover(w) {
  if (w === hovered) return;
  hovered = w;
  app.classList.toggle('is-hover', !!w);
  showTip(w || focused);
  clearTimeout(assocTimer);
  if (view.type === 'idle') assocTimer = setTimeout(() => { assocHover = w && w.kind === 't' ? w : null; updateEmphasis(); }, w ? 170 : 280);
  updateEmphasis();
}
cv.addEventListener('pointermove', e => {
  if (compactMQ.matches && isTouchPointer(e)) {
    if (touchSession?.id === e.pointerId) paintTouchPreview(...local(e));
    return;
  }
  [ptr.x, ptr.y] = local(e); ptr.inside = true;
  if (e.pointerType === 'mouse') setHover(pick(ptr.x, ptr.y));
});
cv.addEventListener('pointerleave', () => { ptr.inside = false; setHover(null); });
cv.addEventListener('pointerdown', e => {
  if (compactMQ.matches && isTouchPointer(e)) { beginTouchPreview(e); return; }
  const [x, y] = local(e); down = { x, y, t: performance.now() };
});
cv.addEventListener('pointercancel', () => { down = null; cancelTouchPreview(); });
cv.addEventListener('pointerup', e => {
  if (compactMQ.matches && isTouchPointer(e)) { finishTouchPreview(e); return; }
  if (!down) return;
  const [x, y] = local(e), d = down; down = null;
  if (Math.hypot(x - d.x, y - d.y) > 10 || performance.now() - d.t > 800) return;
  const w = pick(x, y);
  if (w) activate(w);
});

/* keyboard access to the cloud */
const cf = $('cloudFocus');
function nearestCenter() {
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  let best = null, bd = 1e9;
  for (const w of drawList) { if (!w.ta) continue; const d = Math.hypot(w.dx - cx, w.dy - cy); if (d < bd) { bd = d; best = w; } }
  return best;
}
function setFocus(w) {
  focused = w;
  showTip(w || hovered);
  updateEmphasis();
  if (w) live.textContent = w.kind === 't' ? `${w.text}, ${plural(w.ref.comps.length, 'compound', 'compounds')}` : `${w.text}, compound`;
}
cf.addEventListener('focus', () => { if (!focused) setFocus(center || nearestCenter()); });
cf.addEventListener('blur', () => setFocus(null));
cf.addEventListener('keydown', e => {
  const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (dirs[e.key]) {
    e.preventDefault();
    if (!focused) { setFocus(nearestCenter()); return; }
    const [ux, uy] = dirs[e.key]; let best = null, bs = 1e9;
    for (const w of drawList) {
      if (w === focused || !w.ta || w.alpha < .2) continue;
      const dx = w.dx - focused.dx, dy = w.dy - focused.dy, along = dx * ux + dy * uy;
      if (along <= 4) continue;
      const s = along + Math.abs(dx * uy - dy * ux) * 2.4;
      if (s < bs) { bs = s; best = w; }
    }
    if (best) setFocus(best);
  } else if ((e.key === 'Enter' || e.key === ' ') && focused) { e.preventDefault(); activate(focused); }
  else if (e.key === 'Escape') { e.preventDefault(); goBack(); }
});

/* ---------------------------------------------------------------- search */
const qEl = $('q'), sugg = $('sugg'), clearBtn = $('clear'), kbd = $('kbd');
let results = [], active = -1;
const POPULAR = T.filter(t => t.kind === 0).sort((a, b) => b.comps.length - a.comps.length).slice(0, 7);
function score(n, q) { if (n === q) return 100; if (n.startsWith(q)) return 80; if ((' ' + n).includes(' ' + q)) return 62; if (n.includes(q)) return 40; return 0; }
function find(q) {
  const nq = norm(q); if (!nq) return [];
  const out = [];
  const scan = (item, type, w) => {
    let best = score(item.n, nq), via = null;
    item.an.forEach((a, k) => { const s = score(a, nq) - 3; if (s > best) { best = s; via = k; } });
    if (best > 0) out.push({ type, item, via, s: best + w });
  };
  T.forEach(t => scan(t, 't', t.comps.length / MAXC * 9));
  C.forEach(c => scan(c, 'c', 6));
  const len = r => (r.type === 't' ? r.item.label : r.item.name).length;
  return out.sort((a, b) => b.s - a.s || len(a) - len(b)).slice(0, 8);
}
function markMatch(label, q) {
  const qq = q.trim(), i = qq ? label.toLowerCase().indexOf(qq.toLowerCase()) : -1;
  if (i < 0) return esc(label);
  return esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + qq.length)) + '</mark>' + esc(label.slice(i + qq.length));
}
function optHTML(r, k, q) {
  const label = r.type === 't' ? r.item.label : r.item.name;
  const sub = r.via != null ? `matches \u201c${r.item.aliases[r.via]}\u201d` : r.type === 'c' ? r.item.type : '';
  const meta = r.type === 't' ? plural(r.item.comps.length, 'compound', 'compounds') : plural(r.item.tags.length, 'topic', 'topics');
  return `<li class="opt" role="option" id="opt-${k}" data-k="${k}" aria-selected="${k === active}"><span class="opt-dot ${r.type}" aria-hidden="true"></span><span class="opt-main"><span class="opt-label">${markMatch(label, q)}</span>${sub ? `<span class="opt-via">${esc(sub)}</span>` : ''}</span><span class="opt-meta">${meta}</span></li>`;
}
function renderSugg() {
  const q = qEl.value;
  let html;
  if (!q.trim()) {
    results = POPULAR.map(t => ({ type: 't', item: t, via: null })); active = -1;
    html = '<li class="sugg-h" role="presentation">Popular topics</li>' + results.map((r, k) => optHTML(r, k, '')).join('');
  } else {
    results = find(q); active = results.length ? 0 : -1;
    html = results.length ? results.map((r, k) => optHTML(r, k, q)).join('')
      : `<li class="sugg-empty" role="presentation">No topic or compound matches \u201c${esc(q.trim())}\u201d. Try a broader word, like recovery or sleep.</li>`;
  }
  sugg.innerHTML = html; sugg.hidden = false;
  qEl.setAttribute('aria-expanded', 'true');
  paintActive();
}
function paintActive() {
  sugg.querySelectorAll('.opt').forEach(li => li.setAttribute('aria-selected', String(+li.dataset.k === active)));
  if (active >= 0) { qEl.setAttribute('aria-activedescendant', 'opt-' + active); const li = $('opt-' + active); if (li) li.scrollIntoView({ block: 'nearest' }); }
  else qEl.removeAttribute('aria-activedescendant');
}
function hideSugg() { sugg.hidden = true; qEl.setAttribute('aria-expanded', 'false'); qEl.removeAttribute('aria-activedescendant'); }
function liveMatch() {
  const nq = norm(qEl.value);
  qMatches = null;
  if (nq.length >= 2) {
    const m = new Set();
    for (const w of words) { if (!w.ta) continue; const r = w.ref; if (r.n.includes(nq) || r.an.some(a => a.includes(nq))) m.add(w); }
    if (m.size) qMatches = m;
  }
  updateEmphasis();
}
function choose(r) {
  if (!r) return;
  track('topic_explorer_search', { pd_query: qEl.value.trim().slice(0, 60), pd_result: r.item.id });
  qEl.value = ''; clearBtn.hidden = true; kbd.hidden = false; qMatches = null;
  hideSugg();
  setView(r.type === 't' ? { type: 'tag', i: r.item.i } : { type: 'comp', i: r.item.i });
  if (document.activeElement === qEl) qEl.blur();
}
qEl.addEventListener('input', () => { clearBtn.hidden = !qEl.value; kbd.hidden = true; renderSugg(); liveMatch(); browseLimit = 72; renderBrowse(); });
qEl.addEventListener('focus', () => { kbd.hidden = true; renderSugg(); });
qEl.addEventListener('blur', () => { setTimeout(hideSugg, 120); kbd.hidden = !!qEl.value; });
qEl.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!results.length) return;
    active = active < 0 ? (e.key === 'ArrowDown' ? 0 : results.length - 1) : (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; paintActive();
  } else if (e.key === 'Enter') {
    e.preventDefault(); choose(results[active >= 0 ? active : qEl.value.trim() ? 0 : -1]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (qEl.value) { qEl.value = ''; qEl.dispatchEvent(new Event('input')); } else qEl.blur();
  }
});
sugg.addEventListener('pointerdown', e => e.preventDefault());
sugg.addEventListener('click', e => { const li = e.target.closest('.opt'); if (li) choose(results[+li.dataset.k]); });
sugg.addEventListener('pointermove', e => { const li = e.target.closest('.opt'); if (li && +li.dataset.k !== active) { active = +li.dataset.k; paintActive(); } });
clearBtn.addEventListener('click', () => { qEl.value = ''; qEl.dispatchEvent(new Event('input')); qEl.focus(); });
document.addEventListener('keydown', e => {
  if (e.target === qEl) return;
  const typing = e.target.closest && e.target.closest('input,textarea,[contenteditable]');
  if (typing) return;
  if ((e.key === '/' && !e.metaKey && !e.ctrlKey) || ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey))) { e.preventDefault(); qEl.focus(); }
  else if (e.key === 'Escape' && e.target !== cf) goBack();
});

/* ------------------------------------------------------------ bottom sheet */
const handle = $('handle');
let drag = null;
const ORDER = ['peek', 'half', 'full'];
function setSheet(s) {
  const prev = sheet; sheet = s;
  panel.style.setProperty('--sheet-h', sheetPx(s) + 'px');
  app.style.setProperty('--sheet-h', sheetPx(s) + 'px');
  updateSheetButton(); relayout();
}
handle.addEventListener('pointerdown', e => {
  if (!compactMQ.matches) return;
  drag = { y: e.clientY, h: panel.offsetHeight, moved: false };
  handle.setPointerCapture(e.pointerId); panel.classList.add('dragging');
});
handle.addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true;
  const available = sheetPx('full');
  panel.style.setProperty('--sheet-h', clamp(drag.h - dy, Math.min(90, available), available) + 'px');
});
const endDrag = e => {
  if (!drag) return;
  panel.classList.remove('dragging');
  const dy = e.clientY - drag.y, moved = drag.moved; drag = null;
  let idx = ORDER.indexOf(sheet);
  if (!moved) idx = sheet === 'half' ? 2 : 1;
  else if (dy < -40) idx = Math.min(2, idx + 1);
  else if (dy > 40) { if (idx === 0) { setView({ type: 'idle' }); return; } idx -= 1; }
  setSheet(ORDER[idx]);
};
handle.addEventListener('pointerup', endDrag);
handle.addEventListener('pointercancel', () => {
  if (!drag) return;
  drag = null; panel.classList.remove('dragging'); setSheet(sheet);
});

/* ------------------------------------------------------ navigation and list */
function updateContext() {
  const idle = view.type === 'idle';
  const label = view.type === 'tag' ? cap(T[view.i].label) : view.type === 'comp' ? C[view.i].name : '';
  $('trail').innerHTML = idle ? '<span>All protocols &amp; topics</span>' : `<button type="button" data-all>All</button><span class="sep" aria-hidden="true">/</span><span aria-current="page">${esc(label)}</span>`;
  $('count').textContent = idle ? `${D.protocolCount} protocols · ${T.length} topics`
    : view.type === 'tag' ? plural(T[view.i].comps.length, 'connected compound', 'connected compounds')
    : plural(C[view.i].tags.length, 'connected topic', 'connected topics');
  $('share').hidden = idle;
  document.querySelectorAll('[data-quick]').forEach(button => button.setAttribute('aria-pressed', String(view.type === 'tag' && T[view.i].id === button.dataset.quick)));
}
$('trail').addEventListener('click', e => { if (e.target.closest('[data-all]')) setView({ type: 'idle' }); });
document.querySelector('.quick-topics').addEventListener('click', e => {
  const button = e.target.closest('[data-quick]'), topic = button && tagById.get(button.dataset.quick);
  if (topic) { hideSugg(); setView({ type: 'tag', i: topic.i }); }
});
function setDisplay(mode) {
  cancelTouchPreview();
  displayMode = mode;
  app.classList.toggle('is-list', mode === 'list');
  $('browse').hidden = mode !== 'list';
  $('cloudView').setAttribute('aria-pressed', String(mode === 'cloud'));
  $('listView').setAttribute('aria-pressed', String(mode === 'list'));
  updateSheetButton();
  hideSugg(); setHover(null); renderBrowse(); updateHint(); relayout();
}
$('cloudView').addEventListener('click', () => setDisplay('cloud'));
$('listView').addEventListener('click', () => setDisplay('list'));
let browseRenderKey = '';
function renderBrowse() {
  if (displayMode !== 'list') return;
  const compound = browseType === 'compounds', nq = norm(qEl.value);
  const renderKey = `${browseType}:${browseLimit}:${nq}`;
  if (renderKey === browseRenderKey) return;
  browseRenderKey = renderKey;
  const items = (compound ? C : T).filter(item => !nq || item.n.includes(nq) || item.an.some(alias => alias.includes(nq)))
    .slice().sort((a, b) => (compound ? a.name : a.label).localeCompare(compound ? b.name : b.label, 'en', { numeric: true }));
  $('browseCount').textContent = `${Math.min(items.length, browseLimit)} of ${items.length} ${compound ? 'protocols / compounds' : 'topics'}`;
  $('browseItems').innerHTML = items.length ? items.slice(0, browseLimit).map(item => `<button type="button" class="browse-card${compound ? ' is-comp' : ''}" data-${compound ? 'comp' : 'tag'}="${item.i}"><span class="card-dot" aria-hidden="true"></span><span><strong>${esc(compound ? item.name : cap(item.label))}</strong><small>${compound ? (item.pending ? 'Open protocol · Topics pending review' : plural(item.tags.length, 'topic', 'topics')) : plural(item.comps.length, 'compound', 'compounds')}</small></span><span class="card-arrow" aria-hidden="true">↗</span></button>`).join('')
    : `<p class="browse-empty">${!compound && !T.length ? 'Research-topic connections are awaiting review. Choose Protocols to browse every published page.' : 'No matches yet. Try a broader topic or a different compound name.'}</p>`;
  $('loadMore').hidden = items.length <= browseLimit;
  document.querySelectorAll('[data-browse]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.browse === browseType)));
}
$('browse').addEventListener('click', e => {
  const button = e.target.closest('[data-browse],[data-comp],[data-tag]');
  if (!button) return;
  if (button.dataset.browse) { browseType = button.dataset.browse; browseLimit = 72; renderBrowse(); }
  else { hideSugg(); setView(button.dataset.comp != null ? { type: 'comp', i: +button.dataset.comp } : { type: 'tag', i: +button.dataset.tag }); }
});
$('loadMore').addEventListener('click', () => {
  const previous = browseLimit;
  browseLimit += 72; renderBrowse();
  if (keyboardMode) $('browseItems').children[previous]?.focus({ preventScroll: true });
});
function updateSheetButton() {
  $('sheetToggle').setAttribute('aria-expanded', String(sheet === 'full'));
  $('sheetToggle').innerHTML = sheet === 'full' ? 'Collapse details <span aria-hidden="true">↓</span>' : 'Expand details <span aria-hidden="true">↑</span>';
  const expanded = compactMQ.matches && panelOpen && sheet === 'full';
  app.classList.toggle('is-sheet-full', expanded);
  $('browse').inert = expanded;
  const cloudHidden = expanded || displayMode !== 'cloud' || !cloudAvailable;
  $('cloudFocus').tabIndex = cloudHidden ? -1 : 0;
  if (cloudHidden && document.activeElement === $('cloudFocus')) $('listView').focus({ preventScroll: true });
}
$('sheetToggle').addEventListener('click', () => setSheet(sheet === 'full' ? 'half' : 'full'));
function updateMotionButton() {
  const paused = !motion(), label = reduceMQ.matches ? 'Motion reduced by your device setting' : paused ? 'Resume cloud motion' : 'Pause cloud motion';
  $('motion').setAttribute('aria-pressed', String(paused));
  $('motion').setAttribute('aria-label', label);
  $('motion').title = label;
  $('motion').disabled = reduceMQ.matches;
  $('motion').innerHTML = reduceMQ.matches ? '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 11c1-5 3-5 5-1s4 4 7-1M4 4l12 12"/></svg>' : paused ? '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 4.5v11l8-5.5z"/></svg>' : '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="2.5" height="11" rx="1"/><rect x="11.5" y="4.5" width="2.5" height="11" rx="1"/></svg>';
}
$('motion').addEventListener('click', () => { userPaused = !userPaused; pulse = null; updateMotionButton(); updateHint(); relayout(); });
reduceMQ.addEventListener('change', () => { pulse = null; updateMotionButton(); updateHint(); relayout(); });
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
$('share').addEventListener('click', async () => {
  try {
    const target = (SYNC && parentLoc()) || location;
    await navigator.clipboard.writeText(target.href);
    toast('Link copied. This selection is ready to share.');
  } catch (error) { toast('Copy this selection from your browser’s address bar.'); }
});
function restoreLocation() {
  const params = new URLSearchParams(location.hash.slice(1));
  const topic = resolveTerm(params.get('topic'), 't'), compound = resolveTerm(params.get('compound'), 'c');
  hist.length = 0;
  for (const entry of history.state?.pdTrail || []) {
    if ((entry.type === 'tag' && T[entry.i]) || (entry.type === 'comp' && C[entry.i])) hist.push({ type: entry.type, i: entry.i });
  }
  setView(topic ? { type: 'tag', i: topic.i } : compound ? { type: 'comp', i: compound.i } : { type: 'idle' }, { push: false, external: true });
}
window.addEventListener('popstate', restoreLocation);
window.addEventListener('hashchange', restoreLocation);

/* ------------------------------------------------------------- lifecycle */
function resize() {
  cancelTouchPreview();
  const r = app.getBoundingClientRect();
  VW = r.width; VH = r.height; DPR = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.round(VW * DPR), height = Math.round(VH * DPR);
  let bitmapChanged = false;
  // Assigning either canvas dimension clears its bitmap, even at the same
  // value. Preserve a settled/paused frame on duplicate observer deliveries.
  if (cv.width !== width) { cv.width = width; bitmapChanged = true; }
  if (cv.height !== height) { cv.height = height; bitmapChanged = true; }
  if (panelOpen) panel.style.setProperty('--sheet-h', sheetPx(sheet) + 'px');
  if (panelOpen) app.style.setProperty('--sheet-h', sheetPx(sheet) + 'px');
  updateSheetButton();
  if (bitmapChanged && ready) wake();
}
let rT = 0, lastW = 0, lastH = 0, lastCompact = compactMQ.matches;
function handleResize() {
  resize();
  if (Math.abs(VW - lastW) < 2 && Math.abs(VH - lastH) < 2 && lastCompact === compactMQ.matches) return;
  lastW = VW; lastH = VH; lastCompact = compactMQ.matches;
  clearTimeout(rT); rT = setTimeout(() => { relayout(); updateHint(); }, 140);
}
new ResizeObserver(handleResize).observe(app);
window.addEventListener('resize', handleResize, { passive: true });
compactMQ.addEventListener('change', handleResize);

let last = performance.now(), raf = 0, onScreen = true, inViewport = true, settleUntil = 0;
function frame(now) {
  raf = 0;
  if (!onScreen || touchSession) return;
  const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
    update(dt, now); draw(now);
    if (displayMode === 'cloud' && cloudAvailable && (motion() || now < settleUntil)) raf = requestAnimationFrame(frame);
}
function wake() { settleUntil = performance.now() + 900; if (!raf && onScreen) { last = performance.now(); raf = requestAnimationFrame(frame); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelTouchPreview(); onScreen = inViewport && !document.hidden; wake(); });
if ('IntersectionObserver' in window) new IntersectionObserver(es => { inViewport = es[0].isIntersecting; onScreen = inViewport && !document.hidden; wake(); }).observe(app);

const fsBtn = $('fs');
if (document.fullscreenEnabled) {
  fsBtn.hidden = false;
  fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
  document.addEventListener('fullscreenchange', () => fsBtn.setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Full screen'));
}
fineMQ.addEventListener && fineMQ.addEventListener('change', updateHint);

$('count').textContent = `${T.length} topics across ${C.length} compounds`;
async function init() {
  resize(); lastW = VW; lastH = VH;
  try { await Promise.all([document.fonts.load(`400 20px ${FONT}`), document.fonts.load(`800 20px ${FONT}`)]); } catch (e) { /* fall back to system font */ }
  measureAll();
  ready = true;
  document.querySelectorAll('[data-quick]').forEach(button => { button.hidden = !tagById.has(button.dataset.quick); });
  document.querySelector('.try-label').hidden = !T.length;
  const status = $('catalogState');
  status.hidden = !D.pendingCount && T.length > 0;
  status.textContent = D.available
    ? (T.length ? 'All published protocols are available. Some research-topic connections are still awaiting review.' : 'Browse every published protocol below. Research-topic connections are awaiting review.')
    : 'The live catalog is temporarily unavailable. Please use the protocol directory.';
  $('cloudView').disabled = !T.length;
  $('cloudView').title = T.length ? 'Explore the research-topic cloud' : 'The topic cloud will appear as connections are reviewed';
  if (!D.available || !D.c.length) { $('loadError').hidden = true; status.hidden = false; }
  if (!T.length) { $('q').placeholder = 'Search a peptide or protocol…'; document.querySelector('.size-note').hidden = true; }
  setDisplay(displayMode);
  const iv = readInitial();
  if (iv) { view = iv; openPanel(true); renderPanel(); updateHash(false); }
  relayout({ intro: true });
  updateHint(); updateContext(); updateMotionButton(); renderBrowse();
  wake();
  }
init().catch(error => { $('loadError').hidden = false; console.error('Peptide Explorer initialization failed', error); });
})();
