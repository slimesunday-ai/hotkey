// CAB TRAFFIC (2026-10-10, slime: "cabs can arrive when they arrive like normal traffic") · A CAB IS A CAR OF THE TRAFFIC.
// It replaces the TAXI CLOCK (2026-10-09), whose cab was a pure function of its booking: placed by its clock, never waiting at a red —
// every signalled junction on its way was given to it (rules.js CABWIN), the cars ahead of it were escorted off its way or nudged on, the
// unseen ones cleared. The pilot (the 10-09 pilot; a local archive, not in this repository) measured what that cost: 10–13 s of WALK at 4,0 and
// 7–17 s at 5,0 per ride, car–car overlaps under the escort. Now the cab's ONE advantage is in the sim (a WANTED rider skips the station
// cops); in the street it is an ordinary car: traffic/sim.js's IDM, the lights, the box, the zebras, the car ahead (a route car with
// asCar: no priority asked, never another way off its route), the average driver (the street's speed, CAR's a and T).
//   the booking  the sim books the ride as this car alone through the fixed-time lights from its departure second (world/export/travel.mjs
//                carDrive, the same code that plans the approach here); the signal clock is the movement's (traffic/fleet.js lockClock),
//                so a car alone keeps it. The rest of the traffic doesn't: cars queued ahead, walkers in the road, a box held — the cab is
//                late (or early) by that much, the residual (tools/cabresidual.mjs). A late cab makes its rider late (movement.js R.delay).
//   the approach planned so a car alone is at rest at the pickup CAB.in s before the booked departure (in a bay: pulled in by then):
//                it comes into the street CAB.back m or more up its way, moving, at the second carDrive gives (the latest that is in time,
//                over a few start points: the one that is there soonest before it), where nothing stands in its body's way and nothing
//                behind it can't stop for it (else a beat later or nearer the kerb: late). Planned for a ride already under way (a page
//                that joins, a seek), it comes in where carDrive has it now.
//   the kerb     a kerb hail and a stand without bays (JAY ST: the travel lane's side of a one-way): it stops in its lane at the kerb point
//                (the cars behind wait, as for a stopped car), the rider gets in, it leaves at the booked departure or as soon as the rider
//                is in. A STAND WITH BAYS (transitnet.js TAXI_KERB, the export's stops[].slots): it stops beside the first free bay, pulls in
//                out of the travel lane (CAB.pull s, kin: posed here; out of the lane's list once its body is in the bay), and pulls back out
//                when the rider is in and the lane can take it (traffic/sim.js kerbBack: stageIn's gap). Bays are claimed per ride: a
//                second ride's cab takes the next one, never the first's body.
//   the drop     it stops in its lane at the drop kerb, stands while the rider gets out (+ CAB.outStand s), then its route is over: an
//                ordinary car from there (sim.js release), dropped by the population once unseen. No cab outlives its ride (audit F10).
// Node- and worker-safe.
import { carDrive } from '../../../world/export/travel.mjs';
import { decodePath } from './fleet.js';
import { CAR } from './sim.js';
import { cycleOf, TIMING } from './rules.js';

export const CAB = {
  len: 4.4, wid: 1.8,          // the taxi's body (the traffic's taxi model; MODELS.size gives the real one)
  back: 42,                    // m (at least) up its way behind the pickup the cab comes into the street
  lead: 90,                    // m of way behind the pickup it may come in from
  in: 4.5,                     // s before the booked departure the cab is due at rest at the kerb (the rider's steps to the door + car_get_in)
  pull: 1.6,                   // s to pull into a stand's kerb bay, and back out (the export's modes.taxi.drive.pull: the booking counts the pull out)
  outStand: .8,                // s it stands at the drop after its rider is out before it drives on
  relMax: 90,                  // s past its booked arrival it is let go whatever (its route given up: an ordinary car)
  dv: 1,                       // the driver: the street's speed × dv, CAR's a and T (the ambient drivers vary ±12 %, ±20 %: the cab is the average one)
  vIn: .8,                     // × its lane's speed, the speed it comes into the street at
  early: 6, near: 18,          // s early at the kerb from CAB.back m out that sends the planner nearer the kerb; m from the kerb it never comes in nearer than
};
import { GAME_MIN } from '../simstate/simclock.js';
const BAYS = new Map();        // stand id → [cab | null per bay] (claimed per ride: the old clock put a second ride's cab inside the first)

// ── the cab's way: the ride's decoded links (fleet.js decodePath) with the approach's links in front → { links, c0 (arc length at each
// link's start), len, iPick, dPick, dDrop, d0 }
export function cabChain(ch) {
  const pre = []; let L = ch.links[0], s = ch.at[0].s - CAB.lead, guard = 0;
  while (s < 0 && guard++ < 8) { const f = (L.feeds || []).find(f => f.turn === 'S' && !f.inL.dead) || (L.feeds || []).find(f => !f.inL.dead);
    if (!f || pre.includes(f.inL) || ch.links.includes(f.inL)) break; pre.unshift(f.inL, f); s += f.len + f.inL.len; L = f.inL; }
  const links = [...pre, ...ch.links], c0 = []; let d = 0; for (const l of links) { c0.push(d); d += l.len; }
  const n = pre.length, last = ch.at[ch.at.length - 1];
  return { links, c0, len: d, iPick: n, dPick: c0[n] + ch.at[0].s, dDrop: c0[n + last.i] + last.s, d0: Math.max(0, c0[0] + Math.max(0, s)) };
}
// the chain's links as travel.mjs carDrive reads them (the export's graph.road records, from the city's own links: the same numbers)
const ARMNS = a => a === 'N' || a === 'S';
export function linkRecs(TS, links) { return links.map(L => { if (L.kind === 'lane') { const n = L.to, sig = !!n.sig, q = sig ? cycleOf(n.Lx, n.Lz) : null;
    return { kind: 'lane', len: L.len, v0: L.v0, sig, ns: L.axis === 'x', cyc: q ? [q.gNS, q.gEW, q.offset] : null }; }
  const band = b => b ? { s0: b.s0, s1: b.s1, ns: ARMNS(b.arm), walk: TS.walkAt ? TS.walkAt(b.key) : false } : null, bIn = band(L.bIn), bOut = band(L.bOut);
  return { kind: 'conn', len: L.len, v0: L.v0, turn: L.turn !== 'S', bIn, bOut, bands: [bIn, bOut].filter(Boolean) }; }); }
export const carOf = () => ({ a: CAR.a, b: CAR.b, s0: CAR.s0, T: CAR.T, dv: CAB.dv, bStop: CAR.bStop, bMax: CAR.bMax, turnBrake: 1.2, len: CAB.len, body: 4.7 });
const SIG = () => ({ yellow: TIMING.yellow, allRed: TIMING.allRed, flash: TIMING.flash });
// the chain from link i at s to link j at s1 (a stop), as carDrive runs it: { links, s0, s1 }
const sub = (R, i, s, j, s1) => ({ links: R.slice(i, j + 1), s0: s, s1 });
const idxAt = (C, d) => { let lo = 0, hi = C.c0.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (C.c0[m] <= d) lo = m; else hi = m - 1; } return lo; };

// ── A CAB'S PLAN, from its booking: the bay (a stand's), the approach (where and when it comes into the street), the booked seconds
//   → { C, R (link records), bay, dPick (its nose's stop for the pickup), dSpawn, vSpawn, tSpawn, tPick, tDep, tArr, tOut, tStop, out }
export function planCab(TS, ch, leg, o = {}) {
  const C = cabChain(ch), R = linkRecs(TS, C.links), car = carOf(), sig = SIG(), out = o.out ?? 3, tDep = leg.dep * GAME_MIN, tArr = leg.arr * GAME_MIN;
  // the bay: a stand's first free one on the pickup lane, its nose at the bay's front (the export boards a stand at its first bay)
  let bay = null, dPick = C.dPick; const st = o.stand;
  if (st?.slots?.length) { const L = C.links[C.iPick], taken = BAYS.get(st.id) || [];
    for (let k = 0; k < st.slots.length; k++) { if (taken[k] && !taken[k].done) continue; const [bx, bz] = st.slots[k], u = (bx - L.x0) * L.ux + (bz - L.z0) * L.uz, sN = u + CAB.len / 2;
      if (sN < CAB.len + .5 || sN > L.len - .5) continue; bay = { id: st.id, k, x: bx, z: bz, sN }; dPick = C.c0[C.iPick] + sN; break; } }
  const tPick = tDep - CAB.in - (bay ? CAB.pull : 0), iP = idxAt(C, dPick - 1e-6), sP = dPick - C.c0[iP];
  // the drop: where the rider's door is (o.dropTo: the walk on from the drop — movement.js) on the drop lane's right, and that lane has a
  // kerb lane there (traffic/sim.js L.kerb: an avenue's, a one-way's parking side), the cab pulls in to the kerb to let them out (sync)
  const iD = idxAt(C, C.dDrop - 1e-6), LD = C.links[iD], sD = C.dDrop - C.c0[iD], dropKerb = LD.kind === 'lane' && LD.kerb > 0 && o.dropTo &&
    (o.dropTo[0] - LD.x0 - LD.ux * sD) * -LD.uz + (o.dropTo[1] - LD.z0 - LD.uz * sD) * LD.ux > .3 ? LD.kerb : 0;
  // the approach: from each start point (CAB.back m behind the pickup, then 8 m steps back to the chain's start), the latest second that
  // brings a car alone to rest at the pickup by tPick (binary search: a later start never arrives sooner), and of those the start that
  // arrives soonest before tPick
  let best = null;
  const tryFrom = (dA, dB) => { for (let d = dA; d >= C.d0 - 1e-6 && d >= dB; d -= 4) { const i = idxAt(C, d), L = C.links[i]; if (L.kind !== 'lane') continue;
    const s = d - C.c0[i], v = L.v0 * CAB.dv * CAB.vIn, q = sub(R, i, s, iP, sP), arr = t => t + carDrive(q.links, { s0: q.s0, s1: q.s1, t0: t, v, car, sig, step: .1 }).T;
    let lo = tPick - 150, hi = tPick; if (arr(lo) > tPick) continue; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (arr(m) <= tPick) lo = m; else hi = m; }
    const a = arr(lo); if (!best || a > best.arr + .05) best = { d, i, s, v, t: lo, arr: a }; } };
  tryFrom(dPick - CAB.back, dPick - CAB.lead);
  // (behind a red the latest start in time can be half a cycle early — a cab standing in the lane at the kerb that long holds the traffic
  // behind it: then a start nearer the kerb, past the junction, if one comes closer — never within CAB.near m of it)
  if (!best || best.arr < tPick - CAB.early) tryFrom(dPick - CAB.near, dPick - CAB.back + 1);
  if (!best) best = { d: dPick - Math.min(sP, 20), i: iP, s: Math.max(0, sP - 20), v: 0, t: tPick - 12, arr: tPick };   // (no start point that makes it: its own lane, 20 m back, 12 s early)
  return { C, R, car, sig, bay, dPick, iP, sP, iD, sD, dropKerb, dSpawn: best.d, iSpawn: best.i, sSpawn: best.s, vSpawn: best.v, tSpawn: best.t, tPickPlan: best.arr, tPick, tDep, tArr, tOut: tArr - out, tStop: tArr - out, out, tRel: tArr };
}
// where carDrive has the cab at the second `now` (a ride already under way when it was planned): → { i (chain index), s, v } or null
function trackAt(P, now) {
  if (now <= P.tSpawn) return null;
  if (now < P.tDep) { const q = sub(P.R, P.iSpawn, P.sSpawn, P.iP, P.sP), r = carDrive(q.links, { s0: q.s0, s1: q.s1, t0: P.tSpawn, v: P.vSpawn, car: P.car, sig: P.sig, step: .1, until: now });
    return r.at ? { i: P.iSpawn + r.at.i, s: r.at.s, v: r.at.v } : { i: P.iP, s: P.sP, v: 0 }; }
  const C = P.C, iD = idxAt(C, C.dDrop - 1e-6), q = sub(P.R, P.iP, P.sP, iD, C.dDrop - C.c0[iD]), t0 = P.tDep + (P.bay ? CAB.pull : 0);
  if (now <= t0) return { i: P.iP, s: P.sP, v: 0 };
  const r = carDrive(q.links, { s0: q.s0, s1: q.s1, t0, v: 0, car: P.car, sig: P.sig, step: .1, until: now });
  return r.at ? { i: P.iP + r.at.i, s: r.at.s, v: r.at.v } : { i: iD, s: C.dDrop - C.c0[iD], v: 0 };
}

// ── THE CABS, live (traffic/fleet.js createFleet keeps them; sync at the top of every traffic step):
//   add(leg, { model, size, out, stand }) → a cab planned from its booking (null: its path doesn't decode)
//   sync(nowR) — comes into the street at its second, the bays' pulls, the drop, the release; cancel(cab) — out of the street at once
//   atKerb(cab), atDrop(cab) — where the rider's steps read it (movement.js)
export function createCabs(TS) {
  const list = new Map(); let seq = 0, nowR = 0;
  const S = { planned: 0, live: 0, released: 0, cancelled: 0, waitedIn: 0, spawnLateS: 0, joined: 0, bays: 0, pulls: 0, pullWaits: 0, given: 0, dropPulls: 0, dropGap: 0, dropLane: 0, bails: 0, ms: 0, msMax: 0 };
  function add(leg, o = {}) { const t0 = typeof performance !== 'undefined' ? performance.now() : 0, ch = decodePath(TS, leg.path); if (!ch) return null;
    const P = planCab(TS, ch, leg, o), [len, wid, r] = o.size || [CAB.len, CAB.wid, .34];
    const cab = { id: ++seq, P, C: P.C, model: o.model, len, wid, r, c: null, rider: null, empty: false, picked: false, inside: false, out: false, dNow: P.dSpawn, i: P.iSpawn, phase: 'due', seenT: null };
    if (P.bay) { const a = BAYS.get(P.bay.id) || []; a[P.bay.k] = cab; BAYS.set(P.bay.id, a); S.bays++; }
    list.set(cab.id, cab); S.planned++; const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0; S.ms = ms; S.msMax = Math.max(S.msMax, ms); return cab; }
  function cleanup(cab) { if (cab.c) cab.c.cab = null; list.delete(cab.id); cab.done = true; if (cab.P.bay) { const a = BAYS.get(cab.P.bay.id); if (a?.[cab.P.bay.k] === cab) a[cab.P.bay.k] = null; } }
  function cancel(cab) { if (cab.done) return; if (cab.c && !cab.c.gone) TS.dropAny(cab.c); cab.c = null; cab.rider = null; cleanup(cab); S.cancelled++; }
  // let it go as an ordinary car where it is (out of a bay first: kerbBack, else it waits)
  function release(cab) { const c = cab.c; if (c && !c.gone) { if (cab.phase === 'bay' || cab.phase === 'in' || cab.phase === 'dropIn' || cab.phase === 'dropBay') { cab.leaving = true; return false; } if (c.route) TS.release(c); }
    cab.rider = null; cleanup(cab); S.released++; return true; }
  // room for its body at chain index i, s: no body on its lane over it or within a gap ahead, nothing behind that couldn't stop short of it
  // (on its lane and the links before it, 40 m), and nothing standing on a connector it would come in beside
  function roomAt(cab, i, s, v) { const C = cab.C, d = C.c0[i] + s, len = cab.len;
    for (let j = Math.max(0, i - 3); j < C.links.length && C.c0[j] < d + 30; j++) for (const q of C.links[j].cars) { const x = C.c0[j] + q.s;
      if (x > d) { if (x - q.len - d < 2) return false; } else if (d - len - x < Math.max(2, Math.max(0, q.v * q.v - v * v) / (2 * 5) + 1.5)) return false; }
    const L = C.links[i]; if (L.kind === 'lane' && s < len + 1) for (const f of L.feeds) if (f.cars.length) return false;
    // (and no body at all — a car on any link, one turning off this lane with its rear still on it, a kin car — over its body, 1 m behind it
    // and 2.5 m ahead of it: the residual check put a joining cab down on the rear of a car turning off its lane, 2.6 m deep)
    if (L.kind === 'lane') { const ux = L.ux, uz = L.uz, k = s - len / 2 + .75, B = { x: L.x0 + ux * k, z: L.z0 + uz * k, h: Math.atan2(ux, uz), len: len + 3.5, wid: cab.wid + .4 };
      for (const q of TS.cars) if (!q.gone && Math.abs(q.x - B.x) < 12 && Math.abs(q.z - B.z) < 12 && overlap(B, q)) return false; }
    return true; }
  const overlap = (A, B) => { const ax = [[Math.sin(A.h), Math.cos(A.h)], [Math.cos(A.h), -Math.sin(A.h)], [Math.sin(B.h), Math.cos(B.h)], [Math.cos(B.h), -Math.sin(B.h)]], dx = B.x - A.x, dz = B.z - A.z;
    const ext = (Q, u) => Q.len / 2 * Math.abs(Math.sin(Q.h) * u[0] + Math.cos(Q.h) * u[1]) + Q.wid / 2 * Math.abs(Math.cos(Q.h) * u[0] - Math.sin(Q.h) * u[1]);
    for (const u of ax) if (Math.abs(dx * u[0] + dz * u[1]) > ext(A, u) + ext(B, u)) return false; return true; };
  function spawn(cab, i, s, v) { const C = cab.C, P = cab.P, links = C.links.slice(i), iPick = P.iP - i, iDrop = idxAt(C, C.dDrop - 1e-6) - i;
    const stops = []; if (iPick >= 0 && !cab.picked) stops.push({ i: iPick, s: P.sP, go: c => goPick(cab, c) }); stops.push({ i: iDrop, s: C.dDrop - C.c0[iDrop + i], go: c => goDrop(cab, c) });
    const c = TS.spawnRoute(links, s, { kind: 'cab', asCar: true, dv: CAB.dv, model: cab.model, len: cab.len, wid: cab.wid, r: cab.r, v, stops }); if (!c) return null;
    c.cab = cab; cab.c = c; cab.base = i; S.live++; return c; }
  // ── the pickup and the drop: route stops (traffic/sim.js asks go(c) each step while the car stands at its stop)
  function goPick(cab, c) { if (cab.empty) return true;   // (its rider left before it came: it drives on)
    if (cab.P.bay && cab.phase !== 'out') { if (cab.phase === 'road' && cab.P.dPick - cab.dNow > 1.2) return false;   // (held short of its bay by the car ahead — a queue at the red: it waits in the lane for its bay's point, never slides in on a diagonal)
      if (cab.phase === 'road') { cab.phase = 'in'; cab.slide = { t0: nowR, from: [c.x, c.z, c.h] }; TS.kerbIn(c); S.pulls++; } return false; }
    cab.atPick = true; if (cab.inside && nowR >= cab.P.tDep - .05) { cab.picked = true; cab.atPick = false; return true; } return false; }
  function goDrop(cab, c) { if (cab.dropBay && cab.rider && !cab.out) { if (cab.P.C.c0[cab.P.iD] + cab.dropBay.sN - cab.dNow > 1.2) return false;   // (held short of its spot by the car ahead: it waits in the lane, never slides in on a diagonal)
    if (cab.phase !== 'dropIn' && cab.phase !== 'dropBay') { cab.phase = 'dropIn'; cab.slide = { t0: nowR, from: [c.x, c.z, c.h], to: cab.dropBay }; TS.kerbIn(c); S.dropPulls++; } return false; }
    cab.atDropNow = true; cab.tStop ??= nowR; if (cab.rider && !cab.out) return false; cab.outT ??= nowR; if (nowR < cab.outT + CAB.outStand) return false; cab.atDropNow = false; cab.dropped = true; return true; }
  // a bay's pull, in or out: the body slides across from the lane's line to the bay's and back, turning into it and straightening
  const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  function poseSlide(cab, c, u, dir) { const [lx, lz, h] = cab.slide.from, B = cab.slide.to || cab.P.bay, fx = Math.sin(h), fz = Math.cos(h), w = Math.min(1, Math.max(0, u)), k = dir === 'in' ? ease(w) : 1 - ease(w);
    const right = Math.sign((B.z - lz) * fx - (B.x - lx) * fz) || 1, turn = (dir === 'in' ? -right : right) * .22 * Math.sin(Math.PI * w), yaw = h + turn;   // (a right turn lowers the heading: forward = (sin h, cos h), +x east, +z south)
    c.x = lx + (B.x - lx) * k; c.z = lz + (B.z - lz) * k; c.dh = yaw - c.h; c.h = yaw; c.steer = (dir === 'in' ? -right : right) * .35 * Math.cos(Math.PI * w); c.v = w < 1 ? .9 : 0; c.acc = 0; c.brake = w >= 1; }
  function sync(now) { nowR = now;
    for (const cab of [...list.values()]) { const P = cab.P, c = cab.c && !cab.c.gone ? cab.c : null;
      const back = cab.seenT != null && now < cab.seenT - .5; cab.seenT = now;   // (the clock went back: a seek, a loop)
      if (!cab.rider && !cab.inside && (back || (!c && now < P.tSpawn - 60))) { cancel(cab); continue; }   // (riderless, and its clock went back: the backstop)
      if (cab.c && cab.c.gone) { cab.c = null; cleanup(cab); continue; }   // (dropped under it: a camera jump's re-seed)
      // not in the street yet: at its second (or later: where carDrive has it now), where there is room
      if (!c) { if (cab.empty && !cab.picked) { cleanup(cab); S.cancelled++; continue; }
        if (now < P.tSpawn) continue;
        let at = { i: P.iSpawn, s: P.sSpawn, v: P.vSpawn }; if (now > P.tSpawn + 1) { const tr = trackAt(P, now); if (tr) { at = tr; if (now >= P.tDep && !cab.joinedRide) { cab.joinedRide = true; cab.picked = true; } } }
        if (now > P.tSpawn + 1 && !cab.joined) { cab.joined = true; S.joined++; }
        while (at.i < P.C.links.length && P.C.links[at.i].kind !== 'lane') { at = { i: at.i + 1, s: 0, v: at.v }; }   // (never put down mid-junction: on the lane after it)
        const cands = [at]; for (let k = 1; k <= 4; k++) { const d = P.C.c0[at.i] + at.s + 6 * k, i = idxAt(P.C, d); if (cab.picked || d > P.dPick - 14) break; if (P.C.links[i].kind === 'lane') cands.push({ i, s: d - P.C.c0[i], v: at.v }); }   // (blocked: nearer the kerb, the lateness made up a little, never within 14 m of it)
        let made = null; for (const q of cands) if (roomAt(cab, q.i, q.s, q.v) && (made = spawn(cab, q.i, q.s, q.v))) break;
        if (!made) { S.waitedIn++; continue; }
        S.spawnLateS += Math.max(0, now - P.tSpawn); cab.phase = cab.picked ? 'ride' : 'road'; if (cab.picked) { cab.inside = true; } continue; }
      // in the street: where it is along its way
      if (c.L) { const C = P.C; let i = cab.base + (c.route ? c.route.i : 0); if (C.links[i] !== c.L) { i = C.links.indexOf(c.L, Math.max(0, cab.i - 1)); if (i < 0) i = cab.i; } cab.i = i; cab.dNow = C.c0[i] + c.s; }
      // a bay: pulling in, standing in it, pulling out
      // the drop at the kerb: two links before the drop lane its spot is picked — the kerb lane beside the booked drop, or the nearest free
      // stretch of it up to 10 m back and 6 m on, clear of any car standing in the road (TS.parkedIn: the page's anchors) and any car
      // pulled in (a stand's cab, the stage's cruiser) — and the drop stop moves to it; none free: the drop is in the lane, as before
      if (P.dropKerb && !cab.dropChosen && cab.rider && cab.picked && c.route && cab.i >= P.iD - 2) { cab.dropChosen = true; const B = dropSpot(cab); if (B) { if (!B.lane) cab.dropBay = B; else S.dropGap++; const st = c.route.stops.find(q => q.i === P.iD - cab.base); if (st) st.s = B.sN; } else S.dropLane++; }
      if (cab.phase === 'dropIn') { const u = (now - cab.slide.t0) / CAB.pull; poseSlide(cab, c, u, 'in'); if (u >= 1) { TS.kerbOff(c); cab.phase = 'dropBay'; cab.bayT = now; } continue; }
      if (cab.phase === 'dropBay') { if (!cab.rider || cab.out) { cab.outT ??= now; if (now >= cab.outT + CAB.outStand) { if (TS.kerbBack(c, now - cab.outT > 20)) { cab.phase = 'dropOut'; cab.slide.t0 = now; } else S.pullWaits++; } } continue; }
      if (cab.phase === 'dropOut') { const u = (now - cab.slide.t0) / CAB.pull; poseSlide(cab, c, u, 'out'); if (u >= 1) { cab.phase = 'dropped'; TS.kerbGo(c); const st = c.route?.stops.find(q => q.i === P.iD - cab.base); if (st) c.route.stops.splice(c.route.stops.indexOf(st), 1); release(cab); } continue; }
      // a rider getting out where the cab stands (movement.js: far past the booking, the cab stopped in a jam): held there, then let go
      if (cab.phase === 'bail') { if (cab.out || !cab.rider) { TS.kerbGo(c); release(cab); } continue; }
      if (cab.phase === 'in') { const u = (now - cab.slide.t0) / CAB.pull; poseSlide(cab, c, u, 'in'); if (u >= 1) { TS.kerbOff(c); cab.phase = 'bay'; cab.bayT = now; } continue; }
      if (cab.phase === 'bay') { if ((cab.inside && now >= P.tDep - .05) || cab.empty || cab.leaving) { if (TS.kerbBack(c, now - Math.max(cab.bayT, P.tDep) > 20)) { cab.phase = 'outPull'; cab.slide.t0 = now; } else S.pullWaits++; } continue; }
      if (cab.phase === 'outPull') { const u = (now - cab.slide.t0) / CAB.pull; poseSlide(cab, c, u, 'out'); if (u >= 1) { cab.phase = 'out'; if (!cab.empty) cab.picked = true; TS.kerbGo(c); if (c.route?.stops[0]?.i === P.iP - cab.base) c.route.stops.shift(); if (cab.empty || cab.leaving) release(cab); } continue; }
      if (cab.leaving) { if (release(cab)) continue; }
      // the ride over: its route ended at the drop (sim.js release: an ordinary car now), or given up past CAB.relMax
      if (!c.route) { cleanup(cab); S.released++; continue; }
      if (now > P.tArr + CAB.relMax && (!cab.rider || now > P.tArr + 3 * CAB.relMax)) { S.given++; release(cab); continue; }   // (and whatever after 3 × that: no cab outlives its ride)
      if (cab.empty && !cab.picked && cab.phase === 'road') { release(cab); continue; } }
  }
  function dropSpot(cab) { const P = cab.P, LD = P.C.links[P.iD], kb = P.dropKerb, rx = -LD.uz, rz = LD.ux, len = cab.len, hx = Math.abs(LD.ux) * (len / 2 + .3) + Math.abs(LD.uz) * (cab.wid / 2 + .1), hz = Math.abs(LD.uz) * (len / 2 + .3) + Math.abs(LD.ux) * (cab.wid / 2 + .1);
    for (const ds of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, -8, -9, -10]) { const sN = P.sD + ds; if (sN < len + 1.5 || sN > LD.len - 3) continue;   // (its nose 3 m short of the lane's end: pulling out it swings, and past the end is the junction)
      const sc = sN - len / 2, cx = LD.x0 + LD.ux * sc + rx * kb, cz = LD.z0 + LD.uz * sc + rz * kb;
      if (TS.parkedIn?.(cx - hx, cz - hz, cx + hx, cz + hz)) continue;
      if (TS.cars.some(q => q.kin && !q.gone && Math.abs(q.x - cx) < hx + q.len / 2 && Math.abs(q.z - cz) < hz + q.len / 2)) continue;
      if ([...list.values()].some(o => o !== cab && o.dropBay && !o.done && Math.abs(o.dropBay.x - cx) < 2 * hx && Math.abs(o.dropBay.z - cz) < 2 * hz)) continue;   // (another cab's spot, claimed)
      return { x: cx, z: cz, sN }; }
    // (no free stretch of kerb: a stop in the lane where the rider's door faces a GAP between the cars standing at the kerb — the door is
    // 0.3 m behind the body's middle — so they step out to the sidewalk through it, never beside a parked car)
    for (const ds of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, -8, -9, -10]) { const sN = P.sD + ds; if (sN < len + 1.5 || sN > LD.len - 1.5) continue;
      const sd = sN - len / 2 - .3, cx = LD.x0 + LD.ux * sd + rx * kb, cz = LD.z0 + LD.uz * sd + rz * kb, gx = Math.abs(LD.ux) * .7 + Math.abs(LD.uz) * (cab.wid / 2 + .2), gz = Math.abs(LD.uz) * .7 + Math.abs(LD.ux) * (cab.wid / 2 + .2);
      if (TS.parkedIn?.(cx - gx, cz - gz, cx + gx, cz + gz)) continue;
      if (TS.cars.some(q => q.kin && !q.gone && Math.abs(q.x - cx) < gx + q.len / 2 && Math.abs(q.z - cz) < gz + q.len / 2)) continue;
      return { lane: true, sN }; }
    return null; }
  // the cab's own way on, ALONE: s from now to its rider on the kerb (carDrive from where it is, + getting out, + a kerb pull) — a lower
  // bound in traffic; movement.js lets a late rider walk only when walking is quicker even than that
  function eta(cab, now) { const P = cab.P, C = P.C, c = cab.c; if (!c || cab.i > P.iD) return 0; const s = cab.dNow - C.c0[cab.i], q = sub(P.R, cab.i, Math.max(0, s), P.iD, P.sD);
    const T = carDrive(q.links, { s0: q.s0, s1: q.s1, t0: now, v: c.v || 0, car: P.car, sig: P.sig, step: .1 }).T; return (Number.isFinite(T) ? T : 1e9) + P.out + (P.dropKerb ? CAB.pull : 0); }
  // a rider who gets out where the cab stands (movement.js, far past the booking): only a cab at rest in a lane (never in a junction's box,
  // never mid-pull) — it is held there (kin) until the rider is out, then let go as an ordinary car
  function bail(cab) { const c = cab.c; if (!c || c.gone || c.kin || c.v > .3 || c.L?.kind !== 'lane' || !['road', 'out', 'ride'].includes(cab.phase)) return false;
    TS.kerbIn(c); cab.phase = 'bail'; cab.alighting = true; S.bails++; return true; }
  // (where the rider's steps read the cab: at rest at its pickup — in its bay — and at rest at its drop)
  const atKerb = cab => { const c = cab.c; if (!c || c.gone) return false; return cab.P.bay ? cab.phase === 'bay' : !!cab.atPick && c.v < .3; };
  const atDrop = cab => { const c = cab.c; return !!c && !c.gone && (cab.dropBay ? cab.phase === 'dropBay' : !!cab.atDropNow && c.v < .25); };
  return { list, add, cancel, sync, atKerb, atDrop, bail, eta: cab => eta(cab, nowR), get now() { return nowR; },
    stats: () => ({ ...S, queued: list.size, orphans: [...list.values()].filter(q => nowR > q.P.tArr + CAB.relMax + 5).length }) };
}
