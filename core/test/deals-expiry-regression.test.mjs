// Night-bound offer terms cannot acquire consent after their lock. Real transfers and incurred balances remain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';

const ok = (g, by, kind, fields) => {
  const r = g.errand(by, kind, fields);
  assert.equal(r.ok, true, `${kind}: ${r.why}`);
};
function setup() {
  const g = new Game({ n: 3 });
  g.grant('a02', 100);
  addGoods(g.s.agents.a01, 'parts', 2);
  bookGoods(g.s, 'in', 'test', 'parts', 2);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  return { g, sd };
}
const offer = (g, sd, by = 'a02', terms = {}) => ok(g, by, 'say', {
  sitdown: sd, say: 'offer', terms: { what: by === 'a02' ? 'trade' : 'sell', goods: { parts: 2 }, cash: 40, night: 1, ...terms },
});

test('a night deadline survives in both deal views and a later delivery cannot agree the expired offer', () => {
  const { g, sd } = setup();
  offer(g, sd);
  for (const id of ['a01', 'a02']) assert.deepEqual(g.view(id).me.deals.map(d => [d.night, d.expired]), [[1, false]]);
  g.night();
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.night, d.expired]), [[1, true]]);
  assert.equal(g.view('a02').me.sitdowns[0].said[0].expired, true);
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  assert.equal(g.s.agents.a02.goods.parts, 1, 'the voluntary delivery still happens');
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.agreed, d.due, d.given, d.owes]), [[false, 0, {}, null]]);
});

for (const kind of ['pay', 'give']) test(`a later ${kind} cash transfer cannot agree an expired sell offer`, () => {
  const { g, sd } = setup();
  offer(g, sd, 'a01');
  g.night();
  const before = g.s.agents.a01.cash;
  ok(g, 'a02', kind, { to: 'a01', sitdown: sd, ...(kind === 'pay' ? { amount: 20, for: 'deal' } : { cash: 20 }) });
  assert.equal(g.s.agents.a01.cash, before + 20);
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.agreed, d.paid, d.owes]), [[false, 0, null]]);
});

test('a piece delivered after the night deadline stays a voluntary handover, not new consent', () => {
  const { g, sd } = setup();
  const piece = abilityCopy(g.s, 'vest');
  g.hand('a01', piece);
  offer(g, sd, 'a02', { goods: null, piece });
  g.night();
  ok(g, 'a01', 'give', { to: 'a02', copy: piece, sitdown: sd });
  assert.equal(g.s.copies[piece].holder.id, 'a02');
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.agreed, d.gave, d.due, d.owes]), [[false, false, 0, null]]);
});

test('a later reciprocal offer starts fresh instead of resurrecting expired consent', () => {
  const { g, sd } = setup();
  offer(g, sd);
  const oldId = g.view('a02').me.deals[0].id;
  g.night();
  offer(g, sd, 'a01', { night: 2 });
  const [d] = g.view('a02').me.deals;
  assert.notEqual(d.id, oldId);
  assert.deepEqual([d.agreed, d.agreedDay, d.night, d.expired], [false, null, 2, false]);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, sitdown: sd });
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.agreed, d.agreedDay, d.owes]), [[true, 2, 'me']], 'fresh valid terms can still be agreed');
});

test('a reciprocal offer with a different deadline is different terms even before either deadline', () => {
  const { g, sd } = setup();
  offer(g, sd);
  offer(g, sd, 'a01', { night: 2 });
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.night, d.agreed]), [[2, false]]);
  offer(g, sd, 'a02', { night: 2 });
  assert.equal(g.view('a02').me.deals[0].agreed, true);
});

test('a genuinely incurred payment obligation remains payable after its terms expire', () => {
  const { g, sd } = setup();
  offer(g, sd);
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 }, sitdown: sd });
  g.night();
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.agreed, d.expired, d.owes, d.due]), [[true, true, 'me', 40]]);
  ok(g, 'a02', 'pay', { to: 'a01', amount: 40, sitdown: sd });
  assert.deepEqual(g.view('a02').me.deals, []);
});

test('a genuinely incurred delivery obligation remains voluntarily settleable after its terms expire', () => {
  const { g, sd } = setup();
  offer(g, sd, 'a01');
  ok(g, 'a02', 'pay', { to: 'a01', amount: 40, sitdown: sd });
  g.night();
  assert.deepEqual(g.view('a01').me.deals.map(d => [d.agreed, d.expired, d.owes, d.paid]), [[true, true, 'me', 40]]);
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 }, sitdown: sd });
  assert.deepEqual(g.view('a01').me.deals, []);
});
