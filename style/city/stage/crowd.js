// STAGE · ROOM ROUND A SCENE (2026-10-09). slime, at the Grand Ave & 1st robbery: "the dude getting robbed's head is intersecting with a
// pedestrian". The stage kept its own people apart (the pair's gap, the axis, steer, the bystander agents stepped aside), but the CROWD
// walked through a scene as if nobody were there, and a kerb waiter stood where it stood. The probe saw none of it: it counted standing
// bystanders closer than 0.6 m only (stage/probe.mjs --tape counts every head now). While a scene plays, the crowd keeps out of its
// actors' room:
//   ROOM    round an upright actor 1.3 m (the big heads, 1.0 × 0.85 m boxes, keep clear of each other from there at any yaw); round a body
//           on the ground its fall (on its back: a 1.75 m disc 1 m behind where its feet were; on its side: 1.7 m, 0.9 m to its +x)
//   HOLD    a crowd walker on a sidewalk or at the kerb (never out on a zebra) whose next 0.9 s at its own pace would take it into the
//           room of an actor, deeper than it is now, stops where it is (w.halt: the walkers behind it queue
//           up, as behind an agent at its lane point) and watches; it walks on once that way is clear (the actor gone, the scene
//           over), or after 30 s (then 10 s free of it)
//   MOVERS  an actor walking or running (to its partner, the getaway, the limp off, back to its spot) is published to the crowd as
//           the sim's riders are (pedsim.js RIDERS AVOID: sim.movers, its path over the next 1.6 s): a walker it would pass within
//           1.05 m steps aside inside its side's clear strip, or stops short. (Movers alone, a running robber's room unheld, put more
//           walkers in its way than the hold: the seeded probe's bodies inside a bystander went 0 → 4)
// AN ARREST'S WAY (2026-10-09). Its actors were left out: its slow cuffed walk to the cruiser's door crosses the kerb-wait rows, and the
// walkers held or stopped short for it stood in its way the whole walk (the tape probe's arrests had twice the head and body overlaps
// with it). Now an arrest has its room like any scene, and its WAY — where its people will walk: the cuffed walk to the door from the
// start (vignettes.js arrestScene way()), the run, the cop's way round — is a band WAY.r m either side that nobody is ever held in:
//   a walker in a way walks on (out of it), a held one the way comes to is let go, and one whose next 0.9 s would take it into a way
//   stops short of it (as of a room). Its walking actors are movers too (the riders' step aside)
// Agents are not held (their trips run on the sim's clock): the scene's placement keeps clear of them (vignettes.js placeFor).
// CROWD GRID (2026-10-10, slime: a knocked-down robbery on a sidewalk — passers-by stop or step around and give the scene room). On a 4 m
// sidewalk a knockdown takes the kerb side up to 2.37 m out and the walkers' lane is at 2.40: the HOLD stopped every passer-by at the
// 1.3 / 1.75 m rooms, and after its 30 s let them walk on through the body. Now the actors are BODIES on the crowd's body map (pedsim.js
// sim.bodies, every frame): an upright actor its own body, one on the ground its fall's footprint (vignettes.js BACK_FP / SIDE_FP, as
// discs), each with FOOT.room m round it. The crowd steps round them inside the sidewalk's clear strip (pedsim.js bodyStep) or, with no
// room, stops short and queues — never through them, and with no time-out. The HOLD is now the arrest's WAY only (below).
import { STEP } from '../pedsim.js';
// (up: the room round an UPRIGHT actor, C1-7: with pedsim's body and pad a passer-by keeps 1.31 m from its centre, ROOM.r — the big heads
// clear at any yaw; at .3 they passed 0.96 m off and their heads met. A body on the ground keeps `room`)
export const FOOT = { room: .3, up: .65, r: .3,
  back: [-.3, .3].flatMap(l => [.15, -.6, -1.35, -2.1].map(a => [l, a, .48])),   // on its back: BACK_FP [−.62, .62, −2.45, .45] covered — [lateral, along, r] in its frame (+x, forward)
  side: [-.15, .7, 1.5, 2.1].flatMap(l => [.25, -.6].map(a => [l, a, .5])) };     // on its side: SIDE_FP [−.6, 2.3, −1.05, .7] covered

export const ROOM = { r: 1.3, look: [.3, .6, .9], back: [1, 1.75], side: [.9, 1.7], maxHold: 30, near: 6, way: 1.35 };   // (way: the band either side of an arrest's way)
const BACK = /^(shove_fall|fall_back|lie_hurt|shot_hit$|get_up)/, SIDE = /^(death_collapse|lie_still|shot_hit_dead)/, FT = [.2, .4, .6, .8, 1, 1.2, 1.4, 1.6];

export function createRoom(psim) {
  const held = new Map(), done = new Map(), S = { held: 0, released: 0, timedOut: 0, published: 0, wayLet: 0, bodies: 0 }; let Z = [], W = [], now = 0;   // (done: a walker let go after its 30 s walks on for 10 s, held by nobody)
  // an actor's room: where its walker is drawn, by what it plays (an upright body, or one on the ground)
  const roomOf = w => { const c = w.g?.clip?.name || '', y = w.yawS ?? w.p[3];
    if (SIDE.test(c)) return { x: w.p[0] + Math.cos(y) * ROOM.side[0], z: w.p[2] - Math.sin(y) * ROOM.side[0], r: ROOM.side[1] };
    if (BACK.test(c)) return { x: w.p[0] - Math.sin(y) * ROOM.back[0], z: w.p[2] - Math.cos(y) * ROOM.back[0], r: ROOM.back[1] };
    return { x: w.p[0], z: w.p[2], r: ROOM.r }; };
  // how far into an arrest's way a point is (> 0: inside its band)
  const inWay = (x, z) => { let m = -1e9; for (const g of W) { const d = ROOM.way - segD(g, x, z); if (d > m) m = d; } return m; };
  // its next 0.9 s at its own pace take it into a way (crowd grid: a scene's room is its actors' bodies now — bodies())
  function threat(w) { if (!W.length) return false; const v = Math.max(w.vc || 0, w.v || 1.2, .8), hx = Math.sin(w.p[3]), hz = Math.cos(w.p[3]);
    for (const t of ROOM.look) { const x = w.p[0] + hx * v * t, z = w.p[2] + hz * v * t; if (inWay(x, z) > 0) return true; } return false; }
  // crowd grid · an actor on the crowd's body map: upright, its body; on the ground, its fall's footprint (FOOT) — what it plays says which
  function bodies(w) { const c = w.g?.clip?.name || '', y = w.yawS ?? w.p[3], L = BACK.test(c) ? FOOT.back : SIDE.test(c) ? FOOT.side : null, B = (psim.bodies ||= []);
    if (!L) { B.push({ x: w.p[0], z: w.p[2], r: FOOT.r, w, room: FOOT.up }); return; }
    const fx = Math.sin(y), fz = Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y); for (const [l, a, r] of L) B.push({ x: w.p[0] + rx * l + fx * a, z: w.p[2] + rz * l + fz * a, r, w, room: FOOT.room }); S.bodies++; }
  // a walking actor's place in t s: along its target and path at its speed
  function ahead(A, t) { let x = A.x, z = A.z, left = (A.v || 0) * t; const pts = A.tx !== null ? [[A.tx, A.tz], ...(A.path || [])] : (A.path || []);
    for (const [px, pz] of pts) { const d = Math.hypot(px - x, pz - z); if (d >= left) { const f = left / (d || 1); return [x + (px - x) * f, z + (pz - z) * f]; } left -= d; x = px; z = pz; } return [x, z]; }
  function publish(A) { const M = A.mover ??= { w: null, x: 0, z: 0, hx: 0, hz: 1, v: 0, n: 0, ft: Float32Array.from(FT), fx: new Float32Array(FT.length * 2) };
    M.w = A.w; M.x = A.x; M.z = A.z; M.hx = Math.sin(A.ry); M.hz = Math.cos(A.ry); M.v = A.v; M.n = FT.length;
    for (let k = 0; k < FT.length; k++) { const p = ahead(A, FT[k]); M.fx[2 * k] = p[0]; M.fx[2 * k + 1] = p[1]; }
    const n = Math.hypot(M.fx[0] - A.x, M.fx[1] - A.z); if (n > .01) { M.hx = (M.fx[0] - A.x) / n; M.hz = (M.fx[1] - A.z) / n; }
    (psim.movers ||= []).push(M); S.published++; }
  // per frame (stage/index.js frame, before the crowd moves): every actor of every running scene and every lingering one
  // ways: an arrest's, [ax, az, bx, bz] segments (stage/index.js, from vignettes.js arrestScene way())
  function step(actors, dt, ways = []) {
    now += dt; Z = []; W = ways; for (const A of actors) { const w = A.w; if (A.freed || A.inCar || !w?.p || w.gone) continue; Z.push(roomOf(w)); bodies(w); if (A.moving > .05 && (A.tx !== null || A.path?.length)) publish(A); }
    for (const [w, h] of held) { h.t += dt; const inW = W.length && !w.gone && w.p && inWay(w.p[0], w.p[2]) > 0, out = w.gone || !Z.length || h.t > ROOM.maxHold || inW || !threat(w); if (!out) continue; if (inW) S.wayLet++;   // (in a way now: it walks on, out of it)
      if (w.halt && !w.fix && !w.agent) { w.halt = false; } held.delete(w); S.released++; if (h.t > ROOM.maxHold) { S.timedOut++; done.set(w, now + 10); } }
    for (const [w, t] of done) if (now > t || w.gone) done.delete(w);
    if (!Z.length) return;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of Z) { x0 = Math.min(x0, q.x - q.r - 1.5); x1 = Math.max(x1, q.x + q.r + 1.5); z0 = Math.min(z0, q.z - q.r - 1.5); z1 = Math.max(z1, q.z + q.r + 1.5); }
    for (const g of W) for (const k of [0, 2]) { x0 = Math.min(x0, g[k] - ROOM.way - 1.5); x1 = Math.max(x1, g[k] + ROOM.way + 1.5); z0 = Math.min(z0, g[k + 1] - ROOM.way - 1.5); z1 = Math.max(z1, g[k + 1] + ROOM.way + 1.5); }   // (and the ways)
    for (const w of psim.walkers) { if (w.agent || w.gone || !w.p || !w.E || w.fix || w.halt || w.stagePose || w.off || done.has(w)) continue;
      if (w.p[0] < x0 || w.p[0] > x1 || w.p[2] < z0 || w.p[2] > z1) continue;
      if (w.E.cross && w.s > STEP + .05 && w.s < w.E.len - 1) continue;   // (out on a zebra: it goes on)
      if (W.length && inWay(w.p[0], w.p[2]) > 0) continue;   // (in an arrest's way: it walks on, out of it)
      if (threat(w)) { w.halt = true; w.vc = 0; held.set(w, { t: 0 }); S.held++; } } }
  // let everyone go (a tape seek, the lens switching)
  function clear() { for (const w of held.keys()) if (w.halt && !w.fix && !w.agent) w.halt = false; held.clear(); done.clear(); Z = []; }
  return { step, clear, holding: () => held.size, stats: () => ({ ...S, holding: held.size }) };
}
// distance from a point to a segment [ax, az, bx, bz]
function segD(g, x, z) { const [ax, az, bx, bz] = g, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); return Math.hypot(ax + dx * t - x, az + dz * t - z); }
