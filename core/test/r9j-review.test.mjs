// R9b review fixes ($0): the quotes a dawn call shows don't count as delivered, so a tier B line first shown at dawn is
// still fresh for the day's first call; dawn calls are reported apart from the acting calls, so per-call rates aren't
// diluted; and the trusted dawn context is an own property only. Nothing here calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { N } from '../numbers.mjs';
import { dawnNote } from '../agents/journal.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { viewFor } from '../rules/view.mjs';
import { Game } from './helpers.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r9j-review-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const text = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('a tier B line first shown at dawn is still fresh in the day\'s first call: the dawn request leaves the delivery record alone, an acting call records it', async () => {
  const { makeSeat } = await import('../agents/seat.mjs');
  const g = new Game({ n: 3 });
  const view = viewFor(g.s, g.log, 'a01', 'agent');
  const LINE = 'speech:41:0';
  // A briefing that shows one tier B line, and records what each call was told had been delivered.
  const told = [];
  const brief = (result, memory, last, round, context) => {
    told.push({ round, delivered: [...context.delivery.presentedSpeechIds] });
    return { messages: [{ role: 'system', content: 'rules' }, { role: 'user', content: `Day ${view.day}. s1 a02: "meet me"` }], presentedSpeechIds: [LINE], availableSpeechIds: [LINE], systemFixed: 'rules' };
  };
  const fetch = async (url, init) => {
    const dawn = /^Dawn, day/.test(JSON.parse(init.body).messages.at(-1).content);
    const content = dawn ? 'Night 0: a02 wants a meeting.' : '{"actions":[]}';
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }), { status: 200 });
  };
  const seat = makeSeat({ id: 'a01', url: 'http://fake.invalid/v1/chat/completions', fetch, secret: 's', brief });
  await seat.dawn({ view });
  assert.deepEqual(seat.memo.delivery, [], 'the dawn call delivered nothing');
  await seat.call({ view, apply: () => ({ ok: true }), round: 1 });
  assert.deepEqual(told.map(t => [t.round, t.delivered]), [['dawn', []], [1, []]], 'round 1 was told the line is undelivered: fresh');
  assert.deepEqual(seat.memo.delivery, [LINE], 'the acting call delivers it');
  await seat.call({ view, apply: () => ({ ok: true }), round: 2 });
  assert.deepEqual(told.at(-1).delivered, [LINE], 'and from then on it is a repeat, as before');
});

test('dawn calls are reported apart: acting calls, their size, refusal rates and the report leave them out, and they get their own count and size', async () => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const spec = [{ model: 'm/one', seats: 2, thinking: false }, { model: 'm/two', seats: 2, thinking: false }];
  const base = { seed: 404, rule: 'A', mix: { ...CASTS['models-canny'], models: 4 }, seatModels: spec, reply: 'tools' };
  const on = await runModelSeason({ ...base, journal: 'dawn', outDir: path.join(tmp, 'on') });
  const off = await runModelSeason({ ...base, outDir: path.join(tmp, 'off') });
  // With the fake the season is the same, so the acting calls are too: none of the counts or rates move.
  for (const [i, row] of on.metrics.byModel.entries()) {
    const was = off.metrics.byModel[i];
    assert.deepEqual(row.calls, was.calls, `${row.model}: call points and requests are the acting calls'`);
    assert.deepEqual(row.refusals, was.refusals);
    assert.equal(row.dawn.requests, 2 * 13, `${row.model}: its dawn calls, apart`);
    assert.ok(row.dawn.chars.mean > 0 && row.dawn.chars.max >= row.dawn.chars.mean);
    assert.ok(!('dawn' in was), 'no dawn row without the journal');
  }
  const { acting, dawn } = Object.values(JSON.parse(text(on.dir, 'checkpoint.json')).models.seats).reduce((t, x) => {
    for (const r of x.record) t[r.round === 'dawn' ? 'dawn' : 'acting'] += r.attempts.filter(a => a.call !== null).length;
    return t;
  }, { acting: 0, dawn: 0 });
  assert.equal(on.metrics.actionCounters.calls, acting, 'the refusal rate\'s requests are the acting calls');
  assert.equal(on.metrics.actionCounters.dawnCalls, dawn);
  assert.equal(dawn, 4 * 13);
  assert.equal(on.metrics.actionCounters.calls, off.metrics.actionCounters.calls);
  assert.equal(on.metrics.actionCounters.callsWithRefusal, off.metrics.actionCounters.callsWithRefusal);
  assert.ok(!('dawnCalls' in off.metrics.actionCounters));
  const report = text(on.dir, 'report.md');
  assert.match(report, /· dawn 26 \|/);
  assert.match(report, /Dawn journal calls 52: they ask for an entry and act on nothing/);
  assert.doesNotMatch(text(off.dir, 'report.md'), /dawn/i, 'a season without the journal reports as before');
});

test('the trusted dawn context is an own property: one inherited from a prototype is no dawn entry', () => {
  const g = new Game({ n: 2 });
  const line = 'x '.repeat(N['gap.lineLength']).trim();
  const res = applyErrand(g.s, dawnNote('a01', line), Object.create({ source: 'dawn' }));
  assert.ok(res.ok);
  assert.equal(res.events[0].part, 'note');
  assert.equal(res.state.agents.a01.memory.journal[0].line.length, N['gap.lineLength'], 'cut as any note is');
});
