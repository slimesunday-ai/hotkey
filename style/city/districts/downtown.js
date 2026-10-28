// GLASSWALL (downtown) · the district kit (pass 2). Built by batch 1 (section 1: x −96…96, z −96…32, 24 blocks); owned by the
// systems agent until a downtown section agent takes it. This is today's generator as a kit: the standard grammar (grammar.js BASE,
// bit-identical to pass 1d), the neutral mix, the sign voice, the six hero slots, the dealing corners, a subway and a bus stop.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
// batch 5 · the downtown fringe (the downtown fringe agent): the 52 blocks round section 1, one grammar with four characters (north lofts
// and garages toward the Yards, west tenements toward Sunny Acres, south brownstones toward Pleasantview, east medical round St. Mercy).
// Every rule asks which block it builds: section 1 gets BASE exactly and builds byte-identical (districts/downtown/fringe.js).
import { FRINGE, fringeGrammar, fringeWalls, installFringe } from './downtown/fringe.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
// SPREAD · the kit's hand marks are today's metres (districts/frame.js): a bus stop keeps to its kerb (stopAt), a station marks its lot
// and a safehouse through remap (in a block: its shift), a camera on what it frames (camera: Fit Street's, the section's middle; a
// street view or a corner stands on its own place)
const rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

const SECTION1 = []; for (let i = -3; i <= 2; i++) for (let j = -3; j <= 0; j++) SECTION1.push([i, j]);

export default installFringe(defineKit({
  district: 'downtown', name: 'Glasswall', owner: 'systems agent (batch 2) · heroes and blocks: the section-1 location agents (LOCATIONS.md) · the fringe: the downtown fringe agent (batch 5)', status: 'built',
  role: 'The money district. Street demand 4.5 day and night (rules DEMAND), the Locals hold it at the season start; three of the twelve dealing corners (Kent & 1st, Jay & 1st, Kent & Washington) plus Jay & Washington on its south edge; Precinct 9 (the badge, the patrol cars), the Hall of Justice, Glasswall Plaza, the 24/7 Store and Fit Street (the morning DROP). Round it the fringe: the walk-up apartments (the home ladder\'s second rung) over the ring\'s shops.',
  built: [...SECTION1, ...FRINGE],        // section 1 (24 blocks) + the fringe (52): every downtown block at full detail
  grammar: fringeGrammar(),               // BASE for section 1, the ring's four characters for the fringe (districts/downtown/fringe.js)
  palette: { ...PALETTE, walls: fringeWalls(PALETTE.walls), neutral: { ...PALETTE.neutral, share: .36 } },   // (fringeWalls: section 1 reads PALETTE.walls itself)
  lexicon: LEXICON,
  heroes: [
    { id: 'fitstreet', block: [-3, 0], module: 'heroes/fitstreet.js', fn: 'fitStreet', place: 'fitstreet' },
    { id: 'hall-of-justice', block: [0, -2], module: 'heroes/hall-of-justice.js', fn: 'hallOfJustice', place: 'court' },
    { id: 'precinct', block: [1, -1], module: 'heroes/precinct.js', fn: 'precinct', place: 'police' },
    { id: 'plaza', block: [0, -1], module: 'heroes/plaza.js', fn: 'plaza', place: 'plaza' },
    { id: 'bank', block: [-1, -1], module: 'heroes/bank.js', fn: 'bankBlock' },
    { id: 'store', block: [2, -3], module: 'heroes/store.js', fn: 'store', place: 'store' },
    // the fringe (batch 5): one hand-made piece per block, the rest of the block generated round it (districts/downtown/fill.js)
    { id: 'fringe-church', block: [1, 1], module: 'heroes/downtown-fringe-church.js', fn: 'church' },   // Our Lady of Lost Causes and its soup line
    { id: 'fringe-garage', block: [2, -4], module: 'heroes/downtown-fringe-garage.js', fn: 'garage' },   // SKYLOT, the garage with the rooftop hangout
    { id: 'fringe-carwash', block: [-4, 0], module: 'heroes/downtown-fringe-carwash.js', fn: 'carWash' },   // SOAPBOX, the car wash across from Fit Street
    { id: 'fringe-signs', block: [3, -2], module: 'heroes/downtown-fringe-signs.js', fn: 'signPainter' },   // CARUSO SIGN CO., the sign painter, across from the ER
    { id: 'fringe-gym', block: [-2, -4], module: 'heroes/downtown-fringe-gym.js', fn: 'boxingGym' },   // KID GLOVES BOXING and its loading dock, facing the Yards
    { id: 'fringe-coop', block: [-5, -1], module: 'heroes/downtown-fringe-coop.js', fn: 'pigeonCoop' },   // the pigeon coop on a tenement roof over Sunny Acres
    { id: 'fringe-cards', block: [0, 2], module: 'heroes/downtown-fringe-cards.js', fn: 'cardShop' },   // PULL RATE cards & comics and its release-day line
  ],
  hooks: { corners: 'heroes/corners.js' },
  // transit (pass 2 demo): two station houses on mid-row lots and a bus shelter on Central Ave. The engine turns the lot under a
  // station into the kiosk and keeps the shelter's strip of curb clear before anything else is placed (engine.js transitFor).
  transit: [
    { id: 'subway-1st-kent', kind: 'subway', name: '1ST ST', lines: 'T', ...rm(51.5, -39.5), face: '+z' },          // 1st St between Kent and Linden (block 1,−2)
    { id: 'subway-washington', kind: 'subway', name: 'WASHINGTON', lines: 'T N', ...rm(44.5, 24.5), face: '+z' },      // Washington St by Kent (block 1,0)
    stopAt({ id: 'bus-central-ivy', kind: 'bus', name: 'CENTRAL AVE', x: -50.1, z: -4.4, rot: 0 }),   // 0.1 m off the curb edge, in the gap between the L2 and L6 frontages (the only stretch of this curb with no stand or canopy over it)
    // the fringe (batch 5): the A C comes up on Market Ave where the Yards' and the docks' shift walks up from the lofts; route 22 (Pleasantview's)
    // stops on Jackson St at the south edge, where the walk-up apartments face the houses
    { id: 'subway-market-kent', kind: 'subway', name: 'MARKET AV', lines: 'T', ...rm(47.5, -120.5), face: '-z' },   // Market Ave between Kent and Linden (block 1,−4)
    stopAt({ id: 'bus-jackson-kent', kind: 'bus', name: 'JACKSON ST', x: 48.0, z: 93.6, rot: 0 }),               // Jackson St between Kent and Linden (block 1,2) (no route this pass: NO SVC)
    // MOVEMENT W3b: the NEON line's two downtown stations on Central Ave (transitnet.js), each on a lot with no registry apartments and no sim lot
    { id: 'subway-fit-street', kind: 'subway', name: 'FIT ST', lines: 'N', ...rm(-79.5, -7.5), face: '+z' },        // across Central Ave from Fit Street (block −3,−1, L7: a 3-storey brownstone)
    { id: 'subway-st-mercy', kind: 'subway', name: 'ST MERCY', lines: 'N', ...rm(109.5, -7.5), face: '+z' },        // Central Ave by Bishop Ave, the hospital side (block 3,−1, L5: a one-storey shop)
  ],
  safehouses: [{ id: 'safe-ivy-walkup', name: 'the Ivy St walk-up', ...rm(-56.0, -22.0), note: 'reserved: lock-in walk from Jay & 1st' },
    { id: 'safe-elm-coop', name: 'the pigeon coop on Elm St', ...rm(-148.2, -21.4), note: 'reserved: the loft on the six-storey roof at Elm & 1st, over Sunny Acres; the pigeon man does not ask' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [18, 152, 92], tgt: [0, 0, -33], fov: 44, sh: [0, -32, 112] }, shiftOf(0, -1)),
    street: [camera({ name: 'central-ave', pos: [-40, 2.9, -1.2], tgt: [0, 4.2, -1.2], fov: 54, sh: [-20, -2, 40] }, shiftOf(-1, -1), 'place'),
      camera({ name: 'kent-1st-corner', pos: [34.6, 2.6, -35.2], tgt: [28.5, 1.9, -28.6], fov: 50, sh: [30, -30, 16] }, shiftOf(0, -1), 'place')],
    landmark: camera({ name: 'drop', pos: [-72.3, 1.55, 1.7], tgt: [-81.5, 1.45, 5.3], fov: 46, sh: [-80, 5, 12] }, shiftOf(-3, 0)),
    night: camera({ name: 'fitstreet-night', pos: [-59.6, 3.5, -5.3], tgt: [-80, 7.6, 6.6], fov: 57, sh: [-76, 6, 30] }, shiftOf(-3, 0)),
  },
}));
