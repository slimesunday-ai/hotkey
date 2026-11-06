// C2-CLEANERS (2026-11-05) · THE CLEANERS IN THE CITY. slime, 11-04: "cleaners is better, go with that, how do we make it non glitcy all
// around the city?" · 11-05: "Vans is fine if you think that's the best option" · "yeah queuing behind is fine". A body from a street
// accident (traffic/accident.js) lies where it lands for GORE.body.linger s and is cleared only once the camera can't see it. For a body
// still in view after its linger, a plain van comes (round 3: the van replaced round 1's doors and walk-in, which reached 8% and 45% of
// real landings and held the crowd up to 168 s — docs/redesign/stage-20261105-cleaners.md). Their look and clips are the art lane's
// (cast.js OUTFITS cleaner_visor / cleaner_mask, anim/cast/clips/cleaners.js; cleaners.md "What the city must stage"); the van's look and
// its three beats are lane C2-van's (VAN_BEATS below: placeholders until they land, one line each). This file owns the crew's states and
// nothing else moves a Cleaner. Owners: stage/cruiser.js where a stage car stops and how it drives; traffic/sim.js the cars and the queue;
// accident.js the body (where it lies, its linger, its hazard, the pool).
//   THE VAN      the fleet's Qwik Kargo van (vehicles/index.js 'van', its size from the fleet table; the rear doors drawn shut until C2-van),
//                a STAGE CAR (cruiser.js driveCar: a route car with o.stage, from upstream out of view, held at its stop, then on until the
//                camera can't see it). Where it stops is cruiser.js planStop's, with the van's own price (fit, below): a kerb stop where a
//                length of kerb is free (the one-way's left kerb too — the van's own stop, offered to nothing else), else double-parked in
//                the lane. Its tail faces the work: it stops just past the bag, in line with the bag's way, so the carry is straight
//                (cleaners.md §5: the carry walks the bag's own line, head first, the way the body was thrown — with the traffic).
//   THE CAB RULE (GORE.wreck.cab, 3.5 s: an accident must not hold up an agent's ride) is kept by a START GUARD: the van doesn't set off
//                while a cab, a cruiser, a patrol or a route car is known to be coming through the lanes the job holds within the job's
//                length (on them, on the connectors into them, on the lanes into those with that connector chosen; a route car whose
//                route takes it there). Every such car held anyway is counted (stats().held).
//   THE WORK ZONE  the job's ground in the road (the marks, the ways, the bag, the carry, the mop, the steps out of the back) as soft
//                hazards (traffic/sim.js: every car stops short of a soft hazard and queues behind it, as behind a wreck): on the van's
//                own lane a piece goes on once the van's tail has passed it (the cars behind the van follow it there: none can be on it;
//                no gap is waited for), on any other lane once every car coming can stop comfortably short of it (v²/2b + 1.5 m). The
//                crew steps out only when the whole zone is on; it stays on until both are back in.
//   THE JOB      out of the back (VAN_BEATS.out: A, then B a beat later) → their marks (§2) → bag_body / bag_body_b (§2; the body hidden
//                at BODY.hide: accident.js bag) → the bag at rest (§3) while they walk to the lift marks (§4) → bag_lift / bag_lift_front
//                → the carry (§5): a sidestep to the tail's line where it is off it, then straight on to the tail (no pivot), and on into
//                the back (VAN_BEATS.load: the carry walks it in, the bag and B inside; B stays in the bay) → A, left outside, to the
//                pool with the mop (it appears as mop starts), mopped (§7; accident.js mop), back to the tail and in (VAN_BEATS.in)
//   NOBODY VANISHES IN VIEW  a Cleaner appears and disappears only inside the van (its body's box) or out of view; the bag goes in with
//                them; the van comes from out of view and goes until unseen.
//   LIMITS       every state has a time limit (CLEAN.lim). Before the bag, the job gives up: the crew back in, the van away (the body is
//                accident.js's again, cleared when unseen). After the bag, it finishes. One cleaning at a time. A seek on the playback
//                (meta.reset) ends a cleaning at once: a seek is a cut.
// Near tier: peds.js draws a Cleaner (w.cleaner) on the near tier while it is in view, whatever its distance (clips play there only).
// Console: __city.traffic.accidents.cleaners (stats(), now(), job).
import * as THREE from 'three';
import { CLIP, playClip, stepClip, stopClip } from '../anim/cast/clips/index.js';
import { BODY, LIFT, CARRY_GAP } from '../anim/cast/clips/cleaners.js';
import { cleanersGeometry } from '../anim/cast/clips/cleaners-props.js';
import { kerbOut, hwX, hwZ, SWALK } from '../plan.js';
import { slab } from '../ground.js';
import { groundY } from '../stage/gorefx.js';
import { CAR } from './sim.js';
import { planStop, driveCar, carFrame, overlapOf } from '../stage/cruiser.js';
import { byId as FLEET } from '../vehicles/index.js';

// THE VAN'S THREE BEATS (lane C2-van makes them; until they land, the cast's own clips stand in — swap each by its name here).
// C2-van's, on trunk later (its cleaners.md "The van"): out → van_step_down_back (A) / van_step_down (B) · load → bag_in / bag_in_front
// (B in first, pulling) · in → van_in / van_in_close (its doors(t) to the van's setDoors); the model 'cleanvan' (CLEAN.van.id). Its
// mop is A's (the one left outside): the job's B-mops order changes with it.
export const VAN_BEATS = {
  out: 'car_get_out',   // out of the back: from inside the tail, facing out, 0.6 m on (transit.js: its shift)
  load: null,           // the bag into the back: null = the carry walks on into it (the carry clips), the bag and B inside
  in: 'car_get_in',     // back in: at the tail, facing it, 0.55 m on (held low; the walker is hidden inside once it ends)
};
export const CLEAN = {
  on: true,
  // the hood's face, ONE value: slime, 11-05: "mask for face" (cast.js OUTFITS.cleaner_mask; 'visor' is cleaner_visor)
  face: 'mask',
  walk: 1.25, acc: 2, turn: 3,       // m/s walking (the crowd's pace) · m/s² · rad/s turning in place
  carry: CLIP.carry_back?.speed || .8, crab: .45,   // m/s: the carry clips' own speed · the sidestep to the tail's line
  cell: .2, laneCost: 4, zebraCost: 6,   // the ways' planner: m a cell · a travel lane's and a zebra's cost
  gap: { near: .95, wait: 6 },       // the crowd: m kept from anyone close ahead · s a Cleaner waits for them before it creeps on
  // the van: the fleet's id; gap m from B's front to the tail at the carry's end; aMax m the carry may run to the tail; eMax m it may step
  // sideways; look m upstream the start guard looks at most; job s a job is taken to last (the guard's window)
  // (id: lane C2-van's 'cleanvan' where the fleet has it, variant 0 — slime, 11-05: "daek glass" — else the Qwik Kargo van)
  van: { id: FLEET.cleanvan ? 'cleanvan' : 'van', variant: 0, gap: .45, aMax: 7.5, eMax: 2.4, look: 400, job: 80 },
  zone: { r: .45, step: .6 },        // the work zone's pieces: m each one's radius (a soft hazard) · m between them along a way
  hz: .55,                           // m: a Cleaner's own soft hazard in the road (its head: 1 m wide)
  mop: { at: .65, dry: 6, hold: 1.2 },   // the mop head m ahead of B · s the pool takes to go once mopped · s B mops on after it is gone
  // s each state may last: guard (the start guard's wait), drive (in to its stop), gate (the work zone on), out (a beat), marks (to the
  // bag marks), bag, ready (to the lift marks), lift, carry (the sidestep and the walk to the tail), load, mopOut (A to the pool), mop,
  // back (A to the tail), inA, home (the give-up's way back in), leave (the van out of view); all: the whole job
  lim: { guard: 60, drive: 60, gate: 30, out: 4, marks: 30, bag: 7, ready: 20, lift: 3.5, carry: 30, load: 12, mopOut: 30, mop: 30, back: 30, inA: 4, home: 40, leave: 60, all: 420 },
  cool: 25,             // s before a body whose cleaning gave up is tried again
};
const VAN = FLEET[CLEAN.van.id]?.dims || { w: 1.8, h: 2.4, l: 4.4 }, VW = VAN.w / 2, VH = VAN.l / 2;
const AXIS = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };
const PROP_SHOW = .6, LF_D = CLIP.bag_lift?.dur || 2.2, BB_D = CLIP.bag_body?.dur || 5.4, HALF = CARRY_GAP / 2;
// (a one-shot's end as the shader tests it — anim/cast/clips/index.js END: the clock as a float32 against the duration to 4 places)
const endOf = n => Math.fround(+(+(CLIP[n]?.dur ?? 0)).toFixed(4)), ended = (n, t) => Math.fround(t) >= endOf(n);
const shiftOf = n => CLIP[n]?.shift || [0, 0];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// a body-frame point (x: its left, z: ahead) of a frame at (x, z, yaw) → the world
const toW = (o, yaw, lx, lz) => [o[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), o[1] - lx * Math.sin(yaw) + lz * Math.cos(yaw)];

export function createCleaners({ scene, peds, sim, seen, body, night = false }) {
  const P = peds.sim, api = () => globalThis.__city, S = { requests: 0, started: 0, done: 0, gaveUp: 0, aborted: 0, noStop: 0, removedSeen: 0, spawnSeen: 0, vanSeen: 0, why: {}, states: {}, held: [], heldMax: 0, lookMs: 0 };
  const why = k => { S.why[k] = (S.why[k] || 0) + 1; };
  // the stage's context (planStop's height maps and its view): the record's page, or the live sim's stage
  const stageCtx = () => globalThis.__record?.draw?.stage?.ctx || globalThis.__city?.sim?.stage?.ctx || null;
  let now = 0, C = null, look = -1, seq = 0; const cool = new Map();
  // ── the look and the van: built once, on the first body down (prepare); both of the pair wear the look CLEAN.face names
  let vanM = null;
  async function prepare() { if ((look >= 0 && vanM) || prepare.p) return prepare.p; prepare.p = (async () => {
    const [CH, PB, V3, GP] = await Promise.all([import('../cast.js'), import('../pedbake.js'), import('../vehicles/three.js'), import('../gpu.js')]); const t0 = performance.now();
    if (look < 0) { const l = CH.rollLook(0xc1ea, { pool: 'npc', wear: CH.OUTFITS['cleaner_' + CLEAN.face] || CH.OUTFITS.cleaner_visor });
      const { looks } = PB.bakePeds({ n: 1, pool: 'npc' }, { ...CH, rollLook: () => l }, THREE); look = peds.addLook(looks[0]); }
    if (!vanM) { const mat = GP.tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .05 }), { vmat: true }), car = V3.vehicleMesh(CLEAN.van.id, { variant: CLEAN.van.variant, lights: night, driver: true, night }, mat), root = new THREE.Group();
      const bb = new THREE.Box3().setFromObject(car); car.position.set(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2); root.add(car); root.visible = false; scene.add(root); vanM = { root, car, roll: d => car.userData.roll?.(d) }; }
    S.lookMs = +(performance.now() - t0).toFixed(1); if (look < 0 || !vanM) prepare.p = null; })().catch(e => { console.warn('cleaners: prepare', e); prepare.p = null; }); return prepare.p; }
  // ── the props (the playing clip's, as movement.js clipProp draws one; the bag at rest between the clips): three meshes of their own
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), mk = id => { const m = new THREE.Mesh(cleanersGeometry(THREE, id), mat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false; scene.add(m); return m; };
  const BAGM = mk('body_bag'), RESTM = mk('body_bag'), MOPM = mk('mop'), PM = new THREE.Matrix4(), WM = new THREE.Matrix4(), RZ = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0);
  const walkerM = (w, out) => { Q.setFromAxisAngle(YA, w.yawS ?? w.p[3]); V.set(w.p[0], w.p[1], w.p[2]); return out.compose(V, Q, ONE); };

  // ════ THE SIDE OF THE STREET: (u along the kerb, c m from the curb: + into the block, − into the road) ⇄ the world (the ways' grid)
  function sideOf(E) { const s = slab(E.i, E.j), side = E.side, A = AXIS[side], ns = side === 'N' || side === 'S';
    const curb = side === 'N' ? s.z0 : side === 'S' ? s.z1 : side === 'W' ? s.x0 : s.x1;
    const hw = side === 'N' ? hwZ(E.j) : side === 'S' ? hwZ(E.j + 1) : side === 'W' ? hwX(E.i) : hwX(E.i + 1);
    return { E, side, A, ns, curb, hw, sw: E.sw ?? SWALK, u0: ns ? s.x0 : s.z0, u1: ns ? s.x1 : s.z1,
      at: (u, c) => ns ? [u, curb + A[1] * c] : [curb + A[0] * c, u], uc: (x, z) => ns ? [x, (z - curb) * A[1]] : [z, (x - curb) * A[0]] }; }
  // the traffic lanes by 32 m cell (once), for the lanes a point is on
  const cells = new Map(); for (const L of sim.lanes) { const n = Math.ceil(L.len / 16); for (let k = 0; k <= n; k++) { const s = L.len * k / n, key = Math.floor((L.x0 + L.ux * s) / 32) + ',' + Math.floor((L.z0 + L.uz * s) / 32); let a = cells.get(key); if (!a) cells.set(key, a = []); if (!a.includes(L)) a.push(L); } }
  // the lanes whose cars' way covers (x, z) (within a car's half-width + pad of the line): [{ L, ua }]
  function lanesAt(x, z, pad = .45, out = []) { const cx = Math.floor(x / 32), cz = Math.floor(z / 32);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const L of cells.get((cx + a) + ',' + (cz + b)) || []) { const dx = x - L.x0, dz = z - L.z0, ua = dx * L.ux + dz * L.uz, lat = Math.abs(dx * -L.uz + dz * L.ux);
      if (lat > .9 + pad || ua < -3 || ua > L.len + 3) continue; if (!out.some(q => q.L === L)) out.push({ L, ua }); }
    return out; }
  // every car coming to ua on lane L within maxD m (on it, on the connectors into it, on the lanes before them with that connector
  // chosen, or none yet): fn(car, m from its nose to ua)
  function upstream(L, ua, maxD, fn) { for (const o of L.cars) if (o.s < ua + 1) fn(o, Math.max(0, ua - o.s));
    const seenL = new Set([L]), q = [[L, ua]]; while (q.length) { const [X, base] = q.shift(); for (const cn of X.feeds || []) { for (const o of cn.cars) fn(o, cn.len - o.s + base); const I = cn.inL; if (!I) continue; const b2 = base + cn.len;
        for (const o of I.cars) if (!o.next || o.next === cn) fn(o, I.len - o.s + b2); if (!seenL.has(I) && b2 + I.len < maxD) { seenL.add(I); q.push([I, b2 + I.len]); } } } }
  // the parked cars near a job (the blocks' anchors, main.js parkedIn's boxes), gathered once a plan
  let PK = []; const parkedNear = (x, z, R) => { PK = []; for (const a of api()?.ANCHORS?.values() || []) for (const p of a?.parked || []) if (p[2] > x - R && p[0] < x + R && p[3] > z - R && p[1] < z + R) PK.push(p); };
  const parked = (x, z, r) => { for (const p of PK) if (p[0] < x + r && p[2] > x - r && p[1] < z + r && p[3] > z - r) return true; return false; };
  // a way's points every `step` m
  function dense(way, step = .5) { const out = []; for (let k = 1; k < way.length; k++) { const a = way[k - 1], b = way[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for (let q = k === 1 ? 0 : 1; q <= n; q++) out.push([a[0] + (b[0] - a[0]) * q / n, a[1] + (b[1] - a[1]) * q / n]); } return out; }

  // ════ THE WAYS: a grid over the body's side of the street (G: the sidewalk from the curb to the lot line, the road to its far kerb),
  // with what the city knows stands there — the sidewalk's clear strip (pedsim.js roomSpan: the blocks' room table), the lot line, the
  // parked cars (main.js parkedIn), the junction's box, the body and the bag and the van (rects) — A* and a string-pull
  function costAt(G, u, c, o) { const [x, z] = G.at(u, c);
    for (const r of o.rects || []) if (inRect(r, x, z)) return Infinity;
    if (c >= 0) { if (c > G.sw - .32) return Infinity;
      if (u < G.u0 + 2.6 || u > G.u1 - 2.6) return Infinity;   // (a corner: its posts, its lamp, the turning lines)
      // (what stands on the sidewalk: the stage's height map round the job — cruiser.js's — anything over the kerb's top by more than
      // 0.25 m and under a head's height (2.3 m: higher is an awning or a canopy, walked under) within a body's half of the spot;
      // without the map, the blocks' room table: its clear strip only)
      if (OJ) { for (const [ox, oz] of OFF) { const h = OJ.O.at(x + ox, z + oz); if (h === null || (h > OJ.top && h < 2.3)) return Infinity; } return 1; }
      const r = P.roomSpan(G.E, u - .15, u + .15, RS); if (r && (c < r[0] - .02 && r[0] > .35 || c > r[1] + .02)) return Infinity;
      if (!r && c < .55) return Infinity;
      return 1; }
    if (-c > 2 * G.hw - .35) return Infinity;   // (the far kerb)
    if (u < G.u0 - .2 || u > G.u1 + .2) return Infinity;   // (the junction's box)
    if (parked(x, z, .36)) return Infinity;
    let k = 1; if (u < G.u0 + 3.4 || u > G.u1 - 3.4) k = CLEAN.zebraCost;   // (a zebra and its stop line)
    if (lanesAt(x, z, .45, LS).length) k = Math.max(k, CLEAN.laneCost); LS.length = 0; if (-c > G.hw) k *= 2;   // (the far half of the road)
    return k; }
  const RS = [0, 0], LS = [], OFF = [[0, 0], [.25, 0], [-.25, 0], [0, .25], [0, -.25]]; let OJ = null;
  const inRect = (r, x, z) => { const dx = x - r.x, dz = z - r.z, a = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw), b = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw); return a > r.x0 && a < r.x1 && b > r.z0 && b < r.z1; };   // (a rect in a frame: x0…x1 along its +x, z0…z1 along its +z)
  function grid(G, ua, ub) { const h = CLEAN.cell, u0 = Math.max(G.u0 - .2, Math.min(ua, ub) - 7), u1 = Math.min(G.u1 + .2, Math.max(ua, ub) + 7), c0 = -2 * G.hw + .2, c1 = G.sw + 3.2;
    const nu = Math.ceil((u1 - u0) / h) + 1, nc = Math.ceil((c1 - c0) / h) + 1, K = new Float32Array(nu * nc);
    for (let i = 0; i < nu; i++) for (let j = 0; j < nc; j++) K[i + j * nu] = costAt(G, u0 + i * h, c0 + j * h, {});
    return { G, u0, c0, nu, nc, h, K, ij: (u, c) => [Math.round((u - u0) / h), Math.round((c - c0) / h)], uc: (i, j) => [u0 + i * h, c0 + j * h] }; }
  // the same grid with rects (the body, the bag on the ground, the van) closed
  function withRects(g, rects) { const K = g.K.slice(), G = g.G; for (const r of rects) { const R2 = Math.hypot(Math.max(-r.x0, r.x1), Math.max(-r.z0, r.z1)) + .3, [uc, cc] = G.uc(r.x, r.z), [i0, j0] = g.ij(uc - R2, cc - R2), [i1, j1] = g.ij(uc + R2, cc + R2);
      for (let i = Math.max(0, i0); i <= Math.min(g.nu - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(g.nc - 1, j1); j++) { const [x, z] = G.at(...g.uc(i, j)); if (inRect(r, x, z)) K[i + j * g.nu] = Infinity; } }
    return { ...g, K }; }
  const cellCost = (g, x, z) => { const [u, c] = g.G.uc(x, z), [i, j] = g.ij(u, c); return i < 0 || j < 0 || i >= g.nu || j >= g.nc ? Infinity : g.K[i + j * g.nu]; };
  // the nearest open cell to (u, c), within r m
  function open(g, u, c, r = 1.2) { const [i0, j0] = g.ij(u, c), R = Math.ceil(r / g.h); let best = null, bd = 1e9;
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= g.nu || j >= g.nc || !(g.K[i + j * g.nu] < Infinity)) continue; const d = a * a + b * b; if (d < bd) { bd = d; best = [i, j]; } }
    return best; }
  // the way between two world points (the end must be an open cell: a mark is exact, or there is no way)
  function astar(g, fromW, toW) { if (!(cellCost(g, ...toW) < Infinity)) return null; const from = g.G.uc(...fromW), to = g.G.uc(...toW), a = open(g, from[0], from[1], .6), b = open(g, to[0], to[1], .3); if (!a || !b) return null; const n = g.nu * g.nc, start = a[0] + a[1] * g.nu, goal = b[0] + b[1] * g.nu;
    const gs = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n), H = [], hv = k => Math.hypot(k % g.nu - b[0], ((k / g.nu) | 0) - b[1]);
    const push = (k, f) => { H.push([f, k]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
    const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
    gs[start] = 0; push(start, hv(start)); let it = 0;
    while (H.length && it++ < 200000) { const k = pop()[1]; if (done[k]) continue; done[k] = 1; if (k === goal) break; const i = k % g.nu, j = (k / g.nu) | 0;
      for (let a2 = -1; a2 <= 1; a2++) for (let b2 = -1; b2 <= 1; b2++) { if (!a2 && !b2) continue; const I = i + a2, J = j + b2; if (I < 0 || J < 0 || I >= g.nu || J >= g.nc) continue; const q = I + J * g.nu, c = g.K[q]; if (!(c < Infinity) || done[q]) continue;
        if (a2 && b2 && (!(g.K[I + j * g.nu] < Infinity) || !(g.K[i + J * g.nu] < Infinity))) continue;   // (no corner cutting)
        const d = gs[k] + Math.hypot(a2, b2) * (c + g.K[k]) / 2; if (d < gs[q]) { gs[q] = d; prev[q] = k; push(q, d + hv(q)); } } }
    if (!(gs[goal] < Infinity)) return null; const cellsOut = []; for (let k = goal; k >= 0; k = prev[k]) { cellsOut.push(k); if (k === start) break; } cellsOut.reverse();
    // string-pull: from each kept cell, the farthest one it sees over cells no dearer than the path's own between them
    const sees = (p, q) => { const pi = p % g.nu, pj = (p / g.nu) | 0, qi = q % g.nu, qj = (q / g.nu) | 0, n2 = Math.ceil(Math.hypot(qi - pi, qj - pj) * 2) + 1, kp = Math.max(g.K[p], g.K[q]);
      for (let s = 0; s <= n2; s++) { const f = s / n2, i = Math.round(pi + (qi - pi) * f), j = Math.round(pj + (qj - pj) * f), c = g.K[i + j * g.nu]; if (!(c < Infinity) || c > kp + 1e-6) return false; } return true; };
    const keep = [cellsOut[0]]; let k = 0; while (k < cellsOut.length - 1) { let j = cellsOut.length - 1; while (j > k + 1 && !sees(cellsOut[k], cellsOut[j])) j--; keep.push(cellsOut[j]); k = j; }
    const pts = keep.map(q => g.G.at(...g.uc(q % g.nu, (q / g.nu) | 0))); pts[0] = fromW.slice(); if (pts.length < 2) pts.push(toW.slice()); else pts[pts.length - 1] = toW.slice();
    return { pts }; }
  // every sample of a rectangle swept clear on the grid (the carry: the pair and the bag, ±0.45 m across its line)
  const clearAt = (g, x, z) => cellCost(g, x, z) < Infinity;
  function bandClear(g, a, b, half) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let s = 0; s <= L + 1e-6; s += .25) for (let l = -half; l <= half + 1e-6; l += half / 2) { const x = a[0] + ux * s - uz * l, z = a[1] + uz * s + ux * l; if (!clearAt(g, x, z)) { bandClear.at = [x, z]; return false; } } return true; }

  // ════ A JOB'S PLAN (sync, once, when a cleaning is asked for): the marks (cleaners.md §2–§4), the van's stop, the ways, the zone
  function marksOf(K) { const R = K.rest, yaw = R.yaw;
    // A with the body's walker (its root) at BODY.at in A's frame, A's heading the body's; B BODY.gap ahead, facing A
    const root = [R.rx, R.rz], [ax, az] = toW([0, 0], yaw, -BODY.at[0], -BODY.at[1]), A0 = [root[0] + ax, root[1] + az], B0 = toW(A0, yaw, 0, BODY.gap), bodyR = { x: root[0], z: root[1], yaw, x0: -.6, x1: 2.3, z0: -1, z1: .65 };
    // the bag at rest (§3: A's frame × T(0.2, 0, 0.65), its +x along A's +x) and the lift marks (§4); the bag's line (dB, head first), its middle M0
    const bagO = toW(A0, yaw, .2, .65), dB = [Math.cos(yaw), -Math.sin(yaw)], hC = Math.atan2(dB[0], dB[1]), Al = [bagO[0] - LIFT.at[2] * dB[0], bagO[1] - LIFT.at[2] * dB[1]], Bl = [Al[0] + CARRY_GAP * dB[0], Al[1] + CARRY_GAP * dB[1]];
    const M0 = [(Al[0] + Bl[0]) / 2, (Al[1] + Bl[1]) / 2], bagR = { x: bagO[0], z: bagO[1], yaw, x0: -1.05, x1: 1.05, z0: -.5, z1: .5 };
    return { K, yaw, A0, B0, bodyR, bagO, bagR, dB, nB: [-dB[1], dB[0]], hC, Al, Bl, M0 }; }
  // the van as a rect (inRect's frame) at a stop's centre, heading (ux, uz), m kept round it
  const vanRect = (x, z, ux, uz, m = .15) => ({ x, z, yaw: Math.atan2(ux, uz), x0: -VW - m, x1: VW + m, z0: -VH - m, z1: VH + m });
  const rectsMeet = (a, b) => { const pts = r => { const c = Math.cos(r.yaw), s = Math.sin(r.yaw); return [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([lx, lz]) => [r.x + lx * c + lz * s, r.z - lx * s + lz * c]); };
    for (const [A, B] of [[a, b], [b, a]]) for (const r of [A]) { const c = Math.cos(r.yaw), s = Math.sin(r.yaw), ax = [[c, -s], [s, c]], P2 = pts(B);
      for (const [px, pz] of ax) { const o = r.x * px + r.z * pz, lo = Math.min(...P2.map(([x, z]) => x * px + z * pz)) - o, hi = Math.max(...P2.map(([x, z]) => x * px + z * pz)) - o, [e0, e1] = px === c ? [r.x0, r.x1] : [r.z0, r.z1]; if (hi < e0 || lo > e1) return false; } }
    return true; };
  // the van's price at a stop (planStop asks it for each): null where it won't do. Its tail faces the work: it stands past the bag, its
  // heading the bag's line (the carry walks with the traffic, head first); the carry's middle M runs from M0 sideways (e, a sidestep) to
  // the tail's line, then straight on (a) until B's front is CLEAN.van.gap short of the tail. Never over the body or the marks, nor on its
  // way into a kerb stop (the last 6 m, eased: cruiser.js driveCar); the carry's band clear of parked cars and the kerb's furniture.
  function fitVan(J, st) { const { dB, nB, M0 } = J, ux = st.ux, uz = st.uz, no = k => { J.fitWhy[k] = (J.fitWhy[k] || 0) + 1; if (J.fitLog && J.fitLog.length < 60) J.fitLog.push([st.kind, +st.s.toFixed(1), +st.lat.toFixed(2), k, +(((st.x - ux * VH) - M0[0]) * dB[0] + ((st.z - uz * VH) - M0[1]) * dB[1]).toFixed(2), +(((st.x - ux * VH) - M0[0]) * nB[0] + ((st.z - uz * VH) - M0[1]) * nB[1]).toFixed(2), st.L.id]); return null; }; if (ux * dB[0] + uz * dB[1] < .995) return no('heading');
    const T = [st.x - ux * VH, st.z - uz * VH], a = (T[0] - M0[0]) * dB[0] + (T[1] - M0[1]) * dB[1], e = (T[0] - M0[0]) * nB[0] + (T[1] - M0[1]) * nB[1];
    if (a < HALF + CLEAN.van.gap + .25) return no('near'); if (a > HALF + CLEAN.van.aMax) return no('far'); if (Math.abs(e) > CLEAN.van.eMax) return no('side');
    const vr = vanRect(st.x, st.z, ux, uz, .1), keep = [{ ...J.bodyR, x0: J.bodyR.x0 - .3, x1: J.bodyR.x1 + .3, z0: J.bodyR.z0 - .3, z1: J.bodyR.z1 + .3 }, { ...J.bagR }, ...[J.A0, J.B0, J.Al, J.Bl].map(p => ({ x: p[0], z: p[1], yaw: 0, x0: -.45, x1: .45, z0: -.45, z1: .45 }))];
    if (keep.some(r => rectsMeet(vr, r))) return no('overWork');
    // (the way into a kerb stop: the last 6 m eased out to it — clear of the body)
    if (st.lat > .05) for (let g = .5; g <= 6; g += .5) { const lat = st.lat * smooth(1 - g / 6), x = st.x0 - ux * g + st.nx * lat, z = st.z0 - uz * g + st.nz * lat; if (rectsMeet(vanRect(x, z, ux, uz, .1), keep[0])) return no('easeOverBody'); }
    // (the carry's band: the sidestep, then straight on to the tail)
    const Mc = [M0[0] + nB[0] * e, M0[1] + nB[1] * e], Me = [T[0] - dB[0] * (HALF + CLEAN.van.gap), T[1] - dB[1] * (HALF + CLEAN.van.gap)], g = J.g0, ext = HALF + .35;
    // (from 0.3 m into the sidestep: where the pair stands at the lift is the lift marks' own, planned below)
    const e0 = Math.sign(e) * Math.min(.3, Math.abs(e)), Ms = [M0[0] + nB[0] * e0, M0[1] + nB[1] * e0];
    for (let k = -ext; k <= ext + 1e-6; k += .4) if (Math.abs(e) > .3 && !bandClear(g, [Ms[0] + dB[0] * k, Ms[1] + dB[1] * k], [Mc[0] + dB[0] * k, Mc[1] + dB[1] * k], .05)) { if (J.fitLog) J.fitLog.push(['crabAt', ...g.G.uc(...bandClear.at).map(v => +v.toFixed(2)), [g.G.u0, g.G.u1, g.G.hw, g.G.sw], parked(...bandClear.at, .36)]); return no('crab'); }
    if (!bandClear(g, [Mc[0] - dB[0] * ext, Mc[1] - dB[1] * ext], [Me[0] + dB[0] * (HALF + .1), Me[1] + dB[1] * (HALF + .1)], .45)) return no('carryBand');
    return a + 1.5 * Math.abs(e); }
  function plan(K) { const R = K.rest, ln = P.laneNear(R.x, R.z, 16); if (!ln || ln.E.joint) return why('noSide'), null; const Cx = stageCtx(); if (!Cx) return why('noStage'), null;
    const J = { ...marksOf(K), G: sideOf(ln.E), fitWhy: {}, fitLog: globalThis.__cleanDbg ? [] : null }; parkedNear(R.x, R.z, 30); J.uB = J.G.uc(R.x, R.z)[0];
    // (the sidewalk as it stands: one height map round the body, the van not drawn yet)
    let O = null; try { O = Cx.occ(R.x, R.z, 18, { n: 160 }); } catch {} OJ = O ? { O, top: (Cx.SIDE ?? .15) + .25 } : null; J.O = O; J.g0 = grid(J.G, J.uB - 10, J.uB + 10); OJ = null;
    const r = planStop(Cx, { x: R.x, z: R.z, y: 0, ry: 0 }, { van: { hw: VW, half: VH, leftKerb: true, fit: st => fitVan(J, st) } });
    if (!r.plan) { why('noStop'); S.noStop++; S.lastNoStop = { ...r.why, fit: J.fitWhy, log: J.fitLog }; return null; }
    const st = r.plan, cf = carFrame(st), u = [st.ux, st.uz], T = [st.x - u[0] * VH, st.z - u[1] * VH], { dB, nB, M0 } = J;
    const a = (T[0] - M0[0]) * dB[0] + (T[1] - M0[1]) * dB[1], e = (T[0] - M0[0]) * nB[0] + (T[1] - M0[1]) * nB[1], Mc = [M0[0] + nB[0] * e, M0[1] + nB[1] * e];
    const Me = [T[0] - dB[0] * (HALF + CLEAN.van.gap), T[1] - dB[1] * (HALF + CLEAN.van.gap)], Min = [T[0] + dB[0] * 1.15, T[1] + dB[1] * 1.15];
    // the steps out of the back: two, one each side of the tail's middle (the rear doors' halves); A takes the one nearer its mark.
    // in: where the out beat starts (inside the tail, facing out); x: where it ends (0.6 m on, out of the back); at: where the in beat
    // starts (facing the tail: it ends 0.25 m inside)
    const yOut = Math.atan2(-u[0], -u[1]), sh = shiftOf(VAN_BEATS.out)[1] || 0, sides = [-.45, .45].map(l => ({ in: cf.pt(l, -VH + sh - .55), x: cf.pt(l, -VH - .55), at: cf.pt(l, -VH - .3) }));
    const dA = s => Math.hypot(s.x[0] - J.A0[0], s.x[1] - J.A0[1]), [sA, sB] = dA(sides[0]) <= dA(sides[1]) ? sides : [sides[1], sides[0]];
    const vanR = vanRect(st.x, st.z, u[0], u[1], .2), g0 = J.g0, gb = withRects(g0, [J.bodyR, vanR]), wA = astar(gb, sA.x, J.A0), wB = wA && astar(gb, sB.x, J.B0);
    if (!wA || !wB) { S.lastNoStop = { way: !wA ? 'A' : 'B', from: (!wA ? sA : sB).x.map(v => +v.toFixed(2)), to: (!wA ? J.A0 : J.B0).map(v => +v.toFixed(2)), toCost: cellCost(gb, ...(!wA ? J.A0 : J.B0)), fromCost: cellCost(gb, ...(!wA ? sA : sB).x), kerb: kerbOut(...(!wA ? J.A0 : J.B0)), uc: J.G.uc(...(!wA ? J.A0 : J.B0)).map(v => +v.toFixed(2)), G: [J.G.u0, J.G.u1, J.G.sw], occ: J.O && OFF.map(([ox, oz]) => +(J.O.at((!wA ? J.A0 : J.B0)[0] + ox, (!wA ? J.A0 : J.B0)[1] + oz) ?? -9).toFixed(2)) }; return why(!wA ? 'way:A' : 'way:B'), null; }
    const g2 = withRects(g0, [J.bagR, vanR]), rA = astar(g2, J.A0, J.Al), rB = rA && astar(g2, J.B0, J.Bl); if (!rA || !rB) return why('way:lift'), null;
    // the mop: B on the van's side of the pool (downstream), facing it, the mop head CLEAN.mop.at ahead; its way from the tail and back
    const pool = [R.x, R.z], mopAt = [pool[0] + dB[0] * CLEAN.mop.at, pool[1] + dB[1] * CLEAN.mop.at], gm = withRects(g0, [vanR]), wM = astar(gm, sA.x, mopAt), wMb0 = wM && astar(gm, mopAt, sA.x), wMb = wMb0 && { pts: [...wMb0.pts, sA.at] };
    if (!wM || !wMb) why('way:mop');
    const J2 = { ...J, stop: st, cf, u, tail: T, a, e, Mc, Me, Min, yOut, yIn: Math.atan2(u[0], u[1]), sA, sB, vanR, wA: [sA.x, ...wA.pts.slice(1)], wB: [sB.x, ...wB.pts.slice(1)], rA: rA.pts, rB: rB.pts,
      mopAt, mopYaw: Math.atan2(-dB[0], -dB[1]), wM: wM ? [sA.x, ...wM.pts.slice(1)] : null, wMb: wMb ? wMb.pts : null, planMs: r.ms };
    J2.carry = [...(Math.abs(e) > .03 ? [{ p: Mc, crab: true }] : []), { p: Me }, { p: Min, load: true }];
    J2.zone = zoneOf(J2); return J2; }
  // ── THE FIT TEST (C2-gaps, 2026-11-05: the van goes only where its job fits — slime, 11-05: "i think just the gaps we fill with birds
  // and decay"; the redesign note's §10). A plan (a stop past the bag, the ways) is not enough: the stage's height map is read from
  // 14 m up, so a street tree's crown hides its trunk (a Cleaner walks "under" it: §9's 51 marks in a tree or a bin). The fit test reads
  // a second map from just under a head's height (FIT.top: the crowns, the awnings and the signs above it are behind its camera) — the
  // bins, the posts, the boxes, a tree's guard ring round its trunk (a thing taller than the camera has no top seen from inside it: the
  // trunk itself reads as its ring) — and every point the job puts a Cleaner (FIT.r round it) or the bag on the sidewalk must be
  // clear on it (nothing standing more than FIT.rise m over the sidewalk; in the road, nothing on the plan's tall map more than FIT.tall m
  // over it but a car): the marks, the ways, the lift marks, the bag at rest, the
  // carry's band, the mop's ways. → the hits, [] where none
  const FIT = { r: .3, step: .2, top: 1.95, rise: .05, tall: .35, half: 14, n: 320 };
  // (in the road too — a steam stack, a hydrant at a corner — where what stands there is not a car: the traffic's own cars, and the parked
  // ones, are what the stop and the zone plan round)
  function furniture(J, O) { const out = [], cars = sim.cars.filter(o => !o.gone && Math.abs(o.x - J.K.rest.x) < 20 && Math.abs(o.z - J.K.rest.z) < 20);
    const carAt = (x, z) => cars.some(o => { const h = o.h + (o.yawOff || 0), dx = x - o.x, dz = z - o.z; return Math.abs(dx * Math.sin(h) + dz * Math.cos(h)) < o.len / 2 + .35 && Math.abs(dx * Math.cos(h) - dz * Math.sin(h)) < o.wid / 2 + .35; }) || parked(x, z, .3);
    const test = (x, z, who, r = FIT.r) => { for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * .7, r * .7], [-r * .7, r * .7], [r * .7, -r * .7], [-r * .7, -r * .7]]) { const px = x + ox, pz = z + oz, road = kerbOut(px, pz) <= 0;
        // (a thing taller than the low map's camera hides from it — seen from inside, a trunk or a steam stack has no top: in the road,
        // where no crown overhangs, the plan's tall map says what stands there)
        const h = O ? O.at(px, pz) : null, h2 = road ? J.O?.at(px, pz) ?? null : null;
        if (h === null || h > groundY(px, pz) + FIT.rise || (h2 !== null && h2 > groundY(px, pz) + FIT.tall)) { if (road && carAt(px, pz)) continue; out.push([who, +px.toFixed(2), +pz.toFixed(2), h === null ? null : +h.toFixed(2), h2 === null ? null : +h2.toFixed(2)]); return; } } };
    for (const [k, w] of [['wA', J.wA], ['wB', J.wB], ['rA', J.rA], ['rB', J.rB], ['wM', J.wM], ['wMb', J.wMb]]) if (w) for (const p of dense(w, FIT.step)) test(p[0], p[1], k);
    for (const [k, p] of [['A', J.A0], ['B', J.B0], ['Al', J.Al], ['Bl', J.Bl], ['mop', J.mopAt]]) if (p) test(p[0], p[1], k);
    for (const s2 of [-.9, -.45, 0, .45, .9]) for (const l of [-.3, 0, .3]) test(J.bagO[0] + J.dB[0] * s2 + J.nB[0] * l, J.bagO[1] + J.dB[1] * s2 + J.nB[1] * l, 'bag', .1);
    const ext = HALF + .3, legs = [J.M0, J.Mc, J.Me]; for (let k = 1; k < legs.length; k++) { const a = legs[k - 1], b = legs[k]; for (let o = -ext; o <= ext + 1e-6; o += FIT.step) for (const l of [-.45, 0, .45]) for (const p of dense([[a[0] + J.dB[0] * o + J.nB[0] * l, a[1] + J.dB[1] * o + J.nB[1] * l], [b[0] + J.dB[0] * o + J.nB[0] * l, b[1] + J.dB[1] * o + J.nB[1] * l]], FIT.step)) test(p[0], p[1], 'carry', .1); }
    return out; }
  // accident.js asks once, before the van is sent: { ok, why, J } — ok only with a plan and nothing standing on the job's sidewalk ground
  function fit(K) { const Cx = stageCtx(); if (!Cx) return { ok: false, why: 'noStage' }; const J = plan(K); if (!J) return { ok: false, why: S.lastNoStop?.way ? 'way:' + S.lastNoStop.way : 'noStop', no: S.lastNoStop };
    let O = null; try { O = Cx.occ(K.rest.x, K.rest.z, FIT.half, { n: FIT.n, top: FIT.top }); } catch {}
    const f = furniture(J, O); if (f.length) return { ok: false, why: 'furniture:' + f[0][0], hits: f.slice(0, 6) }; return { ok: true, why: 'fit', J }; }
  // ── THE WORK ZONE: the job's ground in the road, a piece every CLEAN.zone.step m (the ways, the carry's band and its ends, the bag, the
  // body, the mop), each with the lanes it is on (a car's half-width + its radius of a lane's line)
  function zoneOf(J) { const pts = [], add = p => { if (kerbOut(p[0], p[1]) > 0) return; if (pts.some(q => Math.hypot(q.x - p[0], q.z - p[1]) < CLEAN.zone.step * .75)) return; const ls = lanesAt(p[0], p[1], CLEAN.zone.r); pts.push({ x: p[0], z: p[1], lanes: ls, on: false, hz: null }); };
    const st = CLEAN.zone.step;
    for (const w of [J.wA, J.wB, J.rA, J.rB, J.wM, J.wMb]) if (w) for (const p of dense(w, st)) add(p);
    for (const p of [J.A0, J.B0, J.Al, J.Bl, J.sA.x, J.sB.x, J.mopAt, [J.K.rest.x, J.K.rest.z]]) add(p);
    // (the bag at rest and the body: their lines; the carry: its band, the pair's line and ±0.5 m)
    for (const s of [-.9, -.3, .3, .9]) { add([J.bagO[0] + J.dB[0] * s, J.bagO[1] + J.dB[1] * s]); add([J.K.rest.x + J.dB[0] * s, J.K.rest.z + J.dB[1] * s]); }
    const ext = HALF + .3, legs = [J.M0, J.Mc, J.Me];
    for (let k = 1; k < legs.length; k++) { const a = legs[k - 1], b = legs[k]; for (let o = -ext; o <= ext + 1e-6; o += st) for (const l of [-.5, 0, .5]) for (const p of dense([[a[0] + J.dB[0] * o + J.nB[0] * l, a[1] + J.dB[1] * o + J.nB[1] * l], [b[0] + J.dB[0] * o + J.nB[0] * l, b[1] + J.dB[1] * o + J.nB[1] * l]], st)) add(p); }
    return pts; }

  // ════ THE CLEANERS (two pedsim walkers off the lanes, w.fix, moved here only)
  function actor(role, at, yaw) { const w = P.putAgent({ id: `cleaner:${role}:${++seq}`, look, fix: [at[0], groundY(at[0], at[1]), at[1], yaw] }); if (!w) return null;
    w.cleaner = role; w.stagePose = NOOP; w.yawS = yaw; w.omega = 0;
    const a = { role, w, x: at[0], z: at[1], y: groundY(at[0], at[1]), yaw, v: 0, way: null, wi: 0, endYaw: null, arrived: true, clip: null, ct: 0, lockYaw: false, hz: null, mv: null, wait: 0, since: now, gone: false, inside: false };
    w.cl = a; return a; }
  const NOOP = () => {};
  // inside the van: in its body's box (its own frame), the van standing there
  function insideVan(a) { const c = C; if (!c?.cf || !c.vanAt) return false; const [lx, lz] = c.cf.local(a.x, a.z); return Math.abs(lx) < VW - .05 && lz > -VH - .05 && lz < VH; }
  const seenA = a => !!seen(a.x, a.y + .9, a.z, 1.1);
  // (a Cleaner put on the street where the camera sees it, and not inside the van: counted — it must never happen)
  const popped = a => { if (a && seenA(a) && !insideVan(a)) S.spawnSeen++; };
  function drop(a) { if (!a || a.gone) return; if (seenA(a) && !insideVan(a) && !a.w.hide) S.removedSeen++; a.gone = true; dropHz(a); P.removeAgent(a.w.aid); }
  // hide a Cleaner inside the van (peds.js draws it nowhere), or show it again there
  const hide = (a, on) => { a.inside = on; a.w.hide = on || undefined; if (on) dropHz(a); };
  // walk a's way (its points) at CLEAN.walk, then turn to endYaw
  function go(a, way, endYaw = null, o = {}) { a.way = way; a.wi = 1; a.endYaw = endYaw; a.arrived = false; a.speed = o.speed || CLEAN.walk; a.wait = 0; a.lockYaw = false; }
  function stepWalk(a, dt) { if (a.arrived) { a.v = 0; return true; }
    const W = a.way; if (a.wi >= W.length) { a.v = 0; if (a.endYaw === null) { a.arrived = true; return true; } const dy = wrap(a.endYaw - a.yaw), st = CLEAN.turn * dt; if (Math.abs(dy) <= st) { a.yaw = a.endYaw; a.arrived = true; return true; } a.yaw += Math.sign(dy) * st; return false; }
    const [tx, tz] = W[a.wi], dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    // (on the sidewalk: it stops for anyone of the crowd close ahead — it gives way; walkers it passes step aside, as for a rider. Never
    // into a car: it waits)
    let vmax = a.speed; if (kerbOut(a.x, a.z) > 0 && blocked(a, dx / (d || 1), dz / (d || 1))) { a.wait += dt; vmax = a.wait > CLEAN.gap.wait ? .35 : 0; }
    else if (carAhead(a, dx / (d || 1), dz / (d || 1))) { a.wait += dt; vmax = 0; why('carAhead'); } else a.wait = 0;
    a.v = Math.min(vmax, a.v + CLEAN.acc * dt, Math.sqrt(2 * CLEAN.acc * Math.max(0, d + (a.wi < W.length - 1 ? 2 : 0))) + .05); const st = a.v * dt;
    if (d <= st || d < 1e-4) { a.x = tx; a.z = tz; a.wi++; } else { a.x += dx / d * st; a.z += dz / d * st; a.yaw = Math.atan2(dx, dz); }
    return false; }
  // a car's body within reach ahead (its rectangle and 0.2 m), the van's own excepted
  function carAhead(a, hx, hz) { const x = a.x + hx * .35, z = a.z + hz * .35; for (const o of sim.cars) { if (o.gone || o === C?.ctl?.c || Math.abs(o.x - x) > 7 || Math.abs(o.z - z) > 7) continue; const h = o.h + (o.yawOff || 0), sh = Math.sin(h), ch = Math.cos(h), dx = x - o.x, dz = z - o.z;
      if (Math.abs(dx * sh + dz * ch) < o.len / 2 + .2 && Math.abs(dx * ch - dz * sh) < o.wid / 2 + .2) return true; } return false; }
  function blocked(a, hx, hz) { for (const w of P.walkers) { if (w.gone || w.cleaner || w.hide || !w.p) continue; const dx = w.p[0] - a.x, dz = w.p[2] - a.z; if (Math.abs(dx) > 2.2 || Math.abs(dz) > 2.2) continue;
      const al = dx * hx + dz * hz, lat = Math.abs(dx * hz - dz * hx); if (al > 0 && al < 1.6 && lat < CLEAN.gap.near) return true; } return false; }
  // the walker drawn where the actor is (its ground eased over the kerb's step, as accident.js settleY)
  function place(a, dt) { if (a.gone) return; const gy = groundY(a.x, a.z); a.y += (gy - a.y) * Math.min(1, dt * 14); const w = a.w; w.fix = [a.x, a.y, a.z, a.yaw]; w.vc = a.v; if (a.lockYaw) { w.yawS = a.yaw; w.omega = 0; } }
  // a Cleaner's own soft hazard while it stands in the road (the zone covers its ground; this covers its body)
  function hz(a, x, z, r) { if (a.inside || kerbOut(x, z) > .05 + Math.max(0, r - .6)) { dropHz(a); return; } if (!a.hz) { a.hz = { x, z, r, hit: false, soft: true, case: null, cleaner: true }; sim.hazards.push(a.hz); } a.hz.x = x; a.hz.z = z; a.hz.r = r; }
  function dropHz(a) { if (!a?.hz) return; const i = sim.hazards.indexOf(a.hz); if (i >= 0) sim.hazards.splice(i, 1); a.hz = null; }
  // a walking Cleaner on the sidewalk is a mover for the crowd (pedsim.js RIDERS AVOID: its next 1.6 s), as the stage's actors are
  const FT = [.2, .4, .6, .8, 1, 1.2, 1.4, 1.6];
  function publish(a) { if (a.inside || a.v < .05 || kerbOut(a.x, a.z) <= 0) return; const M = a.mv ??= { w: a.w, x: 0, z: 0, hx: 0, hz: 1, v: 0, n: FT.length, ft: Float32Array.from(FT), fx: new Float32Array(FT.length * 2) };
    M.x = a.x; M.z = a.z; M.hx = Math.sin(a.yaw); M.hz = Math.cos(a.yaw); M.v = a.v; for (let k = 0; k < FT.length; k++) { M.fx[2 * k] = a.x + M.hx * a.v * FT[k]; M.fx[2 * k + 1] = a.z + M.hz * a.v * FT[k]; } P.movers.push(M); }

  // ════ THE GAIT HOOK (peds.js, near walkers): the actor's clip on the cleaning's clock, the props
  { const anim0 = P.animate; P.animate = (w, dt, G, fresh) => { const g = anim0(w, dt, G, fresh); if (g && w.cleaner && w.cl) pose(w.cl, w, g, dt, fresh); return g; }; }
  function pose(a, w, g, dt, fresh) { const want = a.clip;
    if (!want) { if (g.clip) { if (!g.clip.out) stopClip(g); stepClip(g, dt); } }
    else { if (!g.clip || g.clip.name !== want) playClip(g, want, { t: Math.max(0, a.ct - dt), snap: fresh || a.snap || a.ct > .4 });
      // (the clip's clock is the job's: the same float the state machine tested its end on — a beat's shift lands on the same frame)
      const s = g.clip; s.t = Math.max(0, a.ct - dt); s.out = false; stepClip(g, dt); if (g.clip) { g.clip.t = a.ct; g.it = a.ct; if (!g.clip.c.moving) g.w = 0; } }
    // (the carry: both gaits in step — the same g.u — cleaners.md §5; B takes A's, A drawn first: they move by the same distance)
    a.hookAt = now; if (C && a.role === 'B' && C.inStep && C.A && !C.A.gone && C.A.w.g && C.A.hookAt === now) { const gA = C.A.w.g; g.u = gA.u; g.a = gA.a; g.v = gA.v; g.vPrev = gA.vPrev; g.w = gA.w; g.py = gA.py; }
    if (a.lockYaw) { w.yawS = a.yaw; w.omega = 0; g.omega = 0; }
    // the playing clip's prop (the bag on A's bag clips, B's mop), in the walker's frame as drawn, shown at weight ≥ PROP_SHOW
    // (the bag at rest hands over to the lift's bag on the frame that one shows: the same pose there — no frame with two, none with none)
    const s = g.clip, pr = s?.c.prop; if (!pr || s.w < PROP_SHOW || (C?.loaded && pr.id === 'body_bag')) return;
    if (C?.restBag && pr.id === 'body_bag') { if (C.ph !== 'lift') return; C.restBag = false; RESTM.visible = false; }
    const m = pr.id === 'mop' ? MOPM : BAGM; walkerM(w, WM); if (pr.frame !== 'chest') WM.multiply(RZ.makeRotationZ(Math.max(-.3, Math.min(.3, -.09 * (g.omega || 0) * (g.v || 0)))));
    m.matrix.multiplyMatrices(WM, pr.matrix(THREE, s.t, PM, g)); m.matrixWorldNeedsUpdate = true; m.visible = true; if (pr.id === 'body_bag' && C) C.bagShown = now; }
  // a one-shot beat on a, on the job's clock: → true on the frame it ends (the walker moved by its shift that frame, as the shader takes it)
  function beat(a, name, dt) { if (a.clip !== name) { a.clip = name; a.ct = 0; a.snap = true; a.lockYaw = true; return false; } a.ct += dt; a.snap = false;
    if (!ended(name, a.ct)) return false; const [sx, sz] = shiftOf(name), y = a.yaw; a.x += sx * Math.cos(y) + sz * Math.sin(y); a.z += -sx * Math.sin(y) + sz * Math.cos(y); return true; }

  // ════ THE VAN on its stop (cruiser.js driveCar: the sim car; the model drawn where it is)
  function vanStep() { const c = C, ctl = c.ctl; if (!ctl || !vanM) return; const p = ctl.step(); c.vanAt = p; const R = vanM.root;
    R.position.set(p.x, 0, p.z); R.rotation.y = p.h; vanM.roll(p.ds || 0);
    if (!R.visible) { R.visible = true; if (seen(p.x, 1.2, p.z, 2.6)) S.vanSeen++; } }
  function vanGone() { const c = C; if (vanM) vanM.root.visible = false; if (c?.ctl) c.ctl.drop(); if (c) c.vanAt = null; }
  // ── the start guard: a cab, a cruiser, a patrol or a route car known to be coming through the lanes the job holds within its length
  const isBad = o => !!(o.route || o.stage || o.asCar || o.kind !== 'car');
  function badComing(c) { let hit = null; const mine = c.ctl?.c || null, lanes = new Map([[c.stop.L, c.stop.s + VH]]);
    for (const q of c.zone) for (const { L, ua } of q.lanes) lanes.set(L, Math.max(lanes.get(L) ?? 0, ua));
    for (const [L, ua] of lanes) { const look = Math.min(CLEAN.van.look, (CLEAN.van.job + 10) * (L.v0 || 10) * 1.1);
      // (a cab pulled in at its stand — kin, out of the lane — is not coming through it now: when it pulls out, the held count sees it)
      upstream(L, ua, look, (o, d) => { if (!hit && o !== mine && !o.gone && !o.kin && isBad(o) && d < look) hit = o; });
      if (!hit) for (const o of sim.cars) if (o !== mine && o.route && !o.gone && o.route.links?.indexOf(L, o.route.i) >= 0) { hit = o; break; } if (hit) break; }
    return hit; }
  // C2-QUEUE round 2 (docs/redesign/stage-20261106-queue.md, design B) · THE JOB'S STRETCH: once the van is sent, every lane the work
  // zone reaches, from its first piece to its last, and the stop itself where the van stands in the lane, reserved in the traffic
  // (sim.reserve: jamOf counts it as standing) — no car is let in that its queue would leave on a zebra or in a box; zoneStep puts a piece
  // on only inside its lane's stretch (the cars on another lane are held short of it once the van stands: r.hold); zoneOff gives them back
  function reserveJob(c) { if (c.res || !sim.reserve) return; const span = new Map(), add = (L, a, b) => { const g = span.get(L); if (g) { g[0] = Math.min(g[0], a); g[1] = Math.max(g[1], b); } else span.set(L, [a, b]); };
    for (const q of c.zone) for (const { L, ua } of q.lanes) add(L, ua - CLEAN.zone.r, ua + CLEAN.zone.r);
    if (!c.stop.out) add(c.stop.L, c.stop.s - VH, c.stop.s + VH);
    c.res = [...span].map(([L, [a, b]]) => sim.reserve(L, a, b, c.ctl?.c, L === c.stop.L)).filter(Boolean); }
  const inRes = (c, L, ua) => !!c.res?.some(r => r.L === L && ua >= r.s0 - 1e-6 && ua <= r.s1 + 1e-6);
  // ── the work zone's pieces on: the van's lane once its tail has passed the piece; another lane once every car coming can stop short
  function zoneStep() { const c = C; let all = true; const van = c.vanAt, L0 = c.stop.L;
    for (const q of c.zone) { if (q.on) continue; let ok = true;
      for (const { L, ua } of q.lanes) { if (!inRes(c, L, ua)) { ok = false; break; }
        // (the van's lane: once its tail has passed the piece — or, stopped, with no car's nose come up to it from behind)
        if (L === L0) { if (!van) { ok = false; break; } const tail = (van.x - L.x0) * L.ux + (van.z - L.z0) * L.uz - VH; if (tail >= ua + CLEAN.zone.r + .3) continue;
          if (c.stopped && tail > ua - .2 && !L.cars.some(o => o !== c.ctl?.c && !o.gone && o.s > ua - CLEAN.zone.r - .6 && o.s - o.len < tail)) continue; ok = false; break; }
        if (!c.stopped) { ok = false; break; }
        for (const o of L.cars) if (o !== c.ctl?.c && o.s >= ua + 1 && o.s - o.len < ua + CLEAN.zone.r + .3) ok = false;
        if (ok) upstream(L, ua, 160, (o, d) => { if (!ok || o === c.ctl?.c) return; const v = Math.max(0, o.v); if (d - CLEAN.zone.r < (v < .3 ? 1 : v * v / (2 * CAR.b) + 1.5)) ok = false; });
        if (!ok) break; }
      if (!ok) { all = false; continue; }
      q.on = true; if (q.lanes.length) { q.hz = { x: q.x, z: q.z, r: CLEAN.zone.r, hit: false, soft: true, case: null, cleaner: true, zone: true }; sim.hazards.push(q.hz); } }
    return all; }
  function zoneOff() { for (const r of C?.res || []) sim.unreserve(r); if (C) C.res = null; for (const q of C?.zone || []) { if (q.hz) { const i = sim.hazards.indexOf(q.hz); if (i >= 0) sim.hazards.splice(i, 1); q.hz = null; } q.on = false; } }

  // ════ THE JOB'S STATES
  const LIM = CLEAN.lim;
  function setState(ph) { if (!C) return; C.ph = ph; C.t = 0; C.limNow = LIM[ph] ?? LIM.all; S.states[ph] = (S.states[ph] || 0) + 1; C.log.push([+now.toFixed(2), ph]); }
  function start(K) { const J = K.vanFit?.J && K.vanFit.at === now ? K.vanFit.J : plan(K); if (!J) { cool.set(K, now + CLEAN.cool); return false; }
    // (door: tools/cleanercheck.mjs's old mode reads the way in; the van's is the tail)
    C = { ...J, door: { id: 'van', end: true }, ph: 'guard', t: 0, T: 0, A: null, B: null, log: [], restBag: false, inStep: false, bagged: false, loaded: false, ctl: null, vanAt: null, stopped: false, held: new Map(), carryM: null, carryH: J.hC };
    K.clean = C; S.started++; setState('guard'); return true; }
  // the job given up before the bag: the crew back in by the way they came, the van away (the body is accident.js's again)
  function giveUp(k) { const c = C; if (!c || c.bagged) return; why('giveUp:' + k); S.gaveUp++; S.lastGiveUp = { k, ph: c.ph, log: c.log.slice() }; cool.set(c.K, now + CLEAN.cool); body.unclaim(c.K); c.K = null;
    if (!c.ctl) { finish(); return; }
    for (const a of [c.A, c.B]) if (a && !a.gone && !a.inside) { a.clip = null; a.lockYaw = false; const back = [[a.x, a.z], ...(a.way || []).slice(0, Math.max(1, a.wi)).reverse()]; a.home = a === c.A ? c.sA : c.sB; go(a, [...back, a.home.x, a.home.at], c.yIn); }
    setState('home'); }
  function step(dt) { const c = C; c.t += dt; c.T += dt; const A = c.A, B = c.B;
    if (c.ctl) vanStep();
    switch (c.ph) {
      case 'guard': { const b = badComing(c); if (b) { c.guardWhy = b.asCar ? 'cab' : b.stage ? 'cruiser' : b.kind === 'patrol' ? 'patrol' : 'route'; c.guardBy = { id: b.id, kind: b.kind, v: +b.v.toFixed(1), L: b.L?.id }; if (c.t > LIM.guard) { why('guard:' + c.guardWhy); c.bagged = false; giveUp('guard'); } break; }
        const ctl = driveCar(stageCtx(), c.stop); if (!ctl) { if (c.t > LIM.guard) { why('noDrive'); giveUp('drive'); } break; }
        // (spawned over another car — one coming off a connector at its start, out of view: not there; tried again next frame)
        const me = ctl.c; if (sim.cars.some(o => o !== me && !o.gone && Math.abs(o.x - me.x) < 6 && Math.abs(o.z - me.z) < 6 && overlapOf({ x: me.x, z: me.z, h: me.h, len: me.len, wid: me.wid }, { x: o.x, z: o.z, h: o.h, len: o.len, wid: o.wid }) < .2)) { ctl.drop(); why('spawnOver'); break; }
        c.guardT = +c.t.toFixed(1); c.ctl = ctl; vanStep(); setState('drive'); break; }
      case 'drive': { reserveJob(c); zoneStep(); if (c.ctl.stopped()) { c.ctl.park(); c.stopped = true; c.driveT = +c.t.toFixed(1); setState('gate'); } else if (c.t > LIM.drive) giveUp('drive'); break; }
      case 'gate': { c.ctl.park(); reserveJob(c); for (const r of c.res || []) r.hold = true; if (zoneStep()) { c.gateT = +c.t.toFixed(1); setState('out'); c.A = actor('A', c.sA.in, c.yOut); if (!c.A) { giveUp('put'); break; } popped(c.A); } else if (c.t > LIM.gate) giveUp('zone'); break; }
      case 'out': { // A out of the back, B a beat later; each then walks to its bag mark
        if (A && !A.done && beat(A, VAN_BEATS.out, dt)) { A.done = true; A.clip = null; go(A, c.wA, c.yaw); }
        if (!c.B && c.t > .9) { c.B = actor('B', c.sB.in, c.yOut); if (!c.B) { giveUp('put'); break; } popped(c.B); }
        if (c.B && !c.B.done && beat(c.B, VAN_BEATS.out, dt)) { c.B.done = true; c.B.clip = null; go(c.B, c.wB, c.yaw + Math.PI); }
        for (const a of [A, c.B]) if (a?.done) stepWalk(a, dt);
        if (A?.done && c.B?.done && A.arrived && c.B.arrived) { setState('bag'); for (const a of [A, c.B]) { a.clip = a === A ? 'bag_body' : 'bag_body_b'; a.ct = 0; a.lockYaw = true; } }
        else if (c.t > LIM.marks) giveUp('marks'); break; }
      case 'bag': { A.ct += dt; B.ct = A.ct;
        if (!c.bagged && A.ct >= BODY.hide) { c.bagged = true; body.bag(c.K); }
        if (A.ct >= BB_D) { setState('ready'); c.restBag = true; for (const a of [A, B]) { a.clip = null; a.lockYaw = false; } go(A, c.rA, c.hC); go(B, c.rB, c.hC); }
        break; }
      case 'ready': { stepWalk(A, dt); stepWalk(B, dt);
        if (A.arrived && B.arrived) { setState('lift'); A.x = c.Al[0]; A.z = c.Al[1]; B.x = c.Bl[0]; B.z = c.Bl[1]; A.yaw = B.yaw = c.hC; for (const a of [A, B]) { a.clip = a === A ? 'bag_lift' : 'bag_lift_front'; a.ct = 0; a.lockYaw = true; }
          c.inStep = true; c.carryM = c.M0.slice(); c.carryH = c.hC; c.leg = 0; }
        else if (c.t > LIM.ready && !c.readyLate) { c.readyLate = true; why('readyLate'); }
        break; }
      case 'lift': { A.ct += dt; B.ct = A.ct;
        if (A.ct >= LF_D) { A.clip = 'carry_back'; B.clip = 'carry_front'; A.ct = B.ct = A.ct - LF_D; if (c.restBag) why('restBagLate'); c.restBag = false; setState('carry'); } break; }
      case 'carry': case 'load': { A.ct += dt; B.ct = A.ct; carryStep(dt); if (c.t > LIM[c.ph] && !c.late) { c.late = true; why(c.ph + 'Late'); } break; }
      case 'mopOut': { // A, the one left outside, to the pool (slime, 11-05: "the one who stays outside mops"); B stays in the bay
        stepWalk(A, dt); if (A.arrived) { setState('mop'); A.clip = 'mop'; A.ct = 0; A.lockYaw = true; body.mop(c.K, CLEAN.mop.dry); }
        else if (c.t > LIM.mopOut) { why('mopOutLate'); setState('back'); go(A, [[A.x, A.z], ...(A.way || []).slice(0, Math.max(1, A.wi)).reverse(), c.sA.at], c.yIn); } break; }
      case 'mop': { A.ct += dt;
        if ((body.poolLeft(c.K) <= 0 && c.t > CLEAN.mop.dry + CLEAN.mop.hold) || c.t > LIM.mop) { A.clip = null; A.lockYaw = false; setState('back'); go(A, c.wMb, c.yIn); } break; }
      case 'back': { stepWalk(A, dt); if (A.arrived) setState('inA'); else if (c.t > LIM.back && !c.late) { c.late = true; why('backLate'); } break; }
      case 'inA': { // A climbs in after the bag (B is in the bay with it)
        if (beat(A, VAN_BEATS.in, dt)) { hide(A, true); A.clip = null; setState('leave'); } break; }
      case 'home': { // the job given up: each back to its step, facing in, in
        for (const a of [A, B]) if (a && !a.gone && !a.inside) { if (!a.arrived) stepWalk(a, dt); else if (beat(a, VAN_BEATS.in, dt)) { hide(a, true); a.clip = null; } }
        if ([A, B].every(a => !a || a.gone || a.inside) || c.t > LIM.home) setState('leave'); break; }
      case 'leave': { // the zone off, the van back into its lane and away, until the camera can't see it; the crew inside it with it
        if (!c.went) { zoneOff(); for (const a of [A, B]) if (a && !a.gone && !a.inside) { if (seenA(a)) { why('leftOut'); } hide(a, true); } c.waitOut = (c.waitOut || 0) + dt; if (c.ctl.go(c.waitOut)) { c.went = true; c.goT = +c.t.toFixed(1); } break; }
        const p = c.vanAt, gone = !p || c.ctl.c.gone, far = p && Math.hypot(p.x - c.stop.x, p.z - c.stop.z) > 8, vis = p && [-VH, 0, VH].some(o => seen(p.x + Math.sin(p.h) * o, 1.2, p.z + Math.cos(p.h) * o, 1.6));
        // (past its time, on until the camera can't see it — a van held in a queue in view is not taken off there — up to four times it)
        if (gone || (far && !vis) || (c.t > LIM.leave && !vis) || c.t > LIM.leave * 4) { if (vis && !gone) { S.vanSeenGone = (S.vanSeenGone || 0) + 1; why('vanGoneSeen'); } c.vanOut = !vis; for (const a of [A, B]) drop(a); vanGone(); finish(); }
        break; } }
    if (C && C.T > LIM.all && !C.allLate) { C.allLate = true; why('allLate'); }
    if (C) watchHeld(dt); }
  // THE CARRY (§5): the bag's middle M along the legs — a sidestep to the tail's line (crab: the heading kept), straight on to the tail,
  // and on into it (VAN_BEATS.load: the pair walks it in, B and the bag inside). A and B are M ∓ CARRY_GAP/2 along the heading: they move
  // by the same distance every frame, so their gaits stay in step
  function carryStep(dt) { const c = C, A = c.A, B = c.B, legs = c.carry;
    if (c.leg >= legs.length) { // in: the bag inside the van, B with it; A lets go and climbs in after it
      c.loaded = true; hide(B, true); B.clip = null; A.clip = null; A.v = B.v = 0; c.inStep = false;
      if (c.wM && c.wMb && body.poolLeft(c.K) > .05) { setState('mopOut'); go(A, [[A.x, A.z], ...c.wM], c.mopYaw); } else setState('inA'); return; }
    const L = legs[c.leg]; if (L.load && c.ph !== 'load') setState('load');
    const tgt = L.p, dx = tgt[0] - c.carryM[0], dz = tgt[1] - c.carryM[1], d = Math.hypot(dx, dz), mv = Math.min(d, (L.crab ? CLEAN.crab : CLEAN.carry) * dt);
    if (d > 1e-6) { c.carryM[0] += dx / d * mv; c.carryM[1] += dz / d * mv; } if (d - mv < .005) { c.carryM = tgt.slice(); c.leg++; }
    const hx = Math.sin(c.carryH), hzz = Math.cos(c.carryH); A.x = c.carryM[0] - hx * HALF; A.z = c.carryM[1] - hzz * HALF; B.x = c.carryM[0] + hx * HALF; B.z = c.carryM[1] + hzz * HALF; A.yaw = B.yaw = c.carryH;
    A.v = B.v = mv / dt; if (!B.inside && insideVan(B) && c.ph === 'load') { const [, lz] = c.cf.local(B.x, B.z); if (lz > -VH + .9) hide(B, true); } }
  // the hazards and the bodies on the crowd's map each frame: the Cleaners in the road, the bag at rest and carried
  function publishAll() { const c = C; if (!c) return; const B0 = P.bodies || (P.bodies = []);
    for (const a of [c.A, c.B]) if (a && !a.gone && !a.inside) { hz(a, a.x, a.z, CLEAN.hz); publish(a); }
    const bagAt = c.restBag || c.ph === 'bag' ? c.bagO : (c.ph === 'lift' || c.ph === 'carry' || c.ph === 'load') && !c.loaded ? c.carryM : null;
    const bh = c.restBag || c.ph === 'bag' ? c.yaw + Math.PI / 2 : c.carryH, bx = Math.sin(bh), bz = Math.cos(bh);
    if (bagAt) for (const s2 of [-.6, 0, .6]) B0.push({ x: bagAt[0] + bx * s2, z: bagAt[1] + bz * s2, r: .42, w: null, room: .3 }); }
  function finish() { const c = C; if (!c) return; for (const a of [c.A, c.B]) drop(a); for (const a of [c.A, c.B]) dropHz(a); zoneOff(); if (c.ctl && !c.ctl.c.gone && vanM?.root.visible) vanGone(); else if (vanM) vanM.root.visible = false;
    if (c.K) { if (c.bagged) body.done(c.K); else { body.unclaim(c.K); cool.set(c.K, now + CLEAN.cool); } }
    S.done += c.bagged && c.loaded ? 1 : 0; S.last = { kind: c.stop.kind, flip: !!c.stop.flip, a: +c.a.toFixed(2), e: +c.e.toFixed(2), T: +c.T.toFixed(1), log: c.log, bagged: c.bagged, loaded: c.loaded, vanOut: !!c.vanOut, guardT: c.guardT, guardWhy: c.guardWhy, guardBy: c.guardBy, driveT: c.driveT, gateT: c.gateT }; C = null; }
  // a seek (the record's player): the cleaning ends at once — a cut
  function abort(k = 'seek') { if (!C) return; why('abort:' + k); S.aborted++; const c = C; for (const a of [c.A, c.B]) { if (a && !a.gone) { a.gone = true; dropHz(a); P.removeAgent(a.w.aid); } } zoneOff(); vanGone(); if (c.K) { if (c.bagged) body.done(c.K, true); else body.unclaim(c.K); } C = null; }
  let seekOn = false; const hookSeek = () => { if (seekOn) return; const pl = globalThis.__record?.player; if (!pl?.on) return; seekOn = true; pl.on((s, m) => { if (m?.reset) abort('seek'); }); };
  // cars held by the job (a cab, a cruiser, a patrol or a route car standing with one of its hazards, or the van, next ahead in its lane
  // within 15 m): every one, and how long
  function watchHeld(dt) { const c = C, mine = c.ctl?.c, hs = sim.hazards.filter(h => h.cleaner);
    for (const o of sim.cars) { if (o === mine || !isBad(o) || o.v > .3 || o.L?.kind !== 'lane') { if (c.held.has(o)) { const t = c.held.get(o); c.held.delete(o); if (t > .5) S.held.push({ kind: kindOf(o), t: +t.toFixed(1) }); } continue; }
      const L = o.L, byHz = hs.some(h => { const dx = h.x - L.x0, dz = h.z - L.z0, al = dx * L.ux + dz * L.uz, lat = Math.abs(dx * -L.uz + dz * L.ux); return lat < o.wid / 2 + h.r && al > o.s && al - o.s < 15; }),
        byVan = mine && !mine.gone && mine.L === L && L.cars.includes(mine) && mine.s - mine.len > o.s && mine.s - mine.len - o.s < 15 && !L.cars.some(q => q !== o && q !== mine && q.s > o.s && q.s < mine.s);
      if (!byHz && !byVan) { if (c.held.has(o)) { const t = c.held.get(o); c.held.delete(o); if (t > .5) S.held.push({ kind: kindOf(o), t: +t.toFixed(1) }); } continue; }
      const t = (c.held.get(o) || 0) + dt; c.held.set(o, t); if (t > S.heldMax) S.heldMax = +t.toFixed(2); } }
  const kindOf = o => o.asCar ? 'cab' : o.stage ? 'cruiser' : o.kind === 'patrol' ? 'patrol' : o.route ? 'route' : o.kind;

  function update(dt) { now += dt;
    // (the bag in the frame but drawn nowhere last frame, while A holds it or it lies at rest: counted — it must never happen)
    if (C && C.A && !C.A.gone && !C.loaded && (C.restBag || C.ph === 'lift' || C.ph === 'carry' || C.ph === 'load') && !BAGM.visible && !RESTM.visible) { const b = C.restBag ? C.bagO : C.carryM; if (b && seen(b[0], .4, b[1], 1)) S.bagGone = (S.bagGone || 0) + 1; }
    BAGM.visible = MOPM.visible = false; hookSeek(); if (!C) { RESTM.visible = false; return; }
    step(dt); if (!C) { RESTM.visible = false; return; }
    for (const a of [C.A, C.B]) if (a && !a.gone) place(a, dt);
    RESTM.visible = !!C.restBag; if (C.restBag) { Q.setFromAxisAngle(YA, C.yaw); V.set(C.bagO[0], groundY(C.bagO[0], C.bagO[1]), C.bagO[1]); RESTM.matrix.compose(V, Q, ONE); RESTM.matrixWorldNeedsUpdate = true; }
    publishAll(); trace?.(C, now); }
  let trace = null;
  // accident.js asks, every frame, for a body past its linger that the camera still sees: → true when a cleaning has it
  function want(K) { if (!CLEAN.on || C || look < 0 || !vanM) { if (look < 0 || !vanM) prepare(); return false; } if ((cool.get(K) ?? -1) > now) return false; S.requests++; return start(K); }
  return { update, want, prepare, abort, CLEAN, VAN_BEATS, get busy() { return !!C; }, set trace(f) { trace = f; },
    stats: () => ({ ...S, why: { ...S.why }, states: { ...S.states }, held: S.held.slice(), busy: !!C, ph: C?.ph ?? null, look }),
    now: () => C ? { ph: C.ph, t: +C.t.toFixed(2), T: +C.T.toFixed(2), stop: C.stop.kind, A: C.A && !C.A.gone ? [+C.A.x.toFixed(2), +C.A.z.toFixed(2)] : null, B: C.B && !C.B.gone ? [+C.B.x.toFixed(2), +C.B.z.toFixed(2)] : null, bagged: C.bagged, log: C.log.slice() } : null,
    get job() { return C; }, get van() { return vanM; }, plan: K => plan(K), fit: K => { const r = fit(K); K.vanFit = { ...r, at: now }; return r; }, furniture, FIT, VAN: { hw: VW, half: VH } };
}
