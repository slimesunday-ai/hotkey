// Block 2,0 (x 64…96, z 0…32) · South Row (Central Ave to Washington St) · owner: the south-row location agent (LOCATIONS.md).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
//
// South Row pass (2026-09-26) · character: the stoop block. Twelve narrow lots, brownstones and walk-ups on Linden and Maple,
// the FREE couch on Washington St, CHOP CHEESE's roof party. Its giant (OPTICAL's eye, the same shop and gag as next door) never
// found a clear spot on the Central Ave front (the fire escape runs across it): the corner becomes ALIBI BURGER, and its giant
// burger hangs round the corner on Maple St, where the wall is clear.
// Names that repeated the next blocks (PAPI 404 DELI, CHAINZ) are this block's own now; the two yellow walk-ups side by
// side on Linden St become yellow and pink, and the blue run on Maple St gets an orange stoop house in the middle.
import { giantObject } from '../props.js';
import { REG } from '../audit.js';
import { SIDE, shade } from '../style.js';
import { kerbX, kerbZ } from '../districts/frame.js';   // SPREAD: every x, z here is today's metres, carried by kerbX / kerbZ (the block's shift; a kerb
// thing kept to its kerb, a shopfront thing to the shopfront: style/city/SPREAD.md)
const kp = p => ({ ...p, x: kerbX(p.x), z: kerbZ(p.z) });

export default {
  remove: [],
  move: {},
  replace: {},
  lots: {
    L1: s => { Object.assign(s.shops[0], { name: 'ALIBI BURGER', sign: 0xe8232a, disp: 'food', obj: 'burger' }); s.gag = null; },   // the burger is hand-hung on Maple St (add)
    L2: s => { s.shops[0].name = 'NITE OWL DELI'; },                                          // (was PAPI 404 DELI, as on Ivy St)
    L6: s => { s.shops[0].name = 'PAWN · GOLD'; },                                            // (was CHAINZ, as on Ivy St; the box sign fits PAWN)
    L10: s => { s.wall = 0xff4fa3; s.bayCol = shade(s.wall, 1.12); },                          // JUICE?: pink (two yellows side by side)
    L11: s => { s.wall = 0xff7a1a; s.bayCol = shade(s.wall, 1.12); },                          // between two light blues: orange
  },
  add(api) {
    // ALIBI BURGER's giant burger, on the Maple St face of the corner walk-up (clear of its window boxes and the fire escape round
    // the front); the bracket meets the wall 4 m up, the burger hangs over the sidewalk, seen up and down Maple St
    const g = giantObject('burger'), x = kerbX(92), y = SIDE + 3.9, z = kerbZ(11.6), why = REG.why(REG.boxOf(g, 0, x, y, z), { ignore: 'plinth', doors: false, items: false });
    if (why) REG.skip('giant', [x, y, z], 'hand: ' + why); else api.stamp(g, api.bank, 0, x, y, z);
  },
  people: {
    remove: ['2_0·char·21', '2_0·char·22', '2_0·char·27'],   // six talking pairs in one block: the two on Maple St go (they stood on the walkers' line, one pair 0.5 m apart) (ids re-mapped in the cleanup pass)
    move: {},
    add: [
      { x: 69.15, z: 13.65, y: SIDE + .3, ry: -Math.PI / 2 + .2, act: 'sit', seed: 3001 },    // L9's stoop, the landing step
      { x: 68.85, z: 14.45, y: SIDE + .1, ry: -Math.PI / 2 - .3, act: 'sit', seed: 3002 },    // one step down (cleanup pass: 0.35 m along the step, the two big heads touched)
      { x: 67.3, z: 13.25, ry: Math.PI / 2 - .2, act: 'talk2', seed: 3003 },                  // at the foot, talking up to them
    ].map(kp),
  },
};
