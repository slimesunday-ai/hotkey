// NEON ROW (strip) · the district kit (pass 2, batch 3). Owner: the Neon Row agent.
// The night street. Four blocks: Jay St between Washington and Lincoln (−2,1 and −1,1: the night market, Sing Sing Karaoke and the
// NO WITNESS club face each other across a narrow street), Maple & Washington (3,1: the Graveyard Shift diner) and Grand & 1st
// (−5,−2: Honest Pawn). Each block is one hero module (heroes/strip-*.js): the hand-made pieces first, then the shared generator fills
// the other lots through districts/strip/fill.js with this grammar — walk-ups over continuous neon shopfronts (apartments above the
// shops: the home ladder's tier 2), no towers or offices, every shop and hero sign unique across the district (fill.js NAMES).
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON, NEUTRALS } from '../grammar.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
// SPREAD · the kit's hand marks are today's metres (districts/frame.js): a stop keeps to its kerb (stopAt), the safehouse through remap,
// a camera on what it frames (camera: the Jay St pair; the night market seen from the Jay & Washington crossing, a place of its own)
const rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

const pick = (r, opts) => { const t = opts.reduce((s, o) => s + o[1], 0); let x = r() * t; for (const [v, w] of opts) { if ((x -= w) < 0) return v; } return opts[0][0]; };
// night-friendly walls from the style list (the two oranges stay downtown's): violet, pink, teal, blue, raspberry, red, purple,
// yellow and green for the day read, sky blue
const WALLS = [0x7a3cff, 0xff4fa3, 0x12b3a0, 0x2f5bff, 0xe83b5b, 0xef4a2a, 0x8c52ff, 0xffc21a, 0x25b84c, 0x3fa9f5];
const N = NEUTRALS;

export default defineKit({
  district: 'strip', name: 'Neon Row', owner: 'the Neon Row agent (batch 3)', status: 'built',
  role: 'The night street. Street demand 2 by day and 10 at night (rules DEMAND): the best night corners on the island, Jay St & Washington St (−32, 32), Grand Ave & 1st St (−128, −32) and Maple St & Washington St (96, 32). Bars, the NO WITNESS club with its rope line, Sing Sing Karaoke, the Jay St night market, the Graveyard Shift diner, Honest Pawn, OTB, liquor, chicken, hookah, check cashing and bail bonds; walk-up apartments over the shops.',
  built: [[-2, 1], [-1, 1], [3, 1], [-5, -2]],
  grammar: { ...BASE,
    towerKinds: '',                                           // no towers: the strip is walk-ups and low bars
    alley: .45,
    // a lot may pin its type (fill.js explicit layouts: the district's one corner deli); otherwise walk-ups over shops, low bar boxes
    typeOf(c, r) {
      if (c.l.type) return c.l.type;
      if (c.corner) return pick(r, [['walkup', 6], ['shop2', 1], ['loft', 1]]);
      if (c.l.front >= 8) return pick(r, [['walkup', 6], ['loft', 2], ['shop2', 1]]);
      return pick(r, [['walkup', 6], ['shop2', 2], ['brownstone', 1]]);
    },
    storeys(type) { return { walkup: [3, 5], brownstone: [3, 4], bodega: [3, 4], loft: [4, 6], shop2: [1, 2] }[type] || [2, 3]; },
    // every walk-up on the strip has its shops on the street; brownstones keep their stoops (a rest in the neon)
    groundOf(c, r) { const t = c.type; return t === 'brownstone' ? 'stoop' : (t === 'parking' || t === 'alley') ? t : t === 'walkup' ? pick(r, [['shop', 9], ['resi', 1]]) : 'shop'; },
    twoShops(c, r) { return c.type !== 'bodega' && c.l.front >= 9 && r() < .45; },
    windows: { ...BASE.windows, walkup: [['punched', 3], ['arched', 2], ['tall', 2], ['shutter', 1], ['balcony', 2], ['paired', 2], ['bay', 1]] },
    signKinds: [['neon', 5], ['blade', 3], ['box', 2], ['awnSlope', 2], ['awnBox', 1], ['band', 1]],
    fire: (type, st) => (type === 'walkup' || type === 'loft') && st >= 3,
    // roof set pieces: fill.js hands every block its own kinds (no piece repeats across the district); the rooftop neon frame stays
    // off the strip (its words are the downtown voice) — Neon Row's neon is on its facades
    pieces: { calm: .4, count: [.75, .3], heroCount: 1, order: ['party', 'ring', 'pool', 'cash', 'grow', 'billboard', 'pizza', 'burger', 'court', 'garden'] },
    oneOffs: [],                                              // the strip's own scenes (fill.js): a hot-dog cart, a curbside card game…
    life: [0, 0], windowPeople: 0, fireSitter: 0,             // generic pedestrians only (peds.js); no static people on the strip
    walkway: .5, walkband: { from: 1.2, corners: .8 } },    // the walkers' half metre, on the curb side (the core's curb band: gen.js walkBand)
  palette: { ...PALETTE, walls: WALLS,
    neutral: { ...PALETTE.neutral, share: .34, tones: [N.brick, N.white, N.slate, N.pale, N.brick, N.grey, N.buff, N.bone], lean: { loft: -.08, shop2: .06, bodega: .12 } } },
  // the sign voice. fill.js deals every block its own list (strip/names.js), so no name repeats across the district; these are only the
  // fallbacks. Wall ads, ghost signs and billboards stay with the shared signage system.
  lexicon: { ...LEXICON,
    delis: ['JAY ST DELI'],
    plaques: ['THE DELPHINE', 'ORCHARD ARMS', 'THE MARLOWE', 'VESPER HALL', 'THE LORRAINE', 'MONARCH ARMS', 'THE FAIRMOUNT', 'THE ESTELLA'],
    tags: ['NITE', 'XO', 'WOW', 'LUV', 'OK', 'HI'],
    boards: ['OPEN', 'LIVE DJ', 'LATE', 'SHOTS', '2 4 1', 'WINGS', 'BEER', 'ATM', 'CASH', 'HOT', 'LOTTO', 'ICE', 'EAT', 'NO ID?'].filter(s => s.length <= 6),
  },
  heroes: [
    { id: 'jay-market', block: [-2, 1], module: 'heroes/strip-jay.js', fn: 'jayMarket', place: 'corner--1_1' },    // the night market + Sing Sing Karaoke
    { id: 'no-witness', block: [-1, 1], module: 'heroes/strip-club.js', fn: 'noWitness' },                        // the club with the rope line
    { id: 'graveyard-diner', block: [3, 1], module: 'heroes/strip-diner.js', fn: 'graveyardDiner', place: 'corner-3_1' },
    { id: 'honest-pawn', block: [-5, -2], module: 'heroes/strip-pawn.js', fn: 'honestPawn', place: 'corner--4_-1' },
  ],
  hooks: {},                                                  // walk-up units come from the build (ctx.anchor.building, gen.js)
  // a cab stand by the club (the sim has taxis now: TIME.taxi); a bus stop on Grand Ave for Honest Pawn and the OTB
  transit: [
    stopAt({ id: 'taxi-jay', kind: 'taxi', name: 'JAY ST', x: -29.7, z: 54.5, rot: 3 }),
    stopAt({ id: 'bus-grand', kind: 'bus', name: 'GRAND AVE', x: -132.55, z: -41.5, rot: 1 }),
  ],
  safehouses: [{ id: 'safe-jay-walkup', name: 'the room over Sing Sing', ...rm(-40.5, 50.2), note: 'reserved: a karaoke room upstairs, one floor over the Jay St corner' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [-31, 70, 90], tgt: [-31, 0, 47], fov: 44, sh: [-31, 46, 56] }, shiftOf(-1, 1)),         // the Jay St pair from due south, 58° down: Jay St between them, downtown behind
    street: [{ name: 'jay-st', rule: 'street', block: [-2, 1], side: '+x' }, { name: 'washington-st', rule: 'street', block: [-1, 1], side: '-z' }],
    landmark: camera({ name: 'night-market', pos: [-33.2, 1.6, 30.8], tgt: [-42.4, 4.6, 42.2], fov: 46, sh: [-40, 40, 20] }, shiftOf(-2, 1), 'place'),   // from the Jay & Washington crossing: the arch, the stalls, the singer over them
    night: { name: 'jay-st-night', rule: 'street', block: [-2, 1], side: '+x' },
  },
});
