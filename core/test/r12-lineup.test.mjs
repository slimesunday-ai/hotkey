// R12, the 11-05 lineup (slime: "lets use haiku, sonnet (extra high), and opus 5.5 (high)" · "build a set up that maxes
// out at 12.30"): a thinking Claude group names its own effort, and OpenRouter keeps a cap of its own beside the
// season's one cap, which still counts every endpoint's calls. Nothing here reaches the network: the fetch is a stub and
// the key a dummy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeFields, CLAUDE_EFFORTS } from '../agents/anthropic.mjs';
import { openRouter } from '../agents/openrouter.mjs';
import { seatModelsRefusal, seatModelsOf } from '../bench/runner.mjs';

// No key prefix, so the public export's key gate has nothing to allow.
const DUMMY = 'r12-dummy-not-a-key';
const URL_OR = 'http://openrouter.invalid/api/v1/chat/completions';
// A stub of OpenRouter: every chat call costs `cost`, and the preflight's two GETs read `balance` and `left`.
const stub = ({ cost = 0.6, balance = 20, left = null } = {}) => {
  const seen = [];
  const fetch = async (url, init = {}) => {
    const p = new URL(url).pathname;
    if (p === '/api/v1/credits') return new Response(JSON.stringify({ data: { total_credits: balance, total_usage: 0 } }), { status: 200 });
    if (p === '/api/v1/key') return new Response(JSON.stringify({ data: { limit_remaining: left, usage: 0 } }), { status: 200 });
    seen.push(init.body);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{}' } }], usage: { cost, prompt_tokens: 10, completion_tokens: 2 }, model: 'm', provider: 'p' }), { status: 200 });
  };
  return { fetch, seen };
};

test("a thinking Claude seat takes its group's effort; without one it keeps the table's high; a plain seat is unchanged", () => {
  assert.deepEqual(CLAUDE_EFFORTS, ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(claudeFields({ thinking: true, model: 'claude-sonnet-5-5', effort: 'xhigh' }).output_config.effort, 'xhigh');
  assert.equal(claudeFields({ thinking: true, model: 'claude-opus-5-5', effort: 'high' }).output_config.effort, 'high');
  assert.deepEqual(claudeFields({ thinking: true, model: 'claude-haiku-5-5' }), claudeFields({ thinking: true, model: 'claude-haiku-5-5', effort: null }));
  assert.equal(claudeFields({ thinking: true, model: 'claude-haiku-5-5' }).output_config.effort, 'high');
  assert.deepEqual(claudeFields({ thinking: false, model: 'claude-sonnet-5-5', effort: 'xhigh' }), claudeFields({ thinking: false, model: 'claude-sonnet-5-5' }));
  assert.equal(claudeFields({ thinking: true, model: 'claude-sonnet-5-5', effort: 'xhigh' }).thinking.type, 'adaptive');
});

test("--seat-models: effort goes only with a thinking Claude group and one of the five levels, and the run folder keeps it", () => {
  const ok = [{ model: 'claude-sonnet-5-5', seats: 1, thinking: true, api: 'claude', effort: 'xhigh' }, { model: 'openai/gpt-6.1-sol', seats: 1, thinking: true }];
  assert.equal(seatModelsRefusal(ok, { api: 'openrouter' }), null);
  assert.match(seatModelsRefusal([{ model: 'openai/gpt-6.1-sol', seats: 1, thinking: true, effort: 'high' }], { api: 'openrouter' }), /effort goes with/);
  assert.match(seatModelsRefusal([{ model: 'claude-opus-5-5', seats: 1, thinking: false, api: 'claude', effort: 'high' }], { api: 'openrouter' }), /effort goes with/);
  assert.match(seatModelsRefusal([{ model: 'claude-opus-5-5', seats: 1, thinking: true, api: 'claude', effort: 'extra' }], { api: 'openrouter' }), /effort goes with/);
  assert.equal(seatModelsRefusal([{ model: 'claude-opus-5-5', seats: 1, thinking: true, effort: 'high' }], { api: 'claude' }), null);
  assert.equal(seatModelsOf(ok)[0].effort, 'xhigh');
  assert.equal('effort' in seatModelsOf(ok)[1], false);
});

test("OpenRouter's own cap: shared by its transports, it stops the season once their spend reaches it, whatever the season's cap", async () => {
  const s = stub({ cost: 0.6 });
  const own = { cap: 1, cost: 0 }, tally = { cost: 0, calls: 0 };
  const a = openRouter({ fetch: s.fetch, key: DUMMY, maxCost: 50, tally, own });
  const b = openRouter({ fetch: s.fetch, key: DUMMY, maxCost: 50, tally, own });
  await a.fetch(URL_OR, { method: 'POST', body: '{}' });
  assert.equal(a.halted, null);
  await b.fetch(URL_OR, { method: 'POST', body: '{}' });
  assert.equal(own.cost, 1.2);
  assert.equal(b.halted.halt, 'cap');
  assert.match(b.halted.message, /OpenRouter's spend reached its own cap: \$1\.2000 of \$1/);
  // the other transport refuses before anything goes out
  await assert.rejects(a.fetch(URL_OR, { method: 'POST', body: '{}' }), /no paid call once the season has stopped/);
  assert.equal(s.seen.length, 2);
  assert.equal(tally.cost, 1.2);
});

test("without its own cap the transport is as it was; with one the preflight asks the balance and the key's limit for it", async () => {
  const none = openRouter({ fetch: stub({ balance: 3 }).fetch, key: DUMMY, maxCost: 5 });
  assert.match((await none.preflight(URL_OR)).refused, /is below --max-cost \$5: not starting/);
  const fits = openRouter({ fetch: stub({ balance: 3, left: 2.5 }).fetch, key: DUMMY, maxCost: 5, own: { cap: 2, cost: 0 } });
  assert.equal((await fits.preflight(URL_OR)).refused, null);
  const short = openRouter({ fetch: stub({ balance: 3, left: 1.5 }).fetch, key: DUMMY, maxCost: 5, own: { cap: 2, cost: 0 } });
  assert.match((await short.preflight(URL_OR)).refused, /the key's limit left, \$1\.50, is below OpenRouter's own cap \$2: not starting/);
  assert.throws(() => openRouter({ fetch: stub().fetch, key: DUMMY, maxCost: 5, own: { cap: 0, cost: 0 } }), /own cap is \{ cap, cost \}/);
});
