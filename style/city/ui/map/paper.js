// HUMAN LAYER · SECTION 3b · THE CITY MAP, THE PRINTED SHEET: the base map drawn from ui/map/geo.js onto one canvas, for one view.
// It is called only when the view (pan, zoom, size) or the skin changes, never on a timer. The canvas wears `mix-blend-mode: multiply`
// over the paper (map.css), so the tints and the ink print onto the paper's grain and white reads as paper.
//   order    woods · the city's ground · water + coast + ripple lines · block tints + outlines · lot lines (close in) · roads (avenues
//            yellow, Route 9 with its casing, the bridges cased over the water) · the page grid · place symbols · labels (districts, places,
//            streets: one collision pass, so nothing prints over anything) · the grid rulers on the sheet's edges
// Colours and fonts are tokens only (--k-map-*, map.css per skin): T is the token table read by index.js.
import { GRID } from './geo.js';

// view: { cx, cz, s (CSS px per metre), W, H (CSS px), dpr }
export const toScreen = (v, x, z) => [(x - v.cx) * v.s + v.W / 2, (z - v.cz) * v.s + v.H / 2];
export const toWorld = (v, sx, sy) => [(sx - v.W / 2) / v.s + v.cx, (sy - v.H / 2) / v.s + v.cz];
const worldXf = (ctx, v) => { const a = v.s * v.dpr; ctx.setTransform(a, 0, 0, a, (v.W / 2 - v.cx * v.s) * v.dpr, (v.H / 2 - v.cz * v.s) * v.dpr); };
const screenXf = (ctx, v) => ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);

// cached world-space paths (built once per geometry)
const PATHS = new WeakMap();
function pathsOf(G) {
  let p = PATHS.get(G); if (p) return p;
  const rects = r => { const P = new Path2D(); for (let k = 0; k < r.length; k += 4) P.rect(r[k], r[k + 1], r[k + 2], r[k + 3]); return P; };
  const segs = s => { const P = new Path2D(); for (let k = 0; k < s.length; k += 4) { P.moveTo(s[k], s[k + 1]); P.lineTo(s[k + 2], s[k + 3]); } return P; };
  const water = rects(G.water.rects); for (const pg of G.water.polys) { water.moveTo(pg[0], pg[1]); for (let k = 2; k < pg.length; k += 2) water.lineTo(pg[k], pg[k + 1]); water.closePath(); }
  const tints = new Map(); for (const b of G.blocks) { if (!tints.has(b.tint)) tints.set(b.tint, new Path2D()); tints.get(b.tint).rect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
  const outline = new Path2D(); for (const b of G.blocks) outline.rect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
  const lots = new Path2D(); for (const l of G.lots) lots.rect(l.x0, l.z0, l.sx, l.sz);
  p = { water, coast: segs(G.coast), ripples: G.ripples.map(segs), ground: rects(G.ground), tints, outline, lots }; PATHS.set(G, p); return p;
}
const F = G => [G.frame.x0, G.frame.z0, G.frame.x1 - G.frame.x0, G.frame.z1 - G.frame.z0];

// ── the place symbols: a badge (paper disc, ink ring) and a glyph per kind, drawn in a 16 × 16 box centred on the place
export function glyph(ctx, kind, id, x, y, r, T) {
  ctx.save(); ctx.translate(x, y);
  const corner = kind === 'corner';
  ctx.beginPath(); if (corner) { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); } else ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = corner ? T.corner : T.symbolBg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.ink; ctx.stroke();
  const k = r / 9; ctx.scale(k, k); ctx.fillStyle = ctx.strokeStyle = corner ? T.cornerInk : T.ink; ctx.lineWidth = 1.6; ctx.lineCap = ctx.lineJoin = 'round';
  const poly = pts => { ctx.beginPath(); pts.forEach(([a, b], q) => q ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); };
  const word = (t, sz = 8) => { ctx.font = `700 ${sz}px ${T.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, .5); };
  switch (id === 'heap' || id === 'mall' || id === 'docks' || id === 'woods' ? id : kind) {
    case 'police': { const s = []; for (let q = 0; q < 10; q++) { const a = -Math.PI / 2 + q * Math.PI / 5, rr = q % 2 ? 2.4 : 5.4; s.push([Math.cos(a) * rr, Math.sin(a) * rr + .4]); } poly(s); ctx.fill(); break; }
    case 'court': poly([[-5.5, -1.5], [0, -5.5], [5.5, -1.5]]); ctx.fill(); for (const cx of [-3.6, 0, 3.6]) ctx.fillRect(cx - .8, -.8, 1.6, 4.6); ctx.fillRect(-5.8, 4, 11.6, 1.6); break;
    case 'plaza': ctx.strokeRect(-4.2, -4.2, 8.4, 8.4); ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, 7); ctx.fill(); break;
    case 'fit': ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 2.5); ctx.stroke(); poly([[-3.4, .6], [3.4, .6], [0, 4.8]]); ctx.fill(); ctx.fillRect(-5, 5, 10, 1.4); break;
    case 'motel': word('M', 10); break;
    case 'store': word('24', 8); break;
    case 'hospital': ctx.fillStyle = T.cross; ctx.fillRect(-1.7, -5, 3.4, 10); ctx.fillRect(-5, -1.7, 10, 3.4); break;
    case 'jail': for (const bx of [-3.6, -1.2, 1.2, 3.6]) ctx.fillRect(bx - .6, -5, 1.2, 10); ctx.fillRect(-5, -5, 10, 1.2); ctx.fillRect(-5, 3.8, 10, 1.2); break;
    case 'hangout': ctx.strokeRect(-5, -3, 9, 5.4); ctx.beginPath(); ctx.arc(-2, 3.6, 1.5, 0, 7); ctx.fill(); ctx.fillRect(4, -.5, 2, 1.2); break;
    case 'park': poly([[0, -5.5], [4.5, 2], [-4.5, 2]]); ctx.fill(); ctx.fillRect(-.8, 2, 1.6, 3.5); break;
    case 'heap': ctx.beginPath(); ctx.arc(0, 0, 3.3, 0, 7); ctx.stroke(); for (let q = 0; q < 6; q++) { const a = q * Math.PI / 3; ctx.fillRect(Math.cos(a) * 4.4 - 1, Math.sin(a) * 4.4 - 1, 2, 2); } break;
    case 'mall': poly([[0, -5.5], [4, 0], [0, 5.5], [-4, 0]]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke(); break;
    case 'docks': ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.bezierCurveTo(4.5, 0, 4, 4.8, 0, 4.8); ctx.bezierCurveTo(-4, 4.8, -4.5, 0, 0, -5.5); ctx.fill(); break;
    case 'woods': ctx.beginPath(); ctx.moveTo(-4.5, 4.5); ctx.bezierCurveTo(-5, -3, 1, -5.5, 5, -5); ctx.bezierCurveTo(5, 1, 0, 5, -4.5, 4.5); ctx.fill(); ctx.strokeStyle = T.symbolBg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3.5, 3.5); ctx.lineTo(3, -3); ctx.stroke(); break;
    case 'lab': poly([[-1.6, -5], [1.6, -5], [1.6, -1.5], [4.6, 4.6], [-4.6, 4.6], [-1.6, -1.5]]); ctx.stroke(); ctx.fillRect(-3.6, 2, 7.2, 2.6); break;
    case 'corner': word('$', 9); break;
    default: ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// collision boxes (screen px): [x0, y0, x1, y1]
const hits = (B, b) => { for (const q of B) if (b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]) return true; return false; };

export function drawBase(ctx, v, G, T, opt = {}) {
  const t0 = performance.now(), P = pathsOf(G), px = 1 / v.s;   // (one CSS px in world units, for line widths)
  screenXf(ctx, v); ctx.clearRect(0, 0, v.W, v.H);
  worldXf(ctx, v);
  // the woods (the land outside the city), with a tree stipple pinned to the screen; the city's ground; the water
  ctx.fillStyle = T.water; ctx.fillRect(-6000, -6000, 12000, 12000);   // (past the frame it is all sea)
  ctx.fillStyle = T.woods; ctx.fillRect(...F(G));
  if (T.woodsDot) { const pat = treePattern(ctx, T, v.dpr); if (pat) { const k = 1 / (v.s * v.dpr); pat.setTransform(new DOMMatrix([k, 0, 0, k, -(v.W / 2 - v.cx * v.s) / v.s, -(v.H / 2 - v.cz * v.s) / v.s])); ctx.fillStyle = pat; ctx.fillRect(...F(G)); } }   // (the tile pinned to device pixels)
  ctx.fillStyle = T.ground; ctx.fill(P.ground);
  ctx.fillStyle = T.water; ctx.fill(P.water);
  ctx.strokeStyle = T.waterInk; ctx.lineCap = 'round';
  ctx.globalAlpha = .55; ctx.lineWidth = .7 * px; for (const r of P.ripples) ctx.stroke(r); ctx.globalAlpha = 1;
  ctx.lineWidth = 1.3 * px; ctx.stroke(P.coast);
  // blocks: the tints, then a hairline round each
  for (const [tint, path] of P.tints) { ctx.fillStyle = T['t-' + tint] || T.block; ctx.fill(path); }
  ctx.strokeStyle = T.blockLine; ctx.lineWidth = .8 * px; ctx.stroke(P.outline);
  if (v.s >= 1.5) { ctx.globalAlpha = Math.min(1, (v.s - 1.5) / 1.2); ctx.strokeStyle = T.lot; ctx.lineWidth = .7 * px; ctx.stroke(P.lots); ctx.globalAlpha = 1; }
  // roads: avenues a yellow band, Route 9 red-orange with an ink casing, the bridges cased over the water (streets are the paper itself)
  const band = (r, w) => { ctx.beginPath(); if (r.axis === 'x') { ctx.moveTo(r.at, r.a); ctx.lineTo(r.at, r.b); } else { ctx.moveTo(r.a, r.at); ctx.lineTo(r.b, r.at); } ctx.lineWidth = w; ctx.stroke(); };
  ctx.lineCap = 'butt';
  for (const r of G.roads) if (r.bridge) { ctx.strokeStyle = T.ink; band(r, Math.max(2 * r.hw + 3.2, 7 * px)); ctx.strokeStyle = r.cls === 'hwy' ? T.hwy : T.ground; band(r, Math.max(2 * r.hw + 1.2, 4.6 * px)); }
  for (const r of G.roads) if (!r.bridge && r.cls === 'ave') { ctx.strokeStyle = T.ave; band(r, Math.max(2 * r.hw - .6, 2.2 * px)); }
  for (const r of G.roads) if (!r.bridge && r.cls === 'hwy') { ctx.strokeStyle = T.ink; band(r, Math.max(2 * r.hw + 1.6, 5.4 * px)); ctx.strokeStyle = T.hwy; band(r, Math.max(2 * r.hw - .4, 3.4 * px)); }
  for (const r of G.roads) if (r.cls === 'hwy' && v.s > 1.4) { ctx.strokeStyle = T.ink; ctx.setLineDash([6 * px, 6 * px]); band(r, .9 * px); ctx.setLineDash([]); }
  // the page grid (screen space: crisp hairlines)
  screenXf(ctx, v);
  ctx.strokeStyle = T.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let c = 0; c <= GRID.cols; c++) { const x = Math.round((GRID.x0 + c * GRID.cell - v.cx) * v.s + v.W / 2) + .5; if (x > -1 && x < v.W + 1) { ctx.moveTo(x, 0); ctx.lineTo(x, v.H); } }
  for (let r = 0; r <= GRID.rows; r++) { const y = Math.round((GRID.z0 + r * GRID.cell - v.cz) * v.s + v.H / 2) + .5; if (y > -1 && y < v.H + 1) { ctx.moveTo(0, y); ctx.lineTo(v.W, y); } }
  ctx.stroke();
  // ── symbols and labels, one collision list (the map's own UI boxes are reserved first)
  const B = (opt.reserve || []).slice(), on = (x, y, m = 40) => x > -m && y > -m && x < v.W + m && y < v.H + m;
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const label = (text, x, y, { font, fill = T.ink, halo = T.halo, hw = 3, rot = 0, spacing = '0px', alpha = 1, force = false, pad = 2 } = {}) => {
    ctx.font = font; ctx.letterSpacing = spacing; const w = ctx.measureText(text).width, hgt = parseFloat(font.match(/(\d+(\.\d+)?)px/)?.[1] || 12);
    const bw = rot ? hgt : w, bh = rot ? w : hgt, b = [x - bw / 2 - pad, y - bh / 2 - pad, x + bw / 2 + pad, y + bh / 2 + pad];
    if (!force && hits(B, b)) return false; B.push(b);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.textAlign = 'center';
    if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = hw; ctx.strokeText(text, 0, 0); } ctx.fillStyle = fill; ctx.fillText(text, 0, 0); ctx.restore(); ctx.letterSpacing = '0px'; return true; };
  // places: the symbol always (it is the map's point), the name when it fits
  const R = Math.max(7, Math.min(11, 6 + v.s * 2.4));
  // the symbols' boxes first (so nothing prints on a symbol), then the places' names, then the districts', then the streets'
  for (const p of G.places) { const [x, y] = toScreen(v, p.x, p.z); if (!on(x, y)) continue; const r = p.kind === 'corner' ? R * .72 : R; B.push([x - r - 1, y - r - 1, x + r + 1, y + r + 1]); }
  for (const p of G.places) { if (p.kind === 'corner') continue; const [x, y] = toScreen(v, p.x, p.z); if (!on(x, y)) continue; const fs = Math.round(Math.max(10, Math.min(13, 9 + v.s * 1.4)));
    label(p.name, x, y + R + 8, { font: `${T.wPlace} ${fs}px ${T.font}`, hw: 3.4 }) || label(p.name, x, y - R - 8, { font: `${T.wPlace} ${fs}px ${T.font}`, hw: 3.4 }); }
  // district names first: big, spaced, faint, under the symbols (a district named after its place — Iron Island, St. Mercy, Sunny Acres,
  // The Heap, Low Tide Docks, the mall, Route 9 — is named by its place or its road instead)
  const placeNames = new Set(G.places.map(p => p.name.toLowerCase()));
  for (const d of G.districts) { const [x, y] = toScreen(v, d.x, d.z); if (!on(x, y, 200) || (!d.woods && (placeNames.has(d.name.toLowerCase()) || d.id === 'highway' || d.id === 'mall'))) continue; const sz = Math.round(Math.max(11, Math.min(d.sea || d.woods ? 30 : 24, (d.sea || d.woods ? 7 : 6) + v.s * (d.sea || d.woods ? 9 : 7) * Math.sqrt(Math.min(d.n, 12) / 6))));
    const o = { font: `${T.wDistrict} ${sz}px ${T.fontDisplay}`, fill: d.sea ? T.waterInk : T.ink2, spacing: Math.round(sz * .22) + 'px', alpha: .62, hw: 4, halo: d.sea ? null : T.halo };
    if (![0, -26, 26, -52, 52].some(dy => label(d.name.toUpperCase(), x, y + dy, o))) label(d.name.toUpperCase(), x, y, { ...o, alpha: .45, force: true }); }   // (crowded: printed faint anyway, under the rest)
  for (const p of G.places) { const [x, y] = toScreen(v, p.x, p.z); if (!on(x, y)) continue; const r = p.kind === 'corner' ? R * .72 : R; glyph(ctx, p.kind, p.id, x, y, r, T); B.push([x - r - 1, y - r - 1, x + r + 1, y + r + 1]); }
  // street names: along each run, spaced so they repeat every ~ 420 px; minor streets only from closer in
  const minS = { hwy: 0, ave: .55, street: 1.05 };
  for (const r of G.roads) { if (v.s < minS[r.cls] || r.bridge) continue; const name = r.cls === 'hwy' ? r.name.toUpperCase() : r.name, fs = r.cls === 'street' ? 10.5 : 11.5;
    const font = `${r.cls === 'street' ? T.wStreet : T.wAve} ${fs}px ${T.fontStreet}`; ctx.font = font; const tw = ctx.measureText(name).width, lenPx = (r.b - r.a) * v.s; if (lenPx < tw + 16) continue;
    const gap = Math.max(tw + 60, 420) / v.s, n = Math.max(1, Math.floor((r.b - r.a) / gap)), step = (r.b - r.a) / n;
    for (let q = 0; q < n; q++) { const m = r.a + (q + .5) * step, [x, y] = r.axis === 'x' ? toScreen(v, r.at, m) : toScreen(v, m, r.at); if (!on(x, y)) continue;
      label(name, x, y, { font, rot: r.axis === 'x' ? -Math.PI / 2 : 0, fill: r.cls === 'hwy' ? T.hwyInk : T.ink, hw: 3.2 }); } }
  // the rulers: the grid's letters along the top edge, its numbers down the left (the sheet's frame)
  const RW = 18; ctx.font = `700 11px ${T.fontStreet}`; ctx.textAlign = 'center';
  ctx.fillStyle = T.ruler; ctx.fillRect(0, 0, v.W, RW); ctx.fillRect(0, 0, RW, v.H);
  ctx.fillStyle = T.ink; ctx.fillRect(0, RW - 1, v.W, 1); ctx.fillRect(RW - 1, 0, 1, v.H);
  for (let c = 0; c < GRID.cols; c++) { const x = (GRID.x0 + (c + .5) * GRID.cell - v.cx) * v.s + v.W / 2; if (x > RW && x < v.W) ctx.fillText(String.fromCharCode(65 + c), x, RW / 2 + .5); }
  for (let r = 0; r < GRID.rows; r++) { const y = (GRID.z0 + (r + .5) * GRID.cell - v.cz) * v.s + v.H / 2; if (y > RW && y < v.H) ctx.fillText(String(r + 1), RW / 2, y + .5); }
  return +(performance.now() - t0).toFixed(2);
}

// a tiny tree stipple for the woods (a tile per skin and pixel ratio, cached)
let patKey = null, patTile = null;
function treePattern(ctx, T, dpr) {
  const key = T.woodsDot + dpr; if (key !== patKey) { patKey = key; const n = Math.round(22 * dpr), c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
    g.scale(dpr, dpr); g.fillStyle = T.woodsDot; for (const [x, y] of [[5, 6], [16, 15]]) { g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 2.6, y + 1.6); g.lineTo(x - 2.6, y + 1.6); g.closePath(); g.fill(); g.fillRect(x - .5, y + 1.6, 1, 1.6); }
    patTile = c; }
  return ctx.createPattern(patTile, 'repeat');
}
