// R4-2, ties without ids (trunk docs/briefs/R4-astra-fixes.md, task 2; GAME.md §8, §9, §23; GAP gap.trades, gap.gear).
// The ties this change takes away from the ids, so none goes to the lowest id night after night:
// - a drop's leftover units go round: one each to the Smugglers there in id order, starting at the (night mod k)-th of
//   the k there, so the start moves one place along each night. Astra's probe (root/probes.json): five identical
//   Smugglers at a six-unit drop split 2/1/1/1/1 every night, so over thirteen nights the lowest id got 26 units to
//   everyone else's 13;
// - a break-in uses its leader's lockpick, else the first backer holding one in the leader's list; with no list (a crew),
//   the crewmates holding one go round by night, as the drop's leftovers do (the orchestrator's call).
// Amounts come from N; nothing here is random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, idOf } from './helpers.mjs';
import { dropSplit } from '../rules/market.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods, LAST_NIGHT } from '../rules/state.mjs';
import { rng, shuffle } from '../rng.mjs';
import { N } from '../numbers.mjs';

const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};
const sum = xs => xs.reduce((t, x) => t + x, 0);
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}

// --- the drop ------------------------------------------------------------------------------------------------------

test("a drop's split is even and its leftovers go round by night: one each, in id order, from the (night mod k)-th of the k there, never by chance (§9)", () => {
  const u = N.dropUnits;
  assert.deepEqual(dropSplit(['a07'], 1), { a07: u }, 'alone: the whole drop');
  for (let night = 1; night <= LAST_NIGHT; night++) {
    assert.deepEqual(dropSplit(['a09', 'a02'], night), { a02: u / 2, a09: u / 2 }, 'two: even, nothing left over');
    assert.deepEqual(dropSplit([], night), {}, 'nobody there, nothing split');
  }
  // Four at a drop: each gets the floor, and the leftovers start one place further along each night.
  const four = ['a04', 'a01', 'a03', 'a02'];
  const each = Math.floor(u / 4);
  const extra = u - 4 * each;
  for (let night = 1; night <= 4; night++) {
    const got = dropSplit(four, night);
    const sorted = [...four].sort();
    const lucky = Array.from({ length: extra }, (_, j) => sorted[(night + j) % 4]);
    assert.deepEqual(got, Object.fromEntries(sorted.map(id => [id, each + (lucky.includes(id) ? 1 : 0)])), `night ${night}: the extras to ${lucky}`);
  }
  const totals = {};
  for (let night = 1; night <= 4; night++) for (const [id, n] of Object.entries(dropSplit(four, night))) totals[id] = (totals[id] || 0) + n;
  assert.deepEqual(new Set(Object.values(totals)).size, 1, `over four nights the four get the same: ${JSON.stringify(totals)}`);
  // More Smugglers than units: each night a different one goes without.
  const seven = ['a05', 'a03', 'a01', 'a02', 'a04', 'a06', 'a07'];
  const without = [1, 2, 3].map(night => Object.entries(dropSplit(seven, night)).filter(([, n]) => n === 0).map(([id]) => id));
  assert.deepEqual(without.map(x => x.length), [7 - u, 7 - u, 7 - u]);
  assert.equal(new Set(without.flat()).size, 3 * (7 - u), `a different one each night: ${JSON.stringify(without)}`);
  assert.throws(() => dropSplit(four), /which night/, 'no night, no split');
});

// Five identical Smugglers run the same drop every night they can work (nights 1 to 13: no work on the last night).
both("Astra's five Smugglers: at one six-unit drop every night of a season, each gathers within one unit of the others, the lowest id no more than any, and the drop's units all go out", rule => {
  const g = new Game({ n: 5, rule });
  const ids = Object.keys(g.s.agents).sort();
  const got = Object.fromEntries(ids.map(id => [id, 0]));
  let nights = 0;
  while (g.s.day < LAST_NIGHT) {
    const r = g.night(Object.fromEntries(ids.map(id => [id, { kind: 'run', place: 'mall' }])));
    for (const e of r.newEvents.filter(x => x.type === 'gather')) got[e.agent] += e.goods.chems || 0;
    nights += 1;
  }
  const units = Object.values(got);
  assert.equal(nights, LAST_NIGHT - 1);
  assert.equal(sum(units), nights * N.dropUnits, 'every unit of every night went out');
  assert.ok(Math.max(...units) - Math.min(...units) <= 1, `within one unit: ${JSON.stringify(got)}`);
  assert.ok(got[ids[0]] <= Math.min(...units) + 1 && got[ids[0]] < 2 * nights, `the lowest id: ${got[ids[0]]}`);
  const fair = Math.floor(nights * N.dropUnits / ids.length);
  for (const id of ids) assert.ok(got[id] === fair || got[id] === fair + 1, `${id}: ${got[id]}, its share ${fair} or one more`);
});

test('under any ids, a season of shared nights leaves no id ahead by more than one unit: the leftovers never settle on the lowest ids', () => {
  for (let k = 0; k < 12; k++) {
    for (const size of [4, 5, 7]) {
      const ids = shuffle(rng('r4-2 ties', k, size), Array.from({ length: 30 }, (_, i) => idOf(i + 1))).slice(0, size);
      const got = Object.fromEntries(ids.map(id => [id, 0]));
      for (let night = 1; night < LAST_NIGHT; night++) for (const [id, n] of Object.entries(dropSplit(ids, night))) got[id] += n;
      const units = Object.values(got);
      assert.ok(Math.max(...units) - Math.min(...units) <= 1, `${size} at a drop, ids ${ids}: ${JSON.stringify(got)}`);
    }
  }
});

// --- the lockpick --------------------------------------------------------------------------------------------------

both("a break-in uses its leader's lockpick first, then its first backer's in the leader's order, not the lowest id's", rule => {
  for (const order of [['a02', 'a03'], ['a03', 'a02']]) {
    const g = new Game({ n: 5, rule });
    stock(g, 'a02', 'lockpicks');
    stock(g, 'a03', 'lockpicks');
    const r = g.night({ a01: { kind: 'breakin', target: 'a04', accept: order }, a02: { kind: 'back', target: 'a01' }, a03: { kind: 'back', target: 'a01' } });
    const used = r.newEvents.filter(e => e.type === 'used' && e.goods.lockpicks).map(e => e.agent);
    assert.deepEqual(used, [order[0]], `the leader's order ${order}`);
    assert.equal(g.s.agents[order[1]].goods.lockpicks, 1, 'the other one keeps its own');
  }
  const g = new Game({ n: 5, rule });
  for (const id of ['a01', 'a02']) stock(g, id, 'lockpicks');
  const r = g.night({ a01: { kind: 'breakin', target: 'a04', accept: ['a02'] }, a02: { kind: 'back', target: 'a01' } });
  assert.deepEqual(r.newEvents.filter(e => e.type === 'used').map(e => e.agent), ['a01'], "its leader's own first");
});

both("with no list, a crew break-in whose leader has no lockpick uses its crewmates' in turn, going round by night as the drop's leftovers do (in id order, from the (night mod k)-th), not the lowest id's every time", rule => {
  const g = new Game({ n: 5, rule });
  g.errand('a01', 'crew_form', { name: 'c' });
  for (const id of ['a02', 'a03']) {
    g.errand('a01', 'crew_invite', { agent: id });
    g.errand(id, 'crew_join', { crew: 'c1' });
  }
  const used = [];
  for (let k = 0; k < 4; k++) {
    for (const id of ['a02', 'a03']) if (!g.s.agents[id].goods.lockpicks) stock(g, id, 'lockpicks');
    const night = g.s.day;
    const r = g.night({ a01: { kind: 'breakin', target: 'a04' }, a02: { kind: 'back', target: 'a01' }, a03: { kind: 'back', target: 'a01' } });
    assert.deepEqual(r.fights.groups.a01, ['a01', 'a02', 'a03'], 'control: its crewmates, accepted with no list');
    const by = r.newEvents.filter(e => e.type === 'used' && e.goods.lockpicks).map(e => e.agent);
    assert.deepEqual(by, [['a02', 'a03'][night % 2]], `night ${night}: the (${night} mod 2)-th of a02 and a03`);
    used.push(...by);
  }
  assert.deepEqual([...new Set(used)].sort(), ['a02', 'a03'], `each pays in turn: ${used}`);
});
