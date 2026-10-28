// Sim-state assets · shared authoring helpers. Worker-safe (no three), like city/props.js.
// Every piece is authored in voxels and returned as a Vol whose local origin is its ANCHOR (see index.js / ASSETS.md):
//   ground pieces   origin = base centre, +z = the front (toward the street)
//   facade pieces   origin = bottom centre of the opening ON the wall's outer plane (kit.js d = 0 face), x along the wall
//                   (left → right seen from the street), +z out of the wall. Stamp with rotQ = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 }.
import { Vol, textMask } from '../vox.js';
import { PAL, CV, hash, shade, rng } from '../style.js';
import { TOD } from '../kit.js';
export { PAL, CV, hash, shade, rng, TOD };
export const HV = CV / 2;                                   // the half grain (0.05): small signs, cards, locks, scars

// ── colours beyond style.js (all in the house range: bold, never pastel; neutrals only on materials)
export const K = {
  ink: PAL.ink, iron: PAL.iron, white: PAL.white, cream: PAL.cream, red: PAL.red, yellow: PAL.yellow, lime: PAL.lime, cyan: PAL.cyan, pink: PAL.pink,
  green: PAL.green, gold: PAL.gold, cobalt: 0x2f5bff, orange: 0xff7a1a, purple: 0x7a3cff, teal: 0x12b3a0,
  steel: 0x9a9aa6, steelD: 0x5b5d63, steelL: 0xc9ced6, chrome: 0xdfe6ee, gun: 0x3a3c44,
  wood: PAL.wood, woodD: PAL.woodD, ply: 0xcf9a55, plyD: 0xa9763c, plyE: 0x8b5a2b, card: 0xc98a4b, cardD: 0xa06a33,
  soot: 0x2a2628, char: 0x1a1718, ash: 0x4a4446, ember: 0xff6a1a,
  dirt: 0x6b5038, dirtD: 0x54402d, oil: 0x2a2a30, conc: 0xc9c5bd, concD: 0xa9a59d,
  goo: 0x6cff4a, gooD: 0x25b84c, gooDD: 0x14a83b, rust: 0xb0603a, rustD: 0x8a4a2a,
  glassLo: PAL.glassLo, glassHi: PAL.glassHi, glint: PAL.glint, room: 0x121a33, litLo: PAL.litLo, litHi: PAL.litHi,
};
// layers (vox.js Bank): 0 matte · 1 gloss · 2 metal · 3 lit (unlit material, toneMapped false)
export const GLOW = () => TOD.night ? 3 : 1;               // lamps, LEDs, flames: glow at night, gloss by day (props.js lamps)
export const PAINT = () => TOD.night ? 3 : 0;              // lettering that a sign lights at night
export const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };

// ── a Vol whose local origin (the anchor) is the voxel corner (ax, ay, az)
export function vol(nx, ny, nz, { s = CV, ax = nx / 2, ay = 0, az = nz / 2, ground = true } = {}) {
  return new Vol(nx, ny, nz, { s, org: [-ax * s, -ay * s, -az * s], ground });
}
// tag a finished piece: kind (the middle of an item id), the anchor it was authored around, its measured box (metres, anchor-relative)
export function done(V, kind, anchor, extra = {}) {
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; const { nx, ny, nz, d, sxz } = V;
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) if (d[x + z * nx + y * sxz]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const s = V.s, o = V.org, r = v => Math.round(v * 100) / 100;
  V.kind = kind; V.anchor = anchor;
  V.box3 = [r(o[0] + x0 * s), r(o[1] + y0 * s), r(o[2] + z0 * s), r(o[0] + (x1 + 1) * s), r(o[1] + (y1 + 1) * s), r(o[2] + (z1 + 1) * s)];
  V.size = { w: r((x1 + 1 - x0) * s), h: r((y1 + 1 - y0) * s), d: r((z1 + 1 - z0) * s) };
  return Object.assign(V, extra);
}

// ── shapes
export function cyl(V, cx, cz, r, y0, y1, c, l = 0) {
  for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++)
    if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l);
}
// a lying cylinder: axis along x (a = 'x') or z (a = 'z'), centre (cu, cy) in the other two axes
export function cylH(V, a, cu, cy, r, t0, t1, c, l = 0) {
  for (let t = t0; t < t1; t++) for (let u = Math.floor(cu - r - 1); u <= cu + r; u++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++)
    if (Math.hypot(u + .5 - cu, y + .5 - cy) <= r) { const col = typeof c === 'function' ? c(t, y, u) : c; if (a === 'x') V.set(t, y, u, col, l); else V.set(u, y, t, col, l); }
}
// a 6-connected voxel line (every step shares a face with the last, so a drawn rod, chain or leg is never loose)
export function line(V, x0, y0, z0, x1, y1, z1, c, l = 0) {
  let p = [Math.round(x0), Math.round(y0), Math.round(z0)]; const q = [Math.round(x1), Math.round(y1), Math.round(z1)], n = Math.max(1, Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]));
  const put = () => V.set(p[0], p[1], p[2], typeof c === 'function' ? c(p[0], p[1], p[2]) : c, l); put();
  for (let k = 0; k < n; k++) { let best = -1, bd = 1e9; const t = (k + 1) / n, tgt = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t];
    for (let a = 0; a < 3; a++) { if (p[a] === q[a]) continue; const s = Math.sign(q[a] - p[a]), tr = p.slice(); tr[a] += s; const dd = Math.hypot(tr[0] - tgt[0], tr[1] - tgt[1], tr[2] - tgt[2]); if (dd < bd) { bd = dd; best = a; } }
    if (best < 0) break; p[best] += Math.sign(q[best] - p[best]); put(); }
}
// a sagging run (tape, rope, chain): from (x0,y0) to (x1,y1) along x at depth z, dropping `sag` voxels at the middle, `th` voxels tall
export function sagX(V, x0, x1, y, z, sag, th, c, l = 0) {
  for (let x = x0; x <= x1; x++) { const t = (x - x0) / Math.max(1, x1 - x0), yy = Math.round(y - sag * 4 * t * (1 - t)); for (let k = 0; k < th; k++) V.set(x, yy - k, z, typeof c === 'function' ? c(x, k) : c, l);
    const tn = (x + 1 - x0) / Math.max(1, x1 - x0), yn = Math.round(y - sag * 4 * tn * (1 - tn)); if (x < x1 && Math.abs(yn - yy) >= th) for (let k = Math.min(yy, yn); k <= Math.max(yy, yn); k++) V.set(x, k, z, typeof c === 'function' ? c(x, 0) : c, l); }
}

// ── lettering. 5×7 is the city's font (vox.js textMask); 3×5 is the small print (cards, notices, labels, plates) at the 0.05 grain
const F3 = {
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'], C: ['.XX', 'X..', 'X..', 'X..', '.XX'], D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'], F: ['XXX', 'X..', 'XX.', 'X..', 'X..'], G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'], H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'], J: ['..X', '..X', '..X', 'X.X', '.X.'], K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'], L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'], N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'], O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'], P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  Q: ['.X.', 'X.X', 'X.X', 'XX.', '.XX'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], S: ['.XX', 'X..', '.X.', '..X', 'XX.'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'], V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'], W: ['X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'], X: ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'], Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
  0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XX.', '..X', '.X.', 'X..', 'XXX'], 3: ['XX.', '..X', '.X.', '..X', 'XX.'],
  4: ['X.X', 'X.X', 'XXX', '..X', '..X'], 5: ['XXX', 'X..', 'XX.', '..X', 'XX.'], 6: ['.XX', 'X..', 'XXX', 'X.X', 'XXX'], 7: ['XXX', '..X', '.X.', '.X.', '.X.'],
  8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'], 9: ['XXX', 'X.X', 'XXX', '..X', 'XX.'],
  '.': ['.', '.', '.', '.', 'X'], ':': ['.', 'X', '.', 'X', '.'], '·': ['.', '.', 'X', '.', '.'], '!': ['X', 'X', 'X', '.', 'X'], "'": ['X', 'X', '.', '.', '.'],
  '-': ['...', '...', 'XXX', '...', '...'], '+': ['...', '.X.', 'XXX', '.X.', '...'], '/': ['..X', '..X', '.X.', 'X..', 'X..'], '$': ['.XX', 'XX.', '.X.', '.XX', 'XX.'],
  '#': ['X.X', 'XXX', 'X.X', 'XXX', 'X.X'], '@': ['.X.', 'X.X', 'XXX', 'X..', '.XX'], '&': ['.X.', 'X.X', '.X.', 'X.X', '.XX'], '?': ['XX.', '..X', '.X.', '...', '.X.'],
  ' ': ['..', '..', '..', '..', '..'],
};
const MC = new Map();
export function mask3(str) { let m = MC.get('3' + str); if (m) return m;
  const gs = [...str.toUpperCase()].map(ch => F3[ch] ?? F3['?']), w = gs.reduce((s, g) => s + g[0].length + 1, -1), rows = [];
  for (let r = 0; r < 5; r++) rows.push(gs.map(g => g[r]).join('.'));
  MC.set('3' + str, m = { w, h: 5, at: (i, j) => rows[j][i] === 'X', s: str }); return m; }
export function mask5(str) { let m = MC.get('5' + str); if (!m) MC.set('5' + str, m = textMask(str)); return m; }
export const w3 = s => mask3(s).w, w5 = s => mask5(s).w;
// print a mask on the face whose normal is n ('+z', '-z', '+x', '-x'): u0 = where the text starts on the viewer's left, ytop = its top row,
// `at` = the layer the letters occupy (1 voxel proud of the board behind them unless o.flat). Raised letters are recorded for the
// city audit (text on its board), exactly like props.js text2. o.sc scales, o.shadow draws a drop shadow (+1 right, −1 down).
export function print(V, M, u0, ytop, at, c, l = 0, n = '+z', o = {}) {
  const sc = o.sc || 1, dir = { '+z': [1, 0, 0, 1], '-z': [-1, 0, 0, -1], '+x': [0, -1, 1, 0], '-x': [0, 1, -1, 0] }[n];
  const put = (u, y, col, rec) => { const x = n[1] === 'z' ? u0 + dir[0] * u : at, z = n[1] === 'z' ? at : u0 + dir[1] * u; V.set(x, y, z, col, l);
    if (rec && !o.flat) V.recN(M.s ?? 'text', x, y, z, dir[2], dir[3]); };
  V.recNext();
  if (o.shadow !== undefined) for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(i * sc + a + 1, ytop - j * sc - b - 1, o.shadow, false);
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(i * sc + a, ytop - j * sc - b, typeof c === 'function' ? c(i, j) : c, true);
  return M.w * sc;
}
// centred helpers: the text's middle at u = cx
export const printC = (V, M, cx, ytop, at, c, l, n = '+z', o = {}) => print(V, M, n === '+z' || n === '-x' ? Math.round(cx - M.w * (o.sc || 1) / 2) : Math.round(cx + M.w * (o.sc || 1) / 2) - 1, ytop, at, c, l, n, o);
// a hand-written line (a phone number, a signature): short strokes that read as writing, never as letters
export function scribble(V, x0, y0, z, w, c, seed, l = 0) {
  const r = rng(seed); let x = x0;
  while (x < x0 + w) { const k = (r() * 3) | 0; if (k === 0) { V.set(x, y0, z, c, l); V.set(x, y0 + 1, z, c, l); } else if (k === 1) { V.set(x, y0 + 1, z, c, l); V.set(x + 1, y0, z, c, l); x++; } else V.set(x, y0, z, c, l);
    x += 1 + (r() < .25 ? 1 : 0); }
}
