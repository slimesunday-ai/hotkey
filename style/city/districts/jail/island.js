// IRON ISLAND · the compound, block by block (owner: the water-side agent, batch 5). Worker-safe.
// Every island block draws its slice of the shared parts, then its hero adds what is its own:
//   shore      riprap round the west, north and east edges (boulders on a jittered 1 m grid, wet at the waterline, guano and lichen on
//              top), a broken line of surf where the rocks meet the bay, the north-east point pushed out round the lighthouse
//   ground     0.2 m floors: lawn outside the wall with a gravel patrol path at its foot, paving inside, the forecourt, the bus apron
//   walls      6 m of concrete round the compound (panel joints, a footing, a coping, the wire on top, lamps on brackets outside), the
//              north-east corner cut back for the point
//   towers     three guard towers on the wall's corners, each its own: a hip roof and yellow trim, a flat roof with the big lamp and red
//              trim, a steep spire and blue trim; a guard in every cab, a searchlight on every balcony, the number on the shaft
//   cells      the cell block: four tiers of barred slits, floor ledges, stair bays at the ends, IRON ISLAND painted on its roof
//   intake     where you come in and where you walk out: its steel door on the corridor to the yard's gate (the sim's jail), the control
//              cab on the roof over the yard
//   gatehouse  the sally port's gatehouse and its orange gates
//   road       the island road's north half as a deck over the core's paint, with its lane paint and the crossing at the T
import { C, CV, SIDE, TOD, REG, H, lit, mix, shade, wv, later, letters, board, wboard, wletters, signOn, px, mini, logSign, inBlock, person, doorAt } from './lib.js';
import { ISLAND, WALL, GTOWERS, LIGHT, NE_CUT, CELLS, INTAKE, VISIT, GATEHOUSE, SALLY, YARD, COURT, FORE, APRON, SHORE, JAIL, IR, DECK, WALKN } from './plan.js';
import { P0 as PITCH, SPREAD } from '../../../../world/city.js';   // (SPREAD: today's pitch — the kit authors in today's metres; lib.js maps them)

// ── the shore: metres out of the island's edge (west, north, east; the south edge is the road and the quay) and the north-east point
const PT = [[276, -384], [283, -391.5], [291.5, -392], [294, -386], [291, -377], [288, -372]];   // the point's outline round the light
function inPoly(x, z, Q) { let c = false; for (let a = 0, b = Q.length - 1; a < Q.length; b = a++) { const [xa, za] = Q[a], [xb, zb] = Q[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; }
export function edgeD(x, z) {
  const I = ISLAND; let d = Math.max(I.x0 - x, x - I.x1, I.z0 - z);
  if (d > -12 && (x > 270 && z < -366)) { if (inPoly(x, z, PT)) d = Math.min(d, -1.2); else { let m = 1e9; for (let a = 0, b = PT.length - 1; a < PT.length; b = a++) { const [xa, za] = PT[b], [xb, zb] = PT[a], vx = xb - xa, vz = zb - za, t = Math.max(0, Math.min(1, ((x - xa) * vx + (z - za) * vz) / (vx * vx + vz * vz))); m = Math.min(m, Math.hypot(x - xa - vx * t, z - za - vz * t)); } d = Math.min(d, m - 1.2); } }
  return d; }
// the rock surface at (x, z): the top of the tallest boulder over it (m above the water), or −1 where there is none
const R1 = 1.05, SOUTH = WALKN - .4;
const limAt = (x, z) => SHORE.out + (H(Math.floor(x * .7), Math.floor(z * .7), 17) - .5) * 1.2;
export function rockTop(x, z) {
  if (z > SOUTH || Math.hypot(x - LIGHT.x, z - LIGHT.z) < 2.6) return -1; const d = edgeD(x, z); if (d > SHORE.out + 1.8 || d < -SHORE.in - 1.5) return -1;
  const a0 = Math.floor(x / R1), b0 = Math.floor(z / R1); let best = -1;
  for (let a = a0 - 1; a <= a0 + 1; a++) for (let b = b0 - 1; b <= b0 + 1; b++) {
    const cx = (a + .15 + H(a, b, 31) * .7) * R1, cz = (b + .15 + H(a, b, 32) * .7) * R1; if (cz > SOUTH) continue;
    const band = (edgeD(cx, cz) + SHORE.in) / (SHORE.in + limAt(cx, cz)); if (band < 0 || band > 1) continue;
    const r = .55 + H(a, b, 33) * .45, q = Math.hypot(x - cx, z - cz) / r; if (q >= 1) continue;
    const hb = (.35 + 1.05 * Math.sin(Math.PI * Math.pow(band, .75))) * (.75 + H(a, b, 34) * .5), h = hb * Math.sqrt(1 - q * q); if (h > best) best = h; }
  return best; }
const boulderOf = (x, z) => H(Math.floor(x / R1), Math.floor(z / R1), 35);
// which block draws a point of the shore: its own square on the island; outside the island, the block the point faces along the edge
function owns(ctx, x, z) { const I = ISLAND; if (x >= I.x0 && x < I.x1 && z >= I.z0 && z < I.z1) return inBlock(ctx, x, z);
  const cx = Math.min(I.x1 - .01, Math.max(I.x0, x)), cz = Math.min(I.z1 - 2.6, Math.max(I.z0, z)); return inBlock(ctx, cx, cz); }
export function shore(ctx) {
  const I = ISLAND, x0 = ctx.i * PITCH, z0 = ctx.j * PITCH, x1 = x0 + PITCH, z1 = z0 + PITCH, g = 5; if (!(x0 === I.x0 || z0 === I.z0 || x1 === I.x1)) return;
  const pt = x1 === I.x1 && z0 === I.z0;   // the north-east block carries the point
  const W = wv(ctx, [x0 - (x0 === I.x0 ? g : 0), z0 - (z0 === I.z0 ? (pt ? 10 : g) : 0), x1 + (x1 === I.x1 ? (pt ? 8 : g) : 0), Math.min(z1, SOUTH + 1)], -.5, 2.1, { s: .2, out: 12 }); if (!W) return;
  const V = W.V, T = new Float32Array(V.nx * V.nz).fill(-1);
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k); if (owns(ctx, x, z)) T[i + k * V.nx] = rockTop(x, z); else T[i + k * V.nx] = -2; }
  const at = (i, k) => (i >= 0 && k >= 0 && i < V.nx && k < V.nz) ? T[i + k * V.nx] : -1;
  const F = wv(ctx, [W.ux0, W.uz0, W.ux1, W.uz1], -.1, .1, { s: .2, out: 12 }); let foam = false;   // (SPREAD: W's own bounds, in today's metres)
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const t = T[i + k * V.nx], x = W.wx(i), z = W.wz(k); if (t === -2) continue;
    if (t < 0) {   // surf: a broken white line where the rocks meet the water, a paler one a little further out
      if (x >= I.x0 && x < I.x1 && z >= I.z0 && z < I.z1) continue; let near = 9;
      for (const [di, dk, d] of [[3, 0, .6], [-3, 0, .6], [0, 3, .6], [0, -3, .6], [2, 2, .57], [-2, 2, .57], [2, -2, .57], [-2, -2, .57], [6, 0, 1.2], [-6, 0, 1.2], [0, 6, 1.2], [0, -6, 1.2]]) if (at(i + di, k + dk) >= 0) near = Math.min(near, d);
      const n = H(Math.floor(x * 2.5), Math.floor(z * 2.5), 41);
      if (near <= .6 && n > .16) { F.V.set(i, 0, k, n > .55 ? C.foam : C.foam2); foam = true; } else if (near <= 1.2 && n > .6) { F.V.set(i, 0, k, C.foam2); foam = true; }
      continue; }
    const top = Math.max(1, Math.min(V.ny, Math.round((t + .5) / .2))), base = C.rock[(boulderOf(x, z) * C.rock.length) | 0];
    for (let y = 0; y < top; y++) { const wy = -.5 + (y + .5) * .2; let c = base;
      if (wy < .12) c = C.wet; else if (wy < .3) c = mix(base, C.wet, .45);
      if (y === top - 1 && wy > .2) { const h2 = H(i * 7 + ctx.i * 131, k * 3 + ctx.j * 71, 43); if (h2 < .05) c = C.guano; else if (h2 < .1) c = C.lichen; else if (h2 < .16) c = shade(base, 1.08); }
      V.set(i, y, k, c); } }
  later(ctx, W, { walk: true }); if (foam) later(ctx, F); ctx.J.rock = W; ctx.J.rockT = { W, T };
}
// a spot on top of the rocks (for a gull, a sign): the highest cell near (x, z) → [x, y, z] or null
export function onRocks(ctx, x, z) { const R = ctx.J.rockT; if (!R) return null; const { W, T } = R, i = W.X(x), k = W.Z(z); let best = null;
  const topAt = (a, b) => (a < 0 || b < 0 || a >= W.V.nx || b >= W.V.nz) ? -9 : Math.max(1, Math.min(W.V.ny, Math.round((T[a + b * W.V.nx] + .5) / .2)));
  for (let a = i - 5; a <= i + 5; a++) for (let b = k - 5; b <= k + 5; b++) { const top = topAt(a, b); if (top < 6) continue; let flat = true;
    for (let da = -2; da <= 2 && flat; da++) for (let db = -3; db <= 3; db++) if (topAt(a + da, b + db) !== top) { flat = false; break; }
    const y = -.5 + top * .2; if (flat && (!best || y > best[1])) best = [W.wx(a), y, W.wz(b)]; }   // (SPREAD: today's metres)
  return best; }

// ── what stands where (the floors keep clear of it)
const T_SH = 1.4, T_CAB = 2.2;
export const WALLS = (() => { const W = WALL, t = W.t / 2, out = [];
  out.push([W.x0 - t, W.z0 + T_SH, W.x0 + t, W.z1 - T_SH]);                                   // west
  out.push([W.x0 + T_SH, W.z0 - t, W.x1 - NE_CUT, W.z0 + t]);                                 // north, to the cut
  out.push([W.x1 - t, W.z0 + NE_CUT, W.x1 + t, W.z1 - T_SH]);                                 // east, from the cut
  for (const [a, b] of [[W.x0 + T_SH, VISIT.r[0]], [VISIT.r[2], SALLY.x0], [SALLY.x1, GATEHOUSE.r[0]], [GATEHOUSE.r[2], W.x1 - T_SH]]) out.push([a, W.z1 - t, b, W.z1 + t]);   // south, between the buildings
  return out; })();
const cutAt = z => WALL.x1 - NE_CUT + (z - WALL.z0);   // the cut: a 45° wall from (x1 − cut, z0) to (x1, z0 + cut)
const inCut = (x, z) => z > WALL.z0 - .6 && z < WALL.z0 + NE_CUT + .6 && x > WALL.x1 - NE_CUT - .8 && x < WALL.x1 + .8 && Math.abs(x - cutAt(z)) < .75;
const inR = (x, z, r, m = 0) => x >= r[0] - m && x < r[2] + m && z >= r[1] - m && z < r[3] + m;
const FOOT = [CELLS.r, INTAKE.r, VISIT.r, GATEHOUSE.r, ...WALLS, ...GTOWERS.map(t => [t.x - T_SH, t.z - T_SH, t.x + T_SH, t.z + T_SH]), [LIGHT.x - 2.2, LIGHT.z - 2.2, LIGHT.x + 2.2, LIGHT.z + 2.2], COURT.r];
export const inside = (x, z) => x > WALL.x0 + .5 && x < WALL.x1 - .5 && z > WALL.z0 + .5 && z < WALL.z1 - .5 && x < cutAt(z) - .5;

// ── the floors: one 0.2 m layer (y 0.1 … 0.3) over the block's part of the island, by zone
export function floorColour(x, z) {
  if (FOOT.some(r => inR(x, z, r)) || inCut(x, z) || WALLS.some(r => inR(x, z, r, .05))) return null;
  if (edgeD(x, z) > -.1 || rockTop(x, z) >= 0) return null;
  const q = (Math.floor(x / 1.2) + Math.floor(z / 1.2)) & 1, n = H(Math.floor(x * 2), Math.floor(z * 2), 51);
  if (inR(x, z, FORE.r)) return (Math.floor(x / .8) + Math.floor(z / .8)) & 1 ? C.concL : C.conc;               // the forecourt: square pavers
  if (x >= SALLY.x0 && x < SALLY.x1 && z > WALL.z1 - 1.2 && z < WALL.z1 + .8) return C.asph;                          // the drive through the gate
  if (inR(x, z, APRON.r) && z > WALL.z1 + .5) { if (Math.abs(z + 297.8) < .12 && x > 259) return C.lineY; return n > .96 ? C.asphD : C.asph; }   // the bus apron: asphalt, a yellow line
  if (inside(x, z)) {
    if (inR(x, z, YARD.r)) return n > .97 ? C.asphD : 0x5a5c68;                                                 // the yard: old asphalt
    if (x > 230.5 && x < 256.5 && z > -325 && z < -313) { const u = ((x - 232) % 3.2 + 3.2) % 3.2; if (z > -324 && z < -319 && u < .2) return C.lineW; return n > .97 ? C.asphD : C.asph; }   // the staff lot
    if (x > 258 && z > -316) return n > .96 ? C.asphD : C.asph;                                                 // the sally port's yard
    return q ? C.pave : mix(C.pave, C.paveD, .5); }                                                              // paving in 1.2 m squares
  const dW = WALL.x0 - .5 - x, dN = WALL.z0 - .5 - z, dE = x - WALL.x1 - .5;
  if (((dW >= 0 && dW < 1.4) || (dE >= 0 && dE < 1.4)) && z > WALL.z0 - 2 && z < WALL.z1 - 1.3 || (dN >= 0 && dN < 1.4 && x > WALL.x0 - 2 && x < WALL.x1 - NE_CUT)) return n > .5 ? C.gravel : C.gravelD;   // the patrol path
  return n > .9 ? C.grassL : n < .08 ? C.grassD : C.grass;                                                       // lawn
}
export function ground(ctx) {
  const W = wv(ctx, [ISLAND.x0, ISLAND.z0, ISLAND.x1, WALKN], .1, .3, { s: .2 }); if (!W) return; const V = W.V;
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const c = floorColour(W.wx(i), W.wz(k)); if (c !== null) V.set(i, 0, k, c); }
  later(ctx, W, { walk: true }); ctx.J.floor = W;
  // SPREAD · THE MARGIN: the island sits at its compound's centre, so a spread opens HS + a block's share between its south edge and the
  // island road's lot line; one more layer over it carries the edge row's own ground (the forecourt's pavers, the apron's asphalt, the lawn)
  if (SPREAD) { const M = wv(ctx, [ISLAND.x0, WALKN, ISLAND.x1, WALKN + .1], .1, .3, { s: .2, margin: true }); if (M) { const V = M.V;
    for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const c = floorColour(M.wx(i), M.wz(k)); if (c !== null) V.set(i, 0, k, c); }
    later(ctx, M, { walk: true }); } }
}

// ── the wall: 0.2 m concrete, panel joints every 3 m, a darker footing, the coping, the wire; the north-east corner cut at 45°
export function walls(ctx) {
  ctx.group('wall');
  const Wl = WALL, y1 = SIDE + Wl.h, top = y1 + .2, wire = top + .6, bx0 = ctx.i * PITCH, bz0 = ctx.j * PITCH;
  for (const r of WALLS) { const W = wv(ctx, r, SIDE, wire + .2, { s: .2 }); if (!W) continue; const V = W.V, ew = r[2] - r[0] < r[3] - r[1];   // ew: the wall runs along z
    V.box(0, 0, 0, V.nx, W.Y(y1), V.nz, (i, y, k) => { const u = ew ? W.wz(k) : W.wx(i); return y < 2 ? C.concD : (((u % 3) + 3) % 3 < .2 ? shade(C.bone, .9) : C.bone); });
    V.box(0, W.Y(y1), 0, V.nx, W.Y(top), V.nz, C.concL);
    const mid = ew ? V.nx >> 1 : V.nz >> 1;
    for (let q = 0; q < (ew ? V.nz : V.nx); q++) { const h = (q % 4) < 2 ? 1 : 2, c = (q % 4) === 1 ? C.steelL : C.steel; if (ew) V.box(mid, W.Y(top), q, mid + 1, W.Y(top) + h + 1, q + 1, c); else V.box(q, W.Y(top), mid, q + 1, W.Y(top) + h + 1, mid + 1, c); }   // the wire
    later(ctx, W, { mass: [Math.max(r[0], bx0), Math.max(r[1], bz0), Math.min(r[2], bx0 + PITCH), Math.min(r[3], bz0 + PITCH)], top: wire, roofY: 99 });
    (ctx.J.walls ??= []).push({ W, r, ew }); }
  // the cut: a 45° run of 0.2 m cells (none inside the straight walls)
  const Wc = wv(ctx, [Wl.x1 - NE_CUT - 1, Wl.z0 - 1, Wl.x1 + 1, Wl.z0 + NE_CUT + 1], SIDE, wire + .2, { s: .2 });
  if (Wc) { const V = Wc.V; let any = false;
    for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = Wc.wx(i), z = Wc.wz(k); if (!inBlock(ctx, x, z) || !inCut(x, z) || WALLS.some(r => inR(x, z, r, .11))) continue; any = true;
      V.box(i, 0, k, i + 1, Wc.Y(y1), k + 1, (ii, y) => y < 2 ? C.concD : C.bone); V.box(i, Wc.Y(y1), k, i + 1, Wc.Y(top), k + 1, C.concL); if (Math.abs(x - cutAt(z)) < .12) V.box(i, Wc.Y(top), k, i + 1, Wc.Y(top) + 1 + ((i >> 1) & 1), k + 1, C.steel); }
    if (any) later(ctx, Wc, { keep: [Wl.x1 - NE_CUT - .8, SIDE, Wl.z0 - .6, Wl.x1 + .8, wire, Wl.z0 + NE_CUT + .6], tag: 'wall' }); }
  // lamps on brackets on the outer face, every 12 m, their heads over the patrol path
  const h2 = Wl.t / 2, runs = [[Wl.x0 - h2, Wl.z0 + 8, Wl.x0 - h2, Wl.z1 - 8, -1, 0], [Wl.x0 + 8, Wl.z0 - h2, Wl.x1 - NE_CUT - 2, Wl.z0 - h2, 0, -1], [Wl.x1 + h2, Wl.z0 + NE_CUT + 4, Wl.x1 + h2, Wl.z1 - 8, 1, 0]];
  for (const [ax, az, bx, bz, nx, nz] of runs) { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 12));
    for (let q = 0; q <= n; q++) { const x = ax + (bx - ax) * q / n, z = az + (bz - az) * q / n; if (!inBlock(ctx, x, z)) continue; lampOnWall(ctx, x, z, nx, nz); } }
}
function lampOnWall(ctx, x, z, nx, nz) {   // (x, z) on the wall's outer face; (nx, nz) the outward normal
  const W = wv(ctx, [x - .8, z - .8, x + .8, z + .8], SIDE + 4.4, SIDE + 5.8, { s: CV, out: 1 }); if (!W) return; const B = W.box;
  const ox = (a, b) => [Math.min(x + nx * a, x + nx * b), Math.max(x + nx * a, x + nx * b)], oz = (a, b) => [Math.min(z + nz * a, z + nz * b), Math.max(z + nz * a, z + nz * b)];
  const [px0, px1] = nx ? ox(0, .1) : [x - .1, x + .1], [pz0, pz1] = nz ? oz(0, .1) : [z - .1, z + .1]; B(px0, SIDE + 4.6, pz0, px1, SIDE + 5.4, pz1, C.steelD);   // the plate on the wall
  const [ax0, ax1] = nx ? ox(.1, .7) : [x - .05, x + .05], [az0, az1] = nz ? oz(.1, .7) : [z - .05, z + .05]; B(ax0, SIDE + 5.2, az0, ax1, SIDE + 5.3, az1, C.steelD);   // the arm
  const hx = x + nx * .6, hz = z + nz * .6; B(hx - .2, SIDE + 4.9, hz - .2, hx + .2, SIDE + 5.2, hz + .2, C.steelD); B(hx - .15, SIDE + 4.8, hz - .15, hx + .15, SIDE + 4.9, hz + .15, TOD.night ? C.litHi : 0xe8ecef, lit(1));
  later(ctx, W);
}

// ── the guard towers (0.1 m): a concrete shaft, the number, a ladder, the cab on its slab with a balcony rail, the roof, a searchlight
export function guardTowers(ctx) {
  for (const t of GTOWERS) { if (!inBlock(ctx, t.x, t.z)) continue; ctx.group('tower-' + t.id);
    const cabY = SIDE + t.h - 3.2, rise = t.roof === 'hip' ? 1.5 : t.roof === 'cone' ? 3.6 : 1.6, roofTop = cabY + 2.8 + rise;
    const W = wv(ctx, [t.x - 2.6, t.z - 2.6, t.x + 2.6, t.z + 2.6], SIDE, roofTop + .4, { s: CV, out: 3 }), V = W.V, B = W.box, N = TOD.night;
    B(t.x - T_SH, SIDE, t.z - T_SH, t.x + T_SH, cabY, t.z + T_SH, (i, y) => y < 6 ? C.concD : C.pale);                                  // the shaft
    for (let y = SIDE + 2.8; y < cabY - .4; y += 2.8) B(t.x - T_SH, y, t.z - T_SH, t.x + T_SH, y + .1, t.z + T_SH, shade(C.pale, .88));   // pour lines
    // its number, big, on the two faces that look out over the water
    const N1 = px(t.id.slice(1)), faces = [t.x < 256 ? '-x' : '+x', t.z < -340 ? '-z' : '+z'];
    for (const f of faces) { const plane = f === '-x' ? t.x - T_SH : f === '+x' ? t.x + T_SH : f === '-z' ? t.z - T_SH : t.z + T_SH, a0 = f[1] === 'x' ? t.z - T_SH : t.x - T_SH, a1 = a0 + 2 * T_SH;
      wletters(W, f, a0, a1, cabY - 1.1, plane, N1, t.trim, { sc: 5 }); }
    // the ladder on the inner face (x side toward the compound): two rails against the shaft, rungs every 0.3 m
    const sx = t.x < 256 ? 1 : -1, fx = t.x + sx * T_SH, lx0 = sx > 0 ? fx : fx - .3, lx1 = sx > 0 ? fx + .3 : fx;
    for (const dz of [-.35, .25]) B(lx0, SIDE + 1, t.z + dz, lx1, cabY, t.z + dz + .1, C.steelD);
    for (let y = SIDE + 1.2; y < cabY - .1; y += .3) B(sx > 0 ? fx + .2 : fx - .3, y, t.z - .35, sx > 0 ? fx + .3 : fx - .2, y + .1, t.z + .35, C.steel);
    // the cab: slab, balcony rail, the walls to the sill in the trim colour, the glass band with mullions, the lintel; hollow inside
    B(t.x - T_CAB, cabY, t.z - T_CAB, t.x + T_CAB, cabY + .2, t.z + T_CAB, C.concL);
    for (const [ax, az, bx, bz] of [[-T_CAB, -T_CAB, T_CAB, -T_CAB + .1], [-T_CAB, T_CAB - .1, T_CAB, T_CAB], [-T_CAB, -T_CAB, -T_CAB + .1, T_CAB], [T_CAB - .1, -T_CAB, T_CAB, T_CAB]]) {
      const alongX = bx - ax > 1; B(t.x + ax, cabY + 1.0, t.z + az, t.x + bx, cabY + 1.1, t.z + bz, C.steelD);
      for (let q = -T_CAB; q < T_CAB - .05; q += .55) B(alongX ? t.x + q : t.x + ax, cabY + .2, alongX ? t.z + az : t.z + q, alongX ? t.x + q + .1 : t.x + bx, cabY + 1.0, alongX ? t.z + bz : t.z + q + .1, C.steelD); }
    const c0 = 1.8, sill = cabY + 1.0, head = cabY + 2.3;
    for (const [ax, az, bx, bz, f] of [[-c0, -c0, c0, -c0 + .1, 'z'], [-c0, c0 - .1, c0, c0, 'z'], [-c0, -c0, -c0 + .1, c0, 'x'], [c0 - .1, -c0, c0, c0, 'x']]) {
      B(t.x + ax, cabY + .2, t.z + az, t.x + bx, sill, t.z + bz, t.trim);
      B(t.x + ax, sill, t.z + az, t.x + bx, head, t.z + bz, (i, y, k) => { const u = f === 'z' ? W.wx(i) - t.x : W.wz(k) - t.z; return (((u + c0) % .9) + .9) % .9 < .12 || Math.abs(u) > c0 - .12 ? C.ink : N ? (H(i, k, t.h * 10) > .3 ? C.litLo : C.glass) : (y > W.Y(head) - 4 ? C.glassHi : C.glass); }, N ? 3 : 1);
      B(t.x + ax, head, t.z + az, t.x + bx, cabY + 2.6, t.z + bz, C.ink); }
    // the roof: an overhanging slab, then hip, spire or flat with the big lamp on a yoke
    const e = 2.5, r0 = cabY + 2.6; B(t.x - e, r0, t.z - e, t.x + e, r0 + .2, t.z + e, t.roof === 'flat' ? C.slate : C.steelD);
    if (t.roof === 'hip') for (let s = 0; s < 15; s++) { const w = e - .1 - s * .16; if (w <= .15) break; B(t.x - w, r0 + .2 + s * .1, t.z - w, t.x + w, r0 + .3 + s * .1, t.z + w, s % 3 === 2 ? shade(C.slate, .85) : C.slate); }
    if (t.roof === 'cone') { for (let s = 0; s < 32; s++) { const w = 2.2 - s * .066; if (w <= .1) break; B(t.x - w, r0 + .2 + s * .1, t.z - w, t.x + w, r0 + .3 + s * .1, t.z + w, (s >> 1) % 2 ? t.trim : shade(t.trim, .78)); } B(t.x - .05, r0 + 2.3, t.z - .05, t.x + .05, r0 + 3.6, t.z + .05, C.gold); }
    if (t.roof === 'flat') { for (const [ax, az, bx, bz] of [[-e, -e, e, -e + .1], [-e, e - .1, e, e], [-e, -e, -e + .1, e], [e - .1, -e, e, e]]) B(t.x + ax, r0 + .2, t.z + az, t.x + bx, r0 + .6, t.z + bz, C.steelD);
      B(t.x - .5, r0 + .2, t.z - .15, t.x + .5, r0 + .5, t.z + .15, C.steelD); B(t.x - .1, r0 + .5, t.z - .1, t.x + .1, r0 + .8, t.z + .1, C.steelD);
      B(t.x - .5, r0 + .8, t.z - .5, t.x + .5, r0 + 1.5, t.z + .5, C.ink); B(t.x - .4, r0 + .9, t.z + .5, t.x + .4, r0 + 1.4, t.z + .6, N ? C.litHi : 0xeef3f6, lit(1)); }
    // a searchlight on the balcony's outer corner
    const [lx, lz] = t.light, qx = t.x + lx * 2.0, qz = t.z + lz * 2.0;
    B(qx - .05, cabY + .2, qz - .05, qx + .05, cabY + 1.2, qz + .05, C.steelD); B(qx - .2, cabY + 1.2, qz - .2, qx + .2, cabY + 1.6, qz + .2, C.ink);
    B(lx > 0 ? qx + .2 : qx - .3, cabY + 1.25, qz - .15, lx > 0 ? qx + .3 : qx - .2, cabY + 1.55, qz + .15, N ? C.litHi : 0xeef3f6, lit(1));
    later(ctx, W, { mass: [t.x - T_SH, t.z - T_SH, t.x + T_SH, t.z + T_SH], top: roofTop, roofY: cabY + .2 });
    (ctx.J.towers ??= []).push({ t, cabY, roofTop });
    person(ctx, t.x - lx * .7, cabY + .2, t.z - lz * .5, Math.atan2(lx, lz), 'stand', t.seed ?? 0, { outfit: 'officer' });   // the guard, looking out over his corner (cast pass: in the officer's outfit, cast.js OUTFITS)
  }
}

// ── the cell block (0.2 m): four tiers of barred slits, ledges, stair bays at the ends, the C BLOCK door, IRON ISLAND on the roof
export function cellBlock(ctx) {
  const [x0, z0, x1, z1] = CELLS.r, Hh = CELLS.h, W = wv(ctx, [x0 - .4, z0 - .4, x1 + .4, z1 + .4], SIDE, SIDE + Hh + 2.4, { s: .2 }); if (!W) return; ctx.group('cells');
  const V = W.V, N = TOD.night, top = SIDE + Hh, X0 = W.X(x0), X1 = W.X(x1), Z0 = W.Z(z0), Z1 = W.Z(z1), YT = W.Y(top);
  V.box(X0, 0, Z0, X1, YT, Z1, C.bone); V.box(X0, 0, Z0, X1, 2, Z1, C.concD);
  for (const y of [3.2, 6.2, 9.2]) { const yy = W.Y(SIDE + y); V.box(X0 - 1, yy, Z0 - 1, X1 + 1, yy + 1, Z1 + 1, C.slate); }                // floor ledges, one cell proud
  // the roof: membrane, a parapet with a cap, IRON ISLAND in yellow (read from the south), two vent stacks, the hatch
  V.box(X0 + 1, YT - 1, Z0 + 1, X1 - 1, YT, Z1 - 1, 0x777a84);
  V.box(X0, YT, Z0, X1, YT + 4, Z1, C.bone); V.clear(X0 + 1, YT, Z0 + 1, X1 - 1, YT + 4, Z1 - 1); V.box(X0, YT + 4, Z0, X1, YT + 5, Z1, C.concL); V.clear(X0 + 1, YT + 4, Z0 + 1, X1 - 1, YT + 5, Z1 - 1);
  const M = px('IRON ISLAND'), sc = 3, tw = M.w * sc, gx = Math.round((x0 + x1) / 2 / .2) - Math.round(tw / 2), gz = Math.round((z0 + 5.9) / .2), ox = Math.round(W.ux0 / .2), oz = Math.round(W.uz0 / .2);   // (SPREAD: its origin in today's metres)
  for (let j = 0; j < 7; j++) for (let a = 0; a < M.w; a++) if (M.at(a, j)) for (let u = 0; u < sc; u++) for (let v = 0; v < sc; v++) V.set(gx + a * sc + u - ox, YT - 1, gz + j * sc + v - oz, C.yellow);
  logSign(ctx, 'IRON ISLAND', (x0 + x1) / 2 - .1, z0 + 8, 96);
  for (const vx of [x0 + 3, x1 - 3.6]) { const i = W.X(vx), k = W.Z(z0 + 2.6); if (i < 0 || i + 4 > V.nx) continue; V.box(i, YT, k, i + 3, YT + 7, k + 3, C.steel); V.box(i - 1, YT + 7, k - 1, i + 4, YT + 8, k + 4, C.steelD); }
  { const i = W.X(x0 + 12), k = W.Z(z1 - 3.4); if (i >= 0 && i + 5 <= V.nx) { V.box(i, YT, k, i + 5, YT + 3, k + 4, C.pale); V.box(i, YT + 3, k, i + 5, YT + 4, k + 4, C.steelD); } }
  // the windows: slits three cells wide (glass, a bar, glass) over a slate sill, every 1.6 m on every face; some lit at night
  const DOOR = 250, winRow = (face, y0, ground) => { const along = face[1] === 'z', n0 = along ? X0 : Z0, n1 = along ? X1 : Z1, dd = face === '+z' ? Z1 - 1 : face === '-z' ? Z0 : face === '+x' ? X1 - 1 : X0;
    for (let u = n0 + 5; u + 3 <= n1 - 5; u += 8) { const wu = along ? W.wx(u + 1) : W.wz(u + 1); if (ground && along && Math.abs(wu - DOOR) < 2.6) continue;
      const on = N && H(Math.round(wu * 5), y0, face.charCodeAt(0) * 3 + face.charCodeAt(1)) > .62;
      for (let q = 0; q < 3; q++) for (let y = y0; y < y0 + 7; y++) { const c = q === 1 ? C.steelD : on ? (y > y0 + 3 ? C.litHi : C.litLo) : C.navy, l = on && q !== 1 ? 3 : 0;
        if (along) V.set(u + q, y, dd, c, l); else V.set(dd, y, u + q, c, l); }
      for (let q = -1; q < 4; q++) if (along) V.set(u + q, y0 - 1, dd, C.slate); else V.set(dd, y0 - 1, u + q, C.slate); } };
  for (const f of ['+z', '-z']) [1.3, 4.3, 7.3, 10.3].forEach((y, n) => winRow(f, W.Y(SIDE + y), n === 0));
  for (const f of ['+x', '-x']) for (const y of [4.3, 7.3, 10.3]) winRow(f, W.Y(SIDE + y), false);
  // C BLOCK: a steel door on the yard side under its board and a caged lamp; the stair bays (glass block) at the ends of the yard side
  const dx = W.X(DOOR); if (dx - 8 >= 0 && dx + 8 <= V.nx) { V.clear(dx - 12, W.Y(SIDE + 3.2), Z1, dx + 12, W.Y(SIDE + 3.2) + 1, Z1 + 1); V.box(dx - 4, 0, Z1 - 1, dx + 4, 12, Z1, C.steelD); V.box(dx - 3, 1, Z1 - 1, dx + 3, 11, Z1, 0x3e4450); V.box(dx - 1, 5, Z1 - 1, dx, 6, Z1, C.steelL);
    signOn(ctx, '+z', DOOR - 2.3, DOOR + 2.3, SIDE + 2.7, SIDE + 3.8, z1, C.ink, px('C BLOCK'), C.chalk); V.box(dx - 1, 12, Z1, dx + 1, 13, Z1 + 1, N ? C.litHi : 0xeef0f2, lit(1)); doorAt(ctx, DOOR, z1 + .5, 0); }
  for (const bx of [x0 + 1.4, x1 - 2.2]) { const i = W.X(bx); if (i < 0 || i + 4 > V.nx) continue; for (let y = 16; y < YT - 3; y++) if (y % 15 > 1) V.box(i, y, Z1 - 1, i + 4, y + 1, Z1, (y + i) % 3 ? 0x9fc3d8 : 0xbfd8e6, N ? 3 : 1); }
  later(ctx, W, { mass: [Math.max(x0, ctx.i * PITCH), z0, Math.min(x1, ctx.i * PITCH + PITCH), z1], top: top + 1, roofY: top - .2 });
  ctx.J.cells = W;
}

// ── intake + control (0.2 m): pale, its steel door east onto the corridor and the yard's gate (the sim's jail at 256, −338), clerestory
// slits, the control cab on the roof over the yard, a radio mast, air handlers
export function intake(ctx) {
  const [x0, z0, x1, z1] = INTAKE.r, Hh = INTAKE.h, W = wv(ctx, [x0 - .4, z0 - .4, x1 + .4, z1 + .4], SIDE, SIDE + Hh + 7.6, { s: .2 }); if (!W) return; ctx.group('intake');
  const V = W.V, N = TOD.night, X0 = W.X(x0), X1 = W.X(x1), Z0 = W.Z(z0), Z1 = W.Z(z1), YT = W.Y(SIDE + Hh);
  V.box(X0, 0, Z0, X1, YT, Z1, C.pale); V.box(X0, 0, Z0, X1, 2, Z1, C.concD); V.box(X0, YT - 2, Z0, X1, YT, Z1, C.slate);
  V.box(X0 + 1, YT - 1, Z0 + 1, X1 - 1, YT, Z1 - 1, 0x8b8e97); V.box(X0, YT, Z0, X1, YT + 2, Z1, C.pale); V.clear(X0 + 1, YT, Z0 + 1, X1 - 1, YT + 2, Z1 - 1);
  for (const y of [W.Y(SIDE + 2.4), W.Y(SIDE + 5.4)]) { for (let k = Z0 + 3; k < Z1 - 3; k += 5) { if (Math.abs(W.wz(k + 1) - JAIL[1]) < 2.4 && y < 20) continue; V.box(X1 - 1, y, k, X1, y + 3, k + 3, N && H(k, y) > .5 ? C.litHi : C.navy, N ? 3 : 0); V.box(X0, y, k, X0 + 1, y + 3, k + 3, N && H(k, y, 2) > .5 ? C.litLo : C.navy, N ? 3 : 0); }
    for (let i = X0 + 3; i < X1 - 3; i += 5) { V.box(i, y, Z0, i + 3, y + 3, Z0 + 1, C.navy); V.box(i, y, Z1 - 1, i + 3, y + 3, Z1, N && H(i, y) > .5 ? C.litLo : C.navy, N ? 3 : 0); } }
  // the door onto the corridor at z −338 (the yard's gate is across it): a steel door, a hood lamp, INTAKE on a board
  const dk = W.Z(JAIL[1]); V.box(X1 - 1, 0, dk - 4, X1, 12, dk + 4, C.steelD); V.box(X1 - 1, 1, dk - 3, X1, 11, dk + 3, 0x3e4450); V.box(X1 - 1, 6, dk - 3, X1, 7, dk - 2, C.steelL);
  V.box(X1, 12, dk - 1, X1 + 1, 13, dk + 1, N ? C.litHi : 0xeef0f2, lit(1));
  signOn(ctx, '+x', JAIL[1] - 2, JAIL[1] + 2, SIDE + 2.9, SIDE + 4.0, x1, C.ink, px('INTAKE'), C.chalk);
  if (inBlock(ctx, x1 + .5, JAIL[1])) doorAt(ctx, x1 + .5, JAIL[1], 1);
  // the control cab on the roof, over the yard; a radio mast with a red light; two air handlers
  const cx0 = W.X(x1 - 5.2), cx1 = W.X(x1 - .6), cz0 = W.Z(-342), cz1 = W.Z(-334.4), cy = YT;
  V.box(cx0, cy, cz0, cx1, cy + 2, cz1, C.pale);
  V.box(cx0, cy + 2, cz0, cx1, cy + 11, cz1, (i, y, k) => (i === cx0 || i === cx1 - 1 || k === cz0 || k === cz1 - 1) ? (((i + k) % 5 === 0) ? C.ink : N ? C.litLo : C.glassHi) : undefined, N ? 3 : 1);
  V.box(cx0 - 1, cy + 11, cz0 - 1, cx1 + 1, cy + 12, cz1 + 1, C.slate);
  { const mi = W.X(x0 + 3), mk = W.Z(z0 + 3); V.box(mi, cy, mk, mi + 1, cy + 34, mk + 1, C.steelL); for (let y = cy + 4; y < cy + 34; y += 6) V.box(mi - 1, y, mk, mi + 2, y + 1, mk + 1, C.steelL); V.set(mi, cy + 34, mk, 0xff2a2a, lit(1)); }
  for (const [ax, az] of [[x0 + 5, z0 + 8], [x0 + 5, z1 - 6]]) { const i = W.X(ax), k = W.Z(az); V.box(i, cy, k, i + 8, cy + 5, k + 5, C.steelL); V.box(i + 1, cy + 5, k + 1, i + 3, cy + 6, k + 3, C.steelD); V.box(i + 5, cy + 5, k + 1, i + 7, cy + 6, k + 3, C.steelD); }
  later(ctx, W, { mass: [x0, z0, x1, z1], top: SIDE + Hh + .4, roofY: SIDE + Hh - .2 });
  ctx.J.intake = W;
}

// ── the sally port: the gatehouse (bone, an orange band, the guard's window on the apron) and the two orange gate leaves in the wall
export function gatehouse(ctx) {
  const [x0, z0, x1, z1] = GATEHOUSE.r, Hh = GATEHOUSE.h, W = wv(ctx, [x0 - .4, z0 - .4, x1 + .4, z1 + .4], SIDE, SIDE + Hh + .8, { s: CV }); if (!W) return; ctx.group('gatehouse');
  const V = W.V, N = TOD.night, B = W.box, top = SIDE + Hh;
  B(x0, SIDE, z0, x1, top, z1, C.bone); B(x0, SIDE, z0, x1, SIDE + .4, z1, C.concD); B(x0, top - .6, z0, x1, top - .2, z1, C.orange);
  B(x0, top - .2, z0, x1, top + .4, z1, C.bone); B(x0 + .2, top, z0 + .2, x1 - .2, top + .4, z1 - .2, -1); B(x0 + .2, top - .2, z0 + .2, x1 - .2, top, z1 - .2, 0x8b8e97);
  B(x0 + 1, SIDE + 1.4, z1 - .1, x1 - 1, SIDE + 3.0, z1, (i, y) => ((W.wx(i) - x0) % 1.2) < .1 ? C.ink : N ? C.litLo : C.glass, N ? 3 : 1); B(x0 + .8, SIDE + 1.2, z1 - .1, x1 - .8, SIDE + 1.4, z1 + .2, C.slate);
  wboard(W, '+z', x0 + .4, x1 - .4, SIDE + 3.4, SIDE + 4.4, z1, C.ink, px('SALLY PORT'), C.chalk);
  B(x0 - .1, SIDE, z1 - 1.8, x0, SIDE + 2.4, z1 - .6, C.steelD); B(x0 - .1, SIDE + .1, z1 - 1.7, x0, SIDE + 2.3, z1 - .7, C.orange);
  if (inBlock(ctx, x0 - .5, z1 - 1.2)) doorAt(ctx, x0 - .5, z1 - 1.2, 3);
  later(ctx, W, { mass: [x0, z0, x1, z1], top: SIDE + Hh + .4, roofY: SIDE + Hh - .2 });
  // the gate: two leaves (ribbed, hazard at the foot), a STOP plate on each, closed; 0.2 m thick with the plates one cell proud
  const G = wv(ctx, [SALLY.x0, WALL.z1 - .1, SALLY.x1, WALL.z1 + .2], .3, SIDE + 6, { s: .1 }); if (G) { const V2 = G.V;
    V2.box(0, 0, 0, V2.nx, V2.ny, 2, (i, y) => y < 5 ? (((i + y) >> 2) & 1 ? C.hazard : C.ink) : (y % 10 === 0 ? shade(C.orange, .8) : C.orange));
    const mid = G.X((SALLY.x0 + SALLY.x1) / 2); V2.box(mid - 1, 0, 0, mid + 1, V2.ny, 2, C.steelD);
    board(V2, '+z', mid - 13, mid - 3, 30, 38, 1, C.red, mini('STOP'), C.chalk); board(V2, '+z', mid + 3, mid + 13, 30, 38, 1, C.red, mini('STOP'), C.chalk);
    later(ctx, G, { keep: [SALLY.x0, SIDE, WALL.z1 - .1, SALLY.x1, SIDE + 6, WALL.z1 + .2], tag: 'gate' }); }
}

// ── the island road's north half over the K slab's asphalt (z −290 … −288): a 0.1 m deck at y 0 … 0.1 with the centre line and the
// crossing east of the T; the core's paint is under it (the south half is the quay, bridge.js)
export function roadDeck(ctx) {
  const W = wv(ctx, [224, IR.a0, IR.x1, IR.z], -.3, DECK.road, { s: CV }); if (!W) return; ctx.group('road'); const V = W.V;
  V.box(0, 0, 0, V.nx, V.ny, V.nz, (i, y, k) => { const x = W.wx(i), z = W.wz(k); if (y < V.ny - 1) return C.asph;
    if (x > 231.1 && x < 232.9 && ((z + 289.85) % .9 + .9) % .9 < .5 && z > -289.85) return C.lineW;                     // the crossing over the island road (east of the T)
    if (x > 233.1 && x < 233.45) return C.lineW;                                                                          // its stop line
    if (z > -288.1 && x > 233.2 && (x % 3) < 1.5) return C.lineY;                                                         // the dashed centre line
    return H(Math.floor(x * 3), Math.floor(z * 3), 61) > .985 ? C.asphD : C.asph; });
  later(ctx, W, { walk: true });
}
