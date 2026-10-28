// GATEHILL · one block, built: the tower (tower.js), its crown and roof (crowns.js), its street walls (shops.js), its two courts and
// lobbies (court.js), the anchors for the sim-state layer. The kit's build(ctx) calls this for every block; a hero module calls it too
// and adds its own set piece through `extra` (the hero's block is still one tower with two lobbies: the sim's doors never move).
//   extra.shop(f, a0, a1, S, P, T) → true when the hero draws that shop itself · extra.tower(ctx, P, T, parts) · extra.after(ctx, P, T)
import { meshVol } from '../../vox.js';
import { meshFitouts } from '../../interiors/store/fill.js';   // hardening (2026-10-05): the shops' rooms behind the niches
import { REG, SIDE, H } from './lib.js';
import { towerAt } from './specs.js';
import { planOf, groundFloor, podium, shaft, anchorTower } from './tower.js';
import { crownOf } from './crowns.js';
import { luxShop, tallWindows, carLift, wingEnd, LIFTS } from './shops.js';
import { courts } from './court.js';

export function buildEstate(ctx, extra = {}) {
  const T = towerAt(ctx.i, ctx.j); if (!T) return null; const P = planOf(ctx.i, ctx.j, T);
  REG.group('tower');
  const gf = groundFloor(ctx, P, T), pod = podium(ctx, P, T), sh = shaft(ctx, P, T);
  REG.group('shops'); streetWalls(ctx, P, T, gf, extra);
  courts(ctx, P, T, gf);
  REG.group('tower'); const cr = crownOf(ctx, P, T, sh);
  extra.tower?.(ctx, P, T, { gf, pod, sh, cr });
  for (const V of [gf.V, pod?.V, sh.V].filter(Boolean)) meshVol(V, ctx.bank);
  meshFitouts(gf.V, ctx.bank, ctx.A);   // (the stock: near tier only, like a generated shop's; its people join the block's cast)
  anchorTower(ctx, P, T, sh.units, cr.top);
  (ctx.A.roofs ??= []).push({ x: P.cx, z: (P.Z0 + P.Z1) / 2, y: cr.top, w: 8, d: 8, tower: true });
  extra.after?.(ctx, P, T);
  return { P, T, gf, pod, sh, cr };
}
// the side streets' walls: shops at their corners (specs), a car lift on the quieter side, tall grilled windows in between; the wings'
// ends on the north and south streets carry the corner shop's second window or an arched one
function streetWalls(ctx, P, T, gf, extra) {
  const w = gf.walls, g = T.gf, shops = T.shops || [], ends = {};
  for (const face of ['-x', '+x']) { const f = face === '-x' ? w.W : w.E, L = f.len, taken = [];
    for (const S of shops.filter(s => s.side === face)) { const len = Math.round(S.len * 10), atStart = (face === '-x') === (S.end === 'N'), a0 = atStart ? 0 : L - len, a1 = atStart ? len : L;
      const s2 = { ...S, trim: S.trim ?? g.trim, band: S.band ?? (g.band === g.trim ? 0x17171b : g.band) };
      if (!extra.shop?.(f, a0, a1, s2, P, T)) luxShop(f, a0, a1, s2, P.seed + a0, !atStart); taken.push([a0, a1]); ends[(S.end === 'N' ? 'N' : 'S') + (face === '-x' ? 'W' : 'E')] = s2; }
    // the rest of the face: the car lift in the middle of the longest free run on the face with one shop, windows elsewhere
    taken.sort((p, q) => p[0] - q[0]); const free = []; let a = 0; for (const [p, q] of taken) { if (p - a > 20) free.push([a, p]); a = Math.max(a, q); } if (L - a > 20) free.push([a, L]);
    const lift = face === (H(P.seed, 41) < .5 ? '-x' : '+x'); free.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    free.forEach(([p, q], k) => { if (lift && k === 0 && q - p >= 90) { const c = (p + q) >> 1; carLift(f, c - 17, g.trim, LIFTS[((P.i + 9) * 4 + (P.j - 4)) % LIFTS.length]); tallWindows(f, p, c - 22, g.trim, P.seed + p); tallWindows(f, c + 22, q, g.trim, P.seed + q); } else tallWindows(f, p, q, g.trim, P.seed + p); }); }
  wingEnd(w.NW, ends.NW, g.trim, P.seed + 1); wingEnd(w.NE, ends.NE, g.trim, P.seed + 2); wingEnd(w.SW, ends.SW, g.trim, P.seed + 3); wingEnd(w.SE, ends.SE, g.trim, P.seed + 4);
}
