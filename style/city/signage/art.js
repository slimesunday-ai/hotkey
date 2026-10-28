// SIGNAGE · pixel art for every sign in the city (owner: the signage agent). Signs are designed flat, then built in voxels:
//   Img        a 2D image (row 0 = top): colour, light layer (0 matte · 1 gloss · 2 metal · 3 lit), relief (voxels proud of the
//              board) and a text label per pixel, so the 3D builders can tell the audit where every letter's board is
//   fonts      px5 (the city's 5×7, vox.js) · px3 (3×5 small print) · disp (a system display face rastered per size: Impact,
//              Arial Black, Georgia, Didot, Courier, Marker Felt) · fit() picks the largest that fits a box
//   charImg    a chars.js character seen from the front (the fit-check card view): real looks, poses, crops. 1 character voxel
//              = 1 pixel, so at the city grain (0.1) a character is drawn at 2× and a bust fills a billboard panel
//   ICONS      product pictograms (drumstick, 40, dice, badge, gavel…) for ads and 3D cut-outs
// Everything here is pure and memoized: it runs in the build workers, on the main thread (shots) and in node (census).
import { textMask, rasterMask } from '../vox.js';
// world/chars.js is LOADED LAZILY, never imported statically: the node tools (shots.mjs, reserved.mjs, the audit's node side) load
// district kits with `three` stubbed, and chars.js builds three materials when it loads, so a static import breaks every kit in
// node. The page resolves the relative path natively. In the build workers every module is a Blob URL (worker.js), so the path sits
// in the one string below, which the workers' bundler rewrites like an import line (srcmap.js FROM_RE) into the very Blob URL jobs.js
// imports: one chars.js per worker. Where it can't load (node with the stub) CH stays null and ads paint without their character.
// (cast pass, 2026-10-02: the characters are the city's cast, style/city/cast.js: the fresh traits slime didn't kill, the named
// handles translated into them)
const CHARS_AT = ` import '../cast.js'`.split("'")[1];
let CH = null; try { CH = await import(CHARS_AT.startsWith('.') ? new URL(CHARS_AT, import.meta.url).href : CHARS_AT); } catch { CH = null; }
if (!CH && typeof WorkerGlobalScope !== 'undefined') console.error('signage/art.js: cast.js did not load in the build worker (see the note above): ads paint without characters');
export const charsReady = () => !!CH;

export const INK = 0x17171b, WHITE = 0xf7f7f2, CREAM = 0xfff0d0;
export const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const lum = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255;
export const inkOn = c => lum(c) > .6 ? INK : WHITE;

// ───────────────────────── the image
export class Img {
  constructor(w, h) { this.w = w; this.h = h; const n = w * h; this.c = new Int32Array(n).fill(-1); this.l = new Uint8Array(n); this.z = new Int8Array(n); this.t = new Int16Array(n).fill(-1); this.labels = []; }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.c[x + y * this.w] : -1; }
  set(x, y, c, l = 0, z = 0, t = -1) { x = Math.round(x); y = Math.round(y); if (!this.in(x, y) || c === undefined || c === null) return; const i = x + y * this.w; this.c[i] = c; this.l[i] = l; this.z[i] = z; this.t[i] = t; }
  rect(x0, y0, x1, y1, c, l = 0, z = 0) { for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c, l, z); return this; }
  fill(c, l = 0) { return this.rect(0, 0, this.w, this.h, c, l); }
  frame(x0, y0, x1, y1, c, t = 1, l = 0, z = 0) { this.rect(x0, y0, x1, y0 + t, c, l, z); this.rect(x0, y1 - t, x1, y1, c, l, z); this.rect(x0, y0, x0 + t, y1, c, l, z); this.rect(x1 - t, y0, x1, y1, c, l, z); return this; }
  disc(cx, cy, r, c, l = 0, z = 0) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) this.set(x, y, c, l, z); return this; }
  label(s) { let k = this.labels.indexOf(s); if (k < 0) { k = this.labels.length; this.labels.push(s); } return k; }
  // a text mask at (x, y) = its top-left; sc = integer scale; o: { l, z (relief), shadow: colour one pixel down-right, label }
  text(M, x, y, c, o = {}) { const sc = o.sc || 1, t = this.label(o.label ?? M.s ?? 'text'), l = o.l ?? 0, z = o.z ?? 0;
    if (o.shadow !== undefined) for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const X = x + i * sc + a + sc, Y = y + j * sc + b + sc; if (this.get(X, Y) !== c) this.set(X, Y, o.shadow, 0, 0); }
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) this.set(x + i * sc + a, y + j * sc + b, c, l, z, t);
    return M.w * sc; }
  // centred text
  textC(M, cx, y, c, o = {}) { return this.text(M, Math.round(cx - M.w * (o.sc || 1) / 2), y, c, o); }
  // another image (sc = integer upscale; o.fx = mirror; o.z = extra relief; o.l = force layer; o.keepT = keep its text labels)
  blit(I, x, y, o = {}) { const sc = o.sc || 1;
    for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) { const k = i + j * I.w, c = I.c[k]; if (c < 0) continue; const ii = o.fx ? I.w - 1 - i : i, t = I.t[k] >= 0 && o.keepT !== false ? this.label(I.labels[I.t[k]]) : -1;
      for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) this.set(x + ii * sc + a, y + j * sc + b, o.tint ? o.tint(c) : c, o.l ?? I.l[k], (o.z ?? 0) + I.z[k], t); }
    return this; }
  // opaque bounding box (x0, y0, x1, y1) or null
  bounds() { let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.c[x + y * this.w] >= 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1]; }
}

// ───────────────────────── fonts
const MEMO = new Map(), memo = (k, f) => { let v = MEMO.get(k); if (v === undefined) MEMO.set(k, v = f()); return v; };
export const px5 = s => memo('5|' + s, () => textMask(s));
// 3×5 small print (M, N, W wider): phone numbers, fine print, poster lines. Same mask shape as vox.js textMask.
const G3 = { A: '.X.|X.X|XXX|X.X|X.X', B: 'XX.|X.X|XX.|X.X|XX.', C: '.XX|X..|X..|X..|.XX', D: 'XX.|X.X|X.X|X.X|XX.', E: 'XXX|X..|XX.|X..|XXX', F: 'XXX|X..|XX.|X..|X..',
  G: '.XX|X..|X.X|X.X|.XX', H: 'X.X|X.X|XXX|X.X|X.X', I: 'XXX|.X.|.X.|.X.|XXX', J: '..X|..X|..X|X.X|.X.', K: 'X.X|X.X|XX.|X.X|X.X', L: 'X..|X..|X..|X..|XXX',
  M: 'X...X|XX.XX|X.X.X|X...X|X...X', N: 'X..X|XX.X|X.XX|X..X|X..X', O: '.X.|X.X|X.X|X.X|.X.', P: 'XX.|X.X|XX.|X..|X..', Q: '.X.|X.X|X.X|XX.|.XX', R: 'XX.|X.X|XX.|X.X|X.X',
  S: '.XX|X..|.X.|..X|XX.', T: 'XXX|.X.|.X.|.X.|.X.', U: 'X.X|X.X|X.X|X.X|XXX', V: 'X.X|X.X|X.X|X.X|.X.', W: 'X...X|X...X|X.X.X|XX.XX|X...X', X: 'X.X|X.X|.X.|X.X|X.X',
  Y: 'X.X|X.X|.X.|.X.|.X.', Z: 'XXX|..X|.X.|X..|XXX', 0: 'XXX|X.X|X.X|X.X|XXX', 1: '.X.|XX.|.X.|.X.|XXX', 2: 'XX.|..X|.X.|X..|XXX', 3: 'XX.|..X|.X.|..X|XX.',
  4: 'X.X|X.X|XXX|..X|..X', 5: 'XXX|X..|XX.|..X|XX.', 6: '.XX|X..|XXX|X.X|XXX', 7: 'XXX|..X|.X.|.X.|.X.', 8: 'XXX|X.X|XXX|X.X|XXX', 9: 'XXX|X.X|XXX|..X|XX.',
  '.': '.|.|.|.|X', '-': '...|...|XXX|...|...', '/': '..X|..X|.X.|X..|X..', $: '.XX|XX.|.X.|.XX|XX.', '#': 'X.X|XXX|X.X|XXX|X.X', '&': '.X.|X.X|.X.|X.X|.XX',
  '?': 'XX.|..X|.X.|...|.X.', '!': 'X|X|X|.|X', "'": 'X|X|.|.|.', ':': '.|X|.|X|.', '+': '...|.X.|XXX|.X.|...', '%': 'X.X|..X|.X.|X..|X.X', '@': '.X.|X.X|XXX|X..|.XX',
  '¢': '.X.|XXX|X..|XXX|.X.', '·': '.|.|X|.|.', ' ': '..|..|..|..|..', ',': '.|.|.|X|X', '*': '...|X.X|.X.|X.X|...', '=': '...|XXX|...|XXX|...', '(': '.X|X.|X.|X.|.X', ')': 'X.|.X|.X|.X|X.' };
export const px3 = s => memo('3|' + s, () => { const gs = [...String(s).toUpperCase()].map(ch => (G3[ch] ?? G3['?']).split('|')), w = gs.reduce((a, g) => a + g[0].length + 1, -1), rows = [];
  for (let r = 0; r < 5; r++) rows.push(gs.map(g => g[r]).join('.')); return { w: Math.max(0, w), h: 5, at: (i, j) => rows[j][i] === 'X', s: String(s) }; });
// display faces (system fonts, rastered once per size; workers draw them on an OffscreenCanvas). Node has no canvas: px5 stands in.
export const FACES = { impact: '900 {px}px Impact, "Arial Black", sans-serif', black: '900 {px}px "Arial Black", Impact, sans-serif', serif: 'bold {px}px Georgia, "Times New Roman", serif',
  didot: '{px}px Didot, "Bodoni 72", Georgia, serif', mono: 'bold {px}px "Courier New", Courier, monospace', marker: 'bold {px}px "Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive',
  cond: 'bold {px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif', rock: 'bold {px}px Rockwell, "American Typewriter", Georgia, serif' };
const CANVAS = typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
export function disp(s, px, face = 'impact') { return memo(`d|${face}|${px}|${s}`, () => { if (!CANVAS) return px5(s);
  const M = rasterMask(String(s), FACES[face].replace('{px}', px), 110); return M.w > 0 ? M : px5(s); }); }
// the largest mask of s that fits w × h: display face px sizes from 64 down to 9, then px5 at 3× … 1×, then px3; null if nothing fits
export function fit(s, w, h, face = 'impact', o = {}) {
  const k = `f|${face}|${w}|${h}|${o.min || 0}|${o.max || 0}|${s}`; return memo(k, () => {
    let D = null; if (face !== 'px5' && face !== 'px3') for (let px = Math.min(o.max || 64, Math.round(h * 1.45)); px >= Math.max(9, o.min || 9); px--) { const M = disp(s, px, face); if (M.w <= w && M.h <= h) { D = M; break; } }
    const best = (font, max) => { for (let sc = max; sc >= 1; sc--) { const M = font(s); if (M.w * sc <= w && M.h * sc <= h) return scaled(M, sc); } return null; };
    const P5 = face !== 'px3' ? best(px5, 4) : null, P3 = best(px3, 3);
    // a display face below ~26 px closes its counters into blobs at this grain: the largest CRISP option wins (a display face from 26 px,
    // else the 5 × 7, else the 3 × 5 at up to 3×); a small display face is the last resort. Masks say whether they are crisp, so a layout
    // can prefer more lines of clean type to one line of mush.
    const crisp = [D && D.h >= 26 ? D : null, P5, P3].filter(Boolean).sort((a, b) => b.h - a.h)[0];
    if (crisp) return Object.assign(Object.create(crisp), { crisp: true });
    return D ? Object.assign(Object.create(D), { crisp: false }) : null; }); }
export const scaled = (M, sc) => sc === 1 ? M : { w: M.w * sc, h: M.h * sc, at: (i, j) => M.at((i / sc) | 0, (j / sc) | 0), s: M.s };
// word-wrap into lines of a given font function that each fit w (greedy; words never split)
export function wrap(s, w, font = px5) { const out = []; let cur = ''; for (const word of String(s).split(' ')) { const t = cur ? cur + ' ' + word : word; if (!cur || font(t).w <= w) cur = t; else { out.push(cur); cur = word; } } if (cur) out.push(cur); return out; }

// ───────────────────────── chars.js characters, front view
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
function bodyPart(t, x, y) {   // chars.js build()'s rig split (hands and held things ride the arms)
  if (t === 'armL' || t === 'armR' || t === 'legL' || t === 'legR' || t === 'torso') return t;
  if (t === 'hands' || t === 'held') return x < 0 ? 'armL' : 'armR';
  if (t === 'shoes') return x < 0 ? 'legL' : 'legR';
  if (t === 'bottom') return y >= 10 ? 'torso' : (x < 0 ? 'legL' : 'legR');
  const armZone = (x <= -6 || x >= 5) && y >= 4;
  if ((t === 'base' && y < 10 || t === 'top' && y < 9) && !armZone) return x < 0 ? 'legL' : 'legR';
  if (armZone && y < 18) return x < 0 ? 'armL' : 'armR';
  return 'torso';
}
const RARE = new Set(['emoji', 'noob', 'alien', 'bsod', 'dialog', 'chrome', 'happymac', 'sadmac', 'missing']);
// a look from a spec: { handle } (the named cast), { roll: seed } (chars.js rollLook; rare species re-rolled unless o.rare), or a look object
export function lookOf(spec) {
  if (!spec) return null; if (spec.top && spec.skin) return spec; if (!CH) return null;
  if (spec.handle) { const L = CH.LOOKS.find(x => x.handle === spec.handle); return L ? structuredClone(L) : null; }
  let s = (spec.roll >>> 0) & 0xffffff; for (let t = 0; t < 12; t++) { const L = CH.rollLook(s); if (spec.rare || !RARE.has(L.skin)) return L; s = (s * 7 + 13) & 0xffffff; } return CH.rollLook(s);
}
export const lookKey = spec => !spec ? '-' : spec.handle ? 'h:' + spec.handle : spec.roll !== undefined ? 'r:' + (spec.roll >>> 0) + (spec.rare ? 'r' : '') : 'o:' + (spec.handle || JSON.stringify(spec).length);
// POSES (2D, about the shoulder): stand · point (the arm on side o.side swings out level, toward the copy) · up (that arm raised) · both (both up)
const SHOULDER = { armL: [-6, 16], armR: [5.5, 16] };
export function charImg(spec, o = {}) {
  const pose = o.pose || 'stand', side = o.side ?? 1, crop = o.crop || 'full';
  return memo(`c|${lookKey(spec)}|${pose}|${side}|${crop}`, () => {
    const L = lookOf(spec); if (!L || !CH || !CH.compose) return Object.assign(new Img(1, 1), { feet: 1, headTop: 0, cx: 0 });
    const { H, B, SH, F, tag } = CH.compose(L), px = new Map();   // key "x,y" → [z, c, l]   (SH: the fresh construction's shoes, a grid of their own)
    const put = (x, y, z, c, l) => { const k = x + ',' + y, p = px.get(k); if (!p || z >= p[0]) px.set(k, [z, c, l]); };
    const arm = { armL: [], armR: [] };
    B.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = dec(k), part = bodyPart(tag.get(k) || 'base', x, y); if (arm[part]) arm[part].push([x, y, z, c, li]); else put(x, y, z, c, li); } });
    for (const G of SH ? [H, F, SH] : [H, F]) G.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = dec(k); put(x, y, z, c, li); } });
    // arms: rotate in the picture plane about the shoulder (nearest-pixel inverse map, so a raised arm has no holes)
    for (const name of ['armL', 'armR']) { const vs = arm[name], sgn = name === 'armR' ? 1 : -1; let th = 0;
      if (pose === 'point' && sgn === side) th = sgn * 1.45; if (pose === 'up' && sgn === side) th = sgn * 2.25; if (pose === 'both') th = sgn * 2.25;
      if (!th) { for (const v of vs) put(...v); continue; }
      const [cx, cy] = SHOULDER[name], src = new Map(); for (const [x, y, z, c, l] of vs) { const k = x + ',' + y, p = src.get(k); if (!p || z >= p[0]) src.set(k, [z, c, l]); }
      const cs = Math.cos(th), sn = Math.sin(th), pts = [...src.keys()].map(k => k.split(',').map(Number));
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { const X = cx + (x - cx) * cs - (y - cy) * sn, Y = cy + (x - cx) * sn + (y - cy) * cs; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
      for (let Y = Math.floor(y0) - 1; Y <= Math.ceil(y1) + 1; Y++) for (let X = Math.floor(x0) - 1; X <= Math.ceil(x1) + 1; X++) { const dx = X - cx, dy = Y - cy, sx = Math.round(cx + dx * cs + dy * sn), sy = Math.round(cy - dx * sn + dy * cs), p = src.get(sx + ',' + sy);
        if (p) put(X, Y, p[0] + 3, p[1], p[2]); } }   // (a swung arm is in front of the body)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const k of px.keys()) { const [x, y] = k.split(',').map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const yc = crop === 'bust' ? 10 : crop === 'head' ? 18 : crop === 'chest' ? 13 : y0, I = new Img(x1 - x0 + 1, y1 - Math.max(y0, yc) + 1);
    for (const [k, [z, c, l]] of px) { const [x, y] = k.split(',').map(Number); if (y < yc) continue;
      // toon depth cue, no outline: a pixel well behind its neighbours (a sleeve under the chin, the neck) is a shade darker
      let zm = z; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = px.get((x + dx) + ',' + (y + dy)); if (q) zm = Math.max(zm, q[0]); }
      I.set(x - x0, y1 - y, zm - z > 3 && l !== 3 ? shade(c, .8) : c, l); }
    I.feet = y1 - Math.max(y0, yc) + 1; I.headTop = 0; I.cx = -x0; return I; }); }
// a look for an ad: a named cast member or a rolled one (never a rare species unless asked)
export const castLook = (seed, pool) => pool && pool.length ? { handle: pool[(seed >>> 0) % pool.length] } : { roll: (seed * 2654435761) >>> 8 };
export const STREET_CAST = ['bail.money', 'late.night', '56kballer', 'anon_inc', 'tag.crew', 'county.blues', 'bluescreen.bucket', 'xXbadvibesXx', 'www.girl', 'rawr_means_404', 'dealwithit.mp3'];

// ───────────────────────── product icons (pixel art; '.' = clear; letters from the legend)
const P = { K: INK, W: WHITE, w: 0xdcd6c8, Y: 0xffe23a, y: 0xe7bd4a, O: 0xff7a1a, o: 0xc9782a, R: 0xe8232a, r: 0x9a1418, G: 0x14a83b, g: 0x6cff4a, B: 0x2f5bff, b: 0x1d3aa8,
  C: 0x2de2e6, P: 0xff4fa3, V: 0x7a3cff, S: 0xb9bec6, s: 0x7c808a, N: 0x8b4a24, n: 0x5a3a22, T: 0xf1c9aa, E: 0x3a3a42, L: 0x9fd8ff, D: 0xd9a05b };
const ICON_SRC = {
  drumstick: ['......oooo....', '....oOOOOOo...', '...oOODOOOOo..', '..oOOOOOODOOo.', '..oODOOOOOOOo.', '..oOOOOODOOOo.', '...oOOOOOOOo..', '....oOODOOo...', '.....ooOoo....', '......Wwo.....', '.......Ww.....', '........WW....', '.......WWWW...', '........WWW...'],
  slice: ['oooooooooooo', 'oDDDDDDDDDDo', '.YYRYYYYRYY.', '.YRRYYYYYYY.', '..YYYYRRYY..', '..YYYYRRYY..', '...YRYYYY...', '...YYYYYY...', '....YYRY....', '....YYYY....', '.....YY.....', '.....YY.....'],
  bottle: ['....KK....', '....SS....', '....NN....', '...NNNN...', '...NNNN...', '..NNNNNN..', '..NNNNNN..', '..YYYYYY..', '..YRRRRY..', '..YRWWRY..', '..YRRRRY..', '..YYYYYY..', '..NNNNNN..', '..NNNNNN..', '..nnnnnn..'],
  can: ['.SSSSSS.', 'SSSSSSSS', 'RRRRRRRR', 'RWWRRRRR', 'RRRYYRRR', 'RRYYYYRR', 'RRRYYRRR', 'RRRRRWWR', 'RRRRRRRR', 'SSSSSSSS', '.SSSSSS.'],
  diamond: ['..BBBBBB..', '.BLWLLWLB.', 'BLLLLLLLLB', 'BCCBCCBCCB', '.BCCCCCCB.', '..BCCCCB..', '...BCCB...', '....BB....'],
  chain: ['y..........y', '.y........y.', '..y......y..', '...y....y...', '....yyyy....', '...yyyyyy...', '..yyYYYYyy..', '..yYYKKYYy..', '..yYKYYYYy..', '..yYYKKYYy..', '..yYYYYKYy..', '..yYKKKYYy..', '...yyyyyy...'],
  dice: ['WWWWWW......', 'WKWWKW......', 'WWWWWW.RRRRRR', 'WKWWKW.RWRRWR', 'WWWWWW.RRRRRR', 'WKWWKW.RRWRRR', '.......RRRRRR', '.......RWRRWR', '.......RRRRRR'],
  ball: ['...WWWW...', '.WWWWWWWW.', 'WWWRRRRWWW', 'WWRWWWWRWW', 'WWRWKKWRWW', 'WWRWKKWRWW', 'WWRWWWWRWW', 'WWWRRRRWWW', '.WWWWWWWW.', '...WWWW...'],
  grill: ['..RRRRRRRR..', '.RRRRRRRRRR.', 'RRyWyWyWyWRR', 'RRyWyWyWyWRR', 'RRRRRRRRRRRR', 'RRWyWyWyWyRR', '.RRRRRRRRRR.', '..RRRRRRRR..'],
  phone: ['.KKKKKK.', 'KSSSSSSK', 'KSLLLLSK', 'KSLLLLSK', 'KSLLLLSK', 'KSSSSSSK', 'KKKKKKKK', 'KSWSWSWK', 'KSSSSSSK', 'KSWSWSWK', 'KSSSSSSK', 'KSWSWSWK', '.KKKKKK.'],
  key: ['..yyyy.........', '.y....y........', 'y..yy..yyyyyyyy', 'y..yy..yyyyyyyy', '.y....y....y.yy', '..yyyy.....y..y'],
  badge: ['.....yy.....', '..yyyyyyyy..', '.yyYYYYYYyy.', '.yYYBBBBYYy.', '.yYBBYYBBYy.', '.yYBYYYYBYy.', '.yYBBYYBBYy.', '.yYYBBBBYYy.', '..yYYYYYYy..', '...yYYYYy...', '....yYYy....', '.....yy.....'],
  gavel: ['.nNNNNNn......', '.NDDNNDDN.....', '.NDDNNDDN.....', '.nNNNNNn......', '....NN........', '.....NN.......', '......NN......', '.......NN.....', '........NN....', '....nnnnnnn...', '...nNNNNNNNn..'],
  cuffs: ['.SSSS....SSSS.', 'S....S..S....S', 'S....SSSS....S', 'S....S..S....S', '.SSSS....SSSS.'],
  house: ['.....RR.....', '....RRRR....', '...RRRRRR...', '..RRRRRRRR..', '.RRRRRRRRRR.', 'RRRRRRRRRRRR', '.WWWWWWWWWW.', '.WLLWWWWLLW.', '.WLLWNNWLLW.', '.WWWWNNWWWW.', '.WWWWNNWWWW.'],
  tower: ['.....K......', '.....K......', '....KKK.....', '....KyK..KKK', '...KKKKK.KyK', '...KyKyK.KKK', 'KKKKKKKK.KyK', 'KyKKyKyK.KKK', 'KKKKKKKKKKyK', 'KyKKyKyKKKKK', 'KKKKKKKKKKyK'],
  cross: ['....RR....', '....RR....', 'RRRRRRRRRR', 'RRRRRRRRRR', '....RR....', '....RR....', '....RR....', '....RR....'],
  mic: ['..SSSS..', '.SsSsSS.', '.SSsSsS.', '.SsSsSS.', '..SSSS..', '...KK...', '...KK...', '...KK...', '...KK...', '..KKKK..'],
  glove: ['..RRRRR..', '.RRRRRRR.', 'RRRRRRRRR', 'RRRRRRRRR', 'rRRRRRRRR', 'rrRRRRRRR', '.RRRRRRR.', '.WWWWWWW.', '.WWWWWWW.'],
  record: ['...KKKK...', '.KKEKKEKK.', 'KKEKKKKEKK', 'KEKKRRKKEK', 'KKKRWWRKKK', 'KKKRWWRKKK', 'KEKKRRKKEK', 'KKEKKKKEKK', '.KKEKKEKK.', '...KKKK...'],
  slab: ['SSSSSSSS', 'SRRRRRRS', 'SWKWKWWS', 'SSSSSSSS', 'SLLLLLLS', 'SLPPPPLS', 'SLPYYPLS', 'SLPYYPLS', 'SLPPPPLS', 'SLLLLLLS', 'SSSSSSSS'],
  sneaker: ['.....KKKK.......', '....KWWWK.......', '....KWRWWK......', '...KWWRRWWK.....', '...KWWWRRWWWK...', '..KWWWWWRRWWWWK.', '..KRRRRRRRRRRRK.', '..KKKKKKKKKKKKK.'],
  crown: ['y...y...y', 'yy.yyy.yy', 'yyyyyyyyy', 'yRyyByyRy', 'yyyyyyyyy', 'yyyyyyyyy'],
  star: ['....Y....', '....Y....', '...YYY...', 'YYYYYYYYY', '.YYYYYYY.', '..YYYYY..', '..YY.YY..', '.YY...YY.'],
  cash: ['GGGGGGGGGGGG', 'GgGGGGGGGGgG', 'GGGGgYYgGGGG', 'GGGGgYYgGGGG', 'GgGGGGGGGGgG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'gggggggggggg'],
  hook: ['...SSS..', '...S.S..', '...SSS..', '....S...', '....S...', 'S...S...', 'SS..S...', '.SSSS...'],
  tire: ['..KKKKK..', '.KKKKKKK.', 'KKKSSSKKK', 'KKSSKSSKK', 'KKSKKKSKK', 'KKSSKSSKK', 'KKKSSSKKK', '.KKKKKKK.', '..KKKKK..'],
  flame: ['....R....', '...RR....', '...RRR...', '..RROR.R.', '.RROOORR.', '.ROOYOOR.', 'RROYYYORR', 'ROOYYYOOR', 'ROYYWYYOR', '.RYYYYYR.', '..RRRRR..'],
  bolt: ['....YYY', '...YYY.', '..YYY..', '.YYYYYY', '....YY.', '...YY..', '..YY...', '.YY....', 'Y......'],
  anchor: ['...SSS...', '...S.S...', '...SSS...', '.SSSSSSS.', '....S....', '....S....', 'S...S...S', 'SS..S..SS', '.SSSSSSS.'],
  wrench: ['SS.SS...', 'S...S...', 'SS.SS...', '.SSS....', '...SS...', '....SS..', '.....SS.', '......SS'],
  rat: ['.......sss..', '.....sssssS.', '...sssssssKs', 'P.sssssssssP', '.PsssssssS..', '..P.s..s....'],
  box: ['DDDDDDDDDD', 'DoooooooDD', 'DDDDDDDDDD', 'DDDDDDDDDD', 'DDDKKKKDDD', 'DDDDDDDDDD', 'DDDDDDDDDD', 'oooooooooo'],
  tooth: ['.WWW.WWW.', 'WWWWWWWWW', 'WWWWWWWWW', 'WWWWWWWWW', '.WWWWWWW.', '.WWW.WWW.', '.WW...WW.', '.W.....W.'],
  eye: ['...KKKKK...', '.KKWWWWWKK.', 'KWWWBBBWWWK', 'KWWBBKBBWWK', 'KWWWBBBWWWK', '.KKWWWWWKK.', '...KKKKK...'],
  scissors: ['S.......S', '.S.....S.', '..S...S..', '...S.S...', '....S....', '...R.R...', '.RRR.RRR.', 'R..R.R..R', '.RR...RR.'],
  horse: ['.......KK..', '......KKKK.', '.....KKKKKK', '.KKKKKKK...', 'KKKKKKKKK..', 'KKKKKKKK...', '.K.K..K.K..', '.K.K..K.K..'],
  fish: ['.....SSSS....', 'S..SSSSSSSS..', 'SS.SSSSSSSKS.', '.SSSSSSSSSSSS', 'SS.SSSSSSSSS.', 'S..SSSSSSSS..', '.....SSSS....'],
  tv: ['..K...K...', '...K.K....', 'KKKKKKKKKK', 'KLLLLLLLKK', 'KLLLLLLLKS', 'KLLLLLLLKK', 'KLLLLLLLKS', 'KKKKKKKKKK', '.K......K.'],
  dog: ['.......NN.', '......NNNK', 'N.....NNNN', '.NNNNNNNN.', '.NNNNNNN..', '.N.N..N.N.', '.N.N..N.N.'],
  bus: ['BBBBBBBBBBBB', 'BLLBLLBLLBLB', 'BLLBLLBLLBLB', 'BBBBBBBBBBBB', 'BBYBBBBBBBBB', 'BBBBBBBBBBBB', '.KK.....KK..'],
  hardhat: ['...YYYY...', '..YYYYYY..', '.YYYYYYYY.', '.YYYyYYYY.', 'YYYYYYYYYY', 'yyyyyyyyyy'],
  heart: ['.RR...RR.', 'RRRR.RRRR', 'RRRRRRRRR', 'RRRRRRRRR', '.RRRRRRR.', '..RRRRR..', '...RRR...', '....R....'],
  cone: ['...OO...', '...OO...', '..OWWO..', '..OOOO..', '.OWWWWO.', '.OOOOOO.', 'OOOOOOOO', 'KKKKKKKK'],
  money: ['..YYYY..', '.YYKYYY.', 'YYKKKKYY', 'YYKYYYYY', 'YYYKKYYY', 'YYYYYKYY', 'YYKKKKYY', '.YYYKYY.', '..YYYY..'],
};
export const ICONS = Object.keys(ICON_SRC);
export function iconImg(name, o = {}) { return memo(`i|${name}|${o.tint ?? ''}`, () => { const rows = ICON_SRC[name] || ICON_SRC.star, w = Math.max(...rows.map(r => r.length)), I = new Img(w, rows.length);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === '.') continue; let c = P[ch] ?? INK; if (o.tint && ch === 'Y') c = o.tint; I.set(i, j, c); } }); return I; }); }
