// R8, native tool calls at the seat (GAME.md §17, §18, §33): a seat in tools mode sends the game's actions as `tools`
// (tool-calls.mjs), with tool_choice "required" where the API takes it, and reads `message.tool_calls` back into the
// actions a JSON reply sends, so the rules, the refusals and the records are the JSON path's. A reply with no tool call,
// or whose calls' arguments aren't JSON, is malformed under the one-retry rule; an inspection's page comes back as a
// `tool` message answering its call. JSON stays the default. Through the fake servers only, for the local API (the fake
// model) and OpenRouter's (the fake OpenRouter behind the paid transport): nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { accepted } from './r6-audit-fixtures.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { N } from '../numbers.mjs';
import { read } from '../agents/tools.mjs';
import { briefingPacket } from '../agents/briefing.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';
import { fakeOpenRouter } from '../agents/fake-openrouter.mjs';
import { openRouter } from '../agents/openrouter.mjs';

const seatModule = () => import('../agents/seat.mjs');
const toolsModule = () => import('../agents/tool-calls.mjs');
const SECRET = 'r8 tools secret';
const KEY = 'sk-or-v1-r8-dummy-key';
const LOCAL = `http://fake.invalid${CHAT_PATH}`;
const OR = 'http://openrouter.invalid/api/v1/chat/completions';
const APIS = ['local', 'openrouter'];
const turn = () => new Promise(resolve => setImmediate(resolve));

// A game whose a01 has rent for the season and a partner with cash, the same every time it's built.
function game() {
  const g = new Game({ n: 4 });
  for (const id of ['a01', 'a02', 'a03', 'a04']) g.grant(id, 2 * N.nights * N.rent);
  return g;
}

// A seat on the API's fake, briefed by the current briefing, on a manual clock; `call(round)` plays one call point.
async function seatOn(api, g, script, more = {}) {
  const { makeSeat } = await seatModule();
  const clock = manualClock();
  const fake = api === 'local' ? fakeModel({ script, clock }) : fakeOpenRouter({ key: KEY, script, clock });
  const send = api === 'local' ? fake.fetch : openRouter({ fetch: fake.fetch, key: KEY, maxCost: 5, clock }).fetch;
  const seat = makeSeat({
    id: 'a01', url: api === 'local' ? LOCAL : OR, fetch: send, secret: SECRET, clock, model: 'test/model', api,
    brief: (r, memory, last, round, context) => briefingPacket(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }),
    ...more,
  });
  const sent = [];
  const call = async (round = 1) => {
    const at = round === 'lock' ? { round, defaultPlay: defaultPlay(g.s, 'a01', g.s.day) } : { round, apply: e => { sent.push(e); const r = g.errand('a01', e.kind, e); return { ok: r.ok, why: r.why, kind: r.events.find(x => x.type === 'invalid')?.kind }; } };
    let done = false;
    const p = seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), validatePlay: x => checkPlay(g.s, 'a01', x, g.s.day), ...at });
    p.then(() => { done = true; }, () => { done = true; });
    for (let i = 0; i < 1000 && !done; i++) {
      if (fake.calls.some(c => c.outcome === 'pending')) await clock.advance(N['gap.window'] * 1000);
      else await turn();
    }
    return p;
  };
  const requests = () => fake.calls.map(c => c.request);
  return { seat, fake, call, sent, requests };
}

// What a call point did, without the words that say how it was read (the failure notes differ by mode, by design).
const acted = out => ({ origin: out.origin, play: out.play, results: out.results.filter(r => !['malformed', 'cutoff'].includes(r.code)) });

test('a tools-mode request carries the generated tools and tool_choice "required" (a thinking seat\'s "auto"), and no response_format; JSON mode stays the default, with no tools', async () => {
  const { toolDefinitions } = await toolsModule();
  for (const api of APIS) {
    for (const thinking of [false, true]) {
      const g = game();
      const s = await seatOn(api, g, { a01: [{ toolCalls: [] }] }, { reply: 'tools', thinking });
      await s.call();
      const [body] = s.requests();
      assert.deepEqual(body.tools, toolDefinitions(), `${api}: the tools, as generated`);
      assert.equal(body.tool_choice, thinking ? 'auto' : 'required', `${api}, thinking ${thinking}: tool_choice`);
      assert.ok(!('response_format' in body), `${api}: no JSON reply format beside the tools`);
      if (api === 'local') assert.deepEqual(body.chat_template_kwargs, { enable_thinking: thinking });
      else assert.deepEqual(body.usage, { include: true });
      assert.ok(!body.messages[0].content.includes('Reply JSON {"actions"'), `${api}: the system text drops the JSON button list`);
      await s.fake.close();
    }
    const g = game();
    const s = await seatOn(api, g, { a01: [{ json: { actions: [] } }] });
    await s.call();
    const [body] = s.requests();
    assert.ok(!('tools' in body) && !('tool_choice' in body), `${api}: by default no tools`);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    await s.fake.close();
  }
  const { makeSeat } = await seatModule();
  assert.throws(() => makeSeat({ id: 'a01', url: LOCAL, fetch: () => {}, secret: SECRET, brief: () => [], reply: 'xml' }), /reply/);
});

test('several tool calls in one reply map to the same actions, refusals, records and state as the equivalent JSON reply, on both APIs, by day and at the lock', async () => {
  const { toolCallsOf } = await toolsModule();
  const laylow = read(game().view('a01'), { audience: 'seat', seed: SECRET, from: 1 }).deal.menu.find(l => l.kind === 'laylow').n;
  const day = [
    { act: 'pay', to: 'a02', amount: 3, for: 'gift' },
    { act: 'teleport', place: 'docks' },
    { act: 'give', to: 'a02', goods: { chems: 1 } },
    { act: 'play', menu: 999 },
    { act: 'play', menu: laylow, reason: 'quiet' },
    { act: 'play', kind: 'laylow' },
    { act: 'shop', item: 'chems', units: 2, max: 80 },
    { act: 'crew_form', name: 'crew words' },
    { act: 'say', sitdown: 'no-such', say: 'offer' },
  ];
  const lock = [{ act: 'pay', to: 'a02', amount: 1 }, { act: 'play', kind: 'hustle', place: 'docks' }];
  for (const api of APIS) {
    const runs = {};
    for (const reply of ['json', 'tools']) {
      const g = game();
      const script = reply === 'json' ? { a01: [{ json: { actions: day } }, { json: { actions: lock } }] } : { a01: [{ toolCalls: toolCallsOf(day) }, { toolCalls: toolCallsOf(lock) }] };
      const s = await seatOn(api, g, script, reply === 'json' ? {} : { reply: 'tools' });
      const d = await s.call(1);
      const l = await s.call('lock');
      runs[reply] = { d, l, sent: s.sent, record: s.seat.record, cash: g.s.agents.a01.cash, log: g.log.length, memo: { pick: s.seat.memo.pick, tries: s.seat.memo.tries } };
      await s.fake.close();
    }
    const [j, t] = [runs.json, runs.tools];
    assert.deepEqual(t.d, j.d, `${api}: by day, the same results`);
    assert.deepEqual(t.l, j.l, `${api}: at the lock, the same play and results`);
    assert.deepEqual(t.sent, j.sent, `${api}: the same errands reached the rules`);
    assert.deepEqual(t.record, j.record, `${api}: the same record`);
    assert.deepEqual([t.cash, t.log, t.memo], [j.cash, j.log, j.memo], `${api}: the same state after`);
    assert.ok(j.d.results.some(r => r.code === 'action') && j.d.results.some(r => r.code === 'off-menu') && j.d.results.some(r => r.code === 'one-play'), 'the reply had refusals of each kind');
    assert.equal(j.l.play.kind, 'hustle');
  }
});

test('a tool call whose arguments aren\'t JSON makes the reply malformed: the whole calls are read, as a JSON reply\'s whole actions are, and it says so; with no whole call it is retried once, by a message that asks for tool calls', async () => {
  const { toolCallsOf } = await toolsModule();
  for (const api of APIS) {
    const [good] = toolCallsOf([{ act: 'pay', to: 'a02', amount: 2 }]);
    const broken = { id: 'call_9', type: 'function', function: { name: 'money', arguments: '{"act": "pay", "to": "a0' } };
    const g = game();
    const s = await seatOn(api, g, { a01: [{ toolCalls: [good, broken] }] }, { reply: 'tools' });
    const out = await s.call();
    const j = game();
    const sj = await seatOn(api, j, { a01: [{ content: '{"actions": [{"act": "pay", "to": "a02", "amount": 2}, {"act": "pay", "to": "a0' }] });
    const jout = await sj.call();
    assert.deepEqual(acted(out), acted(jout), `${api}: the same actions read as the JSON reply's whole ones`);
    assert.deepEqual([out.origin, out.outcome, out.calls], ['model', 'malformed', 1]);
    assert.ok(out.results.some(r => r.code === 'malformed' && /JSON/.test(r.why)), 'it says the reply was malformed');
    assert.equal(g.events('pay').length, j.events('pay').length);
    await s.fake.close();
    await sj.fake.close();

    const h = game();
    const r = await seatOn(api, h, { a01: [{ toolCalls: [broken] }, { toolCalls: [good] }] }, { reply: 'tools' });
    const again = await r.call();
    assert.deepEqual([again.origin, again.outcome, again.calls], ['model', 'reply', 2], `${api}: retried once, then answered`);
    const retry = r.requests()[1].messages.at(-1);
    assert.equal(retry.role, 'user');
    assert.match(retry.content, /^Your last reply failed: .*JSON.*\. Reply again by calling the tools\.$/);
    assert.deepEqual(r.requests()[1].tools, r.requests()[0].tools, 'the retry carries the tools too');
    await r.fake.close();
  }
});

test('a reply with no tool call is malformed: text alone, even JSON text or tool-call tags, gets the one retry; at the lock, two such replies fall back to the default play', async () => {
  for (const api of APIS) {
    const g = game();
    const s = await seatOn(api, g, { a01: [
      { content: '<invoke name="play"><parameter name="menu">1</parameter></invoke>' },
      { content: '{"actions": [{"act": "play", "menu": 1}]}' },
    ] }, { reply: 'tools' });
    const lock = await s.call('lock');
    assert.deepEqual([lock.origin, lock.outcome, lock.calls], ['default', 'malformed', 2], `${api}: no call twice: the default play`);
    assert.deepEqual(lock.play, defaultPlay(g.s, 'a01', g.s.day));
    assert.ok(lock.results.filter(r => r.code === 'malformed').every(r => /no tool/.test(r.why)));
    assert.match(s.requests()[1].messages.at(-1).content, /Reply again by calling the tools, with tonight's play\.$/);
    await s.fake.close();
  }
});

test('an inspection by tool call: its page comes back as a `tool` message answering the call, after the call itself, under a fresh briefing; the continuation then acts, and every result matches the JSON path\'s', async () => {
  const { toolCallsOf } = await toolsModule();
  const inspect = { act: 'lookup', section: 'history', mode: 'inspect', with: 'a02' };
  const pay = { act: 'pay', to: 'a02', amount: 2 };
  for (const api of APIS) {
    const runs = {};
    for (const reply of ['json', 'tools']) {
      const g = game();
      accepted(g, 'a02', 'pay', { to: 'a01', amount: 7, for: 'debt' });
      accepted(g, 'a02', 'ask', { to: 'a01', line: 'R8-WORDS <close>' });
      const script = reply === 'json' ? { a01: [{ json: { actions: [inspect] } }, { json: { actions: [pay] } }] }
        : { a01: [{ toolCalls: toolCallsOf([inspect]) }, { toolCalls: toolCallsOf([pay]) }] };
      const s = await seatOn(api, g, script, reply === 'json' ? {} : { reply: 'tools' });
      const out = await s.call();
      runs[reply] = { out, requests: s.requests(), pays: g.events('pay').length };
      await s.fake.close();
    }
    const [j, t] = [runs.json, runs.tools];
    assert.deepEqual(t.out, j.out, `${api}: the same evidence, the same act after it`);
    assert.equal(t.pays, j.pays);
    assert.deepEqual([t.out.calls, t.out.origin], [2, 'model']);
    const [first, second] = t.requests;
    const assistant = second.messages.at(-2);
    const tool = second.messages.at(-1);
    assert.deepEqual(second.messages.slice(0, 2).map(m => m.role), ['system', 'user'], `${api}: a fresh briefing first`);
    assert.equal(assistant.role, 'assistant');
    assert.deepEqual(assistant.tool_calls, toolCallsOf([inspect]), 'the call it answers, as it was made');
    assert.equal(tool.role, 'tool');
    assert.equal(tool.tool_call_id, assistant.tool_calls[0].id);
    const page = JSON.parse(tool.content);
    assert.equal(page.act, 'lookup');
    assert.equal(page.lookup.section, 'history');
    assert.ok(tool.content.includes('"amount":7'), 'the page is in the tool message');
    assert.ok(!second.messages[1].content.includes('Lookup history'), 'and not again in the briefing');
    assert.ok(!tool.content.includes('R8-WORDS') && !/[<>]/.test(tool.content), 'no agent\'s words outside the speech block');
    assert.match(second.messages[1].content, /<speech>[\s\S]*R8-WORDS \\u003cclose\\u003e[\s\S]*<\/speech>/, 'the words it asked for, quoted in the speech block');
    assert.deepEqual(second.tools, first.tools);
    // The JSON path's continuation is a fresh briefing alone, as before.
    assert.deepEqual(j.requests[1].messages.map(m => m.role), ['system', 'user']);
  }
});
