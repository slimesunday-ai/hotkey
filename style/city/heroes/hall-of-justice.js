// HALL OF JUSTICE (block 0,−2) · owner: the Hall of Justice agent (LOCATIONS.md). Ids read 0_-2·hall·kind·n.
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';

// ═════════════════════════ HALL OF JUSTICE (block 0,−2): monumental steps to the plaza, colonnade, gold dome, Lady Justice
export function hallOfJustice(bank, b, A) {
  REG.group('hall'); const R = b.R, T = PAL.white, WALL = 0x12b3a0;   // x 6…28, z −60…−36 · faces the plaza across 1st St (south)
  const { V, B } = heroVol(R.x0, R.z0, R.x1, R.z1, 18, ['+z', '-z', '-x', '+x'], CV, 6), s = CV;
  const mx0 = B.x0 + 20, mx1 = B.x1 - 20, mz0 = B.z0 + 16, mz1 = B.z1 - 90, H = 120;          // main mass
  V.box(mx0, 0, mz0, mx1, H, mz1, WALL); V.box(mx0 + 1, H - 1, mz0 + 1, mx1 - 1, H, mz1 - 1, 0xe6e2d8);
  const MB = { x0: mx0, z0: mz0, x1: mx1, z1: mz1 };
  for (const side of ['-z', '-x', '+x', '+z']) { const f = frame(V, MB, side); f.box(-2, H - 6, 0, f.len + 2, H, 4, T); f.box(-1, H, 0, f.len + 1, H + 4, 2, T); f.box(0, 0, 0, f.len, 6, 3, T);
    for (const a0 of bays(f.len, 26)) for (const y0 of [18, 60]) win(f, a0 + 6, y0, 14, 30, T, {}); }
  // podium + monumental steps (rise 0.2, run 0.5) toward the plaza
  const px0 = mx0 - 6, px1 = mx1 + 6, pz1 = mz1 + 28; V.box(px0, 0, mz1, px1, 24, pz1, T);
  for (let k = 0; k < 12; k++) V.box(px0 + 10, 0, pz1 + k * 5, px1 - 10, 24 - (k + 1) * 2, pz1 + (k + 1) * 5, k % 2 ? 0xecebe4 : T);
  for (const x of [px0, px1 - 10]) V.box(x, 0, pz1, x + 10, 30, pz1 + 60, T);
  // colonnade: 6 chunky columns (octagon-cut), entablature, pediment with the name
  const cols = 6, cz = mz1 + 14, span = (px1 - px0 - 24) / (cols - 1);
  for (let c = 0; c < cols; c++) { const x = Math.round(px0 + 12 + c * span); for (let y = 24; y < 94; y++) for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (Math.abs(dx) + Math.abs(dz) <= 8) V.set(x + dx, y, cz + dz, (y > 90 || y < 27) ? 0xecebe4 : T); }
  V.box(px0, 94, mz1 - 2, px1, 108, cz + 8, T); V.box(px0 - 2, 106, mz1 - 2, px1 + 2, 110, cz + 10, T);
  for (let j = 0; j < 22; j++) { const w = Math.round((px1 - px0) / 2 - j * ((px1 - px0) / 2) / 22); V.box(Math.round((px0 + px1) / 2 - w), 110 + j, mz1, Math.round((px0 + px1) / 2 + w), 111 + j, cz + 8, j === 0 ? T : 0xecebe4); }
  const f = frame(V, { x0: px0, z0: mz1, x1: px1, z1: cz + 8 }, '+z'); f.text('HALL OF JUSTICE', f.len >> 1, 105, 1, 2, WALL, 0, 1, 1);
  A.courtSteps = [(R.x0 + R.x1) / 2, wz(V, pz1 + 30)];
  meshVol(V, bank);
  // drum + dome (0.2 grain), then Lady Justice on the lantern: a 4× chars.js figure in chrome, blindfolded (people.js)
  const cx = wx(V, (mx0 + mx1) / 2), czW = wz(V, (mz0 + mz1) / 2), y0 = SIDE + H * s, D = new Vol(70, 80, 70, { s: .2, org: [cx - 7, y0, czW - 7] }), m = 35;
  for (let y = 0; y < 18; y++) for (let x = -24; x <= 24; x++) for (let z = -24; z <= 24; z++) { const r = Math.hypot(x, z); if (r <= 24) D.set(m + x, y, m + z, (y > 14 || y < 2) ? T : (r > 23 && (Math.round(Math.atan2(z, x) * 8) % 2 === 0) ? T : WALL)); }
  for (let y = 18; y < 44; y++) { const rr = 26 * Math.sqrt(Math.max(0, 1 - ((y - 18) / 26) ** 2)); for (let x = -26; x <= 26; x++) for (let z = -26; z <= 26; z++) if (Math.hypot(x, z) <= rr) D.set(m + x, y, m + z, (y % 6 === 0) ? 0xf2cc55 : 0xffc21a, 2); }
  D.box(m - 4, 42, m - 4, m + 5, 54, m + 5, T); D.box(m - 5, 54, m - 5, m + 6, 56, m + 6, 0xffc21a, 2);
  meshVol(D, bank);
  A.giants.push({ x: cx, z: czW, y: y0 + 56 * .2, rot: 0, look: 'justice', ry: 0, scale: 3.2 });
  for (const [dx, dz, k] of [[-6.5, -4.5, 0], [6.5, -4.5, 0], [-6.5, 4.5, 1], [6.5, 4.5, 2]]) stamp(k === 0 ? acBox() : k === 1 ? pigeons(7) : vent(1), bank, 0, cx + dx, y0, czW + dz);
}

