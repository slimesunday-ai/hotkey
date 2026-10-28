// STORE OBJECTS · check cashing, liquor, the aisles and everything that goes anywhere (owner: the store-objects agent). The window
// behind bulletproof plexi (and the liquor store's turntable), bottles behind plexi, the 99¢ and pharmacy aisles; registers, cameras,
// the CCTV monitor, tubes, a fan, a mop, and the signs inside: NO LOITERING, CASH ONLY, WE BUY GOLD, SMILE YOU'RE ON CAMERA.
import { obj, K, LIT, GLOW, SPIRITS, MALT, hh, pick, shadeK, sign, off, mirrorZ, shelving, stockRow, glassCase } from './lib.js';
import { registerAt } from './bodega.js';

// ── the bulletproof window: counter, ledge, plexi to the header (framed, glints), speaker grilles, deal trays, lit window numbers
function window(P, o, head, text, liquor) {
  const { W, D, H, v } = o, body = [K.bone, K.ink, K.woodD][v], pz = 8, fr = K.alu;
  P.box(0, 0, 0, W, 13, D, body); P.box(0, 13, 0, W, 14, D, K.cream); P.box(0, 0, D - 1, W, 2, D, K.char);
  for (const x of [0, 20, 40, W - 1]) P.box(x, 14, pz, x + 1, H - 10, pz + 1, fr, 2); P.box(0, 30, pz, W, 31, pz + 1, fr, 2);
  P.box(0, H - 10, pz - 2, W, H, pz + 2, head); P.box(1, H - 9, pz + 2, W - 1, H - 1, pz + 3, K.white, LIT()); P.textC(text, W / 2, H - 3, pz + 3, head, LIT());
  const bays = liquor ? [10, 50] : [10, 30, 50];
  bays.forEach((cx, k) => { P.box(cx - 5, 14, pz, cx + 5, 16, pz + 1, fr, 2); P.box(cx - 3, 13, pz - 3, cx + 3, 14, pz + 4, K.steel, 2);   // the deal tray, sunk through the plexi line
    for (let x = cx - 2; x <= cx + 1; x++) for (let y = 21; y <= 24; y++) if ((x + y) % 2 === 0 || P.far) P.set(x, y, pz, K.chrome, 2);       // speaker grille
    P.box(cx - 3, 33, pz, cx + 3, 40, pz + 1, K.white, LIT()); P.textC(String(k + 1), cx, 39, pz + 1, K.ink, LIT());
    P.box(cx - 4, 14, 1, cx + 2, 17, 5, K.dark); P.box(cx - 3, 17, 1, cx + 1, 18, 3, 0x5cb85c); P.box(cx + 3, 14, 2, cx + 6, 20, 5, K.char); P.box(cx + 3, 18, 5, cx + 6, 20, 6, 0x3fa9f5, GLOW); });   // cash drawer, bills, the teller's screen
  for (const [x, y] of [[4, 26], [24, 36], [44, 26], [52, 40]]) P.glint(x, y, 4, pz);
  if (liquor) { P.cyl(30, pz + .5, 6, 14, 15, K.chrome, 2); P.cyl(30, pz + .5, 5, 15, 16, K.steel, 2); for (let z = pz - 5; z <= pz + 5; z++) P.box(24, 15, z, 25, 26, z + 1, fr, 2);   // the turntable and its shield
    P.box(27, 15, pz + 2, 29, 21, pz + 4, 0x7a3a12, 1); P.box(31, 15, pz - 3, 33, 20, pz - 1, K.glass, 1); }
  if (!P.far) { P.box(42, 42, pz + 1, 50, 49, pz + 2, K.yellow); P.box(43, 44, pz + 2, 49, 45, pz + 3, K.ink); P.box(43, 46, pz + 2, 47, 47, pz + 3, K.ink); P.box(2, 44, pz + 1, 8, 48, pz + 2, K.pink); }
}
const OFFICE = ['office'];
const plexi = obj({ id: 'store-plexi-window', name: 'Bulletproof window counter', cat: 'counters', foot: [12, 3], h: 2.6, tops: [0.7], tiers: OFFICE, tags: ['cash', 'check cashing', 'plexi', 'teller', 'lit'], variants: 3 },
  (P, o) => window(P, o, [K.green, 0xffc21a, K.red][o.v], ['CHECKS CASHED', 'MONEY WIRE', 'BAIL BONDS'][o.v], false));
const liquorwin = obj({ id: 'store-liquor-window', name: 'Liquor window (turntable)', cat: 'counters', foot: [12, 3], h: 2.6, tops: [0.7], tiers: ['bottles'], tags: ['cash', 'liquor', 'plexi', 'turntable', 'lit'], variants: 2 },
  (P, o) => window(P, o, [K.purple, K.red][o.v], ['WINE & LIQUOR', 'LIQUORS'][o.v], true));
const desk = obj({ id: 'store-form-desk', name: 'Form desk', cat: 'counters', foot: [4, 2], h: 1.25, tops: [1.05], tiers: OFFICE, tags: ['cash', 'forms', 'pens on chains'], variants: 2 },
  (P, o) => { const { W, D, v } = o, c = [K.bone, K.woodD][v]; P.box(8, 0, 3, 12, 19, 7, c); P.box(5, 0, 1, 15, 1, 9, K.char);
    for (let z = 0; z < D; z++) P.box(0, 19 + ((D - z) >> 2), z, W, 20 + ((D - z) >> 2), z + 1, c); P.box(0, 19, D - 1, W, 21, D, K.char);
    P.box(0, 21, 0, W, 25, 3, shadeK(c, .85)); for (let k = 0; k < 4; k++) P.box(1 + k * 5, 22, 2, 4 + k * 5, 25, 3, [K.white, K.pink, K.yellow, K.sky][k]);
    for (const x of [4, 15]) { P.box(x, 20, 6, x + 3, 21, 7, K.blue); if (!P.far) for (let t = 0; t < 4; t++) P.set(x + (t > 1 ? 1 : 0), 21 + t, 5 - t, K.chrome, 2); } });

// ── bottles behind plexi: five rows of spirits on lit shelves, a plexi front (framed, a glint, a price card or two)
const LIQ = ['bottles'];
const liquor = obj({ id: 'store-liquor-wall', name: 'Bottles behind plexi', cat: 'shelving', foot: [8, 3], h: 2.3, tiers: LIQ, tags: ['liquor', 'bottles', 'plexi', 'lit'], variants: 3 },
  (P, o) => { const { W, D, H, v, seed } = o, fr = K.woodD, L = LIT(); P.box(0, 0, 0, W, H, 2, fr); P.box(1, 3, 1, W - 1, H - 3, 2, 0xfff1d0, L);
    for (const x of [0, W - 1]) P.box(x, 0, 0, x + 1, H, D - 3, fr); P.box(0, 0, 0, W, 3, D - 3, fr); P.box(0, H - 3, 0, W, H, D - 3, fr);
    const rows = [3, 12, 21, 30, 38], set = [SPIRITS.filter(b => b[3] !== 1), SPIRITS.filter(b => b[3] === 1).concat([SPIRITS[4]]), SPIRITS][v];
    rows.forEach((y, k) => { if (k) P.box(1, y - 1, 2, W - 1, y, D - 3, K.frost, 1);
      if (v === 2 && k === 0) stockRow(P, 'forty', 1, W - 1, y, 3, D - 4, MALT, seed + k, { gap: 0, room: 9 });
      else if (k === 4) for (let x = 2; x < W - 2; x += 2) { P.box(x, y, 4, x + 1, y + 3, 7, pick(SPIRITS, x + seed)[0], 1); }   // nips on the top shelf
      else stockRow(P, 'spirit', 1, W - 1, y, 3, D - 4, set, seed * 3 + k * 7 + v, { gap: 1, sold: .05, room: 9 }); });
    for (const x of [0, 13, 26, W - 1]) P.box(x, 3, D - 2, x + 1, H - 3, D - 1, K.alu, 2); P.box(0, 20, D - 2, W, 21, D - 1, K.alu, 2); P.box(0, H - 4, D - 2, W, H - 3, D - 1, K.alu, 2);
    P.glint(3, 26, 5, D - 2); P.glint(29, 8, 4, D - 2); if (!P.far) { P.box(15, 12, D - 1, 18, 14, D, K.yellow); P.box(33, 30, D - 1, 36, 32, D, K.yellow); } });

// ═════════════ the aisles: 99¢ and the pharmacy
const MISC = ['misc'];
const dollar = obj({ id: 'store-aisle-99', name: '99¢ aisle', cat: 'shelving', foot: [6, 4], h: 1.6, tops: [], tiers: MISC, tags: ['aisles', '99c', 'dollar', 'double-sided'], variants: 2 },
  (P, o) => { const { W, D, H, v, seed } = o, half = D >> 1, fr = [K.white, K.bone][v];
    const side = (Q, s) => { shelving(Q, { x0: 1, x1: W - 1, z0: half, z1: D, levels: [3, 11, 19, 26], top: 26, frame: fr, seed: seed + s, cap: false, strip: K.yellow });
      for (let x = 2, n = 0; x + 4 <= W - 2; x += 5, n++) { const c = pick([K.red, K.blue, K.green, K.orange, K.purple, K.pink], n + s + v); for (let t = 0; t < 3; t++) Q.box(x, 3 + t * 2, half + 2, x + 4, 5 + t * 2, D - 1, t === 2 ? shadeK(c, 1.2) : c, 1); }   // nested buckets
      for (let x = 2, n = 0; x + 2 <= W - 2; x += 3, n++) Q.box(x, 11, half + 2, x + 2, 13 + (n % 2), D - 1, pick([K.yellow, K.lime, K.pink, K.cyan], n + s));   // sponges, soaps
      for (let x = 2, n = 0; x + 3 <= W - 2; x += 4, n++) { const c = pick([K.red, K.yellow, K.pink, K.purple, K.lime], n * 2 + s + v); Q.box(x + 1, 19, half + 3, x + 2, 22, half + 4, K.green); Q.box(x, 22, half + 2, x + 3, 25, half + 5, c); }   // plastic flowers
      for (let x = 2, n = 0; x + 3 <= W - 2; x += 3, n++) Q.box(x, 26, half + 2, x + 3, 29, D - 2, pick([K.red, K.blue, K.yellow, K.green], n + s)); };   // balls on top
    side(P, 0); side(mirrorZ(P, D), 1); P.box(1, 25, 1, W - 1, 26, D - 1, fr); for (const x of [0, W - 1]) P.box(x, 0, 0, x + 1, 26, D, K.orange);
    P.box(11, 29, half - 1, 19, H, half + 1, K.red); P.textC('99¢', 15, H - 1, half + 1, K.yellow); });
const pharmacy = obj({ id: 'store-pharmacy-shelf', name: 'Pharmacy shelf', cat: 'shelving', foot: [6, 2], h: 1.9, tops: [], tiers: MISC, tags: ['aisles', 'pharmacy', 'medicine', 'lit'], variants: 2 },
  (P, o) => { const { W, D, H, v, seed } = o, levels = [3, 11, 19, 27], top = 34; shelving(P, { x0: 0, x1: W, z0: 0, z1: D, levels: [...levels, top], top, frame: K.white, seed, cap: true });
    const band = [K.red, K.blue, K.green, K.purple, K.orange];
    levels.forEach((y, k) => { for (let x = 1, n = 0; x + 3 <= W - 1; x += 3 + (n % 4 === 3 ? 1 : 0), n++) { const kind = (n + k * 2 + v) % 5, c = band[(n + k + seed) % 5];
      if (kind === 4) { P.box(x, y, 2, x + 2, y + 3, D - 2, 0xff8a1f, 1); P.box(x, y + 3, 2, x + 2, y + 4, D - 2, K.white); }                // pill bottles
      else if (kind === 3 && k === 1) { P.box(x, y, 2, x + 3, y + 3, D - 1, K.white); if (!P.far) { P.box(x + 1, y, D - 2, x + 2, y + 3, D - 1, K.red); P.box(x, y + 1, D - 2, x + 3, y + 2, D - 1, K.red); } }   // first aid
      else { const h = 3 + ((n + k) % 3); P.box(x, y, 2, x + 3, y + h, D - 1, K.white); if (!P.far) P.box(x, y + h - 1, D - 2, x + 3, y + h, D - 1, c); else P.box(x, y + h - 1, D - 2, x + 3, y + h, D - 1, c); } } });
    P.box(0, top, 0, W, H, 2, K.green, LIT()); P.box(W / 2 - 1, top, 2, W / 2 + 1, H, 3, K.white, LIT()); P.box(W / 2 - 3, top + 1, 2, W / 2 + 3, top + 3, 3, K.white, LIT()); });

// ═════════════ anywhere
const ANY = ['bodega', 'food', 'cakes', 'phones', 'clothes', 'shoes', 'gold', 'bottles', 'machines', 'office', 'misc', 'barber'];
const regCounter = obj({ id: 'store-register-counter', name: 'Checkout counter', cat: 'counters', foot: [8, 3], h: 1.15, tops: [0.7], tiers: ['clothes', 'shoes', 'misc', 'phones', 'barber', 'cakes'], tags: ['anywhere', 'counter', 'register', 'checkout'], variants: 4 },
  (P, o) => { const { W, D, v } = o, body = [K.ink, K.white, K.woodL, K.red][v], acc = [K.lime, K.ink, K.woodD, K.white][v];
    P.box(0, 0, 0, W, 13, D, body); P.box(0, 13, 0, W, 14, D, v === 1 ? K.bone : K.ink); P.box(0, 0, D - 1, W, 2, D, K.char); P.box(0, 9, D - 1, W, 10, D, acc, v === 0 ? GLOW : 0);
    registerAt(off(P, 22, 14, 2), v === 1 ? 0 : 1); P.box(33, 14, 6, 36, 17, 10, K.ink); P.box(34, 16, 10, 36, 17, 11, 0x3fa9f5, GLOW);        // card reader
    for (let k = 0; k < 4; k++) P.box(2, 14 + k, 3, 11, 15 + k, 11, k % 2 ? K.kraft : K.white); P.box(13, 14, 5, 20, 17, 12, K.ink); for (let x = 14; x < 20; x++) P.box(x, 17, 6, x + 1, 18, 11, pick([K.red, K.yellow, K.cyan, K.pink, K.lime], x + v));
    P.cyl(38, 3, 1.5, 14, 16, K.chrome, 2); });
const camera = obj({ id: 'store-security-camera', name: 'Security camera', cat: 'fixtures', place: 'wall', foot: [1, 1], h: 0.4, mount: 2.5, tiers: ANY, tags: ['anywhere', 'security', 'camera'], variants: 2, sim: 'alarm' },
  (P, o) => { const b = [K.white, K.ink][o.v]; P.box(1, 1, 0, 4, 4, 1, K.char); P.box(2, 2, 1, 3, 3, 3, K.char); P.box(1, 1, 2, 4, 4, 8, b); P.box(1, 1, 7, 4, 4, 8, K.ink); P.box(1, 4, 2, 4, 5, 8, b); P.set(2, 2, 7, 0x3f6bc4, 1); P.set(3, 3, 7, 0xff2a2a, GLOW); });
const monitor = obj({ id: 'store-cctv-monitor', name: 'CCTV monitor (4 cams)', cat: 'machines', place: 'surface', foot: [2, 2], h: 0.45, tiers: ANY, tags: ['anywhere', 'security', 'screen', 'lit'] },
  P => { P.box(0, 0, 1, 10, 9, 10, K.char); P.box(1, 1, 9, 9, 8, 10, K.ink);
    [[1, 5], [5, 5], [1, 1], [5, 1]].forEach(([x, y], k) => { P.box(x, y, 9, x + 3, y + 3, 10, [0x7a8a86, 0x86907e, 0x7a8290, 0x8a8478][k], GLOW); if (!P.far) { P.set(x + 1 + (k % 2), y + 1, 9, [K.red, K.yellow, K.cyan, K.pink][k], GLOW); P.set(x, y + 2, 9, K.white, GLOW); } });
    P.box(1, 4, 9, 9, 5, 10, K.ink); P.box(4, 1, 9, 5, 8, 10, K.ink); P.set(8, 1, 10 - 1, K.red, GLOW); });
const tube = obj({ id: 'store-fluoro-light', name: 'Fluorescent fixture', cat: 'fixtures', place: 'ceiling', foot: [2, 6], h: 0.15, tiers: ANY, tags: ['anywhere', 'light', 'lit', 'ceiling'], variants: 2 },
  (P, o) => { const { W, D } = o; P.box(0, 1, 0, W, 3, D, K.white); P.box(0, 1, 0, 1, 3, D, K.bone); P.box(W - 1, 1, 0, W, 3, D, K.bone);
    for (const x of [2, 6]) { P.box(x, 0, 1, x + 2, 1, D - 1, 0xfffbe8, GLOW); P.box(x, 0, 0, x + 2, 1, 1, K.alu); P.box(x, 0, D - 1, x + 2, 1, D, K.alu); }
    if (o.v === 1) P.box(6, 0, 1, 8, 1, D - 1, (x, y, z) => z < 9 ? 0xfffbe8 : 0x9aa2ad, 0); });                                                  // one tube dying at the far end
const fan = obj({ id: 'store-ceiling-fan', name: 'Ceiling fan', cat: 'fixtures', place: 'ceiling', foot: [5, 5], h: 0.5, tiers: ANY, tags: ['anywhere', 'fan', 'ceiling'], variants: 2 },
  (P, o) => { const b = [K.woodD, K.white][o.v]; P.box(12, 4, 12, 13, 10, 13, K.chrome, 2); P.cyl(12.5, 12.5, 3, 2, 5, [K.gold, K.white][o.v], o.v ? 0 : 2); P.box(12, 9, 12, 13, 10, 13, K.chrome, 2);
    P.box(1, 3, 11, 10, 4, 14, b); P.box(15, 3, 11, 24, 4, 14, b); P.box(11, 3, 1, 14, 4, 10, b); P.box(11, 3, 15, 14, 4, 24, b); if (!P.far) for (let y = 0; y < 2; y++) P.set(12, y, 13, K.chrome, 2); });
const mop = obj({ id: 'store-mop-bucket', name: 'Mop bucket', cat: 'clutter', foot: [2, 2], h: 1.3, rot: 45, tiers: ANY, tags: ['anywhere', 'mop', 'cleaning', 'handmade'], variants: 1 },
  P => { for (const [x, z] of [[1, 2], [8, 2], [1, 8], [8, 8]]) P.box(x, 0, z, x + 1, 1, z + 1, K.ink); P.box(1, 1, 2, 9, 7, 9, K.yellow, 1); P.clear(2, 3, 3, 8, 7, 8); P.box(2, 3, 3, 8, 5, 8, 0x7d7a5c);
    P.box(1, 7, 2, 9, 10, 5, 0x8a93a3); P.box(3, 5, 4, 7, 7, 7, 0xb9b9b0); for (let t = 0; t < 19; t++) P.set(5 + Math.floor(t * .16), 6 + t, 5 + Math.floor(t * .12), K.woodL); P.box(0, 6, 5, 1, 7, 6, K.char); });

// ═════════════ signs inside (0.05 lettering on a board; far keeps the board and a blur of the words)
const SIGNS = [
  ['store-sign-no-loitering', 'NO LOITERING sign', [8, 3], 2.1, ['NO', 'LOITERING'], [[K.white, K.red, K.red], [K.yellow, K.ink, K.ink]], ANY, ['anywhere', 'sign', 'regulatory']],
  ['store-sign-cash-only', 'CASH ONLY card', [4, 3], 1.4, ['CASH', 'ONLY'], [[0xff8a1f, K.ink, null], [K.white, K.red, K.red]], ANY, ['anywhere', 'sign', 'handwritten']],
  ['store-sign-we-buy-gold', 'WE BUY GOLD banner', [10, 4], 2.0, ['WE BUY', 'GOLD'], [[K.yellow, K.red, null], [K.red, K.yellow, null]], ['gold', 'misc', 'office'], ['pawn', 'sign', 'banner']],
  ['store-sign-on-camera', 'SMILE YOU\'RE ON CAMERA sign', [8, 4], 2.2, ['SMILE', 'YOU\'RE ON', 'CAMERA'], [[K.blue, K.white, null], [K.yellow, K.ink, K.ink]], ANY, ['anywhere', 'sign', 'security']],
];
const signs = SIGNS.map(([id, name, foot, mount, lines, cols, tiers, tags]) => obj({ id, name, cat: 'signs-inside', place: 'wall', foot, h: .1, mount, tiers, tags, variants: cols.length },
  (P, o) => { const [bg, fg, trim] = cols[o.v], big = id === 'store-sign-we-buy-gold'; sign(P, 0, 0, 0, o.W, o.H, bg, fg, lines, { trim, font: big ? 5 : 3 });
    if (big && !P.far) for (const [x, y] of [[1, 1], [o.W - 2, 1], [1, o.H - 2], [o.W - 2, o.H - 2]]) P.set(x, y, 1, K.chrome, 2);
    if (id === 'store-sign-cash-only' && !P.far) { P.box(0, o.H - 2, 1, 3, o.H, 2, K.kraft); P.box(o.W - 3, o.H - 2, 1, o.W, o.H, 2, K.kraft); } }));   // tape on the corners

// ═════════════ phones (the city's `phones` shops): a lit case of handsets
const phones = obj({ id: 'store-phone-case', name: 'Phone case', cat: 'cases', foot: [6, 3], h: 1.0, tops: [1.0], tiers: ['phones', 'misc'], tags: ['phones', 'prepaid', 'glass', 'lit', 'screens'], variants: 2 },
  (P, o) => { const { W, D, v } = o; glassCase(P, { x0: 0, x1: W, z0: 0, z1: D, base: 11, top: 20, cab: [K.white, K.blue][v], deck: [K.ink, K.white][v], frame: K.chrome, lightBar: true });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6 - r; k++) { const x = 2 + k * 4 + r * 2, z = 4 + r * 5, y = 12; P.box(x, y, z, x + 3, y + 1, z + 3, K.char); P.box(x, y + 1, z, x + 3, y + 5 - r, z + 1, K.ink); P.box(x, y + 2, z + 1, x + 3, y + 5 - r, z + 2, pick([0x3fa9f5, K.pink, K.lime, K.white, K.orange], k + r + v), GLOW); }
    for (let k = 0; k < 4; k++) P.box(3 + k * 6, 12, D - 3, 6 + k * 6, 13, D - 2, pick([K.red, K.yellow, K.purple, K.cyan], k + v)); });

export default [plexi, liquorwin, desk, liquor, dollar, pharmacy, regCounter, camera, monitor, tube, fan, mop, ...signs, phones];
