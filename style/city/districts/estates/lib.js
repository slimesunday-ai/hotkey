// GATEHILL · the shared toolkit of the estates kit (owner: the Gatehill agent). Palette, pure hashing, lettering (the 5×7 pixel face and
// two display faces), prop volumes, the sign log and small geometry helpers. Worker-safe: no three, no DOM at module level.
import { Vol, meshed, textMask, rasterMask } from '../../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { logSign as logShared } from '../../signage/alloc.js';
export { PAL, CV, SIDE, hash, shade, TOD, REG };

// ── palette: the Springfield walls (one per tower), the neutral mix, and the uptown materials (stone, brass, glass, green copper)
export const C = {
  yellow: 0xffc21a, red: 0xef4a2a, pink: 0xff4fa3, violet: 0x7a3cff, orange: 0xff7a1a, green: 0x25b84c, sky: 0x3fa9f5, blue: 0x2f5bff,
  teal: 0x12b3a0, purple: 0x8c52ff, rasp: 0xe83b5b, tang: 0xff8a1f,
  white: 0xf4f1ea, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, brick: 0x9b4f3a, buff: 0xc49a6c,
  ink: 0x17171b, iron: 0x1d1d24, cream: 0xfff0d0, chalk: 0xf7f7f2,
  gold: 0xe7bd4a, goldD: 0xb8902e, goldL: 0xffe08a, brass: 0xd9a93a, bronze: 0x8a5a2e, copper: 0x2fa58c, copperD: 0x1f7f6b,
  glassLo: 0x1b2a55, glassHi: 0x3f6bc4, glint: 0xeaf6ff, litLo: 0xffc766, litHi: 0xffe3a0, dark: 0x1b2240,
  stone: 0xd9d2c3, stoneD: 0xc4bcaa, pave: 0xe4ddd0, paveJ: 0xcfc7b8, asph: 0x4d4e5a, asphL: 0x5d5e6b, grass: 0x46c046, grassD: 0x3aad3a,
  leaf: 0x25a748, leafD: 0x1d8f3c, leafL: 0x2fbf55, trunk: 0x7a4a22, carpet: 0xc4122f, carpetD: 0x9a0e24, water: 0x2fc4ff, waterD: 0x1f8fd8, clay: 0xd9643a,
};
export const NEUTRALS = [C.white, C.bone, C.pale, C.grey, C.slate, C.brick, C.buff];
export const isNeutral = c => NEUTRALS.includes(c);
const LIGHT = new Set([C.yellow, C.white, C.bone, C.pale, C.chalk, C.cream, C.buff, C.gold, C.goldL, C.brass, C.sky, C.stone, C.pave, 0xffe23a, 0x6cff4a, 0x2de2e6, 0xffffff]);
export const inkOn = c => LIGHT.has(c) ? C.ink : C.chalk;
export const lit = () => TOD.night ? 3 : 0;
export const litOr = l => TOD.night ? 3 : l;
// aerial perspective for far tiers (STYLE §9): walls lean 30 % toward the horizon colour
export const air = (c, t = .3) => { const h = PAL.horizon, m = k => Math.round(((c >> k) & 255) * (1 - t) + ((h >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const mix = (a, b, t) => { const m = k => Math.round(((a >> k) & 255) * (1 - t) + ((b >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };

// ── seeded helpers (pure: the full build and the far tier see the same numbers)
export const H = (a, b = 0, c = 0) => hash(a | 0, b | 0, c | 0);
export const pickH = (arr, a, b = 0, c = 0) => arr[(H(a, b, c) * arr.length) | 0];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const r2 = v => Math.round(v * 100) / 100;

// ── props: authored at the base centre facing +z, memoized per argument set and time of day (props.js conventions)
const MEMO = new Map();
export const memo = (k, f) => { k += '|' + TOD.night; let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
export const pv = (nx, ny, nz, s = CV, cx = nx / 2, cz = nz / 2) => new Vol(nx, ny, nz, { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind) => { const b = meshed(V); b.kind = kind; return b; };
export const cyl = (V, cx, cz, r, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++)
  if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };

// ── lettering: masks { w, h, at(i, j), s } — the 5×7 pixel face (the house style) and, for heroes, a didone serif and a heavy grotesk
const MASKS = new Map(), cache = (k, f) => { let m = MASKS.get(k); if (!m) MASKS.set(k, m = f()); return m; };
export const px = s => cache('px' + s, () => textMask(s));
const CANVAS = typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
const scaled = (M, k) => ({ w: M.w * k, h: M.h * k, at: (i, j) => M.at((i / k) | 0, (j / k) | 0), s: M.s });
const raster = (s, font, h) => CANVAS ? rasterMask(s, font) : scaled(textMask(s), Math.max(1, Math.round(h / 9)));
export const didone = (s, h = 18) => cache('dd' + s + h, () => raster(s, `bold ${h}px Didot, "Bodoni 72", "Bodoni MT", Georgia, serif`, h));
export const grotesk = (s, h = 18) => cache('gr' + s + h, () => raster(s, `900 ${h}px "Helvetica Neue", Helvetica, Arial, sans-serif`, h));
// a mask on a kit frame (a along the wall, y up, d out): centred on a, top row at ytop, letters d0…d1−1 over their board
export function ftext(f, M, a, ytop, o = {}) { const sc = o.sc ?? 1, W = M.w * sc, a0 = o.align === 0 ? a : Math.round(a - W / 2); f.mask(M, a0, ytop, o.d0 ?? 0, o.d1 ?? 1, o.c ?? C.chalk, o.l ?? 0, sc); return { a0, a1: a0 + W, w: W, h: M.h * sc }; }
// on a Vol plane z (dir +1: faces +z, board at z − 1; −1 faces −z, mirrored) and on an x plane; every voxel recorded for the audit
export function vtext(V, M, x0, ytop, z, col, o = {}) { const sc = o.sc ?? 1, l = o.l ?? 0, dir = o.dir ?? 1, W = M.w * sc; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const xi = i * sc + u, x = dir > 0 ? x0 + xi : x0 + W - 1 - xi, y = ytop - j * sc - v; V.set(x, y, z, typeof col === 'function' ? col(i, j) : col, l); V.rec(M.s, x, y, z, x, z - dir, x, z + dir); } }
  return W; }
export function vtextX(V, M, z0, ytop, x, col, o = {}) { const sc = o.sc ?? 1, l = o.l ?? 0, dir = o.dir ?? 1, W = M.w * sc; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const zi = i * sc + u, z = dir > 0 ? z0 + W - 1 - zi : z0 + zi, y = ytop - j * sc - v; V.set(x, y, z, typeof col === 'function' ? col(i, j) : col, l); V.rec(M.s, x, y, z, x - dir, z, x + dir, z); } }
  return W; }
// lettering flat on a roof (reads from the overhead camera, top toward −z): on the Vol layer y
export function vtextUp(V, M, x0, z0, y, col, o = {}) { const sc = o.sc ?? 1, l = o.l ?? 0; for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
  for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) V.set(x0 + i * sc + u, y, z0 + j * sc + v, typeof col === 'function' ? col(i, j) : col, l); } return M.w * sc; }

// ── the sign log (tools/audit.mjs sign-repeat): a Gatehill name is logged with the block's current group, so a tower's name on its
// two lobbies counts once (same block, same group) and a name anywhere else in 96 m counts as a repeat
export function logSign(key, x, z, o = {}) { if (!key) return; logShared('name', String(key), x, z, { r: o.r ?? 96, own: 'kit', where: o.where || 'estates' }); }

// ── geometry: faces, quarter turns, world ↔ frame
export const FACE_ROT = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 };
export const FACE_N = { '+z': [0, 1], '+x': [1, 0], '-z': [0, -1], '-x': [-1, 0] };
export const RY = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
// world (x, z) of a frame position (a, d in the frame's voxels): the voxel centre
export const fw = (f, a, d = 0) => { const [x, z] = f.xz(a, d), V = f.V; return [V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s]; };
// the wall plane of a frame (the outer face of its d = 0 layer): its world coordinate across the wall
export const planeOf = f => { const V = f.V, [x, z] = f.xz(0, 0); return f.side === '-z' ? V.org[2] + z * V.s : f.side === '+z' ? V.org[2] + (z + 1) * V.s : f.side === '-x' ? V.org[0] + x * V.s : V.org[0] + (x + 1) * V.s; };
// a window rect for the sim-state layer: centre on the wall plane, 0.02 m out, [x, y, z, w, h, rot]
export function winAnchor(f, a0, a1, y0, y1) { const V = f.V, s = V.s, [n0, n1] = FACE_N[f.side], [x, z] = fw(f, (a0 + a1 - 1) / 2), p = planeOf(f), w = (a1 - a0) * s, h = (y1 - y0) * s, y = V.org[1] + (y0 + y1) / 2 * s;
  return f.side[1] === 'z' ? [r2(x), r2(y), r2(p + n1 * .02), r2(w), r2(h), FACE_ROT[f.side]] : [r2(p + n0 * .02), r2(y), r2(z), r2(w), r2(h), FACE_ROT[f.side]]; }
// voxel index of a world coordinate in a Vol (x or z axis)
export const vxOf = (V, x) => Math.round((x - V.org[0]) / V.s), vzOf = (V, z) => Math.round((z - V.org[2]) / V.s), vyOf = (V, y) => Math.round((y - V.org[1]) / V.s);
