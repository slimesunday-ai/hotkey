// ?blur=1 · optional distance blur (pass 1d; OFF by default). slime remembers the first example's distance as "subtly blurred" — it
// was the haze — so this exists for comparison only. A gentle depth-based blur: nothing inside `start` (the street foreground and the
// first blocks stay pin sharp), ramping smoothly to `maxPx` at `end`, then flat. No near blur and no focus band, so it can never read
// as tilt-shift or a miniature. Two separable 9-tap passes; each tap is weighted by how blurred its own depth is, so a sharp near edge
// never smears into the soft distance behind it. The scene renders linear into an MSAA half-float target; the last pass tone-maps.
// Render pipeline pass: the shader is also the post stack's `blur` section (render/fx.js), which is what ?blur=1 switches on now.
import * as THREE from 'three';

export const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
export const FRAG = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uDir; uniform float uNear, uFar, uStart, uEnd, uMaxPx; varying vec2 vUv;
float linDepth(vec2 uv) { float z = texture2D(tDepth, uv).x * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float radius(float d) { return uMaxPx * smoothstep(uStart, uEnd, d); }
void main() {
  float rc = radius(linDepth(vUv)); vec4 c = texture2D(tColor, vUv);
  if (rc < .05) { gl_FragColor = c;
  } else {
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int k = -4; k <= 4; k++) { float t = float(k) / 4.; vec2 uv = vUv + uDir * t * rc; float w = exp(-2. * t * t);
      w *= clamp(radius(linDepth(uv)) / rc, 0., 1.); acc += texture2D(tColor, uv).rgb * w; wsum += w; }
    gl_FragColor = vec4(acc / max(wsum, 1e-4), 1.);
  }
  #ifdef TO_SCREEN
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #endif
}`;

export function createBlur(renderer, camera, o = {}) {
  const P = { start: o.start ?? 120, end: o.end ?? 480, maxPx: o.maxPx ?? 2.4 };   // metres of view depth; px at a 1000 px tall frame
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const mkRT = (depth, samples) => new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples, depthBuffer: !!depth, depthTexture: depth ? new THREE.DepthTexture(size.x, size.y) : null });
  const rtScene = mkRT(true, 4), rtH = mkRT(false, 0);
  const mat = screen => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, defines: screen ? { TO_SCREEN: '' } : {}, depthTest: false, depthWrite: false, toneMapped: screen,
    uniforms: { tColor: { value: null }, tDepth: { value: rtScene.depthTexture }, uDir: { value: new THREE.Vector2() }, uNear: { value: camera.near }, uFar: { value: camera.far }, uStart: { value: P.start }, uEnd: { value: P.end }, uMaxPx: { value: P.maxPx } } });
  const mH = mat(false), mV = mat(true), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mH), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; qs.add(quad);
  return {
    params: P,
    render(scene) {
      renderer.getDrawingBufferSize(size);
      if (rtScene.width !== size.x || rtScene.height !== size.y) { rtScene.setSize(size.x, size.y); rtH.setSize(size.x, size.y); }
      const k = size.y / 1000;   // blur radius scales with the frame, so it reads the same at any resolution
      for (const m of [mH, mV]) { m.uniforms.uNear.value = camera.near; m.uniforms.uFar.value = camera.far; m.uniforms.uMaxPx.value = P.maxPx * k; }
      mH.uniforms.uDir.value.set(1 / size.x, 0); mV.uniforms.uDir.value.set(0, 1 / size.y);
      renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
      mH.uniforms.tColor.value = rtScene.texture; quad.material = mH; renderer.setRenderTarget(rtH); renderer.render(qs, qc);
      mV.uniforms.tColor.value = rtH.texture; quad.material = mV; renderer.setRenderTarget(null); renderer.render(qs, qc);
    },
  };
}
