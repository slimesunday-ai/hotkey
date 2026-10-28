// TAXI CLOCK (2026-10-09) · the regression check for the audit's F10 F11 F12 (2026-10-08, the 10-08 local audit (not in this repository): evidence/
// taxi-release.mjs, taxi-sync.mjs, movement-probes.mjs, re-pointed here at this checkout and the export it reads), plus the cabs' own
// gate in node: the real traffic sim (populated round each cab, seed 404), the real fleet and movement.js, no page. Exit 1 when any
// finding comes back.
//   node style/city/tools/cabcheck.mjs [--n 24] [--only f10,f11,f12,gate] [--json out.json] [--world <export.json>] [--window <an older run's --json>]
//   (--window: the traffic's overlaps are also counted over that run's windows, ride by ride — its booked arrival + 20 s: like for like)
//   F10  a rider released while their cab is still riding (mid-ride, and at the booked arrival as the audit did) leaves no cab behind:
//        after 300 s nothing in the traffic still carries the rider or a route, the cab is an ordinary car (or gone), and a camera jump's
//        repopulate can drop it
//   F11  every ride ends: the rider on the kerb within LATE_MAX s of the booked arrival, none still riding past it (the audit's: 1403 s,
//        held behind a bus; the audit's four routes at 600 + --n more, each with the traffic running). CAB TRAFFIC (2026-10-10): the cab is a
//        car of the traffic, so a ride is late by what the traffic holds it (the residual — measured by tools/cabresidual.mjs, reported here
//        as |late| median · p90 · max, no longer gated at 1 game min: the TAXI CLOCK's cab kept its booking by taking the green)
//   F12  a CHANGE never jumps (BUSES OUT, 2026-10-09: it was the loop-bus change, bus → wait → bus at the loop's first stop; there are no
//        buses, so it is the subway change now — subway → change → subway at a station two lines share): the legs follow on (each leg's dep
//        its previous arr), every ride leaves on its line's timetable, and no 50 ms step of the drawn rider is over 2 m (40 m/s) from the
//        walk in to the walk out
//   gate cab–car body overlaps (the traffic's own rectangles, 5 cm inset), every step of every ride above; cabs left over
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'three' || s.startsWith('three/')) return { url: 'data:text/javascript,export class Matrix4{}; export class Quaternion{}; export class Vector3{}; export class Frustum{}; export default {};', shortCircuit: true }; return n(s, c); }`));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const LATE_MAX = 300, WIN = arg('window', null) ? new Map(JSON.parse(fs.readFileSync(arg('window'), 'utf8')).f11.rows.map(r => [r.from + '|' + r.to + '|' + r.dep, r.booked])) : null, N = +arg('n', 24), ONLY = new Set((arg('only', 'f10,f11,f12,gate')).split(',')), OUT = arg('json', null);
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { sdata } = await imp('world/city.js'), W = JSON.parse(fs.readFileSync(arg('world', null) ? path.resolve(arg('world')) : path.join(ROOT, sdata('world/export/world.json')), 'utf8'));   // (--world <file>: another export, e.g. one being tuned)
const { createTravel } = await imp('world/export/travel.mjs'), { tuneWorld } = await imp('style/city/simstate/movetune.mjs'), T = createTravel(tuneWorld(structuredClone(W)));
const { createTrafficSim } = await imp('style/city/traffic/sim.js'), { CLOCK } = await imp('style/city/traffic/rules.js'), { createMovement } = await imp('style/city/simstate/movement.js');
globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(W) }); globalThis.performance ??= { now: () => Date.now() };
const out = { f10: null, f11: null, f12: null, gate: null }; let bad = 0; if (process.env.PUSHLOG) { globalThis.__cabPushLog = {}; globalThis.__cabPushTrace = []; }
const obb = (A, B) => { const ax = [[Math.sin(A.h), Math.cos(A.h)], [Math.cos(A.h), -Math.sin(A.h)], [Math.sin(B.h), Math.cos(B.h)], [Math.cos(B.h), -Math.sin(B.h)]], dx = B.x - A.x, dz = B.z - A.z;
  const ext = (C, u) => (C.len / 2 - .05) * Math.abs(Math.sin(C.h) * u[0] + Math.cos(C.h) * u[1]) + (C.wid / 2 - .05) * Math.abs(Math.cos(C.h) * u[0] - Math.sin(C.h) * u[1]);
  for (const u of ax) if (Math.abs(dx * u[0] + dz * u[1]) > ext(A, u) + ext(B, u)) return false; return true; };
// one world: the traffic (seed 404, its models sized as the page's: a taxi 4.4), the movement, its fleet
async function world() { let time = 0; const TS = createTrafficSim({ seed: 404, clock: () => time }); TS.MODELS.size = () => [4.4, 1.8, .34];
  globalThis.window = { __city: { traffic: { sim: TS, MODELS: [{ name: 'taxi' }] } } };
  const mv = createMovement({ peds: { sim: { nodes: new Map(), edges: [], walkers: [], animate: () => ({}) } } }); await new Promise(r => setTimeout(r, 0));
  return { TS, mv, set t(v) { time = v; CLOCK.t = v; }, get t() { return time; } }; }
// one rider on one trip, stepped at 20 Hz with the traffic populated round its cab (or round the rider) — overlaps counted every step
async function ride(tr, o = {}) { const Wd = await world(), { TS, mv } = Wd, a = { id: 'cabcheck', look: 0 }, run = mv.run(a, tr), dt = .05, g = { overlapsCar: 0, frames: 0, maxStep: 0, pairs: [] };
  let at = null, prev = null, stillRiding = false, released = false, cab = null, focus = { x: 0, z: 0 };
  const t0 = tr.dep * 2.5 - 12, t1 = tr.arr * 2.5 + (o.tail ?? LATE_MAX + 5);
  const seen = (x, z) => Math.hypot(x - focus.x, z - focus.z) < 70;   // (a camera on the rider or their cab: 70 m round it is seen)
  { const p = tr.legs.find(l => l.path?.length)?.path[0]; if (p) focus = { x: p[0], z: p[1] }; TS.populate(focus, true, { seen }); }
  for (let s = t0; s < t1; s += dt) { Wd.t = s; const now = s / 2.5; mv.frame(now); if (Math.round(s / dt) % 40 === 0) { if (cab?.c && !cab.c.gone && cab.c.cab) focus = { x: cab.c.x, z: cab.c.z }; TS.populate(focus, false, { seen }); }
    TS.step(dt);
    if (!released) { const f = run.frame(now, dt, a); if (f.show) { if (prev?.show) g.maxStep = Math.max(g.maxStep, Math.hypot(f.x - prev.x, f.z - prev.z)); focus = { x: f.x, z: f.z }; } prev = f; cab = run.veh?.P ? run.veh : cab || (run.pre?.P ? run.pre : null);
      if (cab?.c && !cab.c.gone && g.dropT == null && cab.dNow >= cab.C.dDrop - .05 && cab.c.v < .25) g.dropT = s;   // (TAXI SLACK: at rest at the drop …
      if (g.stand == null && run.phase === 'getout') g.stand = g.dropT == null ? 0 : +(s - g.dropT).toFixed(2);   // … to its rider starting out: the stand)
      if (run.done && at === null) at = now; if (o.releaseAt != null && now >= o.releaseAt) { run.release(a); released = true; } }
    if (process.env.DEBUGCAB && Math.round(s / dt) % 20 === 0 && cab) console.log(JSON.stringify({ t: +s.toFixed(1), ph: run.phase, cabPh: cab.phase, k: run.k, tSpawn: +cab.P.tSpawn.toFixed(1), tPick: +cab.P.tPick.toFixed(1), tDep: +cab.P.tDep.toFixed(1), tOut: +cab.P.tOut.toFixed(1), dNow: +cab.dNow.toFixed(1), dPick: +cab.P.dPick.toFixed(1), dDrop: +cab.C.dDrop.toFixed(1), v: cab.c ? +cab.c.v.toFixed(2) : null, hold: cab.c?.hold ?? null, inside: !!cab.inside, live: !!cab.c }));
    if (!stillRiding && now >= tr.arr + LATE_MAX / 2.5 && !run.done && !released) stillRiding = true;
    if (run.done && o.releaseAt == null && s > tr.arr * 2.5 + 25) break;   // (done: the rest of the tail is the traffic's own)
    const cabsLive = TS.cars.filter(c => c.cab); g.frames++;
    g.carCar = (g.carCar || 0) + TS.stat.overlapNow; if (s < (WIN?.has(tr.from + '|' + tr.to + '|' + tr.dep) ? tr.dep * 2.5 + WIN.get(tr.from + '|' + tr.to + '|' + tr.dep) + 20 : tr.arr * 2.5 + 20)) { g.carCarBase = (g.carCarBase || 0) + TS.stat.overlapNow; g.framesBase = (g.framesBase || 0) + 1; }   // (CAB TRAFFIC: also over the window the TAXI CLOCK's check ran — to the booked arrival + 20 s — like for like)
    for (const c of cabsLive) for (const q of TS.cars) { if (q === c || Math.abs(q.x - c.x) > 9 || Math.abs(q.z - c.z) > 9 || !obb(c, q)) continue; g.overlapsCar++; if (g.pairs.length < 8) g.pairs.push({ t: +s.toFixed(2), q: q.kind, hold: q.hold || null, onWay: !!q.L?.cabOn?.has(c.cab), qLid: q.L?.id, qDir: q.L?.kind === 'lane' ? [q.L.ux, q.L.uz, +q.L.off.toFixed(2)] : null, cabL: c.L ? (c.L.kind === 'conn' ? 'conn' + c.L.turn + '@' + c.L.node.k : 'lane ' + c.L.axis + c.L.L + ' ' + [c.L.ux, c.L.uz, +c.L.off.toFixed(2)]) + ' #' + c.L.id + ' s' + c.s.toFixed(1) : null, cabPhase: c.cab ? (s < c.cab.P.tDep ? 'approach/stand' : s < c.cab.P.tStop ? 'ride' : 'drop') : null, at: [+c.x.toFixed(1), +c.z.toFixed(1)], qL: q.L ? (q.L.kind === 'conn' ? 'conn' + q.L.turn + '@' + q.L.node.k : 'lane ' + q.L.axis + q.L.L) + ' s' + q.s.toFixed(1) : null, cv: +c.v.toFixed(1), qv: +q.v.toFixed(1) }); } }
  return { Wd, run, a, at, stillRiding, g, cab, stats: mv.stats() }; }
const ids = [...W.places.map(p => p.id), ...W.lots.filter((l, k) => k % 4 === 0).map(l => l.id)], PICK = arg('trip', null);
const trips = [['plaza', 'fitstreet'], ['trailer', 'docks'], ['police', 'motel'], ['mall', 'hospital']].map(([a, b]) => T.trip(a, b, 'taxi', { dep: 600 }));
for (let k = 0; trips.length < 4 + N && k < 4000; k++) { const a = ids[(k * 7919) % ids.length], b = ids[(k * 104729 + 13) % ids.length]; if (a === b) continue; const tr = T.trip(a, b, 'taxi', { dep: 480 + (k * 37.3) % 900 }); if (tr?.legs.some(l => l.kind === 'taxi' && l.path?.length > 1)) trips.push(tr); }

if (PICK) { const [a, b, t] = PICK.split('|'); trips.length = 0; trips.push(T.trip(a, b, 'taxi', { dep: +t })); }
if (ONLY.has('f11') || ONLY.has('gate')) { const rows = []; let car = 0, frames = 0; const pairs = [];
  let carCar = 0, carCarBase = 0, framesBase = 0; for (const tr of trips) { const r = await ride(tr), L = tr.legs.find(l => l.kind === 'taxi'), v = r.stats.vlegs.find(x => x.kind === 'taxi');
    rows.push({ from: tr.from, to: tr.to, dep: tr.dep, booked: +((tr.arr - tr.dep) * 2.5).toFixed(1), late: r.at === null ? null : +(r.at - tr.arr).toFixed(3), rideLate: v ? v.late : null, stillRiding: r.stillRiding, stand: r.g.stand ?? null, slack: r.cab?.P.slack != null ? +r.cab.P.slack.toFixed(2) : null, lagAtDrop: r.g.dropT != null && r.cab ? +(r.g.dropT - r.cab.P.tStop).toFixed(2) : null, nSig: r.cab?.P.nSig ?? null, overlapsCar: r.g.overlapsCar, cabs: r.stats.fleet?.cabs });
    car += r.g.overlapsCar; carCar += r.g.carCar || 0; frames += r.g.frames; carCarBase += r.g.carCarBase || 0; framesBase += r.g.framesBase || 0; pairs.push(...r.g.pairs.slice(0, 3)); }
  const lates = rows.filter(r => r.late !== null).map(r => Math.abs(r.late)).sort((a, b) => a - b), q = f => lates[Math.min(lates.length - 1, Math.floor((lates.length - 1) * f))];
  out.f11 = { rides: rows.length, done: lates.length, stillRiding: rows.filter(r => r.stillRiding).length, lateMedian: q(.5), lateP90: q(.9), lateMax: lates.at(-1), rows };
  const f11ok = out.f11.stillRiding === 0 && out.f11.done === rows.length; if (ONLY.has('f11')) { console.log(`F11 ${f11ok ? 'PASS' : 'FAIL'}: ${lates.length}/${rows.length} rides on the kerb, still riding ${LATE_MAX} s past the booking ${out.f11.stillRiding}; |late| median ${q(.5)} · p90 ${q(.9)} · max ${lates.at(-1)} game min (the residual: not gated)`); if (!f11ok) bad++; }
  // (TAXI SLACK, 2026-10-09: the nudges — a car moved on along its way for a cab — and those of a car the camera sees, TS.seen: must be 0;
  // the cab's stand at the drop before its rider gets out, s: the slack it didn't need)
  const sum = k => rows.reduce((n, r) => n + (r.cabs?.[k] || 0), 0), nudges = { all: sum('nudges'), pushes: sum('pushes'), pushM: +sum('pushM').toFixed(1), cascadeM: +sum('cascade').toFixed(1), seen: sum('nudgesSeen'), seenM: +sum('nudgeSeenM').toFixed(1), offs: sum('offs'), cleared: sum('cleared'), entryDrops: sum('entryDrops') };
  const stands = rows.map(r => r.stand).filter(x => x != null).sort((a, b) => a - b);
  out.gate = { overlapsCar: car, carCar, frames, carCarBase, framesBase, nudges, stand: stands.length ? { median: stands[Math.floor((stands.length - 1) / 2)], p90: stands[Math.floor((stands.length - 1) * .9)], max: stands.at(-1) } : null, pairs: pairs.slice(0, 12) };
  // (CAB TRAFFIC, 2026-10-10: the cab is a car of the traffic — no nudge, no escort: the nudge counters stay for the record, at 0)
  if (ONLY.has('gate')) { const ok = car === 0; console.log(`gate ${ok ? 'PASS' : 'FAIL'}: cab–car overlaps ${car} in ${frames} steps, nudges while seen ${nudges.seen} (${nudges.seenM} m; every nudge ${nudges.all}: the cab's ${nudges.pushes}, ${nudges.pushM} m, a queue moved up ${nudges.cascadeM} m) (every body overlap in the traffic, TS.stat: ${carCar} in ${frames} steps; ${carCarBase} in the ${framesBase} steps to each booked arrival + 20 s${WIN ? ' — the arrival booked in --window\'s run: the same steps' : ''}, the old check's window) · off its clock ${nudges.offs} times · the stand at the drop before the rider gets out, s: median ${out.gate.stand?.median} p90 ${out.gate.stand?.p90} max ${out.gate.stand?.max}`); if (!ok) { bad++; console.log(JSON.stringify(pairs.slice(0, 8))); } } }

if (ONLY.has('f10')) { const rows = [];
  for (const tr of trips.slice(0, Math.min(trips.length, 8))) { const L = tr.legs.find(l => l.kind === 'taxi');
    for (const when of ['mid', 'arr']) { const rel = when === 'mid' ? (L.dep + L.arr) / 2 : Math.ceil(tr.arr); const r = await ride(tr, { releaseAt: rel, tail: 300 }), { TS } = r.Wd;
      const routeCars = TS.cars.filter(c => c.route && !c.stage).length, riderHeld = TS.cars.some(c => c.cab?.rider === r.a) || r.cab?.rider === r.a, kinCabs = TS.cars.filter(c => c.cab).length;
      TS.populate({ x: -250, z: -200 }, true, { seen: () => false, cam: [-250, -200, 270] }); const cabCar = r.cab?.c, stays = !!cabCar && TS.cars.includes(cabCar) && (cabCar.route || cabCar.kin);
      rows.push({ from: tr.from, to: tr.to, when, routeCars, riderHeld, kinCabs, staysAfterRepopulate: stays, queued: r.stats.fleet?.cabs?.queued ?? null }); } }
  const fails = rows.filter(r => r.routeCars || r.riderHeld || r.kinCabs || r.staysAfterRepopulate || r.queued);
  out.f10 = { checks: rows.length, fails: fails.length, rows }; console.log(`F10 ${fails.length ? 'FAIL' : 'PASS'}: ${rows.length - fails.length}/${rows.length} released riders left no cab behind (300 s on: no route car, no rider held, no kin cab, none kept by a camera jump)`); if (fails.length) { bad++; console.log(JSON.stringify(fails.slice(0, 4))); } }

if (ONLY.has('f12')) { const all = W.places.map(p => p.id), found = [], { GAME_MIN } = await imp('world/export/travel.mjs');
  // (three trips with a change, from the places, the first found in a fixed order: deterministic)
  for (const from of all) { for (const to of all) { if (from === to) continue; const tr = T.trip(from, to, 'subway', { dep: 600 }); if (tr?.legs.some(l => l.transfer)) found.push(tr); if (found.length >= 3) break; } if (found.length >= 3) break; }
  const rows = []; for (const tr of found) { const Wd = await world(), { mv } = Wd, a = { id: 'cabcheck-change', look: 0 }, run = mv.run(a, tr); let prev = null, max = 0, at = null, gaps = 0, offTable = 0;
    tr.legs.forEach((l, k) => { if (k && Math.abs(l.dep - tr.legs[k - 1].arr) > 1e-6) gaps++; if (l.kind === 'subway') { const L = T.lines.get(l.line), st = l.dir === 'fwd' ? L.stops : L.stops.slice().reverse(), dep = T.nextDep(L, l.dir, st.indexOf(l.from), l.dep - 1e-6); if (Math.abs(dep - l.dep) > 1e-3) offTable++; } });
    const i0 = tr.legs.findIndex(l => l.kind === 'stairs'), i1 = tr.legs.findLastIndex(l => l.kind === 'stairs');
    for (let s = (tr.legs[i0].dep - 1) * GAME_MIN; s < (tr.legs[i1].arr + 3) * GAME_MIN; s += .05) { Wd.t = s; const now = s / GAME_MIN; mv.frame(now); const f = run.frame(now, .05, a); if (f.show && prev?.show) { const d = Math.hypot(f.x - prev.x, f.z - prev.z); if (d > max) { max = d; at = +now.toFixed(2); } } prev = f; }
    rows.push({ from: tr.from, to: tr.to, legs: tr.legs.map(l => l.kind + (l.line ? '(' + l.line + ')' : '') + (l.transfer ? '(change)' : '')).join(' '), gaps, offTable, maxStep: +max.toFixed(3), at }); }
  const fails = rows.filter(r => r.maxStep > 2 || r.gaps || r.offTable); out.f12 = { trips: rows.length, fails: fails.length, rows };
  console.log(`F12 ${fails.length || !rows.length ? 'FAIL' : 'PASS'}: ${rows.length} subway changes, legs that don't follow on ${rows.reduce((n, r) => n + r.gaps, 0)}, rides off the timetable ${rows.reduce((n, r) => n + r.offTable, 0)}, the largest 50 ms step ${Math.max(0, ...rows.map(r => r.maxStep)).toFixed(2)} m (> 2 m in 50 ms — 40 m/s — is a jump)`); if (fails.length || !rows.length) { bad++; console.log(JSON.stringify(fails)); } }
if (globalThis.__cabPushTrace) for (const e of globalThis.__cabPushTrace.slice(0, 40)) console.log(JSON.stringify(e));
if (globalThis.__cabPushLog) console.log('pushes by cause (m):', JSON.stringify(Object.entries(globalThis.__cabPushLog).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, +v.toFixed(1)])));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
process.exit(bad ? 1 : 0);
