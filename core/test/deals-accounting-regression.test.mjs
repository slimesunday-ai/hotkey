// Reviewed R5 counterexamples: a cash transfer has one book, and actual debt precedes optional advances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';

const ok = (g, by, kind, fields) => {
  const r = g.errand(by, kind, fields);
  assert.equal(r.ok, true, `${kind}: ${r.why}`);
  return r;
};
function setup() {
  const g = new Game({ n: 3 });
  g.grant('a02', 300);
  for (const kind of ['parts', 'chems', 'guns']) {
    addGoods(g.s.agents.a01, kind, 4);
    bookGoods(g.s, 'in', 'test', kind, 4);
  }
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  return { g, sd };
}
function order(g, sd, kind, units, cash, delivered = 0) {
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { [kind]: units }, cash } });
  if (delivered) ok(g, 'a01', 'give', { to: 'a02', goods: { [kind]: delivered }, sitdown: sd });
}
function promise(g, sd, cash = 20) {
  ok(g, 'a02', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', cash, night: g.s.day } });
}
const paidPromise = g => g.s.promises.find(p => p.by === 'a02' && p.what === 'pay').paid;
const balances = g => Object.fromEntries(g.view('a02').me.deals.map(d => [Object.keys(d.goods)[0], [d.paid, d.due]]));

for (const kind of ['pay', 'give']) {
  const cash = (g, sd, amount, named = true, purpose = 'deal') => ok(g, 'a02', kind, {
    to: 'a01', ...(kind === 'pay' ? { amount, for: purpose } : { cash: amount }), ...(named ? { sitdown: sd } : {}),
  });
  test(`${kind}: named goods cash settles its deal without also fulfilling an equal independent promise`, () => {
    const { g, sd } = setup();
    promise(g, sd);
    order(g, sd, 'parts', 1, 20, 1);
    const before = [g.s.agents.a01.cash, g.s.agents.a02.cash];
    cash(g, sd, 20);
    assert.deepEqual(g.view('a02').me.deals, []);
    assert.equal(paidPromise(g), 0);
    assert.deepEqual([g.s.agents.a01.cash, g.s.agents.a02.cash], [before[0] + 20, before[1] - 20]);
  });
  test(`${kind}: unnamed exact promised cut stays promise-only; an unnamed purchase amount stays deal-only`, () => {
    const { g, sd } = setup();
    promise(g, sd);
    order(g, sd, 'parts', 2, 60, 1);
    cash(g, sd, 20, false);
    assert.equal(paidPromise(g), 20);
    assert.deepEqual(balances(g), { parts: [0, 30] });
    cash(g, sd, 30, false);
    assert.equal(paidPromise(g), 20);
    assert.deepEqual(balances(g), { parts: [30, 30] });
  });
  test(`${kind}: excess named deal cash remains voluntary excess, without spilling into a promise`, () => {
    const { g, sd } = setup();
    promise(g, sd);
    order(g, sd, 'parts', 1, 20, 1);
    const before = g.s.agents.a01.cash;
    cash(g, sd, 35);
    assert.equal(g.s.agents.a01.cash, before + 35);
    assert.deepEqual(g.view('a02').me.deals, []);
    assert.equal(paidPromise(g), 0);
  });
  test(`${kind}: standalone partial promise payments retain their credit`, () => {
    const { g, sd } = setup();
    promise(g, sd);
    cash(g, sd, 7, false, 'debt');
    assert.equal(paidPromise(g), 7);
    cash(g, sd, 13, false, 'debt');
    assert.equal(paidPromise(g), 20);
  });
}

test('gift and crew-cut payments retain their promise credit and never enter goods deals', () => {
  for (const purpose of ['gift', 'cut']) {
    const { g, sd } = setup();
    promise(g, sd);
    order(g, sd, 'parts', 2, 60, 1);
    ok(g, 'a02', 'pay', { to: 'a01', amount: 7, for: purpose, sitdown: sd });
    assert.equal(paidPromise(g), 7);
    assert.deepEqual(balances(g), { parts: [0, 30] });
  }
});

for (const kind of ['pay', 'give']) test(`${kind}: an expired unagreed offer cannot swallow an unnamed partial promise repayment`, () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40);
  // Give the offer a real typed deadline through a replacement offer before its lock.
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 40, night: 1 } });
  g.night();
  promise(g, sd);
  ok(g, 'a02', kind, { to: 'a01', ...(kind === 'pay' ? { amount: 7, for: 'debt' } : { cash: 7 }) });
  assert.equal(paidPromise(g), 7);
  assert.deepEqual(balances(g), { parts: [0, 0] });
});

test('an explicit named expired goods payment cannot spill into an unrelated promise', () => {
  const { g, sd } = setup();
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 40, night: 1 } });
  g.night();
  promise(g, sd);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 7, for: 'deal', sitdown: sd });
  assert.equal(paidPromise(g), 0);
  assert.deepEqual(balances(g), { parts: [0, 0] });
});

test('an unnamed partial promise repayment still counts when the only goods deal cannot take any more cash', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 40, sitdown: sd });
  promise(g, sd);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 7, for: 'debt' });
  assert.equal(paidPromise(g), 7);
  assert.deepEqual(balances(g), { parts: [40, 0] });
});

test('cash in a direction with no goods-deal allocation can still repay a standalone partial promise', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40);
  g.grant('a01', 30);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', cash: 20, night: 1 } });
  ok(g, 'a01', 'give', { to: 'a02', cash: 7 });
  assert.equal(g.s.promises.find(p => p.by === 'a01').paid, 7);
  assert.deepEqual(balances(g), { parts: [0, 0] });
});

test('same sit-down: a balanced partial deal cannot take the next delivered deal\'s exact payment as an advance', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40, 1);
  order(g, sd, 'chems', 1, 20, 1);
  for (let i = 0; i < 2; i++) ok(g, 'a02', 'pay', { to: 'a01', amount: 20, for: 'debt', sitdown: sd });
  assert.deepEqual(balances(g), { parts: [20, 20] });
});

test('debt matching stays exact before newest within the debt class', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40, 1);
  order(g, sd, 'chems', 2, 60, 1);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  assert.deepEqual(balances(g), { parts: [20, 20], chems: [0, 30] });
});

test('a nonmatching payment fills newest debt only to its obligation, then spills into the older actual debt', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40, 1);
  order(g, sd, 'chems', 2, 60, 1);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 40, sitdown: sd });
  assert.deepEqual(balances(g), { parts: [10, 20], chems: [30, 30] });
});

test('an exact optional advance waits behind actual debt; only the remainder advances the newest offer', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 2, 40, 1);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 10, sitdown: sd });
  order(g, sd, 'chems', 1, 20);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  assert.deepEqual(balances(g), { parts: [20, 20], chems: [10, 0] });
  assert.equal(g.view('a01').me.deals.find(d => d.goods.chems).agreed, false, 'paying its own order still agrees nothing');
});

test('once no actual debt remains, optional advances retain exact-match before newest ordering', () => {
  const { g, sd } = setup();
  order(g, sd, 'parts', 3, 60, 1);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  order(g, sd, 'chems', 1, 20);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 40, sitdown: sd });
  assert.deepEqual(balances(g), { parts: [60, 20], chems: [0, 0] });
});
