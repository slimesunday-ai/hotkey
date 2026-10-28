// PLEASANTVIEW · THE PLAN (pure; owner: the Pleasantview section agent). Every one of the sim's 280 house lots (world/city.js LOTS,
// four per block) gets its spec here, decided once for the whole district in street order, so the neighbour rule holds across
// blocks: along a street no two neighbours share a wall colour, a house type, a roof colour or a fence, and neither do the house
// across the street and the house behind. Each street has its own character (types, fences, yards, trees, colours, clutter), so
// the streets read apart. The build, the far tier and the heroes all read this module; nothing in it depends on build order.
// Lot-local coordinates: u along the frontage (left → right seen from the street), v from the front lot line into the lot;
// the layout works in voxels (0.1 m) of that frame.
import { LOTS, frozen, unshift } from '../../../../world/city.js';   // (SPREAD pins: a lot's rolls and the billboards' spacing read today's coordinates)
import { segX, P, interior } from '../../plan.js';
import { PAL, hash } from '../../style.js';
import { PALETTE, NEUTRALS } from '../../grammar.js';
import { neutralAt } from '../../neutral.js';
import { wpick } from './brush.js';

export const PV_PALETTE = { ...PALETTE, neutral: { ...PALETTE.neutral, share: .34 } };
const K = { palette: PV_PALETTE };
const C = { yellow: 0xffc21a, flame: 0xef4a2a, pink: 0xff4fa3, purple: 0x7a3cff, orange: 0xff7a1a, green: 0x25b84c, sky: 0x3fa9f5, blue: 0x2f5bff, teal: 0x12b3a0, violet: 0x8c52ff, crimson: 0xe83b5b, amber: 0xff8a1f };
// neutral shingles (STYLE §2: roofs are neutral): charcoal, slate, grey, warm grey, pale grey, near-black, brown, blue-grey
export const ROOFS = [0x4a4a52, 0x5c5b62, 0x6d707a, 0x7d7068, 0x8f9199, 0x3d3f46, 0x6b5a50, 0x57606e];
const DOORS = [0xc8202a, 0x0b5a3a, 0x1f2f6b, PAL.ink, PAL.white, 0xffc21a, 0x12b3a0, 0x8a5a2a, 0x7a1020, 0x2f5bff];
const SHUTTERS = [PAL.ink, 0x0b5a3a, 0x7a1020, 0x1f2f6b, PAL.white, 0x2f5bff, 0x3d3f46];
export const AWNS = [[0x14a83b, PAL.white], [0xe8232a, PAL.white], [0x2f5bff, PAL.white], [0x3d3f46, PAL.white], [0xffc21a, 0x6b5a50], [0x12b3a0, PAL.white]];
const GDOORS = [PAL.white, 0xe6e1d6, 0x8a5a2a, 0xd3d4d7, 0x6d707a];

// ── house types: storeys, body width and depth ranges (voxels), the garages and front doors each can have
export const TYPES = {
  colonial:   { st: 2,   w: [72, 86], d: [50, 58], garage: [['attached', 3], ['none', 2], ['back', 2]], porch: [['portico', 3], ['hood', 2], ['stoop', 1]] },
  hip:        { st: 2,   w: [64, 78], d: [52, 60], garage: [['attached', 5], ['none', 1]], porch: [['porch', 3], ['hood', 2], ['stoop', 1]] },
  gablefront: { st: 2,   w: [54, 66], d: [58, 68], garage: [['back', 3], ['none', 3]], porch: [['porch', 4], ['enclosed', 2], ['stoop', 1]] },
  ranch:      { st: 1,   w: [78, 94], d: [48, 56], garage: [['attached', 3], ['carport', 3]], porch: [['stoop', 2], ['hood', 2]] },
  cape:       { st: 1.5, w: [60, 72], d: [48, 54], garage: [['none', 3], ['back', 2], ['attached', 2]], porch: [['stoop', 2], ['hood', 2], ['portico', 1]] },
  split:      { st: 1.5, w: [74, 88], d: [50, 58], garage: [['under', 1]], porch: [['stoop', 1]] },
  gambrel:    { st: 2,   w: [68, 80], d: [50, 58], garage: [['none', 2], ['back', 2], ['attached', 2]], porch: [['hood', 2], ['portico', 2], ['stoop', 1]] },
  bungalow:   { st: 1.5, w: [58, 70], d: [56, 64], garage: [['none', 2], ['back', 2], ['carport', 2]], porch: [['porch', 1]] },
  twofam:     { st: 2,   w: [62, 80], d: [56, 66], garage: [['none', 3], ['back', 2], ['under', 2]], porch: [['stoop', 3], ['enclosed', 2]] },
  aframe:     { st: 1.5, w: [58, 66], d: [52, 60], garage: [['carport', 2], ['none', 1]], porch: [['deck', 1]] },
};

// ── the streets (by the plan's z line of the street the lot faces), each with its own character
export const STREETS = {
  3: { name: 'Jackson St', feel: 'the outer-borough edge by downtown: two-families on stoops, aluminium awnings, chain-link, paved yards, dishes',
    types: [['twofam', 6], ['gablefront', 4], ['colonial', 1], ['cape', 1]], walls: [C.flame, C.blue, C.teal, C.amber, C.green, C.crimson, C.purple, C.sky],
    fence: [['chain', 5], ['iron', 4], ['wall', 2], ['none', 1]], back: [['chain', 3], ['privacy', 2]], yard: [['paved', 5], ['lawn', 2], ['garden', 2]],
    drive: [['concrete', 3], ['asphalt', 2]], set: [24, 30], front: [['none', 3], ['ornamental', 2], ['maple', 1]], big: .15,
    extras: [['planters', 3], ['statue', 2], ['bike', 2], ['bins', 3], ['toys', 1], ['none', 2]], yardB: [['clothesline', 4], ['garden', 3], ['patio', 3], ['kpool', 1], ['shed', 1], ['hoop', 1]],
    cars: [['sedan', 5], ['van', 2], ['none', 2]], awning: .7, dish: .55, shutter: .25, lap: .6, box: .3, ac: .5, mailbox: [['wall', 5], ['post', 1]] },
  4: { name: 'Union Ave', feel: 'the avenue: big two-storey colonials and gambrels, hedges and iron, maples, the bus',
    types: [['colonial', 5], ['hip', 3], ['gambrel', 3], ['twofam', 2], ['gablefront', 1]], walls: [C.yellow, C.blue, C.green, C.crimson, C.sky, C.violet, C.orange, C.teal],
    fence: [['iron', 3], ['hedge', 3], ['picket', 2], ['wall', 2], ['none', 1]], back: [['privacy', 4], ['picket', 1]], yard: [['lawn', 5], ['garden', 3]],
    drive: [['concrete', 3], ['asphalt', 2], ['pavers', 1]], set: [30, 38], front: [['maple', 4], ['oak', 2], ['ornamental', 1]], big: .45,
    extras: [['planters', 2], ['lantern', 3], ['birdbath', 2], ['bench', 1], ['none', 2]], yardB: [['patio', 4], ['pool', 2], ['garden', 2], ['swing', 2], ['shed', 1]],
    cars: [['sedan', 5], ['wagon', 2], ['van', 1]], awning: .15, dish: .15, shutter: .7, lap: .5, box: .35, ac: .1, mailbox: [['post', 3], ['brick', 3], ['wall', 1]] },
  5: { name: 'Oak St', feel: 'Evergreen Terrace: two-storeys with attached garages, lawns, white pickets, big oaks, hoops over the garage',
    types: [['hip', 5], ['colonial', 3], ['gablefront', 2], ['split', 2], ['cape', 1]], walls: [C.pink, C.sky, C.yellow, C.green, C.orange, C.purple, C.teal, C.flame],
    fence: [['picket', 5], ['none', 3], ['hedge', 2]], back: [['privacy', 4], ['picket', 1]], yard: [['lawn', 6], ['garden', 2]],
    drive: [['concrete', 4], ['asphalt', 1]], set: [28, 36], front: [['oak', 4], ['maple', 2], ['none', 1]], big: .55,
    extras: [['gnomes', 2], ['flamingos', 2], ['bike', 2], ['toys', 2], ['sprinkler', 2], ['birdbath', 1], ['none', 2]], yardB: [['swing', 3], ['trampoline', 3], ['pool', 2], ['patio', 2], ['doghouse', 2], ['treehouse', 1]],
    cars: [['sedan', 4], ['wagon', 3], ['van', 2], ['pickup', 1]], awning: .1, dish: .3, shutter: .6, lap: .6, box: .25, ac: .15, mailbox: [['post', 5], ['novelty', 1]] },
  6: { name: 'Pine St', feel: 'the rough one: the dealing corners, the corner store, chain-link, dry lawns, a car on blocks, bins out, pines',
    types: [['gablefront', 4], ['cape', 3], ['twofam', 3], ['bungalow', 2], ['ranch', 1]], walls: [C.amber, C.teal, C.flame, C.violet, C.blue, C.yellow, C.green, C.crimson],
    fence: [['chain', 5], ['none', 3], ['picket', 2]], back: [['chain', 4], ['privacy', 2], ['none', 1]], yard: [['dry', 4], ['lawn', 3], ['gravel', 2], ['paved', 1]],
    drive: [['asphalt', 3], ['gravel', 2], ['concrete', 2]], set: [24, 32], front: [['pine', 3], ['none', 3], ['maple', 1]], big: .3,
    extras: [['bins', 4], ['junk', 3], ['bike', 2], ['toys', 1], ['none', 1]], yardB: [['junk', 3], ['aboveground', 2], ['doghouse', 3], ['clothesline', 2], ['shed', 2], ['kpool', 1]],
    cars: [['sedan', 3], ['pickup', 3], ['van', 1], ['none', 2]], awning: .35, dish: .6, shutter: .2, lap: .7, box: .1, ac: .45, mailbox: [['post', 3], ['wall', 2]] },
  7: { name: 'Willow St', feel: 'mid-century: long low ranches and split-levels, carports, picture windows, pools out back, willows',
    types: [['ranch', 6], ['split', 3], ['hip', 1], ['cape', 1]], walls: [C.teal, C.orange, C.yellow, C.sky, C.pink, C.green, C.amber, C.blue],
    fence: [['none', 4], ['split', 2], ['hedge', 2], ['picket', 1]], back: [['privacy', 3], ['chain', 2]], yard: [['lawn', 5], ['garden', 2], ['gravel', 1]],
    drive: [['concrete', 3], ['strips', 2], ['asphalt', 1]], set: [30, 38], front: [['willow', 3], ['ornamental', 2], ['maple', 1], ['none', 1]], big: .4,
    extras: [['flamingos', 2], ['lantern', 2], ['planters', 2], ['sprinkler', 2], ['none', 2]], yardB: [['pool', 5], ['patio', 3], ['hottub', 2], ['trampoline', 1], ['swing', 1]],
    cars: [['sedan', 4], ['wagon', 2], ['pickup', 1]], awning: .25, dish: .25, shutter: .3, lap: .4, box: .4, ac: .2, mailbox: [['post', 4], ['brick', 2]] },
  8: { name: 'Aspen St', feel: 'capes, gambrels and split-levels with dormers, trampolines, boats and campers in the drive, aspens',
    types: [['cape', 4], ['split', 3], ['gambrel', 3], ['bungalow', 2], ['colonial', 1]], walls: [C.purple, C.green, C.crimson, C.sky, C.amber, C.blue, C.yellow, C.teal],
    fence: [['picket', 3], ['split', 3], ['none', 2], ['hedge', 1]], back: [['privacy', 3], ['picket', 1], ['split', 1]], yard: [['lawn', 5], ['garden', 2], ['dry', 1]],
    drive: [['asphalt', 3], ['concrete', 2], ['gravel', 1]], set: [28, 36], front: [['birch', 4], ['maple', 1], ['pine', 1]], big: .45,
    extras: [['gnomes', 2], ['toys', 2], ['bike', 2], ['windmill', 2], ['birdbath', 1], ['none', 2]], yardB: [['trampoline', 4], ['swing', 3], ['aboveground', 2], ['shed', 2], ['playhouse', 2], ['garden', 1]],
    cars: [['sedan', 3], ['van', 2], ['wagon', 2], ['boat', 2], ['camper', 1]], awning: .1, dish: .35, shutter: .5, lap: .5, box: .3, ac: .1, mailbox: [['post', 5], ['novelty', 1]] },
  9: { name: 'Fox Run', feel: 'the last street before the woods: bungalows and A-frames, split rail, woodpiles, pickups, kennels, pines',
    types: [['bungalow', 4], ['aframe', 3], ['ranch', 2], ['cape', 2]], walls: [C.green, C.orange, C.flame, C.teal, C.blue, C.yellow, C.violet, C.crimson],
    fence: [['split', 5], ['none', 3], ['chain', 1]], back: [['none', 2], ['split', 2], ['chain', 1]], yard: [['dry', 3], ['lawn', 3], ['gravel', 3]],
    drive: [['gravel', 5], ['asphalt', 1]], set: [30, 38], front: [['pine', 4], ['oak', 2], ['birch', 1]], big: .55,
    extras: [['woodpile', 3], ['junk', 2], ['windmill', 1], ['none', 2]], yardB: [['woodpile', 3], ['aboveground', 2], ['doghouse', 3], ['firepit', 3], ['shed', 2], ['junk', 1]],
    cars: [['pickup', 5], ['camper', 1], ['boat', 1], ['sedan', 1]], awning: .1, dish: .5, shutter: .2, lap: .3, box: .15, ac: .1, mailbox: [['post', 5]] },
};

// ── the lots: the sim's own rects (never moved), their frame, which side streets they touch
export const HOUSE_LOTS = LOTS.filter(l => l.kind === 'house');
export const lotId = l => 'lot:' + l.id;   // (SPREAD: the lot's frozen id — world/city.js frozen — never its world corner)
export function frameOf(l) {
  const f = l.face === 'z' ? 1 : -1, W = l.sx, D = l.sz;
  const x = u => f > 0 ? l.x0 + u : l.x0 + W - u, z = v => f > 0 ? l.z0 + D - v : l.z0 + v;
  return { f, W, D, x, z, at: (u, v) => [x(u), z(v)],
    rect: (u0, v0, u1, v1) => { const xa = x(u0), xb = x(u1), za = z(v0), zb = z(v1); return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]; },
    rot: q => ((q + (f > 0 ? 0 : 2)) % 4 + 4) % 4 };   // a local quarter turn (0 faces the street, 1 faces +u, 2 the back, 3 −u) → the world one
}
const H = (l, k) => { const [x0, z0] = frozen(l.x0, l.z0); return hash(x0 * 7 + z0 * 13 + 5, k, 331); };
const LUM = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255;
const pickX = (u, opts, not = []) => { const o = opts.filter(([v]) => !not.includes(v)); return wpick(u, o.length ? o : opts); };
const pickC = (u, list, not = []) => { const o = list.filter(c => !not.includes(c)); const s = o.length ? o : list; return s[Math.min(s.length - 1, (u * s.length) | 0)]; };

// ── every lot's spec, in street order (street line, north side then south side, west to east)
function buildSpecs() {
  const byId = new Map(), order = [];
  for (let L = 3; L <= 9; L++) for (const face of ['z', '-z']) {
    const row = face === 'z' ? L - 1 : L, side = HOUSE_LOTS.filter(l => l.face === face && l.j === row).sort((a, b) => a.x0 - b.x0);
    side.forEach((l, n) => order.push({ l, L, n, side }));
  }
  const specAt = l => byId.get(lotId(l));
  for (const { l, L, n, side } of order) {
    const st = STREETS[L], R = interior(l.i, l.j), F = frameOf(l), W10 = l.sx * 10, D10 = l.sz * 10;
    const prev = n > 0 ? specAt(side[n - 1]) : null;
    const facing = HOUSE_LOTS.find(q => q.x0 === l.x0 && q.face !== l.face && (l.face === 'z' ? q.j === l.j + 1 : q.j === l.j - 1));
    const back = HOUSE_LOTS.find(q => q.x0 === l.x0 && q.face !== l.face && q.j === l.j);
    const nb = [prev, facing && specAt(facing), back && specAt(back)].filter(Boolean);
    // which local sides touch a side street (a corner lot): u = 0 is west for a 'z' lot, east for a '-z' lot
    const west = l.x0 === R.x0 && segX(l.i, l.j), east = l.x0 + l.sx === R.x1 && segX(l.i + 1, l.j);
    const corner = { L: F.f > 0 ? west : east, R: F.f > 0 ? east : west };
    // the type: never the previous lot's; narrow lots (9 m) take the narrow types
    const narrow = W10 < 100, typeOpts = narrow ? [['gablefront', 3], ['twofam', 2], ['cape', 1]] : st.types;
    const type = pickX(H(l, 1), typeOpts, prev ? [prev.type] : []), T = TYPES[type];
    // the wall: neutral where the neutral fields run low (neutral.js), else the street's colours; never a neighbour's
    const cx = l.x0 + l.sx / 2, cz = l.z0 + l.sz / 2, neutral = neutralAt(K, cx, cz, H(l, 2)), taken = nb.map(s => s.wall);
    let wall, trim;
    if (neutral) { const tones = K.palette.neutral.tones; wall = pickC(H(l, 3), tones, taken);
      const brick = (wall >> 16) - (wall & 255) > 60, lum = LUM(wall);
      trim = brick ? pickC(H(l, 4), [PAL.cream, PAL.white]) : lum > .7 ? pickC(H(l, 4), [PAL.ink, 0x6d707a, PAL.ink, 0x2f5bff, 0xe8232a, 0x0b5a3a]) : pickC(H(l, 4), [PAL.white, PAL.cream, PAL.white]); }
    else { wall = pickC(H(l, 3), st.walls, taken); trim = H(l, 4) < .62 ? PAL.white : PAL.cream; }
    const roof = pickC(H(l, 5), type === 'ranch' || type === 'aframe' ? ROOFS : ROOFS.slice(0, 7), nb.map(s => s.roof));
    // garage, porch, drive side (a corner lot turns its drive to the side street now and then), setback
    let garage = narrow ? (type === 'twofam' ? 'under' : 'none') : wpick(H(l, 6), T.garage);
    const driveSide = corner.L && H(l, 7) < .55 ? 'L' : corner.R && H(l, 7) < .55 ? 'R' : H(l, 8) < .5 ? 'L' : 'R';
    const porch = wpick(H(l, 9), T.porch), [s0, s1] = st.set, set = Math.round(s0 + H(l, 10) * (s1 - s0));
    const fence = pickX(H(l, 11), st.fence, prev && prev.fence !== 'none' ? [prev.fence] : []), backFence = wpick(H(l, 12), st.back);
    const yard = wpick(H(l, 13), st.yard), drive = wpick(H(l, 14), st.drive);
    const car = wpick(H(l, 15), st.cars), car2 = H(l, 16) < .22 && car !== 'none' && car !== 'boat' && car !== 'camper' ? wpick(H(l, 17), st.cars.filter(([k]) => k !== 'boat' && k !== 'camper' && k !== 'none')) : 'none';
    const s = { id: lotId(l), l, L, n, st, street: st.name, i: l.i, j: l.j, f: F.f, W: l.sx, D: l.sz, W10, D10, corner, narrow, addr: l.addr, num: (l.addr || '').split(' ')[0],
      type, storeys: T.st, wall, neutral, trim, roof, door: pickC(H(l, 18), DOORS, [wall]), shutter: H(l, 19) < st.shutter ? pickC(H(l, 20), SHUTTERS, [wall, trim]) : null,
      awning: H(l, 21) < st.awning ? AWNS[(H(l, 22) * AWNS.length) | 0] : null, gdoor: pickC(H(l, 23), GDOORS, [wall]), lap: H(l, 24) < st.lap && !(neutral && (wall === NEUTRALS.brick || wall === NEUTRALS.buff)),
      garage, driveSide, porch, set, fence, backFence, yard, drive, car, car2,
      front: wpick(H(l, 25), st.front), big: H(l, 26) < st.big, extra: wpick(H(l, 27), st.extras), extra2: H(l, 28) < .35 ? wpick(H(l, 29), st.extras) : 'none',
      yardB: wpick(H(l, 30), st.yardB), yardB2: H(l, 31) < .45 ? wpick(H(l, 32), st.yardB) : 'none',
      dish: H(l, 33) < st.dish, box: H(l, 34) < st.box, ac: H(l, 35) < st.ac, mailbox: wpick(H(l, 36), st.mailbox), chimney: H(l, 37) < .6, solar: H(l, 38) < .08,
      lights: H(l, 39) < .05, dog: H(l, 40) < .3, grid: (type === 'colonial' || type === 'cape' || type === 'gambrel' || type === 'gablefront') && H(l, 43) < .55,
      bay: (type === 'colonial' || type === 'hip' || type === 'bungalow' || type === 'gablefront') && H(l, 45) < .4, path: wpick(H(l, 41), [['straight', 3], ['drive', 2], ['stones', 1]]), seed: (H(l, 42) * 1e6) | 0, oneOff: null };
    byId.set(s.id, s);
  }
  return { byId, order: order.map(o => byId.get(lotId(o.l))) };
}
const SPECS = buildSpecs();
export const specOf = l => SPECS.byId.get(lotId(l)), specById = id => SPECS.byId.get('lot:' + id);   // specById: by a lot's frozen id ('17,176')
export const allSpecs = () => SPECS.order;

// ── ONE-OFFS: a scene on about two blocks in three, never the same one within two blocks of another
export const ONE_OFFS = [['yardSale', 3], ['party', 2], ['carBlocks', 3], ['moving', 2], ['lemonade', 2], ['carWash', 2], ['fixer', 2], ['treeDown', 2], ['camping', 1], ['sprinklerFun', 2], ['hotrod', 1], ['xmas', 1]];
// the one-offs' hand-painted words: each used once in the district (the audit's sign-repeat check)
const TEXTS = { yardSale: ['YARD SALE', 'GARAGE SALE/SAT 8AM', 'MOVING SALE', 'EVERYTHING/$1', 'ESTATE SALE', 'SALE TODAY', 'TOYS 50¢', 'NO EARLY/BIRDS'],
  lemonade: ['LEMONADE/25¢', 'ICE COLD/LEMONADE', 'LEMONADE/50¢', 'FRESH/LEMONADE', 'LEMONADE/+ COOKIES', 'LEMONADE/$1'] }, count = {};
// what a scene needs from its lot: the drive's length (m) for the ones staged on it, the front lawn's or the back yard's depth for the rest
const FIT = { carBlocks: s => drv(s) >= 4.9, carWash: s => drv(s) >= 4.9, hotrod: s => drv(s) >= 4.9, fixer: s => drv(s) >= 4.9, moving: s => drv(s) >= 7.2, yardSale: s => drv(s) >= 3.4, party: s => drv(s) >= 3,
  camping: s => (s.D10 - layoutOf(s).body[3]) / 10 >= 3.3, lemonade: s => lawn(s) >= 1.8, sprinklerFun: s => lawn(s) >= 1.8, treeDown: s => lawn(s) >= 1.6, xmas: s => lawn(s) >= 1.8 };
const drv = s => { const d = layoutOf(s).drive; return (d[3] - d[1]) / 10; }, lawn = s => (layoutOf(s).body[1] - frontDepth(s)) / 10;
export const frontDepth = s => { const L = layoutOf(s); return L.porch === 'enclosed' ? 34 : L.porch === 'porch' || L.porch === 'deck' ? (s.type === 'bungalow' ? 28 : s.type === 'hip' ? 22 : 26) : s.type === 'split' ? 11 : 17; };
(function assignOneOffs() {
  const blocks = [...new Set(HOUSE_LOTS.map(l => l.i + ',' + l.j))].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]), placed = [];
  for (const [i, j] of blocks) {
    if (hash(i * 31 + 7, j * 17 + 3, 611) > .68 || (i === 0 && j === 5)) continue;   // (0,5: the corner store's block has its own scene)
    const near = placed.filter(p => Math.abs(p.i - i) + Math.abs(p.j - j) <= 2).map(p => p.kind), lots = HOUSE_LOTS.filter(l => l.i === i && l.j === j).map(specOf);
    let kind = null, s = null; for (let t = 0; t < 6 && !s; t++) { kind = pickX(hash(i * 13 + 1 + t * 101, j * 29 + 5, 613), ONE_OFFS, near.concat(t ? [kind] : []));
      const ok = lots.filter(q => FIT[kind](q)); if (ok.length) s = ok[Math.min(ok.length - 1, (hash(i, j, 617) * ok.length) | 0)]; }
    if (!s) continue;
    s.oneOff = kind; placed.push({ i, j, kind }); if (kind === 'xmas') s.lights = true; if (TEXTS[kind]) s.oneOffText = TEXTS[kind][(count[kind] = (count[kind] ?? -1) + 1) % TEXTS[kind].length];
  }
})();

// ── ROOF BILLBOARDS (the shared signage system's boards, allocated per block): on a few flat-roofed two-families facing the avenue and
// Jackson St, never two within 170 m (the roof boards' repeat radius is 160 m). Their designs lean to the suburbs' flavour.
(function assignBillboards() { const got = [];
  for (const s of SPECS.order) { if (s.type !== 'twofam' || (s.street !== 'Union Ave' && s.street !== 'Jackson St')) continue; const b = layoutOf(s).body; if (b[2] - b[0] < 70 || hash(s.seed, 5, 811) > .6) continue;
    const c = unshift(s.l.x0 + s.l.sx / 2, s.l.z0 + s.l.sz / 2); if (got.some(g => Math.hypot(g[0] - c[0], g[1] - c[1]) < 170)) continue; s.billboard = true; got.push(c); if (got.length >= 3) break; } })();

// ── THE LAYOUT of a lot (voxels, lot-local): the house's parts, the drive, the path, the door; memoised on the spec
export const FLOOR = 3, STOREY = 28;   // the ground floor 0.3 m up (the sim's door opening is 0.3 m up), 2.8 m storeys
export function layoutOf(s) {
  if (s._lay) return s._lay;
  const T = TYPES[s.type], W = s.W10, D = s.D10, m = 4, dw = 28, R = s.driveSide === 'R', h = k => hash(s.seed, k, 337);
  const range = ([a, b], k) => Math.round(a + h(k) * (b - a));
  // the front yard is at least the porch and its steps plus a metre of lawn
  const need = (s.porch === 'enclosed' ? 34 : s.porch === 'porch' || s.porch === 'deck' ? (s.type === 'bungalow' ? 28 : s.type === 'hip' ? 22 : 26) : 17) + 10;
  const set = Math.max(s.set, need);
  let bodyD = Math.max(42, Math.min(range(T.d, 1), D - set - 22)), gw = 0, garage = s.garage;
  const lay = { parts: [], drive: null, garage: null, carport: null, door: 0, body: null };
  // the body's u-range: the full width less the margins and the drive (or the garage beside it)
  const side = garage === 'attached' ? 32 : garage === 'carport' ? 30 : garage === 'under' ? 0 : garage === 'back' ? dw + 12 : dw + 4;
  let bw = Math.min(range(T.w, 2), W - 2 * m - side); if (bw < 48) { garage = 'none'; bw = Math.min(range(T.w, 2), W - 2 * m - dw - 4); }
  const free = W - 2 * m - side - bw, slack = Math.round(free * (.3 + h(3) * .4));
  let b0 = R ? m + slack : W - m - bw - slack; if (garage === 'under') b0 = Math.round((W - bw) / 2);
  const b1 = b0 + bw, v0 = set, v1 = set + bodyD;
  lay.body = [b0, v0, b1, v1]; lay.garageKind = garage; lay.set = set;
  if (garage === 'attached') { const gOff = [0, -4, 6, 10][(h(4) * 4) | 0], gd = Math.min(bodyD - 4, 56), g0 = R ? b1 : b0 - 32; lay.garage = [g0, v0 + gOff, g0 + 32, v0 + gOff + gd];
    lay.drive = [g0 + 2, 0, g0 + 30, v0 + gOff]; }
  else if (garage === 'carport') { const g0 = R ? b1 : b0 - 30; lay.carport = [g0, v0 + 2, g0 + 30, Math.min(D - 8, v0 + 52)]; lay.drive = [g0 + 3, 0, g0 + 27, lay.carport[3]]; }
  else if (garage === 'back') { const g0 = R ? W - m - 30 : m, gd = 46; lay.garage = [g0, D - 6 - gd, g0 + 30, D - 6]; lay.drive = [g0 + 1, 0, g0 + 29, D - 6 - gd]; lay.detached = true; }
  else if (garage === 'under') { const gu = R ? b1 - 32 : b0 + 4; lay.under = [gu, gu + 28]; lay.drive = [gu, 0, gu + 28, v0]; }
  else { const g0 = R ? W - m - dw : m; lay.drive = [g0, 0, g0 + dw, Math.min(D - 10, v0 + Math.round(bodyD * .8))]; }
  // the front door (u of its centre), by type
  const c = (b0 + b1) >> 1, towardG = R ? 1 : -1;
  lay.door = s.type === 'hip' ? c + towardG * 10 : s.type === 'gablefront' || s.type === 'twofam' ? (R ? b0 + 16 : b1 - 16) : s.type === 'ranch' ? c + towardG * 14
    : s.type === 'split' ? (R ? b0 + 40 : b1 - 40) : c;
  if (garage === 'under' && Math.abs(lay.door - (lay.under[0] + lay.under[1]) / 2) < 30) lay.door = R ? b0 + 16 : b1 - 16;
  if (garage === 'under') { const pl = s.porch === 'enclosed' ? 16 : 12, pr = 16, [g0, , g1] = lay.drive;
    if (lay.door - pl < g1 + 2 && lay.door + pr > g0 - 2) { lay.porch = 'stoop'; lay.door = R ? Math.max(b0 + 14, Math.min(lay.door, g0 - 2 - pr)) : Math.min(b1 - 14, Math.max(lay.door, g1 + 2 + 12)); } }
  lay.porch ??= s.porch;
  lay.skipSide = garage === 'attached' ? (R ? 'right' : 'left') : null;   // (no side windows behind an attached garage)
  // the FOR RENT sign spot (the sim-state layer's lawn sign, 2.2 m wide): in the front lawn, clear of the drive and the path
  const busy = [[lay.drive[0] - 14, lay.drive[2] + 14], [lay.door - 20, lay.door + 20]], open = u => busy.every(([a, b2]) => u < a || u > b2);
  let su = [18, W - 18, 30, W - 30, (W >> 1)].find(open); if (su === undefined) su = lay.door < W / 2 ? W - 16 : 16;
  lay.sign = [su, 9];
  // the mailbox: at the lot line beside the drive (in the fence's gap), on the side away from the house
  lay.mail = s.mailbox === 'wall' ? null : [R ? lay.drive[0] - 8 : lay.drive[2] + 8, 5];
  return (s._lay = lay);
}
