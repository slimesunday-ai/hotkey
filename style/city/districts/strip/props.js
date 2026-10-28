// NEON ROW · the strip's own props (owner: the Neon Row agent). Authored once at base centre facing +z (the street / the aisle), toon
// voxels sized to the big-head body, memoized per day/night; every word is recorded on its board (the audit checks it sits there).
import { Vol, meshed, textMask } from '../../vox.js';
import { PAL, CV, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';

const MEMO = new Map(), memo = (k, f) => { k += '|' + TOD.night; let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
export const pvol = (nx, ny, nz, s = CV, cx = nx / 2, cz = nz / 2) => new Vol(nx, ny, nz, { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind) => { const b = meshed(V); b.kind = kind; return b; };
export const lit = () => TOD.night ? 3 : 0;
const I = PAL.iron, INK = PAL.ink, W = PAL.white, BRASS = 0xe7bd4a, VELVET = 0xb3122e;
// raised letters on a board face (+z by default), each voxel recorded with its board behind it
export function word(V, s, x0, ytop, z, c, l = 0, dir = 1, sc = 1) {
  const t = textMask(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const x = dir > 0 ? x0 + i * sc + a : x0 + (t.w - 1 - i) * sc + (sc - 1 - a), y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, 0, dir); }
  return t.w * sc;
}
export const textW = s => textMask(s).w;

// ── the night market's stall: iron frame, striped tarp roof with a scalloped valance, a skirted table stocked by trade, a bulb under
// the tarp; food stalls vent their steam through a stovepipe. 2.4 × 1.2 m, 2.3 m to the tarp (the valance clears a big head at 1.9)
const GOODS = {
  food: (V, c) => { V.box(3, 8, 5, 21, 9, 10, 0xdcdcdc); for (let x = 4; x < 20; x += 4) { V.box(x, 9, 6, x + 3, 11, 9, 0xc98a4b); V.box(x, 11, 6, x + 3, 12, 9, 0xe8d4b0); } },
  skewer: (V, c) => { V.box(3, 8, 5, 21, 9, 10, PAL.ink); for (let x = 4; x < 20; x += 2) for (let y = 9; y < 12; y++) V.set(x, y, 7 + (x % 3), y === 11 ? 0x7a3a1a : [0xc0392b, 0x8b4a24, 0xf0a030][(x + y) % 3]); },
  fruit: (V, c) => { for (let x = 3; x < 21; x += 3) V.box(x, 8, 5, x + 3, 10, 10, (xx, y, z) => (xx + y + z) % 2 ? 0xffb020 : 0xffd23a); V.box(3, 10, 6, 21, 11, 9, 0xff7a1a); },
  cups: (V, c) => { V.box(3, 8, 5, 21, 9, 10, W); for (let x = 4; x < 20; x += 3) { V.box(x, 9, 6, x + 2, 12, 8, [0xc98a4b, 0xff9fc8, 0x9fe89a][x % 3]); V.set(x, 12, 6, INK); } },
  discs: (V, c) => { for (let x = 3; x < 21; x++) V.box(x, 8, 5, x + 1, 11, 10, [0x17171b, 0xe8232a, 0x2f5bff, 0xffe23a, 0x7a3cff, 0xf7f7f2][(x * 7) % 6]); },
  bags: (V, c) => { for (let k = 0; k < 4; k++) { const x = 3 + k * 5; V.box(x, 8, 6, x + 4, 12, 9, [0xc98a4b, 0x17171b, 0xe7bd4a, 0xff4fa3][k]); V.box(x + 1, 12, 7, x + 3, 13, 8, BRASS); } },
  shades: (V, c) => { V.box(10, 8, 6, 14, 20, 8, INK); for (let y = 11; y < 20; y += 3) { V.box(4, y, 8, 9, y + 1, 9, [0x17171b, 0xe8232a, 0x2de2e6, 0xffe23a][y % 4]); V.box(15, y, 8, 20, y + 1, 9, [0xffe23a, 0x17171b, 0xff4fa3, 0x2de2e6][y % 4]); V.box(9, y, 7, 15, y + 1, 8, I); } },   // two racks of shades on one stand
  chains: (V, c) => { V.box(4, 8, 7, 20, 20, 8, INK); for (let x = 5; x < 19; x += 3) for (let y = 19; y > 10 - (x % 5); y--) if ((y + x) % 2) V.set(x + ((19 - y) > 5 ? 1 : 0), y, 8, BRASS, 2); },
  cases: (V, c) => { V.box(4, 8, 7, 20, 20, 8, W); for (let x = 5; x < 19; x += 3) for (let y = 10; y < 19; y += 3) V.box(x, y, 8, x + 2, y + 2, 9, [0xff4fa3, 0x2de2e6, 0x6cff4a, 0x17171b, 0xffe23a][(x + y) % 5]); },
};
export const stall = (seed, tarp, trade, steam = false) => memo('stall' + seed + tarp + trade + steam, () => {
  // at night the tarps glow like lanterns (lit from the bulb under them): the stripes go emissive a shade down
  const N = TOD.night, V = pvol(26, steam ? 40 : 24, 14), stripes = (x) => { const c = ((x >> 1) & 1) ? tarp : W; return N ? shade(c, .78) : c; }, tl = N ? 3 : 0;
  for (const [x, z] of [[1, 1], [24, 1], [1, 12], [24, 12]]) V.box(x, 0, z, x + 1, 22, z + 1, I);                  // the frame
  V.box(1, 22, 0, 25, 23, 14, (x) => stripes(x), tl);                                                              // the tarp roof
  for (let x = 1; x < 25; x++) V.box(x, x % 3 === 1 ? 19 : 20, 13, x + 1, 22, 14, stripes(x), tl);                   // the scalloped valance
  V.box(2, 0, 6, 24, 7, 12, shade(tarp, .8)); V.box(2, 7, 5, 24, 8, 12, 0xf2efe6);                                  // the skirted table
  (GOODS[trade] || GOODS.food)(V, tarp);
  V.box(12, 21, 7, 14, 22, 9, I); V.box(11, 18, 6, 15, 21, 10, 0xfff3c4, TOD.night ? 3 : 1);                        // the bulb
  if (steam) { V.box(20, 8, 7, 22, 26, 9, 0x8a8e96, 2); V.box(19, 8, 6, 23, 10, 10, 0x3b3d45);                      // stovepipe + the pot
    for (let k = 0; k < 5; k++) V.ell(21 + (hash(seed, k) - .5) * 3, 28 + k * 2.4, 8 + (hash(k, seed) - .5) * 2, 2 + k * .45, 1.6 + k * .2, 2 + k * .4, 0xf2f6fa); }
  return done(V, 'stall'); });
// its sign: a half-grain board on the tarp's front edge (0.05: 0.35 m letters), lit at night like the bulbs
export const stallSign = (name, bg, fg = W) => memo('ssign' + name + bg, () => {
  const S2 = .05, t = textW(name), Wd = t + 6, V = pvol(Wd, 12, 3, S2, Wd / 2, 1.5);
  V.box(0, 0, 0, Wd, 12, 2, bg); V.box(0, 0, 2, Wd, 1, 3, shade(bg, .75)); V.box(0, 11, 2, Wd, 12, 3, shade(bg, .75));
  word(V, name, 3, 9, 2, fg, TOD.night ? 3 : 0); return done(V, 'sign'); });

// ── the rope line: brass stanchions (0.9 m) with a red velvet rope sagging between them; n posts along +x, 1.1 m apart
export const ropeLine = n => memo('rope' + n, () => {
  const gap = 11, L = (n - 1) * gap + 3, V = pvol(L, 10, 3, CV, L / 2, 1.5);
  for (let k = 0; k < n; k++) { const x = k * gap; V.box(x, 0, 0, x + 3, 1, 3, BRASS, 2); V.box(x + 1, 1, 1, x + 2, 8, 2, BRASS, 2); V.box(x, 8, 0, x + 3, 10, 3, BRASS, 2); }
  for (let k = 0; k + 1 < n; k++) for (let t = 0; t <= gap; t++) { const x = k * gap + 1 + t, y = 8 - Math.round(Math.sin(t / gap * Math.PI) * 2.2); V.set(x, y, 1, VELVET); V.set(x, y - 1, 1, VELVET); }
  return done(V, 'rope'); });
// the red carpet from the door to the curb side of the rope (flat, one voxel)
export const carpet = (w, d) => memo('carpet' + w + d, () => { const V = pvol(w, 1, d); V.box(0, 0, 0, w, 1, d, (x) => (x === 0 || x === w - 1) ? BRASS : 0xc4122f); return done(V, 'carpet'); });
// the doorman's podium: a black lectern with a brass lamp and the list
export const podium = () => memo('podium', () => { const V = pvol(6, 14, 5); V.box(0, 0, 0, 6, 11, 5, INK); V.box(-1, 11, -1, 7, 12, 6, 0x2a2a30); V.box(1, 12, 0, 5, 13, 3, W);
  V.box(4, 12, 3, 5, 14, 4, BRASS, 2); V.set(4, 14, 3, 0xfff3c4, 3); return done(V, 'podium'); });

// ── street one-offs: the hot-dog cart (umbrella, steam off the water), a bench of milk crates, a speaker stack
export const hotDogCart = () => memo('hotdog', () => {
  const V = pvol(20, 30, 9), U = [0xffd21f, 0x2f5bff];   // 2.0 × 0.9 m: it stands at the curb and leaves the walkers their lane
  V.box(1, 4, 1, 19, 13, 8, 0xdfe6ee, 2); V.box(1, 13, 1, 19, 14, 8, 0xc9ced6, 2); for (const [x, z] of [[2, 1], [16, 1], [2, 6], [16, 6]]) V.box(x, 0, z, x + 2, 4, z + 2, PAL.ink);
  V.box(3, 7, 8, 17, 11, 9, 0xe8232a); word(V, 'HOT DOGS', 4, 10, 8, W, 0);
  V.box(9, 14, 4, 11, 24, 6, I); for (let k = 0; k < 6; k++) { const r = 8 - k * 1.4; for (let x = 0; x < 20; x++) for (let z = 0; z < 9; z++) if (Math.hypot(x + .5 - 10, (z + .5 - 4.5) * 1.6) <= r) V.set(x, 24 + k, z, U[((Math.atan2(z - 4.5, x - 10) + 3.2) * 1.3 | 0) % 2]); }
  V.box(4, 14, 2, 8, 16, 6, 0x9aa0a8, 2); for (let k = 0; k < 3; k++) V.ell(6 + k * .4, 17.5 + k * 1.6, 4, 1.4 + k * .3, 1, 1.2 + k * .2, 0xf2f6fa);
  return done(V, 'cart'); });

// ── window neon: a picture in tubes hung inside a window recess (half grain), one picture each; they glow day and night
const TUBES = {
  martini: [0x2de2e6, 0x6cff4a, (P) => { for (let k = 0; k < 9; k++) { P(3 + k, 16 - k); P(21 - k, 16 - k); } P(12, 7); P(12, 6); P(12, 5); P(12, 4); for (let x = 7; x < 18; x++) P(x, 3); for (let x = 3; x < 22; x++) P(x, 16); }, 1],
  moon: [0xffe23a, 0xff4fa3, (P) => { for (let a = 0; a < 64; a++) { const t = a / 64 * 6.283; const x = 12 + Math.cos(t) * 8, y = 11 + Math.sin(t) * 8; if (Math.hypot(x - 15.5, y - 13) > 6.6) P(Math.round(x), Math.round(y)); } }, 0],
  dice: [0xff4fa3, W, (P, Q) => { for (let k = 0; k < 11; k++) { P(4 + k, 4); P(4 + k, 14); P(4, 4 + k); P(14, 4 + k); } for (const [x, y] of [[7, 7], [11, 11], [9, 9]]) Q(x, y); for (let k = 0; k < 9; k++) { P(12 + k, 17); P(12 + k, 9); P(21, 9 + k); } Q(15, 12); Q(18, 14); }, 0],
  cherries: [0xe8232a, 0x6cff4a, (P, Q) => { for (const cx of [8, 16]) for (let a = 0; a < 24; a++) { const t = a / 24 * 6.283; P(Math.round(cx + Math.cos(t) * 3.4), Math.round(6 + Math.sin(t) * 3.4)); } for (let k = 0; k < 9; k++) { Q(8 + Math.round(k * .35), 10 + k); Q(16 - Math.round(k * .45), 10 + k); } }, 0],
  palm: [0xff4fa3, 0x2de2e6, (P, Q) => { for (let y = 2; y < 16; y++) { P(6, y); P(18, y); } for (let x = 6; x < 19; x++) P(x, 2); for (const x of [7, 10, 13, 16]) for (let y = 16; y < 21; y++) P(x, y); for (let a = 0; a < 20; a++) { const t = a / 20 * 6.283; Q(Math.round(12 + Math.cos(t) * 2.5), Math.round(9 + Math.sin(t) * 2.5)); } }, 0],
  mug: [0xffc21a, W, (P, Q) => { for (let y = 2; y < 16; y++) { P(5, y); P(16, y); } for (let x = 5; x < 17; x++) P(x, 2); for (let y = 5; y < 13; y++) P(20, y); P(17, 5); P(18, 5); P(19, 5); P(17, 12); P(18, 12); P(19, 12); for (let x = 4; x < 18; x += 2) Q(x, 17 + (x % 4 ? 1 : 0)); }, 0],
  star: [0x6cff4a, 0xff4fa3, (P) => { const pts = []; for (let k = 0; k < 10; k++) { const t = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 9.5; pts.push([12 + Math.cos(t) * r, 10 - Math.sin(t) * r]); }
    for (let k = 0; k < 10; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % 10]; for (let t = 0; t <= 12; t++) P(Math.round(x0 + (x1 - x0) * t / 12), Math.round(y0 + (y1 - y0) * t / 12)); } }, 0],
  bolt: [0xffe23a, 0x2de2e6, (P) => { const L = [[14, 19], [7, 10], [12, 10], [8, 1], [17, 12], [12, 12], [16, 19], [14, 19]]; for (let k = 0; k + 1 < L.length; k++) { const [x0, y0] = L[k], [x1, y1] = L[k + 1]; for (let t = 0; t <= 14; t++) P(Math.round(x0 + (x1 - x0) * t / 14), Math.round(y0 + (y1 - y0) * t / 14)); } }, 0],
  heart: [0xff2d6f, 0xffe23a, (P) => { for (let a = 0; a < 90; a++) { const t = a / 90 * 6.283, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); P(Math.round(12 + x * .55), Math.round(9 + y * .55)); } }, 0],
  eightball: [0x2de2e6, W, (P, Q) => { for (let a = 0; a < 60; a++) { const t = a / 60 * 6.283; P(Math.round(12 + Math.cos(t) * 8.5), Math.round(10 + Math.sin(t) * 8.5)); } for (let a = 0; a < 20; a++) { const t = a / 20 * 6.283; Q(Math.round(12 + Math.cos(t) * 2.6), Math.round(12 + Math.sin(t) * 2)); Q(Math.round(12 + Math.cos(t) * 2.2), Math.round(7.5 + Math.sin(t) * 1.8)); } }, 0],
  mic: [0xff4fa3, 0x2de2e6, (P, Q) => { for (let a = 0; a < 30; a++) { const t = a / 30 * 6.283; P(Math.round(12 + Math.cos(t) * 4), Math.round(15 + Math.sin(t) * 4)); } for (let y = 3; y < 11; y++) { Q(11, y); Q(13, y); } for (let x = 9; x < 16; x++) Q(x, 2); }, 0],
  lips: [0xff2d6f, 0xff4fa3, (P) => { for (let x = 3; x < 22; x++) { const u = (x - 12.5) / 9.5, top = 10 + Math.round((1 - u * u) * 5 - Math.abs(Math.sin(u * 3.1)) * 2), bot = 10 - Math.round((1 - u * u) * 5.5); P(x, top); P(x, bot); P(x, 10); } }, 0],
};
export const TUBE_KINDS = Object.keys(TUBES);
// the tubes stand on a smoked backing plate the size of the window opening (w × h metres, drawn on a 25 × 22 grid and scaled to it)
export const windowNeon = (kind, w = 1.2, h = 1.1) => memo('wneon' + kind + w + h, () => {
  const S2 = .05, [c1, c2, draw] = TUBES[kind], nx = Math.max(12, Math.round(w / S2)), ny = Math.max(12, Math.round(h / S2)), V = pvol(nx, ny, 2, S2, nx / 2, 1);
  const at = (x, y) => [Math.round(1 + x * (nx - 3) / 24), Math.round(1 + y * (ny - 3) / 21)];
  const P = (x, y) => { const [a, b] = at(x, y); V.set(a, b, 1, c1, 3); }, Q = (x, y) => { const [a, b] = at(x, y); V.set(a, b, 1, c2, 3); };
  V.box(0, 0, 0, nx, ny, 1, 0x1b1b2a); draw(P, Q); return done(V, 'sign'); });
// ── a card hung inside a shop window (half grain): letters on a dark plate — the pawnshop's CASH 4 GOLD, a bar's LIVE MUSIC
export const windowCard = (text, fg, bg = 0x1b1b2a, lit3 = false) => memo('wcard' + text + fg + bg + lit3, () => {
  const S2 = .05, t = textW(text), Wd = t + 6, V = pvol(Wd, 13, 2, S2, Wd / 2, 1);
  V.box(0, 0, 0, Wd, 13, 1, bg); V.box(0, 0, 1, Wd, 1, 2, fg); V.box(0, 12, 1, Wd, 13, 2, fg);
  word(V, text, 3, 10, 1, fg, lit3 ? 3 : lit()); return done(V, 'sign'); });

// ── more one-offs: the domino table (a green card table, the bones mid-game, four crates to sit on), the moving-day pile (boxes, a
// rolled rug, a floor lamp, a dresser)
export const dominoTable = () => memo('domino', () => {
  const V = pvol(16, 8, 16), G = 0x2a9a44, CR = [0xe8232a, 0x2f5bff, 0xffc21a, 0x14a83b];
  V.box(4, 6, 4, 12, 7, 12, G); for (const [x, z] of [[4, 4], [11, 4], [4, 11], [11, 11]]) V.box(x, 0, z, x + 1, 6, z + 1, I);
  for (let k = 0; k < 7; k++) { const x = 5 + (k % 4) * 2, z = 5 + (k >> 2) * 3 + (k & 1); V.box(x, 7, z, x + 1, 8, z + 2, 0xf7f7f2); }
  [[0, 7], [13, 7]].forEach(([x, z], k) => V.box(x, 0, z - 1, x + 3, 4, z + 2, (xx, y, zz) => ((xx + y + zz) % 2 && y > 0 && y < 3) ? undefined : CR[k]));   // a crate each end (the pair playing sits side by side along the curb)
  return done(V, 'table'); });
export const movingPile = () => memo('moving', () => {
  const V = pvol(24, 18, 9), BOX = [0xc98a4b, 0xb97a3b, 0xd99a5b];
  V.box(0, 0, 1, 7, 6, 8, BOX[0]); V.box(1, 6, 2, 6, 11, 7, BOX[1]); V.box(7, 0, 2, 12, 5, 7, BOX[2]); V.box(0, 3, 1, 7, 4, 8, 0xe8d4b0);
  V.box(12, 0, 1, 20, 9, 8, 0x8b5a3a); V.box(13, 2, 0, 19, 3, 1, 0xe7bd4a); V.box(13, 6, 0, 19, 7, 1, 0xe7bd4a);           // the dresser, brass pulls
  V.box(7, 5, 3, 12, 7, 6, 0x7a3cff); V.box(20, 0, 3, 24, 2, 7, 0x3b3f4a); V.box(21, 2, 4, 22, 16, 5, I); V.box(19, 14, 2, 24, 18, 7, 0xfff3c4, TOD.night ? 3 : 0);   // a rug, the lamp
  return done(V, 'moving'); });
// ── an upstairs business's vertical blade: a tall board standing off the wall on two iron arms, the word stacked down both faces in
// tube letters, a lit rim (read up and down the street, day and night). Local +z points out of the wall; the wall is at z = 0.
export const bladeSign = (text, bg, fg, rim) => memo('blade' + text + bg + fg + rim, () => {
  const n = text.length, H = n * 8 + 6, V = pvol(5, H, 15, CV, 2.5, 0);
  V.box(1, 0, 3, 4, H, 15, bg); V.box(1, 0, 14, 4, H, 15, rim, 3); V.box(1, 0, 3, 4, 1, 15, rim, 3); V.box(1, H - 1, 3, 4, H, 15, rim, 3);
  for (const y of [2, H - 4]) V.box(2, y, 0, 3, y + 2, 3, I);                                                     // the arms back to the wall
  [...text].forEach((ch, k) => { const t = textMask(ch), ytop = H - 3 - k * 8, off = 3 + ((11 - t.w) >> 1); V.recNext();
    for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) { const y = ytop - j;
      V.set(0, y, off + i, fg, 3); V.recN(ch, 0, y, off + i, -1, 0);                                              // −x face: reads outward (+z) left to right
      V.set(4, y, off + (t.w - 1 - i), fg, 3); V.recN(ch, 4, y, off + (t.w - 1 - i), 1, 0); } });                   // +x face: mirrored
  return done(V, 'blade'); });
