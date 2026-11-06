// CLEANERS STUDIO (lane C2-cleaners-art, 2026-11-04) · the Cleaners' look and their beat for slime to art-direct, on the city's own
// walker: the cast's look (cast.js OUTFITS cleaner_visor / cleaner_mask), baked as the city bakes a walker (pedbake.js bakePeds: the
// near body on walk v2 with the cast's elbow, the mid body, the far boxes), lit with the city's day and night bundles (the anim lab's).
// Not the city: no traffic, no stage, no sim. A stand-in body (an NPC roll in lie_still), a stand-in door and a stand-in blood pool.
// URL:
//   ?mode=look&tier=near|mid|far&tod=day|night     both variants (visor, mask), each from the front and from behind three-quarter,
//                                                  at the tier's distance (near 14 m, mid 70 m, far 200 m) through a long lens
//   ?mode=beat&t=<s>[&face=visor|mask][&tod=]      the whole beat at clock t (simulated from 0 in 1/60 s steps, deterministic):
//                                                  step out of the door · bag the body · lift · carry to the door · (cut) · mop
//   ?mode=beat&set=van&beat=out|in|back&t=<s>      (C2-VAN, 2026-11-05) the van beats on the Cleaners' van (vehicles/ cleanvan),
//     [&glass=dark|driver][&face=][&tod=]          its doors driven as the stage will (setDoors(open)): out · the doors open, both step
//                                                  out of the back and walk off · in · lift, a metre of carry to the tail, bag_in · back
//                                                  · the last one in (van_in_close: the doors pulled to), then the van drives off
//   &fw=<px>&fh=<px>                               the canvas size (default the window)
// The title becomes 'ready' once the frame is drawn; window.__cl.seek(t) redraws the beat at t (the recorder steps it).
import * as THREE from 'three';
import * as CH from '../cast.js';
import { PAL } from '../style.js';
import { tierize } from '../gpu.js';
import { bakePeds } from '../pedbake.js';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../anim/cast/walk2.js';
import { gait2State, stepGait2 } from '../anim/cast/gait2.js';
import { stepIdle } from '../anim/cast/idle.js';
import { ELBOW } from '../anim/cast/elbow/styles.js';
import { playClip, stopClip, stepClip, clearClip } from '../anim/cast/clips/index.js';
import { BODY, LIFT, CARRY_GAP, VAN_MARKS } from '../anim/cast/clips/cleaners.js';
import { CLIP } from '../anim/cast/clips/index.js';
import { vehicleMesh } from '../vehicles/three.js';
import { cleanersGeometry } from '../anim/cast/clips/cleaners-props.js';

const Q = new URLSearchParams(location.search), MODE = Q.get('mode') || 'beat', SET = Q.get('set') || 'door', NIGHT = Q.get('tod') === 'night', TIER = Q.get('tier') || 'near';
const FW = +(Q.get('fw') || innerWidth), FH = +(Q.get('fh') || innerHeight);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(FW, FH); document.body.prepend(renderer.domElement);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, FW / FH, .05, 1200);
// the city's sun and fill (the anim lab's: 0xfff2dc × 3.0, hemi 0xd6ecff / 0xe0cfb0 × 1.05) and its night bundle (render/lighting.js 'night')
const sun = new THREE.DirectionalLight(0xfff2dc, 3), hemi = new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05); sun.castShadow = true; sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target, hemi); scene.background = new THREE.Color(PAL.horizon);
if (NIGHT) { sun.color.set(0x8fa4ff); sun.intensity = .35; hemi.color.set(0x4050a0); hemi.groundColor.set(0x201830); hemi.intensity = .5; renderer.toneMappingExposure = 1.25; scene.background = new THREE.Color(PAL.nightTop); }
const aimSun = (c, r) => { const d = new THREE.Vector3(-.52, .74, .42).normalize(); sun.target.position.copy(c); sun.position.copy(c).addScaledVector(d, 80); Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 }); sun.shadow.camera.updateProjectionMatrix(); };
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o });
const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = true; scene.add(b); return b; };
box(800, .02, 800, 0, -.01, 0, mat(PAL.asphalt, { roughness: .95 }));
const cap = t => { document.getElementById('cap').textContent = t; };

// ── the looks: both variants over one NPC roll (the roll decides only what the hood covers), and the stand-in body (a plain NPC roll)
const looks = [CH.rollLook(0xc1ea, { pool: 'npc', wear: CH.OUTFITS.cleaner_visor }), CH.rollLook(0xc1ea, { pool: 'npc', wear: CH.OUTFITS.cleaner_mask }), CH.rollLook(0x5eed11, { pool: 'npc' })];
let li = 0; const { looks: L } = bakePeds({ n: looks.length, pool: 'npc' }, { ...CH, rollLook: () => looks[li++] }, THREE);
const geoFull = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(t.K instanceof Float32Array ? t.K : new Float32Array(t.K), 1)); if (t.SL) g.setAttribute('aSlab', new THREE.BufferAttribute(new Float32Array(t.SL), 1)); g.setIndex(new THREE.BufferAttribute(t.I, 1)); return g; };
const geoMid = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true)); g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true)); g.setIndex(new THREE.BufferAttribute(t.I, 1)); return g; };
// the far body: peds.js farGeo verbatim (legs · torso · head boxes in the look's three main colours)
const BOXES = [[.24, .46, .48, .3], [.72, .56, .5, .36], [1.28, .8, .66, .74]];
const geoFar = main => { const P = [], N = [], C = [], I = [], c = new THREE.Color();
  BOXES.forEach(([y, w, h, d], q) => { const g = new THREE.BoxGeometry(w, h, d).translate(0, y, 0), p = g.attributes.position.array, n = g.attributes.normal.array, o = P.length / 3; c.setHex(main[q], THREE.SRGBColorSpace);
    for (let k = 0; k < p.length; k++) { P.push(p[k]); N.push(n[k]); } for (let k = 0; k < p.length / 3; k++) C.push(c.r, c.g, c.b); for (const i of g.index.array) I.push(i + o); g.dispose(); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g; };

// ── the near tier: one BatchedMesh on the cast's walker material (walk v2, the elbow compiled in), the animation texture per instance
const CAP = 8, tex = createAnimTexture2(CAP), [uni, G] = animUniforms2(tex, WALK2, { turnLean: .09 });
const nearMat = installAnim2(tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }), uni, { elbow: ELBOW });
const depth = installAnim2(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uni, { elbow: ELBOW });
const FG = L.map(l => geoFull(l.full)), VN = FG.reduce((s, g) => s + g.attributes.position.count, 0), IN = FG.reduce((s, g) => s + g.index.count, 0);
const near = new THREE.BatchedMesh(CAP, VN, IN, nearMat); near.customDepthMaterial = depth; near.castShadow = near.receiveShadow = true; near.sortObjects = false; near.frustumCulled = false;
const ids = FG.map(g => near.addGeometry(g)); for (let k = 0; k < CAP; k++) { near.addInstance(ids[0]); near.setVisibleAt(k, false); } scene.add(near);
const midMat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), { vmat: true }), farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 });
const MG = L.map(l => geoMid(l.mid)), FARG = L.map(l => geoFar(l.main));
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 });
const M4 = new THREE.Matrix4(), QN = new THREE.Quaternion(), V3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0);
const worldOf = a => M4.compose(V3.set(a.x, 0, a.z), QN.setFromAxisAngle(YA, a.yaw), ONE);
const actor = (look, x, z, yaw) => ({ look, x, z, yaw, g: gait2State({}), hide: false });
function drawNear(actors) { const data = tex.image.data; let k = 0;
  for (const a of actors) { if (a.hide) continue; near.setGeometryIdAt(k, ids[a.look]); near.setMatrixAt(k, worldOf(a)); near.setVisibleAt(k, true); writeGait2(data, CAP, k, a.g); k++; }
  for (let j = k; j < CAP; j++) near.setVisibleAt(j, false); tex.needsUpdate = true; }
// a clip's prop (the PLAYING clip's, shown at weight ≥ 0.6: the city's rule, CLIPS.md § Refine), in the walker's world frame
const PROPS = new Map();
function propMesh(key, id) { let m = PROPS.get(key); if (!m) { m = new THREE.Mesh(cleanersGeometry(THREE, id), propMat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); PROPS.set(key, m); } return m; }
function drawProps(actors) { for (const [k, m] of PROPS) if (k !== 'rest') m.visible = false;
  actors.forEach((a, k) => { const s = a.g.clip, P = s?.c.prop; if (!P || s.w < .6) return; const m = propMesh('a' + k + P.id, P.id); m.matrix.multiplyMatrices(worldOf(a), P.matrix(THREE, s.t, new THREE.Matrix4(), a.g)); m.matrixWorldNeedsUpdate = true; m.visible = true; }); }
const render = () => { renderer.render(scene, camera); };
const tele = (tgt, dist, yawDeg, pitchDeg, fov) => { const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180; camera.fov = fov; camera.aspect = FW / FH;
  camera.position.set(tgt[0] + dist * Math.cos(p) * Math.sin(y), tgt[1] + dist * Math.sin(p), tgt[2] + dist * Math.cos(p) * Math.cos(y)); camera.lookAt(...tgt); camera.updateProjectionMatrix(); };

// ═══ mode=look: both variants, front and back three-quarter, standing, at the tier's distance
if (MODE === 'look') {
  const sw = { near: [1, 0, 1], mid: [0, 1, 0], far: [0, 0, 1] }[TIER], D = { near: 14, mid: 70, far: 200 }[TIER];
  if (NIGHT) { const lamp = new THREE.PointLight(0xffd79a, 22 * (D / 14) ** 0, 15, 1.4); lamp.position.set(0, 4.2, 2.5); scene.add(lamp); }
  box(8, .15, 3, 0, .075, 0, mat(PAL.walk));   // a sidewalk
  const spots = [[-2.1, 0, 0], [-.7, 0, 3 * Math.PI / 4 + Math.PI], [.7, 1, 0], [2.1, 1, 3 * Math.PI / 4 + Math.PI]];
  const actors = spots.map(([x, look, yaw]) => { const a = actor(look, x, 0, yaw); a.g.idle = 0; a.g.iw = 1; return a; });
  for (const a of actors) for (let f = 0; f < 60; f++) { stepGait2(a.g, 0, 1 / 60, WALK2, G, 0); stepIdle(a.g, true, 1 / 60); }
  if (TIER === 'near') { for (const a of actors) a.y = .15; drawNear(actors.map(a => ({ ...a }))); near.position.y = .15; }
  else for (const a of actors) { const m = new THREE.Mesh(TIER === 'mid' ? MG[a.look] : FARG[a.look], TIER === 'mid' ? midMat : farMat); m.castShadow = m.receiveShadow = true; m.position.set(a.x, .15, a.z); m.rotation.y = a.yaw; scene.add(m); }
  aimSun(new THREE.Vector3(0, 0, 0), 8); tele([0, 1.0, 0], D, 20, 8, 2 * Math.atan(3.2 / D) * 180 / Math.PI);
  cap(`${TIER} tier · ${NIGHT ? 'night' : 'day'} · ${D} m · visor front, visor back ¾, respirator front, respirator back ¾`);
  render(); document.title = 'ready';
}

// ═══ mode=beat: the whole beat on a stand-in body (world: the body's walker at the origin facing +z; it lies along +x)
if (MODE === 'beat' && SET !== 'van') {
  const FACE = Q.get('face') === 'mask' ? 1 : 0;
  // the set: a sidewalk, a wall with a door at x 3.6 (the Cleaners come out of it and carry the bag back in), a lamp, the blood pool
  box(14, .02, 9, 1, .01, 0, mat(PAL.walk)); box(.4, 4, 9, 3.8 + .2, 2, 0, mat(0x8a6f5c)); box(.42, 2.2, 1.25, 3.8 + .2, 1.1, -.6, mat(0x15161a, { roughness: .6 }));
  if (NIGHT) { const lamp = new THREE.PointLight(0xffd79a, 30, 16, 1.4); lamp.position.set(1, 4.4, 2.4); scene.add(lamp); box(.14, 4.4, .14, 1, 2.2, 2.6, mat(0x1d1d24)); }
  const blood = new THREE.Mesh(new THREE.CircleGeometry(.55, 20).scale(1.5, 1, 1), new THREE.MeshStandardMaterial({ color: 0x5a0d12, roughness: .3 })); blood.rotation.x = -Math.PI / 2; blood.position.set(1.0, .025, .05); blood.receiveShadow = true; scene.add(blood);
  const restBag = propMesh('rest', 'body_bag'); restBag.visible = false;
  // where the clips put everyone (cleaners.js BODY, LIFT, CARRY_GAP): A's bag_body mark has the body at BODY.at in its frame
  const Am = { x: -BODY.at[0], z: -BODY.at[1], yaw: 0 }, Bm = { x: Am.x, z: Am.z + BODY.gap, yaw: Math.PI };
  const bagRest = { x: Am.x + .2, z: Am.z + .65 };   // (cleaners.js BB: the bag's origin in A's frame; its +x = the world's +x)
  const Al = { x: bagRest.x - LIFT.at[2], z: bagRest.z, yaw: Math.PI / 2 }, Bl = { x: Al.x + CARRY_GAP, z: Al.z, yaw: Math.PI / 2 };
  const DOOR = { x: 3.5, z: -.6 };
  const T = { out: 0, bag: 2.2, move: 7.6, lift: 9.4, carry: 11.6, cut: 13.0, end: 15.0 };
  let A, B, body, clock;
  const reset = () => { A = actor(FACE, DOOR.x, DOOR.z - .3, -Math.PI / 2); B = actor(FACE, DOOR.x, DOOR.z + .3, -Math.PI / 2); body = actor(2, 0, 0, 0); clock = 0;
    playClip(body.g, 'lie_still', { t: 0 }); stepClip(body.g, 1); };
  // a walk from where the actor is to a mark, arriving at time t1, then a turn to the mark's heading (the walk's own legs; turn by hand)
  const walkTo = (a, m, t0, t1, dt) => { const k = Math.min(1, Math.max(0, (clock - t0) / (t1 - t0 - .35))); if (clock < t0 || clock > t1 + .5) return false;
    if (a.from === undefined || a.fromT !== t0) { a.from = { x: a.x, z: a.z }; a.fromT = t0; }
    const nx = a.from.x + (m.x - a.from.x) * k, nz = a.from.z + (m.z - a.from.z) * k, d = Math.hypot(nx - a.x, nz - a.z);
    if (d > 1e-4) { const want = Math.atan2(nx - a.x, nz - a.z); a.yaw += Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw)) * Math.min(1, dt * 10); }
    else { a.yaw += Math.atan2(Math.sin(m.yaw - a.yaw), Math.cos(m.yaw - a.yaw)) * Math.min(1, dt * 8); }
    a.x = nx; a.z = nz; a.g.v = d / dt; stepGait2(a.g, d, dt, WALK2, G, 0); stepIdle(a.g, d < 1e-4, dt); return true; };
  const place = (a, m) => { a.x = m.x; a.z = m.z; a.yaw = m.yaw; };
  const clipOn = (a, dt) => { if (!a.g.clip) return; if (!a.g.clip.c.moving) a.g.w = 0; stepClip(a.g, dt); };
  const step = dt => { clock += dt;
    // the stand-in body lies still until the bag takes it (BODY.hide on bag_body's clock)
    body.hide = clock >= T.bag + BODY.hide; stepGait2(body.g, 0, dt, WALK2, G, 0); stepClip(body.g, dt);
    if (clock < T.bag) { walkTo(A, Am, T.out, T.bag, dt); walkTo(B, Bm, T.out + .15, T.bag, dt); }
    if (clock >= T.bag && !A.bb) { A.bb = B.bb = 1; place(A, Am); place(B, Bm); playClip(A.g, 'bag_body', { t: clock - T.bag }); playClip(B.g, 'bag_body_b', { t: clock - T.bag }); }
    if (clock >= T.move && !A.mv) { A.mv = 1; stopClip(A.g); stopClip(B.g); }
    if (clock >= T.move && clock < T.lift) { walkTo(A, Al, T.move, T.lift, dt); walkTo(B, Bl, T.move, T.lift, dt); }
    if (clock >= T.lift && !A.lf) { A.lf = 1; place(A, Al); place(B, Bl); for (const a of [A, B]) clearClip(a.g);
      playClip(A.g, 'bag_lift', { t: clock - T.lift }); playClip(B.g, 'bag_lift_front', { t: clock - T.lift }); }
    // the carry: the walkers moved at the clip's speed along their heading, both gaits stepped alike (in step: the same u)
    if (A.g.clip?.c.moving) for (const a of [A, B]) { const v = a.g.clip.c.speed, d = v * dt; a.x += Math.sin(a.yaw) * d; a.z += Math.cos(a.yaw) * d; a.g.v = v; stepGait2(a.g, d, dt, WALK2, G, 0); }
    for (const a of [A, B]) clipOn(a, dt);
    restBag.visible = clock >= T.move && clock < T.lift + .3;
    if (restBag.visible) restBag.matrix.compose(V3.set(bagRest.x, 0, bagRest.z), QN.identity(), ONE), restBag.matrixWorldNeedsUpdate = true;
    // the cut: later, B back out alone with the mop at the blood
    if (clock >= T.cut && !A.cutDone) { A.cutDone = 1; A.hide = true; clearClip(B.g); B.x = 1.0; B.z = -.75; B.yaw = 0; playClip(B.g, 'mop', { t: 0 }); }
    if (clock >= T.cut) B.hide = false;
  };
  const draw = () => { const acts = [A, B, body]; drawNear(acts); drawProps(acts.map(a => a.hide ? { g: {} } : a));
    if (clock >= T.lift + .3 || clock < T.move) restBag.visible = false;
    if (clock >= T.cut) blood.scale.setScalar(Math.max(.35, 1 - .25 * (clock - T.cut)));
    cap(clock < T.bag ? 'step out' : clock < T.move ? 'bag the body' : clock < T.lift ? 'take the ends' : clock < T.carry ? 'lift' : clock < T.cut ? 'carry it in' : 'later · mop');
    render(); };
  aimSun(new THREE.Vector3(1, 0, 0), 10); tele([1.2, .35, -.35], 8.2, -62, 47, 38);
  window.__cl = { seek(t) { if (t < clock) reset(); while (clock + 1e-9 < t) step(1 / 60); draw(); return clock; } };
  reset(); window.__cl.seek(+(Q.get('t') || 0)); document.title = 'ready';
}

// ═══ mode=beat&set=van (C2-VAN): the van beats. World: the van parked facing +x, its tail's face at x = TAIL, its middle on z 0; the
// crew in line with the doorway's middle (z 0). The doors are the stage's (setDoors), the clips' own `doors(t)` when one asks.
if (MODE === 'beat' && SET === 'van') {
  const FACE = Q.get('face') === 'mask' ? 1 : 0, BEAT = Q.get('beat') || 'in', GLASS = Q.get('glass') === 'driver' ? 1 : 0;
  const vmat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), { vmat: true });
  const van = vehicleMesh('cleanvan', { variant: GLASS, lights: NIGHT, driver: true, night: NIGHT }, vmat), TAIL = 3.87, D = van.userData.spec.doors;
  van.rotation.y = Math.PI / 2; scene.add(van);
  const vanAt = x => { van.position.set(x + 2.2, 0, 0); };
  // the sidewalk beyond the van's +z side: the van stopped in the travel lane, double-parked (the kerb 1.7 m off its side)
  box(30, .15, 4, 1, .075, 4.6, mat(PAL.walk));
  for (let x = -10; x < 14; x += 3) box(1.5, .012, .14, x, .006, -2.4, mat(0xf3e9c2));   // the lane line
  if (NIGHT) { const lamp = new THREE.PointLight(0xffd79a, 34, 18, 1.4); lamp.position.set(2, 4.6, 2.6); scene.add(lamp); box(.14, 4.6, .14, 2, 2.3, 2.6, mat(0x1d1d24)); }
  const restBag = propMesh('rest', 'body_bag'); restBag.visible = false;
  const clipOn = (a, dt) => { if (!a.g.clip) return; if (!a.g.clip.c.moving) a.g.w = 0; stepClip(a.g, dt); };
  // a walk along a straight line at 1 m/s from where the actor is (the walk's own legs; the gait stepped by the distance)
  const walkOn = (a, yaw, v, dt) => { const d = v * dt; a.yaw = yaw; a.x += Math.sin(yaw) * d; a.z += Math.cos(yaw) * d; a.g.v = v; stepGait2(a.g, d, dt, WALK2, G, 0); stepIdle(a.g, false, dt); };
  const stand = (a, dt) => { a.g.v = 0; stepGait2(a.g, 0, dt, WALK2, G, 0); stepIdle(a.g, true, dt); };
  const applyShift = (a, s) => { if (!s?.shiftNow) return; const [x, z] = s.shiftNow; a.x += x * Math.cos(a.yaw) + z * Math.sin(a.yaw); a.z += -x * Math.sin(a.yaw) + z * Math.cos(a.yaw); };
  let A, B, clock, open, vx, vv, ended;
  const S = {
    // the doors open (0–0.7 s); both stand in the bay meanwhile (the clips' first pose, held), step out from 0.75, then walk off
    out: { dur: 6.2, reset() { open = 0; B = actor(FACE, TAIL + VAN_MARKS.out.lip, 0, -Math.PI / 2); A = actor(FACE, B.x + VAN_MARKS.out.back, 0, -Math.PI / 2);
        playClip(A.g, 'van_step_down_back', { t: 0, snap: true }); playClip(B.g, 'van_step_down', { t: 0, snap: true }); A.g.w = B.g.w = 0; },
      step(dt) { open = Math.min(1, clock / .7);
        for (const a of [A, B]) { if (clock < .75) { stand(a, dt); a.g.w = 0; stepClip(a.g, 0); continue; } if (a.g.clip) { stand(a, dt); const s = stepClip(a.g, dt); a.g.w = 0; applyShift(a, s); if (s?.done) a.free = true; }
          else walkOn(a, -Math.PI / 2, 1, dt); } }, cap: () => clock < .75 ? 'the doors open' : 'out of the back' },
    // the lift (bag_lift / bag_lift_front), 1.0 m of carry to the tail, then bag_in / bag_in_front from the same frame
    in: { dur: 9.6, reset() { open = 1; A = actor(FACE, TAIL - VAN_MARKS.bag.lip - 1.0, 0, Math.PI / 2); B = actor(FACE, A.x + CARRY_GAP, 0, Math.PI / 2);
        playClip(A.g, 'bag_lift', { t: 0 }); playClip(B.g, 'bag_lift_front', { t: 0 }); A.carried = 0; },
      step(dt) { const moving = A.g.clip?.c.moving;
        if (moving) { for (const a of [A, B]) { const v = a.g.clip.c.speed, d = v * dt; a.x += d; a.g.v = v; stepGait2(a.g, d, dt, WALK2, G, 0); } A.carried += .8 * dt;
          if (A.carried >= 1.0 - 1e-9) { playClip(A.g, 'bag_in', { t: 0 }); playClip(B.g, 'bag_in_front', { t: 0 }); } }
        else for (const a of [A, B]) stand(a, dt);
        for (const a of [A, B]) { if (!a.g.clip) continue; if (!a.g.clip.c.moving) a.g.w = 0; const s = stepClip(a.g, dt); applyShift(a, s); if (s?.done && a === A) A.bagDone = clock; }
        if (A.bagDone !== undefined || (A.g.clip?.name === 'bag_in' && A.g.clip.t >= CLIP.bag_in.dur)) { A.restAt ??= { x: A.x - (CLIP.bag_in.shift[1]), z: A.z, yaw: A.yaw }; } },
      cap: () => A.g.clip?.c.moving || A.g.clip?.name?.startsWith('bag_lift') ? 'to the tail' : 'the bag in' },
    // the last one in: van_in_close (the doors as its doors(t) asks), then the van drives off (2 m/s², the wheels rolled)
    back: { dur: 7.4, reset() { open = 1; A = actor(FACE, TAIL - VAN_MARKS.in.lip, 0, Math.PI / 2); B = actor(FACE, 0, 0, 0); B.hide = true; vx = TAIL; vv = 0;
        A.restAt = { x: TAIL - VAN_MARKS.bag.lip, z: 0, yaw: Math.PI / 2 }; playClip(A.g, 'van_in_close', { t: 0 }); },
      step(dt) { stand(A, dt); const s = A.g.clip; if (s) { A.g.w = 0; open = s.c.doors ? s.c.doors(s.t) : open; stepClip(A.g, dt); if (s.t > s.c.dur + .05) { A.hide = true; A.restAt = null; } }
        if (clock > 3.9) { vv = Math.min(8, vv + 2 * dt); vx += vv * dt; van.userData.roll(vv * dt); } },
      cap: () => clock < 3.4 ? 'back in, the doors pulled to' : 'drives off' },
  }[BEAT] || null;
  if (!S) throw new Error('beat: out | in | back');
  const reset = () => { clock = 0; vx = TAIL; vv = 0; S.reset(); };
  const draw = () => { vanAt(vx); van.userData.setDoors(open); drawNear([A, B]); drawProps([A, B].map(a => a.hide ? { g: {} } : a));
    // the bag at rest in the bay after bag_in (its prop's end pose in A's start frame: the prop's own rest)
    const R = A.restAt, P = CLIP.bag_in.prop; restBag.visible = !!R && !(A.g.clip?.name === 'bag_in' && A.g.clip.w >= .6);
    if (restBag.visible) { const W = new THREE.Matrix4().compose(V3.set(R.x, 0, R.z), QN.setFromAxisAngle(YA, R.yaw), ONE); restBag.matrix.multiplyMatrices(W, P.matrix(THREE, CLIP.bag_in.dur)); restBag.matrixWorldNeedsUpdate = true; }
    cap(S.cap()); render(); };
  aimSun(new THREE.Vector3(3, 0, 0), 10);
  // the cameras: the street's three-quarter from behind the van (default) · &view=side (from the road side, level: the heights) · &view=tail (into the doorway)
  const VIEW = Q.get('view') || 'tq', cam = VIEW === 'side' ? [[TAIL - .6, .95, 0], 9, 180, 6, 36] : VIEW === 'tail' ? [[TAIL + .5, 1.0, 0], 7.5, -90, 12, 38]
    : { out: [[TAIL - .6, 1.0, 0], 10, -128, 34, 36], in: [[TAIL - .6, 1.0, 0], 10, -128, 34, 36], back: [[TAIL + 1.2, 1.0, 0], 12, -122, 30, 38] }[BEAT];
  tele(...cam);
  window.__cl = { dur: S.dur, seek(t) { if (t < clock) reset(); while (clock + 1e-9 < t) { clock += 1 / 60; S.step(1 / 60); } draw(); return clock; } };
  reset(); window.__cl.seek(+(Q.get('t') || 0)); document.title = 'ready';
}
