import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { accepted, joined, auditRead } from './r6-audit-fixtures.mjs';
import { makeSeat } from '../agents/seat.mjs';
import { briefingPacket } from '../agents/briefing.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { N } from '../numbers.mjs';
import { manualClock } from '../agents/fake-model.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';

const inspect = section => ({ act: 'lookup', section, mode: 'inspect' });
function controlled(g, script, memo = {}) {
  const requests = []; const clock = manualClock();
  const seat = makeSeat({ id: 'a01', url: 'http://offline.invalid/chat', secret: 'r6-inspect', clock, memo,
    brief: (r, memory, last, round, context) => briefingPacket(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }),
    fetch: async (url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      let response = script[requests.length - 1];
      if (typeof response === 'function') response = await response(body, init.signal);
      return new Response(JSON.stringify({ choices: [{ message: { content: typeof response === 'string' ? response : JSON.stringify({ actions: response }) }, finish_reason: 'stop' }] }));
    },
  });
  const call = (round = 1) => seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), round,
    defaultPlay: defaultPlay(g.s, 'a01', g.s.day), validatePlay: p => checkPlay(g.s, 'a01', p, g.s.day),
    apply: e => g.errand('a01', e.kind, e) });
  return { seat, requests, call, clock };
}

test('inspect returns exact evidence before mutation, then acts using only the existing second request', async () => {
  const g = new Game({ n: 3 }); g.grant('a02', 50);
  accepted(g, 'a02', 'pay', { to: 'a01', amount: 7, for: 'debt' });
  const s = controlled(g, [[inspect('transactions')], body => {
    assert.equal(g.events('pay').length, 1, 'inspection itself changes nothing');
    assert.ok(joined(body.messages).includes('"amount":7'), 'requested receipt reaches the immediate continuation');
    return [{ act: 'pay', to: 'a02', amount: 2 }];
  }]);
  const out = await s.call();
  assert.equal(out.calls, 2); assert.equal(out.origin, 'model');
  assert.equal(g.events('pay').length, 2);
  assert.equal(s.seat.memo.today, 2);
  assert.ok(!s.requests[1].messages.some(m => m.content.startsWith('Your last reply failed:')), 'an inspection success is not mislabeled a failure');
});

test('repeated inspection and inspection after failure never create a third request', async () => {
  for (const first of [[inspect('history')], 'bad JSON']) {
    const g = new Game({ n: 3 });
    const s = controlled(g, [first, [inspect('history')], [{ act: 'pay', to: 'a02', amount: 1 }]]);
    const out = await s.call();
    assert.equal(out.calls, 1 + N['gap.retry']);
    assert.equal(s.requests.length, 2);
    assert.equal(g.events('pay').length, 0);
    assert.ok(out.results.some(r => r.code === 'inspection-budget'));
  }
});

test('daily ceiling counts inspection and presentation IDs advance only for requests that are sent', async () => {
  const g = new Game({ n: 3 }); accepted(g, 'a02', 'ask', { to: 'a01', line: 'R6-DELIVERY' });
  const s = controlled(g, [[inspect('speech')]], { day: g.s.day, today: N.callCeiling - 1 });
  const out = await s.call();
  assert.equal(out.calls, 1); assert.equal(s.seat.memo.today, N.callCeiling);
  assert.ok(s.seat.memo.delivery.length > 0);
  const saved = structuredClone(s.seat.memo);
  const blocked = controlled(g, [], saved);
  const denied = await blocked.call(2);
  assert.equal(denied.calls, 0); assert.equal(blocked.requests.length, 0);
  assert.deepEqual(blocked.seat.memo.delivery, saved.delivery);
  const neverSent = controlled(g, [], { day: g.s.day, today: N.callCeiling });
  await neverSent.call(); assert.deepEqual(neverSent.seat.memo.delivery, []);
});

test('an inspection continuation keeps the request window and has no retry allowance after timeout', async () => {
  const g = new Game({ n: 3 });
  const s = controlled(g, [[inspect('history')], (body, signal) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('window')), { once: true }))]);
  const pending = s.call();
  await new Promise(resolve => setImmediate(resolve));
  await s.clock.advance(N['gap.window'] * 1000);
  const out = await pending;
  assert.equal(out.calls, 2); assert.equal(out.outcome, 'timeout');
  assert.equal(s.requests.length, 2); assert.equal(s.clock.pending(), 0);
});

test('fresh inspected copies are redealt rather than masked through the obsolete initial deal', async () => {
  const g = new Game({ n: 3 });
  const copy = tierCopy(g.s, 'common');
  const s = controlled(g, [() => {
    g.hand('a02', copy);
    accepted(g, 'a02', 'give', { to: 'a01', piece: copy });
    return [inspect('transactions')];
  }, body => {
    const text = joined(body.messages);
    assert.match(text, /"copy":"P\d+"/);
    assert.ok(!text.includes('"copy":"[piece]"'));
    assert.ok(!/\bk\d+\b/.test(text));
    return [];
  }]);
  const out = await s.call(); assert.equal(out.calls, 2);
});

test('CLEAR between inspection and continuation reprojects evidence and resets delivery bookkeeping', async () => {
  const g = new Game({ n: 3 });
  accepted(g, 'a02', 'ask', { to: 'a01', line: 'R6-ERASE-PRIVATE' });
  addGoods(g.s.agents.a01, 'clear', 1); bookGoods(g.s, 'in', 'test', 'clear', 1);
  const s = controlled(g, [() => {
    accepted(g, 'a01', 'take', { drug: 'clear' }); return [inspect('speech')];
  }, body => {
    assert.ok(!joined(body.messages).includes('R6-ERASE-PRIVATE'));
    assert.ok(joined(body.messages).includes('Lookup speech, day 1:'), 'fresh post-CLEAR evidence still reaches the continuation');
    assert.ok(joined(body.messages).includes('"total":0'));
    return [];
  }]);
  await s.call();
  assert.deepEqual(s.seat.memo.delivery, []);
  assert.ok(!JSON.stringify(s.seat.memo.last).includes('R6-ERASE-PRIVATE'));
});

test('an explicit current inspection replaces a previously scheduled typed page', () => {
  const g = new Game({ n: 3 }); const r = auditRead(g);
  const page = counterpart => ({ act: 'lookup', ok: true, day: 1, lookup: { section: 'transactions', with: counterpart, rows: [], total: 0, shown: 0, omitted: 0, offset: 0, nextOffset: null } });
  const p = briefingPacket(r.result, { last: [page('a02')], inspection: page('a03') });
  assert.ok(joined(p.messages).includes('"with":"a03"'));
  assert.ok(!joined(p.messages).includes('"with":"a02"'));
});

test('scheduled lookup keeps its next-call contract and never adds an inference', async () => {
  const g = new Game({ n: 3 });
  const s = controlled(g, [[{ act: 'lookup', section: 'transactions' }], body => {
    assert.ok(joined(body.messages).includes('Lookup transactions, day 1:'));
    return [];
  }]);
  assert.equal((await s.call(1)).calls, 1);
  assert.equal((await s.call(2)).calls, 1);
  assert.equal(s.requests.length, 2);
});

test('inspection at lock uses the remaining request and an unanswered continuation falls back legally', async () => {
  const g = new Game({ n: 3 }); const s = controlled(g, [[inspect('history')], 'bad JSON']);
  const out = await s.call('lock');
  assert.equal(out.calls, 2); assert.equal(out.origin, 'default');
  assert.deepEqual(out.play, defaultPlay(g.s, 'a01', g.s.day));
  assert.equal(checkPlay(g.s, 'a01', out.play, g.s.day).ok, true);
});

test('delivery checkpoints retain more than 4096 still-permitted IDs without turning old messages unread', async () => {
  const g = new Game({ n: 3 });
  const ids = Array.from({ length: 5001 }, (_, i) => `speech:${i}:0`);
  const memo = JSON.parse(JSON.stringify({ delivery: ids.slice(0, 5000) }));
  let seen;
  const seat = makeSeat({ id: 'a01', url: 'http://offline.invalid/chat', secret: 'bookkeeping-fixture', memo,
    brief: (r, memory, last, round, context) => {
      seen = context.delivery.presentedSpeechIds;
      return { messages: [{ role: 'user', content: 'Typed presentation bookkeeping fixture' }], availableSpeechIds: ids, presentedSpeechIds: [ids.at(-1)], omittedSpeechCount: 5000 };
    },
    fetch: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"actions":[]}' }, finish_reason: 'stop' }] })),
  });
  await seat.call({ view: g.view('a01'), round: 1, apply: () => { throw new Error('no mutation'); } });
  assert.equal(seen.length, 5000);
  assert.deepEqual(seat.memo.delivery, ids);
});
