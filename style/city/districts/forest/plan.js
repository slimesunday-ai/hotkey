// BLACKPINE WOODS · the plan (owner: the Blackpine Woods agent). Worker-safe. Everything here is a pure function of world
// coordinates, so every block (and its far tier, and its neighbours) agrees on where each tree, track and clearing is.
//   SITES      the sim's places (sim2/places.json, coordinates are law): the leaf dig site and the three cook shacks
//   TRACKS     dirt roads from the city's edge roads to the sites (two ruts and a grass hump), TRAILS footpaths, CLEARINGS
//   FEATURES   the one-offs: fire tower, campsite and dock, hunting stand, the dead car, the log deck, the dump, trailheads
//   treesNear(x0, z0, x1, z1)   every tree whose crown reaches into the rect (a global 3.6 m jittered grid: neighbours agree)
//   sidesOf(i, j)               the block's sides that face a city road (the verge: a 2 m sidewalk, then the woods' edge)
import { P, segZ, hwX, hwZ, rwX, rwZ, swX, swZ, fbm, remap, unmap, LAKE, SPREAD, P0, HS } from '../../../../world/city.js';
import { kerbX, kerbZ } from '../frame.js';
import { segX } from '../../plan.js';   // stitch pass: the core's segX — the plan's, except that Route 9 ends at the south coast (plan.js R9_END)
import { hash } from '../../style.js';
import { elev, wetAt, lakeOf, cityDist, SHORE, WOODS, isWoods } from './land.js';
export { elev, wetAt, lakeOf, cityDist, SHORE, WOODS, isWoods, P };

// SPREAD · the plan's hand-placed metres are today's (style/city/SPREAD.md), carried into the spread world once, here. A point goes through
// remap (in a woods block: the block's shift; the sim's places among them, as sim2/places.mjs moves them); a path's point in a street
// band keeps to the kerb (KP: where remap would stretch the band, a track's mouth stays at the asphalt's edge); the campsite, its dock,
// its yard and the lake trail move with the LAKE (world/city.js, remapped with its woods block), one piece with the shore (LK); the ferry
// landing moves with Route 9's south end (row 12's line), its walkways to Route 9's own (kerbX). At SPREAD 0 every value is today's.
const RM = (x, z) => remap(x, z), shifted = v => v + SPREAD * Math.floor(v / P0) + HS;
const KP = (x, z) => { if (!SPREAD) return [x, z]; const [rx, rz] = remap(x, z); return [Math.abs(rx - shifted(x)) > 1e-9 ? kerbX(x) : rx, Math.abs(rz - shifted(z)) > 1e-9 ? kerbZ(z) : rz]; };
export const LAKE_SHIFT = (() => { const [x, z] = unmap(LAKE.x, LAKE.z); return [LAKE.x - x, LAKE.z - z]; })();   // how far the lake moved
const LK = (x, z) => [x + LAKE_SHIFT[0], z + LAKE_SHIFT[1]];
const RC = ([x, z, ...rest], f = RM) => [...f(x, z), ...rest], RR = ([x0, z0, x1, z1]) => [...RM(x0, z0), ...RM(x1, z1)];
const LDG = ([x0, z0, x1, z1]) => [kerbX(x0), z0 + 12 * SPREAD, kerbX(x1), z1 + 12 * SPREAD];   // (Route 9 ends at row 12's line: plan.js R9_END)
const path = (pts, f = KP) => pts.map(p => f(...p));

// ── the sim's places
export const SITES = { leaf: RM(-330, 60), labN: RM(330, -110), labW: RM(-400, -150), labS: RM(-120, 390) };
export const PILE = { x: SITES.leaf[0], z: SITES.leaf[1], spill: [4.6, 2.2], half: 1.75 };         // simstate/layer.js drawPiles: the heap here, a spill at (+4.6, +2.2)
export const TOWER = RM(-297, -6);                                               // the Blackpine lookout, on Central Ave's axis
export const CAMP = LK(-372, 76), DOCK = [...LK(-373, 65), ...LK(-373, 52)];                  // the campsite on the lake's north shore, its dock out into the lake
export const STAND = RM(-186, -168), MEADOW = RC([-205, -176, 17]);                  // the hunting stand at the edge of Deer Meadow
export const WRECK = RM(270, -83);                                               // the dead car in the trees off the north track
export const DECK = RM(292, -188);                                               // the log deck (a cut: stumps, a stacked pile)
export const DUMP = RM(58, 297);                                                 // the dumping spot behind Fox Run
// the shacks' yards (the hero builds inside; nothing else grows there): [x, z, r]
export const YARDS = { labN: RC([329, -111, 8]), labW: RC([-401, -151, 8]), labS: RC([-120, 391, 8]), leaf: RC([-331, 58, 15]), tower: RC([-297, -6, 7]), camp: RC([-372, 76, 7], LK) };
// stitch pass · the Route 9 ferry landing at the highway's south end (landing.js; the road stops at z 384, plan.js R9_END): the apron from
// the road's end over the beach, the slip (gantry + ramp) and the ferry, [x0, z0, x1, z1]. The floor leaves the apron to it; nothing grows
// in `clear` (the crowns keep off the gantry and the boat).
export const LANDING = { apron: LDG([215, 384, 233, 400]), slip: LDG([218.8, 398.6, 229.2, 406.6]), ferry: LDG([219.4, 406.6, 228.6, 428.6]), clear: LDG([211, 384, 237, 431]) };
export const inLanding = (x, z, r = LANDING.clear) => x > r[0] && x < r[2] && z > r[1] && z < r[3];

// ── tracks (3.2 m dirt roads) and trails (1.3 m footpaths): polylines, hand-laid round the water
export const TRACKS = [
  { id: 'leaf', w: 3.2, pts: path([[-258.2, 50], [-270, 50.5], [-284, 48], [-298, 50], [-310, 55], [-318, 58.5]]) },                                 // Birch St → the leaf clearing
  { id: 'west', w: 3.2, pts: path([[-232, -98.2], [-236, -108], [-246, -121], [-262, -133], [-284, -142], [-310, -149], [-334, -160], [-352, -166], [-368, -163], [-382, -157], [-390, -153]]) },   // 3rd St → the west shack
  { id: 'south', w: 3.2, pts: path([[-125.5, 290.2], [-125.5, 304], [-124, 322], [-120, 340], [-118, 358], [-118.5, 372], [-119, 380]]) },           // Grand Ave's dead end → the south shack
  { id: 'north', w: 3.2, pts: path([[231.2, -104], [246, -103], [262, -96], [280, -97], [298, -106], [312, -110], [319, -109.5]]) },              // Route 9 → the north shack
  { id: 'deck', w: 3.2, pts: path([[262, -96], [268, -118], [274, -142], [282, -166], [290, -181]]) },                                            // a logging spur off the north track
];
export const TRAILS = [
  { id: 'tower', w: 1.3, pts: path([[-289, 49], [-292, 34], [-295, 18], [-297, 2]]) },
  { id: 'camp', w: 1.3, pts: [...path([[-318, 60], [-330, 71]], RM), ...path([[-346, 76], [-362, 77]], LK)] },
  { id: 'lake', w: 1.3, pts: [...path([[-362, 77], [-398, 76], [-422, 66], [-438, 44], [-442, 18], [-436, -6], [-420, -24], [-396, -32], [-370, -28], [-350, -16], [-338, 4], [-334, 26]], LK), ...path([[-330, 44]], RM)] },
  { id: 'meadow', w: 1.3, pts: path([[-222, -98.2], [-214, -118], [-208, -140], [-204, -160]]) },
  { id: 'pond', w: 1.3, pts: path([[40, 290.2], [34, 310], [22, 330], [10, 342], [-14, 346], [-34, 352], [-44, 366], [-40, 382], [-22, 392], [4, 392], [22, 382]]) },
  { id: 'point', w: 1.3, pts: path([[-128, 330], [-100, 326], [-70, 334], [-48, 350]]) },
];
// the leaf beds in the clearing: [x0, z0, x1, z1] tilled in rows along z (1.2 m apart), kept 6.5 m off the pile and 3 m off the spill
export const BEDS0 = [[-345.2, 38.6, -337.4, 56.2], [-335.6, 38.4, -322.2, 49.4]], BEDS = BEDS0.map(RR);   // (BEDS0: today's, the leaf hero's rows and rolls)
// clearings: [x, z, r] — open grass, soft-edged (trees thin out over 6 m)
export const CLEARINGS = [[MEADOW[0], MEADOW[1], MEADOW[2], 'meadow'], ...[[-331, 58, 15, 'field'], [-321, 72, 9, 'field'],   // (the field opens south-east: the dig reads from the city side) [-297, -6, 8, 'yard'], [-372, 76, 8, 'yard'], [DECK[0], DECK[1], 10, 'yard'], [DUMP[0], DUMP[1], 5, 'yard'],
  [329, -111, 6, 'yard'], [-400, -151, 6, 'yard'], [-120, 390, 6, 'yard'], [120, 330, 12, 'meadow'], [300, -40, 10, 'meadow'], [-90, -200, 13, 'meadow'], [-420, -100, 11, 'meadow'], [180, -230, 9, 'meadow']].map(c => RC(c))];

// SPREAD · the woods give way to the hand-placed things. On a spread a tree whose crown would reach a leaf bed or one of the one-offs
// (a trunk, a boulder, a log or a stump where they stand) is left out: today none does (they were set where the woods were clear), but
// the woods are world noise and stay where they are while the hand-placed things move (HOLD: [x, z, r] in the spread world; none at 0)
const HOLD = SPREAD ? [[...STAND, 2.6], [...WRECK, 3.4], [...DUMP, 5.4], [DECK[0] + 3.2, DECK[1] + 1.35, 2.2], [...CAMP, 5.6], [...RM(-409.6, -142.8), 1.6]] : null;   // (the last: the west shack's outhouse)
const held = (x, z, r) => !!HOLD && (HOLD.some(([hx, hz, hr]) => Math.hypot(x - hx, z - hz) < hr + r) || BEDS.some(([x0, z0, x1, z1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)) < r + .3));

// ── geometry helpers
const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const lineD = (x, z, pts) => { let m = 1e9; for (let k = 0; k + 1 < pts.length; k++) m = Math.min(m, segD(x, z, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1])); return m; };
// the paths crossing a rect (+ margin), so a block tests only its own few segments
export function pathsIn(x0, z0, x1, z1, m = 6) { const hit = L => L.pts.some((p, k) => k + 1 < L.pts.length && Math.max(p[0], L.pts[k + 1][0]) > x0 - m && Math.min(p[0], L.pts[k + 1][0]) < x1 + m && Math.max(p[1], L.pts[k + 1][1]) > z0 - m && Math.min(p[1], L.pts[k + 1][1]) < z1 + m);
  return { tracks: TRACKS.filter(hit), trails: TRAILS.filter(hit) }; }
export const distTo = (x, z, list) => { let m = 1e9, id = null; for (const L of list) { const d = lineD(x, z, L.pts); if (d < m) { m = d; id = L.id; } } return [m, id]; };

// ── the roads: the plan's road geometry (world/city.js roadTop: a N–S road on x = L·P beside a block row, through its intersections),
// as metres from the nearest asphalt edge (< 0: on the asphalt). The edge roads' woods half lies inside our blocks.
export function roadDist(x, z) {
  let m = Infinity; const Lx = Math.round(x / P), Lz = Math.round(z / P), dx = Math.abs(x - Lx * P), dz = Math.abs(z - Lz * P);
  if (segX(Lx, Math.floor(z / P)) || (dz < rwZ(Lz) && (segX(Lx, Lz - 1) || segX(Lx, Lz)))) m = Math.min(m, dx - hwX(Lx));
  if (segZ(Lz, Math.floor(x / P)) || (dx < rwX(Lx) && (segZ(Lz, Lx - 1) || segZ(Lz, Lx)))) m = Math.min(m, dz - hwZ(Lz));
  return m;
}
// SPREAD · how much wider than today's 2 m the walk of the nearest road is (0 at SPREAD 0): the trees keep that much further back too
function walkExtra(x, z) { if (!SPREAD) return 0; const Lx = Math.round(x / P), Lz = Math.round(z / P), ex = Math.abs(x - Lx * P) - hwX(Lx), ez = Math.abs(z - Lz * P) - hwZ(Lz);
  return (ex < ez ? swX(Lx) : swZ(Lz)) - 2; }
// a block's sides that meet a road (the slab, ground.js slab, starts at the asphalt edge): the verge runs along them
export function slabOf(i, j) { return { x0: i * P + (segX(i, j) ? hwX(i) : 0), x1: (i + 1) * P - (segX(i + 1, j) ? hwX(i + 1) : 0), z0: j * P + (segZ(j, i) ? hwZ(j) : 0), z1: (j + 1) * P - (segZ(j + 1, i) ? hwZ(j + 1) : 0) }; }
export function sidesOf(i, j) { const s = slabOf(i, j), out = [];
  if (segZ(j, i)) out.push({ k: 'N', ax: 'x', cur: s.z0, dir: 1, a0: s.x0, a1: s.x1, hw: hwZ(j), sw: swZ(j), hwy: false });
  if (segZ(j + 1, i)) out.push({ k: 'S', ax: 'x', cur: s.z1, dir: -1, a0: s.x0, a1: s.x1, hw: hwZ(j + 1), sw: swZ(j + 1), hwy: false });
  if (segX(i, j)) out.push({ k: 'W', ax: 'z', cur: s.x0, dir: 1, a0: s.z0, a1: s.z1, hw: hwX(i), sw: swX(i), hwy: i === 7 });
  if (segX(i + 1, j)) out.push({ k: 'E', ax: 'z', cur: s.x1, dir: -1, a0: s.z0, a1: s.z1, hw: hwX(i + 1), sw: swX(i + 1), hwy: i + 1 === 7 });
  return out; }
// stitch pass · the outside of a bend. Where two edge roads meet at a corner of this block in an L and neither runs along this block (the
// block is the outside of the bend: 8 on the island), the verges of the two neighbours stop at their block lines and the crossing square
// poked into the forest floor. The sidewalk ring wraps round here instead: the corner square and the two stubs up to the block lines, a
// curb along the quarter of the crossing square that lies in this block (it stays road). → [{ x0, z0, x1, z1, q: [x0, z0, x1, z1] }]
export function bendCorners(i, j) { const out = [], span = (a, b) => a < b ? [a, b] : [b, a];
  for (const [Lx, Lz, sx, sz] of [[i, j, 1, 1], [i + 1, j, -1, 1], [i, j + 1, 1, -1], [i + 1, j + 1, -1, -1]]) {   // the node at each corner; (sx, sz) points into this block
    const N = segX(Lx, Lz - 1), S = segX(Lx, Lz), W = segZ(Lz, Lx - 1), E = segZ(Lz, Lx);
    if ((sz > 0 ? S : N) || (sx > 0 ? E : W) || !(sz > 0 ? N : S) || !(sx > 0 ? W : E)) continue;   // the two arms along this block absent, the two across present
    const X = Lx * P, Z = Lz * P, hx = hwX(Lx), hz = hwZ(Lz), [x0, x1] = span(X, X + sx * rwX(Lx)), [z0, z1] = span(Z, Z + sz * rwZ(Lz)), [qx0, qx1] = span(X, X + sx * hx), [qz0, qz1] = span(Z, Z + sz * hz);
    out.push({ x0, z0, x1, z1, q: [qx0, qz0, qx1, qz1] }); }
  return out; }

// ── the woods' character: species zones and density
//   deep: black pines (the dark ring) · mixed: pines, oaks, birches · park: the edge along the city (oaks, birches, a few maples)
//   autumn groves (maples in orange, red and yellow) · birches by the water · snags where it burned once (the north-west)
export const SP = { pine: 0, spruce: 1, oak: 2, maple: 3, birch: 4, snag: 5, bush: 6 };
function speciesAt(x, z, u, near) {
  const deep = fbm(x * .012 + 11, z * .012 - 7, 3), grove = fbm(x * .022 - 5, z * .022 + 9, 2), burn = fbm(x * .03 + 21, z * .03 + 4, 2), cd = cityDist(x, z), e = elev(x, z);
  if (burn > .68 && cd > 60) return u < .55 ? SP.snag : u < .8 ? SP.birch : SP.pine;                // an old burn: snags and birches
  if (e < 5.5) return u < .5 ? SP.birch : u < .75 ? SP.spruce : SP.pine;                             // the water's edge
  if (grove > .7 && cd > 20 && cd < 170) return u < .72 ? SP.maple : u < .88 ? SP.oak : SP.birch;   // an autumn grove (a few, deep enough to be found)
  if (near || cd < 22) return u < .42 ? SP.oak : u < .62 ? SP.birch : u < .7 ? SP.maple : u < .85 ? SP.pine : SP.spruce;   // the park edge
  const pineShare = .56 + (1 - deep) * .28 + Math.min(.12, Math.max(0, cd - 40) / 300);             // the dark ring: pines and spruces
  return u < pineShare ? (hash(Math.round(x), Math.round(z), 77) < .32 ? SP.spruce : SP.pine) : u < pineShare + .15 ? SP.oak : u < pineShare + .23 ? SP.birch : SP.maple;
}
// crown radius and height per species (m) — the crown may reach this far from the trunk
const R = [2.6, 2.2, 2.9, 2.6, 1.5, 1.0, 1.2], HMAX = [14.5, 16, 10, 9.5, 11, 9, 1.6];
export const REACH = 3.6;

// ── the tree grid: one candidate per 3.6 m cell, jittered; kept where the density field says so and nothing claims the ground
const CELL = 3.6;
export function treesNear(x0, z0, x1, z1) {
  const out = [], a0 = Math.floor((x0 - REACH) / CELL), a1 = Math.floor((x1 + REACH) / CELL), b0 = Math.floor((z0 - REACH) / CELL), b1 = Math.floor((z1 + REACH) / CELL);
  const { tracks, trails } = pathsIn(x0 - REACH, z0 - REACH, x1 + REACH, z1 + REACH, 8);
  for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const t = treeAt(a, b, tracks, trails); if (t && t.x + t.r > x0 && t.x - t.r < x1 && t.z + t.r > z0 && t.z - t.r < z1) out.push(t); }
  return out;
}
// how much ground a place leaves for a tree trunk: 0 (none) … 1 (all)
export function openness(x, z, tracks, trails) {
  const e = elev(x, z); if (e < SHORE + .8) return 0;
  const i = Math.floor(x / P), j = Math.floor(z / P); if (!isWoods(i, j)) return 0;
  if (roadDist(x, z) < 4.2 + walkExtra(x, z) || inLanding(x, z)) return 0;   // (stitch pass: nor on the ferry landing)
  const [dt] = distTo(x, z, tracks), [dr] = distTo(x, z, trails); if (dt < 3.4 || dr < 1.9) return 0;
  let f = 1; for (const [cx, cz, r] of CLEARINGS) { const d = Math.hypot(x - cx, z - cz); if (d < r) return 0; if (d < r + 7) f = Math.min(f, (d - r) / 7); }
  for (const k of Object.keys(YARDS)) { const [cx, cz, r] = YARDS[k]; if (Math.hypot(x - cx, z - cz) < r + 2.5) return 0; }
  if (segD(x, z, DOCK[0], DOCK[1], DOCK[2], DOCK[3]) < 4) return 0;
  if (HOLD && held(x, z, 0)) return 0;
  f *= Math.min(1, (e - SHORE - .8) / 2.5 + .35);
  return f;
}
function treeAt(a, b, tracks, trails) {
  const h0 = hash(a, b, 311), h1 = hash(a, b, 312), h2 = hash(a, b, 313), x = (a + .15 + h0 * .7) * CELL, z = (b + .15 + h1 * .7) * CELL;
  const rd = roadDist(x, z), park = rd < 10, cd = cityDist(x, z);
  const base = park ? .55 : cd < 40 ? .78 : .88, meadowy = fbm(x * .017 + 3.3, z * .017 - 8.1, 2);   // open glades where the noise is high
  const dens = base * (meadowy > .64 ? .25 : meadowy > .58 ? .6 : 1);
  if (h2 > dens) return null;
  const f = openness(x, z, tracks, trails); if (f <= 0 || hash(a, b, 314) > f) return null;
  let sp = speciesAt(x, z, hash(a, b, 315), park);
  if (hash(a, b, 318) < (park ? .08 : .14)) sp = SP.bush;
  if ((sp === SP.pine || sp === SP.spruce) && rd < 6) sp = SP.oak;   // (pines keep their low tiers off the verge)
  const v = hash(a, b, 316), s = .72 + v * .28 + (sp <= 1 ? Math.min(.18, Math.max(0, cd - 60) / 400) : 0);
  const h = Math.max(1.2, HMAX[sp] * s), r = R[sp] * (.8 + hash(a, b, 317) * .3); if (HOLD && held(x, z, r)) return null;
  return { a, b, x, z, sp, h, r, seed: (a * 7919 + b * 104729) | 0, v };
}
// where the woods are open enough for a prop: no trunk within 1 m, not on a path (for scatter: logs, rocks, stumps, ferns)
export const onPath = (x, z, tracks, trails, pad = 0) => distTo(x, z, tracks)[0] < 1.8 + pad || distTo(x, z, trails)[0] < .9 + pad;
export { segD, lineD };
