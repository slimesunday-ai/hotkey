// CAMERA BUILD (2026-10-05) · THE COLLISION WORLD'S BUILDER (RESEARCH.md §4.2), run in a module worker by camera/world.js; the same
// buildColumns() also runs on the main thread for a block's small far massing (the fallback while its full tier is still building).
// Input: a block's tier mesh parts (lod.js: P Int16 ×3 in cm relative to o, N Int8 ×3, 4 vertices a quad). Output: COLUMN INTERVALS
// on a 0.25 m grid (32 m block → 128 × 128 columns): per column the exact solid spans [lo, hi] along y, no unioning.
//   - only HORIZONTAL quads count: an up-facing quad at y starts solid below it, a down-facing one ends it (the voxel meshes are closed,
//     and a face culled against the ground or a neighbour correctly extends the solid down). Ground faces (y ≤ .05) are skipped.
//   - a quad stamps every column it overlaps at all (conservative: a 0.1 m post still takes a column), with the exact FRACTION of the column it
//     covers; the top-down sweep keeps the covered fraction (ups first at a height, then downs, never below 0), so an overhang whose
//     bottom covers half a column doesn't open the half under it that a wall still fills. Gaps under 0.1 m are merged.
//   - THIN, per HEIGHT (camera build 2c): per 0.25 m height slab up to thinTop, the columns solid in that slab flood-filled 8-connected;
//     a component whose footprint fits 3 × 3 columns (≤ 0.6 m of geometry plus the conservative stamp) is a post, pole, mast or trunk AT
//     THAT HEIGHT. Spans are split at the slab lines where that changes and each span carries its own flag (ivf), so only the slender
//     part of a column is thin: a sign box, a signal head or a lamp head on a pole is wider at its height, and the pole's spans there
//     are SOLID — every query sees them, the camera never enters them. (The old rule tested the band 0.8–2.4 m once and flagged the
//     whole column, so a sign at camera height on a thin pole was invisible to STATIC_WIDE.) Above thinTop everything is solid.
// Layout (CSR): off Uint32Array(G² + 1) → iv Float32Array of [lo, hi] pairs ascending; ivf Uint8Array, one flag per span (THIN); top
// Float32Array(G²) highest solid top (0 if none); flags Uint8Array(G²) (THIN: some span of the column is thin).
export const THIN = 1;
export function buildColumns({ x0, z0, size = 32, col = .25, parts, thinMax = .6, band = [.8, 2.4], merge = .1, ground = .05, slab = .25, thinTop = 8 }) {
  const t0 = performance.now(), G = Math.round(size / col), NC = G * G, inv = 1 / col;
  let nq = 0; for (const t of parts) if (t && t.n) nq += t.n >> 2;
  const Q = new Float32Array(nq * 6); let hq = 0;   // horizontal quads: [lx0, lx1, lz0, lz1 (block-local m), y, ±1]
  for (const t of parts) { if (!t || !t.n) continue; const p = t.P, nn = t.N, o = t.o, ox = o[0] - x0, oy = o[1], oz = o[2] - z0;
    for (let q = 0; q < t.n; q += 4) { const v = q * 3, ny = nn[v + 1]; if (Math.abs(ny) <= Math.abs(nn[v]) || Math.abs(ny) <= Math.abs(nn[v + 2])) continue;
      const y = p[v + 1] * .01 + oy; if (y <= ground) continue;
      let ax = 1e9, bx = -1e9, az = 1e9, bz = -1e9, ylo = 1e9, yhi = -1e9;
      for (let k = v, e = v + 12; k < e; k += 3) { const x = p[k], z = p[k + 2], yy = p[k + 1]; if (x < ax) ax = x; if (x > bx) bx = x; if (z < az) az = z; if (z > bz) bz = z; if (yy < ylo) ylo = yy; if (yy > yhi) yhi = yy; }
      if (yhi - ylo > 1) continue;   // (not flat: no voxel mesh has these, but never trust a sloped quad as a floor)
      const b = hq * 6; Q[b] = ax * .01 + ox; Q[b + 1] = bx * .01 + ox; Q[b + 2] = az * .01 + oz; Q[b + 3] = bz * .01 + oz; Q[b + 4] = y; Q[b + 5] = ny > 0 ? 1 : -1;
      if (Q[b + 1] <= 0 || Q[b] >= size || Q[b + 3] <= 0 || Q[b + 2] >= size || Q[b + 1] - Q[b] < .005 || Q[b + 3] - Q[b + 2] < .005) continue; hq++; } }
  // column range a quad stamps (overlap > 5 mm), clipped to the block
  const r0 = a => Math.max(0, Math.floor(a * inv + 1e-4)), r1 = b => Math.min(G - 1, Math.ceil(b * inv - 1e-4) - 1);
  const cnt = new Uint32Array(NC + 1);
  for (let k = 0; k < hq; k++) { const b = k * 6, i0 = r0(Q[b]), i1 = r1(Q[b + 1]), j0 = r0(Q[b + 2]), j1 = r1(Q[b + 3]);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cnt[j * G + i + 1]++; }
  for (let c = 0; c < NC; c++) cnt[c + 1] += cnt[c];
  const ne = cnt[NC], EY = new Float32Array(ne), EA = new Float32Array(ne), fill = cnt.slice(0, NC), ca = col * col;
  for (let k = 0; k < hq; k++) { const b = k * 6, qx0 = Q[b], qx1 = Q[b + 1], qz0 = Q[b + 2], qz1 = Q[b + 3], y = Q[b + 4], s = Q[b + 5], i0 = r0(qx0), i1 = r1(qx1), j0 = r0(qz0), j1 = r1(qz1);
    for (let j = j0; j <= j1; j++) { const wz = Math.min(qz1, (j + 1) * col) - Math.max(qz0, j * col);
      for (let i = i0; i <= i1; i++) { const wx = Math.min(qx1, (i + 1) * col) - Math.max(qx0, i * col), c = j * G + i, e = fill[c]++; EY[e] = y; EA[e] = s * wx * wz / ca; } } }
  // per column: sort by height (top down; ups before downs at a height), sweep the covered fraction, emit [lo, hi] spans
  const off = new Uint32Array(NC + 1), top = new Float32Array(NC), flags = new Uint8Array(NC); let iv = new Float32Array(Math.max(64, ne)), ni = 0;
  const tmp = []; const EPS = 1e-4;
  for (let c = 0; c < NC; c++) { off[c] = ni; const a = cnt[c], z = cnt[c + 1]; if (a === z) continue;
    for (let e = a + 1; e < z; e++) { const y = EY[e], s = EA[e]; let f = e - 1;   // insertion sort: few events a column
      while (f >= a && (EY[f] < y - 1e-4 || (Math.abs(EY[f] - y) <= 1e-4 && EA[f] < 0 && s > 0))) { EY[f + 1] = EY[f]; EA[f + 1] = EA[f]; f--; }
      EY[f + 1] = y; EA[f + 1] = s; }
    tmp.length = 0; let cov = 0, hi = 0, e = a;
    while (e < z) { const y = EY[e]; let up = 0, dn = 0; while (e < z && Math.abs(EY[e] - y) <= 1e-4) { if (EA[e] > 0) up += EA[e]; else dn -= EA[e]; e++; }
      const was = cov > EPS; cov = Math.max(0, cov + up - dn); const now = cov > EPS;
      if (!was && now) hi = y; else if (was && !now) tmp.push(y, hi); }
    if (cov > EPS) tmp.push(Math.min(0, EY[z - 1]), hi);
    // tmp holds [lo, hi] top-down: merge small gaps, write ascending
    const m = []; for (let k = 0; k < tmp.length; k += 2) { const lo = tmp[k], h = tmp[k + 1]; if (m.length && m[m.length - 2] - h < merge) m[m.length - 2] = Math.min(m[m.length - 2], lo); else m.push(lo, h); }
    if (ni + m.length > iv.length) { const g = new Float32Array(Math.max(iv.length * 2, ni + m.length)); g.set(iv); iv = g; }
    for (let k = m.length - 2; k >= 0; k -= 2) { iv[ni++] = m[k]; iv[ni++] = m[k + 1]; }
    top[c] = Math.max(0, m[1]); }
  off[NC] = ni;
  // THIN per height slab (s: [s·slab, (s + 1)·slab), at most 32 slabs ≤ thinTop): occ[c] bit s = the column is solid in slab s; per slab,
  // the solid columns flood-filled 8-connected, a component within maxC × maxC columns thin there (thinM bit s)
  const maxC = Math.floor(thinMax / col + 1e-6) + 1, NS = thinMax > 0 ? Math.min(32, Math.ceil(thinTop / slab - 1e-6)) : 0;
  const thinM = new Uint32Array(NS ? NC : 0); let nThin = 0;
  if (NS) { const occ = new Uint32Array(NC), mark = new Int8Array(NC), stack = new Int32Array(NC), comp = new Int32Array(NC), yTop = NS * slab;
    for (let c = 0; c < NC; c++) { let m = 0; for (let k = off[c]; k < off[c + 1]; k += 2) { const lo = iv[k], hi = iv[k + 1]; if (lo >= yTop) break; if (hi <= 0) continue;
        const s0 = Math.max(0, Math.floor(lo / slab)), s1 = Math.min(NS - 1, Math.ceil(hi / slab) - 1); for (let q = s0; q <= s1; q++) m |= 1 << q; } occ[c] = m >>> 0; }
    for (let q = 0; q < NS; q++) { const bit = (1 << q) >>> 0; mark.fill(0);
      for (let c0 = 0; c0 < NC; c0++) { if (!(occ[c0] & bit) || mark[c0]) continue; let sp = 0, nc = 0, i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1; stack[sp++] = c0; mark[c0] = 1;
        while (sp) { const c = stack[--sp], i = c % G, j = (c - i) / G; comp[nc++] = c; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= G || jj >= G) continue; const cc = jj * G + ii; if ((occ[cc] & bit) && !mark[cc]) { mark[cc] = 1; stack[sp++] = cc; } } }
        if (i1 - i0 < maxC && j1 - j0 < maxC) { for (let k = 0; k < nc; k++) thinM[comp[k]] |= bit; if (q * slab >= band[0] && q * slab < band[1]) nThin++; } } } }
  // split each column's spans where the thin state changes (at slab lines), one flag a span
  let ivf;
  if (NS) { const yTop = NS * slab, o2 = new Uint32Array(NC + 1); let v2 = new Float32Array(ni + 64), f2 = new Uint8Array((ni >> 1) + 32), n2 = 0;
    const push = (lo, hi, t) => { if (n2 + 2 > v2.length) { const g = new Float32Array(v2.length * 2); g.set(v2); v2 = g; const h = new Uint8Array(f2.length * 2); h.set(f2); f2 = h; } v2[n2] = lo; v2[n2 + 1] = hi; f2[n2 >> 1] = t; n2 += 2; };
    for (let c = 0; c < NC; c++) { o2[c] = n2; const m = thinM[c];
      for (let k = off[c]; k < off[c + 1]; k += 2) { const lo = iv[k], hi = iv[k + 1];
        if (!m) { push(lo, hi, 0); continue; }
        const st = y => y < yTop && (m >>> Math.max(0, Math.floor(y / slab + 1e-6))) & 1 ? THIN : 0;
        let a = lo, t = st(lo); for (let q = Math.max(1, Math.floor(lo / slab) + 1); q * slab < hi && q <= NS; q++) { const t2 = st(q * slab); if (t2 !== t) { push(a, q * slab, t); a = q * slab; t = t2; } }
        push(a, hi, t); }
      for (let k = o2[c]; k < n2; k += 2) if (f2[k >> 1]) { flags[c] |= THIN; break; } }
    o2[NC] = n2; off.set(o2); iv = v2.slice(0, n2); ni = n2; ivf = f2.slice(0, n2 >> 1); }
  else ivf = new Uint8Array(ni >> 1);
  return { off, iv: iv.slice(0, ni), ivf, top, flags, G, col, quads: nq, hq, intervals: ni >> 1, thin: nThin, ms: performance.now() - t0 };
}

// the worker: a block arrives whole ({ parts }) or in chunks (begin · part … · end: the main thread copies ≤ ~30k quads a frame), and its
// columns go back transferred
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const jobs = new Map();
  const run = m => { try { const r = buildColumns(m); self.postMessage({ key: m.key, id: m.id, ...r }, [r.off.buffer, r.iv.buffer, r.ivf.buffer, r.top.buffer, r.flags.buffer]); }
    catch (err) { self.postMessage({ key: m.key, id: m.id, error: String(err?.stack || err) }); } };
  self.onmessage = e => { const m = e.data;
    if (m.type === 'begin') jobs.set(m.id, { ...m, parts: [] });
    else if (m.type === 'part') jobs.get(m.id)?.parts.push(m.part);
    else if (m.type === 'end') { const j = jobs.get(m.id); jobs.delete(m.id); if (j) run(j); }
    else run(m); };
}
