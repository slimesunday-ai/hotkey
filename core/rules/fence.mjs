// The fence at The Heap (GAME.md §9, §10, §19; layer 2). A listing puts a piece up at a price, and the first buyer gets
// it; a swap is two halves, each pieces, goods and cash, one put up for a named agent's. A listed piece stays with its
// seller until it sells (GAP gap.listed). The fence holds a swap's pieces and goods itself, and the cash where the list
// holds offers (§22), from the errand to the lock. At the lock every deal lands, before the plays are checked: the cash,
// less its cut (§38), the pieces and the goods, so tonight's plays and fights find them where they landed (GAP
// gap.fence). Night 14 settles nothing.
import { N } from '../numbers.mjs';
import { emit, toFew, byId, cashOut, moveCopy, addGoods } from './state.mjs';

const cut = cash => Math.floor((cash * N.fence) / 100);
const dealList = s => Object.values(s.fence.deals).sort((x, y) => byId(x.id, y.id));
const half = (pieces = [], cash = 0) => ({ pieces, goods: {}, cash });
export const copyHalf = h => ({ pieces: [...h.pieces], goods: { ...h.goods }, cash: h.cash });
// What the fence holds for a deal, half by half: a bought listing's cash (its piece stays with the seller), and a
// swap's offer and, once accepted, its answer.
const heldFor = d => (d.kind === 'listing'
  ? (d.buyer ? [[d.buyer, half([], d.price)]] : [])
  : [[d.a, d.give], ...(d.accepted ? [[d.b, d.get]] : [])]);

// The listing a piece is up in, or null (GAP gap.listed).
export const listingOf = (s, copy) => Object.values(s.fence.deals).find(d => d.kind === 'listing' && d.copy === copy) || null;

export function newDeal(s, fields) {
  const id = `f${s.fence.next++}`;
  s.fence.deals[id] = { id, ...fields };
  return s.fence.deals[id];
}

// The cash is held as the list holds an offer, so it's still the island's (§22, §23).
export function hold(s, a, deal, cash) {
  a.cash -= cash;
  s.offers.push({ by: a.id, fence: deal, amount: cash });
}
function release(s, by, deal) {
  const i = s.offers.findIndex(o => o.fence === deal && o.by === by);
  if (i < 0) throw new Error(`FENCE: no cash held for ${by} on ${deal}`);
  return s.offers.splice(i, 1)[0].amount;
}
// A swap's half goes up: its pieces and goods to the fence, its cash held.
export function putUp(s, a, deal, h) {
  for (const k of h.pieces) moveCopy(s, k, { k: 'fence' }, 'fence', { by: a.id, deal });
  for (const [k, n] of Object.entries(h.goods)) addGoods(a, k, -n);
  if (h.cash) hold(s, a, deal, h.cash);
}
function giveBack(s, d, to, h) {
  for (const k of h.pieces) moveCopy(s, k, { k: 'agent', id: to }, 'fence_back', { deal: d.id });
  for (const [k, n] of Object.entries(h.goods)) addGoods(s.agents[to], k, n);
  if (h.cash) s.agents[to].cash += release(s, to, d.id);
}
// A swap's half goes to the other side: its pieces and goods (its cash is paid, less the cut).
function handOver(s, d, to, h, n) {
  for (const k of h.pieces) moveCopy(s, k, { k: 'agent', id: to }, 'fence', { deal: d.id, night: n });
  for (const [k, u] of Object.entries(h.goods)) addGoods(s.agents[to], k, u);
}
function pay(s, to, cash) {
  s.agents[to].cash += cash - cut(cash);
  if (cut(cash)) cashOut(s, 'fence', cut(cash));
}

// The lock (§9: "the fence holds both until the lock"), before tonight's plays are checked: a bought listing pays its
// seller, less the cut, and its piece goes to the buyer; an accepted swap pays its cash, less the cut, and each half goes
// to the other side; a swap nobody accepted goes back. Each settled deal is done. Unbought listings stay up.
export function settleFence(s, out, n) {
  for (const d of dealList(s)) {
    if (d.kind === 'listing' && !d.buyer) continue;
    if (d.kind === 'swap' && !d.accepted) {
      giveBack(s, d, d.a, d.give);
      emit(s, out, 'fence', { act: 'expired', deal: d.id, a: d.a, b: d.b }, toFew(s, [d.a, d.b]));
    } else if (d.kind === 'swap') {
      if (d.give.cash) pay(s, d.b, release(s, d.a, d.id));
      if (d.get.cash) pay(s, d.a, release(s, d.b, d.id));
      handOver(s, d, d.b, d.give, n);
      handOver(s, d, d.a, d.get, n);
      emit(s, out, 'fence', { act: 'swapped', deal: d.id, a: d.a, b: d.b, give: copyHalf(d.give), get: copyHalf(d.get), fee: cut(d.give.cash) + cut(d.get.cash) }, toFew(s, [d.a, d.b]));
    } else {
      const [price, trait] = [release(s, d.buyer, d.id), s.copies[d.copy].trait];
      pay(s, d.seller, price);
      moveCopy(s, d.copy, { k: 'agent', id: d.buyer }, 'fence', { deal: d.id, night: n });
      emit(s, out, 'fence', { act: 'sold', deal: d.id, agent: d.seller, copy: d.copy, trait, price, fee: cut(price), cash: price - cut(price) }, toFew(s, [d.seller]));
      emit(s, out, 'fence', { act: 'bought', deal: d.id, agent: d.buyer, copy: d.copy, trait, price }, toFew(s, [d.buyer]));
    }
    delete s.fence.deals[d.id];
  }
}

// Night 14: every listing ends at the lock, its piece already with its seller, and whatever the fence holds goes back
// to whoever put it up and boards with them (§15).
export function returnFence(s, out, vis) {
  for (const d of dealList(s)) {
    const back = heldFor(d);
    for (const [to, h] of back) giveBack(s, d, to, h);
    for (const [to, h] of d.kind === 'listing' ? [[d.seller, half([d.copy])], ...back] : back) {
      emit(s, out, 'fence', { act: 'returned', deal: d.id, agent: to, ...copyHalf(h) }, vis([to]));
    }
    delete s.fence.deals[d.id];
  }
}

// A listed piece that left its seller some other way tonight (a hit, a break-in, an arrest) ends its listing: it comes
// off the board, and the seller gets the event (GAP gap.listed). Run after the lock, when no listing is bought.
export function endLost(s, out, vis) {
  for (const d of dealList(s).filter(x => x.kind === 'listing')) {
    const h = s.copies[d.copy].holder;
    if (h.k === 'agent' && h.id === d.seller) continue;
    delete s.fence.deals[d.id];
    emit(s, out, 'fence', { act: 'lost', deal: d.id, agent: d.seller, copy: d.copy, trait: s.copies[d.copy].trait }, vis([d.seller]));
  }
}

// The ledger's check (§23): a listing's piece is with its seller, off its outfit, and in no other listing; the fence
// holds exactly the pieces its open swaps put up, and their goods are still the island's; and the cash held for it sits
// in the offers exactly as its live deals say.
export function fenceProblems(s) {
  const [claimed, owed, goods, bad, listed] = [[], [], {}, [], new Set()];
  for (const d of dealList(s)) {
    if (d.kind === 'listing') {
      const h = s.copies[d.copy] ? s.copies[d.copy].holder : {};
      if (h.k !== 'agent' || h.id !== d.seller) bad.push(`fence: ${d.id} lists ${d.copy}, which its seller ${d.seller} doesn't hold`);
      else if (Object.values(s.agents[d.seller].outfit).includes(d.copy)) bad.push(`fence: ${d.id} lists ${d.copy}, which ${d.seller} wears`);
      if (listed.has(d.copy)) bad.push(`fence: ${d.copy} is in two listings`);
      listed.add(d.copy);
    }
    for (const [by, h] of heldFor(d)) {
      claimed.push(...h.pieces);
      for (const [k, n] of Object.entries(h.goods)) goods[k] = (goods[k] || 0) + n;
      if (h.cash) owed.push(`${by} ${d.id} $${h.cash}`);
    }
  }
  const atFence = Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'fence').sort(byId);
  if (atFence.join() !== claimed.sort(byId).join()) bad.push(`fence: it holds ${atFence.join(' ') || 'nothing'}, its open swaps put up ${claimed.join(' ') || 'nothing'}`);
  const held = s.offers.filter(o => o.fence).map(o => `${o.by} ${o.fence} $${o.amount}`).sort(byId);
  if (held.join() !== owed.sort(byId).join()) bad.push(`fence: it holds cash ${held.join(', ') || 'none'}, its deals say ${owed.join(', ') || 'none'}`);
  return { bad, goods };
}

// §19: listings are on the board live, the piece and the price, never the seller or the copy (whose history would name
// the seller). A bought listing is off the board. An agent sees its own deals in full.
export const fenceBoard = s => dealList(s).filter(d => d.kind === 'listing' && !d.buyer).map(d => {
  const c = s.copies[d.copy];
  return { deal: d.id, trait: c.trait, slot: c.slot, tier: c.tier, price: d.price };
});
export const fenceMine = (s, id) => dealList(s).filter(d => [d.seller, d.buyer, d.a, d.b].includes(id)).map(d => (d.kind === 'listing'
  ? { deal: d.id, kind: d.kind, role: d.seller === id ? 'seller' : 'buyer', copy: d.copy, trait: s.copies[d.copy].trait, price: d.price, bought: !!d.buyer }
  : { deal: d.id, kind: d.kind, a: d.a, b: d.b, give: copyHalf(d.give), get: copyHalf(d.get), accepted: d.accepted }));
