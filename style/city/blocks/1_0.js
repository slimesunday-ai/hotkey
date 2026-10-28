// Block 1,0 (x 32…64, z 0…32) · South Row (Central Ave to Washington St) · owner: the south-row location agent (LOCATIONS.md).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
//
// South Row pass (2026-09-26) · character: the leisure block. The domino table on Kent St, the pool on FRONT CORP's roof, the green on
// Central Ave with its picnic table, CORNER 24 DELI on the corner. Names that repeated the next blocks become its own.
import { streetTree } from '../props.js';
import { REG } from '../audit.js';
import { SIDE } from '../style.js';
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
    L1: s => { s.shops[0].name = 'DEADSTOCK'; },   // (was SNEAKS, as on the next block: still sneakers)
    L2: s => { s.corp = 'FRONT CORP'; },          // (was 56K TELECOM, the third on this row)
  },
  add(api) {
    tree(api, 41, 61.55, 24.2);   // LINDEN ST: one more along ALIBI CAPITAL's blank podium (past the bags, short of the corner lamp)
  },
  people: {
    remove: ['1_0·char·8', '1_0·char·16'],    // a carrier inside DEADSTOCK's talking pair, a leaner inside WINGS 404's carrier
    move: { '1_0·char·10': [-.76, 0, -.15] },  // the talking pair stood 0.1 m apart: now 0.9, facing each other (ids re-mapped in the cleanup pass)
    add: [
      { x: 61.6, z: 26.2, ry: Math.PI / 2 + .3, act: 'phone', seed: 1001 },   // waiting to cross Linden St at Washington (cleanup pass: at the kerb, off the walkers' corner lines)
      { x: 46.1, z: 7.62, ry: Math.PI, act: 'sit', seed: 1002 },               // a game at the green's picnic table…
      { x: 46.9, z: 6.3, ry: 0, act: 'sit', seed: 1003 },                      // …across from each other
    ].map(kp),
  },
};
