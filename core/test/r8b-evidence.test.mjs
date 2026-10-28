// R8b, reply modes kept apart in the bench (the R8 hand-back: evidence.mjs's briefingOf ignored `reply`). A season whose
// model seats answered with tool calls is another treatment from one that answered in JSON, as two briefing arms are:
// the twin check names the reply mode, each mode pairs only with its own twin, no count pools two modes, a mixed
// season whose groups answer in other modes keeps each group's in its setup, and the season report gives each model
// row its reply mode. On the runner's in-process fake: nothing here calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8b-evidence-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function season(name, n, more = {}) {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  return (await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, name), mix: { ...CASTS.models, models: n }, say: () => {}, ...more })).metrics;
}

test('a tools season and a JSON season are two treatments: the twin check names the reply mode, each pairs with its own twin, and no count pools them', async () => {
  const { twinValidation, briefingOf, replyOf } = await import('../bench/evidence.mjs');
  const { pairSeasons, acrossSeasons } = await import('../bench/passbars.mjs');
  const json = await season('json', 4);
  const jsonTwin = await season('json-twin', 0);
  const tools = await season('tools', 4, { reply: 'tools' });
  const toolsTwin = await season('tools-twin', 0, { reply: 'tools' });
  assert.deepEqual([json, jsonTwin, tools, toolsTwin].map(replyOf), ['json', 'json', 'tools', 'tools']);
  assert.deepEqual([json, tools].map(briefingOf), ['current', 'current+tools'], 'the arm a count reads carries the mode');
  assert.equal(json.seasonKey, tools.seasonKey, 'control: on the fake both modes play the same record, so only the mode tells them apart');
  assert.equal(twinValidation(json, jsonTwin).status, 'verified');
  assert.equal(twinValidation(tools, toolsTwin).status, 'verified');
  for (const [m, b] of [[tools, jsonTwin], [json, toolsTwin]]) {
    const v = twinValidation(m, b);
    assert.equal(v.status, 'invalid');
    assert.ok(v.reasons.includes('reply mode'), JSON.stringify(v.reasons));
  }
  assert.equal(twinValidation(tools, { ...jsonTwin, provenance: null }).status, 'invalid', 'a twin with no setup recorded played JSON');
  const [own] = pairSeasons([tools], [jsonTwin, toolsTwin]);
  assert.equal(own.validation.status, 'verified', 'the tools season pairs with its own twin');
  assert.equal(pairSeasons([tools], [jsonTwin])[0].bots, null, 'and with no JSON twin');
  assert.throws(() => acrossSeasons([json, tools], { twins: [jsonTwin, toolsTwin] }), /different briefings \(current, current\+tools\)/);
});

test('a mixed season whose groups answer in other modes keeps each group\'s in its setup, and its report gives each model row its reply mode', async () => {
  const spec = [{ model: 'm/tools', seats: 2, thinking: false, reply: 'tools' }, { model: 'm/json', seats: 2, thinking: false }];
  const { replyOf } = await import('../bench/evidence.mjs');
  const m = await season('mixed', 4, { seatModels: spec });
  assert.deepEqual(m.provenance.config.options.replies, ['tools', 'json']);
  assert.equal(replyOf(m), 'tools/json');
  const report = fs.readFileSync(path.join(tmp, 'mixed', '404-A', 'report.md'), 'utf8');
  assert.match(report, /\| model \| reply \| seats \|/);
  assert.match(report, /\| m\/tools \| tools \| /);
  assert.match(report, /\| m\/json \| json \| /);
  const same = await season('mixed-same', 4, { seatModels: spec.map(g => ({ ...g, reply: 'tools' })), reply: 'tools' });
  assert.equal(same.provenance.config.options.replies, undefined, 'groups that answer as the season does need no list');
  assert.equal(replyOf(same), 'tools');
  const plain = await season('mixed-json', 4, { seatModels: spec.map(({ reply, ...g }) => g) });
  assert.equal(replyOf(plain), 'json', 'and a JSON season records nothing new');
  assert.equal('replies' in plain.provenance.config.options || 'reply' in plain.provenance.config.options, false);
});
