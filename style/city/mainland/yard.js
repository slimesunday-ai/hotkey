// MAINLAND · THE YARD KIT (house builder v1, 2026-10-06). Worker-safe (no three, no DOM): houses.js stamps from it in the workers, the
// builder (builder.js) draws the same pieces on the page and runs the same rules. Everything is in the LOT's local frame, metres: x across
// the frontage (+x is the right as seen from the street), z from the front lot line (0) back into the lot (negative), as houses.js.
//   YARD           the yard pieces: id → { name, tag, flex, variants (the make() arguments), make(...args) → a prop bank }
//   EDGES          fence and hedge styles for the lot's edge runs; RUNS the six runs (front, the two sides split at the house front, back)
//   PATHS          path and driveway materials, painted on the 0.5 m grid
//   KIT            the house kit: the eight styles, what each one takes (garage, porch, dormers, pool, accent…), the palettes
//   houseRects / fitBand / autoPaths / blocked …   setbacks, the allowed band along the frontage, the rules for the yard grid
import { mailbox, flamingos, gnomes, toys, bin, planter, trampoline, lemonade, tree, swingset, birdbath, garden, barn, playhouse, clothesline,
  doghouse, pool as agPool, patio, woodpile, firepit, windmill, bouncy, statue, lantern } from '../districts/suburbs/props.js';
import { acBox, lawnChair, grill, umbrella, bike } from '../props.js';
import { vehicleProp } from '../vehicles/index.js';
import { Vol, meshed, stamp } from '../vox.js';

export const CELL = .5;
const SHED = [0xc9c3b6, 0xe6e1d6, 0xa7a9b1, 0xe8232a, 0x9b4f3a];
const memo = new Map();
// the sprinkler: the head alone (MAINLAND FIXES 2026-10-06: its water is animated, sprinklers.js, and you walk through it). Its block on
// the grid is still the spray's reach (ext: the old fan's box), so nothing is put down in the water and saved yards keep their places.
function sprinklerOn() { if (memo.has('sprk')) return memo.get('sprk'); const V = new Vol(3, 3, 3, { s: .1, org: [-.15, 0, -.15] });
  V.box(0, 0, 0, 3, 1, 3, 0xe8232a); V.set(1, 1, 1, 0x8a9099, 2); V.set(1, 2, 1, 0x8a9099, 2);
  const out = meshed(V); out.ext = [-3, -3.1, 3, 3]; memo.set('sprk', out); return out; }
export const SPRINKLER_TOP = .3;   // the head's top (the spinner turns on it)
// cars (the drive): [vehicle id, variant], and what each one is worth to the flex readout
export const CARS = [['sedan', 7], ['pickup', 1], ['beater', 2], ['sedan', 3], ['supercar', 1], ['lowrider', 3], ['livery', 2], ['supercar', 5]];
const CAR_FLEX = { sedan: 2, pickup: 2, beater: 1, supercar: 9, lowrider: 7, livery: 5 };
export const SHOWCARS = [['lowrider', 2], ['supercar', 4], ['supercar', 1], ['lowrider', 3], ['livery', 2], ['supercar', 5]];

// tag: the tray's tab · flex: curb appeal points (the visit readout; not a price, nothing is bought) · drive: may stand on the driveway
export const YARD = {
  pool:        { name: 'Pool', tag: 'fun', flex: 9, variants: [[0], [1]], make: v => agPool(v) },
  trampoline:  { name: 'Trampoline', tag: 'fun', flex: 6, variants: [[0], [1], [2]], make: v => trampoline(v) },
  swingset:    { name: 'Swing set', tag: 'fun', flex: 5, variants: [[0], [1]], make: v => swingset(v) },
  playhouse:   { name: 'Playhouse', tag: 'fun', flex: 5, variants: [[0], [1]], make: v => playhouse(v) },
  bouncy:      { name: 'Bouncy castle', tag: 'fun', flex: 7, variants: [[0], [1]], make: v => bouncy(v) },
  lemonade:    { name: 'Lemonade stand', tag: 'fun', flex: 3, variants: [[]], make: () => lemonade() },
  firepit:     { name: 'Fire pit', tag: 'hang', flex: 4, variants: [[]], make: () => firepit() },
  grill:       { name: 'Grill', tag: 'hang', flex: 3, variants: [[]], make: () => grill() },
  chair:       { name: 'Lawn chair', tag: 'hang', flex: 1, variants: [[0x2de2e6], [0xff4fa3], [0xffe23a], [0x14a83b]], make: c => lawnChair(c) },
  umbrella:    { name: 'Umbrella', tag: 'hang', flex: 2, variants: [[0xffe23a], [0xff4fa3], [0x2de2e6]], make: c => umbrella(c) },
  patio:       { name: 'Patio set', tag: 'hang', flex: 4, variants: [[0xe8232a, 0], [0xe8232a, 1], [0x2f5bff, 0]], make: (c, v) => patio(c, v) },
  garden:      { name: 'Veggie garden', tag: 'garden', flex: 3, variants: [[0], [1]], make: v => garden(v) },
  tree:        { name: 'Tree', tag: 'garden', flex: 3, variants: [['oak', 1, 2], ['maple', 1, 2], ['blossom', 1, 0], ['birch', 1, 1], ['redmaple', 1, 2], ['oak', 2, 1], ['maple', 2, 0]], make: (sp, s, v) => tree(sp, s, v) },
  planter:     { name: 'Planter', tag: 'garden', flex: 1, variants: [[0xe8232a, 0], [0xff4fa3, 2], [0x17171b, 1]], make: (c, f) => planter(c, f) },
  birdbath:    { name: 'Birdbath', tag: 'garden', flex: 2, variants: [[]], make: () => birdbath() },
  sprinkler:   { name: 'Sprinkler', tag: 'garden', flex: 1, variants: [[]], make: () => sprinklerOn() },
  windmill:    { name: 'Windmill', tag: 'garden', flex: 2, variants: [[0], [1]], make: v => windmill(v) },
  statue:      { name: 'Lawn statue', tag: 'garden', flex: 4, variants: [[]], make: () => statue() },
  barn:        { name: 'Barn shed', tag: 'sheds', flex: 5, variants: SHED.flatMap(c => [[c, 0], [c, 1]]), make: (c, v) => barn(c, v) },
  doghouse:    { name: 'Doghouse', tag: 'sheds', flex: 2, variants: [[0xc9c3b6], [0xe8232a], [0x9b4f3a]], make: c => doghouse(c) },
  clothesline: { name: 'Clothesline', tag: 'sheds', flex: 1, variants: [[0], [1], [2]], make: v => clothesline(v) },
  woodpile:    { name: 'Woodpile', tag: 'sheds', flex: 1, variants: [[0], [1]], make: v => woodpile(v) },
  ac:          { name: 'AC unit', tag: 'sheds', flex: 0, variants: [[]], make: () => acBox() },
  bins:        { name: 'Bin', tag: 'sheds', flex: 0, curb: true, variants: [[0x2f7a3a], [0x2f5bff]], make: c => bin(c) },
  mailbox:     { name: 'Mailbox', tag: 'front', flex: 1, curb: true, variants: [['post', 0xe8232a, 1], ['brick', 0x2f5bff], ['novelty', 0xe8232a], ['post', 0x14a83b], ['post', 0xffc21a]], make: (k, c, f) => mailbox(k, c, f) },
  flamingos:   { name: 'Flamingos', tag: 'front', flex: 2, variants: [[0], [1]], make: v => flamingos(v) },
  gnomes:      { name: 'Gnomes', tag: 'front', flex: 2, variants: [[0], [1], [2]], make: v => gnomes(v) },
  lantern:     { name: 'Lantern', tag: 'front', flex: 1, variants: [[]], make: () => lantern() },
  toys:        { name: 'Toys', tag: 'front', flex: 1, variants: [[0], [1], [2]], make: v => toys(v) },
  bike:        { name: 'Bike', tag: 'front', flex: 1, variants: [[0xff4fa3], [0x2f5bff], [0xffc21a]], make: c => bike(c) },
  car:         { name: 'Car', tag: 'ride', flex: 2, drive: true, variants: CARS, make: (id, v) => vehicleProp(id, { variant: v | 0, kind: 'car' }) },
};
export const TAGS = [['fun', 'Fun'], ['hang', 'Hang out'], ['garden', 'Garden'], ['sheds', 'Sheds'], ['front', 'Front yard'], ['ride', 'Ride']];
export const argsOf = it => it.a ?? YARD[it.id]?.variants[it.v | 0] ?? YARD[it.id]?.variants[0] ?? [];
export const bankOf = it => YARD[it.id].make(...argsOf(it));
export const flexOf = it => it.id === 'car' ? CAR_FLEX[argsOf(it)[0]] ?? 2 : YARD[it.id]?.flex ?? 0;

// ── a piece's footprint: its bank's vertices turned by r (stampA's convention), as an axis-aligned box; the block of grid cells it takes
const boxMemo = new Map();
export function rotBox(bank, r, key) { const k = key && key + '|' + r.toFixed(3); if (k && boxMemo.has(k)) return boxMemo.get(k);
  const c = Math.cos(r), s = Math.sin(r); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  const pt = (px, pz) => { const x = px * c + pz * s, z = -px * s + pz * c; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; };
  if (bank.ext) { const [a, b, e, f] = bank.ext; pt(a, b); pt(e, b); pt(a, f); pt(e, f); }   // (a piece whose block is set, not measured: the sprinkler)
  else for (const O of bank.L) { const P = O.P.a; for (let i = 0; i < O.P.n; i += 3) pt(P[i], P[i + 2]); }
  if (x0 > x1) x0 = x1 = z0 = z1 = 0;
  const out = { x0, x1, z0, z1, cw: Math.max(1, Math.ceil((x1 - x0) / CELL - .02)), cd: Math.max(1, Math.ceil((z1 - z0) / CELL - .02)) }; if (k) boxMemo.set(k, out); return out; }
export const keyOf = it => it.id + ':' + JSON.stringify(argsOf(it));
export const boxOf = it => rotBox(bankOf(it), it.r ?? 0, keyOf(it));
// where to stamp a piece so its turned box sits centred in its block (x, z = the block's min corner)
export function stampAt(it) { const b = boxOf(it); return [it.x + b.cw * CELL / 2 - (b.x0 + b.x1) / 2, it.z + b.cd * CELL / 2 - (b.z0 + b.z1) / 2]; }
export function cellsOf(it) { const b = boxOf(it), out = []; for (let i = 0; i < b.cw; i++) for (let j = 0; j < b.cd; j++) out.push([+(it.x + i * CELL).toFixed(2), +(it.z + j * CELL).toFixed(2)]); return out; }
const snap = v => Math.round(v / CELL) * CELL;
// a generated piece (stamped at sx, sz turned r) → an item on the grid (its block snapped to the nearest cells)
export function itemFrom(id, args, sx, sz, r) { const Y = YARD[id]; if (!Y) return null; let v = Y.variants.findIndex(a => JSON.stringify(a) === JSON.stringify(args));
  const it = { id, v: Math.max(0, v), r: +(r || 0).toFixed(3) }; if (v < 0) it.a = args; const b = boxOf(it);
  it.x = snap(sx + (b.x0 + b.x1) / 2 - b.cw * CELL / 2); it.z = snap(sz + (b.z0 + b.z1) / 2 - b.cd * CELL / 2); return it; }

// ── the lot: its corners in the lot frame (FL, FR, BR, BL), convex
export function inPoly(P, x, z) { let sg = 0; for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], c = (bx - ax) * (z - az) - (bz - az) * (x - ax);
  if (Math.abs(c) < 1e-9) continue; const s = c > 0 ? 1 : -1; if (!sg) sg = s; else if (s !== sg) return false; } return true; }
// the lot's edges pulled in by m (a point is ≥ m from every edge)
export function edgeDist(P, x, z) { let d = 1e9; for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, bz - az) || 1;
  d = Math.min(d, Math.abs((bx - ax) * (z - az) - (bz - az) * (x - ax)) / L); } return inPoly(P, x, z) ? d : -d; }
export const cellIn = (P, x, z, m) => edgeDist(P, x, z) >= m && edgeDist(P, x + CELL, z) >= m && edgeDist(P, x, z + CELL) >= m && edgeDist(P, x + CELL, z + CELL) >= m;
// a ground cell for a path or the drive: clear of the sides and the back by m, but it may run right up to the front lot line (and on to the curb)
export function cellOnLot(P, x, z, m) { for (const [cx, cz] of [[x, z], [x + CELL, z], [x, z + CELL], [x + CELL, z + CELL]]) { if (!inPoly(P, cx, Math.min(cz, -1e-3))) return false;
    for (let k = 1; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, bz - az) || 1; if (Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / L < m) return false; } }
  return z + CELL <= 1e-6; }
export const lotPoly = (rect, corners) => { const c = Math.cos(rect.rot), s = Math.sin(rect.rot), L = corners.map(([x, z]) => { const dx = x - rect.x, dz = z - rect.z; return [dx * c - dz * s, dx * s + dz * c]; });
  const fr = [...L].sort((a, b) => b[1] - a[1]), F = fr.slice(0, 2).sort((a, b) => a[0] - b[0]), B = fr.slice(2).sort((a, b) => a[0] - b[0]); return [F[0], F[1], B[1], B[0]]; };

// ── CLEARANCE (MAINLAND FIXES 2026-10-06 · slime: "the trees are clipping a bit through the fence because they are too close"): a piece's
// WHOLE footprint (every vertex, turned: a tree's crown as well as its trunk, an umbrella's canopy) keeps CLEAR inside every lot line.
// The runs stand within 0.5 m of the lines and a hedge is 0.7 m thick, so 0.95 m keeps a piece out of the fence, the hedge and the
// neighbour's lot. hullOf: the footprint's outline (the convex hull of the turned vertices, memoised per piece and turn).
export const CLEAR = .95;
const hullMemo = new Map();
export function hullOf(bank, r = 0, key) { const k = key && key + '|' + (+r).toFixed(3); if (k && hullMemo.has(k)) return hullMemo.get(k);
  const c = Math.cos(r), s = Math.sin(r), seen = new Set(), P = [];
  for (const O of bank.L) { const A = O.P.a; for (let i = 0; i < O.P.n; i += 3) { const x = Math.round((A[i] * c + A[i + 2] * s) * 100) / 100, z = Math.round((-A[i] * s + A[i + 2] * c) * 100) / 100, q = x + ',' + z; if (!seen.has(q)) { seen.add(q); P.push([x, z]); } } }
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const out = P.length < 3 ? P : lo.slice(0, -1).concat(hi.slice(0, -1)); if (k) hullMemo.set(k, out); return out; }
export const hullItem = it => hullMemo.get(keyOf(it) + '|' + (+(it.r ?? 0)).toFixed(3)) ?? hullOf(bankOf(it), it.r ?? 0, keyOf(it));
// the lot's lines with their inward normals (lot frame: the corners FL, FR, BR, BL)
const linesOf = poly => poly.map((a, k) => { const b = poly[(k + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0], a[1], (b[1] - a[1]) / L, -(b[0] - a[0]) / L]; });
// the least distance from an outline stamped at (x, z) to the lot's lines (negative: over a line, into the street or the neighbour's)
export function clearOf(poly, hull, x, z) { let m = 1e9; for (const [ax, az, nx, nz] of linesOf(poly)) for (const [hx, hz] of hull) m = Math.min(m, (x + hx - ax) * nx + (z + hz - az) * nz); return m; }
// where an outline meant for (x, z) stands clear of every line by `need`: pushed straight in from each line it's too near (a few passes
// for a pie lot's converging sides). → [x, z, clear] (clear < need: the lot is too narrow there for it)
export function clearSpot(poly, hull, x, z, need = CLEAR) { const Ls = linesOf(poly);
  for (let it = 0; it < 8; it++) { let moved = false;
    for (const [ax, az, nx, nz] of Ls) { let m = 1e9; for (const [hx, hz] of hull) m = Math.min(m, (x + hx - ax) * nx + (z + hz - az) * nz); if (m < need - 1e-4) { x += nx * (need - m); z += nz * (need - m); moved = true; } }
    if (!moved) break; }
  return [x, z, clearOf(poly, hull, x, z)]; }

// ── fences and hedges: six runs round the lot (the sides split where the house front is), each one style
export const EDGES = {
  none:   { name: 'Open', h: 0 },
  picket: { name: 'White picket', h: .9, draw: 'picket' },
  board:  { name: 'Board fence', h: 1.6, draw: 'board', cols: [0xd9c7a4, 0xf4f1ea, 0xc9c3b6, 0xb98b57, 0x8fd3c8, 0xffb3c7] },
  hedge:  { name: 'Hedge', h: 1.3, draw: 'hedge' },
  tall:   { name: 'Tall hedge', h: 1.6, draw: 'hedge' },
  low:    { name: 'Low hedge', h: .7, draw: 'hedge' },
};
export const RUN_NAMES = { F: 'the front', LF: 'the left front', LB: 'the left side', RF: 'the right front', RB: 'the right side', B: 'the back' };
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const inset = (p, c, d) => { const dx = c[0] - p[0], dz = c[1] - p[1], l = Math.hypot(dx, dz) || 1; return [p[0] + dx / l * d, p[1] + dz / l * d]; };
// hf: the house front (z, lot frame) where the side runs split; the same points the generated yard pass uses
export function runsOf(poly, hf) { const [FL, FR, BR, BL] = poly, c = poly.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const at = (P0, P1, z) => lerp2(P0, P1, Math.max(0, Math.min(1, (z - P0[1]) / (P1[1] - P0[1])))), fz = hf + .4;
  return { F: [inset(FL, c, .5), inset(FR, c, .5)], LF: [inset(FL, c, .5), inset(at(FL, BL, fz), c, .5)], LB: [inset(at(FL, BL, fz), c, .3), inset(BL, c, .45)],
    RF: [inset(FR, c, .5), inset(at(FR, BR, fz), c, .5)], RB: [inset(at(FR, BR, fz), c, .3), inset(BR, c, .45)], B: [inset(BL, c, .45), inset(BR, c, .45)] }; }

// ── paths and the driveway: one material per 0.5 m cell; a cell on the front row runs on over the verge to the curb
export const PATHS = { conc: { name: 'Concrete walk', c: 0xdcd6c9 }, brick: { name: 'Brick path', c: 0xb4553c }, stone: { name: 'Stepping stones', c: 0xb9b3a8 }, drive: { name: 'Driveway', c: 0xd8d1c3 } };

// ── THE HOUSE KIT: the eight styles and what each one takes. Every option has a default that reproduces the generated house.
export const WALLS = { coral: 0xff8a5c, butter: 0xffd23f, sky: 0x58b7f7, mint: 0x3fd0a0, lilac: 0xa57cff, pink: 0xff6fae, white: 0xf4f1ea, teal: 0x12b3a0, orange: 0xff7a1a, peach: 0xffb38a, seafoam: 0x8fe3c8, cobalt: 0x2f5bff };
export const ROOFS = { choc: 0x6e5244, slate: 0x62656f, char: 0x4f4e57, warm: 0x8c7568, grey: 0x8f8e96, brick: 0x9b4a3a, teal: 0x2f7f7a, forest: 0x4c7a46 };
export const ACCENTS = { orange: 0xff7a1a, yellow: 0xffe23a, pink: 0xff4fa3, red: 0xe8232a, blue: 0x2f5bff, green: 0x14a83b, teal: 0x12b3a0 };
export const SHOWS = { none: 'Nothing', trophy: 'Gold trophy', flamingo: 'Giant flamingo', dish: 'Satellite dish', vane: 'Weathervane', star: 'Lucky star' };
export const KIT = {
  springfield: { name: 'The Springfield', blurb: 'two storeys, hip roof, the hoop over the garage', roof: 'choc', wall: 'coral', garage: ['door', 'glass', 'none'], porch: 'Portico', hoop: true },
  trophy:      { name: 'The Trophy House', blurb: 'white box, cantilevered upstairs, roof deck', wall: 'white', accent: 'blue', pool: true, show: 'trophy', flat: true },
  cape:        { name: 'The Cape', blurb: 'storey and a half, dormers, shutters', roof: 'slate', wall: 'butter', dormers: [2, 3, 0], accent: 'green' },
  porch:       { name: 'The Gable-Front', blurb: 'gable to the street, a porch with a swing', roof: 'char', wall: 'sky', porch: 'Front porch' },
  ranch:       { name: 'The Ranch', blurb: 'long and low, picture window, carport', roof: 'warm', wall: 'mint', garage: ['carport', 'none'], carportCar: true },
  gambrel:     { name: 'The Gambrel', blurb: 'Dutch barn roof, garage wing', roof: 'grey', wall: 'lilac', garage: ['door', 'glass', 'none'], dormers: [1, 0], hoop: true },
  slab:        { name: 'The Slab', blurb: 'flat roof over a glass garage, a pool out back', wall: 'white', accent: 'orange', flat: true, garage: ['glass', 'none'] },
  butterfly:   { name: 'The Butterfly', blurb: 'butterfly roof, clerestory glass, the lowrider', wall: 'teal', accent: 'yellow', flat: true, garage: ['glass', 'none'] },
};
export const STYLES = Object.keys(KIT);
// the house's own spec in a lot: style, colours, options, and where it sits (hx along the frontage, hz deeper into the lot)
export function defaultHouse(style, o = {}) { const K = KIT[style];
  return { style, wall: o.wall ?? K.wall, roof: K.roof ?? null, accent: K.accent ?? null, garage: K.garage ? (o.glass && K.garage.includes('glass') ? 'glass' : K.garage[0]) : null, porch: K.porch ? true : null,
    dormers: K.dormers ? K.dormers[0] : null, hoop: K.hoop ? true : null, pool: K.pool ? true : null, show: K.show ?? 'none', car: o.car ?? (style === 'slab' ? ['supercar', 0] : style === 'butterfly' ? ['lowrider', 1] : o.glass ? SHOWCARS[0] : K.carportCar ? ['pickup', 3] : SHOWCARS[0]), hx: o.hx ?? 0, hz: 0 }; }
// does this house take a car (a glass garage's show car, the ranch's carport)?
export const takesCar = H => H.garage === 'glass' || (H.garage === 'carport');

// the house's footprint (walls, roofs' overhangs, porches, steps; its own pool), in the house's frame, before the shift
const FOOT = {
  springfield: H => [[-9.6, -16.4, 2.9, -5.3], ...(H.garage !== 'none' ? [[2.2, -15.3, 9.5, -6.2]] : [])],
  trophy: H => [[-4.5, -17.4, 9.5, -6.6], ...(H.pool !== false ? [[-10.4, -18.1, -3.3, -8.7]] : [])],
  cape: () => [[-6.9, -15.4, 6.9, -5.5]],
  porch: H => [[-5.8, -17.9, 4.8, H.porch === false ? -6.5 : -5.3]],
  ranch: H => [[-10, -15.5, 3.5, -5.5], ...(H.garage !== 'none' ? [[3, -15.3, 9.8, -6.6]] : [])],
  gambrel: H => [[-4.8, -16.4, 7.5, -6.0], ...(H.garage !== 'none' ? [[-10.5, -15.3, -4.5, -6.5]] : [])],
  slab: H => [[-9.2, -23.2, H.garage === 'none' ? 4.2 : 9.2, -2.8]],
  butterfly: H => [[H.garage === 'none' ? -9.6 : -9.8, -22.4, H.garage === 'none' ? 5.4 : 9.8, -2.4]],
};
// the drive (x range, from z to the street) and the front walk (x range, from z) in the house's frame
export const DRIVE = { springfield: H => H.garage === 'none' ? null : [3.1, 8.6, -6.2], trophy: () => [4.6, 9.2, -6.6], cape: () => [7, 10, -12], porch: () => [5.5, 9, -14],
  ranch: H => H.garage === 'none' ? [4.2, 7.8, -9] : [3.6, 9, -15], gambrel: H => H.garage === 'none' ? [-9.6, -6.2, -9] : [-9.7, -5, -6.5], slab: H => H.garage === 'none' ? [5, 8, -6] : [3.8, 8.4, -2.8], butterfly: H => H.garage === 'none' ? [6, 8.5, -6] : [4.8, 9.2, -2.4] };
export const WALK = { springfield: [-4.3, -3.1], trophy: [1.4, 2.6], cape: [-.6, .6], porch: [-1.6, -.4], ranch: [-3.6, -2.4], gambrel: [1.1, 2.3], slab: null, butterfly: null };
export const SETBACK = { front: 2, side: 1, back: 1 };
export const houseRects = H => FOOT[H.style](H).map(([x0, z0, x1, z1]) => [x0 + H.hx, z0 + H.hz, x1 + H.hx, z1 + H.hz]);
export function fits(poly, H) { for (const [x0, z0, x1, z1] of houseRects(H)) { if (z1 > -SETBACK.front) return false; const s = SETBACK.side, b = SETBACK.back;
    for (const [x, z] of [[x0 - s, z0 - b], [x1 + s, z0 - b], [x1 + s, z1], [x0 - s, z1]]) if (!inPoly(poly, x, z)) return false; } return true; }
// the band the house may slide along the frontage: the shallowest depth where it fits, and the x range there (null: it doesn't fit)
export function fitBand(poly, H) { for (let hz = 0; hz >= -12; hz -= CELL) { let lo = null, hi = null;
    for (let hx = -14; hx <= 14 + 1e-6; hx += CELL) if (fits(poly, { ...H, hx, hz })) { if (lo === null) lo = hx; hi = hx; }
    if (lo !== null) return { hz, lo, hi }; } return null; }
// the first configuration of a style that fits this lot: as asked, then with the garage (or carport) off, then without the pool
export function fitStyle(poly, H) { const K = KIT[H.style], tries = [H, ...(K.garage ?? []).filter(g => g !== H.garage).map(g => ({ ...H, garage: g })), ...(K.pool ? [{ ...H, pool: false }, { ...H, pool: false, garage: K.garage?.at(-1) ?? H.garage }] : [])];
  for (const T of tries) { const b = fitBand(poly, T); if (b) return { H: { ...T, hz: b.hz, hx: Math.max(b.lo, Math.min(b.hi, T.hx)) }, band: b }; } return null; }
export const houseFront = H => Math.max(...houseRects(H).map(r => r[3]));
// the door: a clear patch in front of it (no pieces), the walk from it
export function doorZone(H) { const w = WALK[H.style]; if (!w) return null; const f = Math.max(...houseRects(H).filter(r => r[0] - H.hx <= w[0] && r[2] - H.hx >= w[1]).map(r => r[3]), houseFront(H) - 3);
  return [w[0] + H.hx - .4, f, w[1] + H.hx + .4, f + 1.6]; }
// the auto drive and walk for a house (cells), clipped to the lot and kept off the house
export function autoPaths(poly, H) { const out = [], rects = houseRects(H), d = DRIVE[H.style](H), w = WALK[H.style], key = new Set();
  const add = (x, z, m) => { x = +x.toFixed(2); z = +z.toFixed(2); const k = x + ',' + z; if (key.has(k) || !cellOnLot(poly, x, z, .1)) return;
    if (rects.some(r => x < r[2] && x + CELL > r[0] && z < r[3] && z + CELL > r[1])) return; key.add(k); out.push([x, z, m]); };
  if (d) { const x0 = Math.round((d[0] + H.hx) / CELL) * CELL, x1 = Math.round((d[1] + H.hx) / CELL) * CELL; for (let x = x0; x < x1 - 1e-6; x += CELL) for (let z = -CELL; z >= Math.floor((d[2] + H.hz) / CELL) * CELL - 1e-6; z -= CELL) add(x, z, 'drive'); }
  if (w) { const c = Math.round(((w[0] + w[1]) / 2 + H.hx) / CELL) * CELL, f = doorZone(H)[1]; for (let z = -CELL; z >= Math.floor(f / CELL) * CELL - 1e-6; z -= CELL) { add(c - CELL, z, 'conc'); add(c, z, 'conc'); } }
  return out; }
// ── THE HOUSE'S FRONT, KEPT CLEAR OF TREES (MAINLAND FIXES follow-up, 2026-10-06): the door's corridor to the street, the front walk,
// the drive's mouth, and the middle of the facade to the street (its sight line), and a strip right against the facade. [x0, z0, x1, z1, k]
// in the lot frame; a tree's crown (its reach × k) mustn't reach into one. houses.js keeps the generated trees out; okAt the builder's.
export function frontKeep(H) { const b = houseRects(H)[0], out = [], dz = doorZone(H), d = DRIVE[H.style]?.(H), w = WALK[H.style];
  if (dz) out.push([dz[0] - .8, dz[1] - .2, dz[2] + .8, 1.5, 1]);
  if (w) out.push([w[0] + H.hx - .4, b[3], w[1] + H.hx + .4, 1.5, 1]);
  if (d) out.push([d[0] + H.hx - .3, Math.max(d[2] + H.hz, -3.5), d[1] + H.hx + .3, 1.5, 1]);
  const porch = H.style === 'porch' && H.porch !== false, m = porch ? 0 : Math.min(.8, (b[2] - b[0]) / 4);   // (a full-width porch: all of it)
  out.push([b[0] + m, b[3], b[2] - m, 1.5, porch ? .9 : .75], [b[0], b[3], b[2], b[3] + 1.2, .9]);
  return out; }
export const circleRect = (x, z, r, [x0, z0, x1, z1]) => { const dx = x - Math.max(x0, Math.min(x, x1)), dz = z - Math.max(z0, Math.min(z, z1)); return dx * dx + dz * dz < r * r; };
export const inFront = (H, x, z, reach) => frontKeep(H).some(k => circleRect(x, z, reach * k[4], k));
// ── the yard grid's rules: a piece's cells must be in the lot (clear of the fences), off the house, the paths, the drive (a car may
// park on it), the door's patch and every other piece
export function blockedFor(lot, it, others) { const occ = new Set(), drive = new Set(), path = new Set();
  for (const [x, z, m] of lot.yard.paths) (m === 'drive' ? drive : path).add(x + ',' + z);
  for (const o of others) for (const [x, z] of cellsOf(o)) occ.add(x + ',' + z);
  return (x, z) => { const k = (+x.toFixed(2)) + ',' + (+z.toFixed(2)); if (occ.has(k) || path.has(k)) return true; if (drive.has(k) && !YARD[it.id]?.drive) return true; return false; }; }
export function okAt(lot, poly, it, others, rects, door) { const bl = blockedFor(lot, it, others);
  const curb = YARD[it.id]?.curb, car = YARD[it.id]?.drive, [FL, FR] = poly, drv = car ? new Set(lot.yard.paths.filter(p => p[2] === 'drive').map(p => p[0] + ',' + p[1])) : null;
  for (const [x, z] of cellsOf(it)) { const onDrive = drv?.has(x + ',' + z), m = onDrive ? 0 : .2;   // (a car on the drive may run to the lot line and up to the garage)
    if (!(onDrive ? cellOnLot(poly, x, z, .05) : cellIn(poly, x, z, .6)) && !(curb && z >= -CELL - 1e-6 && z + CELL <= 1.01 && x >= Math.max(FL[0], -99) + .4 && x + CELL <= FR[0] - .4)) return false; if (bl(x, z)) return false;
    if (rects.some(r => x < r[2] + m && x + CELL > r[0] - m && z < r[3] + m && z + CELL > r[1] - m)) return false;
    if (door && x < door[2] && x + CELL > door[0] && z < door[3] && z + CELL > door[1]) return false; }
  // (and its whole footprint, crown and canopy too, clear of the fences, the hedges and the neighbour's lot: a curb piece and a car excepted)
  if (!curb && !car) { const [tx, tz] = stampAt(it), hull = hullItem(it); if (clearOf(poly, hull, tx, tz) < CLEAR) return false;
    // (a tree keeps out of the house's front: the door, the walk, the drive's mouth, the facade's sight line from the street)
    if (it.id === 'tree' && lot.house && inFront(lot.house, tx, tz, Math.max(...hull.map(([u, v]) => Math.hypot(u, v))))) return false; }
  return true; }
// the flex readout (visit mode): curb appeal from the house, its showpiece and the yard; not a price
export function flexRead(lot) { const H = lot.house, items = lot.yard.items; let pts = { springfield: 12, trophy: 20, cape: 10, porch: 10, ranch: 8, gambrel: 10, slab: 16, butterfly: 18 }[H.style] ?? 10;
  if (H.show && H.show !== 'none') pts += 8; if (H.garage === 'glass') pts += 4 + (CAR_FLEX[(H.car ?? [])[0]] ?? 0);
  const fence = Object.values(lot.yard.edges).filter(e => e && e.k !== 'none').length; pts += fence;
  let best = null; for (const it of items) { const f = flexOf(it); pts += f; if (!best || f > flexOf(best)) best = it; }
  const ride = items.find(i => i.id === 'car') ?? (H.car && takesCar(H) ? { id: 'car', a: H.car } : null);
  return { pts, pieces: items.length, best: best && YARD[best.id].name, ride: ride && argsOf(ride)[0], show: SHOWS[H.show] ?? null, fence }; }
