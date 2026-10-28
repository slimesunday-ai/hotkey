// FRESH REGISTRY · tops (slot 'top'). This file has exactly one owner: the tops designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Tops. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// THE BATCH (2026-10-01): seventeen tops for a city that is a crime world first. Every brand, crest, team, union and name on them is
// invented. Tier sits in `tier` and leads the `why` line: common (what the corner wears), rare (a flex), epic (status from across the
// street), grail (the drop everyone queues for, and the thing that gets you robbed).
import { shade, hash3 } from './kit.js';

// ───────────────────────── helpers (construction shared by every top below)
// a 3 × 5 texel font for fine paint
const FONT = {
  A: ['###', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['###', '#..', '#..', '#..', '###'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['###', '#..', '#.#', '#.#', '###'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'], P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['###', '#..', '###', '..#', '###'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'], ' ': ['.', '.', '.', '.', '.'], '.': ['.', '.', '.', '.', '#'],
  '#': ['#.#', '###', '#.#', '###', '#.#'], ':': ['.', '#', '.', '#', '.'], '-': ['..', '..', '##', '..', '..'],
};
// a string → 5 bitmap rows ('#' ink), one blank column between glyphs; k scales every texel to k × k
const textRows = (s, k = 1) => { const rows = ['', '', '', '', ''];
  [...s].forEach((ch, i) => { const g = FONT[ch] || FONT[' ']; for (let r = 0; r < 5; r++) rows[r] += (i ? '.' : '') + g[r]; });
  return k === 1 ? rows : rows.flatMap(r => Array(k).fill([...r].map(c => c.repeat(k)).join(''))); };
// paint a bitmap centred on the chest's front (+z) or back (−z) (centre: between x −1 and 0), top row at texel row qbTop
function art(P, face, rows, pal, qbTop, dx = 0) { const w = rows[0].length, qa = face === '-z' ? Math.floor(w / 2) - 1 - dx : -Math.floor(w / 2) + dx; P.bmp(face, rows, pal, qa, qbTop); }
const text = (P, face, s, qbTop, col, dx = 0, k = 1) => art(P, face, textRows(s, k), { '#': col }, qbTop, dx);
// a straight run of texels (a seam, a stripe, a zip) from (a0, b0) to (a1, b1) on one face
function seam(P, face, a0, b0, a1, b1, col) { const n = Math.max(Math.abs(a1 - a0), Math.abs(b1 - b0), 1);
  for (let s = 0; s <= n; s++) P.paint(face, Math.round(a0 + (a1 - a0) * s / n), Math.round(b0 + (b1 - b0) * s / n), col); }

// the torso shell. Rows y y0 … 18; per row the shell reaches fl(y) columns past the torso (x −5−fl … 4+fl) and per column it is
// d(x, y, edge) deep (z −d … d; edge: how many columns in from the shell's side). c(x, y, z) → colour. The torso's own skin under
// the shell is left alone; open necklines keep the neck; rows under y 10 are a ring round the hips (the pants keep their top row).
// skip(x, y, z) leaves a cell out (a V neck, an armhole).
function shell(B, c, { y0 = 9, fl = 1, d = 3, neck = true, skip = null, l = 0 } = {}) {
  const F = typeof fl === 'function' ? fl : () => fl, D = typeof d === 'function' ? d : () => d;
  for (let y = y0; y <= 18; y++) { const f = F(y), x0 = -5 - f, x1 = 4 + f;
    for (let x = x0; x <= x1; x++) { const dz = D(x, y, Math.min(x - x0, x1 - x));
      for (let z = -dz; z <= dz; z++) {
        if (neck && y >= 17 && x >= -1 && x <= 0 && z >= -1 && z <= 0) continue;
        const inner = x > x0 && x < x1 && z > -dz && z < dz;
        if (inner && (y < 10 ? x >= -5 && x <= 4 && z >= -2 && z <= 2 : y <= 17 && x >= -5 && x <= 4 && z >= -2 && z <= 2)) continue;
        if (skip && skip(x, y, z)) continue;
        const col = typeof c === 'function' ? c(x, y, z) : c; if (col !== null && col !== undefined) B.set(x, y, z, col, l);
      } } }
}
// both sleeves, to THE SLEEVE RULE (README § Tops · Sleeves, 2026-10-01: slime, "the arms are so massive/bulky"). The bare arm is
// x −8…−6, y 10…16, z −1…0 (chars.js base()); the hand x −8…−6, y 6…9, z −2…1. The shell's flank takes the arm's inner column(s) into
// the shirt's side, so each sleeve is ONE box round the rest of the arm: from the hem or cuff row y0 up to y 16, centred on the arm,
// `pad` voxels proud front and back (1; padded outerwear 2), its outer face `out` voxels past the arm's (0 flush, at most `pad`), its
// inner column the one just outside the shell on that row (fl: the shell's flank, a number or y → number). The shoulder cap (y 17…18)
// is the same box carried up, in to one column over the shell's side. Given for the x < 0 arm, mirrored for the other.
// paint(lx, ly, z, X, y): lx counts outwards from the box's inner column, ly from the wrist (y 9 = 0). null leaves a cell out.
const ARM = { x0: -8, z0: -1, z1: 0 };
function sleeves(ctx, paint, { y0 = 13, out = 0, pad = 1, fl = 1, l = 0 } = {}) {
  const F = typeof fl === 'function' ? fl : () => fl, P = typeof paint === 'function' ? paint : () => paint;
  const x0 = ARM.x0 - Math.min(out, pad), z0 = ARM.z0 - pad, z1 = ARM.z1 + pad;
  let x1 = -99; for (let y = y0; y <= 16; y++) x1 = Math.max(x1, -6 - F(y));
  const cell = (lx, ly, z, X, y) => (x1 - lx > -6 - F(y) ? null : P(lx, ly, z, X, y));   // (a cell the shell holds on this row stays the shell's)
  for (const s of ['L', 'R']) {
    ctx.sleeve(s, 'arm' + s, { x0, x1, y0, y1: 16, z0, z1 }, cell, l);
    ctx.shoulderCap(s, P, { outer: x0, inner: -5 - F(17), z0, z1, l });
  }
}
// a hem or cuff row: the cloth one shade down
const hem = (c, k = .86) => shade(c, k);
// a V neck: the front of the top two rows opened onto the skin, narrowing to y 16
const vee = (x, y, z) => (y === 18 && x >= -3 && x <= 2 && z >= 1) || (y === 17 && x >= -2 && x <= 1 && z >= 3) || (y === 16 && x >= -1 && x <= 0 && z >= 3);
// shirt-collar wings lying on the front of the top two rows (collar zone: 1 proud)
function collarWings(B, col, zf, { open = false, l = 0 } = {}) {
  const xs18 = open ? [-5, -4, 3, 4] : [-4, -3, -2, 1, 2, 3], xs17 = open ? [-4, -3, 2, 3] : [-3, -2, 1, 2];
  for (const x of xs18) B.set(x, 18, zf + 1, col, l); for (const x of xs17) B.set(x, 17, zf + 1, col, l);
}

// hoodies share a body: the shell, long sleeves with a rib cuff, the hood down in a roll round the back of the neck
function hoodie(B, ctx, G, R, l = 0) {
  shell(B, (x, y) => y === 9 ? R : G, { neck: false, l });
  sleeves(ctx, (lx, ly) => ly === 1 ? R : G, { y0: 10, l });                       // long, to the wrist, a rib cuff
  for (let x = -5; x <= 4; x++) for (const y of [17, 18]) B.set(x, y, -4, G, l);   // the hood's roll (collar zone)
  for (const x of [-3, -2, 1, 2]) B.set(x, 18, 4, G, l);                            // its two edges crossing at the throat
}
function hoodieFine(P, s, cord, { cordTop = 56, back = true } = {}) {
  P.rect('+z', -14, 40, 14, 41, s); P.rect('+z', -8, 52, 8, 53, s);                  // the kangaroo pocket: hem and top seams
  seam(P, '+z', -14, 40, -9, 52, s); seam(P, '+z', 13, 40, 8, 52, s);                // its slanted openings
  P.rect('+z', -6, cordTop, -5, 72, cord); P.rect('+z', 4, cordTop + 3, 5, 72, cord);   // the drawstrings
  if (back) { seam(P, '-z', -17, 70, -15, 52, s); seam(P, '-z', 16, 70, 14, 52, s); seam(P, '-z', -15, 52, 14, 52, s); }   // the hood lying on the back
}

export default {
  // ───────────────────────── COMMON
  tall_tee: {
    name: 'Bodega Tall Tee', tier: 'common', why: 'common · fresh out the three-pack: oversized, past the hips, the box creases still in it',
    draw(B, ctx) { const W = 0xf4f2ec; shell(B, W); sleeves(ctx, (lx, ly) => ly === 3 ? hem(W, .93) : W, { y0: 12 }); },
    fine(P) { const c = 0xd9d4c8; for (const f of ['+z', '-z']) { P.rect(f, -13, 37, -12, 72, c); P.rect(f, 11, 37, 12, 72, c); P.rect(f, -24, 55, 24, 56, c); } },
  },
  corner_hoodie: {
    name: 'Corner Hoodie', tier: 'common', neckline: 'hood', why: 'common · heather-grey heavyweight, hood down, hands in the pouch on the corner',
    draw(B, ctx) { hoodie(B, ctx, 0x8f9299, 0x7b7e85); },
    fine(P) { hoodieFine(P, 0x6c6f76, 0xf2f1ec); },
  },
  ribbed_tank: {
    name: 'Ribbed Tank', tier: 'common', flank: 0, neckline: 'bare', why: 'common · the white ribbed tank: summer on the stoop, a chain on top',
    draw(B) {
      const W = 0xf7f5ef, w = 0xe6e2d8;
      const strap = x => (x >= -4 && x <= -3) || (x >= 2 && x <= 3);
      shell(B, x => (x & 1) ? w : W, { fl: 0, skip: (x, y, z) =>
        (y === 18 && !strap(x)) || (y === 17 && (x === -5 || x === 4 || (x >= -2 && x <= 1 && z === 3) || (x >= -2 && x <= 1 && z === -3))) ||
        (y === 16 && (x === -5 || x === 4) && Math.abs(z) < 3) || (y === 16 && x >= -1 && x <= 0 && z === 3) });
    },
  },
  dock_vest: {
    name: 'Low Tide Hi-Vis', tier: 'common', neckline: 'crew', why: 'common · the dock shift: navy thermal under a union hi-vis, Local 9 on the back',
    draw(B, ctx) {
      const N = 0x1e2b4d, V = 0xc8f526, S = 0xdfe3e8;
      shell(B, (x, y) => (y === 11 || y === 16) ? S : ((x <= -6 || x >= 5) && y >= 14) || (y >= 17 && (x <= -5 || x >= 4)) ? N : V);
      sleeves(ctx, (lx, ly) => ly === 1 ? hem(N, .8) : N, { y0: 10 });
    },
    fine(P) {
      const N = 0x1e2b4d;
      P.rect('+z', 0, 36, 1, 64, N);                                                     // the vest's zip
      text(P, '-z', 'LOW TIDE', 62, N); text(P, '-z', 'LOCAL 9', 55, N);
      P.rect('+z', 6, 53, 14, 56, N); text(P, '+z', 'DOCK', 62, N, 10);                  // a chest pen-pocket and the yard's name
    },
  },
  iron_island: {
    name: 'Iron Island Issue', tier: 'common', neckline: 'vee', why: 'common · state issue from the rock: stencilled, numbered, worn out on the bridge as a flex',
    draw(B, ctx) { const O = 0xff7417; shell(B, O, { skip: vee }); sleeves(ctx, (lx, ly) => ly === 4 ? hem(O) : O, { y0: 13 }); },
    fine(P) {
      const K = 0x17171b;
      text(P, '-z', 'IRON ISLAND', 63, K); text(P, '-z', 'INMATE', 56, K); text(P, '-z', '0419', 48, K, 0, 1);
      text(P, '+z', '#0419', 61, K, 11); P.rect('+z', -20, 51, -8, 52, K); P.rect('+z', -20, 51, -19, 60, K); P.rect('+z', -9, 51, -8, 60, K);   // a stencilled number, a chest pocket
    },
  },
  precinct_blues: {
    name: 'Precinct 9 Blues', tier: 'common', neckline: 'collar', why: 'common · the cop\'s light-blue shirt: P9 patches, a tin badge, a clip-on navy tie',
    draw(B, ctx) {
      const N = 0x8cb4e4, Y = 0xf2c230;
      shell(B, N, { neck: false }); collarWings(B, N, 3);
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(N) : N, { y0: 13 });
      for (const x of [2, 3]) for (const y of [14, 15]) B.set(x, y, 3, Y, 2);              // the badge: tin, flush on the chest
    },
    fine(P) {
      const K = 0x1c2a58, Y = 0xf2c230, W = 0xf4f2ec, D = 0x1c2a58;
      art(P, '+z', ['.KK.', 'KKKK', 'KKKK', '.KK.', '.KK.', '.KK.', '.KK.', 'KKKK', 'KKKK', 'KKKK', 'KKKK', '.KK.', '.KK.', '.KK.', '.KK.', '.KK.', '.KK.', '..K.'].map(r => r), { K }, 67);   // the tie
      art(P, '+z', ['N..NN..N', '........', '..DDDD..', '..D..D..', '..DDDD..', '.....D..', 'N.DDDD.N', 'NNN..NNN'], { N: 0x8cb4e4, D: 0xa47d14 }, 63, 12);   // the badge's shield and its 9
      P.rect('+z', -16, 60, -8, 61, Y);                                                     // the name bar
      for (const [f, qa] of [['-x', -6], ['+x', 5]]) P.bmp(f, ['.YYYYYY.', 'YDDDDDDY', 'YDWDDWDY', 'YDWWDWWY', 'YDWDDDWY', 'YDDDDDDY', '.YDDDDY.', '..YYYY..'], { Y, D, W }, qa, 67);   // the P9 shoulder patches
      P.rect('+z', -20, 54, -8, 55, 0x6f97c9); P.rect('+z', 7, 54, 19, 55, 0x6f97c9);   // the pocket flaps
    },
  },
  top_button_flannel: {
    name: 'Top Button Flannel', tier: 'common', neckline: 'collar', why: 'common · buffalo check, buttoned to the throat, two sizes up',
    draw(B, ctx) {
      const R = 0xc81f2d, K = 0x1b1b21, chk = (u, v) => (((u >> 1) + (v >> 1)) & 1) ? K : R;
      shell(B, (x, y, z) => y === 9 ? K : chk(x <= -6 || x >= 5 ? z : x, y), { neck: false }); collarWings(B, K, 3);
      sleeves(ctx, (lx, ly, z, X, y) => ly === 1 ? K : chk(z + 8, y), { y0: 10 });
    },
    fine(P) {
      const D = 0x5a0d14, W = 0xf4f2ec; P.rect('+z', -1, 36, 0, 72, D);
      for (const qb of [70, 62, 54, 46]) P.rect('+z', -1, qb, 1, qb + 2, W);
    },
  },

  // ───────────────────────── RARE
  velour_track: {
    name: 'Velour Track Top', tier: 'rare', neckline: 'high', why: 'rare · burgundy velour, gold twin stripes, zipped to the chin: Neon Row after midnight',
    draw(B, ctx) {
      const V = 0x6d1431, v = 0x56102a;
      shell(B, (x, y) => y === 10 ? v : V, { y0: 10, neck: false });
      for (let x = -3; x <= 2; x++) { B.set(x, 18, 4, V); B.set(x, 17, 4, V); }            // the funnel collar
      sleeves(ctx, (lx, ly) => ly === 1 ? v : V, { y0: 10 });
    },
    fine(P) {
      const Y = 0xf0b72a;
      P.rect('+z', 0, 40, 1, 76, Y);                                                         // the zip
      for (const f of ['-x', '+x']) for (const qa of [-3, 1]) P.rect(f, qa, 48, qa + 1, 76, Y);   // twin stripes, wrist to shoulder
      text(P, '+z', 'NR', 63, Y, 12); text(P, '-z', 'NEON ROW', 66, Y);
    },
  },
  hockey_jersey: {
    name: 'Bay Breakers Jersey', tier: 'rare', neckline: 'vee', why: 'rare · oversized hockey sweater of a team that never existed: number nine, the city\'s number',
    draw(B, ctx) {
      const BL = 0x1f50d8, Y = 0xffc21a, W = 0xf4f2ec;
      shell(B, (x, y) => y === 10 ? W : y === 11 ? Y : y >= 17 ? Y : BL, { skip: vee });
      for (const [x, y] of [[-3, 18], [2, 18], [-2, 17], [1, 17]]) B.set(x, y, 3, W);      // the V's white trim
      sleeves(ctx, (lx, ly) => ly === 1 ? hem(BL, .8) : ly === 3 ? W : ly === 4 ? Y : ly === 5 ? W : ly >= 8 ? Y : BL, { y0: 10, out: 1 });   // (oversized: one proud outwards)
    },
    fine(P) {
      const W = 0xf4f2ec, Y = 0xffc21a;
      text(P, '+z', 'BREAKERS', 60, W); P.rect('+z', -16, 53, 16, 54, Y);
      text(P, '-z', 'DEUCE', 66, W); art(P, '-z', textRows('09', 2), { '#': W }, 59);
      for (const [f, qa] of [['-x', -5], ['+x', 4]]) P.bmp(f, textRows('9'), { '#': W }, qa, 62);
      P.rect('+z', -2, 62, 2, 63, W); P.rect('+z', -2, 65, 2, 66, W);                     // the laces across the V
    },
  },
  camo_field: {
    name: 'Blackpine Field Jacket', tier: 'rare', neckline: 'collar', why: 'rare · woodland camo from the woods past the trailer park, a name tape, two flap pockets',
    draw(B, ctx) {
      const C = [0x5b6838, 0x8e8456, 0x4d3726, 0x23261c], camo = (x, y, z) => C[hash3(x >> 1, y >> 1, z >> 1) % 4];
      shell(B, camo, { y0: 9, neck: false }); collarWings(B, C[0], 3);
      sleeves(ctx, (lx, ly, z, X, y) => ly === 1 ? C[0] : camo(X, y, z), { y0: 10 });
    },
    fine(P) {
      const K = 0x1b1d17, T = 0xcfc391;
      P.rect('+z', -18, 62, 18, 67, T); text(P, '+z', 'BLACKPINE', 66, K);                   // the name tape
      for (const a of [-20, 4]) { P.rect('+z', a, 57, a + 14, 58, K); P.rect('+z', a, 46, a + 1, 58, K); P.rect('+z', a + 13, 46, a + 14, 58, K); P.rect('+z', a, 46, a + 14, 47, K); }
    },
  },
  rip_airbrush: {
    name: 'Airbrush Memorial Tee', tier: 'rare', why: 'rare · the R.I.P. tee from the airbrush stall on Fit Street: a sunset, clouds, a name',
    draw(B, ctx) {
      const W = 0xf4f2ec, SKY = { 16: 0x5b2ee0, 15: 0x8f2fe8, 14: 0xe23ca6, 13: 0xff5a6e, 12: 0xff8a3a, 11: 0xffb52a, 10: 0xffd84a };
      const panel = (x, y) => x >= -4 && x <= 3 && y >= 10 && y <= 16 && !((x === -4 || x === 3) && (y === 16 || y === 10));
      shell(B, (x, y, z) => z === 3 && panel(x, y) ? SKY[y] : W);
      sleeves(ctx, (lx, ly) => ly === 3 ? hem(W, .93) : W, { y0: 12 });
    },
    fine(P) {
      const W = 0xf4f2ec, K = 0x17171b, CL = 0xffe9f3;
      text(P, '+z', 'R.I.P.', 66, W);
      seam(P, '+z', -14, 56, -6, 56, CL); seam(P, '+z', -12, 57, -8, 57, CL); seam(P, '+z', 4, 54, 13, 54, CL); seam(P, '+z', 6, 55, 10, 55, CL);   // clouds
      art(P, '+z', ['..YYYY..', '.YYYYYY.', 'YYYYYYYY'], { Y: 0xfff3b0 }, 47);              // the sun going down
      text(P, '+z', 'DEUCE', 45, K); text(P, '-z', '4EVER', 68, K); text(P, '-z', '99-26', 61, K);
    },
  },
  stoop_rugby: {
    name: 'Stoop Rugby', tier: 'rare', neckline: 'collar', why: 'rare · heavy rugby in bottle green and gold bars, white collar, a crest for a club with no field',
    draw(B, ctx) {
      const G = 0x16613f, Y = 0xf2c230, W = 0xf4f2ec, bar = y => (((y - 9) >> 1) & 1) ? Y : G;
      shell(B, (x, y) => bar(y), { neck: false }); collarWings(B, W, 3);
      sleeves(ctx, (lx, ly, z, X, y) => ly === 1 ? W : bar(y), { y0: 10 });
    },
    fine(P) {
      const W = 0xf4f2ec, G = 0x16613f;
      P.rect('+z', -3, 58, 3, 72, W); for (const qb of [68, 62]) P.rect('+z', -1, qb, 1, qb + 2, G);   // the placket and its buttons
      art(P, '+z', ['.WWW.', 'WGGGW', 'WGWWW', 'WGGGW', 'WWWGW', 'WGGGW', '.WWW.'], { W, G }, 58, 12);   // the crest
    },
  },

  // ───────────────────────── EPIC
  bubble_goose: {
    name: 'Bubble Goose', tier: 'epic', flank: 2, puffy: true, neckline: 'high', why: 'epic · a gloss-red down bubble, baffles you can read from the end of the block',
    draw(B, ctx) {
      const K = 0xd81f2e, S = 0x8e101b;
      const fl = y => y >= 12 ? 2 : 1, seamRow = y => y === 13 || y === 16;
      shell(B, (x, y) => y === 10 || seamRow(y) ? S : K, { y0: 10, fl, neck: false, l: 1,
        d: (x, y, e) => y === 10 ? 3 : y >= 17 ? (e <= 1 ? 3 : 4) : (e === 0 ? 3 : e === 1 ? 4 : 5) - (seamRow(y) && e > 0 ? 1 : 0) });
      // padded: two proud (z −3…2, out to x −10), quilted with the body's seam rows (y 13, 16), an inset knit cuff at the wrist
      const outer = (lx, z) => lx === 3 || z === -3 || z === 2;
      sleeves(ctx, (lx, ly, z) => ly === 1 ? (outer(lx, z) ? null : S) : (ly === 4 || ly === 7) ? (outer(lx, z) ? null : S) : K, { y0: 10, out: 2, pad: 2, fl, l: 1 });
    },
    fine(P) {
      const R = 0x17171b, W = 0xf4f2ec;
      for (const [f, qa] of [['-x', -4], ['+x', 3]]) P.bmp(f, ['.RRRRRR.', 'RRWRRWRR', 'RRWWRWRR', 'RRWRWWRR', 'RRWRRWRR', 'RRRRRRRR', '.RRRRRR.'], { R, W }, qa, 65);   // the N9 down patch
      P.rect('+z', 0, 44, 1, 76, 0x5e0a12);
    },
  },
  pawn_shearling: {
    name: 'Pawn Shop Shearling', tier: 'epic', neckline: 'collar', why: 'epic · a tan sheepskin with the fleece turned out at the collar, cuffs and hem: winter money',
    draw(B, ctx) {
      const T = 0x95602f, C = 0xefe3c8;
      shell(B, (x, y, z) => y === 9 ? C : (z > 0 && x >= -1 && x <= 0) ? C : T, { neck: false });
      for (let x = -6; x <= 5; x++) { B.set(x, 18, 4, C); if (x <= -2 || x >= 1) B.set(x, 17, 4, C); }   // the fleece collar, wide
      for (let x = -5; x <= 4; x++) for (const y of [17, 18]) B.set(x, y, -4, C);
      sleeves(ctx, (lx, ly) => ly <= 2 ? C : T, { y0: 10, out: 1 });                  // (a coat: one proud outwards; the fleece turned out at the cuff)
    },
    fine(P) {
      const s = 0x6e4420;
      for (const a of [-20, 6]) { P.rect('+z', a, 50, a + 13, 51, s); seam(P, '+z', a, 50, a + 2, 42, s); }   // slash pockets
      seam(P, '-z', -22, 52, 21, 52, s); P.rect('+z', -24, 64, -6, 65, s); P.rect('+z', 4, 64, 22, 65, s);   // yoke seams
    },
  },
  neon_row_silk: {
    name: 'Neon Row Silk', tier: 'epic', neckline: 'vee', why: 'epic · black silk camp shirt, dice and diamonds all over, open at the neck for the chain',
    draw(B, ctx) {
      const K = 0x141418;
      shell(B, K, { skip: vee, l: 1 }); collarWings(B, K, 3, { open: true, l: 1 });
      sleeves(ctx, (lx, ly) => ly === 3 ? 0x232329 : K, { y0: 12, out: 1, l: 1 });   // (a boxy camp sleeve: one proud outwards; the hem a shade up, black can't go down)
    },
    fine(P) {   // the print: big gold dice and red diamonds, in clusters (each motif 2 × 2 voxel faces)
      const G = 0xf2c230, R = 0xe4202f, W = 0xf4f2ec, K = 0x141418;
      const DIE = [['.GGGGGG.', 'GKKGGKKG', 'GKKGGKKG', 'GGGKKGGG', 'GGGKKGGG', 'GKKGGKKG', 'GKKGGKKG', '.GGGGGG.'], { G, K }];
      const ACE = [['.WWWWWW.', 'WKKWWKKW', 'WKKWWKKW', 'WWWWWWWW', 'WWWWWWWW', 'WKKWWKKW', 'WKKWWKKW', '.WWWWWW.'], { W, K }];
      const DIA = [['...RR...', '..RRRR..', '.RRRRRR.', 'RRRRRRRR', 'RRRRRRRR', '.RRRRRR.', '..RRRR..', '...RR...'], { R }];
      const SPOTS = [[DIE, -5, 14], [DIA, 2, 15], [DIA, -3, 11], [DIE, 1, 10], [ACE, 4, 12], [DIA, -6, 9]];   // [motif, x, y] (lower-left cell)
      for (const [[rows, pal], x, y] of SPOTS) { P.bmp('+z', rows, pal, 4 * x, 4 * y + 7); P.bmp('-z', rows, pal, 4 * -x - 1, 4 * y + 7); }
      for (const [f, qa] of [['-x', -4], ['+x', 3]]) P.bmp(f, DIA[0].filter((r, i) => i % 2 === 0).map(r => r.replace(/(.)./g, '$1')), DIA[1], qa, 59);
    },
  },

  // ───────────────────────── GRAIL
  box_hoodie_4am: {
    name: '4AM Box Hoodie', tier: 'grail', neckline: 'hood', why: 'grail · the 4AM label\'s morning drop: jet black, a lime box logo that glows after dark',
    draw(B, ctx) {
      hoodie(B, ctx, 0x141418, 0x0c0c0f);
      for (let x = -3; x <= 2; x++) for (let y = 14; y <= 16; y++) B.set(x, y, 3, 0xa6ff2e, 3);   // the box: lit
    },
    fine(P) {
      const L = 0xa6ff2e, K = 0x0c0c0f;
      hoodieFine(P, 0x2b2b33, L, { cordTop: 68, back: false });
      text(P, '+z', '4AM', 66, K, 0, 2);
      text(P, '-z', 'NO SLEEP', 66, L);
      P.bmp('-x', textRows('001'), { '#': L }, -6, 50);
    },
  },
  gatehill_mink: {
    name: 'Gatehill Mink', tier: 'grail', flank: 2, puffy: true, neckline: 'high', why: 'grail · a let-out mink to the hips, a silver-fox collar up to the jaw: penthouse money, robbery bait',
    draw(B, ctx) {
      const M = 0x4b2a1a, m = 0x5e3622, fur = x => (x & 1) ? m : M;
      shell(B, (x) => fur(x), { fl: y => y >= 12 ? 2 : 1, neck: false, l: 1, d: (x, y, e) => y >= 17 || e === 0 ? 3 : e === 1 ? 4 : 5 });
      const FX = 0xd9d3c7;   // silver fox: the shawl collar and the cuffs
      for (let x = -6; x <= 5; x++) { B.set(x, 18, 4, FX); B.set(x, 17, 4, FX); }
      for (let x = -5; x <= 4; x++) for (const y of [17, 18]) B.set(x, y, -4, FX);
      const round = (lx, z) => lx === 3 && (z === -3 || z === 2);   // (the outer edges rounded off)
      sleeves(ctx, (lx, ly, z, X) => round(lx, z) ? null : ly <= 2 ? FX : fur(X), { y0: 10, out: 2, pad: 2, fl: y => y >= 12 ? 2 : 1, l: 1 });
    },
    fine(P) {
      P.rect('+z', -1, 36, 0, 64, 0x2c170d);                                                 // where the fronts meet
      P.halfBox(-1, 34, 10, 1, 36, 11, 0xf2c230, 2);                                         // a gold hook at the collar
    },
  },
};
