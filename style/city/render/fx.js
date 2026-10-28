// Render pipeline pass · THE POST EFFECTS. Each entry is one section of the stack: its fields (the panel is generated from them, a preset
// stores their diffs), its default place in the stack, and make(ctx) → a pass the composer runs (duck-typed like three's Pass:
// enabled / needsSwap / renderToScreen / render(renderer, writeBuffer, readBuffer) / setSize / dispose) plus update(values).
// A pass is only built the first time its section is switched on. Every pass reads ctx.take(readBuffer) — the scene target for the
// first pass of the frame — and works in DISPLAY values (the scene arrives tone-mapped and sRGB-encoded; see post.js).
// Every section registers OFF (grain: on, as the static CSS overlay it always was), so the default render is today's.
// Film emulation pass (2026-10-05): grain gains a `film` type (film.js: per-layer dye clouds, the film curve, sized by format, new each
// film frame) and the stack gains `film` (film.js: stock, weave, flicker, dust, scratches, leaks, gate as one pass).
// V2 / V5 (render review 2026-10-09) · THE FOLD. Grade, bloom's composite, sharpen, chroma, lens, vignette and the animated grain are no
// longer a pass each: post.js folds every run of them that sits together in the stack into ONE pass (fold() below), so the picture is
// read once and resampled once. Inside it, in this order whatever the stack says: lens and chroma as offsets of the one fetch (the old
// chroma then lens resampled red and blue twice), sharpen over those fetches (it used to run BEFORE them, and the lens resample undid
// it), the grade, bloom's glow added before or after the grade as the stack has it (the bloom chain itself is unchanged; with the grade
// first, its prefilter grades what it reads), the vignette, the grain last. A section's `fold` says how its values feed the fold's
// uniforms (and `ok`: when it can fold); `depth` says when it reads the scene's depth (post.js makes the depth texture only then).
import * as THREE from 'three';
import { VERT as BLUR_VERT, FRAG as BLUR_FRAG } from '../blur.js';
import { LUT_NAMES, lutTexture, DITHERS, matrixTexture, PALETTE_NAMES, paletteOf, hex3 } from './luts.js';
import { DOF } from './dof.js';   // (camera pass: depth of field, a section like the others, registered off)
import { FILM, FILM_GRAIN, FORMATS, grainNoise, grainFilm } from './film.js';   // (film emulation pass: the film pass and the film grain type, registered off)

// ── plumbing: one big triangle, one camera, one material shape
const TRI = new THREE.BufferGeometry();
TRI.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)); TRI.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const HEAD = `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; varying vec2 vUv;
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
vec3 tex(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }
`;
const shader = (frag, uniforms = {}, o = {}) => new THREE.ShaderMaterial({ vertexShader: o.vert || VERT, fragmentShader: o.raw ? frag : HEAD + frag, defines: o.defines || {},
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, ...uniforms }, depthTest: false, depthWrite: false, toneMapped: false });
const quad = m => { const q = new THREE.Mesh(TRI, m); q.frustumCulled = false; return q; };
const draw = (renderer, mesh, target) => { renderer.setRenderTarget(target); renderer.render(mesh, CAM); };
const hdrRT = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
const U = v => ({ value: v }), C3 = h => new THREE.Vector3(...hex3(h));

// a one-shader effect: set(uniforms, values) maps the section's values to its uniforms
function simple(ctx, frag, uniforms, set) {
  const m = shader(frag, uniforms), q = quad(m);
  return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, material: m, setSize() {}, dispose() { m.dispose(); },
    update(v) { set(m.uniforms, v); },
    render(renderer, write, read) { const u = m.uniforms; u.tDiffuse.value = ctx.take(read); u.uRes.value.copy(ctx.size); u.uTime.value = ctx.time; draw(renderer, q, this.renderToScreen ? null : write); } };
}

// ── glow (bloom and halation share it): prefilter at half size → dual-filter down chain → tent up chain → composite
const PRE = `uniform sampler2D tDepth, tScene; uniform float uTh, uKnee, uSky, uPreGrade; uniform vec2 uTexel;
void main() { vec3 c = .25 * (tex(vUv + uTexel * vec2(-1., -1.)) + tex(vUv + uTexel * vec2(1., -1.)) + tex(vUv + uTexel * vec2(-1., 1.)) + tex(vUv + uTexel * vec2(1., 1.)));
  c = (c == c) ? clamp(c, 0., 32.) : vec3(0.);   // a NaN, negative or runaway scene pixel would smear into a big blob down the chain: sanitise it here
  if (uPreGrade > .5) c = gradeOf(c);   // (V2 fold: the stack grades before the bloom, and the fold grades after the fetch, so the glow reads the graded picture as before)
  float br = max(c.r, max(c.g, c.b)), s = clamp(br - uTh + uKnee, 0., 2. * uKnee); s = s * s / (4. * uKnee + 1e-4);
  float k = max(s, br - uTh) / max(br, 1e-4); if (uSky > .5 && texture2D(tDepth, vUv).x > .99999) k = 0.;
  if (uSky > .5) k *= clamp(1. - .25 * (texture2D(tScene, vUv + uTexel * vec2(-1., -1.)).a + texture2D(tScene, vUv + uTexel * vec2(1., -1.)).a + texture2D(tScene, vUv + uTexel * vec2(-1., 1.)).a + texture2D(tScene, vUv + uTexel * vec2(1., 1.)).a), 0., 1.);   // (lighting pass: emissive only = the lit flag, which gpu.js writes into the scene target's alpha as 1 − lit)
  gl_FragColor = vec4(c * k, 1.); }`;
const DOWN = `uniform vec2 uTexel;
void main() { vec2 t = uTexel; gl_FragColor = vec4((4. * tex(vUv) + tex(vUv - t) + tex(vUv + t) + tex(vUv + vec2(t.x, -t.y)) + tex(vUv - vec2(t.x, -t.y))) / 8., 1.); }`;
const UP = `uniform sampler2D tLow; uniform vec2 uTexel; uniform float uW;
vec3 low(vec2 o) { return texture2D(tLow, vUv + o * uTexel).rgb; }
void main() { vec3 s = low(vec2(-2., 0.)) + low(vec2(2., 0.)) + low(vec2(0., -2.)) + low(vec2(0., 2.)) + 2. * (low(vec2(-1., -1.)) + low(vec2(1., -1.)) + low(vec2(-1., 1.)) + low(vec2(1., 1.)));
  gl_FragColor = vec4(tex(vUv) + uW * s / 12., 1.); }`;
const COMP = `uniform sampler2D tGlow; uniform float uStrength, uNorm, uScreen; uniform vec3 uTint;
void main() { vec3 c = tex(vUv), g = texture2D(tGlow, vUv).rgb * uNorm * uStrength * uTint;
  c = uScreen > .5 ? 1. - (1. - c) * (1. - clamp(g, 0., 1.)) : c + g; gl_FragColor = vec4(c, 1.); }`;
function glow(ctx, levels, screen) {
  const GU = ctx.FU ? Object.fromEntries(GRADE_NAMES.map(k => [k, ctx.FU[k]])) : GRADE_U();   // (the fold's grade values, shared)
  const pre = shader(GRADE_FN + PRE, { tDepth: U(null), tScene: U(null), uTh: U(.8), uKnee: U(.1), uSky: U(0), uPreGrade: U(0), uTexel: U(new THREE.Vector2()), ...GU }), down = shader(DOWN, { uTexel: U(new THREE.Vector2()) }),
    up = shader(UP, { tLow: U(null), uTexel: U(new THREE.Vector2()), uW: U(.7) }), comp = shader(COMP, { tGlow: U(null), uStrength: U(1), uNorm: U(1), uScreen: U(screen ? 1 : 0), uTint: U(new THREE.Vector3(1, 1, 1)) });
  const qPre = quad(pre), qDown = quad(down), qUp = quad(up), qComp = quad(comp), D = [], UPS = []; for (let i = 0; i < levels; i++) { D.push(hdrRT()); UPS.push(hdrRT()); }
  let w = 0, h = 0, radius = .7, spread = 1;
  return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, setSize() {}, dispose() { [pre, down, up, comp].forEach(m => m.dispose()); [...D, ...UPS].forEach(t => t.dispose()); },
    update(v) { pre.uniforms.uTh.value = v.threshold; pre.uniforms.uKnee.value = Math.max(.02, v.threshold * .25); pre.uniforms.uSky.value = v.emissive ? 1 : 0;
      comp.uniforms.uStrength.value = v.strength; comp.uniforms.uTint.value.set(...hex3(v.tint ?? '#ffffff')); radius = v.radius; spread = v.spread ?? 1; },
    // the glow itself (prefilter → down chain → up chain): { tex, norm }; render() adds it to the picture, the fold (V2) adds it itself
    chain(renderer, src, preGrade = false) {
      if (w !== ctx.size.x || h !== ctx.size.y) { w = ctx.size.x; h = ctx.size.y; let x = w, y = h; for (let i = 0; i < levels; i++) { x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); D[i].setSize(x, y); UPS[i].setSize(x, y); } }
      pre.uniforms.tDiffuse.value = src; pre.uniforms.tDepth.value = ctx.depth; pre.uniforms.tScene.value = ctx.scene; pre.uniforms.uPreGrade.value = preGrade ? 1 : 0; pre.uniforms.uTexel.value.set(1 / w, 1 / h); draw(renderer, qPre, D[0]);
      for (let i = 1; i < levels; i++) { down.uniforms.tDiffuse.value = D[i - 1].texture; down.uniforms.uTexel.value.set(1 / D[i - 1].width, 1 / D[i - 1].height); draw(renderer, qDown, D[i]); }
      let low = D[levels - 1], norm = 1;
      for (let i = levels - 2; i >= 0; i--) { up.uniforms.tDiffuse.value = D[i].texture; up.uniforms.tLow.value = low.texture; up.uniforms.uTexel.value.set(spread / low.width, spread / low.height);
        up.uniforms.uW.value = radius; draw(renderer, qUp, UPS[i]); low = UPS[i]; norm = 1 + radius * norm; }
      return { tex: low.texture, norm: 1 / norm }; },
    render(renderer, write, read) {
      const src = ctx.take(read), g = this.chain(renderer, src);
      comp.uniforms.tDiffuse.value = src; comp.uniforms.tGlow.value = g.tex; comp.uniforms.uNorm.value = g.norm; draw(renderer, qComp, this.renderToScreen ? null : write);
    } };
}

// ── the distance blur (blur.js's shader, now a stack section): two separable passes over the scene's depth
function depthBlur(ctx) {
  const P = { start: 120, end: 480, maxPx: 2.4 }, tmp = hdrRT();
  const mat = () => new THREE.ShaderMaterial({ vertexShader: BLUR_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tColor: U(null), tDepth: U(null), uDir: U(new THREE.Vector2()), uNear: U(1), uFar: U(1000), uStart: U(120), uEnd: U(480), uMaxPx: U(2.4) } });
  const mH = mat(), mV = mat(), qH = quad(mH), qV = quad(mV);
  return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, setSize() {}, dispose() { mH.dispose(); mV.dispose(); tmp.dispose(); },
    update(v) { Object.assign(P, { start: v.start, end: Math.max(v.start + 1, v.end), maxPx: v.maxPx }); },
    render(renderer, write, read) {
      const { x, y } = ctx.size; if (tmp.width !== x || tmp.height !== y) tmp.setSize(x, y); const k = y / 1000;   // (radius scales with the frame, as in blur.js)
      for (const m of [mH, mV]) { const u = m.uniforms; u.tDepth.value = ctx.depth; u.uNear.value = ctx.camera.near; u.uFar.value = ctx.camera.far; u.uStart.value = P.start; u.uEnd.value = P.end; u.uMaxPx.value = P.maxPx * k; }
      mH.uniforms.uDir.value.set(1 / x, 0); mV.uniforms.uDir.value.set(0, 1 / y);
      mH.uniforms.tColor.value = ctx.take(read); draw(renderer, qH, tmp);
      mV.uniforms.tColor.value = tmp.texture; draw(renderer, qV, this.renderToScreen ? null : write);
    } };
}

// ── colour grade: white balance, lift/gamma/gain, contrast, saturation + vibrance, split toning, a film LUT, fade
const GRADE_FN = `uniform float uTemp, uTintG, uContrast, uSat, uVib, uLift, uGamma, uGain, uSplit, uBalance, uFade, uLutMix, uLutOn, uLutSize;
uniform vec3 uLiftC, uGammaC, uGainC, uShadowC, uHighC; uniform highp sampler3D tLut;
vec3 nrm(vec3 t) { return t / max(luma(t), 1e-3); }
float sc(float x, float k) { x = clamp(x, 0., 1.); return x < .5 ? .5 * pow(2. * x, k) : 1. - .5 * pow(2. * (1. - x), k); }
vec3 gradeOf(vec3 c) {
  vec3 wb = vec3(1. + .2 * uTemp, 1. - .16 * uTintG, 1. - .2 * uTemp); wb /= luma(wb);
  c = pow(max(pow(max(c, 0.), vec3(2.2)) * wb, 0.), vec3(1. / 2.2));
  c = c * uGain * nrm(uGainC);
  c = c + uLift * nrm(uLiftC) * (1. - c);
  c = pow(max(c, 0.), 1. / max(uGamma * nrm(uGammaC), vec3(.05)));
  if (uContrast != 1.) c = vec3(sc(c.r, uContrast), sc(c.g, uContrast), sc(c.b, uContrast));
  float l = luma(c), s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, uSat * (1. + uVib * (1. - clamp(s, 0., 1.))));
  if (uSplit > 0.) { float p = .5 + .35 * uBalance, wh = smoothstep(p - .3, p + .3, l); c += uSplit * ((uShadowC - luma(uShadowC)) * (1. - wh) + (uHighC - luma(uHighC)) * wh); }
  if (uLutOn > .5) { vec3 u = clamp(c, 0., 1.) * (uLutSize - 1.) / uLutSize + .5 / uLutSize; c = mix(c, texture(tLut, u).rgb, uLutMix); }
  c = mix(c, vec3(.2, .19, .18) + c * .8, uFade);
  return c;
}
`;
const GRADE = GRADE_FN + 'void main() { gl_FragColor = vec4(gradeOf(tex(vUv)), 1.); }';
const GRADE_U = () => ({ uTemp: U(0), uTintG: U(0), uContrast: U(1), uSat: U(1), uVib: U(0), uLift: U(0), uGamma: U(1), uGain: U(1), uSplit: U(0), uBalance: U(0), uFade: U(0),
  uLutMix: U(1), uLutOn: U(0), uLutSize: U(2), uLiftC: U(C3('#fff')), uGammaC: U(C3('#fff')), uGainC: U(C3('#fff')), uShadowC: U(C3('#000')), uHighC: U(C3('#000')), tLut: U(lutTexture('none')) });
const GRADE_NAMES = Object.keys(GRADE_U());
function setGrade(u, v) { u.uTemp.value = v.temperature; u.uTintG.value = v.tint; u.uContrast.value = v.contrast; u.uSat.value = v.saturation; u.uVib.value = v.vibrance;
  u.uLift.value = v.lift; u.uGamma.value = v.gamma; u.uGain.value = v.gain; u.uSplit.value = v.split; u.uBalance.value = v.balance; u.uFade.value = v.fade; u.uLutMix.value = v.lutMix;
  u.uLiftC.value.set(...hex3(v.liftColor)); u.uGammaC.value.set(...hex3(v.gammaColor)); u.uGainC.value.set(...hex3(v.gainColor)); u.uShadowC.value.set(...hex3(v.shadows)); u.uHighC.value.set(...hex3(v.highlights));
  const t = lutTexture(v.lut); u.tLut.value = t; u.uLutSize.value = t.size; u.uLutOn.value = v.lut !== 'none' ? 1 : 0; }

// ── the single-shader effects
const SHARPEN = `uniform float uAmount, uRadius;
void main() { vec2 t = uRadius / uRes; vec3 c = tex(vUv), b = .25 * (tex(vUv + vec2(t.x, 0.)) + tex(vUv - vec2(t.x, 0.)) + tex(vUv + vec2(0., t.y)) + tex(vUv - vec2(0., t.y)));
  gl_FragColor = vec4(max(c + (c - b) * uAmount, 0.), 1.); }`;
const CHROMA = `uniform float uAmount;
void main() { vec2 d = vUv - .5, o = d * 2. * uAmount / uRes; gl_FragColor = vec4(tex(vUv + o).r, tex(vUv).g, tex(vUv - o).b, 1.); }`;
const LENS = `uniform float uK;
void main() { vec2 d = vUv - .5; float a = uRes.x / uRes.y; vec2 q = vec2(d.x * a, d.y); float r2 = dot(q, q), rm = .25 * (a * a + 1.);
  float f = (1. + uK * r2) / (uK > 0. ? 1. + uK * rm : 1.); gl_FragColor = vec4(tex(clamp(.5 + d * f, 0., 1.)), 1.); }`;
const VIGNETTE = `uniform float uAmount, uRadius, uSoft, uRound; uniform vec3 uColor;
void main() { vec3 c = tex(vUv); vec2 s = vec2(mix(1., uRes.x / uRes.y, uRound), 1.); float r = length((vUv - .5) * s) / length(.5 * s);
  gl_FragColor = vec4(mix(c, uColor, smoothstep(uRadius, uRadius + uSoft, r) * uAmount), 1.); }`;
const LETTERBOX = `uniform float uAspect, uOpacity; uniform vec3 uColor;
void main() { vec3 c = tex(vUv); float a = uRes.x / uRes.y; bool bar = a < uAspect ? abs(vUv.y - .5) > .5 * a / uAspect : abs(vUv.x - .5) > .5 * uAspect / a;
  gl_FragColor = vec4(bar ? mix(c, uColor, uOpacity) : c, 1.); }`;
const GRAIN = `uniform float uAmount, uSize, uResp, uColor, uFrame;
float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p, vec2 s) { if (uSize <= 1.) return h(floor(p) + s); vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float n = mix(mix(h(i + s), h(i + vec2(1., 0.) + s), f.x), mix(h(i + vec2(0., 1.) + s), h(i + vec2(1., 1.) + s), f.x), f.y); return .5 + (n - .5) * 1.7; }
void main() { vec3 c = tex(vUv); vec2 p = gl_FragCoord.xy / max(uSize, 1.), s = vec2(mod(uFrame, 509.) * 37.17, mod(uFrame, 263.) * 11.31);
  vec3 n = uColor > .5 ? vec3(vn(p, s), vn(p, s + 71.3), vn(p, s + 143.9)) : vec3(vn(p, s)); float l = luma(c), w = mix(1., 4. * l * (1. - l), uResp);
  gl_FragColor = vec4(c + (n - .5) * uAmount * w, 1.); }`;
const DITHER = `uniform sampler2D tMat; uniform float uMatSize, uPixel, uLevels, uStrength, uUsePal, uN, uSpread; uniform vec3 uPal[16];
void main() { vec2 cell = floor(gl_FragCoord.xy / uPixel); vec3 c = tex((cell + .5) * uPixel / uRes);
  float t = texture2D(tMat, (mod(cell, uMatSize) + .5) / uMatSize).r - .5;
  if (uUsePal < .5) { float L = uLevels - 1.; c = floor(clamp(c, 0., 1.) * L + .5 + t * uStrength) / L; }
  else { vec3 q = c + t * uStrength * uSpread, best = uPal[0]; float bd = 1e9;
    for (int i = 0; i < 16; i++) { if (float(i) >= uN) break; vec3 d = q - uPal[i]; float e = dot(d * d, vec3(.3, .59, .11)); if (e < bd) { bd = e; best = uPal[i]; } }
    c = best; }
  gl_FragColor = vec4(c, 1.); }`;

// ── V2 / V5 · THE FOLD: one pass for a run of grade, bloom (its composite), sharpen, chroma, lens, vignette and animated grain (see the
// header). uOn: lens, chroma, sharpen, grade · uOn2: bloom (1 after the grade, 2 before it), vignette, grain. Each sub-step is the old
// pass's own maths; only the order inside is fixed and the picture is resampled once.
const FOLD = GRADE_FN + `uniform sampler2D tGlow; uniform vec4 uOn, uOn2;
uniform float uLensK, uChromaPx, uSharpAmt, uSharpR, uBloomK; uniform vec3 uBloomTint;
uniform float uVigAmt, uVigR, uVigSoft, uVigRound; uniform vec3 uVigColor;
uniform float uGrAmt, uGrSize, uGrResp, uGrColor, uGrFrame;
float gh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gvn(vec2 p, vec2 s) { if (uGrSize <= 1.) return gh(floor(p) + s); vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float n = mix(mix(gh(i + s), gh(i + vec2(1., 0.) + s), f.x), mix(gh(i + vec2(0., 1.) + s), gh(i + vec2(1., 1.) + s), f.x), f.y); return .5 + (n - .5) * 1.7; }
vec2 lensAt(vec2 uv) { if (uOn.x < .5) return uv; vec2 d = uv - .5; float a = uRes.x / uRes.y; vec2 q = vec2(d.x * a, d.y); float r2 = dot(q, q), rm = .25 * (a * a + 1.);
  float f = (1. + uLensK * r2) / (uLensK > 0. ? 1. + uLensK * rm : 1.); return clamp(.5 + d * f, 0., 1.); }
vec3 fetch(vec2 uv) { vec2 p = lensAt(uv); if (uOn.y < .5) return tex(p); vec2 o = (p - .5) * 2. * uChromaPx / uRes; return vec3(tex(p + o).r, tex(p).g, tex(p - o).b); }
void main() {
  vec3 c = fetch(vUv);
  if (uOn.z > .5) { vec2 t = uSharpR / uRes; vec3 b = .25 * (fetch(vUv + vec2(t.x, 0.)) + fetch(vUv - vec2(t.x, 0.)) + fetch(vUv + vec2(0., t.y)) + fetch(vUv - vec2(0., t.y)));
    c = max(c + (c - b) * uSharpAmt, 0.); }
  vec3 g = uOn2.x > .5 ? texture2D(tGlow, lensAt(vUv)).rgb * uBloomK * uBloomTint : vec3(0.);
  if (uOn2.x > 1.5) c += g;
  if (uOn.w > .5) c = gradeOf(c);
  if (uOn2.x > .5 && uOn2.x < 1.5) c += g;
  if (uOn2.y > .5) { vec2 s = vec2(mix(1., uRes.x / uRes.y, uVigRound), 1.); float r = length((vUv - .5) * s) / length(.5 * s); c = mix(c, uVigColor, smoothstep(uVigR, uVigR + uVigSoft, r) * uVigAmt); }
  if (uOn2.z > .5) { vec2 p = gl_FragCoord.xy / max(uGrSize, 1.), s = vec2(mod(uGrFrame, 509.) * 37.17, mod(uGrFrame, 263.) * 11.31);
    vec3 n = uGrColor > .5 ? vec3(gvn(p, s), gvn(p, s + 71.3), gvn(p, s + 143.9)) : vec3(gvn(p, s)); float l = luma(c), w = mix(1., 4. * l * (1. - l), uGrResp);
    c += (n - .5) * uGrAmt * w; }
  gl_FragColor = vec4(c, 1.);
}`;
// the fold's values, one set per post stack (post.js ctx.FU): every foldable section's `fold.set` writes here, every fold pass reads it
export const foldUniforms = () => ({ ...GRADE_U(), uLensK: U(0), uChromaPx: U(0), uSharpAmt: U(0), uSharpR: U(1), uVigAmt: U(0), uVigR: U(.55), uVigSoft: U(.6), uVigRound: U(.6),
  uVigColor: U(C3('#17171b')), uGrAmt: U(0), uGrSize: U(1), uGrResp: U(1), uGrColor: U(0), uGrSpeed: U(0) });
// a fold pass for `run` (the post stack's records in stack order: { def, values, pass }); bloom's own pass (made and updated by post.js) runs its chain
export function fold(ctx, run) {
  const has = n => run.findIndex(r => r.def.name === n), on = n => has(n) >= 0 ? 1 : 0, ib = has('bloom'), ig = has('grade');
  const m = shader(FOLD, { ...ctx.FU, tGlow: U(null), uBloomK: U(0), uBloomTint: U(new THREE.Vector3(1, 1, 1)), uGrFrame: U(0),
    uOn: U(new THREE.Vector4(on('lens'), on('chroma'), on('sharpen'), on('grade'))), uOn2: U(new THREE.Vector4(ib < 0 ? 0 : ig >= 0 && ig < ib ? 1 : 2, on('vignette'), on('grain'), 0)) }), q = quad(m);
  const bloom = ib >= 0 ? run[ib] : null, gradeFirst = ib >= 0 && ig >= 0 && ig < ib;
  return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, material: m, foldName: run.map(r => r.def.name).join('+'), setSize() {}, dispose() { m.dispose(); }, update() {},
    render(renderer, write, read) { const u = m.uniforms, src = ctx.take(read);
      if (bloom) { const g = bloom.pass.chain(renderer, src, gradeFirst), v = bloom.values; u.tGlow.value = g.tex; u.uBloomK.value = g.norm * v.strength; u.uBloomTint.value.set(...hex3(v.tint ?? '#ffffff')); }
      u.tDiffuse.value = src; u.uRes.value.copy(ctx.size); u.uTime.value = ctx.time; u.uGrFrame.value = u.uGrSpeed.value > 0 ? Math.floor(ctx.time * u.uGrSpeed.value) : 0;
      draw(renderer, q, this.renderToScreen ? null : write); } };
}

// ── the sections. `order` is the default stack position (low runs first). Colours are display (sRGB) hex.
const n = (v, min, max, step, label, hint) => ({ v, min, max, step, ...(label ? { label } : {}), ...(hint ? { hint } : {}) });
export const EFFECTS = [
  { ...DOF, depth: () => true },
  { name: 'blur', title: 'Distance blur', order: 10, hint: 'blur.js: soft far distance (?blur=1 switches it on)',
    fields: { on: { v: false }, start: n(120, 0, 600, 5, 'start (m)'), end: n(480, 20, 1200, 5, 'end (m)'), maxPx: n(2.4, 0, 8, .1, 'max blur (px)') },
    make: depthBlur, depth: () => true },
  { name: 'bloom', title: 'Bloom', order: 20, hint: 'glow from bright pixels',
    fields: { on: { v: false }, threshold: n(.8, 0, 1, .01), strength: n(.6, 0, 3, .01), radius: n(.7, 0, 1, .01), spread: n(1, .5, 3, .05),
      tint: { v: '#ffffff', color: true }, emissive: { v: false, label: 'emissive only', hint: 'only light sources bloom: sky excluded and nothing at day, where the sun outshines them, so day stays clean' } },
    live: (v, ctx) => v.strength > 0 && (!v.emissive || ctx.night), make: ctx => glow(ctx, 6, false),
    depth: (v, ctx) => v.emissive && ctx.night, fold: { set() {} } },   // (the sky mask reads the depth; folded, the chain runs as it is and the fold adds the glow)
  { name: 'halation', title: 'Halation', order: 30, hint: 'film: a warm red glow bleeding round bright edges',
    fields: { on: { v: false }, threshold: n(.72, 0, 1, .01), strength: n(.5, 0, 2, .01), radius: n(.55, 0, 1, .01), spread: n(1.4, .5, 3, .05), tint: { v: '#ff4a1c', color: true } },
    live: v => v.strength > 0, make: ctx => glow(ctx, 4, true) },
  { name: 'grade', title: 'Colour grade', order: 40, hint: 'white balance, lift/gamma/gain, contrast, saturation, split toning, film LUT, fade',
    fields: { on: { v: false }, temperature: n(0, -1, 1, .01), tint: n(0, -1, 1, .01, 'tint (green ↔ magenta)'), contrast: n(1, .5, 2, .01), saturation: n(1, 0, 2, .01), vibrance: n(0, -1, 1, .01),
      lift: n(0, -.25, .25, .005), liftColor: { v: '#ffffff', color: true, label: 'lift colour' }, gamma: n(1, .5, 2, .01), gammaColor: { v: '#ffffff', color: true, label: 'gamma colour' },
      gain: n(1, 0, 2, .01), gainColor: { v: '#ffffff', color: true, label: 'gain colour' },
      split: n(0, 0, 1, .01, 'split toning'), shadows: { v: '#1f6fb2', color: true, label: 'split shadows' }, highlights: { v: '#ffb35c', color: true, label: 'split highlights' }, balance: n(0, -1, 1, .01),
      fade: n(0, 0, 1, .01, 'fade (milky blacks)'), lut: { v: 'none', options: LUT_NAMES, label: 'film LUT' }, lutMix: n(1, 0, 1, .01, 'LUT mix') },
    make: ctx => simple(ctx, GRADE, GRADE_U(), setGrade), fold: { set: setGrade } },
  { name: 'sharpen', title: 'Sharpen', order: 50, fields: { on: { v: false }, amount: n(.5, 0, 3, .01), radius: n(1, .5, 3, .05, 'radius (px)') },
    make: ctx => simple(ctx, SHARPEN, { uAmount: U(.5), uRadius: U(1) }, (u, v) => { u.uAmount.value = v.amount; u.uRadius.value = v.radius; }),
    fold: { set: (u, v) => { u.uSharpAmt.value = v.amount; u.uSharpR.value = v.radius; } } },
  { name: 'chroma', title: 'Chromatic aberration', order: 60, fields: { on: { v: false }, amount: n(2, 0, 12, .1, 'amount (px at the corners)') },
    make: ctx => simple(ctx, CHROMA, { uAmount: U(2) }, (u, v) => { u.uAmount.value = v.amount; }), fold: { set: (u, v) => { u.uChromaPx.value = v.amount; } } },
  { name: 'lens', title: 'Lens distortion', order: 70, fields: { on: { v: false }, amount: n(.06, -.3, .3, .005, 'amount (+ barrel, − pincushion)') },
    make: ctx => simple(ctx, LENS, { uK: U(.06) }, (u, v) => { u.uK.value = v.amount; }), fold: { set: (u, v) => { u.uLensK.value = v.amount; } } },
  { name: 'vignette', title: 'Vignette', order: 80,
    fields: { on: { v: false }, amount: n(.45, 0, 1, .01), radius: n(.55, 0, 1.2, .01), softness: n(.6, .05, 1.5, .01), roundness: n(.6, 0, 1, .01), color: { v: '#17171b', color: true } },
    make: ctx => simple(ctx, VIGNETTE, { uAmount: U(.45), uRadius: U(.55), uSoft: U(.6), uRound: U(.6), uColor: U(C3('#17171b')) },
      (u, v) => { u.uAmount.value = v.amount; u.uRadius.value = v.radius; u.uSoft.value = v.softness; u.uRound.value = v.roundness; u.uColor.value.set(...hex3(v.color)); }),
    fold: { set: (u, v) => { u.uVigAmt.value = v.amount; u.uVigR.value = v.radius; u.uVigSoft.value = v.softness; u.uVigRound.value = v.roundness; u.uVigColor.value.set(...hex3(v.color)); } } },
  { name: 'grain', title: 'Film grain', order: 90, hint: 'static = the CSS overlay the city always had (amount, size); animated = a shader grain that moves; film = real film grain: dye clouds per layer, strongest in the shadows and mid-tones, sized by the format, new each film frame (Film emulation · fps)',
    fields: { on: { v: true }, type: { v: 'static', options: ['static', 'animated', 'film'] }, amount: n(.13, 0, .6, .005), size: n(1, 1, 4, .05, 'size (px)', 'film type: × the format’s own grain size'),
      response: n(1, 0, 1, .01, 'luminance response', '0 = even everywhere, 1 = film-like: animated strongest in the mid-tones, film in the shadows and mid-tones'), color: { v: 'mono', options: ['mono', 'colour'], hint: 'film type: colour = dye clouds per layer, mono = black-and-white silver' },
      speed: n(24, 0, 60, 1, 'speed (fps)', 'animated: new grain this many times a second; 0 = frozen (the film type follows the film frame rate)'),
      format: { v: '16 mm', options: Object.keys(FORMATS), hint: 'film type: the gauge — the smaller the frame, the bigger and stronger the grain' } },
    live: v => (v.type === 'animated' || v.type === 'film') && v.amount > 0,
    make: ctx => { const a = simple(ctx, GRAIN, { uAmount: U(.13), uSize: U(1), uResp: U(1), uColor: U(0), uFrame: U(0) }, (u, v) => { u.uAmount.value = v.amount; u.uSize.value = v.size; u.uResp.value = v.response; u.uColor.value = v.color === 'colour' ? 1 : 0; u._speed = v.speed; });
      let b = null, vals = null; const film = () => b ??= simple(ctx, FILM_GRAIN, { tNoise: U(grainNoise()), uAmount: U(.13), uResp: U(1), uColor: U(0), uScale: U(1), uOff: U(new THREE.Vector4()) }, (u, v) => { u.uResp.value = v.response; u.uColor.value = v.color === 'colour' ? 1 : 0; });
      const cur = () => vals?.type === 'film' ? film() : a;
      return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, get material() { return cur().material; }, setSize() {}, dispose() { a.dispose(); b?.dispose(); },
        update(v) { vals = v; a.update(v); if (v.type === 'film') film().update(v); },
        tick(ctx) { if (vals?.type === 'film') grainFilm(film().material.uniforms, vals, ctx); else { const u = a.material.uniforms; u.uFrame.value = u._speed > 0 ? Math.floor(ctx.time * u._speed) : 0; } },
        render(renderer, write, read) { const p = cur(); p.renderToScreen = this.renderToScreen; p.render(renderer, write, read); } }; },
    frame: (pass, ctx) => pass.tick(ctx),
    fold: { ok: v => v.type === 'animated', set: (u, v) => { u.uGrAmt.value = v.amount; u.uGrSize.value = v.size; u.uGrResp.value = v.response; u.uGrColor.value = v.color === 'colour' ? 1 : 0; u.uGrSpeed.value = v.speed; } } },
  FILM,
  { name: 'dither', title: 'Dither', order: 100, hint: 'ordered dither to a few levels per channel, or to a palette of N colours',
    fields: { on: { v: false }, pattern: { v: 'bayer4', options: DITHERS }, pixel: n(1, 1, 8, 1, 'pixel size'), levels: n(6, 2, 32, 1, 'levels per channel'),
      palette: { v: 'none', options: PALETTE_NAMES, hint: 'none = posterize per channel; otherwise the nearest of the palette’s first N colours' }, colors: n(8, 2, 16, 1, 'palette colours (N)'), strength: n(1, 0, 1.5, .01) },
    make: ctx => { const pal = Array.from({ length: 16 }, () => new THREE.Vector3());
      return simple(ctx, DITHER, { tMat: U(null), uMatSize: U(4), uPixel: U(1), uLevels: U(6), uStrength: U(1), uUsePal: U(0), uN: U(8), uSpread: U(.5), uPal: U(pal) }, (u, v) => {
        const t = matrixTexture(v.pattern); u.tMat.value = t; u.uMatSize.value = t.size; u.uPixel.value = Math.max(1, Math.round(v.pixel)); u.uLevels.value = Math.max(2, Math.round(v.levels));
        u.uStrength.value = v.strength; u.uUsePal.value = v.palette !== 'none' ? 1 : 0;
        if (v.palette !== 'none') { const P = paletteOf(v.palette, v.colors); u.uN.value = P.length; P.forEach((c, i) => pal[i].set(...c)); u.uSpread.value = .75 / Math.cbrt(P.length); } }); } },
  { name: 'letterbox', title: 'Letterbox', order: 110, fields: { on: { v: false }, aspect: { v: '2.39', options: ['2.39', '2.00', '1.85', '1.66', '1.33'] }, opacity: n(1, 0, 1, .01), color: { v: '#000000', color: true } },
    make: ctx => simple(ctx, LETTERBOX, { uAspect: U(2.39), uOpacity: U(1), uColor: U(C3('#000')) }, (u, v) => { u.uAspect.value = +v.aspect; u.uOpacity.value = v.opacity; u.uColor.value.set(...hex3(v.color)); }) },
];
