// R2-12, the paid endpoint on the runner's command line: the new flags and their guards, a key that never leaves the
// transport, the spend cap stopping a season as SIGINT does and a resume that raises it, a keyed season replayed with
// no key and no network, and the preflight. The runner runs in a child process; the fake OpenRouter
// (agents/fake-openrouter.mjs) answers it on a port the system picks, and the key is a dummy in a temp file. Nothing
// here reaches the network beyond 127.0.0.1, and no paid call is made. Each test imports what it needs itself, so each
// fails on its own before the code exists.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTape } from '../agents/fake-model.mjs';

const fakeModule = () => import('../agents/fake-openrouter.mjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-openrouter-cli-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
// What was open before any test ran: the file must leave its process as it found it.
const OPEN_AT_START = process.getActiveResourcesInfo();

// A dummy key, easy to find: its random tail is what a leak would carry.
const TAIL = crypto.randomBytes(16).toString('hex');
const DUMMY = `sk-or-v1-r2-12-dummy-${TAIL}`;
const leaks = text => String(text).includes(TAIL);
const keyFile = path.join(tmp, 'openrouter.key');
fs.writeFileSync(keyFile, `${DUMMY}\n`);
const CHAT = '/api/v1/chat/completions';
const GO = 'a test: the fake OpenRouter stands in for the endpoint';
const FIRST_LINE = { json: { actions: [{ act: 'play', menu: 1 }] } };
const turn = () => new Promise(resolve => setImmediate(resolve));
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8');
const checkpoint = dir => JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
const spendOf = dir => fs.readFileSync(path.join(dir, 'spend.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const filesIn = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? filesIn(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const chats = fake => fake.requests.filter(q => q.path === CHAT);
// A fake that closes when its test ends, passed or failed, so a failing test leaves nothing open.
function closing(t, fake) {
  t.after(() => fake.close());
  return fake;
}

// The runner on its own command line, in a child process, without blocking this one (the fake here answers it).
function cli(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [runner, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}
// A models season of four seats, two thinking, on the endpoint at url; with a key and a cap, on OpenRouter.
const season = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '4', '--thinking-seats', '2', '--quiet'];
const endpoint = url => ['--model', 'test/model', '--model-url', url, '--go', GO];
const paid = (url, cap) => [...season, ...endpoint(url), '--model-api', 'openrouter', '--model-key-file', keyFile, '--max-cost', String(cap)];

// One uncapped keyed season through the CLI at $0.01 a call, run once and shared; its endpoint closes when it ends.
let whole = null;
function wholeSeason() {
  whole ??= (async () => {
    const { fakeOpenRouter } = await fakeModule();
    const fake = fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE, cost: () => 0.01 });
    const { url } = await fake.listen();
    const out = path.join(tmp, 'whole');
    const r = await cli([...paid(url, 5), '--out', out]);
    await fake.close();
    return { ...r, dir: path.join(out, '404-A'), calls: chats(fake).length };
  })();
  return whole;
}

test('the guards on the command line, each before anything is written or called (exit 2): --model-key-file without --model-url, --model-api openrouter without --model-key-file, --model-key-file without --max-cost and --max-cost without it, a --max-cost that isn\'t a positive number, --model-provider without --model-api openrouter or not a JSON object, --model-api other than openrouter, a key file missing or empty, and the new flags without --cast models; the usage names the new flags', async t => {
  const { fakeOpenRouter } = await fakeModule();
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
  const { url } = await fake.listen();
  const empty = path.join(tmp, 'empty.key');
  fs.writeFileSync(empty, '\n');
  const models = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '2', '--quiet'];
  const real = [...models, ...endpoint(url)];
  const cases = [
    [[...models, '--model-key-file', keyFile, '--max-cost', '1'], /--model-key-file goes with --model-url/],
    [[...real, '--model-api', 'openrouter', '--max-cost', '1'], /--model-api openrouter needs --model-key-file/],
    [[...real, '--model-api', 'openrouter', '--model-key-file', keyFile], /--model-key-file needs --max-cost/],
    [[...real, '--max-cost', '1'], /--max-cost goes with --model-key-file/],
    [[...real, '--model-key-file', keyFile, '--max-cost', '0'], /--max-cost takes a positive number/],
    [[...real, '--model-key-file', keyFile, '--max-cost', 'lots'], /--max-cost takes a positive number/],
    [[...real, '--model-key-file', keyFile, '--max-cost', '1', '--model-provider', '{"order":["deepinfra"]}'], /--model-provider goes with --model-api openrouter/],
    [[...real, '--model-api', 'openrouter', '--model-key-file', keyFile, '--max-cost', '1', '--model-provider', '["deepinfra"]'], /--model-provider takes a JSON object/],
    [[...real, '--model-api', 'openrouter', '--model-key-file', keyFile, '--max-cost', '1', '--model-provider', '{order'], /--model-provider takes a JSON object/],
    [[...real, '--model-api', 'anthropic', '--model-key-file', keyFile, '--max-cost', '1'], /--model-api takes openrouter/],
    [[...real, '--model-api', 'openrouter', '--model-key-file', path.join(tmp, 'no-such.key'), '--max-cost', '1'], /--model-key-file.*no such file/i],
    [[...real, '--model-api', 'openrouter', '--model-key-file', empty, '--max-cost', '1'], /--model-key-file.*empty/],
    [['--seed', '404', '--rule', 'A', '--cast', 'layer4', '--model-key-file', keyFile, '--max-cost', '1', '--quiet'], /--model-key-file.*go with --cast models/],
  ];
  for (const [i, [args, why]] of cases.entries()) {
    const out = path.join(tmp, `guard-${i}`);
    const r = await cli([...args, '--out', out]);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, why);
    assert.doesNotMatch(r.stderr, /unknown argument/);
    assert.equal(fs.existsSync(out), false, `${why}: nothing written`);
    assert.ok(!leaks(r.stdout + r.stderr), `${why}: no key`);
  }
  assert.equal(fake.requests.length, 0, 'nothing reached the endpoint');
  const { stderr: usage } = await cli(['--seed', 'x']);
  for (const flag of ['--model-api openrouter', '--model-key-file', '--max-cost', '--model-provider']) assert.ok(usage.includes(flag), `the usage names ${flag}`);
  await fake.close();
});

test('the key never leaves the transport: after a short keyed season through the CLI, every file in its run folder, its stdout and its stderr hold none of the dummy key; every request carried it as authorization: Bearer <key> (the preflight\'s GETs first, the key\'s usage again last); without the flags no request carried one and the body is the local one; and a paid season resumes only with its key', async t => {
  const { fakeOpenRouter } = await fakeModule();
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
  const { url } = await fake.listen();
  const out = path.join(tmp, 'leak');
  const r = await cli([...paid(url, 5), '--stop-after', '2', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(out, '404-A');
  const files = filesIn(out);
  for (const name of ['events.jsonl', 'checkpoint.json', 'tape.jsonl', 'spend.jsonl']) assert.ok(files.includes(path.join(dir, name)), `${name} written`);
  for (const f of files) assert.ok(!leaks(fs.readFileSync(f, 'utf8')), `${path.relative(out, f)} holds no key`);
  assert.ok(!leaks(r.stdout) && !leaks(r.stderr), 'nor stdout or stderr');
  assert.match(r.stdout, /^OpenRouter: account balance \$\d+\.\d\d · key limit left none set · cap \$5$/m);
  assert.match(r.stdout, /^\[spend\] \$\d+\.\d{4} of \$5 · \d+ calls · after night 2$/m);
  const asked = [...fake.requests];
  assert.ok(chats(fake).length > 0 && asked.every(q => q.auth === `Bearer ${DUMMY}`), 'the key on every request');
  assert.deepEqual(asked.slice(0, 2).map(q => q.path), ['/api/v1/credits', '/api/v1/key'], 'the preflight first');
  assert.equal(asked.at(-1).path, '/api/v1/key', "the key's usage again last");
  // Without the flags: no request carries a key (the fake answers each with a 401, which the seat takes as any
  // endpoint's error), the body is the local model's, and no spend is recorded.
  const local = await cli([...season, ...endpoint(url), '--stop-after', '1', '--out', path.join(tmp, 'local')]);
  assert.equal(local.status, 0, local.stderr);
  const plain = fake.requests.slice(asked.length);
  assert.ok(plain.length > 0 && plain.every(q => q.auth === null && q.status === 401), 'no key on any request');
  const localDir = path.join(tmp, 'local', '404-A');
  assert.equal(fs.existsSync(path.join(localDir, 'spend.jsonl')), false, 'no spend record');
  for (const l of readTape(fs.readFileSync(path.join(localDir, 'tape.jsonl'), 'utf8')).values()) {
    assert.deepEqual(Object.keys(l.request), ['model', 'messages', 'response_format', 'chat_template_kwargs'], 'the local body');
  }
  // A paid season resumes only with its key: refused without it, before anything is called.
  const n = fake.requests.length;
  const keyless = await cli([...season, ...endpoint(url), '--resume', '--out', out]);
  assert.equal(keyless.status, 2, keyless.stderr);
  assert.match(keyless.stderr, /paid.*--model-key-file/);
  assert.equal(fake.requests.length, n, 'nothing called');
  await fake.close();
});

test('the cap: once the tally reaches --max-cost the season stops as SIGINT stops it (exit 3, "stopped", no night settled after it, no result), with a spend line after each night it played and a final one; a resume with the same cap is refused before anything is called; with a higher cap it plays on and finishes to the uncapped season\'s log and result', async t => {
  const { fakeOpenRouter } = await fakeModule();
  const uncapped = await wholeSeason();
  assert.equal(uncapped.status, 0, uncapped.stderr);
  const cap = 0.3;
  assert.ok(uncapped.calls * 0.01 > 2 * cap, `control: the whole season costs $${(uncapped.calls * 0.01).toFixed(2)}`);
  const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE, cost: () => 0.01 }));
  const { url } = await fake.listen();
  const out = path.join(tmp, 'capped');
  const dir = path.join(out, '404-A');
  const capped = await cli([...paid(url, cap), '--out', out]);
  assert.equal(capped.status, 3, capped.stderr);
  assert.match(capped.stderr, /^stopped: the spend reached the cap.*--resume plays on/m);
  assert.ok(!leaks(capped.stdout + capped.stderr));
  const ck = checkpoint(dir);
  assert.equal(ck.state.over, false);
  assert.equal(fs.existsSync(path.join(dir, 'result.json')), false, 'no result');
  const tally = spendOf(dir).reduce((t, x) => t + (x.cost || 0), 0);
  assert.ok(tally >= cap - 1e-9 && tally < cap + 4 * 0.01, `stopped at $${tally}: at the cap, past it by no more than the calls in flight`);
  const nights = [...capped.stdout.matchAll(/^\[spend\] \$\d+\.\d{4} of \$0\.3 · \d+ calls · after night (\d+)$/gm)].map(m => Number(m[1]));
  assert.deepEqual(nights, ck.bench.nights.map(x => x.night), 'a line after each night it played, none after the stop');
  assert.match(capped.stdout, /^\[spend\] \$\d+\.\d{4} of \$0\.3 · \d+ calls · final$/m);
  assert.match(capped.stdout, /^\[billed\] \$\d+\.\d{4} /m);
  const asked = fake.requests.length;
  const same = await cli([...paid(url, cap), '--resume', '--out', out]);
  assert.equal(same.status, 2, same.stderr);
  assert.match(same.stderr, /spent.*--max-cost/);
  assert.equal(fake.requests.length, asked, 'refused before anything is called');
  const resumed = await cli([...paid(url, 5), '--resume', '--out', out]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(readLog(dir) === readLog(uncapped.dir), "resumed, the uncapped season's log, byte for byte");
  assert.ok(fs.readFileSync(path.join(dir, 'result.json'), 'utf8') === fs.readFileSync(path.join(uncapped.dir, 'result.json'), 'utf8'), 'and its result');
  assert.equal(checkpoint(dir).models.maxCost, 5, 'the raised cap, kept');
  assert.ok(spendOf(dir).length >= uncapped.calls, 'the spend record keeps both runs\' calls');
  await fake.close();
});

test('a keyed season replays from its tape with no key and no network: its endpoint closed, --replay alone gives the same log byte for byte, with no spend record and no key in its folder; a replay refuses --model-key-file', async t => {
  const keyed = await wholeSeason();
  assert.equal(keyed.status, 0, keyed.stderr);
  assert.equal(checkpoint(keyed.dir).models.api, 'openrouter');
  const out = path.join(tmp, 'replay');
  const r = await cli(['--replay', keyed.dir, '--out', out, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(out, '404-A');
  assert.ok(readLog(dir) === readLog(keyed.dir), 'the same log');
  assert.equal(fs.existsSync(path.join(dir, 'spend.jsonl')), false, 'nothing spent');
  assert.doesNotMatch(r.stdout, /OpenRouter|\[spend\]|\[billed\]/);
  for (const f of filesIn(out)) assert.ok(!leaks(fs.readFileSync(f, 'utf8')), `${path.relative(out, f)} holds no key`);
  assert.equal(checkpoint(dir).models.api, 'openrouter', "the body it was played with, for the next replay");
  const refused = await cli(['--replay', keyed.dir, '--out', path.join(tmp, 'replay-keyed'), '--model-key-file', keyFile]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /--model-key-file/);
});

test('the preflight on the command line: it prints the account\'s balance and the key\'s limit left, amounts only, and refuses to start (exit 2, nothing written, no chat call) when either is below --max-cost, when a GET fails, or when nothing answers at the url; no refusal carries the key', async t => {
  const { fakeOpenRouter } = await fakeModule();
  const cases = [
    [{ credits: 10, used: 8 }, /the account's balance, \$2\.00, is below --max-cost \$5/, /^OpenRouter: account balance \$2\.00 · key limit left none set · cap \$5$/m],
    [{ limit: 20, keyUsage: 18 }, /the key's limit left, \$2\.00, is below --max-cost \$5/, /^OpenRouter: account balance \$100\.00 · key limit left \$2\.00 · cap \$5$/m],
    [{ down: { credits: 500 } }, /balance.*500/, null],
    [{ down: { key: 503 } }, /limit.*503/, null],
  ];
  for (const [i, [account, why, amounts]] of cases.entries()) {
    const fake = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE, ...account }));
    const { url } = await fake.listen();
    const out = path.join(tmp, `preflight-${i}`);
    const r = await cli([...paid(url, 5), '--out', out]);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, why);
    if (amounts) assert.match(r.stdout, amounts);
    assert.equal(fs.existsSync(out), false, 'nothing written');
    assert.equal(chats(fake).length, 0, 'no chat call');
    assert.ok(fake.requests.every(q => q.auth === `Bearer ${DUMMY}`));
    assert.ok(!leaks(r.stdout + r.stderr));
    await fake.close();
  }
  // Nothing answers: the fetch throws, and the refusal names it with no key in it.
  const gone = closing(t, fakeOpenRouter({ key: DUMMY, script: () => FIRST_LINE }));
  const { url } = await gone.listen();
  await gone.close();
  const r = await cli([...paid(url, 5), '--out', path.join(tmp, 'preflight-gone')]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /preflight.*fetch failed/);
  assert.ok(!leaks(r.stdout + r.stderr));
});

test('nothing a test here started is still open, so the file\'s process exits on its own', async t => {
  const extra = () => {
    const now = process.getActiveResourcesInfo();
    for (const x of OPEN_AT_START) {
      const i = now.indexOf(x);
      if (i >= 0) now.splice(i, 1);
    }
    return now;
  };
  for (let i = 0; i < 100 && extra().length; i++) await turn();
  assert.deepEqual(extra(), []);
});
