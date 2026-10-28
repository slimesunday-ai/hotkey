// BLACKPINE WOODS · the far silhouettes of the woods' built things (owner: the Blackpine Woods agent). Worker-safe.
// A hero slot's far tier is the kit's (far: 'kit'): the trees, the floor, and these boxes — the lookout reads from across the city
// (legs, a white cab, the red roof, the mast); the shacks are a roof and a blue tarp in the trees.
import { boxInto } from '../../vox.js';
import { SIDE } from '../../style.js';
import { P, TOWER, CAMP, STAND, DECK } from './plan.js';
import { remap } from '../../../../world/city.js';

const B = (x0, y0, z0, x1, y1, z1, c) => [x0, y0, z0, x1, y1, z1, c], T = TOWER, TARP = 0x2f6fe0;
// SPREAD · a shack's box in today's metres moves whole with its block (remap of its first corner); the boxes on plan.js anchors are there already
const RB = (x0, y0, z0, x1, y1, z1, c) => { const [a, b] = remap(x0, z0), dx = a - x0, dz = b - z0; return [a, y0, b, x1 + dx, y1, z1 + dz, c]; };
const FAR = [
  // the lookout: four legs, the deck, the white cab, the red roof in three steps, the mast
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => B(T[0] + sx * 2.1 - .2, 0, T[1] + sz * 2.1 - .2, T[0] + sx * 2.1 + .2, 15, T[1] + sz * 2.1 + .2, 0xb9bcc4)),
  B(T[0] - 2, 15, T[1] - 2, T[0] + 2, 15.2, T[1] + 2, 0x6d707a), B(T[0] - 1.5, 15.2, T[1] - 1.5, T[0] + 1.5, 17.6, T[1] + 1.5, 0xf4f1ea),
  B(T[0] - 1.7, 17.6, T[1] - 1.7, T[0] + 1.7, 18.2, T[1] + 1.7, 0xe8232a), B(T[0] - 1.1, 18.2, T[1] - 1.1, T[0] + 1.1, 18.8, T[1] + 1.1, 0xe8232a), B(T[0] - .5, 18.8, T[1] - .5, T[0] + .5, 19.4, T[1] + .5, 0xe8232a),
  B(T[0] - .1, 19.4, T[1] - .1, T[0] + .1, 21.8, T[1] + .1, 0x6d707a),
  // the north shack: the camper and its tarp
  RB(330, .4, -115.6, 332.4, 2.7, -108, 0xefe6cf), RB(327.4, 2.0, -114.2, 330, 2.5, -108.6, 0x4f5a36),
  // the west shack: the cabin, its green roof, the porch roof, the drums' tarp
  RB(-405.4, 0, -155.2, -400.6, 2.4, -149.2, 0x8a5530), RB(-405.8, 2.4, -155.6, -400.2, 3.3, -148.8, 0x2f6a45), RB(-400.6, 2.0, -155, -398.6, 2.3, -149.4, 0x2f6a45), RB(-405.4, 1.6, -160.2, -400.0, 1.9, -157.2, 0x4f5a36),
  // the south shack: rusted tin, the silver roof, the vent stack, the tarp on the east wall
  RB(-124.6, 0, 391, -118.8, 2.3, 395.8, 0xa4502a), RB(-124.9, 2.3, 390.7, -118.5, 2.6, 396.1, 0xb9bcc4), RB(-120.2, 0, 395.8, -119.9, 4.1, 396.1, 0xb9bcc4), RB(-118.7, 0, 391.4, -118.5, 2.2, 395.4, TARP),
  // the leaf clearing's tarp; the camp's tent; the hunting stand's blind; the log deck
  RB(-343.4, 1.9, 58.2, -339.8, 2.3, 62.4, TARP), B(CAMP[0] - 4.7, 0, CAMP[1] - 2.5, CAMP[0] - 2.5, 1.2, CAMP[1] + .1, 0xff7a1a),
  B(STAND[0] - .7, 3.2, STAND[1] - .7, STAND[0] + .7, 4.4, STAND[1] + .7, 0x4f6b33), B(STAND[0] - .5, 0, STAND[1] - .5, STAND[0] + .5, 3.2, STAND[1] + .5, 0x7a5230),
  B(DECK[0] - 3, 0, DECK[1] + 1.8, DECK[0] + 1, 1.1, DECK[1] + 3.4, 0x7a4a26), B(DECK[0] + 1.2, 0, DECK[1] + .6, DECK[0] + 5.2, 1.1, DECK[1] + 2.2, 0x7a4a26),
];
// draw the silhouettes whose box centre lies in this block (whole: they are small, or tall and slim)
export function heroFar(bank, i, j, air) { let top = 0;
  for (const [x0, y0, z0, x1, y1, z1, c] of FAR) { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; if (Math.floor(cx / P) !== i || Math.floor(cz / P) !== j) continue;
    boxInto(bank, 0, x0, SIDE + y0, z0, x1, SIDE + y1, z1, air(c), 55); top = Math.max(top, y1); }
  return top; }
