// R5-deals, a promised cut and a deal (GAME.md §10, §12, §14; errand.mjs, rules/deals.mjs): a pay of exactly what an
// unsettled promise to pay its payee still wants, naming no sit-down, is that promise's (§12 counts it against the
// promise), so a goods deal between the two doesn't count it as well; one that names the deal's sit-down counts there,
// and one of any other amount counts against the deal as before. Found measuring the bench: a hirer's pay to its
// muscle, which also sold it goods, landed on the goods deal. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
// a01 promises a02 a cut for tonight, and buys chems from a02 in the same sit-down: agreed, handed over, unpaid.
function hiredAndOwing() {
  const g = new Game({ n: 3 });
  stock(g, 'a02', 'chems', 2);
  g.grant('a01', 10 * N.rent);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  const cut = N.rent;
  const price = 3 * N.rent;
  ok(g, 'a01', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', cash: cut, night: 1 } });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: 2 }, cash: price } });
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: price } });
  ok(g, 'a02', 'give', { to: 'a01', goods: { chems: 2 } });
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.agreed, d.owes, d.due, d.paid]), [[true, 'me', price, 0]], 'control: a01 owes for the chems');
  return { g, sd, cut, price };
}

test('a pay of exactly the promised cut is the promise\'s: the goods deal between the two counts none of it, and the next pay settles the deal (§10, §12, §14)', () => {
  const { g, cut, price } = hiredAndOwing();
  ok(g, 'a01', 'pay', { to: 'a02', amount: cut, for: 'deal' });
  assert.equal(g.s.promises.find(p => p.by === 'a01' && p.what === 'pay').paid, cut, 'control: §12 counts it against the promise');
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.owes, d.paid]), [['me', 0]], 'and the deal counts none of it');
  ok(g, 'a01', 'pay', { to: 'a02', amount: price, for: 'deal' });
  assert.deepEqual(g.view('a01').me.deals, [], 'the pay for the chems settles the deal');
});

test('a pay naming the deal\'s sit-down counts there, though it is the promised cut exactly; a pay of another amount counts against the deal as before (§10, §14)', () => {
  const named = hiredAndOwing();
  ok(named.g, 'a01', 'pay', { to: 'a02', amount: named.cut, for: 'deal', sitdown: named.sd });
  assert.deepEqual(named.g.view('a01').me.deals.map(d => d.paid), [named.cut], 'named, it counts against the deal');
  const other = hiredAndOwing();
  ok(other.g, 'a01', 'pay', { to: 'a02', amount: other.cut + 1 });
  assert.deepEqual(other.g.view('a01').me.deals.map(d => d.paid), [other.cut + 1], 'another amount counts against the deal');
});
