// Streaming (pass 1c; streaming pass): only blocks within the draw distance exist; each shows one tier, chosen by distance with budgets.
//   near (full detail, ≤ R.near, at most R.maxNear blocks) · mid (one merged mesh, ≤ R.mid, at most R.maxMid) · far (massing) · none
// A block always shows the best tier it already has at or below the one it wants (so it never pops in empty): far first, then mid/full.
// Streaming pass:
//   · data per tier: 'far' · 'mid' (the mid tier, its anchors/lanes/stats and the character mid/far tiers) · 'full' · 'cf' (character
//     full bodies), each from memory → the BAKED city (cache.js openBaked: tools/bake.mjs, decoded in its own workers) → IndexedDB →
//     a worker build (one build per block serves every tier). A block that wants full detail asks for 'full' itself (its full data is
//     dropped once it is far away, and it used to never come back: the block then stayed at mid however close the camera came).
//   · prefetch: the camera's velocity projects a point R.ahead seconds on; blocks near it get their data (not their GPU meshes) first
//   · uploads per frame are capped by vertices (R.uploadVerts) and by main-thread time (R.uploadMs), nearest visible first
//   · the woods' far tiers merge per 4 × 4-block chunk (o.chunkOf, jobs.js jobFarChunk): one job, one record, one draw call; each member
//     block is shown, hidden and dissolved on its own through a per-member value in the chunk's shader (uKF, K = member index)
//   · every tier swap dissolves (pass 1d's dither), chunk members included
// Characters tier per 16 m cluster: full chars.js bodies (nearest, capped), the coarse body, or boxes (one instanced draw).
import * as THREE from 'three';
import { meshOf, disposeMesh, tierize, trisOf, fadeClone, fadeRelease } from './gpu.js';
import { P } from './plan.js';
import { tierBytes } from './lod.js';

const BAYER = 'float( k == 0 ? 0 : k == 1 ? 8 : k == 2 ? 2 : k == 3 ? 10 : k == 4 ? 12 : k == 5 ? 4 : k == 6 ? 14 : k == 7 ? 6 : k == 8 ? 3 : k == 9 ? 11 : k == 10 ? 1 : k == 11 ? 9 : k == 12 ? 15 : k == 13 ? 7 : k == 14 ? 13 : 5 )';
export const CHUNK = 4;   // woods far chunks: 4 × 4 blocks (the bake's regions)
export function createStream(o) {
  const { scene, camera, cache, night, mats, pool } = o, sync = !!o.sync, baked = !sync && !o.audit && o.baked?.on ? o.baked : null, blocks = new Map(), chunks = new Map(), keyOf = (i, j) => i + ',' + j;
  let R = o.preset, universe = [], mode = 'section', tick = 0, lastSort = -1e9, sorted = [], farDirty = true, shadowDirty = true, uploadsThisFrame = 0, uploadMs = 0, chooseId = 0;
  const FADE = sync ? 0 : (o.fadeMs ?? 500), fading = new Set();   // pass 1d: new blocks and tier swaps dissolve in over FADE ms (never in shots)
  const stat = { jobsFar: 0, jobsChunk: 0, jobsBlock: 0, idb: 0, baked: 0, built: 0, msBuild: 0, pending: 0, charsBuilt: 0, prefetch: 0, decodeMs: 0 };
  const queue = new Map(), inflight = { read: 0, build: 0 };   // key:type → { rec, type, prio, seen }
  const cam = new THREE.Vector3(), groupStatic = new THREE.Group(); groupStatic.matrixAutoUpdate = false; scene.add(groupStatic);
  // far character boxes: one instanced draw for every far cluster in the scene
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0, 0);
  const boxMat = new THREE.MeshStandardMaterial({ roughness: .75 }); let boxes = null, boxCap = 0;
  // fidelity pass · the boxes shrink to nothing over the last 15 % of R.charFar (so a cluster crossing the range edge is never a pop) and
  // grow in over half a second when their block's people first appear on screen (aBorn: when, in seconds; 0 = already there)
  const boxU = { uFar: { value: 250 }, uNow: { value: 0 } };
  boxMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, boxU); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aBorn; uniform float uFar; uniform float uNow;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
  { float dd = distance( cameraPosition, ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1. ) ).xyz ); transformed *= ( 1. - smoothstep( uFar * .85, uFar, dd ) ) * clamp( ( uNow - aBorn ) * 2., 0., 1. ); }
  #endif`); };
  boxMat.customProgramCacheKey = () => 'charbox';
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), COL = new THREE.Color();

  function setUniverse(list, m) { mode = m; const keep = new Set();
    for (const [i, j, buildable] of list) { const k = keyOf(i, j); keep.add(k); let r = blocks.get(k);
      if (!r) blocks.set(k, r = { key: k, i, j, buildable, x0: i * P, x1: (i + 1) * P, z0: j * P, z1: (j + 1) * P, maxH: 30, data: {}, mesh: {}, shown: null, want: null, charT: [null, null, null, null], seen: 0, loading: {}, keep: 0, chunk: null, ck: -1 });
      r.buildable = buildable; r.hero = !!o.isHero(i, j); }
    for (const [k, r] of blocks) if (!keep.has(k)) { hide(r, true); blocks.delete(k); }
    universe = [...blocks.values()]; lastSort = -1e9;
    // woods far chunks (o.chunkOf(i, j) → a chunk key, or null): members in a fixed order (by row, then column) = their K index
    if (o.chunkOf) { const by = new Map(); for (const r of universe) { if (r.chunk) continue; const ck = o.chunkOf(r.i, r.j); if (ck) { if (!by.has(ck)) by.set(ck, []); by.get(ck).push(r); } }
      for (const [ck, list] of by) { if (chunks.has(ck)) continue; list.sort((a, b) => a.j - b.j || a.i - b.i); const ci = Math.floor(list[0].i / CHUNK), cj = Math.floor(list[0].j / CHUNK);
        const C = { key: ck, ci, cj, o: [(ci * CHUNK + CHUNK / 2) * P, 0, (cj * CHUNK + CHUNK / 2) * P], members: list, far: undefined, info: null, mesh: null, mat: null, loading: {}, kf: null };
        list.forEach((r, k) => { r.chunk = C; r.ck = k; }); chunks.set(ck, C); } } }
  const distTo = (r, p) => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(-p.y, 0, p.y - r.maxH), Math.max(r.z0 - p.z, 0, p.z - r.z1));

  // ── requests: memory → baked → IndexedDB → worker (far first, then the nearest visible blocks' detail, then prefetch)
  const enqueue = (k, rec, type, prio) => { const q = queue.get(k); if (q) { q.prio = Math.min(q.prio, prio); q.seen = chooseId; } else queue.set(k, { k, rec, type, prio, seen: chooseId }); };
  const want = (r, type, prio) => { if (r.loading[type]) return; r.keep = tick; enqueue(r.key + ':' + type, r, type, prio); };
  const wantChunk = (C, prio) => { if (!C.loading.chunk) enqueue('C' + C.key + ':chunk', C, 'chunk', prio); };
  async function fromCache(r, type) { const v = await cache.get(cacheKey(r, type)); if (v) { stat.idb++; Object.assign(r.data, v); if (v.maxH) r.maxH = Math.max(r.maxH, v.maxH + 4);
    if (v.anchors) o.onAnchors?.(r, v.anchors); if (v.lanes) o.onLanes?.(r, v.lanes); } return !!v; }
  const cacheKey = (r, t) => `${night ? 'n' : 'd'}:${t}:${r.i},${r.j}`, chunkKey = C => `${night ? 'n' : 'd'}:fc:${C.key}`;
  const puts = []; const put = (k, v, b) => puts.push([k, v, b]);   // cache writes drain one per frame (structured clones of MB-sized records)
  function store(r, res) {   // split a job result into cache records
    if (res.far !== undefined) put(cacheKey(r, 'far'), { far: res.far, maxH: res.maxH }, tierBytes(res.far));
    if (res.mid) { put(cacheKey(r, 'mid'), { mid: res.mid, maxH: res.maxH, stats: res.stats, trisMid: res.trisMid, pieces: res.pieces, anchors: res.anchors || null, lanes: res.lanes || null }, tierBytes(res.mid)); put(cacheKey(r, 'full'), { full: res.full, tris: res.tris }, tierBytes(res.full)); }
    if (res.chars) { const c = res.chars; put(cacheKey(r, 'cm'), { cm: { mid: c.mid, far: c.far, count: c.count, centres: c.centres, n: c.n } }, tierBytes(c.mid) + c.far.byteLength); } }   // full character bodies are not cached (≈40% of the bytes): the few near blocks rebake them in a worker (type 'cf')
  // a job result, or a cached / baked record ({ far, maxH } · { mid, maxH, stats, trisMid, pieces, anchors, lanes, cm } · { full, tris } · { cf })
  function accept(r, res) { if (res.far !== undefined && !r.chunk) r.data.far = res.far; if (res.maxH) r.maxH = Math.max(r.maxH, res.maxH + 4);
    if (res.far === null && !res.mid && !r.chunk) r.emptyFar = true;   // cleanup pass: an empty far tier (reported by the job) counts as done, never awaited
    if (res.mid) { r.data.mid = res.mid; r.data.stats = res.stats; r.data.trisMid = res.trisMid; r.data.pieces = res.pieces; }
    if (res.full) { r.data.full = res.full; r.data.tris = res.tris; }
    if (res.chars) { const c = res.chars; r.data.cm = { mid: c.mid, far: c.far, count: c.count, centres: c.centres, n: c.n }; r.data.cf = c.full; stat.charsBuilt += c.n; }
    if (res.cm) r.data.cm = res.cm; if (res.cf) r.data.cf = res.cf;
    if (res.audit) { r.data.audit = res.audit; o.onAudit?.(r, res.audit); }
    if (res.errors?.length) o.onErrors?.(r, res.errors);   // pass 2: a module that failed while this block built (it shows a placeholder)
    if (res.anchors) { r.data.anchors = res.anchors; o.onAnchors?.(r, res.anchors); }
    if (res.lanes) { r.data.lanes = res.lanes; o.onLanes?.(r, res.lanes); }
    farDirty = true; }
  const has = (r, t) => t === 'cm' ? !!r.data.cm : t === 'cf' ? !!r.data.cf : r.data[t] !== undefined && r.data[t] !== null ? true : (t === 'far' && r.data.far === null);
  const ready = (r, type) => type === 'far' ? has(r, 'far') : type === 'mid' ? has(r, 'mid') && has(r, 'cm') : has(r, type);
  const IDB = { far: ['far'], mid: ['mid', 'cm'], full: ['full'], cf: [] };
  function trace(type, r, t, res) { if (o.trace) (stat.trace ??= []).push([type, r.key, r.hero ? 1 : 0, Math.round(t), Math.round(performance.now()), Math.round(Array.isArray(res.ms) ? res.ms[0] + res.ms[1] : res.ms || 0)]); }   // ?trace=1: [type, block, hero, sent, back, ms in the worker]
  async function build(r) {   // one worker build per block at a time: every tier comes back from it
    const job = { type: 'block', i: r.i, j: r.j, night, audit: !!o.audit, flags: o.flags || null }, t = performance.now();
    const res = sync ? await o.exec(job) : await pool.exec(job);
    stat.msBuild += performance.now() - t; stat.jobsBlock++; if (res.ms) o.onBuilt?.(r, res); trace('block', r, t, res);
    accept(r, res); if (!sync && !baked?.has(r.key, 'mid')) store(r, res); }
  async function runBlock(r, type) {
    if (ready(r, type)) return;
    if (baked && baked.has(r.key, type)) { const rec = await baked.get(r.key, type); if (rec) { stat.baked++; stat.decodeMs += rec.decodeMs || 0; accept(r, rec); if (ready(r, type)) return; } }
    if (!sync && IDB[type].length) { await Promise.all(IDB[type].filter(t => !has(r, t)).map(t => fromCache(r, t))); if (ready(r, type)) return; }
    if (type === 'far') { const job = { type: 'far', i: r.i, j: r.j, night, audit: !!o.audit, flags: o.flags || null }, t = performance.now();
      const res = sync ? await o.exec(job) : await pool.exec(job); stat.msBuild += performance.now() - t; stat.jobsFar++; trace('far', r, t, res); accept(r, res); if (!sync) store(r, res); return; }
    if (!r.building) r.building = build(r).finally(() => { r.building = null; }); await r.building; }
  // ── woods far chunks
  const sameMembers = (C, m) => Array.isArray(m) && m.length === C.members.length && m.every((x, k) => x.i === C.members[k].i && x.j === C.members[k].j);
  function bindMember(r) { const C = r.chunk, m = C.info[r.ck]; r.data.far = m.n ? { chunk: C, k: r.ck, n: m.n } : null; if (!m.n) r.emptyFar = true; if (m.maxH) r.maxH = Math.max(r.maxH, m.maxH + 4); }
  function acceptChunk(C, rec) { C.far = rec.far || null; C.info = rec.members; for (const r of C.members) bindMember(r); if (rec.errors?.length) o.onErrors?.(C.members[0], rec.errors); farDirty = true; }
  async function runChunk(C) {
    if (C.far !== undefined) return;
    if (baked && baked.has('chunk', 'far', C.key)) { const rec = await baked.get('chunk', 'far', C.key); if (rec && sameMembers(C, rec.members)) { stat.baked++; stat.decodeMs += rec.decodeMs || 0; acceptChunk(C, rec); return; } }
    if (!sync) { const v = await cache.get(chunkKey(C)); if (v && sameMembers(C, v.members)) { stat.idb++; acceptChunk(C, v); return; } }
    const job = { type: 'farChunk', members: C.members.map(r => [r.i, r.j]), o: C.o, night, flags: o.flags || null }, t = performance.now();
    const res = sync ? await o.exec(job) : await pool.exec(job); stat.msBuild += performance.now() - t; stat.jobsChunk++;
    acceptChunk(C, res); if (!sync && !baked) put(chunkKey(C), { far: res.far, members: res.members }, tierBytes(res.far)); }
  async function run(item) {
    const { rec: r, type } = item; r.loading[type] = true; stat.pending++; const ch = item.ch; inflight[ch]++;
    try { if (type === 'chunk') await runChunk(r); else await runBlock(r, type); }
    catch (e) { console.error('stream job failed', r.key, type, e); if (type === 'chunk') failChunk(r); else r.failed = true; }
    finally { r.loading[type] = false; stat.pending--; inflight[ch]--; }
  }
  function failChunk(C) { C.far = null; C.info = C.members.map(() => ({ n: 0 })); for (const r of C.members) { r.data.far = null; r.emptyFar = true; } }
  // read channel (baked records: decode only) and build channel (IndexedDB, then the worker pool), each with its own cap
  function dispatch() {
    if (!queue.size) return;
    const items = [...queue.values()].sort((a, b) => a.prio - b.prio), capB = pool ? pool.n + 4 : 1, capR = R.reads ?? 24;
    for (const it of items) { const bk = it.type === 'chunk' ? baked?.has('chunk', 'far', it.rec.key) : baked?.has(it.rec.key, it.type);
      it.ch = bk ? 'read' : 'build'; if (!sync && (it.ch === 'read' ? inflight.read >= capR : inflight.build >= capB)) continue;
      queue.delete(it.k); const p = run(it); if (sync) return p; }
  }

  // ── tier choice (pass 2: the near/mid budget goes to blocks in view first; a block wholly past the haze is not drawn at all —
  // its every point is horizon-coloured, so it can't be seen, but it cost a draw call and a far job)
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), BX = new THREE.Box3(), FWD = new THREE.Vector3(), vel = new THREE.Vector3(), PF = new THREE.Vector3(), lastPos = new THREE.Vector3(); let lastT = null;
  const depthOf = (r, p) => { let m = 1e9; for (const x of [r.x0, r.x1]) for (const y of [0, r.maxH]) for (const z of [r.z0, r.z1]) m = Math.min(m, (x - p.x) * FWD.x + (y - p.y) * FWD.y + (z - p.z) * FWD.z); return m; };
  function choose() {
    const p = camera.position; cam.copy(p); camera.updateMatrixWorld(); PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM); camera.getWorldDirection(FWD);
    const fogFar = scene.fog && !o.noFogCull ? scene.fog.far : 1e9; chooseId++;
    for (const r of universe) { r.d = distTo(r, p); BX.min.set(r.x0, 0, r.z0); BX.max.set(r.x1, r.maxH, r.z1); r.inView = FR.intersectsBox(BX); r.pd = r.d + (r.inView ? 0 : 160); r.fogged = r.d > 60 && depthOf(r, p) > fogFar + 2; }
    sorted = universe.slice().sort((a, b) => a.pd - b.pd);
    let nNear = 0, nMid = 0; const behindAt = R.behind ?? R.near * 1.5;
    for (const r of sorted) { let w = null;
      if (r.d <= R.draw && !r.fogged) { w = 'far';
        if (r.buildable) { const kNear = r.shown === 'full' ? 1.15 : 1, kMid = r.shown === 'mid' || r.shown === 'full' ? 1.1 : 1;   // (hysteresis: a block keeps its tier a little past the line it loaded at)
          const behind = !r.inView && r.d > behindAt;   // pass 2: out of view and not close: its far tier is enough until the camera turns (the strong preset keeps them)
          if (!behind && r.d <= R.near * kNear && nNear < R.maxNear) { w = 'full'; nNear++; } else if (!behind && r.d <= R.mid * kMid && nMid < R.maxMid) { w = 'mid'; nMid++; } } }
      r.want = w;
      // (streaming pass: a block past the haze, or up to 64 m beyond the draw distance, gets its far data anyway, after everything else,
      // so it shows the frame it comes into range instead of a few frames later)
      if (!w) { if (r.d <= R.draw + 64 && !sync) { if (r.chunk) { if (r.data.far === undefined) { if (r.chunk.far !== undefined) bindMember(r); else wantChunk(r.chunk, 1e4 + r.d); } } else if (r.data.far === undefined) want(r, 'far', 1e4 + r.d); } continue; }
      // requests (far always first: it is what fills the horizon)
      // cleanup pass · lazy heroes: a hero block streams like every other block — a far job first (jobs.js jobFar: a far-only build of
      // the hero, or its declared far), the full build only once it is wanted at mid or near (it used to be built early, however far)
      if (r.chunk) { if (r.data.far === undefined) { if (r.chunk.far !== undefined && !r.chunk.loading.chunk) bindMember(r); else wantChunk(r.chunk, r.pd - 1e4); } }
      else if (r.data.far === undefined) want(r, 'far', r.pd - (r.hero ? 2e4 : 1e4));   // (hero far jobs are the long ones: they go out first)
      if (w === 'full') { if (!r.data.full) want(r, 'full', r.pd - 1); if (!ready(r, 'mid')) want(r, 'mid', r.pd); }
      else if (w === 'mid' && !ready(r, 'mid')) want(r, 'mid', r.pd);
    }
    // streaming pass · prefetch: the blocks near where the camera will be in R.ahead s get their data now (after everything above)
    const sp = vel.length(); stat.speed = sp;
    if (!sync && sp > 3 && R.ahead) { PF.copy(vel).multiplyScalar(Math.min(R.ahead, (R.aheadMax ?? 320) / sp)).add(p); let n = 0;
      for (const r of sorted) { if (!r.buildable || r.want === 'full') continue; const d2 = distTo(r, PF); if (d2 > R.mid) continue;
        if (d2 <= R.near && !r.data.full && n < 24) { want(r, 'full', 1e4 + d2); n++; } if (!ready(r, 'mid') && n < 24 && (r.want !== 'mid')) { want(r, 'mid', 1e4 + d2 + 50); n++; } }
      stat.prefetch += n; }
    // drop queued requests nobody wants any more (the camera moved on); character full bodies keep pass 1c's rule
    for (const [k, it] of queue) { if (it.type === 'cf') { const w = it.rec.want; if (!w || w === 'far') queue.delete(k); } else if (it.seen !== chooseId) queue.delete(k); }
  }
  // ── display: best available tier at or below the wanted one
  function pick(r) { const d = r.data, w = r.want; if (!w) return null;
    if (w === 'full') return d.full ? 'full' : d.mid ? 'mid' : d.far ? 'far' : null;
    if (w === 'mid') return d.mid ? 'mid' : d.far ? 'far' : d.full ? 'full' : null;
    return d.far ? 'far' : d.mid ? 'mid' : null; }
  const isCF = (r, t) => t === 'far' && !!r.chunk;
  function chunkMesh(C) {
    if (C.mesh) return C.mesh;
    if (!C.mat) { const m = mats.tier.clone(); tierize(m, mats.tier._tierOpts || { vmat: true }); const kf = new Float32Array(16).fill(-2); C.kf = kf; m._uKF = { value: kf };
      const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, rr) => { prev(sh, rr); sh.uniforms.uKF = m._uKF;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aK; uniform float uKF[ 16 ]; varying float vKF;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vKF = uKF[ int( aK + .5 ) ]; if ( vKF < -1.5 ) transformed = vec3( 0. );');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vKF;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if ( vKF < .999 ) { vec2 q = mod( floor( gl_FragCoord.xy ), 4. ); int k = int( q.x ) + int( q.y ) * 4; float b = ( ${BAYER} + .5 ) / 16.;
    float p = vKF >= 0. ? vKF : -1. - vKF; if ( ( vKF >= 0. ) != ( b < p ) ) discard; }`); };
      m.customProgramCacheKey = () => 'tierchunk' + m.type; C.mat = m; }
    C.mesh = meshOf(C.far, C.mat, { k: true, cast: !!o.farShadows }); C.mesh.visible = false; groupStatic.add(C.mesh); uploadsThisFrame += C.far.n; return C.mesh; }
  const chunkSync = C => { if (C.mesh) { let any = false; for (let k = 0; k < C.members.length; k++) if (C.kf[k] > -1.5) any = true; C.mesh.visible = any; } };
  const setKF = (r, v) => { const C = r.chunk; if (!C.kf) return; C.kf[r.ck] = v; chunkSync(C); };
  const hasMesh = (r, t) => isCF(r, t) ? !!r.chunk.mesh : !!r.mesh[t];
  function tierVis(r, t, v) { if (isCF(r, t)) { setKF(r, v ? 1 : -2); return; } const m = r.mesh[t]; if (m) for (const x of [].concat(m)) x.visible = v; }
  function ensureMesh(r, t) {
    if (isCF(r, t)) { chunkMesh(r.chunk); return; }
    if (t === 'full') { if (!r.mesh.full) { r.mesh.full = r.data.full.map((tm, li) => tm ? meshOf(tm, mats.full[li], { cast: li !== 3 }) : null).filter(Boolean); r.mesh.full.forEach(m => groupStatic.add(m)); uploadsThisFrame += r.data.full.reduce((s, x) => s + (x ? x.n : 0), 0); } return; }
    if (!r.mesh[t]) { const tm = r.data[t]; r.mesh[t] = meshOf(tm, mats.tier, { cast: t !== 'far' || o.farShadows }); groupStatic.add(r.mesh[t]); uploadsThisFrame += tm.n; }
  }
  function hide(r, dispose) { if (r.fade) endFade(r); for (const t of ['far', 'mid', 'full']) { if (isCF(r, t)) { setKF(r, -2); continue; } const m = r.mesh[t]; if (!m) continue; for (const x of [].concat(m)) { x.visible = false; if (dispose) disposeMesh(x); } if (dispose) r.mesh[t] = null; }
    if (dispose) { disposeChars(r); } r.shown = null; }
  function show(r, t) { if (r.shown === t) return; const need = t === 'full' ? r.data.full.reduce((s, x) => s + (x ? x.n : 0), 0) : isCF(r, t) ? (r.chunk.mesh ? 0 : r.chunk.far.n) : r.data[t].n;
    if (!sync && !hasMesh(r, t) && uploadsThisFrame > 0 && (uploadsThisFrame + need > R.uploadVerts || uploadMs > (R.uploadMs ?? 1e9))) return;   // spread uploads over frames (vertices and main-thread ms)
    if (r.fade) endFade(r);
    const from = r.shown, t0 = performance.now(); ensureMesh(r, t); uploadMs += performance.now() - t0; tierVis(r, t, true);
    for (const x of ['far', 'mid', 'full']) if (x !== t && x !== from && hasMesh(r, x)) tierVis(r, x, false);
    if (FADE) { r.fade = { t0: performance.now(), to: t, from }; fading.add(r); setFade(r, 0); }
    else if (from && hasMesh(r, from)) tierVis(r, from, false);
    r.shown = t; r.seen = tick; shadowDirty = true; }
  // ── pass 1d fades: the incoming tier dithers in while the outgoing one dithers out with the complementary pattern
  const fadeMeshes = (r, t) => t && !isCF(r, t) && r.mesh[t] ? [].concat(r.mesh[t]) : [];
  function fadeMat(m, v) { if (!m.userData.base) { m.userData.base = m.material; m.material = fadeClone(m.material); } m.material._uFade.value = v; }
  function setFade(r, p) { const f = r.fade; for (const m of fadeMeshes(r, f.to)) fadeMat(m, p); for (const m of fadeMeshes(r, f.from)) fadeMat(m, -1 - p);
    if (isCF(r, f.to)) setKF(r, p); if (isCF(r, f.from)) setKF(r, -1 - p); }
  function endFade(r) { const f = r.fade; if (!f) return; r.fade = null; fading.delete(r);
    for (const t of [f.to, f.from]) for (const m of fadeMeshes(r, t)) if (m.userData.base) { fadeRelease(m.material); m.material = m.userData.base; m.userData.base = null; }
    if (f.from && f.from !== r.shown) tierVis(r, f.from, false); if (isCF(r, f.to) && r.shown === 'far') setKF(r, 1); shadowDirty = true; }
  function stepFades() { if (!fading.size) return; const now = performance.now(); for (const r of [...fading]) { const p = (now - r.fade.t0) / FADE; if (p >= 1) endFade(r); else setFade(r, p * p * (3 - 2 * p)); } }

  // ── characters
  // fidelity pass · continuity: a cluster moving from mid to far keeps its mid bodies until the boxes that replace it are drawn (the boxes
  // are rebuilt every 6 frames: the cluster used to vanish for up to 5 frames); a block whose people first appear on screen (its data
  // arrived, or it was just shown) dissolves them in (the block's own mid material, the boxes' aBorn); the range edge is the boxes' shrink.
  // fidelity pass (people round) · the baked people idle on the GPU, like the walkers: charbake.js gives every vertex its person's origin,
  // facing, part, class, phase and lean (t.X, t.Y → aPO, aPA); the shader turns the limbs about their joints, the head about the neck
  // and the body about the feet. One clock for everyone (uIdleT); the phase and a rate from the person's id keep nobody in step.
  const IDLE = { uIdleT: { value: 0 } }, IDLE_GLSL = `attribute vec4 aPO; attribute vec4 aPA; uniform float uIdleT;
mat3 idRx(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 idRy(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 idRz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
float idPulse(float x) { float f = fract(x); return smoothstep(0., .12, f) * (1. - smoothstep(.3, .45, f)); }
vec3 idleXf(vec3 p, bool nrm) {
  float cls = aPA.y; if (cls < .5) return p;
  float part = aPA.x, ph = aPA.z * .0246399, t = uIdleT * (.85 + .3 * fract(aPA.z * .0713)) + ph * 3.7, tilt = (aPA.w - 128.) / 128.;
  mat3 W = idRy(aPO.w * 9.5875e-5) * idRx(tilt), Wi = transpose(W); vec3 q = Wi * (nrm ? p : p - aPO.xyz);   // (cm, body-local: x across, y up, z ahead)
  float aL = 0., aR = 0., lL = 0., lR = 0., hy = 0., roll = 0., yaw = 0., bob = 0.;
  if (cls < 1.5) { float s = sin(t * 6.); aL = .5 * s; aR = .5 * sin(t * 6. + 2.1); lL = .16 * s; lR = -.16 * s; bob = 4. * abs(sin(t * 3.)); yaw = .28 * sin(t * 3.); }   // dance
  else if (cls < 2.5) { float w = sin(t * .9); roll = .07 * w; lL = .07 * w; lR = -.07 * w; yaw = .2 * sin(t * .37); bob = .8 + .8 * sin(t * 1.8);   // stand (traffic pass: readable at a glance, still calm):
    hy = .5 * (idPulse(t * .3) - idPulse(t * .3 + .5)) + .2 * sin(t * .55); aR = -1.1 * idPulse(t * .12 + .3) + .12 * sin(t * 1.1); aL = .14 * sin(t * .8 + 1.); }   // the weight from foot to foot, a slow turn and breathing, looks both ways, the phone every ~8 s, loose arms
  else if (cls < 3.5) { hy = .35 * sin(t * .45); aL = .1 * sin(t * 1.1); aR = .1 * cos(t * 1.3); roll = .015 * sin(t * .6); }   // sit
  else if (cls < 4.5) { hy = .4 * sin(t * .35); aL = .06 * sin(t * .9); aR = .06 * cos(t * .8); roll = .02 * sin(t * .5); }   // lean, window
  else { aR = .4 * sin(t * 3.2); aL = .3 * sin(t * 3.2 + 1.7); bob = 1.5 * abs(sin(t * 3.2)); hy = .2 * sin(t * .5); }   // work
  if (part > .5 && part < 2.5) { float a = part < 1.5 ? lL : lR; vec3 pv = vec3(0., 50., 2.5); q = nrm ? idRx(a) * q : pv + idRx(a) * (q - pv); }
  else if (part > 2.5 && part < 4.5) { float a = part < 3.5 ? aL : aR; vec3 pv = vec3(0., 82.5, 0.); q = nrm ? idRx(a) * q : pv + idRx(a) * (q - pv); }
  else if (part > 4.5) { vec3 pv = vec3(0., 95., 0.); q = nrm ? idRy(hy) * q : pv + idRy(hy) * (q - pv); }
  q = idRy(yaw) * idRz(roll) * q; if (!nrm) q.y += bob;
  return nrm ? W * q : aPO.xyz + W * q; }`;
  const idleize = m => { if (m._idle) return m; const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, rr) => { prev?.call(m, sh, rr); sh.uniforms.uIdleT = IDLE.uIdleT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + IDLE_GLSL).replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = idleXf(transformed, false);');
      if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = idleXf(objectNormal, true);'); };
    m.customProgramCacheKey = () => (key ? key.call(m) : m.type) + '|idle'; m._idle = true; m.needsUpdate = true; return m; };
  mats.charFull.forEach(idleize); const idleDepth = idleize(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const idleAttrs = (mesh, t) => { if (!t?.X || !t?.Y || t.X.length !== t.n * 4) return mesh; mesh.geometry.setAttribute('aPO', new THREE.BufferAttribute(t.X, 4)); mesh.geometry.setAttribute('aPA', new THREE.BufferAttribute(t.Y, 4)); return mesh; };
  const midMatFor = r => { if (!r.cmask) { r.cmask = { value: new THREE.Vector4(1, 1, 1, 1) }; r.cmat = idleize(tierize(mats.charMid.clone(), { mask: r.cmask })); r.cdepth = idleize(tierize(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { mask: r.cmask, lit: false })); } return r.cmat; };
  function disposeChars(r) { if (r.mesh.cmid) { disposeMesh(r.mesh.cmid); r.mesh.cmid = null; } if (r.mesh.cfull) { r.mesh.cfull.forEach(l => l && l.forEach(disposeMesh)); r.mesh.cfull = null; } if (r.charT.some(Boolean)) farDirty = true; r.charT = [null, null, null, null]; r.boxed = null; r.held = null; }
  let fullBudget = 0; const secs = () => performance.now() / 1000;
  function chars(r) {
    const cm = r.data.cm; if (!cm || !r.shown) { r.wantCf = false; if (r.charT.some(Boolean) || r.mesh.cmid) { if (r.mesh.cmid) r.mesh.cmid.visible = false; r.mesh.cfull?.forEach(l => l?.forEach(m => m.visible = false)); if (r.charT.some(t => t === 'far')) farDirty = true; r.charT = [null, null, null, null]; r.boxed = null; r.held = null; } return; }
    const nt = [null, null, null, null]; let wantCf = false;
    for (let c = 0; c < 4; c++) { const ce = cm.centres[c]; if (!ce) continue; const d = Math.hypot(ce[0] - cam.x, ce[1] - cam.y, ce[2] - cam.z), cur = r.charT[c];
      if (d < R.charNear * (cur === 'full' ? 1.15 : 1) && fullBudget + cm.count[c] <= R.charFull) { fullBudget += cm.count[c]; if (r.data.cf) nt[c] = 'full'; else { wantCf = true; nt[c] = 'mid'; } }
      else if (d < R.charMid * (cur === 'mid' || cur === 'full' ? 1.1 : 1)) nt[c] = 'mid';
      else if (d < R.charFar) nt[c] = 'far'; }
    r.wantCf = wantCf; if (wantCf && !r.loading.cf && !r.loading.block) want(r, 'cf', r.d);
    // first appearance on screen (nothing of this block drawn a frame ago): dissolve in (never in shots)
    if (FADE && !r.charT.some(Boolean) && nt.some(Boolean)) { r.cBorn = secs(); r.cFade = performance.now(); }
    // a cluster going to the boxes keeps what it had until a rebuild has drawn its boxes
    const held = r.held ??= [null, null, null, null], hold = [null, null, null, null];
    for (let c = 0; c < 4; c++) { if (nt[c] === 'far' && !r.boxed?.[c]) { if (r.charT[c] && r.charT[c] !== 'far') held[c] = r.charT[c]; hold[c] = held[c]; } else held[c] = null; }
    // full clusters: per-cluster meshes (chars.js MATS clones)
    for (let c = 0; c < 4; c++) { const isF = nt[c] === 'full' || hold[c] === 'full';
      if (isF && r.data.cf?.[c]) { r.mesh.cfull ??= [null, null, null, null]; if (!r.mesh.cfull[c]) { r.mesh.cfull[c] = r.data.cf[c].map((tm, li) => tm ? idleAttrs(meshOf(tm, mats.charFull[li], { cast: li !== 3, depth: idleDepth }), tm) : null).filter(Boolean); r.mesh.cfull[c].forEach(m => groupStatic.add(m)); uploadsThisFrame += r.data.cf[c].reduce((s, x) => s + (x ? x.n : 0), 0); } r.mesh.cfull[c].forEach(m => m.visible = true); }
      else if (r.mesh.cfull?.[c]) r.mesh.cfull[c].forEach(m => m.visible = false); }
    // mid: one mesh per block, clusters not at mid collapsed in the vertex shader
    const midAt = c => nt[c] === 'mid' || hold[c] === 'mid', anyMid = [0, 1, 2, 3].some(midAt);
    if (anyMid && cm.mid) { if (!r.mesh.cmid) { r.mesh.cmid = idleAttrs(meshOf(cm.mid, midMatFor(r), { k: true, depth: r.cdepth }), cm.mid); groupStatic.add(r.mesh.cmid); } r.mesh.cmid.visible = true; r.cmask.value.set(...[0, 1, 2, 3].map(c => midAt(c) ? 0 : 1)); }
    else if (r.mesh.cmid) r.mesh.cmid.visible = false;
    if (r.cmat) { const p = r.cFade ? (performance.now() - r.cFade) / FADE : 1; if (p >= 1) r.cFade = null; r.cmat._uFade.value = p >= 1 ? 1 : p * p * (3 - 2 * p); }
    if (nt.some((t, c) => (t === 'far') !== (r.charT[c] === 'far'))) { farDirty = true; if (r.boxed) for (let c = 0; c < 4; c++) if (nt[c] !== 'far') r.boxed[c] = 0; }
    if (nt.some((t, c) => t !== r.charT[c])) shadowDirty = true;
    r.charT = nt;
  }
  function rebuildBoxes() {
    let n = 0; for (const r of universe) if (r.data.cm && r.charT.includes('far')) { const f = r.data.cm.far; for (let k = 0; k < f.length; k += 11) if (r.charT[f[k + 10]] === 'far') n++; }
    if (n > boxCap) { if (boxes) { boxes.removeFromParent(); boxes.dispose(); } boxCap = Math.ceil(n * 1.5 + 256); boxGeo.setAttribute('aBorn', new THREE.InstancedBufferAttribute(new Float32Array(boxCap), 1)); boxes = new THREE.InstancedMesh(boxGeo, boxMat, boxCap); boxes.frustumCulled = false; boxes.castShadow = false; boxes.receiveShadow = true; scene.add(boxes); }
    if (!boxes) return; let w = 0; const born = boxGeo.attributes.aBorn.array;
    for (const r of universe) { if (!r.data.cm || !r.charT.includes('far')) continue; const f = r.data.cm.far; r.boxed ??= [0, 0, 0, 0];
      for (let k = 0; k < f.length; k += 11) { const c = f[k + 10]; if (r.charT[c] !== 'far') continue; Q.setFromAxisAngle(Y, f[k + 6]); V3.set(f[k], f[k + 1], f[k + 2]); S3.set(f[k + 3], f[k + 4], f[k + 5]); M4.compose(V3, Q, S3); boxes.setMatrixAt(w, M4);
        COL.setRGB(f[k + 7], f[k + 8], f[k + 9], THREE.SRGBColorSpace); boxes.setColorAt(w, COL); born[w] = r.cBorn || 0; r.boxed[c] = 1; w++; } }
    boxes.count = w; boxes.instanceMatrix.needsUpdate = true; if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true; boxGeo.attributes.aBorn.needsUpdate = true; farDirty = false; stat.boxes = w;
  }
  // continuity stats (tools/flythrough.mjs, __city.stream.charStats()): a cluster's people drawn and on screen one frame and not the next
  // (or the reverse) while still in view and in range. The dissolves and the range edge's shrink are not pops: they are counted apart.
  const CT = { rem: 0, spawn: 0, soft: 0, log: [], remWhy: {}, spawnWhy: {}, FR: new THREE.Frustum(), PM: new THREE.Matrix4(), S: new THREE.Sphere(), last: null };
  function charTrack() { const cp = camera.position, jump = !CT.last || CT.last.distanceTo(cp) > 60; CT.last = (CT.last || cp.clone()).copy(cp); boxU.uFar.value = R.charFar; boxU.uNow.value = secs(); IDLE.uIdleT.value = secs();
    camera.updateMatrixWorld(); CT.PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); CT.FR.setFromProjectionMatrix(CT.PM); const fogFar = scene.fog ? scene.fog.far : 1e9, bump = (o, k, n) => { o[k] = (o[k] || 0) + n; };
    for (const r of universe) { const cm = r.data.cm, prev = r.cdraw || (r.cdraw = [0, 0, 0, 0]); if (!cm && !prev.some(Boolean)) continue;
      for (let c = 0; c < 4; c++) { const t = r.charT[c], ce = cm?.centres?.[c] || r.cce?.[c];
        const now = !!(cm?.centres?.[c] && (r.mesh.cfull?.[c]?.[0]?.visible || (r.mesh.cmid?.visible && r.cmask.value.getComponent(c) === 0) || (t === 'far' && r.boxed?.[c]))) ? 1 : 0;   // (what is drawn)
        if (now !== prev[c] && !jump && ce) { const d = Math.hypot(ce[0] - cp.x, ce[1] - cp.y, ce[2] - cp.z); CT.S.center.set(ce[0], ce[1] + 1, ce[2]); CT.S.radius = 6;
          if (d < fogFar && d < R.charFar * .95 && CT.FR.intersectsSphere(CT.S)) { const n = (cm ? cm.count?.[c] : r.ccount?.[c]) || 0;
            if (now && FADE && r.cFade) CT.soft += n; else if (now) { CT.spawn += n; bump(CT.spawnWhy, !r.cseen?.[c] ? 'first' : 'return', n); }
            else { CT.rem += n; bump(CT.remWhy, !r.shown ? 'block' : !cm ? 'data' : t ? 'tier' : 'range', n); }
            if (!(now && FADE && r.cFade)) { CT.log.push([now ? '+' : '-', r.key, c, t, Math.round(d), r.shown, n, tick]); if (CT.log.length > 40) CT.log.shift(); } } }
        prev[c] = now; if (now) (r.cseen ??= [0, 0, 0, 0])[c] = 1; }
      // F26 (audit 2026-10-08) · what the next frame needs once the data is gone: the centres and the head counts (they used to keep the
      // whole record, r.ccm = cm: an evicted block's character buffers stayed alive, uncounted by memory()). Copies: nothing of the record.
      if (cm) { const k = r.ccount ??= [0, 0, 0, 0], ce = r.cce ??= [null, null, null, null];
        for (let c = 0; c < 4; c++) { k[c] = cm.count?.[c] || 0; const x = cm.centres?.[c]; if (!x) ce[c] = null; else { const y = ce[c] ??= [0, 0, 0]; y[0] = x[0]; y[1] = x[1]; y[2] = x[2]; } } } } }
  function charStats() { return { onScreenRemovals: CT.rem, onScreenSpawns: CT.spawn, dissolvedIn: CT.soft, removalWhy: { ...CT.remWhy }, spawnWhy: { ...CT.spawnWhy }, boxes: stat.boxes || 0, last: CT.log.slice(-12) }; }
  // ── eviction: GPU meshes not shown for a while, then tier data by distance — never data a request or a prefetch asked for in the
  // last second (it would be dropped the frame it arrived). Streaming pass: the mid data of a block past 1.25 × the mid radius and the
  // full data past 1.6 × the near radius go (the baked city keeps everything resident in its workers, a re-read is a ~1 ms decode)
  function evict() {
    for (const r of universe) { if (r.shown === 'full' || r.want === 'full' || r.fade) continue; const kept = tick - r.keep < 60;
      if (r.mesh.full && tick - r.seen > 90) { r.mesh.full.forEach(disposeMesh); r.mesh.full = null; }
      if (r.data.full && r.d > R.near * 1.6 && !kept) { r.data.full = undefined; r.data.cf = undefined; if (r.mesh.cfull) { r.mesh.cfull.forEach(l => l && l.forEach(disposeMesh)); r.mesh.cfull = null; } }
      if (!r.want) { if (tick - r.seen > 120) hide(r, true); if (r.d > R.draw * 1.4 && !kept) { r.data = {}; r.maxH = 30; } }
      else if (r.want === 'far' && r.mesh.mid && tick - r.seen > 120 && r.shown !== 'mid') { disposeMesh(r.mesh.mid); r.mesh.mid = null; }
      if (r.data.mid && !r.mesh.mid && r.want !== 'mid' && r.shown !== 'mid' && r.d > R.mid * 1.25 && !kept) { r.data.mid = undefined; r.data.cm = undefined; disposeChars(r); } }
    for (const C of chunks.values()) { if (C.far === undefined || C.loading.chunk) continue;   // a chunk nobody is near: its mesh, then its data
      if (C.members.some(r => r.want || r.fade || r.shown || r.d <= R.draw + 64)) continue;   // (a chunk at the edge of the range keeps its mesh)
      if (C.mesh) { disposeMesh(C.mesh); C.mesh = null; } if (C.members.every(r => r.d > R.draw * 1.4)) { C.far = undefined; C.info = null; for (const r of C.members) r.data.far = undefined; } }
  }

  const lastCam = new THREE.Vector3(1e9, 0, 0);
  function update() {
    tick++; uploadsThisFrame = 0; uploadMs = 0; fullBudget = 0;
    // the camera's velocity (smoothed over ~0.3 s; a jump — a teleport — resets it)
    const now = performance.now(), p = camera.position; if (lastT !== null) { const dt = (now - lastT) / 1000, jump = p.distanceTo(lastPos);
      if (jump > 80 || dt <= 0 || dt > .5) vel.set(0, 0, 0); else { const a = 1 - Math.exp(-dt / .3); V3.subVectors(p, lastPos).divideScalar(dt); vel.lerp(V3, a); } }
    lastT = now; lastPos.copy(p);
    if (camera.position.distanceTo(lastCam) > 1.5 || tick - lastSort > 20) { choose(); lastCam.copy(camera.position); lastSort = tick; }
    const pr = dispatch();
    for (const r of sorted) { const t = pick(r); if (t) show(r, t); else if (r.shown) hide(r, false); }
    // (a woods chunk whose members are about to come into range gets its mesh ahead, hidden, while there is upload budget: sixteen blocks
    // come out of the haze at once, and they used to wait a frame or two for it)
    if (!sync && uploadsThisFrame < R.uploadVerts / 2) for (const C of chunks.values()) if (C.far && !C.mesh && C.members.some(r => r.d <= R.draw + 64)) { chunkMesh(C); break; }
    stepFades();
    for (const r of sorted) chars(r);
    if (farDirty && (tick % 6 === 0 || sync)) rebuildBoxes();
    charTrack();   // (fidelity pass: the boxes' range and dissolve uniforms, and the characters' continuity stats)
    if (puts.length) { const [k, v, b] = puts.shift(); cache.put(k, v, b); }
    if (!sync && tick % 30 === 0) evict();
    return pr;
  }
  // everything wanted is loaded and shown at its wanted tier (for load timing, the load-in, shots and the benchmark)
  const done = r => !r.want || r.shown === r.want || (r.want === 'far' && r.shown === 'mid') || r.failed || (r.want === 'far' && r.emptyFar);
  function settled() { if ([...queue.values()].some(it => it.prio < 1e4) || stat.pending) return false; for (const r of universe) if (r.wantCf) return false; for (const r of universe) if (!done(r)) return false; return true; }
  function firstView() { for (const r of universe) if (r.want && !r.shown && !r.failed && !r.emptyFar) return false; return universe.some(r => r.shown); }
  // streaming pass · the load-in's progress: blocks wanted and blocks done (at their wanted tier), and what is still in flight
  function progress() { let want = 0, ok = 0; for (const r of universe) { if (!r.want) continue; want++; if (done(r) && !r.wantCf) ok++; } return { want, done: ok, queue: queue.size, pending: stat.pending }; }
  function counts() { const c = { far: 0, mid: 0, full: 0, charFull: 0, charMid: 0, charFar: 0, tris: 0 };
    for (const r of universe) { if (r.shown) c[r.shown]++; if (r.shown === 'full') c.tris += r.data.full.reduce((s, x) => s + trisOf(x), 0); else if (r.shown) c.tris += trisOf(r.data[r.shown]);
      r.charT.forEach((t, k) => { if (t === 'full') c.charFull += r.data.cm.count[k]; if (t === 'mid') c.charMid += r.data.cm.count[k]; if (t === 'far') c.charFar += r.data.cm.count[k]; }); } return c; }
  // streaming pass · resident memory: CPU = tier data held by the page, GPU = vertex + index buffers of meshes that exist; by group
  // (o.groupOf(i, j): the woods against the city), with the triangles on screen
  const geoBytes = m => { if (!m) return 0; const g = m.geometry; let b = g.index ? g.index.array.byteLength : 0; for (const a of Object.values(g.attributes)) b += a.array.byteLength; return b; };
  function memory() { const by = {}, G = r => by[o.groupOf?.(r.i, r.j) || 'all'] ??= { cpu: 0, gpu: 0, tris: 0, shown: 0 };
    for (const r of universe) { const g = G(r), d = r.data;
      g.cpu += tierBytes(d.mid) + tierBytes(d.full) + (r.chunk ? 0 : tierBytes(d.far)) + (d.cm ? tierBytes(d.cm.mid) + (d.cm.far?.byteLength || 0) : 0) + (d.cf ? tierBytes(d.cf.flat()) : 0);
      for (const t of ['far', 'mid', 'full']) for (const m of [].concat(r.mesh[t] || [])) g.gpu += geoBytes(m);
      if (r.mesh.cmid) g.gpu += geoBytes(r.mesh.cmid); r.mesh.cfull?.forEach(l => l?.forEach(m => { g.gpu += geoBytes(m); }));
      if (r.shown) { g.shown++; g.tris += r.shown === 'full' ? d.full.reduce((s, x) => s + trisOf(x), 0) : trisOf(d[r.shown]); } }
    for (const C of chunks.values()) { const g = G(C.members[0]); g.cpu += tierBytes(C.far || null); g.gpu += geoBytes(C.mesh); }
    const tot = { cpu: 0, gpu: 0, tris: 0, shown: 0 }; for (const g of Object.values(by)) for (const k in tot) tot[k] += g[k]; return { ...tot, by }; }
  // V6 (render review 2026-10-09) · the characters' shader variants, for main.js's warm-up behind the load-in: a degenerate quad per material
  // the character tiers draw with (the idle mid tier with its cluster mask and its depth material; the four full-body layers with
  // idleDepth), built as chars() builds them (meshOf, midMatFor), so they compile the programs a block will use. Nothing is drawn.
  function warmObjects() { const g = new THREE.Group(), q = { n: 4, o: [0, 0, 0], P: new Int16Array(12), N: new Int8Array(12), C: new Uint8Array(16), F: new Uint8Array(1), K: [0, 0, 0, 0] }, r = {};
    g.add(meshOf(q, midMatFor(r), { k: true, depth: r.cdepth })); mats.charFull.forEach((m, li) => g.add(meshOf(q, m, { cast: li !== 3, depth: idleDepth })));
    for (const m of g.children) m.frustumCulled = false; return g; }
  // shots: run every wanted job synchronously, then show everything at its wanted tier
  async function drain() { for (let guard = 0; guard < 6000; guard++) { choose(); lastSort = tick; if (!queue.size) break; await dispatch(); } await update(); for (const r of sorted) chars(r); rebuildBoxes(); }
  return { charStats, setUniverse, update, settled, firstView, progress, counts, memory, drain, stat, blocks, chunks, warmObjects, get mode() { return mode; }, get velocity() { return vel.length(); }, setPreset(p) { R = p; lastSort = -1e9; }, fading: () => fading.size,
    takeShadowDirty() { const d = shadowDirty; shadowDirty = false; return d; }, queueSize: () => queue.size };
}
