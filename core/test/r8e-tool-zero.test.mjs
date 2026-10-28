// R8e, zero is "none" in tools mode (the 10-19 season, runs/2026-10-19-ab): models that fill every field of a tool's
// schema send 0 where they mean nothing. GPT-6.1 Sol's gives carried "cash": 0 (four times) and GPT-6 Luna's sit-down
// answers carried terms "night": 0 (twice); the rules refused each, since cash is dollars (>=1) and night a count
// (>=1). In tools mode a 0 in a field whose type can never be 0 (TYPES count and dollars) now reads as absent, at any
// depth, but in a play's line fields (target, place, corner, batches, guns, lockpicks), which the rules check against
// tonight's menu line (r8d pins a cook's batches 0 as kept). JSON replies are unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { read, reply } from '../agents/tools.mjs';
import { actionsOfToolCalls } from '../agents/tool-calls.mjs';

const call = (name, args) => ({ id: 'call_1', type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
const read1 = (name, args) => actionsOfToolCalls([call(name, args)]).actions;

// As the 10-19 season's tape holds them.
const SOL_GIVE = '{"act":"give","fit":[],"to":"a22","piece":"","goods":[{"kind":"temp","count":1}],"cash":0,"sitdown":"s121","amount":0,"for":"deal","agent":"","item":"doses","units":0,"max":0,"drug":"temp"}';
const LUNA_SAY = '{"act":"say","to":"","line":"I\'ll cook five TEMP doses tonight; $75 for all five works.","sitdown":"s10","accept":false,"say":"answer","terms":{"what":"buy","who":"a30","piece":"","cash":75,"night":0,"where":"downtown","goods":[{"kind":"temp","count":5}]}}';

test('Sol\'s give with "cash": 0 reads as a give of 1 temp to a22 in s121', () => {
  assert.deepEqual(read1('money', SOL_GIVE), [{ act: 'give', to: 'a22', goods: { temp: 1 }, sitdown: 's121' }]);
});

test('Luna\'s say whose terms carry "night": 0 reads with no night; terms cash 0 (a number, >=0) stays', () => {
  assert.deepEqual(read1('talk', LUNA_SAY), [{ act: 'say', sitdown: 's10', say: 'answer', line: "I'll cook five TEMP doses tonight; $75 for all five works.", terms: { what: 'buy', who: 'a30', cash: 75, where: 'downtown', goods: { temp: 5 } } }]);
  const zeroCash = JSON.parse(LUNA_SAY);
  zeroCash.terms.cash = 0;
  assert.equal(read1('talk', zeroCash)[0].terms.cash, 0, 'a number field keeps its 0');
});

test('every count and dollars field: a 0 reads as absent; a required one is then missing, for the rules to refuse', () => {
  assert.deepEqual(read1('money', { act: 'pay', to: 'a02', amount: 0 }), [{ act: 'pay', to: 'a02' }]);
  // The 10-19 review: units is optional and the rules read a missing one as one unit (errand.mjs), so dropping its 0
  // made a real one-unit trade. Its 0 is kept, for the rules to refuse, which is this test's own intent.
  assert.deepEqual(read1('money', { act: 'shop', item: 'gun', units: 0, max: 40 }), [{ act: 'shop', item: 'gun', units: 0, max: 40 }]);
  assert.deepEqual(read1('money', { act: 'sell', item: 'doses', units: 0, drug: 'temp' }), [{ act: 'sell', item: 'doses', units: 0, drug: 'temp' }]);
  assert.deepEqual(read1('crew', { act: 'stash_put', cash: 0, piece: 'h1' }), [{ act: 'stash_put', piece: 'h1' }]);
  assert.deepEqual(read1('tricks', { act: 'bounty', agent: 'a03', amount: 0 }), [{ act: 'bounty', agent: 'a03' }]);
  assert.deepEqual(read1('talk', { act: 'say', sitdown: 's1', say: 'offer', terms: { night: 0 } }), [{ act: 'say', sitdown: 's1', say: 'offer' }], 'terms left empty go, as a blank does');
  assert.deepEqual(read1('talk', { act: 'say', sitdown: 's1', say: 'offer', terms: { night: 3 } }), [{ act: 'say', sitdown: 's1', say: 'offer', terms: { night: 3 } }], 'a count above 0 stays');
});

test('a play\'s line fields keep their 0 (the menu line judges them), its menu 0 is none, and a play inside another action reads the same', () => {
  assert.deepEqual(read1('play', { kind: 'cook', place: 'suburbs', batches: 0 }), [{ act: 'play', kind: 'cook', place: 'suburbs', batches: 0 }]);
  assert.deepEqual(read1('play', { menu: 0, kind: 'build', place: 'suburbs', guns: 0, lockpicks: 0 }), [{ act: 'play', kind: 'build', place: 'suburbs', guns: 0, lockpicks: 0 }]);
  const took = read1('tricks', { act: 'take', drug: 'temp', play: { menu: 0, kind: 'cook', place: 'suburbs', batches: 0 } });
  assert.deepEqual(took, [{ act: 'take', drug: 'temp', play: { kind: 'cook', place: 'suburbs', batches: 0 } }]);
});

test('JSON mode is unchanged: a give with cash 0 is refused as before', () => {
  const g = new Game({ n: 4 });
  for (const id of ['a01', 'a02', 'a03', 'a04']) g.grant(id, 2 * N.nights * N.rent);
  const { deal } = read(g.view('a01'), { audience: 'seat', seed: 's', from: 1 });
  const sent = [];
  const apply = e => { sent.push(e); const r = g.errand('a01', e.kind, e); return { ok: r.ok, why: r.why }; };
  const out = reply({ actions: [{ act: 'give', to: 'a02', cash: 0 }] }, { deal, apply, tries: {} });
  assert.equal(out.results[0].ok, false);
  assert.match(out.results[0].why, /dollars >=1/);
  assert.equal(sent.length, 0, 'nothing reached the rules');
});
