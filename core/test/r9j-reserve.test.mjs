// R9b item 6 and the merge check ($0): the dawn call reserves its task line's exact length in the briefing
// (briefing.mjs `reserve`), so every dawn request, briefing and task together, is at most gap.briefing's 25,000 (21,000 until slime's "Yeah bump to 25k", 10-19)
// characters; and R9's "Since last night" reads the stored entry as "your journal entry for day N is stored", N the
// entry's own day, with no raw memory object. Seed 418, models-canny, 8 seats, starter, tools, --journal dawn.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readTape } from '../agents/fake-model.mjs';
import { N } from '../numbers.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r9j-reserve-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const text = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
// A request's size as the budget counts it: every message's text.
const size = l => l.request.messages.reduce((t, m) => t + (typeof m.content === 'string' ? m.content.length
  : Array.isArray(m.content) ? m.content.reduce((u, p) => u + (p && typeof p.text === 'string' ? p.text.length : 0), 0) : 0), 0);
let calls, dawnTask;
before(async () => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  ({ dawnTask } = await import('../agents/journal.mjs'));
  const r = await runModelSeason({ seed: 418, rule: 'A', mix: { ...CASTS['models-canny'], models: 8 }, briefing: 'starter', reply: 'tools', journal: 'dawn', outDir: path.join(tmp, 'season') });
  const ck = JSON.parse(text(r.dir, 'checkpoint.json'));
  const at = {};
  for (const [id, x] of Object.entries(ck.models.seats)) for (const rec of x.record) for (const a of rec.attempts) if (a.call !== null) at[`${id}#${a.call}`] = { day: rec.day, round: rec.round };
  calls = [...readTape(text(r.dir, 'tape.jsonl')).values()].map(l => ({ ...l, ...at[`${l.seat}#${l.call}`] }));
});

test('every dawn request, the briefing and the appended task line, is at most gap.briefing\'s characters', () => {
  const dawn = calls.filter(l => l.round === 'dawn');
  assert.equal(dawn.length, 8 * 13);
  const cap = N['gap.briefing'].chars;
  assert.equal(cap, 25000);
  for (const l of dawn) {
    assert.equal(l.request.messages.at(-1).content, dawnTask(l.day), 'the task line, its own message');
    assert.ok(size(l) <= cap, `${l.seat}#${l.call} day ${l.day}: ${size(l)} characters`);
  }
  const big = Math.max(...dawn.map(size));
  assert.ok(big > cap - 100, `the briefing still fills its room (${big})`);
});

test('"Since last night" names the stored entry by its own day, as a sentence, with no raw memory object', () => {
  for (const l of calls.filter(x => x.round === 'dawn')) {
    const next = calls.filter(x => x.seat === l.seat && x.call > l.call).sort((a, b) => a.call - b.call)[0];
    const since = next.request.messages[1].content.split('\n').find(x => x.startsWith('Since last night:')) || '';
    assert.ok(since.includes(`your journal entry for day ${l.day} is stored`), `${l.seat} day ${l.day}: ${since}`);
    assert.doesNotMatch(since, /memory: |part dawn|, ,|journal ,/, since);
  }
});
