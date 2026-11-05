// Node only: the refinement regression, baseline/candidate parity, and paired timings.
// --at <revision> tests that revision without changing the checkout or any git ref.
// Only imports are adapted: real world/column code and the real gpu.js CUT uniform,
// and no browser Worker (tick uses the world's synchronous build fallback).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { register } from 'node:module';

// The plan and GPU modules import three; no rendering API is used by this check.
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) {
  if (s === 'three') return { url: 'data:text/javascript,export default {};', shortCircuit: true };
  return next(s, c);
}`));
const { P } = await import('../../../world/city.js');

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const WORLD = 'style/city/camera/world.js', BASE = 'd5e8a12';
const atIndex = process.argv.indexOf('--at');
const AT = atIndex < 0 ? null : process.argv[atIndex + 1];
assert(atIndex < 0 || AT, '--at needs a revision');
const readAt = revision => execFileSync('git', ['show', `${revision}:${WORLD}`], { cwd: ROOT, encoding: 'utf8' });
async function load(source, label) {
  const imports = {
    './world.worker.js': new URL('../camera/world.worker.js', import.meta.url).href,
    '../plan.js': new URL('../plan.js', import.meta.url).href,
    '../gpu.js': new URL('../gpu.js', import.meta.url).href,
    '../vehicles/index.js': new URL('../vehicles/index.js', import.meta.url).href,
  };
  for (const [from, to] of Object.entries(imports)) {
    assert(source.includes(`'${from}'`), `import boundary ${from}`);
    source = source.replace(`'${from}'`, JSON.stringify(to));
  }
  return import('data:text/javascript,' + encodeURIComponent(source + `\nexport { CUT };\n// ${label}\n`));
}
const before = await load(readAt(BASE), 'baseline');
const after = await load(AT ? readAt(AT) : fs.readFileSync(new URL('../camera/world.js', import.meta.url), 'utf8'), 'candidate');
const failures = [];
function check(label, fn) {
  try { console.log(`${label} ${JSON.stringify(fn())} PASS`); }
  catch (e) { failures.push(label); console.error(`${label} FAIL: ${e.message}`); }
}
const point = (x, y, z) => ({ x, y, z });
const closed = new Float32Array(16);
function cut(cx = 18, cz = 18, angle = 0) {
  return new Float32Array([cx, cz, Math.cos(angle), Math.sin(angle), 5.1, 4.01, 20, 1, -5.1, 3.55, 6, 4.3, 1.01, 4.01, -4.3, 0]);
}
// Horizontal faces are the builder's actual input; centimetres relative to the block.
function mesh(boxes) {
  const vertices = [], normals = [];
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    for (const [y, normal] of [[y0, -127], [y1, 127]]) {
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
        vertices.push(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)); normals.push(0, normal, 0);
      }
    }
  }
  return { P: new Int16Array(vertices), N: new Int8Array(normals), o: [0, 0, 0], n: vertices.length / 3 };
}
const solid = mesh([[0, 0, 0, P, 6, P]]);
const home = mesh([[10, 0, 10, 26, 1, 26], [12, 1, 12, 24, 4, 24], [11, 4, 11, 25, 5, 25],
  [7, 0, 17, 7.25, 3, 17.25], [7, 3, 17, 8, 3.5, 18], [0, 0, 0, P, .25, P]]);
const options = { prefetch: -1, keepR: 1000, maxBlocks: 128, thinMax: .6 };
function fixture(module, full = home, { far = null, coords = [[0, 0]], ...opts } = {}) {
  const blocks = new Map(coords.map(([i, j]) => [i + ',' + j, { data: {
    full: full ? [{ ...full, o: [i * P, 0, j * P] }] : [],
    far: far ? { ...far, o: [i * P, 0, j * P] } : null,
  } }]));
  const world = module.createWorld({ stream: { blocks } }, { ...options, ...opts });
  function settle(tier = 'full') {
    for (const [i, j] of coords) world.entry(i, j);
    for (let n = 0; n < coords.length * 3 + 4; n++) {
      world.tick(point(P / 2, 8, P / 2));
      for (const [i, j] of coords) world.entry(i, j);
    }
    for (const [i, j] of coords) assert.equal(world.tierAt(i * P + .1, j * P + .1), tier, 'fixture tier installed');
    assert.equal(world.stat.errors, 0, 'fixture build errors');
  }
  return { world, blocks, settle };
}
const smallCut = new Float32Array([.125, .875, 1, 0, .4, 1, 5, 1, -.2, -.2, .2, .4, 1, 5, -.2, 0]);
const reproA = point(.125, 2, .875), reproB = point(.2, 2, .9);
function refined(module) {
  module.CUT.value.set(smallCut);
  const f = fixture(module, null, { far: solid });
  const farHit = f.world.ray(reproA, reproB);
  assert.equal(farHit?.kind, 'inside', 'far cell straddles the cut');
  f.blocks.get('0,0').data.full = [solid]; f.settle();
  const hit = f.world.ray(reproA, reproB);
  const fresh = fixture(module, solid); fresh.settle();
  const expected = fresh.world.ray(reproA, reproB);
  assert.equal(expected, null, 'fresh full cell is entirely cut');
  return { f, fresh, hit, expected };
}
check('item1 refinement', () => {
  const old = refined(before), next = refined(after);
  assert.equal(old.hit?.kind, 'inside', 'pinned baseline must reproduce the defect');
  console.log(`item1 baseline=${JSON.stringify(old.hit)} candidate=${JSON.stringify(next.hit)} fresh=${JSON.stringify(next.expected)}`);
  assert.deepEqual(next.hit, next.expected, 'refined world must match fresh full world');
  // Adjacent cells and opposite traversal orders exercise both cached null and cut heights.
  let rays = 0, corrected = 0;
  for (let z = .025; z < 1.5; z += .05) for (const reverse of [false, true]) {
    const a = point(.125, 2, z), b = point(.2, 2, z + .01);
    const args = reverse ? [b, a] : [a, b];
    const expected = next.fresh.world.ray(...args), actual = next.f.world.ray(...args);
    assert.deepEqual(actual, expected, `refinement ray z=${z}`);
    if (!isDeepStrictEqual(old.f.world.ray(...args), expected)) corrected++;
    rays++;
  }
  // New entries after clear, and changing/reopening the uniform, must shed old cache state.
  next.f.world.clear(); next.f.settle(); assert.equal(next.f.world.ray(reproA, reproB), null);
  after.CUT.value.set(closed); assert(next.f.world.ray(reproA, reproB));
  after.CUT.value.set(smallCut); assert.equal(next.f.world.ray(reproA, reproB), null);
  return { rays, corrected };
});

function random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
check('item3 equality', () => {
  const a = fixture(before), b = fixture(after); a.settle(); b.settle();
  const rng = random(0xc27031), counts = { rays: 0, hits: 0, clear: 0, sweep: 0, overlap: 0, inside: 0, distance: 0, nearestFree: 0, fan: 0, mismatches: 0 };
  const equal = (x, y, label) => { if (!isDeepStrictEqual(x, y)) { counts.mismatches++; assert.deepEqual(y, x, label); } };
  // One stable full tier avoids the known refinement alias. Cuts change without tick/invalidate.
  const cuts = [cut(), cut(18, 18, Math.PI / 2), cut(18, 18, Math.PI / 5), cut(16.125, 19.875, -Math.PI / 4),
    closed, cut(), cut(350, -200), new Float32Array([18, 18, 1, 0, 5, 8, 2, 1, -5, 6, 5, 4, 4, 1, -4, 0])];
  for (const uniform of cuts) {
    before.CUT.value.set(uniform); after.CUT.value.set(uniform);
    for (let n = 0; n < 768; n++) {
      const p = point(4 + rng() * 28, .3 + rng() * 8, 4 + rng() * 28);
      const q = point(4 + rng() * 28, .3 + rng() * 8, 4 + rng() * 28);
      const mask = n % 2 ? a.world.STATIC : a.world.STATIC_WIDE;
      const x = a.world.ray(p, q, mask), y = b.world.ray(p, q, mask);
      equal(x, y, `ray ${counts.rays}`); counts.rays++; x ? counts.hits++ : counts.clear++;
      if (n % 8) continue;
      const r = [0, .1, .35, 1.25][(n >> 3) % 4], sm = [a.world.STATIC, a.world.STATIC_WIDE, a.world.STATIC_THIN][(n >> 3) % 3];
      const movingMask = sm === a.world.STATIC_THIN ? a.world.STATIC : sm;
      for (const [method, args] of [['sweep', [p, q, r, movingMask]], ['overlap', [p, r, sm]], ['inside', [p, sm]],
        ['distance', [p, 2.5, sm]], ['nearestFree', [p, r, movingMask, .5]], ['fan', [p, [q, point(18, 2, 18)], movingMask]]]) {
        equal(a.world[method](...args), b.world[method](...args), `${method} ${counts[method]}`); counts[method]++;
      }
    }
    // Exact grid and cut boundaries, vertical/zero-length rays, and negative coordinates.
    for (const x of [-.25, 0, 7, 12, 13, 18, 23, 24, P]) for (const y of [0, 1.01, 4.01, 5, 20]) {
      const p = point(x, y, 18), q = point(x, y + 1, 18);
      for (const end of [p, q]) { const hit = a.world.ray(p, end); equal(hit, b.world.ray(p, end), 'boundary ray'); counts.rays++; hit ? counts.hits++ : counts.clear++; }
    }
  }
  assert(counts.hits && counts.clear, 'both blocked and clear rays');
  // The sphere itself misses this small cut's bounding circle. Its way out still
  // depends on a cut column six cells away, inside overlap's eight-cell search.
  const near = new Float32Array(smallCut); near[0] = 4.125; near[1] = 4.875; near[4] = near[11] = .2;
  before.CUT.value.set(near); after.CUT.value.set(near);
  const solidA = fixture(before, solid), solidB = fixture(after, solid); solidA.settle(); solidB.settle();
  const p = point(2.5, 2, 4.875), expected = solidA.world.overlap(p, .1);
  assert.deepEqual(expected?.n, [1, 0, 0], 'neighbour probe reaches the cut');
  assert.equal(expected?.depth, 1.6, 'way out is 1.5 m plus radius');
  equal(expected, solidB.world.overlap(p, .1), 'cut-aware neighbour probe'); counts.overlap++;
  return counts;
});

check('item2 timing', () => {
  const coords = [];
  for (let i = 0; i <= Math.floor(128 / P); i++) coords.push([i, 0]);
  // A low slab installs real full-detail entries, clear at ray height. Synthetic
  // 0.125 m columns give 1,023 cells along a 127.75 m (approximately 128 m) ray.
  const low = mesh([[0, 0, 0, P, .25, P]]);
  const configs = [
    ['before off', before, false], ['before cut', before, true],
    ['after off', after, false], ['after cut', after, true],
  ];
  const col = .125;
  const worlds = configs.map(([label, module, on]) => { const f = fixture(module, low, { coords, cut: on, col, thinMax: 0 }); f.settle(); return { label, module, world: f.world, samples: [] }; });
  const a = point(.0625, 10, .0625), b = point(127.8125, 10, .0625);
  const cells = 1 + Math.floor(b.x / col) - Math.floor(a.x / col);
  assert.equal(cells, 1023);
  const unrelated = cut(-200, -200);
  for (const module of [before, after]) module.CUT.value.set(unrelated);
  const run = (w, n) => { const start = performance.now(); for (let i = 0; i < n; i++) assert.equal(w.ray(a, b), null); return performance.now() - start; };
  for (let round = 0; round < 4; round++) for (const w of worlds) run(w.world, 1000);
  for (let round = 0; round < 9; round++) {
    const order = round % 2 ? [...worlds].reverse() : worlds;
    for (const w of order) w.samples.push(run(w.world, 3000));
  }
  const median = samples => [...samples].sort((a, b) => a - b)[samples.length >> 1];
  const times = worlds.map(w => median(w.samples)), fixed = n => +n.toFixed(3);
  const report = { rayMetres: b.x - a.x, colMetres: col, raysPerSample: 3000, cellsPerRay: cells, samples: 9,
    before: { offMs: fixed(times[0]), cutMs: fixed(times[1]), cutOverOff: fixed(times[1] / times[0]) },
    after: { offMs: fixed(times[2]), cutMs: fixed(times[3]), cutOverOff: fixed(times[3] / times[2]) },
    afterOverBefore: fixed(times[3] / times[1]), offAfterOverBefore: fixed(times[2] / times[0]) };
  console.log(`timing ${JSON.stringify(report)}`);
  // Report ratios; no machine-dependent absolute or relative performance gate.
  return { comparisons: 4, measuredRays: 9 * 3000 * worlds.length };
});
console.log(`WORLDCUTCHECK ${failures.length ? 'FAIL' : 'PASS'} candidate=${AT || 'working tree'} baseline=${BASE}${failures.length ? ' failed=' + failures.join(',') : ''}`);
process.exitCode = failures.length ? 1 : 0;
