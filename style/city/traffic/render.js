// TRAFFIC PASS (2026-09-28) · THE CARS, DRAWN (main thread). traffic/sim.js moves them; this draws them and keeps them continuous.
//   bodies   one InstancedMesh per model (vehicles/ registry when the cars agent's lands; until then placeholder bodies here), paint per
//            car (instanceColor) · wheels: one InstancedMesh of round wheels (a tyre, a hub and two spokes, so the turning reads), four per
//            car, spun by the distance travelled (angle = s / r) and the front pair steered into the path · lights: tail lamps (red,
//            bright while a car brakes or stands, lit at night) and head lamps (lit at night, with a pool of light on the road ahead)
//   tiers    near (< NEAR m): body, wheels, lamps · far: the body and, at night, the lamps · past the range: nothing (the last 15 % of
//            the range shrinks a car to nothing, as the walkers do)
//   batches  frustumCulled = false on every one: three r185 computes an instanced mesh's bounding sphere once and never refreshes it as
//            the instances move, so whole batches got culled (the walkers' bug of 2026-09-28). Fix round: the fleet is THREE BatchedMeshes
//            — every near body and brake plate, every wheel, every far body — any model in any slot (setGeometryIdAt), culled per car
//            (perObjectFrustumCulled): 3 draws (+ the bodies' shadow pass) where one InstancedMesh per model and part came to ~75
//   continuity  a car on screen is marked seen (sim.js lets it leave only after TRAFFIC.grace s unseen); arrivals only where the camera
//            can't see (seen() below); stats() counts cars appearing or vanishing on screen, like peds.js
import * as THREE from 'three';
import { createTrafficSim, TRAFFIC } from './sim.js';
import { CLOCK } from './rules.js';
import { P, distOf, kindAt } from '../plan.js';
import { paintedTexture } from '../canvastex.js';   // (black-ground fix: the night pools' canvas is repainted after a GPU-process reset)
import { tierize } from '../gpu.js';
import { installFade } from '../camera/fade.js';   // (CAMERA FADE 10-09b: a car near the camera or on its line to the person followed dissolves)
export { TRAFFIC };

const NEAR = 130, PAINT = [0xc8322e, 0x2c5aa8, 0xe8e4da, 0x1d1f24, 0x6f7b86, 0x2f7a4a, 0xd9b44a, 0x8a2f5c, 0x3a8fb0, 0xb86a2e, 0xf0efe8, 0x4b4f58];
// placeholder bodies (metres, nose +z, wheels on the ground): [name, length, width, height, wheel radius, wheelbase, paint (null: per car)]
const PLACEHOLDER = [['sedan', 4.4, 1.8, 1.45, .34, 2.6, null], ['hatch', 3.9, 1.75, 1.5, .32, 2.4, null], ['van', 4.9, 1.9, 1.95, .36, 3.0, null], ['taxi', 4.5, 1.8, 1.5, .34, 2.65, 0xffb400]];
function bodyGeo([name, L, W, H]) {   // a toon car: a body, a cabin with glass, bumpers, in vertex colours (white where the paint goes)
  const parts = [], box = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z), n = g.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color(c);
    for (let k = 0; k < n; k++) cc.toArray(col, k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); };
  const van = name === 'van', y0 = .3, hb = van ? H - y0 - .05 : .62, cab = van ? 0 : H - y0 - hb;
  box(W, hb, L - .1, 0, y0 + hb / 2, 0, 0xffffff);
  if (!van) { const cl = L * (name === 'hatch' ? .62 : .52), cz = name === 'hatch' ? -L * .12 : -L * .04; box(W * .9, cab, cl, 0, y0 + hb + cab / 2, cz, 0xffffff); box(W * .92, cab * .72, cl * .9, 0, y0 + hb + cab * .45, cz, 0x2a3440); }
  else { box(W * 1.01, .55, L * .22, 0, H - .5, L * .36, 0x2a3440); box(W * 1.01, .5, L * .5, 0, H - .55, -L * .1, 0x2a3440); }
  box(W * .96, .22, .16, 0, y0 + .12, L / 2 - .05, 0x22252b); box(W * .96, .22, .16, 0, y0 + .12, -L / 2 + .05, 0x22252b);   // bumpers
  box(W * 1.02, .18, L * .8, 0, y0 + .02, 0, 0x16181c);   // sills (the dark band the wheels sit in)
  if (name === 'taxi') { box(.7, .2, .3, 0, H + .1, -L * .04, 0xfff3c0); }
  const g = mergeGeos(parts); parts.forEach(p => p.dispose()); return g; }
function wheelGeo() {   // unit wheel (radius 1, width 1, axle along x): a tyre, a hub, two spokes across it (so a turn shows)
  const parts = [], col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let k = 0; k < n; k++) cc.toArray(a, k * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g); };
  col(new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2), 0x141518);
  col(new THREE.CylinderGeometry(.62, .62, 1.06, 12).rotateZ(Math.PI / 2), 0x9aa0a8);
  col(new THREE.BoxGeometry(1.1, 1.3, .2), 0xe8e8e2); col(new THREE.BoxGeometry(1.1, .2, 1.3), 0x4a4e56);
  const g = mergeGeos(parts); parts.forEach(p => p.dispose()); return g; }
function mergeGeos(list) { let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint32Array(ni); let o = 0, q = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); for (const i of g.index.array) I[q++] = i + o; o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(new THREE.BufferAttribute(I, 1)); return g; }
const lampGeo = (front) => { const g = mergeGeos([-1, 1].map(s => { const b = new THREE.BoxGeometry(.2, .16, .04).translate(s * .36, 0, front ? .5 : -.5), n = b.attributes.position.count; b.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); return b; })); return g; };

// the cars agent's fleet (vehicles/index.js VEHICLES + vehicles/three.js vehicleGeometries): per model and paint variant a body, its far
// body, its round wheel (centred on its axle, spun about x by distance / r at each spec.wheels position) and its brake plates, all tier
// geometry in cm (mats.tier at scale 0.01). The district mix picks the model where a car arrives (pickVehicle). Unreadable → the
// placeholders above, never an error.
const VARIANTS = 2;
async function loadRegistry(night) {
  try { const [I, T3] = await Promise.all([import('../vehicles/index.js'), import('../vehicles/three.js')]), out = [];
    for (const v of I.VEHICLES) { if (v.kind === 'copcar') continue;   // (cruisers are the sim-state's patrols. Fix round: the box truck and the bus drive too —
      // sim.js keeps a long body straight on and lets it turn only where the arc is wide enough for it, and keeps the bus to the avenues)
      for (let k = 0; k < Math.min(VARIANTS, v.variants || 1); k++) { const g = T3.vehicleGeometries(v.id, { variant: k, lights: night, night });
        out.push({ name: v.id, variant: k, L: v.dims.l, W: v.dims.w, wheelsAt: v.wheels, r: v.wheels[0]?.r || .35, geo: g.body, far: g.far, wheel: g.wheel, brake: g.brake, reg: true, wheels: true }); } }
    return out.length ? { models: out, I } : null; } catch (e) { console.warn('traffic: vehicles registry unavailable, placeholders', e); return null; } }

export async function createTraffic({ scene, night = false, R, peds = null, seed = 0x7aff1c, mats = null }) {
  const REG = mats?.tier ? await loadRegistry(night) : null, reg = !!REG;
  const MODELS = REG ? REG.models : PLACEHOLDER.map(p => ({ name: p[0], L: p[1], W: p[2], r: p[4], wb: p[5], track: p[2] - .32, geo: bodyGeo(p), paint: p[6], weight: p[0] === 'taxi' ? .5 : p[0] === 'van' ? .6 : 1, wheels: true }));
  const sim = createTrafficSim({ seed, night }), wsum = MODELS.reduce((s, m) => s + (m.weight || 1), 0), hashU = n => ((Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) % 100000) / 100000;
  // (no ambient buses: the city bus model stays in the registry — the vehicle lineup — but never drives; the buses are gone, 2026-10-09)
  sim.MODELS.pick = (x = 0, z = 0, ln = null) => { const n = sim.stat.spawns;   // (by spawn count: deterministic)
    if (REG) { const d = distOf(kindAt(Math.floor(x / P), Math.floor(z / P)));
      let id = REG.I.pickVehicle(d, hashU(n), x, z) || 'sedan'; if (id === 'bus') id = 'sedan';
      const vs = MODELS.filter(m => m.name === id), m = vs[(n >>> 3) % Math.max(1, vs.length)] || MODELS[0]; return MODELS.indexOf(m); }
    let u = hashU(n) * wsum; for (let k = 0; k < MODELS.length; k++) { u -= MODELS[k].weight; if (u <= 0) return k; } return 0; };
  sim.MODELS.size = k => { const m = k >= 0 ? MODELS[k] : { L: 4.6, W: 1.85, r: .35 }; return [m.L, m.W, m.r]; };
  if (peds?.sim) { sim.setWalkers({ crossings: peds.sim.crossings, inRoad: E => peds.sim.inRoad(E) }); peds.sim.setCars({ busy: k => sim.crossBusy(k) }); }
  // ── batches
  const CAP = 340, bodyMat = installFade(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .15 }), 'car'), wheelMat = installFade(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0 }), 'wheel');
  const prep = m => { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
  const bodies = reg ? [] : MODELS.map(M => { const m = prep(new THREE.InstancedMesh(M.geo, bodyMat, CAP)); m.castShadow = true; m.receiveShadow = true; m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); return m; });
  const wheels = reg ? null : prep(new THREE.InstancedMesh(wheelGeo(), wheelMat, CAP * 4)); if (wheels) wheels.castShadow = false;
  // the registry fleet: three BatchedMeshes of tier geometry (mats.tier, cm), a pool of hidden slots each, filled from the front per frame
  const wheelIx = MODELS.map(M => MODELS.findIndex(o => o.name === M.name));
  let BB = null, WB = null, FB = null, gBody = [], gBrake = [], gWheel = [], gFar = []; const NB = 760, NW = 1500, NF = 460, shown = { b: 0, w: 0, f: 0 };
  if (reg) { const size = gs => gs.reduce((a, g) => g ? [a[0] + g.attributes.position.count, a[1] + g.index.count] : a, [0, 0]);
    const fadeMat = kind => installFade(tierize(mats.tier.clone(), mats.tier._tierOpts || {}), kind), carMat = fadeMat('car'), wheelTier = fadeMat('wheel');   // (the near bodies and wheels: tier clones that fade; the far bodies keep mats.tier)
    const mk = (n, gs, cast, mat = mats.tier) => { const [v, i] = size(gs), m = new THREE.BatchedMesh(n, v, i, mat); Object.assign(m, { castShadow: cast, receiveShadow: true, sortObjects: false, perObjectFrustumCulled: true, frustumCulled: false });
      const ids = gs.map(g => g ? m.addGeometry(g) : -1); for (let k = 0; k < n; k++) { m.addInstance(ids.find(x => x >= 0)); m.setVisibleAt(k, false); } scene.add(m); return [m, ids]; };
    let ids; [BB, ids] = mk(NB, [...MODELS.map(M => M.geo), ...MODELS.map(M => M.brake)], true, carMat); gBody = ids.slice(0, MODELS.length); gBrake = ids.slice(MODELS.length);
    [WB, ids] = mk(NW, MODELS.map((M, k) => wheelIx[k] === k ? M.wheel : null), false, wheelTier); gWheel = MODELS.map((M, k) => ids[wheelIx[k]]);
    [FB, gFar] = mk(NF, MODELS.map(M => M.far), false); }
  const put = (m, k, g, M) => { m.setGeometryIdAt(k, g); m.setMatrixAt(k, M); m.setVisibleAt(k, true); };
  const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false, vertexColors: true }), tails = prep(new THREE.InstancedMesh(lampGeo(false), lampMat, CAP)), heads = prep(new THREE.InstancedMesh(lampGeo(true), lampMat, CAP));
  tails.setColorAt(0, new THREE.Color()); heads.setColorAt(0, new THREE.Color());
  let pools = null; if (night) { if (typeof document !== 'undefined') { const tex = paintedTexture(64, 128, g => { const gr = g.createRadialGradient(32, 10, 2, 32, 40, 80);
      gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(.45, 'rgba(255,225,170,0.35)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); });
      tex.colorSpace = THREE.SRGBColorSpace;
      pools = prep(new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6, 8).rotateX(-Math.PI / 2).translate(0, .03, 4.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(1.1, 1, .85) }), CAP)); pools.renderOrder = 2; } }
  // ── visibility
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), SP = new THREE.Sphere(); let cam = null, rng = 420, fogFar = 1e9, drawR2 = 0;
  const inView = (x, y, z, r) => { SP.center.set(x, y, z); SP.radius = r; return FR.intersectsSphere(SP); };
  const seen = (x, z, r = 3) => { const dx = x - cam.x, dz = z - cam.z, dy = 1 - cam.y; return dx * dx + dy * dy + dz * dz < drawR2 && inView(x, 1, z, r); };
  const sizeAt = d => d <= rng * .85 ? 1 : d >= rng ? 0 : (u => u * u * (3 - 2 * u))((rng - d) / (rng * .15));
  // ── per frame
  const M4 = new THREE.Matrix4(), W4 = new THREE.Matrix4(), Qn = new THREE.Quaternion(), Qs = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), CO = new THREE.Color();
  const T = { rem: 0, spawn: 0, prev: new Set(), cur: new Set(), frames: 0, ms: 0, msMax: 0, vis: 0, near: 0 }; let frame = 0, lastPop = -1e9, fx = 1e9, fz = 1e9, px = 1e9, pz = 1e9;
  function update(t, dt, camera, Rp, focusIn) { const t0 = performance.now(); R = Rp || R; frame++; cam = camera.position; const focus = focusIn || cam;
    camera.updateMatrixWorld(); PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM);
    fogFar = scene.fog ? scene.fog.far : 1e9; rng = Math.min(fogFar, 420); drawR2 = (rng * .97) ** 2;
    const jump = frame > 1 && (Math.hypot(cam.x - px, cam.z - pz) > 120 || Math.hypot(focus.x - fx, focus.z - fz) > 150);
    if (frame === 1 || jump || Math.hypot(focus.x - fx, focus.z - fz) > 12 || Math.hypot(cam.x - px, cam.z - pz) > 12 || t - lastPop > 2) {
      const rc = Math.sqrt(Math.max(0, (Math.min(rng, 240) + 30) ** 2 - Math.max(0, cam.y) ** 2)); sim.populate(focus, frame === 1 || jump, { seen, cam: [cam.x, cam.z, rc] }); fx = focus.x; fz = focus.z; lastPop = t; if (jump) T.prev.clear(); }
    T.jump = jump || frame === 1;   // (a go-to: the load-in hides it, the counts skip it — as the walkers' do)   // (the camera's disc: cars live out to 270 m of it)
    px = cam.x; pz = cam.z;
    sim.tick(dt);   // (MOVEMENT REVIEW #5 #6: the cars and the lights on the movement clock, stepped; the signal clock moves with them — sim.js tick)
    // draw
    const counts = bodies.map(() => 0); let nw = 0, nl = 0, np = 0, vis = 0, near = 0, nb = 0, nwh = 0, nf = 0; T.cur.clear();
    for (const c of sim.cars) { if (c.kind === 'patrol') continue; const d = Math.hypot(c.x - cam.x, 1 - cam.y, c.z - cam.z); if (d >= rng) continue; const sz = sizeAt(d), M = MODELS[c.model] || MODELS[0], bm = bodies[c.model] || bodies[0], k = counts[c.model] ?? 0;
      const isNear = d < NEAR * (c.nearT ? 1.1 : 1); c.nearT = isNear;
      if (reg) { const mi = c.model | 0, sc = sz * .01; Qn.setFromAxisAngle(Y, c.h); V3.set(c.x, 0, c.z); S3.set(sc, sc, sc); M4.compose(V3, Qn, S3);   // (tier geometry is in cm)
        if (isNear) { if (nb >= NB - 1 || nwh + M.wheelsAt.length > NW) continue; put(BB, nb++, gBody[mi], M4); if (c.brake && gBrake[mi] >= 0) put(BB, nb++, gBrake[mi], M4); near++;
          for (const w of M.wheelsAt) { const front = w.z > 0; Qs.setFromAxisAngle(Y, c.h + (front ? c.steer : 0)); V3.set(w.x * sz, w.y * sz, w.z * sz).applyQuaternion(Qn); V3.x += c.x; V3.z += c.z;
            W4.makeRotationX(c.spin * (M.r / w.r)); M4.compose(V3, Qs, S3).multiply(W4); put(WB, nwh++, gWheel[mi], M4); } }
        else { if (nf >= NF) continue; put(FB, nf++, gFar[mi], M4); }
        const on = sz >= .25 && d < fogFar && inView(c.x, 1, c.z, 2.6); if (on) { c.seenT = sim.t; vis++; T.cur.add(c.id); if (!T.prev.has(c.id) && T.frames > 0 && !T.jump && c.born > sim.t - .05) T.spawn++; }
        if (pools && d < 160) { S3.set(sz, sz, sz); V3.set(c.x, 0, c.z); M4.compose(V3, Qn, S3); pools.setMatrixAt(np++, M4); }
        continue; }
      if (k >= CAP) continue; counts[c.model] = k + 1; Qn.setFromAxisAngle(Y, c.h); V3.set(c.x, 0, c.z); S3.set(sz, sz, sz); M4.compose(V3, Qn, S3); bm.setMatrixAt(k, M4);
      bm.setColorAt(k, CO.setHex(M.paint ?? PAINT[(c.id * 7 + (c.id >> 3)) % PAINT.length], THREE.SRGBColorSpace));
      const on = sz >= .25 && d < fogFar && inView(c.x, 1, c.z, 2.6); if (on) { c.seenT = sim.t; vis++; T.cur.add(c.id); if (!T.prev.has(c.id) && T.frames > 0 && !T.jump && c.born > sim.t - .05) T.spawn++; }
      if (isNear && M.wheels && nw + 4 <= CAP * 4) { near++; const hw = M.track / 2, hb = M.wb / 2, r = M.r * sz;
        for (let w = 0; w < 4; w++) { const front = w < 2, sx = w & 1 ? 1 : -1; Qs.setFromAxisAngle(Y, c.h + (front ? c.steer : 0)); W4.makeRotationX(c.spin);
          V3.set(sx * hw * sz, r, (front ? hb : -hb) * sz).applyQuaternion(Qn); V3.x += c.x; V3.z += c.z; S3.set(.22 * sz, r, r); M4.compose(V3, Qs, S3).multiply(W4); wheels.setMatrixAt(nw++, M4); } }
      if (isNear || night) { S3.set(M.W * sz, sz, M.L * sz); V3.set(c.x, .78 * sz, c.z); M4.compose(V3, Qn, S3); tails.setMatrixAt(nl, M4); heads.setMatrixAt(nl, M4);
        const b = c.brake; tails.setColorAt(nl, CO.setRGB(b ? 3.2 : night ? 1.1 : .32, b ? .12 : night ? .05 : .03, b ? .08 : night ? .04 : .03)); heads.setColorAt(nl, night ? CO.setRGB(3, 2.8, 2.3) : CO.setRGB(.75, .75, .72)); nl++;
        if (pools && d < 160) { S3.set(sz, sz, sz); V3.set(c.x, 0, c.z); M4.compose(V3, Qn, S3); pools.setMatrixAt(np++, M4); } } }
    // continuity: a car drawn on screen last frame that isn't now although it still would be (or left the sim)
    if (T.frames > 0) for (const id of T.prev) if (!T.cur.has(id)) { const c = sim.cars.find(q => q.id === id); if (!c) { T.rem++; continue; } const d = Math.hypot(c.x - cam.x, 1 - cam.y, c.z - cam.z); if (d < rng * .85 && inView(c.x, 1, c.z, 2.6) && c.kind !== 'patrol') T.rem++; }
    { const s = T.prev; T.prev = T.cur; T.cur = s; }
    const fin = (m, n) => { if (!m) return; m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    bodies.forEach((m, k) => fin(m, counts[k])); if (!reg) fin(wheels, nw);
    else for (const [m, n, key] of [[BB, nb, 'b'], [WB, nwh, 'w'], [FB, nf, 'f']]) { for (let k = n; k < shown[key]; k++) m.setVisibleAt(k, false); shown[key] = n; m.visible = n > 0; }
    for (const m of [tails, heads]) fin(m, reg ? 0 : nl);
    if (pools) fin(pools, np);
    T.vis = vis; T.near = near; T.frames++; const ms = performance.now() - t0; T.ms += (ms - T.ms) * .05; T.msMax = Math.max(T.msMax * .995, ms);
    return vis; }
  return { sim, update, MODELS, registry: reg, batches: reg ? { bodies: [BB], fars: [FB], wheels: [WB], tails, heads, pools, shown } : { bodies, wheels: [wheels], tails, heads, pools },
    stats: () => ({ cars: sim.cars.length, want: sim.want, visible: T.vis, near: T.near, onScreenSpawns: T.spawn, onScreenRemovals: T.rem, updateMs: +T.ms.toFixed(3), updateMax: +T.msMax.toFixed(3), stepMs: +sim.stat.avg.toFixed(3),
      redRuns: sim.stat.redRuns, walkEntries: sim.stat.walkEntries, intoWalkers: sim.stat.intoWalkers, overlaps: sim.stat.overlaps, entered: sim.stat.entered, turned: sim.stat.turned, registry: !!reg, clock: +CLOCK.t.toFixed(2) }) };
}
