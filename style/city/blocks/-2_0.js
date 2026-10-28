// Block -2,0 (x -64…-32, z 0…32) · South Row (Central Ave to Washington St) · owner: the south-row location agent (LOCATIONS.md).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
//
// South Row pass (2026-09-26) · character: the news corner. LAG DELI's billboard corner on Central & Ivy, COMICS and the barber
// next door, and the pass-1 newsstand back on Central Ave, tucked into the alley mouth (it no longer fit on Ivy St's 2 m sidewalk).
// Ivy St gets the block's one-off (the car-on-blocks scene never found a yard): a stripped car at the curb, hood up, a mechanic.
// Washington St: the pocket plaza gets its bench (a couple on it) and a second tree, the tower's sidewalk two trees and pigeons.
import { newsstand, milkCrate, bench, pigeons, carOnBlocks, tires, streetTree } from '../props.js';
import { Vol, meshed } from '../vox.js';
import { REG } from '../audit.js';
import { CV, SIDE } from '../style.js';
import { kerbX, kerbZ } from '../districts/frame.js';   // SPREAD: every x, z here is today's metres, carried by kerbX / kerbZ (the block's shift; a kerb
// thing kept to its kerb, a shopfront thing to the shopfront: style/city/SPREAD.md)
import { SPREAD } from '../../../world/city.js';
const kp = p => ({ ...p, x: kerbX(p.x), z: kerbZ(p.z) });

// hand placement: stamp where the registry finds no building mass, doorway or item in the way (facade overhangs were checked voxel
// by voxel in the audit when each spot was chosen); a spot that stops fitting is logged as a refused placement, never forced in
const put = (api, bk, rot, x, z, o = {}) => { x = kerbX(x); z = kerbZ(z); const y = o.y ?? api.SIDE, g = REG.blk.group; if (o.lot) REG.group(o.lot);   // o.lot: inside that lot (a pocket plaza's own planned slab is not in the way)
  const why = REG.why(REG.boxOf(bk, rot, x, y, z), { ignore: ['facade', 'plinth', ...(o.ignore || [])], doors: o.doors ?? true, items: o.items ?? true }); REG.group(g);
  if (why) { REG.skip(bk.kind, [x, y, z], 'hand: ' + why); return false; } api.stamp(bk, api.bank, rot, x, y, z); return true; };
// a slim street tree: its trunk column must be clear of everything; its crown (3.6 m up) only of masses and items
const tree = (api, seed, x, z, o = {}) => { x = kerbX(x); z = kerbZ(z); const bk = streetTree(seed), g = REG.blk.group; if (o.lot) REG.group(o.lot);
  const trunk = [x - .3, SIDE, z - .3, x + .3, SIDE + 3.6, z + .3], crown = [x - 1.05, SIDE + 3.6, z - 1.05, x + 1.05, SIDE + 6.1, z + 1.05];
  const why = REG.why(trunk, { ignore: 'plinth' }) || REG.why(crown, { ignore: ['facade', 'plinth'], doors: false }); REG.group(g);
  if (why) { REG.skip('street-tree', [x, SIDE, z], 'hand: ' + why); return false; } api.stamp(bk, api.bank, 0, x, SIDE + (o.dy || 0), z); return true; };
// tied newspaper bundles (the newsstand's delivery), memoized per variant
const MEMO = new Map();
const bundles = v => { let b = MEMO.get(v); if (b) return b;
  const V = new Vol(9, 7, 5, { s: CV, org: [-.45, 0, -.25] }), PAPER = [0xf2efe6, 0xe4e0d6, 0xf7f7f2], TW = 0x8b4a24;
  V.box(0, 0, 0, 5, 3, 4, (x, y) => y === 2 ? PAPER[2] : PAPER[(x + y) % 2]); V.box(2, 0, 0, 3, 3, 4, TW); V.box(0, 2, 1, 5, 3, 2, TW);   // bottom bundle + twine
  V.box(4, 0, 1, 9, 3, 5, (x, y) => y === 2 ? PAPER[0] : PAPER[(x + y + 1) % 2]); V.box(6, 0, 1, 7, 3, 5, TW);                           // its neighbour, turned
  if (v) { V.box(1, 3, 0, 6, 5, 4, (x, y) => y === 4 ? 0xe8232a : PAPER[1]); V.box(3, 3, 0, 4, 5, 4, TW); }                               // one more on top, red masthead
  b = meshed(V); b.kind = 'bundle'; MEMO.set(v, b); return b; };

export default {
  // the alley mouth on Central Ave makes room for the newsstand: its dumpster and a crate go (the alley keeps the rest)
  remove: ['-2_0·yard·dumpster·0', '-2_0·yard·crate·0', '-2_0·L6·crate·0',
    '-2_0·street·street-tree·0', '-2_0·street·bags·0',   // (cleanup pass: the kerb tree and bags in front of the newsstand left the walkers no way past its customer)
    // SPREAD: on the wider street the parked cars fall differently along Ivy St's kerb — one takes the car on blocks' spot — and the L8
    // trash can comes out to the kerb where the buddy's crate goes: both make room for the scene (today's city has neither in the way)
    ...(SPREAD ? ['-2_0·traffic·car·1', '-2_0·L8·trashcan·0'] : [])],
  move: {},
  replace: {},
  lots: {},
  add(api) {
    // THE NEWSSTAND (pass 1, restored): set into the alley mouth between COMICS and the barber, facing Central Ave, on the alley's
    // paving (x −48.5…−45.5 is paved; the kiosk is 2.6 m wide), its roof flush with the building line
    put(api, newsstand(), 2, -47.0, 6.95);
    put(api, bundles(1), 0, -49.2, 5.2);    // today's papers, still tied (cleanup pass: turned along the kerb and 0.15 m back, off the walkers' path)
    // THE ONE-OFF (car on blocks, lost in the yards): Ivy St's east lane, at the curb by CHAINZ and TATTOO; its wheels stacked behind it
    put(api, carOnBlocks(0), 0, -63.0, 17.6, { y: 0 });
    put(api, tires(), 0, -63.1, 14.55, { y: 0 });
    put(api, milkCrate(0x2f5bff), 0, -61.7, 19.6);                // his buddy's crate, on the kerb (cleanup pass: 0.5 m on, clear of the walkers' path)
    // WASHINGTON ST: the pocket plaza's bench (the generator's collided with its tree) and the tower's sidewalk (two trees, pigeons)
    put(api, bench(), 2, -51.35, 25.3, { y: SIDE + .1, lot: 'L6' });
    tree(api, 17, -51.4, 26.9, { lot: 'L6', dy: .1 });               // the plaza's second tree, behind the bench
    tree(api, 11, -45.4, 29.55);   // (crowns over the kerb lane; the car below is clear of them)
    tree(api, 14, -38.9, 29.55);
    put(api, pigeons(3), 0, -48.0, 29.0);
  },
  people: {
    remove: [],
    move: {
      '-2_0·char·7': [-1.6, 0, -.75, -2.4],     // off the deli doorway (it stood inside the door stander) to the Ivy St corner
      '-2_0·char·12': [2.25, .1, -2.05, 3.3],   // off the PAPI 404 doorway into the pocket plaza's mouth (up onto its paving) (ids re-mapped in the cleanup pass)
    },
    add: [
      { x: -46.85, z: 5.4, ry: .2, act: 'talk', seed: 2601 },                  // at the newsstand: a customer…
      { x: -48.2, z: 5.6, ry: 1.25, act: 'arms', seed: 2602 },                 // …and the news guy handing it over
      { x: -63.0, z: 20.05, y: 0, ry: Math.PI, act: 'arms', seed: 2603 },       // under the hood
      { x: -61.7, z: 19.6, ry: -Math.PI / 2 + .25, act: 'sit', seatY: .5, seed: 2604 },   // his buddy on the crate, supervising
      { x: -51.85, z: 25.42, y: SIDE + .1, ry: 0, act: 'sit', seatY: .5, seed: 2605 },   // the plaza bench
      { x: -50.85, z: 25.42, y: SIDE + .1, ry: -.15, act: 'sit', seatY: .5, seed: 2606 },
      { x: -36.4, z: 29.6, ry: Math.PI / 2 + .6, act: 'phone', seed: 2607 },     // waiting to cross Jay St at Washington (cleanup pass: at the kerb, off the walkers' corner lines)
    ].map(kp),
  },
};
