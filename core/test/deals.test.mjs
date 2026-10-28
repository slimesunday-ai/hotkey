// R5-deals, the rules: a sit-down's deal is a typed fact the core owns (rules/deals.mjs; GAME.md §10, §14). An offer
// of trade terms (goods or a piece for cash: `trade` buys, `sell` sells) states the sit-down's deal; the latest stands.
// The core counts what each side hands the other against it, by give and pay, and both sides see it in their own view
// until it settles, after the sit-down too. Nothing moves by itself: every give and pay stays an errand, and no term
// binds anyone. Each test sets up its own season; amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `${id}'s ${kind} went through (${r.why})`);
  return r;
}
// a01 asks a02, a02 takes it: the sit-down's id.
function sitDown(g, a = 'a01', b = 'a02') {
  ok(g, a, 'ask', { to: b });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, b, 'answer', { sitdown: sd, accept: true });
  return sd;
}
const dealsOf = (g, id) => g.view(id).me.deals;
const price = N.rent;
const cashOf = g => Object.fromEntries(Object.keys(g.s.agents).map(id => [id, g.s.agents[id].cash]));

test('an offer of trade terms states the sit-down\'s deal: "trade" makes its speaker the buyer, "sell" the seller; both sides see it, and nothing moves (§10, §14)', () => {
  const g = new Game({ n: 3 });
  g.grant('a02', 4 * price);
  const sd = sitDown(g);
  const cash = cashOf(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * price } });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.sitdown, d.role, d.with, d.stated, d.goods, d.cash, d.paid, d.open, d.owes]),
    [[sd, 'seller', 'a02', 'them', { chems: 2 }, 2 * price, 0, true, null]], "a02's order: a01 sells");
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.role, d.with, d.stated]), [['buyer', 'a01', 'me']]);
  assert.deepEqual(dealsOf(g, 'a03'), [], 'nobody else sees it');
  // The latest offer stands: a01's own terms now, as the seller.
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { parts: 3 }, cash: 3 * price } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.role, d.with, d.stated, d.goods, d.cash]), [['buyer', 'a01', 'them', { parts: 3 }, 3 * price]]);
  // Words with no trade in them state none: a promise, an answer, terms with no cash.
  ok(g, 'a02', 'say', { sitdown: sd, say: 'answer', terms: { what: 'trade', goods: { parts: 1 }, cash: price } });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 1 } } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.stated, d.goods]), [['them', { parts: 3 }]], 'still a01\'s terms');
  assert.deepEqual(cashOf(g), cash, 'stating a deal moves no cash');
  assert.deepEqual([g.s.agents.a01.goods, g.s.agents.a02.goods], [{}, {}], 'and no goods');
});

test('a give of the goods and a pay count against the deal; it shows until both halves are in, the cash due at its terms for the goods given (§10)', () => {
  const g = new Game({ n: 3 });
  g.grant('a02', 4 * price);
  stock(g, 'a01', 'chems', 4);
  const sd = sitDown(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  let [d] = dealsOf(g, 'a02');
  assert.deepEqual([d.given, d.due, d.paid, d.owes, d.givenDay], [{ chems: 1 }, price, 0, 'me', 1], 'one of two came: a02 owes its price');
  assert.equal(dealsOf(g, 'a01')[0].owes, 'them');
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'debt' });
  [d] = dealsOf(g, 'a02');
  assert.deepEqual([d.paid, d.owes, d.paidDay], [price, null, 1], 'paid for what came: nobody owes, and the deal is still open');
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 2 } });
  [d] = dealsOf(g, 'a02');
  assert.deepEqual([d.given, d.due, d.owes], [{ chems: 2 }, 2 * price, 'me'], 'the second came; one more than the terms counts for nothing');
  ok(g, 'a02', 'pay', { to: 'a01', amount: price });
  assert.deepEqual([dealsOf(g, 'a01'), dealsOf(g, 'a02')], [[], []], 'both halves in: it settled');
  assert.equal(g.s.agents.a02.goods.chems, 3, 'the rules moved only what the errands moved');
});

test('a deal goes on after its sit-down while one side owes, closed or past its last day; one with nothing owed ends with it (§10: the hand-over and the pay are errands of their own, §14)', () => {
  const g = new Game({ n: 4 });
  g.grant('a02', 4 * price);
  stock(g, 'a01', 'parts', 2);
  const sd = sitDown(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 2 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 } });
  ok(g, 'a01', 'close', { sitdown: sd });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.sitdown, d.open, d.owes, d.due]), [[sd, false, 'me', 2 * price]], 'closed, and still owed');
  g.night();
  g.night();
  assert.equal(dealsOf(g, 'a02').length, 1, 'days later too');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 2 * price, for: 'deal' });
  assert.deepEqual(dealsOf(g, 'a02'), [], 'until it is paid');
  // Nothing handed over: the deal ends with its sit-down, closed or expired.
  const sd2 = sitDown(g, 'a03', 'a04');
  ok(g, 'a03', 'say', { sitdown: sd2, say: 'offer', terms: { what: 'sell', goods: { chems: 1 }, cash: price } });
  assert.equal(dealsOf(g, 'a04').length, 1);
  for (let i = 0; i < N.sitdownDays; i++) g.night();
  assert.ok(g.events('close', e => e.sitdown === sd2 && e.why === 'expired').length, 'control: it expired');
  assert.deepEqual(dealsOf(g, 'a04'), [], 'and its deal with it');
});

test('a pay before the goods leaves the seller owing the goods its cash covers; a pay for a cut or a gift counts for no deal (§10, §12)', () => {
  const g = new Game({ n: 3 });
  g.grant('a02', 8 * price);
  const sd = sitDown(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: 4 }, cash: 4 * price } });
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'gift' });
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'cut' });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.paid, d.owes]), [[0, null]], 'a gift and a cut are no part of it');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 2 * price });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.paid, d.owes, d.paidDay]), [[2 * price, 'me', 1]], 'half paid up front: a01 owes two of the four');
  ok(g, 'a02', 'give', { to: 'a01', cash: 3 * price });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.paid, d.owes]), [[4 * price, 'me']], 'cash handed over counts too, up to the terms');
});

test('SUDO handed over counts as the TEMP a deal names, as it arrives (§11); a piece deal counts the piece; and once something is handed over, its terms stand, so new terms make a new deal (§10, §14)', () => {
  const g = new Game({ n: 3 });
  g.grant('a02', 4 * price);
  stock(g, 'a01', 'sudo', 1);
  const sd = sitDown(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { temp: 1 }, cash: price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { sudo: 1 } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.given, d.owes]), [[{ temp: 1 }, 'me']], 'it reads as the TEMP ordered');
  // New terms in the same sit-down: the old deal keeps its own.
  const vest = abilityCopy(g.s, 'vest');
  g.hand('a01', vest);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', piece: vest, cash: 2 * price } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.sitdown, d.goods || d.piece, d.owes]), [[sd, { temp: 1 }, 'me'], [sd, vest, null]], 'two deals now');
  ok(g, 'a01', 'give', { to: 'a02', copy: vest });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.gave, d.due]), [[undefined, price], [true, 2 * price]], 'the piece counts against the piece deal');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 3 * price });
  assert.deepEqual(dealsOf(g, 'a02'), [], 'one pay settles both');
});

test('the first hand-over can read a deal\'s terms the other way round: goods it names, handed over by the side its terms make the buyer, make that side the seller; other goods, or cash, never turn it; its own offer turned round is still unagreed until the other side acts on it (§10, §14)', () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'guns', 1);
  stock(g, 'a01', 'chems', 1);
  g.grant('a02', 4 * price);
  const sd = sitDown(g);
  // An offer to sell written as a purchase: read as a01 buying.
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { guns: 1 }, cash: 3 * price } });
  assert.deepEqual(dealsOf(g, 'a01').map(d => d.role), ['buyer'], 'control: the terms read a01 as the buyer');
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'gift' });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.role, d.paid, d.given]), [['buyer', 0, {}]], 'goods it doesn\'t name, and a gift, leave it as it was');
  ok(g, 'a01', 'give', { to: 'a02', goods: { guns: 1 } });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.role, d.given, d.agreed, d.owes]), [['seller', { guns: 1 }, false, null]], 'the gun it handed over makes a01 the seller; its own offer, so nobody owes yet');
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.role, d.agreed, d.owes]), [['buyer', false, null]]);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 3 * price, for: 'deal' });
  assert.deepEqual(dealsOf(g, 'a02'), [], 'a02 pays its price: agreed, and both halves in, it settled');
});
