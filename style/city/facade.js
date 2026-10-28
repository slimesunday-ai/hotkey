// Facade vocabulary (pass 1b). Every axis varies independently: window style × cornice × ground floor × sign kind × wall paint,
// so combinations never visibly repeat. Frames come from kit.js (a along the wall, y up, d out of the wall; units = city voxels).
import { textMask } from './vox.js';
import { win, AIR, TOD, glass } from './kit.js';
import { PAL, hash, shade } from './style.js';
// pass 3 · signage: shopfronts, painted walls, ghost signs and murals come from the shared signage system (signage/, STYLE.md §12)
import { shopRun as shopRunSign, display as displaySign } from './signage/shop.js';
import { wallAd, wallMural, wallGhost } from './signage/index.js';
// walls pass: the paint layer on bare walls registers its hook (vox.js HOOKS.wall) when the facade vocabulary loads (every build loads it)
import './walls/index.js';
const TMC = new Map(), tm = s => { let m = TMC.get(s); if (!m) TMC.set(s, m = textMask(s)); return m; };
const LIGHT = new Set([0xffe23a, 0xffc21a, 0x2de2e6, 0x6cff4a, 0xf7f7f2, 0xfff0d0, 0xffffff]);
export const inkOn = c => LIGHT.has(c) ? PAL.ink : PAL.white;
const lit = () => TOD.night ? 3 : 0;
// fit text to a width: shorten words, then give up (returns '' when nothing fits)
export function fitText(s, maxW) { if (tm(s).w <= maxW) return s; const w = s.split(' ').filter(x => x !== 'THE' && x !== '&' && x !== '·');
  for (let n = w.length - 1; n > 0; n--) { const t = w.slice(0, n).join(' '); if (tm(t).w <= maxW) return t; } return w.find(x => x.length > 1 && tm(x).w <= maxW) ?? ''; }
// a name that fits, else the building's number (never a blank panel or a lone article)
export const nameOrNo = (s, maxW, seed) => { const t = s ? fitText(s, maxW) : ''; return t.length >= 3 ? t : String(100 + ((seed * 7919) >>> 0) % 899); };
export const textW = s => s && s.w0 !== undefined ? s.w0 : tm(s).w;   // pass 3: a lexicon trade answers with its pass-2 width (signage/lexicon.js trade)

// ───────────────────────── windows: 9 styles
export const WIN_STYLES = ['punched', 'arched', 'paired', 'tall', 'shutter', 'bay', 'balcony', 'loft', 'ribbon'];
export function windowRow(f, y0, fh, st, o) {   // one floor of windows across the facade; returns the window rects (for people / extras)
  const out = [], L = f.len, s = o.style, trim = o.trim, seed = o.seed;
  if (s === 'ribbon') { const y = y0 + 7, h = 14; f.box(3, y, -2, L - 3, y + h, 2, AIR); f.box(3, y, -3, L - 3, y + h, -2, (a, yy) => (a % 16 === 3) ? trim : glass(16, h, TOD.night && hash(a >> 4, y0, seed) > .45)(a % 16, yy - y), 1);
    f.box(2, y - 2, 0, L - 2, y, 3, o.accent); f.box(2, y + h, 0, L - 2, y + h + 1, 2, trim); out.push({ a0: 6, a1: L - 6, y }); return out; }
  const bw = s === 'loft' ? 30 : s === 'paired' ? 32 : s === 'tall' ? 22 : s === 'bay' ? 34 : 26, ww = s === 'loft' ? 20 : s === 'tall' ? 11 : 13, wh = s === 'tall' ? 21 : s === 'loft' ? 20 : 17;
  const n = Math.max(1, Math.floor((L - 4) / bw)), m = Math.floor((L - n * bw) / 2);
  for (let k = 0; k < n; k++) { const a0 = m + k * bw, cx = a0 + (bw >> 1), h1 = hash(a0, y0, seed), h2 = hash(y0, a0, seed + 7);
    if (o.skip && o.skip(a0, a0 + bw)) continue;
    const extra = { ac: s !== 'loft' && s !== 'bay' && h1 > .8, box: (s === 'punched' || s === 'shutter' || s === 'tall') && h2 > .78 };
    if (s === 'paired') { for (const d of [-8, 1]) win(f, cx + d, y0 + 7, 7, wh, trim, { ac: d > 0 && extra.ac }); out.push({ a0: cx - 8, a1: cx + 8, y: y0 + 7 }); f.box(cx - 10, y0 + 5, 0, cx + 10, y0 + 6, 3, trim); continue; }
    if (s === 'bay') { const w2 = 24, b0 = cx - 12; f.box(b0, y0 + 2, 0, b0 + w2, y0 + 27, 5, o.bayCol); f.box(b0 - 1, y0 + 26, 0, b0 + w2 + 1, y0 + 28, 6, trim); f.box(b0 - 1, y0 + 1, 0, b0 + w2 + 1, y0 + 3, 6, trim);
      for (const [wa, ww2] of [[b0 + 2, 8], [b0 + 14, 8]]) { f.box(wa, y0 + 7, 2, wa + ww2, y0 + 23, 6, AIR); f.box(wa, y0 + 7, 1, wa + ww2, y0 + 23, 2, (a, y) => glass(ww2, 16, TOD.night && hash(wa, y0, seed) > .5)(a - wa, y - y0 - 7), 1); f.box(wa, y0 + 15, 2, wa + ww2, y0 + 16, 3, trim); }
      out.push({ a0: b0 + 2, a1: b0 + 22, y: y0 + 7, bay: true }); continue; }
    const wa = cx - (ww >> 1); win(f, wa, y0 + 7, ww, wh, trim, extra); out.push({ a0: wa, a1: wa + ww, y: y0 + 7, ac: extra.ac });   // (cleanup pass: ac — nobody leans out of a window with an AC unit in it)
    if (s === 'arched') { for (let t = 0; t < 4; t++) f.box(wa - 2 + t, y0 + 7 + wh + 1 + t, 0, wa + ww + 2 - t, y0 + 7 + wh + 2 + t, 2, trim); f.box(cx - 1, y0 + 7 + wh + 1, 0, cx + 2, y0 + 7 + wh + 6, 3, shade(trim, .9)); }
    if (s === 'tall') f.box(wa - 3, y0 + 7 + wh + 1, 0, wa + ww + 3, y0 + 7 + wh + 4, 3, trim);
    if (s === 'shutter') for (const sa of [wa - 5, wa + ww + 1]) f.box(sa, y0 + 7, 0, sa + 4, y0 + 7 + wh, 1, (a, y) => (y % 3 === 0) ? shade(o.accent, .8) : o.accent);
    if (s === 'balcony' && (k + (y0 >> 5)) % 2 === 0) { f.box(wa - 4, y0 + 5, 0, wa + ww + 4, y0 + 6, 7, PAL.iron); f.box(wa - 4, y0 + 6, 6, wa + ww + 4, y0 + 15, 7, (a, y) => (a % 2 === 0 || y === y0 + 14) ? PAL.iron : undefined);
      for (const sa of [wa - 4, wa + ww + 3]) f.box(sa, y0 + 6, 0, sa + 1, y0 + 15, 7, (a, y, d) => (d % 2 === 0 || y === y0 + 14) ? PAL.iron : undefined); if (h2 > .5) f.box(wa - 3, y0 + 6, 3, wa, y0 + 10, 6, 0xd9643a); }
    if (s === 'loft') for (let a = wa + 5; a < wa + ww; a += 5) f.box(a, y0 + 7, -2, a + 1, y0 + 7 + wh, -1, PAL.ink);
    // per-window life: curtains, a plant, a boarded window, a flag, a cat, fairy lights
    const h3 = hash(a0 * 7, y0 * 3, seed + 3);
    if (s !== 'loft' && h3 < .16) f.box(wa, y0 + 7, -2, wa + (ww >> 1), y0 + 7 + wh, -1, o.curtain[(a0 + y0) % o.curtain.length], TOD.night ? 3 : 0);
    else if (h3 < .2) { f.box(wa - 1, y0 + 6, 0, wa + ww + 1, y0 + 8 + wh, 2, 0xc98a4b); for (let y = y0 + 9; y < y0 + 7 + wh; y += 5) f.box(wa - 1, y, 2, wa + ww + 1, y + 1, 3, 0xa4652f); out.pop(); }
    else if (h3 < .24) { f.box(wa + 2, y0 + 7, 1, wa + 4, y0 + 7 + 3, 3, 0xd9643a); f.box(wa + 1, y0 + 10, 1, wa + 5, y0 + 14, 3, 0x2fbf55); }
    else if (h3 < .27 && ww >= 12) { f.box(wa - 1, y0 + 2, 1, wa + ww + 1, y0 + 6, 2, [PAL.red, 0x2f5bff, PAL.green, PAL.yellow][(a0 >> 2) & 3]); f.box(wa + 3, y0 + 3, 2, wa + ww - 3, y0 + 5, 2 + 1, PAL.white); }
    else if (h3 < .3) { f.box(wa + 3, y0 + 4, 1, wa + 7, y0 + 7, 4, [0x17171b, 0xff9f45, 0xf7f7f2][(a0 >> 3) % 3]); f.box(wa + 3, y0 + 7, 3, wa + 5, y0 + 9, 4, [0x17171b, 0xff9f45, 0xf7f7f2][(a0 >> 3) % 3]); }
  }
  if (o.lights && st > 1) for (let a = 2; a < L - 2; a++) { const y = y0 + 3 + Math.round(Math.sin(a / 6) * 1.5); f.set(a, y, 2, a % 3 ? PAL.iron : [PAL.yellow, PAL.pink, PAL.cyan, PAL.lime][(a / 3 | 0) % 4], a % 3 ? 0 : 3); }
  return out;
}

// ───────────────────────── cornices: 7 kinds (drawn over kit.mass's plain parapet)
export const CORNICES = ['bracket', 'band', 'deco', 'crenel', 'pediment', 'thin', 'sign'];
export function cornice(f, H, ph, kind, trim, wall, o = {}) {
  const L = f.len;
  if (kind === 'bracket') { f.box(-1, H - 5, 0, L + 1, H - 1, 2, trim); f.box(-2, H - 3, 0, L + 2, H - 1, 3, trim); for (let a = 1; a < L - 1; a += 4) f.box(a, H - 8, 0, a + 2, H - 4, 3, trim); }
  else if (kind === 'band') { f.box(-1, H - 4, 0, L + 1, H - 1, 2, trim); f.box(-1, H - 10, 0, L + 1, H - 9, 1, trim); }
  else if (kind === 'crenel') { f.box(-1, H - 3, 0, L + 1, H - 1, 2, trim); for (let a = 0; a < L; a += 6) f.box(a, H + ph, 0, a + 3, H + ph + 4, 2, wall); }
  else if (kind === 'thin') f.box(-1, H + ph - 1, 0, L + 1, H + ph + 1, 3, PAL.ink);
  else if (kind === 'deco' || kind === 'pediment' || kind === 'sign') {
    f.box(-1, H - 4, 0, L + 1, H - 1, 2, trim); const mid = L >> 1, t = tm(nameOrNo(o.plaque || '', L - 16, H * 31 + L)), pw = Math.max(t.w + 8, 24);
    if (kind === 'pediment') { for (let k = 0; k < 10; k++) f.box(mid - pw / 2 - 4 + k * 2, H + ph + k, 0, mid + pw / 2 + 4 - k * 2, H + ph + k + 1, 2, k % 3 === 2 ? trim : wall); f.box(mid - 3, H + ph + 2, 1, mid + 3, H + ph + 7, 3, trim); }
    else { const ph2 = kind === 'sign' ? 12 : 10; f.box(mid - (pw >> 1), H + ph - 1, 0, mid + (pw >> 1), H + ph + ph2, 2, kind === 'sign' ? o.signCol ?? trim : wall); f.box(mid - (pw >> 1) - 1, H + ph + ph2, 0, mid + (pw >> 1) + 1, H + ph + ph2 + 2, 3, trim);
      if (kind === 'deco') for (const s of [-1, 1]) f.box(mid + s * (pw >> 1) + (s < 0 ? -6 : 0), H + ph - 1, 0, mid + s * (pw >> 1) + (s < 0 ? 0 : 6), H + ph + 5, 2, wall);
      if (t && t.w > 0) f.mask(t, mid - (t.w >> 1), H + ph + ph2 - 2, 2, 3, kind === 'sign' ? inkOn(o.signCol ?? trim) : trim, 0); }
  }
  f.box(-1, H + ph - 1, 0, L + 1, H + ph + 1, 2, kind === 'thin' ? PAL.ink : trim);
}

// ───────────────────────── shopfronts: continuous runs, 6 sign kinds, window displays, gates, stickers
export const SIGN_KINDS = ['band', 'box', 'awnBox', 'awnSlope', 'neon', 'blade'];
// pass 3 · the shopfront (names, window display, card, vinyl, blade) lives in signage/shop.js; same envelopes as pass 2
export const shopRun = shopRunSign;
export const display = displaySign;
// residential entry (no stoop): door, intercom, lamp pair, optional name canopy; returns door centre
export function resiEntry(f, a, o) {
  f.box(a - 1, 0, 0, a + 15, 28, 3, o.trim); f.box(a + 1, 1, -3, a + 13, 25, 3, AIR); f.box(a + 1, 1, -4, a + 13, 25, -3, (aa, y) => y > 20 ? 0xffe3a0 : o.door, 1); f.box(a + 11, 11, -3, a + 12, 13, -2, PAL.gold, 2);
  for (const la of [a - 3, a + 15]) { f.box(la, 17, 3, la + 2, 22, 5, PAL.iron); f.box(la, 18, 5, la + 2, 21, 6, 0xfff3c4, TOD.night ? 3 : 1); }
  f.box(a + 14, 9, 3, a + 15, 14, 4, 0xc9ced6, 2);
  if (o.canopy) { const t = nameOrNo(o.canopy, 20, a * 13 + 7); f.box(a - 4, 27, 3, a + 18, 31, 22, o.canopyCol); f.box(a - 4, 22, 20, a + 18, 31, 22, o.canopyCol);   // pass 1d: a 0.9 m fascia carries the name
    for (const la of [a - 4, a + 17]) f.box(la, 0, 21, la + 1, 22, 22, PAL.gold, 2); if (t) f.text(t, a + 7, 30, 22, 23, PAL.white, lit(), 1, 1); }
  return a + 7;
}

// ───────────────────────── wall paint: murals, ghost signs, painted ads, pipes (drawn flush on d = 0, a few with 1-voxel relief)
// pass 3 · signage: 'face' is the block's character mural (signage: the Dazed format or a character-led ad), 'paste' a wheat-paste row,
// 'bigad' a big painted ad; the rest are painted art. (The eye and the cursor murals are gone: the cursor was an internet shout-out.)
export const MURALS = ['face', 'sunset', 'checker', 'tag', 'heart', 'paste', 'bigad', 'money', 'stripes', 'flowers'];
export function mural(f, a0, y0, w, h, kind, seed, cols) {
  if (kind === 'face' || kind === 'paste' || kind === 'bigad') { if (wallMural(f, kind, a0, y0, w, h, seed)) return; kind = 'sunset'; }   // pass 3: signage (an empty pool paints art)
  const P = (a, y, c) => f.set(a, y, 0, c), cx = a0 + (w >> 1), cy = y0 + (h >> 1), r = Math.min(w, h) / 2 - 2;
  f.box(a0, y0, 0, a0 + w, y0 + h, 1, cols[0]);
  if (kind === 'face') {   // a big-head character portrait, toon flat: head, hair, eyes, mouth, chain
    const hw = Math.min(w - 8, Math.round(h * .75)), hx = cx - (hw >> 1), hy = y0 + Math.round(h * .22), hh = Math.round(hw * .82), skin = [0xffc21a, 0xe0a070, 0x8b5a3a, 0xc98a5b, 0x9fd8ff][seed % 5];
    f.box(hx, hy, 0, hx + hw, hy + hh, 1, skin); f.box(hx - 2, hy + hh - 5, 0, hx + hw + 2, hy + hh + 4, 1, [0x17171b, 0xffe23a, 0xff4fa3, 0x6cff4a][seed % 4]);
    const ey = hy + Math.round(hh * .52), ew = Math.max(3, Math.round(hw * .16)); for (const s of [-1, 1]) { f.box(cx + s * Math.round(hw * .22) - (ew >> 1), ey, 0, cx + s * Math.round(hw * .22) + (ew >> 1) + 1, ey + ew, 2, PAL.white); f.box(cx + s * Math.round(hw * .22) - (s > 0 ? 0 : 1), ey, 0, cx + s * Math.round(hw * .22) + (s > 0 ? 1 : 0) + 1, ey + (ew >> 1) + 1, 2, PAL.ink); }
    if (seed % 3 === 0) f.box(hx + 2, ey - 1, 0, hx + hw - 2, ey + ew + 1, 2, PAL.ink);
    f.box(cx - Math.round(hw * .18), hy + Math.round(hh * .2), 0, cx + Math.round(hw * .18), hy + Math.round(hh * .2) + 2, 2, [PAL.ink, 0xe7bd4a, 0xe8232a][seed % 3]);
    f.box(hx + 2, y0 + 2, 0, hx + hw - 2, hy, 1, cols[1]); for (let a = hx + 4; a < hx + hw - 4; a++) P(a, hy - 3 - Math.round(Math.abs(a - cx) * .3), 0xe7bd4a);
  } else if (kind === 'sunset') { for (let y = y0; y < y0 + h; y++) { const t = (y - y0) / h; f.box(a0, y, 0, a0 + w, y + 1, 1, t < .5 ? [0xff4fa3, 0xff7a1a][((y - y0) / 3 | 0) % 2] : [0xffe23a, 0x2de2e6, 0x2f5bff][(t * 6 | 0) % 3]); }
    for (let a = -r; a <= r; a++) for (let y = 0; y <= r * .9; y++) if (a * a + y * y <= r * r * .8) P(cx + a, y0 + (h >> 2) + y, ((y >> 1) & 1) ? 0xffe23a : 0xff7a1a);
  } else if (kind === 'checker') { f.box(a0, y0, 0, a0 + w, y0 + h, 1, (a, y) => (((a - a0) >> 2) + ((y - y0) >> 2)) & 1 ? cols[1] : cols[2]); }
  else if (kind === 'stripes') { f.box(a0, y0, 0, a0 + w, y0 + h, 1, (a, y) => [0xe8232a, 0xff7a1a, 0xffe23a, 0x25b84c, 0x2f5bff, 0x7a3cff][(((a - a0) + (y - y0)) >> 2) % 6]); }
  else if (kind === 'heart' || kind === 'eye' || kind === 'cursor' || kind === 'money') {
    for (let a = a0 + 1; a < a0 + w - 1; a++) for (let y = y0 + 1; y < y0 + h - 1; y++) { const x = (a - cx) / r, yy = (y - cy) / r; let c = null;
      if (kind === 'heart') { const q = x * x + (yy * 1.2 - Math.sqrt(Math.abs(x)) * .6) ** 2; if (q < .8) c = q < .5 ? 0xe8232a : 0xff4fa3; }
      else if (kind === 'eye') { const e = x * x + yy * yy * 3.2; if (e < 1) { const rr = Math.hypot(x, yy); c = rr < .18 ? PAL.ink : rr < .4 ? cols[1] : PAL.white; } }
      else if (kind === 'cursor') { const u = (a - (cx - r * .5)) / r, v = (cy + r * .8 - y) / r; if (u >= 0 && v >= 0 && u <= v * .7 && v < 1.4 || (u > .2 && u < .5 && v > 1 && v < 1.9 && u > (v - 1) * .3)) c = (u < .08 || v > 1.3 || u > v * .7 - .08) ? PAL.ink : PAL.white; }
      else { if (Math.abs(x) < .95 && Math.abs(yy) < .55) c = (Math.abs(x) > .85 || Math.abs(yy) > .45) ? 0x0b5a3a : 0x25b84c; if (Math.hypot(x, yy) < .3) c = 0x0b5a3a; }
      if (c !== null) P(a, y, c); }
    if (kind === 'money') { const t = tm('$'); f.mask(t, cx - 2, cy + 4, 0, 1, 0x9fe89a, 0); }
  } else if (kind === 'flowers') { for (let k = 0; k < Math.max(3, (w * h / 120) | 0); k++) { const fx = a0 + 3 + ((hash(seed, k) * (w - 6)) | 0), fy = y0 + 3 + ((hash(seed, k, 1) * (h - 6)) | 0), c = [0xff4fa3, 0xffe23a, 0xe8232a, 0xf7f7f2][k % 4];
    for (const [dx, dy] of [[0, 2], [2, 0], [0, -2], [-2, 0]]) f.box(fx + dx - 1, fy + dy - 1, 0, fx + dx + 1, fy + dy + 1, 1, c); f.box(fx - 1, fy - 1, 0, fx + 1, fy + 1, 1, 0xffc21a); f.box(fx, fy - 8, 0, fx + 1, fy - 2, 1, 0x1d8f3c); } }
  else { const t = tm(cols[3] || 'WILD'), sc = Math.max(1, Math.min(Math.floor((w - 4) / t.w), Math.floor((h - 4) / 7))); f.mask(t, cx - ((t.w * sc) >> 1) + 1, cy + ((7 * sc) >> 1) - 1, 0, 2, PAL.ink, 0, sc); f.mask(t, cx - ((t.w * sc) >> 1), cy + ((7 * sc) >> 1), 0, 2, (i, j) => [0x6cff4a, 0x2de2e6, 0xff4fa3, 0xffe23a][(j * 2 / 7 | 0) % 4], 0, sc); }
  f.box(a0 - 1, y0 - 1, 0, a0 + w + 1, y0, 2, cols[3] && typeof cols[3] === 'number' ? cols[3] : PAL.ink);
}
// pass 3 · signage: a ghost sign (a faded heritage ad, allocated per block) and a painted wall ad (a design from the wall pool). A kit
// that passes its own words gets them painted as they are.
export function ghostSign(f, a0, y0, w, lines, wall) { return wallGhost(f, a0, y0, w, lines, wall, (a0 * 31 + y0 * 7 + (f.len | 0)) | 0); }
export function paintedAd(f, a0, y0, w, h, lines, bg, fg) { return wallAd(f, a0, y0, w, h, lines, bg, fg); }
export function pipes(f, a, y0, y1, c = 0x9a9aa6) { f.box(a, y0, 0, a + 2, y1, 2, c, 2); for (let y = y0 + 6; y < y1; y += 18) f.box(a - 1, y, 0, a + 3, y + 1, 3, c, 2); f.box(a, y0, 0, a + 5, y0 + 2, 2, c, 2); }
