// ANIM LAB (2026-09-29) · a standalone page for the walkers' animation, before it goes into the city. The city's own characters
// (world/chars.js), bake (anim/bake.js: pedbake.js's full tier with a finer rig), materials (gpu.js tierize, the walkers' material) and
// drawing (one BatchedMesh per walk, an animation texture per instance, peds.js's way). Nothing in the city is touched.
// URL: ?scene=treadmill|square|kerb|crowd|idles|feet · &ab=old|new(v1)|v2|ab(old · v1)|v12(v1 · v2) · &cam=side|tq|top|feet|knee|free · &n=20 (crowd) · &v=1.2 (m/s)
//      &look=<i> (treadmill) · &t=<s> (deterministic: the scene simulated from 0 to t in 1/60 s steps) · &shot=1 (no UI; title "ready" when drawn)
//      &strip=8&sdt=<s>&cols=4&fw=400&fh=500 (a contact sheet of frames t, t+sdt, …) · &bench=1 (frame cost 20/200/2000, old vs new)
//      any WALK (v1) tunable by name (&stride=.34&bob=1 …); v2's as v2.<name> (&v2.stride=.44 …) · &dbg=back: inside faces drawn magenta
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CH from '../../../world/chars.js';
import { heldLooks } from '../../../world/held2.js';
import { tierize } from '../gpu.js';
import { PAL, SIDE, WALLS } from '../style.js';
import { bakeAnimLooks, bakeSegLooks } from './bake.js';
import { WALK, createAnimTexture, animUniforms, setAnimUniforms, gaitState, stepGait, stepOldGait, writeGait, writeOld, installAnim } from './walk.js';
import { IDLE, IDLE_NAMES, IDLE_POOL, stepIdle } from './idle.js';
import { turnToward, roundedPath, wrapPi } from './turn.js';
import { WALK2, createAnimTexture2, animUniforms2, setAnimUniforms2, writeGait2, installAnim2 } from './walk2.js';
import { SLIDERS2, gait2State, stepGait2 } from './gait2.js';
import { JEWEL_LOOKS } from '../../../world/jewelry2.js';
import { JEWEL_MOTION, jewelUniforms, installJewelMotion } from './jewelry-motion.js';   // &jewel=1: the jewellery looks first, pendants swing (&jwx=<scale> · &spark=<rate>)

const Q = new URLSearchParams(location.search), SHOT = Q.has('shot'), STRIP = +(Q.get('strip') || 0), BENCH = Q.has('bench');
const K = { ...WALK }; for (const k of Object.keys(WALK)) if (Q.has(k)) K[k] = +Q.get(k);
const K2 = { ...WALK2 }; for (const k of Object.keys(WALK2)) if (Q.has('v2.' + k)) K2[k] = +Q.get('v2.' + k);
const DBG = Q.get('dbg') || '';
const NAME = { old: 'OLD', new: 'V1', v2: 'V2' }, PAIRS = { ab: ['old', 'new'], v12: ['new', 'v2'] }, pairOf = () => PAIRS[S.ab] || null;
const S = { scene: Q.get('scene') || 'treadmill', ab: Q.get('ab') || 'v12', cam: Q.get('cam') || null, n: +(Q.get('n') || 20), v: +(Q.get('v') || 1.2), slow: Q.has('slow'), paused: false, t: 0 };
const rng = seed => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// ── renderer, scene, light (the city's sun and fill: render/lighting.js DEF_DIR, 0xfff2dc × 3.0, hemi 0xd6ecff / 0xe0cfb0 × 1.05)
const FW = +(Q.get('fw') || 400), FH = +(Q.get('fh') || 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SHOT || !!STRIP || BENCH, powerPreference: 'high-performance' });
renderer.domElement.id = 'gl'; document.body.prepend(renderer.domElement);
renderer.setPixelRatio(STRIP ? 1 : Math.min(2, devicePixelRatio)); renderer.setSize(STRIP ? FW : innerWidth, STRIP ? FH : innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.horizon);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .05, 600);
const controls = new OrbitControls(camera, renderer.domElement); controls.enabled = false;
const sunDir = new THREE.Vector3(-0.52, 0.74, 0.42).normalize(), sun = new THREE.DirectionalLight(0xfff2dc, 3.0); sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = .03; sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target, new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05));
const aimSun = (c, r) => { sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sunDir, 80); Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 200 }); sun.shadow.camera.updateProjectionMatrix(); };

// ── the stage: a plaza (sidewalk slabs, a kerb ring, lamps and benches), a road with a crosswalk and a signal, the far corner,
// and a treadmill (a moving sidewalk) in front of a wall, for the side view
const ZT = -40, PLAZA = 16, FAR0 = 24;
const slabTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const hex = h => '#' + h.toString(16).padStart(6, '0');
  g.fillStyle = hex(PAL.walk); g.fillRect(0, 0, 128, 128); g.fillStyle = hex(PAL.joint); g.fillRect(0, 0, 128, 5); g.fillRect(0, 0, 5, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; })();
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o });
const box = (w, h, d, x, y, z, m, cast = false) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = cast; scene.add(b); return b; };
const slabMat = (w, d) => { const t = slabTex.clone(); t.repeat.set(w, d); t.needsUpdate = true; return mat(0xffffff, { map: t }); };
const deck = (x0, x1, z0, z1) => { const w = x1 - x0, d = z1 - z0, side = mat(PAL.curbFace), top = slabMat(w, d);
  box(w, SIDE, d, (x0 + x1) / 2, SIDE / 2, (z0 + z1) / 2, [side, side, top, side, side, side]);
  const ct = mat(PAL.curbTop); for (const [cx, cz, cw, cd] of [[(x0 + x1) / 2, z0 + .11, w, .22], [(x0 + x1) / 2, z1 - .11, w, .22], [x0 + .11, (z0 + z1) / 2, .22, d], [x1 - .11, (z0 + z1) / 2, .22, d]]) box(cw, .004, cd, cx, SIDE + .002, cz, ct); };
box(600, .02, 600, 0, -.01, 0, mat(PAL.asphalt, { roughness: .95 }));
deck(-PLAZA, PLAZA, -PLAZA, PLAZA); deck(FAR0, FAR0 + 20, -PLAZA, PLAZA);
for (let z = -2.3; z <= 2.31; z += .8) box(FAR0 - PLAZA - .6, .006, .42, (PLAZA + FAR0) / 2, .003, z, mat(PAL.lineW));   // the zebra
for (const z of [-9, -6, 6, 9, 12, -12]) box(.14, .006, 1.6, (PLAZA + FAR0) / 2, .003, z, mat(PAL.lineY));
const lamp = (x, z) => { box(.14, 4.2, .14, x, SIDE + 2.1, z, mat(PAL.lamp), true); box(.5, .16, .3, x, SIDE + 4.2, z, mat(PAL.lamp), true); box(.36, .06, .22, x, SIDE + 4.1, z, mat(PAL.litHi, { emissive: PAL.litLo, emissiveIntensity: .4 })); };
for (const p of [[-15.3, -15.3], [-15.3, 15.3], [15.3, -8], [15.3, 8], [-15.3, 0]]) lamp(p[0], p[1]);
const bench = (x, z, ry) => { const g = new THREE.Group(), w = mat(PAL.wood), iron = mat(PAL.iron); for (const [bw, bh, bd, bx, by, bz, m] of [[1.8, .08, .45, 0, .45, 0, w], [1.8, .4, .06, 0, .7, -.2, w], [.08, .45, .4, -.8, .22, 0, iron], [.08, .45, .4, .8, .22, 0, iron]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); b.position.set(bx, by, bz); b.castShadow = b.receiveShadow = true; g.add(b); }
  g.position.set(x, SIDE, z); g.rotation.y = ry; scene.add(g); };
bench(-9, -15.2, 0); bench(-4, -15.2, 0); bench(4, -15.2, 0); bench(9, -15.2, 0);
const signals = [];   // walk / don't-walk heads on the crosswalk's two corners, each facing the walkers who wait across the road
const signal = (x, z, ry) => { box(.12, 3, .12, x, SIDE + 1.5, z, mat(PAL.iron), true); const g = new THREE.Group(); g.position.set(x, SIDE + 2.6, z); g.rotation.y = ry; scene.add(g);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(.4, .7, .3), mat(PAL.iron)); hd.castShadow = true; g.add(hd);
  const red = new THREE.Mesh(new THREE.BoxGeometry(.28, .26, .02), mat(0x331111, { emissive: 0xff3b1f, emissiveIntensity: 1 })), wlk = new THREE.Mesh(new THREE.BoxGeometry(.28, .26, .02), mat(0x112233, { emissive: 0xeaf6ff, emissiveIntensity: 0 }));
  red.position.set(0, .16, .16); wlk.position.set(0, -.16, .16); g.add(red, wlk); signals.push({ red, wlk, x, z }); };
signal(FAR0 + .4, -3.1, -Math.PI / 2); signal(PLAZA - .4, 3.1, Math.PI / 2);
// the treadmill: a slab belt whose texture runs under the walkers (they stay put), rails, and a wall behind with a 0.5 m grid
const beltTex = slabTex.clone(); beltTex.repeat.set(14, 3); beltTex.needsUpdate = true;
{ const side = mat(PAL.curbFace), top = mat(0xffffff, { map: beltTex }); box(14, SIDE, 3, 0, SIDE / 2, ZT, [side, side, top, side, side, side]);
  for (const z of [ZT - 1.56, ZT + 1.56]) box(14, .08, .12, 0, SIDE + .04, z, mat(PAL.iron));
  const wc = document.createElement('canvas'); wc.width = 64; wc.height = 64; const g = wc.getContext('2d'); g.fillStyle = '#' + WALLS[0].toString(16).padStart(6, '0'); g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(23,23,27,.18)'; g.fillRect(0, 0, 2, 64); g.fillRect(0, 0, 64, 2);
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(40, 12); box(20, 6, .3, 0, 3, ZT - 3.5, mat(0xffffff, { map: wt })); }
const groundY = (x, z) => { if (Math.abs(z - ZT) < 1.6 && Math.abs(x) < 7) return SIDE; const onP = Math.abs(x) <= PLAZA && Math.abs(z) <= PLAZA, onF = x >= FAR0 && x <= FAR0 + 20 && Math.abs(z) <= PLAZA;
  if (onP || onF) { const e = Math.min(onP ? PLAZA - Math.abs(x) : x - FAR0, onP ? PLAZA - Math.abs(z) : PLAZA - Math.abs(z)); return SIDE * Math.min(1, .5 + e / .3); }
  const e = Math.min(Math.abs(x - PLAZA), Math.abs(x - FAR0)); return Math.abs(z) <= PLAZA ? SIDE * Math.max(0, .5 - e / .3) : 0; };

// ── characters: the approved looks (chars.js LOOKS) and a few rolled ones (pedbake.js's rollLook), baked with the finer rig
const JWL = Q.has('jewel'), JU = jewelUniforms({ ...JEWEL_MOTION, swing: JEWEL_MOTION.swing * +(Q.get('jwx') ?? 1), lift: JEWEL_MOTION.lift * +(Q.get('jwx') ?? 1), sparkle: +(Q.get('spark') || 0) });
const LOOKLIST = Q.has('held') ? (h => [...h.slice(+Q.get('held') || 0), ...h.slice(0, +Q.get('held') || 0)])(heldLooks(CH.look).map(l => Q.has('heldnone') ? { ...l, held: { id: 'none' } } : l))   // &held=<i>: one body per held item (held2.js), from the i-th (&heldnone: the same bodies, empty-handed)
  : [...(JWL ? JEWEL_LOOKS.map(l => CH.look(structuredClone(l))) : []), ...CH.LOOKS.map(l => structuredClone(l)), ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => CH.rollLook((0x5eed + k * 7919) & 0xffffff))]
  .map(l => Q.has('top') ? { ...l, top: { id: Q.get('top'), ...(Q.has('cw') ? { cw: +Q.get('cw') } : {}) } } : l)
  .map(l => Q.has('bottom') ? { ...l, bottom: { id: Q.get('bottom') } } : l).map(l => Q.has('acc') ? { ...l, acc: { id: Q.get('acc') } } : l).map(l => Q.has('shoes') ? { ...l, shoes: { id: Q.get('shoes') } } : l);   // &bottom= &acc= &shoes=<id>: every look wears it (lower refit close-ups)   // &top=<id>[&cw=<n>]: every look wears that top (trait close-ups for a top in no preset)
const tb = performance.now(); const LK = bakeAnimLooks(LOOKLIST, CH, THREE); const bakeMs = performance.now() - tb;
const geoOf = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(t.K), 1)); if (t.SL) g.setAttribute('aSlab', new THREE.BufferAttribute(new Float32Array(t.SL), 1)); if (t.JW) g.setAttribute('aJw', new THREE.BufferAttribute(t.JW, 1)); g.setIndex(new THREE.BufferAttribute(t.I, 1)); return g; };
const GEOS = LK.map(l => geoOf(l.full)), VN = GEOS.reduce((s, g) => s + g.attributes.position.count, 0), IN = GEOS.reduce((s, g) => s + g.index.count, 0);
const TRIS = LK.map(l => l.full.I.length / 3), triAvg = TRIS.reduce((a, b) => a + b, 0) / TRIS.length;
const tb2 = performance.now(); const LK2 = bakeSegLooks(LOOKLIST, CH, THREE, { slabs: !Q.has('noslab'), inset: Q.has('noinset') ? 0 : undefined, jewel: JWL }); const bakeMs2 = performance.now() - tb2;   // v2: closed rigid segments
const GEOS2 = LK2.map(l => geoOf(l.full)), VN2 = GEOS2.reduce((s, g) => s + g.attributes.position.count, 0), IN2 = GEOS2.reduce((s, g) => s + g.index.count, 0);
const triAvg2 = LK2.reduce((a, l) => a + l.full.I.length / 3, 0) / LK2.length;
// &dbg=back: draw back faces magenta. A closed body never shows one; a hole into a hollow part does (the pixel gate counts them)
const backDbg = m => { if (DBG !== 'back') return m; m.side = THREE.DoubleSide; const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(1., 0., 1., 1.);'); };
  m.customProgramCacheKey = () => (key ? key() : '') + '|dbgback'; return m; };
function makeBatch(mode, cap) {   // peds.js's near tier: one BatchedMesh, any look in any slot, the animation texture per instance
  const v2 = mode === 'v2', tex = v2 ? createAnimTexture2(cap) : createAnimTexture(cap); let uni, G = null; if (v2) [uni, G] = animUniforms2(tex, K2, K); else uni = animUniforms(tex, K);
  const inst = (mt) => v2 ? (JWL ? installJewelMotion(installAnim2(mt, uni), JU) : installAnim2(mt, uni)) : installAnim(mt, uni, mode);
  const m = inst(backDbg(tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true })));
  const depth = inst(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })), geos = v2 ? GEOS2 : GEOS;
  const b = new THREE.BatchedMesh(cap, v2 ? VN2 : VN, v2 ? IN2 : IN, m); b.customDepthMaterial = depth; b.castShadow = b.receiveShadow = true; b.sortObjects = false; b.perObjectFrustumCulled = true; b.frustumCulled = false;
  const ids = geos.map(g => b.addGeometry(g)); for (let k = 0; k < cap; k++) { b.addInstance(ids[0]); b.setVisibleAt(k, false); } scene.add(b);
  return { b, tex, uni, G, ids, cap, mode, shown: 0 }; }
const CAP = 2048, BATCH = { new: makeBatch('new', CAP), old: makeBatch('old', CAP), v2: makeBatch('v2', CAP) };
const retune2 = () => { BATCH.v2.G = setAnimUniforms2(BATCH.v2.uni, K2, K); };
// one gait step for any walk (old: peds.js's; new: v1; v2)
function gaitStep(a, d, dt, dy = 0, pick, standing = false) {
  if (a.mode === 'old') { stepOldGait(a.g, d, dt); return; }
  if (a.mode === 'v2') stepGait2(a.g, d, dt, K2, BATCH.v2.G, dy); else stepGait(a.g, d, dt, K, dy);
  stepIdle(a.g, standing, dt, pick); }

// ── actors: a look, a walk ('new' | 'old'), a place and heading, a gait (walk.js) and a turn state (turn.js)
let actors = [];
const actor = (mode, look, x, z, yaw, o = {}) => ({ mode, look: look % LK.length, x, z, y: groundY(x, z), yaw, v: 0, g: mode === 'v2' ? gait2State({ u: (o.phase ?? 0) / (2 * Math.PI), it: o.it ?? 0, idle: o.idle ?? -1 }) : gaitState({ phase: o.phase ?? 0, it: o.it ?? 0, idle: o.idle ?? -1 }), st: { yaw, omega: 0 }, label: o.label, ...o });
// one frame of an actor wanting to face `want` and move at speed `vw` along its heading (new: turns at a limited rate, arcs,
// shuffles when turning on the spot; old: snaps). `path` (optional): { at(s) } and a.s, for walkers on a fixed route.
function drive(a, dt, want, vw, o = {}) {
  const acc = 2.5, dec = o.dec ?? 3;
  if (a.mode === 'old') { a.yaw = want; a.v = vw > a.v ? Math.min(vw, a.v + acc * dt) : Math.max(vw, a.v - dec * dt); const d = a.v * dt;
    a.x += Math.sin(a.yaw) * d; a.z += Math.cos(a.yaw) * d; a.y = groundY(a.x, a.z); stepOldGait(a.g, d, dt); return d; }
  const dy = turnToward(a.st, want, dt, K.turnRate); a.yaw = a.st.yaw; a.g.omega = a.st.omega;
  const err = Math.abs(wrapPi(want - a.yaw)); let v = vw * Math.max(0, Math.min(1, Math.cos(err) * 1.25 - .25)); if (err > 1.1 && a.v < .35) v = 0;   // (a big turn from standing: on the spot first)
  a.v = v > a.v ? Math.min(v, a.v + acc * dt) : Math.max(v, a.v - dec * dt); const d = a.v * dt;
  a.x += Math.sin(a.yaw) * d; a.z += Math.cos(a.yaw) * d; a.y = groundY(a.x, a.z);
  gaitStep(a, d, dt, dy, o.pick, a.v < .03 && Math.abs(a.st.omega) < .25); return d; }
function seek(a, dt, tx, tz, vmax, o = {}) {   // walk to (tx, tz), slowing to stop on it; true when there
  const dx = tx - a.x, dz = tz - a.z, dist = Math.hypot(dx, dz), f = dx * Math.sin(a.yaw) + dz * Math.cos(a.yaw), close = dist < .35;   // (close: keep the heading, stop on the line; never spin round for a centimetre)
  if (dist < .03 || (close && f <= .01)) { drive(a, dt, a.yaw, 0, o); return true; }
  const vw = Math.min(vmax, Math.sqrt(2 * 2.2 * Math.max(0, (close ? f : dist) - .02))); drive(a, dt, close ? a.yaw : Math.atan2(dx, dz), vw, o); return false; }

// ── scenes
const LIGHT = { t: 0 }, green = t => { const m = t % 50; return (m >= 9 && m < 16) || (m >= 33 && m < 40); };
const SCENES = {
  treadmill: { label: 'treadmill', cam: 'side', focus: [0, .8, ZT],
    setup() { const L = [+(Q.get('look') || 0)], pr = pairOf(); if (pr) return [actor(pr[0], L[0], -1.05, ZT, Math.PI / 2, { label: NAME[pr[0]] }), actor(pr[1], L[0], 1.05, ZT, Math.PI / 2, { label: NAME[pr[1]] })];
      return [actor(S.ab, L[0], 0, ZT, Math.PI / 2, { label: NAME[S.ab], ...(Q.has('idle') ? { idle: +Q.get('idle') } : {}) })]; },   // &idle=<k>: stand in idle k (idle.js) instead of walking
    update(dt) { const st = Q.has('idle'), d = st ? 0 : S.v * dt; beltTex.offset.x = (beltTex.offset.x + d) % 1; for (const a of actors) { a.y = SIDE; a.v = st ? 0 : S.v; gaitStep(a, d, dt, 0, undefined, st); } } },
  feet: null,
  square: { label: 'corners', cam: 'tq', focus: [0, 0, 0],
    setup() { const out = [], sq = (cx, side) => [[cx - side / 2, -side / 2], [cx + side / 2, -side / 2], [cx + side / 2, side / 2], [cx - side / 2, side / 2]];
      const add = (mode, cx, side) => { const P = roundedPath(sq(cx, side), mode === 'new' ? .9 : .001, true); for (let k = 0; k < 3; k++) { const s = k * P.len / 3, p = P.at(s);
        out.push(actor(mode, [2, 7, 12][k], p[0], p[1], p[2], { path: P, s, label: k === 0 ? NAME[mode] : null })); } };
      const pr = pairOf(); if (pr) { add(pr[0], -5.5, 7); add(pr[1], 5.5, 7); } else add(S.ab, 0, 8); return out; },
    update(dt) { for (const a of actors) { a.s += S.v * dt; const p = a.path.at(a.s); const d = Math.hypot(p[0] - a.x, p[1] - a.z); a.x = p[0]; a.z = p[1]; a.y = groundY(a.x, a.z);
      if (a.mode === 'old') { a.yaw = p[2]; a.v = S.v; stepOldGait(a.g, d, dt); }
      else { const dy = turnToward(a.st, p[2], dt, K.turnRate); a.yaw = a.st.yaw; a.g.omega = a.st.omega; a.v = S.v; gaitStep(a, d, dt, dy); } } } },
  kerb: { label: 'stop-start', cam: 'tq', focus: [19, 0, 0],
    setup() { const out = [], pr = pairOf(), lanes = pr ? { [pr[1]]: [.6, 1.6, 2.6], [pr[0]]: [-.6, -1.6, -2.6] } : { [S.ab]: [-1, 0, 1] };
      for (const mode of Object.keys(lanes)) lanes[mode].forEach((z, k) => { const x0 = 9.5 - 1.1 * k, ids = [IDLE.phone, IDLE.look, IDLE.crossed];
        const plan = [{ idle: 1 + .4 * k, v: IDLE.shift }, { go: [PLAZA - .45 - .55 * k, z] }, { green: .35 * k, look: 0 }, { go: [30 + .8 * k, z] }, { idle: 3, v: ids[k] }, { face: -Math.PI / 2 },
          { go: [FAR0 + .45 + .55 * k, z] }, { green: .35 * k, look: 1 }, { go: [x0, z] }, { face: Math.PI / 2 }, { idle: 99, v: IDLE.shift }];
        out.push(actor(mode, [4, 9, 14][k], x0, z, Math.PI / 2, { plan, i: 0, tw: 0, label: k === 0 ? NAME[mode] : null, it: k * 2.7 })); });
      return out; },
    update(dt) { const t = S.t % 50, g = green(t);
      for (const s of signals) { s.red.material.emissiveIntensity = g ? 0 : 1.1; s.wlk.material.emissiveIntensity = g ? 1.4 : 0; }
      for (const a of actors) { const st = a.plan[a.i]; if (!st) { drive(a, dt, a.yaw, 0); continue; } const next = () => { a.i++; a.tw = 0; };
        if (st.go) { if (seek(a, dt, st.go[0], st.go[1], S.v)) next(); }
        else if (st.face !== undefined) { drive(a, dt, st.face, 0); if (Math.abs(wrapPi(st.face - a.yaw)) < .02 || a.mode === 'old') next(); }
        else if (st.idle !== undefined) { a.g.idle = st.v; drive(a, dt, a.yaw, 0); a.tw += dt; if (a.tw >= st.idle) next(); }
        else if (st.green !== undefined) { const sg = signals[st.look]; a.g.idle = IDLE.crossing; a.g.look = wrapPi(Math.atan2(sg.x - a.x, sg.z - a.z) - a.yaw); drive(a, dt, a.yaw, 0);
          if (g) { a.tw += dt; if (a.tw >= st.green) next(); } } } } },
  crowd: { label: 'crowd', cam: 'tq', focus: [0, 0, 0],
    setup() { const r = rng(0xc40d), n = S.n, half = Math.max(14, 14 * Math.sqrt(n / 60)), out = [];
      const pr = pairOf(); for (let k = 0; k < n; k++) { const mode = pr ? pr[k % 2] : S.ab, [x0, x1] = pr ? (mode === pr[0] ? [-half, -.8] : [.8, half]) : [-half, half];
        const a = actor(mode, (k * 5 + 3) % LK.length, x0 + r() * (x1 - x0), -half + r() * 2 * half, r() * 6.283, { r: rng(0xa11 + k * 131), box: [x0, x1, -half, half], it: r() * 20, vmax: .95 + r() * .4, rest: r() < .5 ? r() * 4 : 0 });
        a.tx = a.x; a.tz = a.z; a.g.idle = IDLE_POOL[(k * 3) % IDLE_POOL.length]; out.push(a); }
      return out; },
    update(dt) { grid(actors);
      for (const a of actors) { const pick = () => IDLE_POOL[(a.r() * IDLE_POOL.length) | 0];
        if (a.rest > 0) { a.rest -= dt; drive(a, dt, a.yaw, 0, { pick }); if (a.rest <= 0) { const [x0, x1, z0, z1] = a.box; a.tx = x0 + a.r() * (x1 - x0); a.tz = z0 + a.r() * (z1 - z0); } continue; }
        const dx = a.tx - a.x, dz = a.tz - a.z, dist = Math.hypot(dx, dz); if (dist < .15) { a.rest = 1.5 + a.r() * 5; drive(a, dt, a.yaw, 0, { pick }); continue; }
        let want = Math.atan2(dx, dz), vw = Math.min(a.vmax * S.v / 1.2, Math.sqrt(2 * 2.2 * dist));
        const [px, pz, block] = avoid(a); if (block) vw *= block; want += px;   // (a nudge round whoever is ahead)
        drive(a, dt, want, vw, { pick }); } } },
  idles: { label: 'idle line-up', cam: 'front', focus: [0, .9, 8],
    setup() { const out = [], pr = pairOf(), rows = pr ? [[pr[1], 8], [pr[0], 4.5]] : [[S.ab, 8]];
      rows.forEach(([mode, z], r) => { for (let k = 0; k < 9; k++) out.push(actor(mode, [0, 1, 2, 3, 5, 7, 9, 12, 15][k], -6.8 + 1.7 * k, z, 0, { idle: k, it: k * 1.37, label: r === 0 && mode !== 'old' ? IDLE_NAMES[k] : (k === 0 ? (mode === 'old' ? 'OLD: no idle' : NAME[mode]) : null), glance: k === 8 ? -.9 : 0 })); });
      return out; },
    update(dt) { for (const a of actors) { if (a.mode !== 'old') a.g.look = a.glance; gaitStep(a, 0, dt, 0, undefined, true); } } },
};
SCENES.feet = { ...SCENES.treadmill, label: 'feet', cam: 'feet' };
// crowd helpers: a hash grid, and a nudge round the nearest walker ahead
const G = new Map(); function grid(list) { G.clear(); for (const a of list) { const k = Math.floor(a.x / 2) * 4096 + Math.floor(a.z / 2); let c = G.get(k); if (!c) G.set(k, c = []); c.push(a); } }
function avoid(a) { const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), cx = Math.floor(a.x / 2), cz = Math.floor(a.z / 2); let best = 9, turn = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = G.get((cx + i) * 4096 + cz + j); if (!c) continue;
    for (const b of c) { if (b === a) continue; const dx = b.x - a.x, dz = b.z - a.z, f = dx * fx + dz * fz, s = dx * fz - dz * fx; if (f <= 0 || f > 1.6 || Math.abs(s) > .75) continue;
      if (f < best) { best = f; turn = (s >= 0 ? 1 : -1) * .7 * (1 - f / 1.6); } } }
  return [turn, 0, best < .75 ? Math.max(0, (best - .45) / .3) : 1]; }

// ── cameras (per scene: side · 3/4 · top · feet; free = orbit)
const CAMS = {
  treadmill: { chest: [[2.3, 1.3, ZT + 1.9], [0, .86, ZT], 30], side: [[0, 1.05, ZT + 7.8], [0, .98, ZT], 30], tq: [[4.8, 2.3, ZT + 5.6], [0, .75, ZT], 35], top: [[0, 8, ZT + 3], [0, 0, ZT], 40], feet: [[0, .95, ZT + 3.3], [0, .28, ZT], 30],
    knee: [[0, .55, ZT + 2.2], [0, .38, ZT], 30], legs: [[0, .62, ZT + 5.2], [0, .52, ZT], 30], feetF: [[1.9, .42, ZT + 1.6], [0, .2, ZT], 30], feetB: [[-1.9, .5, ZT + 1.5], [0, .22, ZT], 30], kneeF: [[1.6, .75, ZT + 1.7], [0, .4, ZT], 30], kneeB: [[-1.7, .7, ZT - 1.4], [0, .4, ZT], 30] },
  square: { tq: [[0, 9.5, 17], [0, 0, 0], 42], side: [[0, 1.4, 16], [0, .8, 0], 45], top: [[0, 24, 4], [0, 0, 0], 45], feet: [[11.5, .5, 6.5], [9, .2, 3.5], 30], corner: [[9.8, 2.8, -9.2], [3.6, .7, -3.4], 38] },
  kerb: { tq: [[10.5, 3.6, 9.5], [17.5, .5, 0], 46], side: [[19, 1.3, 12], [19, .6, 0], 42], top: [[20, 24, 6], [20, 0, 0], 48], feet: [[15.2, .45, 4.8], [15.8, .2, .8], 30], stop: [[18.6, 1.7, -4.8], [14.6, .8, -.6], 40] },
  crowd: { tq: [[0, 14, 25], [0, 0, 0], 45], side: [[0, 1.5, 22], [0, .8, 0], 45], top: [[0, 36, 8], [0, 0, 0], 48], feet: [[0, .45, 7], [0, .3, 1], 32] },
  idles: { front: [[0, 2.1, 23.5], [0, 1, 8], 40], tq: [[7, 3.2, 15], [0, .9, 7], 42], top: [[0, 20, 13], [0, 0, 7], 45], feet: [[0, .38, 11.5], [0, .3, 8], 40] },
};
CAMS.feet = CAMS.treadmill;
function setCam(name) { const set = CAMS[S.scene] || CAMS.treadmill; if (name === 'free') { controls.enabled = true; S.cam = 'free'; ui(); return; }
  const c = set[name] || set[SCENES[S.scene].cam] || Object.values(set)[0]; S.cam = set[name] ? name : SCENES[S.scene].cam; controls.enabled = false;
  let [pos, tgt, fov] = c.map(v => Array.isArray(v) ? v.slice() : v); if (S.scene === 'crowd' && S.n > 60) { const f = Math.sqrt(S.n / 60); pos = pos.map((v, i) => i === 1 ? v * f : v * f); }
  const cx = +(Q.get('cx') || 0), zm = +(Q.get('zoom') || 1); pos = pos.map((v, i) => tgt[i] + (v - tgt[i]) / zm + (i === 0 ? cx : 0)); tgt = tgt.map((v, i) => v + (i === 0 ? cx : 0));   // (&cx= &zoom=: close-ups for shots)
  camera.position.set(...pos); controls.target.set(...tgt); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(controls.target); ui(); }

// ── simulation + drawing
const DT = 1 / 60, M4 = new THREE.Matrix4(), QN = new THREE.Quaternion(), V3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0);
let cpuMs = 0;
function reset() { S.t = 0; beltTex.offset.x = 0; actors = SCENES[S.scene].setup(); const f = SCENES[S.scene].focus, big = S.scene === 'crowd' ? Math.max(20, 16 * Math.sqrt(S.n / 60) + 4) : S.scene === 'kerb' ? 22 : 18;
  aimSun(new THREE.Vector3(...f), big); for (const s of signals) { s.red.material.emissiveIntensity = 1.1; s.wlk.material.emissiveIntensity = 0; } makeLabels(); }
function step(dt) { S.t += dt; JU.uJwT.value = S.t; SCENES[S.scene].update(dt); }
function draw() {
  const t0 = performance.now();
  for (const B of Object.values(BATCH)) { const data = B.tex.image.data; let k = 0;
    for (const a of actors) { if (a.mode !== B.mode || k >= B.cap) continue; QN.setFromAxisAngle(YA, a.yaw); V3.set(a.x, a.y, a.z); M4.compose(V3, QN, ONE);
      B.b.setGeometryIdAt(k, B.ids[a.look]); B.b.setMatrixAt(k, M4); B.b.setVisibleAt(k, true); if (B.mode === 'v2') writeGait2(data, B.cap, k, a.g); else if (B.mode === 'new') writeGait(data, B.cap, k, a.g); else writeOld(data, B.cap, k, a.g); k++; }
    for (let j = k; j < B.shown; j++) B.b.setVisibleAt(j, false); B.shown = k; B.tex.needsUpdate = true; }
  cpuMs = performance.now() - t0;
  renderer.render(scene, camera); placeLabels(); }
// labels over the actors that have one
const LBL = document.getElementById('labels'); let lbls = [];
function makeLabels() { LBL.innerHTML = ''; lbls = actors.filter(a => a.label).map(a => { const s = document.createElement('span'); s.textContent = a.label; LBL.appendChild(s); return [a, s]; }); }
function placeLabels() { const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight; for (const [a, s] of lbls) { V3.set(a.x, a.y + (S.scene === 'idles' ? -.02 : 1.85), a.z).project(camera);
  const on = V3.z < 1 && Math.abs(V3.x) < 1.1 && Math.abs(V3.y) < 1.1 && !STRIP; s.style.display = on ? '' : 'none'; if (on) { s.style.left = ((V3.x + 1) / 2 * w) + 'px'; s.style.top = ((1 - V3.y) / 2 * h + (S.scene === 'idles' ? 6 : -24)) + 'px'; } } }
function simulateTo(t) { reset(); while (S.t + DT / 2 < t) step(DT); }

// ── UI
const $ = id => document.getElementById(id);
const btn = (parent, label, on, fn) => { const b = document.createElement('button'); b.textContent = label ?? '?'; b.onclick = fn; if (on) b.classList.add('on'); parent.appendChild(b); return b; };
const SL = [['stride', 'stride m', .18, .6, .01], ['bob', 'bob ×', 0, 2, .05], ['arm', 'arm swing', 0, 1.2, .02], ['lean', 'lean', 0, .3, .01], ['turnRate', 'turn rate', .8, 8, .1], ['headLag', 'head lag', 0, .2, .005],
  ['turnLean', 'turn lean', 0, .3, .01], ['lift', 'foot lift', 0, .2, .005], ['duty', 'stance', .5, .75, .01]];
function ui() {
  if (SHOT || STRIP) return;
  $('scenes').innerHTML = ''; for (const k of Object.keys(SCENES)) btn($('scenes'), SCENES[k].label, S.scene === k, () => { S.scene = k; S.cam = null; reset(); setCam(SCENES[k].cam); });
  $('ab').innerHTML = ''; for (const [k, l] of [['old', 'old'], ['new', 'v1'], ['v2', 'v2'], ['ab', 'old | v1'], ['v12', 'v1 | v2']]) btn($('ab'), l, S.ab === k, () => { S.ab = k; reset(); ui(); });
  $('time').innerHTML = ''; btn($('time'), S.paused ? 'play' : 'pause', S.paused, () => { S.paused = !S.paused; ui(); }); btn($('time'), 'step', false, () => { S.paused = true; step(DT); ui(); });
  btn($('time'), '0.25×', S.slow, () => { S.slow = !S.slow; ui(); }); btn($('time'), 'restart', false, () => reset());
  const sp = document.createElement('label'); sp.className = 'lab'; sp.innerHTML = `speed <input type="range" min=".2" max="2" step=".05" value="${S.v}" style="vertical-align:middle;width:90px"> <span>${S.v.toFixed(2)} m/s</span>`;
  sp.querySelector('input').oninput = e => { S.v = +e.target.value; sp.querySelector('span').textContent = S.v.toFixed(2) + ' m/s'; }; $('time').appendChild(sp);
  $('cams').innerHTML = ''; for (const k of [...Object.keys(CAMS[S.scene] || {}), 'free']) btn($('cams'), { side: 'side', tq: '3/4', top: 'top', feet: 'feet', front: 'front', free: 'free', corner: 'corner', stop: 'kerb stop', knee: 'knee', legs: 'legs', feetF: 'feet 3/4', feetB: 'feet back', kneeF: 'knee 3/4', kneeB: 'knee back' }[k], S.cam === k, () => setCam(k));
  $('crowd').innerHTML = ''; $('crowdLab').style.display = S.scene === 'crowd' ? '' : 'none'; if (S.scene === 'crowd') for (const n of [20, 200, 2000]) btn($('crowd'), String(n), S.n === n, () => { S.n = n; reset(); setCam(S.cam); });
  const tv2 = S.ab === 'v2' || S.ab === 'v12'; document.querySelector('#tune h3').textContent = tv2 ? 'Tune walk v2' : 'Tune walk v1';
  $('sliders').innerHTML = ''; for (const [k, l, a, b, s, T] of tv2 ? [...SLIDERS2.map(r => [...r, K2]), ...SL.filter(r => r[0] === 'turnRate' || r[0] === 'turnLean').map(r => [...r, K])] : SL.map(r => [...r, K])) {
    const dig = s < .01 ? 3 : 2, el = document.createElement('label'); el.innerHTML = `<span>${l}</span><input type="range" min="${a}" max="${b}" step="${s}" value="${T[k]}"><output>${(+T[k]).toFixed(dig)}</output>`;
    el.querySelector('input').oninput = e => { T[k] = +e.target.value; el.querySelector('output').textContent = T[k].toFixed(dig); for (const B of Object.values(BATCH)) if (B.mode !== 'v2') setAnimUniforms(B.uni, K); retune2(); }; $('sliders').appendChild(el); }
  $('tuneBtns').innerHTML = ''; const tb2 = $('tuneBtns'); btn(tb2, 'reset', false, () => { Object.assign(K, WALK); Object.assign(K2, WALK2); for (const B of Object.values(BATCH)) if (B.mode !== 'v2') setAnimUniforms(B.uni, K); retune2(); ui(); });
  btn(tb2, 'copy url', false, () => { const u = new URL(location.href); u.search = ''; const p = u.searchParams; p.set('scene', S.scene); p.set('ab', S.ab); for (const k of Object.keys(WALK)) if (K[k] !== WALK[k]) p.set(k, K[k]); for (const k of Object.keys(WALK2)) if (K2[k] !== WALK2[k]) p.set('v2.' + k, K2[k]); navigator.clipboard?.writeText(u.toString()); });
  btn(tb2, 'bench', false, () => runBench());
}
addEventListener('keydown', e => { if (e.key === ' ') { S.paused = !S.paused; ui(); e.preventDefault(); } if (e.key === '.') { S.paused = true; step(DT); } });
addEventListener('resize', () => { if (STRIP) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ── frame cost: the crowd scene with N walkers all in one walk, a fixed camera, K frames each drawn and waited for (a 1-pixel read
// forces the GPU to finish), after a warm-up. Reports the median and p95 wall time per frame and the CPU share (actors + upload).
async function runBench() {
  const out = $('bench'), save = { ...S }, res = []; S.scene = 'crowd'; S.paused = false; const gl = renderer.getContext(), px = new Uint8Array(4); out.textContent = 'bench…';
  for (const n of [20, 200, 2000]) for (const ab of ['old', 'new', 'v2']) { S.n = n; S.ab = ab; reset(); setCam('top'); for (let k = 0; k < 20; k++) { step(DT); draw(); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const ft = [], ct = [];
    for (let k = 0; k < 90; k++) { const t0 = performance.now(); step(DT); const t1 = performance.now(); draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t2 = performance.now(); ft.push(t2 - t0); ct.push(t1 - t0 + cpuMs); }
    ft.sort((a, b) => a - b); ct.sort((a, b) => a - b); res.push({ n, walk: NAME[ab], frameP50: +ft[45].toFixed(2), frameP95: +ft[85].toFixed(2), cpuP50: +ct[45].toFixed(2), tris: renderer.info.render.triangles, calls: renderer.info.render.calls });
    out.textContent = 'bench… ' + n + ' ' + ab; await new Promise(r => setTimeout(r, 0)); }
  const table = ['walkers  walk   frame p50   frame p95   cpu p50   tris/frame', ...res.map(r => `${String(r.n).padStart(7)}  ${r.walk.padEnd(5)}  ${r.frameP50.toFixed(2).padStart(7)} ms  ${r.frameP95.toFixed(2).padStart(7)} ms  ${r.cpuP50.toFixed(2).padStart(5)} ms  ${String(r.tris).padStart(10)}`),
    `(${renderer.domElement.width}×${renderer.domElement.height}, full bodies incl. shadow pass; ~${Math.round(triAvg)} tris a body (v2 ~${Math.round(triAvg2)}); bake ${bakeMs.toFixed(0)} ms (v2 ${bakeMs2.toFixed(0)} ms) for ${LK.length} looks)`].join('\n');
  out.textContent = table + '\n\n(click to close)'; out.onclick = () => { out.textContent = ''; }; window.__anim.bench = res; console.log(table);
  Object.assign(S, save); reset(); setCam(S.cam); document.title = 'bench done'; return res; }

// ── go
window.__anim = { renderer, scene, camera, S, K, K2, BATCH, LK2, triAvg, triAvg2, bakeMs2, get actors() { return actors; }, tick: (dt = DT, n = 1) => { for (let k = 0; k < n; k++) step(dt); draw(); return S.t; }, simulateTo, draw, runBench, LK, bakeMs };
if (!SCENES[S.scene]) S.scene = 'treadmill';
reset(); setCam(S.cam || SCENES[S.scene].cam); if (SHOT && S.scene === 'idles') { for (const [a, s] of lbls) s.style.fontSize = '12px'; }
if (STRIP) {   // a contact sheet: frames t, t + sdt, … drawn one by one into a 2D canvas (headless tabs don't run rAF)
  const cols = +(Q.get('cols') || 4), rows = Math.ceil(STRIP / cols), sdt = +(Q.get('sdt') || .1), t0 = +(Q.get('t') || 1), cv = $('strip'), g = cv.getContext('2d');
  cv.width = cols * FW; cv.height = rows * FH; cv.style.width = '100vw'; cv.style.height = '100vh'; cv.style.objectFit = 'contain';
  camera.aspect = FW / FH; camera.updateProjectionMatrix(); simulateTo(t0);
  for (let k = 0; k < STRIP; k++) { if (k) { const tt = t0 + k * sdt; while (S.t + DT / 2 < tt) step(DT); if (tt - S.t > 1e-6) step(tt - S.t); }
    draw(); g.drawImage(renderer.domElement, (k % cols) * FW, Math.floor(k / cols) * FH, FW, FH);
    g.fillStyle = '#17171b'; g.fillRect((k % cols) * FW, Math.floor(k / cols) * FH, 150, 24); g.fillStyle = '#ffc21a'; g.font = '800 13px "Arial Black", Impact, sans-serif';
    g.fillText(`${k + 1} · t ${S.t.toFixed(3)} s`, (k % cols) * FW + 8, Math.floor(k / cols) * FH + 17);
    g.strokeStyle = '#17171b'; g.lineWidth = 2; g.strokeRect((k % cols) * FW + 1, Math.floor(k / cols) * FH + 1, FW - 2, FH - 2); }
  document.title = 'ready';
} else if (SHOT) { simulateTo(+(Q.get('t') || 2)); draw(); let nf = 0; const again = () => { draw(); if (++nf < 20) requestAnimationFrame(again); else document.title = 'ready'; }; requestAnimationFrame(again); setTimeout(() => { draw(); if (document.title !== 'ready') document.title = 'ready'; }, 400); }   // (redrawn on the next frames, time held: a canvas drawn only during module load came out blank in headless shots)   // (redrawn after the first composite: a canvas drawn only during module load came out blank in headless shots)
else if (BENCH) { draw(); setTimeout(() => runBench(), 50); }
else { ui(); let last = performance.now(), fps = 0, acc = 0, nf = 0;
  const loop = now => { const dtw = Math.min(.1, (now - last) / 1000); last = now; if (!S.paused) { let d = dtw * (S.slow ? .25 : 1); while (d > 1e-6) { const s = Math.min(DT, d); step(s); d -= s; } }
    if (controls.enabled) controls.update(); draw(); acc += dtw; nf++; if (acc > .5) { fps = nf / acc; acc = 0; nf = 0;
      $('stats').textContent = `${SCENES[S.scene].label} · ${S.ab} · t ${S.t.toFixed(1)} s${S.slow ? ' · 0.25×' : ''}${S.paused ? ' · paused' : ''}\n${actors.length} walkers · ${fps.toFixed(0)} fps · actors+upload ${cpuMs.toFixed(2)} ms · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1e6).toFixed(2)} M tris`; }
    requestAnimationFrame(loop); };
  requestAnimationFrame(loop); }
