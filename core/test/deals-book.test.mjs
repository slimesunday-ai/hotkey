// R5-deals, the bots' one debt book (bench/bots.mjs; GAME.md §9, §10): a bot reads what is owed, either way, from the
// deal record in its own view (`me.deals`), never from a memory of its own that can drift from it; it pays what the
// record says it owes, naming the deal's sit-down when it is in more than one deal with that agent, so the record
// credits the deal it means; and it never fills an order under its own quote. The review's probe:
// a Smuggler that quoted 4 chems for $60 filled a $4 order for them, settled at $4 on the record while its memory booked
// $56 owed. Amounts come from N and the bots' own settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const bots = () => import('../bench/bots.mjs');
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
async function world(cfgs) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const memos = {};
  const cfg = id => ({ id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[Number(id.slice(1)) - 1] });
  const errands = (id, round) => {
    const out = makeBot(cfg(id), (memos[id] ||= {})).day(g.view(id), { seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'bot', id, g.s.day, round) });
    for (const e of out) ok(g, id, e.kind, e);
    return out;
  };
  return { g, errands, memos };
}

test("the review's probe: a bot seller never fills an order under its own quote; it states its quote again, and nothing is owed on the record (§9, §14)", async () => {
  const { STREET } = await bots();
  const { g, errands, memos } = await world([{ type: 'smuggler', trade: 'smuggler', every: true }, { trade: 'chemist' }]);
  const n = N.cook.chems * N.cook.batches;
  stock(g, 'a01', 'chems', 2 * n);
  g.grant('a02', 10 * N.rent);
  errands('a01', 1);
  const sd = g.view('a01').me.sitdowns.find(x => x.with === 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  assert.ok(errands('a01', 2).some(e => e.sitdown === sd && e.terms && e.terms.what === 'sell'), 'control: it quotes');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: n }, cash: n } });
  const turn = errands('a01', 3);
  assert.ok(!turn.some(e => e.kind === 'give'), 'a $1-a-unit order under its $' + STREET.unit + ' quote: no goods');
  assert.deepEqual(turn.filter(e => e.sitdown === sd).map(e => [e.say, e.terms.what, e.terms.cash]), [['offer', 'sell', n * STREET.unit]], 'its quote, again');
  assert.deepEqual(g.view('a02').me.deals.map(d => d.owes), [null], 'nothing owed either way');
  assert.equal(memos.a01.unpaid, undefined, 'and no book of its own beside the record');
});

test('a bot buyer pays what the record says it owes, and a bot seller reads what its buyers owe from the record: one that owes past two nights\' goods is not asked again (§9, §10)', async () => {
  const { STREET } = await bots();
  const { g, errands, memos } = await world([{ type: 'chemist', trade: 'chemist', every: true }, { trade: 'smuggler' }, { type: 'smuggler', trade: 'smuggler', every: true }, { trade: 'chemist' }]);
  g.grant('a01', 10 * N.rent);
  stock(g, 'a02', 'chems', 4);
  // a02, a hand-played Smuggler, asks the bot Chemist a01, which orders there.
  ok(g, 'a02', 'ask', { to: 'a01' });
  const sd = g.events('ask').at(-1).sitdown;
  const order = errands('a01', 1).find(e => e.kind === 'say' && e.sitdown === sd);
  assert.ok(order, 'control: the Chemist orders');
  const units = Object.values(order.terms.goods)[0];
  ok(g, 'a02', 'give', { to: 'a01', goods: { chems: units } });
  const due = g.view('a01').me.deals[0].due;
  const paid = errands('a01', 2).filter(e => e.kind === 'pay');
  assert.deepEqual(paid.map(e => [e.to, e.amount]), [['a02', due]], 'it pays the record\'s due');
  assert.deepEqual(g.view('a01').me.deals, [], 'and the deal settled');
  assert.equal(memos.a01.debts, undefined, 'from no book of its own');
  // a03, a bot Smuggler, delivers to a04, a hand-played Chemist that never pays: two nights' goods and more.
  const goodsOwed = 3 * N.cook.chems * N.cook.batches;
  stock(g, 'a03', 'chems', 2 * goodsOwed);
  g.night();
  ok(g, 'a03', 'ask', { to: 'a04' });
  const s2 = g.events('ask').at(-1).sitdown;
  ok(g, 'a04', 'answer', { sitdown: s2, accept: true });
  ok(g, 'a04', 'say', { sitdown: s2, say: 'offer', terms: { what: 'trade', goods: { chems: goodsOwed }, cash: goodsOwed * STREET.unit } });
  ok(g, 'a03', 'give', { to: 'a04', goods: { chems: goodsOwed } });
  ok(g, 'a03', 'close', { sitdown: s2 });
  g.night();
  assert.equal(g.view('a03').me.deals.find(d => d.with === 'a04').owes, 'them', 'control: the record says a04 owes');
  const asks = errands('a03', 1).filter(e => e.kind === 'ask');
  assert.ok(!asks.some(e => e.to === 'a04'), `it doesn't ask a04 again: ${JSON.stringify(asks)}`);
});

test('a bot buyer that owes one seller on two deals pays each, naming each one\'s sit-down, and the record credits each its own (§10, §14)', async () => {
  const { STREET } = await bots();
  const { g, errands } = await world([{ type: 'chemist', trade: 'chemist', every: true }, { trade: 'smuggler' }]);
  g.grant('a01', 10 * N.rent);
  const units = N.cook.chems;
  const cash = units * STREET.unit;
  stock(g, 'a02', 'chems', 2 * units);
  // Two sit-downs in turn: in each, a01 orders the same chems and a02, a hand-played Smuggler, hands them over.
  const sds = [];
  for (let i = 0; i < 2; i++) {
    ok(g, 'a02', 'ask', { to: 'a01' });
    const sd = g.events('ask').at(-1).sitdown;
    ok(g, 'a01', 'answer', { sitdown: sd, accept: true });
    ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: units }, cash } });
    ok(g, 'a02', 'give', { to: 'a01', goods: { chems: units } });
    ok(g, 'a02', 'close', { sitdown: sd });
    sds.push(sd);
  }
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.sitdown, d.owes, d.due]), sds.map(sd => [sd, 'me', cash]), 'control: it owes on both, the same');
  const paid = errands('a01', 2).filter(e => e.kind === 'pay');
  assert.deepEqual(paid.map(e => [e.to, e.amount, e.sitdown]), sds.map(sd => ['a02', cash, sd]), 'it names each deal it pays');
  assert.deepEqual(g.view('a01').me.deals, [], 'and each settled');
});
