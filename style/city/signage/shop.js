// SIGNAGE · the shopfront (owner: the signage agent; facade.js routes shopRun and the window display here). One shop between a0 and
// a1 on a 36-voxel ground floor: band, door, stocked window, sign (6 kinds), blade. Pass 3 (signage): the name on the sign is the
// shop's own (names.js: a default trade gets a name no neighbour within ~3 blocks has), the window card says the trade's word, a
// strip of window vinyl carries its pitch (clear of the card, never behind a gate), and the blade gets a frame that glows at night.
// Every envelope is pass 2's: nothing new projects from the wall, so placement and the audit see the same shop.
import { textMask } from '../vox.js';
import { AIR, TOD } from '../kit.js';
import { PAL, hash, shade } from '../style.js';
import { shopName, vinylFor, wasOf } from './names.js';
import { logSign } from './alloc.js';
import { px3 } from './art.js';
import { TAGS, UTIL, BODEGA_BAND, BODEGA_BANDS } from './lexicon.js';
import { tradeOf } from './lexicon.js';
import { LETTERS, mask as typeMask, glyphMask } from './type/index.js';
import { pickFace } from './type/pick.js';
import { noteFront } from '../interiors/store/fill.js';   // hardening: the shop-window coverage log (off unless a tool turns it on)

const TMC = new Map(), tm = s => { let m = TMC.get(s); if (!m) TMC.set(s, m = textMask(s)); return m; };
const LIGHT = new Set([0xffe23a, 0xffc21a, 0x2de2e6, 0x6cff4a, 0xf7f7f2, 0xfff0d0, 0xffffff]);
const inkOn = c => LIGHT.has(c) ? PAL.ink : PAL.white;
const lit = () => TOD.night ? 3 : 0;
function fitText(s, maxW) { s = String(s); if (tm(s).w <= maxW) return s; const w = s.split(' ').filter(x => x !== 'THE' && x !== '&' && x !== '·');
  for (let n = w.length - 1; n > 0; n--) { const t = w.slice(0, n).join(' '); if (tm(t).w <= maxW) return t; } return w.find(x => x.length > 1 && tm(x).w <= maxW) ?? ''; }
const lum = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255;
// lettering pass (2026-09-29) · the name on the board in its face (type/pick.js). 'pixel' is the 5×7 face exactly as before (f.text; every
// sign with ?letters=classic). A face sets its words on the band's baseline (y 28, the 5×7 face's bottom row) centred on cx; its second
// colour (varsity's drop shadow: the board's own dark; neon's halo: the tube's, glowing with it) goes down first, unrecorded, and the
// letters over it are recorded like any text run (the audit's board check, the mid tier's 0.1 detail)
function letter(f, txt, face, cx, d0, d1, c, l, board, seed) {
  if (face === 'pixel') return f.text(txt, cx, 35, d0, d1, c, l, 1, 1);
  const M = typeMask(face, txt, { seed: seed & 7 }), x = Math.round(cx - M.w / 2), ytop = 29 + M.base;
  const fxc = face === 'neon' ? shade(c, .4) : lum(board) < .25 ? shade(c, .45) : shade(board, .55), fxl = face === 'neon' ? l : 0;
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.fx(i, j)) f.box(x + i, ytop - j - 1, d0, x + i + 1, ytop - j, d1, fxc, fxl);
  f.mask(M, x, ytop, d0, d1, c, l); return M.w;
}
const wpos = (f, a) => { const [x, z] = f.xz(a, 0), V = f.V; return [V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s]; };

// ───────────────────────── the window display (pass 1d, unchanged): stuff seen through the glass, recess 8 deep
export const DISP = { food: [0xf7f7f2, 0xe8232a, 0xffd21f, 0xc9782a], cakes: [0xff7ab6, 0xf7f7f2, 0xffe23a, 0x8b4a24], phones: [0x17171b, 0x2de2e6, 0xf7f7f2, 0x2f5bff], clothes: [0xff4fa3, 0x2f5bff, 0x6cff4a, 0xf7f7f2, 0x17171b],
  shoes: [0xf7f7f2, 0xe8232a, 0x17171b, 0x6cff4a], gold: [0xe7bd4a, 0xffe23a, 0x17171b], bottles: [0x7a3cff, 0x25b84c, 0xe8232a, 0xffe23a, 0x8b4a24], machines: [0xf7f7f2, 0x2a2d38], office: [0xf7f7f2, 0x2f5bff, 0xffe23a],
  misc: [0xff4fa3, 0xffe23a, 0x2de2e6, 0xe8232a, 0x2f5bff], barber: [0xe8232a, 0xf7f7f2, 0x9fd8ff] };
// fit-out pass (interiors/store/fill.js): `room` — a stocked room stands behind the glass, so the niche has no back panel and the display
// stands low on the sill (nothing hangs on a back panel: the menu board, the barber's mirrors and the upper shelves stay out; shoe shelves get uprights)
export function display(f, a0, a1, kind, seed, room = false) {
  const cols = DISP[kind] || DISP.misc; f.box(a0, 6, -10, a1, 24, 2, AIR); if (!room) f.box(a0, 6, -11, a1, 24, -10, 0xf2efe6); f.box(a0, 5, -11, a1, 6, -3, 0xd8d3c8); f.box(a0, 23, -11, a1, 24, -3, 0xfffbe8, 3);
  if (kind === 'machines') { for (let a = a0 + 1; a + 6 <= a1; a += 8) { f.box(a, 6, -10, a + 6, 13, -5, 0xf7f7f2); for (let t = 0; t < 12; t++) { const u = t / 12 * 6.283; f.set(a + 3 + Math.round(Math.cos(u) * 2), 9 + Math.round(Math.sin(u) * 2), -5, 0x2a2d38); } f.box(a, 13, -10, a + 6, 19, -5, 0xf7f7f2); f.box(a + 2, 15, -5, a + 4, 17, -4, 0x9fd8ff, 1); } return; }
  if (kind === 'barber') { for (let a = a0 + 2; a + 5 <= a1; a += 9) { f.box(a, 6, -8, a + 5, 10, -4, PAL.red); f.box(a, 10, -9, a + 5, 16, -7, PAL.red); if (!room) f.box(a - 1, 12, -11, a + 6, 21, -10, 0x9fd8ff, 1); } return; }
  if (kind === 'food') { f.box(a0, 6, -7, a1, 11, -4, 0xf7f7f2); for (let a = a0 + 1; a < a1 - 2; a += 4) f.box(a, 11, -7, a + 3, 12, -5, cols[(a + seed) % cols.length]); if (!room) { f.box(a0 + 2, 15, -11, a1 - 2, 22, -10, PAL.ink); for (let a = a0 + 3; a < a1 - 3; a += 2) f.set(a, 20 - ((a * 3 + seed) % 4), -10 + 1, 0xffe3a0, TOD.night ? 3 : 1); } return; }
  if (kind === 'clothes' || kind === 'shoes') { for (let a = a0 + 2; a + 3 <= a1; a += 6) { const c = cols[(a * 7 + seed) % cols.length]; if (kind === 'clothes') { f.box(a, 6, -7, a + 1, 13, -6, PAL.iron); f.box(a - 1, 13, -8, a + 3, 20, -5, c); f.box(a, 20, -7, a + 2, 22, -6, 0xe0b48f); } else { if (room) f.box(a, 6, -10, a + 4, 22, -9, 0xe9e5dc); for (let y = 8; y < 22; y += 4) { f.box(a, y, -10, a + 3, y + 2, -7, c); f.box(a, y - 1, -10, a + 4, y, -6, 0xe9e5dc); } } } return; }
  if (room) f.box(a0, 6, -10, a1, 7, -6, 0xe9e5dc);
  for (const y of room ? [8] : [8, 14, 19]) { f.box(a0, y - 1, -10, a1, y, -6, 0xe9e5dc); for (let a = a0; a < a1; a++) if (hash(a, y, seed) > .3) f.box(a, y, -10, a + 1, y + 2 + ((hash(a, y, seed + 1) * 2) | 0), -7, cols[(hash(a, y + 3, seed) * cols.length) | 0], kind === 'phones' && hash(a, y) > .6 ? (TOD.night ? 3 : 1) : 0); }
}
const TRADE = { food: 'EAT', cakes: 'SWEET', phones: 'CELL', clothes: 'FITS', shoes: 'KICKS', gold: 'GOLD', bottles: 'LIQ', machines: 'WASH', office: 'OPEN', misc: 'OPEN', barber: 'CUTS' };
const CARDS = { food: ['OPEN', 'HOT', 'EAT'], cakes: ['OPEN', 'FRESH'], phones: ['OPEN', 'FIX'], clothes: ['SALE', 'NEW'], shoes: ['SALE', 'DROP'], gold: ['CASH', 'GOLD', 'PAWN'], bottles: ['COLD', 'BEER', 'ICE'],
  machines: ['OPEN', 'WASH'], office: ['OPEN', 'ATM', 'FAX'], misc: ['OPEN', 'ATM', 'SALE'], barber: ['OPEN', 'CUTS'] };

export function shopRun(f, o) {   // one shop between a0 and a1 on a ground floor 36 tall; returns the door centre (a)
  const { a0, a1, sign, kind, disp, seed } = o, band = o.band ?? PAL.ink, W = a1 - a0, [wx, wz] = wpos(f, (a0 + a1) >> 1);
  const own = !(o.name && typeof o.name === 'object' && o.name.trade), name = shopName(o.name, wx, wz, s => tm(s).w <= W - 6, { log: false });
  f.box(a0, 0, 0, a1, 36, 2, band); f.box(a0, 0, 0, a1, 5, 3, shade(band === PAL.ink ? sign : band, .75));
  const doorAt = o.doorLeft ? a0 + 3 : a1 - 17; f.box(doorAt, 1, -4, doorAt + 13, 26, 3, AIR); f.box(doorAt, 1, -5, doorAt + 13, 26, -4, (a, y) => (y > 21 || a === doorAt + 6) ? 0xffe3a0 : 0x2a2d38, 1);
  f.box(doorAt + 2, 11, -4, doorAt + 11, 12, -3, 0xdfe6ee, 2);
  const wa0 = o.doorLeft ? doorAt + 16 : a0 + 3, wa1 = o.doorLeft ? a1 - 3 : doorAt - 3;
  if (wa1 - wa0 >= 8) { display(f, wa0, wa1, disp, seed, !!o.room); noteFront(f, wa0, wa1, 'shop', o.room); f.box(wa0 - 1, 5, 0, wa1 + 1, 6, 4, band === PAL.ink ? PAL.white : band);
    // the lit card in the corner of the glass: the trade's word
    const cw = CARDS[disp] || CARDS.misc, s2 = cw[(seed >>> 0) % cw.length], t = tm(s2); let cardX = wa1;
    if (hash(seed, 3) > .45 && t.w + 6 <= wa1 - wa0) { cardX = wa1 - t.w - 3; f.box(cardX, 15, -3, wa1 - 1, 24, -2, PAL.ink); f.mask(t, wa1 - t.w - 2, 23, -2, -1, [PAL.red, PAL.pink, PAL.lime, PAL.cyan][seed % 4], 3); }
    // window vinyl across the top of the glass (the pitch), left of the card; a gate would sit in front of it, so never with one
    if (!o.gate && hash(seed, 12) < .55) { const v = vinylFor(o.name, disp, seed), M = px3(v), room = cardX - wa0 - 2;
      if (M.w + 4 <= room) { const vb = [PAL.red, PAL.yellow, PAL.white, 0x2f5bff][(hash(seed, 13) * 4) | 0], vx = wa0 + 1 + ((room - M.w - 2) >> 1);
        f.box(wa0, 17, 0, cardX - 1, 24, 1, vb); f.mask(M, vx, 23, 1, 2, inkOn(vb), lit()); } } }
  if (o.gate && W > 20) { const gh = 10 + (seed % 12); f.box(wa0, 24 - gh, 2, wa1, 25, 3, (a, y) => y % 2 ? 0x8f949c : 0xb9bec6); const tg = tm(o.tag || TAGS[(seed >>> 0) % TAGS.length]); if (tg.w + 4 <= wa1 - wa0) f.mask(tg, wa0 + 2, 24 - 1, 3, 4, (i) => [PAL.pink, PAL.lime, PAL.cyan, PAL.yellow][(i >> 1) % 4], 0); }
  const full = fitText(name, W - 6), forceBlade = !full || full.length < name.replace(/ ·.*$/, '').length * .5, txt = forceBlade ? (TRADE[disp] || 'OPEN') : full, tc = inkOn(sign);
  const tube = sign === PAL.ink ? PAL.pink : sign, board = kind === 'awnBox' ? o.awn : kind === 'neon' ? tube : sign;
  const face = LETTERS.mode === 'classic' || !txt ? 'pixel' : pickFace({ name: o.name, disp, kind, seed, board, txt, maxW: W - 6, x: wx, z: wz });
  if (kind === 'awnSlope') { f.box(a0, 27, 0, a1, 36, 3, sign);
    for (let d = 2; d < 15; d++) { const y = 26 - Math.round((d - 2) * .36); f.box(a0, y, d, a1, y + 1, d + 1, (a) => ((a >> 2) & 1) ? o.awn : PAL.white); } f.box(a0, 19, 14, a1, 22, 15, o.awn);
    if (txt) letter(f, txt, face, (a0 + a1) >> 1, 3, 4, tc, lit(), board, seed); }
  else if (kind === 'awnBox') { f.box(a0, 26, 2, a1, 37, 15, o.awn); f.box(a0, 26, 13, a1, 28, 15, shade(o.awn, .78)); if (txt) letter(f, txt, face, (a0 + a1) >> 1, 15, 16, inkOn(o.awn), lit(), board, seed); }
  else if (kind === 'box') { f.box(a0 + 1, 26, 2, a1 - 1, 37, 7, sign); f.box(a0 + 1, 26, 2, a1 - 1, 27, 7, PAL.ink); f.box(a0 + 1, 36, 2, a1 - 1, 37, 7, PAL.ink); if (txt) letter(f, txt, face, (a0 + a1) >> 1, 7, 8, tc, lit(), board, seed); }
  else if (kind === 'neon') { f.box(a0, 27, 0, a1, 36, 3, PAL.ink); if (txt) letter(f, txt, face, (a0 + a1) >> 1, 3, 4, tube, 3, PAL.ink, seed); for (let a = a0 + 1; a < a1 - 1; a += 2) f.set(a, 27, 3, sign === PAL.ink ? PAL.pink : sign, 3); }
  else { f.box(a0, 27, 0, a1, 36, 4, sign); if (txt) letter(f, txt, face, (a0 + a1) >> 1, 4, 5, tc, lit(), board, seed); }
  if (kind === 'blade' || o.blade || forceBlade) { const w0 = name.split(' ').find(w => w.length > 1 && w !== 'THE') || name, bt = forceBlade ? w0.slice(0, 8) : fitText(w0, 40).slice(0, 5), ba = o.doorLeft ? a1 - 4 : a0 + 3, top = 40 + bt.length * 8 + 4;
    f.box(ba, 38, 1, ba + 1, 40, 14, PAL.iron); f.box(ba - 1, 40, 2, ba + 2, top, 14, sign);
    // a frame round each lettered face, the letters' colour, one voxel proud like them (a neon tube at night); the letters in the shop's face
    for (const x of [ba - 2, ba + 2]) { for (let d = 2; d < 14; d++) { f.set(x, 40, d, tc, lit()); f.set(x, top - 1, d, tc, lit()); } for (let y = 41; y < top - 1; y++) { f.set(x, y, 2, tc, lit()); f.set(x, y, 13, tc, lit()); } }
    f.V.recNext(); [...bt].forEach((ch, i) => { const G = face !== 'pixel' ? glyphMask(face, ch) : null, M = G && G.w <= 10 ? G : tm(ch); for (let j = 0; j < 7; j++) for (let k = 0; k < M.w; k++) if (M.at(k, j)) { const y = 40 + bt.length * 8 - i * 8 - j, d1 = 4 + k + ((10 - M.w) >> 1), d2 = 4 + (M.w - 1 - k) + ((10 - M.w) >> 1);
      f.set(ba - 2, y, d1, tc, lit()); f.rec(bt, ba - 2, y, d1, -1, 0); f.set(ba + 2, y, d2, tc, lit()); f.rec(bt, ba + 2, y, d2, 1, 0); } }); }
  if (name && !UTIL.has(name)) logSign('name', name, wx, wz, { r: own ? 0 : 96, own: own ? 'kit' : undefined, where: 'shop', trade: tradeOf(o.name) || undefined, was: own ? undefined : wasOf(name, wx, wz) });
  else if (name === BODEGA_BAND || BODEGA_BANDS.includes(name)) logSign('util', name, wx, wz, { r: 0, where: 'band', was: name !== BODEGA_BAND ? BODEGA_BAND : undefined });   // (the bodega's side band: the census counts it)
  return doorAt + 6;
}
