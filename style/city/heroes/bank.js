// GLASSWALL SAVINGS (block −1,−1) · owner: the Bank agent (LOCATIONS.md). Ids read -1_-1·bank·kind·n for the bank, -1_-1·L<k>·kind·n for the
// generated west lots. The dealing corner at Jay & 1st lands here too (group `corner`, owned by the corners agent).
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';

// ═════════════════════════ BANK (block −1,−1): GLASSWALL SAVINGS faces the plaza across Main St; generator fills the west half
export function bankBlock(bank, b, A) {
  REG.group('bank'); const R = b.R, L = { x0: R.x0 + 10, z0: R.z0, x1: R.x1, z1: R.z1 }, H = 110, WALL = 0x25b84c, T = PAL.cream;
  const { V, B } = heroVol(L.x0, L.z0, L.x1, L.z1, 15, ['+x', '-z', '+z']);
  const F = mass(V, B, H, WALL, T, ['+x', '-z', '+z'], { parapet: 6, roof: 0xefeee9 }); neutralCap(V, B, H, WALL, 0xbdbab3);
  for (const side of ['-z', '+z', '+x']) { const f = F(side); for (const a0 of bays(f.len, 30)) for (const y0 of [12, 50]) win(f, a0 + 8, y0, 14, 30, T, {}); for (const a0 of bays(f.len, 30)) win(f, a0 + 8, 88, 14, 14, T, {}); }
  const E = F('+x'), mid = E.len >> 1;
  // the podium runs out to 0.9 m from the curb and a low step to 0.8 m: the walkers' clear path passes in front of it (cleanup pass; the
  // flight of four steps ran on to the road and was cut off at the volume's edge 0.4 m from the curb, so the walkers had to take the road)
  E.box(mid - 34, 0, 0, mid + 34, 6, 13, 0xecebe4); E.box(mid - 50, 0, 0, mid + 50, 10, 12, T);   // (the step drawn from the wall, under the podium: one part)
  for (let c = 0; c < 4; c++) { const a = mid - 30 + c * 20; for (let y = 10; y < 76; y++) for (let da = -4; da <= 4; da++) for (let dd = 3; dd <= 11; dd++) if (Math.abs(da) + Math.abs(dd - 7) <= 6) E.set(a + da, y, dd, T); }
  E.box(mid - 50, 76, 0, mid + 50, 88, 12, T); E.text('GLASSWALL SAVINGS', mid, 86, 12, 13, PAL.gold, 2, 1, 1);
  E.box(mid - 12, 10, -3, mid + 12, 44, 1, AIR); E.box(mid - 12, 10, -4, mid + 12, 44, -3, (a, y) => y > 36 ? PAL.litHi : 0x243a6a, 1);
  for (let a = -6; a <= 6; a++) for (let y = -6; y <= 6; y++) { const r2 = Math.hypot(a, y); if (r2 <= 6.5) E.set(mid + a, 100 + y, 1, r2 > 5.5 ? PAL.gold : ((a === 0 && y > 0 && y < 5) || (y === 0 && a > 0 && a < 4) ? PAL.ink : PAL.white), r2 > 5.5 ? 2 : 0); }
  meshVol(V, bank); { const top = SIDE + H * CV, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2; stamp(skylight(), bank, 0, cx - 3, top, cz - 5); stamp(skylight(), bank, 0, cx + 3, top, cz - 5); stamp(solar(), bank, 0, cx, top, cz + 4); stamp(acBox(), bank, 1, cx - 5, top, cz + 1); stamp(acBox(), bank, 1, cx + 5, top, cz + 1); stamp(dish(1), bank, 2, cx + 5, top, cz - 9); }
  const west = { ...b, R: { x0: R.x0, z0: R.z0, x1: R.x0 + 10, z1: R.z1 } }, r = rng(4004), lots = [];
  let z = R.z0; for (const [d, faces] of [[8, ['-z', '-x']], [7, ['-x']], [R.z1 - R.z0 - 15, ['+z', '-x']]]) { lots.push({ x0: R.x0, z0: z, x1: R.x0 + 10, z1: z + d, faces, corner: faces.length > 1 ? 'W' : null, w: 10, d, main: faces[faces.length - 1] === '-x' ? '-x' : faces[0], front: d }); z += d; }
  lots.forEach(l => { l.main = '-x'; l.faces = [...new Set(['-x', ...l.faces])]; l.front = l.d; }); specify({ ...west, noAlley: true }, lots, r, 88000); lots.forEach(l => { l.H = heightOf(l.spec); });
  REG.plan(lots.map((l, k) => massPlan(l, 'L' + k)).filter(Boolean)); lots.forEach((l, k) => { REG.group('L' + k); buildLot(bank, l, A); }); REG.group('bank');
  A.bankDoor = [L.x1 + .5, (L.z0 + L.z1) / 2]; REG.door(A.bankDoor[0] + .1, A.bankDoor[1], 1);
}

