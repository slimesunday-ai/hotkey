// R8d, tool calls with every field filled (the 10-19 OpenRouter check, runs/2026-10-19-ab/check): GPT-6 Luna and
// GPT-6.1 Sol answered with every field of a tool's schema, blanks and first enum values included ("target": "",
// "corner": "industrial-1", "batches": 0, "drug": "temp", "accept": [] on a shift; "sitdown", "say" and "terms" on an
// ask). The rules refused each of those plays as inapplicable fields, the seats fell to the default play and were
// evicted at the first dawn. A tool call is read as the action it chose: a field the action, or the play's kind, doesn't
// take is dropped, and so is a blank value ("", null or {}); a field it takes keeps its value, zero and empty lists
// included, so the rules still judge it (a cook's batches 0 is refused, a build's guns 0 is a line on the menu, an empty
// accept list accepts nobody). A play's empty lies list, never valid, is dropped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { N } from '../numbers.mjs';
import { read } from '../agents/tools.mjs';
import { briefingPacket } from '../agents/briefing.mjs';
import { actionsOfToolCalls } from '../agents/tool-calls.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';
import { fakeOpenRouter } from '../agents/fake-openrouter.mjs';
import { openRouter } from '../agents/openrouter.mjs';

const call = (name, args) => ({ id: 'call_1', type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
const read1 = (name, args) => actionsOfToolCalls([call(name, args)]).actions;
// Luna's and Sol's arguments as the 10-19 tape holds them.
const LUNA_SHIFT = '{"menu":2,"kind":"hustle","target":"","place":"industrial","corner":"industrial-1","batches":0,"guns":0,"lockpicks":0,"want":"","drug":"temp","lies":[],"warrants":0,"fake":"","accept":[],"reason":""}';
const SOL_ASK = '{"act":"ask","to":"a10","line":"Vex here, gunrunner.","sitdown":"","accept":false,"say":"offer","terms":{"what":"meet","who":"a10","piece":"","cash":0,"night":2,"where":"industrial","goods":[]}}';

test('a play with every field filled reads as the play it chose', () => {
  assert.deepEqual(read1('play', LUNA_SHIFT), [{ act: 'play', menu: 2, kind: 'hustle', place: 'industrial', accept: [] }]);
  const withReason = JSON.parse(LUNA_SHIFT);
  withReason.reason = 'Earn first-night cash and cover rent without heat.';
  assert.deepEqual(read1('play', withReason), [{ act: 'play', menu: 2, kind: 'hustle', place: 'industrial', accept: [], reason: withReason.reason }]);
  assert.deepEqual(read1('play', { menu: 0, kind: 'laylow', place: 'suburbs' }), [{ act: 'play', kind: 'laylow', place: 'suburbs' }], 'menu 0 is no menu');
});

test('an ask with the talk tool\'s other fields filled reads as the ask', () => {
  assert.deepEqual(read1('talk', SOL_ASK), [{ act: 'ask', to: 'a10', line: 'Vex here, gunrunner.' }]);
});

// Sol's sit-down answer as the 10-19 season's tape holds it: refused there for terms.goods [].
const SOL_SAY = '{"act":"say","to":"a15","line":"$15 per chem works.","sitdown":"s1","accept":true,"say":"answer","terms":{"what":"meet","who":"a15","piece":"","cash":0,"night":2,"where":"industrial","goods":[]}}';

test('a sit-down message with empty terms fields reads with those fields gone, zeros kept; the lists that mean something when empty stay', () => {
  assert.deepEqual(read1('talk', SOL_SAY), [{ act: 'say', sitdown: 's1', say: 'answer', line: '$15 per chem works.', terms: { what: 'meet', who: 'a15', cash: 0, night: 2, where: 'industrial' } }]);
  assert.deepEqual(read1('memory', { act: 'plan', traits: [] }), [{ act: 'plan', traits: [] }], 'a plan of [] clears it');
  assert.deepEqual(read1('memory', { act: 'orders', orders: [] }), [{ act: 'orders', orders: [] }], 'orders of [] clear them');
});

test('a field the play takes keeps its value, zero and empty lists included; a blank one goes; an empty lies list goes', () => {
  assert.deepEqual(read1('play', { kind: 'cook', place: 'suburbs', batches: 0, target: '', corner: 'docks-1' }), [{ act: 'play', kind: 'cook', place: 'suburbs', batches: 0 }]);
  assert.deepEqual(read1('play', { kind: 'build', place: 'suburbs', guns: 0, lockpicks: 1, batches: 0, drug: 'temp' }), [{ act: 'play', kind: 'build', place: 'suburbs', guns: 0, lockpicks: 1 }]);
  assert.deepEqual(read1('play', { kind: 'hit', target: 'a02', place: 'docks', want: '', accept: [] }), [{ act: 'play', kind: 'hit', target: 'a02', place: 'docks', accept: [] }]);
  assert.deepEqual(read1('play', { kind: 'cook', place: 'forest', batches: 1, drug: 'temp', lies: [] }), [{ act: 'play', kind: 'cook', place: 'forest', batches: 1, drug: 'temp' }]);
  assert.deepEqual(read1('play', { kind: 'hit', target: 'a02', place: 'docks', accept: ['a03'] }), [{ act: 'play', kind: 'hit', target: 'a02', place: 'docks', accept: ['a03'] }]);
});

// A seat on the API's fake, in tools mode, on a manual clock (r8-tools-seat.test.mjs's harness).
async function lockWith(api, args) {
  const { makeSeat } = await import('../agents/seat.mjs');
  const g = new Game({ n: 4 });
  for (const id of ['a01', 'a02', 'a03', 'a04']) g.grant(id, 2 * N.nights * N.rent);
  const shift = read(g.view('a01'), { audience: 'seat', seed: 's', from: 1 }).deal.menu.find(l => l.kind === 'hustle');
  const filled = { ...JSON.parse(LUNA_SHIFT), menu: shift.n, place: shift.place, ...args };
  const clock = manualClock();
  const key = 'sk-or-v1-r8d-dummy';
  const script = { a01: [{ toolCalls: [call('play', filled)] }] };
  const fake = api === 'local' ? fakeModel({ script, clock }) : fakeOpenRouter({ key, script, clock });
  const send = api === 'local' ? fake.fetch : openRouter({ fetch: fake.fetch, key, maxCost: 5, clock }).fetch;
  const seat = makeSeat({
    id: 'a01', url: api === 'local' ? `http://fake.invalid${CHAT_PATH}` : 'http://openrouter.invalid/api/v1/chat/completions', fetch: send, secret: 's', clock,
    model: 'test/model', api, reply: 'tools', brief: (r, memory, last, round, context) => briefingPacket(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }),
  });
  let done = false;
  const p = seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), validatePlay: x => checkPlay(g.s, 'a01', x, g.s.day), round: 'lock', defaultPlay: defaultPlay(g.s, 'a01', g.s.day) });
  p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 1000 && !done; i++) {
    if (fake.calls.some(c => c.outcome === 'pending')) await clock.advance(N['gap.window'] * 1000);
    else await new Promise(resolve => setImmediate(resolve));
  }
  const out = await p;
  await fake.close();
  return { out, shift };
}

test('at the lock, on both APIs, Luna\'s filled shift plays the shift it chose, with no refusal', async () => {
  for (const api of ['local', 'openrouter']) {
    const { out, shift } = await lockWith(api, {});
    assert.equal(out.play?.kind, 'hustle', `${api}: the shift, not the default play`);
    assert.equal(out.play?.place, shift.place, `${api}: at its place`);
    assert.deepEqual(out.results.filter(r => r.ok === false), [], `${api}: nothing refused`);
  }
});
