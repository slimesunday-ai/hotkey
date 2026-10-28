// FRESH REGISTRY · bottoms (slot 'bottom'). This file has exactly one owner: the bottoms designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Bottoms. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep, the lower-body motion check).
//
// Every bottom here sits on the approved fuller leg form: `roomy` (full length) or `longshorts` (the same profile cut at the knee).
// The geometry is never touched; each trait paints its cells (paint(q)) and adds sub-voxel detail in fine(P, ctx).
// Leg map (roomy), per leg, u counted outwards from the inner gap: y4 cuff u0..4 · y5..8 thigh/shin u0..3, front face z 3 on u0..2 ·
// the waistband is y10 (one colour, `waist`). x = −2 − u on the x<0 leg, 1 + u on the x>0 leg.
import { shade, hash3 } from './kit.js';

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const LX = (side, u) => (side < 0 ? -2 - u : 1 + u);
const SIDES = [-1, 1];
// front-face quarter coordinate for leg column u, texel `io` counted outwards (0 inner .. 3 outer), mirrored per leg
const qx = (side, u, io) => 4 * LX(side, u) + (side < 0 ? 3 - io : io);
// the outer side face of a leg (x<0 leg faces −x, x>0 leg faces +x)
const outFace = side => (side < 0 ? '-x' : '+x');
// a horizontal run of texels across the front of a leg: columns u0..2 (12 texels), row qb, colour c (or fn(t) → colour, t 0..11 outwards)
function frontRow(P, side, qb, c, t0 = 0, t1 = 12) {
  for (let t = t0; t < t1; t++) { const u = t >> 2, io = t & 3, col = typeof c === 'function' ? c(t) : c; if (col !== undefined && col !== null) P.paint('+z', qx(side, u, io), qb, col); }
}
// a vertical run on the front of a leg at outward texel t (0..11), from texel row qb0 to qb1 (exclusive)
function frontCol(P, side, t, qb0, qb1, c) { const u = t >> 2, io = t & 3; for (let b = qb0; b < qb1; b++) P.paint('+z', qx(side, u, io), b, c); }
// a tiny bitmap font (3 wide); rows top → bottom
const FONT = {
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'], O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], N: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  C: ['XXX', 'X..', 'X..', 'X..', 'XXX'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], S: ['XXX', 'X..', 'XXX', '..X', 'XXX'], I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 7: ['XXX', '..X', '.X.', '.X.', '.X.'], 9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'], ' ': ['...', '...', '...', '...', '...'],
};
// text → bitmap rows (h rows of the font: 5, or 3 = rows 0, 2, 4 squeezed), one blank column between letters
function textRows(s, h = 5) {
  const pick = h === 3 ? [0, 2, 4] : [0, 1, 2, 3, 4];
  return pick.map(r => [...s].map(ch => (FONT[ch] || FONT[' '])[r]).join('.'));
}

// ── the bottoms ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export default {

  // ═══ COMMON ═══

  deli_khakis: {
    name: 'Deli Khakis', tier: 'common',
    why: 'common · the corner uniform: pressed sand work pant, black belt, a crease you could cut a lime with',
    form: 'roomy', color: 0xd9b06c, waist: 0x232226,
    paint(q) { if (q.y === 4) return 0xc79c58; },   // the turned-up hem, a shade down
    fine(P) {
      for (const s of SIDES) {
        frontCol(P, s, 5, 20, 36, 0xb68a47);               // the front crease, ankle to hip
        for (let k = 0; k < 5; k++) P.paint('+z', qx(s, (7 + k) >> 2, (7 + k) & 3), 35 - k, 0xb68a47);   // the slash pocket, waist to outseam
      }
      P.rect('+z', 4 * -5 + 2, 4 * 10 + 1, 4 * -5 + 4, 4 * 10 + 3, 0xc9c9c9);   // the belt's steel buckle tip (front of the band)
    },
  },

  ash_sweats: {
    name: 'Ash Heavyweight Sweats', tier: 'common',
    why: 'common · 500-gram fleece in ash, ribbed cuff, white cord: the default of every stoop on the island',
    form: 'roomy', color: 0xc4c6cb, waist: 0xb3b6bc,
    paint(q) { if (q.y === 4) return 0xa9acb3; },   // the ribbed cuff
    fine(P) {
      for (const s of SIDES) {
        for (let t = 1; t < 16; t += 2) { const u = t >> 2; if (u > 3) break; for (let j = 0; j < 4; j++) P.paint('+z', qx(s, u, t & 3), 16 + j, 0x969aa2); }   // rib lines on the cuff
      }
      // the white drawcord, knotted at the front of the band
      P.rect('+z', -4, 41, 4, 42, 0xf4f3ee); P.rect('+z', -3, 40, -2, 41, 0xf4f3ee); P.rect('+z', 1, 40, 2, 41, 0xf4f3ee);
      // a tiny woven tab on the x>0 thigh: black square, bone mark
      P.bmp('+z', ['KKKK', 'KWWK', 'KKKK'], { K: 0x1c1c20, W: 0xece6d6 }, qx(1, 2, 0), 34);
    },
  },

  raw_indigo: {
    name: 'Raw Indigo 14oz', tier: 'common',
    why: 'common · dark rigid denim, copper stitch, the hem rolled once to flash the selvedge',
    form: 'roomy', color: 0x2f3f8f, waist: 0x2f3f8f,
    paint(q) { if (q.y === 4) return 0xc9d0e2; },   // the roll-up: the pale inside of the denim
    fine(P) {
      const cu = 0xd9822b;
      for (const s of SIDES) {
        frontCol(P, s, 11, 20, 36, cu);                       // the outseam stitch, front edge
        for (const [t, b] of [[6, 35], [6, 34], [7, 33], [8, 32], [9, 32], [10, 31]]) P.paint('+z', qx(s, t >> 2, t & 3), b, cu);   // the front pocket's curve
        P.paint('+z', qx(s, 2, 2), 34, 0xe0a060);             // a copper rivet at its corner
        frontRow(P, s, 19, 0xe8232a, 0, 12);                  // the red selvedge line on the roll-up
      }
      P.rect('-z', 4 * 1 + 1, 4 * 10, 4 * 2 + 3, 4 * 10 + 4, 0xb87a46);   // the leather patch on the back of the band
    },
  },

  blackout_cargo: {
    name: 'Blackout Cargo', tier: 'common',
    why: 'common · black ripstop, a bellows pocket on each thigh and one safety-orange pull tab',
    form: 'roomy', color: 0x2c2e34, waist: 0x232429,
    paint(q) {
      if (q.u === 3 && q.y >= 5 && q.y <= 7) return q.y === 7 ? 0x24262b : 0x383b42;   // the bellows pocket on the outer thigh, flap on top
      if (q.y === 4) return 0x24262b;                                                  // the cuffed hem
    },
    fine(P) {
      for (const s of SIDES) {
        const f = outFace(s);
        P.rect(f, 4 * -2, 4 * 7, 4 * 1, 4 * 7 + 1, 0x18191d);          // the flap's bottom edge
        P.rect(f, 4 * -1 + 1, 4 * 6 + 1, 4 * -1 + 3, 4 * 6 + 3, 0x5d616b);   // the snap under the flap
      }
      P.rect('-x', 4 * 0, 4 * 6, 4 * 0 + 2, 4 * 7 + 3, 0xff6a13);       // the orange pull tab, one leg only
    },
  },

  stoop_jorts: {
    name: 'Stoop Jorts', tier: 'common',
    why: 'common · light-wash long jorts, frayed hem, white tube socks pulled all the way up',
    form: 'longshorts', color: 0x86a9dc, waist: 0x86a9dc, sock: 'crew', sockColor: 0xf3f1ea,
    fine(P) {
      for (const s of SIDES) {
        frontRow(P, s, 24, t => (t % 3 === 1 ? 0xeef3fa : 0xc6d6ee));   // the fray: pale threads on the hem's bottom texel row
        frontRow(P, s, 25, t => (t % 4 === 2 ? 0xeef3fa : undefined));
        frontCol(P, s, 11, 24, 36, 0xe2b04a);                          // gold outseam stitch
        frontRow(P, s, 22, 0xd8262e);                                 // tube-sock stripes, red over cobalt
        frontRow(P, s, 20, 0x2f5bff);
      }
    },
  },

  pine_st_mesh: {
    name: 'Pine St. Mesh', tier: 'common',
    why: 'common · purple and gold ball shorts from the Pine St. league, ankle socks, number 9 on the leg',
    form: 'longshorts', color: 0x6a2fd2, waist: 0xffc21a, sock: 'ankle', sockColor: 0xf3f1ea,
    paint(q) {
      if (q.socks) return;
      if (q.u === 3) return 0xffc21a;                  // the gold side panel
      if (q.y === 6) return 0x5a26b5;                  // the hem band
    },
    fine(P) {
      for (const s of SIDES) frontCol(P, s, 11, 24, 36, 0xf7f4ec);   // white piping where purple meets gold
      // the number: a gold 9 on the x<0 leg's thigh
      P.bmp('+z', textRows('9'), { X: 0xffc21a }, qx(-1, 1, 3) - 0, 35);
    },
  },

  // ═══ RARE ═══

  concrete_camo: {
    name: 'Concrete Camo Cargo', tier: 'rare',
    why: 'rare · block-digital urban camo in sidewalk, slate and asphalt: hide in plain sight on any corner',
    form: 'roomy', color: 0x8e9199, waist: 0x3f4248,
    paint(q) {
      const pal = [0xd5cfc2, 0x8e9199, 0x55585f, 0x8e9199, 0x2e3035];
      const bx = Math.floor((q.x + 16) / 2), by = Math.floor((q.y + (q.side < 0 ? 1 : 0)) / 2), bz = Math.floor((q.z + 8) / 2);
      return pal[hash3(bx, by, bz) % pal.length];
    },
    fine(P) {
      for (const s of SIDES) { const f = outFace(s); P.rect(f, 4 * -2, 4 * 7 + 3, 4 * 1, 4 * 7 + 4, 0x2e3035); }   // cargo flap seams
    },
  },

  buffalo_check: {
    name: 'Buffalo Check Lounge', tier: 'common',
    why: 'common · red-and-black buffalo check lounge pants: slides on, out for a chopped cheese',
    form: 'roomy', color: 0xd52a2f, waist: 0x1c1a1e,
    paint(q) {
      const v = (q.u >> 1) & 1, h = (q.y >> 1) & 1;
      return v && h ? 0x1c1a1e : v || h ? 0x7e1820 : 0xd52a2f;
    },
  },

  after_hours_tricot: {
    name: 'After-Hours Tricot', tier: 'rare',
    why: 'rare · shiny cobalt track pant, one fat white side stripe piped in red, zips at the ankle',
    form: 'roomy', color: 0x2350e0, waist: 0x2350e0,
    paint(q) {
      const stripe = (q.u === 3 && q.y >= 5 && q.z >= -1 && q.z <= 0) || (q.y === 4 && q.u === 4) || (q.y === 9 && q.u === 3);
      return stripe ? [0xf6f4ee, 1] : [0x2350e0, 1];
    },
    fine(P) {
      for (const s of SIDES) {
        const f = outFace(s);
        for (let y = 4 * 5; y < 4 * 9; y++) { P.paint(f, 4 * -1 - 1, y, 0xe8232a); P.paint(f, 4 * 1, y, 0xe8232a); }   // red piping on both edges
        P.rect(f, 4 * -1 + 1, 4 * 4, 4 * -1 + 3, 4 * 5 + 2, 0xbfc3cc);     // the ankle zip
      }
    },
  },

  iron_island_issue: {
    name: 'Iron Island Issue', tier: 'rare',
    why: 'rare · the orange you only get by doing time: stencilled number, elastic waist, no pockets',
    form: 'roomy', color: 0xff7a1a, waist: 0xe86a10,
    fine(P) {
      const K = { X: 0x1d1c20 };
      P.bmp('+z', textRows('917'), K, qx(-1, 2, 3), 35);   // the inmate number, x<0 thigh
      P.bmp('+z', textRows('II'), K, qx(1, 0, 1), 35);    // Iron Island, x>0 thigh
      for (const s of SIDES) frontRow(P, s, 26, 0x1d1c20, 0, 12);   // a stencil bar across each shin
    },
  },

  drop_cloth_painter: {
    name: 'Drop Cloth Painter', tier: 'rare',
    why: 'rare · bone painter pants that came back from a mural job wearing half the city\'s sign colours',
    form: 'roomy', color: 0xeee6d2, waist: 0xeee6d2,
    paint(q) {
      // three full-voxel drops so the splatter still reads from across the street
      if (q.x === -3 && q.y === 7 && q.z === 3) return 0xff4fa3;
      if (q.x === 2 && q.y === 5 && q.z === 3) return 0x2de2e6;
      if (q.x === 4 && q.y === 8 && q.z === -1) return 0xffe23a;
      if (q.u === 3 && q.y === 6) return 0xded5bd;   // the hammer loop
    },
    fine(P) {
      const R = 0xe8232a, Y = 0xffd21a, C = 0x2de2e6, G = 0x14a83b, Pk = 0xff4fa3, K = 0x1d1c20;
      const dot = (s, t, qb, c, w = 1, h = 1) => { for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) { const tt = t + a; if (tt < 12) P.paint('+z', qx(s, tt >> 2, tt & 3), qb - b, c); } };
      dot(-1, 1, 33, R, 2, 2); dot(-1, 3, 30, R); dot(-1, 8, 27, Y, 2, 1); dot(-1, 9, 25, Y); dot(-1, 5, 22, K, 1, 2); dot(-1, 10, 34, C);
      dot(-1, 4, 30, Pk); dot(-1, 6, 31, Pk);
      dot(1, 2, 35, G, 2, 2); dot(1, 3, 32, G); dot(1, 7, 29, Pk, 2, 2); dot(1, 9, 26, Pk); dot(1, 1, 24, R); dot(1, 10, 31, Y, 1, 2);
      dot(1, 6, 23, C); dot(1, 8, 22, C);
    },
  },

  club_velour: {
    name: 'Club Velour', tier: 'rare',
    why: 'rare · wine velour track pant with gold piping: Sunday-night social-club money',
    form: 'roomy', color: 0x8a1d3c, waist: 0x76172f,
    paint(q) { if (q.y === 4) return 0x76172f; },   // the cuffed ankle
    fine(P) {
      for (const s of SIDES) frontCol(P, s, 11, 20, 36, 0xe2b13c);   // the gold piping down the front edge
      P.bmp('+z', ['.G.G.', '.G.G.', '..G..'], { G: 0xe2b13c }, qx(1, 1, 0), 34);   // a little embroidered V
    },
  },

  busted_knee_denim: {
    name: 'Busted Knee Denim', tier: 'rare',
    why: 'rare · mid-wash jeans blown out at both knees, white threads hanging across the skin',
    form: 'roomy', color: 0x4d79c4, waist: 0x4d79c4,
    paint(q) { if (q.y === 8 && q.z === 3 && q.u <= 1) return 0x6a90d2; },   // the faded thigh
    fine(P, ctx) {
      // a ragged blow-out across each knee: per texel row [first, last] outward texel; threads on two rows; frayed pale edges
      const RIP = { 30: [3, 7], 29: [2, 9], 28: [1, 9], 27: [2, 10], 26: [1, 8], 25: [3, 7] }, W = 0xf1eee6, E = 0xbcd0ee;
      for (const s of SIDES) for (const [b0, [t0, t1]] of Object.entries(RIP)) { const b = +b0, off = s < 0 ? 0 : 1;
        for (let t = t0 - 1 + off; t <= t1 + 1 + off && t < 12; t++) { const u = t >> 2, x = LX(s, u), y = b >> 2, edge = t < t0 + off || t > t1 + off;
          P.paint('+z', qx(s, u, t & 3), b, edge ? E : (b === 29 || b === 27 || b === 25) && t % 3 !== 0 ? W : ctx.sk.c(x, y, 3)); } }
    },
  },

  // ═══ EPIC ═══

  do_not_cross: {
    name: 'Do Not Cross', tier: 'epic',
    why: 'epic · black pants wrapped in yellow crime-scene tape, a different height on each leg',
    form: 'roomy', color: 0x202026, waist: 0x202026,
    paint(q) {
      const band = q.side < 0 ? (q.y === 7 || q.y === 4) : (q.y === 8 || q.y === 5);
      if (band) return 0xffd21a;
    },
    fine(P) {
      // the tape's print, a 3-texel font, read across each band's front
      const F3 = { D: ['XX.', 'X.X', 'XX.'], O: ['.X.', 'X.X', '.X.'], N: ['XX.', 'X.X', 'X.X'], T: ['XXX', '.X.', '.X.'], C: ['.XX', 'X..', '.XX'],
        R: ['XX.', 'XX.', 'X.X'], S: ['.XX', '.X.', 'XX.'], ' ': ['..', '..', '..'] };
      const msg = 'DO NOT CROSS ', strip = [0, 1, 2].map(r => [...msg].map(c => F3[c][r]).join('.'));
      const K = 0x18181c, bands = [[-1, 7, 0], [-1, 4, 13], [1, 8, 6], [1, 5, 20]];
      for (const [s, y, off] of bands) for (let t = 0; t < 12; t++) for (let r = 0; r < 3; r++) {
        // read left → right as seen from the front, whichever leg
        const col = s < 0 ? 11 - t : t, ch = strip[r][(col + off) % strip[r].length];
        if (ch === 'X') P.paint('+z', qx(s, t >> 2, t & 3), 4 * y + 3 - r, K);
      }
    },
  },

  credit_print: {
    name: 'Credit Print', tier: 'epic',
    why: 'epic · an invented 20-credit note blown up down each thigh, guilloche green all round: wearing the stash',
    form: 'roomy', color: 0xa8d896, waist: 0x1f7a45,
    paint(q) {
      if (q.y === 4) return 0x1f7a45;                         // a money-green cuff
      if (q.z < 3 && (q.y === 6 || q.y === 8)) return 0x7fbf6e;   // the guilloche bands round the sides and back
    },
    fine(P) {
      // the note, 12 × 16 texels on each leg's front, read as seen from the front
      const note = [
        'GGGGGGGGGGGG',
        'G2.0....2.0G',
        'G..........G',
        'G...GGGG...G',
        'G..G....G..G',
        'G.G..99..G.G',
        'G.G.9..9.G.G',
        'G.G..999.G.G',
        'G.G....9.G.G',
        'G.G..99..G.G',
        'G..G....G..G',
        'G...GGGG...G',
        'G..........G',
        'G.CR...CR..G',
        'G..........G',
        'GGGGGGGGGGGG',
      ];
      const pal = { G: 0x1f7a45, 2: 0x1f7a45, 0: 0x1f7a45, 9: 0x14532f, C: 0x1f7a45, R: 0x1f7a45 };
      for (const s of SIDES) P.bmp('+z', note, pal, 4 * LX(s, s < 0 ? 2 : 0), 35);
    },
  },

  neon_row_leather: {
    name: 'Neon Row Leather', tier: 'epic',
    why: 'epic · gloss black leather with ribbed biker knees and chrome ankle zips: the club line parts',
    form: 'roomy', color: 0x1b1b20, waist: 0x1b1b20,
    paint(q) {
      if (q.y === 4 && q.u >= 3) return [0xd3d8e2, 1];   // chrome zip hardware at the outer ankle
      return [0x1b1b20, 1];
    },
    fine(P) {
      for (const s of SIDES) {
        for (const b of [25, 27, 29]) frontRow(P, s, b, 0x34343c, 0, 12);   // the ribbed knee panel
        frontCol(P, s, 11, 20, 36, 0xff4fa3);                          // hot-pink top-stitch down the outseam
      }
    },
  },

  swap_meet_patchwork: {
    name: 'Swap Meet Patchwork', tier: 'epic',
    why: 'epic · one-off patchwork from the Heap\'s swap meet: four washes, a red bandana square, hand stitching',
    form: 'roomy', color: 0x3a56a8, waist: 0x2a2f45,
    paint(q) {
      const L = q.side < 0, top = q.y >= 7, out = q.u >= 2, front = q.z >= 1;
      if (L && top && !out) return 0x88aee0;                // light wash
      if (L && !top && out) return 0x23284a;                // black denim
      if (!L && top && out) return 0xc4252c;                // the bandana square
      if (!L && !top && !out && front) return 0x5b84cc;     // mid wash
      if (!L && !top && out) return 0x88aee0;
    },
    fine(P) {
      const W = 0xf2efe6;
      for (const s of SIDES) { frontRow(P, s, 28, t => (t % 2 ? W : undefined)); frontCol(P, s, 8, 20, 36, W); }   // running stitch round the patches
      // paisley-ish white marks on the bandana square
      P.bmp('+z', ['W..W', '.WW.', 'W...', '..W.', 'W..W', '.W..', '...W', 'W...'], { W: 0xf6f1e4 }, qx(1, 2, 0), 35);
    },
  },

  // ═══ GRAIL ═══

  gatehill_croc: {
    name: 'Gatehill Croc', tier: 'grail',
    why: 'grail · emerald crocodile leather with a gold belt and gold-tipped ankle zips: penthouse money worn to the corner',
    form: 'roomy', color: 0x10915f, waist: 0xe0b03c,
    paint(q) {
      if (q.y === 4 && q.u >= 3) return [0xf0c24a, 1];   // the gold zip ends at the outer ankle
      return [0x10915f, 1];
    },
    fine(P) {
      // the scales: grout lines on every front face, the vertical ones offset brick-wise row to row
      const g = 0x0a6844;
      for (const s of SIDES) for (let y = 5; y <= 8; y++) for (let t = 0; t < 12; t++) {
        P.paint('+z', qx(s, t >> 2, t & 3), 4 * y, g);
        if ((t + (y & 1) * 2) % 4 === 0) for (let j = 1; j < 4; j++) P.paint('+z', qx(s, t >> 2, t & 3), 4 * y + j, g);
      }
      for (const s of SIDES) { const f = outFace(s); for (let y = 5; y <= 8; y++) for (let k = 4 * -2; k < 4 * 1; k++) {
        P.paint(f, k, 4 * y, g); if ((k + (y & 1) * 2) % 4 === 0) for (let j = 1; j < 4; j++) P.paint(f, k, 4 * y + j, g); } }
    },
  },

  iced_out_denim: {
    name: 'Iced Out Denim', tier: 'grail',
    why: 'grail · black denim set with rows of rhinestones down both legs: the Most Wanted wears it to court',
    form: 'roomy', color: 0x24252c, waist: 0x24252c,
    fine(P) {
      // rhinestones in a diamond lattice down each leg's front: 2 × 2 texel stones, ice-white with a blue facet
      for (const s of SIDES) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        const t = 1 + 4 * c + (r & 1 ? 2 : 0); if (t > 10) continue;
        const b = 34 - 3 * r;
        P.paint('+z', qx(s, t >> 2, t & 3), b, 0xf4f8ff); P.paint('+z', qx(s, (t + 1) >> 2, (t + 1) & 3), b, 0xd7e6ff);
        P.paint('+z', qx(s, t >> 2, t & 3), b - 1, 0xb9d3ff); P.paint('+z', qx(s, (t + 1) >> 2, (t + 1) & 3), b - 1, 0xf4f8ff);
      }
      // a row of stones round the outer side of each thigh, and a silver outseam stitch
      for (const s of SIDES) { const f = outFace(s); for (const k of [-7, -3, 1]) { P.paint(f, k, 34, 0xf4f8ff); P.paint(f, k + 1, 33, 0xd7e6ff); } }
    },
  },
};
