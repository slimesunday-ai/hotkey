// THE SUPPLY SIDE · shared toolkit for Low Tide Docks (docks), The Heap (junkyard) and The Yards (industrial). Owner: the supply
// agent (batch 3). Palette, lettering (five faces: pixel, stencil, hand-painted, Impact, serif), prop helpers and small maths. Worker-safe.
import { Vol, meshed, textMask, rasterMask } from '../../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';
import { REG } from '../../audit.js';
import { LETTERS, mask as typeMask } from '../../signage/type/index.js';
import { off, kerbX, kerbZ } from '../frame.js';
export { PAL, CV, SIDE, hash, shade, TOD, REG };

// SPREAD · A HERO'S FRAME (style/city/SPREAD.md). The Yards' two heroes author in today's metres, the frame of their block: framed(ctx)
// carries a building / volume / mass rect by the block's shift and a put's point through kerb (in the block the shift; in the street
// band kept to its kerb: ../frame.js kerbX / kerbZ), so the yard helpers (floor, fence, mound) take frame metres through it and their
// world-cell patterns read today's. A direct keep or sign log takes kerb(x, z); a value read back off a volume (V.org, fw, doorAt) is
// already the spread world's. The generated kits never use these (they build in the spread world). The identity at SPREAD 0.
export const kerb = (x, z) => [kerbX(x), kerbZ(z)];
export function framed(ctx) { const [sx, sz] = off(ctx);
  return Object.assign(Object.create(ctx), {
    building: (x0, z0, x1, z1, o) => ctx.building(x0 + sx, z0 + sz, x1 + sx, z1 + sz, o),
    volume: (x0, y0, z0, x1, y1, z1, o) => ctx.volume(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, o),
    mass: (V, r, o) => ctx.mass(V, [r[0] + sx, r[1] + sz, r[2] + sx, r[3] + sz], o),
    put: (prop, x, z, o) => ctx.put(prop, ...kerb(x, z), o) }); }

// ── palette: the Springfield walls, the neutral mix, and the waterfront's working colours
export const C = {
  yellow: 0xffc21a, red: 0xef4a2a, pink: 0xff4fa3, violet: 0x7a3cff, orange: 0xff7a1a, green: 0x25b84c, sky: 0x3fa9f5, cobalt: 0x2f5bff,
  teal: 0x12b3a0, purple: 0x8c52ff, rose: 0xe83b5b, tang: 0xff8a1f,
  white: 0xf4f1ea, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, brick: 0x9b4f3a, buff: 0xc49a6c,
  ink: 0x17171b, iron: 0x1d1d24, steel: 0x8a9099, steelL: 0xb9bec6, steelD: 0x4b4f58, rust: 0xa4502a, rustD: 0x7a3a1e,
  conc: 0xc9c3b6, concD: 0xa9a397, concL: 0xdcd6ca, asph: 0x5d5e6b, asphD: 0x4d4e5a, gravel: 0x9c968b, gravelD: 0x87817a, dirt: 0x8a6a4a, dirtD: 0x6f5238,
  wood: 0xa4652f, woodD: 0x6e3e19, woodL: 0xc98a4b, rubber: 0x1f1f26, hazard: 0xffd21f, glass: 0x1b2a55, glassHi: 0x3f6bc4, lit: 0xffe3a0, litLo: 0xffc766,
  sodium: 0xffb347, sea: 0x2f86d8, weed: 0x5f9e3a, weedD: 0x4a8a30, cream: 0xfff0d0, chalk: 0xf7f7f2,
};
export const WALLS = [C.yellow, C.red, C.pink, C.violet, C.orange, C.green, C.sky, C.cobalt, C.teal, C.purple, C.rose, C.tang];
export const NEUTRALS = [C.white, C.brick, C.pale, C.buff, C.bone, C.grey, C.slate];
export const isNeutral = c => NEUTRALS.includes(c);
// aerial perspective for far tiers (STYLE §9): walls lean 30% toward the horizon colour
export const air = (c, t = .3) => { const h = PAL.horizon, m = k => Math.round(((c >> k) & 255) * (1 - t) + ((h >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const LIGHT = new Set([C.yellow, C.hazard, 0xffe23a, C.white, C.bone, C.pale, C.chalk, C.cream, 0x6cff4a, 0x2de2e6, C.sky, C.tang, C.orange, C.buff, C.steelL, C.concL, C.conc]);
export const inkOn = c => LIGHT.has(c) ? C.ink : C.chalk;
export const lit = () => TOD.night ? 3 : 0;

// ── seeded helpers (pure: the plan pass and the far tier see the same numbers)
export const H = (...a) => hash(a[0] | 0, (a[1] ?? 0) | 0, (a[2] ?? 0) | 0);
export const pickH = (arr, ...k) => arr[(H(...k) * arr.length) | 0];
export function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── props: authored in city voxels at the base centre facing +z, memoized per argument set and time of day
const MEMO = new Map();
export const memo = (k, f) => { k += '|' + TOD.night; let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
export const pv = (nx, ny, nz, s = CV, cx = nx / 2, cz = nz / 2) => new Vol(nx, ny, nz, { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind) => { const b = meshed(V); b.kind = kind; return b; };
export const cyl = (V, cx, cz, r, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };
// a cylinder lying along x (drums, pipes, tanks on their side): centre (cy, cz) in the y–z plane
export const cylX = (V, x0, x1, cy, cz, r, c, l = 0) => { for (let x = x0; x < x1; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) if (Math.hypot(y + .5 - cy, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };

// ── lettering. Every face returns a mask { w, h, at(i, j), s } the kit's frames (f.mask) and vtext() both draw.
const MASKS = new Map();
const cache = (k, f) => { let m = MASKS.get(k); if (!m) MASKS.set(k, m = f()); return m; };
export const px = s => cache('px' + s, () => textMask(s));
// stencil: the 5×7 face with the bridges a cut stencil keeps (a gap through the middle of every vertical stroke run ≥ 5 tall, and
// through the crossbar of the round letters), so doors, containers and crates read as sprayed through a template
// lettering pass (2026-09-29): the Yards spray the type library's stencil face (signage/type: same advance widths as the 5×7 face, so
// every plate and door keeps its layout); ?letters=classic brings the derived one back
export const stencil = s => LETTERS.mode === 'classic' ? stencil0(s) : cache('sT' + s, () => typeMask('stencil', s));
const stencil0 = s => cache('st' + s, () => { const M = textMask(s), cut = new Set();
  for (let i = 0; i < M.w; i++) { let col = 0; for (let j = 0; j < 7; j++) if (M.at(i, j)) col++; if (col >= 5) cut.add(i * 8 + 3); }   // every tall stroke broken at mid-height
  return { w: M.w, h: 7, at: (i, j) => M.at(i, j) && !cut.has(i * 8 + j), s }; });
// hand-painted: the pixel face with each letter on its own wobble (a voxel up or down) — sign-painter boards at the Heap and the stalls
export const hand = (s, seed = 0) => cache('hd' + s + seed, () => { const M = textMask(s), W = M.w, off = new Int8Array(W); let k = 0, inGlyph = false;
  for (let i = 0; i < W; i++) { let any = false; for (let j = 0; j < 7; j++) if (M.at(i, j)) any = true; if (any && !inGlyph) k++; inGlyph = any; off[i] = any ? (hash(k, seed, 5) < .34 ? -1 : hash(k, seed, 5) > .7 ? 1 : 0) : 0; }
  return { w: W, h: 9, at: (i, j) => { const jj = j - 1 - off[i]; return jj >= 0 && jj < 7 && M.at(i, jj); }, s }; });
// display faces (canvas raster; heroes and big painted names): Impact for bold headers, a heavy serif for old painted warehouse names
const CANVAS = typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';   // (node tools: the pixel face stands in)
const raster = (s, font, px2, o) => CANVAS ? rasterMask(s, font, 120, o) : scaled(textMask(s), Math.max(1, Math.round(px2 / 9)));
const scaled = (M, k) => ({ w: M.w * k, h: M.h * k, at: (i, j) => M.at((i / k) | 0, (j / k) | 0), s: M.s });
export const impact = (s, px2 = 20) => cache('im' + s + px2, () => raster(s, `900 ${px2}px Impact, "Arial Black", sans-serif`, px2));
export const serif = (s, px2 = 18, even = false) => cache((even ? 'se' : 'sf') + s + px2, () => raster(s, `bold ${px2}px Georgia, "Times New Roman", serif`, px2, { even }));   // (even: rasterMask's even letter spacing, hardening pass)
export const script = (s, px2 = 18) => cache('sc' + s + px2, () => raster(s, `bold italic ${px2}px Georgia, "Times New Roman", serif`, px2));
export const face = (kind, s, o = {}) => kind === 'stencil' ? stencil(s) : kind === 'hand' ? hand(s, o.seed || 0) : kind === 'impact' ? impact(s, o.px || 20) : kind === 'serif' ? serif(s, o.px || 18) : kind === 'script' ? script(s, o.px || 18) : px(s);

// lettering on a Vol plane z (dir +1: faces +z, the board at z − 1; dir −1: faces −z, mirrored so it reads from that side). x0 = the
// leftmost column as seen by the viewer's volume coordinates; every voxel is recorded so the audit proves it sits on its board.
export function vtext(V, M, x0, ytop, z, col, o = {}) {
  const sc = o.sc ?? 1, l = o.l ?? 0, dir = o.dir ?? 1, W = M.w * sc; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const xi = i * sc + u, x = dir > 0 ? x0 + xi : x0 + W - 1 - xi, y = ytop - j * sc - v, c = typeof col === 'function' ? col(i, j) : col;
      V.set(x, y, z, c, l); V.rec(M.s, x, y, z, x, z - dir, x, z + dir); } }
  return W;
}
// the same on an x plane (dir +1 faces +x: reads toward −z… i.e. left→right is −z seen from +x)
export function vtextX(V, M, z0, ytop, x, col, o = {}) {
  const sc = o.sc ?? 1, l = o.l ?? 0, dir = o.dir ?? 1, W = M.w * sc; V.recNext();
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
    for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) { const zi = i * sc + u, z = dir > 0 ? z0 + W - 1 - zi : z0 + zi, y = ytop - j * sc - v, c = typeof col === 'function' ? col(i, j) : col;
      V.set(x, y, z, c, l); V.rec(M.s, x, y, z, x - dir, z, x + dir, z); } }
  return W;
}
// on a kit facade frame: a mask centred at a (align 1) or starting at a (align 0), letters at d0…d1−1 (board at d0 − 1)
export function ftext(f, M, a, ytop, o = {}) { const sc = o.sc ?? 1, W = M.w * sc, a0 = o.align === 0 ? a : Math.round(a - W / 2); f.mask(M, a0, ytop, o.d0 ?? 0, o.d1 ?? 1, o.c ?? C.chalk, o.l ?? 0, sc); return { a0, a1: a0 + W, w: W, h: M.h * sc }; }
export const mw = (M, sc = 1) => M.w * sc;

// ── registry helpers (the audit's doorways; engine.js keeps everything else)
export const faceRot = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 };
export const faceN = { '+z': [0, 1], '+x': [1, 0], '-z': [0, -1], '-x': [-1, 0] };
// a door on a facade frame at a (voxels) → the audit's clear zone (0.5 m out, facing the side)
export function doorAt(f, a, side) { const V = f.V, [x, z] = f.xz(a, 5); REG.door(V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s, faceRot[side]); }
// world point of a frame position (a, d in voxels)
export const fw = (f, a, d) => { const [x, z] = f.xz(a, d), V = f.V; return [V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s]; };

// ── the signage audit's log (tools/audit.mjs sign-repeat): every district sign is recorded with the block's current group, so the
// repeat check sees the supply side's own names too (radius 96 m, the signage system's name radius)
export function logSign(key, x, z, r = 96) { const b = REG.blk; if (!b || !key) return; (b.signs ??= []).push({ fam: 'kit', key: String(key), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r, group: b.group }); }
// ── the sign registry: every string the three kits paint, allocated once for the whole supply side so no name repeats across blocks
// (slime: "variety, not a bunch of repeats"). allocate(deck, key) hands out the next unused entry of a deck in plan order.
export function allocator(decks) { const used = new Map(); return (deck, key) => { const d = decks[deck]; if (!d) throw new Error('no sign deck ' + deck); let n = used.get(deck) || 0; if (n >= d.length) throw new Error(`sign deck ${deck} ran out at ${key}`); used.set(deck, n + 1); return d[n]; }; }
