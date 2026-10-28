// NEON ROW · block −1,1 (Jay St east side, Washington to Lincoln, Main St) · owner: the Neon Row agent. Ids read -1_1·club·kind·n
// for the club and -1_1·L<k>·kind·n for the generated lots.
//   NO WITNESS, the club, across Jay St from the night market: a raspberry box, a black front with padded doors under a bulb canopy,
//   the name in pink tube on a black panel over the street, brass posts and a velvet rope along the wall toward the corner, the red
//   carpet, the doorman's podium, two searchlights on the roof. The market's festoon strings hang off its hooks, and Jay St's steam
//   pipe vents in the road by the crossing. The Jay & Washington corner is LIQUOR 24 (downtown's deli already has the corner across
//   Washington); the fill adds a HOTEL blade on the Lincoln corner, a martini and lips in upstairs windows and a curb couch.
import { fillBlock, mk, oneOff, shiftR, kerb } from '../districts/strip/fill.js';   // (SPREAD: CL, HOOKS and the lots in today's metres, the block's frame)
import { ropeLine, podium } from '../districts/strip/props.js';
import { couch, sandwich } from '../props.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { Vol, meshed, stamp } from '../vox.js';
import { AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE } from '../style.js';
import { neutralCap } from '../roofs.js';
import { acBox, vent, steamStack } from '../props.js';

const CL = [-28, 43, -19, 52], H = 96;
// the festoon's east ends (heroes/strip-jay.js FESTOON: z of each string, and the hook's height)
const HOOKS = [46.8, 51.2], HOOK_Y = 5.4;

export function noWitness(bank, b, A) {
  fillBlock(bank, b, A, { seed: 11101, pieces: ['ring', 'pool'], neon: ['martini', 'lips'], neonFaces: [3, 2], blades: [{ lot: 6, side: '-x', text: 'HOTEL', bg: 0x17171b, fg: 0xff3b3b, rim: 0x2de2e6 }],
    oneOff: (lots, keep) => oneOff(bank, lots, { where: [[5, '+z'], [4, '+z'], [3, '+x']], parts: [[couch(0x7a3cff), 2, 0, 1.45], [sandwich('FREE', PAL.red), 0, 1.95, 1.45]], lane: [.35, .9] }, keep),
    lots: [mk(-28, 36, -21, 43, ['-z', '-x'], 'NW', { name: 'LIQUOR 24', shops: 1 }), mk(-21, 36, -15, 43, ['-z']), mk(-15, 36, -6, 44, ['-z', '+x'], 'NE', { name: 'JOLT CAFE' }), mk(-14, 44, -6, 52, ['+x']),
      mk(-14, 52, -6, 60, ['+z', '+x'], 'SE'), mk(-21, 52, -14, 60, ['+z']), mk(-28, 52, -21, 60, ['+z', '-x'], 'SW')],
    heroes: [{ rect: CL, top: SIDE + (H + 8) * CV, nh: H + 7, group: 'club', faces: ['-x'] }],
    build() { const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
      try { club(ctx); ctx.finish(); } finally { REG.strict = false; } } });
}

const searchlight = () => { const V = new Vol(14, 20, 14, { s: CV, org: [-.7, 0, -.7] });   // a drum on a yoke, tilted at the sky
  V.box(4, 0, 4, 10, 2, 10, PAL.iron); V.box(6, 2, 6, 8, 7, 8, PAL.iron); V.box(2, 7, 6, 12, 8, 8, PAL.iron); V.box(2, 7, 6, 3, 13, 8, PAL.iron); V.box(11, 7, 6, 12, 13, 8, PAL.iron);
  for (let k = 0; k < 9; k++) V.box(3, 8 + k, 3 + k, 11, 11 + k, 6 + k, 0xc9ced6, 2); V.box(3, 16, 11, 11, 20, 12, 0xfff3c4, TOD.night ? 3 : 1);
  return Object.assign(meshed(V), { kind: 'searchlight' }); };

function club(ctx) {
  REG.group('club'); const [x0, z0, x1, z1] = shiftR(ctx, CL), WALL = 0xe83b5b, TR = PAL.cream, INK = PAL.ink, LT = TOD.night ? 3 : 1, PINK = 0xff2d95, CY = 0x2de2e6;
  const C = ctx.building(x0, z0, x1, z1, { h: H * CV, wall: WALL, trim: TR, faces: ['-x'], parapet: 6, extra: 16 }), f = C.F('-x'), L = f.len, O = C.V.org;   // a: 0 at the north end (z 43) → 90
  neutralCap(C.V, C.B, H, WALL, 0xb8b5ae);
  const wx = () => O[0] + C.B.x0 * CV, wz = a => O[2] + (C.B.z0 + a + .5) * CV;   // the wall plane (x) and the world z of column a
  // the black front: padded double doors (a 52–66), a lightbox poster of tonight's DJ, the carpet out to the rope's end
  f.box(0, 0, 0, L, 36, 2, INK); f.box(0, 0, 0, L, 3, 3, 0x2a2a30);
  const d0 = 52, d1 = 66; f.box(d0, 1, -4, d1, 27, 2, AIR); f.box(d0, 1, -5, d1, 27, -4, (a, y) => (a === d0 + 6 || a === d0 + 7) ? 0x2a2a30 : ((a + y) % 4 === 0 ? 0x5a0f22 : 0x7a1428), 0);
  for (const a of [d0 + 3, d1 - 4]) f.box(a, 12, -4, a + 1, 16, -3, PAL.gold, 2); f.box(d0 - 1, 27, 0, d1 + 1, 28, 3, PAL.gold, 2); for (const a of [d0 - 1, d1]) f.box(a, 0, 0, a + 1, 27, 3, PAL.gold, 2);
  f.box(24, 7, 0, 44, 25, 2, INK); f.box(25, 8, 1, 43, 24, 2, (a, y) => y > 19 ? 0xff4fa3 : y > 14 ? 0x2de2e6 : 0x7a3cff, LT);   // the lightbox: tonight's DJ
  f.box(24, 7, 2, 44, 8, 3, INK); f.box(24, 24, 2, 44, 25, 3, INK); f.box(24, 8, 2, 25, 24, 3, INK); f.box(43, 8, 2, 44, 24, 3, INK); f.text('DJ', 34, 22, 2, 3, INK, 0, 1, 1);
  f.box(4, 8, -2, 21, 24, 3, INK); f.box(5, 9, -1, 20, 23, 2, 0x1b1b2a); f.text('VIP', 5, 20, 2, 3, PAL.gold, 3);                // the VIP plate by the corner end
  // the canopy over the doors: black, a gold edge, a row of bulbs underneath (the big name is on the panel above)
  f.box(d0 - 6, 28, 1, d1 + 6, 34, 15, INK); f.box(d0 - 6, 34, 1, d1 + 6, 35, 15, PAL.gold, 2); f.box(d0 - 6, 28, 14, d1 + 6, 34, 15, 0x2a2a30);
  for (let a = d0 - 5; a < d1 + 5; a += 2) f.set(a, 27, 13, 0xfff3c4, LT);
  // the red carpet from the doors to the curb-side end of the canopy (flat, in the facade: walkers pass over it)
  f.box(d0 - 1, 0, 1, d1 + 1, 1, 13, (a) => (a === d0 - 1 || a === d1) ? PAL.gold : 0xc4122f);
  // upstairs: a row of round portholes glowing purple (the lounge), then the big panel: NO over WITNESS in pink tube, cyan border
  for (let a = 8; a + 8 < L; a += 14) { if (Math.abs(a + 4 - 38) < 7 || Math.abs(a + 4 - 82) < 7) continue;   // round portholes: a steel ring, purple glass
    for (let da = 0; da < 9; da++) for (let y = 41; y < 50; y++) { const r = Math.hypot(da - 4, y - 45); if (r > 4.6) continue; if (r > 3.4) f.box(a + da, y, 0, a + da + 1, y + 1, 2, 0xc9ced6, 2); else { f.box(a + da, y, -2, a + da + 1, y + 1, 2, AIR); f.set(a + da, y, -3, 0x8c52ff, LT); } } }
  const p0 = 3, p1 = L - 3, py0 = 58, py1 = 95; f.box(p0, py0, 0, p1, py1, 3, INK); f.box(p0, py0, 3, p1, py0 + 1, 4, CY, 3); f.box(p0, py1 - 1, 3, p1, py1, 4, CY, 3); f.box(p0, py0, 3, p0 + 1, py1, 4, CY, 3); f.box(p1 - 1, py0, 3, p1, py1, 4, CY, 3);
  f.text('NO', L >> 1, 91, 3, 4, PINK, 3, 2, 1); f.text('WITNESS', L >> 1, 75, 3, 4, PINK, 3, 2, 1);
  f.box(4, 60, 3, L - 4, 61, 4, (a) => a % 6 < 3 ? 0xffe23a : undefined, 3);   // a dashed tube under the name
  for (const a of [1, L - 2]) f.box(a, 36, 0, a + 1, py0, 2, PINK, 3);             // pink tube up both edges of the front, canopy to panel
  // the festoon's two hooks (the strings come across Jay St from the market and from Sing Sing)
  for (const z of HOOKS) { const a = Math.round((z - CL[1]) / CV); f.box(a, Math.round(HOOK_Y / CV) - 1, 1, a + 1, Math.round(HOOK_Y / CV) + 1, 3, PAL.iron); }
  REG.door(wx() - .5, wz(59), 3);
  // the rope line: five brass posts along the wall from the canopy toward the corner (0.5 m out, clear of the plinth and the doorway)
  ctx.put(ropeLine(5), wx() - .52, wz(26), { rot: 1, slide: [0, 1], reach: .4 });
  ctx.put(podium(), wx() - .72, wz(d1 + 5), { rot: 3, slide: [0, 1], reach: .5 });
  // the roof: two searchlights at the street edge, units behind (a stair bulkhead comes from nobody: the club's roof is service only)
  // (roof props stand on the club's own roof: strict mode reads that as inside its mass, so they go down as the generator's roofs do)
  // Jay St's steam pipe (the orange-and-white stack over a Con Ed hole), in the road between the crossing and the first parked car
  REG.strict = false; const [stx, stz] = kerb(-31.1, 37.4); stamp(steamStack(), ctx.bank, 0, stx, 0, stz);   // (1.1 m off the east kerb)
  const top = SIDE + H * CV; for (const a of [18, 72]) stamp(searchlight(), ctx.bank, 3, wx() + 1.2, top, wz(a));
  stamp(acBox(), ctx.bank, 1, x1 - 2.2, top, z0 + 2.4); stamp(acBox(), ctx.bank, 1, x1 - 2.2, top, z0 + 4.4); stamp(vent(3), ctx.bank, 0, x1 - 4.4, top, z1 - 2); REG.strict = true;
}
