// SIGNAGE · shop and bodega names (owner: the signage agent). A default-lexicon trade (lexicon.js trade()) becomes a real name on
// the building: its hand-written names first (the witty ones: DUMPLING JAIL, COP STOP DONUTS, CLEAN MONEY), then grown ones
// (SAL'S PIZZA, KENT ST BAGELS, EL PRIMO DELI 24). Every trade has 32+ names, lists never share a name, and a lot draws only from
// its block's lattice class (alloc.js), so the same shop name never repeats within ~3 blocks, and never inside a block.
import { NAMES, GROW, GROW_WORD, OWNERS, BODEGA_OWNERS, STREETS, RESERVED, tradeOf, DELIS, VINYL, VINYL_TRADE, CARD_WORD, SHORT, SHORT_OWNER, SHORT_WORD, DELI_SHORT, SHORT_BODEGA } from './lexicon.js';
import { classOf, tileOf, state, blockOf, logSign, LAT, lotOf, swapWord } from './alloc.js';
import { hash } from '../style.js';

const TAKEN = new Set(RESERVED), VAR = new Map();
const addTo = (list, s) => { s = s.replace(/\s+/g, ' ').trim(); if (!s || TAKEN.has(s)) return false; TAKEN.add(s); list.push(s); return true; };
const own = o => o.endsWith('S') ? o + "'" : o + "'S";
// every list: 16 SHORT names first (index c = class c: one per class, each no wider than the trade's narrowest band), then the
// hand-written names, then grown ones to 40. A class's candidates are V[c], V[c + 16], V[c + 32] …: its short name, then longer ones.
function shorts(T) { const out = []; for (const s of SHORT[T] || []) addTo(out, s);
  const w = SHORT_WORD[T]; if (w) for (let k = 0; out.length < 16 && k < SHORT_OWNER.length * 2; k++) addTo(out, k < SHORT_OWNER.length ? `${SHORT_OWNER[k]} ${w}` : `${w} ${SHORT_OWNER[k - SHORT_OWNER.length]}`);
  return out; }
for (const T of Object.keys(NAMES)) {
  const sh = shorts(T), list = [], word = GROW_WORD[T] || T, pats = GROW[T] || ['pre', 'own', 'st'];
  for (const s of NAMES[T]) addTo(list, s);
  for (let k = 0; list.length + sh.length < 44 && k < 400; k++) { const p = pats[k % pats.length], o = OWNERS[(k * 7 + T.length * 3) % OWNERS.length], st = STREETS[(k * 5 + T.length) % STREETS.length];
    addTo(list, p === 'own' ? `${own(o)} ${word}` : p === 'st' ? `${st} ${word}` : `${o} ${word}`); }
  VAR.set(T, [...sh.slice(0, 16), ...list, ...sh.slice(16)]);
}
// bodegas: owner + the deli trade; each deli trade walks the owners from its own offset, so two bodegas of one block differ. Their
// 16 short forms (a short owner + a short suffix) come first, one per class.
DELIS.forEach((D, d) => { const T = String(D), sh = [], list = [];
  for (let k = 0; sh.length < 16 && k < SHORT_BODEGA.length; k++) addTo(sh, `${SHORT_BODEGA[(k + d * 3) % SHORT_BODEGA.length]} ${DELI_SHORT[d]}`);
  for (let k = 0; k < BODEGA_OWNERS.length; k++) addTo(list, `${BODEGA_OWNERS[(k + d * 5) % BODEGA_OWNERS.length]} ${T}`); VAR.set(T, [...sh, ...list]); });
export const variantsOf = T => VAR.get(String(T)) || [];
export const ALL_NAMES = TAKEN;

// the name on the sign for a shop whose spec name is `name`, at world (x, z); fits(s) → does s fit the band. A plain string (a kit's
// or an override's own name) is kept as it is. Logs the name (family 'name': never twice within ~3 blocks, never twice in a block).
export function shopName(name, x, z, fits = () => true, o = {}) {
  const T = tradeOf(name), [i, j] = blockOf(x, z), st = state(i, j);
  if (!T) { const s = String(name ?? ''); if (s) { st.used.add(s); if (o.log !== false) logSign('name', s, x, z, { r: 0, own: 'kit' }); } return s; }
  const lot = lotOf(), ck = lot ? lot + '|' + T : null; if (ck && st.names?.[ck]) return st.names[ck];   // the same shop on its second face
  const V = VAR.get(T) || [T], N = LAT.name * LAT.name, c = classOf('name', i, j), [ti, tj] = tileOf('name', i, j), mine = [];
  for (let k = c; k < V.length; k += N) mine.push(V[k]);
  const start = Math.floor(hash(ti * 131 + T.length, tj * 71 + 5, 911) * mine.length);
  let pickS = null; for (let t = 0; t < mine.length && !pickS; t++) { const v = mine[(start + t) % mine.length]; if (!st.used.has(v) && fits(v)) pickS = v; }
  // nothing of this class fits the band: the plain trade word if it fits (a narrow shop stays a plain PSYCHIC, no forced blade), else the
  // trade's shortest free name of this class (the band trims it, a blade carries it)
  if (!pickS) pickS = [GROW_WORD[T], T].find(v => v && !st.used.has(v) && fits(v)) || mine.filter(v => !st.used.has(v)).sort((a, b) => a.length - b.length)[0] || GROW_WORD[T] || T;
  // the swap table (alloc.js): a name that repeats a nearer one within the view distance takes the first of its new names that fits
  st.used.add(pickS); const alt = swapWord('name', i, j, pickS, fits); if (alt) { (st.was ??= {})[alt] = pickS; pickS = alt; }
  if (ck) (st.names ??= {})[ck] = pickS; if (o.log !== false) logSign('name', pickS, x, z, { trade: T, was: st.was?.[pickS] }); return pickS;
}
// window vinyl and the window card for a shop (by trade, else by its window display kind); deterministic by seed
export function vinylFor(name, disp, seed) { const T = tradeOf(name), L = (T && VINYL_TRADE[T]) || VINYL[disp] || VINYL.misc; return L[(seed >>> 0) % L.length]; }
export const cardFor = disp => CARD_WORD[disp] || 'OPEN';
// the allocator's own pick for a name the swap table replaced (for the sign log), else undefined
export const wasOf = (name, x, z) => { const [i, j] = blockOf(x, z); return state(i, j).was?.[name]; };
