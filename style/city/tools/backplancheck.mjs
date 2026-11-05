// Planned departures, exercised through the actual record stage in Node, with graphics and the walker pool doubled.
// No browser, model, server or network. Record fixtures: REV3's 405 n11 fight 3150 and 404 n2 grab 198 (a12).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createCastPlan, createStandInputs } from '../simstate/record/cast-plan.js';
import { createShowPlanner } from '../simstate/record/show-plan.js';
import { createStandPlan } from '../simstate/record/stand-plan.js';
import { addressesFor } from '../simstate/record/addresses.js';

// The drawing is not under test. A chainable graphics double lets the real scene module load without WebGL or a CDN.
const graphics = `class G { constructor(){ this.position=this.rotation=this.scale=this.matrix=this.instanceMatrix=this; this.attributes={}; this.userData={}; } set(){return this} setUsage(){return this} setColorAt(){return this} setMatrixAt(){return this} setAttribute(){return this} setIndex(){return this} computeVertexNormals(){return this} computeBoundingSphere(){return this} rotateX(){return this} rotateY(){return this} translate(){return this} clone(){return new G} compose(){return this} makeRotationX(){return this} makeRotationZ(){return this} makeRotationY(){return this} makeTranslation(){return this} multiply(){return this} setFromEuler(){return this} setFromUnitVectors(){return this} normalize(){return this} setHex(){return this} copy(){return this} }
export {G as BoxGeometry,G as PlaneGeometry,G as CircleGeometry,G as BufferGeometry,G as Float32BufferAttribute,G as InstancedMesh,G as Mesh,G as MeshBasicMaterial,G as MeshStandardMaterial,G as Matrix4,G as Vector3,G as Quaternion,G as Euler,G as Color}; export const DynamicDrawUsage=0,AdditiveBlending=0;`;
const threeURL = 'data:text/javascript,' + encodeURIComponent(graphics);
registerHooks({ resolve(s, c, next) { return s === 'three' ? { url: threeURL, shortCircuit: true } : next(s, c); } });
const { createScenes } = await import('../stage/record.js');
const stageSource = fs.readFileSync(new URL('../stage/index.js', import.meta.url), 'utf8');
const stepSource = stageSource.slice(stageSource.indexOf('function stepActor('), stageSource.indexOf('  // give the walker back:'));
const stepActor = new Function('steer', 'EU', 'THREE', `return ${stepSource}`)((A, dx, dz, d) => [dx / d, dz / d], {}, {});
const stands = JSON.parse(fs.readFileSync(new URL('../simstate/stands.json', import.meta.url)));
const feed = seed => fs.readFileSync(new URL(`../../../core/runs/${seed}-A/feed.jsonl`, import.meta.url), 'utf8').trim().split('\n').map(JSON.parse);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const flat = (x, z, h) => ({ at: (px, pz) => Math.abs(px - x) <= h && Math.abs(pz - z) <= h ? ((Math.floor(px) + Math.floor(pz)) % 3 === 0 ? 1.5 : .2) : null });
function inputs(seed, night, eventId, ground = null) {
  const frames = feed(seed), book = addressesFor(frames[0].board.agents.map(a => a.id)), full = createShowPlanner(frames), plan = full.night(night);
  const sc = plan.scenes.find(s => typeof eventId === 'string' ? s.id === eventId : s.eventId === eventId), planner = { night: n => n === night ? { ...plan, scenes: [sc] } : full.night(n) };
  const cplan = createCastPlan({ frames, book, planner, stands, ground });
  return { frames, book, planner, sc, P: cplan.scene(sc), cplan, night };
}
function harness(I, speed = 1, landing = I.sc.start) {
  const { sc, P, night } = I, running = [], actors = new Map(), errors = [];
  const player = { minute: landing, speed, snapshot: () => ({ show: { night, active: [] } }) };
  const spots = new Map(Object.entries(stands.places).map(([k, p]) => [k, p.spots.map((s, k0) => ({ ...s, k: k0, place: k }))]));
  const map = new Map(P.figures.filter(g => g.id).map(g => { const spot = { x: g.mark.x + 20, z: g.mark.z, ry: 0, y: .2, place: P.key }, w = { p: [g.mark.x, .2, g.mark.z, 0], ph: 0, yawS: 0 };
    return [g.id, { id: g.id, w, spot, mode: 'stand', d: { kind: 'stand', place: P.key }, rec: {} }]; }));
  const agents = { map, spots, respot: id => map.get(id)?.spot, returnSpot: id => map.get(id)?.spot, heldAt: id => map.get(id)?.spot };
  const free = (A, o = {}) => { if (!A || A.freed) return; if (o.remove && !o.now) { A.linger = true; return; } A.freed = true; actors.delete(A.h); };
  const C = { clock: 0, camera: { position: { x: 0, z: 0 } }, psim: {}, busy: id => actors.has(id), occ: () => ({ at: () => .2 }), walkersNear: () => [], free,
    actor(id, { standIn } = {}) { if (actors.has(id)) return null; const a = map.get(id), p = a?.w?.p ?? (standIn ? [standIn.x, .2, standIn.z, standIn.ry ?? 0] : null); if (!p) return null;
      const A = { h: id, kind: a ? 'held' : 'standin', x: p[0], y: p[1], z: p[2], ry: p[3], home: p.slice(), tx: null, path: [], v: 0, w: a?.w ?? { p: p.slice(), ph: 0 } }; actors.set(id, A); return A; } };
  const stage = { ctx: C, run(v) { running.push(v); return v; }, stop(v) { v.end?.(true); running.splice(running.indexOf(v), 1); }, abortAll() { for (const v of running.splice(0)) v.end?.(true); for (const A of [...actors.values()]) free(A, { remove: true, now: true }); } };
  const scenes = createScenes({ ...I, stage, scene: { add() {} }, agents, layer: { homeAt: () => null }, wide: stands, looks: { of: () => 1 }, player, log: e => errors.push(e) });
  function frame(m, dt = 1 / 60) { player.minute = m; C.clock += dt; scenes.update(m, false); for (const v of [...running]) { v.t = (v.t ?? 0) + dt; v.step(v.t, dt);
      for (const A of v.actors ?? []) if (!A.freed && !A.linger) move(A, dt); } for (const A of actors.values()) if (A.linger) move(A, dt); }
  function move(A, dt) { if (A.tx === null && A.path?.length) [A.tx, A.tz] = A.path.shift(); stepActor(A, dt); A.w.p = A.w.fix?.slice() ?? A.w.p; }
  const snapshot = () => [...actors.values()].filter(A => !A.freed).map(A => ({ h: A.h, kind: A.kind, x: A.x, z: A.z }));
  return { frame, player, scenes, agents, actors, snapshot, errors };
}
const checks = [];
function check(name, run) { try { const detail = run(); checks.push(true); console.log('PASS ' + name + (detail ? ': ' + detail : '')); } catch (e) { checks.push(false); console.log('FAIL ' + name + ': ' + e.message.slice(0, 1200)); } }
check('#2 every attacking side returns on play (405 n11 fight 3150)', () => {
  const I = inputs(405, 11, 3150), H = harness(I); H.frame(I.sc.end - .01, 0); H.frame(I.sc.end, 0); H.frame(I.sc.end + 5 / 60, 0);
  for (const id of ['a19', 'a20', 'a22', 'a27']) { const a = H.actors.get(id), g = I.P.figures.find(g => g.id === id); assert.ok(a && distance(a, g.mark) > 1, `${id} held on its mark`); }
  assert.deepEqual(H.errors, []); return 'a19/a20/a22/a27 all walking back';
});
check('#3 aftermath stand-ins agree on play and seek (404 n2 grab 198)', () => {
  const I = inputs(404, 2, 198), H = harness(I, 10); let m = I.sc.end - .01; H.frame(m, 0);
  const end = I.sc.end + 7.5 / 60; while (m < end) { m = Math.min(end, m + 1 / 600); H.frame(m, .01); }
  const J = harness(I, 10, end); J.frame(end, 0); J.frame(end, 0);
  const a = H.snapshot().filter(A => A.kind === 'standin'), b = J.snapshot().filter(A => A.kind === 'standin');
  assert.deepEqual(H.errors, []); assert.ok(a.length > 0, 'fixture must still show departing stand-ins'); assert.equal(b.length, a.length, `${a.length} played, ${b.length} sought`);
  for (const A of a) { const B = b.find(B => B.h === A.h); assert.ok(B && distance(A, B) <= 2, `${A.h} differs by ${B ? distance(A, B).toFixed(3) : 'missing'} m`); }
  assert.deepEqual([...H.errors, ...J.errors], []); return `${a.length} figures within 2 m`;
});
check('#4 stage stand inputs follow rebuilt marks (404 n2 a12)', () => {
  let ready = false; const I = inputs(404, 2, 198, { occ: (x, z, h) => ready ? flat(x, z, h) : null });
  const SI = createStandInputs({ cplan: I.cplan, spotsOf: p => stands.places[p]?.spots }), m = I.sc.start + .01;
  SI.planMarks(m); const old = SI.planSpotAt('a12', I.P.key, m);
  const SP = createStandPlan({ roster: ['a12'], from: m, stateOf: () => ({ st: { key: I.P.key, place: I.P.key }, next: Infinity }), spotsOf: p => stands.places[p]?.spots, planned: SI.planSpotAt });
  SP.spotOf('a12', I.P.key, m); ready = true;
  const rebuilt = I.cplan.scene(I.sc).figures.find(g => g.id === 'a12').mark, current = SI.planSpotAt('a12', I.P.key, m);
  assert.ok(distance(old, rebuilt) > .05, 'ground fixture must move the mark'); assert.ok(distance(current, rebuilt) < 1e-6, `stage mark ${distance(current, rebuilt).toFixed(3)} m off rebuilt plan`);
  assert.ok(distance(SP.spotOf('a12', I.P.key, m), rebuilt) < 1e-6, 'stand plan retained a rebuilt cast mark');
  assert.ok(SI.planMarks(m).some(p => distance(p, rebuilt) < 1e-6), 'same-minute marks cache stale');
});
check('#5 minute owns position at 1x/10x/60x, seek and pause', () => {
  const I = inputs(405, 11, 3150), end = I.sc.end + 5 / 60, positions = [], failures = [];
  for (const speed of [1, 10, 60]) { const H = harness(I, speed); H.frame(I.sc.end - .01, 0); H.frame(I.sc.end, 0); H.frame(end, 1 / 60);
    const A = H.actors.get('a19'); positions.push({ speed, x: A.x - I.P.figures.find(g => g.id === 'a19').mark.x, z: A.z }); const before = { x: A.x, z: A.z };
    H.frame(end, 0); if (distance(A, before) >= 1e-6) failures.push(`${speed}x pause moved ${distance(A, before).toFixed(3)} m`); }
  const H = harness(I, 1, end); H.frame(end, 0); H.frame(end, 0); const A = H.actors.get('a19'), x = A.x - I.P.figures.find(g => g.id === 'a19').mark.x;
  for (const p of positions) if (Math.abs(p.x - x) >= 1e-6) failures.push(`${p.speed}x=${p.x.toFixed(3)}, seek=${x.toFixed(3)}`); assert.equal(failures.length, 0, failures.join('; ')); return JSON.stringify(positions);
});
check('play and seek evaluate a target return even during its next trip (406 n10 a14)', () => {
  const I = inputs(406, 10, 2695), m = I.sc.end + 4 / 60, P = harness(I), Q = harness(I, 1, m);
  P.agents.returnSpot = Q.agents.returnSpot = () => undefined; P.frame(I.sc.end - .01, 0); P.frame(I.sc.end, 0); P.frame(m, 0);
  const a = Q.agents.map.get('a14'); a.mode = 'leg'; a.d = { kind: 'trip', place: 'corner-2_-8' }; Q.frame(m, 0); Q.frame(m, 0);
  const p = P.snapshot().find(A => A.h === 'a14'), q = Q.snapshot().find(A => A.h === 'a14'); assert.ok(q, 'seek omitted the return because its record had started the next trip'); assert.ok(distance(p, q) < 1e-6);
});
check('a trip delayed by a return stays a trip through its drawn arrival', () => {
  const draw = fs.readFileSync(new URL('../simstate/record/draw.js', import.meta.url), 'utf8'), movement = fs.readFileSync(new URL('../simstate/movement.js', import.meta.url), 'utf8');
  const la0 = movement.indexOf('export function lateArrival('), la1 = movement.indexOf('\n}', la0) + 2;
  const mt0 = movement.indexOf('export const MOVE = ') + 20, mt1 = movement.indexOf('\n};', mt0) + 2;
  const moveTune = new Function(`return (${movement.slice(mt0, mt1)})`)();
  const arrival = new Function('ON_FOOT', 'MOVE', `return ${movement.slice(la0 + 7, la1)}`)(new Set(['walk','skate','bike','scooter']), moveTune);
  const trip = { dep: 100, arr: 100.2, legs: [{ kind: 'walk' }] }, e = 100.19, expected = arrival(trip, e - trip.dep, e), m = (trip.arr + expected) / 2;
  const ts = { trip, next: trip.arr }, s = { id: 'a14', since: trip.arr, arrive: [0,.2,0], m, next: Infinity };
  const get = name => { const start = draw.indexOf('function ' + name + '('); return draw.slice(start, draw.indexOf('\n  }', start) + 4); };
  const end = new Function('stateAt','exitFor','lateArrival','scenes', `return ${get('lateEnd')}`)(() => ts, () => null, arrival, { backPlan: { forTrip: () => ({ end: e, to: { x: 0, z: 0 } }) } });
  const state = new Function('lateEnd', `return ${get('lateState')}`)(end);
  assert.ok(expected > trip.arr); assert.equal(end('a14', s, m).end, expected, 'drawing cut the return-delayed trip at its booking');
  assert.equal(state('a14', s, m).trip, trip, 'arrived state replaced an unfinished trip');
});
check('a scene home fallback is its entry point, not its assigned house (404 n5 a01)', () => {
  const I = inputs(404, 5, 978), H = harness(I); H.agents.returnSpot = () => undefined;
  H.frame(I.sc.end - .01, 0); H.frame(I.sc.end, 0);
  const row = H.scenes.backPlan.scene(I.sc, I.sc.end).find(r => r.id === 'a01');
  assert.ok(row && distance(row.from, row.to) < 1e-6, 'fallback sent the actor across the city to its roster house');
});
check('an actor already on its next trip returns to its planned scene spot (406 n10 a14)', () => {
  const I = inputs(406, 10, 2695), H = harness(I), id = 'a14'; H.agents.returnSpot = () => undefined;
  H.frame(I.sc.end - .01, 0); H.frame(I.sc.end, 0); H.frame(I.sc.end + 3 / 60, 0);
  const A = H.actors.get(id), row = A?.departure; assert.ok(row, 'target return missing');
  const k = I.cplan.night(10).spots.get(I.P.key).get(id), sp = stands.places[I.P.key].spots[k];
  assert.ok(distance(row.to, sp) < 1e-6, `return went home (${row.to.x},${row.to.z}) instead of its reserved scene spot`);
});
for (const stepKind of ['path', 'out']) check(`a boarder transfers at its completed trip endpoint (${stepKind} walk-off)`, () => {
  const I = inputs(405, 14, '4204:board:4226'), full = createShowPlanner(I.frames), plan = full.night(14), ferry = plan.scenes.find(s => s.kind === 'ferry');
  I.planner = { night: () => ({ ...plan, scenes: [I.sc, ferry] }) }; I.continuity = { castOf: sc => sc.id === I.sc.id ? ['a07'] : [] };
  const H = harness(I, 10), spot = { x: 88, z: -264, y: .2, place: 'docks' }, w = { p: [90,.2,-270,0], ph: 0 };
  const a = { id: 'a07', w, spot, mode: 'out', step: { kind: stepKind }, d: { kind: 'stand', place: 'docks' }, rec: {} }; H.agents.map.set('a07', a);
  const source = fs.readFileSync(new URL('../simstate/agents.js', import.meta.url), 'utf8'), start = source.indexOf('function boardReady(id) {');
  if (start >= 0) { const end = source.indexOf('\n  return {', start); H.agents.boardReady = new Function('A', 'clockNow', `return ${source.slice(start, end)}`)(H.agents.map, () => H.player.minute); }
  a.rec.trip = {}; if (H.agents.boardReady) assert.equal(H.agents.boardReady('a07'), false, 'trip interrupted'); a.rec.trip = null;
  a.run = { busyNow: () => true }; if (H.agents.boardReady) assert.equal(H.agents.boardReady('a07'), false, 'ride interrupted'); a.run = { busyNow: () => false, done: false }; if (H.agents.boardReady) assert.equal(H.agents.boardReady('a07'), false, 'walking trip interrupted'); a.run = null;
  H.frame(I.sc.start, 0); H.scenes.frame(); H.frame(I.sc.start, 0);
  const A = H.actors.get('a07'); assert.ok(A, 'completed arrival was left on its stand walk-off through the boarding window');
  assert.ok(distance(A, { x: 90, z: -270 }) < 1e-6, 'taking the boarder cut it to the queue');
  H.player.minute = (I.sc.beats.find(b => b.name === 'gangway').start + I.sc.end) / 2; H.scenes.frame(); H.frame(H.player.minute, 0);
  const L = H.scenes.log().find(L => L.id === I.sc.id); assert.ok(L.actors.includes('a07') && L.clips.includes('evicted_carry'));
  assert.deepEqual(H.errors, []);
});
check('a return keeps its body when another performance window opens', () => {
  const I = inputs(405, 11, 3150), H = harness(I); H.frame(I.sc.end - .01, 0); H.frame(I.sc.end, 0);
  H.agents.map.get('a20').rec.show = { sceneId: 'another-performance' }; H.frame(I.sc.end + 5 / 60, 0);
  assert.ok(H.actors.get('a20') && !H.actors.get('a20').freed, 'return was freed before its planned arrival');
});
for (const hasStay of [true, false]) check(`a completed return rejoins motion without its old lane (stay=${hasStay})`, () => {
  const source = fs.readFileSync(new URL('../simstate/agents.js', import.meta.url), 'utf8'), start = source.indexOf('finishReturn(id, minute'), end = source.indexOf('},', start) + 1;
  const destination = { x: 20, y: .2, z: 0, ry: 0 }, a = { id: 'a20', mode: 'walk', goalFor: 'old-goal', held: { E: {}, fix: [0,.2,0,0] } };
  const finish = new Function('A', 'heldAt', 'release', `return { ${source.slice(start, end)} }.finishReturn`)(new Map([['a20', a]]), () => hasStay ? destination : undefined, () => {});
  finish('a20', 5, destination); assert.equal(a.mode, 'stand', 'return left its body in the old lane mode'); assert.equal(a.held.E, null); assert.deepEqual(a.held.fix, [20,.2,0,0]);
});
check('a departing partner stays visible without extending its scene log', () => {
  const I = inputs(404, 1, '33:play:a01'), H = harness(I), id = I.sc.publicActors[0], sp = { ...I.P.spot, place: I.P.key, y: .2 };
  H.agents.map.set(id, { id, spot: sp, rec: {}, d: { kind: 'stand', place: I.P.key }, mode: 'stand', w: { p: [sp.x, .2, sp.z, sp.ry ?? 0], ph: 0 } });
  H.frame(I.sc.start, 0); H.frame(I.sc.end - .001, 0); H.frame(I.sc.end + .1, 0);
  assert.deepEqual(H.errors, []); const L = H.scenes.log().find(L => L.id === I.sc.id);
  assert.ok(H.snapshot().some(A => A.kind === 'standin'), 'departing partner must remain drawn');
  assert.ok(L.last <= I.sc.end + .05, `scene log extended to ${L.last}, beyond ${I.sc.end}`);
});
// Pure plan properties are exercised once the module exists; the four integration checks above already fail on the base.
const url = new URL('../simstate/record/back-plan.js', import.meta.url);
if (fs.existsSync(url)) { const B = await import(url);
  check('pure path evaluation, prefix and causal departure inputs', () => {
    const I = inputs(405, 11, 3150), cut = I.frames.findIndex(f => f.step.kind === 'night' && f.day === 11), J = { ...I, frames: I.frames.slice(0, cut + 1) };
    const make = X => B.createBackPlan({ cplan: X.cplan, walkPath: (p, q) => [p, [p[0], q[1]], q], spotAt: (id, place, m) => { assert.ok(m <= I.sc.end + 3 / 60); return { x: 20, z: 30 }; } });
    const C = createCastPlan({ ...J, stands, planner: createShowPlanner(J.frames) }); J.cplan = C;
    const early = make(I); assert.deepEqual(early.scene(I.sc, I.sc.start), []);
    const rows = make(I).scene(I.sc), again = make(I).scene(I.sc), prefix = make(J).scene(I.sc); assert.deepEqual(rows, again); assert.deepEqual(rows, prefix);
    for (const r of rows) { const q = B.backAt(r, r.start + 5 / 60); assert.deepEqual(q, B.backAt(r, r.start + 5 / 60)); assert.ok(r.path.length >= 2); }
    const straight = B.backRow({ from: { x: 0, z: 0 }, to: { x: 20, z: 0 }, start: 0, walkPath: (a, b) => [a, b] });
    assert.equal(B.backAt(straight, 5 / 60).x, 6.5);
    const overlap = make(I).forTrip?.('a21', I.sc.end, I.sc.end + .1); assert.ok(overlap && overlap.end > I.sc.end, 'trip has no planned return deferral');
    assert.deepEqual(overlap, make(I).forTrip?.('a21', I.sc.end, I.sc.end + .1));
    const clean = taken => B.backRow({ from: { x: 0, z: 0 }, to: { x: 20, z: 0, taken, entry: { streamed: taken } }, start: 0 });
    assert.deepEqual(clean('first-page-holder'), clean('other-page-holder'), 'page occupancy/streamed lane leaked into a pure departure row');
  });
}
console.log(checks.every(Boolean) ? 'backplancheck PASS' : 'backplancheck FAIL');
process.exitCode = checks.every(Boolean) ? 0 : 1;
