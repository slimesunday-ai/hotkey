// R5-deals, the review's wake (runner.mjs `wakes`; GAME.md §17): a hand-over wakes a model seat only for a deal it
// agreed to, and only once for each new hand-over: `wakes(view, round, seen)`, where `seen` is the last event the
// seat's own call has read. The review's probe: a counterpart paying $1 a day against an offer the seat never agreed
// to woke it in rounds 2 and 3 on every day. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const runner = () => import('../bench/runner.mjs');
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
// What a call reading this view has seen: the last event in it.
const seenBy = v => Math.max(-1, ...v.events.map(e => e.n));

test("the review's probe: $1 a day against an offer the seat never agreed to wakes it on no day, the sit-down closed or not (§17)", async () => {
  const { wakes } = await runner();
  const g = new Game({ n: 4 });
  g.grant('a01', 100);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { guns: 14 }, cash: 14 } });
  ok(g, 'a01', 'pay', { to: 'a02', amount: 1 });
  ok(g, 'a02', 'close', { sitdown: sd });
  const woke = [];
  for (let d = 0; d < 12; d++) {
    ok(g, 'a01', 'pay', { to: 'a02', amount: 1 });
    if (wakes(g.view('a02'), 2, -1) || wakes(g.view('a02'), 3, -1)) woke.push(g.s.day);
    g.night();
  }
  assert.deepEqual(woke, [], 'no wake on any day');
});

test('goods that come against a deal the seat agreed to wake it once for each hand-over: not again once its call has read it, and again for the next (§10, §17)', async () => {
  const { wakes } = await runner();
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'chems', 4);
  g.grant('a02', 4 * N.rent);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * N.rent } });
  // The seat's own call reads the sit-down with its order in it.
  let seen = seenBy(g.view('a02'));
  assert.equal(wakes(g.view('a02'), 2, seen), false, 'control: nothing new for a02');
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  assert.equal(wakes(g.view('a02'), 2, seen), true, 'the first unit wakes it');
  seen = seenBy(g.view('a02'));
  assert.equal(wakes(g.view('a02'), 3, seen), false, 'once its call has read it, not again, though it still owes');
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  assert.equal(wakes(g.view('a02'), 3, seen), true, 'the next hand-over wakes it again');
});
