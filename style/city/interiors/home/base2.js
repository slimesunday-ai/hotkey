// Home objects · catalogue v2 · the base kit's missing pieces: a front door per tier, a window (blinds, tinfoil, a bedsheet, the city),
// the NYC radiator, a trailer kitchenette and a bookshelf. Base = no stakes: never stolen, no buff (kits.js lists who gets what).
import { def, K, pick, cyl, line, glow, LIT, shade, rng, hash, txt, M3 } from './lib.js';
import { base } from './bits.js';

export const doorFront = def({ id: 'door-front', name: 'Front door', cat: 'wall', place: 'wall', foot: [4, 9], h: 0.15, mount: 0,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['door', 'entry', 'kit'], variants: 4, vnames: ['trailer screen door', 'walk-up steel 4B', 'house panel door', 'penthouse walnut slab'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const cas = pick([K.white, K.bone, K.white, 0x1f1f24], variant); V.box(0, 0, 0, 20, 45, 1, cas); V.box(0, 0, 1, 1, 45, 2, cas); V.box(19, 0, 1, 20, 45, 2, cas); V.box(0, 44, 1, 20, 45, 2, cas);   // casing
    if (variant === 0) { V.box(1, 0, 1, 19, 44, 2, K.white); V.box(3, 20, 1, 17, 41, 2, (x, y) => (x + y) % 2 ? 0x8d929c : 0xa7a9b1); V.box(3, 2, 1, 17, 9, 2, K.steelL, 2);   // aluminium frame, mesh, kick plate
      V.box(16, 18, 2, 18, 20, 3, K.steelL, 2); return; }
    const c = pick([0, 0x3a3c44, K.white, K.walnut], variant); V.box(1, 0, 1, 19, 44, 2, c);
    if (variant === 1) { cyl(V, 10, 1.5, 1, 32, 33, K.gold); for (let x = 3; x < 17; x++) V.set(x, 38, 1, shade(c, .8)); txt(V, M3('4B'), 7, 37, 2, K.gold, 2); V.box(15, 19, 2, 17, 22, 3, K.gold, 2); V.box(4, 1, 2, 16, 2, 3, K.steelL, 2); }   // peephole, 4B, knob, a scuffed plate
    if (variant === 2) { for (const [x0, y0, x1, y1] of [[3, 25, 9, 41], [11, 25, 17, 41], [3, 4, 9, 21], [11, 4, 17, 21]]) { V.box(x0, y0, 2, x1, y1, 3, shade(c, .93)); V.box(x0 + 1, y0 + 1, 2, x1 - 1, y1 - 1, 3, -1); }
      V.box(15, 20, 2, 17, 22, 3, K.gold, 2); }
    if (variant === 3) V.box(15, 10, 2, 16, 34, 3, K.gold, 2);                                                                            // a long brass pull
  } });

export const windowPane = def({ id: 'window', name: 'Window', cat: 'wall', place: 'wall', foot: [5, 6], h: 0.2, mount: 0.9,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['window', 'light', 'kit'], variants: 4, vnames: ['bent blinds', 'tinfoil', 'bedsheet', 'the city at night'], far: true,
  game: base(),
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 11 + 2);
    V.box(0, 0, 0, 25, 30, 1, (x, y) => y > 18 ? K.glassHi : K.glassLo); V.box(0, 0, 1, 25, 30, 2, (x, y) => (x < 1 || x > 23 || y < 1 || y > 28 || x === 12) ? K.white : undefined);   // glass, the sash and mullion
    V.box(0, 0, 2, 25, 1, 4, K.white); V.set(18, 22, 0, K.glint);                                                                        // the sill
    if (variant === 0) { for (let y = 3; y < 29; y += 2) { const bent = y > 10 && y < 16, g0 = 7 + ((r() * 3) | 0); for (let x = 0; x < 25; x++) if (!(bent && x >= g0 && x < g0 + 4)) V.set(x, y, 2, K.bone); }
      V.box(1, 28, 2, 24, 30, 3, K.bone); line(V, 20, 28, 3, 20, 8, 3, K.white); }                                                      // bent blinds, the cord
    if (variant === 1) V.box(1, 1, 1, 24, 29, 2, (x, y) => hash(x >> 1, y >> 1, 4) > .7 ? K.white : hash(x, y, 5) > .5 ? K.steelL : K.chrome, 2);   // tinfoil taped over
    if (variant === 2) { V.box(0, 1, 2, 25, 29, 3, (x, y) => ((x >> 2) + (y >> 2)) & 1 ? K.red : K.navy); for (const x of [0, 12, 24]) V.set(x, 28, 3, K.steelD, 2); V.box(8, 1, 2, 14, 9, 3, -1); }   // a sheet tacked up, one corner pulled back
    if (variant === 3) for (let x = 1; x < 24; x++) { const h = 3 + ((hash(x >> 2, 1, 7) * 12) | 0); for (let y = 1; y < h; y++) V.set(x, y, 0, (x % 2 && y % 3 === 1 && hash(x, y, 2) > .5) ? K.amber : K.navy, (x % 2 && y % 3 === 1 && hash(x, y, 2) > .5) ? LIT : 0); }   // the skyline
  } });

export const radiator = def({ id: 'radiator', name: 'Radiator', cat: 'decor', place: 'floor', foot: [4, 1], h: 0.7, tops: [0.7],
  tiers: ['apartment', 'house'], tags: ['radiator', 'nyc', 'kit'], variants: 3, vnames: ['silver', 'cream', 'eight coats of white'],
  game: base(),
  build(V, { variant = 0 } = {}) {
    const c = pick([K.steelL, K.cream, K.white], variant), l = variant ? 0 : 2;
    for (let x = 1; x < 19; x += 2) V.box(x, 1, 1, x + 1, 13, 4, c, l); V.box(1, 1, 1, 19, 2, 4, shade(c, .9), l); V.box(1, 12, 1, 19, 14, 4, shade(c, .95), l);   // fins, the bottom and top headers
    for (const x of [1, 17]) V.box(x, 0, 1, x + 2, 1, 4, shade(c, .8), l); V.box(18, 3, 2, 20, 5, 3, K.steelD, 2); V.set(19, 5, 2, K.red);   // feet, the valve and its knob
  } });

export const kitchenette = def({ id: 'kitchenette', name: 'Trailer kitchenette', cat: 'kitchen', place: 'floor', foot: [6, 3], h: 1.0, tops: [0.9],
  tiers: ['trailer', 'apartment'], tags: ['kitchen', 'trailer', 'kit'], variants: 3, vnames: ['harvest gold', 'avocado', 'almond'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const c = pick([0xd9a21a, 0x7a8a2a, K.beige], variant), door = shade(c, .88);
    V.box(0, 0, 0, 30, 17, 14, c); V.box(0, 17, 0, 30, 18, 15, K.bone); V.box(0, 0, 13, 30, 1, 14, K.ink);                               // cabinets, the counter, a toe kick
    V.box(1, 1, 14, 10, 16, 15, K.white); V.box(8, 7, 15 - 1, 9, 12, 15, K.steelL, 2);                                                     // the mini fridge, its handle
    for (const x0 of [11, 20]) { V.box(x0, 2, 14, x0 + 8, 15, 15, door); V.set(x0 + 4, 12, 14, K.gold, 2); }                                 // cabinet doors
    V.box(3, 17, 3, 10, 18, 10, K.ink); for (const [cx, cz] of [[5, 5], [8, 8]]) { V.set(cx, 17, cz, K.steelD, 2); V.set(cx - 1, 17, cz, K.steelD, 2); }   // a two-burner cooktop
    V.box(19, 16, 3, 27, 18, 10, K.steelL, 2); V.box(20, 16, 4, 26, 17, 9, K.steelD, 2); V.box(22, 18, 2, 24, 20, 3, K.chrome, 2); V.box(22, 19, 3, 24, 20, 5, K.chrome, 2);   // the sink, its tap
    V.box(0, 17, 0, 30, 20, 1, c);                                                                                                       // a backsplash lip
  } });

export const bookshelf = def({ id: 'bookshelf', name: 'Bookshelf', cat: 'storage', place: 'floor', foot: [4, 2], h: 1.8, tops: [1.8],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['books', 'shelf', 'kit'], variants: 3, vnames: ['oak', 'walnut', 'white lacquer'], far: true,
  game: base(),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.oak, K.walnut, K.white], variant), r = rng(seed * 53 + 7);
    V.box(0, 0, 0, 20, 36, 1, shade(c, .85)); for (const x of [0, 19]) V.box(x, 0, 0, x + 1, 36, 9, c); for (const y of [0, 7, 14, 21, 28, 35]) V.box(0, y, 0, 20, y + 1, 9, c);   // back, sides, shelves
    for (const y of [1, 8, 15, 22, 29]) { let x = 1; while (x < 19) { const w = 1 + ((r() * 2) | 0), h = 4 + ((r() * 3) | 0); if (r() < .12) { x += 2; continue; }
      if (x + w > 19) break; V.box(x, y, 2, x + w, y + h, 8, pick([K.red, K.navy, K.forest, K.mustard, K.oxblood, K.cream, K.cobalt, K.ink, K.orange], (r() * 9) | 0)); x += w; } }
  } });

export const BASE2 = [doorFront, windowPane, radiator, kitchenette, bookshelf];
