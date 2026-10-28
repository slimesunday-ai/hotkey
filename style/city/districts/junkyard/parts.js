// THE HEAP · parts (owner: the supply agent): swap-meet stalls under tarps, the fence's booth, roll-off bins, tyre rings, junk mounds,
// the office trailer, the burn barrel, stripped and crushed cars, the tow truck, the truck scale. Hand-painted boards everywhere: the
// Heap is where the city sells what it took, and it looks it. Structures are their own volumes; props go through ctx.put.
import { Vol, meshVol, stamp } from '../../vox.js';
import { TOD } from '../../kit.js';
import { C, PAL, CV, SIDE, REG, shade, hash, H, pickH, cyl, cylX, px, stencil, hand, impact, vtext, vtextX, inkOn, lit, memo, pv, done, faceRot, logSign } from '../industrial/lib.js';
import { floor } from '../industrial/yard.js';
import { plate } from '../industrial/props.js';
import { off, at, atR, inFrame, frameCell } from '../frame.js';
import { HS } from '../../../../world/city.js';

// SPREAD · THE HEAP'S FRAME (../frame.js): the kit authors in today's metres, the frame of the compound (its four blocks share it,
// anchored at the compound's centre). framed(ctx) is the block's context in frame metres: ctx.volume / put / mass / building take them
// and hand the engine spread-world ones (the shared supply-side helpers, industrial/yard.js floor and fence, build through it and keep
// their rolls on today's metres); the registry, the sign log, a tin plate and a far box go through foot / sign / plateOn / farBox.
// At SPREAD 0 framed(ctx) is ctx itself.
export function framed(ctx) { const [sx, sz] = off(ctx); if (!sx && !sz) return ctx;
  return Object.create(ctx, {
    volume: { value: (x0, y0, z0, x1, y1, z1, o) => ctx.volume(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, o) },
    put: { value: (p, x, z, o) => { const r = ctx.put(p, x + sx, z + sz, o); return r && [r[0] - sx, r[1] - sz]; } },
    mass: { value: (V, r, o) => ctx.mass(V, atR(ctx, r), o) },
    building: { value: (x0, z0, x1, z1, o) => ctx.building(x0 + sx, z0 + sz, x1 + sx, z1 + sz, o) },
  }); }
export const foot = (ctx, x0, z0, x1, z1, top, roofY) => REG.footprint(...atR(ctx, [x0, z0, x1, z1]), top, roofY);
export const sign = (ctx, key, x, z) => logSign(key, ...at(ctx, x, z));
// a tin plate on a fence or a wall (industrial/yard.js plateOn, stamped at the frame's place)
export function plateOn(ctx, text, side, x, z, y, bg, fg, style = 'tin') { const p = plate(text, bg, fg, style), rot = faceRot[side], [nx, nz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][rot], [wx, wz] = at(ctx, x + nx * .06, z + nz * .06);
  stamp(p, ctx.bank, rot, wx, SIDE + y, wz); sign(ctx, text, x, z); }
// THE MARGIN: anchored at its centre, the compound has HS m between its walls and each street's lot line at a spread; a strip of gravel
// fills it outside the fence (Ivy St, Dock St, Main St, Mill St), each block its own part. Nothing at SPREAD 0.
export const IN = { x0: -60, z0: -218, x1: -6, z1: -164 };
export function margin(ctx) { const m = HS; if (!m) return; const F = frameCell(ctx), { x0, z0, x1, z1 } = IN;
  for (const r of [[x0 - m, z0 - m, x0, z1 + m], [x1, z0 - m, x1 + m, z1 + m], [x0, z0 - m, x1, z0], [x0, z1, x1, z1 + m]]) {
    const c = [Math.max(r[0], F[0]), Math.max(r[1], F[1]), Math.min(r[2], F[2]), Math.min(r[3], F[3])]; if (c[2] - c[0] > 1e-6 && c[3] - c[1] > 1e-6) floor(ctx, c, 'gravel'); } }
export const farBox = ctx => { const [sx, sz] = off(ctx); return (x0, y0, z0, x1, y1, z1, c) => ctx.box(x0 + sx, y0, z0 + sz, x1 + sx, y1, z1 + sz, c); };

export const SITE = { x: -33, z: -191, r: 6.5 };
export const inSite = (x, z, m = 0) => Math.hypot(x - SITE.x, z - SITE.z) < SITE.r + m;
const JUNK = [0xb5553a, 0x7a3a1e, 0x9aa0a8, 0x6d707a, 0xa4502a, 0x8a6a4a, 0x5a4632, 0x2f5bff, 0xe8232a, 0xa4502a, 0x9aa0a8, 0x25b84c, 0xffc21a, 0xf4f1ea, 0x7a3a1e, 0x1f1f26], JUNKR = [0xa4502a, 0x9aa0a8, 0x1f1f26, 0x7a3a1e];

// ── a swap-meet stall: a folding table of goods, a tarp on four poles (sloped), a hand-painted board on the front edge; rot 0 faces +z.
// One structure (its own volume), 3.2 × 2.4 m, the board a lettering the audit checks.
export function stall(ctx, x, z, rot, sign, tarp, goods, seed) {
  const W = 32, D = 24, along = (rot & 1) === 0, V = ctx.volume(x - (along ? W : D) * CV / 2, SIDE + CV, z - (along ? D : W) * CV / 2, x + (along ? W : D) * CV / 2, SIDE + CV + 2.7, z + (along ? D : W) * CV / 2, { keep: 'stall' });
  const P = (a, y, b, c, l = 0) => { if (rot === 0) V.set(a, y, b, c, l); else if (rot === 2) V.set(W - 1 - a, y, D - 1 - b, c, l); else if (rot === 1) V.set(b, y, W - 1 - a, c, l); else V.set(D - 1 - b, y, a, c, l); };
  const box = (a0, y0, b0, a1, y1, b1, c, l = 0) => { for (let a = a0; a < a1; a++) for (let y = y0; y < y1; y++) for (let b = b0; b < b1; b++) P(a, y, b, typeof c === 'function' ? c(a, y, b) : c, l); };
  for (const a of [1, W - 2]) for (const b of [1, D - 2]) box(a, 0, b, a + 1, b < 12 ? 24 : 21, b + 1, C.steelL);                         // poles (the back pair taller)
  for (let b = 0; b < D; b++) { const y = 24 - Math.round(b / 8); box(0, y, b, W, y + 1, b + 1, (a) => ((a >> 2) & 1) && tarp !== C.chalk ? shade(tarp, .88) : tarp); }   // the tarp sloping to the front
  box(3, 7, 12, W - 3, 8, D - 3, 0xe8e2d0); for (const a of [4, W - 5]) box(a, 0, 13, a + 1, 7, D - 4, C.steelD);                                 // the table
  for (let a = 4; a < W - 4; a += 3) { const k = hash(a, seed, 3), c = goods[(k * goods.length) | 0], h2 = 1 + ((hash(a, seed, 5) * 3) | 0); box(a, 8, 14 + ((k * 4) | 0), a + 2, 8 + h2, 16 + ((k * 4) | 0), c); }
  box(2, 0, 3, 10, 5, 9, pickH([0x2f5bff, 0xe8232a, 0x25b84c], seed, 7)); box(W - 12, 0, 4, W - 3, 4, 10, 0xc98a4b);                              // crates behind
  const M = hand(sign, seed), bw = Math.min(W - 2, M.w + 6); if (M.w + 4 <= W) { const a0 = (W - bw) >> 1; box(a0, 9, D - 1, a0 + bw, 9 + M.h + 3, D, C.chalk);
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const a = a0 + 3 + i, y = 9 + M.h + 1 - j; P(a, y, D, pickH([C.red, C.cobalt, C.ink, C.green], seed, 9)); recP(V, rot, W, D, M.s, a, y, D); } }
  return V;
}
// record a stall-frame letter voxel (a, y, b) with its board at b − 1 (the frame's −b side), through the stall's rotation
function recP(V, rot, W, D, label, a, y, b) { const at = (aa, bb) => rot === 0 ? [aa, bb] : rot === 2 ? [W - 1 - aa, D - 1 - bb] : rot === 1 ? [bb, W - 1 - aa] : [D - 1 - bb, aa];
  const [x, z] = at(a, b), [bx, bz] = at(a, b - 1), [fx, fz] = at(a, b + 1); V.rec(label, x, y, z, bx, bz, fx, fz); }
export const GOODS = {
  rims: [0xc9ced6, 0x9aa0a8, 0xe7bd4a, 0x1f1f26], phones: [0x1f1f26, 0xf4f4f0, 0x3fa9f5, 0xff4fa3], vinyl: [0x1f1f26, 0xe8232a, 0xffc21a, 0xf4f4f0], tools: [0xe8232a, 0xffc21a, 0x2f5bff, 0x6d707a],
  radios: [0x1f1f26, 0xc9ced6, 0xa4652f], bikes: [0x2f5bff, 0xe8232a, 0x25b84c], watches: [0xe7bd4a, 0xc9ced6, 0x1f1f26], lamps: [0xffc21a, 0xf4f4f0, 0xff7a1a], sneakers: [0xf4f4f0, 0xe8232a, 0x1f1f26, 0x2de2e6],
  batteries: [0x1f1f26, 0xffc21a, 0xe8232a], dvds: [0x3fa9f5, 0xff4fa3, 0x1f1f26, 0xf4f4f0], parts: [0x6d707a, 0xa4502a, 0x1f1f26] };

// ── THE FENCE's booth: a 20 ft box on blocks, a barred service window with a counter and a scale, the boards: WE BUY ANYTHING on the
// roof, CASH · NO QUESTIONS by the window, the price list on the end. rot: which way the window faces (0 +z).
export function fenceBooth(ctx, x, z, rot) {
  const L = 122, Wd = 24, along = (rot & 1) === 0, nx = along ? L : Wd + 12, nz = along ? Wd + 12 : L, V = ctx.volume(x - nx * CV / 2, SIDE + CV, z - nz * CV / 2, x + nx * CV / 2, SIDE + CV + 4.4, z + nz * CV / 2, { keep: 'booth' });
  const P = (a, y, b, c, l = 0) => { if (rot === 0) V.set(a, y, b, c, l); else if (rot === 2) V.set(L - 1 - a, y, nz - 1 - b, c, l); else if (rot === 1) V.set(b, y, L - 1 - a, c, l); else V.set(nx - 1 - b, y, a, c, l); };
  const box = (a0, y0, b0, a1, y1, b1, c, l = 0) => { for (let a = a0; a < a1; a++) for (let y = y0; y < y1; y++) for (let b = b0; b < b1; b++) P(a, y, b, typeof c === 'function' ? c(a, y, b) : c, l); };
  const REC = (lab, a, y, b) => { const at = (aa, bb) => rot === 0 ? [aa, bb] : rot === 2 ? [L - 1 - aa, nz - 1 - bb] : rot === 1 ? [bb, L - 1 - aa] : [nx - 1 - bb, aa]; const [xx, zz] = at(a, b), [bx, bz] = at(a, b - 1), [fx, fz] = at(a, b + 1); V.rec(lab, xx, y, zz, bx, bz, fx, fz); };
  const word = (M, a0, ytop, b, c, l = 0) => { V.recNext(); for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { P(a0 + i, ytop - j, b, c, l); REC(M.s, a0 + i, ytop - j, b); } };
  const G = 0x25b84c, night = TOD.night;
  for (const a of [4, L - 10]) box(a, 0, 2, a + 6, 3, Wd - 2, 0x9a9aa6);                                                                         // cinder blocks
  box(0, 3, 0, L, 29, Wd, (a, y) => a % 4 === 0 ? shade(G, .85) : G); box(0, 28, 0, L, 29, Wd, shade(G, .9)); box(2, 5, 2, L - 2, 27, Wd - 2, -1);   // the box, hollow
  // the service window on the +b side: a cut with bars, a steel shelf, the scale on it, a light over it
  box(40, 11, Wd - 1, 82, 24, Wd, -1); box(40, 11, Wd - 3, 82, 24, Wd - 2, night ? 0xffe3a0 : 0x2a2d38, night ? 3 : 0); for (let a = 41; a < 82; a += 3) box(a, 11, Wd - 1, a + 1, 24, Wd, C.steelD);
  box(38, 10, Wd, 84, 11, Wd + 5, C.steelL); box(58, 11, Wd + 1, 64, 13, Wd + 4, C.chalk); box(60, 13, Wd + 2, 62, 16, Wd + 3, C.steelD);
  for (const a of [12, 100]) { box(a, 5, Wd - 1, a + 12, 26, Wd, 0x1f6a3a); box(a + 9, 14, Wd, a + 10, 16, Wd + 1, PAL.gold); }        // the two doors, bolted
  box(0, 29, 0, L, 30, Wd, shade(G, .8)); for (let k = 0; k < 14; k++) box(4 + k * 8, 29, 2 + ((k * 5) % 16), 7 + k * 8, 30 + (k % 3), 5 + ((k * 5) % 16), JUNKR[k % JUNKR.length]);   // junk on the roof
  // WE BUY ANYTHING on a plywood board on the roof (posts to the roof), hand painted
  const T = hand('WE BUY ANYTHING', 11), tw = T.w + 8; if (tw < L) { const a0 = (L - tw) >> 1; box(a0 + 2, 29, Wd - 4, a0 + 3, 33, Wd - 3, C.woodD); box(a0 + tw - 3, 29, Wd - 4, a0 + tw - 2, 33, Wd - 3, C.woodD);
    box(a0, 33, Wd - 4, a0 + tw, 33 + T.h + 4, Wd - 3, 0xe8d4b0); word(T, a0 + 4, 33 + T.h + 1, Wd - 3, C.red); }
  const S = px('CASH · NO QUESTIONS'); if (S.w + 6 < L) { const a0 = (L - S.w) >> 1; box(a0 - 3, 25, Wd, a0 + S.w + 3, 25 + 10, Wd + 1, C.ink); word(S, a0, 33, Wd + 1, C.hazard, night ? 3 : 0); }
  const [fx0, fz0] = rot === 0 ? [0, 0] : rot === 2 ? [0, 12] : rot === 1 ? [0, 0] : [12, 0], [fx1, fz1] = rot === 0 ? [L, Wd] : rot === 2 ? [L, nz] : rot === 1 ? [Wd, L] : [nx, L];
  REG.footprint(V.org[0] + fx0 * CV, V.org[2] + fz0 * CV, V.org[0] + fx1 * CV, V.org[2] + fz1 * CV, SIDE + 3.0, SIDE + 3.0);
  return V;
}
// ── roll-off bins: a steel open-top bin with its trade stencilled on the side (a prop)
export const bin = (col, label, fill) => memo('rolloff' + col + label + fill, () => { const V = pv(60, 17, 24), dark = shade(col, .7);
  V.box(2, 0, 2, 58, 2, 22, C.steelD); for (let y = 2; y < 17; y++) { const t = y > 14 ? 1 : 0; V.box(0 + (y < 5 ? 2 - (y >> 1) : 0), y, 0, 60 - (y < 5 ? 2 - (y >> 1) : 0), y + 1, 24, (x, yy, z) => (x > 1 && x < 58 && z > 1 && z < 22 && yy > 3) ? undefined : (x % 8 === 0 ? dark : col)); }
  V.box(2, 3, 2, 58, 12, 22, fill);   // what's in it, heaped under the rim
  for (let x = 3; x < 57; x += 3) V.box(x, 12, 3 + ((x * 7) % 16), x + 3, 13 + ((x >> 2) % 3), 5 + ((x * 7) % 16), shade(fill, .85));
  const M = stencil(label); if (M.w < 54) { vtext(V, M, 30 - (M.w >> 1), 13, 23, C.chalk, { dir: 1 }); vtext(V, M, 30 - (M.w >> 1), 13, 0, C.chalk, { dir: -1 }); }
  return done(V, 'bin'); });
// a burn barrel: a drum with the fire in it, the flames lit at night
export const burnBarrel = () => memo('burn', () => { const V = pv(7, 15, 7); cyl(V, 3.5, 3.5, 3, 0, 9, (x, y) => (y === 3 || y === 6) ? 0x5a3a24 : 0x7a4a2a); cyl(V, 3.5, 3.5, 2.2, 8, 9, 0x2a1a10);
  for (let k = 0; k < 9; k++) { const x = 1 + (k % 3) * 2, z = 1 + ((k / 3) | 0) * 2, h = 9 + 2 + ((k * 7) % 4); V.box(x, 9, z, x + 1, h, z + 1, k % 2 ? 0xffb030 : 0xff5a1a, 3); } return done(V, 'barrel'); });
// a stripped car: no wheels, no glass, rust bloom, doors gone, on its belly (the burnt one is black and rust)
export const carcass = (col, burnt = false) => memo('carc' + col + burnt, () => { const V = pv(20, 16, 44), body = burnt ? 0x2a2624 : col, rust = burnt ? 0x5a3424 : 0xa4502a;
  V.box(1, 0, 1, 19, 7, 43, (x, y, z) => hash(x >> 1, y, z >> 2) > (burnt ? .45 : .8) ? rust : body); V.box(1, 7, 12, 19, 14, 32, (x, y, z) => (y > 8 && y < 13 && (x === 1 || x === 18 || z === 12 || z === 31)) ? undefined : (hash(x, y, z) > .7 ? rust : body));
  V.box(2, 1, 13, 18, 7, 31, 0x2a2624); V.box(1, 1, 16, 2, 6, 28, 0x2a2624); V.box(18, 1, 16, 19, 6, 28, 0x2a2624); V.box(1, 13, 12, 19, 14, 32, burnt ? 0x3a3230 : body);
  return done(V, 'carcass'); });
// a cube from the crusher: a car pressed to 1.4 × 0.9 × 0.9, stripes of its paint, rust and chrome
export const cube = col => memo('cube' + col, () => { const V = pv(14, 9, 9); V.box(0, 0, 0, 14, 9, 9, (x, y, z) => hash(x, y * 7, z) > .78 ? 0xa4502a : hash(x >> 1, y, z) > .9 ? 0xc9ced6 : ((y + (x >> 2)) % 3 === 0 ? shade(col, .8) : col)); return done(V, 'cube'); });
// the tow truck: a flatbed-less wrecker, the boom and hook at the back, TONY'S on the doors
export const towTruck = (col, name) => memo('tow' + col + name, () => { const W = 24, V = pv(W, 32, 66);
  for (const z of [10, 17, 54]) for (const x of [0, W - 3]) { V.box(x, 0, z - 4, x + 3, 8, z + 4, C.rubber); V.box(x + (x ? 2 : 0), 2, z - 2, x + (x ? 3 : 1), 6, z + 2, C.steelL); }
  V.box(2, 6, 2, W - 2, 10, 62, C.steelD); V.box(1, 10, 2, W - 1, 18, 34, col); V.box(1, 6, 44, W - 1, 26, 60, col); V.box(2, 18, 45, W - 2, 25, 46, 0x9fd8ff, 1); V.box(1, 26, 45, W - 1, 28, 59, shade(col, .85));
  V.box(1, 6, 60, W - 1, 17, 62, col); V.box(2, 7, 62, W - 2, 11, 64, C.steelL, 2); V.box(4, 28, 50, W - 4, 30, 54, 0xffb400, TOD.night ? 3 : 1);
  V.box(9, 18, 10, 15, 22, 38, C.steelD); for (let k = 0; k < 12; k++) V.box(10, 22 + k, 10 - k, 14, 23 + k, 11 - k, C.hazard); V.box(11, 8, 0, 13, 34, 1, C.ink); V.box(9, 6, -1, 15, 9, 1, C.steelD);
  const M = px(name); if (M.w < 30) { vtextX(V, M, 3 + ((30 - M.w) >> 1), 17, W - 1, inkOn(col), { dir: 1 }); vtextX(V, M, 3 + ((30 - M.w) >> 1), 17, 0, inkOn(col), { dir: -1 }); }
  return done(V, 'truck'); });
// a doghouse with BEWARE painted over the door and a chain to a stake (the dog is out)
export const doghouse = () => memo('dogh', () => { const V = pv(12, 12, 12); V.box(0, 0, 0, 12, 7, 12, 0xa4652f); for (let k = 0; k < 6; k++) V.box(k - 1 + 1, 7 + k, 0, 13 - k - 1 - 1, 8 + k, 12, 0xe8232a);
  V.box(4, 0, 11, 8, 5, 12, 0x2a1a10); for (let k = 0; k < 8; k++) V.set(8 + (k >> 1), 0, 11 + (k % 2), C.steelL); return done(V, 'doghouse'); });
// ── a junk mound: a stepped heap whose skin is junk (car panels, rust, appliances, tyres) with things sticking out of it
export function junkMound(ctx, cx, cz, r, hgt, seed, o = {}) {
  const n = Math.ceil(r / CV), hv = Math.round(hgt / CV), V = ctx.volume(cx - n * CV, o.y ?? SIDE + CV, cz - n * CV, cx + n * CV, (o.y ?? SIDE + CV) + (hv + 20) * CV, cz + n * CV, { keep: 'junk' });
  const top = (x, z) => { const d = Math.hypot(x + .5 - n, z + .5 - n) / n + (hash(x >> 3, z >> 3, seed) - .5) * .18; return d >= 1 ? 0 : Math.max(1, Math.round(hv * Math.pow(1 - d, .8))); };
  for (let x = 0; x < 2 * n; x++) for (let z = 0; z < 2 * n; z++) { const h = top(x, z); if (!h) continue; const c = JUNK[(hash(x >> 3, z >> 3, seed + 1) * JUNK.length) | 0];
    V.box(x, 0, z, x + 1, h, z + 1, (xx, y) => y < h - 3 ? 0x5a4632 : (hash(x >> 2, y >> 2, z >> 2) > .72 ? shade(c, .8) : c)); }
  // things sticking out: tyres on edge, a door, a fridge, a pipe
  for (let k = 0; k < Math.round(r * 1.4); k++) { const a = hash(seed, k, 3) * Math.PI * 2, rr = n * (.3 + hash(seed, k, 5) * .5), x = Math.round(n + Math.cos(a) * rr), z = Math.round(n + Math.sin(a) * rr), y = top(x, z); if (!y) continue; const t = k % 4;
    if (t === 0) for (let q = 0; q < 16; q++) { const u = q / 16 * Math.PI * 2; V.box(x + Math.round(Math.cos(u) * 3), y - 1 + Math.round(Math.sin(u) * 3) + 3, z, x + Math.round(Math.cos(u) * 3) + 1, y + Math.round(Math.sin(u) * 3) + 3, z + 2, C.rubber); }
    else if (t === 1) V.box(x, y - 2, z, x + 6, y + 6, z + 2, JUNK[(k * 5) % JUNK.length]); else if (t === 2) V.box(x, y - 2, z, x + 5, y + 9, z + 5, C.chalk); else V.box(x, y, z, x + 14, y + 2, z + 2, C.steelL); }
  REG.surface(V); return V;
}
// ── the office trailer: a single-wide on blocks with steps and a railing, OFFICE · KNOCK LOUD by the door, a window unit, a light
export function officeTrailer(ctx, x0, z0, x1, z1, col) {
  const V = ctx.volume(x0, SIDE + CV, z0, x1, SIDE + CV + 4.8, z1 + 1.4, { keep: 'trailer' }), nx = V.nx, nz = Math.round((z1 - z0) / CV), night = TOD.night;
  for (let x = 6; x < nx - 6; x += 20) V.box(x, 0, 3, x + 5, 5, nz - 3, 0x9a9aa6);
  V.box(0, 5, 0, nx, 30, nz, (x, y) => (y % 6 === 0) ? shade(col, .9) : col); V.box(0, 30, 0, nx, 32, nz, C.chalk); V.clear(3, 8, 3, nx - 3, 28, nz - 3);
  const dA = nx - 22; V.box(dA, 6, nz - 1, dA + 10, 26, nz, 0xe6e6ea); V.box(dA + 7, 15, nz, dA + 8, 17, nz + 1, PAL.gold);
  for (let k = 0; k < 2; k++) V.box(dA - 2, 0, nz + k * 3, dA + 12, 4 - k * 2, nz + (k + 1) * 3, 0x8a8f99);                                   // two steps down
  for (const a of [8, 36]) { V.box(a, 14, nz - 1, a + 16, 25, nz, night ? C.lit : PAL.glassLo, night ? 3 : 1); V.box(a - 1, 13, nz, a + 17, 14, nz + 1, C.chalk); }
  V.box(58, 9, nz, 68, 14, nz + 3, 0xe6e6ea);                                                                                                  // the window unit
  // OFFICE · KNOCK LOUD hand-painted on a board standing on the roof's front edge
  const T = hand('OFFICE · KNOCK LOUD', 3); if (T.w + 8 < nx) { const a0 = (nx - T.w - 8) >> 1; V.box(a0 + 3, 32, nz - 2, a0 + 4, 34, nz - 1, C.woodD); V.box(a0 + T.w + 4, 32, nz - 2, a0 + T.w + 5, 34, nz - 1, C.woodD);
    V.box(a0, 34, nz - 2, a0 + T.w + 8, 34 + T.h + 3, nz - 1, 0xe8d4b0); vtext(V, T, a0 + 4, 34 + T.h + 1, nz - 1, C.red, { dir: 1 }); }
  foot(ctx, x0, z0, x1, z1, SIDE + 3.4, SIDE + 3.2); return V;
}

// ── the compound's shared ground: patchwork wall colours, the mud floor (bare slab in the site), the ring of white tyres round it
export const PANELS = [0x3fa9f5, 0x25b84c, 0xa4502a, 0xa7a9b1, 0x2f5bff, 0xe8e2d0, 0x12b3a0, 0x7a3a1e, 0xffc21a, 0x6d707a];
// the ground: mud with oil, gravel tracks; bare slab inside the site; the ring of white tyres round it is props
export function heapFloor(ctx, R, avoid = [], keep = []) {
  floor(ctx, R, 'dirt', avoid, { keep, paint: (x, z) => { const d = Math.hypot(x - SITE.x, z - SITE.z); if (d < SITE.r + .2) return -1;
    if (Math.abs(d - 7.2) < .22 && hash(((Math.atan2(z - SITE.z, x - SITE.x) + 4) * 14) | 0, 5, 19) > .2) return C.chalk;   // the ring sprayed on the dirt, the tyres sit on it
    if (hash((x * 2) | 0, (z * 2) | 0, 17) > .96) return 0x2a2624; return null; } }); }
export const ringTyre = () => memo('rtyre', () => { const V = pv(8, 5, 3);   // rubber (props.js tires' 0x1f1f26), the tread a shade up, the hub hole
  for (let x = 0; x < 8; x++) for (let y = 0; y < 5; y++) { const d = Math.hypot(x + .5 - 4, y + .5 - .6); if (d > 1.7 && d < 4.05) V.box(x, y, 0, x + 1, y + 1, 3, (xx, yy, zz) => zz === 1 && d > 3.2 ? 0x2c2c34 : C.rubber); }
  return done(V, 'tyre'); });
// the tyre ring: black tyres on edge, half sunk on a sprayed white line, every 25° round the site at 7.2 m (each block puts its own quarter)
export function tyreRing(ctx, a0, a1) { for (let a = a0; a < a1; a += 25) { const t = a * Math.PI / 180, x = SITE.x + Math.cos(t) * 7.2, z = SITE.z + Math.sin(t) * 7.2, rot = Math.abs(Math.cos(t)) > .7 ? 1 : 0;
  if (!inFrame(ctx, x, z)) continue; ctx.put(ringTyre(), x, z, { rot, reach: .3, slide: [-Math.sin(t), Math.cos(t)] }); } }
