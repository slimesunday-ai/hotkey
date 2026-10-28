// STORE OBJECTS · wave 2 (owner: the store-objects agent): the gaps the review named. A vending machine and a claw machine (both with
// lit / dark states), a barber pole, a stack of pizza boxes, and the bodega's stockroom shelf so repeated bodegas vary.
import { obj, K, LIT, GLOW, CHIPS, SODA, hh, pick, shadeK } from './lib.js';

// ── the vending machine: SNAX behind glass (spirals, one bag stuck on its way out) or COLD (a lit giant can and a button column)
const vending = obj({ id: 'store-vending-machine', name: 'Vending machine', cat: 'machines', foot: [4, 3], h: 1.85, tiers: ['bodega', 'food', 'machines', 'office', 'misc'],
  tags: ['anywhere', 'vending', 'snacks', 'lit'], variants: 3, vnames: ['SNAX red', 'COLD blue', 'SNAX black'], states: ['lit', 'dark'] },
  (P, o) => { const { W, D, H, v, seed } = o, on = o.state !== 'dark', Lt = on ? GLOW : 0, body = [K.red, K.blue, K.ink][v], panel = [K.yellow, K.white, K.lime][v];
    P.box(0, 0, 1, W, H, D - 1, body); P.box(0, 0, D - 2, W, 2, D - 1, K.char);
    P.box(1, 32, D - 2, W - 1, 37, D - 1, on ? panel : shadeK(panel, .55), Lt); P.textC(v === 1 ? 'COLD' : 'SNAX', W / 2, 36, D - 1, v === 2 ? K.ink : body, Lt);
    if (v === 1) { P.box(1, 6, D - 2, 14, 31, D - 1, on ? K.white : K.alu, Lt); P.box(4, 8, D - 1, 11, 29, D, K.red, Lt); P.box(4, 16, D - 1, 11, 20, D, K.white, Lt); P.box(4, 28, D - 1, 11, 29, D, K.steel, 2); P.box(4, 8, D - 1, 11, 9, D, K.steel, 2);
      for (let k = 0; k < 6; k++) P.box(15, 10 + k * 3, D - 1, 18, 12 + k * 3, D, pick([K.red, K.green, K.orange, K.purple, K.sky, K.brown], k), Lt); }
    else { P.clear(2, 8, 3, 13, 31, D - 1); P.box(2, 8, 3, 13, 31, 4, on ? 0xf4f8fb : 0x9aa2ad, on ? LIT() : 0);
      for (let r = 0; r < 5; r++) { const y = 9 + r * 4; P.box(2, y - 1, 4, 13, y, D - 3, K.steel, 2);
        for (let c = 0; c < 3; c++) { const x = 2 + c * 4, b = pick(CHIPS, r * 3 + c + v * 5 + seed), stuck = r === 2 && c === 1;
          P.box(x, y, 5, x + 3, y + 3, D - 4, b[0]); if (!P.far) { P.box(x + 1, y + 1, D - 4, x + 2, y + 2, D - 3, b[1]); P.set(x + 2, y, D - 4, K.chrome, 2); }
          if (stuck) P.box(x, y + 1, D - 4, x + 3, y + 4, D - 2, b[0]); } }                              // the one that didn't drop
      for (const [x0, x1, y0, y1] of [[1, 14, 7, 8], [1, 14, 31, 32], [1, 2, 7, 32], [13, 14, 7, 32]]) P.box(x0, y0, D - 2, x1, y1, D - 1, K.char);
      P.glint(3, 12, 5, D - 2); P.glint(8, 24, 3, D - 2); }
    P.box(14, 8, D - 2, 19, 31, D - 1, K.dark); P.box(15, 27, D - 1, 18, 29, D, K.red, Lt); P.box(15, 13, D - 1, 18, 15, D, K.ink); P.set(16, 14, D - 1, K.lime, Lt); P.box(16, 10, D - 1, 17, 12, D, K.chrome, 2);
    if (!P.far) for (let y = 18; y < 26; y += 2) for (let x = 15; x < 18; x += 2) P.set(x, y, D - 1, K.chrome, 2);
    P.box(2, 3, D - 1, 13, 7, D, K.ink); P.box(2, 6, D - 1, 13, 7, D, K.char); });

// ── the claw machine: plush heap under glass, the claw on its gantry, a joystick and a button, WIN! on the marquee
const PLUSH = [K.pink, K.cyan, K.yellow, K.lime, K.purple, K.orange, K.white, K.red];
const claw = obj({ id: 'store-claw-machine', name: 'Claw machine', cat: 'machines', foot: [4, 4], h: 2.05, tiers: ['misc', 'food', 'machines', 'bodega'], tags: ['anywhere', 'arcade', 'claw', 'plush', 'lit'],
  variants: 3, vnames: ['pink', 'cyan', 'yellow'], states: ['lit', 'dark'] },
  (P, o) => { const { W, D, H, v, seed } = o, on = o.state !== 'dark', Lt = on ? GLOW : 0, body = [K.pink, K.cyan, K.yellow][v], trim = [K.purple, K.blue, K.red][v];
    P.box(0, 0, 0, W, 14, D - 1, body); P.box(0, 0, D - 2, W, 2, D - 1, K.ink); P.box(0, 14, 0, W, 17, D, trim);             // cabinet, kick, the control ledge
    P.box(2, 3, D - 1, 8, 10, D, K.ink); P.box(2, 9, D - 1, 8, 10, D, K.alu, 2); P.box(11, 4, D - 1, 17, 11, D, K.chrome, 2); P.box(12, 8, D - 1, 13, 10, D, K.red, Lt); P.box(15, 8, D - 1, 16, 10, D, K.red, Lt);
    P.box(5, 17, 15, 6, 20, 16, K.ink); P.box(4, 20, 14, 7, 22, 17, K.red); P.box(12, 17, 15, 15, 18, 18, K.lime, Lt);                // joystick, the button
    for (const x of [0, W - 1]) for (const z of [0, 13]) P.box(x, 17, z, x + 1, 35, z + 1, K.chrome, 2);
    for (const [z0, z1] of [[0, 1], [13, 14]]) P.box(0, 34, z0, W, 35, z1, K.chrome, 2); P.box(0, 34, 0, 1, 35, 14, K.chrome, 2); P.box(W - 1, 34, 0, W, 35, 14, K.chrome, 2);
    P.box(1, 17, 1, W - 1, 18, 13, K.white);
    for (let k = 0; k < 14; k++) { const x = 1 + ((hh(k, seed, 1) * 15) | 0), z = 1 + ((hh(k, seed, 2) * 9) | 0), y = 18 + (k > 8 ? 3 : 0) + (k > 12 ? 2 : 0), c = PLUSH[(k + v) % PLUSH.length];   // the plush heap
      P.box(x, y, z, x + 3, y + 3, z + 3, c); if (!P.far) { P.set(x, y + 3, z + 1, c); P.set(x + 2, y + 3, z + 1, c); P.set(x + 1, y + 2, z + 3, K.ink); } }
    P.box(1, 32, 6, W - 1, 33, 8, K.chrome, 2); P.box(9, 30, 5, 12, 32, 9, K.chrome, 2); P.box(10, 26, 6, 11, 30, 7, K.chrome, 2);                // gantry, carriage, cable
    P.box(9, 24, 6, 10, 27, 7, K.chrome, 2); P.box(11, 24, 6, 12, 27, 7, K.chrome, 2); P.box(10, 24, 5, 11, 27, 6, K.chrome, 2); P.box(10, 24, 8, 11, 27, 9, K.chrome, 2);
    P.box(1, 33, 1, W - 1, 34, 13, 0xfff8e0, Lt); P.glint(2, 22, 5, 13); P.glint(14, 26, 3, 13);
    P.box(0, 35, 1, W, H, 14, trim); P.box(1, 35, 13, W - 1, H, 14, on ? K.yellow : shadeK(K.yellow, .55), Lt); P.textC('WIN!', W / 2, 39, 14, K.ink, Lt); });

// ── the barber pole (inside, by the chair): chrome caps, the striped glass turning (lit when it's on)
const pole = obj({ id: 'store-barber-pole', name: 'Barber pole', cat: 'fixtures', place: 'wall', foot: [1, 4], h: 0.3, mount: 1.2, tiers: ['barber'], tags: ['barber', 'pole', 'lit'],
  variants: 2, vnames: ['red white blue', 'red white'], states: ['lit', 'dark'] },
  (P, o) => { const { v } = o, on = o.state !== 'dark', S = v ? [K.red, K.white, K.red, K.white] : [K.red, K.white, K.blue, K.white];
    P.box(1, 0, 0, 4, 2, 3, K.chrome, 2); P.box(1, 18, 0, 4, 20, 3, K.chrome, 2); P.cyl(2.5, 3.5, 2.5, 1, 3, K.chrome, 2); P.cyl(2.5, 3.5, 2.5, 17, 19, K.chrome, 2); P.box(2, 19, 3, 3, 20, 4, K.chrome, 2);
    P.cyl(2.5, 3.5, 2, 3, 17, (x, y, z) => S[Math.floor((y + x + z) / 2) % 4], on ? GLOW : 1); });

// ── pizza boxes, stacked by the oven: a couple out of true, the top one printed with a slice
const pizzaBoxes = obj({ id: 'store-pizza-boxes', name: 'Pizza box stack', cat: 'stock', foot: [2, 2], h: 0.9, rot: 45, tiers: ['food'], tags: ['pizza', 'boxes', 'delivery', 'handmade'], variants: 2, vnames: ['white', 'kraft'] },
  (P, o) => { const { v } = o, c = [K.white, K.kraft][v], ink = [K.red, K.green][v];
    for (let k = 0; k < 17; k++) { const dx = k % 5 === 2 ? 1 : 0, dz = k % 7 === 4 ? 1 : 0; P.box(dx, k, dz, dx + 9, k + 1, dz + 9, k % 2 ? c : shadeK(c, .94)); if (!P.far && k % 3 === 0) P.box(dx + 3, k, dz + 8, dx + 6, k + 1, dz + 9, ink); }
    P.box(0, 17, 0, 9, 18, 9, c); P.box(3, 17, 2, 7, 18, 3, K.yellow); P.box(4, 17, 3, 6, 18, 5, K.yellow); P.box(4, 17, 5, 5, 18, 6, K.yellow); if (!P.far) { P.set(4, 17, 2, ink); P.set(5, 17, 3, ink); } });

// ── the stockroom shelf (the bodega's back of house): steel racking, cases with arrows and tape, shrink-wrapped soda, towels, rice,
//    a box of plantains, a clipboard, and a trap on the floor
const stockroom = obj({ id: 'store-stockroom-shelf', name: 'Stockroom shelf', cat: 'shelving', foot: [6, 3], h: 2.1, tops: [], tiers: ['bodega', 'food', 'bottles', 'misc'],
  tags: ['bodega', 'backroom', 'stockroom', 'cases', 'handmade'], variants: 2, vnames: ['stocked', 'running low'] },
  (P, o) => { const { W, D, H, v, seed } = o, S = 0x6d707a, M = 0x8a8f99;
    for (const x of [0, W - 1]) for (const z of [0, D - 1]) P.box(x, 0, z, x + 1, H, z + 1, S); for (const y of [0, 11, 22, 33]) P.box(0, y, 0, W, y + 1, D, M);
    const kase = (x, y, w, h, d, k) => { P.box(x, y, 1, x + w, y + h, d, K.kraft); if (P.far) return; P.box(x + (w >> 1), y + h - 1, 1, x + (w >> 1) + 1, y + h, d, K.kraftD);
      P.box(x + 1, y + 1, d - 1, x + 3, y + 3, d, pick(CHIPS, k + seed)[0]); P.set(x + w - 2, y + h - 2, d - 1, K.ink); P.set(x + w - 3, y + h - 3, d - 1, K.ink); P.set(x + w - 1, y + h - 3, d - 1, K.ink); };   // tape, a brand patch, an ↑
    P.box(1, 1, 1, 8, 9, 13, K.white); P.box(1, 4, 12, 8, 6, 13, K.blue); P.box(9, 1, 2, 16, 7, 12, 0xf2e2c4); P.box(9, 3, 11, 16, 5, 12, K.red);                       // towels, rice
    P.box(18, 1, 1, 28, 7, 13, pick(SODA, v + seed)[0]); P.box(18, 7, 1, 28, 8, 13, K.steel, 1);                                                                          // a 24 of soda, wrapped
    if (v === 0) { kase(1, 12, 9, 8, 14, 1); kase(10, 12, 9, 8, 14, 2); kase(19, 12, 9, 8, 14, 3); kase(2, 23, 8, 5, 13, 4); kase(2, 28, 8, 4, 12, 5); kase(20, 34, 9, 7, 14, 7); }
    else { kase(3, 12, 9, 8, 14, 1); kase(3, 34, 9, 7, 14, 7); }
    P.box(12, 23, 2, 20, 28, 12, K.kraft); P.box(12, 28, 3, 20, 29, 11, K.yellow); if (!P.far) for (let x = 13; x < 20; x += 2) P.set(x, 29, 6, 0x9bc93a);        // plantains in a box
    P.box(22, 23, 2, 28, 29, 12, K.white); P.box(22, 26, 11, 28, 27, 12, K.pink);                                                                                   // toilet paper
    if (!P.far) { P.box(26, 26, D - 1, 29, 30, D, K.white); P.box(27, 30, D - 1, 28, 31, D, K.chrome, 2); P.box(13, 0, 12, 16, 1, 14, K.woodL); P.set(14, 1, 12, K.yellow); } });   // clipboard, trap

export default [vending, claw, pole, pizzaBoxes, stockroom];
