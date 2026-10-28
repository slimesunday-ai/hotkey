// Goods and the city's markets (GAME.md §9, §10, §19; layer 2, "the street"). Goods are counts by kind, held by agents
// and crew stashes, and the ledger books them in and out at named sources and sinks, as it does cash (§23, §26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { ledgerProblems, checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const has = (v, secret) => JSON.stringify(v).includes(secret);

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
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
const everyView = g => [
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'agent')),
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];

test('starter kits: Chemist 2 chems, Dealer 4 doses, Gunrunner 2 parts, Smuggler and Cop nothing, booked in as kits (§9, §38)', () => {
  const g = withTrades(['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop']);
  assert.deepEqual(g.s.agents.a01.goods, {});
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2 });
  assert.deepEqual(g.s.agents.a03.goods, { temp: 4 });
  assert.deepEqual(g.s.agents.a04.goods, { parts: 2 });
  assert.deepEqual(g.s.agents.a05.goods, {});
  assert.deepEqual(g.s.goods.in.kit, { chems: 2, temp: 4, parts: 2 });
  assert.deepEqual(g.view('a02').me.goods, { chems: 2 }, 'the agent sees its own kit');
  assert.deepEqual(ledgerProblems(g.s), []);
});

test('hand over goods: what you hold, to anyone; the two of them see it now, everyone 24 hours later (§10, §19)', () => {
  const g = withTrades(['chemist', 'dealer', 'smuggler']);
  g.errand('a01', 'give', { to: 'a02', goods: { chems: 2 } });
  assert.deepEqual(g.s.agents.a01.goods, {});
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2, temp: 4 });
  const ev = g.events('give', e => e.from === 'a01');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].goods, { chems: 2 });
  assert.ok(g.view('a02').events.some(e => e.type === 'give' && e.goods), 'the receiver sees it now');
  assert.ok(!g.view('a03').events.some(e => e.type === 'give'), 'nobody else does yet');
  assert.equal(g.errand('a01', 'give', { to: 'a02', goods: { chems: 1 } }).ok, false, "you can't give what you don't hold");
  assert.equal(g.errand('a02', 'give', { to: 'a03', goods: { temp: 0 } }).ok, false, 'a count is a whole number above 0');
  assert.equal(g.errand('a02', 'give', { to: 'a03', goods: { temp: 1.5 } }).ok, false);
  assert.equal(g.errand('a02', 'give', { to: 'a03', goods: { gold: 1 } }).ok, false, 'not a kind of goods');
  assert.equal(g.errand('a02', 'give', { to: 'a03', goods: { temp: 1 }, cash: 5 }).ok, false, 'all or nothing: it has no cash, so the doses stay too');
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2, temp: 4 });
  g.night();
  assert.ok(g.view('a03').events.some(e => e.type === 'give' && e.goods && e.goods.chems === 2), 'everyone, 24 hours later');
});

test('the crew stash holds goods: put in, take out, a rug, and the last one out takes them (§12; GAP gap.goods)', () => {
  const g = withTrades(['chemist', 'dealer', 'smuggler']);
  g.errand('a01', 'crew_form', { name: 'c' });
  g.errand('a01', 'crew_invite', { agent: 'a02' });
  g.errand('a02', 'crew_join', { crew: 'c1' });
  g.errand('a01', 'stash_put', { goods: { chems: 2 } });
  assert.deepEqual(g.s.crews.c1.goods, { chems: 2 });
  assert.deepEqual(g.s.agents.a01.goods, {});
  assert.deepEqual(g.view('a02').me.crewStash.goods, { chems: 2 }, 'a member sees the stash');
  assert.ok(g.events('stash', e => e.act === 'put').some(e => e.goods && e.goods.chems === 2));
  assert.equal(g.errand('a02', 'stash_take', { goods: { chems: 3 } }).ok, false, 'not that many in the stash');
  g.errand('a02', 'stash_take', { goods: { chems: 1 } });
  assert.equal(g.events('betray').length, 0, 'one chem is still there: not a rug');
  g.errand('a02', 'stash_take', { goods: { chems: 1 } });
  const rug = g.events('betray', e => e.kind === 'rug');
  assert.equal(rug.length, 1, 'emptying the stash of goods another member put in is a rug');
  assert.deepEqual(rug[0].goods, { chems: 2 });
  assert.deepEqual(rug[0].victims, ['a01']);
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2, temp: 4 });

  g.errand('a02', 'stash_put', { goods: { temp: 4 } });
  g.errand('a01', 'crew_leave');
  g.errand('a02', 'crew_leave');
  assert.equal(g.s.crews.c1, undefined, 'the crew is gone');
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2, temp: 4 }, 'the last one out takes what was left');
  assert.deepEqual(ledgerProblems(g.s), []);
});

test('sit-down terms can name goods, as typed counts; anything else in them is dropped (§14, §18)', () => {
  const g = withTrades(['smuggler', 'chemist', 'cop']);
  g.errand('a01', 'ask', { to: 'a02' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 6 }, cash: 90 } });
  g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { 'CANARY-TERMS-KIND': 1 } } });
  const said = g.events('say', e => e.from === 'a01');
  assert.deepEqual(said[0].terms, { what: 'trade', cash: 90, goods: { parts: 6 } });
  assert.deepEqual(said[1].terms, { what: 'trade' }, 'an unknown kind is no goods at all');
  for (const v of everyView(g)) assert.ok(!has(v, 'CANARY-TERMS-KIND'), `${v.audience}: no unknown kind`);
});

test("the city's shop: each unit at its own price, all or nothing, the day's orders (R4-3) filling at the lock; the price's move is public when they fill, and who bought shows at the next dawn (§9, §10, §19)", () => {
  const g = withTrades(['smuggler', 'gunrunner', 'cop']);
  const quiet = { a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } };
  g.grant('a01', 200);
  assert.equal(g.errand('a01', 'shop', { item: 'chems', units: 4, max: 200 }).ok, true);
  assert.deepEqual([g.s.agents.a01.cash, g.s.agents.a01.goods], [0, {}], 'its max is held, and the chems come at the lock');
  g.grant('a02', 100);
  assert.equal(g.errand('a02', 'shop', { item: 'guns', max: 100 }).ok, false, 'a gun is $200');
  assert.equal(g.errand('a02', 'shop', { item: 'doses', max: 100 }).ok, false, "the shop doesn't sell doses");
  assert.equal(g.errand('a02', 'shop', { item: 'chems', units: 0, max: 100 }).ok, false);
  assert.equal(g.errand('a02', 'shop', { item: 'chems', units: 3, max: 100 }).ok, true, '3 chems alone are $87');
  const r = g.night(quiet);
  const bought = g.events('shop', e => e.agent === 'a01');
  assert.deepEqual(bought.map(e => [e.units, e.cash]), [[4, 125]], '§9: 4 chems cost $125');
  assert.deepEqual(g.s.agents.a01.goods, { chems: 4 });
  assert.deepEqual(g.s.goods.in.shop, { chems: 4 }, 'goods in through the shop');
  assert.equal(g.s.money.out.shop, 125, 'cash out to the shop');
  assert.deepEqual(g.events('order', e => e.act === 'back').map(e => [e.agent, e.units]), [['a02', 3]], 'with a01\'s four the day\'s 7 cost $277, $39.57 a unit, over a02\'s $33.33: nothing, not 2 of 3');
  assert.deepEqual(g.s.agents.a02.goods, { parts: 2 });
  const move = r.newEvents.find(e => e.type === 'price' && e.side === 'shop' && e.item === 'chems');
  assert.deepEqual([move.was, move.price, move.vis.to], [25, 44, 'all'], 'the next chem costs 25 × 1.15⁴ = $43.73, so $44, for everyone, public at once; a02\'s order moved nothing');
  assert.deepEqual([bought[0].vis.to, bought[0].vis.pub], [['a01'], g.s.clock], "who bought: a01's own until the next dawn");
  assert.ok(g.view('a03').events.some(e => e.type === 'shop' && e.agent === 'a01'), 'everyone, at the next dawn');
  const cash = g.s.agents.a02.cash;
  assert.equal(g.errand('a02', 'shop', { item: 'chems', max: 33 }).ok, true);
  g.night(quiet);
  assert.equal(g.events('shop', e => e.agent === 'a02')[0].cash, 33, 'one chem at $33 the next day: the price was still up for everyone, eased two steps');
  assert.equal(g.s.agents.a02.cash, cash - 33 - N.rent);
  assert.deepEqual(ledgerProblems(g.s), []);
});

test("the city's buyer: it pays along its curve, at the lock (R4-3), and only for what you hold (§9)", () => {
  const g = withTrades(['dealer', 'smuggler']);
  g.errand('a01', 'sell', { item: 'doses', units: 4 });
  assert.deepEqual([g.s.agents.a01.cash, g.s.agents.a01.goods], [0, {}], 'the doses go with the order, the cash comes at the lock');
  assert.equal(g.errand('a01', 'sell', { item: 'doses' }).ok, false, 'none left to sell');
  assert.equal(g.errand('a02', 'sell', { item: 'guns' }).ok, false, "the buyer doesn't buy guns");
  const r = g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' } });
  assert.deepEqual(g.s.goods.out.buyer, { temp: 4 }, 'goods out to the buyer');
  assert.equal(g.s.money.in.buyer, 34, 'cash in from the buyer');
  assert.ok(g.events('sell', e => e.agent === 'a01' && e.cash === 34 && e.units === 4).length === 1, '$10 + $9 + $8 + $7');
  assert.ok(r.newEvents.some(e => e.type === 'price' && e.side === 'buyer' && e.item === 'doses' && e.was === 10 && e.price === 7), 'the next dose fetches 10 × 0.9⁴ = $6.56, so $7');
  assert.deepEqual(ledgerProblems(g.s), []);
});

test('the shop eases back and the buyer recovers two steps a night (§9, §38), in public', () => {
  const g = withTrades(['dealer', 'smuggler']);
  g.grant('a02', 200);
  g.errand('a02', 'shop', { item: 'chems', units: 3, max: 200 });
  g.errand('a01', 'sell', { item: 'doses', units: 3 });
  assert.deepEqual([g.s.market.shop.chems, g.s.market.buyer.doses], [0, 0], 'R4-3: the day\'s orders move the curves at the lock');
  const r = g.night();
  assert.equal(g.s.market.shop.chems, 1);
  assert.equal(g.s.market.buyer.doses, 1);
  const moves = r.newEvents.filter(e => e.type === 'price' && e.side);
  assert.ok(moves.some(e => e.side === 'shop' && e.item === 'chems' && e.was === 38 && e.price === 29), 'the shop: $38 back to $29');
  assert.ok(moves.some(e => e.side === 'buyer' && e.item === 'doses' && e.was === 7 && e.price === 9), 'the buyer: $7 back up to $9');
  assert.ok(moves.every(e => e.vis.to === 'all'), 'price moves are public');
  g.night();
  assert.equal(g.s.market.shop.chems, 0);
  assert.equal(g.s.market.buyer.doses, 0);
  assert.equal(g.view(null, 'public').board.market.shop.chems, 25);
});

test("goods in the 24-hour record: the owner's holdings now, everyone's 24 hours later (§19)", () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'parts', 98765);
  g.errand('a01', 'crew_form', { name: 'c' });
  g.errand('a01', 'stash_put', { goods: { parts: 5 } });
  assert.ok(has(g.view('a01'), '98760'), 'positive control: the owner sees its own goods');
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!has(v, '98760'), `${v.audience}: nobody else, live`);
  }
  g.night();
  const h = g.events('holdings', e => e.agent === 'a01')[0];
  assert.deepEqual(h.goods, { chems: 2, parts: 98760 });
  assert.deepEqual(h.crew.goods, { parts: 5 }, "the crew stash is on its keeper's record");
  for (const v of [g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(!has(v, '98760'), `${v.audience}: not before 24 hours`);
  g.night();
  for (const v of [g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(v.events.some(e => e.type === 'holdings' && e.agent === 'a01' && e.goods.parts === 98760), `${v.audience}: 24 hours later`);
  }
});

test('goods never board: whatever anyone holds when the ferry leaves is gone, and the record says so (§15; GAP gap.goodsGone)', () => {
  const g = withTrades(['chemist', 'dealer', 'gunrunner']);
  g.errand('a01', 'crew_form', { name: 'c' });
  g.errand('a01', 'stash_put', { goods: { chems: 1 } });
  g.advanceTo(14);
  const r = g.night();
  assert.ok(g.s.over);
  for (const id of ['a01', 'a02', 'a03']) assert.deepEqual(g.s.agents[id].goods, {}, `${id} holds nothing after the ferry`);
  assert.deepEqual(g.s.crews.c1.goods, {});
  assert.deepEqual(g.s.goods.out.gone, { chems: 2, temp: 4, parts: 2 }, 'everything the kits brought is gone');
  const mint = id => r.newEvents.find(e => e.type === 'mint' && e.agent === id);
  assert.deepEqual(mint('a01').goodsLeft, { chems: 1 });
  assert.deepEqual(mint('a02').goodsLeft, { temp: 4 });
  assert.ok(r.newEvents.some(e => e.type === 'gone' && e.from === 'crew:c1' && e.goods && e.goods.chems === 1), "the crew stash's goods stay behind");
  assert.deepEqual(ledgerProblems(g.s), []);
});

test('the ledger catches goods made from nothing, goods lost, a negative count, an unknown kind and a bad market step (§23)', () => {
  const clean = withTrades(['chemist', 'smuggler']);
  assert.deepEqual(ledgerProblems(clean.s), [], 'positive control: a clean state has no problems');
  const plant = fn => {
    const s = structuredClone(clean.s);
    fn(s);
    return ledgerProblems(s);
  };
  assert.ok(plant(s => { s.agents.a01.goods.chems += 1; }).some(p => /^goods:/.test(p)), 'goods made from nothing');
  assert.ok(plant(s => { delete s.agents.a01.goods.chems; }).some(p => /^goods:/.test(p)), 'goods lost');
  assert.ok(plant(s => { s.agents.a02.goods.chems = -2; s.agents.a01.goods.chems = 4; }).some(p => /a02 holds -2 chems/.test(p)), 'a negative count');
  assert.ok(plant(s => { s.agents.a02.goods.gold = 1; }).some(p => /a02 holds 1 gold/.test(p)), 'an unknown kind');
  assert.ok(plant(s => { s.market.shop.chems = -1; }).some(p => /market/.test(p)), 'a market step below 0');
  assert.equal(JSON.stringify(ledgerProblems(clean.s)), '[]', 'planting never touched the clean state');
});

test("an errand's goods and items are typed: a canary in one never reaches any view (§18, §23)", () => {
  const g = withTrades(['dealer', 'chemist', 'smuggler']);
  g.grant('a01', 100);
  g.errand('a01', 'give', { to: 'a02', goods: { 'CANARY-GIVE-KIND': 1 } });
  g.errand('a01', 'give', { to: 'a02', goods: 'CANARY-GIVE-STRING' });
  g.errand('a01', 'shop', { item: 'CANARY-SHOP-ITEM' });
  g.errand('a01', 'sell', { item: 'CANARY-SELL-ITEM', units: 1 });
  g.errand('a01', 'shop', { item: 'chems', units: 'CANARY-UNITS' });
  g.errand('a01', 'crew_form', { name: 'plain' });
  g.errand('a01', 'stash_put', { goods: { 'CANARY-STASH-KIND': 2 } });
  g.errand('a01', 'give', { to: 'a02', goods: { temp: 1 } });
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2, temp: 1 }, 'positive control: a good hand-over went through');
  assert.ok(g.view('a01').events.filter(e => e.type === 'invalid').length >= 6, 'the bad errands are typed and logged');
  const canaries = ['CANARY-GIVE-KIND', 'CANARY-GIVE-STRING', 'CANARY-SHOP-ITEM', 'CANARY-SELL-ITEM', 'CANARY-UNITS', 'CANARY-STASH-KIND'];
  const nowhere = when => {
    for (const v of everyView(g)) for (const c of canaries) assert.ok(!has(v, c), `${when}: ${c} in a ${v.audience} view`);
  };
  nowhere('live');
  g.night();
  g.night();
  nowhere('two days later');
});
