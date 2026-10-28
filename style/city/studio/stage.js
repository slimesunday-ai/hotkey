// TRAIT STUDIO · the stage: the city's walker exactly as the animation lab draws it (style/city/anim/): the segmented walk v2 body
// (bake.js bakeSegFull, with joint slabs and the walk polish), the keyed walk (gait2.js, walk2.js), turns (turn.js), the nine
// idles (idle.js), held items in their grip (grip.js, via the bake's aPart) and swinging pendants (jewelry-motion.js), on the
// city's walker material (gpu.js tierize) under the city's sun and fill. One BatchedMesh, one animation texture, as peds.js does.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CH from '../../../world/chars.js';
import { tierize } from '../gpu.js';
import { bakeSegFull } from '../anim/bake.js';
import { IDLE_NAMES, stepIdle } from '../anim/idle.js';
import { turnToward } from '../anim/turn.js';
import { WALK } from '../anim/walk.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../anim/walk2.js';
import { gait2State, stepGait2 } from '../anim/gait2.js';
import { JEWEL_MOTION, jewelUniforms, installJewelMotion } from '../anim/jewelry-motion.js';

export { IDLE_NAMES };
export const MODES = ['idle', 'tread', 'circle'];
const K = { ...WALK }, K2 = { ...WALK2 }, CAP = 2, DT = 1 / 60, R = 1.35;

export function createStage(host, o = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.preserve });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(), BG = 0xd4d4cf; scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 16, 34);
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 200), controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .12; controls.minDistance = 1.2; controls.maxDistance = 30; controls.maxPolarAngle = Math.PI * .495; controls.autoRotateSpeed = 2.2;
  // the city's sun and fill (render/lighting.js, as the lab)
  const sunDir = new THREE.Vector3(-0.52, 0.74, 0.42).normalize(), sun = new THREE.DirectionalLight(0xfff2dc, 3.0); sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = .03; sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05));
  const aimSun = (x, z, r) => { sun.target.position.set(x, 0, z); sun.position.copy(sun.target.position).addScaledVector(sunDir, 30); Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix(); };
  // a neutral floor: warm grey, a 0.5 m grid (it runs under the treadmill walker, so a sliding foot shows)
  const fc = document.createElement('canvas'); fc.width = fc.height = 128; { const g = fc.getContext('2d'); g.fillStyle = '#c9c9c3'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#b6b6af'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128);
    g.fillStyle = '#bfbfb8'; g.fillRect(0, 63, 128, 2); g.fillRect(63, 0, 2, 128); }
  const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.anisotropy = 8; ftex.repeat.set(30, 30);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: ftex, roughness: .92 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(R - .02, R + .02, 96), new THREE.MeshBasicMaterial({ color: 0xa9a9a2, transparent: true, opacity: .8 })); r.rotation.x = -Math.PI / 2; r.position.y = .002; r.visible = false; scene.add(r); return r; });   // (the circle walk's path)

  // the walker material, once (the lab's makeBatch): tierize → walk v2 → pendant swing; the depth pass the same
  const tex = createAnimTexture2(CAP), [uni, G] = animUniforms2(tex, K2, K), JU = jewelUniforms(JEWEL_MOTION);
  const mat = installJewelMotion(installAnim2(tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }), uni), JU);
  const depth = installJewelMotion(installAnim2(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uni), JU);
  const geoOf = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(t.K), 1)); if (t.SL) g.setAttribute('aSlab', new THREE.BufferAttribute(new Float32Array(t.SL), 1));
    g.setAttribute('aJw', new THREE.BufferAttribute(t.JW || new Float32Array(t.P.length / 3), 1)); g.setIndex(new THREE.BufferAttribute(t.I, 1)); return g; };
  const bakes = new Map();   // look JSON → baked body (LRU)
  const bakeOf = L => { const k = JSON.stringify(L); let b = bakes.get(k); if (b) { bakes.delete(k); bakes.set(k, b); return [b, false]; }
    b = bakeSegFull(THREE, CH, structuredClone(L), { jewel: true }); bakes.set(k, b); if (bakes.size > 60) bakes.delete(bakes.keys().next().value); return [b, true]; };

  const S = { mode: 'idle', idle: 0, cycle: false, v: 1.2, paused: false, turntable: false, t: 0, cycleT: 0 };
  let batch = null, actors = [], lastSwitch = { bake: 0, batch: 0, total: 0, baked: 0 };
  const M4 = new THREE.Matrix4(), QN = new THREE.Quaternion(), V3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0);
  const home = k => { const n = actors.length; if (S.mode === 'circle') return [n > 1 ? (k ? 1.65 : -1.65) : 0, 0]; if (S.mode === 'tread') return [n > 1 ? (k ? .8 : -.8) : 0, n > 1 ? (k ? -.35 : .35) : 0]; return [n > 1 ? (k ? .62 : -.62) : 0, 0]; };
  function place(a, k) { const [hx, hz] = home(k); a.hx = hx; a.hz = hz; a.s = k * .7; rings[k].position.set(hx, .002, hz); rings.forEach((r, j) => { r.visible = S.mode === 'circle' && j < actors.length; });
    if (S.mode === 'circle') { const th = a.s / R; a.x = hx + R * Math.sin(th); a.z = hz + R * Math.cos(th); a.yaw = Math.atan2(Math.cos(th), -Math.sin(th)); }
    else { a.x = hx; a.z = hz; a.yaw = S.mode === 'tread' ? Math.PI / 2 : 0; }
    a.st = { yaw: a.yaw, omega: 0 }; }
  // looks: 1 (or 2 to compare); returns the switch cost (bake + batch)
  function setLooks(looks) { const t0 = performance.now(); let baked = 0;
    const bodies = looks.map(L => { const [b, fresh] = bakeOf(L); baked += fresh; return b; }), t1 = performance.now();
    if (batch) { scene.remove(batch); batch.dispose(); }
    const geos = bodies.map(geoOf), VN = geos.reduce((s, g) => s + g.attributes.position.count, 0), IN = geos.reduce((s, g) => s + g.index.count, 0);
    batch = new THREE.BatchedMesh(CAP, VN, IN, mat); batch.customDepthMaterial = depth; batch.castShadow = batch.receiveShadow = true; batch.sortObjects = false; batch.perObjectFrustumCulled = false; batch.frustumCulled = false;
    const ids = geos.map(g => batch.addGeometry(g)); for (const id of ids) batch.addInstance(id); scene.add(batch);
    const prev = actors; actors = looks.map((L, k) => { const a = prev[k] && prev.length === looks.length ? prev[k] : { g: gait2State({ it: k * 2.3, idle: S.idle }), wait: 0 }; a.L = L; return a; });
    if (prev.length !== looks.length) { actors.forEach(place); pose0(); }
    lastSwitch = { bake: t1 - t0, batch: performance.now() - t1, total: performance.now() - t0, baked, tris: IN / 3 };
    return lastSwitch; }
  function pose0() { for (const a of actors) { a.g.idle = S.idle; if (S.mode === 'idle') { a.g.iw = 1; a.g.still = 1; a.g.wasStill = true; } } }
  function setMode(m) { if (!MODES.includes(m)) return; S.mode = m; for (const a of actors) { a.g = gait2State({ it: a.g.it, idle: S.idle }); } actors.forEach(place); pose0(); ftex.offset.set(0, 0); resetView(); }
  function setIdle(i) { S.cycle = i === 'cycle'; const v = S.cycle ? 0 : i | 0; S.idle = v; S.cycleT = 0; for (const a of actors) { a.wait = .28; a.next = v; } }
  function step(dt) {
    S.t += dt; JU.uJwT.value = S.t;
    if (S.mode === 'idle' && S.cycle) { S.cycleT += dt; if (S.cycleT > 7) { S.cycleT = 0; S.idle = (S.idle + 1) % IDLE_NAMES.length; for (const a of actors) { a.wait = .28; a.next = S.idle; } } }
    for (const a of actors) {
      if (S.mode === 'idle') { let standing = true; if (a.wait > 0) { a.wait -= dt; standing = false; if (a.wait <= 0) { a.g.idle = a.next; a.g.it = 0; } }   // (blend the old idle out, then the new one in)
        a.g.look = a.g.idle === 8 ? .85 : 0; stepGait2(a.g, 0, dt, K2, G, 0); stepIdle(a.g, standing, dt); }
      else if (S.mode === 'tread') { const d = S.v * dt; a.yaw = Math.PI / 2; stepGait2(a.g, d, dt, K2, G, 0); stepIdle(a.g, false, dt); }
      else { const d = S.v * dt; a.s += d; const th = a.s / R; a.x = a.hx + R * Math.sin(th); a.z = a.hz + R * Math.cos(th);
        const dy = turnToward(a.st, Math.atan2(Math.cos(th), -Math.sin(th)), dt, K.turnRate); a.yaw = a.st.yaw; a.g.omega = a.st.omega; stepGait2(a.g, d, dt, K2, G, dy); stepIdle(a.g, false, dt); } }
    if (S.mode === 'tread') ftex.offset.x = (ftex.offset.x + S.v * dt / 1) % 1; }
  function advance(sec) { let d = sec; while (d > 1e-6) { const s = Math.min(DT, d); step(s); d -= s; } }
  const VIEWS = { idle: [[2.3, 1.75, 5.4], [0, 1.0, 0]], tread: [[1.6, 1.6, 5.7], [0, .98, 0]], circle: [[0, 4.4, 8.4], [0, .8, 0]] };   // (a body is ~2 m: the head is half of it)
  function resetView() { const [p, t] = VIEWS[S.mode]; const wide = actors.length > 1 ? (S.mode === 'circle' ? 1.75 : 1.35) : 1; camera.position.set(p[0] * wide, p[1] * (wide > 1 ? 1.05 : 1), p[2] * wide); controls.target.set(...t); controls.update();
    aimSun(0, 0, S.mode === 'circle' ? (actors.length > 1 ? 4.6 : 2.6) : 2); }
  function draw() {
    if (!batch) return; const data = tex.image.data;
    actors.forEach((a, k) => { QN.setFromAxisAngle(YA, a.yaw); V3.set(a.x, 0, a.z); M4.compose(V3, QN, ONE); batch.setMatrixAt(k, M4); writeGait2(data, CAP, k, a.g); });
    tex.needsUpdate = true; controls.autoRotate = S.turntable; controls.update(); renderer.render(scene, camera); }
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  // screen positions of the actors' heads (labels)
  const heads = () => { const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight; return actors.map(a => { V3.set(a.x, 2.15, a.z).project(camera); return [(V3.x + 1) / 2 * w, (1 - V3.y) / 2 * h, V3.z < 1]; }); };
  const finish = () => { const gl = renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return gl.getError(); };
  return { S, renderer, scene, camera, controls, setLooks, setMode, setIdle, step, advance, draw, resetView, heads, finish, get lastSwitch() { return lastSwitch; }, get actors() { return actors; },
    compile: () => renderer.compile(scene, camera) };
}
