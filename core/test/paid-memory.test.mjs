import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { viewFor } from '../rules/view.mjs';
import { checkPlay, typedPlay, originOf } from '../rules/plays.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';
import { memoryScope, checkMemory } from '../rules/memory.mjs';

function apply(g, id, kind, fields = {}, context = {}) {
  const r = applyErrand(g.s, { by: id, kind, ...fields }, context);
  g.s = r.state; g.log.push(...r.events); checkLedger(g.s);
  return r;
}
const plan = g => [{ trait: Object.keys(g.s.traits)[0], routes: ['buy', 'trade'] }];
const memory = (g, id = 'a01') => g.view(id).me.memory;
const has = (x, text) => JSON.stringify(x).includes(text);
function stock(g, id, drug) { addGoods(g.s.agents[id], drug, 1); bookGoods(g.s, 'in', 'test', drug, 1); }
function open(g) {
  g.errand('a01', 'ask', { to: 'a02' });
  const id = g.events('ask').at(-1).sitdown;
  g.errand('a02', 'answer', { sitdown: id, accept: true });
  return id;
}

test('paid memory: all new agents and legacy checkpoints read empty without phantom events or mutation', () => {
  const g = new Game();
  assert.deepEqual(memory(g), { plan: [], orders: [], creed: [], journal: [] });
  delete g.s.agents.a01.memory;
  const before = structuredClone(g.s); const log = structuredClone(g.log);
  assert.deepEqual(memory(g), { plan: [], orders: [], creed: [], journal: [] });
  assert.deepEqual(g.s, before); assert.deepEqual(g.log, log);
  assert.equal(g.events('memory').length, 0);
});
test('paid memory: valid plan persists through serialized checkpoint and arbitrary model replacement', () => {
  const g = new Game(); const p = plan(g);
  assert.equal(apply(g, 'a01', 'plan', { traits: p }).ok, true);
  const saved = JSON.parse(JSON.stringify({ state: g.s, log: g.log }));
  saved.state.agents.a01.driver = 'replacement-model';
  assert.deepEqual(viewFor(saved.state, saved.log, 'a01').me.memory.plan, p);
  assert.equal(g.events('memory').length, 1);
});
test('paid memory: plan limits and typed routes are atomic, with no arbitrary strings or duplicate facts', () => {
  const g = new Game(); const p = plan(g); assert.equal(apply(g, 'a01', 'plan', { traits: p }).ok, true);
  const traits = Object.keys(g.s.traits);
  const invalid = [p.concat(p), traits.slice(0, 4).map(trait => ({ trait, routes: ['buy', 'hit'] })),
    [{ trait: traits[0], routes: ['buy'] }], [{ trait: traits[0], routes: ['buy', 'buy'] }],
    [{ trait: traits[0], routes: ['buy', 'hit', 'trade', 'vault'] }], [{ trait: traits[0], routes: ['buy', 'SECRET-ROUTE'] }],
    [{ trait: '__proto__', routes: ['buy', 'hit'] }], [{ trait: traits[0], routes: ['buy', 'hit'], line: 'JUNK' }]];
  for (const q of invalid) {
    const before = structuredClone(g.s); const r = apply(g, 'a01', 'plan', { traits: q });
    assert.equal(r.ok, false); assert.deepEqual(g.s, { ...before, seq: before.seq + 1 });
    assert.equal(has(g.view('a01'), 'SECRET-ROUTE'), false); assert.equal(has(g.view('a01'), 'JUNK'), false);
  }
  assert.equal(apply(g, 'a01', 'plan', { traits: [] }).ok, true);
  assert.deepEqual(memory(g).plan, []);
});
test('paid memory: Creed authority comes only from trusted context, never action fields', () => {
  const g = new Game();
  for (const fields of [{ source: 'owner' }, { context: { source: 'owner' } }, { origin: 'owner' }]) {
    assert.equal(apply(g, 'a01', 'creed', { lines: ['OWNER-CANARY'], ...fields }).ok, false);
    assert.equal(has(g.view('a01'), 'OWNER-CANARY'), false);
  }
  assert.equal(apply(g, 'a01', 'creed', { lines: ['OWNER-CANARY'] }, { source: 'owner' }).ok, true);
  assert.deepEqual(memory(g).creed, ['OWNER-CANARY']);
  assert.equal(apply(g, 'a01', 'creed', { lines: ['1', '2', '3', '4'] }, { source: 'owner' }).ok, false);
  assert.equal(apply(g, 'a01', 'creed', { lines: ['one\ntwo'] }, { source: 'owner' }).ok, false);
});
test('paid memory: five Q8 orders are typed, unique and stored without a policy or immediate execution', () => {
  const g = new Game();
  const orders = [{ kind: 'retaliate' }, { kind: 'laylow', stars: 3 }, { kind: 'protect_grail' }, { kind: 'back', agent: 'a02' }, { kind: 'avoid_lawless' }];
  const before = structuredClone(g.s.agents.a01);
  assert.equal(apply(g, 'a01', 'orders', { orders }).ok, true);
  assert.deepEqual(memory(g).orders, orders);
  const { memory: ignored, ...rest } = g.s.agents.a01;
  const { memory: old, ...was } = before;
  assert.deepEqual(rest, was);
  for (const bad of [[...orders, orders[0]], [{ kind: '__proto__' }], [{ kind: 'back', agent: '__proto__' }],
    [{ kind: 'back', agent: 'a01' }], [{ kind: 'laylow', stars: 4 }], [{ kind: 'retaliate', line: 'CANARY-ORDER' }]]) {
    assert.equal(apply(g, 'a01', 'orders', { orders: bad }).ok, false);
  }
  assert.equal(has(g.view('a01'), 'CANARY-ORDER'), false);
});
test('paid memory: journal is bounded to12 dated notes and every word field is capped by gap.lineLength', () => {
  const g = new Game();
  for (let i = 0; i < 14; i++) assert.equal(apply(g, 'a01', 'note', { line: `note${i}` }).ok, true);
  assert.equal(memory(g).journal.length, 12); assert.equal(memory(g).journal[0].line, 'note2');
  assert.ok(memory(g).journal.every(x => x.day === 1));
  assert.equal(apply(g, 'a01', 'note', { line: 'z'.repeat(N['gap.lineLength'] + 20) }).ok, true);
  assert.equal(memory(g).journal.at(-1).line.length, N['gap.lineLength']);
  assert.equal(apply(g, 'a01', 'creed', { lines: ['z'.repeat(500)] }, { source: 'owner' }).ok, true);
  assert.equal(memory(g).creed[0].length, N['gap.lineLength']);
  assert.equal(apply(g, 'a01', 'note', { line: { line: 'JUNK' } }).ok, false);
});
test('paid memory: own words now, outsider words after24h, ownerAI words never, including matured snapshots', () => {
  const g = new Game();
  apply(g, 'a01', 'note', { line: 'PRIVATE-NOTE-CANARY' });
  apply(g, 'a01', 'creed', { lines: ['PRIVATE-CREED-CANARY'] }, { source: 'owner' });
  for (const text of ['PRIVATE-NOTE-CANARY', 'PRIVATE-CREED-CANARY']) {
    assert.ok(has(g.view('a01'), text)); assert.equal(has(g.view('a02'), text), false);
    assert.equal(has(g.view(null, 'public'), text), false); assert.equal(has(g.view('a01', 'ownerAI'), text), false);
  }
  g.night();
  for (const text of ['PRIVATE-NOTE-CANARY', 'PRIVATE-CREED-CANARY']) {
    assert.ok(has(g.view('a02'), text)); assert.ok(has(g.view(null, 'record'), text));
    assert.equal(has(g.view('a02', 'ownerAI'), text), false);
  }
});
test('paid memory: public matured snapshot survives recent-event expiry without exposing current replacement', () => {
  const g = new Game(); apply(g, 'a01', 'note', { line: 'OLD-PUBLIC-NOTE' }); g.advanceTo(5);
  assert.equal(g.view('a02').events.some(e => e.type === 'memory'), false);
  const matured = g.view('a02').board.memories.find(x => x.agent === 'a01');
  assert.equal(matured.asOfDay, 1); assert.equal(matured.asOfClock, 2);
  assert.ok(has(matured, 'OLD-PUBLIC-NOTE'));
  apply(g, 'a01', 'note', { line: 'NEW-PRIVATE-NOTE' });
  assert.equal(has(g.view('a02').board.memories, 'NEW-PRIVATE-NOTE'), false);
  assert.ok(has(memory(g), 'NEW-PRIVATE-NOTE'));
});
test('paid memory: TRUTH shares a separate actual verified plan only when the pair sat today', () => {
  const g = new Game(); apply(g, 'a01', 'plan', { traits: plan(g) }); stock(g, 'a01', 'truth');
  assert.equal(g.errand('a01', 'take', { drug: 'truth', play: { kind: 'hustle', place: 'docks' } }).ok, true);
  const id = open(g); const sd = g.view('a02').me.sitdowns.find(s => s.id === id);
  assert.deepEqual(sd.verifiedPlan, memory(g).plan); assert.equal(sd.verified.kind, 'hustle');
  assert.equal(g.view('a03').me.sitdowns.length, 0);
  g.night();
  assert.equal(g.view('a02').me.sitdowns.find(s => s.id === id).verifiedPlan, undefined);
  stock(g, 'a01', 'truth'); g.errand('a01', 'take', { drug: 'truth', play: { kind: 'hustle', place: 'docks' } });
  g.errand('a01', 'say', { sitdown: id, say: 'answer' });
  assert.equal(g.view('a02').me.sitdowns.find(s => s.id === id).verifiedPlan, undefined);
  g.errand('a02', 'say', { sitdown: id, say: 'answer' });
  assert.deepEqual(g.view('a02').me.sitdowns.find(s => s.id === id).verifiedPlan, memory(g).plan);
});
test('paid memory: CLEAR erases active plan and private notes, preserving older public notes, Creed and orders', () => {
  const g = new Game(); apply(g, 'a01', 'note', { line: 'OLDER-PUBLIC' }); g.night();
  const p = plan(g); apply(g, 'a01', 'plan', { traits: p }); apply(g, 'a01', 'note', { line: 'PRE-CLEAR-PRIVATE' });
  apply(g, 'a01', 'creed', { lines: ['PERSIST-CREED'] }, { source: 'owner' });
  apply(g, 'a01', 'orders', { orders: [{ kind: 'avoid_lawless' }] }); stock(g, 'a01', 'clear');
  assert.equal(g.errand('a01', 'take', { drug: 'clear' }).ok, true);
  assert.deepEqual(memory(g).plan, []); assert.equal(has(memory(g), 'PRE-CLEAR-PRIVATE'), false);
  assert.ok(has(memory(g), 'OLDER-PUBLIC')); assert.ok(has(memory(g), 'PERSIST-CREED'));
  assert.deepEqual(memory(g).orders, [{ kind: 'avoid_lawless' }]);
  assert.equal(has(g.view('a01'), 'PRE-CLEAR-PRIVATE'), false);
  apply(g, 'a01', 'note', { line: 'POST-CLEAR' }); assert.ok(has(memory(g), 'POST-CLEAR'));
  g.night(); assert.ok(has(g.view('a02'), 'PRE-CLEAR-PRIVATE'), 'old public history is not destroyed');
  assert.equal(has(memory(g), 'PRE-CLEAR-PRIVATE'), false, 'public history does not restore active journal');
});
test('paid memory: CLEAR with empty memory emits no phantom update or invented economic penalty', () => {
  const g = new Game(); stock(g, 'a01', 'clear'); const cash = g.s.agents.a01.cash;
  const r = g.errand('a01', 'take', { drug: 'clear' }); assert.equal(r.ok, true);
  assert.equal(r.events.filter(e => e.type === 'memory').length, 0);
  assert.equal(g.s.agents.a01.cash, cash); assert.equal(g.s.agents.a01.goods.clear || 0, 0);
});
test('paid memory: trusted owner play origin survives typed/night records without granting another origin string', () => {
  const g = new Game(); const p = { kind: 'hustle', place: 'docks', origin: 'owner' };
  assert.equal(checkPlay(g.s, 'a01', p).ok, true);
  assert.deepEqual(originOf(p), { origin: 'owner' });
  assert.equal(typedPlay(g.s, p).origin, 'owner');
  assert.equal(typedPlay(g.s, { ...p, origin: 'CANARY-ORIGIN' }).origin, undefined);
  g.night({ a01: p }); assert.equal(g.events('play', e => e.agent === 'a01').at(-1).origin, 'owner');
});
test('paid memory: failed locked operation leaves stored memory and public snapshot history unchanged', () => {
  const g = new Game(); apply(g, 'a01', 'plan', { traits: plan(g) }); stock(g, 'a01', 'truth');
  g.errand('a01', 'take', { drug: 'truth', play: { kind: 'hustle', place: 'docks' } });
  const before = structuredClone(g.s); const log = structuredClone(g.log);
  const r = apply(g, 'a01', 'plan', { traits: [{ trait: '__proto__', routes: ['buy', 'hit'] }] });
  assert.equal(r.ok, false); assert.deepEqual(g.s, { ...before, seq: before.seq + 1 });
  assert.deepEqual(g.events('memory'), log.filter(e => e.type === 'memory'));
});


test('paid memory: visible identity scope runs the actual validator with identical typed decisions', () => {
  const g = new Game(); const scope = memoryScope(g.view('a01'));
  const cases = [{ by: 'a01', kind: 'plan', traits: plan(g) },
    { by: 'a01', kind: 'orders', orders: [{ kind: 'back', agent: 'a02' }] },
    { by: 'a01', kind: 'plan', traits: [{ trait: '__proto__', routes: ['buy', 'hit'] }] },
    { by: 'a01', kind: 'creed', lines: ['not trusted'] }];
  for (const e of cases) assert.deepEqual(checkMemory(scope, e), checkMemory(g.s, e));
  assert.deepEqual(Object.keys(scope).sort(), ['agents', 'traits']);
  assert.equal(has(scope, 'cash'), false);
});
test('paid memory: typed plan/orders stay private until disclosure and remain typed for ownerAI on day15', () => {
  const g = new Game(); const p = plan(g); const orders = [{ kind: 'back', agent: 'a02' }];
  apply(g, 'a01', 'plan', { traits: p }); apply(g, 'a01', 'orders', { orders });
  assert.deepEqual(g.view('a01', 'ownerAI').me.memory.plan, p);
  assert.deepEqual(g.view('a01', 'ownerAI').me.memory.orders, orders);
  assert.deepEqual(g.view('a02').board.memories, []);
  assert.deepEqual(g.view(null, 'public').board.memories, []);
  g.night();
  assert.deepEqual(g.view('a02').board.memories.find(x => x.agent === 'a01').plan, p);
  g.advanceTo(14);
  apply(g, 'a01', 'creed', { lines: ['LAST-CREED-CANARY'] }, { source: 'owner' });
  apply(g, 'a01', 'note', { line: 'LAST-NOTE-CANARY' });
  assert.equal(has(g.view('a02'), 'LAST-NOTE-CANARY'), false);
  g.night();
  for (const text of ['LAST-CREED-CANARY', 'LAST-NOTE-CANARY']) {
    assert.ok(has(g.view(null, 'public'), text)); assert.ok(has(g.view(null, 'record'), text));
    for (const id of ['a01', 'a02']) assert.equal(has(g.view(id, 'ownerAI'), text), false);
  }
});
test('paid memory: inherited owner authority and null context cannot grant Creed writes', () => {
  const g = new Game();
  for (const context of [null, Object.create({ source: 'owner' }), { source: 'ownerAI' }, { source: 'model' }]) {
    assert.equal(apply(g, 'a01', 'creed', { lines: ['FORGED-OWNER'] }, context).ok, false);
    assert.deepEqual(memory(g).creed, []);
  }
});


test('paid memory: current, verified and historical views are cloned facts, never mutable state references', () => {
  const g = new Game(); apply(g, 'a01', 'plan', { traits: plan(g) });
  apply(g, 'a01', 'orders', { orders: [{ kind: 'back', agent: 'a02' }] });
  g.night(); stock(g, 'a01', 'truth');
  g.errand('a01', 'take', { drug: 'truth', play: { kind: 'hustle', place: 'docks' } });
  const id = open(g); const state = structuredClone(g.s); const log = structuredClone(g.log);
  const own = g.view('a01'); const other = g.view('a02');
  own.me.memory.plan[0].routes.push('JUNK'); own.me.memory.orders[0].agent = 'JUNK';
  other.board.memories[0].plan[0].routes.push('JUNK');
  other.me.sitdowns.find(x => x.id === id).verifiedPlan[0].routes.push('JUNK');
  assert.deepEqual(g.s, state); assert.deepEqual(g.log, log);
  assert.equal(has(g.view('a01'), 'JUNK'), false);
});


test('paid memory: forced and invalid owner choices retain requested provenance without crediting a substituted play', () => {
  for (const forced of [false, true]) {
    const g = new Game(); if (forced) g.s.agents.a01.crash = true;
    g.night({ a01: forced ? { kind: 'run', place: 'forest', origin: 'owner' }
      : { kind: 'hit', target: 'missing', place: 'forest', origin: 'owner' } });
    const event = g.events(forced ? 'forced' : 'invalid', e => e.agent === 'a01').at(-1);
    assert.equal(event.play.origin, 'owner');
    assert.equal(g.events('play', e => e.agent === 'a01').at(-1).origin, undefined);
  }
});
