// PLEASANTVIEW (suburbs) · the district kit (owner: the Pleasantview section agent). The house rung of the homes ladder: the sim's 280
// house lots (world/city.js LOTS, four per block, 70 blocks) at their own coordinates, each a detached house of one of ten types
// (colonial, hip, gable-front, ranch, cape, split-level, gambrel, bungalow, two-family, A-frame), with its drive, path, fences,
// trees, cars, mailbox and yard life; every street has its own character (districts/suburbs/plan.js STREETS), and the neighbour rule
// holds across blocks. One-off scenes on about two blocks in three. The sim-state layer draws each lot's state on its anchor.
// Heroes: Pleasantview Park with its bandstand (−1,5), the corner store at Kent & Pine (0,5), P.S. 280 and its schoolyard (3,7).
// No static people: walkers come from peds.js.
import { defineKit } from './api.js';
import { BASE, LEXICON } from '../grammar.js';
import { PV_PALETTE, specOf } from './suburbs/plan.js';
import { buildHouse } from './suburbs/house.js';
import { grounds, fences, trees, life, oneOff } from './suburbs/yard.js';
import { farLots } from './suburbs/far.js';
import { remap, shiftOf, Z as lineZ } from '../../../world/city.js';
import { kerbX, kerbZ, stopAt, camera } from './frame.js';
// SPREAD · the hand-placed marks below are today's metres (districts/frame.js): a bus stop kept to its kerb (stopAt; the park's held to
// Pine St, below), the station on its lot (kerbX / kerbZ: the block's shift), the safehouse through remap, a camera on what it frames
// (camera). The identity at SPREAD 0
const rp = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };

// the lots of a block, built in passes so no lot's fences refuse a neighbour's tree: houses, grounds, trees, fences, then the life
export function buildLots(ctx, lots, o = {}) {
  const S = lots.map(specOf).filter(Boolean), g = k => ctx.group('H' + k);
  // (each pass meshes its volumes as it goes, so every structure is named for its lot: i_j·H<k>·structure·n)
  S.forEach((s, k) => { g(k); if (o.skip?.(s)) return; const { res } = buildHouse(ctx, s); s._out = res.out; ctx.finish(); });
  S.forEach((s, k) => { g(k); if (!o.skip?.(s)) grounds(ctx, s); ctx.finish(); });
  S.forEach((s, k) => { g(k); if (!o.skip?.(s)) trees(ctx, s); });
  S.forEach((s, k) => { g(k); if (!o.skip?.(s)) fences(ctx, s); ctx.finish(); });
  S.forEach((s, k) => { g(k); if (o.skip?.(s)) return; life(ctx, s, s.oneOff); ctx.finish(); ctx.group('oneoff'); oneOff(ctx, s); ctx.finish(); });
  return S;
}
export default defineKit({
  district: 'suburbs', name: 'Pleasantview', owner: 'the Pleasantview section agent (batch 4)', status: 'built',
  role: 'Homes: the house rung. 280 house lots (world/city.js LOTS, tier "house": price 45, rent 5/day), each with a stash, locks, doors and safes, and burglary of dark houses while the owners sleep. Street demand 1.5 by day, 4 at night; two dealing corners on Pine St (Kent & Pine, Jay & Pine); Pleasantview Park (−16, 176).',
  built: 'all', grammar: { ...BASE, life: [0, 0] }, palette: PV_PALETTE, lexicon: LEXICON,
  build(ctx) { buildLots(ctx, ctx.simLots); },   // (the plan's two greens, −1,5 and 3,7, are heroes: the park and P.S. 280)
  far(ctx) { farLots(ctx); },
  heroes: [
    { id: 'park', block: [-1, 5], module: 'heroes/suburbs-park.js', fn: 'pleasantviewPark', place: 'park' },
    { id: 'kent-pine', block: [0, 5], module: 'heroes/suburbs-store.js', fn: 'kentPine' },
    { id: 'ps280', block: [3, 7], module: 'heroes/suburbs-school.js', fn: 'ps280' },
  ],
  hooks: { lots: 'house' },
  // the buses: the park stop on Main St (the park's east gate) and the school stop on Bishop Ave (P.S. 280's corner); on the curb, facing the road
  transit: [{ id: 'bus-pleasantview-park', kind: 'bus', name: 'PLEASANTVIEW PARK', x: kerbX(-4.55), z: lineZ(6) - 13.6, rot: 1 },   // (SPREAD: 13.6 m short of Pine St's line whatever the spread: the 22 serves it from Pine St's kerb lane, which must stay in reach)
    stopAt({ id: 'bus-ps280', kind: 'bus', name: 'P.S. 280', x: 123.45, z: 244.5, rot: 1 }),
    { id: 'subway-pleasantview', kind: 'subway', name: 'PLEASANTVIEW', lines: 'T U', x: kerbX(-15), z: kerbZ(166.5), face: '-z', entry: 'stairs' }],   // (W3b) the TIDE's north end, the park's north side on Oak St; (subway stations, 10-08) an open stair entrance on the lawn between the north path and the playground (x −9.5 → −15: −9.5 was the playground)
  safehouses: [{ id: 'safe-fox-run-garage', name: 'the garage behind 186 Fox Run', ...rp(-58.1, 274.9), note: 'reserved: a detached garage at the back of a lot on the last street before the woods' }],
  peds: { density: 1 },
  cameras: {
    overhead: camera({ pos: [34, 118, 312], tgt: [30, 0, 206], fov: 46, sh: [30, 206, 110] }, shiftOf(0, 6)),
    street: [{ name: 'oak-st', rule: 'street', block: [-2, 5], side: '-z' }, { name: 'pine-st', rule: 'street', block: [0, 5], side: '+z' }],
    landmark: camera({ name: 'kent-pine', pos: [32, 1.9, 196.6], tgt: [22, 3.6, 183.6], fov: 50, sh: [24, 186, 26] }, shiftOf(0, 5), 'place'),
    night: { name: 'pine-st-night', rule: 'street', block: [0, 5], side: '+z' },
  },
});
