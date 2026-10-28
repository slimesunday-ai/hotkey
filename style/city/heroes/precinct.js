// PRECINCT 9 (block 1,−1) · owner: the Precinct agent (LOCATIONS.md). Ids read 1_-1·precinct·kind·n.
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';
import { kerbX, kerbZ } from '../districts/frame.js';

// ═════════════════════════ PRECINCT 9 (block 1,−1): blue station house, green lamps, giant 9, radio mast, cruisers
export function precinct(bank, b, A) {
  REG.group('precinct'); const R = b.R, BL = 0x2f5bff, T = PAL.white;     // x 36…60, z −28…−6 · entrance faces the plaza on Kent St (west)
  const L = { x0: R.x0 + 1, z0: R.z0 + 2, x1: R.x1 - 1, z1: R.z1 - 1 }, H = 126;
  const { V, B } = heroVol(L.x0, L.z0, L.x1, L.z1, 22, ['-x', '+z', '-z', '+x']);
  const F = mass(V, B, H, BL, T, ['-x', '+z', '-z', '+x'], { parapet: 6, roof: 0xd2d3d6 }); neutralCap(V, B, H, BL, 0xa9a7a4);
  { const cx = (B.x0 + B.x1) >> 1, cz = (B.z0 + B.z1) >> 1; for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) { const r = Math.hypot(x, z), sq = Math.max(Math.abs(x), Math.abs(z)); if (r <= 34) V.set(cx + x, H - 1, cz + z, r > 29 ? PAL.yellow : r > 27 ? 0xf7f7f2 : 0xe8232a); else if (sq <= 40 && sq >= 38) V.set(cx + x, H - 1, cz + z, ((x + z + 80) >> 2) & 1 ? PAL.yellow : 0x17171b); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; V.set(cx + Math.round(Math.cos(a) * 36), H, cz + Math.round(Math.sin(a) * 36), 0xfff3c4, 3); }
    const Hm = tm('H'); for (let j = 0; j < 7; j++) for (let i = 0; i < Hm.w; i++) if (Hm.at(i, j)) V.box(cx - 15 + i * 6, H - 1, cz - 21 + j * 6, cx - 9 + i * 6, H, cz - 15 + j * 6, PAL.white); }
  for (const side of ['-x', '+z', '-z', '+x']) { const f = F(side); f.box(0, 0, 0, f.len, 36, 2, shade(BL, .78)); f.box(-1, 34, 0, f.len + 1, 37, 3, T);
    for (const a0 of bays(f.len, 26)) { for (const y0 of [42, 72, 102]) win(f, a0 + 6, y0, 14, 18, T, {}); if (side !== '-x' && side !== '+z') { win(f, a0 + 6, 8, 14, 18, T, {}); for (let a = a0 + 8; a < a0 + 20; a += 3) f.box(a, 8, -1, a + 1, 26, 0, PAL.iron); } } }
  const W = F('-x'), mid = W.len >> 1;
  W.box(mid - 20, 0, 0, mid + 20, 40, 3, T); W.box(mid - 12, 4, -3, mid + 12, 30, 3, AIR); W.box(mid - 12, 4, -4, mid + 12, 30, -3, (a, y) => (Math.abs(a - mid) < 1) ? PAL.iron : (y > 24 ? PAL.litHi : 0x2a3150), 1);
  for (let k = 0; k < 4; k++) W.box(mid - 22 + k, 0, 3 + k * 3, mid + 22 - k, 4 - k, 6 + k * 3, 0xecebe4);
  W.box(mid - 30, 38, 3, mid + 30, 50, 4, T); W.text('PRECINCT 9', mid, 48, 4, 5, BL, TOD.night ? 3 : 0, 1, 1);
  for (const s of [-1, 1]) { const a = mid + s * 26; W.box(a - 1, 0, 8, a + 1, 28, 10, PAL.iron); W.box(a - 3, 28, 6, a + 3, 34, 12, 0x2fbf55, 3); W.box(a - 2, 34, 7, a + 2, 35, 11, PAL.iron); }
  const S = F('+z'); for (const a0 of [8, 44, 80, 116]) if (a0 + 30 < S.len) { S.box(a0, 1, -2, a0 + 28, 30, 2, AIR); S.box(a0, 1, -3, a0 + 28, 30, -2, (a, y) => y % 3 === 0 ? 0x8f949c : 0xb9bec6); }
  // giant "9" on the parapet, facing the plaza
  const M = rasterMask('9', '900 60px Impact, "Arial Black", sans-serif'); for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) W.box(mid - (M.w >> 1) + i, H + 6 + M.h - j, -1, mid - (M.w >> 1) + i + 1, H + 7 + M.h - j, 3, T);
  meshVol(V, bank);
  // radio mast on the back corner: red/white lattice, blinking top
  const mx = L.x1 - 3, mz = L.z0 + 3, top = SIDE + (H + 6) * CV, MV = new Vol(14, 150, 14, { s: CV, org: [mx - .7, top, mz - .7] });
  for (let y = 0; y < 146; y++) { const c = (y / 12 | 0) % 2 ? PAL.red : T, w = Math.max(2, 6 - (y / 30 | 0)); for (const [x, z] of [[7 - w, 7 - w], [7 + w, 7 - w], [7 - w, 7 + w], [7 + w, 7 + w]]) MV.set(x, y, z, c); if (y % 8 === 0) { MV.box(7 - w, y, 7 - w, 7 + w + 1, y + 1, 7 - w + 1, c); MV.box(7 - w, y, 7 + w, 7 + w + 1, y + 1, 7 + w + 1, c); } }
  MV.box(5, 146, 5, 10, 150, 10, PAL.red, 3); meshVol(MV, bank);
  // flagpole + two cruisers on Kent St
  const FL = new Vol(4, 70, 30, { s: CV, org: [L.x0 - .6, top, (L.z0 + L.z1) / 2 - .2] }); FL.box(1, 0, 1, 3, 68, 3, PAL.iron); FL.box(1, 50, 3, 3, 64, 26, BL); const n9 = tm('9'); for (let j = 0; j < 7; j++) for (let i = 0; i < n9.w; i++) if (n9.at(i, j)) for (const x of [0, 3]) { FL.set(x, 61 - j * 1.5 | 0, 12 + i * 2, T); FL.set(x, 61 - j * 1.5 | 0, 13 + i * 2, T); } meshVol(FL, bank);
  for (const [x, z, k] of [[L.x0 + 3, L.z1 - 3, 0], [L.x0 + 6, L.z1 - 3, 1], [L.x1 - 3, L.z1 - 4, 2], [L.x0 + 3, L.z0 + 3, 3]]) stamp(k === 0 ? dish(0) : k === 1 ? dish(1) : k === 2 ? acBox() : antenna(2), bank, k & 1, x, SIDE + H * CV, z);
  stamp(copCar(), bank, 2, kerbX(33.1), 0, kerbZ(-20.5)); stamp(copCar(), bank, 2, kerbX(33.1), 0, kerbZ(-13.5));   // (SPREAD: at Kent St's kerb, today's metres)
  A.precinctSteps = [L.x0 - 1.0, (L.z0 + L.z1) / 2];
}

