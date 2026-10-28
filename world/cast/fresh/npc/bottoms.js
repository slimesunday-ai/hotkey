// NPC POOL · bottoms (slot 'bottom'). Slacks, khakis, jeans, work pants, scrub pants, sweatpants and a pair of tourist shorts, in the
// civilian palette, on the approved leg forms (geometry is the form's: README § Bottoms). Plain cloth: at most a slightly darker
// hem row, never a stripe, a print or a patch. README § The NPC pool. The only import allowed is './kit.js'.
import { shade, CIV } from './kit.js';
const cuff = c => q => q.y === 4 ? shade(c, .88) : undefined;   // a turned-up hem one shade down
export default {
  npc_pants_slacks_navy: { name: 'Civilian · navy slacks', tier: 'common', why: 'office · navy suit trousers', form: 'straight', color: CIV.navy, waist: shade(CIV.navy, .85) },
  npc_pants_slacks_charcoal: { name: 'Civilian · charcoal slacks', tier: 'common', why: 'office · charcoal trousers, pressed', form: 'slim', color: CIV.charcoal, waist: CIV.black },
  npc_pants_slacks_grey: { name: 'Civilian · grey slacks', tier: 'common', why: 'office · mid-grey trousers: the skirt-suit\'s plainer sister', form: 'straight', color: CIV.grey, waist: shade(CIV.grey, .85) },
  npc_pants_khakis: { name: 'Civilian · khakis', tier: 'common', why: 'weekend · pleated khakis: dad', form: 'roomy', color: CIV.khaki, waist: CIV.brown, paint: cuff(CIV.khaki) },
  npc_pants_jeans_dark: { name: 'Civilian · dark jeans', tier: 'common', why: 'everyday · dark straight jeans, nothing ripped', form: 'straight', color: CIV.denim, waist: CIV.darkbrown },
  npc_pants_jeans_light: { name: 'Civilian · light jeans', tier: 'common', why: 'everyday · faded loose jeans: the tourist, the student', form: 'roomy', color: CIV.lightdenim, waist: CIV.brown, paint: cuff(CIV.lightdenim) },
  npc_pants_work: { name: 'Civilian · canvas work pants', tier: 'common', why: 'trades · brown canvas work pants', form: 'baggy', color: CIV.camel, waist: CIV.darkbrown },
  npc_pants_scrubs: { name: 'Civilian · scrub pants', tier: 'common', why: 'service · plain teal scrub pants', form: 'straight', color: CIV.teal },
  npc_pants_sweats: { name: 'Civilian · grey sweatpants', tier: 'common', why: 'everyday · grey sweatpants for the morning jog', form: 'roomy', color: CIV.heather, waist: shade(CIV.heather, .88), paint: cuff(CIV.heather) },
  npc_pants_olive: { name: 'Civilian · olive chinos', tier: 'common', why: 'everyday · olive chinos: the student, the dog walker', form: 'slim', color: CIV.olive },
  npc_shorts_khaki: { name: 'Civilian · tourist shorts', tier: 'common', why: 'weekend · khaki shorts and white crew socks: the tourist, the retiree in July', form: 'shorts', color: CIV.beige, waist: CIV.brown, sock: 'crew', sockColor: CIV.white },
};
