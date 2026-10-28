// MILLENNIUM MALL · the plan (pure data). The compound (−8…−6, 0…2; x −256…−160, z 0…96, interior x −252…−164, z 6…92) is a dead
// 1999 mall: the building runs east–west across the middle row (z 34…62) in three parts, one per block — HOLLOWAY'S, the closed west
// anchor (−8,1); the concourse with the collapsed atrium where the scavengers dig (−7,1: the sim's site at −208,49); the food-court wing,
// half roofless (−6,1). The north lot faces Central Ave with the pylon at Elm St; the back lot has the loading docks, the dumpsters,
// the rubble of the demolished east anchor and the trees taking the asphalt back.
import { COMPOUNDS, compoundInterior, shiftOf, P0, P as PITCH, X, Z, rwX, rwZ } from '../../../../world/city.js';

// SPREAD · THE FRAME (../frame.js): every metre of this kit is today's, the compound's frame (anchored at its centre: world/city.js
// shiftOf); IN is the interior in it, LOT the four streets' lot lines (IN itself at SPREAD 0; a spread opens a margin between them)
const A = COMPOUNDS.find(c => c.k === 'A'), [SX, SZ] = shiftOf(A.i0, A.j0);
export const IN = (R => ({ x0: R.x0 - SX, z0: R.z0 - SZ, x1: R.x1 - SX, z1: R.z1 - SZ }))(compoundInterior(A));   // x −252…−164, z 6…92
export const LOT = { x0: X(A.i0) + rwX(A.i0) - SX, z0: Z(A.j0) + rwZ(A.j0) - SZ, x1: X(A.i1 + 1) - rwX(A.i1 + 1) - SX, z1: Z(A.j1 + 1) - rwZ(A.j1 + 1) - SZ };
// the margin's ground, as frame rects: the lot's asphalt where the lot is open to the street (the two Central Ave driveways, the open
// ends of Birch St and Elm St, the fence gaps on Elm St and Jackson St), a weedy verge outside the kerb and the fences (none at SPREAD 0)
const cut = (a, b, open) => { const out = []; let p = a; for (const [g0, g1] of open) { out.push([p, g0, 'verge'], [g0, g1, 'asph']); p = g1; } out.push([p, b, 'verge']); return out; };
export const MARGIN = [
  ...cut(LOT.x0, LOT.x1, [[-238, -232], [-199, -193]]).map(([a, b, k]) => ({ k, r: [a, LOT.z0, b, IN.z0] })),                       // Central Ave
  ...cut(LOT.x0, LOT.x1, [[-211, -203]]).map(([a, b, k]) => ({ k, r: [a, IN.z1, b, LOT.z1] })),                                      // Jackson St
  ...cut(IN.z0, IN.z1, [[IN.z0, 30]]).map(([a, b, k]) => ({ k, r: [LOT.x0, a, IN.x0, b] })),                                         // Birch St
  ...cut(IN.z0, IN.z1, [[IN.z0, 28], [64.5, 70.5]]).map(([a, b, k]) => ({ k, r: [IN.x1, a, LOT.x1, b] })),                          // Elm St
].filter(m => m.r[2] - m.r[0] > 1e-6 && m.r[3] - m.r[1] > 1e-6);
export const SITE = { x: -208, z: 49 };                                   // piles at x ± 2.7, a spill at (+4.6, +2.2): keep ~6.5 m clear
export const DIG = [-213.2, 45.6, -200.6, 54.0];                          // the dig's clear ground (the piles and the spill)
export const BLD = { z0: 34, z1: 62 };                                     // the building's north and south walls
export const PART = {
  anchor: { x0: -248, x1: -224, h: 9.4 },                                  // HOLLOWAY'S (closed): ghost letters, a vinyl banner
  concourse: { x0: -224, x1: -192, h: 7.2, hole: [-216, 42, -200, 56.4], corridor: [-212, 34, -204, 42] },   // the atrium open to the sky
  wing: { x0: -192, x1: -170, h: 6.2, open: [-188, 44, -170, 62] },        // the food court: its roof came down over the south-east half
};
export const PYLON = { x: -171.5, z: 11 };
export const P = PITCH;
export const blockRange = (i, j) => [i * P0, j * P0, i * P0 + P0, j * P0 + P0];   // (SPREAD: a block's own part is its frame cell)
