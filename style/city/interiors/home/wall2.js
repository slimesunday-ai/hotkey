// Home objects · catalogue v2 · wall and floor: gilded frames with invented paintings, stencil art, a pop triptych, a fashion-editorial
// print, shaped neons, sick rugs (tiger, checker, zebra, banknote, black-and-gold persian), a gold chandelier and a disco ball.
// Every image is invented (a Dazed / street-art energy, never a copy of a real work, magazine or brand).
import { def, K, pick, cyl, line, glow, LIT, shade, mix, hash, rng, txt, txtTop, M3, M5, face } from './lib.js';
import { flex, gilded } from './bits.js';

const inC = (i, j, cx, cy, r) => Math.hypot(i + .5 - cx, j + .5 - cy) <= r, inR = (i, j, a, b, c, d) => i >= a && i < c && j >= b && j < d;

// ── the paintings: img(i, j, w, h) → colour, j = 0 at the bottom (walls.js picture())
const PAINT = {
  saint: (i, j, w, h) => {   // a big-head saint in a red robe, a gold halo, on the phone
    const hx = w / 2, hy = h * .66;
    if (inR(i, j, 17, 7, 22, 16)) return inR(i, j, 18, 11, 21, 15) ? K.cyan : K.ink;                          // the flip phone, its lit screen
    if (inR(i, j, 16, 6, 23, 9)) return K.skin[2];                                                            // the hand
    if (inR(i, j, 7, 19, 22, 33)) { if (j >= 30) return K.ink; if (j === 25 && (i === 10 || i === 11 || i === 18 || i === 19)) return K.ink;
      if (j === 26 && inR(i, j, 10, 26, 20, 27) && !(i > 11 && i < 18)) return shade(K.skin[2], .8); if (j === 21 && i > 12 && i < 17) return K.red; return K.skin[2]; }
    if (inR(i, j, 12, 16, 17, 19)) return K.skin[2];
    if (j < 17 && i > 2 && i < w - 3) return Math.abs(i + .5 - hx) > 10 || j === 16 ? K.gold : K.red;
    const d = Math.hypot(i + .5 - hx, j + .5 - hy); if (d > 9.5 && d < 11.5) return K.gold;
    return ((Math.atan2(j - hy, i - hx) * 5.1 + 20) | 0) & 1 ? K.navy : K.cobalt; },
  still: (i, j, w, h) => {   // still life: fruit, a brick of cash, a gold chain
    if (j < 10) return j === 9 ? shade(K.walnut, 1.2) : K.walnut;
    if (inR(i, j, 17, 10, 26, 16)) return (i === 21) ? K.white : ((j - 10) % 2 ? K.cash : K.cashD);           // cash bricks
    for (const [cx, cy, c] of [[7, 17, K.orange], [11, 18, K.red], [9, 21, K.yellow], [5, 21, K.grass]]) if (inC(i, j, cx, cy, 2.6)) return c;
    if (inR(i, j, 3, 10, 14, 15)) return j === 14 ? K.bone : K.white;                                         // the bowl
    if (j === Math.round(10 + Math.abs(i - 21) * .4) && i > 14 && i < 28) return K.gold;                      // a chain draped over the table edge
    return inC(i, j, w * .7, h * .78, 4) ? shade(K.oxblood, 1.3) : K.oxblood; },
  poodle: (i, j, w, h) => {   // a pink poodle in shades and a gold chain
    const fl = [[14, 22, 6], [14, 30, 5], [9, 13, 4], [19, 13, 4], [14, 36, 3.5], [8, 5, 3], [20, 5, 3]];
    if (j > 23 && j < 27 && i > 9 && i < 20) return j === 25 ? K.ink : (i === 14 ? K.ink : K.ink);            // the shades
    if (j === 19 && i > 9 && i < 19) return K.gold;                                                           // the chain
    if (inR(i, j, 13, 16, 16, 19) && j === 16) return K.gold;
    for (const [cx, cy, r] of fl) if (inC(i, j, cx, cy, r)) return (hash(i, j, 3) > .7) ? shade(K.white, .9) : K.white;
    return K.pink; },
  dollar: (i, j, w, h) => {   // a burning bill on black
    if (inR(i, j, 1, 1, w - 1, 7)) return (i === (w >> 1)) ? K.white : inC(i, j, w / 2, 4, 2) ? K.cream : K.cash;
    const f = 7 + ((Math.sin(i * 1.7) + 1) * 2.4 | 0) + (i % 3); if (j >= 7 && j < f) return j > f - 2 ? K.yellow : K.orange;
    return 0x1f1f24; },
  cone: (i, j, w, h) => {   // a melting cone on pink
    if (j < 7 && Math.abs(i + .5 - w / 2) < j * .5 + .5) return (i + j) % 2 ? 0xd9a25e : 0xc98a4b;
    if (inC(i, j, w / 2, 9, 3.4)) return K.white; if (j >= 5 && j < 9 && (i === 2 || i === w - 3) && j > 9 - (i % 4) - 2) return K.white;
    return inC(i, j, w / 2, 9.5, 4.2) ? K.white : K.pink; },
  pearls: (i, j, w, h) => {   // a big-head profile in pearls on teal
    if (inR(i, j, 2, 5, 8, 12)) return j === 9 && i === 6 ? K.ink : K.skin[3]; if (inR(i, j, 1, 10, 7, 13)) return K.ink;
    if (j === 4 && i > 1 && i < 8) return i % 2 ? K.white : K.bone; if (j < 4) return K.purple; return K.teal; },
};

export const frameGilded = def({ id: 'frame-gilded', name: 'Gilded frame', cat: 'wall', place: 'wall', foot: [7, 9], h: 0.2, mount: 0.6,
  tiers: ['house', 'penthouse'], tags: ['art', 'gilded', 'statement'], variants: 3, vnames: ['saint on the phone', 'still life with stacks', 'poodle in a chain'], far: true,
  game: flex('grail', 40, 'drop'),
  build(V, { variant = 0 } = {}) { gilded(V, 35, 45, PAINT[pick(['saint', 'still', 'poodle'], variant)]); } });

export const frameGildedSmall = def({ id: 'frame-gilded-small', name: 'Small gilded frame', cat: 'wall', place: 'wall', foot: [3, 4], h: 0.2, mount: 1.2,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['art', 'gilded', 'small'], variants: 3, vnames: ['burning bill', 'melting cone', 'pearls'],
  game: flex('rare', 12),
  build(V, { variant = 0 } = {}) { gilded(V, 15, 20, PAINT[pick(['dollar', 'cone', 'pearls'], variant)]); } });

export const artStencil = def({ id: 'art-stencil', name: 'Stencil canvas', cat: 'wall', place: 'wall', foot: [6, 4], h: 0.1, mount: 1.1,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['art', 'stencil', 'street'], variants: 3, vnames: ['clown-nose cop', 'pigeon with the bag', 'crying diamond'], far: true,
  game: flex('rare', 15),
  build(V, { variant = 0, seed = 1 } = {}) {
    V.box(0, 0, 0, 30, 20, 1, (x, y) => hash(x, y, seed) > .9 ? K.bone : K.cream);                                        // raw canvas
    const s = (x, y, c) => V.set(x, y, 1, c);
    if (variant === 0) { for (let x = 9; x < 21; x++) for (let y = 3; y < 16; y++) { const cap = y >= 12 && y < 15, brim = y === 12 && x < 22, head = inC(x, y, 15, 8, 5);
        if (cap || brim || head) s(x, y, cap && x === 15 && y === 13 ? K.cream : K.ink); }                                  // cap with a badge, the head
      for (const x of [13, 17]) s(x, 9, K.cream); for (let x = 12; x < 19; x++) s(x, 5, K.cream); s(15, 7, K.red); s(15, 8, K.red); s(16, 7, K.red); s(16, 8, K.red);   // eyes, a grin, the red nose
      for (let y = 0; y < 3; y++) for (let x = 7; x < 23; x++) s(x, y, K.ink); }                                            // shoulders
    if (variant === 1) { for (let x = 6; x < 18; x++) for (let y = 4; y < 14; y++) if (((x + .5 - 12) / 6) ** 2 + ((y + .5 - 8) / 4) ** 2 <= 1) s(x, y, K.ink);   // the pigeon
      for (let x = 4; x < 8; x++) for (let y = 11; y < 16; y++) if (inC(x, y, 6, 13, 2.3)) s(x, y, K.ink); s(4, 13, K.cream); s(3, 13, K.orange);   // head, eye, beak
      for (let x = 16; x < 22; x++) s(x, 6 + ((x - 16) >> 1), K.ink); for (const x of [10, 13]) { s(x, 3, K.ink); s(x, 2, K.ink); }        // tail, legs
      for (let x = 19; x < 26; x++) for (let y = 2; y < 9; y++) if (inC(x, y, 22.5, 5, 3.3)) s(x, y, K.lime); for (const [x, y] of [[22, 6], [22, 5], [22, 4], [21, 6], [23, 4]]) s(x, y, K.ink);   // the bag, its $
      line(V, 20, 10, 1, 21, 8, 1, K.ink); }
    if (variant === 2) { for (let x = 8; x < 22; x++) for (let y = 4; y < 17; y++) { const top = y >= 13, inside = top ? Math.abs(x + .5 - 15) < 7 - (y - 13) * .5 : Math.abs(x + .5 - 15) < (y - 4) * .75;
        const edge = inside && !(top ? Math.abs(x + .5 - 15) < 6 - (y - 13) * .5 && y < 16 : Math.abs(x + .5 - 15) < (y - 4) * .75 - 1.2 && y > 5); if (edge || (inside && y === 13)) s(x, y, K.ink); }
      for (const x of [12, 18]) { s(x, 10, K.ink); for (let y = 2; y < 9; y++) if ((y + x) % 3) s(x + (x > 15 ? 1 : -1), y, K.cyan); } }   // eyes, cyan tears
    for (let k = 0; k < 6; k++) { const x = 3 + ((hash(k, seed, 5) * 24) | 0); for (let y = 1 + (k % 3); y < 4 + (k % 3); y++) if (!V.has(x, y, 1)) s(x, y, K.ink); }   // drips
  } });

export const artTriptych = def({ id: 'art-triptych', name: 'Pop triptych', cat: 'wall', place: 'wall', foot: [10, 4], h: 0.15, mount: 1.2,
  tiers: ['house', 'penthouse'], tags: ['art', 'pop', 'repetition'], variants: 2, vnames: ['pink · yellow · cyan', 'red · lime · purple'], far: true,
  game: flex('epic', 25),
  build(V, { variant = 0 } = {}) {
    const BG = variant ? [K.red, K.lime, K.purple] : [K.pink, K.yellow, K.cyan], SK = variant ? [K.skin[5], K.skin[2], K.skin[0]] : [K.skin[4], K.cyan, K.skin[1]], HR = variant ? [K.ink, K.pink, K.yellow] : [K.yellow, K.red, K.ink];
    for (let k = 0; k < 3; k++) { const x0 = 1 + k * 17; V.box(x0, 1, 0, x0 + 15, 19, 2, BG[k]);
      face(V, x0 + 3, 4, 2, 9, 12, { skin: SK[k], hair: HR[k], lids: k === 1, mouth: k === 2 ? K.gold : K.ink });                        // three moods of the same big head
      V.box(x0 + 3, 1, 2, x0 + 12, 4, 3, pick([K.ink, K.white, K.cobalt], k)); }                                                     // shoulders
  } });

export const artEditorial = def({ id: 'art-editorial', name: 'Editorial print', cat: 'wall', place: 'wall', foot: [4, 5], h: 0.1, mount: 1.2,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['art', 'fashion', 'flash photo'], variants: 3, vnames: ['red flash', 'cobalt flash', 'acid lime'],
  game: flex('rare', 10),
  build(V, { variant = 0 } = {}) {
    const [bg, sk, fur] = pick([[K.red, K.skin[3], K.cream], [K.cobalt, K.skin[1], K.pink], [K.lime, K.skin[4], K.white]], variant);
    V.box(0, 0, 0, 20, 25, 2, K.ink); V.box(1, 1, 1, 19, 24, 2, K.white); V.box(2, 2, 1, 18, 23, 2, bg);                             // frame, mat, the flash backdrop
    V.box(4, 2, 1, 16, 7, 2, fur); for (let x = 4; x < 16; x += 2) V.set(x, 7, 1, fur);                                             // a fur collar
    V.box(6, 7, 1, 14, 17, 2, sk); V.box(5, 15, 1, 15, 19, 2, K.ink); V.box(6, 11, 1, 14, 13, 2, K.ink); V.set(11, 12, 1, K.glint);   // the big head, hair, shades with a flash glint
    V.box(8, 8, 1, 12, 9, 2, K.red); txt(V, M3('NOPE'), 3, 22, 1, K.white);                                                      // lips, the masthead (an invented title)
  } });

// shaped neons on smoked acrylic: the tube is the outline of a filled shape (inside with an outside neighbour)
const SHAPES = {
  heart: (x, y) => { const u = (x - 15) / 8, v = (y - 11) / 7.5; return ((u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0) || (y >= 1 && y < 6 && (x === 12 || x === 19) && y > 5 - (x % 3)); },
  crown: (x, y) => y >= 3 && y < 16 && x >= 5 && x < 25 && (y < 9 || [8, 15, 22].some(c => Math.abs(x + .5 - c) < (16 - y) * .45)),
  cherry: (x, y) => inC(x, y, 10, 6, 4.2) || inC(x, y, 20, 6, 4.2) || (Math.abs(x - (10 + (y - 9) * .45)) < 1 && y >= 9 && y < 17) || (Math.abs(x - (20 - (y - 9) * .45)) < 1 && y >= 9 && y < 17) || (y === 16 && x > 12 && x < 18),
  bolt: (x, y) => { const pts = [[18, 18], [8, 9], [14, 9], [10, 1], [22, 11], [16, 11]]; let c = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y + .5) !== (yb > y + .5) && x + .5 < (xb - xa) * (y + .5 - ya) / (yb - ya) + xa) c = !c; } return c; },
};
export const neonShapes = def({ id: 'neon-shape', name: 'Shaped neon', cat: 'lights', place: 'wall', foot: [6, 4], h: 0.1, mount: 1.5,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['neon', 'glow', 'hypebeast'], variants: 4, vnames: ['drip heart', 'crown', 'cherries', 'bolt'], far: true,
  game: flex('common', 6),
  build(V, { variant = 0 } = {}) {
    const f = SHAPES[pick(['heart', 'crown', 'cherry', 'bolt'], variant)], c = pick([K.pink, K.yellow, K.red, K.cyan], variant);
    for (let x = 0; x < 30; x++) for (let y = 0; y < 20; y++) { const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => f(x + a, y + b));
      if (near) V.set(x, y, 0, 0x2a3350, 1);
      if (f(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !f(x + a, y + b))) V.set(x, y, 1, variant === 2 && y > 9 ? K.lime : c, LIT); }
  } });

// ── rugs
export const rugTiger = def({ id: 'rug-tiger', name: 'Tiger rug', cat: 'rugs', place: 'floor', foot: [8, 11], h: 0.15, rot: 45,
  tiers: ['house', 'penthouse'], tags: ['tiger', 'statement', 'flex'], variants: 3, vnames: ['orange', 'white tiger', 'gold'], far: true,
  game: flex('epic', 25),
  build(V, { variant = 0 } = {}) {
    const [fur, st, l] = pick([[K.orange, K.ink, 0], [K.white, K.ink, 0], [K.gold, K.ink, 2]], variant);
    const seg = (x, z, a, b, c, d, w) => { const vx = c - a, vz = d - b, t = Math.max(0, Math.min(1, ((x - a) * vx + (z - b) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - a - vx * t, z - b - vz * t) < w; };
    for (let x = 0; x < 40; x++) for (let z = 0; z < 55; z++) { const X = x + .5, Z = z + .5;
      const body = ((X - 20) / 9.5) ** 2 + ((Z - 25) / 16) ** 2 <= 1, head = Math.hypot(X - 20, Z - 44) < 7.2 || Math.hypot(X - 14.5, Z - 49.5) < 2.6 || Math.hypot(X - 25.5, Z - 49.5) < 2.6;
      const legs = seg(X, Z, 15, 34, 4, 43, 2.6) || seg(X, Z, 25, 34, 36, 43, 2.6) || seg(X, Z, 15, 14, 4, 5, 2.6) || seg(X, Z, 25, 14, 36, 5, 2.6), tail = seg(X, Z, 20, 10, 26, 2, 1.3) || seg(X, Z, 26, 2, 33, 1.5, 1.3);
      if (!(body || head || legs || tail)) continue;
      const stripe = !head && ((Z * .55 + Math.sin(X * .45) * 1.6 + 40) % 4.2) < 1.3 && Math.abs(X - 20) > 1.5, paw = !body && Math.min(Math.hypot(X - 4, Z - 43), Math.hypot(X - 36, Z - 43), Math.hypot(X - 4, Z - 5), Math.hypot(X - 36, Z - 5)) < 2.2;
      V.set(x, 0, z, stripe || (tail && Z < 3) ? st : paw ? shade(fur, .85) : fur, l);
      if (head) { V.set(x, 1, z, fur, l); const eye = Math.hypot(X - 17, Z - 46) < 1.2 || Math.hypot(X - 23, Z - 46) < 1.2;
        const snout = Math.hypot(X - 20, Z - 40) < 3.4, forehead = ((X * 1.3 + Z) % 5 < 1) && Z > 45 && Math.abs(X - 20) < 5;
        if (eye) V.set(x, 2, z, K.yellow); else if (snout) V.set(x, 2, z, Math.hypot(X - 20, Z - 42) < 1.3 ? K.pink : Z < 38.5 ? K.oxblood : K.white); else if (forehead) V.set(x, 2, z, st); } }
    for (const x of [17, 22]) V.set(x, 2, 37, K.white);                                                                            // fangs
  } });

export const rugChecker = def({ id: 'rug-checker', name: 'Checkerboard rug', cat: 'rugs', place: 'floor', foot: [8, 8], h: 0.05, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['checker', 'skate', 'graphic'], variants: 3, vnames: ['black + white', 'pink + lime', 'red + cream'], far: true,
  game: flex('rare', 8),
  build(V, { variant = 0 } = {}) {
    const [a, b] = pick([[K.ink, K.white], [K.pink, K.lime], [K.red, K.cream]], variant);
    for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) V.set(x, 0, z, (x < 2 || z < 2 || x > 37 || z > 37) ? a : (((x - 2) / 4.5 | 0) + ((z - 2) / 4.5 | 0)) & 1 ? a : b);
  } });

export const rugZebra = def({ id: 'rug-zebra', name: 'Zebra hide rug', cat: 'rugs', place: 'floor', foot: [7, 10], h: 0.05, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['zebra', 'hide', 'statement'], variants: 3, vnames: ['classic', 'hot pink', 'gold'], far: true,
  game: flex('rare', 15),
  build(V, { variant = 0 } = {}) {
    const [a, b, l] = pick([[K.white, K.ink, 0], [K.pink, K.ink, 0], [K.cream, K.gold, 2]], variant);
    for (let x = 0; x < 35; x++) for (let z = 0; z < 50; z++) { const X = x + .5, Z = z + .5, u = Math.abs(X - 17.5), v = Math.abs(Z - 25);
      const body = (u / 12) ** 3 + (v / 19) ** 3 <= 1, tabs = (u > 10 && u < 17.5 && Math.abs(v - 16) < 3.5) || (u < 3 && Z > 44 && Z < 50) || (u < 1.5 && Z < 6);
      if (!(body || tabs)) continue; const s = ((Z + Math.sin(X * .32) * 3.2 + Math.abs(X - 17.5) * .15) % 5.5) < 2.1; V.set(x, 0, z, s ? b : a, s ? l : 0); }
  } });

export const rugBanknote = def({ id: 'rug-banknote', name: 'Banknote rug', cat: 'rugs', place: 'floor', foot: [11, 5], h: 0.05, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['money', 'graphic', 'statement'], variants: 3, vnames: ['greenback', 'dye-pack pink', 'gold'], far: true,
  game: flex('rare', 15),
  build(V, { variant = 0 } = {}) {
    const [p, d, l] = pick([[0x9fd89a, K.cashD, 0], [0xffb3d0, K.plum, 0], [K.cream, K.gold, 2]], variant);
    for (let x = 0; x < 55; x++) for (let z = 0; z < 25; z++) { const e = x < 2 || z < 2 || x > 52 || z > 22, g = (x + z) % 4 === 0 && (x < 5 || x > 49 || z < 4 || z > 20), ov = ((x + .5 - 27.5) / 9) ** 2 + ((z + .5 - 12.5) / 8) ** 2;
      V.set(x, 0, z, e || g ? d : ov <= 1 ? (ov > .78 ? d : K.cream) : p, e ? l : 0); }
    for (let x = 22; x < 33; x++) for (let z = 7; z < 20; z++) { const X = x + .5, Z = z + .5; if (X > 22.5 && X < 32.5 && Z > 11 && Z < 20) V.set(x, 0, z, Z > 17 ? K.ink : K.skin[2]); }   // the big head in the oval, facing the viewer
    for (const x of [24, 29]) V.set(x, 0, 14, K.ink); for (let x = 26; x < 29; x++) V.set(x, 0, 12, K.ink);
    for (const [x0, z0] of [[4, 3], [40, 3], [4, 17], [40, 17]]) txtTop(V, M3('100'), x0, z0, 0, d, l);                                 // corner numerals, reading from the front
  } });

export const rugPersianGold = def({ id: 'rug-persian-gold', name: 'Black-and-gold persian', cat: 'rugs', place: 'floor', foot: [10, 7], h: 0.1, rot: 45,
  tiers: ['house', 'penthouse'], tags: ['classic', 'gold', 'flex'], variants: 2, vnames: ['black + gold', 'oxblood + gold'], far: true,
  game: flex('epic', 20),
  build(V, { variant = 0 } = {}) {
    const F = variant ? K.oxblood : 0x1f1f24, T = K.cream;
    for (let x = 0; x < 50; x++) for (let z = 0; z < 35; z++) {
      if (x < 2 || x > 47) { if (z % 2 === 0 && z > 0 && z < 34) V.set(x, 0, z, K.gold, 2); continue; }                               // gold fringe
      const u = x - 2, d = Math.min(u, 45 - u, z, 34 - z), m = Math.abs(u - 22.5) / 12 + Math.abs(z - 17) / 8.5;
      let c = F, raised = false;
      if (d === 0 || d === 4) { c = K.gold; raised = true; } else if (d < 4) c = ((u + z) % 3 === 0) ? K.gold : F;                        // raised gold trim, a gold-flecked border
      else if (m < .22) { c = K.gold; raised = true; } else if (m < .34) c = T; else if (m < .42) c = K.gold; else if ((u % 7 === 3 && z % 6 === 3)) c = K.gold;   // the medallion, scattered florets
      V.set(x, 0, z, c, c === K.gold ? 2 : 0); if (raised) V.set(x, 1, z, K.gold, 2); }
  } });

// ── ceiling
export const chandelier = def({ id: 'chandelier-gold', name: 'Gold chandelier', cat: 'lights', place: 'ceiling', foot: [6, 6], h: 1.0,
  tiers: ['house', 'penthouse'], tags: ['chandelier', 'gold', 'flex'], variants: 2, vnames: ['gold + crystal', 'black + gold'],
  game: flex('epic', 20),
  build(V, { variant = 0 } = {}) {
    const m = variant ? 0x1f1f24 : K.gold, l = variant ? 1 : 2;
    V.box(13, 19, 13, 17, 20, 17, m, l); for (let y = 12; y < 19; y++) V.set(15, y, 15, (y & 1) ? m : K.gold, 2);                           // the ceiling rose, a chain
    cyl(V, 15, 15, 3, 7, 12, m, l); cyl(V, 15, 15, 2, 4, 7, m, l); V.box(14, 2, 14, 16, 4, 16, K.gold, 2);                                   // the body, the finial
    for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2, x = 15 + Math.cos(t) * 11, z = 15 + Math.sin(t) * 11;
      line(V, 15 + Math.cos(t) * 2.5, 9, 15 + Math.sin(t) * 2.5, x, 9, z, m, l); V.box(Math.round(x) - 1, 9, Math.round(z) - 1, Math.round(x) + 1, 10, Math.round(z) + 1, K.gold, 2);   // arms, candle cups
      V.box(Math.round(x) - 1, 10, Math.round(z) - 1, Math.round(x), 12, Math.round(z), K.cream, glow()); V.set(Math.round(x) - 1, 12, Math.round(z) - 1, K.amber, LIT);   // candle bulbs
      for (let y = 6; y < 9; y++) V.set(Math.round(x) - 1, y, Math.round(z), K.glint, 1); }                                                 // crystal drops
  } });

export const discoBall = def({ id: 'disco-ball', name: 'Disco ball', cat: 'lights', place: 'ceiling', foot: [2, 2], h: 0.6,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['disco', 'party', 'mirror'], variants: 2, vnames: ['mirror', 'gold mirror'],
  game: flex('common', 5),
  build(V, { variant = 0 } = {}) {
    for (let y = 8; y < 12; y++) V.set(5, y, 5, K.steelD, 2);
    for (let x = 0; x < 10; x++) for (let y = 0; y < 9; y++) for (let z = 0; z < 10; z++) if (Math.hypot(x + .5 - 5, y + .5 - 4.5, z + .5 - 5) <= 4.4)
      V.set(x, y, z, hash(x, y * 7 + z, 9) > .8 ? K.white : ((x + y + z) & 1) ? (variant ? K.gold : K.chrome) : (variant ? shade(K.gold, .8) : K.steelL), hash(x, y * 7 + z, 9) > .8 ? LIT : 2);
  } });

export const WALL2 = [frameGilded, frameGildedSmall, artStencil, artTriptych, artEditorial, neonShapes, rugTiger, rugChecker, rugZebra, rugBanknote, rugPersianGold, chandelier, discoBall];
