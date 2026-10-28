// GATEHILL · one tower per block. The ground floor (0.1 cubes: shopfronts, the two lobby courts), the podium floors and the shaft
// (0.2 cubes: tiers, setback terraces, the penthouse floors), registered with the placement registry (footprints per tier, so props and
// people stand on terraces; doorways; the plinth zone), and the anchors the sim-state layer draws on: TWO stacked-unit buildings per
// tower, one per lobby (the north penthouse enters from the north court, the south one from the south court), each with its unit's
// windows on the penthouse floors. Everything is sized from specs.js, so the far tier (far.js) draws the same tower.
import { Vol } from '../../vox.js';
import { frame, AIR } from '../../kit.js';
import { C, CV, SIDE, H, TOD, REG, shade, FACE_ROT, planeOf, winAnchor, r2 } from './lib.js';
import { STYLES, FL, glassOf, litAt, PH_LIT } from './facades.js';
import { lotOf, stackOf, GF_H } from './specs.js';

export const S2 = .2;                          // the shaft's cube
const GFV = Math.round(GF_H / CV);             // ground floor height in 0.1 cubes (52)
// the geometry every part of a tower reads (world metres)
export function planOf(i, j, T) {
  const L = lotOf(i, j), st = stackOf(T), cw = T.court.w / 2, cd = T.court.d;
  const courts = { N: [L.cx - cw, L.Z0, L.cx + cw, L.Z0 + cd], S: [L.cx - cw, L.Z1 - cd, L.cx + cw, L.Z1] };
  const U = u => L.X0 + u, Vv = v => L.Z0 + v, rectW = r => [U(r[0]), Vv(r[1]), U(r[2]), Vv(r[3])];
  const top = st.tiers[st.tiers.length - 1], phT = st.tiers.filter(t => t.ph);
  // the line between the two penthouses (north unit / south unit): the middle of the penthouse floors' footprint
  const ph0 = phT[0]?.rects || top.rects, zs = ph0.flatMap(r => [Vv(r[1]), Vv(r[3])]), split = (Math.min(...zs) + Math.max(...zs)) / 2;
  return { ...L, i, j, T, st, courts, U, V: Vv, rectW, split, seed: (i + 64) * 131 + (j + 64) * 17 };
}

// a wall frame on a Vol for a world rect side: B in voxels of that Vol
export function frameW(V, x0, z0, x1, z1, side) { const s = V.s, B = { x0: Math.round((x0 - V.org[0]) / s), x1: Math.round((x1 - V.org[0]) / s), z0: Math.round((z0 - V.org[2]) / s), z1: Math.round((z1 - V.org[2]) / s) }; return frame(V, B, side); }
// the plinth zone (props keep 0.35 m off a wall on its lower 3.2 m, as ctx.mass does) and a footprint for a world rect
const plinth = (x0, z0, x1, z1) => REG.keep([x0 - .35, SIDE, z0 - .35, x1 + .35, SIDE + 3.2, z1 + .35], 'plinth');
// a footprint with its real bottom (an overhang keeps the court under it free), clipped to the lot: a box over the sidewalk would
// count against the walkers' clear path whatever its height (audit.js gapAt)
export function foot(r, top, bottom = SIDE, lot = null) { const b = REG.blk; if (!b) return null; let [x0, z0, x1, z1] = r;
  if (lot) { x0 = Math.max(x0, lot.X0); z0 = Math.max(z0, lot.Z0); x1 = Math.min(x1, lot.X1); z1 = Math.min(z1, lot.Z1); } if (x1 <= x0 || z1 <= z0) return null;
  const f = { box: [x0, bottom, z0, x1, top, z1], group: b.group, roofY: top }; b.feet.push(f); return f; }

// ── the ground floor: the lot minus the two courts, 5.2 m of stone, glass or bronze in 0.1 cubes. Returns its Vol and the walls
// (frames) the shopfronts and lobbies are drawn on.
export function groundFloor(ctx, P, T) {
  const pad = 16, g = T.gf, nx = P.W * 10 + 2 * pad, nz = P.D * 10 + 2 * pad, V = new Vol(nx, GFV + 30, nz, { s: CV, org: [P.X0 - pad * CV, SIDE, P.Z0 - pad * CV] });
  const X = x => Math.round((x - V.org[0]) / CV), Z = z => Math.round((z - V.org[2]) / CV), [nx0, nz0, nx1, nz1] = P.courts.N, [, sz0, , sz1] = P.courts.S;
  V.box(X(P.X0), 0, Z(P.Z0), X(P.X1), GFV, Z(P.Z1), g.wall);
  for (const [a, b, c, d] of [P.courts.N, P.courts.S]) V.clear(X(a), 0, Z(b), X(c), GFV + 30, Z(d));
  V.box(X(P.X0) + 1, GFV - 1, Z(P.Z0) + 1, X(P.X1) - 1, GFV, Z(P.Z1) - 1, (x, y, z) => V.has(x, y, z) ? T.roofCol : undefined);   // (the courts stay open)
  // cuts (a hero's loggia on a side street): cleared up to their ceiling, the band left as a lintel over them
  const cuts = (g.cuts || []).map(c => { const x0 = c.side === '-x' ? P.X0 : P.X1 - c.d, zA = P.Z0 + c.from, zB = P.Z0 + c.to; return { ...c, r: [x0, zA, x0 + c.d, zB] }; });
  for (const c of cuts) V.clear(X(c.r[0]), 0, Z(c.r[1]), X(c.r[2]), Math.round(c.ceil / CV), Z(c.r[3]));
  // the registry: the masses (the wings either side of the courts, the lobby block between them, minus the cuts), their plinth zones
  const wingW = [P.X0, P.Z0, nx0, P.Z1], wingE = [nx1, P.Z0, P.X1, P.Z1], mid = [nx0, nz1, nx1, sz0], top = SIDE + GF_H;
  for (const r of [wingW, wingE, mid]) for (const q of cuts.reduce((rs, c) => rs.flatMap(r2 => minus(r2, c.r)), [r])) { foot(q, top, SIDE, P); plinth(...q); }
  for (const c of cuts) foot(c.r, top, SIDE + c.ceil, P);
  const F = (r, side) => frameW(V, r[0], r[1], r[2], r[3], side);
  const walls = {
    W: F([P.X0, P.Z0, P.X1, P.Z1], '-x'), E: F([P.X0, P.Z0, P.X1, P.Z1], '+x'),
    NW: F(wingW, '-z'), NE: F(wingE, '-z'), SW: F(wingW, '+z'), SE: F(wingE, '+z'),
    courtN: { back: F(mid, '-z'), west: F([P.X0, P.Z0, nx0, nz1], '+x'), east: F([nx1, P.Z0, P.X1, nz1], '-x') },
    courtS: { back: F(mid, '+z'), west: F([P.X0, sz0, nx0, P.Z1], '+x'), east: F([nx1, sz0, P.X1, P.Z1], '-x') },
  };
  // every wall: a polished plinth, the band and cornice at the top (the podium sits on it), rustication on stone
  const all = [walls.W, walls.E, walls.NW, walls.NE, walls.SW, walls.SE, walls.courtN.west, walls.courtN.east, walls.courtS.west, walls.courtS.east, walls.courtN.back, walls.courtS.back];
  for (const f of all) { const L = f.len;
    f.box(0, 0, 0, L, 3, 2, shade(g.wall, g.mat === 'granite' ? 1.25 : .82));
    f.box(-1, GFV - 5, 0, L + 1, GFV - 1, 2, g.band); f.box(-1, GFV - 2, 0, L + 1, GFV, 3, g.trim);
    if (g.mat === 'stone') for (let y = 8; y < GFV - 6; y += 6) f.box(0, y, 0, L, y + 1, 1, AIR);   // rustication grooves (a voxel deep)
  }
  return { V, walls, X, Z, cuts };
}
// an axis-aligned rect minus another: up to four rects
function minus(a, b) { if (b[0] >= a[2] || b[2] <= a[0] || b[1] >= a[3] || b[3] <= a[1]) return [a]; const out = [];
  if (b[1] > a[1]) out.push([a[0], a[1], a[2], b[1]]); if (b[3] < a[3]) out.push([a[0], b[3], a[2], a[3]]);
  const z0 = Math.max(a[1], b[1]), z1 = Math.min(a[3], b[3]); if (b[0] > a[0]) out.push([a[0], z0, b[0], z1]); if (b[2] < a[2]) out.push([b[2], z0, a[2], z1]); return out; }

// ── the podium floors over the ground floor (0.2 cubes), their roof the first terrace
export function podium(ctx, P, T, gfV) {
  const n = T.pod.n; if (!n) return null; const y0 = SIDE + GF_H, h = n * FL, pad = 3;
  const V = new Vol(Math.round(P.W / S2) + 2 * pad, h + 8, Math.round(P.D / S2) + 2 * pad, { s: S2, org: [P.X0 - pad * S2, y0, P.Z0 - pad * S2], ground: true });
  const X = x => Math.round((x - V.org[0]) / S2), Z = z => Math.round((z - V.org[2]) / S2), [nx0, nz0, nx1, nz1] = P.courts.N, [, sz0] = P.courts.S, cover = T.court.cover;
  const wall = T.pod.wall ?? T.wall, trim = T.pod.trim ?? T.trim;
  V.box(X(P.X0), 0, Z(P.Z0), X(P.X1), h, Z(P.Z1), wall); if (!cover) for (const [a, b, c, d] of [P.courts.N, P.courts.S]) V.clear(X(a), 0, Z(b), X(c), h + 8, Z(d));
  const wingW = [P.X0, P.Z0, nx0, P.Z1], wingE = [nx1, P.Z0, P.X1, P.Z1], mid = [nx0, nz1, nx1, sz0], F = (r, side) => frameW(V, r[0], r[1], r[2], r[3], side);
  const faces = cover ? [F([P.X0, P.Z0, P.X1, P.Z1], '-x'), F([P.X0, P.Z0, P.X1, P.Z1], '+x'), F([P.X0, P.Z0, P.X1, P.Z1], '-z'), F([P.X0, P.Z0, P.X1, P.Z1], '+z')]
    : [F([P.X0, P.Z0, P.X1, P.Z1], '-x'), F([P.X0, P.Z0, P.X1, P.Z1], '+x'), F(wingW, '-z'), F(wingE, '-z'), F(wingW, '+z'), F(wingE, '+z'), F(mid, '-z'), F(mid, '+z'),
      F([P.X0, P.Z0, nx0, nz1], '+x'), F([nx1, P.Z0, P.X1, nz1], '-x'), F([P.X0, sz0, nx0, P.Z1], '+x'), F([nx1, sz0, P.X1, P.Z1], '-x')];
  const o = styleCtx(P, T, { wall, trim, accent: T.pod.accent ?? T.accent }), sty = STYLES[T.pod.st] || STYLES.stone;
  for (let k = 0; k < n; k++) for (const f of faces) if (f.len > 4) sty(f, k * FL, k + 1, o);
  // the roof: a neutral deck, a parapet in the wall colour with a trim coping round every edge (the courts' too); the tower covers the middle
  // the roof deck and a parapet (wall + coping) along the footprint's own outline (never on facade projections), skipped under the tower
  const mask = new Uint8Array(V.nx * V.nz), inMask = (x, z) => x >= 0 && z >= 0 && x < V.nx && z < V.nz && mask[x + z * V.nx] === 1;
  for (const [a, b, c, d] of cover ? [[P.X0, P.Z0, P.X1, P.Z1]] : [wingW, wingE, mid]) for (let x = X(a); x < X(c); x++) for (let z = Z(b); z < Z(d); z++) mask[x + z * V.nx] = 1;
  const base = P.st.tiers[0].rects.map(r => { const w = P.rectW(r); return [X(w[0]) - 3, Z(w[1]) - 3, X(w[2]) + 3, Z(w[3]) + 3]; }), under = (x, z) => base.some(([a, b, c, d]) => x >= a && x < c && z >= b && z < d);
  for (let x = 0; x < V.nx; x++) for (let z = 0; z < V.nz; z++) { if (!inMask(x, z)) continue; const e = !inMask(x - 1, z) || !inMask(x + 1, z) || !inMask(x, z - 1) || !inMask(x, z + 1);
    if (!e) { V.set(x, h - 1, z, T.roofCol); continue; } if (under(x, z)) continue; V.box(x, h, z, x + 1, h + 4, z + 1, wall); V.set(x, h + 4, z, trim); }
  if (cover) foot([P.X0, P.Z0, P.X1, P.Z1], y0 + h * S2, y0, P); for (const r of [wingW, wingE, mid]) foot(r, y0 + h * S2, y0, P);   // (from the podium's floor: the ground floor registers its own)
  if (cover) for (const [a, b, c, d] of [P.courts.N, P.courts.S]) REG.keep([a, SIDE + GF_H, b, c, y0 + h * S2, d], 'podium');
  return { V, top: y0 + h * S2 };
}
// a roof deck: the top layer's interior voxels (all four neighbours solid) in the roof colour
function deck(V, y, col) { const t = y - 1; for (let x = 1; x < V.nx - 1; x++) for (let z = 1; z < V.nz - 1; z++) if (V.has(x, t, z) && V.has(x - 1, t, z) && V.has(x + 1, t, z) && V.has(x, t, z - 1) && V.has(x, t, z + 1)) V.set(x, t, z, col); }
// a parapet on every edge voxel of the roof at y − 1 (a solid voxel with an open side), hgt tall with a coping
function parapet(V, y, hgt, wall, trim, under = []) { const t = y - 1, E = [], covered = (x, z) => under.some(([a, b, c, d]) => x >= a - 1 && x <= c && z >= b - 1 && z <= d);
  for (let x = 0; x < V.nx; x++) for (let z = 0; z < V.nz; z++) if (!covered(x, z) && V.has(x, t, z) && (!V.has(x - 1, t, z) || !V.has(x + 1, t, z) || !V.has(x, t, z - 1) || !V.has(x, t, z + 1))) E.push([x, z]);
  for (const [x, z] of E) { V.box(x, y, z, x + 1, y + hgt - 1, z + 1, wall); V.set(x, y + hgt - 1, z, trim); } }
// what a style needs: the tower's colours, its glass, who is lit tonight
function styleCtx(P, T, o = {}) { const seed = P.seed; return { T, wall: o.wall ?? T.wall, trim: o.trim ?? T.trim, accent: o.accent ?? T.accent, gl: glassOf(T), seed, lit: (a, y) => litAt(seed, a, y), ...o }; }

// is a penthouse lit tonight (without the sim: a fixed guess per unit; the sim-state layer paints the truth over it)
export const phLit = (P, unit) => TOD.night && (P.T.tonight || 'LL')[unit === 'N' ? 0 : 1] === 'L';

// ── the shaft: every tier in one 0.2-cube volume, faces floor by floor, terraces, and the penthouse windows by unit
export function shaft(ctx, P, T) {
  const st = P.st, base = SIDE + st.podTop, all = st.tiers.flatMap(t => t.rects), pad = 10;
  const u0 = Math.min(...all.map(r => r[0])), v0 = Math.min(...all.map(r => r[1])), u1 = Math.max(...all.map(r => r[2])), v1 = Math.max(...all.map(r => r[3]));
  const ny = Math.round((st.top - st.podTop) / 3) * FL + 14 + Math.round(((T.crown?.h ?? 0) + (T.crown?.spire ?? 0) + 4) / S2), V = new Vol(Math.round((u1 - u0) / S2) + 2 * pad, ny, Math.round((v1 - v0) / S2) + 2 * pad, { s: S2, org: [P.U(u0) - pad * S2, base, P.V(v0) - pad * S2], ground: true });
  const X = x => Math.round((x - V.org[0]) / S2), Z = z => Math.round((z - V.org[2]) / S2), units = { N: [], S: [] }, splitZ = P.split;
  const vr = r => { const w = P.rectW(r); return [X(w[0]), Z(w[1]), X(w[2]), Z(w[3]), w]; };
  let fl = 1 + T.pod.n;   // floor numbers: the ground floor is 1
  st.tiers.forEach((t, ti) => {
    const y0 = Math.round((t.y0 - st.podTop) / 3) * FL, y1 = y0 + t.n * FL, wall = t.wall ?? T.wall, trim = t.trim ?? T.trim, accent = t.accent ?? T.accent;
    for (const r of t.rects) { const [x0, z0, x1, z1] = vr(r); V.box(x0, y0, z0, x1, y1, z1, wall); }
    // extras by style: balcony slabs + rails, planted balconies, jenga frames (drawn before the faces so the glass cuts through cleanly)
    for (const r of t.rects) { const [x0, z0, x1, z1] = vr(r); if (t.st === 'balcony' || t.st === 'forest') for (let k = 1; k < t.n; k++) balconies(V, x0, z0, x1, z1, y0 + k * FL, t.st === 'forest', P.seed + k * 7 + ti, T); }
    const sty = STYLES[t.st] || STYLES.curtain;   // (balcony, forest and jenga: a curtain wall behind their slabs and frames)
    for (let k = 0; k < t.n; k++) {
      const yk = y0 + k * FL, ph = !!t.ph, phH = t.tall || t.st === 'glassbox' ? Math.min(2, t.n - k) * FL : FL;
      if (ph && (t.st === 'glassbox' || t.tall) && k % 2 === 1) continue;   // double-height penthouse glass: one pass per two floors
      t.rects.forEach((r, ri) => { const [x0, z0, x1, z1, w] = vr(r), unitOfRect = t.twins ? (ri === 0 ? 'N' : 'S') : null;
        for (const side of ['-z', '+z', '-x', '+x']) { const f = frameW(V, w[0], w[1], w[2], w[3], side);
          const unitOf = (a0, a1) => unitOfRect || (side === '-z' ? 'N' : side === '+z' ? 'S' : (() => { const [, z] = f.xz((a0 + a1) / 2, 0); return V.org[2] + (z + .5) * S2 < splitZ ? 'N' : 'S'; })());
          const o = styleCtx(P, T, { wall, trim, accent, phH, yBase: 0, lit: ph ? (a) => { const [, z] = f.xz(a, 0); const u = unitOfRect || (side === '-z' ? 'N' : side === '+z' ? 'S' : (V.org[2] + (z + .5) * S2 < splitZ ? 'N' : 'S')); return phLit(P, u) ? 'ph' : false; } : (a, y) => litAt(P.seed + ti * 3, a + side.charCodeAt(1), y) });
          const wins = sty(f, yk, fl + k, o);
          if (t.terr === 'awning' && k === 0) for (const wv of wins) for (let d = 1; d < 6; d++) f.box(wv.a0 - 1, wv.y1 + 1 - ((d / 3) | 0), d, wv.a1 + 1, wv.y1 + 2 - ((d / 3) | 0), d + 1, (a) => ((a >> 1) & 1) ? (T.accent ?? T.trim) : C.chalk);   // striped awnings over the terrace doors
          // (a double-height pane is anchored as two windows, one per floor: the layer paints both, and its zzz / FOR RENT card fills a storey)
          if (ph) for (const wv of wins) { const u = units[unitOf(wv.a0, wv.a1)], hh = wv.y1 - wv.y0; if (hh > 20) { const mid = wv.y0 + (hh >> 1); u.push(winAnchor(f, wv.a0, wv.a1, wv.y0, mid), winAnchor(f, wv.a0, wv.a1, mid, wv.y1)); } else u.push(winAnchor(f, wv.a0, wv.a1, wv.y0, wv.y1)); } } });
    }
    if (t.st === 'jenga') for (const r of t.rects) { const [x0, z0, x1, z1] = vr(r); jengaFrame(V, x0, z0, x1, z1, y0, y1, T); }
    fl += t.n;
    // the roof of this tier: a neutral deck where nothing stands on it, a parapet or a glass rail round what is exposed
    const next = st.tiers[ti + 1];
    for (const r of t.rects) { const [x0, z0, x1, z1] = vr(r); V.box(x0 + 1, y1 - 1, z0 + 1, x1 - 1, y1, z1 - 1, T.roofCol); }
    const kind = next?.terr || (next ? 'parapet' : 'top');
    const lights = next?.ph && TOD.night ? (z => phLit(P, V.org[2] + (z + .5) * S2 < splitZ ? 'N' : 'S')) : null;
    for (const r of t.rects) { const [x0, z0, x1, z1] = vr(r); edge(V, x0, z0, x1, z1, y1, kind, wall, trim, next ? next.rects.map(vr) : [], T, lights); }
    // the registry: this tier's footprint from the ground to its roof (people and props stand on the terrace round the next tier)
    for (const r of t.rects) foot(P.rectW(r), base + y1 * S2, base + y0 * S2, P);
  });
  return { V, units, top: base + (Math.round((st.top - st.podTop) / 3) * FL) * S2, X, Z };
}
// a roof edge: a parapet (wall + coping), a glass rail (terraces), or both kinds of planting; skipped under the next tier's walls
function edge(V, x0, z0, x1, z1, y, kind, wall, trim, above, T, lights = null) {   // lights(z): string lights on this terrace's rail (a lit penthouse above it)
  const inside = (x, z) => above.some(([a, b, c, d]) => x >= a && x < c && z >= b && z < d);
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) { if (!(x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1) || inside(x, z)) continue;
    if (kind === 'rail' || kind === 'trees' || kind === 'awning') { V.set(x, y, z, trim); const glow = lights && lights(z); V.box(x, y + 1, z, x + 1, y + 5, z + 1, (xx, yy) => yy === y + 4 ? (glow && (x + z) % 2 ? PH_LIT.cove : trim) : ((x + z) % 6 === 0 ? trim : 0xbfe6ff), 1); if (glow && (x + z) % 2) V.set(x, y + 4, z, PH_LIT.cove, 3); }
    else if (kind === 'top') { V.box(x, y, z, x + 1, y + 4, z + 1, wall); V.set(x, y + 4, z, TOD.night && T.glow ? T.glow : trim, TOD.night && T.glow ? 3 : 0); }   // (at night the coping is an LED strip in the tower's colour)
    else { V.box(x, y, z, x + 1, y + 3, z + 1, wall); V.set(x, y + 3, z, trim); } }
}
// balcony slabs (1.4 m) with glass rails round a floor; `plants`: planter boxes and cubic trees along them (the vertical forest)
function balconies(V, x0, z0, x1, z1, y, plants, seed, T) {
  const o = 7, SL = C.chalk, RL = 0xbfe6ff;
  V.box(x0 - o, y, z0 - o, x1 + o, y + 1, z1 + o, (x, yy, z) => (x >= x0 && x < x1 && z >= z0 && z < z1) ? undefined : SL);
  for (let x = x0 - o; x < x1 + o; x++) for (let z = z0 - o; z < z1 + o; z++) { const e = x === x0 - o || x === x1 + o - 1 || z === z0 - o || z === z1 + o - 1; if (!e) continue;
    if (plants) { const k = x + z * 3; V.box(x, y + 1, z, x + 1, y + 3, z + 1, 0x8b5a2b); if (H(seed, x, z) < .3) V.box(x, y + 3, z, x + 1, y + 4 + (H(seed, z, x) * 3 | 0), z + 1, k % 3 ? C.leaf : C.leafL); else V.set(x, y + 3, z, C.leafD); }
    else { V.box(x, y + 1, z, x + 1, y + 5, z + 1, (xx, yy) => yy === y + 4 ? SL : RL, 1); } }
  if (plants) for (let k = 0; k < 4; k++) { const side = (seed + k) % 4, t = H(seed, k, 3), x = side < 2 ? x0 - o + 2 + Math.round(t * (x1 - x0 + 2 * o - 6)) : side === 2 ? x0 - o + 2 : x1 + o - 4, z = side >= 2 ? z0 - o + 2 + Math.round(t * (z1 - z0 + 2 * o - 6)) : side === 0 ? z0 - o + 2 : z1 + o - 4;
    V.box(x, y + 1, z, x + 1, y + 7, z + 1, C.trunk); V.box(x - 1, y + 6, z - 1, x + 2, y + 10, z + 2, H(seed, k, 9) < .5 ? C.leaf : C.leafD); }
}
// a jenga box: a thick white frame at its base and top, white corner posts
function jengaFrame(V, x0, z0, x1, z1, y0, y1, T) { const W = T.trim;
  V.box(x0 - 1, y0, z0 - 1, x1 + 1, y0 + 2, z1 + 1, W); V.box(x0 - 1, y1 - 2, z0 - 1, x1 + 1, y1, z1 + 1, W);
  for (const [x, z] of [[x0 - 1, z0 - 1], [x1 - 1, z0 - 1], [x0 - 1, z1 - 1], [x1 - 1, z1 - 1]]) V.box(x, y0, z, x + 2, y1, z + 2, W); }

// ── the sim-state anchors: two stacked-unit buildings per tower, one per lobby court. entrance.door is on the lobby wall (where the layer
// stands its doorman lobby); entrance.simDoor is the sim's own door point (lot centre x, 1 m out on the sidewalk), at the court's mouth;
// entrance.name / .no are the tower's name and the lot's street number for the doorman lobby's canopy (simassets doormanLobby({ name, no }))
export function anchorTower(ctx, P, T, units, topY) {
  const lots = ctx.simLots.map(l => ctx.lot(l)), north = lots.find(l => l.face === '-z'), south = lots.find(l => l.face === 'z'), floor = 1 + T.pod.n + T.tiers.reduce((s, t) => s + t.n, 0);
  const zN = P.courts.N[3], zS = P.courts.S[1];   // the lobby walls (the courts' back walls)
  if (north) ctx.anchor.building({ id: `bld:${P.i}_${P.j}·N`, kind: 'tower', type: 'tower', tier: 'penthouse', simTier: 'estate', rot: 2, face: [0, -1], name: T.name, addr: north.addr,
    entrance: { door: [r2(P.cx), r2(SIDE + CV), r2(zN - .5)], stoop: false, width: 5.6, court: P.courts.N.map(r2), simDoor: north.door, name: T.short, no: (north.addr || '').split(' ')[0] || '1' }, units: [{ id: 'lot:' + north.id, floor, windows: units.N }], top: r2(topY) });
  if (south) ctx.anchor.building({ id: `bld:${P.i}_${P.j}·S`, kind: 'tower', type: 'tower', tier: 'penthouse', simTier: 'estate', rot: 0, face: [0, 1], name: T.name, addr: south.addr,
    entrance: { door: [r2(P.cx), r2(SIDE + CV), r2(zS + .5)], stoop: false, width: 5.6, court: P.courts.S.map(r2), simDoor: south.door, name: T.short, no: (south.addr || '').split(' ')[0] || '1' }, units: [{ id: 'lot:' + south.id, floor, windows: units.S }], top: r2(topY) });
}
export { FACE_ROT, planeOf };
