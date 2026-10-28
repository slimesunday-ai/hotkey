// IRON ISLAND + THE LONG BRIDGE (jail) · the shared toolkit (owner: the water-side agent, batch 5). Worker-safe: nothing here touches
// a DOM or a canvas when the module loads (the display face is rastered on first use, in the build workers or the page).
//   wv(ctx, rect, y0, y1, o)   a volume in WORLD metres over the part of rect that lies in this block (o.out: how far past the block's
//                              own square this block alone may draw — the riprap past the island's edge, the T's corner over the water)
//   later / fin               volumes meshed at the end of the block (after the engine's own), as structures the audit sees
//   letters(V, M, face, …)    lettering on a volume face, every voxel recorded with its board (the audit proves it sits on it)
//   props                     gulls, lamps, floodlights, plates, bollards, planters, the flagpole (memoized per variant and time of day)
import { Vol, meshVol, meshed, textMask, rasterMask, stamp, stampA } from '../../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { P0, P, HS, SPREAD, hwX, hwZ, rwX, rwZ, shiftOf } from '../../../../world/city.js';
import { off } from '../frame.js';
import { WALKN, R9 } from './plan.js';
export { Vol, meshVol, meshed, stamp, stampA, textMask, PAL, CV, SIDE, hash, shade, TOD, REG };

// ── SPREAD · THE MAP. These kits author in today's world metres; ctx.map carries them into the spread world (f: today → spread, g: back;
// fx / gx for x, where z picks the regime: today's z for fx, the spread's for gx). The default is the block's frame (rigid: ../frame.js
// off). JAIL_MAP (the jail kit): Iron Island moves rigidly with its compound K; the street strip south of it (the island road, the T and
// Route 9 on the bridge: today's z > WALKN) keeps the city's cross-sections — across a street line the road stretches to the spread's
// half-width, the kerb half of today's 2 m walk keeps to the kerb, the shopfront half to the lot line, past the right-of-way a block's HS
// — and along the island road, Route 9's walk edge (x 233) to x 256 stretches onto the island's x. The HS margin between the island's
// south edge and the island road's lot line maps back onto the edge row, so the forecourt's and the apron's own ground fills it. At SPREAD 0
// every map is the identity and today's arithmetic is untouched (M.id).
const fS = (v, rw, hw) => { const L = Math.round(v / P0), d = v - L * P0, a = Math.abs(d), s = d < 0 ? -1 : 1, H = hw(L), R = rw(L), r0 = R - HS, h0 = r0 - 2;
  return L * P + s * (a <= h0 ? a * H / h0 : a <= h0 + 1 ? H + a - h0 : a <= r0 ? R - (r0 - a) : a + HS); };
const gS = (v, rw, hw) => { const L = Math.round(v / P), d = v - L * P, a = Math.abs(d), s = d < 0 ? -1 : 1, H = hw(L), R = rw(L), r0 = R - HS, h0 = r0 - 2;
  return L * P0 + s * (a <= H ? a * h0 / H : a <= H + 1 ? h0 + a - H : a < R - (r0 - h0 - 1) ? h0 + 1 : a <= R ? r0 - (R - a) : a - HS); };
const ID = { id: true, fx: x => x, fz: z => z, gx: x => x, gz: z => z };
const rigid = ([sx, sz]) => ({ sx, sz, fx: x => x + sx, fz: z => z + sz, gx: x => x - sx, gz: z => z - sz });
export const JAIL_MAP = (() => { if (!SPREAD) return ID; const [KX, KZ] = shiftOf(7, -12), ZE = WALKN + KZ, ZL = fS(WALKN, rwZ, hwZ);
  // along the island road: Route 9's cross-section to its east walk's edge (x 233), then piecewise-linear onto the island's corner (x 256 →
  // the compound's x) and the road's end at the line (x 288 → 9 · P), a block's shift past it
  const xs = [R9.w1, 256, 288], ys = [fS(R9.w1, rwX, hwX), 256 + KX, 9 * P];
  const bf = x => { if (x <= xs[0]) return fS(x, rwX, hwX); for (let k = 1; k < 3; k++) if (x <= xs[k]) return ys[k - 1] + (x - xs[k - 1]) * (ys[k] - ys[k - 1]) / (xs[k] - xs[k - 1]); return x + ys[2] - xs[2]; };
  const bg = x => { if (x <= ys[0]) return gS(x, rwX, hwX); for (let k = 1; k < 3; k++) if (x <= ys[k]) return xs[k - 1] + (x - ys[k - 1]) * (xs[k] - xs[k - 1]) / (ys[k] - ys[k - 1]); return x - ys[2] + xs[2]; };
  const island = rigid([KX, KZ]), street = { fx: bf, fz: z => fS(z, rwZ, hwZ), gx: bg, gz: z => gS(z, rwZ, hwZ) };
  const margin = { fx: island.fx, fz: z => z <= WALKN ? ZE : ZL, gx: island.gx, gz: () => WALKN - .05 };   // (a volume over the margin: the edge row's ground)
  // a volume keeps one regime whole (its middle's): the island's parts stay rigid to their last cell, the street's keep the cross-sections
  return { pick: (zm, o = {}) => o.margin ? margin : zm <= WALKN ? island : street,
    fx: (x, z) => z <= WALKN ? x + KX : bf(x), fz: z => z <= WALKN ? z + KZ : fS(z, rwZ, hwZ), gx: (x, z) => z <= ZL ? x - KX : bg(x), gz: z => z <= ZE ? z - KZ : z <= ZL ? WALKN - .05 : gS(z, rwZ, hwZ) }; })();
export const mapOf = ctx => SPREAD ? ctx.map ??= rigid(off(ctx)) : ID;
export const ISLAND_MAP = SPREAD ? rigid(shiftOf(7, -12)) : ID;   // (the water round Iron Island moves with the island: the sea kit's blocks beside it)
export const mp = (ctx, x, z) => { const M = mapOf(ctx); return M.id ? [x, z] : [M.fx(x, z), M.fz(z)]; };                                   // a point
export const unmp = (ctx, x, z) => { const M = mapOf(ctx); return M.id ? [x, z] : [M.gx(x, z), M.gz(z)]; };                               // a spread-world point → today's
export const mrect = (ctx, r) => { const M = mapOf(ctx); if (M.id) return r; const zm = (r[1] + r[3]) / 2, R = M.pick ? M.pick(zm) : M; return [R.fx(r[0], zm), R.fz(r[1]), R.fx(r[2], zm), R.fz(r[3])]; };
export const mbox = (ctx, b) => { const M = mapOf(ctx); if (M.id) return b; const zm = (b[2] + b[5]) / 2, R = M.pick ? M.pick(zm) : M; return [R.fx(b[0], zm), b[1], R.fz(b[2]), R.fx(b[3], zm), b[4], R.fz(b[5])]; };
export const put = (ctx, bk, x, z, o) => { const M = mapOf(ctx), r = ctx.put(bk, ...mp(ctx, x, z), o); return r && !M.id ? [M.gx(r[0], r[1]), M.gz(r[1])] : r; };   // ctx.put / REG / stamp in today's metres (put → where it went, in today's)
export const keep = (ctx, b, tag) => REG.keep(mbox(ctx, b), tag);
export const doorAt = (ctx, x, z, rot) => REG.door(...mp(ctx, x, z), rot);
export const stampAt = (ctx, bk, rot, x, y, z) => { const [a, b] = mp(ctx, x, z); stamp(bk, ctx.bank, rot, a, y, b); };
export const stampAAt = (ctx, bk, ang, x, y, z) => { const [a, b] = mp(ctx, x, z); stampA(bk, ctx.bank, ang, a, y, b); };

// ── colours: the island is bone and grey concrete (the neutral mass), steel, and a few loud things — the county orange of the
// jumpsuits and the bus stripe, the court, the guard towers' trims, the bridge's green, the lighthouse's red and white
export const C = {
  bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, white: 0xf4f1ea, chalk: 0xf7f7f2, cream: 0xfff0d0,
  conc: 0xcfc9bc, concL: 0xdcd7cb, concD: 0xb3ad9f, pave: 0xc2bcae, paveD: 0xaea898, gravel: 0xb5ae9e, gravelD: 0x9d9686,
  grass: 0x5aa846, grassD: 0x4d9a3c, grassL: 0x6cb957, soil: 0x6f5238,
  asph: 0x5d5e6b, asphD: 0x505160, lineW: 0xf4f3ee, lineY: 0xffc41f, curb: 0xece8df,
  rock: [0x8e9299, 0x7b8088, 0x9ea3aa, 0x6c7079, 0x878a90], wet: 0x4f535c, moss: 0x62795a, lichen: 0xc9c27a, guano: 0xf1f1ec,
  foam: 0xf4f8fb, foam2: 0xdcecf6, sea: 0x2f86d8,
  steel: 0x8a9099, steelL: 0xb9bec6, steelD: 0x4b4f58, ink: 0x17171b, iron: 0x1d1d24, rubber: 0x1f1f26, chrome: 0xdfe6ee,
  glass: PAL.glassLo, glassHi: PAL.glassHi, glint: PAL.glint, litLo: PAL.litLo, litHi: PAL.litHi,
  green: 0x25b84c, greenD: 0x1c8f3b, greenL: 0x3fcf63, yellow: 0xffc21a, hazard: 0xffc21a, red: 0xe8232a, redD: 0xb81a20,
  orange: 0xff7a1a, cobalt: 0x2f5bff, blue: 0x3fa9f5, navy: 0x1b2a55, teal: 0x12b3a0, pink: 0xff4fa3, purple: 0x7a3cff,
  gold: 0xe7bd4a, wood: 0xa4652f, woodD: 0x6e3e19, court: 0x2f5bff, courtKey: 0xff7a1a, mat: 0x2b2d36,
};
export const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const air = (c, t = .3) => mix(c, PAL.horizon, t);          // far tiers: walls lean toward the haze
export const lit = (day = 0) => TOD.night ? 3 : day;               // a light: glows at night (layer 3), day layer otherwise
export const H = (a, b = 0, c = 0) => hash(a | 0, b | 0, c | 0);
export const rockCol = (x, y, z) => C.rock[(H(x * 3 + 7, y * 5 + 1, z * 7 + 3) * C.rock.length) | 0];

// ── props: authored at the base centre, facing +z, memoized per variant and time of day
const MEMO = new Map();
export const memo = (k, f) => { k += '|' + TOD.night; let v = MEMO.get(k); if (!v) MEMO.set(k, v = f()); return v; };
export const pv = (nx, ny, nz, s = CV, cx = nx / 2, cz = nz / 2) => new Vol(nx, ny, nz, { s, org: [-cx * s, 0, -cz * s], ground: true });
export const prop = (V, kind) => { const b = meshed(V); b.kind = kind; return b; };

// ── the world slice: a volume in world metres over rect ∩ (this block's square grown by o.out), snapped to the world grid of its grain
// so two blocks' slices of one part meet cell for cell. → { V, s, X, Y, Z (world → cell), box(world box), set(world point) } or null
export function wv(ctx, rect, y0, y1, o = {}) {
  const M = mapOf(ctx), s = o.s ?? CV, g = o.out ?? 0, bx0 = ctx.i * P0, bz0 = ctx.j * P0;   // (SPREAD: rect and the block's square in today's metres, the volume in the spread world)
  const x0 = Math.max(rect[0], bx0 - g), z0 = Math.max(rect[1], bz0 - g), x1 = Math.min(rect[2], bx0 + P0 + g), z1 = Math.min(rect[3], bz0 + P0 + g);
  if (x1 - x0 < s * .5 || z1 - z0 < s * .5) return null;
  const zm = (z0 + z1) / 2, R = M.id ? M : M.pick ? M.pick(zm, o) : M, fx = M.id ? x => x : x => R.fx(x, zm), fz = R.fz, zs = fz(zm);
  const sn = R.sx !== undefined ? [R.sx, R.sz] : null;   // (a rigid regime snaps in today's grid, then moves: the same cells as today's)
  const X0 = sn ? Math.round(x0 / s) * s + sn[0] : Math.round(fx(x0) / s) * s, Z0 = sn ? Math.round(z0 / s) * s + sn[1] : Math.round(fz(z0) / s) * s, X1 = sn ? Math.round(x1 / s) * s + sn[0] : Math.round(fx(x1) / s) * s, Z1 = sn ? Math.round(z1 / s) * s + sn[1] : Math.round(fz(z1) / s) * s;
  if (X1 - X0 < s * .5 || Z1 - Z0 < s * .5) return null;
  const V = new Vol(Math.round((X1 - X0) / s), Math.max(1, Math.round((y1 - y0) / s)), Math.round((Z1 - Z0) / s), { s, org: [X0, y0, Z0], ground: o.ground ?? true });
  const X = x => Math.round((fx(x) - X0) / s), Y = y => Math.round((y - y0) / s), Z = z => Math.round((fz(z) - Z0) / s);
  return { V, s, X, Y, Z, x0: X0, z0: Z0, x1: X1, z1: Z1, y0, ux0: M.id ? X0 : R.gx(X0, zs), ux1: M.id ? X1 : R.gx(X1, zs), uz0: M.id ? Z0 : R.gz(Z0), uz1: M.id ? Z1 : R.gz(Z1),   // (ux0 … uz1: its bounds in today's metres)
    box: (ax, ay, az, bx, by, bz, c, l) => V.box(X(ax), Y(ay), Z(az), X(bx), Y(by), Z(bz), c, l),
    set: (x, y, z, c, l) => V.set(Math.floor((fx(x) - X0) / s), Math.floor((y - y0) / s), Math.floor((fz(z) - Z0) / s), c, l),
    has: (x, y, z) => V.has(Math.floor((fx(x) - X0) / s), Math.floor((y - y0) / s), Math.floor((fz(z) - Z0) / s)),
    wx: M.id ? i => X0 + (i + .5) * s : i => R.gx(X0 + (i + .5) * s, zs), wy: j => y0 + (j + .5) * s, wz: M.id ? k => Z0 + (k + .5) * s : k => R.gz(Z0 + (k + .5) * s) };
}
// the world rect of this block (+ margin)
export const blockRect = (ctx, m = 0) => [ctx.i * P0 - m, ctx.j * P0 - m, ctx.i * P0 + P0 + m, ctx.j * P0 + P0 + m];   // (SPREAD: today's metres, its frame cell)
export const inBlock = (ctx, x, z) => Math.floor(x / P0) === ctx.i && Math.floor(z / P0) === ctx.j;
export const hitR = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
export const volBox = V => [V.org[0], V.org[1], V.org[2], V.org[0] + V.nx * V.s, V.org[1] + V.ny * V.s, V.org[2] + V.nz * V.s];

// volumes meshed at the block's end (after ctx.finish): o.walk registers a walkable surface (props and people stand on it), o.keep a
// keep-out box (strict props keep clear of it), o.mass a building footprint [x0, z0, x1, z1] with its top (and roofY: people may stand on it)
export function later(ctx, W, o = {}) { if (!W) return null; const V = W.V || W; V._g = REG.blk?.group; (ctx.later ??= []).push(V);
  if (o.walk) REG.surface(V); if (o.keep) REG.keep(o.keep === true ? volBox(V) : mbox(ctx, o.keep), o.tag || 'structure');   // (SPREAD: keep and mass in today's metres)
  if (o.mass) { const [x0, z0, x1, z1] = mrect(ctx, o.mass); V.own = REG.footprint(x0, z0, x1, z1, o.top ?? V.org[1] + V.ny * V.s, o.roofY ?? o.top ?? V.org[1] + V.ny * V.s); }
  return W; }
export function fin(ctx) { ctx.finish(); const g = REG.blk?.group; for (const V of ctx.later || []) { if (V._g) REG.group(V._g); meshVol(V, ctx.bank); } if (g) REG.group(g); if (ctx.later) ctx.later.length = 0; }

// ── lettering. A mask { w, h, at(i, j), s }: textMask (the city's 5×7), mini (3×5), disp (a display face, rastered on first use)
const MASKS = new Map(), mk = (k, f) => { let m = MASKS.get(k); if (!m) MASKS.set(k, m = f()); return m; };
export const px = s => mk('px' + s, () => textMask(s));
const CANVAS = () => typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
const scaled = (M, k) => ({ w: M.w * k, h: M.h * k, at: (i, j) => M.at((i / k) | 0, (j / k) | 0), s: M.s });
export const disp = (s, size = 20, face = 'impact') => mk(`d${face}${size}${s}`, () => CANVAS()
  ? rasterMask(s, face === 'slab' ? `900 ${size}px Rockwell, "Rockwell Extra Bold", "Courier New", serif` : `900 ${size}px Impact, "Arial Black", sans-serif`)
  : scaled(textMask(s), Math.max(1, Math.round(size / 9))));
const G35 = { A: '.X.X.XXXXX.XX.X', B: 'XX.X.XXX.X.XXX.', C: '.XXX..X..X...XX', D: 'XX.X.XX.XX.XXX.', E: 'XXXX..XX.X..XXX', F: 'XXXX..XX.X..X..', G: '.XXX..X.XX.X.XX', H: 'X.XX.XXXXX.XX.X',
  I: 'XXX.X..X..X.XXX', J: '..X..X..XX.X.X.', K: 'X.XX.XXX.X.XX.X', L: 'X..X..X..X..XXX', M: 'X.XXXXXXXX.XX.X', N: 'XXXX.XX.XX.XX.X', O: '.X.X.XX.XX.X.X.', P: 'XX.X.XXX.X..X..', Q: '.X.X.XX.XXX..XX',
  R: 'XX.X.XXX.X.XX.X', S: '.XXX...X...XXX.', T: 'XXX.X..X..X..X.', U: 'X.XX.XX.XX.XXXX', V: 'X.XX.XX.XX.X.X.', W: 'X.XX.XXXXXXXX.X', X: 'X.XX.X.X.X.XX.X', Y: 'X.XX.X.X..X..X.', Z: 'XXX..X.X.X..XXX',
  0: 'XXXX.XX.XX.XXXX', 1: '.X.XX..X..X.XXX', 2: 'XX...X.X.X..XXX', 3: 'XX...X.X...XXX.', 4: 'X.XX.XXXX..X..X', 5: 'XXXX..XX...XXX.', 6: '.XXX..XXXX.XXXX', 7: 'XXX..X.X..X..X.', 8: 'XXXX.XXXXX.XXXX', 9: 'XXXX.XXXX..XXX.',
  ' ': '...............', '-': '......XXX......', '/': '..X..X.X.X..X..', '+': '....X.XXX.X....', "'": '.X..X..........', '.': '............X..', ':': '....X.....X....', '·': '.......X.......' };
export const mini = s => mk('mn' + s, () => { const cols = []; for (const ch of String(s).toUpperCase()) { if (cols.length) cols.push(null); const g = G35[ch] ?? G35[' ']; for (let x = 0; x < 3; x++) cols.push([0, 1, 2, 3, 4].map(r => g[r * 3 + x] === 'X')); }
  return { w: cols.length, h: 5, at: (i, j) => !!cols[i] && cols[i][j], s }; });
// the four faces: (u, v) on the face → volume cell; u runs left → right as the viewer reads it, v up; d = the depth cell of the letters
const FACES = {
  '+z': (V, u, d) => [u, d, [0, -1], [0, 1]], '-z': (V, u, d) => [V.nx - 1 - u, d, [0, 1], [0, -1]],
  '+x': (V, u, d) => [d, V.nz - 1 - u, [-1, 0], [1, 0]], '-x': (V, u, d) => [d, u, [1, 0], [-1, 0]] };
// draw mask M on face `face` of V: its top-left letter pixel at (u0, ytop) in face coordinates (u counted from the face's left edge as
// the viewer sees it), letters in the cell layer `d` (for ±z faces a z index, for ±x an x index); sc: integer scale. → width in cells
export function letters(V, M, face, u0, ytop, d, col, o = {}) {
  const sc = o.sc ?? 1, l = o.l ?? 0, f = FACES[face]; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const [x, z, bk, fr] = f(V, u0 + i * sc + a, d), y = ytop - j * sc - b, c = typeof col === 'function' ? col(i, j) : col;
      if (face[1] === 'z') { V.set(x, y, d, c, l); V.rec(M.s ?? 'text', x, y, d, x, d + bk[1], x, d + fr[1]); }
      else { V.set(d, y, z, c, l); V.rec(M.s ?? 'text', d, y, z, d + bk[0], z, d + fr[0], z); } } }
  return M.w * sc;
}
// a board with lettering centred on it, on a face of V: board cells [u0, u1) × [y0, y1) at depth db (the letters one cell out, d = db ± 1)
export function board(V, face, u0, u1, y0, y1, db, bg, M, fg, o = {}) {
  const out = face === '+z' || face === '+x' ? 1 : -1, f = FACES[face], sc = o.sc ?? 1, l = o.l ?? 0;
  for (let u = u0; u < u1; u++) for (let y = y0; y < y1; y++) { const [x, z] = f(V, u, db); if (face[1] === 'z') V.set(x, y, db, bg, o.bl ?? 0); else V.set(db, y, z, bg, o.bl ?? 0); }
  if (!M) return; const w = M.w * sc, h = M.h * sc, ua = u0 + Math.round((u1 - u0 - w) / 2), yt = y0 + Math.round((y1 - y0 + h) / 2) - 1;
  letters(V, M, face, ua, yt, db + out, fg, { sc, l });
}
// the same in world terms on a world slice W: a0…a1 along the face, y0…y1 up, `plane` = the world coordinate of the face the board is
// painted on (its cells just inside the plane, the letters one cell outside it: the volume must reach past the plane)
export function wboard(W, face, a0, a1, y0, y1, plane, bg, M, fg, o = {}) {
  const V = W.V, zf = face[1] === 'z', pos = face[0] === '+', db = zf ? (pos ? W.Z(plane) - 1 : W.Z(plane)) : (pos ? W.X(plane) - 1 : W.X(plane));
  const [u0, u1] = face === '+z' ? [W.X(a0), W.X(a1)] : face === '-z' ? [V.nx - W.X(a1), V.nx - W.X(a0)] : face === '+x' ? [V.nz - W.Z(a1), V.nz - W.Z(a0)] : [W.Z(a0), W.Z(a1)];
  board(V, face, u0, u1, W.Y(y0), W.Y(y1), db, bg, M, fg, o);
}
// lettering only (no board: the wall it is painted on is the board), world terms as wboard
export function wletters(W, face, a0, a1, ytop, plane, M, fg, o = {}) {
  const V = W.V, zf = face[1] === 'z', pos = face[0] === '+', d = zf ? (pos ? W.Z(plane) : W.Z(plane) - 1) : (pos ? W.X(plane) : W.X(plane) - 1), sc = o.sc ?? 1;
  const [u0, u1] = face === '+z' ? [W.X(a0), W.X(a1)] : face === '-z' ? [V.nx - W.X(a1), V.nx - W.X(a0)] : face === '+x' ? [V.nz - W.Z(a1), V.nz - W.Z(a0)] : [W.Z(a0), W.Z(a1)];
  return letters(V, M, face, u0 + Math.round((u1 - u0 - M.w * sc) / 2), W.Y(ytop), d, fg, o);
}
// a sign board of its own at 0.1 m on a coarser wall: a thin volume just outside `plane` (the board one cell, the letters one cell proud),
// a0…a1 along the face, y0…y1 up (the pixel face is 0.1 m a pixel here, however coarse the wall behind it)
export function signOn(ctx, face, a0, a1, y0, y1, plane, bg, M, fg, o = {}) {
  const pos = face[0] === '+', zf = face[1] === 'z', d0 = pos ? plane : plane - .2, d1 = pos ? plane + .2 : plane;
  const W = wv(ctx, zf ? [a0, d0, a1, d1] : [d0, a0, d1, a1], y0, y1, { s: CV, out: o.out ?? 0 }); if (!W) return null;
  wboard(W, face, a0, a1, y0, y1, pos ? plane + .1 : plane - .1, bg, M, fg, { l: o.l, bl: o.bl }); later(ctx, W); return W;
}
// a small panel at 0.05 m (notices, terms, hours): its own volume just proud of the wall at `plane` (the board, then the letters one cell
// out), lines of the 3×5 face centred on it, one colour each; a0…a1 along the face, y0…y1 up
export function panel(ctx, face, a0, a1, y0, y1, plane, bg, lines, o = {}) {
  const s = .05, pos = face[0] === '+', zf = face[1] === 'z', d0 = pos ? plane : plane - .1, d1 = pos ? plane + .1 : plane;
  const W = wv(ctx, zf ? [a0, d0, a1, d1] : [d0, a0, d1, a1], y0, y1, { s, out: o.out ?? 0 }); if (!W) return null; const V = W.V, n = zf ? V.nx : V.nz;
  const db = pos ? 0 : (zf ? V.nz : V.nx) - 1, out = pos ? 1 : -1;
  board(V, face, 0, n, 0, V.ny, db, bg, null, 0, { bl: o.bl });
  lines.forEach(([t, c], k) => { const M = mini(t); letters(V, M, face, Math.round((n - M.w) / 2), V.ny - 3 - k * 7, db + out, c, { l: o.l }); });
  later(ctx, W); return W;
}
// a sign logged once for the audit's repeat check (by the block holding its centre)
export function logSign(ctx, key, x, z, r = 96) { if (!inBlock(ctx, x, z)) return; const b = REG.blk; if (!b || !key) return; [x, z] = mp(ctx, x, z);
  (b.signs ??= []).push({ fam: 'kit', key: String(key), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r, group: b.group }); }

// ── props
// a herring gull: white head and belly, grey mantle, black wing tips, a yellow bill; perched (standing) or in flight (wings out)
export const gull = (v = 0, fly = false) => memo(`gull${v}${fly}`, () => { const W = 0xf5f6f4, G = [0xb4bcc6, 0x9ea8b4, 0xc2c8cf][v % 3];
  if (fly) {   // in flight, the gull's M: the inner wings rise to the wrist, the outer wings droop to their black tips (1.7 m across)
    const cx = 8, V = pv(17, 6, 8, CV), prof = [0, 1, 2, 2, 1, 1, 0], chord = [4, 4, 3, 3, 3, 2, 2];
    V.box(cx - 1, 1, 1, cx + 2, 3, 7, W); V.box(cx - 1, 2, 7, cx + 2, 3, 8, W); V.box(cx, 2, 0, cx + 1, 3, 1, 0xffc21a);   // the body and tail, the bill
    // each wing two cells thick: white underneath, grey on top (from the ground a gull is a white bird with black tips), the tips black
    for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) { const x = sd < 0 ? cx - 2 - k : cx + 2 + k, y = 1 + prof[k], z1 = 2 + chord[k]; V.box(x, y, 2, x + 1, y + 1, z1, k >= 5 ? C.ink : W); V.box(x, y + 1, 2, x + 1, y + 2, z1, k >= 5 ? C.ink : G); }
    return prop(V, 'gull'); }
  const V = pv(5, 5, 7, CV);
  V.box(1, 0, 3, 2, 1, 4, 0xe9a23b); V.box(3, 0, 3, 4, 1, 4, 0xe9a23b); V.box(1, 1, 1, 4, 3, 6, W); V.box(1, 2, 3, 4, 3, 6, G); V.box(1, 2, 6, 4, 3, 7, C.ink); V.box(2, 3, 1, 3, 5, 3, W); V.box(2, 4, 0, 3, 5, 1, 0xffc21a); V.set(1, 4, 2, C.ink); V.set(3, 4, 2, C.ink);
  return prop(V, 'gull'); });
// a steel lamp post for the bridge and the quay: square green pole, an arm, a box lantern that glows at night (1.9 m reach)
export const bridgeLamp = (col = C.greenD) => memo('blamp' + col, () => { const V = pv(24, 60, 6, CV, 3, 3); V.box(1, 0, 1, 5, 3, 5, col); V.box(2, 3, 2, 4, 54, 4, col);
  V.box(2, 52, 2, 22, 54, 4, col); V.box(3, 50, 2, 6, 52, 4, col); V.box(17, 49, 1, 23, 52, 5, C.ink); V.box(18, 48, 1, 22, 49, 5, TOD.night ? C.litHi : 0xf2eedd, lit(1)); return prop(V, 'lamp-post'); });
// a floodlight mast (yard, apron): a grey pole, a bar of four heads; lit at night
export const floodMast = (h = 72) => memo('flood' + h, () => { const V = pv(16, h + 6, 8, CV, 8, 4); V.box(6, 0, 2, 10, 2, 6, C.steelD); V.box(7, 2, 3, 9, h, 5, C.steel);
  V.box(1, h, 3, 15, h + 1, 5, C.steelD); for (const x of [1, 5, 9, 12]) { V.box(x, h + 1, 2, x + 3, h + 5, 6, C.steelD); V.box(x, h + 1, 6, x + 3, h + 4, 7, TOD.night ? C.litHi : 0xe9eef2, lit(1)); } return prop(V, 'floodlight'); });
export const bollard = (c = C.hazard) => memo('bol' + c, () => { const V = pv(4, 10, 4); V.box(0, 0, 0, 4, 10, 4, (x, y) => y > 7 ? C.ink : c); return prop(V, 'bollard'); });
// a plate on two posts: lines of the 3×5 face on a board (regulatory and site plates); kind 'sign' (mounted: never "floating")
export const plate = (lines, bg = C.chalk, fg = C.ink, o = {}) => memo('plate' + lines.join('|') + bg + fg + (o.post ?? 12) + (o.s ?? CV), () => {
  const s = o.s ?? CV, k = Math.round(CV / s), Ms = lines.map(t => mini(t)), w = Math.max(...Ms.map(M => M.w)) + 4, hh = Ms.length * 6 + 3, post = Math.round((o.post ?? 12) * k), V = pv(w, post + hh, 3, s, w / 2, 1.5);
  for (const x of [1, w - 2]) V.box(x, 0, 1, x + 1, post, 2, C.steelD);
  V.box(0, post, 1, w, post + hh, 2, bg); Ms.forEach((M, n) => letters(V, M, '+z', Math.round((w - M.w) / 2), post + hh - 3 - n * 6, 2, fg));
  return prop(V, 'sign'); });
export const planter = (seed = 0) => memo('plnt' + seed, () => { const V = pv(12, 9, 12); V.box(0, 0, 0, 12, 5, 12, C.concL); V.box(1, 5, 1, 11, 6, 11, C.soil);
  for (let x = 1; x < 11; x++) for (let z = 1; z < 11; z++) { const h = H(x, z, seed); if (h > .45) V.box(x, 6, z, x + 1, 6 + ((h * 3) | 0), z + 1, h > .8 ? 0x3d8a34 : C.grass); } return prop(V, 'planter'); });
// the flagpole with a flag hanging (no wind in the bay today): city blue with a white disc
export const flagpole = () => memo('flag', () => { const V = pv(12, 92, 4, CV, 1, 2); V.box(0, 0, 1, 2, 90, 3, C.steelL); V.box(0, 90, 1, 2, 92, 3, C.gold);
  V.box(2, 66, 1, 11, 88, 2, C.cobalt); V.box(5, 74, 1, 8, 80, 2, C.chalk); V.box(2, 66, 2, 11, 88, 3, C.cobalt); V.box(5, 74, 2, 8, 80, 3, C.chalk); return prop(V, 'flagpole'); });
// a camera on a short pole (the island watches everything)
export const camPole = () => memo('cam', () => { const V = pv(6, 34, 8, CV, 3, 3); V.box(2, 0, 2, 4, 30, 4, C.steelD); V.box(1, 29, 1, 5, 33, 8, C.chalk); V.box(2, 30, 7, 4, 32, 8, C.ink); V.set(2, 33, 2, 0xff2a2a, lit(1)); return prop(V, 'camera'); });
// a bus-stop pole with its flag (0.05 m): the flag faces +z (along the curb, toward the oncoming bus, the way the city's stop poles
// stand), BUS on the blue, the route in its red bullet, the stop's name under it in the 3×5 face; the flag reaches out over the
// sidewalk (+x) from 2.35 m up, the pole stands at the base centre
export const stopFlag = (route, name) => memo('stopflag' + route + name.join('|'), () => {
  const N = TOD.night, s = .05, FW = 26, FH = 37, y0 = 47, V = pv(FW + 3, y0 + FH + 3, 3, s, 1, 1.5), BLUE = 0x2f5bff, l = N ? 3 : 0;
  V.box(0, 0, 0, 2, y0 + FH + 2, 3, 0x1f5c4a); V.box(0, y0 + FH + 2, 0, 2, y0 + FH + 3, 3, C.ink);             // the pole, its cap
  V.box(0, 0, 0, 3, 2, 3, 0x1f5c4a);                                                                        // its foot
  const X0 = 3; V.box(X0 - 1, y0, 1, X0 + FW, y0 + FH, 2, BLUE);                                             // the flag (from the pole out)
  V.box(X0 - 1, y0 + FH - 1, 1, X0 + FW, y0 + FH, 2, C.chalk); V.box(X0 - 1, y0, 1, X0 + FW, y0 + 1, 2, C.chalk);   // white rules top and bottom
  const cx = X0 + (FW >> 1), put = (M, ytop, col, o = {}) => letters(V, M, '+z', cx - (M.w >> 1), ytop, 2, col, { l, ...o });
  let y = y0 + FH - 3; put(px('BUS'), y, C.chalk); y -= 9;
  const R = px(route), bw = R.w + 6; V.box(cx - (bw >> 1), y - 10, 1, cx - (bw >> 1) + bw, y + 1, 2, 0xe8232a); put(R, y - 2, C.chalk); y -= 14;   // the route bullet
  for (const t of name) { put(mini(t), y, C.chalk); y -= 6; }
  return prop(V, 'sign'); });
export const bench = (col = C.slate) => memo('bench' + col, () => { const V = pv(18, 8, 6); V.box(0, 4, 0, 18, 5, 5, col); V.box(0, 5, 5, 18, 8, 6, col); for (const x of [1, 15]) V.box(x, 0, 1, x + 2, 4, 5, C.iron); return prop(V, 'bench'); });
export const bin = (c = 0x2f7a3a) => memo('bin' + c, () => { const V = pv(6, 9, 6); V.box(0, 0, 0, 6, 8, 6, c); V.box(0, 8, 0, 6, 9, 6, shade(c, .7)); V.box(1, 7, 1, 5, 8, 5, C.ink); return prop(V, 'bin'); });
// people: A.life entries (castspec.js), hand-placed, looks from their seeds (see heroes/jail-*.js for the seeds that dress the county orange)
export const person = (ctx, x, y, z, ry, act, seed, extra = {}) => { if (inBlock(ctx, x, z)) { const [wx, wz] = mp(ctx, x, z); ctx.A.life.push({ x: wx, y, z: wz, ry, act, seed, hand: true, ...extra }); } };
