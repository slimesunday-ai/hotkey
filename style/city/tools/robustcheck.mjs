// ROBUSTNESS CHECK (node, no browser, a few seconds): the outside audit's city/UI faults (the 10-08 audit report; a local archive, not in this repository
// F09 F16 F19 F26 F27 F28), each re-run against the real module the way the audit reproduced it — a fault injected or the scale it
// used — and checked for the fixed behaviour. Exit code 1 when any of them comes back.
//   F09  pool.js · cache.js openBaked   a worker that dies after its init: the job it held is retried once on a fresh worker, a second
//        death rejects it, capacity comes back; with every worker gone (or an init that failed) every job rejects; a baked-data worker's
//        requests read as misses and a fresh worker takes its regions
//   F16  cache.js openCache             two builds open on one origin: the old build's late write never reaches the new build's reads
//   F19  ui/tape/index.js events()      a 200 000-event chunk flattens (it threw RangeError); later chunks append, nothing doubles
//   F26  stream.js                      an evicted block keeps nothing of its character record (it kept the whole record via r.ccm)
//   F27  stage/props.js                 memorial chalk + clear, 25 tape seeks and a 300-death live run: no geometry per memorial
//   F28  peds.js addLook                2 000 looks added: the far batch grows by half again when full (it resized on every look)
// 'three' is the page's own version (index.html's import map), downloaded once into baked/.tools/ (gitignored, like tools/bake.mjs's
// meshopt), or THREE_DIR=<a directory with three.module.js + three.core.js>.
//   node style/city/tools/robustcheck.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..');
const VER = /three@([\d.]+)\/build\/three\.module\.js/.exec(fs.readFileSync(path.join(CITY, 'index.html'), 'utf8'))?.[1];
async function threeDir() {
  if (process.env.THREE_DIR) return path.resolve(process.env.THREE_DIR);
  if (!VER) throw new Error('no three version in index.html\'s import map');
  const dir = path.join(CITY, 'baked/.tools', 'three-' + VER);
  for (const f of ['three.module.js', 'three.core.js']) { const p = path.join(dir, f); if (fs.existsSync(p)) continue; fs.mkdirSync(dir, { recursive: true });
    const r = await fetch(`https://cdn.jsdelivr.net/npm/three@${VER}/build/${f}`); if (!r.ok) throw new Error(`download three ${VER} ${f}: ${r.status}`);
    fs.writeFileSync(p + '.part', await r.text()); fs.renameSync(p + '.part', p); }
  return dir; }
const THREE_URL = pathToFileURL(path.join(await threeDir(), 'three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === 'three' ? { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true } : n(s, c); }`));
const THREE = await import('three'), mod = p => import(pathToFileURL(path.join(CITY, p)).href);

const results = [], tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
const check = (id, what, ok, detail) => { results.push({ id, what, ok: !!ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${id} ${what}${detail ? ' · ' + JSON.stringify(detail) : ''}`); };
const watch = p => { const s = { state: 'pending', value: undefined }; p.then(v => { s.state = 'resolved'; s.value = v; }, e => { s.state = 'rejected'; s.value = String(e && e.message || e); }); return s; };
const quiet = async fn => { const ce = console.error, cw = console.warn; console.error = console.warn = () => {}; try { return await fn(); } finally { console.error = ce; console.warn = cw; } };

// ── F09 · a stand-in Worker that behaves like worker.js: init / initBaked answered with ready, every job answered a tick later — unless
// the test holds the jobs (FakeWorker.hold) to crash a worker in the middle of one
const workers = [];
class FakeWorker {
  static hold = false; static initError = null;
  constructor(url) { this.url = String(url); this.sent = []; this.dead = false; workers.push(this); }
  postMessage(m) { if (this.dead) return; this.sent.push(m);
    if (m.type === 'init' || m.type === 'initBaked') { const err = FakeWorker.initError; queueMicrotask(() => { if (!this.dead) this.onmessage?.({ data: err ? { type: 'ready', error: err } : { type: 'ready', mods: {} } }); }); return; }
    if (FakeWorker.hold) return;
    setTimeout(() => { if (!this.dead) this.onmessage?.({ data: { id: m.id, r: m.job.type === 'region' ? { bytes: 0, keys: [] } : { job: m.job.type } } }); }, 1); }
  crash(message) { this.onerror?.({ type: 'error', message }); }
  terminate() { this.dead = true; } }
globalThis.Worker = FakeWorker;
const holder = (from, id) => workers.slice(from).find(w => !w.dead && w.sent.some(m => m.id === id));
{ const { createPool } = await mod('pool.js'), { openBaked } = await mod('cache.js');
  await quiet(async () => {
    const w0 = workers.length, pool = createPool(2, [], 'https://robust.invalid/jobs.js'); await pool.ready;
    // a crash mid-job: the job is retried on a live worker and finishes; the slot is refilled
    FakeWorker.hold = true; const a = watch(pool.exec({ type: 'block' })), wa = holder(w0, 1); FakeWorker.hold = false; wa.crash('injected worker crash'); await tick(20);
    check('F09', 'pool · a worker dies mid-job → the job is retried and finishes, the slot refilled', a.state === 'resolved' && pool.busy() === 0 && pool.free() === 2 && pool.alive?.() === 2 && pool.restarts?.() === 1 && wa.dead,
      { job: a.state, busy: pool.busy(), free: pool.free(), alive: pool.alive?.(), restarts: pool.restarts?.() });
    // the same job's second worker dies too: it rejects (bounded retry) and the pool is whole again
    FakeWorker.hold = true; const b = watch(pool.exec({ type: 'block' })); await tick(); const wb = holder(w0, 2); wb.crash('injected crash 1'); await tick(5); const wb2 = holder(w0, 2); wb2?.crash('injected crash 2'); await tick(5); FakeWorker.hold = false;
    check('F09', 'pool · its second worker dies too → the job rejects, nothing stays busy', !!wb2 && wb2 !== wb && b.state === 'rejected' && pool.busy() === 0 && pool.alive?.() === 2, { job: b.state, busy: pool.busy(), alive: pool.alive?.(), restarts: pool.restarts?.() });
    // the restart budget spent and every worker gone: a held job and every new one reject (they used to wait forever)
    FakeWorker.hold = true; const c = watch(pool.exec({ type: 'block' })); await tick();
    for (let k = 0; k < 40 && pool.alive?.(); k++) { workers.slice(w0).find(w => !w.dead && w.url.includes('worker.js'))?.crash('injected crash ' + k); await tick(2); }
    const d = watch(pool.exec({ type: 'block' })); await tick(5); FakeWorker.hold = false;
    check('F09', 'pool · no worker left → held and new jobs reject', pool.alive?.() === 0 && c.state === 'rejected' && d.state === 'rejected' && pool.busy() === 0, { held: c.state, next: d.state, alive: pool.alive?.(), restarts: pool.restarts?.() });
    // an init that fails: ready rejects and so does every job (they sat in the backlog forever)
    FakeWorker.initError = 'injected init failure'; const p2 = createPool(2, [], 'https://robust.invalid/jobs.js'), r2 = watch(p2.ready), e = watch(p2.exec({ type: 'block' })); await tick(5); FakeWorker.initError = null;
    check('F09', 'pool · an init that fails → ready and the jobs reject', r2.state === 'rejected' && e.state === 'rejected', { ready: r2.state, job: e.state });
    // the baked city's workers: a crash mid-read is a miss (the stream builds the block), a fresh worker takes the regions
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ hash: 'h', tods: ['d'], region: 4, regions: { '0_0': { d: { far: { keys: ['0,0'] } } } } }) });
    const w1 = workers.length, baked = await openBaked(new URL('https://robust.invalid/'), 'h', 'd', { workers: 1 }), bw = workers[w1];
    FakeWorker.hold = true; const g = watch(baked.get('0,0', 'far')); await tick(); const held = bw.sent.filter(m => m.id).map(m => m.job.type); bw.crash('injected baked worker crash'); await tick(5); FakeWorker.hold = false;
    const g2 = await baked.get('0,0', 'far'), bw2 = workers.slice(w1 + 1).find(w => !w.dead);
    check('F09', 'baked · its worker dies mid-read → a miss at once; a fresh worker serves the next read', g.state === 'resolved' && g.value === undefined && bw.dead && baked.restarts?.() === 1 && g2?.job === 'rec' && !!bw2,
      { held, read: g.state, next: g2, restarts: baked.restarts?.() });
    baked.close(); pool.terminate(); });
  delete globalThis.fetch; }

// ── F16 · two builds, one IndexedDB (the audit's deterministic model: asynchronous requests and completions, one shared database)
{ const { openCache } = await mod('cache.js'), stores = new Map();
  const db = { createObjectStore(k) { stores.set(k, new Map()); },
    transaction(name) { const t = { objectStore() { const data = stores.get(name); return {
      get(k) { return { result: structuredClone(data.get(k)) }; }, put(v, k) { data.set(k, structuredClone(v)); return { result: k }; }, clear() { data.clear(); return { result: undefined }; } }; } };
      queueMicrotask(() => t.oncomplete?.()); return t; } };
  let first = true; globalThis.indexedDB = { open() { const req = { result: db }; queueMicrotask(() => { if (first) { first = false; req.onupgradeneeded?.(); } req.onsuccess(); }); return req; } };
  const old = await openCache('old-map-hash'); await old.put('d:mid:0,0', { version: 'old' });
  const fresh = await openCache('new-map-hash'); await fresh.put('d:mid:0,0', { version: 'new' });
  await old.put('d:mid:0,0', { version: 'old-late-worker' });   // (the old tab's worker finishing late, after the new build cleared the store)
  const nr = await fresh.get('d:mid:0,0'), or = await old.get('d:mid:0,0'), other = await fresh.get('d:far:0,0');
  check('F16', 'cache · the old build\'s late write never reaches the new build', nr?.version === 'new' && or?.version === 'old-late-worker' && other === undefined, { newBuildReads: nr?.version, oldBuildReads: or?.version });
  delete globalThis.indexedDB; }

// ── F19 · the tape's events() and the line that queues a chunk, as they are in ui/tape/index.js, run on synthetic events
{ const src = fs.readFileSync(path.join(CITY, 'ui/tape/index.js'), 'utf8'), fn = src.slice(src.indexOf('  function events(opt = {})'), src.indexOf('  function stateAt(t)'));
  const feed = src.split('\n').find(l => /^\s*if \(m\.events\)/.test(l));
  const cx = vm.createContext({ evAll: null, evChunks: [], tape: { window: () => ({ horizon: Infinity }) } }), ev = (a, b) => JSON.stringify(Array.from({ length: b - a }, (_, i) => ({ id: a + i + 1, t: a + i, type: 'sale' })));
  let out = {}; try { vm.runInContext(fn + '\nfunction feed(m) {\n' + feed + '\n}', cx); cx.feed({ events: ev(0, 200000) }); out.big = vm.runInContext('events().length', cx);
    cx.feed({ events: ev(200000, 201000) }); cx.feed({ events: ev(201000, 201500) }); const all = vm.runInContext('events()', cx); out.after = all.length; out.again = vm.runInContext('events().length', cx);
    out.ordered = all.every((e, i) => e.id === i + 1); out.window = vm.runInContext('events({ from: 200990, to: 201009 }).length', cx); }
  catch (e) { out.error = `${e.name}: ${e.message}`; }
  check('F19', 'tape · a 200 000-event chunk flattens; later chunks append once, in order', !out.error && out.big === 200000 && out.after === 201500 && out.again === 201500 && out.ordered && out.window === 20, out); }

// ── F26 · a block's character record, then the camera far away until the block is evicted (the audit's stream-retain fixture)
{ const { createStream } = await mod('stream.js'), { PRESETS } = await mod('quality.js');
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 2000); camera.position.set(10000, 10, 10000); camera.lookAt(11000, 10, 11000); camera.updateMatrixWorld();
  const stream = createStream({ scene: new THREE.Scene(), camera, cache: { put: async () => {}, get: async () => {} }, night: false, mats: { charFull: [], charMid: new THREE.MeshStandardMaterial(), tier: new THREE.MeshStandardMaterial() }, preset: PRESETS.low, isHero: () => false, fadeMs: 0, pool: { n: 1 } });
  stream.setUniverse([[0, 0, false]], 'robust'); const rec = stream.blocks.get('0,0');
  const cm = { mid: null, far: new Float32Array(262144), centres: [[8, 0, 8], null, null, null], count: [5, 0, 0, 0] }; rec.data.cm = cm;
  stream.update(); const copied = rec.cce?.[0]?.join() === '8,0,8' && rec.cce !== cm.centres && rec.cce[0] !== cm.centres[0] && rec.ccount?.[0] === 5 && rec.ccount !== cm.count;
  for (let i = 0; i < 180; i++) stream.update();
  const targets = new Set([cm, cm.far, cm.far.buffer, cm.centres, cm.count]), reach = (o, seen = new Set(), depth = 0) => { if (!o || typeof o !== 'object' || seen.has(o) || depth > 5) return false; if (targets.has(o)) return true; seen.add(o);
    if (o.isObject3D || o.isMaterial || o.isBufferGeometry) return false; for (const v of Object.values(o)) if (reach(v, seen, depth + 1)) return true; return false; };
  const evicted = Object.keys(rec.data).length === 0, kept = reach(rec);
  check('F26', 'stream · an evicted block keeps nothing of its character record (its continuity numbers are copies)', copied && evicted && !kept && stream.memory().cpu === 0, { copied, evicted, recordStillReachable: kept, reportedCPU: stream.memory().cpu }); }

// ── F27 · memorials: 25 tape seeks (a clear, then a mark) and a 300-death live run, with a layer whose every memorial is a new geometry
{ const { createProps } = await mod('stage/props.js'), allocated = [], disposed = new Set();
  const layer = { pieceMesh() { const g = new THREE.BoxGeometry(); g.addEventListener('dispose', () => disposed.add(g)); allocated.push(g); return new THREE.Mesh(g, new THREE.MeshStandardMaterial()); } };
  const scene = new THREE.Scene(), props = createProps({ scene, mats: { tier: new THREE.MeshStandardMaterial() }, layer });
  let shows = 0, chalkGeo = null; const shown = g => { const m = g.children[1]?.children[0]; chalkGeo ??= g.children[0].geometry; if (m?.isMesh && allocated.includes(m.geometry)) shows++; };
  for (let i = 0; i < 25; i++) { props.clearMarks(); shown(props.chalk(i, 0, 0, { key: 'tape' })); }
  props.clearMarks(); for (let i = 0; i < 300; i++) shown(props.chalk(i, 0, 0, { key: 'live' })); const live = props.marks(); props.clearMarks();
  const leaked = allocated.filter(g => !disposed.has(g)).length;
  check('F27', 'props · one memorial geometry, shared by every mark; clears leave nothing behind', allocated.length <= 1 && leaked <= 1 && shows === 325 && live === 300 && props.marks() === 0 && scene.children.filter(o => o.isGroup && o.children[0]?.geometry === chalkGeo).length === 0,
    { memorialGeometries: allocated.length, undisposed: leaked, marksShowingTheMemorial: shows, liveMarks: live, left: props.marks() }); }

// ── F28 · the walkers' batches with a one-look pool (the audit's peds-scale fixture), then 2 000 looks added
{ const { createPeds } = await mod('peds.js'), { PRESETS } = await mod('quality.js'); globalThis.fetch = async () => ({ ok: false });
  const tiny = () => ({ P: new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]), N: new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]), C: new Uint8Array(12).fill(255), K: new Float32Array(3), I: new Uint32Array([0, 1, 2]) });
  const look = () => ({ full: tiny(), mid: tiny(), main: [0xff0000, 0x00ff00, 0x0000ff] });
  const p = createPeds({ scene: new THREE.Scene(), night: false, R: PRESETS.medium, densityOf: () => 0, bake: async () => ({ looks: [look()], dogs: [] }) }); await tick();
  const far = p.anim.far, resize = far.setGeometrySize.bind(far); let grows = 0, at50 = 0, last = -1, error = null; far.setGeometrySize = (...a) => { grows++; return resize(...a); };
  try { for (let i = 0; i < 2000; i++) { last = p.addLook(look()); if (i === 49) at50 = grows; } } catch (e) { error = String(e.message || e); }
  check('F28', 'peds · the far batch grows only when full (geometric): 50 looks ≤ 2 resizes, 2 000 ≤ 12', !error && at50 <= 2 && grows <= 12 && last === p.looks + 1999, { resizesAt50: at50, resizesAt2000: grows, lastLook: last, error });
  delete globalThis.fetch; }

const bad = results.filter(r => !r.ok);
console.log(bad.length ? `\nROBUSTNESS CHECK FAILED: ${bad.map(r => r.id).join(' ')}` : `\nrobustness check ok · ${results.length} checks (F09 F16 F19 F26 F27 F28)`);
process.exit(bad.length ? 1 : 0);
