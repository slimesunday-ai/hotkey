import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { makeSeat } from '../agents/seat.mjs';
import { briefing } from '../agents/briefing.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
const said = actions => ({ json: { actions } });
function seated(g, script, memo = {}) {
  const clock = manualClock(); const fake = fakeModel({ script: { a01: script }, clock }); const seen = [];
  const seat = makeSeat({ id: 'a01', url: `http://fake.invalid${CHAT_PATH}`, fetch: fake.fetch, secret: 'interface-secret', clock, memo,
    brief: (r, memory, last, round) => { seen.push(last); return briefing(r, { last, call: round === 'lock' ? 'lock' : 'round' }); } });
  const call = round => seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), round, defaultPlay: defaultPlay(g.s, 'a01', g.s.day), validatePlay: p => checkPlay(g.s, 'a01', p, g.s.day),
    apply: e => { const r = g.errand('a01', e.kind, e); return { ...r, kind: r.events.find(e => e.type === 'invalid')?.kind }; } });
  return { seat, fake, seen, call };
}
test('rent failure survives lock and dawn with bounded checkpoint-deterministic typed feedback', async () => {
  const g = new Game({ n: 3 });
  const s = seated(g, [said([{ act: 'rent' }]), said([{ act: 'play', kind: 'hustle', place: 'docks' }]), said([])]);
  await s.call(1); const lock = await s.call('lock');
  assert.ok(s.seen.at(-1).some(r => r.act === 'rent' && !r.ok));
  const memo = structuredClone(s.seat.memo); g.night({ a01: lock.play }); await s.call(1);
  assert.ok(s.seen.at(-1).some(r => r.act === 'rent' && !r.ok));
  const resumed = seated(g, { 3: said([]) }, memo); await resumed.call(1);
  assert.deepEqual(resumed.seen.at(-1), s.seen.at(-1));
  assert.deepEqual(resumed.seat.memo, s.seat.memo);
  assert.ok(s.seat.memo.feedback.length <= 12);
  assert.deepEqual(s.seat.record[0].attempts[0].actions, [{ act: 'rent', ok: false, source: 'core', status: 'refused', code: 'rules' }]);
  await s.fake.close(); await resumed.fake.close();
});
test('CLEAR in a batch erases pre-take failures and receipts before the next briefing', async () => {
  const g = new Game({ n: 3 }); addGoods(g.s.agents.a01, 'clear', 1); bookGoods(g.s, 'in', 'test', 'clear', 1);
  const s = seated(g, [said([{ act: 'rent' }, { act: 'take', drug: 'clear' }]), said([])]);
  const out = await s.call(1); assert.ok(out.results.some(r => r.act === 'rent' && !r.ok), 'audit still reports the actual attempt');
  assert.ok(!s.seat.memo.feedback.some(r => r.act === 'rent'), 'pre-CLEAR learned feedback is erased immediately');
  await s.call(2); assert.deepEqual(s.seen.at(-1), []); assert.deepEqual(s.seat.memo.feedback, []);
  await s.fake.close();
});
test('a refused lock play retries only that reply; daytime payments never replay', async () => {
  const g = new Game({ n: 3 }); g.grant('a01', 10);
  const s = seated(g, [said([{ act: 'pay', to: 'a02', amount: 3 }]), said([{ act: 'rent' }, { act: 'play', kind: 'hit', drug: 'temp' }]), said([{ act: 'play', kind: 'hustle', place: 'docks' }])]);
  await s.call(1); const lock = await s.call('lock'); assert.equal(lock.calls, 2);
  assert.equal(g.s.agents.a01.cash, 7); assert.equal(g.s.agents.a02.cash, 3); assert.equal(g.events('pay').length, 1);
  assert.equal(s.seat.record[1].attempts[0].actions.length, 2); assert.equal(s.seat.record[1].attempts[1].actions.length, 1);
  await s.fake.close();
});

test('mid-batch CLEAR keeps subsequent receipts, wipes cached and earlier batch facts, and lock retry replays no payment', async () => {
  const g = new Game({ n: 3 }); g.grant('a01', 30); addGoods(g.s.agents.a01, 'clear', 1); bookGoods(g.s, 'in', 'test', 'clear', 1);
  const s = seated(g, [
    said([{ act: 'rent' }, { act: 'play', kind: 'hit', target: 'a02', place: 'docks' }]),
    said([{ act: 'pay', to: 'a03', amount: 3 }, { act: 'take', drug: 'clear' }, { act: 'pay', to: 'a02', amount: 4 }]),
    { fault: 'malformed' }, said([{ act: 'play', kind: 'hustle', place: 'docks' }]), said([]),
  ]);
  await s.call(1); assert.equal(s.seat.memo.pick.kind, 'hit');
  await s.call(2); assert.equal(s.seat.memo.pick, null);
  assert.deepEqual(s.seat.memo.feedback.map(r => [r.act, r.action?.to]), [['pay', 'a02']]);
  const lock = await s.call('lock'); assert.equal(lock.calls, 2); assert.equal(lock.play.kind, 'hustle');
  for (const request of s.fake.calls.slice(2,4)) {
    const text = request.request.messages.map(m => m.content).join('\n');
    assert.ok(!text.includes('you have a home')); assert.ok(!text.includes('play: set, hit'));
  }
  assert.ok(s.seen.at(-1).some(r => r.act === 'pay' && r.action.to === 'a02'));
  assert.ok(!s.seen.at(-1).some(r => r.act === 'pay' && r.action.to === 'a03'));
  assert.deepEqual(s.seat.record[1].attempts[0].actions.map(a => [a.act, a.ok, a.source]), [['pay', true, 'core'], ['take', true, 'core'], ['pay', true, 'core']], 'immutable telemetry retains every action across CLEAR');
  assert.equal(s.seat.record.flatMap(r => r.attempts).flatMap(a => a.actions || []).filter(a => a.act === 'pay' && a.ok).length, 2, 'both payments are counted although only the later receipt is retained');
  assert.equal(g.events('pay').length, 2); assert.equal(g.s.agents.a01.cash, 23);
  assert.equal(g.s.agents.a02.cash, 4); assert.equal(g.s.agents.a03.cash, 3);
  g.night({ a01: lock.play }); await s.call(1);
  assert.ok(s.seen.at(-1).some(r => r.act === 'pay' && r.action.to === 'a02'));
  assert.ok(!s.seen.at(-1).some(r => r.act === 'rent'));
  await s.fake.close();
});
