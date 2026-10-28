// Home objects · collector culture: the sneaker wall, sneaker boxes, graded slabs, vinyl toys in a case, a streetwear rack and the
// penthouse grails case. Sneakers and toys are invented silhouettes, colour-blocked, with no marks of any kind.
import { def, K, pick, cyl, line, glow, LIT, shade, mix, rng, hash, txt, M3, sneaker } from './lib.js';

const KICKS = [[K.white, K.red, K.white], [K.ink, K.pink, K.white], [K.cobalt, K.yellow, 0xc98a4b], [0x5fd35a, K.ink, K.white], [K.orange, K.cobalt, K.white],
  [K.white, K.teal, 0xc98a4b], [K.red, K.ink, K.ink], [K.purple, K.lime, K.white], [K.yellow, K.ink, K.white], [K.bone, K.orange, 0xc98a4b], [K.ink, K.gold, K.ink], [K.sky, K.white, K.white]];

export const sneakerWall = def({ id: 'sneaker-wall', name: 'Sneaker wall', cat: 'collectibles', place: 'wall', foot: [8, 6], h: 0.35, mount: 0.6,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['sneakers', 'hypebeast', 'display'], variants: 2, vnames: ['lit acrylic', 'oak pegs'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 11 + 7), shelf = variant ? K.oak : K.glass;
    for (let row = 0; row < 3; row++) { const y = row * 10;
      V.box(1, y, 0, 39, y + 1, 7, shelf, variant ? 0 : 1); for (const x of [2, 37]) V.box(x, y - (y ? 1 : 0), 0, x + 1, y + 1, 1, K.ink);   // shelf, brackets
      if (!variant) V.box(2, y, 6, 38, y + 1, 7, K.white, LIT);                                                     // the LED edge
      for (let k = 0; k < 4; k++) { const [a, b, s] = KICKS[(r() * KICKS.length) | 0]; sneaker(V, 2 + k * 9 + ((r() * 2) | 0), y + 1, 2, a, b, s, r() < .3, 3); } }
  } });

export const sneakerBoxes = def({ id: 'sneaker-boxes', name: 'Sneaker boxes', cat: 'collectibles', place: 'floor', foot: [3, 2], h: 1.2, tops: [1.2],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['sneakers', 'stack', 'hypebeast'], variants: 3, vnames: ['mixed', 'black + red', 'orange + white'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 19 + 3), P = pick([[[K.orange, K.white], [K.ink, K.red], [K.cobalt, K.white], [K.red, K.ink], [K.white, K.teal], [K.pink, K.ink]], [[K.ink, K.red], [K.red, K.ink]], [[K.orange, K.white], [K.white, K.orange]]], variant);
    for (let k = 0; k < 6; k++) { const [b, l] = pick(P, (r() * P.length) | 0), x = (r() * 3) | 0, y = k * 4;
      V.box(x, y, 1, x + 12, y + 3, 9, b); V.box(x, y + 3, 1, x + 12, y + 4, 9, l); V.box(x + 8, y + 1, 9 - 1, x + 11, y + 2, 9, K.white); V.set(x + 9, y + 1, 8, K.ink); }
  } });

export const cardDisplay = def({ id: 'card-display', name: 'Graded-card display', cat: 'collectibles', place: 'wall', foot: [4, 3], h: 0.1, mount: 1.2,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['cards', 'graded', 'collector'], variants: 2, vnames: ['black frame, red velvet', 'gold frame, black velvet'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const fr = pick([K.ink, K.gold], variant), vel = pick([K.oxblood, 0x1f1f24], variant), r = rng(seed * 5 + 1);
    V.box(0, 0, 0, 20, 15, 1, vel); V.box(0, 0, 0, 20, 1, 2, fr, variant); V.box(0, 14, 0, 20, 15, 2, fr, variant); V.box(0, 0, 0, 1, 15, 2, fr, variant); V.box(19, 0, 0, 20, 15, 2, fr, variant);
    for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) { const x0 = 2 + k * 4 + (k > 1 ? 1 : 0), y0 = 1 + row * 7;
      V.box(x0, y0, 1, x0 + 3, y0 + 6, 2, K.bone, 1); V.box(x0, y0 + 5, 1, x0 + 3, y0 + 6, 2, K.red); V.set(x0 + 2, y0 + 5, 1, K.white);   // the slab, its grade label
      V.box(x0 + 1, y0 + 1, 1, x0 + 2, y0 + 4, 2, pick([K.yellow, K.cyan, K.pink, K.lime, K.orange, K.purple], (r() * 6) | 0)); V.set(x0 + 1, y0 + 3, 1, pick(K.skin, (r() * 5) | 0)); }   // the card
  } });

// a vinyl figure, about 0.25 m tall, on a shelf at (x, y, z): the kinds are invented art toys
function figure(V, x, y, z, kind, c, c2) {
  if (kind === 0) { V.box(x + 1, y, z + 1, x + 3, y + 1, z + 2, K.ink); V.box(x, y + 1, z, x + 4, y + 3, z + 3, c);   // a mini agent: legs, top,
    V.box(x, y + 3, z, x + 4, y + 7, z + 4, c2); V.box(x, y + 6, z, x + 4, y + 7, z + 4, K.ink); V.set(x + 1, y + 4, z + 3, K.ink); V.set(x + 2, y + 4, z + 3, K.ink); return; }   // big head, hair, eyes
  if (kind === 1) { V.ell(x + 2, y + 2.5, z + 2, 2.4, 2.6, 2, K.cash, 1); V.box(x + 1, y + 5, z + 1, x + 3, y + 6, z + 3, K.gold, 2); V.box(x + 1, y + 6, z + 1, x + 3, y + 7, z + 3, K.cash, 1);   // a money-bag mascot
    V.set(x + 1, y + 3, z + 3, K.ink); V.set(x + 3, y + 3, z + 3, K.ink); V.set(x + 2, y + 1, z + 4, K.gold, 2); return; }
  if (kind === 2) { V.box(x, y, z, x + 4, y + 5, z + 4, K.white, 1); V.box(x + 1, y + 5, z + 1, x + 3, y + 6, z + 3, K.white, 1); for (const dx of [0, 2]) V.del(x + dx, y, z + 3);   // a drippy ghost
    V.box(x + 1, y + 3, z + 4, x + 2, y + 5, z + 5, K.ink); V.box(x + 3, y + 3, z + 4, x + 4, y + 5, z + 5, K.ink); V.set(x + 2, y + 1, z + 4, c); return; }
  if (kind === 3) { for (let j = 0; j < 6; j++) V.box(x + (j >> 1) - 0, y + j, z + 1, x + 4 - (j >> 2), y + j + 1, z + 3, j > 4 ? 0xc9782a : K.yellow);   // a pizza-slice guy
    V.set(x + 1, y + 2, z + 3, K.red); V.set(x + 3, y + 1, z + 3, K.red); V.set(x + 2, y + 4, z + 3, K.ink); V.set(x + 3, y + 4, z + 3, K.ink); return; }
  V.box(x, y, z, x + 4, y + 4, z + 4, K.white, 1); V.box(x, y + 4, z, x + 4, y + 5, z + 4, c2); for (const dx of [0, 2]) V.box(x + dx, y + 1, z + 4, x + dx + 2, y + 2, z + 5, K.gold, 2);   // a skull with a gold grill
  V.set(x + 1, y + 3, z + 4, K.ink); V.set(x + 3, y + 3, z + 4, K.ink);
}
export const toyCase = def({ id: 'toy-case', name: 'Vinyl toy case', cat: 'collectibles', place: 'floor', foot: [4, 2], h: 1.65,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['vinyl toys', 'figures', 'collector'], variants: 2, vnames: ['white', 'black'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const f = pick([K.white, 0x1f1f24], variant), r = rng(seed * 37 + 11);
    V.box(0, 0, 0, 20, 3, 10, f); V.box(0, 30, 0, 20, 33, 10, f); V.box(1, 29, 1, 19, 30, 9, K.cream, glow());       // plinth, top, the light under it
    for (const x of [0, 19]) for (const z of [0, 9]) V.box(x, 3, z, x + 1, 30, z + 1, f);                          // posts
    V.box(1, 3, 0, 19, 29, 1, 0x2a3350, 1);                                                                          // a dark mirrored back
    for (const y of [11, 20]) V.box(1, y, 1, 19, y + 1, 9, K.glass, 1);                                              // glass shelves
    for (const x of [1, 18]) line(V, x, 3, 9, x, 28, 9, K.glint, 1);                                                 // glass edge glints
    for (const y of [3, 12, 21]) for (let k = 0; k < 3; k++) figure(V, 2 + k * 6, y, 3, (r() * 5) | 0, pick([K.red, K.cobalt, K.orange, K.pink, K.teal], (r() * 5) | 0), pick(K.skin, (r() * 6) | 0));
  } });

export const streetwearRack = def({ id: 'streetwear-rack', name: 'Streetwear rack', cat: 'collectibles', place: 'floor', foot: [6, 2], h: 1.6,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['streetwear', 'hoodies', 'hypebeast'], variants: 2, vnames: ['chrome', 'black pipe'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const m = variant ? K.iron : K.chrome, l = variant ? 0 : 2, r = rng(seed * 43 + 9);
    for (const x of [1, 28]) { V.box(x, 0, 0, x + 1, 1, 10, m, l); V.box(x, 1, 4, x + 1, 31, 5, m, l); } V.box(1, 30, 4, 29, 31, 5, m, l);   // feet, uprights, rail
    let x = 3; while (x + 4 < 28) { const kind = (r() * 4) | 0, c = pick([K.red, K.ink, K.cobalt, K.bone, K.orange, K.grass, K.pink, 0x5a6a3a, K.purple, K.yellow], (r() * 10) | 0), len = [11, 13, 14, 13][kind], w = kind === 2 ? 4 : 3;
      V.set(x + 1, 29, 4, m, l); V.box(x, 28, 2, x + w, 29, 8, m, l);                                               // the hanger
      for (let y = 28 - len; y < 28; y++) { const edge = y > 25 ? 1 : 0; V.box(x, y, 1 + edge, x + w, y + 1, 9 - edge, kind === 2 && (y % 3 === 0) ? shade(c, .8) : c); }   // tee · hoodie · puffer · varsity
      if (kind === 1) V.box(x, 22, 0, x + w, 27, 2, c);                                                              // the hood
      if (kind === 3) V.box(x, 28 - len, 1, x + w, 28 - len + 2, 9, K.cream);                                         // a varsity's rib hem
      if (kind === 0 && r() < .5) V.box(x, 20, 1, x + w, 22, 9, K.white);                                            // a striped tee
      if (r() < .4) V.set(x + w - 1, 27 - len + 6, 9, K.white);                                                      // a price tag
      x += w + 1 + ((r() * 2) | 0); }
  } });

export const grailsCase = def({ id: 'grails-case', name: 'Grails case', cat: 'collectibles', place: 'floor', foot: [3, 3], h: 1.4,
  tiers: ['penthouse', 'house'], tags: ['grails', 'museum', 'collector'], variants: 3, vnames: ['gold sneaker', 'sealed TOASTR', 'iced chain'], far: true,
  build(V, { variant = 0 } = {}) {
    V.box(1, 0, 1, 14, 17, 14, K.white); V.box(1, 0, 1, 14, 1, 14, K.ink); V.box(5, 11, 14, 10, 13, 15, K.gold, 2);            // plinth, plaque
    for (const x of [1, 13]) for (const z of [1, 13]) V.box(x, 17, z, x + 1, 28, z + 1, K.gold, 2);                                  // vitrine edges
    V.box(1, 27, 1, 14, 28, 14, K.gold, 2); V.box(2, 26, 2, 13, 27, 13, K.cream, glow());                                          // lid, its light
    for (let k = 0; k < 9; k++) { V.set(2 + k, 18 + k, 13, K.glint, 1); V.set(3 + k, 18 + k, 13, K.glint, 1); }                                                             // the glass catching light
    if (variant === 0) { V.box(4, 17, 5, 11, 18, 10, K.ink); sneaker(V, 4, 18, 6, K.gold, K.gold, K.gold, false, 3); for (let x = 4; x < 12; x++) for (let y = 18; y < 22; y++) for (let z = 6; z < 9; z++) { const i = x + z * V.nx + y * V.sxz; if (V.d[i]) V.set(x, y, z, V.pal[V.d[i]], 2); } }
    if (variant === 1) { V.box(4, 17, 4, 11, 24, 10, K.red); V.box(4, 17, 10, 11, 24, 11, K.cream); V.box(5, 19, 10, 10, 22, 11, K.chrome, 2); V.box(6, 22, 10, 9, 23, 11, K.yellow); V.box(4, 24, 4, 11, 25, 11, K.glass, 1); }   // a sealed box
    if (variant === 2) { V.box(6, 17, 6, 9, 19, 9, K.ink); V.box(5, 19, 5, 10, 24, 9, 0x1f1f24); V.box(6, 24, 6, 9, 25, 8, 0x1f1f24);   // a velvet bust
      for (let x = 5; x < 10; x++) { const y = 23 - Math.round(Math.sin((x - 5) / 4 * Math.PI) * 2); V.set(x, y, 9, K.gold, 2); } V.box(7, 19, 9, 9, 21, 10, K.chrome, 2); V.set(7, 20, 10 - 1, K.cyan, LIT); V.set(8, 19, 9, K.glint, LIT); }
  } });

export const COLLECT = [sneakerWall, sneakerBoxes, cardDisplay, toyCase, streetwearRack, grailsCase];
