// SIGNAGE · TYPE · the voxel type library (owner: the lettering agent, 2026-09-29). Ten bitmap faces drawn on the voxel grid
// (glyphs.js), each at two cap heights: 7 px (every shopfront board: a 0.9 m band, 9 voxels) and 11 px (a taller board: 13+ voxels).
//   mask(face, str, { big, seed }) → { w, h, base, at(i, j), fx(i, j), s, face }   the same shape as vox.js textMask (f.mask draws
//     it), plus: `base` = the baseline's row (a sign sets its letters on a baseline, so a descender, a bounce or a shadow never moves
//     the words), `fx` = the face's second colour (varsity's drop shadow, neon's halo), drawn unrecorded under the letters.
//   glyphMask(face, ch) → one plain capital (the blade's stacked letters)
// Spacing: every face has its own tracking (gap) and word space; pairs are kerned optically (a pair closes by 1 px — 2 at 11 px —
// wherever no stroke of the two comes nearer than the tracking in any row or the rows either side: LT, TA, AV, L', r., F. …).
// The classic 5×7 face ('pixel') at 7 px IS vox.js textMask, untouched: ?letters=classic (LETTERS.mode) puts every storefront back on it.
import { textMask } from '../../vox.js';
import * as G from './glyphs.js';

export const LETTERS = { mode: 'new' };   // 'classic' ← ?letters=classic (main.js FLAGS → jobs.js setFlags; the page hash changes with it)

// rows → big cut: light faces (1-px strokes) double their bars and widen their stems; bold faces double their bars and open the counter
const ROWS11 = [0, 0, 1, 2, 3, 3, 4, 5, 5, 6, 6];
export const FACES = {
  pixel:   { name: 'Pixel 5×7', note: 'the classic face (vox.js textMask)', classic: true, gap: 1, space: 3, cut: 'light', uses: 'everything, as before' },
  deli:    { name: 'Deli Condensed', t: G.DELI, p: G.PUNCT_LIGHT, gap: 1, space: 2, cut: 'light', uses: 'deli and bodega awnings, laundromats, keys' },
  wide:    { name: 'Wide Extended', t: G.WIDE, p: G.PUNCT_BOLD, gap: 2, space: 4, cut: 'bold', uses: 'streetwear, sneakers, phones' },
  slab:    { name: 'Slab Serif', t: G.SLAB, p: G.PUNCT_LIGHT, gap: 1, space: 3, cut: 'light', uses: 'pawn, law, bail, check cashing' },
  black:   { name: 'Blackletter', t: G.BLACK, p: G.PUNCT_BOLD, gap: 1, space: 3, cut: 'bold', uses: 'liquor, barbers, tattoo' },
  varsity: { name: 'Varsity Italic', t: G.VARSITY, p: G.PUNCT_BOLD, gap: 1, space: 3, cut: 'bold', slant: 2, shadow: 1, uses: 'sneakers, sports, skate' },
  bubble:  { name: 'Bubble', t: G.BUBBLE, p: G.PUNCT_BOLD, gap: 1, space: 3, cut: 'bold', bounce: 1, uses: '99¢, candy, comics, arcade' },
  script:  { name: 'Casual Script', t: G.SCRIPT, p: G.PUNCT_LIGHT, gap: 1, space: 3, cut: 'light', slant: 1, title: true, uses: 'salons, bakeries, cafes' },
  neon:    { name: 'Neon Tube', note: 'bent-tube monoline + a halo', tube: true, gap: 2, space: 4, cut: 'light', halo: 1, uses: 'neon signs (Neon Row)' },
  stencil: { name: 'Stencil', note: 'keeps the classic advance widths', t: G.STENCIL, gap: 1, space: 3, cut: 'bold', kern: false, uses: 'the Yards, surplus, storage' },
};
export const FACE_IDS = Object.keys(FACES);

const memo = new Map(), cached = (k, f) => { let v = memo.get(k); if (v === undefined) memo.set(k, v = f()); return v; };
const bits = rows => rows.map(r => [...r].map(c => c === '#'));
const classicRows = ch => { const M = textMask(ch), out = []; for (let j = 0; j < 7; j++) { const r = []; for (let i = 0; i < M.w; i++) r.push(M.at(i, j)); out.push(r); } return out; };
// a bent tube has no square corner: an L corner's pixel goes, its two strokes meet on the diagonal
// (a full-height left stem keeps its square corners: D is not O, B is not 8)
function rounded(B) { const h = B.length, w = B[0].length, on = (i, j) => j >= 0 && j < h && i >= 0 && i < w && B[j][i], stem = B.filter(r => r[0]).length >= h - 1;
  return B.map((r, j) => r.map((v, i) => { if (!v) return false; if (i === 0 && stem) return true; const L = on(i - 1, j), R = on(i + 1, j), U = on(i, j - 1), D = on(i, j + 1);
    return !((R && D && !L && !U && !on(i + 1, j + 1)) || (L && D && !R && !U && !on(i - 1, j + 1)) || (R && U && !L && !D && !on(i + 1, j - 1)) || (L && U && !R && !D && !on(i - 1, j - 1))); })); }
function bigCut(B, cut) { const rows = ROWS11.map(r => B[r]); for (let r = 7; r < B.length; r++) rows.push(B[r], B[r]);   // (a descender row doubles too)
  const w = B[0].length;
  if (cut === 'light') { const dbl = Array.from({ length: w }, (_, i) => w <= 2 || B.slice(0, 7).filter(r => r[i]).length >= 4);   // stems (a column inked in 4+ rows) 2 px, diagonals and bars as drawn
    return rows.map(r => r.flatMap((v, i) => dbl[i] ? [v, v] : [v])); }
  if (w < 4) return rows.map(r => r.slice());
  const c = w >> 1; return rows.map(r => [...r.slice(0, c + 1), r[c], ...r.slice(c + 1)]); }                     // counters 1 px wider
// one glyph of a face as rows of booleans (7 rows, 8 with a descender; 11/13 at the big cut)
export function glyph(face, ch, big = false) {
  const F = FACES[face]; return cached(face + '|' + ch + '|' + (big ? 'L' : 'S'), () => {
    let B; const src = F.t && (F.t[ch] ?? (F.title ? undefined : F.t[ch.toUpperCase()]) ?? (F.p && F.p[ch]));
    if (F.t && F.title && !src && ch !== ch.toUpperCase()) { const u = F.t[ch.toUpperCase()]; B = u ? bits(u.split(' ')) : classicRows(ch); }
    else B = src ? bits(src.split(' ')) : classicRows(ch);
    if (F.tube) B = rounded(B);
    if (big) { B = bigCut(B, F.cut); if (F.tube) B = rounded(B); }
    return B; }); }

const titleCase = s => s.replace(/[A-Za-z][A-Za-z']*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
// the line: glyphs placed on one baseline, kerned, then the face's slant / bounce / shadow / halo
export function mask(face, str, o = {}) {
  str = String(str); const F = FACES[face] || FACES.pixel, big = !!o.big;
  if (F.classic && !big) { const M = textMask(str); M.base = 6; M.fx = () => false; M.face = 'pixel'; return M; }   // byte-identical classic
  return cached('M|' + face + '|' + (big ? 'L|' : 'S|') + (o.seed | 0) + (o.raw ? 'r' : '') + '|' + str, () => {
    const cap = big ? 11 : 7, gap = F.gap + (big ? 1 : 0), space = big ? F.space + 2 : F.space, maxKern = F.kern === false ? 0 : big ? 2 : 1;
    const text = o.raw ? str : F.title ? titleCase(str) : str.toUpperCase(), P = [], right = new Map();   // right: absolute row → rightmost ink so far
    let x = 0, k = 0, afterSpace = true;
    for (const ch of text) {
      if (ch === ' ') { x += space + gap; afterSpace = true; continue; }
      const B = glyph(face, F.classic ? ch.toUpperCase() : ch, big), w = B[0].length, dy = F.bounce && ((k + (o.seed | 0)) & 1) ? F.bounce * (big ? 2 : 1) : 0;
      const prof = []; B.forEach((r, j) => { const i0 = r.indexOf(true); if (i0 >= 0) prof.push([j - dy, i0, r.lastIndexOf(true)]); });
      let at = x, kern = 0;
      if (!afterSpace && P.length) for (let t = 1; t <= maxKern; t++) {   // close the pair while every stroke keeps `gap` clear (rows ±1 too)
        const ok = prof.every(([r, i0]) => [r - 1, r, r + 1].every(rr => !right.has(rr) || x - t + i0 - right.get(rr) - 1 >= gap)); if (ok) kern = t; else break; }
      at = x - kern; P.push({ B, x: at, dy }); for (const [r, , i1] of prof) right.set(r, Math.max(right.get(r) ?? -99, at + i1));
      x = at + w + gap; k++; afterSpace = false; }
    // bounding rows: glyph rows run 0..len-1 with the baseline at cap-1; a bounce lifts a glyph by dy
    let top = 0, bot = cap - 1, W = Math.max(0, x - gap);
    for (const g of P) { top = Math.min(top, -g.dy); bot = Math.max(bot, g.B.length - 1 - g.dy); }
    const slant = (F.slant || 0) * (big ? 2 : 1), sh = F.shadow ? 1 : 0, halo = F.halo ? 1 : 0;
    const h0 = bot - top + 1, pad = halo, w1 = W + slant + sh + 2 * pad, h1 = h0 + sh + 2 * pad, base = cap - 1 - top + pad;
    const ink = new Uint8Array(w1 * h1), off = j => Math.round(slant * (cap - 1 - (j + top)) / (cap - 1));   // italic: rows above the baseline lean right
    for (const g of P) g.B.forEach((r, j) => { const jj = j - g.dy - top; r.forEach((v, i) => { if (!v) return; const X = g.x + i + Math.max(0, Math.min(slant, off(jj))) + pad, Y = jj + pad; if (X >= 0 && X < w1) ink[X + Y * w1] = 1; }); });
    const fx = new Uint8Array(w1 * h1), on = (i, j) => i >= 0 && j >= 0 && i < w1 && j < h1 && ink[i + j * w1] === 1;
    if (sh) for (let j = 0; j < h1; j++) for (let i = 0; i < w1; i++) if (!on(i, j) && on(i - 1, j - 1)) fx[i + j * w1] = 1;
    if (halo) for (let j = 0; j < h1; j++) for (let i = 0; i < w1; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) fx[i + j * w1] = 1;   // (a glow: the four sides, so counters stay open)
    return { w: w1, h: h1, base, at: (i, j) => ink[i + j * w1] === 1, fx: (i, j) => fx[i + j * w1] === 1, s: str, face, big }; }); }

// one plain capital for the blade's stack (no slant, bounce or effect; a script blade takes the script capital)
export function glyphMask(face, ch) { const F = FACES[face] || FACES.pixel; if (F.classic) return textMask(ch);
  return cached('G|' + face + '|' + ch, () => { const B = glyph(face, ch.toUpperCase()).slice(0, 7); return { w: B[0].length, h: 7, at: (i, j) => !!(B[j] && B[j][i]), s: ch }; }); }
