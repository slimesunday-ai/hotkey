// STORE OBJECTS · the pawn shop and the card shop (owner: the store-objects agent). Gold under glass, guitars on the slatwall, a stack
// of TVs all showing something different, a counter behind a cage; graded slabs in cases, binders, a play table, the grading window.
import { obj, K, LIT, GLOW, hh, pick, shadeK, glassCase, off, sign } from './lib.js';

const GOLD = ['gold', 'misc'];
const tag = (P, x, y, z) => { if (!P.far) { P.box(x, y, z, x + 2, y + 1, z + 1, K.white); P.set(x, y + 1, z, K.alu); } };   // a price tag on a string

// ── gold under glass: chains on neck forms · watches on pillows · rings, grillz and a medallion
function goldCase(P, o) {
  const { W, D, v, seed } = o, cab = [K.woodD, K.ink, K.maroon][v], deck = [K.velvet, K.ink, 0x1d3a8a][v];
  glassCase(P, { x0: 0, x1: W, z0: 0, z1: D, base: 11, top: 20, cab, deck, frame: K.chrome, lightBar: true });
  const G = K.goldHi, S = K.chrome;
  if (P.far) { P.box(2, 12, 10, W - 2, 14, 12, G, 2); for (let k = 0; k < 3; k++) { const x = 4 + k * 8;   // a run of chains laid along the front of the deck, then the pieces   // far (wave 2): gold reads as gold — bands on busts, or trays of gold and white
      if (v === 0) { P.box(x, 12, 6, x + 4, 18, 10, K.ink); P.box(x, 14, 10, x + 4, 16, 12, G, 2); P.box(x + 2, 12, 10, x + 4, 14, 12, G, 2); }
      else { P.box(x, 12, 4, x + 6, 14, 10, v === 1 ? K.white : K.ink); P.box(x, 14, 6, x + 2, 16, 8, G, 2); P.box(x + 4, 14, 6, x + 6, 16, 8, v === 1 ? S : G, 2); } } return; }
  if (v === 0) for (let k = 0; k < 3; k++) { const x = 3 + k * 9;                                                     // neck forms, two chains each
    P.box(x, 12, 5, x + 6, 17, 9, K.ink); P.box(x + 1, 17, 6, x + 5, 19, 8, K.ink);
    for (const [c, dy, dd] of [[G, 0, 0], [k === 1 ? S : G, -1, 1]]) { const ys = [17, 16, 15, 14, 14, 15, 16, 17].map(y => y + dy - dd); ys.forEach((y, i) => P.set(x - 1 + i * (7 / 7) + (i > 3 ? 0 : 0), y, 9, c, 2)); }
    P.box(x + 2, 12, 9, x + 4, 14, 10, G, 2); tag(P, x + 5, 12, 10); }
  else if (v === 1) for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) { const x = 2 + k * 5 + r * 2, z = 3 + r * 5;   // watches on white pillows
    P.box(x, 12, z, x + 4, 14, z + 3, K.white); P.box(x, 14, z + 1, x + 4, 15, z + 2, k % 2 ? G : S, 2); P.box(x + 1, 14, z + 2, x + 3, 16, z + 3, [K.ink, K.white, K.blue, K.green, K.ink][(k + r) % 5]);
    if (!P.far) P.set(x + 1, 15, z + 3, k % 2 ? G : S, 2); }
  else { for (let k = 0; k < 3; k++) { const x = 2 + k * 7; P.box(x, 12, 3, x + 6, 13, 9, K.ink);                     // ring trays
      if (!P.far) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P.set(x + 1 + i * 2, 13, 4 + j * 2, (i + j + k) % 3 ? G : S, 2); }
    P.box(23, 12, 5, 28, 14, 9, 0xf08aa0); P.box(23, 14, 8, 28, 15, 9, G, 2); if (!P.far) for (let x = 24; x < 28; x += 2) P.set(x, 14, 9, K.white);   // a grill on a gum mould
    P.box(24, 15, 6, 27, 18, 7, G, 2); P.set(25, 16, 7, K.ink); }                                                        // the medallion on a stand
}
const goldcase = obj({ id: 'store-gold-case', name: 'Gold case', cat: 'cases', foot: [6, 3], h: 1.0, tops: [1.0], tiers: GOLD, tags: ['pawn', 'jewelry', 'gold', 'glass', 'lit'], variants: 3 }, goldCase);

// ── guitars on a slatwall, hung by the headstock, a tag on each (a wall piece)
function guitar(P, cx, kind, c, d) {
  const G2 = K.chrome; P.box(cx, 27, 0, cx + 1, 28, 3, G2, 2);                                                          // the hook
  P.box(cx - 1, 22, 1, cx + 2, 27, 2, kind === 1 ? K.woodD : d);                                                       // headstock
  P.box(cx, kind === 2 ? 11 : 13, 1, cx + 1, 22, 2, kind === 1 ? K.woodL : K.woodD);                                    // neck
  if (kind === 0) { P.box(cx - 4, 2, 1, cx + 5, 13, 3, c); P.clear(cx - 4, 10, 1, cx - 2, 13, 3); P.clear(cx + 3, 11, 1, cx + 5, 13, 3); P.box(cx - 2, 3, 3, cx + 3, 9, 4, K.white); P.box(cx - 1, 5, 4, cx + 2, 6, 5, K.chrome, 2); }
  else if (kind === 1) { P.box(cx - 4, 1, 1, cx + 5, 7, 3, c); P.box(cx - 3, 7, 1, cx + 4, 9, 3, c); P.box(cx - 3, 9, 1, cx + 4, 13, 3, c); P.box(cx - 1, 9, 3, cx + 2, 11, 4, K.ink); P.box(cx - 2, 4, 3, cx + 3, 5, 4, K.woodD);
    if (!P.far) for (const [x, y] of [[cx - 4, 1], [cx + 4, 1], [cx - 4, 6], [cx + 4, 6]]) P.set(x, y, 2, shadeK(c, .6)); }
  else { P.box(cx - 4, 1, 1, cx + 4, 11, 3, c); P.clear(cx - 4, 8, 1, cx - 2, 11, 3); P.box(cx - 2, 3, 3, cx + 2, 5, 4, K.ink); }
  tag(P, cx + 2, 20, 2);
}
const guitars = obj({ id: 'store-guitar-wall', name: 'Guitar wall', cat: 'racks', place: 'wall', foot: [8, 6], h: 0.3, mount: 1.0, tiers: GOLD, tags: ['pawn', 'music', 'guitars', 'slatwall'], variants: 3 },
  (P, o) => { const { W, H, v } = o, slat = [K.bone, 0x6d707a, K.ink][v]; P.box(0, 0, 0, W, H, 1, slat); if (!P.far) for (let y = 2; y < H; y += 3) P.box(0, y, 0, W, y + 1, 1, shadeK(slat, .82));
    const C = [[K.red, 0xc98a4b, K.ink], [K.white, 0xd9a25e, K.blue], [K.purple, 0xc0661c, K.goldHi]][v];
    [[7, 0], [20, 1], [33, 2]].forEach(([cx, kind]) => guitar(P, cx, kind, C[kind], kind === 0 ? K.ink : K.char)); });

// ── the TV stack: two small sets, a big wood-grain one, a flat screen on top — static, colour bars, the game, a cartoon sky
function screen(P, x0, y0, x1, y1, z, kind) {
  if (kind === 'bars') { const B = [K.white, K.yellow, K.cyan, K.lime, K.pink, K.red, K.blue]; for (let x = x0; x < x1; x++) P.box(x, y0, z, x + 1, y1, z + 1, B[Math.floor((x - x0) * B.length / (x1 - x0))], GLOW); }
  else if (kind === 'static') P.box(x0, y0, z, x1, y1, z + 1, (x, y) => [0xd9dde4, 0x9aa2ad, 0xf4f6f8, 0x6d707a][(hh(x | 0, y | 0, 5) * 4) | 0], GLOW);
  else if (kind === 'game') { P.box(x0, y0, z, x1, y1, z + 1, 0x2fbf55, GLOW); P.box(x0, y1 - 2, z, x1, y1, z + 1, 0x3fa9f5, GLOW); P.box((x0 + x1) >> 1, y0, z, ((x0 + x1) >> 1) + 1, y1 - 2, z + 1, K.white, GLOW); }
  else { P.box(x0, y0, z, x1, y1, z + 1, 0x3fa9f5, GLOW); P.box(x0, y0, z, x1, y0 + 2, z + 1, 0x2fbf55, GLOW); P.box(x1 - 4, y1 - 3, z, x1 - 2, y1 - 1, z + 1, K.yellow, GLOW); }
}
const tvs = obj({ id: 'store-tv-stack', name: 'Stack of TVs', cat: 'stock', foot: [4, 3], h: 1.6, tiers: GOLD, tags: ['pawn', 'electronics', 'screens', 'lit', 'stack'], variants: 2 },
  (P, o) => { const { W, D, v } = o, a = [0x8a93a3, K.char][v], wood = [K.woodD, 0x8b4a24][v];
    for (const [x, s] of [[0, 'static'], [10, 'bars']]) { P.box(x, 0, 1, x + 10, 9, 14, a); P.box(x + 1, 1, 13, x + 9, 8, 14, K.ink); screen(P, x + 2, 2, x + 8, 7, 13, s); if (!P.far) P.box(x + 7, 6, 14, x + 9, 8, 15, K.white); }
    P.box(1, 9, 1, 19, 21, 13, wood); P.box(2, 10, 12, 15, 20, 13, K.ink); screen(P, 3, 11, 14, 19, 12, v ? 'bars' : 'game'); P.box(16, 16, 12, 18, 18, 13, K.chrome, 2); P.box(16, 12, 12, 18, 14, 13, K.chrome, 2);
    P.box(7, 21, 5, 13, 22, 9, K.ink); P.box(9, 22, 6, 11, 23, 7, K.ink); P.box(2, 23, 6, 18, 32, 7, K.ink); screen(P, 3, 24, 17, 31, 7, 'sky');
    tag(P, 16, 29, 7); tag(P, 12, 9, 14); });

// ── the counter behind the cage: a gold display in its front, bars to the ceiling with a service window, PAWN on the cage, a padlocked
//    door; behind the bars the scale, the loupe lamp, cash and the register
const cage = obj({ id: 'store-cage-counter', name: 'Caged counter', cat: 'counters', foot: [10, 4], h: 2.6, tops: [0.7], tiers: GOLD.concat('office'), tags: ['pawn', 'counter', 'cage', 'bars', 'gold'], variants: 2, sim: 'lock' },
  (P, o) => { const { W, D, H, v } = o, body = [K.woodD, K.ink][v], bar = [K.iron, K.chrome][v], cz = 10;
    P.box(0, 0, 0, W, 13, D, body); P.box(0, 13, 0, W, 14, D, K.bone); P.box(0, 0, D - 1, W, 2, D, K.char);
    P.box(2, 3, D - 1, W - 2, 12, D, K.velvet); for (let k = 0; k < 6; k++) { const x = 4 + k * 7; for (let i = 0; i < 5; i++) P.set(x + i, 10 - [0, 2, 3, 2, 0][i], D - 1, K.goldHi, 2); P.box(x + 1, 4, D - 1, x + 4, 6, D, k % 2 ? K.goldHi : K.chrome, 2); }
    P.box(0, 3, D - 1, W, 4, D, K.chrome, 2); P.box(0, 11, D - 1, W, 12, D, K.chrome, 2);
    for (let x = 0; x < W; x += 3) if (x < 20 || x > 30) P.box(x, 14, cz, x + 1, H - 1, cz + 1, bar, 2); else P.box(x, 24, cz, x + 1, H - 1, cz + 1, bar, 2);
    for (const y of [23, 36, H - 2]) P.box(0, y, cz, W, y + 1, cz + 1, bar, 2); P.box(20, 14, cz, 21, 24, cz + 1, bar, 2); P.box(30, 14, cz, 31, 24, cz + 1, bar, 2);
    P.box(21, 14, cz - 2, 30, 15, cz + 3, K.steel, 2);                                                                  // the deal tray under the window
    P.box(18, 38, cz + 1, 33, 47, cz + 2, K.yellow, LIT()); P.textC('PAWN', 25.5, 45, cz + 2, K.ink);                    // PAWN plate on the bars
    P.box(W - 7, 14, cz + 1, W - 6, H - 2, cz + 2, bar, 2); P.box(W - 6, 26, cz + 1, W - 4, 29, cz + 2, K.gold, 2); P.box(W - 6, 29, cz + 1, W - 5, 31, cz + 2, K.chrome, 2);   // door stile, padlock
    // behind the bars
    P.box(3, 14, 3, 9, 15, 8, K.steel, 2); P.box(5, 15, 4, 7, 18, 6, K.chrome, 2); P.box(3, 18, 3, 9, 19, 8, K.chrome, 2);    // gold scale
    P.box(33, 14, 2, 35, 22, 3, K.ink); P.box(33, 22, 2, 39, 23, 3, K.ink); P.box(37, 20, 2, 40, 22, 5, K.ink); P.box(38, 19, 3, 39, 20, 4, 0xfff1b0, GLOW);   // loupe lamp
    for (let k = 0; k < 3; k++) P.box(11 + k * 3, 14, 2 + (k % 2), 14 + k * 3, 16 + (k === 1 ? 1 : 0), 6 + (k % 2), 0x5cb85c);   // cash bricks
    P.box(42, 14, 1, 49, 19, 8, K.dark); P.box(43, 19, 1, 48, 21, 3, K.dark); P.box(44, 19, 3, 47, 20, 4, K.lime, GLOW);          // register
  });

// ── pawn shelving: steel racks of everything people hock — a boombox, a drill, a trumpet, a camera, a console, a synth, a microwave
const pshelf = obj({ id: 'store-pawn-shelf', name: 'Pawned goods rack', cat: 'shelving', foot: [6, 2], h: 1.8, tops: [1.8], tiers: GOLD, tags: ['pawn', 'electronics', 'tools', 'music', 'secondhand'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, S = 0x6d707a;
    for (const x of [0, W - 1]) for (const z of [0, D - 1]) P.box(x, 0, z, x + 1, H, z + 1, S);
    for (const y of [1, 13, 25, H - 1]) P.box(0, y - 1, 0, W, y, D, 0x8a8f99);
    const items = [
      (x, y) => { P.box(x, y, 2, x + 11, y + 6, 7, K.alu); for (const cx of [x + 2.5, x + 8.5]) P.cyl(cx, 7, 2.2, y + 1, y + 1, K.ink); P.box(x + 1, y + 1, 7, x + 4, y + 4, 8, K.ink); P.box(x + 7, y + 1, 7, x + 10, y + 4, 8, K.ink); P.box(x + 4, y + 4, 7, x + 7, y + 5, 8, K.cyan, GLOW); P.box(x + 2, y + 6, 4, x + 9, y + 7, 5, K.ink); },   // boombox
      (x, y) => { P.box(x, y + 2, 3, x + 6, y + 6, 7, K.yellow); P.box(x + 1, y, 4, x + 3, y + 3, 6, K.ink); P.box(x + 6, y + 3, 4, x + 8, y + 5, 6, K.char); P.box(x + 8, y + 4, 5, x + 10, y + 5, 6, K.steel, 2); },  // drill
      (x, y) => { P.box(x, y, 3, x + 7, y + 1, 6, K.goldHi, 2); P.box(x + 6, y, 2, x + 9, y + 4, 7, K.goldHi, 2); P.box(x + 1, y + 1, 4, x + 4, y + 2, 5, K.goldHi, 2); P.box(x + 2, y + 2, 4, x + 3, y + 3, 5, K.gold, 2); },   // trumpet
      (x, y) => { P.box(x, y, 3, x + 5, y + 4, 7, K.ink); P.box(x + 1, y + 1, 7, x + 4, y + 4, 9, K.char); P.set(x + 2, y + 2, 8, K.glass); P.box(x + 3, y + 4, 4, x + 5, y + 5, 6, K.char); },   // camera
      (x, y) => { P.box(x, y, 2, x + 8, y + 2, 8, K.purple); P.box(x, y + 1, 7, x + 8, y + 2, 8, K.white); P.box(x + 1, y + 2, 3, x + 4, y + 3, 6, K.char); P.box(x + 5, y + 2, 3, x + 8, y + 3, 6, K.char); },   // a console (invented) + pads
      (x, y) => { P.box(x, y, 2, x + 12, y + 2, 8, K.ink); for (let k = 0; k < 11; k++) P.box(x + k + .5, y + 2, 5, x + k + 1, y + 3, 8, k % 3 === 1 ? K.ink : K.white); },   // a synth
      (x, y) => { P.box(x, y, 1, x + 10, y + 7, 8, K.white); P.box(x + 1, y + 1, 8 - 1 + 1, x + 7, y + 6, 9, K.char); P.box(x + 8, y + 1, 8, x + 9, y + 6, 9, K.alu); },   // microwave
      (x, y) => { for (let k = 0; k < 6; k++) P.box(x + k, y, 3, x + k + 1, y + 7, 8, pick([K.red, K.blue, K.ink, K.yellow, K.green, K.white], k + v)); } ];   // DVDs
    const shelf = [[0, 1], [2, 3, 4], [5, 6]], alt = [[6, 7], [4, 3, 2], [1, 0]], plan = v ? alt : shelf, X = [[2, 16], [2, 12, 20], [2, 16]];
    [1, 13, 25].forEach((y, s) => plan[s].forEach((it, i) => { items[it](X[s][i], y); tag(P, X[s][i] + 1, y + 6, D - 2); }));
  });

// ═════════════ cards & collectibles
const CARDS = ['misc'];
function slab(P, x, y, z, c, lab) { P.box(x, y, z, x + 3, y + 4, z + 1, K.glint, 1); P.box(x, y + 3, z + 1, x + 3, y + 4, z + 2, lab); P.box(x + 1, y + 1, z + 1, x + 2, y + 3, z + 2, c); if (!P.far) P.set(x + 2, y + 1, z + 1, shadeK(c, .7)); }
const SLABC = [K.red, K.blue, K.yellow, K.purple, K.green, K.orange, K.pink, K.cyan];
const slabcase = obj({ id: 'store-slab-case', name: 'Graded slab case', cat: 'cases', foot: [6, 3], h: 1.0, tops: [1.0], tiers: CARDS, tags: ['cards', 'collectibles', 'graded', 'slabs', 'glass', 'lit'], variants: 2 },
  (P, o) => { const { W, D, v, seed } = o; glassCase(P, { x0: 0, x1: W, z0: 0, z1: D, base: 11, top: 20, cab: [K.ink, K.woodD][v], deck: [K.ink, K.cream][v], frame: K.chrome, lightBar: true });
    P.box(1, 12, 2, W - 1, 15, 7, [K.char, K.woodL][v]);                                                                // a riser for the back row
    for (let k = 0; k < 7; k++) slab(P, 1.5 + k * 4, 15, 5, SLABC[(k + seed) % 8], k % 3 ? K.red : K.gold);
    for (let k = 0; k < 6; k++) slab(P, 3 + k * 4, 12, 10, SLABC[(k * 3 + seed + 2) % 8], k % 2 ? K.red : K.blue);
    if (!P.far) { P.box(W - 7, 12, D - 3, W - 2, 15, D - 2, K.white); P.box(W - 6, 13, D - 2, W - 3, 14, D - 1, K.red); } });   // a GRAIL card on its own stand
const binders = obj({ id: 'store-binder-shelf', name: 'Binders & sealed boxes', cat: 'shelving', foot: [6, 2], h: 1.8, tops: [1.8], tiers: CARDS, tags: ['cards', 'collectibles', 'binders', 'sealed'], variants: 2 },
  (P, o) => { const { W, D, H, v, seed } = o, fr = [K.woodD, K.ink][v];
    P.box(0, 0, 0, W, H, 1, fr); for (const x of [0, W - 1]) P.box(x, 0, 0, x + 1, H, D, fr); for (const y of [0, 12, 24, H - 1]) P.box(0, y, 0, W, y + 1, D, fr);
    for (let x = 1, n = 0; x < W - 1; x += 2, n++) { const c = pick([K.red, K.blue, K.ink, K.purple, K.green, K.yellow, K.orange], n * 3 + seed + v); P.box(x, 1, 2, x + 2, 10 - (n % 3 === 0 ? 1 : 0), D - 1, c); if (!P.far) P.box(x, 6, D - 2, x + 2, 8, D - 1, K.white); }
    for (let x = 1, n = 0; x + 5 <= W - 1; x += 6, n++) { const c = pick([K.purple, K.orange, K.cyan, K.red, K.lime], n + v); P.box(x, 13, 2, x + 5, 18, D - 1, c); P.box(x, 18, 3, x + 5, 22, D - 2, shadeK(c, .8)); if (!P.far) { P.box(x + 1, 14, D - 1, x + 4, 16, D, K.goldHi, 2); P.set(x + 1, 20, D - 2, K.glint, 1); } }
    for (let x = 1, n = 0; x + 4 <= W - 1; x += 5, n++) { P.cyl(x + 2, 5, 2, 25, 29, pick([K.chrome, K.goldHi, K.red], n + v), 2); if (n % 2) P.cyl(x + 2, 5, 2, 29, 33, K.chrome, 2); }
  });
const playtable = obj({ id: 'store-play-table', name: 'Play table', cat: 'counters', foot: [8, 4], h: 0.85, tops: [0.75], tiers: CARDS, tags: ['cards', 'collectibles', 'game night', 'table'], variants: 2 },
  (P, o) => { const { W, D, v, seed } = o; P.box(0, 14, 0, W, 15, D, K.woodL); for (const x of [1, W - 2]) for (const z of [1, D - 2]) P.box(x, 0, z, x + 1, 14, z + 1, K.ink);
    const mats = [[K.purple, K.teal], [K.blue, K.red]][v];
    [[2, 2], [21, 11]].forEach(([x, z], k) => { P.box(x, 15, z, x + 17, 16, z + 7, mats[k]); if (!P.far) for (let i = 0; i < 4; i++) { P.box(x + 2 + i * 3, 15, z + 2, x + 4 + i * 3, 16, z + 5, K.white); P.set(x + 3 + i * 3, 15, z + 3, SLABC[(i + k + seed) % 8]); } });
    P.box(20, 15, 3, 22, 18, 5, K.ink); P.box(19, 15, 12, 21, 17, 14, K.white); P.box(23, 15, 4, 24, 16, 5, K.red); P.box(25, 15, 6, 26, 16, 7, K.white);   // decks, a deck box, dice
    P.box(35, 15, 3, 37, 18, 5, K.lime, 1); P.box(4, 15, 12, 7, 16, 14, K.cream); });                                   // an energy can, a score pad
const grading = obj({ id: 'store-grading-counter', name: 'Grading counter', cat: 'counters', foot: [8, 3], h: 1.9, tops: [0.7], tiers: CARDS, tags: ['cards', 'collectibles', 'graded', 'counter', 'submissions'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, body = [K.ink, K.white][v], acc = [K.yellow, K.red][v];
    P.box(0, 0, 0, W, 13, D, body); P.box(0, 13, 0, W, 14, D, K.woodL); P.box(0, 0, D - 1, W, 2, D, K.char); P.box(0, 8, D - 1, W, 10, D, acc);
    P.box(0, 14, 0, W, H, 1, body); sign(P, 5, 29, 1, 30, 8, acc, K.ink, ['GRADING']);                                   // the back panel and its sign
    if (!P.far) for (let k = 0; k < 4; k++) { P.box(6 + k * 7, 18, 1, 11 + k * 7, 26, 2, K.white); P.box(7 + k * 7, 24, 2, 10 + k * 7, 25, 3, [K.red, K.blue, K.gold, K.green][k]); for (let y = 19; y < 23; y += 2) P.box(7 + k * 7, y, 2, 10 + k * 7, y + 1, 3, K.alu); }
    for (let k = 0; k < 3; k++) P.box(2, 14 + k * 3, 3 + (k % 2), 9, 17 + k * 3, 10 + (k % 2), K.white); if (!P.far) for (let k = 0; k < 3; k++) P.box(2, 15 + k * 3, 10 + (k % 2), 9, 16 + k * 3, 11 + (k % 2), acc);   // submission boxes
    for (let k = 0; k < 4; k++) slab(P, 13 + k * 4, 14, 8, SLABC[k * 2 % 8], K.red);                                    // slabs back from grading
    P.box(30, 14, 3, 32, 22, 4, K.ink); P.box(30, 22, 3, 36, 23, 4, K.ink); P.box(34, 20, 3, 37, 22, 6, K.ink); P.box(35, 19, 4, 36, 20, 5, 0xfff1b0, GLOW);   // desk lamp
    P.box(26, 14, 9, 29, 17, 12, K.char); P.box(26, 17, 9, 29, 18, 12, K.steel, 2); });                                  // a pen cup / scale
export default [goldcase, guitars, tvs, cage, pshelf, slabcase, binders, playtable, grading];
