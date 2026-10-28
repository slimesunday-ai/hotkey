// Shared hero helpers (pass 1d split): owned by the systems agent, used by every hero module. Heroes are hand-made set pieces on
// the real lots; each lives in its own file so one location agent can own it (LOCATIONS.md).
import { Vol, textMask } from '../vox.js';
import { PAL, CV, SIDE, hash } from '../style.js';
import { REG } from '../audit.js';

// the mass rects a hero will build, registered up front so each part is clipped against its neighbours (pass 1d; h in city voxels)
export const planParts = parts => REG.plan(parts.map(([x0, z0, x1, z1, h, group]) => ({ box: [x0, SIDE, z0, x1, SIDE + h * CV, z1], group })));
// a dense volume over a world rect with street-face padding; B = the mass in voxel coords
export function heroVol(x0, z0, x1, z1, hU, faces, s = CV, padS = 16) {
  const pad = f => (faces.includes(f) ? padS : 3), px0 = pad('-x'), px1 = pad('+x'), pz0 = pad('-z'), pz1 = pad('+z');
  const nx = Math.round((x1 - x0) / s) + px0 + px1, nz = Math.round((z1 - z0) / s) + pz0 + pz1;
  return { V: new Vol(nx, Math.round(hU / s), nz, { s, org: [x0 - px0 * s, SIDE, z0 - pz0 * s] }), B: { x0: px0, z0: pz0, x1: nx - px1, z1: nz - pz1 } };
}
export const wx = (V, x) => V.org[0] + x * V.s, wz = (V, z) => V.org[2] + z * V.s;
const TMC = new Map(); export const tm = s => { let m = TMC.get(s); if (!m) TMC.set(s, m = textMask(s)); return m; };
export function interior(V, B, H, floor) {    // lit shop room: floor pattern, white ceiling with light strips
  V.clear(B.x0 + 2, 0, B.z0 + 2, B.x1 - 2, H, B.z1 - 2);
  V.box(B.x0 + 2, 0, B.z0 + 2, B.x1 - 2, 1, B.z1 - 2, floor ?? ((x, y, z) => ((x >> 2) + (z >> 2)) & 1 ? 0xf2f2f2 : 0x26262c));
  V.box(B.x0 + 2, H - 1, B.z0 + 2, B.x1 - 2, H, B.z1 - 2, 0xefeee8); for (let x = B.x0 + 6; x < B.x1 - 6; x += 14) V.box(x, H - 2, B.z0 + 6, x + 6, H - 1, B.z1 - 6, 0xfffbe8, 3);
}
export const PRODUCTS = [0xe8232a, 0xffd21f, 0x2f5bff, 0xff7a1a, 0x14a83b, 0xff4fa3, 0xffffff, 0x7a3cff, 0x2de2e6, 0x17171b];
export function shelves(V, x0, z0, x1, z1, y1, seed) { V.box(x0, 1, z0, x1, y1, z1, 0xe9e5dc); for (let y = 3; y < y1 - 1; y += 5) V.box(x0, y, z0, x1, y + 3, z1, (x, yy, z) => (yy === y + 2 && hash(x, z, y) < .5) ? undefined : PRODUCTS[(hash(x, yy + seed, z) * PRODUCTS.length) | 0]); }

