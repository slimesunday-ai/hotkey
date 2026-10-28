// Node-only rewind properties. Faults mutate imported source in memory only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parseFeed } from '../simstate/record/adapter.js';
import { targetsAt } from '../simstate/record/placement.js';
import { createRoutinePlanner } from '../simstate/record/routines.js';
import { boardAt } from '../simstate/record/board-data.js';
import { cardsAt } from '../simstate/record/cards.js';
import { sim } from '../simstate/store.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RECORD = new URL('../simstate/record/', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => property(isDeepStrictEqual(a, b), label);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function feed(seed) {
  const file = path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
  if (!fs.existsSync(file)) {
    const result = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed),
      '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  return freeze(parseFeed(fs.readFileSync(file, 'utf8')));
}
async function modules(frames) {
  const sources = Object.fromEntries(['player.js', 'show-plan.js', 'tape-data.js']
    .map(name => [name, fs.readFileSync(new URL(name, RECORD), 'utf8')]));
  function replace(name, before, after) {
    assert(sources[name].includes(before), `missing mutation site ${before}`);
    sources[name] = sources[name].replace(before, after);
  }
  if (fault === 'future-marker') {
    const later = frames.flatMap(f => f.events).find(e => e.type === 'fight');
    replace('tape-data.js', 'return publicAt(snapshot).map(e => marker(snapshot, e)).filter(Boolean).sort((a, b) => a.id - b.id);',
      `return [...publicAt(snapshot).map(e => marker(snapshot, e)).filter(Boolean),
      {id:${later.id}, minute:${later.minute}, kind:'fight', place:null, replayStart:${later.minute}, subjects:{agent:null,others:[]}}];`);
  } else if (fault === 'hooded-live') {
    const shows = frames.flatMap(f => f.events).filter(e => e.type === 'show');
    const play = frames.flatMap(f => f.events).find(e => e.type === 'play'
      && !Object.hasOwn(shows.find(s => s.night === e.day).seen, e.agent));
    replace('tape-data.js', 'if (disclosed.minute - replay.minute <= DAY) return result;',
      `if (disclosed.minute - replay.minute <= DAY) { result.names.push({agent:${JSON.stringify(play.agent)}, source:{eventId:${play.id},minute:${play.minute}}}); return result; }`);
  } else if (fault === 'seek-board') {
    const picked = frames.find(f => f.i > 0 && f.board && f.step.kind === 'errand'
      && !frames.some(next => next.i > f.i && next.minute === f.minute && next.board));
    replace('player.js', 'adapter.apply({ ...frame }); cursor++;',
      `adapter.apply({ ...frame, board: reset && frame.i === ${picked.i} ? undefined : frame.board }); cursor++;`);
  } else if (fault) throw new Error(`unknown fault ${fault}`);
  const loaded = {};
  for (const name of ['player.js', 'show-plan.js', 'tape-data.js']) {
    const source = sources[name].replace(/'\.\/([^']+\.js)'/g, (_, dependency) =>
      JSON.stringify(loaded[dependency]?.url ?? new URL(dependency, RECORD).href));
    const url = 'data:text/javascript,' + encodeURIComponent(source);
    loaded[name] = { url, module: await import(url) };
  }
  return { ...loaded['show-plan.js'].module, ...loaded['tape-data.js'].module };
}

// Independent publication ledger. Staging's plan is the timing authority;
// neither the player's reducer nor tape selectors are the projection oracle.
function publications(frames, plans) {
  return frames.map(frame => ({ frame, at: frame.step.kind === 'night' ? plans.get(frame.day).start : frame.minute,
    forms: frame.events.map(event => {
      const plan = frame.step.kind === 'night' ? plans.get(frame.day) : null;
      const scene = plan?.scenes.find(s => s.revealIds.includes(event.id));
      return { event, at: plan ? scene?.end ?? plan.start : frame.minute };
    }) }));
}
function oracle(ledger, plans, minute) {
  const events = new Map();
  let board = null, frame = null, sightings = {}, day = null, nightsLeft = null, midseason = null, over = null;
  for (const row of ledger) {
    if (row.at > minute) break;
    const f = row.frame, end = f.step.kind === 'night' ? plans.get(f.day).end : f.minute;
    frame = { i: f.i, t: f.t, step: f.step, minute: f.minute }; day = f.day;
    for (const form of row.forms) if (form.at <= minute) events.set(form.event.id, form.event);
    if (minute < end) break;
    if (f.board !== undefined) board = f.board;
    ({ sightings, nightsLeft, midseason, over } = f);
  }
  return { board, frame, events: [...events.values()], sightings, day, nightsLeft, midseason, over };
}
function projection(state, expected) {
  for (const key of Object.keys(expected)) equal(key === 'events' ? state[key].slice().sort((a, b) => a.id - b.id) : state[key],
    key === 'events' ? expected[key].slice().sort((a, b) => a.id - b.id) : expected[key], `store ${key} equals published prefix`);
}
const markerTypes = new Map([['show', 'show'], ['fight', 'fight'], ['arrest', 'arrest'],
  ['turf', 'turf'], ['buy', 'sale'], ['season', 'ferry'], ['board', 'ferry']]);
function markerProperties(reader, snapshot, totals) {
  const markers = reader.markersAt(snapshot), expected = snapshot.events.filter(e => markerTypes.has(e.type)).sort((a, b) => a.id - b.id);
  equal(markers.map(m => m.id), expected.map(e => e.id), 'markers equal released feed order; no later-frame marker');
  for (const [index, m] of markers.entries()) {
    equal(m.kind, markerTypes.get(expected[index].type), 'marker typed kind');
    property(m.minute <= snapshot.minute, 'marker not before its publication');
    property(Number.isFinite(m.replayStart) && m.replayStart >= 0 && m.replayStart <= m.minute, 'valid replay lead');
    equal(Object.keys(m).sort(), ['id', 'minute', 'kind', 'place', 'replayStart', 'subjects'].sort(), 'marker schema');
  }
  totals.markers = Math.max(totals.markers, markers.length);
}
function sideProperties(module, replay, disclosed, totals) {
  const side = module.recordSideAt(replay, disclosed), age = disclosed.minute - replay.minute;
  if (age <= 1440) {
    equal(side.names, [], 'hooded name never shown live or during first 24 hours');
    equal(side.events, [], 'private side waits more than 24 hours');
  }
  const night = Math.floor(replay.minute / 1440), show = replay.events.find(e => e.type === 'show' && e.night === night);
  const wanted = age > 1440 && show ? disclosed.events.filter(e => e.type === 'play' && e.day === night
    && !Object.hasOwn(show.seen, e.agent)) : [];
  equal(side.names.map(n => n.agent), wanted.map(e => e.agent), 'all and only disclosed hooded play names');
  for (const row of side.names) {
    const source = disclosed.events.find(e => e.id === row.source.eventId);
    property(source?.type === 'play' && source.agent === row.agent && source.minute <= disclosed.minute,
      'name has a disclosed typed play source');
    if (['hit', 'breakin'].includes(source.kind)) equal(row.victim, source.target, 'record victim from typed target');
  }
  property(side.events.every(e => disclosed.events.includes(e) && e.t === replay.frame.t), 'side only contains disclosed source-period forms');
  totals.names += side.names.length;
}

async function run(seed) {
  const frames = feed(seed), module = await modules(frames), before = JSON.stringify(frames);
  const planner = module.createShowPlanner(frames), reader = module.createTapeReader(frames);
  const plans = new Map(frames.filter(f => f.step.kind === 'night').map(f => [f.day, planner.night(f.day)]));
  const ledger = publications(frames, plans), end = frames.at(-1).minute;
  const seek = module.createShowPlayer(frames), play = module.createShowPlayer(frames);
  const routines = createRoutinePlanner(frames), seekRoutines = createRoutinePlanner(frames);
  const totals = { hours: 0, boundaries: 0, markers: 0, cards: 0, names: 0 };
  play.seek(0); play.play(); sim.useRecord(play);
  for (let minute = 0; minute <= end; minute += 60) {
    const played = play.advance((minute - play.minute) * 60), sought = seek.seek(minute);
    projection(sought, oracle(ledger, plans, minute));
    equal(sought, played, 'hour seek equals uninterrupted playback including scenes');
    projection(played, oracle(ledger, plans, minute));
    equal(sim.record(), played, 'store follows playback');
    equal(targetsAt(sought, minute, seekRoutines), targetsAt(played, minute, routines), 'hour seek positions equal playback');
    equal(boardAt(sought), boardAt(played), 'hour seek board equals playback');
    equal(cardsAt(sought), cardsAt(played), 'hour seek cards equal playback');
    markerProperties(reader, sought, totals); sideProperties(module, sought, sought, totals);
    const guardedFuture = frames.map(f => f.minute <= minute ? f : new Proxy(f, {
      get() { throw new Error('tape reader inspected a later frame'); },
    }));
    equal(module.createTapeReader(guardedFuture).markersAt(sought), reader.markersAt(sought), 'no future frame reads');
    totals.hours++;
  }
  const points = new Set([0, end]);
  for (const row of ledger) for (const at of [row.at, ...row.forms.map(f => f.at)]) {
    points.add(at); points.add(Math.max(0, at - 1e-6));
  }
  for (const plan of plans.values()) for (const scene of plan.scenes) points.add((scene.start + scene.end) / 2);
  for (const minute of [...points].sort((a, b) => b - a)) {
    const state = seek.seek(minute);
    projection(state, oracle(ledger, plans, minute)); markerProperties(reader, state, totals);
    const partial = frames.filter(f => f.minute <= minute);
    if (partial.length) {
      equal(module.createTapeReader(partial).markersAt(state), reader.markersAt(state), 'marker suffix independence');
      const local = module.createShowPlayer(partial).seek(minute);
      // A partial player's bound may end before a clock-only query. Compare at
      // the actual shared minute rather than manufacturing future feed frames.
      if (local.minute === minute) {
        equal(local, state, 'seek independent of later frames');
      }
    }
    for (const card of cardsAt(state)) {
      const paper = reader.paperCardAt(state, card.replay.eventId);
      property(paper && paper.replayStart <= paper.minute && paper.minute <= minute, 'card replay resolves only published moments');
      equal(paper.subjects, card.subjects, 'paper preserves public card mask after receipt replacement');
      if (card.kind === 'Took') equal(paper.framing.agent, card.subjects.others[0] ?? null, 'missed theft frames victim');
      totals.cards++;
    }
    totals.boundaries++;
  }
  // Active scene progress is also tested through advance, not just seek.
  for (const plan of plans.values()) {
    const replay = seek.seek(plan.start + .5);
    const live = module.createShowPlayer(frames); live.seek(plan.start); live.play();
    const advanced = live.advance(30);
    equal(advanced, replay, 'in-progress scene seek equals play');
    for (const at of [replay.minute, replay.minute + 1440, replay.minute + 1440 + 1e-6, end]) {
      if (at < replay.minute) continue;
      const disclosed = { ...seek.seek(Math.min(at, end)), minute: at };
      sideProperties(module, replay, disclosed, totals);
    }
    const oldAt = replay.minute + 2880;
    const old = { ...seek.seek(Math.min(oldAt, end)), minute: oldAt };
    const withheld = { ...old, events: old.events.filter(e => !(e.type === 'play' && e.day === plan.night)) };
    equal(module.recordSideAt(replay, withheld).names, [], 'age alone cannot disclose names');
  }
  const final = seek.seek(end);
  const papers = new Map();
  for (const row of ledger) for (const { event, at } of row.forms) {
    const state = seek.seek(at);
    if (!event.card) continue;
    const paper = reader.paperCardAt(state, event.id);
    if (papers.has(event.id)) equal(paper, papers.get(event.id), 'paper replay survives full-receipt replacement');
    else papers.set(event.id, paper);
    const justBefore = seek.seek(at - 1e-6);
    if (!justBefore.events.some(e => e.id === event.id))
      equal(reader.paperCardAt(justBefore, event.id), null, 'paper absent before first publication');
  }
  for (const e of final.events.filter(e => e.card?.masked)) {
    const paper = reader.paperCardAt(final, e.id);
    equal(paper.subjects.agent, null, 'masked paper never adopts disclosed robber name');
  }
  equal(reader.paperCardAt(final, -1), null, 'unknown/unpublished paper event absent');
  assert.throws(() => reader.markersAt({ ...final, minute: 0 }), /snapshot/);
  const guarded = structuredClone(frames);
  const forbid = () => { throw new Error('forbidden prose/private field or random read'); };
  for (const frame of guarded) for (const event of frame.events)
    for (const key of ['text', 'line', 'reason', 'think', 'accept', 'vis'])
      Object.defineProperty(event, key, { get: forbid, configurable: true });
  const savedRandom = Math.random;
  try {
    Math.random = forbid;
    const guardedPlayer = module.createShowPlayer(guarded), guardedReader = module.createTapeReader(guarded);
    const disclosed = { ...guardedPlayer.seek(end), minute: end + 1440 };
    for (const plan of plans.values()) {
      const replay = guardedPlayer.seek(plan.start + .5);
      guardedReader.markersAt(replay); module.recordSideAt(replay, disclosed);
    }
    for (const event of disclosed.events.filter(e => e.card)) guardedReader.paperCardAt(disclosed, event.id);
  } finally { Math.random = savedRandom; }
  equal(JSON.stringify(frames), before, 'feed inputs unchanged');
  console.log(`seed ${seed}: ${totals.hours} hours, ${totals.boundaries} boundaries/scenes, ${totals.markers} markers, ${totals.cards} card replays, ${totals.names} name observations PASS`);
}

try {
  if (!fault) for (const [name, label] of [['future-marker', 'markers equal released feed order'],
    ['hooded-live', 'hooded name never shown live'], ['seek-board', 'store board equals published prefix']]) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
    property(child.status === 1 && child.stderr.includes(`PROPERTY ${label}`), `planted ${name} fails intended property: ${child.stderr.slice(0, 250)}`);
    console.log(`planted ${name}: exit 1 · ${child.stderr.trim()}`);
  }
  for (const seed of fault ? [404] : [404, 405, 406]) await run(seed);
  console.log('SEEKCHECK PASS');
} catch (error) { console.error(process.env.SEEK_DEBUG ? error.stack : error.message); process.exitCode = 1; }
