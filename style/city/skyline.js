// Backdrop: every block around the section is built coarse (0.5 voxels) from its plan kind, and landmark silhouettes stand at the
// ends of the avenues (180–320 out) so every street axis ends in shapes that sit in the haze. One bank, no shadow casting.
import { Vol, meshVol, Bank } from './vox.js';
import { P, kindAt, urban, interior } from './plan.js';
import { remap } from '../../world/city.js';
const RM = ([x, z, ...r]) => [...remap(x, z), ...r];   // (SPREAD: the silhouettes', cranes' and water towers' spots are today's, remapped)
import { PAL, WALLS as W0, SIDE, hash, rng } from './style.js';
const mixH = (c, t) => { const h = PAL.horizon, m = s => Math.round(((c >> s) & 255) * (1 - t) + ((h >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const WALLS = W0, shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
import { SECTION } from './plan.js';

function coarseBlock(bank, i, j, k) {
  const R = interior(i, j), s = .5, r = rng(7000 + (i + 60) * 97 + (j + 60) * 13), W = Math.round((R.x1 - R.x0) / s), D = Math.round((R.z1 - R.z0) / s);
  if (W < 4 || D < 4) return;
  const tall = { D: [8, 16], d: [3, 7], W: [3, 5], B: [4, 6], C: [3, 4], S: [3, 4], P: [0, 0], N: [2, 3], L: [0, 0], H: [5, 8], I: [2, 3], Q: [1, 2], J: [0, 1], T: [1, 1], s: [2, 2], r: [2, 3], p: [0, 0], A: [2, 3], G: [1, 1], M: [2, 2], K: [3, 5] }[k] ?? [2, 4];
  const V = new Vol(W, 110, D, { s, org: [R.x0, SIDE, R.z0] });
  if (k === 'p' || k === 'P') { for (let n = 0; n < 6; n++) { const x = 3 + r() * (W - 6), z = 3 + r() * (D - 6); V.box(x - 1, 0, z - 1, x + 1, 5, z + 1, 0x7a4a22); V.box(x - 4, 5, z - 4, x + 4, 11, z + 4, [0x2fbf55, 0x25a748, 0x46d466][n % 3]); } meshVol(V, bank); return; }
  if (k === 'L') { V.box(0, 0, 0, W, 1, D, PAL.asphalt); for (let n = 0; n < 4; n++) V.box(4 + n * 9, 1, D / 2 - 2, 8 + n * 9, 4, D / 2 + 2, WALLS[(n * 5 + i) % WALLS.length]); meshVol(V, bank); return; }
  if (k === 's' || k === 'r' || k === 'T') { const n = k === 'T' ? 6 : 4; for (let a = 0; a < 2; a++) for (let b = 0; b < n / 2; b++) { const x0 = 2 + a * (W / 2), z0 = 2 + b * (D / (n / 2)), w = W / 2 - 5, d = D / (n / 2) - 5, h = k === 'T' ? 6 : 12, c = WALLS[(a * 3 + b * 7 + i * 5 + j) % WALLS.length];
    V.box(x0, 0, z0, x0 + w, h, z0 + d, c); if (k !== 'T') for (let t = 0; t < 4; t++) V.box(x0 + t, h + t, z0 + t, x0 + w - t, h + t + 1, z0 + d - t, t % 2 ? 0x8a4a3a : 0xa4554a); } meshVol(V, bank); return; }
  // urban: 2–4 masses with window grids on every face
  const cuts = k === 'I' || k === 'Q' ? [[0, 0, W, D]] : [[0, 0, W >> 1, D >> 1], [W >> 1, 0, W, D >> 1], [0, D >> 1, W >> 1, D], [W >> 1, D >> 1, W, D]];
  const ROOFC = [0xe0674c, 0x7fd8b4, 0x8ec9f2, 0xf4d35e, 0xc3a6f2, 0xff9c85, 0x9ccf7e, 0xf0b36b, 0xffb3d1], SH = [0x14a83b, 0xe8232a, 0xffe23a, 0x2de2e6, 0xff4fa3, 0x17171b];
  for (const [x0, z0, x1, z1] of cuts) { if (r() < .12 && cuts.length > 1) continue; const st = tall[0] + Math.floor(r() * (tall[1] - tall[0] + 1)), h = Math.round(st * 3 / s) + 2, c = k === 'H' ? 0x12b3a0 : WALLS[Math.floor(r() * WALLS.length)], sh = SH[Math.floor(r() * SH.length)], rc = ROOFC[Math.floor(r() * ROOFC.length)];
    // facade: punched window grid (1 × 2 voxels, glass), a coloured shopfront band at the base, trim at the top
    V.box(x0 + 1, 0, z0 + 1, x1 - 1, h, z1 - 1, (x, y, z) => { const edge = x === x0 + 1 || x === x1 - 2 || z === z0 + 1 || z === z1 - 2; if (!edge) return c;
      if (y < 2) return y === 1 ? sh : PAL.ink; const along = (x === x0 + 1 || x === x1 - 2) ? z : x; return (y % 6 >= 3 && y % 6 <= 4 && along % 2 === 0 && y < h - 2) ? (y % 12 < 6 ? PAL.glassLo : PAL.glassHi) : c; }, 0);
    V.box(x0 + 1, h, z0 + 1, x1 - 1, h + 1, z1 - 1, (x, y, z) => (x === x0 + 1 || x === x1 - 2 || z === z0 + 1 || z === z1 - 2) ? PAL.white : rc);
    // roof kit: a bulkhead, AC boxes, and a water tank on the taller ones
    const bx = x0 + 3 + Math.floor(r() * Math.max(1, x1 - x0 - 9)), bz = z0 + 3 + Math.floor(r() * Math.max(1, z1 - z0 - 9)); V.box(bx, h + 1, bz, bx + 3, h + 4, bz + 2, shade(c, .85));
    for (let n = 0; n < 3; n++) { const ax = x0 + 2 + Math.floor(r() * Math.max(1, x1 - x0 - 5)), az = z0 + 2 + Math.floor(r() * Math.max(1, z1 - z0 - 5)); if (!V.has(ax, h + 1, az)) V.set(ax, h + 1, az, 0xe6e6ea); }
    if (k === 'I') { V.box(x0 + 4, h, z0 + 4, x0 + 7, h + 40, z0 + 7, (x, y, z) => (y >> 2) & 1 ? PAL.white : PAL.red); }
    if (k === 'H') { const cx = (x0 + x1) >> 1; V.box(cx - 1, h - 12, z1 - 1, cx + 2, h - 3, z1, PAL.red); V.box(cx - 4, h - 9, z1 - 1, cx + 5, h - 6, z1, PAL.red); }
    if (st > 3 && r() < .6) { const tx = x1 - 7, tz = z1 - 7; V.box(tx, h + 1, tz, tx + 1, h + 3, tz + 1, PAL.iron); V.box(tx + 3, h + 1, tz + 3, tx + 4, h + 3, tz + 4, PAL.iron); V.box(tx, h + 3, tz, tx + 4, h + 7, tz + 4, (x, y) => y % 2 ? PAL.wood : PAL.woodD); V.box(tx + 1, h + 7, tz + 1, tx + 3, h + 8, tz + 3, PAL.woodD); } }
  meshVol(V, bank);
}
// a landmark: stacked setbacks + crown, in coarse 1.0 voxels — reads as a pale silhouette through the haze
function landmark(bank, x, z, w, st, c, crown, seed) {
  const s = 1, h = Math.round(st * 3), V = new Vol(w + 2, h + 40, w + 2, { s, org: [x - (w + 2) / 2, SIDE, z - (w + 2) / 2] }); let lo = 1, hi = w + 1, y = 0;
  for (let t = 0; t < 4 && hi - lo > 3; t++) { const th = Math.round(h / (4 - t * .6) * .5 + 6); V.box(lo, y, lo, hi, y + th, hi, (xx, yy, zz) => (yy % 3 === 1 && (xx === lo || xx === hi - 1 || zz === lo || zz === hi - 1)) ? PAL.glassLo : c); y += th; lo += 2; hi -= 2; }
  const m = (w + 2) >> 1; if (crown === 'spire') V.box(m, y, m, m + 1, y + 26, m + 1, PAL.white); else if (crown === 'mast') { V.box(m, y, m, m + 1, y + 20, m + 1, PAL.red); V.box(m - 1, y + 20, m - 1, m + 2, y + 21, m + 2, PAL.red, 3); }
  else if (crown === 'dome') V.ell(m, y, m, Math.max(2, (hi - lo) / 2), 5, Math.max(2, (hi - lo) / 2), 0xffc21a);
  meshVol(V, bank);
}
function crane(bank, x, z, rot) { const V = new Vol(40, 50, 4, { s: 1, org: [x - 20, SIDE, z - 2] }); V.box(18, 0, 1, 21, 44, 3, PAL.yellow); V.box(2, 40, 1, 38, 43, 3, PAL.yellow); V.box(20, 43, 1, 22, 47, 3, PAL.yellow); V.box(3, 30, 1, 4, 40, 2, PAL.iron); meshVol(V, bank); }
function waterTower(bank, x, z) { const V = new Vol(14, 40, 14, { s: 1, org: [x - 7, SIDE, z - 7] }); for (const [a, b] of [[2, 2], [11, 2], [2, 11], [11, 11]]) V.box(a, 0, b, a + 1, 22, b + 1, PAL.iron); V.ell(7, 28, 7, 6, 6, 6, 0x12b3a0); V.box(6, 34, 6, 8, 38, 8, 0x12b3a0); meshVol(V, bank); }

export function skyline(bank) {
  const pad = 4;
  for (let i = SECTION.i0 - pad; i <= SECTION.i1 + pad; i++) for (let j = SECTION.j0 - pad; j <= SECTION.j1 + pad; j++) {
    if (i >= SECTION.i0 && i <= SECTION.i1 && j >= SECTION.j0 && j <= SECTION.j1) continue; const k = kindAt(i, j); if (!urban(k)) continue; coarseBlock(bank, i, j, k); }
  // avenue vistas: Central Ave (z 0) west/east, Main St (x 0) north/south, plus the other avenues
  const L = [[-270, 18, 16, 22, 0x3fa9f5, 'spire'], [-250, -26, 14, 16, 0xff4fa3, 'mast'], [-300, 40, 18, 14, 0xffc21a, 'dome'], [270, -14, 16, 20, 0x8c52ff, 'spire'], [250, 24, 14, 15, 0x25b84c, 'mast'],
    [-20, -250, 18, 18, 0xef4a2a, 'mast'], [26, -280, 16, 24, 0x2f5bff, 'spire'], [-150, -230, 14, 14, 0x12b3a0, 'dome'], [150, -240, 16, 18, 0xff7a1a, 'spire'], [-190, 150, 14, 12, 0x7a3cff, 'mast'], [200, 170, 16, 13, 0xe83b5b, 'dome']].map(RM);
  L.forEach(([x, z, w, st, c, cr], n) => landmark(bank, x, z, w, st, c, cr, n));
  for (const [x, z] of [[-60, -230], [80, -220], [130, -250]].map(RM)) crane(bank, x, z, 0);
  waterTower(bank, ...remap(20, 250)); waterTower(bank, ...remap(-120, 230));
}
// pass 1c: the coarse ring is now far-tier blocks from the spec pass (stream.js); this keeps only the landmark silhouettes at the
// avenue ends, the cranes and the water towers (one bank, no shadows)
// pass 2: a silhouette whose block a district kit now builds is left out (the kit owns what stands there; the coarse 1.0 cubes
// only work in the haze). built(i, j) → true for those blocks.
export function landmarks(bank, built = () => false) {
  const L = [[-270, 18, 16, 22, 0x3fa9f5, 'spire'], [-250, -26, 14, 16, 0xff4fa3, 'mast'], [-300, 40, 18, 14, 0xffc21a, 'dome'], [270, -14, 16, 20, 0x8c52ff, 'spire'], [250, 24, 14, 15, 0x25b84c, 'mast'],
    [-20, -250, 18, 18, 0xef4a2a, 'mast'], [26, -280, 16, 24, 0x2f5bff, 'spire'], [-150, -230, 14, 14, 0x12b3a0, 'dome'], [150, -240, 16, 18, 0xff7a1a, 'spire'], [-190, 150, 14, 12, 0x7a3cff, 'mast'], [200, 170, 16, 13, 0xe83b5b, 'dome']].map(RM);
  const free = (x, z, r = 10) => ![[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]].some(([a, b]) => built(Math.floor(a / P), Math.floor(b / P)));
  L.forEach(([x, z, w, st, c, cr], n) => { if (free(x, z, w / 2 + 1)) landmark(bank, x, z, w, st, c, cr, n); });
  for (const [x, z] of [[-60, -230], [80, -220], [130, -250]].map(RM)) if (free(x, z, 20)) crane(bank, x, z, 0);
  for (const [x, z] of [[20, 250], [-120, 230]].map(RM)) if (free(x, z, 7)) waterTower(bank, x, z);
}
