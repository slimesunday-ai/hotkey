// Ground from the plan: asphalt, 0.2 raised block slabs (sidewalk ring + lots), curbs, lane paint, fat toon zebra crossings.
// A fine texture (10 px/unit = the city voxel) covers the section + one ring; a coarse one (2 px/unit) runs out to the bay.
import * as THREE from 'three';
import { P, kindAt, urban, segX, segZ, hwX, hwZ, swX, swZ, isAve, isHwy, interior, SPREAD } from './plan.js';
import { PAL, SIDE } from './style.js';
import { kitFor } from './modules.js';
import { isOneWay, oneWayDir } from './traffic/rules.js';
import { createLamps } from './traffic/lamps.js';
import { paintedTexture } from './canvastex.js';
import { createWear, createSteam, WEAR_OFF } from './groundwear.js';
import { TOD } from './kit.js';
const hex = c => '#' + c.toString(16).padStart(6, '0');
const FINE = { X0: -128, Z0: -128, W: 256, D: 192, R: 10 }, COARSE = { X0: -640, Z0: -512, W: 1280, D: 960, R: 2 };
const GRASS = 0x4fae4f, SEA = 0x2f86d8;
// slab rect of a block (the part not taken by asphalt)
export function slab(i, j) { return { x0: i * P + (segX(i, j) ? hwX(i) : 0), x1: (i + 1) * P - (segX(i + 1, j) ? hwX(i + 1) : 0), z0: j * P + (segZ(j, i) ? hwZ(j) : 0), z1: (j + 1) * P - (segZ(j + 1, i) ? hwZ(j + 1) : 0) }; }
// the corner lamps of a block (street.js cornerKit stamps them; main.js lends the night lights to the ones nearest the camera): the pole's
// [x, z, rot] (a lamp faces the street its corner meets first; its head hangs LAMP_REACH m out over the road) — cleanup pass
export const LAMP_REACH = 1.7;
export function cornerLamps(i, j) { const s = slab(i, j), hasW = segX(i, j), hasE = segX(i + 1, j), hasN = segZ(j, i), hasS = segZ(j + 1, i), cw = .35, out = [];
  if (hasN && hasW) out.push([s.x0 + cw, s.z0 + 2.6, 3]); if (hasN && hasE) out.push([s.x1 - 2.6, s.z0 + cw, 2]);
  if (hasS && hasE) out.push([s.x1 - cw, s.z1 - 2.6, 1]); if (hasS && hasW) out.push([s.x0 + 2.6, s.z1 - cw, 0]);
  return out; }
// every post standing in a block's corner squares — its lamps and its signal posts (street.js cornerKit) — as [x, z, radius] (what a
// corner hotspot, simstate/layer.js, keeps clear of)
export function cornerPosts(i, j) { const out = cornerLamps(i, j).map(([x, z]) => [x, z, .3]); for (const q of signalPoles(i, j)) out.push([q.x, q.z, .35]); return out; }
// kerb props pass (2026-10-09) · WHERE A DEALING CORNER'S HOTSPOT STANDS (simassets hotspot, 3.2 × 3.1 m: drawn at run time by
// simstate/layer.js hotspotAt, kept clear by stands.js, reserved by jobs.js). It stepped at most 1.5 m along the diagonal from a fixed
// 4.4 / 4.3 m off the node and, finding no clear step, fell back to the first: at SPREAD 4 Grand & 1st's couch stood through its signal
// pole and lamp, and four hotspots stepped into their corner's building. Now it is measured from the corner's own kerbs (the slab) and
// lot lines (interior): wholly on the slab, never over the road; clear of the posts (+ 0.35 m: the umbrella and crates spread past the
// base); as little past the lot lines as the walks allow (an avenue's 4 m walk holds it whole, a 3 m one leaves 0.2 m); then nearest
// the corner. Quadrant and turn as before: the quadrant toward the section's centre (the far one at a corner kit's corner), +z toward
// the street corner. → [x, z, rot, qx, qz, compact]; no spot clear of the posts at all → the old spot. At SPREAD 0 (today's city,
// byte for byte: SPREAD.md) the old placement stands, and nothing is reserved.
// The compact set (2026-10-09, simassets street.js: the same pieces, 3.2 × 2.6 m) stands where the full set can't keep in front of
// the lot lines and it can (or comes nearer): the boxed-in 3 m corners, whose full set's back row stood in the corner building.
export const HOTSPOT_BOX = [-1.6, -1.5, 1.6, 1.6];   // (simassets SIZES.hotspot box: x0 z0 x1 z1 at quarter turn 0)
export const HOTSPOT_COMPACT_BOX = [-1.6, -1.3, 1.6, 1.3];   // (SIZES.hotspot.compact.box)
export const hotspotBox = compact => compact ? HOTSPOT_COMPACT_BOX : HOTSPOT_BOX;
const HOT = new Map(), hotPosts = (i, j) => { const out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...cornerPosts(i + a, j + b)); return out; };
const clearOfPosts = (posts, x, z, hz = 1.65) => { for (const [px, pz, r] of posts) if (Math.hypot(Math.max(Math.abs(px - x) - 1.65, 0), Math.max(Math.abs(pz - z) - hz, 0)) < r + .35) return false; return true; };
function hotFrame(c, kit) {   // the quadrant's block, turn, kerbs and walk widths
  const qx = (c.x > 0 ? -1 : 1) * (kit ? -1 : 1), qz = (c.z > 0 ? -1 : 1) * (kit ? -1 : 1), rot = qz < 0 ? 0 : 2;
  const Lx = Math.round(c.x / P), Lz = Math.round(c.z / P), i = qx > 0 ? Lx : Lx - 1, j = qz > 0 ? Lz : Lz - 1, s = slab(i, j), R = interior(i, j);
  const kx = qx > 0 ? s.x0 : s.x1, kz = qz > 0 ? s.z0 : s.z1, wx = qx > 0 ? R.x0 - kx : kx - R.x1, wz = qz > 0 ? R.z0 - kz : kz - R.z1;
  return { qx, qz, rot, i, j, kx, kz, wx, wz }; }
// the best spot for a set of box B (hz: its half-depth, + 0.05, for the posts) → [x, z, score, past] (past: 0.05 m steps beyond the lot lines)
function hotSearch(F, posts, B, hz) {
  const { qx, qz, rot, kx, kz, wx, wz } = F;
  const zs = rot === 0 ? [B[1], B[3]] : [-B[3], -B[1]], b0 = Math.min(qz * zs[0], qz * zs[1]), b1 = Math.max(qz * zs[0], qz * zs[1]);   // its reach across the E–W walk
  let best = null;
  for (let a = 1.65; a <= wx + 7; a += .1) for (let b = .05 - b0; b <= wz + 7; b += .1) {   // a, b: metres out from the N–S and the E–W kerb
    const x = kx + qx * a, z = kz + qz * b; if (!clearOfPosts(posts, x, z, hz)) continue;
    const d = Math.round(Math.min(Math.max(0, a + B[2] - wx), Math.max(0, b + b1 - wz)) / .05), score = d * 1000 + a + b;   // past the lot lines, then the way from the corner
    if (!best || score < best[2]) best = [x, z, score, d]; }
  return best; }
export function hotspotSpot(c, kit) {
  const key = c.x + ',' + c.z + ',' + (kit ? 1 : 0); if (HOT.has(key)) return HOT.get(key).slice();
  const F = hotFrame(c, kit), { qx, qz, rot, i, j } = F, posts = hotPosts(i, j);
  if (!SPREAD) { let x = c.x + qx * 4.4, z = c.z + qz * 4.3; for (const t of [0, .3, .6, .9, 1.2, 1.5]) if (clearOfPosts(posts, c.x + qx * (4.4 + t), c.z + qz * (4.3 + t))) { x = c.x + qx * (4.4 + t); z = c.z + qz * (4.3 + t); break; }
    const old = [x, z, rot, qx, qz]; HOT.set(key, old); return old.slice(); }
  let best = hotSearch(F, posts, HOTSPOT_BOX, 1.65), compact = false;
  if (best && best[3] > 0) { const t = hotSearch(F, posts, HOTSPOT_COMPACT_BOX, 1.35); if (t && t[3] < best[3]) { best = t; compact = true; } }   // (the full set past a lot line: the compact one, where it keeps nearer)
  const out = best ? [best[0], best[1], rot, qx, qz, compact] : [c.x + qx * 4.4, c.z + qz * 4.3, rot, qx, qz, false];
  HOT.set(key, out); return out.slice(); }
// its footprint on the walks (world boxes, y from the slab): the part in front of the lot lines, the strip along each street — what
// jobs.js reserves (the few centimetres past a lot line are the lot's: its facade is built as it was)
export function hotspotKeep(c, kit) {
  if (!SPREAD) return [];
  const [x, z, rot, , , compact] = hotspotSpot(c, kit), { qx, qz, kx, kz, wx, wz } = hotFrame(c, kit), B = hotspotBox(compact), zs = rot === 0 ? [B[1], B[3]] : [-B[3], -B[1]];
  const f = [x + B[0], z + zs[0], x + B[2], z + zs[1]], lx = kx + qx * wx, lz = kz + qz * wz, out = [];
  const X = qx > 0 ? [f[0], Math.min(f[2], lx)] : [Math.max(f[0], lx), f[2]], Z = qz > 0 ? [f[1], Math.min(f[3], lz)] : [Math.max(f[1], lz), f[3]];
  if (X[1] > X[0]) out.push([X[0], SIDE, f[1], X[1], SIDE + 2.6, f[3]]);   // in front of the N–S street's lot line
  if (Z[1] > Z[0]) out.push([f[0], SIDE, Z[0], f[2], SIDE + 2.6, Z[1]]);   // in front of the E–W street's
  return out; }
// streets pass · THE SIGNAL POLES. Every node (Lx, Lz) where an N–S and an E–W road meet has a pole in its NW corner (block Lx−1, Lz−1's SE
// corner, stamped at quarter turn 0) and one in its SE corner (block Lx, Lz's NW corner, turn 2), 0.45 m in from both curbs, as before.
// Each pole carries a four-faced head on top (the ±z faces show the N–S phase, the ±x faces the E–W phase: every approach sees a near and
// a far head), a WALK / DON'T WALK box on its local +x side (facing across the crossing over the N–S road) and one on its local +z side
// (across the crossing over the E–W road). At an avenue a pole is a mast: an arm over the avenue with a double-faced head over its inner
// lane (both avenues: the NW pole spans the N–S one, the SE pole the E–W one). A one-way side street's ONE WAY sign hangs on the pole under
// the head (both one-way: the NW pole signs the N–S street, the SE pole the E–W one). street.js authors the voxels from SIG, and
// traffic/lamps.js lights the lenses and icons from the same numbers, so what glows sits exactly in what is baked.
// SIG: metres, in the pole's own frame (turn 0) above its foot. Lenses are 0.3 m, red on top; `face` is where a head's front plane is.
export const SIG = { lensY: [4.45, 3.95, 3.45], face: .35, mastY: [4.95, 4.45, 3.95], mastFace: .25, pedY: 2.55, pedFace: .45, owY: 2.85, dneY: 2.35 };
export function signalPoles(i, j) { const s = slab(i, j), out = [];
  if (segZ(j, i) && segX(i, j)) out.push(poleAt(i, j, s.x0 + .45, s.z0 + .45, 2));
  if (segZ(j + 1, i) && segX(i + 1, j)) out.push(poleAt(i + 1, j + 1, s.x1 - .45, s.z1 - .45, 0));
  return out; }
function poleAt(Lx, Lz, x, z, rot) { const nw = rot === 0, aNS = isAve('x', Lx), aEW = isAve('z', Lz), oNS = isOneWay('x', Lx), oEW = isOneWay('z', Lz);
  const span = aNS && aEW ? (nw ? 'ns' : 'ew') : aNS ? 'ns' : aEW ? 'ew' : null, reach = span ? (span === 'ns' ? hwX(Lx) : hwZ(Lz)) - .5 : 0;   // (the head over the inner lane)
  const ow = oNS && oEW ? (nw ? 'ns' : 'ew') : oNS ? 'ns' : oEW ? 'ew' : null;
  return { Lx, Lz, x, z, rot, span, reach, ow, owDir: ow ? oneWayDir(ow === 'ns' ? 'x' : 'z', ow === 'ns' ? Lx : Lz) : 0 }; }
// the wrong-way ends of one-way streets: a DO NOT ENTER sign on the corner lamp at the end where the traffic leaves the block, facing the
// intersection (street.js cornerKit) — [lamp index in cornerLamps(i, j), the world direction it faces as a quarter turn of +z]
export function dneSigns(i, j) { const hasW = segX(i, j), hasE = segX(i + 1, j), hasN = segZ(j, i), hasS = segZ(j + 1, i), out = []; let k = 0;
  if (hasN && hasW) { if (isOneWay('x', i) && oneWayDir('x', i) < 0) out.push([k, 2]); k++; }        // NW lamp: the west street's north end
  if (hasN && hasE) { if (isOneWay('z', j) && oneWayDir('z', j) > 0) out.push([k, 1]); k++; }        // NE lamp: the north street's east end
  if (hasS && hasE) { if (isOneWay('x', i + 1) && oneWayDir('x', i + 1) > 0) out.push([k, 0]); k++; } // SE lamp: the east street's south end
  if (hasS && hasW) { if (isOneWay('z', j + 1) && oneWayDir('z', j + 1) < 0) out.push([k, 3]); k++; } // SW lamp: the south street's west end
  return out; }

// black-ground fix (2026-10-06) · a GPU-process reset blanked these canvases and three re-uploaded them black (canvastex.js): the
// canvas is a pure function of (T, detail), so it is repainted on restore; a disposed tile's canvas is released at once
// ground pass (2026-10-06) · PAINT_STATS: what painting costs (ms per canvas, fillRects of wear), read by the ground shots' probe
export const PAINT_STATS = { fine: [], coarse: null, rects: [] };
const PROBE = typeof location !== 'undefined' && /[?&]groundprobe=1/.test(location.search || '');   // (+ the raster: read a pixel back so the canvas flushes inside the timing)
function paint(T, detail) {
  const tex = paintedTexture(T.W * T.R, T.D * T.R, g => { const t0 = performance.now(), n = draw(g, T, detail); if (PROBE) g.getImageData(0, 0, 1, 1); const ms = performance.now() - t0;
    if (detail) { PAINT_STATS.fine.push(+ms.toFixed(2)); PAINT_STATS.rects.push(n); if (PAINT_STATS.fine.length > 64) { PAINT_STATS.fine.shift(); PAINT_STATS.rects.shift(); } } else PAINT_STATS.coarse = +ms.toFixed(2); }, { release: true });
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = detail ? THREE.NearestFilter : THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; return tex;
}
function draw(g, T, detail) {
  const px = x => (x - T.X0) * T.R, pz = z => (z - T.Z0) * T.R, rect = (x0, z0, x1, z1, c) => { g.fillStyle = hex(c); g.fillRect(Math.round(px(x0)), Math.round(pz(z0)), Math.max(1, Math.round((x1 - x0) * T.R)), Math.max(1, Math.round((z1 - z0) * T.R))); };
  // ground pass · the handmade ground (groundwear.js): road wear under the paint, chips over it, sidewalk wear, then the covers
  const WR = createWear(T, detail), line = (x0, z0, x1, z1, c) => { rect(x0, z0, x1, z1, c); WR.chipLine(x0, z0, x1, z1); };
  // streets pass · one-way arrows: a straight NYC arrow 3.4 m long, painted in the middle of the street 3.5 m past the crossing at each end
  // of the block, pointing the way the traffic runs (dx, dz: ±1 on the street's axis)
  const arrow = (xc, zc, dx, dz) => { const L = [[-1.7, -.18], [.45, -.18], [.45, -.56], [1.7, 0], [.45, .56], [.45, .18], [-1.7, .18]];
    g.fillStyle = hex(PAL.lineW); g.beginPath(); L.forEach(([a, b], k) => { const x = xc + a * dx - b * dz, z = zc + a * dz + b * dx; k ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z)); }); g.closePath(); g.fill(); };
  const arrowsAlong = (a0, a1, h0, h1) => [[a0 + h0 + 2 + 5.1], [a1 - h1 - 2 - 5.1]];
  rect(T.X0, T.Z0, T.X0 + T.W, T.Z0 + T.D, PAL.asphalt);
  const i0 = Math.floor(T.X0 / P), i1 = Math.floor((T.X0 + T.W - 1) / P), j0 = Math.floor(T.Z0 / P), j1 = Math.floor((T.Z0 + T.D - 1) / P);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = kindAt(i, j);
    if (k === '~') { rect(i * P, j * P, (i + 1) * P, (j + 1) * P, SEA); continue; }
    if (!urban(k)) { const kg = kitFor(i, j)?.ground; if (kg) { try { kg(i, j, rect, detail ? 1 : 4); continue; } catch (e) { console.warn('ground hook', i, j, e); } }   // batch 4: a kit paints its non-urban blocks' ground (the woods: the coast, the lake, the edge roads' woods half)
      rect(i * P, j * P, (i + 1) * P, (j + 1) * P, GRASS); continue; }
    const s = slab(i, j); rect(s.x0, s.z0, s.x1, s.z1, PAL.walk);
    const inner = interior(i, j), wW = swX(i), wE = swX(i + 1), wN = swZ(j), wS = swZ(j + 1);   // (SPREAD: the lot line; each side's own sidewalk)
    rect(inner.x0, inner.z0, inner.x1, inner.z1, 'sPp'.includes(k) ? PAL.yard : PAL.lot);
    if (detail) { g.fillStyle = hex(PAL.joint);
      for (let x = s.x0 + 1.5; x < s.x1; x += 1.5) { g.fillRect(Math.round(px(x)), Math.round(pz(s.z0)), 1, Math.round(wN * T.R)); g.fillRect(Math.round(px(x)), Math.round(pz(s.z1 - wS)), 1, Math.round(wS * T.R)); }
      for (let z = s.z0 + 1.5; z < s.z1; z += 1.5) { g.fillRect(Math.round(px(s.x0)), Math.round(pz(z)), Math.round(wW * T.R), 1); g.fillRect(Math.round(px(s.x1 - wE)), Math.round(pz(z)), Math.round(wE * T.R), 1); }
      if (segX(i, j)) rect(s.x0, s.z0, s.x0 + .2, s.z1, PAL.curbTop); if (segX(i + 1, j)) rect(s.x1 - .2, s.z0, s.x1, s.z1, PAL.curbTop);
      if (segZ(j, i)) rect(s.x0, s.z0, s.x1, s.z0 + .2, PAL.curbTop); if (segZ(j + 1, i)) rect(s.x0, s.z1 - .2, s.x1, s.z1, PAL.curbTop); } }
  WR.walks(g, slab); WR.road(g);
  // lane paint: avenues get double yellow + dashed white lanes; streets a dashed yellow centre line — broken at crossings
  for (let L = i0; L <= i1 + 1; L++) for (let j = j0; j <= j1; j++) { if (!segX(L, j)) continue; const x = L * P, hw = hwX(L);
    for (let z = j * P; z < (j + 1) * P; z += detail ? .5 : 2) { const Lz = Math.round(z / P), dz = Math.abs(z - Lz * P); if (dz < hwZ(Lz) + 2.2 && (segZ(Lz, L - 1) || segZ(Lz, L))) continue;
      if (isAve('x', L)) { line(x - .3, z, x - .12, z + .5, PAL.lineY); line(x + .12, z, x + .3, z + .5, PAL.lineY); if (((z * 2) | 0) % 6 < 3) { line(x - 2.05, z, x - 1.95, z + .5, PAL.lineW); line(x + 1.95, z, x + 2.05, z + .5, PAL.lineW); } }
      else if (!isOneWay('x', L) && ((z * 2) | 0) % 6 < 3) line(x - .08, z, x + .08, z + .5, PAL.lineY); }
    if (detail && isOneWay('x', L)) { const d = oneWayDir('x', L); for (const [zc] of arrowsAlong(j * P, (j + 1) * P, hwZ(j), hwZ(j + 1))) arrow(x, zc, 0, d); } }
  for (let L = j0; L <= j1 + 1; L++) for (let i = i0; i <= i1; i++) { if (!segZ(L, i)) continue; const z = L * P, hw = hwZ(L);
    for (let x = i * P; x < (i + 1) * P; x += detail ? .5 : 2) { const Lx = Math.round(x / P), dx = Math.abs(x - Lx * P); if (dx < hwX(Lx) + 2.2 && (segX(Lx, L - 1) || segX(Lx, L))) continue;
      if (isAve('z', L)) { line(x, z - .3, x + .5, z - .12, PAL.lineY); line(x, z + .12, x + .5, z + .3, PAL.lineY); if (((x * 2) | 0) % 6 < 3) { line(x, z - 2.05, x + .5, z - 1.95, PAL.lineW); line(x, z + 1.95, x + .5, z + 2.05, PAL.lineW); } }
      else if (!isOneWay('z', L) && ((x * 2) | 0) % 6 < 3) line(x, z - .08, x + .5, z + .08, PAL.lineY); }
    if (detail && isOneWay('z', L)) { const d = oneWayDir('z', L); for (const [xc] of arrowsAlong(i * P, (i + 1) * P, hwX(i), hwX(i + 1))) arrow(xc, z, d, 0); } }
  if (detail) {
    // zebra crossings in the plan's crossing bands (hw … hw+2 off the cross street), bars parallel to traffic
    for (let Lx = i0; Lx <= i1 + 1; Lx++) for (let Lz = j0; Lz <= j1 + 1; Lz++) {
      const ns = segX(Lx, Lz - 1) || segX(Lx, Lz), ew = segZ(Lz, Lx - 1) || segZ(Lz, Lx); if (!ns || !ew) continue; const x = Lx * P, z = Lz * P, hx = hwX(Lx), hz = hwZ(Lz);
      const bar = (ax, L, x0, z0, x1, z1) => { rect(x0, z0, x1, z1, PAL.lineW); WR.chipBar(ax, L, x0, z0, x1, z1); };   // (ground pass: every bar chipped, worn through in the wheel tracks)
      for (const sz of [-1, 1]) { if (!segX(Lx, sz < 0 ? Lz - 1 : Lz)) continue; const za = z + sz * hz, zb = z + sz * (hz + 2); for (let b = x - hx + .15; b < x + hx - .2; b += .9) bar('x', Lx, b, Math.min(za, zb) + .1, b + .5, Math.max(za, zb) - .1);
        if (!isOneWay('x', Lx) || sz === -oneWayDir('x', Lx)) bar('x', Lx, x - hx, sz < 0 ? zb - .45 : zb + .1, x + hx, sz < 0 ? zb - .1 : zb + .45); }   // (a one-way: the stop bar on the side its traffic comes from)
      for (const sx of [-1, 1]) { if (!segZ(Lz, sx < 0 ? Lx - 1 : Lx)) continue; const xa = x + sx * hx, xb = x + sx * (hx + 2); for (let b = z - hz + .15; b < z + hz - .2; b += .9) bar('z', Lz, Math.min(xa, xb) + .1, b, Math.max(xa, xb) - .1, b + .5);
        if (!isOneWay('z', Lz) || sx === -oneWayDir('z', Lz)) bar('z', Lz, sx < 0 ? xb - .45 : xb + .1, z - hz, sx < 0 ? xb - .1 : xb + .45, z + hz); } }
    WR.chips(g);
  }
  WR.covers(g);   // (ground pass: replaces section 1's 90 scattered patches and round manholes with the island-wide wear above)
  return WR.stats.rects;
}
function plane(T, x0, z0, x1, z1, y, pos, uv, idx) { const b = pos.length / 3, u = (x, z) => [(x - T.X0) / T.W, 1 - (z - T.Z0) / T.D];
  pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1); uv.push(...u(x0, z0), ...u(x1, z0), ...u(x1, z1), ...u(x0, z1)); idx.push(b, b + 3, b + 2, b, b + 2, b + 1); }
function mesh(pos, uv, idx, mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => k % 3 === 1 ? 1 : 0), 3)); g.setIndex(idx); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
// stitch pass · THE SEA TO THE HORIZON. The coarse plane ends 50–150 m past the island's coasts (z 448 in the south), and past its edge
// the camera saw the sky's lower half: a hard line where the sea stopped. Eight quads round the plane (a 3 × 3 grid out to SEA_R, its
// centre cell the plane itself: every shared edge whole, no overlap, so no z-fighting) at the plane's height, in the plane's own mesh and
// material: no draw call, no shader, no build job. Every vertex samples one texel of the plane's texture inside the open bay (a '~'
// block, painted SEA), so the ring is the bay's water exactly (under the same light, fog and shadows); the haze dissolves it into the sky.
export const SEA_R = 4000;   // the camera's far plane: the haze has closed long before (≤ 900 m, the stress view)
function seaRing(pos, uv, idx) {
  const T = COARSE, xs = [-SEA_R, T.X0, T.X0 + T.W, SEA_R], zs = [-SEA_R, T.Z0, T.Z0 + T.D, SEA_R], u = (40.25) / T.W, v = 1 - (32.25) / T.D;   // the texel at (−600, −480)
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if (a === 1 && b === 1) continue; const n = pos.length / 3, [x0, x1, z0, z1] = [xs[a], xs[a + 1], zs[b], zs[b + 1]];
    pos.push(x0, -0.01, z0, x1, -0.01, z0, x1, -0.01, z1, x0, -0.01, z1); uv.push(u, v, u, v, u, v, u, v); idx.push(n, n + 3, n + 2, n, n + 2, n + 1); }
}
// (subway stations agent, 2026-10-08) STAIRWELL HOLES. A station's flight goes down below the slab (transit.js stairwell), so the
// ground planes are cut where its opening is: a fragment of the asphalt or of a slab inside a hole rect is discarded — within HOLE_R m of
// the camera (past it the far tier has no well, and the ground draws over the opening). The rects come with the blocks' anchors
// (anchors.holes, main.js onAnchors → addHoles); at most HOLE_N at once (the city has 8 stations).
export const HOLE_N = 16, HOLE_R = 180;
const HOLES = { rects: null, n: { value: 0 } }, holeKeys = new Map();   // (the uniforms are made with the ground: this module also loads in the build workers)
function applyHoles() { if (!HOLES.rects) return; const all = [...holeKeys.values()].flat().slice(0, HOLE_N); all.forEach((r, k) => HOLES.rects.value[k].set(r[0], r[1], r[2], r[3])); HOLES.n.value = all.length; }
export function addHoles(key, rects) { holeKeys.set(key, rects || []); applyHoles(); }
export const holeRects = () => [...holeKeys.values()].flat();
function holed(mat) {
  if (!HOLES.rects) { HOLES.rects = { value: Array.from({ length: HOLE_N }, () => new THREE.Vector4(0, 0, -1, -1)) }; applyHoles(); }
  mat.onBeforeCompile = sh => { sh.uniforms.uHoles = HOLES.rects; sh.uniforms.uHoleN = HOLES.n;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHoleW;').replace('#include <project_vertex>', '#include <project_vertex>\n  vHoleW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vHoleW;\nuniform vec4 uHoles[${HOLE_N}];\nuniform int uHoleN;`)
      .replace('void main() {', `void main() {\n  if (uHoleN > 0 && distance(vHoleW, cameraPosition) < ${HOLE_R}.0) for (int k = 0; k < ${HOLE_N}; k++) { if (k >= uHoleN) break; vec4 h = uHoles[k]; if (vHoleW.x > h.x && vHoleW.x < h.z && vHoleW.z > h.y && vHoleW.z < h.w) discard; }`); };
  mat.customProgramCacheKey = () => 'ground-holed'; return mat; }
// pass 2 · the fine ground (10 px per metre: joints, curbs, zebra crossings, lane paint) is painted in 128 m tiles around the camera, so
// every district gets crossings at street level, not only section 1. The coarse ground (2 px per metre) covers the island under them.
export const TILE = 128;
export function ground(scene, maxAniso) {
  const texC = paint(COARSE, false); texC.anisotropy = maxAniso;
  const mC = holed(new THREE.MeshStandardMaterial({ map: texC, roughness: .95 }));
  // coarse: the asphalt plane + every block's slab (always there; fine tiles draw over it with a polygon offset)
  const cp = [], cu = [], ci = []; plane(COARSE, COARSE.X0, COARSE.Z0, COARSE.X0 + COARSE.W, COARSE.Z0 + COARSE.D, -0.01, cp, cu, ci);
  seaRing(cp, cu, ci);   // stitch pass: the sea runs on from the plane's edges to the horizon
  const sideP = [], sideC = [], sideI = [], cc = new THREE.Color(PAL.curbFace), q = (a, b, c, d) => { const n = sideP.length / 3; sideP.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) sideC.push(cc.r, cc.g, cc.b); sideI.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const i0 = Math.floor(COARSE.X0 / P), i1 = Math.floor((COARSE.X0 + COARSE.W - 1) / P), j0 = Math.floor(COARSE.Z0 / P), j1 = Math.floor((COARSE.Z0 + COARSE.D - 1) / P);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = kindAt(i, j); if (!urban(k)) continue; const s = slab(i, j);
    plane(COARSE, s.x0, s.z0, s.x1, s.z1, SIDE, cp, cu, ci);
    if (Math.abs(i * P) > 360 || Math.abs(j * P) > 360) continue;
    q([s.x0, 0, s.z1], [s.x0, 0, s.z0], [s.x0, SIDE, s.z0], [s.x0, SIDE, s.z1]); q([s.x1, 0, s.z0], [s.x1, 0, s.z1], [s.x1, SIDE, s.z1], [s.x1, SIDE, s.z0]);
    q([s.x0, 0, s.z0], [s.x1, 0, s.z0], [s.x1, SIDE, s.z0], [s.x0, SIDE, s.z0]); q([s.x1, 0, s.z1], [s.x0, 0, s.z1], [s.x0, SIDE, s.z1], [s.x1, SIDE, s.z1]); }
  const coarse = mesh(cp, cu, ci, mC); scene.add(coarse);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sideP, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(sideC, 3)); g.setIndex(sideI); g.computeVertexNormals();
  const curbs = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 })); curbs.receiveShadow = true; scene.add(curbs);
  // fine tiles: the asphalt plane (0) + the slabs inside the tile (SIDE), one texture, one draw call each
  const tiles = new Map(), key = (a, b) => a + ',' + b;
  function makeTile(ti, tj) {
    const T = { X0: ti * TILE, Z0: tj * TILE, W: TILE, D: TILE, R: 10 }, tex = paint(T, true); tex.anisotropy = maxAniso;
    const mat = holed(new THREE.MeshStandardMaterial({ map: tex, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const fp = [], fu = [], fi = []; plane(T, T.X0, T.Z0, T.X0 + TILE, T.Z0 + TILE, 0, fp, fu, fi);
    for (let i = ti * 4; i < ti * 4 + 4; i++) for (let j = tj * 4; j < tj * 4 + 4; j++) { if (!urban(kindAt(i, j))) continue; const s = slab(i, j); plane(T, s.x0, s.z0, s.x1, s.z1, SIDE, fp, fu, fi); }
    const m = mesh(fp, fu, fi, mat); scene.add(m); return m; }
  const worth = (ti, tj) => { for (let i = ti * 4; i < ti * 4 + 4; i++) for (let j = tj * 4; j < tj * 4 + 4; j++) if (urban(kindAt(i, j))) return true; return false; };
  // keep the tiles around a focus point (x, z) within r metres; build at most `budget` per call (a tile paints in ~20 ms)
  // ground pass · the night steam over a few manholes near the focus (groundwear.js createSteam; built only at night)
  const steam = TOD.night && !WEAR_OFF ? createSteam(scene) : null;
  function update(x, z, r, budget = 1) {
    steam?.focus(x, z);
    const want = new Set(); for (let ti = Math.floor((x - r) / TILE); ti <= Math.floor((x + r) / TILE); ti++) for (let tj = Math.floor((z - r) / TILE); tj <= Math.floor((z + r) / TILE); tj++) {
      const cx = (ti + .5) * TILE, cz = (tj + .5) * TILE; if (Math.hypot(Math.max(0, Math.abs(cx - x) - TILE / 2), Math.max(0, Math.abs(cz - z) - TILE / 2)) <= r && worth(ti, tj)) want.add(key(ti, tj)); }
    const near = [...want].sort((a, b) => { const [p, q] = [a, b].map(k => k.split(',').map(Number)); return Math.hypot((p[0] + .5) * TILE - x, (p[1] + .5) * TILE - z) - Math.hypot((q[0] + .5) * TILE - x, (q[1] + .5) * TILE - z); });
    want.clear(); near.slice(0, 9).forEach(k => want.add(k));   // at most nine fine tiles (≈ 80 MB of texture), nearest first
    const add = [...want].filter(k => !tiles.has(k)).map(k => k.split(',').map(Number)).sort((a, b) => Math.hypot((a[0] + .5) * TILE - x, (a[1] + .5) * TILE - z) - Math.hypot((b[0] + .5) * TILE - x, (b[1] + .5) * TILE - z));
    for (const [ti, tj] of add.slice(0, budget)) tiles.set(key(ti, tj), makeTile(ti, tj));
    for (const [k, m] of tiles) if (!want.has(k)) { const [ti, tj] = k.split(',').map(Number); if (tiles.size > 12 || Math.hypot((ti + .5) * TILE - x, (tj + .5) * TILE - z) > r * 1.5 + TILE) { m.removeFromParent(); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); tiles.delete(k); } }
    return add.length > budget; }
  // streets pass · the live signal lamps (traffic/lamps.js), made here beside the paint they belong to, so main.js needs no hook (they are
  // handed the pole layout: lamps.js never imports this module, no cycle for the build workers' bundle)
  const lamps = createLamps(scene, { poles: signalPoles, sig: SIG });
  return { coarse, curbs, update, tiles, lamps, steam };
}
