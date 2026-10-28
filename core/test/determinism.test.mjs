// GAME.md §23, §26: the same seed gives the same log, byte for byte; kill the run and restart it, and the log is
// identical. The kill is a real SIGKILL of the runner process, after a night's checkpoint and in the middle of a
// night's write.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-determinism-'));

function run(out, ...extra) {
  return spawnSync(process.execPath, [runner, '--seed', '404', '--rule', 'A', '--out', out, '--quiet', ...extra], { encoding: 'utf8' });
}
const logOf = out => fs.readFileSync(path.join(out, '404-A', 'events.jsonl'));

test('two runs of seed 404 give byte-identical event logs', () => {
  const a = run(path.join(tmp, 'one'));
  const b = run(path.join(tmp, 'two'));
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.ok(logOf(path.join(tmp, 'one')).length > 0);
  assert.ok(logOf(path.join(tmp, 'one')).equals(logOf(path.join(tmp, 'two'))));
});

for (const point of ['after-night:7', 'mid-write:7']) {
  test(`killed at ${point} and resumed, the log is identical`, () => {
    const out = path.join(tmp, point.replace(':', '-'));
    const killed = run(out, '--die-at', point);
    assert.equal(killed.signal, 'SIGKILL', `expected a kill, got status ${killed.status} ${killed.stderr}`);
    const resumed = run(out, '--resume');
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.ok(logOf(out).equals(logOf(path.join(tmp, 'one'))), 'the resumed log differs from the uninterrupted one');
  });
}

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
