// PLEASANTVIEW · THE FAR TIER (0.5 m cubes; owner: the Pleasantview section agent). Every house from the same layout the build uses:
// its body in its wall colour (sides leaning 30 % toward the haze, like every far tier) with its shell painted in 0.5 cubes the way the
// shared far tier does (far.js): a base course, glass in the near tier's window rows (shutters beside them on shuttered houses), the
// eave band in the trim colour, the front door; its roof stepped at 0.5 m in shingle courses (gable, hip, gambrel, A-frame, flat), the
// chimney, the garage and its door, the street's trees and the back-yard pools, so a far street keeps its rooflines and still reads as houses.
import { PAL, SIDE, hash, shade } from '../../style.js';
import { specOf, layoutOf, frameOf, FLOOR, STOREY } from './plan.js';
import { air } from './brush.js';
import { P as PITCH } from '../../../../world/city.js';   // (SPREAD: the plan's pitch, never a literal 32)

const H1 = (FLOOR + STOREY + 1) / 10, H2 = (FLOOR + 2 * STOREY + 1) / 10;
const TREEC = { 'Jackson St': 0x3cc85a, 'Union Ave': 0x2fb04c, 'Oak St': 0x25a748, 'Pine St': 0x1f7a45, 'Willow St': 0x6fcf4f, 'Aspen St': 0x7ed957, 'Fox Run': 0x196a3c };
// a roof over a world rect: layers of 0.5 m in shingle courses; ridge 'x' (slopes toward ±z), 'z' (toward ±x), 'hip'; inset `run` m a
// layer → the height of its peak
function roof(c, [x0, z0, x1, z1], y, kind, col, run = .5, max = 12) { let top = y;
  for (let k = 0; k < max; k++) { const ix = kind === 'z' || kind === 'hip' ? k * run : 0, iz = kind === 'x' || kind === 'hip' ? k * run : 0;
    const a0 = x0 - .25 + ix, a1 = x1 + .25 - ix, b0 = z0 - .25 + iz, b1 = z1 + .25 - iz; if (a1 - a0 < .5 || b1 - b0 < .5) break;
    c.box(a0, y + k * .5, b0, a1, y + k * .5 + .5, b1, k % 2 ? shade(col, .86) : col); top = y + k * .5 + .5; }
  return top;
}
// a body in 0.5 cubes with its shell painted: the base course, the eave band, glass in the window rows (1.0–2.5 m and 4.0–5.5 m up, as
// the near tier's sills), shutters beside the glass on shuttered houses, the front door on the street face (front: +1 = max z)
function body(c, R, top, s, front, doorX) {
  const S = .5, X0 = c.i * PITCH, Z0 = c.j * PITCH, ix = x => Math.round((x - X0) / S), iz = z => Math.round((z - Z0) / S);
  const x0 = ix(R[0]), x1 = Math.max(x0 + 1, ix(R[2])), z0 = iz(R[1]), z1 = Math.max(z0 + 1, iz(R[3])), H = Math.max(2, Math.round((top - SIDE) / S));
  const wall = air(s.wall), g0 = air(PAL.glassLo), g1 = air(PAL.glassHi), trim = air(s.trim), sh = s.shutter ? air(s.shutter) : null, base = air(shade(s.wall, .72)), door = air(s.door);
  const fz = front > 0 ? z1 - 1 : z0, dx = doorX === undefined ? -1 : ix(doorX), glassRow = y => (y >= 2 && y <= 4) || (H > 9 && y >= 8 && y <= 10);
  c.box(R[0], SIDE, R[1], R[2], top, R[3], (x, y, z) => { const ex = x === x0 || x === x1 - 1, ez = z === z0 || z === z1 - 1; if (!ex && !ez) return wall;
    if (y === H - 1) return trim; if (y === 0) return base;
    if (z === fz && !ex && x === dx && y <= 4) return door;
    if ((ex && ez) || !glassRow(y)) return wall;
    const a = ez ? x - x0 : z - z0, g = (y === 4 || y === 10) ? g1 : g0;
    if (sh) { const m = a % 4; return m === 1 ? g : (m === 0 || m === 2) ? sh : wall; }
    return a % 3 === 1 ? g : wall; });
}
const CHIMNEY = { colonial: 'end', cape: 'end', gambrel: 'end', hip: 'side', gablefront: 'side', bungalow: 'side', aframe: 'mid' };
export function farLots(c) {
  for (const l of c.simLots) { const s = specOf(l); if (!s) continue; farHouse(c, s); }
}
export function farHouse(c, s) {
  const L = layoutOf(s), F = frameOf(s.l), b = L.body, rect = r => F.rect(r[0] / 10, r[1] / 10, r[2] / 10, r[3] / 10), wall = air(s.wall), R = rect(b);
  const two = s.type === 'colonial' || s.type === 'hip' || s.type === 'gablefront' || s.type === 'twofam', top = SIDE + (two ? H2 : s.type === 'aframe' ? .9 : H1), f = F.f;
  body(c, R, top, s, f, F.x(L.door / 10));
  const alongU = 'x', alongV = 'z';   // (u runs along x for every lot: the lots face ±z)
  let peak = top;
  switch (s.type) {
    case 'colonial': case 'cape': peak = roof(c, R, top, alongU, s.roof, s.type === 'cape' ? .34 : .5); break;
    case 'gablefront': case 'bungalow': peak = roof(c, R, top, alongV, s.roof, s.type === 'bungalow' ? 1 : .5); break;
    case 'hip': peak = roof(c, R, top, 'hip', s.roof, .5); break;
    case 'ranch': peak = roof(c, R, top, hash(s.seed, 81) < .5 ? 'hip' : alongU, s.roof, 1); break;
    case 'gambrel': roof(c, R, top, alongU, s.roof, .25, 4); peak = roof(c, [R[0], R[1] + 1, R[2], R[3] - 1], top + 2, alongU, s.roof, 1, 3); break;
    case 'split': { const Rr = s.driveSide === 'R', mid = Rr ? b[2] - 40 : b[0] + 40, A = rect(Rr ? [mid, b[1], b[2], b[3]] : [b[0], b[1], mid, b[3]]);
      body(c, A, SIDE + H2, s, f); roof(c, A, SIDE + H2, alongV, s.roof, 1); peak = roof(c, R, top, alongU, s.roof, 1); break; }
    case 'aframe': peak = roof(c, R, top, alongV, s.roof, .25, 16); break;
    default: c.box(R[0], top, R[1], R[2], top + .5, R[3], 0x9c9aa2); peak = top + .5;   // the two-family's flat roof (grey deck, as the build)
  }
  // the chimney where the build puts it: up a gable end or a side wall on the side away from the drive, or through the roof
  const ck = CHIMNEY[s.type] === 'end' || CHIMNEY[s.type] === 'side' || (s.type === 'ranch' && hash(s.seed, 81) >= .5) ? 'wall' : CHIMNEY[s.type] === 'mid' || s.type === 'ranch' ? 'mid' : null;
  if (s.chimney && ck) { const Rr = s.driveSide === 'R', cv = (b[1] + b[3]) >> 1, brick = air(0x9c4a34);
    if (ck === 'mid') { const [x, z] = F.at((b[0] + b[2]) / 20, cv / 10); c.box(x - .25, top, z - .25, x + .25, peak + .5, z + .25, brick); }
    else { const u0 = Rr ? b[0] - 6 : b[2], v0 = CHIMNEY[s.type] === 'side' ? b[1] + 12 : cv - 4; if (u0 >= 0 && u0 + 6 <= s.W10) { const C = rect([u0, v0, u0 + 6, v0 + 8]); c.box(C[0], SIDE, C[1], C[2], peak + .3, C[3], brick); } } }
  if (L.garage) { const G = rect(L.garage), gf = L.detached ? f : f; c.box(G[0], SIDE, G[1], G[2], SIDE + 2.6, G[3], wall); roof(c, G, SIDE + 2.6, 'hip', s.roof, 1, 3);
    const gx = (G[0] + G[2]) / 2, [z0, z1] = gf > 0 ? [G[3] - .5, G[3]] : [G[1], G[1] + .5]; c.box(gx - 1.25, SIDE, z0, gx + 1.25, SIDE + 2, z1, air(s.gdoor)); }
  if (L.carport) { const G = rect(L.carport); c.box(G[0], SIDE + 2.4, G[1], G[2], SIDE + 2.9, G[3], s.roof); }
  // trees: the front one and the back shade tree (their crowns as blocks), a pool in the back yard as a blue slab
  const tc = TREEC[s.street] || 0x2fb04c, H = k => hash(s.seed, k, 719), out = (b[1] - 17) / 10, [d0, , d1] = L.drive.map(x => x / 10), du = L.door / 10;
  // the street tree in the kerb strip (where the build puts it: yard.js trees)
  if (H(6) < .78) { const cu = [du < s.W / 2 ? s.W - 1.2 : 1.2, (d0 + d1) / 2 < s.W / 2 ? s.W - 2.5 : 2.5, s.W / 2].find(u => u < d0 - 1.2 || u > d1 + 1.2);
    if (cu !== undefined) { const [tx, tz] = F.at(cu, -1.55); c.box(tx - .25, SIDE, tz - .25, tx + .25, SIDE + 3, tz + .25, 0x7a4a22); c.box(tx - 1.25, SIDE + 3, tz - 1.25, tx + 1.25, SIDE + 5.5, tz + 1.25, tc); } }
  if (s.front !== 'none' && out > 2.4) { const [tx, tz] = F.at(L.door / 10 < s.W / 2 ? s.W - 1.8 : 1.8, 1.5); c.box(tx - .25, SIDE, tz - .25, tx + .25, SIDE + 2, tz + .25, 0x7a4a22); c.box(tx - 1, SIDE + 2, tz - 1, tx + 1, SIDE + 4, tz + 1, s.front === 'ornamental' ? 0xff7ab6 : tc); }
  if (s.big) { const [tx, tz] = F.at(s.W / 2, s.D - .9); c.box(tx - .25, SIDE, tz - .25, tx + .25, SIDE + 2.5, tz + .25, 0x7a4a22); c.box(tx - 1.75, SIDE + 2.5, tz - 1.75, tx + 1.75, SIDE + 5.5, tz + 1.75, tc); }
  if (s.yardB === 'pool') { const [px0, pz0, px1, pz1] = F.rect(s.W / 2 - 2.5, b[3] / 10 + 1.2, s.W / 2 + 2.5, Math.min(s.D - .6, b[3] / 10 + 3.8)); c.box(px0, SIDE, pz0, px1, SIDE + .5, pz1, 0x2fc1e8); }
  if (s.yardB === 'trampoline' || s.yardB === 'aboveground') { const [tx, tz] = F.at(s.W / 2, (b[3] / 10 + s.D) / 2); c.box(tx - 1.25, SIDE, tz - 1.25, tx + 1.25, SIDE + .5, tz + 1.25, s.yardB === 'trampoline' ? 0x2a2a30 : 0x2fb8e8); }
}
