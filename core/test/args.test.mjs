// The bench and the runner refuse any argument they don't know (10-15). zsh passed "--set k=v" as one word, and the
// bench ran its defaults without a word, so a run could report numbers it never used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bench = path.join(here, '..', 'bench');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-args-'));

test('parseArgs takes what each program knows, and refuses an unknown flag, a stray word, a missing value, and "--set k=v" as one word', async () => {
  const { parseArgs, RUNNER_ARGS, BENCH_ARGS } = await import('../bench/runner.mjs');
  const ok = parseArgs(['--seed', '404', '--rule', 'B', '--set', 'rent=25', '--set', 'hustleCurve.typical=25', '--squatter', '--quiet'], RUNNER_ARGS);
  assert.deepEqual(ok, { seed: '404', rule: 'B', set: ['rent=25', 'hustleCurve.typical=25'], squatter: true, quiet: true });
  const bad = [
    ['--sed', '404'],
    ['--seed', '404', 'B'],
    ['--seed'],
    ['--seed', '--rule', 'A'],
    ['--seed', '404', '--set hustleCurve.typical=25'],
    ['--set'],
  ];
  for (const argv of bad) assert.throws(() => parseArgs(argv, RUNNER_ARGS), /argument/, JSON.stringify(argv));
  assert.deepEqual(parseArgs(['--seeds', '404-406', '--rules', 'A', '--squatter'], BENCH_ARGS), { seeds: '404-406', rules: 'A', set: [], squatter: true });
  assert.throws(() => parseArgs(['--seed', '404'], BENCH_ARGS), /argument/, 'the runner\'s --seed means nothing to the bench');
});

test('the runner and the bench stop on an argument they don\'t know, before anything runs', () => {
  const run = (prog, ...args) => spawnSync(process.execPath, [path.join(bench, prog), ...args], { encoding: 'utf8' });
  const one = path.join(tmp, 'runner');
  const r1 = run('runner.mjs', '--seed', '404', '--rule', 'A', '--out', one, '--quiet', '--set hustleCurve.typical=25');
  assert.notEqual(r1.status, 0);
  assert.match(r1.stderr, /unknown argument/);
  assert.equal(fs.existsSync(path.join(one, '404-A')), false, 'no season ran');
  const many = path.join(tmp, 'bench');
  const r2 = run('bench.mjs', '--seeds', '404-404', '--rules', 'A', '--out', many, '--set gap.evictedHit=carried');
  assert.notEqual(r2.status, 0);
  assert.match(r2.stderr, /unknown argument/);
  assert.equal(fs.existsSync(path.join(many, 'SUMMARY.md')), false, 'no bench ran');
  const r3 = run('bench.mjs', '--seeds', '404-404', '--rules', 'A', '--out', many, '--sqatter');
  assert.notEqual(r3.status, 0);
  assert.match(r3.stderr, /unknown argument/);
});
