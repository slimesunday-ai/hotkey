// CAMERA PASS (2026-10-05) · DEPTH OF FIELD, one more section of the post stack (fx.js lists it; registered OFF, so the default render
// is unchanged). A focus distance, a strength (the blur in px at the far end, at a 1000 px tall frame) and how fast the blur grows
// away from the focus: radius(d) = strength · clamp(k · |d − focus| / d, 0, 1), near blur optional. Two separable 13-tap passes over
// the scene's depth; each tap is weighted by its own blur (a sharp pixel never smears into a soft one), as the distance blur does.
// Autofocus: with `auto` on, the camera (camera/rig.js) writes DOF_LIVE.focus every frame — the person followed, what the centre of
// the frame meets in fly and photo, the orbit's target — and the `focus` field is the manual distance when it is off.
import * as THREE from 'three';

export const DOF_LIVE = { focus: null };
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const FRAG = `uniform sampler2D tColor, tDepth; uniform vec2 uDir; uniform float uNear, uFar, uFocus, uK, uMaxPx, uNearOn; varying vec2 vUv;
float lin(vec2 uv) { float z = texture2D(tDepth, uv).x * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float rad(float d) { if (uNearOn < .5 && d < uFocus) return 0.; return uMaxPx * clamp(uK * abs(d - uFocus) / max(d, .05), 0., 1.); }
void main() { float rc = rad(lin(vUv)); vec4 c = texture2D(tColor, vUv);
  if (rc < .08) { gl_FragColor = vec4(c.rgb, 1.); return; }
  vec3 acc = vec3(0.); float ws = 0.;
  for (int k = -6; k <= 6; k++) { float t = float(k) / 6.; vec2 uv = vUv + uDir * t * rc; float w = exp(-2.2 * t * t) * clamp(rad(lin(uv)) / rc, 0., 1.); if (k == 0) w = 1.;
    acc += texture2D(tColor, uv).rgb * w; ws += w; }
  gl_FragColor = vec4(acc / max(ws, 1e-4), 1.); }`;

function make(ctx) {
  const P = { focus: 30, k: 1.5, maxPx: 6, near: true }, tmp = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const TRI = new THREE.BufferGeometry(); TRI.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)); TRI.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), U = v => ({ value: v });
  const mat = () => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tColor: U(null), tDepth: U(null), uDir: U(new THREE.Vector2()), uNear: U(.1), uFar: U(4000), uFocus: U(30), uK: U(1.5), uMaxPx: U(6), uNearOn: U(1) } });
  const mH = mat(), mV = mat(), qH = new THREE.Mesh(TRI, mH), qV = new THREE.Mesh(TRI, mV); qH.frustumCulled = qV.frustumCulled = false;
  return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, setSize() {}, dispose() { mH.dispose(); mV.dispose(); tmp.dispose(); TRI.dispose(); },
    update(v) { Object.assign(P, { focus: v.focus, k: v.falloff, maxPx: v.strength, near: v.near }); },
    render(renderer, write, read) {
      const { x, y } = ctx.size; if (tmp.width !== x || tmp.height !== y) tmp.setSize(x, y); const s = y / 1000, f = DOF_LIVE.focus ?? P.focus;
      for (const m of [mH, mV]) { const u = m.uniforms; u.tDepth.value = ctx.depth; u.uNear.value = ctx.camera.near; u.uFar.value = ctx.camera.far; u.uFocus.value = Math.max(.3, f); u.uK.value = P.k; u.uMaxPx.value = P.maxPx * s; u.uNearOn.value = P.near ? 1 : 0; }
      mH.uniforms.uDir.value.set(1 / x, 0); mV.uniforms.uDir.value.set(0, 1 / y);
      mH.uniforms.tColor.value = ctx.take(read); renderer.setRenderTarget(tmp); renderer.render(qH, CAM);
      mV.uniforms.tColor.value = tmp.texture; renderer.setRenderTarget(this.renderToScreen ? null : write); renderer.render(qV, CAM);
    } };
}
const n = (v, min, max, step, label, hint) => ({ v, min, max, step, ...(label ? { label } : {}), ...(hint ? { hint } : {}) });
export const DOF = { name: 'dof', title: 'Depth of field', order: 5, hint: 'camera pass: focus on a distance (autofocus: the person followed, the centre of the frame); the photo mode’s B key',
  fields: { on: { v: false }, auto: { v: true, label: 'autofocus', hint: 'the camera sets the focus: the person followed, what the centre of the frame sees, the orbit target' },
    focus: n(30, .5, 800, .5, 'focus (m)', 'the focus distance when autofocus is off'), strength: n(6, 0, 24, .1, 'blur (px)', 'at the far end, at a 1000 px tall frame'),
    falloff: n(1.5, .1, 8, .05, 'falloff', 'how fast the blur grows away from the focus'), near: { v: true, label: 'near blur' } },
  live: v => v.strength > 0, make };
