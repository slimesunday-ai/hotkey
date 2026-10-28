// STAGE · THE CRUISER'S STOP AND ITS DRIVE (2026-10-09; slime: "let the cruiser double-park"). stage/vignettes.js arrestScene asks
// planStop() where the cruiser stops for a suspect, and drives it there with driveCar(): a car of the traffic sim (traffic/sim.js STAGE
// CARS), so it follows the cars ahead, stops at the lights, and the cars behind it follow it to a stand — none ever drives through it.
//   THE STOP     every traffic lane with the suspect on its kerb side within reach (stop.reach of the walk), its stretch clear of the
//                junctions, at 1.2 m steps: AT THE KERB where a length of it is free (the old stop: its side 0.14 m off the kerb, found in a
//                height map), else DOUBLE-PARKED in the travel lane (lat 0: beside the parked cars, the lights flashing) where its rear
//                kerb-side door can open — the door's swing, the suspect's spot 0.45 m off it and the cop's 1.2 m behind (and, for a
//                stand-in cop, the front door's) on standing ground: a one-way's channel between its lane and the parked cars (1.44 m at
//                +4), or a gap in an avenue's parked cars. The cheapest by
//                the walk (a Dijkstra over the height map: standing ground, never across a traffic lane or a junction) plus
//                stop.dpCost for a double-park; checked again on a fine height map there. THE FAR PLACES (the heap, the mall, the
//                trailer park, the woods — 33 to 85 m from a lane): the same, on a wider map: the nearest reachable kerb or lane.
//   THE DRIVE    a route car (spawnRoute, o.stage): from a lane out of view upstream (straight on through the junctions, 30–120 m back) to
//                its stop (the nose at the stop's s + half its length), held there; then on down the road until out of view. At a kerb
//                stop the model eases over to the kerb in the last 6 m and the sim car leaves its lane (stageOut) — unless the kerb is
//                too near the lane to clear it (a two-way side street): then it stays, a stopped car in the lane. Away: back into its
//                lane (stageIn) when nothing is coming, easing out over 10 m.
import { CRUISER } from './props.js';
import { isAve } from '../plan.js';

const HW = CRUISER.hw, HALF = CRUISER.half, [RZ0, RZ1] = CRUISER.doors.rear, [FZ0, FZ1] = CRUISER.doors.front;
export const STOP = { reach: 34, far: 62, step: 1.2, dpCost: 2.5, walkR: .3, laneR: 1.15, kerbGap: .14, outGap: .1, door: 1.1 };
// the cruiser's frame at a stop: pt(lx, lz) → world [x, z] (lx < 0: the kerb side), local(x, z) → [lx, lz]
export function carFrame(s) { const { ux, uz } = s; return { x: s.x, z: s.z, ux, uz, nx: s.nx, nz: s.nz, pt: (lx, lz) => [s.x + lx * uz + lz * ux, s.z - lx * ux + lz * uz], local: (x, z) => { const dx = x - s.x, dz = z - s.z; return [dx * uz - dz * ux, dx * ux + dz * uz]; } }; }
// the door spots (cruiser frame): the suspect 0.45 m off the rear door, the opening's centre 0.05 m ahead of it, facing the tail; the cop
// `IN` m before it; the stand-in's way in and out by the front door
export function doorSpots(cf, IN) { const dz = (RZ0 + RZ1) / 2 + .05; return { dz, DS: cf.pt(-HW - .45, dz), GS: cf.pt(-HW - .45, dz - IN), FX: [cf.pt(-HW + .6, (FZ0 + FZ1) / 2), cf.pt(-HW - .75, (FZ0 + FZ1) / 2)], ryIn: Math.atan2(-cf.ux, -cf.uz) }; }
function sepRect(A, B) { const ax = [[Math.sin(A.h), Math.cos(A.h)], [Math.cos(A.h), -Math.sin(A.h)], [Math.sin(B.h), Math.cos(B.h)], [Math.cos(B.h), -Math.sin(B.h)]], dx = B.x - A.x, dz = B.z - A.z;
  const ext = (C, u) => C.len / 2 * Math.abs(Math.sin(C.h) * u[0] + Math.cos(C.h) * u[1]) + C.wid / 2 * Math.abs(Math.cos(C.h) * u[0] - Math.sin(C.h) * u[1]);
  let m = -1e9; for (const u of ax) m = Math.max(m, Math.abs(dx * u[0] + dz * u[1]) - ext(A, u) - ext(B, u)); return m; }
export const overlapOf = sepRect;   // (< 0: the two rectangles overlap — the probe's "a car through the cruiser")
// a rectangle in the cruiser's frame (lx0…lx1 across, lz0…lz1 along) as a world rect
const frameRect = (cf, lx0, lx1, lz0, lz1) => { const [x, z] = cf.pt((lx0 + lx1) / 2, (lz0 + lz1) / 2); return { x, z, h: Math.atan2(cf.ux, cf.uz), len: lz1 - lz0, wid: lx1 - lx0 }; };

// ── where the traffic drives: car bodies (4.7 × 1.8, the sim's) every 0.5 m along every link near a point, with their link
function linkBodies(T, x, z, r) { const out = [], P = [0, 0, 0];
  for (const L of T.links) { if (L.dead) continue;
    if (L.kind === 'lane') { const s0 = Math.max(0, (x - L.x0) * L.ux + (z - L.z0) * L.uz - r), s1 = Math.min(L.len, s0 + 2 * r); if (Math.abs((x - L.x0) * -L.uz + (z - L.z0) * L.ux) > r) continue;
      for (let s = s0; s <= s1; s += .5) out.push({ L, x: L.x0 + L.ux * (s - 2.35), z: L.z0 + L.uz * (s - 2.35), h: Math.atan2(L.ux, L.uz), len: 4.7, wid: 1.8 }); }
    else { if (Math.abs(L.X[0] - x) > r + 30 || Math.abs(L.Z[0] - z) > r + 30) continue; for (let s = 0; s <= L.len; s += .5) { T.poseOn(L, s, P); if (Math.abs(P[0] - x) > r || Math.abs(P[1] - z) > r) continue; out.push({ L, x: P[0] - Math.sin(P[2]) * 2.35, z: P[1] - Math.cos(P[2]) * 2.35, h: P[2], len: 4.7, wid: 1.8 }); } } }
  return out; }
// the cruiser at its stop in another car's way (a junction's turners, the cross street): its own lane, and the links into and out of it,
// excepted when it stands in its lane (the cars there follow it)
function inTraffic(bodies, st, cf, inLane) { const me = frameRect(cf, -HW - .05, HW + .05, -HALF - .1, HALF + .1), L = st.L;
  return bodies.some(b => { if (inLane && (b.L === L || b.L.out === L || b.L.inL === L)) return false; if (!inLane && b.L === L) return false; return Math.abs(b.x - me.x) < 6 && Math.abs(b.z - me.z) < 6 && sepRect(me, b) < .05; }); }
// ── THE WALK: a Dijkstra over a height map from the suspect (8-connected cells), on standing ground (the road or the pavement, never
// over the knees), STOP.walkR clear of anything taller, never in a traffic link's strip (lane or connector, ±STOP.laneR).
// → { dist(x, z) → m or Infinity, path(x, z) → [[x, z] …] (string-pulled) }
function walkField(C, O, A, T, skip = []) {
  const n = O.n, cs = 2 * O.half / n, x0 = O.cx - O.half, z0 = O.cz + O.half, cell = (x, z) => { const i = Math.floor((x - x0) / cs), j = Math.floor((z0 - z) / cs); return i < 0 || j < 0 || i >= n || j >= n ? -1 : i + j * n; };
  const cx = k => x0 + ((k % n) + .5) * cs, cz = k => z0 - (Math.floor(k / n) + .5) * cs, yTop = Math.max(C.SIDE, A.y) + .15;
  const solid = new Uint8Array(n * n), bad = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) { const h = O.H[k]; if (h > yTop + .2 || h < -.15) solid[k] = 1; }
  // (the people standing about: solid too, 0.5 m round — the walk goes round them, never head through head)
  for (const [px, pz, w] of C.walkersNear(O.cx, O.cz, O.half * 1.42, skip)) { if ((w.vc || 0) > .2 || Math.hypot(px - A.x, pz - A.z) < .3) continue; const i0 = Math.floor((px - x0) / cs), j0 = Math.floor((z0 - pz) / cs), r = Math.ceil(.5 / cs);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const i = i0 + a, j = j0 + b; if (i >= 0 && j >= 0 && i < n && j < n && Math.hypot(x0 + (i + .5) * cs - px, z0 - (j + .5) * cs - pz) < .5 + cs * .5) solid[i + j * n] = 1; } }
  // (traffic cars stand in the lanes, which are out anyway; the lanes and the junctions: out)
  const mark = (x, z, r) => { const i0 = Math.floor((x - r - x0) / cs), i1 = Math.floor((x + r - x0) / cs), j0 = Math.floor((z0 - z - r) / cs), j1 = Math.floor((z0 - z + r) / cs);
    for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) { const px = x0 + (i + .5) * cs, pz = z0 - (j + .5) * cs; if (Math.hypot(px - x, pz - z) <= r) bad[i + j * n] = 1; } };
  const inMap = (x, z, m = 2) => x > x0 - m && x < x0 + 2 * O.half + m && z < z0 + m && z > z0 - 2 * O.half - m, P = [0, 0, 0];
  for (const L of T.links) { if (L.dead) continue; const len = L.len; if (L.kind === 'lane') { if (!inMap(L.x0, L.z0, len + 2) ) continue; for (let s = 0; s <= len; s += .4) { const x = L.x0 + L.ux * s, z = L.z0 + L.uz * s; if (inMap(x, z)) mark(x, z, STOP.laneR); } }
    else { if (!inMap(L.X[0], L.Z[0], 30)) continue; for (let s = 0; s <= len; s += .4) { T.poseOn(L, s, P); if (inMap(P[0], P[1])) mark(P[0], P[1], STOP.laneR); } } }
  // clearance: a cell within walkR of a solid one is out (the walker's body)
  const rc = Math.ceil(STOP.walkR / cs), free = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) { if (solid[k] || bad[k]) continue; const i = k % n, j = Math.floor(k / n); let ok = true;
    for (let a = -rc; a <= rc && ok; a++) for (let b = -rc; b <= rc; b++) { if (a * a + b * b > rc * rc + .5) continue; const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n || solid[ii + jj * n]) { ok = false; break; } } if (ok) free[k] = 1; }
  // the suspect's own cell (and round it) is where it stands: always free
  const ka = cell(A.x, A.z); if (ka >= 0) { const i = ka % n, j = Math.floor(ka / n); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n && !solid[ii + jj * n] && !bad[ii + jj * n]) free[ii + jj * n] = 1; } }
  const D = new Float64Array(n * n).fill(Infinity), from = new Int32Array(n * n).fill(-1);
  if (ka >= 0) { D[ka] = 0; const Q = [[0, ka]]; const push = e => { Q.push(e); let i = Q.length - 1; while (i) { const p = (i - 1) >> 1; if (Q[p][0] <= Q[i][0]) break; [Q[p], Q[i]] = [Q[i], Q[p]]; i = p; } };
    const pop = () => { const top = Q[0], last = Q.pop(); if (Q.length) { Q[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < Q.length && Q[l][0] < Q[m][0]) m = l; if (r < Q.length && Q[r][0] < Q[m][0]) m = r; if (m === i) break; [Q[m], Q[i]] = [Q[i], Q[m]]; i = m; } } return top; };
    while (Q.length) { const [d, k] = pop(); if (d > D[k]) continue; const i = k % n, j = Math.floor(k / n);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; const q = ii + jj * n; if (!free[q]) continue;
        if (a && b && (!free[i + a + j * n] || !free[i + (j + b) * n])) continue; const nd = d + cs * (a && b ? Math.SQRT2 : 1); if (nd < D[q]) { D[q] = nd; from[q] = k; push([nd, q]); } } } }
  const lineFree = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), m = Math.max(1, Math.ceil(L / (cs * .5))); for (let s = 1; s < m; s++) { const k = cell(p[0] + (q[0] - p[0]) * s / m, p[1] + (q[1] - p[1]) * s / m); if (k < 0 || !free[k]) return false; } return true; };
  // the nearest reached cell to a point (the door spot itself may sit in the clearance of the car beside it): within 0.6 m
  const near = (x, z) => { const k = cell(x, z); if (k < 0) return -1; if (D[k] < Infinity) return k; const i = k % n, j = Math.floor(k / n), r = Math.ceil(.6 / cs); let best = -1, bd = 1e9;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; const q = ii + jj * n; if (D[q] === Infinity) continue; const e = Math.hypot(cx(q) - x, cz(q) - z); if (e < bd && e <= .6) { bd = e; best = q; } } return best; };
  return { cs, free, solid, bad, cell,
    dist(x, z) { const k = near(x, z); return k < 0 ? Infinity : D[k] + Math.hypot(cx(k) - x, cz(k) - z); },
    path(x, z) { let k = near(x, z); if (k < 0) return null; const raw = [[x, z]]; while (k >= 0 && k !== ka) { raw.push([cx(k), cz(k)]); k = from[k]; } raw.push([A.x, A.z]); raw.reverse();
      const out = []; let a = raw[0]; for (let i = 1; i < raw.length; i++) { if (i === raw.length - 1 || !lineFree(a, raw[i + 1])) { out.push(raw[i]); a = raw[i]; } } return out; } };
}

// ── the stops along a lane: for each centre s, at the kerb (when a length of it is free) or double-parked (lat 0)
function kerbAt(C, O, x0, z0, nx, nz) { const pave = f => { const h = O.at(x0 + nx * f, z0 + nz * f); return h !== null && Math.abs(h - C.SIDE) < .07; }; for (let f = .6; f < 6.4; f += .05) if (pave(f) && pave(f + .25) && pave(f + .5)) return f; return null; }
// the cars of the traffic now (they move: never what makes ground solid) → masked(x, z)
function carMask(T, x, z, r) { const list = T.cars.filter(c => !c.stage && Math.abs(c.x - x) < r && Math.abs(c.z - z) < r); return (px, pz) => list.some(c => { const dx = px - c.x, dz = pz - c.z, s = Math.sin(c.h), k = Math.cos(c.h); return Math.abs(dx * s + dz * k) < c.len / 2 + .3 && Math.abs(dx * k - dz * s) < c.wid / 2 + .3; }); }
// anything over 0.35 m in a frame rectangle (not a traffic car) → false
function rectClear(O, cf, lx0, lx1, lz0, lz1, masked, top = .35) { for (let lz = lz0; lz <= lz1 + 1e-6; lz += .2) for (let lx = lx0; lx <= lx1 + 1e-6; lx += .2) { const [x, z] = cf.pt(lx, lz), h = O.at(x, z); if (h === null) return false; if (h > top && !masked(x, z)) return false; } return true; }
// the door's ground: the swing (1.1 m out from the hinge at the rear door's front edge), the suspect's and the cop's spots (0.45 m off,
// ±0.35) — and, for a stand-in cop, the front door's — clear of anything over 0.35 m and on standing ground (road or pavement)
function doorClear(C, O, cf, IN, standIn, masked) { const { dz } = doorSpots(cf, IN), z0 = dz - IN - .4, z1 = (standIn ? FZ1 : RZ1) + .2;
  if (!rectClear(O, cf, -HW - STOP.door, -HW - .08, z0, z1, masked)) return false;
  for (const lz of [dz, dz - IN, ...(standIn ? [(FZ0 + FZ1) / 2] : [])]) { const [x, z] = cf.pt(-HW - .45 - (standIn && lz > RZ1 ? .3 : 0), lz), h = O.at(x, z); if (h === null || h < -.15 || h > C.SIDE + .12) return false; }
  return true; }

export function planStop(C, A, { IN = 1.2, standIn = false, skip = [] } = {}) {
  const T = C.traffic(), t0 = performance.now(), why = { lanes: 0, cands: 0, door: 0, walk: 0, kerb: 0, double: 0 };
  if (!T?.lanes) return { plan: null, why: 'no-traffic', roadD: null };
  // the lanes in reach, with the suspect on their kerb side
  let roadD = Infinity; const cand = [];
  for (const L of T.lanes) { if (L.x0 === undefined || L.len < 8) continue; const px = A.x - L.x0, pz = A.z - L.z0, s = px * L.ux + pz * L.uz, nx = -L.uz, nz = L.ux, side = px * nx + pz * nz;
    const d = Math.hypot(Math.max(0, -s, s - L.len), side); roadD = Math.min(roadD, d); if (side < 1.2 || d > STOP.far) continue; cand.push({ L, s, side, nx, nz, d }); }
  if (!cand.length) return { plan: null, why: 'no-lane', roadD: +roadD.toFixed(1) };
  cand.sort((a, b) => a.d - b.d); const dmin = cand[0].d, far = dmin > STOP.reach - 6, R0 = far ? STOP.far : STOP.reach; why.lanes = cand.length;
  // the height map for the walk: round the suspect and the nearest lane, big enough for both
  const nb = cand[0], nL = nb.L, ns = Math.max(0, Math.min(nL.len, nb.s)), np = [nL.x0 + nL.ux * ns, nL.z0 + nL.uz * ns], mc = far ? [(A.x + np[0]) / 2, (A.z + np[1]) / 2] : [A.x, A.z];
  const half = far ? Math.min(40, Math.max(18, Math.hypot(np[0] - A.x, np[1] - A.z) / 2 + 12)) : 18, O = C.occ(mc[0], mc[1], half); if (!O) return { plan: null, why: 'no-map', roadD: +roadD.toFixed(1) };
  const W = walkField(C, O, A, T, skip), masked = carMask(T, mc[0], mc[1], half + 6), bodies = linkBodies(T, mc[0], mc[1], half + 4);
  const best = [];
  for (const { L, s: sp, nx, nz } of cand) { if (cand.length > 1 && !far && best.length && best[0].cost < 4) break;
    for (let k = 0; k < 40; k++) { const sc = Math.round((Math.max(3, Math.min(L.len - 2.5, sp + 1.3)) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * STOP.step) * 100) / 100; if (sc < 3 || sc > L.len - 2.5) continue;
      if (Math.abs(sc - sp) > R0) continue; const x0 = L.x0 + L.ux * sc, z0 = L.z0 + L.uz * sc; if (Math.abs(x0 - mc[0]) > half - 3 || Math.abs(z0 - mc[1]) > half - 3) continue; why.cands++;
      const base = { L, s: sc, x0, z0, ux: L.ux, uz: L.uz, nx, nz };
      // at the kerb, when a length of it is free
      const kf = kerbAt(C, O, x0, z0, nx, nz); let got = null;
      if (kf !== null) { const lat = Math.max(0, kf - HW - STOP.kerbGap), st = { ...base, lat, x: x0 + nx * lat, z: z0 + nz * lat }, cf = carFrame(st);
        if (rectClear(O, cf, -HW - .15, HW + .15, -HALF - .4, HALF + .4, masked) && doorClear(C, O, cf, IN, standIn, masked)) { why.kerb++;
          if (inTraffic(bodies, st, cf, lat - 2 * HW < STOP.outGap)) why.junction = (why.junction || 0) + 1;
          else got = { ...st, kind: 'kerb', kerb: kf, cf }; } }
      // double-parked in the travel lane, beside what stands at the kerb
      if (!got) { const st = { ...base, lat: 0, x: x0, z: z0 }, cf = carFrame(st);
        if (doorClear(C, O, cf, IN, standIn, masked)) { why.double++;
          if (inTraffic(bodies, st, cf, true)) why.junction = (why.junction || 0) + 1;
          else got = { ...st, kind: 'double', cf }; } else why.door++; }
      if (!got) continue; const { DS } = doorSpots(got.cf, IN), wd = W.dist(DS[0], DS[1]); if (!(wd < Infinity) || wd > R0) { why.walk++; continue; }
      got.walkLen = wd; got.cost = wd + (got.kind === 'double' ? STOP.dpCost : 0) + Math.abs(sc - sp) * .05; best.push(got); best.sort((a, b) => a.cost - b.cost); if (best.length > 6) best.length = 6; } }
  // the best few, checked again on a fine height map there (the kerb's exact edge, the door's ground)
  for (const b of best) { const Of = C.occ(b.x0 + b.nx * 2.4, b.z0 + b.nz * 2.4, 4.6); if (!Of) continue; const mf = carMask(T, b.x0, b.z0, 10);
    let st = b; if (b.kind === 'kerb') { const kf = kerbAt(C, Of, b.x0, b.z0, b.nx, b.nz) ?? b.kerb, lat = Math.max(0, kf - HW - STOP.kerbGap); st = { ...b, kerb: kf, lat, x: b.x0 + b.nx * lat, z: b.z0 + b.nz * lat }; st.cf = carFrame(st);
      if (!rectClear(Of, st.cf, -HW - .1, HW + .1, -HALF - .3, HALF + .3, mf)) continue; }
    if (!doorClear(C, Of, st.cf, IN, standIn, mf)) continue;
    const { DS } = doorSpots(st.cf, IN), path = W.path(DS[0], DS[1]); if (!path) continue;
    st.walk = path; st.out = st.kind === 'kerb' && st.lat - 2 * HW >= STOP.outGap; st.ave = isAve(st.L.axis, st.L.L); delete st.cf;
    return { plan: st, why, roadD: +roadD.toFixed(1), ms: +(performance.now() - t0).toFixed(1) }; }
  return { plan: null, why, roadD: +roadD.toFixed(1), ms: +(performance.now() - t0).toFixed(1) };
}

// ── THE DRIVE: the cruiser as a car of the traffic. links: back from the stop's lane (straight on where it can) until 30 m and a start
// out of view; on past it 120 m. → { c, step(dt) → the model's pose, …} or null (no way in: the caller drives it the old way)
export function driveCar(C, plan) {
  const T = C.traffic(); if (!T?.spawnRoute) return null; const L = plan.L, sStop = plan.s + HALF;
  const ahead = [L]; { let cur = L, d = L.len - sStop; for (let k = 0; k < 8 && d < 120; k++) { const cn = cur.next.find(q => q.turn === 'S') || cur.next[0]; if (!cn) break; ahead.push(cn, cn.out); d += cn.len + cn.out.len; cur = cn.out; } }
  const P = [0, 0, 0], seen = (Lk, s) => { T.poseOn(Lk, Math.max(0, Math.min(Lk.len, s)), P); return C.inView(P[0], P[1]) || C.inView(P[0] - Math.sin(P[2]) * 4.4, P[1] - Math.cos(P[2]) * 4.4); };
  // back: the spawn on the first link out of view, the lane clear there
  // (d: from the start of `cur` to the stop; a spawn at s on it is d − s from the stop: 25 m at least, out of view, its lane clear there)
  const back = []; let cur = L, d = sStop, start = null;
  for (let k = 0; k < 10 && !start; k++) {
    for (let s = Math.min(cur.len - 1, d - 25); s >= 6; s -= 3) { if (seen(cur, s)) continue; if (cur.cars.some(q => q.s > s - 2 * HALF - 4 && q.s - q.len < s + 6)) continue; start = { L: cur, s }; break; }
    if (start || d > 160) break; const f = cur.feeds.filter(q => !q.inL.dead), fb = f.find(q => q.turn === 'S') || f[0]; if (!fb) break;
    back.unshift(fb.inL, fb); d += fb.len + fb.inL.len; cur = fb.inL; }
  if (!start) return null;
  const links = [...back, ...ahead]; if (start.L !== links[0]) return null;
  const iStop = links.indexOf(L), ctl = { hold: true };
  const c = T.spawnRoute(links, start.s, { kind: 'patrol', stage: true, len: 2 * HALF, wid: 2 * HW, model: -1, v: Math.min(10, L.v0 || 10), stops: [{ i: iStop, s: sStop, go: () => !ctl.hold }] });
  if (!c) return null;
  const pose = { x: c.x, z: c.z, h: c.h, lat: 0 }; let last = null, out = false, base = null;   // (base: its lane pose when it left the lane)
  Object.assign(ctl, { c, sStop, pose, links,
    // where the model is this frame: the sim car's pose, eased to the kerb at a kerb stop (the last 6 m in, the first 10 m out)
    step() { if (c.gone) return pose; let lat = 0;
      if (c.kin) lat = plan.lat; else if (plan.lat > 0 && c.L === L) { const g = sStop - c.s; lat = g >= 0 ? plan.lat * smooth(1 - g / 6) : plan.lat * (1 - smooth(-g / 10)); }
      const nx = plan.nx, nz = plan.nz, bx = c.kin && base ? base[0] : c.x, bz = c.kin && base ? base[1] : c.z; pose.x = bx + nx * lat; pose.z = bz + nz * lat; pose.h = c.h; pose.ds = last ? Math.hypot(pose.x - last[0], pose.z - last[1]) : 0; last = [pose.x, pose.z]; pose.lat = lat;
      if (c.kin) { c.x = pose.x; c.z = pose.z; }   // (out of its lane at the kerb: the overlap counter sees it where it is drawn)
      return pose; },
    stopped: () => !c.gone && (c.kin || (c.L === L && Math.abs(sStop - c.s) < .9 && c.v < .05)),
    // at the kerb: out of the lane once stopped (and only where it clears the lane)
    park() { if (plan.out && !out && ctl.stopped()) { base = [c.x, c.z]; T.stageOut(c); out = true; } },
    // away: back into the lane when nothing is coming (→ true once on its way)
    go(wait = 0) { if (c.gone) return true; if (c.kin && !T.stageIn(c, wait > 6)) return false; ctl.hold = false; return true; },
    drop() { if (!c.gone) T.dropCar(c); } });
  return ctl;
}
// a walk from where the suspect stands now to the door spot (the cruiser's body solid in it): [[x, z] …] or null
export function walkTo(C, A, to, cf = null, skip = []) { const T = C.traffic(); if (!T?.links) return null; const mx = (A.x + to[0]) / 2, mz = (A.z + to[1]) / 2, half = Math.min(40, Math.max(10, Math.hypot(to[0] - A.x, to[1] - A.z) / 2 + 8)), O = C.occ(mx, mz, half); if (!O) return null;
  if (cf) { const at = O.at.bind(O), H = O.H, n = O.n, cs = 2 * O.half / n; for (let k = 0; k < n * n; k++) { const x = O.cx - O.half + ((k % n) + .5) * cs, z = O.cz + O.half - (Math.floor(k / n) + .5) * cs, [lx, lz] = cf.local(x, z); if (Math.abs(lx) < HW + .05 && Math.abs(lz) < HALF + .1) H[k] = 2; } }
  return walkField(C, O, A, T, skip).path(to[0], to[1]); }
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// the probe's count: traffic cars whose bodies overlap the cruiser's as drawn (5 cm in from each side, as the traffic's own counter)
export function carsThrough(T, R, self) { if (!T) return []; const me = { x: R.position.x, z: R.position.z, h: R.rotation.y, len: 2 * HALF - .1, wid: 2 * HW - .1 }, hit = [];
  for (const q of T.cars) { if (q === self || q.gone || Math.abs(q.x - me.x) > 9 || Math.abs(q.z - me.z) > 9) continue; if (sepRect(me, { x: q.x, z: q.z, h: q.h, len: q.len - .1, wid: q.wid - .1 }) < 0) hit.push(q); } return hit; }
// (debug: the walk field round a point as text rows: '#' solid, '~' a traffic link, '.' free, 'o' reached, 'A' the suspect)
export function _walkDbg(C, A, cx, cz, half) { const T = C.traffic(), O = C.occ(cx, cz, half), W = walkField(C, O, A, T), n = O.n, rows = [];
  for (let j = 0; j < n; j++) { let r = ''; for (let i = 0; i < n; i++) { const k = i + j * n, x = O.cx - O.half + (i + .5) * W.cs, z = O.cz + O.half - (j + .5) * W.cs;
    r += k === W.cell(A.x, A.z) ? 'A' : W.solid[k] ? '#' : W.bad[k] ? '~' : W.dist(x, z) < Infinity ? 'o' : W.free[k] ? '.' : ','; } rows.push(r); } return rows; }
