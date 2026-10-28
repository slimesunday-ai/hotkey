// NPC POOL · shoes (slot 'shoes'). Oxfords, loafers, plain sneakers, runners, work boots, a nurse's clog, canvas slip-ons: on the
// approved lasts only (motion-checked volumes, README § Shoes), painted in the civilian palette. No logos, no colour pops, no stripes.
// README § The NPC pool. The only import allowed is './kit.js'.
import { shade, CIV } from './kit.js';
const two = (upper, sole, l = 0) => q => q.region === 'sole' || q.region === 'outsole' ? [sole, 0] : q.region === 'midsole' ? [shade(sole, 1.1), 0] : [upper, l];
export default {
  npc_shoes_oxford: { name: 'Civilian · black oxfords', tier: 'common', why: 'office · black leather oxfords, a little shine', last: 'lowline', paint: two(CIV.black, CIV.charcoal, 1) },
  npc_shoes_loafer: { name: 'Civilian · brown loafers', tier: 'common', why: 'office · brown loafers, worn at the heel', last: 'lowline', paint: two(CIV.brown, CIV.darkbrown, 1) },
  npc_shoes_sneaker: { name: 'Civilian · plain sneakers', tier: 'common', why: 'everyday · plain off-white sneakers, no marks', last: 'tongue',
    paint: q => q.region === 'outsole' ? [CIV.grey, 0] : q.region === 'midsole' ? [CIV.white, 0] : q.region === 'tongue' ? [CIV.cream, 0] : [CIV.lightgrey, 0] },
  npc_shoes_runner: { name: 'Civilian · grey runners', tier: 'common', why: 'everyday · grey running shoes: the jogger, the nurse off shift', last: 'terrace', paint: two(CIV.grey, CIV.lightgrey) },
  npc_shoes_boot: { name: 'Civilian · work boots', tier: 'common', why: 'trades · tan work boots, scuffed', last: 'fullcourt', paint: two(CIV.tan, CIV.darkbrown) },
  npc_shoes_clog: { name: 'Civilian · white clogs', tier: 'common', why: 'service · plain white clogs: the night shift at St. Mercy', last: 'terrace', paint: two(CIV.white, CIV.lightgrey) },
  npc_shoes_canvas: { name: 'Civilian · navy canvas', tier: 'common', why: 'everyday · navy canvas slip-ons, cream sole', last: 'lowline', paint: two(CIV.navy, CIV.cream) },
};
