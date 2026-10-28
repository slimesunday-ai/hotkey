// C1-11, the drawn half · A STORY OR RECEIPT ON SCREEN, from panel-events.js's `parts` only. Literal parts are the city's copy; each
// dynamic part is its own span with its source (data-ev, data-path), so the check can match it to the feed field it came from.
// Rendered as text nodes, never HTML. A disclosed (record) row always wears the disclosed-record badge.
import { h } from '../kit.js';
import { clock } from './format.js';

const FREE = new Set(['line', 'reason', 'name', 'say']);
export function recordBadge() {
  return h('span', { class: 'r-badge', 'data-badge': 'record', 'data-tip': 'The 24-hour record: private when it happened, public now' }, 'RECORD');
}
// row: a panel-events.js row (or a newsAt story); text: 'text' | 'ticker' | 'ch9' (all three are the same words today)
export function rowEl(row, { list, tag = 'li', when = true } = {}) {
  const words = h('span', { class: 'r-words', 'data-words': '' });
  for (const p of row.parts) {
    if (typeof p === 'string') { words.append(document.createTextNode(p)); continue; }
    const key = p.source.path.split('.').at(-1);
    words.append(h('span', { class: 'r-part' + (p.nameSource ? ' is-person' : ''), 'data-ev': p.source.eventId, 'data-path': p.source.path,
      'data-free': FREE.has(key) ? '' : null }, p.text));
  }
  return h(tag, { class: 'r-row is-' + row.scope, 'data-row': list, 'data-scope': row.scope, 'data-ev': row.id, 'data-type': row.type },
    row.scope === 'record' ? recordBadge() : null,
    when ? h('span', { class: 'r-when', 'data-when': row.minute }, clock(row.minute)) : null, words);
}
