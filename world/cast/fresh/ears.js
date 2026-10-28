// FRESH REGISTRY · ears (slot 'ears'). This file has exactly one owner: the ears designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Ears. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// HOW THIS FILE IS BUILT
// · Every piece is designed on the RIGHT ear (x −10..−9, outer face x −11) and mirrored onto the left (x → −1 − x) by X().
// · A piece is placed all-or-nothing (put): every new cell must be empty and every recoloured ear cell must be there, so nothing
//   ever overwrites another slot's voxel and nothing is left half-drawn.
// · Depth (README: an ear item stands at most 1 proud): a piece is a 1-voxel shell on the ear; anything longer hangs in the air
//   (a hoop, a tag, a dangle), never stacks 2 deep on a surface.
// · Under a covering hat or hair, three behaviours (each trait's `why` says which):
//   hide (the default: the ear is covered, so is the item) · socket (`socket: true`: the piece reads the outer surface where it sits
//   — the ear, a hat's ear flap, a full wrap or hanging hair — and rests 1 voxel outside it) · over (`overHat: true`: headphones,
//   whose band follows the top of whatever is on the head).
// · THE LOBE (construction: LOBE from kit.js, world/fit/body.js): the exact earlobe voxel, [−10, 23, 0] on the right ear. A piece
//   registered `lobe: 'hang'` (a hoop, a dangle, a tag, a lock) passes its top into that voxel (the cell right under it, and a painted
//   piercing on its outer face) and hangs straight down from it inside the ear's own columns (x −10..−9), its ring facing sideways like
//   the ear; it never sits off the side of the head beside the jaw. A `lobe: 'stud'` sits flush on the lobe's outer face. The audit
//   fails a lobe piece that misses the lobe (README § Ears). Behind-the-ear tucks, headsets, coils and over-the-hat pieces aren't lobe
//   pieces and keep their own placement; a socket piece hangs from the lobe while the ear shows and tucks under a covering hat's edge.
// · draw() places the voxels and keeps where they went; fine() paints those same voxels (P.at, never on another slot's voxel).
import { shade, LOBE as ANCHOR } from './kit.js';

const BOTH = [-1, 1], RIGHT = [-1];
const X = (s, x) => (s < 0 ? x : -1 - x);                 // a right-ear x on side s
const HX = (s, hx) => (s < 0 ? hx : -1 - hx);             // the same for half (fine voxel) coordinates
const inEar = (x, y, z) => (x === -10 || x === -9) && y >= 23 && y <= 27 && z >= -1 && z <= 1;   // right-ear coords

// a right-ear cell that still shows the bare ear: there, and in the worn skin's own colour (a wrap, a rag or ink over it is not bare)
const skinAt = (H, ctx, s, x, y, z) => { const a = X(s, x); if (!H.has(a, y, z)) return false; const c = H.get(a, y, z);
  return !ctx || !ctx.sk || c === ctx.sk.c(a, y, z) || c === ctx.sk.sh(a, y, z); };
const bare = (H, ctx, s, cells) => cells.every(([x, y, z]) => skinAt(H, ctx, s, x, y, z));
// the body boxes the audit measures relief from (the head and the ears): a recoloured cell there is a recolour, not relief
const BODY = (x, y, z) => (x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7) || ((x >= -10 && x <= -9 || x >= 8 && x <= 9) && y >= 23 && y <= 27 && z >= -1 && z <= 1);
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], KEY = (x, y, z) => x + ',' + y + ',' + z;
// the depth rule, simulated before anything is written: from every open face of the piece, back through the piece's own cells, at most
// 1 voxel that isn't body may stand on whatever it ends against (a run that ends in the air hangs: a hoop, a tag, a dangle)
function depthOK(H, real, hang = false) { const mine = new Set(real.map(([x, y, z]) => KEY(x, y, z)));
  for (const [x, y, z] of real) for (const [dx, dy, dz] of N6) { if (hang && dy) continue;   // (a lobe piece hangs: measured out of the ear, never up or down, as the audit does)
    const nx = x + dx, ny = y + dy, nz = z + dz; if (mine.has(KEY(nx, ny, nz)) || H.has(nx, ny, nz)) continue;
    let t = 0, a = x, b = y, c = z; while (mine.has(KEY(a, b, c)) && t < 20) { if (!BODY(a, b, c)) t++; a -= dx; b -= dy; c -= dz; }
    if (t > 1 && H.has(a, b, c)) return false; }
  return true; }
// all-or-nothing: cells [x, y, z, colour, l] in right-ear coords. New cells must be empty, recoloured ear cells must be bare ear,
// `need` (ear cells the piece rests on) must be bare ear, and the piece must keep the depth rule (unless `free`: an overHat piece;
// `hang`: a piece hanging from the lobe, measured along x and z only, never up or down).
function put(H, s, cells, { ctx = null, need = [], free = false, hang = false } = {}) {
  for (const [x, y, z] of cells) { if (inEar(x, y, z) ? !skinAt(H, ctx, s, x, y, z) : H.has(X(s, x), y, z)) return null; }
  if (!bare(H, ctx, s, need)) return null;
  const real = cells.map(([x, y, z]) => [X(s, x), y, z]); if (!free && !depthOK(H, real, hang)) return null;
  for (const [x, y, z, c, l] of cells) H.set(X(s, x), y, z, c, l || 0);
  return cells;
}
// a socket piece (shape at x 0, right-ear coords): 1 voxel outside the outermost surface under its own cells (the ear, a hat's ear
// flap, a wrap, hanging hair), pushed out one more if the depth rule needs it; never further than `cap` (a brim is not a socket) → x | null
function socket(H, s, shape, colour, l, cap) { const m = surface(H, s, shape); if (m === null) return null;
  for (let x = m - 1; x >= Math.max(cap, m - 2); x--) if (put(H, s, shift(shape.map(([, y, z]) => [0, y, z, colour, l]), x))) return x;
  return null; }
const shift = (cells, dx) => cells.map(([x, y, z, c, l]) => [x + dx, y, z, c, l]);
// the outermost occupied x (right-ear coords, so the most negative) over the (y, z) of the given cells; null if nothing is there
function surface(H, s, cells) {
  let m = null;
  for (const [, y, z] of cells) for (let x = -16; x <= -8; x++) if (H.has(X(s, x), y, z)) { if (m === null || x < m) m = x; break; }
  return m;
}

// paint a bitmap on one face of the piece, rows top → bottom as seen from outside the RIGHT ear's face (the left ear gets the mirror
// image; `text` keeps letters readable on the left). face: 'out' (the side of the head) · 'front' (+z) · 'back' (−z) · 'top' · 'bottom'.
// layer: the face's own coordinate (out: x · front/back: z · top/bottom: y). a0, b0: the voxel at the bitmap's top-left
// (out: z, y · front: x, y · back: x, y · top/bottom: x, z). `on`: only voxels in this set of 'x,y,z' keys (right-ear coords).
const FACE = { out: ['-x', '+x'], in: ['+x', '-x'], front: ['+z', '+z'], back: ['-z', '-z'], top: ['+y', '+y'], bottom: ['-y', '-y'] };
function area(P, s, face, layer, a0, b0, rows, pal, { text = false, on = null } = {}) {
  if (text && s > 0) rows = rows.map(r => [...r].reverse().join(''));
  const f = FACE[face][s < 0 ? 0 : 1];
  rows.forEach((r, row) => { for (let col = 0; col < r.length; col++) {
    const c = typeof pal === 'function' ? pal(r[col], col, row) : pal[r[col]]; if (c === undefined || c === null) continue;
    const ca = Math.floor(col / 4), ci = col % 4, rb = Math.floor(row / 4), rj = row % 4; let x, y, z, i, j;
    if (face === 'out') { x = layer; z = a0 + ca; i = ci; y = b0 - rb; j = 3 - rj; }
    else if (face === 'in') { x = layer; z = a0 - ca; i = 3 - ci; y = b0 - rb; j = 3 - rj; }
    else if (face === 'front') { z = layer; x = a0 + ca; i = ci; y = b0 - rb; j = 3 - rj; }
    else if (face === 'back') { z = layer; x = a0 - ca; i = 3 - ci; y = b0 - rb; j = 3 - rj; }
    else if (face === 'top') { y = layer; x = a0 + ca; i = ci; z = b0 + rb; j = rj; }
    else { y = layer; x = a0 + ca; i = ci; z = b0 - rb; j = 3 - rj; }
    if (on && !on.has(x + ',' + y + ',' + z)) continue;
    if (s > 0 && face !== 'out' && face !== 'in') i = 3 - i;   // (a face whose texels run along x: mirrored with it)
    P.at(X(s, x), y, z, f, i, j, c); } });
}
const keys = cells => new Set(cells.map(([x, y, z]) => x + ',' + y + ',' + z));
const four = (P, s, face, x, y, z, rows, pal, o) => area(P, s, face, face === 'out' || face === 'in' ? x : face === 'top' || face === 'bottom' ? y : z,
  face === 'out' || face === 'in' ? z : x, face === 'top' || face === 'bottom' ? z : y, rows, pal, o);
const halves = (P, s, list) => { for (const [hx, hy, hz, c, l] of list) P.half(HX(s, hx), hy, hz, c, l || 0); };

// a trait: place(H, ctx) → what it drew (or null) · paint(P, drawn, ctx) on those voxels. noEars hides it unless it sits over the hat.
function T({ place, paint, ...o }) {
  let drawn = null;
  return { ...o,
    draw(H, ctx) { drawn = null; if (ctx && ctx.sk && ctx.sk.noEars && !o.overHat) return; drawn = place(H, ctx) || null; },
    fine(P, ctx) { const d = drawn; drawn = null; if (d && paint) paint(P, d, ctx); } };
}

// ── palette (each trait uses its own few)
const GOLD = 0xF2BF45, GOLD_HI = 0xFFE9A6, GOLD_LO = 0xCF9526, GOLD_DK = 0x9C6A14;   // (jewellery is gloss, not metal: the city's metal reads dark without an env map)
const SILVER = 0xCDD3DA, SILVER_HI = 0xF2F5F8, SILVER_LO = 0x8D97A2;
const ICE = 0xE4F4FF, ICE_W = 0xFFFFFF, ICE_B = 0xA6D8F2, ICE_D = 0x5FA8D3;
const INK = 0x17171B;

// the ear cells (right-ear coords): all 30, and THE LOBE: the construction's anchor (LX, LY, LZ = −10, 23, 0), the voxel every lobe
// piece enters. A hanging piece's top cell is (LX, LY − 1, LZ), right under it; a stud sits on its outer face (LX − 1, LY, LZ).
const EAR = []; for (let x = -10; x <= -9; x++) for (let y = 23; y <= 27; y++) for (let z = -1; z <= 1; z++) EAR.push([x, y, z]);
const [LX, LY, LZ] = ANCHOR.R, LOBE = [[LX, LY, LZ]];
const each = (H, ctx, cells, o = {}) => { const out = []; for (const s of BOTH) if (put(H, s, cells, { ctx, ...o })) out.push(s); return out.length ? out : null; };
// the piercing: the piece's wire entering the lobe, painted on the lobe voxel's outer face (bottom middle, running up from its lower
// edge into the hole), so the piece visibly goes INTO the ear, not beside it. rows: 4 strings of 4, top → bottom as seen from outside.
const PIERCE = ['....', '....', '.ab.', '.ab.'];
const pierce = (P, s, a, b, rows = PIERCE) => four(P, s, 'out', LX, LY, LZ, rows, { a, b });
const onBare = (H, ctx, need) => { const out = BOTH.filter(s => bare(H, ctx, s, need)); return out.length ? out : null; };
// is this side's ear covered (for a socket piece)? the ear itself is wrapped (a flap, a full wrap), or hair hangs over most of it
const covered = (H, ctx, s) => { if (!skinAt(H, ctx, s, -10, 25, 0)) return true; let n = 0;
  for (let y = 23; y <= 27; y++) for (let z = -1; z <= 1; z++) if (H.has(X(s, -11), y, z)) n++; return n >= 8; };

export default {

  // ━━ COMMON ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  bodega_ice: T({ name: 'Bodega Ice', tier: 'common', lobe: 'stud',
    why: 'common · square glass studs off the counter by the lottery tickets, both lobes · under a covering hat: hidden',
    place: (H, ctx) => onBare(H, ctx, LOBE),
    paint(P, sides) { for (const s of sides) halves(P, s, [[-22, 46, 0, ICE_B, 1], [-22, 47, 0, ICE_W, 1], [-22, 46, 1, ICE, 1], [-22, 47, 1, ICE_B, 1],   // (flush on the lobe's outer face)
      [-21, 46, 0, ICE, 1], [-21, 47, 0, ICE_W, 1], [-21, 46, 1, ICE_B, 1], [-21, 47, 1, ICE_W, 1]]); } }),

  lobe_huggies: T({ name: 'Lobe Huggies', tier: 'common', lobe: 'hang',
    why: 'common · fat little gold hoops hugging both lobes · under a covering hat: hidden',
    // the hoop goes through the lobe: its lower half is the voxel right under the lobe, its upper half wraps the lobe's lower edge (paint)
    place: (H, ctx) => each(H, ctx, [[LX, LY - 1, LZ, GOLD, 1]], { need: LOBE, hang: true }),
    paint(P, sides) { const pal = { h: GOLD_HI, l: GOLD_LO, g: GOLD };
      for (const s of sides) { four(P, s, 'out', LX, LY, LZ, ['....', '....', '.hh.', 'hggl'], pal);
        four(P, s, 'out', LX, LY - 1, LZ, ['h..l', 'h..l', 'l..l', '.ll.'], pal);
        four(P, s, 'front', LX, LY - 1, LZ, ['hh..', '.h..', '....', 'llll'], pal); four(P, s, 'back', LX, LY - 1, LZ, ['..hh', '..h.', '....', 'llll'], pal); } } }),

  black_plugs: T({ name: 'Black Plugs', tier: 'common', lobe: 'stud',
    why: 'common · stretched lobes, black plugs with a steel lip, flat in the lobe · under a covering hat: hidden',
    place: (H, ctx) => onBare(H, ctx, [-1, 0, 1].flatMap(z => [[-10, 23, z], [-10, 24, z]])),
    paint(P, sides) { const rows = ['....KKKK....', '...KKKKKK...', '..KKKSSKKK..', '..KKSddDKK..', '..KKSddDKK..', '..KKKDDKKK..', '...KKKKKK...', '....KKKK....'];
      for (const s of sides) area(P, s, 'out', -10, -1, 24, rows, { K: 0x141418, S: 0x9AA3AD, d: 0x2E2226, D: 0x050506 }); } }),

  numbers_pencil: T({ name: 'Numbers Pencil', tier: 'common', socket: true,
    why: "common · the runner's betting pencil parked behind the right ear · under a covering hat: socket, tucked into the hat's edge",
    place(H, ctx) { const s = -1, shape = [-3, -2, -1, 0, 1, 2, 3].map(z => [0, 28, z]), x = socket(H, s, shape, 0xF4C430, 0, covered(H, ctx, s) ? -12 : -11); if (x === null) return null;
      H.set(X(s, x), 28, -3, 0xEE8C9C, 0); H.set(X(s, x), 28, 3, 0xE8C79A, 0); return { x }; },
    paint(P, { x }) { const s = -1, pal = { S: 0xB9C0C8, G: 0xC8962A, K: 0x2B2B30, l: 0xC99A12, w: 0xC9A574 };
      four(P, s, 'out', x, 28, -3, ['...S', '...S', '...S', '...S'], pal); four(P, s, 'top', x, 28, -3, ['...S', '...S', '...S', '...S'], pal);
      four(P, s, 'out', x, 28, -2, ['S...', 'S...', 'S...', 'llll'], pal); four(P, s, 'out', x, 28, 0, ['....', '.GGG', '....', 'llll'], pal);
      for (const z of [-1, 1, 2]) four(P, s, 'out', x, 28, z, ['....', '....', '....', 'llll'], pal);
      four(P, s, 'out', x, 28, 3, ['w...', '..KK', '..KK', 'w...'], pal); four(P, s, 'front', x, 28, 3, ['....', '.KK.', '.KK.', '....'], pal); } }),

  st_mercy_tape: T({ name: 'St. Mercy Tape', tier: 'common',
    why: 'common · the right ear dressed and taped after a bad night, the hospital souvenir · under a covering hat: hidden',
    place(H, ctx) { const G = 0xEFEBE2, cells = [];
      for (const [x, y, z] of EAR) if (!(x === -9 && y === 25 && z === 0)) cells.push([x, y, z, x === -10 && z === 1 && y >= 24 && y <= 26 ? 0xD6CFC2 : G, 0]);   // (the ear's hidden core stays the ear)
      for (let y = 24; y <= 26; y++) for (let z = -1; z <= 1; z++) cells.push([-11, y, z, 0xFAF8F3, 0]);
      return put(H, -1, cells, { ctx, need: [[-9, 25, 0]] }) ? true : null; },
    paint(P) { const s = -1, pal = { t: 0xD8BC8A, T: 0xC4A673, p: 0xE7A8A2 };
      area(P, s, 'out', -11, -1, 26, ['tt........tt', 'Ttt......ttT', '.Ttt....ttT.', '..Ttt..ttT..', '...TttttT...', '....TttT.p..', '....tTTt.pp.', '...ttTTtt...', '..ttT..Ttt..', '.ttT....Ttt.', 'ttT......Ttt', 'tT........Tt'], pal);
      area(P, s, 'front', 1, -10, 25, ['tttttttt', 'TTTTTTTT'], pal); } }),

  burner_headset: T({ name: 'Burner Headset', tier: 'common',
    why: 'common · prepaid hands-free on the right ear, boom mic down the jaw for corner calls · under a covering hat: hidden',
    place(H, ctx) { const s = -1, B = 0x1D1E22, body = [[-11, 24, -1], [-11, 25, -1], [-11, 26, -1], [-11, 24, 0], [-11, 25, 0], [-11, 26, 0], [-11, 25, 1], [-10, 23, 1], [-10, 24, 1]].map(([x, y, z]) => [x, y, z, B, 1]);
      if (!put(H, s, body, { ctx })) return null;
      const boom = put(H, s, [[-9, 23, 2, B, 1], [-9, 22, 2, B, 1], [-9, 22, 3, B, 1], [-9, 22, 4, 0x3A3D44, 1]], { ctx, need: [[-9, 23, 1]] });
      return { boom: !!boom }; },
    paint(P, { boom }) { const s = -1, pal = { b: 0x3FA9FF, r: 0x5A5E66, m: 0x8A9099, k: 0x101114 };
      area(P, s, 'out', -11, -1, 26, ['.rrrrrr.', 'r......r', 'r......r', 'r..bb..r', 'r..bb..r', 'r......r', 'r......r', '.rrrrrr.', '........', '........', '........', '........'], pal, { on: keys([[-11, 24, -1], [-11, 25, -1], [-11, 26, -1], [-11, 24, 0], [-11, 25, 0], [-11, 26, 0]]) });
      if (boom) { four(P, s, 'front', -9, 22, 4, ['.mm.', 'mkkm', 'mkkm', '.mm.'], pal); four(P, s, 'out', -9, 22, 4, ['....', 'mkmk', 'kmkm', '....'], pal); } } }),

  tucked_twenty: T({ name: 'Tucked Twenty', tier: 'common', socket: true,
    why: "common · a folded twenty parked behind the right ear, change from the corner · under a covering hat: socket, tucked into the hat's edge",
    place(H, ctx) { const shape = [[0, 28, -3], [0, 29, -3], [0, 28, -2], [0, 29, -2], [0, 28, -1], [0, 28, 0], [0, 28, 1], [0, 28, 2], [0, 29, 2]], x = socket(H, -1, shape, 0x8CBF7E, 0, covered(H, ctx, -1) ? -12 : -11);
      return x === null ? null : { x }; },
    paint(P, { x }) { const s = -1, pal = { C: 0xE6EDD2, D: 0x355E3F, g: 0x5E9460 };
      area(P, s, 'out', x, -3, 29, ['CCCCCCCC', 'C222.000', 'C..2.0.0', 'C222.0.0', 'C2...0.0', 'C222.000', 'CCCCCCCC', 'gggggggg'], { ...pal, 2: pal.D, 0: pal.D }, { text: true });
      area(P, s, 'out', x, -1, 28, ['CCCCCCCCCCCC', '....DD......', '...DggD.....', 'CCCCCCCCCCCC'], pal);
      area(P, s, 'out', x, 2, 29, ['CCCC', 'C...', 'C.D.', 'C...', 'C...', 'C.D.', 'C...', 'CCCC'], pal); } }),

  // ━━ RARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  door_knockers: T({ name: 'Door Knockers', tier: 'rare', socket: true, lobe: 'hang',
    why: "rare · big gold bamboo hoops, the corner classic, hung through the lobes · under a covering hat: socket, they hang from under the hat's edge (or over long hair)",
    // a bare ear: the hoop hangs from the lobe, its top arc right under the lobe voxel (entering it: the painted piercing), straight down
    // in the ear's outer column, its face to the side; 5 wide like the socket's ring but 4 tall, since it now starts under the lobe row
    // and stops at y 19, the ring's old bottom (y 18 is a big shoulder cap's) · a covered ear: the 5 × 5 ring from under the hat's edge
    // or over the hair, as before
    place(H, ctx) { const ring = [[0, 23, -1], [0, 23, 0], [0, 23, 1], [0, 22, -2], [0, 22, -1], [0, 22, 1], [0, 22, 2], [0, 21, -2], [0, 21, 2], [0, 20, -2], [0, 20, -1], [0, 20, 1], [0, 20, 2], [0, 19, -1], [0, 19, 0], [0, 19, 1]];
      const hoop = [[0, LY - 1, LZ - 1], [0, LY - 1, LZ], [0, LY - 1, LZ + 1], [0, LY - 2, LZ - 2], [0, LY - 2, LZ - 1], [0, LY - 2, LZ + 1], [0, LY - 2, LZ + 2],
        [0, LY - 3, LZ - 2], [0, LY - 3, LZ - 1], [0, LY - 3, LZ + 1], [0, LY - 3, LZ + 2], [0, LY - 4, LZ - 1], [0, LY - 4, LZ], [0, LY - 4, LZ + 1]], out = [];
      for (const s of BOTH) {
        if (!covered(H, ctx, s)) { if (put(H, s, shift(hoop.map(([, y, z]) => [0, y, z, GOLD, 1]), LX), { ctx, need: LOBE, hang: true })) out.push([s, LX, hoop]); }
        else { const x = socket(H, s, ring, GOLD, 1, -13); if (x !== null) out.push([s, x, ring]); } }
      return out.length ? out : null; },
    paint(P, sides) { const pal = { h: GOLD_HI, r: GOLD_LO, d: GOLD_DK }, across = ['hhhr', '...r', '...r', '...r'], down = ['hhhh', 'h...', 'h...', 'rrrr'], corner = ['hh..', 'h...', '....', '...r'];
      for (const [s, x, cells] of sides) { const ys = cells.map(c => c[1]), top = Math.max(...ys), bot = Math.min(...ys);
        for (const [, y, z] of cells) { const pat = y === top || y === bot ? across : Math.abs(z) === 2 ? down : corner; four(P, s, 'out', x, y, z, pat, pal);
          if (z === Math.max(...cells.filter(c => c[1] === y).map(c => c[2]))) four(P, s, 'front', x, y, z, pat === corner ? across : pat, pal); }
        if (x === LX) pierce(P, s, GOLD_HI, GOLD_LO); } } }),

  snake_eyes: T({ name: 'Snake Eyes', tier: 'rare', lobe: 'hang',
    why: 'rare · a pair of stoop dice, one off each lobe, both showing ones · under a covering hat: hidden',
    place: (H, ctx) => each(H, ctx, [[LX, LY - 1, LZ, 0xF4F1E8, 1]], { need: LOBE, hang: true }),
    paint(P, sides) { const one = ['GGGG', '.RR.', '.RR.', '....'], fourP = ['GGGG', '....', '....', 'K..K'], pal = { R: 0xD7212C, K: INK, G: GOLD };
      for (const s of sides) { pierce(P, s, GOLD_HI, GOLD_LO); four(P, s, 'out', -10, 22, 0, one, pal); four(P, s, 'in', -10, 22, 0, one, pal); four(P, s, 'front', -10, 22, 0, ['GGGG', 'K..K', '....', 'K..K'], pal);
        four(P, s, 'back', -10, 22, 0, fourP, pal); four(P, s, 'bottom', -10, 22, 0, ['K..K', '.KK.', '.KK.', 'K..K'], pal); } } }),

  doorman_coil: T({ name: 'Doorman Coil', tier: 'rare',
    why: 'rare · the Gatehill lobby earpiece, a clear coil from the right ear down into the collar · under a covering hat: hidden',
    place(H, ctx) { const C = 0xCFE2E8;
      return put(H, -1, [[-10, 24, 1, C, 1], [-9, 22, -1, C, 1], [-9, 22, -2, C, 1], [-9, 21, -2, C, 1], [-9, 20, -2, C, 1]], { ctx, need: [[-9, 23, -1], [-10, 23, -1], [-10, 23, 0], [-10, 23, 1], [-10, 24, 0]] }) ? true : null; },
    paint(P) { const s = -1, pal = { L: 0xE9F4F7, D: 0x8EA6B0, K: 0x2A3238, c: 0xCFE2E8 };
      for (const y of [20, 21, 22]) { four(P, s, 'out', -9, y, -2, ['LLLL', 'DDDD', 'LLLL', 'DDDD'], pal); four(P, s, 'back', -9, y, -2, ['LLLL', 'DDDD', 'LLLL', 'DDDD'], pal); }
      four(P, s, 'out', -10, 24, 1, ['.LL.', 'LKKL', 'LKKL', '.LL.'], pal); four(P, s, 'front', -10, 24, 1, ['.LL.', 'LKKL', 'LKKL', '.LL.'], pal);
      area(P, s, 'out', -10, -1, 24, ['............', '............', '............', '.........c..', '........c...', '......cc....', '....cc......', 'cccc........'], pal); } }),

  lot_tag: T({ name: 'Lot Tag', tier: 'rare', lobe: 'hang',
    why: 'rare · a yellow livestock tag punched through the right lobe, lot 41 · under a covering hat: hidden',
    // the button on the lobe's outer face, the tag hanging straight down from the lobe in the ear's outer column (its top row right under it)
    place(H, ctx) { const Y = 0xF5C518, cells = [[LX - 1, LY, LZ, Y, 1]]; for (let y = LY - 3; y <= LY - 1; y++) for (let z = -1; z <= 1; z++) cells.push([LX, y, LZ + z, Y, 1]);
      return put(H, -1, cells, { ctx, need: LOBE, hang: true }) ? true : null; },
    paint(P) { const s = -1, pal = { K: INK, s: 0xC79A0C, h: 0xFFE27A };
      area(P, s, 'out', LX, LZ - 1, LY - 1, ['hhhhhhhhhhhh', '..K.K..K....', '..K.K.KK....', '..KKK..K....', '....K..K....', '....K.KKK...', '............', '.K.KK.K.KK..', '.K.KK.K.KK..', '.K.KK.K.KK..', '............', 'ssssssssssss'], pal, { text: true });
      four(P, s, 'out', LX - 1, LY, LZ, ['.ss.', 's..s', 's..s', '.ss.'], pal); } }),

  gatehill_pearl: T({ name: 'Gatehill Pearl', tier: 'rare', lobe: 'hang',
    why: 'rare · one fat pearl under each lobe on a gold post, old money moved downtown · under a covering hat: hidden',
    place: (H, ctx) => onBare(H, ctx, LOBE),
    paint(P, sides) { const W = 0xF6F1E7, H = 0xFFFFFF, S = 0xDCCFC6;
      // (the gold post: the piercing on the lobe's outer face · the pearl: fine voxels right under the lobe voxel, centred on it)
      for (const s of sides) { pierce(P, s, GOLD, GOLD); const hx = 2 * LX, hy = 2 * LY - 2, hz = 2 * LZ;
        halves(P, s, [[hx, hy + 1, hz, W, 1], [hx, hy + 1, hz + 1, H, 1], [hx + 1, hy + 1, hz, W, 1], [hx + 1, hy + 1, hz + 1, H, 1], [hx, hy, hz, S, 1], [hx, hy, hz + 1, W, 1], [hx + 1, hy, hz, S, 1], [hx + 1, hy, hz + 1, W, 1]]); } } }),

  neon_studs: T({ name: 'Neon Row Studs', tier: 'rare', lobe: 'stud',
    why: 'rare · three lit pink studs climbing each ear, they glow on the strip after dark · under a covering hat: hidden',
    place: (H, ctx) => onBare(H, ctx, [[-10, 23, 0], [-10, 25, -1], [-10, 27, 0]]),
    paint(P, sides) { const N = 0xFF2E9A;
      for (const s of sides) halves(P, s, [[-21, 46, 0, N, 3], [-21, 47, 0, N, 3], [-21, 46, 1, N, 3], [-21, 47, 1, N, 3],
        [-21, 50, -2, N, 3], [-21, 51, -2, N, 3], [-21, 50, -1, N, 3], [-21, 51, -1, N, 3], [-21, 54, 0, N, 3]]); } }),

  chain_cuff: T({ name: 'Chain Cuff', tier: 'rare', lobe: 'stud',
    why: 'rare · a white-gold cuff on the rim, a link chain swung round the back of the ear and under it into a lobe stud · under a covering hat: hidden',
    // the cuff on the rim, the stud flush on the lobe's outer face; the chain hugs the ear's back edge and runs under the lobe row in the
    // ear's outer column, into the lobe voxel from below (it used to hang 1 out, beside the jaw)
    place(H, ctx) { const W = SILVER, path = [[-11, 27, -1], [-11, 27, -2], [LX, 27, -2], [LX, 26, -2], [LX, 25, -2], [LX, 24, -2], [LX, 23, -2], [LX, LY - 1, -2], [LX, LY - 1, -1], [LX, LY - 1, LZ], [LX - 1, LY, LZ]];
      return each(H, ctx, path.map(([x, y, z]) => [x, y, z, W, 1]), { need: [[-10, 27, -1], [LX, LY, LZ], [-10, 23, -1]], hang: true }); },
    paint(P, sides) { const pal = { h: SILVER_HI, l: SILVER_LO, k: 0x5E6670 }, link = ['.hh.', 'h..l', 'h..l', '.ll.'], linkA = ['....', 'hhhl', 'lllk', '....'];
      for (const s of sides) { for (const y of [22, 23, 24, 25, 26]) { four(P, s, 'out', LX, y, -2, y % 2 ? link : linkA, pal); four(P, s, 'back', LX, y, -2, y % 2 ? link : linkA, pal); }
        four(P, s, 'out', -11, 27, -2, link, pal); for (const x of [-11, LX]) four(P, s, 'back', x, 27, -2, linkA, pal);   // (the cuff's link off the rim, round the corner)
        for (const z of [-1, 0]) four(P, s, 'out', LX, LY - 1, z, z % 2 ? link : linkA, pal);
        four(P, s, 'out', -11, 27, -1, ['hhhh', 'hlll', 'hlll', 'llll'], pal); four(P, s, 'out', -11, 23, 0, ['.hh.', 'hHHl', 'hHHl', '.ll.'], { ...pal, H: ICE_W }); } } }),

  // ━━ EPIC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  stash_lock: T({ name: 'Stash Lock', tier: 'epic', lobe: 'hang',
    why: "epic · a brass padlock shackled through each lobe: what's mine stays locked · under a covering hat: hidden",
    // the shackle's arch right under the lobe voxel (its top passes into the lobe: the painted piercing), the lock hanging straight down
    // from it in the ear's outer column; the same 3 × 4 lock as before, moved off the ear's face to under the lobe
    place(H, ctx) { const B = 0xD9A030, St = 0xB9C1CA, sh = [[LX, LY - 1, LZ - 1], [LX, LY - 1, LZ], [LX, LY - 1, LZ + 1], [LX, LY - 2, LZ - 1], [LX, LY - 2, LZ + 1]], cells = sh.map(([x, y, z]) => [x, y, z, St, 1]);
      for (let y = LY - 4; y <= LY - 3; y++) for (let z = -1; z <= 1; z++) cells.push([LX, y, LZ + z, B, 1]);
      return each(H, ctx, cells, { need: [-1, 0, 1].flatMap(z => [[-10, 23, z], [-10, 24, z]]), hang: true }); },
    paint(P, sides) { const pal = { H: 0xF5CE6A, S: 0x9C6E18, K: INK, h: 0xEEF2F6, l: 0x7E8893 };
      for (const s of sides) { pierce(P, s, 0xEEF2F6, 0x7E8893); area(P, s, 'out', LX, LZ - 1, LY - 3, ['HHHHHHHHHHHH', '............', '.....KK.....', '....KKKK....', '.....KK.....', '....KKKK....', '............', 'SSSSSSSSSSSS'], pal);
        area(P, s, 'out', LX, LZ - 1, LY - 1, ['hhhhhhhhhhhh', '...........l', '...........l', 'llllllllllll', 'h..l....h..l', 'h..l....h..l', 'h..l....h..l', 'h..l....h..l'], pal, { on: keys([[LX, LY - 1, LZ - 1], [LX, LY - 1, LZ], [LX, LY - 1, LZ + 1], [LX, LY - 2, LZ - 1], [LX, LY - 2, LZ + 1]]) });
        area(P, s, 'front', LZ + 1, LX, LY - 3, ['HHHH', '....', '....', '....', '....', '....', '....', 'SSSS'], pal); } } }),

  big_rocks: T({ name: 'Big Rocks', tier: 'epic', lobe: 'stud',
    why: 'epic · two-carat cross-cut ice, one rock per ear, read from across the avenue · under a covering hat: hidden',
    place: (H, ctx) => each(H, ctx, [[-11, 23, 0], [-11, 24, 0], [-11, 25, 0], [-11, 24, -1], [-11, 24, 1]].map(([x, y, z]) => [x, y, z, ICE, 1]),
      { need: [[-10, 23, 0], [-10, 24, 0], [-10, 25, 0], [-10, 24, -1], [-10, 24, 1]] }),
    paint(P, sides) { const on = keys([[-11, 23, 0], [-11, 24, 0], [-11, 25, 0], [-11, 24, -1], [-11, 24, 1]]);
      const facet = (ch, col, row) => { const dx = col - 5.5, dy = row - 5.5, r = Math.abs(dx) + Math.abs(dy);   // (a table, one cut line, a lit corner)
        if (r <= 2) return ICE_W; if (r <= 3) return ICE; if (r <= 4) return ICE_B; if (dx < 0 && dy < 0 && Math.abs(dx - dy) < 1) return ICE_W; return r >= 9 ? ICE_B : null; };
      const rows = Array.from({ length: 12 }, () => 'x'.repeat(12));
      for (const s of sides) { area(P, s, 'out', -11, -1, 25, rows, facet, { on });
        for (const [y, z] of [[23, 0], [25, 0], [24, 1]]) four(P, s, 'front', -11, y, z, ['W...', '....', '....', '..BB'], { W: ICE_W, B: ICE_B }); } } }),

  block_cans: T({ name: 'Block Cans', tier: 'epic', overHat: true,
    why: 'epic · cherry-red over-ear cans with an equaliser badge; the band rides over any hat or hair · under a covering hat: over it',
    place(H) { const RED = 0xD3262E, PAD = 0x1B1B1F, cup = [], shell = [];
      for (let y = 21; y <= 28; y++) for (let z = -2; z <= 2; z++) if (!((y === 21 || y === 28) && Math.abs(z) === 2)) cup.push([0, y, z]);
      for (let y = 22; y <= 27; y++) for (let z = -2; z <= 2; z++) if (Math.abs(z) < 2 || (y >= 23 && y <= 26)) shell.push([0, y, z]);
      const at = {};
      for (const s of BOTH) { const m = surface(H, s, cup) ?? -8;
        if (put(H, s, [...shift(cup.map(([, y, z]) => [0, y, z, PAD, 0]), m - 1), ...shift(shell.map(([, y, z]) => [0, y, z, RED, 1]), m - 2)], { free: true })) at[s] = m; }
      if (at[-1] === undefined || at[1] === undefined) return at;
      // the band: one voxel over the top of whatever is on the head, from cup to cup, in the slab z −1..0 (a 6-connected staircase)
      const x0 = X(-1, at[-1] - 2), x1 = X(1, at[1] - 2), b = {};
      for (let x = x0; x <= x1; x++) { let top = null; for (let y = 60; y >= 21 && top === null; y--) if (H.has(x, y, -1) || H.has(x, y, 0)) top = y; b[x] = Math.max(29, (top ?? 28) + 1); }
      const band = new Set(), add = (x, y) => band.add(x + ',' + y);
      for (let x = x0; x <= x1; x++) { add(x, b[x]); if (x < x1) { const lo = b[x] < b[x + 1] ? x : x + 1; for (let y = Math.min(b[x], b[x + 1]) + 1; y <= Math.max(b[x], b[x + 1]); y++) add(lo, y); } }
      for (const k of band) { const [x, y] = k.split(',').map(Number); for (const z of [-1, 0]) if (!H.has(x, y, z)) H.set(x, y, z, PAD, 0); }
      return at; },
    paint(P, at) { const rows = ['............', '............', '.........W..', '.........W..', '......W..W..', '......W..W..', '...W..W..W..', '...W..W..W..', '...W..W..W..', 'W..W..W..W..', 'W..W..W..W..', 'W..W..W..W..', 'W..W..W..W..', '............', 'kkkkkkkkkkkk', '............'];
      for (const s of BOTH) if (at[s] !== undefined) area(P, s, 'out', at[s] - 2, -1, 26, rows, { W: 0xFFFFFF, k: 0x9E1A20 }); } }),

  // ━━ GRAIL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ear_grill: T({ name: 'Ear Grill', tier: 'grail',
    why: 'grail · both ears cased in solid gold with an iced rim, a grill for the ear · under a covering hat: hidden',
    place(H, ctx) { const cells = [];
      for (const [x, y, z] of EAR) if (!(x === -9 && y === 25 && z === 0)) cells.push([x, y, z, x === -10 && z === 1 && y >= 24 && y <= 26 ? GOLD_LO : GOLD, 1]);   // (the hidden core stays the ear)
      for (let y = 23; y <= 27; y++) for (let z = -1; z <= 1; z++) if (!((y === 23 || y === 27) && z !== 0)) cells.push([-11, y, z, GOLD, 1]);
      return each(H, ctx, cells, { need: [[-9, 25, 0]] }); },
    paint(P, sides) { const plate = [];
      for (let y = 23; y <= 27; y++) for (let z = -1; z <= 1; z++) if (!((y === 23 || y === 27) && z !== 0)) plate.push([-11, y, z]);
      const on = keys(plate), F = keys(plate.map(([, y, z]) => [0, y, z]));
      const pv = (ch, col, row) => { const z = -1 + Math.floor(col / 4), y = 27 - Math.floor(row / 4), inn = (dz, dy) => F.has('0,' + (y + dy) + ',' + (z + dz));
        const ci = col % 4, rj = row % 4, edge = (!inn(0, 1) && rj === 0) || (!inn(-1, 0) && ci === 0) || (!inn(1, 0) && ci === 3) || (!inn(0, -1) && rj === 3);
        if (edge) return (col + row) % 2 ? ICE_W : ICE_B; const e2 = (!inn(0, 1) && rj === 1) || (!inn(-1, 0) && ci === 1) || (!inn(1, 0) && ci === 2) || (!inn(0, -1) && rj === 2);
        return e2 ? GOLD_DK : (col === 5 || col === 6) && row > 3 && row < 17 ? GOLD_HI : null; };
      const rows = Array.from({ length: 20 }, () => 'x'.repeat(12));
      for (const s of sides) { area(P, s, 'out', -11, -1, 27, rows, pv, { on });
        area(P, s, 'front', 1, -10, 27, ['WBWBWBWB', 'dddddddd', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', 'dddddddd', 'BWBWBWBW'], { W: ICE_W, B: ICE_B, d: GOLD_DK }); } } }),
};
