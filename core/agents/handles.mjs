// Handles (GAME.md §3, §4, §19; brief R2-agents.md, task R2-3): no copy id reaches a player. The rules number copies `k`
// and three digits, and a fake's number continues the drop's (rules/setup.mjs, rules/night.mjs's forge), so a player
// that read copy ids could spot one. A seat and an owner's AI read each piece by its trait, tier and slot under a handle
// (`P3`), good for one briefing.
// - Handles are dealt by holder, then trait: the seat's own pieces, its crew's stash, each fit on the board by agent, the
//   vault, then the rest of the record. Ties are shuffled from the season's seed, the seat and the day, so a fake's
//   place in a list tells nothing, and every list of pieces comes in handle order.
// - They're numbered on from where the seat's last briefing stopped (`from`), so a handle from an older one reads as one.
// - A list sale shows who, what and how much (§19), never its copy, so no piece can be matched to a sale. The view owns
//   that rule (rules/view.mjs), for every audience and every path, so the deal has nothing of it to redact: a second
//   redaction here would only hide a view that broke it (docs/redesign/privacy-20261018.md).
// - Words an agent wrote keep their words, never a copy id.
// What's left is the honest tell, more pieces of a trait in view than §3's posted count, and the tells the rules keep
// (shades, its maker, the fence, a take that skips it). Pure: the same view, seed and first number give the same deal.
// The deal holds the copy ids (`byHandle`, `byCopy`), so it stays with the caller: only its `view` reaches a player.
import { rng, shuffle } from '../rng.mjs';

const COPY = /^k\d+$/;
const COPY_WORD = /\bk\d+\b/g;
const HANDLE = /^P([1-9]\d*)$/i;
const SHOWN = /^P\d+$/;
const K = 'k'.charCodeAt(0);
// Whether a string has a `k` then a digit somewhere: without one, no copy id is in it, whole or as a word.
function hasCopyWord(x) {
  for (let i = x.indexOf('k'); i !== -1; i = x.indexOf('k', i + 1)) {
    const c = x.charCodeAt(i + 1);
    if (c >= 48 && c <= 57) return true;
  }
  return false;
}
// What a copy id another agent wrote reads as.
const MASK = '[piece]';
// Words an agent wrote (§18): a sit-down's line, a play's reason, a crew's name.
const FREE_TEXT = new Set(['line', 'reason', 'name']);
const byText = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// Every string in x, with its key and the object holding it; a key that is itself a copy id counts as one.
function visit(x, fn, key = null, parent = null) {
  if (typeof x === 'string') fn(x, key, parent);
  else if (Array.isArray(x)) for (let i = 0; i < x.length; i++) visit(x[i], fn, key, parent);
  else if (x && typeof x === 'object') {
    for (const k of Object.keys(x)) {
      if (k.charCodeAt(0) === K && COPY.test(k)) fn(k, null, x);
      visit(x[k], fn, k, x);
    }
  }
}

// The view a seat or an owner's AI reads, with its pieces under handles, and the deal that maps them back.
export function dealHandles(v, { seed, from = 1 } = {}) {
  const seat = v.me ? v.me.id : null;
  const where = new Map();
  const traits = new Map();
  const at = (pieces, rank, holder = '') => {
    for (const p of pieces || []) if (p && COPY.test(p.copy) && !where.has(p.copy)) where.set(p.copy, [rank, holder]);
  };
  if (v.me) at(v.me.pieces, 0);
  if (v.me && v.me.crewStash) at(v.me.crewStash.pieces, 1);
  for (const a of v.board.agents) if (a.id !== seat) at(a.fit, 2, a.id);
  at(v.board.vault.pieces, 3);
  visit(v, (x, key, parent) => {
    if (FREE_TEXT.has(key) || !COPY.test(x)) return;
    if (!where.has(x)) where.set(x, [4, '']);
    if (key === 'copy' && typeof parent.trait === 'string' && !traits.has(x)) traits.set(x, parent.trait);
  });
  // By holder, then trait; each tie its own shuffle, its input in copy-id order, so its output owes that order nothing.
  const groups = new Map();
  for (const k of [...where.keys()].sort(byText)) {
    const [rank, holder] = where.get(k);
    const trait = traits.get(k) || '';
    const id = `${rank}|${holder}|${trait}`;
    if (!groups.has(id)) groups.set(id, { rank, holder, trait, copies: [] });
    groups.get(id).copies.push(k);
  }
  const order = [...groups.entries()]
    .sort(([, x], [, y]) => x.rank - y.rank || byText(x.holder, y.holder) || byText(x.trait, y.trait))
    .flatMap(([id, g]) => shuffle(rng(seed, 'handles', seat, v.day, id), g.copies));
  const byHandle = {};
  const byCopy = {};
  order.forEach((k, i) => {
    byHandle[`P${from + i}`] = k;
    byCopy[k] = `P${from + i}`;
  });
  const deal = { seat, day: v.day, from, next: from + order.length, byHandle, byCopy };
  return { ...deal, view: present(deal, v) };
}

// Anything for a player (a view, a tool's result): each copy id the deal holds as its handle, any other masked, and
// every list of pieces in handle order.
export function present(deal, x, key = null) {
  if (typeof x === 'string') {
    if (!hasCopyWord(x)) return x;
    if (FREE_TEXT.has(key) || !COPY.test(x)) return x.replace(COPY_WORD, MASK);
    return Object.hasOwn(deal.byCopy, x) ? deal.byCopy[x] : MASK;
  }
  if (Array.isArray(x)) {
    const out = new Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = present(deal, x[i], key);
    return inHandleOrder(out);
  }
  if (!x || typeof x !== 'object') return x;
  const out = {};
  for (const k of Object.keys(x)) {
    const shown = present(deal, k);
    const y = present(deal, x[k], k);
    if (shown === '__proto__') Object.defineProperty(out, shown, { value: y, writable: true, enumerable: true, configurable: true });
    else out[shown] = y;
  }
  return out;
}

// A list of handles, or of pieces (not events) under handles, sorted by handle; any other list as it was.
function inHandleOrder(xs) {
  const n = x => {
    const h = x && typeof x === 'object' && !('type' in x) ? x.copy : x;
    return typeof h === 'string' && SHOWN.test(h) ? Number(h.slice(1)) : null;
  };
  if (xs.length < 2 || !xs.every(x => n(x) !== null)) return xs;
  return xs.slice().sort((x, y) => n(x) - n(y));
}

// §33: a handle in a reply, back to the copy that briefing's view held, or why not: one from an older briefing could
// work once the agent reads again (not yet); one this briefing never dealt never will.
export function copyOf(deal, handle) {
  const m = typeof handle === 'string' ? handle.trim().match(HANDLE) : null;
  const n = m ? Number(m[1]) : 0;
  if (n && n < deal.from) return { ok: false, why: 'that handle is from an older briefing: read again', kind: 'not-yet' };
  if (!n || n >= deal.next) return { ok: false, why: 'no piece by that handle in this briefing', kind: 'never' };
  return { ok: true, copy: deal.byHandle[`P${n}`] };
}

export const handleOf = (deal, copy) => (typeof copy === 'string' && Object.hasOwn(deal.byCopy, copy) ? deal.byCopy[copy] : null);
