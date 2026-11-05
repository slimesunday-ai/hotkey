// C2, the drawn half · THE CARD'S HEAD AND POCKETS ON THE RECORD PATH (ui/record/dossier.js draws them).
//   wearing  board.agents[].fit (the worn pieces, public) by name and tier, or "hidden" (fitHidden); trait art is on hold, so a piece
//            is a named tile, never a picture
//   pockets  the LAST DISCLOSED holdings receipt (panel-data.js tapeAt → holdings: the typed fields of the latest `holdings` event the
//            presented snapshot carries for the agent), never advanced, never newer than its disclosure: cash, the pieces held (copy +
//            trait), the goods with their counts, and the crew stash (the receipt's crew: cash, pieces, goods), as the old card's icon
//            grid, under the TAPE lens badge "as of" the receipt's own minute. No receipt yet: no values at all, only why
// Each value's element names what it shows for tools/pocketscheck.mjs: data-pk (cash · piece · goods.<k> · crew.cash · crew.piece ·
// crew.goods.<k>), data-n (a count or a sum), data-copy and data-trait (a piece). Nothing here computes a value: it lays out fields.
import { h, lens as lensBadge } from '../kit.js';
import { iconFor } from '../icons/icons.js';
import { clock } from './format.js';
import { traitName } from './board-format.js';

// a good's picture in the atlas (ui/icons: the old game's art; a good with none gets the atlas's neutral box) and its word
const GOODS = { parts: ['pipe', 'parts'], chems: ['goo', 'chems'], guns: ['gun', 'guns'], lockpicks: ['pick', 'lockpicks'], warrants: ['unknown', 'warrants'],
  doses: ['unknown', 'doses'], temp: ['temp', 'temp'], hallu: ['hallu', 'hallu'], sudo: ['sudo', 'sudo'], truth: ['truth', 'truth'], clear: ['clear', 'clear'], firewall: ['firewall', 'firewall'] };
const sub = (title, ...kids) => h('div', { class: 'r-pk-sub' }, h('h4', { class: 'r-pk-h' }, title), ...kids);
const none = text => h('p', { class: 'r-none' }, text);

function good(pk, k, n) {
  const [icon, word] = GOODS[k] ?? ['unknown', k];
  return h('div', { class: 'k-slot r-pk-slot', role: 'listitem', tabindex: '0', 'data-pk': pk, 'data-n': String(n), 'data-tip': `${word} ×${n}`, 'aria-label': `${word}, ${n}` },
    iconFor(icon, { size: 34, label: word }), h('b', { class: 'k-slot-n' }, String(n)), h('i', { class: 'r-pk-word' }, word));
}
function piece(pk, p, board) {
  const name = traitName(board, p.trait), slot = p.slot ?? board?.list?.find(t => t.trait === p.trait)?.slot ?? '';
  return h('div', { class: 'r-piece', role: 'listitem', tabindex: '0', 'data-pk': pk, 'data-copy': p.copy, 'data-trait': p.trait, 'data-tier': p.tier ?? '',
    'data-tip': `${name} · ${slot}${p.tier ? ' · ' + p.tier : ''}${p.fake ? ' · fake' : ''}` }, h('span', { class: 'r-piece-slot' }, slot), h('b', { class: 'r-piece-name' }, name),
    p.tier ? h('small', { class: 'r-piece-tier' }, p.tier) : null);
}
const cashRow = (pk, label, n) => h('div', { class: 'r-stat r-pk-cash', 'data-pk': pk, 'data-n': String(n) }, h('span', null, label), h('b', null, '$' + n));
const goodsGrid = (pk, goods) => { const e = Object.entries(goods ?? {}).filter(([, n]) => n); return e.length ? h('div', { class: 'k-slots r-pk-goods', role: 'list' }, ...e.map(([k, n]) => good(pk + k, k, n))) : null; };
const piecesGrid = (pk, pieces, board) => pieces?.length ? h('div', { class: 'r-pieces', role: 'list' }, ...pieces.map(p => piece(pk, p, board))) : null;

// the worn pieces (public), for the card's head
export function wearing(card, board) {
  if (!card) return [];
  if (card.fitHidden) return [h('span', { class: 'r-wear-none', 'data-wear': 'hidden' }, 'Fit hidden')];
  if (!card.fit?.length) return [h('span', { class: 'r-wear-none', 'data-wear': 'none' }, 'Wearing nothing from Fit Street')];
  return card.fit.map(p => h('span', { class: 'r-wear', 'data-wear': p.trait, 'data-tier': p.tier ?? '', 'data-tip': `${p.slot ?? ''}${p.tier ? ' · ' + p.tier : ''}` },
    h('small', null, p.slot ?? board?.list?.find(t => t.trait === p.trait)?.slot ?? ''), traitName(board, p.trait)));
}

// the Pockets section, from panelsAt(...).tape.holdings (a panel-events row: its typed fields, its id, its minute)
export function pockets(held, board) {
  const r = held?.fields ?? null, badge = lensBadge('tape', held ? 'as of ' + clock(held.minute) : 'not disclosed yet');
  const box = h('section', { class: 'r-sec r-pockets', 'data-sec': 'Pockets', 'data-pockets': '', 'data-receipt': held ? String(held.id) : '', 'data-asof': held ? String(held.minute) : '' },
    h('div', { class: 'r-pk-head' }, h('h3', { class: 'r-h' }, 'Pockets'), badge));
  if (!r) { box.append(none('Nothing of theirs disclosed yet: cash, pieces and stashes reach the record a game day late.')); return box; }
  box.append(cashRow('cash', 'Cash', r.cash ?? 0));
  box.append(sub('Pieces', piecesGrid('piece', r.pieces, board) ?? none('No pieces.')));
  box.append(sub('Goods', goodsGrid('goods.', r.goods) ?? none('No goods.')));
  if (r.crew) {
    const c = r.crew, kids = [cashRow('crew.cash', 'Cash', c.cash ?? 0), piecesGrid('crew.piece', c.pieces, board), goodsGrid('crew.goods.', c.goods)].filter(Boolean);
    const crew = board?.crews?.find(x => x.id === c.id)?.name ?? c.id;
    box.append(sub(`Crew stash${crew ? ' · ' + crew : ''}`, ...kids));
  } else box.append(sub('Crew stash', none('No crew stash.')));
  return box;
}
