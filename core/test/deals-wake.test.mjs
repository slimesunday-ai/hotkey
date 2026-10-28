// R5-deals, the runner's wake rule (runner.mjs `wakes`; GAME.md §17: a message wakes the seat, and it handles
// everything waiting in one call): a hand-over against a deal the seat agreed to, that leaves it owing, wakes it in a
// later round, so it can settle before the lock: goods that came for cash it hasn't paid, or cash that came for goods it
// hasn't given. It wakes it once for each hand-over: `seen` is the last event its own call has read, so one its call has
// read, today's or an earlier day's (round 1 calls every seat), wakes it no more. A hand-over that leaves it owing
// nothing, or one against an offer nobody agreed to, wakes nobody. The call ceiling (N.callCeiling) is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const runner = () => import('../bench/runner.mjs');
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `${id}'s ${kind} went through (${r.why})`);
}
// What a call reading this view has seen: the last event in it.
const seenBy = v => Math.max(-1, ...v.events.map(e => e.n));
// a01 and a02 in a sit-down, a01 holding chems: `by` says an offer on these terms there. Returns the game and sit-down.
function offered(by, what) {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'chems', 4);
  g.grant('a02', 4 * N.rent);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  ok(g, by, 'say', { sitdown: sd, say: 'offer', terms: { what, goods: { chems: 2 }, cash: 2 * N.rent } });
  return { g, sd };
}

test("goods that came against the buyer's own order wake its seat in a later round, once: not again once its call has read them, the next day either; round 1 calls it as ever (§10, §17)", async () => {
  const { wakes } = await runner();
  const { g, sd } = offered('a02', 'trade');
  const seen = seenBy(g.view('a02'));
  assert.equal(wakes(g.view('a02'), 2, seen), false, 'control: nothing waits for a02 in round 2');
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 2 } });
  // The seller's part is done: it closes the sit-down, so no word in it wakes anyone; the deal goes on.
  ok(g, 'a01', 'close', { sitdown: sd });
  assert.equal(wakes(g.view('a02'), 2, seen), true, 'the delivery wakes it');
  assert.equal(wakes(g.view('a01'), 2, -1), false, 'the seller owes nothing: it stays asleep');
  const read = seenBy(g.view('a02'));
  ok(g, 'a02', 'pay', { to: 'a01', amount: N.rent, for: 'debt' });
  assert.equal(wakes(g.view('a02'), 3, read), false, 'its call read it: half paid, it still owes, and nothing new came');
  g.night();
  assert.equal(g.view('a02').me.deals[0].owes, 'me', 'control: the next day it still owes');
  assert.equal(wakes(g.view('a02'), 2, read), false, "yesterday's hand-over had its call");
  assert.equal(wakes(g.view('a02'), 1, read), true, 'round 1 calls it as ever');
  ok(g, 'a02', 'pay', { to: 'a01', amount: N.rent, for: 'debt' });
  assert.deepEqual(g.view('a02').me.deals, [], 'settled');
});

test("cash that came against the seller's own offer wakes its seat, until it gives what the cash covers; a prepay against the buyer's own order agrees nothing and wakes nobody, nor does a gift (§10, §17)", async () => {
  const { wakes } = await runner();
  // The buyer's own order, paid ahead: nobody agreed to it, so the seller owes nothing.
  const own = offered('a02', 'trade');
  ok(own.g, 'a02', 'pay', { to: 'a01', amount: N.rent });
  ok(own.g, 'a02', 'close', { sitdown: own.sd });
  assert.equal(wakes(own.g.view('a01'), 2, -1), false, 'a prepay against its own order wakes nobody');
  // The seller's own offer, paid ahead: the buyer's pay acts on it, and the seller owes what the cash covers.
  const { g, sd } = offered('a01', 'sell');
  const seen = seenBy(g.view('a01'));
  ok(g, 'a02', 'pay', { to: 'a01', amount: N.rent });
  ok(g, 'a02', 'close', { sitdown: sd });
  assert.equal(wakes(g.view('a01'), 2, seen), true, 'paid up front against its own offer: the seller owes the goods, and wakes');
  assert.equal(wakes(g.view('a02'), 2, -1), false, 'the buyer owes nothing');
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  assert.equal(wakes(g.view('a01'), 2, seen), false, 'it gave what the cash covers');
  ok(g, 'a01', 'give', { to: 'a03', goods: { chems: 1 } });
  assert.equal(wakes(g.view('a03'), 2, -1), false, 'a gift owes nothing');
});
