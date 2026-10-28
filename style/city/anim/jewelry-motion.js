// ANIM LAB · JEWELLERY MOTION (2026-09-29): pendants swing and bounce with walk v2; an optional ice sparkle. Lab only (merged later).
// A pendant is a rigid plate (world/jewelry2.js plate()) that turns about its bail by two small angles, in the chest's frame, before the
// chest's own transform: a lateral swing that lags the body's sway (once a stride), a lift off the chest at each step (twice a stride)
// plus the lean (a hanging pendant stays plumb while the chest leans), and a breath while standing. The lift is never negative, so the
// plate never enters the chest; anim/bake.js (o.jewel) keeps the faces between a pendant and what it lies on, so lifting it opens no
// hole. Chains, rings and watches carry no aJw: locked to the chest, hands and wrists.
// Cost: one float attribute; one texel fetch set and a few ALU ops, only for vertices with aJw > 0 (a branch every other vertex skips).
// Ice sparkle (off by default, uJw.w): a time-hashed flash per iced voxel (aJw ≥ 2), a handful lit at any moment.
//   uJw: x lateral swing (rad at full stride) · y lift (rad) · z idle breath (rad) · w sparkle rate (0 = off)    uJwT: seconds
import * as THREE from 'three';
export const JEWEL_MOTION = { swing: .16, lift: .22, idle: .05, sparkle: 0 };
export function jewelUniforms(K = JEWEL_MOTION) { return { uJw: { value: new THREE.Vector4(K.swing, K.lift, K.idle, K.sparkle) }, uJwT: { value: 0 } }; }
export const JEWEL_GLSL = /* glsl */`
attribute float aJw; uniform vec4 uJw; uniform float uJwT; varying float vJwIce; varying vec3 vJwP, vJwN;
vec3 jwSwing(vec3 p) {
  float ice = step(1.5, aJw), piv = aJw - 2. * ice; vJwIce = ice; vJwP = position / .05; vJwN = normal;
  if (piv <= 0.) return p;
#ifdef USE_BATCHING
  int id = int(getIndirectIndex(gl_DrawID));
#else
  int id = 0;
#endif
  vec4 A0 = texelFetch(uAnim, ivec2(id, 0), 0), A1 = texelFetch(uAnim, ivec2(id, 1), 0), A2 = texelFetch(uAnim, ivec2(id, 2), 0);
  float u = A0.x, a = A0.y, w = A0.z, v = A0.w, T = 6.2831853, st = (1. - w) * A1.w, h = max(piv - position.y, 0.);
  float side = uJw.x * w * a * -cos(T * (u - .37)) + uJw.z * st * sin(A2.x * 1.3);              // lags the pelvis sway (walk2: bodyX ~ -cos(u - .27))
  float lift = uJw.y * w * a * (.5 + .5 * cos(2. * T * (u - .3))) + uB1.z * clamp(v / uB1.w, 0., 1.6) * w + uJw.z * st * (.5 + .5 * sin(A2.x * 2.1));
  return p + vec3(side * h, -.5 * (side * side + lift * lift) * h, max(lift, 0.) * h);
}`;
const SPARK_GLSL = /* glsl */`
  if (uJw.w > 0. && vJwIce > .5) { vec3 vx = floor(vJwP - vJwN * .5 + .001);   // the voxel (per fragment: a face's corners straddle voxels)
    float hs = fract(sin(dot(vx, vec3(12.9898, 78.233, 37.719)) + floor(uJwT * 7.) * 1.618) * 43758.5453);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.4), step(1. - .05 * uJw.w, hs) * .9); }`;
// after installAnim2(mat, …) (walk2.js): chains the material's onBeforeCompile; the depth material gets the swing only
export function installJewelMotion(mat, uniforms) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, uniforms);
    if (!sh.vertexShader.includes('animCompute(); transformed = gR * transformed + gT;')) return;   // (not a walk v2 material)
    sh.vertexShader = sh.vertexShader.replace('void main() {', JEWEL_GLSL + '\nvoid main() {')
      .replace('animCompute(); transformed = gR * transformed + gT;', 'animCompute(); transformed = jwSwing(transformed); transformed = gR * transformed + gT;');
    if (sh.fragmentShader.includes('#include <dithering_fragment>')) sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec4 uJw; uniform float uJwT; varying float vJwIce; varying vec3 vJwP, vJwN;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>' + SPARK_GLSL);
    else sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vJwIce; varying vec3 vJwP, vJwN;\nvoid main() {'); };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|jewel';
  return mat;
}
