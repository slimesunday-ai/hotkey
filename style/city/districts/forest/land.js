// BLACKPINE WOODS · the island's land (owner: the Blackpine Woods agent). Worker-safe (no three, no DOM).
// The city renderer's ground is flat, so the woods carry the island's shape themselves: a coast 90–200 m out from the city (an 8 m
// Euclidean distance field to every urban block, the old plan's shore noise, a western bulge that takes in the LAKE and the west
// shack), the LAKE of the plan (world/city.js), a few ponds where the old terrain dipped (its hill noise), a sandy rim along the bay.
//   elev(x, z)   metres above the waterline, signed (< 0: water) · kindAt(x, z) → 0 water · 1 shore (sand, mud, reeds) · 2 land
//   WOODS        every non-urban block with land on it: the blocks this kit builds (the island)
import { kindAt, urban, P, fbm, sstep, LAKE, urbanDist, remap, unmap } from '../../../../world/city.js';
// SPREAD · the land's hand-placed metres are today's, carried into the spread world (style/city/SPREAD.md): the bulges round the shacks
// and the dry ground under the sim's places through remap (their blocks' shift, as plan.js SITES), the west bulge's ramps too, the bay's
// rim at row −8's line; the lake keeps its shoreline: its noise reads the lake's own frame (the LAKE moved with its block, world/city.js).
// The rest is world noise by design (the coast's distance to the city, the ponds, the hills).
const RX = x => remap(x, 16)[0], RZ = z => remap(16, z)[1];   // (a ramp's edge: the shift of the block it is in)
const LK0 = unmap(LAKE.x, LAKE.z), LKS = [LAKE.x - LK0[0], LAKE.z - LK0[1]];

// ── distance to the city (urban blocks, the jail island excluded) on an 8 m grid: an exact Euclidean distance transform to the nearest
// urban cell centre (two 1-D passes, Felzenszwalb–Huttenlocher), less half a cell — a few milliseconds at load, in every worker
const G = 8, X0 = -704, Z0 = -576, NX = 177, NZ = 145, D = new Float32Array(NX * NZ);
{ const INF = 1e12, f = new Float64Array(NX * NZ);
  for (let a = 0; a < NX; a++) for (let b = 0; b < NZ; b++) { const x = X0 + a * G + G / 2, z = Z0 + b * G + G / 2, k = kindAt(Math.floor(x / P), Math.floor(z / P)); f[a * NZ + b] = urban(k) && k !== 'K' ? 0 : INF; }
  const dt = (g, n, out) => { const v = new Int32Array(n), zz = new Float64Array(n + 1); let k = 0; v[0] = 0; zz[0] = -INF; zz[1] = INF;
    for (let q = 1; q < n; q++) { let s; for (;;) { s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= zz[k] && k > 0) k--; else break; } if (s <= zz[k]) { v[0] = q; zz[0] = -INF; zz[1] = INF; k = 0; continue; } k++; v[k] = q; zz[k] = s; zz[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + g[v[k]]; } };
  const col = new Float64Array(NZ), oc = new Float64Array(NZ); for (let a = 0; a < NX; a++) { for (let b = 0; b < NZ; b++) col[b] = f[a * NZ + b]; dt(col, NZ, oc); for (let b = 0; b < NZ; b++) f[a * NZ + b] = oc[b]; }
  const row = new Float64Array(NX), orw = new Float64Array(NX); for (let b = 0; b < NZ; b++) { for (let a = 0; a < NX; a++) row[a] = f[a * NZ + b]; dt(row, NX, orw); for (let a = 0; a < NX; a++) D[a * NZ + b] = Math.min(600, Math.max(0, Math.sqrt(orw[a]) * G - G / 2)); } }
export const cityDist = (x, z) => { const fx = (x - X0) / G, fz = (z - Z0) / G, a = Math.max(0, Math.min(NX - 2, Math.floor(fx))), b = Math.max(0, Math.min(NZ - 2, Math.floor(fz))), u = Math.min(1, Math.max(0, fx - a)), v = Math.min(1, Math.max(0, fz - b));
  return (D[a * NZ + b] * (1 - u) + D[(a + 1) * NZ + b] * u) * (1 - v) + (D[a * NZ + b + 1] * (1 - u) + D[(a + 1) * NZ + b + 1] * u) * v; };

// ── the terms (each: metres above the waterline, signed)
const W0 = [RX(-250), RX(-330), RZ(-250), RZ(-190), RZ(115), RZ(175)];
const WEST = (x, z) => sstep(W0[0], W0[1], x) * sstep(W0[2], W0[3], z) * (1 - sstep(W0[4], W0[5], z)) * 88;              // the west bulge (the lake, the west shack)
// the shacks sit deep in the trees: the coast swings out round each (a bulge that fades over 90 m), so no lab looks out to sea
const LABS = [[330, -110, 55], [-400, -150, 55], [-120, 390, 30]].map(([x, z, h]) => [...remap(x, z), h]);   // (the south one less: the ground ends at z 448)
const bulge = (x, z) => { let m = 0; for (const [lx, lz, h] of LABS) m = Math.max(m, h * (1 - sstep(20, 95, Math.hypot(x - lx, z - lz)))); return m; };
export const shoreOf = (x, z) => 110 + (fbm(x * .006 + 7, z * .006 - 3, 3) - .5) * 120 + (fbm(x * .021 + 1, z * .021 + 5, 3) - .5) * 44 + WEST(x, z) + bulge(x, z);
const coastTerm = (x, z) => (shoreOf(x, z) - cityDist(x, z)) * .5;                                                   // a gentle shelf: 1 m up per 2 m in
const BAY = -8 * P;   // (SPREAD: the bay's edge is row −8's line: −256 today)
const bayTerm = (x, z) => (z - BAY) - 1.5 - fbm(x * .045 + 2, 7.7, 2) * 7;                                          // the bay's edge (z −256): a ragged sand rim
export const lakeOf = (x, z) => Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.3) / (LAKE.r * (.8 + fbm((x - LKS[0]) * .03, (z - LKS[1]) * .03, 2) * .45));
const lakeTerm = (x, z) => (lakeOf(x, z) - 1) * 22;
// ponds where the old plan's hills dipped below the water (world/city.js terrain, its first noise term), kept to the deep ones
const pondTerm = (x, z) => { const du = urbanDist(x, z); if (du < 40) return 99; return ((fbm(x * .011 + 3, z * .011 - 2, 4) - .40) * 36 * sstep(6, 90, du) + 6.8) * 1.6; };
// places that must stay dry (the sim's coordinates are law): the three shacks, the leaf clearing, the fire tower
const DRY = [[330, -110, 30], [-400, -150, 34], [-120, 390, 26], [-330, 60, 20], [-297, -6, 16]].map(([x, z, r]) => [...remap(x, z), r]);
const dryTerm = (x, z) => { let m = -99; for (const [px, pz, r] of DRY) m = Math.max(m, (r - Math.hypot(x - px, z - pz)) * .6); return m; };

export function elev(x, z) {
  const i = Math.floor(x / P), j = Math.floor(z / P), k = kindAt(i, j); if (k === '~') return -3; if (urban(k)) return 4;
  let e = Math.min(coastTerm(x, z), bayTerm(x, z), lakeTerm(x, z), pondTerm(x, z));
  if (e < 3) e = Math.max(e, Math.min(dryTerm(x, z), 3.5));   // (a shack's ground never goes under)
  return e;
}
// 0 water · 1 shore · 2 land. The shore is sand on the sea and the bay, mud and reeds on the lake and the ponds.
export const SHORE = 2.2;
export const wetAt = (x, z) => { const e = elev(x, z); return e < 0 ? 0 : e < SHORE ? 1 : 2; };
export const lakeSide = (x, z) => lakeOf(x, z) < 1.35 || pondTerm(x, z) < SHORE + 2;   // a freshwater shore (reeds, mud) rather than a beach

// ── the island's blocks: every non-urban, non-sea block with any land on a 4 m sample (the kit's `built` list)
export const WOODS = [];
const SQ = (P - 4) / 7;   // (SPREAD: the 8 × 8 samples span the block, 4 m apart at 32)
for (let i = -24; i < 24; i++) for (let j = -9; j < 16; j++) { if (kindAt(i, j) !== '.' || cityDist(i * P + P / 2, j * P + P / 2) > 330) continue; let n = 0;
  for (let a = 0; a < 8 && !n; a++) for (let b = 0; b < 8; b++) if (elev(i * P + 2 + a * SQ, j * P + 2 + b * SQ) >= 0) { n++; break; }
  if (n) WOODS.push([i, j]); }
export const isWoods = (() => { const S = new Set(WOODS.map(([i, j]) => i + ',' + j)); return (i, j) => S.has(i + ',' + j); })();
