// BLACKPINE WOODS (forest) · the district kit · owner: the Blackpine Woods agent (batch 4)
// All the island's non-urban land: a dark ring of woods round the city, bounded by the coast and the bay (districts/forest/land.js:
// the coast, the LAKE of the plan, ponds). Black pines in the deep woods, oaks, birches and autumn maples along the city's edge and the
// water; clearings, boulders, fallen logs; dirt tracks from the edge roads to the sim's places and footpaths round the lake. The city's
// edge roads get a sidewalk on the woods' side too (the street furniture stands on it), then the woods' edge: a fieldstone wall, a
// split-rail fence, chain link, a hedge or a guardrail, open where a track or a trail comes out.
// Sim roles: the LEAF dig site (−330, 60): piles rise and fall with the sim in a clearing by the lake; three COOK LABS (cooking heat
// +1 at a lab against +4 at home), hidden in the trees at the end of dirt tracks: north (330, −110) the RV, west (−400, −150) the
// cabin, south (−120, 390) the tin shack.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { WOODS, SITES, CAMP, elev, lakeOf, roadDist, SHORE } from './forest/plan.js';
import { woods, woodsFar, PIT } from './forest/woods.js';
import { LAMPS } from './forest/landing.js';   // stitch pass: the Route 9 ferry landing's lamps (its build: forest/landing.js)
import { P } from '../plan.js';
import { shiftOf } from '../../../world/city.js';
import { stopAt, camera, kerbX, kerbZ } from './frame.js';
// SPREAD · the kit's marks are today's metres (districts/frame.js): the stop keeps to the Birch St kerb, the safehouse is the campsite
// (it moves with the lake: plan.js CAMP); the cameras frame their woods block (the trailhead's
// from across Birch St, as today), the two that stand at a street's end or a corner from where they stood

const SEA = 0x2f86d8, LAKE = 0x2f8ad0, FLOOR = 0x2e5a2c, SOIL = 0x5a3e26, ASPH = 0x5d5e6b;

export default defineKit({
  district: 'forest', name: 'Blackpine Woods', owner: 'the Blackpine Woods agent (batch 4)', status: 'built',
  role: 'All the island\'s non-urban land. The LEAF dig site (−330, 60): the piles rise and fall with the sim in a clearing by the lake. Three COOK LABS, where cooking heat is +1 at a lab against +4 at home: north (330, −110), west (−400, −150), south (−120, 390), hidden in the trees at the end of dirt tracks. No street demand (walkers stay on the city\'s sidewalks).',
  built: WOODS,
  grammar: { ...BASE, life: [0, 0], walkway: 0 },
  palette: PALETTE,
  lexicon: LEXICON,
  heroes: [   // lazy like every block; their far tier is the kit's (the trees, the floor, and herofar.js silhouettes)
    { id: 'lab-north', block: [10, -4], module: 'heroes/forest-lab-north.js', fn: 'labNorth', far: 'kit' },
    { id: 'lab-west', block: [-13, -5], module: 'heroes/forest-lab-west.js', fn: 'labWest', far: 'kit' },
    { id: 'lab-south', block: [-4, 12], module: 'heroes/forest-lab-south.js', fn: 'labSouth', far: 'kit' },
    { id: 'lookout', block: [-10, -1], module: 'heroes/forest-tower.js', fn: 'fireTower', far: 'kit' },
    { id: 'leaf-clearing', block: [-11, 1], module: 'heroes/forest-leaf.js', fn: 'leafClearing', far: 'kit' },
  ],
  build(ctx) { woods(ctx); },
  far(ctx) { woodsFar(ctx); },
  // the ground under a woods block (ground.js paints it when the block is not urban): asphalt on the edge roads' woods half, the sea and
  // the lake where the island has no land, soil in the leaf pits, a dark forest floor under everything the blocks draw over.
  // rect(x0, z0, x1, z1, colour) in world metres; res: the cell size the texture can show (m)
  ground(i, j, rect, res = 4) {
    const x0 = i * P, z0 = j * P, h = P / 2; if (elev(x0 + h, z0 + h) < -30) { rect(x0, z0, x0 + P, z0 + P, SEA); return; }
    rect(x0, z0, x0 + P, z0 + P, FLOOR);
    for (let x = x0; x < x0 + P; x += res) for (let z = z0; z < z0 + P; z += res) { const cx = x + res / 2, cz = z + res / 2; if (elev(cx, cz) < 1.5) rect(x, z, x + res, z + res, lakeOf(cx, cz) < 1.4 ? LAKE : SEA); }
    let near = 1e9; for (const a of [0, h, P]) for (const b of [0, h, P])   // (SPREAD: the block's corners, edges and middle)
      near = Math.min(near, roadDist(x0 + a, z0 + b));
    if (near < 20) for (let x = x0; x < x0 + P; x += .5) for (let z = z0; z < z0 + P; z += .5) if (roadDist(x + .25, z + .25) < 0) rect(x, z, x + .5, z + .5, ASPH);
    if (Math.abs(x0 + h - SITES.leaf[0]) < 24 && Math.abs(z0 + h - SITES.leaf[1]) < 24) for (let x = x0; x < x0 + P; x += .5) for (let z = z0; z < z0 + P; z += .5) if (PIT(x + .25, z + .25)) rect(x, z, x + .5, z + .5, SOIL);
  },
  hooks: { sites: { woods: { x: SITES.leaf[0], z: SITES.leaf[1], r: 6.5 } },   // (SPREAD: the sim's place, plan.js)
            labs: { north: SITES.labN, west: SITES.labW, south: SITES.labS } },
  transit: [stopAt({ id: 'bus-blackpine', kind: 'bus', name: 'BLACKPINE', x: -258.4, z: 38.4, rot: 1 }),   // Birch St at the main trailhead (the leaf track): the dig site's stop
    // (SUBWAY PLAN 2026-10-09) GATEHILL on the UNION, across Union Ave from OFFSHORE: open stairs on the woods' lawn behind the hedge, the
    // flight north into the woods (block −6,3). The spec's site (−188.75, 153.5) was set into the tower's showroom window on the other side
    // of the avenue — not clean (the railings stood behind the showroom's glass): the same x, 17 m north (kerbX / kerbZ of today's −166.75, 122.5)
    { id: 'subway-gatehill', kind: 'subway', name: 'GATEHILL', lines: 'U', x: kerbX(-166.75), z: kerbZ(122.5), face: '+z', entry: 'stairs' }],
  safehouses: [{ id: 'safe-lake-camp', name: 'the campsite by the lake', x: CAMP[0], z: CAMP[1], note: 'a tent on the north shore; nobody asks, the canoe is the back door' }],
  lamps: LAMPS,   // stitch pass: street lamps the kit stamps itself (not corner lamps): the night lights are lent to them too (main.js placeLamps)
  peds: { density: 0 },
  cameras: {
    overhead: camera({ pos: [-222, 118, 138], tgt: [-334, 0, 32], fov: 44, sh: [-322, 34, 110] }, shiftOf(-11, 1)),
    street: [camera({ name: 'birch-st-trailhead', pos: [-251.4, 2.9, 60.5], tgt: [-268, 3.4, 44], fov: 54, sh: [-262, 48, 30] }, shiftOf(-9, 1)),
      camera({ name: 'grand-ave-end', pos: [-128, 2.9, 272], tgt: [-127, 3.4, 300], fov: 54, sh: [-127, 296, 34] }, shiftOf(-4, 9), 'place')],
    landmark: camera({ name: 'lookout-central-ave', pos: [-244, 3.4, -6.2], tgt: [-297, 8.8, -6.0], fov: 46, sh: [-276, -6, 34] }, shiftOf(-10, -1), 'place'),
    night: camera({ name: 'rv-lab-night', pos: [319.6, 1.7, -106.2], tgt: [330.6, 1.9, -111.6], fov: 50, sh: [326, -110, 18] }, shiftOf(10, -4)),
  },
});
