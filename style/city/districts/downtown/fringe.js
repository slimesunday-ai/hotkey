// GLASSWALL · THE DOWNTOWN FRINGE (batch 5) · owner: the downtown fringe agent. The 52 downtown blocks round section 1, one grammar
// with four characters that shade into each other at the corners of the ring:
//   N  toward the Yards (Market Ave): lofts, low garages behind roll-down gates, the auto trades, brick and slate
//   W  toward Sunny Acres, the mall and Neon Row (Grand Ave, Elm St): five- and six-storey tenements over pawn, check cashing, laundromats
//   S  toward Pleasantview (Washington, Lincoln, Jackson St): brownstones and walk-ups on stoops, bakeries and cleaners, trees
//   E  round St. Mercy (Bishop Ave, Route 9): medical offices, pharmacies, the diner trade, white and pale greys
// SECTION 1 NEVER CHANGES: every rule here asks which block it is building, and a section-1 block (or anything that is not a fringe
// block, such as a hero's pseudo block) gets BASE exactly — the same function, the same tables, the same rng draws.
//   · typeOf / groundOf / twoShops get the block (c.b) and the lot (c.l) from gen.js specify;
//   · storeys, windows, cornices, signKinds, trimFor, fire, fireBack and the neutral tones are read later in the same lot's turn of
//     specify (or, for the tones and the set pieces, at its end), so they read the lot typeOf/groundOf just saw (CUR);
//   · life, windowPeople, fireSitter and the one-off list are read while the block is BUILT, so they read REG.blk (the block being built).
// The per-block overrides (blocks/<i>_<j>.js, fringeOverride below) then deal each side its own trades, gates and office names.
import { BASE, PALETTE, LEXICON, NEUTRALS } from '../../grammar.js';
import { PAL, SIDE, hash } from '../../style.js';
import { unshift } from '../../../../world/city.js';   // (SPREAD pin: the side hash reads today's coordinates)
import { kindAt, distOf, inSection, blockAt, segX, segZ } from '../../plan.js';
import { REG } from '../../audit.js';
import { streetTree } from '../../props.js';
import { slab } from '../../ground.js';
import { mergeOverride } from '../../modules.js';
import { variantsOf } from '../../signage/names.js';
import { classOf, LAT } from '../../signage/alloc.js';
import { textMask } from '../../vox.js';

const pick = (r, opts) => { const t = opts.reduce((s, o) => s + o[1], 0); let x = r() * t; for (const [v, w] of opts) { if ((x -= w) < 0) return v; } return opts[0][0]; };

// ── the ring: every downtown block outside section 1 (i −5…6, j −4…2), and its character: [side, second side, share toward it]
export const isFringe = (i, j) => Number.isInteger(i) && Number.isInteger(j) && !inSection(i, j) && distOf(kindAt(i, j)) === 'downtown';
export const FRINGE = []; for (let j = -4; j <= 2; j++) for (let i = -5; i <= 6; i++) if (isFringe(i, j)) FRINGE.push([i, j]);
export const RING = {
  '-5,-4': ['N', 'W', .45], '-4,-4': ['N', 'W', .25], '-3,-4': ['N'], '-2,-4': ['N'], '-1,-4': ['N'], '0,-4': ['N'], '1,-4': ['N'], '2,-4': ['N'],
  '3,-4': ['N', 'E', .15], '4,-4': ['N', 'E', .25], '5,-4': ['N', 'E', .35], '6,-4': ['N', 'E', .45],
  '-5,-3': ['W', 'N', .3], '-4,-3': ['W', 'N', .35], '-4,-2': ['W'], '-5,-1': ['W'], '-4,-1': ['W'], '-5,0': ['W'], '-4,0': ['W'],
  '-5,1': ['W', 'S', .45], '-4,1': ['W', 'S', .45], '-3,1': ['S', 'W', .5],
  '-5,2': ['S', 'W', .45], '-4,2': ['S', 'W', .3], '-3,2': ['S', 'W', .15], '-2,2': ['S'], '-1,2': ['S'], '0,2': ['S'], '1,2': ['S'], '2,2': ['S'],
  '0,1': ['S'], '1,1': ['S'], '2,1': ['S', 'E', .25], '3,2': ['S', 'E', .2], '4,2': ['S', 'E', .3], '5,2': ['S', 'E', .4], '6,2': ['S', 'E', .45],
  '3,-3': ['E', 'N', .35], '4,-3': ['E', 'N', .35], '5,-3': ['E', 'N', .35], '6,-3': ['E', 'N', .4], '3,-2': ['E'], '6,-2': ['E'], '3,-1': ['E'], '6,-1': ['E'],
  '3,0': ['E', 'S', .2], '4,0': ['E'], '5,0': ['E'], '6,0': ['E'], '4,1': ['E', 'S', .5], '5,1': ['E', 'S', .5], '6,1': ['E', 'S', .5],
};
export const sideOfBlock = (i, j) => (RING[i + ',' + j] || ['S'])[0];
// a lot's side: the block's, or its second side for the lots in the band toward that edge (so a corner of the ring shades across it)
export function sideOf(b, l) {
  const e = RING[b.i + ',' + b.j]; if (!e) return 'S'; const [p, s, w] = e; if (!s || !l || !b.R) return p;
  const R = b.R, cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2, W = Math.max(1, R.x1 - R.x0), D = Math.max(1, R.z1 - R.z0);
  const u = s === 'N' ? (R.z1 - cz) / D : s === 'S' ? (cz - R.z0) / D : s === 'W' ? (R.x1 - cx) / W : (cx - R.x0) / W;
  const [ux, uz] = unshift(cx, cz); return u + (hash(Math.round(ux * 10), Math.round(uz * 10), 17) - .5) * .16 > 1 - w ? s : p;
}

// ── the lot the generator is deciding (set by typeOf / groundOf: every later read in that lot's turn of specify sees it)
let CUR = null;
const isFr = b => !!b && isFringe(b.i, b.j);
const enter = c => { CUR = isFr(c.b) ? { b: c.b, l: c.l, side: sideOf(c.b, c.l), blk: sideOfBlock(c.b.i, c.b.j) } : null; return CUR; };
const built = () => { const b = REG.blk; return b && isFringe(b.i, b.j) ? sideOfBlock(b.i, b.j) : null; };   // the block being built (build-time reads)

// ── types, storeys, ground floors
// L blocks (the plan's parking kind: 2,−4 · −4,0 · 4..6,0 · 1,1) keep one open lot each; the rest of the ring gets one only now and then
const lotState = { b: null, n: -1, parking: 0 };
function parkingOk(c) { if (lotState.b !== c.b || c.n <= lotState.n) { lotState.b = c.b; lotState.parking = 0; } lotState.n = c.n;
  if (c.corner || c.l.front < 7 || c.b.noParking) return false; if (c.b.k === 'L') return lotState.parking < 1 && c.n % 2 === 1; return lotState.parking < 1 && c.n % 7 === 3; }
const took = t => { if (t === 'parking') lotState.parking++; return t; };
const TYPE = {
  N(c, r) { if (c.tower && c.big) return 'tower'; const P = parkingOk(c) ? 1.5 : 0;
    if (c.corner) return pick(r, [['loft', 3], ['bodega', 1], ['walkup', 1], ['shop2', 3]]);
    if (c.l.front >= 8) return took(pick(r, [['loft', 6], ['shop2', 3], ['walkup', 1], ['parking', P]]));
    return pick(r, [['shop2', 4], ['loft', 3], ['walkup', 1]]); },
  W(c, r) { if (c.tower && c.big) return 'tower'; const P = parkingOk(c) ? 1 : 0;
    if (c.corner) return pick(r, [['bodega', 2], ['walkup', 5], ['shop2', 1]]);   // (a DELI blade on every corner of Grand Ave repeated itself down the avenue)
    if (c.l.front >= 8) return took(pick(r, [['walkup', 8], ['loft', 1], ['shop2', 1], ['parking', P]]));
    return pick(r, [['walkup', 6], ['shop2', 1], ['brownstone', 1]]); },
  S(c, r) { if (c.tower && c.big) return 'tower'; const P = parkingOk(c) ? 1 : 0;
    if (c.corner) return pick(r, [['bodega', 2], ['walkup', 4], ['shop2', 2]]);   // (corners keep their shops: a stoop's setback leaves too small a roof for the corner's billboard)
    if (c.l.front >= 8) return took(pick(r, [['brownstone', 4], ['walkup', 3], ['loft', 1], ['parking', P]]));
    return pick(r, [['brownstone', 7], ['walkup', 2], ['shop2', 1]]); },
  E(c, r) { if (c.tower && c.big) return 'tower'; const P = parkingOk(c) ? (c.b.k === 'L' ? 3 : 1) : 0;
    if (c.corner) return pick(r, [['office', 3], ['bodega', 1], ['walkup', 2], ['shop2', 2]]);
    if (c.l.front >= 8) return took(pick(r, [['office', 4], ['walkup', 2], ['shop2', 1], ['parking', P]]));
    return pick(r, [['shop2', 3], ['walkup', 3], ['office', 1]]); },
};
const ST = {   // storeys [min, max]: the ring steps down from section 1's towers to the Yards, the trailers and the houses
  N: { walkup: [3, 5], brownstone: [3, 4], bodega: [2, 3], loft: [3, 5], office: [4, 6], shop2: [1, 2], tower: [9, 11] },
  W: { walkup: [5, 6], brownstone: [3, 4], bodega: [3, 5], loft: [5, 6], office: [5, 6], shop2: [1, 2], tower: [9, 11] },
  S: { walkup: [3, 5], brownstone: [3, 4], bodega: [2, 3], loft: [4, 5], office: [4, 6], shop2: [1, 2], tower: [10, 12] },
  E: { walkup: [4, 5], brownstone: [3, 4], bodega: [2, 3], loft: [4, 6], office: [4, 7], shop2: [1, 2], tower: [9, 11] },
};
const GROUND = {
  N(c, r) { const t = c.type; return t === 'office' || t === 'tower' ? 'lobby' : t === 'brownstone' ? 'stoop' : (t === 'parking' || t === 'alley') ? t
    : (t === 'bodega' || t === 'shop2' || c.corner || c.ave) ? 'shop' : t === 'loft' ? pick(r, [['shop', 5], ['resi', 2]]) : pick(r, [['shop', 4], ['resi', 3], ['stoop', 1]]); },
  W(c, r) { const t = c.type; return t === 'office' || t === 'tower' ? 'lobby' : t === 'brownstone' ? 'stoop' : (t === 'parking' || t === 'alley') ? t
    : (t === 'bodega' || t === 'shop2' || c.corner || c.ave) ? 'shop' : pick(r, [['shop', 7], ['stoop', 2], ['resi', 1]]); },
  S(c, r) { const t = c.type; return t === 'office' || t === 'tower' ? 'lobby' : t === 'brownstone' ? 'stoop' : (t === 'parking' || t === 'alley') ? t
    : (t === 'bodega' || t === 'shop2' || c.corner) ? 'shop' : c.ave ? pick(r, [['shop', 3], ['resi', 1]]) : t === 'loft' ? pick(r, [['resi', 2], ['shop', 1]]) : pick(r, [['stoop', 4], ['resi', 3], ['shop', 2]]); },
  E(c, r) { const t = c.type; return t === 'office' || t === 'tower' ? 'lobby' : t === 'brownstone' ? 'stoop' : (t === 'parking' || t === 'alley') ? t
    : (t === 'bodega' || t === 'shop2' || c.corner || c.ave) ? 'shop' : pick(r, [['shop', 5], ['resi', 3], ['stoop', 1]]); },
};
const TWO = { N: [9, .5], W: [8, .7], S: [9, .4], E: [9, .55] };

// ── facades: window styles, cornices, sign kinds, trims, fire escapes
const BW = BASE.windows, BC = BASE.cornices;
const WIN = {
  N: { ...BW, walkup: [['punched', 3], ['tall', 2], ['paired', 2], ['shutter', 1]], loft: [['loft', 6], ['paired', 2], ['tall', 1]], bodega: [['punched', 3], ['paired', 1]], shop2: [['paired', 2], ['punched', 2], ['tall', 1]], office: [['grid', 2], ['ribbon', 1]] },
  W: { ...BW, walkup: [['punched', 4], ['tall', 3], ['shutter', 2], ['arched', 2], ['balcony', 1], ['paired', 1]], bodega: [['punched', 3], ['arched', 1], ['shutter', 2]], shop2: [['punched', 2], ['shutter', 1], ['tall', 1]] },
  S: { ...BW, walkup: [['arched', 3], ['balcony', 2], ['bay', 2], ['tall', 2], ['punched', 1], ['shutter', 1]], brownstone: [['bay', 3], ['arched', 3], ['tall', 2], ['shutter', 1]], loft: [['paired', 2], ['loft', 2], ['tall', 1]], bodega: [['arched', 2], ['punched', 2], ['shutter', 1]], shop2: [['arched', 1], ['punched', 1], ['paired', 1]] },
  E: { ...BW, walkup: [['punched', 3], ['paired', 2], ['tall', 2], ['balcony', 1]], bodega: [['punched', 2], ['paired', 2]], shop2: [['paired', 2], ['punched', 2], ['tall', 1]], office: [['grid', 3], ['ribbon', 3]] },
};
const CORN = {
  N: { ...BC, walkup: [['band', 2], ['bracket', 2], ['crenel', 2], ['sign', 1]], loft: [['band', 3], ['thin', 2], ['sign', 3], ['crenel', 1]], shop2: [['sign', 3], ['band', 2], ['thin', 2], ['crenel', 1]], bodega: [['band', 2], ['bracket', 1], ['sign', 1]] },
  W: { ...BC, walkup: [['bracket', 4], ['crenel', 2], ['pediment', 2], ['deco', 1], ['sign', 1], ['band', 1]], bodega: [['bracket', 3], ['band', 1], ['sign', 1]], shop2: [['sign', 3], ['band', 1], ['crenel', 1]] },
  S: { ...BC, walkup: [['pediment', 3], ['bracket', 3], ['deco', 2], ['band', 1]], brownstone: [['bracket', 3], ['pediment', 3], ['deco', 1]], bodega: [['bracket', 2], ['pediment', 1], ['band', 1]] },
  E: { ...BC, walkup: [['band', 2], ['bracket', 2], ['deco', 2], ['sign', 1]], office: [['thin', 3], ['band', 2], ['deco', 1]], shop2: [['sign', 2], ['band', 2], ['thin', 1]] },
};
const SIGNS = {
  N: [['band', 4], ['box', 3], ['blade', 2], ['awnSlope', 1], ['neon', 1], ['awnBox', 1]],
  W: [['awnSlope', 3], ['awnBox', 3], ['box', 2], ['blade', 2], ['band', 2], ['neon', 1]],
  S: [['awnSlope', 4], ['awnBox', 2], ['box', 2], ['band', 1], ['blade', 1], ['neon', 1]],
  E: [['box', 3], ['band', 3], ['awnBox', 2], ['blade', 2], ['awnSlope', 1], ['neon', 1]],
};
const accent = (r, wall, list) => { const c = list.filter(c => c !== wall); return c[(r() * c.length) | 0]; };
const TRIM = {
  N(r, wall) { const t = r(); if (t < .3) return PAL.cream; if (t < .55) return PAL.white; if (t < .8 && wall !== 0x2f5bff && wall !== 0x7a3cff) return PAL.ink; return accent(r, wall, [PAL.yellow, 0xff7a1a, PAL.white]); },
  W: BASE.trimFor,
  S(r, wall) { const t = r(); if (t < .55) return PAL.cream; if (t < .9) return PAL.white; return accent(r, wall, [PAL.yellow, PAL.pink, 0x2de2e6, PAL.white]); },
  E(r, wall) { const t = r(); if (t < .3) return PAL.cream; if (t < .85) return PAL.white; if (wall !== 0x2f5bff && wall !== 0x7a3cff && t < .93) return PAL.ink; return accent(r, wall, [0x2de2e6, PAL.green, PAL.white]); },
};
const FIRE = { N: (t, st) => (t === 'walkup' || t === 'loft') && st >= 5, W: (t, st) => (t === 'walkup' || t === 'loft') && st >= 3, S: (t, st) => t === 'walkup' && st >= 5, E: (t, st) => t === 'walkup' && st >= 5 };
const FIREBACK = { N: [['walkup', 'loft'], .7], W: [['walkup', 'loft', 'brownstone'], .75], S: [['walkup', 'brownstone'], .6], E: [['walkup', 'loft'], .5] };

// ── roofs, rests, scenes, people (per block: the block's own side)
// the ring's roofs speak their side, not section 1's food gags (no burger, pizza, sneaker, cash tower or boxing ring out here): courts,
// billboards, grow-ops and throw-ups over the garages; parties, gardens and money over the tenements; gardens, pools and courts over the
// stoops; gardens, lawyers' billboards and neon round the hospital. Fewer of them, so the calm roofs between read as rests.
const PIECES = {
  N: { calm: .45, count: [.45, .1], heroCount: 1, order: ['court', 'billboard', 'grow', 'tag', 'garden'] },
  W: { calm: .5, count: [.55, .15], heroCount: 1, order: ['party', 'garden', 'tag', 'cash', 'billboard'] },
  S: { calm: .75, count: [.4, .05], heroCount: 1, order: ['garden', 'court', 'party', 'garden', 'tag'] },
  E: { calm: .55, count: [.55, .15], heroCount: 1, order: ['garden', 'billboard', 'court', 'grow'] },
  // (no rooftop neon frame: its short word repeats within 96 m of section 1's; no pool: its umbrella leans over the parapet into a taller
  // neighbour on the ring's narrow roofs)
};
const ONEOFFS = { N: ['carBlocks', 'cart', 'domino', 'couch'], W: ['domino', 'couch', 'yardsale', 'moving', 'cart'], S: ['yardsale', 'moving', 'couch', 'domino'], E: ['cart', 'domino', 'moving', 'couch'] };
const LEANERS = { N: [.25, .35], W: [.45, .55], S: [.35, .4], E: [.25, .3] };   // window leaners, fire-escape sitters (generic walkers do the street)
// the neutral mix per side (30–40 % over the ring: brick lofts north, colourful tenements west, brick and buff stoops south, clinic whites east)
const N = NEUTRALS;
const TONES = { N: [N.brick, N.slate, N.grey, N.brick, N.buff, N.pale, N.brick, N.white], W: [N.brick, N.white, N.pale, N.buff, N.bone, N.brick, N.grey, N.slate],
  S: [N.brick, N.buff, N.brick, N.white, N.bone, N.buff, N.brick, N.pale], E: [N.white, N.pale, N.bone, N.grey, N.white, N.slate, N.pale, N.brick] };
const SHARE = { N: .4, W: .26, S: .38, E: .38 };
// the saturated walls per side (STYLE §2's list, split by temperature): yellows, oranges, reds and blues by the Yards; hot pinks, reds and
// violets on the tenements; warm reds, ambers and greens among the brownstones; cool blues, teals and violets round the hospital
const WALLSIDE = { N: [0xffc21a, 0xef4a2a, 0xff7a1a, 0x2f5bff, 0x12b3a0, 0x25b84c, 0xff8a1f, 0x3fa9f5], W: [0xff4fa3, 0xef4a2a, 0xffc21a, 0x7a3cff, 0x12b3a0, 0xe83b5b, 0x8c52ff, 0x25b84c, 0xff7a1a],
  S: [0xef4a2a, 0xffc21a, 0x25b84c, 0x12b3a0, 0xff8a1f, 0xe83b5b, 0x2f5bff, 0xff4fa3], E: [0x3fa9f5, 0x2f5bff, 0x12b3a0, 0x25b84c, 0x7a3cff, 0x8c52ff, 0xffc21a, 0xe83b5b] };
// read per lot in specify (after typeOf): a table that answers with the lot's side (section 1 and every other block: the kit's own list)
export const fringeWalls = base => new Proxy(base, { get: (t, k) => (CUR ? WALLSIDE[CUR.side] : t)[k] });

// the kit's grammar: BASE for section 1 (and any non-fringe block), the ring's rules for the fringe
export function fringeGrammar() {
  const tbl = (T, B) => new Proxy({}, { get: (_, k) => (CUR ? T[CUR.side] : B)[k] });
  return {
    typeOf(c, r) { const C = enter(c); return C ? TYPE[C.side](c, r) : BASE.typeOf(c, r); },
    storeys(type, tower) { if (!CUR || type === 'alley' || type === 'parking') return BASE.storeys(type, tower); return ST[CUR.side][type] || [2, 3]; },
    groundOf(c, r) { const C = enter(c); return C ? GROUND[C.side](c, r) : BASE.groundOf(c, r); },
    twoShops(c, r) { const C = enter(c); if (!C) return BASE.twoShops(c, r); const [f, p] = TWO[C.side]; return c.type !== 'bodega' && c.l.front >= f && r() < p; },
    windows: tbl(WIN, BW), cornices: tbl(CORN, BC),
    trimFor(r, wall) { return CUR ? TRIM[CUR.side](r, wall) : BASE.trimFor(r, wall); },
    fire(type, st) { return CUR ? FIRE[CUR.side](type, st) : BASE.fire(type, st); },
    fireBack(type, st, r) { if (!CUR) return BASE.fireBack(type, st, r); const [types, p] = FIREBACK[CUR.side]; return types.includes(type) && st >= 3 && r() < p; },
  };
}
// after defineKit (its spreads would freeze getters): the reads that come later than the lot's own turn
export function installFringe(kit) {
  const G = kit.grammar, NP = kit.palette.neutral, def = (o, k, get) => Object.defineProperty(o, k, { get, enumerable: true, configurable: true });
  def(G, 'signKinds', () => CUR ? SIGNS[CUR.side] : BASE.signKinds);
  def(G, 'pieces', () => CUR ? PIECES[CUR.blk] : BASE.pieces);
  def(G, 'oneOffs', () => { const s = built(); return s ? ONEOFFS[s] : BASE.oneOffs; });
  def(G, 'life', () => built() ? [0, 0] : BASE.life);   // new districts place no static people: the generic walkers fill the ring's sidewalks
  def(G, 'windowPeople', () => { const s = built(); return s ? LEANERS[s][0] : BASE.windowPeople; });
  def(G, 'fireSitter', () => { const s = built(); return s ? LEANERS[s][1] : BASE.fireSitter; });
  const baseTones = NP.tones, baseShare = NP.share;
  def(NP, 'tones', () => CUR ? TONES[CUR.blk] : baseTones);
  def(NP, 'share', () => CUR ? SHARE[CUR.blk] : baseShare);
  return kit;
}

// ── the per-block overrides: each side deals its own trades (the shared signage system still names every one: no name repeats within
// ~3 blocks), roll-down gates on the north, medical office names on the east, and trees along the south's streets
const SH = LEXICON.shops, byTrade = new Map(SH.map(e => [String(e[0]), e]));
const deck = list => list.map(t => { const e = byTrade.get(t); if (!e) throw new Error('fringe: no trade ' + t); return e; });
const TRADES = {
  N: deck(['AUTO', 'KEYS', 'LOCKSMITH', 'SURPLUS', 'STORAGE', 'HEROES', 'COFFEE', 'GRILL', 'TACOS', 'CANTEEN', 'COPIES', 'RECORDS', 'SKATE', 'TATTOO', 'SMOKE SHOP', 'BURGERS', 'CHICKEN', 'HALAL', 'SPY SHOP', 'PRIVATE EYE', 'LIQUORS', '99¢']),
  W: deck(['PAWN', 'GOLD', 'WE BUY', 'NO QS', 'CHECKS CASHED', 'MONEY WIRE', 'LOANS', 'LAUNDROMAT', 'LAUNDRY', 'CLEANERS', '99¢', 'PREPAID', 'PHONE FIX', 'WIRELESS', 'BARBER', 'CUTS', 'NAILS', 'LIQUORS', 'CHICKEN', 'HALAL', 'PIZZA', 'TAX PREP', 'NOTARY', 'BAIL BONDS', 'THRIFT', 'KEYS', 'PSYCHIC', 'BAKERY', 'TACOS', 'GRILLZ', 'JEWELRY', 'OUTLET', 'BIG SIZES', 'WOK']),
  S: deck(['BAKERY', 'CAFE', 'COFFEE', 'PIZZA', 'CLEANERS', 'BARBER', 'NAILS', 'OPTICAL', 'DENTIST', 'PHARMACY', 'WINE', 'BAGELS', 'JUICE', 'RECORDS', 'THRIFT', 'COMICS', 'CARDS', 'DUMPLINGS', 'TACOS', 'NOODLES', 'HEROES', 'DONUTS', 'KEYS', 'LAUNDRY', 'TAX PREP', 'PHO', 'SKATE', 'TEES']),
  E: deck(['PHARMACY', 'DENTIST', 'OPTICAL', 'OPTICS', 'DINER', 'COFFEE', 'CAFE', 'BAGELS', 'HEROES', 'HALAL', 'JUICE', 'LAW', 'NOTARY', 'CARDS', 'DONUTS', 'NOODLES', 'PHO', 'WIRELESS', 'CLEANERS', 'BARBER', 'CANTEEN', 'COPIES', 'KEYS', 'PHONE FIX', 'CHICKEN']),
};
const SWAP = { N: .8, W: .85, S: .75, E: .85 }, GATE = { N: .3, W: .2, S: .08, E: .12 };
// the east's office lobbies: practices, not holding companies (invented; each block deals from its own offset, never twice in a block)
export const PRACTICES = ['BISHOP BONE & JOINT', 'NASH ST DIALYSIS', 'ORCHARD PEDIATRICS', 'MAPLE IMAGING', 'WALK-IN X-RAY', 'NIGHT SHIFT URGENT CARE', 'SECOND OPINION MD', 'STITCHES & CO',
  'PAIN MGMT', 'CASH ONLY DENTAL', 'LENOX SLEEP LAB', 'BACK IN ACTION PT', 'VEIN & LASER', 'KIDNEY CARE', 'EYE ASSOCIATES', 'FIRST STITCH', 'DR. OKAFOR MD', 'SMILE DESIGN', 'NO WAIT CLINIC', 'ROUTE 9 RADIOLOGY'];
// the shared signage names a trade from the block's own class (signage/alloc.js); when none of that class's names fits the shop's band it
// falls back to the plain trade word, and two blocks a few hundred feet apart then hang the same GROCERY. So a lot only gets a trade
// whose class has a name that fits its real band (gen.js buildLot: one shop across the frontage, or two split at 42–58 %), and no trade
// twice in a block (the second would need the class's next, longer name)
const fitsBand = (T, i, j, W) => { const V = variantsOf(String(T)); if (!V.length) return textMask(String(T)).w <= W - 6; const c = classOf('name', i, j), n2 = LAT.name * LAT.name;
  for (let q = c; q < V.length; q += n2) if (textMask(V[q]).w <= W - 6) return true; return false; };
const bandsOf = (s, l) => { const L = Math.round((l.main[1] === 'z' ? l.w : l.d) * 10); if (s.shops.length < 2) return [L]; const cut = Math.round(L * (.42 + hash(s.seed, 5) * .16)); return [cut, L - cut]; };
const DELI = LEXICON.delis;
const blocks = new Map(), blk = (i, j) => { const k = i + ',' + j; let b = blocks.get(k); if (!b) blocks.set(k, b = blockAt(i, j)); return b; };
const used = new Map();   // per block, per plan pass: trades and practice names already dealt (reset at L0: planBlock deals L0, L1, … in order)
function tuneLot(i, j, k, s, l) {
  const key = i + ',' + j; if (k === 0 || !used.has(key)) used.set(key, { trades: new Set(), corps: new Set() }); const U = used.get(key);
  if (!s || !l || ['alley', 'parking', 'calm', 'transit'].includes(s.type)) return;
  const side = sideOf(blk(i, j), l), list = TRADES[side];
  // the corner's rooftop billboard (the block's gag) is 7.8 m long across its last street face: on a roof shorter than that (or a stoop
  // building's, set back 2.5 m) it would stand through its own parapet, so that corner gets a roof garden instead
  if (s.gag?.kind === 'billboard') { const f = l.faces[l.faces.length - 1] || l.main, along = f[1] === 'x' ? l.d : l.w;
    if (along < 8.4 || s.ground === 'stoop') { delete s.gag; if (!s.piece && l.w >= 4.4 && l.d >= 5.4) s.piece = { kind: 'garden', seed: (s.seed * 7 + 13) | 0, alongX: l.w >= l.d, col: PAL.pink, col2: PAL.yellow }; } }
  // the roof billboard set piece always stands across x (setpieces.js), 7.8 m of it: a roof narrower than that gets a garden instead
  if (s.piece?.kind === 'billboard') { const set = s.ground === 'stoop' && l.main[1] === 'x' ? 2.5 : 0; if (l.w - .6 - set < 7.9) s.piece.kind = 'garden'; }
  const bands = s.shops?.length ? bandsOf(s, l) : [];
  (s.shops || []).forEach((sh, n) => { const W = bands[n] ?? bands[0];
    if (s.type === 'bodega' && n === 0) {   // the deli keeps its trade unless no name of its class fits the awning (or the block has it)
      if (!fitsBand(sh.name, i, j, W) || U.trades.has(String(sh.name))) { const st = (hash(i * 17 + k, j, 59) * DELI.length) | 0;
        for (let t = 0; t < DELI.length; t++) { const d = DELI[(st + t) % DELI.length]; if (!U.trades.has(String(d)) && fitsBand(d, i, j, W)) { sh.name = d; break; } } }
      U.trades.add(String(sh.name)); return; }
    const keep = hash(i * 131 + j * 17, k * 7 + n, 51) > SWAP[side] && fitsBand(sh.name, i, j, W) && !U.trades.has(String(sh.name));
    if (keep) { U.trades.add(String(sh.name)); return; }
    const wantObj = n === 0 && s.gag?.kind === 'object', start = (hash(i * 31 + k, j * 7 + n, 53) * list.length) | 0;
    let e = null; for (let t = 0; t < list.length && !e; t++) { const c = list[(start + t) % list.length]; if (!U.trades.has(String(c[0])) && fitsBand(c[0], i, j, W) && (!wantObj || c[3])) e = c; }
    if (!e && wantObj) for (let t = 0; t < list.length && !e; t++) { const c = list[(start + t) % list.length]; if (!U.trades.has(String(c[0])) && fitsBand(c[0], i, j, W)) e = c; }
    if (!e) return; U.trades.add(String(e[0])); Object.assign(sh, { name: e[0], sign: e[1], disp: e[2], obj: e[3] });
    if (wantObj) { if (e[3]) s.gag.obj = e[3]; else delete s.gag; }
    sh.gate = hash(i * 7 + k, j * 13 + n, 55) < GATE[side];
  });
  if ((s.type === 'office' || s.type === 'tower') && side === 'E') { const start = (hash(i * 13, j * 29 + k, 57) * PRACTICES.length) | 0;
    for (let t = 0; t < PRACTICES.length; t++) { const p = PRACTICES[(start + t) % PRACTICES.length]; if (!U.corps.has(p)) { U.corps.add(p); s.corp = p; break; } } }
}
// trees along the south's streets (the kerb strip, 0.45 m in from the curb, every ~7 m, only where the registry says it is clear: never on a
// walkers' corner line, a doorway, an awning's reach or the clear path)
function streetTrees(api, i, j, every) {
  const s = slab(i, j), sides = [[segZ(j, i), 'x', s.z0 + .45, 0], [segZ(j + 1, i), 'x', s.z1 - .45, 1], [segX(i, j), 'z', s.x0 + .45, 2], [segX(i + 1, j), 'z', s.x1 - .45, 3]];
  let n = 0; for (const [ok, ax, at, rot] of sides) { if (!ok) continue; const u0 = ax === 'x' ? s.x0 : s.z0, u1 = ax === 'x' ? s.x1 : s.z1;
    for (let u = u0 + 5 + hash(i, j, rot) * 2; u < u1 - 5; u += every) { const bk = streetTree(i * 11 + j * 5 + n++);
      for (const d of [0, .8, -.8, 1.6, -1.6]) { const x = ax === 'x' ? u + d : at, z = ax === 'x' ? at : u + d, e = REG.boxOf(bk, rot, x, SIDE, z);
        if (!REG.why(e)) { api.stamp(bk, api.bank, rot, x, SIDE, z); break; } } } }
}
// fringeOverride(i, j, extra): the override object for blocks/<i>_<j>.js (extra: that block's own hand tuning, merged after)
export function fringeOverride(i, j, extra = {}) {
  const lots = {}; for (let k = 0; k < 48; k++) lots['L' + k] = (s, l) => tuneLot(i, j, k, s, l);
  const side = sideOfBlock(i, j), trees = side === 'S' ? 7 : 0;
  return mergeOverride({ lots, add: trees ? api => streetTrees(api, i, j, trees) : undefined }, extra);
}
