// ST. MERCY (hospital) · the district kit (batch 4). Owner: the St. Mercy / Route 9 agent.
// Where the hurt go: a 15cr bill and six hours (sim place hospital, 161,−33), so robbery and fight victims arrive all day and all night.
// A walled campus of four blocks (4…5, −2…−1; x 128…192, z −64…0) on Bishop Ave, Central Ave, 2nd St and Orchard St, built as one
// compound (districts/hospital/build.js) and four heroes, one per block. The tower stands on the sim's place, where the four blocks
// meet: two storeys of podium, six of ribbon glass, a red crown with ST. MERCY on it, a neon cross over Central Ave, and the helipad with
// the air ambulance on the roof — THE hospital from the overview. Around it: the ER bay (the cobalt wing, the EMERGENCY canopy, the
// ambulances, the patrol car that came with the stabbing, WAIT 6 HRS in amber LEDs over the doors, a red cross on its roof), the oxygen
// yard, the garage with a colour for every level, the 1889 wing (pathology and the morgue, a hearse at its steel doors), the loading
// dock, the garden on Bishop Ave with the saint who wears a traffic cone, the forecourt (the smokers under the NO SMOKING plate, a
// wheelchair and an IV pole among them, the vending machines, the flower cart), the glass lobby, and the Medical Arts building (MERCY
// RX and its green cross, GET WELL, the injury doctor upstairs, a billboard from the city's pool on its roof). Generic walkers only.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
// SPREAD · the kit's marks are today's metres (districts/frame.js): the stops keep to the Central Ave kerb and move with the compound, so
// they stay at the main entrance; the safehouse through remap; the cameras frame the compound (its shift H) from where they stood
const H = shiftOf(4, -2), rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

export default defineKit({
  district: 'hospital', name: 'St. Mercy', owner: 'the St. Mercy / Route 9 agent (batch 4)', status: 'built',
  role: 'Where the hurt go: the sim\'s hospital at (161, −33), a bill of 15 and six hours. Robbery and fight victims end up here, so ambulances come and go all day and all night. No street market of its own (the walkers use CROWD: 2 by day, 1.5 at night).',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .36 } },   // (the campus is custom: tower white, the 1889 wing brick, the rest in colour)
  lexicon: LEXICON,
  heroes: [
    { id: 'er-bay', block: [4, -2], module: 'heroes/hospital-er.js', fn: 'erBay' },
    { id: 'garage', block: [5, -2], module: 'heroes/hospital-garage.js', fn: 'garage', place: 'hospital' },
    { id: 'smokers', block: [4, -1], module: 'heroes/hospital-smokers.js', fn: 'smokers' },
    { id: 'main-entrance', block: [5, -1], module: 'heroes/hospital-entrance.js', fn: 'entrance' },
  ],
  hooks: {},
  // the stops are at the door: a bus shelter and a cab stand on Central Ave in front of the main entrance
  transit: [
    stopAt({ id: 'bus-st-mercy', kind: 'bus', name: 'ST MERCY', x: 156.8, z: -4.4, rot: 0 }),
    stopAt({ id: 'taxi-st-mercy', kind: 'taxi', name: 'ST MERCY', x: 166.6, z: -4.3, rot: 0 }),
  ],
  safehouses: [{ id: 'safe-mercy-morgue', name: 'the morgue door', ...rm(170.6, -52.2), note: 'the steel doors of the 1889 wing on the service lane; the night man leaves them on the latch' }],
  peds: { density: 1.1 },
  cameras: {
    overhead: camera({ pos: [161, 100, 32], tgt: [161, 0, -33], fov: 44, sh: [161, -33, 70] }, H),
    street: [{ name: 'central-ave', rule: 'street', block: [4, -1], side: '+z' }, { name: 'bishop-ave', rule: 'street', block: [4, -2], side: '-x' }],
    landmark: camera({ name: 'er-bay', pos: [123.0, 3.9, -42.2], tgt: [137.6, 2.8, -45.4], fov: 54, sh: [136, -45, 24] }, H),   // across Bishop Ave: EMERGENCY head-on over the bay
    night: camera({ name: 'central-ave-night', pos: [153.0, 2.6, 2.2], tgt: [160.5, 13.0, -24.0], fov: 58, sh: [158, -14, 36] }, H),   // from Central Ave: the lobby's glow, the canopy, the neon cross, the crown
  },
});
