// HUMAN LAYER · ITEM ICONS · the worn traits, cut out of the cast. The sim's TRAITS ids are the fit-check's (world/chars.js: "so the
// sim's traits are the visuals", sim2/rules.mjs), so each icon is that trait's own voxels: a mannequin is composed with and without the
// trait (world/chars.js compose) and only the trait's cells are kept — its tagged garment cells (top, shoes, neck) or, for head pieces
// and accessories, the cells the trait changed. The mouth traits (grills) are modelled in ../models.js: three teeth read as nothing.
// Bake-only (it imports three through world/chars.js).
import { look, compose } from '../../../../../world/chars.js';

// sim2/rules.mjs TRAITS (copied 2026-10-07, rules.mjs lines 79–87): id → [slot, tier]
export const TRAITS = {
  rope: ['neck', 'common'], padlock: ['neck', 'common'], floppy: ['neck', 'common'], dollar: ['neck', 'rare'], stack: ['neck', 'rare'], piece: ['neck', 'epic'], cuban: ['neck', 'epic'], tennis: ['neck', 'grail'],
  grill: ['mouth', 'rare'], gold: ['mouth', 'epic'], iced: ['mouth', 'grail'],
  fitted: ['hat', 'common'], bucket: ['hat', 'common'], beanie: ['hat', 'common'], durag: ['hat', 'common'], trucker: ['hat', 'common'], bandana: ['hat', 'common'], beret: ['hat', 'rare'], balaclava: ['hat', 'rare'],
  wrap: ['eyes', 'common'], ovals: ['eyes', 'common'], anaglyph: ['eyes', 'common'], shutter: ['eyes', 'rare'], cursorshades: ['eyes', 'rare'],
  tee: ['top', 'common'], hoodie: ['top', 'common'], tank: ['top', 'common'], flannel: ['top', 'common'], jersey: ['top', 'common'], varsity: ['top', 'rare'], velour: ['top', 'rare'], puffer: ['top', 'rare'], bsodtee: ['top', 'epic'],
  slides: ['feet', 'common'], dad: ['feet', 'common'], checker: ['feet', 'common'], boots: ['feet', 'common'], hightop: ['feet', 'rare'], foam: ['feet', 'rare'], platinum: ['feet', 'grail'],
  watch: ['wrist', 'epic'], crossbody: ['bag', 'common'], duffel: ['bag', 'rare'],
};
// the chars.js names (world/chars.js NAMES), for the tooltip
const NAME = { rope: 'gold rope', padlock: 'https padlock', floppy: 'floppy pendant', dollar: '$ piece', stack: 'stacked chains', piece: 'iced medallion', cuban: 'cuban link', tennis: 'tennis chain',
  fitted: 'flat-brim fitted', bucket: 'title-bar bucket', beanie: 'fisherman beanie', durag: 'durag', trucker: 'WWW trucker', bandana: 'bandana', beret: 'paint beret', balaclava: 'balaclava',
  wrap: 'wraparounds', ovals: 'matrix ovals', anaglyph: '3D glasses', shutter: 'shutter shades', cursorshades: 'cursor shades',
  tee: 'graphic tee', hoodie: 'box-logo hoodie', tank: 'ribbed tank', flannel: 'flannel', jersey: '56K jersey', varsity: 'varsity', velour: 'velour tracksuit top', puffer: 'puffer', bsodtee: 'bsod tee',
  slides: 'slides + socks', dad: 'dad shoes', checker: 'checker slip-ons', boots: 'work boots', hightop: 'cursor high-tops', foam: 'foam runners', platinum: 'platinum high-tops',
  watch: 'iced watch', crossbody: 'crossbody bag', duffel: 'duffel bag' };
// icon colourways where the chars.js default is near-black (an ink-outlined black shape reads as a hole at 32 px): taste call, see CATALOG.md
const CW = { hoodie: { c: 0x1d4ed8, lc: 0xf2f2f2 }, tee: { c: 0xf2f2f2, print: 'heart' }, fitted: { c: 0xd7141a, m: 0xe7bd4a }, durag: { c: 0x7a3cff }, balaclava: { c: 0x5b6b3a }, crossbody: { c: 0xe8232a } };
const SLOT = { hat: 'hat', eyes: 'eyewear', top: 'top', feet: 'shoes', neck: 'neck', wrist: 'acc', bag: 'acc' };
const BASE = { handle: 'icon.mannequin', skin: 'pale', eyes: 'bored', mouth: 'flat', top: { id: 'tank', c: 0x808080 }, bottom: { id: 'baggy', c: 0x4f79b5 }, shoes: { id: 'slides' }, bg: '#fff' };
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const cellsOf = G => { const out = new Map(); G.L.forEach((M, l) => { for (const [k, c] of M) out.set(k, [c, l]); }); return out; };

// → [[x, y, z, colour, layer]] (chars.js body cells: y up, +z the front), or null when the trait can't be cut
export function traitCells(id) {
  const t = TRAITS[id]; if (!t) return null; const [slot] = t; if (slot === 'mouth') return null;
  let key = SLOT[slot]; if (id === 'duffel') key = 'held';
  const spec = { id, ...(CW[id] || {}) }, A = compose(look(BASE)), B = compose(look({ ...BASE, [key]: spec, ...(key === 'top' ? {} : {}) }));
  const out = [];
  if (key === 'top' || key === 'shoes' || key === 'neck') {   // the garment's own tagged cells
    const want = key; B.B.L.forEach((M, l) => { for (const [k, c] of M) if (B.tag.get(k) === want) out.push([...dec(k), c, l]); }); }
  else {   // what the trait changed (head grid for hats and eyewear; body + held extras for the rest)
    const grids = key === 'hat' || key === 'eyewear' ? ['H'] : ['B', 'HX', 'H'];
    for (const g of grids) { const a = cellsOf(A[g]), b = cellsOf(B[g]); for (const [k, [c, l]] of b) { const o = a.get(k); if (!o || o[0] !== c || o[1] !== l) out.push([...dec(k), c, l]); } } }
  // a hat cut off its head is a hollow shell whose sides read as legs: close it (each column filled between its lowest and highest cell,
  // in the hat's own colour darkened: the opening reads as the inside of a hat)
  if (key === 'hat' && id !== 'balaclava') {   // first drop what hangs below the band (flaps, tails: a level with under half the cells of the fullest)
    const per = new Map(); for (const v of out) per.set(v[1], (per.get(v[1]) || 0) + 1); const mx = Math.max(...per.values()), cut = Math.min(...[...per].filter(([, n]) => n >= mx * .5).map(([y]) => y));
    for (let i = out.length - 1; i >= 0; i--) if (out[i][1] < cut) out.splice(i, 1); }
  if (key === 'hat' && id !== 'balaclava') { const cols = new Map(), cnt = new Map(); for (const [x, y, z, c] of out) { const k = x + ',' + z, m = cols.get(k); cols.set(k, m ? [Math.min(m[0], y), Math.max(m[1], y)] : [y, y]); cnt.set(c, (cnt.get(c) || 0) + 1); }
    const main = [...cnt].sort((a, b) => b[1] - a[1])[0][0], dark = (((main >> 16 & 255) * .45) << 16) | (((main >> 8 & 255) * .45) << 8) | ((main & 255) * .45), have = new Set(out.map(v => v[0] + ',' + v[1] + ',' + v[2]));
    for (const [k, [y0, y1]] of cols) { const [x, z] = k.split(',').map(Number); for (let y = y0; y <= y1; y++) if (!have.has(x + ',' + y + ',' + z)) out.push([x, y, z, dark, 0]); } }
  // lift the blacks: a near-black trait (a beret, a balaclava, slides) reads as a hole inside an ink outline at 32 px (taste call, CATALOG.md)
  const lum = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255;
  for (const v of out) if (lum(v[3]) < .1) v[3] = 0x34363f;
  return out.length ? out : null;
}
export const traitName = id => NAME[id] || id;
