// R2-7, the model seat and its call budget (GAME.md §17, §18, §33, §34; brief R2-agents.md, task 7; Q1, Q3, Q8, Q10).
// A seat plays an agent by calling a model through the tools: one call is the briefing in and one JSON reply out, a
// fresh request with no chat history. A call that fails gets a fixed window, then one retry whose prompt names the
// failure; then standing orders answer, then the core's default play, each marked with its origin. At most
// N.callCeiling calls a seat a day, every request counted, the retry too (Q1). Handles number on from each deal's
// `next`, so a stale one never reads as current; they're dealt from a per-season secret, never the season's seed. The
// tape records every request and reply. Nothing here calls a model: every call goes to the fake (R2-6), in-process or
// on a port the system picks, and every window runs on its manual clock. Each test imports the seat itself, so each
// fails on its own before it exists. Amounts come from N or the state a test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { checkPlay, defaultPlay } from '../rules/plays.mjs';
import { N, ROWS } from '../numbers.mjs';
import { rng, shuffle } from '../rng.mjs';
import { read, replyFormat, ACTIONS, TYPES } from '../agents/tools.mjs';
import { copyOf } from '../agents/handles.mjs';
import { fakeModel, manualClock, readTape, CHAT_PATH } from '../agents/fake-model.mjs';

const seatModule = () => import('../agents/seat.mjs');
const hooksModule = () => import('../agents/fake-hooks.mjs');
const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-seat-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
// What was open before any test ran: the file must leave its process as it found it.
const OPEN_AT_START = process.getActiveResourcesInfo();
// In-process, any URL with the endpoint's path will do: the fake never reaches the network.
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
const SEED = 404;
// The per-season secret a caller passes in (the runner draws one; never the season's seed).
const SECRET = 'a secret drawn when the season starts';
const window = () => N['gap.window'] * 1000;
const COPY_ID = /\bk\d+\b/;
const has = (x, word) => JSON.stringify(x).includes(word);
const KINDS = ['not-yet', 'never'];
const typedFailure = r => r && r.ok === false && typeof r.why === 'string' && KINDS.includes(r.kind) && typeof r.code === 'string';
const sorted = x => JSON.parse(JSON.stringify(x, (k, y) => (y && typeof y === 'object' && !Array.isArray(y) ? Object.fromEntries(Object.keys(y).sort().map(key => [key, y[key]])) : y)));

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades, seed = SEED) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// The rent for a whole season and more, so nobody named is evicted.
const housed = (g, ids = Object.keys(g.s.agents)) => ids.forEach(id => g.grant(id, 2 * N.nights * N.rent));

// What reaches the rules for one agent: each errand applied now, the ledger checked, as the season loop will (R2-8).
function applier(g, id, sent = []) {
  return {
    sent,
    apply: e => {
      sent.push(e);
      const r = g.errand(id, e.kind, e);
      const bad = r.events.find(x => x.type === 'invalid');
      return { ok: r.ok, why: r.why, kind: bad ? bad.kind : undefined };
    },
  };
}

// A stand-in for R2-4's briefing, for these tests only: the reply format, then the day, the menu and how the last call
// came out, as JSON. Every input it was given is kept.
const FORMAT = replyFormat('seat');
function stand() {
  const briefs = [];
  const brief = (r, memory, last) => {
    briefs.push({ read: r, memory, last });
    return [
      { role: 'system', content: FORMAT },
      { role: 'user', content: JSON.stringify({ day: r.view.day, me: r.view.me.id, menu: r.menu, memory: memory ?? null, last }) },
    ];
  };
  return { briefs, brief };
}

const turn = () => new Promise(resolve => setImmediate(resolve));
// A seat on a fake, on a manual clock. The lock's call gets the core's default play from the rules, as R2-8's loop will.
async function seated(g, { id = 'a01', script = {}, hooks, tape, orders, observe, at = 0, ...more } = {}) {
  const { makeSeat } = await seatModule();
  const clock = manualClock(at);
  const fake = fakeModel({ script, hooks, tape, clock });
  const { briefs, brief } = stand();
  const s = makeSeat({ id, url: IN_PROCESS, fetch: fake.fetch, secret: SECRET, brief, clock, orders, observe, ...more });
  const sent = [];
  const { apply } = applier(g, id, sent);
  // One call point. While the fake holds a call with no reply (a hang), the clock moves on to the end of its window;
  // otherwise the call is left to finish.
  const call = async (round, extra = {}) => {
    const at = round === 'lock' ? { round, defaultPlay: defaultPlay(g.s, id, g.s.day) } : { round, apply };
    let done = false;
    const p = s.call({ view: g.view(id), ...at, ...extra });
    p.then(() => { done = true; }, () => { done = true; });
    for (let i = 0; i < 1000 && !done; i++) {
      if (fake.calls.some(c => c.outcome === 'pending')) await clock.advance(window());
      else await turn();
    }
    return p;
  };
  return { seat: s, fake, clock, briefs, sent, call };
}

// A bot for a hand-built game, for these tests only: by day it forms a crew, asks a03 to sit down, answers and speaks
// in the sit-down a02 asked for, talks to its crew and says a line out loud; at the lock it lays low. Every free-text
// slot of the reply format is in it.
const talker = {
  day: view => {
    const sd = view.me.sitdowns.find(x => x.state === 'asked' && x.asked === 'them');
    // R9: an open offer it can agree in one step (its sit-down's agree precondition), only where one is set up.
    const agreeable = (view.me.actions?.invitations || []).find(x => x.agree?.ok);
    return [
      ...(view.me.crew ? [] : [{ kind: 'crew_form', name: 'the crew' }]),
      { kind: 'ask', to: 'a03', line: 'a word?' },
      ...(sd ? [{ kind: 'answer', sitdown: sd.id, accept: true, line: 'sure' }, { kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: 'pay', cash: 5 }, line: 'five?' }] : []),
      ...(agreeable ? [{ kind: 'agree', sitdown: agreeable.sitdown, line: 'deal' }] : []),
      { kind: 'chat', say: 'offer', terms: { what: 'meet' }, line: 'in?' },
      { kind: 'outloud', say: 'boast', line: 'look at me' },
      { kind: 'note', line: 'a dated journal word' },
    ];
  },
  night: () => ({ play: { kind: 'laylow' }, reason: 'stay in' }),
};
// A bot that hands its first piece to a02 and dresses in the rest, then lays low.
const giver = {
  day: view => {
    const [first, ...rest] = view.me.pieces.filter(p => !p.worn);
    return [
      ...(first ? [{ kind: 'give', to: 'a02', copy: first.copy }] : []),
      ...(rest.length ? [{ kind: 'dress', fit: Object.fromEntries(rest.map(p => [p.slot, p.copy])) }] : []),
      { kind: 'pay', to: 'a03', amount: 1, for: 'gift' },
    ];
  },
  night: () => ({ play: { kind: 'laylow' }, reason: 'stay in' }),
};

test('one call is the briefing in and one JSON reply out: a fresh request with the documented body and headers, thinking off unless the caller turns it on, no tool of its own; a valid reply becomes the right errands and play (§17, §18, §33; Q3)', async () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const A = g.hand('a01', tierCopy(g.s, 'common'));
  const B = g.hand('a01', tierCopy(g.s, 'common', t => t.slot !== g.s.copies[A].slot));
  // The seat's first briefing deals from 1 with its secret, as the test does here.
  const first = read(g.view('a01'), { audience: 'seat', seed: SECRET, from: 1 });
  const [hA, hB] = [first.deal.byCopy[A], first.deal.byCopy[B]];
  const slotA = g.s.copies[A].slot;
  const laylow = first.deal.menu.find(l => l.kind === 'laylow').n;
  const script = { a01: [
    { json: { actions: [{ act: 'dress', fit: { [slotA]: hA } }, { act: 'give', to: 'a02', piece: hB }, { act: 'pay', to: 'a03', amount: 5, for: 'gift' }] } },
    { json: { actions: [{ act: 'play', menu: laylow, reason: 'a quiet night' }] } },
  ] };
  const { seat, fake, briefs, sent, call } = await seated(g, { script, model: 'the-model' });
  const day = await call(1);
  assert.deepEqual(sorted(sent), sorted([{ kind: 'dress', fit: { [slotA]: A } }, { kind: 'give', to: 'a02', copy: B }, { kind: 'pay', to: 'a03', amount: 5, for: 'gift' }]), 'the errands, pieces by copy');
  assert.deepEqual(g.s.copies[B].holder, { k: 'agent', id: 'a02' }, 'the hand-over went through');
  assert.equal(g.s.agents.a01.outfit[slotA], A, 'dressed in the piece the handle named');
  assert.deepEqual([day.origin, day.outcome, day.calls, day.play], ['model', 'reply', 1, null]);
  assert.ok(day.results.every(r => r.ok), 'each action went through');
  const req = fake.calls[0];
  assert.deepEqual([req.seat, req.call], ['a01', 1], 'the x-seat and x-call headers: the seat, and its first call of the season');
  assert.deepEqual(Object.keys(req.request).sort(), ['chat_template_kwargs', 'messages', 'model', 'response_format'], 'only the game\'s reply format: no tools, no tool choice (§17)');
  assert.deepEqual(req.request.response_format, { type: 'json_object' });
  assert.deepEqual(req.request.chat_template_kwargs, { enable_thinking: false }, 'thinking off by default (Q3)');
  assert.equal(req.request.model, 'the-model');
  assert.deepEqual(briefs[0].read.menu, first.deal.menu, 'the briefing read the menu the tools parse');
  assert.equal(JSON.stringify(req.request.messages), JSON.stringify(stand().brief(briefs[0].read, briefs[0].memory, briefs[0].last)), 'the messages are the briefing\'s, as it wrote them');

  const lock = await call('lock');
  assert.deepEqual(lock.play, { kind: 'laylow', place: first.deal.menu[laylow - 1].place, reason: 'a quiet night' }, 'the menu\'s play, with its reason');
  assert.deepEqual([lock.origin, lock.outcome, lock.calls], ['model', 'reply', 1]);
  assert.equal(checkPlay(g.s, 'a01', lock.play, g.s.day).ok, true, 'the rules take it');
  const again = fake.calls[1];
  assert.equal(again.call, 2);
  assert.ok(again.request.messages.every(m => m.role !== 'assistant'), 'a fresh request: no reply of the model\'s in it');
  assert.equal(JSON.stringify(again.request.messages), JSON.stringify(stand().brief(briefs[1].read, briefs[1].memory, briefs[1].last)), 'only the briefing: the game holds the memory (§17), so the prompt never grows');
  assert.ok(briefs[1].read.deal === undefined && !COPY_ID.test(JSON.stringify(briefs[1])), 'the briefing never reads a copy id, nor the deal');
  assert.ok(!has(seat.record, 'a secret') && !has(again.request, 'a secret'), 'the secret stays with the caller');

  const thinking = await seated(withTrades(['smuggler', 'smuggler', 'smuggler']), { script: { a01: [{ json: { actions: [] } }] }, thinking: true });
  await thinking.call(1);
  assert.deepEqual(thinking.fake.calls[0].request.chat_template_kwargs, { enable_thinking: true }, 'on when the caller turns it on');
  assert.ok(!('model' in thinking.fake.calls[0].request), 'no model named, none sent');
  for (const f of [fake, thinking.fake]) {
    assert.deepEqual(f.failures, []);
    await f.close();
  }
});

test('each fault gives its typed outcome: malformed JSON, a reply cut off mid-JSON (its whole actions used), no reply inside the window, an endpoint error, an illegal play, an unknown errand, a stale handle and canaries in every free-text slot; each failure goes into the next briefing (§18, §33; brief R2-6, R2-7)', async () => {
  const { fakeHooks } = await hooksModule();
  // Malformed, then the bot on the retry: the retry names the failure.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const one = g.hand('a01', tierCopy(g.s, 'common'));
    g.hand('a01', tierCopy(g.s, 'common', t => t.slot !== g.s.copies[one].slot));
    const h = fakeHooks({ bots: { a01: giver }, seed: SEED });
    const { seat, fake, sent, briefs, call } = await seated(g, { script: { a01: [{ fault: 'malformed' }] }, hooks: h.hooks, observe: h.observe });
    const out = await call(1);
    assert.deepEqual(seat.record[0].attempts.map(a => a.outcome), ['malformed', 'reply'], 'malformed, then the retry');
    assert.ok(typeof seat.record[0].attempts[0].why === 'string' && fake.calls[1].request.messages.at(-1).content.includes(seat.record[0].attempts[0].why), 'the retry\'s prompt names the failure');
    assert.deepEqual([out.origin, out.calls], ['model', 2]);
    assert.equal(sent.length, 3, 'the retry\'s errands went through');
    const failed = out.results.find(r => r.code === 'malformed');
    assert.ok(typedFailure(failed), 'the failed attempt is a typed result');
    await call(2);
    assert.ok(briefs[1].last.some(r => r.code === 'malformed' && typedFailure(r)), 'and goes into the next briefing');
    assert.deepEqual(fake.failures, []);
    await fake.close();
  }
  // A reply cut off mid-JSON: its whole actions are used, and by day that's an answer (no retry). At the lock, cut
  // before the play: the errand is refused (only tonight's play counts at the lock) and the retry asks for the play.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const pays = [1, 2, 3].map(amount => ({ act: 'pay', to: 'a02', amount }));
    const whole = JSON.stringify({ actions: pays });
    const at = whole.indexOf(JSON.stringify(pays[1])) + 6;
    const menu = read(g.view('a01'), { audience: 'seat', seed: SECRET }).deal.menu;
    const lockReply = { actions: [{ act: 'pay', to: 'a02', amount: 9 }, { act: 'play', menu: menu.find(l => l.kind === 'laylow').n, reason: 'cut here' }] };
    const lockAt = JSON.stringify(lockReply).indexOf('"play"');
    const script = { a01: [{ fault: 'cutoff', json: { actions: pays }, at }, { fault: 'cutoff', json: lockReply, at: lockAt }, { json: lockReply }] };
    const { seat, fake, sent, call } = await seated(g, { script });
    const day = await call(1);
    assert.equal(fake.calls[0].reply.body.choices[0].finish_reason, 'length', 'control: the endpoint ran out of tokens');
    assert.deepEqual(sent.map(e => e.amount), [1], 'read up to where it stops: the one whole action');
    assert.deepEqual([day.outcome, day.calls, day.origin], ['cutoff', 1, 'model'], 'by day a reply with a whole action is an answer');
    const lock = await call('lock');
    assert.deepEqual(seat.record[1].attempts.map(a => a.outcome), ['cutoff', 'reply']);
    assert.match(fake.calls[2].request.messages.at(-1).content, /cut off/, 'the retry names it');
    assert.deepEqual([lock.play.kind, lock.origin, lock.calls], ['laylow', 'model', 2]);
    assert.deepEqual(sent.map(e => e.amount), [1], 'nothing reached the rules at the lock');
    assert.ok(lock.results.filter(r => r.act === 'pay').every(r => typedFailure(r) && r.kind === 'not-yet'), 'an errand at the lock is refused, typed');
    await fake.close();
  }
  // No reply inside the window: a timeout, at exactly the window on the clock; and an endpoint error. Each is retried.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const script = { a01: [{ fault: 'hang' }, { json: { actions: [] } }, { fault: 'not a fault' }, { json: { actions: [] } }] };
    const { seat, fake, call } = await seated(g, { script });
    const hung = await call(1);
    assert.deepEqual(seat.record[0].attempts.map(a => a.outcome), ['timeout', 'reply']);
    assert.deepEqual([fake.calls[0].outcome, fake.calls[0].ms], ['none', window()], 'the seat gave up at the window, on the clock');
    assert.equal(hung.calls, 2);
    const erred = await call(2);
    assert.deepEqual(seat.record[1].attempts.map(a => a.outcome), ['error', 'reply'], 'an error status is typed, and retried');
    assert.equal(erred.calls, 2);
    assert.deepEqual(fake.failures.map(f => f.why), ['bad script'], 'control: the fake refused the bad entry');
    await fake.close();
  }
  // The faults only the table can build, through the hooks: an unknown errand, a stale handle, an illegal play.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    g.hand('a01', tierCopy(g.s, 'common'));
    g.errand('a02', 'ask', { to: 'a01' });
    const h = fakeHooks({ bots: { a01: talker }, seed: SEED });
    const script = { a01: { 1: { fault: 'unknownErrand' }, 2: { fault: 'staleHandle' }, 3: { fault: 'illegalPlay' } } };
    const { seat, fake, sent, briefs, call } = await seated(g, { script, hooks: h.hooks, observe: h.observe });
    const unknown = await call(1);
    const teleport = unknown.results.filter(r => !r.ok);
    assert.equal(teleport.length, 1);
    assert.deepEqual([teleport[0].code, teleport[0].kind], ['action', 'never'], 'an unknown errand: typed, never');
    assert.deepEqual(sent.map(e => e.kind), ['crew_form', 'ask', 'answer', 'say', 'chat', 'outloud', 'note'], 'the bot\'s own errands still went through');
    assert.equal(unknown.calls, 1, 'not a failed call: no retry');
    const old = briefs[0].read;
    const before = sent.length;
    const stale = await call(2);
    const refused = stale.results.find(r => r.act === 'dress');
    assert.deepEqual([refused.ok, refused.code, refused.kind], [false, 'handle', 'not-yet'], 'a stale handle: not yet');
    assert.ok(sent.slice(before).every(e => e.kind !== 'dress'), 'and it never reached the rules');
    const staleAction = JSON.parse(fake.calls[1].reply.body.choices[0].message.content).actions.find(a => a.act === 'dress');
    const [[slot, handle]] = Object.entries(staleAction.fit);
    assert.equal(old.view.me.pieces.find(p => p.copy === handle).slot, slot, 'control: in the older briefing it named the seat\'s own piece');
    assert.ok(Number(handle.slice(1)) < Math.min(...briefs[1].read.view.me.pieces.map(p => Number(p.copy.slice(1)))), 'handles numbered on: the old one is below the seat\'s pieces\' handles now');
    const restarted = read(g.view('a01'), { audience: 'seat', seed: SECRET, from: 1 }).deal;
    assert.equal(copyOf(restarted, handle).ok, true, 'without the counter it would have read as a piece of today\'s briefing');
    const illegal = await call('lock');
    assert.deepEqual(seat.record[2].attempts.map(a => a.outcome), ['reply', 'reply']);
    const bad = illegal.results.find(r => r.act === 'play' && !r.ok);
    assert.deepEqual([bad.code, bad.kind], ['off-menu', 'never'], 'an illegal play: off the menu, never');
    assert.ok(fake.calls[3].request.messages.at(-1).content.includes(bad.why), 'the retry names the refusal');
    assert.deepEqual([illegal.play.kind, illegal.origin, illegal.calls], ['laylow', 'model', 2], 'the retry\'s play stands');
    assert.deepEqual(fake.failures, []);
    await fake.close();
  }
  // Canaries in every free-text slot of the seat's reply format: each reaches the rules once, in its own slot.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    g.errand('a02', 'ask', { to: 'a01' });
    // R9: a03's open offer to sell, so the talker's agree (and its line's canary) reaches the rules.
    g.errand('a03', 'ask', { to: 'a01' });
    const offered = g.events('ask').at(-1).sitdown;
    g.errand('a01', 'answer', { sitdown: offered, accept: true });
    g.errand('a03', 'say', { sitdown: offered, say: 'offer', terms: { what: 'sell', goods: { parts: 1 }, cash: 10 } });
    const h = fakeHooks({ bots: { a01: talker }, seed: SEED });
    const { seat, fake, sent, call } = await seated(g, { script: { a01: [{ fault: 'canaries' }, { fault: 'canaries' }] }, hooks: h.hooks, observe: h.observe });
    const day = await call(1);
    const lock = await call('lock');
    assert.deepEqual([day.origin, lock.origin], ['model', 'model'], 'control: both answered');
    const reached = [...sent, { play: lock.play }];
    const minted = fake.canaries.map(c => c.text);
    const slots = new Set(fake.canaries.map(c => c.slot));
    const freeSlots = ACTIONS.filter(a => a.built === true && a.who.includes('seat') && a.act !== 'read')
      .flatMap(a => Object.entries(a.fields).filter(([, t]) => TYPES[t.replace('?', '')].free).map(([f]) => `${a.act}.${f}`));
    assert.deepEqual([...slots].sort(), [...freeSlots].sort(), 'a canary in every free-text slot of the seat\'s reply format');
    for (const text of minted) {
      const where = [];
      const find = (x, at) => {
        if (typeof x === 'string' && x.includes(text)) where.push(at);
        else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) find(y, k);
      };
      find(reached, null);
      assert.equal(where.length, 1, `${text}: reached the rules once`);
      assert.ok(['line', 'name', 'reason'].includes(where[0]), `${text}: only in a free-text field, here ${where[0]}`);
      assert.ok(!has(seat.record, text), `${text}: never in the seat's record`);
      assert.ok(!has(day.results.concat(lock.results).filter(r => !r.ok), text), `${text}: no failure echoes it`);
    }
    assert.deepEqual(fake.failures, []);
    await fake.close();
  }
});

test('the retry happens once: a second failure falls back, and no third request goes out; a call that works isn\'t retried; the retry is the same briefing with one more message, naming the failure (§18, §33, §34: "a fixed window, one retry, then the default")', async () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const tries = 1 + N['gap.retry'];
  const script = { a01: [...Array(tries).fill({ fault: 'hang' }), ...Array(tries).fill({ fault: 'malformed' }), { json: { actions: [] } }] };
  const { seat, fake, clock, sent, call } = await seated(g, { script });
  const lock = await call('lock');
  assert.equal(fake.calls.length, tries, 'the call and its retry');
  assert.deepEqual(fake.calls.map(c => c.outcome), Array(tries).fill('none'));
  const [one, two] = fake.calls.map(c => c.request);
  assert.deepEqual(two.messages.slice(0, -1), one.messages, 'the same briefing');
  assert.equal(two.messages.at(-1).role, 'user');
  assert.ok(two.messages.at(-1).content.includes(String(N['gap.window'])), 'naming the failure: no reply inside the window');
  assert.deepEqual({ ...two, messages: null }, { ...one, messages: null }, 'and otherwise the same request');
  assert.deepEqual([lock.origin, lock.calls, lock.outcome], ['default', tries, 'timeout']);
  await clock.advance(10 * window());
  assert.equal(fake.calls.length, tries, 'no third request');
  // By day: malformed twice, then nothing more: nothing reached the rules, and the seat answered with nothing.
  g.night({ a01: lock.play });
  const day = await call(1);
  assert.deepEqual([day.origin, day.calls, sent.length], ['default', tries, 0]);
  assert.deepEqual(seat.record[1].attempts.map(a => a.outcome), Array(tries).fill('malformed'));
  const fine = await call(2);
  assert.deepEqual([fine.calls, fine.origin], [1, 'model'], 'a call that works is not retried');
  assert.deepEqual(fake.unused(), []);
  await fake.close();
});

test('the fallback answers, with its origin: at the lock tonight\'s pick from earlier in the day, then standing orders read from the view, then the core\'s default play; by day standing orders\' errands; a no-show is never an invalid play (§17, §18; Q8)', async () => {
  const fail = { fault: 'malformed' };
  // A call point nobody answers: the call and its retry, each malformed.
  const none = Array(1 + N['gap.retry']).fill(fail);
  // No orders (Q8: none for the first season): the default play, which the rules take as the agent's own.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const { fake, call } = await seated(g, { script: { a01: none } });
    const out = await call('lock');
    assert.deepEqual([out.play, out.origin], [defaultPlay(g.s, 'a01', g.s.day), 'default'], 'the core\'s default play');
    assert.ok(out.results.some(r => r.act === 'play' && r.ok && r.origin === 'default'), 'the next briefing says the default played');
    const night = g.night({ a01: out.play });
    assert.equal(night.newEvents.filter(e => e.type === 'invalid' && e.agent === 'a01').length, 0, 'a no-show is not an invalid play');
    assert.equal(night.newEvents.find(e => e.type === 'play' && e.agent === 'a01').kind, out.play.kind);
    const missing = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(missing);
    const control = missing.night({}, { exact: true });
    assert.ok(control.newEvents.some(e => e.type === 'invalid' && e.agent === 'a01'), 'positive control: the core logs a missing play as invalid');
    await fake.close();
  }
  // Standing orders, read from the view as a bot would (a stand-in until R2-2 builds them): their play at the lock,
  // their errands by day; an order whose play isn't on tonight's menu gives way to the default play.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const consulted = [];
    const orders = (view, round) => {
      consulted.push(round);
      return round === 'lock' ? { play: { kind: 'hustle', place: 'docks' }, reason: 'standing order: work' } : { errands: [{ kind: 'pay', to: 'a02', amount: 2 }] };
    };
    const { fake, sent, call } = await seated(g, { script: { a01: [...none, { json: { actions: [] } }, ...none] }, orders });
    const day = await call(1);
    assert.deepEqual([day.origin, sent], ['orders', [{ kind: 'pay', to: 'a02', amount: 2 }]], 'by day, the orders\' errands');
    const answered = await call(2);
    assert.equal(answered.origin, 'model', 'control: a call the model answered');
    const lock = await call('lock');
    assert.deepEqual([lock.play, lock.origin], [{ kind: 'hustle', place: 'docks', reason: 'standing order: work' }, 'orders']);
    assert.deepEqual(consulted, [1, 'lock'], 'the orders answer only when nobody did');
    const off = await seated(withTrades(['smuggler', 'smuggler', 'smuggler']), { script: { a01: none }, orders: () => ({ play: { kind: 'collar', target: 'a02', place: 'docks' } }) });
    const offOut = await off.call('lock');
    assert.deepEqual([offOut.origin, offOut.play.kind], ['default', defaultPlay(g.s, 'a01', 1).kind], 'an order off the menu gives way to the default');
    await fake.close();
    await off.fake.close();
  }
  // Tonight's pick: a play the model sent by day plays when the lock's call and its retry fail (§17: "if you're not
  // there at the lock, your agent's pick plays"), checked against the lock's menu first.
  {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const menu = read(g.view('a01'), { audience: 'seat', seed: SECRET }).deal.menu;
    const shift = menu.find(l => l.kind === 'hustle');
    const { fake, call } = await seated(g, { script: { a01: [{ json: { actions: [{ act: 'play', menu: shift.n, reason: 'work tonight' }] } }, ...none] } });
    const day = await call(1);
    assert.equal(day.play, null, 'by day the seat hands no play to the lock');
    const lock = await call('lock');
    assert.deepEqual([lock.play, lock.origin], [{ kind: 'hustle', place: shift.place, reason: 'work tonight' }, 'model']);
    await fake.close();
  }
});

test('the ceiling holds: at most N.callCeiling calls a seat a day, every request counted, the retry too (Q1); past it the seat falls back without calling, and the next day it calls again (§18, §34)', async () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const ok = { json: { actions: [] } };
  // Day 1: the 3rd call times out and is retried, so the ceiling is reached a call point early.
  const script = { a01: Array.from({ length: N.callCeiling + 6 }, (_, i) => (i === 2 ? { fault: 'hang' } : ok)) };
  const { seat, fake, call } = await seated(g, { script });
  const outs = [];
  for (let i = 0; i < N.callCeiling + 2; i++) outs.push(await call(1 + (i % 3)));
  const lock = await call('lock');
  assert.equal(fake.calls.length, N.callCeiling, 'exactly the ceiling\'s requests went out on day 1');
  assert.equal(seat.record.filter(r => r.day === 1).flatMap(r => r.attempts).filter(a => a.call !== null).length, N.callCeiling, 'and the record counts them');
  const past = outs.filter(o => o.calls === 0);
  assert.equal(past.length, 3, 'the retry used one: three call points past the ceiling');
  assert.ok(past.every(o => o.outcome === 'ceiling' && o.origin === 'default'), 'each typed, answered without a call');
  assert.deepEqual([lock.calls, lock.outcome, lock.origin, lock.play], [0, 'ceiling', 'default', defaultPlay(g.s, 'a01', 1)], 'the lock too: the default play, no call');
  g.night({ a01: lock.play });
  const next = await call(1);
  assert.deepEqual([next.calls, next.origin], [1, 'model'], 'the next day it calls again');
  assert.equal(fake.calls.at(-1).call, N.callCeiling + 1, 'the season\'s call numbers run on');
  // The ceiling stops a retry too.
  const g2 = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g2);
  const s2 = await seated(g2, { script: { a01: Array.from({ length: N.callCeiling }, (_, i) => (i === N.callCeiling - 1 ? { fault: 'hang' } : ok)) } });
  for (let i = 0; i < N.callCeiling - 1; i++) await s2.call(1);
  const last = await s2.call('lock');
  assert.deepEqual(s2.seat.record.at(-1).attempts.map(a => a.outcome), ['timeout', 'ceiling'], 'no retry past the ceiling');
  assert.deepEqual([last.calls, last.origin], [1, 'default']);
  assert.equal(s2.fake.calls.length, N.callCeiling);
  await fake.close();
  await s2.fake.close();
});

test('a seat\'s calls replay byte for byte from its tape: every request and reply, with timings and the API\'s token counts; replayed, each request is the one on the tape, gets the same reply, and the seat does the same (§18; brief R2-6, R2-7)', async () => {
  const ok = actions => ({ json: { actions } });
  // Two days: a reply, a cut-off reply, no reply then the retry, a refused play then the retry, malformed twice.
  const script = { a01: [
    ok([{ act: 'pay', to: 'a02', amount: 3 }]), { fault: 'cutoff', json: { actions: [{ act: 'pay', to: 'a02', amount: 4 }, { act: 'pay', to: 'a03', amount: 5 }] }, at: 40 },
    { fault: 'hang' }, ok([]), ok([{ act: 'play', menu: 999 }]), ok([{ act: 'play', kind: 'laylow', reason: 'in' }]),
    { fault: 'malformed' }, { fault: 'malformed' }, ok([{ act: 'play', kind: 'hustle', place: 'docks' }]),
  ] };
  const play = async options => {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
    housed(g);
    const s = await seated(g, options);
    const outs = [];
    for (const round of [1, 2, 3, 'lock', 1, 'lock']) {
      const out = await s.call(round);
      outs.push(out);
      if (round === 'lock') g.night({ a01: out.play });
    }
    await s.fake.close();
    return { tape: s.seat.tape(), outs, sent: s.sent, log: g.log, fake: s.fake, record: s.seat.record };
  };
  const live = await play({ script });
  const lines = live.tape.trimEnd().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, live.fake.calls.length, 'a line for every request');
  assert.deepEqual(lines.map(l => [l.seat, l.call]), live.fake.calls.map(c => ['a01', c.call]));
  for (const [i, l] of lines.entries()) {
    for (const f of ['seat', 'call', 'request', 'reply', 'start', 'ms', 'tokens']) assert.ok(f in l, `${f} on every line`);
    assert.deepEqual(l.request, live.fake.calls[i].request, 'the request as sent');
    if (l.reply === null) assert.deepEqual([l.tokens, l.ms], [null, window()], 'no reply: no tokens, and the whole window');
    else assert.deepEqual(l.tokens, { in: l.reply.body.usage.prompt_tokens, out: l.reply.body.usage.completion_tokens }, 'the API\'s token counts');
  }
  assert.equal(readTape(live.tape).size, lines.length, 'control: the fake reads it as a tape');
  const again = await play({ tape: live.tape });
  assert.deepEqual([again.fake.failures, again.fake.unused()], [[], []], 'every request was the one on its line, and every line was used');
  assert.ok(again.fake.calls.every(c => c.from === 'tape'), 'answered from the tape alone');
  assert.equal(again.tape, live.tape, 'the replay\'s tape is the live one, byte for byte');
  assert.deepEqual(again.outs, live.outs, 'the seat did the same');
  assert.deepEqual(again.sent, live.sent, 'the same errands reached the rules');
  assert.deepEqual(again.record, live.record);
  assert.equal(JSON.stringify(again.log), JSON.stringify(live.log), 'the same season');
  // A run killed after night 1 goes on from the seat's saved memo and record, its calls answered from the tape: day 2
  // as the run that wasn't killed played it, each line handed on as it was written, and no call of day 1 asked again.
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const day1 = await seated(g, { script });
  for (const round of [1, 2, 3, 'lock']) {
    const out = await day1.call(round);
    if (round === 'lock') g.night({ a01: out.play });
  }
  const saved = JSON.parse(JSON.stringify({ memo: day1.seat.memo, record: day1.seat.record }));
  const before = day1.seat.tape().trimEnd().split('\n');
  await day1.fake.close();
  const streamed = [];
  const resumed = await seated(g, { tape: live.tape, memo: saved.memo, record: saved.record, onTape: l => streamed.push(l), at: day1.clock.now() });
  const outs = [];
  for (const round of [1, 'lock']) outs.push(await resumed.call(round));
  await resumed.fake.close();
  assert.deepEqual(outs, live.outs.slice(4), 'day 2, as it was played');
  assert.deepEqual(resumed.seat.record, live.record, 'the record goes on');
  assert.deepEqual(streamed, live.tape.trimEnd().split('\n').slice(before.length), 'each line handed on as it was written');
  assert.deepEqual(resumed.fake.unused().map(c => c.call), before.map(l => JSON.parse(l).call), 'no call of day 1 asked again');
  assert.deepEqual(resumed.fake.failures, []);
});

test('handles number on across a seat\'s calls, from each deal\'s next to the next read\'s from, and are dealt from the per-season secret, never the season\'s seed; a handle the seat read back in its last results is shown under today\'s (brief R2-3, R2-7; the orchestrator\'s calls)', async () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  // Four copies of one trait in the seat's own stash tie in the deal (one holder, one trait): the shuffle orders them.
  const T = Object.values(g.s.traits).filter(t => t.tier === 'common' && !t.ability && t.copies.length >= 4).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  const ties = T.copies.slice(0, 4).map(k => g.hand('a01', k));
  const worn = g.hand('a02', tierCopy(g.s, 'rare'), { wear: true });
  const first = read(g.view('a01'), { audience: 'seat', seed: SECRET, from: 1 }).deal;
  const bySeed = read(g.view('a01'), { audience: 'seat', seed: SEED, from: 1 }).deal;
  // A tie whose handle the season's seed would have given another copy.
  const tie = ties.find(k => bySeed.byHandle[first.byCopy[k]] !== k);
  assert.ok(tie, 'positive control: the seed deals the ties another way than the secret');
  const script = { a01: [
    { json: { actions: [{ act: 'give', to: 'a03', piece: first.byCopy[tie] }, { act: 'play', kind: 'hit', target: 'a02', place: 'docks', want: first.byCopy[worn] }] } },
    { json: { actions: [] } }, { json: { actions: [] } },
  ] };
  const { briefs, fake, sent, call } = await seated(g, { script });
  for (const round of [1, 2, 3]) await call(round);
  assert.equal(sent[0].copy, tie, 'the seat dealt by the secret the caller passed in: the handle named that copy');
  assert.equal(briefs[0].read.deal, undefined, 'the briefing never gets the deal');
  // Each briefing's handles: its own pieces, and the piece a02 wears.
  const handlesOf = b => [...b.read.view.me.pieces.map(p => p.copy), ...b.read.view.board.agents.find(a => a.id === 'a02').fit.map(p => p.copy)].map(h => Number(h.slice(1)));
  const ranges = briefs.map(b => [Math.min(...handlesOf(b)), Math.max(...handlesOf(b))]);
  assert.equal(ranges[0][0], 1, 'the first briefing deals from 1');
  for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i][0] > ranges[i - 1][1], `briefing ${i + 1} numbers on past briefing ${i}`);
  // The hit's want, read back in the next briefing, under that briefing's handle for the same piece.
  const shown = briefs[1].last.find(r => r.act === 'play');
  const now = read(g.view('a01'), { audience: 'seat', seed: SECRET, from: ranges[1][0] }).deal;
  assert.equal(shown.play.want, now.byCopy[worn], 'the want, under today\'s handle');
  assert.notEqual(shown.play.want, first.byCopy[worn], 'not the stale one');
  await fake.close();
});

test('a reply cut off mid-JSON is read up to where it stops: the whole actions of its list, words inside strings never taken for structure (brief R2-7; sim2\'s brain.mjs, rewritten)', async () => {
  const { keptActions } = await seatModule();
  const A = { act: 'pay', to: 'a02', amount: 1 };
  const B = { act: 'say', sitdown: 's1', say: 'offer', terms: { what: 'trade', goods: { chems: 2 } }, line: 'a "quoted" {brace} [and] \\ back,slash' };
  const C = { act: 'play', menu: 3, reason: 'end' };
  const whole = JSON.stringify({ actions: [A, B, C] });
  for (let cut = 0; cut <= whole.length; cut++) {
    const kept = keptActions(whole.slice(0, cut));
    const wholeBefore = [A, B, C].filter(x => whole.indexOf(JSON.stringify(x)) + JSON.stringify(x).length <= cut);
    assert.deepEqual(kept, wholeBefore, `cut at ${cut}`);
  }
  assert.deepEqual(keptActions(`${JSON.stringify([A, B])}, and some words`), [A, B], 'a bare list, with words after it');
  assert.deepEqual(keptActions('{"note": {"actions": [{"act": "pay"}]}, "actions": [{"act": "rent"}, 7, "x", {"act": "pl'), [{ act: 'rent' }], 'only the reply\'s own list, only whole objects');
  assert.deepEqual(keptActions('{"actions": [{"act": "rent", "x": tru}, {"act": "rent"}'), [{ act: 'rent' }], 'a garbled item counts for nothing');
  assert.deepEqual(keptActions('{ this reply is not JSON }'), []);
  assert.deepEqual(keptActions('{"act": "play", "menu": 3, "reas'), [], 'one action cut off is no action');
});

test('the bot hook over a whole layer4 season (the first from seed 404, rule A, with no SUDO night whose taker sent a break-in): every seat is a model seat on the fake, its own bot speaking through the reply format; every errand and every play on the menu goes into a reply and back without loss, the season is the runner\'s, event for event, but for what the crash nights recorded as sent, and no seat-day passes the ceiling (brief R2-6, R2-7, R2-8)', async () => {
  const { makeSeat } = await seatModule();
  const { fakeHooks } = await hooksModule();
  const { makeCast, makeBot, CASTS } = await import('../bench/bots.mjs');
  const { runSeason, MIDSEASON_ROTATION } = await import('../bench/runner.mjs');
  // R4-4's re-pin, as R4-3's handles.test.mjs picks its season: the first seed from SEED whose runner season holds no
  // SUDO night whose taker sent a break-in. On such a night a seat's play records the place its menu line fills in,
  // R2-7's expected difference, which models.test.mjs checks; this test allows only the crash nights'. Since R4-4 SUDO
  // writes go through to day 13, and seed 404's season has two such nights.
  const [rule, rounds] = ['A', 3];
  let seed = null;
  for (let k = SEED; k < SEED + 40 && seed === null; k++) {
    const scan = runSeason({ seed: k, rule, rounds, outDir: path.join(tmp, 'scan'), mix: CASTS.layer4 });
    const log = fs.readFileSync(path.join(scan.dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    if (!log.some(e => e.type === 'forced' && e.why === 'sudo' && e.play && e.play.kind === 'breakin')) seed = k;
  }
  assert.ok(seed !== null, 'control: a season from seed 404 has no SUDO night whose taker sent a break-in');
  const midseason = MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length];
  const cast = makeCast(seed, CASTS.layer4);
  const r = newSeason({ seed, rule, midseason, items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  let s = r.state;
  const log = [...r.events];
  const memos = {};
  const every = cast.some(c => c.works);
  const bots = Object.fromEntries(cast.map(c => [c.id, makeBot(every ? { ...c, every } : c, (memos[c.id] ||= {}))]));
  const ids = Object.keys(s.agents).sort();
  // What each bot said at each call point, and how often it was asked (a retry hears the same answer).
  const said = new Map();
  const asked = new Map();
  const note = (key, x) => {
    said.set(key, x);
    asked.set(key, (asked.get(key) || 0) + 1);
    return x;
  };
  const speaking = Object.fromEntries(ids.map(id => [id, {
    day: (v, c) => note(`${id}#${c.day}#${c.round}`, bots[id].day(v, c)),
    night: (v, c) => note(`${id}#${c.day}#lock`, bots[id].night(v, c)),
  }]));
  const h = fakeHooks({ bots: speaking, seed, rounds });
  const clock = manualClock();
  const fake = fakeModel({ hooks: h.hooks, clock });
  const brief = rd => [{ role: 'user', content: `${rd.view.me.id}, day ${rd.view.day}: ${rd.menu.length} lines on the menu` }];
  const seats = Object.fromEntries(ids.map(id => [id, makeSeat({ id, url: IN_PROCESS, fetch: fake.fetch, secret: SECRET, brief, clock, observe: h.observe })]));
  const lost = [];
  const offMenu = new Set();
  let errands = 0;
  let plays = 0;
  while (!s.over) {
    const day = s.day;
    for (let round = 1; round <= rounds; round++) {
      for (const id of shuffle(rng(seed, 'order', day, round), ids)) {
        const got = [];
        const apply = e => {
          got.push(e);
          const res = applyErrand(s, { ...e, by: id });
          s = res.state;
          log.push(...res.events);
          checkLedger(s, `day ${day} round ${round} ${id} ${e.kind}`);
          const bad = res.events.find(x => x.type === 'invalid');
          return { ok: res.ok, why: res.why, kind: bad ? bad.kind : undefined };
        };
        const out = await seats[id].call({ view: viewFor(s, log, id, 'agent'), apply, round });
        const want = said.get(`${id}#${day}#${round}`);
        errands += want.length;
        if (JSON.stringify(sorted(want)) !== JSON.stringify(sorted(got)) || out.origin !== 'model' || out.calls !== 1) lost.push({ id, day, round, want, got, out });
      }
    }
    const tonight = {};
    for (const id of ids) {
      if (s.agents[id].jail) continue;
      const view = viewFor(s, log, id, 'agent');
      const out = await seats[id].call({ view, round: 'lock', defaultPlay: defaultPlay(s, id, day) });
      const bot = said.get(`${id}#${day}#lock`);
      plays += 1;
      if (out.origin === 'model') {
        const [mine, theirs] = [checkPlay(s, id, out.play, day), checkPlay(s, id, bot.play, day)];
        if (JSON.stringify(mine) !== JSON.stringify(theirs) || out.play.reason !== bot.reason) lost.push({ id, day, bot, out });
      } else {
        // The bot's own play wasn't on tonight's menu: refused, typed, on the call and its retry; then the default.
        const refused = out.results.filter(x => x.act === 'play' && x.code === 'off-menu');
        if (refused.length !== 1 + N['gap.retry'] || out.origin !== 'default' || JSON.stringify(out.play) !== JSON.stringify(defaultPlay(s, id, day))) lost.push({ id, day, bot, out });
        offMenu.add(`${id}#${day}`);
      }
      tonight[id] = out.play;
    }
    const night = settleNight(s, tonight);
    s = night.state;
    log.push(...night.events);
    checkLedger(s, `night ${day}`);
  }
  await fake.close();
  assert.deepEqual(lost, [], 'every errand reached the rules as the bot made it (key order aside), and every play on the menu as the bot played it, with its reason');
  assert.ok(errands > 0 && plays > 0, `control: ${errands} errands and ${plays} plays went through`);
  assert.ok([...asked.values()].every(n => n === 1), 'each bot was asked once a call point: a retry heard the same answer');
  assert.deepEqual(fake.failures, []);
  // Every play the bot made off the menu was on a night a crash or a withdrawal forced the default play anyway.
  const forced = new Set(log.filter(e => e.type === 'forced' && ['crash', 'withdrawal'].includes(e.why)).map(e => `${e.agent}#${e.day}`));
  assert.ok([...offMenu].every(k => forced.has(k)), `the off-menu plays (${[...offMenu].join(', ')}) were all forced nights`);
  // The runner's season, event for event, but for what those nights recorded as sent: the forced event's play (the
  // default play the seat sent, not the bot's) and the play's reason (the default play carries no words).
  const { dir } = runSeason({ seed, rule, rounds, outDir: tmp, mix: CASTS.layer4 });
  const ran = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.equal(log.length, ran.length, 'as many events as the runner\'s season');
  const sentOnly = e => (offMenu.has(`${e.agent}#${e.day}`) && e.t === 2 * e.day + 1 && ['forced', 'play'].includes(e.type) ? { ...e, play: null, reason: null } : e);
  const differ = log.filter((e, i) => JSON.stringify(e) !== JSON.stringify(ran[i]));
  assert.ok(differ.every(e => sentOnly(e) !== e), 'only those nights\' forced and play events differ');
  assert.equal(differ.length, 2 * offMenu.size, 'each of them, and nothing else');
  assert.ok(log.every((e, i) => JSON.stringify(sentOnly(e)) === JSON.stringify(sentOnly(ran[i]))), 'event for event');
  // The ceiling: no seat-day over it.
  const perDay = new Map();
  for (const [id, seat] of Object.entries(seats)) for (const rec of seat.record) perDay.set(`${id}#${rec.day}`, (perDay.get(`${id}#${rec.day}`) || 0) + rec.attempts.filter(a => a.call !== null).length);
  assert.ok(Math.max(...perDay.values()) <= N.callCeiling, `the most calls in a seat-day: ${Math.max(...perDay.values())}`);
});

test('the URL and fetch are passed in, with no default: nothing reaches 127.0.0.1:8000 unless a caller passes it; over HTTP, the seat calls the fake on a port the system picked (brief R2-7; CLAUDE.md: no model run without slime\'s go)', async () => {
  const { makeSeat } = await seatModule();
  const { brief } = stand();
  assert.throws(() => makeSeat({ id: 'a01', secret: SECRET, brief, fetch: () => {} }), /url/);
  assert.throws(() => makeSeat({ id: 'a01', secret: SECRET, brief, url: IN_PROCESS }), /fetch/);
  assert.throws(() => makeSeat({ id: 'a01', brief, url: IN_PROCESS, fetch: () => {} }), /secret/);
  const src = fs.readFileSync(path.join(core, 'agents', 'seat.mjs'), 'utf8');
  for (const word of ['8000', '127.0.0.1', 'localhost', 'globalThis.fetch']) assert.ok(!src.includes(word), `the seat names no ${word}`);
  // Over HTTP: the real fetch, to the fake's own port.
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const clock = manualClock();
  const fake = fakeModel({ script: { a01: [{ json: { actions: [{ act: 'pay', to: 'a02', amount: 1 }] } }] }, clock });
  const { url, port } = await fake.listen();
  assert.ok(![8000, 5601, 5602, 5613, 5615, 5262, 5265, 5340].includes(port), `port ${port}`);
  const urls = [];
  const s = makeSeat({ id: 'a01', url, fetch: (u, init) => (urls.push(u), fetch(u, init)), secret: SECRET, brief, clock });
  const { sent, apply } = applier(g, 'a01');
  const out = await s.call({ view: g.view('a01'), apply, round: 1 });
  assert.deepEqual([out.origin, out.outcome, sent.length], ['model', 'reply', 1]);
  assert.deepEqual(urls, [url], 'it called only the url it was given');
  assert.deepEqual([fake.calls[0].seat, fake.calls[0].call], ['a01', 1], 'the headers crossed the wire');
  await fake.close();
});

test('the new numbers: the window and the retry are GAP rows and the ceiling a RULE row, each with its reference and note (brief R2-7; numbers.mjs)', () => {
  for (const [key, status] of [['gap.window', 'GAP'], ['gap.retry', 'GAP'], ['callCeiling', 'RULE']]) {
    const row = ROWS.find(x => x.key === key);
    assert.ok(row, `${key}: a row`);
    assert.equal(row.status, status, `${key}: a ${status} row`);
    assert.ok(row.ref.includes('§18') && row.note.length > 0, `${key}: its reference and note`);
  }
  assert.ok(N['gap.window'] > 0 && Number.isInteger(N['gap.retry']) && N['gap.retry'] >= 1 && Number.isInteger(N.callCeiling) && N.callCeiling >= 1);
  const rows = fs.readFileSync(path.join(core, 'reports', 'NUMBERS.md'), 'utf8');
  for (const key of ['gap.window', 'gap.retry', 'callCeiling']) assert.ok(rows.includes(`| ${key} |`), `${key}: in NUMBERS.md`);
});

test('nothing a test here started is still open, so the file\'s process exits on its own', async () => {
  const turn = () => new Promise(resolve => setImmediate(resolve));
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
