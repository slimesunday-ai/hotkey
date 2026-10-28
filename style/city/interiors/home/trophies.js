// Home objects · catalogue v2 · trophies: one per sim MARK (OUTLINE §1.9) plus two awards. A MARK made physical, something you'd put on
// the shelf to show off, never a plaque or a shield. Never stolen, never traded (game.kind 'trophy', stealable false). Event marks have
// no rarity of their own in FORMAT, so they read 'rare' with an 'event' tag.
import { def, K, pick, cyl, cylZ, line, glow, LIT, shade, hash, rng, txt, M3, face } from './lib.js';
import { tro, vitrine, cushion, brick } from './bits.js';

const T = o => def({ cat: 'trophies', tiers: ['trailer', 'apartment', 'house', 'penthouse'], ...o, tags: ['trophy', ...(o.tags || [])] });
const shell = (V, cx, cy, cz, r, keep, c, l = 1) => { for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++) {
  const d = Math.hypot(x + .5 - cx, y + .5 - cy, z + .5 - cz); if (Math.abs(d - r) < .62 && keep(x, y, z)) V.set(x, y, z, c, l); } };

export const firstHouse = T({ id: 'trophy-first-house', name: 'First-house snow globe', place: 'surface', foot: [2, 2], h: 0.5, tags: ['snow globe', 'house'],
  game: tro('common', 'first-house'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.walnut); V.box(3, 0, 9, 7, 2, 10, K.gold, 2); V.box(2, 2, 2, 8, 3, 8, K.white);                             // base, its gold plate, the snow
    V.box(3, 3, 4, 7, 5, 7, K.yellow); V.box(3, 5, 4, 7, 6, 7, K.red); V.box(4, 6, 5, 6, 7, 6, K.red); V.set(5, 3, 7 - 1, K.ink); V.set(4, 4, 6, K.cyan, LIT);   // the house: walls, roof, door, a lit window
    shell(V, 5, 5.6, 5, 3.9, (x, y, z) => z + .5 < 5 || Math.abs(y + .5 - 5.6) < .8, K.glass);                                          // the globe: its back half, a rim of glass
    for (const [x, z] of [[2, 3], [7, 7], [6, 3]]) V.set(x, 3, z, K.white);                                                               // drifts
  } });

export const firstDeal = T({ id: 'trophy-first-deal', name: 'The first bill, framed', place: 'wall', foot: [2, 3], h: 0.1, mount: 1.3, tags: ['framed', 'cash'],
  game: tro('common', 'first-deal'),
  build(V) {
    V.box(0, 0, 0, 10, 15, 2, K.gold, 2); V.box(1, 1, 1, 9, 14, 2, -1); V.box(1, 1, 0, 9, 14, 1, 0x1f1f24);                             // shadow box, velvet
    V.box(1, 7, 1, 9, 12, 2, (x, y) => (x + y) % 5 === 0 ? K.cashD : K.cash); V.box(4, 8, 1, 6, 11, 2, K.cream); V.set(4, 9, 1, K.ink);  // the crumpled first bill, its portrait
    V.box(3, 2, 1, 7, 6, 2, K.glass, 1); V.box(4, 3, 1, 6, 5, 2, K.lime, LIT); V.set(5, 6, 1, K.gold, 2); V.set(5, 12, 1, K.gold, 2);    // the first baggie, pinned
  } });

export const didTime = T({ id: 'trophy-did-time', name: 'Mugshot with commissary art', place: 'wall', foot: [5, 6], h: 0.1, mount: 1.1, tags: ['mugshot', 'prison', 'framed'],
  game: tro('rare', 'did-time'),
  build(V, { seed = 1 } = {}) {
    V.box(0, 0, 0, 25, 30, 1, (x, y) => hash(x, y, 2) > .93 ? K.bone : K.cream);                                                         // an envelope-paper mat
    for (const [cx, cy] of [[3, 26], [21, 4], [3, 5], [22, 26]]) { for (let a = 0; a < 6; a++) V.set(Math.round(cx + Math.cos(a) * 1.4), Math.round(cy + Math.sin(a) * 1.4), 1, K.red); V.set(cx, cy, 1, K.oxblood); for (let y = cy - 5; y < cy - 1; y++) V.set(cx, y > 0 ? y : 0, 1, K.grass); }   // ballpoint roses
    for (let x = 6; x < 19; x++) V.set(x, 2 + ((x * 3) % 2), 1, K.cobalt); for (const x of [10, 14]) { V.set(x, 27, 1, K.red); V.set(x + 1, 27, 1, K.red); V.set(x, 28, 1, K.red); V.set(x + 1, 28, 1, K.red); }   // a blue-pen line, two hearts
    V.box(5, 6, 1, 20, 25, 2, 0x1f1f24); V.box(6, 7, 1, 19, 24, 2, (x, y) => y % 3 === 0 ? K.white : K.pale);                          // the photo's frame, the height chart
    V.box(7, 7, 1, 18, 13, 2, K.orange); face(V, 8, 13, 1, 9, 10, { skin: K.skin[(seed % 5)], hair: K.ink, lids: true });                 // the jumpsuit, the big head
    V.box(7, 8, 1, 18, 12, 2, K.ink); txt(V, M3('451'), 7, 11, 1, K.white);                                                              // the placard
  } });

export const snitch = T({ id: 'trophy-snitch', name: 'RAT designer toy', place: 'surface', foot: [2, 2], h: 0.6, tags: ['rat', 'vinyl toys', 'snitch'],
  game: tro('rare', 'snitch'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.white, 1); V.box(7, 0, 9 - 1, 9, 2, 9, K.red);                                                           // the toy base, a report-flag sticker
    V.box(3, 2, 3, 7, 7, 7, K.buff); V.box(3, 6, 6, 7, 7, 7, shade(K.buff, .8)); V.box(4, 2, 7, 6, 5, 8, K.buff);                        // the trench coat, collar popped
    V.box(2, 7, 3, 8, 11, 8, K.grey, 1); V.box(3, 7, 8, 7, 9, 10, K.grey, 1); V.set(5, 8, 9, K.pink); V.set(4, 8, 9, K.pink);            // the big head, the snout, a pink nose
    for (const x of [1, 8]) { V.box(x, 10, 4, x + 1, 12, 7, K.grey, 1); V.box(x, 10, 5, x + 1, 11, 6, K.pink); }                         // ears
    V.set(3, 10, 8, K.ink); V.set(6, 10, 8, K.ink); V.set(4, 10, 8, K.white); V.set(7, 10, 8, K.white);                                  // shifty eyes
    V.box(8, 8, 5, 9, 11, 7, K.ink); V.set(8, 9, 7, K.cyan, LIT);                                                                       // on the phone
    line(V, 3, 2, 3, 1, 2, 4, K.pink); line(V, 1, 2, 4, 1, 2, 8, K.pink);                                                                 // the tail
  } });

export const gotRobbed = T({ id: 'trophy-got-robbed', name: 'The empty case', place: 'surface', foot: [2, 2], h: 0.55, tags: ['vitrine', 'empty', 'robbed'],
  game: tro('rare', 'got-robbed'),
  build(V) {
    V.box(1, 0, 1, 9, 4, 9, K.ink); V.box(2, 4, 2, 8, 5, 8, K.oxblood);                                                                  // plinth, velvet
    for (const [x, z] of [[3, 4], [4, 4], [5, 4], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [3, 5], [6, 5]]) V.set(x, 4, z, K.white);       // a chalk outline where the brick sat
    V.box(6, 5, 2, 8, 6, 4, K.yellow); V.set(7, 5, 3, K.ink);                                                                             // the IOU note
    for (const [x, z] of [[1, 1], [8, 1], [1, 8]]) V.box(x, 4, z, x + 1, 10, z + 1, K.gold, 2); V.box(1, 10, 1, 9, 11, 9, K.gold, 2);    // three posts left, the lid
    V.box(8, 4, 8, 9, 6, 9, K.gold, 2); V.set(8, 4, 7, K.glint, 1); V.set(7, 4, 8, K.glint, 1);                                           // the jimmied post, glass on the floor
  } });

export const cleanStreak = T({ id: 'trophy-clean-streak', name: 'Clean-streak chips + halo', place: 'surface', foot: [2, 2], h: 0.6, tags: ['halo', 'chips', 'sober'],
  game: tro('rare', 'clean-streak'),
  build(V) {
    for (let k = 0; k < 5; k++) { cyl(V, 5, 5, 3.6, k, k + 1, k === 4 ? K.gold : (k & 1) ? K.white : K.cobalt, k === 4 ? 2 : 1); cyl(V, 5, 5, 2.4, k, k + 1, K.white, 1); }   // a stack of streak chips
    V.box(4, 5, 4, 6, 6, 6, K.gold, 2); for (let y = 5; y < 10; y++) V.set(5, y, 2, K.glass, 1);                                         // the top chip's centre, a clear rod
    for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) { const d = Math.hypot(x + .5 - 5, z + .5 - 5); if (d > 2.4 && d < 3.6) V.set(x, 10, z, K.yellow, LIT); }   // the halo
    V.set(5, 9, 2, K.glass, 1); V.set(5, 10, 2, K.yellow, LIT);
  } });

export const addict = T({ id: 'trophy-addict', name: 'Beachball-eye lamp', place: 'surface', foot: [2, 2], h: 0.6, tags: ['eyeball', 'lamp', 'pupils'],
  game: tro('rare', 'addict'),
  build(V) {
    cyl(V, 5, 5, 3.5, 0, 1, K.chrome, 2); V.box(4, 1, 4, 6, 4, 6, K.chrome, 2);                                                            // base, stem
    for (let x = 0; x < 10; x++) for (let y = 3; y < 12; y++) for (let z = 0; z < 10; z++) { const X = x + .5 - 5, Y = y + .5 - 7.6, Z = z + .5 - 5; if (Math.hypot(X, Y, Z) > 3.9) continue;
      let c = K.white, l = 1; if (Z > 2.1) { const rr = Math.hypot(X, Y); if (rr < 1) { c = K.ink; l = 0; } else if (rr < 2.9) { c = pick([K.red, K.yellow, K.cobalt, K.white, K.lime, K.pink], ((Math.atan2(Y, X) + Math.PI) / (Math.PI * 2) * 6) | 0); l = LIT; } }
      else if (hash(x, y * 5 + z, 3) > .88) c = K.red; V.set(x, y, z, c, l); }                                                           // the eyeball, a beachball iris, veins
  } });

export const crackdown = T({ id: 'trophy-crackdown', name: 'Crackdown beacon', place: 'surface', foot: [2, 2], h: 0.5, tags: ['siren', 'event', 'crackdown'],
  game: { ...tro('rare', 'survived-crackdown') },
  build(V) {
    V.box(1, 0, 1, 9, 3, 9, K.gold, 2); V.box(2, 3, 2, 8, 5, 8, 0x1f1f24); V.box(3, 0, 9 - 1, 7, 2, 9, K.ink);                            // gold plinth, the beacon's black base
    for (let x = 2; x < 8; x++) for (let y = 5; y < 10; y++) for (let z = 2; z < 8; z++) { const d = Math.hypot(x + .5 - 5, (y + .5 - 5) * .9, z + .5 - 5); if (d <= 3.1) V.set(x, y, z, x < 5 ? K.red : K.cobalt, LIT); }   // the red + blue dome
    V.box(4, 8, 4, 6, 9, 6, K.chrome, 2);
  } });

export const inTheBank = T({ id: 'trophy-in-the-bank', name: 'Dye-pack bills, framed', place: 'wall', foot: [3, 3], h: 0.15, mount: 1.2, tags: ['bank', 'event', 'framed'],
  game: tro('rare', 'was-in-the-bank'),
  build(V) {
    V.box(0, 0, 0, 15, 15, 3, K.gold, 2); V.box(1, 1, 1, 14, 14, 3, -1); V.box(1, 1, 0, 14, 14, 1, K.navy);                             // shadow box, navy back
    for (let k = 0; k < 5; k++) { const a = -0.7 + k * .35; for (let t = 0; t < 9; t++) for (let w = -1; w <= 1; w++) { const x = Math.round(7.5 + Math.sin(a) * t + Math.cos(a) * w * .8), y = Math.round(3 + Math.cos(a) * t - Math.sin(a) * w * .8);
      if (x > 0 && x < 14 && y > 0 && y < 14) V.set(x, y, 1, hash(x, y, k) > .55 ? K.pink : w === 0 && t === 5 ? K.cream : K.cash); } }       // five bills, fanned, stained pink
    cylZ(V, 12, 3, 1.4, 1, 3, K.chrome, 2); V.set(12, 5, 1, K.gold, 2);                                                                     // the teller's bell
  } });

export const kingpinCrown = T({ id: 'trophy-kingpin-crown', name: 'Kingpin crown on a pedestal', place: 'floor', foot: [2, 2], h: 1.3, tags: ['crown', 'velvet', 'most wanted'],
  game: tro('epic', 'kingpin-crown'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.gold, 2); V.box(2, 2, 2, 8, 16, 8, (x, y) => (x % 2 && y > 3 && y < 15) ? 0x2a2a31 : 0x1f1f24, 1); V.box(1, 16, 1, 9, 18, 9, K.gold, 2);   // a fluted black column, gold bands
    cushion(V, 1, 1, 9, 9, 18, K.red);                                                                                                  // the velvet cushion
    V.box(2, 21, 2, 8, 23, 8, K.gold, 2); V.box(3, 21, 3, 7, 24, 7, K.red); for (const [x, z] of [[2, 2], [7, 2], [2, 7], [7, 7], [4, 2], [4, 7], [2, 4], [7, 4]]) V.box(x, 23, z, x + 1, x === 4 || z === 4 ? 26 : 25, z + 1, K.gold, 2);   // the band, a velvet cap, its points
    for (const [x, c] of [[3, K.red], [5, K.cyan], [6, K.lime]]) V.set(x, 22, 7, c, 2);        // jewels
  } });

export const goldGrill = T({ id: 'trophy-gold-grill', name: 'Gold grill on a jaw', place: 'surface', foot: [2, 2], h: 0.5, tags: ['grill', 'gold', 'richest'],
  game: tro('epic', 'gold-grill'),
  build(V) {
    V.box(1, 0, 1, 9, 1, 9, K.ink); V.box(2, 1, 2, 8, 6, 7, 0x1f1f24);                                                                   // base, a velvet jaw form
    for (let x = 2; x < 8; x++) { V.box(x, 3, 7, x + 1, 6, 8, x % 2 ? K.gold : shade(K.gold, .85), 2); V.box(x, 1, 7, x + 1, 3, 8, x % 2 ? shade(K.gold, .85) : K.gold, 2); }   // top row, bottom row
    V.set(2, 2, 8, K.gold, 2); V.set(7, 2, 8, K.gold, 2); V.set(4, 4, 8, K.cyan, 2); V.set(5, 1, 8, K.cyan, 2);                         // fangs, two diamonds
    vitrine(V, 0, 0, 10, 10, 1, 10);
  } });

export const halo = T({ id: 'trophy-halo', name: 'Most Trusted halo', place: 'floor', foot: [2, 2], h: 1.5, tags: ['halo', 'handshake', 'trusted'],
  game: tro('epic', 'halo'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.white, 1); V.box(2, 2, 2, 8, 18, 8, (x, y, z) => (x + z) % 2 ? K.white : K.bone, 1); V.box(1, 18, 1, 9, 20, 9, K.white, 1);   // a fluted white column
    V.box(1, 20, 4, 5, 22, 6, K.gold, 2); V.box(5, 20, 4, 9, 22, 6, K.gold, 2); V.box(4, 22, 4, 6, 23, 6, K.gold, 2); V.set(3, 22, 5, K.gold, 2);   // two gold hands shaking
    for (let y = 20; y < 28; y++) V.set(5, y, 2, K.gold, 2);                                                                              // the rod
    for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) { const d = Math.hypot(x + .5 - 5, z + .5 - 5); if (d > 2.4 && d < 3.7) V.set(x, 28, z, K.yellow, LIT); }   // the halo
  } });

export const crewCrown = T({ id: 'trophy-crew-crown', name: 'Crew crown on bandanas', place: 'surface', foot: [2, 2], h: 0.5, tags: ['crown', 'crew', 'bandana'],
  game: tro('epic', 'crew-crown'), variants: 3, vnames: ['red crew', 'blue crew', 'green crew'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.red, K.cobalt, K.grass], variant);
    for (let k = 0; k < 4; k++) V.box(1 + (k & 1), k, 1 + (k >> 1), 9 - (k & 1), k + 1, 9 - (k >> 1), (x, y, z) => (x + z * 3) % 5 === 0 ? K.white : k % 2 ? shade(c, .85) : c);   // folded bandanas
    for (let x = 2; x < 8; x++) for (let z = 2; z < 8; z++) if (x === 2 || x === 7 || z === 2 || z === 7) V.box(x, 4, z, x + 1, 6, z + 1, K.chrome, 2);   // the chrome band
    for (const [x, z] of [[2, 2], [7, 2], [2, 7], [7, 7], [4, 7], [5, 2], [2, 4], [7, 5]]) V.box(x, 6, z, x + 1, (x + z) % 3 ? 8 : 9, z + 1, K.chrome, 2);   // spikes
    for (const x of [3, 6]) V.set(x, 5, 7, c, 2);                                                                                         // crew-colour stones
  } });

export const ghost = T({ id: 'trophy-ghost', name: 'The ghost', place: 'floor', foot: [3, 3], h: 1.2, tags: ['ghost', 'legendary', 'came back'],
  game: tro('legendary', 'ghost'),
  build(V) {
    V.box(1, 0, 1, 14, 3, 14, 0x1f1f24); V.box(1, 2, 1, 14, 3, 14, K.gold, 2);                                                         // plinth
    for (let x = 0; x < 15; x++) for (let y = 3; y < 24; y++) for (let z = 0; z < 15; z++) { const X = x + .5 - 7.5, Z = z + .5 - 7.5, r = Math.hypot(X, Z);
      const body = y < 16 && r < 5.2 && !(y < 5 && ((Math.atan2(Z, X) * 4 + 20 | 0) % 2) && y === 3), head = Math.hypot(X, y + .5 - 16, Z) < 5.3;
      if (body || head) V.set(x, y, z, K.white, 1); }                                                                                   // the sheet, a scalloped hem
    for (const x of [5, 9]) V.box(x, 16, 12, x + 2, 19, 13, K.cyan, LIT); V.box(7, 13, 12, 9, 15, 13, K.ink);                             // lit eyes, an "o"
    V.box(12, 9, 6, 14, 11, 9, K.white, 1); line(V, 13, 9, 8, 13, 6, 8, K.buff); V.box(12, 4, 7, 15, 6, 9, K.cream); V.set(13, 5, 9 - 1, K.ink);   // an arm, the string, the toe tag
  } });

export const chrome = T({ id: 'trophy-chrome', name: 'Chrome bust', place: 'floor', foot: [2, 2], h: 1.35, tags: ['chrome', 'bust', 'legendary'],
  game: tro('legendary', 'chrome'),
  build(V) {
    V.box(1, 0, 1, 9, 11, 9, (x, y) => (y === 10 ? K.gold : hash(x, y, 4) > .85 ? 0x3a3c44 : 0x26262c), 1);                                 // black marble plinth
    V.box(0, 11, 2, 10, 15, 8, K.chrome, 2); V.box(3, 15, 3, 7, 17, 7, K.chrome, 2);                                                       // shoulders, neck
    V.box(1, 17, 1, 9, 27, 9, K.chrome, 2); V.box(1, 24, 1, 9, 27, 9, K.steelL, 2); V.box(1, 24, 9 - 1, 9, 25, 9, K.steelL, 2);            // the big head, its hair
    for (const x of [2, 6]) V.box(x, 21, 8, x + 2, 22, 9, K.steelD, 2); V.box(3, 18, 8, 7, 19, 9, K.steelD, 2);                           // eyes, mouth (cut into the chrome)
  } });

export const missingTexture = T({ id: 'trophy-missing-texture', name: 'Missing-texture monolith', place: 'floor', foot: [3, 3], h: 1.8, tags: ['glitch', '1 of 1', 'most wanted'],
  game: tro('1of1', 'missing-texture'), far: true,
  build(V) {
    V.box(1, 0, 1, 14, 2, 14, 0x1f1f24);
    const ck = (a, b, c) => (((a / 3) | 0) + ((b / 3) | 0) + ((c / 3) | 0)) & 1;
    for (let x = 3; x < 12; x++) for (let y = 2; y < 36; y++) for (let z = 4; z < 11; z++) V.set(x, y, z, ck(x, y, z) ? 0xff00dc : 0x0a0a0a, ck(x, y, z) ? LIT : 0);   // the magenta / black checker
    for (const [x, y, z] of [[12, 20, 6], [12, 21, 6], [13, 21, 6], [2, 28, 8], [1, 28, 8], [12, 9, 9]]) V.set(x, y, z, 0xff00dc, LIT);   // glitch cubes stepping off it
  } });

export const firstHeist = T({ id: 'trophy-first-heist', name: 'First-heist vault wheel', place: 'wall', foot: [6, 6], h: 0.35, mount: 1.2, tags: ['vault', 'heist', '1 of 1'],
  game: tro('1of1', 'first-heist'), far: true,
  build(V) {
    for (let x = 0; x < 30; x++) for (let y = 0; y < 30; y++) { const d = Math.hypot(x + .5 - 15, y + .5 - 15); if (d < 14.5) V.box(x, y, 0, x + 1, y + 1, 2, d > 13 ? K.steelD : K.steel, 2);
      if (d > 11.8 && d < 13 && (Math.round(Math.atan2(y - 15, x - 15) * 4) % 2 === 0)) V.set(x, y, 2, K.gold, 2); }                     // the round door plate, a ring of bolts
    cylZ(V, 15, 15, 3.2, 2, 6, K.chrome, 2); cylZ(V, 15, 15, 1.4, 6, 7, K.gold, 2);                                                         // the hub
    for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2 + Math.PI / 2, ex = 15 + Math.cos(t) * 10.5, ey = 15 + Math.sin(t) * 10.5;
      for (const z of [4, 5]) line(V, 15 + Math.cos(t) * 2.5, 15 + Math.sin(t) * 2.5, z, ex, ey, z, K.gold, 2);
      V.box(Math.round(ex) - 1, Math.round(ey) - 1, 3, Math.round(ex) + 1, Math.round(ey) + 1, 7, K.chrome, 2); }                           // five gold spokes, chrome knobs
  } });

export const cornerMansion = T({ id: 'trophy-corner-mansion', name: 'Corner-lot mansion model', place: 'surface', foot: [3, 3], h: 0.55, tags: ['model', 'mansion', '1 of 1'],
  game: tro('1of1', 'first-corner-mansion'),
  build(V) {
    V.box(0, 0, 0, 15, 2, 15, 0x1f1f24); V.box(1, 2, 1, 14, 3, 14, (x, y, z) => z > 11 || x > 11 ? (z > 12 || x > 12 ? K.slate : K.white) : K.grass);   // the base, the lot on its corner
    V.box(3, 3, 3, 11, 8, 9, K.gold, 2); V.box(1, 3, 4, 3, 6, 8, K.gold, 2); V.box(11, 3, 4, 12, 6, 8, K.gold, 2); V.box(3, 8, 4, 11, 9, 8, shade(K.gold, .85), 2); V.box(5, 9, 5, 9, 10, 7, shade(K.gold, .85), 2);   // the house, wings, roof
    for (const x of [4, 6, 8, 10]) V.box(x, 3, 9, x + 1, 8, 10, K.white, 1); V.box(3, 8, 9, 11, 9, 11, K.gold, 2);                         // portico columns
    V.box(4, 2, 1, 9, 3, 3, K.cyan, LIT);                                                                                               // the pool out back
    vitrine(V, 0, 0, 15, 15, 2, 11);
  } });

export const dirtyCop = T({ id: 'trophy-dirty-cop', name: 'Dirty-cop donut box', place: 'surface', foot: [3, 2], h: 0.3, tags: ['donuts', 'cash', 'dirty cop'],
  game: tro('rare', 'dirty-cop'),
  build(V) {
    V.box(0, 0, 2, 15, 2, 10, K.pink); V.box(1, 1, 3, 14, 2, 9, K.white); V.box(0, 0, 0, 15, 6, 2, K.pink); V.box(1, 1, 1, 14, 5, 2, K.white);   // the box, the lid open, its inside
    for (let k = 0; k < 5; k++) V.set(3 + k * 2, 4, 0, k % 2 ? K.white : K.red);                                                          // the lid's stripe
    for (const cx of [3, 7]) { cyl(V, cx, 6, 1.8, 2, 3, K.buff); cyl(V, cx, 6, 1.4, 3, 4, K.pink); V.set(cx, 3, 6, K.buff); V.set(cx - 1, 3, 5, K.yellow); V.set(cx, 3, 7, K.cyan); }   // donuts, icing, sprinkles
    brick(V, 10, 2, 4, 4, 3, 2); brick(V, 10, 4, 5, 4, 2, 1); for (const [x, y] of [[7, 5], [6, 4], [8, 4], [7, 3]]) V.set(x, y, 0, K.gold, 2);   // cash bricks, a gold star on the lid
  } });

export const bribed = T({ id: 'trophy-bribed-10', name: 'Greasy palm (10 bribes)', place: 'surface', foot: [2, 2], h: 0.6, tags: ['award', 'bribe', 'gold'],
  game: tro('rare', 'bribed-10'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.white, 1); V.box(4, 2, 4, 7, 7, 7, K.gold, 2);                                                            // marble foot, the forearm
    V.box(2, 7, 3, 8, 9, 8, K.gold, 2); V.box(2, 9, 7, 8, 10, 8, K.gold, 2); V.box(1, 8, 3, 2, 10, 5, K.gold, 2);                         // the palm, fingers curling up, the thumb
    V.box(3, 9, 3, 7, 11, 7, K.white); V.box(4, 11, 4, 6, 12, 6, K.cash); V.set(5, 10, 7 - 1, K.red);                                      // a fat envelope, cash peeking, a wax seal
  } });

export const burgled = T({ id: 'trophy-burgled-10', name: 'Gold crowbar (10 jobs)', place: 'wall', foot: [6, 2], h: 0.2, mount: 1.4, tags: ['award', 'crowbar', 'burglary'],
  game: tro('rare', 'burgled-10'),
  build(V) {
    for (const x of [6, 23]) { V.box(x, 3, 0, x + 1, 4, 4, K.chrome, 2); V.set(x, 4, 3, K.chrome, 2); }                                 // two hooks
    V.box(3, 4, 1, 28, 5, 3, K.gold, 2); V.box(1, 4, 1, 3, 7, 3, K.gold, 2); V.box(2, 7, 1, 4, 8, 3, K.gold, 2);                          // the bar, its hooked end
    V.box(27, 3, 1, 30, 4, 3, K.gold, 2); V.set(29, 2, 1, K.gold, 2);                                                                     // the claw
    for (let k = 0; k < 10; k++) { const x = 9 + k + (k > 4 ? 2 : 0); if (k === 4 || k === 9) line(V, x - 4, 7, 0, x, 9, 0, K.white); else V.box(x, 6, 0, x + 1, 10, 1, K.white); }   // ten tally marks scratched in the wall
  } });

export const TROPHIES = [firstHouse, firstDeal, didTime, snitch, gotRobbed, cleanStreak, addict, crackdown, inTheBank, kingpinCrown, goldGrill, halo, crewCrown, ghost, chrome, missingTexture, firstHeist, cornerMansion, dirtyCop, bribed, burgled];
for (const o of [crackdown, inTheBank]) o.tags.push('event');
