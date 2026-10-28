// Home objects · catalogue v2 · the crime shelf: a gun rack and a wall of pieces, a gold knife in a case, brass knuckles on velvet,
// a money counter, cash stacks, a duffel, scales, a rolling tray, product in baggies, a burner drawer, a counterfeit press.
// Guns are toon odds items (OUTLINE §0.9): chunky invented shapes in candy colours, no real model, part or detail. The product is
// fictional (SUDO, TEMP, HALLU, §1.9): coloured crystals in baggies, no real drug and no real-world process.
import { def, K, pick, cyl, cylZ, line, LIT, shade, mix, rng, hash, txt, M3 } from './lib.js';
import { flex, g, pistol, rifle, cushion, vitrine, brick } from './bits.js';

const PIECES = [[K.gold, K.ink], [K.chrome, K.pink], [K.lime, K.ink], [K.pink, K.white], [K.ink, K.gold], [K.cyan, K.ink], [K.orange, K.ink], [K.purple, K.gold]];

export const gunRack = def({ id: 'gun-rack', name: 'Gun rack', cat: 'security', place: 'wall', foot: [8, 5], h: 0.25, mount: 1.0,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['guns', 'rack', 'crime'], variants: 3, vnames: ['walnut + chrome', 'black + gold', 'pink + lime'], far: true,
  game: flex('rare', 15),
  build(V, { variant = 0 } = {}) {
    const [board, peg] = pick([[K.walnut, K.chrome], [0x1f1f24, K.gold], [K.pink, K.lime]], variant);
    V.box(0, 0, 0, 40, 25, 1, board); V.box(0, 0, 1, 40, 1, 2, shade(board, .75)); V.box(0, 24, 1, 40, 25, 2, shade(board, .75));   // board, top and bottom rails
    const P = pick([[[K.chrome, K.walnut], [K.gold, K.ink], [K.ink, K.woodD]], [[K.gold, K.ink], [K.gold, K.oxblood], [K.chrome, K.ink]], [[K.lime, K.ink], [K.cyan, K.pink], [K.yellow, K.purple]]], variant);
    [[17, 0], [10, 1]].forEach(([y, k]) => { const x = 5, [c, c2] = P[k];
      for (const px of [x + 1, x + 25]) V.box(px, y + (px > x + 20 ? 1 : -1), 1, px + 1, y + (px > x + 20 ? 2 : 0), 4, peg, 2);   // pegs under the stock and the barrel
      rifle(V, x, y, 2, c, c2, 2, k === 1); });
    V.box(3, 2, 1, 37, 3, 5, peg, 2); for (const x of [4, 35]) V.box(x, 1, 1, x + 1, 2, 5, peg, 2);                                     // a pistol shelf
    pistol(V, 6, 3, 2, P[2][0], P[2][1], 2); pistol(V, 18, 3, 2, P[1][0], P[1][1], 2, true); pistol(V, 28, 3, 2, P[0][0], P[0][1], 2);
  } });

export const pieceWall = def({ id: 'piece-wall', name: 'Wall of pieces', cat: 'security', place: 'wall', foot: [10, 8], h: 0.15, mount: 0.5,
  tiers: ['house', 'penthouse'], tags: ['guns', 'pegboard', 'flex'], variants: 3, vnames: ['black pegboard', 'white gallery', 'safety orange'], far: true,
  game: flex('epic', 35),
  build(V, { variant = 0, seed = 1 } = {}) {
    const bd = pick([0x1f1f24, K.white, K.orange], variant), sil = shade(bd, variant === 1 ? .88 : 1.35), r = rng(seed * 31 + 5);
    V.box(0, 0, 0, 50, 40, 1, (x, y) => (x % 3 === 1 && y % 3 === 1) ? shade(bd, .6) : bd);                                                // the pegboard, its holes
    const put = (fn, x, y, w, h) => { V.box(x - 1, y - 1, 0, x + w + 1, y + h + 1, 1, sil); for (let k = 0; k < 2; k++) V.set(x + 2 + k * (w - 5), y + h, 1, K.steelL, 2); fn(); };   // the painted outline behind every piece, two hooks
    let k = 0; for (const y of [30, 20]) { const c = PIECES[(k++ + seed) % PIECES.length]; put(() => rifle(V, 4, y, 1, c[0], c[1], 1, y === 20), 4, y - 3, 30, 10);
      const c2 = PIECES[(k++ + seed) % PIECES.length]; put(() => pistol(V, 38, y, 1, c2[0], c2[1], 1), 38, y, 10, 7); }
    for (let i = 0; i < 4; i++) { const c = PIECES[(i * 3 + seed + ((r() * 2) | 0)) % PIECES.length]; put(() => pistol(V, 3 + i * 12, 6, 1, c[0], c[1], 1, i & 1), 3 + i * 12, 6, 10, 7); }
    V.box(15, 36, 1, 35, 39, 2, 0x2a3350, 1); txt(V, M3('HEAT'), 19, 38, 2, K.red, LIT);                                                    // a little neon over it
  } });

export const knifeCase = def({ id: 'knife-case', name: 'Gold knife in a case', cat: 'collectibles', place: 'surface', foot: [3, 2], h: 0.4,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['knife', 'gold', 'vitrine'], variants: 3, vnames: ['gold + pearl', 'gold + ruby', 'iced'],
  game: flex('grail', 45, 'drop'),
  build(V, { variant = 0 } = {}) {
    const [bl, hd] = pick([[K.gold, K.white], [K.gold, K.red], [K.chrome, K.cyan]], variant);
    V.box(0, 0, 0, 15, 2, 10, K.walnut); V.box(1, 2, 1, 14, 3, 9, K.oxblood); V.box(4, 1, 9, 11, 2, 10, K.gold, 2);                        // walnut base, velvet, a plate
    V.box(2, 3, 4, 6, 4, 6, hd, 1); V.box(2, 3, 4, 3, 4, 6, K.gold, 2); V.box(6, 3, 3, 7, 5, 7, K.gold, 2);                                  // the handle, pommel, guard
    for (let x = 7; x < 14; x++) V.box(x, 3, 4, x + 1, 4, x < 12 ? 6 : 5, bl, 2); V.box(7, 4, 5, 12, 5, 6, shade(bl, 1.15), 2);            // the blade, its spine
    vitrine(V, 0, 0, 15, 10, 2, 8);
  } });

export const knucklesVelvet = def({ id: 'knuckles-velvet', name: 'Knuckles on velvet', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['knuckles', 'brass', 'jewellery box'], variants: 3, vnames: ['brass', 'rose gold', 'iced'],
  game: flex('rare', 12),
  build(V, { variant = 0 } = {}) {
    const m = pick([K.gold, 0xe8a0a0, K.chrome], variant);
    V.box(0, 0, 1, 10, 2, 10, K.ink); V.box(1, 2, 2, 9, 3, 9, K.purple); V.box(0, 2, 0, 10, 6, 2, K.ink); V.box(1, 2, 1, 9, 5, 2, K.purple);   // the box, velvet, the lid standing open
    V.box(0, 3, 4, 10, 4, 8, m, 2); for (let k = 0; k < 4; k++) { V.box(1 + k * 2, 3, 5, 2 + k * 2, 4, 7, -1); V.set(1 + k * 2, 4, 7, variant === 2 ? K.cyan : m, 2); }   // four finger holes over the velvet, the knuckle points
  } });

export const moneyCounter = def({ id: 'money-counter', name: 'Money counter', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['cash', 'counter', 'dealer'], variants: 2, vnames: ['black', 'white'],
  game: flex('common', 6),
  build(V, { variant = 0 } = {}) {
    const b = pick([0x26262c, K.white], variant);
    V.box(0, 0, 1, 10, 4, 9, b); V.box(1, 4, 2, 9, 6, 7, b); V.box(2, 6, 2, 8, 7, 6, shade(b, .8));                                        // body, the hopper
    V.box(3, 7, 3, 7, 7 + 2, 5, K.cash); V.box(4, 7, 3, 5, 9, 5, K.white);                                                                  // a brick feeding in
    V.box(1, 1, 9, 9, 4, 10, 0x1a2a1a, LIT); for (const x of [2, 3, 5, 6, 7]) V.box(x, 2, 9, x + 1, 3, 10, K.lime, LIT);                                                  // the count
    V.box(2, 0, 9, 8, 1, 10, K.cash); V.box(1, 4, 7, 9, 5, 9, shade(b, .8));                                                               // the output tray
  } });

export const cashStack = def({ id: 'cash-stack', name: 'Cash stack', cat: 'collectibles', place: 'floor', foot: [3, 3], h: 0.65,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['cash', 'stack', 'flex'], variants: 2, vnames: ['pallet', 'with gold bars'], far: true,
  game: flex('epic', 30, 'loot'),
  build(V, { variant = 0 } = {}) {
    V.box(0, 0, 0, 15, 1, 15, K.oak); for (const z of [0, 7, 14]) V.box(0, 1, z, 15, 2, z + 1, K.oak); V.box(0, 2, 0, 15, 3, 15, K.ply);   // the pallet
    for (let y = 0; y < 5; y++) { const i = y, x0 = 1 + i, x1 = 14 - i; for (let x = x0; x + 4 <= x1; x += 4) for (let z = 1 + i; z + 3 <= 14 - i; z += 3) brick(V, x, 3 + y * 2, z, 4, 3, 2); }
    if (variant) for (const [x, z] of [[2, 12], [10, 12]]) { V.box(x, 3, z, x + 3, 5, z + 2, K.gold, 2); V.box(x, 5, z, x + 3, 6, z + 1, shade(K.gold, 1.1), 2); }
  } });

export const duffelCash = def({ id: 'duffel-cash', name: 'Duffel of cash', cat: 'collectibles', place: 'floor', foot: [4, 2], h: 0.35,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cash', 'duffel', 'heist'], variants: 3, vnames: ['black', 'red', 'camo'],
  game: flex('rare', 20, 'loot'),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = (x, y, z) => variant === 2 ? pick([0x4a5a2a, 0x6b7a3a, 0x3a2a1a, 0x8a8a5a], ((hash(x >> 1, (y + z) >> 1, 3) * 4) | 0)) : pick([0x26262c, K.red], variant);
    for (let x = 1; x < 19; x++) for (let y = 0; y < 6; y++) for (let z = 0; z < 10; z++) { const e = ((x + .5 - 10) / 9.2) ** 4 + ((y + .5 - 2) / 4.5) ** 2 + ((z + .5 - 5) / 5) ** 2; if (e <= 1) V.set(x, y, z, c(x, y, z)); }
    V.box(3, 3, 3, 17, 6, 7, -1); for (let x = 3; x < 17; x += 4) brick(V, x, 3, 3, 4, 4, 2); brick(V, 5, 5, 4, 4, 2, 1); brick(V, 10, 5, 3, 4, 3, 1);   // the open zip, bricks
    for (let x = 3; x < 17; x++) { V.set(x, 5, 2, K.gold, 2); V.set(x, 5, 7, K.gold, 2); }                                               // zipper teeth
    for (const x of [6, 13]) { V.box(x, 6, 2, x + 1, 7, 8, 0x1f1f24); }                                                                  // the handles
  } });

export const scaleDigital = def({ id: 'scale-digital', name: 'Digital scale', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['scale', 'dealer', 'product'], variants: 3, vnames: ['black', 'pink', 'gold'],
  game: flex('common', 3),
  build(V, { variant = 0 } = {}) {
    const b = pick([0x26262c, K.pink, K.gold], variant), l = variant === 2 ? 2 : 1;
    V.box(0, 0, 1, 10, 1, 10, b, l); V.box(1, 1, 1, 9, 2, 7, K.chrome, 2);                                                              // body, the steel pan
    V.box(1, 1, 7, 9, 2, 10, shade(b, .8), l); V.box(2, 1, 8, 6, 2, 9, 0x1a2a1a, LIT); V.set(3, 1, 8, K.cyan, LIT); V.set(5, 1, 8, K.cyan, LIT);   // the readout
    V.set(7, 1, 8, K.white); V.set(8, 1, 8, K.white);                                                                                    // buttons
    V.box(3, 2, 2, 7, 3, 5, K.glass, 1); V.box(4, 2, 3, 6, 3, 5, K.lime, 1); V.box(3, 2, 2, 7, 3, 3, K.red);                                // a baggie on the pan, its red seal
  } });

export const rollingTray = def({ id: 'rolling-tray', name: 'Rolling tray', cat: 'collectibles', place: 'surface', foot: [3, 2], h: 0.2,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['papers', 'tray', 'stoner'], variants: 3, vnames: ['flame', 'checker', 'gold'],
  game: flex('common', 4),
  build(V, { variant = 0 } = {}) {
    const art = (x, z) => variant === 0 ? ((z > 2 + ((x * 3) % 5) ? K.ink : x % 4 < 2 ? K.orange : K.yellow)) : variant === 1 ? ((((x >> 1) + (z >> 1)) & 1) ? K.pink : K.white) : K.gold;
    V.box(0, 0, 0, 15, 1, 10, (x, y, z) => art(x, z), variant === 2 ? 2 : 1); V.box(0, 1, 0, 15, 2, 1, K.ink); V.box(0, 1, 9, 15, 2, 10, K.ink); V.box(0, 1, 0, 1, 2, 10, K.ink); V.box(14, 1, 0, 15, 2, 10, K.ink);   // tray, rim
    V.box(2, 1, 2, 6, 2, 5, K.white); V.box(2, 1, 2, 6, 2, 3, K.cobalt); V.box(3, 1, 3, 5, 2, 4, K.orange);                                 // the papers booklet (invented cover)
    V.box(7, 1, 6, 12, 2, 7, K.white); V.set(12, 1, 6, K.orange); V.box(3, 1, 7, 5, 2, 8, K.buff);                                        // a rolled one, a filter tip, a crutch
    cyl(V, 10.5, 3.5, 1.6, 1, 3, K.chrome); V.box(9, 3, 3, 12, 4, 4, K.lime);                                                               // a grinder, its lid
    V.box(12, 1, 7, 13, 2, 9, K.red); V.set(12, 1, 7, K.steelL, 2);                                                                        // a lighter
  } });

export const baggies = def({ id: 'baggies-product', name: 'Product in baggies', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['product', 'baggies', 'dealer'], variants: 3, vnames: ['SUDO lime', 'TEMP pink', 'HALLU cyan'],
  game: flex('common', 5, 'craft'),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.lime, K.pink, K.cyan], variant), r = rng(seed * 7 + 3);
    V.box(0, 0, 0, 10, 1, 10, K.white, 1); V.box(0, 1, 0, 10, 3, 1, K.white, 1); V.box(0, 1, 9, 10, 3, 10, K.white, 1); V.box(0, 1, 0, 1, 3, 10, K.white, 1); V.box(9, 1, 0, 10, 3, 10, K.white, 1);   // a deli tub
    for (let k = 0; k < 8; k++) { const x = 1 + (k % 4) * 2, z = 1 + (k >> 2) * 4 + ((r() * 2) | 0), y = 1 + ((r() * 2) | 0);                 // the baggies, piled
      V.box(x, 1, z, x + 2, y + 1, z + 3, K.glass, 1); V.box(x, y, z + 1, x + 2, y + 1, z + 3, c, LIT); V.box(x, y, z, x + 2, y + 1, z + 1, K.red); }
    V.box(3, 1, 3, 7, 3, 7, K.glass, 1); V.box(4, 2, 4, 6, 3, 6, c, LIT); V.set(5, 2, 3, K.ink);                                            // the one on top, its skull stamp
  } });

export const burnerDrawer = def({ id: 'burner-drawer', name: 'Burner drawer', cat: 'storage', place: 'floor', foot: [2, 3], h: 0.55, tops: [0.55],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['burners', 'phones', 'nightstand'], variants: 3, vnames: ['oak', 'black', 'white'],
  game: flex('common', 4),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.oak, 0x26262c, K.white], variant), r = rng(seed * 13 + 1);
    V.box(0, 0, 0, 10, 11, 9, c); V.box(1, 1, 9, 9, 5, 10, shade(c, .9)); V.set(5, 3, 10, K.gold, 2);                                     // the stand, a shut drawer
    V.box(1, 6, 9, 9, 10, 14, shade(c, .9)); V.box(2, 7, 9, 8, 10, 13, -1); V.box(2, 7, 9, 8, 8, 13, shade(c, .7)); V.set(5, 8, 14, K.gold, 2);   // the top drawer, pulled out
    for (let k = 0; k < 6; k++) { const x = 2 + (k % 3) * 2, z = 9 + ((k >> 1) & 1) * 2; V.box(x, 8, z, x + 2, 9, z + 2, pick([K.ink, K.red, K.cobalt, K.pink, K.lime, K.gun], (r() * 6) | 0)); }
    V.set(4, 9, 11, K.cyan, LIT); V.box(3, 9, 10, 5, 10, 11, K.ink);                                                                      // one flipped open, lit
  } });

export const counterfeitPress = def({ id: 'counterfeit-press', name: 'Counterfeit press', cat: 'collectibles', place: 'floor', foot: [4, 3], h: 1.1,
  tiers: ['house', 'penthouse'], tags: ['counterfeit', 'printing', 'crime'], variants: 2, vnames: ['racing green', 'fire red'], far: true,
  game: flex('rare', 15, 'craft'),
  build(V, { variant = 0 } = {}) {
    const c = pick([K.forest, K.red], variant);
    for (const x of [1, 17]) for (const z of [1, 12]) V.box(x, 0, z, x + 2, 10, z + 2, K.iron);                                           // legs
    V.box(0, 10, 0, 20, 13, 15, c); V.box(1, 13, 2, 19, 18, 12, c); V.box(0, 13, 12, 20, 14, 15, shade(c, .8));                           // body
    for (let z = 3; z < 12; z++) cylXish(V, 9, z); V.box(1, 18, 5, 19, 19, 9, K.gold, 2);                                                  // the ink roller, brass trim
    cyl(V, 15.5, 7.5, 3, 19, 20, K.chrome);                                                                                              // the crank wheel
    for (let y = 14; y < 16; y++) V.box(3, y, 13, 17, y + 1, 15, y & 1 ? K.cash : 0xffb3d0);                                                // sheets coming out
    for (let x = 4; x < 16; x += 4) { V.box(x, 16, 13, x + 3, 17, 15, K.cash); V.set(x + 1, 16, 14, K.white); }                            // cut bills
    V.box(3, 0, 3, 17, 2, 12, K.ply); for (let y = 2; y < 6; y++) V.box(4, y, 4, 16, y + 1, 11, y & 1 ? K.cash : K.cashD);                 // a stack on the shelf below
  } });
function cylXish(V, x0, z) { for (let x = x0 - 6; x < x0 + 8; x++) V.set(x, 18, z, K.ink); }

export const CRIME = [gunRack, pieceWall, knifeCase, knucklesVelvet, moneyCounter, cashStack, duffelCash, scaleDigital, rollingTray, baggies, burnerDrawer, counterfeitPress];
