// SIGNAGE · the formats in voxels (owner: the signage agent). Springfield: flat toon colour, chunky steel, lettering one voxel proud
// of its board, nothing floating, every letter recorded for the audit (its board behind it, open air in front of it).
//   roofBoard(o)         the rooftop billboard: two faces (it reads from the street AND from the overview), steel legs and bracing,
//                        a grated catwalk on brackets, gooseneck lamps, a moulding frame; a character or a product breaks out of the
//                        top as a cut-out. o.giant leaves the right of the face clear for a 4× chars.js giant on the catwalk.
//   paintWall(f, …)      a design painted flush on a facade frame (side walls, the big character murals, paste-up rows)
//   ghostWall(f, …)      a faded heritage ad, weathered into the wall colour
//   pasteWall(f, …)      wheat-paste posters in runs, a few torn
//   lightbox(d, …)       the bus-shelter ad (0.05 grain, both faces, glowing at night)
import { Vol, meshed, stamp } from '../vox.js';
import { TOD } from '../kit.js';
import { PAL, CV, hash, shade } from '../style.js';
import { paint, palOf, TONE } from './paint.js';
import { Img, px5, px3, fit, INK, WHITE, mix, lum, inkOn } from './art.js';

const MEMO = new Map(), memo = (k, f) => { k += '|' + TOD.night; let b = MEMO.get(k); if (!b) MEMO.set(k, b = f()); return b; };
const lit = () => TOD.night ? 3 : 0;
const IRON = PAL.iron, STEEL = 0x9a9ba2, GRATE = 0x3a3a42;

// ───────────────────────── the rooftop billboard
// Voxel frame (0.1): x 0…81 (the face x 3…78, 76 wide), y up from the roof, z 0…17 (z 8 = the stamp origin plane).
//   posts y 0–16 · catwalk y 16–18, z 8–16 · face y 18–53 (36 rows) · frame y 54 · cut-out y 55+ · lamps over the top.
//   back face (bg) z 4–5, back letters z 3 · front face (bg) z 6–7, front letters z 8 (one voxel proud)
export const FACE = { w: 76, h: 36 };
export function roofBoard(d, way, o = {}) {
  const giant = !!o.giant, flip = !!o.flip, key = `rb|${d.key}|${way[3]}|${way[4]}|${giant}|${flip}`;
  return memo(key, () => {
    const face = flip ? way[4] : way[3], ink = flip ? way[3] : way[4], lay = giant ? 'giant' : d.lay;
    const ext = !giant && (d.lay === 'figure') ? 15 : !giant && d.lay === 'product' ? 9 : 0;
    const I = giantPaint(d, face, ink, giant) || paint(d, FACE.w, FACE.h, { ext, pal: { bg: face, fg: ink }, lit: lit() });
    const NX = 82, NZ = 18, top = 54 + ext + 8, V = new Vol(NX, top + 2, NZ, { s: CV, org: [-NX * CV / 2, 0, -8 * CV], ground: true });
    const X = i => 3 + i, Y = j => 53 - (j - I.ext0);                     // face pixel → voxel (I.ext0 = rows above the frame)
    I.ext0 = ext;
    const frameC = lum(face) > .6 ? INK : lum(face) < .15 ? STEEL : WHITE;
    // posts (I-beams) with X bracing in the post plane, brackets under the catwalk
    for (const x of [8, 40, 72]) { V.box(x, 0, 4, x + 3, 18, 6, IRON); V.box(x - 1, 0, 3, x + 4, 1, 7, IRON); V.box(x, 14, 6, x + 3, 16, 16, IRON); }
    for (const [a, b] of [[11, 40], [43, 72]]) for (let t = 0; t <= b - a; t++) { const y = Math.round(2 + (t / (b - a)) * 11); V.set(a + t, y, 5, IRON); V.set(b - t, y, 5, IRON); }
    // catwalk: a grate on the brackets, a toe board, rail posts at the ends only (a rail across would cross the letters)
    V.box(3, 16, 8, 79, 18, 16, (x, y, z) => (y === 17 && (x + z) % 2) ? GRATE : IRON); V.box(3, 18, 15, 79, 19, 16, IRON);
    for (const x of [3, 78]) V.box(x, 18, 15, x + 1, 27, 16, IRON);
    // the slab: back face + front face, the moulding frame proud on both sides, the top cap
    V.box(3, 18, 4, 79, 54, 8, face); V.box(2, 17, 3, 80, 18, 9, frameC); V.box(2, 54, 3, 80, 55, 9, frameC); V.box(2, 17, 3, 3, 55, 9, frameC); V.box(79, 17, 3, 80, 55, 9, frameC);
    // front face picture (bg + art), then the back face: the same design mirrored so it reads from behind (a double-faced board)
    const texts = [];
    for (let j = ext; j < I.h; j++) for (let i = 0; i < I.w; i++) { const k = i + j * I.w, c = I.c[k]; if (c < 0) continue; const x = X(i), y = Y(j), L = I.l[k];
      V.set(x, y, 7, c, L); V.set(x, y, 6, c, L); if (I.t[k] >= 0) texts.push([x, y, c, L, I.labels[I.t[k]], 1]);
      const xb = NX - 1 - x; V.set(xb, y, 4, c, L); V.set(xb, y, 5, c, L); if (I.t[k] >= 0) texts.push([xb, y, c, L, I.labels[I.t[k]], -1]); }
    // what breaks out of the top: a cut-out (sprite colours on both faces, plywood between) on a steel strut
    let cut = 0; for (let j = 0; j < ext; j++) for (let i = 0; i < I.w; i++) { const k = i + j * I.w, c = I.c[k]; if (c < 0) continue; const x = X(i), y = 55 + (ext - 1 - j);
      V.set(x, y, 8, c, I.l[k]); V.set(x, y, 7, 0xc9a877); V.set(x, y, 6, 0xc9a877); V.set(x, y, 5, c, I.l[k]); cut++; }
    if (cut) { let x0 = 1e9, x1 = -1; for (let j = 0; j < ext; j++) for (let i = 0; i < I.w; i++) if (I.c[i + j * I.w] >= 0) { x0 = Math.min(x0, X(i)); x1 = Math.max(x1, X(i)); }
      const sx = Math.round((x0 + x1) / 2); V.box(sx - 1, 55, 4, sx + 1, 55 + Math.max(2, ext - 3), 5, IRON); }
    // gooseneck lamps on the top frame, bending out over the face (clear of the cut-out and, on a giant board, of the giant)
    for (const lx of giant ? [10, 26] : [10, 40, 70]) { let clear = true; for (let y = 55; y < 60; y++) for (let x = lx - 1; x <= lx + 2; x++) if (V.has(x, y, 6)) clear = false; if (!clear) continue;
      V.box(lx, 55, 5, lx + 1, 60, 6, IRON); V.box(lx, 59, 6, lx + 1, 60, 13, IRON); V.box(lx - 1, 57, 12, lx + 2, 59, 15, IRON); V.box(lx - 1, 56, 12, lx + 2, 57, 15, 0xfff3c4, TOD.night ? 3 : 2); }
    // letters one voxel proud of their board, written last (front z 8, back z 3), each recorded for the audit
    V.recNext(); let lab = null; for (const [x, y, c, L, label, dir] of texts) { if (label !== lab) { V.recNext(); lab = label; } const z = dir > 0 ? 8 : 3; if (V.has(x, y, z)) continue; V.set(x, y, z, c, L); V.recN(label, x, y, z, 0, dir); }
    const b = meshed(V); b.big = true; b.kind = 'billboard'; b.design = d.key; return b; });
}
// does a design's copy fit a giant board's left 41 columns (giantPaint's own geometry)? The swap's fit gate for giant boards (index.js)
const GFIT = new Map();
export const giantFits = d => { let r = GFIT.get(d.key); if (r === undefined) { const sh = d.tel || d.sub ? 7 : 0, sub = { ...d, lay: d.icon && !d.look ? 'product' : 'type', tel: null, sub: null };
  r = !paint(sub, Math.round(FACE.w * .56) - 2, FACE.h - sh - 2, { lay: sub.lay }).miss; GFIT.set(d.key, r); } return r; };
// a board with a 4× giant on its catwalk (gen.js, setpieces.js): the copy stays on the left 55 %, the right is his backdrop
function giantPaint(d, face, ink, giant) { if (!giant) return null; const W = FACE.w, H0 = FACE.h, I = new Img(W, H0), p = palOf(d, { pal: { bg: face, fg: ink } }); I.rect(0, 0, W, H0, face);
  const cw = Math.round(W * .56), sh = d.tel || d.sub ? 7 : 0; I.rect(cw, 0, cw + 1, H0 - sh, p.acc);
  const sub = { ...d, lay: d.icon && !d.look ? 'product' : 'type', tel: null, sub: null }, J = paint(sub, cw - 2, H0 - sh - 2, { pal: { bg: face, fg: ink }, lit: lit(), lay: sub.lay });
  // the strip's words: across the board (pass 3); a reserve design (signage pass 4) keeps them in the copy column, clear of the giant standing
  // over the right of the board (the phone, else the small print, else nothing: never a number cut by his legs)
  const res = String(d.id || '').startsWith('res:'), SW = res ? cw - 1 : W, s = res ? [d.tel, d.sub].find(t => t && px3(t).w <= SW - 4) : d.tel || d.sub;
  I.blit(J, 1, 1, {}); if (sh) { I.rect(0, H0 - sh, W, H0, INK); if (s) { const M = px5(s).w <= SW - 4 ? px5(s) : px3(s); if (M.w <= SW - 4) I.text(M, 3, H0 - sh + ((sh - M.h) >> 1), WHITE, { l: lit(), label: s }); } }
  I.ext0 = 0; return I; }

// ───────────────────────── paint on a facade frame (kit.js frame: a along, y up, d out of the wall). The picture's top-left is
// (a0, y0 + h); background pixels replace the wall's outer skin (d 0), lettering stands one voxel proud (d 1) on its board.
export function paintWall(f, I, a0, y0, o = {}) { const h = I.h, recs = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < I.w; i++) { const k = i + j * I.w, c = I.c[k]; if (c < 0) continue; const a = a0 + i, y = y0 + h - 1 - j; f.set(a, y, 0, c, o.lit ?? I.l[k]);
    if (I.t[k] >= 0 && o.relief !== false) recs.push([a, y, c, I.l[k], I.labels[I.t[k]]]); }
  let lab = null; f.V.recNext(); for (const [a, y, c, L, label] of recs) { if (label !== lab) { f.V.recNext(); lab = label; } f.set(a, y, 1, c, o.lit ?? L); f.rec(label, a, y, 1, 0, 1); }
}
// the picture for a wall ad: the design at the wall's size (the palette follows the design's tone)
export const wallImg = (d, w, h, o = {}) => paint(d, w, h, { lit: 0, ...o });

// ───────────────────────── a ghost sign: an old two-colour ad, faded toward the wall, weathered (spots of bare wall)
export const ghostFits = (d, w) => !!(fit(d.big, w - 6, 16, 'serif') || fit(d.big, w - 6, 14, 'px5'));
export function ghostWall(f, d, a0, ytop, w, wall, seed = 1) {
  const fadeTo = (c, k) => mix(c, wall, k), old = [[0x9a1418, 0xf2e6c8], [0x1d3aa8, 0xf2e6c8], [0x17171b, 0xf2e6c8], [0x2f6b3a, 0xf2e6c8], [0xf2e6c8, 0x7a1020]][(hash(seed, 3) * 5) | 0];
  const panel = fadeTo(old[0], .55), ink = fadeTo(old[1], .42), rows = [];
  const topM = d.top ? [px5(d.top), px3(d.top)].find(M => M.w <= w - 6) || null : null, bigM = fit(d.big, w - 6, 16, 'serif') || fit(d.big, w - 6, 14, 'px5'), subM = d.sub ? (px5(d.sub).w <= w - 6 ? px5(d.sub) : px3(d.sub).w <= w - 6 ? px3(d.sub) : null) : null;
  if (!bigM) return 0; const h = 4 + (topM ? topM.h + 2 : 0) + bigM.h + 2 + (subM ? subM.h + 2 : 0) + 2, y0 = ytop - h, I = new Img(w, h);
  I.rect(0, 0, w, h, panel); I.frame(1, 1, w - 1, h - 1, ink, 1); let y = 3;
  if (topM) { I.text(topM, Math.round((w - topM.w) / 2), y, ink, { label: d.top }); y += topM.h + 2; }
  I.text(bigM, Math.round((w - bigM.w) / 2), y, ink, { label: d.big }); y += bigM.h + 2; if (subM) I.text(subM, Math.round((w - subM.w) / 2), y, ink, { label: d.sub });
  // weathering: bare wall shows through in patches (letters keep enough of themselves to read)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = i + j * w, n = hash(i >> 1, j >> 1, seed + 17); if (n > .9 && I.t[k] < 0) I.c[k] = wall; else if (n > .96) I.c[k] = shade(wall, 1.06); }
  paintWall(f, I, a0, y0, { lit: 0, relief: false }); f.V.recNext(); let lab = null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = i + j * w; if (I.t[k] < 0 || I.c[k] === wall) continue; const label = I.labels[I.t[k]]; if (label !== lab) { f.V.recNext(); lab = label; } f.rec(label, a0 + i, y0 + h - 1 - j, 0, 0, 1); }
  return h;
}

// ───────────────────────── wheat-paste: posters in runs (the same poster two or three times, then the next), edges a little torn
export const posterSize = h => { const pw = h >= 44 ? 28 : 22; return [pw, Math.min(h - 2, Math.round(pw * 1.3))]; };
export function pasteWall(f, designs, a0, y0, w, h, seed = 1) {
  const [pw, ph] = posterSize(h), n = Math.max(1, Math.floor((w + 1) / (pw + 1))), used = [];
  const run = []; let k = 0; while (run.length < n) { const d = designs[k % designs.length]; const r = 1 + ((hash(seed, k, 7) * 3) | 0); for (let t = 0; t < r && run.length < n; t++) run.push(d); k++; }
  const x0 = a0 + Math.floor((w - n * (pw + 1) + 1) / 2);
  run.forEach((d, i) => { if (!used.includes(d)) used.push(d); const I = paint(d, pw, ph, {}), yy = y0 + ((hash(seed, i, 3) * 3) | 0);
    for (let j = 0; j < I.h; j++) for (let x = 0; x < I.w; x++) { const q = x + j * I.w, edge = x === 0 || x === I.w - 1 || j === 0 || j === I.h - 1; if (edge && hash(seed + i, x, j) > .62 && I.t[q] < 0) I.c[q] = -1; }   // torn edges
    paintWall(f, I, x0 + i * (pw + 1), yy, { lit: 0 }); });
  return used;
}

// ───────────────────────── the bus-shelter ad panel: the shelter's east end, ground to roof in green steel (0.05 grain, w × h), a
// poster inset in both faces (36 rows from 0.3 m up), lit at night. x = thickness (4), y = up, z = across the shelter.
export function lightbox(d, w = 16, h = 46) { return memo(`lb|${d.key}|${w}|${h}`, () => {
  const I = paint(d, w, 36, { lay: 'poster', lit: 0 }), V = new Vol(4, h, w, { s: .05, org: [0, 0, 0], ground: true }), G = PAL.lamp, L = TOD.night ? 3 : 1, y0 = 6, recs = [];   // (edge to edge across the panel: the shelter's corners are its frame)
  V.box(0, 0, 0, 4, h, w, G);
  for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) { const k = i + j * I.w, c = I.c[k]; if (c < 0) continue; const y = y0 + I.h - 1 - j, z = i;
    V.set(3, y, w - 1 - z, c, L); V.set(0, y, z, c, L); if (I.t[k] >= 0) recs.push([y, z, I.labels[I.t[k]]]); }   // (+x face read from the east: columns run toward −z)
  V.recNext(); for (const [y, z, label] of recs) { V.rec(label, 3, y, w - 1 - z, 2, w - 1 - z, 4, w - 1 - z); V.rec(label, 0, y, z, 1, z, -1, z); }
  return V; }); }
