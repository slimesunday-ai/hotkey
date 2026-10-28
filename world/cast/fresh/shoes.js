// FRESH REGISTRY · shoes (slot 'shoes'). This file has exactly one owner: the shoes designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Shoes. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep, the lower-body motion check).
//
// THE SHOE WALL (2026-10-01). Hood / NYC / drop-culture footwear for Springfield Street, every name and mark invented. Each entry also
// carries `tier` (common · rare · epic · grail), repeated at the front of `why` so the studio shows it.
// Foot-local voxels: u 0..4 outwards from the inner edge, y 0..3, z heel → toe. Fine paint below uses BODY coordinates on the right
// foot (x = 1 + u) and mirrors onto the left (x → −1 − x), through the little helpers here.

// ── fine-paint helpers (both feet). Quarter coordinates: qz = 4z + i, qy = 4y + j, qx = 4x + i on the RIGHT foot (x = 1 + u).
// The outermost-voxel rule puts outer-side paint on each foot's outer face, top paint on the top surface, toe paint on the front.
const out = (P, qz, qy, c) => { P.paint('+x', qz, qy, c); P.paint('-x', qz, qy, c); };
const top = (P, qx, qz, c) => { P.paint('+y', qx, qz, c); P.paint('+y', -1 - qx, qz, c); };
const toe = (P, qx, qy, c) => { P.paint('+z', qx, qy, c); P.paint('+z', -1 - qx, qy, c); };
const heel = (P, qx, qy, c) => { P.paint('-z', qx, qy, c); P.paint('-z', -1 - qx, qy, c); };
// ── where paint can land: each shoe's own foot-local cells (the approved lasts' rows, or the free-form draw run on a recorder), so a
// pattern loop never aims at a column the shoe doesn't have (the audit counts paint off the surface). Applied to every fine pass below.
const LAST_ROWS = {   // [y, z0, z1, width] (world/fit/shoe.js, shoe-shapes.js)
  tongue: [[0, -3, 5, 5], [1, -3, 5, 5], [2, -2, 4, 4], [3, 2, 2, 3]],
  terrace: [[0, -3, 5, 4], [1, -2, 4, 4], [2, -2, 3, 3], [3, -1, 1, 3]],
  lowline: [[0, -3, 5, 4], [1, -3, 4, 3], [2, -2, 2, 3], [3, -1, 1, 3]],
  fullcourt: [[0, -3, -3, 4], [0, -2, 4, 5], [0, 5, 5, 4], [1, -2, 4, 4], [2, -2, -2, 3], [2, -1, 3, 4], [3, -1, 1, 3]],
};
function footSet(t) {
  const S = new Set(), k = (u, y, z) => u + ',' + y + ',' + z;
  if (t.last) { for (const [y, z0, z1, w] of LAST_ROWS[t.last]) for (let z = z0; z <= z1; z++) for (let u = 0; u < w; u++) S.add(k(u, y, z)); }
  else t.draw({ box(u0, u1, y0, y1, z0, z1) { for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) S.add(k(u, y, z)); },
    set(u, y, z) { S.add(k(u, y, z)); }, del(u, y, z) { S.delete(k(u, y, z)); } });
  for (let u = 0; u < 3; u++) for (let z = -1; z <= 1; z++) S.add(k(u, 3, z));   // the ankle seat is always there
  const C = [...S].map(c => c.split(',').map(Number)), any = f => C.some(f);
  return { side: (y, z) => any(c => c[1] === y && c[2] === z), down: (u, z) => any(c => c[0] === u && c[2] === z), along: (u, y) => any(c => c[0] === u && c[1] === y) };
}
const uOf = x => x >= 1 ? x - 1 : -2 - x;   // a body column x → foot-local u (the gap between the feet gives no u)
const VIEW = { '+x': [-1, -1], '-x': [1, -1], '+y': [1, 1], '-y': [1, -1], '+z': [1, -1], '-z': [-1, -1] };   // world/fit/fine.js VIEW
function masked(P, F) {
  const ok = (f, qa, qb) => { const a = Math.floor(qa / 4), b = Math.floor(qb / 4);
    return f[1] === 'x' ? F.side(b, a) : f[1] === 'y' ? F.down(uOf(a), b) : F.along(uOf(a), b); };
  const M = {
    paint: (f, qa, qb, c) => { if (ok(f, qa, qb)) P.paint(f, qa, qb, c); },
    bmp: (f, rows, pal, qa, qb) => { const [da, db] = VIEW[f]; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (pal[r[i]] !== undefined) M.paint(f, qa + i * da, qb + j * db, pal[r[i]]); }); },
    half: (...a) => P.half(...a),
  };
  return M;
}

// a pattern on the outer sides, rows top → bottom from qyTop, columns heel → toe from qz0 (the same toe-relative place on both feet)
const outPat = (P, rows, pal, qz0, qyTop) => rows.forEach((r, j) => { for (let k = 0; k < r.length; k++) if (pal[r[k]] !== undefined) out(P, qz0 + k, qyTop - j, pal[r[k]]); });
// a fine voxel on both feet (half coordinates, right foot; the left mirrors hx → −1 − hx)
const half = (P, hx, hy, hz, c, l) => { P.half(hx, hy, hz, c, l); P.half(-1 - hx, hy, hz, c, l); };

// a 3 × 5 stamp font (only the glyphs these marks use) and a word that reads correctly from outside on both feet's outer sides
const GLYPH = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '9': ['###', '#.#', '###', '..#', '###'],
  'A': ['.#.', '#.#', '###', '#.#', '#.#'], 'D': ['##.', '#.#', '#.#', '#.#', '##.'], 'E': ['###', '#..', '##.', '#..', '###'],
  'I': ['###', '.#.', '.#.', '.#.', '###'], 'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'L': ['#..', '#..', '#..', '#..', '###'],
  'O': ['###', '#.#', '#.#', '#.#', '###'], 'P': ['###', '#.#', '###', '#..', '#..'], 'S': ['###', '#..', '###', '..#', '###'],
  'T': ['###', '.#.', '.#.', '.#.', '.#.'],
};
const textRows = s => [0, 1, 2, 3, 4].map(r => [...s].map(ch => GLYPH[ch][r]).join('.'));
function stamp(P, rows, pal, qz0, qyTop) { const W = rows[0].length; P.bmp('+x', rows, pal, qz0 + W - 1, qyTop); P.bmp('-x', rows, pal, qz0, qyTop); }
const word = (P, s, c, qz0, qyTop) => stamp(P, textRows(s), { '#': c }, qz0, qyTop);

// ── shared free-form volumes (each a new shape: the lower-body motion check covers them). col(u, y, z, row) → [colour, layer]
// The y 3 collars stay inside u 0..2 like the approved lasts: a u 3 collar rises into the hands-in-pockets hand on the foot tap.
const rowOf = (col, row) => (u, y, z) => col(u, y, z, row);
// the high-top: a cupsole, a full quarter, the upright heel counter and a collar behind and before the ankle seat, a pull tab
function hightop(F, col, o = {}) {
  F.box(0, 4, 0, 0, -3, 5, rowOf(col, 0));                          // the cupsole
  F.box(0, o.flat ? 3 : 4, 1, 1, -3, 5, rowOf(col, 1));             // the toe box and the quarter (flat: one plane with the upper)
  F.box(0, 3, 2, 2, -3, 4, rowOf(col, 2));                          // the upper
  F.box(0, 2, 3, 3, -3, 2, rowOf(col, 3));                          // the collar and the tongue (u 0..2: the pockets hand clears it)
  if (o.tab) F.box(1, 2, 3, 3, -4, -4, rowOf(col, 'tab'));          // the heel pull tab
}
// the low dress last: a heel block and a forefoot sole with the arch open between, a long toe that points past the sole
function dress(F, col) {
  F.box(0, 3, 0, 0, -3, -2, rowOf(col, 0)); F.box(0, 3, 0, 0, 1, 5, rowOf(col, 0));   // heel block · forefoot sole (arch open at z −1..0)
  F.box(0, 3, 1, 1, -3, 5, rowOf(col, 1)); F.box(1, 2, 1, 1, 6, 6, rowOf(col, 1));    // the upper's lower course and the pointed toe
  F.box(0, 3, 2, 2, -3, 2, rowOf(col, 2)); F.box(0, 2, 2, 2, 3, 3, rowOf(col, 2));    // the vamp
}
// the work boot: a lug sole, a full-width quarter, a rounded toe and a shaft behind and before the ankle seat
function boot(F, col) {
  F.box(0, 4, 0, 0, -3, 5, rowOf(col, 0));
  F.box(0, 4, 1, 1, -3, 5, rowOf(col, 1));
  F.box(0, 4, 2, 2, -3, 3, rowOf(col, 2)); F.box(0, 3, 2, 2, 4, 4, rowOf(col, 2));
  F.box(0, 2, 3, 3, -3, 2, rowOf(col, 3));
}
// the puffer: the boot's volume blown out to the full width, its toe corner rounded off
function puffer(F, col) {
  F.box(0, 4, 0, 0, -3, 5, rowOf(col, 0));
  F.box(0, 4, 1, 1, -3, 5, rowOf(col, 1));
  F.box(0, 4, 2, 2, -3, 4, rowOf(col, 2)); F.del(4, 2, 4);
  F.box(0, 2, 3, 3, -3, 2, rowOf(col, 3));
}

const SHOES = {
  // ─────────────────────────────── COMMON: what the corner wears
  bleach_lows: {
    name: 'Bleach Lows', tier: 'common',
    why: 'common · triple-white low court, the uptown default: perforated toe, a stitched quarter, the double-chevron stamp',
    last: 'tongue',
    paint: q => [{ outsole: 0xd9d2c3, midsole: 0xfbfaf5, upper: 0xf2efe7, tongue: 0xf2efe7 }[q.region], 0],
    fine(P) {
      const st = 0xcbc3b2;
      for (let qz = -7; qz < 19; qz += 2) out(P, qz, 8, st);                                  // the quarter's stitch line (y2)
      outPat(P, ['#..#..', '.#..#.', '.#..#.', '#..#..'], { '#': 0xc2b9a6 }, 0, 11);          // the double chevron (invented), z 0..1
      for (let qx = 5; qx < 19; qx += 3) for (let qz = 13; qz < 20; qz += 3) top(P, qx, qz, st); // the perforated toe
    },
  },

  corner_runners: {
    name: 'Corner Runners', tier: 'common',
    why: 'common · black runner on a white foam sole, red heel, a reflective sweep: built for leaving a corner quickly',
    last: 'terrace',
    paint: q => q.region === 'sole' ? [0xf1efe9, 0] : q.z === -2 ? [0xe8232a, 0] : [0x1e1f25, 0],
    fine(P) {
      const ref = 0xd6dce3;
      for (let qz = -7; qz < 15; qz++) { const qy = 5 + Math.floor((qz + 7) / 4); out(P, qz, qy, ref); out(P, qz, qy + 1, ref); }   // one reflective sweep
      for (const qz of [9, 11, 13, 15]) for (let qx = 5; qx < 15; qx++) top(P, qx, qz, 0xf1efe9);  // white laces
    },
  },

  county_slips: {
    name: 'County Slip-Ons', tier: 'common',
    why: 'common · Iron Island issue: orange canvas, white rubber, a stencilled inventory number. Worn out the gate as a flex',
    last: 'lowline',
    paint: q => q.region === 'sole' ? [0xf0ede6, 0] : [0xff7a1a, 0],
    fine(P) {
      word(P, '4417', 0x1f1f24, -8, 10);                                                       // the stencil, z −2..1
      for (let qx = 5; qx < 15; qx += 2) for (const qz of [8, 9, 10]) top(P, qx, qz, 0xd8600c);  // the elastic gore at the instep
    },
  },

  bodega_slides: {
    name: 'Bodega Slides', tier: 'common',
    why: 'common · black rubber slides over white tube socks, DELI on the strap. The 3 a.m. sandwich run, all year round',
    draw(F) {
      const BK = [0x1c1c22, 1], SK = [0xf1efe8, 0];
      F.box(0, 3, 0, 0, -3, 5, BK);          // the footbed
      F.box(0, 2, 1, 2, -2, 2, SK);          // the sock: heel, arch and instep
      F.box(0, 3, 1, 2, 3, 4, BK);           // the strap over the forefoot
      F.box(0, 2, 1, 1, 5, 5, SK);           // the toes, out at the front edge
    },
    fine(P) {   // DELI across the strap's top, reading to whoever faces the wearer
      const rows = textRows('DELI'), pal = { '#': 0xffe23a };
      P.bmp('+y', rows, pal, 4, 13); P.bmp('+y', rows, pal, -20, 13);
    },
  },

  wheat_sixes: {
    name: 'Wheat Sixes', tier: 'common',
    why: 'common · the butter boot: wheat nubuck, a padded brown collar, a lug sole. Every winter, every block',
    ankle: 'shoe',
    draw(F) {
      boot(F, ((u, y, z, row) => row === 0 ? [0x3d2a1c, 0] : row === 3 && z <= 1 ? [0x4a2d1b, 0] : [0xe0a33a, 0]));
    },
    fine(P) {
      const st = 0xf2d79c, lace = 0x6e4420;
      for (let qz = -11; qz < 23; qz += 2) out(P, qz, 4, st);                                  // the welt stitch
      for (let qx = 4; qx < 24; qx += 2) toe(P, qx, 4, st);
      for (const qy of [13, 15]) for (let qx = 5; qx < 19; qx++) toe(P, qx, qy, lace);       // laces up the tongue
      for (const qz of [13, 15]) for (let qx = 5; qx < 20; qx++) top(P, qx, qz, lace);       // laces over the toe box
      for (const qx of [4, 19]) for (const qz of [13, 15]) top(P, qx, qz, 0xe7bd4a);          // the speed hooks' eyelets
    },
  },

  stoop_suedes: {
    name: 'Stoop Suedes', tier: 'common',
    why: 'common · cobalt suede terrace trainer on a gum sole, STOOP foiled in gold, white heel: Sunday on the steps',
    last: 'lowline',
    paint: q => q.region === 'sole' ? [0xc98b3d, 0] : [0x2f5bff, 0],
    fine(P) {
      word(P, 'STOOP', 0xe7bd4a, -7, 10);
      for (let qx = 4; qx < 16; qx++) for (let qy = 4; qy < 12; qy++) heel(P, qx, qy, 0xf3f0e8);   // the white heel tab
    },
  },

  curb_skates: {
    name: 'Curb Skates', tier: 'common',
    why: 'common · navy canvas skate shoe, white vulc foxing, flames licking off the sole',
    last: 'tongue',
    paint: q => [{ outsole: 0x26262c, midsole: 0xf2efe7, upper: 0x1f2a5e, tongue: 0x1f2a5e }[q.region], 0],
    fine(P) {
      for (let qz = -12; qz < 24; qz++) out(P, qz, 6, 0x1c1c20);                              // the foxing pinstripe
      const H = [4, 3, 2, 1, 3, 2, 1];                                                          // flame heights, a 7-texel repeat
      for (let qz = -8; qz < 20; qz++) { const h = H[((qz % 7) + 7) % 7];
        for (let j = 0; j < h; j++) out(P, qz, 8 + j, j === 0 ? 0xffe23a : j === h - 1 ? 0xe8232a : 0xff7a1a); }
    },
  },

  // ─────────────────────────────── RARE: you notice them from across the street
  rimshot_hi: {
    name: 'Rimshot Hi', tier: 'rare',
    why: 'rare · red and black basketball high-top, white cupsole, the white hoop: last season\'s court, this season\'s corner',
    ankle: 'shoe',
    draw(F) {
      const R = [0xe8232a, 0], K = [0x17171b, 0], W = [0xf3f0e8, 0];
      hightop(F, ((u, y, z, row) => row === 0 ? W : row === 3 ? (z === 2 ? R : K) : row === 'tab' ? R : z >= 3 || z <= -2 ? K : R), { tab: true });
    },
    fine(P) {
      outPat(P, ['.##.', '#..#', '#..#', '.##.'], { '#': 0xf3f0e8 }, 2, 11);                    // the hoop mark (invented), z 0..1
      for (let qy = 12; qy < 16; qy += 2) for (let qx = 5; qx < 19; qx++) toe(P, qx, qy, 0xf3f0e8);   // laces up the tongue
      for (let qx = 5; qx < 19; qx++) top(P, qx, 13, 0xf3f0e8), top(P, qx, 15, 0xf3f0e8);
    },
  },

  court_date_spectators: {
    name: 'Court Date Spectators', tier: 'rare',
    why: 'rare · two-tone wingtips with a pointed toe, black cap and heel on bone: what you wear to the Hall of Justice',
    draw(F) {
      dress(F, ((u, y, z, row) => row === 0 ? [0x3b2416, 0] : z >= 3 || z <= -2 ? [0x141418, 1] : [0xf3eee2, 0]));
    },
    fine(P) {
      const K = 0x141418, W = 0xf3eee2;
      for (let qy = 5; qy < 12; qy += 2) out(P, 10, qy, K);                                    // broguing on the bone, by the cap
      for (let qy = 4; qy < 12; qy += 2) out(P, 13, qy + 1, W);                                // and on the cap
      for (let qx = 5; qx < 16; qx += 2) top(P, qx, 13, W);
      for (const qz of [9, 11]) for (let qx = 5; qx < 19; qx++) top(P, qx, qz, K);            // laces
    },
  },

  puffer_boots: {
    name: 'Puffer Boots', tier: 'rare',
    why: 'rare · glossy violet down boots, quilted, with a lime toggle: January on the stoop, still dripping',
    ankle: 'shoe',
    draw(F) {
      puffer(F, (u, y, z, row) => row === 0 ? [0x1b1b20, 0] : [0x7a3cff, 1]);
    },
    fine(P) {
      const q = 0x5521c9;
      for (let qz = -12; qz < 24; qz++) { out(P, qz, 6, q); out(P, qz, 10, q); }              // the quilting
      for (let qz = -12; qz < 12; qz++) out(P, qz, 14, q);
      for (let qx = 4; qx < 24; qx++) toe(P, qx, 6, q);
      half(P, 5, 6, 6, 0x6cff4a, 1); half(P, 5, 7, 6, 0x6cff4a, 1);                           // the toggle
    },
  },

  platform_creepers: {
    name: 'Platform Creepers', tier: 'rare',
    why: 'rare · hot-pink suede on a double black crepe platform, the woven vamp: the strangest pair at the club door',
    last: 'tongue',
    paint: q => q.region === 'outsole' || q.region === 'midsole' ? [0x1a1a1f, 0] : [0xff4fa3, 0],
    fine(P) {
      for (let qz = -12; qz < 24; qz++) out(P, qz, 6 + (qz & 1), 0xf3f0e8);                  // the zigzag stitch round the platform
      for (let qx = 4; qx < 20; qx++) for (let qz = 12; qz < 20; qz++) if (((qx >> 1) + (qz >> 1)) & 1) top(P, qx, qz, 0x1a1a1f);   // the interlace
      for (let qx = 4; qx < 16; qx++) for (let qy = 12; qy < 16; qy++) if (((qx >> 1) + (qy >> 1)) & 1) toe(P, qx, qy, 0x1a1a1f);
    },
  },

  neon_row_glows: {
    name: 'Neon Row Glows', tier: 'rare',
    why: 'rare · black knit with a light-up cyan sole and hot-pink laces: you can find them on the strip at 4 a.m.',
    last: 'fullcourt',
    paint: q => q.region === 'sole' ? [0x2de2e6, 3] : [0x1c1c23, 0],
    fine(P) {
      const pk = 0xff4fa3;
      for (let qz = -8; qz < 20; qz++) out(P, qz, 6 + Math.abs(((qz % 6) + 6) % 6 - 3) / 1 | 0, pk);   // the zigzag
      for (const qz of [9, 11, 13, 15]) for (let qx = 5; qx < 19; qx++) top(P, qx, qz, pk);   // laces
    },
  },

  // ─────────────────────────────── EPIC: a story attached
  gator_loafers: {
    name: 'Gator Loafers', tier: 'epic',
    why: 'epic · emerald gator, a gold horsebit, a pointed toe: the man who owns the corner never stands on it',
    draw(F) {
      dress(F, ((u, y, z, row) => row === 0 ? [0x1a1a1f, 1] : [0x168a4a, 1]));
    },
    fine(P) {
      const sc = (qa, qb) => (qb % 2 === 0 && (qa + (qb & 2)) % 4 !== 1) || (qa + (qb & 2)) % 4 === 3 ? 0x10703c : undefined;
      for (let qz = -12; qz < 28; qz++) for (let qy = 4; qy < 12; qy++) { const c = sc(qz + 64, qy); if (c) out(P, qz, qy, c); }
      for (let qx = 4; qx < 20; qx++) for (let qz = 16; qz < 28; qz++) { const c = sc(qx + 64, qz); if (c) top(P, qx, qz, c); }
      for (const [hx, hz] of [[2, 5], [3, 5], [4, 4], [5, 4], [6, 5], [7, 5], [8, 4], [9, 4]]) half(P, hx, 6, hz, 0xf2be2c, 1);   // the horsebit: links
    },
  },

  tagged_customs: {
    name: 'Tagged Customs', tier: 'epic',
    why: 'epic · one-off: a white canvas high-top a writer from Neon Row went over in pink, lime and cyan. KAOS',
    ankle: 'shoe',
    draw(F) { hightop(F, ((u, y, z, row) => row === 0 ? [0xe9e4d8, 0] : [0xf6f4ee, 0]), { flat: true }); },
    fine(P) {
      const pal = { P: 0xff4fa3, K: 0x17171b, L: 0x6cff4a, C: 0x2de2e6 };
      const D = [1, 3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2];                                          // lime drips off the collar
      for (let qz = -12; qz < 12; qz++) for (let j = 0; j < 1 + D[(qz + 12) % 12]; j++) out(P, qz, 15 - j, 0x6cff4a);
      word(P, 'KAOS', 0x17171b, -8, 10); word(P, 'KAOS', 0xff4fa3, -9, 11);                   // the tag, with its shadow
      outPat(P, ['..C..', '.CCC.', 'CCCCC', '.C.C.'], pal, 13, 7);                             // a cyan crown-star on the toe
      for (let qx = 4; qx < 20; qx++) toe(P, qx, 5 + ((qx >> 1) & 1), 0xff4fa3);               // a pink zigzag across the toe
      for (let qx = 5; qx < 19; qx += 3) toe(P, qx, 12, 0x6cff4a), toe(P, qx, 13, 0x6cff4a);
    },
  },

  vacancy_9s: {
    name: 'Vacancy 9s', tier: 'epic',
    why: 'epic · the Motel 9 collab: motel pink, teal toe and heel, the big yellow 9, green laces. Forty pairs, sold from room 12',
    last: 'fullcourt',
    paint: q => q.region === 'sole' ? [0xf3eedf, 0] : q.z === -2 || (q.z >= 4) || (q.y === 2 && q.z === 3) ? [0x12b3a0, 0] : [0xf0418c, 0],
    fine(P) {
      stamp(P, ['.####.', '##..##', '##..##', '.#####', '....##', '....##', '##..##', '.####.'], { '#': 0xffd21f }, -1, 11);   // the 9
      for (const qz of [9, 11, 13]) for (let qx = 5; qx < 19; qx++) top(P, qx, qz, 0x14a83b);  // green laces, the VACANCY sign's green
      for (let qz = -12; qz < 24; qz += 2) out(P, qz, 1, 0x12b3a0);                            // a teal stitch round the sole
    },
  },

  // ─────────────────────────────── GRAIL: the robbery happens because of these
  fort_knox_hi: {
    name: 'Fort Knox Hi', tier: 'grail',
    why: 'grail · a basketball high-top cast in gold, black sole, an iced stud on the tab: worn once, robbed twice',
    ankle: 'shoe',
    draw(F) { hightop(F, ((u, y, z, row) => row === 0 ? [0x141418, 1] : row === 'tab' ? [0x141418, 1] : [0xf2be2c, 1]), { tab: true, flat: true }); },
    fine(P) {
      word(P, '24K', 0xb07f12, -10, 11);                                                        // the stamp on the quarter
      for (let qy = 12; qy < 16; qy += 2) for (let qx = 5; qx < 19; qx++) toe(P, qx, qy, 0x141418);   // black laces
      for (let qx = 5; qx < 19; qx++) top(P, qx, 13, 0x141418), top(P, qx, 15, 0x141418);
      half(P, 4, 7, -9, 0xe8f7ff, 1); half(P, 5, 7, -9, 0xe8f7ff, 1);                          // the iced stud on the pull tab
    },
  },

  maison_neuf: {
    name: 'Maison Neuf Monogram', tier: 'grail',
    why: 'grail · the house of Neuf: brown monogram canvas, tan trim, a gold heel and gold eyelets on a cream sole',
    last: 'fullcourt',
    paint: q => q.region === 'sole' ? [0xefe6d2, 0] : q.z === -2 && q.y === 2 ? [0xf2be2c, 1] : q.z === -2 || q.z === 4 ? [0xc9965a, 0] : [0x5b3a22, 0],
    fine(P) {
      const tan = 0xd9b47a, A = ['.#..', '###.', '.#..', '....'], B = ['##..', '##..', '.#..', '....'];
      const mono = (a, b) => { const m = ((a >> 2) + (b >> 2)) & 1 ? A : B; return m[3 - (b & 3)][a & 3] === '#' ? tan : undefined; };
      for (let qz = -4; qz < 16; qz++) for (let qy = 4; qy < 12; qy++) { const c = mono(qz + 64, qy); if (c) out(P, qz, qy, c); }
      for (let qx = 4; qx < 20; qx++) for (let qz = 8; qz < 16; qz++) { const c = mono(qx + 64, qz); if (c) top(P, qx, qz, c); }
      for (const hx of [3, 8]) for (const hz of [5, 7]) half(P, hx, 6, hz, 0xf2be2c, 1);         // gold eyelets
    },
  },
};

// every fine pass paints through its own shoe's mask
for (const t of Object.values(SHOES)) if (t.fine) { const F = footSet(t), f = t.fine; t.fine = (P, ctx) => f(masked(P, F), ctx); }
export default SHOES;
