// R7, a mixed season ($0): each model seat plays its own model (runner.mjs --seat-models), dealt from the seed; the
// season's result and report give a row a model; a killed mixed season resumes to the uninterrupted one, and a replay
// plays it again from its tape. No model is called and no key is read: the fake model answers the dry seasons, and the
// paid one goes to the fake OpenRouter through an injected fetch, with a dummy key.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTape } from '../agents/fake-model.mjs';

const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const fakeModule = () => import('../agents/fake-openrouter.mjs');
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r7-mixed-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const checkpoint = dir => JSON.parse(read(dir, 'checkpoint.json'));
const PROVIDER = { order: ['<PROVIDER>'], allow_fallbacks: false };
// The orchestrator's season (10-18): 8 model seats on the models-canny cast.
const SPEC = [
  { model: 'openai/gpt-6-luna', seats: 2, thinking: true },
  { model: 'google/gemini-3.1-flash-lite', seats: 2, thinking: false },
  { model: 'deepseek/deepseek-v4.1-flash', seats: 2, thinking: false, provider: PROVIDER },
  { model: 'anthropic/claude-sonnet-5.5', seats: 1, thinking: true },
  { model: 'openai/gpt-6.1-sol', seats: 1, thinking: true },
];
const DUMMY = 'sk-or-v1-r7-dummy-not-a-key';
const GO = 'a test: the fake OpenRouter stands in for the endpoint';
const URL_OR = 'http://openrouter.invalid/api/v1/chat/completions';
const FIRST_LINE = { json: { actions: [{ act: 'play', menu: 1 }] } };

function cli(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [runner, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}
const mixedArgs = (seed, out) => ['--seed', String(seed), '--rule', 'A', '--cast', 'models-canny', '--seat-models', JSON.stringify(SPEC), '--out', out, '--quiet'];

test('the deal: each group takes its seats among the model seats, in an order the seed shuffles, the same seed the same seats; groups that don\'t add up to the model seats are refused; a group is { model, seats, thinking, provider } and nothing else', async () => {
  const { dealSeatModels, seatModelsRefusal, seatModelsOf } = await runnerModule();
  const ids = ['a02', 'a05', 'a06', 'a07', 'a08', 'a10', 'a15', 'a18'];
  const spec = seatModelsOf(SPEC);
  const deal = dealSeatModels(418, ids, spec);
  assert.deepEqual(Object.keys(deal), ids, 'every model seat, by id');
  assert.deepEqual(spec.map((g, i) => Object.values(deal).filter(x => x === i).length), [2, 2, 2, 1, 1], 'each group its seats');
  assert.deepEqual(dealSeatModels(418, ids.slice().reverse(), spec), deal, 'the same seed, the same deal, whatever order the ids came in');
  assert.notDeepEqual(dealSeatModels(419, ids, spec), deal, 'control: another seed deals again');
  assert.throws(() => dealSeatModels(418, ids.slice(1), spec), e => e.refused && /8 seats.*7 model seats/.test(e.message));
  assert.equal(seatModelsRefusal(SPEC), null);
  assert.equal(seatModelsRefusal(SPEC, { url: URL_OR, api: 'openrouter' }), null);
  const bad = [
    [[], /JSON list/], [{ model: 'x', seats: 1 }, /JSON list/], [[{ model: '', seats: 1 }], /names its model/],
    [[{ model: 'x', seats: 0 }], /whole number/], [[{ model: 'x', seats: 1.5 }], /whole number/], [[{ model: 'x', seats: 1, thinking: 'yes' }], /true or false/],
    [[{ model: 'x', seats: 1, provider: ['a'] }], /JSON object/], [[{ model: 'x', seats: 1, temperature: 0 }], /no "temperature"/],
  ];
  for (const [spec2, why] of bad) assert.match(seatModelsRefusal(spec2), why, JSON.stringify(spec2));
  assert.match(seatModelsRefusal(SPEC, { url: URL_OR, api: 'local' }), /provider routing goes with --model-api openrouter/, 'a paid run sends a provider only in OpenRouter\'s body');
  assert.deepEqual(seatModelsOf([{ model: 'x', seats: 1 }]), [{ model: 'x', seats: 1, thinking: false }], 'thinking said either way, no provider unless named');
});

test('a dry mixed season (the fake, $0) plays to the end: each model seat is its own model on the board and in every request it makes, thinking where its group thinks; the run folder keeps the groups and the deal; the result and the report give a row a model', async () => {
  const { runModelSeason, MIXED } = await runnerModule();
  const { CASTS } = await botsModule();
  const r = await runModelSeason({ seed: 418, rule: 'A', outDir: path.join(tmp, 'dry'), mix: { ...CASTS['models-canny'], models: 8 }, seatModels: SPEC });
  assert.ok(r.metrics, 'the season finished');
  const ck = checkpoint(r.dir);
  assert.ok(ck.state.over);
  assert.equal(ck.models.model, MIXED);
  assert.equal(ck.models.url, null, 'the fake answered');
  assert.deepEqual(ck.models.mixed, SPEC);
  const seats = ck.cast.filter(c => c.model).map(c => c.id).sort();
  assert.deepEqual(Object.keys(ck.models.seatOf), seats, 'a group for every model seat');
  const modelOf = id => SPEC[ck.models.seatOf[id]].model;
  for (const id of seats) assert.equal(ck.state.agents[id].driver, modelOf(id), `${id}'s driver on the board`);
  assert.ok(ck.cast.filter(c => !c.model).every(c => ck.state.agents[c.id].driver === 'bot'), 'every bot reads bot');
  assert.deepEqual(ck.models.thinking, seats.filter(id => SPEC[ck.models.seatOf[id]].thinking), 'thinking where its group thinks');
  const tape = [...readTape(read(r.dir, 'tape.jsonl')).values()];
  assert.ok(tape.length > 100, `${tape.length} calls`);
  for (const l of tape) {
    assert.equal(l.request.model, modelOf(l.seat), `${l.seat}#${l.call}: its own model`);
    assert.equal(l.request.chat_template_kwargs.enable_thinking, ck.models.thinking.includes(l.seat), `${l.seat}#${l.call}: thinking`);
  }
  assert.deepEqual(new Set(tape.map(l => l.seat)), new Set(seats), 'every model seat called');
  const rows = r.metrics.byModel;
  assert.deepEqual(rows.map(x => [x.model, x.seats.length]), SPEC.map(g => [g.model, g.seats]), 'a row a group, in order');
  for (const x of rows) {
    assert.ok(Number.isFinite(x.haul.mean) && Number.isFinite(x.cash.mean) && Number.isInteger(x.pieces));
    assert.deepEqual(x.haul.bySeat, Object.fromEntries(x.seats.map(id => [id, r.metrics.haul[id]])), `${x.model}: the official haul`);
    assert.ok(x.crimes.won <= x.crimes.tried);
    assert.equal(x.calls.requests, tape.filter(l => x.seats.includes(l.seat)).length, `${x.model}: every request on the tape`);
    assert.ok(x.calls.callPoints > 0 && x.chars.mean > 0 && x.chars.max >= x.chars.mean && x.tokens.in > 0);
    assert.equal(x.spend, null, 'no spend record on the fake');
    assert.deepEqual(Object.keys(x.refusals).sort(), ['core', 'coverage', 'tools', 'unknown']);
  }
  assert.equal(rows.reduce((t, x) => t + x.calls.requests, 0), tape.length, 'the rows add up to the tape');
  const report = read(r.dir, 'report.md');
  assert.match(report, /\*\*By model\*\*/);
  for (const g of SPEC) assert.ok(report.includes(`| ${g.model}${g.thinking ? ', thinking' : ''}`), `${g.model}'s row`);
  assert.deepEqual(JSON.parse(read(r.dir, 'result.json')).byModel, JSON.parse(JSON.stringify(rows)), 'the result keeps the rows');
  // A season of one model has no rows: its result stays as it was.
  const one = await runModelSeason({ seed: 418, rule: 'A', outDir: path.join(tmp, 'one'), mix: { ...CASTS['models-canny'], models: 8 } });
  assert.equal('byModel' in one.metrics, false);
  assert.equal('mixed' in checkpoint(one.dir).models, false);
  assert.ok(!read(one.dir, 'report.md').includes('**By model**'));
});

test('a killed mixed season resumes to the uninterrupted one: killed after night 7\'s checkpoint or in the middle of its write and resumed with the same --seat-models, its log, tape, result and report are the uninterrupted run\'s, byte for byte; resumed without them, or with others, it is refused before anything is written', async () => {
  const whole = path.join(tmp, 'cli-whole');
  const w = await cli(mixedArgs(419, whole));
  assert.equal(w.status, 0, w.stderr);
  const wd = path.join(whole, '419-A');
  for (const [point, taped] of [['mid-write:7', true], ['after-night:7', false]]) {
    const out = path.join(tmp, `cli-kill-${point.replace(':', '-')}`);
    const killed = await cli([...mixedArgs(419, out), '--die-at', point]);
    assert.equal(killed.signal, 'SIGKILL', `expected a kill, got ${killed.status} ${killed.stderr}`);
    const dir = path.join(out, '419-A');
    const before = read(dir, 'checkpoint.json');
    const resumeArgs = ['--seed', '419', '--rule', 'A', '--cast', 'models-canny', '--out', out, '--quiet', '--resume'];
    const without = await cli([...resumeArgs, '--model-seats', '8']);
    assert.equal(without.status, 2, without.stderr);
    assert.match(without.stderr, /resume it with --seat-models/);
    const other = await cli([...resumeArgs, '--seat-models', JSON.stringify([{ ...SPEC[0], seats: 3 }, ...SPEC.slice(1, 4)])]);
    assert.equal(other.status, 2, other.stderr);
    assert.match(other.stderr, /resume it with --seat-models/);
    assert.ok(read(dir, 'checkpoint.json') === before, 'a refused resume writes nothing');
    const resumed = await cli([...mixedArgs(419, out), '--resume']);
    assert.equal(resumed.status, 0, resumed.stderr);
    for (const f of ['events.jsonl', 'tape.jsonl', 'result.json', 'report.md']) assert.ok(read(dir, f) === read(wd, f), `${point}: ${f} is the uninterrupted run's`);
    const from = Number((resumed.stdout.match(/(\d+) from the tape/) || [])[1]);
    assert.equal(from > 0, taped, `${point}: ${from} calls answered from the tape`);
  }
  // --replay plays the finished mixed season again from its tape, with no model: the same log, tape and report.
  const out = path.join(tmp, 'cli-replay');
  const r = await cli(['--replay', wd, '--out', out, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['events.jsonl', 'tape.jsonl', 'report.md']) assert.ok(read(path.join(out, '419-A'), f) === read(wd, f), `the replay's ${f}`);
});

test('the runner\'s guards for --seat-models, before anything is written: not with --model, --thinking-seats or --model-provider; its seats must be --model-seats; only on a model cast; a malformed list; and a paid run\'s provider routing only in OpenRouter\'s body', async () => {
  const base = ['--seed', '418', '--rule', 'A', '--cast', 'models-canny', '--quiet'];
  const spec = JSON.stringify(SPEC);
  const plain = JSON.stringify(SPEC.map(({ provider, ...g }) => g));
  const cases = [
    [[...base, '--seat-models', spec, '--thinking-seats', '2'], /not with --thinking-seats/],
    [[...base, '--seat-models', spec, '--model-provider', '{"order":["x"]}'], /not with --model-provider/],
    [[...base, '--seat-models', plain, '--model', 'x', '--model-url', URL_OR, '--go', GO], /not with --model/],
    [[...base, '--seat-models', spec, '--model-seats', '6'], /groups play 8 seats, not --model-seats 6/],
    [[...base, '--seat-models', '[{"model": "x"'], /JSON list/],
    [['--seed', '418', '--rule', 'A', '--cast', 'canny', '--seat-models', spec, '--quiet'], /--seat-models and --briefing go with --cast models/],
    [[...base, '--seat-models', spec, '--model-url', URL_OR, '--go', GO], /provider routing goes with --model-api openrouter/],
  ];
  for (const [i, [args, why]] of cases.entries()) {
    const out = path.join(tmp, `guard-${i}`);
    const r = await cli([...args, '--out', out]);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.status} ${r.stderr}`);
    assert.match(r.stderr, why);
    assert.equal(fs.existsSync(out), false, 'nothing written');
  }
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const out = path.join(tmp, 'guard-in-process');
  await assert.rejects(runModelSeason({ seed: 418, rule: 'A', outDir: out, mix: { ...CASTS['models-canny'], models: 6 }, seatModels: SPEC }), e => e.refused && /8 seats/.test(e.message));
  await assert.rejects(runModelSeason({ seed: 418, rule: 'A', outDir: out, mix: { ...CASTS['models-canny'], models: 8 }, seatModels: SPEC, model: 'x' }), e => e.refused);
  assert.equal(fs.existsSync(out), false, 'nothing written');
});

test('a paid mixed season, in-process on the fake OpenRouter: each seat sends its own model, its group\'s reasoning budget and only its group\'s provider routing; one --max-cost for the season stops it as SIGINT does; resumed with a higher cap it finishes; spend.jsonl and the rows by model agree, model by model, and each [spend] line gives each model\'s spend', async t => {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const { fakeOpenRouter } = await fakeModule();
  // A price a model, a call, so each model's spend is its billed requests times its price.
  const PRICE = { 'openai/gpt-6-luna': 0.001, 'google/gemini-3.1-flash-lite': 0.0002, 'deepseek/deepseek-v4.1-flash': 0.0003, 'anthropic/claude-sonnet-5.5': 0.004, 'openai/gpt-6.1-sol': 0.003 };
  const fake = fakeOpenRouter({ key: DUMMY, credits: 100, script: () => FIRST_LINE, cost: body => PRICE[body.model] });
  t.after(() => fake.close());
  const said = [];
  const opts = more => ({
    seed: 418, rule: 'A', outDir: path.join(tmp, 'paid'), mix: { ...CASTS['models-canny'], models: 8 }, url: URL_OR, fetch: fake.fetch, go: GO,
    key: DUMMY, api: 'openrouter', seatModels: SPEC, say: l => said.push(l), ...more,
  });
  await assert.rejects(runModelSeason(opts({ maxCost: 0.05 })), e => e.halt === 'cap', 'the one cap stops the season');
  const dir = path.join(tmp, 'paid', '418-A');
  const spendAt = () => read(dir, 'spend.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const stopped = spendAt().reduce((s, x) => s + x.cost, 0);
  assert.ok(stopped >= 0.05 && stopped < 0.06, `stopped at $${stopped}`);
  const r = await runModelSeason(opts({ maxCost: 7, resume: true }));
  assert.ok(r.metrics, 'resumed with a higher cap, it finished');
  const ck = checkpoint(dir);
  assert.equal(ck.models.maxCost, 7);
  const modelOf = id => SPEC[ck.models.seatOf[id]];
  const tape = [...readTape(read(dir, 'tape.jsonl')).values()];
  for (const l of tape) {
    const g = modelOf(l.seat);
    assert.equal(l.request.model, g.model, `${l.seat}#${l.call}`);
    assert.deepEqual(l.request.reasoning, g.thinking ? { max_tokens: 1024 } : { enabled: false }, `${l.seat}#${l.call}: its reasoning budget`);
    assert.deepEqual(l.request.provider, g.provider, `${l.seat}#${l.call}: its own routing, none unless its group names one`);
  }
  const spend = spendAt();
  assert.ok(spend.length >= tape.length, 'a line a request sent');
  for (const x of r.metrics.byModel) {
    const lines = spend.filter(s => x.seats.includes(s.seat));
    const costed = lines.filter(s => Number.isFinite(s.cost));
    assert.deepEqual([x.spend.sent, x.spend.costed], [lines.length, costed.length], `${x.model}: requests sent and costed`);
    assert.ok(costed.length > 0 && Math.abs(x.spend.cost - costed.length * PRICE[x.model]) < 1e-9, `${x.model}: $${x.spend.cost}`);
  }
  const total = r.metrics.byModel.reduce((s, x) => s + x.spend.cost, 0);
  assert.ok(Math.abs(total - spend.reduce((s, x) => s + x.cost, 0)) < 1e-9, 'the rows add up to the spend record');
  const nights = said.filter(l => /after night \d+ · /.test(l));
  assert.ok(nights.length >= 14, `${nights.length} night lines`);
  for (const l of nights) for (const g of SPEC) assert.match(l, new RegExp(`${g.model.replace(/[./]/g, '\\$&')} \\$\\d+\\.\\d{4}`));
  assert.ok(read(dir, 'report.md').includes(`| ${SPEC[3].model}, thinking`));
  for (const f of ['checkpoint.json', 'tape.jsonl', 'spend.jsonl', 'result.json', 'report.md']) assert.ok(!read(dir, f).includes(DUMMY), `${f} holds no key`);
});
