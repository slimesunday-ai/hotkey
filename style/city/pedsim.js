// Cleanup pass · THE WALKERS' SIMULATION (worker- and node-safe: no three, no DOM). peds.js draws it; the audit (main.js ?report,
// tools/audit.mjs district) runs the same code for 60 s per district and counts overlaps. One system for the whole island.
//   the graph   a node at every block corner (NODE m in from both curbs), an edge down every sidewalk, across every zebra crossing and along
//               every merged compound side. ONE-WAY: every block's sidewalk ring runs clockwise and every intersection's four crossings
//               anticlockwise, so walkers keep to the right of the street they walk and never meet anyone head-on on a 2 m sidewalk (a
//               walker is ~1 m wide: two can't pass there without walking through each other). The graph is strongly connected.
//   the lanes   on a built block a walker follows the lane its build carved (engine.js lanesOf) through the clear path the clear walkway
//               rule keeps (audit.js WALK); elsewhere the middle of the sidewalk
//   following   each walker looks only at the walker ahead on its own edge (every edge keeps its walkers sorted: O(n)), or, first on its
//               edge, at the last one on each edge out of the corner ahead (one that just turned elsewhere is still in its way there);
//               within PED.follow it slows to that walker's pace and never closes to less than PED.gap (along the path)
//   corners     a corner node is held by the stream of walkers that reached it first; walkers from another edge wait a beat outside
//               it, and a stream that has waited PED.fair s gets its turn. Agents: generic walkers never take a corner an agent is
//               coming to, and one walking ahead of an agent keeps the agent's pace.
//   passing     none: on a 2 m sidewalk there is no room for two walkers abreast, so a faster walker follows (speeds vary little)
//   density     walkers per 100 m of sidewalk = PED.base + PED.perDemand × the district's street demand (the sim's DEMAND [day, night];
//               CROWD for districts the sim has no street market in) × the kit's peds.density, ×2 in a Director rush
// ANIMATION MERGE (2026-09-29) · the anim lab's walk (anim/: gait2.js, turn.js, idle.js; peds.js draws it with walk2.js)
//   corner arcs  within ARC.r·tan(φ/2) of a corner node (≤ ARC.max) a walker leaves the lane's polyline for a quadratic Bézier through
//                the node (turn.js cornerPoint's curve, laid on the lanes themselves: the arc's ends are lane points, so a lane that bends
//                or a detour corner keeps it). The sim's following, gaps and corner locks stay by distance along the edges, as before.
//   heading      face(w): the drawn heading (w.yawS) chases the path's at a limited rate and angular acceleration (turn.js turnToward):
//                turns start and end softly; w.omega leans the body into a turn and leads the head. A walker not faced for a while
//                (out of view) snaps. A walker turning while (nearly) still shuffles its feet (gait2.js stepGait2's turn).
//   gait + idles animate(w, dt, G): the near walkers' gait (gait2.js, driven by the distance actually moved, sub-stepped at 1/120 s) and,
//                once stopped, an idle (idle.js): at a kerb the crossing wait, glancing at the ped signal across the street; elsewhere
//                (a corner's turn-taking, a queue, an agent at its spot) one of the lab's eight, picked by id (shots repeat).
import { P, segX, segZ, kindAt, urban, distOf, hwX, hwZ, isAve, swX, swZ, SWALK } from './plan.js';
import { P0 } from '../../world/city.js';   // (crowd hold: today's pitch — the crowd is counted on today's lengths, len0)
import { slab, signalPoles } from './ground.js';
import { turnToward, wrapPi } from './anim/turn.js';
import { WALK2, gait2State, stepGait2, LEVELS } from './anim/gait2.js';
import { IDLE, IDLE_POOL, stepIdle } from './anim/idle.js';
import { SIDE } from './style.js';
import { signalAt, phaseLeft, TIMING } from './traffic/rules.js';

// the sim's DEMAND (rules.mjs) + quieter defaults for districts the sim has no street market in
export const CROWD = { downtown: [4.5, 4.5], strip: [2, 10], trailer: [3, 4.5], suburbs: [1.5, 4], docks: [1.5, 4.5], industrial: [2, 3], highway: [1.5, 4.5],
  estates: [1, 1.5], hospital: [2, 1.5], mall: [1, .8], junkyard: [.6, .4], jail: [.3, .3], bridge: [.4, .4], forest: [0, 0], sea: [0, 0] };
export const PED = {
  base: 3.5, perDemand: 2.1,       // walkers per 100 m of sidewalk: base + perDemand × demand (downtown 4.5 → 13; Neon Row 7.7 by day, 24.5 at night)
  radius: 125,                     // walkers live within this of the focus
  gap: 1.1, follow: 2.6,           // never closer than gap (centre to centre, along the lane) to the walker ahead; slow down within follow
  node: 1.5, fair: 2.2,            // a walker needs the corner node from `node` m out; a stream that waited `fair` s gets its turn
  body: .3,                        // a walker's body radius (the audit's walker–walker overlap: two bodies closer than 2 × body)
  acc: 2.5, speed: [1.05, 1.3],    // acceleration (m/s²); preferred walking speeds
  dogs: .06, dogLead: .55,         // share of generic walkers out with a dog (peds.js draws it on the lane dogLead m ahead of them)
  grace: 2.5, settle: .8,          // fidelity pass: a walker leaves only after grace s unseen; a walker whose lane just arrived settles onto it over settle s
  // CROWD PASS (2026-10-05) · the fresh cast's big head (cast.js, 2026-10-02) is 1.0 m wide × 0.85 deep (the baked walker looks' median;
  // a tenth reach 1.2 with hair or a hat), 0.9–1.8 m up: wider than the body, so the spacing below is set by the head, not PED.body.
  // Every kerb, file and queue distance that was tuned for the old 0.8 m head is re-derived from it (see FILES, KERB, STEP); `turn` is the
  // gap behind a walker that has turned the corner ahead or is turning it (the chord across a right-angle corner is 0.7 × the gap along
  // the lanes, and a turning head is a box at an angle: its reach grows to 0.65 m). Measured in the live page (headless, 50 s at four
  // street corners): pairs of walkers whose head boxes intersect, per 1000 walker-frames, 84–104 → 5–7 (what is left: the second file stepping out
  // past the first at the kerb, and a turned head brushing a kerb waiter's); bodies (2 × PED.body) 0 before and after.
  head: [1.0, .85], turn: 1.8,
  // RIDERS AVOID (2026-10-08) · the crowd makes way for the sim's movers (simstate/movement.js publishes them every frame: sim.movers, each
  // with its next 1.6 s of path — true sync: where it will be is known exactly). A walker that one of them would pass within yieldR of
  // steps aside, inside the clear strip round its lane (the side room table, setRoom), by up to dodge m — or, when the mover cuts across
  // its way, stops short until it has passed — then steps back onto its lane. Never in a corner square (dodge falls to 0 within
  // dodgeNode m of a corner node), never on a kerb or a detour ramp. A walker without room data that side stays on its lane.
  yieldR: 1.05, yieldT: 1.6, dodge: .42, dodgeV: .9, dodgeBack: .45, dodgeA: 3, dodgeNode: 1.3, yieldOn: true,
  cornerT: 1.2, cornerR: 1.6,      // crowd hold: on a wider walk a corner a mover passes within cornerR m of in the next cornerT s is held for it (walkers along a side wait outside)
  roadWait: Infinity,              // transit sync: s a walker may stand in the road on a crossing, waiting for the corner, before it takes it — OFF in the page (no walker
                                   // stands there 10 s: measured); the node measuring tools (tools/transit-measure.mjs) set 2.5: with no block lanes (no kerb rows) their walkers jam at corners
};
// riders avoid · the side room table's encoding (tools/riderprobe.js makes it): a lane's hash, and one character per 5 cm (c −0.8 … 2.35)
export const laneHash = c => { let h = 2166136261; for (let k = 0; k < c.length; k++) h = Math.imul(h ^ (Math.round(c[k] * 100) & 0xffff), 16777619); return (h >>> 0).toString(36); };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const pedsPer100 = d => d > 0 ? PED.base + PED.perDemand * d : 0;
export const ARC = { r: .8, max: 1, turnRate: 3.2 };   // animation merge: corner arc radius (m), its reach cap along each edge (m); turn rate (rad/s)
export const NODE = 1.2;   // a corner node sits this far in from both curbs (clear of the corner signal post; engine.js lanesOf rests there too)
export const DETOUR_ROAD = .9;
// TRAFFIC PASS · the crossings obey the lights (traffic/rules.js signalAt on the shared clock): a walker waits at the kerb (STEP m out on
// the crossing, the kerb is at NODE) on DON'T WALK, steps off only on WALK and only when no car holds the zebra (traffic/sim.js crossBusy),
// and finishes on the flashing DON'T WALK. Two files wait side by side at the kerb (FILES: m away from the box, along the zebra), the
// rest queue on the sidewalk outside the corner; a walker coming off one crossing onto a closed one turns along the sidewalk instead.
// CROWD GRID (2026-10-10) · the corners: a zebra's walker waiting for its far corner stands kerb m short of the node (on the kerb, out of the
// road: the road is s < len − 1); a sidewalk walker takes a corner only when it can get clear m past the node without stopping (step's corners)
export const CORNER = { kerb: .9, clear: .75, hurry: 1.45, brake: 2, beat: .45 };
// CROWD GRID (2026-10-10) · the body map (step's gridBuild): cell m; pad: m kept between two bodies besides their radii; room: m more round a
// footprint the stage publishes (a scene's actors: passers-by give it room); look: m ahead a walker looks for someone standing in its way
// (+ 0.6 s at its pace); stuck: s behind the same body before it squeezes by on the bare radii; reach: m it may step aside round someone
// standing (inside the side's clear strip: a rider's step is PED.dodge); on: false — no map, as before
export const GRID = { cell: 2, pad: .06, room: .3, look: 1.2, stuck: 6, reach: 1.2, on: true };
export const STEP = 1.0, FILES = [0, 1.05];   // (crowd pass: the kerb spot 0.2 m from the curb, 1.0 from the corner node — a walker passing the node clears a waiter's head by its own half-width + the waiter's half-depth; the second file a head's width + 5 cm beside the first)
   // at a detour corner (a dealing crew holds the corner square: engine.js detourCornersOf) walkers go round it this far out in the road
// WALKERS-FIX ROUND (2026-09-28) · THE KERB-WAIT CLUMP. On DON'T WALK a corner fills up: file 0 at the kerb on the corner's line, then the
// second file's spot, then a ROW along the kerb (KERB.d apart, KERB.c m from the curb, beside the crossing, away from the box) that grows
// outward — each newcomer takes the file's spot and the row shuffles one place along to make room — then a queue up the sidewalk behind
// the corner, standing closer (KERB.stand) than walkers walk. On WALK the row drains back into the second file in order and pours across.
// The row's length: the kerb strip that is clear of everything (engine.js lanesOf kz, the build's own obstacles), where the next sidewalk's
// walkers pass behind it (their lane ≥ KERB.c + 0.64 from the curb), and the street demand (KERB.cap: 3 downtown, fewer where it is quiet,
// one fewer at a side street; walkers choose an avenue corner's crossings more, KERB.pull). A file never swings wide at the far kerb any more: it is back on the corner's line before it steps up.
export const KERB = { c: NODE - STEP, cs: [NODE - STEP, NODE - STEP + .06], ramp: [.55, .8, 1.0], rampX: .8, reach: 2.9, d: 1.05, side: .95, stand: .95, line: .9, pass: .95, pull: [.25, .04],
  cap: d => d >= 3.5 ? 3 : d >= 2 ? 2 : d >= 1 ? 1 : 0, merge: NODE + 1.1 + .6 };   // (crowd pass: d, the row's places, a head's width + 5 cm apart (was 0.72); stand, the queue's spacing, a head's depth + 10 cm (was 0.78); line: a row walker less than this out along the kerb is still in its file's line (was 0.62); pass: the next sidewalk's lane passes at least this behind the row (was 0.64) — a passer's half-width + a waiter's half-depth)

export function createPedSim({ night = false, seed = 0x9ed5, densityOf = () => 1, clock = null } = {}) {
  let s32 = seed >>> 0; const rnd = () => { s32 = (Math.imul(s32 ^ (s32 >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s32 / 4294967296; };
  // ── the directed sidewalk graph
  const nodes = new Map(), edges = [], lanes = new Map(), nk = (i, j, c) => i + ',' + j + ',' + c;
  const node = (i, j, c) => { const k = nk(i, j, c); let n = nodes.get(k); if (!n) { const s = slab(i, j), x = c[1] === 'W' ? s.x0 + NODE : s.x1 - NODE, z = c[0] === 'N' ? s.z0 + NODE : s.z1 - NODE;
    nodes.set(k, n = { k, i, j, c, x, z, out: [], inn: [], lockE: null, until: -1, waitE: null, waitT: 0, agentE: null, agentUntil: -1 }); } return n; };
  // dir +1: walkers go a → b, −1: b → a
  const edge = (a, b, dir, e) => { const E = { id: edges.length, a, b, dir, len: Math.hypot(b.x - a.x, b.z - a.z), list: [], ...e }; E.from = dir > 0 ? a : b; E.to = dir > 0 ? b : a; edges.push(E); E.from.out.push(E); E.to.inn.push(E); return E; };
  const has = (i, j, side) => urban(kindAt(i, j)) && (side === 'N' ? segZ(j, i) : side === 'S' ? segZ(j + 1, i) : side === 'W' ? segX(i, j) : segX(i + 1, j));
  for (let i = -32; i < 32; i++) for (let j = -32; j < 32; j++) { if (!urban(kindAt(i, j))) continue; const d = distOf(kindAt(i, j));
    // clockwise round the block: the N side runs east, E south, S west, W north
    if (has(i, j, 'N')) edge(node(i, j, 'NW'), node(i, j, 'NE'), 1, { i, j, side: 'N', dist: d });
    if (has(i, j, 'S')) edge(node(i, j, 'SW'), node(i, j, 'SE'), -1, { i, j, side: 'S', dist: d });
    if (has(i, j, 'W')) edge(node(i, j, 'NW'), node(i, j, 'SW'), -1, { i, j, side: 'W', dist: d });
    if (has(i, j, 'E')) edge(node(i, j, 'NE'), node(i, j, 'SE'), 1, { i, j, side: 'E', dist: d });
    // a side that runs on past a block with no cross street (a merged compound) joins its neighbour's lane, the same way round
    if (has(i, j, 'N') && !segX(i + 1, j) && has(i + 1, j, 'N')) edge(node(i, j, 'NE'), node(i + 1, j, 'NW'), 1, { i, j, side: 'N', dist: d, joint: true });
    if (has(i, j, 'S') && !segX(i + 1, j) && has(i + 1, j, 'S')) edge(node(i, j, 'SE'), node(i + 1, j, 'SW'), -1, { i, j, side: 'S', dist: d, joint: true });
    if (has(i, j, 'W') && !segZ(j + 1, i) && has(i, j + 1, 'W')) edge(node(i, j, 'SW'), node(i, j + 1, 'NW'), -1, { i, j, side: 'W', dist: d, joint: true });
    if (has(i, j, 'E') && !segZ(j + 1, i) && has(i, j + 1, 'E')) edge(node(i, j, 'SE'), node(i, j + 1, 'NE'), 1, { i, j, side: 'E', dist: d, joint: true }); }
  // zebra crossings, anticlockwise round every intersection: the north one runs west, the east one north, south east, west south
  for (let Lx = -31; Lx < 32; Lx++) for (let Lz = -31; Lz < 32; Lz++) {
    const q = (i, j, c, side) => has(i, j, side) ? nodes.get(nk(i, j, c)) : null, X = (a, b, dir, e) => a && b && edge(a, b, dir, { cross: true, Lx, Lz, nodeKey: Lx + ',' + Lz, key: Lx + ',' + Lz + ',' + e.arm, ...e });
    if (segX(Lx, Lz - 1)) X(q(Lx - 1, Lz - 1, 'SE', 'S'), q(Lx, Lz - 1, 'SW', 'S'), -1, { i: Lx, j: Lz - 1, dist: distOf(kindAt(Lx, Lz - 1)), arm: 'N' });   // north: across the N–S road
    if (segX(Lx, Lz)) X(q(Lx - 1, Lz, 'NE', 'N'), q(Lx, Lz, 'NW', 'N'), 1, { i: Lx, j: Lz, dist: distOf(kindAt(Lx, Lz)), arm: 'S' });                         // south
    if (segZ(Lz, Lx - 1)) X(q(Lx - 1, Lz - 1, 'SE', 'E'), q(Lx - 1, Lz, 'NE', 'E'), 1, { i: Lx - 1, j: Lz, dist: distOf(kindAt(Lx - 1, Lz)), arm: 'W' });     // west: across the E–W road
    if (segZ(Lz, Lx)) X(q(Lx, Lz - 1, 'SW', 'W'), q(Lx, Lz, 'NW', 'W'), -1, { i: Lx, j: Lz, dist: distOf(kindAt(Lx, Lz)), arm: 'E' }); }                        // east
  // traffic pass · each crossing: its key (traffic/sim.js bands), which way is "away from the box" (the second kerb file stands there)
  const crossings = new Map(); for (const E of edges) { if (!E.cross) continue; crossings.set(E.key, E); const ux = (E.to.x - E.from.x) / E.len, uz = (E.to.z - E.from.z) / E.len, mx = (E.a.x + E.b.x) / 2 - E.Lx * P, mz = (E.a.z + E.b.z) / 2 - E.Lz * P, sg = -uz * mx + ux * mz >= 0 ? 1 : -1; E.awx = -uz * sg; E.awz = ux * sg;
    E.narrow = !(E.arm === 'N' || E.arm === 'S' ? isAve('x', E.Lx) : isAve('z', E.Lz)); E.busy = isAve('x', E.Lx) || isAve('z', E.Lz); }   // (walkers-fix: a side street's crossing gathers one fewer at the kerb; an avenue's corners draw more walkers to their crossings)
  const deadEnds = [...nodes.values()].filter(n => n.inn.length && !n.out.length).length;   // (a corner with no way on: a walker stops there)
  // CROWD HOLD (2026-10-08) · len0(E): the edge's length on today's grid (SPREAD 0). The crowd is counted on it, so a block carries today's
  // walkers at any spread — the wider streets lengthen every side (by the new sidewalk width at each end) and every side street's crossing
  // (by its wider road), and per 100 m of the new length that was 11–18 % more walkers per block. Today's road half-width: a side street's
  // 2 m (hwX / hwZ grow by SPREAD / 4 there), an avenue's and Route 9's as they are. E.dl: what the spread added (kept apart, so a detour
  // that lengthens an edge later counts as it always did). At SPREAD 0 it is 0 and len0 IS len.
  const len0 = E => E.dl ? Math.max(.5, E.len - E.dl) : E.len, hwOf = (ax, L) => ax === 'x' ? hwX(L) : hwZ(L), hwGrow = (ax, L) => isAve(ax, L) ? 0 : hwOf(ax, L) - 2;
  for (const E of edges) { let dl = 0;
    if (E.cross) dl = E.arm === 'N' || E.arm === 'S' ? 2 * hwGrow('x', E.Lx) : 2 * hwGrow('z', E.Lz);
    else if (!E.joint) { const ns = E.side === 'N' || E.side === 'S'; dl = P - P0;
      if (ns) { if (segX(E.i, E.j)) dl -= hwGrow('x', E.i); if (segX(E.i + 1, E.j)) dl -= hwGrow('x', E.i + 1); }
      else { if (segZ(E.j, E.i)) dl -= hwGrow('z', E.j); if (segZ(E.j + 1, E.i)) dl -= hwGrow('z', E.j + 1); } }
    E.dl = dl;
    // (and a side's walk, its own width over today's: a walker steps aside that much further on a wider one — PED.dodge was set on 2 m)
    if (!E.cross && !E.joint) { E.sw = E.side === 'N' ? swZ(E.j) : E.side === 'S' ? swZ(E.j + 1) : E.side === 'W' ? swX(E.i) : swX(E.i + 1); E.wk = Math.max(1, E.sw / SWALK); if (E.wk > 1) E.from.wide = E.to.wide = true; } }

  // ── demand → walkers per 100 m on each edge (crowd: the adapter's per-district demand, already × the sim's rush; rush: the toggle)
  let crowd = null, rush = null;
  const demandOf = d => (crowd && crowd[d] !== undefined ? crowd[d] : (CROWD[d] || [1, 1])[night ? 1 : 0]) * (rush?.dist === d ? rush.mult : 1);
  const per100 = E => E.off ? 0 : pedsPer100(demandOf(E.dist)) * densityOf(E.dist);

  // ── where a walker is: along a side it follows the block's lane (c = metres from the curb), across a crossing a straight line
  // (fidelity pass: an edge keeps its slab and its lane side, re-read when a block's lanes arrive — where() runs for every walker every frame)
  let laneVer = 0; const laneOf = E => { if (E._lv !== laneVer) { E._lv = laneVer; E._L = lanes.get(E.i + ',' + E.j)?.sides?.[E.side] || null; } return E._L; }, slabOf = E => E._s || (E._s = slab(E.i, E.j));
  const laneC = (E, u) => { const L = laneOf(E); if (!L || E.joint) return NODE; const k = (u - L.u0) / (L.step || .5), a = Math.max(0, Math.min(L.c.length - 1, Math.floor(k))), b = Math.min(L.c.length - 1, a + 1), f = Math.max(0, Math.min(1, k - a)); return L.c[a] * (1 - f) + L.c[b] * f; };
  // RIDERS AVOID · the side room table (simstate/room.json, peds.js setRoom; tools/riderprobe.mjs --room makes it from the blocks' own
  // builds): round each side's lane every 0.2 m, the strip [lo, hi] (m from the curb) a walker-sized body may use without touching anything
  // the build left there. A side is read only if its lane is the very lane the table was made for (laneHash): a rebuilt block whose lane
  // moved has no room data until the table is remade, and its walkers and movers keep to the lane there.
  let ROOM = null, roomVer = 0;
  const roomOf = E => { if (E._rv === roomVer && E._rl === laneVer) return E._room; E._rv = roomVer; E._rl = laneVer; E._room = null;
    if (!ROOM || E.cross || E.joint) return null; const L = laneOf(E); if (!L) return null; const key = E.i + ',' + E.j, d = (night && ROOM.night[key]?.[E.side]) || ROOM.day[key]?.[E.side];
    if (!d || d[1] !== laneHash(L.c)) return null; const v2 = ROOM.version > 1, b0 = ROOM.base, rs = ROOM.res;   // (crowd hold: version 2, a spread's table — 7.5 cm from −0.8, so a 4 m walk fits)
    const dec = q => { const a = new Float32Array(q.length); for (let k = 0; k < q.length; k++) a[k] = v2 ? b0 + B64.indexOf(q[k]) * rs : (B64.indexOf(q[k]) - 16) / 20; return a; };
    return E._room = { u0: d[0], lo: dec(d[2]), hi: dec(d[3]) }; };
  // the strip a body may use along a side from ua to ub (the tightest sample between them), kept on the slab: out [lo, hi] or null
  function roomSpan(E, ua, ub, out) { const R = roomOf(E); if (!R) return null; const st = ROOM.step, n = R.lo.length;
    const a = Math.max(0, Math.floor((Math.min(ua, ub) - R.u0) / st)), b = Math.min(n - 1, Math.ceil((Math.max(ua, ub) - R.u0) / st)); if (a > b) return null;
    let lo = -9, hi = 9; for (let k = a; k <= b; k++) { if (R.lo[k] > lo) lo = R.lo[k]; if (R.hi[k] < hi) hi = R.hi[k]; } out[0] = Math.max(lo, .12); out[1] = Math.min(hi, E.sw > SWALK ? E.sw - .3 : 1.95); return out; }   // (crowd hold: on the side's own walk, a body's width in from its lot line — 1.95 on today's 2 m, as it was)
  // a side's lane coordinate: u (along) at s, and which way u runs along the edge (±1); the dodge axis in the world (+: away from the curb)
  const sideU = (E, s) => { const ns = E.side === 'N' || E.side === 'S', a = ns ? E.from.x : E.from.z, b = ns ? E.to.x : E.to.z; return a + (b - a) * s / E.len; };
  const sideDir = E => { const ns = E.side === 'N' || E.side === 'S'; return Math.sign(ns ? E.to.x - E.from.x : E.to.z - E.from.z) || 1; };
  const AXIS = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }, axisOf = (E, out) => { if (E.cross) { out[0] = E.awx; out[1] = E.awz; } else { const a = AXIS[E.side] || [0, 0]; out[0] = a[0]; out[1] = a[1]; } return out; };
  // a point `d` m ahead of a walker along its way (a walker's dog: peds.js)
  const tmpW = { E: null, s: 0, lat: 0, kx: 0 }; function ahead(w, d, out) { let E = w.E, s = w.s + d; if (s > E.len) { if (w.next) { s -= E.len; E = w.next; } s = Math.min(s, E.len); } tmpW.E = E; tmpW.s = s; tmpW.lat = E === w.E ? w.lat || 0 : E.cross ? FILES[fileFor(E)] : 0; tmpW.next = E === w.E ? w.next : null; tmpW.pE = E === w.E ? w.pE : w.E; return where(tmpW, out); }
  // traffic pass · a walker's file on a crossing: its offset eases in over the first 0.45 m and (walkers-fix) back out over the 1.1 m of
  // road before the far kerb, so it steps up on the corner's own line (it used to step up 0.7 m out, into the kerb strip's furniture);
  // plus its place along the kerb in the kerb-wait row (kx)
  const latAt = w => { const E = w.E, s = w.s; if (!E) return 0; const k = w.kx || 0; if (!w.lat) return k; return w.lat * Math.max(0, Math.min(1, s / .6, (E.len - s - NODE) / 1.1)) + k; };
  function where(w, out = w.p) { if (w.fix) { out[0] = w.fix[0]; out[1] = w.fix[1]; out[2] = w.fix[2]; out[3] = w.fix[3]; return out; }   // (SIM LIVE: an agent standing or stepping off the lanes)
    const E = w.E, from = E.from, to = E.to, q = w.s / E.len, dx = (to.x - from.x) / E.len, dz = (to.z - from.z) / E.len;
    let x = from.x + (to.x - from.x) * q, z = from.z + (to.z - from.z) * q, y = SIDE, fdx = dx, fdz = dz, ox = 0, oz = 0;
    if (E.cross) { if (Math.min(w.s, E.len - w.s) >= 1.05) y = 0; if (w.lat || w.kx || w.dg) { const l = latAt(w) + (w.dg || 0); ox = E.awx * l; oz = E.awz * l; }
      if (w.kv) { const f = Math.min(1, Math.abs(w.kv) / .5) * Math.sign(w.kv); fdx = dx * (1 - Math.abs(f)) + E.awx * f; fdz = dz * (1 - Math.abs(f)) + E.awz * f; } }   // (walkers-fix: a walker shuffling along the kerb turns to where it goes)
    else if (!E.joint) { const s = slabOf(E), ns = E.side === 'N' || E.side === 'S', u = ns ? x : z;
      let c = laneC(E, u);   // (the lane passes through the corner nodes itself: engine.js lanesOf)
      for (const n of [from, to]) { if (!n.detour) continue; const e = ns ? (n.c[1] === 'W' ? u - s.x0 : s.x1 - u) : (n.c[0] === 'N' ? u - s.z0 : s.z1 - u), { r0, r1 } = n.detour;   // a dealing corner: ramp down into the road and round it
        if (e <= r0) c = -DETOUR_ROAD; else if (e < r1) c = -DETOUR_ROAD + (c + DETOUR_ROAD) * (e - r0) / (r1 - r0); }
      if (w.cOff) c += w.cOff(E, u, c);   // (crowd hold: a rider's own line on a wider walk — simstate/movement.js bandOff)
      if (c < -.05) y = 0; else if (w.dg) c += w.dg;   // (riders avoid: a walker stepping aside, in metres from the curb)
      if (E.side === 'W') x = s.x0 + c; else if (E.side === 'E') x = s.x1 - c; else if (E.side === 'N') z = s.z0 + c; else z = s.z1 - c; }
    if ((w.pE || w.next) && arcAt(w, x, z)) { x += AR[0]; z += AR[1]; if (!w.kv) { fdx = AR[2]; fdz = AR[3]; } }   // (animation merge: round the corner)
    x += ox; z += oz;
    if (w.jt !== undefined) { const f = 1 - (t - w.jt) / PED.settle; if (f > 0) { const e = f * f * (3 - 2 * f); x += w.jx * e; z += w.jz * e; } else w.jt = undefined; }   // (fidelity pass: settling onto a lane that just arrived)
    out[0] = x; out[1] = y; out[2] = z; out[3] = Math.atan2(fdx, fdz); return out; }
  // animation merge · the corner arc: the walker is sr m from the corner node between edge A (in) and B (out) (sr < 0: still on A). Its bare
  // lane point (bx, bz) moves by the Bézier (A's lane point t before the node → the node's → B's t after it) minus the polyline; the
  // heading is the Bézier's. Both sides of the node compute the same curve (w.next before it, w.pE after), so nothing jumps there.
  const tmpA = { E: null, s: 0 }, PA = [0, 0, 0, 0], PB = [0, 0, 0, 0], PC = [0, 0, 0, 0], AR = [0, 0, 0, 0];
  function arcAt(w, bx, bz) { const E = w.E; let A, B, sr;
    if (w.pE && w.s < ARC.max) { A = w.pE; B = E; sr = w.s; } else if (w.next && E.len - w.s < ARC.max) { A = E; B = w.next; sr = w.s - E.len; } else return false;
    let K = w._arc; if (!K || K.A !== A || K.B !== B || K.lv !== laneVer || K.la !== A.len) {   // (the curve, once per corner per lanes version)
      const phi = Math.acos(Math.max(-1, Math.min(1, ((A.to.x - A.from.x) * (B.to.x - B.from.x) + (A.to.z - A.from.z) * (B.to.z - B.from.z)) / (A.len * B.len))));
      let t = phi < .02 || phi > 2.7 ? 0 : Math.min(ARC.r * Math.tan(phi / 2), ARC.max, A.len * .45, B.len * .45);
      // (crowd grid · walker jumps: straight on through a corner whose lanes don't meet at its node — a pinched corner, where the build's lane
      // skirts something standing on the node — the two lanes are joined by the same curve over ARC.max each side: the walker stepped 1–1.5 m
      // sideways in one frame there)
      if (!(t > 0) && phi < .02) { tmpA.E = A; tmpA.s = A.len; where(tmpA, PB); tmpA.E = B; tmpA.s = 0; where(tmpA, PC); if (Math.hypot(PB[0] - PC[0], PB[2] - PC[2]) > .05) t = Math.min(ARC.max, A.len * .45, B.len * .45); }
      K = w._arc = { A, B, lv: laneVer, la: A.len, t, p: [0, 0, 0, 0, 0, 0] };
      if (t > 0) { tmpA.E = A; tmpA.s = A.len - t; where(tmpA, PA); tmpA.s = A.len; where(tmpA, PB); tmpA.E = B; tmpA.s = t; where(tmpA, PC); K.p = [PA[0], PA[2], PB[0], PB[2], PC[0], PC[2]]; } }
    const t = K.t; if (!(t > 0) || Math.abs(sr) >= t) return false; const [ax, az, bx2, bz2, cx, cz] = K.p;
    const f = (sr + t) / (2 * t), a = (1 - f) * (1 - f), b = 2 * (1 - f) * f, c = f * f;
    AR[0] = a * ax + b * bx2 + c * cx - bx; AR[1] = a * az + b * bz2 + c * cz - bz;
    const hx = (1 - f) * (bx2 - ax) + f * (cx - bx2), hz = (1 - f) * (bz2 - az) + f * (cz - bz2), l = Math.hypot(hx, hz) || 1; AR[2] = hx / l; AR[3] = hz / l; return true; }
  // fidelity pass · a block's lanes (or a dealing corner's detour) arrive while walkers are on its sidewalks: they would jump sideways to
  // the new lane (up to ~0.8 m) in one frame. Each keeps where it was and settles onto the lane over PED.settle s instead.
  function settle(i, j, change) { const mine = walkers.filter(w => w.E && !w.fix && (w.E.i === i && w.E.j === j || w.E.from.i === i && w.E.from.j === j || w.E.to.i === i && w.E.to.j === j));
    const before = mine.map(w => { where(w); return [w.p[0], w.p[2]]; }); change();
    mine.forEach((w, k) => { if (!w.E) return; w.jt = undefined; where(w); const jx = before[k][0] - w.p[0], jz = before[k][1] - w.p[2]; if (Math.abs(jx) + Math.abs(jz) > .005) { w.jx = jx; w.jz = jz; w.jt = t; where(w); } }); }
  // a block's build names its detour corners (lanes.detour): the node moves out into the intersection's corner, the corner's crossings close
  function applyDetours(i, j, list) { for (const d of list || []) { const n = nodes.get(nk(i, j, d.c)); if (!n || n.detour) continue; const s = slab(i, j);
    n.detour = { r0: d.r0, r1: d.r1 }; n.x0 ??= n.x; n.z0 ??= n.z; n.x = d.c[1] === 'W' ? s.x0 - DETOUR_ROAD : s.x1 + DETOUR_ROAD; n.z = d.c[0] === 'N' ? s.z0 - DETOUR_ROAD : s.z1 + DETOUR_ROAD;
    for (const E of n.out.concat(n.inn)) { E.len = Math.hypot(E.b.x - E.a.x, E.b.z - E.a.z); if (E.cross) E.off = true; }   // (fidelity pass: anyone already on a crossing that closes walks on across it: they used to vanish mid-street)
    for (const w of walkers) { if (!w.E) continue; if (w.next?.off && !w.agent) w.next = pickNext(w.E); if (w.s > w.E.len) w.s = w.E.len - .01; }   // (SIM LIVE: an agent off the lanes has no edge)
    for (const w of agents) reroute(w); } }   // (SIM LIVE pass: an agent already on its way goes round the closed crossing)

  // ── walkers
  const walkers = [], agents = []; let looks = 1, nextId = 1;
  // (walkers-fix: at a corner a crossing draws KERB.pull × the street demand more of the walkers: a busy district's walkers cross more)
  const wOut = o => (per100(o) + .5) * (o.cross ? 1 + KERB.pull[o.busy ? 0 : 1] * demandOf(o.dist) : 1);
  const pickNext = E => { const outs = E.to.out.filter(o => !o.off); if (outs.length < 2) return outs[0] || null; let sum = 0; for (const o of outs) sum += wOut(o); let x = rnd() * sum; for (const o of outs) { x -= wOut(o); if (x <= 0) return o; } return outs[outs.length - 1]; };
  const dogOf = id => { const h = Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d) >>> 0; return (h % 1000) / 1000 < PED.dogs ? (h >>> 10) % 20 : -1; };   // (by id: no draw from the rng, so the crowd itself doesn't change)
  // the edge lists' one invariant: w.k IS the walker's index in w.E.list, at every moment of a step (step() takes the walker ahead as
  // E.list[w.k - 1]). step() sorts and numbers each busy list once per frame, but walkers leave lists in the middle of it (round a corner),
  // so every removal renumbers the walkers behind it and every arrival is numbered where it lands. (2026-10-07: two far walkers — they
  // move every third frame and keep no gap, so they bunch — left an edge in the same step; the near walker last on it then read past the
  // list's end, "reading 's'" at the lead lookup, and the throw stopped the frame loop. One leaving made the walker behind lead itself.)
  const enlist = (E, w) => { w.k = E.list.push(w) - 1; busy.add(E); };
  const unlist = w => { const L = w.E?.list, q = L ? L.indexOf(w) : -1; if (q < 0) return; L.splice(q, 1); for (let i = q; i < L.length; i++) L[i].k = i; };
  function spawn(E, s, o = {}) { const [v0, v1] = PED.speed, id = nextId++, w = { id, born: t, E, s, v: o.v ?? (v0 + rnd() * (v1 - v0)), vc: 0, look: o.look ?? ((rnd() * looks) | 0), ph: rnd() * 6.28, next: null, k: 0, agent: !!o.agent, route: o.route || null, held: 0, p: [0, 0, 0, 0], dog: o.agent ? -1 : dogOf(id), off: false, halt: false, goal: null, fix: null, arrived: false, lat: 0, kx: 0, kt: 0, kv: 0, pE: null, blk: null, sdT: -1e9, sdW: 0, sdX: 0, sdZ: 0, sdR: 0, bsO: -1, bsT: -1e9, bsS: 0, _bsE: null, _bsF: -1, _bsS0: 0, _bsV: 1e9, _bsH: 1e9, dg: 0, dgv: 0, dgT: -1e9, dgW: 0, gone: false, aid: undefined, mv: null, tq: null, lift: 0, stagePose: null, npc: undefined, tier: undefined, dn: 0, seenT: undefined, outF: undefined, onF: undefined, drawnF: undefined, aF: undefined, g: undefined, gx: 0, gz: 0, fT: undefined, yawS: undefined, omega: 0, dyaw: 0, nIdle: 0, jt: undefined, jx: 0, jz: 0, ko: undefined, _arc: undefined, propKind: undefined, propF: undefined, propSlot: undefined, propSlots: undefined, bpDone: undefined };   // (crowd grid: every field a walker will ever carry — the grid's, the drawing's (peds.js), the agents' and the stage's — from birth, so its shape never changes: fields added mid-life made the step's reads of every walker megamorphic, and the crowd's frame cost nearly doubled)
    w.vc = w.v; w.next = w.route ? w.route.shift() || null : pickNext(E); walkers.push(w); enlist(E, w); where(w); return w; }
  const clearAt = (E, s) => !E.cross && s > PED.node + .4 && s < E.len - PED.node - .4 && !E.list.some(o => Math.abs(o.s - s) < PED.gap + .6);   // spawn with a gap, never in a corner (traffic pass: nor out in the road)
  const generic = () => walkers.length - agents.length;
  function drop(w) { w.gone = true; const k = walkers.indexOf(w); if (k >= 0) walkers.splice(k, 1); unlist(w); }   // (SIM LIVE: an agent off the lanes is on no edge)
  // fidelity pass · o.seen(p, spawn) (peds.js: could the camera see a walker at p? p = [x, y, z]) and o.cam ([x, z, r]: a second disc, round
  // the camera, as far as the walkers are drawn): walkers live in both discs; one leaves only when nobody has seen it for PED.grace s, and
  // one arrives only where nobody can see it happen (out of the view, or past the walkers' range). The first fill (a load-in, a go-to) is
  // anywhere. Without o.seen (the walk check) this is the pass-2 rule exactly: the focus disc, arrivals in its outer ring.
  const TP = [0, 0, 0, 0], tmpS = { E: null, s: 0 };
  function populate(focus, first, o = {}) {
    if (o.seen) return populateSeen(focus, first, o);
    const near = [], R2 = PED.radius * PED.radius; let target = 0;
    for (const E of edges) { const mx = (E.a.x + E.b.x) / 2 - focus.x, mz = (E.a.z + E.b.z) / 2 - focus.z; if (mx * mx + mz * mz < R2) { near.push(E); target += per100(E) * len0(E) / 100; } }   // (crowd hold: today's length)
    const want = Math.round(target);
    for (let k = walkers.length - 1; k >= 0; k--) { const w = walkers[k]; if (w.agent) continue; where(w); if (Math.hypot(w.p[0] - focus.x, w.p[2] - focus.z) > PED.radius * 1.12) drop(w); }
    const outer = near.filter(E => Math.hypot((E.a.x + E.b.x) / 2 - focus.x, (E.a.z + E.b.z) / 2 - focus.z) > PED.radius * .78), pool = first || !outer.length ? near : outer;
    const wsum = pool.reduce((s, E) => s + per100(E) * len0(E), 0); let guard = 0;
    while (wsum > 0 && generic() < want && guard++ < 6000) { let x = rnd() * wsum, E = pool[0]; for (const e of pool) { x -= per100(e) * len0(e); if (x <= 0) { E = e; break; } }
      const s = rnd() * E.len; if (clearAt(E, s)) spawn(E, s); }
    if (generic() > want * 1.25) for (let k = walkers.length - 1; k >= 0 && generic() > want * 1.1; k--) if (!walkers[k].agent) drop(walkers[k]);
    return want;
  }
  function populateSeen(focus, first, o) {
    const r0 = PED.radius, cam = o.cam, seen = o.seen, fx = focus.x, fz = focus.z;
    const inR = (x, z, pad) => { const dx = x - fx, dz = z - fz; if (dx * dx + dz * dz < (r0 + pad) ** 2) return true; if (!cam || cam[2] <= 0) return false; const ex = x - cam[0], ez = z - cam[1]; return ex * ex + ez * ez < (cam[2] + pad) ** 2; };
    const near = [], tgt = []; let target = 0;
    for (const E of edges) { if (!inR((E.a.x + E.b.x) / 2, (E.a.z + E.b.z) / 2, 0)) continue; const n = per100(E) * len0(E) / 100; if (n <= 0) continue; near.push(E); tgt.push(n); target += n; }
    const want = Math.round(target), unseen = w => first || (t - (w.seenT ?? -1e9) >= PED.grace && !seen(w.p, false)), mine = E => { let n = 0; for (const w of E.list) if (!w.agent) n++; return n; };
    for (let k = walkers.length - 1; k >= 0; k--) { const w = walkers[k]; if (w.agent) continue; where(w); if (!inR(w.p[0], w.p[2], 14) && unseen(w)) drop(w); }   // out of both discs, and unseen for a while
    // fidelity pass (zoom round) · every edge is kept at ITS OWN density: arrivals go to the edges short of theirs (out of view), and when
    // the crowd is over its number the unseen walkers on the fullest edges leave. Spread over the whole disc, the arrivals used to land
    // mostly behind and beside the camera, so the streets ahead (in view, where nobody may appear) thinned out the longer it moved forward.
    const cnt = near.map(mine); let n = generic();
    if (n > want) { const over = near.map((E, k) => [E, cnt[k] - tgt[k]]).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]);
      for (const [E, sur] of over) { if (n <= want) break; let m = Math.floor(sur); for (const w of E.list.slice()) { if (m <= 0 || n <= want) break; if (w.agent || !unseen(w)) continue; drop(w); m--; n--; } } }
    // the emptiest edges first (the band the camera is moving into is empty: it must fill before it comes into view), ties at random
    const order = near.map((E, k) => k).filter(k => tgt[k] > cnt[k]), key = order.map(k => cnt[k] / tgt[k] + rnd() * .05), ix = order.map((k, q) => q).sort((a, b) => key[a] - key[b]);
    for (const q of ix) { if (n >= want * 1.05) break; const k = order[q], E = near[k], d = tgt[k] - cnt[k]; let m = Math.floor(d) + (rnd() < d % 1 ? 1 : 0);
      for (let tries = 0; m > 0 && tries < m * 4 + 2; tries++) { const s = rnd() * E.len; if (!clearAt(E, s)) continue;
        if (!first) { tmpS.E = E; tmpS.s = s; where(tmpS, TP); if (seen(TP, true)) continue; }   // (never in view)
        spawn(E, s); m--; n++; } }
    return want;
  }

  // ── agents (sim agents in the viewer): the same graph, lanes and following; they route to a target on the one-way graph, and generic
  // walkers yield to them. A new target re-routes; one that arrives walks on like anyone until it is given another.
  function route(a, b) {   // the shortest way on the directed graph (Dijkstra over edge lengths) → [edges]
    if (a === b) return []; const dist = new Map([[a, 0]]), prev = new Map(), open = new Set([a]);
    while (open.size) { let n = null; for (const o of open) if (!n || dist.get(o) < dist.get(n)) n = o; open.delete(n); if (n === b) break;
      for (const E of n.out) { if (E.off) continue; const d = dist.get(n) + E.len; if (d < (dist.get(E.to) ?? Infinity)) { dist.set(E.to, d); prev.set(E.to, E); open.add(E.to); } } }   // (SIM LIVE pass: never over a closed crossing — a dealing crew's corner)
    if (!prev.has(b)) return null; const out = []; for (let n = b; n !== a;) { const E = prev.get(n); out.unshift(E); n = E.from; } return out; }
  const nodeNear = (x, z) => { let best = null, bd = 1e9; for (const n of nodes.values()) { if (!n.out.length) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  function addAgent({ id, look = 0, from, to, v = 1.25 }) {
    const a = nodeNear(from[0], from[1]), r = route(a, nodeNear(to[0], to[1])); if (!r || !r.length) return null;
    const E = r.shift(); if (!clearAt(E, PED.node + .5)) return null; const w = spawn(E, PED.node + .5, { agent: true, look, route: r, v }); w.aid = id; agents.push(w); return w; }
  function setAgentTarget(id, to) { const w = agents.find(a => a.aid === id); if (!w) return false; const r = route(w.E.to, nodeNear(to[0], to[1])); if (!r) return false; w.route = r.slice(1); w.next = r[0] || pickNext(w.E); w.arrived = false; return true; }
  function removeAgent(id) { const k = agents.findIndex(w => w.aid === id); if (k < 0) return; drop(agents[k]); agents.splice(k, 1); }

  // ── SIM LIVE pass · what the sim's own agents need (simstate/agents.js drives them; addAgent above stays the demo's and the walk check's).
  // A sim agent walks a WAY (edges) to a GOAL — a lane point where it halts (w.halt: it stops there, the walkers behind wait at their
  // gap) to step off the lanes to a stand spot, or to go indoors. Off the lanes it stands at w.fix ([x, y, z, ry]: on no edge, so no
  // walker ever meets it there; stand spots keep clear of every lane: simstate/stands.json). Stepping back on, it halts at its lane point
  // first (only where the lane is clear), then walks. Its speed (w.v) is set by the driver to keep to the sim's trip times.
  //   laneNear(x, z)      the nearest lane point to a spot: { E, s, d } on a sidewalk side (never a crossing)
  //   routeFast(a, b)     route()'s shortest way with a heap (A*): a trip crosses the island, where route()'s scan costs milliseconds
  //   wayTo(E, s, goal)   the edges after (E, s) to a lane point goal ([] when it is ahead on the same side), or null (no way: an island)
  //   laneClear(E, s)     nobody within the walkers' gap of a lane point, on it or coming off the corner into it
  //   putAgent(o)         a sim agent on a lane point (o.E, o.s) or standing off the lanes (o.fix) · goAgent(w, way, goal) sends it on
  //   offAgent(w, fix)    it leaves its lane point (off the edge) · onAgent(w, E, s) it takes a lane point (halted until the driver lets go)
  const sideEdges = edges.filter(E => !E.cross), byBlock = new Map();
  for (const E of sideEdges) { const k = E.i + ',' + E.j; if (!byBlock.has(k)) byBlock.set(k, []); byBlock.get(k).push(E); }
  function laneNear(x, z, maxD = 48) { let best = null, bd = maxD; const bi = Math.floor(x / P), bj = Math.floor(z / P);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const E of byBlock.get((bi + a) + ',' + (bj + b)) || []) { if (E.off || E.len < 2 * PED.node + 1.4) continue;
      const fx = E.from.x, fz = E.from.z, ux = (E.to.x - fx) / E.len, uz = (E.to.z - fz) / E.len, s = Math.max(PED.node + .6, Math.min(E.len - PED.node - .6, (x - fx) * ux + (z - fz) * uz));
      const d = Math.hypot(fx + ux * s - x, fz + uz * s - z); if (d < bd) { bd = d; best = { E, s, d }; } }
    return best; }
  function routeFast(a, b) {
    if (a === b) return []; const g = new Map([[a, 0]]), prev = new Map(), H = [], done = new Set(), h = n => Math.hypot(n.x - b.x, n.z - b.z);
    const push = (n, f) => { H.push([f, n]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
    const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
    push(a, h(a));
    while (H.length) { const n = pop()[1]; if (done.has(n)) continue; done.add(n); if (n === b) break;
      for (const E of n.out) { if (E.off) continue; const d = g.get(n) + E.len; if (d < (g.get(E.to) ?? Infinity)) { g.set(E.to, d); prev.set(E.to, E); push(E.to, d + h(E.to)); } } }
    if (!prev.has(b)) return null; const out = []; for (let n = b; n !== a;) { const E = prev.get(n); out.unshift(E); n = E.from; } return out; }
  // an agent whose way crosses a crossing that a detour just closed goes round: to its goal (a sim agent), or to where it was going (the
  // demo's and the walk check's agents); with no way round, it walks on like anyone
  function reroute(w) { if (!w.E || w.halt) return; const way = [w.next, ...(w.route || [])].filter(Boolean); if (!way.some(E => E.off)) return;
    if (w.goal) { const r = wayTo(w.E, w.s, w.goal); if (r) goAgent(w, r, { E: w.goal.E, s: w.goal.s }); else { w.next = pickNext(w.E); w.route = []; w.goal = null; } return; }
    const r = route(w.E.to, way[way.length - 1].to); if (r) { w.route = r.slice(1); w.next = r[0] || pickNext(w.E); } else { w.next = pickNext(w.E); w.route = []; } }
  const wayTo = (E, s, goal) => { if (E === goal.E && s <= goal.s + 1e-6) return []; const r = routeFast(E.to, goal.E.from); return r ? r.concat([goal.E]) : null; };
  function laneClear(E, s, back = 2.6, ahead = 1.6) {
    for (const o of E.list) if (o.s > s - back && o.s < s + ahead) return false;
    if (s < back) for (const I of E.from.inn) for (const o of I.list) if (I.len - o.s < back - s) return false;
    if (s + ahead > E.len) for (const O of E.to.out) for (const o of O.list) if (o.s < s + ahead - E.len) return false;
    return true; }
  function goAgent(w, way, goal) { w.next = way[0] || null; w.route = way.slice(1); w.goal = goal ? { E: goal.E, s: goal.s, armed: w.E === goal.E && w.s <= goal.s + 1e-6 } : null; w.halt = false; w.fix = null; w.arrived = false; }
  function putAgent({ id, look = 0, E = null, s = 0, way = [], goal = null, v = 1.25, fix = null, check = true }) {
    if (!E && !fix) return null; if (E && check && !laneClear(E, s)) return null;
    const w = { id: nextId++, E, s, v, vc: 0, look, ph: 0, next: null, k: 0, agent: true, route: [], held: 0, p: [0, 0, 0, 0], dog: -1, aid: id, off: !E, halt: false, goal: null, fix: fix ? fix.slice() : null, arrived: false, lat: 0, kx: 0, kt: 0, kv: 0, pE: null, blk: null, sdT: -1e9, sdW: 0, sdX: 0, sdZ: 0, sdR: 0, bsO: -1, bsT: -1e9, bsS: 0, _bsE: null, _bsF: -1, _bsS0: 0, _bsV: 1e9, _bsH: 1e9, dg: 0, dgv: 0, dgT: -1e9, dgW: 0, gone: false, mv: null, tq: null, lift: 0, stagePose: null, npc: undefined, tier: undefined, dn: 0, seenT: undefined, outF: undefined, onF: undefined, drawnF: undefined, aF: undefined, g: undefined, gx: 0, gz: 0, fT: undefined, yawS: undefined, omega: 0, dyaw: 0, nIdle: 0, jt: undefined, jx: 0, jz: 0, ko: undefined, _arc: undefined, propKind: undefined, propF: undefined, propSlot: undefined, propSlots: undefined, bpDone: undefined };
    walkers.push(w); agents.push(w); if (E) { enlist(E, w); goAgent(w, way, goal); w.fix = fix ? fix.slice() : null; } where(w); return w; }
  function offAgent(w, fix) { unlist(w); w.E = null; w.pE = null; w.off = true; w.halt = false; w.goal = null; w.next = null; w.route = []; w.fix = fix.slice(); w.vc = 0; }
  function onAgent(w, E, s) { w.E = E; w.s = s; w.pE = null; enlist(E, w); w.off = false; w.halt = true; w.goal = null; }

  // ── one step: lane following and the corners, then the walk. O(n): each edge's list is sorted, each walker reads one neighbour.
  let t = 0; const stat = { ms: 0, avg: 0, max: 0, n: 0, dontWalk: 0, stepOffs: 0 }, busy = new Set();
  // traffic pass · the lights and the cars: WALK on a crossing (the shared clock, else this sim's own), a car holding its zebra (the page sets
  // cars: traffic/render.js), whether a file at the kerb has room, which file a walker coming onto a crossing takes
  const now = () => clock ? clock() : t; let cars = null;
  const walkOK = E => { if (E._st !== sf) { E._st = sf; const g = signalAt(E.Lx, E.Lz, now()); E._wk = E.arm === 'N' || E.arm === 'S' ? g.walkAcrossNS : g.walkAcrossEW; } return E._wk; };
  const open = E => walkOK(E) && !(cars && cars.busy(E.key));
  // (walkers-fix: someone stepped along the kerb into the row is out of its file's line: not its rear)
  const fileRear = (E, f) => { let m = null; for (const o of E.list) if ((o.lat || 0) === FILES[f] && (o.kx || 0) < KERB.line && (!m || o.s < m.s)) m = o; return m; };
  const room0 = E => { const r = fileRear(E, 0); return !r || r.s >= PED.gap + .2; };
  // walkers-fix round · the kerb-wait row of a crossing (see KERB): its geometry once per lanes version — f1: the second file may stand at
  // the kerb (its spot and its step out to it are clear), k: row places beyond it — and the demand's cap on it
  const kerbOf = X => { if (X._kv === laneVer) return X._kb; X._kv = laneVer; const n = X.from, O = n.out.find(o => !o.cross && !o.joint), L = O ? laneOf(O) : null;
    const D = L?.kz ? L.kz[O.dir > 0 ? 0 : 1] : null, lat = m => FILES[1] + m * KERB.d, ns = O && (O.side === 'N' || O.side === 'S');
    const sg = O ? Math.sign(ns ? O.to.x - O.from.x : O.to.z - O.from.z) : 0, u0 = ns ? n.x : n.z;
    const laneOK = x => { if (!L) return true; for (let y = Math.max(0, x - .95); y <= x + .95 + 1e-6; y += .1) if (laneC(O, u0 + sg * y) < KERB.c + KERB.pass) return false; return true; };   // (the next sidewalk's walkers pass behind the row)
    const f1 = D === null ? true : D >= FILES[1] - 1e-6 && laneOK(FILES[1]); let k = 0;   // (no kz: lanes not built yet, or baked before this round: the second file as before, no row)
    if (D !== null && f1 && !n.detour) while (k < 3 && lat(k + 1) <= D + 1e-6 && laneOK(lat(k + 1))) k++;
    return X._kb = { f1, k }; };
  const kCap = X => Math.min(kerbOf(X).k, Math.max(0, KERB.cap(demandOf(X.dist)) - (X.narrow ? 1 : 0)));
  const onRow = o => o.lat === FILES[1] && o.s < STEP + .01;   // (the second file at the kerb, or walking out to it)
  // a closed crossing's second file: 'ready' (a newcomer can walk to the file's spot now), 'wait', 'shift' (the row can move up one
  // place to make room: kerbShift) or 'full'
  function row1(E) { if (!kerbOf(E).f1) return 'full'; let n = 0, minK = 1e9, maxK = -1, moving = false;
    for (const o of E.list) { if (!o.lat && o.s < STEP - .05) return 'wait';   // (file 0 still walking out to the kerb, or a dog owner standing short of it)
      if (!onRow(o)) continue; n++; const kx = o.kx || 0, kt = o.kt || 0; if (o.s < STEP - .05 && kx < KERB.line) return 'wait';
      if (kt < minK) minK = kt; if (kt > maxK) maxK = kt; if (kx < KERB.line) moving = true; }
    if (!n) return 'ready'; if (minK >= KERB.d - .01) return moving ? 'wait' : 'ready';
    return maxK + KERB.d <= kCap(E) * KERB.d + .01 ? 'shift' : 'full'; }
  const kerbShift = E => { for (const o of E.list) if (onRow(o)) o.kt = (o.kt || 0) + KERB.d; };
  const kerbReady = E => room0(E) || row1(E) === 'ready';
  // the walker a newcomer onto a crossing follows: the rear of the file it will take, or anyone still walking out to the kerb (the second
  // file's step out passes close by the first's line)
  const entryLead = X => { if (X._elf === sf) return X._el; X._elf = sf; return X._el = entryLead0(X); }, entryLead0 = X => { let m = fileRear(X, fileFor(X)); for (const o of X.list) if (o.s < STEP - .05 && (o.kx || 0) < KERB.line && !(o.dog >= 0 && o.s > STEP - .25) && (!m || o.s < m.s)) m = o; return m; };   // (crowd grid: a dog owner standing short of the kerb, its dog at it, is at its spot — not walking out: the walkers off the zebra behind it waited in the road for its WALK)
  // which file a walker coming onto a crossing takes: on DON'T WALK the kerb (file 0's spot, then the second file's); on WALK the file
  // with the most room (not the second while its row drains back into it)
  const fileFor = E => { if (!open(E)) return room0(E) ? 0 : row1(E) === 'ready' ? 1 : 0;
    const f1 = kerbOf(E).f1 && !E.list.some(o => o.lat === FILES[1] && (o.kx || 0) > .01); let best = 0, room = -1;
    for (let f = 0; f < (f1 ? 2 : 1); f++) { const r = fileRear(E, f), rm = r ? r.s : 1e9; if (rm > room + 1e-6) { room = rm; best = f; } } return best; };
  // one step of a second-file walker at the kerb (→ true: it stays at the kerb this step). DON'T WALK: out along the kerb to its place
  // (kt, a whole place: one caught between places by the lights goes on out to the next), never within KERB.d of the one further out;
  // WALK: back to the file's line, in order — never within KERB.d of anyone nearer the line at the kerb or already off it, and one
  // that is a whole place out keeps out of the way of the file walking out past it — then it steps off like anyone
  function kerbStep(w, E, dt) { const op = open(E), D = KERB.d; if (w.ko !== op) { w.ko = op; w.kt = op ? 0 : Math.ceil((w.kx || 0) / D - .02) * D; }
    const kx = w.kx || 0, kt = w.kt || 0; if (kx < 1e-3 && kt < 1e-3) { w.kx = 0; w.kv = 0; return false; }
    if (w.s < STEP - 1e-4) w.s = Math.min(STEP - 1e-4, w.s + .5 * dt);   // (the row stands right at the kerb, KERB.c from the curb, where its spots were checked)
    let nk = kx;
    if (kt > kx) { let lim = kt; for (const o of E.list) if (o !== w && onRow(o) && (o.kx || 0) > kx + 1e-6) lim = Math.min(lim, o.kx - D);
      nk = Math.min(Math.max(kx, lim), kx + Math.min(KERB.side, (kt - kx) * 3 + .15) * dt); }
    else { const want = Math.max(kt, kx - Math.min(KERB.side, (kx - kt) * 3 + .15) * dt); let ok = true;
      for (const o of E.list) { if (o === w || o.lat !== FILES[1] || (o.kx || 0) >= kx - 1e-6) continue; const ok2 = o.kx || 0;
        if (o.s > w.s + .02) { if (Math.hypot(o.s - w.s, ok2 - want) < D) { ok = false; break; } }   // (ahead: off the kerb, or further along it)
        else if (o.s >= STEP - .05 || kx >= D - 1e-3) { if (Math.abs(ok2 - want) < D) { ok = false; break; } } }   // (beside it at the kerb; or walking out past it)
      if (ok) nk = want; }
    const dk = nk - kx; w.kx = nk < 1e-3 && kt < 1e-3 ? 0 : nk; w.kv = (w.kv || 0) + ((dt > 0 ? dk / dt : 0) - (w.kv || 0)) * Math.min(1, dt * 8); if (Math.abs(w.kv) < .02 && !dk) w.kv = 0;
    w.ph += Math.abs(dk) * 3.1; w.vc = Math.abs(w.kv); w.held = w.vc < .05 ? w.held + dt : 0; return w.kx > 0 || kt > 0; }
  const turnsAt = (A, B) => Math.abs((A.to.x - A.from.x) * (B.to.x - B.from.x) + (A.to.z - A.from.z) * (B.to.z - B.from.z)) < .7 * A.len * B.len;   // (crowd pass: B leaves A's corner at an angle)
  // CROWD GRID · the countdown: a walker at the kerb steps off on WALK only if it can be over before the cross street's green — the time to
  // it (the walkers' axis's green and yellow left, as the signal plan has it — a cab's window cuts a WALK short — and the all-red) against its
  // walk over at its pace and a beat for each walker still out in the road ahead of it (the far corner takes them one by one)
  function timeToCross(w, E) { if (E._cdf !== sf) { E._cdf = sf; const ax = E.arm === 'N' || E.arm === 'S' ? 'z' : 'x'; E._cdl = phaseLeft(E.Lx, E.Lz, ax, now()) + TIMING.allRed;
      let ahead = 0; for (const o of E.list) if (o.s > STEP + .01 && o.s < E.len - 1) ahead++; E._cda = ahead; }   // (once a frame per crossing)
    return E._cdl >= (E.len - STEP - 1 + .3) / Math.max(.9, w.v) + CORNER.beat * E._cda; }
  // CROWD GRID · the road first (step's corners): is anyone out in the road on a crossing into corner n (past its kerb spot, not yet at the
  // far kerb's waiting point)? Once a frame per corner
  function roadIn(n) { if (n._rf === sf) return n._ri; n._rf = sf; n._ri = false;
    for (const I of n.inn) { if (!I.cross || I.off) continue; for (const o of I.list) if (o.s > STEP + .01 && I.len - o.s > CORNER.kerb - .05) { n._ri = true; return true; } }
    return false; }
  const moverBehind = (M, w) => { if (!M || !w.p) return false; const dx = M.x - w.p[0], dz = M.z - w.p[2], h = w.p[3], al = dx * Math.sin(h) + dz * Math.cos(h); return al < -.1 && Math.abs(dx * Math.cos(h) - dz * Math.sin(h)) < 1.2; };
  // can w walk on through the corner ahead without stopping in it: the one it would follow on its way on is far enough on, or walking on
  function clearsCorner(w, E) { const nx = w.next; if (!nx) return true; const q = nx.cross ? entryLead(nx) : nx.list[nx.list.length - 1];
    if (!q || q === w) return true; if (nx.cross && !open(nx)) return q.s >= STEP - .05 || (q.vc || 0) > .4;   // (into a closed crossing: its file's rear is at the kerb, or nearly)
    return q.s - (turnsAt(E, nx) ? PED.turn : PED.gap) >= CORNER.clear || (q.vc || 0) > .4; }
  const inRoad = E => { for (const o of E.list) if (o.s > STEP + .01 && o.s < E.len - 1) return true; return false; };
  let sf = 0;
  // ── RIDERS AVOID · the crowd makes way (PED.yieldR …). movers: simstate/movement.js fills it each frame before the step — { x, z, hx, hz
  // (its heading), v, n, ft (s ahead), fx (x, z at each) } — and a coarse grid of where they will be finds the walkers near them.
  const movers = [], MG = new Map(), RR = [0, 0], RS = [0, 0], AX = [0, 0];
  const mcell = (x, z) => (Math.floor(x / 2) + 8192) * 16384 + (Math.floor(z / 2) + 8192);
  // (crowd hold: a corner of a wider walk a mover will pass through within PED.cornerT s is held for it — n.mvUntil — and walkers coming
  // along a sidewalk to it wait outside it a beat, as they do for an agent: the riders' line comes back onto the walkers' at every corner)
  let NG = null, ngVer = -1; const ncell = (x, z) => (Math.floor(x / 2) + 8192) * 16384 + (Math.floor(z / 2) + 8192);
  function cornerHolds() { if (ngVer !== laneVer) { ngVer = laneVer; NG = new Map(); for (const n of nodes.values()) { if (!n.wide) continue; const k = ncell(n.x, n.z); if (!NG.has(k)) NG.set(k, []); NG.get(k).push(n); } }
    const R2 = PED.cornerR * PED.cornerR;
    for (const M of movers) for (let k = -1; k < M.n; k++) { if (k >= 0 && M.ft[k] > PED.cornerT) break; const x = k < 0 ? M.x : M.fx[2 * k], z = k < 0 ? M.z : M.fx[2 * k + 1], cx = Math.floor(x / 2), cz = Math.floor(z / 2);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const n of NG.get((cx + a + 8192) * 16384 + (cz + b + 8192)) || []) if ((n.x - x) ** 2 + (n.z - z) ** 2 < R2) { n.mvUntil = t + .25; n.mvM = M; } } }
  function moverGrid() { MG.clear(); for (const M of movers) for (let k = -1; k < M.n; k++) { const x = k < 0 ? M.x : M.fx[2 * k], z = k < 0 ? M.z : M.fx[2 * k + 1], cx = Math.floor(x / 2), cz = Math.floor(z / 2);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const key = (cx + a + 8192) * 16384 + (cz + b + 8192); let L = MG.get(key); if (!L) MG.set(key, L = []); if (L[L.length - 1] !== M) L.push(M); } } }
  // how far a walker may step aside here, along its axis: out [min, max] ([0, 0]: not here). Never in a corner square (the posts, the
  // turning lines), on a detour ramp, at the kerb, in the kerb-wait row or with a dog; on a sidewalk only inside the side's clear strip
  // (the room table, looked at from 0.3 m behind to 1.2 m ahead); on a zebra, out in the road, half a metre either way
  // (reach: crowd grid — a step round someone standing may go wider than a rider's, up to it m)
  function dodgeRoom(w, E, out, reach = 0) { out[0] = out[1] = 0;
    // (crowd hold: on a wider walk a side by a dealing crew's corner makes way too, clear of its ramp into the road — r1 + 1.4 m from the corner)
    const det = E.from.detour || E.to.detour; if (det && (E.cross || !(E.wk > 1))) return out;
    const dNode = Math.min(w.s - (E.from.detour ? E.from.detour.r1 + 1.4 : 0), E.len - w.s - (E.to.detour ? E.to.detour.r1 + 1.4 : 0)) - PED.dodgeNode; if (dNode <= 0) return out;
    if (E.cross) { if (w.s < STEP + .5 || w.s > E.len - NODE - .5) return out; const m = Math.min(.5, dNode); out[0] = -m; out[1] = m; return out; }
    const u = sideU(E, w.s), du = sideDir(E), m = Math.min(Math.max(PED.dodge * (E.wk || 1), reach), dNode);
    if (E.wk > 1) {   // (crowd hold, a wider walk: sample by sample, round the lane's own place THERE — it bends round things, and a step aside held from
      // where it was carried a walker into a shopfront's stand)
      let lo = -9, hi = 9; for (let q = 0; q <= 8; q++) { const u2 = u + du * (-.3 + q * 1.5 / 8), r2 = roomSpan(E, u2, u2, RS); if (!r2) return out; const c2 = laneC(E, u2);
        if (r2[0] + .02 - c2 > lo) lo = r2[0] + .02 - c2; if (r2[1] - .02 - c2 < hi) hi = r2[1] - .02 - c2; }
      out[0] = Math.min(0, Math.max(-m, lo)); out[1] = Math.max(0, Math.min(m, hi)); return out; }
    const r = roomSpan(E, u - du * .3, u + du * 1.2, RS); if (!r) return out; const c = laneC(E, u);
    out[0] = Math.min(0, Math.max(-m, r[0] + .02 - c)); out[1] = Math.max(0, Math.min(m, r[1] - .02 - c)); return out; }
  // the mover nearest to running into a walker (its lane point: the dodge taken off) in the next PED.yieldT s → the walker's response:
  // along its lane (overtaken or met head-on) it steps aside, away from the mover's line; across it, it stops short until the mover is by
  const YT = { want: 0, stop: false };   // (crowd grid: a rider held up and standing — M.v < 0.3 — is not one coming: it is a body on the map, bodyStep's to step round; yielding to it as to one coming held each in the other's way)
  function threatOf(w, E) { YT.want = 0; YT.stop = false; const L = MG.get(mcell(w.p[0], w.p[2])); if (!L) return false; axisOf(E, AX);
    const bx = w.p[0] - AX[0] * (w.dg || 0), bz = w.p[2] - AX[1] * (w.dg || 0), hx = Math.sin(w.p[3]) * w.vc, hz = Math.cos(w.p[3]) * w.vc; let bM = null, bd = PED.yieldR * PED.yieldR, bk = -1;
    for (const M of L) { if (M.w === w || (GRID.on && (M.v || 0) < .3)) continue; for (let k = -1; k < M.n; k++) { const t = k < 0 ? 0 : M.ft[k]; if (t > PED.yieldT) break; const dx = bx + hx * t - (k < 0 ? M.x : M.fx[2 * k]), dz = bz + hz * t - (k < 0 ? M.z : M.fx[2 * k + 1]), d = dx * dx + dz * dz; if (d < bd) { bd = d; bM = M; bk = k; } } }
    if (!bM) return false; const M = bM, t = bk < 0 ? 0 : M.ft[bk], px = bk < 0 ? M.x : M.fx[2 * bk], pz = bk < 0 ? M.z : M.fx[2 * bk + 1];
    let mx = M.hx, mz = M.hz; if (bk >= 0 && bk + 1 < M.n) { const ex = M.fx[2 * bk + 2] - px, ez = M.fx[2 * bk + 3] - pz, l = Math.hypot(ex, ez); if (l > .05) { mx = ex / l; mz = ez / l; } }
    const lat = (bx + hx * t - px) * -mz + (bz + hz * t - pz) * mx, pa = -mz * AX[0] + mx * AX[1];   // (lat: the walker off the mover's line, + on its left; pa: one metre along the walker's axis moves it pa across that line)
    if (Math.abs(pa) < .4) { const ahead = (px - bx) * Math.sin(w.p[3]) + (pz - bz) * Math.cos(w.p[3]); if (ahead > -.2 && t > .05) YT.stop = true; return true; }
    const sg = Math.abs(lat) > .04 ? Math.sign(lat) * Math.sign(pa) : 0; YT.want = sg * PED.dodge * (E.wk || 1); YT.side0 = sg === 0; return true; }
  // one step of a walker's dodge (w.dg, m along its axis) → the speed it may walk at this step
  function yieldStep(w, E, dt, v) { let tg = 0, side0 = false;
    const th = movers.length > 0 && threatOf(w, E), hold = !th && w.dgT !== undefined && t - w.dgT < .35;   // (it holds its step a moment after the mover is by)
    const sd = !th && t - w.sdT < .3;   // (crowd grid: stepping round someone standing in its way — bodyStep)
    if (!th && !hold && !sd && !w.dg && !w.dgv) return v;   // (nobody coming and on its lane: nothing to do — the common case, kept cheap)
    const R = dodgeRoom(w, E, RR, sd ? GRID.reach : 0);
    if (th) { w.dgT = t; if (YT.stop && !(E.cross && w.s > STEP + .01 && w.s < E.len - 1)) v = 0;   // (crowd grid: out in the road it walks on — the rider waits for it)
      side0 = YT.side0; tg = side0 ? (R[1] >= -R[0] ? R[1] : R[0]) : YT.want; w.dgW = tg; } else if (sd) tg = w.sdW; else if (hold) tg = w.dgW || 0;
    tg = Math.max(R[0], Math.min(R[1], tg)); const dg = w.dg || 0; if (!dg && !tg && !w.dgv) return v;
    const out = dg < R[0] - 1e-3 || dg > R[1] + 1e-3, vm = out ? 1.5 : tg ? PED.dodgeV : PED.dodgeBack, vd = Math.max(-vm, Math.min(vm, (tg - dg) * 5)), a = (out ? 6 : PED.dodgeA) * dt;
    if (dg) v = Math.min(v, Math.max(.15, (E.len - w.s) / (Math.abs(dg) / 1.5 + .1)));   // (crowd grid: back on its lane by the corner — the step aside is dropped there, and one still out walked into the corner with a jump)
    w.dgv = (w.dgv || 0) + Math.max(-a, Math.min(a, vd - (w.dgv || 0))); let n = dg + w.dgv * dt;
    if ((tg - dg) * (tg - n) < 0) { n = tg; w.dgv = 0; } if (Math.abs(n) < 1e-3 && !tg) { n = 0; w.dgv = 0; } w.dg = n; return v; }
  // ── CROWD GRID (2026-10-10) · WHO'S STANDING WHERE. One map of every body, made once a step: each walker where it is (on the lanes, or off
  // them: an agent at its spot, a station cop, a stage actor, a rider on its booked legs — w.fix), and whatever else the city publishes for the
  // step in sim.bodies ({ x, z, r, w? }: the stage's actors' footprints — a body on the ground — stage/crowd.js). A hash of 1 m cells in flat
  // arrays (no allocation a step). Readers: bodyStep (a walker on the lanes steps round, or stops short of, someone standing in its way) and
  // simstate/movement.js (a rider or a walking agent slows down behind whoever is in its way: sim.near). Moving walkers keep apart as they
  // did (following on an edge, the corners); a moving rider is a mover (RIDERS AVOID). Cost: measured in the crowd check (tools: the
  // step's ms) — the map is ~0.05 ms a step for ~500 bodies.
  const BG = { n: 0, cap: 0, x: null, z: null, r: null, w: [], b: [], head: new Int32Array(4096).fill(-1), nx: null, headS: new Int32Array(4096).fill(-1), nxS: null, coarse: new Int32Array(4096), stamp: 0 }, bodies = [];   // (head/nx: every body; headS/nxS: those standing — bodyStep reads only them)
  const gh = (cx, cz) => (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) & 4095;
  function bgAdd(x, z, r, w, b) { if (BG.n >= BG.cap) { const c = Math.max(1024, BG.cap * 2), grow = (a, T) => { const o = new T(c); if (a) o.set(a); return o; }; BG.x = grow(BG.x, Float32Array); BG.z = grow(BG.z, Float32Array); BG.r = grow(BG.r, Float32Array); BG.nx = grow(BG.nx, Int32Array); BG.nxS = grow(BG.nxS, Int32Array); BG.cap = c; }
    const k = BG.n++, h = gh(Math.floor(x / GRID.cell), Math.floor(z / GRID.cell)); BG.x[k] = x; BG.z[k] = z; BG.r[k] = r; BG.w[k] = w; BG.b[k] = b; BG.nx[k] = BG.head[h]; BG.head[h] = k;
    if (b || !w || (w.vc || 0) <= .3) { BG.nxS[k] = BG.headS[h]; BG.headS[h] = k; BG.coarse[gh(Math.floor(x / 4), Math.floor(z / 4))] = BG.stamp; } }
  function gridBuild(active) { BG.head.fill(-1); BG.headS.fill(-1); BG.n = 0; BG.stamp++;   // (active: the walkers near the camera — the map holds them and everyone off the lanes; far walkers neither read it nor are read)
    for (const w of walkers) { if (w.gone) continue; const p = w.fix || w.p; if (!p || (active && !w.fix && !active(w))) continue; bgAdd(p[0], p[2], PED.body, w, null); }
    for (const b of bodies) bgAdd(b.x, b.z, b.r, b.w || null, b); bodies.length = 0; }
  // every body within R of (x, z): fn(k) with BG.x[k] … (a cell's hash may hold others: the caller measures)
  function near(x, z, R, fn, still = false) { if (!BG.n) return; const c = GRID.cell, i0 = Math.floor((x - R) / c), i1 = Math.floor((x + R) / c), j0 = Math.floor((z - R) / c), j1 = Math.floor((z + R) / c), H = still ? BG.headS : BG.head, N = still ? BG.nxS : BG.nx;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = H[gh(i, j)]; k >= 0; k = N[k]) { const dx = BG.x[k] - x, dz = BG.z[k] - z, rr = R + BG.r[k]; if (dx * dx + dz * dz < rr * rr) fn(k); } }
  // a walker on the lanes and someone standing in its way (its path ahead, within GRID.look + 0.6 s of walking): it steps round them inside
  // its side's clear strip (dodgeRoom: the same room as for a rider — w.sdW, carried out by yieldStep), slowing if the step needs the
  // time, or stops short and queues (the walkers behind it follow it as ever). "Standing": a body off the lanes (an agent at its spot, a
  // cop, an actor, a stopped rider), a footprint the stage published, or a walker of another edge that is (nearly) still — someone moving
  // is the corners' and the riders' business. Two walkers each in the other's way: the lower id goes. After GRID.stuck s behind the same
  // body with no way round it squeezes by it (the clearance less the room), never through it
  const BS = { k: -1, a: 0, l: 0, rs: 0 }; let BSH = 1e9, BSV = 1e9;   // (the step's hold — how far on it may walk — and its speed cap)
  const PP = Array.from({ length: 12 }, () => [0, 0, 0, 0]), CAND = [];
  function bodyStep(w, E, dt, v) {
    BSH = 1e9; BSV = 1e9; if (!BG.n || w.fix || !w.p) return v; const px = w.p[0], pz = w.p[2], L = Math.min(4, GRID.look + Math.max(w.vc, v) * .6), held = t - (w.bsT ?? -1e9) < .3 ? w.bsO : null;
    // who could be in its way: bodies within reach that stand, or a footprint — not its own edge's walkers (following), not anyone on the move
    const hx = Math.sin(w.p[3]), hz = Math.cos(w.p[3]), qx = px + hx * L * .5, qz = pz + hz * L * .5, QR = L * .5 + 1.2, c = GRID.cell;
    // (inline, no closure: this runs for every walker near the camera every frame — only the bodies that stand are walked: headS; and
    // first a 4 m map of where anyone stands at all: most walkers have nobody standing near them)
    { let any = false; for (let i = Math.floor((qx - QR) / 4), i1 = Math.floor((qx + QR) / 4); i <= i1 && !any; i++) for (let j = Math.floor((qz - QR) / 4), j1 = Math.floor((qz + QR) / 4); j <= j1; j++) if (BG.coarse[gh(i, j)] === BG.stamp) { any = true; break; }
      if (!any) { w.blk = null; return v; } }
    CAND.length = 0; for (let i = Math.floor((qx - QR) / c), i1 = Math.floor((qx + QR) / c); i <= i1; i++) for (let j = Math.floor((qz - QR) / c), j1 = Math.floor((qz + QR) / c); j <= j1; j++)
      for (let k = BG.headS[gh(i, j)]; k >= 0; k = BG.nxS[k]) { const bx = BG.x[k], bz = BG.z[k], rr = QR + BG.r[k]; if ((bx - qx) * (bx - qx) + (bz - qz) * (bz - qz) >= rr * rr) continue;
        const o = BG.w[k], b = BG.b[k]; if (o === w || (o && !b && o.E === E && !o.fix && !o.off)) continue;   // (its own edge: following)
        if ((bx - px) * hx + (bz - pz) * hz < -.2 - BG.r[k]) continue;   // (behind it)
        if (o && !b && !o.fix && o.blk === w && w.id < o.id) continue;   // (each in the other's way: the lower id goes)
        CAND.push(k); }
    if (!CAND.length) { w.blk = null; return v; }
    // its way ahead, as it will walk it, in pieces of ~0.6 m: straight on along its heading where the edge runs on past the look (the lane
    // bends gently), else round the corner as it will walk it (the lane, the corner's arc, the edge after: pedsim ahead()); the first body
    // it would come within reach of, closing in on it (one it is leaving behind, or passing clear of, is not in its way)
    const n = Math.min(PP.length - 1, Math.max(2, Math.ceil(L / .6))); PP[0][0] = px; PP[0][2] = pz;
    if (E.len - w.s > L + .6) for (let q = 1; q <= n; q++) { PP[q][0] = px + hx * q * L / n; PP[q][2] = pz + hz * q * L / n; } else for (let q = 1; q <= n; q++) ahead(w, q * L / n, PP[q]);
    BS.k = -1; BS.a = 1e9;
    for (const k of CAND) { const bx = BG.x[k], bz = BG.z[k], b = BG.b[k], d0 = Math.hypot(bx - px, bz - pz);
      const rs = PED.body + BG.r[k] + GRID.pad + (b ? b.room ?? GRID.room : 0) - (held === k && t - w.bsS > GRID.stuck ? GRID.pad + (b ? b.room ?? GRID.room : 0) : 0);
      if (b && d0 < rs) continue;   // (caught in a footprint as it came down — a body falling beside it — it walks on, out of it, as out of an arrest's way)
      for (let q = 1; q <= n; q++) { const ax = PP[q - 1][0], az = PP[q - 1][2], ex = PP[q][0] - ax, ez = PP[q][2] - az, l2 = ex * ex + ez * ez || 1e-9, f = Math.max(0, Math.min(1, ((bx - ax) * ex + (bz - az) * ez) / l2)), d = Math.hypot(ax + ex * f - bx, az + ez * f - bz);
        if (d < rs && d < d0 - 1e-3) { const al = (q - 1 + f) * L / n; if (al < BS.a) { BS.k = k; BS.a = al; BS.l = d; BS.rs = rs; } break; } } }
    if (BS.k < 0) { w.blk = null;
      // (still beside the one it stepped round — not yet a body's width past it: it keeps its step; dropped as soon as the body was no longer
      // ahead, it stepped back onto its lane alongside it)
      if (t - w.sdT < .6 && w.sdR > 0) { const ax = w.sdX - px, az = w.sdZ - pz; if (ax * hx + az * hz > -w.sdR && Math.abs(ax * hz - az * hx) < w.sdR + .3) w.sdT = t; }
      return v; }
    const k = BS.k, o = BG.w[k]; if (w.bsO !== k || t - w.bsT > .5) w.bsS = t; w.bsO = k; w.bsT = t; w.blk = o || null;
    // step round: the body's place on the walker's dodge axis, from its lane point (its dodge taken off) — pass it on whichever side needs
    // the smaller step, inside the room there; the step must be made before it gets there (PED.dodgeV) or it slows to let it
    axisOf(E, AX); const R = dodgeRoom(w, E, RR, GRID.reach), dg = w.dg || 0, bo = (BG.x[k] - (px - AX[0] * dg)) * AX[0] + (BG.z[k] - (pz - AX[1] * dg)) * AX[1];
    let tg = null; const c1 = bo - BS.rs - .02, c2 = bo + BS.rs + .02; if (c1 >= R[0] - 1e-6 && c1 <= R[1] + 1e-6) tg = c1; if (c2 >= R[0] - 1e-6 && c2 <= R[1] + 1e-6 && (tg === null || Math.abs(c2) < Math.abs(tg))) tg = c2;
    const touch = Math.max(0, BS.a - Math.sqrt(Math.max(0, BS.rs * BS.rs - BS.l * BS.l)) - .03);   // (how far on it can walk before it would touch)
    if (tg !== null && !w.agent) { w.sdW = tg; w.sdT = t; w.sdX = BG.x[k]; w.sdZ = BG.z[k]; w.sdR = BS.rs; const need = Math.abs(tg - dg) / PED.dodgeV + .15; if (need > 1e-3) { BSV = Math.max(.25, BS.a / need); v = Math.min(v, BSV); } GS.steps++; return v; }
    GS.stops++; BSH = touch; BSV = Math.max(0, touch * 2); return Math.min(v, BSV); }
  const GS = { steps: 0, stops: 0, ms: 0, unstuck: 0 };
  // will w make way for a rider coming (RIDERS AVOID)? A walker of the crowd on its lane with room to step aside there — not one at a kerb, in
  // a corner square, in the kerb row, with a dog, halted, nor one out in the road (it must get off it). movement.js: a rider slows for those
  const YR = [0, 0]; function yields(w) { if (!w || w.fix || w.off || w.halt || w.agent || !w.E || w.dog >= 0 || w.kx) return false; const E = w.E;
    if (E.cross && w.s > STEP + .01 && w.s < E.len - 1) return false; const R = dodgeRoom(w, E, YR); return R[1] - R[0] > .3; }
  function step(dt1, active = null) {   // active(w): walkers near the camera (the rest only move on: they are boxes far away)
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0; t += dt1; sf++; if (PED.yieldOn && movers.length) { moverGrid(); cornerHolds(); } else MG.clear();
    if (GRID.on) gridBuild(active); else if (BG.n || bodies.length) { BG.head.fill(-1); BG.n = 0; bodies.length = 0; }
    for (const E of busy) { if (!E.list.length) { busy.delete(E); continue; } if (E.list.length > 1) E.list.sort((p, q) => q.s - p.s); E.list.forEach((w, k) => { w.k = k; }); }
    for (const w of walkers) {
      if (w.off) continue; if (w.halt) { busy.add(w.E); continue; }   // (SIM LIVE: an agent standing off the lanes; an agent halted at its lane point)
      const E = w.E, act = !active || active(w), dogGap = w.dog >= 0 ? .25 : 0; let v = w.v, gap = 1e9, lead = null, hold = 1e9, gp = PED.gap;   // (a dog walks ahead: its owner keeps back a little more)
      if (!act && (w.id + sf) % 3) { busy.add(E); continue; }   // (fidelity pass: far from the camera a walker moves every third frame, three frames' worth: ~2000 walkers live now)
      const dt = act ? dt1 : dt1 * 3;
      // walkers-fix round · the second file at the kerb: along the kerb to its place in the row, or back to the file's line (kerbStep)
      if (E.cross && w.lat === FILES[1] && w.s >= STEP - .05 && w.s < STEP + .01 && kerbStep(w, E, dt)) { busy.add(E); continue; }
      // traffic pass · the kerb: on DON'T WALK (or with a car on the zebra) nobody steps off; far walkers too (they skip the rest)
      if (E.cross && w.s < STEP + 1e-4 && (!open(E) || (w.s > STEP - .3 && !w.agent && !timeToCross(w, E)))) { hold = Math.max(0, STEP - (w.dog >= 0 ? .2 : 0) - w.s); v = Math.min(v, Math.max(w.s < .65 ? .6 : 0, Math.sqrt(2 * CORNER.brake * hold), hold > 1e-3 ? .25 : 0)); }   // (crowd grid: it brakes onto the kerb spot and is there — it used to creep the last 20 cm for seconds, and the walkers behind it stood in the corner)
      else if (E.cross && w.s > STEP + .01 && !walkOK(E)) v = Math.max(v, CORNER.hurry);   // (crowd grid: out in the road on the flashing hand, it hurries off)   // (a dog owner stops a little short: its dog at the kerb, itself clear of the corner — walkers-fix: and nobody slows to a crawl in the corner's first 0.65 m, where the next sidewalk's walkers pass once its lock has run out)
      if (act) {
        if (E.cross) { const la = w.lat || 0, lk = w.kx || 0; for (let q = w.k - 1; q >= 0; q--) { const o = E.list[q]; if (((o.lat || 0) === la && Math.abs((o.kx || 0) - lk) < KERB.line) || o.s > E.len - KERB.merge || w.s > E.len - KERB.merge) { lead = o; gap = o.s - w.s; break; } } }   // (the files merge into one before the far kerb)   // (on a crossing: the walker ahead in its own file — walkers-fix: by file, not by where the ramp has it: the second file stepping out past the first's kerb spot stalled at the corner node behind it)
        else if (w.k > 0) { lead = E.list[w.k - 1]; gap = lead.s - w.s; }
        if (!lead) for (const o of E.to.out) { const L = o.list; if (!L.length) continue;   // (the last walker on every way on from the corner ahead: one that just turned the other way is still in front of it)
          const q = o.cross && o === w.next ? entryLead(o) : L[L.length - 1]; if (!q) continue; if (o !== w.next && (q.s > .78 || (o.cross && latAt(q) >= .6))) continue;   // (walkers-fix: nor someone standing in a crossing's second file, 0.7 m off the corner's lines — a dog owner stopped short there by the flashing hand held a walker in the corner, and the walkers coming off the crossing behind it stood in the road)   // (traffic pass: into a crossing, the rear of the file it will take; someone standing well out on another way is not in its way — crowd grid: a dog owner at its spot, 0.8 m out, too: one stood there through a whole red and the zebra's walkers behind the one it held stood in the road)
          const g = E.len - w.s + q.s; if (g < gap) { gap = g; lead = q; } }
        // traffic pass · the queue for a closed crossing forms outside the corner once both kerb files are taken; a walker coming off a
        // crossing onto a closed one turns along the sidewalk instead of waiting in the road
        const nx = w.next, dn0 = E.len - w.s - (w.dog >= 0 ? PED.dogLead : 0);
        // (walkers-fix: a walker coming off a crossing joins the clump when there is a place at the kerb now; one on the sidewalk waits
        // outside the corner until there is, and asks the row to move up one place when it could)
        if (nx?.cross && !open(nx)) { if (E.cross && !w.agent && dn0 < 3) { if (w.dog >= 0 || !kerbReady(nx)) { const alt = E.to.out.find(o => !o.cross && !o.off); if (alt) w.next = alt; } }
          else if (!E.cross && dn0 > PED.node - .45 && (w.dog >= 0 || !kerbReady(nx))) { if (w.dog < 0 && dn0 < PED.node + 2.5 && row1(nx) === 'shift') kerbShift(nx);
            const h = dn0 - (PED.node + .35); hold = Math.min(hold, Math.max(0, h)); v = Math.min(v, Math.max(0, h * 2)); } }
        // (crowd grid: one standing in a corner square for a kerb it can't get to — its file walking out slowly, the row shuffling — walks on
        // along the sidewalk instead: a walker standing in the corner held the zebra's walkers behind it in the road)
        if (w.held > .5 && dn0 < PED.node - .45 && nx?.cross && !w.agent && !open(nx)) { const alt = E.to.out.find(o => !o.cross && !o.off); if (alt && (!alt.list.length || alt.list[alt.list.length - 1].s > PED.gap + .1)) { w.next = alt; GS.unstuck++; } }
        // (walkers-fix: behind someone standing on the same sidewalk — the queue outside a corner — a walker closes up to KERB.stand; it
        // moves off again only once the gap has opened to PED.gap)
        gp = lead && lead.E === E && !E.cross && w.dog < 0 && lead.vc < .05 && lead.held > .3 ? KERB.stand : lead && lead.E && (lead.E !== E ? turnsAt(E, lead.E) : lead.next && E.len - lead.s < ARC.max && turnsAt(E, lead.next)) ? PED.turn : PED.gap;   // (crowd pass: behind someone round the corner, or turning it, the turn gap: heads meet across the corner's chord, and a turning head is a box at an angle)
        if (lead && gap < PED.follow + dogGap) { if (w.agent && !lead.agent && (lead.E === E || lead.E === w.next)) lead.vc = Math.max(lead.vc, Math.min(lead.v * 1.2, w.v));   // a generic walker ahead of an agent picks up its pace
          v = Math.min(v, Math.max(0, lead.vc + (gap - gp - dogGap) * 1.5)); }
        // the corner ahead: the stream that holds it goes; others stop outside it; a stream that waited `fair` s, and an agent, go next
        // (someone with a dog stops where the dog is outside the corner)
        const n = E.to, dn = E.len - w.s - (w.dog >= 0 ? PED.dogLead : 0);
        if (dn < PED.node + .3) { const inRd = E.cross && w.s > STEP + .01, held = n.until > t && n.lockE !== E, agentComing = !w.agent && !inRd && n.agentUntil > t && n.agentE !== E, starved = n.waitE && n.waitE !== E && t - n.waitT > PED.fair;
          const committed = dn < PED.node - .45 || (inRd && w.held > PED.roadWait);   // already in the corner: it goes on (TRANSIT SYNC, 2026-10-08: and one who has stood PED.roadWait s IN THE ROAD on a crossing goes — in node, with no block lanes, five walkers stood 60 s on a zebra and the cars and buses waited for them through two greens)
          const moverComing = !w.agent && !E.cross && n.mvUntil > t && !moverBehind(n.mvM, w);   // (crowd hold: a mover is about to pass through this corner of a wider walk — crowd grid: unless it is behind this walker, on its way: then the walker goes first and the mover follows it, as it waits for whoever is in its way)
          // CROWD GRID (2026-10-10) · THE ROAD FIRST. A walker coming along a sidewalk gives the corner to anyone still out in the road on a
          // crossing into it (they must be off the carriageway before the cross street's green: the old turn-taking let a sidewalk stream hold
          // the far corner while the zebra's walkers stood in the road, up to 17 s), and takes it only when it can walk on through it: one that
          // would stop inside the corner square (its way on full: a slow kerb file, a queue) waits outside instead, where it blocks nobody
          const road = !E.cross && !committed && roadIn(n), stuck = !committed && !clearsCorner(w, E);
          if (committed || (!held && !agentComing && !moverComing && !road && !stuck && !(starved && !w.agent))) { n.lockE = E; n.until = Math.max(n.until, t + (dn + 1.25) / Math.max(.45, w.vc)); if (n.waitE === E) n.waitE = null;
            if (w.agent) { n.agentE = E; n.agentUntil = n.until; } }
          else { v = Math.min(v, Math.max(0, (dn - (inRd ? CORNER.kerb : PED.node - .35)) * 2)); if (w.agent) { n.agentE = E; n.agentUntil = t + .5; }   // (a zebra's walker waits on the kerb, CORNER.kerb m short of the node: out of the road, clear of the corner's turning lines)
            if (n.lockE === E && starved && !w.agent) n.until = Math.min(n.until, t);   // (walkers-fix: a stream that gives way to a starved one gives up the corner too — its slow head kept renewing the lock, and the walkers coming off a crossing stood in the road behind the one it starved)
            if (n.waitE !== E) { if (!n.waitE || t - n.waitT > PED.fair * 2) { n.waitE = E; n.waitT = t; } } } }
        if (GRID.on) {   // (crowd grid: someone standing in its way — round them, or stop short. Every other frame a walker (by id): in between it
          // keeps the last answer, its hold less what it has walked since — half the cost, a frame's lag)
          if (((w.id + sf) & 1) === 0 || w._bsE !== E || w._bsF !== sf - 1) { v = bodyStep(w, E, dt, v); w._bsE = E; w._bsF = sf; w._bsS0 = w.s; w._bsV = BSV; w._bsH = BSH; }
          else { w._bsF = sf; v = Math.min(v, w._bsV); BSH = w._bsH < 1e9 ? Math.max(0, w._bsH - (w.s - w._bsS0)) : 1e9; }
          if (BSH < hold) hold = BSH; }   // (crowd grid: someone standing in its way — round them, or stop short)
        if (PED.yieldOn && !w.agent && (movers.length || w.dg || t - w.sdT < .3)) v = yieldStep(w, E, dt, v);   // (riders avoid: a mover coming — step aside, or stop short)
      } else if (w.dg) { w.dg = 0; w.dgv = 0; }   // (far from the camera: back on its lane)
      w.vc = v < w.vc ? v : Math.min(v, w.vc + PED.acc * dt);
      let ds = w.vc * dt; if (lead && act) ds = Math.min(ds, Math.max(0, gap - gp - dogGap));   // never into the walker ahead
      ds = Math.min(ds, hold); const s0 = w.s;
      w.s += ds; w.ph += ds * 3.1; w.held = w.vc < .05 ? w.held + dt : 0;
      if (E.cross && s0 < STEP && w.s >= STEP) { stat.stepOffs++; if (!walkOK(E)) stat.dontWalk++; }   // (the gate's counter: stepping off on DON'T WALK)
      while (w.s >= w.E.len) { let nx = w.next; if (!nx) { w.s = w.E.len - .01; w.vc = 0; break; }   // (a dead end: it stops there)
        if (nx.cross && !open(nx) && !w.agent && (w.dog >= 0 || !kerbReady(nx))) { const alt = w.E.to.out.find(o => !o.cross && !o.off); if (alt) { nx = alt; w.next = alt; } }   // (walkers-fix: its place at the kerb went to someone else: along the sidewalk instead)
        const over = w.s - w.E.len; unlist(w); w.dg = 0; w.dgv = 0; w.lat = nx.cross ? FILES[fileFor(nx)] : 0; w.kx = 0; w.kt = 0; w.kv = 0; w.ko = nx.cross ? open(nx) : undefined; w.pE = w.E; w.E = nx; w.s = Math.min(over, nx.cross && !open(nx) ? STEP : over); enlist(nx, w);
        if (w.goal && nx === w.goal.E) w.goal.armed = true;   // (SIM LIVE: on its goal's side now)
        if (w.agent && w.route && w.route.length) w.next = w.route.shift(); else { if (w.agent && !w.arrived) w.arrived = true; w.next = pickNext(nx); } }
      busy.add(w.E);
      if (w.goal?.armed && w.E === w.goal.E && w.s >= w.goal.s) { w.s = w.goal.s; w.vc = 0; w.halt = true; }   // (SIM LIVE: at the lane point it leaves the lanes at)
    }
    movers.length = 0;   // (riders avoid: read once — movement.js publishes them again before the next step; a paused sim leaves none)
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0; stat.ms = ms; stat.n++; stat.avg += (ms - stat.avg) * .05; stat.max = Math.max(stat.max * .995, ms);
  }

  // ── animation merge · the drawn heading (after where(w)): chases the path's heading at ARC.turnRate (turn.js turnToward); a walker not
  // faced for 0.3 s (out of view, just arrived) takes the path's heading outright. w.dyaw: this frame's turn (the standing shuffle).
  const FT = { yaw: 0, omega: 0 };
  function face(w) { const dt = t - (w.fT ?? -1e9), tgt = w.p[3]; w.fT = t;
    if (w.yawS === undefined || !(dt > 0) || dt > .3) { w.yawS = tgt; w.omega = 0; w.dyaw = 0; return tgt; }
    FT.yaw = w.yawS; FT.omega = w.omega; w.dyaw = turnToward(FT, tgt, dt, ARC.turnRate); w.yawS = FT.yaw; w.omega = FT.omega; return w.yawS; }
  // the near walkers' gait and idles (gait2.js, idle.js), driven by the distance the drawn walker actually moved (arcs, the kerb row's
  // shuffle, an agent's step off the lanes and the lane settle included). fresh: it was not animated last frame (it just came near):
  // the gait starts where the walker is — walking at its pace, or already idling if it has stood a while — so the switch never pops.
  const hash = (a, b) => (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2d, 0xc2b2ae35)) >>> 0;
  function signalOf(X) { if (X._sig !== undefined) return X._sig; let best = null, bd = 1e9;   // the ped box a walker at X's kerb reads: the pole at the far end (else the intersection's other)
    for (const [i, j] of [[X.Lx - 1, X.Lz - 1], [X.Lx, X.Lz]]) for (const q of signalPoles(i, j)) { if (q.Lx !== X.Lx || q.Lz !== X.Lz) continue;
      const d = Math.hypot(q.x - X.to.x, q.z - X.to.z) - Math.hypot(q.x - X.from.x, q.z - X.from.z); if (d < bd) { bd = d; best = [q.x, q.z]; } }
    return X._sig = best; }
  const kerbX = w => { const E = w.E; if (!E || w.off) return null; if (E.cross) return w.s <= STEP + .05 ? E : null; const X = w.next; return X?.cross && E.len - w.s < PED.node + 3.5 && !open(X) ? X : null; };
  function pickIdle(w) { w.nIdle = (w.nIdle || 0) + 1; return kerbX(w) ? IDLE.crossing : IDLE_POOL[hash(w.id, w.nIdle) % IDLE_POOL.length]; }
  function animate(w, dt, G, fresh) {
    const p = w.p; let g = w.g;
    if (!g || fresh) { const v = w.vc || 0, moving = v > .04, x = Math.max(0, Math.min(1, v / WALK2.vRef));
      g = w.g = gait2State({ u: ((w.ph || 0) / (2 * Math.PI)) % 1, it: (hash(w.id, 7) % 1000) / 25 });
      g.v = g.vPrev = v; g.a = LEVELS[0] + (1 - LEVELS[0]) * x * x * (3 - 2 * x); g.w = moving ? Math.min(1, .35 + v / .35) : 0;
      if (!moving && (w.held || 0) > .35) { g.idle = pickIdle(w); g.wasStill = true; g.still = w.held; g.iw = 1; }
      w.gx = p[0]; w.gz = p[2]; }
    let d = Math.hypot(p[0] - w.gx, p[2] - w.gz); w.gx = p[0]; w.gz = p[2]; if (d > 1.5) d = 0;   // (a jump: no stride through it)
    stepGait2(g, d, dt, WALK2, G, fresh ? 0 : w.dyaw || 0); g.omega = w.omega || 0;
    stepIdle(g, (w.vc || 0) < .05 && Math.abs(g.omega) < .25, dt, () => pickIdle(w));
    if (g.idle === IDLE.crossing && g.iw > .001) { const X = kerbX(w) || w.E, sg = X?.cross ? signalOf(X) : null; g.look = sg ? wrapPi(Math.atan2(sg[0] - p[0], sg[1] - p[2]) - (w.yawS ?? p[3])) : 0; }
    return g; }

  return {
    nodes, edges, walkers, agents, where, ahead, step, face, animate, populate, addAgent, setAgentTarget, removeAgent, route, stat, deadEnds, lanes, per100, demandOf,
    bodies, near, grid: BG, gridStats: () => ({ ...GS, bodies: BG.n }), yields,   // (crowd grid: the body map — sim.bodies to publish into, sim.near(x, z, R, k => …) to read it, BG.x/z/r/w/b[k])
    movers, roomSpan, sideU, sideDir, laneC, setRoom(T) { ROOM = T ? { day: T.day || {}, night: T.night || {}, step: T.step || .2, version: T.version || 1, base: T.base ?? -.8, res: T.res ?? .05 } : null; roomVer++; }, get ver() { return laneVer * 4096 + roomVer; }, get room() { return !!ROOM; },   // (riders avoid: movement.js publishes its movers; the side room table)
    laneNear, routeFast, wayTo, laneClear, putAgent, goAgent, offAgent, onAgent,   // (SIM LIVE: the sim's agents, simstate/agents.js)
    crossings, inRoad, walkOK, setCars(c) { cars = c; },   // (traffic pass: traffic/render.js wires the cars and walkers together)
    kerb: X => ({ ...kerbOf(X), cap: kCap(X), row: row1(X), demand: demandOf(X.dist) }),   // (walkers-fix: a crossing's kerb-wait row, for looking into one)
    get t() { return t; }, set looks(n) { looks = Math.max(1, n); }, get looks() { return looks; },
    setDemand(c, r) { crowd = c; rush = r || null; }, addLanes(key, l) { const [i, j] = key.split(/[,_]/).map(Number);
      settle(i, j, () => { lanes.set(key, l); laneVer++; if (l?.detour?.length) applyDetours(i, j, l.detour); }); },
    // walkers per 100 m of sidewalk per district over the edges near the focus (crossings count as sidewalk; agents not counted)
    density(focus, radius = PED.radius) { const out = {}, R2 = radius * radius;
      for (const E of edges) { const mx = (E.a.x + E.b.x) / 2 - focus.x, mz = (E.a.z + E.b.z) / 2 - focus.z; if (mx * mx + mz * mz > R2) continue; const o = out[E.dist] ??= { walkers: 0, metres: 0 }; o.metres += E.len; for (const w of E.list) if (!w.agent) o.walkers++; }
      for (const o of Object.values(out)) o.per100 = +(o.walkers / Math.max(1, o.metres) * 100).toFixed(1); return out; },
  };
}
