// GATEHILL · props only this district uses (0.1 cubes, base centre, facing +z, memoized per variant and time of day): the car line
// (black SUV, black town car, stretch limo, a vintage roadster, a supercar), topiary planters, brass lanterns, the valet stand and
// its cones, a luggage cart, a gate pier. Toon scale: cabins tall enough for a big head, like props.js cars.
import { C, TOD, memo, pv, done, cyl, lit } from './lib.js';

// a car: L long (z), W wide (x); body from y 3 to `belt`, a cabin from z c0 to c1 up to `roof`; wheels at wz; o.open = no roof
function car(o) {
  const L = o.L, W = o.W, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = 1 + W, B = o.body, belt = o.belt ?? 10, roof = o.roof ?? 20, [c0, c1] = o.cab, G = o.glass ?? 0x1c2230, CH = 0xc9ced6;
  V.box(x0, 3, 1, x1, belt, L + 1, B);                                                      // the body
  if (o.nose) for (let z = L - o.nose; z <= L; z++) { const t = (z - (L - o.nose)) / o.nose; V.box(x0, belt - Math.round(t * (belt - 6)), z + 1, x1, belt, z + 2, -1); }   // a sloping nose (supercar)
  if (!o.open) { V.box(x0, belt, c0, x1, roof, c1, B); V.box(x0 + 1, belt + 1, c0 - 1, x1 - 1, roof - 1, c0, G, 1); V.box(x0 + 1, belt + 1, c1, x1 - 1, roof - 1, c1 + 1, G, 1);   // the cabin, windscreens
    V.box(x0, belt + 1, c0 + 1, x0 + 1, roof - 1, c1 - 1, G, 1); V.box(x1 - 1, belt + 1, c0 + 1, x1, roof - 1, c1 - 1, G, 1);                                             // tinted side glass
    for (const z of o.pillars || []) { V.box(x0, belt + 1, z, x0 + 1, roof - 1, z + 1, B); V.box(x1 - 1, belt + 1, z, x1, roof - 1, z + 1, B); } }
  else { V.box(x0 + 1, belt, c0, x1 - 1, belt + 1, c1, 0x3a2418); V.box(x0 + 2, belt, c0 + 2, x1 - 2, belt + 4, c0 + 4, 0x6e3e19); V.box(x0 + 2, belt, c1 - 5, x1 - 2, belt + 4, c1 - 3, 0x6e3e19);   // open: leather seats
    V.box(x0 + 1, belt, c1, x1 - 1, belt + 5, c1 + 1, 0xbfe6ff, 1); V.box(x0 + 1, belt + 5, c1, x1 - 1, belt + 6, c1 + 1, CH, 2); }                                          // a low windscreen
  V.box(x0 - 1, 3, 0, x1 + 1, 5, 2, CH, 2); V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CH, 2);                                                                             // bumpers
  V.box(x0 + 1, 5, L + 1, x0 + 4, 7, L + 2, 0xffffff, TOD.night ? 3 : 1); V.box(x1 - 4, 5, L + 1, x1 - 1, 7, L + 2, 0xffffff, TOD.night ? 3 : 1);                     // headlamps
  V.box(x0 + 1, 6, 0, x0 + 3, 8, 1, 0xd7141a, TOD.night ? 3 : 1); V.box(x1 - 3, 6, 0, x1 - 1, 8, 1, 0xd7141a, TOD.night ? 3 : 1);
  if (o.grille) V.box(x0 + 5, 4, L + 1, x1 - 5, 9, L + 2, (x, y) => y % 2 ? CH : 0x2a2a30, 2);
  if (o.stripe) V.box(x0, belt - 2, 1, x1, belt - 1, L + 1, (x) => (x === x0 || x === x1 - 1) ? o.stripe : B);
  for (const z of o.wz) for (const x of [x0 - 1, x1 - 2]) { V.box(x, 0, z - 3, x + 3, 7, z + 4, 0x1b1b20); V.box(x + (x < x0 ? 0 : 2), 2, z - 1, x + 1 + (x < x0 ? 0 : 2), 5, z + 2, o.rim ?? CH, 2); }
  for (const z of o.wz) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4);
  return V;
}
export const suv = () => memo('suv', () => done(car({ L: 48, W: 20, body: 0x141418, belt: 11, roof: 22, cab: [10, 38], glass: 0x0c0f16, grille: true, pillars: [24], wz: [8, 40], rim: 0x9aa0aa }), 'car'));
export const sedan = () => memo('sedan', () => done(car({ L: 50, W: 19, body: 0x17171b, belt: 10, roof: 19, cab: [15, 34], glass: 0x0c0f16, grille: true, pillars: [25], wz: [9, 41], rim: C.gold }), 'car'));
export const limo = (white = false) => memo('limo' + white, () => done(car({ L: 74, W: 19, body: white ? 0xf2efe6 : 0x17171b, belt: 10, roof: 19, cab: [14, 58], glass: 0x0c0f16, grille: true, pillars: [26, 36, 46], wz: [9, 65], rim: white ? C.gold : 0xc9ced6 }), 'car'));
export const roadster = c => memo('roadster' + c, () => done(car({ L: 42, W: 18, body: c, belt: 9, cab: [12, 26], open: true, wz: [8, 34], rim: 0xe6e6ea, stripe: 0xf2efe6 }), 'car'));
export const supercar = c => memo('super' + c, () => done(car({ L: 44, W: 20, body: c, belt: 7, roof: 13, cab: [14, 30], glass: 0x14161c, nose: 10, wz: [8, 35], rim: 0x17171b, stripe: 0x17171b }), 'car'));

// a square planter (stone or ink) with cubic topiary: a stack of cubes (the cone) or one big cube (the box)
export const topiary = (kind = 0, pot = C.ink) => memo('topi' + kind + pot, () => { const V = pv(12, 34, 12);
  V.box(0, 0, 0, 12, 8, 12, pot); V.box(0, 7, 0, 12, 8, 12, pot === C.ink ? C.gold : 0xf2efe6); V.box(1, 8, 1, 11, 9, 11, 0x5a3a22);
  if (kind === 0) [[8, 9], [6, 17], [4, 23], [2, 27]].forEach(([s, y], k) => V.box(6 - s / 2, y, 6 - s / 2, 6 + s / 2, y + (k ? 6 : 8), 6 + s / 2, (x, yy, z) => ((x + yy + z + k) % 5 === 0) ? C.leafD : C.leaf));
  else { V.box(5, 9, 5, 7, 13, 7, C.trunk); V.box(2, 13, 2, 10, 21, 10, (x, y, z) => ((x + y + z) % 4 === 0) ? C.leafD : C.leafL); }
  return done(V, 'topiary'); });
// a brass lantern on a post (the court's corners, the gate piers)
export const lantern = () => memo('lantern', () => { const V = pv(6, 30, 6); V.box(1, 0, 1, 5, 2, 5, C.ink); V.box(2, 2, 2, 4, 22, 4, C.ink);
  V.box(1, 22, 1, 5, 23, 5, C.brass, 2); V.box(1, 23, 1, 5, 28, 5, (x, y, z) => (x === 1 || x === 4) && (z === 1 || z === 4) ? C.brass : 0xfff3c4, TOD.night ? 3 : 1); V.box(1, 28, 1, 5, 29, 5, C.brass, 2); V.box(2, 29, 2, 4, 30, 4, C.ink);
  return done(V, 'lantern'); });
// the valet: a podium with the key box and a striped umbrella; traffic cones
export const valetStand = () => memo('valet', () => { const V = pv(10, 30, 8); V.box(1, 0, 1, 9, 11, 7, 0x17171b); V.box(1, 11, 1, 9, 12, 7, C.gold, 2); V.box(2, 12, 2, 5, 15, 6, 0x3a2418);
  V.box(3, 6, 7, 8, 10, 8, C.gold, 2); V.box(7, 12, 3, 8, 26, 4, C.chalk);
  for (let k = 0; k < 4; k++) cyl(V, 7.5, 3.5, 4 - k, 24 + k, 25 + k, (x, y, z) => ((Math.atan2(z - 3.5, x - 7.5) * 4 / Math.PI + 8) | 0) % 2 ? C.rasp : C.chalk);
  return done(V, 'valet-stand'); });
export const cone = () => memo('cone', () => { const V = pv(5, 8, 5); V.box(0, 0, 0, 5, 1, 5, 0xff6a1a); V.box(1, 1, 1, 4, 4, 4, (x, y) => y === 3 ? C.chalk : 0xff6a1a); V.box(2, 4, 2, 3, 7, 3, 0xff6a1a); return done(V, 'cone'); });
// a brass luggage cart piled with trunks and hatboxes
export const luggageCart = () => memo('lcart', () => { const V = pv(10, 22, 16); V.box(0, 1, 0, 10, 2, 16, C.brass, 2); for (const [x, z] of [[0, 1], [9, 1], [0, 14], [9, 14]]) V.box(x, 0, z, x + 1, 1, z + 1, C.ink);
  for (const x of [0, 9]) { V.box(x, 2, 0, x + 1, 20, 1, C.brass, 2); V.box(x, 2, 15, x + 1, 20, 16, C.brass, 2); } V.box(0, 19, 0, 10, 20, 16, C.brass, 2);
  V.box(1, 2, 2, 9, 7, 9, 0x8b4a24); V.box(1, 4, 2, 9, 5, 9, C.gold, 2); V.box(2, 7, 3, 8, 11, 8, C.sky); V.box(1, 2, 10, 9, 6, 14, 0x17171b); cyl(V, 5, 12, 3, 6, 10, C.pink); V.box(2, 10, 11, 8, 11, 13, C.chalk);
  return done(V, 'luggage-cart'); });
// a gate pier: a stone post with a lantern on top (the court's street corners)
export const pier = (stone = C.stone) => memo('pier' + stone, () => { const V = pv(8, 34, 8); V.box(0, 0, 0, 8, 22, 8, stone); V.box(-1, 22, -1, 9, 24, 9, C.chalk);
  V.box(2, 24, 2, 6, 25, 6, C.ink); V.box(2, 25, 2, 6, 31, 6, (x, y, z) => (x === 2 || x === 5) && (z === 2 || z === 5) ? C.ink : 0xfff3c4, TOD.night ? 3 : 1); V.box(1, 31, 1, 7, 32, 7, C.ink); V.box(3, 32, 3, 5, 34, 5, C.gold, 2);
  return done(V, 'pier'); });
