// ST. MERCY (hospital) + ROUTE 9 · MOTEL 9 (highway) · the shared toolkit of the two kits. Owner: the St. Mercy / Route 9 agent.
// Palette, lettering (the 5×7 face, display rasters, neon tubes), prop helpers and the WORLD SLICE: St. Mercy is a compound of four
// blocks and its tower stands on the corner where they meet, so a building is authored once in world metres and every block draws
// only its own slice of it (the voxel grid is the world's; every slice origin sits on a 1 m grid, so the far tier's 0.5 m and the
// shaft's 1.0 m cells meet across the block lines too). Worker-safe (no three, no DOM at module level).
import { Vol, meshed, meshVol, textMask, rasterMask, tempBank, stamp } from '../../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { TOD, frame, AIR } from '../../kit.js';
import { REG } from '../../audit.js';
// SPREAD · THE FRAME (../frame.js): both kits author in today's world metres, the frame of the block that builds them (St. Mercy's four
// blocks: the compound's). The world slice and the helpers below take frame metres and hand the engine spread-world ones (a slice's voxel
// origin, the registry's boxes, a sign's log, a door); a block's slice is its frame cell. A direct engine call goes through at / atR /
// atB / life; a thing in the street band keeps to its kerb (kerbX / kerbZ).
import { P0 } from '../../../../world/city.js';
import { off, at, atR, atB, life, kerbX, kerbZ } from '../frame.js';
export { off, at, atR, atB, life, kerbX, kerbZ };
export { PAL, CV, SIDE, hash, shade, TOD, REG, AIR, frame };

// ── palette: the Springfield walls, the neutral mix, signs, and the working colours of a hospital and a highway
export const C = {
  white: 0xf4f1ea, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, brick: 0x9b4f3a, buff: 0xc49a6c,
  yellow: 0xffc21a, red: 0xef4a2a, pink: 0xff4fa3, violet: 0x7a3cff, orange: 0xff7a1a, green: 0x25b84c, sky: 0x3fa9f5, cobalt: 0x2f5bff,
  teal: 0x12b3a0, purple: 0x8c52ff, rose: 0xe83b5b, tang: 0xff8a1f,
  sRed: 0xe8232a, sGreen: 0x14a83b, sYellow: 0xffe23a, lime: 0x6cff4a, cyan: 0x2de2e6,
  ink: 0x17171b, iron: 0x1d1d24, chalk: 0xf7f7f2, cream: 0xfff0d0, gold: 0xe7bd4a,
  steel: 0x8a9099, steelL: 0xb9bec6, steelD: 0x4b4f58, chrome: 0xdfe6ee, rubber: 0x1f1f26,
  asph: 0x55566a, asphL: 0x62637a, conc: 0xc9c3b6, concL: 0xdcd6ca, concD: 0xa9a397, grass: 0x5aa846, grassD: 0x4a9a3a, soil: 0x6f5238,
  glass: 0x1b2a55, glassHi: 0x3f6bc4, teal2: 0x2a8f9a, lit: 0xffe3a0, litLo: 0xffc766, wood: 0xa4652f, woodD: 0x6e3e19,
};
export const lit = (day = 0) => TOD.night ? 3 : day;
export const LIGHT = new Set([C.yellow, C.sYellow, C.white, C.bone, C.pale, C.chalk, C.cream, C.lime, C.cyan, C.sky, C.tang, C.orange, C.buff, C.steelL, C.concL, C.conc, C.chrome]);
export const inkOn = c => LIGHT.has(c) ? C.ink : C.chalk;
export const H = (a, b = 0, c = 0) => hash(a | 0, b | 0, c | 0);
export const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };

// ── props: authored in voxels at the base centre facing +z, memoized per argument set and time of day
const MEMO = new Map();
export const memo = (k, f) => { k += '|' + TOD.night; let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
export const pv = (nx, ny, nz, s = CV, cx = nx / 2, cz = nz / 2) => new Vol(nx, ny, nz, { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind) => { const b = meshed(V); b.kind = kind; return b; };
export const cyl = (V, cx, cz, r, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };
export const cylX = (V, x0, x1, cy, cz, r, c, l = 0) => { for (let x = x0; x < x1; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) if (Math.hypot(y + .5 - cy, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };
export const cylZ = (V, z0, z1, cx, cy, r, c, l = 0) => { for (let z = z0; z < z1; z++) for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if (Math.hypot(y + .5 - cy, x + .5 - cx) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };

// ── lettering. Every face returns a mask { w, h, at(i, j), s }.
const MASKS = new Map(), cache = (k, f) => { let m = MASKS.get(k); if (!m) MASKS.set(k, m = f()); return m; };
export const px = s => cache('px' + s, () => textMask(s));
// display faces are canvas rasters (build workers and pages); node tools, which never build, get the pixel face scaled
const CANVAS = typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
const scaled = (M, k) => ({ w: M.w * k, h: M.h * k, at: (i, j) => M.at((i / k) | 0, (j / k) | 0), s: M.s });
const raster = (s, font, size) => CANVAS ? rasterMask(s, font) : scaled(textMask(s), Math.max(1, Math.round(size / 9)));
export const impact = (s, size = 20) => cache('im' + s + size, () => raster(s, `900 ${size}px Impact, "Arial Black", sans-serif`, size));
export const script = (s, size = 24) => cache('sc' + s + size, () => raster(s, `bold italic ${size}px "Brush Script MT", "Snell Roundhand", "Segoe Script", cursive`, size));
export const slab = (s, size = 20) => cache('sb' + s + size, () => raster(s, `900 ${size}px Rockwell, "Rockwell Extra Bold", "Courier New", serif`, size));
// hand-painted: the pixel face with each letter on its own wobble (a card in a window, a plate by the dumpsters)
export const hand = (s, seed = 0) => cache('hd' + s + seed, () => { const M = textMask(s), W = M.w, off = new Int8Array(W); let k = 0, inG = false;
  for (let i = 0; i < W; i++) { let any = false; for (let j = 0; j < 7; j++) if (M.at(i, j)) any = true; if (any && !inG) k++; inG = any; off[i] = any ? (hash(k, seed, 5) < .34 ? -1 : hash(k, seed, 5) > .7 ? 1 : 0) : 0; }
  return { w: W, h: 9, at: (i, j) => { const jj = j - 1 - off[i]; return jj >= 0 && jj < 7 && M.at(i, jj); }, s }; });
// the small face (3×5): plates, window vinyl, a price board's small print — where the 5×7 face would make a sign too big
const G35 = { A: '.X.X.XXXXX.XX.X', B: 'XX.X.XXX.X.XXX.', C: '.XXX..X..X...XX', D: 'XX.X.XX.XX.XXX.', E: 'XXXX..XX.X..XXX', F: 'XXXX..XX.X..X..', G: '.XXX..X.XX.X.XX', H: 'X.XX.XXXXX.XX.X',
  I: 'XXX.X..X..X.XXX', J: '..X..X..XX.X.X.', K: 'X.XX.XXX.X.XX.X', L: 'X..X..X..X..XXX', M: 'X.XXXXXXXX.XX.X', N: 'XXXX.XX.XX.XX.X', O: '.X.X.XX.XX.X.X.', P: 'XX.X.XXX.X..X..', Q: '.X.X.XX.XXX..XX',
  R: 'XX.X.XXX.X.XX.X', S: '.XXX...X...XXX.', T: 'XXX.X..X..X..X.', U: 'X.XX.XX.XX.XXXX', V: 'X.XX.XX.XX.X.X.', W: 'X.XX.XXXXXXXX.X', X: 'X.XX.X.X.X.XX.X', Y: 'X.XX.X.X..X..X.', Z: 'XXX..X.X.X..XXX',
  0: 'XXXX.XX.XX.XXXX', 1: '.X.XX..X..X.XXX', 2: 'XX...X.X.X..XXX', 3: 'XX...X.X...XXX.', 4: 'X.XX.XXXX..X..X', 5: 'XXXX..XX...XXX.', 6: '.XXX..XXXX.XXXX', 7: 'XXX..X.X..X..X.', 8: 'XXXX.XXXXX.XXXX', 9: 'XXXX.XXXX..XXX.',
  ' ': '...............', '-': '......XXX......', '$': '.XXXX..X..XXXX.', '&': '.X.X.X.X.X.X.XX', '/': '..X..X.X.X..X..', '%': 'X....X.X.X....X', '+': '....X.XXX.X....', "'": '.X..X..........', '#': 'X.XXXXX.XXXXX.X' };
// glyphs of their own width (rows top → bottom): the narrow marks, and M, N, W wide enough to tell apart
const G35N = { '.': ['.', '.', '.', '.', 'X'], ':': ['.', 'X', '.', 'X', '.'], '·': ['.', '.', 'X', '.', '.'], '!': ['X', 'X', 'X', '.', 'X'], ',': ['.', '.', '.', 'X', 'X'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'], N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'], W: ['X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'] };
export const mini = (s, sp = 3) => cache('mn' + sp + s, () => { const cols = []; for (const ch of s.toUpperCase()) { if (cols.length) cols.push(null);
    if (ch === ' ') { for (let x = 0; x < sp; x++) cols.push([false, false, false, false, false]); continue; }   // (sp: a narrower word space where a line must fit)
    const g2 = G35N[ch]; if (g2) { for (let x = 0; x < g2[0].length; x++) cols.push(g2.map(r => r[x] === 'X')); }
    else { const g = G35[ch] ?? G35[' ']; for (let x = 0; x < 3; x++) cols.push([0, 1, 2, 3, 4].map(r => g[r * 3 + x] === 'X')); } }
  return { w: cols.length, h: 5, at: (i, j) => !!cols[i] && cols[i][j], s }; });
// the tube of a neon letter: the edge of the glyph (a set pixel with an unset 4-neighbour); `inner` → the glyph without its edge
export const tube = M => cache('tb' + M.s + M.w + 'x' + M.h, () => ({ w: M.w, h: M.h, s: M.s, at: (i, j) => M.at(i, j) && (!M.at(i - 1, j) || !M.at(i + 1, j) || !M.at(i, j - 1) || !M.at(i, j + 1)) }));
export const inner = M => ({ w: M.w, h: M.h, s: M.s, at: (i, j) => M.at(i, j) && M.at(i - 1, j) && M.at(i + 1, j) && M.at(i, j - 1) && M.at(i, j + 1) });
const safe = M => ({ ...M, at: (i, j) => i >= 0 && j >= 0 && i < M.w && j < M.h && M.at(i, j) });
export const tubeOf = M => tube(safe(M)), innerOf = M => inner(safe(M));

// lettering on a Vol plane z (dir +1: faces +z, its board at z − 1; dir −1: faces −z, mirrored so it reads from that side); every
// voxel is recorded, so the audit proves it sits on its board
export function vtext(V, M, x0, ytop, z, col, o = {}) {
  const sc = o.sc ?? 1, l = o.l ?? 0, dir = o.dir ?? 1, W = M.w * sc; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const xi = i * sc + u, x = dir > 0 ? x0 + xi : x0 + W - 1 - xi, y = ytop - j * sc - v, c = typeof col === 'function' ? col(i, j) : col;
      V.set(x, y, z, c, l); V.rec(M.s, x, y, z, x, z - dir, x, z + dir); } }
  return W;
}
// the same on an x plane (dir +1 faces +x: left → right runs −z → … seen from +x it reads toward −z)
export function vtextX(V, M, z0, ytop, x, col, o = {}) {
  const sc = o.sc ?? 1, l = o.l ?? 0, dir = o.dir ?? 1, W = M.w * sc; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const zi = i * sc + u, z = dir > 0 ? z0 + W - 1 - zi : z0 + zi, y = ytop - j * sc - v, c = typeof col === 'function' ? col(i, j) : col;
      V.set(x, y, z, c, l); V.rec(M.s, x, y, z, x - dir, z, x + dir, z); } }
  return W;
}
// on a kit facade frame: a mask centred at a (align 1) or from a (align 0), letters at d0…d1−1 (their board at d0 − 1)
export function ftext(f, M, a, ytop, o = {}) { const sc = o.sc ?? 1, W = M.w * sc, a0 = o.align === 0 ? a : Math.round(a - W / 2); f.mask(M, a0, ytop, o.d0 ?? 0, o.d1 ?? 1, o.c ?? C.chalk, o.l ?? 0, sc); return { a0, a1: a0 + W, w: W, h: M.h * sc }; }

// ── THE WORLD SLICE. A part of a compound building, authored in world metres, whose voxels are only those of the current block.
// rect = the part's footprint [x0, z0, x1, z1]; the volume covers it (plus `pad` for sills, canopies and signs) inside the block.
// → null when the part doesn't reach this block; else { V, B (the WHOLE part in this volume's voxels: frames run the full wall),
//   X, Y, Z (world → voxel), box(x0, y0, z0, x1, y1, z1, c, l) in world metres, F(side) → kit.js frame, clip (the part's own
//   rect inside the block), s }.
const G = 1;
export function slice(ctx, rect, y0, y1, o = {}) {
  const [x0, z0, x1, z1] = rect, s = o.s ?? CV, pad = o.pad ?? 1, [bx0, bz0, bx1, bz1] = blockRect(ctx), [sx, sz] = off(ctx);   // (SPREAD: frame metres; the volume sits at the frame's place)
  const vx0 = Math.max(bx0, Math.floor((x0 - pad) / G) * G), vx1 = Math.min(bx1, Math.ceil((x1 + pad) / G) * G), vz0 = Math.max(bz0, Math.floor((z0 - pad) / G) * G), vz1 = Math.min(bz1, Math.ceil((z1 + pad) / G) * G);
  if (vx1 - vx0 < s - 1e-6 || vz1 - vz0 < s - 1e-6) return null;
  const V = new Vol(Math.round((vx1 - vx0) / s), Math.round((y1 - y0) / s), Math.round((vz1 - vz0) / s), { s, org: [vx0 + sx, y0, vz0 + sz], ground: o.ground ?? y0 < SIDE + .05 });
  const X = x => Math.round((x - vx0) / s), Y = y => Math.round((y - y0) / s), Z = z => Math.round((z - vz0) / s), B = { x0: X(x0), z0: Z(z0), x1: X(x1), z1: Z(z1) };
  const clip = [Math.max(x0, bx0), Math.max(z0, bz0), Math.min(x1, bx1), Math.min(z1, bz1)], has = clip[2] > clip[0] + 1e-6 && clip[3] > clip[1] + 1e-6;
  return { V, B, X, Y, Z, s, y0, rect, clip: has ? clip : null, F: side => frame(V, B, side),
    box: (ax, ay, az, bx, by, bz, c, l) => V.box(X(ax), Y(ay), Z(az), X(bx), Y(by), Z(bz), c, l),
    wx: i => vx0 + (i + .5) * s, wz: k => vz0 + (k + .5) * s };
}
// a slice that is a building: its footprint (the part inside this block) is registered as a mass — props keep clear of it, the
// block's other parts are clipped against it, people may stand on its roof — and it meshes at fin(ctx). A slice that only holds
// what overhangs from a building next door (its sills and cornice past the block line) is meshed as a plain structure.
export function solid(ctx, S, top, roofY, o = {}) { if (!S) return null; if (!S.clip) { (o.big ? bigs : later)(ctx, S.V); return S; }
  if (o.plinth === false || o.big) { S.V.own = REG.footprint(...atR(ctx, S.clip), top, roofY); (o.big ? bigs : later)(ctx, S.V); }   // (a platform things stand on: no plinth zone round it)
  else ctx.mass(S.V, atR(ctx, S.clip), { top, roofY }); return S; }
// a slice that is NOT a mass (a canopy, a deck, a sign frame): meshed at fin(ctx); keep (world boxes): reserved so props keep clear
export function part(ctx, S, keep = [], o = {}) { if (!S) return null; (o.big ? bigs : later)(ctx, S.V); for (const k of keep) REG.keep(atB(ctx, k), 'structure'); return S; }
const later = (ctx, V) => (ctx.later ??= []).push(V), bigs = (ctx, V) => (ctx.bigs ??= []).push(V);
// a BIG part keeps its full detail in the mid tier (like a roof set piece): the tower's shaft with its crown lettering and neon cross,
// the helipad with the air ambulance — what the overhead reads from 100 m up, where the rest of the block is shown at half resolution
function emitBig(ctx, V) { const bk = tempBank(ctx.bank); meshVol(V, bk); bk.big = true; bk.kind = 'structure'; stamp(bk, ctx.bank, 0, 0, 0, 0); }
// every volume of the block so far: the engine's (ctx.building, ctx.mass, ctx.volume) and ours
export function fin(ctx) { ctx.finish(); for (const V of ctx.later || []) meshVol(V, ctx.bank); for (const V of ctx.bigs || []) emitBig(ctx, V); if (ctx.later) ctx.later.length = 0; if (ctx.bigs) ctx.bigs.length = 0; }

// ── a sign is logged once for the audit's repeat check: by the block that holds its centre (a sign across a block line is one sign)
export function logSign(ctx, key, x, z, r = 96) { if (!inBlock(ctx, x, z)) return; const b = REG.blk; if (!b || !key) return; [x, z] = at(ctx, x, z);
  (b.signs ??= []).push({ fam: 'kit', key: String(key), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r, group: b.group }); }
// a doorway's clear zone (the audit and every placement keep 1.5 × 1.1 m in front of it); rot: the side it faces
export const ROT = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 };
export function door(x, z, side) { const b = REG.blk, [nx, nz] = { '+z': [0, 1], '+x': [1, 0], '-z': [0, -1], '-x': [-1, 0] }[side], dx = x + nx * .5, dz = z + nz * .5;
  if (b && !inBlock(b, dx, dz)) return; const [sx, sz] = b ? off(b) : [0, 0]; REG.door(dx + sx, dz + sz, ROT[side]); }
// the block this ctx builds, as a rect in its frame
export const blockRect = ctx => [ctx.i * P0, ctx.j * P0, ctx.i * P0 + P0, ctx.j * P0 + P0];   // (SPREAD: its frame cell)
export const inBlock = (ctx, x, z) => Math.floor(x / P0) === ctx.i && Math.floor(z / P0) === ctx.j;

// ── facade helpers for slices (both kits). clipR: a world rect inside the block (or null); span: the frame columns [a0, a1) of a world
// span u0…u1 along a slice's wall (u is x on the ±z faces, z on the ±x faces); col: the column of one world coordinate; walls: the
// part's walls and roof membrane; parapet: a ring ph high and two voxels thick with a cap, left out over `open` rects (another part abuts)
export const clipR = (ctx, r) => { const [bx0, bz0, bx1, bz1] = blockRect(ctx), c = [Math.max(r[0], bx0), Math.max(r[1], bz0), Math.min(r[2], bx1), Math.min(r[3], bz1)]; return c[2] - c[0] > 1e-6 && c[3] - c[1] > 1e-6 ? c : null; };
export function span(S, side, u0, u1) { const B = S.B; switch (side) { case '+z': return [S.X(u0) - B.x0, S.X(u1) - B.x0]; case '-z': return [B.x1 - S.X(u1), B.x1 - S.X(u0)]; case '-x': return [S.Z(u0) - B.z0, S.Z(u1) - B.z0]; default: return [B.z1 - S.Z(u1), B.z1 - S.Z(u0)]; } }
export const col = (S, side, u) => span(S, side, u, u + S.s)[0];
export function walls(S, H0, wall, roof = 0xd9d6ce) { const { V, B } = S; V.box(B.x0, 0, B.z0, B.x1, H0, B.z1, wall); V.box(B.x0 + 1, H0 - 1, B.z0 + 1, B.x1 - 1, H0, B.z1 - 1, roof); }
export function parapet(S, H0, ph, wall, cap, open = []) { const { V, B } = S; V.box(B.x0, H0, B.z0, B.x1, H0 + ph, B.z1, wall); V.clear(B.x0 + 2, H0, B.z0 + 2, B.x1 - 2, H0 + ph, B.z1 - 2);
  V.box(B.x0, H0 + ph, B.z0, B.x1, H0 + ph + 1, B.z1, cap); V.clear(B.x0 + 2, H0 + ph, B.z0 + 2, B.x1 - 2, H0 + ph + 1, B.z1 - 2);
  for (const r of open) V.clear(S.X(r[0]), H0, S.Z(r[1]), S.X(r[2]), H0 + ph + 1, S.Z(r[3])); }
