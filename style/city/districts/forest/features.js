// BLACKPINE WOODS · the one-offs (owner: the Blackpine Woods agent). Worker-safe. Each feature has an anchor point; the block that holds
// the anchor builds it (props stamped with ctx.put after a check against the block's WOODS volume, so nothing stands in a trunk or a
// boulder). The trailheads where the tracks and trails leave the city's edge roads, the campsite and its dock on the lake, the hunting
// stand at Deer Meadow, the dead car, the log deck, the dump behind Fox Run, the Dock St dead end, the signs along the tracks.
import { REG } from '../../audit.js';
import { SIDE, hash } from '../../style.js';
import { P, CAMP, DOCK, STAND, WRECK, DECK, DUMP, elev } from './plan.js';
import { remap, SPREAD, P0, shiftOf } from '../../../../world/city.js';
import { kerbX, kerbZ } from '../frame.js';
// SPREAD · a one-off's literal metres are today's: through remap (a woods block's shift; plan.js carries the anchors it shares), Dock St's
// dead end at its end (x = 8·P: the barriers the same 1.2 m short of it) and across it at the kerb (style/city/SPREAD.md)
const RM = (x, z) => remap(x, z), DE = (x, z) => SPREAD ? [8 * P - (8 * P0 - x), kerbZ(z)] : [x, z];
// a one-off with a literal anchor (lit) is one piece in its anchor's frame: its props move with the anchor (FM), so none lands across a
// block line from it; the rest are anchored on plan.js points (the spread world's already) or carry their own mapping (DE, the landing)
let D = [0, 0]; const FM = (x, z) => [x + D[0], z + D[1]];
import * as FP from './props.js';
import { tent, picnic, tires, bags, couch, bench, trashCan } from '../../props.js';
import { logSign } from './signs.js';
import { landing } from './landing.js';

// is a world box clear of the block's WOODS volume (trunks, bushes, boulders, logs)?
export function woodsClear(W, box) { if (!W) return true; const s = W.s, o = W.org;
  const i0 = Math.max(0, Math.floor((box[0] - o[0]) / s)), i1 = Math.min(W.nx - 1, Math.floor((box[3] - o[0] - 1e-4) / s)), k0 = Math.max(0, Math.floor((box[2] - o[2]) / s)), k1 = Math.min(W.nz - 1, Math.floor((box[5] - o[2] - 1e-4) / s));
  const j0 = Math.max(0, Math.floor((box[1] - o[1]) / s)), j1 = Math.min(W.ny - 1, Math.floor((box[4] - o[1] - 1e-4) / s));
  for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) if (W.d[i + k * W.nx + j * W.sxz]) return false; return true; }
// place a prop on the forest floor (or at o.y): slide along o.slide up to o.reach until it is clear of the woods and the registry
export function putW(ctx, prop, x, z, o = {}) {
  const rot = o.rot ?? 0, [ax, az] = o.slide || [1, 0], reach = o.reach ?? 1.2, y = o.y ?? SIDE, whys = new Set(), [sx, sz] = shiftOf(ctx.i, ctx.j);
  for (let k = 0, d = 0; Math.abs(d) <= reach + 1e-6; k++, d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .3) {
    const px = x + ax * d, pz = z + az * d, i = Math.floor((px - sx) / P0), j = Math.floor((pz - sz) / P0); if (i !== ctx.i || j !== ctx.j) { whys.add('outside the block'); continue; }   // (SPREAD: the block's frame cell, today's)
    const box = REG.boxOf(prop, rot, px, y, pz); if (!woodsClear(ctx.woods, box)) { whys.add('woods'); continue; }
    const why = REG.why(box, { ignore: o.ignore, doors: o.doors }); if (why) { whys.add(why); continue; }
    return ctx.put(prop, px, pz, { rot, y, reach: 0, ignore: o.ignore, doors: o.doors }); }
  REG.skip(prop.kind || 'prop', [x, y, z], [...whys].slice(0, 3).join(', ')); return null; }
const at = (ctx, x, z) => Math.floor(x / P) === ctx.i && Math.floor(z / P) === ctx.j;
const sign = (ctx, text, x, z, o) => { const b = FP.board(text, o); const r = putW(ctx, b, x, z, o); if (r) logSign(text.replace(/\//g, ' '), r[0], r[1]); return r; };

// ── the features, by anchor
const F = [
  // Birch St: the main trailhead into the woods (the leaf track): the park sign, the trail map, a trash can
  { lit: true, at: [-262.6, 43.2], build(ctx) { ctx.group('trailhead'); putW(ctx, FP.parkSign(), ...FM(-263.2, 43.2), { rot: 1, slide: [0, 1], reach: 2 }); putW(ctx, FP.mapBoard(), ...FM(-262.8, 55.4), { rot: 1, slide: [0, 1], reach: 1.5 });
    putW(ctx, trashCan(0x2f7a3a), ...FM(-261.4, 47.0), { rot: 1, slide: [0, 1], reach: 1 }); putW(ctx, FP.trailPost(0xffc21a), ...FM(-262.2, 52.3), { rot: 1, reach: .6 }); } },
  // 3rd St: the west track (private) and the Deer Meadow trail
  { lit: true, at: [-229.4, -101.6], build(ctx) { ctx.group('trailhead'); sign(ctx, 'NO TRESPASSING', ...FM(-228.6, -101.8), { bg: 0xf7f7f2, fg: 0xe8232a, edge: 0xe8232a, posts: 1, h: .9, rot: 0, slide: [1, 0] });
    putW(ctx, FP.trailPost(0x2f5bff), ...FM(-219.6, -101.2), { rot: 0, reach: .6 }); sign(ctx, 'DEER MEADOW', ...FM(-216.8, -101.6), { bg: 0x6b4526, fg: 0xf2d27a, posts: 1, h: .8, arrow: 'L', clean: true, rot: 0, slide: [1, 0] }); } },
  { lit: true, at: [-240, -128], build(ctx) { ctx.group('signs'); sign(ctx, 'PRIVATE PROPERTY', ...FM(-241.8, -127.4), { bg: 0xffc21a, fg: 0x17171b, posts: 1, h: 1.1, rot: 1, slide: [0, 1], reach: 2 }); } },
  { lit: true, at: [-334, -163], build(ctx) { ctx.group('signs'); sign(ctx, 'TURN BACK', ...FM(-333.6, -162.4), { bg: 0x9a8a6a, fg: 0x17171b, posts: 1, h: .7, tilt: 1, drip: 1, rot: 0, slide: [1, 0], reach: 2 }); } },
  { lit: true, at: [-370, -160], build(ctx) { ctx.group('signs'); sign(ctx, 'KEEP OUT', ...FM(-371.2, -160.2), { bg: 0xf7f7f2, fg: 0xe8232a, posts: 1, h: .9, drip: 1, rot: 1, slide: [0, 1], reach: 2 }); } },
  // Grand Ave's dead end: the chain across the south track, DEAD END
  { lit: true, at: [-125.5, 293.2], build(ctx) { ctx.group('trailhead'); putW(ctx, FP.chainGate(), ...FM(-125.5, 293.4), { rot: 0, reach: .4, slide: [0, 1] }); sign(ctx, 'DEAD END', ...FM(-121.2, 293.4), { bg: 0xffe23a, fg: 0x17171b, posts: 1, h: 1.3, clean: true, rot: 2, slide: [1, 0] }); } },
  { lit: true, at: [-116, 342], build(ctx) { ctx.group('signs'); sign(ctx, 'NO HUNTING', ...FM(-114.6, 342.4), { bg: 0xe8e2d0, fg: 0x2f5a3a, posts: 1, h: 1, rot: 3, slide: [0, 1], reach: 2 }); } },
  { lit: true, at: [-121.4, 372], build(ctx) { ctx.group('signs'); sign(ctx, 'BEWARE OF DOG', ...FM(-122.9, 372), { bg: 0xe8232a, fg: 0xf7f7f2, posts: 1, h: .7, tilt: -1, rot: 1, slide: [0, 1], reach: 2 }); } },
  // Fox Run: the pond trail, a bench, the dump (NO DUMPING, and everything dumped anyway)
  { lit: true, at: [40, 293.4], build(ctx) { ctx.group('trailhead'); putW(ctx, FP.trailPost(0x25b84c), ...FM(37.4, 293.4), { rot: 2, reach: .6 }); putW(ctx, bench(), ...FM(44.6, 294.2), { rot: 2, slide: [1, 0], reach: 1.5 }); } },
  { at: DUMP, build(ctx) { ctx.group('dump'); const [x, z] = DUMP; sign(ctx, 'NO DUMPING', x - 3.2, z - 3.4, { bg: 0xf7f7f2, fg: 0x17171b, posts: 1, h: .9, rot: 2, slide: [1, 0] });
    putW(ctx, FP.mattress(), x - .6, z - .4, { rot: 1, reach: .6 }); putW(ctx, FP.fridge(), x + 2.2, z + 1.6, { rot: 0, reach: .6 }); putW(ctx, tires(), x - 2.6, z + 1.8, { reach: .8 });
    putW(ctx, bags(9), x + 1.4, z - 2.2, { reach: .8 }); putW(ctx, FP.tvSet(), x + 3.4, z - .6, { rot: 3, reach: .6 }); putW(ctx, couch(0x8a5a3a), x - .4, z + 3.6, { rot: 2, reach: .8 }); } },
  // Route 9: the north track behind a yellow pipe gate, PRIVATE ROAD; KEEP OUT on the way in
  { lit: true, at: [234.2, -104], build(ctx) { ctx.group('trailhead'); putW(ctx, FP.pipeGate(), ...FM(234.4, -104), { rot: 1, reach: .4, slide: [1, 0] }); sign(ctx, 'PRIVATE ROAD', ...FM(235.2, -99.2), { bg: 0x17171b, fg: 0xffc21a, posts: 2, h: .9, clean: true, rot: 1, slide: [0, 1] }); } },
  { lit: true, at: [298, -102], build(ctx) { ctx.group('signs'); sign(ctx, 'KEEP OUT', ...FM(297.6, -102.6), { bg: 0xe8232a, fg: 0xf7f7f2, posts: 1, h: 1, tilt: 1, rot: 0, slide: [1, 0], reach: 2 }); } },
  // the dead car in the trees off the north track
  { at: WRECK, build(ctx) { ctx.group('wreck'); putW(ctx, FP.wreck(), WRECK[0], WRECK[1], { rot: 3, reach: 2, slide: [1, 0] }); putW(ctx, tires(), WRECK[0] + 3.4, WRECK[1] + 2.6, { reach: 1 }); } },
  // the log deck at the end of the logging spur
  { at: DECK, build(ctx) { ctx.group('deck'); const [x, z] = DECK; putW(ctx, FP.logPile(), x - 1, z + 2.6, { rot: 1, reach: 1.5, slide: [1, 0] }); putW(ctx, FP.logPile(), x + 3.2, z + 1.4, { rot: 1, reach: 1.5, slide: [1, 0] });
    sign(ctx, 'NO FIRES', x - 5.8, z - 3, { bg: 0xf7f7f2, fg: 0xe8232a, posts: 1, h: .8, rot: 0, slide: [1, 0] }); } },
  // Deer Meadow: the hunting stand at the edge, looking over the grass; NO HUNTING nailed below it
  { at: STAND, build(ctx) { ctx.group('stand'); putW(ctx, FP.huntingStand(), STAND[0], STAND[1], { rot: 3, reach: 2, slide: [0, 1] }); sign(ctx, 'NO HUNTING OR TRAPPING', STAND[0] + .4, STAND[1] + 4.4, { bg: 0xe8e2d0, fg: 0x2f5a3a, posts: 1, h: 1, rot: 3, slide: [0, 1], reach: 2 }); } },
  // the campsite on the lake's north shore: tent, fire ring, chairs, table, cooler; a canoe pulled up; the dock out into the lake
  { at: CAMP, build(ctx) { ctx.group('camp'); const [x, z] = CAMP;
    putW(ctx, tent(0xff7a1a), x - 3.6, z - 1.2, { rot: 0, reach: 1 }); putW(ctx, FP.fireRing(), x + 1.2, z + 1.4, { reach: .6 }); putW(ctx, FP.campChair(0x2f5bff), x + 3.2, z + 1.2, { rot: 3, reach: .6 });
    putW(ctx, FP.campChair(0xe8232a), x + 1.4, z + 3.8, { rot: 2, reach: .6 }); putW(ctx, picnic(0x9a6a3c), x + 4.2, z + 4.4, { rot: 1, reach: 1 }); putW(ctx, FP.cooler(0xe8232a), x - 1.4, z + 3.4, { rot: 0, reach: .6 });
    dock(ctx); } },
  // the leaf dig's south side (the clearing's hero is the block north of it): the spoil heaped outside the 6.5 m ring
  { lit: true, at: [-333, 67], build(ctx) { ctx.group('dig'); putW(ctx, FP.spoilHeap(2), ...FM(-335.5, 66.8), { rot: 0, reach: .6 }); putW(ctx, FP.spoilHeap(1), ...FM(-330.4, 67.6), { rot: 1, reach: .6 });
    for (const [x, z] of [[-326.4, 66.3], [-333.6, 66.1]]) putW(ctx, FP.flagStake(), ...FM(x, z), { reach: .3 }); } },
  // Dock St runs out at x 256: barriers across the end, DEAD END
  { at: DE(254.6, -226.5), build(ctx) { ctx.group('deadend'); for (const z of [-227.2, -224.8, -222.4]) if (at(ctx, ...DE(254.8, z))) putW(ctx, FP.barrier(), ...DE(254.8, z), { rot: 1, reach: .3, slide: [0, 1], y: 0 }); } },
  { at: DE(254.6, -221.5), build(ctx) { ctx.group('deadend'); for (const z of [-222.4, -220.8]) if (at(ctx, ...DE(254.8, z))) putW(ctx, FP.barrier(), ...DE(254.8, z), { rot: 1, reach: .3, slide: [0, 1], y: 0 }); } },
  // stitch pass · Route 9's south end: the ferry landing (landing.js), built by the block west of the highway's centreline
  { at: [kerbX(220), 400 + 12 * SPREAD], build(ctx) { landing(ctx); } },   // (SPREAD: with Route 9's end, plan.js LANDING)
];
// the dock: planks on posts from the shore out into the lake (a walk surface), a canoe tied alongside
function dock(ctx) { const [x0, z0, , z1] = DOCK, w = 1.6, xa = x0 - w / 2, len = z0 - z1;
  if (!at(ctx, x0, z1) || !at(ctx, x0, z0)) return;
  const V = ctx.volume(xa, 0, z1, xa + w, .45, z0, { walk: true }), n = V.nz;
  for (let z = 0; z < n; z++) { const wz = z1 + (z + .5) * .1, e = elev(x0, wz); if (e > 1.4) continue;
    for (let x = 0; x < V.nx; x++) V.set(x, 3, z, z % 3 === 2 ? 0x6b4526 : 0x9a6a3c);
    if (z % 16 === 1) for (const x of [0, V.nx - 1]) for (let y = 0; y < 3; y++) V.set(x, y, z, 0x5a3620); }
  REG.keep([xa, 0, z1, xa + w, .45, z0], 'dock');
  putW(ctx, FP.canoe(0x25b84c, false), x0 + 1.6, (z0 + z1) / 2 - 1, { rot: 0, y: 0, reach: 1, slide: [0, 1] }); }

export function features(ctx) { for (const f of F) { const [ax, az] = f.lit ? RM(f.at[0], f.at[1]) : f.at; if (!at(ctx, ax, az)) continue; D = f.lit ? [ax - f.at[0], az - f.at[1]] : [0, 0];
  try { f.build(ctx); } finally { ctx.group('woods'); D = [0, 0]; } } }
