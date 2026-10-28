// Paid-review regressions, all offline: ledger receipts survive an ongoing conversation without making speech a debt;
// large deal sets remain available through bounded read-only pages inside the original briefing ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, idOf, tierCopy } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { GOODS, addGoods, bookGoods, messageLimit } from '../rules/state.mjs';
import { read, act, reply, LOOKUP_CHARS } from '../agents/tools.mjs';
import { briefing } from '../agents/briefing.mjs';
import { makeSeat } from '../agents/seat.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';

const ok = (g, id, kind, fields = {}) => {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `${id} ${kind}: ${r.why}`);
  return r;
};
const stock = (g, id, kind, n = 1) => { addGoods(g.s.agents[id], kind, n); bookGoods(g.s, 'in', 'test', kind, n); };
const rd = (g, id = 'a01', from = 1) => read(g.view(id), { audience: 'seat', seed: 'receipt-context', from });
const prompt = (r, last) => briefing(r, { call: 'round', last });
const chars = messages => messages.reduce((n, m) => n + m.content.length, 0);
const text = messages => messages.map(m => m.content).join('\n');
function lookup(g, id, fields, from = 1) {
  const r = rd(g, id, from);
  const result = act({ act: 'lookup', ...fields }, { deal: r.deal, tries: {}, apply: () => { throw new Error('lookup mutated core'); } });
  assert.equal(result.ok, true, result.why);
  assert.ok(JSON.stringify(result).length <= LOOKUP_CHARS);
  return { r, result };
}
function open(g, a = 'a01', b = 'a02') {
  ok(g, a, 'ask', { to: b }); const sd = g.events('ask').at(-1).sitdown;
  ok(g, b, 'answer', { sitdown: sd, accept: true }); return sd;
}

test('lend, repay, and a following-day reminder keep the identifiable first repayment for both seats, without inventing a debt or refusing another payment', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 200); g.grant('a02', 200);
  const sd = open(g);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', cash: 20 }, line: 'I will repay the loan tomorrow.' });
  ok(g, 'a01', 'pay', { to: 'a02', amount: 20 });
  g.night();
  const r = rd(g, 'a02');
  const repaid = reply({ actions: [{ act: 'pay', to: 'a01', amount: 20, for: 'debt' }] }, {
    deal: r.deal, tries: {}, apply: e => g.errand('a02', e.kind, e),
  }).results;
  assert.match(text(prompt(rd(g, 'a02'), repaid)), /pay \(day 2\): done; you paid a01 \$20; purpose debt; conversation not named/);
  const payment = g.events('pay').at(-1);
  g.night();
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'pay', cash: 20 }, line: 'Please repay the $20.' });
  for (const id of ['a01', 'a02']) {
    const v = g.view(id);
    assert.ok(!text(prompt(rd(g, id))).split('\n').find(line => line.startsWith('Since last night:'))?.includes('paid you $20'), 'control: repayment has left the story news window');
    assert.ok(v.me.transactions.some(e => e.n === payment.n && e.from === 'a02' && e.to === 'a01' && e.amount === 20 && e.for === 'debt'));
    const words = text(prompt(rd(g, id)));
    assert.match(words, new RegExp(`day 2, #${payment.n}: ${id === 'a01' ? 'a02 paid you' : 'you paid a01'} \\$20; purpose debt; conversation not named`));
    const p = lookup(g, id, { section: 'transactions', with: id === 'a01' ? 'a02' : 'a01' }).result.lookup;
    assert.equal(p.total, 2); assert.ok(p.rows.some(e => e.n === payment.n));
    assert.deepEqual(v.me.deals, [], 'cash-loan words create no goods deal');
  }
  ok(g, 'a02', 'pay', { to: 'a01', amount: 20, for: 'debt' });
  assert.equal(g.events('pay').filter(e => e.from === 'a02').length, 2, 'a second payment stays voluntary');
  ok(g, 'a01', 'close', { sitdown: sd });
  assert.equal(lookup(g, 'a01', { section: 'transactions', with: 'a02' }).result.lookup.total, 3, 'closing talk does not destroy visible receipts');
});

test('give receipts identify dated goods, cash, counterpart and explicit conversation; piece history remaps handles on every read', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 30); stock(g, 'a01', 'parts', 2);
  const copy = g.hand('a01', tierCopy(g.s, 'common')); const sd = open(g);
  const r = rd(g);
  const results = reply({ actions: [{ act: 'give', to: 'a02', piece: r.deal.byCopy[copy], goods: { parts: 2 }, cash: 3, sitdown: sd }] }, {
    deal: r.deal, tries: {}, apply: e => g.errand('a01', e.kind, e),
  }).results;
  const words = text(prompt(rd(g), results));
  assert.match(words, new RegExp(`give \\(day 1\\): done; you gave a02 \\$3, 2 parts, P\\d+; purpose not named; conversation ${sd}`));
  for (const id of ['a01', 'a02']) {
    const a = lookup(g, id, { section: 'transactions', sitdown: sd }, 1);
    const b = lookup(g, id, { section: 'transactions', sitdown: sd }, a.r.deal.next);
    assert.equal(a.result.lookup.rows[0].copy, a.r.deal.byCopy[copy]);
    assert.equal(b.result.lookup.rows[0].copy, b.r.deal.byCopy[copy]);
    assert.notEqual(a.result.lookup.rows[0].copy, b.result.lookup.rows[0].copy);
    assert.ok(!/\bk\d+\b/.test(JSON.stringify(b.result)));
  }
});

test('transaction lookup is player scoped, preserves SUDO masking, and follows CLEAR until the original event becomes public', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 50); stock(g, 'a02', 'sudo'); stock(g, 'a01', 'clear');
  const sd = open(g);
  ok(g, 'a02', 'give', { to: 'a01', goods: { sudo: 1 }, sitdown: sd });
  ok(g, 'a01', 'pay', { to: 'a02', amount: 7, for: 'deal', sitdown: sd });
  assert.deepEqual(lookup(g, 'a01', { section: 'transactions' }).result.lookup.rows.find(e => e.type === 'give').goods, { temp: 1 });
  assert.deepEqual(g.view('a03').me.transactions, []);
  assert.equal(lookup(g, 'a03', { section: 'transactions', with: 'a01' }).result.lookup.total, 0);
  assert.ok(!Object.hasOwn(g.view(null, 'public'), 'me'));
  ok(g, 'a01', 'take', { drug: 'clear' });
  assert.equal(lookup(g, 'a01', { section: 'transactions' }).result.lookup.total, 0);
  assert.equal(lookup(g, 'a02', { section: 'transactions' }).result.lookup.total, 2);
  assert.ok(!text(prompt(rd(g))).includes('you paid a02 $7'));
  g.night();
  assert.equal(lookup(g, 'a01', { section: 'transactions' }).result.lookup.total, 2, 'public facts return under the existing CLEAR rule');
});

function seated(g, script) {
  const clock = manualClock(); const fake = fakeModel({ script: { a01: script.map(actions => ({ json: { actions } })) }, clock });
  const seat = makeSeat({ id: 'a01', url: `http://fake.invalid${CHAT_PATH}`, fetch: fake.fetch, secret: 'context-seat', clock,
    brief: (r, memory, last, round) => briefing(r, { last, call: round === 'lock' ? 'lock' : 'round' }) });
  const call = round => seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), round,
    defaultPlay: defaultPlay(g.s, 'a01', g.s.day), validatePlay: p => checkPlay(g.s, 'a01', p, g.s.day),
    apply: e => { const r = g.errand('a01', e.kind, e); return { ...r, kind: r.events.find(e => e.type === 'invalid')?.kind }; } });
  return { fake, seat, call };
}

test('lookup before CLEAR is erased; CLEAR then lookup reads current visibility; retrieval adds no model calls and works at lock without selecting a play', async () => {
  for (const before of [true, false]) {
    const g = new Game({ n: 3 }); g.grant('a02', 20); stock(g, 'a01', 'clear');
    ok(g, 'a02', 'pay', { to: 'a01', amount: 7 });
    const query = { act: 'lookup', section: 'transactions' }, take = { act: 'take', drug: 'clear' };
    const s = seated(g, [before ? [query, take] : [take, query], [], [{ ...query }, { act: 'play', kind: 'hustle', place: 'docks' }], []]);
    try {
      const out = await s.call(1); assert.equal(out.calls, 1);
      assert.ok(!s.seat.memo.feedback.some(r => r.act === 'lookup'), 'page payloads never accumulate in feedback');
      if (before) assert.ok(!s.seat.memo.last.some(r => r.lookup), 'pre-CLEAR lookup is forgotten');
      else assert.equal(s.seat.memo.last.find(r => r.lookup).lookup.total, 0, 'post-CLEAR lookup cannot recover the stale view');
      await s.call(2);
      assert.ok(!text(s.fake.calls.at(-1).request.messages).includes('"amount":7'));
      const locked = await s.call('lock');
      assert.equal(locked.calls, 1); assert.equal(locked.play.kind, 'hustle');
      assert.equal(locked.results.find(r => r.act === 'lookup').ok, true);
      assert.equal(g.events('pay').length, 1);
      assert.equal(s.fake.calls.length, 3);
    } finally { await s.fake.close(); }
  }
});

test('a saved lookup remaps its piece in the next scheduled briefing, and a later CLEAR erases the prior lookup memo', async () => {
  const g = new Game({ n: 3 }); stock(g, 'a01', 'clear');
  const copy = g.hand('a02', tierCopy(g.s, 'common'));
  ok(g, 'a02', 'give', { to: 'a01', copy });
  const s = seated(g, [[{ act: 'lookup', section: 'transactions' }], [], [{ act: 'lookup', section: 'transactions' }], []]);
  try {
    await s.call(1);
    assert.equal(s.seat.memo.last[0].lookup.rows[0].copy, copy, 'memo keeps a canonical copy for remapping');
    const fresh = read(g.view('a01'), { audience: 'seat', seed: 'context-seat', from: s.seat.memo.next });
    await s.call(2);
    const words = text(s.fake.calls.at(-1).request.messages);
    assert.ok(words.includes(`"copy":"${fresh.deal.byCopy[copy]}"`));
    assert.ok(!/\bk\d+\b/.test(words), 'delayed retrieval page contains no raw copy id');
    await s.call(3);
    assert.ok(s.seat.memo.last.some(r => r.lookup?.total === 1));
    ok(g, 'a01', 'take', { drug: 'clear' });
    await s.call(4);
    assert.ok(!text(s.fake.calls.at(-1).request.messages).includes('"type":"give"'), 'a CLEAR learned between calls erases old lookup payloads');
    assert.deepEqual(s.seat.memo.feedback, []);
    assert.equal(s.fake.calls.length, 4, 'lookup never adds a request');
  } finally { await s.fake.close(); }
});

test('a handover after an unagreed offer expires stays a receipt and the old terms remain marked expired, with no cash due', () => {
  const g = new Game({ n: 3 }); stock(g, 'a01', 'parts');
  const sd = open(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { parts: 1 }, cash: 20, night: 1 } });
  g.night();
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 }, sitdown: sd });
  const words = text(prompt(rd(g, 'a02')));
  assert.match(words, /a01: offer \(sell \$20 night 1 1 parts, expired\)/);
  assert.ok(!words.split('\n').some(l => l.startsWith(`- ${sd}:`)), 'an expired unmatched offer is not shown as a current deal');
  const row = lookup(g, 'a02', { section: 'deals' }).result.lookup.rows[0];
  assert.equal(row.expired, true); assert.equal(row.agreed, false); assert.deepEqual(row.given, {});
  assert.match(words, /day 2, #\d+: a01 gave you 1 parts/);
});

for (const n of [30, 50]) test(`${n} seats: many real unsettled deals fit 18,000 characters and every full row is reachable with honest counts`, () => {
  const g = new Game({ n }); const goods = Object.fromEntries(GOODS.filter(k => k !== 'sudo').map(k => [k, 1]));
  for (let i = 1; i <= n; i++) g.grant(idOf(i), 1000);
  for (let i = 2; i <= n; i++) {
    if (g.s.agents.a01.msgs >= messageLimit(g.s, 'a01')) g.night();
    const id = idOf(i); for (const kind of Object.keys(goods)) stock(g, id, kind);
    const sd = open(g, id, 'a01');
    ok(g, id, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods, cash: 100 } });
    ok(g, 'a01', 'pay', { to: id, amount: 1, sitdown: sd });
    ok(g, id, 'give', { to: 'a01', goods, sitdown: sd });
  }
  const original = JSON.stringify(g.s); const base = rd(g); const messages = prompt(base);
  assert.ok(chars(messages) <= N['gap.briefing'].chars, `${chars(messages)} chars`);
  const words = text(messages); const count = words.match(/(\d+) of (\d+) shown; (\d+) omitted\. lookup section:"deals"/);
  assert.ok(count, 'bounded deal summary states exact omission count');
  assert.equal(+count[2], n - 1); assert.equal(+count[1] + +count[3], n - 1);
  assert.ok(+count[3] > 0);
  const all = [];
  for (let offset = 0; offset !== null;) {
    const { r, result } = lookup(g, 'a01', { section: 'deals', offset }); const p = result.lookup;
    assert.equal(p.total, n - 1); assert.ok(p.shown > 0 && p.shown <= 4); assert.equal(p.omitted, p.total - p.shown);
    assert.ok(!/\bk\d+\b/.test(JSON.stringify(result)));
    const paged = prompt(r, [result]); assert.ok(chars(paged) <= N['gap.briefing'].chars, `${chars(paged)} chars with page`);
    assert.ok(text(paged).includes(`Lookup deals, day ${g.s.day}: ${JSON.stringify(p)}`), 'every requested full row reaches the next normal briefing');
    all.push(...p.rows); offset = p.nextOffset;
  }
  assert.deepEqual(new Set(all.map(d => d.id)), new Set(base.result.view.me.deals.map(d => d.id)));
  assert.deepEqual(all, base.result.view.me.deals.slice().reverse(), 'complete typed rows survive pagination');
  assert.equal(JSON.stringify(g.s), original, 'read-only access changes no game fact');
});

test('lookup rejects malformed filters and caps repeated pages without creating errands', () => {
  const g = new Game({ n: 3 }); const { deal } = rd(g); const ctx = { deal, tries: {}, apply: () => { throw new Error('not an errand'); } };
  for (const fields of [{ section: 'not-built' }, { section: 'deals', offset: -1 }, { section: 'deals', offset: 'opaque-state' }, { section: 'transactions', with: 'a99' }, { section: 'deals', sitdown: 's999' }, { section: 'deals', seed: 'secret' }]) {
    assert.equal(act({ act: 'lookup', ...fields }, ctx).ok, false);
  }
  const out = reply({ actions: [{ act: 'lookup', section: 'deals' }, { act: 'lookup', section: 'transactions' }] }, ctx);
  assert.equal(out.results[0].ok, true); assert.equal(out.results[1].code, 'one-lookup');
  assert.equal(out.play, null, 'retrieval never satisfies a play selection');
});
