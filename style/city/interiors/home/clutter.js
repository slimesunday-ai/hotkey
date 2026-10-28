// Home objects · lived-in clutter (free rotation): pizza boxes, a laundry pile, a box fan, kicked-off sneakers. Seeds make every
// pile its own: no two heaps alike.
import { def, K, pick, cyl, line, glow, LIT, shade, mix, rng, hash, txtTop, M3, sneaker } from './lib.js';

export const pizzaBoxes = def({ id: 'pizza-boxes', name: 'Pizza boxes', cat: 'clutter', place: 'floor', foot: [2, 2], h: 0.5, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['clutter', 'late night', 'takeout'], variants: 3, vnames: ['stack of 3', 'stack of 5', 'one open'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 53 + 3), CB = 0xc98a4b, W = 0xf2efe6;
    const box = (x0, y, z0) => { V.box(x0, y, z0, x0 + 9, y + 1, z0 + 9, CB); V.box(x0 + 1, y, z0 + 1, x0 + 8, y + 1, z0 + 8, W);
      for (let a = 0; a < 18; a++) { const t = a / 18 * Math.PI * 2; V.set(Math.floor(x0 + 4.5 + Math.cos(t) * 2.6), y, Math.floor(z0 + 4.5 + Math.sin(t) * 2.6), K.red); } V.set(x0 + 4, y, z0 + 4, K.red); };   // a red pie on the lid
    if (variant < 2) { const n = variant ? 5 : 3; for (let k = 0; k < n; k++) box((r() * 2) | 0, k, (r() * 2) | 0); return; }
    box(0, 0, 1); const x0 = 1, z0 = 1, y = 1; V.box(x0, y, z0, x0 + 9, y + 1, z0 + 9, CB); V.box(x0 + 1, y, z0 + 1, x0 + 8, y + 1, z0 + 8, W);   // the open box on another
    for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { const dx = x - 3, dz = z - 3, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx); if (d > 3.4 || !(a > .2 && a < 1.2)) continue;   // one slice left
      V.set(x0 + 1 + x, y + 1, z0 + 1 + z, d > 2.5 ? 0xd9a05b : (hash(x, z, seed) > .75 ? K.red : K.yellow)); }
    for (const [x, z] of [[2, 2], [5, 6]]) V.box(x0 + x, y + 1, z0 + z, x0 + x + 2, y + 2, z0 + z + 1, 0xd9a05b);           // crusts
    V.box(x0, y, 0, x0 + 9, y + 9, 1, CB); V.box(x0 + 1, y + 2, 0, x0 + 8, y + 8, 1, W); V.set(x0 + 3, y + 5, 0, 0xe0c890); V.set(x0 + 6, y + 3, 0, 0xe0c890);   // the lid up, grease spots
  } });

export const laundryPile = def({ id: 'laundry-pile', name: 'Laundry pile', cat: 'clutter', place: 'floor', foot: [3, 3], h: 0.35, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['clutter', 'lived-in', 'bedroom'], variants: 3, vnames: ['darks', 'brights', 'whites + denim'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const P = pick([[0x2a2a31, 0x3f5f9a, K.grey, K.oxblood, K.forest], [K.red, K.yellow, K.pink, K.cobalt, K.orange], [K.white, 0x3f5f9a, K.bone, 0x2f4f8a, K.white]], variant), r = rng(seed * 61 + variant);
    for (let k = 0; k < 13; k++) { const a = r() * 6.28, rad = r() * 4.2, c = pick(P, (r() * 5) | 0), stripe = r() < .25, cx = 7.5 + Math.cos(a) * rad, cz = 7.5 + Math.sin(a) * rad;
      V.ell(cx, .8 + (1 - rad / 5) * 2.6, cz, 2 + r() * 1.6, 1 + r() * .8, 2 + r() * 1.6, (x, y, z) => stripe && (y & 1) ? K.white : c); }
    for (let k = 0; k < 3; k++) { const a = r() * 6.28, c = pick(P, k + 2); line(V, Math.round(7.5 + Math.cos(a) * 3), 1, Math.round(7.5 + Math.sin(a) * 3), Math.round(7.5 + Math.cos(a) * 6.8), 0, Math.round(7.5 + Math.sin(a) * 6.8), c); }   // sleeves to the floor
    let top = 0; for (let y = 6; y >= 0 && !top; y--) if (V.has(7, y, 7)) top = y; V.box(6, top + 1, 7, 9, top + 2, 8, K.white); V.set(8, top + 1, 7, K.red);   // a sock on top
  } });

export const boxFan = def({ id: 'box-fan', name: 'Box fan', cat: 'clutter', place: 'floor', foot: [2, 1], h: 0.55, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['summer', 'no AC', 'trailer'], variants: 2, vnames: ['white', 'putty'], far: true,
  build(V, { variant = 0 } = {}) {
    const c = pick([K.white, 0xcfc8b4], variant);
    for (const x of [1, 7]) V.box(x, 0, 0, x + 2, 1, 5, shade(c, .85));
    V.box(0, 1, 1, 10, 11, 4, c); V.box(1, 2, 1, 9, 10, 4, -1); V.box(4, 10, 1, 6, 11, 4, -1);                        // the frame, the handle notch
    cylZ3(V, 5, 6, 1.2, 2, K.ink); for (const a of [0, 2.1, 4.2]) for (let t = 1.2; t < 4; t += .5) for (const w of [-.8, 0, .8]) V.set(Math.floor(5 + Math.cos(a) * t - Math.sin(a) * w), Math.floor(6 + Math.sin(a) * t + Math.cos(a) * w), 2, K.sky, 1);   // the blades
    for (const y of [2, 4, 6, 8]) V.box(1, y, 3, 9, y + 1, 4, c); V.box(4, 3, 3, 6, 9, 4, c);                          // the front grille
    V.box(7, 10, 4, 9, 11, 5, K.ink);                                                                                  // the speed knob
  } });
function cylZ3(V, cx, cy, r, z, c) { for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) V.set(x, y, z, c); }

export const sneakersKicked = def({ id: 'sneakers-kicked', name: 'Kicked-off sneakers', cat: 'clutter', place: 'floor', foot: [2, 2], h: 0.2, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['clutter', 'sneakers', 'doorway'], variants: 3, vnames: ['white + red', 'black + pink', 'cobalt + yellow'],
  build(V, { variant = 0 } = {}) {
    const [a, b] = pick([[K.white, K.red], [K.ink, K.pink], [K.cobalt, K.yellow]], variant);
    sneaker(V, 1, 0, 1, a, b, K.white, false, 2);                                                                     // one upright
    for (let i = 0; i < 8; i++) V.box(2 + i, 0, 5 + (i >> 2), 3 + i, 2, 7 + (i >> 2), i > 4 ? b : a); V.box(2, 0, 7 + 1, 10, 1, 9 + 1, K.white);   // one on its side, sole up to the room
  } });

export const CLUTTER = [pizzaBoxes, laundryPile, boxFan, sneakersKicked];
