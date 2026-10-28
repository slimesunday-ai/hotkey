// FILM EMULATION (2026-10-05) · a real film look as one cheap pass of the post stack, driven by its own settings sections (all OFF,
// so the default render is unchanged). Research and sources: style/research/film-emulation-2026-10-05.md.
//   film       the stack entry ("Film emulation", post group): the master switch and the FILM FRAME RATE (12–30 fps, or every
//              rendered frame). Every artefact below changes once per film frame, so at 18 or 24 fps it holds for 2–3 city frames.
//   stock      the film stock's colour response: an analytic negative → print model per stock (per-layer gamma, toe and shoulder,
//              dye cross-talk, black and white density limits, hue nudges) baked into a 32³ LUT; toe and shoulder trims on top
//   weave      gate weave and judder: sub-pixel wander of the image in the gate, mostly sideways, plus rare vertical registration slips
//   flicker    projector (per frame) or exposure (slow) luminance flicker
//   dust       dirt in the gate for 1–2 frames: specks, lint and hairs, black (on the print) and white (on the negative); a hair stuck
//              in the gate for a few seconds, optional
//   scratches  emulsion scratches that persist for seconds and wander a little sideways; occasional brief bright base scratches
//   leaks      light leaks and burns: a warm glow flaring in from a frame edge now and then
//   gate       the projector gate: frame aspect, soft edges, rounded corners; optional frame lines or a Super 8 / 16 mm strip with perforations
// The film grain is the grain section's `film` type (fx.js): luminance-dependent, per-layer dye clouds, sized by the film format, new
// each film frame. Everything here is in DISPLAY values (post.js) and sized in px at a 1080 px tall frame, scaled to the frame being
// drawn, so a 4K still has the same film as the screen. Generation is deterministic per film frame (and `roll`): a still or a clip
// frame is reproducible. The film clock is the frame's own time (main.js's t), so api.tick() steps it in shots and tests.
import * as THREE from 'three';
import * as S from './settings.js';
import { hex3 } from './luts.js';

// ── small deterministic randomness (per film frame, slot and roll)
function hs(a, b = 0, c = 0, d = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e37, 0x165667b1) ^ Math.imul((c | 0) + 0x7f4a, 0x85ebca77) ^ Math.imul((d | 0) + 0x3c6e, 0xc2b2ae3d);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296;
}
const vn = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hs(i, s) * (1 - u) + hs(i + 1, s) * u) * 2 - 1; };   // smooth 1D noise, −1…1
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), luma = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];

// ── the film clock
const FPS = { '12': 12, '16': 16, '18': 18, '24': 24, '25': 25, '30': 30 };
export const filmFps = () => FPS[S.get('film')?.fps] || 0;   // 0 = every rendered frame
export function filmFrame(ctx) { const f = filmFps(); return f ? Math.floor((ctx.time || 0) * f) : (ctx.frame | 0); }

// ── FILM STOCKS: display rgb → display rgb. An analytic stand-in for exposure → negative density → print density → light, per layer:
// cross-talk in linear light (the dye's unwanted absorptions and interlayer effects: saturation and hue), a per-layer gamma (where
// each layer sits: colour crossover from shadows to highlights), toe and shoulder (the print's dense blacks and rolled highlights),
// black and white limits (D-max and D-min: a print white is never pure, a faded print's black is never deep), a saturation and a hook
// for hue-selective nudges. Homages only, tuned by eye against the research: no third-party LUT data.
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const satM = s => { const r = .2126, g = .7152, b = .0722; return [r + (1 - r) * s, g - g * s, b - b * s, r - r * s, g + (1 - g) * s, b - b * s, r - r * s, g - g * s, b + (1 - b) * s]; };
const mul = (M, c) => [M[0] * c[0] + M[1] * c[1] + M[2] * c[2], M[3] * c[0] + M[4] * c[1] + M[5] * c[2], M[6] * c[0] + M[7] * c[1] + M[8] * c[2]];
const mm = (A, B) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return o; };
const hue = c => { const mx = Math.max(...c), mn = Math.min(...c), d = mx - mn; if (d < 1e-5) return [0, 0]; let h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; return [(h * 60 + 360) % 360, d / Math.max(mx, 1e-5)]; };
const near = (h, at, w) => { const d = Math.abs(((h - at + 540) % 360) - 180); return clamp(1 - d / w); };
export const STOCKS = {
  'print': { label: 'neutral print', g: [1, 1, 1], toe: [.45, .45, .42], sh: [.28, .28, .24], blk: [.012, .012, .016], wht: [.975, .968, .945], sat: 1.06 },
  'portrait 400': { label: 'portrait 400 · warm, soft neg', x: satM(.94), g: [.97, .995, 1.05], toe: [.06, .1, .08], sh: [.36, .32, .22], blk: [.032, .026, .024], wht: [.985, .965, .9], sat: .92,
    hook: (c, h, s) => { const sk = near(h, 28, 30) * s; c[0] += .02 * sk; c[2] -= .015 * sk; const gr = near(h, 110, 40) * s; c[0] += .04 * gr * c[1]; c[2] -= .02 * gr; } },
  'tungsten 500T': { label: 'tungsten 500T + print · cinema', x: satM(1.02), g: [1.02, 1, .955], toe: [.62, .56, .44], sh: [.3, .3, .2], blk: [.004, .014, .03], wht: [.975, .955, .885], sat: 1,
    hook: (c, h, s) => { const t = near(h, 200, 50) * s; c[1] += .015 * t; const o = near(h, 30, 35) * s; c[0] += .025 * o; } },
  'consumer 400': { label: 'consumer 400 · cool, green shadows', x: satM(1.1), g: [1.01, .975, .985], toe: [.42, .34, .38], sh: [.2, .26, .16], blk: [.008, .03, .03], wht: [.96, .975, .935], sat: 1.1,
    hook: (c, h, s) => { const gr = near(h, 120, 45) * s; c[2] += .03 * gr; c[0] -= .02 * gr; const m = near(h, 330, 40) * s; c[0] += .02 * m; } },
  'pastel 400': { label: 'pastel 400 · airy, mint and cyan', x: satM(.86), g: [1.04, .975, .97], toe: [-.18, -.22, -.24], sh: [.42, .42, .36], blk: [.05, .062, .068], wht: [.97, .985, .965], sat: .84,
    hook: (c, h, s) => { const gr = near(h, 110, 50) * s; c[2] += .05 * gr; c[0] -= .03 * gr; const sk = near(h, 25, 30) * s; c[0] += .015 * sk; c[1] += .01 * sk; } },
  'slide 64': { label: 'slide 64 · deep, punchy reds', x: mm(satM(1.16), [1.03, -.02, -.01, -.01, 1.0, .01, -.02, -.03, 1.05]), g: [.97, 1, 1.06], toe: [.78, .76, .7], sh: [.22, .2, .14], blk: [.004, .004, .01], wht: [.97, .95, .885], sat: 1.18,
    hook: (c, h, s) => { const r = near(h, 5, 30) * s; c[0] += .03 * r; c[1] -= .015 * r; const b = near(h, 215, 40) * s; c[2] -= .03 * b; c[0] -= .02 * b; const y = near(h, 50, 25) * s; c[0] += .02 * y; } },
  'slide 100': { label: 'slide 100 · clean, cool, saturated', x: satM(1.14), g: [1.01, 1, .975], toe: [.62, .62, .6], sh: [.16, .16, .2], blk: [.005, .008, .016], wht: [.96, .972, .985], sat: 1.14,
    hook: (c, h, s) => { const b = near(h, 210, 45) * s; c[2] += .02 * b; } },
  'super 8 reversal': { label: 'super 8 reversal · warm, contrasty', x: satM(1.08), g: [.975, 1, 1.05], toe: [.6, .58, .52], sh: [.32, .3, .2], blk: [.022, .016, .02], wht: [.985, .94, .845], sat: 1.1 },
  'faded print': { label: 'faded print · magenta, lifted', x: [1.02, .03, -.05, .06, .9, .04, .05, .06, .89], g: [.9, 1.05, 1.02], toe: [-.32, -.22, -.26], sh: [.22, .1, .05], blk: [.1, .062, .08], wht: [.99, .885, .865], sat: .72 },
  'warm print': { label: 'warm print', g: [.96, .99, 1.05], toe: [.36, .4, .5], sh: [.4, .35, .2], blk: [.03, .02, .01], wht: [1, .95, .85], sat: .95 },
  'cross-process': { label: 'cross-process · slide in neg chemistry', x: satM(1.15), g: [.95, .92, 1.22], toe: [.7, .42, -.3], sh: [.6, .7, -.2], blk: [0, .02, .1], wht: [1, 1, .8], sat: 1.22 },
};
export const STOCK_NAMES = Object.keys(STOCKS);
export function stockFn(name, toeU = 0, shU = 0) {
  const P = STOCKS[name] || STOCKS.print, X = P.x || I3;
  return c => {
    let l = mul(X, c.map(x => Math.pow(clamp(x), 2.2))).map(x => Math.max(0, x));                // cross-talk in linear light
    let d = l.map((x, i) => {
      x = Math.pow(Math.min(1, x), P.g[i] / 2.2);                                                // back to display, per-layer gamma
      const t = clamp(P.toe[i] + toeU, -1, 1), s = clamp(P.sh[i] + shU, -1, 1);
      x = x - t * x * (1 - x) * (1 - x) + s * x * x * (1 - x);                                   // toe (dense or lifted blacks) and shoulder (rolled highlights)
      return P.blk[i] + (P.wht[i] - P.blk[i]) * x;                                               // D-max and D-min
    });
    if (P.hook) { const [h, s] = hue(d); P.hook(d, h, s * clamp(luma(d) * 3)); }
    const y = luma(d); return d.map(x => y + (x - y) * P.sat);
  };
}
const lutCache = new Map();
function stockLut(name, toeU, shU) {
  const k = `${name}|${toeU}|${shU}`; if (lutCache.has(k)) return lutCache.get(k);
  const f = stockFn(name, toeU, shU), N = 32, data = new Uint8Array(N * N * N * 4);
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const o = f([r / (N - 1), g / (N - 1), b / (N - 1)]), i = ((b * N + g) * N + r) * 4;
    data[i] = Math.round(clamp(o[0]) * 255); data[i + 1] = Math.round(clamp(o[1]) * 255); data[i + 2] = Math.round(clamp(o[2]) * 255); data[i + 3] = 255;
  }
  const t = new THREE.Data3DTexture(data, N, N, N); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; t.unpackAlignment = 1; t.needsUpdate = true; t.size = N;
  if (lutCache.size > 24) { const [k0, t0] = lutCache.entries().next().value; t0.dispose(); lutCache.delete(k0); }
  lutCache.set(k, t); return t;
}

// ── FILM GRAIN (the grain section's `film` type, fx.js): a tileable noise texture made here (per channel: white noise, a small blur,
// normalised), sampled twice per pixel — a fine layer and a coarser, rotated "clump" layer, at incommensurate scales so the tile never
// shows — at a new random offset each film frame. Per-layer dye clouds: green finest, blue coarsest; part of the noise is shared by the
// three layers (the silver image), the rest is each layer's own. Amplitude follows the film curve: most in the shadows and mid-tones,
// least in the highlights. Format sets the grain's size and strength relative to the frame (the same emulsion enlarged more).
export const FORMATS = { '35 mm': { size: 1.1, amp: .72 }, '16 mm': { size: 2.1, amp: 1 }, '8 mm': { size: 3.5, amp: 1.3 } };   // (clumps of ~10–30 µm on a 25 / 10 / 5.5 mm wide frame)
let NOISE = null;
export function grainNoise() {
  if (NOISE) return NOISE; const N = 256, C = 4, a = new Float32Array(N * N * C), b = new Float32Array(N * N * C); let s = 20261005;
  const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let i = 0; i < a.length; i++) a[i] = rnd();
  const K = [.25, .5, .25];   // a [1 2 1] blur, wrapped: grains a little rounder than a texel
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let c = 0; c < C; c++) { let v = 0; for (let k = -1; k <= 1; k++) v += K[k + 1] * a[(y * N + ((x + k + N) % N)) * C + c]; b[(y * N + x) * C + c] = v; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let c = 0; c < C; c++) { let v = 0; for (let k = -1; k <= 1; k++) v += K[k + 1] * b[(((y + k + N) % N) * N + x) * C + c]; a[(y * N + x) * C + c] = v; }
  const out = new Uint8Array(N * N * C);
  for (let c = 0; c < C; c++) { let m = 0, q = 0; for (let i = c; i < a.length; i += C) { m += a[i]; q += a[i] * a[i]; } m /= N * N; const sd = Math.sqrt(q / (N * N) - m * m);
    for (let i = c; i < a.length; i += C) out[i] = Math.round(clamp(.5 + (a[i] - m) / sd * .16) * 255); }
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return (NOISE = t);
}
export const FILM_GRAIN = `uniform sampler2D tNoise; uniform float uAmount, uResp, uColor, uScale; uniform vec4 uOff;
void main() { vec3 c = tex(vUv); vec2 p = gl_FragCoord.xy / (256. * uScale), q = mat2(.8253, .5646, -.5646, .8253) * p * .53;
  vec4 a = texture2D(tNoise, p + uOff.xy) - .5, b = texture2D(tNoise, q + uOff.zw) - .5, bb = texture2D(tNoise, p * .7 + uOff.yx) - .5;   // (bb: the blue layer, ~1.4× coarser)
  // crisp grains: the smooth field pushed through a steep soft-sign, so each clump is nearly all-or-nothing (the Boolean grain model,
  // seen through a ~1 px viewing blur) rather than a soft blob; the shared part is the silver image, the rest each dye layer's own
  float m = .8 * a.a + .6 * b.a; vec3 ch = vec3(.8 * a.r + .55 * b.r, .9 * a.g + .4 * b.g, .55 * bb.b + .8 * b.b);
  m *= 7.; m /= sqrt(1. + m * m); ch *= 7.; ch /= sqrt(1. + ch * ch);
  vec3 n = (uColor > .5 ? mix(vec3(m), ch * vec3(1., .92, 1.12), .42) : vec3(m)) * .4;
  vec2 g = gl_FragCoord.xy + floor(uOff.xy * 997.); vec3 f = fract(sin(vec3(dot(g, vec2(12.9898, 78.233)), dot(g, vec2(39.346, 11.135)), dot(g, vec2(73.156, 52.235)))) * 43758.5453) - .5;
  n += (uColor > .5 ? mix(f.xxx, f, .4) : f.xxx) * .3;   // (the single grains under the clumps: a crisp 1 px texture)
  float l = clamp(luma(c), 0., 1.), w = mix(1., 2.4 * sqrt(max(l, 1e-4)) * pow(1. - l, .9) + .06, uResp);   // (≈ √(u(1−u)), peaking a little below mid-grey)
  gl_FragColor = vec4(c + n * uAmount * w, 1.); }`;
export function grainFilm(u, v, ctx) {   // per film frame: new offsets; size by the format and the frame's height
  const F = FORMATS[v.format] || FORMATS['16 mm'], f = filmFrame(ctx), r = (k) => hs(f, 91, k, S.get('film')?.roll | 0);
  u.uOff.value.set(r(0), r(1), r(2), r(3)); u.uScale.value = Math.max(.35, F.size * v.size * ctx.size.y / 1080); u.uAmount.value = v.amount * F.amp;
}

// ── THE FILM PASS: one shader for stock, flicker, weave, dust, scratches, leaks and the gate
const MAXD = 14, MAXS = 8;
const FRAG = `uniform highp sampler3D tLut; uniform vec3 uFlick; uniform float uK, uStock, uBorder, uGateOn, uScrTone;
uniform vec2 uWeave; uniform vec4 uLeak, uLeakB, uGate, uFr, uPerf, uEdge; uniform vec3 uLeakC, uGateC; uniform float uPitch;
uniform int uDN, uSN; uniform vec4 uD0[${MAXD}], uD1[${MAXD}], uS0[${MAXS}], uS1[${MAXS}];
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.), f * f * (3. - 2. * f)); }
vec3 look(vec2 uv) { vec3 c = tex(clamp(uv, vec2(.5) / uRes, 1. - vec2(.5) / uRes)); c = (c == c) ? max(c, 0.) : vec3(0.);
  if (uStock > 0.) { vec3 u = clamp(c, 0., 1.) * (31. / 32.) + .5 / 32.; c = mix(c, texture(tLut, u).rgb, uStock); }
  return c * (uFlick.x + uFlick.y * (uv.x - .5) + uFlick.z * (uv.y - .5)); }   // (gain, plus a smooth gradient across the frame)
void main() {
  vec2 p = gl_FragCoord.xy, s = p - uWeave, uv;   // s: film coordinates (the strip moves with the weave)
  float frame = 1., perf = 0., base = 0.;
  if (uBorder < .5) uv = s / uRes;
  else { float fy = (s.y - uFr.y) / uPitch, fi = floor(fy + .5); vec2 q = vec2(s.x - uFr.x, (fy - fi) * uPitch);   // px from the nearest frame's centre
    uv = .5 + q / (2. * uFr.w) * vec2(uRes.y / uRes.x, 1.);
    frame = clamp(.5 - rbox(q, uFr.zw, uFr.w * .06) / max(uK * 1.2, .6), 0., 1.);
    vec2 pq = vec2(s.x - uPerf.x, mod(q.y - uPerf.y + .5 * uPitch, uPitch) - .5 * uPitch);
    perf = clamp(.5 - rbox(pq, uPerf.zw, min(uPerf.z, uPerf.w) * .45) / max(uK * 1.5, .6), 0., 1.);
    if (uBorder > 2.5) { vec2 pq2 = vec2(s.x - (2. * uFr.x - uPerf.x), pq.y); perf = max(perf, clamp(.5 - rbox(pq2, uPerf.zw, min(uPerf.z, uPerf.w) * .45) / max(uK * 1.5, .6), 0., 1.)); }
    base = clamp(min(s.x - uEdge.x, uEdge.y - s.x) / max(uK * 2., .6), 0., 1.); }
  vec3 c = look(uv);
  // light leak / burn: a warm glow from a frame edge (screen blend), a hotter core near the edge
  if (uLeak.w > 0.) { vec2 d = (s - uLeak.xy) / (uLeakB.xy * uRes.y); float g = exp(-dot(d, d) * 2.), g2 = exp(-dot(d, d) * 9.);
    vec3 L = uLeak.w * (uLeakC * g + vec3(1., .86, .6) * g2 * .7); c = 1. - (1. - clamp(c, 0., 1.)) * (1. - clamp(L, 0., 1.)); }
  // scratches: emulsion (persist, wander, dark or tinted) and base (brief, bright)
  for (int i = 0; i < ${MAXS}; i++) { if (i >= uSN) break; vec4 a = uS0[i], b = uS1[i];
    float y = s.y / uRes.y, x = a.x * uRes.x + (a.y + b.z * (y - .5) + .6 * sin(y * 7. + b.y * 40.) * a.z) * uK;
    float dx = abs(s.x - x), w = a.z * uK * .5; if (dx > w + 2.) continue;
    float along = smoothstep(.15, .45, n1(y * (2. + 4. * b.w) + b.y * 91.)) * (.7 + .3 * n1(y * 40. + b.y * 13.));
    float k = (1. - smoothstep(w - .5, w + .9, dx)) * a.w * along;
    if (b.x < .5) c *= 1. - .8 * k; else if (b.x < 1.5) c = mix(c, vec3(.93, .94, .9), k); else c = mix(c, c * vec3(.55, 1.05, .95) + vec3(0., .28, .2), k); }
  // dust: specks, lint, hairs (black: dirt on the print; white: dirt on the negative)
  for (int i = 0; i < ${MAXD}; i++) { if (i >= uDN) break; vec4 a = uD0[i], b = uD1[i];
    vec2 o = s - a.xy * uRes; float sz = a.z * uK, R = b.x > 1.5 ? sz * 1.2 : sz * 1.6 + 2.; if (dot(o, o) > R * R) continue;
    float cs = cos(a.w), sn = sin(a.w); vec2 q = mat2(cs, -sn, sn, cs) * o; float al = 0.;
    if (b.x < .5) { float an = atan(q.y, q.x), r = sz * .5 * (1. + .26 * sin(3. * an + b.w * 6.3) + .14 * sin(5. * an + b.w * 17.) + .1 * sin(2. * an + b.w * 3.1));
      al = 1. - smoothstep(r - .6, r + .7, length(q)); }
    else if (b.x < 1.5) { q.x *= .45; float an = atan(q.y, q.x), r = sz * .42 * (1. + .3 * sin(7. * an + b.w * 9.) + .22 * sin(11. * an + b.w * 23.) + .18 * sin(3. * an + b.w * 5.));
      al = (1. - smoothstep(r - .8, r + .8, length(q))) * (.55 + .45 * n1(q.x * .7 + q.y * .9 + b.w * 50.)); }
    else { float Rc = sz / (.6 + 2.2 * fract(b.w * 7.13)), span = sz / Rc; vec2 cc = vec2(0., Rc), d = q - cc; float an = atan(d.x, -d.y);
      float rr = Rc + .9 * uK * sin(an * 9. + b.w * 20.), dd = abs(length(d) - rr), th = (.55 + .5 * fract(b.w * 3.7)) * uK;
      al = (1. - smoothstep(th, th + .9, dd)) * smoothstep(.5 * span, .5 * span - .12, abs(an)); }
    al *= b.z; c = mix(c, b.y > 0. ? vec3(.94, .93, .89) : vec3(.035, .03, .028), clamp(al, 0., 1.)); }
  // the gate: frame aspect, soft edges, rounded corners (fixed: the projector's aperture), or the strip's frame, base and perforations
  if (uBorder < .5) { if (uGateOn > .5) { float g = clamp(.5 - rbox(p - .5 * uRes, uGate.xy, uGate.z) / max(uGate.w, .5), 0., 1.); c = mix(uGateC, c, g); } }
  else { vec3 film = uBorder < 1.5 ? vec3(.012, .011, .01) : vec3(.03, .026, .022); c = mix(film, c, frame); c = mix(c, vec3(.96, .95, .9), perf); c = mix(uGateC, c, uBorder < 1.5 ? 1. : base); }
  gl_FragColor = vec4(c, 1.); }`;

let VER = 0;   // (bumped by every film section's change: the pass recomputes its frame state)
const SUBS = ['stock', 'weave', 'flicker', 'dust', 'scratches', 'leaks', 'gate'];
const subLive = { stock: v => v.amount > 0, weave: v => v.amount > 0, flicker: v => v.amount > 0, dust: v => v.density > 0 || v.gatehair > 0, scratches: v => v.density > 0 || v.base > 0, leaks: v => v.amount > 0 && v.rate > 0, gate: () => true };
const anyLive = () => SUBS.some(n => { const v = S.get(n); return v && v.on && subLive[n](v); });
const LEAKC = { warm: '#ff7a2c', red: '#ff3c1e', golden: '#ffb444', magenta: '#ff4f7a' };
const ASPECT = a => a === 'screen' ? 0 : +a;

function make(ctx) {
  const V3 = () => new THREE.Vector3(), V4 = () => new THREE.Vector4(), U = v => ({ value: v });
  const D0 = Array.from({ length: MAXD }, V4), D1 = Array.from({ length: MAXD }, V4), S0 = Array.from({ length: MAXS }, V4), S1 = Array.from({ length: MAXS }, V4);
  const m = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;\nfloat luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }\nvec3 tex(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }\n` + FRAG,
    uniforms: { tDiffuse: U(null), uRes: U(new THREE.Vector2(1, 1)), tLut: U(stockLut('print', 0, 0)), uK: U(1), uStock: U(0), uFlick: U(new THREE.Vector3(1, 0, 0)), uBorder: U(0), uGateOn: U(0), uScrTone: U(0),
      uWeave: U(new THREE.Vector2()), uLeak: U(V4()), uLeakB: U(V4()), uLeakC: U(V3()), uGate: U(V4()), uGateC: U(V3()), uFr: U(V4()), uPerf: U(V4()), uEdge: U(V4()), uPitch: U(1),
      uDN: U(0), uSN: U(0), uD0: U(D0), uD1: U(D1), uS0: U(S0), uS1: U(S1) },
    depthTest: false, depthWrite: false, toneMapped: false });
  const TRI = new THREE.BufferGeometry(); TRI.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)); TRI.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const q = new THREE.Mesh(TRI, m), CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); q.frustumCulled = false;
  const u = m.uniforms; let key = '';

  // everything that changes per film frame, from the frame index, the roll and the sections' values (CPU, a few µs)
  function step(f, fps, W, H) {
    const roll = S.get('film').roll | 0, k = H / 1080, on = n => { const v = S.get(n); return v && v.on ? v : null; };
    // stock
    const st = on('stock'); u.uStock.value = st ? st.amount : 0; if (st) u.tLut.value = stockLut(st.stock, st.toe, st.shoulder);
    // flicker
    const fl = on('flicker'); let F = 1;
    if (fl) { const proj = hs(f, 21, roll) * 2 - 1, expo = vn(f * 6 / fps, 22 + roll); F = 1 + fl.amount * (fl.style === 'projector' ? proj : fl.style === 'exposure' ? expo : .6 * proj + .55 * expo); }
    u.uFlick.value.set(F, fl ? fl.amount * .9 * (hs(f, 23, roll) * 2 - 1) : 0, fl ? fl.amount * .9 * (hs(f, 24, roll) * 2 - 1) : 0);
    // weave: a slow sideways wander plus frame-to-frame jitter; vertical registration jitter and rare slips (judder)
    const we = on('weave'); let wx = 0, wy = 0;
    if (we) { const a = we.amount; wx = a * (.7 * vn(f * 2.6 / fps, 11 + roll) + .4 * (hs(f, 12, roll) * 2 - 1));
      wy = a * we.vertical * (.45 * vn(f * 3.4 / fps, 13 + roll) + .55 * (hs(f, 14, roll) * 2 - 1));
      const slip = Math.floor(f / 2); if (hs(slip, 15, roll) < we.judder * .06) wy += a * (1.6 + 2.2 * hs(slip, 16, roll)) * (hs(slip, 17, roll) < .5 ? -1 : 1); }
    u.uWeave.value.set(wx * k, wy * k);
    // dust: Poisson births per frame, a third of them stay two frames; a gate hair now and then, for seconds, trembling
    const du = on('dust'); let nD = 0;
    if (du) {
      for (const g of [f, f - 1]) {
        const L = Math.exp(-du.density); let p = 1, n = -1; do { n++; p *= hs(g, 31, n, roll); } while (p > L && n < 10);
        for (let i = 0; i < n && nD < MAXD - 1; i++) { const r = j => hs(g, 32 + j, i, roll);
          if (g !== f && r(0) > .33) continue;   // (born last frame: a third live two frames)
          const t = r(1), type = t < du.hairs * .3 ? 2 : t < du.hairs ? 1 : 0, z = r(2);
          const size = du.size * (type === 2 ? 26 + 64 * z : type === 1 ? 5 + 11 * z : 1.4 + 5.2 * z * z);
          D0[nD].set(r(3), r(4), size, r(5) * 6.283); D1[nD].set(type, r(6) < du.white ? 1 : -1, type === 1 ? .55 + .3 * r(7) : .6 + .4 * r(7), r(8)); nD++; }
      }
      if (du.gatehair > 0) { const E = Math.max(1, Math.round(fps * 4)), e = Math.floor(f / E), age = f - e * E, len = Math.round(fps * (1.2 + 2.5 * hs(e, 61, roll)));
        if (hs(e, 62, roll) < du.gatehair && age < len) { const side = Math.floor(hs(e, 63, roll) * 4), along = .15 + .7 * hs(e, 64, roll), jit = (hs(f, 65, roll) - .5) * .05;
          const x = side === 0 ? .01 : side === 1 ? .99 : along, y = side < 2 ? along : side === 2 ? .015 : .985, rot = [Math.PI * .5, -Math.PI * .5, 0, Math.PI][side] + (hs(e, 66, roll) - .5) * .8 + jit;
          D0[nD].set(x, y, du.size * (40 + 70 * hs(e, 67, roll)), rot); D1[nD].set(2, -1, .85, hs(e, 68, roll)); nD++; } }
    }
    u.uDN.value = nD;
    // scratches: slots, each living an epoch of `persistence` s (±50 %); x wanders a little per frame; base scratches brief and bright
    const sc = on('scratches'); let nS = 0;
    if (sc) { const per = Math.max(2, Math.round(sc.persistence * fps)), tone = sc.tone === 'bright' ? 1 : sc.tone === 'green' ? 2 : 0;
      for (let i = 0; i < 6 && nS < MAXS; i++) { const E = Math.max(2, Math.round(per * (.5 + hs(i, 41, roll)))), ph = Math.floor(hs(i, 42, roll) * E), e = Math.floor((f + ph) / E), age = f + ph - e * E;
        if (hs(i, e, 43, roll) > sc.density * .5) continue; const r = j => hs(i, e, 44 + j, roll);
        const x = .03 + .94 * r(0) + (r(1) - .5) * .03 * age / E, jit = sc.wander * (hs(f, i, 47, roll) - .5) * 2;
        const mixed = sc.tone === 'mixed' ? (r(2) < .7 ? 0 : r(2) < .85 ? 1 : 2) : tone;
        S0[nS].set(x, jit, sc.width * (.7 + .9 * r(3)), .35 + .4 * r(4)); S1[nS].set(mixed, r(5), (r(6) - .5) * 6, r(7)); nS++; }
      if (sc.base > 0) for (let i = 0; i < 2 && nS < MAXS; i++) { const E = Math.max(2, Math.round(fps * (.12 + .2 * hs(i, 51, roll)))), e = Math.floor(f / E);
        if (hs(i, e, 52, roll) > sc.base * .08) continue; const r = j => hs(i, e, 53 + j, roll);
        S0[nS].set(.05 + .9 * r(0), (hs(f, i, 57, roll) - .5) * 2 * sc.wander, sc.width * (1.6 + 1.4 * r(1)), .4 + .3 * r(2)); S1[nS].set(1, r(3), (r(4) - .5) * 14, r(5) * .4); nS++; } }
    u.uSN.value = nS;
    // light leaks: about `rate` a minute, each 0.6–2.4 s, rising and falling, flickering a little per frame, from a side edge
    const lk = on('leaks'); u.uLeak.value.w = 0;
    if (lk && lk.rate > 0) { const E = Math.max(2, Math.round(fps * 60 / lk.rate)), e = Math.floor(f / E), age = f - e * E, dur = Math.round(fps * (.6 + 1.8 * hs(e, 71, roll)));
      if (hs(e, 72, roll) < .8 && age < dur) { const ph = age / dur, env = Math.sin(Math.PI * ph) ** 2 * (.88 + .24 * hs(f, 73, roll)), side = hs(e, 74, roll);
        const ly = (.25 + .5 * hs(e, 75, roll) + (ph - .5) * .12) * H, lx = side < .45 ? -.02 * H : side < .9 ? W + .02 * H : .5 * W;
        u.uLeak.value.set(lx, side < .9 ? ly : (hs(e, 76, roll) < .5 ? -.02 * H : H * 1.02), 0, lk.amount * env);
        const sz = lk.size; u.uLeakB.value.set(side < .9 ? .32 * sz : .7 * sz, side < .9 ? .62 * sz : .28 * sz, 0, 0); u.uLeakC.value.set(...hex3(LEAKC[lk.color] || LEAKC.warm)); } }
    // the gate and the strip
    const ga = on('gate'); u.uGateOn.value = ga ? 1 : 0; u.uBorder.value = 0;
    if (ga) { const A = ASPECT(ga.aspect), sa = W / H; let gw = W / 2, gh = H / 2; if (A) { if (A < sa) gw = gh * A; else gh = gw / A; }
      u.uGate.value.set(gw, gh, ga.corners * 2 * gh, Math.max(.5, ga.softness * k)); u.uGateC.value.set(...hex3(ga.color));
      const B = { 'frame lines': 1, 'super 8': 2, '16 mm': 3 }[ga.borders] || 0; u.uBorder.value = B;
      if (B === 1) { const fh = H * .47; u.uFr.value.set(W / 2, H / 2, W / 2 + 4, fh); u.uPitch.value = H * .962; u.uPerf.value.set(-1e5, 0, 1, 1); u.uEdge.value.set(-1e5, 1e5, 0, 0); }
      if (B === 2) { const mm = H * .82 / 4.01, cx = W / 2 + .45 * mm; u.uFr.value.set(cx, H / 2, 5.36 * mm / 2, 4.01 * mm / 2); u.uPitch.value = 4.234 * mm;
        u.uPerf.value.set(cx - 5.36 * mm / 2 - .95 * mm, 0, .914 * mm / 2, 1.143 * mm / 2); u.uEdge.value.set(cx - 5.36 * mm / 2 - 1.62 * mm, cx + 5.36 * mm / 2 + .97 * mm, 0, 0); }
      if (B === 3) { const mm = H * .8 / 7.49; u.uFr.value.set(W / 2, H / 2, 10.26 * mm / 2, 7.49 * mm / 2); u.uPitch.value = 7.62 * mm;
        u.uPerf.value.set(W / 2 - 10.26 * mm / 2 - 1.42 * mm, 7.62 * mm / 2, 1.83 * mm / 2, 1.27 * mm / 2); u.uEdge.value.set(W / 2 - 8 * mm, W / 2 + 8 * mm, 0, 0); } }
  }
  return { enabled: true, needsSwap: true, clear: false, renderToScreen: false, material: m, setSize() {}, dispose() { m.dispose(); TRI.dispose(); },
    update() { key = ''; },
    tick(c) { const f = filmFrame(c), fps = filmFps() || 60, W = c.size.x, H = c.size.y, kk = `${f}|${W}|${H}|${VER}`; if (kk !== key) { key = kk; step(f, fps, W, H); } u.uK.value = H / 1080; },
    render(renderer, write, read) { u.tDiffuse.value = ctx.take(read); u.uRes.value.copy(ctx.size); renderer.setRenderTarget(this.renderToScreen ? null : write); renderer.render(q, CAM); } };
}

// ── the sections: the stack entry first (fx.js lists FILM), then the film group, each with its own switch
const n = (v, min, max, step, label, hint) => ({ v, min, max, step, ...(label ? { label } : {}), ...(hint ? { hint } : {}) });
export const FILM = { name: 'film', title: 'Film emulation', order: 95,
  hint: 'the film sections below as one pass (switching one on switches this on); fps: how often dust, scratches, weave, flicker, leaks and film grain change',
  fields: { on: { v: false }, fps: { v: '24', options: ['12', '16', '18', '24', '25', '30', 'every frame'], label: 'film frame rate', hint: 'the film artefacts change this many times a second while the city renders at the screen’s rate' },
    roll: n(1, 1, 99, 1, 'roll', 'another roll of film: a different run of dust, scratches, weave and grain') },
  live: v => v.on && anyLive(), make, frame: (pass, ctx) => pass.tick(ctx) };
const G = { group: 'film' };
export function registerFilm(dirty) {
  const reg = (name, title, order, fields, hint) => S.register(name, fields, () => { VER++; dirty(); }, { ...G, title, order, hint });
  reg('stock', 'Film stock', 1, { on: { v: false }, stock: { v: 'print', options: STOCK_NAMES, hint: Object.entries(STOCKS).map(([k, s]) => `${k}: ${s.label}`).join(' · ') },
    amount: n(1, 0, 1, .01, 'amount'), toe: n(0, -1, 1, .01, 'toe', '+ denser, deeper blacks · − lifted, milky blacks'), shoulder: n(0, -1, 1, .01, 'shoulder', '+ highlights roll brighter into white · − flatter, duller tops') },
    'the colour response: per-layer curves, dye cross-talk, print blacks and whites (a 32³ LUT)');
  reg('weave', 'Gate weave', 2, { on: { v: false }, amount: n(.8, 0, 6, .05, 'amount (px)', 'at a 1080 px frame; mostly sideways'), vertical: n(.5, 0, 1.5, .01, 'vertical', 'up-down share of the wander'),
    judder: n(.2, 0, 1, .01, 'judder', 'how often the claw slips: a frame jumps up or down') }, 'the frame wobbling in the gate, once per film frame');
  reg('flicker', 'Flicker', 3, { on: { v: false }, amount: n(.03, 0, .25, .005, 'amount'), style: { v: 'both', options: ['projector', 'exposure', 'both'], hint: 'projector: every frame a little different · exposure: a slow breathing' } },
    'luminance flicker');
  reg('dust', 'Dust & dirt', 4, { on: { v: false }, density: n(.6, 0, 6, .05, 'density', 'new specks per film frame, on average'), size: n(1, .3, 3, .05),
    white: n(.35, 0, 1, .01, 'white share', 'white = dirt on the negative · black = dirt on the print'), hairs: n(.15, 0, 1, .01, 'lint & hairs', 'the share that are lint (fuzzy) and hairs (thin curls)'),
    gatehair: n(0, 0, 1, .01, 'gate hair', 'the chance, every few seconds, of a hair caught in the gate for 1–4 s') }, 'specks, lint and hairs for 1–2 frames');
  reg('scratches', 'Scratches', 5, { on: { v: false }, density: n(.3, 0, 1, .01, 'density', 'emulsion scratches: about 3 at once at 1'), width: n(1, .3, 3, .05, 'width (px)'),
    persistence: n(2.5, .2, 10, .1, 'persistence (s)', 'how long a scratch stays'), wander: n(.8, 0, 4, .05, 'wander (px)', 'sideways jitter per frame'),
    tone: { v: 'mixed', options: ['dark', 'bright', 'green', 'mixed'], hint: 'dark = a base scratch on the print · green = an emulsion scratch through the top (magenta) layer · bright = through every dye layer · mixed = mostly dark, a few green and bright' },
    base: n(.15, 0, 1, .01, 'base scratches', 'how often a brief bright base scratch flashes through') }, 'vertical scratches along the strip');
  reg('leaks', 'Light leaks', 6, { on: { v: false }, amount: n(.6, 0, 2, .01), rate: n(2, 0, 20, .1, 'per minute'), size: n(1, .3, 2, .01), color: { v: 'warm', options: Object.keys(LEAKC) } },
    'a glow flaring in from a frame edge now and then (a fogged edge, a burn)');
  reg('gate', 'Gate & borders', 7, { on: { v: false }, aspect: { v: 'screen', options: ['screen', '1.33', '1.37', '1.66', '1.85', '2.39'], hint: 'the projected frame; screen = the whole window' },
    corners: n(.035, 0, .15, .005, 'rounded corners'), softness: n(2.5, 0, 16, .1, 'soft edge (px)'), color: { v: '#070708', color: true, label: 'surround' },
    borders: { v: 'none', options: ['none', 'frame lines', 'super 8', '16 mm'], hint: 'frame lines: the frames above and below show past a thin line · super 8 / 16 mm: the strip, its base and perforations (the picture shrinks into the frame)' } },
    'the projector gate: aspect, soft edge, rounded corners, or the film strip');
  // switching a film section on (in the panel, not a look load) switches the film pass on
  S.on((sec, key, val) => { if (key === 'on' && val === true && SUBS.includes(sec) && !S.get('film')?.on) S.set('film', 'on', true); });
}
