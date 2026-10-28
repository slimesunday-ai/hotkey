// TRAFFIC PASS (2026-09-28) · THE CARS' SIMULATION (node- and worker-safe: no three, no DOM). traffic/render.js draws it.
//   the lane graph  every plan road segment (plan.js segX / segZ) gets its lanes: a one-way side street ONE lane (rules.js isOneWay /
//                   oneWayDir) 1 m left of the centre line (the right half is the parking lane: ONEWAY_LANE), an avenue two lanes each
//                   way — the inner lane at ±1 (the kerb lanes at ±3 park cars: vehicles/index.js) — Route 9 three of 7/3 m each way. A lane runs from past one node's far zebra to the stop
//                   line of the next (STOP_BACK past the cross street's kerb: the zebra band is hw … hw + 2, its stop bar hw + 2.1–2.45).
//                   Through every node, CONNECTORS (cubic Béziers, arc-length tables): straight on from any lane, right from the
//                   rightmost lane into the rightmost, left only off a one-way (no oncoming traffic to yield to) into the leftmost.
//                   Lanes that lead only into dead ends are pruned (nobody drives into a stub it can't leave).
//   following       IDM (the intelligent driver model): each car reads the car ahead on its own lane or connector, else the rearmost car
//                   on the connectors fanning out of its lane and on the lane after; a red, a busy crossing or a full exit is a virtual
//                   stopped car at the line. Moves are clamped to the gap as well, so two cars never overlap whatever IDM asks.
//   signals         rules.js signalAt at every node where an N–S and an E–W road meet (CLOCK.t, the one shared clock). A car commits at
//                   the line on green (within commitDist) and on yellow only when it can't stop comfortably; it enters the box only
//                   when no car of the other phase is in it and its exit lane has room for it (don't block the box).
//   walkers         a car never puts its nose into a zebra while walkers are in the road on it (pedsim.js crossings) or while that
//                   zebra shows WALK (a turning car waits for the flashing DON'T WALK); crossBusy(key) tells the walkers where cars are.
//   continuity      cars live round the focus and round the camera (TRAFFIC.radius, the draw range); one leaves only after
//                   TRAFFIC.grace s unseen, one arrives only where nobody can see it, emptiest lanes first (the lanes ahead of a moving
//                   camera fill before they come into view) — the walkers' rules (PASS-fidelity.md, research C).
//   patrols         kind 'patrol' cars (simstate/layer.js asks for n): the same lanes, lights and following.
// FIX ROUND (2026-09-28, after the play-test review): density by district (TRAFFIC.per100 × TRAFFIC.dist), drivers that differ (v0, a, T),
//   IDM a 2.2 / s0 1.6 / T 1.0; every line at the bar (no 2 m pull-back; no optional left turn onto a two-way road, whose swing needed it);
//   straight on through a signal only if the body clears the far zebra before its WALK; turners that meet WALK keep straight where they
//   can and otherwise wait AT THE LINE (never in the box over the zebra behind them); walkers hold a car only when in its way; exit room
//   counted at the jam gap; long vehicles (box truck, bus) keep straight, turn only on wide arcs, the bus on the avenues. c.hold: why a car
//   stands at a line (light · late · box · room · walkIn · walkOut · turnWALK) — the counters' tool (tfix harness), no behaviour.
// TRAFFIC FIX (2026-10-08, so the transit keeps the design's times): the graph has no traps (rules.js flips 3rd St; lefts kept where the
//   only other way leads nowhere; turnarounds at the two-way roads' dead ends; Route 9's lane changes) — 612 of 618 lanes strongly
//   connected, the rest one-way stubs at the water; transit signal priority (rules.js PRIORITY: route cars ask the lights ahead); the
//   box rule for route cars too, with a look-ahead room (BOX); merges into one lane take turns.
// CAB TRAFFIC (2026-10-10, slime: "cabs can arrive when they arrive like normal traffic"; it replaces the TAXI CLOCK's clocked cab of
//   2026-10-09, a kin car placed by its booking, given the green, its way escorted and cleared) · a cab is a ROUTE car with asCar
//   (spawnRoute o.asCar; traffic/cabs.js): it drives as any car does — the lights, the box, the zebras, the car ahead, the ambient
//   speeds and corners — asks no priority, and never takes another way off its route. At a stand it pulls into a kerb bay out of its lane
//   and back (kerbIn / kerbOff / kerbBack / kerbGo, below).
// STAGE CARS (2026-10-09, the arrest's cruiser, stage/cruiser.js; slime: "let the cruiser double-park"): a route car spawned with
//   o.stage (spawnRoute) is the stage's: kind 'patrol', so render.js leaves it to the stage's own model, but never one of the sim-state's
//   patrols (patrols(), the patrol count); it asks no lights and keeps to them as any car does (no priority; never another way off its route). Stopped at its route's stop in
//   a travel lane it IS the blocked lane — a stopped car on it: the cars behind follow it to a stand (IDM), the box rule counts it (none
//   pulls in behind it without room), and the full-exit rule takes the cars held at the line before it another way after 6 s.
//   stageOut(c): pulled in to a free kerb, out of its lane (kin: the stage poses it; the overlap counter still sees it); stageIn(c): back
//   into its lane when nothing is coming (→ false: wait). Released at its route's end it is dropped once unseen (the stage drops it first).
// Deterministic: a seeded rng, the shared clock; a shot with a fixed camera and fixed ticks repeats exactly.
import { P, segX, segZ, hwX, hwZ, kindAt, distOf, isAve, isHwy, SPREAD } from '../plan.js';
import { isOneWay, oneWayDir, signalAt, cycleOf, TIMING, CLOCK, PRIORITY, PRI, priorityAsk, priorityDone, phaseLeft, advance } from './rules.js';

export const CAR = {
  v0: 10.5, v0Ave: 12, v0Hwy: 15,      // desired speeds (m/s): side street, avenue, Route 9
  a: 2.2, b: 2.2, s0: 1.6, T: 1.0,     // IDM: max acceleration, comfortable braking, jam gap (bumper to bumper), time headway
                                       // (fix round: a 1.6 → 2.2, s0 1.8 → 1.6, T 1.1 → 1.0: a queue leaves at ~2 s a car after the first; each driver varies v0 ±12 %, a and T ±20 %: spawn)
  bStop: 3.4, bMax: 6.5,               // a yellow is run only when stopping would take more than bStop m/s²; bMax: the hardest a car can brake
  latA: 2.2,                           // lateral acceleration in a turn (m/s²): v = √(latA · r)
  look: 70,                            // how far ahead a car looks for the car in front (m)
};
export const TRAFFIC = {
  per100: { street: 4.6, ave: 9, hwy: 5 },       // cars per 100 m of lane (× night × the district's `dist`), within `full` m of the camera or the focus
  // fix round: the first numbers (3 / 3.2 / 2.6, one level everywhere) read as Sunday traffic — 1–2 cars a cycle at Main × Central. Now
  // an avenue red holds 3–5, and the district scales it: downtown and its fringe busiest, the suburbs and the woods light (the lane's
  // busier side counts)
  dist: { downtown: 1, strip: .85, hospital: .75, highway: .7, industrial: .55, docks: .5, mall: .5, trailer: .4, junkyard: .35, suburbs: .35, estates: .3, jail: .25, forest: .2, sea: .2 },
  night: .6, radius: 150, full: 130, edge: .3,   // alive round the focus (and the camera's disc, render.js); past `full` m the density eases to `edge` × at the rim
  min: 60, max: 420,                             // the whole population is kept within [min, max]
  grace: 2.5,                                    // a car leaves only after grace s unseen
  straight: 3,                                   // straight on against one turn, where a car can do both
  stem: .1,                                      // × the weight of a way into a STEM (a lane with no way straight on: below), where the car has another
};
// TRANSIT SYNC (2026-10-08) · a ROUTE car (spawnRoute) is driven to keep the DESIGN's booking: dv × the road's desired speed on the
// straights — through a straight junction too; a turn at √(latA · r), between vTurn0 and vTurn m/s (the ambient cars: √(2.2 r), 3.2–8);
// it brakes for a turn at `brake` m/s² (the ambient cars plan 1.2); it pulls away at a × CAR.a. (The buses and the cabs that were route
// cars run on their own clock now — the cabs: traffic/cabs.js; the buses are gone — so the cab's numbers are the one set)
export const ROUTE = { cab: { dv: 1.45, a: 1.2, latA: 4.5, vTurn0: 3.8, vTurn: 8.5, brake: 2.2 } };
const routeP = () => ROUTE.cab;
export const BOX = { ahead: 2.2, breakT: 20 };
export const TICK = { h: .1, max: 8, hMax: .25 };   // s a step (tick: one page frame), steps a frame at most, s a step at most past that (60× fast play)
// TRANSIT SYNC (2026-10-08) · the TURNBACK: on Route 9 just past the LONG BRIDGE shelter (the lane split at node 7,−8, z −256), the
// northbound outer lane gets a 'T' into the southbound outer lane — a U the routing may plan (the traffic fix's 'U's at the dead ends stay
// out of it): built for the 14 bus (gone, 2026-10-09), kept for the cabs' routing (the export's road graph has it). Not at Route 9's north
// end: that is the bridge deck, with the checkpoint's stamped cars in its lanes (districts/jail/bridge.js). Straight on h m, then out
// towards the kerbs w m, so a long body stays between Route 9's kerbs (short of the bridge's taxi at −264.7); it turns at its √(latA·r)
// floor, 3.6 m/s, and merges into the southbound lane in turn
// left: the one left kept onto a two-way road where a car could go on otherwise — Foundry St (one-way east) onto Route 9 north at its T
// (node 7,−6): the only way north on Route 9 above Central Ave is from its south end (a 500 m loop)
export const TURNBACK = { at: new Set(['7,-8']), dir: [0, -1], left: new Set(['7,-6']), h: 6, w: 2 };
export const STOP_BACK = 2.5;    // a car's nose stops this far past the cross street's kerb line (the zebra band is hw … hw + 2, the bar hw + 2.1–2.45)
export const KERB_IN = .88;   // (vehicles/index.js PARK_IN: a parked car's centre is this far in from its kerb — a lane's kerb lane, below)
export const ONEWAY_LANE = -1.12;   // a one-way's travel lane, metres to the RIGHT of the centre line (the left half; parking on the right). TRANSIT SYNC (2026-10-08): −1 → −1.12 with the parked cars 0.12 m nearer their kerb (vehicles/index.js PARK_IN): a 1.8 m car passed a parked one 0.2 m off and read as driving through it (3rd St); now 0.44 m
const BAND = [.6, 2.5];          // a zebra, as the cars see it: hw + 0.6 … hw + 2.5 off the node (the walkers' bodies: hw + 0.9 … 2.2); a car is
const BODY = [4.7, 2];
function sepOf(A, B) { const ax = [[Math.sin(A.h), Math.cos(A.h)], [Math.cos(A.h), -Math.sin(A.h)], [Math.sin(B.h), Math.cos(B.h)], [Math.cos(B.h), -Math.sin(B.h)]], dx = B.x - A.x, dz = B.z - A.z;   // the gap between two rectangles (< 0: overlap)
  const ext = (C, u) => C.len / 2 * Math.abs(Math.sin(C.h) * u[0] + Math.cos(C.h) * u[1]) + C.wid / 2 * Math.abs(Math.cos(C.h) * u[0] - Math.sin(C.h) * u[1]);
  let m = -1e9; for (const u of ax) m = Math.max(m, Math.abs(dx * u[0] + dz * u[1]) - ext(A, u) - ext(B, u)); return m; }         // a left turn into a two-way road: the Bézier handles as parts of the legs to the corner (a round arc: .552, .552)           // in it while its body (a BODY rectangle, the chord from its nose back along its path) overlaps it anywhere across the road

// the lanes of a road in one direction: offsets to the right of travel (m), inner lane first
export function lanesOf(axis, L) { if (isOneWay(axis, L)) return [ONEWAY_LANE];
  if (!isHwy(axis, L)) return [1];   // an avenue: one travel lane each way, the inner one (±1); its kerb lanes (±3) are parking (the cars agent: vehicles/index.js parkOff)
  return [1.0, 3.2]; }   // Route 9 (half-width 7): two travel lanes each way; the outer 2.7 m is the shoulder, where LAST CHANCE's 2.5 m semi stands (districts/highway/build.js, x 229.55: 4.3–6.8 m out; a car in the 3.2 lane reaches 4.1)
const v0Of = (axis, L) => isHwy(axis, L) ? CAR.v0Hwy : isAve(axis, L) ? CAR.v0Ave : CAR.v0;   // (SPREAD: by class)

export function createTrafficSim({ seed = 0x7aff1c, night = false, clock = () => CLOCK.t } = {}) {
  PRIORITY.clear();   // (traffic fix: the lights' priority windows belong to this sim — rules.js PRIORITY)
  let s32 = seed >>> 0; const rnd = () => { s32 = (Math.imul(s32 ^ (s32 >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s32 / 4294967296; };
  // ── nodes: every grid point a road touches
  const nodes = new Map(), nk = (x, z) => x + ',' + z;
  const nodeAt = (Lx, Lz) => { const k = nk(Lx, Lz); let n = nodes.get(k); if (!n) { const N = segX(Lx, Lz - 1), S = segX(Lx, Lz), W = segZ(Lz, Lx - 1), E = segZ(Lz, Lx);
    n = { k, Lx, Lz, x: Lx * P, z: Lz * P, arms: { N, S, W, E }, sig: (N || S) && (W || E), hx: hwX(Lx), hz: hwZ(Lz), inn: [], box: { x: 0, z: 0 }, sigT: -1, sigV: null }; nodes.set(k, n); } return n; };
  // how far from a node's centre a lane on `axis` ends / starts: past the cross street's zebra, or right at the node when nothing crosses
  const stopD = (n, axis) => { const cross = axis === 'x' ? (n.arms.W || n.arms.E) : (n.arms.N || n.arms.S); return cross ? (axis === 'x' ? n.hz : n.hx) + STOP_BACK : .5; };
  // ── links: lanes (straight) and connectors (Béziers through a node)
  const links = [], lanes = [];
  const straight = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); return { x0, z0, ux: (x1 - x0) / len, uz: (z1 - z0) / len, len }; };
  const starts = new Map();   // node key + heading → lanes leaving that node that way (inner first)
  const sk = (n, ux, uz) => n.k + '|' + ux + ',' + uz;
  function addLane(axis, L, a, b, d, off, k, nLanes) {   // a road segment from node a to node b, heading d (+1: +z / +x), lane offset off
    const ux = axis === 'x' ? 0 : d, uz = axis === 'x' ? d : 0, rx = -uz, rz = ux, from = d > 0 ? a : b, to = d > 0 ? b : a;
    const d0 = stopD(from, axis), d1 = stopD(to, axis), g = straight(from.x + ux * d0 + rx * off, from.z + uz * d0 + rz * off, to.x - ux * d1 + rx * off, to.z - uz * d1 + rz * off);   // (fix round: the line is at the bar on every road — the avenues' lines were 2 m further back, so noses stopped 2.3 m short of the bar)
    const q = axis === 'x' ? a.Lz : a.Lx, dm = Math.max(...(axis === 'x' ? [[L - 1, q], [L, q]] : [[q, L - 1], [q, L]]).map(([i, j]) => TRAFFIC.dist[distOf(kindAt(i, j))] ?? .3));   // (the district: the busier side of the road)
    const hw = axis === 'x' ? hwX(L) : hwZ(L), ln = { id: links.length, kind: 'lane', axis, L, from, to, ux, uz, off, k, n: nLanes, hw, v0: v0Of(axis, L), dm, ...g, cars: [], next: [], feeds: [], want: 0,
      kerb: isHwy(axis, L) || k !== nLanes - 1 ? 0 : hw - KERB_IN - off };   // (CAB FOLLOW-UP · kerb: m to its right to the kerb lane where cars park — an avenue's ±3, a one-way's right-hand kerb; 0: none, Route 9)
    links.push(ln); lanes.push(ln); to.inn.push(ln); const key = sk(from, ux, uz); if (!starts.has(key)) starts.set(key, []); starts.get(key)[k] = ln; return ln; }
  for (let L = -33; L <= 33; L++) for (let q = -33; q < 33; q++) {
    if (segX(L, q)) { const a = nodeAt(L, q), b = nodeAt(L, q + 1), offs = lanesOf('x', L), dirs = isOneWay('x', L) ? [oneWayDir('x', L)] : [1, -1]; for (const d of dirs) offs.forEach((o, k) => addLane('x', L, a, b, d, o, k, offs.length)); }
    if (segZ(L, q)) { const a = nodeAt(q, L), b = nodeAt(q + 1, L), offs = lanesOf('z', L), dirs = isOneWay('z', L) ? [oneWayDir('z', L)] : [1, -1]; for (const d of dirs) offs.forEach((o, k) => addLane('z', L, a, b, d, o, k, offs.length)); } }
  // ── connectors: a Bézier from a lane's end to a lane's start, with an arc-length table (NS samples)
  const NS = 20, armOf = (ux, uz) => uz < 0 ? 'N' : uz > 0 ? 'S' : ux < 0 ? 'W' : 'E';
  function bez(inL, outL, turn) {
    const p0x = inL.x0 + inL.ux * inL.len, p0z = inL.z0 + inL.uz * inL.len, p3x = outL.x0, p3z = outL.z0;
    let c0, c3; if (turn === 'S') { const d = Math.hypot(p3x - p0x, p3z - p0z); c0 = c3 = d / 3; }
    else if (turn === 'U') { c0 = c3 = Math.max(3.5, Math.hypot(p3x - p0x, p3z - p0z) * 1.3); }   // (traffic fix: a turnaround — both handles straight on, a hairpin as wide as the lanes are apart)
    else if (turn === 'T') { c0 = c3 = TURNBACK.h; }   // (transit sync: the turnback — straight on, then out to the kerbs: below)
    else { // the corner where the two lane lines meet, and a near-circular arc into it
      const cx = inL.ux !== 0 ? p3x : p0x, cz = inL.uz !== 0 ? p3z : p0z; c0 = Math.hypot(cx - p0x, cz - p0z) * .552; c3 = Math.hypot(p3x - cx, p3z - cz) * .552; }
    const B = [p0x, p0z, p0x + inL.ux * c0, p0z + inL.uz * c0, p3x - outL.ux * c3, p3z - outL.uz * c3, p3x, p3z];
    if (turn === 'T') { const d = Math.hypot(p3x - p0x, p3z - p0z) || 1, ox = (p0x - p3x) / d, oz = (p0z - p3z) / d; B[2] += ox * TURNBACK.w; B[3] += oz * TURNBACK.w; B[4] -= ox * TURNBACK.w; B[5] -= oz * TURNBACK.w; }
    const X = new Float32Array(NS + 1), Z = new Float32Array(NS + 1), S = new Float32Array(NS + 1);
    for (let q = 0; q <= NS; q++) { const t = q / NS, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; X[q] = a * B[0] + b * B[2] + c * B[4] + d * B[6]; Z[q] = a * B[1] + b * B[3] + c * B[5] + d * B[7]; if (q) S[q] = S[q - 1] + Math.hypot(X[q] - X[q - 1], Z[q] - Z[q - 1]); }
    return { p0x, p0z, p3x, p3z, c0, c3, X, Z, S, len: S[NS] }; }
  // a body (len × wid) whose nose runs along a connector's path (from `back` m before it on the lane in to past its end on the lane out):
  // the least clearance to a rectangle q = { x, z, h, len, wid } over the whole sweep (the chord model place() draws)
  function sweepClear(g, inL, outL, q, blen = 4.7, bwid = 2) { const at = (s, o) => { if (s <= 0) { o[0] = g.p0x + inL.ux * s; o[1] = g.p0z + inL.uz * s; return o; } if (s >= g.len) { o[0] = g.p3x + outL.ux * (s - g.len); o[1] = g.p3z + outL.uz * (s - g.len); return o; }
      let k = 1; while (k < NS && g.S[k] < s) k++; const f = (s - g.S[k - 1]) / Math.max(1e-6, g.S[k] - g.S[k - 1]); o[0] = g.X[k - 1] + (g.X[k] - g.X[k - 1]) * f; o[1] = g.Z[k - 1] + (g.Z[k] - g.Z[k - 1]) * f; return o; };
    const F = [0, 0], R = [0, 0]; let m = 1e9; for (let s = 0; s <= g.len + blen; s += .2) { at(s, F); at(s - blen, R); m = Math.min(m, sepOf({ x: (F[0] + R[0]) / 2, z: (F[1] + R[1]) / 2, h: Math.atan2(F[0] - R[0], F[1] - R[1]), len: blen, wid: bwid }, q)); } return m; }
  function addConn(inL, outL, turn) {
    const n = inL.to, { p0x, p0z, p3x, p3z, c0, c3, X, Z, S } = bez(inL, outL, turn);
    let rm = 1e9; for (let q = 1; q < NS; q++) { const a0 = Math.atan2(X[q] - X[q - 1], Z[q] - Z[q - 1]), a1 = Math.atan2(X[q + 1] - X[q], Z[q + 1] - Z[q]), da = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))); if (da > 1e-4) rm = Math.min(rm, (S[q + 1] - S[q - 1]) / 2 / da); }
    const len = S[NS], r = turn === 'S' ? 1e9 : Math.min((c0 + c3) / (2 * .552), rm * 1.15), v0 = turn === 'S' ? Math.min(inL.v0, outL.v0) : Math.max(3.2, Math.min(8, Math.sqrt(CAR.latA * r)));
    const cn = { id: links.length, kind: 'conn', node: n, inL, out: outL, turn, X, Z, S, len, v0, r, cars: [], axis: inL.axis, bands: [], bIn: null, bOut: null };
    // the zebras it crosses: the one it enters the node over (the arm it comes from) and the one it leaves over (the arm it goes into), as
    // the nose positions (s along the connector, past its end onto the exit lane) over which a car's body overlaps the band
    const at = (s, o) => { if (s <= 0) { o[0] = p0x + inL.ux * s; o[1] = p0z + inL.uz * s; return o; } if (s >= len) { o[0] = p3x + outL.ux * (s - len); o[1] = p3z + outL.uz * (s - len); return o; }
      let q = 1; while (q < NS && S[q] < s) q++; const f = (s - S[q - 1]) / Math.max(1e-6, S[q] - S[q - 1]); o[0] = X[q - 1] + (X[q] - X[q - 1]) * f; o[1] = Z[q - 1] + (Z[q] - Z[q - 1]) * f; return o; };
    if (n.sig) for (const [arm, ax, az, hw, hr] of [[armOf(-inL.ux, -inL.uz), -inL.ux, -inL.uz, inL.axis === 'x' ? n.hz : n.hx, inL.hw], [armOf(outL.ux, outL.uz), outL.ux, outL.uz, outL.axis === 'x' ? n.hz : n.hx, outL.hw]]) {
      let s0 = -1, s1 = -1, l0 = 1e9, l1 = -1e9; const F = [0, 0], B = [0, 0];
      for (let s = 0; s <= len + BODY[0] + .5; s += .1) { at(s, F); at(s - BODY[0], B); const dx = F[0] - B[0], dz = F[1] - B[1], dl = Math.hypot(dx, dz) || 1, nx = -dz / dl * BODY[1] / 2, nz = dx / dl * BODY[1] / 2;
        let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9; for (const [px, pz] of [[F[0] + nx, F[1] + nz], [F[0] - nx, F[1] - nz], [B[0] + nx, B[1] + nz], [B[0] - nx, B[1] - nz]]) {
          const al = (px - n.x) * ax + (pz - n.z) * az, cr = (px - n.x) * -az + (pz - n.z) * ax; a0 = Math.min(a0, al); a1 = Math.max(a1, al); c0 = Math.min(c0, cr); c1 = Math.max(c1, cr); }
        if (a1 > hw + BAND[0] && a0 < hw + BAND[1] && c1 > -hr - .5 && c0 < hr + .5) { if (s0 < 0) s0 = s; s1 = s; l0 = Math.min(l0, c0); l1 = Math.max(l1, c1); } }
      // (l0 … l1: how far across the road the body sweeps over the band, in the node's frame — a walker outside it isn't in this car's way)
      if (s0 >= 0) { const bd = { key: n.Lx + ',' + n.Lz + ',' + arm, arm, s0: Math.max(0, s0 - .15), s1: s1 + .15, n, ax, az, l0, l1 }; cn.bands.push(bd); if (arm === armOf(-inL.ux, -inL.uz)) cn.bIn = bd; else cn.bOut = bd; } }
    // a turner that waits for walkers on the zebra it turns over waits at the line unless the box holds it clear of the zebra it came over
    cn.waitIn = !!(cn.bOut && cn.bIn && cn.bOut.s0 - .05 >= cn.bIn.s1 + .2);
    links.push(cn); inL.next.push(cn); outL.feeds.push(cn); return cn; }
  const todo = []; for (const ln of lanes) { const n = ln.to, ux = ln.ux, uz = ln.uz, oneWay = ln.n === 1 && isOneWay(ln.axis, ln.L);
    // lane discipline: straight on into the same lane, right turns from the right lane(s) into the right lane(s), left from the left
    const go = (vx, vz, turn) => { const outs = starts.get(sk(n, vx, vz)); if (!outs || !outs.length) return; const m = outs.length;
      const pick = turn === 'S' ? outs[Math.min(ln.k, m - 1)] : turn === 'R' ? outs[Math.max(0, m - 1 - (ln.n - 1 - ln.k))] : outs[Math.min(ln.k, m - 1)]; if (pick) todo.push([ln, pick, turn]);
      // traffic fix · Route 9's lane change: through a junction with a cross street (room to drift the 2.2 m over), straight on into the
      // other lane too — before, an inner lane only ever led to the inner lane, ran into the road's ends and was pruned end to end
      // (one way across per junction, alternating along the road — inward at one, outward at the next — so no two changes cross in the box)
      if (turn === 'S' && m > 1 && n.arms && stopD(n, ln.axis) > 2) for (const o of outs) if (o && o !== pick && ((o.k > ln.k) === (((n.Lx + n.Lz) & 1) === 0))) todo.push([ln, o, 'S']); };
    // (a left turn needs no gap in oncoming traffic off a one-way, or where nothing comes the other way: the road ends here, a T's stem;
    // where the road ends every lane turns: the left half left, the right half right)
    const ahead = !!starts.get(sk(n, ux, uz)), onc = n.inn.some(o => o.ux === -ux && o.uz === -uz), half = ln.k * 2 >= ln.n;
    go(ux, uz, 'S'); if (ln.n === 1 || (ahead ? ln.k === ln.n - 1 : half)) go(-uz, ux, 'R'); if (oneWay || (!onc && (ln.n === 1 || !ahead && !half))) go(uz, -ux, 'L'); }
  // fix round · the line at the bar everywhere. A car turning left into a two-way road swings its body (a chord of its path) over the
  // centre line, past the noses waiting at the bar to come the other way: so no left turn onto a two-way road where a car can go on
  // otherwise (NO LEFT TURN, as on the avenues), and where it can't (a T's stem, a dead end) the lanes opposite step their line back just
  // far enough (0.25 m steps) that a waiting nose clears every such sweep by 5 cm (5 × 1.8 m bodies). Every other line is at the bar.
  // TRAFFIC FIX (2026-10-08) · "can go on otherwise" now means: to a lane that leads somewhere (liveOf, the prune's own fixed point). A
  // left was dropped where the only other way was a stub into the water, and the lane died (Jay St onto Dock St). And a two-way road that
  // still leads nowhere gets a TURNAROUND at its end (a U connector into the lanes leaving the other way: Dock St's ends, Route 9's ends,
  // Union Ave past Route 9, the waterfront stubs of Main St and Bishop Ave), so nothing is pruned that a car could drive.
  const liveOf = T => { const nx = new Map(lanes.map(l => [l, []])); for (const [a, b] of T) nx.get(a).push(b); const live = new Set(lanes);
    for (let ch = true; ch;) { ch = false; for (const l of lanes) if (live.has(l) && !nx.get(l).some(o => live.has(o))) { live.delete(l); ch = true; } } return live; };
  const dropped = []; for (let k = todo.length - 1; k >= 0; k--) { const [ln, out, turn] = todo[k]; if (turn === 'L' && !isOneWay(out.axis, out.L) && todo.some(o => o[0] === ln && o[2] !== 'L') && !TURNBACK.left.has(ln.to.k)) dropped.push(...todo.splice(k, 1)); }
  { let live = liveOf(todo); const back = dropped.filter(([ln, out]) => !live.has(ln) && live.has(out)); if (back.length) { todo.push(...back); live = liveOf(todo); }
    // (the turnaround: wherever a two-way road ends — no lane on ahead — so the lanes leaving that end are reachable too: Market Ave and
    // Union Ave's west ends, Grand Ave's north end; and wherever a two-way lane still leads nowhere)
    const uOf = ln => { const opp = starts.get(sk(ln.to, -ln.ux, -ln.uz)); return opp && opp[Math.min(ln.k, opp.length - 1)]; };
    for (const ln of lanes) { if (isOneWay(ln.axis, ln.L) || starts.get(sk(ln.to, ln.ux, ln.uz))) continue; const o = uOf(ln); if (o) todo.push([ln, o, 'U']); }   // (the road's ends first)
    live = liveOf(todo); for (const ln of lanes) { if (live.has(ln) || isOneWay(ln.axis, ln.L)) continue; const o = uOf(ln); if (o) todo.push([ln, o, 'U']); }
    for (const ln of lanes) if (TURNBACK.at.has(ln.to.k) && ln.n > 1 && ln.k === ln.n - 1 && ln.ux === TURNBACK.dir[0] && ln.uz === TURNBACK.dir[1]) { const o = uOf(ln); if (o) todo.push([ln, o, 'T']); } }   // (transit sync: the turnback)   // (then any two-way lane still leading nowhere)
  for (const [ln, out, turn] of todo) { if (turn !== 'L' || isOneWay(out.axis, out.L)) continue; const g = bez(ln, out, turn);
    for (const o of ln.to.inn) { if (o.axis !== out.axis || o.ux !== -out.ux || o.uz !== -out.uz) continue; const h = Math.atan2(o.ux, o.uz);
      for (let e = o.back || 0; e <= 6; e += .25) { const nx = o.x0 + o.ux * (o.len - e), nz = o.z0 + o.uz * (o.len - e);
        if (sweepClear(g, ln, out, { x: nx - o.ux * 2.5, z: nz - o.uz * 2.5, h, len: 5, wid: 1.8 }, 5, 1.8) >= .05) { o.back = e; break; } } } }
  for (const ln of lanes) if (ln.back) ln.len -= ln.back;
  for (const [ln, out, turn] of todo) addConn(ln, out, turn);
  // prune: connectors into lanes nobody can leave (a stub, a dead end), until nothing changes
  const live = new Set(lanes); for (let changed = true; changed;) { changed = false;
    for (const ln of lanes) { if (!live.has(ln)) continue; ln.next = ln.next.filter(c => live.has(c.out)); if (!ln.next.length) { live.delete(ln); changed = true; } } }
  const alive = lanes.filter(l => live.has(l)); for (const ln of lanes) if (!live.has(ln)) ln.dead = true;
  // CAB FOLLOW-UP (2026-10-10) · THE STEMS. A lane with no way straight on (a T's stem: a one-way street that ends at a cross street, 45 of
  // them — z −1 into the trailer park's corner at −5,−1, x 2 into the waterfront at 2,−7) lets its cars out only by turning, in the flashing
  // DON'T WALK, into the street it ends at — and those streets (x −5 along the trailer park and the mall, z −7 along the water) collect every
  // stem's cars and give them a side street's green. The random driver went on straight three times in four, so a stem took most of what
  // came up to it and stood full: x −5's block below −5,−1 took ~4.3 cars a cycle at −5,0's 12 s green, the stem behind it ~1.6, and the
  // queue reached back over −4,−1 (every cab ride 270 s or more late stood there or at 2,−7). A driver with another way doesn't turn into a
  // stem it doesn't need: such a way weighs TRAFFIC.stem × (wOf)
  for (const ln of lanes) ln.stem = ln.next.length > 0 && ln.next.every(c => c.turn !== 'S');

  // ── cars
  const cars = []; let nextId = 1, t = 0, stepN = 0, fleet = null;
  const stat = { redRuns: 0, walkEntries: 0, intoWalkers: 0, overlaps: 0, overlapNow: 0, spawns: 0, drops: 0, ms: 0, avg: 0, max: 0, entered: 0, turned: 0 };
  const sigOf = n => { if (n.sigT !== stepN) { n.sigT = stepN; n.sigV = signalAt(n.Lx, n.Lz, clock()); } return n.sigV; };
  const lightFor = (ln) => ln.to.sig ? sigOf(ln.to)[ln.axis === 'x' ? 'ns' : 'ew'] : 'G';
  const other = ax => ax === 'x' ? 'z' : 'x';
  const yellowLeft = (n, axis) => phaseLeft(n.Lx, n.Lz, axis, clock());   // (s until its red: the cycle's, or a priority window's)
  // TRAFFIC FIX (2026-10-08) · transit signal priority: every route car asks the signalled junctions within PRI.reach m along its way
  // (PRI.ahead at most, none past the block of a stop it still has to serve) for its axis' green; a window the route cars no longer ask for, or one held
  // PRI.hold s, is let go (rules.js: its yellow, the all-red, the cycle; then the cross phase's PRI.cool s)
  function askLights() { const now = clock(), asks = []; let any = false;
    for (const c of cars) { const R = c.route; if (!R || c.stage || c.asCar) continue; any = true; let d = -c.s, got = 0; const st = R.stops[0];
      if (c.box) asks.push([-1, c.box, c.boxAx === 'x' ? 'ns' : 'ew']);   // (and the one it is crossing, till its body is out: a turner let go in the box met the WALK and stood there for it)
      for (let k = R.i; k < R.links.length && d < PRI.reach && got < PRI.ahead; k++) { const L = R.links[k]; if (st && st.i < k) break;   // (it stops first — but the junction past the stop's own block is asked, so the queue standing over the stop clears)
        d += L.len; if (L.kind === 'lane' && L.to.sig) { got++; asks.push([d, L.to, L.axis === 'x' ? 'ns' : 'ew']); } } }
    if (!any && !PRIORITY.size) return; asks.sort((a, b) => a[0] - b[0]); const held = new Set();
    for (const [, n, ax] of asks) { const p = priorityAsk(n.Lx, n.Lz, ax, now); if (p && p.ax === ax) held.add(n.k + ax); }
    for (const [k, p] of PRIORITY) { if (p.off === Infinity && (!held.has(k + p.ax) || now - Math.max(p.g, p.on) > PRI.hold)) { const [x, z] = k.split(',').map(Number); priorityDone(x, z, now); }
      if (now > p.off + TIMING.yellow + TIMING.allRed + PRI.cool + 1) PRIORITY.delete(k); } }
  // what a car looks like on its way: a pose at arc length s on a link (x, z, heading)
  function poseOn(L, s, out) { if (L.kind === 'lane') { out[0] = L.x0 + L.ux * s; out[1] = L.z0 + L.uz * s; out[2] = Math.atan2(L.ux, L.uz); return out; }
    const S = L.S; s = Math.max(0, Math.min(L.len, s)); let lo = 0, hi = NS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const f = (s - S[lo]) / Math.max(1e-6, S[hi] - S[lo]); out[0] = L.X[lo] + (L.X[hi] - L.X[lo]) * f; out[1] = L.Z[lo] + (L.Z[hi] - L.Z[lo]) * f; out[2] = Math.atan2(L.X[hi] - L.X[lo], L.Z[hi] - L.Z[lo]); return out; }
  // a point `back` m behind the car's nose, through the links it came along (a car is a chord: its rear follows its path)
  const PB = [0, 0, 0]; function behind(c, back, out) { let L = c.L, s = c.s - back, h = 0;
    while (s < 0) { const p = c.hist[h++]; if (!p) { poseOn(L, 0, out); out[0] += Math.sin(out[2]) * s; out[1] += Math.cos(out[2]) * s; return out; } L = p; s += L.len; }
    return poseOn(L, s, out); }
  function place(c) { const F = poseOn(c.L, c.s, c.F), R = behind(c, c.len, PB); c.x = (F[0] + R[0]) / 2; c.z = (F[1] + R[1]) / 2; const h = Math.atan2(F[0] - R[0], F[1] - R[1]); c.dh = h - c.h; c.h = h;
    // the front wheels steer into the path: the angle between the body and the path at the nose
    let st = F[2] - h; st = Math.atan2(Math.sin(st), Math.cos(st)); c.steer = Math.max(-.6, Math.min(.6, st * 1.6)); }
  // the way on: straight TRAFFIC.straight times as often as a turn. A long vehicle (the box truck) keeps straight and turns only where the
  // arc is wide enough for its body (r ≥ 0.75 × its length: the chord of a tighter arc cuts the kerb corner); one of 8 m or more keeps to the avenues
  const LONG = 5.5, wOf = (cn, c) => { if (cn.turn === 'T') return 1e-6;   // (the turnback: an ambient car takes it only where nothing else goes on)
    if (!c || c.len <= LONG) return (cn.turn === 'S' ? TRAFFIC.straight : 1) * (cn.out.stem ? TRAFFIC.stem : 1);
    const ok = cn.turn === 'S' || cn.r >= c.len * .75, ave = isAve(cn.out.axis, cn.out.L) || c.len < 8; return (ok && ave ? (cn.turn === 'S' ? 20 : 1) : ok ? .05 : .001) * (cn.out.stem ? TRAFFIC.stem : 1); };
  const pickNext = (ln, c) => { const N = ln.next; if (N.length < 2) return N[0] || null; let sum = 0; for (const q of N) sum += wOf(q, c); let x = rnd() * sum; for (const q of N) { x -= wOf(q, c); if (x <= 0) return q; } return N[N.length - 1]; };
  function enter(c, L, s) { c.L = L; c.s = s; L.cars.push(c); if (L.kind === 'lane') { c.next = pickNext(L, c); c.rp = false; c.go = !L.to.sig && !!c.next; c.passed = false; c.yd = undefined; } if (c.route) routeOn(c, L); }
  // MOVEMENT W3a · a ROUTE car (spawnRoute: today the stage's cruiser, stage/cruiser.js): an ordinary IDM car (lights, walkers, the car
  // ahead) whose way is given — c.route = { links: [lane, connector, lane …], i, stops: [{ i, s, go(c, dwell) }] }: it stops at each stop
  // (link i, s m along it) and stays until go() says so; past its last stop it drives on as traffic (release)
  function routeOn(c, L) { const R = c.route, i = R.links.indexOf(L, R.i); if (i < 0) { release(c); return; } R.i = i; if (L.kind === 'lane') { c.next = R.links[i + 1] || null; c.go = !L.to.sig && !!c.next; } }
  function release(c) { if (!c.route) return; c.route = null; c.asCar = false; if (c.stage) c.stageEnd = true; else c.kind = 'car'; if (c.L.kind === 'lane') { c.next = pickNext(c.L, c); c.go = !c.L.to.sig && !!c.next; } }
  function leave(c) { const a = c.L.cars, q = a.indexOf(c); if (q >= 0) a.splice(q, 1); }
  function spawn(ln, s, o = {}) { const m = o.model ?? ((rnd() * 1e6) | 0), c = { id: nextId++, kind: o.kind || 'car', model: m, len: o.len || 4.4, wid: o.wid || 1.8, L: null, s: 0, v: 0, acc: 0, next: null, go: false, passed: false,
      hist: [], x: 0, z: 0, h: 0, dh: 0, steer: 0, spin: rnd() * 6.28, F: [0, 0, 0], seenT: -1e9, born: t, box: null, brake: false, gone: false };
    // the driver (fix round: speed variety): desired speed ±12 %, acceleration and headway ±20 %; a long vehicle pulls away slower
    const lg = c.len > LONG ? (c.len > 8 ? .55 : .7) : 1; c.dv = (.88 + rnd() * .24) * (lg < 1 ? .92 : c.kind === 'patrol' ? 1.04 : 1); c.a = CAR.a * (.8 + rnd() * .4) * lg; c.T = CAR.T * (.85 + rnd() * .4) * (lg < 1 ? 1.2 : 1);
    enter(c, ln, s); c.v = o.v ?? 0; place(c); cars.push(c); stat.spawns++; return c; }
  function drop(c) { c.gone = true; leave(c); if (c.box) { c.box.box[c.boxAx]--; c.box = null; } const q = cars.indexOf(c); if (q >= 0) cars.splice(q, 1); stat.drops++; }
  // ── the walkers' side (set by the page: peds.js's sim) — who is on a zebra, and whether it shows WALK
  let walk = null;   // { crossings: Map key → edge (pedsim.js), inRoad(E) → bool }
  // walkers in the road on a zebra AND in this car's way (fix round): across the road within 0.7 m of where the body sweeps over the band
  // (bd.l0 … l1), or heading into it from under 4.5 m. A walker on the far half of an avenue, walking away, holds nobody (a walker held up
  // at the far kerb used to hold every car in the box, and the box held the lights: gridlock)
  const walkersIn = bd => { const E = walk?.crossings.get(bd.key); if (!E || E.off || !walk.inRoad(E)) return false; if (!E.from || !E.to || !E.list || bd.l0 === undefined) return true;
    const ux = (E.to.x - E.from.x) / E.len, uz = (E.to.z - E.from.z) / E.len, cx = -bd.az, cz = bd.ax, dw = ux * cx + uz * cz, n = bd.n;
    for (const w of E.list) { if (!(w.s > .9 && w.s < E.len - .9)) continue; const cw = (E.from.x + ux * w.s - n.x) * cx + (E.from.z + uz * w.s - n.z) * cz;
      if (cw > bd.l0 - .7 && cw < bd.l1 + .7) return true; if ((dw > .5 && cw <= bd.l0 - .7 && bd.l0 - cw < 4.5) || (dw < -.5 && cw >= bd.l1 + .7 && cw - bd.l1 < 4.5)) return true; }
    return false; };
  const walkOn = key => { const E = walk?.crossings.get(key), n = E && nodes.get(E.nodeKey); if (!n || E.off) return false; const g = sigOf(n); return E.arm === 'N' || E.arm === 'S' ? g.walkAcrossNS : g.walkAcrossEW; };
  // ── IDM
  const idm = (c, v, v0, gap, dv) => { const A = c.a || CAR.a, ss = CAR.s0 + Math.max(0, v * (c.T || CAR.T) + v * dv / (2 * Math.sqrt(A * CAR.b))), inter = (ss / Math.max(.05, gap)) ** 2;
    return (v > v0 ? -Math.min(CAR.b * 1.5, (v - v0) * 2) : A * (1 - (v / Math.max(.1, v0)) ** 4)) - A * inter; };   // (over its desired speed — a turn ahead — a car brakes at most 1.5 b, not IDM's (v/v0)⁴)
  const idmStop = (c, v, gap) => { const A = c.a || CAR.a, g = Math.max(.02, gap), ss = Math.max(0, v * (c.T || CAR.T) * .5 + v * v / (2 * Math.sqrt(A * CAR.b))) + .1; return A * (1 - (ss / g) ** 2) - (v > 0 && g < .3 ? CAR.bMax : 0); };
  const rearOf = L => { let m = null; for (const o of L.cars) if (!m || o.s < m.s) m = o; return m; };
  // the car in front along c's way: [gap (bumper to bumper), its speed]
  const LEAD = [0, 0]; function leader(c) { let gap = 1e9, vl = 0; const L = c.L, a = L.cars; for (const o of a) if (o !== c && o.s > c.s && o.s - o.len - c.s < gap) { gap = o.s - o.len - c.s; vl = o.v; }
    if (gap < 1e8) { LEAD[0] = gap; LEAD[1] = vl; return LEAD; }
    let rem = L.len - c.s, nx;
    if (L.kind === 'lane') { for (const cn of L.next) { const o = rearOf(cn); if (!o) continue; if (cn !== c.next && o.s - o.len > 3) continue; const g = rem + o.s - o.len; if (g < gap) { gap = g; vl = o.v; } }
      // (CAB FOLLOW-UP: a long body gone on into another way past this lane's end — a node with no box, a box truck — still has its tail
      // over the connectors and this lane's end: the car waits for it, whichever way it goes on itself)
      for (const cn of L.next) { const o = rearOf(cn.out); if (o && o.s - o.len < 0 && !cn.cars.length) { const g = rem + cn.len + o.s - o.len; if (g < gap) { gap = g; vl = o.v; } } }
      if (gap < 1e8 || !c.next) { LEAD[0] = gap; LEAD[1] = vl; return LEAD; } rem += c.next.len; nx = c.next.out; }
    else { if (c.s < 7) for (const cn of L.inL.next) { if (cn === L) continue; for (const o of cn.cars) if (o.s > c.s && o.s - o.len - c.s < 1 && o.s - o.len - c.s < gap) { gap = Math.max(0, o.s - o.len - c.s); vl = o.v; } }
      // traffic fix · a merge: another connector into the same lane (Route 9's lane changes) — the car nearer the lane goes first, the other
      // follows it as if it were ahead on its own path
      if (L.out.feeds.length > 1) for (const f of L.out.feeds) { if (f === L || f.node !== L.node || f.inL === L.inL) continue; for (const o of f.cars) { const ro = f.len - o.s, rc = L.len - c.s; if (ro < rc || (ro === rc && o.id < c.id)) { const g = Math.max(0, L.len - ro - o.len - c.s); if (g < gap) { gap = g; vl = o.v; } } } }
      nx = L.out; }
    for (let hop = 0; nx && rem < CAR.look && gap > 1e8; hop++) { const o = rearOf(nx); if (o) { gap = rem + o.s - o.len; vl = o.v; break; }
      if (nx.kind !== 'lane') { rem += nx.len; nx = nx.out; continue; } for (const cn of nx.next) { const o2 = rearOf(cn); if (o2 && rem + nx.len + o2.s - o2.len < gap) { gap = rem + nx.len + o2.s - o2.len; vl = o2.v; } } break; }
    LEAD[0] = gap; LEAD[1] = vl; return LEAD; }
  // room on the exit lane for this car AND every car already bound for it (on the connectors into it, or committed at a line): don't block the box
  // TRAFFIC FIX (2026-10-08) · the box rule, with a look ahead: the room counts what the exit's last car will have cleared by the time this
  // car is over (BOX.ahead s of its speed, only while it is moving off and not braking) — a 12 m bus needs ~14 m of a 21 m block, and
  // waiting for the whole block to stand empty held the buses at every line behind a queue that was already driving away
  const exitRoom = (cn, me) => { const X = cn.out, o = rearOf(X); let room = (o ? o.s - o.len + (o.v > 2.5 && o.acc > -.5 ? Math.min(o.v, 9) * BOX.ahead : 0) : X.len) - 1.2;
    for (const f of X.feeds) { for (const q of f.cars) room -= q.len + CAR.s0 + .2; for (const q of f.inL.cars) if (q !== me && q.go && q.next === f) room -= q.len + CAR.s0 + .2; }
    return room >= me.len + CAR.s0 + .6; };   // (fix round: every car counted at its jam gap, s0 — it stops that far behind the car ahead — so an empty block takes three,
                                              // not one and a bit; the lane out starts past the far zebra, so a car that fits stops clear of it)
  const commitDist = v => Math.max(3, v * 1.6 + 2);
  const routeV = (cn, c) => { if (cn.turn === 'S') return cn.v0 * c.dv; const p = routeP(c); return Math.max(p.vTurn0, Math.min(p.vTurn, Math.sqrt(p.latA * cn.r))); };   // (transit sync: a route car's speed through a connector)
  // how long until the nose is at D m on, from v, speeding up gently (0.7 × its a) to vm: the far zebra's clearing time
  const tReach = (v, D, a, vm) => { if (D <= 0) return 0; vm = Math.max(vm, v, .5); if (v >= vm - .01) return D / vm; const t1 = (vm - v) / a, d1 = v * t1 + a * t1 * t1 / 2; return d1 >= D ? (Math.sqrt(v * v + 2 * a * D) - v) / a : t1 + (D - d1) / vm; };
  const clearT = (c, cn, dist) => tReach(c.v, dist + cn.bOut.s1 + Math.max(0, c.len - BODY[0]), .7 * (c.a || CAR.a), cn.v0 * Math.min(1.05, c.dv || 1));
  // MOVEMENT REVIEW #5 #6 (2026-10-09) · ONE PAGE FRAME. The cars and the lights keep the movement clock: fleet.pace() is the seconds it
  // moved (traffic/fleet.js), so a pause stops them with the cabs and the tape's k× runs them k× (they ran 1×, and the buses — gone since
  // — drove through cars). Up to TICK.max steps of TICK.h
  // s a frame, longer past that (up to hMax); the shared signal clock (rules.js advance) moves with each step. null: the page's dt.
  function tick(dt) { const T = fleet?.pace ? fleet.pace() : null, tt = T === null ? Math.min(dt, .1) : T; if (!(tt > 0)) return 0;
    const n = Math.min(TICK.max, Math.ceil(tt / TICK.h - 1e-6)), h = Math.min(tt / n, TICK.hMax); for (let k = 0; k < n; k++) { advance(h); step(h); } return n * h; }
  // ── one step
  function step(dt) { const t0 = typeof performance !== 'undefined' ? performance.now() : 0; t += dt; stepN++; if (dt <= 0) return;
    for (const L of links) if (L.cars.length > 1) L.cars.sort((p, q) => q.s - p.s);
    if (fleet) fleet.sync();   // (CAB TRAFFIC: the signal clock on the movement's second, and the cabs: into the street, their bays)
    askLights();
    // decide: acceleration from the car ahead, the line, the zebras; then move (every car reads the positions before anyone moves)
    for (const c of cars) { if (c.kin) continue; const L = c.L, dv = c.dv, rt = c.route && !c.asCar; let v0 = L.kind === 'lane' ? L.v0 * dv : rt ? routeV(L, c) : L.v0 * Math.min(1.05, dv), acc, lim = 1e9;   // lim: how far it may move (never into the car ahead) · (rt: a route car on its own speeds; a cab — asCar — drives as any car)
      const [gap, vl] = leader(c); acc = gap < 1e8 ? idm(c, c.v, v0, gap, c.v - vl) : idm(c, c.v, v0, 1e9, 0); if (gap < 1e8) lim = Math.max(0, gap - .3);
      if (L.kind === 'lane') { const dist = L.len - c.s;
        // fix round · a driver who meant to turn but finds the zebra it would turn over showing WALK (or walkers in its way) on the green
        // keeps straight on instead, once per block, where it can: a turner waiting out WALK at the head of a one-lane approach held the
        // whole queue behind it for most of the green, and the blocks backed up into gridlock. Where it can't, it waits at the line.
        if (!c.rp && !c.route && c.next && c.next.turn !== 'S' && c.next.bOut && dist < 25 && L.to.sig && lightFor(L) === 'G' && (walkOn(c.next.bOut.key) || walkersIn(c.next.bOut))) { c.rp = true; const alt = L.next.find(q => q.turn === 'S' && !q.out.stem); if (alt) c.next = alt; }   // (CAB FOLLOW-UP: never on into a stem for it)
        const cn = c.next;
        if (cn && !(c.go && L.to.sig && lightFor(L) !== 'G')) { const vt = rt ? routeV(cn, c) : cn.v0 * Math.min(1.05, c.dv); v0 = Math.min(v0, Math.sqrt(vt * vt + 2 * (rt ? routeP(c).brake : 1.2) * Math.max(0, dist - 1))); acc = Math.min(acc, idm(c, c.v, v0, gap < 1e8 ? gap : 1e9, gap < 1e8 ? c.v - vl : 0)); }   // (slowing for the turn — but not once it has committed on the yellow: it clears the line first)
        if (!cn) { acc = Math.min(acc, idmStop(c, c.v, dist)); lim = Math.min(lim, Math.max(0, dist - .05)); }
        else if (L.to.sig && rt && !c.stage) { const n = L.to, wait = (c.rw || 0) > BOX.breakT; c.hold = null;   // (traffic fix: the box rule holds for route cars too — a late bus used to barge in after 3 s, stand in the box and lock the junction; now only BOX.breakT s at the line breaks a cycle)   // (the box rule still holds: never into a box the cross traffic is in, nor onto a full exit — for 8 s at most)
          if (!c.go || dist > commitDist(c.v)) { const bx = n.box[other(L.axis)] > 0; c.go = wait || !(bx || !exitRoom(cn, c)); if (!c.go) { c.hold = bx ? 'box' : 'room'; c.rw = (c.rw || 0) + (c.v < .2 && dist < 1.5 ? dt : 0); acc = Math.min(acc, idmStop(c, c.v, dist)); lim = Math.min(lim, Math.max(0, dist - .02)); } else c.rw = 0; }
          const bI = cn.bIn;   // (MOVEMENT W3a: a route car keeps its timetable — through the lights like a bus with priority; the box counts it, so the cross traffic waits; walkers on its zebra still hold it)
          if (bI && walkersIn(bI)) { const g = dist + bI.s0 - .2; acc = Math.min(acc, idmStop(c, c.v, g)); lim = Math.min(lim, Math.max(0, g)); c.hold = 'walkIn'; } }
        else if (L.to.sig) { const light = lightFor(L), n = L.to;
          if (c.go && light === 'R' && dist >= c.v * c.v / (2 * CAR.bMax) - .05) c.go = false;   // (a committed car caught by the red while it can still stop)
          // fix round · straight on, the body must be clear of the far zebra before the cross street's walkers get WALK (the end of the
          // yellow plus the all-red), at a pace it can make from here; if it can't, it stops while it still can — comfortably on the green,
          // hard on the yellow. (The first rule only asked for the line before the red: 6 cars in 5 min nosed into a zebra showing WALK.)
          const late = light !== 'R' && cn.turn === 'S' && !!cn.bOut && clearT(c, cn, dist) > yellowLeft(n, L.axis) + TIMING.allRed - .3;
          // the yellow: decided once, when a car first sees it — on only if it clears the line before the red (or can't stop at all)
          if (light === 'G') c.yd = undefined; else if (light === 'Y' && c.yd === undefined) { c.yd = (cn.turn === 'S' ? !late : c.v > 2 && dist / c.v < yellowLeft(n, L.axis) - .15) || dist < c.v * c.v / (2 * CAR.bMax) || (c.go && c.inWay); if (!c.yd) c.go = false; }   // (BUS POLISH: committed inside a clocked vehicle's stretch, with it due, it goes on through the yellow rather than stand in its way)
          if (c.go && light === 'Y' && !c.inWay && dist / Math.max(.1, c.v) > yellowLeft(n, L.axis) - .05 && dist >= c.v * c.v / (2 * CAR.bMax) - .05) { c.go = false; c.yd = false; }   // (held up on the way: it won't clear it in time, so it stops)
          if (c.go && late && dist >= c.v * c.v / (2 * (light === 'G' ? CAR.bStop : CAR.bMax)) - .05) { c.go = false; if (light === 'Y') c.yd = false; }
          c.hold = null; if (!c.go) { let ok = (light === 'G' || (light === 'Y' && c.yd)) && !late; if (!ok) c.hold = late ? 'late' : 'light';
            if (ok && n.box[other(L.axis)] > 0) { ok = false; c.hold = 'box'; }
            if (ok && !exitRoom(cn, c)) { ok = false; c.hold = 'room'; if (dist < 1 && c.v < .1 && (c.wait = (c.wait || 0) + dt) > 6) { const alt = !c.stage && !c.asCar && L.next.find(o => o !== cn && exitRoom(o, c)); if (alt) { c.next = alt; c.wait = 0; } } }   // (a full exit for a while: another way on, so a ring of full lanes can't lock — never for a car on a route of its own)
            if (ok && (dist < commitDist(c.v) || light === 'Y')) c.go = true;
            if (!ok) { acc = Math.min(acc, idmStop(c, c.v, dist)); lim = Math.min(lim, Math.max(0, dist - .02)); } }
          // the zebras: walkers in its way on the one it enters the node over hold it at the line; walkers on the one it leaves over (and,
          // turning, that zebra's WALK: those walkers go with this car's green) hold it AT THE LINE too (fix round), unless the box holds
          // it clear of the first zebra — a car never stands in the box with its rear on the zebra it just crossed
          const bI = cn.bIn, bO = cn.bOut; let g = 1e9;
          if (bI && bI.s0 < 1.5 && walkersIn(bI)) { g = dist + bI.s0 - .2; c.hold ??= 'walkIn'; }
          if (bO && ((cn.turn !== 'S' && walkOn(bO.key)) || walkersIn(bO))) c.hold ??= walkersIn(bO) ? 'walkOut' : 'turnWALK', g = Math.min(g, cn.turn !== 'S' && bO.s0 - .05 >= (bI ? bI.s1 : 0) + Math.max(0, c.len - BODY[0]) + .1 ? dist + bO.s0 - .2 : dist - .02);   // (straight on it waits at the line: stood in the box it could be caught there by the change)
          if (g < 30 && !(c.go && dist < .3 && c.v > 2)) { acc = Math.min(acc, idmStop(c, c.v, g)); lim = Math.min(lim, Math.max(0, g)); c.yw = true; } } }
      else { // on a connector: the zebras still ahead of its nose
        for (const bd of L.bands) { if (c.s > bd.s0 - .01) continue; const turning = L.turn !== 'S';
          if (walkersIn(bd) || (turning && walkOn(bd.key))) { const g = bd.s0 - c.s - .05; acc = Math.min(acc, idmStop(c, c.v, g)); lim = Math.min(lim, Math.max(0, g)); c.yw = true; } } }
      if (c.route) { const R = c.route, st = R.stops[0];   // (MOVEMENT W3a: a route car's stop on this link — held there until its go())
        if (st && st.i === R.i) { const g = st.s - c.s; if (g < -1) R.stops.shift(); else { acc = Math.min(acc, idmStop(c, c.v, Math.max(.02, g))); lim = Math.min(lim, Math.max(0, g)); c.bw = c.v < .2 && g < 14 ? (c.bw || 0) + dt : 0; if ((g < .8 || c.bw > 2) && c.v < .4) { st.at ??= t; if (st.go(c, t - st.at)) { R.stops.shift(); c.bw = 0; } } } }   // (held short of it by the car ahead: it serves the stop from there)
        else if (!st && !R.links[R.i + 1] && L.kind === 'lane') release(c); }
      c.acc = acc; c.lim = lim; }
    for (const c of cars) { if (c.kin) continue; const vPrev = c.v; let v = Math.max(0, c.v + c.acc * dt), ds = Math.max(0, (c.v + v) / 2 * dt); if (ds > c.lim) { ds = c.lim; v = Math.min(v, ds / dt); }
      c.v = v; c.brake = c.acc < -.7 || (v < .3 && vPrev < .5); c.spin += ds / (c.r || .34); c.s += ds; c.odo = (c.odo || 0) + ds;
      // band entries: counters (a car putting its nose into a zebra that shows WALK)
      if (c.L.kind === 'conn') for (const bd of c.L.bands) if (c.s - ds < bd.s0 && c.s >= bd.s0) { if (walkOn(bd.key)) { stat.walkEntries++; if (debug) debug(c, bd, 'walk'); } if (walkersIn(bd)) stat.intoWalkers++; }
      crossOn(c); c.yw = false; }
    for (const c of cars) if (!c.kin) place(c);   // (a kin car — a stage car pulled in, a cab in or into its bay — is posed by its owner)
    findBusy();
    // overlaps (the gate's counter): two bodies' rectangles intersecting, found through a 16 m grid
    stat.overlapNow = overlaps(); stat.overlaps += stat.overlapNow;
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0; stat.ms = ms; stat.avg += (ms - stat.avg) * .05; stat.max = Math.max(stat.max * .995, ms); }
  // a car's nose past its link's end: on through its next links (the lights' and the zebras' counters, the box it is in)
  function crossOn(c) { while (c.s >= c.L.len) { const L = c.L, over = c.s - L.len;
      if (L.kind === 'lane') { const cn = c.next; if (!cn) { c.s = L.len - .01; c.v = 0; break; }
        if (L.to.sig) { if (lightFor(L) === 'R') { stat.redRuns++; if (debug) debug(c, null, 'red'); } c.box = L.to; c.boxAx = L.axis; L.to.box[L.axis]++; }
        stat.entered++; if (cn.turn !== 'S') stat.turned++; leave(c); c.hist.unshift(L); if (c.hist.length > 3) c.hist.length = 3; enter(c, cn, over);
        for (const bd of cn.bands) if (over >= bd.s0) { if (walkOn(bd.key)) stat.walkEntries++; if (walkersIn(bd)) stat.intoWalkers++; } }
      else { leave(c); c.hist.unshift(L); if (c.hist.length > 3) c.hist.length = 3; enter(c, L.out, over); } }
    if (c.box && c.L.kind === 'lane' && c.s >= c.len + .2) { c.box.box[c.boxAx]--; c.box = null; } }
  let debug = null; const grid = new Map(); function overlaps() { grid.clear(); let n = 0;
    for (const c of cars) { const k = Math.floor(c.x / 16) + ',' + Math.floor(c.z / 16); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); }
    for (const c of cars) { const gx = Math.floor(c.x / 16), gz = Math.floor(c.z / 16);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of grid.get((gx + a) + ',' + (gz + b)) || []) if (o.id > c.id && Math.abs(o.x - c.x) < 6 && Math.abs(o.z - c.z) < 6 && obb(c, o)) { n++; if (debug) debug(c, o); } }
    return n; }
  function obb(A, B) {   // separating axes of two rectangles (length × width, 5 cm inset)
    const ax = [[Math.sin(A.h), Math.cos(A.h)], [Math.cos(A.h), -Math.sin(A.h)], [Math.sin(B.h), Math.cos(B.h)], [Math.cos(B.h), -Math.sin(B.h)]], dx = B.x - A.x, dz = B.z - A.z;
    const ext = (C, u) => (C.len / 2 - .05) * Math.abs(Math.sin(C.h) * u[0] + Math.cos(C.h) * u[1]) + (C.wid / 2 - .05) * Math.abs(Math.cos(C.h) * u[0] - Math.sin(C.h) * u[1]);
    for (const u of ax) if (Math.abs(dx * u[0] + dz * u[1]) > ext(A, u) + ext(B, u)) return false; return true; }

  // ── the zebras the cars hold now (the walkers ask before they step off the kerb): a car in the band, or one that can no longer stop
  // short of it (its nose within its braking distance of the band, and moving)
  const busy = new Set(); function findBusy() { busy.clear(); for (const c of cars) { if (c.kin) continue; const L = c.L, stopD = c.v * c.v / (2 * CAR.bStop) + 1.5;
      const ext = Math.max(0, c.len - BODY[0]);   // (a car longer than BODY holds a band that much longer)
      if (L.kind === 'conn') { for (const bd of L.bands) if (c.s + stopD >= bd.s0 && c.s <= bd.s1 + ext) busy.add(bd.key); }
      else { const h = c.hist[0]; if (h && h.kind === 'conn' && c.s < c.len + 1) for (const bd of h.bands) if (h.len + c.s <= bd.s1 + ext) busy.add(bd.key);
        const cn = c.next; if (cn && (c.go || !L.to.sig)) for (const bd of cn.bands) if (L.len - c.s + bd.s0 < stopD + (c.v > .5 ? 2 : 0)) busy.add(bd.key); } } }
  const crossBusy = key => busy.has(key);

  // ── population: round the focus and round the camera; o.seen(x, z, r) = could the camera see a car there (render.js)
  const lanePts = alive.map(l => [l.x0 + l.ux * l.len / 2, l.z0 + l.uz * l.len / 2]);
  const density = ln => (isHwy(ln.axis, ln.L) ? TRAFFIC.per100.hwy : isAve(ln.axis, ln.L) ? TRAFFIC.per100.ave : TRAFFIC.per100.street) * ln.dm * (night ? TRAFFIC.night : 1);
  let want = 0, patrolWant = 0; const MODELS = { n: 1, pick: () => (rnd() * 1e6) | 0, size: () => [4.4, 1.8, .34] };
  const clearAt = (ln, s, len) => { if (s < Math.max(7, len + 2) || s > ln.len - 7) return false;
    for (const o of ln.cars) if (o.s > s - len - 6 && o.s - o.len < s + 6) return false;
    if (s - len < 12) for (const f of ln.feeds) if (f.cars.length || f.inL.cars.some(q => q.go && q.next === f)) return false;   // (never in front of a car already bound in: it would stop it in the box)
    return true; };   // (a long body starts clear of the zebra behind it) };
  let seenFn = null;   // (populate's camera test, kept for seen())
  function populate(focus, first, o = {}) { const seen = o.seen || (() => false), cam = o.cam, R0 = TRAFFIC.radius, fx = focus.x, fz = focus.z; seenFn = o.seen || null;
    const inR = (x, z, pad) => { let dx = x - fx, dz = z - fz; if (dx * dx + dz * dz < (R0 + pad) ** 2) return true; if (!cam || cam[2] <= 0) return false; dx = x - cam[0]; dz = z - cam[1]; return dx * dx + dz * dz < (cam[2] + pad) ** 2; };
    const unseen = c => first || (t - c.seenT >= TRAFFIC.grace && !seen(c.x, c.z, 3));
    if (first) for (const c of cars.slice()) if (!c.route && !c.kin) drop(c);   // (transit sync: a camera jump re-seeds the traffic, not the buses and cabs on their runs: it dropped them all, and every rider waiting for one rode out of view)
    for (const c of cars.slice()) if ((!c.route && !c.kin && !inR(c.x, c.z, 16) && unseen(c)) || (c.stageEnd && unseen(c))) drop(c);   // (a route car runs wherever it is: MOVEMENT W3a)
    const rim = Math.max(R0, cam ? cam[2] : 0), fall = (x, z) => { let d = Math.hypot(x - fx, z - fz); if (cam) d = Math.min(d, Math.hypot(x - cam[0], z - cam[1])); return d <= TRAFFIC.full ? 1 : Math.max(TRAFFIC.edge, 1 - (1 - TRAFFIC.edge) * (d - TRAFFIC.full) / Math.max(1, rim - TRAFFIC.full)); };
    const near = [], tgt = []; let target = 0; alive.forEach((ln, k) => { const [x, z] = lanePts[k]; if (!inR(x, z, 0)) return; const n = ln.len * density(ln) / 100 * fall(x, z); near.push(ln); tgt.push(n); target += n; });
    const scale = target > TRAFFIC.max ? TRAFFIC.max / target : target > 0 && target < TRAFFIC.min ? Math.min(2, TRAFFIC.min / target) : 1; want = Math.round(target * scale);
    const cnt = near.map(l => l.cars.length + l.next.reduce((s, c) => s + c.cars.length, 0)); let n = cars.length;
    if (n > want * 1.05) { const over = near.map((l, k) => [l, cnt[k] - tgt[k] * scale]).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]);
      for (const [l, sur] of over) { let m = Math.floor(sur); for (const c of l.cars.slice()) { if (m <= 0 || n <= want) break; if (c.kind !== 'car' || !unseen(c) || c.box) continue; drop(c); m--; n--; } } }
    const order = near.map((l, k) => k).filter(k => tgt[k] * scale > cnt[k]), key = order.map(k => cnt[k] / (tgt[k] * scale) + rnd() * .05), ix = order.map((k, q) => q).sort((a, b) => key[a] - key[b]);
    const add = (ln, kind) => { for (let tries = 0; tries < 6; tries++) { const s = 7 + rnd() * (ln.len - 14), model = kind === 'patrol' ? -1 : MODELS.pick(ln.x0 + ln.ux * s, ln.z0 + ln.uz * s, ln), [len, wid, r] = MODELS.size(model); if (!clearAt(ln, s, len)) continue;
        const px = ln.x0 + ln.ux * (s - len / 2), pz = ln.z0 + ln.uz * (s - len / 2); if (!first && seen(px, pz, 4)) continue;
        const ahead = ln.cars.filter(o => o.s > s).reduce((m, o) => Math.min(m, o.s - o.len - s), 1e9), v = ahead < 12 ? 0 : Math.min(ln.v0 * .8, Math.sqrt(2 * CAR.b * Math.max(0, Math.min(ahead, ln.len - s) - 6)));
        const c = spawn(ln, s, { kind, len, wid, v, model }); c.r = r; return c; } return null; };
    for (const q of ix) { if (n >= want) break; const k = order[q], ln = near[k], d = tgt[k] * scale - cnt[k]; let m = Math.floor(d) + (rnd() < d % 1 ? 1 : 0); while (m-- > 0 && n < want) if (add(ln, 'car')) n++; }
    // patrols: as many as the sim-state asks for (simstate/layer.js), anywhere unseen round the focus
    let np = cars.filter(c => c.kind === 'patrol' && !c.stage).length; for (let g = 0; np < patrolWant && g < 40 && near.length; g++) if (add(near[(rnd() * near.length) | 0], 'patrol')) np++;
    if (np > patrolWant) for (const c of cars.slice()) if (c.kind === 'patrol' && !c.stage && np > patrolWant && unseen(c)) { drop(c); np--; }
    return want; }

  return { nodes, links, lanes: alive, cars, stat, step, tick, populate, crossBusy, poseOn, lanesOf,
    get t() { return t; }, get want() { return want; }, MODELS,
    why(c) { const L = c.L; if (L.kind !== 'lane' || !c.next) return null; return { light: lightFor(L), box: { ...L.to.box }, room: exitRoom(c.next, c), next: c.next.turn, out: c.next.out.cars.map(o => [+o.s.toFixed(1), +o.v.toFixed(1)]), outLen: +c.next.out.len.toFixed(1) }; },
    setWalkers(w) { walk = w; },
    // MOVEMENT W3a · route cars (simstate/movement.js): one on links[0] at s, if the lane is clear there (o.force: anyway) → the car, or null
    spawnRoute(links, s, o = {}) { const L = links[0]; if (!L) return null; const len = o.len || 4.4;
      if (!o.force && L.cars.some(q => q.s > s - len - 3 && q.s - q.len < s + 4)) return null;
      const c = spawn(L, s, { kind: o.kind || 'route', len, wid: o.wid, model: o.model, v: o.v || 0 }); c.r = o.r; const rp = routeP(c); c.dv = c.dv0 = o.dv || rp.dv; c.a = CAR.a * rp.a; c.T = CAR.T;   /* (a timetable to keep: brisker than the random long vehicles) */
      if (o.asCar) { c.asCar = true; c.dv = c.dv0 = o.dv ?? 1; c.a = o.a ?? CAR.a; c.T = o.T ?? CAR.T; }   // (CAB TRAFFIC: a cab — any car's rules, the average driver)
      c.route = { links, i: 0, stops: o.stops || [] }; if (o.stage) c.stage = true; routeOn(c, L); return c; },
    // STAGE CARS · out of its lane (pulled in to the kerb: kin, posed by the stage) and back in (only with nothing coming: → false, wait)
    stageOut(c) { if (!c.stage || c.kin || c.gone) return; leave(c); c.v = 0; c.kin = true; },
    stageIn(c, urgent = false) { if (!c.stage || !c.kin || c.gone) return !c.kin; const L = c.L, r = c.s - c.len, b = urgent ? CAR.bMax : CAR.b;   // (urgent: after a long wait, a gap the car behind can still stop for, hard)
      for (const q of L.cars) { if (q.s > r - (urgent ? 2 : 6) && q.s - q.len < c.s + 1) return false; if (q.s <= r - 2 && r - q.s < q.v * q.v / (2 * b) + (urgent ? 1.5 : 4)) return false; }
      if (r < 12) for (const f of L.feeds) if (f.cars.length || f.inL.cars.some(q => q.go && q.next === f)) return false;
      L.cars.push(c); c.kin = false; c.v = 0; place(c); return true; },
    release, dropCar: c => { if (!c.gone) drop(c); },
    // THE FLEET (traffic/fleet.js createFleet): F = { sync() at the top of every step (the signal clock on the movement's, the cabs), pace() }
    setFleet(F) { fleet = F; }, get fleet() { return fleet; },
    // CAB TRAFFIC (2026-10-10) · A KERB BAY (traffic/cabs.js: a cab at a stand pulls into a bay out of its travel lane). kerbIn(c): stopped
    // at its route stop, it is held there (kin: posed by its owner, sliding across) and stays in its lane's list, so the cars behind it
    // wait; kerbOff(c): its body is in the bay — out of the lane's list, the cars drive past it; kerbBack(c, urgent) → false while the lane
    // can't take it back (stageIn's gap: nothing over its body or about to be, nothing coming that can't stop for it), else in the lane's
    // list again (still kin: sliding out); kerbGo(c): IDM again, from rest. walkAt(key): a walkers' crossing there whose WALK holds a turner
    // (walkOn's own test: traffic/cabs.js plans a cab's approach with it)
    kerbIn(c) { if (c.kin || c.gone) return; c.kin = true; c.bay = true; c.v = 0; c.acc = 0; },
    kerbOff(c) { if (!c.bay || c.gone) return; leave(c); c.bayOff = true; },
    kerbBack(c, urgent = false) { if (!c.bay || c.gone) return false; if (!c.bayOff) return true; const L = c.L, r = c.s - c.len, b = urgent ? CAR.bMax : CAR.b;
      for (const q of L.cars) { if (q.s > r - (urgent ? 2 : 6) && q.s - q.len < c.s + 1) return false; if (q.s <= r - 2 && r - q.s < q.v * q.v / (2 * b) + (urgent ? 1.5 : 4)) return false; }
      if (r < 12) for (const f of L.feeds) if (f.cars.length || f.inL.cars.some(q => q.go && q.next === f)) return false;
      { const dEnd = L.len - c.s; if (L.kind === 'lane') for (const cn of L.next) { for (const q of cn.cars) if (dEnd + q.s - q.len < 2) return false; for (const q of cn.out.cars) if (dEnd + cn.len + q.s - q.len < 2) return false; } }   // (CAB FOLLOW-UP: nor a car just past its lane's end — a node with no box — that its nose would swing into)
      L.cars.push(c); c.bayOff = false; return true; },
    kerbGo(c) { if (!c.bay || c.gone) return; if (c.bayOff) { c.L.cars.push(c); c.bayOff = false; } c.bay = false; c.kin = false; c.v = 0; c.acc = 0; place(c); },
    walkAt: key => { const E = walk?.crossings.get(key); return !!E && !E.off; },
    seen: (x, z, r) => !!seenFn && seenFn(x, z, r), dropAny: c => { if (!c.gone) drop(c); },
    set debug(f) { debug = f; }, setPatrols(n) { patrolWant = Math.max(0, n | 0); }, patrols: () => cars.filter(c => c.kind === 'patrol' && !c.stage),
    counts: () => ({ cars: cars.length, want, lanes: alive.length, dead: lanes.length - alive.length, links: links.length, nodes: nodes.size }) };
}
