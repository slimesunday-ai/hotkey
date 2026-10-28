// BLACKPINE WOODS · THE LEAF CLEARING (block −11,1) · owner: the Blackpine Woods agent. The sim's dig site for LEAF (woods, −330, 60):
// a clearing by the lake, 75 m in from Birch St on the leaf track. The sim-state layer draws the harvest itself (simassets pile('leaf'):
// bundles stacked on a log sled, a stump with an axe) in a dug pit at the site, rising and falling with the sim, with a spill heap
// beside it; 6.5 m round the point stays clear. Round it: tilled beds of the crop in rows, dig spots with the shovels left standing,
// burlap sacks, a sorting table under a blue tarp, drying racks hung with bundles, a wheelbarrow, lanterns on poles for the night
// shift, and a hand-painted PICK YOUR OWN · CASH ONLY board facing the track.
import { hero } from '../districts/forest/hero.js';
import { putW } from '../districts/forest/features.js';
import * as FP from '../districts/forest/props.js';
import { logSign } from '../districts/forest/signs.js';
import { PILE, BEDS0 } from '../districts/forest/plan.js';
import { off, at, atR } from '../districts/frame.js';   // (SPREAD: the hero's metres are today's, its block's frame; PILE is the spread world's)
import { REG } from '../audit.js';
import { SIDE, hash } from '../style.js';

const clearOfPile = (x, z, m = 0) => Math.hypot(x - PILE.x, z - PILE.z) > 6.5 + m && Math.hypot(x - PILE.x - PILE.spill[0], z - PILE.z - PILE.spill[1]) > 3 + m;
export function leafClearing(bank, b, A) {
  hero(bank, b, A, { skip: [[...at(b, -331, 55), 14]] }, ctx => {
    const [sx, sz] = off(ctx);
    ctx.group('beds');   // the crop, row by row (every other plant left out where it was picked)
    let k = 0; for (const [x0, z0, x1, z1] of BEDS0) for (let x = x0 + .9; x < x1; x += 1.2) for (let z = z0 + .5; z < z1 - .3; z += .95) { k++;   // (rows and rolls in the frame: today's)
      if (!clearOfPile(...at(ctx, x, z), .6) || hash(Math.round(x * 10), Math.round(z * 10), 5) < .18) continue; putW(ctx, FP.leafPlant(k), ...at(ctx, x, z), { reach: 0 }); }
    ctx.group('yard'); const Pp = (prop, x, z, o) => clearOfPile(...at(ctx, x, z)) ? putW(ctx, prop, ...at(ctx, x, z), { reach: .8, ...o }) : null;
    tarp(ctx); Pp(FP.sortTable(), -341.6, 60.2, { rot: 1, reach: .4, slide: [0, 1] }); Pp(FP.sacks(3), -340.2, 57.3, { rot: 1 });
    Pp(FP.dryingRack(), -334.6, 51.4, { rot: 1, slide: [1, 0] }); Pp(FP.wheelbarrow(), -336.2, 62.9, { rot: 2, reach: .4 });
    Pp(FP.sacks(2), -322.6, 55.6, { rot: 0 }); Pp(FP.lanternPole(), -338.4, 63.2, { rot: 1 }); Pp(FP.lanternPole(), -322.8, 52.4, { rot: 3 }); Pp(FP.lanternPole(), -344.6, 49.6, { rot: 1 });
    for (const [x, z] of [[-324.2, 55.0], [-335.9, 56.0], [-330.4, 52.9]]) Pp(FP.shovel(), x, z, { reach: .4 });
    // the dig marked out: flagged stakes round it (6.9 m out), the spoil heaped just beyond, so the site reads from the air
    ctx.group('dig'); for (let k = 0; k < 9; k++) { const a = -2.1 + k * .52, x = PILE.x - sx + Math.cos(a) * 6.9, z = PILE.z - sz + Math.sin(a) * 6.9; if (z < 63.6 && clearOfPile(...at(ctx, x, z))) putW(ctx, FP.flagStake(), ...at(ctx, x, z), { reach: .3 }); }
    for (const [x, z, v, r] of [[-329.0, 51.4, 1, 0], [-337.4, 58.0, 0, 1]]) putW(ctx, FP.spoilHeap(v), ...at(ctx, x, z), { rot: r, reach: .6 });
    const s = Pp(FP.board('PICK YOUR OWN/CASH ONLY', { bg: 0xe9dcc0, fg: 0x2f7a2a, posts: 2, h: .5, drip: 1, tilt: 1 }), -321.6, 58.4, { rot: 1, slide: [0, 1] }); if (s) logSign('PICK YOUR OWN CASH ONLY', s[0], s[1]);
  });
}
// the sorting table's tarp: a blue sheet on four poles, higher at the back
function tarp(ctx) { const [x0, z0, x1, z1] = atR(ctx, [-343.4, 58.2, -339.8, 62.4]), V = ctx.volume(x0, SIDE, z0, x1, SIDE + 2.4, z1, {});
  for (let x = 0; x < V.nx; x++) { const y = 23 - Math.round(x / V.nx * 4); for (let z = 0; z < V.nz; z++) V.set(x, y, z, z % 12 === 0 ? FP.K.tarpL : FP.K.tarp); }
  for (const [x, z] of [[0, 1], [0, V.nz - 2], [V.nx - 1, 1], [V.nx - 1, V.nz - 2]]) { const top = 23 - Math.round(x / V.nx * 4); V.box(x, 0, z, x + 1, top, z + 1, 0x6d707a, 2);
    const wx = x0 + (x + .5) * .1, wz = z0 + (z + .5) * .1; REG.keep([wx - .08, SIDE, wz - .08, wx + .08, SIDE + 2.2, wz + .08], 'tarp-pole'); } }
