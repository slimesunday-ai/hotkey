// MOVEMENT W3a (2026-10-07) · TRUE-SYNC TRAVEL IN THE CITY (MOVEMENT.md §3, §5, §6). An agent whose trip carries `legs` (the sim's
// movement branch; until it lands the dev mock, simstate/movemock.mjs) is drawn on those legs at their real durations — no catch-up
// jumps, no vanishing — and the cabs it rides really drive in the traffic:
//   walk · skate · bike · scooter   along the leg's `path` (the export's walkers' graph: pedsim.js edges by position, posed through
//                   pedsim where(), so the lanes, ramps and corner arcs are the walkers' own) over (arr − dep) × 2.5 s. Skate, bike and
//                   scooter ride the real props (skate-board.js, ride-props.js: the board, the bike and the e-scooter, posed by the clip's
//                   clock — the props section below) and play the anim registry's clips by name (skate_ride…, bike_pedal, scooter_ride);
//                   without the clips: placeholder boxes, standing (board, scooter) or the walk's legs going (bike)
//   bus (legacy)    the buses are gone (2026-10-09: slime dropped them for the subway). A recording made before that still has bus legs:
//                   the rider waits at the stop (wait_stop) and rides out of view, back at the next leg on its booked minute
//   wait → taxi     a cab (the traffic's taxi model, an ordinary car of the traffic: traffic/cabs.js) comes up the lane from 42 m back or
//                   more and stops at the kerb (at a stand with bays, pulls into one); the agent ducks in (car_get_in when registered), is
//                   not drawn while riding (§3: the cab is), and gets out at the drop-off
//   subway          W3b builds the stairs and the carriage. Until then the agent walks to the kiosk, steps out of view there, and comes
//                   back out of the kiosk at the other end when the walk from it starts
//   late            a cab that runs late (lights, a queue) makes the agent late: the walk after it catches up at 1.6× until the
//                   trip is back on the sim's clock (never a jump)
//   riders avoid    (2026-10-08) every walk, skate, bike and scooter leg is published to the crowd each frame (sim.movers: where it is and
//                   where it will be over the next 1.6 s — pedsim.js steps its walkers aside, or stops them short) and WEAVES: a sideways
//                   offset inside the side's clear strip (pedsim.js room: the side room table) round walkers and movers that can't clear,
//                   smooth (limited sideways speed and acceleration), back to 0 in every corner square and at every leg end. The progress
//                   along the path, s(t), is untouched: the weave is across it only, so every arrival is where and when it was. A board
//                   steers with it (the yaw leans into the weave). Kickturn lines that would pass a post, a lamp or anything the side's
//                   strip doesn't clear are not cut: that corner is rolled on the lane. A path that runs round a dealing crew's corner
//                   (a detour: the walkers' node moved into the road) follows the walkers round it. ?ridersavoid=0: all of it off
//   follow cam      following an agent who boards, the camera follows the cab (camera/follow.js set(), a stand-in subject
//                   on the vehicle under the agent's id), and comes back to the agent when they get off
// The stage (stage/) may borrow a walking agent; one in a vehicle can't be borrowed (agents.js hold). Console: __simlive.agents.movement.
import * as THREE from 'three';
import { SIDE } from '../style.js';
import { STEP, NODE } from '../pedsim.js';
import { cornerPosts, slab as slabFn } from '../ground.js';
import { P as BLOCK, swX, swZ, SWALK, kerbOut } from '../plan.js';
import { tuneWorld } from './movetune.mjs';
import { createFleet } from '../traffic/fleet.js';
import { createCabs } from '../traffic/cabs.js';
import { createTravel } from '../../../world/export/travel.mjs';   // (CAB FOLLOW-UP: a rider who leaves a late cab walks the rest — the way on foot from there)   // (CAB TRAFFIC: the cabs, cars of the traffic, kept by the fleet)
import * as CLIPS from '../anim/cast/clips/index.js';   // (the authored clips: anim/cast/clips/CLIPS.md — skate, transit, the stops and the cabs)
import { BOARD, REST as BOARD_REST, boardGeometry, boardMatrix } from '../anim/cast/clips/skate-board.js';   // (the one skateboard model, posed by the clip's clock)
import { sdata } from '../../../world/city.js';   // (SPREAD: the data this spread reads)

import { GAME_MIN } from './simclock.js';
export { GAME_MIN } from './simclock.js';
// MOVEMENT W3b's seam: UNDER.hook(leg, simNow, legs, agent) for a stairs leg, a platform wait or a subway leg → a draw ({ show, x, y, z, yaw, vc, mode })
// or null (out of view). subway/index.js sets it: the stepped walk down and up the kiosk's stairs, and the carriage scene for a followed rider.
export const UNDER = { hook: null };
export const MOVE = {
  catchUp: .6,                 // a late agent walks this much faster (×1.6) until it is back on the sim's clock
  ride: { skate: { lift: .12, prop: 'board', clip: 'skate_ride', stand: true }, scooter: { lift: .13, prop: 'scooter', clip: 'scooter_ride', stand: true }, bike: { lift: .36, prop: 'bike', clip: 'bike_pedal', stand: false } },
  cabBail: 120, cabGiveUp: 600, cabWait: 90,   // CAB FOLLOW-UP (2026-10-10) · leaving a late cab (no jump: the old give-up put the rider on at once): past cabBail s late, a rider in a cab at rest in a lane pays, gets out and walks the rest — when walking it (at the late walker's 1.6× pace) is quicker than even the cab alone would be from there (traffic/cabs.js eta); past cabGiveUp s (a cab that can't get on: a deadlock), whatever the walk. cabWait: s past the booked departure a rider whose cab hasn't come walks instead
  cabBack: 42, getInS: 1.3, getOutS: 1.1, cabLead: 16,   // (CAB TRAFFIC: cabLead — game min before the hail its cab is planned, so its approach — a car alone through the lights, up to ~a minute — is planned before it comes into the street)
  offHide: 15,                 // MOVEMENT REVIEW #1: m of a walk's booked access stretch left undrawn (travel.mjs leg.off) from which that time is out of view
  // MOVEMENT REVIEW #4 · a crew on one trip (the same legs): per rank, a lag (s) along the way, a lateral slot (m: the weave's home), eased
  // in at ease s per s; short: m a member stops behind the last walk's end per rank
  crew: { lag: .45, lat: .45, ease: .5, short: .65 },
  // RIDERS AVOID (2026-10-08) · the weave: pass a walker (or another mover) no closer than sep (centre to centre), looking look s ahead;
  // sideways at most lat.v m/s and lat.a m/s² (a walking agent: walk.v / walk.a); never more than max off its path; 0 within node m of a
  // corner node and at a leg's end; the yaw leans by atan(sideways ÷ forward speed) × yaw. avoid: false → none of it (as before)
  avoid: true, weaveOn: true, weave: { sep: .72, look: 1.4, max: .6, node: 1.3, yaw: .9, lat: { v: 1.3, a: 4 }, walk: { v: .8, a: 3 }, body: .3 },
  // CROWD HOLD (2026-10-08) · THE RIDERS' LINE. On a walk wider than today's 2 m (SPREAD: 3 m on a side street, 4 on an avenue) a skate,
  // bike or scooter leg rides its own line — at × the walk's width from the curb (0.9 m on 3, 1.2 on 4: about the line the corner nodes
  // are on), where the walkers' lane rests 1.8 / 2.4 out (engine.js lanesOf REST) — and weaves round whoever is in it from there. The line
  // is part of the leg's drawn path (at(): pedsim where()'s cOff), a pure function of where it is along the side, so s(t) is untouched, the
  // crowd reads it in the published path ahead, and it needs no sideways speed: it keeps pad m clear of what the side's clear strip holds at
  // the kerb (the room table), eases in and out at ≤ slope m per m (a tree, a bin, a lamp passed wide and early), never crosses the lane, is
  // back on the lane node + blend m from each corner (a dealing corner: past its ramp, r1 + ramp) and end m from a leg's end or its turn to a
  // door. Its sideways reach for the weave grows with the walk (max + the extra width). On a 2 m walk: none of it (today's ride).
  band: { at: .3, from: 2.5, pad: .12, slope: .35, node: 1.3, blend: 1.7, ramp: 1.4, end: 2, on: true },
  // CROWD GRID (2026-10-10) · THE CAPPED LAG. A walk, skate, bike or scooter leg no longer goes through whoever is in its way: it reads the
  // crowd's body map (pedsim.js sim.near: every walker, agent, cop, actor and footprint, as of the last step) along its path ahead and
  // brakes (brake m/s²) to stop pad m short of the first body it would touch, falling behind its booking — at most cap s (past that it
  // keeps the booking's pace, and the crowd makes way for it as before: RIDERS AVOID). When the way is clear it catches up, at catch (a
  // ride) or catchWalk (a walk) s of lag per s, i.e. 1.35× / 1.6× its pace, and never more than catchV / catchVWalk m/s over it; where nobody can see it — neither where it is nor where its
  // booking has it — it is put back on the booking at once (counted: lagSnaps). A leg that ends late hands its lag to the next leg on foot
  // or on wheels; a wait or a ride after it starts on the sim's clock (the wait is that much shorter). r: the mover's body radius.
  // AT WALKING PACE ONLY (2026-10-10, slime on the tape: "he just starts glitching and tweaking on the road"). The brake, the catch-up and
  // the cap are body speeds (m/s, s of lag at the natural pace: GAME_MIN s a game minute), and the crowd they brake for walks in real
  // time whatever the clock does. When the movement clock runs faster than maxPace × the natural pace — the tape playing at 4× (where a
  // marker click plays it), 16×, 60×, or a sim run faster than its 60-min day — a leg's booking ran away from its brake: held up at
  // walking speed, capped 3 s behind (0.75 real s at 4×), let go, held again — a stop every other frame, and pops of 0.7–4 m in view
  // (tools/tapeclick.mjs; the crew walking into the Heap at 4×: 41 jumps in speed over 3 m/s in 8 s, 0 at 1×). Above it the lag is
  // off (as before the crowd grid: the crowd makes way, RIDERS AVOID); a lag already held is walked off at catchWalk in the faster time.
  // A jump of the movement clock (a tape seek, a page that joins) starts a leg's lag over: the walker is where its booking has it.
  lag: { on: true, cap: 3, catch: .35, catchWalk: .6, catchV: 1.5, catchVWalk: .9, brake: 4, pad: .08, r: .3, step: .1, close: 1.1, maxPace: 1.5 },
  // CROWD GRID · THE MOVERS' LINE ON A ZEBRA: a leg crosses lat m to the box side of the walkers' first file (pedsim.js where(): eased in over the
  // first 0.6 m, back over the last 1.1 m before the walkers' far kerb), so it passes the crowd waiting at the kerb — the files and the kerb
  // row stand on the far side of the file's line, away from the junction — instead of walking through them on a red. Less where a corner
  // post stands in the way (zebraLat: a signal pole by the kerb on the junction side of some crossings)
  zebra: { on: true, lat: .75 },
};
// riders avoid: ?ridersavoid=0 → as before (no weave, no published movers, kickturns and detours as they were)
if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('ridersavoid') === '0') MOVE.avoid = false;
// the skate clips stand the body on the deck (skate.js: the root carries the deck's height), so the walker itself stays on the ground
if (CLIPS.CLIP.skate_ride) MOVE.ride.skate.lift = 0;
// the ride clips (ride.js) do the same: bike_pedal's root sits the body on the saddle (0.2125 m up), scooter_ride's stands it on the deck
// (0.1265 m), and the bike's legs are the clip's (stand). `seat` is that lift: a rider whose clip hasn't blended in yet (and a mid walker,
// which plays no clip) is lifted by it instead, as a skater is by the deck
if (CLIPS.CLIP.bike_pedal) Object.assign(MOVE.ride.bike, { lift: 0, stand: true, seat: .2125 });
if (CLIPS.CLIP.scooter_ride) Object.assign(MOVE.ride.scooter, { lift: 0, seat: .1265 });
const SPEED = { walk: 1.5, skate: 4, bike: 5.5, scooter: 6.5 }, coarseId = id => typeof id === 'string' && id.startsWith('dist:');
const hash = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };
const lerp = (a, b, k) => a + (b - a) * k, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), smooth01 = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

export function createMovement({ peds, log = () => {}, clips = null }) {
  const sim = peds.sim, S = { runs: 0, legs: 0, cabs: 0, fallbacks: 0, late: 0, decodeFail: 0, ms: [], arrivals: [], vlegs: [] };
  // ── the walkers' graph by position (the export's walk graph IS pedsim's: same nodes, same edge ids)
  let NB = null, INC = null, SIDES = null;
  // (riders avoid: a node a dealing crew's corner moved out into the road keeps its own place, n.x0/z0 — the export's paths are on it)
  const nx0 = (n, o) => o ? n.x0 ?? n.x : n.x, nz0 = (n, o) => o ? n.z0 ?? n.z : n.z;
  function index() { NB = new Map(); INC = new Map(); SIDES = new Map(); for (const n of sim.nodes.values()) { const k = Math.floor(nx0(n, true)) + ',' + Math.floor(nz0(n, true)); if (!NB.has(k)) NB.set(k, []); NB.get(k).push(n); }
    for (const E of sim.edges) { for (const n of [E.from, E.to]) { if (!INC.has(n)) INC.set(n, []); INC.get(n).push(E); } if (!E.cross && !E.joint) SIDES.set(E.i + ',' + E.j + ',' + E.side, E); } }
  const nodeNear = (x, z, o) => { const i = Math.floor(x), j = Math.floor(z); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const n of NB.get((i + a) + ',' + (j + b)) || []) if (Math.abs(nx0(n, o) - x) < .06 && Math.abs(nz0(n, o) - z) < .06) return n; return null; };
  function onEdge(n, x, z, o) { for (const E of INC.get(n) || []) { const ax = nx0(E.from, o), az = nz0(E.from, o), dx = nx0(E.to, o) - ax, dz = nz0(E.to, o) - az, L2 = dx * dx + dz * dz; if (!L2) continue;
      const u = ((x - ax) * dx + (z - az) * dz) / L2; if (u < -.01 || u > 1.01) continue; if (Math.hypot(ax + dx * u - x, az + dz * u - z) < .06) return { E, s: Math.max(0, Math.min(1, u)) * E.len }; } return null; }
  const edgeBetween = (a, b) => { for (const E of INC.get(a) || []) { if (E.from === a && E.to === b) return { E, s0: 0, s1: E.len }; if (E.from === b && E.to === a) return { E, s0: E.len, s1: 0 }; } return null; };
  // a leg's path → segments along sidewalk edges ({ E, s0, s1 }) or straight ({ a, b }: a door's walk to the lane, a kiosk, a kerb)
  // (o: match the path to the nodes' own places — a detour corner's node moved out into the road is still found where the export has it)
  // CROWD GRID (2026-10-10) · WALKER JUMPS. A path point in the middle of a side (a door's lane point, a stand's, a trip's end) is on the
  // export's node line, NODE m from the curb; the walkers' lane rests there only on today's 2 m walk — on a wider one (SPREAD) it rests 1.8 /
  // 2.4 m out. A stretch with such an end was drawn straight on the node line while the stretch beside it ran on the lane (pedsim where()),
  // so the walker jumped 0.6 / 1.2 m across the walk where they met (a leg's end, a turn to a door): 39 jumps a run, every one a sim agent.
  // Now such a point is the lane's own point there: two on one side are a stretch of that side, and a straight stretch ends on the lane.
  function sideAt(x, z, o) { const i = Math.floor(x / BLOCK), j = Math.floor(z / BLOCK);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const sd of 'NSWE') { const E = SIDES.get((i + a) + ',' + (j + b) + ',' + sd); if (!E || E.off) continue;
      const ax = nx0(E.from, o), az = nz0(E.from, o), dx = nx0(E.to, o) - ax, dz = nz0(E.to, o) - az, L2 = dx * dx + dz * dz; if (!L2) continue;
      const u = ((x - ax) * dx + (z - az) * dz) / L2; if (u <= 0 || u >= 1) continue; if (Math.hypot(ax + dx * u - x, az + dz * u - z) < .06) return { E, s: u * E.len }; }
    return null; }
  function geomRaw(path, o) {
    if (!NB) index(); const segs = [], N = path.map(p => nodeNear(p[0], p[1], o)), SP = path.map((p, k) => N[k] ? null : sideAt(p[0], p[1], o)); let det = false;
    const drawn = (p, sp) => { if (!sp) return [p[0], p[1]]; SE.E = sp.E; SE.s = sp.s; const w = sim.where(SE, [0, 0, 0, 0]); return [w[0], w[2]]; };   // (a side's point: where the lane is there)
    for (let k = 0; k + 1 < path.length; k++) { const p = path[k], q = path[k + 1], a = N[k], b = N[k + 1]; let sg = null;
      if (a && b) sg = edgeBetween(a, b);
      else if (a) { const e = onEdge(a, q[0], q[1], o); if (e) sg = { E: e.E, s0: e.E.from === a ? 0 : e.E.len, s1: e.s }; }
      else if (b) { const e = onEdge(b, p[0], p[1], o); if (e) sg = { E: e.E, s0: e.s, s1: e.E.to === b ? e.E.len : 0 }; }
      else if (SP[k] && SP[k + 1] && SP[k].E === SP[k + 1].E) sg = { E: SP[k].E, s0: SP[k].s, s1: SP[k + 1].s };   // (along one side, between two of its points)
      if (!sg) { sg = { a: drawn(p, SP[k]), b: drawn(q, SP[k + 1]) }; sg.len = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]); if (sg.len > 1e-3) segs.push(sg); continue; }
      sg.len = sg.E ? Math.abs(sg.s1 - sg.s0) : Math.hypot(q[0] - p[0], q[1] - p[1]); if (sg.len > 1e-3) segs.push(sg);
      if (o && sg.E && (sg.E.from.x0 !== undefined || sg.E.to.x0 !== undefined)) det = true; }   // (an edge at a moved node: the detour)
    return finish(segs, det); }
  function finish(segs, det = false) { let c = 0; segs.forEach((s, k) => { s.c0 = c; c += s.len; const n = segs[k + 1], p = segs[k - 1]; if (s.E && s.s1 > s.s0) { if (n?.E && n.s1 > n.s0) s.next = n.E; if (p?.E && p.s1 > p.s0) s.pE = p.E; } });
    // (crowd grid · walker jumps: two pieces that don't meet — a pinched corner, whose lane skirts its node; a piece walked against the ring,
    // which has no corner arc — are joined over the last / first metre each side: gapOut / gapIn, half the gap each)
    for (let k = 0; k + 1 < segs.length; k++) { const a = segs[k], b = segs[k + 1]; if (a.next && a.next === b.E) continue; const e = segEnd(a, 1), s0 = segEnd(b, 0), gx = s0[0] - e[0], gz = s0[1] - e[1];
      if (Math.hypot(gx, gz) > .05 && Math.hypot(gx, gz) < 2.5) { a.gapOut = [gx, gz]; b.gapIn = [gx, gz]; } }
    return { segs, len: c, k: 0, det, tmp: { E: null, s: 0, next: null, pE: null } }; }
  const SE = { E: null, s: 0 }, segEnd = (sg, e) => { if (!sg.E) return e ? sg.b : sg.a; SE.E = sg.E; SE.s = e ? sg.s1 : sg.s0; const p = sim.where(SE, [0, 0, 0, 0]); return [p[0], p[2]]; };
  // RIDERS AVOID · a path through a dealing crew's corner follows the walkers round it (their detour, out in the road), anchored at the
  // old geometry's two ends — the leg starts and ends exactly where it did — with a straight step wherever two pieces don't meet
  function geomOf(path) {
    if (!MOVE.avoid) return geomRaw(path, false); const G = geomRaw(path, true); if (!G.det || !G.segs.length) return G; const O = geomRaw(path, false); if (!O.segs.length) return G;
    const out = [], line = (p, q) => ({ a: p, b: q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }), b = segEnd(O.segs[O.segs.length - 1], 1); let prev = segEnd(O.segs[0], 0);
    for (const sg of G.segs) { const p = segEnd(sg, 0); if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-3) out.push(line(prev, p));
      const E = sg.E, mA = E?.off && (E.from.detour || E.to.detour);
      if (mA) {   // a closed crossing at the crew's corner: across from the moved node to the far kerb on the crossing's own line, then up to the far node (straight from the moved node it ran diagonally through the far corner's signal box)
        const Ua = E.from.detour ? E.to : E.from, Mo = Ua === E.from ? E.to : E.from, ux = nx0(Ua, true), uz = nz0(Ua, true), L0 = Math.hypot(nx0(Mo, true) - ux, nz0(Mo, true) - uz) || 1;
        const K = [ux + (nx0(Mo, true) - ux) * NODE / L0, uz + (nz0(Mo, true) - uz) * NODE / L0], q = segEnd(sg, 1), toU = (sg.s1 > sg.s0) === (Ua === E.to);
        if (!Ua.detour) { if (toU) out.push(line(p, K), line(K, q)); else out.push(line(p, K), line(K, q)); } else out.push(line(p, q)); prev = q; continue; }
      out.push({ ...sg }); prev = segEnd(sg, 1); }
    if (Math.hypot(b[0] - prev[0], b[1] - prev[1]) > 1e-3) out.push(line(prev, b)); S2.detours = (S2.detours || 0) + 1;
    return finish(out.filter(s => s.len > 1e-4)); }
  function at(G, d, out) {   // the point d m along → out [x, y, z, heading]
    const Sg = G.segs; if (!Sg.length) return null; d = Math.max(0, Math.min(G.len, d)); let k = Math.min(G.k, Sg.length - 1); while (k > 0 && Sg[k].c0 > d) k--; while (k < Sg.length - 1 && Sg[k].c0 + Sg[k].len < d) k++; G.k = k;
    const sg = Sg[k], u = sg.len ? (d - sg.c0) / sg.len : 0;
    if (sg.E) { const T = G.tmp; T.E = sg.E; T.s = sg.s0 + (sg.s1 - sg.s0) * u; T.next = sg.next || null; T.pE = sg.pE || null; G.bo = 0; T.cOff = null; T.lat = G.zl && sg.E.cross && !sg.E.off && !sg.E.from.detour && !sg.E.to.detour ? zebraLat(sg.E) : 0;   // (crowd grid: a mover's line on a zebra)
      if (G.ride && !sg.E.cross && !sg.E.joint) { G.segF = segF(sg, d); if (G.segF > 0) T.cOff = G.cof; }   // (crowd hold: the riders' line, eased off at a segment end mid-side)
      sim.where(T, out); if (sg.s1 < sg.s0) out[3] += Math.PI; }   // (against the ring: the edge's heading turned round)
    else { out[0] = lerp(sg.a[0], sg.b[0], u); out[2] = lerp(sg.a[1], sg.b[1], u); out[1] = SIDE; out[3] = Math.atan2(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]); }
    if (sg.gapOut || sg.gapIn) { const B = Math.min(1, sg.len * .45), de = sg.c0 + sg.len - d, ds = d - sg.c0;   // (the join, see finish())
      if (sg.gapOut && de < B) { const f = smooth01(1 - de / B) * .5; out[0] += sg.gapOut[0] * f; out[2] += sg.gapOut[1] * f; }
      if (sg.gapIn && ds < B) { const f = (1 - smooth01(ds / B)) * .5; out[0] -= sg.gapIn[0] * f; out[2] -= sg.gapIn[1] * f; } }
    return out; }

  // ── CROWD HOLD · THE RIDERS' LINE (MOVE.band) along one side wider than today's walk: per 0.2 m, the offset (m, − toward the curb) from the
  // walkers' lane to the line, made once per side and lanes / room version; null where there is none (a 2 m walk, no room data). cOff:
  // pedsim where()'s hook, set on a ride leg's geometry (run(): G.ride) — it also leaves the offset it applied in G.bo, for the weave.
  function bandOf(E) {
    const ver = sim.ver; if (E._bv === ver) return E._bd; E._bv = ver; E._bd = null; const B = MOVE.band, sw = E.sw;
    if (!B.on || E.cross || E.joint || !(sw > B.from)) return null;
    const ua = sim.sideU(E, 0), ub = sim.sideU(E, E.len), u0 = Math.min(ua, ub), u1 = Math.max(ua, ub), st = .2, n = Math.floor((u1 - u0) / st) + 1, line = B.at * sw;
    const t = new Float32Array(n), c = new Float32Array(n), o = new Float32Array(n); let any = false;
    let known = 0; for (let k = 0; k < n; k++) { const u = u0 + k * st, r = sim.roomSpan(E, u, u, RL2); c[k] = sim.laneC(E, u); if (!r) { t[k] = c[k]; continue; } known++;   // (off the table — a dealing corner's node, moved out into the road: the lane)
      let v = Math.max(line, r[0] + B.pad); if (v > r[1] - B.pad) v = c[k]; t[k] = Math.min(v, c[k]); }   // (no room for a body there: the lane)
    if (!known) return null;
    for (let k = 1; k < n; k++) t[k] = Math.max(t[k], t[k - 1] - B.slope * st);   // (out early before a kerb thing, back late after it)
    for (let k = n - 2; k >= 0; k--) t[k] = Math.max(t[k], t[k + 1] - B.slope * st);
    const dA = (ua <= ub ? E.from : E.to).detour, dB = (ua <= ub ? E.to : E.from).detour, zA = dA ? dA.r1 + B.ramp : B.node, zB = dB ? dB.r1 + B.ramp : B.node;
    for (let k = 0; k < n; k++) { const u = u0 + k * st, f = smooth01(Math.min(u - u0 - zA, u1 - u - zB) / B.blend); o[k] = Math.min(0, t[k] - c[k]) * f; if (o[k] < -.01) any = true; }
    return E._bd = any ? { u0, st, o } : null; }
  function bandOff(E, u) { const b = bandOf(E); if (!b) return 0; const f = (u - b.u0) / b.st, k = Math.max(0, Math.min(b.o.length - 1, Math.floor(f))), k1 = Math.min(b.o.length - 1, k + 1), w = Math.max(0, Math.min(1, f - k)); return b.o[k] * (1 - w) + b.o[k1] * w; }
  // (the line is eased off within band.end m of a segment end that is mid-side: the leg's start or end at a door's lane point, a stand)
  function segF(sg, d) { const L = sg.E.len, B = MOVE.band, mA = sg.s0 > 1e-3 && sg.s0 < L - 1e-3, mB = sg.s1 > 1e-3 && sg.s1 < L - 1e-3;
    return Math.min(mA ? smooth01((d - sg.c0) / B.end) : 1, mB ? smooth01((sg.c0 + sg.len - d) / B.end) : 1); }
  const rideGeom = G => { G.ride = true; G.segF = 1; G.cof = (E, u) => (G.bo = bandOff(E, u) * G.segF); return G; };

  // ── RIDERS AVOID · is a straight line clear for a body (MOVE.weave.body)? Every 0.1 m: off every corner post (ground.js cornerPosts: the
  // lamps and the signal poles), and on a sidewalk inside its side's clear strip where the side room table knows it (pedsim.js roomSpan:
  // walker-sized, against everything the block's build left there). Out in the road, nothing but the posts is in the way.
  const S2 = {}, POSTS = new Map(), RL = [0, 0], postsOf = (i, j) => { const k = i + ',' + j; let p = POSTS.get(k); if (!p) POSTS.set(k, p = cornerPosts(i, j)); return p; };
  function pointClear(x, z) { if (!NB) index(); const i = Math.floor(x / BLOCK), j = Math.floor(z / BLOCK), r = MOVE.weave.body;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [px, pz, pr] of postsOf(i + a, j + b)) if (Math.hypot(px - x, pz - z) < pr + r) return false;
    for (const side of ['N', 'S', 'W', 'E']) { const E = SIDES.get(i + ',' + j + ',' + side); if (!E) continue;
      const s0 = slabOf(i, j), cc = side === 'N' ? z - s0.z0 : side === 'S' ? s0.z1 - z : side === 'W' ? x - s0.x0 : s0.x1 - x, uu = side === 'N' || side === 'S' ? x : z;
      const sw = side === 'N' ? swZ(j) : side === 'S' ? swZ(j + 1) : side === 'W' ? swX(i) : swX(i + 1);   // (SPREAD: the side's own walk; 2 today)
      if (cc < -.05 || cc > sw + .2) continue; const R = sim.roomSpan(E, uu, uu, RL); if (R && (cc < R[0] - .03 || cc > R[1] + .03)) return false; }
    return true; }
  const lineClear = (a, b) => { const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(L / .1)); for (let k = 0; k <= n; k++) if (!pointClear(a[0] + (b[0] - a[0]) * k / n, a[2] + (b[2] - a[2]) * k / n)) return false; return true; };
  // CROWD GRID · a zebra's line for movers (MOVE.zebra): the widest of lat, 0.6, 0.45, 0.3 m whose whole eased line clears every corner post
  // by a body (a signal pole stands 0.75 m to the junction side of some crossings' kerb: there the line stays on the file's, 0), once a crossing
  const ZL = new Map(), ZP = [0, 0, 0, 0], ZT = { E: null, s: 0, lat: 0 };
  function zebraLat(E) { let v = ZL.get(E); if (v !== undefined) return v; v = 0; ZT.E = E;
    for (const L of [MOVE.zebra.lat, .6, .45, .3]) { let ok = true; ZT.lat = -L;
      for (let s = 0; s <= E.len && ok; s += .1) { ZT.s = s; const p = sim.where(ZT, ZP), i = Math.floor(p[0] / BLOCK), j = Math.floor(p[2] / BLOCK);
        for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) for (const [px, pz, pr] of postsOf(i + a, j + b)) if (Math.hypot(px - p[0], pz - p[2]) < pr + MOVE.weave.body) { ok = false; break; } }
      if (ok) { v = -L; break; } }
    ZL.set(E, v); return v; }
  const SLABS = new Map(), slabOf = (i, j) => { const k = i + ',' + j; let s = SLABS.get(k); if (!s) SLABS.set(k, s = slabFn(i, j)); return s; };

  // ── SKATE (anim/cast/clips/skate.js) · a skate leg's PLAN, made once from its path and its real duration T (s), so every frame is a pure
  // function of the leg's clock (a seek, a walker that comes into view mid-leg: the same pose as if it had been watched all along):
  //   the route   the path, with each sharp corner (70–112°, within 6 m) cut into a KICKTURN: ride up the incoming line to 0.275 m past
  //               the lines' crossing, stop, kickturn (skate_kickturn when the heading increases, _r when it decreases: 0.75 s), and on
  //               its end frame the walker moves by the clip's shift and turns ±90° — which leaves it on the outgoing line — then on
  //   the clips   push at the start (whole 2 s cycles: it hands over at its seam) → ride from a random clock (a crowd never carves in
  //               step) · after a kickturn (it chains into ride at 0, the ride stance) one more push · an OLLIE now and then on a
  //               straight, started where the ride's own loop is back at its stance (no pop), with 5 m clear ahead
  //   the timing  the kickturns stand still, so the rest rolls a little faster: (length) / (T − kicks × 0.75); too little time → no kicks
  const SKC = CLIPS.CLIP, SK = { kick: SKC.skate_kickturn?.dur ?? .75, push: SKC.skate_push?.dur ?? 2, ride: SKC.skate_ride?.dur ?? 4.8, ollie: SKC.skate_ollie?.dur ?? .8,
    shift: Math.abs(SKC.skate_kickturn?.shift?.[0] ?? .275), turnMin: 1.22, turnMax: 1.95, arcMax: 6, vMax: 6.5, ollieP: .45, ollieClear: 5 };
  const SKATING = new Set(['skate_push', 'skate_ride', 'skate_kickturn', 'skate_kickturn_r', 'skate_ollie']);
  const rnd01 = (s, k) => (hash(s + '#' + k) % 10007) / 10007;
  function skatePlan(G, T, seed) {
    const step = .25, n = Math.max(2, Math.ceil(G.len / step)), H = [], P = []; let prev = null;
    for (let i = 0; i <= n; i++) { const p = at(G, Math.min(G.len, i * step), [0, 0, 0, 0]); let h = p[3]; if (prev !== null) h = prev + wrapA(h - prev); H.push(h); P.push(p); prev = h; }
    G.k = 0;
    // the turning runs (> ~1° per 0.25 m), joined across one-sample gaps
    const runs = []; let r = null;
    for (let i = 0; i < n; i++) { const turning = Math.abs(H[i + 1] - H[i]) > .02; if (turning) { if (r && i - r.i1 <= 2) r.i1 = i; else runs.push(r = { i0: i, i1: i }); } }
    const pieces = []; let d = 0;
    for (const q of runs) {
      const dA = q.i0 * step - .25, dB = (q.i1 + 1) * step + .25, turn = H[Math.min(n, q.i1 + 1)] - H[q.i0];
      if (dA < Math.max(2, d + 1) || dB > G.len - 1.5 || dB - dA > SK.arcMax || Math.abs(turn) < SK.turnMin || Math.abs(turn) > SK.turnMax) continue;
      const A = at(G, dA, [0, 0, 0, 0]), B = at(G, dB, [0, 0, 0, 0]), h0 = A[3], sg = turn > 0 ? 1 : -1, h1 = h0 + sg * Math.PI / 2;
      const f0 = [Math.sin(h0), Math.cos(h0)], g1 = [Math.sin(B[3]), Math.cos(B[3])], den = f0[0] * g1[1] - f0[1] * g1[0]; if (Math.abs(den) < .5) continue;
      const u = ((B[0] - A[0]) * g1[1] - (B[2] - A[2]) * g1[0]) / den, X = [A[0] + f0[0] * u, A[2] + f0[1] * u];
      const S = [X[0] + f0[0] * SK.shift, A[1], X[1] + f0[1] * SK.shift], sx = sg * SK.shift, sz = -SK.shift;   // (the kick's start, and its shift: body frame)
      const E = [S[0] + sx * Math.cos(h0) + sz * Math.sin(h0), A[1], S[2] - sx * Math.sin(h0) + sz * Math.cos(h0)];
      const inL = Math.hypot(S[0] - A[0], S[2] - A[2]), outL = Math.hypot(B[0] - E[0], B[2] - E[2]), f1 = [Math.sin(h1), Math.cos(h1)];
      if (u < .4 || (S[0] - A[0]) * f0[0] + (S[2] - A[2]) * f0[1] < .2 || (B[0] - E[0]) * f1[0] + (B[2] - E[2]) * f1[1] < .3) continue;   // (too tight a corner to stop on)
      if (MOVE.avoid && !(lineClear(A, S) && lineClear(S, E) && lineClear(E, B))) { S2.kicksRolled = (S2.kicksRolled || 0) + 1; continue; }   // (riders avoid: a line that would pass a post or leave its side's clear strip: this corner is rolled on the lane)
      if (dA > d) pieces.push({ kind: 'path', d0: d, d1: dA, len: dA - d });
      pieces.push({ kind: 'line', a: [A[0], A[1], A[2]], b: S, len: inL, h: h0 }, { kind: 'kick', S, E, h0, h1, sg, clip: sg > 0 ? 'skate_kickturn' : 'skate_kickturn_r' }, { kind: 'line', a: E, b: [B[0], B[1], B[2]], len: outL, h: Math.atan2(B[0] - E[0], B[2] - E[2]) });
      d = dB; }
    if (G.len > d) pieces.push({ kind: 'path', d0: d, d1: G.len, len: G.len - d });
    let kicks = pieces.filter(p => p.kind === 'kick').length, M = pieces.reduce((s, p) => s + (p.len || 0), 0);
    if (kicks && (T - kicks * SK.kick < T * .55 || M / (T - kicks * SK.kick) > SK.vMax)) { pieces.length = 0; pieces.push({ kind: 'path', d0: 0, d1: G.len, len: G.len }); kicks = 0; M = G.len; }   // (no time to stop: rolls the corners)
    const v = M / Math.max(.1, T - kicks * SK.kick);
    // the timeline: each piece's [τ0, τ1) and the moving distance at its start
    let tau = 0, m = 0; for (const p of pieces) { p.m0 = m; p.t0 = tau; if (p.kind === 'kick') tau += SK.kick; else { tau += p.len / v; m += p.len; } p.t1 = tau; }
    // the clips: [{ clip, a, b (τ), c0 (the clip's clock at a) }]
    const W = [], kickP = pieces.filter(p => p.kind === 'kick'), straightAt = (t0, t1) => { const m0 = (t0 - kicksBefore(t0) * SK.kick) * v; return !kickP.some(k => k.t0 > t0 - .2 && k.t0 < t1 + SK.ollieClear / v) && m0 + SK.ollieClear < M; };
    function kicksBefore(t) { let k = 0; for (const p of kickP) if (p.t1 <= t) k++; return k; }
    const ride = (a, b, c0) => {   // ride from τ a to b, its clock starting at c0; ollies at its stance (the loop's seam), now and then
      let t = a, c = c0, s0 = a, sc = c0; for (let j = 0; j < 12; j++) { const wrap = t + (SK.ride - ((c % SK.ride) + SK.ride) % SK.ride || SK.ride); if (wrap + SK.ollie + .3 > b) break;
        if (rnd01(seed, Math.round(wrap * 10)) < SK.ollieP && straightAt(wrap, wrap + SK.ollie)) { if (wrap > s0) W.push({ clip: 'skate_ride', a: s0, b: wrap, c0: sc }); W.push({ clip: 'skate_ollie', a: wrap, b: wrap + SK.ollie, c0: 0 }); t = s0 = wrap + SK.ollie; c = sc = 0; }
        else { c += wrap - t; t = wrap; } }
      if (b > s0) W.push({ clip: 'skate_ride', a: s0, b, c0: sc }); };
    let t = 0, first = true;
    for (const k of [...kickP, null]) { const end = k ? k.t0 : T, room = end - t, np = first ? Math.min(2, Math.floor(room / SK.push)) : room > SK.push + 1.5 ? 1 : 0;
      if (np > 0) { W.push({ clip: 'skate_push', a: t, b: t + np * SK.push, c0: 0 }); t += np * SK.push; }
      if (end > t) ride(t, end, first && np > 0 ? rnd01(seed, 'r') * SK.ride : 0);
      first = false; if (k) { W.push({ clip: k.clip, a: k.t0, b: k.t1, c0: 0, kick: k }); t = k.t1; } }
    return { pieces, v, M, W, T }; }
  // where a skate leg is at τ (s into the leg) → out { x, y, z, yaw, moving, snap, clip, clipT }
  const SKO = { x: 0, y: 0, z: 0, yaw: 0, moving: false, snap: false, clip: null, clipT: 0 }, SKP = [0, 0, 0, 0];
  function skateAt(G, pl, tau) {
    const o = SKO; tau = Math.max(0, Math.min(pl.T, tau)); o.snap = false;
    let p = pl.pieces.find(q => tau < q.t1) || pl.pieces[pl.pieces.length - 1];
    if (p.kind === 'kick') { o.x = p.S[0]; o.y = p.S[1]; o.z = p.S[2]; o.yaw = p.h0; o.moving = false; o.snap = true; }
    else { const u = p.t1 > p.t0 ? Math.max(0, Math.min(1, (tau - p.t0) / (p.t1 - p.t0))) : 1;
      if (p.kind === 'path') { const P = at(G, p.d0 + (p.d1 - p.d0) * u, SKP); o.x = P[0]; o.y = P[1]; o.z = P[2]; o.yaw = P[3]; }
      else { o.x = lerp(p.a[0], p.b[0], u); o.y = lerp(p.a[1], p.b[1], u); o.z = lerp(p.a[2], p.b[2], u); o.yaw = p.h ?? Math.atan2(p.b[0] - p.a[0], p.b[2] - p.a[2]); }
      o.moving = tau < pl.T; const k = pl.pieces.indexOf(p); if (k > 0 && pl.pieces[k - 1].kind === 'kick' && tau - p.t0 < .05) { o.snap = true; o.yaw = pl.pieces[k - 1].h1; } }   // (the kick's end frame: the turn, outright)
    const w = pl.W.find(q => tau < q.b) || pl.W[pl.W.length - 1]; o.clip = w ? w.clip : 'skate_ride'; o.clipT = w ? w.c0 + Math.max(0, tau - w.a) : 0;
    return o; }

  // ── transit: the export's lines (tuned to the sim's numbers) and the traffic sim (window.__city.traffic, when the cars are on)
  let W = null, TS = null, TR = null, fleet = null, taxiModels = [], transitOff = false, TV = null;
  fetch(new URL(sdata('../../../world/export/world.json'), import.meta.url), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j) W = tuneWorld(j); else transitOff = true; })
    .catch(e => { transitOff = true; log('movement: no world export (' + (e && e.message || e) + '): riders are not drawn in cabs'); });
  function initTransit() {
    if (fleet) return true; if (transitOff || !W) return false; const T = window.__city?.traffic; if (!T?.sim?.spawnRoute) { if (window.__city && !T) transitOff = true; return false; }
    TR = T; TS = T.sim; taxiModels = T.MODELS.map((m, k) => m.name === 'taxi' ? k : -1).filter(k => k >= 0); if (!taxiModels.length) taxiModels = [T.MODELS.length - 1];
    // the fleet: the cabs, cars of the traffic, and the signal clock locked to the movement's (traffic/fleet.js, traffic/cabs.js)
    fleet = createFleet(TS, { cabs: createCabs }); TS.setFleet(fleet);
    TS.parkedIn ??= (x0, z0, x1, z1) => !!window.__city?.parkedIn?.(x0, z0, x1, z1);   // (CAB FOLLOW-UP: the cars standing in the road, from the blocks' anchors: a cab drops at a free kerb)
    return true; }
  let gameNow = 0, STOPS = null;
  // a stop's or a station's own point (the export's: where the walks to and from it start and end)
  const stopPt = id => { if (!W) return null; if (!STOPS) STOPS = new Map([...W.transit.stops, ...W.transit.stations].map(q => [q.id, [q.x, q.z]])); return STOPS.get(id) || null; };
  // where a cab is (its frame: forward f, r the kerb side — the doors the rider uses)
  function carFrame(c) { const fx = Math.sin(c.h), fz = Math.cos(c.h); return { x: c.x, z: c.z, fx, fz, rx: -fz, rz: fx, h: c.h }; }

  // ── cabs (CAB TRAFFIC, 2026-10-10): traffic/cabs.js plans the cab's approach from the leg (due at the kerb CAB.in s before the booked
  // departure, for a car alone through the lights) and puts it in the street as a car of the traffic: what it meets on the way is its own
  const standOf = id => { if (!W || typeof id !== 'string' || !id.startsWith('kerb:')) return null; const k = id.slice(5); return W.transit.stops.find(q => q.id === k && q.kind === 'taxi') || null; };
  const cabFor = (leg, next) => { if (!fleet || !leg.path?.length) return null; const model = taxiModels[hash(leg.path.join()) % taxiModels.length];
    const cab = fleet.cabs.add(leg, { model, size: TS.MODELS.size(model), out: W.modes.taxi.drive?.out ?? 3, stand: standOf(leg.from), dropTo: next?.path?.[0] || null }); if (!cab) { S.decodeFail++; return null; } S.cabs++; return cab; };

  // ── the follow cam onto the vehicle and back (camera/follow.js: its public set(); the stand-in carries the agent's id)
  const PX = new Map(); let pxSeq = 0;
  const camOn = id => { const c = window.__city?.cam; return !!c && c.mode === 'follow' && c.subject?.aid === id; };
  function proxyOn(a, car, y) { if (!camOn(a.id) || PX.has(a.id)) return; const p = { id: -1e6 - (++pxSeq), agent: true, aid: a.id, look: a.look, p: [car.x, y, car.z, car.h], yawS: car.h, vc: 0, ph: 0, tier: 1, gone: false, car, y, ride: true };
    PX.set(a.id, p); try { window.__city.cam.follow.set(p); } catch (e) { log('movement: follow ' + e.message); } }
  function proxyOff(a) { const p = PX.get(a.id); if (!p) return; p.gone = true; PX.delete(a.id); }
  const proxyFrame = () => { for (const p of PX.values()) { const c = p.car; if (c.gone) { p.gone = true; continue; } p.p[0] = c.x; p.p[1] = p.y; p.p[2] = c.z; p.p[3] = c.h; p.yawS = c.h; p.vc = c.v; } };

  // ── RIDERS AVOID · the movers this frame (pedsim.js steps its walkers aside for them), and the weave. MOVERS: each moving leg's place,
  // heading, speed and its path over the next 1.6 s (FT) — true sync, so that is where it will be. The weave reads last frame's walkers
  // (a 2 m grid, made once a frame when a leg first asks).
  const MOVERS = sim.movers || [], FT = [.2, .4, .6, .8, 1, 1.2, 1.4, 1.6], WG = new Map(), wcell = (x, z) => (Math.floor(x / 2) + 8192) * 16384 + (Math.floor(z / 2) + 8192);
  let fno = 0, wgF = -1, jumpF = 0, pace = 1; const CF = new Float32Array(12), CS = new Float32Array(12), AXV = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }, RW = [0, 0], RL2 = [0, 0], ST = { E: null, dA: 0, dB: 0, ax: 0, az: 0, lo: 0, hi: 0 }, FP = [0, 0, 0, 0];
  function walkerGrid() { WG.clear(); for (const w of sim.walkers) { if (!w.p) continue; const k = wcell(w.p[0], w.p[2]); let L = WG.get(k); if (!L) WG.set(k, L = []); L.push(w); } }
  // the stretch of path at distance d along G a weave may use: an edge's straight run (crossing: out in the road only; a side: its clear
  // strip round the lane, from 0.3 m behind to 1.5 m ahead) → ST { ax, az: the axis across it, lo, hi: the room along that axis, dA, dB:
  // how far back to its start and on to its end }; null where there is none (a straight stretch, a detour, no room data)
  function stretchAt(G, d, v = 0) {
    const sg = G.segs[G.k]; if (!sg?.E) return null; const E = sg.E, u = sg.len ? (d - sg.c0) / sg.len : 0, s = sg.s0 + (sg.s1 - sg.s0) * u; ST.E = E; ST.dA = d - sg.c0; ST.dB = sg.c0 + sg.len - d; ST.max = MOVE.weave.max;
    if (E.cross) { if (E.from.detour || E.to.detour) return null; const m = Math.min(s - (STEP + .5), E.len - NODE - .5 - s, .5); if (m <= 0) return null; ST.ax = E.awx; ST.az = E.awz; ST.lo = -m; ST.hi = m; return ST; }
    if (E.joint) return null; const sw = E.side === 'N' ? swZ(E.j) : E.side === 'S' ? swZ(E.j + 1) : E.side === 'W' ? swX(E.i) : swX(E.i + 1), B = MOVE.band;
    // (crowd hold, a wider walk: the room behind is measured to the side's own corner — a leg that starts mid-side, at a door's lane point or
    // a stand, used to take its first 1.3 m as a corner square; ahead, to the segment's end: a corner, the leg's end or its turn to a door)
    if (sw > B.from) ST.dA = sg.s1 >= sg.s0 ? s : E.len - s;
    if (E.from.detour || E.to.detour) { if (!(sw > B.from)) return null;   // (crowd hold, a wider walk: a side by a dealing crew's corner weaves too, clear of the walkers' ramp into the road and round it)
      const rf = E.from.detour ? s - (E.from.detour.r1 + B.ramp) : 1e9, rt = E.to.detour ? E.len - s - (E.to.detour.r1 + B.ramp) : 1e9; if (rf <= 0 || rt <= 0) return null;
      const fw = sg.s1 >= sg.s0; ST.dA = Math.min(ST.dA, fw ? rf : rt); ST.dB = Math.min(ST.dB, fw ? rt : rf); }
    const a = AXV[E.side], uu = sim.sideU(E, s), dir = sim.sideDir(E) * (sg.s1 >= sg.s0 ? 1 : -1), c = sim.laneC(E, uu);
    if (c < .15) return null; ST.ax = a[0]; ST.az = a[1];
    if (sw > B.from) {   // (crowd hold, a wider walk: the room for the offset sample by sample ahead, round the path's own place THERE — the lane, or a
      // rider's line, which moves across the walk — not round its place now: a rider held off its line by walkers met a hydrant; and further ahead)
      const ahead = Math.max(1.5, v * 1.1), n = Math.ceil((ahead + .3) / .2); let lo = -9, hi = 9;
      for (let q = 0; q <= n; q++) { const du = -.3 + q * (ahead + .3) / n, u2 = uu + dir * du, r2 = sim.roomSpan(E, u2, u2, RW); if (!r2) { if (!q) return null; continue; }   // (past the table's end: a corner's square, kept by the cap)
        const cb = sim.laneC(E, u2) + (G.ride ? bandOff(E, u2) * segF(sg, d + du) : 0); if (r2[0] + .02 - cb > lo) lo = r2[0] + .02 - cb; if (r2[1] - .02 - cb < hi) hi = r2[1] - .02 - cb; }
      ST.lo = Math.min(0, lo); ST.hi = Math.max(0, hi); ST.max = MOVE.weave.max + (sw - SWALK); return ST; }   // (and a wider reach)
    const r = sim.roomSpan(E, uu - dir * .3, uu + dir * Math.max(1.5, v * .8), RW); if (!r) return null;
    ST.lo = Math.min(0, r[0] + .02 - c); ST.hi = Math.max(0, r[1] - .02 - c);
    return ST; }
  // one frame of a leg's weave → the offset (m along the stretch's axis). (x, z, yaw): the path's point now; v: speed along the path;
  // d: distance along G (null: no stretch — a skate line or kick); dEnd: to the leg's end, or the end of the skate piece it is on
  function weave(R, G, me, kind, x, z, yaw, v, d, dEnd, dt) {
    const Wv = MOVE.weave, K = kind === 'walk' ? Wv.walk : Wv.lat, wv = R.wv ??= { off: 0, ov: 0, k: -1, ax: 0, az: 0 };
    if (wv.k !== R.k) { wv.k = R.k; wv.off = 0; wv.ov = 0; }   // (each leg starts on its path)
    const held = MOVE.lag.on && d !== null && v <= .05 && R.cl > 0 && dEnd > .25, st = d !== null && v > .05 && MOVE.weaveOn ? stretchAt(G, d, v) : null; let home = R.home || 0, tg = st ? home : 0, lo = 0, hi = 0; wv.has = !!st;   // (home: a crew member's own lateral slot, MOVEMENT REVIEW #4 — 0 for anyone else)
    if (st) { const cap = Math.max(0, Math.min(st.dA, st.dB, dEnd) - Wv.node), M = st.max; lo = Math.max(st.lo, -M, -cap); hi = Math.min(st.hi, M, cap); wv.ax = st.ax; wv.az = st.az;
      if (home) { const h = Math.abs(home), pos = hi >= h * .5, neg = lo <= -h * .5; home = home > 0 ? (pos ? Math.min(h, hi) : neg ? Math.max(-h, lo) : 0) : (neg ? Math.max(-h, lo) : pos ? Math.min(h, hi) : 0); tg = home; }   // (a crew member's slot: its own side of the lane, or the other where its own has no room)
      // who the path ahead runs into: across the stretch, where each will be when the mover gets there (its own step aside included)
      const hx = Math.sin(yaw), hz = Math.cos(yaw), reach = Math.min(v * Wv.look + 1.2, Math.max(0, Math.min(st.dB, dEnd) - Wv.node) + Wv.sep); let nC = 0;
      // who it would meet: each one's place across the stretch when it gets there (CF) and how far apart they must pass (CS) — off the crowd's
      // body map when there is one (crowd grid: a scene's footprint, a cop, a stopped rider are on it too; a footprint keeps its room), else the walkers
      const meet = (px, pz, hd, vc, sep) => { const rx = px - x, rz = pz - z, along = rx * hx + rz * hz; if (along < -.5 || along > reach) return;
        const wvx = Math.sin(hd) * vc, wvz = Math.cos(hd) * vc, rel = v - (wvx * hx + wvz * hz), tA = along <= 0 ? 0 : rel > .05 ? along / rel : 99; if (tA > Wv.look) return;
        const lat = (rx + wvx * tA) * st.ax + (rz + wvz * tA) * st.az; if (Math.abs(lat - wv.off) < sep + .3) { CF[nC] = lat; CS[nC++] = sep; } };
      if (sim.grid?.n && typeof sim.near === 'function') { const B = sim.grid; sim.near(x + hx * reach * .5, z + hz * reach * .5, reach * .5 + .8, k => { if (nC >= 12) return; const o = B.w[k], b = B.b[k]; if (o && o === me.w) return;
          meet(B.x[k], B.z[k], b || !o ? 0 : o.p[3], b || !o ? 0 : o.vc || 0, b ? Wv.body + B.r[k] + .12 + (b.room ?? 0) : Wv.sep); }); }
      else { if (wgF !== fno) { walkerGrid(); wgF = fno; } const rr = Math.ceil((reach + 1) / 2), cx = Math.floor(x / 2), cz = Math.floor(z / 2);
        for (let a = -rr; a <= rr && nC < 12; a++) for (let b = -rr; b <= rr && nC < 12; b++) for (const w of WG.get((cx + a + 8192) * 16384 + (cz + b + 8192)) || []) { if (w === me.w || nC >= 12) continue; meet(w.p[0], w.p[2], w.p[3], w.vc || 0, Wv.sep); } }
      if (nC) { let best = null, bc = Infinity, bf = 0, bm = -1e9;
        const tryX = x0 => { if (x0 < lo - 1e-6 || x0 > hi + 1e-6) return; let m = Infinity; for (let k = 0; k < nC; k++) m = Math.min(m, Math.abs(x0 - CF[k]) - CS[k]); const cost = Math.abs(x0 - home) + .6 * Math.abs(x0 - wv.off);
          if (m >= -1e-6) { if (cost < bc) { bc = cost; best = x0; } } else if (m > bm) { bm = m; bf = x0; } };
        tryX(home); if (home) tryX(0); for (let k = 0; k < nC; k++) { tryX(CF[k] - CS[k]); tryX(CF[k] + CS[k]); } tryX(lo); tryX(hi); tg = best !== null ? best : bf; }
      // back on the path in time for the stretch's end
      const tBack = Math.abs(wv.off) / K.v + K.v / K.a + .2; if (Math.max(0, Math.min(st.dB, dEnd) - Wv.node) / Math.max(.3, v) < tBack) tg = 0; }
    tg = Math.max(lo, Math.min(hi, tg)); wv.lo = lo; wv.hi = hi; wv.tg = tg;
    const out = wv.off < lo - 1e-3 || wv.off > hi + 1e-3, vm = out ? K.v * 1.6 : K.v, vd = Math.max(-vm, Math.min(vm, (tg - wv.off) * 4)), ac = (out ? 2.5 : 1) * K.a * dt;
    wv.ov += Math.max(-ac, Math.min(ac, vd - wv.ov)); let n = wv.off + wv.ov * dt; if ((tg - wv.off) * (tg - n) < 0) { n = tg; wv.ov = 0; }
    if ((dEnd < .25 && Math.abs(n) < .05) || (Math.abs(n) < 1e-4 && !tg)) { n = 0; wv.ov = 0; }
    if (held) { n = wv.off; wv.ov = 0; }   // (crowd grid: held up and standing, it keeps its place across the walk — easing back to its path then walked it into whoever it had stepped round)
    wv.off = n; return wv; }
  // the mover, published for the crowd (pedsim.js): where it is drawn, and its path ahead offset as it is now
  function publish(R, me, x, z, yaw, v, fut) { const M = R.M ??= { w: null, x: 0, z: 0, hx: 0, hz: 1, v: 0, n: 0, ft: Float32Array.from(FT), fx: new Float32Array(FT.length * 2) };
    M.w = me.w || null; M.x = x; M.z = z; M.hx = Math.sin(yaw); M.hz = Math.cos(yaw); M.v = v; M.n = 0; const ox = R.wv ? R.wv.ax * R.wv.off : 0, oz = R.wv ? R.wv.az * R.wv.off : 0;
    for (let k = 0; k < FT.length; k++) { const p = fut(FT[k]); if (!p) break; M.fx[2 * k] = p[0] + ox; M.fx[2 * k + 1] = p[1] + oz; M.n = k + 1; } MOVERS.push(M); }

  // ── one agent's trip, frame by frame: what to draw → { show, x, y, z, yaw, vc, prop, mode, pose }
  const OUT = [0, 0, 0, 0];
  // a taxi's kerb point is on the cars' lane: the walk to it (and from it) stops on the sidewalk at the kerb, and the wait is there
  // (CAB TRAFFIC, 2026-10-10: it stopped 2.4 m short of the lane point, which on an avenue — the kerb 3 m from the lane — is 0.6 m out in
  // the road; now it stops KERB_IN m in from the kerb, on the walk's own line, or where the walk starts when that is nearer the road)
  const KERB_IN = .4, cut = (p, q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < .05) return p.slice(); for (let u = 0; u <= d; u += .05) { const x = q[0] + (p[0] - q[0]) * u / d, z = q[1] + (p[1] - q[1]) * u / d; if (kerbOut(x, z) >= KERB_IN) return [x, z]; } return p.slice(); };
  function kerbed(legs0) { const legs = legs0.map(l => ({ ...l }));
    legs.forEach((L, k) => { if (L.kind !== 'taxi') return; const w = legs[k - 1]?.kind === 'wait' ? legs[k - 1] : null, b = legs[w ? k - 2 : k - 1], n = legs[k + 1];
      if (b?.kind === 'walk' && b.path?.length >= 2) { const p = b.path.slice(); p[p.length - 1] = cut(p[p.length - 2], p[p.length - 1]); b.path = p; if (w) w.at = p[p.length - 1]; }
      if (n?.kind === 'walk' && n.path?.length >= 2) { const p = n.path.slice(); p[0] = cut(p[1], p[0]); n.path = p; } }); return legs; }
  // MOVEMENT REVIEW #4 · A CREW ON ONE TRIP. The sim books the very same legs for each member of a crew moving together, and each was drawn
  // purely from the legs' clock: one body (0.00 m apart over a whole walk, at the stop and through the door). Runs on the same trip (its mode,
  // ends and minutes) are a crew here, ranked by id: rank r walks r × crew.lag s behind on its own lateral slot (the weave's home: +lat, −lat
  // …). Rank 0, and anyone travelling alone, is drawn exactly as before. Eased in (crew.ease s per s), so a member whose run starts a frame
  // later doesn't jump.
  const CREW = new Map(), crewKey = t => t.mode + '|' + t.from + '|' + t.to + '|' + t.dep + '|' + t.arr;
  const crewRank = R => { const g = CREW.get(R.ck); if (!g || g.size < 2) return 0; let r = 0; for (const o of g) if (o !== R && o.aid < R.aid) r++; return r; };
  const crewFan = r => r ? (r % 2 ? 1 : -1) * Math.ceil(r / 2) : 0;   // (0, +1, −1, +2, −2 …)
  // MOVEMENT REVIEW #1: a trip whose last walk ends where travel.mjs left a long access stretch undrawn (leg.off[1] ≥ MOVE.offHide)
  const hidEnd = L => !!L && !L.coarse && (L.kind === 'walk' || L.kind === 'skate') && L.m > 0 && L.off?.[1] >= MOVE.offHide;
  // ── CROWD GRID · one frame of a leg's lag (MOVE.lag). u: the leg's progress (m along its path, or the skate plan's clock, s); m(u): metres
  // at u; uOf(cl): where its booking has it with cl s of lag (unclamped: a leg its booking has finished is still being walked); u0..u1: the
  // leg; pos(u): its point there ([x, , z, heading]). It looks along its path (with its weave's offset) from where it was drawn last frame for
  // the first body it would touch, closing in on it (one beside or behind it is not in its way); brakes to stop short of it; never falls
  // more than cap behind; catches up when clear; is put back on its booking unseen. → u this frame; R.cl (s), R.lv (m/s it went)
  const LG = [0, 0, 0, 0], LP = [0, 0, 0, 0], lagOn = L => MOVE.lag.on && pace <= MOVE.lag.maxPace && MOVE.avoid && !L.coarse && typeof sim.near === 'function';   // (pace: the movement clock over the natural pace, frame() below)
  function lagStep(R, me, a, L, dt, rate, m, uOf, u0, u1, pos, G0 = {}) {
    const C = MOVE.lag, clamp = u => Math.max(u0, Math.min(u1, u)); let cl = Math.min(R.cl || 0, C.cap);
    const k1 = uOf(0) - uOf(1), vB = k1 * Math.max(1e-6, (m(u1) - m(u0)) / Math.max(1e-9, u1 - u0)), cr = Math.min(L.kind === 'walk' ? C.catchWalk : C.catch, (L.kind === 'walk' ? C.catchVWalk : C.catchV) / Math.max(.1, vB));   // (catching up: at most catchV m/s over its booked pace)
    const uBook = clamp(uOf(0)), uTry = clamp(uOf(Math.max(0, cl - cr * dt))), uWas = R.lk === R.k && R.lu !== undefined ? clamp(R.lu) : clamp(uOf(cl));
    let uNew = uTry; const mWas = m(uWas), reach = Math.max(0, m(uTry) - mWas) + Math.max(.7, rate * (m(1) - m(0)) * .45);
    // the first body it would touch, from where it was on (sampled every step m along the path)
    const P0 = pos(uWas), x0 = P0[0], z0 = P0[2], hx = Math.sin(P0[3]), hz = Math.cos(P0[3]), ox = R.wv ? R.wv.ax * R.wv.off : 0, oz = R.wv ? R.wv.az * R.wv.off : 0, mine = me?.w || null;
    const sg = G0.segs?.[G0.k], road = !!sg?.E?.cross && (() => { const s = sg.s0 + (sg.s1 - sg.s0) * Math.max(0, Math.min(1, sg.len ? (m(uWas) - sg.c0) / sg.len : 0)), sIn = sg.s1 >= sg.s0 ? s : sg.E.len - s; return sIn > STEP + .3 && sg.E.len - sIn > 1; })();   // (on a zebra, out in the road)
    let hit = Infinity; const du = (u1 - u0) / Math.max(1e-6, m(u1) - m(u0)) * C.step;
    for (let u = uWas + du, n = 0; n < 40 && m(u) - mWas <= reach + 1e-6 && u <= u1 + 1e-9; u += du, n++) { const q = pos(u), x = q[0] + ox, z = q[2] + oz; let bad = false;
      sim.near(x, z, C.r + C.pad + .7, k => { if (bad) return; const B = sim.grid, o = B.w[k]; if (o && o === mine) return; if (o && !B.b[k] && !o.fix && (C.walkers === false || o.blk === mine || (sim.yields(o) && (B.x[k] - x0) * hx + (B.z[k] - z0) * hz > C.close))) return;   // (a walker that makes way: RIDERS AVOID steps it aside — unless it is close by now; one standing for this very rider is no wall for it)
        const bx = B.x[k], bz = B.z[k], b = B.b[k], rs = C.r + B.r[k] + C.pad + (b ? b.room ?? 0 : 0);
        if (road && !(o && (o.vc || 0) > .3 && (Math.sin(o.p[3]) * hx + Math.cos(o.p[3]) * hz) > .7)) return;   // (out in the road it goes on: only someone ahead going its way holds it up)
        const d = Math.hypot(bx - x, bz - z); if (d >= rs) return; const d0 = Math.hypot(bx - x0 - ox, bz - z0 - oz); if (d >= d0 - 1e-3) return;   // (not closing in on it)
        bad = true; });
      if (bad) { hit = u; break; } }
    if (hit < Infinity) { const room = Math.max(0, m(hit) - mWas - 2 * C.step), vA = Math.sqrt(2 * C.brake * room); uNew = Math.min(uTry, Math.max(uWas, clamp(uWas + (room > 0 ? Math.min(room, vA * dt) : 0) * du / C.step))); S2.lagHeld = (S2.lagHeld || 0) + 1; }
    const uCap = clamp(uOf(C.cap)); if (uNew < uCap - 1e-9) { uNew = uCap; S2.lagCapped = (S2.lagCapped || 0) + 1; }
    uNew = Math.max(uNew, Math.min(uWas, uBook));   // (never backward)
    // the lag this leaves: invert the booking (it is linear in the clock)
    cl = k1 > 1e-9 ? Math.max(0, Math.min(C.cap, (uOf(0) - uNew) / k1)) : 0;
    if (cl > 0 && TS?.seen) { const p = pos(uNew), px = p[0], pz = p[2]; if (!TS.seen(px, pz, 2)) { const q = pos(uBook); if (!TS.seen(q[0], q[2], 2)) { uNew = uBook; cl = 0; S2.lagSnaps = (S2.lagSnaps || 0) + 1; } } }   // (unseen where it is and where its booking has it: back on its booking)
    R.lv = dt > 0 && R.lk === R.k && R.lu !== undefined ? Math.abs(m(uNew) - mWas) / dt : null; R.cl = cl; R.lagS = cl; R.lu = uNew; R.lk = R.k; R.lend = u1; return uNew; }
  function run(a, trip) {
    const legs = kerbed(trip.legs), R = { trip, k: 0, delay: 0, phase: null, G: [], t0: null, lastNow: null, veh: null, busy: false, lead: null, end: null, aid: String(a.id), ck: crewKey(trip), rank: 0, lagS: 0, lag: 0, home: 0 };
    { let g = CREW.get(R.ck); if (!g) CREW.set(R.ck, g = new Set()); g.add(R); }   // (MOVEMENT REVIEW #4: its crew, if it has one)
    S.runs++; S.legs += legs.length;
    const pathEnd = k => { for (let j = k; j >= 0; j--) { if (legs[j].kind === 'bus') { const q = stopPt(legs[j].to); if (q) return q; } const p = legs[j].path; if (p?.length) return p[p.length - 1]; if (legs[j].at) return legs[j].at; } const p = legs.find(l => l.path?.length)?.path; return p ? p[0] : null; };   // (F12: off a legacy bus leg, its stop — not the end of the bus's road path)
    // (F12, audit 2026-10-08: the start of the next stretch on foot — but never past the next vehicle: off one vehicle to wait for the next
    // one, it walked to the trip's LAST walk, 285 m away, in 50 ms. Past a vehicle leg there is no such start: the stop is the place)
    // (crowd grid · walker jumps: where a leg's drawing ended — its geometry's end, on the lane — for whoever stands there after it: the trip's
    // end, a wait. The path's raw end is on the export's node line, 1.2 m off the lane on a 4 m walk)
    const drawnEnd = k => { for (let j = k; j >= 0; j--) { const G = R.G[j]; if (G?.len) { const P = at(G, G.len, [0, 0, 0, 0]); if (P) return [P[0], P[2]]; } if (legs[j].kind === 'bus' || legs[j].path?.length || legs[j].at) break; } return pathEnd(k); };
    const nextStart = k => { for (let j = k; j < legs.length; j++) { const L = legs[j]; if (L.kind === 'bus' || L.kind === 'taxi' || L.kind === 'subway') return null; const p = L.path; if (p?.length) return p[0]; } return null; };
    const draw = (x, y, z, yaw, vc = 0, o = {}) => { R.lastXZ = [x, z]; return { show: true, x, y, z, yaw, vc, ...o }; };
    function faceRoad(p, k) {   // a waiter faces where its ride comes from: the cab path's first stretch (a legacy bus leg's too), turned to the road
      const nx = legs.slice(k).find(l => l.path?.length > 1 && (l.kind === 'bus' || l.kind === 'taxi')); if (!nx) return null; const q = nx.path[0];
      return Math.atan2(q[0] - p[0], q[1] - p[1]); }
    // wait_stop leans out and looks down the street to its +x side, and hail_taxi's arm is the +x one: the waiter stands with its +x side
    // to where the cab comes from (back up its lane), which on the kerb faces it to the road
    function waitYaw(p, k) { const nx = legs.slice(k).find(l => l.path?.length > 1 && (l.kind === 'bus' || l.kind === 'taxi')); if (nx) { const P = nx.path, fx = P[1][0] - P[0][0], fz = P[1][1] - P[0][1]; if (Math.hypot(fx, fz) > .05) return Math.atan2(fz, -fx); }
      return faceRoad(p, k) ?? R.lastYaw ?? 0; }
    const crewEnd = G => { const P = at(G, G.len - Math.min(G.len * .5, R.rank * MOVE.crew.short), [0, 0, 0, 0]); return P ? [P[0], P[2]] : null; };   // (MOVEMENT REVIEW #4: where the last walk stopped a crew member short)
    const phase0 = (name, salt = '') => { const c = CLIPS.CLIP[name]; return c ? (hash(a.id + salt) % 997) / 997 * c.dur : 0; };   // (a loop's start: everyone out of step)
    R.busyNow = () => R.busy;
    R.frame = (now, dt, me) => {
      const dG = R.lastNow === null ? 0 : Math.max(0, now - R.lastNow); R.lastNow = now; R.busy = false;
      { const C = MOVE.crew, r = R.rank = crewRank(R), lagT = r * C.lag; R.lagS = R.fno === undefined ? lagT : R.lagS + Math.max(-C.ease * dt, Math.min(C.ease * dt, lagT - R.lagS)); R.lag = R.lagS / GAME_MIN; R.home = crewFan(r) && Math.sign(crewFan(r)) * C.lat; }   // (MOVEMENT REVIEW #4: the crew's lag, eased; its lateral slot)
      R.jump = R.fno === undefined || jumpF > R.fno; R.fno = fno;   // (MOVEMENT REVIEW #7: this run's first frame, or the movement clock jumped since its last — a seek, a page that joins)
      if (R.jump) { R.cl = 0; R.lu = undefined; }   // (the lag starts over on a jump: a seek forward kept the old place and was dragged up to 3 s behind)
      if (R.delay > 0 && R.phase === null) R.delay = Math.max(0, R.delay - dG * MOVE.catchUp);
      // TRANSIT SYNC · the cab is DISPATCHED MOVE.cabLead game min before the hail (it comes up the lane from cabBack m, as before), so it
      // pulls up a few seconds into the hail: dispatched at the hail it came 10-15 s late, behind a light, and the ride started late
      if (R.phase === null && !R.pre && fleet) { const j = legs.findIndex((l, i) => i >= R.k && l.kind === 'taxi'), w = legs[j - 1];
        if (j > 0 && w?.kind === 'wait' && legs[j].path?.length > 1 && !(legs[j].coarse && coarseId(legs[j].from)) && now - R.delay >= w.dep - MOVE.cabLead && now - R.delay < legs[j].arr) { const cab = cabFor(legs[j], legs[j + 1]); if (cab) { cab.rider = me; cab.leg0 = legs[j]; R.pre = cab; } else R.pre = -1; } }
      for (let guard = 0; guard < legs.length + 2; guard++) {
        const L = legs[R.k]; if (!L) { if (!R.done) { S.arrivals.push({ id: a.id, mode: trip.mode, dep: trip.dep, arr: trip.arr, at: +now.toFixed(2), drift: +R.delay.toFixed(2), seen: !!R.seen }); if (S.arrivals.length > 400) S.arrivals.shift(); }   // (TRANSIT TIMING: the arrival drift log — drift: game min after the sim's arr; seen: it rode a vehicle in the traffic)
          R.done = true; if (coarseId(trip.to) || hidEnd(legs[legs.length - 1])) return { show: false }; const Ge = R.rank && R.G[legs.length - 1], e = Ge && Ge.len ? crewEnd(Ge) : drawnEnd(legs.length - 1), wo = R.wv && R.wv.k === legs.length - 1 ? R.wv.off : 0; return e ? draw(e[0] + (wo ? R.wv.ax * wo : 0), SIDE, e[1] + (wo ? R.wv.az * wo : 0), R.lastYaw ?? 0) : { show: false }; }   // (crowd grid: where its weave left it, if it ended held up beside its path)   // (MOVEMENT REVIEW #1: in at the labs, the jail, the woods — off the walkers' graph — out of view)
        const onLeg = L.kind === 'walk' || L.kind === 'skate' || L.kind === 'bike' || L.kind === 'scooter'; if (!onLeg && R.cl) R.cl = 0;   // (crowd grid: the lag is walked off, or a wait absorbs it)
        if (onLeg && R.cl && !lagOn(L)) R.cl = Math.max(0, R.cl - dt * Math.max(1, pace) * MOVE.lag.catchWalk);   // (the lag off — faster than walking pace — mid-hold: walked off, no jump)
        const tt0 = now - R.delay - R.lag, tt = tt0 - (onLeg ? (R.cl || 0) / GAME_MIN : 0), dur = Math.max(1e-3, L.arr - L.dep);
        // ── on foot or on wheels
        if (L.kind === 'walk' || L.kind === 'skate' || L.kind === 'bike' || L.kind === 'scooter') {
          if (tt >= L.arr && !(lagOn(L) && R.lk === R.k && R.lu < R.lend - 1e-3)) { R.k++; continue; }   // (crowd grid: a leg held up ends where it is drawn to its end, not where its clock is)
          if (!L.path || L.path.length < 2) { R.k++; continue; }
          let G = R.G[R.k]; if (!G) { const p = L.path.slice(); if (R.lead && R.k === R.lead.k) { if (L.off?.[0] > 0) p.unshift(R.lead.p); else p[0] = R.lead.p; }   // (MOVEMENT REVIEW #1: a path that starts on the sidewalk — its id's stretch undrawn — is walked to from the spot, not cut short of it)
            // TRANSIT SYNC · a walk into a station's stairs ends where the flight's own walk-in starts, and one out of them starts where the flight
            // leaves the walker (subway/index.js flight(), the block's anchors): the export's station point is 2.3–6 m off it (a jump at every station)
            const nx = legs[R.k + 1], pv = legs[R.k - 1];
            if (UNDER.hook && nx?.kind === 'stairs' && nx.dir !== 'up') { const d = UNDER.hook(nx, nx.dep, legs, a); if (d?.show !== false && d && Number.isFinite(d.x)) p[p.length - 1] = [d.x, d.z]; }
            if (UNDER.hook && pv?.kind === 'stairs' && pv.dir === 'up') { const d = UNDER.hook(pv, pv.arr - 1e-4, legs, a); if (d?.show !== false && d && Number.isFinite(d.x)) p[0] = [d.x, d.z]; }
            G = R.G[R.k] = geomOf(p); if (MOVE.avoid && MOVE.band.on && MOVE.ride[L.kind] && !L.coarse) rideGeom(G); if (MOVE.avoid && MOVE.zebra.on && !L.coarse) G.zl = true; }   // (crowd hold: a ride leg's own line on a wider walk)
          // MOVEMENT REVIEW #1 · the access stretch travel.mjs left undrawn (leg.off: [start, end] booked m): a long one (≥ MOVE.offHide: the labs,
          // the jail, the woods) is that much of the leg's time out of view, the drawn path walked at the booked pace; a short one (a corner's,
          // a block's middle) is walked into the drawn path (a little slower). W0 / W1: the drawn part's window (game min)
          const ow = !L.coarse && L.off && L.m > 0 ? L.off : null, h0 = ow && ow[0] >= MOVE.offHide && !(R.lead && R.lead.k === R.k) ? ow[0] : 0, h1 = ow && ow[1] >= MOVE.offHide ? ow[1] : 0;
          const W0 = L.dep + dur * h0 / (ow ? L.m : 1), W1 = L.arr - dur * h1 / (ow ? L.m : 1), dW = Math.max(1e-3, W1 - W0);
          if ((h0 && tt < W0) || (h1 && tt >= W1)) return { show: false, mode: L.kind };
          let f = Math.max(0, Math.min(1, (tt - W0) / dW)), v = G.len / (dW * GAME_MIN) * (R.delay > 0 ? 1 + MOVE.catchUp : 1);
          // (a late cab's lateness is walked off at 1.6×: never a jump)
          const sh = R.rank && R.k === legs.length - 1 && !L.coarse ? Math.min(G.len * .5, R.rank * MOVE.crew.short) : 0; if (sh) f *= (G.len - sh) / G.len;   // (MOVEMENT REVIEW #4: the trip's last walk, a crew member stops rank × short m behind the end — in a queue, not in one body — and steps off from there)
          let vNow = null;   // (crowd grid: the speed it really goes this frame, its lag changing)
          if (lagOn(L) && L.kind !== 'skate' && f > 0 && (f < 1 || (R.lk === R.k && R.lu < R.lend - 1e-3))) { const crew = sh ? (G.len - sh) / G.len : 1, M = G.len * crew;
            const r = lagStep(R, me, a, L, dt, G.len / (dW * GAME_MIN) * crew, d => d, cl => (tt0 - cl / GAME_MIN - W0) / dW * M, 0, M, d => at(G, d, LG), G);
            f = r / G.len; vNow = R.lv; }
          if (L.coarse) {   // (rule 5, lens.js cutLeg: a leg to or from someone else's lot keeps only its public stretch — walked at the mode's own pace, out of view beyond it)
            v = SPEED[L.kind] || 1.5; const d = coarseId(L.to) ? (tt - L.dep) * GAME_MIN * v : G.len - (L.arr - tt) * GAME_MIN * v; if (d < 0 || d > G.len) return { show: false, mode: L.kind }; f = G.len ? d / G.len : 0; }
          const rd = MOVE.ride[L.kind];
          if (L.kind === 'skate' && SKC.skate_ride && !L.coarse && G.len > 1) {   // (SKATE: the plan — push, ride, kickturns at the corners, an ollie now and then)
            const T = dW * GAME_MIN, pl = G.plan ??= skatePlan(G, T, a.id + ':' + L.dep); let tau = (tt - W0) * GAME_MIN;
            if (lagOn(L) && tau > 0 && (tau < pl.T || (R.lk === R.k && R.lu < R.lend - 1e-3))) tau = lagStep(R, me, a, L, dt, 1, u => u * pl.v, cl => (tt0 - W0) * GAME_MIN - cl, 0, pl.T, u => { const q = skateAt(G, pl, u); LG[0] = q.x; LG[2] = q.z; LG[3] = q.yaw; return LG; }, G);   // (crowd grid: its plan's clock held back)
            const o = skateAt(G, pl, tau);
            if (!MOVE.avoid) { R.lastYaw = o.yaw; return draw(o.x, o.y + BOARD.deck, o.z, o.yaw, o.moving ? pl.v : 0, { base: o.y, mode: 'skate', prop: 'board', clip: o.clip, clipT: o.clipT, snap: o.snap, stand: true, cad: 0 }); }
            // riders avoid: the weave on the plan's path pieces (a line or a kick stays on its geometry: the weave is back to 0 by then)
            const bx = o.x, by = o.y, bz = o.z, byaw = o.yaw, mv = o.moving, clip = o.clip, clipT = o.clipT, snap = o.snap, p = pl.pieces.find(q => tau < q.t1) || pl.pieces[pl.pieces.length - 1];
            const dP = p.kind === 'path' ? p.d0 + (p.d1 - p.d0) * Math.max(0, Math.min(1, (tau - p.t0) / Math.max(1e-6, p.t1 - p.t0))) : null, vS = mv && p.kind !== 'kick' ? (lagOn(L) ? Math.min(pl.v * 1.5, R.lv ?? pl.v) : pl.v) : 0;
            if (dP !== null) at(G, dP, SKP);   // (the cursor on the segment it is on)
            const wv = weave(R, G, me, 'skate', bx, bz, byaw, vS, dP, dP !== null ? Math.min(p.d1 - dP, G.len - dP) : 0, dt), x = bx + wv.ax * wv.off, z = bz + wv.az * wv.off;
            const yaw = wv.off || wv.ov ? Math.atan2(Math.sin(byaw) * Math.max(vS, .5) + wv.ax * wv.ov * MOVE.weave.yaw, Math.cos(byaw) * Math.max(vS, .5) + wv.az * wv.ov * MOVE.weave.yaw) : byaw;
            if (mv && p.kind !== 'kick') { const kv = pl.v > 0 ? Math.min(1.5, vS / pl.v) : 1; publish(R, me, x, z, byaw, vS, t => { const q = skateAt(G, pl, Math.min(pl.T, tau + t * kv)); return [q.x, q.z]; }); }   // (crowd grid: a skater held up is still in the corner it is waiting at — published, the walkers wait outside it)
            R.lastYaw = yaw;
            return draw(x, by + BOARD.deck, z, yaw, mv ? (vS || 0) : 0, { base: by, bx, bz, mode: 'skate', prop: 'board', clip, clipT, snap, stand: true, cad: 0 }); }
          const P = at(G, f * G.len, OUT); if (!P) { R.k++; continue; }
          if (vNow !== null) v = vNow;   // (crowd grid: braking behind someone, or catching up)
          const moving = f > 0 && f < 1;
          // the clip's clock is the leg's own: a ride clip (bike_pedal, scooter_ride) and a hurt walk (walk_hurt: a leg or trip marked
          // `hurt`) are standing-leg clips that travel, so their clock runs at dt × v / the clip's speed — the cranks, the wheels and
          // the limp's planted feet keep up with the speed the leg really goes. Each leg starts at its own phase (riders out of step)
          const hurt = !rd && (L.hurt || trip.hurt) && CLIPS.CLIP.walk_hurt ? 'walk_hurt' : null, cn = rd?.seat !== undefined ? rd.clip : hurt, cc = cn ? CLIPS.CLIP[cn] : null, RC = R.rc ??= {};
          if (cc) { if (RC[R.k] === undefined) RC[R.k] = phase0(cn, ':' + R.k); if (moving) RC[R.k] += dt * v / (cc.speed || v || 1); }
          let x = P[0], z = P[2], yaw = P[3];
          if (MOVE.avoid && moving) {   // riders avoid: the weave, and the mover published for the crowd
            const d = f * G.len, wv = weave(R, G, me, L.kind, P[0], P[2], P[3], v, L.coarse ? null : d, G.len - d, dt), b0 = P[0], b2 = P[2], b3 = P[3]; x = b0 + wv.ax * wv.off; z = b2 + wv.az * wv.off;
            if (wv.off || wv.ov) yaw = Math.atan2(Math.sin(b3) * v + wv.ax * wv.ov * MOVE.weave.yaw, Math.cos(b3) * v + wv.az * wv.ov * MOVE.weave.yaw);
            publish(R, me, x, z, b3, v, t => { const q = at(G, Math.min(G.len, d + v * t), FP); return q ? [q[0], q[2]] : null; }); at(G, d, FP); P[0] = b0; P[2] = b2; }
          R.lastYaw = yaw;
          return draw(x, P[1] + (rd ? (cc ? rd.seat : rd.lift) : 0), z, yaw, moving ? v : 0, { base: P[1], bx: P[0], bz: P[2], mode: L.kind, prop: rd ? rd.prop : null, clip: (rd || hurt) && moving ? cn || rd.clip : null,
            clipT: cc ? RC[R.k] : undefined, scheme: rd && cc ? L.scheme ?? L.item?.scheme ?? trip.item?.scheme ?? null : null, stand: !!rd?.stand || !!(hurt && moving), cad: rd ? Math.min(2.2, v / 2.4) : 0 }); }
        // ── waiting (a stop, the kerb, a platform) and the vehicles
        if (L.kind === 'wait') { const nx = legs[R.k + 1], into = legs.slice(R.k + 1).find(l => l.kind !== 'wait');
          if (into?.kind === 'subway' || legs.slice(0, R.k).some(l => l.kind === 'stairs' || l.kind === 'subway') && into?.kind !== 'bus' && into?.kind !== 'taxi') { if (tt >= L.arr) { R.k++; continue; } return under(L); }   // (a platform: W3b's)
          if (into?.kind === 'taxi') return vehicle(into, legs.indexOf(into), now, dt, me);
          if (tt >= L.arr) { R.k++; continue; } const p = L.at || drawnEnd(R.k - 1); return p ? draw(p[0], SIDE, p[1], R.lastYaw ?? 0, 0, { clip: 'wait_stop', clipStart: phase0('wait_stop'), stand: true }) : { show: false }; }
        if (L.kind === 'taxi') return vehicle(L, R.k, now, dt, me);
        if (L.kind === 'bus') { if (tt >= L.arr) { R.k++; continue; } R.busy = true; return { show: false, mode: 'bus' }; }   // (a legacy recording's bus leg: ridden out of view)
        if (L.kind === 'stairs' || L.kind === 'subway') { if (tt >= L.arr) { R.k++; continue; } return under(L); }
        R.k++; }   // (an unknown kind: skipped)
      return { show: false }; };
    function under(L) { R.busy = true; return UNDER.hook?.(L, R.lastNow - R.delay - R.lag, legs, a) || { show: false, mode: 'subway' }; }   // (MOVEMENT W3b: subway/index.js draws the stairs and opens the carriage through UNDER.hook)
    // the cab leg L (index k), from its wait to getting off
    // (rule 5, lens.js cutLeg · audit F05: a cab FROM someone else's lot — its kerb, its wait and the start of its path are cut — rides
    // out of view, the rider not drawn before it: no stop to stand at, and the fallback below would be a later leg's start)
    function vehicle(L, k, now, dt, me) {
      const hid = !!L.coarse && coarseId(L.from);
      R.busy = R.phase !== null; const wait = legs[k - 1]?.kind === 'wait' ? legs[k - 1] : null, tt = now - R.delay - R.lag, stopP = hid ? null : (wait && (wait.at || stopPt(wait.from) || pathEnd(k - 2))) || pathEnd(k - 1) || L.path?.[0];   // (F12: a wait with no point of its own — a change at a stop — is at the stop, not where the bus path before it ended)
      const ok = initTransit(), finish = () => { const late = now - L.arr; if (R.veh?.c) { R.seen = true; S.vlegs.push({ id: me.id, kind: L.kind, line: L.line || null, dep: L.dep, arr: L.arr, late: +late.toFixed(2) }); if (S.vlegs.length > 400) S.vlegs.shift(); } R.delay = Math.max(late, -(L.arr - L.dep) * .5); R.cabLate = R.delay > 0; if (late > .2) S.late++; R.phase = null; R.veh = null; R.k = k + 1; R.busy = false; proxyOff(me); };
      if (!ok || !L.path || L.path.length < 2 || hid) {   // (no traffic or no route: out of view for the ride, back at its end)
        if (tt >= L.arr) { finish(); R.delay = 0; return R.frame(now, 0, me); } if (tt < L.dep) return stopP ? draw(stopP[0], SIDE, stopP[1], waitYaw(stopP, k), 0, { clip: 'wait_stop', clipStart: phase0('wait_stop'), stand: true }) : { show: false };
        S.fallbacks++; R.busy = true; return { show: false, mode: L.kind }; }
      // ── the taxi (CAB TRAFFIC: the cab is a car of the traffic — due at rest at the kerb at P.tPick, off at the booked departure or as soon
      // as the rider is in, at rest at the drop when the traffic lets it; the rider's own steps follow it: in when it is there, out when it is
      // at the drop, on the kerb at the booked arrival when it is on time — late by its lateness when it isn't (R.delay))
      // (a ride already over by its booking — a run that starts, or a page that loads, after it — gets no cab: one planned then came into
      // the street at its drop and stood there, nobody to get out, until CAB.relMax; two riders' on one kerb stood in each other: 685
      // frames at Blackpine. The rider is past it)
      if (R.phase === null && tt >= L.arr) { if (R.pre && R.pre !== -1 && R.pre.leg0 === L) { R.pre.rider = null; R.pre.empty = true; } L.path = null; return vehicle(L, k, now, dt, me); }
      if (R.phase === null) { R.phase = 'wait'; const cab = R.pre && R.pre !== -1 && R.pre.leg0 === L ? R.pre : cabFor(L, legs[k + 1]); if (!cab) { L.path = null; R.phase = null; return vehicle(L, k, now, dt, me); } R.veh = cab; cab.rider = me; }
      const cab = R.veh, P = cab.P, tR = now * GAME_MIN, c = cab.c && !cab.c.gone ? cab.c : null, F0 = c && carFrame(c);
      // (CAB TRAFFIC: the door on the KERB side — the side the rider waits on, or walks off to: a cab standing in a one-way's lane with the
      // kerb on its left, JAY ST's stand, was boarded from the road)
      const kp = R.phase === 'ride' || R.phase === 'getout' ? (R.to || nextStart(k + 1)) : stopP, ks = F0 && kp ? Math.sign((kp[0] - c.x) * F0.rx + (kp[1] - c.z) * F0.rz) || 1 : 1;
      const F = F0 && (ks > 0 ? F0 : { ...F0, rx: -F0.rx, rz: -F0.rz }), side = c && [c.x + F.rx * (c.wid / 2 + .45) - F.fx * .3, c.z + F.rz * (c.wid / 2 + .45) - F.fz * .3];
      // the kerb: wait_stop until the hail's time, then hail_taxi (1.1 s, held: the arm stays up, a wave every 1.3 s) on the movement's
      // clock — on its end frame the walker steps on by its shift (0.3 m, to the kerb's edge) — until the cab stands at the kerb
      const hailDep = wait ? wait.dep : L.dep, yawW = waitYaw(stopP, k), fw = [Math.sin(yawW), Math.cos(yawW)];
      const hailT = Math.max(0, (tt - hailDep) * GAME_MIN), hc = CLIPS.CLIP.hail_taxi, hs = hc && hailT >= hc.dur ? hc.shift[1] : 0, kerb = [stopP[0] + fw[0] * hs, stopP[1] + fw[1] * hs];
      // CAB FOLLOW-UP (2026-10-10) · NO GIVE-UP JUMP. A cab far behind its booking — a jam — no longer ends with the rider put on at once (a
      // teleport). The rider leaves it where it is and WALKS the rest, on the walkers' graph from there to where the trip ends (travel.mjs, a
      // walk from that point), the later legs replaced: their arrival stays late, nothing jumps. walkFrom(from, dep) → the new legs (from: [x, z])
      const walkPlan = (from, dep) => { TV ??= createTravel(W); const last = legs[legs.length - 1], dest = last.path?.at(-1) || pathEnd(legs.length - 1); if (!dest) return null;
        const tr = TV.trip(from, dest, 'walk', { dep }); return tr?.legs?.length && tr.legs[0].path?.length > 1 ? tr.legs : null; };
      const walkOn = nl => { cab.bailed = true; legs.splice(k + 1, legs.length - k - 1, ...nl); R.G.length = Math.min(R.G.length, k + 1); S.bails = (S.bails || 0) + 1; return nl; };
      const walkFrom = (from, dep) => { const nl = walkPlan(from, dep); return nl ? walkOn(nl) : null; };
      if (R.phase === 'wait' && !fleet.cabs.atKerb(cab) && !cab.picked && tt > L.dep + MOVE.cabWait / GAME_MIN && (R.lastXZ || stopP)) {   // (its cab never came: on foot from the kerb, now)
        const nl = walkFrom(R.lastXZ || stopP, tt); if (nl) { cab.rider = null; cab.empty = true; R.phase = null; R.veh = null; R.pre = null; R.k = k + 1; R.busy = false; proxyOff(me); return R.frame(now, 0, me); } }
      if (R.phase === 'wait') { if (fleet.cabs.atKerb(cab) && tR >= P.tPick - .05) { R.phase = 'getin'; R.pt = 0; R.from = kerb; cab.boarding = true; }
        else if (cab.picked || (!c && tt >= L.arr)) { R.phase = 'ride'; cab.inside = true; }   // (came in after the cab left — a page that joins mid-ride, a seek: it is in the cab, which comes into the street where the ride has it; or a cab that never could come in: on at the booked arrival)
        else return tt >= hailDep ? draw(kerb[0], SIDE, kerb[1], yawW, 0, { clip: 'hail_taxi', clipT: hailT, stand: true }) : draw(stopP[0], SIDE, stopP[1], yawW, 0, { clip: 'wait_stop', clipStart: phase0('wait_stop'), stand: true }); }
      R.busy = true;
      // in: a few steps to the rear door (walking), then car_get_in facing the door (1.3 s, held low: then the walker is hidden — the cab is
      // drawn), done by the booked departure (the steps are hurried when the cab came late to the kerb)
      const gin = CLIPS.CLIP.car_get_in, gout = CLIPS.CLIP.car_get_out;
      if (R.phase === 'getin') { if (!c) { R.phase = 'ride'; return { show: false, mode: 'taxi' }; } R.pt += dt; const inYaw = Math.atan2(-F.rx, -F.rz), d = Math.hypot(side[0] - R.from[0], side[1] - R.from[1]), room = Math.max(.6, P.tDep - P.tPick - (gin ? gin.dur : 0)), tw = Math.max(.25, Math.min(d / 1.5, room)), w = Math.min(1, R.pt / tw);
        if (R.pt < tw) return draw(lerp(R.from[0], side[0], w), SIDE * (1 - w), lerp(R.from[1], side[1], w), Math.atan2(side[0] - R.from[0], side[1] - R.from[1]), d / tw, { mode: 'taxi' });
        const ct = R.pt - tw; if (!gin || ct >= gin.dur) { cab.inside = true; R.phase = 'ride'; proxyOn(me, c, .7); return { show: false, mode: 'taxi' }; }
        return draw(side[0], 0, side[1], inYaw, 0, { mode: 'taxi', clip: 'car_get_in', clipT: ct, snap: true, stand: true }); }
      if (R.phase === 'ride') { if (c && !PX.has(me.id) && camOn(me.id)) proxyOn(me, c, .7);
        // (rule 5 · audit F05: a cab TO someone else's lot drops where its public path ends, at the lot's zone: the rider stays in, out
        // of view, to the booked arrival, and the cab is let go from there — nobody gets out where the agent never was)
        if (L.coarse && coarseId(L.to) && fleet.cabs.atDrop(cab)) { if (tt < L.arr) return { show: false, mode: 'taxi', ride: c }; cab.rider = null; cab.out = true; finish(); return R.frame(now, 0, me); }
        // (a cab at its drop before the booking's out second — the traffic was kind — stands there, the rider paying inside, and the rider
        // starts out at P.tOut, on the kerb on the booked second; a late one lets them out at once, the lateness R.delay)
        if (tR >= P.tOut - .02 && fleet.cabs.atDrop(cab)) { cab.alighting = true; R.phase = 'getout'; R.pt = 0; R.tg = tR; R.to = nextStart(k + 1) || [side[0], side[1]]; R.door = side.slice(); R.outYaw = Math.atan2(F.rx, F.rz); R.rx = [F.rx, F.rz]; R.outEnd = Math.max(P.tArr - tR, P.out); }
        // (far past the booking, the cab at rest in a lane: the rider pays, gets out there — on the side the walk on starts — and walks the rest)
        else if (c && tt > L.arr + MOVE.cabBail / GAME_MIN && c.v < .3 && !c.kin && c.L?.kind === 'lane' && (R.bailPlan = walkPlan([c.x, c.z], L.arr))
          && (tt > L.arr + MOVE.cabGiveUp / GAME_MIN || R.bailPlan.reduce((m, l) => m + (l.m || 0), 0) / (SPEED.walk * (1 + MOVE.catchUp)) < fleet.cabs.eta(cab)) && fleet.cabs.bail(cab)) { const nl = walkOn(R.bailPlan), p1 = nl[0].path[1];
          const sg = Math.sign((p1[0] - c.x) * F0.rx + (p1[1] - c.z) * F0.rz) || 1, rx = F0.rx * sg, rz = F0.rz * sg, door = [c.x + rx * (c.wid / 2 + .45) - F0.fx * .3, c.z + rz * (c.wid / 2 + .45) - F0.fz * .3];
          nl[0].path = [door, ...nl[0].path.slice(1)]; R.bailing = true; R.phase = 'getout'; R.pt = 0; R.tg = tR; R.to = door; R.door = door; R.outYaw = Math.atan2(rx, rz); R.rx = [rx, rz]; R.outEnd = P.out; }
        // (no cab in the street — it never could come in — or one given up: on foot from where the rider was last, now)
        else if ((tt >= L.arr + 2 && !c) || cab.done) { const from = c ? [c.x, c.z] : R.lastXZ; const nl = from && walkFrom(from, tt); cab.rider = null; cab.empty = true; if (nl) { R.phase = null; R.veh = null; R.k = k + 1; R.busy = false; proxyOff(me); } else finish(); return R.frame(now, 0, me); }   // (or its cab given up — traffic/cabs.js, held 3 × CAB.relMax past the booking: on at once)   // (no cab drawn — it never came into view: on at the booked arrival, and the cab with it: it never comes in for nobody)
        else return { show: false, mode: 'taxi', ride: c }; }
      // out: the walker appears low in the door (car_get_out, snapped in), rises out by the clip's shift (0.6 m), then walks up to the kerb —
      // on it at the booked arrival (the steps fill the time the booking left for them, TAXI_DRIVE.out)
      if (R.phase === 'getout') { R.pt = Math.max(R.pt, tR - R.tg); const D = R.door, sh = gout ? gout.shift[1] : 0, cd = gout ? Math.min(gout.dur, Math.max(.4, R.outEnd - .4)) : 0, din = [D[0] - R.rx[0] * sh, D[1] - R.rx[1] * sh];
        if (R.pt > .3 && PX.has(me.id)) proxyOff(me);
        if (R.pt < cd) return draw(din[0], 0, din[1], R.outYaw, 0, { mode: 'taxi', clip: 'car_get_out', clipT: R.pt * (gout ? gout.dur / cd : 1), snapClip: true, snap: true, stand: true });
        cab.out = true; const d = Math.hypot(R.to[0] - D[0], R.to[1] - D[1]), tw = Math.max(.25, Math.min(d / .8, Math.max(d / 2.6, R.outEnd - cd))), w = Math.min(1, (R.pt - cd) / tw);
        if (w >= 1 && tR < P.tArr - .05 && !R.bailing) return draw(R.to[0], SIDE, R.to[1], Math.atan2(R.to[0] - D[0], R.to[1] - D[1]), 0, { mode: 'walk', stand: true });   // (on the kerb before the booked arrival: it stands there till then — the walk on starts on the booked second)
        if (w >= 1) { cab.rider = null; finish(); return draw(R.to[0], SIDE, R.to[1], Math.atan2(R.to[0] - D[0], R.to[1] - D[1]), 0, { mode: 'walk' }); }
        return draw(lerp(D[0], R.to[0], w), SIDE * w, lerp(D[1], R.to[1], w), Math.atan2(R.to[0] - D[0], R.to[1] - D[1]), d / tw, { mode: 'taxi' }); }
      return { show: false }; }
    // (TAXI CLOCK · F10: a released rider leaves no cab behind — the cab has no rider; one that hadn't picked them up drives on as traffic,
    // one they rode in finishes its clock to the drop and is released there, as every cab is: no cab outlives its clock)
    // (MOVEMENT REVIEW #3: on a seek — jump: agents.js endRun — the cab is cancelled outright, the rider in it or not: traffic/cabs.js cancel)
    R.release = (me, jump = false) => { const cg = CREW.get(R.ck); if (cg) { cg.delete(R); if (!cg.size) CREW.delete(R.ck); }   // (MOVEMENT REVIEW #4)
      for (const v of [R.pre, R.veh]) { if (!v || v === -1) continue; if (v.P) { if (v.rider === me) v.rider = null; if (jump && !v.rider && fleet?.cabs) fleet.cabs.cancel(v); else if (!v.inside) v.empty = true; } } R.pre = null; proxyOff(me); };
    R.leadFrom = (k, p) => { R.lead = { k, p }; R.G[k] = null; };
    return R; }

  // ── the props (CLIPS.md § Props): one InstancedMesh per prop geometry, posed each frame by the playing clip's clock. Three kinds:
  //   board   the skate group's own model (skate-board.js boardGeometry): its world matrix = the walker's (ground point, yaw) × prop.matrix(t)
  //   ride    the bike and the e-scooter (ride-props.js, through ride.js's prop): one InstancedMesh per PART geometry (the frame, the
  //           wheels — two instances an item —, the crank, the pedals, the stand), the frame one per colourway in use (it carries the
  //           item's main colour; the other parts are the city's neutrals). Each part's world = the walker × Rz(turnRoll) × its matrix
  //           from prop.partMatrices(t): the roll walk2.js gives the whole body in a corner (−0.09 · ω · v, up to 0.3 rad at 5.5 m/s),
  //           so the rider never leans off the bike. The colour: the leg's (or the trip's) `scheme` when the sim names the bike or the
  //           scooter (ride-props.js SCHEMES: red, cobalt, yellow, lime, pink, cyan, or { main: 0x… }), else the item's default
  //   clip    any other clip's prop, shown while that clip's weight is ≥ PROP_SHOW: the work tools (work-tools.js through work.js;
  //           carry_box's box rides the chest, so its matrix gets the gait state; stock_shelf's item collapses itself between the shelf
  //           and the next grab) and THE PISTOL (gun-prop.js through the aim clips): the stage's — nothing here plays an aim clip; the
  //           stage calls clipProp(w, g) from its own gait hook after stepClip and the gun is drawn like a tool (prop.muzzle(t) is its
  //           flash point, body frame)
  // Board and ride: queued for every rider (mid and far walkers too, on the movement's clock) and flushed once a frame; a NEAR walker's
  // are redone in the gait hook below, after the walk turned it this frame, so the deck and the bike never lag the body. Clip props: near
  // walkers only (only they play clips), written straight from the gait hook (flushProps, which runs before the hooks, empties them).
  // Without the ride clips the bike and the scooter keep the old placeholder boxes.
  // (MOVEMENT REVIEW #8: a prop mesh starts at CAP instances and is made again at twice its size when full, up to PROP_MAX — it capped
  // the riders at 48 a kind, and the bikes at 24: two wheels each. Past PROP_MAX a kind's queue keeps the riders nearest the camera)
  const PROPS = {}, CAP = 48, PROP_MAX = 1024, PROP_SHOW = .6, TURN_LEAN = .09, DIRECT = new Set();   // (TURN_LEAN: peds.js's, the walkers' uB2.x)
  const M4 = new THREE.Matrix4(), PM4 = new THREE.Matrix4(), RM4 = new THREE.Matrix4(), WM4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  const RIDE = { bike: CLIPS.CLIP.bike_pedal?.prop?.partMatrices ? CLIPS.CLIP.bike_pedal.prop : null, scooter: CLIPS.CLIP.scooter_ride?.prop?.partMatrices ? CLIPS.CLIP.scooter_ride.prop : null };
  const rideProp = (kind, clip) => { const P = clip && CLIPS.CLIP[clip]?.prop; return P?.partMatrices && P.item === kind ? P : RIDE[kind]; };   // (the playing clip's: pedal → coast keeps the cranks right)
  const turnRoll = g => g ? Math.max(-.3, Math.min(.3, -TURN_LEAN * (g.omega || 0) * (g.v || 0))) : 0;   // (walk2.js P.turnRoll)
  function propGeo(kind) { if (kind === 'board') return boardGeometry(THREE);
    const parts = [], box = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z), n = g.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color(c);
      for (let k = 0; k < n; k++) cc.toArray(col, k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); };
    if (kind === 'scooter') { box(.14, .04, .62, 0, .09, 0, 0x22252b); box(.04, .9, .04, 0, .55, .3, 0x9aa0a8); box(.46, .035, .035, 0, 1.0, .3, 0x22252b); for (const z of [-.3, .32]) box(.04, .14, .14, 0, .07, z, 0x1a1a1e); box(.13, .02, .5, 0, .115, -.02, 0x2f5bff); }
    else { for (const z of [-.5, .5]) { box(.05, .62, .62, 0, .31, z, 0x1a1a1e); box(.06, .14, .14, 0, .31, z, 0xc9ced6); } box(.05, .05, .95, 0, .52, 0, 0x25b84c); box(.05, .45, .05, 0, .55, -.12, 0x25b84c); box(.05, .05, .6, 0, .78, .05, 0x25b84c); box(.2, .05, .26, 0, .82, -.14, 0x1a1a1e); box(.05, .35, .05, 0, .72, .4, 0x9aa0a8); box(.5, .04, .04, 0, .9, .4, 0x22252b); }
    const g = mergeParts(parts); parts.forEach(p => p.dispose()); return g; }
  function mergeParts(parts) { const P = [], N = [], C = [], I = []; let o = 0; for (const g of parts) { const p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array; for (let k = 0; k < p.length; k++) { P.push(p[k]); N.push(n[k]); C.push(c[k]); } for (const i of g.index.array) I.push(i + o); o += p.length / 3; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g; }
  let scene = null, pframe = 0; const queued = { board: [], bike: [], scooter: [] }, MATS = new Map();
  const mat = r => { if (!MATS.has(r)) MATS.set(r, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r })); return MATS.get(r); };
  function meshOf(key, geo, rough = .7) { if (PROPS[key] || !scene) return PROPS[key]; const m = new THREE.InstancedMesh(geo(), mat(rough), CAP); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.name = 'movement:' + key; scene.add(m); return PROPS[key] = m; }
  const capOf = m => m.instanceMatrix.count;
  // the mesh under key with room for n instances: made again at twice the size (the same geometry and material, the instances so far copied)
  function room(key, n) { const m = PROPS[key]; if (!m || n <= capOf(m)) return m; if (capOf(m) >= PROP_MAX) return m;
    let c = capOf(m); while (c < n && c < PROP_MAX) c *= 2; c = Math.min(c, PROP_MAX); const g = new THREE.InstancedMesh(m.geometry, m.material, c);
    g.instanceMatrix.array.set(m.instanceMatrix.array); g.count = m.count; g.frustumCulled = m.frustumCulled; g.castShadow = m.castShadow; g.name = m.name; g.instanceMatrix.needsUpdate = true;
    (m.parent || scene)?.add(g); m.parent?.remove(m); m.dispose(); S2.propGrow = (S2.propGrow || 0) + 1; return PROPS[key] = g; }
  const take = key => { const m = room(key, (PROPS[key]?.count ?? 0) + 1); return m && m.count < capOf(m) ? m.count++ : -1; };
  const propMesh = kind => meshOf(kind, () => propGeo(kind), kind === 'board' ? .55 : .7);
  const schemeKey = s => s == null ? '' : typeof s === 'object' ? JSON.stringify(s) : String(s);
  const partMesh = (P, part, scheme) => { const sk = part === 'frame' ? schemeKey(scheme) : ''; return meshOf(`${P.item}:${part}${sk ? ':' + sk : ''}`, () => P.partGeometry(THREE, part, sk ? scheme : undefined)); };
  function prop(kind, x, y, z, yaw, w = null, o = null) { const q = queued[kind]; if (q && q.length < 4 * PROP_MAX) q.push([x, y, z, yaw, w, o?.clip ?? null, o?.clipT ?? 0, o?.scheme ?? null]); }   // (all of them: the flush keeps the nearest when it can't draw them all)
  // a prop's local → body matrix: the playing clip's prop track (a skate clip's board), else the board at rest on its wheels
  const propLocal = (clip, t, out) => { const P = clip && CLIPS.CLIP[clip]?.prop; return P ? P.matrix(THREE, t, out) : boardMatrix(THREE, BOARD_REST, out); };
  const walkerM = (x, y, z, yaw, out) => { Q.setFromAxisAngle(Y, yaw); V3.set(x, y, z); return out.compose(V3, Q, S1); };
  function propWorld(kind, x, y, z, yaw, clip, t, out) { walkerM(x, y, z, yaw, out); if (kind === 'board') out.multiply(propLocal(clip, t, PM4)); return out; }
  // a rider's parts at clip clock t: slots[n] = [mesh, instance] of partMatrices' n-th entry (its list is always the same, in the same
  // order); `alloc` (the flush) takes new instances, the gait hook rewrites the ones the flush took this frame
  const OUTS = {};
  function rideParts(P, x, y, z, yaw, roll, t, scheme, slots, alloc) {
    walkerM(x, y, z, yaw, WM4); if (roll) WM4.multiply(RM4.makeRotationZ(roll));
    const list = OUTS[P.item] = P.partMatrices(THREE, t, OUTS[P.item]);
    for (let n = 0; n < list.length; n++) { if (alloc) { const m = partMesh(P, list[n][0], scheme), i = m ? take(m.name.slice(9)) : -1; slots[n] = i >= 0 ? [m.name.slice(9), i] : null; }   // (by key: a mesh made again stays found)
      const s = slots[n], m = s && PROPS[s[0]]; if (!m) continue; m.setMatrixAt(s[1], M4.multiplyMatrices(WM4, list[n][1])); m.instanceMatrix.needsUpdate = true; } }
  // (MOVEMENT REVIEW #8 · eye: the camera's place — past what the meshes can hold, a kind's queue keeps the riders nearest it)
  function flushProps(eye = null) { pframe++;
    for (const k of DIRECT) { const m = PROPS[k]; if (m) m.count = 0; }   // (the clip props: this frame's gait hooks fill them)
    for (const kind of Object.keys(queued)) { const q = queued[kind], lim = kind === 'board' ? PROP_MAX : PROP_MAX >> 1;
      if (q.length > lim) { if (eye) q.sort((p, r) => Math.hypot(p[0] - eye.x, p[2] - eye.z) - Math.hypot(r[0] - eye.x, r[2] - eye.z)); q.length = lim; S2.propDrop = (S2.propDrop || 0) + 1; }
      if (kind !== 'board' && RIDE[kind]) { for (const k in PROPS) if (k.startsWith(kind + ':')) PROPS[k].count = 0;
        for (const [x, y, z, yaw, w, clip, t, scheme] of q) { const slots = []; rideParts(rideProp(kind, clip), x, y, z, yaw, 0, t, scheme, slots, true); if (w) { w.propSlots = slots; w.propKind = kind; w.propF = pframe; } }
        q.length = 0; continue; }
      const m = q.length ? (propMesh(kind), room(kind, q.length)) : PROPS[kind]; if (!m) continue;
      q.forEach(([x, y, z, yaw, w, clip, t], k) => { m.setMatrixAt(k, propWorld(kind, x, y, z, yaw, clip, t, M4)); if (w) { w.propSlot = k; w.propKind = kind; w.propF = pframe; } }); m.count = q.length; m.instanceMatrix.needsUpdate = true; q.length = 0; } }
  // a clip's own prop on a near walker this frame (a work tool; the stage's pistol): false when it has none, or it isn't shown (weight
  // < PROP_SHOW). The walker's matrix as peds.js draws it (with the stage's tilt), × Rz(turnRoll) (a chest-frame prop has it in its own
  // matrix: carry_box's) × prop.matrix(t, g). Call it after stepClip, from the gait hook.
  function clipProp(w, g) { const s = g?.clip, P = s?.c.prop; if (!w || !P || !P.geometry || P.partMatrices || s.c.group === 'skate' || s.w < PROP_SHOW) return false;
    const key = 'clip:' + P.id; DIRECT.add(key); if (!meshOf(key, () => P.geometry(THREE), .6)) return false; const i = take(key), m = PROPS[key]; if (i < 0) return false;
    Q.setFromAxisAngle(Y, w.yawS ?? w.p[3]); V3.set(w.p[0], w.p[1], w.p[2]); if (w.tq) { Q.multiply(w.tq); V3.y += w.lift || 0; } M4.compose(V3, Q, S1);
    if (P.frame !== 'chest') M4.multiply(RM4.makeRotationZ(turnRoll(g)));
    m.setMatrixAt(i, M4.multiply(P.matrix(THREE, s.t, PM4, g))); m.instanceMatrix.needsUpdate = true; return true; }

  // ── poses: the gait hook (like stage/index.js) — the anim registry's clips by name (anim/cast/clips: MOVEMENT.md §7). The movement
  // says which clip (o.clip) and, where the clip's timing is the movement's (the skate plan, the ride's pedalling, the stairs, the hail, the
  // cab doors), its clock (o.clipT): the hook keeps the walker's clip on that clock, so a kickturn ends on the very frame the walker turns.
  // Without a clock the clip runs on its own from o.clipStart (riders out of phase). A standing-leg clip keeps the walk weight at 0.
  const REG = clips && clips.CLIP ? clips : CLIPS, missing = new Set();
  { const anim0 = sim.animate; sim.animate = (w, dt, G, fresh) => { const g = anim0(w, dt, G, fresh); if (!g || w.stagePose) return g; const m = w.mv;
      const want = m?.clip && REG.CLIP[m.clip] ? m.clip : null; if (m?.clip && !want) missing.add(m.clip);
      if (want) { if (!g.clip || g.clip.name !== want || g.clip.out) REG.playClip(g, want, { t: m.clipT != null ? m.clipT - dt : (m.clipStart ?? 0), snap: !!m.snapClip });
        else if (m.clipT != null) g.clip.t = m.clipT - dt; g.mvClip = true; }
      else if (g.clip && g.mvClip && !g.clip.out) REG.stopClip(g);
      if (g.clip && g.mvClip) { REG.stepClip(g, dt); if (g.clip && !g.clip.out && !g.clip.c.moving) g.w = 0; }
      else if (m?.stand) g.w = 0;
      if (!g.clip) g.mvClip = false;
      if (m?.prop === 'board') {   // (the deck: the clip stands the body on it as it blends in; until then — and on a mid walker — the walker is lifted)
        const W = g.clip && SKATING.has(g.clip.name) ? g.clip.w : 0, base = m.base ?? w.p[1] - BOARD.deck; w.p[1] = base + BOARD.deck * (1 - W);
        const pm = PROPS.board; if (pm && w.propKind === 'board' && w.propF === pframe && w.propSlot < pm.count) { pm.setMatrixAt(w.propSlot, propWorld('board', w.p[0], base, w.p[2], w.yawS ?? w.p[3], g.clip && SKATING.has(g.clip.name) ? g.clip.name : null, g.clip ? g.clip.t : 0, M4)); pm.instanceMatrix.needsUpdate = true; } }
      else if (m && RIDE[m.prop]) {   // (the bike, the scooter: the clip's root sits the body on the saddle / the deck as it blends in; until then — and on a mid walker — the walker is lifted by as much)
        const P = rideProp(m.prop, g.clip?.name), on = !!g.clip && g.clip.c.prop === P, seat = MOVE.ride[m.prop].seat ?? 0, base = m.base ?? w.p[1] - seat; w.p[1] = base + seat * (1 - (on ? g.clip.w : 0));
        if (w.propKind === m.prop && w.propF === pframe && w.propSlots) rideParts(P, w.p[0], base, w.p[2], w.yawS ?? w.p[3], turnRoll(g), on ? g.clip.t : m.clipT ?? 0, null, w.propSlots, false); }
      if (g.clip) clipProp(w, g);   // (a work tool)
      return g; }; }
  const unpose = w => { if (!w) return; w.mv = null; if (w.g?.clip && w.g.mvClip) { REG.clearClip(w.g); w.g.mvClip = false; } };   // (the stage borrows a walker: the movement lets go of its clip)

  return { run, geomOf, at, prop, flushProps, clipProp, unpose, setScene(s) { scene = s; }, proxyFrame, get fleet() { return fleet; },
    // pace: the movement clock's rate over the natural pace (game min per page s × GAME_MIN; 1 live at the sim's 60-min day, the tape's
    // speed × that while it plays): the lag holds only up to MOVE.lag.maxPace
    frame(now, jump = false, rate = null) { const t0 = performance.now(); MOVERS.length = 0; fno++; if (jump) jumpF = fno; gameNow = now; pace = Number.isFinite(rate) ? Math.abs(rate) * GAME_MIN : 1; if (initTransit()) fleet.setNow(now); proxyFrame(); S.ms.push(performance.now() - t0); if (S.ms.length > 300) S.ms.shift(); },   // (the fleet places itself at the traffic's next step)
    stats: () => ({ ...S, ...S2, movers: MOVERS.length, ms: undefined, msAvg: S.ms.length ? +(S.ms.reduce((s, v) => s + v, 0) / S.ms.length).toFixed(3) : 0, msMax: S.ms.length ? +Math.max(...S.ms).toFixed(3) : 0,
      fleet: fleet ? fleet.stats() : null, proxies: PX.size, missingClips: [...missing], clips: !!REG }),
    get gameNow() { return gameNow; } };
}
