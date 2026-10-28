// GLASSWALL · THE DOWNTOWN FRINGE · block 0,2 (Main St & Lincoln St, Pleasantview across Jackson St) · owner: the downtown fringe agent
// (batch 5).
//   PULL RATE, cards and comics, on the ground floor of a three-storey walk-up on the Main St corner (the generator builds the building
//   and its apartments; the shop's name is this block's own). Release day: the line runs round the corner along Lincoln St, the kid who
//   camped out on a milk crate at the front of it. A trading card hangs over the avenue as the blade (white border, holo edge, a gold
//   star), and on the roof a giant graded card stands in its case facing Main St, the grade 10 on its red label: collector culture's
//   landmark from the overview. The rest of the block is the generator's (south grammar: stoops and walk-ups).
// Ids read 0_2·cards·kind·n for the shop's pieces and 0_2·L<k>·kind·n for the lots.
import { fillBlock, mk, framed } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { off, kerbX, kerbZ } from '../districts/frame.js';
import { brush, person, lit } from '../districts/downtown/lib.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { stamp } from '../vox.js';
import { PAL, SIDE, CV } from '../style.js';
import { milkCrate, sandwich } from '../props.js';

const SHOP = [6, 68, 14, 77], YEL = 0xffe23a, PINK = 0xff4fa3, WHITE = 0xf7f7f2, GOLD = PAL.gold, HOLO = [0xff4fa3, 0xffe23a, 0x6cff4a, 0x2de2e6, 0x2f5bff, 0x7a3cff];

export function cardShop(bank, b, A) {
  fillBlock(bank, b, A, { seed: 50201,
    lots: [mk(6, 68, 14, 77, ['-x', '-z'], 'NW', { pin: { type: 'walkup', st: 3, ground: 'shop', piece: null, gag: null, fire: false, fireBack: false,
        shops: [{ name: 'PULL RATE', sign: YEL, disp: 'misc', kind: 'band', awn: PINK, gate: false, tag: 'OK', blade: false }] } }),
      mk(14, 68, 20, 75, ['-z']), mk(20, 68, 28, 76, ['-z', '+x'], 'NE'), mk(20, 76, 28, 84, ['+x']), mk(20, 84, 28, 92, ['+z', '+x'], 'SE'),
      mk(13, 85, 20, 92, ['+z']), mk(6, 84, 13, 92, ['+z', '-x'], 'SW'), mk(6, 77, 12, 84, ['-x'])],
    build() { queue(bank, A); },
    after(lots) { const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.group('cards'); REG.strict = true;
      try { blade(ctx); slab(ctx, lots[0]); ctx.finish(); } finally { REG.strict = false; } } });
}

// the line along Lincoln St, facing the corner: the camper on his crate at the front, then seven more (backpacks, phones, a box of
// cards); the kerb strip across from them stays clear so the walkers pass between the line and the curb. They stand 0.65 m off the
// wall: the shop window's sill (0.3 m out, a facade part) must stay clear of their feet
function queue(bank, A) {
  REG.keep([kerbX(7.4), SIDE, kerbZ(66), kerbX(15.2), SIDE + 4, kerbZ(66.95)], 'walkway');
  REG.group('cards'); stamp(milkCrate(0x2f5bff), bank, 0, kerbX(8.8), SIDE, kerbZ(67.3));                            // the camper's crate, down before the lots' clutter
  person(A, 8.8, 67.3, -Math.PI / 2, 'sit', 2001, SIDE, { seatY: .5 });
  [[9.7, 'phone'], [10.5, 'stand'], [11.3, 'carry'], [12.1, 'stand'], [12.9, 'phone'], [13.7, 'talk'], [14.5, 'stand']].forEach(([x, act], k) => person(A, x, 67.35, -Math.PI / 2 + (k % 3 - 1) * .25, act, 2002 + k));
}
// the blade over Main St: a trading card (white border, holo edge, a gold star on blue, a name bar), on an iron bracket by the corner
function blade(ctx) {
  const x0 = 5.9, z0 = 69.6, V = ctx.volume(4.6, SIDE + 3.4, z0 - .1, 6, SIDE + 5.4, z0 + 1.3), P = brush(V);
  { const [ox, oz] = off(ctx); REG.keep([4.6 + ox, SIDE + 3.4, z0 - .1 + oz, 6 + ox, SIDE + 5.4, z0 + 1.3 + oz], 'facade'); }   // (with the wall it hangs off)   // (over the sidewalk, 3.6 m up: trees and lamps keep clear of it)
  P.box(4.8, SIDE + 5.1, z0 + .5, 6, SIDE + 5.2, z0 + .7, PAL.iron);                                       // the bracket, off the wall
  P.box(4.8, SIDE + 3.6, z0, 5.0, SIDE + 5.1, z0 + 1.2, WHITE, lit(0));                                    // the card under it, 1.2 × 1.5 m, 0.2 thick
  for (const x of [4.75, 5.0]) { P.box(x, SIDE + 3.7, z0 + .1, x + .05, SIDE + 4.9, z0 + 1.1, (xx, y, z) => HOLO[((y * 10 + z * 10) | 0) % HOLO.length], lit(1));
    P.box(x, SIDE + 3.8, z0 + .2, x + .05, SIDE + 4.8, z0 + 1.0, 0x2f5bff, lit(0)); P.box(x, SIDE + 3.8, z0 + .2, x + .05, SIDE + 3.95, z0 + 1.0, WHITE);
    for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) if (Math.abs(dy) + Math.abs(dz) <= 3 || (Math.abs(dy) <= 1 && Math.abs(dz) <= 4)) P.box(x, SIDE + 4.4 + dy * .07, z0 + .6 + dz * .07, x + .05, SIDE + 4.47 + dy * .07, z0 + .67 + dz * .07, GOLD, 2); }
}
// the roof: the giant graded card in its case, standing on two legs, facing the avenue (found a clear spot among the roof's own things)
function slab(ctx, l) {
  const top = SIDE + l.H * CV, items = (REG.blk?.boxes || []).filter(it => it.box[4] > top - .05 && it.box[0] < l.x1 && it.box[3] > l.x0 && it.box[2] < l.z1 && it.box[5] > l.z0);
  let spot = null; for (let x = l.x0 + .7; x <= l.x1 - 1.6 && !spot; x += .25) for (let z = l.z0 + .7; z <= l.z1 - 3.7 && !spot; z += .25)
    if (!items.some(it => it.box[3] > x - .2 && it.box[0] < x + 1.1 && it.box[5] > z - .2 && it.box[2] < z + 3.2)) spot = [x, z];
  if (!spot) { REG.skip('slab', [(l.x0 + l.x1) / 2, top, (l.z0 + l.z1) / 2], 'no clear spot on the roof'); return; }
  const [ox, oz] = off(ctx), sx = spot[0] - ox, sz = spot[1] - oz, V = ctx.volume(   // (the spot was found on the built lot, in the spread world: back to the frame)
   sx, top, sz, sx + .9, top + 5.0, sz + 3.0), P = brush(V), y0 = top + .7, fx = sx + .3;   // the case's face toward Main St (−x)
  for (const z of [sz + .5, sz + 2.3]) { P.box(sx + .35, top, z, sx + .55, y0, z + .2, PAL.iron); P.box(sx + .1, top, z - .1, sx + .8, top + .1, z + .3, PAL.iron); }
  P.box(fx, y0, sz, fx + .4, y0 + 4.2, sz + 3.0, 0xdfe6ee, 1);                                              // the clear case (pale, glossy)
  P.box(fx - .05, y0 + 3.3, sz + .15, fx, y0 + 4.05, sz + 2.85, 0xe8232a);                                  // the red label …
  P.box(fx - .05, y0 + .15, sz + .15, fx, y0 + 3.15, sz + 2.85, (x, y, z) => { const u = z - sz, v = y - y0;   // … and the card: gold border, holo, a star on blue
    if (u < .3 || u > 2.7 || v < .3 || v > 3.0) return GOLD; if (u < .42 || u > 2.58 || v < .42 || v > 2.88) return HOLO[((u + v) * 8 | 0) % HOLO.length];
    const du = Math.abs(u - 1.5), dv = v - 1.85; if (Math.abs(du) * 1.1 + Math.abs(dv) < .75 || (Math.abs(dv) < .18 && du < .95)) return YEL; return v < .9 ? WHITE : 0x2f5bff; }, lit(0));
  const F = P.face(fx - .05, sz, fx + .4, sz + 3.0, '-x', y0); F.text('10', F.len >> 1, 40, 1, 2, WHITE, lit(0), 1, 1);
  ctx.put(sandwich('RARES', PINK), 5.55, 73.4, { rot: 3, slide: [0, 1], reach: 2.0 });
}
