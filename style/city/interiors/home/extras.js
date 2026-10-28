// Home objects · round 2 (the reviewer's gaps): the walk-up's window AC, a dining set, a wardrobe of hanging clothes, a medicine cabinet
// and the pedestal sink it hangs over, a fish tank (lit or dark via `states`).
import { def, K, SAFE, pick, cyl, LIT, glow, shade, mix, rng, hash } from './lib.js';

// the window AC in its window: frame, a deep sill, accordion panels, the lower sash down on the unit, a towel over the sill, the drip
export const acWindow = def({ id: 'ac-window', name: 'Window AC', cat: 'electronics', place: 'wall', foot: [4, 6], h: 0.45, mount: 0.65,
  tiers: ['trailer', 'apartment', 'house'], tags: ['walk-up', 'summer', 'drip'], variants: 3, vnames: ['white, red towel', 'putty, pink towel', 'grey, yellow towel'], far: true,
  build(V, { variant = 0 } = {}) {
    const ac = pick([0xe6e6ea, 0xd8cfb8, 0xb9bcc4], variant), acD = shade(ac, .8), tw = pick([K.red, K.pink, K.yellow], variant), tr = K.cream;
    V.box(0, 5, 0, 20, 30, 1, tr); V.box(1, 17, 0, 19, 29, 1, (x, y) => ((x + y) % 11 === 0 && x < 9) ? K.glint : y > 24 ? K.glassHi : K.glassLo, 1);   // frame, glass above the unit
    V.box(0, 5, 0, 20, 6, 8, tr); V.box(1, 15, 0, 19, 17, 2, tr);                                                     // the sill (0.9 m), the sash down on the unit
    for (const x0 of [1, 17]) V.box(x0, 6, 0, x0 + 2, 15, 1, (x) => (x & 1) ? K.white : K.pale);                     // accordion side panels
    V.box(3, 6, 0, 17, 15, 6, ac); V.box(3, 14, 0, 17, 15, 6, acD);                                                   // the unit, its lid
    for (let y = 7; y < 14; y++) V.box(4, y, 5, 12, y + 1, 6, (y & 1) ? acD : ac);                                    // louvres
    V.box(13, 7, 5, 16, 14, 6, acD); for (const y of [12, 10]) V.set(14, y, 6, K.ink); V.set(15, 8, 6, K.lime, LIT);  // two knobs, the power light
    V.box(5, 6, 6, 12, 7, 8, tw); V.box(5, 1, 8, 12, 7, 9, (x, y) => y === 3 ? K.white : tw);                         // a towel stuffed on the sill, hanging over
    V.box(13, 1, 8, 14, 6, 9, K.water, 1); V.box(13, 0, 8, 15, 1, 9, K.water, 1);                                      // the drip, off the sill's edge
  } });

// a dining table (top 0.6) with four chairs pushed in (seats 0.45)
export const diningSet = def({ id: 'dining-set', name: 'Dining table and chairs', cat: 'tables', place: 'floor', foot: [8, 6], h: 0.9, seat: 0.45, tops: [0.6],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['dinner', 'family', 'kitchen'], variants: 3, vnames: ['oak', 'chrome dinette', 'black + white'], far: true,
  build(V, { variant = 0 } = {}) {
    const [top, leg, seat, back, lm] = pick([[K.oak, K.woodD, K.oak, K.oak, 0], [0xf2efe6, K.chrome, K.red, K.red, 2], [0x1f1f24, 0x1f1f24, K.white, K.white, 1]], variant);
    const tl = variant === 1 ? 2 : lm === 1 ? 1 : 0;
    for (const x of [8, 31]) for (const z of [8, 21]) V.box(x, 0, z, x + 2, 11, z + 2, leg, tl);                    // table legs
    V.box(8, 10, 8, 33, 11, 23, leg, tl); V.box(7, 11, 7, 34, 12, 24, variant === 1 ? (x, y, z) => (x === 7 || x === 33 || z === 7 || z === 23) ? K.chrome : (hash(x, z, 3) > .88 ? pick([K.red, K.teal], x + z) : top) : top, variant === 1 ? 0 : lm);   // apron, top (0.6)
    const chair = (x0, z0, dir) => { const L = variant === 0 ? 0 : 2, lc = variant === 0 ? K.woodD : variant === 1 ? K.chrome : 0x1f1f24;
      for (const [a, b] of [[0, 0], [7, 0], [0, 7], [7, 7]]) V.box(x0 + a, 0, z0 + b, x0 + a + 1, 8, z0 + b + 1, lc, variant === 1 ? L : 0);
      V.box(x0, 8, z0, x0 + 8, 9, z0 + 8, seat, variant === 0 ? 0 : 1);
      const bk = { '+x': [x0, z0, x0 + 1, z0 + 8], '-x': [x0 + 7, z0, x0 + 8, z0 + 8], '+z': [x0, z0, x0 + 8, z0 + 1], '-z': [x0, z0 + 7, x0 + 8, z0 + 8] }[dir];
      V.box(bk[0], 9, bk[1], bk[2], 18, bk[3], variant === 0 ? (x, y, z) => (y > 15 || ((dir[1] === 'x' ? z : x) - (dir[1] === 'x' ? z0 : x0)) % 3 === 0) ? back : undefined : back, variant === 0 ? 0 : 1); };   // spindles on the oak ones
    chair(0, 11, '+x'); chair(32, 11, '-x'); chair(16, 0, '+z'); chair(16, 22, '-z');
    if (variant === 0) { cyl(V, 20.5, 15.5, 2.4, 12, 13, K.white, 1); V.set(19, 13, 15, K.orange); V.set(21, 13, 16, K.red); V.box(20, 13, 14, 22, 14, 15, K.yellow); }   // a fruit bowl
    if (variant === 2) { V.box(20, 12, 15, 21, 16, 16, 0x1f1f24, 1); V.set(20, 16, 15, K.pink); }                   // a vase, one flower
  } });

// a wardrobe: grown-up clothes on a rail (dresses, suits, coats, shirts), a shelf of sweaters and a hat box, shoes below. Open, its doors
// stand at 90° (the front cells are their swing): a mirror inside one, ties inside the other.
export const wardrobe = def({ id: 'wardrobe', name: 'Wardrobe', cat: 'storage', place: 'floor', foot: [5, 5], h: 1.9, tops: [1.9], states: ['open', 'closed'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['bedroom', 'clothes', 'closet'], variants: 3, vnames: ['oak', 'white', 'walnut'], far: true,
  build(V, { variant = 0, seed = 1, state = 'open' } = {}) {
    const c = pick([K.oak, K.white, K.walnut], variant), d = shade(c, .82), r = rng(seed * 71 + 5);
    V.box(0, 0, 0, 25, 2, 12, d); V.box(0, 2, 0, 25, 35, 1, c); V.box(0, 2, 0, 1, 35, 12, c); V.box(24, 2, 0, 25, 35, 12, c); V.box(0, 35, 0, 25, 38, 13, c); V.box(1, 2, 1, 24, 3, 12, d);   // plinth, back, sides, crown, floor
    if (state === 'closed') { V.box(1, 3, 11, 24, 35, 12, c); V.box(12, 3, 11, 13, 35, 12, d); for (const x of [11, 13]) V.box(x, 17, 12, x + 1, 21, 13, K.gold, 2); return; }
    V.box(1, 29, 5, 24, 30, 6, K.chrome, 2); V.box(1, 31, 1, 24, 32, 11, c);                                          // the rail, the hat shelf
    for (let k = 0; k < 3; k++) V.box(3, 32 + k, 3, 9, 33 + k, 9, pick([K.oxblood, K.cream, K.navy], k + seed));      // folded sweaters
    cyl(V, 18, 6, 3, 32, 35, K.red); cyl(V, 18, 6, 3.3, 34, 35, K.white);                                             // a hat box
    let x = 2; while (x < 22) { const kind = (r() * 5) | 0, col = pick([[K.white, K.sky, K.pink], [K.red, K.gold, 0x1f1f24, K.cobalt], [K.navy, 0x3a3c44, 0x5a3a2a], [0xc49a6c, 0x1f1f24, K.forest], [0x2a2a31, 0xb9a57a]][kind], (r() * 4) | 0), len = [11, 23, 14, 21, 9][kind];
      V.set(x, 29, 4, K.chrome, 2); V.set(x, 30, 5, K.chrome, 2);                                                     // the hook
      for (let y = 28 - len; y < 29; y++) { const w = y > 26 ? 1 : 0; V.box(x, y, 1 + w, x + 2, y + 1, 10 - w, kind === 1 && col === K.gold ? col : kind === 0 && y > 25 && (y & 1) ? shade(col, .85) : col, kind === 1 && col === K.gold ? 2 : 0); }   // shirt · dress · suit · coat · trousers
      if (kind === 2) V.box(x, 22, 9, x + 2, 28, 10, K.white);                                                        // a shirt under the suit
      x += 2 + ((r() * 2) | 0); }
    for (let k = 0; k < 4; k++) { const sx = 2 + k * 5 + ((r() * 2) | 0); V.box(sx, 3, 6, sx + 3, 4, 8, pick([K.red, 0x5a3418, K.white, 0x1f1f24], (r() * 4) | 0)); V.box(sx, 3, 8, sx + 3, 4, 10, pick([K.red, 0x5a3418, K.white, 0x1f1f24], k)); }   // shoes
    V.box(0, 3, 12, 2, 35, 24, c); V.box(1, 4, 13, 2, 34, 23, (x, y, z) => (y - z === 6 || y - z === 7) ? K.glint : 0x9fc8e8, 1);   // the left door, a mirror inside
    V.box(23, 3, 12, 25, 35, 24, c); V.box(22, 27, 13, 23, 28, 23, d); for (let z = 14; z < 23; z += 2) V.box(22, 20 + (z % 4), z, 23, 28, z + 1, pick([K.red, K.navy, K.gold, K.teal, K.pink], z));   // the right door, ties on it
  } });

// a medicine cabinet with its mirror door, a glass shelf under it (a cup, two toothbrushes, soap)
export const medicineCabinet = def({ id: 'medicine-cabinet', name: 'Medicine cabinet', cat: 'bath', place: 'wall', foot: [2, 3], h: 0.2, mount: 1.1,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['bathroom', 'mirror', 'over the sink'], variants: 2, vnames: ['white, bulbs', 'steel, cracked'],
  build(V, { variant = 0 } = {}) {
    const f = pick([K.white, K.steelL], variant), l = variant ? 2 : 1;
    V.box(1, 0, 0, 9, 1, 3, K.glass, 1); V.box(2, 1, 1, 4, 3, 3, K.white); V.set(2, 3, 2, K.cyan); V.set(3, 3, 2, K.pink); V.box(6, 1, 1, 8, 2, 3, K.pink);   // the glass shelf, cup, brushes, soap
    V.box(0, 3, 0, 10, 14, 2, f, l);                                                                                  // the cabinet
    V.box(1, 4, 2, 9, 13, 3, (x, y) => variant && ((x === 3 && y > 8) || (x === 4 && y > 5 && y <= 8) || (x === 5 && y <= 5)) ? K.white : (y - x === 5 || y - x === 6) ? K.glint : 0x9fc8e8, 1);   // the mirror (a crack in the steel one)
    V.set(8, 8, 3, K.chrome, 2);
    if (!variant) for (const x of [1, 4, 7]) V.box(x, 14, 0, x + 2, 15, 2, K.cream, glow());                         // the bulbs
  } });

export const sinkBath = def({ id: 'sink-bath', name: 'Pedestal sink', cat: 'bath', place: 'floor', foot: [2, 2], h: 0.85, tops: [0.8],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['bathroom', 'sink'], variants: 2, vnames: ['white', 'black'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.white, 0x2a2a31], variant);
    V.box(2, 0, 1, 8, 1, 7, c, 1); V.box(3, 1, 2, 7, 11, 6, c, 1);                                                    // foot, pedestal
    for (let z = 0; z < 10; z++) { const w = z < 6 ? 5 : Math.sqrt(Math.max(0, 25 - (z - 5) ** 2 * 1.6)); if (w >= 1) V.box(Math.round(5 - w), 11, z, Math.round(5 + w), 16, z + 1, c, 1); }   // the basin, a round front
    V.box(2, 13, 2, 8, 16, 8, -1); V.box(2, 12, 2, 8, 13, 8, 0xd6dde6, 1);                                            // hollow
    V.box(4, 15, 0, 6, 17, 2, K.chrome, 2); V.box(4, 16, 2, 6, 17, 4, K.chrome, 2);                                   // the faucet
  } });

// a fish tank on its stand. `states`: on (the hood light and the water glow) · off (the dark tank of a crime movie)
export const fishTank = def({ id: 'fish-tank', name: 'Fish tank', cat: 'decor', place: 'floor', foot: [4, 2], h: 1.3, tops: [1.3], states: ['on', 'off'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['fish', 'glow', 'aquarium'], variants: 2, vnames: ['black stand', 'walnut stand'], far: true,
  build(V, { variant = 0, seed = 1, state = 'on' } = {}) {
    const st = pick([0x1f1f24, K.walnut], variant), on = state !== 'off', L = on ? LIT : 1, r = rng(seed * 13 + 7);
    V.box(0, 0, 0, 20, 14, 9, st); V.box(1, 1, 8, 19, 13, 9, shade(st, 1.25)); V.box(9, 1, 8, 11, 13, 9, st); V.set(8, 7, 9, K.gold, 2); V.set(11, 7, 9, K.gold, 2);   // the stand, two doors
    V.box(0, 14, 0, 20, 24, 9, (x, y) => mix(on ? K.cyan : 0x1f5a8a, on ? K.cobalt : 0x14224a, (23 - y) / 9), L);          // the water
    V.box(0, 14, 0, 20, 16, 9, (x, y, z) => pick([K.pink, K.yellow, K.cyan, K.white, 0xc98a4b], ((hash(x, y, z) * 5) | 0)));   // gravel
    for (const x of [0, 19]) for (const z of [0, 8]) V.box(x, 14, z, x + 1, 24, z + 1, K.ink);                       // the glass edges
    for (const [x, n] of [[2, 6], [3, 4], [16, 7], [17, 5], [9, 3]]) for (let y = 16; y < 16 + n; y++) V.set(x + (y % 3 === 0 ? 1 : 0), y, 8, y % 2 ? K.leaf : K.leafD, L);   // plants
    V.box(12, 16, 8, 15, 18, 9, SAFE.body); V.set(14, 17, 8, K.gold, 2);                                                  // a sunken safe (a wink)
    for (let y = 17; y < 24; y += 2) V.set(6, y, 8, K.white, L);                                                     // bubbles
    for (let k = 0; k < 5; k++) { const fx = 2 + ((r() * 14) | 0), fy = 17 + ((r() * 6) | 0), fc = pick([K.orange, K.yellow, K.pink, K.orange, K.red], k), left = r() < .5;
      V.box(fx, fy, 8, fx + 3, fy + 1, 9, fc, L); V.set(left ? fx + 3 : fx - 1, fy, 8, shade(fc, .75), L); V.set(left ? fx : fx + 2, fy, 8, K.ink, L); }   // fish
    V.box(0, 24, 0, 20, 26, 9, K.ink); V.box(1, 24, 8, 19, 25, 9, on ? K.white : K.gun, on ? LIT : 0);             // the hood, its light
  } });

export const EXTRAS = [acWindow, diningSet, wardrobe, medicineCabinet, sinkBath, fishTank];
