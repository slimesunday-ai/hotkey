// FRESH REGISTRY · pure helpers a trait file may import (the only import a trait file may have). No three.js, no chars.js.
// Colours are 24-bit numbers (0xRRGGBB). Materials (the `l` argument everywhere): 0 matte · 1 gloss · 2 metal · 3 lit (unlit
// emissive: screens, lamps; keep it rare).
// the LOBE ANCHOR (construction, world/fit/body.js): the exact earlobe voxel on each side, for the ears category (README § Ears) ·
// the MOUTH ZONE (world/fit/body.js): the box a mouths.js entry draws and paints in (README § Mouth) ·
export { LOBE, MOUTH } from '../fit/body.js';
// the GRIP (construction, world/fit/held.js): the hold poses, the fist's channel cells per pose and the held budgets, for the held
// category (README § Held). A held draw also gets them as ctx.grip.
export { HOLD, POSES, ENVELOPE, BUDGET as HELD_BUDGET, gripCells, channelOf, mirror } from '../fit/held.js';
export const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const lerpHex = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a straight run of voxels from a to b ([x, y, z]), each a t-cube (on any grid with set())
export function line(G, a, b, c, l = 0, t = 1) { const n = Math.max(1, ...[0, 1, 2].map(k => Math.abs(b[k] - a[k])));
  for (let s = 0; s <= n; s++) { const p = a.map((v, k) => Math.round(v + (b[k] - v) * s / n)); for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) for (let k = 0; k < t; k++) G.set(p[0] + i, p[1] + j, p[2] + k, c, l); } }
// a polyline through points
export function strand(G, pts, c, l = 0, t = 1) { for (let i = 1; i < pts.length; i++) line(G, pts[i - 1], pts[i], c, l, t); }
