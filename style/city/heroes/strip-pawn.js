// NEON ROW · block −5,−2 (Grand Ave & 1st St, over Elm St from Sunny Acres) · owner: the Neon Row agent. Ids read -5_-2·pawn·kind·n for
// the pawnshop and -5_-2·L<k>·kind·n for the generated lots.
//   HONEST PAWN on the Grand & 1st corner (the night corner here): a three-storey brick walk-up, the pawnshop on the street — a yellow
//   fascia in black letters, CASH 4 GOLD on the glass, guitars and TVs behind security bars, a steel door — the three gold balls on
//   their bracket at the corner, a fire escape on 1st St, two floors of apartments above (walk-up units). Grand Ave keeps its curb
//   free of awnings: the bus stop stands there.
import { fillBlock, mk, oneOff, shiftR } from '../districts/strip/fill.js';   // (SPREAD: PW and the lots in today's metres, the block's frame)
import { windowCard, movingPile } from '../districts/strip/props.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { win, AIR, TOD, fireEscape } from '../kit.js';
import { PAL, CV, SIDE } from '../style.js';
import { neutralCap } from '../roofs.js';
import { acBox, vent } from '../props.js';

const PW = [-143, -45, -134, -36], H = 96;

export function honestPawn(bank, b, A) {
  fillBlock(bank, b, A, { seed: 51101, pieces: ['billboard', 'pizza'], neon: ['mug', 'moon', 'bolt'], neonFaces: [0, 1],
    oneOff: (lots, keep) => oneOff(bank, lots, { where: [[6, '-x'], [7, '-x'], [1, '-z']], parts: [[movingPile(), 2, 0, .82]], lane: [1.32, 1.85] }, keep),
    lots: [mk(-156, -60, -149, -53, ['-z', '-x'], 'NW'), mk(-149, -60, -143, -53, ['-z']), mk(-143, -60, -134, -53, ['-z', '+x'], 'NE', { name: 'PALM READER' }), mk(-142, -53, -134, -45, ['+x']),
      mk(-149, -43, -143, -36, ['+z']), mk(-156, -43, -149, -36, ['+z', '-x'], 'SW'), mk(-156, -53, -149, -48, ['-x']), mk(-156, -48, -149, -43, ['-x'])],
    heroes: [{ rect: PW, top: SIDE + (H + 7) * CV, nh: H + 7, group: 'pawn', faces: ['+z', '+x'] }],
    build() { const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
      try { pawn(ctx); ctx.finish(); } finally { REG.strict = false; } } });
}

function pawn(ctx) {
  REG.group('pawn'); const [x0, z0, x1, z1] = shiftR(ctx, PW), BRICK = 0x9b4f3a, TR = PAL.cream, YEL = 0xffe23a, INK = PAL.ink, GOLD = PAL.gold, LT = TOD.night ? 3 : 1;
  const P = ctx.building(x0, z0, x1, z1, { h: H * CV, wall: BRICK, trim: TR, faces: ['+z', '+x'], parapet: 5, extra: 12 }), S = P.F('+z'), E = P.F('+x'), O = P.V.org;
  neutralCap(P.V, P.B, H, BRICK, 0xd9d2c3);
  const bars = (f, a0, a1, y0, y1) => { for (let a = a0; a < a1; a += 3) f.box(a, y0, 1, a + 1, y1, 2, PAL.iron); f.box(a0, y0, 1, a1, y0 + 1, 2, PAL.iron); f.box(a0, y1 - 1, 1, a1, y1, 2, PAL.iron); };
  const shopBand = (f, name) => { const L = f.len; f.box(0, 0, 0, L, 36, 2, INK); f.box(0, 0, 0, L, 4, 3, 0x3b3f4a); f.box(0, 27, 0, L, 36, 3, YEL); f.box(0, 27, 3, L, 28, 4, INK); f.text(name, L >> 1, 34, 3, 4, INK, 0, 1, 1); };
  // 1st St: the apartments' door at the west end, the display window (CASH 4 GOLD on the glass over the bars), the pawnshop's steel door
  shopBand(S, 'HONEST PAWN'); const L = S.len;
  S.box(3, 1, -3, 15, 25, 2, AIR); S.box(3, 1, -4, 15, 25, -3, (a, y) => y > 20 ? 0xffe3a0 : 0x7a1020, 1); S.box(15, 10, 1, 16, 15, 2, 0xc9ced6, 2);
  const w0 = 18, w1 = 68; S.box(w0, 5, -6, w1, 26, 2, AIR); S.box(w0, 5, -7, w1, 26, -6, (a, y) => y > 18 ? 0x2a3350 : 0x3b3f4a, 1);   // the display: a shelf of TVs, gold under glass, guitars on the wall
  for (let a = w0 + 2; a + 5 < w1; a += 7) { S.box(a, 6, -6, a + 5, 10, -3, 0x2a2a30); S.box(a + 1, 7, -3, a + 4, 9, -2, 0x9fd8ff, LT); }
  S.box(w0 + 1, 10, -6, w1 - 1, 11, -2, 0xe9e5dc); for (let a = w0 + 3; a < w1 - 3; a += 4) S.set(a, 11, -3, GOLD, 2);
  for (let a = w0 + 4; a + 4 < w1; a += 9) { S.box(a, 12, -6, a + 3, 17, -5, [0xc0392b, 0x8b4a24, 0x17171b, 0xffc21a][(a >> 3) & 3]); S.box(a + 1, 17, -6, a + 2, 19, -5, 0x3b2a1a); }
  bars(S, w0, w1, 5, 17); S.box(w0 - 1, 4, 0, w1 + 1, 5, 3, TR);
  const pd = 73; S.box(pd, 1, -3, pd + 12, 25, 2, AIR); S.box(pd, 1, -4, pd + 12, 25, -3, (a, y) => (a % 3 === 0 || y % 6 === 0) ? 0x55555f : 0x8f949c, 2);   // the steel door
  // Grand Ave: guitars and a gold case behind bars, LOANS · GOLD on the fascia; nothing sticks out past the plinth (the bus stop's curb)
  shopBand(E, 'LOANS · GOLD'); const LE = E.len;
  for (const [a0, a1] of [[6, 40], [48, 84]]) { E.box(a0, 5, -6, a1, 25, 2, AIR); E.box(a0, 5, -7, a1, 25, -6, (a, y) => y > 18 ? 0x2a3350 : 0x3b3f4a, 1);
    for (let a = a0 + 3; a + 3 < a1; a += 6) { E.box(a, 8, -6, a + 3, 14, -5, [0xffc21a, 0xc0392b, 0x2f5bff, 0x17171b][(a >> 2) & 3]); E.box(a + 1, 14, -6, a + 2, 22, -5, 0x3b2a1a); }
    bars(E, a0, a1, 5, 25); E.box(a0 - 1, 4, 0, a1 + 1, 5, 3, TR); }
  // THE THREE GOLD BALLS on a bracket at the corner, hanging out over 1st St
  const ga = L - 5, I = PAL.iron, BALL = 0xffc21a; S.box(ga, 60, 1, ga + 2, 62, 16, I); S.box(ga, 52, 1, ga + 2, 62, 2, I); for (let t = 0; t < 8; t++) S.set(ga + 1, 53 + t, 9 - t, I);   // the bracket and its stay
  for (const [bd, by] of [[8, 52], [14, 52], [11, 46]]) { for (let dy = -3; dy <= 3; dy++) for (let dd = -3; dd <= 3; dd++) for (let da = -3; da <= 3; da++) if (dy * dy + dd * dd + da * da <= 10) S.set(ga + 1 + da, by + dy, Math.round(bd + dd), (dy > 1 && dd > 0) ? 0xfff3b0 : BALL); }
  S.box(ga + 1, 56, 8, ga + 2, 60, 9, I); S.box(ga + 1, 56, 14, ga + 2, 60, 15, I); S.box(ga + 1, 50, 11, ga + 2, 56, 12, I);   // the chains (the low ball hangs between the two)
  // upstairs: brick, cream-trimmed windows, a fire escape on 1st St; two floors of apartments
  const units = [], wxS = a => O[0] + (P.B.x0 + a + .5) * CV, wzS = O[2] + P.B.z1 * CV;
  for (const [n, y0] of [[1, 43], [2, 73]]) { const ws = [];
    for (const a0 of [8, 38, 68]) { win(S, a0, y0, 13, 18, TR, {}); ws.push([+wxS(a0 + 6).toFixed(2), +(SIDE + (y0 + 9) * CV).toFixed(2), +(wzS + .07).toFixed(2), 1.3, 1.8]); }
    for (const a0 of [12, 42, 70]) win(E, a0, y0, 13, 18, TR, {});
    units.push({ id: `apt:${ctx.i}_${ctx.j}·pawn·${n}`, floor: n + 1, windows: ws }); }
  fireEscape(S, 4, 58, [42, 72]); S.box(44, 18, 10, 55, 42, 13, AIR); for (let y = 36; y < 42; y++) { S.set(48, y, 11, PAL.iron); S.set(53, y, 11, PAL.iron); if (y % 3 === 0) S.box(48, y, 11, 54, y + 1, 12, PAL.iron); }   // the drop ladder pulled up over the sign
  stamp(windowCard('CASH 4 GOLD', YEL), ctx.bank, 0, wxS((w0 + w1) / 2 - .5), SIDE + 1.85, wzS - .25);   // the card hung in the glass
  ctx.anchor.building({ id: `bld:${ctx.i}_${ctx.j}·pawn`, kind: 'walkup', type: 'walkup', tier: 'apartment', rot: 0, face: [0, 1], entrance: { door: [+wxS(9).toFixed(2), SIDE, +(wzS + .5).toFixed(2)], stoop: false }, units, top: +(SIDE + H * CV).toFixed(2) });
  REG.door(wxS(9), wzS + .5, 0); REG.door(wxS(pd + 6), wzS + .5, 0);
  const top = SIDE + H * CV; REG.strict = false;   // roof units on the pawnshop's own roof (strict mode reads a roof as inside its mass)
  stamp(acBox(), ctx.bank, 0, x0 + 2.4, top, z0 + 2); stamp(acBox(), ctx.bank, 0, x0 + 4.6, top, z0 + 2); stamp(vent(0), ctx.bank, 0, x1 - 2, top, z0 + 3); REG.strict = true;
}
