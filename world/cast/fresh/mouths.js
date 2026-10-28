// FRESH REGISTRY · mouths (slot 'mouth'). This file has exactly one owner: the mouths designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Mouth (the mouth zone, its depth, the layering,
// fine detail, the checks). Helpers: the `ctx` passed to your draw, or `import { … } from './kit.js'` (the only import allowed here;
// kit.js MOUTH is the zone). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none' or 'base'; unique in the mouth slot).
// ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Every entry: { name, why?, draw?(H, ctx), fine?(P, ctx) } (at least one of draw and fine), changing only the mouth zone.
// Check your work: node style/check.mjs mouths (README § Checks).
import { shade, lerpHex } from './kit.js';

// ── the zone, as this file draws it
// Voxels: x −6..5 (12 columns), rows y 21 (under the nose), 20 (the mouth row), 19 (the chin, the head's bottom row); z 7 is the face,
// z 8 one proud, z 6 one deep (cut the face voxel and the z 6 voxel shows). The face's centre line is between x −1 and x 0.
// Paint: one 48 × 12 texel bitmap on the zone's front, read as seen from the front: column c (0..47, the viewer's left first) is
// x −6 + c/4, row j (0..11, top first) is y 21 − j/4 (rows 0–3 y 21 · 4–7 y 20 · 8–11 y 19). It lands on whatever is outermost: the
// skin, a cut (the z 6 face) or a proud voxel (its z 8 face). A row given 24 wide is mirrored about the centre line.
const W = 48, ROWS = 12;
const cut = (H, x, y, c) => { H.del(x, y, 7); H.set(x, y, 6, c, 0); };   // open the face: the z 6 voxel shows, in c
const rec = (H, x, y, c, l = 0) => H.set(x, y, 7, c, l);                 // recolour the face plane
const pro = (H, x, y, c, l = 0) => H.set(x, y, 8, c, l);                 // one proud
const row = r => r.length === W / 2 ? r + [...r].reverse().join('') : r;
// the bitmap: rows (12 strings, 48 or 24 wide), pal: char → colour | (x, y) => colour; a char not in pal is skipped
function art(P, rows, pal) {
  rows.forEach((r0, j) => { const r = row(r0); for (let c = 0; c < r.length; c++) { let v = pal[r[c]]; if (v === undefined) continue;
    if (typeof v === 'function') v = v(-6 + (c >> 2), 21 - (j >> 2)); P.paint('+z', -24 + c, 87 - j, v); } });
}
// runs on the same bitmap: [row, c0, c1, char] (inclusive)
function runs(P, list, pal) { for (const [j, c0, c1, ch] of list) for (let c = c0; c <= c1; c++) { let v = pal[ch];
  if (typeof v === 'function') v = v(-6 + (c >> 2), 21 - (j >> 2)); P.paint('+z', -24 + c, 87 - j, v); } }

// ── colours from the worn skin (README: take them from ctx.sk so a mouth reads on the palest and the darkest skin)
const lum = c => (.2126 * ((c >> 16) & 255) + .7152 * ((c >> 8) & 255) + .0722 * (c & 255)) / 255;
function tone(ctx) {
  const sk = ctx.sk, L = lum(sk.c(-1, 20, 7)), dark = L < .3;
  return {
    dark,
    k: lerpHex(sk.mouth, 0x0c0608, dark ? .7 : .35),                              // the mouth's inside and its line
    l: dark ? lerpHex(sk.lip, 0xe9a48e, .3) : sk.lip,                             // (lifted on the darkest skins, so the line reads) L: lerpHex(sk.lip, 0xffffff, dark ? .3 : .2), d: shade(sk.lip, .72),   // lip, its light edge, its shade
    s: (x, y) => shade(sk.c(x, y, 7), dark ? .72 : .8),                          // a crease in the skin
    h: (x, y) => lerpHex(sk.c(x, y, 7), 0xffffff, dark ? .22 : .14),             // a lit edge of skin
  };
}
const TEETH = 0xf1ece0, GAP = 0xb9b2a4, TONGUE = 0xc9506a;
const CREASE = [[1, 7, 7, 's'], [2, 8, 8, 's'], [1, 40, 40, 's'], [2, 39, 39, 's']];   // smile lines off a grin's corners
const GOLD = 0xe8b130, GOLD_HI = 0xffe390, GOLD_LO = 0x9c6a10;

export default {
  // ─────────────────────────────── COMMON
  hard_line: {
    name: 'Hard Line', tier: 'common', why: 'Pressed flat, corners turned down: the corner face, nothing given away.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) rec(H, x, 20, lerpHex(ctx.sk.c(x, 20, 7), t.l, .35), ctx.sk.layer); },
    fine(P, ctx) { const t = tone(ctx);
      art(P, ['........................', '........................', '........................', '.............lllllllllll',
        '..........kkkkkkkkkkkkkk', '.........k..kkkkkkkkkkkk', '..............dddddddddd', '...............sssssssss',
        '........................', '...................sssss', '........................', '........................'], t); },
  },
  corner_smirk: {
    name: 'Corner Smirk', tier: 'common', why: 'One side of the mouth knows something the other side will never say.',
    fine(P, ctx) { const t = tone(ctx);
      runs(P, [[5, 11, 29, 'k'], [6, 12, 29, 'k'], [4, 30, 33, 'k'], [5, 30, 33, 'k'], [3, 34, 36, 'k'], [4, 34, 35, 'k'], [2, 37, 37, 'k'], [3, 37, 37, 'k'],
        [4, 14, 29, 'l'], [3, 30, 33, 'l'], [7, 13, 29, 'l'], [6, 30, 34, 'l'], [8, 15, 28, 's'],
        [1, 39, 39, 's'], [2, 39, 39, 's'], [3, 39, 39, 's'], [4, 38, 38, 's'], [5, 9, 10, 's']], t); },
  },
  deli_toothpick: {
    name: 'Deli Toothpick', tier: 'common', why: 'Off the counter at Lucky 7, parked in the corner of the mouth all shift.',
    draw(H, ctx) { const t = tone(ctx); cut(H, 2, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx);
      runs(P, [[4, 14, 31, 'l'], [5, 11, 31, 'k'], [6, 11, 31, 'k'], [7, 14, 30, 'l'], [8, 16, 29, 's'], [4, 36, 37, 'k'], [7, 36, 36, 's']], t);
      // the pick: its end sits in the open corner (inside the cut, against the cheek), then steps down the face in pairs (a fine run stays
      // within the depth budget)
      const pick = [[4, 41, 15], [5, 41, 15], [6, 40, 16], [7, 40, 16], [8, 39, 16], [9, 39, 16], [10, 38, 16], [11, 38, 16]];
      pick.forEach(([hx, hy, hz], i) => { P.half(hx, hy, hz, i === pick.length - 1 ? 0xb88e55 : 0xe9cf93, 0); if (hz === 16 && hy > 38) P.rect('+z', 2 * hx, 2 * hy - 1, 2 * hx + 2, 2 * hy, t.s(hx >> 1, hy >> 1)); }); },
  },
  chipped_grin: {
    name: 'Chipped Grin', tier: 'common', why: 'Big smile, one front tooth short: the robbery he still calls a win.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) rec(H, x, 20, TEETH, 1); cut(H, -4, 20, t.k); cut(H, 3, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, w: TEETH, g: GAP };
      art(P, ['........................', '........................', '........................', '.........kkkllllllllllll',
        '............wwwwwwwwwwww', '.................g......', '.................g......', '............kkkkkkkkkkkk',
        '.............lllllllllll', '...............sssssssss', '........................', '........................'], pal);
      runs(P, [...CREASE, [5, 23, 23, 'g'], [6, 23, 23, 'g'], [4, 22, 22, 'k'], [5, 21, 22, 'k'], [6, 20, 22, 'k']], pal); },
  },
  kiss_teeth: {
    name: 'Kiss Teeth', tier: 'common', why: 'Lips pushed to one side, the sound comes after: not impressed.',
    draw(H, ctx) { for (let x = 0; x <= 1; x++) rec(H, x, 20, ctx.sk.lip, 1); },
    fine(P, ctx) { const t = tone(ctx);
      runs(P, [[2, 25, 30, 'l'], [3, 24, 31, 'l'], [4, 24, 25, 'l'], [5, 24, 25, 'l'], [6, 24, 25, 'l'], [7, 24, 25, 'd'], [4, 30, 31, 'l'], [5, 30, 31, 'd'], [6, 30, 31, 'd'],
        [7, 30, 31, 'd'], [8, 24, 31, 'd'], [9, 25, 30, 's'], [5, 17, 23, 'k'], [5, 13, 16, 's'], [1, 36, 36, 's'], [2, 36, 37, 's'], [3, 36, 37, 's'], [4, 36, 36, 's']], t);
      for (const [hx, hy, c] of [[1, 41, 'L'], [2, 41, 'l'], [1, 40, 'd'], [2, 40, 'k']]) P.half(hx, hy, 16, t[c], c === 'k' ? 0 : 1); },   // the pucker, half proud
  },
  oh_word: {
    name: 'Oh Word?', tier: 'common', why: 'The round little O of someone hearing the price for the first time.',
    draw(H, ctx) { const t = tone(ctx), lp = ctx.sk.lip; cut(H, -1, 20, t.k); cut(H, 0, 20, t.k);
      for (const [x, y] of [[-2, 20], [1, 20], [-1, 21], [0, 21], [-1, 19], [0, 19]]) pro(H, x, y, lp, 1); },
    fine(P, ctx) { const t = tone(ctx);
      art(P, ['....................LLLL', '........................', '...................l....', '..................lldddd',
        '................L..dkkkk', '................L..dkkkk', '................l..dtttt', '................l..dtttt',
        '..................lldddd', '...................l....', '........................', '....................dddd'], { ...t, t: TONGUE }); },
  },
  cackle: {
    name: 'Cackle', tier: 'common', why: 'Wide open, top teeth out, heard from across the plaza at four in the morning.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -4; x <= 3; x++) cut(H, x, 20, t.k); for (let x = -2; x <= 1; x++) cut(H, x, 19, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, t: TONGUE, T: shade(TONGUE, .7) };
      art(P, ['.......s................', '.......s................', '........skk.............', '.........kklllllllllllll',
        '........................', '........................', '........................', '..................tttttt',
        '..........llllll..tttttT', '................tttttttT', '........................', '........................'], pal);
      for (let hx = -8; hx <= 7; hx++) P.half(hx, 41, 15, hx < -6 || hx > 5 ? t.k : TEETH, hx < -6 || hx > 5 ? 0 : 1);   // the top teeth, hung from the upper lip, wall to wall
      for (let hx = -4; hx <= 3; hx++) P.half(hx, 38, 15, ctx.sk.lip, 1); },  // the lower lip, under the open jaw
  },
  lip_bite: {
    name: 'Lip Bite', tier: 'common', why: 'Two front teeth on a full bottom lip: looking at something in the window.',
    draw(H, ctx) { for (let x = -2; x <= 1; x++) pro(H, x, 20, ctx.sk.lip, 1); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, w: TEETH, g: GAP };
      art(P, ['........................', '........................', '...............lllllllll', '.............kkkkkkkkkkk',
        '.............k....wwwwww', '...................wwwww', '................LLLLLLLL', '................dddddddd',
        '.................sssssss', '........................', '........................', '........................'], pal);
      runs(P, [[4, 23, 23, 'g'], [5, 23, 23, 'g']], pal); },
  },

  // ─────────────────────────────── RARE
  bubble_pop: {
    name: 'Bubble Pop', tier: 'rare', why: 'A pink bubble the size of the mouth, held right up to the moment it goes.',
    draw(H, ctx) { const B = 0xff74b8;
      for (let x = -2; x <= 1; x++) { pro(H, x, 21, B, 1); pro(H, x, 19, B, 1); } for (let x = -3; x <= 2; x++) pro(H, x, 20, B, 1); },
    fine(P, ctx) { const t = tone(ctx);
      runs(P, [[1, 17, 20, 'H'], [2, 17, 17, 'h'], [4, 13, 13, 'h'], [5, 13, 13, 'h'], [10, 26, 31, 'p'], [11, 22, 31, 'p'], [6, 33, 35, 'p'], [7, 33, 35, 'p'],
        [5, 10, 11, 'k'], [5, 36, 37, 'k']], { ...t, H: 0xffffff, h: 0xffc2e2, p: 0xd94c94 }); },
  },
  gold_sneer: {
    name: 'Gold Sneer', tier: 'rare', why: 'The lip curls up on one side and there it is: one gold canine.',
    draw(H, ctx) { const t = tone(ctx); rec(H, 0, 20, TEETH, 1); rec(H, 1, 20, GOLD, 1); cut(H, 2, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, w: TEETH, g: GAP, G: GOLD_HI, o: GOLD, O: GOLD_LO };
      runs(P, [[4, 13, 23, 'l'], [5, 12, 23, 'k'], [6, 13, 23, 'l'], [7, 15, 22, 's'],
        [3, 24, 35, 'l'], [2, 27, 34, 'l'], [4, 24, 27, 'w'], [5, 24, 26, 'w'], [6, 24, 26, 'w'], [5, 27, 27, 'g'], [6, 27, 27, 'g'], [7, 24, 27, 'k'],
        [4, 28, 30, 'G'], [4, 31, 31, 'o'], [5, 28, 28, 'G'], [5, 31, 31, 'O'], [6, 28, 28, 'k'], [6, 29, 29, 'o'], [6, 30, 30, 'O'], [6, 31, 31, 'k'], [7, 28, 31, 'k'],
        [4, 36, 37, 'k'], [5, 36, 36, 'k'], [8, 22, 36, 'l'], [9, 24, 34, 's'],
        [0, 38, 38, 's'], [1, 38, 38, 's'], [2, 38, 38, 's'], [3, 37, 37, 's'], [4, 38, 38, 's']], pal); },
  },
  st_mercy_stitches: {
    name: 'St. Mercy Stitches', tier: 'rare', why: 'Split lip from the last payback, sewn shut in the ER with black thread.',
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, r: 0xe0566c, x: 0x120e16, b: lerpHex(ctx.sk.lip, 0x5e2452, .5) };
      const L = [[3, 13, 34, 'l'], [4, 11, 36, 'k'], [5, 12, 34, 'l'], [6, 14, 32, 'd'], [7, 16, 31, 's']];
      for (let j = 0; j <= 10; j++) L.push([j, 18, 19, 'r']);
      for (const j0 of [0, 4, 8]) L.push([j0, 17, 17, 'x'], [j0, 20, 20, 'x'], [j0 + 1, 18, 19, 'x'], [j0 + 2, 17, 17, 'x'], [j0 + 2, 20, 20, 'x']);
      runs(P, [[5, 14, 17, 'b'], [6, 15, 17, 'b'], [5, 20, 21, 'b'], ...L], pal); },
  },
  fight_night: {
    name: 'Fight Night', tier: 'rare', why: 'Bared mouthguard in electric lime, bolt on the front: ready before anyone asked.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) rec(H, x, 20, 0x9fec3a, 1); cut(H, -4, 20, t.k); cut(H, 3, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, h: 0xd9ff9c, b: 0x6eb81e, z: 0x141414 };
      art(P, ['........................', '........................', '........................', '.........kkkllllllllllll',
        '............hhhhhhhhhhhh', '...............b...b....', '...............b...b....', '............bbbbbbbbbbbb',
        '.............lllllllllll', '...............sssssssss', '........................', '........................'], pal);
      runs(P, [...CREASE, [4, 24, 25, 'z'], [5, 23, 25, 'z'], [6, 22, 24, 'z'], [7, 22, 23, 'z']], pal); },
  },
  bottom_six: {
    name: 'Bottom Six', tier: 'rare', why: 'Mouth hanging open, six gold teeth along the bottom row.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) cut(H, x, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx);
      runs(P, [[2, 14, 33, 'l'], [3, 12, 35, 'l'], [4, 10, 11, 'k'], [4, 36, 37, 'k'], [5, 10, 10, 'k'], [5, 37, 37, 'k'], [8, 13, 34, 'l'], [9, 15, 32, 's']], t);
      for (let hx = -6; hx <= 5; hx++) P.half(hx, 40, 15, ((hx + 6) >> 1) % 2 ? 0xd9a126 : GOLD_HI, 1); },
  },

  // ─────────────────────────────── EPIC
  zipped: {
    name: 'Zipped', tier: 'epic', why: 'A zipper where the mouth was, pull tab hanging: nothing said to anybody, ever.',
    draw(H, ctx) { for (let x = -4; x <= 3; x++) rec(H, x, 20, 0x18181c, 0); pro(H, 3, 20, 0xc8cdd4, 1); pro(H, 3, 19, 0xe02a2a, 1); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, z: 0xd9dee6, m: 0x8f96a1, H: 0xf6f8fb, D: 0x6c727c, M: 0xc8cdd4 };
      const L = []; for (let c = 10; c <= 35; c++) L.push([c % 2 ? 6 : 5, c, c, 'z']);
      runs(P, [...L, [5, 8, 9, 'm'], [6, 8, 9, 'm'], [4, 36, 39, 'H'], [5, 36, 39, 'M'], [6, 36, 39, 'M'], [7, 36, 39, 'D'],
        [3, 9, 38, 'l'], [8, 9, 38, 'l'], [9, 12, 35, 's']], pal);
      runs(P, [[8, 36, 39, 'r'], [9, 37, 38, 'R'], [10, 37, 38, 'R'], [11, 36, 39, 'r']], { r: 0xe02a2a, R: 0x8a1016 }); },
  },
  bite_the_bill: {
    name: 'Bite the Bill', tier: 'epic', why: 'A rolled bankroll clenched in the teeth, banded in yellow: the whole night\'s take.',
    draw(H, ctx) { for (let x = -6; x <= 5; x++) pro(H, x, 20, 0x7cbf62, 0); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, w: TEETH, g: GAP, h: 0xb3e595, m: 0x7cbf62, e: 0x4f8c45, p: 0x5e9e50, y: 0xf0c93c, Y: 0xffe58a, o: 0xb48a26 };
      const L = [[4, 0, 47, 'h'], [7, 0, 47, 'e']]; for (const c of [3, 8, 13, 34, 39, 44]) L.push([5, c, c + 1, 'p'], [6, c + 1, c + 2, 'p']);
      runs(P, [...L, [4, 21, 26, 'Y'], [5, 21, 26, 'y'], [6, 21, 26, 'y'], [7, 21, 26, 'o'],
        [2, 15, 32, 'l'], [3, 18, 29, 'w'], [3, 23, 23, 'g'], [3, 15, 17, 'k'], [3, 30, 32, 'k'],
        [8, 19, 28, 'w'], [8, 23, 23, 'g'], [8, 16, 18, 'k'], [8, 29, 31, 'k'], [9, 16, 31, 'l'], [10, 18, 29, 's']], pal);
      const end = [['m', 'm', 'm', 'm'], ['m', 'e', 'e', 'm'], ['m', 'e', 'e', 'm'], ['m', 'm', 'm', 'm']];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { P.paint('+x', 32 + i, 80 + j, pal[end[j][i]]); P.paint('-x', 32 + i, 80 + j, pal[end[j][i]]); } },
  },
  candy_fronts: {
    name: 'Candy Fronts', tier: 'epic', why: 'Six teeth in pink and mint enamel set in gold, like a jar on the bodega counter.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) rec(H, x, 20, x % 2 ? 0x8cf0d2 : 0xff8fcf, 1); cut(H, -4, 20, t.k); cut(H, 3, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, o: 0xe6b53c, h: 0xffffff };
      const L = []; for (let x = -3; x <= 2; x++) { const c = 4 * (x + 6); L.push([4, c, c, 'h'], [5, c, c, 'h']); if (x < 2) for (let j = 4; j <= 6; j++) L.push([j, c + 3, c + 3, 'o']); }
      runs(P, [...L, [7, 12, 35, 'o'], [3, 12, 35, 'l'], [3, 9, 11, 'k'], [3, 36, 38, 'k'], [8, 13, 34, 'l'], [9, 15, 32, 's'], ...CREASE], pal); },
  },
  chrome_lip: {
    name: 'Chrome Lip', tier: 'epic', why: 'Lips cast in mirror chrome, editorial and cold: the Dazed cover nobody on the block asked for.',
    draw(H, ctx) { for (let x = -3; x <= 2; x++) { rec(H, x, 21, 0xc9d0da, 1); pro(H, x, 20, 0xd3d9e2, 1); } },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, D: 0x3d4450, H: 0xffffff, m: 0xc9d0da, B: 0x8a93a1, S: (x, y) => ctx.sk.c(x, y, 7) };
      runs(P, [[0, 12, 16, 'S'], [0, 22, 25, 'S'], [0, 31, 35, 'S'], [0, 17, 21, 'H'], [0, 26, 30, 'H'], [1, 12, 13, 'S'], [1, 34, 35, 'S'], [1, 14, 33, 'm'],
        [2, 12, 12, 'S'], [2, 35, 35, 'S'], [2, 13, 34, 'B'], [3, 12, 35, 'D'],
        [4, 12, 35, 'D'], [5, 14, 33, 'H'], [6, 12, 35, 'm'], [7, 12, 35, 'B'], [4, 9, 11, 'k'], [4, 36, 38, 'k'], [8, 14, 33, 's']], pal); },
  },

  // ─────────────────────────────── GRAIL
  pave_fronts: {
    name: 'Pavé Fronts', tier: 'grail', why: 'White gold, every tooth paved in stones, four that catch any light on the street.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) rec(H, x, 20, 0xe6eaf0, 1); cut(H, -4, 20, t.k); cut(H, 3, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, D: 0xffffff, I: 0xc4e9ff, f: 0x9eaabb };
      const L = []; for (let c = 12; c <= 35; c++) for (let j = 4; j <= 6; j++) L.push([j, c, c, (c % 4 === 3 && c < 35) ? 'f' : (c + j) % 2 ? 'D' : 'I']);
      runs(P, [...L, [7, 12, 35, 'f'], [3, 12, 35, 'l'], [3, 9, 11, 'k'], [3, 36, 38, 'k'], [8, 13, 34, 'l'], [9, 15, 32, 's'], ...CREASE], pal);
      for (const hx of [-5, -1, 0, 4]) P.half(hx, 41, 16, 0xf4fbff, 3); },
  },
  crown_fronts: {
    name: 'Crown Fronts', tier: 'grail', why: 'Solid gold, a crown cut into the front two, rubies on the canines: king of the corner.',
    draw(H, ctx) { const t = tone(ctx); for (let x = -3; x <= 2; x++) rec(H, x, 20, GOLD, 1); cut(H, -4, 20, t.k); cut(H, 3, 20, t.k); },
    fine(P, ctx) { const t = tone(ctx), pal = { ...t, o: GOLD_LO, G: GOLD_HI };
      const L = [[4, 12, 35, 'G']]; for (const c of [15, 19, 27, 31]) for (let j = 4; j <= 6; j++) L.push([j, c, c, 'o']);
      const crown = ['o..oo..o', 'oo.oo.oo', 'oooooooo']; crown.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === 'o') L.push([4 + j, 20 + i, 20 + i, 'o']); });
      runs(P, [...L, [7, 12, 35, 'o'], [3, 12, 35, 'l'], [3, 9, 11, 'k'], [3, 36, 38, 'k'], [8, 13, 34, 'l'], [9, 15, 32, 's'], ...CREASE], pal);
      for (const hx of [-5, 4]) P.half(hx, 41, 16, 0xd81e3c, 1); },
  },
};
