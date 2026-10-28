// C1-2 properties, node only. Missing $0 fixtures are generated under gitignored core/runs/.
// Default: prove each planted fault fails, then check seeds 404-406. --fault <name> must exit 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Worker as NodeWorker } from 'node:worker_threads';
import { isDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';
import { createRecordAdapter, parseFeed } from '../simstate/record/adapter.js';
import * as clockModule from '../simstate/simclock.js';
import { sim } from '../simstate/store.js';
import { readFeed } from '../simstate/record/worker.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RECORD = new URL('../simstate/record/', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const seeds = fault ? [404] : [404, 405, 406];
const fileOf = seed => path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value)) freeze(v); } return value; };
function equal(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    const fields = expected && actual && typeof expected === 'object' ? Object.keys(expected).filter(k => !isDeepStrictEqual(actual[k], expected[k])).join(',') : 'value';
    throw new Error(`PROPERTY ${label}: mismatch in ${fields}`);
  }
}

// Independent oracle: inspect the prefix directly, not the reducer, player, or its revealAt().
const due = f => f.step.kind === 'night' ? Math.max(f.minute, f.day * 1440 + 1265) : f.minute;
function expected(prefix, minute) {
  const latest = prefix.at(-1), byId = {};
  for (const f of prefix) for (const e of f.events) byId[e.id] = e;
  const projection = { frame: latest ? { i: latest.i, t: latest.t, step: latest.step, minute: latest.minute } : null,
    board: prefix.findLast(f => f.board !== undefined)?.board ?? null,
    events: Object.values(byId), sightings: latest?.sightings ?? {}, day: latest?.day ?? null,
    nightsLeft: latest?.nightsLeft ?? null, midseason: latest?.midseason ?? null, over: latest?.over ?? null };
  if (minute === undefined) return projection;
  const night = prefix.findLast(f => f.step.kind === 'night');
  return { ...projection, minute, reveal: night ? { night: night.day, frame: night.i, minute: night.minute,
    start: night.day * 1440 + 1265, revealIds: night.events.map(e => e.id) } : null };
}
const at = (frames, minute) => expected(frames.filter(f => f.minute <= minute && due(f) <= minute), minute);

function ensureFeed(seed) {
  if (fs.existsSync(fileOf(seed))) return;
  const args = ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'];
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`feed generation failed: ${result.stderr || result.stdout}`);
  console.log(`generated seed ${seed}: ${args.join(' ')}`);
}

async function playerFactory(frames) {
  if (!fault) return (await import('../simstate/record/player.js')).createRecordPlayer;
  const url = new URL('player.js', RECORD);
  let source = fs.readFileSync(url, 'utf8');
  const replace = (old, next) => { assert(source.includes(old), `fault injection site missing: ${old}`); source = source.replace(old, next); };
  if (fault === 'lookahead') replace('revealAt(frames[cursor]) <= minute', 'revealAt(frames[Math.max(0, cursor - 1)]) <= minute');
  else if (fault === 'drop') {
    const picked = frames.find(f => f.i > 0 && f.events.length).i;
    replace('adapter.apply(frame);', `if (frame.i !== ${picked}) adapter.apply(frame);`);
  } else if (fault === 'seek-board') {
    const picked = frames.find(f => f.i > 0 && f.board && f.step.kind !== 'night'
      && !frames.some(next => next.i > f.i && next.minute === f.minute && next.board)).i;
    replace('adapter.apply(frame);', `if (reset && frame.i === ${picked}) { const { board, ...rest } = frame; adapter.apply(rest); } else adapter.apply(frame);`);
  } else throw new Error(`unknown fault: ${fault}`);
  for (const name of ['adapter.js', 'clock.js']) replace(`'./${name}'`, JSON.stringify(new URL(name, RECORD).href));
  return (await import('data:text/javascript,' + encodeURIComponent(source))).createRecordPlayer;
}

function checkStore(expectedState, label) {
  equal(sim.record(), expectedState, `${label} store projection`);
  equal(sim.board(), expectedState.board, `${label} store board`);
  equal(sim.world(), { ...expectedState.board, news: sim.events() }, `${label} world board`);
  const cards = (expectedState.board?.agents || []).map(a => {
    const said = expectedState.board.outloud?.filter(s => s.agent === a.id).at(-1);
    return { ...a, handle: a.id, cls: a.trade, model: a.driver, wear: a.fit, status: a.jailed ? 'jail' : 'active',
      mood: a.walk, ...(said ? { lastSay: said.line } : {}) };
  });
  equal(sim.agents(), cards, `${label} cards`);
  for (const c of cards) equal(sim.agent(c.id), { live: c, mine: null, tape: null, rap: null, people: null }, `${label} agent ${c.id}`);
  const events = expectedState.events.map(e => {
    const who = e.agent ?? e.from ?? e.a, to = e.to ?? e.target ?? e.b, place = e.place ?? e.corner;
    return { ...e, coreT: e.t, t: e.minute, ...(who === undefined ? {} : { who }),
      ...(to === undefined ? {} : { to }), ...(place === undefined ? {} : { at: place }) };
  });
  equal(sim.events(), events, `${label} event forms`);
}

// A real node worker runs the browser worker entry. Its only HTTP stand-in is a file read at the exact feed URL.
const requests = [];
class FileWorker {
  constructor(url) {
    const source = `import { parentPort } from 'node:worker_threads';
      import fs from 'node:fs/promises';
      globalThis.self = { postMessage: data => parentPort.postMessage(data) };
      globalThis.fetch = async url => { parentPort.postMessage({ type: 'request', url });
        return { ok: true, text: () => fs.readFile(new URL(url), 'utf8') }; };
      await import(${JSON.stringify(url.href)});
      parentPort.on('message', data => self.onmessage({ data }));`;
    this.worker = new NodeWorker(new URL('data:text/javascript,' + encodeURIComponent(source)));
    this.worker.on('message', data => { if (data.type === 'request') requests.push(data.url); else this.onmessage?.({ data }); });
    this.worker.on('error', error => this.onerror?.(error));
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { this.worker.terminate(); }
}

async function properties(seed) {
  ensureFeed(seed);
  const text = fs.readFileSync(fileOf(seed), 'utf8'), frames = freeze(parseFeed(text));
  const original = JSON.stringify(frames), createPlayer = await playerFactory(frames);
  const adapter = createRecordAdapter();
  for (let i = 0; i < frames.length; i++) {
    equal(adapter.apply(frames[i]), expected(frames.slice(0, i + 1)), `seed ${seed} frame ${i} exact prefix`);
  }
  // Multiple same-minute frames settle atomically. Also test between frames, before setup, and both show edges.
  const points = [...new Set([0, ...frames.flatMap(f => [f.minute, f.minute - .25, due(f), due(f) - .25])])].sort((a, b) => a - b);
  const player = createPlayer(frames, { speed: 60 });
  sim.useRecord(player); player.seek(0); player.play();
  for (const minute of points) {
    player.advance(minute - player.minute);
    const want = at(frames, minute);
    equal(player.snapshot(), want, `seed ${seed} playback minute ${minute} prefix only`);
    checkStore(want, `seed ${seed} minute ${minute}`);
  }
  const replay = createPlayer(frames);
  for (const minute of points.slice().reverse()) {
    equal(replay.seek(minute), at(frames, minute), `seed ${seed} seek minute ${minute} equals playback`);
    equal(createPlayer(frames).seek(minute), replay.snapshot(), `seed ${seed} repeat minute ${minute}`);
    sim.useRecord(replay); checkStore(at(frames, minute), `seed ${seed} seek ${minute}`);
  }
  // A suffix cannot affect an earlier projection, including when the later form reuses an old event id.
  for (const f of frames) {
    const prefix = frames.filter(g => g.minute <= f.minute), m = f.minute;
    equal(createPlayer(prefix).seek(m), createPlayer(frames).seek(m), `seed ${seed} frame ${f.i} suffix independence`);
  }
  const nights = frames.filter(f => f.step.kind === 'night');
  for (const f of nights) {
    equal(replay.jumpShow(f.day), at(frames, f.day * 1440 + 1265), `seed ${seed} night ${f.day} jump`);
    const before = replay.seek(f.day * 1440 + 1265 - .25);
    assert(before.frame.i < f.i, 'night board and results must wait for the show');
    equal(replay.seek(f.day * 1440 + 1265).reveal.revealIds, f.events.map(e => e.id), 'show reveal ids');
  }
  replay.on(state => equal(state, at(frames, state.minute), `seed ${seed} shows prefix`));
  replay.setSpeed(60); replay.playShows(); replay.advance(nights.length * 15 + 1);
  assert.equal(replay.running, false);
  assert.equal(replay.minute, nights.at(-1).day * 1440 + 1265 + 15);
  equal(JSON.stringify(frames), original, 'input frames unchanged');
  console.log(`seed ${seed}: ${frames.length} frames, ${frames.filter(f => f.board).length} boards, ${adapter.snapshot().events.length} event ids; ${points.length} playback/seek points PASS`);
  return frames;
}

async function plumbing(frames) {
  const { createRecordPlayer } = await import('../simstate/record/player.js');
  const clock = clockModule.createSimClock().clock, p = createRecordPlayer(frames, { clock });
  clock.pageT = 13;
  for (const speed of [1, 10, 60]) {
    p.setSpeed(speed); p.seek(p.bounds.from); p.play();
    const minute = p.minute; p.advance(60);
    assert(Math.abs(p.minute - minute - speed) < 1e-8, 'one real minute advances speed game minutes');
    equal(clockModule.GAME_MIN, 60 / speed, 'one movement conversion');
    equal([clock.t, clock.at, clock.rate, clock.running], [p.minute, 13, speed / 60, true], 'tape-style clock line');
  }
  p.pause(); const held = p.snapshot(); p.advance(100); equal(p.snapshot(), held, 'pause holds'); assert.equal(clock.rate, 0);
  const epoch = clock.epoch; p.seek(0); assert(clock.epoch > epoch, 'seek resets movement epoch');
  const detached = clockModule.createSimClock().clock, detach = p.attachClock(detached); assert.equal(detached.t, 0); detach();
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => p.advance(bad));
  assert.throws(() => p.setSpeed(2)); assert.throws(() => p.seek(NaN)); assert.throws(() => p.jumpShow(99));
  assert.throws(() => parseFeed('')); assert.throws(() => parseFeed('{bad}'));
  assert.throws(() => parseFeed(JSON.stringify({ ...frames[0], i: 1 })));
  for (const name of ['events.jsonl', 'checkpoint.json', 'result.json', 'report.md']) {
    await assert.rejects(readFeed(`https://record.invalid/${name}`, () => { throw new Error('PRIVATE FETCH ATTEMPTED'); }), /not a public feed/);
  }
  globalThis.Worker = FileWorker;
  const { loadInWorker, startRecord } = await import('../simstate/record/page.js');
  for (const seed of seeds) {
    const url = pathToFileURL(fileOf(seed)).href;
    equal(await loadInWorker(url), JSON.parse('[' + fs.readFileSync(fileOf(seed), 'utf8').trim().split('\n').join(',') + ']'), `seed ${seed} actual worker`);
  }
  globalThis.window = {}; globalThis.location = { href: 'https://record.invalid/style/city/' };
  const feed = pathToFileURL(fileOf(seeds[0])).href;
  const Q = new URLSearchParams({ sim: 'record', feed, simtod: '0', recordSpeed: '10', recordPaused: '1' });
  const page = await startRecord({ Q, SHOT: true, NIGHT: false });
  page.frame(0); page.frame(60); assert.equal(page.player.minute, frames[0].minute);
  page.player.play(); page.frame(120); equal(sim.record(), at(frames, frames[0].minute + 10), 'page drives store');
  equal(requests, [...seeds.map(seed => pathToFileURL(fileOf(seed)).href), feed], 'worker requests only the exact feeds');
  sim.stop(); delete globalThis.Worker; delete globalThis.window; delete globalThis.location;
  console.log('clock, pause, epoch, show windows, worker fetch/parse, page/store wiring, private-URL refusal PASS');
}

try {
  equal(clockModule.GAME_MIN, 2.5, 'old clock default');
  if (!fault) {
    ensureFeed(404);
    for (const name of ['lookahead', 'drop', 'seek-board']) {
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(result.status, 1, `${name} must fail`);
      assert.match(result.stderr, /PROPERTY/, `${name} must fail a state property`);
      console.log(`CONTROL ${name}: ${result.stderr.trim()}`);
    }
  }
  let first;
  for (const seed of seeds) { const frames = await properties(seed); first ??= frames; }
  if (!fault) await plumbing(first);
  console.log('RECORDCHECK PASS');
} catch (error) { console.error(`RECORDCHECK FAIL${fault ? ` (${fault})` : ''}: ${error.message}`); process.exitCode = 1; }
