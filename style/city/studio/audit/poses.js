// CHARACTER AUDIT · pose capture. Reads each rigid part's transform (walk2.js ANIM2_GLSL, the real vertex shader: walk v2 + the
// idles + the grips) for: rest, the 8 walk phases, and every idle sampled over 20 s. Points at 4 reference positions per part go
// through installAnim2's animCompute(); a float target stores where they land. window.__poses() → { poses:[{name,g}], T:[pose][grip][part] = [R(9), t(3)] }.
import * as THREE from 'three';
import { WALK2, createAnimTexture2, animUniforms2, writeGait2, installAnim2 } from '../../anim/walk2.js';
import { WALK } from '../../anim/walk.js';
import { gait2State, stepGait2 } from '../../anim/gait2.js';
import { stepIdle, IDLE_NAMES } from '../../anim/idle.js';
import { HOLDS } from '../../../../world/held2.js';
const NP = 13, NR = 4, NG = HOLDS.length, DT = 1 / 120, K = { ...WALK }, K2 = { ...WALK2 };
function capture(states) {   // states: gait objects (one per pose) → transforms
  const n = states.length, tex = createAnimTexture2(n), [uni, G] = animUniforms2(tex, K2, K);
  states.forEach((g, k) => writeGait2(tex.image.data, n, k, g)); tex.needsUpdate = true;
  const N = n * NG * NP * NR, W = 2048, H = Math.ceil(N / W), pos = new Float32Array(N * 3), part = new Float32Array(N), wk = new Float32Array(N), slot = new Float32Array(N);
  const REF = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]; let i = 0;
  for (let s = 0; s < n; s++) for (let g = 0; g < NG; g++) for (let p = 0; p < NP; p++) for (let r = 0; r < NR; r++, i++) { pos.set(REF[r], i * 3); part[i] = p + g / 64; wk[i] = s; slot[i] = i; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  geo.setAttribute('aWalker', new THREE.BufferAttribute(wk, 1)); geo.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: {}, vertexShader: `attribute float aWalker; attribute float aSlot; varying vec3 vP;
#include <batching_pars_vertex>
void main() {
#include <begin_vertex>
  vP = transformed; float x = mod(aSlot, ${W}.), y = floor(aSlot / ${W}.);
  gl_Position = vec4((x + .5) / ${W}. * 2. - 1., (y + .5) / ${H}. * 2. - 1., 0., 1.); gl_PointSize = 1.; }`,
    fragmentShader: `varying vec3 vP; void main() { gl_FragColor = vec4(vP, 1.); }` });
  installAnim2(mat, uni); const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.vertexShader = sh.vertexShader.replace('int id = 0;', 'int id = int(aWalker + .5);'); };
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const renderer = new THREE.WebGLRenderer(), scene = new THREE.Scene(), cam = new THREE.Camera(); scene.add(new THREE.Points(geo, mat)); scene.children[0].frustumCulled = false;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  const px = new Float32Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); renderer.dispose(); rt.dispose();
  const T = []; i = 0;
  for (let s = 0; s < n; s++) { const TS = []; for (let g = 0; g < NG; g++) { const TG = []; for (let p = 0; p < NP; p++) { const q = []; for (let r = 0; r < NR; r++, i++) q.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
    const t = q[0], R = [0, 1, 2].map(c => [q[1 + c][0] - t[0], q[1 + c][1] - t[1], q[1 + c][2] - t[2]]);   // columns
    TG.push([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2], ...t].map(v => +v.toFixed(5))); } TS.push(TG); } T.push(TS); }
  return T;
}
window.__poses = () => {
  const [, G] = animUniforms2(createAnimTexture2(1), K2, K), poses = [], snap = (name, g) => poses.push({ name, g: { ...g } });
  snap('rest', gait2State({}));
  { const g = gait2State({}); const v = 1.2; for (let t = 0; t < 4; t += DT) { stepGait2(g, v * DT, DT, K2, G, 0); stepIdle(g, false, DT); }
    for (let k = 0; k < 8; k++) { let guard = 0; while (guard++ < 2000) { const u0 = g.u; stepGait2(g, v * DT, DT, K2, G, 0); stepIdle(g, false, DT); const a = (u0 - k / 8 + 1) % 1, b = (g.u - k / 8 + 1) % 1; if (b < a) break; } snap('walk' + k, g); } }
  IDLE_NAMES.forEach((nm, i) => { const g = gait2State({ idle: i }); g.iw = 1; g.still = 1; g.wasStill = true;
    for (let t = 0, k = 0; t < 20; t += DT, k++) { g.look = i === 8 ? .85 : 0; stepGait2(g, 0, DT, K2, G, 0); stepIdle(g, true, DT); if (k % 12 === 11) snap('idle' + i + '@' + (t + DT).toFixed(1), g); } });
  const T = capture(poses.map(p => p.g));
  return { holds: HOLDS, idles: IDLE_NAMES, poses: poses.map(p => ({ name: p.name, u: p.g.u, iw: p.g.iw, w: p.g.w })), T };
};
document.title = 'audit-poses-ready';
