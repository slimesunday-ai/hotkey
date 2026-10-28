// MILLENNIUM MALL (mall) · the district kit (batch 3). Owner: the Sunny Acres / Millennium Mall section agent.
// A dead 1999 mall and one of the sim's dig sites (salts, cloth: the piles at −208,49 rise and fall with the bank). The compound
// (−8…−6, 0…2; x −256…−160, z 0…96) is built by this kit and three heroes:
//   the north lot (row 0): faded stalls, the planter spine with its palms (half of them dead), dead light poles, corrals and carts,
//     the burnt cars; the pylon at Elm St is a hero (heroes/mall-pylon.js)
//   the building (row 1): HOLLOWAY'S, the closed west anchor with its ghost letters (this kit); the concourse whose atrium roof came
//     down — the dig (heroes/mall-atrium.js); the food-court wing, half roofless (heroes/mall-foodcourt.js)
//   the back lot (row 2): loading docks, dumpsters, a scavenger's camp, trees coming up through the asphalt, and the rubble field where
//     the east anchor was demolished, fenced in orange with its CONDEMNED notice
// No people: walkers come from peds.js; the sim-state layer draws the piles on the site.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { SIDE, CV } from '../style.js';
import { PART, BLD, IN, blockRange } from './mall/plan.js';
import { lot, spine, lotLife, anchor, backLot, rubbleField, rubbleFence, fenceRun, farMall, crackWeeds, camp, dumping, framed } from './mall/build.js';
import { board } from './trailer/brush.js';
import * as MP from './mall/props.js';
import { carOnBlocks, dumpster } from '../props.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera, kerbX, kerbZ } from './frame.js';
// SPREAD · the kit's marks are today's metres (districts/frame.js): MALL GATE keeps to the Central Ave kerb and moves with the compound;
// the SUNNY ACRES stairs, the safehouse and the dig site through remap (inside the compound: its shift); the cameras frame the compound (A):
// the Elm St rubble from the compound's own frame, the pylon at night from its corner
const A = shiftOf(-8, 0), rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

// the lot's edges: the Central Ave kerb with its two driveways, chain link down Birch St, Elm St and Jackson St (DANGER on the west)
export function edges(ctx) {
  ctx = framed(ctx); ctx.group('edge');
  fenceRun(ctx, 'z', IN.x0 + .02, 30, IN.z1 - .1);
  fenceRun(ctx, 'z', IN.x1 - .12, 28, IN.z1 - .1, { gaps: [[64.5, 70.5]] });
  fenceRun(ctx, 'x', IN.z1 - .12, IN.x0 + .12, IN.x1 - .12, { gaps: [[-211, -203]] });
  if (ctx.i === -8 && ctx.j === 1) ctx.put(board('DANGER/DO NOT ENTER', { kind: 'sign', posts: 0, bg: 0xe8232a, fg: 0xf7f7f2, pad: 3, clean: true }), IN.x0 + .12, 48, { rot: 1, y: SIDE + .5, reach: 0 });
  // the kerb along Central Ave (0.2 m, painted yellow at the driveways' ends), open at the two driveways
  if (ctx.j === 0) { const [bx0, , bx1] = blockRange(ctx.i, ctx.j), x0 = Math.max(bx0, IN.x0), x1 = Math.min(bx1, IN.x1);   // (SPREAD: the block's frame cell)
    for (const [a, b] of [[x0, x1]].flatMap(([a, b]) => { let s = [[a, b]]; for (const [g0, g1] of [[-238, -232], [-199, -193]]) s = s.flatMap(([p, q]) => g1 <= p || g0 >= q ? [[p, q]] : [[p, g0], [g1, q]].filter(([u, v]) => v - u > .3)); return s; })) {
      const V = ctx.volume(a, SIDE + CV, IN.z0, b, SIDE + .3, IN.z0 + .4, { keep: 'kerb', ground: false }); V.box(0, 0, 0, V.nx, 2, V.nz, (x) => (x < 6 || x >= V.nx - 6) ? 0xffc21a : 0xd9d5cc); } }
}

export default defineKit({
  district: 'mall', name: 'Millennium Mall', owner: 'the Sunny Acres / Millennium Mall agent (batch 3)', status: 'built',
  role: 'Dead mall ruins and a dig site: salts and cloth (sim place mall, −208,49; the piles rise and fall with the bank). Scavengers dig in the collapsed atrium.',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .5 } },
  lexicon: { ...LEXICON, shops: [['PRETZEL KING', 0xffc21a], ['TERIYAKI TOWN', 0xe8232a], ['GYRO HERO', 0x2f5bff], ['TACO LOCO', 0x14a83b]] },
  heroes: [
    { id: 'atrium', block: [-7, 1], module: 'heroes/mall-atrium.js', fn: 'mallAtrium', place: 'mall' },
    { id: 'pylon', block: [-6, 0], module: 'heroes/mall-pylon.js', fn: 'mallPylon' },
    { id: 'food-court', block: [-6, 1], module: 'heroes/mall-foodcourt.js', fn: 'foodCourt' },
  ],
  build(ctx) {
    ctx = framed(ctx); const { i, j } = ctx;   // (SPREAD: frame metres, mall/build.js framed)
    if (j === 0) { lot(ctx); ctx.finish(); spine(ctx); edges(ctx); ctx.finish();
      lotLife(ctx, i === -8 ? { cars: [[-241, 20.5, 1, 'burnt'], [-229.4, 9.8, 0, 'car']], carts: [[-246, 16, 1], [-233.5, 26.4, 2], [-227, 15.2, 0]], corral: [-240, 26.2, 1] }
        : { cars: [[-217.5, 26.4, 2, 'blocks'], [-200.5, 9.5, 0, 'burnt']], carts: [[-214, 16.4, 3], [-205.5, 19.6, 1], [-196.5, 13.8, 2]], corral: [-221, 9.8, 1] });
      if (i === -8) { camp(ctx); ctx.group('lot'); ctx.put(carOnBlocks(4), -232.6, 12.6, { rot: 1, slide: [1, 0], reach: 1 }); }   // (a stripped car: wheels gone, hood up)
      if (i === -7) dumping(ctx);
      crackWeeds(ctx); }
    else if (j === 1 && i === -8) { lot(ctx, [[PART.anchor.x0 - .4, BLD.z0 - .4, PART.anchor.x1, BLD.z1 + .4]]); ctx.finish(); edges(ctx); ctx.group('anchor'); anchor(ctx); ctx.finish();
      ctx.group('anchor'); for (const [x, z, r] of [[-250, 38, 0], [-250.2, 55, 2]]) ctx.put(MP.cart(r === 2), x, z, { rot: r, slide: [0, 1], reach: 1.5 });
      ctx.put(MP.planter(1), -236, 32.9, { rot: 0, slide: [1, 0], reach: 2 }); ctx.put(MP.planter(2), -230, 32.9, { rot: 0, slide: [1, 0], reach: 2 });
      ctx.put(dumpster(0x6d707a), -250.6, 44, { rot: 1, slide: [0, 1], reach: 1 }); ctx.put(MP.mattress(0xff9ad0), -250.4, 59.4, { rot: 1, slide: [0, 1], reach: 1 }); crackWeeds(ctx); }
    else if (j === 2) { const wall = [[-186, 67, -176, 67.6]]; lot(ctx, i === -6 ? wall : []); ctx.finish(); edges(ctx); if (i === -6) rubbleFence(ctx); ctx.finish(); if (i === -6) rubbleField(ctx); backLot(ctx); crackWeeds(ctx); }
  },
  far(ctx) { farMall(ctx); },
  hooks: { sites: { mall: { ...rm(-208, 49), r: 6.5 } } },
  transit: [stopAt({ id: 'bus-mall-gate', kind: 'bus', name: 'MALL GATE', x: -214.5, z: 4.4, rot: 2 }),
    { id: 'subway-sunny-acres', kind: 'subway', name: 'SUNNY ACRES', lines: 'N H', ...rm(-188, 7.5), face: '-z', entry: 'stairs' },
    // (SUBWAY PLAN 2026-10-09) the HARBOR's west end: open stairs on the north lot's Birch St frontage, the flight east into the lot (the
    // spec's (−278.5, 32.4) at +4: kerbX / kerbZ of today's −248.5, 29.4 — the slot is on Birch St's sidewalk, 0.5 m off the lot line)
    { id: 'subway-blackpine', kind: 'subway', name: 'BLACKPINE', lines: 'H', x: kerbX(-248.5), z: kerbZ(29.4), face: '-x', entry: 'stairs' }],   // (W3b) the NEON's west end on Central Ave, across from the trailer park; (subway stations, 10-08) an open stair entrance on the lot frontage, inside one parking stall (x −186.5 → −188: the stall's middle)
  safehouses: [{ id: 'safe-mall-cinema', name: 'the projection booth over the dead food court', ...rm(-180, 40), note: 'reserved: the wing roof still holds there; a ladder from the atrium' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [-159, 110, 106], tgt: [-209, 0, 47], fov: 44, sh: [-208, 48, 70] }, A),
    street: [camera({ name: 'central-ave-mall', pos: [-155.8, 2.9, 2.1], tgt: [-181.5, 4.4, 7.4], fov: 54, sh: [-185, 12, 40] }, A),
      camera({ name: 'elm-st-rubble', pos: [-159.8, 2.9, 91.2], tgt: [-165.6, 4.0, 66], fov: 54, sh: [-172, 70, 36] }, A, 'frame')],
    landmark: camera({ name: 'the-dig', pos: [-205.2, 1.6, 36.4], tgt: [-208.6, 2.3, 49.2], fov: 46, sh: [-208, 46, 22] }, A),
    night: camera({ name: 'pylon-night', pos: [-152, 3.2, -1.5], tgt: [-173, 6.8, 12], fov: 56, sh: [-178, 16, 36] }, A, 'place'),
  },
});
