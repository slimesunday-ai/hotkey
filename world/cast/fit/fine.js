// CHARACTER FITTING · FINE DETAIL (2026-10-01): two tools below the voxel, both drawn in a trait's `fine(P, ctx)` pass.
//   FINE PAINT   4 × 4 texels on one face of an existing voxel (flat: no geometry). It lives on that voxel and rides its segment.
//   FINE VOXELS  half-size voxels on a 2× grid (real geometry), riding the segment of the voxel they touch.
// No three.js here: chars.js (the grids, the fine pass, the static mesh), anim/bake.js (the walker bake), anim/fine.js (the shared
// atlas and the walker shader) and the audit (style/city/studio/audit/lib.mjs) all read this one file. Designer rules: world/fresh/README.md.
//
// STORAGE (on every chars.js Grid):
//   G.fp  voxel key → [6] (one per face, FACES order; sparse) { t: Int32Array(16), o: slot }. t[j * 4 + i] is texel (i, j): i along
//         the face's first in-plane axis (PLANE[f][0]), j along the second, both counting up the world axis; −1 = unpainted (the
//         voxel's own colour shows). o = the slot that painted it last.
//   G.hv  half key → [colour, layer, slot]. Half coordinates are 2 × voxel coordinates: half (hx, hy, hz) fills [hx/2, hx/2 + ½).
//   A later full write (set / del / clip) on a voxel clears its paint and the eight half cells inside it: the later layer wins.
// Fine paint goes on the OUTERMOST voxel of the painter's grids along the face's normal, so it lands on what is visible now.

export const FACES = ['+x', '-x', '+y', '-y', '+z', '-z'];   // = chars.js DIRS and anim/bake.js DIRS order
export const NORMAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const PLANE = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]];   // each face's in-plane axes (a, b): 0 x · 1 y · 2 z
const AXIS = [0, 0, 1, 1, 2, 2];                                           // each face's normal axis
// as seen from outside the face (bitmaps read correctly from there): one column right and one row down, as steps of (qa, qb)
export const VIEW = [[-1, -1], [1, -1], [1, 1], [1, -1], [1, -1], [-1, -1]];
// the budgets, per trait (the audit gates on them)
export const FINE = { faces: 64, voxels: 32 };

export const hk = (hx, hy, hz) => ((hx + 512) << 20) | ((hy + 512) << 10) | (hz + 512);
export const hd = k => [(k >> 20) - 512, ((k >> 10) & 1023) - 512, (k & 1023) - 512];
const vk = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256);
const fl2 = h => Math.floor(h / 2);
export const cellOf = (hx, hy, hz) => [fl2(hx), fl2(hy), fl2(hz)];
export const faceIndex = f => typeof f === 'number' ? f : FACES.indexOf(f);

// ── colour (sRGB hex ↔ linear), for the per-face average (the mid / far fallback)
const s2l = c => (c /= 255) <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
const l2s = v => Math.max(0, Math.min(255, Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055))));
// a painted face's 16 colours (unpainted texels take the voxel's colour)
export const texels = (e, base) => Array.from(e.t, c => c < 0 ? base : c);
// its average colour (linear mean), the face's colour wherever the texels aren't drawn (the static mesh, the mid and far tiers)
export function faceAverage(e, base) { let r = 0, g = 0, b = 0; for (const c of texels(e, base)) { r += s2l((c >> 16) & 255); g += s2l((c >> 8) & 255); b += s2l(c & 255); }
  return (l2s(r / 16) << 16) | (l2s(g / 16) << 8) | l2s(b / 16); }

// ── the Grid side (chars.js Grid calls these from set / del / clip)
export function clearCell(G, x, y, z, k) { if (G.fp.size) G.fp.delete(k);
  if (G.hv.size) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) G.hv.delete(hk(2 * x + a, 2 * y + b, 2 * z + c)); }
export function clipHalves(G, pred) { if (!G.hv.size) return; for (const k of [...G.hv.keys()]) { const [hx, hy, hz] = hd(k); if (pred(fl2(hx), fl2(hy), fl2(hz))) G.hv.delete(k); } }

// ── the painter: what a trait's fine(P, ctx) pass gets. grids: the grids this slot paints on (head slots: the head; body slots: the body;
// shoes: the shoe grid; skin: head + body; eyes and mouth: the face grid). log: compose's fine log (per slot: faces, texels, voxels,
// misses, buried voxels, overwrites), read by the audit's budgets.
export function painter(grids, slot, log) {
  const st = log ? (log[slot] ||= { faces: new Set(), texels: 0, voxels: 0, miss: 0, buried: 0, over: {} }) : null, col = new Map();
  const gid = G => grids.indexOf(G);
  // the outermost voxel along face f's normal in column (a, b) of the painter's grids → [G, x, y, z] | null
  const outer = (f, a, b) => { const ck = f * 1e6 + (a + 512) * 1024 + (b + 512); if (col.has(ck)) return col.get(ck);
    const [A, Bx] = PLANE[f], N = AXIS[f], s = NORMAL[f][N], p = [0, 0, 0]; p[A] = a; p[Bx] = b; let hit = null;
    for (let n = 64 * s; n !== -64 * s - s && !hit; n -= s) { p[N] = n; for (const G of grids) if (G.has(p[0], p[1], p[2])) { hit = [G, p[0], p[1], p[2]]; break; } }
    col.set(ck, hit); return hit; };
  const put = (G, x, y, z, f, i, j, c) => { const k = vk(x, y, z); let arr = G.fp.get(k); if (!arr) G.fp.set(k, arr = [null, null, null, null, null, null]);
    let e = arr[f]; if (!e) e = arr[f] = { t: new Int32Array(16).fill(-1), o: slot };
    if (st) { if (e.o !== slot) st.over[e.o] = (st.over[e.o] || 0) + 1; st.faces.add(gid(G) + ':' + k + ':' + f); st.texels++; }
    e.o = slot; e.t[j * 4 + i] = c; };
  const P = {
    slot,
    // one texel at quarter coordinates (qa, qb) on the outermost surface facing `face`: qa = 4 × the face's first in-plane coordinate
    // + i, qb = 4 × the second + j (±z faces: x, y · ±x faces: z, y · ±y faces: x, z). colour 0xRRGGBB (null / undefined: skip)
    paint(face, qa, qb, c) { if (c === undefined || c === null) return; const f = faceIndex(face); if (f < 0) throw new Error('fine paint: face must be one of ' + FACES.join(' '));
      const a = Math.floor(qa / 4), b = Math.floor(qb / 4), h = outer(f, a, b); if (!h) { if (st) st.miss++; return; } put(h[0], h[1], h[2], h[3], f, qa - 4 * a, qb - 4 * b, c); },
    // a half-open rectangle qa0 ≤ qa < qa1, qb0 ≤ qb < qb1; c may be (qa, qb) => colour
    rect(face, qa0, qb0, qa1, qb1, c) { for (let a = qa0; a < qa1; a++) for (let b = qb0; b < qb1; b++) P.paint(face, a, b, typeof c === 'function' ? c(a, b) : c); },
    // a bitmap at 4× resolution, read as seen from outside the face: rows top → bottom, one char a texel, starting at (qa, qb), the
    // top-left texel as seen from outside. pal: char → colour (a char not in pal is skipped)
    bmp(face, rows, pal, qa, qb) { const f = faceIndex(face), [da, db] = VIEW[f];
      rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) P.paint(f, qa + i * da, qb + j * db, c); } }); },
    // one texel (i, j) (0..3 each) of a given voxel's face, when the outermost rule isn't the one you want; the voxel must exist
    at(x, y, z, face, i, j, c) { if (c === undefined || c === null) return; const f = faceIndex(face), G = grids.find(g => g.has(x, y, z)); if (!G) { if (st) st.miss++; return; } put(G, x, y, z, f, i & 3, j & 3, c); },
    // one fine voxel at half coordinates (2 × voxel coordinates). It must touch a voxel (or a fine voxel that does), outside any voxel.
    half(hx, hy, hz, c, l = 0) { if (c === undefined || c === null) return; const [x, y, z] = cellOf(hx, hy, hz);
      if (grids.some(G => G.has(x, y, z))) { if (st) st.buried++; return; }   // inside a voxel: nothing to see
      let T = null; for (const [dx, dy, dz] of NORMAL) { const [X, Y, Z] = cellOf(hx + dx, hy + dy, hz + dz); T = grids.find(G => G.has(X, Y, Z)); if (T) break; }
      if (!T) for (const [dx, dy, dz] of NORMAL) { T = grids.find(G => G.hv.has(hk(hx + dx, hy + dy, hz + dz))); if (T) break; }
      T ||= grids[0]; const k = hk(hx, hy, hz); for (const G of grids) { const o = G.hv.get(k); if (o && st) { if (o[2] !== slot) st.over[o[2]] = (st.over[o[2]] || 0) + 1; else st.voxels--; } if (G !== T) G.hv.delete(k); }
      T.hv.set(k, [c, l === true ? 1 : (l || 0), slot]); if (st) st.voxels++; },
    // a half-open box of fine voxels; c may be (hx, hy, hz) => colour
    halfBox(hx0, hy0, hz0, hx1, hy1, hz1, c, l) { for (let x = hx0; x < hx1; x++) for (let y = hy0; y < hy1; y++) for (let z = hz0; z < hz1; z++) P.half(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); },
  };
  return P;
}

// ── routing: each fine voxel rides the segment of the voxel it touches. A connected group of fine voxels takes the part most of its
// contacts touch (partAt(x, y, z) → part | undefined for a full cell); a group touching no voxel is floating (fallback(k) → part).
export function routeHalves(keys, partAt, fallback) {
  const out = new Map(), set = new Set(keys), seen = new Set();
  for (const k0 of set) { if (seen.has(k0)) continue; const comp = [k0], votes = new Map(); seen.add(k0);
    for (let i = 0; i < comp.length; i++) { const [hx, hy, hz] = hd(comp[i]);
      for (const [dx, dy, dz] of NORMAL) { const n = hk(hx + dx, hy + dy, hz + dz); if (set.has(n)) { if (!seen.has(n)) { seen.add(n); comp.push(n); } continue; }
        const p = partAt(...cellOf(hx + dx, hy + dy, hz + dz)); if (p !== undefined) votes.set(p, (votes.get(p) || 0) + 1); } }
    let best, bn = 0; for (const [p, n] of votes) if (n > bn || (n === bn && p < best)) { best = p; bn = n; }
    for (const k of comp) out.set(k, best !== undefined ? best : fallback(k)); }
  return out;
}

// ── hat cover in half units (world/fit/layers.js coverOf): a hat's fine voxels join its cover, and a fine hair voxel is tested at its
// own half cell: cover(x, y, z, size) with (x, y, z) the cell's low corner in voxels and size 1 (a voxel) or ½ (a fine voxel).
export const halfCorner = k => hd(k).map(h => h / 2);
