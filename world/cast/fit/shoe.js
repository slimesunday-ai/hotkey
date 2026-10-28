// SHOES · the rigid foot. A shoe is one connected rigid piece per foot in its own grid (compose's SH): pants can never overwrite,
// delete or reparent a shoe cell, and in the animated bake every shoe cell rides foot 8 / 9 (anim/bake.js).
//
// Foot-local coordinates, mirrored per side: u grows OUTWARDS from the fixed inner edge (u0 = x −2 on the left foot, x 1 on the
// right), y up (0 = ground), z heel → toe (+z is the toe).
//   envelope   u 0..4 · y 0..3 · ground cells (y 0) inside z −3..5 · z −4 (a heel tab) and z 6 (a raised toe point) only above y 0.
//              u 5 meets the hands-in-pockets idle's hand: keep out. The two-voxel inner gap between the feet is never filled.
//   socket     the 3×3 ankle seat at y 3: u 0..2, z −1..1. Every shoe owns it (drawShoe fills it if the design doesn't); the leg's
//              cloth starts right above it at y 4. By default it is DRESSED: under full pants it takes the pant's colour, under shorts
//              the skin or sock (dressAnkle), so no shoe-coloured band shows at the ankle. A design that wants its own collar colour
//              there registers `ankle: 'shoe'`.
//   rows       y 0 sole · y 1 sole / welt · y 2 upper · y 3 collar and tongue. Nothing above y 3: the pant leg owns y 4 up.
// LASTS are approved, motion-checked volumes (cells [u, y, z, region]); a shoe either PAINTS a last (registry `last` + `paint`) or
// DRAWS free-form inside the envelope on a foot pad (registry `draw`). A free-form shoe is a new shape: run the lower-body motion
// check (style/city/anim/lower-motion-check.mjs) before calling it done.
import { SHAPES } from './shoe-shapes.js';

export const ENVELOPE = { u: [0, 4], y: [0, 3], z: [-3, 5], heelTab: -4, toePoint: 6 };
export const isSocket = (u, y, z) => y === 3 && u >= 0 && u <= 2 && z >= -1 && z <= 1;
export const footX = (side, u) => side < 0 ? -2 - u : 1 + u;

// the tongue last: a continuous two-tier sole, a broad low toe box and an upright tongue (the base kit's shoe)
const tongue = [];
for (const [y, z0, z1, width, region] of [[0, -3, 5, 5, 'outsole'], [1, -3, 5, 5, 'midsole'], [2, -2, 4, 4, 'upper'], [3, 2, 2, 3, 'tongue']])
  for (let u = 0; u < width; u++) for (let z = z0; z <= z1; z++) tongue.push([u, y, z, region]);
export const LASTS = { tongue, ...Object.fromEntries(SHAPES.map(s => [s.id, s.cells.map(([u, y, z, r]) => [u, y, z, r === 0 ? 'sole' : 'upper'])])) };
// a last's cells with their exposure flags (outer / front / back / top: the neighbour in that direction is empty), socket included
export function lastCells(id) {
  const cells = LASTS[id]; if (!cells) return null;
  const occ = new Set(cells.map(([u, y, z]) => `${u},${y},${z}`)); for (let u = 0; u < 3; u++) for (let z = -1; z <= 1; z++) occ.add(`${u},3,${z}`);
  return cells.map(([u, y, z, region]) => Object.freeze({ u, y, z, region, outer: !occ.has(`${u + 1},${y},${z}`), front: !occ.has(`${u},${y},${z + 1}`),
    back: !occ.has(`${u},${y},${z - 1}`), top: !occ.has(`${u},${y + 1},${z}`) }));
}

// a foot pad: foot-local cells for one foot (mirrored onto both by drawShoe). Inclusive boxes and spans.
export function footPad() {
  const cells = new Map(), k = (u, y, z) => `${u},${y},${z}`, cl = c => Array.isArray(c) ? c : [c, 0];
  const F = {
    cells,
    set(u, y, z, c, l) { if (c === undefined || c === null) return; const [cc, ll] = Array.isArray(c) ? c : [c, l ?? 0]; cells.set(k(u, y, z), [u, y, z, cc, ll]); },
    del(u, y, z) { cells.delete(k(u, y, z)); },
    has(u, y, z) { return cells.has(k(u, y, z)); },
    get(u, y, z) { return cells.get(k(u, y, z))?.[3]; },
    paint(u, y, z, c, l) { const q = cells.get(k(u, y, z)); if (!q) return; const [cc, ll] = Array.isArray(c) ? c : [c, l ?? q[4]]; cells.set(k(u, y, z), [u, y, z, cc, ll]); },
    box(u0, u1, y0, y1, z0, z1, c, l) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let u = u0; u <= u1; u++) F.set(u, y, z, typeof c === 'function' ? c(u, y, z) : c, l); },
    rows(y, z0, spans, c, l) { spans.forEach((s, i) => { if (s) for (let u = s[0]; u <= s[1]; u++) F.set(u, y, z0 + i, typeof c === 'function' ? c(u, y, z0 + i) : c, l); }); },
    each(fn) { for (const q of [...cells.values()]) fn(...q); },
    _cl: cl,
  };
  return F;
}

// envelope problems for a foot's cells ([u, y, z, …]); [] when it fits
export function envelopeProblems(cells) {
  const out = [], occ = new Set(cells.map(([u, y, z]) => `${u},${y},${z}`));
  for (const [u, y, z] of cells) {
    if (u < 0 || u > 4) out.push(`cell u ${u} outside u 0..4`);
    if (y < 0 || y > 3) out.push(`cell y ${y} outside y 0..3`);
    if (z < -4 || z > 6 || (y === 0 && (z < -3 || z > 5))) out.push(`cell z ${z} at y ${y} outside the ground footprint`);
  }
  // one 6-connected piece
  if (cells.length) { const seen = new Set(), q = [`${cells[0][0]},${cells[0][1]},${cells[0][2]}`]; seen.add(q[0]);
    while (q.length) { const [u, y, z] = q.pop().split(',').map(Number); for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const n = `${u + a},${y + b},${z + c}`; if (occ.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
    if (seen.size !== occ.size) out.push(`${occ.size - seen.size} cells not connected to the rest of the shoe`); }
  if (!cells.some(([, y]) => y === 0)) out.push('no ground row (y 0)');
  return [...new Set(out)];
}

// one foot's cells for a shoe entry (registry or base kit): [[u, y, z, colour, layer], …], socket included
export function footCells(t, ctx = {}) {
  let cells = [];
  if (t.last) { const lc = lastCells(t.last); if (!lc) throw new Error(`unknown last '${t.last}'`);
    for (const q of lc) { const v = t.paint({ ...q }, ctx), [c, l] = Array.isArray(v) ? v : [v, 0]; if (c !== undefined && c !== null) cells.push([q.u, q.y, q.z, c, l ?? 0]); } }
  else if (t.draw) { const F = footPad(); t.draw(F, ctx); cells = [...F.cells.values()].map(([u, y, z, c, l]) => [u, y, z, c, l ?? 0]); }
  // the socket is always there (coloured like the nearest upper cell until dressAnkle dresses it)
  const has = new Set(cells.map(([u, y, z]) => `${u},${y},${z}`));
  for (let u = 0; u < 3; u++) for (let z = -1; z <= 1; z++) if (!has.has(`${u},3,${z}`)) {
    let best = null, bd = 1e9; for (const q of cells) { const d = Math.abs(q[0] - u) + Math.abs(q[1] - 3) * 2 + Math.abs(q[2] - z); if (d < bd) { bd = d; best = q; } }
    cells.push([u, 3, z, best ? best[3] : 0x8d9097, 0]); }
  return cells;
}
// draw a shoe into the shoe grid, both feet
export function drawShoe(SH, t, ctx) { const cells = footCells(t, ctx); for (const side of [-1, 1]) for (const [u, y, z, c, l] of cells) SH.set(footX(side, u), y, z, c, l); return cells; }

// the dressed ankle: the socket cells take the pant's y 4 colour (full pants) or the skin / sock (shorts). Called after the bottom.
export function dressAnkle(SH, B, t, lower, skin) {
  if (t.ankle === 'shoe') return;
  const shorts = !!lower && (lower.form === 'shorts' || lower.form === 'longshorts' || (lower.formSpec && lower.formSpec.hem > 4));
  const bare = shorts && (lower.sock === 'none' || !lower.sock);
  for (const side of [-1, 1]) for (let u = 0; u < 3; u++) for (let z = -1; z <= 1; z++) {
    const x = footX(side, u), key = ((x + 256) << 18) | ((4 + 256) << 9) | (z + 256); let color;
    if (bare) color = [skin.c(x, 3, z), skin.layer];
    else if (shorts && lower.sockPaint) color = lower.sockPaint({ x, y: 3, z, u, side, width: 3, z0: -1, z1: 1, covered: false, socks: true, c: lower.sockColor, l: 0 });
    else color = [B.get(x, 4, z) ?? skin.c(x, 3, z), Math.max(0, B.L.findIndex(layer => layer.has(key)))];
    SH.set(x, 3, z, ...color);
  }
}
