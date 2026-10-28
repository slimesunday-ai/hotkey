// IRON ISLAND + THE LONG BRIDGE (jail) · the plan (owner: the water-side agent, batch 5). Pure world geometry, worker-safe.
// Everything is authored once in world metres; every block draws only its own slice (lib.js wv), so a wall or a building that runs
// across a block line is one piece. North is −z. The plan's lines are law (world/city.js): the jail compound K is x 224…288,
// z −384…−290 (its slab; the sidewalk z −292…−290), the island road runs on z −288 (asphalt −290…−286, segZ(−9, 7|8)), Route 9 runs
// on x 224 (asphalt 217…231, sidewalks 215…217 and 231…233) from the mainland (z −256) over the bay to the island road (a T).
// The sim's jail is at (256, −338): the yard gate, where the jailed wait.
import { P as PITCH } from '../../../../world/city.js';
export const P = PITCH;   // (SPREAD: the plan's pitch)
export const JAIL = [256, -338];                                   // sim place (sim2/places.json): the yard gate
export const ISLAND = { x0: 224, z0: -384, x1: 288, z1: -290 };    // the compound's slab (the south sidewalk is its last 2 m)
export const WALKN = -292;                                         // the island road's north sidewalk: z −292 … −290 (the K slab)

// ── the road system over the water (the jail kit adopts the three sea blocks it crosses): tops y 0.1 (road) and 0.2 (sidewalk)
export const DECK = { road: .1, walk: .2 };
export const R9 = { x: 224, a0: 217, a1: 231, w0: 215, w1: 233, z0: -292, z1: -256 };   // Route 9 on the bridge: asphalt a0…a1, sidewalks to w0/w1
export const IR = { z: -288, a0: -290, a1: -286, s1: -284, x1: 288 };                   // the island road: asphalt a0…a1; the quay sidewalk a1…s1
// the lift bridge: two steel towers (legs outside the sidewalks, a portal girder with the name board, the machinery house, sheaves,
// counterweights up in the legs because the span is down) and the lift span between them, a through truss on the road's edges
export const TOWERS = { S: { z0: -265.4, z1: -263 }, N: { z0: -279.4, z1: -277 } };
export const LEG = { W: [211.2, 214.6], E: [233.4, 236.8] }, LEG_Y = [1, 17.6], GIRDER = [17.6, 20.8], HOUSE = [20.8, 23.2];
export const SPAN = { z0: -277, z1: -265.4, W: [217, 217.4], E: [230.6, 231], top: 6.2, chord: .6 };
export const BOOTH = { x0: 222.6, x1: 225.4, z0: -284, z1: -280 };   // the checkpoint: a median island at the island end, the booth on it
export const BRIDGE_GREEN = 0x25b84c;

// ── the compound: the outer wall (centreline rect), three guard towers, the lighthouse on the north-east point
export const WALL = { x0: 230, x1: 282, z0: -378, z1: -304, t: 1.2, h: 6 };                // 1 m thick, 6 m of concrete, the wire on top
export const GTOWERS = [   // guard towers on the wall's corners (the north-east corner is the point, with the light); seed: the guard's look (a dark jacket)
  { id: 'T1', x: 230, z: -304, h: 12.4, roof: 'hip', trim: 0xffc21a, light: [1, 1], seed: 1046 },
  { id: 'T2', x: 282, z: -304, h: 11.2, roof: 'flat', trim: 0xe8232a, light: [-1, 1], seed: 1351 },
  { id: 'T3', x: 230, z: -378, h: 13.2, roof: 'cone', trim: 0x2f5bff, light: [1, -1], seed: 2462 },
];
export const LIGHT = { x: 285.2, z: -381.2, r: 1.9, h: 17.2 };      // IRON POINT light: red and white, the lantern on top
export const NE_CUT = 5;                                           // the wall's north-east corner is cut back 5 m for the point

// the buildings (footprints [x0, z0, x1, z1]); heights above the slab
export const CELLS = { r: [236, -374, 276, -358], h: 13.2, s: .2 };           // the cell block: four tiers of cells, IRON ISLAND on the roof
export const INTAKE = { r: [233, -352, 250, -326], h: 7.6, s: .2 };           // intake + control: the door into the yard at the sim's place
export const VISIT = { r: [234, -312, 250, -299], h: 7.2 };                   // the visitors' entrance with the bail window, its face on the forecourt
export const GATEHOUSE = { r: [271, -310, 278, -301], h: 5.6 };               // the sally port's gatehouse; the gate is x 262 … 270 in the south wall
export const SALLY = { x0: 262, x1: 270 };
export const YARD = { r: [256.5, -351.6, 281.5, -320.4] };                        // the yard: fenced on the west and the north, the outer wall east and south
export const COURT = { r: [264, -350, 279, -322] };                           // a full court, north–south
export const FORE = { r: [226, -299, 262, -292] };                            // the forecourt between the visitors' entrance and the sidewalk
export const APRON = { r: [258, -304, 282, -292] };                           // the bus apron in front of the sally port

// the shore: riprap round the west, north and east edges; the south edge is the quay (a seawall under the island road)
export const SHORE = { out: 2.8, in: 2.2 };
