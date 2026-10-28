// HUMAN LAYER · THE SIGN FONT: the city's own sign lettering (signage/type, face 'pixel': the 5×7 classic every storefront uses) as two
// real webfonts, built in the browser at load (no generated file: the glyphs come from the same tables the signs are built from).
//   "AI City Sign"       the 7-px cut (shopfront boards): labels, keys, chips, tabs, small headings
//   "AI City Sign Tall"  the 11-px cut (a taller board: bars doubled, stems 2 px): handles and panel titles
// The zte skin sets its headings, labels, keys and handles in them (--k-font-sign, --k-font-sign-tall); body text stays a readable mono.
//   loadSignFont() → Promise   registers both once (document.fonts; the map's canvas can use them too)
// Metrics: one sign pixel = 100 units; the em is the cap + 1 above + 1 descender row (9 px small, 13 px tall), so at font-size 9·n px
// (13·n tall) every pixel is n×n CSS px and the baseline lands on a whole pixel. Lower case maps to the capitals (the signs have none).
// A few UI marks the signs never needed (, ( ) " ; _ = < > × → ← … | [ ] ▶) are drawn here on the same grid; anything else falls back
// to the next face in the stack. Advance = glyph width + 1 (the face's tracking); a space is 3 + 1, as textMask sets words.
import { glyph as signGlyph } from '../signage/type/index.js';

export const SIGN_FAMILY = 'AI City Sign', SIGN_TALL = 'AI City Sign Tall';
const P = 100;
const BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-·:!\'/&$?#%¢+*@';
const EXTRA = {   // rows top → bottom; row 7 (an 8th) is the descender
  ',': ['..', '..', '..', '..', '..', '.X', '.X', 'X.'], ';': ['..', 'XX', 'XX', '..', '.X', '.X', 'X.'],
  '(': ['..X', '.X.', 'X..', 'X..', 'X..', '.X.', '..X'], ')': ['X..', '.X.', '..X', '..X', '..X', '.X.', 'X..'],
  '[': ['XX', 'X.', 'X.', 'X.', 'X.', 'X.', 'XX'], ']': ['XX', '.X', '.X', '.X', '.X', '.X', 'XX'],
  '"': ['X.X', 'X.X', '...', '...', '...', '...', '...'], '“': ['X.X', 'X.X', '...', '...', '...', '...', '...'], '”': ['X.X', 'X.X', '...', '...', '...', '...', '...'],
  '’': ['X', 'X', '.', '.', '.', '.', '.'], '‘': ['X', 'X', '.', '.', '.', '.', '.'],
  '_': ['....', '....', '....', '....', '....', '....', 'XXXX'], '=': ['....', '....', 'XXXX', '....', 'XXXX', '....', '....'],
  '<': ['...X', '..X.', '.X..', 'X...', '.X..', '..X.', '...X'], '>': ['X...', '.X..', '..X.', '...X', '..X.', '.X..', 'X...'],
  '×': ['.....', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', '.....'], '→': ['.....', '..X..', '...X.', 'XXXXX', '...X.', '..X..', '.....'],
  '←': ['.....', '..X..', '.X...', 'XXXXX', '.X...', '..X..', '.....'], '↑': ['..X..', '.XXX.', 'X.X.X', '..X..', '..X..', '..X..', '..X..'],
  '↓': ['..X..', '..X..', '..X..', '..X..', 'X.X.X', '.XXX.', '..X..'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', 'X.X.X'], '–': ['....', '....', '....', 'XXXX', '....', '....', '....'],
  '—': ['......', '......', '......', 'XXXXXX', '......', '......', '......'], '|': ['X', 'X', 'X', 'X', 'X', 'X', 'X'], '•': ['..', '..', 'XX', 'XX', '..', '..', '..'],
  '▶': ['X...', 'XX..', 'XXX.', 'XXXX', 'XXX.', 'XX..', 'X...'], '°': ['XX', 'XX', '..', '..', '..', '..', '..'], '^': ['.X.', 'X.X', '...', '...', '...', '...', '...'],
  '~': ['.....', '.....', '.X...', 'X.X.X', '...X.', '.....', '.....'],
};
// the 11-px cut of a drawn mark, as signage/type derives it for the 'pixel' face (light cut: rows mapped, stems doubled)
const ROWS11 = [0, 0, 1, 2, 3, 3, 4, 5, 5, 6, 6];
function tall(rows) { const w = Math.max(...rows.map(r => r.length)), out = ROWS11.map(r => rows[r]); for (let r = 7; r < rows.length; r++) out.push(rows[r], rows[r]);
  const dbl = Array.from({ length: w }, (_, i) => w <= 2 || rows.slice(0, 7).filter(r => r[i] === 'X').length >= 4);
  return out.map(r => [...r.padEnd(w, '.')].flatMap((c, i) => dbl[i] ? [c, c] : [c]).join('')); }
function rowsOf(ch, big) {
  if (EXTRA[ch]) return big ? tall(EXTRA[ch]) : EXTRA[ch];
  return signGlyph('pixel', ch, big).map(r => r.map(v => v ? 'X' : '.').join(''));
}
// pixels → rectangles (row runs, merged down while the run below is identical): fewer contours, no seams inside a stem
function rects(rows) {
  const open = new Map(), out = [];
  rows.forEach((r, j) => { const runs = []; for (let i = 0; i < r.length;) { if (r[i] !== 'X') { i++; continue; } let k = i; while (k < r.length && r[k] === 'X') k++; runs.push([i, k]); i = k; }
    const next = new Map(); for (const [a, b] of runs) { const key = a + ':' + b, o = open.get(key); if (o) { o.j1 = j + 1; next.set(key, o); open.delete(key); } else { const n = { a, b, j0: j, j1: j + 1 }; out.push(n); next.set(key, n); } }
    open.clear(); for (const [k, v] of next) open.set(k, v); });
  return out;   // { a, b (columns, b exclusive), j0, j1 (rows, j1 exclusive) }
}
function glyphOf(ch, big) {
  const cap = big ? 11 : 7, rows = rowsOf(ch, big), w = Math.max(...rows.map(r => r.length)), R = rects(rows).map(q => ({ x0: q.a * P, x1: q.b * P, y0: (cap - q.j1) * P, y1: (cap - q.j0) * P }));
  return { adv: (w + (big ? 2 : 1)) * P, R };
}

// ── the TrueType writer (glyf outlines: one clockwise 4-point contour per rectangle)
function buildTTF(big = false) {
  const cap = big ? 11 : 7, EM = (cap + 2) * P, ASC = (cap + 1) * P, DESC = -P, family = big ? SIGN_TALL : SIGN_FAMILY;
  const chars = new Map();   // code point → glyph index
  const sp = (big ? 6 : 4) * P, glyphs = [{ adv: sp, R: [] }, { adv: sp, R: [] }];   // 0 .notdef · 1 space
  chars.set(32, 1); chars.set(160, 1);
  const add = (ch, cps) => { const g = glyphOf(ch, big); glyphs.push(g); for (const c of cps) chars.set(c, glyphs.length - 1); };
  for (const ch of BASE) add(ch, ch.toLowerCase() !== ch ? [ch.codePointAt(0), ch.toLowerCase().codePointAt(0)] : [ch.codePointAt(0)]);
  for (const ch of Object.keys(EXTRA)) if (!chars.has(ch.codePointAt(0))) add(ch, [ch.codePointAt(0)]);
  const N = glyphs.length;
  // glyf + loca
  const gbufs = glyphs.map(g => {
    if (!g.R.length) return new Uint8Array(0);
    const n = g.R.length, pts = n * 4, b = new DataView(new ArrayBuffer(10 + 2 * n + 2 + pts + 4 * pts + 4));
    const xMin = Math.min(...g.R.map(r => r.x0)), xMax = Math.max(...g.R.map(r => r.x1)), yMin = Math.min(...g.R.map(r => r.y0)), yMax = Math.max(...g.R.map(r => r.y1));
    g.box = { xMin, xMax, yMin, yMax }; g.pts = pts; g.n = n;
    let o = 0; const i16 = v => { b.setInt16(o, v); o += 2; }, u8 = v => { b.setUint8(o, v); o += 1; };
    i16(n); i16(xMin); i16(yMin); i16(xMax); i16(yMax);
    for (let k = 0; k < n; k++) i16(k * 4 + 3); i16(0);   // endPts, no instructions
    for (let k = 0; k < pts; k++) u8(1);                    // every point on the curve, x and y as int16 deltas
    const P4 = g.R.flatMap(r => [[r.x0, r.y0], [r.x0, r.y1], [r.x1, r.y1], [r.x1, r.y0]]);
    let px = 0; for (const [x] of P4) { i16(x - px); px = x; } let py = 0; for (const [, y] of P4) { i16(y - py); py = y; }
    const len = (o + 3) & ~3; return new Uint8Array(b.buffer, 0, len);
  });
  const loca = new DataView(new ArrayBuffer(4 * (N + 1))); let off = 0; gbufs.forEach((g, i) => { loca.setUint32(i * 4, off); off += g.length; }); loca.setUint32(N * 4, off);
  const glyf = new Uint8Array(off); { let o = 0; for (const g of gbufs) { glyf.set(g, o); o += g.length; } }
  const boxes = glyphs.filter(g => g.box).map(g => g.box);
  const xMin = Math.min(...boxes.map(b => b.xMin)), xMax = Math.max(...boxes.map(b => b.xMax)), yMin = Math.min(...boxes.map(b => b.yMin)), yMax = Math.max(...boxes.map(b => b.yMax));
  const advMax = Math.max(...glyphs.map(g => g.adv)), avg = Math.round(glyphs.reduce((s, g) => s + g.adv, 0) / N);
  const W = (size, f) => { const d = new DataView(new ArrayBuffer(size)); f(d); return new Uint8Array(d.buffer); };
  const head = W(54, d => { d.setUint32(0, 0x10000); d.setUint32(4, 0x10000); d.setUint32(8, 0); d.setUint32(12, 0x5F0F3CF5); d.setUint16(16, 0x000B); d.setUint16(18, EM);
    d.setInt16(36, xMin); d.setInt16(38, yMin); d.setInt16(40, xMax); d.setInt16(42, yMax); d.setUint16(44, 0); d.setUint16(46, 8); d.setInt16(48, 2); d.setInt16(50, 1); d.setInt16(52, 0); });
  const hhea = W(36, d => { d.setUint32(0, 0x10000); d.setInt16(4, ASC); d.setInt16(6, DESC); d.setInt16(8, 0); d.setUint16(10, advMax);
    d.setInt16(12, Math.min(0, ...boxes.map(b => b.xMin))); d.setInt16(14, Math.min(...glyphs.filter(g => g.box).map(g => g.adv - g.box.xMax))); d.setInt16(16, Math.max(...boxes.map(b => b.xMax)));
    d.setInt16(18, 1); d.setInt16(20, 0); d.setInt16(22, 0); d.setInt16(34, N); });
  const maxp = W(32, d => { d.setUint32(0, 0x10000); d.setUint16(4, N); d.setUint16(6, Math.max(...glyphs.map(g => g.pts || 0))); d.setUint16(8, Math.max(...glyphs.map(g => g.n || 0))); d.setUint16(14, 2); });
  const hmtx = W(4 * N, d => glyphs.forEach((g, i) => { d.setUint16(i * 4, g.adv); d.setInt16(i * 4 + 2, g.box ? g.box.xMin : 0); }));
  const cps = [...chars.keys()].sort((a, b) => a - b);
  const os2 = W(96, d => { let o = 0; const u = v => { d.setUint16(o, v); o += 2; }, s = v => { d.setInt16(o, v); o += 2; }, U = v => { d.setUint32(o, v); o += 4; };
    u(4); s(avg); u(400); u(5); u(0); s(600); s(500); s(0); s(70); s(600); s(500); s(0); s(300); s(P); s(300); s(0); o += 10;   // panose
    U(1); U(0); U(0); U(0); [78, 79, 78, 69].forEach(c => d.setUint8(o++, c)); u(0x00C0); u(cps[0]); u(Math.min(0xFFFF, cps[cps.length - 1]));
    s(ASC); s(DESC); s(0); u(ASC); u(-DESC); U(1); U(0); s(cap * P); s(cap * P); u(0); u(32); u(1); });
  const seg = cps.length + 1, lg = Math.floor(Math.log2(seg)), sr = 2 * 2 ** lg;
  const cmap = W(12 + 16 + 8 * seg, d => { d.setUint16(0, 0); d.setUint16(2, 1); d.setUint16(4, 3); d.setUint16(6, 1); d.setUint32(8, 12);
    let o = 12; const u = v => { d.setUint16(o, v); o += 2; }; u(4); u(16 + 8 * seg); u(0); u(seg * 2); u(sr); u(lg); u(seg * 2 - sr);
    for (const c of cps) u(c); u(0xFFFF); u(0); for (const c of cps) u(c); u(0xFFFF);
    for (const c of cps) u((chars.get(c) - c + 65536) % 65536); u(1); for (let k = 0; k < seg; k++) u(0); });
  const NAMES = [[1, family], [2, 'Regular'], [3, family + ' 1.0'], [4, family], [5, 'Version 1.0'], [6, family.replace(/ /g, '') + '-Regular']];
  const strs = NAMES.map(([, t]) => { const b = new Uint8Array(t.length * 2); for (let i = 0; i < t.length; i++) { b[i * 2] = t.charCodeAt(i) >> 8; b[i * 2 + 1] = t.charCodeAt(i) & 255; } return b; });
  const name = W(6 + 12 * NAMES.length + strs.reduce((s, b) => s + b.length, 0), d => { d.setUint16(0, 0); d.setUint16(2, NAMES.length); d.setUint16(4, 6 + 12 * NAMES.length);
    let so = 0; NAMES.forEach(([id], i) => { const o = 6 + 12 * i; d.setUint16(o, 3); d.setUint16(o + 2, 1); d.setUint16(o + 4, 0x409); d.setUint16(o + 6, id); d.setUint16(o + 8, strs[i].length); d.setUint16(o + 10, so); so += strs[i].length; });
    let o = 6 + 12 * NAMES.length; for (const b of strs) for (const x of b) d.setUint8(o++, x); });
  const post = W(32, d => { d.setUint32(0, 0x30000); d.setInt16(8, -P); d.setInt16(10, 50); });
  const tables = { 'OS/2': os2, cmap, glyf, head, hhea, hmtx, loca: new Uint8Array(loca.buffer), maxp, name, post };
  const tags = Object.keys(tables).sort(), nt = tags.length, pad = n => (n + 3) & ~3;
  let total = 12 + 16 * nt; for (const t of tags) total += pad(tables[t].length);
  const out = new Uint8Array(total), dv = new DataView(out.buffer), lgt = Math.floor(Math.log2(nt));
  dv.setUint32(0, 0x10000); dv.setUint16(4, nt); dv.setUint16(6, 16 * 2 ** lgt); dv.setUint16(8, lgt); dv.setUint16(10, nt * 16 - 16 * 2 ** lgt);
  const sum = (bytes, o0, len) => { let s = 0; for (let i = 0; i < pad(len); i += 4) s = (s + (((bytes[o0 + i] << 24) | (bytes[o0 + i + 1] << 16) | (bytes[o0 + i + 2] << 8) | bytes[o0 + i + 3]) >>> 0)) >>> 0; return s; };
  let o = 12 + 16 * nt, headAt = 0;
  tags.forEach((t, i) => { const b = tables[t], r = 12 + 16 * i; out.set(b, o); for (let k = 0; k < 4; k++) dv.setUint8(r + k, t.charCodeAt(k));
    dv.setUint32(r + 4, sum(out, o, b.length)); dv.setUint32(r + 8, o); dv.setUint32(r + 12, b.length); if (t === 'head') headAt = o; o += pad(b.length); });
  dv.setUint32(headAt + 8, (0xB1B0AFBA - sum(out, 0, total)) >>> 0);
  return out.buffer;
}

let ready = null;
export function loadSignFont() {
  if (ready) return ready;
  ready = Promise.all([[SIGN_FAMILY, false], [SIGN_TALL, true]].map(async ([fam, big]) => {
    try { const ff = new FontFace(fam, buildTTF(big), { weight: '100 900', style: 'normal', display: 'block' }); await ff.load(); document.fonts.add(ff); return ff; }
    catch (e) { console.warn('[ui] sign font', fam, e); return null; } }));
  return ready;
}
export const _buildTTF = buildTTF;   // (tools: write it out to inspect)
