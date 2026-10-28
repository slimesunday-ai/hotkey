// WALLS · the painters (owner: the walls agent). Every picture is a signage/art.js Img (row 0 = top), flat toon colour at the city
// grain (1 px = one 0.1 m voxel), built from a design object. walls/index.js lays them on bare wall skin only. A pixel of -1 leaves
// the wall showing (weathering, a stencil gap); `z` > 0 on a pixel is relief (a candle, a shutter's housing) that stands proud.
// No outlines as a render style: a throw-up's outline is paint, like the roof throw-up in setpieces.js.
import { Img, px5, px3, fit, disp, scaled, charImg, iconImg, charsReady, mix, shade, lum, inkOn, INK, WHITE, CREAM } from '../signage/art.js';
import { hash } from '../style.js';
import { COL as C } from './roster.js';

const H = (s, k) => hash(s | 0, k, 7717);
const pickOf = (arr, s, k = 0) => arr[(H(s, k) * arr.length) | 0];
// ── binary grids (letters, bubbles, clouds)
const G = (w, h) => ({ w, h, g: new Uint8Array(w * h) });
const gat = (M, x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h ? M.g[x + y * M.w] : 0;
const gset = (M, x, y, v = 1) => { if (x >= 0 && y >= 0 && x < M.w && y < M.h) M.g[x + y * M.w] = v; };
function dilate(S, r) { const D = G(S.w, S.h), off = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * .6) off.push([dx, dy]);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (S.g[x + y * S.w]) for (const [dx, dy] of off) gset(D, x + dx, y + dy); return D; }
const minus = (A, B) => { const D = G(A.w, A.h); for (let k = 0; k < A.g.length; k++) D.g[k] = A.g[k] && !B.g[k] ? 1 : 0; return D; };
const or = (A, B) => { const D = G(A.w, A.h); for (let k = 0; k < A.g.length; k++) D.g[k] = A.g[k] || B.g[k] ? 1 : 0; return D; };
const shift = (A, dx, dy) => { const D = G(A.w, A.h); for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.g[x + y * A.w]) gset(D, x + dx, y + dy); return D; };
function paintG(I, M, x, y, c, o = {}) { for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.g[i + j * M.w]) I.set(x + i, y + j, typeof c === 'function' ? c(i, j) : c, o.l ?? 0, o.z ?? 0); }
// letters of a word into a grid, one glyph at a time (bounce: each glyph rides up or down a little; big: the first one is bigger)
function word(s, sc, o = {}) { const gl = [...String(s)].map((ch, k) => { const k1 = k === 0 && o.big ? sc + 1 : sc, M = scaled(px5(ch), k1); return { M, dy: o.bounce ? Math.round(Math.sin(k * 1.9 + (o.seed || 0)) * sc * .6) : 0 }; });
  const gap = o.gap ?? Math.max(1, sc), pad = o.pad ?? 0, w = gl.reduce((a, g) => a + g.M.w + gap, -gap) + 2 * pad, top = Math.max(...gl.map(g => g.M.h)), up = Math.max(0, ...gl.map(g => -g.dy)), dn = Math.max(0, ...gl.map(g => g.dy)), h = top + up + dn + 2 * pad;
  const D = G(Math.max(1, w), h); let x = pad; for (const g of gl) { const y0 = pad + up + (top - g.M.h) + g.dy; for (let j = 0; j < g.M.h; j++) for (let i = 0; i < g.M.w; i++) if (g.M.at(i, j)) gset(D, x + i, y0 + j); x += g.M.w + gap; } return D; }
const grow = (M, p) => { const D = G(M.w + 2 * p, M.h + 2 * p); for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.g[x + y * M.w]) gset(D, x + p, y + p); return D; };
// a character in a box (bottom-aligned); without chars.js (node), a plain bust so the layout still reads
function fig(I, look, x, y, w, h, o = {}) {
  if (!charsReady()) { const r = Math.max(2, Math.round(Math.min(w, h) * .22)), cx = x + (w >> 1); I.rect(cx - r * 2, y + h - r * 2, cx + r * 2, y + h, o.shirt ?? C.blue); I.disc(cx, y + h - r * 2 - r * .9, r, o.skin ?? 0xc98a5b); return [cx - r * 2, y + h - r * 4, r * 4, r * 4]; }
  const order = ['full', 'bust', 'chest', 'head']; let S = null;
  for (let k = Math.max(0, order.indexOf(o.crop || 'full')); k < order.length; k++) { S = charImg(look, { pose: o.pose || 'stand', side: o.side ?? 1, crop: order[k] }); if (S.h <= h && S.w <= w) break; }
  if (!S || S.w <= 1) return null; const sc = Math.max(1, Math.min(o.maxSc || 8, Math.floor(Math.min(h / S.h, w / S.w)))), X = Math.round(x + (w - S.w * sc) / 2), Y = o.top ? y : y + h - S.h * sc;
  I.blit(S, X, Y, { sc, fx: o.fx }); return [X, Y, S.w * sc, S.h * sc]; }
const look = seed => ({ roll: (seed * 2654435761) >>> 8 });
// words as big as fit, centred (display face in the browser, the crisp 5×7 otherwise)
function words(I, s, x, y, w, h, c, o = {}) { const M = fit(s, w, h, o.face || 'black', { max: o.max }); if (!M) return 0; const X = Math.round(x + (w - M.w) / 2), Y = o.top ? y : Math.round(y + (h - M.h) / 2);
  I.text(M, X, Y, c, { shadow: o.shadow, l: 0 }); return M.h; }
const small = (I, s, x, y, c, maxW) => { const M = px5(s).w <= maxW ? px5(s) : px3(s).w <= maxW ? px3(s) : null; if (M) I.text(M, x, y, c); return M; };
// a cloud blob (union of discs), for backgrounds
function cloud(I, x, y, w, h, c, seed, n = 7) { for (let k = 0; k < n; k++) { const r = Math.max(2, h * (.28 + H(seed, k) * .25)); I.disc(x + r + H(seed, k + 20) * Math.max(1, w - 2 * r), y + h - r * (.7 + H(seed, k + 40) * .5), r, c); } }
function star(I, x, y, r, c) { for (let t = -r; t <= r; t++) { I.set(x + t, y, c); I.set(x, y + t, c); } if (r > 2) { I.set(x - 1, y - 1, c); I.set(x + 1, y + 1, c); I.set(x + 1, y - 1, c); I.set(x - 1, y + 1, c); } }

// ───────────────────────── graffiti
// TAG: the writer's hand. Slanted letters in one colour, a flourish (swoosh, crown, halo or star), a few drips. Fits w × h px (null if not).
export function tagImg(wr, w, h, seed) {
  for (let lh = Math.min(16, h - 5); lh >= 4; lh--) { const M0 = disp(wr.name, Math.round(lh * 1.3), 'marker'), M = M0.h >= lh - 1 && M0.h <= lh + 3 && M0.h > 8 ? M0 : lh >= 7 ? scaled(px5(wr.name), Math.max(1, Math.floor(lh / 7))) : px3(wr.name);
    const slant = 3 + ((H(seed, 1) * 3) | 0), extra = Math.ceil(M.h / slant), W = M.w + extra + 6, HH = M.h + 5; if (W > w || HH > h) continue;
    const I = new Img(W, HH), col = wr.tag, top = 2;
    for (let j = 0; j < M.h; j++) { const dx = Math.floor((M.h - j) / slant); for (let i = 0; i < M.w; i++) if (M.at(i, j)) I.set(2 + i + dx, top + j, col); }
    const fl = H(seed, 2);   // the flourish
    if (fl < .45) { for (let i = 0; i < W - 3; i++) I.set(1 + i, top + M.h + 1 - (i > W - 8 ? Math.round((i - (W - 8)) * .6) : 0), col); }            // swoosh underline with a flick
    else if (fl < .65) { const cx = 3 + extra; for (let k = -3; k <= 3; k++) I.set(cx + k, 1, col); for (const k of [-3, 0, 3]) I.set(cx + k, 0, col); }   // crown
    else if (fl < .8) { const cx = 2 + (M.w >> 1) + (extra >> 1); for (let k = -4; k <= 4; k++) I.set(cx + k, Math.abs(k) > 2 ? 1 : 0, col); }            // halo
    else star(I, W - 3, 2, 2, col);
    for (let i = 0; i < M.w; i++) if (M.at(i, M.h - 1) && H(seed + i, 3) < .18) { const dl = 1 + ((H(seed + i, 4) * 3) | 0); for (let t = 1; t <= dl; t++) I.set(2 + i, top + M.h - 1 + t, col); }   // drips
    return I; }
  return null;
}
// THROW-UP: bubble letters, fill · outline · white shine · a drop shadow. Fits w × h (px); null if the name can't.
export function throwImg(wr, w, h, seed) {
  for (let sc = 7; sc >= 1; sc--) { const r = Math.max(1, Math.round(sc * .75)), ow = sc >= 3 ? 2 : 1, L = grow(word(wr.name, sc, { gap: Math.max(0, sc - r), bounce: sc > 2, seed }), r + ow + 1);
    if (L.w + 3 > w || L.h + 3 > h) continue;
    const fill = dilate(L, r), outl = minus(dilate(fill, ow), fill), both = or(fill, outl), sh = minus(shift(both, 2, 2), both);
    const I = new Img(L.w + 3, L.h + 3); paintG(I, sh, 0, 0, wr.shadow); paintG(I, outl, 0, 0, wr.out); paintG(I, fill, 0, 0, (i, j) => (!gat(fill, i - 1, j) || !gat(fill, i, j - 1)) && gat(fill, i + 1, j + 1) && H(i, j + seed) < .8 ? WHITE : wr.fill);
    return I; }
  return null;
}
// FULL PIECE: bouncing block letters, fill bands, a 3D block, outline, highlights, sparkles, a cloud behind, the writer's tag small.
export function pieceImg(wr, way, w, h, seed, compact = false) {
  for (let sc = 9; sc >= 2; sc--) { const r = Math.max(1, Math.round(sc * .45)), d3 = Math.max(2, Math.round(sc * .6)), L = grow(word(wr.name, sc, { gap: Math.max(1, Math.round(sc * .5)), bounce: !compact, big: !compact, seed }), r + d3 + (compact ? 0 : 3));
    if (L.w > w - 2 || L.h > h - (compact ? 0 : 8)) continue;
    const I = new Img(compact ? L.w : w, compact ? L.h : h), ox = compact ? 0 : Math.round((w - L.w) / 2), oy = compact ? 0 : Math.max(1, Math.round((h - 8 - L.h) / 2));
    cloud(I, ox - 2, oy + 2, L.w + 4, L.h - 2, way.bg[0], seed, 9); cloud(I, ox + 4, oy + L.h * .35, L.w - 8, L.h * .6, way.bg[1], seed + 5, 6);   // the background: two clouds
    const fill = dilate(L, r); let block = G(L.w, L.h); for (let k = 1; k <= d3; k++) block = or(block, shift(fill, k, k)); block = minus(block, fill);
    const outl = minus(dilate(or(fill, block), 1), or(fill, block));
    const [b0, y1] = [fill.g.indexOf(1), 0]; let fy0 = L.h, fy1 = 0; for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (fill.g[i + j * L.w]) { fy0 = Math.min(fy0, j); fy1 = Math.max(fy1, j); }
    const band = j => way.fill[Math.min(way.fill.length - 1, Math.floor((j - fy0) / Math.max(1, (fy1 - fy0 + 1) / way.fill.length)))];
    paintG(I, outl, ox, oy, way.out); paintG(I, block, ox, oy, way.d3);
    paintG(I, fill, ox, oy, (i, j) => { const edge = !gat(fill, i - 1, j) || !gat(fill, i, j - 1); if (edge && gat(fill, i + 1, j + 1)) return WHITE; return ((i + j * 2 + seed) % 23 === 0) ? WHITE : band(j); });
    for (let k = 0; k < 4; k++) star(I, ox + Math.round(H(seed, 30 + k) * L.w), oy + Math.round(H(seed, 40 + k) * L.h * .5), sc > 4 ? 3 : 2, WHITE);
    if (!compact) small(I, wr.name + " '26", Math.max(1, w - px3(wr.name + " '26").w - 2), h - 6, wr.tag === WHITE ? INK : wr.tag, w - 2);
    return I; }
  return null;
}
// HEAVEN SPOT: straight block letters up at the roofline, readable from the street (white or silver, an ink drop shadow)
export function heavenImg(wr, w, h, seed) {
  for (let sc = 4; sc >= 1; sc--) { const L = grow(word(wr.name, sc, { gap: sc }), 2); if (L.w > w || L.h > h) continue; const I = new Img(L.w, L.h), c = [WHITE, C.chrome, C.yellow, wr.fill][(H(seed, 5) * 4) | 0];
    paintG(I, minus(shift(L, 1, 1), L), 0, 0, INK); paintG(I, L, 0, 0, c); return I; }
  return null;
}
// ROLL-DOWN SHUTTER (a side gate painted on bare wall): ribbed slats, the housing proud on top, a bottom bar and a padlock, then paint on it
export function gateImg(w, h, seed, spray) {
  const I = new Img(w, h); I.rect(0, 0, w, h, (x, y) => y % 2 ? 0x8f949c : 0xb9bec6);
  I.rect(0, 0, w, 4, 0x6f737c, 0, 2); I.rect(0, 3, w, 4, 0x575a62, 0, 2); I.rect(0, h - 2, w, h, INK, 0, 1); I.rect((w >> 1) - 1, h - 5, (w >> 1) + 2, h - 2, C.gold, 2, 1);
  if (spray) I.blit(spray, Math.max(0, Math.round((w - spray.w) / 2)), Math.max(5, Math.round((h - 2 - spray.h) / 2) + 2));
  return I;
}

// ───────────────────────── murals
// MEMORIAL: a stepped sky, the portrait (in a halo with wings, a cloud ring, stars, a sunburst or a taped-up photo), the title, the
// name on a ribbon, the years, roses. d.pal / d.style / d.title vary per design, so no two walls look alike. A low wall gets the
// landscape version: the portrait on the left, the words beside it.
const RIP_PAL = [[C.sky, 0x2f5bff, 0x1d3aa8], [0x7a3cff, 0x8c52ff, C.pink], [INK, 0x2a2d38, 0x3a3a42], [C.teal, C.sky, C.cyan], [C.pink, C.orange, C.yellow], [C.green, C.teal, 0x0b5a3a]];
function portrait(I, d, cx, cy, r, bands) { const st = d.style || 'wings';
  if (st === 'wings') for (const sg of [-1, 1]) for (let k = 0; k < 5; k++) { const len = Math.round(r * (1.5 - k * .2)), y = cy - r * .5 + k * Math.max(2, r * .28); I.rect(sg < 0 ? cx - r - len : cx + r, Math.round(y), sg < 0 ? cx - r : cx + r + len, Math.round(y) + Math.max(2, Math.round(r * .22)), k % 2 ? CREAM : WHITE); }
  else if (st === 'clouds') for (let k = 0; k < 10; k++) { const t = k / 10 * Math.PI * 2; I.disc(cx + Math.cos(t) * (r + 3), cy + Math.sin(t) * (r + 2), Math.max(2, r * .38), WHITE); }
  else if (st === 'stars') for (let k = 0; k < 7; k++) { const t = k / 7 * Math.PI * 2 + .3; star(I, Math.round(cx + Math.cos(t) * (r + 5)), Math.round(cy + Math.sin(t) * (r + 4)), 2, k % 2 ? C.yellow : WHITE); }
  else if (st === 'sun') for (let y = cy - r * 2; y <= cy + r * 2; y++) for (let x = cx - r * 2.4; x <= cx + r * 2.4; x++) { const q = Math.hypot(x - cx, y - cy); if (q > r + 1 && q < r * 2 && ((Math.atan2(y - cy, x - cx) / Math.PI * 9 + 18) | 0) % 2) I.set(x, y, C.yellow); }
  if (st === 'photo') { I.rect(cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 5, WHITE); I.rect(cx - r, cy - r, cx + r, cy + r, mix(bands[0], WHITE, .45)); fig(I, d.look, cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 1, { crop: 'bust', maxSc: 4 }); I.rect(cx - 3, cy - r - 4, cx + 3, cy - r - 1, 0xd9d2c3); return; }   // (a photo taped up)
  I.disc(cx, cy, r + 2, d.gold ? C.gold : WHITE); I.disc(cx, cy, r, mix(bands[0], WHITE, .55)); fig(I, d.look, cx - r + 1, cy - r + 2, 2 * r - 2, 2 * r - 2, { crop: 'bust', maxSc: 4 }); }
function roses(I, w, h, k0) { for (const [x0, sg] of [[3, 1], [w - 4, -1]]) for (let k = 0; k < 3; k++) { const rx2 = x0 + sg * k * 4, ry2 = h - 5 - (k % 2) * 3; I.rect(rx2, ry2 + 2, rx2 + 1, h, C.green); I.disc(rx2 + .5, ry2, 2, [C.red, C.pink, C.yellow, WHITE][(k + k0) % 4]); } }
export function ripImg(d, w, h) {
  const I = new Img(w, h), s = d.seed, bands = RIP_PAL[(d.pal ?? s) % RIP_PAL.length], title = d.title || 'R.I.P.';
  for (let y = 0; y < h; y++) I.rect(0, y, w, y + 1, bands[Math.min(2, Math.floor(y / (h / 3)))]);
  const yrs = `${d.born} - ${d.died}`;
  if (h < 38) {   // the low wall: portrait left, the words right
    const r = Math.max(5, Math.floor(h / 2) - 3), cx = r + 4, cy = Math.floor(h / 2); portrait(I, { ...d, style: d.style === 'wings' ? 'clouds' : d.style }, cx, cy, r, bands);
    const tx = cx + r + 6, tw = w - tx - 2; let y = 2; y += words(I, title, tx, y, tw, Math.max(5, Math.round(h * .24)), d.gold ? C.gold : WHITE, { face: 'serif', shadow: INK, top: true }) + 2;
    const rh = Math.max(6, Math.round(h * .3)); I.rect(tx, y, tx + tw, y + rh, C.red); words(I, d.nick, tx + 1, y, tw - 2, rh, WHITE, { face: 'black' }); y += rh + 2;
    const M = px5(yrs).w <= tw && y + 7 <= h ? px5(yrs) : px3(yrs); if (M.w <= tw && y + M.h <= h) I.text(M, tx + ((tw - M.w) >> 1), y, WHITE);
    roses(I, w, h, s); return I; }
  cloud(I, 0, h - Math.round(h * .24), w, Math.round(h * .24), WHITE, s, 11);
  const th = Math.max(6, Math.round(h * .15)); words(I, title, 2, 1, w - 4, th, d.gold ? C.gold : WHITE, { face: 'serif', shadow: INK });
  const rh = Math.max(7, Math.round(h * .13)), dh = h >= 56 ? 9 : 0, r = Math.max(5, Math.min(Math.round(w * .2), Math.floor((h - th - rh - dh - 10) / 2))), cx = w >> 1, cy = th + 3 + r;
  portrait(I, d, cx, cy, r, bands);
  const ry = cy + r + 4, rw = Math.min(w - 14, Math.max(24, Math.round(w * .7))), rx = cx - (rw >> 1), rc = [C.red, 0x2f5bff, INK, C.violet][(d.pal ?? 0) % 4];   // the ribbon
  I.rect(rx, ry, rx + rw, ry + rh, rc); for (let k = 0; k < rh; k++) { const t = Math.abs(k - (rh >> 1)); I.rect(rx - 6 + t, ry + 2 + k, rx, ry + 3 + k, shade(rc, .75)); I.rect(rx + rw, ry + 2 + k, rx + rw + 6 - t, ry + 3 + k, shade(rc, .75)); }
  words(I, d.nick, rx + 2, ry + 1, rw - 4, rh - 2, WHITE, { face: 'black' });
  const Y = ry + rh + 2; if (px5(yrs).w <= w - 4 && Y + 7 <= h - 1) I.textC(px5(yrs), cx, Y, INK);
  else for (const [yr, x] of [[d.born, cx - r - Math.round(r * .8)], [d.died, cx + r + Math.round(r * .8)]]) { const M = px5(String(yr)).w <= r * 1.5 ? px5(String(yr)) : px3(String(yr)); I.rect(x - (M.w >> 1) - 1, cy + Math.round(r * .75) - 1, x + (M.w >> 1) + 2, cy + Math.round(r * .75) + M.h + 1, WHITE); I.textC(M, x + .5, cy + Math.round(r * .75), INK); }   // (no room below: the years sit under the wings)
  if (dh && Y + 16 < h - 1) small(I, d.line, Math.max(1, cx - (px3(d.line).w >> 1)), Y + 10, shade(bands[2], .6), w - 2);
  roses(I, w, h, s);
  return I;
}
// a tag small enough for a dumpster or a tank: the 3 × 5 hand, an underline, a drip
export function tinyTag(wr, w, h, seed) { const M = px3(wr.name); if (M.w + 2 > w || M.h + 3 > h) return null; const I = new Img(M.w + 2, M.h + 3), c = wr.tag;
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) I.set(1 + i + (j < 2 ? 1 : 0), j, c);
  for (let i = 0; i < M.w; i++) I.set(1 + i, M.h + 1, c); I.set(1 + ((H(seed, 1) * M.w) | 0), M.h + 2, c); return I; }
// BOXING: ring ropes, a spotlight, the champ (arm raised) with the belt, the title, the name, the record
export function boxImg(d, w, h) {
  const I = new Img(w, h), s = d.seed, bg = pickOf([C.blue, C.red, INK, 0x7a3cff], s, 1); I.rect(0, 0, w, h, bg);
  const th = Math.max(7, Math.round(h * .16)); words(I, d.title, 2, 2, w - 4, th, C.yellow, { face: 'impact', shadow: INK });
  I.disc(w * .5, h * .56, Math.min(w, h) * .34, mix(bg, C.yellow, .55));
  for (const [k, c] of [[.52, C.red], [.64, WHITE], [.76, C.blue]]) I.rect(0, Math.round(h * k), w, Math.round(h * k) + 2, c);   // ropes
  const fy = th + 4, fh = h - fy - 12, F = fig(I, d.look, Math.round(w * .2), fy, Math.round(w * .6), fh, { pose: 'up', side: s % 2 ? 1 : -1, crop: 'full', maxSc: 5 });
  if (F) { const by = F[1] + Math.round(F[3] * .55); I.rect(F[0] + Math.round(F[2] * .18), by, F[0] + Math.round(F[2] * .82), by + Math.max(2, Math.round(F[3] * .06)), C.gold); I.disc(F[0] + F[2] / 2, by + 1, Math.max(2, F[3] * .05), C.yellow); }
  const gl = iconImg('glove'), gs = Math.max(1, Math.floor(Math.min(w * .16 / gl.w, h * .2 / gl.h))); I.blit(gl, 2, h - 12 - gl.h * gs, { sc: gs }); I.blit(gl, w - 2 - gl.w * gs, h - 12 - gl.h * gs, { sc: gs, fx: true });
  I.rect(0, h - 11, w, h, INK); words(I, d.name, 2, h - 10, w - 4, 5, WHITE, { face: 'px5' }); small(I, d.rec, Math.max(1, (w - px3(d.rec).w) >> 1), h - 5, C.yellow, w - 2);
  return I;
}
// BASKETBALL: a court colour, the lines, a backboard and a chain net, a baller rising, the court's name and its rule
export function hoopImg(d, w, h) {
  const I = new Img(w, h), s = d.seed, bg = pickOf([C.orange, 0x2f5bff, C.green, 0x7a3cff, C.red], s, 1), side = s % 2 ? 1 : -1; I.rect(0, 0, w, h, bg);
  const fl = Math.round(h * .78); I.rect(0, fl, w, h, shade(bg, .78)); for (let x = 0; x < w; x++) { const t = (x - w / 2) / (w * .38); if (Math.abs(t) <= 1) I.set(x, fl + Math.round((1 - t * t) * (h - fl - 2)), WHITE); } I.rect(0, fl, w, fl + 1, WHITE);
  const bw = Math.max(10, Math.round(w * .22)), bx = side > 0 ? w - bw - 3 : 3, byy = Math.round(h * .16), bh = Math.round(bw * .62); I.rect(bx, byy, bx + bw, byy + bh, WHITE); I.frame(bx + (bw >> 2), byy + (bh >> 2), bx + bw - (bw >> 2), byy + bh, C.red, 1);
  const rim = byy + bh - 1, rx0 = bx + (bw >> 2) - 1, rx1 = bx + bw - (bw >> 2) + 1; I.rect(rx0, rim, rx1, rim + 1, C.orange); for (let k = 0; k < 6; k++) for (let x = rx0 + 1; x < rx1 - 1; x += 2) I.set(x + (k % 2), rim + 1 + k, 0xc9ced6);   // chain net
  const F = fig(I, d.look, side > 0 ? Math.round(w * .08) : Math.round(w * .38), Math.round(h * .12), Math.round(w * .54), fl - Math.round(h * .12) + 4, { pose: 'up', side, crop: 'full', maxSc: 5 });
  const ball = iconImg('ball'), bs = Math.max(1, Math.floor(Math.min(w, h) * .12 / ball.w)); const ax = F ? (side > 0 ? F[0] + F[2] - 2 : F[0] - ball.w * bs + 2) : w >> 1, ay = F ? F[1] - 2 : h >> 2; I.blit(ball, ax, Math.max(0, ay), { sc: bs, tint: c => c === 0xe8232a ? C.orange : c === WHITE ? 0xd9642a : c });
  const tx = side > 0 ? 2 : bx + bw + 2, tw = side > 0 ? bx - 4 : w - tx - 2; words(I, d.court, tx, 2, Math.max(8, tw), Math.max(6, Math.round(h * .14)), WHITE, { face: 'impact', shadow: INK, top: true });
  small(I, d.rule, Math.max(1, (w - px3(d.rule).w) >> 1), h - 6, WHITE, w - 2);
  return I;
}
// COLLECTOR WALL: grails in slabs. A header, a row or two of graded cards (a character, a holo edge, a grade), a price-free brag.
export function collectImg(d, w, h) {
  const I = new Img(w, h), s = d.seed, bg = pickOf([C.yellow, C.teal, INK, C.pink, 0x2f5bff], s, 1), fg = inkOn(bg); I.rect(0, 0, w, h, bg);
  const th = Math.max(7, Math.round(h * .16)); I.rect(0, 1, w, th + 3, fg); words(I, d.head, 2, 2, w - 4, th, bg, { face: 'black' });
  const rows = h - th > 60 ? 2 : 1, cw = Math.max(12, Math.min(26, Math.round((h - th - 8) / rows * .72))), chh = Math.round(cw * 1.38), cols = Math.max(1, Math.floor((w - 4) / (cw + 3))), mx = Math.round((w - cols * (cw + 3) + 3) / 2);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const x = mx + k * (cw + 3), y = th + 6 + r * (chh + 4); if (y + chh > h - 1) continue; const q = s * 31 + r * 7 + k;
    I.rect(x, y, x + cw, y + chh, 0xdfe3ea); I.rect(x + 1, y + 1, x + cw - 1, y + 5, C.red); small(I, '10', x + 2, y + 1, WHITE, cw - 3);   // the slab + its grade label
    const holo = [C.cyan, C.pink, C.yellow, C.lime][q % 4]; I.rect(x + 2, y + 6, x + cw - 2, y + chh - 2, holo); I.rect(x + 3, y + 7, x + cw - 3, y + chh - 3, pickOf([C.blue, C.violet, C.orange, C.green, C.red], q, 3));
    if (charsReady()) fig(I, look(q), x + 3, y + 8, cw - 6, chh - 12, { crop: 'bust', maxSc: 2 }); else { const ic = iconImg(pickOf(['star', 'crown', 'diamond', 'flame', 'bolt'], q, 4)); I.blit(ic, x + ((cw - ic.w) >> 1), y + ((chh - ic.h) >> 1)); } }
  return I;
}
// ART SCENE: a giant head on stripes, a giant object on a sunburst, or shapes; a painter's signature small in the corner
export function artImg(d, w, h) {
  const I = new Img(w, h), s = d.seed, cols = pickOf([[C.pink, C.yellow, C.blue, INK], [C.orange, C.teal, C.cream, C.violet], [C.lime, C.violet, WHITE, C.red], [C.red, C.cyan, C.yellow, INK], [C.blue, C.orange, C.pink, WHITE]], s, 1);
  if (d.style === 'head') { const st = Math.max(3, Math.round(Math.min(w, h) / 12)); I.rect(0, 0, w, h, (x, y) => (Math.floor((x + y) / st) % 2 ? cols[0] : cols[1]));
    if (!fig(I, d.look, 2, 2, w - 4, h - 6, { crop: 'head', maxSc: 9 })) { I.disc(w / 2, h / 2, Math.min(w, h) * .32, cols[2]); } }
  else if (d.style === 'icon') { I.rect(0, 0, w, h, cols[0]); const cx = w / 2, cy = h / 2; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((Math.atan2(y - cy, x - cx) / Math.PI * 8 + 16) | 0) % 2) I.set(x, y, cols[1]);
    const ic = iconImg(d.icon), sc = Math.max(1, Math.floor(Math.min((w - 6) / ic.w, (h - 10) / ic.h))); I.blit(ic, Math.round((w - ic.w * sc) / 2), Math.round((h - ic.h * sc) / 2), { sc }); }
  else { I.rect(0, 0, w, h, cols[3] === INK ? C.cream : cols[3]); for (let k = 0; k < 9; k++) { const c = cols[k % 3], x = H(s, 10 + k) * w, y = H(s, 20 + k) * h, r = Math.max(3, Math.min(w, h) * (.1 + H(s, 30 + k) * .18));
    if (k % 3 === 0) I.disc(x, y, r, c); else if (k % 3 === 1) { for (let t = 0; t < r * 2; t++) I.rect(Math.round(x - t / 2), Math.round(y - r + t), Math.round(x + t / 2) + 1, Math.round(y - r + t) + 1, c); }
    else for (let t = 0; t < r * 3; t++) I.rect(Math.round(x - r * 1.5 + t), Math.round(y + Math.sin(t / 2.2) * 2), Math.round(x - r * 1.5 + t) + 1, Math.round(y + Math.sin(t / 2.2) * 2) + 2, INK); } }
  const sig = d.sig; const M = px3(sig); if (M.w < w - 4) { I.rect(w - M.w - 4, h - 8, w - 1, h - 1, d.plaque ? C.gold : cols[3] === WHITE ? INK : WHITE); I.text(M, w - M.w - 2, h - 7, d.plaque ? INK : cols[3] === WHITE ? WHITE : INK); }
  return I;
}
// NEIGHBOURHOOD: a stepped sky, the sun, a skyline, the street, the block's words across the sky, neighbours standing in front
export function hoodImg(d, w, h) {
  const I = new Img(w, h), s = d.seed, sky = pickOf([[C.pink, C.orange, C.yellow], [C.sky, C.cyan, WHITE], [C.violet, C.pink, C.orange], [C.teal, C.lime, C.yellow]], s, 1);
  for (let y = 0; y < h; y++) I.rect(0, y, w, y + 1, sky[Math.min(2, Math.floor(y / (h * .55 / 3)))]);
  I.disc(w * (.2 + H(s, 2) * .6), h * .42, Math.min(w, h) * .16, C.yellow);
  const base = Math.round(h * .8); let x = 0, k = 0; while (x < w) { const bw = 6 + ((H(s, 50 + k) * 10) | 0), bh = Math.round(h * (.22 + H(s, 60 + k) * .3)), c = pickOf([C.red, C.blue, C.violet, INK, C.green, C.orange, 0x9b4f3a], s + k, 7);
    I.rect(x, base - bh, x + bw, base, c); for (let wy = base - bh + 2; wy < base - 2; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) if (H(wx, wy + s) < .6) I.set(wx, wy, H(wx, wy, s) < .3 ? C.yellow : 0x1b2a55); x += bw + 1; k++; }
  I.rect(0, base, w, h, 0x5d5e6b); for (let xx = 2; xx < w; xx += 6) I.rect(xx, base + ((h - base) >> 1), xx + 3, base + ((h - base) >> 1) + 1, C.yellow);
  if (d.kids) { for (let k2 = 0; k2 < 5; k2++) { const r = Math.min(w, h) * (.42 - k2 * .04); for (let t = 0; t < 180; t++) { const a = Math.PI * t / 179; I.set(w / 2 + Math.cos(a) * r, h * .62 - Math.sin(a) * r * .8, [C.red, C.orange, C.yellow, C.green, C.blue][k2]); } }
    for (let k2 = 0; k2 < 6; k2++) { const hx = 4 + H(s, 80 + k2) * (w - 10), hy = base + 1; I.rect(hx, hy, hx + 3, hy + 3, [C.pink, C.lime, C.cyan, C.yellow][k2 % 4]); } }
  else { const n = Math.max(2, Math.min(5, Math.floor(w / 22))); for (let k2 = 0; k2 < n; k2++) fig(I, look(s * 13 + k2), Math.round(k2 * w / n), Math.round(h * .45), Math.round(w / n), h - Math.round(h * .45), { crop: 'chest', maxSc: 3 }); }
  words(I, d.line, 3, 2, w - 6, Math.max(7, Math.round(h * .22)), WHITE, { face: 'impact', shadow: INK, top: true });
  return I;
}
// ───────────────────────── the hand-painted ad frame: a painted border, the design inside, the painter's credit; faded = old
export function framed(inner, w, h, o = {}) {
  const I = new Img(w, h), bd = o.border ?? INK; I.rect(0, 0, w, h, bd); I.rect(2, 2, w - 2, h - 2, o.bg ?? WHITE); I.blit(inner, 3, 3);
  if (o.credit) { const M = px3(o.credit); if (M.w < w - 8) I.text(M, w - M.w - 3, h - 2 - M.h + (inner.h + 6 < h ? 0 : 1), inkOn(o.bg ?? WHITE) === INK ? shade(bd, 1) : WHITE); }
  return I;
}
// fade a picture toward the wall and let the wall show through in patches (the old ones)
export function fade(I, wall, k, seed) { for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) { const q = i + j * I.w, c = I.c[q]; if (c < 0) continue; const n = hash(i >> 2, j >> 2, seed + 17), m = hash(i >> 1, j >> 1, seed + 5);
  I.c[q] = n > .93 && m > .4 && I.t[q] < 0 ? -1 : mix(c, wall, k + (n > .8 ? .1 : 0)); I.z[q] = 0; } return I; }   // (bare wall shows in patches, never through a letter)
