// TRAIT STUDIO · the catalogue: every trait chars.js can draw, in every slot, with its origin, tier and colourways.
// Read-only over world/chars.js (+ the shoe, jewellery and held passes it installs). No DOM: node can import it too.
import * as CH from '../../../world/chars.js';
import { V2, NEWJ, REDRAWN as J_REDRAWN } from '../../../world/jewelry2.js';
import { SHOE_IDS, REDRAWN as S_REDRAWN } from '../../../world/shoes2.js';

export const SLOTS = CH.SLOTS;   // skin hair hat eyes eyewear mouth mark ears top neck bottom shoes held acc
export const SLOT_LABEL = { skin: 'skin', hair: 'hair', hat: 'hat', eyes: 'eyes', eyewear: 'eyewear', mouth: 'mouth', mark: 'face ink', ears: 'ears', top: 'top', neck: 'neck', bottom: 'bottom', shoes: 'shoes', held: 'held', acc: 'accessory' };
export const ORIGINS = ['original', 'drop02', 'shoes', 'jewelry', 'v2'];
export const TIERS = ['common', 'rare', 'epic', 'grail', '1 of 1', 'base'];   // base: an original the sim doesn't sell (not in its TRAITS)
export const OPTIONAL = new Set(['hair', 'hat', 'eyewear', 'mark', 'ears', 'neck', 'held', 'acc']);   // slots that can be empty ('none')
const SIM_SLOT = { neck: ['neck'], mouth: ['mouth'], hat: ['hat'], eyes: ['eyewear'], top: ['top'], feet: ['shoes'], wrist: ['acc'], bag: ['held', 'acc'], hair: ['hair'], ears: ['ears'], legs: ['bottom'] };

// a colourway's colours → CSS swatches (colourway rows mix colours, layer flags (0…3), arrays (patterns) and 'ice')
const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
export function swatches(cw) { const out = [];
  for (const v of cw.slice(1)) { if (typeof v === 'number' && v > 16) out.push(hex(v)); else if (Array.isArray(v)) { for (const x of v.slice(0, 2)) if (typeof x === 'number' && x > 16) out.push(hex(x)); } else if (v === 'ice') out.push('#bfe9ff'); if (out.length >= 3) break; }
  if (!out.length) { const v = cw[1]; out.push(v === 0 ? '#dff6ff' : v === 1 ? '#1e1e22' : '#cccccc'); }
  return out; }

// the roller's palettes (chars.js PAL, copied read-only: it isn't exported) for the originals' free colour params
const P = { hoodie: [0x151517, 0xd7141a, 0x1d4ed8, 0x6cf542, 0xf2f2f2, 0xff7ab6], puffer: [0xc9ced6, 0x0a8a8a, 0xff6a00, 0x151517, 0x5a2bd6],
  jersey: [0xb3121b, 0x1d3a8a, 0x111111, 0x0a8a8a, 0xf2c230], tee: [0x151517, 0xf2f2f2, 0x6f6f6f], varsity: [0x1b2a4a, 0x3a0d0d, 0x111111, 0x0a5a3a],
  denim: [0x4f79b5, 0x2b3f66, 0x9bb8dd, 0x1a1a1a], cargo: [0x2a2a2c, 0x7c7a52, 0x4a5a3a, 0xb8b0a0], dye: [0xe9c14d, 0x151214, 0xd8262e, 0x2de2e6, 0xff7ab6, 0xf3f3f3, 0x6cf542, 0x2b6cff, 0x3a2616],
  hat: [0x151517, 0xf4f4f4, 0x0a8a8a, 0xe8742a, 0xd7141a, 0x6cf542], accent: [0xd7141a, 0x1d3a8a, 0x6cf542, 0xff7a1a, 0x5a2bd6, 0x2de2e6] };
const PARAM_OF = { hair: { dreads: 'a' }, shoes: { dad: 'a', hightop: 'm', slides: 'k', boots: 'bc', button: 'a', platinum: 'm', checker: 'a' } };
// an original's palette: [param, [colours]] (the roller's list for that slot), or null (no free colour)
export function paletteOf(slot, id) {
  if (!CH.PARAM.has(slot) || id === 'none' || CH.isNewTrait(slot, id)) return null;
  const param = (PARAM_OF[slot] || {})[id] || 'c';
  const list = slot === 'top' ? P[{ puffer: 'puffer', jersey: 'jersey', tee: 'tee', varsity: 'varsity' }[id] ?? 'hoodie'] : slot === 'bottom' ? P.denim.concat(P.cargo) : slot === 'hat' ? P.hat
    : slot === 'hair' ? P.dye : slot === 'shoes' ? (id === 'foam' ? [0xe9e2cf, 0x6cf542, 0x151517, 0xff7ab6] : P.accent) : slot === 'acc' ? [0xe7bd4a, 0xdfe6ee, 0x151517] : P.accent;
  return [param, list];
}
export const hexCss = hex;

// every trait: { key 'slot/id', slot, id, name, origin, pass (redrawn by: 'shoes' | 'jewelry' | null), tier, tierSrc, cws, why, sim }
export function buildCatalog(proposal, simTiers) {
  const PT = (proposal && proposal.traits) || {}, ST = (simTiers && simTiers.TRAITS) || {}, out = [];
  for (const slot of SLOTS) for (const id of Object.keys(CH.NAMES[slot])) {
    if (id === 'none') continue;
    const isNew = CH.isNewTrait(slot, id), e = isNew ? CH.NEWI[id] : null;
    let origin = 'original', pass = null;
    if (isNew) { if (V2[id]) origin = 'v2'; else if (NEWJ.includes(id)) origin = 'jewelry'; else if (SHOE_IDS.includes(id) && !S_REDRAWN.includes(id)) origin = 'shoes'; else origin = 'drop02';
      if (origin === 'drop02') pass = S_REDRAWN.includes(id) ? 'shoes' : J_REDRAWN.includes(id) ? 'jewelry' : null; }
    let tier = 'base', tierSrc = 'not in the sim', sim = null;
    if (!isNew) { const t = ST[id]; if (t && (SIM_SLOT[t[0]] || []).includes(slot)) { tier = t[1]; tierSrc = 'sim2 TRAITS'; sim = t[0]; }
      else if (slot === 'skin' && CH.TIER[id]) { tier = CH.TIER[id]; tierSrc = 'chars.js TIER (species)'; } }
    else { const p = PT[id]; if (Array.isArray(p) && p[1]) { tier = p[1]; tierSrc = 'traits-proposal.json'; sim = p[0]; } else { tier = e.tier; tierSrc = 'chars.js registry'; } }
    out.push({ key: slot + '/' + id, slot, id, name: CH.NAMES[slot][id], origin, pass, tier, tierSrc, sim, isNew, cws: e && e.cw ? e.cw.map(c => ({ name: c[0], sw: swatches(c) })) : null, why: e ? e.why || null : null,
      v2of: V2[id] || null });
  }
  return out;
}
