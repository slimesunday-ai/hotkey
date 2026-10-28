// 2026-10-27: re-pin bot reason prose for slime's call, "the first 2 we should do" (rent is now compute); plays and rules unchanged.
// R10b, standing orders for trade (docs/briefs/R10b-trade-orders.md; slime, 10-20: "Standing orders for trade. The model
// sets its terms, for example "buy up to 6 doses at $15 or less, pay on delivery, sell to anyone who orders." The game
// then carries them out every round, using the code the bots already use"). GAME.md §17, §33.
// - The new kinds (rules/memory.mjs): buy (an item the seat's trade buys, units a day, max a unit), sell (an item it
//   sells, min a unit) and pay; one order a kind and item; no Cop has any.
// - The routine (agents/orders.mjs tradeOrders, bench/bots.mjs tradeRoutine) runs the canny trade bot's own trade, held
//   to the orders, in the sit-downs the seat hasn't spoken in itself, from its own view; its errands go through the
//   rules with origin 'orders'; its memory rides in the runner's checkpoint.
// - The owner's preset (runner.mjs --orders-baseline) and the outcomes the change must leave alone.
// Nothing calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { checkMemory, orderLimit } from '../rules/memory.mjs';
import { addGoods, bookGoods, clone } from '../rules/state.mjs';
import { tradeOrders, runTradeOrders } from '../agents/orders.mjs';
import { briefingPacket } from '../agents/briefing.mjs';
import * as briefingMod from '../agents/briefing.mjs';
import { STREET } from '../bench/bots.mjs';
import { rng, shuffle } from '../rng.mjs';
import { N } from '../numbers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r10b-orders-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const cli = args => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const checkpoint = dir => JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));

// --- a small world: the seats named by trade, in id order --------------------------------------------------------------
function world(trades) {
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents: trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
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
// The seat's cast entry, as the canny cast deals a trade bot's.
const seatCfg = (id, trade) => ({ id, name: id, trade, type: trade, fav: 'industrial', route: 'downtown', layer: 2, every: true, canny: true, sharp: true, drugs: true, score: true });
// One round of the seat's trade orders, as the runner plays it (runner.mjs tradeRound): its own view, each errand
// through the rules with origin 'orders', and the results back to the routine's memory. Returns the errands sent.
function routine(g, id, trade, memo, round = 1) {
  const sent = [];
  const apply = e => {
    sent.push(e);
    const r = applyErrand(g.s, { ...e, by: id }, { origin: 'orders' });
    g.s = r.state;
    g.log.push(...r.events);
    checkLedger(g.s, `${id} orders ${e.kind}`);
    return r;
  };
  runTradeOrders(g.view(id), { seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'orders', id, g.s.day, round) }, seatCfg(id, trade), memo, apply);
  return sent;
}
const setOrders = (g, id, orders) => ok(g, id, 'orders', { orders });
const sitdownWith = (g, a, b) => g.view(a).me.sitdowns.find(sd => sd.with === b);

// --- 1. the new kinds ---------------------------------------------------------------------------------------------------
test('trade orders: buy, sell and pay, typed and checked in rules/memory.mjs, one a kind and item, none for a Cop or for an item the trade doesn\'t use', () => {
  const g = world(['dealer', 'chemist', 'smuggler', 'gunrunner', 'cop']);
  const check = (id, orders) => checkMemory(g.s, { by: id, kind: 'orders', orders });
  const good = [
    ['a01', [{ kind: 'buy', item: 'doses', units: 6, max: 15 }, { kind: 'pay' }]],
    ['a02', [{ kind: 'buy', item: 'chems', units: 4, max: 15 }, { kind: 'sell', item: 'doses', min: 15 }, { kind: 'pay' }]],
    ['a03', [{ kind: 'sell', item: 'chems', min: 15 }, { kind: 'sell', item: 'parts', min: 20 }, { kind: 'pay' }]],
    ['a04', [{ kind: 'buy', item: 'parts', units: 4, max: 15 }, { kind: 'pay' }]],
    // with the five night kinds: eight in all
    ['a02', [{ kind: 'retaliate' }, { kind: 'laylow', stars: 3 }, { kind: 'protect_grail' }, { kind: 'back', agent: 'a01' }, { kind: 'avoid_lawless' },
      { kind: 'buy', item: 'chems', units: 4, max: 15 }, { kind: 'sell', item: 'doses', min: 15 }, { kind: 'pay' }]],
  ];
  for (const [id, orders] of good) assert.equal(check(id, orders).ok, true, `${id} ${JSON.stringify(orders)}: ${check(id, orders).why}`);
  assert.equal(orderLimit(), 8);
  const bad = [
    ['a01', [{ kind: 'sell', item: 'doses', min: 15 }], /dealer sells no goods/],
    ['a02', [{ kind: 'buy', item: 'doses', units: 6, max: 15 }], /chemist buys chems/],
    ['a03', [{ kind: 'buy', item: 'chems', units: 6, max: 15 }], /smuggler buys no goods/],
    ['a04', [{ kind: 'sell', item: 'lockpicks', min: 15 }], /gunrunner sells no goods/],
    ['a04', [{ kind: 'sell', item: 'parts', min: 15 }], /gunrunner sells no goods/],
    ['a04', [{ kind: 'sell', item: 'guns', min: 100 }], /trade orders sell goods only \(chems, parts, doses\): a gun is sold by the seat itself/],
    ['a05', [{ kind: 'pay' }], /Cop has no trade orders/],
    ['a05', [{ kind: 'buy', item: 'doses', units: 1, max: 15 }], /Cop has no trade orders/],
    ['a01', [{ kind: 'buy', item: 'doses', units: 0, max: 15 }], /units/],
    ['a01', [{ kind: 'buy', item: 'doses', units: 2.5, max: 15 }], /units/],
    ['a01', [{ kind: 'buy', item: 'doses', units: 6 }], /max/],
    ['a01', [{ kind: 'buy', item: 'doses', units: 6, max: 0 }], /max/],
    ['a01', [{ kind: 'buy', item: 'doses', units: 6, max: '15' }], /max/],
    ['a02', [{ kind: 'sell', item: 'doses', min: -1 }], /min/],
    ['a02', [{ kind: 'sell', item: 'doses', min: 15, units: 3 }], /only its listed fields/],
    ['a01', [{ kind: 'pay', item: 'doses' }], /only its listed fields/],
    ['a01', [{ kind: 'buy', item: 'doses', units: 6, max: 15 }, { kind: 'buy', item: 'doses', units: 2, max: 20 }], /one trade order of each kind and item/],
    ['a01', [{ kind: 'pay' }, { kind: 'pay' }], /one standing order of each kind/],
    ['a01', [{ kind: 'barter' }], /a kind from the list/],
    ['a02', Array.from({ length: 9 }, () => ({ kind: 'pay' })), /up to 8 standing orders/],
  ];
  for (const [id, orders, why] of bad) {
    const c = check(id, orders);
    assert.equal(c.ok, false, `${id} ${JSON.stringify(orders)} is refused`);
    assert.match(c.why, why, JSON.stringify(orders));
  }
  // Through the errand, as a model's `orders` replaces the list; what's stored is the typed order.
  setOrders(g, 'a01', [{ kind: 'buy', item: 'doses', units: 6, max: 15 }, { kind: 'pay' }, { kind: 'laylow', stars: 3 }]);
  assert.deepEqual(g.view('a01').me.memory.orders, [{ kind: 'buy', item: 'doses', units: 6, max: 15 }, { kind: 'pay' }, { kind: 'laylow', stars: 3 }]);
  const refused = g.errand('a02', 'orders', { orders: [{ kind: 'buy', item: 'doses', units: 6, max: 15 }] });
  assert.equal(refused.ok, false);
  assert.deepEqual(g.view('a02').me.memory.orders, [], 'a refused list changes nothing');
});

// --- 2. a buy order ---------------------------------------------------------------------------------------------------
// A Dealer seat (a01) with $200 and a buy order; a Chemist (a02), played by hand, stocked and asking it.
function dealerAsked(orders) {
  const g = world(['dealer', 'chemist']);
  g.grant('a01', 200);
  stock(g, 'a02', 'temp', 10);
  if (orders) setOrders(g, 'a01', orders);
  ok(g, 'a02', 'ask', { to: 'a01', line: 'Selling up to 7 doses at $15 each; order and I hand them over, you pay on delivery.' });
  return g;
}
test('a buy order: a seller\'s ask gets a typed order within the day\'s count and the price, and with a pay order the goods are paid for on delivery', () => {
  const g = dealerAsked([{ kind: 'buy', item: 'doses', units: 2, max: 15 }, { kind: 'pay' }]);
  const memo = {};
  // What its trade's bot would order: a held corner's doses, less the dealer's kit; the order caps it at 2.
  assert.ok(N.deal.held - (g.view('a01').me.goods.temp || 0) > 2, 'control: the bot wants more than the order allows');
  const sent = routine(g, 'a01', 'dealer', memo, 1);
  const sd = sitdownWith(g, 'a01', 'a02');
  assert.deepEqual(sent.filter(e => e.sitdown === sd.id), [
    { kind: 'answer', sitdown: sd.id, accept: true },
    { kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: 'buy', goods: { temp: 2 }, cash: 2 * STREET.unit } },
  ], 'it takes the ask and orders 2 doses, the order\'s units a day, at $15 a unit');
  assert.equal(sd.state, 'open');
  // A second round the same day orders no more: the day's count is spent.
  const again = routine(g, 'a01', 'dealer', memo, 2);
  assert.equal(again.filter(e => e.kind === 'say' || e.kind === 'ask').length, 0, 'no more orders today');
  // The seller hands the doses over; the routine pays on delivery, its rent kept back.
  ok(g, 'a02', 'give', { to: 'a01', goods: { temp: 2 }, sitdown: sd.id });
  const cash = g.s.agents['a01'].cash;
  const pays = routine(g, 'a01', 'dealer', memo, 3).filter(e => e.kind === 'pay');
  assert.deepEqual(pays.map(({ kind, to, amount }) => ({ kind, to, amount })), [{ kind: 'pay', to: 'a02', amount: 2 * STREET.unit }]);
  assert.equal(g.s.agents['a01'].cash, cash - 2 * STREET.unit);
  assert.ok(g.view('a01').me.dealt.some(d => d.with === 'a02'), 'the deal settled');
});

test('a buy order: with none, or with a max under the seller\'s price, nothing is ordered; without a pay order the goods aren\'t paid for', () => {
  for (const [why, orders] of [['no trade orders', null], ['only a pay order', [{ kind: 'pay' }]], ['a max under $15', [{ kind: 'buy', item: 'doses', units: 6, max: STREET.unit - 1 }, { kind: 'pay' }]], ['night orders only', [{ kind: 'laylow', stars: 3 }, { kind: 'avoid_lawless' }]]]) {
    const g = dealerAsked(orders);
    const sent = routine(g, 'a01', 'dealer', {}, 1);
    assert.deepEqual(sent.filter(e => ['answer', 'say', 'ask'].includes(e.kind)), [], why);
    assert.equal(sitdownWith(g, 'a01', 'a02').state, 'asked', `${why}: the ask is left for the seat`);
  }
  const g = dealerAsked([{ kind: 'buy', item: 'doses', units: 6, max: 20 }]);
  const memo = {};
  routine(g, 'a01', 'dealer', memo, 1);
  const sd = sitdownWith(g, 'a01', 'a02');
  const order = sd.said.find(m => m.from === 'a01' && m.say === 'offer');
  const want = Math.min(6, N.deal.held - (g.view('a01').me.goods.temp || 0));
  assert.deepEqual(order.terms, { what: 'trade', goods: { temp: want }, cash: want * STREET.unit }, 'a max over $15 still buys at $15, what the bot wants');
  ok(g, 'a02', 'give', { to: 'a01', goods: { temp: want }, sitdown: sd.id });
  const sent = routine(g, 'a01', 'dealer', memo, 2);
  assert.equal(sent.filter(e => e.kind === 'pay').length, 0, 'no pay order: the debt stands for the seat to pay');
  assert.ok(g.view('a01').me.deals.some(d => d.with === 'a02' && d.owes === 'me'));
});

// --- 3. a sell order --------------------------------------------------------------------------------------------------
// A Chemist seat (a01) holding 10 doses with a sell order; a Dealer (a02), played by hand, asks it and orders.
function chemistAsked(min) {
  const g = world(['chemist', 'dealer']);
  g.grant('a01', 100);
  g.grant('a02', 300);
  stock(g, 'a01', 'temp', 10);
  setOrders(g, 'a01', [{ kind: 'sell', item: 'doses', min }]);
  ok(g, 'a02', 'ask', { to: 'a01', line: 'Buying up to 7 doses at $15 each; I pay as they\'re handed over.' });
  return g;
}
test('a sell order: a buyer\'s typed order at or above the price gets the goods; one below it doesn\'t', () => {
  for (const [cash, gets] of [[3 * STREET.unit, true], [3 * STREET.unit + 6, true], [3 * STREET.unit - 1, false]]) {
    const g = chemistAsked(STREET.unit);
    const memo = {};
    const first = routine(g, 'a01', 'chemist', memo, 1);
    const sd = sitdownWith(g, 'a01', 'a02');
    assert.deepEqual(first.filter(e => e.sitdown === sd.id).map(e => e.kind), ['answer', 'say'], 'it takes the ask and states its offer');
    assert.deepEqual(sd.said.find(m => m.from === 'a01').terms, { what: 'sell', goods: { temp: N.deal.held }, cash: N.deal.held * STREET.unit });
    ok(g, 'a02', 'say', { sitdown: sd.id, say: 'offer', terms: { what: 'trade', goods: { temp: 3 }, cash } });
    const before = g.s.agents['a02'].goods.temp || 0;
    const next = routine(g, 'a01', 'chemist', memo, 2);
    const gave = next.filter(e => e.kind === 'give');
    if (gets) {
      assert.deepEqual(gave.map(e => e.goods), [{ temp: 3 }], `an order of $${cash} for 3 gets them`);
      assert.equal(g.s.agents['a02'].goods.temp, before + 3);
    } else {
      assert.deepEqual(gave, [], `an order of $${cash} for 3 gets nothing`);
      assert.equal(g.s.agents['a02'].goods.temp || 0, before);
    }
  }
});

test('a sell order whose min is over the price the routine trades at sells nothing; a sell order on chems leaves a doses order alone', () => {
  const g = chemistAsked(STREET.unit + 1);
  const sent = routine(g, 'a01', 'chemist', {}, 1);
  assert.deepEqual(sent, [], 'its min is past $15: the ask is left for the seat');
  const h = world(['smuggler', 'gunrunner', 'chemist']);
  stock(h, 'a01', 'chems', 8);
  stock(h, 'a01', 'parts', 8);
  setOrders(h, 'a01', [{ kind: 'sell', item: 'chems', min: STREET.unit }]);
  ok(h, 'a02', 'ask', { to: 'a01', line: 'parts?' });
  ok(h, 'a03', 'ask', { to: 'a01', line: 'chems?' });
  const out = routine(h, 'a01', 'smuggler', {}, 1);
  assert.ok(!out.some(e => e.sitdown === sitdownWith(h, 'a01', 'a02').id), 'the Gunrunner\'s ask (parts) is left alone');
  assert.ok(out.some(e => e.sitdown === sitdownWith(h, 'a01', 'a03').id && e.kind === 'answer' && e.accept), 'the Chemist\'s (chems) is taken');
});

// --- 4. a pay order ---------------------------------------------------------------------------------------------------
// The seat (a01, a Dealer) owes a02 $45 on an agreed deal the seat made itself; a pay order pays it, the rent kept back.
function owing(cash) {
  const g = world(['dealer', 'chemist']);
  stock(g, 'a02', 'temp', 3);
  ok(g, 'a02', 'ask', { to: 'a01' });
  const sd = sitdownWith(g, 'a01', 'a02');
  ok(g, 'a01', 'answer', { sitdown: sd.id, accept: true });
  ok(g, 'a01', 'say', { sitdown: sd.id, say: 'offer', terms: { what: 'trade', goods: { temp: 3 }, cash: 45 } });
  ok(g, 'a02', 'give', { to: 'a01', goods: { temp: 3 }, sitdown: sd.id });
  g.grant('a01', cash - g.s.agents['a01'].cash);
  setOrders(g, 'a01', [{ kind: 'pay' }]);
  return g;
}
test('a pay order: pays what the seat owes on agreed deals for goods, its own deals too, with the rent kept back', () => {
  const g = owing(45 + N.rent);
  const sent = routine(g, 'a01', 'dealer', {}, 1);
  assert.deepEqual(sent.map(({ kind, to, amount, for: f }) => ({ kind, to, amount, for: f })), [{ kind: 'pay', to: 'a02', amount: 45, for: 'debt' }]);
  assert.equal(g.s.agents['a01'].cash, N.rent, 'the rent is still there for dawn');
  assert.ok(!g.view('a01').me.deals.some(d => d.owes === 'me' && d.due > d.paid));
  const short = owing(45 + N.rent - 1);
  assert.deepEqual(routine(short, 'a01', 'dealer', {}, 1), [], 'one dollar short once the rent is kept back: it waits');
  // The seat's own words in that sit-down don't stop a pay: what it owes is on the deal record, not in the sit-down.
});

// --- 5. a sit-down the seat has spoken in ------------------------------------------------------------------------------
test('a sit-down where the seat has spoken itself is left alone: its own answer, its own ask, or its own words after the routine\'s', () => {
  // The seat took the seller's ask itself: the routine orders nothing there.
  const g = dealerAsked([{ kind: 'buy', item: 'doses', units: 6, max: 15 }, { kind: 'pay' }]);
  const sd = sitdownWith(g, 'a01', 'a02');
  ok(g, 'a01', 'answer', { sitdown: sd.id, accept: true });
  const sent = routine(g, 'a01', 'dealer', {}, 1);
  assert.deepEqual(sent.filter(e => e.sitdown === sd.id), []);
  // The seat asked a seller itself: the routine leaves that sit-down too, even once the seller has taken it.
  const h = world(['dealer', 'chemist']);
  h.grant('a01', 200);
  stock(h, 'a02', 'temp', 10);
  setOrders(h, 'a01', [{ kind: 'buy', item: 'doses', units: 6, max: 15 }]);
  ok(h, 'a01', 'ask', { to: 'a02', line: 'doses?' });
  const hs = sitdownWith(h, 'a01', 'a02');
  ok(h, 'a02', 'answer', { sitdown: hs.id, accept: true });
  ok(h, 'a02', 'say', { sitdown: hs.id, say: 'offer', terms: { what: 'sell', goods: { temp: 7 }, cash: 105 } });
  assert.deepEqual(routine(h, 'a01', 'dealer', {}, 1).filter(e => e.sitdown === hs.id), []);
  // The routine took an ask and ordered; then the seat said something there itself: from then on the routine is out.
  const k = dealerAsked([{ kind: 'buy', item: 'doses', units: 3, max: 15 }, { kind: 'pay' }]);
  const memo = {};
  routine(k, 'a01', 'dealer', memo, 1);
  const ks = sitdownWith(k, 'a01', 'a02');
  ok(k, 'a01', 'say', { sitdown: ks.id, say: 'answer', line: 'Actually, let me think.' });
  ok(k, 'a02', 'give', { to: 'a01', goods: { temp: 3 }, sitdown: ks.id });
  ok(k, 'a02', 'say', { sitdown: ks.id, say: 'offer', terms: { what: 'sell', goods: { temp: 2 }, cash: 30 } });
  const later = routine(k, 'a01', 'dealer', memo, 2);
  assert.deepEqual(later.filter(e => e.sitdown === ks.id && e.kind !== 'pay'), [], 'no word or close of its own there');
});

// --- 6. no hidden state -------------------------------------------------------------------------------------------------
test('no hidden state: what the seat can\'t see (a rival\'s cash and goods, a sit-down between others) changes none of the routine\'s errands', () => {
  const g = world(['dealer', 'chemist', 'chemist', 'smuggler']);
  g.grant('a01', 200);
  stock(g, 'a02', 'temp', 10);
  stock(g, 'a03', 'temp', 4);
  setOrders(g, 'a01', [{ kind: 'buy', item: 'doses', units: 7, max: 15 }, { kind: 'pay' }]);
  ok(g, 'a02', 'ask', { to: 'a01', line: 'doses' });
  const a = { s: clone(g.s), log: clone(g.log) };
  const b = { s: clone(g.s), log: clone(g.log) };
  // Hidden from a01: a03's cash and goods now, and a sit-down between a03 and a04 (its words for 24 hours).
  b.s.agents['a03'].cash += 500;
  b.s.money.in.test = (b.s.money.in.test || 0) + 500;
  addGoods(b.s.agents['a03'], 'temp', 9);
  bookGoods(b.s, 'in', 'test', 'temp', 9);
  const x = applyErrand(b.s, { by: 'a03', kind: 'ask', to: 'a04', line: 'chems?' });
  b.s = x.state;
  b.log.push(...x.events);
  checkLedger(b.s, 'hidden');
  const run = w => {
    const sent = [];
    tradeOrders(viewFor(w.s, w.log, 'a01', 'agent'), { seed: 404, day: w.s.day, round: 1, rounds: 3, rng: rng(404, 'orders', 'a01', w.s.day, 1) }, seatCfg('a01', 'dealer'), {}).forEach(e => sent.push(e));
    return sent;
  };
  assert.notDeepEqual(viewFor(a.s, a.log, 'a03', 'agent').me.cash, viewFor(b.s, b.log, 'a03', 'agent').me.cash, 'control: the states differ');
  assert.deepEqual(viewFor(a.s, a.log, 'a01', 'agent'), viewFor(b.s, b.log, 'a01', 'agent'), 'control: a01 sees the same');
  assert.ok(run(a).length > 0, 'control: the routine acts');
  assert.deepEqual(run(a), run(b));
});

// --- 7. origin ----------------------------------------------------------------------------------------------------------
test('origin: each errand the routine sends goes on the record with origin "orders" (the seat\'s own until it goes public), and its line says what they did since the last call', () => {
  const g = dealerAsked([{ kind: 'buy', item: 'doses', units: 3, max: 15 }, { kind: 'pay' }]);
  const n0 = g.log.length;
  const sent = routine(g, 'a01', 'dealer', {}, 1);
  const marks = g.log.slice(n0).filter(e => e.type === 'orders');
  assert.equal(marks.length, sent.length, 'one record an errand');
  for (const [i, m] of marks.entries()) {
    assert.equal(m.origin, 'orders');
    assert.equal(m.agent, 'a01');
    assert.equal(m.errand, sent[i].kind);
    assert.equal(m.ok, true);
    assert.deepEqual(m.vis.to, ['a01'], 'the seat\'s own record until it goes public');
    assert.ok(m.of.length > 0 && m.of.every(n => g.log.some(e => e.n === n && e.type !== 'orders')), 'it names the errand\'s own events');
  }
  const say = g.log.find(e => e.n === marks.find(m => m.errand === 'say').of[0]);
  assert.equal(say.type, 'say');
  assert.ok(!g.view('a02').events.some(e => e.type === 'orders'), 'the other side doesn\'t see it live');
  // An errand the model sends itself carries no such record.
  const n1 = g.log.length;
  ok(g, 'a01', 'outloud', { say: 'boast', line: 'hi' });
  assert.ok(!g.log.slice(n1).some(e => e.type === 'orders'));
  // The seat's briefing: its trade orders as they stand, and what they did since its last call.
  const brief = since => briefingPacket({ view: g.view('a01'), menu: [] }, { since }).messages[1].content;
  const text = brief(n0 - 1);
  assert.match(text, /Your trade orders, carried out by the game every round of the day: buy doses, up to 3 a day at \$15 or less a unit; pay what you owe on agreed deals for goods\./);
  assert.match(text, /Since your last call your trade orders took s\d+; offer to a02 in s\d+ \(buy \$45 3 temp\)\./);
  assert.doesNotMatch(brief(g.log.at(-1).n), /Since your last call/, 'nothing new since the last call: no second line');
  // No trade orders: the line says so; a Cop has none and no line.
  const h = world(['chemist', 'cop']);
  assert.match(briefingPacket({ view: h.view('a01'), menu: [] }).messages[1].content, /Your trade orders, carried out by the game every round of the day: none\./);
  assert.doesNotMatch(briefingPacket({ view: h.view('a02'), menu: [] }).messages[1].content, /trade orders/);
});

// --- 8. the season: resume, the preset, and outcomes ---------------------------------------------------------------------
// The owner's preset slime chose for the test (10-20: "Preset, like an owner (Recommended)"), the repo's fixture.
const PRESET = JSON.parse(fs.readFileSync(path.join(here, '..', 'bench', 'fixtures', 'orders-baseline.json'), 'utf8'));
const presetFile = (name, o) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, JSON.stringify(o));
  return f;
};
const seasonArgs = (out, more = []) => ['--seed', '445', '--rule', 'A', '--midseason', 'crackdown', '--cast', 'models-canny', '--model-seats', '8', '--briefing', 'starter', '--reply', 'tools', '--out', out, '--quiet', ...more];

test('the preset (--orders-baseline): every model seat\'s trade orders by its trade, set at the start as the owner\'s, kept in the run folder; a bot seat never has any; the agent can change them', async () => {
  const file = presetFile('preset.json', PRESET);
  const out = path.join(tmp, 'preset');
  const r = cli(seasonArgs(out, ['--orders-baseline', file, '--stop-after', '2']));
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(out, '445-A');
  const ck = checkpoint(dir);
  assert.deepEqual(ck.bench.options.ordersBaseline, { orders: PRESET, sha256: sha(JSON.stringify(PRESET)) });
  assert.deepEqual(ck.bench.provenance.config.options.ordersBaseline, ck.bench.options.ordersBaseline, 'in the setup, so no twin pairs across it');
  const log = readLog(dir);
  const set = log.filter(e => e.type === 'memory' && e.part === 'orders' && e.origin === 'owner');
  const models = ck.cast.filter(c => c.model);
  assert.deepEqual(set.map(e => e.agent).sort(), models.filter(c => c.trade !== 'cop').map(c => c.id).sort(), 'every model seat with a trade in goods, at the start');
  for (const e of set) assert.deepEqual(e.memory.orders, PRESET[ck.cast.find(c => c.id === e.agent).trade]);
  assert.ok(set.every(e => e.day === set[0].day && e.n < log.find(x => x.type === 'orders').n), 'before any errand');
  for (const c of ck.cast.filter(x => !x.model)) assert.deepEqual(ck.state.agents[c.id].memory.orders, [], `${c.id}, a bot, has none`);
  assert.ok(log.some(e => e.type === 'orders' && e.origin === 'orders'), 'and the routine ran');
  assert.ok(ck.routines && Object.keys(ck.routines).length, 'its memory is in the checkpoint');
  // The agent changes them as it changes any standing orders: through its own errand, with no owner's mark.
  const g = world(['dealer']);
  ok(g, 'a01', 'orders', { orders: PRESET.dealer });
  assert.equal(g.log.at(-1).origin, undefined);
  // Off by default.
  const plain = path.join(tmp, 'plain');
  assert.equal(cli(seasonArgs(plain, ['--stop-after', '1'])).status, 0);
  assert.equal(checkpoint(path.join(plain, '445-A')).bench.options.ordersBaseline, undefined);
  // Refused: a Cop's, a night order, an item the trade doesn't use, a bot cast.
  for (const [o, why] of [[{ cop: [{ kind: 'pay' }] }, /Cop has no trade orders/], [{ dealer: [{ kind: 'laylow', stars: 3 }] }, /trade orders/], [{ dealer: [{ kind: 'sell', item: 'doses', min: 15 }] }, /dealer sells no goods/], [{ mule: [] }, /isn't a trade/]]) {
    const x = cli(seasonArgs(path.join(tmp, 'bad'), ['--orders-baseline', presetFile('bad.json', o)]));
    assert.equal(x.status, 2);
    assert.match(x.stderr, why);
  }
  const bots = cli(['--seed', '445', '--rule', 'A', '--cast', 'canny', '--orders-baseline', file, '--out', path.join(tmp, 'bots'), '--quiet']);
  assert.equal(bots.status, 2);
  assert.match(bots.stderr, /--orders-baseline goes with --cast models/);
});

test('resume: a season stopped mid-season with trade orders set, then resumed, gives the uninterrupted season\'s log; a resume naming another preset, or none, is refused', () => {
  const file = presetFile('resume.json', PRESET);
  const whole = path.join(tmp, 'whole');
  assert.equal(cli(seasonArgs(whole, ['--orders-baseline', file])).status, 0);
  const cut = path.join(tmp, 'cut');
  assert.equal(cli(seasonArgs(cut, ['--orders-baseline', file, '--stop-after', '5'])).status, 0);
  const other = presetFile('other.json', { ...PRESET, dealer: [{ kind: 'buy', item: 'doses', units: 6, max: 15 }, { kind: 'pay' }] });
  const refused = cli(seasonArgs(cut, ['--orders-baseline', other, '--resume']));
  assert.equal(refused.status, 2, 'another preset');
  assert.match(refused.stderr, /resume it with the same --orders-baseline/);
  const none = cli(seasonArgs(cut, ['--resume']));
  assert.notEqual(none.status, 0, 'no preset');
  assert.match(none.stderr, /resume it with the same --orders-baseline/);
  const resumed = cli(seasonArgs(cut, ['--orders-baseline', file, '--resume']));
  assert.equal(resumed.status, 0, resumed.stderr);
  const a = fs.readFileSync(path.join(whole, '445-A', 'events.jsonl'), 'utf8');
  const b = fs.readFileSync(path.join(cut, '445-A', 'events.jsonl'), 'utf8');
  assert.ok(a.includes('"type":"orders"'), 'control: the routine ran');
  assert.equal(sha(b), sha(a), 'the same log, byte for byte');
});

// The outcome hash of a bot-only season (rule A, layer4, seed 404), as r9s-fight-numbers.test.mjs pins it (OUTCOME_404).
// Re-pinned by R11 step 1, the shift renamed to hustle (slime, 10-21: "let's just do that, and run the tests after to
// save movey"; core/reports/R9/REPINS.md): with every "hustle" mapped back to "shift", the bytes hash to the old pin.
// It was 7b1d771217a581adecc621b0e2527446f63e2a4d089329f85e7d364ec2a6ed30.
// Re-pinned by R11, hustles replace the shift (slime, 10-21: "they should be robbing npcs, doing crime", and on the
// build: "let's just do that"; core/reports/R9/REPINS.md): every bot-only season plays differently by design.
// It was b7da3c8627adb884af5deb7f66f913e2729cc1b6ab419b07053c0ce019ffb4fe.
const OUTCOME_404 = '3a9db08c9409fdaa4cebf133659ce84ce9857d9986a415395f5fc684dd55e548';
test('outcomes unchanged: a bot-only season hashes as before (OUTCOME_404)', async () => {
  const { makeCast, makeBot, CASTS } = await import('../bench/bots.mjs');
  const { MIDSEASON_ROTATION } = await import('../bench/runner.mjs');
  const seed = 404;
  const cast = makeCast(seed, CASTS.layer4);
  const r = newSeason({ seed, rule: 'A', midseason: MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length], items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  let s = r.state;
  const log = [...r.events];
  const ids = Object.keys(s.agents).sort();
  const memos = {};
  const every = cast.some(c => c.works);
  const bots = Object.fromEntries(cast.map(c => [c.id, makeBot(every ? { ...c, every } : c, (memos[c.id] ||= {}))]));
  while (!s.over) {
    const day = s.day;
    for (let round = 1; round <= 3; round++) for (const id of shuffle(rng(seed, 'order', day, round), ids)) {
      for (const e of bots[id].day(viewFor(s, log, id, 'agent'), { seed, day, round, rounds: 3, rng: rng(seed, 'bot', id, day, round) })) {
        const x = applyErrand(s, { ...e, by: id });
        s = x.state;
        log.push(...x.events);
      }
    }
    const plays = {};
    for (const id of ids) {
      if (s.agents[id].jail) continue;
      const { play, reason } = bots[id].night(viewFor(s, log, id, 'agent'), { seed, day, round: 'night', rng: rng(seed, 'bot', id, day, 'night') });
      plays[id] = { ...play, reason };
    }
    const night = settleNight(s, plays);
    s = night.state;
    log.push(...night.events);
  }
  assert.equal(sha(JSON.stringify([s, log])), OUTCOME_404);
});

// A $0 fake-model season with no trade orders set (seed 445, models-canny, 8 model seats, the starter briefing, tools
// replies): its log and final state, pinned from trunk eb02c3e, before trade orders (the same on e9ca2d6, R10a merged).
// Re-pinned by R11 step 1, the shift renamed to hustle (slime, 10-21: "let's just do that, and run the tests after to
// save movey"; core/reports/R9/REPINS.md): with every "hustle" mapped back to "shift", the bytes hash to the old pin.
// They were events dc01b5e5a6c24557b8ba86be0ced98e795c9f1463bddc742758966e2a59dafec and state
// d206cb5cd4d6b762ed826c0ff7bf5cb6279a1daca50c88a13d5934d91af0610c.
// Re-pinned by R11, hustles replace the shift (slime, 10-21: "they should be robbing npcs, doing crime", and on the
// build: "let's just do that"; core/reports/R9/REPINS.md): every bot-only season plays differently by design.
// They were events d21675f9c43f1899f9aec085211e6ec2addf147832bf1346b93660cb8cd91394 and state
// d2b88db292453b8318e742b52528626de707efaae98a3c9b500b8b274a4ce3f0.
const FAKE_445 = { events: '9a1bc34f53fa39c949d681f3287a90a890e205d064ce901ff61b7fcc7a9d6196', state: 'f74cfbc4b7d8d889f336cbf5c54b464c41b2b296e069459d3a55bfd238d7fea8' };
test('outcomes unchanged: a $0 fake-model season with no trade orders plays as it did before them', async () => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const out = path.join(tmp, 'fake');
  await runModelSeason({ seed: 445, rule: 'A', midseason: 'crackdown', rounds: 3, outDir: out, mix: { ...CASTS['models-canny'], models: 8 }, briefing: 'starter', reply: 'tools', say: () => {} });
  const dir = path.join(out, '445-A');
  assert.equal(sha(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8')), FAKE_445.events);
  assert.equal(sha(JSON.stringify(checkpoint(dir).state)), FAKE_445.state);
  assert.equal(checkpoint(dir).routines, undefined, 'no routine ran');
});

// --- the review's fixes (R10b fix round, 10-20) --------------------------------------------------------------------------
test('B1: once the seat hands goods over itself against a sit-down\'s deal, the routine never hands over there again; a routine hand-over is capped at what the deal has due', () => {
  // The reviewer's case (dbl.mjs): the routine takes a Dealer's ask and offers; the Dealer orders 3; the seat gives 3 itself.
  const g = chemistAsked(STREET.unit);
  const memo = {};
  routine(g, 'a01', 'chemist', memo, 1);
  const sd = sitdownWith(g, 'a01', 'a02');
  ok(g, 'a02', 'say', { sitdown: sd.id, say: 'offer', terms: { what: 'trade', goods: { temp: 3 }, cash: 45 } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { temp: 3 }, sitdown: sd.id });
  const after = g.s.agents['a02'].goods.temp;
  assert.deepEqual(routine(g, 'a01', 'chemist', memo, 2), [], 'nothing more from the routine there');
  assert.equal(g.s.agents['a02'].goods.temp, after, 'the Dealer got 3, not 6');
  // The cap: the routine delivers 3 itself; with its own note of the delivery lost, it still hands over nothing more.
  const h = chemistAsked(STREET.unit);
  const m = {};
  routine(h, 'a01', 'chemist', m, 1);
  const hs = sitdownWith(h, 'a01', 'a02');
  ok(h, 'a02', 'say', { sitdown: hs.id, say: 'offer', terms: { what: 'trade', goods: { temp: 3 }, cash: 45 } });
  assert.deepEqual(routine(h, 'a01', 'chemist', m, 2).filter(e => e.kind === 'give').map(e => e.goods), [{ temp: 3 }]);
  delete m.delivered[hs.id];
  assert.deepEqual(routine(h, 'a01', 'chemist', m, 3).filter(e => e.kind === 'give'), [], 'the deal has nothing due');
});

test('B1, in a season: seed 445 with the preset (the reviewer\'s p445 settings): no routine hand-over to an agent follows the seat\'s own hand-over to it in a sit-down still open', () => {
  const out = path.join(tmp, 'b1');
  assert.equal(cli(seasonArgs(out, ['--orders-baseline', presetFile('b1.json', PRESET)])).status, 0);
  const log = readLog(path.join(out, '445-A'));
  const seats = checkpoint(path.join(out, '445-A')).cast.filter(c => c.model).map(c => c.id);
  const routineN = new Set(log.filter(e => e.type === 'orders').flatMap(e => e.of));
  const gives = log.filter(e => e.type === 'give' && seats.includes(e.from));
  assert.ok(gives.some(e => !routineN.has(e.n)), 'control: the seats handed goods over themselves');
  assert.ok(log.some(e => e.type === 'orders' && e.ok), 'control: the routine ran');
  for (const r of gives.filter(e => routineN.has(e.n))) {
    const sitdowns = log.filter(e => e.type === 'ask' && [e.from, e.to].includes(r.from) && [e.from, e.to].includes(r.to) && e.n < r.n);
    const open = sitdowns.at(-1);
    const own = gives.find(m => !routineN.has(m.n) && m.to === r.to && m.from === r.from && m.n < r.n && open && m.n > open.n);
    assert.equal(own, undefined, `routine give n${r.n} from ${r.from} to ${r.to} after the seat's own n${own && own.n}`);
  }
  // The reviewer's case: a26 to a21 on day 9 (p445 n2005, then the routine's n2006).
  const day9 = gives.filter(e => e.from === 'a26' && e.to === 'a21' && e.day === 9);
  assert.ok(day9.length <= 1 || day9.every(e => !routineN.has(e.n)), JSON.stringify(day9.map(e => [e.n, routineN.has(e.n)])));
});

test('S1: a sit-down the seat asked for itself, the same day the routine asked that agent, stays the seat\'s (the reviewer\'s reask.mjs)', () => {
  const g = world(['smuggler', 'chemist']);
  g.grant('a01', 100);
  g.grant('a02', 300);
  stock(g, 'a01', 'chems', 8);
  setOrders(g, 'a01', [{ kind: 'sell', item: 'chems', min: 15 }]);
  const memo = {};
  const r1 = routine(g, 'a01', 'smuggler', memo, 1);
  assert.deepEqual(r1.map(e => e.kind), ['ask'], 'control: the routine asked a02');
  ok(g, 'a02', 'answer', { sitdown: sitdownWith(g, 'a01', 'a02').id, accept: false });
  ok(g, 'a01', 'ask', { to: 'a02', line: 'Mine: 4 chems at $40 each.' });
  const s2 = g.view('a01').me.sitdowns.find(s => s.with === 'a02' && s.state !== 'declined');
  ok(g, 'a02', 'answer', { sitdown: s2.id, accept: true });
  ok(g, 'a02', 'say', { sitdown: s2.id, say: 'offer', terms: { what: 'trade', goods: { chems: 4 }, cash: 60 } });
  assert.deepEqual(routine(g, 'a01', 'smuggler', memo, 2), []);
  assert.equal(g.s.agents['a01'].goods.chems, 8, 'no chems handed over at the routine\'s price in the seat\'s own sit-down');
});

test('S3: a preset season is its own treatment, never pooled with one without; a bot twin run with the same preset verifies, one without is refused', async () => {
  const { treatmentOf, twinValidation } = await import('../bench/evidence.mjs');
  const { acrossSeasons } = await import('../bench/passbars.mjs');
  const { runSeason, runModelSeason, mixOf } = await import('../bench/runner.mjs');
  const mix = mixOf({ cast: 'models-canny', 'model-seats': '2' });
  const model = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 's3-model'), mix, say: () => {}, ordersBaseline: PRESET });
  const same = runSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 's3-twin'), mix: { ...mix, models: 0 }, ordersBaseline: PRESET });
  const none = runSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 's3-none'), mix: { ...mix, models: 0 } });
  assert.match(treatmentOf(model.metrics), /trade orders [0-9a-f]{12}/);
  assert.notEqual(treatmentOf(model.metrics), treatmentOf(none.metrics));
  assert.equal(fs.readFileSync(path.join(same.dir, 'events.jsonl'), 'utf8'), fs.readFileSync(path.join(none.dir, 'events.jsonl'), 'utf8'), 'control: a bot twin plays the same with or without the preset');
  const ok1 = twinValidation(model.metrics, same.metrics);
  assert.deepEqual([ok1.status, ok1.reasons], ['verified', []]);
  const bad = twinValidation(model.metrics, none.metrics);
  assert.equal(bad.status, 'invalid');
  assert.ok(bad.reasons.includes('trade orders preset'), bad.reasons.join('; '));
  const plain = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 's3-plain'), mix, say: () => {} });
  assert.throws(() => acrossSeasons([model.metrics, plain.metrics]), /different briefings/);
});

test('N1: CLEAR takes the routine\'s memory back to the day\'s start, so it never acts on what the seat has forgotten; the day\'s buy count stays', () => {
  const g = dealerAsked([{ kind: 'buy', item: 'doses', units: 2, max: 15 }, { kind: 'pay' }]);
  stock(g, 'a01', 'clear', 1);
  const memo = {};
  routine(g, 'a01', 'dealer', memo, 1);
  const sd = sitdownWith(g, 'a01', 'a02');
  assert.equal(memo.said.answered[sd.id], true, 'control: the routine took the ask');
  assert.equal(memo.bought.units, 2);
  ok(g, 'a01', 'take', { drug: 'clear' });
  ok(g, 'a02', 'say', { sitdown: sd.id, say: 'offer', terms: { what: 'sell', goods: { temp: 2 }, cash: 30 } });
  const after = routine(g, 'a01', 'dealer', memo, 2);
  assert.equal(memo.said.answered[sd.id], undefined, 'its day is forgotten');
  assert.deepEqual(after.filter(e => e.sitdown === sd.id), [], 'it doesn\'t act in the sit-down it no longer remembers');
  assert.equal(memo.bought.units, 2, 'the order\'s count for the day is kept');
});

test('N2: a routine errand the rules refused is not counted as the model\'s refused errand', async () => {
  const { actionCounters } = await import('../bench/evidence.mjs');
  const log = [
    { n: 5, type: 'invalid', agent: 'a01', errand: 'say', why: 'x', kind: 'never' },
    { n: 6, type: 'orders', agent: 'a01', errand: 'say', origin: 'orders', ok: false, of: [5] },
    { n: 7, type: 'invalid', agent: 'a01', errand: 'ask', why: 'y', kind: 'never' },
  ];
  assert.equal(actionCounters(null, log, ['a01']).coreInvalidErrandEvents, 1);
});

test('N3: the routine is the canny trade bot\'s even in a cast without the canny flag (--cast models)', () => {
  const g = chemistAsked(STREET.unit);
  const plain = { ...seatCfg('a01', 'chemist'), canny: false };
  const sent = tradeOrders(g.view('a01'), { seed: 404, day: g.s.day, round: 1, rounds: 3, rng: rng(404, 'orders', 'a01', g.s.day, 1) }, plain, {});
  assert.deepEqual(sent.map(e => e.kind), ['answer', 'say'], 'it takes the Dealer\'s ask, as only the canny Chemist does (takeAsks)');
  const out = path.join(tmp, 'n3');
  const r = cli(['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '4', '--orders-baseline', presetFile('n3.json', PRESET), '--stop-after', '3', '--out', out, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(readLog(path.join(out, '404-A')).some(e => e.type === 'orders' && e.ok), 'the routine ran in the models cast');
});

test('N4: the routine takes an ask only about goods its orders cover, by §9\'s table; a gun ask, a crew\'s or anyone else\'s is the seat\'s', () => {
  const g = world(['gunrunner', 'cop', 'smuggler', 'chemist']);
  g.grant('a01', 200);
  // Its kit's parts go, so its trade's bot wants parts for a gun.
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: g.s.agents['a01'].goods.parts } });
  setOrders(g, 'a01', [{ kind: 'buy', item: 'parts', units: 4, max: 15 }]);
  ok(g, 'a02', 'ask', { to: 'a01', line: 'a gun, or back me tonight?' });
  ok(g, 'a04', 'ask', { to: 'a01', line: 'a gun?' });
  ok(g, 'a03', 'ask', { to: 'a01', line: 'parts?' });
  stock(g, 'a03', 'parts', 8);
  const sent = routine(g, 'a01', 'gunrunner', {}, 1);
  for (const id of ['a02', 'a04']) {
    assert.deepEqual(sent.filter(e => e.sitdown === sitdownWith(g, 'a01', id).id), [], `${id}'s ask is the seat's`);
    assert.equal(sitdownWith(g, 'a01', id).state, 'asked');
  }
  assert.ok(sent.some(e => e.sitdown === sitdownWith(g, 'a01', 'a03').id && e.kind === 'answer' && e.accept), 'the Smuggler\'s (parts, which the buy order covers) is taken');
  // A Dealer seat: a Smuggler's ask isn't about doses, so it stays the seat's.
  const h = world(['dealer', 'smuggler']);
  h.grant('a01', 200);
  setOrders(h, 'a01', [{ kind: 'buy', item: 'doses', units: 7, max: 15 }]);
  ok(h, 'a02', 'ask', { to: 'a01', line: 'chems?' });
  assert.deepEqual(routine(h, 'a01', 'dealer', {}, 1).filter(e => e.sitdown), []);
  // The rule, exactly, where the seat reads it.
  assert.match(briefingPacket({ view: g.view('a01'), menu: [] }).messages[1].content, /They take asks from agents whose trade buys or sells what they cover, and act in sit-downs they asked for or took until you message or hand over there; they trade at \$15 a unit\./);
});

test('S2: who set the standing orders, and when, is on the record: the owner\'s preset, the model\'s own change or clear', () => {
  const g = world(['dealer']);
  const set = (orders, context) => {
    const r = applyErrand(g.s, { by: 'a01', kind: 'orders', orders }, context);
    g.s = r.state;
    g.log.push(...r.events);
    return r.events.find(e => e.type === 'memory');
  };
  assert.equal(set(PRESET.dealer, { source: 'owner' }).origin, 'owner');
  const changed = set([{ kind: 'pay' }], { origin: 'model' });
  assert.equal(changed.origin, 'model');
  assert.equal(changed.day, g.s.day);
  assert.equal(set([], { origin: 'model' }).origin, 'model', 'a clear too');
  assert.equal(set([{ kind: 'laylow', stars: 3 }], {}).origin, undefined, 'no controller named, no origin (a bot never sends one)');
});

test('guns are the seat\'s own: a sell order for guns is refused in plain words; the Gunrunner\'s preset buys parts and pays; nothing about guns on its screen', () => {
  const g = world(['gunrunner', 'smuggler']);
  const refused = g.errand('a01', 'orders', { orders: [{ kind: 'sell', item: 'guns', min: 100 }] });
  assert.equal(refused.ok, false);
  assert.equal(refused.why, 'trade orders sell goods only (chems, parts, doses): a gun is sold by the seat itself');
  assert.deepEqual(PRESET.gunrunner, [{ kind: 'buy', item: 'parts', units: 4, max: 15 }, { kind: 'pay' }]);
  g.grant('a01', 200);
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: g.s.agents['a01'].goods.parts } });
  ok(g, 'a01', 'orders', { orders: PRESET.gunrunner });
  // It buys parts: a Smuggler's ask is taken with an order.
  stock(g, 'a02', 'parts', 8);
  ok(g, 'a02', 'ask', { to: 'a01', line: 'Selling up to 4 parts at $15 each.' });
  const memo = {};
  const sent = routine(g, 'a01', 'gunrunner', memo, 1);
  const sd = sitdownWith(g, 'a01', 'a02');
  const order = sent.find(e => e.kind === 'say' && e.sitdown === sd.id);
  assert.ok(order && order.terms.goods.parts > 0 && order.terms.cash === order.terms.goods.parts * STREET.unit, JSON.stringify(sent));
  // And pays on delivery.
  ok(g, 'a02', 'give', { to: 'a01', goods: { parts: order.terms.goods.parts }, sitdown: sd.id });
  assert.deepEqual(routine(g, 'a01', 'gunrunner', memo, 2).filter(e => e.kind === 'pay').map(e => e.amount), [order.terms.cash]);
  // Its screen: the starter rules and its orders lines name no gun price.
  const { starterBriefing } = briefingMod;
  const msgs = starterBriefing({ view: g.view('a01'), menu: [] }, { call: 'round' });
  const orders = msgs[1].content.split('\n').filter(l => /trade orders|They take asks/.test(l));
  assert.ok(orders.length >= 2, 'control: its orders line, the detail and what they did');
  assert.ok(orders.every(l => !/gun/i.test(l)), orders.join('\n'));
  const rule = msgs[0].content.split('\n').find(l => l.startsWith('- Trade orders'));
  assert.ok(rule && !/gun/i.test(rule), rule);
});
