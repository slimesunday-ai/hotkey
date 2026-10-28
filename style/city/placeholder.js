// Pass 2 · the visible placeholder for a module that failed (page isolation). A block whose hero, kit or override broke is fenced
// off as a site: a magenta-and-black checker slab (the universal "missing texture", unmistakable from overhead), plywood hoarding
// with striped barriers, and a red board on a mast that names the file and the error. The rest of the city builds as normal.
import { Vol, meshVol } from './vox.js';
import { PAL, SIDE } from './style.js';
import { REG } from './audit.js';
import { textMask } from './vox.js';

const MAG = 0xff2bd6, BLK = 0x17171b;
// one board line: the 5×7 font, cropped to what fits
function line(V, s, x0, ytop, z, maxW, c) { let t = s.toUpperCase().replace(/[^A-Z0-9 .\-/_:!?#&$%@*+·']/g, '?'); while (t.length > 3 && textMask(t).w > maxW) t = t.slice(0, -1);
  const M = textMask(t); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { V.set(x0 + i, ytop - j, z, c, 3); V.recN(t, x0 + i, ytop - j, z, 0, 1); } return M.w; }

export function placeholderBlock(bank, b, why = {}) {
  const R = b.R, W = Math.round((R.x1 - R.x0) / .1), D = Math.round((R.z1 - R.z0) / .1);
  REG.group('placeholder');
  // slab + hoarding (0.1 grain), one volume
  const V = new Vol(W, 30, D, { s: .1, org: [R.x0, SIDE, R.z0] });
  V.box(0, 0, 0, W, 1, D, (x, y, z) => ((x / 20 | 0) + (z / 20 | 0)) & 1 ? MAG : BLK);
  for (const [x0, z0, x1, z1] of [[0, 0, W, 2], [0, D - 2, W, D], [0, 0, 2, D], [W - 2, 0, W, D]]) V.box(x0, 1, z0, x1, 24, z1, (x, y, z) => y > 21 ? 0xd9c9a8 : ((x + z + y) / 6 | 0) % 2 ? 0xc9a36b : 0xb88f58);
  for (const [x0, z0, x1, z1] of [[4, 2, W - 4, 3], [4, D - 3, W - 4, D - 2], [2, 4, 3, D - 4], [W - 3, 4, W - 2, D - 4]]) V.box(x0, 9, z0, x1, 12, z1, (x, y, z) => ((x + z) / 4 | 0) % 2 ? PAL.red : PAL.white);
  meshVol(V, bank);
  // the error board on a mast in the middle, readable from the street and from overhead
  const lines = ['MODULE ERROR', why.path || '?', ...(String(why.error || '').match(/.{1,26}/g) || []).slice(0, 3)];
  const bw = 150, bh = 12 + lines.length * 10, S = new Vol(bw + 4, bh + 70, 8, { s: .1, org: [(R.x0 + R.x1) / 2 - (bw + 4) * .05, SIDE, (R.z0 + R.z1) / 2 - .4] });
  S.box((bw >> 1) - 1, 0, 3, (bw >> 1) + 3, 64, 5, BLK); S.box(0, 62, 2, bw + 4, 62 + bh, 6, BLK); S.box(2, 64, 5, bw + 2, 60 + bh, 6, 0xd7141a);
  lines.forEach((t, k) => line(S, t, 6, 60 + bh - 5 - k * 10, 6, bw - 8, k === 0 ? PAL.yellow : PAL.white));
  S.box(2, 64, 1, bw + 2, 60 + bh, 2, 0xd7141a);   // the back of the board is red too
  meshVol(S, bank);
  return { placeholder: true };
}
// far tier of a broken block: the checker slab in 0.5 cubes + the board as a red block
export function placeholderFar(bank, b) {
  const R = b.R, W = Math.round((R.x1 - R.x0) / .5), D = Math.round((R.z1 - R.z0) / .5), V = new Vol(W, 16, D, { s: .5, org: [R.x0, SIDE, R.z0] });
  V.box(0, 0, 0, W, 1, D, (x, y, z) => ((x / 4 | 0) + (z / 4 | 0)) & 1 ? MAG : BLK); V.box((W >> 1) - 1, 1, (D >> 1) - 1, (W >> 1) + 1, 13, (D >> 1) + 1, 0xd7141a);
  meshVol(V, bank); return bank;
}
