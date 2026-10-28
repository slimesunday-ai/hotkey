// FRESH REGISTRY · eyewear (slot 'eyewear'). This file has exactly one owner: the eyewear designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Eyewear. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).

// ── how a piece is built here
// FRONT: rows top → bottom at z 8 (one proud of the face). A 9-wide row covers x −9..−1 (x −9 is the hinge corner, one past the
//   head's edge) and is mirrored onto x 0..8; an 18-wide row covers x −9..8 as written (for an asymmetric piece).
// SIDE: rows at x −9 (mirrored to x 8), one char per z from 7 back to 3. The arms stop at z 3, a free cell short of the ear (z −1..1).
// The whole piece lives in the eye band, y 22..26: the brows (y 27..29) keep their rows, so every eye trait keeps its expression over
// the glasses, and nothing butts against a fringe or a hat's front above. One proud of the face everywhere, never more.
// UNDER, NOT OVER: every cell we use lies outside the bare head (z 8, or x −9 / 8), so anything already there is hair or a hat. We
// never write over it: arms slide under side hair, a fringe falls in front of the frame, a knit mask shows the lenses in its eye
// holes. (The same rule the construction applies to a covering hat's ear flap.) Nothing here reads ctx.look: the piece is fixed;
// what is worn above it decides only what of it stays in view.
const FZ = 8, MX = x => -1 - x, K = (x, y, z) => (x + 64) * 16384 + (y + 64) * 128 + (z + 64);
// the cells the last draw actually placed (compose runs a slot's fine pass right after its draw): fine paint goes only on those
let DRAWN = new Set();
const place = (H, x, y, z, c, l = 0) => { if (H.has(x, y, z)) return; H.set(x, y, z, c, l); if (H.has(x, y, z)) DRAWN.add(K(x, y, z)); };
function build({ top, front, side = [], sideTop = top, pal }) {
  return H => {
    DRAWN = new Set();
    const put = (x, y, z, ch) => { const p = pal[ch]; if (p) place(H, x, y, z, p[0], p[1] ?? 0); };
    front.forEach((r, j) => { const y = top - j;
      if (r.length === 18) { for (let i = 0; i < 18; i++) put(-9 + i, y, FZ, r[i]); return; }
      for (let i = 0; i < r.length; i++) { put(-9 + i, y, FZ, r[i]); put(MX(-9 + i), y, FZ, r[i]); } });
    side.forEach((r, j) => { const y = sideTop - j; for (let i = 0; i < r.length; i++) { put(-9, y, 7 - i, r[i]); put(8, y, 7 - i, r[i]); } });
  };
}

// ── fine paint, always on our own voxels (P.at), never "whatever is outermost" (a thick hairdo can stand past an arm)
// front: quarter coords qx = 4x + i (toward the character's left, +x), qy = 4y + j (up)
const at = (P, x, y, z, f, i, j, c) => { if (DRAWN.has(K(x, y, z))) P.at(x, y, z, f, i, j, c); };
const atZ = (P, qx, qy, c) => at(P, qx >> 2, qy >> 2, FZ, '+z', qx & 3, qy & 3, c);
// a bitmap on the front, as seen by someone facing the wearer: (qx, qy) is its top-left texel
const bmpZ = (P, rows, pal, qx, qy) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) atZ(P, qx + i, qy - j, c); } });
// the light's catch: one diagonal stroke on each lens, both leaning the same way (it is the sun's, not the lens's)
const glint = (P, qx, qy, n, c = 0xffffff, t = 2) => { for (let k = 0; k < n; k++) for (let s = 0; s < t; s++) atZ(P, qx + k + s, qy - k, c); };
// arms: text / marks on the outer face of both arms, reading front → back on each side, never mirrored
const atX = (P, x, face, qz, qy, c) => at(P, x, qy >> 2, qz >> 2, face, qz & 3, qy & 3, c);
function armBmp(P, rows, pal, y, zFront) {   // rows top → bottom (4 texels a voxel row), starting at the front end of the arm
  const W = Math.max(...rows.map(r => r.length)), qf = 4 * zFront + 3;
  rows.forEach((r, j) => { const qy = 4 * y + 3 - j; for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c === undefined) continue;
    atX(P, 8, '+x', qf - i, qy, c);             // the wearer's left arm: as seen from outside, left → right runs front → back
    atX(P, -9, '-x', qf - (W - 1) + i, qy, c); } });   // the right arm: left → right runs back → front; same span, read the same way
}

const INK = 0x17171b;

export default {
  // ── COMMON ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  corner_shades: {
    name: 'Corner Shades', tier: 'common', why: 'common · the five-dollar black squares off the bodega rack; every corner has a pair',
    draw: build({ top: 26, pal: { F: [INK, 1], L: [0x1d2230, 1] },
      front: ['FFFFFFFFF',
              '.FLLLLLF.',
              '.FLLLLLF.',
              '.FLLLLLF.',
              '..FFFFF..'],
      side: ['FFFFF'] }),
    fine(P) { glint(P, -27, 103, 4); glint(P, 9, 103, 4); },
  },
  county_frames: {
    name: 'County Frames', tier: 'common', why: 'common · thick brown issue frames, clear: what Iron Island hands back at release',
    draw: build({ top: 26, pal: { F: [0x3a2a1f, 0] },
      front: ['FFFFFFFFF',
              '.F.....F.',
              '.F.....F.',
              '.F.....F.',
              '.FFFFFF..'],
      side: ['FFFFF'] }),
  },
  bail_bonds_freebies: {
    name: 'Bail Bonds Freebies', tier: 'common', why: 'common · yellow giveaway shades from the 24-hour bail office, BAIL down both arms',
    draw: build({ top: 26, pal: { F: [0xffc21a, 1], L: [0x1f2a6b, 1] },
      front: ['FFFFFFFF.',
              '.FLLLLLFF',
              '.FLLLLLF.',
              '.FLLLLLF.',
              '..FFFFF..'],
      side: ['FFFFF'] }),
    fine(P) {
      glint(P, -27, 103, 3); glint(P, 9, 103, 3);
      armBmp(P, ['BB...A..I.L..', 'BBB.A.A.I.L..', 'B.B.AAA.I.L..', 'BBB.A.A.I.LLL'], { B: 0x1f2a6b, A: 0x1f2a6b, I: 0x1f2a6b, L: 0x1f2a6b }, 26, 6);
    },
  },
  shop_specs: {
    name: 'Shop Specs', tier: 'common', why: 'common · orange-browed safety glasses with side shields: the smith, the digger, the shack',
    draw: build({ top: 26, pal: { O: [0xff7a1a, 0], S: [0xbfd6db, 1] },
      front: ['OOOOOOOOO',
              'SS.......',
              'SS.......',
              'SS.......',
              '.SSSSSS..'],
      side: ['OOOOO', 'SS...', 'SS...', 'SS...'] }),
  },
  taped_up: {
    name: 'Taped Up', tier: 'common', why: 'common · thick black frames, the bridge wrapped in white tape: a fight\'s worth of repairs',
    draw: build({ top: 26, pal: { F: [INK, 0], T: [0xf1ede4, 0] },
      front: ['FFFFFFFFF',
              '.F.....TT',
              '.F.....TT',
              '.F.....F.',
              '.FFFFFF..'],
      side: ['FFFFF'] }),
    fine(P) {   // the turns of tape: grey edges where each wrap overlaps the last
      for (const x of [-2, -1, 0, 1]) for (const y of [25, 24]) for (let j = 0; j < 4; j++) at(P, x, y, FZ, '+z', x < 0 ? 2 : 1, j, 0xbdb5a6);
      for (const x of [-2, -1, 0, 1]) for (let i = 0; i < 4; i++) at(P, x, 24, FZ, '+z', i, 0, 0xd6cfc1);
    },
  },
  bodega_readers: {
    name: 'Bodega Readers', tier: 'common', why: 'common · drugstore half-moons riding low on the nose; the man behind the counter reads you over them',
    draw: build({ top: 24, pal: { F: [0x8c1f2a, 1] },
      front: ['FF.....F.',
              '.F.....FF',
              '.FFFFFF..'],
      side: ['FFFFF'] }),
  },

  // ── RARE ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  getaway_wraps: {
    name: 'Getaway Wraps', tier: 'rare', why: 'rare · one fire-orange mirror wrapped ear to ear: the corner sees out, nobody sees in',
    draw: build({ top: 26, pal: { F: [INK, 1], L: [0xff5a1f, 1] },
      front: ['FFFFFFFFF',
              'LLLLLLLLL',
              'LLLLLLLL.',
              '.LLLLLL..'],
      side: ['FFFFF', 'LL...', 'L....'] }),
    fine(P) { glint(P, -27, 103, 5); glint(P, 9, 103, 5); },
  },
  precinct_aviators: {
    name: 'Precinct Aviators', tier: 'rare', why: 'rare · gold wire, mirror drops: the badge you can see from across the plaza',
    draw: build({ top: 26, pal: { G: [0xf0b02a, 1], S: [0x8cc4f0, 1], M: [0xe2e8ee, 1] },
      front: ['GGGGGGGGG',
              '.SSSSSSG.',
              '.MMMMMMG.',
              '.GMMMMG..',
              '..GGGG...'],
      side: ['GGGGG'] }),
    fine(P) { glint(P, -31, 103, 4); glint(P, 9, 103, 4); },
  },
  fit_street_cat_eyes: {
    name: 'Fit Street Cat-Eyes', tier: 'rare', why: 'rare · hot-pink flicks with a stone at each tip, straight off the Fit Street racks',
    draw: build({ top: 27, pal: { P: [0xff4fa3, 1], L: [0x141418, 1] },
      front: ['PP.......',
              'PPPPPPPP.',
              '.PLLLLLPP',
              '.PLLLLLP.',
              '..PLLLP..',
              '...PPP...'],
      side: ['.....', 'PPPPP'] }),
    fine(P) { for (const [qx, qy] of [[-35, 110], [-34, 110], [-35, 109], [-34, 109]]) { atZ(P, qx, qy, 0xffffff); atZ(P, -1 - qx, qy, 0xffffff); } glint(P, -27, 103, 3); glint(P, 9, 103, 3); },
  },
  spotlight_ovals: {
    name: 'Spotlight Ovals', tier: 'rare', why: 'rare · fat white rims round black ovals: the stage look, worn to the bodega',
    draw: build({ top: 26, sideTop: 24, pal: { W: [0xf3f0e8, 1], L: [0x141418, 1] },
      front: ['..WWWWW..',
              '.WWLLLWW.',
              'WWLLLLLWW',
              '.WWLLLWW.',
              '..WWWWW..'],
      side: ['WWWWW'] }),
    fine(P) { glint(P, -23, 103, 2); glint(P, 13, 103, 2); },
  },
  gallery_rounds: {
    name: 'Gallery Rounds', tier: 'rare', why: 'rare · little orange discs in black wire: the editorial squint, opening night downtown',
    draw: build({ top: 26, sideTop: 24, pal: { F: [INK, 1], L: [0xff7a1a, 1] },
      front: ['...FFF...',
              '..FLLLF..',
              'FFFLLLFFF',
              '..FLLLF..',
              '...FFF...'],
      side: ['FFFFF'] }),
    fine(P) { glint(P, -23, 103, 2, 0xffe2b0, 1); glint(P, 13, 103, 2, 0xffe2b0, 1); },
  },
  cat_burglar: {
    name: 'Cat Burglar', tier: 'rare', why: 'rare · the black band with two holes: dark houses, quiet feet',
    draw: build({ top: 26, pal: { K: [0x141418, 0] },
      front: ['.KKKKKKKK',
              'KKK...KKK',
              'KKK...KKK',
              '.KKKKKKK.'],
      side: ['KKKKK', 'KKKKK', 'KKKKK', 'KKKKK'] }),
  },
  slim_slits: {
    name: 'Slim Slits', tier: 'rare', why: 'rare · two red slivers on a chrome bar: barely there, impossible to miss',
    draw: build({ top: 25, pal: { C: [0xcfd6dd, 1], L: [0xe8232a, 1] },
      front: ['CCLLLLLCC',
              '..LLLLL..'],
      side: ['CCCCC'] }),
    fine(P) { glint(P, -27, 103, 2, 0xffd0d0, 1); glint(P, 9, 103, 2, 0xffd0d0, 1); },
  },

  // ── EPIC ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  afterhours_shield: {
    name: 'Afterhours Shield', tier: 'epic', why: 'epic · one violet mirror from ear to ear, 4AM etched in the corner',
    draw: build({ top: 26, pal: { C: [0xcfd6dd, 1], V: [0x7a3cff, 1] },
      front: ['CCCCCCCCC',
              'VVVVVVVVV',
              'VVVVVVVVV',
              '.VVVVVVV.',
              '..VVVVV..'],
      side: ['CCCCC', 'VV...', 'VV...', 'V....'] }),
    fine(P) {
      glint(P, -30, 103, 5, 0xe9dcff);
      bmpZ(P, ['W.W..W..W...W', 'W.W.W.W.WW.WW', 'WWW.WWW.W.W.W', '..W.W.W.W...W', '..W.W.W.W...W'], { W: 0xffffff }, 13, 102);
    },
  },
  neon_row_shutters: {
    name: 'Neon Row Shutters', tier: 'epic', why: 'epic · lit pink shutter slats: you see the eyes through the gaps, the block sees the glow',
    draw: build({ top: 26, pal: { N: [0xff4fa3, 3], F: [INK, 1] },
      front: ['NNNNNNNNN',
              '.F.....F.',
              '.FNNNNNNN',
              '.F.....F.',
              '.FNNNNN..'],
      side: ['FFFFF'] }),
  },
  gatehill_oversize: {
    name: 'Gatehill Oversize', tier: 'epic', why: 'epic · big smoked squares on gold arms: the lobby doorman nods at these',
    draw: build({ top: 26, pal: { K: [INK, 1], L: [0x3a2219, 1], G: [0xf0b02a, 1] },
      front: ['GKKKKKKK.',
              '.KLLLLLKG',
              '.KLLLLLK.',
              '.KLLLLLK.',
              '.KKKKKK..'],
      side: ['GGGGG'] }),
    fine(P) { glint(P, -27, 103, 4, 0xb58a73); glint(P, 9, 103, 4, 0xb58a73);
      for (const [qx, qy] of [[-32, 107], [-31, 107], [-32, 106], [-31, 106]]) { atZ(P, qx, qy, 0xf2b92b); atZ(P, -1 - qx, qy, 0xf2b92b); } },
  },

  kingpin_golds: {
    name: 'Kingpin Golds', tier: 'epic', why: 'epic · a heavy gold browbar over wine lenses: the old-school kingpin pair, still worth robbing',
    draw: build({ top: 26, pal: { G: [0xf0b02a, 1], L: [0x5a1424, 1], l: [0xb8384f, 1] },
      front: ['GGGGGGGGG',
              'GGGGGGGGG',
              '.GLLLLLG.',
              '.GlllllG.',
              '..GGGGG..'],
      side: ['GGGGG', 'GG...'] }),
    fine(P) {
      for (let x = -9; x <= -1; x++) for (let i = 0; i < 4; i++) { atZ(P, 4 * x + i, 103, 0xc98a14); atZ(P, 4 * MX(x) + i, 103, 0xc98a14); }   // the bar's engraved seam
      for (const [qx, qy] of [[-34, 105], [-34, 101]]) { atZ(P, qx, qy, 0xfff1c4); atZ(P, -1 - qx, qy, 0xfff1c4); }                         // the hinge screws
      glint(P, -27, 99, 3, 0xd77a8a); glint(P, 9, 99, 3, 0xd77a8a);
    },
  },

  // ── GRAIL ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  gatehill_woods: {
    name: 'Gatehill Woods', tier: 'grail', why: 'grail · rimless brown lenses, gold studs, wood arms: the pair that gets you robbed',
    draw: build({ top: 26, pal: { L: [0x6e3a1e, 1], l: [0xc27a3a, 1], G: [0xf0b02a, 1], W: [0x8b5a2b, 0] },
      front: ['GGLLLLL..',
              '.LLLLLLGG',
              '.llllll..',
              '..lllll..'],
      side: ['GWWWW', 'WWWW.'] }),
    fine(P) { glint(P, -30, 103, 3, 0xb98a64); glint(P, 9, 103, 3, 0xb98a64);
      armBmp(P, ['..dddddddd..', '............', 'dddd...ddddd', '......dd....', '.ddddddd..dd', '............', 'ddd..dddddd.', '..........dd'], { d: 0x5e3a1a }, 26, 6); },
  },
  ice_box: {
    name: 'Ice Box', tier: 'grail', why: 'grail · a frame paved in stones, black glass inside: it throws light down the whole block',
    draw: build({ top: 26, pal: { I: [0xd6f1ff, 1], L: [0x101014, 1] },
      front: ['IIIIIIIII',
              '.ILLLLLI.',
              '.ILLLLLI.',
              '.ILLLLLI.',
              '.IIIIII..'],
      side: ['IIIII'] }),
    fine(P) {
      // pavé: white stones and their blue fire scattered over an ice base, and stars where a stone catches the sun
      const stone = (qx, qy) => { const h = Math.imul(qx * 73856093 ^ qy * 19349663, 0x9e3779b1) >>> 0, k = (h >>> 9) % 16; return k < 5 ? 0xffffff : k < 7 ? 0x7cc8f0 : null; };
      const pave = (x, y) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const c = stone(4 * x + i, 4 * y + j); if (c) at(P, x, y, FZ, '+z', i, j, c); } };
      const frame = []; for (let x = -9; x <= -1; x++) frame.push([x, 26]); for (const y of [25, 24, 23]) frame.push([-8, y], [-2, y]); for (let x = -8; x <= -3; x++) frame.push([x, 22]);
      for (const [x, y] of frame) { pave(x, y); pave(MX(x), y); }
      for (const [qx, qy] of [[-30, 105], [-17, 106], [-11, 89], [-31, 94], [5, 105], [21, 105], [25, 97], [14, 89]]) for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) atZ(P, qx + a, qy + b, 0xffffff);
      glint(P, -27, 103, 4); glint(P, 9, 103, 4);
    },
  },
};
