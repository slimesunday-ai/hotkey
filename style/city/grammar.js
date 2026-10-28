// Pass 2 · the standard building grammar (core, systems agent). Every district-specific rule the pass-1 generator had baked in now
// lives here as data + small decision functions, and a district kit (districts/<name>.js) passes its own copy to the shared
// generator (gen.js). BASE is exactly pass 1d's downtown: its tables and its rng draws, in the same order, so a kit that uses
// BASE builds bit-identical blocks (tools/audit.mjs hash proves it). Kits spread it and change what they need:
//   grammar: { ...BASE, storeys: { ...BASE.storeys, walkup: [2, 3] }, typeOf: (c, r, pick) => … }
// Decision functions receive the block rng `r`; draw from it only where BASE does, or every later choice in the block moves.
import { PAL, WALLS } from './style.js';
import { SHOPS, DELIS, CORPS, PLAQUES, GHOSTS, ADS, TAGS, BOARDS, YARD } from './lexicon.js';
import { THEMES } from './roofs.js';

// ── palette: wall colours (one per building, never repeated on neighbours), awnings, small street props, and the NEUTRAL MIX
export const AWNINGS = [PAL.red, PAL.green, PAL.yellow, 0x2f5bff, PAL.pink, 0xff7a1a, 0x7a3cff, 0x12b3a0];
export const PROP_COLOURS = [PAL.red, PAL.green, PAL.yellow, 0x2f5bff, PAL.pink, 0xff7a1a, 0x12b3a0];
// neutral walls (STYLE §2, pass 2): white, greys and neutral brick. Never pastel, never beige mush: clean, flat, a clear step apart.
export const NEUTRALS = { white: 0xf4f1ea, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, brick: 0x9b4f3a, buff: 0xc49a6c };
export const NEUTRAL_TONES = [NEUTRALS.white, NEUTRALS.brick, NEUTRALS.pale, NEUTRALS.buff, NEUTRALS.bone, NEUTRALS.grey, NEUTRALS.brick, NEUTRALS.slate];
export const PALETTE = {
  walls: WALLS, awnings: AWNINGS, props: PROP_COLOURS,
  // share: fraction of a district's buildings with a neutral wall (slime's default 30–40%). field: metres per noise cell — whole
  // blocks lean neutral or colourful (macro) and, inside a block, the neutral lots come in runs (micro), so colour lands in clusters.
  neutral: { share: .36, tones: NEUTRAL_TONES, field: 72, lotField: 17, keep: ['parking', 'alley', 'calm', 'transit'],
    lean: { tower: -.17, office: -.12, loft: -.04, bodega: .1, shop2: .1 } },   // added to the lot's score: lower = more likely neutral
};
// ── lexicon: names drawn without replacement per block (a kit swaps in its own voice)
export const LEXICON = { shops: SHOPS, delis: DELIS, corps: CORPS, plaques: PLAQUES, ghosts: GHOSTS, ads: ADS, tags: TAGS, boards: BOARDS, yard: YARD, themes: THEMES };

// ── the building types (gen.js builds each one): storeys, window styles, cornices, sign kinds
const pick = (r, opts) => { const t = opts.reduce((s, o) => s + o[1], 0); let x = r() * t; for (const [v, w] of opts) { if ((x -= w) < 0) return v; } return opts[0][0]; };
export const BASE = {
  towerKinds: 'D',                        // plan kinds whose big lots become towers (14 × 14 corner)
  lots: { corner: [6, 4], tower: 14, row: [4, 7], depth: 10 },   // corner lots 6–9 m square, row lots 4–7 m frontage, ≤ 10 m deep
  alley: .7,                              // chance a mid-row lot becomes the service alley
  // type of a lot. c = { b, l, corner, big, ave, tower, n }. BASE draws once per lot with pick(), exactly like pass 1d.
  typeOf(c, r) {
    if (c.tower && c.big) return 'tower';
    if (c.corner) return pick(r, c.tower ? [['office', 3], ['bodega', 2], ['walkup', 2], ['loft', 1]] : [['bodega', 3], ['walkup', 3], ['loft', 2], ['office', 1]]);
    if (c.l.front >= 8) return pick(r, c.tower ? [['office', 3], ['loft', 2], ['walkup', 1], ['shop2', 1]] : [['walkup', 4], ['loft', 2], ['shop2', 1], ['parking', c.n % 6 === 3 && !c.b.noParking ? 1 : 0]]);
    return pick(r, c.tower ? [['shop2', 2], ['walkup', 2], ['office', 1]] : [['brownstone', c.ave ? 1 : 4], ['walkup', 2], ['shop2', 2]]);
  },
  storeys(type, tower) { return { walkup: [4, 6], brownstone: [3, 4], bodega: [2, 4], loft: [5, 7], office: tower ? [7, 10] : [6, 8], shop2: [1, 2], parking: [0, 0], alley: [0, 0], tower: [11, 14] }[type] || [2, 3]; },
  // ground floor: 'shop' | 'stoop' | 'resi' | 'lobby' | 'parking' | 'alley'
  groundOf(c, r) { const t = c.type;
    return t === 'office' || t === 'tower' ? 'lobby' : t === 'brownstone' ? 'stoop' : (t === 'parking' || t === 'alley') ? t
      : (t === 'bodega' || t === 'shop2' || c.corner || c.ave) ? 'shop' : t === 'walkup' ? pick(r, [['shop', 5], ['stoop', 3], ['resi', 2]]) : pick(r, [['shop', 6], ['resi', 2]]); },
  twoShops(c, r) { return c.type !== 'bodega' && c.l.front >= 9 && r() < .65; },
  windows: { walkup: [['punched', 3], ['arched', 2], ['tall', 2], ['shutter', 2], ['balcony', 2], ['paired', 1], ['bay', 1]], brownstone: [['arched', 3], ['bay', 3], ['tall', 2], ['shutter', 1], ['punched', 1]],
    loft: [['loft', 4], ['paired', 2], ['tall', 1]], bodega: [['punched', 3], ['arched', 2], ['paired', 2], ['shutter', 1]], shop2: [['punched', 2], ['paired', 2], ['tall', 2], ['arched', 1], ['shutter', 1]], office: [['ribbon', 2], ['grid', 3]] },
  cornices: { walkup: [['bracket', 3], ['band', 2], ['deco', 2], ['crenel', 1], ['pediment', 2], ['sign', 1]], brownstone: [['bracket', 3], ['pediment', 2], ['band', 1], ['deco', 1]], loft: [['band', 2], ['deco', 2], ['sign', 2], ['thin', 1]],
    bodega: [['bracket', 3], ['band', 2], ['sign', 1]], shop2: [['sign', 3], ['band', 2], ['thin', 1], ['crenel', 1]], office: [['thin', 2], ['band', 2], ['deco', 2]] },
  signKinds: [['band', 3], ['box', 2], ['awnBox', 2], ['awnSlope', 3], ['neon', 2], ['blade', 1]],
  trimFor(r, wall) { const t = r(); if (t < .45) return PAL.cream; if (t < .8) return PAL.white; if (t < .9 && wall !== 0x2f5bff && wall !== 0x7a3cff) return PAL.ink; const c = [PAL.yellow, PAL.green, PAL.pink, 0x2de2e6, PAL.white].filter(c => c !== wall); return c[(r() * c.length) | 0]; },
  fire: (type, st) => (type === 'walkup' || type === 'loft') && st >= 3,
  fireBack: (type, st, r) => ['walkup', 'loft', 'brownstone'].includes(type) && st >= 3 && r() < .6,
  roofPeople: ['party', 'garden', 'pigeons', 'chill', 'tub', 'laundry', 'hoop', 'tent', 'pool'],   // the deck of roof scenes with people (2–3 roofs a block)
  // roof set pieces (setpieces.js): calm lots (pocket plaza / green) and 1–3 pieces per block, biggest roofs first, ≥ 10.5 m apart
  pieces: { calm: .6, count: [.62, .2], heroCount: 1, order: ['neon', 'tag', 'burger', 'ring', 'garden', 'pool', 'cash', 'court', 'sneaker', 'grow', 'party', 'billboard', 'pizza'] },
  oneOffs: ['couch', 'domino', 'cart', 'moving', 'carBlocks', 'yardsale'],   // one per block, by position
  life: [12, 22],                         // generated people per block (static life anchors; new districts use peds.js instead: life: [0, 0])
  windowPeople: .38, fireSitter: .45,     // chance of a window leaner per building, of a fire-escape sitter per fire escape
  walkway: 0,                             // metres of sidewalk kept clear for walkers (0 = pass 1d; new districts: 0.6)
};
