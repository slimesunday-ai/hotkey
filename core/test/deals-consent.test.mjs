// R5-deals, the review's rules (rules/deals.mjs; GAME.md §10, §14): a deal needs both sides. An offer of trade terms is
// only an offer until the other side offers the same terms back or hands over its own half against them; words alone
// (an answer) agree nothing. What an offerer hands over against its own offer, unagreed, is its risk: the other side
// reads a plain receipt for the day, never a debt. A hand-over counts against the deal it names by its sit-down, else
// the one whose terms it matches, and a return of goods or cash counts against the deal it belongs to. Each test sets
// up its own season; amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
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
function sitDown(g, a = 'a01', b = 'a02') {
  ok(g, a, 'ask', { to: b });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, b, 'answer', { sitdown: sd, accept: true });
  return sd;
}
const dealsOf = (g, id) => g.view(id).me.deals;
async function story(g, id) {
  const { read } = await tools();
  const { briefing } = await briefingOf();
  return briefing(read(g.view(id), { audience: 'seat', seed: 'R5-consent' }).result, { call: 'round' })[1].content;
}
const dealLines = text => text.split('\n').filter(l => /^- s\d+: /.test(l));
const price = N.rent;

test('a one-sided offer is only an offer: what its offerer pays against it is a plain receipt for the day, never a debt, and it is gone with its sit-down (§10, §14)', async () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 4 * price);
  const sd = sitDown(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { guns: 1 }, cash: price } });
  ok(g, 'a01', 'pay', { to: 'a02', amount: price });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.agreed, d.owes]), [[false, null]], 'a02 never agreed: it owes nothing');
  const lines = dealLines(await story(g, 'a02'));
  assert.equal(lines.length, 1, `a receipt for the day: ${lines}`);
  assert.match(lines[0], /a01 offers to buy 1 gun from you for \$\d+ \(not agreed\)/);
  assert.ok(!/due/.test(lines[0]), 'no amount due on an offer nobody agreed to');
  ok(g, 'a02', 'close', { sitdown: sd });
  assert.deepEqual(dealsOf(g, 'a02'), [], 'gone with its sit-down');
  g.night();
  assert.deepEqual(dealLines(await story(g, 'a02')), [], 'and no line the next day');
});

test('an offer is agreed by the same offer back, or by the other side handing over its half; an answer with the same terms agrees nothing (§14)', () => {
  // The same terms offered back.
  let g = new Game({ n: 3 });
  let sd = sitDown(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: 2 }, cash: 2 * price } });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'answer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * price } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => d.agreed), [false], 'an answer agrees nothing');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * price } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.agreed, d.agreedDay, d.stated]), [[true, 1, 'them']], 'the same offer back agrees it');
  // A different offer back is a counter-offer, not an agreement.
  g = new Game({ n: 3 });
  sd = sitDown(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: 2 }, cash: 2 * price } });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: price } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.agreed, d.stated, d.cash]), [[false, 'me', price]], 'a counter-offer stands, unagreed');
  // The other side's half handed over: the buyer's cash against a seller's offer, the seller's goods against an order.
  g = new Game({ n: 3 });
  g.grant('a02', 4 * price);
  sd = sitDown(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: 2 }, cash: 2 * price } });
  ok(g, 'a02', 'pay', { to: 'a01', amount: price });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.agreed, d.owes]), [[true, 'me']], 'paid against it: agreed, and a01 owes the goods');
  g = new Game({ n: 3 });
  stock(g, 'a01', 'parts', 2);
  sd = sitDown(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 2 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.agreed, d.owes, d.due]), [[true, 'me', 2 * price]], 'an order filled: agreed, and a02 owes for it');
});

test('a return counts against the deal it belongs to: goods handed back lower what is due, and cash refunded lowers what was paid (§10)', () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'parts', 2);
  g.grant('a02', 4 * price);
  const sd = sitDown(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 2 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 } });
  ok(g, 'a02', 'give', { to: 'a01', goods: { parts: 1 } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.given, d.due, d.owes]), [[{ parts: 1 }, price, 'me']], 'one part back: half the price due');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 2 * price });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.paid, d.owes]), [[2 * price, 'them']], 'paid in full for one part: a01 owes the other');
  ok(g, 'a01', 'pay', { to: 'a02', amount: price });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.paid, d.owes]), [[price, null]], 'refunded: in step again');
  ok(g, 'a01', 'close', { sitdown: sd });
  assert.deepEqual(dealsOf(g, 'a02'), [], 'and settled with the sit-down over');
  // A seller that hands its goods over unasked and gets them straight back owes and is owed nothing.
  const h = new Game({ n: 3 });
  stock(h, 'a01', 'temp', 1);
  const sd2 = sitDown(h);
  ok(h, 'a01', 'say', { sitdown: sd2, say: 'offer', terms: { what: 'sell', goods: { temp: 1 }, cash: 50 * price } });
  ok(h, 'a01', 'give', { to: 'a02', goods: { temp: 1 } });
  ok(h, 'a02', 'give', { to: 'a01', goods: { temp: 1 } });
  assert.deepEqual(dealsOf(h, 'a02').map(d => [d.agreed, d.given, d.owes]), [[false, {}, null]], 'handed straight back: nothing given, nothing owed');
});

test('a hand-over counts against the deal it names by its sit-down, else the one whose terms it matches: an old debt never soaks up a pay meant for a new deal (§10, §14)', () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'parts', 2);
  stock(g, 'a01', 'chems', 1);
  g.grant('a02', 6 * price);
  const s1 = sitDown(g);
  ok(g, 'a02', 'say', { sitdown: s1, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 3 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 } });
  ok(g, 'a01', 'close', { sitdown: s1 });
  const s2 = sitDown(g, 'a02', 'a01');
  ok(g, 'a02', 'say', { sitdown: s2, say: 'offer', terms: { what: 'trade', goods: { chems: 1 }, cash: price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'deal' });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.sitdown, d.paid, d.owes]), [[s1, 0, 'me']], 'the pay matched the new deal, which settled; the old one still owes');
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, sitdown: s1 });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.sitdown, d.paid]), [[s1, price]], 'named, it went to the deal it named');
});

test('an offer to buy, then the offerer handing those goods over, reads as its offer to sell: still unagreed, so the other side owes nothing until it pays its half (§10, §14)', async () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'guns', 1);
  g.grant('a02', 10 * price);
  const sd = sitDown(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { guns: 1 }, cash: 5 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { guns: 1 } });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.role, d.agreed, d.owes]), [['buyer', false, null]], 'a gun a02 never agreed to buy: it owes nothing');
  assert.match(dealLines(await story(g, 'a02'))[0], /a01 offers to sell you 1 gun for \$\d+ \(not agreed\): a01 gave 1 of 1, you paid \$0\.$/);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 5 * price });
  assert.deepEqual(dealsOf(g, 'a02'), [], 'a02 pays its half: agreed, and settled');
});
