// SIGNAGE · layouts (owner: the signage agent): one design → one flat image for any box. The same design reads as a rooftop board
// (76 × 36 at 0.1), a painted side wall (up to 90 × 120), a paste-up poster (≈ 28 × 36) or a bus-shelter lightbox (16 × 36 at 0.05).
// Every layout is Springfield: flat toon colour, bold type, a real chars.js character or a product icon, no outlines, no gradients.
//   paint(d, w, h, o) → Img of w × (h + o.ext): rows 0…ext-1 are ABOVE the frame (a character's head or a product breaking out of
//   a roof board: the builder makes them a cut-out); o.pal overrides the tone ({ bg, fg, acc }); o.lit = the layer of the words
//   that glow at night (3), else 0.
import { Img, px5, px3, fit, charImg, iconImg, wrap, INK, WHITE, CREAM, mix, shade, lum, inkOn } from './art.js';
import { hash } from '../style.js';
import { myIcon } from './icons.js';

export const TONE = { blue: [0x2f5bff, 0xffe23a, 0xe8232a], red: [0xe8232a, 0xf7f7f2, 0xffe23a], yellow: [0xffe23a, 0x17171b, 0xe8232a], ink: [0x17171b, 0xf7f7f2, 0xffe23a],
  gold: [0x17171b, 0xe7bd4a, 0xf7f7f2], green: [0x14a83b, 0xf7f7f2, 0xffe23a], pink: [0xff4fa3, 0xf7f7f2, 0x17171b], lime: [0x6cff4a, 0x17171b, 0xff4fa3], cyan: [0x2de2e6, 0x17171b, 0xe8232a],
  white: [0xf7f7f2, 0x17171b, 0xe8232a], orange: [0xff7a1a, 0x17171b, 0xf7f7f2], violet: [0x7a3cff, 0xffe23a, 0x2de2e6], cream: [0xfff0d0, 0x17171b, 0xe8232a], teal: [0x12b3a0, 0xf7f7f2, 0xffe23a] };
export function palOf(d, o = {}) { const [bg, fg, acc] = TONE[d.tone] || TONE.blue, p = { bg, fg, acc, ...(o.pal || {}) };
  if (p.acc === p.bg || Math.abs(lum(p.acc) - lum(p.bg)) < .12) p.acc = lum(p.bg) > .55 ? 0xe8232a : 0xffe23a; if (p.fg === p.bg || Math.abs(lum(p.fg) - lum(p.bg)) < .2) p.fg = inkOn(p.bg); return p; }
const H = (d, k) => hash((d.key || '').length * 131 + k, (d.key || '').charCodeAt(0) || 7, (d.key || '').charCodeAt(1) || 3);
const txt = s => String(s || '').replace(/\s+/g, ' ').trim();
const kick = (p) => p.acc === p.bg ? p.fg : p.acc;
// one line as big as fits (display face for big words, the crisp pixel fonts for small ones), centred in its box
function line(I, s, x, y, w, h, c, o = {}) { s = txt(s); if (!s || w < 3 || h < 5) return 0; const M = fit(s, w, h, o.face || 'impact', { max: o.max }); if (!M) return 0;
  const X = o.align === 'left' ? x : o.align === 'right' ? x + w - M.w : Math.round(x + (w - M.w) / 2), Y = o.valign === 'top' ? y : o.valign === 'bottom' ? y + h - M.h : Math.round(y + (h - M.h) / 2);
  I.text(M, X, Y, c, { l: o.l ?? 0, z: o.z ?? 0, shadow: o.shadow, label: s }); return M.h; }
// a coloured band with one line of words that never touch its edges: the words are fitted to the band's height h0, then the band is
// at least their height + 2 (it grows by 2 rows at most). Returns the band's height; words that don't fit leave a plain band of h0.
function band(I, s, x0, y, x1, h0, bg, fg, o = {}) { s = txt(s); const pad = o.pad ?? 1, M = s && fit(s, x1 - x0 - 2 * pad, h0, o.face || 'black', { max: o.max }), h = M ? Math.max(h0, M.h + 2) : h0;
  I.rect(x0, y, x1, y + h, bg); if (M) I.text(M, Math.round(x0 + (x1 - x0 - M.w) / 2), y + Math.round((h - M.h) / 2), fg, { l: o.l ?? 0, label: s }); return h; }
// the biggest words: 1 to 4 lines (split on spaces), whichever gives the tallest letters; centred in the box
function splits(words, k) { if (k === 1) return [[words.join(' ')]]; const out = []; for (let i = 1; i <= words.length - k + 1; i++) for (const rest of splits(words.slice(i), k - 1)) out.push([words.slice(0, i).join(' '), ...rest]); return out; }
function big(I, s, x, y, w, h, c, o = {}) { s = txt(s); if (!s) return 0; if (h < 5) { if (!o.soft) I.miss = true; return 0; } const words = s.split(' '), face = o.face || 'impact'; let best = null;
  for (let k = 1; k <= Math.min(4, words.length); k++) { const hh = Math.floor((h - (k - 1)) / k); if (hh < 5) break;
    for (const ls of splits(words, k)) { const Ms = ls.map(t => fit(t, w, hh, face, { max: o.max })); if (Ms.some(M => !M)) continue; const sz = Math.min(...Ms.map(M => M.crisp === false ? M.h * .6 : M.h)); if (!best || sz > best.sz + (k > best.k ? 1 : 0)) best = { sz, k, Ms }; } }
  if (!best) { if (!o.soft) I.miss = true; return 0; } const tot = best.Ms.reduce((a, M) => a + M.h, 0) + best.k - 1; let yy = o.valign === 'top' ? y : Math.round(y + (h - tot) / 2);
  for (const M of best.Ms) { I.text(M, Math.round(x + (w - M.w) / 2), yy, c, { l: o.l ?? 0, z: o.z ?? 0, shadow: o.shadow, label: s }); yy += M.h + 1; } return tot; }
const small = (s, w) => { s = txt(s); if (!s) return null; const a = px5(s); if (a.w <= w) return a; const b = px3(s); return b.w <= w ? b : null; };
function strip(I, y, h, bg, s, fg, o = {}) { s = txt(s); if (!s) return false; const F = [px5(s), px3(s)].filter(M => M.w <= I.w - 4), M = F.find(M => M.h + 2 <= h) || F.find(M => M.h <= h); if (!M) return false; I.rect(0, y, I.w, y + h, bg); I.text(M, Math.round((I.w - M.w) / 2), y + Math.round((h - M.h) / 2), fg, { l: o.l ?? 0, label: txt(s) }); return true; }
// a character sized to a box (integer scale, cropped to fit); o.fx mirrors
function person(I, look, x, y, w, h, o = {}) { if (!look) return null; const order = ['full', 'bust', 'chest', 'head']; let S = null, crop = null;
  for (let k = Math.max(0, order.indexOf(o.crop || 'full')); k < order.length; k++) { crop = order[k]; S = charImg(look, { pose: o.pose, side: o.side ?? 1, crop }); if (S.h <= h && S.w <= w + 4) break; }
  const sc = Math.max(1, Math.min(o.maxSc || 4, Math.floor(Math.min(h / S.h, (w + 4) / S.w)))), X = Math.round(x + (w - S.w * sc) / 2), Y = o.top ? y : y + h - S.h * sc;
  I.blit(S, X, Y, { sc, fx: o.fx }); return [X, Y, S.w * sc, S.h * sc, crop]; }
function icon(I, name, x, y, w, h, o = {}) { if (!name) return null; const S = myIcon(name) || iconImg(name), sc = Math.max(1, Math.min(o.maxSc || 6, Math.floor(Math.min(w / S.w, h / S.h)))), X = Math.round(x + (w - S.w * sc) / 2), Y = o.bottom ? y + h - S.h * sc : Math.round(y + (h - S.h * sc) / 2);
  I.blit(S, X, Y, { sc }); return [X, Y, S.w * sc, S.h * sc]; }
// the bottom strip (a phone number, else the small print), or nothing
const foot = d => d.tel || d.sub || '';

// ───────────────────────── the layouts (o: w, h, ext, lit)
const LAYOUT = {
  // a character panel on one side, the copy on the other, a phone strip across the bottom
  bust(I, d, p, o) { const { w, h } = o, e = o.ext, side = H(d, 1) < .5 ? 0 : 1, sh = h >= 26 && foot(d) ? Math.max(7, Math.round(h * .19)) : 0, ph = h - sh;
    if (w >= h * 1.2) { const pw = Math.min(Math.round(w * .38 * (o.k ?? 1)), Math.round(ph * .95)), px0 = side ? w - pw : 0, tx = side ? 2 : pw + 2, tw = w - pw - 4;
      I.rect(px0, e, px0 + pw, e + ph, p.acc === p.fg ? mix(p.bg, INK, .35) : p.acc); person(I, d.look, px0 + 1, e + 1, pw - 2, ph - 1, { crop: 'bust', fx: !side });
      let y = e + 2; if (d.top) y += line(I, d.top, tx, y, tw, Math.max(5, Math.round(ph * .24)), kick(p), { face: 'black', l: o.lit, valign: 'top' }) + 1;
      big(I, d.big, tx, y, tw, e + ph - y - 1, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK }); }
    else { const bh = Math.round(ph * .52); I.rect(0, e, w, e + bh, p.acc === p.fg ? mix(p.bg, INK, .35) : p.acc); person(I, d.look, 1, e + 1, w - 2, bh - 1, { crop: 'bust' });
      let y = e + bh + 1; if (d.top) y += line(I, d.top, 1, y, w - 2, Math.max(5, Math.round((ph - bh) * .22)), kick(p), { face: 'black', l: o.lit, valign: 'top' }) + 1;
      big(I, d.big, 1, y, w - 2, e + ph - y - 1, p.fg, { l: o.lit }); }
    if (sh) strip(I, e + ph, sh, INK, foot(d), WHITE, { l: o.lit }); },
  // the full character standing on the bottom strip (on a roof its head breaks out of the frame), the copy beside
  figure(I, d, p, o) { const { w, h } = o, e = o.ext, side = H(d, 2) < .5 ? 0 : 1, sh = h >= 26 && foot(d) ? Math.max(7, Math.round(h * .17)) : 0, fw = Math.round(w * (w > h ? .34 * (o.k ?? 1) : .9)), fx = side ? w - fw : 0;
    const sb = p.acc === p.bg ? INK : p.acc; if (sh) strip(I, e + h - sh, sh, sb, foot(d), inkOn(sb), { l: o.lit });
    if (w > h) { const P = person(I, d.look, fx, 0, fw, e + h - sh, { pose: d.pose || 'up', side: side ? -1 : 1, crop: 'full', maxSc: e ? 1 : 3 });
      let tx = side ? 2 : fw + 2, tw = w - fw - 4; if (P && side) tw = Math.min(tw, P[0] - 2 - tx); else if (P && P[0] + P[2] + 1 > tx) { tw -= P[0] + P[2] + 1 - tx; tx = P[0] + P[2] + 1; }   // (a wide character: the copy moves over)
      let y = e + 2; if (d.top) y += line(I, d.top, tx, y, tw, Math.max(5, Math.round(h * .22)), kick(p), { face: 'black', l: o.lit, valign: 'top' }) + 1;
      big(I, d.big, tx, y, tw, e + h - sh - y - 1, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK }); }
    else { const th = Math.round((h - sh) * .34); big(I, d.big, 1, e + 1, w - 2, th, p.fg, { l: o.lit }); person(I, d.look, 1, e + th + 1, w - 2, h - sh - th - 1, { pose: d.pose || 'up', crop: 'full', maxSc: 4 }); } },
  // a product big on one side (on a roof it breaks out of the frame), the copy on the other
  product(I, d, p, o) { const { w, h } = o, e = o.ext, side = H(d, 3) < .5 ? 0 : 1, sh = h >= 26 && foot(d) ? Math.max(7, Math.round(h * .19)) : 0;
    if (w >= h * 1.2) { const iw = Math.round(w * .4 * (o.k ?? 1)), ix = side ? w - iw : 0, tx = side ? 2 : iw + 1, tw = w - iw - 3;
      icon(I, d.icon || 'star', ix + 1, 0, iw - 2, e + h - sh - 1, { maxSc: 6, bottom: true });
      let y = e + 2; if (d.top) y += line(I, d.top, tx, y, tw, Math.max(5, Math.round((h - sh) * .3)), kick(p), { face: 'black', l: o.lit, valign: 'top' }) + 1;
      big(I, d.big, tx, y, tw, e + h - sh - y - 1, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK }); }
    else { const ih = Math.round((h - sh) * .42); icon(I, d.icon || 'star', 1, e + 1, w - 2, ih - 1, { maxSc: 6 }); let y = e + ih + 1;
      if (d.top) y += line(I, d.top, 1, y, w - 2, Math.max(5, Math.round((h - ih) * .2)), kick(p), { face: 'black', l: o.lit, valign: 'top' }) + 1;
      big(I, d.big, 1, y, w - 2, e + h - sh - y - 1, p.fg, { l: o.lit }); }
    if (sh) strip(I, e + h - sh, sh, INK, foot(d), WHITE, { l: o.lit }); },
  // stacked words, a kicker band, two rules: the classic painted ad
  type(I, d, p, o) { const { w, h } = o, e = o.ext, kh0 = d.top ? Math.max(5, Math.round(h * (h > w ? .12 : .2))) : 0, kh = kh0 && fit(txt(d.top), w - 6, kh0, 'black') ? band(I, d.top, 2, e + 2, w - 2, kh0, p.acc, inkOn(p.acc), { l: o.lit }) : 0, fs = foot(d) && h >= 22 ? small(foot(d), w - 4) : null, sh = fs ? fs.h + 3 : 0;
    I.rect(0, e, w, e + 1, p.acc); I.rect(0, e + h - 1, w, e + h, p.acc);
    if (h > w * 1.3 && d.icon) { const ih = Math.round(h * .3); icon(I, d.icon, 2, e + 3 + kh, w - 4, ih, { maxSc: 5 }); big(I, d.big, 2, e + 4 + kh + ih, w - 4, h - kh - sh - ih - 6, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK }); }
    else big(I, d.big, 2, e + 3 + kh, w - 4, h - kh - sh - 5, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK });
    if (fs) I.text(fs, Math.round((w - fs.w) / 2), e + h - sh, p.fg, { label: txt(foot(d)) }); },
  // LOTTO: the game on a banner, the jackpot in lit digits, lotto balls
  jackpot(I, d, p, o) { const { w, h } = o, e = o.ext; I.rect(0, e, w, e + h, INK); const bh = band(I, d.brand || d.top, 0, e, w, Math.max(6, Math.round(h * .26)), p.bg, inkOn(p.bg), { pad: 2, l: o.lit });
    const bw = w > h ? Math.round(w * .2) : 0; if (bw) { icon(I, 'ball', 1, e + bh + 1, bw, h - bh - 2, { maxSc: 3 }); icon(I, 'ball', w - bw - 1, e + bh + 1, bw, h - bh - 2, { maxSc: 3 }); }
    const yy = e + bh + 1, ah = Math.round((h - bh) * .64); big(I, d.big, bw + 1, yy, w - 2 * bw - 2, ah, 0xffe23a, { l: 3 }); line(I, d.sub || 'JACKPOT', bw + 1, yy + ah, w - 2 * bw - 2, h - bh - ah - 2, WHITE, { face: 'black', l: o.lit }); },
  // Dazed: one flat colour, the full character, a small wordmark in a corner, the issue in the other. Nothing else.
  editorial(I, d, p, o) { const { w, h } = o, e = o.ext, side = H(d, 4) < .5 ? 0 : 1, land = w > h, bg = p.bg, fg = lum(bg) > .55 ? INK : WHITE;
    const fw = Math.round(w * (land ? .42 * (o.k ?? 1) : .86)), fx = land ? (side ? Math.round(w * .06) : w - fw - Math.round(w * .06)) : Math.round((w - fw) / 2), top = land ? 0 : Math.round(h * .16);
    person(I, d.look, fx, e + top - (land ? e : 0), fw, h - top + (land ? e : 0) - (land ? 0 : 9), { pose: d.pose || 'stand', crop: 'full', maxSc: 4 });
    const tx = land ? (side ? fx + fw + 3 : 3) : 2, tw = land ? (side ? w - tx - 3 : fx - 6) : w - 4, wh = Math.max(6, Math.round(h * (land ? .3 : .13)));
    big(I, d.big, tx, e + 2, tw, Math.round(wh * 1.5), fg, { face: 'serif', l: o.lit, valign: 'top' });   // the wordmark: a bold serif when it is big, the pixel font when it is not
    if (d.top) { const T = small(d.top, land ? tw : w - 4); if (T) I.text(T, land ? tx : w - T.w - 2, e + h - T.h - 2, fg, { label: txt(d.top) }); } },
  // transit / civic notice: white sheet, black header, a line bullet, the notice
  notice(I, d, p, o) { const { w, h } = o, e = o.ext; I.rect(0, e, w, e + h, WHITE); const hh = Math.max(6, Math.round(h * .3)); I.rect(0, e, w, e + hh, INK);
    big(I, d.big, 2, e + 1, w - 4, hh - 2, WHITE, { face: 'black', l: o.lit }); const r = Math.max(2, Math.round(Math.min(w, h - hh) * .16)); I.disc(r + 3, e + hh + r + 3, r, 0xe8232a);
    if (r >= 4) { const M = px5('9'); I.text(M, r + 3 - (M.w >> 1), e + hh + r, WHITE, { label: '9' }); } icon(I, 'bus', 2 * r + 6, e + hh + 2, w - 2 * r - 8, 2 * r + 2, { maxSc: 2 });
    let y = e + hh + 2 * r + 6; for (const s of wrap(d.sub || '', w - 4, px3)) { if (y + 5 > e + h - 1) break; const T = px3(s); I.text(T, 2, y, INK, { label: s }); y += 7; } },
  // church letter board: a frame, the church on a band, black letters on white
  church(I, d, p, o) { const { w, h } = o, e = o.ext; I.rect(0, e, w, e + h, 0x5a3a22); I.rect(2, e + 2, w - 2, e + h - 2, WHITE); const bh = band(I, d.brand || '', 2, e + 2, w - 2, Math.max(5, Math.round(h * .22)), 0x8a1a2a, 0xe7bd4a, { face: 'serif' }); const iw = Math.min(Math.round(w * .18), h - bh - 6); icon(I, 'cross', 3, e + bh + 4, iw, h - bh - 8, { maxSc: 3 });
    big(I, d.big, iw + 5, e + bh + 4, w - iw - 9, h - bh - 8 - (d.sub ? 8 : 0), INK, { face: 'px5' }); if (d.sub) line(I, d.sub, iw + 5, e + h - 10, w - iw - 9, 7, 0x8a1a2a, { face: 'px5' }); },
  // bandit sign: yellow board, black words, the number big in red
  bandit(I, d, p, o) { const { w, h } = o, e = o.ext; I.rect(0, e, w, e + h, 0xffe23a); const th = Math.round(h * .6); big(I, d.big, 2, e + 1, w - 4, th - 1, INK, { face: 'impact' });
    line(I, d.tel || d.sub, 2, e + th, w - 4, h - th - 1, 0xe8232a, { face: 'impact' }); },
  // fight card: two characters face off, VS, the names
  fight(I, d, p, o) { const { w, h } = o, e = o.ext; const bh = band(I, d.top, 0, e, w, Math.max(5, Math.round(h * .2)), INK, 0xffe23a, { pad: 2, l: o.lit });
    const cw = Math.round(w * (w > h ? .3 : .46)), ch = Math.round((h - bh) * .66); person(I, d.look, 1, e + bh + 1, cw, ch, { crop: 'bust', fx: true }); person(I, d.look2 || d.look, w - cw - 1, e + bh + 1, cw, ch, { crop: 'bust' });
    line(I, 'VS', cw + 1, e + bh + 1, w - 2 * cw - 2, ch, kick(p), { face: 'impact', l: o.lit, shadow: INK }); const [a, b] = txt(d.big).split(' VS ');
    const nh = h - bh - ch - 2; if (w > h) { line(I, a, 1, e + bh + ch + 1, Math.round(w / 2) - 2, nh, p.fg, { face: 'black' }); line(I, b, Math.round(w / 2) + 1, e + bh + ch + 1, Math.round(w / 2) - 2, nh, p.fg, { face: 'black' }); }
    else { line(I, a, 1, e + bh + ch + 1, w - 2, (nh >> 1), p.fg, { face: 'black' }); line(I, b, 1, e + bh + ch + 1 + (nh >> 1), w - 2, nh - (nh >> 1), p.fg, { face: 'black' }); } },
  // loan-shark flyer: photocopy paper, the pitch, tear-off tabs (a few torn off)
  flyer(I, d, p, o) { const { w, h } = o, e = o.ext, paper = d.tone === 'white' ? WHITE : p.bg; I.rect(0, e, w, e + h, paper); const tabs = Math.max(3, Math.floor(w / 4)), th = Math.max(5, Math.round(h * .26));
    big(I, d.big, 1, e + 1, w - 2, h - th - 9, INK, { face: 'black' }); const M = small(d.sub, w - 2); if (M) I.text(M, Math.round((w - M.w) / 2), e + h - th - M.h - 2, INK, { label: txt(d.sub) });
    for (let k = 0; k < tabs; k++) { const x0 = Math.round(k * w / tabs), x1 = Math.round((k + 1) * w / tabs); if (H(d, 10 + k) < .3) { I.rect(x0, e + h - th, x1, e + h, -2); continue; } I.rect(x0, e + h - th, x0 + 1, e + h, shade(paper, .78)); } },
  // WANTED / MISSING: the header, a face in a frame, the name, the line
  wanted(I, d, p, o) { const { w, h } = o, e = o.ext, paper = TONE[d.tone]?.[0] ?? CREAM; I.rect(0, e, w, e + h, paper); const hh = Math.max(6, Math.round(h * .2));
    line(I, d.big, 1, e + 1, w - 2, hh, d.big === 'WANTED' ? 0xe8232a : INK, { face: 'black' }); const fh = Math.round(h * .46), fw = Math.round(w * .74), fx = Math.round((w - fw) / 2), fy = e + hh + 2;
    I.rect(fx, fy, fx + fw, fy + fh, 0xd9d2c3); if (d.look) person(I, d.look, fx + 1, fy + 1, fw - 2, fh - 1, { crop: 'head' }); else icon(I, d.icon || 'dog', fx + 1, fy + 1, fw - 2, fh - 2, { maxSc: 3 });
    const y = fy + fh + 1; line(I, d.brand || '', 1, y, w - 2, Math.max(5, Math.round((e + h - y) * .5)), INK, { face: 'black' }); const M = small(d.sub, w - 2); if (M) I.text(M, Math.round((w - M.w) / 2), e + h - M.h - 1, INK, { label: txt(d.sub) }); },
  // a small poster (a paste-up): the words take the top half, the character or the product the rest
  // (a street poster is 2–3 m wide: when the name is too long for it, the kicker or the category's word is the headline)
  mini(I, d, p, o) { const { w, h } = o, e = o.ext; I.rect(0, e, w, e + 2, p.acc); const th = Math.round(h * .5), hl = [d.big, d.top, SHORT[d.cat], SHORT3[d.cat]].find(s => s && big(I, s, 1, e + 3, w - 2, th - 3, p.fg, { l: o.lit, soft: true })); if (!hl) I.miss = true;
    const y = e + th, rest = h - th - 1; if (d.look) person(I, d.look, 1, y, w - 2, rest, { crop: 'bust' }); else if (d.icon) icon(I, d.icon, 1, y, w - 2, rest - 1, { maxSc: 3 }); else if (d.top && d.top !== hl) big(I, d.top, 1, y, w - 2, rest - 1, kick(p), { l: o.lit, soft: true });
    I.rect(0, e + h - 1, w, e + h, p.acc); },
  // a narrow lightbox (bus shelter end panel): the picture fills it, one short word on a band
  poster(I, d, p, o) { const { w, h } = o, e = o.ext, bh = 9, word = [d.short, SHORT[d.cat], SHORT3[d.cat]].find(s => s && small(s, w - 1)) || '';   // (the category's word, never a clipped name) I.rect(0, e, w, e + h, p.bg);
    if (d.look) person(I, d.look, 0, e + 1, w, h - bh - 1, { crop: h - bh > 40 ? 'full' : 'bust', pose: 'stand' }); else icon(I, d.icon || 'star', 1, e + 2, w - 2, h - bh - 4, { maxSc: 4 });
    I.rect(0, e + h - bh, w, e + h, p.acc === p.bg ? INK : p.acc); const M = small(word, w - 1); if (M) I.text(M, Math.round((w - M.w) / 2), e + h - bh + Math.round((bh - M.h) / 2), inkOn(p.acc === p.bg ? INK : p.acc), { l: o.lit, label: word }); },
  // ── signage pass 4: the reserve's painters (only designs of the new categories use them)
  // PRICE: the number in a starburst (DIVORCE $299, DNA TEST $99, QUEEN SET $199), the pitch beside it; no price → the classic type ad
  price(I, d, p, o) { if (!d.price) return LAYOUT.type(I, d, p, o); const { w, h } = o, e = o.ext, sh = h >= 26 && foot(d) ? Math.max(7, Math.round(h * .19)) : 0, ph = h - sh, land = w >= h * 1.2;
    const R = Math.max(5, Math.round(Math.min(land ? w * .21 : w * .44, ph * (land ? .47 : .3)))), left = H(d, 5) < .5, cx = land ? (left ? R + 3 : w - R - 3) : Math.round(w / 2), cy = e + (land ? Math.round(ph / 2) : R + 3), sb = kick(p);
    for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) { const a = Math.atan2(y, x), t = (((a / 6.2832) * 14) % 1 + 1) % 1, lim = R * (.76 + .24 * Math.abs(t * 2 - 1)); if (Math.hypot(x, y) <= lim) I.set(cx + x, cy + y, sb); }
    big(I, d.price, cx - Math.round(R * .66), cy - Math.round(R * .5), Math.round(R * 1.32), Math.round(R * 1.0), inkOn(sb), { l: o.lit });
    const tx = land ? (left ? 2 * R + 6 : 2) : 2, tw = land ? w - 2 * R - 9 : w - 4; let y = land ? e + 2 : cy + R + 3;
    if (d.top) y += line(I, d.top, tx, y, tw, Math.max(5, Math.round(ph * (land ? .24 : .12))), sb, { face: 'black', l: o.lit, valign: 'top' }) + 1;
    big(I, d.big, tx, y, tw, e + ph - y - 1, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK });
    if (sh) strip(I, e + ph, sh, INK, foot(d), WHITE, { l: o.lit }); },
  // CLUB: the club-night flyer: black stock, a halftone bloom in one hot colour, the party big, the DJ over it, the venue on a strip
  club(I, d, p, o) { const { w, h } = o, e = o.ext, HOT = [0xff4fa3, 0x6cff4a, 0x2de2e6, 0xffe23a, 0xff7a1a], k = (H(d, 6) * HOT.length) | 0, hot = HOT[k], hot2 = HOT[(k + 2) % HOT.length];
    I.rect(0, e, w, e + h, INK); const fx = H(d, 7) < .5 ? 0 : w; for (let y = 0; y < h; y += 2) for (let x = (y >> 1) % 2; x < w; x += 2) { const q = 1 - Math.hypot((x - fx) / w, (h - y) / h) / 1.15; if (q > .38 && hash(x, y, 7) < q) I.set(x, e + y, mix(INK, hot, .45)); }
    const sh = h >= 22 && foot(d) ? Math.max(7, Math.round(h * .18)) : 0; if (sh) strip(I, e + h - sh, sh, hot, foot(d), INK, { l: o.lit });
    let y = e + 2; if (d.top) y += line(I, d.top, 2, y, w - 4, Math.max(5, Math.round(h * .17)), hot2, { face: 'black', l: o.lit, valign: 'top' }) + 1;
    big(I, d.big, 2, y, w - 4, e + h - sh - y - 1, hot, { l: o.lit, shadow: WHITE === hot ? undefined : mix(INK, hot, .25) }); },
  // LUXE: the rich side's understatement: one quiet ground, hairline double rules, a serif wordmark, the line in small caps, a small mark
  luxe(I, d, p, o) { const { w, h } = o, e = o.ext, bg = p.bg, fg = lum(bg) > .55 ? INK : WHITE, gold = 0xe7bd4a, rule = lum(bg) > .55 ? mix(bg, INK, .55) : gold;
    I.frame(2, e + 2, w - 2, e + h - 2, rule, 1); if (w >= 30 && h >= 24) I.frame(4, e + 4, w - 4, e + h - 4, rule, 1);
    const pw = d.look && w >= h * 1.3 ? Math.round(w * .3) : 0, side = H(d, 8) < .5; if (pw) person(I, d.look, side ? w - pw - 5 : 5, e + 5, pw, h - 10, { pose: d.pose || 'stand', crop: 'full', maxSc: 3 });
    const x0 = pw && !side ? pw + 7 : 6, tw = w - 12 - (pw ? pw + 1 : 0), ih = d.icon && h >= 30 ? Math.max(6, Math.round(h * .2)) : 0; let y = e + 6;
    if (ih) { icon(I, d.icon, x0, y, tw, ih, { maxSc: 2 }); y += ih + 2; }
    const fs = foot(d) ? small(foot(d), tw) : null, T = d.top ? small(d.top, tw) : null, rest = e + h - 6 - y - (T ? T.h + 3 : 0) - (fs ? fs.h + 2 : 0);
    y += big(I, d.big, x0, y, tw, Math.max(5, rest), fg, { face: 'serif', l: o.lit }) + 2;
    if (T) { I.text(T, Math.round(x0 + (tw - T.w) / 2), y, rule === gold ? gold : fg, { label: txt(d.top) }); }
    if (fs) I.text(fs, Math.round(x0 + (tw - fs.w) / 2), e + h - 6 - fs.h, fg, { label: txt(foot(d)) }); },
  // RAYS: the revival / the ferry / the hospital's good news: a sunburst from the foot, the words over it, a figure or an icon rising
  rays(I, d, p, o) { const { w, h } = o, e = o.ext, c2 = mix(p.bg, p.acc === p.bg ? WHITE : p.acc, .32), cx = w / 2, cy = e + h + 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = Math.atan2(e + y - cy, x + .5 - cx) + Math.PI; if (Math.floor(a * 20 / Math.PI) % 2 === 0) I.set(x, e + y, c2); }
    const bh = d.top ? band(I, d.top, 0, e, w, Math.max(6, Math.round(h * .18)), INK, 0xffe23a, { pad: 2, l: o.lit }) : 0, sh = h >= 26 && foot(d) ? Math.max(7, Math.round(h * .17)) : 0; if (sh) strip(I, e + h - sh, sh, INK, foot(d), WHITE, { l: o.lit });
    // a small wall (under 44 rows): the words take it all, no picture
    const pic = h >= 44 && (d.look || d.icon), wh = pic ? Math.round((h - bh - sh) * .5) : h - bh - sh - 2; big(I, d.big, 2, e + bh + 1, w - 4, wh, p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK });
    const py = e + bh + wh + 2, ph = e + h - sh - py; if (ph >= 6) { if (d.look) person(I, d.look, 2, py, w - 4, ph, { pose: d.pose || 'up', crop: 'full', maxSc: 3 }); else if (d.icon) icon(I, d.icon, 2, py, w - 4, ph - 1, { maxSc: 4, bottom: true }); } },
  // RELEASE: the record: a square sleeve (the artist on it) with the disc sliding out, the title big, the artist and the date beside
  release(I, d, p, o) { const { w, h } = o, e = o.ext, land = w >= h * 1.2, sq = land ? Math.min(h - 4, Math.round(w * .42)) : Math.min(w - 8, Math.round(h * .5)), left = H(d, 9) < .5;
    const sx = land ? (left ? 2 : w - sq - 2) : Math.round((w - sq) / 2) - 2, sy = e + 2, r = Math.round(sq * .45), dx = land ? (left ? sx + sq - Math.round(sq * .2) : sx + Math.round(sq * .2)) : sx + sq - Math.round(sq * .2);
    I.disc(dx, sy + sq / 2, r, INK); I.disc(dx, sy + sq / 2, Math.max(2, Math.round(r * .3)), p.acc === p.bg ? 0xe8232a : p.acc); I.disc(dx, sy + sq / 2, 1, p.bg);
    const sleeve = kick(p) === p.bg ? WHITE : kick(p); I.rect(sx, sy, sx + sq, sy + sq, sleeve); if (d.look) person(I, d.look, sx + 1, sy + 1, sq - 2, sq - 2, { crop: 'bust', pose: 'stand' }); else icon(I, 'record', sx + 2, sy + 2, sq - 4, sq - 4, { maxSc: 4 });
    const tx = land ? (left ? sq + Math.round(sq * .3) + 4 : 2) : 2, tw = land ? w - sq - Math.round(sq * .3) - 7 : w - 4, fs = foot(d) ? small(foot(d), tw) : null; let y = land ? e + 2 : sy + sq + 2;
    if (d.top) y += line(I, d.top, tx, y, tw, Math.max(5, Math.round(h * (land ? .2 : .1))), kick(p) === p.bg ? p.fg : kick(p), { face: 'black', l: o.lit, valign: 'top' }) + 1;
    big(I, d.big, tx, y, tw, e + h - y - (fs ? fs.h + 3 : 1), p.fg, { l: o.lit, shadow: lum(p.bg) > .5 ? undefined : INK }); if (fs) I.text(fs, Math.round(tx + (tw - fs.w) / 2), e + h - fs.h - 1, p.fg, { label: txt(foot(d)) }); },
};
// the reserve's category words (signage pass 4): the lightbox band and the small poster's headline when the name is too long
const RESERVE_SHORT = { alarm: 'ALARM', guarddog: 'K-9', safes: 'SAFES', warrants: 'LAW', titleloan: 'CASH', hospital: 'ER', carservice: 'CAR', ferry: 'FERRY', pi: 'P.I.', renttoown: 'RENT', cashcars: 'CASH',
  auction: 'SALE', divorce: 'SPLIT', dna: 'DNA', immig: 'VISAS', tickets: 'TICKET', inmate: 'CALLS', plasma: 'GIVE', school: 'LEARN', phonecard: 'CALL', mattress: 'SLEEP', beauty: 'WIGS', karaoke: 'SING',
  cabaret: 'SHOW', motel: 'ROOMS', carwash: 'WASH', adopt: 'ADOPT', tenant: 'RIGHTS', stoopsale: 'SALE', tearoff: 'CALL', clubnight: 'PARTY', release: 'NEW', revival: 'PRAY', psychic: 'FATE', consign: 'PAIRS',
  vintage: 'OLD', cardshow: 'CARDS', watches: 'TIME', gallery: 'ART', estate: 'HOME', motorcars: 'CARS', tailor: 'SUITS', rehab: 'HOPE', lucha: 'LUCHA', bingo: 'BINGO' };
const RESERVE_SHORT3 = { alarm: 'SOS', guarddog: 'K9', safes: 'BOX', warrants: 'LAW', titleloan: '$$$', hospital: 'ER', carservice: 'CAB', ferry: 'SEA', pi: 'EYE', renttoown: 'TV', cashcars: '$$$', auction: 'BID',
  divorce: 'BYE', dna: 'DNA', immig: 'VISA', tickets: 'DUI', inmate: 'CALL', plasma: '$$$', school: 'GED', phonecard: '1¢', mattress: 'ZZZ', beauty: 'WIG', karaoke: 'MIC', cabaret: 'VIP', motel: 'INN',
  carwash: 'WASH', adopt: 'PET', tenant: 'RENT', stoopsale: 'SALE', tearoff: 'CALL', clubnight: 'DJ', release: 'LP', revival: 'GOD', psychic: '???', consign: 'KIX', vintage: 'OLD', cardshow: 'SLAB',
  watches: 'TIME', gallery: 'ART', estate: 'HOME', motorcars: 'CAR', tailor: 'FIT', rehab: 'HOPE', lucha: 'KO!', bingo: 'B-9' };
// the shortest strong word of a design (the lightbox band): a short first word of the brand, else the category's word
const SHORT = { injury: 'LAW', bail: 'BAIL', tax: 'TAX', cheque: 'CASH', gold: 'GOLD', lotto: 'WIN', otb: 'OTB', malt: 'COLD', energy: 'GO', urgent: 'CARE', dental: 'SMILE', gym: 'GYM', phone: 'CELL', radio: 'FM',
  concert: 'LIVE', tv: 'NEW', campaign: 'VOTE', police: 'JOIN', stoppers: 'TIPS', wanted: 'WANTED', transitnote: 'INFO', condo: '$2M', luxury: 'LUXE', fashion: 'NEW', drops: 'DROP', collect: 'CARDS', net: 'LOL', barber: 'CUTS', nails: 'NAILS',
  houses: 'CASH', wire: 'SEND', vape: 'VAPE', locksmith: 'KEYS', pest: 'RATS?', storage: 'STORE', movers: 'MOVE', driving: 'DRIVE', tow: 'TOW', laundry: 'WASH', tattoo: 'INK', chicken: 'WINGS', pizza: 'SLICE',
  halal: 'HALAL', boxing: 'FIGHT', church: 'PRAY', missing: 'LOST', loanshark: 'LOANS', closing: 'SALE', union: 'UNION', marine: 'BOATS', scrap: 'SCRAP', propane: 'GAS',
  ...RESERVE_SHORT };
// a three-letter word per category for the narrowest bands (a 16-wide lightbox): what the ad is about, never a clipped name
const SHORT3 = { injury: 'LAW', bail: 'OUT', tax: 'TAX', cheque: '$$$', gold: '$$$', lotto: 'WIN', otb: 'OTB', malt: 'ICE', energy: 'GO!', urgent: 'ER', dental: 'DDS', gym: 'GYM', phone: 'FIX',
  radio: 'FM', concert: 'JAM', tv: 'TV', campaign: 'VOTE', police: 'COP', stoppers: 'TIP', wanted: 'TIP', missing: '???', transitnote: 'BUS', condo: '$2M', luxury: 'LUX', fashion: 'NEW', drops: 'NEW',
  collect: 'BUY', net: 'LOL', barber: 'CUT', nails: 'SPA', houses: '$$$', wire: '$$$', vape: 'VAP', locksmith: 'KEY', pest: 'RAT', storage: 'BOX', movers: 'VAN', driving: 'CAR', tow: 'TOW',
  laundry: 'WSH', tattoo: 'INK', chicken: 'HOT', pizza: '$1', halal: 'EAT', boxing: 'KO!', church: 'GOD', loanshark: '$$$', closing: 'SALE', union: 'JOB', marine: 'SEA', scrap: '$$$', propane: 'GAS',
  ...RESERVE_SHORT3 };
export const shortOf = d => { const w = txt(d.big).split(' ')[0]; return w.length <= 4 && !/^(THE|DR\.|ONE|CALL)$/.test(w) ? w : SHORT[d.cat] || w.slice(0, 4); };
// the whole picture. o: { ext (rows above the frame), pal, lit, bg: false (leave the background clear) }
export function paint(d, w, h, o = {}) {
  const ext = o.ext || 0, p = palOf(d, o);
  let lay = o.lay || (LAYOUT[d.lay] ? d.lay : (d.look ? 'bust' : d.icon ? 'product' : 'type'));
  if ((lay === 'editorial' || lay === 'bust' || lay === 'figure' || lay === 'fight') && !d.look) lay = d.icon ? 'product' : 'type';
  if (!o.lay && w < 40 && h < 60 && !['wanted', 'flyer', 'bandit', 'notice', 'church', 'jackpot'].includes(lay)) lay = 'mini';
  const draw = (lay, k = 1) => { const I = new Img(w, h + ext); if (o.bg !== false) I.rect(0, ext, w, ext + h, p.bg); LAYOUT[lay](I, d, p, { w, h, ext, lit: o.lit ?? 0, k }); return I; };
  // the words don't fit beside the picture: a narrower picture (3/4, then 1/2), else the words alone
  let I = draw(lay); for (const k of ['bust', 'figure', 'product', 'editorial'].includes(lay) ? [.75, .5] : []) { if (!I.miss) break; I = draw(lay, k); I.k = k; }
  if (I.miss && lay !== 'type') { const J = draw('type'); if (!J.miss) { I = J; lay = 'type'; I.fell = true; } }
  for (let k = 0; k < I.c.length; k++) if (I.c[k] === -2) I.c[k] = -1;   // (torn tabs)
  I.pal = p; I.lay = lay; return I;
}
