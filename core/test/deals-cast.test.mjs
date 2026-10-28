// R5-deals, the models cast over canny (`--cast models-canny`; bench/bots.mjs MODELS_CANNY_MIX, bench/runner.mjs): the
// canny cast with model seats, dealt as the models cast deals them. Its bots are canny, its bot twin is canny too, and
// the twin and provenance checks match it; a replay plays it again from its run folder. The models cast is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r5-deals-cast-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const evidenceModule = () => import('../bench/evidence.mjs');
const omitModel = cast => cast.map(({ model, ...c }) => c);

test('--cast models-canny takes --model-seats: the canny cast with model seats, the same seats the models cast deals; its twin is the canny cast with none, and the models cast is as it was', async () => {
  const { mixOf, castName } = await runnerModule();
  const { CASTS, makeCast, CANNY_MIX, LAYER4_MIX } = await botsModule();
  assert.deepEqual(CASTS.models, { ...LAYER4_MIX, models: 0 }, 'the models cast is the layer4 cast with model seats, as before');
  const mix = mixOf({ cast: 'models-canny', 'model-seats': '4' });
  assert.deepEqual(mix, { ...CANNY_MIX, models: 4 });
  assert.equal(castName(mix), 'models-canny');
  assert.equal(castName({ ...mix, models: 0 }), 'models-canny', 'its twin keeps the name, so the twin\'s provenance matches');
  assert.equal(castName(mixOf({ cast: 'models', 'model-seats': '4' })), 'models');
  assert.throws(() => mixOf({ cast: 'models-canny' }), /model-seats/);
  assert.throws(() => mixOf({ cast: 'canny', 'model-seats': '2' }), /model-seats/, 'the canny cast itself takes none');
  for (const seed of [404, 414, 415]) {
    const cast = makeCast(seed, mix);
    assert.ok(cast.every(c => c.canny), `${seed}: every seat canny`);
    const models = makeCast(seed, mixOf({ cast: 'models', 'model-seats': '4' }));
    assert.deepEqual(cast.filter(c => c.model).map(c => c.id), models.filter(c => c.model).map(c => c.id), `${seed}: the models cast's seats`);
    assert.deepEqual(omitModel(makeCast(seed, { ...mix, models: 0 })), omitModel(cast), `${seed}: the twin is the same cast with no model seat`);
    assert.deepEqual(omitModel(cast), omitModel(makeCast(seed, { ...CANNY_MIX, models: 0 })));
  }
});

test('a models-canny season pairs with its canny twin, its provenance verified, and replays from its run folder ($0: the fake model)', async () => {
  const { runSeason, runModelSeason, mixOf } = await runnerModule();
  const { twinValidation } = await evidenceModule();
  const mix = mixOf({ cast: 'models-canny', 'model-seats': '2' });
  const twin = runSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'bots'), mix: { ...mix, models: 0 } });
  const model = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'model'), mix });
  assert.equal(model.metrics.provenance.config.options.cast, 'models-canny');
  assert.equal(twin.metrics.provenance.config.options.cast, 'models-canny');
  const v = twinValidation(model.metrics, twin.metrics);
  assert.deepEqual([v.status, v.reasons], ['verified', []], 'the twin and provenance checks match');
  const r = spawnSync(process.execPath, [RUNNER, '--replay', model.dir, '--out', path.join(tmp, 'replay'), '--quiet'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `the replay plays: ${r.stderr}`);
  const events = d => fs.readFileSync(path.join(d, 'events.jsonl'), 'utf8');
  assert.equal(events(path.join(tmp, 'replay', '404-A')), events(model.dir), 'the same season, event for event');
});

test('the runner refuses --cast models-canny without --model-seats, and the model flags with neither model cast (exit 2)', () => {
  const run = args => spawnSync(process.execPath, [RUNNER, '--seed', '404', '--rule', 'A', '--quiet', '--out', path.join(tmp, 'cli'), ...args], { encoding: 'utf8' });
  const a = run(['--cast', 'models-canny']);
  assert.equal(a.status, 2);
  assert.match(a.stderr, /--cast models \(or models-canny\) takes --model-seats N/);
  const b = run(['--cast', 'canny', '--briefing', 'legacy']);
  assert.equal(b.status, 2);
  assert.match(b.stderr, /go with --cast models \(or models-canny\)/);
});
