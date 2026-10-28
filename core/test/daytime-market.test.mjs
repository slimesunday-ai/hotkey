// R4-3, one clearing for the city's market (trunk docs/briefs/R4-astra-fixes.md, task 3; GAME.md §5, §9, §10, §19; GAP
// gap.marketOrder, gap.marketSeen). Astra's finding (FULL-SIMULATION-REVIEW-2026-10-17.md §3; root/probes.json): two
// Smugglers each selling six chems to the city's buyer got $37 and $20, and reversing the order reversed it; the shop
// asked $125 for the first four chems and $219 for the next four. The curves are intended; the first-come advantage
// isn't. Now:
// - shop and sell are orders by day, and the day's orders on each curve fill together at the lock, before the plays
//   lock: every unit still moves the price one step, and every order pays or gets the same price a unit, the curve's
//   average over the day's units, with the odd dollar going round by night, so the order they came in decides nothing;
// - a shop order names the most it pays, held until the lock, as an offer on the list is; the day's orders fill by
//   their limits, highest first, equal limits together, and an order whose limit is under the day's price comes back;
// - same-day funding: what an order brings comes at the lock, in time for tonight's plays and dawn's rent;
// - §19 unchanged: prices are on the board live and every move is public when it happens; who ordered, and what it got,
//   is the agent's now and everyone's at the next dawn, as a trade was.
// Amounts come from N and the curves. Each test fails on its own before the rule exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger, ledgerProblems } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { priceOf, runOf } from '../rules/market.mjs';
import { N } from '../numbers.mjs';

const sum = xs => xs.reduce((t, x) => t + x, 0);
// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
// What each agent got (sells) or paid (shop) at tonight's clearing, by agent.
const filled = (g, type, night) => Object.fromEntries(g.events(type, e => e.night === night).map(e => [e.agent, e.cash]));
const permutations = xs => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));

// Astra's probe: two Smugglers run separate chems drops on night 1, so each holds a drop's units, and both sell them all
// to the city's buyer on day 2, in the order given.
function twoSell(order) {
  const g = new Game({ n: 2 });
  g.night({ a01: { kind: 'run', place: 'mall' }, a02: { kind: 'run', place: 'forest' } });
  const steps = g.s.market.buyer.chems;
  for (const id of order) ok(g, id, 'sell', { item: 'chems', units: N.dropUnits });
  return { g, steps };
}

test("Astra's two Smugglers: each sells a drop's chems to the city's buyer, and either order gives each the same, the curve's price for all of them split between the two, the odd dollar at most between them (§9)", () => {
  const got = [];
  for (const order of [['a01', 'a02'], ['a02', 'a01']]) {
    const { g, steps } = twoSell(order);
    g.night();
    const paid = filled(g, 'sell', 2);
    assert.equal(sum(Object.values(paid)), runOf('buyer', 'chems', steps, 2 * N.dropUnits), 'together they get the curve\'s price for every unit sold');
    assert.ok(Math.abs(paid.a01 - paid.a02) <= 1, `within a dollar: ${JSON.stringify(paid)}`);
    got.push(paid);
  }
  assert.deepEqual(got[0], got[1], 'the order they came in decides nothing');
});

test("the city's shop: two Chemists each order four chems, and either order pays each the same, the curve's price for all eight split between them (§9)", () => {
  const got = [];
  for (const order of [['a01', 'a02'], ['a02', 'a01']]) {
    const g = withTrades(['chemist', 'chemist', 'smuggler']);
    const steps = g.s.market.shop.chems;
    const max = runOf('shop', 'chems', steps, 8);
    for (const id of order) {
      g.grant(id, max);
      ok(g, id, 'shop', { item: 'chems', units: 4, max });
    }
    g.night();
    const paid = filled(g, 'shop', 1);
    assert.equal(sum(Object.values(paid)), runOf('shop', 'chems', steps, 8));
    assert.ok(Math.abs(paid.a01 - paid.a02) <= 1, JSON.stringify(paid));
    for (const id of order) assert.equal(g.s.agents[id].goods.chems, N.kits.chemist.chems + 4, `${id} has its four`);
    got.push(paid);
  }
  assert.deepEqual(got[0], got[1]);
});

test('each unit still moves the price, at the lock: by day the board holds still, the day\'s units move the curve when they fill, that move is public at once, and the curve eases back at the night\'s end (§9, §19)', () => {
  const { g, steps } = twoSell(['a01', 'a02']);
  const units = 2 * N.dropUnits;
  assert.equal(g.view(null, 'public').board.market.buyer.chems, priceOf('buyer', 'chems', steps), 'by day, the board holds still');
  assert.equal(g.events('price', e => e.side === 'buyer' && e.day === 2).length, 0, 'no move yet');
  const r = g.night();
  const moves = r.newEvents.filter(e => e.type === 'price' && e.side === 'buyer' && e.item === 'chems');
  assert.deepEqual(moves.map(e => [e.was, e.price, e.t, e.vis.to]), [
    [priceOf('buyer', 'chems', steps), priceOf('buyer', 'chems', steps + units), 2 * 2 + 1, 'all'],
    [priceOf('buyer', 'chems', steps + units), priceOf('buyer', 'chems', steps + units - N.marketEase), 2 * 2 + 1, 'all'],
  ], 'the fill moves it every unit, in public, and the night eases it back');
  assert.equal(g.s.market.buyer.chems, steps + units - N.marketEase);
});

test("a shop order names the most it pays, held until the lock; the day's orders fill by limit, highest first, and one under the day's price comes back whole while the rest fill without it; equal limits stand or fall together (§3, §9)", () => {
  const g = withTrades(['chemist', 'chemist', 'chemist', 'smuggler']);
  const steps = g.s.market.shop.chems;
  const [alone, pair, three] = [runOf('shop', 'chems', steps, 4), runOf('shop', 'chems', steps, 8), runOf('shop', 'chems', steps, 12)];
  const share = Math.ceil(pair / 2);
  assert.ok(alone < share && share * 3 < three, 'control: the curve makes a crowd dearer');
  for (const id of ['a01', 'a02', 'a03']) g.grant(id, share);
  const r = g.errand('a01', 'shop', { item: 'chems', units: 4, max: alone - 1 });
  assert.deepEqual([r.ok, r.events[0].kind], [false, 'not-yet'], 'a max under the price of its units alone is refused');
  assert.equal(g.errand('a01', 'shop', { item: 'chems', units: 4 }).ok, false, 'and an order with no max');
  assert.equal(g.errand('a01', 'shop', { item: 'chems', units: 4, max: share + 1 }).ok, false, 'a max over its cash');
  ok(g, 'a01', 'shop', { item: 'chems', units: 4, max: share });
  ok(g, 'a02', 'shop', { item: 'chems', units: 4, max: share });
  ok(g, 'a03', 'shop', { item: 'chems', units: 4, max: alone });
  for (const id of ['a01', 'a02']) assert.equal(g.s.agents[id].cash, 0, `${id}'s max is held`);
  assert.equal(g.s.agents.a03.cash, share - alone);
  g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  const paid = filled(g, 'shop', 1);
  assert.deepEqual(Object.keys(paid).sort(), ['a01', 'a02'], 'the two highest limits fill');
  assert.equal(sum(Object.values(paid)), pair, 'at the price of their eight units, without the third order\'s');
  assert.deepEqual(g.events('order', e => e.act === 'back').map(e => [e.agent, e.max]), [['a03', alone]], 'the third comes back whole');
  assert.equal(g.s.agents.a03.goods.chems, N.kits.chemist.chems, 'with no chems');
  // Equal limits a dollar a unit under what the two together make: neither fills, as a tie for the last copy on the list.
  const t = withTrades(['chemist', 'chemist', 'smuggler']);
  const under = pair / 2 - 1;
  for (const id of ['a01', 'a02']) {
    t.grant(id, under);
    ok(t, id, 'shop', { item: 'chems', units: 4, max: Math.floor(under) });
  }
  t.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' } });
  assert.deepEqual([t.events('shop').length, t.events('order', e => e.act === 'back').length], [0, 2], 'equal limits fall together');
});

test('same-day funding: a Chemist that orders chems by day cooks them tonight, an agent that sells by day pays dawn\'s rent from it, and a Dealer that sells some doses deals the rest; what an order brings comes at the lock (§5, §9, §10)', () => {
  const g = withTrades(['chemist', 'dealer', 'smuggler']);
  // The Chemist: a batch's chems in its kit, a second batch's on order.
  const max = runOf('shop', 'chems', g.s.market.shop.chems, N.cook.chems);
  g.grant('a01', max + N.rent);
  ok(g, 'a01', 'shop', { item: 'chems', units: N.cook.chems, max });
  assert.equal(g.s.agents.a01.goods.chems, N.kits.chemist.chems, 'by day the chems on order are not yet its own');
  assert.deepEqual(g.view('a01').me.orders.map(o => [o.side, o.item, o.units, o.max]), [['shop', 'chems', N.cook.chems, max]]);
  assert.ok(g.view('a01').legal.some(p => p.kind === 'cook' && p.batches === 2), 'yet the cook they make possible is on its menu');
  // The Smuggler: no cash, and just enough chems to cover the rent at the buyer's price.
  const units = Array.from({ length: 20 }, (_, i) => i + 1).find(u => runOf('buyer', 'chems', g.s.market.buyer.chems, u) >= N.rent);
  stock(g, 'a03', 'chems', units);
  ok(g, 'a03', 'sell', { item: 'chems', units });
  assert.equal(g.s.agents.a03.cash, 0, 'by day the sale has not paid yet');
  // The Dealer: one dose of its kit sold, the rest dealt.
  ok(g, 'a02', 'sell', { item: 'doses', units: 1 });
  assert.equal(g.s.agents.a02.goods.temp, N.kits.dealer.temp - 1);
  const corner = Object.keys(N.corners).sort().find(c => !N.corners[c].hot);
  const r = g.night({ a01: { kind: 'cook', place: 'suburbs', batches: 2 }, a02: { kind: 'deal', corner }, a03: { kind: 'laylow' } });
  assert.deepEqual(g.events('cook').map(e => [e.agent, e.batches, e.doses]), [['a01', 2, 2 * N.cook.doses]], 'the Chemist cooked both batches');
  assert.deepEqual(g.events('sale').map(e => [e.agent, e.doses]), [['a02', N.kits.dealer.temp - 1]], 'the Dealer dealt the rest');
  assert.deepEqual(r.newEvents.filter(e => e.type === 'evicted').map(e => e.agent), [], 'nobody was evicted');
  const sold = filled(g, 'sell', 1);
  assert.equal(g.s.agents.a03.cash, sold.a03 - N.rent, 'the Smuggler paid the rent from the sale');
  assert.equal(sold.a02, priceOf('buyer', 'doses', 0), 'the Dealer got its dose\'s price');
  assert.equal(g.events('invalid').length, 0);
});

test('what waits for the clearing: a sale\'s cash can\'t fund an errand the same day, and chems from the shop can\'t be handed over that day; both can the next (§9, §10)', () => {
  const g = withTrades(['smuggler', 'chemist', 'dealer']);
  stock(g, 'a01', 'chems', N.dropUnits);
  ok(g, 'a01', 'sell', { item: 'chems', units: N.dropUnits });
  const common = Object.values(g.s.traits).filter(t => t.tier === 'common' && t.opens <= 1).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  assert.ok(runOf('buyer', 'chems', 0, N.dropUnits) < common.price, 'control: a common costs more than the sale makes');
  const max = runOf('shop', 'chems', 0, 1);
  g.grant('a02', max);
  ok(g, 'a02', 'shop', { item: 'chems', units: 1, max });
  const give = g.errand('a02', 'give', { to: 'a03', goods: { chems: N.kits.chemist.chems + 1 } });
  assert.equal(give.ok, false, 'the chem on order is not yet in hand');
  assert.equal(g.errand('a01', 'pay', { to: 'a03', amount: 1 }).ok, false, "the sale's cash is not yet in hand");
  g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  ok(g, 'a02', 'give', { to: 'a03', goods: { chems: N.kits.chemist.chems + 1 } });
  ok(g, 'a01', 'pay', { to: 'a03', amount: 1 });
});

test("§19 unchanged: an order is its agent's now and everyone's at the next dawn, as a trade was; so is what it got; the price's move is everyone's at once, when the day's orders fill", () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'chems', 3);
  ok(g, 'a01', 'sell', { item: 'chems', units: 3 });
  const [order] = g.events('order', e => e.act === 'place');
  assert.deepEqual([order.agent, order.side, order.item, order.units, order.vis.to, order.vis.pub], ['a01', 'buyer', 'chems', 3, ['a01'], 2 * 1 + 2]);
  assert.ok(!g.view('a02').events.some(e => e.type === 'order'), "a02 doesn't see the order today");
  assert.ok(g.view('a01').events.some(e => e.type === 'order'), 'control: a01 does');
  g.night();
  const [fill] = g.events('sell');
  assert.deepEqual([fill.agent, fill.units, fill.t, fill.vis.to, fill.vis.pub], ['a01', 3, 2 * 1 + 1, ['a01'], 2 * 1 + 2], 'filled at the lock, everyone\'s at dawn');
  assert.ok(g.events('price', e => e.side === 'buyer' && e.t === 3).every(e => e.vis.to === 'all'));
  assert.ok(g.view('a02').events.some(e => e.type === 'order') && g.view('a02').events.some(e => e.type === 'sell'), 'day 2: a02 sees both');
});

test('no order of arrival decides anything: three sellers in every order get the same, and over two nights the odd dollar goes to each in turn, never to an id (§9, §23)', () => {
  const runs = permutations(['a01', 'a02', 'a03']).map(order => {
    const g = new Game({ n: 3 });
    order.forEach(id => stock(g, id, 'chems', Number(id.slice(1))));
    for (const id of order) ok(g, id, 'sell', { item: 'chems', units: Number(id.slice(1)) });
    g.night();
    return filled(g, 'sell', 1);
  });
  for (const r of runs) assert.deepEqual(r, runs[0], 'every order the same');
  assert.equal(sum(Object.values(runs[0])), runOf('buyer', 'chems', 0, 6));
  // Two sellers of one chem each, two nights running, a01 always first: the odd dollar goes to each once.
  const g = new Game({ n: 2 });
  const got = { a01: [], a02: [] };
  for (const night of [1, 2]) {
    for (const id of ['a01', 'a02']) {
      stock(g, id, 'chems', 1);
      ok(g, id, 'sell', { item: 'chems', units: 1 });
    }
    const steps = g.s.market.buyer.chems;
    g.night();
    const paid = filled(g, 'sell', night);
    assert.equal(paid.a01 + paid.a02, runOf('buyer', 'chems', steps, 2));
    for (const id of ['a01', 'a02']) got[id].push(paid[id]);
  }
  assert.ok(runOf('buyer', 'chems', 0, 2) % 2 === 1, 'control: an odd total, so someone gets the odd dollar');
  assert.deepEqual(sum(got.a01), sum(got.a02), `over two nights the same: ${JSON.stringify(got)}`);
});

test('the ledger holds the orders: the cash a shop order holds and the goods a sell order holds are the island\'s, and the check catches either going astray, or an order outliving its day (§23)', () => {
  const g = withTrades(['smuggler', 'chemist']);
  stock(g, 'a01', 'chems', 2);
  ok(g, 'a01', 'sell', { item: 'chems', units: 2 });
  const max = runOf('shop', 'chems', 0, 1);
  g.grant('a02', max);
  ok(g, 'a02', 'shop', { item: 'chems', units: 1, max });
  assert.deepEqual(ledgerProblems(g.s), []);
  const tamper = (fn, what) => {
    const s = structuredClone(g.s);
    fn(s);
    assert.ok(ledgerProblems(s).length > 0, what);
  };
  tamper(s => { s.orders.find(o => o.side === 'shop').cash += 1; }, 'held cash made from nothing');
  tamper(s => { s.orders.find(o => o.side === 'buyer').units += 1; }, 'held goods made from nothing');
  tamper(s => { s.orders.find(o => o.side === 'buyer').units = 0; }, 'an empty order');
  tamper(s => { s.orders[0].day -= 1; }, 'an order from yesterday');
  g.night();
  assert.deepEqual([g.s.orders, ledgerProblems(g.s)], [[], []], 'the lock leaves none');
});

test("on the last night the day's orders still fill before the ferry: a sale's cash boards, and its goods never do (§15)", () => {
  const g = new Game({ n: 2 });
  g.advanceTo(N.nights);
  stock(g, 'a01', 'chems', 2);
  ok(g, 'a01', 'sell', { item: 'chems', units: 2 });
  const steps = g.s.market.buyer.chems;
  g.night();
  const [fill] = g.events('sell');
  assert.deepEqual([fill.t, fill.cash], [2 * N.nights + 1, runOf('buyer', 'chems', steps, 2)], 'filled at the last lock');
  const mint = g.events('mint', e => e.agent === 'a01')[0];
  assert.ok(mint.cash >= fill.cash && !mint.goodsLeft, 'the cash went aboard, and no goods were left');
});
