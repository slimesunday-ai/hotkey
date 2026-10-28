// STORE OBJECTS · sneakers, streetwear and the barber (owner: the store-objects agent). The shoe wall and its grail under acrylic,
// racks of hoodies, a big-head mannequin in a fit, the fitting room with somebody's kicks under the curtain; the chair, the mirror
// station, the clipper cart, the styles poster and the waiting chairs.
import { obj, K, LIT, GLOW, hh, pick, shadeK, sign, off } from './lib.js';

// ── one sneaker in profile (toe toward +x), its side facing +z. c = [upper, block (heel + toe), sole, lace]
const PROFILE = ['BB.L....', 'BUUL....', 'BUUUULL.', 'BUUMUUAA', 'SSSSSSSS'];   // top → bottom, toe toward +x: heel tab, tongue, laces, toe cap, a mark
export function shoe(P, x, y, z0, z1, c) {
  if (P.far) { const ex = x - (x & 1), ey = y + (y & 1);   // far (wave 2): sole, upper with heel block and toe cap, the collar — a sneaker at 0.1
    P.box(ex, ey, z0, ex + 8, ey + 2, z1, c[2]); P.box(ex, ey + 2, z0, ex + 8, ey + 4, z1, c[0]); P.box(ex + 6, ey + 2, z0, ex + 8, ey + 4, z1, c[1]); P.box(ex, ey + 2, z0, ex + 2, ey + 6, z1, c[1]); P.box(ex + 2, ey + 4, z0, ex + 4, ey + 6, z1, c[0]); return; }
  const col = { U: c[0], B: c[1], A: c[1], S: c[2], L: c[3], M: c[3] };
  PROFILE.forEach((row, j) => { const yy = y + 4 - j; for (let i = 0; i < 8; i++) { const ch = row[i]; if (ch === '.') continue;
    const k = P.far && (ch === 'L' || ch === 'M') ? 'U' : ch; P.box(x + i, yy, z0, x + i + 1, yy + 1, z1, ch === 'M' ? c[0] : col[k]); if (ch === 'M' && !P.far) P.set(x + i, yy, z1 - 1, col.M); } });
}
const KICKS = [[[K.red, K.ink, K.white, K.white], [K.white, K.blue, K.white, K.white], [K.green, K.yellow, 0xc98a4b, K.white], [K.ink, K.pink, K.white, K.pink], [K.white, K.red, K.white, K.ink], [K.purple, K.lime, K.white, K.white]],
  [[K.ink, K.lime, K.ink, K.lime], [K.lime, K.ink, K.white, K.ink], [K.cyan, K.pink, K.white, K.white], [K.ink, K.cyan, K.white, K.cyan], [K.orange, K.ink, K.ink, K.white], [K.white, K.lime, K.ink, K.lime]],
  [[K.white, K.white, K.white, K.white], [K.ink, K.ink, K.ink, K.white], [0xa7a9b1, K.white, K.white, K.ink], [K.cream, 0xc98a4b, 0xc98a4b, K.white], [K.white, K.ink, 0xc98a4b, K.white], [K.ink, K.white, K.white, K.ink]]];
const SHOES = ['shoes', 'clothes'];

// ── the shoe wall: slatwall, four rows of floating acrylic shelves, one shoe per shelf, a lit strip across the top (a wall piece)
const shoewall = obj({ id: 'store-shoe-wall', name: 'Shoe wall', cat: 'racks', place: 'wall', foot: [8, 8], h: 0.35, mount: 0.3, tiers: SHOES, tags: ['sneakers', 'slatwall', 'drops', 'lit'], variants: 3 },
  (P, o) => { const { W, H, v, seed } = o, slat = [K.white, K.ink, K.pink][v]; P.box(0, 0, 0, W, H, 1, slat); for (let y = 2; y < H - 2; y += P.far ? 6 : 3) P.box(0, y, 0, W, y + 1, 1, shadeK(slat, v === 1 ? 1.6 : .86));
    P.box(0, H - 2, 0, W, H, 3, v === 1 ? K.lime : K.ink); P.box(1, H - 2, 3, W - 1, H - 1, 4, 0xfff8e0, GLOW);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = 1 + c * 13, y = 2 + r * 9 + (r & 1), k = (r * 3 + c + seed) % 6;   // shelf rows on whole 0.1 cubes
      P.box(x, y, 1, x + 12, y + 1, 6, K.frost, 1); P.box(x + 5, y - 1, 1, x + 7, y, 2, K.chrome, 2);
      if ((r * 3 + c) % 7 === 5) { if (!P.far) P.box(x + 4, y + 1, 4, x + 8, y + 3, 5, K.white); continue; }   // one shelf sold out: just the card
      shoe(P, x + 1 + ((r + c) % 2), y + 1, 2, 5, KICKS[v][k]); if (!P.far) P.box(x + 10, y + 1, 5, x + 12, y + 2, 6, K.white); } });
const bench = obj({ id: 'store-tryon-bench', name: 'Try-on bench', cat: 'fixtures', foot: [6, 2], h: 0.55, tops: [0.45], seat: 0.45, tiers: SHOES, tags: ['sneakers', 'seating', 'bench'], variants: 2 },
  (P, o) => { const { W, D, v } = o, pad = [K.ink, K.orange][v], base = [K.woodL, K.ink][v];
    for (const x of [1, W - 3]) P.box(x, 0, 1, x + 2, 6, D - 1, base); P.box(0, 6, 0, W, 9, D, pad); if (!P.far) for (let x = 4; x < W; x += 5) P.set(x, 8, D - 1, shadeK(pad, .7));
    P.box(2, 9, 1, 11, 11, 7, K.orange); P.box(2, 9, 1, 11, 10, 7, K.ink); P.box(3, 11, 2, 10, 12, 6, K.white); P.box(12, 9, 1, 21, 11, 2, K.orange);   // an open shoebox, tissue, the lid behind
    P.box(22, 9, 2, 28, 10, 8, K.ink); P.box(23, 10, 3, 27, 11, 7, K.chrome, 2); P.box(24, 10, 7, 26, 11, 8, K.red); });                       // the foot sizer
const mirror = obj({ id: 'store-shoe-mirror', name: 'Shoe mirror', cat: 'fixtures', foot: [2, 1], h: 0.6, tiers: SHOES, tags: ['sneakers', 'mirror'], variants: 2 },
  (P, o) => { const { W, D, H, v } = o, fr = [K.ink, K.goldHi][v]; P.box(0, 0, 0, W, 1, D, fr);
    for (let y = 1; y < H; y++) { const z = Math.max(0, 3 - Math.floor(y / 4)); P.box(0, y, z, W, y + 1, z + 1, fr, v ? 2 : 0); P.box(1, y, z + 1, W - 1, y + 1, z + 2, y < H - 1 ? 0xb9d4e6 : fr, 2); }
    P.glint(2, 3, 3, 3); });
const grail = obj({ id: 'store-grail-case', name: 'Grail pedestal', cat: 'cases', foot: [2, 2], h: 1.4, tiers: SHOES.concat('misc'), tags: ['sneakers', 'collectibles', 'grail', 'glass', 'lit'], variants: 3 },
  (P, o) => { const { W, D, H, v } = o; P.box(1, 0, 1, W - 1, 18, D - 1, K.white); P.box(1, 0, 1, W - 1, 1, D - 1, K.ink); P.box(0, 18, 0, W, 19, D, K.ink);
    for (const x of [0, W - 1]) for (const z of [0, D - 1]) P.box(x, 19, z, x + 1, H - 1, z + 1, K.chrome, 2); P.box(0, H - 1, 0, W, H, D, K.chrome, 2); P.box(2, H - 2, 2, W - 2, H - 1, D - 2, 0xfff8e0, GLOW);
    P.box(1, 19, 3, 9, 20, 7, K.frost, 1); shoe(P, 1, 20, 4, 6, [[K.red, K.ink, K.white, K.white], [K.goldHi, K.ink, K.ink, K.goldHi], [K.lime, K.purple, K.white, K.purple]][v]); P.glint(1, 21, 4, D - 1); });
const boxes = obj({ id: 'store-shoebox-stack', name: 'Shoebox stack', cat: 'clutter', foot: [2, 2], h: 0.8, rot: 45, tops: [0.8], tiers: SHOES.concat('gold'), tags: ['sneakers', 'stock', 'backroom', 'handmade'], variants: 3 },
  (P, o) => { const BX = [[K.orange, K.ink], [K.ink, K.red], [K.white, K.blue], [K.red, K.white], [0x8b4a24, K.cream]];
    for (let k = 0; k < 5; k++) { const b = BX[(k + o.v * 2 + o.seed) % BX.length], dx = (k * 7 + o.v) % 3 === 0 ? 1 : 0, y = k * 3; P.box(dx, y, 1, 8 + dx, y + 3, 8, b[0]); P.box(dx, y + 2, 1, 8 + dx, y + 3, 9, b[1]); if (!P.far) P.box(dx + 1, y + 1, 8, dx + 3, y + 2, 9, K.white); }
    P.box(1, 15, 1, 9, 16, 9, [K.ink, K.red, K.blue][o.v]); });                                                                               // the top lid, askew

// ═════════════ streetwear
const CLOTHES = ['clothes'], FITS = [[K.ink, K.white, K.red, K.lime, K.ink, 0xa7a9b1], [0x6b4a2a, 0x5a6b3a, K.cream, 0xb5542a, K.ink, 0xc49a6c], [K.pink, K.cyan, K.yellow, K.purple, K.lime, K.white]];
const rack = obj({ id: 'store-clothes-rack', name: 'Clothes rack', cat: 'racks', foot: [6, 2], h: 1.6, tiers: CLOTHES, tags: ['streetwear', 'rack', 'hoodies', 'tees'], variants: 3 },
  (P, o) => { const { W, D, H, v, seed } = o, C = K.chrome;
    for (const x of [1, W - 2]) { P.box(x, 0, 1, x + 1, 1, D - 1, C, 2); P.box(x, 0, 4, x + 1, H - 1, 6, C, 2); } P.box(1, H - 2, 4, W - 1, H - 1, 6, C, 2);
    for (let x = 3, n = 0; x + 2 <= W - 3; x += 2, n++) { const c = FITS[v][(((n / 3) | 0) + seed) % 6], tee = n % 5 === 3; P.set(x, H - 3, 5, C, 2);
      const y0 = tee ? 17 : 11; P.box(x, y0, 1, x + 2, H - 4, D - 1, c); if (!tee && !P.far) { P.box(x, H - 5, 3, x + 2, H - 3, 7, c); P.box(x, y0, 1, x + 2, y0 + 1, D - 1, shadeK(c, .75)); } }
    if (!P.far) P.box(W >> 1, H - 3, 3, (W >> 1) + 1, H - 1, 7, K.white); });
const mannequin = obj({ id: 'store-mannequin', name: 'Mannequin (big-head)', cat: 'fixtures', foot: [4, 4], h: 1.8, tiers: CLOTHES.concat('shoes'), tags: ['streetwear', 'mannequin', 'fit', 'dazed'], variants: 3 },
  (P0, o) => { const P = off(P0, 0, 0, 2), { v } = o, skin = [K.white, K.ink, K.white][v], top = [K.ink, K.red, K.purple][v], pants = [0x5a6b3a, K.red, K.ink][v], kick = [[K.white, K.red], [K.white, K.white], [K.goldHi, K.ink]][v], L = skin === K.ink ? 1 : 1;
    P.cyl(10, 7.5, 6, 0, 1, K.chrome, 2);
    P.box(6, 1, 5, 9, 11, 9, pants); P.box(11, 1, 5, 14, 11, 9, pants); P.box(6, 1, 5, 9, 3, 11, kick[0]); P.box(11, 1, 5, 14, 3, 11, kick[0]); P.box(6, 1, 9, 9, 2, 11, kick[1]); P.box(11, 1, 9, 14, 2, 11, kick[1]);
    P.box(5, 11, 4, 15, 19, 10, top); P.box(2, 11, 5, 5, 18, 8, top); P.box(15, 11, 5, 18, 18, 8, top); P.box(2, 7, 5, 5, 11, 8, skin, L); P.box(15, 7, 5, 18, 11, 8, skin, L);
    if (v === 1) { P.box(5, 11, 9, 15, 12, 10, K.white); P.box(9, 12, 9, 11, 19, 10, K.white); } if (v === 2) { for (let i = 0; i < 5; i++) P.set(8 + i, 16 - [0, 1, 2, 1, 0][i], 10, K.goldHi, 2); P.box(9, 12, 10, 11, 14, 11, K.goldHi, 2); }
    P.box(9, 19, 6, 11, 20, 8, skin, L); P.box(2, 20, 0, 18, 35, 15, skin, L);                                                 // neck, the big blank head
    if (v !== 1) { P.box(2, 33, 0, 18, 36, 15, v ? K.ink : K.white); P.box(3, 33, 12, 17, 34, 18, v ? K.ink : K.white); P.box(9, 35, 7, 11, 36, 9, v ? K.purple : K.red); } else P.box(1, 31, 1, 19, 34, 14, K.white); });   // a fitted cap / a headband
const fitting = obj({ id: 'store-fitting-room', name: 'Fitting room', cat: 'fixtures', foot: [5, 5], h: 2.2, tiers: CLOTHES.concat('shoes'), tags: ['streetwear', 'fitting room', 'curtain', 'gag'], variants: 3 },
  (P, o) => { const { W, D, H, v } = o, wall = [K.white, K.ink, K.white][v], cur = [0xa01830, K.ink, K.yellow][v];
    P.box(0, 0, 0, W, H - 2, 1, wall); P.box(0, 0, 0, 1, H - 2, D, wall); P.box(W - 1, 0, 0, W, H - 2, D, wall); P.box(0, H - 2, 0, W, H, D, K.ink);
    P.box(3, 12, 1, 10, 36, 2, 0xb9d4e6, 2); P.box(15, 30, 1, 16, 33, 3, K.chrome, 2); P.box(13, 20, 3, 18, 31, 4, K.cyan); P.box(17, 1, 8, 21, 8, 12, K.woodL);   // mirror, a hook with a hoodie, a stool
    P.box(1, H - 4, D - 2, W - 1, H - 3, D - 1, K.chrome, 2);
    for (let x = 1; x < 17; x++) { const z = D - 2 - ((x >> 1) & 1); P.box(x, 3, z, x + 1, H - 4, z + 1, v === 2 && hh(x, 1) < .4 ? K.ink : cur);
      if (v === 2 && !P.far) for (let y = 5; y < H - 5; y += 4) if (hh(x, y, 3) < .35) P.set(x, y, z, K.ink); }
    if (v === 0) { P.box(4, 0, 17, 8, 2, 23, K.white); P.box(9, 0, 17, 13, 2, 23, K.white); P.box(4, 0, 21, 8, 1, 23, K.red); P.box(9, 0, 21, 13, 1, 23, K.red); } });   // someone's kicks under the curtain
const table = obj({ id: 'store-display-table', name: 'Tee & cap table', cat: 'fixtures', foot: [6, 4], h: 1.1, tops: [0.8], tiers: CLOTHES, tags: ['streetwear', 'table', 'tees', 'caps'], variants: 2 },
  (P, o) => { const { W, D, v } = o, top = [K.woodL, K.white][v]; P.box(0, 15, 0, W, 16, D, top); for (const x of [1, W - 3]) P.box(x, 0, 2, x + 2, 15, D - 2, [K.woodD, K.ink][v]);
    for (let k = 0; k < 4; k++) for (let s = 0; s < 4; s++) P.box(2 + k * 5, 16 + s, 3, 6 + k * 5, 17 + s, 9, FITS[v][(k * 2 + s) % 6]);
    for (let k = 0; k < 3; k++) { const x = 3 + k * 6; P.box(x, 16 + k % 2, 12, x + 4, 18 + k % 2, 16, FITS[1 - v][k + 1]); P.box(x, 16 + k % 2, 16, x + 4, 17 + k % 2, 18, FITS[1 - v][k + 1]); }
    P.box(25, 16, 12, 26, 20, 13, K.chrome, 2); P.box(23, 20, 10, 28, 22, 15, K.ink); P.box(23, 20, 15, 28, 21, 17, K.ink); P.box(25, 22, 12, 26, 23, 13, K.red); });

// ═════════════ the barber
const BARB = ['barber'];
const chair = obj({ id: 'store-barber-chair', name: 'Barber chair', cat: 'fixtures', foot: [3, 4], h: 1.25, tops: [0.5], seat: 0.5, vnames: ['red', 'black', 'teal'], tiers: BARB.concat('misc'), tags: ['barber', 'chair', 'chrome', 'vinyl'], variants: 3 },
  (P, o) => { const { v } = o, vin = [K.vinyl, K.ink, K.teal][v], pipe = [K.white, K.red, K.white][v], C = K.chrome;
    P.cyl(7.5, 9, 5, 0, 1, C, 2); P.box(6, 1, 8, 9, 7, 11, C, 2); P.box(2, 7, 4, 13, 8, 15, C, 2); P.box(2, 8, 4, 13, 10, 15, vin); P.box(2, 10, 14, 13, 11, 15, pipe);
    P.box(2, 10, 3, 13, 22, 6, vin); P.box(2, 22, 3, 13, 23, 6, pipe); if (!P.far) for (let x = 4; x < 13; x += 3) P.box(x, 11, 6, x + 1, 21, 7, shadeK(vin, .8));
    P.box(5, 22, 3, 10, 25, 5, vin); P.box(7, 22, 4, 8, 23, 5, C, 2);
    for (const x of [0, 13]) { P.box(x, 13, 6, x + 2, 14, 15, C, 2); P.box(x, 14, 7, x + 2, 15, 14, vin); P.box(x, 10, 13, x + 2, 13, 14, C, 2); }
    P.box(4, 3, 15, 11, 4, 19, C, 2); P.box(4, 3, 19, 11, 6, 20, C, 2); P.box(7, 4, 13, 8, 7, 15, C, 2); P.box(14, 2, 9, 15, 6, 10, C, 2); P.box(14, 6, 8, 15, 7, 10, K.ink); });
const station = obj({ id: 'store-barber-station', name: 'Mirror station', cat: 'fixtures', place: 'wall', foot: [8, 7], h: 0.4, mount: 0.8, tiers: BARB, tags: ['barber', 'mirror', 'clippers', 'lit'], variants: 2 },
  (P, o) => { const { W, H, D, v } = o, fr = [K.chrome, K.woodD][v];
    P.box(0, 0, 0, W, 2, D, K.bone); P.box(0, 2, 0, W, 3, 2, K.bone); P.box(1, 6, 0, W - 1, H - 3, 1, fr, v ? 0 : 2); P.box(2, 7, 1, W - 2, H - 4, 2, 0xb9d4e6, 2);
    P.box(1, H - 2, 0, W - 1, H, 2, K.ink); P.box(2, H - 2, 2, W - 2, H - 1, 3, 0xfff8e0, GLOW); P.glint(6, 14, 5, 2); P.glint(28, 20, 4, 2);
    P.box(4, 2, 2, 8, 10, 6, 0x2d8fe6, 1); P.box(4, 10, 2, 8, 11, 6, K.chrome, 2); if (!P.far) for (const x of [5, 6, 7]) P.box(x, 6, 3, x + 1, 12, 4, K.ink);   // the blue jar, combs standing in it
    P.box(11, 2, 3, 14, 4, 7, K.ink); P.box(11, 2, 7, 14, 4, 8, K.chrome, 2); P.box(15, 2, 3, 18, 4, 7, K.goldHi, 2); P.box(15, 2, 7, 18, 4, 8, K.chrome, 2);   // two clippers
    P.box(20, 2, 3, 22, 8, 5, K.white, 1); P.box(20, 8, 3, 22, 9, 6, K.blue); P.box(24, 2, 3, 27, 5, 6, 0x2fbf55, 1); P.box(24, 5, 3, 27, 6, 6, K.ink); P.box(29, 2, 3, 33, 4, 6, K.white);   // spray, gel, talc
    if (!P.far) { P.box(12, 0, 7, 13, 2, 8, K.ink); P.box(16, 0, 7, 17, 2, 8, K.ink); }                                                     // cords over the ledge
    P.box(28, 24, 1, 36, 31, 2, K.white); P.box(29, 25, 2, 35, 30, 3, K.cream); if (!P.far) { P.set(34, 26, 3, K.gold, 2); P.box(30, 28, 3, 34, 29, 4, K.ink); }   // the licence, framed
    if (!P.far) for (const [x, y, c] of [[3, 27, K.pink], [6, 28, K.yellow], [3, 23, K.cyan]]) P.box(x, y, 2, x + 2, y + 3, 3, c); });                // photos tucked in the frame
const cart = obj({ id: 'store-clipper-cart', name: 'Clipper cart', cat: 'fixtures', foot: [2, 2], h: 1.0, tops: [0.75], tiers: BARB, tags: ['barber', 'clippers', 'cart'], variants: 2 },
  (P, o) => { const { v } = o, f = [K.ink, K.red][v]; for (const x of [1, 8]) for (const z of [1, 8]) { P.box(x, 0, z, x + 1, 1, z + 1, K.char); P.box(x, 1, z, x + 1, 15, z + 1, f); }
    P.box(1, 3, 1, 9, 4, 9, f); P.box(1, 14, 1, 9, 15, 9, f); P.box(2, 4, 2, 8, 8, 8, K.white); if (!P.far) P.box(2, 6, 7, 8, 7, 8, K.red);
    P.box(2, 15, 2, 4, 17, 6, K.ink); P.box(2, 15, 6, 4, 17, 7, K.chrome, 2); P.box(5, 15, 2, 7, 17, 6, K.goldHi, 2); P.box(7, 15, 6, 9, 20, 8, 0x2d8fe6, 1); P.box(8, 15, 2, 9, 19, 4, K.white, 1);
    if (!P.far) { P.box(3, 8, 9, 4, 15, 10, K.ink); P.box(5, 11, 9, 6, 15, 10, K.ink); } });
const poster = obj({ id: 'store-barber-poster', name: 'Styles poster', cat: 'signs-inside', place: 'wall', foot: [4, 5], h: 0.1, mount: 1.3, tiers: BARB, tags: ['barber', 'poster', 'haircuts', 'big-head'], variants: 2 },
  (P, o) => { const { W, H, v } = o, bg = [K.cream, K.yellow][v]; P.box(0, 0, 0, W, H, 1, bg); P.textC('CUTS', W / 2, H - 2, 1, K.red);
    const skin = [0xe0b48f, 0x8a5534, 0xc8744a, 0x573321];
    [[1, 11, 0], [11, 11, 1], [1, 1, 2], [11, 1, 3]].forEach(([x, y, s]) => { P.box(x + 1, y, 1, x + 7, y + 6, 2, skin[s]); if (!P.far) { P.set(x + 2, y + 3, 1, K.ink); P.set(x + 5, y + 3, 1, K.ink); P.box(x + 3, y + 1, 1, x + 5, y + 2, 2, K.ink); }
      if (s === 0) P.box(x + 1, y + 6, 1, x + 7, y + 7, 2, K.ink); else if (s === 1) P.box(x, y + 4, 1, x + 8, y + 9, 2, K.ink); else if (s === 2) P.box(x + 3, y + 6, 1, x + 5, y + 9, 2, K.red); else P.box(x + 1, y + 6, 1, x + 7, y + 8, 2, K.goldHi); }); });
export const waiting = obj({ id: 'store-waiting-chairs', name: 'Waiting chairs (3)', cat: 'fixtures', foot: [8, 2], h: 0.9, tops: [0.5], seat: 0.5, vnames: ['orange', 'blue', 'red'], tiers: BARB.concat('machines', 'office'), tags: ['anywhere', 'seating', 'waiting'], variants: 3 },
  (P, o) => { const { W, D, v } = o, shell = [K.orange, K.blue, K.red][v]; P.box(1, 4, 3, W - 1, 5, 7, K.char); for (const x of [3, W - 4]) { P.box(x, 0, 2, x + 1, 4, 8, K.char); P.box(x - 1, 0, 1, x + 2, 1, 9, K.char); }
    for (let k = 0; k < 3; k++) { const x = 1 + k * 13; P.box(x, 8, 1, x + 12, 10, 9, shell); P.box(x, 10, 0, x + 12, 18, 2, shell); P.box(x, 5, 3, x + 12, 8, 6, K.char); }
    for (const x of [13, 26]) P.box(x, 10, 2, x + 1, 13, 8, K.chrome, 2);
    P.box(16, 10, 3, 23, 11, 8, K.white); if (!P.far) P.box(17, 10, 4, 22, 11, 6, K.pink); });   // a magazine left on the middle seat
export default [shoewall, bench, mirror, grail, boxes, rack, mannequin, fitting, table, chair, station, cart, poster, waiting];
