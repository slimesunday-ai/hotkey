// STORE OBJECTS · the laundromat, the dollar-slice joint and the diner (owner: the store-objects agent). Front-loaders with suds in
// the glass, dryers tumbling colour, the change machine; a two-deck oven with its glow, the slice case with a pie missing a slice,
// the lit menu board; booths, chrome stools, the counter and a pie case going round.
import { obj, K, LIT, GLOW, hh, pick, shadeK, sign, off } from './lib.js';
import { registerAt } from './bodega.js';

// a round window in a machine front (+z face at z): chrome ring, dark glass, what's inside
function porthole(P, cx, cy, r, z, inside) { for (let x = Math.floor(cx - r); x < cx + r; x++) for (let y = Math.floor(cy - r); y < cy + r; y++) { const d = Math.hypot(x + .5 - cx, y + .5 - cy);
  if (d <= r) P.set(x, y, z, d > r - 1.2 ? K.chrome : inside(x, y, d), d > r - 1.2 ? 2 : 1); } }
const WASH = ['machines'];
const washers = obj({ id: 'store-washer-pair', name: 'Front-load washers (2)', cat: 'machines', foot: [6, 3], h: 1.05, tops: [0.8], tiers: WASH, tags: ['laundromat', 'washer', 'coin-op'], variants: 3 },
  (P, o) => { const { W, D, v, seed } = o, body = [K.white, K.steel, 0x3fa9f5][v];
    for (let m = 0; m < 2; m++) { const x0 = m * 15, cx = x0 + 7.5, load = pick([K.red, K.blue, K.yellow, K.pink, K.green], m + seed + v);
      P.box(x0, 0, 1, x0 + 15, 16, D - 1, body, v === 1 ? 2 : 0); P.box(x0, 0, D - 2, x0 + 15, 1, D - 1, K.char); if (!P.far) P.box(x0, 1, D - 2, x0 + 1, 16, D - 1, shadeK(body, .85));
      P.box(x0 + 1, 16, 1, x0 + 14, 21, 5, shadeK(body, .92)); P.box(x0 + 2, 17, 5, x0 + 5, 19, 6, K.ink); P.box(x0 + 6, 17, 5, x0 + 8, 18, 6, K.red, GLOW); P.box(x0 + 9, 16, 5, x0 + 14, 21, 6, K.white);
      P.textC(String(7 + m), x0 + 11.5, 20, 6, K.ink);
      porthole(P, cx, 8.5, 5.5, D - 1, (x, y, d) => y < 6 ? load : (y < 8 && hh(x, y, 1) < .6) ? K.white : 0x2a3f7a);
      if (!P.far) { P.box(x0 + 1, 13, D - 1, x0 + 5, 14, D, K.chrome, 2); if (m === (seed + v) % 2) { P.box(x0 + 11, 11, D - 1, x0 + 14, 14, D, K.yellow); P.set(x0 + 12, 12, D - 1, K.red); } } } });   // a taped OUT note on one
const dryers = obj({ id: 'store-dryer-stack', name: 'Stacked dryers', cat: 'machines', foot: [3, 3], h: 1.9, tops: [], tiers: WASH, tags: ['laundromat', 'dryer', 'coin-op'], variants: 2 },
  (P, o) => { const { W, D, H, v, seed } = o, body = [K.steel, K.white][v];
    for (let m = 0; m < 2; m++) { const y0 = m * 19; P.box(0, y0, 1, W, y0 + 19, D - 1, body, 2); P.box(0, y0 + 15, D - 2, W, y0 + 19, D - 1, K.dark); P.box(2, y0 + 16, D - 1, 4, y0 + 18, D, K.ink); P.box(6, y0 + 16, D - 1, 9, y0 + 17, D, K.red, GLOW); P.box(11, y0 + 16, D - 1, 13, y0 + 18, D, K.ink);
      porthole(P, 7.5, y0 + 7.5, 6, D - 1, (x, y, d) => { const t = hh(x, y, seed + m); return t < .25 ? K.pink : t < .45 ? K.cyan : t < .6 ? K.yellow : t < .7 ? K.white : 0x3a3f5a; }); }
    P.box(0, H - 1, 1, W, H, D - 1, shadeK(body, .8)); });
const fold = obj({ id: 'store-folding-table', name: 'Folding table', cat: 'counters', foot: [8, 3], h: 0.95, tops: [0.8], tiers: WASH, tags: ['laundromat', 'table', 'laundry'], variants: 2 },
  (P, o) => { const { W, D, v } = o; P.box(0, 15, 0, W, 16, D, [K.cream, K.white][v]); P.box(0, 14, D - 1, W, 16, D, K.chrome, 2); for (const x of [1, W - 2]) for (const z of [1, D - 2]) P.box(x, 0, z, x + 1, 14, z + 1, K.alu);
    for (let k = 0; k < 3; k++) for (let s = 0; s < 3 - (k % 2); s++) { const c = pick([K.white, K.sky, K.pink, K.yellow, K.lime], k * 3 + s + v); P.box(2 + k * 7, 16 + s * 2, 3, 8 + k * 7, 18 + s * 2, 10, c); if (!P.far) P.box(2 + k * 7, 17 + s * 2, 9, 8 + k * 7, 18 + s * 2, 10, K.white); }
    P.box(24, 16, 2, 34, 19, 12, [K.blue, K.pink][v]); P.clear(25, 17, 3, 33, 19, 11); P.box(25, 17, 3, 33, 18, 11, K.white); P.box(26, 18, 4, 30, 19, 8, K.red); P.box(29, 18, 6, 33, 19, 10, K.lime); if (!P.far) for (let x = 25; x < 34; x += 2) P.set(x, 17, 11, shadeK([K.blue, K.pink][v], .7));
    P.box(35, 16, 4, 38, 21, 8, K.orange, 1); P.box(36, 21, 5, 37, 22, 6, K.white); P.box(20, 16, 12, 22, 17, 13, K.pink); });                                                  // detergent, a lost sock
const change = obj({ id: 'store-change-machine', name: 'Change machine', cat: 'machines', foot: [3, 2], h: 1.7, tiers: WASH.concat('food'), tags: ['laundromat', 'coins', 'cash', 'lit'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, body = [K.steel, K.blue][v]; P.box(0, 0, 0, W, 29, D - 1, body, 2); P.box(0, 29, 0, W, H, D - 1, K.ink); P.box(1, 30, D - 2, W - 1, H - 1, D - 1, K.yellow, LIT()); P.textC('25¢', W / 2, H - 2, D - 1, K.red, LIT());
    P.box(3, 18, D - 2, 12, 25, D - 1, K.dark); P.box(4, 22, D - 1, 11, 23, D, K.ink); P.box(6, 19, D - 1, 9, 21, D, K.lime, GLOW); P.box(4, 8, D - 2, 11, 11, D, K.chrome, 2); P.box(5, 9, D - 1, 10, 10, D, K.char);
    if (!P.far) { P.box(3, 13, D - 1, 12, 17, D, K.white); for (let y = 14; y < 17; y++) P.box(4, y, D - 1, 4 + (y * 5 % 7) + 2, y + 1, D, K.alu); } });
const lcart = obj({ id: 'store-laundry-cart', name: 'Laundry cart', cat: 'clutter', foot: [3, 2], h: 1.6, rot: 45, tiers: WASH, tags: ['laundromat', 'cart', 'wire'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, C = K.chrome, bump = [K.blue, K.red][v];
    for (const x of [1, W - 2]) for (const z of [1, D - 2]) { P.box(x, 0, z, x + 1, 1, z + 1, K.ink); P.box(x, 1, z, x + 1, 13, z + 1, C, 2); }
    P.box(1, 5, 1, W - 1, 6, D - 1, C, 2); for (let x = 1; x < W - 1; x += 2) { P.box(x, 6, 1, x + 1, 13, 2, C, 2); P.box(x, 6, D - 2, x + 1, 13, D - 1, C, 2); } for (let z = 1; z < D - 1; z += 2) { P.box(1, 6, z, 2, 13, z + 1, C, 2); P.box(W - 2, 6, z, W - 1, 13, z + 1, C, 2); }
    P.box(1, 12, 1, W - 1, 13, D - 1, bump); P.clear(2, 12, 2, W - 2, 13, D - 2); P.box(2, 6, 2, W - 2, 11, D - 2, K.white); P.box(3, 11, 3, 9, 12, 7, K.pink); P.box(8, 11, 4, 12, 12, 8, K.sky);
    for (const x of [1, W - 2]) P.box(x, 13, 4, x + 1, H - 1, 6, C, 2); P.box(1, H - 2, 4, W - 1, H - 1, 6, C, 2); P.set(6, H - 3, 5, C, 2); P.box(4, 19, 3, 9, H - 3, 7, K.purple); });

// ═════════════ dollar pizza
const FOOD = ['food'];
function pie(P, cx, y, cz, r, top, gone = 0) { P.cyl(cx, cz, r, y, y + 1, 0xd9893a); P.cyl(cx, cz, r - 1, y + 1, y + 2, 0xffd84a); if (P.far) return;
  for (let t = 0; t < 7; t++) { const a = t * 2.4 + cx, d = (r - 1.6) * ((t % 3 + 1) / 3); P.set(cx + Math.cos(a) * d, y + 1, cz + Math.sin(a) * d, top); }
  if (gone) for (let x = Math.floor(cx); x < cx + r; x++) for (let z = Math.floor(cz); z < cz + r; z++) if (z - cz < (x - cx) * .9) P.clear(x, y, z, x + 1, y + 2, z + 1); }
const oven = obj({ id: 'store-pizza-oven', name: 'Two-deck pizza oven', cat: 'machines', foot: [8, 4], h: 1.7, tops: [1.6], tiers: FOOD, tags: ['pizza', 'oven', 'steel', 'glow'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, body = [K.steel, K.char][v], door = [0xaab1bc, K.ink][v];
    for (const x of [1, W - 3]) for (const z of [2, D - 4]) P.box(x, 0, z, x + 2, 8, z + 2, K.alu, 2);
    for (let k = 0; k < 2; k++) { const y0 = 8 + k * 12; P.box(0, y0, 1, W, y0 + 12, D - 2, body, 2); P.box(3, y0 + 1, D - 2, W - 8, y0 + 10, D - 1, door, 2); P.box(3, y0 + 9, D - 2, W - 8, y0 + 10, D - 1, 0xff8a1f, GLOW);
      P.box(5, y0 + 6, D - 1, W - 10, y0 + 7, D, K.chrome, 2); P.box(W - 6, y0 + 5, D - 2, W - 3, y0 + 8, D - 1, K.white); P.set(W - 5, y0 + 7, D - 1, K.red); }
    P.box(4, 32, 3, 16, 34, 14, K.white); P.box(6, 33, 13, 12, 34, 14, K.red); P.box(22, 32, 4, 30, 33, 12, K.woodL); P.box(30, 32, 7, 36, 33, 9, K.woodD); });   // boxes on top, the peel
const slice = obj({ id: 'store-slice-counter', name: 'Slice counter', cat: 'counters', foot: [10, 4], h: 1.3, tops: [0.7], tiers: FOOD, tags: ['pizza', 'counter', 'glass', 'lit', 'dollar slice'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, band = [K.red, K.green][v];
    P.box(0, 0, 0, W, 13, D - 1, K.white); if (!P.far) for (let x = 0; x < W; x += 3) P.box(x, 2, D - 2, x + 1, 13, D - 1, 0xd9d5cc); P.box(0, 0, D - 2, W, 2, D - 1, K.char);
    P.box(0, 4, D - 2, W, 13, D - 1, band); P.textC('PIZZA', 17, 11, D - 1, K.white, 0, { font: 5 }); P.box(0, 13, 0, W, 14, D, 0xf4f1ea);
    const x0 = 2, x1 = 34; P.box(x0, 14, 3, x1, 15, 17, K.steel, 2); for (const x of [x0, x1 - 1]) for (const z of [3, 16]) P.box(x, 15, z, x + 1, 25, z + 1, K.chrome, 2); P.box(x0, 25, 3, x1, 26, 17, K.chrome, 2); P.box(x0 + 1, 24, 4, x1 - 1, 25, 6, 0xfff1b0, GLOW);
    pie(P, 9, 15, 10, 5.5, K.red, 1); pie(P, 22, 15, 10, 5.5, 0x2fbf55); P.box(27, 19, 5, 33, 20, 15, K.chrome, 2); P.box(27, 20, 6, 33, 21, 14, 0xd9893a); P.box(28, 21, 7, 32, 22, 13, K.red); if (!P.far) for (let x = 28; x < 32; x += 2) P.set(x, 21, 9, K.white);
    P.glint(x0 + 2, 17, 4, 16); P.glint(20, 18, 3, 16);
    registerAt(off(P, 38, 14, 5), v ? 1 : 0); P.cyl(44, 16, 2, 14, 17, K.white); P.box(36, 14, 15, 38, 18, 17, K.red); P.box(36, 18, 15, 38, 19, 17, K.chrome, 2); P.box(39, 14, 15, 41, 18, 17, K.white); P.box(39, 18, 15, 41, 19, 17, K.chrome, 2); });
const MENU = [['SLICE $1', [[K.yellow, K.red], [K.red, K.white], [0xd9893a, K.yellow]]], ['HEROES', [[0xd9893a, K.green], [0xc98a4b, K.red], [K.yellow, 0xd9893a]]], ['SPECIALS', [[K.brown, K.yellow], [K.pink, K.white], [K.yellow, K.brown]]]];
const menu = obj({ id: 'store-menu-board', name: 'Lit menu board', cat: 'signs-inside', place: 'wall', foot: [8, 4], h: 0.15, mount: 1.9, tiers: FOOD.concat('bodega', 'cakes'), tags: ['pizza', 'deli', 'diner', 'menu', 'lit'], variants: 3 },
  (P, o) => { const { W, H, v } = o, [title, pics] = MENU[v], L = LIT(); P.box(0, 0, 0, W, H, 1, K.ink); P.box(1, H - 7, 1, W - 1, H - 1, 2, v === 1 ? K.green : K.red, L); P.textC(title, W / 2, H - 2, 2, K.yellow, L);
    pics.forEach(([a, b], k) => { const y = 1 + k * 4; P.box(2, y, 1, 7, y + 3, 2, a, L); if (!P.far) P.box(3, y + 1, 2, 6, y + 2, 3, b, L); P.box(9, y + 1, 1, 9 + 12 + (k * 5) % 9, y + 2, 2, K.white, L); P.box(W - 7, y + 1, 1, W - 2, y + 2, 2, K.yellow, L); }); });

// ═════════════ the diner
const booth = obj({ id: 'store-diner-booth', name: 'Diner booth', cat: 'fixtures', foot: [6, 5], h: 1.2, tops: [0.8, 0.5], seat: 0.5, vnames: ['red', 'teal', 'mustard'], tiers: FOOD.concat('cakes'), tags: ['diner', 'booth', 'vinyl', 'jukebox'], variants: 3 },
  (P, o) => { const { W, D, H, v } = o, vin = [K.vinyl, K.teal, 0xd9a21a][v], pipe = K.white;
    for (const [x0, bx] of [[0, 0], [21, 27]]) { P.box(x0, 0, 0, x0 + 9, 8, D, K.char); P.box(x0, 8, 0, x0 + 9, 10, D, vin); P.box(bx, 10, 0, bx + 3, H - 1, D, vin); P.box(bx, H - 1, 0, bx + 3, H, D, pipe);
      if (!P.far) for (let z = 2; z < D; z += 4) P.box(bx === 0 ? 3 : 26, 11, z, bx === 0 ? 4 : 27, H - 2, z + 1, shadeK(vin, .75)); P.box(x0, 9, D - 1, x0 + 9, 10, D, pipe); }
    P.box(14, 0, 9, 16, 15, 11, K.chrome, 2); P.box(12, 0, 7, 18, 1, 13, K.chrome, 2); P.box(9, 15, 1, 21, 16, 21, 0xf4efe0); P.box(9, 15, 20, 21, 16, 21, K.chrome, 2);
    P.box(13, 16, 1, 17, 21, 4, K.chrome, 2); P.box(14, 18, 4, 16, 20, 5, K.yellow, GLOW); P.box(13, 21, 1, 17, 22, 4, K.red);                                  // the tableside jukebox
    P.box(10, 16, 5, 12, 19, 7, K.chrome, 2); P.box(18, 16, 5, 19, 20, 6, K.red); P.box(18, 20, 5, 19, 21, 6, K.white); P.box(19, 16, 6, 20, 19, 7, K.yellow);   // napkins, ketchup, mustard
    P.box(11, 16, 13, 13, 18, 15, K.white); P.box(17, 16, 15, 19, 18, 17, K.white); P.box(14, 16, 17, 17, 17, 20, K.red); });                                   // two mugs, a menu
const stool = obj({ id: 'store-counter-stool', name: 'Counter stool', cat: 'fixtures', foot: [2, 2], h: 0.65, tops: [0.65], seat: 0.65, vnames: ['red', 'teal', 'black'], tiers: FOOD.concat('cakes', 'bottles'), tags: ['diner', 'stool', 'chrome', 'vinyl'], variants: 3 },
  (P, o) => { const vin = [K.vinyl, K.teal, K.ink][o.v]; P.cyl(5, 5, 4, 0, 1, K.chrome, 2); P.box(4, 1, 4, 6, 10, 6, K.chrome, 2); P.cyl(5, 5, 3.5, 5, 6, K.chrome, 2); P.cyl(5, 5, 2.4, 5, 6, -1); P.box(4, 5, 4, 6, 6, 6, K.chrome, 2);
    P.cyl(5, 5, 4.5, 10, 11, K.chrome, 2); P.cyl(5, 5, 4.5, 11, 13, vin); });
const dcounter = obj({ id: 'store-diner-counter', name: 'Diner counter', cat: 'counters', foot: [8, 3], h: 1.25, tops: [0.9], tiers: FOOD.concat('cakes'), tags: ['diner', 'counter', 'chrome', 'formica'], variants: 2 },
  (P, o) => { const { W, D, v } = o, face = [K.steel, K.vinyl][v];
    P.box(0, 0, 0, W, 16, D - 2, face, v ? 0 : 2); if (!P.far) for (let x = 1; x < W; x += 2) P.box(x, 2, D - 3, x + 1, 16, D - 2, v ? shadeK(face, .8) : K.chrome, 2); P.box(0, 0, D - 3, W, 2, D - 2, K.ink);
    P.box(0, 16, 0, W, 17, D, K.chrome, 2); P.box(0, 17, 0, W, 18, D, 0xf4efe0);
    P.box(7, 18, 5, 9, 20, 7, K.chrome, 2); P.cyl(8, 6, 3.5, 20, 21, K.chrome, 2); P.cyl(8, 6, 3, 21, 24, K.pink); P.cyl(8, 6, 3, 23, 24, K.white); P.box(7, 24, 5, 9, 25, 7, K.red);   // a cake on its stand
    P.box(18, 18, 4, 20, 22, 6, K.frost, 1); P.box(18, 22, 4, 20, 23, 6, K.chrome, 2); P.box(23, 18, 5, 26, 21, 7, K.chrome, 2); P.box(30, 18, 7, 32, 20, 9, K.white); P.box(34, 18, 3, 36, 20, 5, K.white); });
const piecase = obj({ id: 'store-pie-case', name: 'Rotating pie case', cat: 'cases', place: 'surface', foot: [2, 2], h: 0.65, tiers: FOOD.concat('cakes'), tags: ['diner', 'pie', 'glass', 'lit'], variants: 2 },
  (P, o) => { const F = [[0xc41e3a, 0xd9893a], [K.yellow, K.white], [K.brown, K.white]], sh = o.v; P.cyl(5, 5, 4.5, 0, 1, K.chrome, 2); P.box(4, 1, 4, 6, 12, 6, K.chrome, 2); P.cyl(5, 5, 4.5, 12, 13, K.chrome, 2); P.cyl(5, 5, 3, 11, 12, 0xfff8e0, LIT());
    [1, 5, 9].forEach((y, k) => { const f = F[(k + sh) % 3]; P.cyl(5, 5, 4, y, y + 1, K.frost, 1); P.cyl(5, 5, 3.5, y + 1, y + 2, 0xd9893a); P.cyl(5, 5, 3, y + 1, y + 2, f[0]); if (!P.far) P.cyl(5, 5, 2, y + 2, y + 3, f[1]); });
    P.glint(1, 3, 3, 9); });
export default [washers, dryers, fold, change, lcart, oven, slice, menu, booth, stool, dcounter, piecase];
