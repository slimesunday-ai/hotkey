// GATEHILL (estates) · the island's luxury tower district. Owner: the Gatehill agent (batch 4). Sixteen blocks (−9…−6 × 4…7; x −288…−160,
// z 128…256) between the north woods (Union Ave), the west and south woods and Pleasantview (Elm St): one tower per block, 32 penthouses.
// Every tower keeps the sim's two doors: an entrance court in the middle of its north and its south frontage, the lobby on the court's
// back wall, a doorman, a car line; the penthouses are the top floors (the north unit enters from the north court, the south unit
// from the south). The towers are all different (specs.js): pre-war stone and green copper, twin turrets, a white pencil, a gold deco
// supertall with a sunburst crown, a jenga stack, terracotta fins, balconies, a vertical forest, brick with a water tower; their roofs
// are the overhead set pieces (a sky pool, a helipad, a diamond ring, cabanas, a clay court, an orangery, a roof forest, a sky deck).
// Street level: luxury shopfronts on the side streets, an auction house, a supercar showroom. No static people but the doormen, the
// valets and the few on the roofs: walkers come from peds.js.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { towerAt } from './estates/specs.js';
import { buildEstate } from './estates/build.js';
import { farTower } from './estates/far.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
// SPREAD · the hand-placed marks below are today's metres (districts/frame.js): a bus or taxi stop kept to its kerb (stopAt), the safehouse
// through remap, a camera on what it frames (camera; Oak St's skyline from a place of its own). The identity at SPREAD 0
const rp = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

export default defineKit({
  district: 'estates', name: 'Gatehill', owner: 'the Gatehill agent (batch 4)', status: 'built',
  role: 'The top of the home ladder: 32 penthouses (sim tier "estate": price 150, rent 12/day), two per tower, on the top floors; the door is the tower lobby with a doorman (security), so a burglary is a heist past the lobby. Lit penthouse windows mean the owner is home and awake, dark ones mean asleep or out. No dealing corners; street demand is the suburbs\' (rules DEMAND has no estates row).',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .4 } },
  lexicon: LEXICON,
  heroes: [
    { id: 'aureum', block: [-7, 5], module: 'heroes/estates-aureum.js', fn: 'aureum', far: 'kit' },
    { id: 'offshore', block: [-6, 4], module: 'heroes/estates-offshore.js', fn: 'offshore', far: 'kit' },
    { id: 'solitaire', block: [-9, 6], module: 'heroes/estates-solitaire.js', fn: 'solitaire', far: 'kit' },
    { id: 'auction', block: [-8, 7], module: 'heroes/estates-auction.js', fn: 'auction', far: 'kit' },
  ],
  build(ctx) { if (towerAt(ctx.i, ctx.j)) buildEstate(ctx); },
  far(ctx) { farTower(ctx); },
  hooks: {},                                  // the penthouses are stacked units: anchors come from the build (ctx.anchor.building)
  // a bus stop on Elm St (route 14 comes up from Sunny Acres) and a cab stand on Union Ave by HALCYON's north court
  transit: [stopAt({ id: 'bus-gatehill', kind: 'bus', name: 'GATEHILL', x: -162.4, z: 172.5, rot: 1 }), stopAt({ id: 'taxi-union', kind: 'taxi', name: 'UNION AVE', x: -214.5, z: 132.4, rot: 2 }),
    stopAt({ id: 'bus-union-gatehill', kind: 'bus', name: 'GATEHILL', x: -170.5, z: 134.4, rot: 2 })],   // (W3b) the 22's stop on Union Ave at OFFSHORE (Elm St's is one-way: NO SVC this pass)
  safehouses: [{ id: 'safe-amberley-staff', name: 'the Amberley service floor', ...rp(-228.4, 240), note: 'reserved: the staff door off Cedar St, under the auction house (a way into Gatehill that skips the doormen)' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [-118, 212, 300], tgt: [-220, 40, 194], fov: 44, sh: [-222, 194, 110] }, shiftOf(-7, 6)),
    street: [{ name: 'cedar-st', rule: 'street', block: [-8, 5], side: '+x' }, { name: 'pine-st', rule: 'street', block: [-8, 6], side: '-z' }],
    landmark: camera({ name: 'gavel-and-grail', pos: [-259.4, 1.6, 228.6], tgt: [-251, 3.9, 236.4], fov: 46 }, shiftOf(-8, 7)),   // from across Birch St, north of the parked car: the loggia, the queue, the banners
    night: camera({ name: 'oak-st-skyline', pos: [-100, 3.4, 160], tgt: [-236, 50, 172], fov: 56, sh: [-200, 180, 120] }, shiftOf(-7, 5), 'place'),
  },
});
