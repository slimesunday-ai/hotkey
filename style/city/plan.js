// The real map, read-only: block kinds, roads, street names and interiors come from world/city.js (layout only, never its look).
import { P, kindAt, distOf, urban, segX as planSegX, segZ, hwX, hwZ, rwX, rwZ, swX, swZ, aveX, aveZ, SPREAD, XNAME, ZNAME, COMPOUNDS, interior, addressAt, HWY, remap } from '../../world/city.js';
export { P, kindAt, distOf, urban, segZ, hwX, hwZ, rwX, rwZ, swX, swZ, aveX, aveZ, SPREAD, XNAME, ZNAME, COMPOUNDS, interior, addressAt, HWY };
// SPREAD · a street line's class and widths by axis (world/city.js: rw right-of-way, hw road, sw sidewalk). The class is never read off
// the half-width: isAve = an avenue or Route 9 (two-way, signal-timed as an avenue); isHwy = Route 9; everything else a one-way side street
export const isHwy = (axis, L) => axis === 'x' && L === HWY, isAve = (axis, L) => axis === 'x' ? aveX(L) || L === HWY : aveZ(L);
export const rwOf = (axis, L) => axis === 'x' ? rwX(L) : rwZ(L), hwOf = (axis, L) => axis === 'x' ? hwX(L) : hwZ(L), swOf = (axis, L) => axis === 'x' ? swX(L) : swZ(L);
// stitch pass · Route 9's south end. The plan's highway (x = HWY·P) runs south for ever (world/city.js segX: every row from −9 on), out
// past the island's south coast (z ≈ 390) and over the sea. The island ends it where the land does: no Route 9 beside rows ≥ R9_END.row
// (z ≥ 384). The Route 9 ferry landing (districts/forest/landing.js) takes the road on from there to the slip. Everything north of
// row 12 is the plan exactly; this is the one road segment the style layer drops (ground paint, curbs, traffic, the woods' verges).
export const R9_END = { row: 12, z: 12 * P };
export const segX = (L, j) => (L === HWY && j >= R9_END.row) ? false : planSegX(L, j);
// how far a point is off the road surface (m; 0 on the road): the plan's carriageways and junction boxes, square kerbs (the export's
// walk attachments read it: tools/export-world.mjs; it was traffic/buses.js's, for the buses' wide turns)
export function kerbOut(x, z) { const Lx = Math.round(x / P), Lz = Math.round(z / P), i = Math.floor(x / P), j = Math.floor(z / P), dx = Math.abs(x - Lx * P) - hwX(Lx), dz = Math.abs(z - Lz * P) - hwZ(Lz);
  let o = 1e9; if (segX(Lx, j)) o = Math.min(o, Math.max(0, dx)); if (segZ(Lz, i)) o = Math.min(o, Math.max(0, dz));
  if ((segX(Lx, Lz - 1) || segX(Lx, Lz)) && (segZ(Lz, Lx - 1) || segZ(Lz, Lx))) o = Math.min(o, Math.hypot(Math.max(0, dx), Math.max(0, dz))); return o; }

export const SECTION = { name: 'Downtown & Fit Street', i0: -3, i1: 2, j0: -3, j1: 0 };           // x −96…96, z −96…32
export const inSection = (i, j) => i >= SECTION.i0 && i <= SECTION.i1 && j >= SECTION.j0 && j <= SECTION.j1;
export const SWALK = 2;                                                                               // sidewalk width beyond the road edge (plan; SPREAD: today's, a street's own is swX / swZ)

// sim places inside the section (from sim2/places.json; coordinates are law). SPREAD: today's coordinates through the remap (a block's
// middle moves with its block, a corner stays on its crossing: what the export's placesLaw puts there)
const at = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };
export const PLACES = [
  { id: 'fitstreet', name: 'Fit Street (DROP)', kind: 'fit', ...at(-80, 16) },
  { id: 'plaza', name: 'Glasswall Plaza', kind: 'plaza', ...at(16, -16) },
  { id: 'court', name: 'Hall of Justice', kind: 'court', ...at(16, -48) },
  { id: 'police', name: 'Precinct 9', kind: 'police', ...at(48, -16) },
  { id: 'store', name: '24/7 Store', kind: 'store', ...at(80, -80) },
  { id: 'corner-1_-1', name: 'Kent St & 1st St', kind: 'corner', ...at(32, -32) },
  { id: 'corner--1_-1', name: 'Jay St & 1st St', kind: 'corner', ...at(-32, -32) },
  { id: 'corner--1_1', name: 'Jay St & Washington St', kind: 'corner', ...at(-32, 32) },
  { id: 'corner-1_1', name: 'Kent St & Washington St', kind: 'corner', ...at(32, 32) },
];

// blocks of the section (+ the kinds of their neighbours for the backdrop ring)
export function blocks(pad = 0) {
  const out = [];
  for (let i = SECTION.i0 - pad; i <= SECTION.i1 + pad; i++) for (let j = SECTION.j0 - pad; j <= SECTION.j1 + pad; j++) {
    const k = kindAt(i, j), R = interior(i, j);
    out.push({ i, j, k, dist: distOf(k), R, core: inSection(i, j), place: PLACES.find(p => p.kind !== 'corner' && Math.floor(p.x / P) === i && Math.floor(p.z / P) === j) || null });
  }
  return out;
}
// road segments touching the section: N–S (x line L beside block row j) and E–W (z line L beside block column i)
export function roads(pad = 0) {
  const out = [];
  for (let L = SECTION.i0 - pad; L <= SECTION.i1 + 1 + pad; L++) for (let j = SECTION.j0 - pad; j <= SECTION.j1 + pad; j++) if (segX(L, j)) out.push({ axis: 'x', L, at: L * P, a: j * P, b: (j + 1) * P, hw: hwX(L), name: XNAME[L] || 'County Rd' });
  for (let L = SECTION.j0 - pad; L <= SECTION.j1 + 1 + pad; L++) for (let i = SECTION.i0 - pad; i <= SECTION.i1 + pad; i++) if (segZ(L, i)) out.push({ axis: 'z', L, at: L * P, a: i * P, b: (i + 1) * P, hw: hwZ(L), name: ZNAME[L] || 'County Rd' });
  return out;
}
// the four sides of a block interior: which ones front a street (and that street's name)
export function frontages(b) {
  const { i, j, R } = b;
  return {
    '-z': segZ(j, i) ? ZNAME[j] : null, '+z': segZ(j + 1, i) ? ZNAME[j + 1] : null,
    '-x': segX(i, j) ? XNAME[i] : null, '+x': segX(i + 1, j) ? XNAME[i + 1] : null,
  };
}

// pass 1c: any block of the island by index (the same descriptor blocks() makes), the urban universe for stress mode, and the
// road segments bounding a block (for per-block traffic in the build workers)
export function blockAt(i, j) {
  const k = kindAt(i, j), R = interior(i, j), b = { i, j, k, dist: distOf(k), R, core: inSection(i, j), place: PLACES.find(p => p.kind !== 'corner' && Math.floor(p.x / P) === i && Math.floor(p.z / P) === j) || null };
  b.F = frontages(b); b.HW = { '-z': hwZ(j), '+z': hwZ(j + 1), '-x': hwX(i), '+x': hwX(i + 1) };
  b.AVE = { '-z': isAve('z', j), '+z': isAve('z', j + 1), '-x': isAve('x', i), '+x': isAve('x', i + 1) };   // (SPREAD: each side's street class)
  return b;
}
export function urbanBlocks() { const out = []; for (let i = -32; i < 32; i++) for (let j = -32; j < 32; j++) { const k = kindAt(i, j); if (urban(k)) out.push([i, j]); } return out; }
export function ringBlocks(pad = 4) { const out = []; for (let i = SECTION.i0 - pad; i <= SECTION.i1 + pad; i++) for (let j = SECTION.j0 - pad; j <= SECTION.j1 + pad; j++) { if (inSection(i, j)) continue; if (urban(kindAt(i, j))) out.push([i, j]); } return out; }
export function roadsOf(i, j) {
  const out = [];
  for (const L of [i, i + 1]) if (segX(L, j)) out.push({ axis: 'x', L, at: L * P, a: j * P, b: (j + 1) * P, hw: hwX(L), name: XNAME[L] || 'County Rd' });
  for (const L of [j, j + 1]) if (segZ(L, i)) out.push({ axis: 'z', L, at: L * P, a: i * P, b: (i + 1) * P, hw: hwZ(L), name: ZNAME[L] || 'County Rd' });
  return out;
}
export const isHero = b => 'WCSPB'.includes(b.k) && b.core || b.place?.kind === 'store';
