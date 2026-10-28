// GATEHILL · the far tier: every tower from its spec in 0.5 cubes (the same massing, colours, window pattern per style, crown, roof set
// piece and podium strips as blobs), walls leaning 30 % toward the haze. At night the penthouse floors glow where the build lights them,
// a few windows are lit, the top copings show their LED colour and the crowns are floodlit, so the skyline reads from across the island.
// The core's farCtx volume is 80 cells (40 m) tall and these towers reach 140 m, so this tier draws into its own volume, as tall as the
// tower, and meshes it into the far context's bank (see PASS-estates.md: a request to the systems agent).
import { Vol, meshVol } from '../../vox.js';
import { C, SIDE, TOD, air, H } from './lib.js';
import { FAR, GLASS, PH_LIT } from './facades.js';
import { towerAt, lotOf, stackOf, podStrips, seedOf, GF_H } from './specs.js';
import { crownFar } from './crowns.js';
import { BILLBOARDS } from '../../lexicon.js';

const S = .5;
// is a penthouse lit tonight: the build's own guess (tower.js phLit), per unit
const phLitAt = (T, unit) => TOD.night && (T.tonight || 'LL')[unit === 'N' ? 0 : 1] === 'L';
export function farTower(ctx) {
  const T = towerAt(ctx.i, ctx.j); if (!T) return; const L = lotOf(ctx.i, ctx.j), st = stackOf(T), seed = seedOf(ctx.i, ctx.j), N = TOD.night;
  const top = st.top + (T.crown?.h ?? 0) + (T.crown?.spire ?? 0) + 12;
  const X0 = L.X0 - 6, Z0 = L.Z0 - 6, V = new Vol(Math.ceil((L.W + 12) / S), Math.ceil(top / S) + 2, Math.ceil((L.D + 12) / S), { s: S, org: [X0, SIDE, Z0] });
  const cx = x => Math.round((x - X0) / S), cz = z => Math.round((z - Z0) / S), cy = y => Math.round(y / S);
  const box = (x0, y0, z0, x1, y1, z1, c, l = 0) => V.box(cx(x0), cy(y0), cz(z0), Math.max(cx(x0) + 1, cx(x1)), Math.max(cy(y0) + 1, cy(y1)), Math.max(cz(z0) + 1, cz(z1)), c, l);
  const U = u => L.X0 + u, W = v => L.Z0 + v, cw = T.court.w / 2, cd = T.court.d;
  const tint = GLASS[T.glass] || GLASS.blue, gA = air(tint[0]), gB = air(tint[1]);
  // a patterned box: every edge cell answers the style's far pattern (a along the face, r the row in the floor); `litOf(x, z)` lights glass
  const pbox = (x0, y0, z0, x1, y1, z1, wall, trim, accent, style, litOf = null) => { const pat = FAR[style] || FAR.curtain, X = cx(x0), XX = Math.max(X + 1, cx(x1)), Z = cz(z0), ZZ = Math.max(Z + 1, cz(z1)), Y = cy(y0), YY = Math.max(Y + 1, cy(y1));
    const w = air(wall), t = air(trim), x = air(accent);
    for (let j = Y; j < YY; j++) for (let k = Z; k < ZZ; k++) for (let i = X; i < XX; i++) { const e = i === X || i === XX - 1 || k === Z || k === ZZ - 1; if (!e) { V.set(i, j, k, w); continue; }
      const a = (i === X || i === XX - 1) ? k - Z : i - X, r = ((j - Y) % 6 + 6) % 6, p = pat(a, r, j);
      const phOn = litOf ? litOf(i, k, j) : false;   // (a lit penthouse: its glass and its mullions glow, one box of light)
      if (p === 'g') { const on = litOf ? phOn : (N && H(i * 7 + k, j, seed) < .12); V.set(i, j, k, on ? (litOf ? (r === 5 ? PH_LIT.cove : r >= 3 ? PH_LIT.hi : PH_LIT.lo) : (r >= 3 ? C.litHi : C.litLo)) : (r >= 3 ? gB : gA), on ? 3 : 0); }
      else if (p === 'x' && phOn) V.set(i, j, k, PH_LIT.frame, 3);
      else V.set(i, j, k, p === 't' ? t : p === 'x' ? x : w); } };
  // the ground floor (shop band, glass, the courts left open) and the podium with its roof strips
  const g = T.gf, wings = [[0, 0, 12 - cw, L.D], [12 + cw, 0, 24, L.D], [12 - cw, cd, 12 + cw, L.D - cd]];
  for (const [a, b, c, d] of wings) { box(U(a), 0, W(b), U(c), 3.5, W(d), N ? C.litLo : air(g.mat === 'granite' || g.mat === 'bronze' ? 0x2a2d38 : GLASS.blue[0]), N ? 3 : 0); box(U(a), 3.5, W(b), U(c), GF_H, W(d), air(g.band)); }
  if (T.pod.n) { const y0 = GF_H, y1 = GF_H + T.pod.n * 3; if (T.court.cover) pbox(U(0), y0, W(0), U(24), y1, W(L.D), T.wall, T.trim, T.accent, T.pod.st);
    else for (const [a, b, c, d] of wings) pbox(U(a), y0, W(b), U(c), y1, W(d), T.pod.wall ?? T.wall, T.trim, T.accent, T.pod.st);
    for (const [a, b, c, d] of wings) box(U(a), y1, W(b), U(c), y1 + .5, W(d), T.roofCol); }
  for (const s of podStrips(ctx.i, ctx.j, T)) { if (s.kind === 'bill') { const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, face = BILLBOARDS[(seed + 5) % BILLBOARDS.length][3]; box(cx - .3, s.y, cz - 3.5, cx + .3, s.y + 2, cz + 3.5, C.iron); box(cx - .3, s.y + 2, cz - 4, cx + .3, s.y + 6.4, cz + 4, face, N ? 3 : 0); continue; }
    box(s.x0, s.y + .5, s.z0, s.x1, s.y + 1, s.z1, s.kind === 'lap' ? C.water : s.kind === 'lawn' ? C.grass : C.leaf, s.kind === 'lap' && N ? 3 : 0); }
  // the tiers, their roofs; balconies as slab lines, the vertical forest green; the penthouse floors lit per unit at night
  const split = (() => { const ph = st.tiers.find(t => t.ph) || st.tiers[st.tiers.length - 1], zs = ph.rects.flatMap(r => [W(r[1]), W(r[3])]); return (Math.min(...zs) + Math.max(...zs)) / 2; })();
  st.tiers.forEach((t, ti) => t.rects.forEach((r, ri) => { const [a, b, c, d] = r, twins = t.twins;
    const litOf = t.ph ? (i, k) => { const z = Z0 + (k + .5) * S, u = twins ? (ri === 0 ? 'N' : 'S') : (z < split ? 'N' : 'S'); return phLitAt(T, u); } : null;
    pbox(U(a), t.y0, W(b), U(c), t.y1, W(d), t.wall ?? T.wall, t.trim ?? T.trim, t.accent ?? T.accent, t.ph ? 'glassbox' : t.st, litOf);
    if (t.st === 'balcony' || t.st === 'forest') for (let y = t.y0 + 3; y < t.y1; y += 3) box(U(a) - 1, y, W(b) - 1, U(c) + 1, y + .5, W(d) + 1, t.st === 'forest' ? (H(ctx.i, y, 3) < .5 ? C.leaf : C.leafD) : C.chalk);
    if (t.st === 'jenga') { box(U(a) - .5, t.y0, W(b) - .5, U(c) + .5, t.y0 + .5, W(d) + .5, T.trim); box(U(a) - .5, t.y1 - .5, W(b) - .5, U(c) + .5, t.y1, W(d) + .5, T.trim); }
    box(U(a), t.y1, W(b), U(c), t.y1 + .5, W(d), T.roofCol);
    if (ti === st.tiers.length - 1 && N && T.glow) { box(U(a), t.y1, W(b), U(c), t.y1 + .5, W(b) + .5, T.glow, 3); box(U(a), t.y1, W(d) - .5, U(c), t.y1 + .5, W(d), T.glow, 3); box(U(a), t.y1, W(b), U(a) + .5, t.y1 + .5, W(d), T.glow, 3); box(U(c) - .5, t.y1, W(b), U(c), t.y1 + .5, W(d), T.glow, 3); } }));
  crownFar(T, st, L, box);
  const bank = ctx.bank; meshVol(V, bank);
  ctx.maxH = Math.max(ctx.maxH || 0, top);
}
