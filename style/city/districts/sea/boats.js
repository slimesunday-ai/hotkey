// THE BAY (sea) · boats, buoys and lights (owner: the water-side agent, batch 5). Worker-safe. Props are authored with the bow toward +z,
// the keel at y 0 (placed at −draft, so the hull sits in the flat bay), memoized per variant and time of day. Names are painted on
// (plain hull colour, like a real hull), so the text audit has nothing to hold them to.
//   ferry()    SECOND CHANCE: a double-ended ferry in county-proof orange, two cabin decks, a wheelhouse at each end, the stack, lifeboats
//   launch()   HARBOR UNIT 9: the police launch, white with navy and a blue slash, POLICE on the hull, the light bar (lit at night)
//   tug()      MISS DEMEANOR: a pusher tug, navy and yellow, its pilothouse up on a tower to see over the scow; scow(): rust, a heap of sand
//   lobster()  LITTLE ANGIE: a lobster boat, white with a green sheer, the wheelhouse forward, traps and floats aft
//   buoys      nun (red, even numbers), can (green, odd), the restricted-area buoy (white, an orange diamond), a lit channel buoy
import { C, TOD, lit, shade, pv, prop, memo, px, mix } from '../jail/lib.js';

const S2 = .2, S1 = .1;
// a hull: half-width along the length (t 0 stern … 1 bow), a bottom band, the topsides, a rub rail at the sheer; P(a, y, b, c, l)
function hull(P, L, W, Hh, o) { const mid = (W - 1) / 2;
  for (let a = 0; a < L; a++) { const t = a / (L - 1), sh = o.shape(t), half = mid * sh, rise = o.rise ? Math.round(o.rise(t)) : 0;
    for (let b = 0; b < W; b++) { const db = Math.abs(b - mid); if (db > half + .01) continue; const top = Hh + rise, edge = db > half - 1.1 || a === 0 || a === L - 1;
      for (let y = 0; y < top; y++) { if (!edge && y > 1 && y < top - 1) continue;
        const c = y < o.water ? o.bottom : y >= top - 1 ? (edge ? o.rail : o.deck) : (o.stripe && y >= o.stripe[0] && y < o.stripe[1] && edge) ? o.stripeC : o.side;
        P(a, y, b, c); } } } }
const volOf = (L, W, Hgt, s) => { const V = pv(W, Hgt, L, s, W / 2, L / 2); const P = (a, y, b, c, l = 0) => V.set(b, y, a, c, l); const box = (a0, y0, b0, a1, y1, b1, c, l = 0) => V.box(b0, y0, a0, b1, y1, a1, c, l); return { V, P, box }; };
// paint a name on both sides (the outermost hull cell of each column), reading left to right from either side
function paintName(V, M, a0, ytop, col, sc = 1) {
  for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue; for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const y = ytop - j * sc - v;
    for (const side of [0, 1]) { const a = side ? a0 + i * sc + u : a0 + M.w * sc - 1 - (i * sc + u); let b = side ? 0 : V.nx - 1; while (b >= 0 && b < V.nx && !V.has(b, y, a)) b += side ? 1 : -1; if (b >= 0 && b < V.nx) V.set(b, y, a, col); } } } }

// ── SECOND CHANCE (0.2 m): a passenger catamaran 24 × 8 m, teal and white: twin hulls, the main cabin's band of glass, the wheelhouse
// forward on the upper deck, benches and a rail on the open deck aft, the name on both hulls (the Route 9 car ferry is another boat)
export const ferry = () => memo('ferry-cat', () => { const L = 120, W = 40, N = TOD.night, { V, P, box } = volOf(L, W, 48, S2), TEAL = 0x12b3a0, h = 2;
  const glass = (a, y) => N ? ((a * 7 + y) % 9 > 2 ? C.litHi : C.litLo) : (y > 18 + h ? C.glassHi : C.glass);
  for (const [b0, b1] of [[0, 9], [W - 9, W]]) for (let a = 0; a < L; a++) { const t = a / (L - 1), cut = t > .82 ? Math.round((t - .82) / .18 * 6) : 0;   // the twin hulls, pointed forward
    for (let b = b0; b < b1; b++) { const inner = b0 === 0 ? b1 - 1 - b : b - b0; if (inner < cut) continue; const edge = b === b0 || b === b1 - 1 || a === 0 || a === L - 1;
      for (let y = 0; y < 9 + h; y++) { if (!edge && y > 1 && y < 8 + h) continue; P(a, y, b, y < 4 ? 0x1f3a44 : y === 8 + h ? C.chalk : TEAL); } } }
  box(4, 6 + h, 1, 104, 9 + h, W - 1, (b, y, a) => y === 8 + h ? 0xb9b3a6 : TEAL);                                        // the cross deck (the water shows under it, between the hulls)
  for (let a = 104; a < 112; a++) { const w = Math.round((a - 104) * 1.6); box(a, 6 + h, 1 + w, a + 1, 9 + h, W - 1 - w, TEAL); }   // the bow's point
  const c0 = 9 + h; box(12, c0, 2, 96, c0 + 12, W - 2, C.chalk); box(12, c0 + 1, 2, 96, c0 + 2, W - 2, TEAL);             // the main cabin, a teal stripe
  for (let a = 13; a < 95; a++) for (const b of [2, W - 3]) for (let y = c0 + 4; y < c0 + 10; y++) V.set(b, y, a, (a - 13) % 7 === 6 ? C.chalk : glass(a, y), N ? 3 : 1);   // its band of glass
  for (let b = 3; b < W - 3; b++) for (let y = c0 + 4; y < c0 + 10; y++) { V.set(b, y, 95, (b % 6 === 0) ? C.chalk : glass(b, y), N ? 3 : 1); V.set(b, y, 12, (b % 6 === 0) ? C.chalk : glass(b, y), N ? 3 : 1); }
  box(96, c0, 4, 100, c0 + 10, W - 4, C.chalk); box(12, c0 + 12, 2, 96, c0 + 13, W - 2, 0xc9c3b6);                        // the cabin's nose, its roof
  const u0 = c0 + 13; box(70, u0, 8, 92, u0 + 9, W - 8, C.chalk); box(69, u0 + 9, 7, 93, u0 + 10, W - 7, TEAL);           // the wheelhouse forward
  for (let b = 9; b < W - 9; b++) for (let y = u0 + 3; y < u0 + 8; y++) V.set(b, y, 91, (b === W / 2) ? C.chalk : N ? C.litLo : 0x1d2a3a, N ? 3 : 1);
  for (let a = 71; a < 91; a++) for (const b of [8, W - 9]) for (let y = u0 + 3; y < u0 + 8; y++) V.set(b, y, a, a % 5 === 0 ? C.chalk : N ? C.litLo : 0x1d2a3a, N ? 3 : 1);
  box(79, u0 + 10, W / 2 - 1, 81, u0 + 18, W / 2 + 1, C.steelL); box(78, u0 + 18, W / 2 - 2, 82, u0 + 19, W / 2 + 2, C.steelL); V.set(W / 2, u0 + 19, 80, 0xffffff, lit(1));   // the mast, its light
  for (let a = 14; a < 68; a++) if (a % 4 === 0) for (const b of [3, W - 4]) V.box(b, u0, a, b + 1, u0 + 4, a + 1, C.chalk);                          // the rail round the open deck
  for (let a = 14; a < 68; a++) for (const b of [3, W - 4]) V.set(b, u0 + 3, a, C.chalk); for (let b = 3; b < W - 3; b++) V.set(b, u0 + 3, 14, C.chalk);
  for (const a of [22, 34, 46, 58]) box(a, u0, 10, a + 6, u0 + 2, W - 10, TEAL);                                          // benches on the open deck
  paintName(V, px('SECOND CHANCE'), 30, 10, C.chalk);
  return prop(V, 'ferry'); });
// ── HARBOR UNIT 9 (0.1 m): 11 × 3.6 m
export const launch = () => memo('launch', () => { const L = 110, W = 36, N = TOD.night, { V, P, box } = volOf(L, W, 40, S1);
  hull(P, L, W, 18, { shape: t => t < .75 ? 1 - Math.pow(1 - t / .75, 6) * .3 : Math.max(.12, 1 - Math.pow((t - .75) / .25, 1.6) * .88), rise: t => t > .7 ? (t - .7) * 12 : 0, water: 6, bottom: C.navy, side: C.chalk, rail: C.steelL, deck: 0xdcd6c8, stripe: [9, 11], stripeC: C.navy });
  for (let a = 64; a < 86; a++) { const k = a - 64; for (let y = 6; y < 17; y++) for (const b of [0, 1, W - 2, W - 1]) if (V.has(b, y, a) && Math.abs(y - 6 - k * .5) < 1.2) V.set(b, y, a, C.cobalt); }   // the blue slash
  box(30, 18, 5, 70, 30, W - 5, C.chalk); box(30, 30, 4, 72, 32, W - 4, C.navy);                                  // the cabin
  for (let a = 34; a < 68; a++) if ((a - 34) % 8 < 6) for (const b of [5, W - 6]) for (let y = 23; y < 28; y++) V.set(b, y, a, N ? C.litLo : C.navy, N ? 3 : 1);
  for (let b = 6; b < W - 6; b++) for (let y = 22; y < 29; y++) V.set(b, y, 69, (b === W / 2) ? C.ink : N ? C.litLo : C.glassHi, N ? 3 : 1);   // the windscreen
  box(44, 32, 12, 58, 34, W - 12, C.ink); box(46, 32, 13, 51, 34, W / 2, 0xff2a2a, N ? 3 : 1); box(51, 32, W / 2, 56, 34, W - 13, 0x2f7bff, N ? 3 : 1);   // the light bar
  box(36, 32, W / 2 - 1, 38, 42 - 2, W / 2 + 1, C.steelL); box(34, 38, W / 2 - 3, 40, 39, W / 2 + 3, C.steelL);                    // the radar mast
  box(4, 18, 8, 12, 22, W - 8, 0x3e4450);                                                                          // the engine box aft
  paintName(V, px('POLICE'), 34, 16, C.navy);
  return prop(V, 'launch'); });
// ── MISS DEMEANOR (0.1 m): a pusher tug 12 × 5 m, the pilothouse up on its tower
export const tug = () => memo('tug2', () => { const L = 120, W = 50, N = TOD.night, { V, P, box } = volOf(L, W, 96, S1);
  hull(P, L, W, 20, { shape: t => t > .88 ? .86 : t < .1 ? .8 + t * 2 : 1, water: 7, bottom: 0x8a2a22, side: C.navy, rail: C.hazard, deck: 0x6d707a, stripe: [14, 16], stripeC: C.hazard });
  box(L - 4, 6, 6, L, 26, 16, C.rubber); box(L - 4, 6, W - 16, L, 26, W - 6, C.rubber);                            // the push knees at the bow
  box(18, 20, 8, 84, 38, W - 8, C.chalk); box(18, 38, 8, 84, 40, W - 8, C.ink);                                  // the deckhouse
  for (let a = 22; a < 80; a += 7) for (const b of [8, W - 9]) for (let y = 27; y < 33; y++) for (let q = 0; q < 4; q++) V.set(b, y, a + q, N ? C.litLo : C.navy, N ? 3 : 0);
  box(44, 40, 16, 64, 62, W - 16, C.chalk);                                                                       // the tower
  box(38, 62, 10, 72, 78, W - 10, C.chalk); box(36, 78, 8, 74, 81, W - 8, C.ink);                                  // the pilothouse
  for (let y = 67; y < 76; y++) { for (let b = 11; b < W - 11; b++) { V.set(b, y, 71, (b % 6 === 0) ? C.chalk : N ? C.litLo : C.glassHi, N ? 3 : 1); V.set(b, y, 38, (b % 6 === 0) ? C.chalk : N ? C.litLo : C.glassHi, N ? 3 : 1); }
    for (let a = 39; a < 71; a++) if (a % 6) { V.set(10, y, a, N ? C.litLo : C.glassHi, N ? 3 : 1); V.set(W - 11, y, a, N ? C.litLo : C.glassHi, N ? 3 : 1); } }
  for (const b of [12, W - 16]) { box(26, 40, b, 32, 70, b + 4, C.navy); box(26, 66, b, 32, 70, b + 4, C.hazard); box(26, 70, b, 32, 72, b + 4, C.ink); }   // twin stacks
  box(54, 81, W / 2 - 1, 56, 92, W / 2 + 1, C.steelL); V.set(W / 2, 92, 55, 0xffffff, lit(1));                    // the mast and its light
  paintName(V, px('MISS DEMEANOR'), 18, 13, C.hazard);
  return prop(V, 'tug'); });
// the scow (0.2 m): 22 × 8 m, rust sides, black coaming, a heap of sand
export const scow = () => memo('scow', () => { const L = 110, W = 40, { V, P, box } = volOf(L, W, 22, S2);
  hull(P, L, W, 9, { shape: t => (t > .93 || t < .07) ? .9 : 1, water: 4, bottom: 0x3a2a24, side: 0x9b4f3a, rail: C.ink, deck: 0x7a4a36 });
  for (let a = 4; a < L - 4; a++) for (let b = 3; b < W - 3; b++) { const t = Math.min(a - 4, L - 5 - a) / 20, u = Math.min(b - 3, W - 4 - b) / 12, h = Math.round(Math.min(t, u, 1) * 10 * (.8 + .2 * Math.sin(a * .7) * Math.cos(b * .9)));
    for (let y = 8; y < 8 + h; y++) V.set(b, y, a, y === 7 + h ? 0xe2cf9e : 0xc9b27e); }
  paintName(V, px('SCOW 9'), 40, 7, C.chalk);
  return prop(V, 'scow'); });
// ── LITTLE ANGIE (0.1 m): a lobster boat 9 × 3.2 m; the wheelhouse forward, traps and floats aft
export const lobster = () => memo('lobster', () => { const L = 90, W = 32, N = TOD.night, { V, P, box } = volOf(L, W, 44, S1);
  hull(P, L, W, 15, { shape: t => t < .7 ? 1 - Math.pow(1 - t / .7, 8) * .15 : Math.max(.1, 1 - Math.pow((t - .7) / .3, 1.7) * .9), rise: t => t > .6 ? (t - .6) * 10 : 0, water: 5, bottom: 0x8a2a22, side: C.chalk, rail: C.green, deck: C.woodL ?? 0xc9955a, stripe: [11, 13], stripeC: C.green });
  box(52, 15, 5, 70, 30, W - 5, C.chalk); box(51, 30, 4, 71, 32, W - 4, C.green);                                   // the wheelhouse
  for (let b = 6; b < W - 6; b++) for (let y = 22; y < 28; y++) V.set(b, y, 69, (b === W / 2) ? C.chalk : N ? C.litLo : C.glassHi, N ? 3 : 1);
  for (let a = 55; a < 67; a += 5) for (const b of [5, W - 6]) for (let y = 22; y < 27; y++) for (let q = 0; q < 3; q++) V.set(b, y, a + q, N ? C.litLo : C.glass, N ? 3 : 1);
  box(46, 15, W - 7, 49, 34, W - 5, C.steelD); box(46, 32, W - 12, 49, 34, W - 5, C.steelD); box(45, 26, W - 13, 50, 32, W - 10, C.steelL);   // the hauler davit
  for (const [a, b, h] of [[10, 5, 0], [10, 14, 0], [22, 5, 0], [10, 5, 1], [22, 14, 0], [10, 14, 1]]) { const y = 15 + h * 6; box(a, y, b, a + 10, y + 6, b + 8, h ? C.hazard : 0x2e7d4a); for (let q = a; q < a + 10; q += 3) box(q, y, b, q + 1, y + 6, b + 8, C.ink); }   // traps
  for (const [a, c] of [[34, C.orange], [38, 0xf7f7f2], [42, C.orange]]) box(a, 15, W - 5, a + 3, 19, W - 3, c);          // floats on the rail
  paintName(V, px('LITTLE ANGIE'), 8, 11, C.green);
  return prop(V, 'lobster'); });

// ── a skiff (0.1 m): 4.2 × 1.6 m aluminium, a green sheer, two thwarts, the outboard on the transom; its floor boards sit above the
// waterline (an open boat: the flat bay must not show through it)
export const skiff = () => memo('skiff', () => { const L = 42, W = 16, { V, P, box } = volOf(L, W, 14, S1);
  hull(P, L, W, 7, { shape: t => t > .75 ? Math.max(.2, 1 - Math.pow((t - .75) / .25, 1.5) * .8) : 1, rise: t => t > .8 ? (t - .8) * 8 : 0, water: 3, bottom: 0x5b6470, side: C.steelL, rail: C.green, deck: 0x9aa3ad });
  for (let a = 2; a < L - 6; a++) for (let b = 2; b < W - 2; b++) if (V.has(b, 0, a)) V.box(b, 1, a, b + 1, 4, a + 1, (bb, y) => y === 3 ? (((a >> 1) & 1) ? 0xb88a55 : 0xa4652f) : 0x5b6470);   // the floor boards
  for (const a of [12, 26]) box(a, 5, 1, a + 3, 6, W - 1, 0x6e3e19);                                                     // the thwarts
  box(0, 4, W / 2 - 2, 3, 11, W / 2 + 2, C.ink); box(0, 11, W / 2 - 2, 5, 13, W / 2 + 2, C.ink);                            // the outboard
  return prop(V, 'skiff'); });
// ── buoys (0.1 m, the float's waterline at 0.3): nun (red, a cone top), can (green, flat), restricted (white, orange bands and diamond),
// the lit channel buoy (a cage and a lamp); numbers on the float
const cyl = (V, cx, cz, r, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };
export const buoy = (kind, n = '') => memo('buoy' + kind + n, () => { const V = pv(10, 26, 10, S1), N = TOD.night;
  if (kind === 'nun') { cyl(V, 5, 5, 3.6, 0, 9, C.red); for (let y = 9; y < 17; y++) cyl(V, 5, 5, 3.6 - (y - 9) * .45, y, y + 1, C.red); }
  else if (kind === 'can') { cyl(V, 5, 5, 3.4, 0, 14, C.greenD); cyl(V, 5, 5, 3.4, 14, 15, shade(C.greenD, .8)); }
  else if (kind === 'keep') { cyl(V, 5, 5, 3.4, 0, 16, (x, y) => (y > 3 && y < 6) || (y > 12 && y < 15) ? C.orange : C.chalk); for (let y = 6; y < 12; y++) { const w = 3 - Math.abs(y - 8.5); for (const z of [0, 9]) for (let x = 5 - w; x < 5 + w; x++) V.set(x, y, z === 0 ? 1 : 8, C.orange); } }
  else { cyl(V, 5, 5, 3.6, 0, 6, C.red); for (let y = 6; y < 20; y++) for (const [x, z] of [[2, 2], [7, 2], [2, 7], [7, 7]]) V.set(x, y, z, C.red); cyl(V, 5, 5, 3, 12, 13, C.red); cyl(V, 5, 5, 3.2, 19, 20, C.red); cyl(V, 5, 5, 1.2, 20, 23, N ? 0xff4a4a : 0xff9a9a, N ? 3 : 1); V.set(4, 23, 4, C.ink); }
  if (n) { const M = px(n); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (const side of [0, 1]) { const x = side ? 5 - (M.w >> 1) + i : 5 + (M.w >> 1) - i, y = 11 - j; for (let z = 0; z < 10; z++) { const zz = side ? 9 - z : z; if (V.has(x, y, zz)) { V.set(x, y, zz, C.chalk); break; } } } }
  return prop(V, 'buoy'); });
// a navigation light on a breakwater's head: a steel post with a ladder, the lantern (green or red, lit at night), the day mark
export const navLight = col => memo('nav' + col, () => { const V = pv(8, 44, 8, S1), N = TOD.night; V.box(2, 0, 2, 6, 3, 6, C.concL); V.box(3, 3, 3, 5, 36, 5, C.steelD);
  for (let y = 5; y < 34; y += 3) V.box(5, y, 3, 6, y + 1, 5, C.steel); V.box(1, 26, 3, 7, 32, 5, col); V.box(2, 36, 2, 6, 40, 6, N ? col : mix(col, 0xffffff, .5), N ? 3 : 1); V.box(2, 40, 2, 6, 41, 6, C.ink); return prop(V, 'nav-light'); });
