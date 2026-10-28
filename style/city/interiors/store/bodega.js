// STORE OBJECTS · the bodega (owner: the store-objects agent). The corner deli from the inside: shelves stocked to the ceiling with
// invented brands, the cooler wall, the counter behind plexiglass (lotto, scratch-offs, the register, a candy rack in front), the wall
// of stuff behind it, the deli case and slicer, the ATM, coffee, the papers (a brick on them) and the cat. Units: 0.05 m (lib.js).
import { obj, K, LIT, GLOW, CHIPS, SODA, MALT, CEREAL, TINS, stockRow, shelving, hh, pick, shadeK, sign, off, mirrorZ, bag, can, bottle, forty, cereal, tin } from './lib.js';

const BODEGA = ['bodega', 'food'], ALL_STORE = ['bodega', 'food', 'misc', 'phones', 'bottles'];
const tape = (P, x0, y, z0, x1, z1) => P.box(x0, y, z0, x1, y + 1, z1, K.kraftD);   // a strip of tape across a case lid
function overstock(P, x0, y, z0, w, d, h, seed) { P.box(x0, y, z0, x0 + w, y + h, z0 + d, K.kraft); if (!P.far) { tape(P, x0, y + h - 1, z0 + (d >> 1), x0 + w, z0 + (d >> 1) + 1); P.box(x0 + 1, y + 1, z0 + d - 1, x0 + 4, y + 3, z0 + d, pick([K.red, K.blue, K.green], seed)); } }

// ── wall shelving, 1 m of it: four stocked boards; the unit's top carries an overstock case (and is where the cat sleeps)
function wallShelf(P, o, fill) {
  const { W, D, H, v, seed } = o, fr = [K.bone, K.white, 0xb9c2cc][v % 3], top = H - 2, levels = [3, 11, 19, 27];
  shelving(P, { x0: 0, x1: W, z0: 0, z1: D, levels: [...levels, top], top, frame: fr, seed: seed + v, cap: true });
  levels.forEach((y, k) => fill(P, y, k, 1, W - 1, 2, D - 1));
  overstock(P, 2, top, 1, 9, 6, 2, seed + v);
}
const chips = obj({ id: 'store-shelf-chips', name: 'Chip shelf', cat: 'shelving', foot: [4, 2], h: 1.9, tops: [1.8], tiers: BODEGA.concat('misc'), tags: ['bodega', 'deli', 'stock', 'chips', 'snacks'], variants: 3 },
  (P, o) => wallShelf(P, o, (P, y, k, x0, x1, z0, z1) => {
    const set = [CHIPS, CHIPS.filter((b, i) => [0, 1, 3, 8].includes(i)), CHIPS.filter((b, i) => [2, 4, 5, 6].includes(i))][o.v];
    stockRow(P, 'bag', x0, x1, y, z0, z1, set, o.seed * 31 + k * 5 + o.v);
    if (!P.far && k === 1) P.box(x1 - 5, y - 3, z1, x1 - 2, y + 1, z1 + 1, o.v === 1 ? K.red : K.yellow);   // a shelf talker: HOT / 2 FOR
  }));
const cereals = obj({ id: 'store-shelf-cereal', name: 'Cereal & canned goods', cat: 'shelving', foot: [4, 2], h: 1.9, tops: [1.8], tiers: BODEGA.concat('misc'), tags: ['bodega', 'deli', 'stock', 'cereal', 'canned', 'rice'], variants: 2 },
  (P, o) => wallShelf(P, o, (P, y, k, x0, x1, z0, z1) => {
    if (k >= 2) stockRow(P, 'cereal', x0, x1, y, z0, z1, CEREAL, o.seed * 13 + k + o.v * 7);
    else if (k === 1) { stockRow(P, 'tin', x0, x1, y, z0, z1, TINS, o.seed + 3 + o.v, { gap: 0, sold: .04 }); if (!P.far) stockRow(P, 'tin', x0 + 1, x1, y + 3, z0, z1 - 1, TINS, o.seed + 9 + o.v, { gap: 1, sold: .2 }); }
    else for (let x = x0, n = 0; x + 5 <= x1; x += 6, n++) { const c = pick([K.white, K.cream, 0xf2e2c4], n + o.v), band = pick([K.red, K.green, K.blue, K.orange], n * 3 + o.v);   // rice sacks, slumped
      const h = 6 - (n % 2); P.box(x, y, z0, x + 5, y + h, z1, c); if (!P.far) { P.box(x, y + 2, z1 - 1, x + 5, y + 4, z1, band); P.set(x + 4, y + h - 1, z1 - 1, -1); } }
  }));
const cans = obj({ id: 'store-shelf-cans', name: 'Soda & household shelf', cat: 'shelving', foot: [4, 2], h: 1.9, tops: [1.8], tiers: BODEGA.concat('misc'), tags: ['bodega', 'deli', 'stock', 'cans', 'soda', 'household'], variants: 2 },
  (P, o) => wallShelf(P, o, (P, y, k, x0, x1, z0, z1) => {
    if (k === 3) stockRow(P, 'bottle', x0, x1, y, z0, z1, SODA, o.seed + 41 + o.v, { gap: 0 });
    else if (k === 2) { stockRow(P, 'can', x0, x1, y, z0, z1, SODA, o.seed + 17 + o.v, { gap: 0, sold: .03 });   // cans, and 12-packs lying on top of them
      if (!P.far) for (let x = x0, n = 0; x + 6 <= x1; x += 7, n++) { const b = pick(SODA, n * 2 + o.v + o.seed); P.box(x, y + 4, z0, x + 6, y + 7, z1 - 2, b[0]); if (!P.far) P.box(x, y + 5, z1 - 3, x + 6, y + 6, z1 - 2, b[1]); } }
    else if (k === 1) for (let x = x0, n = 0; x + 3 <= x1; x += 4, n++) { const c = pick([K.orange, K.blue, K.purple, K.green, K.yellow], n + o.v * 2);   // detergent jugs, handle notch
      P.box(x, y, z0, x + 3, y + 5, z1, c, 1); if (!P.far) { P.set(x + 2, y + 4, z1 - 1, -1); P.box(x, y + 5, z0 + 2, x + 1, y + 6, z1 - 2, K.white); P.box(x, y + 1, z1 - 1, x + 3, y + 3, z1, K.white); } }
    else for (let x = x0, n = 0; x + 4 <= x1; x += 4, n++) { P.box(x, y, z0, x + 4, y + 4, z1, K.white); if (!P.far) { P.box(x, y + 1, z1 - 1, x + 4, y + 2, z1, pick([K.blue, K.pink, K.green], n + o.v)); for (let t = 0; t < 4; t += 2) P.set(x + t, y + 3, z1 - 1, 0xe4e0d8); } }   // paper towels
  }));

// ── the aisle gondola: double-sided, 1.5 m tall so heads show over it; each side stocked, end panels in the store colour
const gondola = obj({ id: 'store-gondola', name: 'Aisle gondola', cat: 'shelving', foot: [6, 4], h: 1.5, tops: [1.25], tiers: BODEGA.concat('misc'), tags: ['bodega', 'aisle', 'stock', 'double-sided'], variants: 3 },
  (P, o) => { const { W, D, H, v, seed } = o, half = D >> 1, fr = [K.bone, K.white, K.bone][v], end = [K.red, K.green, K.blue][v], levels = [3, 10, 17], top = 25;
    const side = (Q, s) => { shelving(Q, { x0: 1, x1: W - 1, z0: half, z1: D, levels: [...levels, top], top, frame: fr, seed: seed + s, cap: false, backPanel: true });
      const kinds = [['bag', 'bag', 'can'], ['cereal', 'tin', 'bottle'], ['bag', 'can', 'bottle']][(v + s) % 3], brands = { bag: CHIPS, can: SODA, bottle: SODA, cereal: CEREAL, tin: TINS };
      levels.forEach((y, k) => stockRow(Q, kinds[k], 2, W - 2, y, half + 1, D - 1, brands[kinds[k]], seed * 7 + k * 11 + s * 5 + v, { room: [7, 7, 8][k] }));
      stockRow(Q, 'can', 2, W - 2, top, half + 1, D - 3, SODA, seed + 77 + s, { gap: 2, sold: .25, room: 6 }); };   // loose stock on the top deck
    side(P, 0); side(mirrorZ(P, D), 1);
    P.box(1, top - 1, 1, W - 1, top, D - 1, fr);                                                                  // the top deck
    for (const x of [0, W - 1]) { P.box(x, 0, 0, x + 1, top, D, end); P.box(x, 0, 0, x + 1, 3, D, K.char); }      // end panels in the store colour, black kick
  });

// ── the cooler wall: three glass doors (glass is air + a glint), lit inside, wire shelves, a lit header; frost at the door feet
// wave 2: states shut / open (the right door swung out ~60°); the footprint's front 0.5 m is the door's swing space (FORMAT)
const cooler = obj({ id: 'store-cooler', name: 'Drink cooler (3 doors)', cat: 'coolers', foot: [8, 5], h: 2.3, tops: [2.3], tiers: ['bodega', 'food', 'bottles'], tags: ['bodega', 'cold', 'drinks', 'lit', 'glass', 'swing space'], variants: 3,
  vnames: ['soda', 'beer & malt', 'mixed'], states: ['shut', 'open'] },
  (P, o) => { const { W, H, v, seed } = o, D = 15, open = o.state === 'open', body = [K.ink, K.white, K.ink][v], head = [K.red, K.blue, K.green][v], L = LIT();
    P.box(0, 0, 0, W, H, D, body); P.clear(2, 3, 1, W - 2, 38, D);                                               // shell, hollow front
    P.box(2, 3, 1, W - 2, 38, 2, 0xf4f8fb, L); P.box(0, 0, D - 2, W, 3, D, K.char);                              // lit back wall, kick
    const shelves = [3, 11, 18, 25, 32], rows = [['forty', 'bottle', 'can', 'bottle', 'can'], ['forty', 'can', 'bottle', 'can', 'bottle'], ['bottle', 'bottle', 'can', 'forty', 'can']][v];
    const brands = v === 1 ? { forty: MALT, can: [[K.blue, K.white], [K.gold, K.red], [K.white, K.blue], [K.green, K.gold]], bottle: [[0x7a3a12, K.gold], [0x3d6b2a, K.white]] } : { forty: SODA, can: SODA, bottle: SODA };
    shelves.forEach((y, k) => { if (k) P.box(2, y - 1, 2, W - 2, y, D - 2, K.steel, 2);
      for (let d = 0; d < 3; d++) { const x0 = 2 + d * 12; stockRow(P, rows[k], x0 + 1, x0 + 11, y, 2, D - 3, brands[rows[k]], seed * 5 + k * 3 + d * 17 + v, { gap: rows[k] === 'forty' ? 1 : 0, sold: .05, room: [8, 7, 7, 7, 6][k] }); } });
    // products glow with the cooler light at night: repaint the stock layer is not needed (they are gloss); the tube behind each mullion is lit
    for (let d = 0; d <= 3; d++) { const x = 1 + d * 12; P.box(x, 3, D - 3, x + 2, 38, D - 1, body); if (d > 0 && d < 3) P.box(x, 4, D - 4, x + 2, 37, D - 3, 0xfffbe8, GLOW); }
    for (let d = 0; d < 3; d++) { const x0 = 2 + d * 12, x1 = x0 + 12, fr = v === 1 ? K.alu : K.char;          // door frames on the front plane, a handle each
      if (open && d === 2) { const c = .5, s = .866;                                                      // swung out on its left hinge: rails, stiles, the handle, cold air
        for (let t = 0; t < 12; t++) { const x = x0 + t * c, z = D - 2 + t * s; P.box(x, 36, z, x + 1, 38, z + 1, fr); P.box(x, 3, z, x + 1, 5, z + 1, fr); if (t < 1 || t > 10) P.box(x, 5, z, x + 1, 36, z + 1, fr); }
        P.box(x0 + 5, 15, D + 8, x0 + 6, 29, D + 9, K.chrome, 2); if (!P.far) for (let k = 0; k < 9; k++) P.set(x0 + 1 + ((k * 5) % 9), 0, D + (k % 4), K.frost, 1); continue; }
      P.box(x0, 36, D - 2, x1, 38, D - 1, fr); P.box(x0, 3, D - 2, x1, 5, D - 1, fr); P.box(x0, 5, D - 2, x0 + 1, 36, D - 1, fr); P.box(x1 - 1, 5, D - 2, x1, 36, D - 1, fr);
      const hx = d === 1 ? x0 + 1 : x1 - 2; P.box(hx, 15, D - 1, hx + 1, 29, D, K.chrome, 2);
      P.glint(x0 + 2, 26, 4, D - 2); P.glint(x0 + 3, 8, 2, D - 2);
      if (!P.far) for (let x = x0 + 1; x < x1 - 1; x++) if (hh(x, d, seed) < .6) P.set(x, 5, D - 2, K.frost, 1); }
    P.box(0, 38, 0, W, H, D - 1, head); P.box(1, 39, D - 2, W - 1, H - 1, D - 1, K.white, L);                             // the header box and its lit face
    P.textC(['ICE COLD', 'COLD BEER', 'BRRR'][v], W / 2, 44, D - 1, head, L);
    if (!P.far) { P.box(15, 20, D - 2, 18, 24, D - 1, K.yellow); P.set(16, 22, D - 2, K.red); }                  // a crooked price card on the middle door
  });

// ── the register, the lotto terminal and the scratch-off rack: surface pieces the counters are built from
export function registerAt(P, v) { const body = [0xd9cfb5, K.dark, K.red][v % 3], key = v === 1 ? K.alu : K.cream;
  P.box(0, 0, 1, 10, 3, 10, body); P.box(1, 1, 9, 9, 2, 10, shadeK(body, .75));                                   // drawer, its pull
  for (let r = 0; r < 3; r++) P.box(1, 3 + r, 3 + r * 2, 9, 4 + r, 10 - (2 - r), body);                             // the stepped keyboard
  if (!P.far) for (let r = 0; r < 3; r++) for (let x = 2; x < 9; x += 2) P.set(x, 4 + r, 8 - r, (x + r) % 6 === 0 ? K.red : key);
  P.box(4, 3, 1, 6, 6, 2, K.char); P.box(2, 6, 0, 8, 8, 2, K.char); P.box(3, 6, 2, 7, 7, 3, K.lime, GLOW); }
export function lottoAt(P) { const g = 0x8a93a3;
  P.box(1, 0, 1, 9, 3, 9, g); P.box(1, 3, 1, 9, 9, 5, K.char); P.box(2, 4, 5, 8, 8, 6, 0x3fa9f5, GLOW); if (!P.far) { P.box(3, 6, 6, 7, 7, 7, K.yellow, GLOW); P.set(3, 5, 6, K.white, GLOW); }
  P.box(3, 2, 9, 6, 3, 10, K.white); P.box(1, 9, 1, 9, 11, 4, K.yellow, LIT()); if (!P.far) for (const x of [2, 5, 7]) P.set(x, 10, 4, K.red); }
export function scratchAt(P, v) {   // a clear dispenser, 3 × 2 compartments, a ticket fanned out of each
  P.box(0, 0, 0, 15, 12, 1, K.char); P.box(0, 11, 0, 15, 12, 4, v ? K.blue : K.red);
  const T = [[K.yellow, K.red], [K.lime, K.purple], [K.pink, K.gold], [K.cyan, K.blue], [K.orange, K.green], [K.gold, K.ink]];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const x = 1 + c * 5, y = 1 + r * 5, t = T[(r * 3 + c + v * 2) % T.length];
    P.box(x, y, 1, x + 4, y + 4, 3, t[0]); if (!P.far) { P.box(x + 1, y + 1, 3, x + 3, y + 2, 4, K.alu, 2); P.set(x + 1, y + 3, 3, t[1]); P.set(x + 2, y + 3, 3, t[1]); } }
  for (const x of [0, 5, 10, 14]) P.box(x, 0, 3, x + 1, 11, 4, K.chrome, 2); P.box(0, 5, 3, 15, 6, 4, K.chrome, 2); }
export const register = obj({ id: 'store-register', name: 'Cash register', cat: 'counters', place: 'surface', foot: [2, 2], h: 0.4, tiers: ALL_STORE.concat('clothes', 'shoes', 'gold', 'barber', 'cakes', 'office'), tags: ['anywhere', 'cash', 'register'], variants: 3 },
  (P, o) => registerAt(P, o.v));
const lotto = obj({ id: 'store-lotto-terminal', name: 'Lotto terminal', cat: 'machines', place: 'surface', foot: [2, 2], h: 0.55, tiers: ['bodega', 'food', 'bottles', 'office'], tags: ['bodega', 'lotto', 'screen', 'lit'] }, P => lottoAt(P));
const scratch = obj({ id: 'store-scratch-rack', name: 'Scratch-off rack', cat: 'stock', place: 'surface', foot: [3, 1], h: 0.6, tiers: ['bodega', 'food', 'bottles', 'office'], tags: ['bodega', 'lotto', 'tickets'], variants: 2 },
  (P, o) => scratchAt(P, o.v));

// ── the counter behind plexiglass: candy rack in front, a ledge, plexi (framed, taped, a pass slot), and behind it the scratch-offs,
//    the lotto terminal and the register; LOTTO on the header
const counter = obj({ id: 'store-counter-bodega', name: 'Bodega counter (plexi)', cat: 'counters', foot: [10, 4], h: 2.4, tops: [0.7], tiers: ['bodega', 'food'], tags: ['bodega', 'counter', 'plexi', 'lotto', 'register', 'candy'], variants: 3 },
  (P, o) => { const { W, D, H, v, seed } = o, body = [K.red, K.green, K.woodD][v], top = [K.cream, K.white, K.bone][v], pz = 11;
    P.box(0, 0, 0, W, 13, D, body); P.box(0, 13, 0, W, 14, D, top); P.box(0, 0, D - 1, W, 2, D, K.char);            // counter, formica top, kick
    // candy rack set into the front: three stepped rows of bars, white lips
    P.clear(3, 2, D - 3, 31, 13, D); P.box(3, 2, D - 3, 31, 13, D - 2, K.char);
    for (let r = 0; r < 3; r++) { const y = 3 + r * 3, z = D - 2; P.box(3, y - 1, z, 31, y, D, K.white);
      for (let x = 4, n = 0; x + 2 <= 30; x += 3, n++) P.box(x, y, z, x + 2, y + 2, D - (r === 1 ? 1 : 0), pick(CHIPS, n * 5 + r + seed)[hh(n, r) < .5 ? 0 : 1]); }
    P.box(33, 3, D - 1, 47, 11, D, K.yellow); if (!P.far) for (const [x, y] of [[35, 8], [39, 5], [43, 8], [45, 4]]) P.box(x, y, D - 1, x + 2, y + 2, D, K.red);   // a lotto ad on the front
    // behind the plexi (the clerk's side, −z): scratch-offs, lotto terminal, register
    scratchAt(off(P, 2, 14, 3), v); lottoAt(off(P, 19, 14, 1)); registerAt(off(P, 31, 14, 0), v === 1 ? 1 : 0);
    // the plexi: posts, rails, a pass slot above the ledge, glints; the LOTTO plaque on the header rail
    const fr = K.alu; for (const x of [0, 17, 32, W - 1]) P.box(x, 14, pz, x + 1, H - 2, pz + 1, fr, 2);
    P.box(0, H - 3, pz, W, H - 2, pz + 1, fr, 2); P.box(0, 30, pz, W, 31, pz + 1, fr, 2); P.box(0, 18, pz, 17, 19, pz + 1, fr, 2); P.box(32, 18, pz, W, 19, pz + 1, fr, 2);
    for (const [x, y] of [[3, 22], [20, 33], [36, 22], [40, 36]]) P.glint(x, y, 4, pz);
    P.box(15, H - 11, pz - 1, 36, H - 2, pz + 2, K.yellow, LIT()); P.textC('LOTTO', 25.5, H - 4, pz + 2, K.red, LIT());
    // taped to the plexi: a WANTED flyer (a big-head silhouette), a lighter price card, a hand-drawn CASH card
    if (!P.far) { P.box(35, 20, pz + 1, 42, 29, pz + 2, K.white); P.box(35, 27, pz + 1, 42, 29, pz + 2, K.red); P.box(37, 22, pz + 1, 40, 26, pz + 2, K.ink); P.box(36, 20, pz + 1, 41, 22, pz + 2, K.ink);
      P.box(44, 32, pz + 1, 48, 36, pz + 2, K.orange); P.box(3, 32, pz + 1, 9, 36, pz + 2, K.cream); P.box(4, 34, pz + 2, 8, 35, pz + 3, K.green); }
    else P.box(35, 20, pz + 1, 42, 29, pz + 2, K.white);
    // on the ledge: a tray of lighters, the tip cup
    for (let x = 38; x < 44; x++) P.box(x, 14, 15, x + 1, 16, 16, pick([K.red, K.yellow, K.lime, K.blue, K.pink, K.orange], x + v));
    P.box(45, 14, 14, 48, 18, 17, K.frost, 1); if (!P.far) { P.box(45, 14, 14, 48, 15, 17, K.gold, 2); P.set(46, 15, 15, K.green); }
  });

// ── the wall behind the counter: the pack wall (lit header), and a pegboard of chargers, lighters, batteries, a clock, saint candles,
//    the convex mirror in the corner. A wall piece: mount it over the counter.
const backbar = obj({ id: 'store-backbar', name: 'Behind-the-counter wall', cat: 'fixtures', place: 'wall', foot: [10, 7], h: 0.45, mount: 0.8, tops: [], tiers: ['bodega', 'food'], tags: ['bodega', 'counter', 'wall', 'packs', 'pegboard', 'candles'], variants: 3 },
  (P, o) => { const { W, H, D, v, seed } = o, cab = [K.ink, K.woodD, K.maroon][v], peg = [K.kraft, K.white, K.kraft][v];
    P.box(0, 0, 0, 26, H, D, cab); P.clear(1, 1, 3, 25, 30, D);
    const PACK = [[K.red, K.white], [K.gold, K.white], [K.green, K.white], [K.blue, K.white], [K.ink, K.gold], [K.white, K.red], [K.purple, K.white]];
    for (let r = 0; r < 7; r++) { const y = 1 + r * 4; P.box(1, y, 3, 25, y + 1, D - 1, shadeK(cab, 1.4));
      for (let x = 2, n = 0; x + 2 <= 25; x += 2, n++) { const p = PACK[(((n / 3) | 0) + r * 2 + seed) % PACK.length];
        P.box(x, y + 1, 4, x + 2, y + 4, D - 1, p[0]); if (!P.far) P.box(x, y + 3, D - 2, x + 2, y + 4, D - 1, p[1]); } }
    P.box(1, 30, D - 1, 25, H - 1, D, K.red, LIT()); P.textC('SMOKES', 13, H - 2, D, K.white, LIT());
    // pegboard with hooks and blister cards
    P.box(26, 0, 0, W, H, 1, peg); if (!P.far) for (let y = 2; y < H; y += 3) for (let x = 28; x < W; x += 3) P.set(x, y, 1, shadeK(peg, .7));
    const cards = [[29, 22, K.white, K.ink], [34, 22, K.white, K.ink], [39, 23, K.orange, K.ink], [44, 22, K.yellow, K.red], [29, 12, K.cyan, K.white], [34, 13, K.pink, K.yellow], [39, 12, K.white, K.blue], [44, 13, K.lime, K.ink]];
    cards.forEach(([x, y, c, d], k) => { P.box(x + 1, y + 6, 1, x + 2, y + 7, 3, K.chrome, 2); P.box(x, y, 2, x + 4, y + 6, 3, c); if (!P.far) { P.box(x + 1, y + 1, 3, x + 3, y + 4, 4, d); if (k < 2) P.box(x + 1, y - 2, 2, x + 2, y, 3, K.ink); } });
    P.box(27, 6, 1, 49, 7, 6, shadeK(cab, 1.2));                                                                   // a low shelf: candles, a radio
    for (const [x, c] of [[28, K.green], [31, K.red], [34, K.blue]]) { P.box(x, 7, 2, x + 2, 11, 4, K.white, 1); P.box(x, 8, 4, x + 2, 10, 5, c); P.set(x, 11, 3, 0xffb020, GLOW); }
    P.box(38, 7, 1, 46, 11, 5, K.alu); P.box(39, 8, 5, 41, 10, 6, K.char); P.box(43, 8, 5, 45, 10, 6, K.char); P.box(41, 11, 3, 44, 12, 4, K.char);
    P.box(46, 28, 1, 50, 32, 2, K.white); P.box(47, 30, 2, 48, 32, 3, K.ink); P.box(48, 30, 2, 49, 31, 3, K.ink);   // the clock
    P.box(27, 29, 1, 31, 33, 3, K.chrome, 2); P.box(28, 30, 3, 30, 32, 4, K.glint, 2);                                // the convex mirror (watching the aisle)
  });

// ── the deli case: slanted glass (air, framed), meats on the low tray, cheeses on the shelf, a scale and paper on the steel top
const MEAT = [[0xf08aa0, 0xf7b5c5], [0x9c2a2a, 0xc94a4a], [0xf0d8b0, 0xfbeed4], [0x8b3a3a, 0xd0707a], [0xf2a06a, 0xf7c9a0]];
const deli = obj({ id: 'store-deli-case', name: 'Deli case', cat: 'cases', foot: [8, 4], h: 1.5, tops: [1.3], tiers: ['bodega', 'food'], tags: ['bodega', 'deli', 'meat', 'cheese', 'glass', 'lit'], variants: 2 },
  (P, o) => { const { W, D, H, v, seed } = o, body = [K.white, K.red][v], stripe = [K.red, K.white][v], L = LIT();
    P.box(0, 0, 0, W, 11, D, body); P.box(0, 0, D - 1, W, 2, D, K.steel, 2); P.box(0, 6, D - 1, W, 8, D, stripe);
    P.box(0, 11, 0, W, 12, D - 1, K.white, L); P.box(0, 24, 0, W, 26, 14, K.steel, 2); P.box(0, 12, 0, W, 24, 1, K.steel, 2);   // lit deck, steel top, clerk's doors
    const fz = y => D - 1 - Math.round((y - 12) * 6 / 12);                                                             // the slanted front
    for (const x of [0, 20, W - 1]) for (let y = 12; y < 24; y++) P.box(x, y, fz(y), x + 1, y + 1, fz(y) + 1, K.chrome, 2);
    for (let y = 12; y < 24; y++) for (const x of [0, W - 1]) P.box(x, y, 1, x + 1, y + 1, fz(y), body);             // solid ends
    P.box(0, 12, D - 2, W, 13, D - 1, K.chrome, 2);
    for (let x = 3; x < W - 3; x += 9) for (let t = 0; t < 4; t++) { const y = 15 + t; if (!P.far) P.set(x + t, y, fz(y), K.glint, 1); }
    // meats: logs along x, cut face at +x, two rows; price flags on pins
    for (let row = 0; row < 2; row++) for (let x = 1, n = 0; x + 8 <= W - 1; x += 9, n++) { const m = MEAT[(n + row * 2 + seed + v) % MEAT.length], z0 = row ? 9 : 3;
      P.box(x, 12, z0, x + 8, 15, z0 + 4, m[0]); P.box(x + 7, 12, z0, x + 8, 15, z0 + 4, m[1]);
      if (!P.far && m[0] === 0x9c2a2a) for (let t = 0; t < 3; t++) P.set(x + 1 + t * 2, 14, z0 + 3, 0xf4e6d8);
      if (!P.far && (n + row) % 2 === 0) { P.set(x + 3, 15, z0 + 2, K.alu); P.box(x + 3, 16, z0 + 2, x + 5, 17, z0 + 3, K.white); } }
    P.box(1, 18, 2, W - 1, 19, 9, K.frost, 1);                                                                         // the glass shelf
    for (let x = 2, n = 0; x + 5 <= W - 2; x += 7, n++) { const c = pick([K.yellow, K.orange, 0xfff5d6, 0xf4c542], n + v); P.box(x, 19, 3, x + 5, 22, 8, c); if (!P.far && n % 2) P.box(x, 19, 7, x + 5, 22, 8, K.red); }
    // on top: the scale (lit readout toward the customer), a roll of butcher paper, a stack of deli tubs
    P.box(27, 26, 3, 35, 28, 10, K.white); P.box(28, 28, 4, 34, 29, 9, K.steel, 2); P.box(29, 26, 10, 33, 28, 11, K.lime, GLOW);
    P.box(3, 26, 2, 16, 28, 4, K.white); P.box(2, 26, 2, 3, 28, 4, K.alu); P.box(16, 26, 2, 17, 28, 4, K.alu);
    P.cyl(21.5, 8.5, 2, 26, 28, K.white, 1);
  });
const slicer = obj({ id: 'store-slicer', name: 'Meat slicer', cat: 'machines', place: 'surface', foot: [2, 2], h: 0.45, tiers: ['bodega', 'food'], tags: ['bodega', 'deli', 'machine', 'blade'] },
  P => { P.box(1, 0, 1, 9, 3, 9, K.steel, 2); P.box(1, 2, 1, 9, 3, 9, K.white);
    for (let y = 3; y < 9; y++) for (let z = 1; z < 9; z++) if ((y + .5 - 5.8) ** 2 + (z + .5 - 5) ** 2 <= 11) P.box(6, y, z, 8, y + 1, z + 1, K.chrome, 2);   // the blade
    P.box(8, 5, 4, 9, 7, 6, K.red); P.box(1, 3, 2, 6, 4, 8, K.alu, 2); P.box(1, 4, 3, 6, 7, 7, 0x9c2a2a); P.box(5, 4, 3, 6, 7, 7, 0xc94a4a); P.box(0, 5, 4, 1, 6, 6, K.ink); });

// ── the ATM: a toppered box, a lit screen with a $, keypad, card and cash slots (the sim reads it as a safe)
const atm = obj({ id: 'store-atm', name: 'ATM', cat: 'machines', foot: [3, 3], h: 1.7, tiers: ['bodega', 'food', 'bottles', 'office', 'misc', 'gold', 'machines'], tags: ['anywhere', 'cash', 'atm', 'screen', 'lit'], variants: 3, sim: 'safe' },
  (P, o) => { const { W, D, H, v } = o, body = [K.blue, 0x8a93a3, K.ink][v], hi = [K.white, K.ink, K.yellow][v];
    P.box(1, 0, 1, W - 1, 30, D - 1, body); P.box(1, 0, D - 2, W - 1, 2, D - 1, K.char);
    P.box(3, 17, D - 2, 12, 26, D - 1, K.ink); P.box(4, 18, D - 2, 11, 25, D - 1, 0x1b2a55, GLOW); P.textC('$', 7.5, 24, D - 1, K.lime, GLOW); if (!P.far) P.box(5, 19, D - 1, 10, 20, D, K.white, GLOW);
    P.box(3, 10, D - 2, 10, 16, D - 1, K.char); if (!P.far) for (let y = 11; y < 16; y += 2) for (let x = 4; x < 9; x += 2) P.set(x, y, D - 1, K.chrome, 2);
    if (!P.far) { P.set(9, 15, D - 1, K.red); P.set(9, 13, D - 1, K.yellow); P.set(9, 11, D - 1, K.green); }
    P.box(10, 14, D - 2, 13, 15, D - 1, K.ink); P.set(12, 15, D - 1, K.lime, GLOW);
    P.box(4, 6, D - 2, 11, 8, D - 1, K.ink); P.box(4, 8, D - 2, 11, 9, D - 1, K.lime, GLOW);
    P.box(0, 30, 3, W, H, D - 1, hi, LIT()); P.textC('ATM', W / 2, H - 1, D - 1, v === 1 ? K.blue : K.red, LIT());
    if (!P.far) { P.box(2, 27, D - 1, 5, 29, D, K.orange); P.set(3, 0, D - 1, K.white); P.set(12, 0, D - 1, K.white); }   // a fee sticker; receipts on the floor
  });

// ── coffee: a cabinet, a backsplash, three airpots (REG / DECAF / HAZEL by colour), blue cups stacked, lids
const coffee = obj({ id: 'store-coffee-station', name: 'Coffee station', cat: 'counters', foot: [4, 2], h: 1.6, tops: [0.8], tiers: ['bodega', 'food', 'cakes'], tags: ['bodega', 'deli', 'coffee', 'self-serve'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, cab = [K.woodD, K.white][v], top = [K.cream, K.bone][v];
    P.box(0, 0, 0, W, 15, D, cab); P.box(0, 15, 0, W, 16, D, top); P.box(1, 1, D - 1, W - 1, 14, D, shadeK(cab, .85)); P.box(9, 2, D - 1, 11, 13, D, cab);
    P.box(0, 16, 0, W, H, 1, K.brown); P.textC('CAFE', W / 2, H - 2, 1, K.cream);
    [[1, K.ink, K.brown], [6, K.ink, K.orange], [11, K.alu, K.green]].forEach(([x, c, lab]) => { P.box(x, 16, 3, x + 4, 23, 7, c, c === K.alu ? 2 : 1); P.box(x, 18, 7, x + 4, 20, 8, lab); P.box(x + 1, 23, 4, x + 3, 25, 6, K.char); P.set(x + 2, 21, 7, K.char); });
    for (let y = 16; y < 24; y++) P.box(16, y, 4, 19, y + 1, 7, y % 2 ? K.blue : K.white); P.box(16, 16, 1, 19, 19, 3, K.white);
  });

// ── the newspaper rack: three slanted tiers, papers with mastheads and photos; a brick holds the top pile down
const PAPER = [K.red, K.blue, K.ink, K.green];
const news = obj({ id: 'store-news-rack', name: 'Newspaper rack', cat: 'racks', foot: [3, 2], h: 1.1, tiers: ['bodega', 'food', 'misc'], tags: ['bodega', 'news', 'papers', 'wire'], variants: 2 },
  (P, o) => { const { W, D, v, seed } = o, I = K.iron;
    for (const x of [0, W - 1]) { P.box(x, 0, 1, x + 1, 20, 2, I); P.box(x, 0, D - 2, x + 1, 8, D - 1, I); P.box(x, 7, 2, x + 1, 8, D - 2, I); }
    for (let t = 0; t < 3; t++) { const y = 2 + t * 6, z1 = D - 1 - t * 2; P.box(0, y - 1, z1 - 3, W, y, z1, I);
      for (let p = 0; p < 2; p++) { const x = 1 + p * 7, m = PAPER[(t * 2 + p + seed + v) % PAPER.length];
        P.box(x, y, z1 - 3, x + 6, y + 6, z1, K.cream); P.box(x, y + 5, z1 - 1, x + 6, y + 6, z1, m);
        if (!P.far) { P.box(x + 1, y + 4, z1 - 1, x + 5, y + 5, z1, K.ink); P.box(x + 1, y + 1, z1 - 1, x + 3, y + 3, z1, pick([0x7a8aa0, K.sky, K.orange], t + p)); P.box(x + 4, y + 2, z1 - 1, x + 5, y + 3, z1, K.alu); } } }
    P.box(2, 20, 4, 5, 22, 6, 0x9b4f3a);                                                                               // the brick
  });

// ── the bodega cat: a loaf (sleeps on counters, shelves, cases) and three coats
const COATS = [[0xff8a1f, 0xc0661c, K.white], [K.ink, K.ink, K.white], [0x8a8f99, 0x6d707a, K.white]];
const cat = obj({ id: 'store-cat-loaf', name: 'Bodega cat (loaf)', cat: 'clutter', place: 'surface', foot: [2, 1], h: 0.3, rot: 45, tiers: ['bodega', 'food', 'misc', 'bottles', 'machines'], tags: ['bodega', 'cat', 'animal', 'handmade'], variants: 3 },
  (P, o) => { const [c, s, w] = COATS[o.v];
    P.box(0, 0, 0, 7, 4, 5, c); P.set(0, 3, 0, -1); P.set(0, 3, 4, -1); if (!P.far && o.v !== 1) for (let x = 1; x < 6; x += 2) P.box(x, 3, 1, x + 1, 4, 4, s);
    P.box(6, 1, 0, 10, 5, 5, c); P.set(6, 5, 1, c); P.set(9, 5, 1, c);
    if (!P.far) { P.box(7, 1, 4, 10, 3, 5, w); P.set(8, 2, 4, 0xf08aa0); P.set(7, 3, 4, K.ink); P.set(9, 3, 4, K.ink); P.set(6, 5, 1, c); P.set(9, 5, 1, c); }
    P.box(0, 0, 4, 6, 1, 5, s); if (o.v === 1) P.box(4, 0, 4, 7, 1, 5, w);                                              // tail wrapped round the front, white paws
  });

// ── the ice-cream chest: sliding glass lid (air + rails), novelty boxes inside, HELADOS on the front
const icebox = obj({ id: 'store-ice-cream-chest', name: 'Ice cream chest', cat: 'coolers', foot: [6, 3], h: 0.9, tops: [0.9], tiers: ['bodega', 'food', 'cakes'], tags: ['bodega', 'cold', 'ice cream', 'glass'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, body = [K.white, 0x3fa9f5][v], ink = [K.blue, K.white][v];
    P.box(0, 0, 0, W, 16, D - 1, body); P.box(0, 0, 0, W, 2, D - 1, K.blue); P.clear(2, 8, 2, W - 2, 16, D - 3); P.box(2, 8, 2, W - 2, 9, D - 2, K.frost);
    for (let x = 2, n = 0; x + 3 <= W - 2; x += 3, n++) for (let z = 2; z + 3 <= D - 3; z += 4) P.box(x, 9, z, x + 3, 11 + ((n + z) % 3), z + 3, pick([K.pink, K.brown, K.yellow, K.red, K.cyan, K.white], n * 3 + z));
    P.box(0, 16, 0, W, 17, D - 1, K.steel, 2); P.clear(1, 16, 1, W - 1, 17, D - 2); P.box(W >> 1, 16, 0, (W >> 1) + 1, 17, D - 1, K.steel, 2);   // lid rails
    P.textC('HELADOS', W / 2, 14, D - 1, ink);
    for (const [x, c] of [[6, K.pink], [13, K.brown], [20, K.yellow]]) { P.box(x, 4, D - 1, x + 3, 8, D, c); P.box(x + 1, 2, D - 1, x + 2, 4, D, K.woodL); }
  });

// ── a stack of cases by the cooler: soda 12s, a kraft case, water in shrink-wrap; knocked a little out of true
const CASE = [[K.red, K.white], [K.kraft, K.kraftD], [0xcfe6f7, K.blue], [K.green, K.yellow], [K.blue, K.white]];
const cases = obj({ id: 'store-case-stack', name: 'Stacked cases', cat: 'clutter', foot: [2, 2], h: 0.9, rot: 45, tops: [0.9], tiers: ['bodega', 'food', 'bottles'], tags: ['bodega', 'stock', 'backroom', 'handmade'], variants: 3 },
  (P, o) => { let y = 0; for (let k = 0; y < 18; k++) { const c = CASE[(k + o.v * 2 + o.seed) % CASE.length], h = c[0] === K.kraft ? 5 : 4, dx = (k % 2) * (k % 3 === 0 ? 1 : 0), dz = ((k + o.v) % 3 === 1) ? 1 : 0; if (y + h > 18) break;
    P.box(dx, y, dz, 9 + dx, y + h, 9 + dz, c[0]); if (!P.far) P.box(dx, y + 1, 8 + dz, 9 + dx, y + 2, 9 + dz, c[1]); if (!P.far && c[0] === 0xcfe6f7) for (let x = 1; x < 9; x += 2) P.set(x + dx, y + h - 1, 1 + dz, K.blue); y += h; } });

export default [chips, cereals, cans, gondola, cooler, counter, backbar, deli, slicer, atm, coffee, news, cat, icebox, cases, register, lotto, scratch];
