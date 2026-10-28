// Per-block overrides (pass 1d): the hand-crafting layer on top of generation. One file per block, `blocks/<i>_<j>.js`, owned by
// that block's location agent (see LOCATIONS.md / DISTRICTS.md); `blocks/corners.js` belongs to the corners agent and is merged in per
// block. The shared generator (gen.js, facade.js, props.js, …) never changes for one block.
//
// Pass 2 · each override file is loaded ON ITS OWN (modules.js): list a new file in manifest.js (one line). A file that fails to load,
// or throws while its block builds, is skipped for that block (the block builds without it) and the page lists the failure in red.
// Nothing imports override files statically any more (this file used to, so one broken override stopped every page).
//
// An override file default-exports any of these (all optional):
//   remove:  ['i_j·L3·street-tree·0', …]                  drop generated items by id (ids come from ?audit=1 and audit.json)
//   move:    { 'i_j·street·lamp·1': [dx, dy, dz, rot?] }   nudge an item (metres; rot = quarter turns 0–3)
//            { 'i_j·yard·car·0': { to: [x, y, z], rot } }   or put it somewhere exact
//   replace: { 'i_j·L2·trashcan·0': () => bench() }         swap an item for another prop (import it from '../props.js')
//   lots:    { L4: (spec, lot) => { spec.shops[0].name = 'NITE OWL'; spec.st = 5; } }   tune a lot's spec before it is built
//            (lots are numbered in subdivide order: L0 NW, L1 NE, L2 SW, L3 SE corners, then the north row, south row, west, east)
//   add({ bank, stamp, A, SIDE, P, i, j })                 stamp one-offs: stamp(prop(), bank, rot, x, y, z) — ids read i_j·hand·kind·n
//   people:  { remove: ['i_j·char·7'], move: { 'i_j·char·3': [dx, dy, dz, ry?] }, add: [{ x, z, y, ry, act: 'phone', seed }] }
// Ids are stable: block · group (lot L<k>, yard, oneoff, street, traffic, corner, hand, transit, or a hero part) · kind · n in build order.
// Every change re-keys the block cache. Check your block in seconds: node style/city/tools/audit.mjs block <i>,<j>
export { mergeOverride as merge, overrideFor } from '../modules.js';
