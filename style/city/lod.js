// Compact tier meshes (worker-safe, no three): a Bank layer → { n, o, P, N, C, F }.
//   P Int16 ×3 — position in centimetres relative to the origin o (±327 m) · N Int8 ×3 — normal
//   C Uint8 ×4 — sRGB colour (AO baked) + alpha = material layer (0 matte · 85 gloss · 170 metal · 255 lit: neon, lit windows)
//   F Uint8 bits — one per quad: which diagonal the quad is split on (every mesh here is quads, so no index buffer is stored)
//   K Uint8 ×1 (optional) — cluster id per vertex (character mid tiers hide clusters that are drawn at another tier)
// ≈ 12 bytes per vertex in the cache instead of 33, and the same arrays go straight to the GPU.
const LUT = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; LUT[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)); }
const toS = v => LUT[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0];

// pack one or more layers of a bank into one tier mesh; `lit` marks layers whose vertices glow; `k` = cluster id (or per-layer array)
export function packLayers(bank, layers, o, lit = [3], k = null) {
  let n = 0; for (const li of layers) n += bank.L[li].v; if (!n) return null;
  const P = new Int16Array(n * 3), N = new Int8Array(n * 3), C = new Uint8Array(n * 4), F = new Uint8Array(Math.ceil(n / 32)), K = k === null ? null : new Uint8Array(n);
  let v = 0;
  for (const li of layers) { const O = bank.L[li]; if (!O.v) continue; const p = O.P.a, nn = O.N.a, c = O.C.a, I = O.I.a, a = li * 85, ok = O.I.n === O.v * 1.5;   // alpha = material layer: 0 matte · 85 gloss · 170 metal · 255 lit
    if (!ok) throw new Error('packLayers: layer is not pure quads');
    for (let q = 0; q < O.v; q++) { const w = v + q, j = q * 3;
      P[w * 3] = Math.max(-32767, Math.min(32767, Math.round((p[j] - o[0]) * 100))); P[w * 3 + 1] = Math.max(-32767, Math.min(32767, Math.round((p[j + 1] - o[1]) * 100))); P[w * 3 + 2] = Math.max(-32767, Math.min(32767, Math.round((p[j + 2] - o[2]) * 100)));
      N[w * 3] = nn[j]; N[w * 3 + 1] = nn[j + 1]; N[w * 3 + 2] = nn[j + 2];
      C[w * 4] = toS(c[j]); C[w * 4 + 1] = toS(c[j + 1]); C[w * 4 + 2] = toS(c[j + 2]); C[w * 4 + 3] = a;
      if (K) K[w] = Array.isArray(k) ? k[li] : k; }
    for (let q = 0; q < O.v / 4; q++) if (I[q * 6] === q * 4 + 1) { const g = (v >> 2) + q; F[g >> 3] |= 1 << (g & 7); }
    v += O.v; }
  return { n, o, P, N, C, F, K };
}
// full tier: one tier mesh per material layer (0 matte · 1 gloss · 2 metal · 3 lit); mid/far: every layer merged into one
export const packFull = (bank, o) => [0, 1, 2, 3].map(li => packLayers(bank, [li], o, [3]));
export const packMerged = (bank, o) => packLayers(bank, [0, 1, 2, 3], o, [3]);
// concatenate tier meshes that share an origin (e.g. character clusters into one mid mesh)
export function concatTiers(list, o) {
  list = list.filter(Boolean); if (!list.length) return null; const n = list.reduce((s, t) => s + t.n, 0);
  const P = new Int16Array(n * 3), N = new Int8Array(n * 3), C = new Uint8Array(n * 4), F = new Uint8Array(Math.ceil(n / 32)), K = list.some(t => t.K) ? new Uint8Array(n) : null; let v = 0;
  for (const t of list) { P.set(t.P, v * 3); N.set(t.N, v * 3); C.set(t.C, v * 4); if (K && t.K) K.set(t.K, v);
    for (let q = 0; q < t.n / 4; q++) if (t.F[q >> 3] & (1 << (q & 7))) { const g = (v >> 2) + q; F[g >> 3] |= 1 << (g & 7); } v += t.n; }
  return { n, o, P, N, C, F, K };
}
export const tierBytes = t => !t ? 0 : Array.isArray(t) ? t.reduce((s, x) => s + tierBytes(x), 0) : t.P.byteLength + t.N.byteLength + t.C.byteLength + t.F.byteLength + (t.K ? t.K.byteLength : 0);
export const tierBuffers = (t, out = []) => { if (!t) return out; if (Array.isArray(t)) { t.forEach(x => tierBuffers(x, out)); return out; } out.push(t.P.buffer, t.N.buffer, t.C.buffer, t.F.buffer); if (t.K) out.push(t.K.buffer); return out; };
// streaming pass · several blocks' tier meshes (each with its own origin) as ONE mesh at origin o, K = the part's index: the woods' far
// tiers merge per 4×4-block chunk (jobs.js jobFarChunk), so a chunk is one job, one cache record and one draw call. Origins are block
// centres (multiples of 16 m), so the shift is whole centimetres and every vertex lands exactly where its block's own mesh put it.
export function mergeTiers(parts, o) {
  parts = parts.filter(([t]) => t); if (!parts.length) return null; const n = parts.reduce((s, [t]) => s + t.n, 0);
  const P = new Int16Array(n * 3), N = new Int8Array(n * 3), C = new Uint8Array(n * 4), F = new Uint8Array(Math.ceil(n / 32)), K = new Uint8Array(n); let v = 0;
  for (const [t, k] of parts) { const dx = Math.round((t.o[0] - o[0]) * 100), dy = Math.round((t.o[1] - o[1]) * 100), dz = Math.round((t.o[2] - o[2]) * 100);
    for (let q = 0; q < t.n; q++) { const a = (v + q) * 3, b = q * 3; P[a] = t.P[b] + dx; P[a + 1] = t.P[b + 1] + dy; P[a + 2] = t.P[b + 2] + dz; }
    N.set(t.N, v * 3); C.set(t.C, v * 4); K.fill(k, v, v + t.n);
    for (let q = 0; q < t.n / 4; q++) if (t.F[q >> 3] & (1 << (q & 7))) { const g = (v >> 2) + q; F[g >> 3] |= 1 << (g & 7); } v += t.n; }
  return { n, o, P, N, C, F, K };
}
