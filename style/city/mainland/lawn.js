// MAINLAND LAWNS (2026-10-06) · the painted lawn: one RGBA texel per ground voxel (0.1 m over the built zone, 0.2 m over the frontier),
// a pure function of world position (worker-safe, no three). The ground's TOP faces (y 0.2: lawns, verges, walks, curbs) take their colour
// from this map (grass.js), so a lawn is no longer one flat green but patches, sun-faded drifts, mown stripes, clover, flower drifts, worn
// trails, mulch beds and leaf litter, all snapped to the city voxel like the city's handmade ground (groundwear.js). The ALPHA channel is
// the tuft density (0–255): grass.js grows instanced tufts near the camera where it is high (fence lines, tree rings, wild plots).
//   ground.js paints every tile's cells (paintCell) · houses.js paints each built lot from its own geometry (lotLawn: edging along its
//   paths, mulch round its shrubs and walls, long grass at its fences, wear trails, the sprinkler's wet patch, its trees' shade) · main.js
//   stamps the lot patches over the ground's lawn and paints the scene's trees (treeShade).
import { hash } from '../style.js';

// the two maps (world rects, metres): main.js's FINE / COARSE ground tiles
export const GRIDS = { fine: { x0: -122, z0: -168, x1: 126, z1: 0, s: .1 }, coarse: { x0: -212, z0: -332, x1: 284, z1: 0, s: .2 } };
for (const g of Object.values(GRIDS)) { g.nx = Math.round((g.x1 - g.x0) / g.s); g.nz = Math.round((g.z1 - g.z0) / g.s); }
export const gridFor = (x0, z0, x1, z1) => { const F = GRIDS.fine; return (x0 >= F.x0 && x1 <= F.x1 && z0 >= F.z0 && z1 <= F.z1) ? 'fine' : 'coarse'; };

// ── the palette (sRGB): toon-saturated greens with a real range, from the shade under a maple to straw where the sun bakes it
const C = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const LUSH = C(0x3d9a3e), BASE = C(0x55ad45), LIGHT = C(0x72c050), FADED = C(0xa3c45c), STRAW = C(0xc7bd72), SHADE = C(0x2c7a3c),
  CLOVER = C(0x3b9b58), DIRT = C(0xa88a5c), DIRT2 = C(0x8d6f4a), MULCH = [C(0x6b4631), C(0x5a3a28), C(0x7c5439)], CUT = C(0x2f6f35),
  WET = C(0x2f8c4c), PUDDLE = C(0x9fcfe0), MEADOW = C(0x7fb24c), OLIVE = C(0x93a84e), GRAVEL = [C(0xe4d6b8), C(0xd6c7a6), C(0xc9b996)];
const FLOWERS = [[C(0xffd23a), C(0xffe56a)], [C(0xf7f5ee), C(0xfff1c8)], [C(0x9a7cf0), C(0xb89cff)], [C(0xff8fc0), C(0xff6fae)]];
export const LEAVES = { redmaple: [C(0xd8452f), C(0xb8352a), C(0xe8683a)], maple: [C(0xf08a2a), C(0xe0a030), C(0xd8702a)], oak: [C(0x9a7a3a), C(0xb08a40), C(0x7f6a34)],
  birch: [C(0xf2c84a), C(0xe6b83c), C(0xf7da6a)], blossom: [C(0xff9cc8), C(0xffc2dc), C(0xff7ab6)], ornamental: [C(0xff9cc8), C(0xffc2dc), C(0xff7ab6)],
  willow: [C(0xc8c24a), C(0xa9b03c), C(0xd8d070)], pine: [C(0x7a5a3a), C(0x8a6a44), C(0x6a4c30)] };

// ── lawn personalities: how each kind of lawn is kept (stripe: mown-stripe contrast, check: the showpiece's two-way mow, fade: sun-faded
// drifts, clover, flowers (drift rate), bare (dirt patches), wild/edge: tuft density in the open and at the fences, lush: deeper green)
export const CARE = {
  show:   { stripe: .04, check: true, w: 2.0, fade: .12, clover: 0, flowers: 0, bare: 0, wild: 0, edge: 70, lush: .45, wear: 0 },
  tidy:   { stripe: .07, w: 1.3, fade: .3, clover: .08, flowers: .0006, bare: 0, wild: 0, edge: 165, lush: .2, wear: .25 },
  lived:  { stripe: .035, w: 1.45, fade: .55, clover: .35, flowers: .003, bare: .1, wild: 18, edge: 215, lush: 0, wear: .8 },
  wild:   { stripe: 0, fade: .85, clover: .6, flowers: .009, bare: .35, wild: 120, edge: 235, lush: -.15, wear: 1 },
  park:   { stripe: 0, fade: .5, clover: .45, flowers: .003, bare: .05, wild: 30, edge: 150, lush: .05 },
  verge:  { stripe: 0, fade: .75, clover: .25, flowers: 0, bare: .08, wild: 22, edge: 0, lush: -.05 },
  green:  { stripe: .06, w: 1.6, fade: .2, clover: .1, flowers: .001, bare: 0, wild: 0, edge: 0, lush: .3 },
  mown:   { stripe: .05, w: 1.8, fade: .6, clover: .3, flowers: .004, bare: .05, wild: 25, edge: 160, lush: -.05 },
  meadow: { stripe: 0, fade: .95, clover: .35, flowers: .009, bare: .15, wild: 205, edge: 240, lush: -.2, meadow: 1 },
  rough:  { stripe: 0, fade: .9, clover: .4, flowers: .008, bare: .1, wild: 85, edge: 200, lush: -.1, meadow: 1 },
  shore:  { stripe: 0, fade: 1, clover: .1, flowers: .01, bare: .25, wild: 235, edge: 240, lush: -.3, meadow: 1 },
};

const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// value noise on the integer lattice (smooth): deterministic by world position, seamless across tiles
// (style.js hash inlined for the four corners: the same numbers, a third of the cost; the lawn calls this ~8× a texel)
const hf = h => { h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vn(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), h0 = ix * 374761393 + iz * 668265263 + s * 2147483647;
  const a = hf(h0 | 0), b = hf((h0 + 374761393) | 0), c = hf((h0 + 668265263) | 0), d = hf((h0 + 1043026656) | 0); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
const O = [0, 0, 0];   // the working colour
const mixO = (c, t) => { O[0] += (c[0] - O[0]) * t; O[1] += (c[1] - O[1]) * t; O[2] += (c[2] - O[2]) * t; };
const put = (T, o, a) => { T[o] = O[0] < 0 ? 0 : O[0] > 255 ? 255 : O[0]; T[o + 1] = O[1] < 0 ? 0 : O[1] > 255 ? 255 : O[1]; T[o + 2] = O[2] < 0 ? 0 : O[2] > 255 ? 255 : O[2]; T[o + 3] = a < 0 ? 0 : a > 255 ? 255 : a; };
export const flat = (T, o, h, a = 0) => { T[o] = (h >> 16) & 255; T[o + 1] = (h >> 8) & 255; T[o + 2] = h & 255; T[o + 3] = a; };

// ── one lawn texel at world (x, z), cell size s; lx, lz: the lot's own frame (mown stripes run with the lot), NaN off a lot.
// The smooth fields (patches, fades, clover and bare and flower drifts) are sampled once per 2×2 block, at the block's centre (so still a
// pure function of position); the voxel grain, the stripes and the single-texel things (clover heads, flowers, dirt) per texel.
const NF = 9;
function field(F, f, x, z, P) {
  const n1 = vn(x * .13, z * .13, 11) * .6 + vn(x * .41, z * .41, 12) * .4, n2 = vn(x * .085 + 40, z * .085, 13);
  // lush ↔ base ↔ light patches, then the sun-faded drifts (a meadow leans olive and straw, clumped)
  if (n1 < .5) { const t = sst(.18, .5, n1); O[0] = LUSH[0] + (BASE[0] - LUSH[0]) * t; O[1] = LUSH[1] + (BASE[1] - LUSH[1]) * t; O[2] = LUSH[2] + (BASE[2] - LUSH[2]) * t; }
  else { const t = sst(.5, .85, n1); O[0] = BASE[0] + (LIGHT[0] - BASE[0]) * t; O[1] = BASE[1] + (LIGHT[1] - BASE[1]) * t; O[2] = BASE[2] + (LIGHT[2] - BASE[2]) * t; }
  if (P.meadow) { mixO(MEADOW, .35); if (n2 > .6) mixO(OLIVE, sst(.6, .85, n2) * .6); if (n2 > .82) mixO(STRAW, sst(.82, .97, n2) * .5); const cl = vn(x * 2.3, z * 2.3, 26); if (cl < .4) mixO(SHADE, (.4 - cl) * 1.1); }
  else { const fd = P.fade * sst(.52, .86, n2); if (fd > 0) mixO(FADED, fd * .8); if (n2 > .88 && P.fade > .5) mixO(STRAW, sst(.88, .98, n2) * (P.fade - .4)); }
  if (P.lush > 0) mixO(LUSH, P.lush * .6); else if (P.lush < 0) mixO(FADED, -P.lush * .5);
  F[f] = O[0]; F[f + 1] = O[1]; F[f + 2] = O[2]; F[f + 3] = vn(x * 1.3, z * 1.3, 14); F[f + 4] = P.wild ? vn(x * .7, z * .7, 21) : 0;
  F[f + 5] = P.clover ? vn(x * .75 + 9, z * .75, 16) : 0; F[f + 6] = P.bare ? vn(x * .45 + 3, z * .45, 20) : 0;
  F[f + 7] = P.flowers ? vn(x * .28, z * .28, 18) * .55 + vn(x * 1.1, z * 1.1, 27) * .45 : 0; F[f + 8] = P.flowers ? vn(x * .06, z * .06, 24) : 0;
}
function texel(F, f, x, z, s, P, lx, lz) {
  const qx = Math.floor(x / s + 1e-6), qz = Math.floor(z / s + 1e-6); O[0] = F[f]; O[1] = F[f + 1]; O[2] = F[f + 2];
  // value: soft mottling, the per-voxel grain, the mown stripes (the light stripe a touch yellower: the blades lie away from you)
  let v = 1 + (F[f + 3] - .5) * .11 + (hash(qx, qz, 15) - .5) * .055, dens = P.wild ? P.wild * (.45 + .9 * F[f + 4]) : 0;
  if (P.stripe && lx === lx) { let t = (Math.floor(lx / P.w + 1e3) & 1) ? 1 : -1; if (P.check) t *= (Math.floor(lz / P.w + 1e3) & 1) ? 1 : -1; v += t * P.stripe; if (t > 0) { O[0] += 6; O[1] += 3; } }
  O[0] *= v; O[1] *= v; O[2] *= v;
  // clover patches (bluer, darker, with white heads), bare dirt, flower drifts (one kind per drift, in clusters: never confetti)
  if (P.clover) { const c = F[f + 5], c0 = 1 - P.clover * .38; if (c > c0) { mixO(CLOVER, .7 * sst(c0, 1 - P.clover * .3, c)); if (hash(qx, qz, 17) > .985) { O[0] = 236; O[1] = 238; O[2] = 222; } } }
  if (P.bare) { const b = F[f + 6], b0 = 1 - P.bare * .3; if (b > b0) { const t = sst(b0, 1 - P.bare * .22, b); if (hash(qx, qz, 22) < t * .85) { mixO(hash(qx, qz, 23) > .5 ? DIRT : DIRT2, .8); dens *= .3; } } }
  if (P.flowers) { const d = F[f + 7]; if (d > .62 && hash(qx, qz, 19) < P.flowers * sst(.62, .8, d) * 22) { const Fl = FLOWERS[[0, 0, 1, 2, 3, 0][(F[f + 8] * 6) | 0]], c = Fl[hash(qx, qz, 25) > .7 ? 1 : 0]; O[0] = c[0]; O[1] = c[1]; O[2] = c[2]; } }
  return dens;
}
// a painter for one raster (nx cells across): row-major calls, the fields cached per block row
export class Painter {   // sh: the block is 2^sh cells square (1: the 0.1 m maps' 0.2 m blocks; 2 on the 0.2 m frontier: 0.8 m)
  constructor(nx, sh = 1) { this.sh = sh; this.m = (1 << sh) - 1; this.c = (1 << sh) / 2 - .5; this.F = new Float32Array(((nx >> sh) + 2) * NF); this.K = new Int32Array((nx >> sh) + 2).fill(-1); }
  // the lawn at cell (i, k) (centre x, z) into O; returns the density
  at(i, k, x, z, s, P, lx = NaN, lz = NaN) { const sh = this.sh, bi = i >> sh, key = (k >> sh) * 64 + P.id, f = bi * NF;
    if (this.K[bi] !== key) { field(this.F, f, x + (this.c - (i & this.m)) * s, z + (this.c - (k & this.m)) * s, P); this.K[bi] = key; }
    return texel(this.F, f, x, z, s, P, lx, lz); }
  px(T, o, i, k, x, z, s, P, lx, lz, dAdd = 0) { put(T, o, this.at(i, k, x, z, s, P, lx, lz) + dAdd); }
}
Object.values(CARE).forEach((P, k) => P.id = k);
// how each built lot is kept: the heads are showpieces, the rest tidy, lived-in or let go, so no two neighbours mow alike; an owner's lot
// (custom) is tidy. lotLawnSpec(P, custom) → the lot job's spec.lawn (houses.js lotLawn) for plot P (plots.json), where main.js stamps it:
// main.js and the interior view (interiors/city/view.js) both ask here, so a house's lawn is the same from the street and from inside
export const CAREOF = { 'ML-006': 'show', 'ML-014': 'show', 'ML-004': 'show', 'ML-005': 'tidy', 'ML-007': 'tidy', 'ML-010': 'tidy', 'ML-012': 'tidy', 'ML-015': 'tidy', 'ML-016': 'tidy',
  'ML-001': 'lived', 'ML-002': 'lived', 'ML-008': 'lived', 'ML-009': 'lived', 'ML-011': 'lived', 'ML-013': 'lived', 'ML-003': 'wild', 'ML-017': 'wild' };
export function lotLawnSpec(P, custom) { const xs = P.corners.map(c => c[0]), zs = P.corners.map(c => c[1]);
  return { grid: gridFor(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)), x: P.rect.x, z: P.rect.z, rot: P.rect.rot, care: custom ? 'tidy' : CAREOF[P.id] ?? 'tidy' }; }

// ── modifiers on the colour already at T[o] (the lot patch and the scene's trees)
const load = (T, o) => { O[0] = T[o]; O[1] = T[o + 1]; O[2] = T[o + 2]; };
// a tree's ground: darker, lusher grass in its shade, a mulch ring on a kept lawn, its leaves (by species), long grass round the trunk
export function treeTexel(T, o, x, z, s, d, R, sp, kept, wild = 0) {
  if (d > R * 1.15) return; load(T, o); const qx = Math.floor(x / s + 1e-6), qz = Math.floor(z / s + 1e-6), a = T[o + 3];
  const sh = sst(R * 1.15, R * .35, d); mixO(SHADE, sh * .55);
  let dens = a;
  if (kept && d < .75) { const M = MULCH[(hash(qx, qz, 31) * 3) | 0]; O[0] = M[0]; O[1] = M[1]; O[2] = M[2]; if (d > .65) { O[0] = CUT[0]; O[1] = CUT[1]; O[2] = CUT[2]; } dens = 0; }
  else { if (d < .5) dens = Math.max(dens, 200 + wild * .2); else if (d < 1.1) dens = Math.max(dens, (kept ? 70 : 150) * sst(1.1, .5, d)); }
  const L = LEAVES[sp] || LEAVES.oak, p = sst(R * 1.05, R * .25, d) * (kept ? .03 : .075) * (.4 + 1.2 * vn(x * .9, z * .9, 35));
  if (hash(qx, qz, 33) < p) { const c = L[(hash(qx, qz, 34) * 3) | 0], t = .55 + .3 * hash(qx, qz, 36); mixO(c, t); }
  put(T, o, dens);
}
// the canopy radius of a suburbs tree (props.js: crowns ≈ 1.8 / 2.8 / 3.6 m)
export const crownR = (sp, size) => sp === 'pine' ? 1.3 + size * .4 : sp === 'ornamental' || sp === 'blossom' ? 1.3 + size * .4 : 1.35 + size * .55;

// ── THE LOT PATCH (houses.js, in the lot's worker job): the lot's lawn painted from its own geometry. L: the lot volume (lot frame, 0.1 m,
// y voxel 0 = the lawn), poly (lot frame), A.dress / custom items for the trees and the yard pieces; o.lawn = { grid (a GRIDS key), x, z,
// rot (the lot's world placement), care (a CARE key), seed }. Returns { g, i0, k0, nx, nz, tex (RGBA), mask (1 where the lot lies) }.
const FOUND = 0xb9b3a8, PATHC = new Set([0xdcd6c9, 0xcdc6b8, 0xd8d1c3, 0xc9c2b4, 0xd9c9b0, 0xb4553c, 0xa3492f, 0xb9b3a8, 0xc4beb3, 0xbcb5a8, 0xb3ac9f, 0x9f988c, 0xc2bbae, 0xd0c9bb]);
const isGreen = c => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return g > r + 35 && g > b + 25; };
function chamfer(D, nx, nz) {   // in place: D holds 0 at the class, 255 elsewhere; 3-4 chamfer in tenths of a cell → returns D in cells×3
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const n = k * nx + i; let v = D[n]; if (!v) continue;
    if (i > 0) v = Math.min(v, D[n - 1] + 3); if (k > 0) { v = Math.min(v, D[n - nx] + 3); if (i > 0) v = Math.min(v, D[n - nx - 1] + 4); if (i < nx - 1) v = Math.min(v, D[n - nx + 1] + 4); } D[n] = v; }
  for (let k = nz - 1; k >= 0; k--) for (let i = nx - 1; i >= 0; i--) { const n = k * nx + i; let v = D[n]; if (!v) continue;
    if (i < nx - 1) v = Math.min(v, D[n + 1] + 3); if (k < nz - 1) { v = Math.min(v, D[n + nx] + 3); if (i < nx - 1) v = Math.min(v, D[n + nx + 1] + 4); if (i > 0) v = Math.min(v, D[n + nx - 1] + 4); } D[n] = v; } }
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const bez = (a, c, b, n = 10) => { const out = []; for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return out; };
// pieces that wear the grass under or round them: [radius, what] (trampoline: a dead circle under it; swings: dirt under the seats)
const WEAR = { trampoline: [1.6, 'under'], swingset: [1.4, 'swing'], lemonade: [1.2, 'trod'], playhouse: [1.0, 'trod'], firepit: [1.3, 'trod'], patio: [1.6, 'trod'], pool: [2.0, 'ring'],
  bouncy: [2.2, 'under'], doghouse: [1.6, 'trod'], clothesline: [.9, 'trod'] };
export function lotLawn(L, poly, info, o) {
  const G = GRIDS[o.grid], s = G.s, V = L.V, nx = V.nx, nz = V.nz, sxz = V.sxz, P = CARE[o.care] || CARE.tidy, c = Math.cos(o.rot), sn = Math.sin(o.rot);
  // the lot's ground layer, by class: paths (one voxel high, path colours), greens (hedges, shrubs), the house's foundation, anything else tall
  const N = nx * nz, Dp = new Uint8Array(N).fill(255), Dg = new Uint8Array(N).fill(255), Dh = new Uint8Array(N).fill(255), Dt = new Uint8Array(N).fill(255);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const n = k * nx + i, v0 = V.d[n]; if (!v0) continue; const col = V.pal[v0], tall = V.d[n + sxz] !== 0;
    if (!tall) { if (PATHC.has(col)) Dp[n] = 0; } else if (isGreen(col)) Dg[n] = 0; else if (col === FOUND) Dh[n] = 0; else Dt[n] = 0; }
  chamfer(Dp, nx, nz); chamfer(Dg, nx, nz); chamfer(Dh, nx, nz); chamfer(Dt, nx, nz);
  const ox = L.ox, oz = L.oz;
  // the trees, the wearing pieces and the sprinklers (lot frame), the wear trails
  const trees = [], wears = [], wets = [], trails = [];
  for (const d of info.items) { if (d.id === 'tree') { const [sp, size] = d.args; trees.push([d.x, d.z, crownR(sp, size | 0), sp]); } else if (d.id === 'sprinkler') wets.push([d.x, d.z]); else if (WEAR[d.id]) wears.push([d.x, d.z, ...WEAR[d.id]]); }
  if (info.door) { const [dx, dz] = info.door, drv = info.drive;
    // the shortcut from the door to the car (or the street), bowed across the front lawn; the side passage to the back yard
    if (drv) { const ex = dx < drv[0] ? drv[0] - .2 : drv[1] + .2, a = [dx + Math.sign(ex - dx) * .7, dz + .4], b = [ex, Math.max(dz + 1.5, -1.6)]; trails.push([bez(a, [(a[0] + b[0]) / 2, b[1] - .4], b), .45 * P.wear, .38]);
      const sx = dx < drv[0] ? drv[1] + .5 : drv[0] - .5; if (info.back) trails.push([bez([sx, info.front - .6], [sx, (info.front + info.back) / 2], [sx + Math.sign(sx - dx) * -.6, info.back - 1.6], 8), .55 * P.wear, .42]); }
    else trails.push([bez([dx, dz + .3], [dx + .8, dz / 2], [dx + 1.2, -.4]), .5 * P.wear, .4]);
    for (const w of wears) if (info.back !== undefined && w[1] < info.back) trails.push([bez([dx, info.back - .3], [(dx + w[0]) / 2 + .7, (info.back + w[1]) / 2], [w[0], w[1] + w[2] * .6], 8), .5 * P.wear, .36]); }
  // a kept lawn walks on stepping stones (every 0.62 m along the side passage and out to the back yard's piece); the others wear a trail
  const stones = [];
  if (P.wear < .5) { for (const t of trails.splice(info.drive ? 1 : 0)) { let acc = .3; for (let q = 1; q < t[0].length; q++) { const [ax, az] = t[0][q - 1], [bx, bz] = t[0][q], l = Math.hypot(bx - ax, bz - az);
      while (acc < l) { const u = acc / l, j = hash(stones.length, 3, 81); stones.push([ax + (bx - ax) * u + (j - .5) * .12, az + (bz - az) * u + (hash(stones.length, 4, 81) - .5) * .12, .17 + j * .05]); acc += .62; } acc -= l; } }
    trails.length = 0; }
  for (const t of trails) { const xs_ = t[0].map(p => p[0]), zs_ = t[0].map(p => p[1]); t[3] = [Math.min(...xs_), Math.min(...zs_), Math.max(...xs_), Math.max(...zs_)]; }
  // the patch: every texel whose centre is in the lot
  const wc = poly.map(([lx, lz]) => [o.x + lx * c + lz * sn, o.z - lx * sn + lz * c]), xs = wc.map(p => p[0]), zs = wc.map(p => p[1]);
  const i0 = Math.max(0, Math.floor((Math.min(...xs) - G.x0) / s) - 1), i1 = Math.min(G.nx - 1, Math.ceil((Math.max(...xs) - G.x0) / s) + 1), k0 = Math.max(0, Math.floor((Math.min(...zs) - G.z0) / s) - 1), k1 = Math.min(G.nz - 1, Math.ceil((Math.max(...zs) - G.z0) / s) + 1);
  const pw = i1 - i0 + 1, ph = k1 - k0 + 1, tex = new Uint8Array(pw * ph * 4), mask = new Uint8Array(pw * ph), PT = new Painter(G.nx);
  // the lot's edges as half-planes (inward normals; poly is convex): inside = every one ≥ 0; the fence distance = the least of the sides and back
  const cx_ = poly.reduce((a, p) => a + p[0] / 4, 0), cz_ = poly.reduce((a, p) => a + p[1] / 4, 0), HP = [];
  for (let e = 0; e < 4; e++) { const [ax, az] = poly[e], [bx, bz] = poly[(e + 1) % 4], l = Math.hypot(bx - ax, bz - az) || 1; let nx_ = -(bz - az) / l, nz_ = (bx - ax) / l;
    if ((cx_ - ax) * nx_ + (cz_ - az) * nz_ < 0) { nx_ = -nx_; nz_ = -nz_; } HP.push([nx_, nz_, -(ax * nx_ + az * nz_)]); }
  const [E0, E1, E2, E3] = HP;
  for (let k = 0; k < ph; k++) { const wz = G.z0 + (k0 + k + .5) * s, dz = wz - o.z; for (let i = 0; i < pw; i++) { const wx = G.x0 + (i0 + i + .5) * s, dx = wx - o.x, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const h0 = E0[0] * lx + E0[1] * lz + E0[2], h1 = E1[0] * lx + E1[1] * lz + E1[2], h2 = E2[0] * lx + E2[1] * lz + E2[2], h3 = E3[0] * lx + E3[1] * lz + E3[2];
    if (h0 < 0 || h1 < 0 || h2 < 0 || h3 < 0) continue; const n = k * pw + i, to = n * 4; mask[n] = 1;
    let dens = PT.at(i0 + i, k0 + k, wx, wz, s, P, lx, lz);
    const qx = Math.floor(wx / s + 1e-6), qz = Math.floor(wz / s + 1e-6), vi = Math.floor((lx - ox) * 10), vk = Math.floor((lz - oz) * 10), inV = vi >= 0 && vk >= 0 && vi < nx && vk < nz, vn_ = vk * nx + vi;
    const dP = inV ? Dp[vn_] / 30 : 9, dG = inV ? Dg[vn_] / 30 : 9, dH = inV ? Dh[vn_] / 30 : 9, dT = inV ? Dt[vn_] / 30 : 9, dE = Math.min(h1, h2, h3), occd = inV && V.d[vn_] !== 0;   // (poly: FL FR BR BL, so edges 1–3 are the sides and back)
    // the fence line: the mower can't reach (long, darker grass), more on a wilder lawn
    const fl = Math.min(dE, dT + .05, dG + .05);
    if (fl < .8) { const t = sst(.8, .12, fl); mixO(SHADE, t * .5); dens = Math.max(dens, P.edge * t * (.6 + .4 * vn(wx * 2.1, wz * 2.1, 41))); }
    // mulch: a bed round the shrubs, a drip strip at the walls (kept lawns), with the cut edge; edging along the paths
    const bed = Math.min(dG < 3 && dH < 2.2 ? dG - (P.wild > 60 ? .3 : .65) : 9, dH - (P.wear > .9 ? .12 : .3));
    if (bed < 0) { const M = MULCH[(hash(qx, qz, 42) * 3) | 0]; O[0] = M[0]; O[1] = M[1]; O[2] = M[2]; if (hash(qx, qz, 43) > .985) { O[0] = 196; O[1] = 160; O[2] = 112; } dens = 0; }
    else if (bed < .1 && P.edge < 200) { O[0] = CUT[0]; O[1] = CUT[1]; O[2] = CUT[2]; dens = 0; }
    else if (dP < .22) { if (P.wild > 60) dens = Math.max(dens, 110); else { mixO(CUT, dP < .12 ? .85 : .35); dens = 0; } }
    else if (dP < .35 && P.wild < 60) dens = Math.min(dens, 10);
    // the trails (worn to straw, then dirt, broken up), the pieces' wear, the sprinkler's wet patch
    if (bed >= .1) {
      let wear = 0; for (const [pts, k2, w, bb] of trails) { if (lx < bb[0] - w || lx > bb[2] + w || lz < bb[1] - w || lz > bb[3] + w) continue; let d = 1e9; for (let q = 1; q < pts.length; q++) d = Math.min(d, segDist(lx, lz, pts[q - 1][0], pts[q - 1][1], pts[q][0], pts[q][1])); if (d < w) wear = Math.max(wear, k2 * sst(w, w * .3, d)); }
      for (const [x, z, r, kind] of wears) { const d = Math.hypot(lx - x, lz - z); if (d > r + .8) continue; if (kind === 'swing') { for (const sx of [-.7, .7]) { const e = Math.hypot(lx - x - sx, lz - z); if (e < .45) wear = Math.max(wear, .9 * sst(.45, .15, e)); } }
        else if (d < r) wear = Math.max(wear, (kind === 'under' ? .55 : kind === 'ring' ? .4 * sst(r * .6, r * .8, d) : .45) * sst(r, r * .55, d)); }
      if (wear > 0) { const b = vn(wx * 3.3, wz * 3.3, 44); const t = wear * (.55 + .7 * b); if (t > .25) { mixO(STRAW, Math.min(1, t * 1.3)); if (t > .6 && hash(qx, qz, 45) < (t - .55) * 1.6) mixO(hash(qx, qz, 46) > .5 ? DIRT : DIRT2, .85); dens *= Math.max(0, 1 - t * 1.5); } }
      for (const [x, z, r] of stones) { const d = Math.max(Math.abs(lx - x), Math.abs(lz - z)) * .7 + Math.hypot(lx - x, lz - z) * .3; if (d < r + .07) { if (d < r) { const g = hash(qx, qz, 82) > .5 ? 0xc9 : 0xbf; O[0] = g; O[1] = g - 4; O[2] = g - 14; if (d > r - .06) { O[0] -= 22; O[1] -= 22; O[2] -= 22; } } else mixO(CUT, .5); dens = 0; } }
      for (const [x, z] of wets) { const d = Math.hypot(lx - x, lz - z); if (d < 2.7) { mixO(WET, .55 * sst(2.7, 1.2, d) * (.7 + .3 * vn(wx * 1.7, wz * 1.7, 47))); if (d < .9 && hash(qx, qz, 48) < .12 * sst(.9, .3, d)) { O[0] = PUDDLE[0]; O[1] = PUDDLE[1]; O[2] = PUDDLE[2]; } } } }
    put(tex, to, occd ? 0 : dens);
    for (const [x, z, R, sp] of trees) { const d = Math.hypot(lx - x, lz - z); if (d < R * 1.15) treeTexel(tex, to, wx, wz, s, d, R, sp, P.wild < 60 && P.edge < 200, P.wild); }
  } }
  return { g: o.grid, i0, k0, nx: pw, nz: ph, tex, mask };
}

// ── the scene's trees (main thread, after the lots are stamped): shade, leaves, long grass round each trunk, on grass texels only; T: a
// map's texels, g its grid, kept(x, z): whether a tree stands on a kept lawn (a mulch ring), else the park's long grass
export function treeShade(T, g, trees, kept) {
  const F = GRIDS.fine, skipF = g !== F;
  for (const [x, z, sp, size] of trees) { if (skipF && x > F.x0 + 4 && x < F.x1 - 4 && z > F.z0 + 4 && z < F.z1 - 4) continue; const R = crownR(sp, size | 0), i0 = Math.max(0, Math.floor((x - R * 1.2 - g.x0) / g.s)), i1 = Math.min(g.nx - 1, Math.ceil((x + R * 1.2 - g.x0) / g.s)),
      k0 = Math.max(0, Math.floor((z - R * 1.2 - g.z0) / g.s)), k1 = Math.min(g.nz - 1, Math.ceil((z + R * 1.2 - g.z0) / g.s)); if (i1 < i0 || k1 < k0) continue;
    for (let k = k0; k <= k1; k++) { const wz = g.z0 + (k + .5) * g.s; for (let i = i0; i <= i1; i++) { const wx = g.x0 + (i + .5) * g.s, o = (k * g.nx + i) * 4; if (!LAWNY(T, o)) continue;
      treeTexel(T, o, wx, wz, g.s, Math.hypot(wx - x, wz - z), R, sp, kept?.(x, z) ?? false, 30); } } }
}
// a texel that is grass (green leads): the trees only touch grass, not the walks or the roads
const LAWNY = (T, o) => T[o + 1] > T[o] + 12 && T[o + 1] > T[o + 2] + 20;
export { GRAVEL, DIRT, DIRT2, STRAW };
