// SUNNY ACRES (trailer) · the district kit (batch 3). Owner: the Sunny Acres / Millennium Mall section agent.
// The spawn: every agent starts here on a rented pad. The compound (−8…−6, −3…−1; x −256…−160, z −96…0) is the sim's 54 trailer pads
// in six rows on three lanes; this kit builds each pad from the sim's own rect (world/city.js TRAILER): nine kinds of home, porches,
// carports, fences, cars, yard life, the pad number, and the anchors the sim-state layer draws on (lights, FOR RENT, locks, scars).
// The lanes get patched asphalt, speed bumps and painted words; wooden utility poles carry sagging wires and lamps; a chain-link
// fence runs round the park. Heroes: the swap meet (−7,−2, the sim's hangout at −208,−49), the park office and its letter sign on
// Elm St (−6,−2), and the coin laundry with Pad 47's above-ground pool on Central Ave (−7,−1). No people: walkers come from peds.js.
import { defineKit } from './api.js';
import { BASE, PALETTE, LEXICON } from '../grammar.js';
import { padsIn } from './trailer/plan.js';
import { buildPad } from './trailer/pads.js';
import { lanes, poles, perimeter, margins, farPark } from './trailer/park.js';
import { remap, shiftOf } from '../../../world/city.js';
import { stopAt, camera, kerbX, kerbZ } from './frame.js';
// SPREAD · the kit's marks are today's metres (districts/frame.js): the stop keeps to the Elm St kerb and moves with the compound (the
// gate); the hangout and the safehouse through remap (the compound's shift); the cameras frame the park (T), the three that stand at an
// Elm St or Central Ave corner from where they stood
const T = shiftOf(-8, -3), rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

export default defineKit({
  district: 'trailer', name: 'Sunny Acres', owner: 'the Sunny Acres / Millennium Mall agent (batch 3)', status: 'built',
  role: 'The spawn: every agent starts on a rented trailer pad (54 pads, rent 2/day, never bought). One of the sim\'s two markets: the swap meet (hangout, −208,−49). Street demand 3 by day, 4.5 at night; the dealing corner Birch & 2nd (−256,−64) on the west fence.',
  built: 'all',
  grammar: { ...BASE, life: [0, 0], walkway: .6 },
  palette: { ...PALETTE, neutral: { ...PALETTE.neutral, share: .34 } },
  lexicon: { ...LEXICON, shops: [['COIN LAUNDRY', 0x2de2e6], ['BAIT & TACKLE', 0x14a83b], ['PARK OFFICE', 0xffe23a]] },
  heroes: [
    { id: 'swap-meet', block: [-7, -2], module: 'heroes/trailer-swapmeet.js', fn: 'swapMeet', place: 'trailer' },
    { id: 'park-office', block: [-6, -2], module: 'heroes/trailer-office.js', fn: 'parkOffice' },
    { id: 'coin-laundry', block: [-7, -1], module: 'heroes/trailer-laundry.js', fn: 'coinLaundry' },
  ],
  build(ctx) {
    lanes(ctx); poles(ctx); perimeter(ctx); ctx.finish(); margins(ctx);
    for (const p of padsIn(ctx.i, ctx.j)) buildPad(ctx, p);
  },
  far(ctx) { farPark(ctx); },
  hooks: { lots: 'trailer', hangout: { id: 'trailer', ...rm(-208, -49) } },
  transit: [stopAt({ id: 'bus-sunny-acres', kind: 'bus', name: 'SUNNY ACRES', x: -162.4, z: -42.5, rot: 1 }),
    // (SUBWAY PLAN 2026-10-09) ELM ST, where the HARBOR meets the UNION: open stairs inside the park on its Elm St frontage, 6 m north of the
    // gate, the flight west into the park (the spec's (−189.5, −42.5) at +4, 1.2 m north: at −42.5 its south railing stood 0.8 m inside the
    // park office's north wall; kerbX / kerbZ of today's −167.5, −35.3 — on Elm St's sidewalk)
    { id: 'subway-elm', kind: 'subway', name: 'ELM ST', lines: 'H U', x: kerbX(-167.5), z: kerbZ(-35.3), face: '+x', entry: 'stairs' }],   // on Elm St by the park gate
  safehouses: [{ id: 'safe-coin-laundry', name: 'the coin laundry back room', ...rm(-206, -8), note: 'reserved: open all night, one door on Central Ave' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [-161, 110, 9], tgt: [-210, 0, -50], fov: 44, sh: [-208, -48, 70] }, T),
    street: [camera({ name: 'central-ave', pos: [-166, 2.9, -1.2], tgt: [-192, 3.8, -5.6], fov: 54, sh: [-190, -10, 40] }, T, 'place'),
      camera({ name: 'elm-st-gate', pos: [-158.2, 2.9, -27], tgt: [-163.4, 3.6, -52], fov: 54, sh: [-166, -44, 34] }, T, 'place')],
    landmark: camera({ name: 'swap-meet', pos: [-180.6, 1.6, -49.6], tgt: [-207, 2.5, -50.0], fov: 46, sh: [-202, -50, 28] }, T),
    night: camera({ name: 'gate-night', pos: [-155.2, 3.1, -51.2], tgt: [-170, 3.6, -52.6], fov: 56, sh: [-178, -52, 36] }, T, 'place'),
  },
});
