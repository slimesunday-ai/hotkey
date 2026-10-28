// SUNNY ACRES · the plan (pure data, deterministic): the sim's 54 trailer pads (world/city.js TRAILER + LOTS, kind 'trailer') with a
// spec each, the three park lanes, the margins and the hero reservations. Every block of the compound computes the same plan, so a
// block always knows what its neighbours built (pads straddle block edges; the back 2 m of facing rows overlap).
// Pad-local frame: u along the lane (0…8, left → right as seen from the lane), v from the back (0) to the front (12, the lane).
import { LOTS, TRAILER, frozen, P as PITCH, P0, shiftOf } from '../../../../world/city.js';   // (SPREAD pins: a pad's rolls read its corner in today's world)
import { PAL, hash, shade } from '../../style.js';
import { WALLS } from '../../style.js';
import { neutralAt } from '../../neutral.js';
import { NEUTRALS } from '../../grammar.js';

export const P = PITCH, IN = TRAILER.R;                                    // compound interior: x −252…−164, z −92…−6
// SPREAD · THE FRAME (districts/frame.js): the pads, the lanes and the interior come from world/city.js already in the spread world (the
// compound moves with its centre); the kit's own metres (the poles, the margins, the heroes, the shacks) are today's, the compound's
// frame, carried over by its shift [SX, SZ] ([0, 0] at SPREAD 0). A block's part of the park is its frame cell (today's grid, P0), so a
// pad, a lane's stretch or a fence run stays with the block that built it today: inCell / cellOf.
export const [SX, SZ] = shiftOf(-8, -3);
export const cellOf = (x, z) => [Math.floor((x - SX) / P0), Math.floor((z - SZ) / P0)];
export const LANES = TRAILER.lanes.map(z => ({ zc: z + 1, z0: z - 1, z1: z + 3 }));   // 4 m lanes between the pad fronts
export const HANGOUT = { x: -208 + SX, z: -49 + SZ };                            // the swap meet (sim place 'trailer', kind hangout)
export const CORNER = { x: -256 + SX, z: -64 + SZ, zone: [-253.3 + SX, -61.3 + SZ, -249.8 + SX, -58.0 + SZ] };   // Birch & 2nd: the hotspot's zone, kept clear
export const ENTRANCE = { lane: 1, x: -166 + SX };                          // the park's main gate: lane 2's mouth on Elm St
const K = { palette: { neutral: { share: .38, field: 72, lotField: 17 } } };

// ── the pads, in the sim's order (Pad 1 … Pad 54): row r 0…5 (north → south), column c 0…8 (west → east)
const raw = LOTS.filter(l => l.kind === 'trailer');
export const PADS = raw.map(l => {
  const n = +(/Pad (\d+)/.exec(l.addr || '')?.[1] || 0), c = Math.round((l.x0 - (IN.x0 + 4)) / 9), lane = LANES.findIndex(q => l.z0 === q.z0 - 12 || l.z0 === q.z1), r = lane * 2 + (l.face === 'z' ? 0 : 1);
  const f = l.face === 'z' ? 1 : -1, cx = l.x0 + l.sx / 2, cz = l.z0 + l.sz / 2;
  return { l, n, r, c, f, lane, id: 'lot:' + l.id, cx, cz, i: cellOf(cx, cz)[0], j: cellOf(cx, cz)[1], rect: [l.x0, l.z0, l.x0 + l.sx, l.z0 + l.sz] };
});
export const padAt = (r, c) => PADS.find(p => p.r === r && p.c === c) || null;
export const padsIn = (i, j) => PADS.filter(p => p.i === i && p.j === j);
// pad-local frame → world
export function frameOf(p) {
  const { l, f } = p, X = u => f > 0 ? l.x0 + u : l.x0 + l.sx - u, Z = v => f > 0 ? l.z0 + v : l.z0 + l.sz - v;
  return { f, X, Z, at: (u, v) => [X(u), Z(v)],
    rect: (u0, v0, u1, v1) => [Math.min(X(u0), X(u1)), Math.min(Z(v0), Z(v1)), Math.max(X(u0), X(u1)), Math.max(Z(v0), Z(v1))],
    rot: q => (q + (f > 0 ? 0 : 2)) & 3,                               // local facing (0 front, 1 +u, 2 back, 3 −u) → world quarter turn
    side: q => ['+z', '+x', '-z', '-x'][(q + (f > 0 ? 0 : 2)) & 3] };
}

// ── the palette of the park: saturated trailer paint + the neutral mix (white, bone, pale, grey, buff, slate)
export const PAINT = [0xffc21a, 0xef4a2a, 0xff4fa3, 0x7a3cff, 0xff7a1a, 0x25b84c, 0x3fa9f5, 0x2f5bff, 0x12b3a0, 0x8c52ff, 0xe83b5b, 0xff8a1f];
export const NEUTRAL = [NEUTRALS.white, NEUTRALS.bone, NEUTRALS.pale, NEUTRALS.grey, NEUTRALS.buff, NEUTRALS.slate];
export const ROOF = [0xefeee9, 0xd2d3d6, 0xc4c7cc, 0xdcd8cf, 0xe6e2d8, 0xb8b5ae, 0x8f9096];
export const STRIPE = [0xe8232a, 0x14a83b, 0x2f5bff, 0xffe23a, 0xff4fa3, 0x17171b, 0xff7a1a, 0x12b3a0, 0x7a3cff];
export const AWN = [0xe8232a, 0x14a83b, 0x2f5bff, 0xffc21a, 0xff4fa3, 0x12b3a0, 0xff7a1a, 0x7a3cff];
const TYPES = ['single', 'nose', 'double', 'camper', 'bullet', 'bus', 'box', 'rv', 'shack'];
const DECK = { single: 11, nose: 11, double: 6, camper: 7, bullet: 5, bus: 3, box: 4, rv: 4, shack: 3 };   // how many of each (54)
// per type: footprint along u (L) and v (W), metres; how far the home's back sits from the pad's back (vb)
export const SIZE = { single: [6.6, 3.2, 2.4], nose: [3.4, 7.6, 2.0], double: [7.4, 4.6, 2.2], camper: [4.6, 2.4, 2.8], bullet: [6.4, 2.6, 2.8],
  bus: [6.8, 2.5, 2.6], box: [6.0, 2.4, 2.8], rv: [7.2, 2.6, 2.6], shack: [4.4, 3.0, 2.6] };

// deterministic shuffle of the type deck (types never repeat side by side or straight across the lane)
function deck() { const d = []; for (const t of TYPES) for (let k = 0; k < DECK[t]; k++) d.push(t); for (let k = d.length - 1; k > 0; k--) { const m = (hash(k, 7, 91) * (k + 1)) | 0; [d[k], d[m]] = [d[m], d[k]]; } return d; }
const T = deck(), taken = new Map();
const neighbours = p => [padAt(p.r, p.c - 1), padAt(p.r ^ 1, p.c), padAt(p.r + (p.r & 1 ? 1 : -1), p.c)].filter(Boolean);
for (const p of PADS.slice().sort((a, b) => a.r - b.r || a.c - b.c)) {
  const [fx, fz] = frozen(p.l.x0, p.l.z0), h = k => hash(fx * 7 + 5, fz * 13 + k, 577), nb = neighbours(p).map(q => taken.get(q.id)).filter(Boolean);
  // type: the next card that differs from the left and across-the-lane neighbours
  let t = T.findIndex(x => x && !nb.some(s => s.type === x)); if (t < 0) t = T.findIndex(x => x); const type = T[t]; T[t] = null;
  // wall: neutral where the park's noise runs low (clusters), else a saturated paint no neighbour has
  const neutral = neutralAt(K, p.cx, p.cz, h(1)), pool = neutral ? NEUTRAL : PAINT, used = new Set(nb.map(s => s.wall));
  let w = (h(2) * pool.length) | 0; for (let k = 0; k < pool.length && used.has(pool[w]); k++) w = (w + 1) % pool.length;
  const wall = pool[w], stripe = STRIPE.filter(c => c !== wall)[(h(3) * (STRIPE.length - 1)) | 0];
  const spec = { type, wall, neutral, stripe, trim: neutral ? (h(4) < .5 ? PAL.ink : stripe) : (h(4) < .6 ? PAL.white : PAL.cream), roof: ROOF[(h(5) * ROOF.length) | 0],
    awn: AWN.filter(c => c !== wall)[(h(6) * (AWN.length - 1)) | 0], side: h(7) < .5 ? 0 : 1, seed: (h(8) * 1e6) | 0,
    skirt: ['lattice', 'tin', 'blocks', 'paint', 'lattice', 'tin'][(h(9) * 6) | 0], deck: ['rail', 'stoop', 'rail', 'metal', 'turf', 'stoop'][(h(10) * 6) | 0],
    awning: ['stripe', 'none', 'metal', 'stripe', 'none', 'tarp'][(h(11) * 6) | 0], vehicle: ['sedan', 'pickup', 'sedan', 'van', 'none', 'moto', 'blocks', 'pickup', 'none'][(h(12) * 9) | 0],
    yard: [h(13), h(14), h(15), h(16), h(17), h(18)], fence: ['none', 'none', 'chain', 'picket', 'none', 'pallet', 'none'][(h(19) * 7) | 0], roofJunk: (h(20) * 6) | 0 };
  taken.set(p.id, spec); p.spec = spec;
}
// ── hand-made pads: the one-offs that give the park its characters (keyed by the sim's pad number)
//   sign: a hand-painted board (every text in the park is written once) · extra: a named one-off the yard builder knows
export const ONE_OFF = {
  10: { extra: 'bigflamingo' },                                              // three metres of pink fibreglass
  20: { roof: 'NO COPS' },                                                   // painted on the roof, for the helicopters
  39: { extra: 'roofboat' },                                                 // the boat is stored on the roof
  3: { sign: 'BEWARE/OF DOG', signStyle: { bg: 0xffe23a, fg: 0x17171b, tilt: 1 }, extra: 'dog' },
  8: { sign: 'HAIR BY/TINA', signStyle: { bg: 0xff4fa3, fg: 0xf7f7f2, frame: 0xf7f7f2 }, extra: 'salon' },
  11: { sign: 'EGGS $3', signStyle: { bg: 0xf7f7f2, fg: 0xe8232a, drip: 1 }, extra: 'coop' },
  15: { sign: 'PSYCHIC/READINGS', signStyle: { bg: 0x7a3cff, fg: 0xffe23a, edge: 0xffe23a }, extra: 'psychic' },   // + the giant palm
  19: { sign: 'CAR 4 SALE/$800 OBO', signStyle: { bg: 0xf7f7f2, fg: 0x17171b, posts: 0 }, extra: 'forsale' },
  22: { sign: 'ENGINES/FIXED', signStyle: { bg: 0x2f5bff, fg: 0xf7f7f2, tin: 1 }, extra: 'engines' },
  26: { sign: 'KEEP OUT', signStyle: { bg: 0xe8232a, fg: 0xf7f7f2, tilt: -1, drip: 1 }, extra: 'dish' },
  30: { sign: 'TAXES DONE/CASH', signStyle: { bg: 0x14a83b, fg: 0xf7f7f2 }, extra: 'office' },
  33: { sign: 'NO/SOLICITING', signStyle: { bg: 0x17171b, fg: 0xffe23a }, extra: 'boat' },
  37: { sign: 'FIREWOOD/$5 BUNDLE', signStyle: { bg: 0xa4652f, fg: 0xf7f7f2, arrow: 'R' }, extra: 'firewood' },
  41: { sign: 'TATTOOS/BY APPT', signStyle: { bg: 0x17171b, fg: 0xff4fa3, frame: 0xff4fa3 }, extra: 'tattoo' },
  44: { sign: 'GONE/FISHING', signStyle: { bg: 0xe6e1d6, fg: 0x2f5bff, tilt: 1 }, extra: 'fish' },
  48: { sign: 'WE DONT/CALL 911', signStyle: { bg: 0xf7f7f2, fg: 0x17171b, edge: 0xe8232a }, extra: 'flag' },
  52: { sign: 'NOTARY/PUBLIC', signStyle: { bg: 0xf4f1ea, fg: 0x2f5bff, posts: 1 }, extra: 'notary' },
};
// the heroes' pads keep their home but give their yard to the hero (swap meet stalls, the pool)
export const HERO_BLOCKS = { swap: [-7, -2], office: [-6, -2], laundry: [-7, -1] };
// ── breaking the grid (review, pass 3): most homes sit a few degrees off square (nose-ins stay square to their carports), every home at its
// own depth so porches never line up, add-on rooms and lean-tos, a second fence material, a side fence, what's out back, the car's angle,
// worn paths. All from the pad's own hash, in a second pass, so the first pass's choices (type, colour, yard) stay exactly as they were.
for (const p of PADS) { const s = p.spec, [fx, fz] = frozen(p.l.x0, p.l.z0), h = k => hash(fx * 5 + 11, fz * 17 + k, 911);
  s.ang = s.type === 'nose' ? 0 : [-10, -7, -4.5, 0, 5, 7.5, 10][(h(1) * 7) | 0];
  s.vbJ = [-.2, 0, .3, .5, .8, 1.1, 1.4][(h(2) * 7) | 0];
  s.addon = ['room', 'none', 'leanto', 'room', 'none', 'leanto', 'room'][(h(3) * 7) | 0];
  s.fence2 = ['chain', 'picket', 'tin', 'lattice', 'rail', 'none'][(h(4) * 6) | 0];
  s.sideFence = h(5) < .55 ? { type: ['tin', 'pallet', 'lattice', 'chain', 'rail', 'tin'][(h(6) * 6) | 0], side: h(7) < .5 ? 0 : 1, v1: 8.2 + h(8) * 2.4 } : null;
  s.back = [h(9), h(10), h(11)]; s.carAng = (h(12) - .5) * .48; s.worn = h(13) < .6; s.desire = h(14) < .45 ? (h(15) < .5 ? 0 : 1) : -1;
  if (p.i === -7 && p.j === -2) Object.assign(s, { ang: 0, vbJ: 0, addon: 'none', sideFence: null });   // (the swap meet's yards are its stalls)
}
export const POOL_PAD = 47;                                             // Pad 47 (lane 3's north row, x −203…−195): the above-ground pool
Object.assign(PADS.find(p => p.n === POOL_PAD).spec, { deck: 'stoop', vehicle: 'none', fence: 'none', awning: 'stripe', ang: 0, vbJ: 0, addon: 'none', sideFence: null, fence2: 'none' });   // (its yard is the pool's)
for (const n of [20, 39]) PADS.find(p => p.n === n).spec.roofJunk = 0;       // (a clear roof for the paint and the boat)
