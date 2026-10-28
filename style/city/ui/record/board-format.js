// C1-10, the drawn half · HOW A BOARD OR CARD VALUE PRINTS. Pure and shared: ui/record/board.js and morning.js print every value of
// boardAt / cardsAt through bfmt(), and tools/boardscenario.mjs prints the same values through it to compare them with the page's DOM.
// Formatting only: no value is computed, joined or inferred, except a trait's display name, read from the same board's list row.
// A value with no source (null / undefined) prints nothing, and its element is left out.
import { fmt, has } from './format.js';

const MONEY = new Set(['price', 'floor', 'last', 'cash', 'amount', 'value']);
// a trait id → its name on the same board's list (the list carries every trait); an unknown trait prints its id
export const traitName = (B, trait) => B?.list?.find(t => t.trait === trait)?.name ?? trait;
export const stars = n => n > 0 ? '★'.repeat(n) : '☆';
export function bfmt(key, v, B = null) {
  if (!has(v)) return null;
  if (MONEY.has(key)) return '$' + v;
  switch (key) {
    case 'left': return `${v} left`;
    case 'opens': return `opens night ${v}`;
    case 'night': return `night ${v}`;
    case 'trait': return traitName(B, v);
    case 'heat': return stars(v);
    case 'level': return String(v).toUpperCase();
    // (a countdown in hours and minutes: the board's own minutes remaining, printed)
    case 'minutes': return `${Math.floor(v / 60)}h ${String(Math.floor(v % 60)).padStart(2, '0')}m`;
    case 'nightsLeft': return v === 1 ? '1 night' : `${v} nights`;
    case 'goods': { const e = Object.entries(v); return e.length ? e.map(([k, n]) => `${k} ${n}`).join(', ') : 'no goods'; }
    case 'fit': return v.length ? v.map(p => traitName(B, p.trait)).join(', ') : 'nothing';
    case 'masked': return v ? 'ski mask' : null;
    default: return fmt(key, v);
  }
}
