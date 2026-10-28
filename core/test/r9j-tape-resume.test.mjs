// R9b, the dawn journal's tape, resume, replay, cost and provenance ($0): dawn calls are taped like any call; a season
// killed after a dawn and resumed answers that dawn from its tape, never asking the model again, and ends as the
// uninterrupted season does; a replay plays the journal; on a paid transport (the fake OpenRouter) every dawn call is
// priced and counts toward --max-cost; the run folder's options and provenance carry the journal, so a season with
// journals never pools with one without, and a resume must name the same. Nothing here calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTape } from '../agents/fake-model.mjs';
import { treatmentOf, journalOf } from '../bench/evidence.mjs';

const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r9j-tape-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const text = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const checkpoint = dir => JSON.parse(text(dir, 'checkpoint.json'));
const tapeOf = dir => [...readTape(text(dir, 'tape.jsonl')).values()];
const cli = args => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });
const SEASON = ['--seed', '404', '--rule', 'A', '--cast', 'models-canny', '--model-seats', '4', '--reply', 'tools', '--quiet'];
const dawnRecords = dir => Object.entries(checkpoint(dir).models.seats).flatMap(([id, x]) => x.record.filter(r => r.round === 'dawn').map(r => ({ id, day: r.day, call: r.attempts[0].call })));

test('a season killed after a dawn resumes from its checkpoint, answers that dawn from the tape and never asks the model for an entry it has; it ends as the uninterrupted season does, and a replay plays it again', () => {
  const whole = path.join(tmp, 'whole');
  const cut = path.join(tmp, 'cut');
  const w = cli([...SEASON, '--journal', 'dawn', '--out', whole]);
  assert.equal(w.status, 0, w.stderr);
  // Killed mid-write on night 4: the dawn of day 4 and the day's calls were made and taped, night 4's checkpoint never written.
  const k = cli([...SEASON, '--journal', 'dawn', '--out', cut, '--die-at', 'mid-write:4']);
  assert.equal(k.signal, 'SIGKILL');
  const killedAt = checkpoint(path.join(cut, '404-A')).state.day;
  assert.equal(killedAt, 4, 'the checkpoint is night 3\'s');
  const dawnBefore = tapeOf(path.join(cut, '404-A')).filter(l => /^Dawn, day 4:/.test(l.request.messages.at(-1).content));
  assert.equal(dawnBefore.length, 4, 'day 4\'s dawn calls are on the tape');
  const r = cli([...SEASON, '--journal', 'dawn', '--out', cut, '--resume']);
  assert.equal(r.status, 0, r.stderr);
  const [, taped] = /\((\d+) from the tape\)/.exec(r.stdout) || [];
  assert.ok(Number(taped) >= 4, `the resume answered the killed day from the tape (${taped})`);
  assert.equal(text(path.join(cut, '404-A'), 'events.jsonl'), text(path.join(whole, '404-A'), 'events.jsonl'), 'the same season, event for event');
  const lines = tapeOf(path.join(cut, '404-A'));
  assert.equal(new Set(lines.map(l => `${l.seat}#${l.call}`)).size, lines.length, 'no call twice on the tape');
  assert.equal(lines.length, tapeOf(path.join(whole, '404-A')).length);
  const dawn = dawnRecords(path.join(cut, '404-A'));
  assert.equal(dawn.length, 4 * 13);
  assert.equal(new Set(dawn.map(x => `${x.id}|${x.day}`)).size, dawn.length, 'one dawn a seat a day');
  // A resume names the season's journal, or is refused before anything is written.
  const other = cli([...SEASON, '--out', cut, '--resume']);
  assert.equal(other.status, 2);
  assert.match(other.stderr, /this season's journal is dawn: resume it with --journal dawn/);
  // A replay plays the journal from the tape, into a new run folder.
  const again = cli(['--replay', path.join(whole, '404-A'), '--out', path.join(tmp, 'replay'), '--quiet']);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(text(path.join(tmp, 'replay', '404-A'), 'events.jsonl'), text(path.join(whole, '404-A'), 'events.jsonl'));
  assert.equal(checkpoint(path.join(tmp, 'replay', '404-A')).bench.options.journal, 'dawn');
});

test('the run folder\'s options and provenance carry --journal dawn; a journal season is a treatment of its own; the flag goes only with a model cast and takes only dawn', () => {
  const dir = path.join(tmp, 'whole', '404-A');
  const ck = checkpoint(dir);
  assert.equal(ck.bench.options.journal, 'dawn');
  assert.equal(ck.bench.provenance.config.options.journal, 'dawn');
  const withJournal = { provenance: ck.bench.provenance };
  const without = { provenance: { ...ck.bench.provenance, config: { ...ck.bench.provenance.config, options: { ...ck.bench.provenance.config.options, journal: undefined } } } };
  assert.equal(journalOf(withJournal), 'dawn');
  assert.equal(journalOf(without), 'off');
  assert.notEqual(treatmentOf(withJournal), treatmentOf(without));
  assert.match(treatmentOf(withJournal), /journal dawn/);
  const bots = cli(['--seed', '404', '--journal', 'dawn', '--out', path.join(tmp, 'bots'), '--quiet']);
  assert.equal(bots.status, 2);
  assert.match(bots.stderr, /--journal goes with --cast models/);
  const bad = cli([...SEASON, '--journal', 'dusk', '--out', path.join(tmp, 'bad')]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--journal takes dawn/);
  assert.equal(fs.existsSync(path.join(tmp, 'bots')) || fs.existsSync(path.join(tmp, 'bad')), false, 'nothing written');
});

test('on a paid transport (the fake OpenRouter, $0) every dawn call is sent, priced and counted toward --max-cost, as any call is', async t => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const { fakeOpenRouter } = await import('../agents/fake-openrouter.mjs');
  const KEY = 'sk-or-v1-r9j-dummy-not-a-key';
  const PRICE = 0.001;
  const fake = fakeOpenRouter({ key: KEY, credits: 100, script: () => ({ json: { actions: [{ act: 'play', menu: 1 }] } }), cost: () => PRICE });
  t.after(() => fake.close());
  const opts = more => ({
    seed: 404, rule: 'A', outDir: path.join(tmp, 'paid'), mix: { ...CASTS['models-canny'], models: 4 }, url: 'http://openrouter.invalid/api/v1/chat/completions',
    fetch: fake.fetch, go: 'a test: the fake OpenRouter stands in for the endpoint', key: KEY, api: 'openrouter', model: 'm/test', journal: 'dawn', say: () => {}, stopAfter: 4, ...more,
  });
  const r = await runModelSeason(opts({ maxCost: 5 }));
  const dir = path.join(tmp, 'paid', '404-A');
  const spend = text(dir, 'spend.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const tape = tapeOf(dir);
  const dawn = dawnRecords(dir);
  assert.equal(dawn.length, 4 * 3, 'days 2-4');
  for (const x of dawn) assert.ok(spend.some(s => s.seat === x.id && s.call === x.call && s.cost === PRICE), `${x.id}#${x.call}: priced`);
  assert.equal(spend.length, tape.length, 'a spend line a request');
  assert.equal(r.spend.calls, tape.length);
  assert.ok(Math.abs(r.spend.cost - tape.length * PRICE) < 1e-9, 'the dawn calls are in the tally the cap reads');
  // A cap the season reaches only with its dawn calls counted (12 of its calls; without them it would spend
  // (calls - 12) x the price, under this cap) stops it as SIGINT does.
  const fresh = fakeOpenRouter({ key: KEY, credits: 100, script: () => ({ json: { actions: [{ act: 'play', menu: 1 }] } }), cost: () => PRICE });
  t.after(() => fresh.close());
  const capped = opts({ outDir: path.join(tmp, 'capped'), fetch: fresh.fetch, maxCost: (tape.length - 4.5) * PRICE });
  await assert.rejects(runModelSeason(capped), e => e.halt === 'cap');
});
