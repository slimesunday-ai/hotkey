// MAINLAND v1 · the frontier's repeated props, authored once as templates (base centre, facing +z) and drawn INSTANCED by main.js:
// survey stakes with pink flagging, the prime lots' gold stakes and pennant pole, the realtor signs (14 designs, so no two alike stand
// in one view, plus 3 PRIME boards), the pink string of a staked footprint (a unit box, scaled per run).
import { Vol, meshed } from '../vox.js';
import { frame } from '../kit.js';
import { PAL } from '../style.js';

const INK = PAL.ink, WHITE = 0xf7f7f2, GOLD = 0xe7bd4a, WOOD = 0xe9d8b8, PINK = 0xff4fa3;
const vol = (x0, y0, z0, x1, y1, z1, s = .05) => { const V = new Vol(Math.round((x1 - x0) / s), Math.round((y1 - y0) / s), Math.round((z1 - z0) / s), { s, org: [x0, y0, z0], ground: true });
  const q = m => Math.round(m / s); return { V, box: (a, b, c, d, e, f, col, l = 0) => V.box(q(a - x0), q(b - y0), q(c - z0), q(d - x0), q(e - y0), q(f - z0), col, l), face: (a, c, d, f, side) => frame(V, { x0: q(a - x0), x1: q(d - x0), z0: q(c - z0), z1: q(f - z0) }, side) }; };
// a survey hub stake: a lath with a flag of flagging tape (pink, or gold on a prime lot)
export function stake(col = PINK) { const S = vol(-.1, 0, -.1, .3, 1.0, .3); S.box(-.04, 0, -.04, .04, .9, .04, WOOD); S.box(.04, .7, -.02, .24, .85, .02, col); S.box(-.06, .86, -.06, .06, .92, .06, col); return meshed(S.V); }
// the prime pennant: a tall white pole, a gold swallowtail flag and a gold ball
export function pennant() { const S = vol(-.2, 0, -.1, 1.6, 4.4, .1); S.box(-.05, 0, -.05, .05, 4.1, .05, WHITE); S.box(-.08, 4.1, -.08, .08, 4.3, .08, GOLD, 2);
  S.box(.05, 3.0, -.02, 1.5, 4.0, .02, (i, j) => { const u = i - 21, v = j - 60; return (u > 22 && Math.abs(v - 10) < (u - 22) * .7) ? undefined : (v === 0 || v === 19) ? 0xfff0d0 : GOLD; }, 0);
  return meshed(S.V); }
// the signs. kind: 'realtor' (a post with an arm, the board swinging under it) · 'stake' (two stakes) · 'panel' (a small billboard on two
// posts) · 'flag' (a feather flag beside a stake board). The board's width follows its words.
const DESIGNS = [
  ['realtor', 0xe8232a, WHITE, 'FOR SALE', 'CLAIM IT'], ['stake', 0xffe23a, INK, 'AVAILABLE', 'BUILD HERE'], ['panel', 0x2f5bff, WHITE, 'LOT FOR SALE', 'FLAT + READY'],
  ['realtor', 0x14a83b, WHITE, 'OPEN LOT', 'READY NOW'], ['stake', 0xff4fa3, INK, 'YOUR HOME', 'GOES HERE'], ['flag', 0xff7a1a, INK, 'FOR SALE', 'CLAIM IT'],
  ['panel', 0x12b3a0, WHITE, 'NOW SELLING', 'NEW LOTS'], ['realtor', INK, 0xffc21a, 'VACANT LOT', 'CLAIM IT'], ['stake', WHITE, 0xe8232a, 'NEW PLOT', 'AVAILABLE'],
  ['panel', 0xffc21a, 0xe8232a, 'BUILD NOW', 'UTILITIES'], ['realtor', 0x3fa9f5, INK, 'AVAILABLE', 'SUNNY LAND'], ['flag', 0x6cff4a, INK, 'OPEN LOT', 'BUILD HERE'],
  ['stake', 0xff7a1a, WHITE, 'LOTS LEFT', 'CLAIM ONE'], ['panel', 0xe8232a, 0xffe23a, 'READY TO', 'BUILD'],
];
export const PRIME = { waterfront: 'WATERFRONT', corner: 'CORNER LOT', 'cul-de-sac head': 'CUL-DE-SAC', 'waterfront point': 'WATERFRONT' };
export const SIGN_N = DESIGNS.length;
const tw = s => [...s].length * 6 - 1;   // the 5×7 font's width in cells (a proportional font: close enough to size a board)
export function sign(k, prime = null) {
  const [kind, bg, fg, a, b] = prime ? ['realtor', GOLD, INK, 'PRIME LOT', prime] : DESIGNS[k];
  const big = kind === 'panel' && a.length <= 6 ? 2 : 1, W = Math.max(tw(a) * big, tw(b)) * .05 + .5, hw = W / 2;
  const S = vol(-hw - 1.2, 0, -.3, hw + 1.2, 3.6, .3);
  let y0, y1;
  if (kind === 'realtor') { const px = -hw - .35; y0 = 1.0; y1 = 2.2;
    S.box(px - .06, 0, -.06, px + .06, 2.75, .06, prime ? WHITE : 0xfffaf0); S.box(px - .06, 2.55, -.06, hw + .15, 2.67, .06, prime ? WHITE : 0xfffaf0);
    for (const x of [-hw + .3, hw - .3]) S.box(x - .02, y1, -.02, x + .02, 2.55, .02, 0x8a9099);
    if (prime) { S.box(-hw + .2, 2.67, -.04, hw - .2, 3.2, .04, INK); const r = S.face(-hw + .2, -.04, hw - .2, .04, '+z'); r.text('PRIME', Math.round((W - .4) / .1), 62, 0, 1, GOLD, 2, 1, 1); } }
  else if (kind === 'stake') { y0 = .45; y1 = 1.55; for (const x of [-hw + .25, hw - .35]) S.box(x, 0, -.05, x + .1, y1 + .05, .05, 0xb98b57); }
  else if (kind === 'panel') { y0 = 1.1; y1 = 2.95; for (const x of [-hw + .4, hw - .6]) S.box(x, 0, -.1, x + .2, y1, .1, 0x8a9099); S.box(-hw - .05, y0 - .05, -.08, hw + .05, y1 + .05, -.04, 0xd3d4d7); }
  else { y0 = .45; y1 = 1.55; for (const x of [-hw + .25, hw - .35]) S.box(x, 0, -.05, x + .1, y1 + .05, .05, 0xb98b57);
    const fx = hw + .6; S.box(fx - .04, 0, -.04, fx + .04, 3.3, .04, 0xdfe6ee); S.box(fx + .04, 1.2, -.02, fx + .55, 3.3, .02, (i, j) => ((j / 6) | 0) % 3 === 0 ? WHITE : bg); S.box(fx + .04, 3.2, -.02, fx + .45, 3.4, .02, bg); }
  S.box(-hw, y0, -.04, hw, y1, .04, bg);
  S.box(-hw, y0, -.04, hw, y0 + .05, .06, prime ? INK : fg); S.box(-hw, y1 - .05, -.04, hw, y1, .06, prime ? INK : fg);
  const f = S.face(-hw, -.04, hw, .04, '+z'), fb = S.face(-hw, -.04, hw, .04, '-z'), cx = Math.round(W / 2 / .05), ht = Math.round((y1 - y0) / .05), yb = Math.round(y0 / .05);
  for (const F of [f, fb]) { F.text(a, cx, yb + ht - 3, 0, 1, fg, 0, big, 1); F.text(b, cx, yb + Math.round(ht * .38), 0, 1, prime ? 0xe8232a : fg, 0, 1, 1); }
  const bank = meshed(S.V); bank.kind = 'sign'; return bank;
}
