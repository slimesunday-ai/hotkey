// IMPORTED TRAITS · the lower-body adapters (README § Imported traits): one OLD pant or shoe (the old Trait Studio's draw, kept as isolated
// legacy construction in world/legacy/lower.js) → one fresh registry entry, in the old page's base colours (colourway 0), fixed here.
// Only world/fresh/imported/bottoms.js and shoes.js import this file (as the other imported files import ./kit.js); nothing fresh
// imports it or world/legacy/.
import * as LEG from '../../legacy/lower.js';

// ── bottoms. The old pants were already paint on the approved leg forms (old world/fit/leg-forms.js + collection-forms.js: the same
// rows and cuts the fresh forms have), so the old design ports as it is: the old resolveBottom's cloth, waistband and per-cell paint
// on the form it named. The fresh construction adds what it adds to every pant (the closed seat, the waist seam): the seat's u −1
// column goes through the old paint like any other cell, so a pattern carries on across it.
export function bottom(id) { const r = LEG.resolveBottom({ id, cw: 0 });
  return { form: r.form, color: r.c, waist: r.waistC, paint: q => r.paint(q) }; }

// ── shoes. The old shoes were rigid feet in foot-local cells mirrored onto both sides (u outwards from the inner edge, y 0..3, z heel →
// toe: the fresh shoe envelope). The old draw is run once on a scratch grid and its left foot is laid on the fresh foot pad as a
// free-form draw: exactly the cells and colours the old page showed (both feet were mirror images on the old page too).
// THE ANKLE: the old page dressed the socket in the pant's colour only for the new-drop shoes (old drop-collection.js dressDropAnkle,
// the same rule as the fresh dressed ankle); every other old shoe kept its own collar colour there, so those register ankle: 'shoe'.
// fix(F): an import fix drawn after the old cells (the shoes file says why, per trait)
const scratch = () => { const m = new Map(), K = (x, y, z) => `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
  return { m, set(x, y, z, c, l = 0) { if (c === undefined || c === null) return; m.set(K(x, y, z), [Math.round(x), Math.round(y), Math.round(z), c, l === true ? 1 : (l || 0)]); },
    del(x, y, z) { m.delete(K(x, y, z)); }, has(x, y, z) { return m.has(K(x, y, z)); }, get(x, y, z) { return m.get(K(x, y, z))?.[3]; } }; };
export function shoe(id, fix) { const G = scratch(); LEG.SHOES[id](G, { id, cw: 0 });
  const cells = [...G.m.values()].filter(([x]) => x <= -2).map(([x, y, z, c, l]) => [-2 - x, y, z, c, l]);   // the left foot (x −2 = u 0)
  return { draw: F => { for (const [u, y, z, c, l] of cells) F.set(u, y, z, c, l); if (fix) fix(F); }, ...(LEG.DROP_SHOES[id] ? {} : { ankle: 'shoe' }) }; }
