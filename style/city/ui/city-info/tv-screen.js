// HUMAN LAYER · SECTION 3a · THE TV PICTURE: one news card drawn on a 2D canvas (640×480, 4:3). Reusable on purpose: City TV's panel
// shows it in the UI, and an in-world TV can later put the same canvas on a screen mesh (THREE.CanvasTexture) — the picture never needs
// the DOM. Drawn once per card (never per frame). Colours and fonts come from a theme: themeFrom(#k) reads the kit's tokens (city-info.css
// --ci-tv-*, per skin); an in-world TV can pass its own theme object instead.
//   const scr = createScreen({ canvas, theme }); scr.show(card)   ·   cardsOf(...) builds the cards (tv.js)
// Cards: { type: 'story' | 'top' | 'drop' | 'wanted' | 'rush' | 'quiet', kind, label, head, sub, time, lens: 'live' | 'tape' | 'archive', asOf, items }
export const TV_W = 640, TV_H = 480;
const TOK = { bg: '--ci-tv-bg', bg2: '--ci-tv-bg-2', ink: '--ci-tv-ink', ink2: '--ci-tv-ink-2', band: '--ci-tv-band', bandInk: '--ci-tv-band-ink', accent: '--ci-tv-accent', accentInk: '--ci-tv-accent-ink',
  font: '--ci-tv-font', display: '--ci-tv-font-display', live: '--k-live', tape: '--k-tape', archive: '--k-archive', rob: '--k-ev-rob', arrest: '--k-ev-arrest', death: '--k-ev-death',
  mark: '--k-ev-mark', turf: '--k-ev-turf', director: '--k-ev-director', drop: '--ci-ev-drop', city: '--ci-ev-city', caps: '--ci-tv-caps' };
export function themeFrom(el) { const cs = getComputedStyle(el), o = {}; for (const [k, v] of Object.entries(TOK)) o[k] = cs.getPropertyValue(v).trim(); o.caps = o.caps !== 'none'; return o; }
const KIND_COL = { rob: 'rob', burgle: 'rob', arrest: 'arrest', death: 'death', hurt: 'death', mark: 'mark', turf: 'turf', crew: 'turf', director: 'director', drop: 'drop', money: 'drop', city: 'city', secret: 'tape' };

export function createScreen({ canvas, theme }) {
  canvas.width = TV_W; canvas.height = TV_H; const ctx = canvas.getContext('2d'); let T = theme, cur = null;
  return { canvas, show(card) { cur = card; draw(ctx, card, T); }, setTheme(t) { T = t; if (cur) draw(ctx, cur, T); }, redraw() { if (cur) draw(ctx, cur, T); }, get card() { return cur; } };
}
const up = (s, T) => T.caps ? String(s).toUpperCase() : String(s);
function fit(ctx, text, font, maxW, maxLines, sizes) {   // the biggest size at which the text wraps into maxLines
  for (const sz of sizes) { ctx.font = font(sz); const lines = wrap(ctx, text, maxW); if (lines.length <= maxLines) return { sz, lines }; }
  const sz = sizes[sizes.length - 1]; ctx.font = font(sz); const lines = wrap(ctx, text, maxW); return { sz, lines: lines.slice(0, maxLines).map((l, k, a) => k === a.length - 1 && lines.length > maxLines ? l.replace(/\s*\S*$/, '…') : l) };
}
function wrap(ctx, text, maxW) { const words = String(text).split(/\s+/), lines = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; }
function draw(ctx, c, T) {
  const W = TV_W, H = TV_H, F = (sz, w = 400) => `${w} ${sz}px ${T.font}`, D = (sz, w = 400) => `${w} ${sz}px ${T.display}`;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.bg); g.addColorStop(1, T.bg2 || T.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  // the station bug (top left) and the lens tag (top right)
  ctx.fillStyle = T.accent; ctx.fillRect(28, 26, 74, 40); ctx.fillStyle = T.accentInk; ctx.font = D(30, 700); ctx.fillText('CH 9', 36, 57);
  ctx.fillStyle = T.ink; ctx.font = D(26, 700); ctx.fillText(up('News', T), 114, 56);
  const lc = T[c.lens] || T.live, tag = up(c.lens === 'live' ? 'Live' : c.lens === 'archive' ? 'Archive' : 'Tape', T) + (c.asOf ? '  ' + c.asOf : '');
  ctx.font = F(20, 600); const tw = ctx.measureText(tag).width; ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(W - 46 - tw, 46, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillText(tag, W - 32 - tw, 53);
  const kc = T[KIND_COL[c.kind]] || T.band;
  if (c.type === 'top' || c.type === 'quiet') {
    band(ctx, T, c.label || 'Top stories', T.band, T.bandInk, 92);
    if (c.type === 'quiet') { ctx.fillStyle = T.ink2; ctx.font = F(26); wrap(ctx, c.head || 'A quiet day in the city.', W - 112).slice(0, 4).forEach((l, k) => ctx.fillText(l, 56, 214 + k * 36)); }
    else (c.items || []).slice(0, 5).forEach((it, k) => { const y = 168 + k * 50; ctx.fillStyle = T[KIND_COL[it.kind]] || T.ink2; ctx.fillRect(56, y - 22, 8, 32);
      ctx.fillStyle = T.ink; const f = fit(ctx, it.text, s => F(s, 500), W - 170, 1, [24, 21, 19, 17]); ctx.font = F(f.sz, 500); ctx.fillText(f.lines[0], 80, y + 2);
      ctx.fillStyle = T.ink2; ctx.font = F(16); ctx.fillText(it.time || '', 80, y + 24); });
  } else if (c.type === 'drop') {
    band(ctx, T, c.label || 'Fit Street drop', kc, T.bandInk, 92);
    ctx.fillStyle = T.ink2; ctx.font = F(20); if (c.sub) ctx.fillText(c.sub, 56, 168);
    (c.items || []).slice(0, 6).forEach((it, k) => { const x = 56 + (k % 2) * 270, y = 214 + Math.floor(k / 2) * 64; ctx.fillStyle = T.ink; ctx.font = D(34, 700); ctx.fillText(up(it.k, T), x, y);
      ctx.fillStyle = T.ink2; ctx.font = F(19, 500); ctx.fillText(`${it.price}cr${it.stock != null ? ' · ' + it.stock + ' left' : ''}`, x, y + 26); });
  } else {
    band(ctx, T, c.label || 'News', kc, T.bandInk, 140);
    const top = 194, bottom = H - 84 - 18 - (c.sub ? 58 : 0), head = up(c.head || '', T); let f = null;
    for (const sz of [62, 54, 48, 42, 38, 34, 30, 27, 24]) { ctx.font = D(sz, 700); const lines = wrap(ctx, head, W - 112); if (lines.length * sz * 1.08 <= bottom - top) { f = { sz, lines }; break; } }
    if (!f) { ctx.font = D(24, 700); f = { sz: 24, lines: wrap(ctx, head, W - 112).slice(0, Math.floor((bottom - top) / 26)) }; }
    ctx.fillStyle = T.ink; ctx.font = D(f.sz, 700); const lh = Math.round(f.sz * 1.08); f.lines.forEach((l, k) => ctx.fillText(l, 56, top + f.sz * .9 + k * lh));
    if (c.sub) { ctx.fillStyle = T.ink2; const s = fit(ctx, c.sub, x => F(x), W - 112, 2, [22, 20, 18]); ctx.font = F(s.sz); s.lines.forEach((l, k) => ctx.fillText(l, 56, top + f.lines.length * lh + 26 + k * 26)); }
  }
  // the lower third: where and when
  ctx.fillStyle = T.band; ctx.fillRect(0, H - 84, W, 52); ctx.fillStyle = T.accent; ctx.fillRect(0, H - 84, 14, 52);
  ctx.fillStyle = T.bandInk; const lt = [c.place, c.time].filter(Boolean).join('  ·  ') || 'AI City', lf = fit(ctx, up(lt, T), s => F(s, 700), W - 80, 1, [26, 23, 20, 18]);
  ctx.font = F(lf.sz, 700); ctx.fillText(lf.lines[0], 32, H - 49);
}
function band(ctx, T, label, col, ink, y) { const text = up(label, T); if (col !== T.band) ink = contrast(col, T.ink, T.bg); ctx.font = `700 22px ${T.display}`; const w = ctx.measureText(text).width + 36; ctx.fillStyle = col; ctx.fillRect(56, y, w, 36); ctx.fillStyle = ink; ctx.fillText(text, 74, y + 26); }
// the ink that reads on a colour: the theme's ink or its background, whichever is further in luminance
const lum = c => { const m = /^#([0-9a-f]{3,8})$/i.exec(c || ''), n = m ? (m[1].length === 3 ? m[1].split('').map(x => parseInt(x + x, 16)) : [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16))) : (/rgba?\(([^)]+)\)/.exec(c || '')?.[1].split(',').slice(0, 3).map(Number) || [128, 128, 128]);
  const [r, g, b] = n.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
function contrast(bg, a, b) { const L = lum(bg), ca = Math.abs(lum(a) - L), cb = Math.abs(lum(b) - L); return ca >= cb ? a : b; }
