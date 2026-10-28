// R8, whole seasons on the fake ($0): the runner's --reply json|tools (a --seat-models group's "reply" for its own seats)
// and --briefing starter, beside current and legacy. A season plays to the end in both reply modes with both briefings;
// the bots reach the rules the same way through tool calls as through JSON, so the seasons are the same season; the run
// folder keeps the arm and the reply, a resume must name them, and a replay plays them. JSON and the current briefing
// stay the default. Nothing here calls a model: every model seat talks to the runner's in-process fake.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTape } from '../agents/fake-model.mjs';

const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const toolsModule = () => import('../agents/tool-calls.mjs');
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8-seasons-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const text = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const checkpoint = dir => JSON.parse(text(dir, 'checkpoint.json'));
const tapeOf = dir => [...readTape(text(dir, 'tape.jsonl')).values()];
const cli = args => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });
const SEASON = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '4', '--quiet'];

async function season(name, more = {}) {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  return runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, name), mix: { ...CASTS.models, models: 4 }, ...more });
}

test('a whole season on the fake plays to the end in both reply modes with both briefings: tools mode sends the tools on every call and reads tool calls back, and all four seasons are the same season, event for event', async () => {
  const { toolDefinitions } = await toolsModule();
  const runs = {};
  for (const briefing of ['current', 'starter']) {
    for (const reply of ['json', 'tools']) {
      const r = await season(`${briefing}-${reply}`, { ...(briefing === 'current' ? {} : { briefing }), ...(reply === 'json' ? {} : { reply }) });
      assert.ok(r.metrics, `${briefing}/${reply}: the season finished`);
      const ck = checkpoint(r.dir);
      assert.ok(ck.state.over, `${briefing}/${reply}: to the end`);
      const tape = tapeOf(r.dir);
      assert.ok(tape.length > 0);
      for (const l of tape) {
        const msg = l.reply.body.choices[0].message;
        if (reply === 'tools') {
          assert.deepEqual(l.request.tools, toolDefinitions(), 'every tools-mode call carries the tools');
          assert.ok(!('response_format' in l.request));
          assert.ok(Array.isArray(msg.tool_calls) && msg.content === null, 'and the fake answers with tool calls');
        } else {
          assert.ok(!('tools' in l.request) && typeof msg.content === 'string');
          assert.deepEqual(l.request.response_format, { type: 'json_object' });
        }
        const system = l.request.messages[0].content;
        assert.equal(system.startsWith('AI City. You play one agent on an island'), briefing === 'starter', `${briefing}: its rulebook`);
        assert.equal(system.includes('Reply JSON {"actions":[...]}'), reply === 'json', `${reply}: its reply format`);
      }
      const outcomes = Object.values(ck.models.seats).flatMap(s => s.record.flatMap(x => x.attempts.map(a => a.outcome)));
      assert.ok(outcomes.every(o => o === 'reply' || (reply === 'tools' && o === 'malformed')), `${briefing}/${reply}: only replies, and in tools mode the idle day calls that called nothing`);
      runs[`${briefing}/${reply}`] = { events: text(r.dir, 'events.jsonl'), outcomes, ck };
    }
  }
  const [first, ...rest] = Object.values(runs);
  for (const [k, r] of Object.entries(runs)) assert.equal(r.events, first.events, `${k}: the same season as current/json`);
  assert.ok(rest.length === 3);
  // The run folder keeps the arm and the reply, only when they aren't the defaults.
  assert.deepEqual([runs['current/json'].ck.bench.options.reply, runs['current/json'].ck.models.reply, runs['current/json'].ck.models.briefing], [undefined, undefined, undefined]);
  assert.deepEqual([runs['starter/tools'].ck.bench.options.reply, runs['starter/tools'].ck.models.reply], ['tools', 'tools']);
  assert.deepEqual([runs['starter/tools'].ck.bench.options.briefing, runs['starter/tools'].ck.models.briefing], ['starter', 'starter']);
});

test('a --seat-models group\'s "reply" sets its own seats\' mode, the season\'s flag the rest; the run folder keeps it with its group', async () => {
  const spec = [{ model: 'm/tools', seats: 2, thinking: false, reply: 'tools' }, { model: 'm/json', seats: 2, thinking: true }];
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const r = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'mixed'), mix: { ...CASTS.models, models: 4 }, seatModels: spec, stopAfter: 2 });
  const ck = checkpoint(r.dir);
  assert.deepEqual(ck.models.mixed, [{ model: 'm/tools', seats: 2, thinking: false, reply: 'tools' }, { model: 'm/json', seats: 2, thinking: true }]);
  for (const l of tapeOf(r.dir)) {
    const tools = ck.models.mixed[ck.models.seatOf[l.seat]].reply === 'tools';
    assert.equal('tools' in l.request, tools, `${l.seat}: its group's mode`);
    assert.equal(l.request.model, ck.models.mixed[ck.models.seatOf[l.seat]].model);
    if (tools) assert.equal(l.request.tool_choice, 'required');
  }
  const flipped = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'mixed-season-flag'), mix: { ...CASTS.models, models: 4 }, seatModels: [{ ...spec[0], reply: 'json' }, spec[1]], reply: 'tools', stopAfter: 1 });
  const ck2 = checkpoint(flipped.dir);
  for (const l of tapeOf(flipped.dir)) {
    const tools = ck2.models.mixed[ck2.models.seatOf[l.seat]].model === 'm/json';
    assert.equal('tools' in l.request, tools, `${l.seat}: a group without "reply" takes the season's`);
    if (tools) assert.equal(l.request.tool_choice, 'auto', 'a thinking seat\'s tool_choice');
  }
  const { seatModelsRefusal } = await runnerModule();
  assert.match(seatModelsRefusal([{ model: 'x', seats: 1, reply: 'xml' }]), /reply is json or tools/);
  assert.equal(seatModelsRefusal([{ model: 'x', seats: 1, reply: 'tools' }]), null);
});

test('on the command line: --reply and --briefing starter go with the model casts; a resume must name the season\'s reply and arm; a replay plays them from the tape', () => {
  const out = path.join(tmp, 'cli');
  const bad = cli([...SEASON, '--reply', 'xml', '--out', out]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--reply takes json or tools, not xml/);
  const bots = cli(['--seed', '404', '--rule', 'A', '--cast', 'layer4', '--reply', 'tools', '--quiet', '--out', out]);
  assert.equal(bots.status, 2);
  assert.match(bots.stderr, /--reply, --seat-models and --briefing go with --cast models/);
  const arm = cli([...SEASON, '--briefing', 'nope', '--out', out]);
  assert.match(arm.stderr, /--briefing takes current or legacy, not nope \(or starter/);
  const pilot = cli([...SEASON, '--reply', 'tools', '--briefing', 'starter', '--stop-after', '2', '--out', out]);
  assert.equal(pilot.status, 0, pilot.stderr);
  const dir = path.join(out, '404-A');
  const wrong = cli([...SEASON, '--briefing', 'starter', '--resume', '--out', out]);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /this season's reply is tools: resume it with --reply tools/);
  const wrongArm = cli([...SEASON, '--reply', 'tools', '--resume', '--out', out]);
  assert.equal(wrongArm.status, 2);
  assert.match(wrongArm.stderr, /this season's briefing is starter/);
  const resumed = cli([...SEASON, '--reply', 'tools', '--briefing', 'starter', '--resume', '--out', out]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(checkpoint(dir).state.over, 'played on to the end');
  const again = path.join(tmp, 'cli-replay');
  const replay = cli(['--replay', dir, '--out', again, '--quiet']);
  assert.equal(replay.status, 0, replay.stderr);
  const ck = checkpoint(path.join(again, '404-A'));
  assert.deepEqual([ck.models.reply, ck.models.briefing, ck.bench.options.reply], ['tools', 'starter', 'tools']);
  assert.equal(text(path.join(again, '404-A'), 'events.jsonl'), text(dir, 'events.jsonl'), 'the replay is the same season');
});
