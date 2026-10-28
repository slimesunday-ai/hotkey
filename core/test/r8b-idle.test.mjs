// R8b, idle days in tools mode (GAME.md §33; the R8 hand-back: the idle-day retry inflated fake seasons, 219 calls
// against 159). By day the starter version's tools mode sends tool_choice "auto", so a model may call nothing, and a
// reply with no tool call and no text means "nothing this call": no retry, not malformed. Text without a call stays
// malformed, with the one retry. At the lock R8's behaviour stays: "required", and a reply with no call is malformed,
// retried once, then the default play. JSON mode is unchanged. Nothing here calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { starterBriefingPacket } from '../agents/briefing.mjs';
import { fakeModel, manualClock, CHAT_PATH, readTape } from '../agents/fake-model.mjs';
import { fakeOpenRouter } from '../agents/fake-openrouter.mjs';
import { openRouter } from '../agents/openrouter.mjs';

const KEY = 'sk-or-v1-r8b-dummy-key';
const APIS = ['local', 'openrouter'];
const turn = () => new Promise(resolve => setImmediate(resolve));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8b-idle-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function game() {
  const g = new Game({ n: 4 });
  for (const id of ['a01', 'a02', 'a03', 'a04']) g.grant(id, 2 * N.nights * N.rent);
  return g;
}
async function seatOn(api, g, script, more = {}) {
  const { makeSeat } = await import('../agents/seat.mjs');
  const clock = manualClock();
  const fake = api === 'local' ? fakeModel({ script, clock }) : fakeOpenRouter({ key: KEY, script, clock });
  const send = api === 'local' ? fake.fetch : openRouter({ fetch: fake.fetch, key: KEY, maxCost: 5, clock }).fetch;
  const seat = makeSeat({
    id: 'a01', url: api === 'local' ? `http://fake.invalid${CHAT_PATH}` : 'http://openrouter.invalid/api/v1/chat/completions', fetch: send, secret: 'r8b', clock, model: 'test/model', api,
    brief: (r, memory, last, round, context) => starterBriefingPacket(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }), reply: 'tools', ...more,
  });
  const call = async (round = 1) => {
    const at = round === 'lock' ? { round, defaultPlay: defaultPlay(g.s, 'a01', g.s.day) } : { round, apply: e => { const r = g.errand('a01', e.kind, e); return { ok: r.ok, why: r.why }; } };
    let done = false;
    const p = seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), validatePlay: x => checkPlay(g.s, 'a01', x, g.s.day), ...at });
    p.then(() => { done = true; }, () => { done = true; });
    for (let i = 0; i < 1000 && !done; i++) {
      if (fake.calls.some(c => c.outcome === 'pending')) await clock.advance(N['gap.window'] * 1000);
      else await turn();
    }
    return p;
  };
  return { seat, fake, call, requests: () => fake.calls.map(c => c.request) };
}

test('by day, a seat with dayToolChoice "auto" sends tool_choice "auto"; at the lock "required", as R8; a thinking seat "auto" throughout', async () => {
  for (const api of APIS) {
    for (const thinking of [false, true]) {
      const g = game();
      const s = await seatOn(api, g, { a01: [{ toolCalls: [] }, { toolCalls: [{ id: 'c1', type: 'function', function: { name: 'play', arguments: '{"kind":"laylow"}' } }] }] }, { dayToolChoice: 'auto', thinking });
      await s.call(1);
      await s.call('lock');
      assert.deepEqual(s.requests().map(b => b.tool_choice), thinking ? ['auto', 'auto'] : ['auto', 'required'], `${api}, thinking ${thinking}`);
      await s.fake.close();
    }
  }
  const { makeSeat } = await import('../agents/seat.mjs');
  assert.throws(() => makeSeat({ id: 'a01', url: 'x', fetch: () => {}, secret: 's', brief: () => [], reply: 'tools', dayToolChoice: 'none' }), /dayToolChoice/);
});

test('by day, a reply with no tool call and no text is "nothing this call": one request, no retry, no malformed result, in either day tool_choice', async () => {
  for (const api of APIS) {
    for (const more of [{ dayToolChoice: 'auto' }, {}]) {
      for (const empty of [{ toolCalls: [] }, { content: '' }, { content: ' \n' }, { content: '<think>x</think>' }]) {
        const g = game();
        const s = await seatOn(api, g, { a01: [empty, { toolCalls: [] }] }, more);
        const out = await s.call(1);
        assert.deepEqual([out.origin, out.outcome, out.calls], ['model', 'reply', 1], `${api} ${JSON.stringify(more)} ${JSON.stringify(empty)}`);
        assert.ok(!out.results.some(r => r.code === 'malformed'));
        assert.deepEqual(s.seat.record.at(-1).attempts.map(a => a.outcome), ['reply']);
        await s.fake.close();
      }
    }
  }
});

test('by day, text without a tool call stays malformed, with the one retry; at the lock a reply with no call is malformed, retried once, then the default play, as R8', async () => {
  for (const api of APIS) {
    const g = game();
    const s = await seatOn(api, g, { a01: [{ content: 'I will lay low tonight.' }, { toolCalls: [] }] }, { dayToolChoice: 'auto' });
    const out = await s.call(1);
    assert.deepEqual([out.outcome, out.calls], ['reply', 2], `${api}: retried once, then nothing`);
    assert.deepEqual(s.seat.record.at(-1).attempts.map(a => a.outcome), ['malformed', 'reply']);
    await s.fake.close();
    const h = game();
    const l = await seatOn(api, h, { a01: [{ toolCalls: [] }, { toolCalls: [] }] }, { dayToolChoice: 'auto' });
    const lock = await l.call('lock');
    assert.deepEqual([lock.origin, lock.outcome, lock.calls], ['default', 'malformed', 2], `${api}: the lock as R8`);
    assert.deepEqual(lock.play, defaultPlay(h.s, 'a01', h.s.day));
    await l.fake.close();
  }
});

test('a whole season on the fake: the starter version\'s tools mode sends "auto" by day and "required" at the lock; idle days cost no retry, so tools mode makes the requests JSON mode makes, event for event the same season', async () => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const run = (name, more) => runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, name), mix: { ...CASTS.models, models: 4 }, say: () => {}, ...more });
  const json = await run('json', {});
  const tools = await run('starter-tools', { briefing: 'starter', reply: 'tools' });
  const current = await run('current-tools', { reply: 'tools' });
  const tape = r => [...readTape(fs.readFileSync(path.join(r.dir, 'tape.jsonl'), 'utf8')).values()];
  const ck = r => JSON.parse(fs.readFileSync(path.join(r.dir, 'checkpoint.json'), 'utf8'));
  const day = new Set(), lock = new Set();
  for (const [id, x] of Object.entries(ck(tools).models.seats)) for (const r of x.record) for (const a of r.attempts) if (a.call !== null) (r.round === 'lock' ? lock : day).add(`${id}#${a.call}`);
  for (const l of tape(tools)) assert.equal(l.request.tool_choice, lock.has(`${l.seat}#${l.call}`) ? 'required' : 'auto', `${l.seat}#${l.call}`);
  assert.ok(day.size > 0 && lock.size > 0);
  for (const l of tape(current)) assert.equal(l.request.tool_choice, 'required', 'the current briefing keeps R8\'s "required"');
  const outcomes = r => Object.values(ck(r).models.seats).flatMap(x => x.record.flatMap(y => y.attempts.map(a => a.outcome)));
  for (const r of [tools, current]) assert.ok(outcomes(r).every(o => o === 'reply'), 'no idle-day retry');
  assert.equal(tape(tools).length, tape(json).length, `tools ${tape(tools).length} requests, JSON ${tape(json).length}`);
  assert.equal(tape(current).length, tape(json).length);
  const events = r => fs.readFileSync(path.join(r.dir, 'events.jsonl'), 'utf8');
  assert.equal(events(tools), events(json));
});
