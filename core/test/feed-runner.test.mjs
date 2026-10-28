import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSeason, parseArgs, RUNNER_ARGS } from '../bench/runner.mjs';
import { CASTS } from '../bench/bots.mjs';
import { viewFor } from '../rules/view.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(root, 'tmp/feed-test-'));
const file = (name, f) => path.join(tmp, name, '404-A', f);
const read = (name, f) => fs.readFileSync(file(name, f), 'utf8');
const lines = (name, f) => read(name, f).trim().split('\n').map(JSON.parse);
const opts = name => ({ seed: 404, rule: 'A', mix: CASTS.layer4, outDir: path.join(tmp, name) });
const phases = [];
let frames, ck, log;
before(() => {
  runSeason(opts('plain'));
  runSeason({ ...opts('feed'), feed: true, observe({ at, day, state, log: history, result }) {
    if (at !== 'night') return;
    const end = history.length - result.events.length + result.beforeDawn.eventCount;
    phases.push({ day, night: viewFor(result.beforeDawn.state, history.slice(0, end), null, 'record'),
      dawn: viewFor(state, history, null, 'record'), boundary: result.beforeDawn, events: result.events });
  } });
  frames = lines('feed', 'feed.jsonl');
  ck = JSON.parse(read('feed', 'checkpoint.json'));
  log = lines('feed', 'events.jsonl');
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('--feed is opt-in and leaves the private event log byte identical', () => {
  assert.deepEqual(parseArgs(['--feed'], RUNNER_ARGS), { feed: true, set: [] });
  assert.ok(!fs.existsSync(file('plain', 'feed.jsonl')));
  assert.equal(read('plain', 'events.jsonl'), read('feed', 'events.jsonl'));
  assert.ok(frames.length > 0 && frames.at(-1).over, 'control: a whole season was exported');
});

test('a season publishes exactly the final record events by identity, preserving every typed field', () => {
  const record = viewFor(ck.state, log, null, 'record');
  const ids = new Map(ck.feed.exporter.ids);
  const actual = new Map(frames.flatMap(f => f.events).map(e => [e.id, e]));
  assert.deepEqual([...ids.keys()].sort((a, b) => a - b), record.events.map(e => e.n).sort((a, b) => a - b));
  assert.equal(actual.size, record.events.length);
  assert.deepEqual([...actual.keys()].sort((a, b) => a - b), Array.from({ length: actual.size }, (_, i) => i));
  for (const { n, ...source } of record.events) {
    if (source.type === 'orders') source.of = source.of.map(ref => ids.get(ref));
    const { id, minute, ...published } = actual.get(ids.get(n));
    assert.equal(id, ids.get(n));
    assert.ok(Number.isInteger(minute));
    assert.deepEqual(published, source, `identity ${n}: ${source.type}`);
  }
});

test('frames are public changes only, boards are deltas, ids never expose a private count, event minutes are publication minutes', () => {
  let board = null, rest = null, lastMinute = -1;
  const events = new Map();
  for (const [i, f] of frames.entries()) {
    assert.equal(f.i, i);
    assert.ok(f.minute >= lastMinute);
    lastMinute = f.minute;
    let changed = false;
    if ('board' in f) {
      assert.notDeepEqual(f.board, board, 'only changed boards are included');
      board = f.board;
      changed = true;
    }
    for (const { id, minute, ...event } of f.events) {
      assert.equal(minute, f.minute);
      assert.ok(!('n' in event) && !('vis' in event));
      assert.notDeepEqual(event, events.get(id), 'only new or changed event forms');
      events.set(id, event);
      changed = true;
    }
    const next = [f.day, f.nightsLeft, f.midseason, f.over, f.sightings];
    if (JSON.stringify(next) !== JSON.stringify(rest)) changed = true;
    rest = next;
    assert.ok(changed, 'no empty public step');
    assert.deepEqual(Object.keys(f).sort(), ['i', 't', 'step', 'minute', 'events', 'sightings', 'day', 'nightsLeft', 'midseason', 'over', ...('board' in f ? ['board'] : [])].sort());
    const minute = f.day * 1440 + (f.step.kind === 'night' ? 1260
      : f.step.kind === 'errand' && f.step.round > 0 ? 360 + Math.floor(900 * f.step.round / 4) : 360);
    assert.equal(f.minute, minute);
  }
});

test('each real night and dawn has its own exact view board; night 14 boards before day 15 mints', () => {
  assert.equal(phases.length, ck.bench.ledger.nights, 'every settled night has phase evidence');
  let board;
  const effective = new Map();
  for (const f of frames) {
    if (f.board) board = f.board;
    effective.set(f.i, board);
  }
  for (const { day, night, dawn, boundary, events } of phases) {
    const n = frames.find(f => f.step.kind === 'night' && f.day === day);
    const d = frames.find(f => f.step.kind === 'dawn' && f.day === day + 1);
    assert.ok(n && d && n.i < d.i, `night ${day} precedes its dawn`);
    assert.deepEqual(effective.get(n.i), night.board);
    assert.deepEqual(effective.get(d.i), dawn.board);
    assert.equal(n.t, 2 * day + 1);
    assert.equal(d.t, 2 * (day + 1));
    assert.equal(boundary.state.day, day, 'snapshot was not mutated by dawn');
    assert.equal(boundary.state.clock, n.t);
    assert.ok(events.slice(0, boundary.eventCount).every(e => e.t === n.t));
    assert.ok(events.slice(boundary.eventCount).every(e => e.t === d.t));
    if (d.over) {
      assert.ok(n.events.some(e => e.type === 'board'));
      assert.ok(!n.events.some(e => e.type === 'mint' || e.type === 'season_end'));
      assert.ok(d.events.some(e => e.type === 'mint') && d.events.some(e => e.type === 'season_end'));
    }
  }
});

test('the same seed gives the same feed bytes', () => {
  runSeason({ ...opts('repeat'), feed: true });
  assert.equal(read('repeat', 'feed.jsonl'), read('feed', 'feed.jsonl'));
});

for (const point of ['mid-write:7', 'after-night:7']) test(`feed survives SIGKILL ${point}, an extra partial tail and --resume byte for byte`, () => {
  const name = point.replace(':', '-');
  const args = [path.join(root, 'core/bench/runner.mjs'), '--seed', '404', '--rule', 'A', '--cast', 'layer4', '--quiet', '--out', path.join(tmp, name)];
  const killed = spawnSync(process.execPath, [...args, '--feed', '--die-at', point], { encoding: 'utf8' });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr);
  fs.appendFileSync(file(name, 'feed.jsonl'), '{"partial":"☃');
  const resumed = spawnSync(process.execPath, [...args, '--resume'], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(read(name, 'feed.jsonl'), read('feed', 'feed.jsonl'));
  assert.equal(read(name, 'events.jsonl'), read('feed', 'events.jsonl'));
});

test('resume refuses to invent a feed prefix for a season that started without one', () => {
  const before = read('plain', 'events.jsonl');
  assert.throws(() => runSeason({ ...opts('plain'), resume: true, feed: true }), /no feed checkpoint/);
  assert.equal(read('plain', 'events.jsonl'), before);
  assert.ok(!fs.existsSync(file('plain', 'feed.jsonl')));
});

test('baseline memory is disclosed at dawn and common errand writes are sampled in their own round', () => {
  const factory = () => ({
    day: (view, { round }) => round === 1 ? [{ kind: 'outloud', say: 'boast', line: `PUBLIC-${view.me.id}-☃` },
      { kind: 'note', line: `NOTE-${view.me.id}` }] : [],
    night: () => ({ play: { kind: 'hustle', place: 'mall' }, reason: 'test' }),
  });
  runSeason({ ...opts('memory'), mix: { hustle: 3 }, feed: true, stopAfter: 1, creedBaseline: 'BASELINE-CREED-☃',
    botFactory: factory, controllerLabels: { hustle: 'feed-test' }, controllerSource: 'feed-test' });
  const f = lines('memory', 'feed.jsonl');
  const spoken = f.flatMap(frame => frame.events.filter(e => e.type === 'outloud').map(e => ({ frame, e })));
  assert.ok(spoken.length, 'control: public words were emitted');
  for (const { frame, e } of spoken) {
    assert.deepEqual(frame.step, { kind: 'errand', round: 1 });
    assert.equal(e.minute, frame.minute);
  }
  const first = f.find(frame => JSON.stringify(frame).includes('BASELINE-CREED-☃'));
  assert.deepEqual(first.step, { kind: 'dawn' });
  assert.equal(first.day, 2);
  assert.ok(first.events.some(e => e.type === 'memory' && e.part === 'note'));
  assert.ok(first.board.memories.every(m => m.creed.includes('BASELINE-CREED-☃')));
});
