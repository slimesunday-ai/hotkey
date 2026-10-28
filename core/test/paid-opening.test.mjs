import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Game, ITEMS, cast } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

function stake(n, f) {
  const was = N.stake;
  N.stake = n;
  try { return f(); } finally { N.stake = was; }
}
test('paid opening: default zero preserves setup event bytes and books no grant', () => {
  assert.equal(N.stake, 0);
  const r = newSeason({ seed: 404, rule: 'A', items: ITEMS, agents: cast(2) });
  // Captured from ee88b97 before stake parameterization: exact zero-opening event compatibility.
  assert.equal(createHash('sha256').update(JSON.stringify(r.events)).digest('hex'), 'b642bb6af7a8cddd3a1c9190287adb0dffba41f5be946c16a65e80cfe711de2f');
  assert.equal(Object.hasOwn(r.state.money.in, 'stake'), false);
  assert.equal(Object.hasOwn(r.state, 'stake'), false);
  checkLedger(r.state);
});
for (const n of [0, 80, 100]) test(`paid opening: ${n} is equal across seats and its public fact survives override scope`, () => {
  const g = stake(n, () => new Game({ n: 3 }));
  for (const a of Object.values(g.s.agents)) {
    assert.equal(a.cash, n);
    assert.deepEqual(a.goods, N.kits[a.trade]);
  }
  assert.equal(g.s.money.in.stake || 0, 3 * n);
  assert.equal(g.view('a01').board.startingStake, n);
  assert.equal(g.view(null, 'public').board.startingStake, n);
});
test('paid opening: only nonnegative whole-dollar stakes can create a season', () => {
  for (const n of [-1, 0.5, NaN, Infinity, '80', null]) {
    assert.throws(() => stake(n, () => new Game()), /stake.*nonnegative.*whole/i);
  }
});
for (const n of [80, 100]) test(`paid opening: ${n} funds goods-work rent and remains reachable by burglary`, () => stake(n, () => {
  const g = new Game({ n: 3 });
  const r = g.night({ a01: { kind: 'breakin', target: 'a02', accept: ['a03'] }, a03: { kind: 'back', target: 'a01' }, a02: { kind: 'run', place: 'forest' } });
  const theft = r.newEvents.find(e => e.type === 'burgle');
  assert.equal(theft.cash, Math.floor(n * N.breakinShare));
  assert.ok(g.s.agents.a02.goods.chems > 0, 'remote production still happens');
  assert.equal(g.s.agents.a01.cash, n + theft.cash - N.rent);
  const normal = new Game({ n: 2 });
  normal.night({ a01: { kind: 'run', place: 'forest' }, a02: { kind: 'run', place: 'junkyard' } });
  assert.equal(normal.s.agents.a01.evicted, false);
  assert.equal(normal.s.agents.a01.cash, n - N.rent);
}));
