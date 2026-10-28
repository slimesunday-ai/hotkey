// BLACKPINE WOODS · THE NORTH SHACK (block 10,−4) · owner: the Blackpine Woods agent. A cook lab (the sim's lab-north at 330, −110):
// a 70s camper gone to seed at the end of the north track, 100 m in from Route 9 behind a yellow pipe gate. Cream and orange stripes
// under rust, every window blacked out with bin-bag plastic and tape, flat tyres on cinder blocks, a vent stack through the roof with a
// coffee can on top, an olive tarp over the door, the generator on its cable, drums, propane, the lookout chair facing back down the
// track. At night: one dim work light under the tarp, a glow leaking round the blackout and out of the vents, nothing else.
// Discoverable, not billboarded: from the overhead it is a drab tarp in the trees.
import { hero, shed } from '../districts/forest/hero.js';
import { putW } from '../districts/forest/features.js';
import { off, at, atR, atB } from '../districts/frame.js';   // (SPREAD: the hero's metres are today's, its block's frame)
import * as FP from '../districts/forest/props.js';
import { bags } from '../props.js';
import { TOD } from '../kit.js';
import { REG } from '../audit.js';
import { SIDE, CV, hash } from '../style.js';

const CREAM = 0xefe6cf, ORANGE = 0xd9642a, BROWN = 0x7a4a2a, RUST = 0xa4502a, GLASS = 0x1b1f28, BLACK = 0x17181c, TAPE = 0x8e9096, LEAK = 0x9a5a22, DRAB = 0x4f5a36, DRABL = 0x5f6b42;
export function labNorth(bank, b, A) {
  const F = (x, z) => at(b, x, z);
  hero(bank, b, A, { skip: [[...F(329, -111), 10]], carve: [[...F(331, -112), 6.5, 4.2], [...F(328.5, -111.5), 4, 3.2]] }, ctx => {
    ctx.group('rv'); rv(ctx); awning(ctx);
    ctx.group('yard'); const P = (prop, x, z, o) => putW(ctx, prop, ...at(ctx, x, z), { reach: .8, ...o });
    P(FP.generator(), 327.6, -116.6, { rot: 1 }); P(FP.drum(0x2f5bff, 1), 333.9, -118.0); P(FP.drum(0x8a9099, 0), 335.1, -117.1); P(FP.drum(RUST, 1), 334.3, -106.2);
    P(FP.propane(), 333.9, -104.9); P(FP.jerrycan(), 328.9, -117.4, { rot: 1 }); P(FP.bucket(0xff7a1a), 326.9, -114.7);
    P(FP.campChair(0x2f7a3a), 324.9, -109.4, { rot: 3 }); P(FP.cooler(0xffffff), 325.2, -107.8, { rot: 3 }); P(bags(3), 335.2, -112.6, { reach: 1 });
    P(FP.board('KEEP OUT', { bg: 0xf7f7f2, fg: 0xe8232a, posts: 1, h: 1, drip: 1 }), 322.4, -113.4, { rot: 3, slide: [0, 1] });
    cable(ctx);
  });
}
// the camper: 7.6 × 2.4 m, the cab-over bunk at the north end, the door on the west side facing the track
function rv(ctx) {
  const [x0, z0, x1, z1] = atR(ctx, [330, -115.6, 332.4, -108]), { V, B } = shed(ctx, x0, z0, x1, z1, 2.9, { pad: 8, roofY: 2.75 }), W = B.x1 - B.x0, L = B.z1 - B.z0, xa = B.x0, xb = B.x1, za = B.z0, zb = B.z1;
  const cab = zb - 15, night = TOD.night;
  // the body (living box), the cab, the bunk over it
  V.box(xa, 5, za, xb, 26, cab, (x, y, z) => y < 8 ? BROWN : y === 15 || y === 16 ? ORANGE : y === 17 ? BROWN : (y < 15 && hash(x, z >> 2, 9) < .05) ? RUST : CREAM);
  V.box(xa, 5, cab, xb, 18, zb, (x, y) => y < 8 ? BROWN : y === 15 || y === 16 ? ORANGE : CREAM); V.box(xa, 18, cab, xb, 26, zb - 3, (x, y) => y === 18 ? BROWN : CREAM);
  V.box(xa + 1, 12, zb - 1, xb - 1, 17, zb, GLASS, 1); V.box(xa, 12, cab + 3, xa + 1, 16, zb - 2, GLASS, 1); V.box(xb - 1, 12, cab + 3, xb, 16, zb - 2, GLASS, 1);   // windshield, cab windows
  V.box(xa + 2, 20, zb - 4, xb - 2, 24, zb - 3, BLACK, 1); V.box(xa + 3, 21, zb - 3, xb - 3, 22, zb - 2, TAPE);                                          // the bunk window: blacked out, taped
  for (const z of [za + 4, za + 18, za + 32]) for (const x of [xa, xb - 1]) { const leak = night && (z === za + 18 || (z === za + 32 && x === xa));
    V.box(x, 17, z, x + 1, 23, z + 9, BLACK, 1); for (const zz of [z, z + 8]) V.box(x, 16, zz, x + 1, 24, zz + 1, TAPE);                          // side windows: bin-bag plastic, duct tape round it
    if (leak) V.box(x, 17, z + 1, x + 1, 18, z + 8, LEAK, 3);                                                                                          // a line of light where the plastic sags
    for (let y = 9; y < 17; y++) if (hash(z, y, x) < .5) V.set(x, y, z + 3, RUST); }
  V.box(xa, 6, za + 50, xa + 1, 24, za + 57, 0xe2d8bc); V.box(xa, 16, za + 52, xa + 1, 21, za + 55, GLASS, 1); V.set(xa, 14, za + 56, 0x9a9ca4);          // the door, its window, the handle
  V.box(xa + 1, 26, za, xb - 1, 27, cab, 0xe6e2d6); V.box(xa + 7, 27, za + 36, xa + 16, 31, za + 44, 0xf4f1ea);                                             // roof, the AC box
  V.box(xa + 5, 27, za + 12, xa + 7, 37, za + 14, 0x9a9ca4, 2); V.box(xa + 5, 37, za + 12, xa + 7, 38, za + 14, night ? LEAK : 0x6d707a, night ? 3 : 2);   // the vent stack (a glow under the can at night)
  V.box(xa + 4, 38, za + 11, xa + 8, 41, za + 15, 0xc9ced6, 2); V.box(xa + 5, 41, za + 12, xa + 7, 42, za + 14, 0x9a9ca4, 2);                                // the coffee can on top
  for (let y = 11; y < 15; y++) V.box(xb - 1, y, za + 26, xb, y + 1, za + 30, y % 2 ? (night ? LEAK : 0x3b3f4a) : 0x9a9ca4, y % 2 && night ? 3 : 2);        // a louvred wall vent, leaking warm
  for (let y = 6; y < 26; y += 3) V.box(xa + 4, y, za - 1, xa + 9, y + 1, za, 0x6d707a, 2); for (const x of [xa + 4, xa + 8]) V.box(x, 6, za - 1, x + 1, 27, za, 0x6d707a, 2);   // the back ladder
  V.box(xa, 3, zb, xb, 5, zb + 1, 0x9a9ca4, 2); V.box(xa + 1, 9, zb, xa + 4, 11, zb + 1, 0xe9e1c8, 1); V.box(xb - 4, 9, zb, xb - 1, 11, zb + 1, 0xe9e1c8, 1);   // bumper, headlights (dark)
  for (const z of [za + 12, zb - 20]) for (const x of [xa - 1, xb - 2]) { V.box(x, 0, z - 4, x + 3, 5, z + 5, 0x1b1b20); V.box(x + (x < xa ? 0 : 2), 2, z - 1, x + 1 + (x < xa ? 0 : 2), 4, z + 2, 0x9a9ca4, 2); }   // flat tyres
  for (const z of [za + 2, zb - 6]) V.box(xa + 7, 0, z, xa + 17, 5, z + 4, 0x9a9aa6);                                                                     // cinder blocks under the frame
}
// the drab tarp over the door: sloping from the roof edge to two poles 2.4 m out, a crease every metre; one work light under it, dim
function awning(ctx) {
  const [x0, z0, x1, z1] = atR(ctx, [327.4, -114.2, 329.9, -108.6]), V = ctx.volume(x0, SIDE, z0, x1, SIDE + 2.8, z1, {}), n = V.nx;
  for (let x = 0; x < n; x++) { const y = 20 + Math.round(x / n * 6); for (let z = 0; z < V.nz; z++) V.set(x, y, z, z % 10 === 0 ? DRABL : DRAB); }
  for (const z of [1, V.nz - 2]) V.box(0, 0, z, 1, 20, z + 1, 0x6d707a, 2);
  const mid = V.nz >> 1; V.box(12, 18, mid, 13, 23, mid + 1, 0x2a2d38); V.box(11, 15, mid - 1, 15, 18, mid + 2, 0x2a2d38); V.box(12, 15, mid, 14, 16, mid + 2, TOD.night ? 0xc08a48 : 0xd8dbe2, TOD.night ? 3 : 1);   // the work light: a caged bulb on its cord, dim
  REG.keep([x0, SIDE, z0 + .05, x0 + .15, SIDE + 2, z0 + .25], 'awning'); REG.keep([x0, SIDE, z1 - .25, x0 + .15, SIDE + 2, z1 - .05], 'awning');
}
// the generator's cable to the camper, lying on the ground
function cable(ctx) { const [x0, z0, x1, z1] = atR(ctx, [327.9, -116.2, 330, -115.9]), V = ctx.volume(x0, SIDE, z0, x1, SIDE + .1, z1, {}); for (let x = 0; x < V.nx; x++) V.set(x, 0, (x >> 2) % 2 ? 1 : 2, 0x1b1b20); }
