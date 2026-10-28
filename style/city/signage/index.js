// SIGNAGE · the shared signage system (owner: the signage agent). The core calls in here for every billboard, wall ad, ghost sign,
// mural, paste-up, transit ad, rooftop neon word and roof throw-up; district kits get all of it through the shared generator, so
// section agents write only their district's hero signs (DISTRICTS.md). Everything placed is allocated (alloc.js: no design twice
// within ~3 blocks, none twice in a block, district flavour first) and logged for the audit's repeat check (tools/audit.mjs).
import { REG } from '../audit.js';
import { POOLS } from './designs.js';
import { pick, blockOf, logSign, state, flavourAt, swapWord } from './alloc.js';
import { roofBoard, paintWall, wallImg, ghostWall, ghostFits, pasteWall, posterSize, lightbox, FACE, giantFits } from './boards.js';
import { GHOSTS, ADS, BILLBOARDS, isNet, BODEGA_BAND, PARK_SIGN } from './lexicon.js';
import { hash } from '../style.js';
import { STREET_CAST } from './art.js';
import { P as PITCH } from '../../../world/city.js';   // (SPREAD: the plan's pitch, never a literal 32)
export { NEON_WORDS, NEON_SHORT, THROW_WORDS, THROW_SHORT } from './lexicon.js';
export { shopName, vinylFor, cardFor, variantsOf } from './names.js';
export { POOLS } from './designs.js';
export { roofBoard, FACE } from './boards.js';

// world (x, z) of a facade frame's column a (kit.js frame on a volume)
export const worldOf = (f, a, d = 0) => { const [x, z] = f.xz(a, d), V = f.V; return [V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s]; };
const blockHere = (x, z) => { const b = REG.blk; return b ? [b.i, b.j] : blockOf(x, z); };
// does a design fit a box: its words painted whole (words only allowed when o.words), memoized per design and size
const FIT = new Map();
const fitsBox = (d, w, h, words = false) => { const k = `${d.key}|${w}|${h}`; let r = FIT.get(k); if (!r) { const I = wallImg(d, w, h); r = I.miss ? 'miss' : I.fell ? 'words' : 'ok'; FIT.set(k, r); } return r === 'ok' || (words && r === 'words'); };

// ───────────────────────── walls
// the block's biggest wall leans to the Dazed format: fashion campaigns and editorial portraits first, then the character-led ads
const MURAL = d => d.mix === 'fash' ? 4 : d.lay === 'editorial' ? 2 : 1;
// a painted wall ad (the top of an exposed side wall, ≤ 4 m tall): a text-led design. `lines` is the generator's pick from the
// kit's lexicon: a kit's own words (not the default list) are painted as they are.
export function wallAd(f, a0, y0, w, h, lines, bg, fg) {
  const [x, z] = worldOf(f, a0 + (w >> 1)), [i, j] = blockHere(x, z); let d = null;
  if (lines && !ADS.includes(lines)) d = { key: lines.join(' '), big: lines[0], top: null, sub: lines[1], tone: 'red', lay: 'type', cat: 'kit' };
  else d = pick(POOLS.wall, i, j, { ok: d => (!d.look || w > h * 1.6) && fitsBox(d, w, h) }) || pick(POOLS.wall, i, j, { ok: d => fitsBox(d, w, h, true) }) || pick(POOLS.wall, i, j, { fit: d => fitsBox(d, w, h, true) });   // (the design that fits this wall; fit: the swap's gate)
  if (!d) return false; const I = wallImg(d, w, h, d.cat === 'kit' ? { pal: { bg, fg } } : {}); paintWall(f, I, a0, y0); logSign('wall', d.key, x, z, { net: d.net || isNet(d.key), mix: d.mix, cat: d.cat, where: 'ad', was: d.was }); return d;
}
// the block's biggest wall ('face') and the other painted walls: a character mural (the Dazed format: one flat colour, a huge
// chars.js character, a small wordmark; or the character-led ad), a big painted ad, or a paste-up row at street level
export function wallMural(f, kind, a0, y0, w, h, seed, o = {}) {
  const [x, z] = worldOf(f, a0 + (w >> 1)), [i, j] = blockHere(x, z);
  if (kind === 'paste') { if (y0 > 60 || h < 26) kind = 'bigad'; else {
    const [pw, ph] = posterSize(Math.min(h, 40)), ds = []; for (let k = 0; k < 3; k++) { const d = pick(POOLS.paste, i, j, { ok: d => fitsBox(d, pw, ph, true) }) || pick(POOLS.paste, i, j, { fit: d => fitsBox(d, pw, ph, true) }); if (d) ds.push(d); } if (!ds.length) return false;
    const used = pasteWall(f, ds, a0, y0, w, Math.min(h, 40), seed); for (const d of used) logSign('paste', d.key, x, z, { net: d.net, mix: d.mix, cat: d.cat, where: 'paste', was: d.was }); return true; } }
  const face = kind === 'face', hh = face ? Math.min(h, Math.round(w * 1.9)) : Math.min(h, Math.max(26, Math.round(w * .62))), yy = y0 + (face ? 0 : Math.round((h - hh) / 2));
  const d = face ? (pick(POOLS.wall, i, j, { ok: d => !!d.look && fitsBox(d, w, hh), boost: MURAL }) || pick(POOLS.wall, i, j, { ok: d => fitsBox(d, w, hh, true) }) || pick(POOLS.wall, i, j, { fit: d => fitsBox(d, w, hh, true) }))
    : (pick(POOLS.wall, i, j, { ok: d => !d.look && fitsBox(d, w, hh) }) || pick(POOLS.wall, i, j, { ok: d => !d.look, fit: d => fitsBox(d, w, hh, true) }));
  if (!d) return false;
  const lay = face && d.look && hash(seed, 11) < .45 ? 'editorial' : undefined, I = wallImg(d, w, hh, { lay });
  paintWall(f, I, a0, yy); logSign('wall', d.key, x, z, { net: d.net, mix: d.mix, cat: d.cat, where: face ? 'mural' : 'bigad', was: d.was }); return d;
}
// a ghost sign hanging from ytop; returns its height. A kit's own two lines are painted as they are.
export function wallGhost(f, a0, ytop, w, lines, wall, seed) {
  const [x, z] = worldOf(f, a0 + (w >> 1)), [i, j] = blockHere(x, z);
  const d = lines && !GHOSTS.includes(lines) ? { key: lines.join(' '), big: lines[0], sub: lines[1] } : pick(POOLS.ghost, i, j, { ok: d => ghostFits(d, w) }) || pick(POOLS.ghost, i, j, { fit: d => ghostFits(d, w) });
  if (!d) return 0; const h = ghostWall(f, d, a0, ytop, w, wall, seed); if (h) logSign('ghost', d.key, x, z, { net: isNet(d.key), where: 'ghost', was: d.was }); return h;
}

// ───────────────────────── roofs
// the rooftop billboard for a lot: the design is the block's (allocated), the face colour is the lot's colourway (seed %
// BILLBOARDS.length, which far.js paints far off); giant = a 4× character will stand on its catwalk (right of centre)
export function roofBillboard(seed, o = {}) {
  const way = BILLBOARDS[((seed % BILLBOARDS.length) + BILLBOARDS.length) % BILLBOARDS.length], flip = seed % 3 === 1;
  const [i, j] = o.block || (REG.blk ? [REG.blk.i, REG.blk.j] : [0, 0]), d = o.design || pick(POOLS.roof, i, j, { ok: o.giant ? (d => d.lay !== 'figure') : undefined, fit: o.giant ? giantFits : undefined }) || pick(POOLS.roof, i, j, { fit: o.giant ? giantFits : undefined });
  const bank = roofBoard(d, way, { giant: !!o.giant, flip: o.flip ?? flip }), at = o.at || (REG.blk ? [REG.blk.i * PITCH + PITCH / 2, REG.blk.j * PITCH + PITCH / 2] : null);
  if (at) logSign('roof', d.key, at[0], at[1], { net: d.net, mix: d.mix, cat: d.cat, where: 'roof', was: d.was });
  return { bank, design: d };
}
// rooftop neon frame word / roof throw-up word for a set piece at (x, z); fits(word) → does it fit the frame
export function roofWord(fam, x, z, fits = () => true, short = []) {
  const [i, j] = blockHere(x, z), d = pick(POOLS[fam], i, j, { ok: d => fits(d.big) }); let w = d ? d.big : null, was = d?.was;
  if (!w) { w = short.find(s => fits(s) && !state(i, j).used.has(s)) || short[0]; const alt = w && swapWord(fam, i, j, w, fits); if (alt) { was = w; w = alt; } }   // (a fallback word that repeats: the swap table's)
  if (w) logSign(fam, w, x, z, { net: isNet(w), where: fam, was }); return w;
}

// ───────────────────────── transit: the bus shelter's lightbox (the design is the block's; one per shelter)
export function shelterAd(o = {}) { const [i, j] = o.block || (REG.blk ? [REG.blk.i, REG.blk.j] : [0, 0]), d = pick(POOLS.transit, i, j); if (!d) return null;
  const at = o.at || (REG.blk ? [REG.blk.i * PITCH + PITCH / 2, REG.blk.j * PITCH + PITCH / 2] : null); if (at) logSign('transit', d.key, at[0], at[1], { net: d.net, mix: d.mix, cat: d.cat, where: 'shelter', was: d.was });
  return { V: lightbox(d, o.w || 16, o.h || 46), design: d }; }
// the giant on a board's catwalk: the design's own cast member when it has one, else a street-cast look (castspec needs a named look)
export const giantLook = (d, seed) => d?.look?.handle || STREET_CAST[((seed >>> 0) * 7 + 3) % STREET_CAST.length];
export { flavourAt };

// ───────────────────────── gen.js's two utility signs (signage pass 4): the corner bodega's side band and the parking lot's price sign.
// The copy nearest the city centre keeps the pass-2 words; the swap table (swaps.js) gives the repeats real-world variants.
// the bodega's side band (shop.js logs it as family 'util')
export function bodegaBand() { const b = REG.blk; if (!b) return BODEGA_BAND; return swapWord('util', b.i, b.j, BODEGA_BAND) || BODEGA_BAND; }
// the parking lot's two-line price sign (4 characters a line), logged at (x, z) as family 'park' (radius 0 for the audit: street furniture)
export function parkSign(x, z) { const b = REG.blk, alt = b ? swapWord('park', b.i, b.j, PARK_SIGN) : null, w = alt || PARK_SIGN;
  logSign('park', w, x, z, { r: 0, where: 'park', was: alt ? PARK_SIGN : undefined }); return w.split(' '); }
