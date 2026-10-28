// GATEHILL · hero · SOLITAIRE (block −9,6: Quarry Rd & Pine St, on the west woods). Owner: the Gatehill agent.
// Ids read -9_6·<group>·kind·n (groups: tower, shops, lobbyN, lobbyS, roof, ring).
//   The district's giant luxury object, in the spirit of the city's bail-bonds giant and its burger: an engagement ring the size of a
//   house on the roof of a violet diamond-lattice tower — a gold band standing in the slit of an open black velvet ring box, a brilliant
//   cut diamond held in four gold prongs, its facets glinting by day and lit white at night, so it sparkles over the woods. Two people
//   on the roof for scale: one proposing on one knee (well, standing: the rig has no kneel), one with a phone. At street level:
//   MAISON VERAN, the jeweller, with a diamond on a plinth in its window.
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { TOD } from '../kit.js';
import { buildEstate } from '../districts/estates/build.js';
import { topOf } from '../districts/estates/crowns.js';
import { C, CV, H, r2 } from '../districts/estates/lib.js';

export function solitaire(bank, b, A) {
  const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
  try { buildEstate(ctx, { after: ring }); ctx.finish(); } finally { REG.strict = false; }
}
// the ring: a 7.2 × 5.2 m volume on the roof (0.1 cubes): the box, the lid, the band, the prongs, the stone
function ring(ctx, P, T) {
  const top = topOf(P), [x0, z0, x1, z1] = top.rects[0], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2 + .8, y = top.y, W = 72, D = 52, Hh = 100;
  REG.group('ring');
  const V = ctx.volume(cx - W * CV / 2, y, cz - D * CV / 2, cx + W * CV / 2, y + Hh * CV, cz + D * CV / 2, { walk: false }), c = W >> 1, m = D >> 1;
  const VEL = 0x17171b, VEL2 = 0x2a1a3a, G = C.gold, GD = C.goldD, lit = TOD.night ? 3 : 1;
  // the box: black velvet, a violet cushion with the slit, a gold hinge line; the lid tilted back 70°
  V.box(4, 0, 12, W - 4, 11, D - 6, VEL); V.box(6, 11, 14, W - 6, 13, D - 8, VEL2); V.box(4, 10, 12, W - 4, 11, 13, G, 2); V.box(c - 18, 11, m - 1, c + 18, 13, m + 3, 0x0e0e12);
  for (let k = 0; k < 30; k++) { const yy = 11 + Math.round(k * .94), zz = 12 - Math.round(k * .34); V.box(4, yy, zz - 3, W - 4, yy + 1, zz, VEL); V.box(6, yy, zz, W - 6, yy + 1, zz + 1, VEL2); }
  // the band: a gold torus standing in the slit (outer r 3.2 m, inner 2.4 m, 0.9 m thick), shaded on its inner face
  const cy = 12 + 30, R0 = 32, R1 = 24, t0 = m - 4, t1 = m + 5;
  for (let x = c - R0; x <= c + R0; x++) for (let yy = 11; yy <= cy + R0; yy++) { const r = Math.hypot(x + .5 - c, yy + .5 - cy); if (r > R0 || r < R1) continue;
    const bev = Math.min(r - R1, R0 - r); for (let z = t0; z < t1; z++) { const e = Math.min(z - t0, t1 - 1 - z); if (bev < 1.5 && e < 1) continue; V.set(x, yy, z, r < R1 + 1.5 ? GD : ((x + yy) % 9 === 0 ? C.goldL : G), TOD.night ? 3 : 0); } }   // (matte toon gold by day, floodlit at night)
  // the setting: four prongs rising from the band's crown, the stone held between them
  const sy = cy + R0 - 1; for (const [dx, dz] of [[-9, -3], [8, -3], [-9, 4], [8, 4]]) V.box(c + dx, sy, m + dz, c + dx + 2, sy + 12, m + dz + 1, G, TOD.night ? 3 : 0);
  // the stone: a round brilliant — the pavilion (a cone point down), the girdle, the crown up to the table; facets by angle and height
  const g0 = sy + 8, facet = (x, yy, z, k) => { const a = Math.atan2(z + .5 - m, x + .5 - c), f = ((Math.floor((a + Math.PI) / (Math.PI / 8)) + k) % 3); return [0xffffff, 0xdff8ff, 0x9fe8ff][f]; };
  for (let yy = sy + 1; yy < g0; yy++) { const r = 2 + (yy - sy) * 2.1; for (let x = Math.floor(c - r); x <= c + r; x++) for (let z = Math.floor(m - r); z <= m + r; z++) if (Math.hypot(x + .5 - c, (z + .5 - m) * 1.4) <= r) V.set(x, yy, z, facet(x, yy, z, 0), lit); }
  for (let yy = g0; yy < g0 + 10; yy++) { const r = 18 - (yy - g0) * .8; for (let x = Math.floor(c - r); x <= c + r; x++) for (let z = Math.floor(m - r); z <= m + r; z++) { const d = Math.hypot(x + .5 - c, (z + .5 - m) * 1.4); if (d > r) continue;
    const top = yy === g0 + 9, glint = !TOD.night && H(x, yy, z) > .93; V.set(x, yy, z, glint ? C.glint : top ? (d < r * .55 ? 0xf2fbff : 0xdff8ff) : facet(x, yy, z, yy - g0), lit); } }
  // two people on the roof in front of it: one presenting, one filming it
  const yp = y + CV * 0, life = ctx.A.life ??= [];
  life.push({ x: r2(cx - 2.2), y: r2(y), z: r2(cz + D * CV / 2 + 1.2), ry: Math.PI + .3, act: 'arms', seed: P.seed + 51, hand: true }, { x: r2(cx + 1.8), y: r2(y), z: r2(cz + D * CV / 2 + 1.6), ry: Math.PI - .4, act: 'phone', seed: P.seed + 52, hand: true });
  REG.group('tower');
}
