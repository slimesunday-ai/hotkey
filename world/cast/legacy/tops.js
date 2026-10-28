// LEGACY · THE OLD TOPS (imported 2026-10-02 from deadnet-style-wardrobe, branch opus/wardrobe-diversity @ 4fc5c22, world/chars.js).
// ISOLATED CONSTRUCTION for the imported tops only (world/fresh/imported/tops.js via imported/tops-kit.js, README § Imported traits).
// Nothing in the fresh construction (world/chars.js, world/fit/, world/base-kit.js) or any fresh trait file imports world/legacy/.
//
// What this is: the old chars.js top tables, copied VERBATIM (line ranges below, unedited), then the old install passes run in the
// old order, so TOPS holds the final draw the old Trait Studio rendered for every top (draw(B, p, sk) on the body grid; B.fit is the
// body's routing context, as in the old compose). No three.js, no compose.
//   chars.js 25–27     mulberry32, lerpHex, shade
//   chars.js 181       RAINBOW
//   chars.js 548–549   hash3, cwOf (NEWI, the old registry with Drop 02's colourways, is head.js's: chars.js 550–631)
//   chars.js 273–323   PRINTS, hoodieBase, teeBase, TOPS (the original tops)
//   chars.js 734–790   shirt, art, Drop 02's tops
// Then (chars.js 885–889, same order): installTopsRefit (fit/refit-tops.js) · installOuter (fit/refit-outer.js) · installOpusTops
// (fit/opus-tops/tops.js; its NEWT / NEWI / NAMES are stand-ins here, so head.js's tables stay the head's) · the necklines stamped
// from TOPFIT (fit/body.js, the old copy: flank and neckline per top). fit/refit-tops.js, fit/refit-outer.js and fit/opus-tops/tops.js
// are verbatim copies of the old files (their imports already point at ./body.js, the old copy).
import { NEWI } from './head.js';
import { sleeve as fitSleeve, shoulderCap, TOPFIT } from './fit/body.js';
import { installTopsRefit } from './fit/refit-tops.js';
import { installOuter } from './fit/refit-outer.js';
import { installOpusTops } from './fit/opus-tops/tops.js';
// ───────────────── chars.js 25–27
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lerpHex = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
// ───────────────── chars.js 181
const RAINBOW = [0x61bb46, 0xfdb827, 0xf5821f, 0xe03a3e, 0x963d97, 0x009ddc];
// ───────────────── chars.js 548–549
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const cwOf = (id, p) => { const l = NEWI[id].cw; return l[((((p && p.cw) | 0) % l.length) + l.length) % l.length]; };
// ───────────────── chars.js 273–323
const PRINTS = { heart: [['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'], 0xff3b6b], star: [['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'], 0xffd21f],
  bomb: [['...Y.', '..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'], 0x111111], cmd: [['XX.XX', 'XXXXX', '.X.X.', 'XXXXX', 'XX.XX'], 0xffffff] };
function hoodieBase(B, C) { const D = shade(C, .72);
  B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 10, -2, -5, 18, 2, C); B.box(5, 10, -2, 8, 18, 2, C);
  for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, D); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, D);
  B.box(-6, 17, -4, 6, 19, 2, D); }
function teeBase(B, C) { B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 14, -2, -5, 18, 2, C); B.box(5, 14, -2, 8, 18, 2, C); }
const TOPS = {
  hoodie(B, p) { const C = p.c ?? 0x151517, LC = p.lc ?? 0xd7141a; hoodieBase(B, C);
    if ((p.logo ?? 'box') === 'box') { B.box(-3, 10, 4, 3, 13, 5, LC); for (const x of [-2, -1, 1]) B.set(x, 11, 4, 0xffffff); for (const x of [-2, 0, 1]) B.set(x, 12, 4, 0xffffff); } else B.box(1, 14, 4, 4, 16, 5, 0xffffff); },
  desktop(B) { hoodieBase(B, 0x008080); B.box(-4, 10, 4, 3, 15, 5, 0xc0c0c0); for (let x = -4; x < 3; x++) B.set(x, 14, 4, lerpHex(0x000080, 0x1084d0, (x + 4) / 6)); B.set(2, 14, 4, 0xc0c0c0);
    B.box(-3, 11, 4, 2, 13, 5, 0xffffff); for (const x of [-2, -1, 0]) B.set(x, 12, 4, 0x0a0a0a); },
  puffer(B, p) { const C = p.c ?? 0xc9ced6, L = shade(C, 1.12), D = shade(C, .74), q = ly => ly % 3 === 0 ? D : (ly % 3 === 2 ? L : C);   // (fit refit 2026-09-30, world/fit/body.js)
    // (superseded by world/fit/refit-outer.js installOuter; kept drawable) the shell (chest): 2 proud from the chest down to y 12, a
    // banded waist 1 proud below it (y 9…11); quilt rows from the hem, every third a groove. No row at y 18: the head's collar slab stays skin.
    B.box(-7, 12, -4, 7, 18, 5, (x, y) => q(y - 9), 1); B.box(-6, 9, -4, 6, 12, 5, (x, y) => q(y - 9), 1);
    for (let y = 9; y < 18; y++) if ((y - 9) % 3 === 0) { const w = y < 12 ? 6 : 7; for (let x = -w; x < w; x++) { B.del(x, y, 4); B.del(x, y, -4); } for (let z = -4; z < 5; z++) { B.del(-w, y, z); B.del(w - 1, y, z); } }
    // one sleeve per arm (simple arms: the arm is one piece), quilted, the cuff at the wrist; a shoulder cap y 17…18 over the chest's side
    for (const s of 'LR') { fitSleeve(B, s, 'arm' + s, { x0: -10, x1: -8, y0: 9, y1: 16, z0: -3, z1: 2 }, (lx, ly) => ly % 3 === 0 ? D : ly % 3 === 2 ? L : C, 1);
      shoulderCap(B, s, (lx, ly) => ly === 9 ? L : C, { outer: -10, inner: -7, z0: -3, z1: 2, l: 1 }); }
    for (let y = 9; y < 18; y++) if ((y - 9) % 3) B.set(-1, y, 4, 0x55585f, 1); },
  jersey(B, p) { const C = p.c ?? 0xb3121b, N = p.n ?? 0xffffff, T = 0xf2f2f2;   // (fit refit 2026-09-30, world/fit/body.js)
    B.box(-6, 9, -3, 6, 18, 4, C); for (let y = 14; y < 18; y++) for (let z = -3; z < 4; z++) { B.set(-6, y, z, T); B.set(5, y, z, T); if (y === 17) { B.set(-5, y, z, T); B.set(4, y, z, T); } }   // the shell; white side panels + the yoke's end over each shoulder (chest)
    for (const s of 'LR') { fitSleeve(B, s, 'arm' + s, { x0: -8, x1: -7, y0: 15, y1: 16, z0: -2, z1: 1 }, T); shoulderCap(B, s, T); }   // white sleeves + the cap: the trim runs across the shoulder
    for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, T);
    B.text('56', -4, 14, 3, N); B.textBack('56K', 5, 14, -3, N); },
  tee(B, p) { const C = p.c ?? 0x151517, pr = p.print ?? 'heart', [rows, pc] = PRINTS[pr];   // (fit refit 2026-09-30: shell on the chest, sleeves + cap per segment, flat print)
    B.box(-6, 9, -3, 6, 18, 4, C); for (const s of 'LR') { fitSleeve(B, s, 'arm' + s, { x0: -8, x1: -7, y0: 14, y1: 16, z0: -2, z1: 1 }, C); shoulderCap(B, s, C); }
    B.bmp(rows, { X: pc, Y: 0xffb000 }, -3, 16, 3, 4);
    if (pr === 'heart') for (const [x, y] of [[-1, 16], [0, 15], [-1, 14], [0, 13]]) B.set(x, y, 3, C); if (pr === 'bomb') B.set(-2, 13, 3, 0xffffff); },
  bsodtee(B) { const C = 0x0000aa; teeBase(B, C); B.box(-2, 16, 3, 2, 17, 4, 0xaaaaaa); const r = mulberry32(3); for (const y of [14, 12, 10]) for (let x = -5; x < 5; x++) if (r() < .72) B.set(x, y, 3, 0xffffff); },
  varsity(B, p) { const C = p.c ?? 0x1b2a4a, Sl = p.s ?? 0xefe6d2;
    B.box(-6, 9, -3, 6, 18, 4, C); B.box(-9, 10, -2, -5, 18, 2, Sl); B.box(5, 10, -2, 9, 18, 2, Sl);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, (z & 1) ? Sl : C); for (const x0 of [-9, 5]) for (let x = x0; x < x0 + 4; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, C);
    for (const y of [11, 13, 15]) B.set(-1, y, 4, 0xe9e9e9, 1); B.box(1, 11, 4, 6, 18, 5, Sl); B.text('D', 2, 16, 4, C); },
  track(B) { const C = 0xefe9dc; B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 10, -2, -5, 18, 2, C); B.box(5, 10, -2, 8, 18, 2, C);
    RAINBOW.forEach((col, i) => { const y = 17 - i; for (let x = -6; x < 6; x++) B.set(x, y, 3, col); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) B.set(x, y, 1, col); });
    for (let y = 9; y < 18; y++) B.set(-1, y, 4, 0xbdbdbd, 2); },
  tank(B, p, sk) { const C = p.c ?? 0xf4f4f4, D = shade(C, .9); B.box(-5, 9, -2, 5, 18, 3, x => (x & 1) ? D : C); for (const x of [-2, -1, 0, 1]) B.set(x, 17, 2, sk.c(x, 17, 2), sk.layer); },
  jumpsuit(B) { const C = 0xff7a1a, D = shade(C, .78);   // county orange, whatever the palette says
    B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 10, -2, -5, 18, 2, C); B.box(5, 10, -2, 8, 18, 2, C);
    for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, D);
    for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, D); B.box(1, 12, 4, 5, 15, 5, 0xf2f2f2); B.textBack('404', 4, 16, -3, D); },
  velour(B, p) { const C = p.c ?? 0x6e1f3a, L = shade(C, 1.2), Sv = 0xf2f2f2, nap = (x, y) => ((x + y * 2) % 5 === 0 ? L : C);
    B.box(-6, 9, -3, 6, 18, 4, nap); B.box(-8, 10, -2, -5, 18, 2, nap); B.box(5, 10, -2, 8, 18, 2, nap);
    for (let y = 10; y < 18; y++) { B.set(-8, y, 0, Sv); B.set(7, y, 0, Sv); } for (let y = 9; y < 18; y++) B.set(-1, y, 4, 0xc9ced4, 2); B.box(-6, 17, -4, 6, 19, 2, shade(C, .8)); },
  flannel(B, p) { const C = p.c ?? 0xb3121b, pl = (x, y) => ((x & 3) === 0 && (y & 3) === 0) ? 0x151515 : ((x & 3) === 0 || (y & 3) === 0) ? shade(C, .5) : C;
    B.box(-6, 9, -3, 6, 18, 4, pl); B.box(-8, 10, -2, -5, 18, 2, pl); B.box(5, 10, -2, 8, 18, 2, pl); B.box(-6, 17, -4, 6, 19, 2, pl);
    for (let y = 9; y < 16; y++) for (const x of [-2, -1, 0, 1]) B.set(x, y, 3, 0xf2f2f2); B.set(-1, 16, 4, 0xe9e2cf); },
  babytee(B, p) { const C = p.c ?? 0xf7b6d2; B.box(-5, 12, -2, 5, 18, 3, C); B.box(-8, 15, -2, -5, 17, 2, C); B.box(5, 15, -2, 8, 17, 2, C); B.bmp(PRINTS.star[0], { X: 0xffffff }, -3, 17, 2, 3); },
};
// ───────────────── chars.js 734–790
// ── tops (B; y ≥ 9 so nothing rides the legs)
const shirt = (B, c, long = true, l = 0) => { B.box(-6, 9, -3, 6, 18, 4, c, l); if (long) { B.box(-8, 10, -2, -5, 18, 2, c, l); B.box(5, 10, -2, 8, 18, 2, c, l); } else { B.box(-8, 14, -2, -5, 18, 2, c, l); B.box(5, 14, -2, 8, 18, 2, c, l); } };
const art = (B, rows, pal, x0, top, z = 3) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = typeof pal[r[i]] === 'function' ? pal[r[i]](i, j) : pal[r[i]]; if (c !== undefined) B.set(x0 + i, top - j, z, c); } });
Object.assign(TOPS, {
  catee(B, p) { const [, C] = cwOf('catee', p); shirt(B, C, false);
    art(B, ['O......O', 'OO....OO', 'ODDDDDDO', 'OGKOOGKO', 'OOOOOOOO', 'KOOPPOOK', '.OOOOOO.'], { O: 0xf08a24, D: 0xb85a10, G: 0x2ecc40, K: 0x151515, P: 0xff7ab6 }, -4, 16); },
  tapetee(B, p) { const [, C] = cwOf('tapetee', p); shirt(B, C, false);
    for (const [z, sx] of [[3, 1], [-3, -1]]) for (let x = -6; x < 6; x++) for (let y = 9; y < 18; y++) { const d = (((sx * x - y) % 12) + 12) % 12; if (d <= 2) B.set(x, y, z, d === 1 && ((x + y) & 3) < 2 ? 0x151515 : 0xffd21f); }
    for (const x of [-8, 7]) for (let y = 14; y < 18; y++) for (let z = -2; z < 2; z++) if ((((z - y) % 12) + 12) % 12 <= 2) B.set(x, y, z, 0xffd21f); },
  dyehoodie(B, p) { const [, A, Bc, Cc] = cwOf('dyehoodie', p), cs = [A, Bc, Cc], dye = (x, y, z) => { const a = Math.atan2(y - 13, x + .5 + (z < 0 ? 3 : 0)), r = Math.hypot(y - 13, x + .5); return cs[((Math.floor(a / (Math.PI * 2) * 6 + r * .45) % 3) + 3) % 3]; };
    B.box(-6, 9, -3, 6, 18, 4, dye); B.box(-8, 10, -2, -5, 18, 2, dye); B.box(5, 10, -2, 8, 18, 2, dye);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, shade(dye(x, 9, z), .75)); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, shade(dye(x, 10, z), .75));
    B.box(-6, 17, -4, 6, 19, 2, (x, y, z) => shade(dye(x, y, z), .85)); B.box(-4, 10, 4, 4, 13, 5, (x, y, z) => shade(dye(x, y, z), .9));
    for (const x of [-2, 1]) for (let y = 13; y < 17; y++) B.set(x, y, 4, 0xf4f4f4); },
  trackjkt(B, p) { const [, C, S2, Pp] = cwOf('trackjkt', p); shirt(B, C, true);
    for (let x = -6; x < 6; x++) { for (const y of [15, 16, 17]) { B.set(x, y, 3, S2); B.set(x, y, -3, S2); } B.set(x, 14, 3, Pp); B.set(x, 14, -3, Pp); }
    for (let y = 10; y < 18; y++) { for (const z of [-1, 0]) { B.set(-8, y, z, S2); B.set(7, y, z, S2); } B.set(-8, y, 1, Pp); B.set(7, y, 1, Pp); }   // one stripe and a piping down each sleeve
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, shade(C, .75)); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, shade(C, .75));
    B.box(-4, 17, -3, 4, 19, 3, S2); for (let y = 9; y < 19; y++) B.set(-1, y, y > 16 ? 3 : 4, 0xbdbdbd, 2); },
  bball(B, p, sk) { const [, C, N] = cwOf('bball', p), M = shade(C, .9); B.box(-5, 9, -3, 5, 18, 4, (x, y, z) => ((x + y + z) & 1) ? C : M); B.box(-6, 9, -3, 6, 12, 4, (x, y, z) => y === 9 ? N : (((x + y + z) & 1) ? C : M));
    for (const y of [16, 17]) for (const x of [-5, -4, 3, 4]) for (let z = -3; z < 4; z++) { if (z < -2 || z > 2) B.del(x, y, z); else B.set(x, y, z, sk.c(x, y, z), sk.layer); }
    for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, sk.c(x, y, 3), sk.layer);
    for (const [x, y] of [[-3, 17], [2, 17], [-2, 16], [1, 16], [-1, 15], [0, 15]]) B.set(x, y, 3, N); for (const x of [-3, 2]) for (let y = 9; y < 16; y++) { B.set(x === -3 ? -5 : 4, y, 0, N); }
    B.text('04', -4, 14, 3, N); B.textBack('04', 2, 14, -3, N); },
  buffalo(B, p) { const [, C] = cwOf('buffalo', p), D = shade(C, .55), chk = (a, b) => { const i = (a >> 1) & 1, j = (b >> 1) & 1; return i && j ? 0x141414 : (i || j ? D : C); }, pl = (x, y, z) => chk(x + z + 8, y);
    shirt(B, pl, true); B.box(-6, 17, -4, 6, 19, 2, pl);
    for (let y = 9; y < 17; y++) for (const x of [-2, -1, 0, 1]) B.set(x, y, 3, 0x151517);
    for (const x of [-3, 2]) for (let y = 9; y < 17; y++) B.set(x, y, 4, pl(x, y, 4)); for (const [x, y] of [[-3, 17], [-4, 17], [2, 17], [3, 17]]) B.set(x, y, 4, pl(x, y, 4)); },
  bootleg(B, p) { const [, C] = cwOf('bootleg', p); shirt(B, C, false);
    art(B, ['Y.YYY.YY.Y', 'PPPKKKKPPP', 'PZPSSSSPZP', 'PPZKKKKZPP', 'PZPSSSSPZP', 'PPPSGGSPPP', 'W.WW.WWW.W'], { Y: 0xffd21f, K: 0x151515, S: 0xc8744a, Z: 0xffd21f, G: 0xe7bd4a, W: 0xf2f2f2, P: (i, j) => lerpHex(0xff4fa3, 0x5a2bd6, j / 6) }, -5, 16);
    for (const y of [15, 13, 11]) for (let x = -4; x < 4; x++) if ((x + y) % 5) B.set(x, y, -3, 0xf2f2f2); },
  slabtee(B, p) { const [, C] = cwOf('slabtee', p); shirt(B, C, false);
    art(B, ['RRWRWWRR', 'LLLLLLLL', 'LHHHHHHL', 'LHSSSSHL', 'LHKSSKHL', 'LHSSSSHL', 'LHHHHHHL', 'LLLLLLLL'], { R: 0xd7141a, W: 0xffffff, L: 0xd9dde3, S: 0xf5c518, K: 0x151515, H: (i, j) => [0xc8f0ff, 0xffc8f0, 0xfff4b0, 0xc8ffd8][(i + j) & 3] }, -4, 16); },
  chenille(B, p) { const [, W, Sl, Pt] = cwOf('chenille', p);
    B.box(-6, 9, -3, 6, 18, 4, W); B.box(-9, 10, -2, -5, 18, 2, Sl, 1); B.box(5, 10, -2, 9, 18, 2, Sl, 1);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, (z & 1) ? Pt : W); for (const x0 of [-9, 5]) for (let x = x0; x < x0 + 4; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, (x & 1) ? Pt : W);
    B.box(-5, 17, -4, 5, 19, 2, x => (x & 1) ? Pt : W); for (const y of [11, 13, 15]) B.set(-1, y, 4, 0xe9e9e9, 2);
    art(B, ['..XX', '.XX.', 'XXXX', '.XX.', 'XX..'], { X: (i, j) => ((i + j) & 1) ? Pt : shade(Pt, .85) }, 0, 16, 4);
    for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) B.set(-9, 14 + dy, -1 + dz, Pt); },
  bubble(B, p) { const [, C, l] = cwOf('bubble', p), Lt = shade(C, 1.14), D = shade(C, .7), q = (x, y) => y % 3 === 0 ? D : (y % 3 === 2 ? Lt : C);
    B.box(-7, 9, -5, 7, 19, 6, q, l);
    for (let y = 9; y < 19; y++) if (y % 3 === 0) { for (let x = -7; x < 7; x++) { B.del(x, y, 5); B.del(x, y, -5); } for (let z = -5; z < 6; z++) { B.del(-7, y, z); B.del(6, y, z); } }
    B.box(-11, 9, -4, -7, 18, 4, q, l); B.box(7, 9, -4, 11, 18, 4, q, l);
    for (let y = 9; y < 18; y++) if (y % 3 === 0) for (let z = -4; z < 4; z++) { B.del(-11, y, z); B.del(10, y, z); }
    B.box(-4, 18, -4, 4, 19, 4, D, l); for (let y = 9; y < 18; y++) if (y % 3) B.set(-1, y, 5, 0x3a3d44, 2); },
  leather(B, p) { const [, C, Hw] = cwOf('leather', p), D = shade(C, .7), Lt = shade(C, 1.6);
    shirt(B, (x, y, z) => ((x * 3 + y * 7 + z * 5) % 11 === 0) ? Lt : C, true, 1); B.box(-6, 17, -4, 6, 19, 2, C, 1);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, D, 1); B.box(3, 9, 4, 5, 10, 5, Hw, 2);
    for (const [x, y] of [[-5, 17], [-4, 17], [-4, 16], [-3, 16], [-3, 15], [-2, 15], [3, 17], [4, 17], [2, 16], [3, 16], [1, 15], [2, 15]]) B.set(x, y, 4, D, 1);
    for (let y = 9; y < 17; y++) B.set(Math.round(-2 + (y - 9) * 5 / 7), y, 4, Hw, 2);
    B.set(-5, 16, 4, Hw, 2); B.set(4, 16, 4, Hw, 2); for (const x of [-8, 7]) for (const y of [10, 11]) B.set(x, y, 0, Hw, 2); },
  furcoat(B, p) { const [, C, C2, K] = cwOf('furcoat', p), fur = (x, y, z) => { const h = hash3(x, y, z); if (K !== undefined && h % 6 === 0) return K; return (h & 3) === 0 ? C2 : (h & 3) === 1 ? shade(C, .85) : C; };
    B.box(-7, 9, -5, 7, 19, 6, fur); B.box(-10, 9, -4, -7, 18, 4, fur); B.box(7, 9, -4, 10, 18, 4, fur); B.box(-6, 16, -6, 6, 19, 7, fur);
    for (let y = 9; y < 16; y++) for (let k = -7; k < 7; k++) { if (hash3(k, y, 7) % 3 === 0) B.set(k, y, 6, fur(k, y, 6)); if (hash3(k, y, 8) % 3 === 0) B.set(k, y, -6, fur(k, y, -6)); }
    for (let y = 9; y < 18; y++) for (let z = -4; z < 4; z++) { if (hash3(y, z, 9) % 3 === 0) B.set(-11, y, z, fur(-11, y, z)); if (hash3(y, z, 10) % 3 === 0) B.set(10, y, z, fur(10, y, z)); }
    for (let y = 9; y < 16; y++) { B.set(-1, y, 5, shade(C, .55)); B.del(-1, y, 6); } },
});
// ───────────────── the install passes (chars.js 885–889, in the old order)
const OPUS = { NEWT: { top: {} }, NEWI: {}, NAMES: { top: {} } };   // (stand-ins: the Opus tops' registry rows, kept apart from head.js's)
installTopsRefit({ TOPS, PRINTS, cwOf, shade, lerpHex, mulberry32, RAINBOW });   // (before the necklines are stamped on TOPS)
installOuter({ TOPS, cwOf, shade, hash3 });   // refit 1: puffy + structured tops (world/fit/refit-outer.js)
installOpusTops({ TOPS, NEWT: OPUS.NEWT, NEWI: OPUS.NEWI, NAMES: OPUS.NAMES });   // (chars.js 887, with the stand-ins)
for (const id in TOPS) TOPS[id].neckline = TOPFIT[id]?.neckline ?? 'crew';

// the old page's look value for a top (old studio.js baseOf): { id, cw: 0 } with colourways, { id } without
export const baseOf = id => (NEWI[id] && NEWI[id].cw) || (OPUS.NEWI[id] && OPUS.NEWI[id].cw) ? { id, cw: 0 } : { id };
export { TOPS, TOPFIT };
