// R2-12, the paid endpoint: the R2 model season calls OpenRouter safely, so a cloud model can play the season the local
// model played, reading exactly what it read. Only the transport changes. The key is added to each request as it goes
// out, so the seat, the tape, the checkpoint and the config never hold it; the body carries OpenRouter's fields beside
// the same messages; every response's cost counts against a cap; the season stops, as SIGINT stops it, on the cap, an
// empty account or a refused key; a 429 waits on the clock passed in; and a preflight reads the account's balance and
// the key's limit before the first call. Nothing here reaches the network: every call goes to the fake OpenRouter
// (agents/fake-openrouter.mjs), in-process or on a port the system picks, and every key is a dummy. Each test imports
// what it needs itself, so each fails on its own before the code exists.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { N } from '../numbers.mjs';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { defaultPlay } from '../rules/plays.mjs';
import { briefing } from '../agents/briefing.mjs';
import { fakeModel, manualClock, readTape, CHAT_PATH } from '../agents/fake-model.mjs';

const fakeModule = () => import('../agents/fake-openrouter.mjs');
const paidModule = () => import('../agents/openrouter.mjs');
const seatModule = () => import('../agents/seat.mjs');
const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-openrouter-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
// What was open before any test ran: the file must leave its process as it found it.
const OPEN_AT_START = process.getActiveResourcesInfo();

// A dummy key, easy to find: its random tail is what a leak would carry.
const TAIL = crypto.randomBytes(16).toString('hex');
const DUMMY = `sk-or-v1-r2-12-dummy-${TAIL}`;
const leaks = text => String(text).includes(TAIL);
const errorLeaks = e => leaks([e && e.message, e && e.stack, e && e.cause && e.cause.message].join(' '));
// In-process, any URL with OpenRouter's path will do: the fake never reaches the network.
const CHAT = '/api/v1/chat/completions';
const URL_OR = `http://openrouter.invalid${CHAT}`;
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
const GO = 'a test: the fake OpenRouter stands in for the endpoint';
// Ports nothing here may use: the model's own, the old sim's tests' and slime's viewers'.
const TAKEN = [8000, 5601, 5602, 5613, 5615, 5262, 5265, 5340];
// The secret a caller passes a seat (the runner draws one; never the season's seed).
const SECRET = 'a secret drawn when the season starts';
// A reply a scripted endpoint gives a call: no errand, and the first line of tonight's menu.
const FIRST_LINE = { json: { actions: [{ act: 'play', menu: 1 }] } };
const PROVIDER = { order: ['deepinfra', 'together'], allow_fallbacks: false };
const turn = () => new Promise(resolve => setImmediate(resolve));
const checkpoint = dir => JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8');
const tapeOf = dir => fs.readFileSync(path.join(dir, 'tape.jsonl'), 'utf8');
const spendOf = dir => fs.readFileSync(path.join(dir, 'spend.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const filesIn = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? filesIn(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const chats = fake => fake.requests.filter(q => q.path === CHAT);
const near = (a, b) => Math.abs(a - b) < 1e-9;
// A fake that closes when its test ends, passed or failed, so a failing test leaves nothing open.
function closing(t, fake) {
  t.after(() => fake.close());
  return fake;
}

// A chat request as the seat sends one: the body, and the seat and its call number in the headers.
const chatInit = (seat, call, body = { model: 'test/model', messages: [{ role: 'user', content: 'the briefing' }] }, signal) => ({
  method: 'POST', body: JSON.stringify(body), signal,
  headers: { 'content-type': 'application/json', 'x-seat': seat, 'x-call': String(call) },
});
const withKey = (init, auth = `Bearer ${DUMMY}`) => ({ ...init, headers: { ...init.headers, ...(auth === null ? {} : { authorization: auth }) } });

// A season whose agents have the trades named, in id order, each housed for the whole season.
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents: trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  for (const id of Object.keys(g.s.agents)) g.grant(id, 2 * N.nights * N.rent);
  return g;
}
const applier = (g, id) => e => {
  const r = g.errand(id, e.kind, e);
  const bad = r.events.find(x => x.type === 'invalid');
  return { ok: r.ok, why: r.why, kind: bad ? bad.kind : undefined };
};
// The briefing as the runner hands it to a seat.
const brief = (r, memory, last, round) => briefing(r, { memory, last, call: round === 'lock' ? 'lock' : 'round' });

// A promise on the manual clock: the clock moves a second at a time until it settles.
async function onClock(clock, p) {
  let done = false;
  p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 1000 && !done; i++) await clock.advance(1000);
  return p;
}

// A paid models season in-process, on the fake OpenRouter: the options as the CLI passes them.
const paidOptions = (fake, outDir, more = {}) => ({
  seed: 404, rule: 'A', outDir, mix: null, url: URL_OR, fetch: fake.fetch, go: GO, model: 'test/model', thinking: 2,
  key: DUMMY, api: 'openrouter', maxCost: 5, say: () => {}, ...more,
});
async function paidSeason(outDir, fake, more = {}) {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  return runModelSeason({ ...paidOptions(fake, outDir, more), mix: { ...CASTS.models, models: 4 } });
}

test('the fake OpenRouter answers as OpenRouter does, $0, in-process or on a port the system picks: the reply with its provider and usage with a cost, billed to the account and the key; the credits and key GETs; a 401 without the bearer key; and, scripted by seat, call and try, a 429, a 402, a 401, a 200 whose body is an error with its cost, and a cut-off', async t => {
  const { fakeOpenRouter, OPENROUTER_CHAT } = await fakeModule();
  assert.equal(OPENROUTER_CHAT, CHAT, "OpenRouter's chat path");
  const errors = (seat, call, attempt) => ({
    a02: attempt === 1 ? { status: 429 } : undefined,
    a03: { status: 402 },
    a04: { status: 200, code: 502, cost: 0.002 },
    a05: { status: 401 },
  })[seat];
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, credits: 10, used: 4, limit: 20, keyUsage: 3, errors, script: { a01: [FIRST_LINE, { ...FIRST_LINE, fault: 'cutoff' }], a02: [FIRST_LINE] } }));
  const send = (seat, call, extra = {}) => fake.fetch(URL_OR, withKey(chatInit(seat, call, { model: 'test/model', messages: [{ role: 'user', content: 'the briefing' }], ...extra })));
  const thought = await (await send('a01', 1, { reasoning: { max_tokens: 1024 }, max_tokens: 6000, usage: { include: true } })).json();
  assert.equal(thought.choices[0].message.content, JSON.stringify(FIRST_LINE.json), "the fake model's reply");
  assert.equal(thought.choices[0].finish_reason, 'stop');
  assert.equal(thought.model, 'test/model');
  assert.ok(typeof thought.provider === 'string' && thought.provider.length > 0, 'the provider that answered');
  assert.ok(thought.usage.cost > 0 && thought.usage.prompt_tokens > 0, 'usage with a cost');
  assert.ok(thought.usage.completion_tokens_details.reasoning_tokens > 0, 'a request with a reasoning budget reasons');
  const cut = await (await send('a01', 2, { reasoning: { enabled: false }, max_tokens: 2000, usage: { include: true } })).json();
  assert.deepEqual([cut.choices[0].finish_reason, cut.usage.completion_tokens_details.reasoning_tokens], ['length', 0], 'a cut-off, without reasoning');
  assert.ok(cut.usage.cost > 0, 'a cut-off is billed');
  assert.equal((await send('a02', 1)).status, 429, 'a 429 on the first try');
  const again = await send('a02', 1);
  assert.equal(again.status, 200, 'the same call asked again answers');
  const later = await again.json();
  const r402 = await send('a03', 1);
  assert.equal(r402.status, 402);
  assert.equal((await r402.json()).error.code, 402);
  const failed = await send('a04', 1);
  assert.equal(failed.status, 200);
  const failedBody = await failed.json();
  assert.deepEqual([failedBody.error.code, failedBody.usage.cost, 'choices' in failedBody], [502, 0.002, false], 'a 200 whose body is an error, with its cost');
  assert.equal((await send('a05', 1)).status, 401);
  const billed = fake.account().used;
  for (const auth of [null, 'Bearer sk-or-v1-not-the-key', DUMMY]) {
    assert.equal((await fake.fetch(URL_OR, withKey(chatInit('a06', 1), auth))).status, 401, `${auth}: no key, no answer`);
  }
  assert.equal(fake.account().used, billed, 'and no bill');
  const spent = thought.usage.cost + cut.usage.cost + later.usage.cost + 0.002;
  const get = where => fake.fetch(`http://openrouter.invalid${where}`, { method: 'GET', headers: { authorization: `Bearer ${DUMMY}` } });
  const credits = (await (await get('/api/v1/credits')).json()).data;
  assert.equal(credits.total_credits, 10);
  assert.ok(near(credits.total_usage, 4 + spent), `the account's usage: ${credits.total_usage}`);
  const key = (await (await get('/api/v1/key')).json()).data;
  assert.equal(key.limit, 20);
  assert.ok(near(key.usage, 3 + spent) && near(key.limit_remaining, 20 - key.usage), "the key's usage and what's left of its limit");
  assert.deepEqual(fake.requests.filter(q => q.seat === 'a02').map(q => [q.call, q.attempt, q.status]), [[1, 1, 429], [1, 2, 200]], 'each try on the record');
  assert.ok(fake.requests.filter(q => q.status !== 401).every(q => q.auth === `Bearer ${DUMMY}`), 'the key on every request it answered');
  assert.deepEqual(fake.failures, []);
  await fake.close();
  // An account that's spent answers a 402; a GET that's down answers its status; over HTTP, the same.
  const dry = closing(t, fakeOpenRouter({ key: DUMMY, credits: 1, used: 1, script: () => FIRST_LINE, down: { credits: 500 } }));
  assert.equal((await dry.fetch(URL_OR, withKey(chatInit('a01', 1)))).status, 402, 'no credit left');
  assert.equal((await dry.fetch('http://openrouter.invalid/api/v1/credits', { headers: { authorization: `Bearer ${DUMMY}` } })).status, 500);
  const { port, url, origin } = await dry.listen();
  assert.ok(!TAKEN.includes(port), `port ${port}`);
  assert.equal(url, `${origin}${CHAT}`);
  assert.equal((await fetch(`${origin}/api/v1/key`, { headers: { authorization: `Bearer ${DUMMY}` } })).status, 200);
  assert.equal((await fetch(`${origin}/api/v1/key`)).status, 401);
  assert.equal(dry.requests.at(-1).auth, null, 'what came over the wire, as it came');
  await dry.close();
});

test('the key: read once from its file and trimmed, refused when the file is empty or holds more than one word, never in the message; added by the transport to each request as it goes out, as authorization: Bearer <key>, on the chat calls and the preflight\'s GETs, on a copy, so the caller\'s request never holds it; a fetch that throws with the request in its message, or a server that echoes the key, leaks none of it', async t => {
  const { readKey, openRouter } = await paidModule();
  const { fakeOpenRouter } = await fakeModule();
  const file = path.join(tmp, 'key');
  fs.writeFileSync(file, `\n  ${DUMMY}\t \n`);
  assert.equal(readKey(file), DUMMY, 'trimmed');
  for (const [text, why] of [[' \n', /empty/], [`${DUMMY} ${DUMMY}`, /word/], [`${DUMMY}\n${DUMMY}`, /word/]]) {
    fs.writeFileSync(file, text);
    assert.throws(() => readKey(file), e => why.test(e.message) && !errorLeaks(e), JSON.stringify(text.slice(0, 3)));
  }
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
  const seen = [];
  const spy = (u, init) => {
    seen.push({ path: new URL(String(u)).pathname, auth: new Headers(init.headers).get('authorization') });
    return fake.fetch(u, init);
  };
  const paid = openRouter({ fetch: spy, key: DUMMY, maxCost: 1, clock: manualClock() });
  assert.equal((await paid.preflight(URL_OR)).refused, null);
  const init = chatInit('a01', 1);
  assert.equal((await paid.fetch(URL_OR, init)).status, 200);
  assert.equal(new Headers(init.headers).get('authorization'), null, "the caller's request is as it was");
  assert.ok((await paid.keyUsage(URL_OR)) > 0, "the key's usage");
  assert.deepEqual(seen.map(s => s.path), ['/api/v1/credits', '/api/v1/key', CHAT, '/api/v1/key'], 'the GETs at the url\'s origin, and the chat call');
  assert.ok(seen.every(s => s.auth === `Bearer ${DUMMY}`), 'the key on each, as a bearer');
  await fake.close();
  // A library that puts the request in its error: neither the rejection nor the preflight's refusal carries the key.
  const leaky = async (u, i) => {
    const sent = [...new Headers(i.headers)].map(([k, v]) => `${k}: ${v}`).join(', ');
    throw Object.assign(new TypeError(`fetch failed (${sent})`), { cause: new Error(`while sending ${new Headers(i.headers).get('authorization')}`) });
  };
  const broken = openRouter({ fetch: leaky, key: DUMMY, maxCost: 1, clock: manualClock() });
  await assert.rejects(broken.fetch(URL_OR, chatInit('a01', 1)), e => /fetch failed/.test(e.message) && !errorLeaks(e));
  const refused = (await broken.preflight(URL_OR)).refused;
  assert.ok(/fetch failed/.test(refused) && !leaks(refused), refused);
  assert.equal(await broken.keyUsage(URL_OR), null);
  // A server that echoes the key: the reply the seat reads (and the tape keeps) and the stop's reason hold none of it.
  const echo = async (u, i) => new Response(JSON.stringify({ error: { code: 401, message: `no such key: ${new Headers(i.headers).get('authorization')}` } }), { status: 401 });
  const echoed = openRouter({ fetch: echo, key: DUMMY, maxCost: 1, clock: manualClock() });
  const res = await echoed.fetch(URL_OR, chatInit('a01', 1));
  assert.equal(res.status, 401);
  assert.ok(!leaks(await res.text()), 'the reply as the seat reads it');
  assert.ok(echoed.halted && !errorLeaks(echoed.halted), 'the stop');
});

test('the OpenRouter body (brief R2-12): no chat_template_kwargs; a thinking seat sends reasoning { max_tokens: 1024 } and max_tokens 6000, the others reasoning { enabled: false } and max_tokens 2000; usage { include: true }; the provider\'s routing only when the caller names it; the messages byte for byte the local body\'s for the same view; and the local body as it was', async t => {
  const { makeSeat } = await seatModule();
  const { openRouter } = await paidModule();
  const { fakeOpenRouter } = await fakeModule();
  const g = withTrades(['smuggler', 'chemist', 'dealer']);
  const kinds = [
    { name: 'local' },
    { name: 'local, thinking', thinking: true },
    { name: 'openrouter', api: 'openrouter' },
    { name: 'openrouter, thinking, a provider', api: 'openrouter', thinking: true, provider: PROVIDER },
  ];
  const bodies = {};
  // Each seat answers its day's call with no action, so the state stays as it was and every seat reads the same view.
  const script = { a01: [{ json: { actions: [] } }, FIRST_LINE] };
  for (const k of kinds) {
    const clock = manualClock();
    const fake = closing(t, k.api ? fakeOpenRouter({ key: DUMMY, script }) : fakeModel({ script, clock }));
    const send = k.api ? openRouter({ fetch: fake.fetch, key: DUMMY, maxCost: 1, clock }).fetch : fake.fetch;
    const seat = makeSeat({
      id: 'a01', url: k.api ? URL_OR : IN_PROCESS, fetch: send, secret: SECRET, brief, clock, model: 'test/model', thinking: k.thinking === true,
      ...(k.api ? { api: k.api } : {}), ...(k.provider ? { provider: k.provider } : {}),
    });
    const day = await seat.call({ view: g.view('a01'), apply: applier(g, 'a01'), round: 1 });
    const lock = await seat.call({ view: g.view('a01'), round: 'lock', defaultPlay: defaultPlay(g.s, 'a01', g.s.day) });
    assert.deepEqual([day.outcome, lock.outcome, lock.origin], ['reply', 'reply', 'model'], `${k.name}: answered`);
    bodies[k.name] = seat.tape().split('\n').filter(Boolean).map(l => JSON.parse(l).request);
    assert.equal(bodies[k.name].length, 2);
    await fake.close();
  }
  for (const name of ['local', 'local, thinking']) {
    for (const b of bodies[name]) {
      assert.deepEqual(Object.keys(b), ['model', 'messages', 'response_format', 'chat_template_kwargs'], `${name}: the local body, field for field`);
      assert.deepEqual(b.chat_template_kwargs, { enable_thinking: name === 'local, thinking' });
    }
  }
  for (const b of bodies.openrouter) {
    assert.deepEqual(Object.keys(b), ['model', 'messages', 'response_format', 'reasoning', 'max_tokens', 'usage'], 'openrouter: no chat_template_kwargs, no provider');
    assert.deepEqual([b.reasoning, b.max_tokens, b.usage], [{ enabled: false }, 2000, { include: true }]);
  }
  for (const b of bodies['openrouter, thinking, a provider']) {
    assert.deepEqual(Object.keys(b), ['model', 'messages', 'response_format', 'reasoning', 'max_tokens', 'usage', 'provider']);
    assert.deepEqual([b.reasoning, b.max_tokens, b.usage, b.provider], [{ max_tokens: 1024 }, 6000, { include: true }, PROVIDER]);
  }
  for (const k of kinds) {
    assert.deepEqual(bodies[k.name].map(b => b.response_format), [{ type: 'json_object' }, { type: 'json_object' }], `${k.name}: the reply format`);
    assert.deepEqual(bodies[k.name].map(b => JSON.stringify(b.messages)), bodies.local.map(b => JSON.stringify(b.messages)), `${k.name}: the messages, byte for byte`);
  }
  assert.throws(() => makeSeat({ id: 'a01', url: URL_OR, fetch: () => {}, secret: SECRET, brief, api: 'anthropic' }), /api/i, 'an API the seat doesn\'t know');
});

test('a 429 waits 6, 12, then 18 s on the clock passed in and asks again, up to 3 times, inside the seat\'s window: the seat counts one call and its tape keeps one line, the answer; past the third wait the 429 goes to the seat; a wait the window ends is the seat\'s timeout (sim2: single-provider models got 429s)', async t => {
  const { openRouter } = await paidModule();
  const { fakeOpenRouter } = await fakeModule();
  const { makeSeat } = await seatModule();
  const clock = manualClock();
  const errors = (seat, call, attempt) => ((seat === 'a01' && attempt <= 3) || seat === 'a02' ? { status: 429 } : undefined);
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, errors, script: () => FIRST_LINE }));
  const at = [];
  const timed = (u, init) => {
    at.push(clock.now());
    return fake.fetch(u, init);
  };
  const paid = openRouter({ fetch: timed, key: DUMMY, maxCost: 1, clock });
  const res = await onClock(clock, paid.fetch(URL_OR, chatInit('a01', 1)));
  assert.equal(res.status, 200, 'the fourth try answers');
  assert.deepEqual(at, [0, 6000, 18000, 36000], 'asked again after 6, 12 and 18 s, on the clock');
  at.length = 0;
  const from = clock.now();
  const gave = await onClock(clock, paid.fetch(URL_OR, chatInit('a02', 1)));
  assert.equal(gave.status, 429, 'past the third wait, the 429 goes back');
  assert.deepEqual(at.map(t => t - from), [0, 6000, 18000, 36000], 'three waits, no more');
  const ctl = new AbortController();
  const cut = paid.fetch(URL_OR, chatInit('a02', 2, undefined, ctl.signal));
  cut.catch(() => {});
  for (let i = 0; i < 20 && chats(fake).filter(q => q.call === 2).length === 0; i++) await turn();
  await clock.advance(3000);
  ctl.abort();
  await assert.rejects(cut, 'the window ends the wait');
  await clock.advance(10000);
  assert.equal(chats(fake).filter(q => q.seat === 'a02' && q.call === 2).length, 1, 'and nothing is asked after it');
  await fake.close();
  // At the seat: two 429s, then the answer, inside the window; one call on the seat's count and one line on its tape.
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  const seatClock = manualClock();
  const busy = closing(t, fakeOpenRouter({ key: DUMMY, errors: (seat, call, attempt) => (attempt <= 2 ? { status: 429 } : undefined), script: () => FIRST_LINE }));
  const seat = makeSeat({
    id: 'a01', url: URL_OR, fetch: openRouter({ fetch: busy.fetch, key: DUMMY, maxCost: 1, clock: seatClock }).fetch,
    secret: SECRET, brief, clock: seatClock, api: 'openrouter', model: 'test/model',
  });
  const out = await onClock(seatClock, seat.call({ view: g.view('a01'), apply: applier(g, 'a01'), round: 1 }));
  assert.deepEqual([out.origin, out.outcome, out.calls], ['model', 'reply', 1]);
  assert.equal(seat.memo.calls, 1, 'the waits are not the seat\'s retry');
  const lines = seat.tape().split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.deepEqual(lines.map(l => [l.call, l.reply.status]), [[1, 200]], 'one line, the answer');
  assert.ok(lines[0].ms >= 18000 && lines[0].ms < N['gap.window'] * 1000, `inside the window: ${lines[0].ms} ms`);
  assert.deepEqual(chats(busy).map(q => [q.seat, q.call, q.attempt, q.status]), [['a01', 1, 1, 429], ['a01', 1, 2, 429], ['a01', 1, 3, 200]]);
  await busy.close();
});

test('the tally counts usage.cost from every response that carries it: a reply, a cut-off, a 200 whose body is an error and an HTTP error with usage, and one without counts nothing; each request leaves a spend record (cost, provider, model, tokens in, out and reasoning, finish, status, ms); and at the seat a 200 whose body is an error reads as an error, never as a reply (sim2\'s counter once missed a third of a bill)', async t => {
  const { openRouter } = await paidModule();
  const { fakeOpenRouter } = await fakeModule();
  const { makeSeat } = await seatModule();
  const errors = seat => ({ a03: { status: 200, code: 502, cost: 0.002 }, a04: { status: 500, cost: 0.003 }, a05: { status: 503 } })[seat];
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, errors, cost: () => 0.01, script: { a01: [FIRST_LINE], a02: [{ ...FIRST_LINE, fault: 'cutoff', at: 8 }] } }));
  const records = [];
  const paid = openRouter({ fetch: fake.fetch, key: DUMMY, maxCost: 10, clock: manualClock(), onCall: r => records.push(r) });
  const thinking = { model: 'test/model', messages: [{ role: 'user', content: 'the briefing' }], reasoning: { max_tokens: 1024 }, max_tokens: 6000, usage: { include: true } };
  for (const seat of ['a01', 'a02', 'a03', 'a04', 'a05']) await paid.fetch(URL_OR, chatInit(seat, 1, thinking));
  assert.ok(near(paid.spend.cost, 0.025), `a reply, a cut-off, an error body and an HTTP error: $${paid.spend.cost}`);
  assert.equal(paid.spend.calls, 5);
  assert.equal(paid.halted, null, 'under the cap, nothing stops');
  assert.deepEqual(records.map(r => [r.seat, r.call, r.try, r.status, r.finish, r.cost]), [
    ['a01', 1, 1, 200, 'stop', 0.01], ['a02', 1, 1, 200, 'length', 0.01], ['a03', 1, 1, 200, null, 0.002],
    ['a04', 1, 1, 500, null, 0.003], ['a05', 1, 1, 503, null, null],
  ]);
  assert.deepEqual(Object.keys(records[0]), ['seat', 'call', 'try', 'status', 'finish', 'cost', 'provider', 'model', 'tokens', 'ms']);
  assert.deepEqual([records[0].provider, records[0].model], [fake.provider, 'test/model']);
  assert.ok(records[0].tokens.in > 0 && records[0].tokens.out > 0 && records[0].tokens.reasoning > 0, 'tokens in, out and reasoning');
  assert.ok(records.every(r => Number.isFinite(r.ms)), 'and how long');
  await fake.close();
  // A 200 that holds an error and a whole reply besides: at the seat, an error, and the play comes from elsewhere.
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  const both = async () => new Response(JSON.stringify({
    error: { code: 502, message: 'Provider returned error' },
    choices: [{ message: { role: 'assistant', content: JSON.stringify(FIRST_LINE.json) }, finish_reason: 'stop' }], usage: { cost: 0.001 },
  }), { status: 200 });
  const seat = makeSeat({ id: 'a01', url: URL_OR, fetch: both, secret: SECRET, brief, clock: manualClock(), api: 'openrouter' });
  const lock = await seat.call({ view: g.view('a01'), round: 'lock', defaultPlay: defaultPlay(g.s, 'a01', g.s.day) });
  assert.deepEqual(seat.record[0].attempts.map(a => a.outcome), ['error', 'error'], 'an error each time, and the retry');
  assert.deepEqual([lock.outcome, lock.origin], ['error', 'default']);
});

test('the transport stops at the cap: the response that brings the tally to --max-cost is answered and says why, and no request goes out after it; the runner is told when one is refused', async t => {
  const { openRouter } = await paidModule();
  const { fakeOpenRouter } = await fakeModule();
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, cost: () => 0.01, script: () => FIRST_LINE }));
  const told = [];
  const paid = openRouter({ fetch: fake.fetch, key: DUMMY, maxCost: 0.03, clock: manualClock(), onHalt: e => told.push(e) });
  for (const call of [1, 2]) assert.equal((await paid.fetch(URL_OR, chatInit('a01', call))).status, 200);
  assert.equal(paid.halted, null);
  assert.equal((await paid.fetch(URL_OR, chatInit('a01', 3))).status, 200, 'the third is answered');
  assert.equal(paid.halted && paid.halted.halt, 'cap', 'and the cap is reached');
  assert.match(paid.halted.message, /cap/);
  await assert.rejects(paid.fetch(URL_OR, chatInit('a01', 4)), /cap/);
  assert.equal(chats(fake).length, 3, 'nothing went out after');
  assert.deepEqual(told, [paid.halted], 'the runner told');
  await fake.close();
  // A season already part spent goes on from its tally.
  const resumed = openRouter({ fetch: fake.fetch, key: DUMMY, maxCost: 1, clock: manualClock(), spent: { cost: 0.5, calls: 50 } });
  assert.deepEqual(resumed.spend, { cost: 0.5, calls: 50 });
});

test('402, or an error that names credits, stops the season at once and asks nothing more, not even the seat\'s retry; a 401 or a 403 stops it as a bad key; each as SIGINT stops it (the requests in flight aborted, nothing written after), and --resume plays on to the uncut season\'s log (sim2\'s run 32 ran the account dry mid-city)', async t => {
  const { fakeOpenRouter } = await fakeModule();
  const whole = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
  const uncut = await paidSeason(path.join(tmp, 'stops-whole'), whole, { stopAfter: 3 });
  await whole.close();
  // The call that meets the error: the first model seat's in round 1 of day 2, after night 1's checkpoint. By day the
  // seats are called one at a time, so nothing else is in flight.
  const ck = checkpoint(uncut.dir);
  const seat = Object.keys(ck.models.seats).sort()[0];
  const call = ck.models.seats[seat].record.find(r => r.day === 2 && r.round === 1).attempts[0].call;
  const cases = [
    ['402', { status: 402 }, 'credit'],
    ['a message about credits', { status: 400, message: 'This request requires more credits, or fewer max_tokens.' }, 'credit'],
    ['a 200 whose error names credits', { status: 200, code: 400, message: 'Insufficient credits' }, 'credit'],
    ['401', { status: 401 }, 'key'],
    ['403', { status: 403 }, 'key'],
  ];
  for (const [i, [name, entry, kind]] of cases.entries()) {
    const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE, errors: (s, c) => (s === seat && c === call ? entry : undefined) }));
    const out = path.join(tmp, `stops-${i}`);
    await assert.rejects(paidSeason(out, fake, { stopAfter: 3 }), e => e.halt === kind && !errorLeaks(e), name);
    const asked = chats(fake);
    assert.deepEqual([asked.at(-1).seat, asked.at(-1).call, asked.at(-1).status], [seat, call, entry.status], `${name}: the last request`);
    assert.equal(asked.filter(q => q.seat === seat && q.call >= call).length, 1, `${name}: nothing asked after it, not even the retry`);
    const dir = path.join(out, '404-A');
    assert.equal(checkpoint(dir).state.day, 2, `${name}: night 1's checkpoint is the last`);
    assert.equal(fs.existsSync(path.join(dir, 'result.json')), false);
    const tape = [...readTape(tapeOf(dir)).values()];
    assert.equal(tape.length, asked.length, `${name}: the call that stopped it is on the tape, and nothing after`);
    assert.equal(tape.find(l => l.seat === seat && l.call === call).reply.status, entry.status);
    await fake.close();
    if (i > 0) continue;
    const topped = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
    const r = await paidSeason(out, topped, { stopAfter: 3, resume: true });
    assert.equal(r.stopped, 3);
    assert.ok(readLog(dir) === readLog(uncut.dir), `${name}: resumed, the uncut season's log`);
    await topped.close();
  }
});

test('the preflight, before the first call: the account\'s balance (total_credits less total_usage) and the key\'s limit left (null: none set), from two free GETs at the url\'s origin; refused when either is below the cap, or a GET fails or reads wrong; in a season it comes first, refuses before anything is written or any chat call, and with the key\'s usage read again at the end gives the billed total', async t => {
  const { openRouter } = await paidModule();
  const { fakeOpenRouter } = await fakeModule();
  const check = async (account, cap = 5, url = URL_OR) => {
    const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE, ...account }));
    const out = await openRouter({ fetch: fake.fetch, key: DUMMY, maxCost: cap, clock: manualClock() }).preflight(url);
    const asked = fake.requests.map(q => `${q.method} ${q.path}`);
    await fake.close();
    return { ...out, asked };
  };
  const fine = await check({ credits: 100, used: 4, keyUsage: 3 }, 5, 'http://openrouter.invalid/somewhere/else');
  assert.deepEqual([fine.balance, fine.left, fine.usage, fine.refused], [96, null, 3, null], 'no limit set on the key');
  assert.deepEqual(fine.asked, ['GET /api/v1/credits', 'GET /api/v1/key'], "at the url's origin, whatever its path");
  assert.equal((await check({ credits: 10, used: 5 }, 5)).refused, null, 'a balance at the cap is enough');
  assert.match((await check({ credits: 10, used: 6 }, 5)).refused, /balance.*\$4\.00.*below.*\$5/);
  const short = await check({ credits: 100, limit: 20, keyUsage: 17 }, 5);
  assert.equal(short.left, 3);
  assert.match(short.refused, /limit.*\$3\.00.*below.*\$5/);
  assert.match((await check({ down: { credits: 500 } })).refused, /balance.*500/);
  assert.match((await check({ down: { key: 503 } })).refused, /limit.*503/);
  const odd = async () => new Response(JSON.stringify({ credits: 'lots' }), { status: 200 });
  assert.ok((await openRouter({ fetch: odd, key: DUMMY, maxCost: 1, clock: manualClock() }).preflight(URL_OR)).refused, 'a GET that reads wrong');
  // In a season: refused first, so nothing is written and no chat call goes out.
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const poor = closing(t, fakeOpenRouter({ key: DUMMY, credits: 3, script: () => FIRST_LINE }));
  const out = path.join(tmp, 'preflight-refused');
  const said = [];
  await assert.rejects(runModelSeason({ ...paidOptions(poor, out, { say: l => said.push(l) }), mix: { ...CASTS.models, models: 2 } }), e => e.refused === true && /balance/.test(e.message));
  assert.equal(fs.existsSync(out), false, 'nothing written');
  assert.deepEqual(poor.requests.map(q => q.path), ['/api/v1/credits', '/api/v1/key'], 'no chat call');
  assert.match(said[0], /^OpenRouter: account balance \$3\.00 · key limit left none set · cap \$5$/, 'the amounts, only');
  await poor.close();
});

test('a paid season in-process: OpenRouter\'s body on the tape, the thinking budget for the first --thinking-seats seats by id; the key on every request and nowhere in the run folder or the printed lines; the checkpoint keeps the API, the provider and the cap; spend.jsonl has a record a request, adding up to what the account was billed; [spend] after every night and a final line; the preflight\'s amounts first and the billed total, from the key\'s usage, last', async t => {
  const { fakeOpenRouter } = await fakeModule();
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, credits: 50, used: 10, limit: 30, keyUsage: 7, script: () => FIRST_LINE }));
  const said = [];
  const r = await paidSeason(path.join(tmp, 'paid'), fake, { provider: PROVIDER, stopAfter: 3, say: l => said.push(l) });
  const ck = checkpoint(r.dir);
  const seats = ck.cast.filter(c => c.model).map(c => c.id).sort();
  assert.deepEqual(ck.models.thinking, seats.slice(0, 2), 'thinking on for the first two by id');
  assert.deepEqual([ck.models.api, ck.models.provider, ck.models.maxCost], ['openrouter', PROVIDER, 5], 'the API, the provider and the cap, kept');
  const tape = [...readTape(tapeOf(r.dir)).values()];
  assert.ok(tape.length > 0 && tape.every(l => l.reply && l.reply.status === 200));
  for (const l of tape) {
    const thinking = ck.models.thinking.includes(l.seat);
    assert.ok(!('chat_template_kwargs' in l.request), `${l.seat}#${l.call}: no chat template kwargs`);
    assert.deepEqual([l.request.reasoning, l.request.max_tokens, l.request.usage, l.request.provider],
      thinking ? [{ max_tokens: 1024 }, 6000, { include: true }, PROVIDER] : [{ enabled: false }, 2000, { include: true }, PROVIDER], `${l.seat}#${l.call}`);
  }
  assert.ok(fake.requests.length > tape.length && fake.requests.every(q => q.auth === `Bearer ${DUMMY}`), 'the key on every request');
  for (const f of filesIn(r.dir)) assert.ok(!leaks(fs.readFileSync(f, 'utf8')), `${path.basename(f)} holds no key`);
  assert.ok(!leaks(said.join('\n')) && !leaks(JSON.stringify(r)), 'nor anything printed or returned');
  const spend = spendOf(r.dir);
  assert.equal(spend.length, chats(fake).length, 'a record a request');
  assert.deepEqual(spend.map(x => `${x.seat}#${x.call}`).sort(), tape.map(l => `${l.seat}#${l.call}`).sort(), 'each a call on the tape');
  const total = spend.reduce((t, x) => t + x.cost, 0);
  assert.ok(near(total, fake.account().used - 10), `the records add up to the bill: $${total}`);
  assert.ok(near(r.spend.cost, total) && r.spend.calls === spend.length);
  assert.equal(said[0], 'OpenRouter: account balance $40.00 · key limit left $23.00 · cap $5');
  const nights = said.filter(l => / after night \d+$/.test(l));
  assert.deepEqual(nights.map(l => Number(l.match(/night (\d+)$/)[1])), [1, 2, 3], 'one line after each night');
  for (const l of nights) assert.match(l, /^\[spend\] \$\d+\.\d{4} of \$5 · \d+ calls · after night \d+$/);
  assert.equal(said.at(-2), `[spend] $${total.toFixed(4)} of $5 · ${spend.length} calls · final`);
  const billed = said.at(-1).match(/^\[billed\] \$(\d+\.\d{4}) /);
  assert.ok(billed && Math.abs(Number(billed[1]) - total) < 1e-4, said.at(-1));
  await fake.close();
});

test('runModelSeason\'s guards, before anything is written or called: a key without a url, OpenRouter\'s body without a key, a key without a cap, a cap without a key, a cap that isn\'t a positive number, provider preferences without OpenRouter\'s body or not an object, an API it doesn\'t know; and a resume that doesn\'t call as the season did, or whose season has already spent its cap', async t => {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const { fakeOpenRouter } = await fakeModule();
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
  const mix = { ...CASTS.models, models: 2 };
  const bad = [
    [{ url: null, go: null, model: undefined }, /--model-key-file goes with --model-url/],
    [{ key: null }, /--model-api openrouter needs --model-key-file/],
    [{ maxCost: null }, /--model-key-file needs --max-cost/],
    [{ key: null, api: 'local' }, /--max-cost goes with --model-key-file/],
    [{ maxCost: 0 }, /--max-cost takes a positive number/],
    [{ maxCost: Number.NaN }, /--max-cost takes a positive number/],
    [{ api: 'local', provider: PROVIDER }, /--model-provider goes with --model-api openrouter/],
    [{ provider: ['deepinfra'] }, /--model-provider takes a JSON object/],
    [{ api: 'anthropic' }, /--model-api takes openrouter/],
  ];
  for (const [i, [more, why]] of bad.entries()) {
    const out = path.join(tmp, `guard-${i}`);
    await assert.rejects(runModelSeason({ ...paidOptions(fake, out, more), mix }), e => why.test(e.message) && !errorLeaks(e), JSON.stringify(more));
    assert.equal(fs.existsSync(out), false, `${why}: nothing written`);
  }
  assert.equal(fake.requests.length, 0, 'nothing reached the endpoint');
  // A paid season stopped after a night, then resumed wrongly: refused, the endpoint never asked.
  const out = path.join(tmp, 'guard-resume');
  const first = await runModelSeason({ ...paidOptions(fake, out, { stopAfter: 1, provider: PROVIDER }), mix });
  const asked = fake.requests.length;
  const spent = spendOf(first.dir).reduce((t, x) => t + x.cost, 0);
  const wrong = [
    [{ key: null, api: 'local', maxCost: null, provider: null }, /paid/],
    [{ provider: { order: ['another'] } }, /provider/],
    [{ api: 'local', provider: null }, /API/],
    [{ maxCost: spent, provider: PROVIDER }, /spent/],
  ];
  for (const [more, why] of wrong) {
    await assert.rejects(runModelSeason({ ...paidOptions(fake, out, { provider: PROVIDER, ...more, resume: true }), mix }), why, JSON.stringify(more));
  }
  assert.equal(fake.requests.length, asked, 'no request for a resume refused');
  await fake.close();
});

test('nothing a test here started is still open, so the file\'s process exits on its own', async t => {
  const extra = () => {
    const now = process.getActiveResourcesInfo();
    for (const x of OPEN_AT_START) {
      const i = now.indexOf(x);
      if (i >= 0) now.splice(i, 1);
    }
    return now;
  };
  for (let i = 0; i < 100 && extra().length; i++) await turn();
  assert.deepEqual(extra(), []);
});
