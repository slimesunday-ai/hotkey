// Block 0,0 (x 0…32, z 0…32) · South Row (Central Ave to Washington St) · owner: the south-row location agent (LOCATIONS.md).
// The dealing corner at Kent St & Washington St lands in this block too: its props (ids 0_0·corner·…) belong to the corners agent (blocks/corners.js).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
//
// South Row pass (2026-09-26) · character: Main & Central, downtown's crossroads: SNEAKS and its giant sneaker between the money
// towers, the HOT cart on Kent St. The giant never found a clear spot (the fire escape ran across the whole shopfront): the escape
// moves to the back wall, where L5 already had one, and the sneaker hangs over Central Ave. The three purple buildings on the Main St
// corner become teal, purple, purple (neighbours never share a colour), and the corps stop repeating the next block's names.
import { streetTree, milkCrate } from '../props.js';
import { REG } from '../audit.js';
import { SIDE, shade } from '../style.js';
import { kerbX, kerbZ } from '../districts/frame.js';   // SPREAD: every x, z here is today's metres, carried by kerbX / kerbZ (the block's shift; a kerb
// thing kept to its kerb, a shopfront thing to the shopfront: style/city/SPREAD.md)
const kp = p => ({ ...p, x: kerbX(p.x), z: kerbZ(p.z) });

// a slim street tree: its trunk column must be clear of everything; its crown (3.6 m up) only of masses and items
const tree = (api, seed, x, z) => { x = kerbX(x); z = kerbZ(z); const bk = streetTree(seed), trunk = [x - .3, SIDE, z - .3, x + .3, SIDE + 3.6, z + .3], crown = [x - 1.05, SIDE + 3.6, z - 1.05, x + 1.05, SIDE + 6.1, z + 1.05];
  const why = REG.why(trunk) || REG.why(crown, { ignore: ['facade'], doors: false }); if (why) { REG.skip('street-tree', [x, SIDE, z], 'hand: ' + why); return false; } api.stamp(bk, api.bank, 0, x, SIDE, z); return true; };

export default {
  remove: [],
  move: {},
  replace: {},
  lots: {
    L0: s => { s.wall = 0x12b3a0; s.bayCol = shade(s.wall, 1.12); },   // HUSH MONEY INC: teal (it was the third purple in a row)
    L1: s => { s.corp = 'LOOPHOLE LAW'; },                             // (was DIALUP TRUST, as across Main St)
    L2: s => { s.corp = 'MODEM MUTUAL'; },                             // (was 56K TELECOM, the third on this row)
    L3: s => { s.corp = 'PONZI & SONS'; },                             // (SHELL CO moved across Main St, where it is moving out)
    L5: s => { s.fire = false; s.fireBack = true; },                   // SNEAKS: the escape on the back wall, the giant sneaker out front
  },
  add(api) {
    // MAIN ST: two trees along the tower's podium; WASHINGTON ST: one by the hydrant (clear of MODEM MUTUAL's door)
    tree(api, 31, 4.45, 20.2);
    tree(api, 33, 4.45, 25.6);
    tree(api, 35, 10.95, 29.55);
    // ROOF: the writer of the throw-up on HUSH MONEY's roof, sitting back on a crate to look at it (the piece's standing figure is
    // refused by the cast's wall test, see NOTES-southrow); the spot was checked voxel by voxel, clear of the paint and the parapet
    api.stamp(milkCrate(0xff4fa3), api.bank, 0, kerbX(11.1), 27.8, kerbZ(13.1));
  },
  people: {
    remove: [], move: {},
    add: [
      { x: 4.4, z: 27.4, ry: -Math.PI / 2 - .4, act: 'phone', seed: 2001 },    // waiting to cross Main St at Washington (cleanup pass: at the kerb, off the walkers' corner lines)
      { x: 11.1, z: 13.1, y: 27.8, ry: -2.54, act: 'sit', seatY: .5, seed: 2002 },   // on the roof, admiring the tag
    ].map(kp),
  },
};
