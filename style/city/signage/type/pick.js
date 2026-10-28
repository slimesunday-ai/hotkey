// SIGNAGE · TYPE · which face a shopfront letters in (owner: the lettering agent, 2026-09-29). By the shop's trade (lexicon.js), else
// its window display, leaned by the sign's kind (a neon sign → the tube face; an awning → the deli face) and the district's flavour
// (alloc.js flavourAt: Neon Row → neon and script, the docks and the Yards → stencil, uptown → slab and script …), then drawn per lot
// from a seeded weighted order. A face is taken only when the words fit the board as the 5×7 face fits them (the name and its cut
// were chosen with the classic metrics: the words never change, only the face), and never when a shopfront within 12 m of it in the
// block already shows the same face in the same colour (a first pass avoids the same face beside it at all). Deterministic: the block's
// lots build in a fixed order, and the record lives in the block's own signage state (alloc.js state), so any worker gets the same city.
import { FACES, mask } from './index.js';
import { state, blockOf, lotOf, flavourAt } from '../alloc.js';
import { tradeOf } from '../lexicon.js';
import { hash } from '../../style.js';

const W = s => Object.fromEntries(s.split(' ').reduce((a, t, k, A) => (k % 2 ? a : [...a, [t, +A[k + 1]]]), []));
const G = (trades, w) => trades.split(',').map(t => [t.trim(), W(w)]);
const BY_TRADE = Object.fromEntries([
  ...G('PIZZA, WOK, BAGELS, HEROES, TACOS, DUMPLINGS, BURGERS, PHO, CHICKEN, NOODLES, HALAL, GRILL', 'deli 5 slab 1 varsity 1 bubble 1 script 1 pixel 1'),
  ...G('DINER', 'script 3 slab 2 deli 1 neon 1'),
  ...G('DONUTS, BAKERY, JUICE, COFFEE, CAFE, CARDS', 'script 4 bubble 2 slab 1 pixel 1'),
  ...G('BAIL BONDS, CHECKS CASHED, NOTARY, TAX PREP, LAW, LOANS, MONEY WIRE, WE BUY, NO QS', 'slab 5 deli 2 wide 1 pixel 1'),
  ...G('PAWN, GOLD, JEWELRY, GRILLZ', 'slab 3 black 3 wide 1'),
  ...G('PHONE FIX, PREPAID, WIRELESS', 'wide 4 deli 2 bubble 1 pixel 1'),
  ...G('KEYS, LOCKSMITH, CLEANERS, LAUNDROMAT, LAUNDRY, COPIES, AUTO, STORAGE', 'deli 4 slab 2 wide 1 pixel 1'),
  ...G('PSYCHIC, PRIVATE EYE, SPY SHOP', 'script 3 black 2 neon 1 slab 1'),
  ...G('SNEAKERS, STREETWEAR, RESTOCK, FITS, RESALE, HATS, TEES, OUTLET, BIG SIZES', 'wide 4 varsity 4 bubble 1'),
  ...G('THRIFT', 'script 3 bubble 2 slab 1'),
  ...G('SMOKE SHOP', 'neon 3 bubble 2 black 1'),
  ...G('99¢', 'bubble 6 deli 1'),
  ...G('RECORDS, COMICS', 'bubble 3 varsity 2 black 1 wide 1'),
  ...G('SKATE', 'varsity 4 stencil 1 bubble 1'),
  ...G('TATTOO', 'black 5 script 1'),
  ...G('NAILS', 'script 4 bubble 2'),
  ...G('BARBER, CUTS', 'black 4 script 2 varsity 1'),
  ...G('LIQUORS, WINE', 'black 4 script 2 slab 1'),
  ...G('PHARMACY, OPTICAL, DENTIST, OPTICS', 'wide 2 slab 2 pixel 2'),
  ...G('SURPLUS, CANTEEN', 'stencil 5 slab 1'),
]);
const BY_DISP = { food: W('deli 4 slab 1 script 1 pixel 1'), cakes: W('script 4 bubble 3'), phones: W('wide 4 deli 1 pixel 1'), clothes: W('wide 3 varsity 3 bubble 1'),
  shoes: W('varsity 4 wide 3'), gold: W('slab 3 black 3'), bottles: W('black 4 script 1'), machines: W('deli 4 pixel 1 slab 1'), office: W('slab 4 pixel 1 deli 1'),
  misc: W('pixel 2 deli 2 slab 1 bubble 1 wide 1'), barber: W('black 4 script 2') };
const BY_FLAVOUR = { strip: W('neon 2 script 2 bubble 1'), docks: W('stencil 6'), uptown: W('slab 2 script 2'), suburbs: W('bubble 1 wide 1'), civic: W('slab 2 pixel 1'), downtown: {} };
const lum = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255;

// → the face id for this shopfront, or 'pixel' (the classic 5×7). o: { name, disp, kind, seed, board (colour), txt, maxW, x, z }
export function pickFace(o) {
  const [i, j] = blockOf(o.x, o.z), st = state(i, j), T = tradeOf(o.name), key = (lotOf() ?? '-') + '|' + (T || '') + '|' + o.txt;
  const known = st.faceOf?.[key]; if (known && fits(known, o)) return remember(st, o, known);   // the same shop on its second face
  const w = {}; const add = (m, k = 1) => { for (const [f, v] of Object.entries(m || {})) w[f] = (w[f] || 0) + v * k; };
  add(T && BY_TRADE[T] ? BY_TRADE[T] : BY_DISP[o.disp] || BY_DISP.misc); add(BY_FLAVOUR[flavourAt(i, j)]); w.pixel = (w.pixel || 0) + .5;
  if (o.kind === 'neon') { add({ neon: 8, script: 3 }); } else delete w.neon;                           // the tube face lives on the neon's ink board
  if ((o.kind === 'awnSlope' || o.kind === 'awnBox') && !(T && BY_TRADE[T]?.deli === undefined)) add({ deli: 2 });
  if (o.kind === 'neon') for (const f of ['varsity', 'bubble', 'stencil']) delete w[f];                  // (a shadow or a bounce reads as a broken tube)
  if (lum(o.board) > .8) delete w.black;                                                                 // (hairlines vanish on white)
  // a seeded weighted order (each face keyed by −ln(u)/w, smallest first), then the first that fits and has no twin next door
  const order = Object.entries(w).filter(([, v]) => v > 0).map(([f, v], k) => [f, -Math.log(1 - hash(o.seed, k * 7 + 3, FACES_N) * .999) / v]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  const near = (st.letters || []).filter(r => (r.x - o.x) ** 2 + (r.z - o.z) ** 2 < 144);
  const pickF = order.find(f => fits(f, o) && !near.some(r => r.face === f)) || order.find(f => fits(f, o) && !near.some(r => r.face === f && r.col === o.board)) || 'pixel';
  (st.faceOf ??= {})[key] = pickF; return remember(st, o, pickF);
}
const FACES_N = Object.keys(FACES).length;
function remember(st, o, f) { (st.letters ??= []).push({ x: o.x, z: o.z, face: f, col: o.board, kind: o.kind, txt: o.txt }); return f; }
// the words fit the board as the classic face fits them (width), and the face's rows stay on the 9-voxel band: at most 8 rows above
// the baseline (a bounce), at most 1 below it (a descender, a drop shadow, the halo)
export function fits(f, o) { if (f === 'pixel') return true; const M = mask(f, o.txt, { seed: o.seed & 7 }); return M.w <= o.maxW && M.base <= 7 && M.h - M.base <= 2; }
