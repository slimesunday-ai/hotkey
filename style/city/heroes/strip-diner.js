// NEON ROW · block 3,1 (Maple St & Washington St) · owner: the Neon Row agent. Ids read 3_1·diner·kind·n for the diner and
// 3_1·L<k>·kind·n for the generated lots.
//   THE GRAVEYARD SHIFT, a 24-hour diner on the Maple & Washington corner (the night corner here): a one-storey steel car on a dark
//   tile base, a window band of red booths glowing all night, GRAVEYARD SHIFT on a red enamel fascia, OPEN 24 HRS round the Maple
//   side, a clock stuck at three by the corner, and a DINER sign in neon on a steel frame on the roof. The rest of the block is the
//   strip's walk-ups (OTB, the sports book, the pool hall, NUMBERS), a domino table on Maple St and three window neons upstairs.
import { fillBlock, mk, oneOff, shiftR } from '../districts/strip/fill.js';   // (SPREAD: DI and the lots in today's metres, the block's frame)
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE } from '../style.js';
import { acBox, vent } from '../props.js';
import { dominoTable } from '../districts/strip/props.js';

const DI = [100, 36, 110, 44], H = 42;

export function graveyardDiner(bank, b, A) {
  fillBlock(bank, b, A, { seed: 31101, pieces: ['cash', 'burger'], neon: ['dice', 'cherries', 'star'], neonFaces: [2, 3],
    oneOff: (lots, keep) => oneOff(bank, lots, { where: [[7, '-x'], [8, '-x'], [5, '+z'], [3, '+x']], parts: [[dominoTable(), 0, 0, 1.45]], lane: [.35, 1.0] }, keep),
    lots: [mk(110, 36, 115, 43, ['-z']), mk(115, 36, 122, 43, ['-z', '+x'], 'NE'), mk(115, 43, 122, 49, ['+x'], null, { name: 'LOCKSMITH 24' }), mk(115, 49, 122, 54, ['+x']), mk(115, 54, 122, 60, ['+z', '+x'], 'SE'),
      mk(108, 54, 115, 60, ['+z']), mk(100, 53, 108, 60, ['+z', '-x'], 'SW', { name: 'OTB · RACES' }), mk(100, 44, 108, 49, ['-x']), mk(100, 49, 108, 53, ['-x'])],
    heroes: [{ rect: DI, top: SIDE + 4.8, nh: H + 5, group: 'diner', faces: ['-z', '-x'] }],   // (the planned mass is the car itself: the roof sign stands 1.4 m in, clear of the neighbours' painted walls)
    build() { const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
      try { diner(ctx); ctx.finish(); } finally { REG.strict = false; } } });
}

function diner(ctx) {
  REG.group('diner'); const [x0, z0, x1, z1] = shiftR(ctx, DI), STEEL = 0xd3d4d7, FLUTE = 0xb7bec8, RED = 0xc4122f, CREAM = 0xfff0d0, LT = TOD.night ? 3 : 1, INK = PAL.ink;
  const D = ctx.building(x0, z0, x1, z1, { h: H * CV, wall: STEEL, trim: CREAM, faces: ['-z', '-x'], parapet: 4, cornice: false, roof: 0xc9c0b0, extra: 40 });
  const N = D.F('-z'), W = D.F('-x'), O = D.V.org;   // N: a 0 at the east end → 100 at the corner; W: a 0 at the corner → 80 south
  for (const [f, isN] of [[N, true], [W, false]]) { const L = f.len;
    f.box(0, 0, 0, L, 9, 2, (a, y) => (a % 6 === 0 || y === 4) ? 0x3b3f4a : 0x2a2d38);                              // the tile base
    f.box(0, 9, 0, L, 42, 1, (a, y) => (y % 3 === 0) ? FLUTE : STEEL, 2);                                            // fluted steel skin
    // the window band: booths inside (red seat backs, white tables), steel mullions, warm light all night
    const w0 = isN ? 4 : 18, w1 = isN ? L - 24 : L - 4; f.box(w0, 11, -6, w1, 29, 1, AIR);
    f.box(w0, 11, -7, w1, 29, -6, (a, y) => y > 24 ? 0xfff0c8 : 0xffd9a0, LT);
    for (let a = w0; a < w1; a += 12) { f.box(a + 2, 11, -6, a + 5, 18, -3, RED); f.box(a + 7, 11, -6, a + 10, 18, -3, RED); f.box(a + 4, 15, -6, a + 8, 16, -2, PAL.white); }
    for (let a = w0; a <= w1; a += 12) f.box(a, 11, 0, a + 1, 29, 2, 0xdfe6ee, 2);
    f.box(w0 - 1, 10, 0, w1 + 1, 11, 3, 0xdfe6ee, 2); f.box(w0 - 1, 29, 0, w1 + 1, 31, 3, 0xdfe6ee, 2);            // sill and head in bright steel
    f.box(0, 8, 1, L, 9, 2, RED); f.box(0, 31, 0, L, 33, 2, RED);                                                    // the red pinstripes
    f.box(0, 33, 0, L, 42, 2, RED); f.box(0, 33, 2, L, 34, 3, CREAM); f.box(0, 41, 2, L, 42, 3, CREAM);             // the enamel fascia, cream edges
  }
  N.text('GRAVEYARD SHIFT', 50, 40, 2, 3, CREAM, TOD.night ? 3 : 0, 1, 1);
  W.text('OPEN 24 HRS', 47, 40, 2, 3, 0xffe23a, 3, 1, 1);
  // the door on Washington by the corner: a steel frame, glass, a small canopy, two steps; the clock over it, stuck at three
  const da = 80; N.box(da - 1, 0, 0, da + 13, 30, 2, 0xdfe6ee, 2); N.box(da, 1, -3, da + 12, 29, 2, AIR); N.box(da, 1, -4, da + 12, 29, -3, (a, y) => (y > 24 || a === da + 6) ? 0xfff0c8 : 0x9fd8ff, LT);
  N.box(da - 3, 0, 0, da + 15, 1, 6, 0x8f949c); N.box(da - 4, 30, 1, da + 16, 33, 12, RED); N.box(da - 4, 32, 1, da + 16, 33, 12, CREAM);
  // the clock on the Maple fascia by the corner, stuck at three (a steel ring, a lit face, ink hands)
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const r = Math.hypot(dx, dy); if (r <= 4.5) W.set(7 + dx, 37 + dy, 2, r > 3.6 ? 0xdfe6ee : CREAM, r > 3.6 ? 2 : LT); }
  for (let k = 1; k <= 3; k++) { W.set(7, 37 + k, 3, INK); W.set(7 + k, 37, 3, INK); }
  const [dx, dz] = N.xz(da + 6, 0); REG.door(O[0] + (dx + .5) * CV, O[2] + dz * CV - .5, 2);
  // the DINER sign on the roof at the corner: a red board ringed in bulbs, the letters in neon, two steel posts
  const s0 = 34, s1 = 96, sy0 = 50, sy1 = 74, sd = -14;
  for (const a of [s0 + 6, s1 - 7]) N.box(a, H - 1, sd - 2, a + 2, sy0, sd, 0x9aa0a8, 2);
  N.box(s0, sy0, sd - 2, s1, sy1, sd, RED); for (let a = s0; a < s1; a++) for (const y of [sy0, sy1 - 1]) N.set(a, y, sd, (a >> 1) % 2 ? 0xffe23a : 0xfff3c4, LT);
  for (let y = sy0; y < sy1; y++) for (const a of [s0, s1 - 1]) N.set(a, y, sd, (y >> 1) % 2 ? 0xffe23a : 0xfff3c4, LT);
  N.text('DINER', (s0 + s1) >> 1, sy1 - 4, sd, sd + 1, 0x6cff4a, 3, 2, 1);
  // the roof: steel units, the kitchen's vents (strict reads a roof as inside its own mass: stamped plain)
  const top = SIDE + H * CV; REG.strict = false;
  stamp(acBox(), ctx.bank, 0, x0 + 3, top, z1 - 1.6); stamp(acBox(), ctx.bank, 0, x0 + 5.2, top, z1 - 1.6); stamp(vent(1), ctx.bank, 0, x1 - 1.4, top, z1 - 1.5); stamp(vent(0), ctx.bank, 0, x1 - 2.6, top, z1 - 1.5);
  REG.strict = true;
}
