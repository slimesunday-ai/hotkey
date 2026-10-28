// R8g, the 10-19 review of lane/R8-starter before trunk: three fixes it asked for.
// 1. Owners' Creeds are a treatment: a season with the baseline Creed, or with owner edits, never pools with one
//    without (acrossSeasons); a model seat's bot twin is still matched on the briefing arm alone (bots read no Creed).
// 2. A tool call's shop or sell with units 0 stays 0, which the rules refuse, as the JSON path does: the rules read a
//    missing units as one unit, so dropping the 0 made a real one-unit trade.
// 3. A season whose only paid endpoint is a --seat-models group (a local season with a Claude group) resumes without
//    a season key, as it started.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { treatmentOf, briefingOf } from '../bench/evidence.mjs';
import { acrossSeasons } from '../bench/passbars.mjs';
import { actionsOfToolCalls, toolCallsOf } from '../agents/tool-calls.mjs';
import { fakeModel, CHAT_PATH } from '../agents/fake-model.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8g-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const call = (name, args) => ({ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } });

test('a Creed season and a season without one are two treatments: acrossSeasons refuses to pool them; the bot twin arm is unchanged', () => {
  const season = options => ({ provenance: { config: { options } }, bars: {}, modelSeats: [] });
  const plain = season({ briefing: 'starter', reply: 'tools' });
  const baseline = season({ briefing: 'starter', reply: 'tools', creedBaseline: { text: 'x', sha256: '64f317a9300d00000000' } });
  const edits = season({ briefing: 'starter', reply: 'tools', creeds: [{ day: 3, seat: 'a02', text: 'y' }] });
  assert.equal(briefingOf(baseline), briefingOf(plain), 'twins are still matched on the briefing arm');
  assert.notEqual(treatmentOf(baseline), treatmentOf(plain));
  assert.notEqual(treatmentOf(edits), treatmentOf(plain));
  assert.notEqual(treatmentOf(edits), treatmentOf(baseline));
  assert.throws(() => acrossSeasons([plain, baseline]), /different briefings/);
  assert.throws(() => acrossSeasons([plain, edits]), /different briefings/);
});

test('a tool call\'s shop or sell with units 0 keeps the 0, so the rules refuse it instead of trading one unit', () => {
  assert.deepEqual(actionsOfToolCalls([call('money', { act: 'sell', item: 'doses', units: 0, drug: 'temp' })]).actions, [{ act: 'sell', item: 'doses', units: 0, drug: 'temp' }]);
  assert.deepEqual(actionsOfToolCalls([call('money', { act: 'shop', item: 'chems', units: 0, max: 50 })]).actions, [{ act: 'shop', item: 'chems', units: 0, max: 50 }]);
  assert.deepEqual(actionsOfToolCalls([call('money', { act: 'give', to: 'a02', cash: 0, goods: [{ kind: 'temp', count: 1 }] })]).actions, [{ act: 'give', to: 'a02', goods: { temp: 1 } }], 'a give\'s cash 0 is still none');
});

test('a local season whose only paid endpoint is a Claude group stops at its cap and resumes without a season key', async () => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const { fakeAnthropic } = await import('../agents/fake-anthropic.mjs');
  const KEY = 'sk-ant-api03-r8g-dummy-key';
  const PLAY = { act: 'play', menu: 1 };
  const claude = fakeAnthropic({ key: KEY, script: () => ({ toolCalls: toolCallsOf([PLAY]) }) });
  const local = fakeModel({ script: () => ({ toolCalls: toolCallsOf([PLAY]) }) });
  const fetch = (u, init) => (new URL(u).host === 'anthropic.invalid' ? claude.fetch(u, init) : local.fetch(u, init));
  const SPEC = [{ model: 'local-model', seats: 1 }, { model: 'claude-sonnet-5-5', seats: 1, api: 'claude', url: 'http://anthropic.invalid/v1/messages' }];
  const opts = more => ({
    seed: 418, rule: 'A', outDir: path.join(tmp, 'local-claude'), mix: { ...CASTS['models-canny'], models: 2 }, url: `http://fake.invalid${CHAT_PATH}`,
    fetch, go: 'a test: fake servers stand in for both endpoints', key: null, api: 'local', groupKeys: [null, KEY], seatModels: SPEC,
    briefing: 'starter', reply: 'tools', say: () => {}, ...more,
  });
  try {
    await assert.rejects(runModelSeason(opts({ maxCost: 0.005 })), e => e.halt === 'cap', 'the Claude group\'s spend stops it at its cap');
    const r = await runModelSeason(opts({ maxCost: 5, resume: true }));
    assert.ok(r.metrics, 'resumed with no season key, it finished');
  } finally {
    await claude.close?.();
    await local.close?.();
  }
});
