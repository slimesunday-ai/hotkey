// AI City · INTERIOR VIEW ART PASS (2026-10-06) · the Mainland house view dressed as a game's home view (research and sources:
// style/research/interior-view-2026-10-06.md). mainland.js owns the room, the builder and the resident; this module owns everything round
// them, on the view's own renderer, scene and camera:
//   CONTEXT  the house's REAL lot from the Mainland's lot builder (mainland/houses.js buildLot, imported read-only, the same spec main.js
//            builds for that plot, the owner's saved lot included), with the house clipped out where the cutaway room stands (walls and
//            roof cut away, Sims-style); the real ground round it (mainland/ground.js buildGround: lawn stripes, walk, curb, street) and the
//            nearest neighbours' lots, faded by the fog and the depth of field. Built after the room shows, one step per idle tick.
//            (FOLLOW-UP 2026-10-06) Nothing of a neighbour's lot stands inside the room's footprint: a house kit wider than its wedge lot
//            hides the neighbour's side fence in its walls on the Mainland; with the walls cut away the fence ran through the gambrel's
//            garage and cut the resident off at the chest (it read as a floating head on the wall).
//   LAWN     the Mainland's painted lawn (mainland/lawn.js, grass.js), reused: the workers' ground tiles already paint their lawn texels,
//            each lot job paints its own patch (the same spec.lawn and care as main.js: lawn.js lotLawnSpec), and the view stamps them
//            into two maps over just its own rect (0.1 m round the house, 0.2 m out to the haze). The ground reads them through
//            grass.js's lawn material and grows grass.js's tufts near the camera, both at Mainland coordinates inside the group that
//            turns the neighbourhood round the house; no tufts under the room or the house.
//   LIGHT    the city's light (render/lighting.js polished values): a warm key and a cool hemisphere fill, the sky dome (render/sky.js)
//            with its environment, a soft PCF shadow map over the lot, contact blobs under every floor piece, the car and the resident,
//            daylight pools under the windows, and at night the lamps' own small lights with warm pools under them.
//   POST     the city's post stack (render/post.js) with the viewer default look (render/looks.js DEFAULT_LOOK, Camcorder '98); ?preset=
//            picks another look (post-only looks keep this light). Visit mode adds a gentle depth of field (render/dof.js) focused on the
//            orbit target, so the street and the neighbours go soft at the edges.
//   CAMERA   a lower three-quarter framing, an orbit clamped in pitch, yaw, distance and pan.
//   createStage({ renderer, scene, camera, controls, night, plotId, houseSpec, MATS, geoOf, root }) → stage
//     stage.setRoom(cur)    after each room build: contacts, pools, lamps, the house's place on its lot (the first call starts the context)
//     stage.frame(cur)      the default framing · stage.tick(dt, life, editing) per frame · stage.render(t) draws (post) · dispose()
//     stage.ready           resolves when the context has built (shots) · stage.stats() what was built and its cost
import * as THREE from 'three';
import { PAL } from '../../style.js';
import { TOD } from '../../kit.js';
import { createSky } from '../../render/sky.js';
import { paintedTexture } from '../../canvastex.js';
import { Bank, unpackInto, stampA } from '../../vox.js';
import { createSprinklers } from '../../mainland/sprinklers.js';   // (MAINLAND FIXES 2026-10-06: the lot's sprinklers run here too)

const LIFT = .3;   // the lawn under the room's floor (lot y 0 = scene y −LIFT): the foundation shows this much
const rad = THREE.MathUtils.degToRad, idle = () => new Promise(r => (globalThis.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 16)));
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// soft decal textures (white, used as alpha): a round blob and a soft-edged rectangle
const blobTex = () => { const t = paintedTexture(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }); t.colorSpace = THREE.NoColorSpace; return t; };
const rectTex = () => { const t = paintedTexture(64, 64, g => { const d = g.createImageData(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const e = k => Math.min(1, Math.max(0, (Math.min(k, 63 - k) - 2) / 14)), a = e(x) * e(y) * (1 - y / 90); d.data.set([255, 255, 255, Math.round(a * 255)], (y * 64 + x) * 4); } g.putImageData(d, 0, 0); }); t.colorSpace = THREE.NoColorSpace; return t; };

// the Mainland's own build workers (mainland/worker.js + its job graph, read-only): the lots and the ground build off the main thread, so the
// view opens at once and never hitches while its context fills in. The source bundle is fetched once per page; workers live per open.
let bundleP = null;
async function mainlandPool(PLAN, night, n) {
  const ENTRY = new URL('../../mainland/jobs.js', import.meta.url).href;
  bundleP ??= import('../../pool.js').then(m => m.bundleOf(ENTRY)).then(r => r.bundle).catch(e => { bundleP = null; throw e; });
  const bundle = await bundleP, ws = [], free = [], jobs = [], pend = new Map(); let seq = 0, dead = null;
  const pump = () => { while (free.length && jobs.length) { const w = free.pop(), j = jobs.shift(); pend.set(j.id, j); w.postMessage({ id: j.id, task: j.task, arg: j.arg }); } };
  const fail = e => { dead = e; for (const j of [...pend.values(), ...jobs.splice(0)]) j.rej(e); pend.clear(); };
  for (let k = 0; k < n; k++) { const w = new Worker(new URL('../../mainland/worker.js', import.meta.url), { type: 'module' });
    w.onmessage = e => { const d = e.data; if (d.ready) { free.push(w); pump(); return; } const j = pend.get(d.id); if (!j) { if (d.err) fail(new Error(d.err)); return; }
      pend.delete(d.id); free.push(w); pump(); d.err ? j.rej(new Error(d.err)) : j.res(d); };
    w.onerror = e => fail(new Error('worker: ' + (e.message || e.type))); w.postMessage({ init: PLAN, night: !!night, bundle, entry: ENTRY }); ws.push(w); }
  return { run: (task, arg) => dead ? Promise.reject(dead) : new Promise((res, rej) => { jobs.push({ id: ++seq, task, arg, res, rej }); pump(); }), close: () => ws.forEach(w => w.terminate()) };
}
const unpack = r => { const b = new Bank(true); unpackInto(r.P, b); return b; };
const LAWNBASE = 0x55ad45;   // (ground.js's lawn voxel colour: an unpainted texel reads as the old flat lawn, never black)

// drop every triangle whose centroid a test rejects (the house cut out of its lot): indices only, the vertices stay
function clipBank(bank, cut) { let n = 0; for (const O of bank.L) { if (!O.v) continue; const P = O.P.a, I = O.I.a; let w = 0;
  for (let k = 0; k < O.I.n; k += 3) { const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3, x = (P[a] + P[b] + P[c]) / 3, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    if (cut(x, y, z)) { n++; continue; } I[w] = I[k]; I[w + 1] = I[k + 1]; I[w + 2] = I[k + 2]; w += 3; } O.I.n = w; } return n; }

export function createStage({ renderer, scene, camera, controls, night, plotId, houseSpec = {}, MATS, geoOf }) {
  const T0 = performance.now(), stats = { lot: null, neighbours: 0, ground: 0, ms: {} };
  // ── light: the sky dome and fog, a warm key with soft shadows, a cool fill
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMappingExposure = night ? 1.3 : 1;
  const sky = createSky({ scene }); sky.mesh.scale.setScalar(.2);   // (r 360 m: inside the view's far plane)
  const TOP = night ? PAL.nightTop : PAL.sky, HOR = night ? PAL.nightHor : PAL.horizon;
  sky.U.top.value.setHex(TOP); sky.U.hor.value.setHex(HOR); sky.U.gnd.value.setHex(HOR); scene.background = new THREE.Color(HOR);
  scene.fog = new THREE.Fog(HOR, night ? 26 : 34, night ? 95 : 130);
  let pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(sky.envScene, .02); scene.environment = env.texture; scene.environmentIntensity = night ? .16 : .38; pm.dispose(); pm = null;
  const SUN = new THREE.Vector3(-.52, .76, .4).normalize();   // from the front left, high: the shadow sides face the camera's right
  const sun = new THREE.DirectionalLight(night ? 0x8fa4ff : 0xffe0b0, night ? .55 : 3.1); sun.position.copy(SUN).multiplyScalar(40); sun.castShadow = true;
  Object.assign(sun.shadow, { bias: -.0004, normalBias: .025, radius: night ? 2 : 3.5, blurSamples: 12 }); sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 5, far: 90 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(night ? 0x4050a0 : 0xa9b8ff, night ? 0x201830 : 0xd9b89c, night ? .6 : 1.05); scene.add(hemi);
  // a placeholder lawn while the real ground builds (the Mainland's mown green), under everything
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: night ? 0x274d2c : 0x62b84a, roughness: 1 }));
  lawn.position.y = -LIFT - .01; lawn.receiveShadow = true; scene.add(lawn);

  // ── contact shadows (one instanced blob: the floor pieces, the car, the resident) and light pools (window daylight, lamp pools)
  const BLOB = blobTex(), RECT = rectTex(), PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M4 = new THREE.Matrix4(), QY = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const cMat = new THREE.MeshBasicMaterial({ color: night ? 0x0c0a1c : 0x1d1838, alphaMap: BLOB, transparent: true, opacity: night ? .5 : .46, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const contacts = new THREE.InstancedMesh(PLANE, cMat, 256); contacts.count = 0; contacts.frustumCulled = false; contacts.renderOrder = 1; scene.add(contacts);
  const pMat = (map, col, op) => new THREE.MeshBasicMaterial({ color: col, alphaMap: map, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  const winPools = new THREE.InstancedMesh(PLANE, pMat(RECT, 0xfff1d6, night ? 0 : .2), 32), lampPools = new THREE.InstancedMesh(PLANE, pMat(BLOB, 0xffb066, .42), 16);
  for (const m of [winPools, lampPools]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 2; scene.add(m); }
  const lamps = [], WARM = new THREE.Color(1, 1, 1), SOFT = new THREE.Color(.75, .8, .85), COOL = new THREE.Color(.55, .75, 1.3); let resIdx = -1, roomCur = null;
  const put = (mesh, k, x, y, z, sx, sz, ang = 0) => { QY.setFromAxisAngle(Y, ang); mesh.setMatrixAt(k, M4.compose(V3.set(x, y, z), QY, S3.set(sx, 1, sz))); };
  function setRoom(cur) {
    roomCur = cur; const o = cur.g.position, res = cur.res; let n = 0;
    for (const p of res.pieces ?? []) { const [x0, y0, z0, x1, y1, z1] = p.box; if (y0 > .06 || y1 - y0 < .2 || /^rug|^door|mat$/.test(p.id) || n >= 240) continue;
      put(contacts, n++, o.x + (x0 + x1) / 2, .012, o.z + (z0 + z1) / 2, (x1 - x0) * 1.22 + .18, (z1 - z0) * 1.22 + .18); }
    for (const b of cur.A.room.built ?? []) if (b.kind === 'car' && cur.S.car) { const C4 = .25, x0 = (res.ox ?? 0) + b.x * C4, z0 = b.z * C4; put(contacts, n++, o.x + x0 + b.w * C4 / 2, .03, o.z + z0 + b.d * C4 / 2 + .1, b.w * C4 * .78, b.d * C4 * .95); }
    resIdx = n; put(contacts, n++, 0, -50, 0, .01, .01); contacts.count = n; contacts.instanceMatrix.needsUpdate = true;
    // windows: a soft patch of daylight on the floor inside each (skewed away from the wall), the bathroom's frosted one fainter
    let w = 0; for (const win of res.art?.windows ?? []) { const len = win.a1 - win.a0, k = win.kind === 'bath' || win.kind === 'garage' ? .6 : 1;
      if (win.side === 'N') put(winPools, w++, o.x + (win.a0 + win.a1) / 2, .02, o.z + .95 * k, len + .5, 1.7 * k);
      else if (win.side === 'E') put(winPools, w++, o.x + res.W - .95 * k, .02, o.z + (win.a0 + win.a1) / 2, 1.7 * k, len + .5);
      else put(winPools, w++, o.x + .95 * k, .02, o.z + (win.a0 + win.a1) / 2, 1.7 * k, len + .5); }
    winPools.count = night ? 0 : w; winPools.instanceMatrix.needsUpdate = true;
    // lamps: at night each lit lamp gets a small warm light (no shadow) and a pool on the floor under it
    for (const l of lamps.splice(0)) { scene.remove(l); l.dispose?.(); } let L = 0;
    if (night) for (const p of res.pieces ?? []) { if (!/lamp|chandelier|ceiling-fan|neon/.test(p.id) || L >= 6) continue; const [x0, y0, z0, x1, y1, z1] = p.box, cx = o.x + (x0 + x1) / 2, cz = o.z + (z0 + z1) / 2;
      const arc = p.id === 'lamp-arc', hx = arc ? o.x + x0 + (x1 - x0) * .82 : cx, hy = p.id === 'ceiling-fan' ? y0 - .1 : y1 - .12;
      const pl = new THREE.PointLight(p.id === 'lava-lamp' ? 0xff5fa8 : 0xffc488, p.id === 'ceiling-fan' ? 9 : 6, 5.5, 1.6); pl.position.set(hx, hy, cz); scene.add(pl); lamps.push(pl);
      lampPools.setColorAt(L, WARM); put(lampPools, L++, hx, .025, cz, 3.2, 3.2); }
    // and a ceiling light in every room that has no lamp of its own (the garage's a cool tube), so the whole house reads lived in
    if (night) for (const g of res.art?.segs ?? []) { if (L >= 9) break; const lit = (res.pieces ?? []).some(p => /lamp|chandelier|ceiling-fan|neon/.test(p.id) && (p.box[0] + p.box[3]) / 2 > g.x0 && (p.box[0] + p.box[3]) / 2 < g.x1); if (lit) continue;
      const gar = g.kind === 'garage', x = o.x + (g.x0 + g.x1) / 2, z = o.z + res.D * .42, pl = new THREE.PointLight(gar ? 0xdfe9ff : 0xffd2a0, gar ? 7 : 4.5, 5.5, 1.6); pl.position.set(x, res.H - .3, z); scene.add(pl); lamps.push(pl);
      lampPools.setColorAt(L, gar ? COOL : SOFT); put(lampPools, L++, x, .025, z, gar ? 3.8 : 3, gar ? 3.8 : 3); }
    lampPools.count = L; lampPools.instanceMatrix.needsUpdate = true; if (lampPools.instanceColor) lampPools.instanceColor.needsUpdate = true;
    if (!ctxP) ctxP = buildContext(cur).catch(e => { console.error('interior view: the lot did not build', e); });
  }

  // ── the context: the plot's real lot (house clipped), the ground round it, the neighbours
  const lotG = new THREE.Group(); lotG.name = 'lot'; scene.add(lotG); const worldG = new THREE.Group(); worldG.name = 'neighbourhood'; worldG.matrixAutoUpdate = false; scene.add(worldG);
  let ctxP = null, closed = false, place = null, pool = null, tufts = null, lawnInv = null;
  const SPRK = createSprinklers({ night }); worldG.add(SPRK.mesh);   // (Mainland world coordinates, like the neighbours: the own lot's and theirs, one draw)
  const wSpr = (R, list) => (list ?? []).map(([x, z, reach]) => { const c = Math.cos(R.rot), s = Math.sin(R.rot), wx = R.x + x * c + z * s, wz = R.z - x * s + z * c; return [wx, .5, wz, reach, (Math.abs(Math.sin(wx * 12.9898 + wz * 78.233)) * 43758.5453) % 1]; });
  const stamped = (lb, r) => { const b = new Bank(true); stampA(lb, b, r.rot, r.x, .2, r.z); return b; };   // (the main-thread fallback: what the worker's 'lot' job returns)
  // the neighbours and the far ground lean toward the horizon colour (aerial perspective: the house's own lot stays crisp and saturated)
  const FAR = MATS.map((m, li) => { if (li === 3) return m; const k = m.clone(); k.color.setScalar(night ? .8 : .7); k.emissive.setHex(HOR).multiplyScalar(night ? .05 : .26); return k; }), lawnMats = [];
  const addBank = (bank, to, cast, recv = true, mats = MATS) => bank.L.forEach((O, li) => { if (!O.v || !O.I.n) return; const m = new THREE.Mesh(geoOf(O), mats[li]); m.castShadow = cast && li !== 3; m.receiveShadow = recv; to.add(m); });
  async function buildContext(cur) {
    const t0 = performance.now(), [H, Yd, G, MSV, PLAN, LW, GR] = await Promise.all([import('../../mainland/houses.js'), import('../../mainland/yard.js'), import('../../mainland/ground.js'), import('../../mainland/saved.js'),
      fetch(new URL('../../mainland/plots.json', import.meta.url)).then(r => r.json()), import('../../mainland/lawn.js'), import('../../mainland/grass.js')]); if (closed) return;
    stats.ms.load = Math.round(performance.now() - t0);
    // the lot specs exactly as mainland/main.js builds them (its lotJobs: the order of the built plots sets the seeds, glass garages and cars)
    const toL = (R, x, z) => { const dx = x - R.x, dz = z - R.z, c = Math.cos(R.rot), s = Math.sin(R.rot); return [dx * c - dz * s, dx * s + dz * c]; };
    const polyOf = P => { const L = P.corners.map(([x, z]) => toL(P.rect, x, z)), fr = [...L].sort((a, b) => b[1] - a[1]), F = fr.slice(0, 2).sort((a, b) => a[0] - b[0]), Bk = fr.slice(2).sort((a, b) => a[0] - b[0]); return [F[0], F[1], Bk[1], Bk[0]]; };
    const SHOWCARS = [{ id: 'supercar', v: 1 }, { id: 'lowrider', v: 3 }, { id: 'livery', v: 2 }, { id: 'supercar', v: 5 }, { id: 'lowrider', v: 0 }, { id: 'supercar', v: 3 }, { id: 'livery', v: 0 }];
    const DAILY = [{ id: 'sedan', v: 7 }, { id: 'pickup', v: 1 }, { id: 'sedan', v: 1 }, { id: 'beater', v: 2 }, { id: 'sedan', v: 3 }, { id: 'pickup', v: 4 }, { id: 'sedan', v: 8 }, { id: 'beater', v: 4 }];
    const specs = new Map(); let sc = 0, dc = 0; const springs = [];
    PLAN.plots.filter(p => p.status === 'built').forEach((P, k) => { const glass = P.style === 'slab' || P.style === 'butterfly' || P.style === 'gambrel' || (P.style === 'springfield' && springs.push(P) % 2 === 1);
      const spec = { style: P.style, seed: 17 + k * 31, W: P.rect.w, D: P.rect.d, poly: polyOf(P), wall: PLAN.walls[P.wall], glass, car: glass ? SHOWCARS[sc++ % SHOWCARS.length] : DAILY[dc++ % DAILY.length], car2: (P.style === 'slab' || P.style === 'butterfly') ? DAILY[dc++ % DAILY.length] : null };
      if (P.style === 'trophy') spec.car = { id: 'supercar', v: 2 }; if (P.head && P.street === 'willow-loop') spec.statue = [-P.rect.w / 2 + 3.2, -3.6]; specs.set(P.id, { P, spec }); });
    for (const id of MSV.ids()) { const r = MSV.load(id), P = PLAN.plots.find(p => p.id === id); if (!r || !P) continue; const j = specs.get(id); if (j) j.spec = { ...j.spec, custom: r.lot }; else specs.set(id, { P, spec: { style: r.lot.house.style, seed: 1, W: P.rect.w, D: P.rect.d, poly: polyOf(P), custom: r.lot } }); }
    // which plot: this one; a stand-in of the same style for a plot the plan doesn't know (the test page's test-<style>)
    const style = houseSpec.style ?? 'springfield', mine = specs.get(plotId) ?? [...specs.values()].find(j => j.P.status === 'built' && j.P.style === style && !j.spec.custom) ?? [...specs.values()][0];
    const P = mine.P, R = P.rect, spec = { ...mine.spec }; if (spec.custom && spec.custom.house && spec.custom.house.style !== style) spec.custom = null;
    if (!spec.custom && spec.style !== style) Object.assign(spec, { style, glass: ['slab', 'butterfly', 'gambrel'].includes(style) });
    spec.lawn = LW.lotLawnSpec(P, !!spec.custom);   // (its lawn patch, painted in its own lot job as main.js asks for it)
    // the house in its lot frame: its footprint (house kit rects) and where the room stands (centred on the walls it replaces, front to the house's front)
    const Hh = spec.custom?.house ?? { ...Yd.defaultHouse(style, { glass: spec.glass }), hx: H.STYLE[style].dx, hz: 0 }, rects = Yd.houseRects(Hh);
    const side = (style === 'trophy' || style === 'ranch') && rects.length > 1 ? [rects[1]] : [], body = rects.filter(r => !side.includes(r));
    const bx0 = Math.min(...body.map(r => r[0])), bx1 = Math.max(...body.map(r => r[2])), W = cur.res.W, D = cur.res.D, front = H.STYLE[style].front + (Hh.hz ?? 0);
    const cx = (bx0 + bx1) / 2, cz = front - D / 2, back = front - D; place = { P, R, cx, cz, spec, style };
    lotG.position.set(-cx, -LIFT, -cz);
    worldG.matrix.copy(new THREE.Matrix4().makeTranslation(-cx, -LIFT - .2, -cz).multiply(new THREE.Matrix4().makeRotationY(-R.rot)).multiply(new THREE.Matrix4().makeTranslation(-R.x, 0, -R.z))); worldG.matrixWorldNeedsUpdate = true;
    // the own lot, with the house cut away where the room stands: its walls and roof over the body rects (to a little behind the room),
    // anything high round them (eaves, the hoop's board), a side structure's roof (the ranch's carport), and in front of the room a porch
    // or portico cut down to 1.15 m like the walls; the paths, the beds along the front, the steps and the yard stay.
    // Off the main thread (the Mainland's workers); on the main thread only if they can't start.
    const PL = await mainlandPool(PLAN, night, 3).catch(e => { console.warn('interior view: no build workers, building on the main thread', e); return null; }); if (closed) { PL?.close(); return; } pool = PL;
    const nightWas = TOD.night, local = (fn) => { TOD.night = !!night; try { return fn(); } finally { TOD.night = nightWas; } };
    const job = (task, arg, fallback) => PL ? PL.run(task, arg).then(r => ({ bank: unpack(r), extra: r.extra })).catch(e => { console.warn('interior view: worker job failed, main thread', task, e); return local(fallback); }) : idle().then(() => local(fallback));   // → { bank, extra }
    const t1 = performance.now(), lotP = job('lot', { spec, x: 0, z: 0, rot: 0 }, () => { const r = H.buildLot(spec); return { bank: stamped(r.bank, { rot: 0, x: 0, z: 0 }), extra: r.A }; });
    const [wx, wz] = [R.x + cx * Math.cos(R.rot) + cz * Math.sin(R.rot), R.z - cx * Math.sin(R.rot) + cz * Math.cos(R.rot)], N = 24, F = 84;
    const fine = { x0: Math.round(wx - N), z0: Math.round(wz - N), x1: Math.round(wx + N), z1: Math.round(wz + N), s: .1, skip: null };
    const tiles = [fine, { x0: fine.x0 - F + N, z0: fine.z0 - F + N, x1: fine.x1 + F - N, z1: fine.z1 + F - N, s: .2, skip: [fine.x0, fine.z0, fine.x1, fine.z1] }];
    const near = [...specs.values()].filter(j => j.P.id !== P.id).map(j => [j, Math.hypot(j.P.rect.x - R.x, j.P.rect.z - R.z)]).filter(([, d]) => d < 46).sort((a, b) => a[1] - b[1]).slice(0, +(Q.get('neighbours') ?? 4));
    const fm = style === 'slab' || style === 'butterfly' ? 0 : .5, inR = (r, x, z, m = 0) => x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + Math.min(m, fm);   // (the modernists' footprint ends at their glass front: the yard's sculpture just past it stays whole)
    const ROOM = [cx - W / 2, back, cx + W / 2, front], inRoom = (x, z, m = .1) => x > ROOM[0] - m && x < ROOM[2] + m && z > ROOM[1] - m && z < ROOM[3] + m;   // (the room's footprint, lot frame)
    // ── THE LAWN: the two maps over the view's own tiles (lawn.js's painters, grass.js's material and tufts), filled as the jobs land
    const LG = {}, LT = {}, LM = {}; tiles.forEach((t, i) => { const k = i ? 'coarse' : 'fine', g = LG[k] = { x0: t.x0, z0: t.z0, x1: t.x1, z1: t.z1, s: t.s }; g.nx = Math.round((g.x1 - g.x0) / g.s); g.nz = Math.round((g.z1 - g.z0) / g.s);
      const T = LT[k] = new Uint8Array(g.nx * g.nz * 4); for (let o = 0; o < T.length; o += 4) { T[o] = LAWNBASE >> 16; T[o + 1] = (LAWNBASE >> 8) & 255; T[o + 2] = LAWNBASE & 255; } LM[k] = null; });
    const LTX = GR.lawnTextures(THREE, renderer, LT, LG), GMAT = [GR.lawnMaterial(THREE, MATS[0], LTX, { grids: LG, local: true }).mat, GR.lawnMaterial(THREE, FAR[0], LTX, { grids: LG, local: true }).mat];
    lawnMats.push(...GMAT); tufts = GR.createTufts(THREE, { tex: LTX, night, grids: LG }); tufts.mesh.name = 'lawn-tufts'; worldG.add(tufts.mesh);
    const patches = [], toLot = (x, z) => toL(R, x, z);
    // a lot's patch (lawn.js lotLawn: GRIDS indices) into both maps, where the ground's tile says a lot's lawn lies (main.js stampLawn)
    const stampPatch = p => { const g = LW.GRIDS[p.g], px0 = g.x0 + p.i0 * g.s, pz0 = g.z0 + p.k0 * g.s;
      for (const k of ['fine', 'coarse']) { const L = LG[k], T = LT[k], M = LM[k]; if (!M) continue;
        const a0 = Math.max(0, Math.floor((px0 - L.x0) / L.s)), a1 = Math.min(L.nx - 1, Math.floor((px0 + p.nx * g.s - L.x0) / L.s)), b0 = Math.max(0, Math.floor((pz0 - L.z0) / L.s)), b1 = Math.min(L.nz - 1, Math.floor((pz0 + p.nz * g.s - L.z0) / L.s));
        for (let b = b0; b <= b1; b++) { const kk = Math.floor((L.z0 + (b + .5) * L.s - pz0) / g.s + 1e-6); if (kk < 0 || kk >= p.nz) continue;
          for (let a = a0; a <= a1; a++) { const ii = Math.floor((L.x0 + (a + .5) * L.s - px0) / g.s + 1e-6); if (ii < 0 || ii >= p.nx) continue; const n = kk * p.nx + ii, w = b * L.nx + a; if (!p.mask[n] || !M[w]) continue;
            const s4 = n * 4, d4 = w * 4; T[d4] = p.tex[s4]; T[d4 + 1] = p.tex[s4 + 1]; T[d4 + 2] = p.tex[s4 + 2]; T[d4 + 3] = p.tex[s4 + 3]; } } } };
    // no tufts under the room or the house (the room's floor stands 0.3 m over the lawn; a cut-down house leaves its floor)
    const bare = (x, z) => inRoom(x, z, .25) || body.some(r => inR(r, x, z, .1)) || side.some(r => inR(r, x, z, .1));
    const clearUnder = () => { const L = LG.fine, T = LT.fine; for (let b = 0; b < L.nz; b++) { const z = L.z0 + (b + .5) * L.s; for (let a = 0; a < L.nx; a++) { const [x, zz] = toLot(L.x0 + (a + .5) * L.s, z); if (bare(x, zz)) T[(b * L.nx + a) * 4 + 3] = 0; } } };
    let lawnDirty = false; const relawn = () => { lawnDirty = true; idle().then(() => { if (!lawnDirty || closed) return; lawnDirty = false; for (const p of patches) stampPatch(p); clearUnder(); LTX.fine.needsUpdate = LTX.coarse.needsUpdate = true; }); };
    const addPatch = p => { if (!p?.tex) return; patches.push(p); relawn(); };
    lawnInv = new THREE.Matrix4();
    const own = lotP.then(({ bank: lb, extra }) => { if (closed) return; stats.ms.lot = Math.round(performance.now() - t1); addPatch(extra?.lawn);   // (the worker stamps the lot at y 0.2, as main.js does)
      stats.lot = { plot: P.id, style, clipped: clipBank(lb, (x, y0, z) => { const y = y0 - .2; if (z < back - 3) return y > 2.6 && body.some(r => inR(r, x, z, .5));   // (behind the room: only roofs and pergolas; a pool's fence stays)
        if (z <= front + .25) return (y > .07 && body.some(r => inR(r, x, z))) || (y > 1.9 && body.some(r => inR(r, x, z, .5))) || (y > 2.6 && side.some(r => inR(r, x, z, .4)));   // the walls, the eaves, a carport's roof
        return y > 1.15 && body.some(r => inR(r, x, z, .5)); }) };
      lotG.position.y = -LIFT - .2; addBank(lb, lotG, true); SPRK.set('own', wSpr(R, extra?.sprinklers)); });
    const ground = tiles.map((t, i) => job('ground', t, () => { const b = G.buildGround(PLAN, t); return { bank: b, extra: b.lawn }; }).then(({ bank: b, extra: L }) => { if (closed) return; const k = i ? 'coarse' : 'fine';
      if (L?.tex) { LT[k].set(L.tex); LM[k] = L.mask; relawn(); }
      addBank(b, worldG, false, true, [GMAT[i ? 1 : 0], ...(i ? FAR : MATS).slice(1)]); stats.ground++; stats.ms['ground' + t.s] = Math.round(performance.now() - t1); if (stats.ground === tiles.length) lawn.visible = false; }));
    // the neighbours (Mainland world coordinates), with nothing of theirs standing inside the room (a fence its house hid on the Mainland)
    const inMine = (x, y, z) => { if (y < .27) return false; const [lx, lz] = toLot(x, z); return inRoom(lx, lz); };
    const nbs = near.map(([j]) => job('lot', { spec: { ...j.spec, lawn: LW.lotLawnSpec(j.P, !!j.spec.custom) }, x: j.P.rect.x, z: j.P.rect.z, rot: j.P.rect.rot }, () => { const r = H.buildLot({ ...j.spec, lawn: LW.lotLawnSpec(j.P, !!j.spec.custom) }); return { bank: stamped(r.bank, j.P.rect), extra: r.A }; })
      .then(({ bank: b, extra }) => { if (closed) return; stats.nbClipped = (stats.nbClipped ?? 0) + clipBank(b, inMine); addPatch(extra?.lawn); SPRK.set(j.P.id, wSpr(j.P.rect, extra?.sprinklers)); const g = new THREE.Group(); addBank(b, g, false, true, FAR); worldG.add(g); stats.neighbours++; stats.ms['n' + stats.neighbours] = Math.round(performance.now() - t1); }));
    await Promise.all([own, ...ground, ...nbs]); PL?.close(); pool = null; await idle();   // (the last relawn)
    stats.ms.total = Math.round(performance.now() - t0);
  }

  // ── post: the city's stack and the viewer default look; the depth of field in visit mode
  let post = null, S = null, DOFL = null, dofOn = Q.get('dof') !== '0';
  const postP = Promise.all([import('../../render/post.js'), import('../../render/settings.js'), import('../../render/dof.js')]).then(async ([Pm, Sm, Dm]) => { if (closed) return;
    S = Sm; DOFL = Dm.DOF_LIVE; const p = Pm.createPost(renderer, scene, camera, { night, aa: true }); await p.look(Q.get('preset') || p.defaultLook); if (closed) return;
    S.set('dof', 'auto', true); S.set('dof', 'near', true); S.set('dof', 'strength', 5.5); S.set('dof', 'falloff', .9); S.set('dof', 'on', dofOn); await p.ready(); post = p;
  }).catch(e => console.error('interior view: post', e));

  // ── camera: a lower three-quarter, clamped
  const AZ0 = rad(+(Q.get('az') ?? 26)), EL0 = rad(+(Q.get('el') ?? 27));
  function frame(cur) { const W = cur.res.W, D = cur.res.D, H = cur.res.H, tgt = new THREE.Vector3(-W * .03, .7, .25),
      dir = new THREE.Vector3(Math.sin(AZ0) * Math.cos(EL0), Math.sin(EL0), Math.cos(AZ0) * Math.cos(EL0));
    const corners = []; for (const x of [-W / 2 - .2, W / 2 + .2]) for (const z of [-D / 2 - .2, D / 2 + .5]) for (const y of [-LIFT, H]) corners.push(new THREE.Vector3(x, y, z));
    let dist = Math.max(W, D) * 1.4; for (let it = 0; it < 30; it++) { camera.position.copy(tgt).addScaledVector(dir, dist); camera.lookAt(tgt); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let m = 0; for (const c of corners) { const p = c.clone().project(camera); m = Math.max(m, Math.abs(p.x) * 1.0, Math.abs(p.y + .08) * 1.18); } dist *= Math.pow(m / +(Q.get("fit") ?? .97), .7); }
    controls.target.copy(tgt); controls.minPolarAngle = rad(28); controls.maxPolarAngle = rad(76); controls.minAzimuthAngle = AZ0 - rad(78); controls.maxAzimuthAngle = AZ0 + rad(64);
    controls.minDistance = dist * .42; controls.maxDistance = dist * 1.6; controls.rotateSpeed = .7; controls.zoomSpeed = .8; controls.update(); stats.dist = +dist.toFixed(1);
    lim = { x: W / 2 + 3, z0: -D / 2 - 2, z1: D / 2 + 6 }; }
  let lim = null, k = 0, shadowed = 0;
  function tick(dt, life, editing) {
    if (lim) { const t = controls.target; t.x = Math.max(-lim.x, Math.min(lim.x, t.x)); t.z = Math.max(lim.z0, Math.min(lim.z1, t.z)); t.y = Math.max(.2, Math.min(2.2, t.y)); }
    sky.mesh.position.copy(camera.position); SPRK.update(performance.now() / 1000, null);
    if (tufts) { worldG.updateWorldMatrix(true, false); tufts.update(camera, performance.now(), lawnInv.copy(worldG.matrixWorld).invert()); }
    if (DOFL) { DOFL.focus = camera.position.distanceTo(controls.target); if (S && post) { const want = dofOn && !editing; if (S.get('dof')?.on !== want) S.set('dof', 'on', want); } }
    // the resident's blob follows it (its room position + the room's place); hidden while the builder is open (the pieces move then)
    contacts.visible = !editing; winPools.visible = lampPools.visible = true;
    if (life && resIdx >= 0 && roomCur && (k++ & 1) === 0) { const s = life.state(), o = roomCur.g.position, lying = s.mode === 'hold' && /sleep|lie/.test(s.act || '');
      put(contacts, resIdx, o.x + s.x, .016, o.z + s.z, lying ? .01 : .78, lying ? .01 : .78); contacts.instanceMatrix.needsUpdate = true; }
    // the builder's own meshes take the shadows too (it builds its shell and pieces in a group of its own)
    if (editing && (shadowed++ % 20) === 0) scene.getObjectByName('home-builder')?.traverse(m => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
  }
  function render(t) { if (post) post.render(t / 1000); else renderer.render(scene, camera); }
  function dispose() { closed = true; pool?.close(); SPRK.dispose(); FAR.forEach((m, li) => li !== 3 && m.dispose()); for (const m of lawnMats) { m.dispose(); } if (tufts) { tufts.mesh.geometry.dispose(); tufts.mesh.material.dispose(); for (const k of ['uLawnF', 'uLawnC']) tufts.U[k].value?.dispose(); } scene.environment = null; env?.dispose(); BLOB.dispose(); RECT.dispose(); PLANE.dispose(); cMat.dispose(); winPools.material.dispose(); lampPools.material.dispose(); lawn.geometry.dispose(); lawn.material.dispose();
    sky.mat.dispose(); sky.mesh.geometry.dispose(); for (const l of lamps) l.dispose?.(); if (DOFL) DOFL.focus = null; }
  return { setRoom, frame, tick, render, dispose, lotG, worldG, sun, hemi, sky, get post() { return post; }, get place() { return place; },
    get ready() { return Promise.all([ctxP ?? Promise.resolve(), postP]).then(() => true); }, setDof(on) { dofOn = !!on; }, stats: () => ({ ...stats, open: Math.round(performance.now() - T0) }) };
}
