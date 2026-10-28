// Home objects · the basics and the tier furniture: seating, beds, tables, storage, lights, plants, kitchen, bath.
// Sizes follow the big-head body (hips 0.5 m, shoulders 0.83, head to 1.75): seats 0.4–0.45, tables 0.6, counters 0.7, bar 0.95.
import { def, K, pick, cyl, cylX, cylZ, line, glow, LIT, shade, mix, rng, hash, txt, M3, M5, prune } from './lib.js';
import { crate } from './media.js';

// ── seating
export const couchHouse = def({ id: 'couch-house', name: 'Living-room couch', cat: 'seating', place: 'floor', foot: [9, 4], h: 0.9, seat: 0.45, tops: [0.45],
  tiers: ['trailer', 'apartment', 'house'], tags: ['classic', 'family', 'living room'], variants: 3, vnames: ['plum', 'orange', 'green'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.plum, K.orange, K.grass], variant), d = shade(c, .78), lt = shade(c, 1.12), W = 45, r = rng(seed * 7 + 3);
    for (const x of [2, 41]) for (const z of [3, 16]) V.box(x, 0, z, x + 2, 1, z + 2, K.woodD);                  // stubby feet
    V.box(1, 1, 1, W - 1, 6, 19, c); V.box(5, 5, 18, W - 5, 6, 19, d);                                              // base, a piped seam
    V.box(0, 6, 0, W, 16, 6, c); V.box(1, 16, 0, W - 1, 17, 5, c); V.box(2, 17, 1, W - 2, 18, 4, c);                 // the back and its roll
    for (const x0 of [0, W - 5]) { V.box(x0, 1, 1, x0 + 5, 11, 20, c); V.box(x0 + 1, 11, 1, x0 + 4, 12, 19, c); V.box(x0 + 1, 2, 19, x0 + 4, 10, 20, lt); }   // scroll arms
    const cx = [5, 17, 28, 40];
    for (let k = 0; k < 3; k++) { const top = 9 - (r() < .3 ? 1 : 0); V.box(cx[k], 6, 5, cx[k + 1], top, 19, c); V.box(cx[k], top - 1, 18, cx[k + 1], top, 19, lt);   // seat cushions (one slumps)
      V.box(cx[k], 9, 5, cx[k + 1], 15, 8, c); V.box(cx[k] + 1, 15, 5, cx[k + 1] - 1, 16, 7, c);                       // back cushions
      if (k) { V.clear(cx[k], top - 1, 5, cx[k] + 1, top, 19); V.clear(cx[k], 10, 7, cx[k] + 1, 16, 8); } }
    const px = r() < .5 ? 6 : 34; V.box(px, 9, 7, px + 5, 14, 9, pick([K.yellow, K.cyan, K.white, K.pink], seed));    // a throw pillow
  } });

export const recliner = def({ id: 'recliner', name: 'Recliner', cat: 'seating', place: 'floor', foot: [4, 4], h: 0.95, seat: 0.45,
  tiers: ['trailer', 'house'], tags: ['trailer', 'dad', 'tv'], variants: 3, vnames: ['brown vinyl', 'mustard', 'green'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([0x8a5a33, K.mustard, 0x2f7a3a], variant), lt = shade(c, 1.12), r = rng(seed * 13 + 5);
    V.box(3, 0, 2, 16, 2, 12, K.ink);                                                                          // dark plinth
    V.box(1, 2, 1, 18, 8, 14, c);                                                                              // the seat box
    for (let y = 8; y < 18; y++) { const t = Math.floor((y - 8) / 4); V.box(3, y, 0, 16, y + 1, 7 - t, c); }  // the back, leaning
    V.box(4, 18, 0, 15, 19, 4, c);
    for (const x0 of [0, 15]) { V.box(x0, 2, 1, x0 + 4, 11, 15, c); V.box(x0 + 1, 11, 1, x0 + 3, 12, 14, c); V.box(x0 + 1, 3, 14, x0 + 3, 10, 15, lt); }   // arms
    V.box(4, 8, 5, 15, 9, 14, lt);                                                                             // seat cushion (top 0.45)
    V.box(5, 5, 15, 14, 8, 20, c); V.box(5, 7, 15, 14, 8, 20, lt);                                              // the footrest, kicked up
    for (const x of [6, 12]) { line(V, x, 2, 13, x, 5, 17, K.chrome, 2); line(V, x, 2, 17, x, 5, 14, K.chrome, 2); }   // scissor arms
    V.box(19, 6, 9, 20, 10, 10, K.chrome, 2); V.box(19, 9, 9, 20, 10, 12, K.chrome, 2);                         // the lever
    V.box(6, 14, 7 - 2, 13, 18, 7 - 1, K.cream); for (let x = 6; x < 13; x += 2) V.set(x, 13, 5, K.cream);        // the doily, scalloped
    if (variant === 0) V.box(1, 11, 4, 3, 12, 8, K.steelL);                                                     // duct tape on the arm
    if (r() < .7) { V.box(16, 12, 6, 18, 13, 10, K.ink); V.set(16, 13, 7, K.red); }                              // the remote on the arm
  } });

export const futon = def({ id: 'futon', name: 'Futon', cat: 'seating', place: 'floor', foot: [8, 4], h: 0.8, seat: 0.45, tops: [0.45],
  tiers: ['apartment'], tags: ['apartment', 'first place', 'fold-out'], variants: 3, vnames: ['red', 'cobalt', 'charcoal on pine'], far: true,
  build(V, { variant = 0 } = {}) {
    const c = pick([K.red, K.cobalt, 0x3a3c44], variant), d = shade(c, .72), F = variant === 2 ? K.oak : K.iron;
    for (const x0 of [0, 38]) { V.box(x0, 0, 2, x0 + 2, 12, 4, F); V.box(x0, 12, 1, x0 + 2, 16, 3, F); V.box(x0, 0, 16, x0 + 2, 9, 18, F);
      V.box(x0, 9, 2, x0 + 2, 10, 18, F); V.box(x0, 1, 4, x0 + 2, 2, 16, F); }
    V.box(2, 3, 5, 38, 4, 6, F); V.box(2, 3, 16, 38, 4, 17, F);                                               // deck rails
    V.box(2, 4, 4, 38, 9, 19, c); V.clear(2, 8, 18, 38, 9, 19);                                                 // the seat half of the mattress
    for (let y = 9; y < 16; y++) { const z0 = 3 - Math.floor((y - 9) / 3); V.box(2, y, z0, 38, y + 1, z0 + 4, c); }   // the back half, folded up
    V.clear(2, 8, 7, 38, 9, 8);                                                                               // the fold
    for (let x = 6; x < 36; x += 7) { V.set(x, 8, 11, d); V.set(x, 8, 16, d); V.set(x, 11, 6, d); V.set(x, 14, 5, d); }   // tufts
  } });

export const chairPuffer = def({ id: 'chair-puffer', name: 'Puffer chair', cat: 'seating', place: 'floor', foot: [4, 4], h: 0.8, seat: 0.4,
  tiers: ['penthouse'], tags: ['designer', 'hypebeast', 'quilted'], variants: 3, vnames: ['black', 'silver', 'orange'], far: true,
  build(V, { variant = 0 } = {}) {
    const c = pick([0x2a2a31, 0xc9ced6, K.orange], variant), d = shade(c, .8);
    V.box(3, 0, 4, 17, 3, 18, d);                                                                             // a hidden base
    for (const x of [6, 10, 14]) cylZ(V, x, 5, 2.6, 5, 19, c, 1);                                              // seat channels (front–back)
    for (const y of [7, 11, 14.5]) cylX(V, y, 3.5, 2.6, 3, 17, c, 1);                                         // back channels (stacked)
    for (const x of [2.5, 17.5]) { cylZ(V, x, 7, 2.5, 2, 19, c, 1); cylZ(V, x, 3.5, 2.5, 3, 18, c, 1); }       // arms
  } });

export const sofaLow = def({ id: 'sofa-low', name: 'Low sofa', cat: 'seating', place: 'floor', foot: [10, 4], h: 0.7, seat: 0.45, tops: [0.45],
  tiers: ['penthouse'], tags: ['designer', 'bouclé', 'lounge'], variants: 3, vnames: ['bone bouclé', 'black leather', 'cobalt velvet'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.bone, 0x2a2a31, K.cobalt], variant), l = variant === 1 ? 1 : 0, tex = (x, y, z) => (variant === 0 && hash(x, y * 7 + z, seed) > .82) ? shade(c, .93) : c;
    for (const x of [2, 47]) for (const z of [2, 17]) V.box(x, 0, z, x + 1, 2, z + 1, K.chrome, 2);              // pin legs
    V.box(0, 2, 1, 50, 6, 20, tex, l);                                                                          // plinth
    for (const x0 of [1, 25]) { V.box(x0, 6, 5, x0 + 24, 9, 20, tex, l); V.clear(x0, 8, 19, x0 + 24, 9, 20); }     // two long seat cushions
    for (const x0 of [1, 17, 33]) for (let y = 9; y < 14; y++) { const z0 = 1 + (y > 11 ? 0 : 1); V.box(x0 + (y === 13 ? 1 : 0), y, z0, x0 + 16 - (y === 13 ? 1 : 0), y + 1, z0 + 4, tex, l); }   // loose back cushions
    V.box(0, 2, 1, 2, 10, 20, tex, l); V.box(48, 2, 1, 50, 10, 20, tex, l);                                      // thin arms
    V.box(3, 9, 9, 10, 10, 18, variant === 0 ? K.orange : K.bone);                                               // a folded throw
  } });

export const beanbag = def({ id: 'beanbag', name: 'Beanbag', cat: 'seating', place: 'floor', foot: [3, 3], h: 0.5, seat: 0.3,
  tiers: ['apartment', 'house'], tags: ['gaming', 'dorm', 'lounge'], variants: 3, vnames: ['pink', 'lime', 'cobalt'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.pink, 0x5fd35a, K.cobalt], variant);
    V.ell(7.5, 2, 7.5, 7.2, 4.5, 7.2, c, 1); V.ell(7.5, 5.5, 4.5, 6, 4.5, 4, c, 1);                            // the sack and its slumped back
    V.ell(7.5, 7.2, 9.5, 4, 2.4, 4, -1);                                                                       // the dent where you sit
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2, x = Math.round(7.5 + Math.cos(t) * 6.9 - .5), z = Math.round(7.5 + Math.sin(t) * 6.9 - .5); if (V.has(x, 2, z)) V.set(x, 2, z, shade(c, .75), 1); }   // the seam
  } });

export const stoolBar = def({ id: 'stool-bar', name: 'Bar stool', cat: 'seating', place: 'floor', foot: [2, 2], h: 0.7, seat: 0.7,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['bar', 'kitchen', 'chrome'], variants: 3, vnames: ['black', 'oxblood', 'cognac'],
  build(V, { variant = 0 } = {}) {
    const c = pick([0x2a2a31, K.oxblood, 0x9a5a2a], variant);
    cyl(V, 5, 5, 3.8, 0, 1, K.chrome, 2); V.box(4, 1, 4, 6, 11, 6, K.chrome, 2);                               // base, post
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; V.set(Math.floor(5 + Math.cos(t) * 3.3), 5, Math.floor(5 + Math.sin(t) * 3.3), K.chrome, 2); }   // foot ring
    for (const [x, z] of [[4, 2], [4, 7], [2, 4], [7, 4]]) V.box(Math.min(x, 5), 5, Math.min(z, 5), Math.max(x, 5) + 1, 6, Math.max(z, 5) + 1, K.chrome, 2);         // ring spokes
    cyl(V, 5, 5, 4.6, 11, 13, c, 1); cyl(V, 5, 5, 4, 13, 14, c, 1); cyl(V, 5, 5, 4.6, 11, 12, shade(c, .7), 1);   // the seat, a darker welt
  } });

// ── beds (sim: 'bed')
export const bedDouble = def({ id: 'bed-double', name: 'Double bed', cat: 'beds', place: 'floor', foot: [6, 8], h: 1.0, seat: 0.5, tops: [0.5], sim: 'bed',
  tiers: ['trailer', 'apartment', 'house'], tags: ['bedroom', 'classic'], variants: 3, vnames: ['cobalt', 'red check', 'yellow'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const W = K.oak, base = pick([K.cobalt, K.red, K.amber], variant), du = variant === 1 ? (x, y, z) => (((x >> 1) + (z >> 1)) & 1) ? base : shade(base, .72) : base;
    V.box(0, 0, 0, 30, 18, 2, W); V.box(1, 18, 0, 29, 19, 2, W); V.box(3, 19, 0, 27, 20, 2, W);                 // headboard, a humped top
    V.box(3, 6, 1, 27, 16, 2, shade(W, .86));                                                                   // its inset panel
    for (const x of [0, 28]) for (const z of [2, 38]) V.box(x, 0, z, x + 2, 2, z + 2, K.woodD);                  // legs
    V.box(0, 2, 2, 30, 5, 40, W); V.box(0, 5, 38, 30, 9, 40, W);                                                // frame, footboard
    V.box(1, 5, 2, 29, 9, 38, K.white);                                                                         // mattress
    V.box(0, 5, 13, 1, 10, 38, du); V.box(29, 5, 13, 30, 10, 38, du); V.box(1, 9, 13, 29, 10, 38, du);          // duvet, draped over the sides
    V.box(1, 9, 12, 29, 10, 15, K.white); V.box(1, 10, 13, 29, 11, 15, K.white);                                 // the turned-down sheet
    for (const x0 of [3, 16]) { V.box(x0, 9, 3, x0 + 11, 11, 10, K.white); V.box(x0 + 1, 11, 4, x0 + 10, 12, 9, K.white); }   // pillows
    if (hash(seed, 3) > .4) V.box(18, 10, 24, 26, 11, 31, pick([K.ink, K.red, K.teal], seed));                  // a tee left on the bed
  } });

export const mattressFloor = def({ id: 'mattress-floor', name: 'Mattress on the floor', cat: 'beds', place: 'floor', foot: [5, 8], h: 0.3, seat: 0.2, tops: [0.2], sim: 'bed',
  rot: 45, tiers: ['trailer', 'apartment'], tags: ['lived-in', 'clutter', 'crash pad'], variants: 2, vnames: ['grey blanket', 'red blanket'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 31 + 9), bl = pick([0x7a7d88, K.red], variant);
    V.box(1, 0, 1, 24, 4, 39, (x) => (x % 4 === 1) ? 0x4a6fd0 : K.white);                                      // ticking, blue stripes
    V.box(1, 3, 1, 24, 4, 22, K.bone); V.box(1, 0, 1, 2, 4, 20, K.bone);                                         // a sheet half on
    V.box(3, 4, 2, 14, 6, 8, K.white); V.box(4, 6, 3, 13, 6, 7, K.white);                                       // the pillow
    for (let k = 0; k < 7; k++) V.ell(5 + r() * 15, 4.2, 20 + r() * 15, 3 + r() * 2, 1.4 + r(), 3 + r() * 2, (x, y, z) => ((x + z) % 5 ? bl : shade(bl, .8)));   // the blanket, balled up
    line(V, 22, 4, 5, 24, 4, 5, K.ink); line(V, 24, 4, 5, 24, 0, 8, K.ink); V.box(19, 4, 4, 21, 5, 6, K.ink);    // a phone on its charger
  } });

export const bedPlatform = def({ id: 'bed-platform', name: 'Platform bed', cat: 'beds', place: 'floor', foot: [8, 9], h: 0.9, seat: 0.45, tops: [0.45], sim: 'bed',
  tiers: ['penthouse'], tags: ['designer', 'king', 'bedroom'], variants: 2, vnames: ['cognac + black', 'black + bone'], far: true,
  build(V, { variant = 0 } = {}) {
    const hb = pick([0x9a5a2a, 0x2a2a31], variant), du = pick([0x2a2a31, K.bone], variant);
    V.box(0, 0, 0, 40, 18, 3, (x) => (x % 5 === 0 ? shade(hb, .78) : hb), 1);                                  // channel-tufted headboard
    V.box(2, 0, 4, 38, 1, 43, K.ink); V.box(0, 1, 3, 40, 3, 45, K.walnut);                                      // plinth, walnut platform
    V.box(2, 3, 4, 38, 8, 43, K.white);                                                                         // mattress
    V.box(1, 4, 15, 2, 9, 43, du); V.box(38, 4, 15, 39, 9, 43, du); V.box(2, 8, 15, 38, 9, 43, du); V.box(2, 4, 43, 38, 9, 44, du);   // duvet
    V.box(2, 9, 34, 38, 10, 42, 0xd6d1c6); for (let x = 2; x < 38; x++) for (let z = 34; z < 42; z++) if (hash(x, z, 5) > .8) V.set(x, 9, z, 0xb9b4aa);   // a fur throw
    for (const [x0, c] of [[3, K.white], [12, K.white], [21, K.white], [30, pick([K.orange, K.gold], variant)]]) { V.box(x0, 8, 5, x0 + 8, 11, 11, c); V.box(x0 + 1, 11, 6, x0 + 7, 12, 10, c); }
  } });

// ── tables
export const tableCoffee = def({ id: 'table-coffee', name: 'Coffee table', cat: 'tables', place: 'floor', foot: [5, 3], h: 0.35, tops: [0.35],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['living room'], variants: 3, vnames: ['oak', 'glass + chrome', 'mosaic'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    if (variant === 1) { for (const x of [1, 23]) for (const z of [1, 13]) V.box(x, 0, z, x + 1, 6, z + 1, K.chrome, 2);
      V.box(1, 5, 1, 24, 6, 2, K.chrome, 2); V.box(1, 5, 13, 24, 6, 14, K.chrome, 2); V.box(1, 5, 1, 2, 6, 14, K.chrome, 2); V.box(23, 5, 1, 24, 6, 14, K.chrome, 2);
      V.box(0, 6, 0, 25, 7, 15, (x, y, z) => (x + z === 12 || x + z === 13) ? K.glint : K.glass, 1); V.box(8, 7, 5, 13, 8, 9, K.ink); return; }   // (a coffee-table book)
    const top = variant === 2 ? (x, y, z) => (x % 3 === 0 || z % 3 === 0) ? K.white : pick([K.cobalt, K.yellow, K.red, K.teal, K.orange], (hash(x >> 0 / 3, z, seed) * 5) | 0) : K.oak;
    for (const x of [1, 22]) for (const z of [1, 12]) V.box(x, 0, z, x + 2, 5, z + 2, K.walnut);
    V.box(2, 1, 2, 23, 2, 13, K.walnut); V.box(0, 5, 0, 25, 7, 15, K.woodD); V.box(1, 6, 1, 24, 7, 14, top);   // shelf, top with a darker edge
    V.box(5, 2, 4, 11, 3, 10, K.red); V.box(6, 3, 5, 12, 4, 11, K.white);                                       // magazines on the shelf
  } });

export const desk = def({ id: 'desk', name: 'Desk', cat: 'tables', place: 'floor', foot: [6, 3], h: 0.6, tops: [0.6],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['computer', 'work', 'gaming'], variants: 2, vnames: ['oak', 'black + LED'], far: true,
  build(V, { variant = 0 } = {}) {
    if (variant === 1) { V.box(0, 11, 0, 30, 12, 15, 0x2a2a31); for (const x of [2, 27]) { V.box(x, 0, 2, x + 1, 11, 13, K.gun, 2); V.box(x - 1, 0, 1, x + 2, 1, 14, K.gun, 2); }
      V.box(3, 9, 2, 27, 10, 3, K.gun, 2); V.box(1, 10, 14, 29, 11, 15, K.pink, LIT); V.box(29, 7, 7, 30, 11, 8, K.chrome, 2); V.box(29, 7, 8, 30, 8, 10, K.chrome, 2); return; }   // steel frame, the LED strip, a headphone hook
    V.box(0, 11, 0, 30, 12, 15, K.oak); V.box(19, 0, 1, 29, 11, 14, K.oak);                                    // top, drawer pedestal
    for (const y of [1, 4, 7]) { V.box(20, y + 1, 14, 28, y + 3, 15, shade(K.oak, .9)); V.box(23, y + 2, 14, 25, y + 3, 15, K.gold, 2); }
    V.box(1, 0, 1, 3, 11, 3, K.oak); V.box(1, 0, 12, 3, 11, 14, K.oak); V.box(1, 5, 0, 19, 11, 1, K.oak);          // legs, modesty panel
  } });

export const tableEnd = def({ id: 'table-end', name: 'End table', cat: 'tables', place: 'floor', foot: [2, 2], h: 0.55, tops: [0.55],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['nightstand', 'lamp table'], variants: 2, vnames: ['oak', 'white'], far: true,
  build(V, { variant = 0 } = {}) {
    const c = pick([K.oak, K.white], variant), d = variant ? K.bone : K.woodD;
    for (const x of [0, 9]) for (const z of [0, 9]) V.box(x, 0, z, x + 1, 10, z + 1, c);
    V.box(0, 10, 0, 10, 11, 10, c); V.box(1, 7, 1, 9, 10, 9, c); V.box(1, 7, 9, 9, 10, 10, d); V.set(5, 8, 10 - 1, K.gold, 2);   // top, drawer + pull
    V.box(0, 2, 0, 10, 3, 10, c); V.box(2, 3, 2, 6, 5, 7, pick([K.red, K.cobalt], variant));                      // shelf, a book on it
  } });

// ── storage
export const crateShelf = def({ id: 'crate-shelf', name: 'Milk-crate shelves', cat: 'storage', place: 'floor', foot: [5, 2], h: 1.05, tops: [1.05],
  tiers: ['apartment'], tags: ['apartment', 'records', 'diy'], variants: 3, vnames: ['mixed', 'black', 'red + blue'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const pal = pick([[K.red, K.cobalt, K.yellow, K.grass, 0x2a2a31], [0x2a2a31], [K.red, K.cobalt]], variant), r = rng(seed * 17 + 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x0 = 2 + i * 7, y0 = j * 7, z0 = 1, c = pick(pal, i * 3 + j * 2 + seed);
      crate(V, x0, y0, z0, c);
      const k = (r() * 6) | 0, X = x0 + 1, Y = y0 + 1;
      if (k <= 1) for (let x = X; x < x0 + 6; x++) V.box(x, Y, z0 + 1, x + 1, Y + 5, z0 + 6, pick([K.ink, K.white, K.orange, K.pink, K.cyan, K.yellow, 0x3a3c44], (r() * 7) | 0));   // records
      else if (k === 2) for (let x = X; x < x0 + 6; x++) V.box(x, Y, z0 + 2, x + 1, Y + 3 + ((r() * 3) | 0), z0 + 5, pick([K.red, K.navy, K.forest, K.cream, K.mustard], (r() * 5) | 0));   // books
      else if (k === 3) { V.box(X, Y, z0 + 1, X + 5, Y + 1, z0 + 5, K.white); V.box(X, Y + 1, z0 + 1, X + 5, Y + 2, z0 + 5, pick([K.red, K.ink, K.teal], seed)); V.box(X, Y + 2, z0 + 1, X + 5, Y + 3, z0 + 5, K.grey); }   // folded tees
      else if (k === 4) V.box(X + 1, Y, z0 + 2, X + 4, Y + 2, z0 + 5, 0x3a3c44);                                   // a speaker
    }
  } });

export const dresser = def({ id: 'dresser', name: 'Dresser', cat: 'storage', place: 'floor', foot: [4, 2], h: 0.8, tops: [0.8],
  tiers: ['trailer', 'apartment', 'house'], tags: ['bedroom', 'drawers'], variants: 3, vnames: ['oak', 'white', 'teal'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.oak, K.white, K.teal], variant), knob = variant === 1 ? [K.red, K.yellow, K.cobalt] : [K.gold, K.gold, K.gold];
    V.box(1, 0, 1, 19, 1, 8, K.ink); V.box(0, 1, 0, 20, 15, 9, c); V.box(0, 15, 0, 20, 16, 10, shade(c, 1.06));
    [[2, 6], [7, 11], [12, 15]].forEach(([y0, y1], k) => { V.box(1, y0, 9, 19, y1 - (k < 2 ? 1 : 0), 10, shade(c, .92)); for (const x of [5, 14]) V.set(x, y0 + 1 + (k === 2 ? 0 : 1), 10 - 1, knob[k], 2); });
    if (hash(seed, 9) > .45) { V.box(1, 12, 9, 19, 15, 10, -1); V.box(1, 12, 9, 19, 13, 10, shade(c, .92)); V.box(7, 10, 9, 9, 14, 10, pick([K.white, K.red, K.pink], seed)); }   // the top drawer left open, a sock hanging out
  } });

// ── lights
export const lampTable = def({ id: 'lamp-table', name: 'Table lamp', cat: 'lights', place: 'surface', foot: [2, 2], h: 0.75,
  tiers: ['trailer', 'apartment', 'house'], tags: ['classic', 'living room', 'lamp'], variants: 3, vnames: ['orange + cream', 'teal + white', 'red + yellow'], far: true,
  build(V, { variant = 0 } = {}) {
    const base = pick([K.orange, K.teal, K.red], variant), shadeC = pick([K.cream, K.white, K.yellow], variant);
    cyl(V, 5, 5, 3, 0, 1, shade(base, .8)); V.ell(5, 3.2, 5, 3.2, 2.6, 3.2, base, 1); V.box(4, 5, 4, 6, 8, 6, K.gold, 2);   // foot, the ceramic belly, brass neck
    for (let y = 8; y < 15; y++) { const off = y >= 12 ? 1 : 0; cyl(V, 5 + off, 5, 4.6 - (y - 8) * .2, y, y + 1, shadeC, glow()); }   // the drum shade, a little crooked
    V.set(5, 15 - 1, 5, K.gold, 2);
  } });

export const lampArc = def({ id: 'lamp-arc', name: 'Arc lamp', cat: 'lights', place: 'floor', foot: [7, 2], h: 2.0,
  tiers: ['penthouse', 'house'], tags: ['designer', 'reading'], variants: 2, vnames: ['chrome + white dome', 'brass + black dome'], far: true,
  build(V, { variant = 0 } = {}) {
    const metal = variant ? K.gold : K.chrome, dome = variant ? 0x2a2a31 : K.white, mb = variant ? 0x2a2a31 : K.white;
    V.box(1, 0, 1, 9, 3, 9, (x, y, z) => (hash(x, y, z) > .86 ? (variant ? 0x55555f : 0xb9b9c0) : mb));          // marble block
    V.box(4, 3, 4, 6, 33, 6, metal, 2);                                                                          // the pole, then the arc
    let px = 4, py = 33; for (let k = 1; k <= 24; k++) { const t = k / 24, x = 4 + t * 25, y = 33 + Math.sin(t * Math.PI * .8) * 6; line(V, px, py, 4, x, y, 4, metal, 2); line(V, px, py, 5, x, y, 5, metal, 2); px = x; py = y; }
    const cx = 29.5, top = Math.round(py); V.box(29, top - 3, 4, 31, top + 1, 6, metal, 2);                         // the dome hangs at 1.4–1.7 m, over a table
    for (let y = top - 9; y < top - 3; y++) cyl(V, cx, 5, Math.max(1.5, 5.2 - (y - (top - 9)) * .55), y, y + 1, dome, 1);
    cyl(V, cx, 5, 2, top - 10, top - 9, K.cream, glow());                                                       // the bulb's face, underneath
  } });

export const lavaLamp = def({ id: 'lava-lamp', name: 'Lava lamp', cat: 'decor', place: 'surface', foot: [1, 1], h: 0.45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['clutter', '70s', 'glow'], variants: 3, vnames: ['red + yellow', 'blue + lime', 'purple + pink'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const [fl, bl] = pick([[0xe8232a, K.yellow], [0x2f5bff, K.lime], [K.purple, K.pink]], variant), r = rng(seed * 5 + variant);
    cyl(V, 2.5, 2.5, 2.5, 0, 1, K.gold, 2); cyl(V, 2.5, 2.5, 2.2, 1, 2, K.gold, 2); cyl(V, 2.5, 2.5, 1.7, 2, 3, K.gold, 2);
    cyl(V, 2.5, 2.5, 1.7, 3, 8, fl, LIT); cyl(V, 2.5, 2.5, 1.2, 8, 9, K.gold, 2);
    for (let k = 0; k < 3; k++) { const y = 3 + ((r() * 5) | 0), a = (r() * 4) | 0, [x, z] = [[1, 2], [3, 2], [2, 1], [2, 3]][a]; V.set(x, y, z, bl, LIT); if (y < 7) V.set(x, y + 1, z, bl, LIT); }
  } });

export const neonSign = def({ id: 'neon-sign', name: 'Neon sign', cat: 'lights', place: 'wall', foot: [7, 2], h: 0.1, mount: 1.6,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['hypebeast', 'glow', 'bedroom'], variants: 3, vnames: ['LUCKY pink', 'RICH yellow', 'DRIP cyan'], far: true,
  build(V, { variant = 0 } = {}) {
    const [w, c] = pick([['LUCKY', K.pink], ['RICH', K.yellow], ['DRIP', K.cyan]], variant), M = M5(w), x0 = Math.round((35 - M.w) / 2);
    V.box(x0 - 1, 1, 0, x0 + M.w + 1, 10, 1, 0x2a3350, 1); for (const [x, y] of [[x0 - 1, 1], [x0 + M.w, 1], [x0 - 1, 9], [x0 + M.w, 9]]) V.del(x, y, 0);   // a smoked acrylic backer
    for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.set(x0 + i, 8 - j, 1, c, LIT);   // the tubes
    V.box(x0 + M.w + 1, 1, 0, x0 + M.w + 3, 3, 2, K.ink);                                                     // the transformer
  } });

export const ceilingFan = def({ id: 'ceiling-fan', name: 'Ceiling fan', cat: 'lights', place: 'ceiling', foot: [6, 6], h: 0.5,
  tiers: ['trailer', 'house'], tags: ['classic', 'summer'], variants: 2, vnames: ['wood + brass', 'white'], far: true,
  build(V, { variant = 0 } = {}) {
    const bl = variant ? K.white : K.wood, m = variant ? K.white : K.gold;
    cyl(V, 15, 15, 2.5, 9, 10, m, 2); V.box(14, 5, 14, 16, 9, 16, m, 2); cyl(V, 15, 15, 3.4, 3, 6, m, 2);        // canopy, downrod, motor
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let t = 3; t < 15; t++) { const x = 15 + dx * t, z = 15 + dz * t, wx = dz ? 2 : 0, wz = dx ? 2 : 0;
      V.box(Math.min(x, x + (dx < 0 ? 1 : 0)) - wx + (dx < 0 ? 0 : 0), 4, z - wz, Math.min(x, x + (dx < 0 ? 1 : 0)) + wx + 1, 5, z + wz + 1, t < 5 ? m : bl, t < 5 ? 2 : 0); }
    V.ell(15, 2, 15, 2.6, 1.6, 2.6, K.cream, glow()); line(V, 17, 3, 15, 17, 0, 15, m, 2);                       // the light bowl, pull chain
  } });

// ── plants (free rotation)
export const plantMonstera = def({ id: 'plant-monstera', name: 'Monstera', cat: 'plants', place: 'floor', foot: [3, 3], h: 1.2, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['green', 'corner'], variants: 3, vnames: ['terracotta pot', 'white pot', 'gold pot'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const pot = pick([K.terracotta, K.white, K.gold], variant), r = rng(seed * 23 + 7);
    cyl(V, 7.5, 7.5, 4.2, 0, 7, pot, variant === 2 ? 2 : 0); cyl(V, 7.5, 7.5, 4.8, 6, 7, pot, variant === 2 ? 2 : 0); cyl(V, 7.5, 7.5, 3.8, 6, 7, K.soil);
    for (let k = 0; k < 8; k++) { const a = k * 2.4 + r() * .6, rad = 3 + r() * 1.5, hy = 11 + ((k * 5 + (r() * 4 | 0)) % 12), cx = 7.5 + Math.cos(a) * rad, cz = 7.5 + Math.sin(a) * rad, c = k % 2 ? K.leaf : K.leafD;
      line(V, 7, 7, 7, Math.round(cx), hy, Math.round(cz), 0x3a8a3a);                                         // the stem runs into its leaf
      for (let u = -3; u <= 3; u++) for (let w = -2; w <= 2; w++) { if ((u / 3.4) ** 2 + (w / 2.4) ** 2 > 1) continue; if (Math.abs(w) === 2 && (u & 1)) continue;   // the splits
        const x = Math.round(cx + Math.cos(a) * u - Math.sin(a) * w), z = Math.round(cz + Math.sin(a) * u + Math.cos(a) * w), y = hy - Math.round(u * .4);
        if (x >= 0 && x < 15 && z >= 0 && z < 15) { V.set(x, y, z, c); V.set(x, y - 1, z, c); } } }   // two cubes thick: a leaf in one piece
    prune(V);
  } });

export const plantCactus = def({ id: 'plant-cactus', name: 'Cactus pot', cat: 'plants', place: 'surface', foot: [1, 1], h: 0.35, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['windowsill', 'small'], variants: 3, vnames: ['terracotta', 'cobalt', 'yellow'],
  build(V, { variant = 0 } = {}) {
    V.box(1, 0, 1, 4, 3, 4, pick([K.terracotta, K.cobalt, K.yellow], variant)); V.box(1, 2, 1, 4, 3, 4, K.soil);
    V.box(2, 2, 2, 3, 7, 3, K.leafD); V.box(3, 4, 2, 4, 5, 3, K.leafD); V.box(3, 5, 2, 4, 6, 3, K.leafD); V.set(1, 3, 2, K.leafD); V.set(1, 4, 2, K.leafD); V.set(2, 6, 2, K.pink);
  } });

// ── kitchen
export const fridge = def({ id: 'fridge', name: 'Fridge', cat: 'kitchen', place: 'floor', foot: [3, 3], h: 1.9, tops: [1.9],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['kitchen', 'magnets'], variants: 3, vnames: ['avocado', 'white', 'steel'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([0x7c9a2e, K.white, K.steelL], variant), l = variant === 2 ? 2 : 1, r = rng(seed * 41 + 3);
    V.box(1, 0, 1, 14, 1, 12, K.ink); V.box(0, 1, 0, 15, 38, 13, c, l); V.clear(0, 37, 0, 15, 38, 1); V.clear(0, 37, 0, 1, 38, 13); V.clear(14, 37, 0, 15, 38, 13);   // body, rounded top
    V.box(0, 1, 13, 15, 26, 14, c, l); V.box(0, 27, 13, 15, 37, 14, c, l);                                     // two doors, a gap between
    V.box(12, 14, 14, 13, 24, 15, K.chrome, 2); V.box(12, 29, 14, 13, 34, 15, K.chrome, 2);                      // handles
    if (variant === 2) { V.box(3, 18, 13, 8, 24, 14, K.ink); V.box(4, 19, 13, 7, 21, 14, K.cyan, LIT); return; }   // steel: a dispenser, no magnets
    V.box(2, 17, 14, 6, 22, 15, K.white); V.box(3, 18, 14, 5, 21, 15, pick([K.sky, K.pink, K.orange], seed));       // a photo (a kid's drawing next to it)
    V.box(7, 9, 14, 11, 14, 15, K.yellow); line(V, 7, 12, 14, 10, 10, 14, K.red); V.set(8, 13, 14, K.cobalt);
    V.box(2, 28, 14, 5, 33, 15, K.white); for (const y of [32, 30]) V.box(2, y, 14, 5, y + 1, 15, K.red);           // a takeout menu
    for (let k = 0; k < 5; k++) { const y = 4 + ((r() * 30) | 0); V.set(1 + ((r() * 12) | 0), y === 26 ? 27 : y, 14, pick([K.red, K.cobalt, K.yellow, K.lime, K.pink], k)); }   // magnets
  } });

export const stove = def({ id: 'stove', name: 'Stove', cat: 'kitchen', place: 'floor', foot: [3, 3], h: 0.95, tops: [0.75],
  tiers: ['trailer', 'apartment', 'house'], tags: ['kitchen'], variants: 2, vnames: ['white', 'red'], far: true,
  build(V, { variant = 0 } = {}) {
    const c = pick([K.white, K.rose], variant);
    V.box(1, 0, 1, 14, 1, 12, K.ink); V.box(0, 1, 0, 15, 14, 13, c, 1); V.box(0, 13, 0, 15, 14, 14, K.ink);      // body, black cooktop
    for (const [x, z] of [[4, 5], [11, 5], [4, 10], [11, 10]]) for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; V.set(Math.floor(x + Math.cos(t) * 2.2), 14, Math.floor(z + Math.sin(t) * 2.2), K.gun, 2); }   // coil burners
    V.box(0, 14, 0, 15, 19, 2, c, 1); for (const x of [2, 5, 9, 12]) V.box(x, 16, 2, x + 1, 17, 3, K.ink); V.box(6, 17, 2, 9, 18, 3, K.lime, LIT);   // backguard, knobs, the clock
    V.box(1, 2, 13, 14, 11, 14, c, 1); V.box(3, 4, 13, 12, 8, 14, K.ink); V.box(4, 5, 13, 7, 7, 14, K.glassHi, 1); V.box(2, 10, 14, 13, 11, 15, K.chrome, 2);   // oven door
  } });

export const counterSink = def({ id: 'counter-sink', name: 'Sink counter', cat: 'kitchen', place: 'floor', foot: [6, 3], h: 1.0, tops: [0.7],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['kitchen'], variants: 2, vnames: ['oak + white top', 'white + black top'], far: true,
  build(V, { variant = 0 } = {}) {
    const cab = pick([K.oak, K.white], variant), top = pick([K.white, 0x2a2a31], variant);
    V.box(0, 0, 0, 30, 1, 12, K.ink); V.box(0, 1, 0, 30, 13, 14, cab);
    for (const [x0, x1] of [[1, 9], [10, 20], [21, 29]]) { V.box(x0, 2, 14 - 1, x1, 12, 14, shade(cab, .92)); V.set(x0 === 10 ? 14 : x1 - 2, 10, 14 - 1, K.gold, 2); }
    V.box(0, 13, 0, 30, 14, 15, top); V.box(0, 14, 0, 30, 16, 1, top);                                          // counter (0.7), splash
    V.box(10, 11, 4, 20, 14, 11, K.chrome, 2); V.clear(11, 12, 5, 19, 14, 10);                                  // the basin
    V.box(14, 14, 1, 16, 19, 3, K.chrome, 2); V.box(14, 18, 3, 16, 19, 7, K.chrome, 2); V.box(14, 17, 6, 16, 18, 7, K.chrome, 2);   // gooseneck
    V.box(22, 14, 3, 24, 18, 5, K.lime, 1); V.box(22, 18, 3, 23, 19, 4, K.white);                                // dish soap
    for (let y = 14; y < 17; y++) V.box(4, y, 5, 8, y + 1, 10, K.white);                                        // a stack of plates
  } });

export const barBack = def({ id: 'bar-home', name: 'Home bar', cat: 'kitchen', place: 'floor', foot: [8, 3], h: 1.5, tops: [0.95],
  tiers: ['penthouse', 'house'], tags: ['bar', 'designer', 'bottles'], variants: 2, vnames: ['black + gold', 'walnut + brass'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const body = pick([0x2a2a31, K.walnut], variant), back = pick([K.pink, K.amber], variant), r = rng(seed * 3 + 11);
    V.box(0, 0, 0, 40, 18, 13, body); V.box(0, 1, 13, 40, 18, 14, (x) => (x % 2 ? shade(body, .75) : body));  // the counter, a ribbed front
    V.box(1, 2, 14, 39, 3, 15, K.gold, 2); for (const x of [2, 20, 37]) V.box(x, 1, 13, x + 1, 3, 14, K.gold, 2);   // brass foot rail
    V.box(0, 18, 0, 40, 19, 15, (x, y, z) => (hash(x, z, 3) > .9 ? 0xb9b9c0 : K.white));                          // marble top (0.95)
    V.box(2, 19, 0, 38, 30, 2, back, glow()); V.box(1, 19, 0, 2, 30, 4, body); V.box(38, 19, 0, 39, 30, 4, body); V.box(1, 29, 0, 39, 30, 4, body);   // lit back panel in its frame
    for (const y of [19, 24]) { V.box(2, y, 2, 38, y + 1, 4, K.gold, 2);
      for (let x = 3; x < 37; x += 2 + ((r() * 2) | 0)) { const hh = 3 + ((r() * 2) | 0), c = pick([0x8a4a14, 0x2f7a3a, K.glass, 0xb0281a, K.amber], (r() * 5) | 0); V.box(x, y + 1, 2, x + 1, y + 1 + hh, 3, c, 1); V.set(x, y + 1 + hh, 2, K.gold, 2); } }
    for (const x of [6, 9, 30]) { V.box(x, 19, 8, x + 1, 20, 9, K.glass, 1); V.box(x, 20, 8, x + 1, 22, 9, K.glass, 1); }   // glasses on the bar
  } });

// ── bath
export const toilet = def({ id: 'toilet', name: 'Toilet', cat: 'bath', place: 'floor', foot: [2, 3], h: 0.8, seat: 0.4,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['bathroom'], variants: 2, vnames: ['white', 'black'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.white, 0x2a2a31], variant), seat = pick([K.white, 0x2a2a31], variant);
    V.box(1, 8, 0, 9, 15, 4, c, 1); V.box(0, 15, 0, 10, 16, 5, c, 1); V.box(1, 13, 4, 3, 14, 5, K.chrome, 2);    // tank, lid, flush lever
    V.box(3, 0, 4, 7, 5, 11, c, 1);                                                                             // the pedestal
    for (let z = 3; z < 15; z++) { const w = z < 11 ? 4.5 : Math.sqrt(Math.max(0, 20.25 - (z - 11) ** 2 * 1.2)); V.box(Math.round(5 - w), 5, z, Math.round(5 + w), 8, z + 1, c, 1); }   // the bowl
    V.box(2, 7, 6, 8, 8, 13, K.water, 1); V.box(1, 8, 4, 9, 9, 14, seat, 1); V.box(3, 8, 6, 7, 9, 12, -1);     // water, the seat
    V.box(1, 9, 4, 9, 14, 5, seat, 1);                                                                          // the lid, up
  } });

export const bathtub = def({ id: 'bathtub', name: 'Bathtub', cat: 'bath', place: 'floor', foot: [3, 7], h: 0.55,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['bathroom', 'rubber duck'], variants: 2, vnames: ['clawfoot', 'cobalt tile'], far: true,
  build(V, { variant = 0 } = {}) {
    if (variant === 0) { for (const [x, z] of [[1, 2], [12, 2], [1, 31], [12, 31]]) V.box(x, 0, z, x + 2, 2, z + 2, K.gold, 2);
      for (let z = 0; z < 35; z++) { const e = Math.min(z, 34 - z), w = e < 3 ? 7.5 - (3 - e) * .9 : 7.5; V.box(Math.round(7.5 - w), 2, z, Math.round(7.5 + w), 11, z + 1, K.white, 1); } }
    else V.box(0, 0, 0, 15, 11, 35, (x, y, z) => (y % 3 === 0 || (x + z) % 3 === 0) ? K.white : K.cobalt);
    V.box(2, 4, 2, 13, 11, 33, -1); V.box(2, 4, 2, 13, 7, 33, K.water, 1);                                       // hollow, the water
    V.box(6, 7, 26, 9, 9, 29, K.yellow); V.box(7, 9, 27, 9, 10, 29, K.yellow); V.set(9, 9, 28, K.orange);         // the duck
    V.box(7, 9, 1, 9, 11, 3, K.chrome, 2);                                                                       // the tap
  } });

export const LIVING = [couchHouse, recliner, futon, chairPuffer, sofaLow, beanbag, stoolBar, bedDouble, mattressFloor, bedPlatform,
  tableCoffee, desk, tableEnd, crateShelf, dresser, lampTable, lampArc, lavaLamp, neonSign, ceilingFan, plantMonstera, plantCactus,
  fridge, stove, counterSink, barBack, toilet, bathtub];
