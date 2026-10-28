// GLASSWALL PLAZA (block 0,−1) · owner: the Plaza agent (LOCATIONS.md). Ids read 0_-1·plaza·kind·n (the dealing corner at Kent & 1st lands
// in this block too, under the group `corner`, owned by the corners agent).
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';

// ═════════════════════════ GLASSWALL PLAZA (block 0,−1): toon paving, fountain, the red 404 sculpture, trees, carts
export function plaza(bank, b, A) {
  REG.group('plaza'); const R = b.R, W = R.x1 - R.x0, D = R.z1 - R.z0, V = new Vol(Math.round(W / CV), 50, Math.round(D / CV), { s: CV, org: [R.x0, SIDE, R.z0] }), nx = V.nx, nz = V.nz, cx = nx >> 1, cz = nz >> 1;
  V.box(0, 0, 0, nx, 1, nz, (x, y, z) => { const e = Math.min(x, z, nx - 1 - x, nz - 1 - z); if (e < 6) return 0x12b3a0; const t = ((x / 20 | 0) + (z / 20 | 0)) & 1; return Math.hypot(x - cx, z - cz) < 58 && Math.hypot(x - cx, z - cz) > 52 ? PAL.pink : (t ? 0xfff0d0 : PAL.white); });
  // fountain: square basin, water, a two-tier spout, arcs
  for (let x = -32; x < 32; x++) for (let z = -32; z < 32; z++) { const e = Math.max(Math.abs(x + .5), Math.abs(z + .5)); if (e > 32) continue; if (e > 28) V.box(cx + x, 1, cz + z, cx + x + 1, 6, cz + z + 1, 0xecebe4); else V.set(cx + x, 3, cz + z, (x * 3 + z * 5) % 13 === 0 ? 0xbfefff : 0x3fc8ff, TOD.night ? 3 : 1); }
  V.box(cx - 3, 1, cz - 3, cx + 3, 26, cz + 3, 0xecebe4); V.box(cx - 10, 16, cz - 10, cx + 10, 18, cz + 10, 0xecebe4); V.box(cx - 8, 18, cz - 8, cx + 8, 19, cz + 8, 0x3fc8ff, 1);
  for (let k = 0; k < 4; k++) { const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][k]; for (let t = 0; t < 16; t++) V.set(cx + dx * (10 + t * .9), 17 - (t * t) * .06, cz + dz * (10 + t * .9), 0xbfefff, 1); }
  V.box(cx - 1, 26, cz - 1, cx + 1, 34, cz + 1, 0xbfefff, 1);
  // the red 4AM sculpture (signage pass 3: it read 404; the 4 keeps its footprint by the tree) (letters 0.4 thick, 2.5 tall) on a plinth, facing the street corner
  const t = tm('4AM'), sx = 18, sz = 36; V.box(sx - 3, 1, sz - 5, sx + t.w * 4 + 3, 4, sz + 6, 0xecebe4);
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) V.box(sx + i * 4, 4 + (6 - j) * 4, sz - 2, sx + i * 4 + 4, 8 + (6 - j) * 4, sz + 2, PAL.red);
  // planters with cubic trees at the corners, benches round the fountain
  for (const [px, pz] of [[14, 14], [nx - 30, 14], [14, nz - 30], [nx - 30, nz - 30]]) V.box(px, 1, pz, px + 16, 6, pz + 16, 0x25b84c);
  REG.surface(V); meshVol(V, bank);   // pass 1d: the paving is a walkable surface
  for (const [px, pz] of [[2.2, 2.2], [W - 2.2, 2.2], [2.2, D - 2.2], [W - 2.2, D - 2.2]]) stamp(tree(px * 7 + pz | 0), bank, 0, R.x0 + px, SIDE + .6, R.z0 + pz);
  const bx = R.x0 + W / 2, bz = R.z0 + D / 2;
  [[0, -5.4, 2], [0, 5.4, 0], [-5.4, 0, 3], [5.4, 0, 1]].forEach(([dx, dz, r]) => stamp(bench(), bank, r, bx + dx, SIDE + .1, bz + dz));
  A.plaza = { cx: bx, cz: bz, R };
}

