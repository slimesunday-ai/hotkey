// Supply piles: pile(kind, level) for the sites whose banks deplete and regrow. 0.1 grain, a 3.2 × 3.2 m footprint, base centre.
// Five stages (stageOf): 0 empty · 1 ≤ 25% · 2 ≤ 50% · 3 ≤ 75% · 4 full. The empty stage keeps the site's base (the oil-stained pad,
// the pallets, the dry basin, the sled, the bale pallets), so an exhausted site still reads as that site.
//   scrap  the Heap: a junk mound that grows around a fridge, a car door, tyres, a cart, a TV
//   salts  the dead mall: blue drums with pink lids on four pallets, some open and heaped with crystals
//   goo    the docks: a concrete tub filling with lime goo (glows at night) and yellow hazard barrels
//   leaf   the woods: leaf bundles tied with twine, stacked on a log sled; a stump with an axe in it
//   cloth  the dead mall / docks: striped textile bales with ink straps, a fabric roll on top when full
import { vol, done, K, GLOW, cyl, cylH, line, hash, rng, shade } from './lib.js';

export const stageOf = level => level <= 0 ? 0 : Math.min(4, Math.ceil(Math.min(1, level) * 4 - 1e-9));
const N = 32, C0 = 16;
const surf = (V, x, z) => { for (let y = V.ny - 1; y >= 0; y--) if (V.has(x, y, z)) return y + 1; return 0; };   // top of whatever is there

// ───────── small junk and props (0.1 grain), each resting at y
function tyre(V, x, y, z) { cyl(V, x, z, 3.4, y, y + 2, (xx, yy, zz) => Math.hypot(xx + .5 - x, zz + .5 - z) < 1.6 ? undefined : 0x1b1b20); cyl(V, x, z, 1.7, y, y + 1, 0x7a7c84, 2); }
function tyreUp(V, x, y, z) { cylH(V, 'x', z, y + 3, 3.2, x, x + 2, (t, yy, u) => Math.hypot(u + .5 - z, yy + .5 - (y + 3)) < 1.5 ? 0x7a7c84 : 0x1b1b20); }
function carDoor(V, x, y, z, c) {   // leaning back: every 3 rows up it steps 1 into the heap
  for (let j = 0; j < 8; j++) { const zz = z - (j / 3 | 0); V.box(x, y + j, zz, x + 8, y + j + 1, zz + 2, c); if (j >= 4 && j < 7) V.box(x + 1, y + j, zz + 1, x + 6, y + j + 1, zz + 2, j === 6 ? 0x9fd8ff : 0x2a2d38, 1); }
  V.box(x + 6, y + 3, z + 1, x + 8, y + 4, z + 2, K.chrome, 2); }
function washer(V, x, y, z) { V.box(x, y, z, x + 6, y + 6, z + 6, K.white); V.box(x, y + 5, z, x + 6, y + 6, z + 6, 0xdfe2e8);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= 5) V.set(x + 3 + a, y + 2.5 + b, z + 6, a * a + b * b <= 2 ? 0x2a3564 : K.steel, a * a + b * b <= 2 ? 1 : 2); }
function fridge(V, x, y, z) {   // lying on its back
  V.box(x, y, z, x + 6, y + 5, z + 12, K.white); V.box(x, y + 5, z + 4, x + 6, y + 6, z + 5, 0xd8dbe2); V.box(x + 5, y + 5, z + 1, x + 6, y + 6, z + 3, K.chrome, 2); V.box(x + 5, y + 5, z + 6, x + 6, y + 6, z + 10, K.chrome, 2); }
function carHood(V, x, y, z, c) { for (let k = 0; k < 10; k++) V.box(x + k, y + (k > 6 ? 1 : 0), z, x + k + 1, y + (k > 6 ? 2 : 1), z + 8, c); V.box(x + 8, y + 1, z + 3, x + 10, y + 2, z + 5, K.chrome, 2); }
function cart(V, x, y, z) { for (const [a, b] of [[0, 0], [5, 0], [0, 7], [5, 7]]) V.box(x + a, y, z + b, x + a + 1, y + 1, z + b + 1, 0x1b1b20);
  V.box(x, y + 1, z, x + 6, y + 6, z + 8, (xx, yy, zz) => (yy === y + 1 || ((xx === x || xx === x + 5) && ((zz - z) % 2 === 0 || (yy - y) % 2 === 1)) || ((zz === z || zz === z + 7) && ((xx - x) % 2 === 0 || (yy - y) % 2 === 1))) ? K.steelL : undefined, 2);   // a wire grid (every wire touches the next)
  V.box(x, y + 6, z + 7, x + 6, y + 7, z + 8, K.red); }
function tv(V, x, y, z) { V.box(x, y, z, x + 6, y + 5, z + 5, 0x2b2b33); V.box(x + 1, y + 1, z + 5, x + 5, y + 4, z + 6, 0x7fe0e6, 1); V.set(x + 1, y + 3, z + 5, K.white, 1);
  line(V, x + 2, y + 5, z + 2, x, y + 9, z + 1, K.steelL, 2); line(V, x + 4, y + 5, z + 2, x + 6, y + 9, z + 1, K.steelL, 2); }
function drumLying(V, x, y, z, len, c) { cylH(V, 'x', z, y + 2.5, 2.5, x, x + len, (t) => (t - x === 1 || t - x === len - 2) ? K.ink : c); }
function cone(V, x, y, z) { V.box(x - 2, y, z - 2, x + 2, y + 1, z + 2, K.orange); V.box(x - 1, y + 1, z - 1, x + 1, y + 3, z + 1, K.orange); V.box(x - 1, y + 3, z - 1, x + 1, y + 4, z + 1, K.white); V.box(x - 1, y + 4, z - 1, x, y + 6, z, K.orange); }
function mattress(V, x, y, z) { V.box(x, y, z, x + 10, y + 2, z + 7, (xx) => (xx - x) % 2 ? K.white : K.cobalt); for (const [a, b] of [[2, 2], [7, 2], [2, 5], [7, 5]]) V.set(x + a, y + 2, z + b, K.cobalt); }
function pipe(V, x0, y0, z0, x1, y1, z1) { line(V, x0, y0, z0, x1, y1, z1, K.steel, 2); line(V, x0, y0 + 1, z0, x1, y1 + 1, z1, K.steelD, 2); }

// ───────── scrap: the Heap
function scrap(V, st) {
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) { const d = Math.hypot(x + .5 - C0, (z + .5 - C0) * 1.08) + (hash(x >> 1, z >> 1, 3) - .5) * 2.6;   // the pad
    if (d < 15) V.set(x, 0, z, hash(x >> 2, z >> 2, 5) > .8 ? K.oil : hash(x, z, 9) > .86 ? K.dirtD : K.dirt); }
  const H = [0, 5, 9, 13, 17][st], R = [1, 8, 10.5, 12.5, 14][st];
  const JUNK = [K.rust, K.rust, K.rust, K.rustD, K.rustD, K.steel, K.steel, K.steelD, K.steelD, K.gun, K.cobalt, K.red, K.yellow, K.white, K.teal];
  if (st) for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    const d = Math.hypot(x + .5 - C0, z + .5 - (C0 - 1)), n = (hash(x >> 1, z >> 1, 11) - .5) * 2.4, h = Math.round(H * Math.pow(Math.max(0, 1 - d / R), .8) + (d < R ? n : 0));
    for (let y = 1; y <= h; y++) V.set(x, y, z, JUNK[(hash(x >> 1, y >> 1, z >> 1) * JUNK.length) | 0], hash(x >> 1, y >> 1, z >> 1) > .9 ? 2 : 0); }
  // the stuff that makes it read as junk, not gravel (placed on whatever surface is there at that stage)
  tyre(V, 7, 1, 24); tyre(V, 7, 3, 24); pipe(V, 22, 1, 25, 27, 1, 20);                        // always: tyres by the pad, a bent pipe
  if (st >= 1) { carDoor(V, 9, surf(V, 12, 22) - 1, 22, K.cobalt); cone(V, 26, surf(V, 26, 8), 8); }
  if (st >= 2) { washer(V, 20, surf(V, 22, 18) - 2, 15); tyreUp(V, 3, 1, 14); tyre(V, 27, 1, 16); }
  if (st >= 3) { fridge(V, 11, surf(V, 14, 13) - 2, 9); carHood(V, 3, surf(V, 7, 8) - 1, 4, K.red); cart(V, 22, surf(V, 25, 24) - 1, 22); pipe(V, 15, 3, 9, 9, 12, 4); }
  if (st >= 4) { tv(V, 13, surf(V, 15, 15), 13); drumLying(V, 2, surf(V, 5, 19) - 1, 19, 7, K.yellow); mattress(V, 19, surf(V, 23, 8) - 1, 5); tyre(V, 20, surf(V, 21, 27), 27); }
}

// ───────── salts: drums on four pallets at the dead mall
function pallet(V, x0, z0, w, d, y = 0) { for (let x = x0; x < x0 + w; x += Math.max(1, Math.floor((w - 1) / 2))) V.box(Math.min(x, x0 + w - 2), y, z0, Math.min(x, x0 + w - 2) + 2, y + 1, z0 + d, K.woodD);
  for (let z = z0; z < z0 + d; z++) if ((z - z0) % 3 !== 2 || z === z0 + d - 1) V.box(x0, y + 1, z, x0 + w, y + 2, z + 1, (x) => hash(x, z, 7) > .85 ? shade(K.wood, .88) : K.wood); }
function drum(V, cx, y, cz, open, c = K.cobalt) {
  cyl(V, cx, cz, 3, y, y + 9, (x, yy) => (yy - y === 4) ? (c === K.white ? K.cobalt : K.white) : c);
  if (!open) { cyl(V, cx, cz, 2.6, y + 9, y + 10, K.pink); V.box(cx + 1, y + 10, cz - 1, cx + 2, y + 11, cz, K.white); return; }
  cyl(V, cx, cz, 3, y + 8, y + 9, 0x1c3aa8); for (let k = 0; k < 3; k++) cyl(V, cx, cz, 2.6 - k * .9, y + 8 + k, y + 9 + k, (x, yy, z) => hash(x, yy, z) > .62 ? K.pink : K.white, 1);   // heaped crystals
}
function sack(V, x, y, z) { V.box(x, y, z, x + 5, y + 4, z + 4, K.white); V.box(x, y + 1, z, x + 5, y + 2, z + 4, K.pink); V.box(x + 1, y + 4, z + 1, x + 4, y + 5, z + 3, K.white); V.box(x + 2, y + 5, z + 1, x + 3, y + 6, z + 3, K.pink); }
function crystals(V, x0, z0, w, d, h, seed) { const r = rng(seed); for (let k = 0; k < w * d * .5; k++) { const x = x0 + ((r() * w) | 0), z = z0 + ((r() * d) | 0), s = surf(V, x, z);
  if (s <= h) V.set(x, s, z, r() > .6 ? K.pink : K.white, 1); } }
function salts(V, st) {
  pallet(V, 2, 2, 13, 13); pallet(V, 17, 2, 13, 13); pallet(V, 2, 17, 13, 13); pallet(V, 17, 17, 13, 13);
  const G = [5.5, 11.5, 20.5, 26.5], order = [[0, 3], [1, 3], [0, 2], [2, 3], [1, 2], [3, 3], [0, 1], [2, 2], [1, 1], [3, 2], [0, 0], [2, 1], [1, 0], [3, 1], [2, 0], [3, 0]];
  const count = [0, 3, 7, 11, 16][st], open = new Set([1, 6, 9, 14]);
  order.slice(0, count).forEach(([i, j], k) => drum(V, G[i], 2, G[j], open.has(k), k % 5 === 3 ? K.white : K.cobalt));
  if (st === 4) for (const [i, j, o] of [[0, 3, 0], [0, 2, 1], [1, 2, 0]]) drum(V, G[i], 12, G[j], !!o);   // a second tier, stood on closed lids
  if (st === 0) { cylH(V, 'x', 22, 5, 3, 8, 17, (t, y) => (t === 10 || t === 14) ? K.white : K.cobalt); V.box(8, 3, 20, 9, 8, 25, 0x1c3aa8); crystals(V, 2, 16, 12, 12, 3, 5); }   // a tipped empty drum, its spill
  if (st >= 2) { sack(V, 25, 0, 28); if (st >= 3) sack(V, 0, 0, 27); }
  if (st >= 1) crystals(V, 14, 12, 5, 8, 2, 9 + st);                                       // what falls between the pallets
}

// ───────── goo: the docks' tub and barrels
function barrel(V, cx, y, cz, open) {
  cyl(V, cx, cz, 2.6, y, y + 8, (x, yy, z) => (yy - y === 3 || yy - y === 4) ? (((x + z + yy) & 1) ? K.ink : K.yellow) : K.yellow);
  cyl(V, cx, cz, 2.2, y + 8, y + 9, open ? K.gooD : K.steelD, open ? 0 : 2);
  if (open) { cyl(V, cx, cz, 1.6, y + 8, y + 9, K.goo, GLOW()); V.box(cx + 2, y + 5, cz, cx + 3, y + 9, cz + 1, K.goo, GLOW()); V.box(cx + 2, y, cz, cx + 3, y + 2, cz + 1, K.goo, GLOW()); }
  else V.box(cx - 1, y + 9, cz - 1, cx + 1, y + 10, cz + 1, K.steelD, 2); }
function goo(V, st) {
  const x0 = 4, x1 = 28, z0 = 2, z1 = 19, lvl = [0, 1, 2, 3, 4][st];
  V.box(x0, 0, z0, x1, 1, z1, K.concD); V.box(x0, 1, z0, x1, 5, z1, K.conc); V.clear(x0 + 2, 1, z0 + 2, x1 - 2, 5, z1 - 2);   // the tub: floor + walls 0.4 m
  V.box(x0, 4, z0, x1, 5, z1, (x, y, z) => (x < x0 + 2 || x >= x1 - 2 || z < z0 + 2 || z >= z1 - 2) ? 0xdcd8d0 : undefined);  // a lighter cap on the rim
  if (!lvl) { V.box(x0 + 2, 1, z0 + 2, x1 - 2, 2, z1 - 2, (x, y, z) => (x === x0 + 2 || x === x1 - 3 || z === z0 + 2 || z === z1 - 3) ? K.gooDD : (hash(x, z, 4) > .9 ? K.gooD : undefined));   // a dried crust
    V.box(14, 1, 9, 18, 2, 12, (x, y, z) => (x + z) & 1 ? K.iron : undefined, 2); }
  else { const top = Math.min(4, lvl), cover = [0, .42, .8, 2, 2][lvl], mxx = (x0 + x1) / 2, mzz = (z0 + z1) / 2;   // a puddle, most of the floor, full, brimming
    for (let x = x0 + 2; x < x1 - 2; x++) for (let z = z0 + 2; z < z1 - 2; z++) { if (Math.hypot((x + .5 - mxx) / (x1 - x0 - 4), (z + .5 - mzz) / (z1 - z0 - 4)) + (hash(x >> 1, z >> 1, 2) - .5) * .12 > cover * .62) continue;
      V.box(x, 1, z, x + 1, top, z + 1, K.gooDD); const sw = Math.sin(x * .55 + z * .3) + Math.cos(z * .7 - x * .2);
      V.set(x, top, z, sw > 1.1 ? K.gooD : K.goo, GLOW()); if (hash(x, z, 13) > .93) V.set(x, top + 1, z, K.goo, GLOW()); }
    if (lvl === 4) { V.box(14, 4, z1 - 2, 18, 5, z1, K.goo, GLOW()); V.box(15, 0, z1, 17, 4, z1 + 1, K.goo, GLOW()); V.box(12, 0, z1, 20, 1, z1 + 3, K.goo, GLOW()); } }   // it brims over at the front
  const B = [[7, 25], [13, 26], [19, 25], [25, 26]];
  if (st === 0) { cylH(V, 'x', 26, 2.6, 2.6, 9, 17, (t, y) => (t === 11 || t === 12) ? K.ink : K.yellow); V.box(9, 1, 25, 10, 5, 28, K.gooDD); }   // one tipped, empty
  B.slice(0, [0, 1, 2, 3, 4][st]).forEach(([x, z], k) => barrel(V, x, 0, z, k === 1 || k === 3));
  if (st >= 3) V.box(21, 0, 28, 27, 1, 31, K.goo, GLOW());                                  // a leak pooling
  if (st === 4) cylH(V, 'x', 25.5, 12.6, 2.6, 5, 16, (t, y) => (t === 7 || t === 13) ? K.ink : K.yellow);   // one lying on top of two
}

// ───────── leaf: bundles on a log sled in the woods
function bundle(V, x0, cy, cz, len, seed) { const G = [0x2fbf55, 0x25a748, 0x46d466, 0x1d8f3c];
  cylH(V, 'x', cz, cy, 3, x0, x0 + len, (t, y, u) => (t - x0 === 3 || t - x0 === len - 4) ? 0xc9a36b : G[(hash(t >> 1, y, u + seed) * 4) | 0]);
  for (const ex of [x0 - 1, x0 + len]) for (let y = Math.floor(cy - 2); y <= cy + 1; y++) for (let u = Math.floor(cz - 2); u <= cz + 1; u++) if (hash(ex, y, u + seed) > .45) V.set(ex, y, u, G[(y + u) & 3]); }
function leaf(V, st) {
  for (const x of [5, 24]) cylH(V, 'z', x, 1.5, 1.6, 2, 30, (t, y, u) => (t === 2 || t === 29) ? 0xc9a36b : 0x7a4a22);   // two runner logs
  for (const z of [4, 27]) V.box(3, 2, z, 27, 3, z + 2, K.woodD);
  cyl(V, 29, 5, 2.4, 0, 5, (x, y) => y === 4 ? 0xc9a36b : 0x7a4a22); V.box(28, 5, 4, 30, 6, 6, K.steelL, 2); line(V, 29, 6, 5, 29, 11, 8, K.wood);   // stump + axe
  const r = rng(77); for (let k = 0; k < 26; k++) { const x = (r() * N) | 0, z = (r() * N) | 0; if (!V.has(x, 0, z)) V.set(x, 0, z, [0x2fbf55, 0x46d466, 0xc9a36b, 0x1d8f3c][k & 3]); }
  const T1 = [[4, 8], [16, 8], [4, 14], [16, 14], [4, 20], [16, 20], [4, 26], [16, 26]], T2 = [[4, 11], [16, 11], [4, 17], [16, 17], [4, 23], [16, 23]], T3 = [[10, 14], [10, 20]];
  const all = [...T1.map(p => [...p, 6]), ...T2.map(p => [...p, 11.5]), ...T3.map(p => [...p, 17])];
  all.slice(0, [0, 2, 5, 10, 16][st]).forEach(([x, z, y], k) => bundle(V, x, y, z, 12, k * 7));
  if (st === 0) { cyl(V, 14, 5, 1.6, 3, 5, 0xc9a36b); cyl(V, 14, 5, .6, 3, 5, K.woodD); }  // the twine spool, waiting
}

// ───────── cloth: textile bales
function bale(V, x, y, z, seed) { const P = [K.red, K.yellow, K.cyan, K.pink, K.cobalt, K.white, K.lime, K.orange, K.purple];
  for (let j = 0; j < 7; j++) V.box(x, y + j, z, x + 10, y + j + 1, z + 8, P[(hash(seed, j, 3) * P.length) | 0]);
  for (const sx of [x + 2, x + 7]) { V.box(sx, y, z - 1, sx + 1, y + 7, z, K.ink); V.box(sx, y, z + 8, sx + 1, y + 7, z + 9, K.ink); V.box(sx, y + 7, z - 1, sx + 1, y + 8, z + 9, K.ink); }
  V.box(x + 4, y + 4, z + 8, x + 6, y + 6, z + 9, K.white); }
function cloth(V, st) {
  pallet(V, 2, 3, 13, 26); pallet(V, 17, 3, 13, 26);
  const T1 = [[3, 4], [18, 4], [3, 13], [18, 13], [3, 22], [18, 22]], T2 = [[3, 4], [18, 13], [3, 22]], n = [0, 1, 3, 6, 9][st];
  [...T1.map(p => [...p, 2]), ...T2.map(p => [...p, 10])].slice(0, n).forEach(([x, z, y], k) => bale(V, x, y, z, k * 13 + 5));
  if (st === 4) cylH(V, 'x', 13, 20.5, 2.5, 8, 26, (t, y, u) => ((t >> 1) & 1) ? K.pink : K.cyan);   // a fabric roll across the top
  if (st >= 2) { V.box(28, 2, 5, 29, 9, 11, K.pink); V.box(24, 9, 5, 29, 10, 11, K.pink); }     // a length of pink draped over a bale
  if (st === 0) { line(V, 5, 2, 8, 12, 2, 20, K.ink); line(V, 20, 2, 10, 26, 2, 24, K.ink); V.box(18, 2, 12, 24, 3, 16, K.cyan); }   // loose straps, a scrap of fabric
}

const KINDS = { scrap, salts, goo, leaf, cloth };
export function pile(kind = 'scrap', level = 1) {
  const st = stageOf(level), f = KINDS[kind] || scrap, V = vol(N, 26, N);
  f(V, st); return done(V, 'pile-' + (KINDS[kind] ? kind : 'scrap'), 'ground: base centre of the 3.2 × 3.2 m site', { stage: st });
}
