// Street pieces: the dealing-corner hotspot and the patrol car. 0.1 grain (props.js's vocabulary: crates, chairs, umbrellas, cars).
import { vol, done, K, GLOW, mask5, cyl, line, shade, TOD } from './lib.js';

// ───────── hotspot({ heat, compact }): a corner crew's setup, base centre; +z faces the street corner. Five steps, quiet → busy:
//   0  a curbside couch (the marker that is always there), an upturned crate, a flattened box with dice on it, crushed cans
//   1  + a second crate, a cooler, the boombox on the ground (off)
//   2  + a crate stack with the boombox on it (on: LEDs), a lawn chair, the patio umbrella furled in its tyre
//   3  + the umbrella open (red and white, 2.5 m across: the overhead read), a domino table, bulbs round its rim (lit at night), cups
//   4  + a speaker stack, a clamp lamp on the pole (lit at night), a crate tower, a second chair, cash on the table
// The full set is 3.2 × 3.1 m. COMPACT (kerb props pass, 2026-10-09): the same pieces at every step, closed up front to back, 3.2 ×
// 2.6 m — what a tight corner's 3 m walks hold clear of the corner building (ground.js hotspotSpot picks it where the full set can't
// stand in front of the lot lines). The rows close up: the domino table meets the couch, the umbrella and the front row move 0.3–0.4 m in.
export const heatStep = heat => Math.round(Math.max(0, Math.min(1, heat)) * 4);
function crate(V, x, y, z, c) { const D = shade(c, .68); V.box(x, y, z, x + 5, y + 4, z + 5, (xx, yy, zz) => (yy > y && yy < y + 3 && ((zz === z || zz === z + 4) && (xx - x) % 2 === 1 || (xx === x || xx === x + 4) && (zz - z) % 2 === 1)) ? D : c);   // ribbed sides
  V.box(x, y + 3, z, x + 5, y + 4, z + 5, shade(c, 1.18)); }
function couch(V, x, z) { const C = 0x7a3cff, CL = shade(C, 1.2), CD = shade(C, .72);   // 2.0 m, two cushions, stuffing out of one arm, a leg on a brick
  V.box(x, 1, z, x + 20, 4, z + 8, C); V.box(x, 4, z, x + 20, 9, z + 3, C); V.box(x, 4, z + 3, x + 3, 7, z + 8, CD); V.box(x + 17, 4, z + 3, x + 20, 7, z + 8, CD);
  V.box(x + 3, 4, z + 3, x + 10, 5, z + 8, CL); V.box(x + 10, 4, z + 3, x + 17, 5, z + 8, CL); V.set(x + 18, 7, z + 5, K.yellow); V.set(x + 18, 7, z + 6, K.yellow);
  for (const [a, b] of [[1, 1], [18, 1], [1, 6]]) V.box(x + a, 0, z + b, x + a + 1, 1, z + b + 1, K.woodD); V.box(x + 17, 0, z + 5, x + 20, 1, z + 8, 0xb04a3a); }
function boombox(V, x, y, z, on) { V.box(x, y, z, x + 7, y + 4, z + 2, K.ink); for (const sx of [x + 1, x + 4]) V.box(sx, y + 1, z + 2, sx + 2, y + 3, z + 3, 0x7a7c84, 2);
  V.set(x + 3, y + 2, z + 2, on ? K.lime : 0x2a2a30, on ? (TOD.night ? 3 : 1) : 0); V.set(x + 3, y + 3, z + 2, on ? K.orange : 0x2a2a30, on ? (TOD.night ? 3 : 1) : 0);
  V.box(x + 1, y + 4, z, x + 2, y + 5, z + 1, K.chrome, 2); V.box(x + 5, y + 4, z, x + 6, y + 5, z + 1, K.chrome, 2); V.box(x + 1, y + 5, z, x + 6, y + 6, z + 1, K.chrome, 2); }
function cooler(V, x, y, z, open) { V.box(x, y, z, x + 6, y + 4, z + 4, K.red); V.box(x, y + 3, z, x + 6, y + 4, z + 4, K.white); V.box(x - 1, y + 2, z + 1, x, y + 3, z + 3, K.white); V.box(x + 6, y + 2, z + 1, x + 7, y + 3, z + 3, K.white);
  if (open) { V.clear(x + 1, y + 1, z + 1, x + 5, y + 4, z + 3); V.box(x + 1, y + 1, z + 1, x + 5, y + 2, z + 3, 0xdff4ff, 1); [[1, K.cobalt], [2, K.lime], [3, K.red], [4, K.yellow]].forEach(([a, c]) => V.set(x + a, y + 2, z + 1 + (a & 1), c, 2));
    V.clear(x, y + 3, z, x + 6, y + 4, z + 4); V.box(x, y + 2, z - 1, x + 6, y + 7, z, K.white); } }
function chair(V, x, y, z, c) { for (let k = 0; k < 7; k++) V.box(x, y + 3, z + k, x + 6, y + 4, z + k + 1, k % 2 ? c : K.white); for (let k = 0; k < 7; k++) V.box(x, y + 3 + k, z - 1, x + 6, y + 4 + k, z, k % 2 ? c : K.white);
  for (const [a, b] of [[0, 0], [5, 0], [0, 6], [5, 6]]) V.box(x + a, y, z + b, x + a + 1, y + 3, z + b + 1, K.chrome, 2); for (const a of [0, 5]) V.box(x + a, y + 4, z + 1, x + a + 1, y + 5, z + 6, K.chrome, 2); }
function tyreBase(V, cx, cz) { cyl(V, cx, cz, 3.4, 0, 2, (x, y, z) => Math.hypot(x + .5 - cx, z + .5 - cz) < 2.2 ? K.conc : 0x1b1b20); }
function umbrella(V, cx, cz, open, lamp) {
  tyreBase(V, cx, cz); V.box(cx - 1, 2, cz - 1, cx + 1, 25, cz + 1, K.white);
  if (!open) { cyl(V, cx, cz, 1.8, 13, 24, (x, y, z) => (((Math.atan2(z + .5 - cz, x + .5 - cx) * 4 / Math.PI + 8) | 0) + (y > 20 ? 1 : 0)) % 2 ? K.red : K.white); V.box(cx - 1, 24, cz - 1, cx + 1, 26, cz + 1, K.red); return; }
  for (let k = 0; k < 5; k++) cyl(V, cx, cz, 12.5 - k * 2.4, 20 + k, 21 + k, (x, y, z) => ((Math.atan2(z + .5 - cz, x + .5 - cx) * 4 / Math.PI + 8) | 0) % 2 ? K.red : K.white);
  V.box(cx - 1, 25, cz - 1, cx + 1, 26, cz + 1, K.red);
  const B = [K.yellow, K.pink, K.cyan, K.lime];
  for (let a = 0; a < 8; a++) { const t = (a + .5) / 8 * Math.PI * 2, bx = Math.round(cx - .5 + Math.cos(t) * 11.6), bz = Math.round(cz - .5 + Math.sin(t) * 11.6); if (V.has(bx, 20, bz)) V.set(bx, 19, bz, B[a & 3], GLOW()); }
  if (lamp) { V.box(cx + 1, 16, cz - 1, cx + 2, 17, cz + 1, K.steelD, 2); V.box(cx + 2, 15, cz - 1, cx + 5, 17, cz + 1, K.steel, 2); V.box(cx + 3, 14, cz - 1, cx + 5, 15, cz + 1, 0xfff3c4, GLOW()); }
}
// where each piece stands (voxels: x along the kerb, z toward the street corner) — FULL is the set as it always was
const FULL = { n: [32, 32], couch: [7, 1], mat: [2, 23], seat: [26, 20], cans: [[30, 30, 31, 32], [1, 18, 3, 19]], blue: [0, 11], cooler: [23, 12], boom: [17, 23],
  stack: [0, 1], chair2: [18, 23], umb: [16, 16], table: [5, 12], cups: [[21, 20], [15, 21], [30, 18]], tower: [26, 26], spk: [27, 1], chair4: [11, 24] };
const COMPACT = { n: [32, 26], couch: [7, 0], mat: [2, 18], seat: [26, 15], cans: [[31, 24, 32, 26], [1, 15, 3, 16]], blue: [0, 9], cooler: [23, 10], boom: [17, 19],
  stack: [0, 0], chair2: [18, 18], umb: [16, 13], table: [5, 8], cups: [[21, 15], [14, 16], [30, 14]], tower: [26, 20], spk: [27, 0], chair4: [11, 18] };
export function hotspot({ heat = .5, compact = false } = {}) {
  const st = heatStep(heat), L = compact ? COMPACT : FULL, V = vol(L.n[0], 27, L.n[1]), [tx, tz] = L.table, [ux, uz] = L.umb;
  // plan (top view, x →, z ↓ toward the corner): couch along the back · crate stack back-left · speakers back-right · umbrella ·
  // dominoes left · cooler right · the box mat front-left · chairs front · crate tower front-right. Nothing crosses the tyre (r 3.4).
  couch(V, L.couch[0], L.couch[1]);
  { const [mx, mz] = L.mat; V.box(mx, 0, mz, mx + 8, 1, mz + 7, (x, y, z) => (x === mx || z === mz + 6) ? K.cardD : K.card); V.set(mx + 3, 1, mz + 2, K.white); V.set(mx + 5, 1, mz + 3, K.white); }   // the box mat, two dice
  crate(V, L.seat[0], 0, L.seat[1], K.red); { const [a, b] = L.cans; V.box(a[0], 0, a[1], a[2], 1, a[3], 0xc9ced6, 2); V.box(b[0], 0, b[1], b[2], 1, b[3], K.red, 1); }   // a seat crate; crushed cans
  if (st >= 1) { crate(V, L.blue[0], 0, L.blue[1], K.cobalt); cooler(V, L.cooler[0], 0, L.cooler[1], st >= 2); if (st === 1) boombox(V, L.boom[0], 0, L.boom[1], false); }
  if (st >= 2) { const [sx, sz] = L.stack; crate(V, sx, 0, sz, K.yellow); crate(V, sx, 4, sz, K.red); boombox(V, sx, 8, sz + 1, true); chair(V, L.chair2[0], 0, L.chair2[1], K.yellow); }
  if (st === 2) umbrella(V, ux, uz, false, false);
  if (st >= 3) { umbrella(V, ux, uz, true, st >= 4);
    for (const [a, b] of [[1, 1], [6, 1], [1, 7], [6, 7]]) V.box(tx + a, 0, tz + b, tx + a + 1, 7, tz + b + 1, K.chrome, 2);                       // domino table
    V.box(tx, 7, tz, tx + 8, 8, tz + 9, K.green); for (const [a, b] of [[2, 2], [4, 2], [5, 4], [3, 5], [6, 6], [1, 6]]) V.box(tx + a, 8, tz + b, tx + a + 1, 9, tz + b + 2, K.white);
    for (const [a, b] of L.cups) V.box(a, 0, b, a + 1, 2, b + 1, K.red); }
  if (st >= 4) { for (const [y, c] of [[0, K.cobalt], [4, K.lime], [8, K.red], [12, K.yellow]]) crate(V, L.tower[0], y, L.tower[1], c);
    const [px, pz] = L.spk; for (const y of [0, 8]) { V.box(px, y, pz, px + 5, y + 8, pz + 4, K.ink); for (const cy of [y + 2, y + 5]) V.box(px + 1, cy, pz + 4, px + 4, cy + 2, pz + 5, 0x5b5d63, 2); }
    chair(V, L.chair4[0], 0, L.chair4[1], K.lime); V.box(tx + 5, 8, tz + 6, tx + 7, 9, tz + 7, 0x2fbf55); V.box(tx + 5, 9, tz + 6, tx + 7, 10, tz + 7, 0x46d466); }
  return compact ? done(V, 'hotspot', 'ground: base centre of a 3.2 × 2.6 m sidewalk corner (the compact set); +z toward the street corner', { step: st, compact: true })
    : done(V, 'hotspot', 'ground: base centre of a 3.2 × 3.2 m sidewalk corner; +z toward the street corner', { step: st });
}

// ───────── patrolCar({ lights }): the copCar family (props.js: same 1.8 × 4.4 body, cabin, wheels), in black and white:
// ink hood and trunk, white doors and roof, a gold star on each front door, P9 on the roof for the overhead camera, a long light bar
// (red · white · blue), a push bar, an A-pillar spotlight and a whip antenna. lights: true → the bar is lit (layer 3), day or night.
export function patrolCar({ lights = false } = {}) {
  const L = 44, Wd = 18, cab0 = 12, cab1 = 32, V = vol(Wd + 2, 32, L + 5, { az: (L + 2) / 2 }), cx = 1, Wt = K.white, I = K.ink, wz = [7, L - 9];
  V.box(cx, 3, 1, cx + Wd, 10, L + 1, (x, y, z) => (z >= cab0 && z < cab1) ? Wt : I);                                      // doors white, ends ink
  V.box(cx, 10, cab0, cx + Wd, 20, cab1, Wt); V.box(cx + 1, 20, cab0 + 1, cx + Wd - 1, 21, cab1 - 1, Wt);
  V.box(cx - 1, 3, 0, cx + Wd + 1, 5, 2, K.steelL, 2); V.box(cx - 1, 3, L, cx + Wd + 1, 5, L + 2, K.steelL, 2);
  V.box(cx + 1, 11, cab1 - 1, cx + Wd - 1, 19, cab1, 0x9fd8ff, 1); V.box(cx + 1, 11, cab0, cx + Wd - 1, 19, cab0 + 1, 0x9fd8ff, 1);
  for (const x of [cx, cx + Wd - 1]) { V.clear(x, 11, cab0 + 2, x + 1, 19, cab1 - 2); for (let y = 11; y < 19; y++) V.set(x, y, (cab0 + cab1) >> 1, Wt); }
  V.clear(cx + 1, 10, cab0 + 1, cx + Wd - 1, 19, cab1 - 1); V.box(cx + 1, 3, cab0 + 1, cx + Wd - 1, 9, cab1 - 1, 0x2a2a30);   // (the ceiling row stays: the roof sits on it)
  V.box(cx, 5, L, cx + 4, 8, L + 1, 0xffffff, TOD.night ? 3 : 1); V.box(cx + Wd - 4, 5, L, cx + Wd, 8, L + 1, 0xffffff, TOD.night ? 3 : 1);
  V.box(cx, 6, 0, cx + 3, 9, 1, 0xd7141a, TOD.night ? 3 : 1); V.box(cx + Wd - 3, 6, 0, cx + Wd, 9, 1, 0xd7141a, TOD.night ? 3 : 1); V.box(cx + 5, 5, L, cx + Wd - 5, 8, L + 1, 0x33333b);
  for (const z of wz) for (const x of [cx - 1, cx + Wd - 2]) { V.box(x, 0, z - 3, x + 3, 8, z + 5, 0x1b1b20); V.box(x + (x < cx ? 0 : 2), 2, z - 1, x + 1 + (x < cx ? 0 : 2), 6, z + 3, K.steelL, 2); }
  for (const z of wz) { V.clear(cx + 2, 0, z - 3, cx + Wd - 2, 3, z + 5); for (const x of [cx - 1, cx + Wd - 2]) for (const [y, dz] of [[0, -3], [0, 4], [7, -3], [7, 4]]) V.del(x + (x < cx ? 0 : 2), y, z + dz); }
  // livery: gold star badges on the front doors, P9 on the roof (reads from above with the nose up)
  const star = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'];
  star.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === 'X') { V.set(cx, 8 - j, 22 + i, K.gold, 2); V.set(cx + Wd - 1, 8 - j, 26 - i, K.gold, 2); } });
  { const M = mask5('P9'); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.set(cx + 14 - i, 20, 23 - j, I); }   // painted on the roof
  // the light bar: ink base, chrome ends, lenses red | red | white | blue | blue; lit = layer 3
  const bz0 = 25, bz1 = 31; V.box(cx + 1, 21, bz0, cx + Wd - 1, 22, bz1, I); V.box(cx + 1, 22, bz0, cx + 2, 24, bz1, K.chrome, 2); V.box(cx + Wd - 2, 22, bz0, cx + Wd - 1, 24, bz1, K.chrome, 2);
  const seg = [[cx + 2, cx + 5, lights ? 0xff2a2a : 0x8a1f24], [cx + 5, cx + 8, lights ? 0xff5a4a : 0x6e1a1e], [cx + 8, cx + 10, lights ? 0xffffff : 0xb9bec6], [cx + 10, cx + 13, lights ? 0x4a8cff : 0x1d2f7a], [cx + 13, cx + 16, lights ? 0x2f7bff : 0x243a8a]];
  for (const [a, b, c] of seg) V.box(a, 22, bz0, b, 24, bz1, c, lights ? 3 : 1);
  for (const x of [cx + 4, cx + 9, cx + 14]) V.box(x, 22, bz0, x + 1, 24, bz1, I);
  // push bar, spotlight, antenna
  for (const x of [cx + 3, cx + 6, cx + 11, cx + 14]) V.box(x, 2, L + 2, x + 1, 10, L + 3, I); V.box(cx + 2, 8, L + 2, cx + Wd - 2, 9, L + 3, I); V.box(cx + 2, 3, L + 2, cx + Wd - 2, 4, L + 3, I);
  V.box(cx - 1, 16, cab1 - 2, cx, 18, cab1 + 1, K.chrome, 2); V.set(cx - 1, 17, cab1 + 1, 0xfff3c4, lights || TOD.night ? 3 : 1);
  line(V, cx + Wd - 3, 21, cab0 + 2, cx + Wd - 3, 27, cab0 + 1, I);
  return done(V, 'patrolcar', 'road: base centre, nose toward +z (drives along the lane like props.js copCar)', { lights: !!lights });
}
