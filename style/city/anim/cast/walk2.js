// ANIM LAB · walk v2: rigid shoes and connected leg surfaces posed from the keyed cycle (gait2.js). One vertex shader, a few floats per
// walker (the same animation texture as v1), no CPU skeleton.
//
// Feet and the upper body are rigid. The leg surface has shared knee rings and a cuff that
// follows the foot at its socket; ordered cloth rings use the same keyed joint poses.
// No per-frame skeleton, extra attributes, animation texels, or draw calls are required.
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
import { CLIPS_GLSL } from './clips/index.js';   // (authored clips: robberies, falls, rides… ride the idle slot; clips/CLIPS.md)
import { ELBOW } from './elbow/styles.js';   // (the cast's elbow bend style: compiled in by default, ELBOW.md § The cast)
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
  u.uB0.value.set(K.arm, K.arc, K.overlap, K.twist); u.uB1.value.set(K.sway, K.roll, K.lean, K.vRef); u.uB2 = u.uB2 || { value: new THREE.Vector4() }; u.uB2.value.set(shared.turnLean ?? .09, K.armOut ?? .05, K.elbow ?? 0, K.elbowSwing ?? 0); return G; }
export function writeGait2(data, cap, k, g) {
  let o = k * 4; data[o] = g.u; data[o + 1] = g.a; data[o + 2] = g.w; data[o + 3] = g.v;
  o = (cap + k) * 4; data[o] = g.omega; data[o + 1] = g.hp; data[o + 2] = g.idle; data[o + 3] = g.iw;
  o = (cap * 2 + k) * 4; data[o] = g.it; data[o + 1] = g.look; data[o + 2] = g.hr; data[o + 3] = g.py; }

// o.elbow: a bend style (elbow/styles.js: { id, glsl }); default the cast's (elbow/styles.js ELBOW: 'thick'), null = no elbow (the
// arm one straight piece, as before 2026-10-08). o.lab: the elbow harness's pose hook (GLSL defining elbowLab(inout Pose P, int id)).
// With an elbow compiled in, the vertex stage reads the `normal` attribute too (a raw transform-feedback shader declares it).
export function anim2Glsl(o = {}) { const EL = o.elbow === undefined ? ELBOW : o.elbow; o = { ...o, elbow: EL }; return (o.elbow ? `#define ELBOW_STYLE ${o.elbow.id}\n` : '') + (o.lab ? '#define ELBOW_LAB\n' : '') + /* glsl */`
attribute float aPart; uniform highp sampler2D uAnim; uniform vec4 uKeys2[${LEVELS.length * NK}]; uniform vec4 uB0, uB1, uB2;
const float A_PI = 3.14159265, A_HIPX = ${R2.hipX}, A_HIPY = ${R2.hipY}, A_HIPZ = ${R2.hipZ}, A_KNEE = ${R2.kneeY}, A_ANK = ${R2.ankY}, A_L1 = .2, A_L2 = .175, A_HEEL = ${R2.heel}, A_TOE = ${R2.toe};
const float A_SHX = .25, A_SHY = .825, A_NECK = .95, A_SEAT_GAP = .00005;   // (the seat's midline: 0.05 mm each side of it)
mat3 aRX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 aRY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 aRZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
struct Pose { vec4 ank; vec2 fp; float drop, bodyX, pRoll, turnRoll; vec3 torso, head; vec2 armP, armR, ayaw, atw, elb; };   // v1's pose (the idles write it; arms: idle.js aArmRot; elb: the ELBOW, elbow/ELBOW.md)
mat3 gR; vec3 gT; bool gAnimDone = false;
void aAp(mat3 M, vec3 C) { gR = M * gR; gT = C + M * (gT - C); }
vec2 aAnkle(float zg, float fp) { float c = cos(fp), s = sin(fp); vec2 r = fp >= 0. ? vec2(A_HEEL, A_ANK) : vec2(-A_TOE, A_ANK);
  return vec2(fp >= 0. ? zg - A_HEEL : zg + A_TOE, 0.) + vec2(r.x * c - r.y * s, r.x * s + r.y * c); }
void aFootRoll(inout Pose P, int side, float fp) { vec2 d = aAnkle(0., fp) - vec2(0., A_ANK); if (side == 0) { P.ank.xy += d; P.fp.x += fp; } else { P.ank.zw += d; P.fp.y += fp; } }
${IDLE_GLSL}
${GRIP_GLSL}
${CLIPS_GLSL}
${o.elbow ? o.elbow.glsl : ''}
${o.lab || ''}
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
  Pose P; P.ank = vec4(0., A_ANK, 0., A_ANK); P.fp = vec2(0.); P.drop = 0.; P.bodyX = 0.; P.pRoll = 0.; P.turnRoll = 0.; P.torso = vec3(0.); P.head = vec3(0.); P.armP = vec2(0.); P.armR = vec2(.04); P.ayaw = vec2(0.); P.atw = vec2(0.); P.elb = vec2(0.);
  // the walk's body (sinusoids at the stride's rhythm: pendulums; the legs are the keyed part)
  float wa = w * a, st = cos(T * (u - .27)), lag = uB0.z;
  P.bodyX -= uB1.x * st * wa;                                          // sway over the stance foot
  float wRoll = -uB1.y * st * wa;                                      // the swing side drops (visual only: the hip joints stay level)
  float pYaw = uB0.w * cos(T * u) * wa, cYaw = -.85 * uB0.w * cos(T * (u - lag)) * wa;   // hips turn with the forward leg; the chest counters
  float sw = cos(T * (u - lag)), fw = cos(T * (u - lag * 1.6));      // the arms trail the legs; the hand's turn trails the arm (overlap)
  vec2 fr = max(vec2(-sw, sw), 0.);                                     // each arm's share of the front of its swing
  P.armP += vec2(-sw, sw) * uB0.x * wa + vec2(.04) * wa; P.armR += vec2(uB2.y) * w + .25 * uB0.y * fr * fr * wa;   // (WALK2.armOut; a touch forward, out at the front)
  P.ayaw += uB0.y * fr * fr * wa; P.atw += uB0.y * (.3 + .7 * max(vec2(-fw, fw), 0.)) * wa;   // the arc: in across the front; the hand turns in, late
  P.elb += vec2(uB2.z) * w + uB2.w * max(vec2(-fw, fw), 0.) * wa;   // ELBOW: a soft bend while walking, more at the front of the swing (WALK2.elbow / elbowSwing; 0 = no elbow)
  P.torso.x += uB1.z * clamp(v / uB1.w, 0., 1.6) * w; P.torso.y += cYaw;
  P.head.y -= cYaw; P.head.x -= .5 * P.torso.x * w;                    // the head keeps looking ahead, and level
  int iv = gripIdle(grip, int(A1.z + .5)); idlePose(P, iv, A2.x, A1.w * (1. - w), A2.y);
  gripPose(P, grip, u, lag, uB0.x * wa, uB2.y * w, iv, A1.w * (1. - w));   // (grip.js: the holding arm)
  clipPose(P, iv, A2.x, A1.w, u, w, A2.y);   // (a clip in the idle slot: over the walk and the hold; clips/index.js. A2.y: the look yaw, a clip's cLook)
#ifdef ELBOW_LAB
  elbowLab(P, id);   // (the elbow harness only: its fourth texture row poses the arms; elbow/lab.js)
#endif
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
    k.xy *= cLegK;   // (a clip's stride: a run's hips and knees, scaled; clips/index.js)
    ang = mix(ang, k.xyz, w); roll = mix(roll, atan(-P.bodyX, max(.2, hip - A_ANK)), w);   // walking: the leg leans so the foot keeps its lane under the swaying pelvis
    mat3 shinR = aRX(ang.y), footR = shinR * aRX(ang.x - ang.y - ang.z);
    vec3 kp = vec3(0., A_KNEE, A_HIPZ), ap = vec3(0., A_ANK, A_HIPZ);
    vec3 ankleNow = kp + shinR * (ap - kp);
    if (part >= 8) { gR = footR; gT = ankleNow - footR * ap; }
    else {
      // A short voxel leg cannot fit a tall rigid cuff and the skeletal knee at toe-off.
      // Use ordered cloth rings in the foot frame: their height is strictly increasing
      // socket -> hip; the knee supplies lateral bend. This shear is injective, so thick
      // cloth cannot fold back through itself or below the shoe's top plane.
      vec3 up = footR * vec3(0., 1., 0.), across = footR * vec3(0., 0., 1.);
      vec3 hp = vec3(0., A_HIPY, A_HIPZ);
      float socket = .20, t = (position.y - socket) / (A_HIPY - socket);
      float h = dot(hp - ankleNow, up), bk = dot(kp - ankleNow, across), bh = dot(hp - ankleNow, across);
      bool low = position.y < A_KNEE;
      float bt = low ? (position.y - socket) / (A_KNEE - socket) : (position.y - A_KNEE) / (A_HIPY - A_KNEE);
      float lateral = low ? mix(0., bk, bt) : mix(bk, bh, bt);
      float height = mix(socket - A_ANK, h, t);
      vec3 posed = ankleNow + up * height + across * (lateral + position.z - A_HIPZ); posed.x = position.x;
      float dh = (h - (socket - A_ANK)) / (A_HIPY - socket);
      float db = low ? bk / (A_KNEE - socket) : (bh - bk) / (A_HIPY - A_KNEE);
      // Per-face normals of the ring cage; gT makes this local normal frame reproduce posed.
      gR = mat3(vec3(1., 0., 0.), up, normalize(across * dh - up * db));
      gT = posed - gR * position;
    }
    aAp(aRX(-ang.x), hipRest); mat3 Mr = aRZ(roll); gR = Mr * gR; gT = hipNow + Mr * (gT - hipRest);
    // THE SEAT'S MIDLINE (2026-10-01, world/fit/leg-forms.js drawSeat): at the seat (y 8..9) each thigh grows in to the midline, so
    // there, and only there, the two legs meet: their halves' midline faces are the only leg vertices at x = 0. The legs pitch about
    // one hip axis and stay parallel to a hair, but the hips' roll and yaw swing the two hip joints in and the rolled faces tilt past
    // each other (up to 2.6 mm in the weight-shift idle, 0.45 mm in the walk). So each midline vertex slides along x onto the
    // midplane (through the two hip joints' midpoint, tilted by the legs' mean roll), A_SEAT_GAP to its own side: the halves meet on
    // one plane in every pose and never cut into each other. Moves those vertices by at most ~1.5 mm; the rest of the leg is untouched.
    if (part <= 2 && abs(position.x) < 1e-5) {
      float rS = 0.;
      if (w < .999) for (int s = 0; s < 2; s++) { float sy = s == 0 ? -1. : 1.; vec2 an = s == 0 ? P.ank.xy : P.ank.zw;
        vec3 dd = vec3(sy * A_HIPX, an.y, A_HIPZ + an.x) - (vec3(P.bodyX, hip, A_HIPZ) + aRZ(P.pRoll) * aRY(pYaw) * vec3(sy * A_HIPX, 0., 0.)); rS += .5 * atan(dd.x, -dd.y); }
      float rm = mix(rS, atan(-P.bodyX, max(.2, hip - A_ANK)), w);
      vec3 n = vec3(cos(rm), sin(rm), 0.), p = gR * position + gT;
      p.x += (sx * A_SEAT_GAP - dot(p - vec3(P.bodyX, hip, A_HIPZ), n)) / n.x; gT = p - gR * position;
    }
  } else {
    if (part == 3 || part == 4) { float sx = part == 3 ? -1. : 1.;
#ifdef ELBOW_STYLE
      // THE ELBOW (elbow/ELBOW.md): the bend style maps the rest arm to the bent rest arm (still hanging from the shoulder), then the
      // shoulder turns it as one piece, as before. e = 0 skips it: today's arm, bit for bit.
      float e = clamp(sx < 0. ? P.elb.x : P.elb.y, 0., 2.8);
      if (e > 1e-5) { float bx = ((aPart - float(part)) * ${GRIP_DIV}. - float(grip)) * 16.; int band = int(bx + .5);
        // THE HAND AND A HELD THING ride the forearm rigidly (below the cuff ring, y 9.5 = 0.475 m, and any held vertex, flag bit 2,
        // bake.js): the bend of a point behind the hinge line on its row (rigid in every style), applied to the whole vertex. Only the
        // sleeve between the cuff and the shoulder is the style's to shape: a fist or a long held thing in front of the arm is never
        // slimmed with the sleeve's padding (at 150° the mitre's bisector reaches into the fist). By position, so no two vertices that
        // share a rest point part (the held flag only on held things, whose voxels stay below the hand's top row: held-motion-check).
        bool rig = (position.y < EB_CUFF || (int(floor((bx - floor(bx + .5)) * 8. + .5)) & 2) == 2) && position.y < EB_Y - 1e-4;
        vec3 q = rig ? vec3(position.x, position.y, EB_Z - .05) : position; vec4 b = bendArm(q, rig ? vec3(0., 0., -1.) : normal, e, rig ? 0 : band); gR = aRX(b.w); gT = b.xyz - gR * q; }
#endif
      aAp(aArmRot(P, sx), vec3(sx * A_SHX, A_SHY, 0.)); }   // (one piece, from the shoulder)
    else if (part == 5) aAp(aRY(P.head.y) * aRX(P.head.x) * aRZ(P.head.z), vec3(0., A_NECK, 0.));
    bool pel = part == 12;   // the pelvis: the chest's frame, but it turns with the hips and rolls fully
    mat3 M = aRZ(P.torso.z + .5 * P.pRoll + (pel ? 1. : .4) * wRoll) * aRX(P.torso.x) * aRY(P.torso.y + (pel ? pYaw - cYaw : 0.)); vec3 pc = vec3(0., A_HIPY, A_HIPZ);
    gR = M * gR; gT = vec3(P.bodyX, hip, A_HIPZ) + M * (gT - pc);
  }
  clipRoot();   // (a clip's whole-body move: a lunge, a stumble, a fall; clips/index.js)
  mat3 Mt = aRZ(P.turnRoll); gR = Mt * gR; gT = Mt * gT;
}`; }
export const ANIM2_GLSL = anim2Glsl();   // (the cast's walk: the elbow compiled in)
// three material → animated with v2 (chains the material's own onBeforeCompile, e.g. gpu.js tierize)
export function installAnim2(mat, uniforms, o = {}) {   // o: anim2Glsl's options (an elbow bend style, the elbow harness hook)
  const EL = o.elbow === undefined ? ELBOW : o.elbow; o = { ...o, elbow: EL };
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat), GLSL = EL === ELBOW && !o.lab ? ANIM2_GLSL : anim2Glsl(o);
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <batching_pars_vertex>', '#include <batching_pars_vertex>\n' + GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  animCompute(); transformed = gR * transformed + gT;');
    if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  animCompute(); objectNormal = gR * objectNormal;'); };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|anim-v2-connected-leg' + (o.elbow ? '|elbow-' + o.elbow.id : '') + (o.lab ? '|elbow-lab' : '');
  return mat;
}
