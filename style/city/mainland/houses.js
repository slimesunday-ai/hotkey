// MAINLAND v1 · the houses (candidate A's six, parameterised: wall, glass garage, car; plus B's two modernists via modern.js and a
// yard pass that fences, hedges and dresses every lot to its real edges, pie lots included). Worker-safe. Originally A (copied ideas from districts/suburbs/house.js, rebuilt here:
// nothing in the city is edited). Every house is drawn in its LOT's local frame, in metres: x across the frontage (−W/2 … W/2, +x is
// the right as seen from the street), z from the front lot line (0) back into the lot (negative), y up from the lawn (0.2 in world).
// The street is at +z. A lot is meshed to its own Bank and stamped into the world at the lot's angle (stampA), so pie lots round the
// bulb face the turnaround. Upgrades over Pleasantview: sherbet walls (the palette lifted toward cream, still toon-saturated), bright
// trim, porches, dormers, a hoop over every other garage, and one showpiece (a trophy on the roof).
import { Vol, Bank, meshVol, stamp, stampA } from '../vox.js';
import { frame, win, AIR, TOD } from '../kit.js';
import { PAL, CV, hash, shade } from '../style.js';
import { mailbox, flamingos, gnomes, toys, bin, planter, trampoline, lemonade, tree, swingset, birdbath } from '../districts/suburbs/props.js';
import { bike } from '../props.js';
import { vehicleProp } from '../vehicles/index.js';
import { garden, barn, playhouse, clothesline, doghouse, pool as agPool, patio, woodpile, firepit, windmill } from '../districts/suburbs/props.js';
import { acBox, lawnChair, grill, umbrella } from '../props.js';
import { buildModern, MODERN } from './modern.js';
import { YARD, WALLS, ROOFS, ACCENTS, CELL, houseRects, houseFront, runsOf, EDGES, bankOf, stampAt, argsOf, defaultHouse, doorZone, DRIVE, WALK, hullOf, clearSpot, CLEAR, edgeDist, SPRINKLER_TOP, inFront } from './yard.js';
import { lotLawn, vn } from './lawn.js';
// HOUSE BUILDER (2026-10-06): a lot can also be CUSTOM (spec.custom = { house, yard }, the owner's, from the builder): the house is built
// BARE (no drive, walk, front fence or dressing: the yard owns those), with the kit's options (roof colour, garage, porch, dormers, pool,
// accent, the showpiece on the roof) and shifted (hx along the frontage, hz deeper), and the yard is drawn from data (yard.js: edge
// runs, path cells, pieces). Generated lots draw exactly as before; their dressing is also recorded (A.dress, A.edges) so the builder
// can seed an owner's first edit from the look they saw.

export const LAWN = 0.2;                                          // lawn / sidewalk top in world metres
const TRIM = 0xfffaf0, INK = PAL.ink, FOUND = 0xb9b3a8, CONC = 0xdcd6c9, BRICK = 0xb4553c, GOLD = 0xe7bd4a, WOOD = 0xb07a45;
export const ROOF = { choc: 0x6e5244, slate: 0x62656f, char: 0x4f4e57, warm: 0x8c7568, grey: 0x8f8e96 };
export const SHERBET = { coral: 0xff8a5c, butter: 0xffd23f, sky: 0x58b7f7, mint: 0x3fd0a0, lilac: 0xa57cff, pink: 0xff6fae, white: 0xf4f1ea, cobalt: 0x2f5bff };
const litWin = (k) => TOD.night && hash(k, 77) > .22;             // homes are mostly lit at night (warm, lived in)

// ── a lot-local volume in metres
let BARE = false, CTX = null, CHIM = [];   // a custom build in progress: the bare house, its put/A, the chimneys (the showpiece avoids them)
export class LV {
  constructor(x0, z0, x1, z1, h) { this.ox = x0; this.oz = z0; this.V = new Vol(Math.round((x1 - x0) * 10), Math.round(h * 10), Math.round((z1 - z0) * 10), { s: CV, org: [x0, 0, z0], ground: true }); }
  X(m) { return Math.round((m + (this.dx || 0) - this.ox) * 10); } Z(m) { return Math.round((m + (this.dz || 0) - this.oz) * 10); }
  box(x0, y0, z0, x1, y1, z1, c, l = 0) { this.V.box(this.X(x0), Math.round(y0 * 10), this.Z(z0), this.X(x1), Math.round(y1 * 10), this.Z(z1), c, l); }
  set(x, y, z, c, l = 0) { this.V.set(this.X(x), Math.round(y * 10), this.Z(z), c, l); }
  face([x0, z0, x1, z1], side) { return frame(this.V, { x0: this.X(x0), x1: this.X(x1), z0: this.Z(z0), z1: this.Z(z1) }, side); }
}
// ── walls: one flat colour with lap-siding lines, a foundation band, white corner boards
function body(L, [x0, z0, x1, z1], h, wall, o = {}) {
  const fy = o.found ?? 4, lap = o.lap ?? true, line = shade(wall, .92);
  L.box(x0, 0, z0, x1, h, z1, (x, y) => y < fy ? FOUND : (lap && y % 3 === 0) ? line : wall);
  if (o.corners !== false) for (const [a, b] of [[x0, z1 - .2], [x1 - .2, z1 - .2], [x0, z0], [x1 - .2, z0]]) L.box(a, fy / 10, b, a + .2, h, b + .2, o.trim ?? TRIM);
}
// ── roofs (voxel steps; ported from house.js roofAlong / roofHip). axis 'x': ridge along x (slopes face the street); 'z': gable to the street
function gable(L, [x0, z0, x1, z1], y0m, axis, col, o = {}) {
  const V = L.V, ov = o.ov ?? 3, ovg = o.ovg ?? 2, fill = o.fill, steps = o.steps ?? (() => [o.rise ?? 1, o.run ?? 2]);
  const [A0, A1, B0, B1] = axis === 'x' ? [L.Z(z0), L.Z(z1), L.X(x0), L.X(x1)] : [L.X(x0), L.X(x1), L.Z(z0), L.Z(z1)];
  const put = (p, q, r0, r1, y, h, c) => { if (q <= p) return; if (axis === 'x') V.box(r0, y, p, r1, y + h, q, c); else V.box(p, y, r0, q, y + h, r1, c); };
  let y = Math.round(y0m * 10), aa = A0 - ov, ab = A1 + ov, k = 0;
  while (ab - aa > 0 && k < 200) { const [rise, run] = steps(k), t = Math.max(2, run + 1), c = k === 0 ? (o.fascia ?? TRIM) : (k % 2 ? shade(col, .9) : col), top = ab - aa <= 2 * t;
    put(aa, Math.min(ab, aa + t), B0 - ovg, B1 + ovg, y, rise, c); put(Math.max(aa, ab - t), ab, B0 - ovg, B1 + ovg, y, rise, c);
    if (!top) put(Math.max(aa + t, A0), Math.min(ab - t, A1), B0, B1, y, rise, fill);
    y += rise; aa += run; ab -= run; k++; }
  return y / 10;
}
function hip(L, [x0, z0, x1, z1], y0m, col, o = {}) {
  const V = L.V, ov = o.ov ?? 3, rise = o.rise ?? 1, run = o.run ?? 2; let y = Math.round(y0m * 10), k = 0;
  for (let ua = L.X(x0) - ov, ub = L.X(x1) + ov, va = L.Z(z0) - ov, vb = L.Z(z1) + ov; ub > ua && vb > va; ua += run, ub -= run, va += run, vb -= run, k++, y += rise)
    V.box(ua, y, va, ub, y + rise, vb, k === 0 ? (o.fascia ?? TRIM) : (k % 2 ? shade(col, .9) : col));
  return y / 10;
}
// ── openings (kit.js frames: a along the wall in voxels, y up, d out of the wall)
const W1 = (f, a, y, w = 12, h = 16, trim = TRIM, o = {}) => win(f, a, y, w, h, trim, { lit: litWin(a * 7 + y + f.len), ...o });
function shutters(f, a, y, w, h, c) { for (const s of [a - 6, a + w + 2]) f.box(s, y - 1, 0, s + 4, y + h + 1, 2, (aa, yy) => (yy - y) % 4 === 1 ? shade(c, .85) : c); }
function door(f, a, col, o = {}) {
  const y = o.y ?? 4, w = o.w ?? 12, h = 24;
  f.box(a - 2, y, 0, a + w + 2, y + h + 2, 2, o.trim ?? TRIM); f.box(a, y, -2, a + w, y + h, 2, AIR);
  f.box(a, y, -3, a + w, y + h, -2, (aa, yy) => (yy - y) % 8 === 7 || aa === a + 1 || aa === a + w - 2 ? shade(col, .82) : col);
  f.set(a + w - 3, y + 11, -2, GOLD, 2);
  if (o.glassTop) f.box(a + 2, y + h - 6, -3, a + w - 2, y + h - 2, -2, TOD.night ? PAL.litHi : PAL.glassHi, TOD.night ? 3 : 1);
  if (y > 1) { f.box(a - 4, 0, 1, a + w + 4, y, 10, CONC); f.box(a - 2, 0, 10, a + w + 2, Math.max(1, y - 2), 14, CONC); }   // landing + step
  if (o.lamp !== false) f.box(a + w + 3, y + 16, 1, a + w + 5, y + 20, 3, TOD.night ? 0xffe3a0 : 0xfff1c8, TOD.night ? 3 : 0);   // porch lantern
}
function garageDoor(f, a, w, col, trim = TRIM) {
  f.box(a - 2, 1, 0, a + w + 2, 26, 2, trim); f.box(a, 1, -2, a + w, 24, 2, AIR);
  f.box(a, 1, -3, a + w, 24, -2, (aa, yy) => (yy % 6 === 5) ? shade(col, .84) : ((aa - a) % 24 === 0 ? shade(col, .9) : col));
  if (col !== INK) f.box(a + 3, 18, -2, a + w - 3, 21, -1, TOD.night ? PAL.litLo : PAL.glassHi, TOD.night ? 3 : 1);   // the little window row
}
// the hoop over the garage: a white backboard with the red square, an orange rim, a white net (the garage gable carries it)
function hoopOn(f, a, y) {
  f.box(a, y, 1, a + 14, y + 9, 2, 0xf7f7f2); f.box(a + 4, y + 1, 2, a + 10, y + 5, 3, (aa, yy) => (aa === a + 4 || aa === a + 9 || yy === y + 1 || yy === y + 4) ? 0xe8232a : undefined);
  f.box(a + 6, y - 1, 1, a + 8, y + 1, 3, INK);
  for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2; f.set(a + 7 + Math.round(Math.cos(t) * 2.6), y - 1, 5 + Math.round(Math.sin(t) * 2.4), 0xff6a1a, 2); }
  for (let yy = y - 5; yy < y - 1; yy++) for (const [dx, dd] of [[-2, 5], [2, 5], [0, 3], [0, 7]]) if ((yy + dx) & 1) f.set(a + 7 + dx, yy, dd, 0xf7f7f2);
}
function chimney(L, x, z, top) { CHIM.push([x, z]); L.box(x, 0, z, x + .9, top, z + .9, (xx, y) => y % 3 === 0 ? shade(BRICK, .85) : BRICK); L.box(x - .1, top - .3, z - .1, x + 1, top, z + 1, shade(BRICK, .7)); }
function porch(L, x0, x1, zf, dep, h, roofCol, o = {}) {
  const zb = zf + dep; L.box(x0, 0, zf, x1, .5, zb, o.floor ?? 0xd9cdb8);
  for (let x = x0; x <= x1 - .3 + 1e-6; x += (x1 - x0 - .3) / Math.max(1, Math.round((x1 - x0) / 2.6))) L.box(x, .5, zb - .35, x + .3, h, zb - .05, TRIM);
  L.box(x0 - .2, h, zf, x1 + .2, h + .3, zb + .25, TRIM); L.box(x0 - .1, h + .3, zf, x1 + .1, h + .5, zb + .15, roofCol);
  if (o.rail !== false) for (const [a, b] of [[x0 + .3, (o.gap ?? x0 + (x1 - x0) / 2) - .8], [(o.gap ?? x0 + (x1 - x0) / 2) + .8, x1 - .3]]) { L.box(a, 1.3, zb - .3, b, 1.4, zb - .1, TRIM); for (let x = a; x < b; x += .3) L.box(x, .5, zb - .25, x + .1, 1.3, zb - .15, TRIM); }
}
function picket(L, x0, x1, z, gap0, gap1) { if (BARE) return; for (let x = x0; x < x1; x += .2) { if (x > gap0 && x < gap1) continue; const tall = Math.round((x - x0) * 5) % 2 === 0; L.box(x, 0, z, x + .1, tall ? 1.0 : .9, z + .1, TRIM); }
  for (const [a, b] of [[x0, gap0], [gap1, x1]]) { L.box(a, .3, z - .1, b, .4, z, TRIM); L.box(a, .7, z - .1, b, .8, z, TRIM); } }
function fence(L, pts, col = 0xd9c7a4) {   // a board fence along lot-local polyline (axis-aligned runs), 1.6 m
  for (let k = 0; k + 1 < pts.length; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    if (az === bz) L.box(Math.min(ax, bx), 0, az - .1, Math.max(ax, bx), 1.6, az, (x) => x % 3 === 0 ? shade(col, .88) : col);
    else L.box(ax - .1, 0, Math.min(az, bz), ax, 1.6, Math.max(az, bz), (x, y, z) => z % 3 === 0 ? shade(col, .88) : col); } }
function hedge(L, x0, z0, x1, z1) { L.box(x0, 0, z0, x1, 1.0, z1, (x, y, z) => hash(x, y * 3, z) > .75 ? 0x2a9a48 : 0x33ad52); }
function shrubs(L, x0, x1, z, skip = []) { for (let x = x0; x < x1 - .5; x += .9) { if (skip.some(([a, b]) => x + .8 > a && x < b)) continue; const h = .5 + hash(x * 10 | 0, z * 10 | 0) * .35;
  soft(x + (L.dx || 0), z + (L.dz || 0), x + .8 + (L.dx || 0), z + .8 + (L.dz || 0), h);
  L.box(x, 0, z, x + .8, h, z + .8, (xx, y, zz) => hash(xx, y, zz) > .88 ? [0xff4fa3, 0xffe23a, 0xf7f7f2][(hash(zz, xx) * 3) | 0] : (y > h * 10 - 2 ? 0x3cbc5a : 0x2e9f4a)); } }
function walkPath(L, x0, x1, z0, z1) { if (BARE) return; for (let z = z0; z < z1; z += .6) L.box(x0, 0, z, x1, .05, Math.min(z1, z + .5), CONC); }
// the driveway (MAINLAND LAWNS): joints every 3 m, oil where the car stands, a hairline crack or two, tyre-darkened lanes (voxel-snapped)
export function driveCol(x, y, z) { if (z % 30 === 0) return 0xc9c2b4; const n = vn(x / 7, z / 7, 71);
  if (n > .76) return n > .83 ? (hash(x, z, 74) > .3 ? 0x9f988c : 0xb3ac9f) : (hash(x, z, 75) > .55 ? 0xbcb5a8 : 0xd0c9bb);
  if (vn(x / 11, z / 11, 73) > .62 && Math.abs(((x + z * .6 + 4000) % 41) - 20) < .6) return 0xb3ac9f;
  return hash(x >> 2, z >> 1, 76) > .9 ? 0xd0c9bb : 0xd8d1c3; }
function drive(L, x0, x1, z0, z1) { if (BARE) return; L.box(x0, 0, z0, x1, .05, z1, driveCol); }
// a yard piece the generated look puts down: recorded (A.dress, where it was stamped) and, unless the build is bare, stamped.
// MAINLAND FIXES (2026-10-06): it's SETTLED first: its whole footprint (a tree's crown, not just its trunk) is pushed in clear of the lot's
// lines (yard.js clearSpot: out of the fences, the hedges and the neighbour's lot); a tree that would have to move far for it steps down a
// size (the narrow pie lots), and a piece that still can't stand clear (or would land on a piece already down) is left out.
// WALK-THROUGH DECOR (MAINLAND FIXES 2026-10-06 · slime: "you should be able to walk through [the sprinkler water]"): what's only
// decor at your feet (the flower beds along the house, a veggie bed, the hose and its reel, a sprinkler's head) is recorded as SOFT, lot
// frame [x0, z0, x1, z1, h]: walk mode leaves anything no taller than h there out of its walls (walkgrid.js), so you wade through the
// beds and the water while the fences, the trees, the cars and the furniture stay solid. (The mulch, puddles, leaves and the wet patch
// are painted on the lawn, and the water and the tufts aren't in the walk grid at all.)
const SOFT = new Set(['garden', 'sprinkler']), topMemo = new Map();
function soft(x0, z0, x1, z1, h) { CTX?.A && (CTX.A.soft ??= []).push([+x0.toFixed(2), +z0.toFixed(2), +x1.toFixed(2), +z1.toFixed(2), Math.ceil(h * 10 - 1e-6) / 10 + .05]); }   // (h to the voxel it rounds to)
function softPiece(id, a, rot, x, z) { if (!SOFT.has(id)) return; const hull = hullOf(YARD[id].make(...a), rot, id + ':' + JSON.stringify(a));
  soft(x + Math.min(...hull.map(p => p[0])), z + Math.min(...hull.map(p => p[1])), x + Math.max(...hull.map(p => p[0])), z + Math.max(...hull.map(p => p[1])), topOf(id, a) + .02); }
const FREE = new Set(['mailbox', 'bins', 'car']);   // (the curb pieces, and the car on its drive, stand where they're put)
const NEAR = [[0, 0]]; for (let r = .5; r <= 2.51; r += .5) for (let k = 0, n = Math.round(r * 6); k < n; k++) NEAR.push([Math.cos(k / n * 6.283) * r, Math.sin(k / n * 6.283) * r]);
const inR = (px, pz, R, m) => R.some(([x0, z0, x1, z1]) => px > x0 - m && px < x1 + m && pz > z0 - m && pz < z1 + m);
const topOf = (id, a) => { const k = id + ':' + JSON.stringify(a); if (!topMemo.has(k)) { let t = 0; for (const O of YARD[id].make(...a).L) for (let i = 1; i < O.P.n; i += 3) t = Math.max(t, O.P.a[i]); topMemo.set(k, t); } return topMemo.get(k); };
// (CTX.placed: [x, z, footing, tall, crown] — a tree's footing is its trunk, its crown overhead; tall: a shed, a swing set, the statue)
function settle(id, x, z, rot, args) { const P = CTX.poly; if (!P || FREE.has(id)) return [x, z, args]; if (id === 'tree') return settleTree(x, z, rot, args);
  const hull = hullOf(YARD[id].make(...args), rot, id + ':' + JSON.stringify(args)), reach = Math.max(...hull.map(([u, v]) => Math.hypot(u, v))), foot = Math.min(1.6, reach * .8), tall = topOf(id, args) > 1.5; let best = null;
  for (const [ox, oz] of NEAR) { const [sx, sz2, c] = clearSpot(P, hull, x + ox, z + oz); if (c < CLEAR - .02) continue; const mv = Math.hypot(sx - x, sz2 - z); if (best && mv >= best.mv) continue;
    // (moved: it mustn't land on a piece already down, under a tree if it's tall, on the drive or the walk, nor into the house)
    if (mv > .05 && (CTX.placed.some(([px, pz, pr, ptall, crown]) => Math.hypot(px - sx, pz - sz2) < (tall ? crown * .85 : pr) + foot) || inR(sx, sz2, CTX.flat, foot) || inR(sx, sz2, CTX.rects, foot + .2))) continue;
    best = { x: sx, z: sz2, mv }; if (mv <= .05) break; }
  if (!best) return null; CTX.placed.push([best.x, best.z, foot, tall, foot]); return [best.x, best.z, args]; }
// TREES (follow-up 2026-10-06: "the big tree now stands right in front of the porch"): a tree keeps its fence clearance and stays out of
// the house's front (yard.js frontKeep: the door, the walk, the drive's mouth, the facade's sight line). In order: its own spot (pushed in
// from the lines by at most a metre) with its own crown, a smaller one, a narrower species; else, once the rest of the yard is down, the
// nearest free spot on the lot (a side yard, a back corner, by the kerb) with the same preferences; only then is it left out.
const NARROW = [['birch', 1], ['birch', 0], ['maple', 0]];
function treeOpts([sp, sz, v]) { const out = []; for (let s = sz | 0; s >= 0; s--) out.push([sp, s, v]); for (const [n, s] of NARROW) if (s <= (sz | 0) + 1 && !out.some(o => o[0] === n && o[1] === s)) out.push([n, s, v]); return out; }
function treeAt(a, rot, x, z, maxMove) { const hull = hullOf(YARD.tree.make(...a), rot, 'tree:' + JSON.stringify(a)), reach = Math.max(...hull.map(([u, v]) => Math.hypot(u, v)));
  const [sx, sz, c] = clearSpot(CTX.poly, hull, x, z); if (c < CLEAR - .02 || Math.hypot(sx - x, sz - z) > maxMove) return null;
  if (CTX.H && inFront(CTX.H, sx, sz, reach)) return null;
  if (CTX.placed.some(([px, pz, pr, tall, crown]) => { const d = Math.hypot(px - sx, pz - sz); return d < pr + .45 || (tall && d < pr + reach * .85) || (crown > pr && pr < .5 && d < (crown + reach) * .6); })) return null;
  if (inR(sx, sz, CTX.flat, .45) || inR(sx, sz, CTX.rects, reach * .85 + .2)) return null;
  return { x: sx, z: sz, a, reach }; }
function settleTree(x, z, rot, args, late = false) { const opts = treeOpts(args), keep = t => { CTX.placed.push([t.x, t.z, .45, false, t.reach]); return [t.x, t.z, t.a]; };
  for (const a of opts) { const t = treeAt(a, rot, x, z, 1); if (t) return keep(t); }
  if (!late) { CTX.later.push([x, z, rot, args]); return 'later'; }
  const P = CTX.poly, xs = P.map(p => p[0]), zs = P.map(p => p[1]); let best = null;
  opts.forEach((a, k) => { for (let gx = Math.min(...xs); gx <= Math.max(...xs); gx += .5) for (let gz = Math.min(...zs); gz <= 0; gz += .5) { const sc = Math.hypot(gx - x, gz - z) + 2 * k; if (best && sc >= best.sc) continue;
    const t = treeAt(a, rot, gx, gz, .3); if (t) best = { ...t, sc }; } });
  return best ? keep(best) : null; }
function commit(id, [wx, wz, a], rot) { const L = CTX.L; CTX.A.dress.push({ id, args: a, x: wx, z: wz, rot });
  if (!BARE) { CTX.put(YARD[id].make(...a), wx - (L.dx || 0), wz - (L.dz || 0), rot); softPiece(id, a, rot, wx, wz); } }
function dress(id, x, z, rot = 0, ...args) { const L = CTX.L, s = settle(id, x + (L.dx || 0), z + (L.dz || 0), rot, args); if (s && s !== 'later') commit(id, s, rot); }
// the trees that couldn't stand at their own spot, placed last (lot frame; L.dx is 0 by now)
function lateTrees() { for (const [x, z, rot, args] of CTX.later.splice(0)) { const s = settleTree(x, z, rot, args, true); if (s) commit('tree', s, rot); } }
// the sprinkler: the head is stamped, its water is animated on the page (A.sprinklers → sprinklers.js), so you walk through the spray
function sprk(L, x, z) { dress('sprinkler', x, z, 0); }

// ── the glass garage on an A house: the garage body hollowed into a lit showroom, the car nose-out behind one pane (main.js draws the
// panes, one instanced glass mesh for the whole map); G = [x0, z0, x1, z1] with z1 the street face
function showroom(L, put, A, G, h, wall, car) {
  const [x0, z0, x1, z1] = G, N = TOD.night;
  L.box(x0 + .3, .1, z0 + .3, x1 - .3, h - .35, z1 + .05, AIR);
  L.box(x0 + .3, 0, z0 + .3, x1 - .3, .1, z1, N ? 0xfff4dc : 0xe9e6df, N ? 3 : 0);
  L.box(x0 + .8, h - .45, z0 + .8, x1 - .8, h - .35, z1 - .8, N ? 0xfff2d6 : 0xf7f7f2, N ? 3 : 0);
  L.box(x0 + .3, .1, z0 + .3, x1 - .3, 2.4, z0 + .5, (x, y) => y % 6 === 0 ? 0xd3d4d7 : 0xf4f1ea);
  L.box(x0 - .1, 0, z1 - .15, x0 + .35, h, z1 + .1, TRIM); L.box(x1 - .35, 0, z1 - .15, x1 + .1, h, z1 + .1, TRIM); L.box(x0 - .1, h - .4, z1 - .15, x1 + .1, h - .2, z1 + .1, TRIM);
  put(vehicleProp(car.id, { variant: car.v | 0, kind: 'car' }), (x0 + x1) / 2, (z0 + z1) / 2 + .2, 0, .1);
  (A.panes ??= []).push([x0 + .35, .1, z1 - .1, x1 - .35, h - .4, z1 - .02]); (A.lights ??= []).push([(x0 + x1) / 2, h - .8, (z0 + z1) / 2]);
}
// ── the yard pass: the lot's real edges (pie lots are wedges) get a fence or a hedge from the house front back, a low hedge or nothing
// in front, a back fence; the back yard gets a shed, a bed, one thing to play on, the hose, the bins; side yards an AC unit or a woodpile
function edge(L, [ax, az], [bx, bz], h, kind, col, gaps = [], skip = null) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / .1));
  for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (gaps.some(([g0, g1]) => t > g0 && t < g1) || skip?.(x, z)) continue;
    if (kind === 'hedge') L.box(x - .35, 0, z - .35, x + .35, h, z + .35, (xx, y, zz) => y >= h * 10 - 1 ? 0x3cbc5a : hash(xx >> 1, y >> 1, zz >> 1) > .78 ? 0x27954a : 0x2fa84f);
    else if (kind === 'picket') { if (k % 2 === 0) L.box(x - .05, 0, z - .05, x + .05, h, z + .05, TRIM); L.box(x - .05, h * .35, z - .05, x + .05, h * .35 + .1, z + .05, TRIM); L.box(x - .05, h * .75, z - .05, x + .05, h * .75 + .1, z + .05, TRIM); }
    else L.box(x - .06, 0, z - .06, x + .06, h, z + .06, k % 3 === 0 ? shade(col, .86) : col); }
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const inset = (P, c, d) => { const dx = c[0] - P[0], dz = c[1] - P[1], l = Math.hypot(dx, dz) || 1; return [P[0] + dx / l * d, P[1] + dz / l * d]; };
// the hose: a green reel on the house wall's spigot, the hose snaking out across the lawn to a sprinkler
function hose(L, x, z, dir, seed) { soft(x - .35, z - .3, x + .35, z + .25, .75); L.box(x - .3, 0, z - .2, x + .3, .15, z + .2, 0x8a9099); L.box(x - .05, .15, z - .05, x + .05, .7, z + .05, 0x8a9099);
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; L.box(x + Math.cos(a) * .25 - .05, .45 + Math.sin(a) * .25, z - .15, x + Math.cos(a) * .25 + .05, .55 + Math.sin(a) * .25, z + .15, 0x2f9a48); }
  let px = x, pz = z - .3; for (let k = 0; k < 40; k++) { px += dir * .12; pz += Math.sin(k * .5 + seed) * .12 - .06; L.box(px - .05, 0, pz - .05, px + .05, .08, pz + .05, 0x2f9a48); }
  return [px, pz]; }
const FENCE = [0xd9c7a4, 0xf4f1ea, 0xc9c3b6, 0xb98b57], SHED = [0xc9c3b6, 0xe6e1d6, 0xa7a9b1, 0xe8232a, 0x9b4f3a];
// per style: the house's back (z), its front (z), its side extents (x) and the x shift that centres it on a narrower lot
export const STYLE = {
  springfield: { back: -16.2, front: -6.2, x0: -9.6, x1: 9.6, dx: 0, drive: [3.1, 8.6] },
  trophy: { back: -18.5, front: -6.6, x0: -10.4, x1: 9.5, dx: .3, drive: [4.6, 9.2] },
  cape: { back: -15.3, front: -7, x0: -6.6, x1: 10, dx: -1.6, drive: [7, 10] },
  porch: { back: -17.8, front: -5.4, x0: -5.6, x1: 9, dx: -1.6, drive: [5.5, 9] },
  ranch: { back: -15.3, front: -6.6, x0: -9.8, x1: 9.8, dx: 0, drive: [3.6, 9] },
  gambrel: { back: -16.3, front: -6.8, x0: -10.3, x1: 7.6, dx: 1.3, drive: [-9.7, -5] },
  slab: { back: -23.2, front: -2.8, x0: -9.2, x1: 9.2, dx: 0, drive: [3.8, 8.4] },
  butterfly: { back: -22.4, front: -2.4, x0: -9.8, x1: 9.8, dx: 0, drive: [4.8, 9.2] },
};
function yard(L, put, A, S) {
  const h = k => hash(S.seed * 7 + 3, k * 13 + 1), [FL, FR, BR, BL] = S.poly, st = STYLE[S.style], dx = st.dx, fz = st.front + .4, bz = st.back;
  const at = (P0, P1, z) => lerp2(P0, P1, Math.max(0, Math.min(1, (z - P0[1]) / (P1[1] - P0[1]))));
  const c = [(FL[0] + FR[0] + BR[0] + BL[0]) / 4, (FL[1] + FR[1] + BR[1] + BL[1]) / 4];
  const fcol = FENCE[(h(1) * 4) | 0], side = h(2) > .45 ? 'board' : 'hedge', front = ['hedge', 'none', 'picket', 'none'][(h(3) * 4) | 0];
  A.edges = { side, front, back: h(4) > .3 ? 'board' : 'hedge', fcol };
  for (const [F, B] of [[FL, BL], [FR, BR]]) { const p0 = inset(at(F, B, fz), c, .3), p1 = inset(B, c, .45), q0 = inset(F, c, .5), q1 = inset(at(F, B, fz), c, .5);
    edge(L, p0, p1, side === 'hedge' ? 1.3 : 1.6, side, fcol);
    if (front !== 'none') edge(L, q0, q1, front === 'hedge' ? .7 : .9, front, fcol); }
  edge(L, inset(BL, c, .45), inset(BR, c, .45), side === 'hedge' ? 1.6 : 1.6, h(4) > .3 ? 'board' : 'hedge', fcol);
  // the back yard: between the house back and the back fence
  const yb = Math.max(BL[1], BR[1]) + 1.3, depth = bz - yb; if (depth < 2) return;
  const lx = at(FL, BL, yb + 1)[0] + .9, rx = at(FR, BR, yb + 1)[0] - .9, midz = (bz + yb) / 2;
  if (!S.modern) {
    const shedLeft = h(5) > .5, sx = shedLeft ? lx + 1.4 : rx - 1.4;
    if (h(6) > .2 && depth > 2.6) dress('barn', sx, yb + 1.2, shedLeft ? .3 : -.3, SHED[(h(7) * SHED.length) | 0], (h(8) * 2) | 0);
    const gx = shedLeft ? rx - 1.7 : lx + 1.7; if (h(9) > .25) dress('garden', gx, yb + .9, 0, (h(10) * 2) | 0);
    const pick = (h(11) * 7) | 0, mx = (lx + rx) / 2 + (shedLeft ? 1 : -1);
    if (depth > 3.6) { if (pick === 0) dress('trampoline', mx, midz + .3, 0, (h(12) * 3) | 0); else if (pick === 1) dress('pool', mx, midz + .2, 0, (h(12) * 2) | 0);
      else if (pick === 2) dress('swingset', mx, midz + .4, 0, (h(12) * 2) | 0); else if (pick === 3) { dress('playhouse', mx - 1, midz, 0, (h(12) * 2) | 0); dress('firepit', mx + 1.6, midz + .4); }
      else if (pick === 4) { dress('patio', mx, midz + .4, 0, 0xe8232a, (h(12) * 2) | 0); dress('grill', mx + 2.2, midz + 1.2, Math.PI); }
      else if (pick === 5) { dress('clothesline', mx, midz + .6, 0, (h(12) * 3) | 0); dress('doghouse', mx + 2.6, midz - .6, Math.PI, SHED[(h(13) * 3) | 0]); }
      else { dress('chair', mx - .6, bz - 1.4, Math.PI, 0x2de2e6); dress('chair', mx + .6, bz - 1.4, Math.PI, 0xff4fa3); dress('umbrella', mx + 1.8, bz - 1.6, 0, 0xffe23a); } }
    else dress('clothesline', (lx + rx) / 2, midz, 0, (h(12) * 3) | 0);
  } else if (h(6) > .4 && depth > 1) dress('barn', lx + 1.4, yb + 1.1, .2, SHED[(h(7) * 3) | 0], 1);
  // the hose off the back wall's spigot, snaking into the yard; an AC unit or a woodpile behind the house; the bins by the drive
  const hs = h(14) > .5 ? 1 : -1, hx = (st.x0 + st.x1) / 2 + dx + hs * 2.5;
  if (!S.modern && depth > 2.4) hose(L, hx, bz - .5, -hs * .5, S.seed);
  if (!S.modern) { if (h(15) > .4) dress('ac', (st.x0 + st.x1) / 2 + dx - hs * 3.2, bz - .7, 0); else if (depth > 3) dress('woodpile', (st.x0 + st.x1) / 2 + dx - hs * 3.4, bz - .6, 0, (h(16) * 2) | 0); }
  const dr = st.drive, bxw = (dr[0] + dr[1]) / 2 + dx < 0 ? dr[0] + dx - .6 : dr[1] + dx + .5;
  dress('bins', bxw, -.9, 0, 0x2f7a3a); dress('bins', bxw, -1.7, 0, 0x2f5bff);
}

// ── THE SHOWPIECES (the house kit: one thing on the roof, house builder 2026-10-06). (x, y, z): the roof top, in the house's frame
function trophyAt(L, tx, ty, tz) {
  L.box(tx - 1, ty, tz - 1, tx + 1, ty + .5, tz + 1, INK);
  L.box(tx - .5, ty + .5, tz - .5, tx + .5, ty + .8, tz + .5, GOLD, 2); L.box(tx - .2, ty + .8, tz - .2, tx + .2, ty + 1.6, tz + .2, GOLD, 2);
  for (let k = 0; k < 14; k++) { const r = [.5, .6, .8, .9, 1.0, 1.05, 1.1, 1.1, 1.1, 1.1, 1.05, 1.0, .9, .8][k]; L.box(tx - r, ty + 1.6 + k * .1, tz - r, tx + r, ty + 1.7 + k * .1, tz + r, GOLD, 2); }
  L.box(tx - .8, ty + 1.9, tz - .8, tx + .8, ty + 3.0, tz + .8, AIR);   // the cup is open
  for (const s of [-1, 1]) { L.box(tx + s * 1.1, ty + 2.4, tz - .15, tx + s * 1.5, ty + 2.5, tz + .15, GOLD, 2); L.box(tx + s * 1.4, ty + 1.9, tz - .15, tx + s * 1.5, ty + 2.5, tz + .15, GOLD, 2); L.box(tx + s * 1.1, ty + 1.9, tz - .15, tx + s * 1.5, ty + 2.0, tz + .15, GOLD, 2); }
  L.box(tx - .6, ty + .8, tz + 1.0, tx + .6, ty + 1.1, tz + 1.01, INK);   // plaque edge
}
const PINK = 0xff6fae;
const SHOWPIECE = {
  trophy: (L, x, y, z) => trophyAt(L, x, y - .1, z),
  flamingo(L, x, y, z) {   // the giant lawn flamingo, moved up to the roof: legs, the body, the S of the neck, the beak
    L.box(x - .5, y - .3, z - .5, x + .5, y + .1, z + .5, INK);
    for (const dx of [-.15, .15]) L.box(x + dx - .05, y, z - .05, x + dx + .05, y + 1.1, z + .05, 0xd9467f);
    L.box(x - .65, y + 1.0, z - .38, x + .55, y + 1.55, z + .38, PINK); L.box(x - .5, y + 1.55, z - .3, x + .45, y + 1.75, z + .3, PINK); L.box(x - .95, y + 1.3, z - .2, x - .6, y + 1.65, z + .2, 0xe8508f);
    L.box(x - .5, y + 1.25, z + .38, x + .1, y + 1.55, z + .42, 0xe8508f); L.box(x - .5, y + 1.25, z - .42, x + .1, y + 1.55, z - .38, 0xe8508f);   // the wings
    for (let k = 0; k < 9; k++) { const nx = x + .42 + Math.sin(k * .7) * .18; L.box(nx - .09, y + 1.6 + k * .1, z - .09, nx + .09, y + 1.72 + k * .1, z + .09, PINK); }
    L.box(x + .3, y + 2.45, z - .16, x + .72, y + 2.72, z + .16, PINK); L.box(x + .72, y + 2.42, z - .07, x + .98, y + 2.58, z + .07, 0xfff1c8); L.box(x + .9, y + 2.36, z - .07, x + 1.02, y + 2.5, z + .07, INK);
    L.box(x + .5, y + 2.6, z + .16, x + .58, y + 2.68, z + .18, INK); L.box(x + .5, y + 2.6, z - .18, x + .58, y + 2.68, z - .16, INK);
  },
  dish(L, x, y, z) {   // the satellite dish, aimed up over the street
    L.box(x - .35, y - .3, z - .35, x + .35, y + .2, z + .35, 0x8a9099); L.box(x - .06, y + .2, z - .06, x + .06, y + .9, z + .06, 0x8a9099);
    const n = [0, .64, .77], w = [0, .77, -.64], C = [x, y + 1.3, z], at = (u, v, d) => [C[0] + u, C[1] + v * w[1] + d * n[1], C[2] + v * w[2] + d * n[2]];
    for (let u = -.85; u <= .85; u += .07) for (let v = -.85; v <= .85; v += .07) { const r2 = u * u + v * v; if (r2 > .72) continue; const [px, py, pz] = at(u, v, r2 * .3);
      L.box(px - .05, py - .05, pz - .05, px + .05, py + .05, pz + .05, r2 > .6 ? 0xbfc3cc : 0xf1f1f4); }
    const a0 = at(0, -.8, .19), f = at(0, 0, .7); for (let k = 0; k <= 10; k++) { const t = k / 10, p = a0.map((q, i) => q + (f[i] - q) * t); L.box(p[0] - .04, p[1] - .04, p[2] - .04, p[0] + .04, p[1] + .04, p[2] + .04, 0x8a9099); }
    L.box(f[0] - .09, f[1] - .09, f[2] - .09, f[0] + .09, f[1] + .09, f[2] + .09, INK);
  },
  vane(L, x, y, z) {   // the weathervane: the post, N-S-E-W, the arrow, the rooster, all gold
    L.box(x - .3, y - .3, z - .3, x + .3, y + .15, z + .3, INK); L.box(x - .05, y + .15, z - .05, x + .05, y + 2.0, z + .05, INK);
    L.box(x - .55, y + 1.2, z - .03, x + .55, y + 1.26, z + .03, GOLD, 2); L.box(x - .03, y + 1.2, z - .55, x + .03, y + 1.26, z + .55, GOLD, 2);
    for (const [a, b] of [[.55, 0], [-.55, 0], [0, .55], [0, -.55]]) L.box(x + a - .07, y + 1.15, z + b - .07, x + a + .07, y + 1.32, z + b + .07, GOLD, 2);
    L.box(x - .8, y + 1.62, z - .03, x + .8, y + 1.68, z + .03, GOLD, 2); for (let k = 0; k < 4; k++) L.box(x + .8 + k * .05, y + 1.5 + k * .04, z - .04, x + .85 + k * .05, y + 1.8 - k * .04, z + .04, GOLD, 2);
    L.box(x - .95, y + 1.5, z - .02, x - .75, y + 1.82, z + .02, GOLD, 2);
    L.box(x - .3, y + 1.85, z - .05, x + .25, y + 2.15, z + .05, GOLD, 2); L.box(x + .15, y + 2.1, z - .05, x + .35, y + 2.38, z + .05, GOLD, 2); L.box(x + .2, y + 2.38, z - .05, x + .3, y + 2.48, z + .05, 0xe8232a);
    L.box(x - .45, y + 1.95, z - .04, x - .28, y + 2.4, z + .04, GOLD, 2); L.box(x + .35, y + 2.2, z - .03, x + .45, y + 2.26, z + .03, 0xffa21a);
  },
  star(L, x, y, z) {   // the lucky star on a post (it lights at night)
    L.box(x - .3, y - .3, z - .3, x + .3, y + .15, z + .3, INK); L.box(x - .05, y + .15, z - .05, x + .05, y + 1.0, z + .05, INK);
    const col = TOD.night ? 0xfff07a : 0xffe23a, lay = TOD.night ? 3 : 1;
    for (let u = -.95; u <= .95; u += .1) for (let v = -.95; v <= .95; v += .1) { const r = Math.hypot(u, v), a = Math.atan2(u, v), k = ((a / (Math.PI * 2 / 5)) % 1 + 1) % 1, R = .38 + .57 * Math.abs(1 - 2 * k) ** 1.6;
      if (r <= R) L.box(x + u - .05, y + 1.85 + v - .05, z - .1, x + u + .05, y + 1.85 + v + .05, z + .1, r > R - .1 ? 0xe7bd4a : col, r > R - .1 ? 2 : lay); }
  },
};
// the highest point of the main roof, clear of the chimneys (columns scanned in the house's frame; ties go to the middle)
function roofTop(L, [x0, z0, x1, z1]) { const V = L.V; let best = null;
  for (let x = x0 + .6; x <= x1 - .6; x += .3) for (let z = z0 + .6; z <= z1 - .6; z += .3) { if (CHIM.some(([cx, cz]) => Math.abs(cx + .45 - x) < 1.3 && Math.abs(cz + .45 - z) < 1.3)) continue;
    const ix = L.X(x), iz = L.Z(z); let y = V.ny - 1; while (y > 0 && !V.has(ix, y, iz)) y--; if (y <= 0) continue;
    const d = Math.hypot(x - (x0 + x1) / 2, z - (z0 + z1) / 2); if (!best || y > best[1] || (y === best[1] && d < best[3])) best = [x, y, z, d]; }
  return best && [best[0], (best[1] + 1) / 10, best[2]]; }
const MAIN = { springfield: [-9, -16, 2.5, -7], cape: [-6.5, -15, 6.5, -7], porch: [-5.5, -17.5, 4.5, -8], ranch: [-9.5, -15, 3, -7], gambrel: [-4.5, -16, 6.5, -7.5] };
const FIXEDTOP = { trophy: [3.2, 7.2, -11.5], slab: [-2.3, 3.55, -10.8], butterfly: [-7.6, 3.85, -10.2] };

// ── the custom yard from data (yard.js): fences and hedges on the edge runs, path cells, the pieces
const pk = (x, z) => (+x.toFixed(2)) + ',' + (+z.toFixed(2));
function tile(L, x0, z0, x1, z1, m, seed) {
  if (m === 'drive') L.box(x0, 0, z0, x1, .05, z1, driveCol);
  else if (m === 'conc') for (let z = z0; z < z1 - .05; z += .5) L.box(x0, 0, z, x1, .05, Math.min(z1, z + .4), (x) => x % 10 === 0 ? 0xcdc6b8 : CONC);
  else if (m === 'brick') L.box(x0, 0, z0, x1, .05, z1, (x, y, z) => (z % 2 === 0 || (x + (z >> 1) * 2) % 4 === 0) ? 0xd9c9b0 : hash(x >> 2, z >> 1, 5) > .5 ? 0xb4553c : 0xa3492f);
  else if (m === 'stone') { const cx = (x0 + x1) / 2 + (hash(seed, 1) - .5) * .1, cz = (z0 + Math.min(z1, z0 + .5)) / 2 + (hash(seed, 2) - .5) * .1, r = .17 + hash(seed, 3) * .04;
    L.box(cx - r, 0, cz - r + .05, cx + r, .05, cz + r - .05, 0xb9b3a8); L.box(cx - r + .05, 0, cz - r, cx + r - .05, .05, cz + r, 0xc4beb3); }
}
// rects: the house's footprint; a cell whose back neighbour is not a path runs back to the wall it meets; the front row runs on to the curb
export function drawPaths(L, paths, rects = []) { const has = new Set(paths.map(([x, z]) => pk(x, z)));
  paths.forEach(([x, z, m], k) => { let zb = z; if (!has.has(pk(x, z - CELL))) for (const r of rects) if (x < r[2] && x + CELL > r[0] && r[3] <= z + 1e-6 && r[3] > z - CELL - .3) zb = Math.min(zb, r[3]);
    const front = z + CELL >= -1e-6, zf = front && m !== 'stone' ? 1.5 : z + CELL; tile(L, x, zb, x + CELL, zf, m, k * 7 + 3); }); }
// the runs (yard.js runsOf) with a style each; wherever a path or the drive crosses a run, it leaves a gap (a gate)
export function drawEdges(L, edges, poly, hf, paths) { const R = runsOf(poly, hf), has = new Set(paths.map(([x, z]) => pk(x, z))), cell = v => Math.floor(v / CELL + 1e-6) * CELL;
  const skip = (x, z) => [[-.14, -.14], [.14, -.14], [-.14, .14], [.14, .14]].some(([a, b]) => has.has(pk(cell(x + a), cell(z + b))) || (z + b > -CELL && has.has(pk(cell(x + a), -CELL))));
  for (const k of Object.keys(R)) { const e = edges[k]; if (!e || !EDGES[e.k]?.draw) continue; const E = EDGES[e.k]; edge(L, R[k][0], R[k][1], E.h, E.draw, e.c ?? 0xd9c7a4, [], skip); } }
function drawYard(L, put, Y, poly, H) {
  drawEdges(L, Y.edges, poly, H ? houseFront(H) : -6, Y.paths); drawPaths(L, Y.paths, H ? houseRects(H) : []);
  for (const it of Y.items) { if (!YARD[it.id]) continue; const [tx, tz] = stampAt(it); put(bankOf(it), tx, tz, it.r ?? 0); softPiece(it.id, argsOf(it), it.r ?? 0, tx, tz); }
}

// ── MAINLAND LAWNS: the lot's own lawn patch (lawn.js lotLawn), when the page asks for it (spec.lawn = { grid, x, z, rot, care }): painted
// from the lot's ground layer (its paths, shrubs, walls, fences), its trees and pieces, and the house's door and drive for the wear trails
function lawnOf(L, spec, A, H) {
  if (!spec.lawn) return; const items = spec.custom ? [] : [...A.dress];   // (a custom lot: its own pieces only; A.dress there is the generated look, never drawn)
  if (spec.custom?.yard) for (const it of spec.custom.yard.items) { if (!YARD[it.id]) continue; const [tx, tz] = stampAt(it); items.push({ id: it.id, args: argsOf(it), x: tx, z: tz }); }
  const info = { items };
  if (H) { const rects = houseRects(H), dz = doorZone(H), dr = DRIVE[H.style]?.(H); info.front = houseFront(H); info.back = Math.min(...rects.map(r => r[1]));
    info.door = dz ? [(dz[0] + dz[2]) / 2, dz[1]] : [(rects[0][0] + rects[0][2]) / 2, info.front]; info.drive = dr ? [dr[0] + H.hx, dr[1] + H.hx] : null; }
  const t0 = performance.now(); A.lawn = lotLawn(L, spec.poly, info, spec.lawn); A.lawn.ms = performance.now() - t0;
}

// ── the sprinklers (MAINLAND FIXES 2026-10-06): where the lot's heads stand, for the page to animate their water (sprinklers.js), in the
// lot frame [x, z, reach]: the generated look's, or the owner's pieces; reach keeps the spray inside the fences
function sprinklersOf(A, spec) { const pts = spec.custom ? (spec.custom.yard?.items ?? []).filter(it => it.id === 'sprinkler').map(it => stampAt(it)) : A.dress.filter(d => d.id === 'sprinkler').map(d => [d.x, d.z]);
  const P = spec.poly, side = (x, z) => Math.min(...[1, 2, 3].map(k => { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % 4], L = Math.hypot(bx - ax, bz - az) || 1; return ((bz - az) * (x - ax) - (bx - ax) * (z - az)) / L; }));
  return pts.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2), +Math.max(1.2, Math.min(3, side(x, z) - .7)).toFixed(2)]); }   // (the sides and the back: the walk can take a splash)

// ── the lot: a spec → a Bank in lot-local coordinates (main.js stamps it at the plot's front point and angle)
// spec: { style, seed, W, D, poly (lot-local corners FL, FR, BR, BL), wall (hex), glass, car: { id, v }, statue ([x, z]: the gold statue main.js stands on the lawn; the yard keeps clear of it) }
//   + custom: { house, yard } (the owner's: yard.js) · houseOnly: the house alone, unshifted along the frontage (the builder's preview)
export function buildLot(spec) {
  if (spec.custom && !spec.custom.house) {   // an owner's yard with no house on it yet: the yard alone
    const xs = spec.poly.map(p => p[0]), zs = spec.poly.map(p => p[1]), L = new LV(Math.min(...xs) - .5, Math.min(...zs) - .5, Math.max(...xs) + .5, 1.5, 3), things = [], A = { panes: [], lights: [], dress: [] }; CTX = { L, A };
    if (!spec.houseOnly) drawYard(L, (b, x, z, rot = 0, y = 0) => things.push([b, x, z, rot, y]), spec.custom.yard, spec.poly, null);
    if (!spec.houseOnly) { lawnOf(L, spec, A, null); A.sprinklers = sprinklersOf(A, spec); }
    const bank = new Bank(); meshVol(L.V, bank); for (const [b, x, z, rot, y] of things) stampA(b, bank, rot, x, y, z); CTX = null; return { bank, A }; }
  const C = spec.custom, H = C?.house ?? null, style = H ? H.style : spec.style, st = STYLE[style], xs = spec.poly.map(p => p[0]), zs = spec.poly.map(p => p[1]);
  const sx = H ? (spec.houseOnly ? 0 : H.hx) : st.dx, sz = H ? H.hz : 0;
  const ex = H ? sx : 0, x0 = Math.min(-11 + Math.min(0, ex), ...xs) - .5, x1 = Math.max(11 + Math.max(0, ex), ...xs) + .5, z0 = Math.min(-26 + sz, ...zs) - .5;   // (a generated lot keeps its old grid)
  const L = new LV(x0, z0, x1, 1.5, H ? 14 : 11.5), A = { panes: [], lights: [], dress: [] }; let things = [];
  const put = (b, x, z, rot = 0, y = 0) => things.push([b, x + (L.dx || 0), z + (L.dz || 0), rot, y]);
  const HH = H ?? (MODERN.includes(style) ? { ...defaultHouse(style), hx: st.dx, hz: 0 } : { ...defaultHouse(style, { glass: spec.glass }), hx: st.dx, hz: 0 }), dv = DRIVE[style](HH), wk = WALK[style], dz = doorZone(HH);
  CTX = { L, A, put, H: HH, later: [], poly: spec.poly, placed: spec.statue ? [[spec.statue[0], spec.statue[1], 1.6, true, 1.6]] : [], rects: houseRects(HH), flat: [...(dv ? [[dv[0] + HH.hx, dv[2] + HH.hz, dv[1] + HH.hx, 1.5]] : []), ...(wk && dz ? [[wk[0] + HH.hx, dz[1], wk[1] + HH.hx, 1.5]] : [])] }; BARE = !!H; CHIM = [];
  try {
    L.dx = sx; L.dz = sz;
    const o = H ? { custom: true, wall: WALLS[H.wall] ?? SHERBET.white, roof: H.roof ? ROOFS[H.roof] : null, accent: H.accent ? ACCENTS[H.accent] : null, garage: H.garage, porch: H.porch, dormers: H.dormers,
      hoop: H.hoop, pool: H.pool, show: H.show, car: H.car ? { id: H.car[0], v: H.car[1] } : null } : { wall: spec.wall, glass: spec.glass, car: spec.car };
    let modern = null;
    if (MODERN.includes(style)) { modern = buildModern(style, { wall: o.wall, accent: o.accent ?? spec.accent, car: o.car ?? spec.car, noGarage: o.garage === 'none' }); drive(L, st.drive[0], st.drive[1], -5.2, 1.5);
      for (const p of modern.panes) A.panes.push([-p[3] + sx, p[1], -p[5] + sz, -p[0] + sx, p[4], -p[2] + sz]);
      for (const l of modern.lights) A.lights.push([-l[0] + sx, l[1], -l[2] + sz]); A.stand = modern.stand.map(([x, z, r]) => [-x + sx, -z + sz, r]);
      if (spec.car2) dress('car', (st.drive[0] + st.drive[1]) / 2, -1.2, Math.PI, spec.car2.id, spec.car2.v); }
    else { HOUSES[style](L, put, A, o); for (const p of A.panes) { p[0] += sx; p[3] += sx; p[2] += sz; p[5] += sz; } for (const l of A.lights) { l[0] += sx; l[2] += sz; } }
    if (H && H.show && H.show !== 'none' && !(style === 'trophy' && H.show === 'trophy') && SHOWPIECE[H.show]) { const t = FIXEDTOP[style] ?? roofTop(L, MAIN[style]); if (t) SHOWPIECE[H.show](L, t[0], t[1], t[2]); }
    if (!modern) for (const k of ['hoop', 'sprinkler', 'drive', 'roof', 'pool', 'gate', 'lawn', 'porch', 'steps', 'stand', 'look']) if (A[k]) A[k] = k === 'roof' ? [A[k][0] + sx, A[k][1], A[k][2] + sz] : [A[k][0] + sx, A[k][1] + sz, ...A[k].slice(2)];
    L.dx = 0; L.dz = 0;
    if (!H) yard(L, put, A, { ...spec, modern: !!modern });
    else if (!spec.houseOnly) drawYard(L, put, C.yard, spec.poly, H);
    lateTrees();
    if (!spec.houseOnly) A.sprinklers = sprinklersOf(A, spec);
    if (!spec.houseOnly) lawnOf(L, spec, A, H ?? (MODERN.includes(style) ? { ...defaultHouse(style), hx: st.dx, hz: 0 } : { ...defaultHouse(style, { glass: spec.glass }), hx: st.dx, hz: 0 }));
    const bank = new Bank(); meshVol(L.V, bank);
    if (modern) stampA(modern.bank, bank, Math.PI, sx, 0, sz);
    for (const [b, x, z, rot, y] of things) stampA(b, bank, rot, x, y, z);
    return { bank, A };
  } finally { BARE = false; CTX = null; }
}

const HOUSES = {
  // 1 · THE SPRINGFIELD: two storeys, hip roof, a front-gable garage with the hoop, a portico, a bay window, the chimney
  springfield(L, put, A, o) {
    const wall = o.wall ?? SHERBET.coral, RF = o.roof ?? ROOF.choc, gar = o.garage ?? (o.glass ? 'glass' : 'door'), M = [-9, -16, 2.5, -7], G = [2.5, -15, 9.2, -6.2];
    drive(L, 3.1, 8.6, -6.2, 1.5); walkPath(L, -4.3, -3.1, -6, 1.5);
    body(L, M, 6.4, wall); if (gar !== 'none') body(L, G, 3.2, wall, { found: 1 });
    hip(L, M, 6.4, RF, { ov: 4 }); if (gar !== 'none') gable(L, G, 3.2, 'z', RF, { fill: wall, run: 2, rise: 1, ovg: 3 });
    const f = L.face(M, '+z'), g = gar !== 'none' ? L.face(G, '+z') : null;
    door(f, 52, 0x7a3cff, { glassTop: true }); W1(f, 8, 13, 22, 16); W1(f, 74, 13, 14, 16); for (const a of [8, 44, 78]) W1(f, a, 43, 14, 15);
    f.box(4, 9, 0, 34, 12, 6, TRIM); f.box(6, 12, 0, 32, 30, 4, TRIM); for (const a of [8, 16, 24]) f.box(a, 14, 3, a + 7, 29, 4, (aa, y) => litWin(3) ? (y > 23 ? PAL.litHi : PAL.litLo) : (y > 24 ? PAL.glassHi : PAL.glassLo), litWin(3) ? 3 : 1); f.box(4, 30, 0, 34, 32, 6, RF);   // bay window
    if (o.porch !== false) { f.box(48, 30, 0, 68, 31, 16, TRIM); for (const a of [48, 66]) f.box(a, 4, 13, a + 2, 30, 15, TRIM); f.box(47, 31, 0, 69, 33, 17, RF); }   // portico
    if (gar === 'glass') showroom(L, put, A, G, 3.2, wall, o.car ?? { id: 'lowrider', v: 2 }); else if (gar === 'door') garageDoor(g, 8, 51, TRIM);
    if (g && o.hoop !== false) hoopOn(g, 26, 36);
    chimney(L, -9.6, -12.5, 9.2); shrubs(L, -8.8, 2.4, -7, [[-4.8, -2.2]]);
    for (const a of [10, 50]) W1(L.face(M, '-x'), a, 43, 12, 15);
    dress('mailbox', 2.4, .6, 0, 'post', wall, 1); dress('bins', 9.4, .2, 0, 0x2f7a3a); dress('bike', -6.5, -3.6, 1.1, 0xff4fa3); dress('toys', -7.8, -2.2, .3, 1);
    dress('tree', -8.8, -2.5, 0, 'maple', 1, 2); sprk(L, -2, -3.6, .3);
    if (g && o.hoop !== false) A.hoop = [5.8, -3.0]; A.sprinkler = [-2, -3.6]; A.drive = [5.8, -1];
  },
  // 2 · THE TROPHY HOUSE (the upgraded showpiece): white box, a cobalt upper storey cantilevered forward, a glass wall, a roof deck
  //     with a giant gold trophy, an in-ground pool behind a glass fence
  trophy(L, put, A, o) {
    const M = [-3, -17, 9.5, -8], U = [-4.5, -17, 7.5, -6.6], wall = o.custom ? o.wall : SHERBET.white, up = o.accent ?? SHERBET.cobalt;
    drive(L, 4.6, 9.2, -8, 1.5); walkPath(L, 1.4, 2.6, -8, 1.5);
    body(L, M, 3.4, wall, { lap: false, trim: 0xd3d4d7 });
    L.box(U[0], 3.4, U[1], U[2], 6.8, U[3], (x, y) => (y === 34 || y === 67) ? INK : up);
    L.box(U[0], 6.8, U[1], U[2], 7.2, U[3], 0xf4f1ea); L.box(U[0] + .3, 7.0, U[1] + .3, U[2] - .3, 7.2, U[3] - .3, 0x9c9aa2);   // roof, parapet top
    const u = L.face(U, '+z'); u.box(6, 44, -2, 114, 58, 1, (a, y) => litWin(a >> 4) ? (y > 52 ? PAL.litHi : PAL.litLo) : (y > 53 ? PAL.glassHi : PAL.glassLo), TOD.night ? 3 : 1); u.box(6, 43, 0, 114, 44, 2, INK); u.box(6, 58, 0, 114, 59, 2, INK);
    const f = L.face(M, '+z'); f.box(3, 4, -1, 38, 30, 1, (a, y) => (a - 3) % 9 === 0 || y === 4 ? INK : (TOD.night ? (y > 20 ? PAL.litHi : PAL.litLo) : (y > 22 ? PAL.glassHi : PAL.glassLo)), TOD.night ? 3 : 1);   // the glass wall
    door(f, 43, INK, { lamp: true, y: 4 }); garageDoor(f, 78, 45, INK, 0xd3d4d7);
    f.box(78, 28, 0, 123, 30, 2, 0xd3d4d7);
    // roof deck on the upper box: string of lights, THE TROPHY (gold, metal layer) on a plinth (the kit can swap it for another showpiece)
    const ty = 7.2, tx = 3.2, tz = -11.5; if ((o.show ?? 'trophy') === 'trophy') trophyAt(L, tx, ty, tz);
    for (let x = U[0] + .6; x < U[2] - .4; x += .8) L.box(x, ty + 1.9, U[3] - .5, x + .2, ty + 2.1, U[3] - .3, TOD.night ? [0xffe23a, 0xff4fa3, 0x2de2e6][Math.round(x * 3) % 3 & 3] ?? 0xffe23a : 0xf7f7f2, TOD.night ? 3 : 0);
    for (const x of [U[0] + .4, U[2] - .6]) L.box(x, ty, U[3] - .6, x + .2, ty + 2.1, U[3] - .4, INK);
    L.box(U[0] + .4, ty + 2.1, U[3] - .6, U[2] - .4, ty + 2.15, U[3] - .5, INK);
    // pool in the left side yard, behind a glass fence, loungers
    if (o.pool !== false) { L.box(-10.3, 0, -18, -3.4, .3, -9, 0xf4f1ea); L.box(-9.8, .05, -17.5, -3.9, .3, -9.5, 0x3fc8ff, 1); L.box(-9.8, .05, -17.5, -3.9, .2, -9.5, 0x2aa9e8, 1);
      L.box(-10.4, .3, -8.9, -3.3, 1.4, -8.8, 0xbfeaff, 1); A.pool = [-6.8, -8.3]; }
    dress('mailbox', 4.0, .6, 0, 'brick', SHERBET.cobalt); put(planter(0x17171b, 1), -1.2, -7.4); put(planter(0x17171b, 2), 4.0, -7.4);
    dress('tree', -9.5, -3, 0, 'birch', 1, 1); dress('tree', -6.8, -2.2, 0, 'birch', 0, 2);
    dress('car', 6.9, -3.8, Math.PI, (o.car ?? {}).id ?? 'supercar', (o.car ?? {}).v ?? 2);
    A.roof = [tx + 2.2, ty, tz + 2.8];
  },
  // 3 · THE CAPE: a storey and a half, a steep side gable with two dormers (or three, or none), shutters, flower boxes, a white picket fence
  cape(L, put, A, o) {
    const wall = o.wall ?? SHERBET.butter, RF = o.roof ?? ROOF.slate, sh = o.accent ?? 0x14a83b, nd = o.dormers ?? 2, M = [-6.5, -15, 6.5, -7];
    drive(L, 7, 10, -12, 1.5); walkPath(L, -.6, .6, -7, 1.5);
    body(L, M, 3.4, wall); gable(L, M, 3.4, 'x', RF, { fill: wall, rise: 1, run: 1, ov: 4, ovg: 3 });
    const f = L.face(M, '+z'); door(f, 59, sh, { glassTop: true });
    for (const a of [14, 34, 86, 104]) { W1(f, a, 13, 12, 16, TRIM, { box: true }); shutters(f, a, 13, 12, 16, sh); }
    for (const dx of nd === 3 ? [-4.2, 0, 3.6] : nd === 2 ? [-3.2, 3.2] : []) { const D = [dx - 1, -11.5, dx + 1, -7.8]; L.box(D[0], 3.8, D[1], D[2], 5.9, D[3], wall); gable(L, D, 5.9, 'z', RF, { fill: wall, rise: 1, run: 1, ov: 2, ovg: 2 }); W1(L.face(D, '+z'), 5, 42, 10, 13); }
    chimney(L, 5.2, -12.8, 8.6); shrubs(L, -6.3, 6.4, -7, [[-1.2, 1.2]]);
    picket(L, -10.4, 10.4, -.3, -1.1, 1.1);
    dress('mailbox', 2, .5, 0, 'post', 0x14a83b); dress('gnomes', -4.5, -5.6, .4, 1); sprk(L, 4.4, -2.2, 1.1); dress('birdbath', 4.5, -4.2, 0); dress('tree', -8.2, -4.2, 0, 'blossom', 1, 0);
    if (o.car) dress('car', 8.5, -4.2, Math.PI, o.car.id, o.car.v); else dress('bike', 8.2, -9.5, 2.6, 0x2f5bff); put(planter(0xe8232a, 0), -1.8, -6.5); put(planter(0xe8232a, 1), 1.8, -6.5);
    A.gate = [0, -1.2]; A.lawn = [-3.2, -3.4];
  },
  // 4 · THE GABLE-FRONT: two storeys, the gable to the street, a full-width porch with a swing, a trampoline out back
  porch(L, put, A, o) {
    const wall = o.wall ?? SHERBET.sky, RF = o.roof ?? ROOF.char, M = [-5.5, -17.5, 4.5, -8], hasP = o.porch !== false;
    drive(L, 5.5, 9, -20, 1.5); walkPath(L, -1.6, -.4, -5.4, 1.5);
    body(L, M, 6.4, wall); gable(L, M, 6.4, 'z', RF, { fill: wall, rise: 2, run: 3, ovg: 3, ov: 4 });
    const f = L.face(M, '+z'); door(f, 38, 0xe8232a, { glassTop: true, y: 5 }); W1(f, 10, 14, 16, 16); W1(f, 68, 14, 16, 16);
    for (const a of [12, 70]) W1(f, a, 43, 14, 15); W1(f, 44, 72, 12, 10);
    if (hasP) { porch(L, -5.5, 4.5, -8, 2.6, 3.0, RF, { gap: -1 });
      L.box(-4.8, 1.0, -7.6, -3.0, 1.1, -7.2, WOOD); L.box(-4.8, 1.1, -7.7, -3.0, 1.6, -7.6, WOOD);   // porch swing (on chains)
      for (const x of [-4.7, -3.2]) L.box(x, 1.1, -7.45, x + .1, 3.0, -7.35, INK); A.porch = [-3.9, -7.45]; }
    shrubs(L, -5.5, 4.6, hasP ? -5.3 : -7.9, [[-2.2, .3]]); dress('mailbox', 4.7, .5, 0, 'novelty', 0xe8232a); dress('tree', -8.5, -4.5, 0, 'oak', 2, 1);
    dress('car', 7.25, -3.4, Math.PI, (o.car ?? {}).id ?? 'sedan', (o.car ?? {}).v ?? 5); dress('bins', 9.6, .25, 0, 0x2f5bff);
    A.steps = [-1, -5];
  },
  // 5 · THE RANCH: one storey, long and low, a hip roof, a picture window, a carport with the pickup, flamingos, the kids' lemonade stand
  ranch(L, put, A, o) {
    const wall = o.wall ?? SHERBET.mint, RF = o.roof ?? ROOF.warm, cp = o.garage !== 'none', M = [-9.5, -15, 3, -7], C = [3, -15, 9.5, -7];
    drive(L, 3.6, 9, -15, 1.5); walkPath(L, -3.6, -2.4, -7, 1.5);
    body(L, M, 3.3, wall); hip(L, M, 3.3, RF, { run: 3, rise: 1, ov: 5 });
    const f = L.face(M, '+z'); door(f, 58, 0xffc21a, { y: 3 }); f.box(10, 11, 0, 50, 26, 1, TRIM); W1(f, 12, 12, 36, 13); W1(f, 90, 13, 16, 14);
    if (cp) { for (const x of [3.2, 9.1]) for (const z of [-7.5, -14.6]) L.box(x, 0, z, x + .3, 2.8, z + .3, TRIM);
      L.box(2.7, 2.8, -15.3, 9.8, 3.1, -6.6, TRIM); L.box(2.8, 3.1, -15.2, 9.7, 3.3, -6.7, RF);
      put(vehicleProp((o.car ?? {}).id ?? 'pickup', { variant: (o.car ?? {}).v ?? 3, kind: 'car' }), 6.3, -11, Math.PI); }
    shrubs(L, -9.3, 3, -7, [[-4.2, -1.8]]); dress('flamingos', -7.5, -3.5, .3, 0); dress('flamingos', -5.8, -4.6, -.4, 1);
    dress('mailbox', 3.2, .5, 0, 'post', 0xffc21a); dress('lemonade', -7.6, -.2, 0); dress('tree', -9.6, -8.8, 0, 'oak', 1, 2);
    A.stand = [-7.6, -.2]; A.lawn = [-2, -3];
  },
  // 6 · THE GAMBREL: a Dutch barn roof, the garage wing with the second hoop, a shed dormer
  gambrel(L, put, A, o) {
    const wall = o.wall ?? SHERBET.lilac, RF = o.roof ?? ROOF.grey, gar = o.garage ?? (o.glass ? 'glass' : 'door'), M = [-4.5, -16, 6.5, -7.5], G = [-10.2, -15, -4.5, -6.8];
    drive(L, -9.7, -5, -6.8, 1.5); walkPath(L, 1.1, 2.3, -7.5, 1.5);
    body(L, M, 3.4, wall); if (gar !== 'none') body(L, G, 3.1, shade(wall, .92), { found: 1 });
    gable(L, M, 3.4, 'x', RF, { fill: wall, ov: 4, ovg: 3, steps: k => k < 14 ? [2, 1] : [1, 2] });
    if (gar !== 'none') hip(L, G, 3.1, RF, { run: 2, rise: 1 });
    const f = L.face(M, '+z'); door(f, 53, 0xffffff, { trim: 0xfff0d0 }); W1(f, 12, 13, 14, 16); W1(f, 82, 13, 14, 16);
    f.box(4, 30, 0, 106, 32, 3, TRIM);
    if (o.dormers !== 0) { L.box(-3, 5.4, -12, 5, 6.6, -9.1, wall); L.box(-3.2, 6.6, -12, 5.2, 6.8, -8.9, RF); for (const a of [4, 34, 62]) W1(L.face([-3, -12, 5, -9.1], '+z'), a, 56, 12, 9); }   // shed dormer
    if (gar === 'glass') showroom(L, put, A, G, 3.1, shade(wall, .92), o.car ?? { id: 'supercar', v: 4 });
    else if (gar === 'door') { const g = L.face(G, '+z'); garageDoor(g, 5, 47, TRIM); if (o.hoop !== false) { hoopOn(g, 20, 27); A.hoop = [-7.4, -3.4]; } }
    chimney(L, 6.6, -12.5, 8.4); shrubs(L, -4.3, 6.4, -7.5, [[.4, 3]]); if (gar !== 'glass' && o.car) dress('car', -7.35, -2.6, Math.PI, o.car.id, o.car.v);
    dress('mailbox', -4.4, .5, 0, 'post', wall); dress('bike', -1.5, -3, .6, 0xffc21a); dress('tree', 8.5, -4, 0, 'maple', 2, 0); put(planter(0xff4fa3, 2), -.2, -6.8);
    A.lawn = [4, -3];
  },
  // an open lot: mown grass, the footprint staked with pink-flag stakes and string, a realtor sign (main.js adds the words)
  empty(L, put, A, o) {
    const [x0, z0, x1, z1] = [-6, -17, 6, -7];
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { L.box(x - .05, 0, z - .05, x + .05, .7, z + .05, 0xe9d8b8); L.box(x - .08, .6, z - .02, x + .12, .7, z + .08, 0xff4fa3); }
    for (const [a, b, c, d] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) L.box(Math.min(a, c), .4, Math.min(b, d), Math.max(a, c) + .04, .44, Math.max(b, d) + .04, 0xff4fa3);
    L.box(-2, 0, -13, 2, .03, -10, 0x8a6a4a);   // a fresh patch of dirt where the survey pin went in
    put(tree('oak', 2, 0), 7.5, -20);
    A.sign = [-4.5, -2.2]; A.look = [-2, -2.5];
  },
};
