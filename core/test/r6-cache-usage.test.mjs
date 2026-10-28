// Offline provider metadata: cache counters describe observed usage without changing the spend tally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openRouter } from '../agents/openrouter.mjs';

async function recorded(usage) {
  const calls = [];
  const paid = openRouter({
    key: 'dummy-r6-cache-key', maxCost: 1, onCall: r => calls.push(r),
    fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop' }], ...(usage === undefined ? {} : { usage }) })),
  });
  await paid.fetch('https://offline.invalid/chat', {});
  return { record: calls[0], spend: paid.spend };
}

test('provider prompt cache reads and writes normalize beside unchanged token and cost accounting', async () => {
  const { record, spend } = await recorded({ cost: 0.02, prompt_tokens: 400, completion_tokens: 90,
    completion_tokens_details: { reasoning_tokens: 30 }, prompt_tokens_details: { cached_tokens: 250, cache_write_tokens: 100 } });
  assert.deepEqual(record.tokens, { in: 400, out: 90, reasoning: 30, cached: 250, cacheWrite: 100 });
  assert.deepEqual(spend, { calls: 1, cost: 0.02 });
});

test('absent usage stays absent and missing cache counters mean unknown rather than zero', async () => {
  assert.equal((await recorded()).record.tokens, null);
  const { record } = await recorded({ prompt_tokens: 40, completion_tokens: 2 });
  assert.deepEqual(record.tokens, { in: 40, out: 2, reasoning: null, cached: null, cacheWrite: null });
});

test('only finite nonnegative integer cache counts are reported, including explicit zero', async () => {
  for (const n of [null, -1, 0.5, '23', {}, Number.MAX_SAFE_INTEGER + 1]) {
    const { record } = await recorded({ prompt_tokens_details: { cached_tokens: n, cache_write_tokens: n } });
    assert.equal(record.tokens.cached, null);
    assert.equal(record.tokens.cacheWrite, null);
  }
  const { record } = await recorded({ prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } });
  assert.equal(record.tokens.cached, 0);
  assert.equal(record.tokens.cacheWrite, 0);
});
