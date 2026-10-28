// IRON ISLAND · hero · THE SALLY PORT (block 8,−10) · owner: the water-side agent (batch 5).
// The vehicle gate in the south wall (orange leaves, STOP plates) with its gatehouse (build.js), and on the apron in front of it the
// prison bus: white, the county-orange stripe, barred windows, CORRECTIONS down its side, number 07, an amber light bar, facing the
// bridge. Two in orange being walked to its door by an officer; a patrol car behind it; bollards along the sidewalk; the plate.
import { kitNow } from '../gen.js';
import { heroBlock } from '../districts/jail/build.js';
import { C, CV, SIDE, TOD, REG, lit, shade, letters, px, mini, logSign, person, plate, bollard, pv, prop, memo, floodMast, put } from '../districts/jail/lib.js';
import { copCar } from '../props.js';

export function sallyPort(bank, b, A) { heroBlock(bank, b, A, kitNow(), content); }
const SEEDS = { co: 9812, in1: 16958, in2: 25823 };   // (hk 1 … 3 after the tower's guard: a dark jacket, two in county orange)
// cast pass (2026-10-02): the seeds above were searched against the old roll; with the fresh cast each person carries an `outfit` instead
// (castspec.js lays cast.js OUTFITS over the roll): 'county' = Iron Island issue, 'officer' = precinct blues + cap. The seeds still vary the rest.

// the bus (0.1 m, facing +z at rot 0): 11 m long, 2.6 wide, 3.1 tall
export const prisonBus = () => memo('prisonbus', () => { const L = 110, Wd = 26, V = pv(Wd + 2, 34, L + 2, CV, (Wd + 2) / 2, (L + 2) / 2), N = TOD.night;
  const X = x => x + 1, Z = z => z + 1, B = (x0, y0, z0, x1, y1, z1, c, l = 0) => V.box(X(x0), y0, Z(z0), X(x1), y1, Z(z1), c, l);
  B(0, 3, 1, Wd, 29, L - 1, C.white); B(1, 29, 2, Wd - 1, 31, L - 2, 0xdcd8cf);                                                    // body, roof
  B(0, 3, 0, Wd, 7, 1, C.ink); B(0, 3, L - 1, Wd, 7, L, C.ink);                                                                     // bumpers
  for (const x of [0, Wd - 1]) { B(x, 5, 1, x + 1, 8, L - 1, C.orange); B(x, 4, 1, x + 1, 5, L - 1, C.ink); }                      // the stripe over a rub rail
  for (const x of [0, Wd - 1]) for (let z = 20; z < L - 22; z += 9) { B(x, 18, z, x + 1, 26, z + 7, N ? C.litLo : C.navy, N ? 3 : 0); for (let b = z + 1; b < z + 7; b += 2) B(x, 18, b, x + 1, 26, b + 1, C.steelL); }   // barred windows
  B(2, 15, L - 1, Wd - 2, 27, L, N ? C.litLo : C.glassHi, N ? 3 : 1); B(Wd / 2 - 1, 15, L - 1, Wd / 2 + 1, 27, L, C.ink);           // windscreen
  B(2, 18, 0, Wd - 2, 26, 1, C.navy); B(3, 8, L - 1, 7, 11, L, N ? 0xfff6d8 : 0xe9eef2, lit(1)); B(Wd - 7, 8, L - 1, Wd - 3, 11, L, N ? 0xfff6d8 : 0xe9eef2, lit(1));   // rear glass, headlamps
  B(0, 4, L - 19, 1, 27, L - 11, 0x3e4450); B(0, 15, L - 18, 1, 26, L - 12, N ? C.litLo : C.navy, N ? 3 : 0);                        // the door (right side: −x, facing +z), front
  B(4, 31, L - 22, Wd - 4, 33, L - 18, (x) => x % 4 < 2 ? 0xffa21a : C.ink, lit(1));                                              // the amber bar
  for (const z of [12, L - 26]) for (const x of [-1, Wd - 1]) { B(x, 0, z, x + 2, 7, z + 10, C.rubber); B(x + (x < 0 ? 0 : 1), 2, z + 3, x + (x < 0 ? 1 : 2), 5, z + 7, C.steel); }
  // CORRECTIONS on both sides between the stripe and the windows, 07 on the back
  const M = px('CORRECTIONS'), M2 = px('07');
  letters(V, M, '-x', Z(L / 2 - M.w / 2), 16, 0, C.ink); letters(V, M, '+x', (L + 2) - Z(L / 2 + M.w / 2), 16, Wd + 1, C.ink);
  letters(V, M2, '-z', (Wd + 2) - X(Wd / 2 + M2.w / 2), 16, 0, C.ink);
  return prop(V, 'bus'); });

function content(ctx) {
  ctx.group('sally'); const y = SIDE + CV;
  // the bus on the apron, facing west (the bridge); its door side toward the gate
  const bus = put(ctx, prisonBus(), 269.6, -295.9, { rot: 3, y, reach: .4, slide: [1, 0] });
  if (bus) { logSign(ctx, 'CORRECTIONS', bus[0], bus[1], 96);
    // an officer walking two in orange to the door (they come out of the gate)
    person(ctx, bus[0] - 3.9, y, bus[1] - 2.4, -.3, 'stand', SEEDS.co, { outfit: 'officer' });
    person(ctx, bus[0] - 2.5, y, bus[1] - 2.9, -.5, 'walk', SEEDS.in1, { outfit: 'county' });
    person(ctx, bus[0] - 1.1, y, bus[1] - 3.5, -.6, 'walk', SEEDS.in2, { outfit: 'county' }); }
  put(ctx, copCar(), 279.4, -300.2, { rot: 0, y, reach: .6 });
  for (const x of [259.4, 263.4, 267.4, 271.4, 275.4, 279.4]) put(ctx, bollard(), x, -292.5, { y, reach: .3, slide: [1, 0] });
  put(ctx, plate(['AUTHORIZED', 'VEHICLES ONLY'], C.chalk, C.red, { s: .05, post: 14 }), 260.9, -302.9, { rot: 0, y, slide: [1, 0] });
  put(ctx, floodMast(66), 259.3, -300.6, { rot: 0, y, reach: .4 });
}
