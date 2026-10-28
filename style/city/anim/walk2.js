// ANIM LAB · walk v2, the GPU half: rigid closed segments posed from the keyed cycle (gait2.js). One vertex shader, a few floats per
// walker (the same animation texture as v1), no CPU skeleton.
//
// Every part is a rigid piece (anim/bake.js bakeSegLooks: meshed closed, with a joint slab so a bend never opens a gap) that turns
// about its joint, like an action figure: pelvis → thigh → shin → foot; chest → arm (shoulder to hand, one piece); chest → head.
//   parts: 0 chest · 12 pelvis · 1/2 thigh · 6/7 shin · 8/9 foot · 3/4 arm · 5 head   (L = x < 0; 10/11, the forearms, merged into
//   the arm by SIMPLE ARMS, 2026-09-30: the classic toon arm swings from the shoulder only, the knee stays)
// Legs: hip, knee and foot pitch come straight from the keyed curves (16 keys per cycle, five step sizes blended; gait2.js). No IK
// at run time. The pelvis height is keyed (the dip at down, the rise at up); the pelvis yaws with the forward leg and the chest
// counter-turns with the arms; the pelvis sways over the stance foot and rolls (the swing side drops); the arms swing a few % of the
// cycle behind the legs, sweep in a little at the front (the arc) and the hand turns in a beat after the swing (overlap: the arm's
// twist trails its pitch); the head is a spring (CPU: gait2.js stepGait2).
// Standing: the idles (idle.js, unchanged) still pose the ankles, and a standing leg is solved from them exactly as in v1; the
// walk weight blends the two sets of joint ANGLES (never positions), so starting and stopping are smooth.
import * as THREE from 'three';
import { IDLE_GLSL } from './idle.js';
import { WALK2, NK, LEVELS, buildGait, R2 } from './gait2.js';
import { GRIP_GLSL, GRIP_DIV } from './grip.js';   // (held + grip: the holding arm's pose)
export { WALK2 };
export const ROWS2 = 3;
// row 0: cycle u · step size a · walk weight · speed      row 1: turn rate · head pitch spring · idle variant · idle weight
// row 2: idle clock · look yaw · head roll spring · pelvis height (keyed; CPU: gait2.js)
export function createAnimTexture2(cap) { const t = new THREE.DataTexture(new Float32Array(cap * ROWS2 * 4), cap, ROWS2, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; }
export function animUniforms2(tex, K = WALK2, shared = {}) {
  const u = { uAnim: { value: tex }, uKeys2: { value: Array.from({ length: LEVELS.length * NK }, () => new THREE.Vector4()) }, uB0: { value: new THREE.Vector4() }, uB1: { value: new THREE.Vector4() } };
  const G = setAnimUniforms2(u, K, shared); return [u, G]; }
// (re)build the key sets from the tunables and upload them; returns the gait (stepGait2 needs it)
export function setAnimUniforms2(u, K = WALK2, shared = {}) {
  const G = buildGait(K); G.sets.forEach((ks, i) => { for (let j = 0; j < NK; j++) u.uKeys2.value[i * NK + j].set(ks.H[j], ks.K[j], ks.F[j], ks.P[j]); });
  u.uB0.value.set(K.arm, K.arc, K.overlap, K.twist); u.uB1.value.set(K.sway, K.roll, K.lean, K.vRef); u.uB2 = u.uB2 || { value: new THREE.Vector4() }; u.uB2.value.set(shared.turnLean ?? .09, K.armOut ?? .05, 0, 0); return G; }
export function writeGait2(data, cap, k, g) {
  let o = k * 4; data[o] = g.u; data[o + 1] = g.a; data[o + 2] = g.w; data[o + 3] = g.v;
  o = (cap + k) * 4; data[o] = g.omega; data[o + 1] = g.hp; data[o + 2] = g.idle; data[o + 3] = g.iw;
  o = (cap * 2 + k) * 4; data[o] = g.it; data[o + 1] = g.look; data[o + 2] = g.hr; data[o + 3] = g.py; }

export const ANIM2_GLSL = /* glsl */`
attribute float aPart; uniform highp sampler2D uAnim; uniform vec4 uKeys2[${LEVELS.length * NK}]; uniform vec4 uB0, uB1, uB2;
const float A_PI = 3.14159265, A_HIPX = ${R2.hipX}, A_HIPY = ${R2.hipY}, A_HIPZ = ${R2.hipZ}, A_KNEE = ${R2.kneeY}, A_ANK = ${R2.ankY}, A_L1 = .2, A_L2 = .175, A_HEEL = ${R2.heel}, A_TOE = ${R2.toe};
const float A_SHX = .25, A_SHY = .825, A_NECK = .95;
mat3 aRX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 aRY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 aRZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
struct Pose { vec4 ank; vec2 fp; float drop, bodyX, pRoll, turnRoll; vec3 torso, head; vec2 armP, armR, ayaw, atw; };   // v1's pose (the idles write it; arms: idle.js aArmRot)
mat3 gR; vec3 gT; bool gAnimDone = false;
void aAp(mat3 M, vec3 C) { gR = M * gR; gT = C + M * (gT - C); }
vec2 aAnkle(float zg, float fp) { float c = cos(fp), s = sin(fp); vec2 r = fp >= 0. ? vec2(A_HEEL, A_ANK) : vec2(-A_TOE, A_ANK);
  return vec2(fp >= 0. ? zg - A_HEEL : zg + A_TOE, 0.) + vec2(r.x * c - r.y * s, r.x * s + r.y * c); }
void aFootRoll(inout Pose P, int side, float fp) { vec2 d = aAnkle(0., fp) - vec2(0., A_ANK); if (side == 0) { P.ank.xy += d; P.fp.x += fp; } else { P.ank.zw += d; P.fp.y += fp; } }
${IDLE_GLSL}
${GRIP_GLSL}
// the keyed leg: (hip pitch, knee, foot pitch, pelvis height) at cycle u, step size a. Catmull-Rom through ${NK} keys; the foot pitch
// is monotone (a held key stays held: the flat foot never rocks)
vec4 aKey(int i, int j) { return uKeys2[i * ${NK} + (j & ${NK - 1})]; }
vec4 aCurve(int i, float u) {
  float x = fract(u) * ${NK}.; int j = int(x); float f = x - float(j);
  vec4 p0 = aKey(i, j + ${NK - 1}), p1 = aKey(i, j), p2 = aKey(i, j + 1), p3 = aKey(i, j + 2), m1 = .5 * (p2 - p0), m2 = .5 * (p3 - p1);
  float d0 = p1.z - p0.z, d1 = p2.z - p1.z, d2 = p3.z - p2.z;
  m1.z = d0 * d1 <= 0. ? 0. : sign(m1.z) * min(abs(m1.z), 3. * min(abs(d0), abs(d1))); m2.z = d1 * d2 <= 0. ? 0. : sign(m2.z) * min(abs(m2.z), 3. * min(abs(d1), abs(d2)));
  float f2 = f * f, f3 = f2 * f; return (2. * f3 - 3. * f2 + 1.) * p1 + (f3 - 2. * f2 + f) * m1 + (-2. * f3 + 3. * f2) * p2 + (f3 - f2) * m2; }
vec4 aLeg2(float a, float u) { float x = clamp((a - ${LEVELS[0]}) / ${(LEVELS[1] - LEVELS[0]).toFixed(4)}, 0., ${LEVELS.length - 1}.9999 - 1.); int i = int(x); return mix(aCurve(i, u), aCurve(i + 1, u), x - float(i)); }
void animCompute() {
  if (gAnimDone) return; gAnimDone = true; gR = mat3(1.); gT = vec3(0.);
#ifdef USE_BATCHING
  int id = int(getIndirectIndex(gl_DrawID));
#else
  int id = 0;
#endif
  vec4 A0 = texelFetch(uAnim, ivec2(id, 0), 0), A1 = texelFetch(uAnim, ivec2(id, 1), 0), A2 = texelFetch(uAnim, ivec2(id, 2), 0);
  int part = int(aPart + .5), grip = int((aPart - float(part)) * ${GRIP_DIV}. + .5); aGrip = grip; float u = A0.x, a = A0.y, w = A0.z, v = A0.w, T = 2. * A_PI;
  Pose P; P.ank = vec4(0., A_ANK, 0., A_ANK); P.fp = vec2(0.); P.drop = 0.; P.bodyX = 0.; P.pRoll = 0.; P.turnRoll = 0.; P.torso = vec3(0.); P.head = vec3(0.); P.armP = vec2(0.); P.armR = vec2(.04); P.ayaw = vec2(0.); P.atw = vec2(0.);
  // the walk's body (sinusoids at the stride's rhythm: pendulums; the legs are the keyed part)
  float wa = w * a, st = cos(T * (u - .27)), lag = uB0.z;
  P.bodyX -= uB1.x * st * wa;                                          // sway over the stance foot
  float wRoll = -uB1.y * st * wa;                                      // the swing side drops (visual only: the hip joints stay level)
  float pYaw = uB0.w * cos(T * u) * wa, cYaw = -.85 * uB0.w * cos(T * (u - lag)) * wa;   // hips turn with the forward leg; the chest counters
  float sw = cos(T * (u - lag)), fw = cos(T * (u - lag * 1.6));      // the arms trail the legs; the hand's turn trails the arm (overlap)
  vec2 fr = max(vec2(-sw, sw), 0.);                                     // each arm's share of the front of its swing
  P.armP += vec2(-sw, sw) * uB0.x * wa + vec2(.04) * wa; P.armR += vec2(uB2.y) * w + .25 * uB0.y * fr * fr * wa;   // (WALK2.armOut; a touch forward, out at the front)
  P.ayaw += uB0.y * fr * fr * wa; P.atw += uB0.y * (.3 + .7 * max(vec2(-fw, fw), 0.)) * wa;   // the arc: in across the front; the hand turns in, late
  P.torso.x += uB1.z * clamp(v / uB1.w, 0., 1.6) * w; P.torso.y += cYaw;
  P.head.y -= cYaw; P.head.x -= .5 * P.torso.x * w;                    // the head keeps looking ahead, and level
  int iv = gripIdle(grip, int(A1.z + .5)); idlePose(P, iv, A2.x, A1.w * (1. - w), A2.y);
  gripPose(P, grip, u, lag, uB0.x * wa, uB2.y * w, iv, A1.w * (1. - w));   // (grip.js: the holding arm)
  P.head.x += A1.y; P.head.z += A2.z; P.head.y += clamp(.2 * A1.x, -.45, .45);   // the head's springs; it leads a turn
  P.turnRoll = clamp(-uB2.x * A1.x * v, -.3, .3);
  // standing: v1's pelvis (as high as both posed ankles allow) and legs
  float R = (A_L1 + A_L2) * .998, sr = sin(P.pRoll) * A_HIPX;
  float hL = P.ank.y + sqrt(max(R * R - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + sr, hR = P.ank.w + sqrt(max(R * R - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - sr;
  float top = A_HIPY - P.drop, hipS = min(top, min(hL, hR)), hip = mix(hipS, A2.w - P.drop, w);   // walking: the keyed pelvis height (CPU reads it off a table: only leg vertices touch the curves)
  if (part == 1 || part == 2 || part >= 6 && part <= 9) {
    float sx = part == 1 || part == 6 || part == 8 ? -1. : 1.;
    vec3 hipRest = vec3(sx * A_HIPX, A_HIPY, A_HIPZ), hipNow = vec3(P.bodyX, hip, A_HIPZ) + aRZ(P.pRoll) * aRY(pYaw) * vec3(sx * A_HIPX, 0., 0.);
    vec3 ang = vec3(0.); float roll = 0.;
    if (w < .999) {   // v1's standing leg, from the idle's ankle (only while not fully walking)
      vec2 ank = sx < 0. ? P.ank.xy : P.ank.zw; float fp = sx < 0. ? P.fp.x : P.fp.y;
      vec3 d = vec3(sx * A_HIPX, ank.y, A_HIPZ + ank.x) - hipNow; roll = atan(d.x, -d.y); float dy = -sqrt(d.y * d.y + d.x * d.x);
      float D = clamp(length(vec2(d.z, dy)), .05, A_L1 + A_L2 - 1e-4), th = atan(d.z, -dy) + acos(clamp((A_L1 * A_L1 + D * D - A_L2 * A_L2) / (2. * A_L1 * D), -1., 1.));
      float bend = A_PI - acos(clamp((A_L1 * A_L1 + A_L2 * A_L2 - D * D) / (2. * A_L1 * A_L2), -1., 1.)); ang = vec3(th, bend, fp); }
    vec4 k = aLeg2(a, sx < 0. ? u : u + .5);
    ang = mix(ang, k.xyz, w); roll = mix(roll, atan(-P.bodyX, max(.2, hip - A_ANK)), w);   // walking: the leg leans so the foot keeps its lane under the swaying pelvis
    if (part >= 8) aAp(aRX(ang.x - ang.y - ang.z), vec3(0., A_ANK, A_HIPZ));
    if (part >= 6) aAp(aRX(ang.y), vec3(0., A_KNEE, A_HIPZ));
    aAp(aRX(-ang.x), hipRest); mat3 Mr = aRZ(roll); gR = Mr * gR; gT = hipNow + Mr * (gT - hipRest);
  } else {
    if (part == 3 || part == 4) { float sx = part == 3 ? -1. : 1.; aAp(aArmRot(P, sx), vec3(sx * A_SHX, A_SHY, 0.)); }   // (one piece, from the shoulder)
    else if (part == 5) aAp(aRY(P.head.y) * aRX(P.head.x) * aRZ(P.head.z), vec3(0., A_NECK, 0.));
    bool pel = part == 12;   // the pelvis: the chest's frame, but it turns with the hips and rolls fully
    mat3 M = aRZ(P.torso.z + .5 * P.pRoll + (pel ? 1. : .4) * wRoll) * aRX(P.torso.x) * aRY(P.torso.y + (pel ? pYaw - cYaw : 0.)); vec3 pc = vec3(0., A_HIPY, A_HIPZ);
    gR = M * gR; gT = vec3(P.bodyX, hip, A_HIPZ) + M * (gT - pc);
  }
  mat3 Mt = aRZ(P.turnRoll); gR = Mt * gR; gT = Mt * gT;
}`;
// three material → animated with v2 (chains the material's own onBeforeCompile, e.g. gpu.js tierize)
export function installAnim2(mat, uniforms) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <batching_pars_vertex>', '#include <batching_pars_vertex>\n' + ANIM2_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  animCompute(); transformed = gR * transformed + gT;');
    if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  animCompute(); objectNormal = gR * objectNormal;'); };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|anim-v2';
  return mat;
}
