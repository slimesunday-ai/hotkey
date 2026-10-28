// Home objects · catalogue v2 · collector culture: designer-vinyl figures (invented characters: BRIKK, NOBODY, DICEHEAD, SLUGGO and a
// blind-box series), a sneaker tower, a graded chase card, a chain bust, a watch box, a fitted-cap wall, art decks, a framed jersey
// and a lowrider bike. Every character, brand and graphic is invented; no real toy, shoe, watch, cap or team design.
import { def, K, pick, cyl, cylZ, line, LIT, shade, rng, hash, txt, M3, M5, face, sneaker } from './lib.js';
import { flex, vinylHead, plinth, cushion } from './bits.js';

export const vinylBrikk = def({ id: 'vinyl-brikk', name: 'BRIKK 1000% figure', cat: 'collectibles', place: 'floor', foot: [3, 3], h: 1.1,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['vinyl toys', 'designer toy', 'statement'], variants: 3, vnames: ['red brick', 'chrome', 'gold'], far: true,
  game: flex('epic', 30, 'drop'),
  build(V, { variant = 0 } = {}) {
    const [hd, mort, top, pants, l] = pick([[K.brick, K.cream, K.ink, K.cobalt, 0], [K.chrome, K.steelD, K.pink, K.ink, 2], [K.gold, shade(K.gold, .7), K.white, K.ink, 2]], variant);
    plinth(V, 1, 1, 14, 14, 3, K.ink);
    for (const x of [3, 8]) { V.box(x, 3, 5, x + 4, 5, 11, K.white); V.box(x, 4, 5, x + 4, 5, 9, hd === K.brick ? K.red : top, l); }     // sneakers
    for (const x of [4, 8]) V.box(x, 5, 6, x + 3, 8, 10, pants);                                                                            // legs
    V.box(3, 8, 5, 12, 12, 10, top); V.box(4, 8, 10, 7, 10, 11, shade(top, .8)); V.box(8, 8, 10, 11, 10, 11, shade(top, .8));               // the hoodie, hands in its pocket
    V.box(1, 12, 3, 14, 22, 13, (x, y, z) => (y % 3 === 0 || (x + ((y / 3 | 0) & 1) * 2) % 4 === 0) ? mort : hd, l);                         // the brick head
    for (const x of [3, 9]) { V.box(x, 15, 13, x + 3, 19, 14, K.white, 1); V.box(x + 1, 15, 13, x + 3, 17, 14, K.ink); }                   // side-eye
    V.box(5, 13, 13, 10, 14, 14, K.ink); V.set(8, 13, 13, K.gold, 2);                                                                       // flat mouth, one gold tooth
  } });

export const vinylNobody = def({ id: 'vinyl-nobody', name: 'NOBODY figure', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.5,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vinyl toys', 'hoodie', 'designer toy'], variants: 3, vnames: ['black, cyan eyes', 'pink, white eyes', 'olive, lime eyes'],
  game: flex('rare', 10, 'drop'),
  build(V, { variant = 0 } = {}) {
    const [c, eye] = pick([[0x26262c, K.cyan], [K.pink, K.white], [0x5a6a3a, K.lime]], variant);
    V.box(1, 0, 1, 9, 1, 9, K.glass, 1);                                                                                                   // a clear base
    for (const x of [3, 6]) V.box(x, 1, 4, x + 2, 3, 7, K.ink);                                                                             // legs
    V.box(2, 3, 3, 8, 6, 8, c); V.box(1, 6, 2, 9, 10, 9, c); V.box(3, 6, 8, 7, 9, 9, K.ink);                                                // body, the hood, its void
    V.set(4, 7, 8, eye, LIT); V.set(6, 7, 8, eye, LIT);                                                                                    // eyes in the dark
    V.box(3, 5, 8, 7, 6, 9, K.gold, 2); V.set(5, 4, 8, K.gold, 2);                                                                         // a chain, its pendant
  } });

export const vinylDicehead = def({ id: 'vinyl-dicehead', name: 'DICEHEAD figure', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.55,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['vinyl toys', 'dice', 'designer toy'], variants: 3, vnames: ['white + red, navy suit', 'black + gold, white suit', 'pink + white, lime suit'],
  game: flex('rare', 10, 'drop'),
  build(V, { variant = 0 } = {}) {
    const [die, pip, suit] = pick([[K.white, K.red, K.navy], [0x1f1f24, K.gold, K.white], [K.pink, K.white, K.lime]], variant);
    V.box(1, 0, 1, 9, 1, 9, K.ink); for (const x of [3, 5]) V.box(x, 1, 4, x + 2, 2, 7, K.ink);                                            // base, shoes
    V.box(3, 2, 3, 7, 4, 7, suit); V.box(4, 2, 7, 6, 4, 8, suit); V.set(5, 3, 7, K.red); V.set(5, 2, 7, K.red);                             // the suit, a red tie
    V.box(2, 4, 2, 8, 10, 8, die, 1);                                                                                                      // the die head, 6 cubes
    for (const [x, y] of [[3, 5], [6, 5], [3, 8], [6, 8], [4, 6], [5, 7]]) V.set(x, y, 8, pip, pip === K.gold ? 2 : 0);                      // six on the front
    V.set(5, 10, 5, pip); V.set(4, 10, 4, pip); for (const [y, z] of [[5, 3], [8, 6], [6, 5]]) V.set(8, y, z, pip);                         // one-ish on top, three on the side
  } });

export const vinylSluggo = def({ id: 'vinyl-sluggo', name: 'SLUGGO figure', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.4,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vinyl toys', 'bucket hat', 'designer toy'], variants: 3, vnames: ['lime, pink hat', 'purple, yellow hat', 'orange, cobalt hat'],
  game: flex('common', 6, 'drop'),
  build(V, { variant = 0 } = {}) {
    const [c, hat] = pick([[K.lime, K.pink], [K.purple, K.yellow], [K.orange, K.cobalt]], variant);
    V.box(2, 0, 1, 8, 2, 7, c, 1); V.box(3, 2, 1, 7, 3, 4, c, 1); V.box(3, 0, 7, 7, 1, 9, c, 1);                                           // the body, a trail of a tail… front at +z
    V.box(2, 2, 5, 8, 5, 9, c, 1);                                                                                                        // the head, raised
    V.set(3, 4, 9, K.white); V.set(6, 4, 9, K.white); V.set(4, 4, 9, K.ink); V.set(5, 4, 9, K.ink); V.box(4, 3, 9, 6, 3 + 0, 10, K.ink);    // eyes looking inward
    V.set(4, 2, 9, K.ink); V.set(5, 2, 9, K.gold, 2);                                                                                      // a grin, a gold tooth
    V.box(1, 5, 4, 9, 6, 10, hat); V.box(2, 6, 5, 8, 8, 9, hat); V.box(2, 6, 8, 8, 7, 9, shade(hat, .8));                                   // the bucket hat: brim, crown, band
  } });

export const blindboxWall = def({ id: 'blindbox-wall', name: 'Blind-box wall', cat: 'collectibles', place: 'wall', foot: [6, 5], h: 0.25, mount: 1.0,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['vinyl toys', 'blind boxes', 'series'], variants: 2, vnames: ['white shelves', 'black shelves'],
  game: flex('rare', 12, 'drop'),
  build(V, { variant = 0, seed = 1 } = {}) {
    const sh = pick([K.white, 0x1f1f24], variant), r = rng(seed * 17 + 9);
    for (const y of [0, 7, 14]) V.box(0, y, 0, 30, y + 1, 5, sh); for (const x of [0, 29]) V.box(x, 0, 0, x + 1, 19, 5, sh);               // shelves, sides
    V.box(1, 19, 0, 29, 25, 1, K.ink); txt(V, M3('BLIND'), 6, 23, 1, K.yellow, LIT); txt(V, M3('1'), 23, 23, 1, K.pink, LIT);              // the header, lit
    for (const y of [1, 8, 15]) for (let k = 0; k < 5; k++) { const x = 2 + k * 5 + (k > 2 ? 1 : 0), c = pick([K.red, K.cobalt, K.yellow, K.pink, K.teal, K.orange, K.purple], (r() * 7) | 0);
      if (r() < .35) { V.box(x + 1, y, 1, x + 3, y + 2, 3, c); vinylHead(V, x, y + 2, 0, 4, 4, 4, pick([K.white, K.skin[1], K.lime, K.pink], (r() * 4) | 0)); }   // opened: the figure
      else { V.box(x, y, 0, x + 4, y + 5, 3, c); V.box(x, y + 3, 3, x + 4, y + 4, 4, K.white); V.set(x + 1, y + 1, 3, K.white); } }       // sealed: the box, its band, a sticker
  } });

export const sneakerRack = def({ id: 'sneaker-rack', name: 'Sneaker tower', cat: 'collectibles', place: 'floor', foot: [3, 2], h: 1.8, tops: [1.8],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['sneakers', 'hypebeast', 'tower'], variants: 3, vnames: ['chrome + acrylic', 'black', 'walnut'], far: true,
  game: flex('epic', 25),
  build(V, { variant = 0, seed = 1 } = {}) {
    const [post, shelf, l, ls] = pick([[K.chrome, K.glass, 2, 1], [0x1f1f24, 0x2a2a31, 0, 0], [K.walnut, K.oak, 0, 0]], variant), r = rng(seed * 23 + 1);
    const KK = [[K.white, K.red, K.white], [K.ink, K.pink, K.white], [K.cobalt, K.yellow, 0xc98a4b], [0x5fd35a, K.ink, K.white], [K.orange, K.cobalt, K.white], [K.red, K.ink, K.ink], [K.purple, K.lime, K.white], [K.gold, K.gold, K.gold], [K.sky, K.white, K.white], [K.bone, K.orange, 0xc98a4b]];
    for (const x of [0, 14]) for (const z of [0, 9]) V.box(x, 0, z, x + 1, 36, z + 1, post, l);
    for (let y = 0; y < 36; y += 6) { V.box(0, y, 0, 15, y + 1, 10, shelf, ls); if (y < 35) { const [a, b, s] = KK[(r() * KK.length) | 0], G = a === K.gold;
      sneaker(V, 3, y + 1, 2, a, b, s, false, 3); sneaker(V, 4, y + 1, 5, a, b, s, false, 3);
      if (G) for (let x = 3; x < 12; x++) for (let yy = y + 1; yy < y + 5; yy++) for (let z = 2; z < 8; z++) { const i = x + z * V.nx + yy * V.sxz; if (V.d[i]) V.set(x, yy, z, K.gold, 2); } } }
    V.box(0, 35, 0, 15, 36, 10, post, l);
  } });

export const cardSlab = def({ id: 'card-slab', name: 'Chase card slab', cat: 'collectibles', place: 'surface', foot: [1, 1], h: 0.35,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['cards', 'graded', 'chase'], variants: 3, vnames: ['holo, red label', 'gold, gold label', 'black label'],
  game: flex('grail', 35, 'drop'),
  build(V, { variant = 0 } = {}) {
    const lab = pick([K.red, K.gold, 0x1f1f24], variant);
    V.box(0, 0, 1, 5, 1, 5, K.ink); V.box(2, 1, 1, 3, 4, 2, K.ink);                                                                         // the stand, its brace
    V.box(0, 1, 2, 5, 7, 3, K.glass, 1); V.box(1, 5, 2, 4, 7, 3, lab, variant === 1 ? 2 : 0); V.set(3, 6, 2, variant === 2 ? K.gold : K.white);   // the slab, its grade label
    for (let x = 1; x < 4; x++) for (let y = 1; y < 5; y++) V.set(x, y, 2, variant === 1 ? K.gold : pick([K.pink, K.yellow, K.cyan, K.lime, K.violet], x + y), variant === 1 ? 2 : LIT);   // the holo card
  } });

export const chainBust = def({ id: 'chain-bust', name: 'Chain on a bust', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.6,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['chain', 'jewellery', 'flex'], variants: 3, vnames: ['gold cuban, $ piece', 'iced tennis, skull piece', 'rose gold rope, dice piece'],
  game: flex('epic', 30),
  build(V, { variant = 0 } = {}) {
    const m = pick([K.gold, K.chrome, 0xe8a0a0], variant), vel = 0x1f1f24;
    V.box(1, 0, 1, 9, 2, 9, K.white, 1); V.box(4, 2, 4, 6, 4, 6, K.white, 1);                                                              // a marble foot
    V.box(1, 4, 3, 9, 8, 8, vel); V.box(4, 8, 4, 7, 12, 7, vel);                                                                            // shoulders, the neck
    for (let x = 1; x < 9; x++) { const y = 7 - Math.round(Math.sin((x - .5) / 8 * Math.PI) * 2.4); V.box(x, y, 8, x + 1, y + 2, 9, m, 2); if (variant === 1 && x & 1) V.set(x, y + 1, 8, K.cyan, 2); }   // the drape
    for (const x of [1, 8]) V.box(x, 7, 3, x + 1, 8, 8, m, 2);                                                                              // over the shoulders
    if (variant === 0) { V.box(3, 1, 8, 7, 5, 9, m, 2); V.box(4, 2, 8, 6, 4, 9, shade(m, .75), 2); V.set(5, 4, 9, m, 2); V.set(4, 2, 9, m, 2); }   // a $ slab
    if (variant === 1) { V.box(3, 1, 8, 7, 5, 9, K.white, 1); V.set(4, 3, 8, K.ink); V.set(6, 3, 8, K.ink); V.set(4, 1, 8, K.ink); V.set(6, 1, 8, K.ink); V.set(4, 3, 9, K.cyan, 2); }   // a skull
    if (variant === 2) { V.box(3, 1, 8, 7, 5, 9, K.white, 1); for (const [x, y] of [[3, 4], [6, 1], [4, 2], [5, 3]]) V.set(x, y, 9 - 1, K.red); }   // a die
  } });

export const watchBox = def({ id: 'watch-box', name: 'Watch box', cat: 'collectibles', place: 'surface', foot: [3, 2], h: 0.3,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['watches', 'jewellery', 'flex'], variants: 3, vnames: ['walnut', 'black lacquer', 'white'],
  game: flex('epic', 25),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.walnut, 0x1f1f24, K.white], variant), r = rng(seed * 29 + 5);
    V.box(0, 0, 2, 15, 3, 10, c, 1); V.box(1, 1, 3, 14, 3, 9, -1); V.box(1, 1, 3, 14, 2, 9, K.cream);                                       // the box, its satin
    V.box(0, 0, 0, 15, 6, 2, c, 1); V.box(1, 1, 1, 14, 5, 2, K.cream);                                                                      // the lid, standing open
    for (let k = 0; k < 6; k++) { const x = 1 + (k % 3) * 5, z = 3 + (k / 3 | 0) * 3, band = pick([K.ink, K.oxblood, K.gold, K.chrome, K.navy, K.forest], (r() * 6) | 0), bz = pick([K.gold, K.chrome], k & 1);
      V.box(x, 2, z, x + 3, 3, z + 2, K.bone); V.box(x, 3 - 1 + 0, z, x + 3, 3, z + 1, band, band === K.gold || band === K.chrome ? 2 : 0);   // a pillow, the strap
      V.box(x, 3, z, x + 3, 4, z + 2, bz, 2); V.set(x + 1, 3, z + 1, pick([K.navy, K.forest, K.ink, K.white, K.cobalt], (r() * 5) | 0), 1); }   // the case, its dial
  } });

export const capWall = def({ id: 'cap-wall', name: 'Fitted-cap wall', cat: 'collectibles', place: 'wall', foot: [8, 4], h: 0.25, mount: 1.5,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['caps', 'streetwear', 'display'], variants: 2, vnames: ['mixed fitteds', 'all black, gold stickers'], far: true,
  game: flex('rare', 12),
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 41 + 3);
    for (const y of [1, 11]) for (let k = 0; k < 5; k++) { const x = 2 + k * 8, c = variant ? 0x1f1f24 : pick([K.red, K.navy, K.cobalt, K.ink, K.forest, K.orange, K.bone, K.purple, K.pink], (r() * 9) | 0), p = c === K.bone ? K.ink : pick([K.white, K.yellow, K.gold, K.cyan], (r() * 4) | 0);
      V.box(x, y + 2, 0, x + 6, y + 7, 4, c); V.del(x, y + 6, 3); V.del(x + 5, y + 6, 3); V.del(x, y + 6, 0); V.del(x + 5, y + 6, 0);         // the crown, its rounded top
      V.box(x, y + 1, 2, x + 6, y + 2, 5, shade(c, .85)); V.set(x + 4, y + 1, 4, K.gold, 2); V.set(x + 3, y + 7, 1, c);                     // the brim, its sticker, the button
      V.box(x + 2, y + 3, 4, x + 4, y + 5, 5, p); }                                                                                        // an embroidered patch
  } });

export const deckWall = def({ id: 'deck-wall', name: 'Skate deck wall', cat: 'collectibles', place: 'wall', foot: [6, 6], h: 0.15, mount: 0.9,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['skate', 'art', 'street'], variants: 2, vnames: ['flame · checker · big head', 'drip · tiger · money'], far: true,
  game: flex('rare', 15),
  build(V, { variant = 0, seed = 1 } = {}) {
    const G = variant ? [(i, j) => j > 20 - ((i * 5) % 7) ? K.pink : j > 18 - (i & 1) * 3 ? K.pink : K.ink, (i, j) => (((j + (i > 2 ? 2 : 0)) % 6) < 2) ? K.ink : K.orange, (i, j) => (j === 12 || i === 0 || i === 5) ? K.gold : K.cash]
      : [(i, j) => j < 7 - ((i * 3) % 4) ? (j < 3 ? K.yellow : K.orange) : (j > 15 && j < 21 && i > 0 && i < 5) ? (j === 18 && (i === 1 || i === 4) ? K.ink : K.white) : K.ink, (i, j) => (((i >> 1) + (j >> 1)) & 1) ? K.pink : K.white, (i, j) => K.cobalt];
    for (let k = 0; k < 3; k++) { const x0 = 2 + k * 10;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 26; j++) { if ((j < 2 || j > 23) && (i === 0 || i === 5)) continue; if ((j === 0 || j === 25) && (i === 1 || i === 4)) continue; V.set(x0 + i, 2 + j, 1, G[k](i, j)); }   // the deck, nose and tail rounded
      for (const y of [6, 22]) V.set(x0 + 2, y, 0, K.chrome, 2), V.set(x0 + 3, y, 0, K.chrome, 2);                                          // floating mounts
      V.box(x0, 2 + 12, 2, x0 + 6, 2 + 13, 3, variant ? K.white : K.steelL, 2); }                                                            // a truck bolt line
    if (!variant) face(V, 23, 10, 2, 6, 7, { skin: K.skin[4], hair: K.pink, cap: false });                                                   // the third deck's big head
    else for (let j = 0; j < 7; j++) V.set(24 + (j % 2), 12 + j, 2, K.ink);                                                                  // the money deck's serial
  } });

export const jerseyFrame = def({ id: 'jersey-frame', name: 'Framed jersey', cat: 'collectibles', place: 'wall', foot: [5, 6], h: 0.15, mount: 1.0,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['jersey', 'shadow box', 'signed'], variants: 3, vnames: ['red + white 00', 'cobalt + yellow 23', 'black + gold 01'], far: true,
  game: flex('rare', 15, 'drop'),
  build(V, { variant = 0 } = {}) {
    const [c, t, num, fr] = pick([[K.red, K.white, '00', K.ink], [K.cobalt, K.yellow, '23', K.white], [0x1f1f24, K.gold, '01', K.gold]], variant);
    V.box(0, 0, 0, 25, 30, 1, 0x1f1f24); for (const [a, b, cc, d] of [[0, 0, 25, 2], [0, 28, 25, 30], [0, 0, 2, 30], [23, 0, 25, 30]]) V.box(a, b, 0, cc, d, 3, fr, fr === K.gold ? 2 : 0);   // velvet back, the frame
    V.box(7, 4, 1, 18, 24, 2, c); V.box(3, 17, 1, 7, 24, 2, c); V.box(18, 17, 1, 22, 24, 2, c); V.box(3, 17, 1, 7, 18, 2, t); V.box(18, 17, 1, 22, 18, 2, t);   // body, sleeves, cuffs
    V.box(10, 22, 1, 15, 24, 2, 0x1f1f24); V.box(9, 23, 1, 10, 24, 2, t); V.box(15, 23, 1, 16, 24, 2, t); V.box(7, 4, 1, 18, 5, 2, t);      // the collar, the hem
    const M = M5(num); txt(V, M, 12 - (M.w >> 1), 18, 2, t);                                                                                // the number
    for (let x = 8; x < 17; x++) V.set(x, 8 + ((x * 3) % 4 === 0 ? 1 : 0), 2, K.ink);                                                       // a signature
  } });

export const lowrider = def({ id: 'lowrider-bike', name: 'Lowrider bike', cat: 'collectibles', place: 'floor', foot: [7, 2], h: 1.0,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['bike', 'chrome', 'custom'], variants: 3, vnames: ['candy red', 'candy purple', 'gold'],
  game: flex('epic', 25),
  build(V, { variant = 0 } = {}) {
    const fc = pick([K.red, K.purple, K.gold], variant), fl = variant === 2 ? 2 : 1;
    for (const cx of [7.5, 27.5]) { for (let x = 0; x < 35; x++) for (let y = 0; y < 16; y++) { const d = Math.hypot(x + .5 - cx, y + .5 - 7.5);   // wheels: tyre, white wall, chrome spokes, hub
        if (d <= 7.5 && d > 6.3) V.box(x, y, 3, x + 1, y + 1, 7, K.ink); else if (d <= 6.3 && d > 5.5) V.box(x, y, 4, x + 1, y + 1, 6, K.white); else if (d <= 5.5 && d > 4.8) V.set(x, y, 5, K.chrome, 2); }
      for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; line(V, cx - .5, 7, 5, cx - .5 + Math.cos(t) * 4.8, 7 + Math.sin(t) * 4.8, 5, K.chrome, 2); }
      cylZ(V, cx, 7.5, 1.3, 3, 7, K.chrome, 2); }
    const bar = (x0, y0, x1, y1, c = fc, l = fl) => { line(V, x0, y0, 4, x1, y1, 4, c, l); line(V, x0, y0, 5, x1, y1, 5, c, l); };
    bar(7, 7, 14, 12); bar(14, 12, 25, 12); bar(14, 12, 18, 7); bar(18, 7, 7, 7); bar(18, 7, 26, 11); bar(25, 12, 27, 7, K.chrome, 2);      // the candy frame, the fork
    for (let x = 16; x < 26; x += 2) bar(x, 12, x + 1, 13, K.chrome, 2);                                                                    // the twisted top bar
    bar(26, 12, 26, 18, K.chrome, 2); V.box(25, 18, 1, 27, 19, 9, K.chrome, 2); for (const z of [1, 8]) V.box(25, 15, z, 27, 18, z + 1, K.chrome, 2);   // ape hangers
    V.box(10, 13, 3, 19, 15, 7, K.white); V.box(10, 15, 3, 13, 16, 7, K.white); for (let x = 11; x < 19; x += 2) V.set(x, 14, 7, K.cream);  // the banana seat, tufted
    bar(12, 12, 12, 13, K.chrome, 2); bar(18, 7, 21, 1, K.chrome, 2); V.box(20, 0, 4, 23, 1, 6, K.chrome, 2);                               // seat post, kickstand
  } });

export const COLLECT2 = [vinylBrikk, vinylNobody, vinylDicehead, vinylSluggo, blindboxWall, sneakerRack, cardSlab, chainBust, watchBox, capWall, deckWall, jerseyFrame, lowrider];
