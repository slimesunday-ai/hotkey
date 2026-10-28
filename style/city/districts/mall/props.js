// MILLENNIUM MALL · the ruin's own props (owner: the Sunny Acres / Millennium Mall agent). Base centre, facing +z, memoised.
// The lot: dead light poles, cart corrals and loose carts, burnt cars, barriers, cones, rubble, dead palms in their planters.
// The dig: wheelbarrows, shovels stuck in the dirt, buckets, a sifting screen, work lights on tripods (the only lights left on at night),
// a generator, a ladder, tarp shelters. The food court: tables under faded umbrellas, stacked chairs. The pylon's fallen letters.
import { PAL, CV, hash, shade, TOD, M, lit, pv, done, txt, tw, cyl, ring, line, textMask } from '../trailer/brush.js';

const INK = PAL.ink, WHITE = PAL.white, GALV = 0xb9bcc4, STEEL = 0x8f9096, CONC = 0xb8b3a8, RUST = 0x9a4a24, RUSTD = 0x6e3418, ORANGE = 0xff7a1a;
const P5 = (nx, ny, nz, cx = nx / 2, cz = nz / 2) => pv(nx, ny, nz, cx, cz, .05);

// a parking-lot light: a 9 m steel pole on a concrete base, two box heads; v 1 has lost a head, v 2 leans, v 3 is a snapped stump
export const lotLight = (v, on = false) => M('lotlight' + (v % 4) + on, 'lamp', () => { v %= 4; const V = pv(40, 96, 8, 20, 4), o = 5;
  V.box(12 + o, 0, 1, 18 + o, 6, 7, CONC); V.box(12 + o, 6, 1, 18 + o, 7, 7, shade(CONC, .9));
  if (v === 3) { V.box(14 + o, 7, 3, 16 + o, 18, 5, STEEL, 2); V.box(14 + o, 18, 3, 15 + o, 20, 5, STEEL, 2); return done(V, 'lamp'); }
  const top = 90; for (let y = 7; y < top; y++) { const dx = v === 2 ? Math.round((y - 7) * .09) : 0; V.box(14 + o + dx, y, 3, 16 + o + dx, y + 1, 5, STEEL, 2); }
  const tx = (v === 2 ? 14 + Math.round(82 * .09) : 14) + o; V.box(tx - 10, top - 2, 3, tx + 12, top, 5, STEEL, 2);
  for (const hx of v === 1 ? [tx + 7] : [tx - 11, tx + 7]) { V.box(hx, top - 5, 1, hx + 6, top - 2, 7, 0x6d707a, 2); V.box(hx + 1, top - 6, 2, hx + 5, top - 5, 6, on && TOD.night ? 0xfff0c0 : 0xdfe2e8, on && TOD.night ? 3 : 1); }
  return done(V, 'lamp'); });
// a shopping cart (0.05): wire basket, red handle, four casters; tipped = on its side
export const cart = (tipped = false) => M('mcart' + tipped, 'cart', () => { const V = P5(14, 22, 20);
  const basket = (x0, y0, z0) => { for (let x = x0; x < x0 + 12; x++) for (let y = y0; y < y0 + 9; y++) for (let z = z0; z < z0 + 16; z++) { const edge = x === x0 || x === x0 + 11 || z === z0 || z === z0 + 15 || y === y0; if (edge && ((x + y + z) % 2 === 0 || y === y0 + 8 || y === y0)) V.set(x, y, z, GALV, 2); } };
  if (!tipped) { basket(1, 8, 2); for (const [x, z] of [[1, 3], [12, 3], [1, 16], [12, 16]]) { V.box(x, 1, z, x + 1, 8, z + 1, GALV, 2); V.box(x, 0, z, x + 1, 1, z + 1, INK); } V.box(1, 17, 17, 13, 18, 19, 0xe8232a); V.box(1, 16, 17, 2, 17, 18, GALV, 2); V.box(12, 16, 17, 13, 17, 18, GALV, 2); }
  else { for (let x = 0; x < 9; x++) for (let y = 0; y < 12; y++) for (let z = 2; z < 18; z++) { const edge = x === 0 || x === 8 || y === 0 || y === 11 || z === 2 || z === 17; if (edge && ((x + y + z) % 2 === 0 || x === 0 || y === 0)) V.set(x, y, z, GALV, 2); } V.box(9, 10, 17, 11, 12, 19, 0xe8232a); V.box(8, 10, 17, 9, 11, 18, GALV, 2); }
  return done(V, 'cart'); });
// the cart corral: galvanised rails, a CART RETURN board on its end post
// the cart corral: galvanised rails; its board differs corral to corral (one lost its board, one lost a rail). The volume is 40 wide so a 6-letter
// board fits (at 28 it cut RETURN to RETURI).
export const corral = (v = 0) => M('corral' + (v % 4), 'corral', () => { v %= 4; const V = P5(40, 44, 86, 20, 43);
  for (const x of [7, 32]) { for (const z of [2, 41, 80]) V.box(x, 0, z, x + 1, 22, z + 2, GALV, 2); for (const y of [10, 21]) { if (v === 2 && x === 32 && y === 21) { V.box(x, 10, 42, x + 1, 11, 80, GALV, 2); V.box(x, 21, 2, x + 1, 22, 41, GALV, 2); continue; } V.box(x, y, 2, x + 1, y + 1, 82, GALV, 2); } }
  V.box(7, 21, 81, 33, 22, 82, GALV, 2); V.box(18, 0, 81, 21, v === 3 ? 26 : 34, 83, GALV, 2);
  const words = [['CART', 'RETURN', 0x2f5bff], ['RETURN', 'CARTS', 0xe8232a], ['CARTS', 'ONLY', 0x14a83b], null][v];
  if (words) { const [s1, s2, bg] = words, w = Math.max(tw(s1), tw(s2)) + 4; V.box(20 - (w >> 1), 26, 83, 20 - (w >> 1) + w, 44, 84, bg); txt(V, s1, 20 - (tw(s1) >> 1), 42, 84, WHITE); txt(V, s2, 20 - (tw(s2) >> 1), 33, 84, WHITE); }
  return done(V, 'corral'); });
// a burnt-out car: soot-black and rust, no glass, sitting on its rims
export const burntCar = v => M('burnt' + (v % 2), 'car', () => { const L = 42, W = 18, V = pv(W + 2, 18, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 1, 1, x1, 8, L + 1, (x, y, z) => hash(x, y, z) > .7 ? RUST : hash(x, z, 3) > .5 ? 0x2a2622 : 0x1d1b19);
  V.box(x0 + 1, 8, 11, x1 - 1, 15, 31, (x, y, z) => hash(x, y, z, 5) > .6 ? RUSTD : 0x2a2622); V.clear(x0 + 2, 9, 12, x1 - 2, 14, 30); for (const z of [11, 30]) V.box(x0 + 1, 15, z, x1 - 1, 16, z + 1, 0x2a2622);
  for (const x of [x0, x1 - 1]) V.clear(x, 9, 13, x + 1, 14, 29); V.box(x0 + 2, 1, 12, x1 - 2, 3, 30, 0x3a3330);
  for (const z of [7, L - 7]) for (const x of [x0 - 1, x1]) V.box(x, 0, z - 2, x + 1, 4, z + 3, 0x6d707a, 2);
  if (v % 2) V.box(x0 + 3, 8, 33, x1 - 3, 9, L, RUSTD);
  return done(V, 'car'); });
export const jersey = c => M('jersey' + c, 'barrier', () => { const V = pv(20, 8, 6); for (let y = 0; y < 8; y++) { const w = y < 3 ? 3 : y < 5 ? 2 : 1; V.box(0, y, 3 - w, 20, y + 1, 3 + w, (x) => (c && y === 6 && ((x >> 2) & 1)) ? c : CONC); } return done(V, 'barrier'); });
export const cone = () => M('mcone', 'cone', () => { const V = P5(8, 14, 8); V.box(0, 0, 0, 8, 1, 8, ORANGE); for (let y = 1; y < 13; y++) { const r = 3.2 - y * .2; cyl(V, 4, 4, r, y, y + 1, (y > 5 && y < 9) ? WHITE : ORANGE); } return done(V, 'cone'); });
// rubble: a heap of broken concrete with rebar sticking out (sizes 1…3)
export const rubble = (v, n = 2) => M('rubble' + v + '.' + n, 'rubble', () => { const R = 6 + n * 4, V = pv(2 * R + 2, R + 4, 2 * R + 2, R + 1, R + 1);
  for (let x = 0; x < 2 * R + 2; x++) for (let z = 0; z < 2 * R + 2; z++) { const d = Math.hypot(x + .5 - R - 1, (z + .5 - R - 1) * 1.15); if (d > R) continue;
    const h = Math.max(1, Math.round((R - d) * .8 + (hash(x >> 1, z >> 1, v) - .5) * 3)); for (let y = 0; y < h; y++) V.set(x, y, z, [CONC, 0xa7a9b1, 0x9a958c, 0xc9c4b8, 0x8f8a80][((hash(x >> 1, y >> 1, z >> 1, v) * 5) | 0)]); }
  for (let k = 0; k < 2 + n; k++) { const a = hash(k, v, 3) * 6.28, x = R + 1 + Math.round(Math.cos(a) * R * .4), z = R + 1 + Math.round(Math.sin(a) * R * .4); let y = 0; while (V.has(x, y, z)) y++; line(V, x, Math.max(0, y - 1), z, x + Math.round(Math.cos(a) * 3), y + 3 + (k % 3), z + Math.round(Math.sin(a) * 3), RUST, 2); }
  return done(V, 'rubble'); });
// a mall palm in its round concrete planter: green, or dead and brown with its fronds hanging
export const palm = dead => M('palm' + dead, 'tree', () => { const V = pv(36, 74, 36, 18, 18), g = dead ? 0x9a7a3a : 0x2fbf55, g2 = dead ? 0x7a5a2a : 0x25a748;
  ring(V, 18, 18, 4, 6, 0, 5, CONC); cyl(V, 18, 18, 4, 0, 4, 0x6b4a2a); for (let y = 4; y < 62; y++) { const dx = Math.round(Math.sin(y / 18) * 2); V.box(17 + dx, y, 17, 19 + dx, y + 1, 19, (y % 4 === 0) ? 0x8a6a3a : 0xa4803f); }
  const cx = 18 + Math.round(Math.sin(61 / 18) * 2); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; let py = 63;
    for (let t = 0; t < 13; t++) { const x = cx + Math.round(Math.cos(a) * t), z = 18 + Math.round(Math.sin(a) * t), y = 63 - Math.round((dead ? .09 : .04) * t * t); V.box(x, y, z, x + 1, Math.max(py, y + 1 + (t < 9 ? 1 : 0)), z + 1, t % 3 ? g : g2); py = y + 1; } }
  V.box(cx - 1, 61, 17, cx + 3, 64, 21, g2); return done(V, 'tree'); });
// a concrete planter box gone to weeds
export const planter = v => M('mplanter' + (v % 3), 'planter', () => { const V = pv(24, 10, 12); V.box(0, 0, 0, 24, 5, 12, CONC); V.box(1, 4, 1, 23, 5, 11, 0x6b4a2a);
  for (let x = 2; x < 22; x += 3) { const h = 2 + ((x * 7 + v) % 4); V.box(x, 5, 3 + (x % 5), x + 2, 5 + h, 5 + (x % 5), (v % 3) ? 0x8a9a3a : 0x5a8a3a); } return done(V, 'planter'); });

// ── the dig
export const wheelbarrow = c => M('wbar' + c, 'barrow', () => { const V = P5(16, 14, 30, 8, 15); for (let z = 6; z < 22; z++) { const w = z < 10 ? 4 + (z - 6) : z > 18 ? 8 - (z - 18) : 8; V.box(8 - w, 6, z, 8 + w, 7, z + 1, c); for (const x of [8 - w, 8 + w - 1]) V.box(x, 7, z, x + 1, 11, z + 1, c); } V.box(4, 7, 5, 12, 11, 6, c); V.box(4, 7, 22, 12, 11, 23, c);
  for (let a = 0; a < 16; a++) { const t = a / 16 * 6.28; V.set(8, 3 + Math.round(Math.sin(t) * 3), 3 + Math.round(Math.cos(t) * 3), INK); }
  for (const x of [3, 12]) { line(V, x, 5, 22, x, 8, 29, STEEL, 2); V.box(x, 0, 20, x + 1, 6, 21, STEEL, 2); } V.box(7, 3, 3, 9, 6, 6, STEEL, 2); V.box(5, 7, 12, 11, 10, 18, 0x9a7a4a); return done(V, 'barrow'); });
export const shovel = v => M('shovel' + (v % 2), 'tool', () => { const V = P5(6, 30, 4, 3, 2); V.box(2, 0, 1, 4, 5, 3, 0x9a9ca4, 2); V.box(1, 5, 1, 5, 6, 3, 0x9a9ca4, 2); V.box(2, 6, 1, 4, 26, 2, v % 2 ? 0xa4652f : 0xffc21a); V.box(1, 26, 1, 5, 27, 2, INK); V.box(1, 27, 1, 2, 29, 2, INK); V.box(4, 27, 1, 5, 29, 2, INK); return done(V, 'tool'); });
export const bucket = c => M('mbucket' + c, 'bucket', () => { const V = P5(8, 9, 8); ring(V, 4, 4, 2.2, 3.8, 0, 8, c); cyl(V, 4, 4, 2.2, 0, 1, c); cyl(V, 4, 4, 2.2, 1, 5, 0x9a8a6a); V.box(1, 8, 3, 7, 9, 4, INK); return done(V, 'bucket'); });
export const sieve = () => M('sieve', 'sieve', () => { const V = P5(28, 20, 20); for (const [x, z] of [[1, 1], [26, 1], [1, 18], [26, 18]]) V.box(x, 0, z, x + 1, 14 + (z > 10 ? 2 : 0), z + 1, 0xa4652f);
  for (let z = 1; z < 19; z++) { const y = 14 + (z > 10 ? 2 : Math.round(z / 10 * 2)); V.box(1, y, z, 27, y + 1, z + 1, (x) => (x === 1 || x === 26 || z === 1 || z === 18) ? 0xa4652f : ((x + z) % 2 ? 0x6d707a : undefined)); } V.box(6, 15, 6, 14, 16, 12, 0xff4fa3); V.box(16, 15, 8, 22, 16, 13, 0x2de2e6); return done(V, 'sieve'); });
export const workLight = () => M('worklight', 'lamp', () => { const V = P5(20, 50, 20); for (const [x, z] of [[1, 1], [18, 1], [10, 18]]) line(V, x, 0, z, 10, 36, 9, INK); V.box(9, 36, 8, 11, 42, 10, INK);
  V.box(5, 42, 7, 15, 49, 12, 0xffc21a); V.box(6, 43, 12, 14, 48, 13, TOD.night ? 0xfffbe0 : 0xdfe2e8, TOD.night ? 3 : 1); return done(V, 'lamp'); });
export const generator = () => M('genny', 'generator', () => { const V = pv(12, 9, 8); V.box(0, 0, 0, 12, 1, 8, INK); V.box(1, 1, 1, 11, 7, 7, 0xffc21a); V.box(2, 7, 2, 10, 8, 6, INK); V.box(1, 3, 7, 5, 6, 8, 0x3a3d45); for (const x of [0, 11]) V.box(x, 1, 0, x + 1, 8, 1, INK); return done(V, 'generator'); });
export const tarpShelter = c => M('tshelter' + c, 'shelter', () => { const V = pv(26, 24, 24, 13, 12); for (const [x, z] of [[0, 0], [25, 0], [0, 23], [25, 23]]) V.box(x, 0, z, x + 1, 22 - (z > 10 ? 2 : 0), z + 1, 0xa4652f);
  for (let z = 0; z < 24; z++) V.box(0, 22 - Math.round(z / 12), z, 26, 23 - Math.round(z / 12), z + 1, (x) => hash(x >> 2, z >> 2, 5) > .9 ? shade(c, .8) : c);
  V.box(3, 0, 3, 17, 2, 20, (x, y, z) => ((x + z) & 3) ? 0xe6e1d6 : 0x9fb8e8); V.box(19, 0, 4, 24, 5, 9, 0x2f5bff); V.box(19, 0, 12, 24, 4, 17, 0xe8232a); return done(V, 'shelter'); });
export const tapeRun = (len) => M('tape' + len, 'tape', () => { const n = Math.round(len / .05), V = P5(n + 2, 22, 4, (n + 2) / 2, 2);
  for (const x of [0, n]) { V.box(x, 0, 1, x + 2, 20, 3, ORANGE); V.box(x, 0, 0, x + 2, 1, 4, INK); }
  for (let x = 2; x < n; x++) { const t = (x - 1) / n, y = 17 - Math.round(4 * t * (1 - t) * 3); V.box(x, y, 2, x + 1, y + 2, 3, (x >> 2) & 1 ? INK : 0xffe23a); } return done(V, 'tape'); });
export const ladder = () => M('mladder', 'ladder', () => { const V = pv(6, 44, 14, 3, 7); for (let y = 0; y < 44; y++) { const z = Math.round(y * .22); for (const x of [0, 5]) V.set(x, y, z, 0xb9bcc4, 2); if (y % 4 === 2) V.box(0, y, z, 6, y + 1, z + 1, 0xb9bcc4, 2); } return done(V, 'ladder'); });
// a letter fallen off the pylon, face up on the asphalt (1.4 m tall at 0.1: the pylon's own size)
export const fallenLetter = (ch, c) => M('fallen' + ch + c, 'letter', () => { const t = textMask(ch), sc = 2, V = pv(t.w * sc + 2, 3, 7 * sc + 2); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) V.box(1 + i * sc, 0, 1 + j * sc, 1 + (i + 1) * sc, 2, 1 + (j + 1) * sc, (x, y) => y ? c : shade(c, .7)); return done(V, 'letter'); });
// the food court: a round table, four chairs, a faded umbrella; chairs stacked on a table
export const fcTable = (c, umb = true) => M('fct' + c + umb, 'table', () => { const V = pv(24, umb ? 26 : 9, 24, 12, 12); cyl(V, 12, 12, 4, 7, 8, 0xe6e1d6); V.box(11, 0, 11, 13, 7, 13, STEEL, 2); V.box(9, 0, 9, 15, 1, 15, STEEL, 2);
  for (const [x, z, r] of [[12, 3, 0], [12, 19, 0], [3, 12, 1], [19, 12, 1]]) { V.box(x - 2, 4, z - 2, x + 3, 5, z + 3, c); if (r) V.box(x < 12 ? x - 2 : x + 2, 5, z - 2, x < 12 ? x - 1 : x + 3, 9, z + 3, c); else V.box(x - 2, 5, z < 12 ? z - 2 : z + 2, x + 3, 9, z < 12 ? z - 1 : z + 3, c); for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) V.box(x + dx, 0, z + dz, x + dx + 1, 4, z + dz + 1, STEEL, 2); }
  if (umb) { V.box(11, 8, 11, 13, 22, 13, WHITE); for (let k = 0; k < 4; k++) cyl(V, 12, 12, 11 - k * 2.6, 22 + k, 23 + k, (x, y, z) => ((Math.atan2(z - 12, x - 12) * 3 / Math.PI + 6) % 2 < 1) ? shade(c, 1.1) : 0xf2efe6); }
  return done(V, 'table'); });
// the excavator nobody came back for: tracks, a yellow cab, the boom folded down with its bucket resting in the rubble
export const excavator = () => M('excavator', 'excavator', () => { const V = pv(34, 40, 64, 17, 26), Y = 0xffc21a, T = 0x2a2a30;
  for (const x of [1, 24]) { V.box(x, 0, 4, x + 9, 6, 44, T); for (let z = 5; z < 44; z += 3) V.box(x, 6, z, x + 9, 7, z + 1, 0x3a3a42); V.box(x + 1, 1, 2, x + 8, 5, 4, T); V.box(x + 1, 1, 44, x + 8, 5, 46, T); }
  V.box(8, 6, 14, 26, 9, 34, 0x3a3a42); V.box(4, 9, 8, 30, 20, 38, Y); V.box(4, 20, 10, 30, 21, 38, shade(Y, .85)); V.box(18, 9, 24, 30, 32, 38, Y); V.box(19, 20, 36, 29, 30, 38, 0x9fd8ff, 1); V.box(29, 20, 26, 30, 30, 36, 0x9fd8ff, 1);
  V.box(4, 9, 8, 16, 18, 10, 0x3a3a42); V.box(18, 32, 24, 30, 33, 38, 0x3a3a42);
  V.box(18, 20, 26, 19, 30, 36, 0x9fd8ff, 1); V.box(20, 20, 24, 28, 29, 25, 0x9fd8ff, 1); for (const z of [30]) V.box(18, 20, z, 19, 30, z + 1, Y);   // glass all round, a pillar
  V.box(4, 20, 12, 12, 21, 34, 0x3a3a42); for (let z = 13; z < 34; z += 3) V.box(5, 21, z, 11, 22, z + 1, 0x6d707a);                       // the engine deck's grille
  for (let k = 0; k < 20; k++) V.box(11, 18 + Math.round(k * .7), 38 + k, 15, 21 + Math.round(k * .7), 39 + k, Y);                       // the boom
  for (let k = 0; k < 10; k++) V.box(12, 32 - k * 3, 57 + (k > 3 ? 1 : 0), 14, 35 - k * 3, 59 + (k > 3 ? 1 : 0), shade(Y, .9));        // the stick
  V.box(12, 22, 44, 14, 24, 52, 0x3a3a42); V.box(12, 30, 55, 14, 33, 58, 0x3a3a42);                                                    // the rams
  V.box(8, 0, 56, 18, 5, 63, T); for (let x = 8; x < 18; x += 3) V.box(x, 0, 63, x + 1, 2, 64, 0x9a9ca4, 2);
  return done(V, 'excavator'); });
// a slab of fallen wall: pink skin on top, the grey block core on its edges, rebar out of one broken edge
export const wallChunk = v => M('wallchunk' + (v % 2), 'rubble', () => { const w = v % 2 ? 14 : 20, V = pv(w + 4, 8, 12, (w + 4) / 2, 6), P = 0xff4fa3;
  for (let x = 0; x < w; x++) { const h = 3 + (x % 5 === 0 ? 1 : 0); V.box(x, 0, 1, x + 1, h, 10 - (x * 3 + v) % 3, (xx, y) => y === h - 1 ? P : 0xa7a9b1); }
  for (const z of [3, 7]) line(V, w - 1, 2, z, w + 3, 5, z, 0x9a4a24, 2); return done(V, 'rubble'); });
// weeds up through a crack: blades and, on half of them, a dandelion on its stem (0.05 grain)
export const weeds = v => M('weeds' + (v % 4), 'weeds', () => { v %= 4; const V = P5(10, 10, 10), G = [0x5a9a3a, 0x6fae42, 0x8ab04f, 0x4e8a34];
  for (let k = 0; k < 7 + v; k++) { const x = 2 + ((k * 7 + v * 3) % 6), z = 2 + ((k * 5 + v) % 6), h = 3 + ((k * 3 + v) % 6); for (let y = 0; y < h; y++) V.set(x + (y > 3 && k % 2 ? 1 : 0), y, z, G[(k + v) % 4]); }
  if (v % 2) { V.box(3, 0, 4, 4, 7, 5, G[2]); V.box(2, 7, 3, 5, 9, 6, 0xffe23a); }
  return done(V, 'weeds'); });
// a mattress dumped flat, a stain on it
export const mattress = c => M('mattress' + c, 'junk', () => { const V = pv(20, 3, 12, 10, 6); V.box(0, 0, 0, 20, 2, 12, (x, y, z) => ((x % 5 === 0 || z % 4 === 0) && y === 1) ? shade(c, .85) : c); V.box(4, 2, 3, 9, 3, 7, 0xa4845a); return done(V, 'junk'); });
