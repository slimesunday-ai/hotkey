// SUNNY ACRES · the swap meet's pieces (owner: the Sunny Acres / Millennium Mall agent): stalls under pop-up canopies, tables of
// goods, tarp lean-tos over blankets, rims, bikes, the elote cart, the hangout's folding chairs. Authored at the 0.05 grain (small
// signs and goods), base centre, facing +z. Every stall is its own template with its own hand-lettered board: no two alike.
import { PAL, hash, shade, M, pv, done, txt, tw, cyl, ring, line } from './brush.js';

const INK = PAL.ink, WHITE = PAL.white, GALV = 0xb9bcc4, TARP = 0x2f6bdf, WDD = PAL.woodD, S = .05;
const P = (nx, ny, nz) => pv(nx, ny, nz, nx / 2, nz / 2, S);
// the goods, on a table top (x0…x1, y, z0…z1), in 0.05 voxels
const GOODS = {
  tools: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x < x1 - 2; x += 4) V.box(x, y, z0 + 2, x + 2, y + 1, z1 - 4, [0x9a9ca4, 0xe8232a, 0x2f5bff, 0xffc21a][(x >> 2) % 4], 2); V.box(x1 - 10, y, z0 + 2, x1 - 2, y + 5, z0 + 7, 0xe8232a); V.box(x1 - 10, y + 5, z0 + 3, x1 - 2, y + 6, z0 + 6, INK); },
  stereos: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x + 7 < x1 - 1; x += 8) { V.box(x, y, z0 + 3, x + 7, y + 3, z1 - 3, INK); V.box(x + 1, y + 1, z1 - 3, x + 6, y + 2, z1 - 2, [0x2de2e6, 0x6cff4a, 0xff4fa3][(x >> 3) % 3], 1); } V.box(x0 + 2, y + 3, z0 + 2, x0 + 8, y + 9, z0 + 7, INK); cyl(V, x0 + 5, z0 + 7, 1.6, y + 4, y + 8, 0x3a3d45); },
  phones: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x < x1 - 2; x += 3) for (let z = z0 + 2; z < z1 - 3; z += 4) V.box(x, y, z, x + 2, y + 1, z + 3, [0xff4fa3, 0x2de2e6, 0xffe23a, INK, 0x7a3cff, WHITE][(x + z) % 6], 1); },
  dvds: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x + 3 < x1 - 1; x += 4) { const h = 2 + ((x * 7) % 4); V.box(x, y, z0 + 3, x + 3, y + h, z1 - 3, (xx, yy) => [0x17171b, 0xe8232a, 0x2f5bff, 0xffc21a][(yy + x) % 4]); } },
  gold: (V, x0, x1, y, z0, z1) => { V.box(x0 + 1, y, z0 + 1, x1 - 1, y + 2, z1 - 1, INK); V.box(x0 + 2, y + 2, z0 + 2, x1 - 2, y + 3, z1 - 2, 0x3a1d4a); for (let x = x0 + 3; x < x1 - 3; x += 2) V.set(x, y + 3, (z0 + z1) >> 1, PAL.gold, 2); for (let x = x0 + 4; x < x1 - 4; x += 4) V.set(x, y + 3, z0 + 4, 0xdfe3ea, 2); V.box(x0 + 1, y + 4, z0 + 1, x1 - 1, y + 5, z1 - 1, 0x9fd8ff, 1); for (const x of [x0 + 1, x1 - 2]) for (const z of [z0 + 1, z1 - 2]) V.box(x, y + 2, z, x + 1, y + 4, z + 1, INK); },
  food: (V, x0, x1, y, z0, z1) => { cyl(V, x0 + 7, (z0 + z1) / 2, 5, y, y + 7, 0x9a9ca4, 2); V.box(x0 + 3, y + 7, z0 + 3, x0 + 11, y + 8, z1 - 3, 0x9a9ca4, 2); V.box(x1 - 12, y, z0 + 2, x1 - 2, y + 7, z1 - 2, 0xe8232a); V.box(x1 - 12, y + 7, z0 + 2, x1 - 2, y + 8, z1 - 2, WHITE); for (let x = x0 + 15; x < x1 - 14; x += 3) V.box(x, y, z0 + 4, x + 2, y + 2, z1 - 4, 0xffe23a); },
  socks: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x + 3 < x1 - 1; x += 5) for (let z = z0 + 2; z + 3 < z1 - 1; z += 5) V.box(x, y, z, x + 4, y + 2 + ((x + z) % 2), z + 4, [WHITE, INK, 0x9a9aa6, WHITE, 0xe8232a][(x + z) % 5]); },
  junk: (V, x0, x1, y, z0, z1) => { V.box(x0 + 2, y, z0 + 2, x1 - 2, y + 4, z1 - 2, 0x2f5bff); for (let x = x0 + 3; x < x1 - 3; x += 3) V.box(x, y + 4, z0 + 3 + (x % 5), x + 2, y + 6, z0 + 5 + (x % 5), [0xffc21a, 0xe8232a, 0x25b84c, 0xff4fa3, WHITE][x % 5]); },
  vinyl: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x + 5 < x1; x += 6) V.box(x, y, z0 + 2, x + 2, y + 8, z1 - 2, (xx, yy, zz) => ((zz + x) % 6 < 2) ? [0xe8232a, 0xffc21a, 0x2de2e6][x % 3] : INK); },
  perfume: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x < x1 - 2; x += 3) for (const z of [z0 + 3, z1 - 5]) { V.box(x, y, z, x + 2, y + 4, z + 2, [0xff4fa3, 0x9fd8ff, 0xffe23a, 0x7a3cff][(x + z) % 4], 1); V.box(x, y + 4, z, x + 1, y + 5, z + 1, PAL.gold, 2); } },
  toys: (V, x0, x1, y, z0, z1) => { for (let x = x0 + 2; x + 4 < x1; x += 5) { const c = [0xe8232a, 0x2f5bff, 0x25b84c, 0xffc21a, 0xff4fa3][x % 5]; V.box(x, y, z0 + 4, x + 4, y + 6, z0 + 8, c); V.box(x, y + 6, z0 + 4, x + 4, y + 9, z0 + 8, 0xffd2a8); V.box(x + 1, y, z1 - 7, x + 3, y + 3, z1 - 3, shade(c, .8)); } },
};
// a folding table with goods (1.8 × 0.8 m, 0.7 m high)
function table(V, x0, z0, goods, top = 0xf2f2ee) { const x1 = x0 + 36, z1 = z0 + 16; for (const [x, z] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) V.box(x, 0, z, x + 1, 14, z + 1, GALV, 2); V.box(x0, 14, z0, x1, 15, z1, top); GOODS[goods](V, x0, x1, 15, z0, z1); }
// a hand-lettered board (one or two short lines), letters on its +z face; returns the board's x range
function card(V, xc, y0, z, lines, bg, fg) { const rows = lines.split('/'), w = Math.max(...rows.map(r => tw(r))) + 4, h = rows.length * 9 + 3, x0 = Math.round(xc - w / 2);
  V.box(x0, y0, z - 1, x0 + w, y0 + h, z, bg); rows.forEach((r, k) => txt(V, r, x0 + ((w - tw(r)) >> 1), y0 + h - 3 - k * 9, z, fg)); return [x0, x0 + w, y0 + h]; }

// ── a pop-up canopy: four legs, a peaked roof in one bold colour (or striped), a table (or two), the board standing on the valance
export const canopyStall = (o) => M('stall' + JSON.stringify(o), 'stall', () => {
  const W = 56, D = 56, H = 46, V = P(W + 4, H + 36, D + 6), c = o.c, x0 = 2, z0 = 2, x1 = x0 + W, z1 = z0 + D;
  for (const [x, z] of [[x0, z0], [x1 - 2, z0], [x0, z1 - 2], [x1 - 2, z1 - 2]]) V.box(x, 0, z, x + 2, H, z + 2, GALV, 2);
  for (let k = 0; k < 8; k++) V.box(x0 + k * 3, H + k, z0 + k * 3, x1 - k * 3, H + k + 1, z1 - k * 3, (x) => o.stripe && (((x - x0) >> 3) & 1) ? WHITE : (k === 0 ? shade(c, .85) : c));
  V.box(x0, H - 5, z1 - 1, x1, H, z1, c);                                                                  // the front valance
  card(V, (x0 + x1) / 2, H, z1, o.sign, o.bg ?? WHITE, o.fg ?? INK);                                         // the board stands on it
  table(V, x0 + 10, z1 - 22, o.goods, o.top); if (o.second) table(V, x0 + 10, z0 + 6, o.second, o.top);
  return done(V, 'stall'); });
// a tarp lean-to: a tarp from two front poles down to the ground behind, a blanket of goods under it, the board on a stake
export const tarpStall = (o) => M('tarp' + JSON.stringify(o), 'stall', () => {
  const W = 60, D = 50, V = P(W + 4, 50, D + 8), x0 = 2, x1 = x0 + W, z1 = D + 2, t = o.c ?? TARP;
  for (const x of [x0, x1 - 2]) V.box(x, 0, z1 - 2, x + 2, 44, z1, WDD);
  for (let z = 2; z < z1; z++) { const y = Math.round((z - 2) * 43 / (z1 - 2)); V.box(x0, y, z, x1, y + 1, z + 1, (x, yy, zz) => hash(x >> 3, zz >> 3, 5) > .9 ? shade(t, .82) : t); }
  V.box(x0 + 4, 0, z1 - 24, x1 - 4, 1, z1 - 4, o.rug ?? 0xe8232a); V.box(x0 + 6, 0, z1 - 22, x1 - 6, 1, z1 - 6, (x, y, z) => ((x + z) & 7) ? undefined : 0xffe23a);
  GOODS[o.goods](V, x0 + 6, x1 - 6, 1, z1 - 22, z1 - 6);
  V.box(x1 - 10, 0, z1 + 2, x1 - 8, 22, z1 + 3, WDD); card(V, x1 - 9, 22, z1 + 4, o.sign, o.bg ?? WHITE, o.fg ?? INK); V.box(x1 - 10, 22, z1 + 3, x1 - 8, 24, z1 + 4, WDD);
  return done(V, 'stall'); });
// rims and tyres on the ground with their board on a stake
export const rimStall = (sign) => M('rims' + sign, 'stall', () => { const V = P(64, 34, 28);
  for (const [x, z, n] of [[10, 12, 3], [26, 12, 2], [42, 12, 4]]) for (let k = 0; k < n; k++) { cyl(V, x, z, 7.2, k * 4, k * 4 + 4, (xx, yy, zz) => Math.hypot(xx + .5 - x, zz + .5 - z) < 3.6 ? undefined : 0x1b1b20); ring(V, x, z, 3.6, 5.2, k * 4 + 2, k * 4 + 4, 0xdfe3ea, 2); }
  V.box(55, 0, 21, 57, 20, 22, WDD); card(V, 56, 20, 23, sign, 0xffe23a, INK); V.box(55, 19, 22, 57, 20, 23, WDD); return done(V, 'stall'); });
// three bikes in a row and their board
export const bikeRow = (sign) => M('bikes' + sign, 'stall', () => { const V = P(64, 34, 44);
  [[6, 0xe8232a], [22, 0x2f5bff], [38, 0x25b84c]].forEach(([x, c]) => { for (const z of [8, 30]) for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; V.set(x, 8 + Math.round(Math.sin(t) * 7.2), z + Math.round(Math.cos(t) * 7.2), 0x1b1b20); }
    line(V, x, 8, 8, x, 16, 20, c); line(V, x, 16, 20, x, 8, 30, c); line(V, x, 16, 20, x, 20, 26, c); line(V, x, 8, 8, x, 18, 11, c); V.box(x, 20, 24, x + 1, 21, 30, INK); V.box(x, 18, 9, x + 1, 19, 13, INK); });
  V.box(55, 0, 38, 57, 22, 39, WDD); card(V, 50, 22, 40, sign, WHITE, 0xe8232a); V.box(55, 21, 39, 57, 22, 40, WDD); return done(V, 'stall'); });
// the elote cart: steel, a striped umbrella, its board on the front
export const eloteCart = (sign) => M('elote' + sign, 'cart', () => { const V = P(52, 60, 30);
  V.box(6, 6, 6, 46, 22, 22, 0xdfe3ea, 2); V.box(6, 22, 6, 46, 24, 22, 0xc9ced6, 2); for (const x of [8, 42]) { cyl(V, x, 14, 5, 0, 1, 0x1b1b20); V.box(x - 1, 1, 13, x + 1, 6, 15, 0x1b1b20); } V.box(6, 0, 20, 10, 6, 22, INK);
  V.box(24, 24, 12, 26, 52, 14, 0x9a9ca4, 2); for (let k = 0; k < 6; k++) V.box(4 + k * 3, 52 - k, k * 3, 48 - k * 3, 53 - k, 28 - k * 3, (x) => ((x >> 3) & 1) ? 0x14a83b : WHITE);
  for (let x = 12; x < 24; x += 3) V.box(x, 24, 10, x + 2, 26, 18, 0xffe23a); card(V, 26, 8, 23, sign, 0xe8232a, WHITE);
  return done(V, 'cart'); });
// the hangout: folding chairs round a cooler, a boombox
export const foldChair = c => M('fold' + c, 'chair', () => { const V = P(12, 18, 12); for (const [x, z] of [[0, 0], [11, 0], [0, 11], [11, 11]]) V.box(x, 0, z, x + 1, 9, z + 1, GALV, 2); V.box(0, 9, 0, 12, 10, 12, c); V.box(0, 10, 0, 12, 18, 1, c); return done(V, 'chair'); });
export const boombox = () => M('boom', 'speaker', () => { const V = P(12, 9, 6); V.box(0, 0, 0, 12, 6, 5, INK); for (const x of [3, 9]) cyl(V, x, 5, 1.8, 1, 5, 0x9a9ca4); V.box(2, 6, 2, 10, 7, 3, 0x9a9ca4, 2); for (const x of [2, 9]) V.box(x, 7, 2, x + 1, 9, 3, 0x9a9ca4, 2); V.box(2, 8, 2, 10, 9, 3, 0x9a9ca4, 2); return done(V, 'speaker'); });
