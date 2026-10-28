// GATEHILL · the sixteen towers (one per block, blocks −9…−6 × 4…7). Pure data, read by the full build (tower.js) and the far tier
// (far.js) alike. Lot-local metres: u runs west → east from the lot's west line (0 … 24), v north → south from its north line
// (0 … 24; 22 on the Union Ave row). Every tower keeps the sim's two doors: an entrance court in the middle of the north and the south
// frontage (w × d metres), its lobby on the court's back wall, the doorman at the door (DISTRICTS.md §6).
//   gf     the ground floor (5.2 m, 0.1 cubes): its material and its shops (on the side streets, at the corners)
//   pod    the podium floors over it (0.2 cubes), its roof a terrace
//   tiers  the shaft, bottom to top (0.2 cubes): a rect (or rects), floors, facade style (facades.js); `ph` marks the penthouse floors
//   crown / roof   the top: the district's overhead set pieces, one of each kind, never repeated
//   lobby  per court: the canopy and the car line · bill: the podium wing ('-x' | '+x') that carries a roof billboard (shared signage)
//   tonight  which penthouse is lit when the sim is off (north unit, south unit: L lit, d dark): the build's own night, half and half
import { C } from './lib.js';
import { interior } from '../../../../world/city.js';

// a lot's frame: X0/Z0 its north-west corner (world), W × D, the courts, the tower's footprint helpers
export function lotOf(i, j) { const R = interior(i, j), X0 = R.x0, Z0 = R.z0, W = R.x1 - R.x0, D = R.z1 - R.z0; return { X0, Z0, W, D, X1: X0 + W, Z1: Z0 + D, cx: X0 + W / 2 }; }   // (SPREAD: the block's interior — today i·32 + 4, j·32 + 4 or 6 under Union Ave)
export const GF_H = 5.2, FLOOR = 3;

const S = { N: 'N', S: 'S' };
export const TOWERS = {
  // ── Union Ave, facing the woods ("Park Row")
  '-9_4': { name: 'THE VANDERMEER', short: 'VANDERMEER', wall: C.bone, trim: C.copper, accent: C.copperD, glass: 'blue', tonight: 'Ld', glow: C.copper, roofCol: 0xc9c5bd, neutral: true,
    court: { w: 11, d: 4.8 }, gf: { mat: 'stone', wall: C.stone, trim: C.copper, band: C.copperD },
    pod: { n: 2, st: 'stone' },
    tiers: [{ r: [3, 4.8, 21, 17.2], n: 11, st: 'stone' }, { r: [5, 5.8, 19, 16.2], n: 5, st: 'stone', terr: 'awning' }, { r: [7, 6.6, 17, 15.4], n: 2, st: 'loggia', ph: true, terr: 'trees' }],
    crown: { kind: 'temple', col: C.copper, h: 12 }, lobby: { N: { canopy: 'marquee', cars: 'limo' }, S: { canopy: 'letters', cars: 'sedan' } },
    shops: [{ side: '-x', end: 'N', len: 8, name: 'PETAL & THORN', disp: 'flowers', awn: C.copperD }, { side: '+x', end: 'S', len: 7, name: 'HUMIDOR', disp: 'cigars', awn: C.ink }] },
  '-8_4': { name: 'THE GEMELLI', short: 'GEMELLI', wall: C.buff, trim: C.cream, accent: C.gold, glass: 'bronze', tonight: 'dL', glow: C.gold, roofCol: 0xb9b3a8, neutral: true,
    court: { w: 12, d: 4.8 }, gf: { mat: 'stone', wall: 0xd8c09a, trim: C.cream, band: C.ink },
    pod: { n: 1, st: 'loggia' },
    tiers: [{ r: [4, 4.8, 20, 17.2], n: 13, st: 'loggia', terr: 'rail' }, { rs: [[8.4, 4.8, 15.6, 9.8], [8.4, 12.2, 15.6, 17.2]], n: 4, st: 'loggia' }, { rs: [[8.4, 4.8, 15.6, 9.8], [8.4, 12.2, 15.6, 17.2]], n: 2, st: 'glassbox', ph: true, twins: true }],
    crown: { kind: 'cupolas', col: C.gold, h: 8 }, lobby: { N: { canopy: 'porte', cars: 'suvs' }, S: { canopy: 'marquee', cars: 'roadster' } },
    shops: [{ side: '+x', end: 'N', len: 8, name: 'SUCRE', disp: 'cakes', awn: C.pink }, { side: '-x', end: 'S', len: 8, name: 'ATELIER MAUD', disp: 'bags', awn: C.ink }] },
  '-7_4': { name: 'HALCYON', short: 'HALCYON', wall: C.rasp, trim: C.chalk, accent: C.rasp, glass: 'rose', tonight: 'LL', glow: C.pink, roofCol: 0xd3d4d7,
    court: { w: 12, d: 4.8 }, gf: { mat: 'bronze', wall: 0x2a2a30, trim: C.brass, band: C.ink },
    pod: { n: 1, st: 'curtain' },
    tiers: [{ r: [5, 4.8, 19, 17.2], n: 14, st: 'curtain' }, { r: [6.6, 4.8, 19, 17.2], n: 6, st: 'curtain', terr: 'rail' }, { r: [6.6, 4.8, 17.4, 17.2], n: 4, st: 'curtain', terr: 'rail' }, { r: [6.6, 4.8, 17.4, 17.2], n: 2, st: 'glassbox', ph: true }],
    crown: { kind: 'skypool', h: 2 }, lobby: { N: { canopy: 'porte', cars: 'supercar' }, S: { canopy: 'letters', cars: 'valet' } },
    shops: [{ side: '-x', end: 'N', len: 10, name: 'GALERIE NOCTURNE', disp: 'art', awn: null }, { side: '+x', end: 'S', len: 7, name: 'ESSENCE NO 9', disp: 'perfume', awn: C.rasp }] },
  '-6_4': { name: 'OFFSHORE', short: 'OFFSHORE', wall: C.blue, trim: C.chalk, accent: 0x9aa0aa, glass: 'dark', tonight: 'dd', glow: 0x2de2e6, roofCol: 0xc4c0b8,
    court: { w: 12, d: 4.8 }, gf: { mat: 'granite', wall: 0x23232a, trim: C.brass, band: C.brass },
    pod: { n: 1, st: 'ribbon' },
    tiers: [{ r: [3, 4.8, 21, 17.2], n: 16, st: 'ribbon' }, { r: [3, 4.8, 21, 17.2], n: 4, st: 'ribbon' }, { r: [3, 4.8, 21, 17.2], n: 2, st: 'glassbox', ph: true }],
    crown: { kind: 'helipad', h: 1.2 }, lobby: { N: { canopy: 'marquee', cars: 'suvs' }, S: { canopy: 'porte', cars: 'limo' } },
    shops: [{ side: '+x', end: 'N', len: 12, name: 'APEX MOTORCARS', disp: 'cars', awn: null }, { side: '-x', end: 'S', len: 9, name: 'CASTELLAN BANK', disp: 'bank', awn: C.ink }] },
  // ── Oak St to Pine St
  '-9_5': { name: 'THE BULLION', short: 'BULLION', wall: C.yellow, trim: C.yellow, accent: C.ink, glass: 'dark', tonight: 'LL', glow: C.gold, roofCol: 0xd9d5cc,
    court: { w: 12, d: 5 }, gf: { mat: 'granite', wall: 0x17171b, trim: C.gold, band: C.gold },
    pod: { n: 1, st: 'deco' },
    tiers: [{ r: [4, 5, 20, 19], n: 10, st: 'deco' }, { r: [5, 6, 19, 18], n: 6, st: 'deco', terr: 'rail' }, { r: [5, 6, 19, 18], n: 2, st: 'glassbox', ph: true }],
    crown: { kind: 'cabanas', h: 3 }, lobby: { N: { canopy: 'letters', cars: 'roadster' }, S: { canopy: 'porte', cars: 'suvs' } },
    shops: [{ side: '-x', end: 'S', len: 8, name: 'GRAND CRU', disp: 'wine', awn: 0x7a1020 }, { side: '+x', end: 'N', len: 7, name: 'HOROLOGE', disp: 'watches', awn: C.ink }] },
  '-8_5': { name: 'PARAGON', short: 'PARAGON', wall: C.white, trim: C.white, accent: C.ink, glass: 'dark', tonight: 'dL', glow: C.chalk, roofCol: 0xd3d4d7, neutral: true,
    court: { w: 11, d: 5 }, gf: { mat: 'marble', wall: C.chalk, trim: C.ink, band: C.ink },
    pod: { n: 1, st: 'grid' },
    tiers: [{ r: [6.6, 6.6, 17.4, 17.4], n: 32, st: 'grid' }, { r: [6.6, 6.6, 17.4, 17.4], n: 2, st: 'grid', ph: true, tall: true }],
    crown: { kind: 'mech', h: 6 }, roof: { kind: 'infinity' }, lobby: { N: { canopy: 'letters', cars: 'sedan' }, S: { canopy: 'marquee', cars: 'limo' } },
    shops: [{ side: '+x', end: 'N', len: 8, name: 'BLANC NOIR', disp: 'fashion', awn: null }, { side: '-x', end: 'S', len: 7, name: 'CUT & CLOTH', disp: 'tailor', awn: 0x2f5bff }] },
  '-7_5': { name: 'AUREUM', short: 'AUREUM', wall: C.white, trim: C.chalk, accent: C.gold, glass: 'blue', tonight: 'LL', glow: C.gold, roofCol: 0xd9d5cc, neutral: true, hero: true,
    court: { w: 13, d: 5 }, gf: { mat: 'marble', wall: C.chalk, trim: C.gold, band: C.ink },
    pod: { n: 2, st: 'deco' },
    tiers: [{ r: [4, 5, 20, 19], n: 12, st: 'deco' }, { r: [5, 5.6, 19, 18.4], n: 9, st: 'deco', terr: 'rail' }, { r: [6.4, 6.6, 17.6, 17.4], n: 7, st: 'deco', terr: 'trees' },
      { r: [7.6, 7.6, 16.4, 16.4], n: 2, st: 'glassbox', ph: true, terr: 'rail' }],
    crown: { kind: 'sunburst', col: C.gold, h: 14, spire: 18 }, lobby: { N: { canopy: 'porte', cars: 'limo' }, S: { canopy: 'porte', cars: 'suvs' } },
    shops: [{ side: '-x', end: 'N', len: 8, name: 'LOCKBOX CLUB', disp: 'club', awn: null }, { side: '+x', end: 'S', len: 8, name: 'PEARL CAVIAR', disp: 'caviar', awn: C.ink }] },
  '-6_5': { bill: '+x', name: 'THE PEMBROKE', short: 'PEMBROKE', wall: C.teal, trim: C.chalk, accent: C.chalk, glass: 'teal', tonight: 'dd', glow: 0x2de2e6, roofCol: 0xd9d5cc,
    court: { w: 12, d: 5 }, gf: { mat: 'marble', wall: 0xe8e4dc, trim: C.teal, band: C.teal },
    pod: { n: 1, st: 'curtain' },
    tiers: [{ r: [5, 5, 19, 19], n: 15, st: 'balcony' }, { r: [5.8, 5.8, 18.2, 18.2], n: 3, st: 'balcony', terr: 'rail' }, { r: [5.8, 5.8, 18.2, 18.2], n: 2, st: 'glassbox', ph: true }],
    crown: { kind: 'palmpool', h: 2 }, lobby: { N: { canopy: 'marquee', cars: 'valet' }, S: { canopy: 'letters', cars: 'sedan' } },
    shops: [{ side: '+x', end: 'S', len: 8, name: 'POOCH SPA', disp: 'dogs', awn: C.pink }, { side: '-x', end: 'N', len: 8, name: 'IV DRIP LOUNGE', disp: 'drip', awn: C.teal }] },
  // ── Pine St to Willow St
  '-9_6': { name: 'SOLITAIRE', short: 'SOLITAIRE', wall: C.violet, trim: C.chalk, accent: 0xb7a6ff, glass: 'violet', tonight: 'Ld', glow: C.purple, roofCol: 0xd3d4d7, hero: true,
    court: { w: 12, d: 5 }, gf: { mat: 'marble', wall: C.chalk, trim: C.violet, band: C.ink },
    pod: { n: 1, st: 'diagrid' },
    tiers: [{ r: [5, 5, 19, 19], n: 17, st: 'diagrid' }, { r: [5, 5, 19, 19], n: 2, st: 'glassbox', ph: true }],
    crown: { kind: 'ring', h: 11 }, lobby: { N: { canopy: 'porte', cars: 'supercar' }, S: { canopy: 'marquee', cars: 'limo' } },
    shops: [{ side: '+x', end: 'N', len: 9, name: 'MAISON VERAN', disp: 'jewels', awn: null }, { side: '-x', end: 'S', len: 7, name: 'OBJETS', disp: 'objects', awn: C.violet }] },
  '-8_6': { name: 'NO COMMENT', short: 'NO COMMENT', wall: C.green, trim: C.chalk, accent: C.chalk, glass: 'green', tonight: 'dd', glow: 0x6cff4a, roofCol: 0xd9d5cc,
    court: { w: 12, d: 5 }, gf: { mat: 'bronze', wall: 0x2a2a30, trim: C.chalk, band: C.green },
    pod: { n: 1, st: 'curtain' },
    tiers: [{ r: [4, 5, 18, 19], n: 3, st: 'jenga' }, { r: [6, 3.6, 20, 17.6], n: 3, st: 'jenga', terr: 'trees' }, { r: [4.6, 6.2, 17.4, 20.4], n: 3, st: 'jenga', terr: 'trees' },
      { r: [7, 4.4, 21, 18], n: 3, st: 'jenga', terr: 'trees' }, { r: [3.6, 5.4, 16.8, 19.4], n: 3, st: 'jenga', terr: 'trees' }, { r: [6.4, 3.8, 19.6, 17.2], n: 3, st: 'jenga', terr: 'trees' },
      { r: [5.2, 6, 18, 18.8], n: 2, st: 'glassbox', ph: true, terr: 'trees' }],
    roof: { kind: 'pickleball' }, lobby: { N: { canopy: 'letters', cars: 'suvs' }, S: { canopy: 'marquee', cars: 'roadster' } },
    shops: [{ side: '-x', end: 'N', len: 9, name: 'HEAT CHECK', disp: 'sneakers', awn: C.green }, { side: '+x', end: 'S', len: 7, name: 'RUNWAY 9', disp: 'fashion', awn: C.ink }] },
  '-7_6': { name: 'THE STERLING', short: 'STERLING', wall: C.orange, trim: C.chalk, accent: C.orange, glass: 'bronze', tonight: 'Ld', glow: C.orange, roofCol: 0xc9c5bd,
    court: { w: 12, d: 5 }, gf: { mat: 'stone', wall: 0xe0cdb4, trim: C.bronze, band: C.bronze },
    pod: { n: 2, st: 'fins' },
    tiers: [{ r: [6, 5, 18, 19], n: 19, st: 'fins' }, { r: [6, 5, 18, 17.4], n: 4, st: 'fins' }, { r: [6, 5, 18, 15.6], n: 3, st: 'fins' }, { r: [6.6, 5, 17.4, 13.6], n: 2, st: 'glassbox', ph: true, terr: 'rail' }],
    crown: { kind: 'feather', h: 8 }, lobby: { N: { canopy: 'porte', cars: 'sedan' }, S: { canopy: 'letters', cars: 'limo' } },
    shops: [{ side: '+x', end: 'N', len: 8, name: 'BEZEL & CO', disp: 'jewels2', awn: null }, { side: '-x', end: 'S', len: 7, name: 'SILK & SMOKE', disp: 'cigars2', awn: C.bronze }] },
  '-6_6': { name: 'THE ORANGERY', short: 'ORANGERY', wall: C.slate, trim: C.chalk, accent: C.chalk, glass: 'blue', tonight: 'dL', glow: C.litHi, roofCol: 0xd9d5cc, neutral: true,
    court: { w: 12, d: 5 }, gf: { mat: 'stone', wall: 0xcfd0d4, trim: C.slate, band: C.slate },
    pod: { n: 1, st: 'loggia' },
    tiers: [{ r: [4, 5, 20, 19], n: 10, st: 'loggia' }, { r: [5.4, 5, 18.6, 19], n: 4, st: 'loggia', terr: 'trees' }, { r: [5.4, 5, 18.6, 19], n: 2, st: 'glassbox', ph: true }],
    roof: { kind: 'orangery' }, lobby: { N: { canopy: 'marquee', cars: 'roadster' }, S: { canopy: 'porte', cars: 'valet' } },
    shops: [{ side: '-x', end: 'N', len: 8, name: 'BLOOM ROOM', disp: 'flowers2', awn: C.green }, { side: '+x', end: 'S', len: 8, name: 'CELLAR 88', disp: 'wine2', awn: 0x7a1020 }] },
  // ── Willow St to Aspen St, facing the south woods
  '-9_7': { name: 'THE ARBOR', short: 'ARBOR', wall: C.white, trim: C.chalk, accent: C.leafD, glass: 'green', tonight: 'dd', glow: 0x6cff4a, roofCol: 0xd9d5cc, neutral: true,
    court: { w: 12, d: 5 }, gf: { mat: 'stone', wall: C.stone, trim: C.leafD, band: C.leafD },
    pod: { n: 1, st: 'curtain' },
    tiers: [{ r: [5, 5, 19, 19], n: 16, st: 'forest' }, { r: [5, 5, 19, 19], n: 2, st: 'glassbox', ph: true }],
    roof: { kind: 'forest' }, lobby: { N: { canopy: 'letters', cars: 'valet' }, S: { canopy: 'marquee', cars: 'suvs' } },
    shops: [{ side: '+x', end: 'N', len: 8, name: 'CORE CLUB', disp: 'gym', awn: C.leafD }, { side: '-x', end: 'S', len: 7, name: 'GREEN ROOM', disp: 'juice', awn: C.green }] },
  '-8_7': { name: 'THE AMBERLEY', short: 'AMBERLEY', wall: C.brick, trim: C.cream, accent: C.cream, glass: 'blue', tonight: 'LL', glow: C.litLo, roofCol: 0xa9a7ad, neutral: true, hero: true,
    court: { w: 11, d: 5 }, gf: { mat: 'stone', wall: C.stone, trim: C.brick, band: C.ink, cuts: [{ side: '-x', from: 4.6, to: 11.4, d: 2.2, ceil: 4.4 }] },
    pod: { n: 1, st: 'brick' },
    tiers: [{ r: [3, 5, 21, 19], n: 12, st: 'brick' }, { r: [5, 5, 19, 19], n: 3, st: 'brick', terr: 'trees' }, { r: [5, 5, 19, 19], n: 2, st: 'loggia', ph: true }],
    roof: { kind: 'tank' }, lobby: { N: { canopy: 'covered', cars: 'sedan' }, S: { canopy: 'letters', cars: 'suvs' } },
    shops: [{ side: '-x', end: 'N', len: 16, name: 'GAVEL & GRAIL', disp: 'auction', awn: null, hero: 'auction' }, { side: '+x', end: 'S', len: 7, name: 'PRIVATE PAWN', disp: 'pawn', awn: C.ink }] },
  '-7_7': { name: 'MERIDIAN', short: 'MERIDIAN', wall: C.sky, trim: C.chalk, accent: C.sky, glass: 'sky', tonight: 'dL', glow: C.sky, roofCol: 0xd3d4d7,
    court: { w: 12, d: 5 }, gf: { mat: 'marble', wall: C.chalk, trim: C.sky, band: C.ink },
    pod: { n: 1, st: 'curtain' },
    tiers: [{ r: [4.4, 5, 19.6, 19], n: 9, st: 'curtain' }, { r: [5.2, 5.6, 18.8, 18.4], n: 8, st: 'curtain', terr: 'rail' }, { r: [6, 6.2, 18, 17.8], n: 5, st: 'curtain', terr: 'rail' }, { r: [6, 6.2, 18, 17.8], n: 2, st: 'glassbox', ph: true }],
    crown: { kind: 'skydeck', h: 2 }, lobby: { N: { canopy: 'porte', cars: 'suvs' }, S: { canopy: 'letters', cars: 'supercar' } },
    shops: [{ side: '+x', end: 'S', len: 8, name: 'VALISE', disp: 'luggage', awn: C.sky }, { side: '-x', end: 'N', len: 8, name: 'DR LUXE', disp: 'clinic', awn: null }] },
  '-6_7': { bill: '+x', name: 'THE CLUBHOUSE', short: 'CLUBHOUSE', wall: C.pink, trim: C.chalk, accent: C.chalk, glass: 'pink', tonight: 'Ld', glow: C.pink, roofCol: 0xd9d5cc,
    court: { w: 12, d: 5 }, gf: { mat: 'marble', wall: C.chalk, trim: C.pink, band: C.pink },
    pod: { n: 1, st: 'ribbon' },
    tiers: [{ r: [4, 5, 20, 19], n: 12, st: 'ribbon' }, { r: [4, 5, 20, 19], n: 2, st: 'glassbox', ph: true }],
    roof: { kind: 'tennis' }, lobby: { N: { canopy: 'porte', cars: 'sedan' }, S: { canopy: 'marquee', cars: 'roadster' } },
    shops: [{ side: '-x', end: 'N', len: 8, name: 'PRO SHOP', disp: 'tennis', awn: C.green }, { side: '+x', end: 'S', len: 8, name: 'CHEZ OSEI', disp: 'dining', awn: C.pink }] },
};
export const towerAt = (i, j) => TOWERS[`${i}_${j}`] || null;
// the tiers as boxes: [{ rects: [[u0, v0, u1, v1]…], y0, y1 (metres above the slab), n, st, ph, … }] and the tower's key heights
export function stackOf(T) {
  const podTop = GF_H + T.pod.n * FLOOR, out = []; let y = podTop;
  for (const t of T.tiers) { const h = t.n * FLOOR; out.push({ ...t, rects: t.rs || [t.r], y0: y, y1: y + h }); y += h; }
  return { podTop, top: y, tiers: out };
}
// the podium roof's amenity strips either side of the tower (the full build and the far tier read the same list)
export function podStrips(i, j, T) {
  const L = lotOf(i, j), st = stackOf(T), y = st.podTop, base = st.tiers[0].rects, bx0 = L.X0 + Math.min(...base.map(r => r[0])), bx1 = L.X0 + Math.max(...base.map(r => r[2])), seed = (i + 64) * 131 + (j + 64) * 17, out = [];
  [[L.X0 + .4, bx0 - .5, 0], [bx1 + .5, L.X1 - .4, 1]].forEach(([x0, x1, k]) => { const w = x1 - x0; if (w < 1.6) return; const pick = hash01(seed, 71 + k);
    const bill = T.bill === (k ? '+x' : '-x') && w >= 2.4;   // a developer's roof billboard facing the side street (the shared signage picks it)
    out.push({ x0, x1, z0: L.Z0 + .4, z1: L.Z1 - .4, y, k, kind: bill ? 'bill' : w >= 3.8 ? (pick < .5 ? 'lap' : 'lawn') : (pick < .5 ? 'lawn' : 'planters') }); });
  return out; }
const hash01 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const seedOf = (i, j) => (i + 64) * 131 + (j + 64) * 17;
