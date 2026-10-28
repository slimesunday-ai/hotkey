// FRESH REGISTRY · hats (slot 'hat'). This file has exactly one owner: the hats designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Hats. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// HOW THESE HATS KEEP HAIR WHOLE (slime: "it's important that hats dont break hair"):
//   · every crown is a closed SOLID sitting on the hair shell (x −9..8, z −8..8) with its rim ON that shell, so the auto cover
//     (world/fit/layers.js) takes all hair at and above the rim, plus every column over a brim; hair below the rim hangs out under it.
//   · full wraps (durag, ski mask, bonnet, rag-under-fitted) are cover 'all': every hair voxel goes; the mask draws its own ear cover.
//   · nothing goes below y 21 (the neck and collars belong to the body); fronts stay at y ≥ 30, clear of brows and eyewear (the ski
//     mask is the one exception: it IS the face, with holes for eyes and mouth); every piece is face-connected to the crown.
//   · fine paint uses P.at on this hat's own voxels (never the outermost rule), so a logo never lands on hair the cover removes.
// Tiers (the drop): common = everyday street staple · rare = a real piece · epic = a statement · grail = the one people get robbed for.
import { shade, hash3 } from './kit.js';

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// a footprint: box x0..x1, z0..z1 (inclusive), vertical corners chamfered by c (c 1 drops the corner cell, c 2 a 3-cell step)
const inFoot = (x, z, f) => { const dx = Math.min(x - f[0], f[1] - x), dz = Math.min(z - f[2], f[3] - z); return dx >= 0 && dz >= 0 && dx + dz >= (f[4] ?? 1); };
// fill a solid, one footprint per row: rows = { y: [x0, x1, z0, z1, c] }; col: colour or (x, y, z) → colour; skip(x, y, z) leaves a cell
function solid(H, rows, col, l = 0, skip) {
  for (const [ys, f] of Object.entries(rows)) { const y = +ys;
    for (let x = f[0]; x <= f[1]; x++) for (let z = f[2]; z <= f[3]; z++) if (inFoot(x, z, f) && !(skip && skip(x, y, z))) H.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col, l); } }
const rowsOf = (y0, y1, f, o = {}) => { for (let y = y0; y <= y1; y++) o[y] = f; return o; };
// a ring: the cells of footprint `o` that are not inside footprint `i` (both [x0, x1, z0, z1, c])
const ring = (H, y, o, i, col, l = 0) => { for (let x = o[0]; x <= o[1]; x++) for (let z = o[2]; z <= o[3]; z++) if (inFoot(x, z, o) && !(x > i[0] && x < i[1] && z > i[2] && z < i[3])) H.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col, l); };
// fine paint: a bitmap on ONE plane of this hat's voxels. face '+z' etc, n = the voxel coordinate along the face's normal, (qa, qb) the
// top-left texel as seen from outside (README § Fine paint: qa = 4a + i, qb = 4b + j). P.at: the paint lands on the hat itself.
const PL = { '+x': [2, 1, 0], '-x': [2, 1, 0], '+y': [0, 2, 1], '-y': [0, 2, 1], '+z': [0, 1, 2], '-z': [0, 1, 2] };
const VW = { '+x': [-1, -1], '-x': [1, -1], '+y': [1, 1], '-y': [1, -1], '+z': [1, -1], '-z': [-1, -1] };
function stamp(P, face, n, rows, pal, qa, qb) { const [A, B, N] = PL[face], [da, db] = VW[face];
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c === undefined) continue;
    const QA = qa + i * da, QB = qb + j * db, p = [0, 0, 0]; p[A] = Math.floor(QA / 4); p[B] = Math.floor(QB / 4); p[N] = n;
    P.at(p[0], p[1], p[2], face, QA - 4 * p[A], QB - 4 * p[B], c); } }); }
// a 3 × 5 pixel font (letters are 3 texels wide, one texel apart): text → 5 rows of '#' / '.'
const FONT = {
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###', G: '.###..#.##.#.##',
  H: '#.##.#####.##.#', I: '###.#..#..#.###', K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.########.##.#', N: '##.#.##.##.##.#',
  O: '.#.#.##.##.#.#.', T: '###.#..#..#..#.', U: '#.##.##.##.####', W: '#.##.########.#', Y: '#.##.#.#..#..#.', '4': '#.##.####..#..#',
  '7': '###..#.#..#..#.', '9': '####.####..####', ' ': '...............',
};
const text = s => [0, 1, 2, 3, 4].map(r => [...s].map(ch => (FONT[ch] || FONT[' ']).slice(r * 3, r * 3 + 3)).join('.'));
const textW = s => s.length * 4 - 1;
// knit ribs: vertical, two close shades (on a front face they run with x, on a side with z): reads as knit from the street
const rib = (c, k = .88) => (x, y, z) => ((x + z) & 1) ? c : shade(c, k);
// a flat-bill fitted crown (tall structured front) and its bill; shared by three hats
const FITTED = { ...rowsOf(30, 35, [-9, 8, -8, 8, 1]), 36: [-9, 8, -7, 8, 2], 37: [-8, 7, -5, 7, 2] };
const BILL = { 30: [-8, 7, 9, 14, 2] };
const GLYPH9 = ['..WWWWWWWW..', '.WWWWWWWWWW.', 'WWWW....WWWW', 'WWW......WWW', 'WWW......WWW', 'WWWW....WWWW', '.WWWWWWWWWWW', '...WWWWW.WWW',
  '.........WWW', '.........WWW', 'WW.......WWW', 'WWW.....WWWW', 'WWWW...WWWW.', '.WWWWWWWWWW.', '..WWWWWWWW..'];
const STICKER = ['..gggg..', '.gGGGGg.', 'gGGkkGGg', 'gGkGGkGg', 'gGkGGkGg', 'gGGkkGGg', '.gGGGGg.', '..gggg..'];
const GOLD = { g: 0xf6d36a, G: 0xd9a520, k: 0x9a7412 };

// ── the hats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export default {

  // ═══ COMMON ═══
  nines_fitted: { name: 'Bay Nines Fitted', tier: 'common', why: 'common · the city ball club fitted, flat bill, gold sticker left on',
    draw(H) { const K = 0x1c1c22; solid(H, FITTED, K); solid(H, BILL, K); },
    fine(P) {
      stamp(P, '+z', 8, GLYPH9, { W: 0xf4f1ea }, -6, 4 * 35 + 3);            // the varsity 9 on the front panel
      stamp(P, '+y', 30, STICKER, GOLD, 4 * 3, 4 * 10);                       // the size sticker, never peeled
      for (const [f, n] of [['-x', -9], ['+x', 8]]) stamp(P, f, n, ['kk', 'kk'], { k: 0x0c0c10 }, f === '-x' ? 4 * 2 + 1 : 4 * 2 + 2, 4 * 35 + 2);   // eyelets
      P.halfBox(-1, 76, 2, 1, 77, 4, 0x2e2e36, 1);                               // the button
    } },

  lucky7_dad: { name: 'Lucky 7 Dad Cap', tier: 'common', why: 'common · washed bodega merch, curved bill, low and soft',
    draw(H) { const c = 0xe9dcbc;
      solid(H, { ...rowsOf(30, 32, [-9, 8, -8, 8, 2]), 33: [-9, 8, -8, 8, 3], 34: [-7, 6, -6, 6, 3] }, c);
      solid(H, { 30: [-7, 6, 9, 13, 2], 29: [-8, 7, 9, 12, 2] }, (x, y) => y === 29 && Math.abs(x + .5) < 6 ? null : c);   // the bill curves down at its edges
    },
    fine(P) { const s = 'LUCKY 7'; stamp(P, '+z', 8, text(s), { '#': 0x14a83b }, -Math.ceil(textW(s) / 2), 4 * 32 + 3);
      stamp(P, '-z', -8, ['bbbbbbbb', 'bkkkkkkb', 'bbbbbbbb'], { b: 0xc8a040, k: 0x8a6a20 }, 3, 4 * 31 + 2); } },   // brass buckle at the back

  snap_4am: { name: '4AM Snapback (Backwards)', tier: 'common', why: 'common · red snapback turned round, the strap on the forehead',
    draw(H) { const R = 0xe32a2a;
      const notch = (x, y, z) => x >= -2 && x <= 1 && y >= 31 && y <= 32 && z >= 7;   // the snap opening shows the forehead
      solid(H, { ...rowsOf(30, 34, [-9, 8, -8, 8, 1]), 35: [-9, 8, -8, 7, 2], 36: [-8, 7, -7, 5, 2] }, R, 0, notch);
      solid(H, { 30: [-8, 7, -14, -9, 2] }, R);                                   // the bill, out the back
      for (let x = -3; x <= 2; x++) H.set(x, 30, 8, 0x19181d);                   // the strap
    },
    fine(P) { for (const x of [-3, -1, 1]) stamp(P, '+z', 8, ['.ww.', '.ww.'], { w: 0xf2f2f2 }, 4 * x + 2, 4 * 30 + 2);
      const s = '4AM'; stamp(P, '-z', -8, text(s), { '#': 0xf6f3ea }, Math.ceil(textW(s) / 2), 4 * 34 + 1); } },

  commissary_skully: { name: 'Commissary Skully', tier: 'common', why: 'common · the grey thermal knit everybody brings back from Iron Island',
    draw(H) { const c = 0x8c8f97, yb = z => z >= 3 ? 30 : 29;
      for (let x = -10; x <= 9; x++) for (let z = -9; z <= 9; z++) if (inFoot(x, z, [-10, 9, -9, 9, 2])) for (let y = yb(z); y <= yb(z) + 2; y++) H.set(x, y, z, rib(shade(c, .95), .84)(x, y, z));   // the cuff
      for (let x = -9; x <= 8; x++) for (let z = -8; z <= 8; z++) if (inFoot(x, z, [-9, 8, -8, 8, 1])) for (let y = yb(z) + 3; y <= 35; y++) H.set(x, y, z, rib(c, .92)(x, y, z));
      solid(H, { 36: [-8, 7, -7, 7, 2], 37: [-5, 4, -4, 4, 2] }, rib(c, .92));
    },
    fine(P) { stamp(P, '-z', -9, ['oooooooo', 'owowowoo', 'oooooooo'], { o: 0xff7a1a, w: 0xf6f3ea }, 3, 4 * 31 + 1); } },   // the commissary tag

  dockhand_beanie: { name: 'Low Tide Fisherman', tier: 'common', why: 'common · dockworker beanie, sits high, never touches the ears',
    draw(H) { const c = 0xff6a10;
      solid(H, rowsOf(31, 33, [-10, 9, -9, 9, 2]), rib(c, .86));
      solid(H, { 34: [-9, 8, -8, 8, 2], 35: [-7, 6, -6, 6, 2] }, rib(shade(c, .97), .9));
    },
    fine(P) { const s = 'LOW TIDE', w = textW(s) + 4; const rows = ['k'.repeat(w), ...text(s).map(r => 'kk' + r.replace(/#/g, 'w').replace(/\./g, 'k') + 'kk'), 'k'.repeat(w)];
      stamp(P, '+z', 9, rows, { k: 0x17171b, w: 0xf6f3ea }, -Math.ceil(w / 2), 4 * 33 + 1); } },

  block_bucket: { name: 'Block Bucket', tier: 'common', why: 'common · cobalt nylon bucket, the brim pulled down all round',
    draw(H) { const c = 0x2e5afc, b = shade(c, .9);
      solid(H, { ...rowsOf(30, 34, [-9, 8, -8, 8, 2]), 35: [-8, 7, -7, 7, 2] }, c);
      ring(H, 30, [-11, 10, -10, 10, 4], [-9, 8, -8, 8], b);
      ring(H, 29, [-12, 11, -11, 11, 5], [-10, 9, -9, 9], b);
    },
    fine(P) { stamp(P, '+x', 8, ['wwwwwwww', 'wkwkkwkw', 'wwwwwwww'], { w: 0xf4f4f4, k: 0x17171b }, 4 * 5 + 3, 4 * 32 + 1); } },   // woven side tag

  bodega_bonnet: { name: 'Bodega Bonnet', tier: 'common', why: 'common · teal satin bonnet for the 4am store run, ruffle and all',
    cover: 'all',
    draw(H) { const base = z => z >= 3 ? 30 : z >= -3 ? 28 : 24, T = 0x0fa596, S = 0x3cc7b6, R = 0x8ee9dc;
      const col = (x, y, z) => y <= base(z) + 1 ? (((x + z + y) & 1) ? R : shade(R, .84)) : y >= 37 && x < 2 && z > -6 ? S : T;
      for (let x = -10; x <= 9; x++) for (let z = -12; z <= 9; z++) { if (!inFoot(x, z, [-10, 9, -12, 9, 3])) continue; if (z === 9 && !inFoot(x, z, [-8, 7, -12, 9, 3])) continue;
        if (z <= -11 && !inFoot(x, z, [-9, 8, -12, 9, 4])) continue; const y0 = z <= -10 ? 27 : base(z);
        for (let y = y0; y <= 34; y++) H.set(x, y, z, col(x, y, z), 1); }
      solid(H, { 35: [-10, 9, -12, 9, 4], 36: [-10, 9, -12, 8, 5], 37: [-9, 8, -11, 7, 6], 38: [-8, 7, -10, 6, 6], 39: [-6, 5, -8, 4, 5] }, col, 1);
    } },

  swap_meet_trucker: { name: 'We Buy Anything Trucker', tier: 'common', why: 'common · the fence at the Heap gives these away',
    draw(H) { const F = 0xf3efe4, M = 0x1d1d22, m = 0x34343c;
      solid(H, { ...rowsOf(30, 35, [-9, 8, -8, 8, 1]), 36: [-8, 7, -6, 7, 2] }, (x, y, z) => z >= 6 ? F : ((x + y + z) & 1) ? M : m);
      solid(H, { 30: [-7, 6, 9, 14, 2], 29: [-8, 7, 9, 13, 2] }, (x, y) => y === 29 && Math.abs(x + .5) < 6 ? null : 0x15a63c);
    },
    fine(P) { const R = { '#': 0xe8232a }; stamp(P, '+z', 8, text('WE BUY'), R, -12, 4 * 34 + 3); stamp(P, '+z', 8, text('ANYTHING'), R, -16, 4 * 33 + 1); } },

  // ═══ RARE ═══
  silk_durag: { name: 'Wine Silk Durag', tier: 'rare', why: 'rare · satin durag, tails down the back, holds the waves',
    cover: 'all',
    draw(H) { const c = 0x8c1734, hi = 0xa8264a;
      solid(H, { ...rowsOf(28, 29, [-9, 8, -8, 4, 1]), ...rowsOf(30, 34, [-9, 8, -8, 8, 1]), 35: [-8, 7, -7, 7, 2] }, (x, y) => y >= 34 ? hi : c, 1);
      for (let y = 21; y <= 29; y++) for (let x = y <= 23 ? -3 : -2; x <= (y <= 23 ? 2 : 1); x++) H.set(x, y, -9, (y & 1) ? c : shade(c, .9), 1);   // the tail
      solid(H, { 29: [-1, 0, -10, -10, 0], 30: [-1, 0, -10, -10, 0] }, shade(c, .85), 1);                                                     // the knot
      for (const x of [-2, 1]) for (let y = 23; y <= 28; y++) H.set(x, y, -10, shade(c, .8), 1);                                           // the ties
    },
    fine(P) { const s = 0xd06a86;   // the centre seam, front to back
      for (let z = -7; z <= 7; z++) { P.at(-1, 35, z, '+y', 3, 0, s); P.at(-1, 35, z, '+y', 3, 1, s); P.at(-1, 35, z, '+y', 3, 2, s); P.at(-1, 35, z, '+y', 3, 3, s); P.at(0, 35, z, '+y', 0, 0, s); P.at(0, 35, z, '+y', 0, 1, s); P.at(0, 35, z, '+y', 0, 2, s); P.at(0, 35, z, '+y', 0, 3, s); }
      for (let y = 31; y <= 34; y++) for (let j = 0; j < 4; j++) { P.at(-1, y, 8, '+z', 3, j, s); P.at(0, y, 8, '+z', 0, j, s); } } },

  stick_up_knit: { name: 'Stick-Up Knit', tier: 'rare', why: 'rare · three-hole knit mask, red-trimmed, the robbery uniform',
    cover: 'all', coversEars: true,
    draw(H) { const K = 0x1c1c22, k = 0x26262e;
      const head = (x, y, z) => x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7;
      const hole = (x, y) => (y >= 23 && y <= 27 && ((x >= -7 && x <= -3) || (x >= 2 && x <= 6))) || (y >= 20 && y <= 21 && x >= -3 && x <= 2);
      for (let x = -9; x <= 8; x++) for (let y = 19; y <= 34; y++) for (let z = -8; z <= 8; z++) {
        if (head(x, y, z)) continue; if (y === 34 && !(x >= -8 && x <= 7 && z >= -7 && z <= 7)) continue; if (z === 8 && hole(x, y)) continue;
        H.set(x, y, z, ((x + z) & 1) ? K : k); }
      for (const ex of [-10, 9]) for (let y = 23; y <= 27; y++) for (let z = -1; z <= 1; z++) H.set(ex, y, z, (z & 1) ? K : k);   // over the ears
      H.set(-1, 22, 9, K); H.set(0, 22, 9, k);                                                                           // the nose
    },
    fine(P) { const T = 0xe0262e, hole = (x, y) => (y >= 23 && y <= 27 && ((x >= -7 && x <= -3) || (x >= 2 && x <= 6))) || (y >= 20 && y <= 21 && x >= -3 && x <= 2);
      for (let x = -9; x <= 8; x++) for (let y = 19; y <= 33; y++) { if (hole(x, y) || (y === 22 && (x === -1 || x === 0))) continue;   // red stitched edges round the holes, two texels wide
        if (hole(x, y - 1)) for (let i = 0; i < 4; i++) { P.at(x, y, 8, '+z', i, 0, T); P.at(x, y, 8, '+z', i, 1, T); }
        if (hole(x, y + 1)) for (let i = 0; i < 4; i++) { P.at(x, y, 8, '+z', i, 3, T); P.at(x, y, 8, '+z', i, 2, T); }
        if (hole(x + 1, y)) for (let j = 0; j < 4; j++) { P.at(x, y, 8, '+z', 3, j, T); P.at(x, y, 8, '+z', 2, j, T); }
        if (hole(x - 1, y)) for (let j = 0; j < 4; j++) { P.at(x, y, 8, '+z', 0, j, T); P.at(x, y, 8, '+z', 1, j, T); } } } },

  precinct_cap: { name: 'Precinct 9 Cap', tier: 'rare', why: 'rare · the cop issue peaked cap, gold shield, patent visor',
    draw(H) { const N = 0x1d2a5e, B = 0x121216;
      solid(H, rowsOf(30, 31, [-9, 8, -8, 8, 2]), B);
      solid(H, { 32: [-9, 8, -8, 8, 2], 33: [-10, 9, -9, 9, 3], 34: [-10, 9, -9, 9, 3], 35: [-9, 8, -8, 8, 4] }, N);
      solid(H, { 30: [-7, 6, 9, 10, 1], 29: [-6, 5, 10, 12, 2] }, 0x0b0b0e, 1);                                          // patent visor, angled down
      solid(H, { 31: [-1, 0, 9, 9, 0], 32: [-1, 0, 9, 9, 0], 33: [-1, 0, 9, 9, 0] }, 0xd4a52a, 2);                       // the shield
    },
    fine(P) { stamp(P, '+z', 9, ['.kkkkkk.', 'kGGGGGGk', 'kGkkkkGk', 'kGkGGkGk', 'kGkkkkGk', 'kGGGGkGk', 'kGkkkkGk', 'kGGGGGGk', '.kGGGGk.', '..kGGk..', '...kk...'], { k: 0x6a4a10, G: 0xf0c850 }, -4, 4 * 33 + 3);
      for (let x = -7; x <= 6; x++) if (x < -1 || x > 0) for (let i = 0; i < 4; i++) P.at(x, 31, 8, '+z', i, 0, 0xd4a52a); } },   // the gold cord

  corner_rag: { name: 'Corner Rag', tier: 'rare', why: 'rare · green paisley bandana, knotted at the back, tails out',
    draw(H) { const G = 0x139a45, W = 0xf2f0e8;
      const dot = (x, y, z) => (hash3(x, y, z) % 11 === 0 && z < 8) ? W : (y === 28 || (y === 30 && z >= 5)) ? shade(G, .88) : G;
      solid(H, { ...rowsOf(28, 29, [-9, 8, -8, 4, 1]), ...rowsOf(30, 33, [-9, 8, -8, 8, 1]), 34: [-8, 7, -7, 7, 2] }, dot);
      solid(H, { 28: [-1, 0, -9, -9, 0], 29: [-1, 0, -10, -9, 0], 30: [-1, 0, -10, -9, 0] }, shade(G, .85));                // the knot
      for (const [x, y] of [[-1, 28], [-2, 28], [-2, 27], [-2, 26], [-3, 26], [-3, 25], [-3, 24], [0, 28], [1, 28], [1, 27], [1, 26], [2, 26], [2, 25], [2, 24]]) H.set(x, y, -10, (x + y) & 1 ? G : shade(G, .9));
    },
    fine(P) { const W = 0xf2f0e8, M = ['.ww.', 'w..w', 'w.w.', '.w..'], D = ['....', '.w..', '....', '..w.'];
      for (let x = -8; x <= 7; x++) for (let y = 31; y <= 32; y++) (((x + y) & 1) ? M : D).forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === 'w') P.at(x, y, 8, '+z', i, 3 - j, W); });
      for (let x = -8; x <= 7; x++) for (let i = 0; i < 4; i++) { P.at(x, 30, 8, '+z', i, 2, W); if ((i + x) & 1) P.at(x, 30, 8, '+z', i, 0, W); } } },   // the border

  // ═══ EPIC ═══
  rag_under_fitted: { name: 'Taxi Fitted Over Rag', tier: 'epic', why: 'epic · yellow fitted over a black silk rag, tails hanging',
    cover: 'all',
    draw(H) { const Y = 0xfdc11c, K = 0x19181d, D = 0x141418;
      solid(H, rowsOf(28, 29, [-9, 8, -8, 5, 1]), D, 1);
      for (let y = 21; y <= 29; y++) for (let x = y <= 23 ? -3 : -2; x <= (y <= 23 ? 2 : 1); x++) H.set(x, y, -9, (y & 1) ? D : 0x24242a, 1);
      for (const x of [-2, 1]) for (let y = 23; y <= 28; y++) H.set(x, y, -10, 0x2c2c33, 1);
      solid(H, FITTED, Y); solid(H, BILL, K);
    },
    fine(P) { stamp(P, '+z', 8, ['KKKK....KKKK', 'KKKK...KKKK.', 'KKKK..KKKK..', 'KKKK.KKKK...', 'KKKKKKKK....', 'KKKKKKK.....', 'KKKKKKKK....', 'KKKK.KKKK...', 'KKKK..KKKK..', 'KKKK...KKKK.', 'KKKK....KKKK', 'KKKK.....KKK'], { K: 0x17171b }, -6, 4 * 35 + 1);
      stamp(P, '+y', 30, STICKER, GOLD, 4 * 3, 4 * 10); P.halfBox(-1, 76, 2, 1, 77, 4, 0x17171b, 1); } },

  mack_brim: { name: 'The Mack', tier: 'epic', why: 'epic · purple velvet wide brim, leopard band, pink feather',
    draw(H) { const V = 0x6a2fc8, v = 0x5a26ad, L = 0xd9a441;
      const leo = (x, y, z) => hash3(x, y, z) % 4 === 0 ? 0x2a1a0e : hash3(z, x, y) % 5 === 0 ? 0xa0541a : L;
      solid(H, { 30: [-14, 13, -13, 13, 7] }, v);
      for (let x = -14; x <= 13; x++) for (let z = -13; z <= 13; z++) if (inFoot(x, z, [-14, 13, -13, 13, 7]) && (x <= -13 || x >= 12)) H.set(x, 31, z, v);   // the side curl
      solid(H, { ...rowsOf(30, 35, [-9, 8, -8, 8, 2]), 36: [-9, 8, -7, 7, 3] }, V);
      solid(H, { 37: [-8, 7, -6, 6, 3] }, V, 0, x => x === -1 || x === 0);                                                // the crease
      solid(H, rowsOf(30, 31, [-10, 9, -9, 9, 3]), leo);                                                                     // the band
      const F = 0xfd4ca0, f = 0xfd8ac2; let p = [10, 31, -2], n = 0;   // the feather: a face-connected stair up and back, a plume in the middle
      for (const s of [[0, 1, 0], [0, 0, -1], [0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 1, 0], [0, 0, -1], [0, 1, 0], [0, 1, 0]]) {
        H.set(...p, F); H.set(p[0], p[1], p[2] + 1, f); if (n >= 3 && n <= 9) H.set(p[0], p[1], p[2] - 1, n & 1 ? f : F); if (n >= 5 && n <= 7) H.set(p[0], p[1], p[2] + 2, F); p = p.map((v, i) => v + s[i]); n++; }
      H.set(...p, F);
    } },

  uptown_monogram: { name: 'Uptown Monogram Bucket', tier: 'epic', why: 'epic · knock-off luxe, all-over monogram, Harlem tailor energy',
    draw(H) { const T = 0x5a3618, D = 0xd6a35c, G = 0xf0c040;
      const mono = (a, b) => { a = ((a % 4) + 4) % 4; b = ((b % 4) + 4) % 4; return b === 1 && a === 0 ? D : b === 1 && a === 2 ? G : b === 3 && a === 2 ? D : b === 3 && a === 0 ? G : T; };
      const wall = (x, y, z) => mono(x + z, y), flat = (x, y, z) => mono(x, z + (y & 1) * 2);
      solid(H, rowsOf(30, 35, [-9, 8, -8, 8, 2]), wall); solid(H, { 36: [-8, 7, -7, 7, 2] }, flat);
      ring(H, 30, [-11, 10, -10, 10, 4], [-9, 8, -8, 8], flat);
      ring(H, 29, [-13, 12, -12, 12, 6], [-10, 9, -9, 9], flat);
    },
    fine(P) { for (let x = -7; x <= 6; x++) for (let y = 30; y <= 35; y++) { const a = (((x + 8) % 4) + 4) % 4, b = ((y % 4) + 4) % 4;
      if (b === 1 && a === 0 || b === 3 && a === 2) stamp(P, '+z', 8, ['.dd.', 'd..d', 'd..d', '.dd.'], { d: 0x5a3618 }, 4 * x, 4 * y + 3);
      else if (b === 1 && a === 2 || b === 3 && a === 0) stamp(P, '+z', 8, ['....', '.dd.', '.dd.', '....'], { d: 0x7a4a1c }, 4 * x, 4 * y + 3); } } },

  // ═══ GRAIL ═══
  pink_mink: { name: 'Pink Mink', tier: 'grail', why: 'grail · the hot pink mink trapper. Uptown, 2003, forever',
    cover: 'all', coversEars: true,   // (all hair tucked up inside: nothing is left hanging cut under the flaps)
    draw(H) { const PK = [0xfc4aa0, 0xfd72b5, 0xe2398c], cells = new Map(), put = (x, y, z, part) => cells.set(x + ',' + y + ',' + z, [x, y, z, part]);
      const add = (rows, part) => { for (const [ys, f] of Object.entries(rows)) for (let x = f[0]; x <= f[1]; x++) for (let z = f[2]; z <= f[3]; z++) if (inFoot(x, z, f)) put(x, +ys, z, part); };
      add({ ...rowsOf(33, 35, [-11, 10, -10, 10, 5]), ...rowsOf(36, 37, [-10, 9, -9, 9, 5]), 38: [-9, 8, -8, 8, 5], 39: [-7, 6, -6, 6, 4] }, 0);   // the crown
      add(rowsOf(29, 32, [-12, 11, -11, 11, 5]), 1);                                       // the turned-up fur brim
      for (const x0 of [-12, 9]) add({ ...rowsOf(22, 28, [x0, x0 + 2, -3, 2, 1]), 21: [x0, x0 + 2, -2, 1, 1] }, 2);   // the ear flaps
      add(rowsOf(24, 28, [-10, 9, -11, -8, 2]), 2);                                        // the back flap
      const has = (x, y, z) => cells.has(x + ',' + y + ',' + z);
      for (const [x, y, z, part] of cells.values()) {
        const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => !has(x + a, y + b, z + c));
        const xs = x < 0 ? -1 - x : x;                                                     // (mirrored: the fur is the same both sides)
        if (open && part === 0 && y >= 34 && hash3(xs, y, z) % 7 === 0) continue;         // a soft, ragged top
        const t = hash3(xs >> 1, y >> 1, z >> 1) % 3; H.set(x, y, z, part === 1 ? (t === 2 ? PK[0] : PK[1]) : PK[t]); } } },

  iced_fitted: { name: 'Iced Out Fitted', tier: 'grail', why: 'grail · a fitted set in stones, gold bill, the whole block knows',
    draw(H) { const ICE = [0xf4fbff, 0xcfe6fa, 0xfdfeff, 0xb6d4ee, 0xe2f0ff];
      solid(H, FITTED, (x, y, z) => ICE[hash3(x, y, z) % 5], 1);
      solid(H, BILL, (x, y, z) => (x + z) & 1 ? 0xe2b437 : 0xc99a22, 2);
    },
    fine(P) { stamp(P, '+z', 8, GLYPH9, { W: 0xe2b437 }, -6, 4 * 35 + 3);
      for (let x = -6; x <= 5; x += 1) P.half(2 * x + 1, 61, 30, (x & 1) ? 0xffffff : 0xcfe6fa, 1); } },   // stones along the bill's edge
};
