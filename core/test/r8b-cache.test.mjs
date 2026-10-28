// R8b, caching the fixed part (the 10-18 seasons: OpenAI and DeepSeek seats had about 57% of input tokens cached,
// Claude Sonnet and Gemini Flash-Lite 0%, and Sonnet was 60% of the bill). Through OpenRouter, Anthropic caches only up
// to an explicit cache_control breakpoint, and Gemini needs one in the message content too (OpenRouter's
// prompt-caching docs, read 10-19); OpenAI and DeepSeek cache a repeated prefix by themselves. So in the new modes (the
// starter version, or tools replies) an OpenRouter request to an anthropic/ or google/ model sends its system message as
// text parts, the fixed part (the rules, the reply format, the trade and who it is) marked { type: "ephemeral" }; the
// tools come before it in Anthropic's cache prefix. Every other request is as it was: the 10-18 shape (current briefing,
// JSON replies) is unchanged, and so is every local request. Through the fake servers only: nothing calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { briefingPacket, starterBriefingPacket } from '../agents/briefing.mjs';
import { toolDefinitions } from '../agents/tool-calls.mjs';
import { fakeModel, manualClock, CHAT_PATH, readTape } from '../agents/fake-model.mjs';
import { fakeOpenRouter } from '../agents/fake-openrouter.mjs';
import { openRouter } from '../agents/openrouter.mjs';

const KEY = 'sk-or-v1-r8b-cache-dummy';
const OR = 'http://openrouter.invalid/api/v1/chat/completions';
const GO = 'a test: the fake OpenRouter stands in for the endpoint';
const MARK = { type: 'ephemeral' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8b-cache-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const textOf = content => (typeof content === 'string' ? content : content.map(p => p.text).join(''));

async function oneCall({ api = 'openrouter', model, brief = starterBriefingPacket, memory = null, ...more }) {
  const { makeSeat } = await import('../agents/seat.mjs');
  const g = new Game({ n: 4 });
  if (memory) g.errand('a01', 'plan', { traits: [{ trait: Object.keys(g.s.traits)[0], routes: ['buy', 'trade'] }] });
  const clock = manualClock();
  const script = { a01: [{ toolCalls: [] }, { json: { actions: [] } }] };
  const fake = api === 'local' ? fakeModel({ script, clock }) : fakeOpenRouter({ key: KEY, script, clock });
  const { read } = await import('../agents/tools.mjs');
  const plain = brief(read(g.view('a01'), { audience: 'seat', seed: 'r8b', from: 1 }).result, { memory: g.view('a01').me.memory, call: 'round', ...(more.reply === 'tools' ? { reply: 'tools' } : {}) });
  const send = api === 'local' ? fake.fetch : openRouter({ fetch: fake.fetch, key: KEY, maxCost: 5, clock }).fetch;
  const seat = makeSeat({
    id: 'a01', url: api === 'local' ? `http://fake.invalid${CHAT_PATH}` : OR, fetch: send, secret: 'r8b', clock, model, api,
    brief: (r, mem, last, round, context) => brief(r, { memory: mem, last, call: 'round', ...context }), ...more,
  });
  await seat.call({ round: 1, view: g.view('a01'), currentView: () => g.view('a01'), apply: e => g.errand('a01', e.kind, e), validatePlay: x => checkPlay(g.s, 'a01', x, g.s.day) });
  const [body] = fake.calls.map(c => c.request);
  await fake.close();
  return { body, plain };
}

test('an OpenRouter request to an anthropic/ or google/ model, with cacheMark on, sends the fixed system text as a marked text part, the rest after it unmarked; the text is the same, and the tools ride ahead of it', async () => {
  const { needsCacheMark } = await import('../agents/openrouter.mjs');
  assert.deepEqual(['anthropic/claude-sonnet-5.5', 'google/gemini-3.1-flash-lite', 'openai/gpt-6-luna', 'deepseek/deepseek-v4.1-flash'].map(needsCacheMark), [true, true, false, false]);
  for (const model of ['anthropic/claude-sonnet-5.5', 'google/gemini-3.1-flash-lite']) {
    const { body, plain } = await oneCall({ model, reply: 'tools', cacheMark: true });
    const sys = body.messages[0];
    assert.ok(Array.isArray(sys.content), `${model}: parts`);
    assert.equal(sys.content.length, 1, 'no memory yet: one part');
    assert.deepEqual(sys.content[0], { type: 'text', text: plain.systemFixed, cache_control: MARK });
    assert.equal(textOf(sys.content), plain.messages[0].content, 'the same words');
    assert.equal(typeof body.messages[1].content, 'string', 'the day is not marked');
    assert.deepEqual(body.tools, toolDefinitions(), 'the tools, unchanged, ahead of the system text');
    const withPlan = await oneCall({ model, reply: 'tools', cacheMark: true, memory: true });
    const parts = withPlan.body.messages[0].content;
    assert.equal(parts.length, 2, 'the plan card after the mark');
    assert.deepEqual(parts[0].cache_control, MARK);
    assert.ok(!('cache_control' in parts[1]) && parts[1].text.includes('Your plan card'));
  }
});

test('every other request is as it was: OpenAI and DeepSeek models, the local API, and cacheMark off', async () => {
  for (const more of [{ model: 'openai/gpt-6-luna', cacheMark: true }, { model: 'deepseek/deepseek-v4.1-flash', cacheMark: true }, { api: 'local', model: 'anthropic/claude-sonnet-5.5', cacheMark: true }, { model: 'anthropic/claude-sonnet-5.5' }]) {
    const { body, plain } = await oneCall({ reply: 'tools', ...more });
    assert.equal(body.messages[0].content, plain.messages[0].content, JSON.stringify(more));
  }
  const { body } = await oneCall({ model: 'anthropic/claude-sonnet-5.5', brief: briefingPacket });
  assert.equal(typeof body.messages[0].content, 'string', 'JSON replies, current briefing: the 10-18 shape');
});

const SPEC = [
  { model: 'openai/gpt-6-luna', seats: 2, thinking: true },
  { model: 'google/gemini-3.1-flash-lite', seats: 2, thinking: false },
  { model: 'deepseek/deepseek-v4.1-flash', seats: 2, thinking: false },
  { model: 'anthropic/claude-sonnet-5.5', seats: 1, thinking: true },
  { model: 'openai/gpt-6.1-sol', seats: 1, thinking: true },
];
async function mixed(name, more) {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const fake = fakeOpenRouter({ key: KEY, credits: 100, script: () => ({ toolCalls: [] }) });
  try {
    const r = await runModelSeason({ seed: 418, rule: 'A', outDir: path.join(tmp, name), mix: { ...CASTS['models-canny'], models: 8 }, url: OR, fetch: fake.fetch, go: GO, key: KEY, api: 'openrouter', maxCost: 5, seatModels: SPEC, stopAfter: 1, say: () => {}, ...more });
    return { r, ck: JSON.parse(fs.readFileSync(path.join(r.dir, 'checkpoint.json'), 'utf8')), tape: [...readTape(fs.readFileSync(path.join(r.dir, 'tape.jsonl'), 'utf8')).values()] };
  } finally {
    await fake.close();
  }
}

test('a mixed season on the fake OpenRouter: in the new modes the anthropic/ and google/ seats\' bodies carry the mark and the others\' don\'t; in the 10-18 mode none does; the season\'s request sizes count the marked text', async () => {
  const run = await mixed('starter-tools', { briefing: 'starter', reply: 'tools' });
  const groupOf = id => SPEC[run.ck.models.seatOf[id]].model;
  let marked = 0;
  for (const l of run.tape) {
    const sys = l.request.messages[0].content;
    const wants = /^(anthropic|google)\//.test(groupOf(l.seat));
    assert.equal(Array.isArray(sys), wants, `${l.seat} (${groupOf(l.seat)})`);
    if (wants) {
      assert.deepEqual(sys[0].cache_control, MARK);
      marked += 1;
    }
  }
  assert.ok(marked > 0);
  const { seatUsage } = await import('../bench/evidence.mjs');
  const use = seatUsage(run.ck.models, fs.readFileSync(path.join(run.r.dir, 'tape.jsonl'), 'utf8'));
  for (const id of Object.keys(run.ck.models.seatOf)) {
    const chars = run.tape.filter(l => l.seat === id).reduce((t, l) => t + l.request.messages.reduce((u, m) => u + textOf(m.content ?? '').length, 0), 0);
    assert.equal(use[id].chars.total, chars, `${id}: a request's size counts its marked text`);
  }
  const old = await mixed('current-json', {});
  for (const l of old.tape) assert.equal(typeof l.request.messages[0].content, 'string', `${l.seat}: the 10-18 shape`);
});
