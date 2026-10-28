// R2-6, the fake model ($0): replies scripted by seat and call number, a tape that replays, the faults, the hooks R2-7
// fills from R2-5's action table, and a clock passed in, so windows and retries are tested without waiting (the R2
// brief; GAME.md §18, §33). Nothing here calls a model: the only connections are to the fake's own port on 127.0.0.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeModel, manualClock, readTape, tapeLine, CHAT_PATH, SEAT_HEADER, CALL_HEADER, FAULTS } from '../agents/fake-model.mjs';

// What was open before any test ran: the file must leave its process as it found it.
const OPEN_AT_START = process.getActiveResourcesInfo();
// The model's own port, the old sim's test ports and slime's viewers: the fake never listens on one.
const NEVER = [8000, 5601, 5602, 5613, 5615, 5262, 5265, 5340];
// In-process, any URL with the endpoint's path will do: it never reaches the network.
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;

// A chat request as sim2's brain.mjs sent one to the local model.
const chat = (user = 'the briefing') => ({
  model: 'qwen3.8-flash-next', temperature: 0.85, max_tokens: 700, response_format: { type: 'json_object' },
  chat_template_kwargs: { enable_thinking: false },
  messages: [{ role: 'system', content: 'the rules and the reply format' }, { role: 'user', content: user }],
});
const post = (send, url, seat, call, body = chat(), signal) => send(url, {
  method: 'POST', body: JSON.stringify(body), signal,
  headers: { 'content-type': 'application/json', [SEAT_HEADER]: seat, [CALL_HEADER]: String(call) },
});
const contentOf = async res => (await res.json()).choices[0].message.content;
const turn = () => new Promise(resolve => setImmediate(resolve));

// What is open now beyond `before`, once anything closing has had a few turns to finish.
async function leftOpen(before) {
  const extra = () => {
    const now = process.getActiveResourcesInfo();
    for (const r of before) {
      const i = now.indexOf(r);
      if (i >= 0) now.splice(i, 1);
    }
    return now;
  };
  for (let i = 0; i < 100 && extra().length; i++) await turn();
  return extra();
}

// Waits on real I/O (the HTTP form) until ok() holds.
async function until(ok, what) {
  for (let i = 0; i < 2000; i++) {
    if (ok()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail(`never happened: ${what}`);
}

// A stand-in for R2-7's seat, for these tests only: one call, with a window on the clock passed in.
async function windowed(fake, clock, seat, call, windowMs) {
  const ctl = new AbortController();
  const timer = clock.setTimeout(() => ctl.abort(), windowMs);
  try {
    const text = await contentOf(await post(fake.fetch, IN_PROCESS, seat, call, chat(), ctl.signal));
    return { at: clock.now(), text };
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
    return { at: clock.now(), timeout: true };
  } finally {
    clock.clearTimeout(timer);
  }
}

test('in-process, a scripted reply comes back as the endpoint\'s Response: its status, choices and token counts', async () => {
  const fake = fakeModel({ script: { a01: [{ content: '{"pick": 3}' }, { json: { pick: 4, reason: 'why not' } }] } });
  const res = await post(fake.fetch, IN_PROCESS, 'a01', 1);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.object, 'chat.completion');
  assert.equal(typeof body.model, 'string');
  assert.deepEqual(body.choices.map(c => [c.message.role, c.message.content, c.finish_reason]), [['assistant', '{"pick": 3}', 'stop']]);
  const { prompt_tokens: given, completion_tokens: written, total_tokens: total } = body.usage;
  assert.ok(given > 0 && written > 0 && total === given + written, 'token counts, named as the API names them');
  assert.equal(await contentOf(await post(fake.fetch, IN_PROCESS, 'a01', 2)), JSON.stringify({ pick: 4, reason: 'why not' }));
  assert.deepEqual(fake.calls.map(c => [c.seat, c.call, c.from, c.outcome]), [['a01', 1, 'script', 'reply'], ['a01', 2, 'script', 'reply']]);
  assert.deepEqual([fake.failures, fake.unused()], [[], []]);
  await fake.close();
});

test('a reply is keyed by seat and call number, so the order requests are sent or finish in can\'t change it', async () => {
  const replies = { 'a01#1': 'A1', 'a01#2': 'A2', 'a02#1': 'B1', 'a03#1': 'C1' };
  async function run(order, delays) {
    const clock = manualClock();
    const script = {};
    for (const [key, content] of Object.entries(replies)) {
      const [seat, call] = key.split('#');
      script[seat] = { ...script[seat], [call]: { content, delayMs: delays[key] } };
    }
    const fake = fakeModel({ script, clock });
    const finished = [];
    const asked = order.map(async key => {
      const [seat, call] = key.split('#');
      const text = await contentOf(await post(fake.fetch, IN_PROCESS, seat, Number(call)));
      finished.push(key);
      return [key, text];
    });
    await clock.advance(100);
    const got = Object.fromEntries(await Promise.all(asked));
    await fake.close();
    return { got, finished };
  }
  const one = await run(['a01#1', 'a01#2', 'a02#1', 'a03#1'], { 'a01#1': 40, 'a01#2': 10, 'a02#1': 30, 'a03#1': 20 });
  const two = await run(['a03#1', 'a01#2', 'a02#1', 'a01#1'], { 'a01#1': 5, 'a01#2': 35, 'a02#1': 15, 'a03#1': 25 });
  assert.deepEqual(one.finished, ['a01#2', 'a03#1', 'a02#1', 'a01#1']);
  assert.deepEqual(two.finished, ['a01#1', 'a02#1', 'a03#1', 'a01#2'], 'positive control: they finished in another order');
  assert.deepEqual(one.got, replies);
  assert.deepEqual(two.got, replies, 'sent and finished in other orders, each seat and call still gets its own reply');
});

test('windows and retries run on the clock passed in: three minutes of windows take no real waiting', async () => {
  const clock = manualClock();
  const script = { a01: [{ fault: 'hang' }, { content: '{"pick": 1}', delayMs: 5000 }, { content: 'too late', delayMs: 200000 }] };
  const fake = fakeModel({ clock, script });
  const began = performance.now();
  const first = windowed(fake, clock, 'a01', 1, 180000);
  await clock.advance(179999);
  assert.equal(fake.calls[0].outcome, 'pending', 'no reply yet, and the window still open');
  await clock.advance(1);
  assert.deepEqual(await first, { at: 180000, timeout: true }, 'the window closes at 180 s on the clock');
  const retry = windowed(fake, clock, 'a01', 2, 180000);
  await clock.advance(5000);
  assert.deepEqual(await retry, { at: 185000, text: '{"pick": 1}' }, 'the retry is answered 5 s later');
  const late = windowed(fake, clock, 'a01', 3, 180000);
  await clock.advance(180000);
  assert.deepEqual(await late, { at: 365000, timeout: true }, 'a reply slower than the window is no reply');
  assert.equal(clock.pending(), 0, 'giving up cleared the late reply\'s timer');
  assert.deepEqual(fake.calls.map(c => [c.call, c.outcome, c.ms]), [[1, 'none', 180000], [2, 'reply', 5000], [3, 'none', 180000]]);
  const real = performance.now() - began;
  assert.ok(real < 10000, `365 s on the clock took ${Math.round(real)} ms of real time`);
  await fake.close();
});

test('faults in the text: malformed JSON, and a reply cut off mid-JSON because it ran out of tokens', async () => {
  const whole = { pick: 7, reason: 'the docks are quiet tonight', note: 'n'.repeat(60) };
  const fake = fakeModel({ script: { a01: [{ fault: 'malformed' }, { fault: 'cutoff', json: whole }, { fault: 'cutoff', json: whole, at: 9 }] } });
  const ask = async call => (await post(fake.fetch, IN_PROCESS, 'a01', call, { ...chat(), max_tokens: 300 })).json();
  const malformed = await ask(1);
  assert.throws(() => JSON.parse(malformed.choices[0].message.content), SyntaxError);
  assert.equal(malformed.choices[0].finish_reason, 'stop', 'the endpoint answered; its text is what\'s wrong');
  const cut = await ask(2);
  const text = cut.choices[0].message.content, full = JSON.stringify(whole);
  assert.ok(text.length > 0 && text.length < full.length && full.startsWith(text), 'it is the start of the whole reply');
  assert.throws(() => JSON.parse(text), SyntaxError);
  assert.equal(cut.choices[0].finish_reason, 'length');
  assert.equal(cut.usage.completion_tokens, 300, 'it stopped at the request\'s max_tokens');
  assert.equal((await ask(3)).choices[0].message.content, full.slice(0, 9), 'cut where the script says');
  assert.deepEqual(fake.calls.map(c => c.fault), ['malformed', 'cutoff', 'cutoff']);
  assert.deepEqual(fake.failures, []);
  await fake.close();
});

test('bot-playing and the faults only R2-5\'s table can build go through hooks R2-7 fills; with no bot to play, a typed failure', async () => {
  for (const fault of ['malformed', 'cutoff', 'hang', 'illegalPlay', 'unknownErrand', 'staleHandle', 'canaries']) {
    assert.ok(FAULTS.includes(fault), `the brief's ${fault} fault`);
  }
  const bare = fakeModel({ script: { a01: [{ bot: true }, { fault: 'cutoff' }] } });
  const refused = [];
  for (let call = 1; call <= 2; call++) {
    const res = await post(bare.fetch, IN_PROCESS, 'a01', call);
    const { why, hook } = (await res.json()).error;
    refused.push([res.status, why, hook]);
  }
  assert.deepEqual(refused, [[409, 'needs the table', 'bot'], [409, 'needs the table', 'bot']], 'a bot\'s reply, or one to cut, needs the bot');
  assert.deepEqual(bare.calls, [], 'nothing was answered');
  await bare.close();

  // Stand-ins for the table's hooks, for this test only: R2-7 builds the real ones from R2-5's table.
  const botAsked = [], earlierSeen = [];
  const hooks = {
    bot: request => {
      botAsked.push(request);
      return { play: 1, reason: `${request.seat} call ${request.call}` };
    },
    illegalPlay: async (request, ctx) => ({ ...(await ctx.bot()), play: 999 }),
    unknownErrand: () => ({ errands: [{ kind: 'teleport' }] }),
    staleHandle: (request, ctx) => {
      earlierSeen.push(ctx.earlier.map(body => body.messages[1].content));
      return { give: 'P3' };
    },
    canaries: (request, ctx) => ({ reason: ctx.canary('reason'), say: [{ line: ctx.canary('line') }, { line: ctx.canary('line') }] }),
  };
  const script = { a01: { 3: { fault: 'illegalPlay' }, 4: { fault: 'unknownErrand' }, 5: { fault: 'staleHandle' }, 6: { fault: 'canaries' } } };
  const fake = fakeModel({ hooks, script });
  const said = {};
  for (const [seat, call] of [['a01', 1], ['a02', 1], ['a01', 2], ['a01', 3], ['a01', 4], ['a01', 5], ['a01', 6]]) {
    said[`${seat}#${call}`] = JSON.parse(await contentOf(await post(fake.fetch, IN_PROCESS, seat, call, chat(`${seat} day ${call}`))));
  }
  assert.deepEqual(said['a01#1'], { play: 1, reason: 'a01 call 1' }, 'a call with nothing scripted plays the seat\'s bot');
  assert.deepEqual(said['a02#1'], { play: 1, reason: 'a02 call 1' });
  assert.deepEqual(botAsked[0], { seat: 'a01', call: 1, body: chat('a01 day 1') }, 'the bot gets the seat, the call and the request');
  assert.deepEqual(said['a01#3'], { play: 999, reason: 'a01 call 3' }, 'a fault can build on the bot\'s reply');
  assert.deepEqual(said['a01#4'], { errands: [{ kind: 'teleport' }] });
  assert.deepEqual(earlierSeen, [['a01 day 1', 'a01 day 2', 'a01 day 3', 'a01 day 4']], 'this seat\'s earlier requests, in order, and no other seat\'s');
  const minted = fake.canaries.map(c => c.text);
  assert.equal(new Set(minted).size, 3, 'every canary is new');
  assert.deepEqual(fake.canaries.map(c => [c.seat, c.call, c.slot]), [['a01', 6, 'reason'], ['a01', 6, 'line'], ['a01', 6, 'line']]);
  assert.deepEqual([said['a01#6'].reason, ...said['a01#6'].say.map(s => s.line)], minted, 'each is in the reply, in its slot');
  assert.deepEqual(fake.calls.map(c => [c.from, c.fault]), [['bot', null], ['bot', null], ['bot', null], ['script', 'illegalPlay'],
    ['script', 'unknownErrand'], ['script', 'staleHandle'], ['script', 'canaries']]);
  assert.deepEqual(fake.failures, []);
  await fake.close();
});

test('the tape: one line per call; replayed, each call gets the same reply byte for byte, and a call that got none hangs again', async () => {
  const clock = manualClock(1000);
  const live = fakeModel({ clock, script: {
    a01: [{ json: { pick: 2 }, delayMs: 1500 }, { fault: 'hang' }, { fault: 'cutoff', json: { pick: 3, note: 'n'.repeat(40) } }],
    a02: [{ fault: 'malformed' }],
  } });
  const first = post(live.fetch, IN_PROCESS, 'a01', 1, chat('a01 day 1'));
  await clock.advance(1500);
  await first;
  const ctl = new AbortController();
  const hung = post(live.fetch, IN_PROCESS, 'a01', 2, chat('a01 day 1, the retry'), ctl.signal);
  await clock.advance(180000);
  ctl.abort();
  await assert.rejects(hung, { name: 'AbortError' });
  await post(live.fetch, IN_PROCESS, 'a02', 1, chat('a02 day 1'));
  await post(live.fetch, IN_PROCESS, 'a01', 3, chat('a01 day 2'));
  const tape = live.tape();
  await live.close();

  assert.ok(tape.endsWith('\n'));
  const lines = tape.trimEnd().split('\n').map(line => JSON.parse(line));
  for (const l of lines) {
    for (const field of ['seat', 'call', 'request', 'reply', 'start', 'ms', 'tokens']) assert.ok(field in l, `${field} on every line`);
  }
  assert.deepEqual(lines.map(l => [l.seat, l.call, l.start, l.ms]),
    [['a01', 1, 1000, 1500], ['a01', 2, 2500, 180000], ['a01', 3, 182500, 0], ['a02', 1, 182500, 0]],
    'by seat, then call number, whatever order the calls ended in; start and ms on the clock');
  assert.deepEqual(lines[0].request, chat('a01 day 1'), 'the request as sent');
  assert.deepEqual([lines[1].reply, lines[1].tokens], [null, null], 'the call that got no reply has none');
  for (const l of [lines[0], lines[2], lines[3]]) {
    assert.deepEqual(l.tokens, { in: l.reply.body.usage.prompt_tokens, out: l.reply.body.usage.completion_tokens });
  }

  const replay = fakeModel({ tape });
  for (const l of [lines[3], lines[2], lines[0]]) {
    const res = await post(replay.fetch, IN_PROCESS, l.seat, l.call, l.request);
    assert.equal(res.status, l.reply.status);
    assert.equal(await res.text(), JSON.stringify(l.reply.body), `${l.seat} call ${l.call}, byte for byte`);
  }
  const again = new AbortController();
  const hangsAgain = post(replay.fetch, IN_PROCESS, 'a01', 2, lines[1].request, again.signal);
  await turn();
  assert.equal(replay.calls.at(-1).outcome, 'pending', 'no reply, as on the tape');
  again.abort();
  await assert.rejects(hangsAgain, { name: 'AbortError' });
  assert.deepEqual(replay.calls.map(c => [c.seat, c.call, c.from]), [['a02', 1, 'tape'], ['a01', 3, 'tape'], ['a01', 1, 'tape'], ['a01', 2, 'tape']]);
  assert.deepEqual([replay.failures, replay.unused()], [[], []], 'every line was used, and nothing failed');
  await replay.close();
});

test('a request that isn\'t the one on its tape line is a typed failure, never a guess; so is a call the tape doesn\'t have', async () => {
  const request = chat('a01 day 1');
  const body = { choices: [{ index: 0, message: { role: 'assistant', content: '{"pick": 2}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 } };
  const tape = `${tapeLine({ seat: 'a01', call: 1, request, reply: { status: 200, body }, start: 0, ms: 20 })}\n`
    + `${tapeLine({ seat: 'a01', call: 2, request, reply: null, start: 20, ms: 180000 })}\n`;
  const fake = fakeModel({ tape });
  const res = await post(fake.fetch, IN_PROCESS, 'a01', 1, chat('a01 day 1!'));
  assert.equal(res.status, 409);
  const { error } = await res.json();
  assert.equal(error.why, 'differs from the tape');
  assert.match(error.at, /messages\[1\]\.content\D+9\b/, 'it says where the requests part: the user message, at character 9');
  const missing = await post(fake.fetch, IN_PROCESS, 'a03', 1, request);
  assert.equal((await missing.json()).error.why, 'not on the tape');
  assert.deepEqual(fake.failures.map(f => [f.why, f.seat, f.call]), [['differs from the tape', 'a01', 1], ['not on the tape', 'a03', 1]]);
  assert.deepEqual(fake.calls, [], 'nothing was answered');
  assert.deepEqual(fake.unused(), [{ seat: 'a01', call: 2 }]);
  await fake.close();
  assert.equal(readTape(tape).size, 2, 'positive control: the tape reads');
  assert.throws(() => readTape(tape + tape), { why: 'twice on the tape', line: 3 });
  assert.throws(() => readTape(`${tape}{"seat": "a01"}\n`), { why: 'bad tape line', line: 3 });
  assert.throws(() => fakeModel({ tape: 'not a tape\n' }), { why: 'bad tape line', line: 1 });
});

test('every other failure is typed: not a chat call, a call asked twice, nothing scripted, a bad entry, a hook that throws', async () => {
  const fake = fakeModel({
    script: { a01: [{ content: 'fine' }, { fault: 'no such fault' }, { nothing: 'here' }, { fault: 'staleHandle' }] },
    hooks: { staleHandle: () => { throw new Error('the table broke'); } },
  });
  const ids = { [SEAT_HEADER]: 'a01', [CALL_HEADER]: '1' }, body = JSON.stringify(chat());
  const notChat = [
    fake.fetch(IN_PROCESS, { method: 'POST', body }),
    fake.fetch(IN_PROCESS, { method: 'GET', headers: ids }),
    fake.fetch('http://fake.invalid/v1/completions', { method: 'POST', body, headers: ids }),
    fake.fetch(IN_PROCESS, { method: 'POST', body: '{"messages": [', headers: ids }),
    post(fake.fetch, IN_PROCESS, 'a01', 0),
  ];
  for (const res of await Promise.all(notChat)) assert.equal(res.status, 400);
  assert.equal((await post(fake.fetch, IN_PROCESS, 'a01', 1)).status, 200, 'positive control: a chat call is answered');
  const whys = [];
  for (const [seat, call] of [['a01', 1], ['a01', 2], ['a01', 3], ['a01', 4], ['a09', 1]]) {
    const res = await post(fake.fetch, IN_PROCESS, seat, call);
    assert.equal(res.status, 409);
    whys.push((await res.json()).error.why);
  }
  assert.deepEqual(whys, ['asked twice', 'bad script', 'bad script', 'hook failed', 'nothing scripted']);
  assert.deepEqual(fake.failures.map(f => f.why), [...Array(5).fill('bad request'), ...whys]);
  const broke = fake.failures.at(-2);
  assert.deepEqual([broke.why, broke.hook, broke.error, broke.seat, broke.call], ['hook failed', 'staleHandle', 'the table broke', 'a01', 4]);
  await fake.close();
});

test('the HTTP form answers as the in-process one does, on 127.0.0.1 at a port the system picked, and close() leaves nothing open', async () => {
  const before = process.getActiveResourcesInfo();
  const script = { a01: [{ json: { pick: 1 } }, { fault: 'hang' }, { fault: 'hang' }] };
  const fake = fakeModel({ script, clock: manualClock() });
  const twin = fakeModel({ script, clock: manualClock() });
  const { url, port } = await fake.listen();
  assert.equal((await fake.listen()).url, url, 'listening again changes nothing');
  const where = new URL(url);
  assert.deepEqual([where.hostname, where.pathname, Number(where.port)], ['127.0.0.1', CHAT_PATH, port]);
  assert.ok(port > 0 && !NEVER.includes(port), `port ${port}`);
  const viaHttp = await (await post(fetch, url, 'a01', 1)).text();
  assert.equal(viaHttp, await (await post(twin.fetch, IN_PROCESS, 'a01', 1)).text(), 'the same bytes as in-process');
  const ctl = new AbortController();
  const gaveUp = post(fetch, url, 'a01', 2, chat(), ctl.signal);
  await until(() => fake.calls.length === 2, 'the second call arrived');
  ctl.abort();
  await assert.rejects(gaveUp, { name: 'AbortError' });
  await until(() => fake.calls[1].outcome === 'none', 'the fake saw the caller give up');
  const leftHanging = post(fetch, url, 'a01', 3).then(() => 'answered', () => 'dropped');
  await until(() => fake.calls.length === 3, 'the third call arrived');
  const closing = performance.now();
  await fake.close();
  const took = performance.now() - closing;
  assert.ok(took < 1000, `close() took ${Math.round(took)} ms: it shouldn't wait for an idle socket to time out`);
  await twin.close();
  assert.equal(await leftHanging, 'dropped', 'close() dropped the call still open');
  await assert.rejects(fake.listen(), /closed/);
  assert.deepEqual(await leftOpen(before), [], 'no server, socket or timer left open');
});

test('with no clock passed in, delays run on real timers, and close() clears each one still waiting and drops open calls', async () => {
  const before = process.getActiveResourcesInfo();
  const fake = fakeModel({ script: { a01: [{ content: 'soon', delayMs: 5 }, { content: 'never sent', delayMs: 60000 }, { fault: 'hang' }] } });
  assert.equal(await contentOf(await post(fake.fetch, IN_PROCESS, 'a01', 1)), 'soon');
  const slow = post(fake.fetch, IN_PROCESS, 'a01', 2).then(() => 'answered', e => (/closed/.test(e.message) ? 'closed' : e.message));
  const hung = post(fake.fetch, IN_PROCESS, 'a01', 3).then(() => 'answered', e => (/closed/.test(e.message) ? 'closed' : e.message));
  await turn();
  assert.ok(process.getActiveResourcesInfo().includes('Timeout'), 'positive control: the slow reply\'s timer runs');
  await fake.close();
  assert.deepEqual([await slow, await hung], ['closed', 'closed']);
  await assert.rejects(post(fake.fetch, IN_PROCESS, 'a01', 4), /closed/);
  assert.deepEqual(await leftOpen(before), [], 'no timer left');
});

test('nothing a test here started is still open, so the file\'s process exits on its own', async () => {
  assert.deepEqual(await leftOpen(OPEN_AT_START), []);
});
