// Home objects · catalogue v2 · gear: stash spots (a hollow speaker, a fake encyclopedia set, a floor safe, a soda can, a cereal box, a
// wall outlet), security (a CCTV camera, an NYC scissor gate), cooking gear (a hot plate, the cook rig) and laying low (an arcade
// cabinet). Every piece's buff is tied to an existing sim mechanic (brief 2026-09-28 §5.3). The cook gear is toon kitchenware and
// glassware with neon liquid: no labels, no real process (OUTLINE §0.9).
import { def, K, SAFE, pick, cyl, cylZ, line, glow, LIT, shade, rng, hash, txt, M3, cash } from './lib.js';
import { g, brick } from './bits.js';
import { screen } from './media.js';

const stash = (take, rarity = 'common') => g('gear', rarity, 'craft', { stashTake: take });

export const stashSpeaker = def({ id: 'stash-speaker', name: 'Hollow speaker', cat: 'stash', place: 'floor', foot: [3, 2], h: 1.0, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'speaker', 'hidden'], variants: 2, vnames: ['black', 'wood'], far: true,
  game: stash(-.3, 'rare'),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([0x2a2a31, K.wood], variant), open = state === 'open';
    V.box(1, 0, 1, 9, 1, 8, K.ink); V.box(0, 1, 0, 10, 20, 9, c);                                                                      // plinth, the cabinet (the right cells are the woofer's resting place)
    cylZ(V, 5, 17.5, 1.3, 9, 10, 0x55555f); cylZ(V, 5, 13, 2.3, 9, 10, 0x55555f); cylZ(V, 5, 13, 1.5, 9, 10, K.ink);                      // tweeter, mid
    if (!open) { cylZ(V, 5, 6, 3.8, 9, 10, 0x55555f); cylZ(V, 5, 6, 3, 9, 10, K.ink); cylZ(V, 5, 6, 1, 9, 10, K.gun, 2); return; }
    cylZ(V, 5, 6, 3.8, 5, 10, -1); cylZ(V, 5, 6, 3.8, 4, 5, 0x1a1a1f); brick(V, 3, 2, 5, 4, 3, 2); brick(V, 3, 4, 6, 3, 2, 1);            // the woofer hole, cash inside
    cyl(V, 12.3, 5, 2.6, 0, 1, 0x55555f); cyl(V, 12.3, 5, 2, 1, 2, K.ink); cyl(V, 12.3, 5, .8, 2, 3, K.gun, 2);                            // the woofer, set down beside it
  } });

export const stashEncyclopedia = def({ id: 'stash-encyclopedia', name: 'Encyclopedia set', cat: 'stash', place: 'surface', foot: [4, 2], h: 0.35, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'books', 'hidden'], variants: 2, vnames: ['oxblood', 'navy'],
  game: stash(-.25),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.oxblood, K.navy], variant), open = state === 'open';
    for (const x of [0, 18]) { V.box(x, 0, 0, x + 2, 5, 5, K.gold, 2); V.box(x, 0, 0, x + 2, 1, 7, K.gold, 2); }                        // brass bookends
    for (let k = 0; k < 8; k++) { const x = 2 + k * 2; if (open && k >= 3 && k < 6) continue; V.box(x, 0, 0, x + 2, 7, 6, k & 1 ? shade(c, .9) : c);
      for (const y of [1, 5]) V.box(x, y, 6, x + 2, y + 1, 7, K.gold, 2); V.set(x, 3, 6, K.cream); }                                     // spines, gold bands, a volume letter
    if (!open) return;
    V.box(8, 0, 0, 14, 7, 1, K.ink); V.box(8, 0, 4, 14, 7, 10, c); V.box(9, 1, 5, 13, 7, 9, -1); V.box(9, 1, 5, 13, 2, 9, K.ink);          // the three fake spines are one box, pulled out
    for (const y of [1, 5]) V.box(8, y, 10 - 1, 14, y + 1, 10, K.gold, 2); brick(V, 9, 2, 5, 4, 3, 2); V.box(10, 4, 6, 12, 5, 8, K.lime, LIT);   // cash, a baggie
  } });

export const safeFloor = def({ id: 'safe-floor', name: 'Floor safe', cat: 'security', place: 'floor', foot: [3, 3], h: 0.6, sim: 'safe', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['safe', 'floor', 'hidden'], variants: 1, vnames: ['OAK green'],
  game: g('gear', 'rare', 'store', { secure: 'safe', safeTake: -.7 }),
  build(V, { state = 'closed' } = {}) {
    V.box(0, 0, 0, 15, 1, 15, K.steelD, 2); V.box(1, 0, 1, 14, 1, 14, 0x1a1a1f);                                                        // the steel collar set in the floor
    const lid = (at) => { for (let u = 0; u < 11; u++) for (let v = 0; v < 11; v++) { const e = u === 0 || v === 0 || u === 10 || v === 10; at(u, v, e ? K.gold : SAFE.body, e ? 2 : 0); } };
    if (state !== 'open') { lid((u, v, c, l) => V.set(2 + u, 1, 2 + v, c, l)); cyl(V, 7.5, 6.5, 2, 2, 3, K.gold); V.set(7, 3, 6, K.ink); V.box(6, 2, 10, 10, 3, 11, K.chrome, 2); return; }   // shut: lid, dial, handle
    lid((u, v, c, l) => V.set(2 + u, 1 + v, 1, c, l)); for (let v = 2; v < 10; v += 3) V.set(7, 1 + v, 2, K.chrome, 2);                  // open: the lid stands up at the back, bolts toward us
    for (let x = 3; x < 12; x += 4) { V.box(x, 0, 4, x + 3, 1, 8, K.cash); V.set(x + 1, 0, 5, K.white); } V.box(4, 0, 10, 7, 1, 12, K.gold, 2);   // what's in the hole
  } });

export const stashSoda = def({ id: 'stash-soda', name: 'Soda-can stash', cat: 'stash', place: 'surface', foot: [2, 1], h: 0.25, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['stash', 'can', 'hidden'], variants: 3, vnames: ['FIZZ red', 'FIZZ lime', 'FIZZ purple'],
  game: stash(-.15),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.red, K.lime, K.purple], variant), open = state === 'open';
    cyl(V, 2.5, 2.5, 2.2, 0, open ? 3 : 4, (x, y) => y === 2 ? K.white : c); if (!open) { cyl(V, 2.5, 2.5, 2, 4, 5, K.chrome); V.set(2, 5 - 1, 3, K.steelD); return; }
    V.box(1, 3, 1, 4, 4, 4, K.cash); V.set(2, 4, 2, K.cash); V.set(3, 3, 3, K.lime, LIT);                                                // a rolled bill, a baggie corner
    cyl(V, 7.5, 2.5, 2.2, 0, 1, c); cyl(V, 7.5, 2.5, 2, 1, 2, K.chrome);                                                                 // the screw-off top, set beside it
  } });

export const stashCereal = def({ id: 'stash-cereal', name: 'Cereal-box stash', cat: 'stash', place: 'surface', foot: [2, 1], h: 0.45, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house'], tags: ['stash', 'kitchen', 'hidden'], variants: 2, vnames: ['CRUNCH KING yellow', 'CRUNCH KING pink'],
  game: stash(-.2),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.yellow, K.pink], variant), open = state === 'open';
    V.box(1, 0, 1, 9, 8, 4, c); for (const [x, y] of [[3, 5], [5, 6], [7, 5]]) V.set(x, y, 4, K.gold, 2); V.box(3, 4, 4, 8, 5, 5, K.gold, 2);   // the box, the mascot's crown
    V.set(4, 2, 4, K.ink); V.set(6, 2, 4, K.ink); V.box(4, 1, 4, 7, 2, 5, K.red); V.box(1, 7, 4, 9, 8, 5, K.red);                        // big eyes, a grin, the title band
    if (!open) return;
    V.box(2, 5, 2, 8, 8, 3, -1); V.box(2, 5, 2, 8, 6, 3, K.cash); V.set(4, 6, 2, K.white); V.set(6, 6, 2, K.cash);                        // inside: rolls of cash
    V.box(0, 7, 1, 1, 9, 4, c); V.box(9, 7, 1, 10, 9, 4, c);                                                                           // the top flaps, folded out
  } });

export const stashOutlet = def({ id: 'stash-outlet', name: 'Outlet stash', cat: 'stash', place: 'wall', foot: [1, 1], h: 0.1, mount: 0.3, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['stash', 'outlet', 'hidden'], variants: 1, vnames: ['white'],
  game: stash(-.35, 'rare'),
  build(V, { state = 'closed' } = {}) {
    if (state !== 'open') { V.box(1, 0, 0, 4, 5, 1, K.white); for (const y of [1, 3]) { V.set(1, y, 1, K.bone); V.set(3, y, 1, K.bone); V.set(2, y, 1, K.ink); } return; }
    V.box(1, 1, 0, 4, 4, 1, K.ink); V.box(1, 2, 1, 4, 3, 2, K.cash); V.box(1, 0, 0, 4, 1, 2, K.white);                                  // the cavity, a roll, the plate slid down
  } });

// ── security
export const cctv = def({ id: 'cctv-camera', name: 'CCTV camera', cat: 'security', place: 'wall', foot: [2, 2], h: 0.35, mount: 2.0, sim: 'cctv',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cctv', 'camera', 'security'], variants: 2, vnames: ['white bullet', 'black dome'],
  game: g('gear', 'rare', 'store', { secure: 'cctv', burgleOdds: -10, idBurglar: true, tip: 1 }),
  build(V, { variant = 0 } = {}) {
    if (!variant) { V.box(3, 5, 0, 7, 9, 1, K.white); V.box(4, 6, 1, 6, 8, 3, K.white);                                                // wall plate, the arm
      V.box(2, 3, 2, 8, 7, 7, K.white, 1); V.box(2, 7, 2, 8, 8, 7, K.bone); V.box(3, 4, 7, 7, 6, 7, 0x1f1f24);                          // body, sun hood
      V.box(3, 4, 6, 7, 6, 7, 0x1f1f24); V.set(4, 5, 6, K.glassHi, 1); V.set(6, 6, 6, K.red, LIT); return; }                            // lens, the red light
    V.box(1, 6, 0, 9, 9, 3, 0x1f1f24); for (let x = 1; x < 9; x++) for (let y = 1; y < 7; y++) for (let z = 1; z < 7; z++) if (Math.hypot(x + .5 - 5, (y + .5 - 6.5) * 1.1, z + .5 - 3) <= 4.2) V.set(x, y, z, 0x2a2a31, 1);
    V.set(5, 3, 6, K.glassHi, 1); V.set(4, 4, 6, K.red, LIT);
  } });

export const gateScissor = def({ id: 'gate-scissor', name: 'Scissor gate', cat: 'security', place: 'wall', foot: [5, 9], h: 0.15, mount: 0, sim: 'door', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['gate', 'door', 'nyc'], variants: 3, vnames: ['steel', 'black', 'gold'], far: true,
  game: g('gear', 'common', 'store', { secure: 'door', burgleOdds: -15 }),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const [m, l] = pick([[K.steelL, 2], [0x26262c, 0], [K.gold, 2]], variant), open = state === 'open', W = open ? 6 : 25;
    V.box(0, 0, 0, 25, 1, 3, m, l); V.box(0, 44, 0, 25, 45, 3, m, l);                                                                 // tracks
    for (let x = 0; x < W; x++) for (let y = 1; y < 44; y++) { const vert = open ? x % 2 === 0 : x % 6 === 0 || x === 24, diag = ((x + y) % 6 < 2) || ((x - y + 600) % 6 < 2);
      if (vert) V.box(x, y, 0, x + 1, y + 1, 2, m, l); else if (diag && !open) V.set(x, y, 1, m, l); else if (open && y % 3 === 0) V.set(x, y, 1, m, l); }
    V.box(open ? 5 : 22, 20, 1, open ? 7 : 25, 24, 3, K.gold, 2); V.set(open ? 6 : 23, 21, 3 - 1, K.ink);                             // the padlock
  } });

// ── cooking gear
export const hotPlate = def({ id: 'hot-plate', name: 'Hot plate and pot', cat: 'kitchen', place: 'surface', foot: [2, 2], h: 0.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cook', 'hot plate', 'gear'], variants: 2, vnames: ['white enamel', 'steel'],
  game: g('gear', 'common', 'store', { cook: 'stove' }),
  build(V, { variant = 0 } = {}) {
    const b = pick([K.white, K.steel], variant);
    V.box(0, 0, 1, 10, 2, 10, b, variant ? 2 : 1); for (const x of [2, 7]) V.set(x, 1, 10 - 1, K.ink);                                 // the plate, two knobs
    for (const [cx, cz] of [[2.5, 4.5], [7.5, 4.5]]) for (let x = 0; x < 10; x++) for (let z = 1; z < 9; z++) { const d = Math.hypot(x + .5 - cx, z + .5 - cz); if (d < 2.3 && d > .6 && ((d * 2) | 0) % 2 === 0) V.set(x, 1, z, K.red, LIT); }   // glowing coils
    cyl(V, 7.5, 4.5, 2.6, 2, 5, K.steelL, 2); cyl(V, 7.5, 4.5, 1.8, 4, 5, K.lime, LIT); V.set(7, 5, 4, K.lime, LIT); V.box(9, 4, 4, 10, 5, 5, K.ink);   // a dented pot, neon bubbling, its handle
  } });

export const cookRig = def({ id: 'cook-rig', name: 'Cook rig', cat: 'kitchen', place: 'floor', foot: [6, 3], h: 1.3, tops: [0.7],
  tiers: ['trailer', 'apartment', 'house'], tags: ['cook', 'rig', 'gear'], variants: 2, vnames: ['steel bench', 'plywood bench'], far: true,
  game: g('gear', 'epic', 'craft', { cook: 'rig' }),
  build(V, { variant = 0 } = {}) {
    const top = variant ? K.ply : K.steelL, l = variant ? 0 : 2;
    for (const x of [1, 27]) for (const z of [1, 12]) V.box(x, 0, z, x + 2, 14, z + 2, K.steelD, 2);                                    // legs
    V.box(0, 13, 0, 30, 14, 15, top, l); V.box(1, 3, 1, 29, 4, 14, K.steelD, 2);                                                         // the bench, a lower shelf
    for (const x of [3, 9, 15]) { V.box(x, 4, 3, x + 4, 10, 8, K.white, 1); V.box(x + 1, 10, 4, x + 3, 11, 6, K.red); }                  // plain jugs on the shelf
    cyl(V, 7.5, 7.5, 3, 14, 15, K.gun); cyl(V, 7.5, 7.5, 2, 14, 15, K.cyan, LIT);                                                       // a burner ring
    cyl(V, 7.5, 7.5, 4.3, 15, 22, K.steelL, 2); cyl(V, 7.5, 7.5, 3.5, 21, 22, K.lime, LIT); V.box(3, 20, 7, 4, 22, 8, K.ink); V.box(11, 20, 7, 13, 22, 8, K.ink);   // the big pot, neon inside, handles
    cyl(V, 18.5, 7.5, 2.8, 14, 19, K.glass, 1); cyl(V, 18.5, 7.5, 2.2, 14, 17, K.pink, LIT); cyl(V, 18.5, 7.5, 1, 19, 24, K.glass, 1);   // a round flask, pink
    V.box(22, 14, 6, 24, 25, 8, K.steelD, 2); V.box(19, 22, 6, 22, 23, 8, K.steelD, 2);                                                   // a clamp stand holding its neck
    V.box(25, 14, 3, 29, 16, 7, 0x1f1f24); V.box(25, 16, 4, 29, 17, 6, K.lime, 1); V.box(26, 14, 9, 29, 15, 12, K.white);                // goggles on a pad, a notebook
  } });

// ── laying low
export const arcadeCab = def({ id: 'arcade-cab', name: 'Arcade cabinet', cat: 'gaming', place: 'floor', foot: [3, 3], h: 1.85,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['arcade', 'gaming', 'retro'], variants: 3, vnames: ['HEAT CHECK red', 'HEAT CHECK cobalt', 'HEAT CHECK black'], far: true,
  game: g('gear', 'epic', 'drop', { heatDecay: 1.3 }),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.red, K.cobalt, 0x1f1f24], variant);
    const side = (y, z) => (y < 15 && z >= 2 && z < 13) || (y >= 15 && y < 18 && z >= 2 && z < 15) || (y >= 18 && y < 29 && z >= 2 && z < 10) || (y >= 29 && z >= 2 && z < 12);
    for (const x of [0, 14]) for (let y = 0; y < 37; y++) for (let z = 0; z < 15; z++) if (side(y, z)) { const fl = ((z * 2 + y * 3 + Math.round(Math.sin(y * .7) * 3)) % 9 < 2) && y < 18;
      V.set(x, y, z, fl ? (y > 10 ? K.yellow : K.orange) : c); }                                                                      // side panels with flame art
    V.box(1, 0, 2, 14, 15, 13, c); V.box(1, 15, 2, 14, 18, 15, 0x1f1f24); V.box(1, 18, 2, 14, 37, 4, c);                                // body, the control deck, back
    V.box(1, 36, 2, 14, 37, 12, c); V.box(1, 29, 11, 14, 36, 12, 0x2a1f3a, LIT); txt(V, M3('HOT'), 2, 34, 11, K.yellow, LIT);         // top, the lit marquee
    V.box(1, 18, 4, 14, 29, 9, K.ink); screen(V, 2, 19, 13, 28, 9, 'game', seed);                                                         // the screen
    V.box(5, 4, 13, 10, 9, 14, 0x26262c); V.set(6, 7, 13, K.red, LIT); V.set(8, 7, 13, K.red, LIT);                                        // coin door
    V.box(4, 18, 11, 5, 20, 12, K.ink); V.set(4, 20, 11, K.red); for (const [x, cc] of [[8, K.yellow], [10, K.cyan], [12, K.pink]]) V.set(x, 18, 12, cc);   // stick, buttons
  } });

export const GEAR = [stashSpeaker, stashEncyclopedia, safeFloor, stashSoda, stashCereal, stashOutlet, cctv, gateScissor, hotPlate, cookRig, arcadeCab];
