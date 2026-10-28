// IRON ISLAND + THE LONG BRIDGE (jail) · the district kit (batch 5) · owner: the water-side agent.
// The jail sits alone in the bay on Iron Island (the compound K, x 224…288, z −384…−290), reached by the Long Bridge: Route 9 over the
// water from the mainland (z −256) to the island road (z −288), a green steel vertical-lift bridge, 34 m long whatever the city calls it.
// The kit builds the island's six blocks and ADOPTS the three sea blocks the bridge and the quay cross (6…8, −9); the rest of the bay is
// the sea kit's. Sim role: the jail (240 min + 30 per unit carried, max 16 h, bail 25); the sim's jail at (256, −338) is the yard's gate,
// where the jailed wait. Heroes (lazy, far: 'kit'):
//   (7,−10) the visitors' entrance with the BAIL window, the queue and the bus stop on the island road
//   (8,−10) the sally port: its gatehouse and orange gates, the prison bus on the apron
//   (8,−11) the yard: a full court, the weight pen, the bleachers, the mural on the wall (INSIDE), the jailed waiting at the gate
//   (8,−12) IRON POINT: the lighthouse on the north-east point, red and white, its lantern lit at night
//   (7,−9)  the Long Bridge's island end: the checkpoint booth, the city-end bus stop, a man fishing off the span
// Everything else (the wall and its wire, three guard towers with a guard in each, the cell block with IRON ISLAND on its roof, intake
// and control, the riprap and its surf, the gulls) is drawn by districts/jail/build.js for every block. No walkers on the island (the
// kit's peds density is 0): hand-placed guards and inmates only. The bridge's sidewalks are sea blocks, where the core has no walkers.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { shiftOf } from '../../../world/city.js';
import { stopAt, camera } from './frame.js';
// SPREAD · the kit's marks are today's metres (districts/frame.js): IRON ISLAND keeps to the island road's walk and moves with the island
// (the compound K), LONG BRIDGE to Route 9's kerb on the bridge; the cameras frame the island (K) or the bridge (its sea block, B9)
const K = shiftOf(7, -12), B9 = shiftOf(7, -9);
// The builders (districts/jail/build.js and the core they pull in: engine.js, gen.js, pedsim.js, transit.js …) load only where blocks
// are built — the build workers, shot and audit pages, node tools. The live page's main thread needs only this kit's data (blocks,
// cameras, transit), so ~250 KB of modules (with the sea kit's) stay off the first view's path. The path sits in an import-shaped string
// so the workers' bundler rewrites it to its Blob URL (the signage/art.js pattern; PASS-water.md asks for a core way to do this).
const AT = ` import './jail/build.js'`.split("'")[1];
const LIVE_MAIN = typeof document !== 'undefined' && typeof WorkerGlobalScope === 'undefined' && !new URLSearchParams(globalThis.location?.search || '').has('shot');
const B = LIVE_MAIN ? null : await import(AT.startsWith('.') ? new URL(AT, import.meta.url).href : AT);

export default defineKit({
  district: 'jail', name: 'Iron Island', owner: 'the water-side agent (batch 5)', status: 'built',
  role: 'The jail on Iron Island, alone in the bay (sim: 240 min + 30 per unit carried, max 16 h; bail 25 halves the time). The jailed wait in the yard; the sim\'s jail (256, −338) is the yard\'s gate, across the corridor from intake. The only way on or off is the Long Bridge, Route 9 over the bay, with the checkpoint at the island end. Released agents walk out through the visitors\' entrance to the bus stop.',
  built: [[7, -12], [8, -12], [7, -11], [8, -11], [7, -10], [8, -10], [6, -9], [7, -9], [8, -9]],
  adopt: [[6, -9], [7, -9], [8, -9]],
  grammar: { ...BASE, life: [0, 0], walkway: 0 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .4 } },   // (custom: the compound is bone and grey concrete; the visitors' entrance, the trims, the court, the bridge carry the colour)
  lexicon: LEXICON,
  heroes: [
    { id: 'visitors', block: [7, -10], module: 'heroes/jail-visitors.js', fn: 'visitors', far: 'kit' },
    { id: 'sally-port', block: [8, -10], module: 'heroes/jail-sallyport.js', fn: 'sallyPort', far: 'kit' },
    { id: 'yard', block: [8, -11], module: 'heroes/jail-yard.js', fn: 'yard', far: 'kit', place: 'jail' },
    { id: 'iron-point', block: [8, -12], module: 'heroes/jail-lighthouse.js', fn: 'lighthouse', far: 'kit' },
    { id: 'long-bridge', block: [7, -9], module: 'heroes/jail-bridge.js', fn: 'longBridge', far: 'kit' },
  ],
  build(ctx) { B.buildJail(ctx); },
  far(ctx) { B.jailFar(ctx); },
  hooks: {},
  // the bus: IRON ISLAND at the visitors' entrance on the island road, LONG BRIDGE at the bridge's city end (the island-bound curb)
  transit: [
    stopAt({ id: 'bus-iron-island', kind: 'bus', name: 'IRON ISLAND', x: 243.2, z: -291.4, rot: 0 }),
    stopAt({ id: 'bus-long-bridge', kind: 'bus', name: 'LONG BRIDGE', x: 231.5, z: -260.2, rot: 3 }),
  ],
  safehouses: [],
  peds: { density: 0 },
  cameras: {
    overhead: camera({ pos: [322, 104, -236], tgt: [256, 0, -330], fov: 44, sh: [256, -322, 90] }, K),
    street: [camera({ name: 'island-road', pos: [225.6, 3.2, -288.2], tgt: [252, 3.4, -296.4], fov: 52, sh: [246, -295, 30] }, K),   // from the T: the visitors' entrance, the queue at BAIL, the bus stop, the sally port
      camera({ name: 'long-bridge', pos: [226.2, 2.9, -232], tgt: [224.2, 8.4, -264], fov: 56, sh: [224, -262, 40] }, B9)],           // Route 9 north from the city end: THE LONG BRIDGE
    landmark: camera({ name: 'the-yard', pos: [262.8, 1.6, -322.2], tgt: [276, 3.0, -339], fov: 50, sh: [270, -334, 22] }, K),      // the court, the mural INSIDE, the cell block
    night: camera({ name: 'bridge-night', pos: [219.5, 2.8, -236], tgt: [226, 9, -275], fov: 56, sh: [226, -262, 40] }, B9),
  },
});
