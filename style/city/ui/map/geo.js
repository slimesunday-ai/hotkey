// HUMAN LAYER · SECTION 3b · THE CITY MAP, THE GEOMETRY (pure: no DOM; built once, the first time the map opens, ≈ 40–80 ms).
// Everything comes from the plan the city is built from, read only: plan.js (world/city.js's blocks, roads, names, the style layer's
// Route 9 end), the woods' own island shape (districts/forest/land.js elev: the coast, the lake, the ponds, the bay's sand rim: exactly
// the land the ground paints), the sim's places (simplaces.js: 29, coordinates are law) and its lots (world/city.js LOT_BY_ID).
// Output is world-space Path2D-ready data, so the map draws crisp at any zoom with one transform:
//   water     filled marching-squares cells of elev < 0 on a 4 m grid (full cells merged into runs) + the coast line + two ripple lines
//   ground    the city's ground (every urban block, roads and sidewalks), the blocks' interiors by tint class, the compounds merged
//   roads     runs of contiguous segments per street line: { axis, L, at, a, b, hw, name, cls: street | ave | hwy, bridge }
//   labels    district names at each district's centroid, the places, the lots (property lines)
//   grid      the page grid: columns A…, rows 1… (a Thomas Guide "C4")
import { P, kindAt, distOf, urban, segX, segZ, hwX, hwZ, isAve, XNAME, ZNAME, COMPOUNDS, interior, HWY } from '../../plan.js';
import { SIM_PLACES, DISTRICT_NAMES } from '../../simplaces.js';
import { elev } from '../../districts/forest/land.js';
import { LOT_BY_ID } from '../../../../world/city.js';

export const FRAME = { x0: -640, z0: -512, x1: 640, z1: 448 };    // the ground's coarse frame (ground.js COARSE): the island and its sea
export const GRID = { x0: -590, z0: -500, cell: 140, cols: 9, rows: 7 };   // the page grid: A…I × 1…7, offset from the street grid
const CELL = 4;
export const gridRef = (x, z) => { const c = Math.floor((x - GRID.x0) / GRID.cell), r = Math.floor((z - GRID.z0) / GRID.cell);
  return c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows ? '' : String.fromCharCode(65 + c) + (r + 1); };
const cleanName = n => String(n || '').replace(/\s*\(DROP\)$/, '');

// ── marching squares, filled: every cell's part where v ≥ thr as one polygon (corners in order + the crossings); full cells merged into
// runs per row. Saddles take the connected reading. → { rects: [x, z, w, h …], polys: [[x, z, x, z …] …] }
export function isoFill(V, nx, nz, x0, z0, c, thr) {
  const rects = [], polys = [], at = (i, k) => V[k * nx + i];
  for (let k = 0; k < nz - 1; k++) { let run = -1;
    for (let i = 0; i < nx - 1; i++) {
      const a = at(i, k), b = at(i + 1, k), d = at(i + 1, k + 1), e = at(i, k + 1), full = a >= thr && b >= thr && d >= thr && e >= thr;
      if (full) { if (run < 0) run = i; continue; }
      if (run >= 0) { rects.push(x0 + run * c, z0 + k * c, (i - run) * c, c); run = -1; }
      if (a < thr && b < thr && d < thr && e < thr) continue;
      const C = [[i, k, a], [i + 1, k, b], [i + 1, k + 1, d], [i, k + 1, e]], pg = [];
      for (let q = 0; q < 4; q++) { const [ci, ck, cv] = C[q], [ni, nk, nv] = C[(q + 1) % 4];
        if (cv >= thr) pg.push(x0 + ci * c, z0 + ck * c);
        if ((cv >= thr) !== (nv >= thr)) { const f = (thr - cv) / (nv - cv); pg.push(x0 + (ci + (ni - ci) * f) * c, z0 + (ck + (nk - ck) * f) * c); } }
      if (pg.length >= 6) polys.push(pg);
    }
    if (run >= 0) rects.push(x0 + run * c, z0 + k * c, (nx - 1 - run) * c, c);
  }
  return { rects, polys };
}
// the contour at thr as segments [x0, z0, x1, z1, …]
export function isoLines(V, nx, nz, x0, z0, c, thr) {
  const out = [], at = (i, k) => V[k * nx + i];
  for (let k = 0; k < nz - 1; k++) for (let i = 0; i < nx - 1; i++) {
    const C = [[i, k, at(i, k)], [i + 1, k, at(i + 1, k)], [i + 1, k + 1, at(i + 1, k + 1)], [i, k + 1, at(i, k + 1)]], pts = [];
    for (let q = 0; q < 4; q++) { const [ci, ck, cv] = C[q], [ni, nk, nv] = C[(q + 1) % 4]; if ((cv >= thr) !== (nv >= thr)) { const f = (thr - cv) / (nv - cv); pts.push(x0 + (ci + (ni - ci) * f) * c, z0 + (ck + (nk - ck) * f) * c); } }
    if (pts.length >= 4) out.push(pts[0], pts[1], pts[2], pts[3]); if (pts.length === 8) out.push(pts[4], pts[5], pts[6], pts[7]);
  }
  return out;
}

// what a block is on the map (its tint class): a district, or a park / plaza / lot inside one
const TINT = { p: 'park', P: 'plaza', L: 'parking', K: 'jail', H: 'hospital' };
export const tintOf = k => TINT[k] || distOf(k);

let GEO = null;
export function buildGeo() {
  if (GEO) return GEO;
  const t0 = performance.now(), F = FRAME, nx = (F.x1 - F.x0) / CELL + 1, nz = (F.z1 - F.z0) / CELL + 1, W = new Float32Array(nx * nz);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) W[k * nx + i] = -elev(F.x0 + i * CELL, F.z0 + k * CELL);   // (> 0: water, metres deep-ish)
  const water = isoFill(W, nx, nz, F.x0, F.z0, CELL, 0), coast = isoLines(W, nx, nz, F.x0, F.z0, CELL, 0);
  const ripples = [isoLines(W, nx, nz, F.x0, F.z0, CELL, 1.1), isoLines(W, nx, nz, F.x0, F.z0, CELL, 2.3)];
  const wet = (x, z) => { const i = Math.round((x - F.x0) / CELL), k = Math.round((z - F.z0) / CELL); return i >= 0 && k >= 0 && i < nx && k < nz && W[k * nx + i] > 0; };
  // ── blocks: the city's ground (whole urban blocks: the street bands read as paper) and each block's interior by tint class
  const I0 = -20, I1 = 20, ground = [], blocks = [], seen = new Set(), byDist = new Map();
  for (let i = I0; i <= I1; i++) for (let j = I0; j <= I1; j++) { const k = kindAt(i, j); if (!urban(k)) continue;
    ground.push(i * P, j * P, P, P);
    const d = distOf(k); if (!byDist.has(d)) byDist.set(d, []); byDist.get(d).push([i, j]);
    const c = COMPOUNDS.find(q => i >= q.i0 && i <= q.i1 && j >= q.j0 && j <= q.j1);
    if (c) { const key = c.k + c.i0 + ',' + c.j0; if (seen.has(key)) continue; seen.add(key); const a = interior(c.i0, c.j0), b = interior(c.i1, c.j1);
      blocks.push({ i, j, k, dist: d, tint: tintOf(k), x0: a.x0, z0: a.z0, x1: b.x1, z1: b.z1, compound: true }); continue; }
    const R = interior(i, j); blocks.push({ i, j, k, dist: d, tint: tintOf(k), x0: R.x0, z0: R.z0, x1: R.x1, z1: R.z1 }); }
  // ── roads: per street line, contiguous segments merged into runs; a run over water is split off as a bridge
  const roads = [], clsOf = (axis, L) => axis === 'x' && L === HWY ? 'hwy' : isAve(axis, L) ? 'ave' : 'street';
  const addRuns = (axis, L, has) => { let a = null;
    const push = (from, to) => { const at = L * P, hw = axis === 'x' ? hwX(L) : hwZ(L), name = (axis === 'x' ? XNAME[L] : ZNAME[L]) || 'County Rd';
      // split by water under the centre line (sampled every 4 m): the bridge parts
      const run = (a0, b0, bridge) => roads.push({ axis, L, at, a: a0, b: b0, hw, name, cls: clsOf(axis, L), bridge });
      let s0 = from, cur = null; for (let s = from; s < to; s += 4) { const m = s + 2, w = axis === 'x' ? wet(at, m) : wet(m, at); if (cur === null) cur = w; else if (w !== cur) { run(s0, s, cur); s0 = s; cur = w; } }
      run(s0, to, !!cur); };
    for (let q = I0; q <= I1 + 1; q++) { const on = q <= I1 && has(q); if (on && a === null) a = q; if (!on && a !== null) { push(a * P, q * P); a = null; } } };
  for (let L = I0; L <= I1 + 1; L++) { addRuns('x', L, j => segX(L, j)); addRuns('z', L, i => segZ(L, i)); }
  // ── district labels: the centroid of each district's blocks (the woods and the bay placed by hand: they have no blocks to average)
  const districts = [];
  for (const [d, list] of byDist) { if (d === 'sea' || d === 'forest') continue; let sx = 0, sz = 0; for (const [i, j] of list) { sx += (i + .5) * P; sz += (j + .5) * P; }
    // (the label sits on the district's own block nearest its centroid: a district in pieces — Neon Row — is named where it is)
    const cx = sx / list.length, cz = sz / list.length; let m = list[0], md = Infinity; for (const [i, j] of list) { const dd = Math.hypot((i + .5) * P - cx, (j + .5) * P - cz); if (dd < md) { md = dd; m = [i, j]; } }
    districts.push({ id: d, name: DISTRICT_NAMES[d] || d, x: (m[0] + .5) * P, z: (m[1] + .5) * P, n: list.length, blocks: list }); }
  districts.push({ id: 'forest', name: DISTRICT_NAMES.forest || 'Blackpine Woods', x: -300, z: 250, n: 40, blocks: [], woods: true }, { id: 'sea', name: DISTRICT_NAMES.sea || 'The Bay', x: 40, z: -350, n: 40, blocks: [], sea: true });
  // ── places (the sim's 29) and lots (property lines: the sim's 366, their rects from the plan)
  const places = SIM_PLACES.map(p => ({ ...p, name: cleanName(p.name), grid: gridRef(p.x, p.z) }));
  const lots = []; for (const l of LOT_BY_ID.values()) lots.push({ id: 'lot:' + l.id, x0: l.x0, z0: l.z0, sx: l.sx, sz: l.sz, kind: l.kind, addr: l.addr });
  GEO = { frame: F, grid: GRID, cell: CELL, water, coast, ripples, ground, blocks, roads, districts, places, lots, wet, ms: +(performance.now() - t0).toFixed(1) };
  return GEO;
}
