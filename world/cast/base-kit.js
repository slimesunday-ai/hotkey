// THE BASE KIT · the mannequin every fresh trait is designed and checked on. These pieces are construction, not curation: they are
// never listed in the studio, never kept or killed, and they fill a slot whenever no fresh trait is worn there.
//   skin   tan · eyes   bored · bottom   one solid colour on the approved fuller leg form (roomy) · shoes   the plain tongue-last
//   shoe in neutral greys (its ankle dressed by the pants). No mouth (the face is clean skin under the nose), hair, hat, top, eyewear,
//   ear item, face ink, accessory or held thing. Look values: 'base' (string slots; mouth 'base' draws nothing) / { id: 'base' } (bottom, shoes).
import { POSES, inHand } from './fit/held.js';
export const BASE_SKIN = { name: 'tan', c: 0xd9a06b };
export const BASE_EYES = { name: 'bored', rows: ['LLLLL', 'WWPPW', 'WWPPW', '.....'], brow: ['.....', 'BBBBB', '.....'] };
export const BASE_BOTTOM = { name: 'plain pants', form: 'roomy', color: 0x5d6470, sock: 'none' };
const SHOE = { outsole: 0x55575f, midsole: 0xe4e0d6, upper: 0x8d9097, tongue: 0xe4e0d6 };
export const BASE_SHOES = { name: 'plain shoes', last: 'tongue', paint: q => [SHOE[q.region], 0] };
export const BASE = { skin: BASE_SKIN, eyes: BASE_EYES, bottom: BASE_BOTTOM, shoes: BASE_SHOES };

// the mannequin look (a fresh object each call)
export const mannequin = () => ({ handle: 'mannequin', skin: 'base', eyes: 'base', mouth: 'base', mark: 'none', hair: { id: 'none' }, hat: { id: 'none' },
  eyewear: { id: 'none' }, ears: { id: 'none' }, top: { id: 'none' }, bottom: { id: 'base' }, shoes: { id: 'base' }, acc: { id: 'none' }, held: { id: 'none' } });

// CHECK FIXTURES (construction, never curated): the same plain solid pants on every approved leg form, so a shoe can be checked
// under full pants and under shorts, and a form can be seen bare. Look value { id: 'base:<form>' } (registry ids can't contain ':').
export const FIXTURES = { bottom: Object.fromEntries(['roomy', 'longshorts', 'shorts', 'slim', 'straight', 'baggy'].map(f => ['base:' + f, { ...BASE_BOTTOM, name: 'plain ' + f, form: f }])),
  // the held ENVELOPE of each hold pose (world/fit/held.js), filled solid in a flat grey: what the held motion check poses to prove the
  // budget clears the body (style/city/anim/held-motion-check.mjs). Look value { id: 'base:<pose>' }. Construction, never curated.
  held: Object.fromEntries(POSES.map(p => ['base:' + p, { name: 'envelope ' + p, pose: p, draw: (G, ctx) => { const e = ctx.grip.envelope;
    for (let x = e.x[0]; x <= e.x[1]; x++) for (let y = e.y[0]; y <= e.y[1]; y++) for (let z = e.z[0]; z <= e.z[1]; z++) { if (inHand(x, y, z) && !ctx.grip.cells.some(c => c[0] === x && c[1] === y && c[2] === z)) continue;
      G.set(x, y, z, 0x8a8d93); } } }])) };
