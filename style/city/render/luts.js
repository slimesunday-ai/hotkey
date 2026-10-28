// Render pipeline pass · generated look-up data for the post stack, built lazily and cached: film-inspired 3D LUTs (no third-party LUT
// files: every LUT here is a small colour function of our own, sampled into a 32³ texture), ordered-dither matrices (Bayer 2/4/8), a
// 64×64 blue-noise tile (void-and-cluster, generated here) and the dither palettes. Everything works in display (sRGB-encoded) values.
import * as THREE from 'three';

const cache = new Map(), once = (k, f) => cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k));
const clamp = x => Math.max(0, Math.min(1, x)), luma = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const sc = (x, k) => { x = clamp(x); return x < .5 ? .5 * Math.pow(2 * x, k) : 1 - .5 * Math.pow(2 * (1 - x), k); };   // S-curve round .5
const sat = (c, s) => { const l = luma(...c); return c.map(x => l + (x - l) * s); };

// ── film-inspired LUTs: f([r, g, b]) → [r, g, b], all in 0–1 display values
export const LUTS = {
  'print-warm': c => {   // a warm print stock: soft S-curve, teal in the toe, amber in the shoulder, greens nudged toward yellow
    let [r, g, b] = c.map(x => sc(x, 1.22)); const l = luma(r, g, b), sh = (1 - l) ** 2, hi = l * l;
    r += -.025 * sh + .05 * hi; g += .012 * sh + .018 * hi; b += .045 * sh - .05 * hi;
    if (g > r && g > b) r += .25 * (g - Math.max(r, b)) * .3;
    return sat([r, g, b], .9);
  },
  'neg-cool': c => {   // a cool negative scan: low contrast, lifted toe, green-cyan shadows, a pinkish cream top
    let [r, g, b] = c.map(x => .035 + .94 * sc(x, .9)); const l = luma(r, g, b), sh = (1 - l) ** 2, hi = l * l;
    r += -.02 * sh + .025 * hi; g += .025 * sh - .008 * hi; b += .02 * sh + .01 * hi;
    return sat([r, g, b], .84);
  },
  'bleach': c => {   // bleach bypass: the silver left in, so half the colour goes and the contrast climbs; a cold steel cast
    const [r, g, b] = sat(c, .45).map(x => sc(x, 1.55)); return [r * .98, g, b * 1.03];
  },
  'cross': c => {   // cross-processed slide: hard red/green curves, blue lifted in the shadows and crushed in the highlights
    const r = sc(c[0], 1.45), g = .02 + .96 * sc(c[1], 1.2), b = .16 + .68 * sc(c[2], .85);
    return sat([r, g, b], 1.15);
  },
  'seventies': c => {   // a faded 70s print: milky warm blacks, dulled blues, a slight midtone lift
    let [r, g, b] = c.map(x => Math.pow(clamp(x), .92)); r = .07 + .92 * r * 1.04; g = .06 + .9 * g; b = .05 + .82 * b;
    return sat([r, g, b], .78);
  },
  'silver': c => {   // black-and-white through a red filter (skies darken, walls glow), a firm curve and a faint warm tone
    const l = sc(clamp(.5 * c[0] + .4 * c[1] + .1 * c[2]), 1.3); return [l * 1.02, l, l * .95];
  },
};
export const LUT_NAMES = ['none', ...Object.keys(LUTS)];
export const LUT_SIZE = 32;
export function lutTexture(name) {
  return once('lut:' + name, () => {
    const f = LUTS[name] || (c => c), N = name in LUTS ? LUT_SIZE : 2, data = new Uint8Array(N * N * N * 4);
    for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
      const o = f([r / (N - 1), g / (N - 1), b / (N - 1)]), i = ((b * N + g) * N + r) * 4;
      data[i] = Math.round(clamp(o[0]) * 255); data[i + 1] = Math.round(clamp(o[1]) * 255); data[i + 2] = Math.round(clamp(o[2]) * 255); data[i + 3] = 255;
    }
    const t = new THREE.Data3DTexture(data, N, N, N); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
    t.size = N; return t;
  });
}

// ── dither threshold matrices: a DataTexture of n×n thresholds in (0, 1), repeat-wrapped, nearest-sampled
function bayer(n) {   // M(2m) = 4·M(m) + M(2) per quadrant, M(2) = [[0, 2], [3, 1]]
  let M = [[0]]; const B = [[0, 2], [3, 1]];
  while (M.length < n) { const m = M.length; M = Array.from({ length: 2 * m }, (_, y) => Array.from({ length: 2 * m }, (_, x) => 4 * M[y % m][x % m] + B[+(y >= m)][+(x >= m)])); }
  return M.flat();
}
// void-and-cluster (Ulichney 1993) on a 64×64 torus, Gaussian σ 1.5 over the whole tile (float64, so far-away energies still order
// the voids): a relaxed random initial pattern, then ranks by removing the tightest clusters, then by filling the largest voids
function blueNoise(n = 64, seed = 20260928) {
  const N = n * n, K = new Float64Array(N), E = new Float64Array(N), on = new Uint8Array(N), rank = new Int32Array(N);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = Math.min(x, n - x), dy = Math.min(y, n - y); K[y * n + x] = Math.exp(-(dx * dx + dy * dy) / 4.5); }
  const splat = (p, s) => { const px = p % n, py = (p / n) | 0; for (let y = 0; y < n; y++) { const row = ((y - py + n) % n) * n; for (let x = 0; x < n; x++) E[y * n + x] += s * K[row + (x - px + n) % n]; } };
  const pick = (want, most) => { let b = -1, bv = most ? -Infinity : Infinity; for (let i = 0; i < N; i++) if (on[i] === want && (most ? E[i] > bv : E[i] < bv)) { bv = E[i]; b = i; } return b; };
  let a = seed; const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ones = Math.round(N * .1); for (let k = 0; k < ones;) { const p = Math.floor(rnd() * N); if (!on[p]) { on[p] = 1; splat(p, 1); k++; } }
  for (let it = 0; it < 3000; it++) { const c = pick(1, true); on[c] = 0; splat(c, -1); const v = pick(0, false); on[v] = 1; splat(v, 1); if (v === c) break; }   // relax
  const init = on.slice(), E0 = E.slice();
  for (let r = ones - 1; r >= 0; r--) { const c = pick(1, true); on[c] = 0; splat(c, -1); rank[c] = r; }   // phase 2
  on.set(init); E.set(E0);
  for (let r = ones; r < N; r++) { const v = pick(0, false); on[v] = 1; splat(v, 1); rank[v] = r; }   // phase 3
  return rank;
}
export const DITHERS = ['bayer2', 'bayer4', 'bayer8', 'blue'];
export function matrixTexture(mode) {
  return once('mat:' + mode, () => {
    const n = mode === 'blue' ? 64 : +mode.slice(5) || 4, v = mode === 'blue' ? blueNoise(n) : bayer(n), data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { const t = Math.round((v[i] + .5) / (n * n) * 255); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = t; data[i * 4 + 3] = 255; }
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; t.size = n; return t;
  });
}

// ── dither palettes (first N colours are used; `city` is STYLE.md's own: ink, white, sky, the wall and sign colours)
export const PALETTES = {
  city: ['#17171b', '#f7f7f2', '#2f9bff', '#ffc21a', '#ef4a2a', '#ff4fa3', '#25b84c', '#7a3cff', '#9fdcff', '#ff7a1a', '#2f5bff', '#12b3a0', '#fff0d0', '#5d5e6b', '#a7a9b1', '#9b4f3a'],
  pico8: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
  gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  cga: ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
  mono: null,   // N greys, black to white
};
export const PALETTE_NAMES = ['none', ...Object.keys(PALETTES)];
export const hex3 = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export function paletteOf(name, count) {
  const n = Math.max(2, Math.min(16, count | 0)), P = PALETTES[name];
  return P ? P.slice(0, n).map(hex3) : Array.from({ length: n }, (_, i) => { const g = i / (n - 1); return [g, g, g]; });
}
