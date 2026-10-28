// The fence (GAME.md §9, §10, §19, §21, §38; layer 2): listings and swaps at The Heap, held until the lock, 20% off the
// cash. Amounts come from N, never typed in, so tuning a number never breaks these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { ledgerProblems } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const fee = cash => Math.floor((cash * N.fence) / 100);
const dealOf = r => r.events.find(e => e.type === 'fence').deal;
const lowAll = g => Object.fromEntries(Object.keys(g.s.agents).map(id => [id, { kind: 'laylow' }]));
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  g.s.agents[id].goods[kind] = (g.s.agents[id].goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
}

test('a listing goes on the board with its piece and price, never the seller; the piece stays with its seller until it sells (§9, §19)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  const r = g.errand('a01', 'fence_list', { copy, price: 300 });
  assert.equal(r.ok, true);
  const deal = dealOf(r);
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a01' }, 'it stays with its seller until it sells, so a listing hides nothing from a theft');
  assert.ok(!Object.values(g.s.agents.a01.outfit).includes(copy), 'a listed piece comes off');
  const c = g.s.copies[copy];
  const listing = { deal, trait: c.trait, slot: c.slot, tier: c.tier, price: 300 };
  for (const v of [g.view(null, 'public'), g.view('a02'), g.view('a02', 'ownerAI')]) {
    assert.deepEqual(v.board.fence, [listing], `${v.audience}: the piece and the price`);
    assert.ok(!JSON.stringify(v.board.fence).includes('a01') && !JSON.stringify(v.board.fence).includes(copy), `${v.audience}: never the seller, nor the copy (its history would name the seller)`);
  }
  assert.deepEqual(g.view('a01').me.fence.map(d => [d.deal, d.copy, d.price]), [[deal, copy, 300]], 'the seller sees its own listing');
  assert.equal(g.view('a02').events.filter(e => e.type === 'fence').length, 0, 'who listed is private for 24 hours');
  g.night(lowAll(g));
  assert.equal(g.view('a02').events.filter(e => e.type === 'fence' && e.agent === 'a01').length, 1, '...and public 24 hours later');
});

test('the first buyer wins; its cash is held like a list offer; at the lock the seller is paid less the fence\'s cut and the piece changes hands, before the night\'s fights (§9, §22, §38)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'rare'));
  const price = 301;
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price }));
  g.grant('a02', 400);
  g.grant('a03', 400);
  assert.equal(g.errand('a02', 'fence_buy', { deal }).ok, true);
  assert.equal(g.s.agents.a02.cash, 400 - price, 'the cash leaves its stash now');
  assert.deepEqual(g.s.offers, [{ by: 'a02', fence: deal, amount: price }], 'and is held where the list holds offers');
  assert.deepEqual(g.view('a02').me.offers, [], 'it isn\'t a list offer');
  const late = g.errand('a03', 'fence_buy', { deal });
  assert.equal(late.ok, false, 'the first buyer wins');
  assert.equal(g.errand('a01', 'fence_unlist', { deal }).ok, false, 'a bought listing is final');
  assert.deepEqual(g.view(null, 'public').board.fence, [], 'and off the board');
  const r = g.night(lowAll(g));
  const sold = r.newEvents.find(e => e.type === 'fence' && e.act === 'sold');
  assert.deepEqual([sold.agent, sold.price, sold.fee, sold.cash], ['a01', price, fee(price), price - fee(price)]);
  assert.ok(!('buyer' in sold), 'the seller isn\'t told who bought');
  const bought = r.newEvents.find(e => e.type === 'fence' && e.act === 'bought');
  assert.deepEqual([bought.agent, bought.copy, bought.price], ['a02', copy, price]);
  assert.ok(!('seller' in bought), 'nor the buyer who sold');
  assert.equal(g.s.money.out.fence, fee(price), 'the cut leaves the island');
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a02' });
  assert.equal(g.s.copies[copy].hist.at(-1).t, g.s.clock - 1, 'it changed hands at the lock, not at dawn');
  assert.deepEqual(g.s.offers, []);
});

test('unlisting before anyone buys ends the listing at once; an unbought listing carries over (§9)', () => {
  const g = new Game({ n: 3 });
  const [x, y] = [g.hand('a01', tierCopy(g.s, 'common')), g.hand('a01', tierCopy(g.s, 'common', () => true, 1))];
  const dx = dealOf(g.errand('a01', 'fence_list', { copy: x, price: 50 }));
  const dy = dealOf(g.errand('a01', 'fence_list', { copy: y, price: 60 }));
  assert.equal(g.errand('a01', 'fence_unlist', { deal: dx }).ok, true);
  assert.deepEqual(g.s.copies[x].holder, { k: 'agent', id: 'a01' });
  assert.equal(g.errand('a02', 'fence_unlist', { deal: dy }).ok, false, 'only the seller takes it back');
  g.night(lowAll(g));
  assert.deepEqual(g.view(null, 'public').board.fence.map(l => l.deal), [dy], 'still up the next day');
  assert.deepEqual(g.s.copies[y].holder, { k: 'agent', id: 'a01' }, 'still its seller\'s');
});

test('a swap: each half is held from when it\'s put up until the lock, then swapped; the cut comes off cash only (§9; call #5)', () => {
  const g = new Game({ n: 3 });
  const mine = g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  const theirs = g.hand('a02', tierCopy(g.s, 'common'));
  g.grant('a01', 100);
  stock(g, 'a02', 'chems', 2);
  const r = g.errand('a01', 'fence_swap', { to: 'a02', give: { pieces: [mine], cash: 50 }, get: { pieces: [theirs], goods: { chems: 2 } } });
  assert.equal(r.ok, true);
  const deal = dealOf(r);
  assert.equal(g.s.copies[mine].holder.k, 'fence');
  assert.equal(g.s.agents.a01.cash, 50);
  assert.equal(g.errand('a03', 'fence_accept', { deal }).ok, false, 'only the agent it was offered to');
  assert.equal(g.errand('a02', 'fence_accept', { deal }).ok, true);
  assert.equal(g.s.copies[theirs].holder.k, 'fence');
  assert.deepEqual(g.s.agents.a02.goods, {}, 'its chems are at the fence');
  assert.equal(g.errand('a02', 'fence_accept', { deal }).ok, false, 'once');
  const n = g.night(lowAll(g));
  const swapped = n.newEvents.find(e => e.type === 'fence' && e.act === 'swapped');
  assert.equal(swapped.fee, fee(50));
  assert.deepEqual(g.s.copies[mine].holder, { k: 'agent', id: 'a02' });
  assert.deepEqual(g.s.copies[theirs].holder, { k: 'agent', id: 'a01' });
  assert.equal(g.s.agents.a01.goods.chems, 2);
  assert.equal(g.s.money.out.fence, fee(50));
  assert.equal(n.newEvents.find(e => e.type === 'fence' && e.act === 'swapped').get.cash, 0);

  // Piece for piece, the fence takes nothing.
  const h = new Game({ n: 2 });
  const [p, q] = [h.hand('a01', tierCopy(h.s, 'common')), h.hand('a02', tierCopy(h.s, 'common', () => true, 1))];
  h.errand('a02', 'fence_accept', { deal: dealOf(h.errand('a01', 'fence_swap', { to: 'a02', give: { pieces: [p] }, get: { pieces: [q] } })) });
  h.night(lowAll(h));
  assert.deepEqual([h.s.copies[p].holder.id, h.s.copies[q].holder.id], ['a02', 'a01']);
  assert.equal(h.s.money.out.fence || 0, 0);
});

test('a swap nobody accepts goes back at the lock; asking for a piece doesn\'t reveal who holds it (§9, §19)', () => {
  const g = new Game({ n: 3 });
  const elsewhere = g.hand('a03', tierCopy(g.s, 'common'));
  g.grant('a01', 30);
  const r = g.errand('a01', 'fence_swap', { to: 'a02', give: { cash: 30 }, get: { pieces: [elsewhere] } });
  assert.equal(r.ok, true, 'the offer can\'t tell a01 whether a02 holds it');
  const deal = dealOf(r);
  const tried = g.errand('a02', 'fence_accept', { deal });
  assert.equal(tried.ok, false, 'a02 can\'t give what it doesn\'t hold');
  assert.equal(g.s.agents.a01.cash, 0);
  const n = g.night(lowAll(g));
  assert.ok(n.newEvents.some(e => e.type === 'fence' && e.act === 'expired' && e.deal === deal));
  assert.equal(g.s.agents.a01.cash, 30 - N.rent, 'its cash came back at the lock, before rent was due at dawn');
  assert.equal(g.s.money.out.fence || 0, 0);
});

test('refused fence errands say why: a piece you don\'t hold, a bad price, your own listing, an empty half (§33)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'common'));
  g.grant('a01', 100);
  assert.equal(g.errand('a02', 'fence_list', { copy, price: 10 }).ok, false);
  for (const price of [0, -5, 2.5, '9']) assert.equal(g.errand('a01', 'fence_list', { copy, price }).ok, false, `price ${price}`);
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 10 }));
  assert.equal(g.errand('a01', 'fence_buy', { deal }).ok, false, 'not your own');
  assert.equal(g.errand('a02', 'fence_buy', { deal }).ok, false, 'not without the cash');
  assert.equal(g.errand('a02', 'fence_buy', { deal: 'f99' }).ok, false);
  assert.equal(g.errand('a01', 'fence_swap', { to: 'a02', give: {}, get: { cash: 5 } }).ok, false, 'both halves hold something');
  assert.equal(g.errand('a01', 'fence_swap', { to: 'a01', give: { cash: 5 }, get: { cash: 5 } }).ok, false);
  const bad = g.errand('a01', 'fence_swap', { to: 'a02', give: { cash: 5 }, get: { goods: { gold: 1 } } });
  assert.equal(bad.ok, false, 'goods are typed');
  assert.equal(bad.events[0].errand, 'fence_swap', 'the refusal is typed and named');
});

test('night 14: the fence is closed by day, and everything it holds goes back at the lock and boards with its owner (§9, §15)', () => {
  const g = new Game({ n: 3 });
  g.advanceTo(13);
  const [kept, back] = [g.hand('a01', tierCopy(g.s, 'rare')), g.hand('a01', tierCopy(g.s, 'common'))];
  const dk = dealOf(g.errand('a01', 'fence_list', { copy: kept, price: 900 }));
  const db = dealOf(g.errand('a01', 'fence_list', { copy: back, price: 50 }));
  g.night();
  assert.equal(g.s.day, 14);
  g.grant('a02', 1000);
  const closed = g.errand('a02', 'fence_buy', { deal: dk });
  assert.equal(closed.ok, false, 'no new deals on the last day');
  assert.equal(g.errand('a01', 'fence_unlist', { deal: db }).ok, true, 'but a seller can take its piece back to wear');
  assert.equal(g.errand('a01', 'fence_list', { copy: back, price: 50 }).ok, false, 'and can\'t put it up again');
  const r = g.night();
  assert.ok(r.newEvents.some(e => e.type === 'fence' && e.act === 'returned' && e.deal === dk && e.agent === 'a01'));
  assert.deepEqual(g.s.copies[kept].holder, { k: 'minted', id: 'a01' }, 'it went back and boarded with its owner');
  assert.deepEqual(g.s.copies[back].holder, { k: 'minted', id: 'a01' });
  assert.ok(Object.values(g.s.copies).every(c => c.holder.k !== 'fence'));
});

test('the ledger checks the fence: a piece it holds that no deal claims, or held cash no deal owns, is caught (§23)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'common'));
  g.grant('a02', 100);
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 40 }));
  g.errand('a02', 'fence_buy', { deal });
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control');
  const plant = fn => {
    const s = structuredClone(g.s);
    fn(s);
    return ledgerProblems(s);
  };
  assert.ok(plant(s => { s.fence.deals = {}; }).some(p => /fence/.test(p)), 'a piece at the fence with no deal');
  assert.ok(plant(s => { s.offers.push({ by: 'a03', fence: 'f9', amount: 5 }); s.money.in.test += 5; }).some(p => /fence/.test(p)), 'held cash with no deal');
  assert.ok(plant(s => { s.fence.deals[deal].price += 1; }).some(p => /fence/.test(p)), 'held cash that doesn\'t match its deal');
});
