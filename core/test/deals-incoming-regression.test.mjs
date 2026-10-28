// The deal owns each recipient's latest qualifying incoming movement, including refunds and returns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { wakes } from '../bench/runner.mjs';

const ok = (g, by, kind, fields) => {
  const r = g.errand(by, kind, fields);
  assert.equal(r.ok, true, `${kind}: ${r.why}`);
};
const seenBy = v => Math.max(-1, ...v.events.map(e => e.n));
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
}
function setup(by = 'a02', piece = false) {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'parts', 2);
  g.grant('a02', 100);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  const copy = piece ? abilityCopy(g.s, 'vest') : null;
  if (copy) g.hand('a01', copy);
  ok(g, by, 'say', { sitdown: sd, say: 'offer', terms: {
    what: by === 'a02' ? 'trade' : 'sell', ...(copy ? { piece: copy } : { goods: { parts: 2 } }), cash: 40,
  } });
  return { g, sd, copy };
}
function checkIncoming(g, id, seen, event) {
  const view = g.view(id);
  assert.deepEqual(view.me.deals.map(d => [d.agreed, d.owes, d.incomingAt, d.incomingDay]), [[true, 'me', event.n, event.day]]);
  assert.equal(wakes(view, 2, seen), true, 'the new incoming movement wakes its recipient');
  assert.equal(wakes(view, 3, event.n), false, 'the same movement does not wake after being read');
  assert.deepEqual(g.view('a03').me.deals, [], 'the deal remains private to its participants');
}

for (const kind of ['pay', 'give']) test(`${kind}: a refund that reopens buyer debt wakes the buyer exactly once per unread refund`, () => {
  const { g, sd } = setup();
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  const seen = seenBy(g.view('a02'));
  assert.equal(wakes(g.view('a02'), 2, seen), false, 'the deal is balanced before the refund');
  for (let i = 0; i < 2; i++) {
    const prior = i ? g.view('a02').me.deals[0].incomingAt : seen;
    ok(g, 'a01', kind, { to: 'a02', sitdown: sd, ...(kind === 'pay' ? { amount: 5, for: 'deal' } : { cash: 5 }) });
    checkIncoming(g, 'a02', prior, g.events(kind).at(-1));
    assert.equal(g.view('a02').me.deals[0].paid, 20 - 5 * (i + 1));
  }
});

test('goods returned to a seller reopen its delivery obligation and wake that actual recipient', () => {
  const { g, sd } = setup('a01');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  const seen = seenBy(g.view('a01'));
  assert.equal(wakes(g.view('a01'), 2, seen), false);
  ok(g, 'a02', 'give', { to: 'a01', goods: { parts: 1 }, sitdown: sd });
  ok(g, 'a02', 'close', { sitdown: sd });
  checkIncoming(g, 'a01', seen, g.events('give').at(-1));
  assert.deepEqual(g.view('a01').me.deals[0].given, {});
  assert.equal(wakes(g.view('a02'), 2, seen), false, 'the sender owes nothing');
});

test('a returned piece with only partial cash creates no whole-piece obligation and does not falsely wake its seller', () => {
  const { g, sd, copy } = setup('a01', true);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  ok(g, 'a01', 'give', { to: 'a02', copy, sitdown: sd });
  const seen = seenBy(g.view('a01'));
  const original = g.view('a01').me.deals[0].paidAt;
  ok(g, 'a02', 'give', { to: 'a01', copy, sitdown: sd });
  const [d] = g.view('a01').me.deals;
  assert.equal(d.gave, false);
  assert.equal(d.owes, null, 'whole-piece rounding requires its full price before a piece is owed');
  assert.equal(d.paidAt, original, 'the original cash event is still its own fact');
  assert.equal(d.incomingAt, null, 'no qualifying incoming movement creates a wake');
  assert.equal(wakes(g.view('a01'), 2, seen), false);
});

test('CLEAR preserves refund wake metadata and deal counts while hiding the forgotten transfer event', () => {
  const { g, sd } = setup();
  stock(g, 'a02', 'clear', 1);
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  const seen = seenBy(g.view('a02'));
  ok(g, 'a01', 'pay', { to: 'a02', amount: 10, for: 'deal', sitdown: sd });
  const refund = g.events('pay').at(-1);
  const before = g.view('a02').me.deals;
  ok(g, 'a02', 'take', { drug: 'clear' });
  const view = g.view('a02');
  assert.equal(view.events.some(e => e.n === refund.n), false);
  assert.deepEqual(view.me.deals, before);
  checkIncoming(g, 'a02', seen, refund);
});

test('an unsolicited return against an unagreed offer wakes nobody and creates no canonical incoming marker', () => {
  const { g, sd } = setup('a01');
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  ok(g, 'a02', 'give', { to: 'a01', goods: { parts: 1 }, sitdown: sd });
  const seen = seenBy(g.view('a01'));
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.agreed, d.owes, d.incomingAt]), [[false, null, null]]);
  assert.equal(wakes(g.view('a01'), 2, seen), false);
});

test('a saved deal without recipient markers still exposes its recorded forward movement and migrates on the next handover', () => {
  const { g, sd } = setup();
  const seen = seenBy(g.view('a02'));
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  const give = g.events('give').at(-1);
  delete g.s.deals[0].incoming;
  checkIncoming(g, 'a02', seen, give);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 10, sitdown: sd });
  assert.equal(g.view('a02').me.deals[0].incomingAt, give.n, 'an outgoing partial pay preserves the prior incoming fact');
  ok(g, 'a01', 'pay', { to: 'a02', amount: 5, sitdown: sd });
  checkIncoming(g, 'a02', give.n, g.events('pay').at(-1));
});
