// Block -1,0 (x -32…0, z 0…32) · South Row (Central Ave to Washington St) · owner: the south-row location agent (LOCATIONS.md).
// The dealing corner at Jay St & Washington St lands in this block too: its props (ids -1_0·corner·…) belong to the corners agent (blocks/corners.js).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
//
// South Row pass (2026-09-26) · character: the office block, where SHELL CO skips town. Every lot here is a lobby, so the generated
// moving day found no doorless frontage; it is hand-placed at the Main St alley mouth instead, as the block's one-off: a NO QS
// MOVING van at the curb, the office on the sidewalk (boxes, filing cabinet, water cooler, the lobby couch, the ficus), movers and
// the boss on the phone; the money sits in a stack on DIALUP TRUST's roof. Jay St gets two trees along the tower's blank podium, the Washington St pocket plaza its bench back.
import { couch, potPlant, streetTree, bench, milkCrate } from '../props.js';
import { Vol, meshed, textMask } from '../vox.js';
import { REG } from '../audit.js';
import { CV, SIDE, PAL } from '../style.js';
import { kerbX, kerbZ } from '../districts/frame.js';   // SPREAD: every x, z here is today's metres, carried by kerbX / kerbZ (the block's shift; a kerb
// thing kept to its kerb, a shopfront thing to the shopfront: style/city/SPREAD.md)
const kp = p => ({ ...p, x: kerbX(p.x), z: kerbZ(p.z) });

// hand placement: stamp only where the registry finds the box clear (masses, facade projections, doorways, items); o relaxes one
// check for one item. A spot that stops fitting is logged as a refused placement, never forced in.
const put = (api, bk, rot, x, z, o = {}) => { x = kerbX(x); z = kerbZ(z); const y = o.y ?? SIDE, g = REG.blk.group; if (o.lot) REG.group(o.lot);
  const why = REG.why(REG.boxOf(bk, rot, x, y, z), { ignore: o.ignore || [], doors: o.doors ?? true, items: o.items ?? true }); REG.group(g);
  if (why) { REG.skip(bk.kind, [x, y, z], 'hand: ' + why); return false; } api.stamp(bk, api.bank, rot, x, y, z); return true; };
// a slim street tree: its trunk column must be clear of everything; its crown (3.6 m up) only of masses and items
const tree = (api, seed, x, z, o = {}) => { x = kerbX(x); z = kerbZ(z); const bk = streetTree(seed), g = REG.blk.group; if (o.lot) REG.group(o.lot);
  const trunk = [x - .3, SIDE, z - .3, x + .3, SIDE + 3.6, z + .3], crown = [x - 1.05, SIDE + 3.6, z - 1.05, x + 1.05, SIDE + 6.1, z + 1.05];
  const why = REG.why(trunk, { ignore: 'plinth' }) || REG.why(crown, { ignore: ['facade', 'plinth'], doors: false }); REG.group(g);
  if (why) { REG.skip('street-tree', [x, SIDE, z], 'hand: ' + why); return false; } api.stamp(bk, api.bank, 0, x, SIDE + (o.dy || 0), z); return true; };

// ── the one-off's props (authored here: base centre at the origin, facing +z, 0.1 cubes)
const MEMO = new Map(), memo = (k, f) => { let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
const vol = (nx, ny, nz) => new Vol(nx, ny, nz, { s: CV, org: [-nx * CV / 2, 0, -nz * CV / 2] });
// lettering straight into a side of a volume (x = xs), reading along +z (dir 1) or −z (dir −1); every voxel is recorded for the audit
function letter(V, s, xs, z0, ytop, dir, c, board) { const M = textMask(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const z = dir > 0 ? z0 + i : z0 - i, y = ytop - j; V.set(xs, y, z, c); V.rec(s, xs, y, z, board, z, xs + (xs - board), z); } return M.w; }
// NO QS MOVING: a yellow box van with a red cab, rear doors swung open, the lettering on both flanks
const van = () => memo('van', () => { const W = 19, L = 53, H = 32, V = vol(W, H, L), Y = PAL.yellow, R = PAL.red, K = PAL.ink, T = 0x1b1b20, GL = 0x9fd8ff;
  for (const zc of [10, 42]) for (const x0 of [0, W - 3]) { V.box(x0, 0, zc - 4, x0 + 3, 8, zc + 4, T); V.box(x0 ? W - 1 : 0, 2, zc - 2, x0 ? W : 1, 6, zc + 2, 0xc9ced6); }   // wheels + hubs
  V.box(3, 3, 1, W - 3, 7, L - 1, K);                                                                                         // chassis (cleanup pass: out to the bumpers, which floated)
  V.box(0, 7, 1, W, H - 1, 37, Y); V.box(0, H - 1, 1, W, H, 37, 0xf7f7f2); V.box(0, 7, 1, W, 9, 37, R);                    // cargo box, white roof, red skirt
  V.box(2, 9, 1, W - 2, H - 2, 3, 0x2a2d38);                                                                                 // open rear: the dark hold
  V.box(3, 9, 3, 9, 14, 8, 0xc98a4b); V.box(10, 9, 3, 16, 12, 7, 0xb97a3b); V.box(4, 14, 3, 8, 18, 7, 0xd99a5b);           // what's already loaded
  for (const x of [0, W - 1]) V.box(x, 9, 0, x + 1, H - 2, 1, Y);                                                           // door edges (swung flat to the flanks)
  V.box(1, 7, 37, W - 1, 24, L, R); V.box(2, 24, 38, W - 2, 25, L - 2, R);                                                  // cab
  V.box(2, 15, L - 1, W - 2, 22, L, GL, 1); V.box(2, 8, L - 1, 5, 11, L, 0xffffff, 1); V.box(W - 5, 8, L - 1, W - 2, 11, L, 0xffffff, 1); V.box(6, 8, L - 1, W - 6, 11, L, K);   // windscreen, lights, grille
  for (const x of [1, W - 2]) V.box(x, 15, 40, x + 1, 22, 50, GL, 1);                                                       // side windows
  V.box(0, 3, L - 1, W, 6, L, 0xc9ced6, 2); V.box(0, 3, 0, W, 6, 1, 0xc9ced6, 2);                                          // bumpers
  // the flanks: NO QS over MOVING, ink on yellow, centred on the box (z 1…37); the sidewalk flank (x = 0) reads front-to-back
  const words = [['NO QS', 29], ['MOVING', 20]];
  for (const [s, yt] of words) { const w = textMask(s).w, z0 = 1 + ((36 - w) >> 1); letter(V, s, 0, z0, yt, 1, K, 1); letter(V, s, W - 1, z0 + w - 1, yt, -1, K, W - 2); }
  const b = meshed(V); b.kind = 'van'; return b; });
// a stack of taped moving boxes (three builds)
const boxes = v => memo('boxes' + v, () => { const V = vol(12, 12, 8), C = [0xc98a4b, 0xb97a3b, 0xd99a5b], TAPE = 0xe8d4b0;
  const bx = (x0, y0, z0, x1, y1, z1, c) => { V.box(x0, y0, z0, x1, y1, z1, c); const m = (x0 + x1) >> 1; V.box(m, y1 - 1, z0, m + 1, y1, z1, TAPE); V.box(m, y0, z1 - 1, m + 1, y1, z1, TAPE); };
  if (v === 0) { bx(0, 0, 1, 6, 5, 7, C[0]); bx(6, 0, 1, 12, 6, 7, C[1]); bx(2, 5, 2, 9, 10, 7, C[2]); }
  else if (v === 1) { bx(1, 0, 0, 11, 6, 8, C[1]); bx(3, 6, 1, 9, 11, 6, C[0]); }
  else { bx(2, 0, 1, 9, 4, 7, C[2]); bx(3, 4, 1, 10, 8, 7, C[0]); bx(2, 8, 2, 8, 12, 6, C[1]); }
  const b = meshed(V); b.kind = 'boxes'; return b; });
// a four-drawer filing cabinet, the top drawer hanging open with its files
const cabinet = () => memo('cab', () => { const V = vol(5, 13, 8), P = 0xd9d2bf, K = PAL.ink;
  V.box(0, 0, 0, 5, 13, 5, P); for (const y of [3, 6, 9]) V.box(0, y, 5 - 1, 5, y + 1, 5, 0xb8b0a0); for (const y of [1, 4, 7]) V.box(2, y, 5, 3, y + 1, 6, K);
  V.box(0, 9, 5, 5, 12, 8, P); V.box(1, 11, 5, 4, 12, 7, 0xf7f7f2); V.set(2, 12, 6, 0xf7f7f2); V.set(3, 12, 5, 0xffe23a); V.box(2, 10, 8 - 1, 3, 11, 8, K);
  const b = meshed(V); b.kind = 'cabinet'; return b; });
// the office water cooler
const cooler = () => memo('cooler', () => { const V = vol(4, 14, 4); V.box(0, 0, 0, 4, 8, 4, 0xf7f7f2); V.box(1, 5, 4 - 1, 3, 6, 4, 0x2f5bff); V.box(0, 8, 0, 4, 12, 4, 0x6fc3ff, 1); V.box(1, 12, 1, 3, 14, 3, 0x6fc3ff, 1);
  const b = meshed(V); b.kind = 'cooler'; return b; });

export default {
  remove: [
    '-1_0·traffic·taxi·0',   // (the van takes its spot at the curb)
    // walkers-fix round: the cars pass parks new cars along this kerb (ids traffic·car·n), and two of them took the van's spot — the van
    // and the box on the road were refused, one mover was left out and the other was pushed out into Main St's southbound lane
    '-1_0·traffic·car·1', '-1_0·traffic·car·2',
  ],
  move: {},
  replace: {},
  lots: {
    L2: s => { if (s.piece) s.piece.kind = 'cash'; },   // the roof piece is a cash stack (was a sneaker, and SNEAKS' giant one hangs next door)
    L3: s => { s.corp = 'SHELL CO'; },                  // the corner office on Main & Washington is the one moving out
  },
  add(api) {
    // THE ONE-OFF · SHELL CO skips town (Main St, the alley mouth between the DENTIST and SHELL CO)
    put(api, van(), 0, -3.02, 21.5, { y: 0 });                  // at the curb, rear doors open toward the alley
    put(api, couch(0x17171b), 3, -5.45, 17.5);                  // the lobby's black couch, facing the street
    // (cleanup pass: the office keeps to the shopfront side, so the walkers still get by between it and the van; the two stacks and
    // the ficus that stood at the kerb were refused by the clear walkway rule)
    put(api, boxes(1), 3, -5.5, 19.35);
    put(api, cabinet(), 1, -5.55, 20.6);                        // (drawer open toward the street)
    put(api, cooler(), 0, -5.7, 21.3);
    put(api, boxes(1), 0, -3.0, 18.2, { y: 0 });                // one on the road, about to be lifted in
    // JAY ST: two trees along the tower's blank podium; WASHINGTON ST: the pocket plaza's bench (its generator spot met the tree)
    tree(api, 21, -29.55, 10.4);
    tree(api, 23, -29.55, 15.6);
    put(api, bench(), 2, -18.15, 25.75, { y: SIDE + .1, lot: 'L4' });
    tree(api, 27, -17.4, 27.2, { lot: 'L4', dy: .1 });               // the plaza's second tree
    // ROOFS: somebody minds the grow-op and somebody counts the stack (the pieces' own standing figures are refused by the cast's
    // wall test, see NOTES-southrow). Crates straight onto the membranes: the spots were checked voxel by voxel (clear of the
    // greenhouse, the stack and the parapets), and the registry's building boxes would refuse anything on a roof
    api.stamp(milkCrate(0xff7a1a), api.bank, 0, kerbX(-9.0), 27.8, kerbZ(11.3));    // L1's roof, facing the greenhouse
    api.stamp(milkCrate(0x2f5bff), api.bank, 0, kerbX(-22.8), 24.8, kerbZ(26.6));   // L2's roof, facing the cash
  },
  people: {
    remove: [
      '-1_0·char·20', '-1_0·char·21',   // two more stood inside the stander at SHELL CO's door (ids re-mapped in the cleanup pass)
    ],
    move: {},
    add: [
      { x: -2.65, z: 16.85, y: 0, ry: -.2, act: 'carry', seed: 1901 },           // mover with a box, heading into the van (cleanup pass: off the walkers' path, in the road at its doors; walkers-fix: in the parking lane, 0.35 m clear of the travel lane at x −2)
      { x: -3.45, z: 17.45, y: 0, ry: 0, act: 'arms', seed: 1902 },              // mover at the open doors (walkers-fix: kerbside of the one carrying)
      { x: -4.4, z: 23.15, ry: Math.PI / 2 + .4, act: 'phone', seed: 1903 },     // the boss, on the phone, not looking at anyone (cleanup pass: by the kerb)
      { x: -17.75, z: 25.87, y: SIDE + .1, ry: 0, act: 'sit', seatY: .5, seed: 1904 },   // on the plaza bench
      { x: -16.8, z: 26.2, y: SIDE + .1, ry: -Math.PI / 2 - .3, act: 'sit', seatY: .5, seed: 1905 },   // on the plaza's crate, facing the bench
      { x: -9.0, z: 11.3, y: 27.8, ry: Math.PI, act: 'sit', seatY: .5, seed: 1906 },                    // the grow-op's minder
      { x: -22.8, z: 26.6, y: 24.8, ry: Math.PI + .2, act: 'sit', seatY: .5, seed: 1907 },              // counting the stack
    ].map(kp),
  },
};
