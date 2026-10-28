// R8c, the Claude API direct (--model-api claude): Claude seats call Anthropic's own Messages API with slime's API
// credits, touching neither OpenRouter nor his Claude Code limits. The seat builds the same request it builds for every
// API; the transport (agents/anthropic.mjs) turns it into a Messages body (the system text as a top-level `system`
// array, its fixed part cache-marked; the tools with `input_schema`; tool_choice auto; no sampling fields; the thinking
// a group asks for, in the form each Claude 5 model takes), reads `tool_use` blocks back as the tool calls the seat
// reads, sends an inspection's page as a `tool_result`, prices each call from Anthropic's published table, retries a
// 429 or 529 inside the window and stops the season on a key, credit or spend-limit error. The API is named `claude`
// (Anthropic's own name for it): `anthropic` stays an API the runner doesn't know, as two R2-12 checks require.
// Through the fake Anthropic server only (agents/fake-anthropic.mjs): nothing here reaches api.anthropic.com, and the
// key is a planted dummy. Each test imports the new modules itself, so each fails on its own before the code exists.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game } from './helpers.mjs';
import { accepted } from './r6-audit-fixtures.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { N } from '../numbers.mjs';
import { read } from '../agents/tools.mjs';
import { briefingPacket, starterBriefingPacket } from '../agents/briefing.mjs';
import { toolDefinitions, toolCallsOf } from '../agents/tool-calls.mjs';
import { manualClock, readTape } from '../agents/fake-model.mjs';
import { fakeOpenRouter } from '../agents/fake-openrouter.mjs';
import { openRouter } from '../agents/openrouter.mjs';
import { makeSeat } from '../agents/seat.mjs';

const claudeModule = () => import('../agents/anthropic.mjs');
const fakeModule = () => import('../agents/fake-anthropic.mjs');
const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8c-claude-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A planted key, easy to find: its random tail is what a leak would carry.
const TAIL = crypto.randomBytes(16).toString('hex');
const KEY = `sk-ant-api03-r8c-dummy-${TAIL}`;
const OR_KEY = 'sk-or-v1-r8c-dummy-openrouter';
const leaks = text => String(text).includes(TAIL);
const SECRET = 'r8c secret';
const URL_A = 'http://anthropic.invalid/v1/messages';
const URL_OR = 'http://openrouter.invalid/api/v1/chat/completions';
const GO = 'a test: the fake Anthropic server stands in for the endpoint';
const MARK = { type: 'ephemeral' };
const PLAY = { act: 'play', menu: 1 };
const turn = () => new Promise(resolve => setImmediate(resolve));
const read$ = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const spendOf = dir => read$(dir, 'spend.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
const filesIn = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? filesIn(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const close = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-9, `${why}: ${a} vs ${b}`);
function closing(t, fake) {
  t.after(() => fake.close());
  return fake;
}

// A game whose a01 has rent for the season and a partner with cash, the same every time it's built.
function game() {
  const g = new Game({ n: 4 });
  for (const id of ['a01', 'a02', 'a03', 'a04']) g.grant(id, 2 * N.nights * N.rent);
  return g;
}

// A seat on `kind`'s fake ('claude': the fake Anthropic server behind the Claude transport; 'openrouter': the fake
// OpenRouter behind the paid transport), on a manual clock; `call(round)` plays one call point.
async function seatOn(kind, g, script, { model, thinking = false, brief = briefingPacket, fakeOpts = {}, ...more } = {}) {
  const clock = manualClock();
  const records = [];
  let fake, send, url;
  if (kind === 'claude') {
    const { fakeAnthropic } = await fakeModule();
    const { claudeApi } = await claudeModule();
    fake = fakeAnthropic({ key: KEY, script, clock, ...fakeOpts });
    send = claudeApi({ fetch: fake.fetch, key: KEY, maxCost: 5, clock, onCall: r => records.push(r) }).fetch;
    url = URL_A;
  } else {
    fake = fakeOpenRouter({ key: OR_KEY, script, clock });
    send = openRouter({ fetch: fake.fetch, key: OR_KEY, maxCost: 5, clock, onCall: r => records.push(r) }).fetch;
    url = URL_OR;
  }
  const seat = makeSeat({
    id: 'a01', url, fetch: send, secret: SECRET, clock, model: model ?? (kind === 'claude' ? 'claude-sonnet-5-5' : 'anthropic/claude-sonnet-5.5'),
    api: kind, thinking, brief: (r, memory, last, round, context) => brief(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }), ...more,
  });
  const call = async (round = 1) => {
    const at = round === 'lock' ? { round, defaultPlay: defaultPlay(g.s, 'a01', g.s.day) } : { round, apply: e => { const r = g.errand('a01', e.kind, e); return { ok: r.ok, why: r.why, kind: r.events.find(x => x.type === 'invalid')?.kind }; } };
    let done = false;
    const p = seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), validatePlay: x => checkPlay(g.s, 'a01', x, g.s.day), ...at });
    p.then(() => { done = true; }, () => { done = true; });
    for (let i = 0; i < 1000 && !done; i++) {
      if (fake.calls.some(c => c.outcome === 'pending')) await clock.advance(N['gap.window'] * 1000);
      else await turn();
    }
    return p;
  };
  const wire = () => fake.requests.filter(q => q.method === 'POST');
  return { seat, fake, call, records, wire };
}
// A tool definition as the Messages API takes it: the same schema, under input_schema.
const asMessagesTool = t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters });

test('the Messages body (R8c): x-api-key and anthropic-version 2023-06-01, no bearer; the system text as a top-level system array whose first part is the fixed text cache-marked { type: "ephemeral" }; the tools with input_schema (the same schemas); tool_choice auto by day and at the lock; no temperature, top_p or OpenRouter field; each model\'s thinking: Sonnet 5.5 off is between_tools, Haiku 5.5 off is disabled, Opus 5.5 can\'t turn it off and gets effort low, on is adaptive at effort high (R9); max_tokens 6000 thinking, 2000 plain', async () => {
  const { CLAUDE_VERSION } = await claudeModule();
  const cases = [
    ['claude-sonnet-5-5', false, { thinking: { type: 'between_tools' }, max_tokens: 2000 }],
    ['claude-sonnet-5-5', true, { thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, max_tokens: 6000 }],
    ['claude-opus-5-5', false, { thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, max_tokens: 2000 }],
    ['claude-opus-5-5', true, { thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, max_tokens: 6000 }],
    ['claude-haiku-5-5', false, { thinking: { type: 'disabled' }, max_tokens: 2000 }],
    ['claude-haiku-5-5', true, { thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, max_tokens: 6000 }],
  ];
  for (const [model, thinking, want] of cases) {
    for (const round of [1, 'lock']) {
      const g = game();
      const plain = starterBriefingPacket(read(g.view('a01'), { audience: 'seat', seed: SECRET, from: 1 }).result, { memory: g.view('a01').me.memory, call: round === 'lock' ? 'lock' : 'round', reply: 'tools' });
      const s = await seatOn('claude', g, { a01: [{ toolCalls: toolCallsOf([PLAY]) }] }, { model, thinking, brief: starterBriefingPacket, reply: 'tools', cacheMark: true, dayToolChoice: 'auto' });
      await s.call(round);
      const [q, ...more] = s.wire();
      const why = `${model}, thinking ${thinking}, ${round}`;
      assert.equal(more.length, 0, `${why}: one request`);
      assert.equal(q.path, '/v1/messages');
      assert.equal(q.key, KEY, `${why}: the key in x-api-key`);
      assert.equal(q.version, CLAUDE_VERSION);
      assert.equal(CLAUDE_VERSION, '2023-06-01');
      assert.equal(q.auth, null, `${why}: no bearer header`);
      const b = q.body;
      assert.deepEqual(Object.keys(b).sort(), ['max_tokens', 'messages', 'model', 'system', 'tool_choice', 'tools', ...Object.keys(want).filter(k => k !== 'max_tokens')].sort(), why);
      assert.equal(b.model, model);
      for (const [k, v] of Object.entries(want)) assert.deepEqual(b[k], v, `${why}: ${k}`);
      assert.deepEqual(b.system[0], { type: 'text', text: plain.systemFixed, cache_control: MARK }, `${why}: the fixed part, marked`);
      assert.equal(b.system.map(p => p.text).join(''), plain.messages[0].content, `${why}: the same system words`);
      assert.ok(b.system.slice(1).every(p => !p.cache_control), 'only the fixed part is marked');
      assert.deepEqual(b.tools, toolDefinitions().map(asMessagesTool), `${why}: the same tools, parameters as input_schema`);
      assert.deepEqual(b.tool_choice, { type: 'auto' }, `${why}: never forced`);
      assert.deepEqual(b.messages, [{ role: 'user', content: plain.messages[1].content }], `${why}: the briefing as the one user turn`);
      // The seat's own record of the request (its tape) says auto too.
      const [line] = readTape(s.seat.tape()).values();
      assert.equal(line.request.tool_choice, 'auto', `${why}: the tape says what went out`);
      await s.fake.close();
    }
  }
  // JSON replies: plain text, with no response_format, tools or tool_choice; and the reply's JSON read as actions.
  const g = game();
  const s = await seatOn('claude', g, { a01: [{ json: { actions: [PLAY] } }] });
  const out = await s.call(1);
  const [q] = s.wire();
  assert.deepEqual(Object.keys(q.body).sort(), ['max_tokens', 'messages', 'model', 'system', 'thinking'].sort());
  assert.equal(q.body.system.length, 1);
  assert.ok(!q.body.system[0].cache_control, 'the 10-18 shape (current briefing, JSON) carries no mark');
  assert.equal(out.origin, 'model', 'the JSON text answered');
  assert.deepEqual(s.seat.record[0].attempts.map(x => x.outcome), ['reply']);
  assert.ok(s.seat.record[0].pick, 'its play kept as tonight\'s pick');
  await s.fake.close();
});

test('tool_use blocks read back into exactly what the OpenRouter path reads: the same results, plays, outcomes and record for the same script, a broken call\'s retry included', async () => {
  const [ok] = toolCallsOf([PLAY]);
  const broken = { ...ok, function: { ...ok.function, arguments: ok.function.arguments.slice(0, 4) } };
  const pay = { act: 'pay', to: 'a02', amount: 2 };
  const script = { a01: [{ toolCalls: [broken] }, { toolCalls: toolCallsOf([pay, PLAY]) }, { toolCalls: toolCallsOf([{ act: 'play', menu: 2 }]) }] };
  const runs = {};
  for (const kind of ['openrouter', 'claude']) {
    const g = game();
    const s = await seatOn(kind, g, script, { reply: 'tools' });
    const day = await s.call(1);
    const lock = await s.call('lock');
    runs[kind] = { day, lock, record: s.seat.record, events: JSON.stringify(g.log.slice(-20)), pays: g.log.filter(e => e.type === 'pay').length, wire: s.wire() };
    await s.fake.close();
  }
  const [o, c] = [runs.openrouter, runs.claude];
  assert.deepEqual(c.day, o.day, 'the day call: the same results');
  assert.deepEqual(c.lock, o.lock, 'the lock: the same play');
  assert.deepEqual(c.record, o.record, 'the same record');
  assert.equal(c.events, o.events, 'the same events');
  assert.deepEqual(c.record[0].attempts.map(a => a.outcome), ['malformed', 'reply'], 'the broken call retried once');
  assert.ok(c.pays > 0, 'the errand ran');
  assert.ok(c.wire.every(q => q.body.messages.every(m => m.role !== 'system')), 'no system turn in messages');
  assert.deepEqual(c.wire[1].body.messages.map(m => m.role), ['user'], 'the retry: one user turn, the failure named after the briefing');
  assert.match(c.wire[1].body.messages[0].content.at(-1).text, /Your last reply failed/);
});

test('an inspection\'s continuation: the call it answers goes back as the assistant\'s tool_use block (no thinking block replayed), its page as a tool_result with the same id after a fresh briefing; the results match the OpenRouter path\'s', async () => {
  const inspect = { act: 'lookup', section: 'history', mode: 'inspect', with: 'a02' };
  const pay = { act: 'pay', to: 'a02', amount: 2 };
  const runs = {};
  for (const kind of ['openrouter', 'claude']) {
    const g = game();
    accepted(g, 'a02', 'pay', { to: 'a01', amount: 7, for: 'debt' });
    const s = await seatOn(kind, g, { a01: [{ toolCalls: toolCallsOf([inspect]) }, { toolCalls: toolCallsOf([pay]) }] }, { reply: 'tools', thinking: true });
    runs[kind] = { out: await s.call(), wire: s.wire() };
    await s.fake.close();
  }
  assert.deepEqual(runs.claude.out, runs.openrouter.out, 'the same evidence, the same act after it');
  assert.equal(runs.claude.out.calls, 2);
  const [first, second] = runs.claude.wire;
  const asked = first.reply.content.find(b => b.type === 'tool_use');
  assert.ok(first.reply.content.some(b => b.type === 'thinking'), 'the thinking seat\'s reply carried a thinking block');
  const roles = second.body.messages.map(m => m.role);
  assert.deepEqual(roles, ['user', 'assistant', 'user'], 'briefing, the call, its answer');
  const [, assistant, answer] = second.body.messages;
  assert.deepEqual(assistant.content, [{ type: 'tool_use', id: asked.id, name: asked.name, input: asked.input }], 'the call as it was made, and no thinking block: the briefing before it is fresh');
  assert.equal(answer.content.length, 1);
  const [result] = answer.content;
  assert.equal(result.type, 'tool_result');
  assert.equal(result.tool_use_id, asked.id);
  assert.equal(typeof result.content, 'string');
  assert.equal(JSON.parse(result.content).act, 'lookup');
  assert.ok(result.content.includes('"amount":7'), 'the page');
  assert.deepEqual(second.body.system, first.body.system, 'the same system text');
});

test('spend in dollars from tokens, by Anthropic\'s published table (10-19): Sonnet 5.5 $2 / $2.50 / $0.10 / $10, Opus 5.5 $4 / $5 / $0.20 / $20, Haiku 5.5 $0.10 / $0.125 / $0.01 / $0.50 up to 100K prompt tokens (and $0.50 / $0.625 / $0.05 / $2.50 over); the 10-18 Sonnet call prices at $0.0255; an unpriced model has none; each request\'s spend record carries its cost and every token count, thinking billed as output, and a marked prefix is written once and read after', async () => {
  const { priceOf } = await claudeModule();
  const M = 1e6;
  const all = { input_tokens: M, cache_creation_input_tokens: M, cache_read_input_tokens: M, output_tokens: M };
  close(priceOf('claude-sonnet-5-5', all), 2 + 2.5 + 0.1 + 10, 'Sonnet 5.5');
  close(priceOf('claude-opus-5-5', all), 4 + 5 + 0.2 + 20, 'Opus 5.5');
  close(priceOf('claude-haiku-5-5', all), 0.5 + 0.625 + 0.05 + 2.5, 'Haiku 5.5 over 100K');
  const small = { input_tokens: 50000, cache_creation_input_tokens: 20000, cache_read_input_tokens: 30000, output_tokens: 1000 };
  close(priceOf('claude-haiku-5-5', small), (50000 * 0.1 + 20000 * 0.125 + 30000 * 0.01 + 1000 * 0.5) / M, 'Haiku 5.5 at 100K');
  close(priceOf('claude-sonnet-5-5', { input_tokens: 8003, output_tokens: 954 }), 0.025546, 'the 10-18 Sonnet call');
  for (const m of ['claude-fable-5-1', 'anthropic/claude-sonnet-5.5', 'test/model']) assert.equal(priceOf(m, all), null, `${m}: no price`);
  // Through the transport: two calls of a thinking seat, its fixed part marked.
  const g = game();
  const s = await seatOn('claude', g, { a01: [{ toolCalls: toolCallsOf([PLAY]) }, { toolCalls: toolCallsOf([PLAY]) }] }, { reply: 'tools', thinking: true, brief: starterBriefingPacket, cacheMark: true });
  await s.call(1);
  await s.call(2);
  const [a, b] = s.records;
  for (const r of [a, b]) {
    assert.deepEqual(Object.keys(r.usage).sort(), ['cache_creation_input_tokens', 'cache_read_input_tokens', 'input_tokens', 'output_tokens']);
    close(r.cost, priceOf('claude-sonnet-5-5', r.usage), `call ${r.call}: priced from its usage`);
    assert.equal(r.provider, 'anthropic');
    assert.equal(r.model, 'claude-sonnet-5-5');
    assert.equal(r.tokens.in, r.usage.input_tokens + r.usage.cache_creation_input_tokens + r.usage.cache_read_input_tokens, 'tokens in: the whole prompt');
    assert.equal(r.tokens.out, r.usage.output_tokens);
    assert.ok(r.tokens.reasoning > 0 && r.tokens.reasoning < r.tokens.out, 'thinking counted inside output');
    assert.equal(r.tokens.cached, r.usage.cache_read_input_tokens);
    assert.equal(r.tokens.cacheWrite, r.usage.cache_creation_input_tokens);
  }
  assert.ok(a.usage.cache_creation_input_tokens > 0 && a.usage.cache_read_input_tokens === 0, 'the first call writes the prefix');
  assert.ok(b.usage.cache_read_input_tokens > 0 && b.usage.cache_creation_input_tokens === 0, 'the second reads it');
  // The reply as the seat reads it carries the cost, as OpenRouter's does.
  const lines = [...readTape(s.seat.tape()).values()];
  close(lines[0].reply.body.usage.cost, a.cost, 'the taped reply\'s cost');
  await s.fake.close();
});

// A chat call as the seat sends it, at the transport.
const chatBody = { model: 'claude-sonnet-5-5', messages: [{ role: 'system', content: 'the rules' }, { role: 'user', content: 'the briefing' }], max_tokens: 2000, thinking: { type: 'between_tools' } };
const chatInit = (seat, call, signal) => ({ method: 'POST', body: JSON.stringify(chatBody), headers: { 'content-type': 'application/json', 'x-seat': seat, 'x-call': String(call) }, ...(signal ? { signal } : {}) });
async function onClock(clock, p) {
  let done = false;
  p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 2000 && !done; i++) {
    await turn();
    if (!done && clock.pending()) await clock.advance(1000);
  }
  return p;
}

test('failures: a 429 waits its retry-after and a 529 (overloaded) the default 6 s, up to 3 retries inside the window; a 401 or 403 stops the season as a bad key, a 402, a "credit balance is too low" 400, a spend-limit 400 and the tier spend-cap 429 as out of credit, with no retry; any other 4xx goes back to the seat as it came, typed in the spend record; no error carries the key', async t => {
  const { claudeApi } = await claudeModule();
  const { fakeAnthropic } = await fakeModule();
  const script = () => ({ json: { actions: [] } });
  // Waits, on the clock.
  {
    const clock = manualClock();
    const errors = (seat, call, attempt) => {
      if (seat === 'a01' && attempt === 1) return { status: 429, retryAfter: 2 };
      if (seat === 'a02' && attempt <= 2) return { status: 529 };
      if (seat === 'a03') return { status: 429 };
      return undefined;
    };
    const fake = closing(t, fakeAnthropic({ key: KEY, errors, script }));
    const at = [];
    const records = [];
    const paid = claudeApi({ fetch: (u, i) => { at.push(clock.now()); return fake.fetch(u, i); }, key: KEY, maxCost: 1, clock, onCall: r => records.push(r) });
    assert.equal((await onClock(clock, paid.fetch(URL_A, chatInit('a01', 1)))).status, 200);
    assert.deepEqual(at, [0, 2000], 'the 429\'s retry-after: 2 s');
    at.length = 0;
    let from = clock.now();
    assert.equal((await onClock(clock, paid.fetch(URL_A, chatInit('a02', 1)))).status, 200);
    assert.deepEqual(at.map(x => x - from), [0, 6000, 18000], 'a 529 with no retry-after: 6 then 12 s');
    at.length = 0;
    from = clock.now();
    const gave = await onClock(clock, paid.fetch(URL_A, chatInit('a03', 1)));
    assert.equal(gave.status, 429, 'past three retries the 429 goes back');
    assert.deepEqual(at.map(x => x - from), [0, 6000, 18000, 36000]);
    assert.equal(paid.halted, null, 'a rate limit is no stop');
    assert.deepEqual(records.filter(r => r.status === 429 || r.status === 529).map(r => r.error.type).sort(), [...Array(5).fill('rate_limit_error'), 'overloaded_error', 'overloaded_error'].sort());
    // The window ends a wait.
    const ctl = new AbortController();
    const cut = paid.fetch(URL_A, chatInit('a03', 2, ctl.signal));
    cut.catch(() => {});
    for (let i = 0; i < 20 && !fake.requests.some(q => q.seat === 'a03' && q.call === 2); i++) await turn();
    await clock.advance(1000);
    ctl.abort();
    await assert.rejects(cut);
    await clock.advance(60000);
    assert.equal(fake.requests.filter(q => q.seat === 'a03' && q.call === 2).length, 1, 'nothing asked after the window');
  }
  // The stops: each on its first answer, no retry, and no request after it.
  const stops = [
    [{ status: 401, type: 'authentication_error', message: `invalid x-api-key ${KEY}` }, 'key'],
    [{ status: 403, type: 'permission_error', message: 'Your API key does not have permission to use the specified resource.' }, 'key'],
    [{ status: 402, type: 'billing_error', message: 'There is an issue with your billing.' }, 'credit'],
    [{ status: 400, type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' }, 'credit'],
    [{ status: 400, type: 'invalid_request_error', message: 'You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.' }, 'credit'],
    [{ status: 429, type: 'rate_limit_error', message: 'You have reached your API usage limits.', errorCode: 'enforced_spend_limit_reached' }, 'credit'],
  ];
  for (const [error, kind] of stops) {
    const clock = manualClock();
    const fake = closing(t, fakeAnthropic({ key: KEY, errors: () => error, script }));
    const records = [];
    let heard = null;
    const paid = claudeApi({ fetch: fake.fetch, key: KEY, maxCost: 1, clock, onCall: r => records.push(r), onHalt: e => { heard = e; } });
    const res = await onClock(clock, paid.fetch(URL_A, chatInit('a01', 1)));
    assert.equal(res.status, error.status);
    assert.equal(paid.halted?.halt, kind, `${error.status} ${error.message.slice(0, 30)}: ${kind}`);
    assert.ok(!leaks(paid.halted.message) && !leaks(await res.text()), 'no key in the stop or the reply');
    assert.equal(fake.requests.length, 1, 'no retry');
    await assert.rejects(paid.fetch(URL_A, chatInit('a01', 2)), e => !leaks(e.message));
    assert.equal(fake.requests.length, 1, 'nothing after the stop');
    assert.equal(heard, paid.halted, 'the runner hears of it');
    assert.equal(records[0].error.type, error.type);
  }
  // Any other 4xx: back to the seat as it came, typed, the season going on.
  for (const error of [{ status: 400, type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' }, { status: 413, type: 'request_too_large', message: 'Request exceeds the maximum allowed number of bytes.' }, { status: 404, type: 'not_found_error', message: 'model: claude-x' }]) {
    const clock = manualClock();
    const fake = closing(t, fakeAnthropic({ key: KEY, errors: (s, c) => (c === 1 ? error : undefined), script }));
    const records = [];
    const paid = claudeApi({ fetch: fake.fetch, key: KEY, maxCost: 1, clock, onCall: r => records.push(r) });
    const res = await onClock(clock, paid.fetch(URL_A, chatInit('a01', 1)));
    assert.equal(res.status, error.status);
    assert.equal(paid.halted, null, `${error.status}: no stop`);
    assert.equal(fake.requests.length, 1, `${error.status}: no retry`);
    assert.deepEqual([records[0].status, records[0].error.type], [error.status, error.type]);
    assert.equal((await onClock(clock, paid.fetch(URL_A, chatInit('a01', 2)))).status, 200, 'the next call goes out');
  }
});

test('--max-cost stops a Claude season by the priced tally, as SIGINT does, with no request after it; a resume with a higher cap finishes; the run folder says the Console\'s spend limit is the hard stop; a Claude model with no price refuses to start, before anything is written or called', async t => {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const { fakeAnthropic } = await fakeModule();
  const { priceOf } = await claudeModule();
  const fake = closing(t, fakeAnthropic({ key: KEY, script: () => ({ toolCalls: toolCallsOf([PLAY]) }) }));
  const SPEC = [{ model: 'claude-sonnet-5-5', seats: 1, thinking: true }, { model: 'claude-haiku-5-5', seats: 1, thinking: false }];
  const said = [];
  const opts = more => ({
    seed: 418, rule: 'A', outDir: path.join(tmp, 'cap'), mix: { ...CASTS['models-canny'], models: 2 }, url: URL_A, fetch: fake.fetch, go: GO,
    key: KEY, api: 'claude', seatModels: SPEC, briefing: 'starter', reply: 'tools', say: l => said.push(l), ...more,
  });
  await assert.rejects(runModelSeason(opts({ maxCost: 0.03 })), e => e.halt === 'cap' && !leaks(e.message), 'the cap stops it');
  const dir = path.join(tmp, 'cap', '418-A');
  const stopped = spendOf(dir);
  const total = stopped.reduce((s, x) => s + x.cost, 0);
  assert.ok(total >= 0.03, `stopped at $${total}`);
  assert.equal(fake.requests.length, stopped.length, 'a spend line a request, and none after the stop');
  for (const x of stopped) close(x.cost, priceOf(x.model, x.usage), `${x.seat}#${x.call}`);
  assert.ok(said.some(l => /Console/.test(l) && /spend limit/.test(l)), 'said: the Console\'s spend limit is the hard stop');
  const r = await runModelSeason(opts({ maxCost: 5, resume: true }));
  assert.ok(r.metrics, 'resumed, it finished');
  const ck = JSON.parse(read$(dir, 'checkpoint.json'));
  assert.equal(ck.models.api, 'claude');
  assert.match(ck.models.billing, /spend limit/, 'the run folder notes the hard stop');
  const lines = spendOf(dir);
  for (const row of r.metrics.byModel) {
    const own = lines.filter(x => row.seats.includes(x.seat));
    assert.ok(row.spend.cost > 0 && row.spend.costed === own.filter(x => Number.isFinite(x.cost)).length, `${row.model}: its costed requests`);
    close(row.spend.cost, own.reduce((t, x) => t + (x.cost || 0), 0), `${row.model}: its row is its spend`);
  }
  // Unpriced: a request the stop aborted in flight, and the fake model's refusal (409, "asked twice") when the resume
  // asks that call again; every other request carries its price.
  assert.ok(lines.every(x => Number.isFinite(x.cost) || x.why === 'aborted' || x.status === 409), 'every answered request priced');
  assert.ok(read$(dir, 'report.md').includes('| claude-sonnet-5-5, thinking'));
  for (const f of filesIn(dir)) assert.ok(!leaks(fs.readFileSync(f, 'utf8')), `${path.basename(f)} holds no key`);
  // No price: refused.
  const asked = fake.requests.length;
  const out = path.join(tmp, 'unpriced');
  await assert.rejects(runModelSeason({ ...opts({ maxCost: 1 }), outDir: out, seatModels: [{ model: 'claude-fable-5-1', seats: 2 }] }), e => e.refused && /no price/.test(e.message));
  assert.equal(fs.existsSync(out), false, 'nothing written');
  assert.equal(fake.requests.length, asked, 'nothing called');
});

test('mixing in one season: a --seat-models group names its API ("api": "claude") and its endpoint, so its seats call the Claude API with its own key while the others call OpenRouter with theirs, under one --max-cost; neither key reaches the other endpoint; the spend record and the rows by model hold both', async t => {
  const { runModelSeason, seatModelsRefusal } = await runnerModule();
  const { CASTS } = await botsModule();
  const { fakeAnthropic } = await fakeModule();
  const claude = closing(t, fakeAnthropic({ key: KEY, script: () => ({ toolCalls: toolCallsOf([PLAY]) }) }));
  const or = closing(t, fakeOpenRouter({ key: OR_KEY, script: () => ({ toolCalls: toolCallsOf([PLAY]) }), cost: () => 0.002 }));
  const SPEC = [{ model: 'openai/gpt-6-luna', seats: 2, thinking: true }, { model: 'claude-sonnet-5-5', seats: 1, thinking: false, api: 'claude', url: URL_A }];
  const fetch = (u, init) => (new URL(u).host === 'anthropic.invalid' ? claude.fetch(u, init) : or.fetch(u, init));
  const opts = more => ({
    seed: 418, rule: 'A', outDir: path.join(tmp, 'mixed'), mix: { ...CASTS['models-canny'], models: 3 }, url: URL_OR, fetch, go: GO,
    key: OR_KEY, api: 'openrouter', groupKeys: [null, KEY], seatModels: SPEC, briefing: 'starter', reply: 'tools', say: () => {}, ...more,
  });
  await assert.rejects(runModelSeason(opts({ maxCost: 0.03 })), e => e.halt === 'cap', 'one cap for both');
  const r = await runModelSeason(opts({ maxCost: 5, resume: true }));
  assert.ok(r.metrics);
  const dir = path.join(tmp, 'mixed', '418-A');
  const ck = JSON.parse(read$(dir, 'checkpoint.json'));
  const claudeSeats = Object.keys(ck.models.seatOf).filter(id => ck.models.seatOf[id] === 1);
  assert.equal(claudeSeats.length, 1);
  assert.ok(claude.requests.length > 0 && claude.requests.every(q => claudeSeats.includes(q.seat) && q.key === KEY && q.auth === null), 'the Claude seat, and only it, at the Claude API, with its key');
  assert.ok(or.requests.length > 0 && or.requests.every(q => !claudeSeats.includes(q.seat) && q.auth === `Bearer ${OR_KEY}`), 'the others at OpenRouter, with theirs');
  assert.ok(!JSON.stringify(or.requests).includes(TAIL), 'the Claude key never reached OpenRouter');
  const spend = spendOf(dir);
  assert.deepEqual([...new Set(spend.map(x => x.provider).filter(Boolean))].sort(), ['FakeProvider', 'anthropic'], 'both endpoints billed into one record');
  const rows = Object.fromEntries(r.metrics.byModel.map(x => [x.model, x]));
  for (const g of SPEC) {
    const lines = spend.filter(x => rows[g.model].seats.includes(x.seat));
    close(rows[g.model].spend.cost, lines.reduce((s, x) => s + x.cost, 0), `${g.model}: its row is its spend`);
  }
  for (const f of filesIn(dir)) assert.ok(!leaks(fs.readFileSync(f, 'utf8')), `${path.basename(f)} holds no key`);
  // A group's API and endpoint, checked.
  assert.match(seatModelsRefusal([{ model: 'm', seats: 1, api: 'anthropic' }]), /"api" is "claude"/);
  assert.match(seatModelsRefusal([{ model: 'm', seats: 1, url: URL_A }]), /url and keyFile go with a group's "api"/);
  assert.match(seatModelsRefusal([{ model: 'claude-sonnet-5-5', seats: 1, api: 'claude', provider: { order: ['x'] } }]), /provider routing goes with --model-api openrouter/);
  assert.equal(seatModelsRefusal(SPEC, { url: URL_OR, api: 'openrouter' }), null);
});

function cli(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [runner, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

test('a whole season on the command line, on the fake Anthropic server over HTTP: seed 418, the starter version with tools, two Claude seats, --model-api claude with a key file; it ends with spend rows; and the planted key is in no tape, spend record, log, run-folder file or child-process argument', async t => {
  const { fakeAnthropic } = await fakeModule();
  const { priceOf } = await claudeModule();
  const fake = closing(t, fakeAnthropic({ key: KEY, script: () => ({ toolCalls: toolCallsOf([PLAY]) }) }));
  const { url } = await fake.listen();
  const keyFile = path.join(tmp, 'claude.key');
  fs.writeFileSync(keyFile, `${KEY}\n`);
  const out = path.join(tmp, 'cli');
  const spec = [{ model: 'claude-sonnet-5-5', seats: 1, thinking: false }, { model: 'claude-haiku-5-5', seats: 1, thinking: true }];
  const args = ['--seed', '418', '--rule', 'A', '--cast', 'models-canny', '--briefing', 'starter', '--reply', 'tools', '--seat-models', JSON.stringify(spec),
    '--model-url', url, '--go', GO, '--model-api', 'claude', '--model-key-file', keyFile, '--max-cost', '5', '--quiet', '--out', out];
  const r = await cli(args);
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(out, '418-A');
  assert.ok(JSON.parse(read$(dir, 'result.json')), 'the season finished');
  assert.match(r.stdout, /\[spend\] \$\d+\.\d{4} of \$5 · \d+ calls · final · claude-sonnet-5-5 \$\d+\.\d{4}, claude-haiku-5-5 \$\d+\.\d{4}/);
  assert.match(r.stdout, /Console/);
  const spend = spendOf(dir);
  assert.equal(spend.length, fake.requests.length, 'a spend line a request');
  for (const x of spend) close(x.cost, priceOf(x.model, x.usage), `${x.seat}#${x.call}`);
  const report = read$(dir, 'report.md');
  for (const g of spec) assert.match(report, new RegExp(`\\| ${g.model}${g.thinking ? ', thinking' : ''} \\| tools \\|[^\\n]*\\$\\d+\\.\\d{4} \\(`), `${g.model}: its row with its spend`);
  assert.ok(fake.requests.every(q => q.key === KEY && q.version === '2023-06-01'));
  for (const f of filesIn(out)) assert.ok(!leaks(fs.readFileSync(f, 'utf8')), `${path.relative(out, f)} holds no key`);
  assert.ok(!leaks(r.stdout) && !leaks(r.stderr), 'no key in the logs');
  assert.ok(!args.some(leaks), 'no key in the child\'s arguments');
});

test('the command line\'s guards for the Claude API (exit 2, nothing written or called): a model with no price; a group\'s API other than claude; and the usage names --model-api claude', async t => {
  const { fakeAnthropic } = await fakeModule();
  const fake = closing(t, fakeAnthropic({ key: KEY, script: () => ({ json: { actions: [] } }) }));
  const { url } = await fake.listen();
  const keyFile = path.join(tmp, 'guard.key');
  fs.writeFileSync(keyFile, `${KEY}\n`);
  const base = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '2', '--quiet', '--model-url', url, '--go', GO, '--model-api', 'claude', '--model-key-file', keyFile, '--max-cost', '1'];
  for (const [i, [more, why]] of [
    [['--model', 'claude-fable-5-1'], /no price for claude-fable-5-1/],
    [['--seat-models', JSON.stringify([{ model: 'claude-sonnet-5-5', seats: 2, api: 'local' }])], /"api" is "claude"/],
  ].entries()) {
    const out = path.join(tmp, `cli-guard-${i}`);
    const r = await cli([...base, ...more, '--out', out]);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, why);
    assert.equal(fs.existsSync(out), false);
    assert.ok(!leaks(r.stdout + r.stderr));
  }
  assert.equal(fake.requests.length, 0, 'nothing reached the endpoint');
  const { stderr } = await cli(['--seed', 'x']);
  assert.ok(stderr.includes('--model-api openrouter|claude'), 'the usage names it');
});
