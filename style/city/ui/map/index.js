// HUMAN LAYER · SECTION 3b · THE CITY MAP: a 90s paper street map of the whole island (a Thomas Guide page, a gas-station fold-out),
// full screen over the city like a game's pause map. B opens it (the map Book), B or Esc closes it. Drawn from the plan (ui/map/geo.js, ui/map/paper.js).
//   the sheet   paper and ink: the woods, the water with its coast and ripple lines, the blocks tinted by district, avenues, Route 9, the
//               bridges, Iron Island, property lines close in, street and district names, the page grid ("C4") with its rulers, a legend
//               box (lens, layers, symbols, a scale bar, the north arrow). Drag to pan, wheel or pinch to zoom, double-click to zoom in.
//   places      the sim's 29 places as printed symbols; click one: a card (what it is, who's there now, what happened there lately, Go there:
//               the map closes and the camera flies there)
//   agents      a pin per sim agent (positions are public), crew colours, a label on hover, click: the dossier. Yours (?as=) is marked YOU
//   events      robberies, burglaries, arrests, deaths, turf changes, the Director's calls: stamps that fade with age
//   trails      the trails on (2b: the dossier's Where they went), routed along the sidewalks as in the city, stops and times
//   heat        the heat map's field (2b: M, or the Heat button here), printed as banded contours
//   turf        off by default (the 10-01 decision): districts tinted by the crew that holds them
//   lenses      LIVE by default (the public lens: a witness's map); TAPE: agents where they were, events up to the tape time (and the
//               tape's own lens badge); ARCHIVE: a finished season
// Cost: nothing at all until it opens (no canvas, no listener but the key). While open, the base sheet is redrawn only when the view or
// the skin changes, the live layer when something on it moved (checked 4× a second) or the view changed; the 3D city stops rendering
// behind it (its frame keeps running: walkers, traffic and the tape stay in step) and renders again the frame it closes. Closed, the
// canvases are released and every timer and subscription is gone.
// window.__map: { open, close, toggle, isOpen, view, setView, fit, focus(x, z, s), place(id), stats() }.
import { h, set, attr, button, toast, prefs, lens as lensBadge, hoverLabel, getRoot, onSkinChange, getSkin, screens } from '../kit.js';
import { buildGeo, isoFill, GRID } from './geo.js';
import { drawBase, toScreen, toWorld, glyph } from './paper.js';
import { tape } from '../tape/state.js';
import { posAt, stampOf, hhmm, DAY } from '../tape/trails-data.js';
import { places as gotoPlaces, flyTo } from '../goto.js';   // (3a's shared Go there: near, the rig eases there; far, a cut behind the load-in)

const LAYER_KEY = 'aicity.ui.map.layers', LAYERS = ['places', 'agents', 'events', 'trails', 'heat', 'turf'];
const DEF = { places: true, agents: true, events: true, trails: true, heat: true, turf: false };
const ISLAND = { x0: -560, z0: -440, x1: 520, z1: 430 }, SMIN = .35, SMAX = 14;
const EV_KINDS = { rob: 'rob', burgle: 'rob', arrest: 'arrest', death: 'death', killed: 'death', turf: 'turf', director: 'director' };
const EV_WINDOW = 12 * 60;   // events fade over 12 game hours (older ones go)
const KIND_NAME = { police: 'Police precinct', court: 'Courthouse', plaza: 'Plaza', fit: 'The drop', motel: 'Motel', park: 'Park', store: 'All-night store', hospital: 'Hospital', jail: 'County jail',
  hangout: 'Trailer park', site: 'Gathering site', lab: 'Cook shack', corner: 'Dealing corner' };
const ABOUT = { police: 'Where the cops book whoever they pick up.', court: 'Warrants, bail and sentences.', plaza: 'Downtown’s open square.', fit: 'Fit Street: new stock drops here.',
  motel: 'Rooms by the hour off Route 9.', park: 'The suburbs’ park.', store: 'Open all night.', hospital: 'Where the hurt wake up.', jail: 'The county jail, over the Long Bridge.',
  hangout: 'Cheap pads, loud neighbours.', lab: 'A cook shack deep in the trees.', corner: 'A corner where deals go down.',
  heap: 'Dig for scrap in the junk.', mall: 'Salts in the ruins of the mall.', docks: 'Goo washes up here.', woods: 'Leaf grows in the clearing.' };

export function mountMap(api, { sim, dossier, root, city }) {
  if (!document.querySelector('link[data-map-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./map.css', import.meta.url).href, 'data-map-css': '' }));
  const toys = () => api.ui?.toys || window.__toys || null;
  let isOpen = false, built = false, G = null, T = null, el = null, sheet = null, cvBase = null, cvTint = null, cvLive = null, legend = null, card = null, label = null, chooser = null;
  let view = null, baseView = null, raf = 0, dirty = { base: false, tint: false, live: false }, anim = null, settleT = 0, tick = 0, unsubs = [], hover = null, sig = '';
  let layers = { ...DEF, ...(() => { try { return JSON.parse(prefs.get(LAYER_KEY) || '{}'); } catch { return {}; } })() };
  const S = { opens: 0, base: 0, baseMs: 0, tint: 0, live: 0, liveMs: 0, frames: 0, skipped: 0, geoMs: 0, paused: false };
  const data = { agents: [], events: [], turf: new Map(), crews: [], heatRef: null, heatPaths: null, routes: new Map(), lens: 'live', t: null };

  // ── the DOM (built on the first open)
  function build() {
    if (built) return; built = true;
    G = buildGeo(); S.geoMs = G.ms; gotoPlaces().catch(() => {});
    cvBase = h('canvas', { class: 'mp-base', 'aria-hidden': 'true' }); cvTint = h('canvas', { class: 'mp-tint', 'aria-hidden': 'true' }); cvLive = h('canvas', { class: 'mp-live', 'aria-hidden': 'true' });
    sheet = h('div', { class: 'mp-sheet' }, cvBase, cvTint, h('div', { class: 'mp-folds', 'aria-hidden': 'true' }), cvLive);
    card = h('div', { class: 'mp-card', role: 'dialog', 'aria-label': 'Place', hidden: true, 'data-safe-avoid': '' });
    legend = makeLegend();
    el = h('section', { class: 'mp', role: 'dialog', 'aria-label': 'City map', 'aria-hidden': 'true', 'data-safe-avoid': '' }, sheet, legend.el, card);
    root.prepend(el);   // (under every other part of the UI: the dossier, the transport, the toys, toasts and tooltips stay on top)
    label = hoverLabel(); label.el.classList.add('mp-label');
    wireInput();
    onSkinChange(() => { if (!isOpen) return; readTokens(); dirty.base = dirty.tint = dirty.live = true; loadFonts(); schedule(); });
  }
  // the tokens (map.css per skin) → one table for the canvas
  function readTokens() {
    const cs = getComputedStyle(el), v = k => cs.getPropertyValue('--k-map-' + k).trim(), g = k => cs.getPropertyValue(k).trim();
    T = { ink: v('ink'), ink2: v('ink-2'), halo: v('halo'), woods: v('woods'), woodsDot: v('woods-dot'), ground: v('ground'), water: v('water'), waterInk: v('water-ink'), block: v('block'), blockLine: v('block-line'),
      lot: v('lot'), ave: v('ave'), hwy: v('hwy'), hwyInk: v('hwy-ink'), grid: v('grid'), ruler: v('ruler'), symbolBg: v('symbol-bg'), corner: v('corner'), cornerInk: v('corner-ink'), cross: v('cross'),
      font: v('font'), fontStreet: v('font-street'), fontDisplay: v('font-display'), wDistrict: v('w-district') || '700', wPlace: v('w-place') || '600', wStreet: v('w-street') || '500', wAve: v('w-ave') || '700',
      agent: v('agent'), agentRing: v('agent-ring'), mine: v('mine'), wanted: g('--k-wanted'), heatOp: +v('heat-op') || .7, turfOp: +v('turf-op') || .3,
      heat: [0, 1, 2, 3, 4].map(k => g('--k-heat-' + k)), heatInk: g('--k-heat-ink'), crews: [1, 2, 3, 4, 5, 6].map(k => v('crew-' + k)),
      ev: Object.fromEntries(['rob', 'arrest', 'death', 'turf', 'director'].map(k => [k, v('ev-' + k) || g('--k-ev-' + k)])), stampKey: v('stamp') === 'key', stampInk: v('stamp-ink') || '#fff' };
    for (const t of ['downtown', 'strip', 'suburbs', 'estates', 'trailer', 'industrial', 'docks', 'junkyard', 'jail', 'hospital', 'highway', 'mall', 'park', 'plaza', 'parking']) T['t-' + t] = v('t-' + t);
  }
  const fontsWanted = new Set();
  function loadFonts() { const u = getComputedStyle(el).getPropertyValue('--k-map-fonts').trim().replace(/^["']|["']$/g, ''); if (u && !fontsWanted.has(u)) { fontsWanted.add(u); document.head.append(h('link', { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${u}&display=swap` })); }
    document.fonts?.ready.then(() => { if (isOpen) { dirty.base = dirty.live = true; schedule(); } }); }

  // ── the legend box (top right): title, lens, layers, symbols, scale bar + north arrow, zoom
  function makeLegend() {
    const badge = lensBadge('live'), btns = new Map(), scaleBar = h('i', { class: 'mp-scale-bar' }), scaleTxt = h('span', { class: 'mp-scale-t' }), heatTxt = h('span', { class: 'mp-heat-mode' });
    const lb = (id, text, tip) => { const b = h('button', { type: 'button', class: 'k-btn mp-layer', 'data-layer': id, 'aria-pressed': String(!!layers[id]), 'data-tip': tip, onclick: () => toggleLayer(id) }, h('i', { class: 'mp-sw', 'data-layer': id }), text);
      btns.set(id, b); return b; };
    const heatB = lb('heat', 'Heat', 'The heat map on the map (M cycles: presence · crimes · deals)'); heatB.append(heatTxt);
    const youRow = h('div', { class: 'mp-you', hidden: true });
    const body = h('div', { class: 'mp-lg-body' },
      h('div', { class: 'mp-layers', role: 'group', 'aria-label': 'Layers' }, lb('places', 'Places', 'The sim’s places: click one for its card'), lb('agents', 'Agents', 'Everyone, where a witness would see them'), lb('events', 'Events', 'Robberies, arrests, deaths, turf, the Director: stamps that fade with age'),
        lb('trails', 'Trails', 'The trails you have on (the dossier’s Where they went)'), heatB, lb('turf', 'Turf', 'Districts tinted by the crew that holds them')),
      youRow,
      h('ul', { class: 'mp-keys', 'aria-label': 'Symbols' },
        h('li', null, h('i', { class: 'mp-k mp-k-ave' }), 'Avenue'), h('li', null, h('i', { class: 'mp-k mp-k-hwy' }), 'Route 9'), h('li', null, h('i', { class: 'mp-k mp-k-bridge' }), 'Bridge'),
        h('li', null, h('i', { class: 'mp-k mp-k-agent' }), 'Agent'), h('li', null, h('i', { class: 'mp-k mp-k-mine' }), 'Yours'), h('li', null, h('i', { class: 'mp-k mp-k-corner' }), 'Corner'),
        ...['rob', 'arrest', 'death', 'turf', 'director'].map(k => h('li', null, h('i', { class: 'mp-k mp-k-ev', 'data-ev': k }), { rob: 'Robbery', arrest: 'Arrest', death: 'Death', turf: 'Turf', director: 'Director' }[k]))),
      h('div', { class: 'mp-foot' }, h('div', { class: 'mp-scale' }, scaleBar, scaleTxt), h('div', { class: 'mp-north', 'aria-label': 'North is up' }, h('b', null, 'N'), h('i')),
        h('div', { class: 'mp-zoom' }, button('', { icon: null, tip: 'Zoom in (+)', cls: 'mp-zin', onclick: () => zoomBy(1.6) }), button('', { tip: 'Zoom out (−)', cls: 'mp-zout', onclick: () => zoomBy(1 / 1.6) }), button('Fit', { tip: 'The whole island (0)', onclick: () => fit(true) }))),
      h('div', { class: 'mp-help k-muted' }, 'drag · wheel/pinch zoom · double-click · + − 0 · B or Esc closes'));
    const collapse = button('', { tip: 'Fold the legend', cls: 'mp-fold', onclick: () => { const f = !el.classList.contains('is-folded'); el.classList.toggle('is-folded', f); attr(collapse, 'aria-expanded', String(!f)); } });
    const head = h('div', { class: 'mp-lg-head' }, h('div', { class: 'mp-title' }, h('b', null, 'AI City'), h('span', null, 'Street map · the island')), badge, collapse);
    const box = h('aside', { class: 'mp-legend', 'data-safe-avoid': '', 'aria-label': 'Map legend' }, head, body);
    box.querySelector('.mp-zin').append('+'); box.querySelector('.mp-zout').append('−');
    return { el: box, badge, btns, scaleBar, scaleTxt, heatTxt, youRow,
      sync() { for (const [k, b] of btns) attr(b, 'aria-pressed', String(!!layers[k])); const ht = toys()?.heat, hm = ht?.mode, hl = ht?.data?.lens; set(heatTxt, layers.heat && hm ? ': ' + hm + (hl && hl !== 'live' ? ' · ' + hl.toUpperCase() : '') : ''); } };
  }
  function toggleLayer(id) {
    if (id === 'heat') {   // (the same control as M: the map shows whatever the heat map is on; with the layer off, a click turns both on)
      const ht = toys()?.heat; if (!ht) { toast('The heat map is still loading'); return; }
      if (!layers.heat) { layers.heat = true; if (!ht.mode) ht.set('presence'); } else { const m = ht.cycle(); if (!m) layers.heat = true; }
      toast(ht.mode ? `Heat: ${ht.mode}` : 'Heat off');
    } else layers[id] = !layers[id];
    try { prefs.set(LAYER_KEY, JSON.stringify(layers)); } catch {}
    legend.sync(); if (id === 'places') dirty.base = true; dirty.tint = dirty.live = true; refresh(true); schedule();
  }

  // ── the view
  const W = () => el.clientWidth || innerWidth, H = () => el.clientHeight || innerHeight;
  function fitView() { const w = W(), hh = H(), padR = Math.min(320, w * .28), s = Math.min((w - padR - 40) / (ISLAND.x1 - ISLAND.x0), (hh - 60) / (ISLAND.z1 - ISLAND.z0));
    return { cx: (ISLAND.x0 + ISLAND.x1) / 2 + padR / 2 / s, cz: (ISLAND.z0 + ISLAND.z1) / 2, s }; }
  const clampS = s => Math.max(SMIN, Math.min(SMAX, s));
  function setView(v2, { animate = false, ms = 260 } = {}) {
    const to = { cx: Math.max(-700, Math.min(700, v2.cx)), cz: Math.max(-560, Math.min(500, v2.cz)), s: clampS(v2.s) };
    if (animate && view) { anim = { from: { ...view }, to, t0: performance.now(), ms }; schedule(); return; }
    view = { ...view, ...to }; dirty.base = dirty.tint = dirty.live = true; schedule();
  }
  function fit(animate = false) { setView(fitView(), { animate }); }
  function zoomBy(k, sx = W() / 2, sy = H() / 2, animate = true) { const v = view, [wx, wz] = toWorld(full(v), sx, sy), s2 = clampS(v.s * k);
    setView({ s: s2, cx: wx - (sx - W() / 2) / s2, cz: wz - (sy - H() / 2) / s2 }, { animate }); }
  const full = v => ({ ...v, W: W(), H: H(), dpr: Math.min(2, devicePixelRatio || 1) });

  // ── rendering: one rAF only while something is dirty or easing; the base sheet is skipped mid-gesture when it is slow (a CSS transform
  // of the last sheet stands in, redrawn once the hand stops)
  function schedule() { if (!raf && isOpen) raf = requestAnimationFrame(render); }
  function sizeCanvas(c, v) { const w = Math.round(v.W * v.dpr), hh = Math.round(v.H * v.dpr); if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; c.style.width = v.W + 'px'; c.style.height = v.H + 'px'; return true; } return false; }
  function render(now) {
    raf = 0; if (!isOpen) return; S.frames++;
    if (anim) { const k = Math.min(1, (now - anim.t0) / anim.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, A = anim.from, B = anim.to;
      const ls = Math.log(A.s) + (Math.log(B.s) - Math.log(A.s)) * e; view = { cx: A.cx + (B.cx - A.cx) * e, cz: A.cz + (B.cz - A.cz) * e, s: Math.exp(ls) }; dirty.base = dirty.tint = dirty.live = true; if (k >= 1) anim = null; }
    const v = full(view), grown = [cvBase, cvTint, cvLive].map(c => sizeCanvas(c, v)).some(Boolean); if (grown) dirty.base = dirty.tint = dirty.live = true;
    const moving = !!anim || gesture.active || wheeling;
    if (dirty.base || dirty.tint) {
      if (moving && S.baseMs > 9 && baseView) { stand(v); clearTimeout(settleT); settleT = setTimeout(() => { dirty.base = dirty.tint = true; schedule(); }, 140); S.skipped++; }
      else { if (dirty.base) { S.baseMs = drawBase(cvBase.getContext('2d'), v, G, T, { reserve: reserved(v), places: layers.places }); S.base++; } drawTint(v); baseView = { ...v }; cvBase.style.transform = cvTint.style.transform = ''; dirty.base = dirty.tint = false; }
    }
    if (dirty.live) { const t0 = performance.now(); drawLive(v); S.liveMs = +(performance.now() - t0).toFixed(2); S.live++; dirty.live = false; }
    if (anim) schedule();
    syncScale(v);
  }
  function stand(v) { const b = baseView, k = v.s / b.s, tx = v.W / 2 * (1 - k) + (b.cx - v.cx) * v.s + (b.W / 2 - v.W / 2) * k, ty = v.H / 2 * (1 - k) + (b.cz - v.cz) * v.s + (b.H / 2 - v.H / 2) * k;
    cvBase.style.transform = cvTint.style.transform = `matrix(${k}, 0, 0, ${k}, ${tx}, ${ty})`; }
  // the screen boxes the labels keep out of: the legend, an open card
  function reserved(v) { const out = [], r0 = el.getBoundingClientRect(); for (const n of [legend.el, card.hidden ? null : card, toys()?.bar]) { if (!n) continue; const r = n.getBoundingClientRect(); if (r.width) out.push([r.left - r0.left - 4, r.top - r0.top - 4, r.right - r0.left + 4, r.bottom - r0.top + 4]); } return out; }
  function syncScale(v) { const target = 90 / v.s, steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000], m = steps.find(x => x >= target * .6) || 1000;
    const w = Math.round(m * v.s); if (legend.scaleBar._w !== w) { legend.scaleBar._w = w; legend.scaleBar.style.width = w + 'px'; set(legend.scaleTxt, m >= 1000 ? m / 1000 + ' km' : m + ' m'); } }

  // ── the tint layer (multiply): turf, then heat
  function drawTint(v) {
    const ctx = cvTint.getContext('2d'); ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); ctx.clearRect(0, 0, v.W, v.H); S.tint++;
    const a = v.s * v.dpr; ctx.setTransform(a, 0, 0, a, (v.W / 2 - v.cx * v.s) * v.dpr, (v.H / 2 - v.cz * v.s) * v.dpr);
    if (layers.turf && data.turf.size) { ctx.globalAlpha = T.turfOp; for (const d of G.districts) { const c = data.turf.get(d.id); if (!c) continue; ctx.fillStyle = c.colour; for (const [i, j] of d.blocks) ctx.fillRect(i * 32, j * 32, 32, 32); } ctx.globalAlpha = 1; }
    const hp = heatPaths(); if (layers.heat && hp) {   // (the bands stacked opaque on a scratch sheet, then printed once at the heat's opacity: no band darkens another)
      const off = scratch(v), g = off.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, off.width, off.height); g.setTransform(a, 0, 0, a, (v.W / 2 - v.cx * v.s) * v.dpr, (v.H / 2 - v.cz * v.s) * v.dpr);
      hp.fills.forEach((p, k) => { g.globalAlpha = k ? 1 : .55; g.fillStyle = T.heat[k]; g.fill(p); }); g.globalAlpha = 1; g.strokeStyle = T.heatInk; g.lineWidth = .7 / v.s; g.stroke(hp.lines);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = T.heatOp; ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1; }
  }
  let scr = null; const scratch = v => { scr ??= document.createElement('canvas'); if (scr.width !== cvTint.width || scr.height !== cvTint.height) { scr.width = cvTint.width; scr.height = cvTint.height; } return scr; };
  // the heat field (2b's heatOf result, as the heat map holds it) → banded contour paths in world space, rebuilt only when it changes
  const BANDS = [.12, .3, .5, .72, .9];
  function heatPaths() {
    const d = toys()?.heat?.data; if (!d || !d.max) { data.heatRef = null; data.heatPaths = null; return null; }
    if (d === data.heatRef) return data.heatPaths;
    // (the 128² field upsampled 2× (bilinear) and softened once, not clipped at the top: round contours, never the cells' squares)
    const n0 = d.n, c0 = d.grid.size / n0, k = 1 / d.max, F0 = new Float32Array(n0 * n0); for (let q = 0; q < n0 * n0; q++) F0[q] = Math.sqrt(Math.max(0, d.values[q]) * k);
    const n = n0 * 2 - 1, c = c0 / 2, U = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = i >> 1, b = j >> 1, fa = (i & 1) * .5, fb = (j & 1) * .5, A = Math.min(n0 - 1, a + 1), Bq = Math.min(n0 - 1, b + 1);
      U[j * n + i] = (F0[b * n0 + a] * (1 - fa) + F0[b * n0 + A] * fa) * (1 - fb) + (F0[Bq * n0 + a] * (1 - fa) + F0[Bq * n0 + A] * fa) * fb; }
    const V = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let sm = 0, w = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= n || y >= n) continue; const ww = a || b ? 1 : 2; sm += U[y * n + x] * ww; w += ww; } V[j * n + i] = sm / w; }
    const x0 = d.grid.x0 + c0 / 2, z0 = d.grid.z0 + c0 / 2, fills = [], lines = new Path2D();
    for (const thr of BANDS) { const f = isoFill(V, n, n, x0, z0, c, thr), P = new Path2D(); for (let q = 0; q < f.rects.length; q += 4) P.rect(f.rects[q], f.rects[q + 1], f.rects[q + 2], f.rects[q + 3]);
      for (const pg of f.polys) { P.moveTo(pg[0], pg[1]); for (let q = 2; q < pg.length; q += 2) P.lineTo(pg[q], pg[q + 1]); P.closePath(); } fills.push(P); }
    // (the contours: the band edges, from the same marching squares)
    for (const thr of BANDS.slice(0, 4)) { const at = (i, j) => V[j * n + i]; for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const C = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
      for (let q = 0; q < 4; q++) { const [ai, aj] = C[q], [bi, bj] = C[(q + 1) % 4], va = at(ai, aj), vb = at(bi, bj); if ((va >= thr) !== (vb >= thr)) { const f = (thr - va) / (vb - va); pts.push(x0 + (ai + (bi - ai) * f) * c, z0 + (aj + (bj - aj) * f) * c); } }
      for (let q = 0; q + 3 < pts.length; q += 4) { lines.moveTo(pts[q], pts[q + 1]); lines.lineTo(pts[q + 2], pts[q + 3]); } } }
    data.heatRef = d; data.heatPaths = { fills, lines }; return data.heatPaths;
  }

  // ── the live layer: trails, event stamps, agents (normal blend: they sit on top of the print)
  function drawLive(v) {
    const ctx = cvLive.getContext('2d'); ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); ctx.clearRect(0, 0, v.W, v.H);
    if (layers.trails) drawTrails(ctx, v);
    if (layers.events) drawEvents(ctx, v);
    if (layers.turf && data.turf.size) drawTurfLabels(ctx, v);
    if (layers.agents) drawAgents(ctx, v);
    if (hover?.kind === 'place') { const p = hover.p, [x, y] = toScreen(v, p.x, p.z); ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = T.ink; ctx.stroke(); }
  }
  // trails: each leg routed along the sidewalks exactly as the 3D trail is (trails.js's own router), a taxi or an unrouted trip a dashed
  // arc; an ink casing, the agent's colour, chevrons the way it walked; stops sized by the stay with their times; in TAPE the part after
  // the tape time is faded, and a dot shows where the agent is at that time
  function drawTrails(ctx, v) {
    const tr = toys()?.trails; if (!tr || !tr.handles.length) return;
    const now = data.lens === 'tape' ? tape.time() : null;
    for (const hd of tr.handles) {
      const d = tr.data(hd), col = tr.colourOf(hd) || T.ink; if (!d || !d.legs) continue;
      for (const L of d.legs) { const P = routeOf(tr, hd, L); if (!P || P.length < 2) continue; const pts = P.map(([x, z]) => toScreen(v, x, z)), fut = now !== null && L.t0 > now;
        ctx.globalAlpha = fut ? .28 : 1; ctx.lineJoin = ctx.lineCap = 'round';
        const path = () => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
        if (P.ride) ctx.setLineDash([7, 6]);
        path(); ctx.strokeStyle = T.ink; ctx.lineWidth = 6.5; ctx.stroke(); path(); ctx.strokeStyle = col; ctx.lineWidth = 3.6; ctx.stroke(); ctx.setLineDash([]);
        if (!P.ride) chevrons(ctx, pts, T.halo); }
      ctx.globalAlpha = 1;
      const stops = d.stops || [], tags = v.s > 1.1 || stops.length <= 10;
      stops.forEach((s, k) => { const [x, y] = toScreen(v, s.x, s.z), r = Math.min(9, 4 + (s.t1 - s.t0) / 90), fut = now !== null && s.t0 > now; ctx.globalAlpha = fut ? .3 : 1;
        ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fillStyle = T.ink; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill();
        if (tags && (s.t1 - s.t0 >= 4 || stops.length < 8)) { const t = hhmm(s.t0); ctx.font = `700 10.5px ${T.fontStreet}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = T.halo; ctx.strokeText(t, x + r + 4, y - 1); ctx.fillStyle = T.ink; ctx.fillText(t, x + r + 4, y - 1); } });
      ctx.globalAlpha = 1;
      if (now !== null) { const p = posAt(d, now); if (p) { const [x, y] = toScreen(v, p.x, p.z); ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.lineWidth = 1.5; ctx.stroke(); } }
    }
  }
  function routeOf(tr, hd, L) {
    const key = hd + ':' + L.id + ':' + L.t0; let P = data.routes.get(key); if (P) return P;
    let R = null; try { R = tr._route?.(L) || null; } catch { R = null; }
    if (R) { P = chaikin(R.map(p => [p[0], p[2]])); P.ride = false; }
    else { const mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2, dx = L.x1 - L.x0, dz = L.z1 - L.z0, len = Math.hypot(dx, dz) || 1, bow = Math.min(60, len * .18); P = [];
      for (let k = 0; k <= 20; k++) { const f = k / 20, b = Math.sin(f * Math.PI) * bow; P.push([L.x0 + dx * f - dz / len * b, L.z0 + dz * f + dx / len * b]); } P.ride = true; }
    if (L.hideStart) { const keep = P.slice(Math.floor(P.length * .5)); keep.ride = P.ride; P = keep; }
    if (data.routes.size > 2000) data.routes.clear(); data.routes.set(key, P); return P;
  }
  const chaikin = P => { for (let it = 0; it < 2; it++) { if (P.length < 3) return P; const Q = [P[0]]; for (let k = 0; k < P.length - 1; k++) { const a = P[k], b = P[k + 1]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .3) { Q.push(b); continue; } Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } Q.push(P[P.length - 1]); P = Q; } return P; };
  function chevrons(ctx, pts, colr) { let acc = 18; ctx.strokeStyle = colr; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], d = Math.hypot(x1 - x0, y1 - y0); if (!d) continue; const ux = (x1 - x0) / d, uy = (y1 - y0) / d; let s = 34 - acc;
      while (s <= d) { const x = x0 + ux * s, y = y0 + uy * s; ctx.beginPath(); ctx.moveTo(x - ux * 3 - uy * 2.6, y - uy * 3 + ux * 2.6); ctx.lineTo(x, y); ctx.lineTo(x - ux * 3 + uy * 2.6, y - uy * 3 - ux * 2.6); ctx.stroke(); s += 34; }
      acc = (acc + d) % 34; } }
  // event stamps: a rubber stamp per event, its kind's colour and glyph, a little turned, fading with age
  function drawEvents(ctx, v) {
    const now = data.t ?? 0, byPlace = new Map();
    for (const e of data.events) { const age = now - e.t; if (age < -1 || age > EV_WINDOW) continue; const n = byPlace.get(e.key) || 0; byPlace.set(e.key, n + 1);
      const a = n * 2.4, rr = n ? 9 + n * 3 : 0, [x0, y0] = toScreen(v, e.x, e.z), x = x0 + Math.cos(a) * rr + 13, y = y0 + Math.sin(a) * rr - 13;
      ctx.globalAlpha = Math.max(.22, 1 - age / EV_WINDOW); stamp(ctx, e.kind, x, y, 9, (e.id % 7 - 3) * .06); e.sx = x; e.sy = y; }
    ctx.globalAlpha = 1;
  }
  function stamp(ctx, kind, x, y, r, rot) {
    const c = T.ev[kind] || T.ink; ctx.save(); ctx.translate(x, y);
    if (T.stampKey) {   // zte (--k-map-stamp: key): a square paper key in the kind's colour on an ink block, the glyph knocked out, never turned
      const q = Math.round(r * .9); ctx.fillStyle = T.ink; ctx.fillRect(-q + 2, -q + 2, q * 2, q * 2); ctx.fillStyle = c; ctx.fillRect(-q, -q, q * 2, q * 2);
      const gc = T.stampInk; ctx.fillStyle = gc; ctx.strokeStyle = gc; ctx.lineWidth = 1.8; ctx.lineCap = 'butt'; const k = r / 9; ctx.scale(k, k); }
    else { ctx.rotate(rot);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = T.halo; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, 7); ctx.lineWidth = .8; ctx.stroke();
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; const k = r / 9; ctx.scale(k, k); }
    if (kind === 'rob') { ctx.beginPath(); ctx.moveTo(-3.4, -3.4); ctx.lineTo(3.4, 3.4); ctx.moveTo(3.4, -3.4); ctx.lineTo(-3.4, 3.4); ctx.stroke(); }
    else if (kind === 'arrest') { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-2, 0, 2.3, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(2.6, 0, 2.3, 0, 7); ctx.stroke(); }
    else if (kind === 'death') { ctx.fillRect(-.9, -4, 1.8, 8); ctx.fillRect(-3, -1.8, 6, 1.6); }
    else if (kind === 'turf') { ctx.fillRect(-2.6, -4, 1.3, 8); ctx.beginPath(); ctx.moveTo(-1.3, -4); ctx.lineTo(3.6, -2.4); ctx.lineTo(-1.3, -.6); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(1, -4.4); ctx.lineTo(-2.6, .6); ctx.lineTo(0, .6); ctx.lineTo(-1, 4.4); ctx.lineTo(2.8, -.8); ctx.lineTo(.2, -.8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function drawTurfLabels(ctx, v) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of G.districts) { const c = data.turf.get(d.id); if (!c) continue; const [x, y] = toScreen(v, d.x, d.z); if (x < -100 || y < -100 || x > v.W + 100 || y > v.H + 100) continue;
      const t = (c.name + (/s$/i.test(c.name) ? '’ turf' : '’s turf')).toUpperCase(); ctx.font = `700 10px ${T.fontStreet}`; ctx.letterSpacing = '1.5px'; const w = ctx.measureText(t).width + 12;
      ctx.fillStyle = c.colour; ctx.fillRect(x - w / 2, y + 14, w, 15); ctx.fillStyle = T.halo; ctx.fillText(t, x, y + 22); ctx.letterSpacing = '0px'; }
  }
  // agents: a pin each (crew colour, ink ring), wanted red, yours the YOURS colour with a YOU flag; the hovered one bigger
  function drawAgents(ctx, v) {
    const mine = data.agents.find(a => a.mine);
    for (const a of data.agents) { if (a.mine) continue; const [x, y] = toScreen(v, a.x, a.z); a.sx = x; a.sy = y; if (x < -20 || y < -20 || x > v.W + 20 || y > v.H + 20) continue;
      const hot = (hover?.kind === 'agent' && hover.a.h === a.h) || data.flash === a.h, r = (a.npc ? 3.6 : 5) * (hot ? 1.35 : 1);
      if (data.flash === a.h) { ctx.beginPath(); ctx.arc(x, y, r + 9, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = T.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r + 14, 0, 7); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fillStyle = T.agentRing; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = a.wanted ? T.wanted : a.colour || T.agent; ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = T.ink; ctx.stroke(); if (a.indoors) { ctx.beginPath(); ctx.arc(x, y, r * .38, 0, 7); ctx.fillStyle = T.agentRing; ctx.fill(); } }
    if (mine) { const [x, y] = toScreen(v, mine.x, mine.z); mine.sx = x; mine.sy = y; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fillStyle = T.mine; ctx.globalAlpha = .25; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, 7.5, 0, 7); ctx.fillStyle = T.mine; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = T.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fillStyle = T.agentRing; ctx.fill();
      ctx.font = `800 10px ${T.fontStreet}`; ctx.letterSpacing = '1px'; const w = ctx.measureText('YOU').width + 10; ctx.fillStyle = T.ink; ctx.fillRect(x + 10, y - 22, w, 14); ctx.beginPath(); ctx.moveTo(x + 10, y - 9); ctx.lineTo(x + 6, y - 5); ctx.lineTo(x + 15, y - 9); ctx.fill();
      ctx.fillStyle = T.mine; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('YOU', x + 15, y - 14.5); ctx.letterSpacing = '0px'; }
  }

  // ── the data: refreshed 4× a second while open (and on a tape seek); the live layer redraws only when what it shows changed
  function lensNow() { return sim.lens === 'archive' ? 'archive' : tape.active ? 'tape' : 'live'; }
  let placeById = null, lotById = null, distById = null;
  function posOf(at) { if (!at) return null; placeById ??= new Map(G.places.map(p => [p.id, p])); lotById ??= new Map(G.lots.map(l => [l.id, l])); distById ??= new Map(G.districts.map(d => [d.id, d]));
    const p = placeById.get(at); if (p) return { x: p.x, z: p.z, key: at }; const l = lotById.get(at); if (l) return { x: l.x0 + l.sx / 2, z: l.z0 + l.sz / 2, key: at }; const d = distById.get(at); if (d) return { x: d.x, z: d.z + 18, key: 'd:' + at }; return null; }
  function refresh(force = false) {
    if (!isOpen) return; const L = lensNow(), tt = L === 'tape' ? tape.time() : null; data.lens = L; data.t = tt ?? sim.clock()?.t ?? 0;
    // agents
    const cards = sim.agents(), crews = L === 'tape' ? data.crews : (sim.world()?.crews || []), crewCol = crewColours(crews), out = [];
    for (const c of cards) { if (c.retired) continue; let card = c, x = null, z = null;
      if (L === 'tape') { const a = tape.agent(c.handle); if (a?.live) card = a.live; if (typeof card.x === 'number') { x = card.x; z = card.z; } }
      if (x === null) { const w = L === 'tape' ? null : sim.where(c.handle); if (w) { x = w.x; z = w.z; } else if (typeof card.x === 'number') { x = card.x; z = card.z; } else { const p = posOf(card.at); if (p) { x = p.x; z = p.z; } } }
      if (x === null || card.status === 'dead') continue;
      // (a witness on the street sees nobody inside someone else's house: in LIVE an agent indoors at a lot that isn't its home is left off
      // the map — a burglar at the house it is burgling, next to the burglary's stamp, would be named by it; the tape shows them)
      if (L === 'live' && card.indoors && String(card.at || '').startsWith('lot:') && card.at !== card.home) continue;
      out.push({ h: c.handle, x, z, mine: sim.me === c.handle, wanted: !!card.wanted, npc: !!c.npc, crew: card.crew || null, colour: card.crew ? crewCol.get(card.crew) : null, now: card.now || '', indoors: !!card.indoors, at: card.at, cls: c.cls }); }
    data.agents = out;
    // events: LIVE the store's public log; TAPE the tape's markers up to the tape time
    const evs = []; const lo = data.t - EV_WINDOW;
    if (L === 'tape') { for (const m of tape.markers() || []) { if (m.t > data.t || m.t < lo) continue; const k = EV_KINDS[m.kind] || (m.kind === 'mark' ? null : m.kind); if (!k || !T.ev[k]) continue; const p = posOf(m.at); if (p) evs.push({ id: m.id, t: m.t, kind: k, text: m.text, x: p.x, z: p.z, key: p.key, at: m.at }); } }
    else for (const e of sim.events({ types: Object.keys(EV_KINDS), since: lo })) { if ((e.type === 'burgle' && !e.ok) || (e.type === 'rob' && e.ok === false)) continue; const p = posOf(e.at); if (p) evs.push({ id: e.id, t: e.t, kind: EV_KINDS[e.type], text: e.text || e.type, x: p.x, z: p.z, key: p.key, at: e.at }); }
    const evSig = evs.map(e => e.id).join(','); if (evSig !== data.evSig) { data.evSig = evSig; data.events = evs; }
    // turf
    data.turf = new Map(); for (const c of crews) for (const d of c.turf || []) data.turf.set(d, { name: c.name, colour: crewCol.get(c.name) });
    // the lens badge
    legend.badge.update(L, L === 'tape' ? (tape.clock?.()?.label ? 'as of ' + tape.clock().label : '') : L === 'archive' ? '' : '');
    legend.youRow.hidden = !sim.me; if (sim.me) set(legend.youRow, `You: @${sim.me}`);
    legend.sync();
    // redraw only what changed
    const s2 = data.agents.map(a => `${a.h}${Math.round(a.x * 2)},${Math.round(a.z * 2)}${a.wanted ? 'w' : ''}`).join('|') + '#' + evs.map(e => e.id).join(',') + '#' + (L === 'tape' ? Math.floor(data.t) : Math.floor(data.t / 10)) + '#' + trailsSig();
    if (force || s2 !== sig) { sig = s2; dirty.live = true; schedule(); }
    const hp = toys()?.heat?.data || null; if (hp !== data.heatRef || turfSig() !== refresh.turf) { refresh.turf = turfSig(); dirty.tint = true; schedule(); }
    if (L === 'tape' && force) tapeCrews();
  }
  const trailsSig = () => { const tr = toys()?.trails; return tr ? tr.handles.map(hd => hd + (tr.data(hd)?.legs?.length ?? '-') + ':' + (tr.data(hd)?.to ?? '')).join(',') : ''; };
  const turfSig = () => (layers.turf ? 1 : 0) + [...data.turf].map(([d, c]) => d + c.name).join(',');
  function crewColours(crews) { const names = crews.map(c => c.name).sort(), m = new Map(); names.forEach((n, k) => m.set(n, T.crews[k % T.crews.length])); return m; }
  // TAPE: the crews as of the tape time (the full state, asked of the tape's worker; at most once a second)
  let crewAsk = 0; function tapeCrews() { if (!tape.active || performance.now() - crewAsk < 900) return; crewAsk = performance.now(); const t = tape.time(); tape.stateAt?.(t)?.then(st => { if (!isOpen || !tape.active) return; data.crews = (st?.crews || []).map(c => ({ name: c.name, turf: c.turf || [] })); refresh(true); }).catch(() => {}); }

  // ── input: pan, zoom, pinch, hover, click
  const gesture = { active: false, pts: new Map(), sx: 0, sy: 0, moved: false, v0: null, d0: 0, mid0: null };
  function wireInput() {
    const local = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    sheet.addEventListener('pointerdown', e => { if (e.button !== 0 && e.pointerType === 'mouse') return; sheet.setPointerCapture(e.pointerId); gesture.pts.set(e.pointerId, local(e));
      if (gesture.pts.size === 1) { const [x, y] = local(e); Object.assign(gesture, { active: true, sx: x, sy: y, moved: false, v0: { ...view } }); }
      if (gesture.pts.size === 2) { const [a, b] = [...gesture.pts.values()]; gesture.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); gesture.mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; gesture.v0 = { ...view }; gesture.moved = true; }
      anim = null; hideLabel(); });
    sheet.addEventListener('pointermove', e => { const p = local(e);
      if (!gesture.active) { hoverAt(p[0], p[1]); return; }
      gesture.pts.set(e.pointerId, p);
      if (gesture.pts.size >= 2) { const [a, b] = [...gesture.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v0 = gesture.v0, s2 = clampS(v0.s * d / Math.max(1, gesture.d0));
        const [wx, wz] = toWorld(full(v0), gesture.mid0[0], gesture.mid0[1]); setView({ s: s2, cx: wx - (mid[0] - W() / 2) / s2, cz: wz - (mid[1] - H() / 2) / s2 }); return; }
      const dx = p[0] - gesture.sx, dy = p[1] - gesture.sy; if (!gesture.moved && Math.hypot(dx, dy) < 4) return; gesture.moved = true; sheet.classList.add('is-drag');
      setView({ s: gesture.v0.s, cx: gesture.v0.cx - dx / gesture.v0.s, cz: gesture.v0.cz - dy / gesture.v0.s }); });
    const end = e => { gesture.pts.delete(e.pointerId); if (gesture.pts.size) { const [p] = [...gesture.pts.values()]; Object.assign(gesture, { sx: p[0], sy: p[1], v0: { ...view } }); return; }
      const was = gesture.active, moved = gesture.moved; gesture.active = false; sheet.classList.remove('is-drag'); if (moved) { dirty.base = dirty.tint = true; schedule(); }
      if (was && !moved && e.type === 'pointerup') { const p = local(e); clickAt(p[0], p[1], e); } };
    sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);
    sheet.addEventListener('pointerleave', () => { if (!gesture.active) { hideLabel(); if (hover) { hover = null; dirty.live = true; schedule(); } } });
    sheet.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = local(e), k = Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0018)); zoomBy(k, x, y, false); wheelEnd(); }, { passive: false });
    sheet.addEventListener('dblclick', e => { const [x, y] = local(e); zoomBy(e.shiftKey ? 1 / 2 : 2, x, y, true); });
    addEventListener('resize', () => { if (isOpen) { dirty.base = dirty.tint = dirty.live = true; schedule(); } });
  }
  // (the wheel's own flag, not the drag's: a pointer move mid-zoom read gesture.active as a drag from gesture.v0 — null before any press,
  // else the last drag's view, so the sheet jumped there — 2026-10-08, slime: "map bug when zooming out")
  let wheelT = 0, wheeling = false; function wheelEnd() { wheeling = true; clearTimeout(wheelT); wheelT = setTimeout(() => { wheeling = false; dirty.base = dirty.tint = true; schedule(); }, 120); }
  // hit tests (screen px): agents, then event stamps, then places
  function hitAt(x, y) {
    const v = full(view);
    // (a place's symbol wins over the agents inside it: clicking St. Mercy opens its card, which lists who is in there)
    let place = null; { let bd = 12; for (const p of G.places) { const [px, py] = toScreen(v, p.x, p.z), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; place = p; } } }
    if (place && layers.agents) { const inside = data.agents.filter(a => { const [ax, ay] = toScreen(v, a.x, a.z); return Math.hypot(ax - x, ay - y) < 11; }); if (inside.length && inside.every(a => a.at === place.id)) return { kind: 'place', p: place }; }
    if (layers.agents) { let best = null, bd = 11; for (const a of data.agents) { [a.sx, a.sy] = toScreen(v, a.x, a.z); const d = Math.hypot(a.sx - x, a.sy - y); if (d < bd) { bd = d; best = a; } }
      if (best) { const near = data.agents.filter(a => Math.hypot(a.sx - best.sx, a.sy - best.sy) < 7); return near.length > 1 ? { kind: 'crowd', list: near, a: best } : { kind: 'agent', a: best }; } }
    if (layers.events) for (const e of data.events) if (e.sx !== undefined && Math.hypot(e.sx - x, e.sy - y) < 10 && data.t - e.t <= EV_WINDOW) return { kind: 'event', e };
    let best = null, bd = 14; for (const p of G.places) { const [px, py] = toScreen(v, p.x, p.z), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = p; } }
    return best ? { kind: 'place', p: best } : null;
  }
  let hoverRaf = 0, hoverXY = null;
  function hoverAt(x, y) { hoverXY = [x, y]; if (hoverRaf) return; hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; const [hx, hy] = hoverXY, r = hitAt(hx, hy), r0 = el.getBoundingClientRect(), X = hx + r0.left, Y = hy + r0.top;
    const key = r ? r.kind + (r.a?.h || r.e?.id || r.p?.id || '') : ''; if (key !== (hover?.key || '')) { hover = r ? { ...r, key } : null; dirty.live = true; schedule(); }
    sheet.style.cursor = r ? 'pointer' : '';
    if (!r) { hideLabel(); return; }
    if (r.kind === 'agent') label.show(X, Y - 6, { name: '@' + r.a.h, sub: r.a.now || r.a.cls || '', wanted: r.a.wanted });
    else if (r.kind === 'crowd') label.names(X, Y - 6, r.list.map(a => '@' + a.h));
    else if (r.kind === 'event') label.show(X, Y - 8, { name: r.e.text, sub: stampOf(r.e.t) + (data.lens === 'tape' ? ' · on tape' : '') });
    else label.show(X, Y - 10, { name: r.p.name, sub: (KIND_NAME[r.p.kind] || r.p.kind) + (r.p.grid ? ' · ' + r.p.grid : '') }); }); }
  function hideLabel() { label?.hide(); }
  function clickAt(x, y, e) {
    closeChooser(); const r = hitAt(x, y);
    if (!r) { if (!card.hidden) closeCard(); return; }
    if (r.kind === 'agent') { closeCard(); hideLabel(); dossier.open(r.a.h, { from: 'map' }); }
    else if (r.kind === 'crowd') openChooser(r.list, x, y);
    else if (r.kind === 'event') { const p = r.e.at && G.places.find(q => q.id === r.e.at); if (p) openCard(p); else toast(r.e.text); }
    else openCard(r.p);
  }
  function openChooser(list, x, y) { const r0 = el.getBoundingClientRect();
    chooser = h('div', { class: 'k-chooser mp-chooser', role: 'menu', 'aria-label': 'Who here' }, h('div', { class: 'k-h' }, `${list.length} here`),
      ...list.map(a => h('button', { type: 'button', role: 'menuitem', onclick: () => { closeChooser(); dossier.open(a.h, { from: 'map' }); } }, '@' + a.h, h('span', null, a.cls || ''))));
    el.append(chooser); chooser.style.transform = `translate(${Math.round(Math.min(W() - 270, x + 12))}px, ${Math.round(Math.min(H() - chooser.offsetHeight - 8, y + 12))}px)`; chooser.querySelector('button')?.focus({ preventScroll: true }); }
  function closeChooser() { chooser?.remove(); chooser = null; }

  // ── the place card: what it is, who's there now (public), what happened there lately, Go there
  let cardPlace = null;
  function openCard(p) {
    cardPlace = p; const L = data.lens, here = data.agents.filter(a => a.at === p.id || (Math.hypot(a.x - p.x, a.z - p.z) < (p.kind === 'corner' ? 10 : 18) && !a.indoors));
    const recent = (L === 'tape' ? tape.events({ to: data.t }).filter(e => e.at === p.id && e.text && e.type !== 'move' && e.type !== 'arrive') : sim.events({ since: data.t - 2 * DAY }).filter(e => e.at === p.id && e.text && e.type !== 'move' && e.type !== 'arrive')).slice(-4).reverse();
    const badge = lensBadge(L, L === 'tape' ? 'as of ' + (tape.clock?.()?.label || '') : '');
    const sym = h('canvas', { class: 'mp-card-sym', width: 56, height: 56, 'aria-hidden': 'true' }); { const g = sym.getContext('2d'); g.scale(2, 2); glyph(g, p.kind, p.id, 14, 14, 12, T); }
    card.replaceChildren(
      h('div', { class: 'mp-card-head' }, sym, h('div', null, h('h3', { class: 'mp-card-name' }, p.name), h('div', { class: 'mp-card-kind k-muted' }, `${KIND_NAME[p.kind] || p.kind}${p.grid ? ' · ' + p.grid : ''}`)), button('', { icon: 'close', tip: 'Close', cls: 'mp-card-x', onclick: () => closeCard() })),
      h('p', { class: 'mp-card-about' }, ABOUT[p.id] || ABOUT[p.kind] || ''),
      h('div', { class: 'mp-card-sec' }, h('div', { class: 'mp-card-h' }, h('span', { class: 'k-h' }, 'Here now'), badge),
        here.length ? h('div', { class: 'mp-card-who' }, ...here.slice(0, 8).map(a => h('button', { type: 'button', class: 'k-chip mp-who', onclick: () => dossier.open(a.h, { from: 'map' }) }, '@' + a.h)), here.length > 8 ? h('span', { class: 'k-muted' }, `+${here.length - 8}`) : '') : h('div', { class: 'k-empty' }, 'Nobody, right now.')),
      h('div', { class: 'mp-card-sec' }, h('div', { class: 'mp-card-h' }, h('span', { class: 'k-h' }, 'Lately here')),
        recent.length ? h('ul', { class: 'k-list' }, ...recent.map(e => h('li', null, h('span', { class: 'k-when' }, stampOf(e.t)), h('span', { class: 'k-what' }, e.text)))) : h('div', { class: 'k-empty' }, 'Quiet.')),
      h('div', { class: 'mp-card-go' }, button('Go there', { icon: 'pin', primary: true, tip: 'Close the map and fly the camera there', onclick: () => goThere(p) })));
    card.hidden = false; placeCard(p); dirty.base = true; schedule();
  }
  function placeCard(p) { if (card.hidden || !p) return; const v = full(view), [x, y] = toScreen(v, p.x, p.z), w = card.offsetWidth || 300, hh = card.offsetHeight || 260;
    let X = x + 22, Y = y - hh / 2; if (X + w > v.W - 12 - (legend.el.getBoundingClientRect().left > v.W / 2 && y < legend.el.offsetHeight + 80 ? legend.el.offsetWidth : 0)) X = x - 22 - w; X = Math.max(26, Math.min(v.W - w - 12, X)); Y = Math.max(26, Math.min(v.H - hh - 90, Y));
    card.style.transform = `translate(${Math.round(X)}px, ${Math.round(Y)}px)`; }
  function closeCard() { if (card.hidden) return; card.hidden = true; cardPlace = null; dirty.base = true; schedule(); }
  // Go there: the map closes and the camera goes to the place through ui/goto.js (the one helper every screen uses); if that can't, the
  // rig's eased hop here, framed as the Go-to list does
  function goThere(p) {
    close(); toast(`Going to ${p.name}`); if (flyTo(api, { place: p.id, label: p.name })) return; const rig = api.cam, cam = api.camera, tgt = api.controls.target, woods = ['lab', 'site'].includes(p.kind) && ['woods', 'lab-north', 'lab-west', 'lab-south'].includes(p.id);
    const dist = woods ? 44 : 46, pitch = woods ? 1.25 : .62; let ox = cam.position.x - tgt.x, oz = cam.position.z - tgt.z; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol; if (ol < 1e-3) { ox = 0; oz = 1; }
    const view2 = { pos: [p.x + ox * dist * Math.cos(pitch), dist * Math.sin(pitch), p.z + oz * dist * Math.cos(pitch)], tgt: [p.x, 0, p.z], fov: cam.fov };
    if (rig?.toOrbit) rig.toOrbit({ view: view2 }); else api.goTo?.(p.x, p.z, p.name);
  }

  // ── open / close
  let renderOrig = null;
  function pauseCity(on) {   // (the 3D city stops drawing behind the sheet; its frame keeps running. Not while a clip records the canvas)
    const post = api.post; if (!post) return;
    if (on && !renderOrig && !toys()?.clips?.recording) { renderOrig = { own: Object.getOwnPropertyDescriptor(post, 'render') || null }; const f = post.render; post.render = function () { if (toys()?.clips?.recording) return f.apply(this, arguments); }; S.paused = true; }
    if (!on && renderOrig) { if (renderOrig.own) Object.defineProperty(post, 'render', renderOrig.own); else delete post.render; renderOrig = null; S.paused = false; }
  }
  function open({ at = null, place = null } = {}) {
    if (isOpen) { if (place) { const p = G.places.find(q => q.id === place); if (p) { focus(p.x, p.z, Math.max(view.s, 2.2)); openCard(p); } } return true; }
    build(); isOpen = true; S.opens++; readTokens(); loadFonts(); screens.open('map', { esc: escStep, isOpen: () => isOpen });   // (the Esc stack: kit.js)
    el.classList.add('is-open'); attr(el, 'aria-hidden', 'false'); root.classList.add('is-map');
    if (!view) view = fitView();
    if (at) view = { ...view, cx: at.x, cz: at.z, s: Math.max(view.s, at.s || 1.4) };
    dirty.base = dirty.tint = dirty.live = true; pauseCity(true);
    refresh(true); schedule();
    tick = setInterval(() => refresh(false), 250);
    unsubs.push(sim.on('tick', () => refresh(false)));
    for (const ev of ['seek', 'mode', 'time']) { const u = tape.on?.(ev, () => { refresh(ev !== 'time'); if (ev !== 'time') tapeCrews(); else if (performance.now() - crewAsk > 1500) tapeCrews(); }); if (typeof u === 'function') unsubs.push(u); }
    if (place) { const p = G.places.find(q => q.id === place); if (p) openCard(p); }
    return true;
  }
  function close() {
    if (!isOpen) return false; isOpen = false; screens.close('map'); clearInterval(tick); tick = 0; for (const u of unsubs) u(); unsubs = []; cancelAnimationFrame(raf); raf = 0; anim = null; clearTimeout(settleT);
    closeCard(); closeChooser(); hideLabel(); hover = null; data.flash = null; gesture.active = false; gesture.pts.clear(); wheeling = false; clearTimeout(wheelT);
    el.classList.remove('is-open'); attr(el, 'aria-hidden', 'true'); root.classList.remove('is-map'); pauseCity(false);
    for (const c of [cvBase, cvTint, cvLive, scr]) if (c) { c.width = c.height = 0; } baseView = null; data.routes.clear(); data.heatRef = null; data.heatPaths = null;   // (the canvases released)
    return true;
  }
  const toggle = () => isOpen ? close() : open();
  const escStep = () => { if (chooser) closeChooser(); else if (!card.hidden) closeCard(); else close(); };   // (Esc: its chooser, its place card, then the map)
  function focus(x, z, s = view?.s ?? 1.6) { if (!view) view = fitView(); setView({ cx: x, cz: z, s }, { animate: isOpen }); }

  // the dossier's way in: its agent on the map (a pin button in its "more" row, next to 2b's Where they went · Diary)
  const mapB = button('', { icon: 'pin', tip: 'On the map (B)', cls: 'dm-map', onclick: () => { const c = dossier.current; if (!c) return; const w = sim.where(c), a = sim.agent(c)?.live; open(); data.flash = c;
    const x = w?.x ?? a?.x, z = w?.z ?? a?.z; if (typeof x === 'number') focus(x, z, Math.max(view.s, 2.4)); dirty.live = true; schedule(); } });
  dossier.more?.append(mapB);
  // ── keys: B toggles; with the map open Esc closes (after the card, the chooser and the dossier), + − zoom, 0 fits, WASD / arrows pan
  // (arrows only outside TAPE: there they step the tape). The camera never sees a key while the map is open.
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  const PAN = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const CAM_KEYS = /^(Key[WASDQERFGXZCVH]|Tab|Digit[1-5]|Numpad[1-5]|Shift(Left|Right))$/;
  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; const k = e.code;
    if (k === 'KeyB' && !e.shiftKey && !e.defaultPrevented) { if (document.body.classList.contains('cam-photo')) return; e.preventDefault(); e.stopPropagation(); toggle(); return; }
    if (!isOpen || e.defaultPrevented) return;
    // N (City TV) and L (The City) open their side panel, which sits under the full-screen map: the map goes first, as the menu's TV and
    // City do, and the key goes on to 3a (registered after this), which opens the panel (UI-keys leftover: they opened under the map)
    if ((k === 'KeyN' || k === 'KeyL') && !e.shiftKey) { close(); return; }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); escStep(); return; }   // (the Esc stack, kit.js, has it first: this only if it is off the stack)
    if (k === 'Equal' || k === 'NumpadAdd') { e.preventDefault(); e.stopPropagation(); zoomBy(1.6); return; }
    if (k === 'Minus' || k === 'NumpadSubtract') { e.preventDefault(); e.stopPropagation(); zoomBy(1 / 1.6); return; }
    if (k === 'Digit0' || k === 'Numpad0') { e.preventDefault(); e.stopPropagation(); fit(true); return; }
    if (PAN[k] && !(tape.active && k.startsWith('Arrow'))) { e.preventDefault(); e.stopPropagation(); const [dx, dz] = PAN[k], step = (e.shiftKey ? 360 : 140) / view.s; setView({ ...view, cx: view.cx + dx * step, cz: view.cz + dz * step }, { animate: true, ms: 180 }); return; }
    if (CAM_KEYS.test(k)) { e.stopPropagation(); }   // (the camera and nav stay put behind the map)
  }, true);
  // the card follows its place when the view moves
  const _render = render; render = function (now) { _render(now); if (cardPlace) placeCard(cardPlace); };

  const self = { open, close, toggle, focus, fit: () => fit(true), get isOpen() { return isOpen; }, get view() { return view && { ...view }; }, setView: v2 => setView(v2), place: id => { const p = (G || buildGeo()).places.find(q => q.id === id); if (p) { open(); focus(p.x, p.z, Math.max(view.s, 2.2)); openCard(p); } return p || null; },
    layers: () => ({ ...layers }), setLayer: (id, on) => { if (!LAYERS.includes(id) || !!layers[id] === !!on) return; if (id === 'heat') { layers.heat = !!on; } else layers[id] = !!on; try { prefs.set(LAYER_KEY, JSON.stringify(layers)); } catch {} legend?.sync(); dirty.base = dirty.tint = dirty.live = true; refresh(true); schedule(); },
    hit: (x, y) => hitAt(x, y), screenOf: (x, z) => view ? toScreen(full(view), x, z) : null, data: () => ({ agents: data.agents.length, events: data.events.length, turf: [...data.turf.keys()], lens: data.lens, t: data.t }),
    stats: () => ({ open: isOpen, ...S, view: view && { cx: +view.cx.toFixed(1), cz: +view.cz.toFixed(1), s: +view.s.toFixed(3) }, layers: { ...layers } }) };
  window.__map = self;
  return self;
}
