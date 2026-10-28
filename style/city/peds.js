// Pass 2 · GENERIC PEDESTRIANS (main thread). Cleanup pass: the walking itself — the one-way sidewalk graph, the lanes, following, the
// corners, agents and density — is pedsim.js (the audit runs the same code); this file draws it.
//   who     the city's cast (cast.js rollLook: the fresh traits slime didn't kill), a pool of looks baked once in workers (pedbake.js), in three tiers:
//           near: the full body with its legs and arms swinging on the GPU (one BatchedMesh: any look in any slot)
//           mid: the coarse body mid-stride (one BatchedMesh) · far: three boxes (one InstancedMesh)
//   how many  pedsim.js PED: walkers per 100 m of sidewalk from the sim's street demand (rules DEMAND [day, night]) × the kit's
//           peds.density, ×2 in a Director rush. setDemand(crowd, rush) takes the adapter's model.
//   agents  addAgent({ id, look, from, to }) / setAgentTarget / removeAgent: sim agents on the same graph, walked first. ?agents=N shows
//           N demo agents crossing the area around the camera. SIM LIVE pass: the live sim's own agents are driven by simstate/agents.js
//           (peds.driver, called each frame before the crowd is topped up, so agents take their lane spots first) in their own looks
//           (addLook: a look baked in simstate/looks.js's own worker, appended to the batches; generic walkers keep the pool baked here).
// Deterministic (a seeded rng), so shots repeat. ?peds=0 turns them off.
// FIDELITY PASS (2026-09-28) · continuity: nobody appears or vanishes while on screen.
//   · the crowd lives in two discs: round what the camera looks at (PED.radius) and round the camera itself, as far as walkers are drawn
//     (R.charFar), so a street seen down its length has its walkers before the camera gets there
//   · a walker leaves only after PED.grace s unseen, and arrives only where nobody can see it (pedsim.js populate, o.seen)
//   · at the edge of their range walkers shrink to nothing (the last 15 % of R.charFar), so crossing it is never a pop
//   · tiers keep their walkers (hysteresis, the previous tier first under a cap), and the mid and far batches grow instead of dropping
//   · far bodies: one BatchedMesh instance per walker (the three boxes of its look, one geometry per look) instead of three instances
//   · stats(): onScreenRemovals / onScreenSpawns (cumulative, with the reasons), visible (walkers drawn on screen now), pool (walkers alive)
// ANIMATION MERGE (2026-09-29) · the near walkers are the anim lab's walk v2 (anim/README.md): closed rigid segments (pedbake.js, anim/
// bake.js), posed in the vertex shader from a keyed cycle (anim/walk2.js: three texels per walker, written from pedsim.js animate's gait
// and idle state); the heading is pedsim.js face()'s (rate-limited, all three tiers, so a tier switch mid-turn never snaps), the corners
// are arcs (pedsim.js where). No instance-matrix bob on the near tier: the pelvis height is keyed. Mid and far are as before.
import * as THREE from 'three';
import { tierize } from './gpu.js';
import { createPedSim, CROWD, PED, pedsPer100 } from './pedsim.js';
import { geometryOf } from './gpu.js';
import { CLOCK } from './traffic/rules.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from './anim/cast/walk2.js';   // (cast pass: the fresh cast's walk: connected legs + the seat's midline fix)
import { ELBOW } from './anim/cast/elbow/styles.js';   // (THE ELBOW, 2026-10-08: the cast's bend style, compiled into the walker; ai-city-fresh ELBOW.md § The cast)
import { createFineAtlas, installFine, fineAttr } from './anim/cast/fine.js';   // (cast pass: fine detail on the near tier, ai-city-fresh PORTING.md §3)
import { sdata } from '../../world/city.js';   // (SPREAD: the data this spread reads)
import { installFade } from './camera/fade.js';   // (CAMERA FADE 10-09b: near the camera or on its line to the person followed, a walker dissolves)
const TURN_LEAN = .09;   // lean into a turn (rad per rad/s per m/s; the lab's v1 WALK.turnLean, shared by v2)
export { CROWD, PED, pedsPer100 };

export function createPeds({ scene, night, R, bake, seed = 0x9ed5, densityOf = () => 1, avoid = true }) {   // (avoid false: nobody follows or waits at corners — the bench's A/B of the avoidance cost, ?avoid=0)
  const sim = createPedSim({ night, seed, densityOf, clock: () => CLOCK.t });   // (traffic pass: the crossings read the lights on the shared clock)
  // RIDERS AVOID (2026-10-08) · the side room table (simstate/room.json, tools/riderprobe.mjs --room): the clear strip round every side's
  // lane, so a walker stepping aside for a rider (pedsim.js) and a rider's weave (simstate/movement.js) stay clear of what is on the sidewalk.
  // ?ridersavoid=0: the crowd doesn't make way (and movement.js doesn't weave) — as before
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('ridersavoid') === '0') PED.yieldOn = false;
  else fetch(new URL(sdata('./simstate/room.json'), import.meta.url), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(T => { if (T) sim.setRoom(T); }).catch(() => {});
  // ── drawing: near + mid BatchedMesh (a geometry per look), far boxes
  let nearM = null, midM = null, farM = null, pedTex = null, G = null, uni = null, nearIds = [], midIds = [], farIds = [], nearCap = 0, midCap = 0, farCap = 0, farV = 0, farI = 0, ready = false, looks = 0, driver = null;
  const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 }), BOXES = [[.24, .46, .48, .3], [.72, .56, .5, .36], [1.28, .8, .66, .74]];   // (y, w, h, d)
  const farGeo = main => { const P = [], N = [], C = [], I = [], c = new THREE.Color();   // the far body: legs · torso · head, in the look's three main colours (linear)
    BOXES.forEach(([y, w, h, d], q) => { const g = new THREE.BoxGeometry(w, h, d).translate(0, y, 0), p = g.attributes.position.array, n = g.attributes.normal.array, o = P.length / 3; c.setHex(main[q], THREE.SRGBColorSpace);
      for (let k = 0; k < p.length; k++) { P.push(p[k]); N.push(n[k]); } for (let k = 0; k < p.length / 3; k++) C.push(c.r, c.g, c.b); for (const i of g.index.array) I.push(i + o); g.dispose(); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g; };
  const room = { nv: 0, ni: 0, mv: 0, mi: 0, nvCap: 0, niCap: 0, mvCap: 0, miCap: 0, fCap: 0 };   // (SIM LIVE: the batches' geometry use, so addLook can grow them)
  // cleanup pass · the walkers' dogs (props.js dog: 4 breeds × 5 coats, two walking frames and a sit for when the owner waits), one
  // BatchedMesh drawn with the near and mid walkers, on the lane PED.dogLead m ahead of the owner (pedsim.js ahead)
  let dogM = null, dogIds = null; const DOG_CAP = 96, dogMat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: 0 }));
  const nearMat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }), midMat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true });
  nearMat.customProgramCacheKey = () => 'ped-near';   // (walk2.js installAnim2 extends it, in build(): the texture's size is known there)
  // CAST PASS (2026-10-02) · fine paint on the near tier: one atlas for every walker look, one hook on the near material (after the cache
  // key above: installFine wraps it). Near geometries carry aFine (zeros for a look with no paint); mid, far and the depth pass are untouched
  // (the mid bake resamples chars.js build(), which draws each painted face in its average colour; far reads full.main).
  const fineAtlas = createFineAtlas(THREE); installFine(nearMat, fineAtlas);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); depthMat.customProgramCacheKey = () => 'ped-depth';
  const geoOf = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(t.K), 1)); g.setIndex(new THREE.BufferAttribute(t.I, 1)); return g; };
  const nearGeo = l => { fineAtlas.adopt(l.full); const g = geoOf(l.full); g.setAttribute('aFine', fineAttr(THREE, l.full)); return g; };   // (cast pass: the near tier's geometry + fine paint)
  function build(res) {
    const L = res.looks; looks = L.length; sim.looks = looks; nearCap = Math.max(8, Math.min(128, R.charFull)); midCap = 720; farCap = 2048;   // (cleanup pass: room for Neon Row's night crowd; fidelity pass: the preset's full budget (120 on high, it stopped at 64), and mid and far grow)
    const vN = L.reduce((s, l) => s + l.full.P.length / 3, 0), iN = L.reduce((s, l) => s + l.full.I.length, 0), vM = L.reduce((s, l) => s + l.mid.P.length / 3, 0), iM = L.reduce((s, l) => s + l.mid.I.length, 0);
    pedTex = createAnimTexture2(nearCap); [uni, G] = animUniforms2(pedTex, WALK2, { turnLean: TURN_LEAN }); installAnim2(nearMat, uni, { elbow: ELBOW }); installAnim2(depthMat, uni, { elbow: ELBOW });   // (animation merge: walk v2; the elbow compiled in: the bake is band-tagged, Float32 aPart)
    nearM = new THREE.BatchedMesh(nearCap, vN, iN, nearMat); nearM.customDepthMaterial = depthMat; midM = new THREE.BatchedMesh(midCap, vM, iM, midMat);
    for (const m of [nearM, midM]) { m.castShadow = true; m.receiveShadow = true; m.sortObjects = false; m.perObjectFrustumCulled = true; m.frustumCulled = false; }   // the batch's own bounding sphere is computed once and never refreshed as walkers move (three r185), so whole-batch culling hid every walker at some angles: cull per walker only
    nearIds = L.map(l => nearM.addGeometry(nearGeo(l))); midIds = L.map(l => midM.addGeometry(geoOf(l.mid)));
    Object.assign(room, { nv: vN, ni: iN, mv: vM, mi: iM, nvCap: vN, niCap: iN, mvCap: vM, miCap: iM });
    for (let k = 0; k < nearCap; k++) { nearM.addInstance(nearIds[0]); nearM.setVisibleAt(k, false); } for (let k = 0; k < midCap; k++) { midM.addInstance(midIds[0]); midM.setVisibleAt(k, false); }
    // far: three boxes each (legs · torso · head) in the look's main colours, one geometry per look in one BatchedMesh (fidelity pass)
    const fg = L.map(l => farGeo(l.main)); farV = fg[0].attributes.position.count; farI = fg[0].index.count;
    farM = new THREE.BatchedMesh(farCap, farV * (L.length + 24), farI * (L.length + 24), farMat); farM.castShadow = false; farM.receiveShadow = true; farM.sortObjects = false; farM.perObjectFrustumCulled = true; farM.frustumCulled = false;
    farIds = fg.map(g => farM.addGeometry(g)); room.fCap = L.length + 24; for (let k = 0; k < farCap; k++) { farM.addInstance(farIds[0]); farM.setVisibleAt(k, false); }
    const geos = (res.dogs || []).filter(Boolean).map(t => geometryOf(t)); dogIds = [];   // (baked in the worker with the looks: jobs.js jobPeds)
    if (geos.length) { dogM = new THREE.BatchedMesh(DOG_CAP, geos.reduce((n, g) => n + g.attributes.position.count, 0), geos.reduce((n, g) => n + g.index.count, 0), dogMat); dogM.castShadow = true; dogM.receiveShadow = true; dogM.sortObjects = false; dogM.perObjectFrustumCulled = true; dogM.frustumCulled = false;
      dogIds = geos.map(g => dogM.addGeometry(g)); for (let k = 0; k < DOG_CAP; k++) { dogM.addInstance(dogIds[0]); dogM.setVisibleAt(k, false); } scene.add(dogM); }
    for (const m of [nearMat, midMat, farMat, dogMat]) installFade(m, 'walker');
    scene.add(nearM, midM, farM); ready = true; }
  bake().then(build).catch(e => console.error('peds: bake failed', e));
  // SIM LIVE pass · a sim agent's own look ({ full, mid, main }, pedbake.js's shape) appended to the batches → its look index (≥ the
  // generic pool, which generic walkers keep). The batches grow with room to spare (by half again, V8 below), so most looks cost no reallocation.
  // V8 (render review 2026-10-09) · the near and mid batches grow by half again (at least 24 looks' room), as the far batch does (F28).
  // A growth copies the whole batch and re-uploads it; growing by a fixed 24 looks made every growth bigger than the last (300 agents:
  // about 13 of them, 44 MB and up). By half again, a few growths cover any count.
  const grow = (cap, need, per) => Math.max(need, Math.ceil(cap * 1.5), Math.ceil(cap + per * 24));
  function addLook(l) { if (!ready || !l?.full || !l?.mid) return -1; const gf = nearGeo(l), gm = geoOf(l.mid), nv = gf.attributes.position.count, ni = gf.index.count, mv = gm.attributes.position.count, mi = gm.index.count;
    if (room.nv + nv > room.nvCap || room.ni + ni > room.niCap) { room.nvCap = grow(room.nvCap, room.nv + nv, nv); room.niCap = grow(room.niCap, room.ni + ni, ni); nearM.setGeometrySize(room.nvCap, room.niCap); }
    if (room.mv + mv > room.mvCap || room.mi + mi > room.miCap) { room.mvCap = grow(room.mvCap, room.mv + mv, mv); room.miCap = grow(room.miCap, room.mi + mi, mi); midM.setGeometrySize(room.mvCap, room.miCap); }
    nearIds.push(nearM.addGeometry(gf)); midIds.push(midM.addGeometry(gm)); room.nv += nv; room.ni += ni; room.mv += mv; room.mi += mi;
    // F28 (audit 2026-10-08) · the far batch's room is counted in looks (room.fCap) and grows only when it is full, by half again (at
    // least 24 looks): it used to be resized on every look once 24 had been added (50 looks: 26 resizes, 5000: 4976, each a copy of
    // the whole batch and a fresh upload). Every look's far geometry is the same three boxes (farV, farI).
    if (farIds.length + 1 > room.fCap) { room.fCap = Math.max(farIds.length + 1, room.fCap + 24, Math.ceil(room.fCap * 1.5)); farM.setGeometrySize(farV * room.fCap, farI * room.fCap); }
    farIds.push(farM.addGeometry(farGeo(l.main))); return nearIds.length - 1; }
  const lk = w => w.look >= looks && w.look < nearIds.length ? w.look : w.look % looks;   // (a sim agent's own look, else the pool: generic walkers as before)
  // ── demo agents (?agents=N): sim agents walk to a corner near the focus, then to another
  let demo = 0; const demoLook = k => (k * 7 + 3) % Math.max(1, looks);
  function demoAgents(focus) { const near = [...sim.nodes.values()].filter(n => n.out.length && Math.hypot(n.x - focus.x, n.z - focus.z) < 70), pick = () => near[(Math.random() * near.length) | 0];
    if (!near.length) return; while (sim.agents.length < demo) { const a = pick(), b = pick(); if (!sim.addAgent({ id: 'demo-' + sim.agents.length + '-' + Math.round(sim.t * 10), look: demoLook(sim.agents.length), from: [a.x, a.z], to: [b.x, b.z] })) break; }
    for (const w of sim.agents) if (w.arrived) { const b = pick(); sim.setAgentTarget(w.aid, [b.x, b.z]); } }
  // ── per frame
  const M4 = new THREE.Matrix4(), Qn = new THREE.Quaternion(), V3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), SF = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const SC = new THREE.Vector3(.01, .01, .01), DP = [0, 0, 0, 0];   // (dog meshes are in centimetres, like every tier mesh: gpu.js)
  let lastPop = -1e9, frame = 0, fx = 0, fz = 0, px = 1e9, pz = 1e9, want = 0, cam = null, activeR2 = 0, farN = 0;
  const active = w => { const dx = w.p[0] - cam.x, dz = w.p[2] - cam.z; return dx * dx + dz * dz < activeR2; }, NONE = () => false;
  const near = [], mid = [], far = [], nearB = [], midB = [];
  // fidelity pass · what the camera can see: inside the frustum (a sphere round the body) and nearer than the haze's far edge and the
  // walkers' range; a walker's size at distance d (1 → 0 over the last 15 % of R.charFar: the range edge is never a pop)
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), SP = new THREE.Sphere(); let fogFar = 1e9, rng = 250, visR2 = 0;
  const sizeAt = d => d <= rng * .85 ? 1 : d >= rng ? 0 : (t => t * t * (3 - 2 * t))((rng - d) / (rng * .15));
  const inView = (p, r) => { SP.center.set(p[0], p[1] + .9, p[2]); SP.radius = r; return FR.intersectsSphere(SP); };
  const seen = (p, spawn) => { const dx = p[0] - cam.x, dy = p[1] + .9 - cam.y, dz = p[2] - cam.z; return dx * dx + dy * dy + dz * dz < visR2 && inView(p, spawn ? 3 : 1.2); };   // (populate's test)
  const onScreen = (w, d) => d < fogFar && sizeAt(d) >= .25 && inView(w.p, .9);
  // continuity stats: an on-screen removal is a walker drawn and on screen last frame that is not drawn now although it would still be on
  // screen (or has left the sim); an on-screen spawn is a walker drawn and on screen now that was not drawn last frame although it was on
  // screen then (or is new). Teleports (a go-to: the load-in hides them) reset the tracking. (walkers-fix: one that was out of view or out of
  // range last frame came into view — the camera turned onto it, it walked in — it did not appear: before, a walker that had arrived
  // unseen a moment earlier and was swept into the edge of a turning view, 290 m out, counted as a spawn)
  const T = { rem: 0, spawn: 0, remWhy: {}, spawnWhy: {}, vis: 0, prev: [], maxId: 0, frames: 0, ms: 0, msMax: 0, log: [] }, why = (o, k) => { o[k] = (o[k] || 0) + 1; };
  // (walkers-fix: the last few continuity events, for looking into one: what, who, how far, how long it had lived, where on the screen)
  const note = (k, w, d) => { const v = V3.set(w.p[0], w.p[1] + .9, w.p[2]).project(camera0); T.log.push({ k, f: frame, id: w.id, d: +d.toFixed(1), age: +(sim.t - (w.born ?? -1)).toFixed(2), ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], cross: !!w.E?.cross, agent: !!w.agent }); if (T.log.length > 16) T.log.shift(); };
  let camera0 = null;
  const growTo = (m, cap, n) => { if (n <= cap || typeof m.setInstanceCount !== 'function') return cap; const c = Math.ceil(n * 1.25 + 64); m.setInstanceCount(c); for (let k = cap; k < c; k++) { m.addInstance(0); m.setVisibleAt(k, false); } return c; };
  return {
    sim, get count() { return sim.walkers.length; }, get want() { return want; },
    setDemand(c, r) { sim.setDemand(c, r); lastPop = -1e9; },
    addLanes(key, l) { sim.addLanes(key, l); },
    addAgent: o => sim.addAgent(o), setAgentTarget: (id, to) => sim.setAgentTarget(id, to), removeAgent: id => sim.removeAgent(id), set demoAgents(n) { demo = n; },
    get anim() { return { batch: nearM, mid: midM, far: farM, uni, G, tex: pedTex, cap: nearCap, mat: nearMat, near: near.slice(), fine: fineAtlas.stats() }; },   // (animation merge: the near batch, for the pixel checks)
    addLook, get ready() { return ready; }, get looks() { return looks; }, set driver(f) { driver = f; }, get driver() { return driver; },   // (SIM LIVE)
    update(t, dt, camera, Rp, focusIn) {
      if (!ready) return 0; const T0 = performance.now(); R = Rp || R; frame++; const focus = focusIn || camera.position; cam = camera.position; camera0 = camera; activeR2 = (R.charMid * 1.3) ** 2;
      camera.updateMatrixWorld(); PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM);
      fogFar = scene.fog ? scene.fog.far : 1e9; rng = R.charFar; const vr = Math.min(fogFar, rng * .97); visR2 = vr * vr;   // (past .97 of the range a walker is under a tenth of its size)
      if (driver) driver(t, dt, focus, camera, R);   // (SIM LIVE: the sim's agents move first, then the crowd fills round them)
      const jump = frame > 1 && (Math.hypot(cam.x - px, cam.z - pz) > 120 || Math.hypot(focus.x - fx, focus.z - fz) > 150);   // (a go-to)
      if (frame === 1 || jump || Math.hypot(focus.x - fx, focus.z - fz) > 12 || Math.hypot(cam.x - px, cam.z - pz) > 12 || t - lastPop > 2) {
        const rc = Math.sqrt(Math.max(0, (rng + 30) ** 2 - Math.max(0, cam.y) ** 2));   // (the camera's disc: as far as a walker on the ground can be drawn, and a 30 m band past it where arrivals ahead can land unseen)
        want = sim.populate(focus, frame === 1 || jump, { seen, cam: [cam.x, cam.z, rc] }); fx = focus.x; fz = focus.z; lastPop = t; if (jump) T.prev = []; }
      px = cam.x; pz = cam.z;
      if (demo && (frame === 2 || frame % 30 === 0)) demoAgents(focus);
      sim.step(Math.min(dt, .1), avoid ? active : NONE);
      // tiers: in view (3 m margin: a body's shadow reaches into it) and in range; the tier a walker had comes first under its cap
      near.length = mid.length = far.length = nearB.length = midB.length = 0; let moving = 0; const now = sim.t;
      for (const w of sim.walkers) { let p = w.p, d = Math.hypot(p[0] - cam.x, p[1] - cam.y, p[2] - cam.z);
        if (d > R.charNear * 1.2 && (d > rng + 4 || !inView(p, 3))) { if ((frame + w.id) % 6 === 0) sim.where(w); w.tier = 0; w.dn = 0; w.outF = frame; continue; }   // (out of view: its place is refreshed now and then)
        if (d < R.charMid || (frame + w.id) & 1 || w.tier === 0) { p = sim.where(w); sim.face(w); d = Math.hypot(p[0] - cam.x, p[1] - cam.y, p[2] - cam.z); }   // (far bodies move every other frame; the heading turns at a limited rate: pedsim.js face)
        if (d >= rng) { w.tier = 0; w.dn = 0; continue; } if (d < 160) moving++; w.dn = d;
        if (d < R.charNear * (w.tier === 1 ? 1.1 : 1)) (w.tier === 1 ? near : nearB).push(w); else if (d < R.charMid * (w.tier === 2 ? 1.08 : 1)) (w.tier === 2 ? mid : midB).push(w); else far.push(w); }
      for (const w of nearB) near.push(w); for (let k = nearCap; k < near.length; k++) midB.push(near[k]); if (near.length > nearCap) near.length = nearCap;
      for (const w of midB) mid.push(w); midCap = growTo(midM, midCap, mid.length); for (let k = midCap; k < mid.length; k++) far.push(mid[k]); if (mid.length > midCap) mid.length = midCap;
      farCap = growTo(farM, farCap, far.length); if (far.length > farCap) far.length = farCap;
      for (const w of near) w.tier = 1; for (const w of mid) w.tier = 2; for (const w of far) w.tier = 3;
      const tex = pedTex.image.data, adt = Math.min(dt, .1);
      for (let k = 0; k < nearCap; k++) { const w = near[k]; if (!w) { nearM.setVisibleAt(k, false); continue; }
        sim.animate(w, adt, G, w.aF !== frame - 1); w.aF = frame;   // (walk v2 gait + idles: pedsim.js animate; fresh when it just came near)
        nearM.setGeometryIdAt(k, nearIds[lk(w)]); Qn.setFromAxisAngle(Y, w.yawS ?? w.p[3]); V3.set(w.p[0], w.p[1], w.p[2]); if (w.tq) { Qn.multiply(w.tq); V3.y += w.lift || 0; } M4.compose(V3, Qn, S1); nearM.setMatrixAt(k, M4); nearM.setVisibleAt(k, true);   // (w.tq / w.lift: stage/ tilts a body: a stumble, a fall)
        writeGait2(tex, nearCap, k, w.g); }
      pedTex.needsUpdate = true;
      for (let k = 0; k < midCap; k++) { const w = mid[k]; if (!w) { midM.setVisibleAt(k, false); continue; }
        midM.setGeometryIdAt(k, midIds[lk(w)]); Qn.setFromAxisAngle(Y, w.yawS ?? w.p[3]); V3.set(w.p[0], w.p[1] + Math.abs(Math.cos(w.ph)) * .045 * Math.min(1, w.vc), w.p[2]); if (w.tq) { Qn.multiply(w.tq); V3.y += w.lift || 0; } M4.compose(V3, Qn, S1); midM.setMatrixAt(k, M4); midM.setVisibleAt(k, true); }
      let nd = 0; if (dogIds.length) for (const list of [near, mid]) for (const w of list) { if (w.dog < 0 || nd >= DOG_CAP) continue; sim.ahead(w, PED.dogLead, DP);
        const g = w.vc < .1 ? 2 : ((w.ph / Math.PI) | 0) & 1; Qn.setFromAxisAngle(Y, DP[3]); V3.set(DP[0], DP[1] + (g < 2 ? Math.abs(Math.sin(w.ph * 2)) * .02 : 0), DP[2]); M4.compose(V3, Qn, SC);
        dogM.setGeometryIdAt(nd, dogIds[(w.dog % 20) * 3 + g]); dogM.setMatrixAt(nd, M4); dogM.setVisibleAt(nd, true); nd++; }
      if (dogM) for (let k = nd; k < DOG_CAP; k++) dogM.setVisibleAt(k, false);
      for (let k = 0; k < far.length; k++) { const w = far[k], sz = sizeAt(w.dn); Qn.setFromAxisAngle(Y, w.yawS ?? w.p[3]); V3.set(w.p[0], w.p[1], w.p[2]); SF.set(sz, sz, sz); M4.compose(V3, Qn, SF);
        farM.setGeometryIdAt(k, farIds[lk(w)]); farM.setMatrixAt(k, M4); farM.setVisibleAt(k, true); }
      for (let k = far.length; k < farN; k++) farM.setVisibleAt(k, false); farN = far.length;
      // continuity (and when each walker was last seen: pedsim.js lets one leave only after PED.grace s unseen)
      const fresh = T.prev.length > 0; let vis = 0, mx = T.maxId;
      for (const list of [near, mid, far]) for (const w of list) { const on = onScreen(w, w.dn); if (on) { vis++; w.seenT = now; }
        if (fresh && on && w.drawnF !== frame - 1 && w.outF !== frame - 1 && (w.id > T.maxId || w.onF === frame - 1)) { T.spawn++; why(T.spawnWhy, w.id > T.maxId ? 'new' : 'shown'); note('spawn', w, w.dn); }
        w.drawnF = frame; if (on) w.onF = frame; if (w.id > mx) mx = w.id; }
      if (fresh) for (const w of T.prev) { if (w.drawnF === frame || w.onF !== frame - 1) continue; const d = Math.hypot(w.p[0] - cam.x, w.p[1] - cam.y, w.p[2] - cam.z);
        if (w.gone || onScreen(w, d)) { T.rem++; why(T.remWhy, w.gone ? 'left' : 'undrawn'); note(w.gone ? 'left' : 'undrawn', w, d); } }
      T.prev.length = 0; for (const list of [near, mid, far]) for (const w of list) T.prev.push(w); T.vis = vis; T.maxId = mx; T.frames++;
      const ms = performance.now() - T0; T.ms += (ms - T.ms) * .05; T.msMax = Math.max(T.msMax * .995, ms);   // (the whole update: sim step, tiers, batches, stats)
      return moving; },
    stats: () => ({ onScreenRemovals: T.rem, onScreenSpawns: T.spawn, removalWhy: { ...T.remWhy }, spawnWhy: { ...T.spawnWhy }, log: T.log.slice(), visible: T.vis, pool: sim.walkers.length, frames: T.frames,
      tiers: [near.length, mid.length, far.length], caps: [nearCap, midCap, farCap], updateMs: +T.ms.toFixed(3), updateMax: +T.msMax.toFixed(3),
      walkers: sim.walkers.length, agents: sim.agents.length, dontWalk: sim.stat.dontWalk, stepOffs: sim.stat.stepOffs, dogs: sim.walkers.filter(w => w.dog >= 0).length, want, edges: sim.edges.length, lanes: sim.lanes.size, deadEnds: sim.deadEnds, avoidMs: +sim.stat.avg.toFixed(3), avoidMax: +sim.stat.max.toFixed(3) }),
    density: (focus, radius) => sim.density(focus, radius),
  };
}
