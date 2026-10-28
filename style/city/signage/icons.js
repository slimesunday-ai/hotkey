// SIGNAGE · the reserve's product icons (owner: the signage agent; art.js keeps the pass-3 set). Same format as art.js ICON_SRC: one
// character per pixel, '.' clear; paint.js asks here first and falls back to art.js, so every pass-3 design paints as it did.
import { Img, INK, WHITE } from './art.js';
const P = { K: INK, W: WHITE, w: 0xdcd6c8, Y: 0xffe23a, y: 0xe7bd4a, O: 0xff7a1a, R: 0xe8232a, r: 0x9a1418, G: 0x14a83b, B: 0x2f5bff, b: 0x1d3aa8, C: 0x2de2e6, S: 0x9a9ba2, s: 0x5b5e66,
  N: 0x8b4a24, n: 0x5a3a22, P: 0xff4fa3, V: 0x7a3cff, T: 0x12b3a0, L: 0x9fd8ff, D: 0xc9a877 };
const SRC = {
  siren: ['....RRRR....', '...RWRRRR...', '..RRWRRRRR..', '..RRRRRRRR..', '..RRRRRRRR..', '.SSSSSSSSSS.', 'SSSSSSSSSSSS', 'K..........K'],
  safe: ['KKKKKKKKKKKK', 'KssssssssssK', 'KsSSSSSSSSsK', 'KsSSSKKSSSsK', 'KsSSKSSKSSsK', 'KsSKSYYSKSsK', 'KsSSKSSKSSsK', 'KsSSSKKSSSsK', 'KsSSSSSSSSsK', 'KssssssssssK', 'KKKKKKKKKKKK', '.KK......KK.'],
  taxi: ['....KKKK......', '...KYKKYK.....', '..YYYYYYYYYY..', '.YLLYLLYYLLYY.', 'YYLLYLLYYLLYYY', 'YYYYYYYYYYYYYY', 'YKKKYYYYYYKKKY', '.KSK......KSK.'],
  boat: ['.....K........', '.....KWW......', '.....KWWW.....', '.....KWWWW....', '.....K........', 'RRRRRRRRRRRRRR', '.RWWWWWWWWWWR.', '..RRRRRRRRRR..', 'BBBBBBBBBBBBBB'],
  car: ['...RRRRRR.....', '..RLLRLLLR....', '.RRLLRLLLRR...', 'RRRRRRRRRRRRRR', 'RWRRRRRRRRRRRY', 'RRRRRRRRRRRRRR', '.KSK.....KSK..'],
  couch: ['.OOOOOOOOOOOO.', 'OOOOOOOOOOOOOO', 'OOoOOOOOOOOoOO', 'OOOOOOOOOOOOOO', 'OoooooooooooOO', 'OOOOOOOOOOOOOO', 'N.............N'],
  bed: ['W.............', 'WLLL..........', 'WLLLWWWWWWWWWW', 'WBBBBBBBBBBBBB', 'WBBBBBBBBBBBBB', 'WWWWWWWWWWWWWW', 'N............N'],
  drop: ['....R....', '....R....', '...RRR...', '..RRRRR..', '.RRWRRRR.', '.RWRRRRR.', 'RRRRRRRRR', 'RRRRRRRRR', '.RRRRRRR.', '..RRRRR..'],
  hand: ['..W.W.W...', '..W.W.W.W.', '..W.W.W.W.', 'W.WWWWWWW.', 'WWWWWWWWW.', 'WWWVVWWWW.', '.WWVVWWW..', '.WWWWWWW..', '..WWWWW...'],
  gate: ['y.y.yyy.y.y', 'y.yyy.yyy.y', 'yyyy...yyyy', 'y.y.y.y.y.y', 'y.y.y.y.y.y', 'y.y.y.y.y.y', 'y.y.y.y.y.y', 'yyyyyyyyyyy'],
  cat: ['.K...K.....', '.KK.KK.....', '.KKKKK.....', '.KYKYK.....', '.KKKKK...K.', '..KKKKKKKK.', '..KKKKKKK..', '..K.K..K.K.'],
  watch: ['...KKKK...', '...KKKK...', '..yyyyyy..', '.yWWWWWWy.', '.yWWKWWWy.', '.yWWKKKWy.', '.yWWWWWWy.', '..yyyyyy..', '...KKKK...', '...KKKK...'],
};
const MEMO = new Map();
export function myIcon(name) { if (!SRC[name]) return null; let I = MEMO.get(name); if (I) return I; const rows = SRC[name], w = Math.max(...rows.map(r => r.length)); I = new Img(w, rows.length);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === '.') continue; I.set(i, j, P[ch] ?? INK); } }); MEMO.set(name, I); return I; }
export const MY_ICONS = Object.keys(SRC);
