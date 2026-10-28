// BLACKPINE WOODS · the block builder (owner: the Blackpine Woods agent). Worker-safe.
// A woods block is three volumes and a few props, so a street view of the woods stays cheap:
//   FLOOR   0.2 m cubes, one layer (0–0.2 m, level with the city's sidewalks): forest floor in patches (needles, moss, leaf litter,
//           autumn leaves under the maples), tracks (two ruts and a grass hump), trails, clearings with flowers, sand and mud shores
//   WOODS   0.4 m cubes from the floor up: every tree (trees.js), bushes, boulders, fallen logs, stumps
//   VERGE   0.1 m cubes along a city road: a 2 m sidewalk with its curb (the city's street furniture stands on it), then the woods'
//           edge — a fieldstone wall, a split-rail fence, chain link, a guardrail or a hedge, open where a track or a trail comes out
// The mid tier is the same cubes, coarser: FLOOR as it is, WOODS downsampled 2× (0.8 m) — the same trees. far(ctx) draws the plan as
// flat boxes (trees.js treeBoxes: a few faces per tree, no voxels) on a floor of merged quads, plus the heroes' silhouettes (herofar.js).
import { Vol, meshVol, boxInto } from '../../vox.js';
import { REG } from '../../audit.js';
import { PAL, SIDE, hash, shade } from '../../style.js';
import { P, SITES, PILE, BEDS, TRACKS, TRAILS, CLEARINGS, YARDS, SHORE, SP, elev, lakeOf, cityDist, treesNear, pathsIn, distTo, roadDist, sidesOf, slabOf, openness, onPath, isWoods, bendCorners, LANDING, inLanding } from './plan.js';
import { lakeSide } from './land.js';
import { drawTree, treeBoxes, drawBoxes, boulder, fallenLog, stump, PAL_W, mix } from './trees.js';
import { fbm } from '../../../../world/city.js';
import { features } from './features.js';
import { heroFar } from './herofar.js';
import { landingFar } from './landing.js';

export const FC = {   // floor colours
  mossD: 0x33663a, moss: 0x3d7538, grassF: 0x4b8a3b, needle: 0x86603a, needleD: 0x6b4a2c, litter: 0x9c6230,
  autumn: [0xd8681f, 0xe8892a, 0xbf471c], clear: 0x5db659, clearL: 0x74c865, flowers: [0xffe23a, 0xff5fae, 0xf7f7f2, 0xb58cff],
  dirt: 0x9c6b3a, rut: 0x72502f, hump: 0x6c8c3d, trail: 0xc49a6c, trailD: 0xb08858,
  sand: 0xe8d49a, sandW: 0xd3b877, mud: 0x6d5438, mudD: 0x594330, soil: 0x5a3e26, soilL: 0x7a5434,
  walk: PAL.walk, joint: PAL.joint, curbTop: PAL.curbTop, curbFace: PAL.curbFace, gravel: 0xa39c8f, gravelD: 0x8a8378,
};
const air = (c, t = .18) => mix(c, PAL.horizon, t);

// ── per-block context: the elevation on a 1 m grid (bilinear), the paths, clearings and trees that reach in
export function blockInfo(i, j) {
  const N = Math.ceil(P) + 3, x0 = i * P, z0 = j * P, x1 = x0 + P, z1 = z0 + P, E = new Float32Array(N * N);   // (SPREAD: the grid is P + 3 a side — 35 at 32 — the block and a metre round it)
  let minE = 1e9; for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const e = elev(x0 - 1 + a, z0 - 1 + b); E[a * N + b] = e; if (e < minE) minE = e; }
  const eAt = (x, z) => { const fx = x - x0 + 1, fz = z - z0 + 1, a = Math.max(0, Math.min(N - 2, Math.floor(fx))), b = Math.max(0, Math.min(N - 2, Math.floor(fz))), u = fx - a, v = fz - b;
    return (E[a * N + b] * (1 - u) + E[(a + 1) * N + b] * u) * (1 - v) + (E[a * N + b + 1] * (1 - u) + E[(a + 1) * N + b + 1] * u) * v; };
  const paths = pathsIn(x0, z0, x1, z1, 4), clear = CLEARINGS.filter(([cx, cz, r]) => cx + r + 7 > x0 && cx - r - 7 < x1 && cz + r + 7 > z0 && cz - r - 7 < z1);
  const trees = treesNear(x0, z0, x1, z1), sides = sidesOf(i, j), slab = slabOf(i, j);
  return { i, j, x0, z0, x1, z1, eAt, dry: minE > SHORE + 1.5, paths, clear, trees, sides, slab, maples: trees.filter(t => t.sp === SP.maple), bends: bendCorners(i, j) };   // (stitch pass: + the outside of a bend)
}
// the 2 m sidewalk strips along the block's road sides (the first side takes the shared corner square)
export function vergeStrips(I) { const out = [], s = I.slab, has = k => I.sides.some(S => S.k === k);
  const sw = k => I.sides.find(S => S.k === k).sw;   // (SPREAD: each side's own sidewalk width)
  for (const S of I.sides) { const w = S.sw; let [x0, z0, x1, z1] = S.k === 'N' ? [s.x0, s.z0, s.x1, s.z0 + w] : S.k === 'S' ? [s.x0, s.z1 - w, s.x1, s.z1] : S.k === 'W' ? [s.x0, s.z0, s.x0 + w, s.z1] : [s.x1 - w, s.z0, s.x1, s.z1];
    if (S.ax === 'z') { if (has('N')) z0 = s.z0 + sw('N'); if (has('S')) z1 = s.z1 - sw('S'); }   // (the N / S strips own the corner squares)
    if (x1 - x0 > .05 && z1 - z0 > .05) out.push({ S, x0, z0, x1, z1 }); }
  return out; }
const inRect = (x, z, r) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
const pitAt = (x, z, m = 0) => { for (const [dx, dz] of [[0, 0], PILE.spill]) if (Math.abs(x - PILE.x - dx) < PILE.half + m && Math.abs(z - PILE.z - dz) < PILE.half + m) return true; return false; };
export const PIT = pitAt;
// what the floor is at a point: a colour, or 0 (water, asphalt, the verge, the leaf pits: nothing drawn)
export function floorAt(I, x, z, verge) {
  const e = I.dry ? 9 : I.eAt(x, z); if (e < 0) return 0;
  if (roadDist(x, z) < 0) return 0; for (const v of verge) if (inRect(x, z, v)) return 0;
  for (const v of I.bends) if (inRect(x, z, v)) return 0; if (inLanding(x, z, LANDING.apron)) return 0;   // (stitch pass: a bend's corner, the ferry landing's apron)
  if (pitAt(x, z)) return 0; if (pitAt(x, z, .45)) return hash(Math.floor(x / .4), Math.floor(z / .4), 13) < .4 ? FC.soilL : FC.soil;   // the pits' dug rims
  { const dp = Math.hypot(x - PILE.x, z - PILE.z), ds = Math.hypot(x - PILE.x - PILE.spill[0], z - PILE.z - PILE.spill[1]), n = hash(Math.floor(x / .6), Math.floor(z / .6), 14);   // the dig: worked soil round the pits
    if (dp < 5.4 + (n - .5) * .8 || ds < 3.6 + (n - .5) * .6) return n < .1 ? FC.soilL : FC.soil; if (dp < 6.4 && n < .55) return FC.dirt; }
  const cell = (k, q = .6) => hash(Math.floor(x / q), Math.floor(z / q), k);
  if (e < SHORE) return lakeSide(x, z) ? (e < .9 ? FC.mudD : FC.mud) : (e < .8 ? FC.sandW : FC.sand);
  const [dt] = distTo(x, z, I.paths.tracks); if (dt < 1.65) { const a = dt; return a < .32 ? (cell(3, .4) < .3 ? FC.dirt : FC.hump) : a < 1.02 ? (cell(4, .8) < .12 ? FC.dirt : FC.rut) : FC.dirt; }
  const [dr] = distTo(x, z, I.paths.trails); if (dr < .66) return cell(5, .8) < .2 ? FC.trailD : FC.trail;
  for (const [bx0, bz0, bx1, bz1] of BEDS) if (x >= bx0 && x < bx1 && z >= bz0 && z < bz1) return ((x - bx0) % 1.2) < .6 ? FC.soil : FC.soilL;
  for (const [cx, cz, r, kind] of I.clear) { const d = Math.hypot(x - cx, z - cz); if (d >= r + (cell(6, 1.2) - .5) * 2.5) continue;
    if (kind === 'yard') { const n = cell(12, 1.4); return d < r * .7 ? (n < .55 ? FC.dirt : n < .8 ? FC.litter : FC.grassF) : (n < .3 ? FC.dirt : FC.grassF); }   // a working yard: trodden dirt, worn grass
    return kind === 'meadow' && cell(7, .4) < .004 ? FC.flowers[(cell(8, .4) * 2) | 0] : d < r * .55 && cell(9, 1.6) < .25 ? FC.clearL : FC.clear; }
  for (const t of I.maples) if (Math.hypot(x - t.x, z - t.z) < t.r * .95 && cell(10) < .75) return FC.autumn[(cell(11) * 3) | 0];
  const deep = fbm(x * .012 + 11, z * .012 - 7, 3), n = fbm(x * .11 + 5, z * .11 - 2, 2);
  if (deep < .5 && cityDist(x, z) > 30) return n < .42 ? FC.needleD : n < .62 ? FC.needle : FC.mossD;
  return n < .36 ? FC.litter : n < .62 ? FC.moss : FC.grassF;
}

// mesh a volume into the block (full tier, registered for the audit) and the same cubes into the mid tier (they are coarse already)
export function meshSame(V, bank) { const m = bank.mid; bank.mid = null; try { meshVol(V, bank); } finally { bank.mid = m; } if (m) meshVol(V, m); }
// mesh a volume into the full tier only (the caller draws its mid tier itself)
export function meshFull(V, bank) { const m = bank.mid; bank.mid = null; try { meshVol(V, bank); } finally { bank.mid = m; } }
const eps = t => ((t.seed >>> 0) % 13) * .002;   // (boxes of different trees never share a plane: no z-fighting where crowns overlap)

// ── the builder: the floor, the woods, the verge and its edge. o.skip: [[x, z, r]] areas a hero builds itself (no scatter there)
export function woods(ctx, o = {}) {
  const I = blockInfo(ctx.i, ctx.j), bank = ctx.bank, skip = o.skip || [], verge = vergeStrips(I);
  // FLOOR (0.2 m)
  ctx.group('floor');
  const NF = Math.round(P / .2), F = new Vol(NF, 1, NF, { s: .2, org: [I.x0, 0, I.z0], ground: true });   // (SPREAD: the block's own size: 160 cells at 32)
  for (let a = 0; a < NF; a++) for (let b = 0; b < NF; b++) { const c = floorAt(I, I.x0 + (a + .5) * .2, I.z0 + (b + .5) * .2, verge); if (c) F.set(a, 0, b, c); }
  REG.surface(F); meshSame(F, bank);
  // VERGE (0.1 m): the sidewalk and its curb
  ctx.group('verge');
  for (const v of verge) { const V = ctx.volume(v.x0, 0, v.z0, v.x1, SIDE, v.z1, { walk: true }), S = v.S;
    V.box(0, 0, 0, V.nx, V.ny, V.nz, (x, y, z) => { const wx = v.x0 + (x + .5) * .1, wz = v.z0 + (z + .5) * .1, c = S.dir > 0 ? (S.ax === 'x' ? wz : wx) - S.cur : S.cur - (S.ax === 'x' ? wz : wx), u = S.ax === 'x' ? wx : wz;
      if (c < .2) return y ? FC.curbTop : FC.curbFace;
      if (S.hwy) return hash(Math.floor(u / .3), Math.floor(c / .3), 41) < .22 ? FC.gravelD : FC.gravel;   // Route 9: a gravel shoulder, not a sidewalk
      return (((u - S.a0) % 1.5) + 1.5) % 1.5 < .1 ? FC.joint : FC.walk; }); }
  bendPieces(ctx, I);   // stitch pass: the sidewalk wraps round the outside of a bend
  edges(ctx, I, verge);
  // WOODS (0.4 m): trees, then scatter where the ground is open
  ctx.group('woods');
  const NW = Math.round(P / .4), W = new Vol(NW, 52, NW, { s: .4, org: [I.x0, SIDE, I.z0], ground: true });   // (SPREAD: 80 cells at 32)
  for (const t of I.trees) drawTree(W, t);
  for (const [x, z, r, h] of o.carve || []) { const cx = (x - W.org[0]) / W.s, cz = (z - W.org[2]) / W.s, R = r / W.s, Hc = Math.ceil(h / W.s);   // a hero's clear space: crowns trimmed back
    for (let a = Math.floor(cx - R); a <= cx + R; a++) for (let b = Math.floor(cz - R); b <= cz + R; b++) if (Math.hypot(a + .5 - cx, b + .5 - cz) <= R) for (let y = 0; y < Hc; y++) W.del(a, y, b); }
  const sc = scatter(W, I, skip);
  meshVol(W, bank);   // full: 0.4 cubes · mid: the same cubes downsampled 2× (0.8 m: the same trees, coarser — STYLE §9)
  ctx.woods = W; ctx.info = I;
  if (!o.noFeatures) features(ctx);
  let top = 0; for (const t of I.trees) top = Math.max(top, t.h); A(ctx).roofs.push({ y: SIDE + top });   // (the stream's height for culling)
  return I;
}
const A = ctx => ctx.A;
// stitch pass · the outside of a bend (plan.js bendCorners): the sidewalk corner square and its two stubs, 0.1 m cubes like the verge, the
// curb along the quarter of the crossing square that lies in this block (road), joints every 1.5 m across each stub from the node
const outside = (v, a0, a1) => v < a0 ? a0 - v : v > a1 ? v - a1 : -1;   // how far past a span (−1: within it)
function bendPieces(ctx, I) {
  for (const b of I.bends) { const [qx0, qz0, qx1, qz1] = b.q, X = qx0 === b.x0 ? b.x0 : b.x1, Z = qz0 === b.z0 ? b.z0 : b.z1, V = ctx.volume(b.x0, 0, b.z0, b.x1, SIDE, b.z1, { walk: true });
    V.box(0, 0, 0, V.nx, V.ny, V.nz, (x, y, z) => { const wx = b.x0 + (x + .5) * .1, wz = b.z0 + (z + .5) * .1, u = outside(wx, qx0, qx1), w = outside(wz, qz0, qz1);
      if (u < 0 && w < 0) return undefined;                                   // the crossing square's quarter: road
      if ((u < 0 ? w : w < 0 ? u : Math.max(u, w)) < .2) return y ? FC.curbTop : FC.curbFace;
      const t = u < 0 ? Math.abs(wx - X) : w < 0 ? Math.abs(wz - Z) : -1;     // along the stub, from the node (the corner square has none)
      return t >= 0 && t % 1.5 < .1 && t > .5 ? FC.joint : FC.walk; }); } }
// the same in the far tier: the square less the quarter, as two boxes
function bendFar(bank, I) { const rest = (a0, a1, q0, q1) => q0 === a0 ? [q1, a1] : [a0, q0];
  for (const b of I.bends) { const [qx0, qz0, qx1, qz1] = b.q, [za, zb] = rest(b.z0, b.z1, qz0, qz1), [xa, xb] = rest(b.x0, b.x1, qx0, qx1);
    boxInto(bank, 0, b.x0, 0, za, b.x1, SIDE, zb, FC.walk, 4); boxInto(bank, 0, xa, 0, qz0, xb, SIDE, qz1, FC.walk, 4); } }
// boulders, fallen logs and stumps on a 5 m jittered grid (the same everywhere: a neighbour agrees), where the ground is open
function scatter(W, I, skip) {
  const { tracks, trails } = I.paths, out = [];
  for (let a = Math.floor(I.x0 / 5); a < Math.ceil(I.x1 / 5); a++) for (let b = Math.floor(I.z0 / 5); b < Math.ceil(I.z1 / 5); b++) {
    const u = hash(a, b, 501); if (u > .34) continue; const x = (a + .2 + hash(a, b, 502) * .6) * 5, z = (b + .2 + hash(a, b, 503) * .6) * 5;
    if (x < I.x0 + 1.4 || x > I.x1 - 1.4 || z < I.z0 + 1.4 || z > I.z1 - 1.4) continue;   // (whole in this block)
    if (openness(x, z, tracks, trails) <= 0 || onPath(x, z, tracks, trails, 1) || skip.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r + 2)) continue;
    if (I.trees.some(t => Math.hypot(t.x - x, t.z - z) < (t.sp === SP.bush ? 1.4 : 1.2))) continue;
    const k = hash(a, b, 504), sd = a * 131 + b * 7;
    if (k < .42) { const r = .5 + hash(a, b, 505) * .7; boulder(W, x, z, r, sd); out.push([x - r, 0, z - r, x + r, r, z + r, PAL_W.rock[1]]); }
    else if (k < .78) { const ax = hash(a, b, 506) < .5, L = 2.4 + hash(a, b, 507) * 3, ex = ax ? x + L : x, ez = ax ? z : z + L;
      if (ex < I.x1 - .4 && ez < I.z1 - .4 && openness(ex, ez, tracks, trails) > 0 && !onPath(ex, ez, tracks, trails, 1) && clearLine(W, x, z, L, ax)) { fallenLog(W, x, z, L, ax, sd); out.push(ax ? [x, 0, z, x + L, .8, z + .8, PAL_W.trunk] : [x, 0, z, x + .8, .8, z + L, PAL_W.trunk]); } }
    else stump(W, x, z, sd); }
  // reeds along the lake and the ponds: olive stalks, a cattail on some (freshwater shore only, on the mud)
  if (!I.dry) for (let x0 = I.x0 + .2; x0 < I.x1; x0 += .8) for (let z0 = I.z0 + .2; z0 < I.z1; z0 += .8) { const a = Math.round(x0 * 10), b = Math.round(z0 * 10), x = Math.min(I.x1 - .3, x0 + hash(a, b, 604) * .6), z = Math.min(I.z1 - .3, z0 + hash(a, b, 605) * .6), e = I.eAt(x, z);
    if (e < .15 || e > 1.3 || !lakeSide(x, z) || hash(a, b, 601) > .28 || onPath(x, z, tracks, trails, .5) || skip.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r)) continue;
    const cx = Math.floor((x - W.org[0]) / W.s), cz = Math.floor((z - W.org[2]) / W.s), h = 2 + (hash(a, b, 602) * 2 | 0); if (W.has(cx, 0, cz)) continue;
    for (let y = 0; y < h; y++) W.set(cx, y, cz, y === h - 1 && hash(a, b, 603) < .5 ? 0x6b4526 : y % 2 ? 0x7f9a3a : 0x6a8a30); }
  return out;
}
const clearLine = (W, x, z, L, ax) => { const cx = Math.floor((x - W.org[0]) / W.s), cz = Math.floor((z - W.org[2]) / W.s), n = Math.round(L / W.s); for (let q = -1; q <= n; q++) for (let w = -1; w <= 2; w++) for (let y = 0; y < 3; y++) if (ax ? W.has(cx + q, y, cz + w) : W.has(cx + w, y, cz + q)) return false; return true; };

// ── the woods' edge behind the verge: one treatment per side (handmade: neighbours differ), open where a path comes out
const EDGE = ['stone', 'rail', 'hedge', 'chain', 'stone', 'rail', 'open'];
export function edgeKind(I, S) { if (S.hwy || S.hw >= 7) return 'guard'; const n = EDGE.length, h = hash(I.i * 3 + (S.ax === 'x' ? 1 : 0), I.j * 5 + (S.dir > 0 ? 1 : 0), 777); return EDGE[(h * n) | 0]; }
function edges(ctx, I, verge) {
  ctx.group('edge');
  for (const v of verge) { const S = v.S, kind = edgeKind(I, S); if (kind === 'open') continue;
    const dw = kind === 'guard' ? 0 : S.sw - 2, d0 = (kind === 'hedge' ? 2.1 : kind === 'guard' ? .35 : 2.05) + dw, d1 = (kind === 'hedge' ? 2.9 : kind === 'stone' ? 2.65 : kind === 'guard' ? .75 : 2.35) + dw, H = kind === 'stone' ? .7 : kind === 'hedge' ? .9 : kind === 'rail' ? .9 : kind === 'chain' ? 1.5 : .8;   // (SPREAD: dw, behind the side's own walk; the guardrail keeps to the kerb)
    // the run along the side, cut where a track, a trail or the corner walkers' lines need the gap
    const along = S.ax === 'x' ? [v.x0, v.x1] : [v.z0, v.z1], at = u => S.ax === 'x' ? [u, S.cur + S.dir * (d0 + d1) / 2] : [S.cur + S.dir * (d0 + d1) / 2, u];
    let runs = [[along[0] + (kind === 'guard' ? 3 : .6), along[1] - (kind === 'guard' ? 3 : .6)]];
    for (let u = along[0]; u < along[1]; u += .5) { const [x, z] = at(u); if (distTo(x, z, I.paths.tracks)[0] < 3.2 || distTo(x, z, I.paths.trails)[0] < 1.6 || (kind !== 'guard' && roadDist(x, z) < d0 - .01)) runs = runs.flatMap(([a, b]) => u < a || u > b ? [[a, b]] : [[a, u - .5], [u + .5, b]]).filter(([a, b]) => b - a > 1.2); }
    for (const [a, b] of runs) { const [xa, za] = S.ax === 'x' ? [a, S.dir > 0 ? S.cur + d0 : S.cur - d1] : [S.dir > 0 ? S.cur + d0 : S.cur - d1, a], [xb, zb] = S.ax === 'x' ? [b, S.dir > 0 ? S.cur + d1 : S.cur - d0] : [S.dir > 0 ? S.cur + d1 : S.cur - d0, b];
      const V = ctx.volume(xa, SIDE, za, xb, SIDE + H + .3, zb, { keep: kind === 'guard' ? 'guardrail' : 'edge' }); drawEdge(V, kind, S, I); } }
}
function drawEdge(V, kind, S, I) {
  const n = S.ax === 'x' ? V.nx : V.nz, dth = S.ax === 'x' ? V.nz : V.nx, set = (u, y, d, c) => S.ax === 'x' ? V.set(u, y, d, c) : V.set(d, y, u, c), u0 = S.ax === 'x' ? V.org[0] : V.org[2];
  const post = (u, every, w) => { const wu = u0 + (u + .5) * .1; return (((wu % every) + every) % every) < w; };
  if (kind === 'stone') { const C = [0x9a968e, 0x857f77, 0xb3aea4, 0x6f6a64];   // fieldstones, 0.2 m, a flat cap, a few gaps where one fell out
    for (let u = 0; u < n; u++) for (let d = 0; d < dth; d++) for (let y = 0; y < 7; y++) { const st = hash(Math.floor((u0 / .1 + u + (y >> 1) * 3) / 3), y >> 1, d >> 2);
      if (y === 6) { set(u, y, d, 0xc9c4ba); continue; } set(u, y, d, C[(st * 4) | 0]); } }
  if (kind === 'hedge') { for (let u = 0; u < n; u++) for (let d = 0; d < dth; d++) for (let y = 0; y < 9; y++) { if ((d === 0 || d === dth - 1 || y === 8) && hash(u0 / .1 + u, y, d) < .12) continue; set(u, y, d, y === 8 ? 0x3c8f43 : (u + y + d) % 3 === 0 ? 0x245e2c : 0x2e7236); } }
  if (kind === 'rail') { const Wd = 0x8f6a44, Wl = 0xa98158; for (let u = 0; u < n; u++) { const p = post(u, 2.4, .15) || u === 0 || u === n - 1;
      for (let d = 1; d < dth - 1; d++) { if (p) for (let y = 0; y < 9; y++) set(u, y, d, Wd); for (const y of [4, 8]) set(u, y, d, (u >> 3) & 1 ? Wl : Wd); } } }
  if (kind === 'chain') { const G = 0xb9bcc4, Pc = 0x8f9096, torn = hash(I.i, I.j, 91) < .5 ? Math.floor(n * (.3 + hash(I.i, I.j, 92) * .4)) : -99;
    for (let u = 0; u < n; u++) { const p = post(u, 2.5, .1) || u === 0 || u === n - 1, sag = Math.abs(u - torn) < 12 ? Math.round(6 * Math.cos((u - torn) / 12 * 1.57)) : 0;
      for (let y = 0; y < 15 - (p ? 0 : sag); y++) { const c = p ? Pc : y === 14 - sag ? 0x9a9ca4 : ((u + y) & 1) ? G : undefined; if (c !== undefined) set(u, y, 1, c); } } }
  if (kind === 'guard') { const G = 0xc9ccd2, Pc = 0x8a8d94, rd = S.dir > 0 ? 0 : dth - 1; for (let u = 0; u < n; u++) { const p = post(u, 1.9, .15);   // the W-beam on the road side, posts behind it
      for (let d = 0; d < dth; d++) { if (p && d !== rd && Math.abs(d - rd) <= 2) for (let y = 0; y < 7; y++) set(u, y, d, Pc); if (d === rd) for (let y = 4; y < 7; y++) set(u, y, d, y === 5 ? shade(G, .88) : G); } } }
}

// ── the far tier (0.5 m cubes): the floor as flat quads (merged rects of 1 m cells), the verge, the same trees
export function woodsFar(ctx, o = {}) {
  const I = blockInfo(ctx.i, ctx.j), verge = vergeStrips(I);
  let top = 0; for (const t of I.trees) top = Math.max(top, t.h);
  if (o.draw) o.draw(ctx, I);
  const bank = ctx.bank; ctx.maxH = Math.max(ctx.maxH, top + 1);
  const rect = [I.x0, I.z0, I.x1, I.z1]; for (const t of I.trees) drawBoxes(bank, treeBoxes(t, .5, 3), rect, SIDE, air, eps(t));
  ctx.maxH = Math.max(ctx.maxH, heroFar(bank, ctx.i, ctx.j, air) + 1);
  // floor: 1 m cells (water, asphalt and the pits left out), merged into rects of one colour
  const N = Math.round(P), G = new Int32Array(N * N); for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const c = floorAt(I, I.x0 + a + .5, I.z0 + b + .5, verge); G[a * N + b] = c ? c + 1 : 0; }   // (SPREAD: 1 m cells over the block: 32 at 32)
  const done = new Uint8Array(N * N);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const c = G[a * N + b]; if (!c || done[a * N + b]) continue; let w = 1, h = 1;
    while (a + w < N && G[(a + w) * N + b] === c && !done[(a + w) * N + b]) w++;
    outer: for (; b + h < N; h++) for (let q = 0; q < w; q++) if (G[(a + q) * N + b + h] !== c || done[(a + q) * N + b + h]) break outer;
    for (let q = 0; q < w; q++) for (let r = 0; r < h; r++) done[(a + q) * N + b + r] = 1;
    boxInto(bank, 0, I.x0 + a, 0, I.z0 + b, I.x0 + a + w, SIDE, I.z0 + b + h, c - 1, 4); }
  for (const v of verge) boxInto(bank, 0, v.x0, 0, v.z0, v.x1, SIDE, v.z1, v.S.hwy ? FC.gravel : FC.walk, 4 | (v.S.k === 'N' ? 32 : v.S.k === 'S' ? 16 : v.S.k === 'W' ? 2 : 1));
  bendFar(bank, I); ctx.maxH = Math.max(ctx.maxH, landingFar(bank, ctx.i, ctx.j, air));   // stitch pass: a bend's corner, the ferry landing
  return I;
}
