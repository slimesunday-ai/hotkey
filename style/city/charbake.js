// Character tiers, baked per block (worker-safe; chars module CH and THREE are passed in — world/chars.js is used as-is).
//   full  the chars.js body exactly (every voxel face, chars.js's own AO and MATS layers), merged per 16 m cluster
//   mid   the same posed voxels resampled to 2×2×2 → one city cube (0.1), interior filled, greedy-meshed, one layer, cluster id per vertex
//   far   three boxes (legs · torso · head) in the most common colour of each band, for one instanced draw
// FIDELITY PASS (people round, 2026-09-28; slime's call): who is baked, and how the rest move.
//   · the frozen sidewalk crowd retires: a person standing on a street sidewalk (castspec.js walk) in a standing act (stand, talk, phone,
//     carry, lean, arms, walk) who is the generator's (src life), a shop-door customer (doors) or a block file's (override) — unless it
//     stands in a line (three or more in a row, 0.5–1.7 m apart: a queue). Walkers fill those sidewalks. Everyone else is kept: roof
//     parties, queues, sitters, window leaners, workers, vendors, crews, hero and kit scenes (src hand), people in yards, lots and plazas.
//   · the kept move (stream.js draws it on the GPU, like the walkers): every vertex of the full and mid tiers carries its person's
//     origin and facing (t.X: Int16 × 4, cm from the tier origin + ry) and its part, class, phase and lean (t.Y: Uint8 × 4). Classes:
//     1 dance · 2 stand (weight shift, a look along the line, the phone) · 3 sit · 4 lean / window · 5 work · 0 still (giants).
//     Parts: 0 torso · 1 leg L · 2 leg R · 3 arm L · 4 arm R · 5 head (the mid tier: torso, arm L, arm R).
//   · CASTLOG.rows (when CASTLOG.on): per block, who retired and who stayed, by act and class (tools: the people census)
import { Bank, Vol, meshVol, stampM } from './vox.js';
import { packFull, packLayers, concatTiers } from './lod.js';
const LUT = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; LUT[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)); }
const toS = v => LUT[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0], hexOf = (r, g, b) => (toS(r) << 16) | (toS(g) << 8) | toS(b);
const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

// bake a mesh (world matrix applied) into a bank layer
function bakeInto(THREE, mesh, dst, li, tmp, an = null) {
  const g = mesh.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array, idx = g.index.array, D = dst.L[li], base = D.v, e = mesh.matrixWorld.elements;
  if (an) { const A = (dst.an ??= [0, 1, 2, 3].map(() => ({ X: [], Y: [] })))[li], n = pos.length / 3; for (let k = 0; k < n; k++) { A.X.push(an.X[0], an.X[1], an.X[2], an.X[3]); A.Y.push(an.Y[0], an.Y[1], an.Y[2], an.Y[3]); } }
  tmp.getNormalMatrix(mesh.matrixWorld); const m = tmp.elements, n = pos.length / 3;
  D.P.need(n * 3); D.N.need(n * 3); D.C.need(n * 3);
  for (let k = 0; k < n; k++) { const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], a = nor[k * 3], b = nor[k * 3 + 1], c = nor[k * 3 + 2];
    D.P.a[D.P.n++] = e[0] * x + e[4] * y + e[8] * z + e[12]; D.P.a[D.P.n++] = e[1] * x + e[5] * y + e[9] * z + e[13]; D.P.a[D.P.n++] = e[2] * x + e[6] * y + e[10] * z + e[14];
    let nx = m[0] * a + m[3] * b + m[6] * c, ny = m[1] * a + m[4] * b + m[7] * c, nz = m[2] * a + m[5] * b + m[8] * c; const l = Math.hypot(nx, ny, nz) || 1;
    D.N.a[D.N.n++] = Math.round(nx / l * 127); D.N.a[D.N.n++] = Math.round(ny / l * 127); D.N.a[D.N.n++] = Math.round(nz / l * 127);
    D.C.a[D.C.n++] = col[k * 3]; D.C.a[D.C.n++] = col[k * 3 + 1]; D.C.a[D.C.n++] = col[k * 3 + 2]; }
  D.I.need(idx.length); for (let k = 0; k < idx.length; k++) D.I.a[D.I.n++] = idx[k] + base; D.v += n;
}

// posed voxels (root-local voxel units) → coarse cells: cellKey → { layer, colour counts }
function coarseCells(THREE, obj, CH, inv, tmpM, cs = 2, partOf = () => 0) {   // cs = coarse cell in chars.js voxels (2 = one 0.1 city cube at scale 1)
  const vox = new Map();   // voxel key → [r, g, b, lum, layer, X, Y, Z, part]
  obj.traverse(m => { if (!m.isMesh || !visible(m)) return; const li = Math.max(0, CH.MATS.indexOf(m.material)), pt = partOf(m); tmpM.multiplyMatrices(inv, m.matrixWorld); const e = tmpM.elements;
    const g = m.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array, nq = pos.length / 12;
    for (let q = 0; q < nq; q++) { const b = q * 12; let cx = 0, cy = 0, cz = 0, br = -1, r = 0, gg = 0, bb = 0;
      for (let t = 0; t < 4; t++) { const o = b + t * 3; cx += pos[o]; cy += pos[o + 1]; cz += pos[o + 2]; const L = col[o] + col[o + 1] + col[o + 2]; if (L > br) { br = L; r = col[o]; gg = col[o + 1]; bb = col[o + 2]; } }
      cx = cx / 4 - nor[b] * .5; cy = cy / 4 - nor[b + 1] * .5; cz = cz / 4 - nor[b + 2] * .5;   // voxel centre in mesh-local voxel units
      const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12], Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13], Z = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
      const k = Math.floor(X + 512) * 1048576 + Math.floor(Y + 512) * 1024 + Math.floor(Z + 512), v = vox.get(k);
      if (!v || br > v[3]) vox.set(k, [r, gg, bb, br, li, X, Y, Z, pt]); } });
  const cells = new Map();
  for (const v of vox.values()) { const cx = Math.floor(v[5] / cs), cy = Math.floor(v[6] / cs), cz = Math.floor(v[7] / cs), k = cx + ',' + cy + ',' + cz; let c = cells.get(k);
    if (!c) cells.set(k, c = { x: cx, y: cy, z: cz, cnt: new Map(), pv: [0, 0, 0, 0, 0, 0] }); const h = hexOf(v[0], v[1], v[2]) * 4 + v[4]; c.cnt.set(h, (c.cnt.get(h) || 0) + (v[4] === 3 ? 3 : 1)); c.pv[v[8]]++; }
  for (const c of cells.values()) { let b = 0; for (let q = 1; q < 6; q++) if (c.pv[q] > c.pv[b]) b = q; c.part = b; }
  return cells;
}
const modeOf = cnt => { let best = 0, bc = -1; for (const [h, c] of cnt) if (c > bc) { bc = c; best = h; } return best; };

// ── who stays, and how they move
const STANDING = new Set(['stand', 'talk', 'talk2', 'phone', 'carry', 'lean', 'arms', 'walk']), RETIRES = new Set(['life', 'doors', 'override']);
const CLASS = { dance: 1, dj: 5, sit: 3, lounge: 3, soak: 3, fe: 3, window: 4, lean: 4, clerk: 5, garden: 5, reach: 5, shoot: 5 };
export const CASTLOG = { on: false, rows: [] };
// people standing in a row, 0.5–1.7 m apart, three or more, near a line (≤ 0.45 m off it), two in three facing along it the same way: a queue
function queued(list) {
  const S = list.filter(p => STANDING.has(p.act) || p.src === 'queue'), inQ = new Set(), seen = new Set();
  for (const a of S) { if (seen.has(a)) continue; const comp = [a], st = [a]; seen.add(a);
    while (st.length) { const q = st.pop(); for (const b of S) { if (seen.has(b) || Math.abs(b.y - q.y) > .3) continue; const d = Math.hypot(b.x - q.x, b.z - q.z); if (d >= .5 && d <= 1.7) { seen.add(b); comp.push(b); st.push(b); } } }
    if (comp.length < 3) continue; let mx = 0, mz = 0; for (const q of comp) { mx += q.x; mz += q.z; } mx /= comp.length; mz /= comp.length;
    let sxx = 0, sxz = 0, szz = 0; for (const q of comp) { const dx = q.x - mx, dz = q.z - mz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
    const th = .5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th);
    if (!comp.every(q => Math.abs(-(q.x - mx) * uz + (q.z - mz) * ux) <= .45)) continue;
    const dots = comp.map(q => Math.sin(q.ry) * ux + Math.cos(q.ry) * uz), fw = dots.filter(d => d > .75).length, bw = dots.filter(d => d < -.75).length;   // (a line faces along itself, one way: a talk pair faces each other)
    if (Math.max(fw, bw) >= comp.length * .66) for (const q of comp) inQ.add(q); }
  return inQ; }
export function castRoles(persons) {
  const inQ = queued(persons);
  return persons.map(p => { const q = inQ.has(p), retire = RETIRES.has(p.src) && p.walk && STANDING.has(p.act) && !q;
    const cls = (p.scale || 1) > 1.5 || p.act === 'giant' ? 0 : p.src === 'scene' && p.act === 'arms' ? 5 : CLASS[p.act] ?? 2;   // (a kerb scene's arms are a vendor's or a mover's)
    return { retire, cls, queue: q, why: retire ? (p.src === 'doors' ? 'shop-door customer' : p.src === 'override' ? 'block file' : 'generator') : null }; }); }
const hash32 = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; };

export function bakeCast(persons, CH, THREE, o, cellOf, gone = []) {   // gone: the retired, already out of `persons` (jobs.js), for CASTLOG only
  const nC = 4, full = Array.from({ length: nC }, () => new Bank(true)), mid = Array.from({ length: nC }, () => new Bank(true)), far = [], count = new Array(nC).fill(0), cen = Array.from({ length: nC }, () => [0, 0, 0]);
  const tmp3 = new THREE.Matrix3(), inv = new THREE.Matrix4(), tmpM = new THREE.Matrix4();
  const roles = castRoles(persons), kept = persons.filter((p, k) => !roles[k].retire), role = new Map(persons.map((p, k) => [p, roles[k]]));
  if (CASTLOG.on) { const row = { n: persons.length + gone.length, retired: gone.length, why: {}, kept: {}, cls: {}, walkKept: {} }; for (const g of gone) row.why[g.why] = (row.why[g.why] || 0) + 1; persons.forEach((p, k) => { const r = roles[k];
      if (r.retire) { row.retired++; row.why[r.why] = (row.why[r.why] || 0) + 1; } else { const a = r.queue ? 'queue' : p.src === 'roof' || p.act === 'dance' ? 'dance' : p.act; row.kept[a] = (row.kept[a] || 0) + 1; row.cls[r.cls] = (row.cls[r.cls] || 0) + 1;
        if (p.walk && STANDING.has(p.act)) { const w = (r.queue ? 'queue:' : '') + p.src; row.walkKept[w] = (row.walkKept[w] || 0) + 1; if (r.queue && CASTLOG.q) CASTLOG.q.push([p.id, p.src, p.act, +p.x.toFixed(1), +p.z.toFixed(1)]); } } });
    CASTLOG.rows.push(row); }
  for (const p of kept) {
    const obj = CH.build(p.look); obj.rotation.order = 'YXZ'; obj.position.set(p.x, p.y, p.z); obj.rotation.y = p.ry; if (p.scale !== 1) obj.scale.setScalar(CH.S * p.scale);
    CH.pose(obj, 0, 0); obj.userData.open.visible = true; obj.userData.shut.visible = false; p.fn?.(obj.userData.rig, obj); obj.updateMatrixWorld(true);
    const c = cellOf(p.x, p.z); count[c]++; cen[c][0] += p.x; cen[c][1] += p.y; cen[c][2] += p.z;
    // the idle animation's data: origin (cm from the tier origin) + facing, and class · phase · lean; the part per mesh
    const rig = obj.userData.rig, head = obj.userData.head, under = (m, g) => { for (let q = m.parent; q; q = q.parent) if (q === g) return true; return false; };
    const partOf = m => rig ? (under(m, rig.legL) ? 1 : under(m, rig.legR) ? 2 : under(m, rig.armL) ? 3 : under(m, rig.armR) ? 4 : head && under(m, head) ? 5 : 0) : 0;
    let ry = p.ry % (2 * Math.PI); if (ry > Math.PI) ry -= 2 * Math.PI; if (ry < -Math.PI) ry += 2 * Math.PI;
    const cls = role.get(p).cls, ph = hash32(String(p.id ?? p.x + ',' + p.z)) & 255, tilt = Math.max(0, Math.min(255, Math.round(128 + obj.rotation.x * 128)));
    const AX = [Math.round((p.x - o[0]) * 100), Math.round((p.y - o[1]) * 100), Math.round((p.z - o[2]) * 100), Math.round(ry / Math.PI * 32767)], an = pt => ({ X: AX, Y: [pt, cls, ph, tilt] });
    obj.traverse(m => { if (m.isMesh && visible(m)) bakeInto(THREE, m, full[c], Math.max(0, CH.MATS.indexOf(m.material)), tmp3, an(partOf(m))); });
    // coarse body: cells → a Vol in root-local voxel units (cube = 2 chars.js voxels = one city cube), interior flood-filled
    // giants (4×) keep one voxel per cell so their coarse cube stays ≤ 0.2 m; everyone else resamples 2×2×2 → one 0.1 city cube
    // (fidelity pass: meshed in three pieces — the torso with legs and head, each arm — so the arms can move at mid)
    const cs = (p.scale || 1) >= 1.8 ? 1 : 2; inv.copy(obj.matrixWorld).invert(); const cells = coarseCells(THREE, obj, CH, inv, tmpM, cs, partOf);
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; for (const q of cells.values()) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); z0 = Math.min(z0, q.z); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); z1 = Math.max(z1, q.z); }
    if (cells.size) { const nx = x1 - x0 + 3, ny = y1 - y0 + 3, nz = z1 - z0 + 3, org = [(x0 - 1) * cs, (y0 - 1) * cs, (z0 - 1) * cs], grp = q => cls && (q.part === 3 || q.part === 4) ? q.part : 0;
      const Vs = new Map(), volOf = g => { let V = Vs.get(g); if (!V) Vs.set(g, V = new Vol(nx, ny, nz, { s: cs, org, ground: false })); return V; };
      const bands = [new Map(), new Map(), new Map(), new Map()], bb = [0, 1, 2, 3].map(() => [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);   // (band 3: only giants — their far head read as a floating black cube)
      for (const q of cells.values()) { const h = modeOf(q.cnt); volOf(grp(q)).set(q.x - x0 + 1, q.y - y0 + 1, q.z - z0 + 1, h >> 2, h & 3);
        const band = q.y * cs < 10 ? 0 : q.y * cs < 19 ? 1 : (p.scale || 1) >= 1.8 && q.y * cs >= 28 ? 3 : 2, B = bb[band];   // pass 2: a giant's head splits into face (2) + hair / cap (3)
        B[0] = Math.min(B[0], q.x); B[1] = Math.min(B[1], q.y); B[2] = Math.min(B[2], q.z); B[3] = Math.max(B[3], q.x); B[4] = Math.max(B[4], q.y); B[5] = Math.max(B[5], q.z);   // (fidelity pass: these sat inside the comment above, so every band's box stayed empty and no baked person ever had a far tier: people vanished past R.charMid)
        let n = 0; for (const v of q.cnt.values()) n += v; bands[band].set(h >> 2, (bands[band].get(h >> 2) || 0) + n); }
      for (const [g, V] of Vs) {
        // flood the outside; anything the flood never reaches is interior → solid (no hidden faces)
        const seen = new Uint8Array(nx * ny * nz), st = [0]; seen[0] = 1; const id = (x, y, z) => x + nx * (z + nz * y);
        while (st.length) { const i = st.pop(), x = i % nx, z = ((i / nx) | 0) % nz, y = (i / (nx * nz)) | 0;
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue; const j = id(X, Y, Z); if (seen[j] || V.has(X, Y, Z)) continue; seen[j] = 1; st.push(j); } }
        const fillC = V.pal.length > 1 ? V.pal[1] : 0x777777; for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) if (!seen[id(x, y, z)] && !V.has(x, y, z)) V.set(x, y, z, fillC);
        const bk = new Bank(true); meshVol(V, bk); const dst = mid[c], v0 = dst.L.map(O => O.v); stampM(bk, dst, obj.matrixWorld.elements);
        const A = dst.an ??= [0, 1, 2, 3].map(() => ({ X: [], Y: [] })), a = an(g);
        dst.L.forEach((O, li) => { for (let k = v0[li]; k < O.v; k++) { A[li].X.push(...a.X); A[li].Y.push(...a.Y); } }); }
      // far boxes: per band, bbox + most common colour; centre through the root matrix, size in metres
      const sc = CH.S * (p.scale || 1);
      bb.forEach((B, k) => { if (B[0] > B[3]) return; let best = 0, bc = -1; for (const [h, n] of bands[k]) if (n > bc) { bc = n; best = h; }
        const lx = (B[0] + B[3] + 1) * cs / 2, ly = (B[1] + B[4] + 1) * cs / 2, lz = (B[2] + B[5] + 1) * cs / 2, e = obj.matrixWorld.elements;   // centre in voxel units = (min+max+1)/2 × cs
        far.push(e[0] * lx + e[4] * ly + e[8] * lz + e[12], e[1] * lx + e[5] * ly + e[9] * lz + e[13], e[2] * lx + e[6] * ly + e[10] * lz + e[14],
          (B[3] - B[0] + 1) * cs * sc, (B[4] - B[1] + 1) * cs * sc, (B[5] - B[2] + 1) * cs * sc, p.ry, ((best >> 16) & 255) / 255, ((best >> 8) & 255) / 255, (best & 255) / 255, c); }); }
    obj.traverse(m => m.geometry?.dispose());
  }
  const centres = cen.map((v, k) => count[k] ? [v[0] / count[k], v[1] / count[k], v[2] / count[k]] : null);
  // the idle data rides on each tier mesh (t.X, t.Y), in the tier's own vertex order (packLayers: layer by layer; concatTiers: in turn)
  const withAn = (t, bk, layers) => { if (!t || !bk.an) return t; const X = [], Y = []; for (const li of layers) { const A = bk.an[li]; for (let k = 0; k < A.X.length; k++) X.push(A.X[k]); for (let k = 0; k < A.Y.length; k++) Y.push(A.Y[k]); }
    if (X.length === t.n * 4) { t.X = new Int16Array(X); t.Y = new Uint8Array(Y); } return t; };
  const mids = mid.map((bk, k) => withAn(packLayers(bk, [0, 1, 2, 3], o, [3], k), bk, [0, 1, 2, 3])), midT = concatTiers(mids, o);
  if (midT) { const parts = mids.filter(Boolean); if (parts.every(t => t.X)) { midT.X = new Int16Array(midT.n * 4); midT.Y = new Uint8Array(midT.n * 4); let v = 0; for (const t of parts) { midT.X.set(t.X, v * 4); midT.Y.set(t.Y, v * 4); v += t.n; } } }
  return { full: full.map(bk => packFull(bk, o).map((t, li) => withAn(t, bk, [li]))), mid: midT, far: new Float32Array(far), count, centres, n: kept.length };
}
