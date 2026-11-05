// AI City · a home's frame from its lot anchor (lotEntry: index.js's homes runtime and C2-indoors' plan.js read the same one). Pure.
import { TIER_OF } from './assign.js';
// fix round · a home's roof top over its anchor's roof line (a house's anchor carries its eave only), measured by depth hits over 44 houses
// and 54 trailers: one-storey houses (eave 3.4 m) up to +4.5 (A-frames, capes), two-storey (eave 6.2) up to +3.6, trailers up to +1.6
const RIDGE = { low: 4.6, two: 3.7, trailer: 1.7 };
// ── the homes the streamed blocks anchored: a frame per home (local x across its front, local z toward the street)
// vol [x0, x1, y0, y1, z0, z1]: the home's real building volume in that frame (fix round: fitted, not a slab of sky over the roof) —
// what a clicked point must fall in (a margin for eaves, porches, sills and fire escapes), and the ray's box when a depth pick fails
export function lotEntry(id, l, block) {
  const f = l.face ?? [0, 1], R = l.house; if (!R) return null; const alongX = f[1] !== 0, yaw = l.yaw || 0;
  let fw = alongX ? R[2] - R[0] : R[3] - R[1], fd = alongX ? R[3] - R[1] : R[2] - R[0], th = Math.atan2(f[0], f[1]) + yaw;
  if (yaw) { const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), k = c * c - s * s; [fw, fd] = [(fw * c - fd * s) / k, (fd * c - fw * s) / k]; }
  if (fw < 4.3 && fd > fw + 2.5) { th -= Math.PI / 2; [fw, fd] = [fd, fw]; }   // a narrow pad end-on to the street: cut its long side instead
  const tier = TIER_OF[l.tier] ?? l.tier ?? 'house', wallY = l.wall ? l.wall[1] - l.wall[4] / 2 : .2, floorY = wallY + (tier === 'trailer' ? .45 : .32), roof = l.roof ?? floorY + 3;
  const ridge = roof + (tier === 'trailer' ? RIDGE.trailer : roof - wallY < 4 ? RIDGE.low : RIDGE.two);   // (a house's anchor roof is its eave; a trailer's is its top)
  return { id, kind: 'lot', tier, block, cx: (R[0] + R[2]) / 2, cz: (R[1] + R[3]) / 2, th, fw, fd, floorY, H: Math.max(2.3, Math.min(2.8, roof - floorY - .02)), top: roof + 4, ceiling: false,
    vol: [-fw / 2 - .7, fw / 2 + .7, wallY - .4, ridge + .4, -fd / 2 - .7, fd / 2 + 1.5] };
}
// the home's seed (index.js build: the room's dice, its side room's bed)
export const homeSeed = id => (id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) & 0xffff) || 1;
