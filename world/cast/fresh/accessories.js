// FRESH REGISTRY · accessories (slot 'acc'). This file has exactly one owner: the accessories designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Accessories. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// WORN ONLY: no held items, no necklaces. Each entry carries `tier` (common · rare · epic · grail) and a `why` line.
// How these pieces fit (the rules the audit holds an accessory to):
//   · every voxel lies on what is there now (chestFront, or a scan of the grid), never a bare z; a cell someone else holds is left alone
//   · along EVERY axis, a run of accessory voxels that ends on something is at most 2 deep: so a band never wraps a corner onto a
//     second face (its caps stop short, no corner cells), and nothing stacks 3 high over a hand, a hem or a waistband
//   · fine voxels sit straight on a garment or the body (their depth counts every accessory voxel behind them, in every direction)
//   · each piece rides one segment: ctx.as('armL' | 'armR' | 'torso' | 'legR') or ctx.onSeg('pelvis' | 'shinL')
//   · the hands (x −8…−6 / 5…7, y 6…9, z −2…1, thumb z 2) are drawn after us: nothing goes in their box
//   · fine paint only lands on our own voxels (guard()), never on a top or a pair of pants
// 'L' / 'R' follow chars.js: L is the arm or leg at x < 0. Pieces are authored on the L side; R mirrors x → −1 − x.
import { hash3 } from './kit.js';

// ── placing voxels: own cells only (ours may be rewritten, anyone else's is left alone)
const vk = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256);
function own(B, ctx) { const mine = ctx.__mine || (ctx.__mine = new Set()); ctx.__B = B;
  return (x, y, z, c, l = 0) => { if (c === undefined || c === null) return false; const k = vk(x, y, z); if (B.has(x, y, z) && !mine.has(k)) return false; B.set(x, y, z, c, l); mine.add(k); return true; }; }
// the depth rule, enforced after a draw: along each axis a run of our voxels that ends on something (anyone else's voxel, or a hand's
// box: the hands are drawn after us) may be at most 2 deep; where it is deeper, the link touching that solid is taken out (a notch)
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const inHand = (x, y, z) => y >= 6 && y <= 9 && ((x >= -8 && x <= -6) || (x >= 5 && x <= 7)) && ((z >= -2 && z <= 1) || (z === 2 && (x === -6 || x === 5) && (y === 7 || y === 8)));
function settle(B, ctx) { const mine = ctx.__mine; if (!mine) return; const D = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
  const solid = (x, y, z) => inHand(x, y, z) || (B.has(x, y, z) && !mine.has(vk(x, y, z)));
  for (let pass = 0; pass < 6; pass++) { let cut = 0;
    for (const k of [...mine]) { if (!mine.has(k)) continue; const [x, y, z] = D(k);
      for (const [dx, dy, dz] of N6) { if (B.has(x + dx, y + dy, z + dz) || inHand(x + dx, y + dy, z + dz)) continue;   // an open face: walk back through ours
        let t = 0, a = x, b = y, c = z; while (mine.has(vk(a, b, c)) && t < 16) { t++; a -= dx; b -= dy; c -= dz; }
        if (t > 2 && solid(a, b, c)) { const ex = a + dx, ey = b + dy, ez = c + dz; B.del(ex, ey, ez); mine.delete(vk(ex, ey, ez)); cut++; break; } } }
    if (!cut) break; } }
const mx = (s, x) => s === 'L' ? x : -1 - x;          // author on L, mirror to R
const mh = (s, hx) => s === 'L' ? hx : -hx - 1;       // the same mirror for a fine voxel's half x
const OUT = s => s === 'L' ? '-x' : '+x';             // the outer side of an L / R limb, as a fine-paint face
// the chest's front / back surface at (x, y) as it stands now (the top's shell if one is worn); back scans the grid
const front = (B, ctx, x, y) => { const f = ctx.chestFront(x, y); return f ?? B.frontZ(x, y); };
function backZ(B, x, y) { for (let z = -24; z <= 24; z++) if (B.has(x, y, z)) return z; return null; }
// a strap's drape (compat pass): the chest's front / back read once, before the piece is drawn, and draped: a strap lies across the
// ridges of a quilted or padded top instead of dipping into every groove, where the ridges either side hid it in steps. Rows y ± 1
// in the chest panel (y ≤ 16), at most 2 over the surface right under it; on a flat top it is that surface (a strap crossing a
// pocket or a placket edge rises onto it one row early).
function drape(B, ctx) { const fr = new Map(), bk = new Map();
  for (let x = -6; x <= 5; x++) for (let y = 8; y <= 18; y++) { fr.set(x * 100 + y, front(B, ctx, x, y)); bk.set(x * 100 + y, backZ(B, x, y)); }
  const pick = (M, x, y, s) => { const v0 = M.get(x * 100 + y); if (v0 === undefined || v0 === null) return null; let v = v0;
    for (const dy of [-1, 1]) { if (y + dy > 16) continue; const g = M.get(x * 100 + y + dy); if (g !== undefined && g !== null && s * (g - v) > 0 && s * (g - v0) <= 2) v = g; } return v; };
  return { f: (x, y) => pick(fr, x, y, 1), b: (x, y) => pick(bk, x, y, -1) }; }
// an arm's cross-section at row y (authored L): the outermost column, and the z extent of the arm's outer columns (x ≤ −7). Only the
// cells joined to the outermost column within the row count: a padded top's body that reaches x −7 beside the sleeve is not the arm,
// and a band sized to it floated 2–3 voxels off the sleeve (final check, 2026-10-02)
function armRow(B, s, y) { let x0 = null, zlo = 99, zhi = -99;
  for (let x = -14; x <= -6; x++) for (let z = -9; z <= 9; z++) if (B.has(mx(s, x), y, z) && (x0 === null || x < x0)) x0 = x;
  if (x0 === null) return null; const seen = new Set(), q = [];
  for (let z = -9; z <= 9; z++) if (B.has(mx(s, x0), y, z)) { seen.add(x0 * 100 + z); q.push([x0, z]); }
  while (q.length) { const [x, z] = q.pop(); if (x <= -7) { zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
    for (const [a, b] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) if (a >= -14 && a <= -7 && b >= -9 && b <= 9 && !seen.has(a * 100 + b) && B.has(mx(s, a), y, b)) { seen.add(a * 100 + b); q.push([a, b]); } }
  return zlo > zhi ? null : { x0, zlo, zhi }; }
// a band round the outside of an arm at row y: the outer side plus a two-column cap on the front and the back (no corner cells)
function band(put, B, s, y, col, l) { const r = armRow(B, s, y); if (!r) return []; const cells = [];
  for (let z = r.zlo; z <= r.zhi; z++) cells.push([r.x0 - 1, z]);
  for (const x of [r.x0, r.x0 + 1]) cells.push([x, r.zhi + 1], [x, r.zlo - 1]);
  return cells.filter(([x, z]) => put(mx(s, x), y, z, col, l)).map(([x, z]) => [mx(s, x), y, z]); }
// a leg's cross-section at row y (authored L)
function legRow(B, s, y) { let x0 = null, zlo = 99, zhi = -99;
  for (let x = -10; x <= -1; x++) for (let z = -6; z <= 6; z++) if (B.has(mx(s, x), y, z)) { if (x0 === null || x < x0) x0 = x; zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
  return x0 === null ? null : { x0, zlo, zhi }; }
// a face-connected staircase from (xa, ya) to (xb, yb): [[x, y], …]
function stair(xa, ya, xb, yb) { const out = [], n = Math.abs(xb - xa), dx = Math.sign(xb - xa) || 1; let py = null;
  for (let i = 0; i <= n; i++) { const x = xa + i * dx, y = Math.round(ya + (yb - ya) * i / Math.max(1, n));
    if (py !== null && y !== py) { const st = Math.sign(y - py); for (let yy = py; yy !== y; yy += st) out.push([x, yy]); }
    out.push([x, y]); py = y; }
  const seen = new Set(); return out.filter(([x, y]) => { const k = x * 100 + y; if (seen.has(k)) return false; seen.add(k); return true; }); }

// ── fine paint, guarded: a texel is painted only where the outermost voxel along that face is one of ours
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], PL = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]], AX = [0, 0, 1, 1, 2, 2];
const FACES = ['+x', '-x', '+y', '-y', '+z', '-z'], VIEW = [[-1, -1], [1, -1], [1, 1], [1, -1], [1, -1], [-1, -1]];
function guard(P, ctx) { const B = ctx.__B, mine = ctx.__mine || new Set(), memo = new Map();
  const outer = (f, a, b) => { const ck = f * 1e6 + (a + 512) * 1024 + (b + 512); if (memo.has(ck)) return memo.get(ck);
    const [A, Bx] = PL[f], N = AX[f], s = FN[f][N], p = [0, 0, 0]; p[A] = a; p[Bx] = b; let hit = null;
    if (B) for (let n = 40 * s; n !== -40 * s - s; n -= s) { p[N] = n; if (B.has(p[0], p[1], p[2])) { hit = vk(p[0], p[1], p[2]); break; } }
    memo.set(ck, hit); return hit; };
  const G = {
    paint(face, qa, qb, c) { if (c === undefined || c === null) return; const f = FACES.indexOf(face), h = outer(f, Math.floor(qa / 4), Math.floor(qb / 4)); if (h !== null && mine.has(h)) P.paint(face, qa, qb, c); },
    rect(face, qa0, qb0, qa1, qb1, c) { for (let a = qa0; a < qa1; a++) for (let b = qb0; b < qb1; b++) G.paint(face, a, b, typeof c === 'function' ? c(a, b) : c); },
    bmp(face, rows, pal, qa, qb) { const [da, db] = VIEW[FACES.indexOf(face)]; (rows || []).forEach((r, j) => { for (let i = 0; i < r.length; i++) G.paint(face, qa + i * da, qb + j * db, pal[r[i]]); }); },
    half: (...a) => P.half(...a) };
  return G; }

// a 3 × 5 pixel font (rows top → bottom) for the lettering
const FONT = {
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], C: ['.XX', 'X..', 'X..', 'X..', '.XX'], D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'], I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  M: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'], N: ['XX.', 'X.X', 'X.X', 'X.X', 'X.X'], O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], S: ['.XX', 'X..', '.X.', '..X', 'XX.'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'], W: ['X.X', 'X.X', 'XXX', 'XXX', 'X.X'], E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'], 4: ['X.X', 'X.X', 'XXX', '..X', '..X'],
  9: ['XXX', 'X.X', 'XXX', '..X', 'XX.'], ' ': ['...', '...', '...', '...', '...'],
};
const word = s => [0, 1, 2, 3, 4].map(r => [...s].map(ch => (FONT[ch] || FONT[' '])[r]).join('.'));   // 1 texel between letters

// (gold and steel are gloss, not metal: the walker's metal layer has no environment to reflect and reads near-black in the city's light)
const GOLD = 0xf5c632, GOLD_DK = 0xa8730c, ICE = 0xeefbff, STEEL = 0xd3d9e0, INK = 0x16161a;

const ENTRIES = {
  // ─────────────── COMMON
  corner_sling: {
    name: 'Corner Sling', tier: 'common', why: 'common · black nylon chest sling, a lime "NO ID" rubber patch and zip tab',
    draw(B, ctx) { ctx.as('torso'); const put = own(B, ctx), NYL = 0x222327, WEB = 0x2f3137, D = drape(B, ctx);
      for (const [x, y] of stair(-4, 17, 4, 11)) { const f = D.f(x, y); if (f !== null) put(x, y, f + 1, WEB); const b = D.b(x, y); if (b !== null) put(x, y, b - 1, WEB); }
      let zf = -99; for (let x = -2; x <= 1; x++) for (let y = 12; y <= 14; y++) zf = Math.max(zf, front(B, ctx, x, y) ?? -99); if (zf === -99) return;
      for (let x = -2; x <= 1; x++) for (let y = 12; y <= 14; y++) { put(x, y, zf + 1, NYL); put(x, y, zf + 2, NYL); } },   // the pouch, 4 × 3, two deep, on the strap
    fine(P0, ctx) { const P = guard(P0, ctx), LIME = 0xc6ff2e;
      P.rect('+z', -8, 57, 8, 58, 0x707480); P.rect('+z', 4, 57, 7, 59, LIME);       // the zip and its tab
      P.rect('+z', -8, 49, 8, 56, LIME); P.bmp('+z', word('NOID'), { X: INK }, -7, 54); } },   // the patch: NO ID

  stoop_pack: {
    name: 'Stoop Pack', tier: 'common', why: 'common · a cobalt bookbag with a black base and a woven STOOP tag',
    draw(B, ctx) { ctx.as('torso'); const put = own(B, ctx), BODY = 0x2a4ad0, BASE = 0x18191d, STRAP = 0x1d1e22, D = drape(B, ctx);
      for (const x of [-4, 3]) for (let y = 12; y <= 17; y++) { const f = D.f(x, y); if (f !== null) put(x, y, f + 1, STRAP); }   // the straps on the chest
      const bz = new Map(); for (let x = -4; x <= 3; x++) for (let y = 11; y <= 16; y++) bz.set(x * 100 + y, D.b(x, y));
      for (let x = -4; x <= 3; x++) for (let y = 11; y <= 16; y++) { const b = bz.get(x * 100 + y); if (b !== null) put(x, y, b - 1, y === 11 ? BASE : BODY); }   // the panel
      for (let x = -3; x <= 2; x++) for (let y = 11; y <= 13; y++) { const b = bz.get(x * 100 + y); if (b !== null) put(x, y, b - 2, y === 11 ? BASE : BODY); } },   // the front pocket
    fine(P0, ctx) { const P = guard(P0, ctx), ZIP = 0x121317, TAG = 0xf3efe6;
      P.rect('-z', -16, 58, 16, 59, ZIP); P.rect('-z', -12, 55, 12, 56, ZIP);   // the zips: the panel's, the pocket's
      P.rect('-z', -10, 47, 12, 54, TAG); P.bmp('-z', word('STOOP'), { X: 0x2a4ad0 }, 10, 52); } },

  rubber_bands: {
    name: 'Count-Up Bands', tier: 'common', why: 'common · a wrist stacked with the rubber bands off counted money',
    draw(B, ctx) { ctx.as('armR'); const put = own(B, ctx); ctx.__cells = [10, 11].flatMap(y => band(put, B, 'R', y, 0xc49a5c, 1)); },
    fine(P0, ctx) { const ST = [0xc49a5c, 0xd5392b, 0xc49a5c, 0x2f62d6, 0x3e9f4b, 0xc49a5c, 0xe9c63e, 0xd5392b], P = guard(P0, ctx);
      for (const [x, y, z] of ctx.__cells || []) for (let j = 0; j < 4; j++) { const c = ST[(y - 10) * 4 + j];
        for (let i = 0; i < 4; i++) { P.paint('+x', 4 * z + i, 4 * y + j, c); P.paint('+z', 4 * x + i, 4 * y + j, c); P.paint('-z', 4 * x + i, 4 * y + j, c); } } } },

  flag_rag: {
    name: 'Back-Pocket Flag', tier: 'common', why: 'common · a purple paisley rag hanging out of the back pocket: crew colours',
    draw(B, ctx) { ctx.as('legR'); ctx.onSeg('thighR', () => { const put = own(B, ctx), RAG = 0x6c34cc, SHAPE = { 9: [1, 2, 3], 8: [1, 2, 3], 7: [1, 2, 3], 6: [2, 3], 5: [2] };
      for (const x of [1, 2, 3]) { const b = backZ(B, x, 8); if (b === null) continue;   // one flat column per x, hanging from the pocket (y 8's back); it rides the thigh
        for (const [y, xs] of Object.entries(SHAPE)) if (xs.includes(x)) put(x, +y, b - 1, RAG); } }); },
    fine(P0, ctx) { const P = guard(P0, ctx), W = 0xf4efe4, K = 0x24163a;
      P.rect('-z', 4, 20, 16, 40, (qa, qb) => { const i = ((qa % 4) + 4) % 4, j = qb % 4;   // white paisley commas, a border line, a few dark seeds
        if (qb === 34) return W; if ((i === 1 && j === 2) || (i === 2 && j === 1) || (i === 2 && j === 2 && (qa + qb) % 3 === 0)) return W; return hash3(qa, qb, 7) % 19 === 0 ? K : undefined; }); } },

  // ─────────────── RARE
  beeper: {
    name: 'Two-Way Beeper', tier: 'rare', why: 'rare · a black pager clipped to the waistband, its green screen lit',
    draw(B, ctx) { ctx.as('torso'); const put = own(B, ctx); let zf = -99; for (const x of [2, 3]) for (const y of [10, 11]) zf = Math.max(zf, front(B, ctx, x, y) ?? -99); if (zf === -99) return;
      for (const x of [2, 3]) { put(x, 11, zf + 1, 0x9dff6e, 3); put(x, 10, zf + 1, 0x18181b, 1); } },   // (rides the torso: it always reaches the chest at y 11)
    fine(P0, ctx) { const P = guard(P0, ctx), SEG = 0x1f4a14;
      P.bmp('+z', ['XXX.X.X', 'X.X.XXX', 'XXX...X'], { X: SEG }, 8, 46);               // the screen
      P.rect('+z', 9, 41, 11, 42, 0x5b5e66); P.rect('+z', 13, 41, 15, 42, 0x5b5e66); } },   // the buttons

  house_arrest: {
    name: 'House Arrest', tier: 'rare', why: 'rare · an ankle monitor worn over the hem, its light always on',
    draw(B, ctx) { ctx.onSeg('shinL', () => { const put = own(B, ctx), STRAP = 0x18181a, BOX = 0x34373d;
      const r4 = legRow(B, 'L', 4), r5 = legRow(B, 'L', 5); if (!r4) return;
      for (let z = r4.zlo; z <= r4.zhi; z++) put(r4.x0 - 1, 4, z, STRAP);   // the strap round the leg (open at the inner side)
      for (let x = r4.x0; x <= -2; x++) { put(x, 4, r4.zhi + 1, STRAP); put(x, 4, r4.zlo - 1, STRAP); }
      const xb = Math.min(r4.x0, r5 ? r5.x0 : r4.x0) - 1;   // the box on the outer side, rows 4…5, filled back to the leg
      for (const y of [4, 5]) { const r = y === 4 ? r4 : r5; if (!r) continue; for (const z of [-1, 0]) { put(xb, y, z, BOX); for (let x = xb + 1; x < r.x0; x++) put(x, y, z, BOX); } }
      ctx.__ankle = xb; }); },
    fine(P0, ctx) { const P = guard(P0, ctx), xb = ctx.__ankle; if (xb === undefined) return;
      P.rect('-x', -4, 21, 0, 23, 0x5c6068);                    // the case seam
      P.half(2 * xb - 1, 9, -1, 0x3dff6c, 3); } },            // the light (a lit fine voxel on the box's face)

  nines_belt: {
    name: 'Double-Nine Belt', tier: 'rare', why: 'rare · black leather, a gold interlocked-99 buckle from the house of Nines',
    // rides the torso: over a top it lies on the shirt's hem (chest); bare, the buckle and the back patch reach the chest at y 11
    draw(B, ctx) { ctx.as('torso'); const put = own(B, ctx), LEA = 0x141417, TAB = 0x3a2a1c;
      for (let x = -5; x <= 4; x++) { const gold = x >= -2 && x <= 1, f = front(B, ctx, x, 10), b = backZ(B, x, 10);
        if (f !== null) { put(x, 10, f + 1, gold ? GOLD : LEA, gold ? 1 : 0); if (gold) put(x, 11, f + 1, GOLD, 1); }
        if (b !== null) { put(x, 10, b - 1, LEA); if (x === -1 || x === 0) put(x, 11, b - 1, TAB); } } },   // the back: a leather patch
    fine(P0, ctx) { const P = guard(P0, ctx);
      P.bmp('+z', ['XXX.XXX', 'X.X.X.X', 'XXX.XXX', '..X...X', 'XX..XX.'], { X: GOLD_DK }, -4, 46);   // the engraved 99
      P.rect('+z', -8, 40, 8, 41, GOLD_DK); P.rect('+z', -8, 47, 8, 48, GOLD_DK);
      P.bmp('-z', ['XXX.XXX', 'X.X.X.X', 'XXX.XXX', '..X...X', 'XX..XX.'], { X: 0xc9a46a }, 3, 46); } },

  most_wanted_sash: {
    name: 'Most Wanted Sash', tier: 'rare', why: 'rare · a red satin pageant sash, gold-lettered MOST WANTED, shoulder to hip, front and back',
    draw(B, ctx) { ctx.as('torso'); const put = own(B, ctx), RED = 0xc4142f, y0 = x => 10 + Math.round((x + 5) * 6 / 9);
      const D = drape(B, ctx);
      const hi = (a, c) => a === null ? c : c === null ? a : Math.max(a, c), lo = (a, c) => a === null ? c : c === null ? a : Math.min(a, c);
      for (let x = -5; x <= 4; x++) { const ys = [y0(x), y0(x) + 1], fz = ys.map(y => D.f(x, y)), bz = ys.map(y => D.b(x, y)), F = hi(...fz), Bk = lo(...bz);   // (one depth per column: the band lies flat across the quilting)
        ys.forEach((y, i) => { if (fz[i] !== null) put(x, y, F + 1, RED, 1); if (bz[i] !== null) put(x, y, Bk - 1, RED, 1); }); } },
    fine(P0, ctx) { const P = guard(P0, ctx), y0 = x => 10 + Math.round((x + 5) * 6 / 9), T = 'MOSTWANTED';
      for (let x = -5; x <= 4; x++) { const top = 4 * y0(x) + 6;
        P.bmp('+z', FONT[T[x + 5]], { X: GOLD }, 4 * x, top);           // read from the front, left to right
        P.bmp('-z', FONT[T[4 - x]], { X: GOLD }, 4 * x + 3, top); } } },   // and from behind

  // ─────────────── EPIC
  jailbreak_cuff: {
    name: 'Jailbreak Cuff', tier: 'epic', why: 'epic · one steel cuff still locked on, the other hanging open: walked off Iron Island',
    draw(B, ctx) { ctx.as('armR'); const put = own(B, ctx); band(put, B, 'R', 10, STEEL, 1);
      for (let y = 4; y <= 6; y++) for (let z = -1; z <= 1; z++) if (!(y === 5 && z >= 0)) put(mx('R', -9), y, z, STEEL, 1); },   // the open cuff, a C hanging at the hand
    fine(P0, ctx) { const P = guard(P0, ctx); for (let hy = 14; hy <= 19; hy++) P.half(mh('R', -17), hy, hy % 2 ? 0 : 1, STEEL, 1);   // the chain, down the back of the hand
      P.rect('+x', -4, 41, 0, 42, 0x5d636b); } },

  nameplate_ring: {
    name: 'Four-Finger PAID', tier: 'epic', why: 'epic · a gold four-finger nameplate ring across the knuckles, lettered in ice',
    draw(B, ctx) { ctx.as('armR'); const put = own(B, ctx);
      for (const y of [6, 7]) { for (let z = -2; z <= 1; z++) put(mx('R', -9), y, z, GOLD, 1); for (const x of [-8, -7]) put(mx('R', x), y, 2, GOLD, 1); } },   // the plate on the back of the hand, wrapped onto the fingers' front
    fine(P0, ctx) { const P = guard(P0, ctx); P.bmp('+x', word('PAID'), { X: ICE }, 7, 30); P.rect('+x', -8, 24, 8, 25, GOLD_DK); P.rect('+x', -8, 31, 8, 32, GOLD_DK);
      P.rect('+z', 24, 24, 32, 32, (qa, qb) => (qb === 24 || qb === 31) ? GOLD_DK : ((qa + qb) & 1) && qb > 25 && qb < 30 ? ICE : undefined); } },

  pocket_safe: {
    name: 'Pocket Safe', tier: 'epic', why: 'epic · a gunmetal safe the size of a fist, worn at the hip on a gold chain strap',
    draw(B, ctx) { ctx.as('torso'); const put = own(B, ctx), GM = 0x66707c, D = drape(B, ctx); ctx.__chain = [];
      let zf = -99; for (let x = -5; x <= -3; x++) for (let y = 10; y <= 12; y++) zf = Math.max(zf, front(B, ctx, x, y) ?? -99); if (zf === -99) return;
      for (let x = -5; x <= -3; x++) for (let y = 10; y <= 12; y++) { put(x, y, zf + 1, GM, 1); put(x, y, zf + 2, GM, 1); }   // the safe, 3 × 3, two deep
      for (const [x, y] of stair(3, 17, -3, 13)) { const f = D.f(x, y); if (f !== null && put(x, y, f + 1, GOLD, 1)) ctx.__chain.push([x, y, '+z']); }   // the chain, shoulder to safe
      for (const [x, y] of stair(3, 17, -4, 11)) { const b = D.b(x, y); if (b !== null && put(x, y, b - 1, GOLD, 1)) ctx.__chain.push([x, y, '-z']); } },
    fine(P0, ctx) { const P = guard(P0, ctx), DK = 0x2a2e35, SIL = 0xdadee3;
      P.rect('+z', -20, 40, -8, 52, (qa, qb) => { const i = qa + 20, j = qb - 40;   // 12 × 12 texels: the door seam, the dial, the handle
        if (i === 0 || i === 11 || j === 0 || j === 11) return undefined; if (i === 1 || i === 10 || j === 1 || j === 10) return DK;
        const dx = i - 5.5, dy = j - 6.5, d = Math.hypot(dx, dy); if (d < 1.1) return DK; if (d < 2.6) return GOLD; if (d < 3.3 && ((i + j) & 1)) return GOLD_DK;
        if (i === 9 && j >= 2 && j <= 4) return SIL; return undefined; });
      for (const [x, y, f] of ctx.__chain || []) P.rect(f, 4 * x, 4 * y, 4 * x + 4, 4 * y + 4, (qa, qb) => ((qb & 3) === 1 || (qb & 3) === 3) && ((qa + (qb >> 1)) & 1) ? GOLD_DK : undefined); } },

  // ─────────────── GRAIL
  bust_down: {
    name: 'Bust-Down', tier: 'grail', why: 'grail · a gold watch iced to the lugs: bezel, dial and band all stones',
    // a fixed 4 × 2 case on the outside of the wrist (z −2…1, rows 10…11), whatever the sleeve; where it overhangs a thin wrist, the band
    // wraps one column round the front and the back
    draw(B, ctx) { ctx.as('armL'); const put = own(B, ctx), rs = [10, 11].map(y => armRow(B, 'L', y)); if (!rs[0] || !rs[1]) return;
      const x0 = Math.min(rs[0].x0, rs[1].x0), zl = -2, zh = 1;
      [10, 11].forEach((y, i) => { const r = rs[i];
        for (let z = zl; z <= zh; z++) { put(x0 - 1, y, z, GOLD, 1); for (let x = x0; x < r.x0; x++) if (z >= r.zlo && z <= r.zhi) put(x, y, z, GOLD, 1); }   // the case
        for (const z of [zl, zh]) if (!B.has(r.x0, y, z)) put(r.x0, y, z, GOLD, 1); });   // the band, where the case overhangs the wrist
      ctx.__watch = { x: x0 - 1, zl, zh }; },
    fine(P0, ctx) { const P = guard(P0, ctx), w = ctx.__watch; if (!w) return; const DIAL = 0xa9dcff, W = 4 * (w.zh - w.zl + 1);
      P.rect('-x', 4 * w.zl, 40, 4 * (w.zh + 1), 48, (qa, qb) => { const i = qa - 4 * w.zl, j = qb - 40;
        if (i < 2 || i >= W - 2 || j < 2 || j >= 6) return (i + j) & 1 ? ICE : undefined;   // the iced bezel
        if (j === 4 && i >= W / 2 - 2 && i <= W / 2) return GOLD_DK; if (i === W / 2 && j >= 3) return GOLD_DK;   // the hands
        return (i * 7 + j * 3) % 5 ? DIAL : ICE; });
      for (const f of ['+z', '-z']) P.rect(f, 4 * w.x, 40, 4 * (w.x + 2), 48, (qa, qb) => (qa + qb) & 1 ? ICE : undefined); } },   // the stones on the band
};
// every draw ends with settle(): the same entries, each draw followed by the depth rule
export default Object.fromEntries(Object.entries(ENTRIES).map(([id, e]) => [id, { ...e, draw(B, ctx) { e.draw(B, ctx); settle(B, ctx); } }]));
