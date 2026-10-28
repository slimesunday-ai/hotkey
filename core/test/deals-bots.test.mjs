// R5-deals, the bots (bench/bots.mjs; GAME.md §9, §10, §14), each from its own view and memory, beside players that
// act by hand here (as a model seat would):
// - a bot seller states its offer as typed terms once its sit-down opens (a street seller in one it asked for about
//   goods, a Gunrunner as it takes an ask while it holds a gun), so a buyer that orders nothing still reads them;
// - a bot buyer's order stays open as long as the sit-down does, and is paid for when the goods come, days later;
// - a bot closes a sit-down only when its deal is done or dead, and a buyer that paid first gets what its cash covers.
// No property moves by itself: every give and pay here is an errand. Each test imports what it needs itself, so each
// fails on its own before the change; amounts come from N and the bots' own settings.
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
// A season on day 1 with the trades named, in id order. `bot(i)` is a bot config for a01..; a seat with no config is
// played by hand. `errands(id, round)` plays the bot's day in that round, with a memory kept across calls, and applies
// what it sends.
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
  return { g, errands };
}
const sitdownWith = (g, a, b) => g.view(a).me.sitdowns.find(sd => sd.with === b);

test('a bot seller states its offer as typed terms once a buyer takes its ask with no order, keeps the sit-down open while the offer waits, and hands over to the order that comes the next day; it closes once its part is done (§9, §14)', async () => {
  const { STREET } = await bots();
  const { g, errands } = await world([{ type: 'smuggler', trade: 'smuggler', every: true }, { trade: 'chemist' }]);
  stock(g, 'a01', 'chems', 2 * N.cook.chems * N.cook.batches);
  g.grant('a02', 10 * N.rent);
  assert.ok(errands('a01', 1).some(e => e.kind === 'ask' && e.to === 'a02'), 'control: the Smuggler asks the Chemist');
  const sd = sitdownWith(g, 'a01', 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  const n = N.cook.chems * N.cook.batches;
  assert.deepEqual(errands('a01', 2).filter(e => e.sitdown === sd), [{ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: n }, cash: n * STREET.unit } }],
    'it states a buyer\'s night of goods at the agents\' price');
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.role, d.stated, d.goods, d.cash]), [['buyer', 'them', { chems: n }, n * STREET.unit]], 'the buyer reads it as a deal');
  assert.equal(errands('a01', 3).filter(e => e.sitdown === sd).length, 0, 'once');
  g.night();
  assert.ok(!errands('a01', 1).some(e => e.kind === 'close' && e.sitdown === sd), 'the next morning its offer still waits: it keeps the sit-down open');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: n }, cash: n * STREET.unit } });
  const turn = errands('a01', 2);
  assert.deepEqual(turn.filter(e => e.kind === 'give'), [{ kind: 'give', to: 'a02', goods: { chems: n } }], 'it hands the order over');
  assert.ok(turn.some(e => e.kind === 'close' && e.sitdown === sd), 'and, its part done, closes the sit-down');
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.owes, d.due, d.open]), [['me', n * STREET.unit, false]], 'the deal goes on: the buyer owes it');
  ok(g, 'a02', 'pay', { to: 'a01', amount: n * STREET.unit, for: 'debt' });
  assert.deepEqual(g.view('a02').me.deals, [], 'paid, it settled');
});

test('a bot buyer\'s order stays open as long as the sit-down does: a gun ordered from a Gunrunner that holds none waits, the buyer asks nobody else, and it pays the day the gun comes (§9, §10, §14)', async () => {
  const { g, errands } = await world([{ type: 'cop', trade: 'cop' }, { trade: 'gunrunner' }]);
  g.grant('a01', 8 * N.shopPrice.guns);
  assert.ok(errands('a01', 1).some(e => e.kind === 'ask' && e.to === 'a02'), 'control: the Cop asks the Gunrunner for a sit-down');
  const sd = sitdownWith(g, 'a01', 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  const order = errands('a01', 2).find(e => e.kind === 'say' && e.sitdown === sd);
  assert.deepEqual(order && [order.say, order.terms.what, order.terms.goods], ['offer', 'buy', { guns: 1 }], 'control: it orders a gun');
  g.night();
  const day2 = [1, 2, 3].flatMap(r => errands('a01', r));
  assert.ok(!day2.some(e => e.kind === 'close' && e.sitdown === sd), 'the next day its order still waits there');
  assert.ok(!day2.some(e => ['ask', 'shop'].includes(e.kind)), 'and it buys no gun elsewhere');
  g.night();
  stock(g, 'a02', 'guns', 1);
  ok(g, 'a02', 'give', { to: 'a01', goods: { guns: 1 } });
  const paid = errands('a01', 2).filter(e => e.kind === 'pay');
  assert.deepEqual(paid.map(e => [e.to, e.amount, e.for]), [['a02', order.terms.cash, 'debt']], 'two days on, the gun comes and it pays');
  assert.deepEqual(g.view('a02').me.deals, [], 'the deal settled');
});

test('a Gunrunner that takes an ask while it holds a gun states its offer as typed terms; a buyer that pays first, with no order, gets what its cash covers (§9, §10, §14)', async () => {
  const { GUNS, gunPrice } = await bots();
  const { g, errands } = await world([{ type: 'gunrunner', trade: 'gunrunner' }, { trade: 'cop' }]);
  stock(g, 'a01', 'guns', 1);
  g.grant('a02', 8 * N.shopPrice.guns);
  ok(g, 'a02', 'ask', { to: 'a01' });
  const sd = sitdownWith(g, 'a02', 'a01').id;
  const took = errands('a01', 1).filter(e => e.sitdown === sd);
  const price = Math.max(GUNS.min, gunPrice(g.view('a01')));
  assert.deepEqual(took, [{ kind: 'answer', sitdown: sd, accept: true }, { kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { guns: 1 }, cash: price } }]);
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'deal' });
  assert.deepEqual(errands('a01', 2).filter(e => e.kind === 'give'), [{ kind: 'give', to: 'a02', goods: { guns: 1 } }], 'paid up front, it hands the gun over');
  assert.deepEqual(g.view('a02').me.deals, [], 'and the deal settled');
});

test('a street seller paid up front against its terms hands over what the cash covers (§9, §10, §14)', async () => {
  const { STREET } = await bots();
  const { g, errands } = await world([{ type: 'smuggler', trade: 'smuggler', every: true }, { trade: 'chemist' }]);
  stock(g, 'a01', 'chems', N.cook.chems);
  g.grant('a02', 10 * N.rent);
  errands('a01', 1);
  const sd = sitdownWith(g, 'a01', 'a02');
  assert.ok(sd, 'control: the Smuggler asks the hand-played Chemist');
  ok(g, 'a02', 'answer', { sitdown: sd.id, accept: true });
  errands('a01', 2);
  assert.equal(g.view('a02').me.deals[0].stated, 'them', 'control: its terms stand');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 2 * STREET.unit });
  assert.deepEqual(errands('a01', 3).filter(e => e.kind === 'give' && e.to === 'a02'), [{ kind: 'give', to: 'a02', goods: { chems: 2 } }], 'two units paid for, two handed over');
  assert.deepEqual(g.view('a02').me.deals, [], 'both halves in: it settled');
});

test('a bot keeps a sit-down open while its order there waits, and closes it the morning after its deal is dead: its seller said it has none; then it asks again (§9, §14)', async () => {
  const { g, errands } = await world([{ type: 'cop', trade: 'cop' }, { trade: 'gunrunner' }, { trade: 'gunrunner' }]);
  g.grant('a01', 8 * N.shopPrice.guns);
  const asked = errands('a01', 1).find(e => e.kind === 'ask');
  assert.ok(asked, 'control: the Cop asks a Gunrunner');
  const seller = asked.to;
  const sd = sitdownWith(g, 'a01', seller).id;
  ok(g, seller, 'answer', { sitdown: sd, accept: true });
  assert.ok(errands('a01', 2).some(e => e.kind === 'say' && e.sitdown === sd), 'control: it orders');
  g.night();
  assert.ok(!errands('a01', 1).some(e => e.kind === 'close' && e.sitdown === sd), 'the next morning its order waits: open');
  ok(g, seller, 'say', { sitdown: sd, say: 'answer', terms: { what: 'trade', cash: 0 } });
  g.night();
  const next = errands('a01', 1);
  assert.ok(next.some(e => e.kind === 'close' && e.sitdown === sd), 'its deal is dead: it closes the sit-down');
  assert.ok(next.some(e => e.kind === 'ask'), 'and asks again');
});
