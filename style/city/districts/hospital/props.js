// ST. MERCY · the hospital's own props (owner: the St. Mercy / Route 9 agent). Base centre, facing +z, memoized per argument and time
// of day (lit parts switch to layer 3 at night). The ambulance, its gurney, the wheelchair and the IV pole the smokers wheel out, the
// sand urn, the two vending machines, a steel bench, the saint with the cone, the liquid-oxygen tank, the generator, the hearse at the
// morgue door, biohazard bins, a linen cart, the garage's pay booth and gate arm, sign plates.
import { C, CV, TOD, lit, memo, pv, done, cyl, px, hand, mini, vtext, vtextX, shade, H } from './lib.js';

const S2 = .05, fine = (nx, ny, nz) => pv(nx, ny, nz, S2);   // half-grain (0.05) for small things: plates, the urn, the IV pole
// the star of life (six arms), painted on an x plane (the ambulance's sides)
const star6X = (V, x, cy, cz, col) => { for (let d = -3; d <= 3; d++) { V.set(x, cy, cz + d, col); V.set(x, cy + d, cz, col); if (Math.abs(d) <= 2) { V.set(x, cy + d, cz + d, col); V.set(x, cy - d, cz + d, col); } } };
const star6Z = (V, cx, cy, z, col) => { for (let d = -3; d <= 3; d++) { V.set(cx + d, cy, z, col); V.set(cx, cy + d, z, col); if (Math.abs(d) <= 2) { V.set(cx + d, cy + d, z, col); V.set(cx + d, cy - d, z, col); } } };   // (the same star on a z plane)

// ── THE AMBULANCE: a box ambulance, 2.0 × 5.6 m, 2.8 m to the box roof. White, a red band all round, the blue star of life on the
// box sides, the unit number on the roof for the overhead camera, MERCY over the cab, a light bar on the cab and red beacons at the
// box's corners (lights: lit day and night — the one pulling in). open: the rear doors folded back, the bay lit, the stretcher out.
export const ambulance = ({ unit = 7, lights = false, open = false } = {}) => memo(`amb${unit}${lights}${open}`, () => {
  const W = 20, L = 56, V = pv(W + 8, 34, L + 8, CV, (W + 8) / 2, (L + 8) / 2), WH = C.chalk, RD = C.sRed, on = lights || TOD.night, bx = 38;
  const x0 = 4, x1 = x0 + W, z0 = 4, z1 = z0 + L, zc = z0 + bx;   // the box runs z0…zc, the cab zc…zc+10, the hood to z1
  V.box(x0, 3, z0, x1, 9, z1, WH);                                                                           // the chassis
  V.box(x0, 9, z0, x1, 28, zc, WH); V.box(x0 + 1, 28, z0 + 1, x1 - 1, 29, zc - 1, 0xe9ecef);                // the box and its roof
  V.box(x0, 9, zc, x1, 20, zc + 10, WH); V.box(x0 + 1, 20, zc, x1 - 1, 21, zc + 9, 0xe9ecef);               // the cab and its roof
  V.box(x0, 9, zc + 10, x1, 13, z1, WH);                                                                     // the hood
  V.box(x0 + 1, 13, zc + 9, x1 - 1, 19, zc + 10, 0x9fd8ff, 1);                                                // the windscreen
  for (const x of [x0, x1 - 1]) V.box(x, 13, zc + 2, x + 1, 19, zc + 8, 0x9fd8ff, 1);                       // the cab's side windows
  // the red band round the body (only on its skin), the blue pinstripe under it on the box
  V.box(x0, 10, z0, x1, 13, z1, (x, y, z) => (x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1) && V.has(x, y, z) ? RD : undefined);
  V.box(x0, 9, z0, x1, 10, zc, (x, y, z) => (x === x0 || x === x1 - 1 || z === z0) ? C.cobalt : undefined);
  for (const x of [x0 - 1, x1]) star6X(V, x, 23, z0 + 5, C.cobalt);                                         // the star of life at the back of both sides
  { const M = px('MERCY'); for (const [x, dir] of [[x0 - 1, -1], [x1, 1]]) vtextX(V, M, z0 + 23 - (M.w >> 1), 21, x, RD, { dir }); }   // MERCY along both sides, over the band
  { const M = px(String(unit)); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.set(x0 + (W >> 1) + (M.w >> 1) - i, 29, z0 + 15 + 6 - j, C.ink); }   // the unit number, on the roof
  star6Z(V, x0 + (W >> 1), 23, zc, C.cobalt);                                                               // the star of life over the cab, on the box's front
  // lights: the cab's bar (red · white · red, set back from the lettering), red beacons on the box corners, amber markers, lamps
  V.box(x0 + 2, 21, zc + 5, x1 - 2, 23, zc + 8, (x) => x < x0 + 7 ? (on ? 0xff2a2a : 0x9a1f24) : x < x1 - 7 ? (on ? 0xffffff : 0xc9ced6) : (on ? 0xff2a2a : 0x9a1f24), on ? 3 : 1);
  for (const x of [x0, x1 - 2]) for (const z of [z0, zc - 2]) V.box(x, 27, z, x + 2, 29, z + 2, on ? 0xff2a2a : 0x9a1f24, on ? 3 : 1);
  for (const x of [x0 - 1, x1]) for (const z of [z0 + 2, zc - 3]) V.box(x, 25, z, x + 1, 26, z + 1, 0xffb000, on ? 3 : 1);
  V.box(x0, 9, z1, x0 + 4, 11, z1 + 1, 0xffffff, lit(1)); V.box(x1 - 4, 9, z1, x1, 11, z1 + 1, 0xffffff, lit(1)); V.box(x0 + 6, 5, z1, x1 - 6, 9, z1 + 1, 0x33333b);   // lamps, grille
  V.box(x0 + 1, 5, z1, x1 - 1, 7, z1 + 2, C.chrome, 2);                                                      // the bumper
  for (const x of [x0, x1 - 2]) V.box(x, 14, z0 - 1, x + 2, 17, z0, 0xd7141a, lit(1));                      // the tail lamps
  if (!open) { V.box(x0 + 2, 10, z0 - 1, x1 - 2, 27, z0, WH); V.box(x0 + (W >> 1), 10, z0 - 1, x0 + (W >> 1) + 1, 27, z0, 0xc9ced6); for (const x of [x0 + 3, x0 + (W >> 1) + 3]) V.box(x, 19, z0 - 1, x + 5, 25, z0, 0x9fd8ff, 1); }
  else { V.box(x0 + 1, 9, z0, x1 - 1, 27, z0 + 30, -1); V.box(x0 + 1, 9, z0 + 30, x1 - 1, 27, z0 + 31, 0xdfe6ee); V.box(x0 + 1, 8, z0, x1 - 1, 9, z0 + 30, 0x9aa0a8);   // the bay: open to its front wall
    V.box(x0 + 1, 26, z0, x1 - 1, 27, z0 + 30, 0xfff6d8, 3);                                                   // its light (on: the doors are open)
    V.box(x0 + 4, 9, z0 + 4, x1 - 10, 12, z0 + 26, 0x9aa0a8); V.box(x0 + 4, 12, z0 + 4, x1 - 10, 13, z0 + 26, C.chalk); V.box(x0 + 4, 13, z0 + 4, x1 - 10, 14, z0 + 8, 0x2f7bff);   // the bench stretcher
    V.box(x1 - 7, 9, z0 + 6, x1 - 2, 20, z0 + 12, 0x6d707a); V.box(x1 - 6, 17, z0 + 12, x1 - 3, 19, z0 + 13, 0x2de2e6, 1);   // the monitor cabinet
    for (const x of [x0 - 1, x1]) V.box(x, 10, z0 - 1, x + 1, 27, z0 + 9, WH); }                               // the doors, folded back along the sides
  for (const z of [z0 + 8, z1 - 9]) for (const x of [x0 - 1, x1 - 2]) { V.box(x, 0, z - 4, x + 3, 8, z + 4, C.rubber); V.box(x + (x < x0 ? 0 : 2), 2, z - 2, x + 1 + (x < x0 ? 0 : 2), 6, z + 2, C.chrome, 2); }
  for (const z of [z0 + 8, z1 - 9]) V.clear(x0 + 2, 0, z - 4, x1 - 2, 3, z + 4);
  V.box(x0 + 2, 3, z0 - 3, x1 - 2, 4, z0, 0x9aa0a8, 2);                                                       // the step under the doors
  return done(V, 'ambulance'); });

// ── the stretcher (on its wheels, the mattress made, a blue blanket folded at the foot): 0.6 × 2.0 m, 0.9 m high
export const gurney = () => memo('gurney', () => { const V = pv(8, 12, 22), S = C.steelL;
  for (const [x, z] of [[1, 2], [6, 2], [1, 19], [6, 19]]) { V.box(x, 0, z, x + 1, 1, z + 1, C.rubber); V.box(x, 1, z, x + 1, 7, z + 1, S, 2); }
  V.box(1, 4, 2, 7, 5, 20, S, 2); V.box(1, 7, 1, 7, 8, 21, S, 2); V.box(1, 8, 1, 7, 9, 21, C.chalk); V.box(1, 9, 16, 7, 10, 21, 0x2f7bff); V.box(2, 9, 2, 6, 10, 5, 0xe9ecef);
  V.box(0, 8, 1, 1, 11, 21, S, 2); V.box(7, 8, 1, 8, 11, 21, S, 2);
  return done(V, 'gurney'); });
// ── the wheelchair (someone sits in it: the seat is 0.5 m up): 0.8 × 1.0 m
export const wheelchair = () => memo('wheelchair', () => { const V = pv(8, 10, 10), S = C.steelL, B = 0x2a2d38;
  for (const x of [0, 7]) { for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; V.set(x, 3 + Math.round(Math.sin(t) * 3), 5 + Math.round(Math.cos(t) * 3), C.rubber); } V.box(x, 2, 4, x + 1, 5, 7, S, 2); }
  V.box(1, 4, 2, 7, 5, 8, B); V.box(1, 5, 7, 7, 10, 8, B); V.box(1, 0, 1, 2, 4, 2, S, 2); V.box(6, 0, 1, 7, 4, 2, S, 2); V.box(1, 1, 0, 7, 2, 2, S, 2);
  V.box(1, 7, 2, 2, 8, 7, S, 2); V.box(6, 7, 2, 7, 8, 7, S, 2); V.box(1, 5, 2, 2, 7, 3, S, 2); V.box(6, 5, 2, 7, 7, 3, S, 2);
  return done(V, 'wheelchair'); });
// ── the IV pole a patient wheels out for a smoke (0.05 grain): casters, the pole, two bags on the hooks
export const ivPole = () => memo('ivpole', () => { const V = fine(10, 40, 10), S = C.steelL;
  for (const [x, z] of [[1, 5], [8, 5], [5, 1], [5, 8], [2, 2]]) V.box(x, 0, z, x + 1, 1, z + 1, C.rubber);
  V.box(1, 1, 4, 9, 2, 6, S, 2); V.box(4, 1, 1, 6, 2, 9, S, 2); V.box(4, 2, 4, 6, 38, 6, S, 2); V.box(2, 37, 4, 8, 38, 6, S, 2);
  V.box(1, 29, 4, 3, 36, 6, 0xd8f2ff, 1); V.box(1, 36, 4, 3, 37, 6, S, 2); V.box(7, 31, 4, 9, 36, 6, 0xfff3a8, 1); V.box(7, 36, 4, 9, 37, 6, S, 2); V.box(1, 20, 4, 2, 29, 5, 0xe8f4ff, 1);
  return done(V, 'iv-pole'); });
// ── the sand urn by the door (0.05 grain): steel, a sand top full of butts
export const urn = () => memo('urn', () => { const V = fine(10, 18, 10); cyl(V, 5, 5, 4.2, 0, 15, (x, y) => y < 2 ? 0x3b3f4a : y % 5 === 0 ? 0x9aa0a8 : 0x6d707a, 2); cyl(V, 5, 5, 4.6, 15, 17, 0x3b3f4a, 2); cyl(V, 5, 5, 3.6, 16, 17, 0xd9c9a0);
  for (const [x, z] of [[3, 4], [6, 6], [5, 3], [4, 7]]) V.set(x, 17, z, x & 1 ? 0xffe8c0 : 0xf2f2f2); return done(V, 'urn'); });
// ── vending: the snack machine (glass front, rows of chips and candy) and the drinks machine (a big lit bottle panel)
export const snacks = () => memo('snacks', () => { const V = pv(10, 19, 9), B = 0x1f2230, PK = [0xe8232a, 0xffe23a, 0x2f7bff, 0xff7a1a, 0x25b84c, 0xff4fa3, 0x7a3cff, 0xf7f7f2];
  V.box(0, 0, 0, 10, 19, 8, B); V.box(1, 4, 8, 7, 17, 9, 0x2a3354, 1);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) V.box(1 + k * 2, 5 + r * 3, 8, 2 + k * 2, 7 + r * 3, 9, PK[(r * 3 + k * 5) % PK.length], 1);
  V.box(8, 9, 8, 9, 14, 9, 0x9aa0a8, 2); V.box(8, 12, 8, 9, 13, 9, 0x6cff4a, lit(1)); V.box(1, 1, 8, 7, 3, 9, 0x0c0d12); V.box(0, 17, 8, 10, 19, 9, 0xff4fa3, lit(1));
  return done(V, 'vending'); });
export const drinks = () => memo('drinks', () => { const V = pv(10, 19, 9), B = C.cobalt;
  V.box(0, 0, 0, 10, 19, 8, B); V.box(1, 5, 8, 7, 18, 9, 0xf7f7f2, lit(1));
  for (let y = 7; y < 16; y++) { const w = y > 13 ? 1 : 2; V.box(4 - w, y, 8, 4 + w, y + 1, 9, y > 13 ? 0xe8232a : 0x2de2e6, lit(1)); }
  V.box(8, 8, 8, 9, 14, 9, 0x9aa0a8, 2); V.box(8, 15, 8, 9, 16, 9, 0x6cff4a, lit(1)); V.box(1, 1, 8, 7, 3, 9, 0x0c0d12);
  return done(V, 'vending'); });
// ── a steel bench (slatted seat and back, arms): 1.8 m
export const bench = (c = 0x3b4a5a) => memo('bench' + c, () => { const V = pv(18, 9, 7), S = C.steelD;
  for (const x of [1, 16]) { V.box(x, 0, 1, x + 1, 5, 6, S, 2); V.box(x, 5, 1, x + 1, 7, 2, S, 2); }
  V.box(0, 4, 1, 18, 5, 6, (x, y, z) => (x + z) % 3 ? c : shade(c, .75)); V.box(0, 5, 6, 18, 9, 7, (x, y) => (x + y) % 3 ? c : shade(c, .75));
  V.box(0, 6, 1, 1, 7, 6, S, 2); V.box(17, 6, 1, 18, 7, 6, S, 2); V.box(0, 5, 1, 1, 6, 2, S, 2); V.box(17, 5, 1, 18, 6, 2, S, 2);
  return done(V, 'bench'); });
// ── a concrete planter with a small tree (crowns are 0.4-cube blocks, never round)
export const planterTree = (seed = 0) => memo('ptree' + (seed % 3), () => { const V = pv(16, 46, 16), G2 = [0x2fbf55, 0x25a748, 0x1d8f3c, 0x46d466];
  V.box(0, 0, 0, 16, 5, 16, C.concL); V.box(1, 5, 1, 15, 6, 15, C.concL); V.box(2, 5, 2, 14, 6, 14, C.soil); V.box(7, 5, 7, 9, 26, 9, 0x7a4a22);
  for (let k = 0; k < 7; k++) { const x = 3 + ((H(seed, k) * 7) | 0), z = 3 + ((H(seed, k, 1) * 7) | 0), y = 22 + ((H(seed, k, 2) * 14) | 0); V.box(x, y, z, x + 4, y + 4, z + 4, G2[(H(seed, k, 3) * 4) | 0]); }
  V.box(4, 24, 4, 12, 32, 12, G2[seed % 4]); for (let y = 26; y < 36; y++) V.box(7, y, 7, 9, y + 1, 9, G2[(seed + 1) % 4]);
  return done(V, 'planter'); });
// ── ST. MERCY herself: a stone saint on a plinth, arms open, somebody's traffic cone on her head
export const saint = () => memo('saint', () => { const V = pv(14, 42, 15, CV, 7, 7), ST = 0xe6e1d6, ST2 = 0xcfc8ba;
  V.box(1, 0, 1, 13, 10, 13, ST2); V.box(0, 10, 0, 14, 11, 14, ST); V.box(0, 0, 0, 14, 1, 14, ST);
  V.box(3, 3, 13, 11, 8, 14, C.gold, 2); { const M = px('ST'); vtext(V, M, 7 - (M.w >> 1), 7, 14, C.ink); }   // the bronze plaque
  for (let y = 0; y < 16; y++) { const w = Math.round(4 - y * .12), d = Math.round(3 - y * .08); V.box(7 - w, 11 + y, 7 - d, 7 + w, 12 + y, 7 + d, y % 5 === 4 ? ST2 : ST); }   // the robe
  V.box(3, 22, 6, 11, 24, 8, ST); V.box(2, 20, 7, 4, 23, 11, ST); V.box(10, 20, 7, 12, 23, 11, ST); V.box(2, 20, 10, 4, 21, 12, 0xd9cbb4); V.box(10, 20, 10, 12, 21, 12, 0xd9cbb4);   // shoulders, open arms, hands
  V.box(5, 27, 5, 9, 31, 9, 0xd9cbb4); V.box(4, 27, 4, 10, 32, 6, ST); V.box(4, 30, 4, 10, 32, 9, ST);                // the head under its veil
  V.box(3, 32, 3, 11, 33, 11, 0xff6a1a); for (let k = 0; k < 7; k++) { const r = Math.max(0, 3 - k * .45); V.box(Math.round(6.5 - r), 33 + k, Math.round(6.5 - r), Math.round(7.5 + r), 34 + k, Math.round(7.5 + r), (k === 2 || k === 3) ? C.chalk : 0xff6a1a); }   // the cone
  return done(V, 'statue'); });
// ── the liquid-oxygen tank: a white vertical cylinder on a skirt, OXYGEN down its +x side, the finned vaporizer beside it
export const o2Tank = () => memo('o2', () => { const V = pv(44, 76, 28, CV, 14, 14), G2 = 0x14a83b;
  cyl(V, 14, 14, 11, 0, 6, 0x9aa0a8); cyl(V, 14, 14, 12, 6, 70, (x, y) => y % 16 === 0 ? 0xe2e4e8 : C.chalk); for (let k = 0; k < 5; k++) cyl(V, 14, 14, 12 - k * 2.4, 70 + k, 71 + k, 0xe2e4e8);
  V.recNext(); const W2 = 'OXYGEN'; for (let n = 0; n < W2.length; n++) { const M = px(W2[n]); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const z = 14 + (M.w >> 1) - i, y = 62 - n * 9 - j;
    for (let x = 27; x > 14; x--) if (V.has(x - 1, y, z)) { V.set(x, y, z, G2); V.recN('OXYGEN', x, y, z, 1, 0); break; } } }   // painted one voxel proud of the curve
  for (let y = 0; y < 50; y++) for (const z of [9, 13, 17]) V.box(32, y, z, 42, y + 1, z + 1, (x) => (x + y) % 3 ? 0xc9ced6 : 0xdfe6ee, 2);
  V.box(32, 0, 8, 42, 2, 19, 0x9aa0a8); V.box(26, 40, 13, 33, 42, 15, 0xc9ced6, 2);   // the vaporizer's base, its pipe to the tank
  return done(V, 'tank'); });
// ── the emergency generator in its green enclosure (louvres, a muffler stack)
export const generator = () => memo('gen', () => { const V = pv(32, 30, 19), G2 = 0x2f7a3a;
  V.box(0, 0, 0, 32, 2, 18, 0x9aa0a8); V.box(1, 2, 1, 31, 20, 17, G2); V.box(1, 20, 1, 31, 21, 17, shade(G2, .8));
  for (let x = 3; x < 29; x += 2) V.box(x, 4, 17, x + 1, 11, 18, shade(G2, .7)); V.box(24, 21, 6, 27, 29, 9, C.steelD, 2); V.box(23, 28, 5, 28, 29, 10, C.steelD, 2);
  { const M = px('GEN 2'); vtext(V, M, 16 - (M.w >> 1), 19, 17, C.chalk); } V.box(2, 12, 0, 8, 17, 1, 0xffd21f); return done(V, 'generator'); });
// ── the hearse at the morgue door: a long black car, the rear compartment curtained, chrome landau bars
export const hearse = () => memo('hearse', () => { const L = 54, W = 18, V = pv(W + 2, 26, L + 2), cx = 1, B = 0x16161a, CU = 0x6e5a8a;
  V.box(cx, 3, 1, cx + W, 10, L + 1, B); V.box(cx, 10, 6, cx + W, 21, 38, B); V.box(cx + 1, 21, 7, cx + W - 1, 22, 37, 0x222228);
  V.box(cx + 1, 11, 37, cx + W - 1, 19, 38, 0x9fd8ff, 1); for (const x of [cx, cx + W - 1]) { V.box(x, 12, 26, x + 1, 19, 35, 0x9fd8ff, 1); V.box(x, 12, 9, x + 1, 19, 22, CU); for (let t = 0; t < 7; t++) V.set(x, 13 + t, 23 + ((t * 2) % 3), C.chrome, 2); }
  V.box(cx + 1, 12, 5, cx + W - 1, 19, 6, CU); V.box(cx, 9, 1, cx + W, 10, L + 1, C.chrome, 2);
  V.box(cx, 5, L, cx + 4, 8, L + 1, 0xffffff, lit(1)); V.box(cx + W - 4, 5, L, cx + W, 8, L + 1, 0xffffff, lit(1)); V.box(cx + 6, 4, L, cx + W - 6, 9, L + 1, C.chrome, 2);
  V.box(cx, 6, 0, cx + 3, 9, 1, 0xd7141a, lit(1)); V.box(cx + W - 3, 6, 0, cx + W, 9, 1, 0xd7141a, lit(1));
  for (const z of [9, L - 9]) for (const x of [cx - 1, cx + W - 2]) { V.box(x, 0, z - 3, x + 3, 8, z + 5, C.rubber); V.box(x + (x < cx ? 0 : 2), 2, z - 1, x + 1 + (x < cx ? 0 : 2), 6, z + 3, C.chrome, 2); }
  for (const z of [9, L - 9]) V.clear(cx + 2, 0, z - 3, cx + W - 2, 3, z + 5);
  return done(V, 'hearse'); });
// ── a red biohazard bin on casters, a blue linen cart
export const bioBin = () => memo('bio', () => { const V = pv(7, 12, 9), R = 0xd7141a; V.box(0, 1, 0, 7, 10, 8, R); V.box(0, 10, 0, 7, 11, 8, shade(R, .8));
  for (const [x, z] of [[0, 1], [6, 1], [0, 6], [6, 6]]) V.box(x, 0, z, x + 1, 1, z + 1, C.rubber);
  for (const [x, y] of [[3, 7], [3, 6], [2, 5], [4, 5], [1, 4], [5, 4], [3, 4]]) V.set(x, y, 8, C.chalk); return done(V, 'bin'); });
export const linenCart = () => memo('linen', () => { const V = pv(12, 11, 8), S = C.steelL; for (const [x, z] of [[0, 0], [11, 0], [0, 7], [11, 7]]) V.box(x, 0, z, x + 1, 2, z + 1, C.rubber);
  V.box(0, 2, 0, 12, 3, 8, S, 2); V.box(0, 3, 0, 12, 9, 8, 0x2f5bff); V.box(1, 4, 1, 11, 9, 7, -1); V.box(1, 4, 1, 11, 10, 7, (x, y, z) => y === 9 && (x + z) % 3 === 0 ? undefined : C.chalk); return done(V, 'cart'); });
// ── the garage's pay booth (glass on three sides, PAY on the roof band; the attendant stands in it) and the gate arm
export const payBooth = () => memo('booth', () => { const V = pv(16, 28, 17, CV, 8, 8), F = C.chalk, Y = C.yellow;
  V.box(0, 0, 0, 16, 2, 16, C.concL); V.box(1, 2, 1, 15, 9, 15, F); V.box(2, 2, 2, 14, 9, 14, -1);   // the floor, a waist-high wall round it
  for (const [x, z] of [[1, 1], [14, 1], [1, 14], [14, 14]]) V.box(x, 9, z, x + 1, 24, z + 1, F);
  V.box(1, 9, 2, 2, 24, 14, 0x9fd8ff, 1); V.box(14, 9, 2, 15, 24, 14, 0x9fd8ff, 1); V.box(2, 9, 14, 14, 24, 15, 0x9fd8ff, 1); V.box(2, 9, 1, 14, 24, 2, F);
  V.box(0, 24, 0, 16, 26, 16, Y); V.box(0, 26, 0, 16, 28, 16, shade(Y, .85)); { const M = px('PAY'); vtext(V, M, 8 - (M.w >> 1), 26, 16, C.ink); }
  return done(V, 'booth'); });
export const gateArm = (len = 34) => memo('gate' + len, () => { const V = pv(len + 6, 13, 6, CV, 3, 3); V.box(0, 0, 0, 6, 11, 6, C.yellow); V.box(1, 11, 1, 5, 12, 5, C.ink); V.box(0, 6, 1, 1, 9, 5, C.ink);
  for (let x = 6; x < len + 6; x++) V.box(x, 8, 2, x + 1, 10, 4, ((x >> 2) & 1) ? C.sRed : C.chalk); return done(V, 'gate-arm'); });
// ── a sign plate (0.05 grain) on one post (posts: 1), two, or none (a wall plate): lines of pixel or hand-painted type on a board
export const plate = (lines, bg, fg, o = {}) => memo(`plate|${lines.join('/')}|${bg}|${fg}|${o.posts ?? 1}|${o.h ?? 0}|${o.face ?? ''}|${o.frame ?? ''}`, () => {
  const Ms = lines.map(s => o.face === 'hand' ? hand(s, s.length) : o.face === 'mini' ? mini(s) : px(s)), w = Math.max(...Ms.map(m => m.w)) + 4, lh = o.face === 'hand' ? 10 : o.face === 'mini' ? 7 : 9, hB = Ms.length * lh + 2, post = o.posts === 0 ? 0 : Math.round((o.h ?? 1.4) / S2);
  const V = fine(w + 2, post + hB + 1, 4); V.box(1, post, 1, w + 1, post + hB, 3, bg); if (o.frame) { V.box(1, post, 1, w + 1, post + 1, 3, o.frame); V.box(1, post + hB - 1, 1, w + 1, post + hB, 3, o.frame); }
  if (o.posts === 2) for (const x of [3, w - 2]) V.box(x, 0, 0, x + 2, post + 2, 1, C.steelD, 2); else if (o.posts !== 0) V.box((w >> 1), 0, 0, (w >> 1) + 2, post + hB - 2, 1, C.steelD, 2);
  Ms.forEach((M, n) => vtext(V, M, 1 + ((w - M.w) >> 1), post + hB - 2 - n * lh, 3, fg, { l: o.lit ? lit(0) : 0 }));
  return done(V, 'sign'); });
// ── the flower cart at the hospital door: a green cart under a striped umbrella, buckets of flowers, three GET WELL balloons on strings
export const flowerCart = () => memo('flowers', () => { const V = pv(22, 36, 12), G2 = 0x1f7a3a, FL = [0xff4fa3, 0xffe23a, 0xe8232a, 0xf7f7f2, 0xff7a1a, 0x7a3cff];
  for (const [x, z] of [[2, 2], [19, 2], [2, 9], [19, 9]]) V.box(x, 0, z, x + 1, 3, z + 1, C.rubber);
  V.box(1, 3, 1, 21, 9, 11, G2); V.box(1, 9, 1, 21, 10, 11, shade(G2, .8));
  for (let k = 0; k < 6; k++) { const x = 2 + (k % 3) * 6, z = k < 3 ? 2 : 6; V.box(x, 10, z, x + 5, 13, z + 4, 0x9aa0a8, 2); for (let q = 0; q < 6; q++) { const fx = x + ((H(k, q) * 5) | 0), fz = z + ((H(k, q, 1) * 4) | 0); V.box(fx, 13, fz, fx + 1, 14 + ((H(k, q, 2) * 3) | 0), fz + 1, 0x2f9a3a); V.set(fx, 14 + ((H(k, q, 2) * 3) | 0), fz, FL[(k + q) % FL.length]); } }
  V.box(10, 10, 5, 12, 30, 7, C.steelL, 2); for (let k = 0; k < 4; k++) { const r = 9 - k * 2.2; for (let x = -10; x <= 10; x++) for (let z = -6; z <= 6; z++) if (Math.abs(x) <= r && Math.abs(z) <= Math.min(6, r)) V.set(11 + x, 30 + k, 6 + z, ((x + 20) >> 2) & 1 ? 0xff4fa3 : C.chalk); }
  for (const [x, z, c, h2] of [[3, 3, 0xe8232a, 24], [6, 9, 0xffe23a, 26], [18, 4, 0x2de2e6, 25]]) { for (let y = 13; y < h2; y++) V.set(x, y, z, 0xdfe6ee); V.box(x - 1, h2, z - 1, x + 2, h2 + 3, z + 2, c, 1); }
  return done(V, 'cart'); });
// ── a car that is solid inside: the core car's shape and bounds (props.js car: 1.8 × 4.2 m, the tall toon cabin), but every window is
// glass on a closed cabin. The core car's side windows are open onto a hollow cabin with flat body-colour walls (systems-agent note in
// PASS-hospital-highway.md); this one is used for the cars these kits place and to swap the traffic car in front of the ER camera.
export const sedan = (c, o = {}) => memo(`sedan${c}|${o.rim ?? ''}`, () => {
  const L = 42, Wd = 18, cab0 = 11, cab1 = 31, V = pv(Wd + 2, 32, L + 2), cx = 1, B = c, GL = 0x9fd8ff, wz = [7, L - 9], mid = (cab0 + cab1) >> 1;
  V.box(cx, 3, 1, cx + Wd, 10, L + 1, B); V.box(cx, 10, cab0, cx + Wd, 20, cab1, B); V.box(cx + 1, 20, cab0 + 1, cx + Wd - 1, 21, cab1 - 1, B);   // body, the closed cabin, its roof
  V.box(cx - 1, 3, 0, cx + Wd + 1, 5, 2, 0xc9ced6, 2); V.box(cx - 1, 3, L, cx + Wd + 1, 5, L + 2, 0xc9ced6, 2);                          // bumpers
  V.box(cx + 1, 11, cab1 - 1, cx + Wd - 1, 19, cab1, GL, 1); V.box(cx + 1, 11, cab0, cx + Wd - 1, 19, cab0 + 1, GL, 1);                  // windscreen, rear glass
  for (const x of [cx, cx + Wd - 1]) { V.box(x, 11, cab0 + 2, x + 1, 19, cab1 - 2, GL, 1); V.box(x, 11, mid, x + 1, 19, mid + 1, B); }   // side glass, the B pillar
  V.box(cx, 5, L, cx + 4, 8, L + 1, 0xffffff, lit(1)); V.box(cx + Wd - 4, 5, L, cx + Wd, 8, L + 1, 0xffffff, lit(1)); V.box(cx + 5, 5, L, cx + Wd - 5, 8, L + 1, 0x33333b);   // headlamps, grille
  V.box(cx, 6, 0, cx + 3, 9, 1, 0xd7141a, lit(1)); V.box(cx + Wd - 3, 6, 0, cx + Wd, 9, 1, 0xd7141a, lit(1));                              // tail lamps
  for (const z of wz) for (const x of [cx - 1, cx + Wd - 2]) { V.box(x, 0, z - 3, x + 3, 8, z + 5, 0x1b1b20); V.box(x + (x < cx ? 0 : 2), 2, z - 1, x + 1 + (x < cx ? 0 : 2), 6, z + 3, o.rim ?? 0xc9ced6, 2); }
  for (const z of wz) { V.clear(cx + 2, 0, z - 3, cx + Wd - 2, 3, z + 5); for (const x of [cx - 1, cx + Wd - 2]) for (const [y, dz] of [[0, -3], [0, 4], [7, -3], [7, 4]]) V.del(x + (x < cx ? 0 : 2), y, z + dz); }
  return done(V, 'car'); });
