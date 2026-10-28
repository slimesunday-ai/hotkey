// MAINLAND WALK v1 (2026-10-06) · THE WALK GRID: what you stand on and what stops you, built once from the page's own meshes, so what
// you see is what you bump into (houses, fences, hedges, yard pieces, trees, lamps, the terminal, the arch, the porch sitters, the pier).
// Runs in a module worker (no imports); walk.js gathers the meshes and keeps the result. After camera/world.worker.js's column builder:
//   - only HORIZONTAL quads count (voxel meshes are closed): an up-facing quad starts solid below it, a down-facing one ends it; a column
//     still covered at the bottom is solid to y 0. Each quad stamps the 0.2 m columns it touches with the EXACT fraction it covers (a
//     rotated quad, a house on a pie lot, is clipped against the cell), and the top-down sweep keeps the covered fraction, so a column a
//     wall only half fills is solid. Gaps under 0.1 m merge.
//   - THE GROUND (the rasterised tiles, flat at y 0 for asphalt and 0.2 for curbs, walks and lawns) goes in its own byte raster: 0 = no
//     ground (the water, past the map), else the top in cm + 1. No ground and nothing to stand on is the shoreline: you can't step there.
// Result: { x0, z0, NX, NZ, cs, off (Uint32, CSR), iv (Float32 [lo, hi] ascending per column), ground (Uint8), quads, spans, ms }.
export const CS = .2;
export function buildWalk({ x0, z0, x1, z1, parts, soft = [], merge = .1, yMax = 30 }) {
  const t0 = performance.now(), NX = Math.ceil((x1 - x0) / CS), NZ = Math.ceil((z1 - z0) / CS), NC = NX * NZ, inv = 1 / CS, ca = CS * CS;
  // WALK-THROUGH DECOR (MAINLAND FIXES 2026-10-06): soft quads { q: [x, z ×4] (convex), h } — the flower beds, the hose, a sprinkler's head
  // (houses.js A.soft). A column whose centre is in one (or within half a column of it) drops the spans standing from the ground no
  // higher than h: you wade through the bed, a wall or a fence through the same column still stops you
  const softH = soft.length ? new Float32Array(NC) : null;
  for (const { q, h } of soft) { const xs = [q[0], q[2], q[4], q[6]], zs = [q[1], q[3], q[5], q[7]], cw = (q[2] - q[0]) * (q[5] - q[1]) - (q[3] - q[1]) * (q[4] - q[0]) > 0 ? 1 : -1;
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) * inv) - 1), i1 = Math.min(NX - 1, Math.ceil((Math.max(...xs) - x0) * inv) + 1), j0 = Math.max(0, Math.floor((Math.min(...zs) - z0) * inv) - 1), j1 = Math.min(NZ - 1, Math.ceil((Math.max(...zs) - z0) * inv) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = x0 + (i + .5) * CS, pz = z0 + (j + .5) * CS; let ok = true;
      for (let e = 0; e < 4 && ok; e++) { const ax = q[e * 2], az = q[e * 2 + 1], bx = q[(e * 2 + 2) % 8], bz = q[(e * 2 + 3) % 8], L = Math.hypot(bx - ax, bz - az) || 1; if (cw * ((bx - ax) * (pz - az) - (bz - az) * (px - ax)) / L < -CS / 2) ok = false; }
      if (ok) { const c = j * NX + i; if (h > softH[c]) softH[c] = h; } } }
  const ground = new Uint8Array(NC);
  let cap = 1 << 20, EC = new Uint32Array(cap), EY = new Float32Array(cap), EA = new Float32Array(cap), ne = 0, nq = 0;
  const push = (c, y, a) => { if (ne === cap) { cap *= 2; const c2 = new Uint32Array(cap), y2 = new Float32Array(cap), a2 = new Float32Array(cap); c2.set(EC); y2.set(EY); a2.set(EA); EC = c2; EY = y2; EA = a2; } EC[ne] = c; EY[ne] = y; EA[ne] = a; ne++; };
  // the area of a convex quad clipped to the cell [cx0, cx1] × [cz0, cz1] (Sutherland–Hodgman, then the shoelace)
  let A = new Float64Array(32), B = new Float64Array(32);
  function clipArea(qx, qz, cx0, cz0, cx1, cz1) {
    let n = 4; for (let k = 0; k < 4; k++) { A[k * 2] = qx[k]; A[k * 2 + 1] = qz[k]; }
    for (let e = 0; e < 4 && n; e++) { let m = 0; const ax = e === 0, sg = e < 2 ? 1 : -1, lim = e === 0 ? cx0 : e === 1 ? cz0 : e === 2 ? cx1 : cz1, axis = e === 0 || e === 2 ? 0 : 1;
      const inside = k => sg * (A[k * 2 + axis] - lim) >= 0;
      for (let k = 0; k < n; k++) { const j = (k + 1) % n, ik = inside(k), ij = inside(j);
        if (ik) { B[m * 2] = A[k * 2]; B[m * 2 + 1] = A[k * 2 + 1]; m++; }
        if (ik !== ij) { const pa = A[k * 2 + axis], pb = A[j * 2 + axis], t = (lim - pa) / (pb - pa), o = 1 - axis; B[m * 2 + axis] = lim; B[m * 2 + o] = A[k * 2 + o] + t * (A[j * 2 + o] - A[k * 2 + o]); m++; } }
      const T = A; A = B; B = T; n = m; void ax; }
    let s = 0; for (let k = 0; k < n; k++) { const j = (k + 1) % n; s += A[k * 2] * A[j * 2 + 1] - A[j * 2] * A[k * 2 + 1]; } return Math.abs(s) / 2; }
  const qx = [0, 0, 0, 0], qz = [0, 0, 0, 0];
  for (const t of parts) { const P = t.P, N = t.N, nv = P.length / 3;
    for (let q = 0; q + 3 < nv; q += 4) { const v = q * 3, ny = N[v + 1]; if (Math.abs(ny) <= Math.abs(N[v]) || Math.abs(ny) <= Math.abs(N[v + 2])) continue;
      let ax = 1e9, bx = -1e9, az = 1e9, bz = -1e9, ylo = 1e9, yhi = -1e9;
      for (let k = 0; k < 4; k++) { const x = P[v + k * 3], y = P[v + k * 3 + 1], z = P[v + k * 3 + 2]; qx[k] = x; qz[k] = z; if (x < ax) ax = x; if (x > bx) bx = x; if (z < az) az = z; if (z > bz) bz = z; if (y < ylo) ylo = y; if (y > yhi) yhi = y; }
      if (yhi - ylo > .02 || ylo > yMax || ylo < -3 || bx <= x0 || ax >= x1 || bz <= z0 || az >= z1) continue;
      let area = 0; for (let k = 0; k < 4; k++) { const j = (k + 1) & 3; area += qx[k] * qz[j] - qx[j] * qz[k]; } area = Math.abs(area) / 2; if (area < 1e-6) continue;
      const y = (ylo + yhi) / 2, aa = Math.abs((bx - ax) * (bz - az) - area) < 1e-4 * Math.max(1, area); nq++;
      if (t.ground) {   // the ground raster: every cell the quad overlaps takes the higher top (a cell half curb, half asphalt is curb)
        if (ny < 0) continue; const code = Math.max(1, Math.min(255, Math.round(y * 100) + 1));
        const i0 = Math.max(0, Math.floor((ax - x0) * inv + 1e-4)), i1 = Math.min(NX - 1, Math.ceil((bx - x0) * inv - 1e-4) - 1), j0 = Math.max(0, Math.floor((az - z0) * inv + 1e-4)), j1 = Math.min(NZ - 1, Math.ceil((bz - z0) * inv - 1e-4) - 1);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * NX + i; if (code > ground[c]) ground[c] = code; }
        continue; }
      const i0 = Math.max(0, Math.floor((ax - x0) * inv + 1e-4)), i1 = Math.min(NX - 1, Math.ceil((bx - x0) * inv - 1e-4) - 1), j0 = Math.max(0, Math.floor((az - z0) * inv + 1e-4)), j1 = Math.min(NZ - 1, Math.ceil((bz - z0) * inv - 1e-4) - 1);
      const s = ny > 0 ? 1 : -1;
      for (let j = j0; j <= j1; j++) { const cz0 = z0 + j * CS, cz1 = cz0 + CS, wz = Math.min(bz, cz1) - Math.max(az, cz0);
        for (let i = i0; i <= i1; i++) { const cx0 = x0 + i * CS, cx1 = cx0 + CS, f = aa ? (Math.min(bx, cx1) - Math.max(ax, cx0)) * wz / ca : clipArea(qx, qz, cx0, cz0, cx1, cz1) / ca;
          if (f > 1e-4) push(j * NX + i, y, s * Math.min(1, f)); } } } }
  // the events by column (counting sort), then per column top-down (ups before downs at a height), the covered fraction swept into spans
  const cnt = new Uint32Array(NC + 1); for (let e = 0; e < ne; e++) cnt[EC[e] + 1]++; for (let c = 0; c < NC; c++) cnt[c + 1] += cnt[c];
  const fill = cnt.slice(0, NC), SY = new Float32Array(ne), SA = new Float32Array(ne); for (let e = 0; e < ne; e++) { const k = fill[EC[e]]++; SY[k] = EY[e]; SA[k] = EA[e]; }
  EC = EY = EA = null;
  const off = new Uint32Array(NC + 1), EPS = 1e-3; let iv = new Float32Array(1 << 16), ni = 0; const tmp = [], m = [];
  for (let c = 0; c < NC; c++) { off[c] = ni; const a = cnt[c], z = cnt[c + 1]; if (a === z) continue;
    for (let e = a + 1; e < z; e++) { const y = SY[e], s = SA[e]; let f = e - 1;
      while (f >= a && (SY[f] < y - 1e-4 || (Math.abs(SY[f] - y) <= 1e-4 && SA[f] < 0 && s > 0))) { SY[f + 1] = SY[f]; SA[f + 1] = SA[f]; f--; }
      SY[f + 1] = y; SA[f + 1] = s; }
    tmp.length = 0; let cov = 0, hi = 0, e = a;
    while (e < z) { const y = SY[e]; let up = 0, dn = 0; while (e < z && Math.abs(SY[e] - y) <= 1e-4) { if (SA[e] > 0) up += SA[e]; else dn -= SA[e]; e++; }
      const was = cov > EPS; cov = Math.max(0, cov + up - dn); const now = cov > EPS;
      if (!was && now) hi = y; else if (was && !now) tmp.push(y, hi); }
    if (cov > EPS) tmp.push(Math.min(0, SY[z - 1]), hi);
    const sh = softH ? softH[c] : 0;   // (walk-through decor: its spans go before the merge, so a window box over a bed doesn't keep the bed solid)
    m.length = 0; for (let k = 0; k < tmp.length; k += 2) { const lo = tmp[k], h = tmp[k + 1]; if (sh && h <= sh + .03 && lo <= .35) continue; if (m.length && m[m.length - 2] - h < merge) m[m.length - 2] = Math.min(m[m.length - 2], lo); else m.push(lo, h); }
    if (ni + m.length > iv.length) { const g = new Float32Array(Math.max(iv.length * 2, ni + m.length)); g.set(iv); iv = g; }
    for (let k = m.length - 2; k >= 0; k -= 2) { iv[ni++] = m[k]; iv[ni++] = m[k + 1]; } }
  off[NC] = ni;
  return { x0, z0, NX, NZ, cs: CS, off, iv: iv.slice(0, ni), ground, quads: nq, spans: ni >> 1, ms: performance.now() - t0 };
}

// ── the queries (main thread), on a built grid. A column is a WALL for someone standing at y when a span reaches from above y + step
// into their body (below y + h), or when there is nothing to stand on at all (the water: no ground and no top within reach).
export function walkQuery(R) {
  const { x0, z0, NX, NZ, cs, off, iv, ground } = R, inv = 1 / cs;
  const col = (x, z) => { const i = Math.floor((x - x0) * inv), j = Math.floor((z - z0) * inv); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
  // the highest top at or under yMax (−Infinity: nothing there, the water)
  function floorC(c, yMax) { if (c < 0) return -Infinity; let best = ground[c] ? (ground[c] - 1) * .01 : -Infinity;
    for (let k = off[c], e = off[c + 1]; k < e; k += 2) { const hi = iv[k + 1]; if (hi <= yMax + 1e-4 && hi > best) best = hi; } return best; }
  function wallC(c, y, step, h) { if (c < 0) return true; if (floorC(c, y + step) < y - 2.5) return true;   // the water, or a drop too far to step down
    for (let k = off[c], e = off[c + 1]; k < e; k += 2) if (iv[k + 1] > y + step && iv[k] < y + h) return true; return false; }
  // the lowest solid bottom above y (Infinity: open sky)
  function ceilC(c, y) { if (c < 0) return Infinity; let best = Infinity; for (let k = off[c], e = off[c + 1]; k < e; k += 2) if (iv[k] > y && iv[k] < best) best = iv[k]; return best; }
  return { col, floorC, wallC, ceilC, cs, x0, z0, NX, NZ, floorAt: (x, z, yMax) => floorC(col(x, z), yMax), wallAt: (x, z, y, step, h) => wallC(col(x, z), y, step, h) };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = e => { try { const r = buildWalk(e.data); self.postMessage(r, [r.off.buffer, r.iv.buffer, r.ground.buffer]); } catch (err) { self.postMessage({ error: String(err?.stack || err) }); } };
}
