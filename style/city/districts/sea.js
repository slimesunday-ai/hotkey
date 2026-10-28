// THE BAY (sea) · the district kit (batch 5) · owner: the water-side agent.
// The water north of the docks and round Iron Island. The water itself is the ground's flat toon SEA (ground.js, 0x2f86d8: kept as it is);
// this kit builds ONLY the few sea blocks where something is to be seen, so open water costs no far tier and no build job:
//   (4,−11) the docks' channel buoys (C1-7d: SECOND CHANCE is live, second-chance.js)   (5,−10) MISS DEMEANOR pushing SCOW 9 toward the docks
//   (5,−9)  the breakwater off the Yards, its green and red lights           (6,−11) HARBOR UNIT 9, the police launch, down the island's side
//   (6,−12) the wreck off the north-west rocks, gulls on it (hero)           (9,−11) LITTLE ANGIE hauling pots off the island's east side
// Buoys: the docks' channel (a red nun, a green can, a lit channel buoy) and the island's keep-off buoys. Foam where the water breaks: the
// wakes, the breakwater, the wreck (the island's riprap and the bridge's piers have theirs in the jail kit). The Long Bridge and the quay
// cross sea blocks 6…8,−9, which the jail kit adopts. The open water beyond the woods' coast and the horizon are the stitching pass's.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { shiftOf } from '../../../world/city.js';
import { camera } from './frame.js';
// SPREAD · the cameras are today's metres (districts/frame.js): each frames its blocks' boats (their block's shift), or the water beside
// Iron Island (the jail compound's shift K, which those blocks move with); the two at Orchard St's end and the one on the span stand
// where they stood (remap), the span's looking where it looked (its water block's shift)
const K = shiftOf(7, -12);
// (the builders load only where blocks are built, like the jail kit's: see districts/jail.js)
const AT = ` import './sea/bay.js'`.split("'")[1];
const LIVE_MAIN = typeof document !== 'undefined' && typeof WorkerGlobalScope === 'undefined' && !new URLSearchParams(globalThis.location?.search || '').has('shot');
const B = LIVE_MAIN ? null : await import(AT.startsWith('.') ? new URL(AT, import.meta.url).href : AT);

export default defineKit({
  district: 'sea', name: 'The Bay', owner: 'the water-side agent (batch 5)', status: 'built',
  role: 'The bay north of the docks and round Iron Island: water traffic and marks only (no sim places, no street demand). The ferry heading out, a tug pushing sand to the Yards, the harbor police running down the jail island\'s side, a lobster boat hauling, a wreck on the rocks, the breakwater off the Yards, the channel\'s buoys and the island\'s keep-off buoys.',
  built: [[4, -11], [5, -10], [5, -9], [6, -11], [6, -12], [9, -11]],
  grammar: { ...BASE, life: [0, 0], walkway: 0 },
  palette: PALETTE,
  lexicon: LEXICON,
  heroes: [
    { id: 'the-wreck', block: [6, -12], module: 'heroes/sea-wreck.js', fn: 'wreckBlock', far: 'kit' },
  ],
  build(ctx) { B.bayBlock(ctx); },
  far(ctx) { B.bayFar(ctx); },
  hooks: {},
  transit: [],
  safehouses: [],
  peds: { density: 0 },
  cameras: {
    overhead: camera({ pos: [150, 128, -208], tgt: [192, 0, -326], fov: 44, sh: [186, -318, 110] }, shiftOf(6, -11)),
    street: [camera({ name: 'orchard-st-end', pos: [192.0, 2.7, -254.6], tgt: [176, 2.4, -300], fov: 54, sh: [180, -290, 50] }, shiftOf(5, -10), 'place'),   // where Orchard St runs into the bay: the breakwater, the tug and scow, the ferry beyond
      camera({ name: 'from-the-span', pos: [215.6, 2.8, -283.6], tgt: [197, 2.0, -312], fov: 54, sh: [204, -310, 50] }, shiftOf(6, -10), 'place')],         // off the Long Bridge's west rail: the launch, the wreck, the island's rocks
    landmark: camera({ name: 'second-chance', pos: [127.6, 4.4, -332.4], tgt: [141, 3.4, -346], fov: 50, sh: [138, -342, 30] }, shiftOf(4, -11)),
    night: camera({ name: 'bay-night', pos: [192.4, 3.0, -254.8], tgt: [238, 7, -318], fov: 56, sh: [214, -292, 80] }, K, 'place'),
  },
});
