// Node only: the real carriage loop and riders' CPU animation, with a stub DOM, RAF, timers and renderer.
// No copy of the timeline: only the stage construction, body bake and GPU writes are replaced.
//   node style/city/tools/carclockcheck.mjs [--revision d5e8a12]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WALK2, buildGait, gait2State, stepGait2 } from '../anim/cast/gait2.js';
import { stepIdle, IDLE_POOL } from '../anim/cast/idle.js';
import { CLIP, playClip, stopClip, stepClip } from '../anim/cast/clips/index.js';

const revision = process.argv.includes('--revision') ? process.argv[process.argv.indexOf('--revision') + 1] : null;
const sources = new Map();
const source = name => {
  if (!sources.has(name)) sources.set(name, revision ? execFileSync('git', ['show', `${revision}:style/city/subway/${name}.js`], { encoding: 'utf8', cwd: fileURLToPath(new URL('../../../', import.meta.url)) })
    : fs.readFileSync(new URL(`../subway/${name}.js`, import.meta.url), 'utf8'));
  return sources.get(name);
};
const cpuSource = text => text.replace(/^import .*;[^\n]*\n/gm, '').replace(/\bexport (?=(?:async )?(?:function|const|let|class)\b)/g, '');
const netContext = vm.createContext({ SIMCLOCK: { pace0: .4 } });
new vm.Script(cpuSource(source('net')).replaceAll('import.meta.url', JSON.stringify(new URL('../subway/net.js', import.meta.url).href))
  + '\nglobalThis.helpers = { stateAt, changesAt };').runInContext(netContext);
const { stateAt, changesAt } = netContext.helpers;
const G = buildGait(WALK2);
const noop = () => {};
class Vec {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  setScalar(x) { return this.set(x, x, x); }
  project() { return this; }
  applyMatrix4() { return this; }
}
class Matrix {
  compose() { return this; } identity() { return this; } multiply() { return this; }
  multiplyMatrices() { return this; } makeTranslation() { return this; }
  makeRotationZ() { return this; } makeRotationY() { return this; }
}
class Node {
  constructor() {
    this.position = new Vec(); this.rotation = new Vec(); this.style = { setProperty(k, v) { this[k] = v; } };
    this.classList = { add: noop, remove: noop }; this.nodes = new Map(); this.visible = true;
  }
  appendChild() {} setAttribute() {} addEventListener() {} removeEventListener() {} remove() {}
  updateWorldMatrix() {} lookAt() {} updateProjectionMatrix() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 700 }; }
  querySelector(s) { if (!this.nodes.has(s)) this.nodes.set(s, new Node()); return this.nodes.get(s); }
}
class Geometry {
  constructor() { this.attributes = {}; }
  setAttribute(k, v) { this.attributes[k] = v; } setIndex(v) { this.index = v; } dispose() {}
}
class Batch extends Node {
  constructor() { super(); this.k = 0; }
  addGeometry() { return 0; } addInstance() { return this.k++; }
  setGeometrySize() {} setVisibleAt() {} setMatrixAt() {} dispose() {} removeFromParent() {}
}
const THREE = { Vector3: Vec, Matrix4: Matrix, Quaternion: Matrix, MeshStandardMaterial: class {}, MeshDepthMaterial: class {},
  BufferGeometry: Geometry, BufferAttribute: class { constructor(array, size) { this.count = array.length / size; } }, BatchedMesh: Batch };
const full = { P: new Float32Array(3), N: new Float32Array(3), C: new Uint8Array(4), K: [0], I: new Uint32Array(1) };
let opening = 0;

async function open({ at = 0, program = rideProgram(), seed = 7 } = {}) {
  let page = 0, island = at, nextId = 0, random = ++opening * 19, done = 0, closeReason = null, poses = [], frames = 0;
  const rafs = new Map(), timers = new Map(), bodies = [];
  const math = Object.create(Math);
  math.random = () => ((random = Math.imul(random, 1664525) + 1013904223 >>> 0) / 2 ** 32);
  const clock = {
    requestAnimationFrame(fn) { const id = ++nextId; rafs.set(id, fn); return id; },
    cancelAnimationFrame: id => rafs.delete(id),
    setTimeout(fn, ms) { const id = ++nextId; timers.set(id, { at: page + ms / 1000, fn }); return id; },
    clearTimeout: id => timers.delete(id), performance: { now: () => page * 1000 }, Math: math,
  };
  const riderContext = vm.createContext({ THREE, C: {}, bakeSegFull: () => full, WALK2, gait2State, stepGait2, stepIdle, IDLE_POOL,
    CLIP, playClip, stopClip, stepClip, Math: math, createFineAtlas: () => ({ adopt: noop, tex: { dispose: noop }, stats: () => ({ tiles: 0 }) }),
    installFine: noop, fineAttr: noop, installAnim2: noop, animUniforms2: () => [{}, G],
    createAnimTexture2: () => ({ image: { data: [] }, dispose: noop }), writeGait2: noop });
  new vm.Script(cpuSource(source('riders')) + '\nglobalThis.factory = createCrowd;').runInContext(riderContext);
  const car = new Node(), plat = new Node(), renderer = { domElement: new Node(), setSize: noop,
    info: { render: { calls: 0, triangles: 0 }, programs: [] }, render() { frames++; } };
  const instanced = () => ({ setMatrixAt: noop, instanceMatrix: {} });
  const stage = { renderer, scene: { add: noop }, camera: new Node(), car, plat, cards: [],
    leaves: [-5, 0, 5].flatMap(d => [-1, 1].map(s => ({ d, s, g: new Node() }))),
    stripeMat: { color: { setHex: noop } }, stripTex: { userData: { redraw: noop } }, wallTex: { userData: { redraw: noop } },
    ribs: instanced(), lamps: instanced(), sigs: instanced(), platLight: new Node() };
  const context = vm.createContext({ ...clock, console, THREE, C: { rollLook: n => ({ n }) }, stateAt, changesAt,
    CLIP, playClip, stopClip, stepClip, gait2State, stepGait2, WALK2, stepIdle, IDLE_POOL,
    document: { createElement: () => new Node(), head: new Node(), body: new Node() },
    ResizeObserver: class { observe() {} disconnect() {} }, addEventListener: noop, removeEventListener: noop,
    createCrowd(o) {
      const crowd = riderContext.factory(o), add = crowd.add, frame = crowd.frame;
      crowd.add = (...args) => { const b = add(...args); if (b) bodies.push(b); return b; };
      crowd.frame = (entries, dt) => { frame(entries, dt); poses = entries; };
      return crowd;
    },
    testStage: () => stage,
  });
  new vm.Script(cpuSource(source('carriage')) + `
    buildStage = testStage;
    cardTextures = async () => [];
    warmStage = async () => 0;
    globalThis.open = openCarriage;
  `, { importModuleDynamically: async () => ({}) }).runInContext(context);
  const framePage = (seconds, t) => {
    page += seconds; island = t;
    for (const [id, timer] of [...timers]) if (timer.at <= page) { timers.delete(id); timer.fn(); }
    const pending = [...rafs]; rafs.clear(); for (const [, fn] of pending) fn(page * 1000);
  };
  let handle, error;
  context.open({ program, net, now: () => island, agent: { id: 'clock-rider' }, seed,
    onDone: () => done++, onClose: why => { closeReason = why; } }).then(h => { handle = h; }, e => { error = e; });
  for (let i = 0; !handle && !error && i < 50; i++) {
    await new Promise(resolve => setImmediate(resolve)); framePage(1 / 60, island);
  }
  if (error) throw error;
  assert(handle, 'stub stage must finish opening');
  framePage(0, island);
  return {
    tick: framePage, handle,
    snapshot: () => JSON.parse(JSON.stringify({ t: handle.t, state: handle.state(), poses: poses.map(e => ({
      k: e.body.k, parent: e.parent === car ? 'car' : 'platform', x: e.x, z: e.z, yaw: e.yaw,
      lean: e.lean, clip: e.clip, show: e.show, g: JSON.parse(JSON.stringify(e.body.g, (k, v) => k === 'c' ? v.name : v)),
    })),
      car: { rotation: car.rotation, position: car.position }, camera: stage.camera.position,
      platform: { visible: plat.visible, position: plat.position }, doors: stage.leaves.map(l => l.g.position.x),
      fade: handle.view.root.style['--sbw-fade'], age: handle.view.root.style['--sbw-age'], done, closeReason })),
    get bodies() { return bodies; }, get frames() { return frames; },
    startupPageSeconds: page, startupBodies: bodies.length,
  };
}

const net = { lines: new Map(['a', 'b'].map((id, i) => [id, { id, bullet: id, hex: i ? 0xff7a1a : 0x2f5bff, name: id,
  stops: ['start', 'change', 'end'], term: { fwd: 'end' } }])), stations: new Map(), nameOf: id => id };
function rideProgram({ transfer = false, duration = 900 } = {}) {
  const segs = [
    { kind: 'dwell', t0: 0, t1: 8, st: 'start', line: 'a', dir: 'fwd', board: true },
    { kind: 'run', t0: 8, t1: transfer ? 20 : duration, a: 'start', b: transfer ? 'change' : 'end', m: transfer ? 50 : 1000, line: 'a', dir: 'fwd' },
  ];
  if (transfer) segs.push(
    { kind: 'dwell', t0: 20, t1: 30, st: 'change', line: 'b', dir: 'fwd', change: true, board: true },
    { kind: 'run', t0: 30, t1: duration, a: 'change', b: 'end', m: 90, line: 'b', dir: 'fwd' });
  return { t0: 0, dur: duration, segs, from: 'start', to: 'end', lines: transfer ? ['a', 'b'] : ['a'] };
}
function playTo(run, target, speed, from = 0, fps = 60) {
  const n = Math.ceil((target - from) / speed * fps - 1e-9);
  for (let i = 1; i <= n; i++) { const t = Math.min(target, from + i * speed / fps), prev = Math.min(target, from + (i - 1) * speed / fps); run.tick((t - prev) / speed, t); }
}
const rounded = x => +x.toFixed(9);
function picture(run) {
  const s = run.snapshot();
  // Bake counters and WebGL calls describe page work; compare the actual drawing inputs, including every gait and clip field.
  return { poses: s.poses, car: s.car, camera: s.camera, platform: s.platform, doors: s.doors, fade: s.fade, age: s.age, line: s.state.line,
    riders: s.state.riders, waiting: s.state.waiting, agent: s.state.agent, done: s.done, closeReason: s.closeReason };
}
let failures = 0, checks = 0;
let maxPositionError = 0, maxPhaseError = 0;
function check(label, fn) {
  checks++;
  try { fn(); console.log(`PASS ${label}`); }
  catch (error) { failures++; console.log(`FAIL ${label}: ${error.message.split('\n')[0]}`); }
}
function same(actual, expected) {
  for (const p of actual.poses) {
    const q = expected.poses.find(q => q.k === p.k); if (!q) continue;
    const x = p.x + (p.parent === 'platform' ? actual.platform.position.x : 0), y = q.x + (q.parent === 'platform' ? expected.platform.position.x : 0);
    maxPositionError = Math.max(maxPositionError, Math.hypot(x - y, p.z - q.z));
    if (p.clip && p.clip === q.clip && p.g.clip && q.g.clip) maxPhaseError = Math.max(maxPhaseError, Math.abs(p.g.clip.t - q.g.clip.t));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(actual, (k, v) => typeof v === 'number' ? rounded(v) : v)),
    JSON.parse(JSON.stringify(expected, (k, v) => typeof v === 'number' ? rounded(v) : v)));
}

for (const speed of [1, 10, 60]) {
  const run = await open(), b = run.bodies.find(b => b.playing === 'sit_ride');
  assert(b?.g.clip, 'initial seated rider must have its authored clip');
  const phase = b.g.clip.t;
  playTo(run, 6 * speed, speed);
  const riderSeconds = b.g.clip.t - phase;
  console.log(`6 page seconds at ${speed}x: train ${run.handle.t.toFixed(6)} s; seated clip +${riderSeconds.toFixed(6)} s`);
  if (speed === 1) console.log(`stub opening: ${run.startupPageSeconds.toFixed(6)} page s, ${run.startupBodies} bodies`);
  check(`${speed}x loses no island seconds`, () => assert(Math.abs(riderSeconds - 6 * speed) < 1e-7));
  run.handle.close();
}
for (const [label, target, opts] of [
  ['entry', 0, {}], ['boarding', 2, {}], ['off-grid boarding', 2.007, {}], ['under way', 12, {}],
  ['change before refill', 23.1, { transfer: true, duration: 45 }],
  ['change after refill', 23.3, { transfer: true, duration: 45 }],
  ['after changing trains', 28, { transfer: true, duration: 45 }],
  ['arrival fade', 45.2, { transfer: true, duration: 45 }],
]) {
  const normal = await open({ program: rideProgram(opts) }); playTo(normal, target, 1);
  const expected = picture(normal);
  for (const speed of [10, 60]) {
    const run = await open({ program: rideProgram(opts) }); playTo(run, target, speed);
    check(`${label} at ${target}s: ${speed}x equals 1x (positions, clips, sway, camera, refill)`, () => same(picture(run), expected));
    run.handle.close();
  }
  const seek = await open({ at: target, program: rideProgram(opts) });
  check(`${label} at ${target}s: seek equals 1x`, () => same(picture(seek), expected));
  const frozen = picture(normal); for (let i = 0; i < 120; i++) normal.tick(1 / 60, target);
  check(`${label}: paused for 2 page seconds`, () => same(picture(normal), frozen));
  normal.handle.close(); seek.handle.close();
}
// Non-uniform page frames, a clock speed change, and an entire skipped station must sample the same drawing.
{
  const opts = { transfer: true, duration: 45 }, normal = await open({ program: rideProgram(opts) });
  playTo(normal, 28.007, 1);
  for (const fps of [24, 144]) {
    const run = await open({ program: rideProgram(opts) }); playTo(run, 28.007, 10, 0, fps);
    check(`${fps} FPS equals 60 FPS at the same island second`, () => same(picture(run), picture(normal)));
    run.handle.close();
  }
  const hitch = await open({ program: rideProgram(opts) });
  hitch.tick(.5, 28.007);
  check('one frame crosses the change and refill', () => same(picture(hitch), picture(normal)));
  const varied = await open({ program: rideProgram(opts) });
  playTo(varied, 2, 1); playTo(varied, 12, 60, 2); playTo(varied, 28.007, 10, 12);
  check('speed changes keep the same drawing', () => same(picture(varied), picture(normal)));
  normal.handle.close(); hitch.handle.close(); varied.handle.close();
}
{
  const program = rideProgram({ transfer: true, duration: 45 }), original = JSON.stringify(program);
  const first = await open({ program }); playTo(first, 28, 10); const expected = picture(first); first.handle.close();
  check('drawing never writes boarding flags into the shared program', () => assert.equal(JSON.stringify(program), original));
  const reopen = await open({ program, at: 28 });
  check('reopening the same program after a seek', () => same(picture(reopen), expected));
  reopen.handle.close();
}
// Explicit timer boundaries: refill at 20 + 3 + .18, close at 45 + .45 island seconds.
for (const speed of [1, 10, 60]) {
  const run = await open({ program: rideProgram({ transfer: true, duration: 45 }) });
  playTo(run, 23.1, speed);
  const before = picture(run); for (let i = 0; i < 60; i++) run.tick(1 / 60, 23.1);
  check(`${speed}x: pending refill stays paused`, () => same(picture(run), before));
  playTo(run, 23.3, speed, 23.1);
  check(`${speed}x: refill boards the agent at 23.3s`, () => {
    assert.equal(run.snapshot().state.agent, 'walk');
    assert(run.snapshot().poses.find(p => p.k === 0).z < -2.7, 'agent must be boarding from the new platform');
  });
  playTo(run, 45.2, speed, 23.3);
  check(`${speed}x: end remains open before 45.45s`, () => assert.equal(run.handle.closed, false));
  playTo(run, 45.5, speed, 45.2);
  check(`${speed}x: end closes once after 45.45s`, () => { assert.equal(run.handle.closed, true); assert.equal(run.snapshot().done, 1); });
  run.handle.close();
}
for (const lostClock of [null, 44]) {
  const run = await open({ program: rideProgram({ transfer: true, duration: 45 }) });
  playTo(run, 45.2, 10); run.tick(0, lostClock);
  for (let i = 0; i < 60; i++) run.tick(1 / 60, lostClock);
  check(`seek ${lostClock === null ? 'loses the clock' : 'backward'} during the exit: closes without onDone`, () => {
    assert(run.handle.closed); assert.equal(run.snapshot().closeReason, 'seek'); assert.equal(run.snapshot().done, 0);
  });
}
console.log(`maximum disagreement: position ${maxPositionError.toFixed(9)} m; clip clock ${maxPhaseError.toFixed(9)} s`);
console.log(`CARCLOCKCHECK ${failures ? 'FAIL' : 'PASS'}: ${checks - failures}/${checks} checks${revision ? ` (${revision})` : ''}`);
if (failures) process.exitCode = 1;
