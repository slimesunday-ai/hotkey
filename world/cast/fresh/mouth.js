// FRESH REGISTRY · mouth + face ink (slot 'mouth' and 'mark'). This file has exactly one owner: the mouth + face ink designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Mouth and face ink. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Every entry here says which slot it fills: `slot: 'mouth'` (the 6×3 mouth grid) or `slot: 'mark'` (face ink on the head).
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// Batch 2026-10-01 · "hypebeast / dazed / streetwear / crime / nyc". Every entry carries `tier` (common · rare · epic · grail) and leads
// its `why` with it, so the studio shows the tier under the name.
// House rules in this file:
//   · gold and steel are gloss (l 1), not metal: in the city shader metal has nothing to reflect and goes dark brown
//   · mouth pieces stay at z ≤ 8 (one proud of the face plane); no stock 'L' lip (its middle row stands at z 9)
//   · face ink only recolours head voxels (zero relief) and never touches a face-grid cell (eye grids x −7..−3 / 2..6 at y 23..26,
//     the nose at x −1..0 y 22, the mouth grid x −3..2 at y 19..21): the face grid would lose those cells to the ink
//   · ink that must read on every skin is the skin's own `ink`; coloured pieces (gold, flames, bruise, scar) are saturated mid-tones
//     that hold on pale and on deep skin alike
import { lerpHex } from './kit.js';

// ── shared bits
const INK = ctx => ctx.sk.ink;
const SKIN = (ctx, x, y, z) => ctx.sk.c(x, y, z);
// a 4 × 4 stamp on one +z voxel face of the face grid: rows top → bottom as seen from the front, columns left → right (+x)
const stamp = (P, x, y, z, rows, pal) => rows.forEach((r, k) => { for (let i = 0; i < 4; i++) { const c = pal[r[i]]; if (c !== undefined && c !== null) P.at(x, y, z, '+z', i, 3 - k, c); } });
// tooth seams: a vertical texel line on the right edge of each tooth but the last, and (optionally) a bite line
function seams(P, x0, x1, y, z, c, { bite = -1, skipMid = false } = {}) {
  for (let x = x0; x < x1; x++) { if (skipMid && x === -1) continue; for (let j = 0; j < 4; j++) P.at(x, y, z, '+z', 3, j, c); }
  if (bite >= 0) for (let x = x0; x <= x1; x++) for (let i = 0; i < 4; i++) P.at(x, y, z, '+z', i, bite, c); }

// ── face ink as decals: a texel function over regions of the head's surface. A voxel the decal covers in ONE colour is recoloured whole
// (it reads at every distance, and costs no fine-paint budget); a voxel it only partly covers carries fine paint over the skin.
// region: { face: '+z' | '-x' | '+x', a0, a1 (x on +z, z on ±x), b0, b1 (y), fn(qa, qb) → colour | [colour, layer] | null }
const VOX = { '+z': (a, b) => [a, b, 7], '-x': (a, b) => [-8, b, a], '+x': (a, b) => [7, b, a] };
const faceGridCell = (x, y) => (y >= 23 && y <= 26 && ((x >= -7 && x <= -3) || (x >= 2 && x <= 6))) || (y >= 19 && y <= 21 && x >= -3 && x <= 2) || (y === 22 && (x === -1 || x === 0));
// cells where eye designs put their own fx (under-eye bags and stones, wing tips, scars): ink may paint there (paint yields to the
// face grid) but never recolours the whole voxel (a recolour would win over the eye's voxel)
const softCell = (x, y) => y === 22 || ((x === -8 || x === 7) && y >= 23 && y <= 28) || (y === 21 && x >= 3 && x <= 6) || (y >= 30 && y <= 31 && x >= 2 && x <= 6);
function decalCells(regions) {
  const out = [];
  for (const R of regions) for (let a = R.a0; a <= R.a1; a++) for (let b = R.b0; b <= R.b1; b++) {
    const [x, y, z] = VOX[R.face](a, b); if (R.face === '+z' && faceGridCell(x, y)) continue;
    const t = new Array(16).fill(null), m = new Array(16).fill(0); let any = false;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { let v = R.fn(4 * a + i, 4 * b + j); if (v === undefined || v === null) continue;
      if (Array.isArray(v)) { m[j * 4 + i] = v[1]; v = v[0]; } t[j * 4 + i] = v; any = true; }
    if (any) out.push({ face: R.face, x, y, z, t, m, soft: R.face === '+z' && softCell(x, y) }); }
  return out; }
const whole = c => !c.soft && c.t[0] !== null && c.t.every((v, k) => v === c.t[0] && c.m[k] === c.m[0]);
const decal = regions => ({
  draw(H, ctx) { for (const c of decalCells(regions(ctx))) if (whole(c)) H.set(c.x, c.y, c.z, c.t[0], c.m[0]); },
  fine(P, ctx) { for (const c of decalCells(regions(ctx))) if (!whole(c)) c.t.forEach((v, k) => { if (v !== null) P.at(c.x, c.y, c.z, c.face, k & 3, k >> 2, v); }); },
});
// a bitmap decal on +z: rows top → bottom from qb `top`, columns from qa `left` (+x to the right as seen from the front)
const bitmapFn = (rows, pal, left, top) => (qa, qb) => { const r = rows[top - qb], ch = r && r[qa - left]; return ch === undefined ? null : (pal[ch] ?? null); };
const anyOf = (...fns) => (qa, qb) => { for (const f of fns) { const v = f(qa, qb); if (v !== null && v !== undefined) return v; } return null; };
const mirrorQ = f => (qa, qb) => f(-1 - qa, qb);   // the character's other side (x → −1 − x, texel for texel)
// the 3 × 5 caps used for face lettering
const FONT = { S: ['XXX', 'X..', 'XXX', '..X', 'XXX'], O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], L: ['X..', 'X..', 'X..', 'X..', 'XXX'], D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'] };
const word = w => [0, 1, 2, 3, 4].map(r => [...w].map(ch => FONT[ch][r]).join('.'));

export default {
  // ═══════════════════════════ MOUTHS ═══════════════════════════
  smirk: { slot: 'mouth', tier: 'common', name: 'Smirk', why: 'common · one corner up: knows something you don\'t',
    rows: ['.....K', '.KKKK.', '......'] },

  screw_face: { slot: 'mouth', tier: 'common', name: 'Screw Face', why: 'common · corners down, the corner-boy scowl',
    rows: ['......', '.KKKK.', 'K....K'] },

  clenched: { slot: 'mouth', tier: 'common', name: 'Clenched', why: 'common · teeth gritted behind a tight frame',
    rows: ['.KKKK.', 'KWWWWK', '.KKKK.'],
    fine(P, ctx) { seams(P, -2, 1, 20, 7, ctx.sk.mouth, { bite: 1 }); } },

  gap_grin: { slot: 'mouth', tier: 'common', name: 'Gap Grin', why: 'common · the wide one, front-tooth gap and all',
    rows: ['K....K', 'KWWWWK', '.KKKK.'],
    fine(P, ctx) { const m = ctx.sk.mouth; for (let j = 0; j < 4; j++) { P.at(-1, 20, 7, '+z', 3, j, m); P.at(0, 20, 7, '+z', 0, j, m); }
      for (const x of [-2, 0]) for (let j = 1; j < 4; j++) P.at(x, 20, 7, '+z', 3, j, 0xd9d3c6); } },

  tongue_out: { slot: 'mouth', tier: 'common', name: 'Tongue Out', why: 'common · the cover-shoot face',
    rows: ['.KKKK.', '.KTTK.', '..TT..'], palette: { T: [0xe35d78, 1, 8] },
    fine(P) { for (const y of [20, 19]) for (let j = y === 20 ? 0 : 1; j < 4; j++) { P.at(-1, y, 8, '+z', 3, j, 0xbf3f5c); P.at(0, y, 8, '+z', 0, j, 0xbf3f5c); }
      P.at(-1, 19, 8, '+z', 0, 0, 0xc84a66); P.at(0, 19, 8, '+z', 3, 0, 0xc84a66); } },

  pencil_stache: { slot: 'mouth', tier: 'rare', name: "Pencil 'Stache", why: 'rare · a hustler\'s line over a flat, unbothered mouth',
    rows: ['......', '.KKKK.', '......'],
    fx(F, ctx) { for (let x = -3; x <= 2; x++) F.set(x, 21, 7, SKIN(ctx, x, 21, 7), ctx.sk.layer); },
    fine(P, ctx) { const c = ctx.sk.brow ?? ctx.sk.ink;   // the line sits right on the lip, parted at the middle, tapered at the ends
      P.rect('+z', -11, 85, -1, 86, c); P.rect('+z', 1, 85, 11, 86, c); P.rect('+z', -9, 84, -1, 85, c); P.rect('+z', 1, 84, 9, 85, c);
      P.paint('+z', -12, 86, c); P.paint('+z', 11, 86, c); } },

  busted_lip: { slot: 'mouth', tier: 'rare', name: 'Busted Lip', why: 'rare · swollen and split: the payback hasn\'t happened yet',
    rows: ['......', '.KKKKK', '...SS.'], palette: { S: [0xb33a4e, 1, 8] },
    fine(P) { for (let j = 0; j < 4; j++) P.at(0, 19, 8, '+z', 1, j, 0x5e1222); P.at(0, 19, 8, '+z', 2, 2, 0x5e1222);
      P.at(1, 19, 8, '+z', 1, 2, 0xd9707e); P.at(1, 19, 8, '+z', 2, 2, 0xd9707e); P.at(0, 19, 8, '+z', 0, 3, 0x8a2338); } },

  snake_bites: { slot: 'mouth', tier: 'rare', name: 'Snake Bites', why: 'rare · two steel hoops through the lower lip',
    rows: ['......', '.KKKK.', '......'],
    // (a hoop is a slim 1 × 2 bar of steel halves through each lip corner: the audit measures any run of fine voxels as relief, so 2 is the cap)
    fine(P) { for (const hx of [-4, 3]) { P.half(hx, 39, 16, 0xa9b4bf, 1); P.half(hx, 38, 16, 0xa9b4bf, 1); } } },

  gold_tooth: { slot: 'mouth', tier: 'rare', name: 'Gold Tooth', why: 'rare · one cap, the first thing they bought',
    rows: ['.....K', '.KWGWK', '..KKK.'], palette: { G: [0xf6bd35, 1, 7] },
    fine(P) { P.at(-1, 20, 7, '+z', 3, 1, 0xd9d3c6); P.at(-1, 20, 7, '+z', 3, 2, 0xd9d3c6); P.at(-1, 20, 7, '+z', 3, 3, 0xd9d3c6);
      P.at(1, 20, 7, '+z', 0, 1, 0xd9d3c6); P.at(1, 20, 7, '+z', 0, 2, 0xd9d3c6); P.at(1, 20, 7, '+z', 0, 3, 0xd9d3c6);
      stamp(P, 0, 20, 7, ['hh..', 'h...', '...d', '..dd'], { h: 0xfff0b8, d: 0xb07d14 }); } },

  gold_grill: { slot: 'mouth', tier: 'epic', name: 'Gold Grill', why: 'epic · top and bottom, solid gold, every tooth cut',
    rows: ['KGGGGK', 'KGGGGK', '.KKKK.'], palette: { G: [0xf4b82c, 1, 7] },
    fine(P) { seams(P, -2, 1, 21, 7, 0x8f5f0c); seams(P, -2, 1, 20, 7, 0x8f5f0c);
      for (let x = -2; x <= 1; x++) { P.at(x, 21, 7, '+z', 0, 0, 0x3a2410); P.at(x, 21, 7, '+z', 1, 0, 0x3a2410); P.at(x, 21, 7, '+z', 2, 0, 0x3a2410);
        P.at(x, 21, 7, '+z', 0, 3, 0xffe58f); P.at(x, 20, 7, '+z', 0, 3, 0xffe58f); } } },

  heist_rag: { slot: 'mouth', tier: 'epic', name: 'Heist Rag', why: 'epic · bandana up over the nose: the stick-up look',
    rows: ['......', '......', '......'],
    fx(F) { const C = 0x1d1d23;
      for (let y = 19; y <= 22; y++) { for (let x = -9; x <= 8; x++) { F.set(x, y, 8, C); F.set(x, y, -8, C); } for (let z = -7; z <= 7; z++) { F.set(-9, y, z, C); F.set(8, y, z, C); } }
      for (let x = -3; x <= 2; x++) F.set(x, 18, 8, C); F.set(-1, 17, 8, C); F.set(0, 17, 8, C); },
    fine(P) { const W = 0xece4d0;   // a bone border under the top edge and down the tip, and a scatter of invented paisley drops
      for (let x = -8; x <= 7; x++) P.at(x, 22, 8, '+z', 0, 2, W), P.at(x, 22, 8, '+z', 1, 2, W), P.at(x, 22, 8, '+z', 2, 2, W), P.at(x, 22, 8, '+z', 3, 2, W);
      const paisL = ['..W.', '.W.W', 'W..W', '.WW.'], paisR = ['.W..', 'W.W.', 'W..W', '.WW.'];
      for (const [x, y, r] of [[-7, 20, 0], [-4, 21, 1], [-1, 19, 0], [2, 21, 1], [5, 20, 0], [-6, 19, 1], [3, 19, 1], [6, 21, 1], [-8, 21, 0]]) stamp(P, x, y, 8, r ? paisR : paisL, { W });
      stamp(P, -3, 18, 8, ['W...', '.W..', '..W.', '...W'], { W }); stamp(P, 2, 18, 8, ['...W', '..W.', '.W..', 'W...'], { W });
      stamp(P, -2, 18, 8, ['....', '....', '....', 'W...'], { W }); stamp(P, 1, 18, 8, ['....', '....', '....', '...W'], { W });
      stamp(P, -1, 17, 8, ['.W..', '..W.', '...W', '....'], { W }); stamp(P, 0, 17, 8, ['..W.', '.W..', 'W...', '....'], { W }); } },

  ice_grill: { slot: 'mouth', tier: 'grail', name: 'Iced-Out Grill', why: 'grail · a full set of stones with the fangs flooded too',
    rows: ['KIIIIK', 'KIIIIK', '.IKKI.'], palette: { I: [0xeef9ff, 1, 7] },
    fine(P, ctx) { const pal = { w: 0xffffff, c: 0x7fdcff, b: 0xa9b8ff, p: 0xc4ccd6 }, A = ['wwcw', 'wcww', 'cwwb', 'wwbw'], B = ['wcww', 'cwwc', 'wwcw', 'bwww'];
      for (const y of [21, 20]) for (let x = -2; x <= 1; x++) stamp(P, x, y, 7, (x + y) & 1 ? A : B, pal);
      seams(P, -2, 1, 21, 7, pal.p); seams(P, -2, 1, 20, 7, pal.p);
      for (let x = -2; x <= 1; x++) for (let i = 0; i < 4; i++) P.at(x, 21, 7, '+z', i, 0, 0x2c3440);
      for (const x of [-2, 1]) { stamp(P, x, 19, 7, ['wcww', 'wwcw', 'cwwc', 'wwww'], pal); const s = ctx.sk.c(x, 19, 7), o = x < 0 ? 0 : 3, n = x < 0 ? 1 : 2;
        P.at(x, 19, 7, '+z', o, 0, s); P.at(x, 19, 7, '+z', o, 1, s); P.at(x, 19, 7, '+z', 3 - o, 0, s); P.at(x, 19, 7, '+z', n, 0, pal.c); } } },

  // ═══════════════════════════ FACE INK ═══════════════════════════
  freckles: { slot: 'mark', tier: 'common', name: 'Freckles', why: 'common · sun on the stoop, every summer',
    ...decal(ctx => { const dots = [[-27, 89], [-23, 90], [-20, 88], [-25, 86], [-18, 85], [-29, 84], [-22, 83], [-15, 88], [-12, 90], [-10, 87], [-6, 93], [-3, 96], [-7, 98], [-16, 91]];
      const set = new Set(); for (const [a, b] of dots) { set.add(a + ',' + b); set.add((-1 - a) + ',' + (b + ((a & 1) ? 1 : 0))); }
      return [{ face: '+z', a0: -8, a1: 7, b0: 20, b1: 24, fn: (qa, qb) => set.has(qa + ',' + qb) ? lerpHex(SKIN(ctx, qa >> 2, qb >> 2, 7), INK(ctx), .52) : null }]; }) },

  crossed_plasters: { slot: 'mark', tier: 'common', name: 'Crossed Plasters', why: 'common · two strips in an X: lost one, walked it off',
    ...decal(() => { const qa0 = -28, qb0 = 76, T = 0xf6f2ea, PAD = 0xcfae82, DOT = 0xcfc2a8, EDGE = 0xc9b48e;
      return [{ face: '+z', a0: -7, a1: -4, b0: 19, b1: 22, fn: (qa, qb) => { const u = qa - qa0 + .5, v = qb - qb0 + .5, d1 = Math.abs(u - v), d2 = Math.abs(u + v - 16);
        if (d1 > 2.6 && d2 > 2.6) return null; if (Math.abs(u - 8) < 2.2 && Math.abs(v - 8) < 2.2) return PAD;
        const d = Math.min(d1 <= 2.6 ? d1 : 9, d2 <= 2.6 ? d2 : 9); if (d > 1.85) return EDGE;   // the crimped edge keeps the strip legible on pale skin
        return (d1 <= 2.6 && Math.abs(d1 - .9) < .5 && ((qa + qb) & 3) === 0) || (d2 <= 2.6 && Math.abs(d2 - .9) < .5 && ((qa - qb) & 3) === 0) ? DOT : T; } }]; }) },

  cash_sign: { slot: 'mark', tier: 'common', name: 'Cash Sign', why: 'common · the whole plan, under one eye',
    ...decal(ctx => [{ face: '+z', a0: -6, a1: -5, b0: 20, b1: 21, fn: bitmapFn(['..X..', '.XXXX', 'X.X..', '.XXX.', '..X.X', 'XXXX.', '..X..'], { X: INK(ctx) }, -23, 87) }]) },

  kiss_print: { slot: 'mark', tier: 'common', name: 'Kiss Print', why: 'common · somebody\'s lipstick, straight off the Neon Row line',
    ...decal(() => [{ face: '+z', a0: 3, a1: 6, b0: 19, b1: 21, fn: bitmapFn(['..XX.XX..', '.XXXXXXX.', 'XXXXXXXXX', 'XX.....XX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..'],
      { X: 0xd81f4a }, 14, 83) }]) },

  teardrop: { slot: 'mark', tier: 'rare', name: 'Teardrop', why: 'rare · one drop under the eye: did time on Iron Island',
    ...decal(ctx => [{ face: '+z', a0: -7, a1: -7, b0: 21, b1: 22, fn: bitmapFn(['.XX.', '.XX.', 'XXXX', 'XXXX', 'XXXX', '.XX.'], { X: INK(ctx) }, -28, 91) }]) },


  stitches: { slot: 'mark', tier: 'rare', name: 'Stitches', why: 'rare · a cheek scar laced shut at St. Mercy',
    ...decal(ctx => { const A = [-30.5, 90.5], B = [-13.5, 77.5], L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
      const fn = (qa, qb) => { const px = qa + .5 - A[0], py = qb + .5 - A[1], t = px * ux + py * uy, n = -px * uy + py * ux; if (t < -.5 || t > L + .5) return null;
        const s = SKIN(ctx, qa >> 2, qb >> 2, 7), k = Math.round((t - 2) / 3.6), tt = t - 2 - k * 3.6;
        if (k >= 0 && t < L - 1 && Math.abs(tt) < .55 && Math.abs(n) < 2.3) return INK(ctx);
        return Math.abs(n) < .95 ? lerpHex(s, 0xf0a4a8, .58) : null; };
      return [{ face: '+z', a0: -8, a1: -4, b0: 19, b1: 22, fn }]; }) },

  barcode: { slot: 'mark', tier: 'rare', name: 'Barcode', why: 'rare · on the jaw, below the ear: property of nobody',
    ...decal(ctx => { const bars = '10100110111010011010', ink = INK(ctx);   // read from outside the −x face: +z runs to the right
      return [{ face: '-x', a0: 2, a1: 6, b0: 19, b1: 21, fn: (qa, qb) => { const i = qa - 8; if (i < 0 || i >= 20 || bars[i] !== '1') return null;
        const guard = i < 3 || i > 16; return qb <= 87 && qb >= (guard ? 77 : 79) ? ink : null; } }]; }) },

  spiderweb: { slot: 'mark', tier: 'epic', name: 'Spiderweb', why: 'epic · a web spun round the jaw corner: the yard knows',
    ...decal(ctx => { const ink = INK(ctx), hub = [0, 78.5], R = 15.5, spokes = [0, 30, 60, 90, 120, 150, 180].map(d => d * Math.PI / 180), rings = [5, 10, 15];
      const web = s => (qb) => { const dx = s, dy = qb + .5 - hub[1], r = Math.hypot(dx, dy); if (r > R) return null; if (r < 1.3) return ink;
        const th = Math.atan2(dy, dx); for (const a of spokes) if (Math.abs(r * Math.sin(th - a)) < .55 && Math.cos(th - a) > 0) return ink;
        let k = 0; while (k < spokes.length - 1 && !(th >= spokes[k] && th <= spokes[k + 1])) k++; const mid = (spokes[k] + spokes[Math.min(k + 1, spokes.length - 1)]) / 2;
        if (th < 0) return null; const d = r * Math.cos(th - mid); for (const q of rings) if (Math.abs(d - q * Math.cos(Math.PI / 12)) < .55) return ink; return null; };
      return [{ face: '+z', a0: -8, a1: -5, b0: 19, b1: 23, fn: (qa, qb) => web(qa + 32 + .5)(qb) },
        { face: '-x', a0: 4, a1: 7, b0: 19, b1: 23, fn: (qa, qb) => web(qa - 32 + .5)(qb) }]; }) },

  sold_out: { slot: 'mark', tier: 'epic', name: 'Sold Out', why: 'epic · lettered under both eyes, drop-day gospel',
    ...decal(ctx => { const pal = { X: INK(ctx) };
      return [{ face: '+z', a0: -8, a1: -4, b0: 20, b1: 21, fn: bitmapFn(word('SOLD'), pal, -31, 87) }, { face: '+z', a0: 3, a1: 7, b0: 20, b1: 21, fn: bitmapFn(word('OUT'), pal, 18, 87) }]; }) },

  gold_leaf: { slot: 'mark', tier: 'epic', name: '24K Leaf', why: 'epic · beaten gold laid on the cheekbones and the bridge',
    ...decal(() => { const G = 0xf2c64a, HI = 0xfff0a8, LO = 0xc99a22;
      const n01 = (qa, qb, sd) => ((Math.imul(qa * 73 + sd, 0x9e3779b1) ^ Math.imul(qb * 37 + sd * 7, 0x85ebca6b)) >>> 0) % 1000 / 1000;
      // a torn flake: an ellipse whose edge wanders with the angle, a few hairline cracks showing the skin
      const flake = (cx, cy, rx, ry, tilt, sd) => (qa, qb) => { const px = qa + .5 - cx, py = qb + .5 - cy, u = (px * Math.cos(tilt) + py * Math.sin(tilt)) / rx, v = (-px * Math.sin(tilt) + py * Math.cos(tilt)) / ry;
        const th = Math.atan2(v, u), edge = 1 + .22 * Math.sin(3 * th + sd) + .14 * Math.sin(7 * th + 2 * sd) + .18 * (n01(qa, qb, sd) - .5), d = Math.hypot(u, v) / edge;
        if (d > 1) return null; const n = n01(qa, qb, sd + 3); if (d > .45 && n < .08) return null; return d < .5 ? [G, 1] : n < .2 ? HI : n > .85 ? LO : G; };
      return [{ face: '+z', a0: -8, a1: -4, b0: 20, b1: 22, fn: flake(-24, 86, 7.8, 3.4, -.22, 11) }, { face: '+z', a0: 3, a1: 7, b0: 20, b1: 22, fn: flake(22.5, 85.5, 6.6, 3, .3, 29) },
        { face: '+z', a0: -2, a1: 1, b0: 23, b1: 26, fn: flake(1.5, 97.5, 2.8, 5.2, .15, 5) }]; }) },

  max_heat: { slot: 'mark', tier: 'grail', name: 'Max Heat', why: 'grail · hot-rod flames up both cheeks: wanted, and wants you to know',
    ...decal(() => { const RED = 0xe0301e, ORA = 0xff7a1a, YEL = 0xffcf2e;
      const tongues = [[2.5, 29], [9.5, 15], [16, 10], [-6, 9]], H = s => { let h = 3; for (const [c, p] of tongues) { const u = (s - c) / (c === 2.5 ? 3.2 : 2.9); if (Math.abs(u) < 1) h = Math.max(h, p * Math.pow(1 - u * u, .7)); } return h; };
      const flame = (s, qb) => { const t = qb - 76 + .5, se = s - .14 * t, h = H(se); if (t > h) return null; const v = t / h; return v < .42 ? YEL : v < .72 ? ORA : RED; };
      const right = [{ face: '+z', a0: -8, a1: -4, b0: 19, b1: 26, fn: (qa, qb) => (qb >= 92 && qa > -29) ? null : flame(qa + 32 + .5, qb) },
        { face: '-x', a0: 5, a1: 7, b0: 19, b1: 22, fn: (qa, qb) => flame(qa - 32 + .5, qb) }];
      const left = [{ face: '+z', a0: 3, a1: 7, b0: 19, b1: 26, fn: (qa, qb) => (qb >= 92 && qa < 28) ? null : flame(31 - qa + .5, qb) },
        { face: '+x', a0: 5, a1: 7, b0: 19, b1: 22, fn: (qa, qb) => flame(qa - 32 + .5, qb) }];
      return [...right, ...left]; }) },
};
