// MAINLAND WALK · STRIDE (2026-10-06): the walker's RUN and JUMP, on the city cast's rig and walk (anim/cast: gait2's keyed cycle, walk2's
// vertex shader), without touching them (anim/cast is synced from ai-city-fresh; this file is the Mainland's own):
//   - RUN: a keyed run cycle in the walk's style: 16 keys of hip pitch, knee, foot pitch and pelvis height, the planted foot SOLVED once
//     (not per frame) so it holds its spot, then a flight. It blends in from the walk by speed (run weight r): the legs mix the two key
//     sets, the cadence follows the blend (gait.scale), the pelvis takes the run's bounce, and the body leans and pumps the arms.
//   - JUMP: a crouch before take-off (anticipation), a stretch on the way up, the legs tucked in the air, a landing squash (a damped
//     spring on the crouch, kicked by the landing speed) and a puff of voxel dust where you land.
// installStride(material, uniforms) chains after walk2's installAnim2 and edits its shader at four asserted anchors (a sync that changes
// them fails loudly here instead of silently dropping the run). Plain numbers in, the gait state and two uniforms out.
import * as THREE from 'three';
import { NK, R2, curve, fk, ik2, level } from '../anim/cast/gait2.js';

export const RUN = {
  stride: .68,    // step length at the run (m; one foot to the other: the cycle is two)
  stance: 5,      // keys of 16 the foot is planted (5/16 = 31 %: the rest of the half cycle is the flight)
  reach: .15,     // where the ankle lands ahead of the hip (m)
  hip: .47,       // the pelvis (hip joints) at contact (m; the cast stands at .5)
  sink: .025,     // the pelvis sinks this far at mid-stance (m)
  float: .03,     // and rises this far in the flight (m)
  toeOff: .78,    // heel up at toe-off (rad)
  lean: .13,      // forward lean on top of the walk's (rad)
  arm: .42,       // extra arm swing each way (rad): the pump
  armFwd: .22,    // the arms carried forward (rad)
  sway: .65,      // share of the walk's side sway the run drops
};
// the swing leg's poses (hip pitch, knee, foot pitch), keys stance+1 … 13: the kick back, the fold, the knee up, the reach
const SWING = [[-.4, 1.3, -.95], [-.1, 1.95, -.7], [.28, 2.15, -.4], [.66, 2.0, -.2], [.95, 1.65, -.1], [1.02, 1.12, 0], [.86, .62, .06], [.62, .36, .1]];

const soleOff = (F, heel) => { const c = Math.cos(F), s = Math.sin(F); return heel ? [-R2.ankY * c - R2.heel * s, R2.ankY * s - R2.heel * c] : [-R2.ankY * c + R2.toe * s, R2.ankY * s + R2.toe * c]; };
const T = R2.hipY - R2.ankY;   // hip to ankle, straight
// the run's key set: { H, K, F, P, D } at NK keys (the left leg; the right is half a cycle on), P the pelvis (period ½)
export function buildRunKeys(R = RUN) {
  const D = 2 * R.stride, ts = R.stance, H = [], K = [], F = [], P = [];
  // the pelvis over half a cycle (8 keys): contact, sinking to mid-stance, back up by toe-off, the flight's top, down to the next contact
  const Pc = R.hip, P8 = [Pc, Pc - R.sink * .7, Pc - R.sink, Pc - R.sink * .55, Pc - .005, Pc + R.float * .8, Pc + R.float, Pc + R.float * .45];
  for (let j = 0; j < NK; j++) P[j] = P8[j % 8];
  // the stance: the heel down at contact (toe a touch up), flat, then the heel rises about the toe to toe-off. The planted point (the
  // heel while the foot pitch is ≥ 0, else the toe) moves back under the hip D/NK per key: it holds its spot on the ground
  for (let j = 0; j <= ts; j++) { const f = j / ts, Fj = f < .45 ? .07 * Math.max(0, 1 - f / .25) : -R.toeOff * Math.pow((f - .45) / .55, 1.25), heel = Fj >= 0;
    const zP = R.reach + (heel ? -R2.heel : R2.toe) - D * j / NK, [oy, oz] = soleOff(Fj, heel), ay = -oy, az = zP - oz;
    F[j] = Fj; const reach = Math.sqrt(Math.max(0, (T - .004) ** 2 - az * az)) + ay; if (P[j] > reach) { P[j] = reach; P[(j + 8) % NK] = reach; }
    const [h, k] = ik2(ay - P[j], az); H[j] = h; K[j] = Math.max(0, k); }
  // the swing, keyed; the last two keys come down onto the contact, the foot still drawing back
  for (let j = ts + 1, k = 0; j < NK; j++, k++) { const s = SWING[Math.min(k, SWING.length - 1)]; H[j] = s[0]; K[j] = s[1]; F[j] = s[2]; }
  for (const [j, dz, up] of [[NK - 2, .1, .07], [NK - 1, .04, .025]]) { const [h, k] = ik2(R2.ankY + up - P[j], R.reach + dz); H[j] = h; K[j] = Math.max(0, k); F[j] = .08; }
  return { H, K, F, P, D };
}
// checks (node): the planted toe/heel drift over the stance and the lowest sole point over the cycle (both legs, the curves as the GPU runs them)
export function checkRunKeys(RK, ts = RUN.stance) { let lowest = 1, drift = 0, ref = {}; const o = {};
  for (let q = 0; q <= 800; q++) { const u = q / 800, P = curve(RK.P, u);
    for (const ph of [0, .5]) { const v = (u + ph) % 1, f = fk(curve(RK.H, v), Math.max(0, curve(RK.K, v)), curve(RK.F, v, true), o); lowest = Math.min(lowest, f.low + P); }
    if (u <= ts / NK) { const F = curve(RK.F, u, true), f = fk(curve(RK.H, u), Math.max(0, curve(RK.K, u)), F, o), heel = F >= 0, zw = (heel ? f.hz : f.tz) + RK.D * u, key = heel ? 'h' : 't';
      if (ref[key] === undefined) ref[key] = zw; drift = Math.max(drift, Math.abs(zw - ref[key]), Math.abs((heel ? f.hy : f.ty) + P)); } }
  return { lowest: +lowest.toFixed(3), drift: +drift.toFixed(3) }; }

// GLSL: the run's leg (Catmull-Rom through its 16 keys, the foot pitch monotone, as walk2's aCurve) and the stride uniforms
const DECL = /* glsl */`
uniform vec4 uRunKeys[${NK}]; uniform vec4 uStride;   // stride.js: x run weight · y crouch (m) · z air tuck · w the tucked leg (±1)
vec4 sRunLeg(float u) {
  float x = fract(u) * ${NK}.; int j = int(x); float f = x - float(j);
  vec4 p0 = uRunKeys[(j + ${NK - 1}) & ${NK - 1}], p1 = uRunKeys[j & ${NK - 1}], p2 = uRunKeys[(j + 1) & ${NK - 1}], p3 = uRunKeys[(j + 2) & ${NK - 1}], m1 = .5 * (p2 - p0), m2 = .5 * (p3 - p1);
  float d0 = p1.z - p0.z, d1 = p2.z - p1.z, d2 = p3.z - p2.z;
  m1.z = d0 * d1 <= 0. ? 0. : sign(m1.z) * min(abs(m1.z), 3. * min(abs(d0), abs(d1))); m2.z = d1 * d2 <= 0. ? 0. : sign(m2.z) * min(abs(m2.z), 3. * min(abs(d1), abs(d2)));
  float f2 = f * f, f3 = f2 * f; return (2. * f3 - 3. * f2 + 1.) * p1 + (f3 - 2. * f2 + f) * m1 + (-2. * f3 + 3. * f2) * p2 + (f3 - f2) * m2; }
void animCompute() {`;
const EDITS = (R) => [
  ['void animCompute() {', DECL],
  // the body: the run's lean, the arm pump, less side sway; in the air the arms lift; a crouch tips the chest forward
  ['  int iv = gripIdle(', `  float sRw = uStride.x * w; P.torso.x += ${R.lean.toFixed(3)} * sRw + .9 * uStride.y; P.head.x -= .5 * ${R.lean.toFixed(3)} * sRw;
  P.armP += vec2(-sw, sw) * ${R.arm.toFixed(3)} * sRw + vec2(${R.armFwd.toFixed(3)}) * sRw + vec2(.3, -.12) * uStride.z; P.armR += vec2(.1) * sRw + vec2(.38) * uStride.z;
  P.bodyX += ${R.sway.toFixed(3)} * uB1.x * st * wa * uStride.x;
  int iv = gripIdle(`],
  // the crouch lowers the pelvis (a standing leg bends by its own solve; a keyed one by the bend below)
  ['hip = mix(hipS, A2.w - P.drop, w);', 'hip = mix(hipS, A2.w - P.drop, w) - uStride.y;'],
  ['    vec4 k = aLeg2(a, sx < 0. ? u : u + .5);', `    vec4 k = aLeg2(a, sx < 0. ? u : u + .5);
    if (uStride.x > 0.) k = mix(k, sRunLeg(sx < 0. ? u : u + .5), uStride.x);
    float sCb = acos(clamp(1. - uStride.y / (A_L1 + A_L2), 0., 1.)); k.x += sCb; k.y += 2. * sCb;`],
  ['    ang = mix(ang, k.xyz, w);', `    ang = mix(ang, k.xyz, w);
    ang = mix(ang, sx * uStride.w < 0. ? vec3(1.0, 1.75, -.4) : vec3(.3, 1.15, -.2), uStride.z);`],
];
export function installStride(mat, uniforms, R = RUN) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat), RK = buildRunKeys(R);
  uniforms.uRunKeys = { value: Array.from({ length: NK }, (_, j) => new THREE.Vector4(RK.H[j], RK.K[j], RK.F[j], RK.P[j])) };
  uniforms.uStride = { value: new THREE.Vector4(0, 0, 0, 1) };
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, uniforms);
    for (const [at, to] of EDITS(R)) { if (!sh.vertexShader.includes(at)) throw new Error('stride.js: the cast walk shader changed (no "' + at.trim() + '")'); sh.vertexShader = sh.vertexShader.replace(at, to); } };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|stride';
  return RK;
}

// ── per frame (CPU): the run blend, the jump's springs, the dust
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const JUMP = { antic: .075, crouch: .075, land: .5, stretch: .02, tuckIn: .14 };
export function strideState() { return { r: 0, c: 0, cv: 0, tuck: 0, tuckLeg: 1, antic: 0, air: 0, sq: 1 }; }
// before stepGait2: the run weight from the ground speed (walkV → runV) and the cadence it sets (gait.scale)
export function preStride(st, g, G, RK, speed, walkV, runV, dt) {
  const want = smooth(walkV * 1.08, runV * .92, speed); st.r += (want - st.r) * (1 - Math.pow(2, -dt / .09));
  const [i, f] = level(g.a), Lw = G.D[i] * (1 - f) + G.D[i + 1] * f; g.scale = 1 + st.r * (RK.D / Lw - 1); }
// after stepGait2: the pelvis takes the run's bounce; the crouch spring, the tuck; returns the body's squash (y scale)
export function postStride(st, g, RK, dt, air) {
  if (st.r > .001) g.py += (curve(RK.P, g.u) - g.py) * st.r;
  if (st.antic > 0) st.antic = Math.max(0, st.antic - dt);
  const target = st.antic > 0 ? JUMP.crouch : 0, k = st.antic > 0 ? 900 : 380, d = st.antic > 0 ? 2 * Math.sqrt(k) : 1.35 * Math.sqrt(k);   // the anticipation: stiff and quick; the landing: a little give
  st.cv += (-k * (st.c - target) - d * st.cv) * dt; st.c += st.cv * dt; st.c = Math.max(-.02, Math.min(.12, st.c));
  // the tuck: in over the first part of a jump, out before the ground (the legs reach for it)
  const tt = air && air.jump ? (air.h > .22 || air.vy > 0 ? smooth(0, JUMP.tuckIn, air.t) : 0) : 0;
  st.tuck += (tt - st.tuck) * (1 - Math.pow(2, -dt / (tt > st.tuck ? .05 : .04)));
  st.sq = 1 - st.c * 1.1 + (air ? Math.min(.07, Math.abs(air.vy) * JUMP.stretch) : 0);
  return st.sq; }
export const jumpStart = (st, g) => { st.antic = JUMP.antic; st.tuckLeg = Math.sin(2 * Math.PI * g.u) >= 0 ? 1 : -1; };
export const landed = (st, vImpact) => { st.cv += Math.min(4.5, vImpact) * JUMP.land; };
export function writeStride(uniforms, st) { const v = uniforms.uStride.value; v.x = st.r; v.y = Math.max(0, st.c); v.z = st.tuck; v.w = st.tuckLeg; }

// the dust: a few voxel puffs that spread, rise a little and shrink (one InstancedMesh, no textures)
export function makeDust(scene, n = 14) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xe9e2d2, transparent: true, opacity: .8, depthWrite: false }), n);
  mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.count = 0; mesh.renderOrder = 2; scene.add(mesh);
  const P = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, t: 1, life: 1, rot: 0 })), M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  let live = false;
  return {
    mesh,
    puff(x, y, z, k = 1) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * .4, sp = (.7 + Math.random() * .7) * k;
      Object.assign(P[i], { x: x + Math.sin(a) * .18, y: y + .04, z: z + Math.cos(a) * .18, vx: Math.sin(a) * sp, vy: (.25 + Math.random() * .35) * k, vz: Math.cos(a) * sp, s: (.06 + Math.random() * .05) * (.7 + .3 * k), t: 0, life: .38 + Math.random() * .2, rot: Math.random() * 3 }); }
      live = true; mesh.visible = true; },
    update(dt) { if (!live) return; let any = 0;
      for (let i = 0; i < n; i++) { const p = P[i]; if (p.t >= p.life) { M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); continue; } any++;
        p.t += dt; const f = Math.min(1, p.t / p.life), drag = Math.pow(.02, dt); p.vx *= drag; p.vz *= drag; p.vy *= Math.pow(.2, dt);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const s = p.s * (1 + 1.2 * f) * (1 - f * f);
        M.compose(V.set(p.x, p.y, p.z), Qn.setFromEuler(E.set(p.rot, p.rot * 1.3, 0)), S.set(s, s, s)); mesh.setMatrixAt(i, M); }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (!any) { live = false; mesh.visible = false; } },
    hide() { live = false; mesh.visible = false; },
  };
}
