// SIM LIVE pass · THE SIM'S AGENTS ON THE STREETS (main thread). Each live sim agent (adapter.js agentsOf, through the feed) is one
// walker on the sidewalk graph (pedsim.js putAgent …), in its own look (looks.js: the cast's look for its `look`, in its worn traits):
//   at a place   standing at one of the place's stand spots (stands.json: clear of every lane, prop and standing person) — or indoors,
//                not drawn: homes (a home's lights say who is in), shops, the precinct, a place whose spots are all taken
//   on a trip    walking the sidewalks from the one place to the other: it leaves at `dep` and keeps to `arr` as well as a walker can
//                (SPEED: 1.1–2.6 m/s). One that falls behind the sim's clock catches up only where nobody sees it (off screen, or far).
//                A taxi ride, and a trip with no sidewalk (the woods, the labs, Iron Island over the bridge), isn't walked: the agent
//                is gone for the ride and reappears on arrival
//   jailed       standing in the yard on Iron Island (its stand spots), else indoors · asleep: indoors · in hospital, dead: not drawn
// Leaving a place it steps from its spot onto its lane point (only when that stretch of lane is clear: the walkers behind then wait at
// their gap while it steps on); arriving it halts at the lane point and steps off to its spot. Nobody on screen is ever moved, except
// by an arrest (the patrol takes them), a taxi, and the places handed out when the page starts.
// STAGE hooks (2026-10-07, stage/index.js: the sim's events play out in the city). setStage(s) · hold(id) hands the stage an agent's
// walker for a vignette (taken off its lane; the driver leaves it alone meanwhile, its new orders wait) · release(id, { remove }) hands
// it back where it was taken (or removes it: the driver then places it as the sim says) · s.leaving(a, d, o): a drawn agent the sim is
// about to take off the street (jail, hospital, dead) may be held a moment for the event that explains it · s.lost(id): a held walker
// was removed (a tape seek, the agent left the sim). Without a stage nothing here changes.
// CITY LIFE (W8, 2026-10-08: life.js): a standing agent is never a statue — its loops (deal_pace, deal_lookout, lean_wall, sit_stoop,
// sit_bench …), its beat and its talks run there; life lets go the moment it isn't standing. claim() clusters crews and suits the act.
import * as THREE from 'three';
import { SIDE } from '../style.js';
import { createMovement } from './movement.js';   // (MOVEMENT W3a: trips with legs, true sync — the cabs they ride)
import { createLife, roleOf } from './life.js';   // (W8: city life — busy at their places: life.js)
import { createSimClock } from './simclock.js';   // (SIM CLOCK: the sim's whole minutes → a smooth game clock that never runs backward)

export const SPEED = { min: 1.1, max: 2.6, stroll: 1.25, step: 1.2 };   // m/s: walking pace … a hurry; a step on or off the lanes
export const LAG = 30;   // m behind the sim's clock before an unseen walker is moved on to where the sim has it
export const WAIT = 1;   // m: stepping on, an agent waits this far short of its lane point for a gap (stands.js keeps that point off every lane)

// clockNow (C1-9b, the record path): () → the playhead's island minute, written exactly every frame: the movement runs on it as it
// is (a seek, a new clock epoch, is the jump), not on the fitted, slewed line made for the old sim's whole-minute polls, which ran a
// frame ahead of the playhead and stayed there when paused. Null: as ever
export function createAgents({ peds, places, stands = null, doorOf: doorAnchor = () => null, looks = null, log = () => {}, scene = null, clips = null, life = true, lifeOpts = null, clockNow = null }) {
  const sim = peds.sim, A = new Map(), PL = new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p]));
  const S = { spawned: 0, removed: 0, jumps: 0, steps: 0, waits: 0, noWay: 0, ms: [], maxMs: 0 };
  // ── the sim clock as the page sees it (simclock.js): clock = { t, at, rate } is the line fitted to the polls' whole minutes; simNow()
  // reads it, moveNow follows it smoothly (never backward) and the movement runs on that
  const SC = createSimClock(), clock = SC.clock, simNow = SC.now;
  // MOVEMENT W3a · a trip with LEGS (the sim's movement branch, or the dev mock) is drawn by movement.js on its legs at their real
  // durations, on the movement clock (SC.move: the sim's minutes arrive whole, once a second — slewed, never stepped, unless the sim jumps)
  const MV = createMovement({ peds, log, clips: clips || peds.clips || null }); if (scene) MV.setScene(scene);
  const LIFE = createLife({ A, REG: clips || peds.clips || null, log, ...(lifeOpts || {}) }), LIFE_ON = life && (typeof location === 'undefined' || new URLSearchParams(location.search).get('life') !== '0');   // (W8: every standing agent busy at its place; it lets go the moment the walker isn't standing)
  const TQ = new THREE.Quaternion(), EU = new THREE.Euler();
  // ── places: their stand spots (each resolved once to the lane point it is reached from) and the lane point indoors is reached from
  const sideEdge = new Map(); for (const E of sim.edges) if (!E.cross && !E.joint) sideEdge.set(`${E.i},${E.j},${E.side}`, E);
  const laneOf = en => { const E = en && sideEdge.get(`${en.i},${en.j},${en.side}`); if (!E) return null; const ns = en.side === 'N' || en.side === 'S', a = ns ? E.from.x : E.from.z, b = ns ? E.to.x : E.to.z, s = b > a ? en.u - a : a - en.u;
    return s > 1.2 && s < E.len - 1.2 ? { E, s } : null; };
  const spots = new Map(); for (const [id, pl] of Object.entries(stands?.places || {})) spots.set(id, (pl.spots || []).map((sp, k) => ({ ...sp, y: sp.y ?? SIDE, k, place: id, taken: null })));
  const entryOf = sp => { if (!sp) return null; if (sp.lane === undefined) sp.lane = laneOf(sp.entry); return sp.lane; };
  const doors = new Map();
  function doorOf(id) {   // where an agent goes in: its door (the lot's anchor), else the place's own point → the nearest lane point
    if (doors.has(id)) return doors.get(id); const d = doorAnchor(id), p = PL.get(id), x = d ? d[0] : p?.x, z = d ? d[2] : p?.z;
    const L = x === undefined ? null : sim.laneNear(x, z, 40), out = L ? { E: L.E, s: L.s } : null; if (d || !String(id).startsWith('lot:')) doors.set(id, out); return out; }
  // a lane point clear to step onto: the walkers' full gap; after a second and a half of waiting, just past their hard gap (PED.gap: the
  // walker behind stops short of it, the one ahead walks on)
  const clearFor = (a, E, s) => { const loose = (a.waitT || 0) > 1.5; return sim.laneClear(E, s, loose ? 1.25 : 2.6, loose ? .95 : 1.6); };
  const firstEntry = id => { for (const sp of spots.get(id) || []) { const e = entryOf(sp); if (e) return e; } return null; };
  // W8 · which free spot: next to its crew when crew-mates are already there (crews stand clustered), else the nearest the place's focus,
  // nudged to what the act wants (a dealer a pace strip, a cop or a worker a beat; someone hanging out a bench, a stoop or a wall: half
  // of them, by handle). Bench seats only for someone hanging out (a dealer doesn't deal sat down)
  const hashS = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };
  // (near(spot) → m: MOVEMENT REVIEW #1 — off a trip, the spots nearest where the walk ended first, by the way there along the lanes, so the
  // step-off is a few metres on the walker's own side or over a crossing, not straight over the road to the far corner)
  // keepOff (C1-6, the record's show only): spot → true while a staged scene's figure stands in its room (stage/record.js); null: as ever
  let keepOff = null;
  function claim(a, place, near = null) { if (a.spot?.place === place) return a.spot; release(a); const list = spots.get(place) || [], role = a.rec?.loopRole ?? roleOf(a.rec?.act), crew = a.rec?.crew, pair = a.rec?.pairWith;
    // (C1-4: a sit-down's pair stands together: next to the partner when it is already there)
    const mates = pair && list.some(s => s.taken === pair) ? list.filter(s => s.taken === pair) : crew ? list.filter(s => s.taken && A.get(s.taken)?.rec?.crew === crew) : [], sit = hashS(String(a.id)) % 2 === 0;
    let sp = null, best = 1e9; list.forEach((s, k) => { if (s.taken || keepOff?.(s) || (s.kind === 'bench' && (role !== 'hang' || !sit))) return;
      let v = k + (mates.length ? 4 * Math.min(...mates.map(m => Math.hypot(m.x - s.x, m.z - s.z))) : 0) + (near ? 1.5 * near(s) : 0);
      if (role === 'deal' && s.pace) v -= 4; if ((role === 'patrol' || role === 'work') && s.beat) v -= 4;
      if (role === 'hang' && sit) v -= s.kind === 'bench' ? 8 : s.kind === 'stoop' ? 7 : s.kind === 'wall' ? 4 : 0;
      if (v < best) { best = v; sp = s; } });
    if (!sp) sp = list.find(s => !s.taken) || null; if (sp) { sp.taken = a.id; a.spot = sp; } return sp; }
  function release(a) { if (a.spot && a.spot.taken === a.id) a.spot.taken = null; a.spot = null; }
  const kindOf = id => PL.get(id)?.kind ?? (String(id).startsWith('lot:') ? 'lot' : null);
  const standsAt = id => kindOf(id) !== 'lot' && (spots.get(id) || []).length > 0;
  // ── what the sim says → what the map shows
  function want(r) {
    if (r.status === 'dead' || r.status === 'hospital') return { kind: 'gone' };
    if (r.status === 'jail') return { kind: standsAt('jail') ? 'stand' : 'hide', place: 'jail', now: true };
    if (r.status === 'asleep') return { kind: 'hide', place: r.at };
    if (r.trip) return r.trip.legs?.length ? { kind: 'trip', trip: r.trip, place: r.trip.to, legs: true } : r.trip.taxi ? { kind: 'away' } : { kind: 'trip', trip: r.trip, place: r.trip.to };
    if (!r.at) return { kind: 'gone' };
    return { kind: standsAt(r.at) ? 'stand' : 'hide', place: r.at }; }
  // ── ways along the lanes
  function wayLen(E, s, way, goal) { if (!way.length) return Math.max(0, goal.s - s); let L = E.len - s; for (let k = 0; k < way.length - 1; k++) L += way[k].len; return L + goal.s; }
  function along(E, s, way, d) { let x = s + d; if (x <= E.len) return { E, s: x, k: -1 }; x -= E.len;
    for (let k = 0; k < way.length; k++) { if (x <= way[k].len) return { E: way[k], s: x, k }; x -= way[k].len; } const e = way[way.length - 1] || E; return { E: e, s: e.len - 1, k: way.length - 1 }; }
  function left(w) { if (!w?.goal) return 0; if (w.goal.armed && w.E === w.goal.E) return Math.max(0, w.goal.s - w.s); return wayLen(w.E, w.s, [w.next, ...(w.route || [])].filter(Boolean), w.goal); }
  // the arrival end: a free stand spot's lane point, else the door's (indoors)
  function goalAt(a, place) { if (standsAt(place)) { const sp = claim(a, place), g = entryOf(sp); if (g) return { goal: g, spot: sp }; release(a); } const g = doorOf(place); return g ? { goal: g, spot: null } : null; }
  // ── the walker
  function remove(a) { if (a.held) { a.held = null; stage?.lost?.(a.id); } if (a.w) { a.w.mv = null; a.w.tq = null; a.w.lift = 0; } if (a.w) { sim.removeAgent(a.id); a.w = null; S.removed++; } a.mode = null; a.step = null; a.goalFor = null; release(a); }
  function standAt(a, sp) { if (a.w) { sim.removeAgent(a.id); a.w = null; } a.step = null; a.w = sim.putAgent({ id: a.id, look: a.look, fix: [sp.x, sp.y, sp.z, sp.ry ?? 0] }); if (!a.w) { release(a); return; } a.spot = sp; sp.taken = a.id; a.mode = 'stand'; a.placed = true; S.spawned++; }
  // (a.placed, C1-9b: placed outright, a seek or the page's start; the record's life poses it at once, not eased in. Unread elsewhere)
  function stepOff(a) {   // halted at its lane point → a straight walk to its spot (stands.js checked the line clear)
    const w = a.w, sp = a.spot, lp = sim.where({ E: w.E, s: w.s }, [0, 0, 0, 0]); w.halt = true;
    a.step = { kind: 'out', t: 0, dur: Math.max(.4, Math.hypot(sp.x - lp[0], sp.z - lp[2]) / SPEED.step), a: lp.slice(0, 3), b: [sp.x, sp.y, sp.z], ry: Math.atan2(sp.x - lp[0], sp.z - lp[2]) }; a.mode = 'out'; S.steps++; }
  // from its spot onto its lane point, then away: it walks up to WAIT m short of the lane (off every lane: stands.js), waits there for a
  // gap, takes the lane point (halted: the walkers behind now keep their gap) and steps on
  function stepOn(a, from, way, goal, spot, trip) {
    const sp = a.spot, lp = sim.where({ E: from.E, s: from.s }, [0, 0, 0, 0]), L = Math.hypot(lp[0] - sp.x, lp[2] - sp.z), k = L > WAIT + .2 ? (L - WAIT) / L : 0;
    const wp = [sp.x + (lp[0] - sp.x) * k, sp.y + (lp[1] - sp.y) * k, sp.z + (lp[2] - sp.z) * k], p0 = a.w && Math.hypot(a.w.p[0] - sp.x, a.w.p[2] - sp.z) < 6 ? [a.w.p[0], sp.y, a.w.p[2]] : [sp.x, sp.y, sp.z];   // (W8: from where life has it)
    LIFE.drop(a); if (a.w) a.w.mv = null;
    a.step = { kind: 'on1', t: 0, dur: Math.max(.2, Math.hypot(wp[0] - p0[0], wp[2] - p0[2]) / SPEED.step), a: p0, b: wp, lp: lp.slice(0, 3), ry: Math.atan2(wp[0] - p0[0], wp[2] - p0[2]), E: from.E, s: from.s, way, goal, trip };
    if (sp && sp.taken === a.id) sp.taken = null; a.spot = spot; if (spot) spot.taken = a.id; a.mode = 'in'; S.steps++; }
  function stepFrame(a, dt) {
    const st = a.step, w = a.w;
    if (st.kind === 'wait') { if (!clearFor(a, st.E, st.s)) { S.waits++; a.waitT = (a.waitT || 0) + dt; w.vc = 0; return; }   // (a gap in the walkers: on)
      a.waitT = 0; sim.onAgent(w, st.E, st.s); w.fix = [st.b[0], st.b[1], st.b[2], st.ry]; Object.assign(st, { kind: 'on2', t: 0, a: st.b, b: st.lp, dur: Math.max(.3, Math.hypot(st.lp[0] - st.b[0], st.lp[2] - st.b[2]) / SPEED.step) }); return; }
    st.t = Math.min(1, st.t + dt / st.dur); const k = st.t, x = st.a[0] + (st.b[0] - st.a[0]) * k, y = st.a[1] + (st.b[1] - st.a[1]) * k, z = st.a[2] + (st.b[2] - st.a[2]) * k;
    w.fix = [x, y, z, st.ry]; w.vc = k < 1 ? SPEED.step : 0; w.ph += SPEED.step * dt * 3.1;
    if (st.kind === 'out' && w.E && Math.hypot(x - st.a[0], z - st.a[2]) > .95) sim.offAgent(w, w.fix);   // (clear of the lane: the walkers behind go on)
    if (k < 1) return;
    if (st.kind === 'on1') { st.kind = 'wait'; return; }
    a.step = null;
    if (st.kind === 'out') { if (w.E) sim.offAgent(w, w.fix); w.fix = [st.b[0], st.b[1], st.b[2], a.spot?.ry ?? st.ry]; a.mode = 'stand'; return; }
    w.fix = null; sim.goAgent(w, st.way, st.goal); a.mode = 'walk'; }
  // sent (or re-sent) along a way to a place's goal; the trip's timing is kept to judge how far behind the sim it falls
  function route(a, place, p = null) { const w = a.w, G = goalAt(a, place); if (!G) return false; const way = sim.wayTo(w.E, w.s, G.goal); if (!way) { release(a); return false; }
    sim.goAgent(w, way, G.goal); a.goalFor = place; a.leg = { L: left(w), p0: p }; return true; }
  // join a trip where the sim's clock has it: at p of the way from the origin's lane point to the goal
  function join(a, tr, p) {
    const from = firstEntry(tr.from) || doorOf(tr.from), G = goalAt(a, tr.to); if (!from || !G) { S.noWay++; release(a); return 'none'; }
    const way = sim.wayTo(from.E, from.s, G.goal); if (!way) { S.noWay++; release(a); return 'none'; }
    const L = wayLen(from.E, from.s, way, G.goal), d = Math.max(0, Math.min(1, p)) * L; if (L - d < 3) { release(a); return 'there'; }
    for (const off of [0, 1.8, -1.8, 3.6, -3.6]) { const dd = Math.max(0, Math.min(L - 2.5, d + off)), q = along(from.E, from.s, way, dd); if (!clearFor(a, q.E, q.s)) continue;
      a.w = sim.putAgent({ id: a.id, look: a.look, E: q.E, s: q.s, way: way.slice(q.k + 1), goal: G.goal, check: false }); if (!a.w) continue;
      S.spawned++; a.mode = 'walk'; a.goalFor = tr.to; a.leg = { L: L - dd, p0: Math.max(0, Math.min(1, p)) }; return 'on'; }
    S.waits++; a.waitT = (a.waitT || 0) + (a.dtNow || 0); release(a); return 'wait'; }
  // ── per frame (peds.driver: before the crowd is topped up)
  let islandDt = 0, lastIsland = null, islandEp = null;
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), V = new THREE.Vector3(); let cam = null, farR = 90, tick = 0, snaps0 = -1;
  const seen = w => { if (!cam || !w) return false; const p = w.p; if (Math.hypot(p[0] - cam.position.x, p[2] - cam.position.z) > farR) return false; V.set(p[0], p[1] + 1, p[2]); return FR.containsPoint(V); };
  function drive(t, dt, focus, camera, R) {
    const t0 = performance.now(); clock.pageT += dt; cam = camera; farR = (R?.charMid ?? 70) * 1.05; tick++;   // (page time from the frames' dt: monotonic, whoever drives the frames)
    if (camera) { PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM); }
    // (C1-9b, the record: a step on or off its spot runs on island seconds too, and stands still while the record is paused)
    { const T = clockNow ? clockNow() * 60 : null; islandDt = T === null || lastIsland === null || clock.epoch !== islandEp ? 0 : Math.max(0, T - lastIsland); lastIsland = T; islandEp = clock.epoch; }
    looks?.pump(); const now = clockNow ? clockNow() : simNow(), mnow = clockNow ? now : SC.move(dt), sn = clockNow ? clock.epoch : SC.stats().moveSnaps; if (mnow !== null) MV.frame(mnow, sn !== snaps0, clock.running === false ? 0 : clock.rate); snaps0 = sn;   // (MOVEMENT REVIEW #7: a snap of the movement clock is a jump: a late bus rider may join mid-ride only then)
    for (const a of A.values()) { try { if (a.w && a.w.look !== a.look) a.w.look = a.look; update(a, now, dt, mnow); overlay(a); } catch (e) { log(`agent ${a.id}: ${e && e.message || e}`); remove(a); } a.first = false; }   // (only the first frame places people outright)
    if (LIFE_ON) try { LIFE.frame(dt); } catch (e) { log('life: ' + (e && e.message || e)); }   // (W8: after the orders: only who is standing; ?life=0 turns it off)
    MV.flushProps(cam?.position); const ms = performance.now() - t0; S.ms.push(ms); if (S.ms.length > 600) S.ms.shift(); S.maxMs = Math.max(S.maxMs, ms); }
  // ── C1-4 · a visible high's walk (rec.walkClip, the record path only: wired_walk, spaced_walk, guarded_walk) over the walk on the lanes;
  // on a trip's legs legTrip plays it (above the walk, when no ride or prop clip does); standing, life plays the mood's standing loop
  function walkMv(a) { const c = a.rec.walkClip; return a.walkMv?.clip === c ? a.walkMv : (a.walkMv = { clip: c, walkOverlay: true }); }
  function overlay(a) { const w = a.w; if (!w || a.held) return;
    if (a.rec?.walkClip && a.mode === 'walk') w.mv = walkMv(a);
    else if (w.mv?.walkOverlay && a.mode !== 'leg') w.mv = null; }
  // ── MOVEMENT W3a · a trip with legs
  function endRun(a, jump = false) { if (!a.run) return; a.run.release(a, jump); a.run = null; if (a.w) { a.w.mv = null; a.w.tq = null; a.w.lift = 0; } }   // (jump: a seek, the cab goes too)
  function legTrip(a, now, dt) {
    const tr = a.d.trip, back = !!a.run && a.run.lastNow !== null && now !== null && now < a.run.lastNow - 1; if (a.run && (a.run.trip !== tr || back)) endRun(a, back);   // (a new trip, or the clock went back: a tape seek)
    if (!a.run) { a.run = MV.run(a, tr); if (a.step) a.step = null;
      const w = a.w; if (w && (a.mode === 'stand' || a.mode === 'out')) { const k = tr.legs.findIndex(l => l.path?.length >= 2 && l.kind !== 'bus' && l.kind !== 'taxi'), p0 = k >= 0 ? tr.legs[k].path[0] : null;   // (from its spot: the first stretch starts where it stands)
        if (p0 && Math.hypot(w.p[0] - p0[0], w.p[2] - p0[1]) < 30) a.run.leadFrom(k, [w.p[0], w.p[2]]); }
      if (a.spot) release(a); if (a.w?.E) sim.offAgent(a.w, [a.w.p[0], a.w.p[1], a.w.p[2], a.w.yawS ?? a.w.p[3]]); a.mode = 'leg'; a.goalFor = null; }
    if (now === null) return; const o = a.run.frame(now, dt, a); a.mode = 'leg';
    if (!o.show) { if (a.w) { sim.removeAgent(a.id); a.w = null; S.removed++; } return; }
    if (!a.w) { a.w = sim.putAgent({ id: a.id, look: a.look, fix: [o.x, o.y, o.z, o.yaw] }); if (!a.w) return; S.spawned++; a.w.yawS = o.yaw; }
    const w = a.w; w.fix = [o.x, o.y, o.z, o.yaw]; w.vc = o.vc; w.ph += (o.cad || o.vc) * dt * 3.1; w.mv = o.prop || o.clip || o.stand ? o : a.rec?.walkClip && o.vc > .2 ? walkMv(a) : null;
    if (o.snap) { w.yawS = o.yaw; w.omega = 0; }   // (a kickturn, a cab door, a turnstile: the heading outright, as the clip has it)
    if (o.duck) { EU.set(o.duck * .55, 0, 0); w.tq = (w.tq || new THREE.Quaternion()).setFromEuler(EU); w.lift = -o.duck * .55; } else if (w.tq && !a.held) { w.tq = null; w.lift = 0; }
    if (o.prop) MV.prop(o.prop, o.x, o.base ?? (o.y - .12), o.z, w.yawS ?? o.yaw, w, o); }
  // off a trip at p: the lane there, the way from it to a spot, and the claim's cost (by that way, else straight and dearer than any)
  function arrival(p) { const ln = sim.laneNear(p[0], p[2], 3), wayOf = s => { const g = ln && entryOf(s), way = g ? sim.wayTo(ln.E, ln.s, g) : null, L = way ? wayLen(ln.E, ln.s, way, g) : Infinity; return L <= 100 ? { g, way, L } : null; };
    return { ln, wayOf, near: s => wayOf(s)?.L ?? Math.hypot(s.x - p[0], s.z - p[2]) + 100 }; }
  function update(a, now, dt, mnow = now) {
    const d = a.d, w = a.w; if (!d) return;
    if (a.held) { if (a.run && a.run.hn == null && mnow !== null) a.run.hn = mnow; return; }   // (held: the stage moves it; its trip runs late by as long)
    if (a.run && a.run.hn != null && mnow !== null) { a.run.delay += Math.max(0, mnow - a.run.hn); a.run.hn = null; }
    if (d.kind === 'trip' && d.legs) { legTrip(a, mnow, dt); return; }
    if (a.run) endRun(a);
    if (a.mode === 'leg') { if (!w) a.mode = null;   // (the trip is over: to a stand spot from where it ended, or indoors)
      else if (d.kind === 'stand' && !d.now && !a.step) { const p = w.p, { ln, wayOf } = arrival(p);
        // (C1-9b: the spot by its trip's own end, rec.arrive, the record's, when it has one: as a seek there claims it; walked from here)
        const sp = claim(a, d.place, arrival(a.rec?.arrive ?? p).near); if (!sp) { remove(a); return; } const dS = Math.hypot(sp.x - p[0], sp.z - p[2]);   // (no way along the lanes: straight, and dearer than any)
        // MOVEMENT REVIEW #1 · THE STAND-SPOT STEP-OFF DOES THE LAST METRES: the walk now ends on the walkers' graph (travel.mjs), so a spot
        // with a lane point (its entry) is walked to along the lanes — round the corner, over the crossing — and stepped off to, as a
        // walker's arrival always was (up to 100 m: the crossings are one-way, and the far corner can be the way round — walked, not popped
        // to); a straight step only when there is no such way and the spot is within 12 m
        const wo = dS > 2.5 ? wayOf(sp) : null;
        if (wo) { sim.onAgent(w, ln.E, ln.s); sim.goAgent(w, wo.way, wo.g); a.mode = 'walk'; a.goalFor = d.place; a.leg = null; S.steps++; return; }
        if (dS > 12) { remove(a); return; }   // (the sim has them there and the ride hasn't: as before, they walk up from the lane)
        a.step = { kind: 'out', t: 0, dur: Math.max(.4, dS / SPEED.step), a: [p[0], p[1], p[2]], b: [sp.x, sp.y, sp.z], ry: Math.atan2(sp.x - p[0], sp.z - p[2]) }; a.mode = 'out'; S.steps++; return; }
      else { remove(a); return; } }
    a.dtNow = dt; if (w && !w.fix && !w.off) a.waitT = 0;
    if (a.step) { const st = a.step; if ((st.kind === 'on1' || st.kind === 'wait') && (d.kind !== 'trip' || d.trip !== st.trip)) { remove(a); return; }   // (plans changed before it reached the lane)
      stepFrame(a, clockNow ? islandDt : dt); return; }
    switch (d.kind) {
      case 'gone': if (w) remove(a); return;
      case 'away': if (w && (a.mode !== 'walk' || !seen(w) || w.halt)) remove(a); else if (w) w.v = SPEED.max; return;   // (a taxi takes them: a walker still on its way finishes out of sight)
      case 'hide': {
        if (!w) return; if (a.mode === 'stand' || d.now) { remove(a); return; }   // (indoors from a spot; jailed from the street)
        if (a.mode === 'walk') { if (a.goalFor !== d.place && !route(a, d.place)) { remove(a); return; } w.v = SPEED.max;
          if (w.halt || (left(w) > LAG && !seen(w))) remove(a); }   // (in at the door; far behind and unseen: already in)
        return; }
      case 'stand': {
        // (C1-9b, the record: off a trip that ended at rec.arrive [x, y, z], placed outright or come up from a ride, it claims the spot a walk off that
        // trip claims)
        if (!w) { const ar = a.rec?.arrive ?? null, sp = claim(a, d.place, ar ? arrival(ar).near : null); if (!sp) return; const g = entryOf(sp);   // (no spot free: indoors)
          if (a.first || d.now || !g) { standAt(a, sp); return; }   // (startup, an arrest: straight to the spot)
          if (!clearFor(a, g.E, g.s)) { S.waits++; a.waitT = (a.waitT || 0) + dt; return; }   // (after a ride: they walk up from the lane)
          a.w = sim.putAgent({ id: a.id, look: a.look, E: g.E, s: g.s, check: false }); if (!a.w) return; S.spawned++; a.goalFor = d.place; stepOff(a); return; }
        if (a.mode === 'stand') { if (a.spot?.place !== d.place) remove(a); return; }   // (standing elsewhere: the patrol took them)
        if (d.now) { remove(a); return; }
        if (a.mode === 'walk') { if (a.goalFor !== d.place && !route(a, d.place)) { remove(a); return; } w.v = SPEED.max;   // (the sim has them there: the last stretch in a hurry)
          if (w.halt) { if (a.spot) stepOff(a); else remove(a); return; }
          if (left(w) > LAG && !seen(w)) { S.jumps++; const sp = a.spot; remove(a); if (sp) standAt(a, sp); } }
        return; }
      case 'trip': {
        const tr = d.trip, span = tr.arr !== null && tr.dep !== null ? Math.max(1, tr.arr - tr.dep) : null, p = now !== null && span ? (now - tr.dep) / span : 0;
        if (!w) { if (a.noWay === tr) return; const r = join(a, tr, p); if (r === 'none') a.noWay = tr; else if (r === 'there') a.d = { kind: standsAt(tr.to) ? 'stand' : 'hide', place: tr.to }; return; }
        if (a.mode === 'stand') { const from = entryOf(a.spot); if (!from) { remove(a); return; }
          const sp = a.spot; a.spot = null; if (sp.taken === a.id) sp.taken = null; const G = goalAt(a, tr.to); if (!G) { a.spot = sp; sp.taken = a.id; remove(a); a.noWay = tr; return; }
          const way = sim.wayTo(from.E, from.s, G.goal); if (!way) { release(a); a.spot = sp; sp.taken = a.id; remove(a); a.noWay = tr; S.noWay++; return; }
          const next = a.spot; a.spot = sp; stepOn(a, from, way, G.goal, next, tr); a.goalFor = tr.to; a.leg = { L: wayLen(from.E, from.s, way, G.goal), p0: Math.max(0, Math.min(1, p)) }; return; }
        if (a.mode === 'walk') {
          if (a.goalFor !== tr.to && !route(a, tr.to, Math.max(0, Math.min(1, p)))) { remove(a); a.noWay = tr; return; }
          const L = left(w), secs = now !== null && clock.rate > 0 && tr.arr !== null ? (tr.arr - now) / clock.rate : null;
          w.v = secs === null ? SPEED.stroll : secs <= .25 ? SPEED.max : Math.max(SPEED.min, Math.min(SPEED.max, L / secs));
          if (w.halt) { if (a.spot) stepOff(a); else remove(a); return; }   // (there before the sim says so)
          if (tick % 15 === 0 && a.leg?.p0 !== null && a.leg && span && !seen(w)) { const due = a.leg.L * Math.max(0, 1 - p) / Math.max(.02, 1 - a.leg.p0);   // (where the trip should be by now)
            if (L - due > LAG) { S.jumps++; remove(a); } } }   // (far behind and unseen: rejoins at the sim's position next frame)
        return; }
    } }
  // ── a snapshot's agents: the latest record each; the driver does the rest, frame by frame
  // opt.snap (HUMAN LAYER s2a, the tape player): 'all' — every agent is placed outright where the sim has it on the next frame (a seek: no
  // walking catch-up); 'changed' — only those whose place or trip changed (fast play: 16×, 60×). Without it: as ever (they walk)
  // opt.snapIds (C1-6, the record's show only): a Set of ids placed outright, as 'all' places everyone (a trip cut to its arrival)
  function setAgents(list, opt = {}) {
    const ids = new Set();
    for (const r of list) { ids.add(r.id); let a = A.get(r.id); const L = looks ? looks.of(r) : 0;
      if (!a) A.set(r.id, a = { id: r.id, rec: null, d: null, w: null, mode: null, spot: null, look: L, first: true }); else a.look = L;
      a.rec = r; const d = want(r), o = a.d;
      if (!o || o.kind !== d.kind || o.place !== d.place || (d.trip && (!o.trip || o.trip.dep !== d.trip.dep || o.trip.to !== d.trip.to))) { a.d = d; if (opt.snap === 'changed' && o) snapOne(a);
        else if (stage && o && a.w && !a.held && !opt.snap && (d.kind === 'gone' || d.now)) stage.leaving?.(a, d, o); }   // (STAGE: a moment for the event that explains it)
      if (opt.snap === 'all' || opt.snapIds?.has(r.id)) snapOne(a); }
    for (const [id, a] of A) if (!ids.has(id)) { endRun(a); remove(a); A.delete(id); }
    // (C1-9b: placed outright, everyone is placed in the list's order: the spots go first come, first served, as the list has them)
    if (opt.snap === 'all') { const order = list.map(r => A.get(r.id)); A.clear(); for (const a of order) A.set(a.id, a); } }   // (its run ended first: its cab no longer waits up to 90 s at the drop for a rider that's gone)
  function snapOne(a) { remove(a); a.first = true; a.noWay = null; a.waitT = 0; }
  // ── STAGE: a vignette borrows a walker (stage/index.js); it gives it back where it took it
  let stage = null;
  function hold(id) { const a = A.get(id); if (!a || !a.w || a.step || a.run?.busyNow()) return null; if (a.held) return a.w; const w = a.w;   // (MOVEMENT W3a: never off a bus or out of a cab. The W3a commit had put the rest of this line inside that comment: `w` was undefined, every vignette's hold threw)
    a.held = { E: w.E, s: w.s, next: w.next, route: w.route, goal: w.goal, halt: w.halt, mode: a.mode, fix: w.fix ? w.fix.slice() : null }; MV.unpose(w);
    if (w.E) sim.offAgent(w, [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]]); return w; }
  function unhold(id, { remove: rm = false } = {}) { const a = A.get(id); if (!a?.held) return; const h = a.held; a.held = null; const w = a.w;
    if (rm || !w) { remove(a); return; }
    if (h.E) { sim.onAgent(w, h.E, h.s); w.fix = null; if (!h.halt) sim.goAgent(w, [h.next, ...(h.route || [])].filter(Boolean), h.goal); }   // (back on its lane point, on its way)
    else if (h.fix) w.fix = h.fix.slice(); }
  return {
    setAgents, drive, clock, hold, release: unhold, setStage(s) { stage = s; }, get stage() { return stage; }, set keepOff(fn) { keepOff = fn; },
    setClock(t, pageT, running) { SC.observe(t, pageT, running); },
    stats: () => { const v = [...A.values()]; return { agents: v.length, walking: v.filter(a => a.mode === 'walk' || (a.mode === 'leg' && a.w)).length, onLegs: v.filter(a => a.run).length, riding: v.filter(a => a.run?.busyNow()).length, standing: v.filter(a => a.mode === 'stand').length, stepping: v.filter(a => a.step).length,
      hidden: v.filter(a => !a.w).length, rate: +clock.rate.toFixed(3), simT: simNow() === null ? null : +simNow().toFixed(1), clock: SC.stats(), spawned: S.spawned, removed: S.removed, jumps: S.jumps, steps: S.steps, waits: S.waits, noWay: S.noWay,
      p50: q(S.ms, .5), p95: q(S.ms, .95), maxMs: +S.maxMs.toFixed(3) }; },
    list: () => [...A.values()].map(a => ({ id: a.id, want: a.d?.kind, place: a.d?.place ?? null, mode: a.mode, spot: a.spot ? a.spot.place + '#' + a.spot.k : null, x: a.w ? +a.w.p[0].toFixed(1) : null, z: a.w ? +a.w.p[2].toFixed(1) : null, look: a.look })),
    spots, get map() { return A; }, movement: MV, life: LIFE, get moveNow() { return clockNow ? clockNow() : SC.moveNow; },
  };
}
const q = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3); };
