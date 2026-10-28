// Voxel kit: dense volumes → greedy mesh with the SAME corner-AO curve as world/chars.js, typed-array banks (per block, per
// material layer), quarter-turn stamping for props, a 5×7 pixel font and a canvas→voxel painter for display lettering.
import { CV, PAL } from './style.js';
import { REG } from './audit.js';
export const AOV = [0.55, 0.72, 0.87, 1];

export class Vol {
  constructor(nx, ny, nz, o = {}) {
    Object.assign(this, { nx, ny, nz, sxz: nx * nz, s: o.s ?? CV, org: o.org ?? [0, 0, 0], ground: o.ground ?? true });
    this.d = new Uint16Array(nx * ny * nz); this.pal = [0]; this.lay = [0]; this.pm = new Map();
  }
  ci(c, l = 0) { const k = c * 4 + l; let i = this.pm.get(k); if (i === undefined) { i = this.pal.length; this.pal.push(c); this.lay.push(l); this.pm.set(k, i); } return i; }
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz; }
  set(x, y, z, c, l = 0) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (c === undefined || c === null || !this.in(x, y, z)) return; this.d[x + z * this.nx + y * this.sxz] = c < 0 ? 0 : this.ci(c, l); }
  del(x, y, z) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (this.in(x, y, z)) this.d[x + z * this.nx + y * this.sxz] = 0; }
  has(x, y, z) { return this.in(x, y, z) && this.d[x + z * this.nx + y * this.sxz] !== 0; }
  box(x0, y0, z0, x1, y1, z1, c, l = 0) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); z0 = Math.max(0, Math.round(z0));
    x1 = Math.min(this.nx, Math.round(x1)); y1 = Math.min(this.ny, Math.round(y1)); z1 = Math.min(this.nz, Math.round(z1));
    const f = typeof c === 'function'; if (!f && (c === undefined || c === null)) return; const ci = f ? 0 : (c < 0 ? 0 : this.ci(c, l));
    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) { let i = x0 + z * this.nx + y * this.sxz;
      for (let x = x0; x < x1; x++, i++) { if (f) { const v = c(x, y, z); if (v !== undefined && v !== null) this.d[i] = v < 0 ? 0 : this.ci(v, l); } else this.d[i] = ci; } }
  }
  clear(x0, y0, z0, x1, y1, z1) { this.box(x0, y0, z0, x1, y1, z1, -1); }
  // pass 1d: remember a text voxel (x, y, z) whose board lies at −(nx, nz) and whose viewer lies at +(nx, nz); checked at mesh time
  rec(label, x, y, z, bx, bz, fx, fz) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (!this.in(x, y, z)) return; const T = this.texts ??= []; let t = T[T.length - 1];
    if (!t || t.label !== label || t.open !== this.recOpen) T.push(t = { label, pts: [], open: this.recOpen }); t.pts.push(x, y, z, Math.round(bx), Math.round(bz), Math.round(fx), Math.round(fz), this.d[x + z * this.nx + y * this.sxz]); }
  recN(label, x, y, z, nx, nz) { this.rec(label, x, y, z, x - nx, z - nz, x + nx, z + nz); }
  recNext() { this.recOpen = (this.recOpen || 0) + 1; }
  ell(cx, cy, cz, rx, ry, rz, c, l = 0) { for (let x = Math.floor(cx - rx); x <= cx + rx; x++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++)
    if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2 <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
}

// ── growable typed buffers; a Bank = 4 material layers (0 matte · 1 gloss · 2 metal · 3 lit)
class Buf { constructor(T, n = 1 << 12) { this.T = T; this.a = new T(n); this.n = 0; }
  need(k) { if (this.n + k > this.a.length) { const b = new this.T(Math.max(this.a.length * 2, this.n + k)); b.set(this.a.subarray(0, this.n)); this.a = b; } } }
// pass 1c LOD: with LOD.on every Bank carries a `mid` companion (the same voxels downsampled 2×: 0.1 → 0.2 cubes) and, with
// LOD.far, a `far` one (5×: 0.5 cubes). meshVol fills them; stamp propagates them. Small props (< 1.3 m across and < 2.5 m tall)
// drop out of mid; banks flagged `.big` (roof set pieces, big signs) go into mid at full detail. LOD off = pass 1b behaviour.
export const LOD = { on: false, far: false, faces: true, detail: true };   // faces: pass 2's downVol weighting (the colour you'd see) · detail: the fidelity pass's mid tier (midOf, meshMid)
export class Bank {
  constructor(noLod) { this.L = [0, 1, 2, 3].map(() => ({ P: new Buf(Float32Array), N: new Buf(Int8Array), C: new Buf(Float32Array), I: new Buf(Uint32Array), v: 0 }));
    if (LOD.on && !noLod) { this.mid = new Bank(true); if (LOD.far) this.far = new Bank(true); } }
  tris() { return this.L.reduce((s, l) => s + l.I.n / 3, 0); }
}
// cleanup pass · a FAR-ONLY bank: meshVol and stamp fill only its `far` companion (the 5× downsample: 0.5 cubes), never the 0.1 and
// 0.2 meshes. A hero block's far tier is its own build downsampled (jobs.js jobFar), so this is the same far tier the full build makes,
// at a fraction of the cost (the 0.1 greedy mesh is most of a build). Only the block bank and its temporary banks (a lot meshed and then
// stamped: gen.js buildLot, setpieces.js emit) are far-only; prop templates are never (they are cached per worker and reused).
export function farBank() { const b = new Bank(true); b.far = new Bank(true); b.farOnly = true; return b; }
// a temporary bank that will be stamped into `dst`: far-only when dst is, else a normal (LOD) bank
export const tempBank = dst => dst && dst.farOnly ? farBank() : new Bank();
// downsample a volume by an integer factor: a coarse cell is solid when ≥ minFill of its f³ voxels are, coloured by the palette entry
// you'd see: pass 2 weighs every voxel by 4 when it touches air (a face shows) and lit voxels by 3 (neon, lit windows), so a one-voxel
// sign face over its ink board, or a roof deck over the wall fill, keeps its colour at mid and far (it used to lose on a tie to the
// fill, first-visited). Same palette, same origin, cube size × f.
export function downVol(V, f, minFill) {
  const nx = Math.ceil(V.nx / f), ny = Math.ceil(V.ny / f), nz = Math.ceil(V.nz / f), D = new Vol(nx, ny, nz, { s: V.s * f, org: V.org, ground: V.ground });
  D.pal = V.pal; D.lay = V.lay; D.pm = V.pm;
  const d = V.d, sxz = V.sxz, Vx = V.nx, Vy = V.ny, Vz = V.nz, lay = V.lay, cnt = new Uint16Array(V.pal.length + 1), seen = new Uint16Array(f * f * f), dd = D.d, gnd = V.ground; let o = 0;
  const open = (xx, yy, zz, i) => xx === 0 || !d[i - 1] || xx === Vx - 1 || !d[i + 1] || zz === 0 || !d[i - Vx] || zz === Vz - 1 || !d[i + Vx] || yy === Vy - 1 || !d[i + sxz] || (yy === 0 ? !gnd : !d[i - sxz]);
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++, o++) {
    let n = 0, k = 0, best = 0, bc = 0; const y0 = y * f, z0 = z * f, x0 = x * f, y1 = Math.min(Vy, y0 + f), z1 = Math.min(Vz, z0 + f), x1 = Math.min(Vx, x0 + f);
    for (let yy = y0; yy < y1; yy++) for (let zz = z0; zz < z1; zz++) { let i = x0 + zz * Vx + yy * sxz; for (let xx = x0; xx < x1; xx++, i++) { const v = d[i]; if (!v) continue; n++;
      if (cnt[v] === 0) seen[k++] = v; const c = (cnt[v] += (lay[v] === 3 ? 3 : 1) * (LOD.faces && open(xx, yy, zz, i) ? 4 : 1)); if (c > bc) { bc = c; best = v; } } }
    for (let t = 0; t < k; t++) cnt[seen[t]] = 0;
    if (n >= minFill) dd[o] = best;
  }
  return D;
}
// fidelity pass (2026-09-28) · THE MID TIER'S DOWNSAMPLE (downVol stays for the far tier and the interiors). A coarse cell (2×2×2 voxels)
// is solid when ≥ minFill of its voxels are, as before, and is coloured by what you'd see of it: for every face it shows (its coarse
// neighbour is air), the four 0.1 pixels you'd see looking into that face (the first solid voxel along each ray, from 0.2 m out to the
// cell's back), lit voxels ×3. A tie goes to the colour that is not the cell's bulk: a 1-voxel trim, siding line, court line, sill or
// window bar is exactly half a cell, and it used to lose or win by visit order, so lines broke into dashes; now a line stays one cell wide.
// DETAIL keeps its 0.1 pixels: the cells that show a text voxel (V.rec, the kits' and signage's lettering) or wall paint (HOOKS.wall:
// ads, murals, tags) are meshed at 0.1 on the SAME coarse surface — the same cubes, their faces split into 0.1 pixels, one small fine
// volume per connected patch — so lettering at mid reads exactly as near, and the silhouette, the AO and the seams are the coarse tier's.
// → { D: the coarse volume (detail cells solid but skipped: D.skip), F: [fine volumes] }. Same palette, origin and grain as downVol(V, 2).
export function midOf(V, minFill = 2, flags = null, air = null) {
  const nx = Math.ceil(V.nx / 2), ny = Math.ceil(V.ny / 2), nz = Math.ceil(V.nz / 2), D = new Vol(nx, ny, nz, { s: V.s * 2, org: V.org, ground: V.ground });
  D.pal = V.pal; D.lay = V.lay; D.pm = V.pm;
  const d = V.d, Vx = V.nx, Vy = V.ny, Vz = V.nz, sxz = V.sxz, lay = V.lay, dd = D.d, Dsxz = D.sxz, gnd = V.ground, cnt = new Uint16Array(V.pal.length + 1), seen = new Uint16Array(8);
  // 1 · solidity and the bulk colour (the most common voxel: what a tie is decided against). `air`: raised lettering, left out of the
  // solidity (0.1 relief is invisible at mid, and a 0.2 lump per stroke is what broke it): its board's face shows it as paint below
  const kept = air ? air.map(i => d[i]) : null; if (air) for (const i of air) d[i] = 0;
  let o = 0;
  try {
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++, o++) {
    let n = 0, k = 0, best = 0, bc = 0; const y0 = y * 2, z0 = z * 2, x0 = x * 2, y1 = Math.min(Vy, y0 + 2), z1 = Math.min(Vz, z0 + 2), x1 = Math.min(Vx, x0 + 2);
    for (let yy = y0; yy < y1; yy++) for (let zz = z0; zz < z1; zz++) { let i = x0 + zz * Vx + yy * sxz; for (let xx = x0; xx < x1; xx++, i++) { const v = d[i]; if (!v) continue; n++;
      if (cnt[v] === 0) seen[k++] = v; const c = ++cnt[v]; if (c > bc) { bc = c; best = v; } } }
    for (let t = 0; t < k; t++) cnt[seen[t]] = 0;
    if (n >= minFill) dd[o] = best;
  }
  } finally { if (air) air.forEach((i, k) => { d[i] = kept[k]; }); }
  const csolid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz ? dd[x + z * nx + y * Dsxz] !== 0 : (gnd && y < 0);
  // what a face shows: face f (0 +x · 1 −x · 2 +y · 3 −y · 4 +z · 5 −z), sub-pixel p = pu·2 + pw (u = axis a+1, w = axis a+2) → slot f·4 + p
  const SC = new Int32Array(24), SI = new Int32Array(24), B3 = [0, 0, 0], DIMS = [Vx, Vy, Vz], STR = [1, sxz, Vx];
  function project(cx, cy, cz, o) {   // cell (cx, cy, cz) = coarse index o → the exposed-face mask; SC[slot] = palette index seen (0: nothing), SI[slot] = its voxel index
    let exp = 0; B3[0] = cx * 2; B3[1] = cy * 2; B3[2] = cz * 2;
    for (let f = 0; f < 6; f++) {
      const nb = f === 0 ? (cx < nx - 1 ? dd[o + 1] : 0) : f === 1 ? (cx > 0 ? dd[o - 1] : 0) : f === 2 ? (cy < ny - 1 ? dd[o + Dsxz] : 0) : f === 3 ? (cy > 0 ? dd[o - Dsxz] : gnd ? 1 : 0) : f === 4 ? (cz < nz - 1 ? dd[o + nx] : 0) : (cz > 0 ? dd[o - nx] : 0);
      if (nb) continue; exp |= 1 << f;
      const a = f >> 1, u = a === 2 ? 0 : a + 1, w = a === 0 ? 2 : a - 1, sa = STR[a], su = STR[u], sw = STR[w], Da = DIMS[a], Du = DIMS[u], Dw = DIMS[w], a0 = f & 1 ? B3[a] - 2 : B3[a] + 3, da = f & 1 ? 1 : -1;
      for (let p = 0; p < 4; p++) { const cu = B3[u] + (p >> 1), cw = B3[w] + (p & 1); let hit = 0, hi = -1;
        if (cu < Du && cw < Dw) for (let t = 0, ca = a0; t < 4; t++, ca += da) { if (ca < 0 || ca >= Da) continue; const i = ca * sa + cu * su + cw * sw, v = d[i]; if (v) { hit = v; hi = i; break; } }
        SC[f * 4 + p] = hit; SI[f * 4 + p] = hi; } }
    return exp; }
  const uc = new Int32Array(24), uw = new Float64Array(24);
  function vote(exp, bulk) { let m = 0;
    for (let f = 0; f < 6; f++) { if (!(exp & (1 << f))) continue; for (let p = 0; p < 4; p++) { const v = SC[f * 4 + p]; if (!v) continue; const wgt = lay[v] === 3 ? 3 : 1; let q = 0; while (q < m && uc[q] !== v) q++; if (q === m) { uc[m] = v; uw[m++] = 0; } uw[q] += wgt; } }
    if (!m) return bulk; let best = uc[0], bw = uw[0];
    for (let q = 1; q < m; q++) if (uw[q] > bw || (uw[q] === bw && best === bulk)) { best = uc[q]; bw = uw[q]; }   // (a tie: the line, not the wall it is drawn on)
    return best; }
  // 2 · the colour of every cell that shows a face (a cell with six solid neighbours shows none: skipped without a call)
  o = 0;
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++, o++) { const b = dd[o]; if (!b) continue;
    if (x > 0 && x < nx - 1 && y > 0 && y < ny - 1 && z > 0 && z < nz - 1 && dd[o - 1] && dd[o + 1] && dd[o - nx] && dd[o + nx] && dd[o - Dsxz] && dd[o + Dsxz]) continue;
    const exp = project(x, y, z, o); if (exp) dd[o] = vote(exp, b); }
  const F = [], det = new Map(); if (!flags || !flags.size) return { D, F, det };
  // 3 · detail: the cells that show a flagged voxel (from its own cell and the ones round it, whose faces look into it), and the cells
  // beside those whose faces are not one colour (a sign's border line would otherwise take a whole cell and touch the letters); in patches
  const cand = new Set();
  for (const i of flags) { const y = Math.floor(i / sxz), r = i - y * sxz, z = Math.floor(r / Vx), x = r - z * Vx, cx = x >> 1, cy = y >> 1, cz = z >> 1;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = cx + dx, Y = cy + dy, Z = cz + dz;
      if (X >= 0 && Y >= 0 && Z >= 0 && X < nx && Y < ny && Z < nz) cand.add(X + Z * nx + Y * Dsxz); } }
  // det: coarse index → { exp, c: slot colours, fl: slot shows detail }
  for (const k of cand) { if (!dd[k]) continue; const y = Math.floor(k / Dsxz), r = k - y * Dsxz, z = Math.floor(r / nx), x = r - z * nx, exp = project(x, y, z, k); if (!exp) continue;
    let any = false, one = 0, mixed = false; const fl = new Uint8Array(24);
    for (let s = 0; s < 24; s++) { if (!((exp >> (s >> 2)) & 1) || !SC[s]) continue; if (flags.has(SI[s])) { fl[s] = 1; any = true; } if (!one) one = SC[s]; else if (SC[s] !== one) mixed = true; }
    if (any || mixed) det.set(k, { exp, c: SC.slice(), fl }); }
  if (!det.size) return { D, F, det };
  const skip = D.skip = new Uint8Array(dd.length); for (const k of det.keys()) skip[k] = 1;
  const done = new Set();
  for (const k0 of det.keys()) { if (done.has(k0)) continue; const comp = [k0], st = [k0]; done.add(k0); let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1, y1 = -1, z1 = -1;
    while (st.length) { const k = st.pop(), y = Math.floor(k / Dsxz), r = k - y * Dsxz, z = Math.floor(r / nx), x = r - z * nx;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
        const j = X + Z * nx + Y * Dsxz; if (det.has(j) && !done.has(j)) { done.add(j); comp.push(j); st.push(j); } } }
    // the patch's fine volume: its detail cells at 0.1 (each face pixel the colour it shows), every other solid cell in its box solid but
    // skipped, and outside the box the coarse cells (so no face is drawn against a coarse neighbour, and the AO sees the coarse tier)
    const fx = (x1 - x0 + 1) * 2, fy = (y1 - y0 + 1) * 2, fz = (z1 - z0 + 1) * 2, s = V.s, W = new Vol(fx, fy, fz, { s, org: [V.org[0] + x0 * 2 * s, V.org[1] + y0 * 2 * s, V.org[2] + z0 * 2 * s], ground: false });
    W.pal = V.pal; W.lay = V.lay; W.pm = V.pm; const wd = W.d, ws = W.skip = new Uint8Array(wd.length), mine = new Set(comp);
    W.outside = (x, y, z) => csolid(x0 + (x >> 1), y0 + (y >> 1), z0 + (z >> 1));
    for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) { const k = cx + cz * nx + cy * Dsxz, b = dd[k]; if (!b) continue; const e = mine.has(k) ? det.get(k) : null;
      for (let l = 0; l < 8; l++) { const L = [l & 1, (l >> 1) & 1, l >> 2], i = (cx - x0) * 2 + L[0] + ((cz - z0) * 2 + L[2]) * fx + ((cy - y0) * 2 + L[1]) * fx * fz;
        if (!e) { wd[i] = b; ws[i] = 1; continue; }
        let col = 0, fl = false, pad = 0;   // the pixel this voxel shows on each face it sits on (a detail pixel first)
        for (let f = 0; f < 6; f++) { if (!(e.exp & (1 << f))) continue; const a = f >> 1; if (L[a] !== (f & 1 ? 0 : 1)) continue; const sl = f * 4 + L[(a + 1) % 3] * 2 + L[(a + 2) % 3], c = e.c[sl];
          if (c && e.fl[sl] && !fl) { col = c; fl = true; } else if (c && !col) col = c;
          if (!c && !pad) for (let q = 0; q < 4; q++) { const c2 = e.c[f * 4 + q]; if (c2 && !e.fl[f * 4 + q]) { pad = c2; break; } } }   // (a pixel the coarse cube adds beyond the real surface: the board's colour, never the ink's)
        wd[i] = col || pad || b; } }
    F.push(W); }
  return { D, F, det };
}
// the mid tier of a volume: the coarse cells, then each detail patch (flags: text voxels, V.rec; `tap`: the voxels the wall paint set).
// LOD.detail: true (default) · 'lines' (the projected colours and the line rule, no 0.1 patches) · false (pass 2's downVol, for A/B)
function meshMid(V, bank, tap = null) {
  if (!LOD.faces || LOD.detail === false) return meshVolRaw(downVol(V, 2, 2), bank);   // (?pass2=0 / ?faces=0: the pass 1d mid tier exactly)
  let flags = null, air = null; const d = V.d, nx = V.nx, sxz = V.sxz, has = (x, y, z) => V.in(x, y, z) && d[x + z * nx + y * sxz] !== 0;
  if (LOD.detail === true && (V.texts || tap?.length)) { flags = new Set(); air = [];
    if (V.texts) for (const t of V.texts) { const p = t.pts; for (let k = 0; k < p.length; k += 8) { const x = p[k], y = p[k + 1], z = p[k + 2], i = x + z * nx + y * sxz; if (!d[i] || flags.has(i)) continue; flags.add(i);
      // raised lettering: a board behind it (rec's board point), and air beside it in the face's plane (flush paint has wall there)
      const bx = p[k + 3], bz = p[k + 4], ax = Math.sign(x - bx), az = Math.sign(z - bz); if ((ax !== 0) === (az !== 0) || !has(x - ax, y, z - az)) continue;
      if (!has(x, y + 1, z) || !has(x, y - 1, z) || (ax ? !has(x, y, z + 1) || !has(x, y, z - 1) : !has(x + 1, y, z) || !has(x - 1, y, z))) air.push(i); } }
    if (tap) for (const i of tap) if (d[i]) flags.add(i); }
  const { D, F, det } = midOf(V, 2, flags, air && air.length ? air : null); meshVolRaw(D, bank); for (const W of F) meshVolRaw(W, bank);
  if (LOD.check) midCheck(V, D, det, tap);
  return bank;
}
// fidelity pass · THE LETTERING CHECK (LOD.check = { runs: [] }; off by default). For every text run (V.rec: a sign, a name, a plaque)
// and every piece of wall paint, what its face shows at mid against what it shows near, seen along the run's viewer direction (the first
// solid voxel, or coarse cell, from 0.4 m out to 0.3 m in): lost = a pixel of the run that shows another colour at mid; bleed = a pixel
// of the 0.1 ring round it that shows one of the run's colours at mid but not near (ink running into a gap). A run whose own voxels are
// mostly hidden near (a card behind a shutter) is not checked. → runs: { label, kind, ink, lost, bleed } now, and lostOld / bleedOld
// for downVol(V, 2, 2) (the mid tier before this pass), or hidden: true.
function midCheck(V, D, det, tap) {
  const d = V.d, Vx = V.nx, Vy = V.ny, Vz = V.nz, sxz = V.sxz, pal = V.pal, O = downVol(V, 2, 2), dd = D.d, od = O.d, nx = D.nx, ny = D.ny, nz = D.nz, Dsxz = D.sxz;
  const runs = []; if (V.texts) for (const t of V.texts) { const p = t.pts, n = p.length / 8; if (!n) continue; const fx = Math.sign(p[5] - p[0]), fz = Math.sign(p[6] - p[2]); if ((fx !== 0) === (fz !== 0)) continue;
    const pts = []; for (let k = 0; k < p.length; k += 8) pts.push([p[k], p[k + 1], p[k + 2]]); runs.push({ label: t.label, kind: 'text', f: fx > 0 ? 0 : fx < 0 ? 1 : fz > 0 ? 4 : 5, pts }); }
  if (tap?.length) { const byF = new Map();   // wall paint: by the face it shows on, then 8-connected (2-voxel reach) pieces in that face
    for (const i of new Set(tap)) { if (!d[i]) continue; const y = Math.floor(i / sxz), r = i - y * sxz, z = Math.floor(r / Vx), x = r - z * Vx;
      const f = x + 1 < Vx && !d[i + 1] ? 0 : x > 0 && !d[i - 1] ? 1 : z + 1 < Vz && !d[i + Vx] ? 4 : z > 0 && !d[i - Vx] ? 5 : -1; if (f < 0) continue; if (!byF.has(f)) byF.set(f, new Map()); byF.get(f).set(i, [x, y, z]); }
    for (const [f, M] of byF) { const seen = new Set(); for (const [i0, q0] of M) { if (seen.has(i0)) continue; const pts = [], st = [q0]; seen.add(i0);
      while (st.length) { const q = st.pop(); pts.push(q); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const X = f < 2 ? q[0] : q[0] + a, Y = q[1] + b, Z = f < 2 ? q[2] + a : q[2], j = X + Z * Vx + Y * sxz; if (M.has(j) && !seen.has(j)) { seen.add(j); st.push(M.get(j)); } } }
      if (pts.length >= 6) runs.push({ label: 'paint', kind: 'paint', f, pts }); } } }
  let hitI = -1, hitT = 99;
  const near = (P, a, sg) => { const Q = P.slice(); hitI = -1; hitT = 99; for (let t = 4; t >= -3; t--) { Q[a] = P[a] + sg * t; const [x, y, z] = Q; if (x < 0 || y < 0 || z < 0 || x >= Vx || y >= Vy || z >= Vz) continue; const i = x + z * Vx + y * sxz, v = d[i]; if (v) { hitI = i; hitT = t; return pal[v]; } } return -1; };
  const mid = (P, a, sg, f, cd, withDet) => { const Q = P.slice(); for (let t = 4; t >= -3; t--) { Q[a] = P[a] + sg * t; const X = Q[0] >> 1, Y = Q[1] >> 1, Z = Q[2] >> 1; if (Q[0] < 0 || Q[1] < 0 || Q[2] < 0 || X >= nx || Y >= ny || Z >= nz) continue;
    const k = X + Z * nx + Y * Dsxz, v = cd[k]; if (!v) continue; const e = withDet && det.get(k); if (e) { const u = (a + 1) % 3, w = (a + 2) % 3, c = e.c[f * 4 + (Q[u] & 1) * 2 + (Q[w] & 1)]; return pal[c || v]; } return pal[v]; } return -1; };
  for (const R of runs) { const a = R.f >> 1, sg = R.f & 1 ? -1 : 1, u = (a + 1) % 3, w = (a + 2) % 3, own = new Set(), ink = new Map(), px = new Map();
    for (const q of R.pts) own.add(q[0] + q[2] * Vx + q[1] * sxz);
    for (const q of R.pts) { const k0 = q[u] + ',' + q[w]; ink.set(k0, q); for (let du = -1; du <= 1; du++) for (let dw = -1; dw <= 1; dw++) { const Q = q.slice(); Q[u] += du; Q[w] += dw; const k = Q[u] + ',' + Q[w]; if (!px.has(k)) px.set(k, Q); } }
    const cols = new Set(), depth = new Set(); let vis = 0, lost = 0, bleed = 0, lostOld = 0, bleedOld = 0;
    for (const Q of ink.values()) { const nv = near(Q, a, sg); if (own.has(hitI)) { vis++; cols.add(nv); depth.add(hitT); } }
    const hidden = vis < ink.size * .5;
    const at2 = (Q, du, dw) => { const P = Q.slice(); P[u] += du; P[w] += dw; return near(P, a, sg); }, stripe = (Q, c) => { const a1 = at2(Q, 0, -1), b1 = at2(Q, 0, 1), a2 = at2(Q, -1, 0), b2 = at2(Q, 1, 0); return (a1 === b1 && a1 !== c) || (a2 === b2 && a2 !== c); };
    if (!hidden) for (const [k, Q] of px) { const nv = near(Q, a, sg), isInk = ink.has(k) && own.has(hitI), m1 = mid(Q, a, sg, R.f, dd, true), m0 = mid(Q, a, sg, R.f, od, false);
      const same = depth.has(hitT) || depth.has(hitT - 1) || depth.has(hitT + 1);   // (bleed is ink running over its own ground, not a cube's edge past a silhouette)
      if (isInk) { if (m1 !== nv) lost++; if (m0 !== nv) lostOld++; } else if (same && !cols.has(nv) && !stripe(Q, nv)) { if (cols.has(m1)) bleed++; if (cols.has(m0)) bleedOld++; } }   // (a 1-px stripe of the ground — a roll gate's slats — has no 0.2 form)
    const at = [+(V.org[0] + R.pts[0][0] * V.s).toFixed(1), +(V.org[1] + R.pts[0][1] * V.s).toFixed(1), +(V.org[2] + R.pts[0][2] * V.s).toFixed(1)];
    LOD.check.runs.push({ label: R.label, kind: R.kind, blk: REG.blk ? REG.blk.i + '_' + REG.blk.j : null, ink: vis, hidden, lost, bleed, lostOld, bleedOld, at, f: R.f }); }
}
const bigEnough = (V, m, h) => Math.max(V.nx, V.nz) * V.s >= m || V.ny * V.s >= h;
// emit one quad (4 corners, CCW seen from the normal) into a layer
function quad(O, xs, ys, zs, nx, ny, nz, rgb, A) {
  O.P.need(12); O.N.need(12); O.C.need(12); O.I.need(6); const v0 = O.v;
  for (let q = 0; q < 4; q++) { O.P.a[O.P.n++] = xs[q]; O.P.a[O.P.n++] = ys[q]; O.P.a[O.P.n++] = zs[q]; O.N.a[O.N.n++] = nx * 127; O.N.a[O.N.n++] = ny * 127; O.N.a[O.N.n++] = nz * 127;
    const f = AOV[A[q]]; O.C.a[O.C.n++] = rgb[0] * f; O.C.a[O.C.n++] = rgb[1] * f; O.C.a[O.C.n++] = rgb[2] * f; }
  const I = O.I.a; let n = O.I.n;
  if (A[0] + A[2] < A[1] + A[3]) { I[n++] = v0 + 1; I[n++] = v0 + 2; I[n++] = v0 + 3; I[n++] = v0 + 1; I[n++] = v0 + 3; I[n++] = v0; } else { I[n++] = v0; I[n++] = v0 + 1; I[n++] = v0 + 2; I[n++] = v0; I[n++] = v0 + 2; I[n++] = v0 + 3; }
  O.I.n = n; O.v += 4;
}
const LIN = new Map(), s2l = c => (c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
export const lin = h => { let v = LIN.get(h); if (!v) { v = [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)]; LIN.set(h, v); } return v; };

// greedy mesher: faces merge only with same colour AND same 4-corner AO, so flat walls collapse to a few quads
export const HOOKS = { wall: null, thing: null };   // walls pass: walls/index.js paints bare wall skin (and the far tier's colour) just before meshing, and tags a few stamped things
export function meshVol(V, bank) {
  if (V.own && REG.blk) REG.clip(V);   // pass 1d: a building volume never draws inside a neighbour's mass
  if (REG.blk?.holes && bank === REG.blk.bank && !V.keepHoles) REG.carve(V);   // (subway stations agent) an open stair entrance's column stays open: transit.js
  let tap = null;   // fidelity pass: the voxels the wall paint sets are detail for the mid tier (the paint itself is untouched)
  if (HOOKS.wall && REG.blk) { if (bank.mid && LOD.detail === true) { const T = tap = [], set0 = Vol.prototype.set; V.set = function (x, y, z, c, l) { set0.call(this, x, y, z, c, l); x = Math.round(x); y = Math.round(y); z = Math.round(z); if (c !== undefined && c !== null && c >= 0 && this.in(x, y, z)) T.push(x + z * this.nx + y * this.sxz); }; }
    try { HOOKS.wall(V, bank); } finally { if (tap) V.set = Vol.prototype.set; } }   // walls pass: ads, murals and graffiti on bare walls (walls/index.js)
  if (REG.strict && REG.blk) REG.backText(V);   // pass 2: a kit's text always sits on a board
  if (bank.mid && bigEnough(V, 1.3, 2.5)) meshMid(V, bank.mid, tap);   // fidelity pass: lettering, lines and wall paint survive the mid tier (midOf)
  if (bank.far && bigEnough(V, 6, 6)) meshVolRaw(downVol(V, 5, 30), bank.far, .3);   // cleanup pass: its walls lean 30% toward the haze, like every far tier (far.js)
  if (REG.blk) { if (bank === REG.blk.bank) REG.vol(V, bank); else { bank.kind ??= 'structure'; if (REG.audit) (bank.vols ??= []).push(V); } }   // pass 1d: structures (ids + audit)
  return bank.farOnly ? bank : meshVolRaw(V, bank);   // cleanup pass: a far-only bank keeps only its far companion
}
// air: aerial perspective for far tiers — side faces of unlit layers lean that fraction toward the horizon colour (tops keep their colour)
const airHex = (c, t) => { const h = PAL.horizon, m = k => Math.round(((c >> k) & 255) * (1 - t) + ((h >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
function meshVolRaw(V, bank, air = 0) {
  const { nx, ny, nz, d, pal, lay, sxz } = V, dims = [nx, ny, nz], str = [1, sxz, nx], s = V.s, [ox, oy, oz] = V.org;
  const out = V.outside, skip = V.skip;   // fidelity pass: a mid-tier patch sees the coarse cells round it (outside) and draws no face for cells it only borrows (skip)
  const solid = (x, y, z) => (x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz) ? d[x + z * nx + y * sxz] !== 0 : out ? out(x, y, z) : (V.ground && y < 0);
  const p = [0, 0, 0], rgbs = pal.map(h => lin(h)), side = air ? pal.map((h, k) => lay[k] === 3 ? rgbs[k] : lin(airHex(h, air))) : rgbs, xs = [0, 0, 0, 0], ys = [0, 0, 0, 0], zs = [0, 0, 0, 0], A = [0, 0, 0, 0], AA = [0, 0, 0, 0];
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3, w = (a + 2) % 3, swap = str[w] < str[u], ia = swap ? w : u, oa = swap ? u : w;    // inner loop runs along the smaller stride (cache-friendly)
    const ni = dims[ia], no = dims[oa], sa = str[a], si = str[ia], so = str[oa], mask = new Int32Array(ni * no);
    const L = (nb, uu, ww) => { p[a] = nb; p[u] = uu; p[w] = ww; return solid(p[0], p[1], p[2]) ? 1 : 0; };
    for (let sl = 0; sl <= dims[a]; sl++) for (let sg = 1; sg >= -1; sg -= 2) {
      const own = sg > 0 ? sl - 1 : sl, nb = sg > 0 ? sl : sl - 1; if (own < 0 || own >= dims[a]) continue;
      let any = false, n = 0; const inside = nb >= 0 && nb < dims[a], base = own * sa, nbase = nb * sa;
      for (let j = 0; j < no; j++) { const rj = base + j * so, nrj = nbase + j * so;
        for (let i = 0; i < ni; i++, n++) {
          const c = d[rj + i * si]; if (c === 0 || (skip && skip[rj + i * si])) { mask[n] = 0; continue; }
          const U = swap ? j : i, Wc = swap ? i : j;
          if (inside ? d[nrj + i * si] !== 0 : L(nb, U, Wc)) { mask[n] = 0; continue; }
          const um = L(nb, U - 1, Wc), up = L(nb, U + 1, Wc), wm = L(nb, U, Wc - 1), wp = L(nb, U, Wc + 1);
          const a0 = (um && wm) ? 0 : 3 - (um + wm + L(nb, U - 1, Wc - 1)), a1 = (up && wm) ? 0 : 3 - (up + wm + L(nb, U + 1, Wc - 1));
          const a2 = (up && wp) ? 0 : 3 - (up + wp + L(nb, U + 1, Wc + 1)), a3 = (um && wp) ? 0 : 3 - (um + wp + L(nb, U - 1, Wc + 1));
          mask[n] = (c << 8) | (a0 << 6) | (a1 << 4) | (a2 << 2) | a3; any = true;
        } }
      if (!any) continue;
      n = 0;
      for (let j = 0; j < no; j++) for (let i = 0; i < ni;) {
        const k = mask[n]; if (k === 0) { i++; n++; continue; }
        let wd = 1; while (i + wd < ni && mask[n + wd] === k) wd++;
        let h = 1; outer: for (; j + h < no; h++) { const r = n + h * ni; for (let t = 0; t < wd; t++) if (mask[r + t] !== k) break outer; }
        for (let hh = 0; hh < h; hh++) { const r = n + hh * ni; for (let t = 0; t < wd; t++) mask[r + t] = 0; }
        const c = k >> 8; A[0] = (k >> 6) & 3; A[1] = (k >> 4) & 3; A[2] = (k >> 2) & 3; A[3] = k & 3;
        const u0 = swap ? j : i, u1 = swap ? j + h : i + wd, w0 = swap ? i : j, w1 = swap ? i + wd : j + h;
        const cu = [u0, u1, u1, u0], cw = [w0, w0, w1, w1], ord = sg > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
        for (let q = 0; q < 4; q++) { const o = ord[q]; p[a] = sl; p[u] = cu[o]; p[w] = cw[o]; xs[q] = ox + p[0] * s; ys[q] = oy + p[1] * s; zs[q] = oz + p[2] * s; AA[q] = A[o]; }
        quad(bank.L[lay[c]], xs, ys, zs, a === 0 ? sg : 0, a === 1 ? sg : 0, a === 2 ? sg : 0, a === 1 ? rgbs[c] : side[c], AA);
        i += wd; n += wd;
      }
    }
  }
  return bank;
}
export function meshed(V) { const b = meshVol(V, new Bank()); b.vols = undefined; if (b.kind === 'structure') b.kind = undefined; b.vol = V; return b; }   // a prop template keeps its voxels (pass 1d audit)
// stamp a bank into another: rotate about y by quarter turns, then translate (props authored once, placed many times)
// cleanup pass · a template's mid and far meshes are made on first use from its own voxels. They used to exist only when the template
// happened to be created during an LOD build, so a block's mid and far tiers depended on which block built a shared template first.
function lodPart(src, k) { let m = src[k]; if (m === undefined && src.vol) { const V = src.vol, b = new Bank(true);
  if (k === 'mid' ? bigEnough(V, 1.3, 2.5) : bigEnough(V, 6, 6)) { if (k === 'mid') meshMid(V, b); else meshVolRaw(downVol(V, 5, 30), b, .3); } m = src[k] = b; } return m; }
export function stamp(src, dst, rotQ, tx, ty, tz) {
  if (HOOKS.thing && REG.blk && !dst.farOnly) src = HOOKS.thing(src, rotQ, tx, ty, tz) || src;   // walls pass: a tagged copy of a tank or a dumpster, now and then
  if (REG.blk && dst === REG.blk.bank) { const p = REG.place(src, dst, rotQ, tx, ty, tz, 'q'); if (!p) return; ({ src, rot: rotQ, tx, ty, tz } = p); }   // pass 1d: ids + overrides
  if (dst.mid) { const m = src.big ? src : lodPart(src, 'mid'); if (m && m.L) stampRaw(m, dst.mid, rotQ, tx, ty, tz); }
  if (dst.far) { const m = lodPart(src, 'far') || (src.big ? (lodPart(src, 'mid') || src) : null); if (m && m.L) stampRaw(m, dst.far, rotQ, tx, ty, tz); }
  if (!dst.farOnly) stampRaw(src, dst, rotQ, tx, ty, tz);   // cleanup pass: a far-only bank takes only the far part
}
function stampRaw(src, dst, rotQ, tx, ty, tz) {
  const c = [1, 0, -1, 0][rotQ & 3], s = [0, 1, 0, -1][rotQ & 3];
  src.L.forEach((O, li) => { if (!O.v) return; const D = dst.L[li], base = D.v, P = O.P.a, N = O.N.a, C = O.C.a;
    D.P.need(O.P.n); D.N.need(O.N.n); D.C.need(O.C.n); D.I.need(O.I.n);
    for (let k = 0; k < O.P.n; k += 3) { const x = P[k], z = P[k + 2], nx = N[k], nz = N[k + 2];
      D.P.a[D.P.n++] = x * c + z * s + tx; D.P.a[D.P.n++] = P[k + 1] + ty; D.P.a[D.P.n++] = -x * s + z * c + tz;
      D.N.a[D.N.n++] = nx * c + nz * s; D.N.a[D.N.n++] = N[k + 1]; D.N.a[D.N.n++] = -nx * s + nz * c;
      D.C.a[D.C.n++] = C[k]; D.C.a[D.C.n++] = C[k + 1]; D.C.a[D.C.n++] = C[k + 2]; }
    for (let k = 0; k < O.I.n; k++) D.I.a[D.I.n++] = O.I.a[k] + base; D.v += O.v; });
}
// flat-shaded box straight into a bank (no voxels) — for plain masses, far skyline, slabs
export function boxInto(dst, li, x0, y0, z0, x1, y1, z1, hex, sides = 63, ao = 3) {
  const rgb = lin(hex), O = dst.L[li], A = [ao, ao, ao, ao];
  const F = [[1, 0, 0, [x1, x1, x1, x1], [y0, y0, y1, y1], [z1, z0, z0, z1]], [-1, 0, 0, [x0, x0, x0, x0], [y0, y0, y1, y1], [z0, z1, z1, z0]], [0, 1, 0, [x0, x1, x1, x0], [y1, y1, y1, y1], [z1, z1, z0, z0]],
    [0, -1, 0, [x0, x1, x1, x0], [y0, y0, y0, y0], [z0, z0, z1, z1]], [0, 0, 1, [x0, x1, x1, x0], [y0, y0, y1, y1], [z1, z1, z1, z1]], [0, 0, -1, [x1, x0, x0, x1], [y0, y0, y1, y1], [z0, z0, z0, z0]]];
  F.forEach((f, k) => { if (sides & (1 << k)) quad(O, f[3], f[4], f[5], f[0], f[1], f[2], rgb, A); });
}
// ───────── 5×7 pixel font (rows top→bottom; proportional widths)
const G = {
  A: ['.XXX.','X...X','X...X','XXXXX','X...X','X...X','X...X'], B: ['XXXX.','X...X','X...X','XXXX.','X...X','X...X','XXXX.'], C: ['.XXX.','X...X','X....','X....','X....','X...X','.XXX.'],
  D: ['XXXX.','X...X','X...X','X...X','X...X','X...X','XXXX.'], E: ['XXXXX','X....','X....','XXXX.','X....','X....','XXXXX'], F: ['XXXXX','X....','X....','XXXX.','X....','X....','X....'],
  G: ['.XXX.','X...X','X....','X.XXX','X...X','X...X','.XXXX'], H: ['X...X','X...X','X...X','XXXXX','X...X','X...X','X...X'], I: ['XXX','.X.','.X.','.X.','.X.','.X.','XXX'],
  J: ['..XXX','...X.','...X.','...X.','...X.','X..X.','.XX..'], K: ['X...X','X..X.','X.X..','XX...','X.X..','X..X.','X...X'], L: ['X....','X....','X....','X....','X....','X....','XXXXX'],
  M: ['X...X','XX.XX','X.X.X','X.X.X','X...X','X...X','X...X'], N: ['X...X','X...X','XX..X','X.X.X','X..XX','X...X','X...X'], O: ['.XXX.','X...X','X...X','X...X','X...X','X...X','.XXX.'],
  P: ['XXXX.','X...X','X...X','XXXX.','X....','X....','X....'], Q: ['.XXX.','X...X','X...X','X...X','X.X.X','X..X.','.XX.X'], R: ['XXXX.','X...X','X...X','XXXX.','X.X..','X..X.','X...X'],
  S: ['.XXXX','X....','X....','.XXX.','....X','....X','XXXX.'], T: ['XXXXX','..X..','..X..','..X..','..X..','..X..','..X..'], U: ['X...X','X...X','X...X','X...X','X...X','X...X','.XXX.'],
  V: ['X...X','X...X','X...X','X...X','X...X','.X.X.','..X..'], W: ['X...X','X...X','X...X','X.X.X','X.X.X','X.X.X','.X.X.'], X: ['X...X','X...X','.X.X.','..X..','.X.X.','X...X','X...X'],
  Y: ['X...X','X...X','.X.X.','..X..','..X..','..X..','..X..'], Z: ['XXXXX','....X','...X.','..X..','.X...','X....','XXXXX'],
  0: ['.XXX.','X...X','X..XX','X.X.X','XX..X','X...X','.XXX.'], 1: ['.X.','XX.','.X.','.X.','.X.','.X.','XXX'], 2: ['.XXX.','X...X','....X','...X.','..X..','.X...','XXXXX'],
  3: ['XXXXX','...X.','..X..','...X.','....X','X...X','.XXX.'], 4: ['...X.','..XX.','.X.X.','X..X.','XXXXX','...X.','...X.'], 5: ['XXXXX','X....','XXXX.','....X','....X','X...X','.XXX.'],
  6: ['..XX.','.X...','X....','XXXX.','X...X','X...X','.XXX.'], 7: ['XXXXX','....X','...X.','..X..','.X...','.X...','.X...'], 8: ['.XXX.','X...X','X...X','.XXX.','X...X','X...X','.XXX.'],
  9: ['.XXX.','X...X','X...X','.XXXX','....X','...X.','.XX..'],
  '.': ['..','..','..','..','..','XX','XX'], '-': ['...','...','...','XXX','...','...','...'], '·': ['..','..','XX','XX','..','..','..'], ':': ['..','XX','XX','..','XX','XX','..'],
  '!': ['X','X','X','X','X','.','X'], "'": ['X','X','.','.','.','.','.'], ' ': ['...','...','...','...','...','...','...'], '/': ['....X','....X','...X.','..X..','.X...','X....','X....'],
  '&': ['.XX..','X..X.','X.X..','.X...','X.X.X','X..X.','.XX.X'], '$': ['..X..','.XXXX','X.X..','.XXX.','..X.X','XXXX.','..X..'], '?': ['.XXX.','X...X','....X','...X.','..X..','.....','..X..'],
  '#': ['.X.X.','.X.X.','XXXXX','.X.X.','XXXXX','.X.X.','.X.X.'], '%': ['XX...','XX..X','...X.','..X..','.X...','X..XX','...XX'], '¢': ['..X..','.XXX.','X.X..','X.X..','X.X..','.XXX.','..X..'],
  '+': ['.....','..X..','..X..','XXXXX','..X..','..X..','.....'], '*': ['.....','X.X.X','.XXX.','XXXXX','.XXX.','X.X.X','.....'], '@': ['.XXX.','X...X','X.XXX','X.X.X','X.XXX','X....','.XXXX'],
};
const glyph = ch => G[ch] ?? G['?'];
export function textMask(str, gap = 1) {
  const gs = [...str.toUpperCase()].map(glyph), w = gs.reduce((s, g) => s + g[0].length + gap, -gap), M = [];
  for (let r = 0; r < 7; r++) { let row = ''; gs.forEach((g, k) => { row += g[r] + (k < gs.length - 1 ? '.'.repeat(gap) : ''); }); M.push(row); }
  return { w, h: 7, at: (i, j) => M[j][i] === 'X', s: str };
}
// cleanup pass: the canvases are CPU-backed (willReadFrequently): a GPU canvas made every getImageData a GPU readback, ~9× slower in the
// build workers (display-face signage rasters hundreds of masks per block), and one measuring context is reused
let MC = null;
export function rasterMask(str, font, thr = 120, o = {}) {
  const mk = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }), CPU = { willReadFrequently: true };
  MC ??= mk(8, 8).getContext('2d', CPU); MC.font = font; const m = MC.measureText(str);
  const W = Math.ceil(m.width) + 8, H = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 8, c = mk(W, H), g = c.getContext('2d', CPU);
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.fillText(str, 4, 4 + m.actualBoundingBoxAscent);
  const D = g.getImageData(0, 0, W, H).data; let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[(y * W + x) * 4 + 3] > thr) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const M = { w: x1 - x0 + 1, h: y1 - y0 + 1, at: (i, j) => D[((j + y0) * W + (i + x0)) * 4 + 3] > thr, s: str };
  if (!o.even || x1 < 0) return M;
  // hardening pass · EVEN LETTER SPACING (o.even): a small display face rasters every glyph at a fractional x, so after the threshold its
  // gaps run 0–4 px and some glyphs touch (the foundry's "ST. ELM O IR ON F OUN DRY"). The same face and size, every glyph drawn on the
  // same baseline 6 px clear of the last, then set again one gap apart (2 px where that is no wider than the plain raster, else 1 px:
  // ~7 % wider, since touching glyphs come apart; a caller fitting a width gives it that room, or the fit drops a size); a word space
  // keeps the plain raster's own width. (An earlier glyph-by-glyph attempt came out smaller and broken and was reverted.)
  const cs = [...str], ms = cs.map(ch => MC.measureText(ch)), sp = cs.map(ch => ch.trim() === ''), W2 = 8 + ms.reduce((t, q) => t + Math.ceil(q.actualBoundingBoxLeft + q.actualBoundingBoxRight) + 8, 0);
  const c2 = mk(W2, H), g2 = c2.getContext('2d', CPU); g2.font = font; g2.fillStyle = '#fff'; g2.textBaseline = 'alphabetic'; let pen = 4; const runs = [];
  cs.forEach((ch, k) => { if (sp[k]) { runs.push(null); return; } const q = ms[k], wi = Math.ceil(q.actualBoundingBoxLeft + q.actualBoundingBoxRight); g2.fillText(ch, pen + q.actualBoundingBoxLeft, 4 + m.actualBoundingBoxAscent); runs.push([pen - 1, pen + wi + 1]); pen += wi + 8; });
  const D2 = g2.getImageData(0, 0, W2, H).data, on = (x, y) => D2[(y * W2 + x) * 4 + 3] > thr;
  const glyphs = []; for (const r of runs) { if (!r) { if (glyphs.length) glyphs[glyphs.length - 1].space = true; continue; }   // each glyph's own ink columns
    let a = -1, b = -1; for (let x = Math.max(0, r[0]); x <= Math.min(W2 - 1, r[1]); x++) for (let y = y0; y <= y1; y++) if (on(x, y)) { if (a < 0) a = x; b = x; break; }
    if (a >= 0) glyphs.push({ a, b, space: false }); }
  if (glyphs.length < 2) return M;
  const gaps = []; for (let i = 0, run = -1; i < M.w; i++) { let ink = false; for (let j = 0; j < M.h; j++) if (M.at(i, j)) { ink = true; break; } if (ink) { if (run >= 0 && i - run > 1) gaps.push(i - run - 1); run = i; } }
  const nw = glyphs.filter(q => q.space).length, word = nw ? Math.round(gaps.sort((p, q) => q - p).slice(0, nw).reduce((t, d) => t + d, 0) / nw) : 0;   // (the plain raster's widest gaps are its word spaces)
  for (const gap of [2, 1]) { const map = new Int32Array(W2).fill(-1); let x = 0;
    glyphs.forEach((q, k) => { for (let i = q.a; i <= q.b; i++) map[x + i - q.a] = i; x += q.b - q.a + 1 + (k < glyphs.length - 1 ? (q.space ? Math.max(word, 3 * gap) : gap) : 0); });
    if (x <= M.w || gap === 1) return { w: x, h: M.h, at: (i, j) => map[i] >= 0 && on(map[i], j + y0), s: str }; }
}

// worker transfer: a bank as plain typed arrays (trimmed) and back
export function pack(bank) { return bank.L.map(O => ({ v: O.v, P: O.P.a.slice(0, O.P.n), N: O.N.a.slice(0, O.N.n), C: O.C.a.slice(0, O.C.n), I: O.I.a.slice(0, O.I.n) })); }
export function unpackInto(packed, dst) { packed.forEach((O, li) => { if (!O.v) return; const D = dst.L[li], base = D.v; D.P.need(O.P.length); D.N.need(O.N.length); D.C.need(O.C.length); D.I.need(O.I.length);
  D.P.a.set(O.P, D.P.n); D.P.n += O.P.length; D.N.a.set(O.N, D.N.n); D.N.n += O.N.length; D.C.a.set(O.C, D.C.n); D.C.n += O.C.length;
  for (let k = 0; k < O.I.length; k++) D.I.a[D.I.n++] = O.I[k] + base; D.v += O.v; }); }
// stamp at any yaw angle (radians; same convention as stamp's quarter turns: local +z → (sin a, cos a)) — for signs set on a diagonal
export function stampA(src, dst, ang, tx, ty, tz) {
  if (REG.blk && dst === REG.blk.bank) { const p = REG.place(src, dst, ang, tx, ty, tz, 'a'); if (!p) return; ({ src, rot: ang, tx, ty, tz } = p); }
  if (dst.mid) { const m = src.big ? src : lodPart(src, 'mid'); if (m && m.L) stampARaw(m, dst.mid, ang, tx, ty, tz); }
  if (dst.far) { const m = lodPart(src, 'far') || (src.big ? (lodPart(src, 'mid') || src) : null); if (m && m.L) stampARaw(m, dst.far, ang, tx, ty, tz); }
  if (!dst.farOnly) stampARaw(src, dst, ang, tx, ty, tz);
}
function stampARaw(src, dst, ang, tx, ty, tz) {
  const c = Math.cos(ang), s = Math.sin(ang);
  src.L.forEach((O, li) => { if (!O.v) return; const D = dst.L[li], base = D.v, P = O.P.a, N = O.N.a, C = O.C.a;
    D.P.need(O.P.n); D.N.need(O.N.n); D.C.need(O.C.n); D.I.need(O.I.n);
    for (let k = 0; k < O.P.n; k += 3) { const x = P[k], z = P[k + 2], nx = N[k], nz = N[k + 2];
      D.P.a[D.P.n++] = x * c + z * s + tx; D.P.a[D.P.n++] = P[k + 1] + ty; D.P.a[D.P.n++] = -x * s + z * c + tz;
      D.N.a[D.N.n++] = Math.round(nx * c + nz * s); D.N.a[D.N.n++] = N[k + 1]; D.N.a[D.N.n++] = Math.round(-nx * s + nz * c);
      D.C.a[D.C.n++] = C[k]; D.C.a[D.C.n++] = C[k + 1]; D.C.a[D.C.n++] = C[k + 2]; }
    for (let k = 0; k < O.I.n; k++) D.I.a[D.I.n++] = O.I.a[k] + base; D.v += O.v; });
}

// stamp through a full affine matrix (column-major 4×4, THREE.Matrix4.elements order); normals use the rotation part, renormalised
export function stampM(src, dst, e) {
  src.L.forEach((O, li) => { if (!O.v) return; const D = dst.L[li], base = D.v, P = O.P.a, N = O.N.a, C = O.C.a;
    D.P.need(O.P.n); D.N.need(O.N.n); D.C.need(O.C.n); D.I.need(O.I.n);
    for (let k = 0; k < O.P.n; k += 3) { const x = P[k], y = P[k + 1], z = P[k + 2], nx = N[k], ny = N[k + 1], nz = N[k + 2];
      D.P.a[D.P.n++] = e[0] * x + e[4] * y + e[8] * z + e[12]; D.P.a[D.P.n++] = e[1] * x + e[5] * y + e[9] * z + e[13]; D.P.a[D.P.n++] = e[2] * x + e[6] * y + e[10] * z + e[14];
      let mx = e[0] * nx + e[4] * ny + e[8] * nz, my = e[1] * nx + e[5] * ny + e[9] * nz, mz = e[2] * nx + e[6] * ny + e[10] * nz; const l = Math.hypot(mx, my, mz) || 1;
      D.N.a[D.N.n++] = Math.round(mx / l * 127); D.N.a[D.N.n++] = Math.round(my / l * 127); D.N.a[D.N.n++] = Math.round(mz / l * 127);
      D.C.a[D.C.n++] = C[k]; D.C.a[D.C.n++] = C[k + 1]; D.C.a[D.C.n++] = C[k + 2]; }
    for (let k = 0; k < O.I.n; k++) D.I.a[D.I.n++] = O.I.a[k] + base; D.v += O.v; });
}
