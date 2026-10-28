// ROUTE 9 + MOTEL 9 (highway) · the district kit (batch 4). Owner: the St. Mercy / Route 9 agent.
// The highway edge of town: Route 9 runs north along x = 224 to the Long Bridge and Iron Island, and these two blocks on its east side
// are the last lit lots before it — cheap, sketchy, roadside. Street demand 1.5 by day, 4.5 at night (rules DEMAND); the dealing
// corner is Route 9 & Oak St (224, 160). Two heroes, one per block (districts/highway/build.js):
//   (7,4) LAST CHANCE: the gas canopy (LAST GAS BEFORE BRIDGE on the side the northbound traffic sees), the pump island, the food mart
//         with its window posters (WE CASH PAYCHECKS) and a billboard from the city's pool on its roof turned to the highway, the price
//         pylon, the payphone, the air machine — and a semi parked on the shoulder with its back doors open on shoe boxes that fell off it
//   (7,5) MOTEL 9 (sim place motel, 240,176: a bed for 5 a night): a pink two-storey wing of twelve rooms on a walkway, the googie
//         office, the pole sign with the big neon 9 (MOTEL in pink script, VACANCY in green, 5 A NITE), the pool behind its fence, the ice
//         machine — and room 9 upstairs, door open, LOANS on a card in the window: the loan shark in his lawn chair, his card table, the
//         man by the door, his black car with the gold rims parked under the walkway
// Generic walkers only; the shared signage system paints the walls (a mural on Oak St, ads on Union Ave, Pine St and Pike Rd).
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
// SPREAD · the kit's marks are today's metres (districts/frame.js): the stop keeps to Route 9's kerb, the safehouse through remap, the
// cameras frame Motel 9's block (its shift M) from where they stood
const M = shiftOf(7, 5), rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

export default defineKit({
  district: 'highway', name: 'Route 9', owner: 'the St. Mercy / Route 9 agent (batch 4)', status: 'built',
  role: 'The highway edge of town: Motel 9 at (240, 176) — a bed for 5 a night, and the LOAN SHARK works out of it — the LAST CHANCE gas station and food mart, and the dealing corner at Route 9 & Oak St (224, 160). Street demand 1.5 by day, 4.5 at night.',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .34 } },   // (custom blocks: the mart bone white; the canopy, the motel and its office in colour)
  lexicon: LEXICON,
  heroes: [
    { id: 'last-chance', block: [7, 4], module: 'heroes/highway-gas.js', fn: 'gasStation' },
    { id: 'motel-9', block: [7, 5], module: 'heroes/highway-motel.js', fn: 'motel9', place: 'motel' },
  ],
  hooks: {},
  // the Route 9 bus stops at the motel's curb (the sim's buses will run the highway); the loan shark's spare room is the safehouse
  transit: [stopAt({ id: 'bus-route-9-motel', kind: 'bus', name: 'ROUTE 9', x: 231.5, z: 168.0, rot: 3 }),
    // (SUBWAY PLAN 2026-10-09) ROUTE 9, the UNION's east end: open stairs on Motel 9's Route 9 frontage at the court's mouth, the flight east
    // into the court (the spec's z 190 put it in the office — its RING BELL window; the analyst's fallback z 202, 1 m north so the pool's fence
    // stands clear of it: z 201, today's 234.5, 179 through remap)
    { id: 'subway-motel', kind: 'subway', name: 'ROUTE 9', lines: 'U', ...rm(234.5, 179), face: '-x', entry: 'stairs' }],   // (by the office: clear of the street camera's line to OFFICE)
  safehouses: [{ id: 'safe-motel-12', name: 'room 12, Motel 9', ...rm(248.5, 186.0), note: 'the last room upstairs: cash by the night, no questions, the bathroom window opens onto Pike Rd' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [213, 56, 196], tgt: [243, 0, 162], fov: 44, sh: [242, 162, 52] }, M),
    street: [camera({ name: 'route-9', pos: [223.0, 2.9, 208.0], tgt: [230.5, 4.2, 182.0], fov: 54, sh: [232, 176, 40] }, M),   // up the highway from the south: the pool, the sign, the motel, the gas station beyond
      camera({ name: 'motel-court', pos: [231.8, 4.35, 190.0], tgt: [242.0, 4.0, 173.0], fov: 56, sh: [238, 178, 26] }, M)],   // from the Route 9 & Pine corner over the pool into the court (eye as rendered: MapControls raises an eye below its target)
    landmark: camera({ name: 'room-9', pos: [237.0, 4.0, 172.4], tgt: [244.6, 3.8, 173.8], fov: 56, sh: [242, 174, 16] }, M),   // room 9 head-on from the court: LOANS, the shark, the man at the door
    night: camera({ name: 'route-9-night', pos: [215.5, 2.6, 186.0], tgt: [236.0, 6.2, 173.5], fov: 56, sh: [234, 176, 34] }, M),
  },
});
