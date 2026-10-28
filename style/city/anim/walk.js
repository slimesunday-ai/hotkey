// ANIM LAB · the walk that plants its feet (vertex shader + a few floats per walker; no CPU skeleton).
//
// WHY THE CITY'S WALKERS SLIDE (peds.js / pedsim.js as of 2026-09-29): the phase IS distance-driven (pedsim.js w.ph += ds × 3.1), but
// 3.1 rad/m is a 1.01 m step while a 0.5 m leg swinging ±0.6 rad sweeps its foot through only 0.56 m, so every planted foot skates
// forward ~45 cm a step; the swing is a pure sine (the foot's speed under the body never matches the ground's), the legs are
// single pieces (no knee, no foot roll), and a leg rotated about the hip lifts its foot at both ends of the stride, so at contact
// both feet hang in the air.
//
// THE NEW WALK, per walker (CPU, stepGait): phase += distance / (2 × step length) × 2π, so a foot in stance moves back under the
// body exactly as far as the body moves forward, at any speed; the step shortens when slow; a walk weight eases in and out with speed.
// Per vertex (GPU, ANIM_GLSL): each leg's cycle is stance (duty share: the foot planted, rolling heel → flat → toe) then swing (lift,
// knee bend, reach); the ankles are placed first and the legs solved with two-bone IK (thigh, shin) from the hips, and the pelvis
// height is the highest the stance legs allow, which is the double bob per cycle; the pelvis sways over the stance foot; arms
// counter-swing (one-piece arms since simple arms, 2026-09-30: a small inward arc at the front); the torso leans with speed; the big head settles a beat late (a phase lag on the
// bob + a spring on acceleration, CPU); a turn leans the body into it and the head leads (turn.js).
// Parts come from anim/bake.js (0 torso · 1/2 thigh · 3/4 arm, shoulder to hand · 5 head · 6/7 shin · 8/9 foot; L = x < 0).
// The OLD walk (mode 'old') is peds.js's shader verbatim, fed the same parts (thigh/shin/foot → leg, arm pieces → arm), for the A/B.
import * as THREE from 'three';
import { IDLE_GLSL } from './idle.js';

export const WALK = {   // the tunables (the lab's sliders; the city would bake them in as constants)
  stride: .42,    // step length (m, one foot to the other) at the reference speed; shortens to 40 % when slow
  vRef: 1.2,      // the speed the stride is set for (m/s)
  bob: 1,         // × the bob the legs need (1 = feet exactly planted; less floats the feet a little, more crouches)
  arm: .6,        // arm swing (rad each way)
  lean: .07,      // forward lean at vRef (rad; scales with speed)
  headLag: .05,   // the head's settle (rad)
  turnLean: .09,  // lean into a turn (rad per rad/s per m/s)
  turnRate: 3.2,  // max turning speed (rad/s; turn.js)
  duty: .58,      // stance share of the cycle
  lift: .11,      // swing foot lift (m)
  sway: .012,     // pelvis sway over the stance foot (m)
  heel: .16, toe: .26,   // heel-strike toe-up and toe-off heel-up (rad)
};
export const ROWS = 3;   // texels per walker in the animation texture (one column per BatchedMesh instance)
// row 0: phase · step length · walk weight · speed        row 1: turn rate · head spring · idle variant · idle weight
// row 2: idle clock · look yaw (relative) · old-walk bob · 0
export function createAnimTexture(cap) { const t = new THREE.DataTexture(new Float32Array(cap * ROWS * 4), cap, ROWS, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; }
export function animUniforms(tex, K = WALK) { const u = { uAnim: { value: tex }, uK0: { value: new THREE.Vector4() }, uK1: { value: new THREE.Vector4() }, uK2: { value: new THREE.Vector4() } }; setAnimUniforms(u, K); return u; }
export function setAnimUniforms(u, K = WALK) { u.uK0.value.set(K.bob, K.arm, K.lean, K.headLag); u.uK1.value.set(K.turnLean, K.duty, K.lift, K.sway); u.uK2.value.set(K.heel, K.toe, K.vRef, 0); }

// ── CPU: one walker's gait
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function gaitState(o = {}) { return { phase: o.phase ?? 0, L: WALK.stride, w: 0, v: 0, vPrev: 0, shuf: 0, hp: 0, hv: 0, idle: o.idle ?? 0, iw: 0, it: o.it ?? 0, look: 0, still: 0, wasStill: false, scale: o.scale ?? 1, omega: 0, oph: o.phase ?? 0, oamp: 0, obob: 0 }; }
// dist: metres moved this frame along the body's heading (≥ 0) · turn: the heading change this frame (rad; a standing walker that
// turns shuffles its feet) · K: WALK
export function stepGait(g, dist, dt, K = WALK, turn = 0) {
  if (dt <= 0) return g; const TAU = Math.PI * 2; let d = Math.max(0, dist);
  g.vPrev = g.v; g.v += (d / dt - g.v) * (1 - Math.exp(-dt / .08));
  const turning = g.v < .3 && Math.abs(turn) / dt > .6; g.shuf += ((turning ? 1 : 0) - g.shuf) * (1 - Math.exp(-dt / .1));
  if (g.shuf > .05) d += Math.abs(turn) * .2 * g.shuf;   // the feet step round as the body turns (a foot sits ~0.2 m off the centre)
  const spd = Math.max(g.v, g.shuf * .45), moving = g.v > .04 || g.shuf > .25;
  g.L = K.stride * g.scale * (.4 + .6 * smooth(0, K.vRef, spd));
  g.phase += d / (2 * g.L) * TAU; if (g.phase > 1e4) g.phase -= TAU * 1000;
  const tw = moving ? Math.min(1, .35 + spd / .35) * (g.v < .04 ? .7 : 1) : 0;
  g.w += (tw - g.w) * (1 - Math.exp(-dt / (tw > g.w ? .12 : .2)));
  const acc = (g.v - g.vPrev) / dt, G = K.headLag * .9;   // the head: a damped spring on acceleration (ζ ≈ 0.5: one small overshoot)
  g.hv += (-110 * g.hp - 11 * g.hv - acc * G) * dt; g.hp = Math.max(-.3, Math.min(.3, g.hp + g.hv * dt));
  return g;
}
// peds.js's old gait for the A/B: phase += distance × 3.1, swing amplitude min(1, v/0.6), bob |cos φ| × 0.045 × min(1, v)
export function stepOldGait(g, dist, dt) { if (dt <= 0) return g; g.v += (dist / dt - g.v) * (1 - Math.exp(-dt / .08)); g.oph += dist * 3.1; g.oamp = Math.min(1, g.v / .6); g.obob = Math.abs(Math.cos(g.oph)) * .045 * Math.min(1, g.v); return g; }
export function writeGait(data, cap, k, g) {
  let o = k * 4; data[o] = g.phase; data[o + 1] = g.L; data[o + 2] = g.w; data[o + 3] = g.v;
  o = (cap + k) * 4; data[o] = g.omega; data[o + 1] = g.hp; data[o + 2] = g.idle; data[o + 3] = g.iw;
  o = (cap * 2 + k) * 4; data[o] = g.it; data[o + 1] = g.look; data[o + 2] = 0; data[o + 3] = 0; }
export function writeOld(data, cap, k, g) { let o = k * 4; data[o] = g.oph; data[o + 1] = g.oamp; data[o + 2] = 0; data[o + 3] = g.v; o = (cap * 2 + k) * 4; data[o + 2] = g.obob; }

// ── GPU
export const ANIM_GLSL = /* glsl */`
attribute float aPart; uniform highp sampler2D uAnim; uniform vec4 uK0, uK1, uK2;
const float A_PI = 3.14159265, A_HIPX = .125, A_HIPY = .5, A_HIPZ = .025, A_KNEE = .3, A_ANK = .125, A_L1 = .2, A_L2 = .175, A_HEEL = .175, A_TOE = .275;
const float A_SHX = .25, A_SHY = .825, A_NECK = .95;
mat3 aRX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 aRY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 aRZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
struct Pose { vec4 ank; vec2 fp; float drop, bodyX, pRoll, turnRoll; vec3 torso, head; vec2 armP, armR, ayaw, atw; };   // (arms: idle.js aArmRot) ank: L (z, y), R (z, y), ankle targets rel. the hip's rest place
mat3 gR; vec3 gT; bool gAnimDone = false;
void aAp(mat3 M, vec3 C) { gR = M * gR; gT = C + M * (gT - C); }   // rotate what is posed so far about C
vec2 aAnkle(float zg, float fp) {   // the ankle of a foot whose flat ground point is zg, pitched fp (toe up +): it rolls on the heel or the toe
  float c = cos(fp), s = sin(fp); vec2 r = fp >= 0. ? vec2(A_HEEL, A_ANK) : vec2(-A_TOE, A_ANK);
  return vec2(fp >= 0. ? zg - A_HEEL : zg + A_TOE, 0.) + vec2(r.x * c - r.y * s, r.x * s + r.y * c); }
void aFootRoll(inout Pose P, int side, float fp) { vec2 d = aAnkle(0., fp) - vec2(0., A_ANK); if (side == 0) { P.ank.xy += d; P.fp.x += fp; } else { P.ank.zw += d; P.fp.y += fp; } }
void aLeg(float u, float a, out vec2 ank, out float fp) {   // u: this leg's cycle (0 heel strike) · a: half the foot's excursion
  float duty = uK1.y, hs = uK2.x, to = uK2.y;
  if (u < duty) { float t = u / duty; fp = hs * (1. - smoothstep(0., .22, t)) - to * smoothstep(.62, 1., t); ank = aAnkle(a * (1. - 2. * t), fp); }
  else { float t = (u - duty) / (1. - duty), e = t * t * (3. - 2. * t); ank = mix(aAnkle(-a, -to), aAnkle(a, hs), e) + vec2(0., uK1.z * sin(A_PI * pow(t, .75))); fp = mix(-to, hs, smoothstep(.15, .9, t)); }
}
void walkPose(inout Pose P, vec4 A0, vec4 A1) {
  float w = A0.z; if (w < .001) return;
  float a = uK1.y * A0.y, uL = fract(A0.x / (2. * A_PI)), uR = fract(uL + .5), v = A0.w; vec2 aL, aR; float fL, fR; aLeg(uL, a, aL, fL); aLeg(uR, a, aR, fR);
  P.ank = mix(P.ank, vec4(aL, aR), w); P.fp = mix(P.fp, vec2(fL, fR), w); P.drop += .008 * w;
  float st = cos(2. * A_PI * (uL - .5 * uK1.y));   // +1 at the left foot's mid-stance, −1 at the right's
  P.bodyX -= uK1.w * st * w; P.pRoll -= .045 * st * w * uK1.w / .012; P.torso.z += .02 * st * w;
  float sw = cos(2. * A_PI * (uL - .08)), ar = uK0.y * w;   // the arms counter-swing the legs, a touch late
  P.armP += vec2(-sw, sw) * ar; P.ayaw += .12 * max(vec2(-sw, sw), 0.) * w; P.armR += vec2(.05) * w;
  P.torso.y += .09 * sw * w * uK0.y / .5; P.head.y -= .09 * sw * w * uK0.y / .5;   // the shoulders turn with the arms; the head keeps looking ahead
  P.torso.x += uK0.z * clamp(v / uK2.z, 0., 1.6) * w;   // lean with speed
  P.head.x += uK0.w * w * cos(4. * A_PI * uL - 1.3) - .5 * P.torso.x * w;   // the head settles a beat after each bob (and keeps level-ish)
}
${IDLE_GLSL}
void animCompute() {
  if (gAnimDone) return; gAnimDone = true; gR = mat3(1.); gT = vec3(0.);
#ifdef USE_BATCHING
  int id = int(getIndirectIndex(gl_DrawID));
#else
  int id = 0;
#endif
  vec4 A0 = texelFetch(uAnim, ivec2(id, 0), 0), A1 = texelFetch(uAnim, ivec2(id, 1), 0), A2 = texelFetch(uAnim, ivec2(id, 2), 0);
  int part = int(aPart + .5);
#ifdef ANIM_OLD
  // peds.js's walk, verbatim: legs and arms swing about the hip / shoulder as single pieces, the bob rides the instance
  int op = part == 6 || part == 8 ? 1 : part == 7 || part == 9 ? 2 : part == 10 ? 3 : part == 11 ? 4 : part == 5 ? 0 : part;
  gT = vec3(0., A2.z, 0.); if (op == 0) return; float s = sin(A0.x) * A0.y;
  float an = op == 1 ? s * .6 : op == 2 ? -s * .6 : op == 3 ? -s * .45 : s * .45; vec3 pv = op <= 2 ? vec3(0., .5, .025) : vec3(0., .825, 0.);
  mat3 M = aRX(an); gR = M; gT = pv - M * pv + vec3(0., A2.z, 0.);
#else
  Pose P; P.ank = vec4(0., A_ANK, 0., A_ANK); P.fp = vec2(0.); P.drop = 0.; P.bodyX = 0.; P.pRoll = 0.; P.turnRoll = 0.; P.torso = vec3(0.); P.head = vec3(0.); P.armP = vec2(0.); P.armR = vec2(.04); P.ayaw = vec2(0.); P.atw = vec2(0.);
  walkPose(P, A0, A1);
  idlePose(P, int(A1.z + .5), A2.x, A1.w * (1. - A0.z), A2.y);
  P.head.x += A1.y; P.head.y += clamp(.2 * A1.x, -.45, .45);   // the head's spring; it leads a turn
  P.turnRoll = clamp(-uK1.x * A1.x * A0.w, -.3, .3);
  // the pelvis: as high as both legs reach (the bob), × the bob setting
  float R = (A_L1 + A_L2) * .998, sr = sin(P.pRoll) * A_HIPX;
  float hL = P.ank.y + sqrt(max(R * R - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + sr, hR = P.ank.w + sqrt(max(R * R - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - sr;
  float top = A_HIPY - P.drop, hip = min(top, min(hL, hR)); hip = top - (top - hip) * uK0.x;
  if (part == 1 || part == 2 || part >= 6 && part <= 9) {
    float sx = part == 1 || part == 6 || part == 8 ? -1. : 1.; vec2 ank = sx < 0. ? P.ank.xy : P.ank.zw; float fp = sx < 0. ? P.fp.x : P.fp.y;
    vec3 hipRest = vec3(sx * A_HIPX, A_HIPY, A_HIPZ), hipNow = vec3(P.bodyX, hip, A_HIPZ) + aRZ(P.pRoll) * vec3(sx * A_HIPX, 0., 0.);
    vec3 d = vec3(sx * A_HIPX, ank.y, A_HIPZ + ank.x) - hipNow; float roll = atan(d.x, -d.y), dy = -sqrt(d.y * d.y + d.x * d.x);
    float D = clamp(length(vec2(d.z, dy)), .05, A_L1 + A_L2 - 1e-4), th = atan(d.z, -dy) + acos(clamp((A_L1 * A_L1 + D * D - A_L2 * A_L2) / (2. * A_L1 * D), -1., 1.));
    float bend = A_PI - acos(clamp((A_L1 * A_L1 + A_L2 * A_L2 - D * D) / (2. * A_L1 * A_L2), -1., 1.));
    if (part >= 8) aAp(aRX(th - bend - fp), vec3(0., A_ANK, A_HIPZ));
    if (part >= 6) aAp(aRX(bend), vec3(0., A_KNEE, A_HIPZ));
    aAp(aRX(-th), hipRest); mat3 Mr = aRZ(roll); gR = Mr * gR; gT = hipNow + Mr * (gT - hipRest);
  } else {
    if (part == 3 || part == 4) { float sx = part == 3 ? -1. : 1.; aAp(aArmRot(P, sx), vec3(sx * A_SHX, A_SHY, 0.)); }   // (one piece, from the shoulder)
    else if (part == 5) aAp(aRY(P.head.y) * aRX(P.head.x) * aRZ(P.head.z), vec3(0., A_NECK, 0.));
    mat3 M = aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y); vec3 pc = vec3(0., A_HIPY, A_HIPZ); gR = M * gR; gT = vec3(P.bodyX, hip, A_HIPZ) + M * (gT - pc);
  }
  mat3 Mt = aRZ(P.turnRoll); gR = Mt * gR; gT = Mt * gT;
#endif
}`;
// three material → animated (onBeforeCompile; chains the material's own hook, e.g. gpu.js tierize). mode 'new' | 'old'.
export function installAnim(mat, uniforms, mode = 'new') {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <batching_pars_vertex>', '#include <batching_pars_vertex>\n' + (mode === 'old' ? '#define ANIM_OLD\n' : '') + ANIM_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  animCompute(); transformed = gR * transformed + gT;');
    if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  animCompute(); objectNormal = gR * objectNormal;'); };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|anim-' + mode;
  return mat;
}
