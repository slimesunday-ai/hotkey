// C1-4 properties. Node only, no port, model, pinned schedule or production edit.
// Default proves three planted faults fail first, then checks seeds 404–406.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseFeed } from '../simstate/record/adapter.js';
import { createRecordPlayer } from '../simstate/record/player.js';
import { targetsAt } from '../simstate/record/placement.js';
import { CITY_PLACES, HOUSE_LOTS } from '../simstate/record/places.js';
import { meetingPlace } from '../simstate/record/routine-places.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MODULE = new URL('../simstate/record/routines.js', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => property(isDeepStrictEqual(a, b), label);
const due = f => f.step.kind === 'night' ? Math.max(f.minute, f.day * 1440 + 1265) : f.minute;
const fileOf = seed => path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
function ensureFeed(seed) {
  if (fs.existsSync(fileOf(seed))) return;
  const args = ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'];
  const child = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  console.log(`generated seed ${seed}: ${args.join(' ')}`);
}
async function moduleUnderTest() {
  let source = fs.readFileSync(MODULE, 'utf8');
  const replace = (before, after) => {
    assert(source.includes(before), `fault injection site: ${before}`); source = source.replace(before, after);
  };
  if (fault === 'lookahead') {
    replace('return [...rows.values()].map(list => lastAt(list, minute)).filter(Boolean);', `
      const result = [...rows.values()].map(list => lastAt(list, minute)).filter(Boolean);
      const early = frames.find(f => f.step.kind === 'night' && f.day === Math.floor(minute / DAY))
        ?.events.find(e => e.type === 'show');
      if (early && result.length) result[0] = { ...result[0],
        place: { ...result[0].place, corePlace: early.seen[result[0].agent] ?? 'hidden' } };
      return result;`);
  } else if (fault === 'missing-partner') replace('for (const agent of [a, b]) put', 'for (const agent of [a]) put');
  else if (fault === 'random') replace('function at(minute) {', 'function at(minute) { Math.random();');
  else if (fault) throw new Error(`unknown fault ${fault}`);
  for (const name of ['places.js', 'addresses.js', 'adapter.js', 'player.js', 'routine-places.js']) {
    source = source.replace(`'./${name}'`, JSON.stringify(new URL(name, MODULE).href));
  }
  return import('data:text/javascript,' + encodeURIComponent(source));
}

function verifyMeetings(plan, events, label) {
  for (const event of events.filter(e => e.type === 'meet')) {
    const cue = plan.meetings.find(m => m.eventId === event.id);
    property(cue && cue.a === event.a && cue.b === event.b, `${label} meet ${event.id} has both actors`);
    equal(cue.place, meetingPlace(event.a, event.b).place, 'meeting venue dealt by pair ids');
    equal(meetingPlace(event.a, event.b), meetingPlace(event.b, event.a), 'pair order independence');
    const pair = [event.a, event.b].map(id => plan.entries.find(r => r.agent === id && r.meet === event.id));
    property(pair.every(Boolean), `${label} meet ${event.id} both schedules include it`);
    property(pair.every(r => r.minute === cue.minute && r.role === 'meet'), 'meeting begins together');
    property(pair.every(r => isDeepStrictEqual(r.place, { ...cue.place, lot: cue.place.lot ?? null }))
      || pair.every(r => r.cut && isDeepStrictEqual(r.scenePlace, cue.place)), 'meeting together or explicit paired scene cut');
    property(pair.every(r => r.cut) && cue.cut, 'unannounced trip has paired arrival cut');
  }
}

// Trap payload reads, not just output differences. The reducer may retain an
// opaque private event by id, but the day planner may not read any of its facts.
function guarded(frames, horizon) {
  const ignored = new Set(['play', 'memory', 'chat', 'say', 'ask', 'close', 'orders', 'order', 'stash', 'take', 'pay', 'give']);
  const fail = label => () => { throw new Error(`PROPERTY forbidden read: ${label}`); };
  return frames.map(frame => {
    const copy = { ...frame };
    if (due(frame) > horizon) {
      for (const field of ['board', 'events', 'sightings']) Object.defineProperty(copy, field,
        { get: fail(`future ${frame.step.kind}.${field} at ${horizon}`) });
    } else {
      copy.events = frame.events.map(event => new Proxy(event, { get(target, key) {
        if (event.type === 'show' && key === 'plays') return fail('show.plays')();
        if (ignored.has(event.type) && !['type', 'id'].includes(key)) return fail(`${event.type}.${String(key)}`)();
        return Reflect.get(target, key);
      } }));
      if (copy.board) copy.board = new Proxy(copy.board, { get(target, key) {
        if (['memories', 'outloud', 'tonight', 'street'].includes(key)) return fail(`board.${String(key)}`)();
        return Reflect.get(target, key);
      } });
    }
    return copy;
  });
}

function synthetic(createRoutinePlanner) {
  const agents = ['a', 'b', 'c'].map(id => ({ id, trade: 'chemist', fit: [], walk: null, crew: null, jailed: false }));
  const board = { agents, corners: [] };
  const frame = (i, minute, events = [], boardValue) => ({ i, t: 2 * Math.floor(minute / 1440),
    day: Math.floor(minute / 1440), minute, step: { kind: i ? 'errand' : 'setup' },
    events, sightings: {}, ...(boardValue ? { board: boardValue } : {}) });
  const event = (id, minute, type, fields) => ({ id, minute, day: Math.floor(minute / 1440), type, ...fields });
  const frames = [frame(0, 1800, [event(0, 1800, 'season', { seed: 404 })], board),
    frame(1, 1810, [event(1, 1810, 'meet', { a: 'a', b: 'b', sitdown: 'lasting' })]),
    frame(2, 1830, [event(2, 1830, 'memory', { agent: 'a', memory: { plan: ['secret'] } }),
      event(3, 1830, 'say', { from: 'a', to: 'b', line: 'PRIVATE WORDS' })]),
    frame(3, 1870, [event(4, 1870, 'outloud', { agent: 'a', line: 'PUBLIC LINE', terms: { who: 'c' } })]),
    frame(4, 3240, []),
    frame(5, 3250, [event(5, 3250, 'meet', { a: 'b', b: 'a', sitdown: 'lasting' })]),
    frame(6, 3260, [], { ...board, agents: agents.map(a => a.id === 'a' ? { ...a, fit: [{ trait: 'tee' }] } : a) }),
    frame(7, 3270, [event(6, 3270, 'chat', { from: 'a', line: 'CREW WORDS' }),
      { ...event(7, 3270, 'close', { a: 'a', b: 'b', sitdown: 'lasting' }), day: 1 }])];
  const p = createRoutinePlanner(frames);
  property(p.at(1869).filter(r => r.meet === 1).length === 2, 'private words and hourly tick do not end meeting');
  property(p.at(1870).every(r => r.meet !== 1), 'next public act ends both sides of meeting');
  const bubble = p.day(1).bubbles;
  equal(bubble.map(b => [b.agent, b.minute, b.line]), [['a', 1870, 'PUBLIC LINE']], 'only outloud becomes a bubble');
  equal(bubble[0].place, p.at(1869).find(r => r.agent === 'a').place, 'bubble at then place');
  property(p.at(3240).every(r => r.meet === undefined), 'lasting sitdown requires a fresh public meet each day');
  property(p.at(3259).filter(r => r.meet === 5).length === 2, 'lasting sitdown staged again on its active day');
  property(p.at(3260).every(r => r.meet !== 5), 'board fit change ends meeting');
  verifyMeetings(p.day(1), [frames[1].events[0]], 'synthetic day1');
  verifyMeetings(p.day(2), [frames[5].events[0]], 'synthetic day2');
  const noClose = createRoutinePlanner(frames.slice(0, -1));
  equal(p.at(3270), noClose.at(3270), 'delayed close and crew chat cannot move anyone');
  const overlapping = [...frames.slice(0, 2), frame(2, 1810,
    [event(8, 1810, 'meet', { a: 'a', b: 'c', sitdown: 'second' })])];
  verifyMeetings(createRoutinePlanner(overlapping).day(1), [frames[1].events[0], overlapping[2].events[0]], 'same-minute cuts');
  const sparse = createRoutinePlanner([frames[0]]);
  property(sparse.at(1870).every(r => ['cook', 'hang'].includes(r.role)), 'Chemist lab has a loop');
  const g = createRoutinePlanner(guarded(frames, 1869));
  equal(g.at(1869), p.at(1869), 'synthetic guarded payloads');
  const jailed = { ...board, agents: agents.map(a => a.id === 'a' ? { ...a, jailed: true } : a) };
  const jailFrames = [frame(0, 1800, frames[0].events, jailed), frames[1]];
  const prison = createRoutinePlanner(jailFrames);
  property(prison.at(1810).find(r => r.agent === 'a').place.cityPlace === 'jail', 'jailed meeting uses a cut without moving its street walker');
  verifyMeetings(prison.day(1), frames[1].events, 'jailed pair');
  const evicted = createRoutinePlanner([frames[0], frame(1, 1810, [],
    { ...board, agents: agents.map(a => ({ ...a, evicted: true })) })]);
  property(evicted.at(1810).every(r => r.place.cityPlace === 'heap'), 'public eviction leaves home immediately');
  const dawn = createRoutinePlanner([frames[0], frame(1, 3240,
    [event(1, 3240, 'meet', { a: 'a', b: 'b', sitdown: 'dawn' })])]);
  property(dawn.at(3241).filter(r => r.meet === 1).length === 2, 'new dawn meet survives routine reset');
  const hourly = createRoutinePlanner([frames[0], frame(1, 1860,
    [event(1, 1860, 'outloud', { agent: 'a', line: 'On the hour' })])]);
  equal(hourly.day(1).bubbles[0].place, hourly.at(1860).find(r => r.agent === 'a').place,
    'hourly tick cannot displace a simultaneous bubble');
  console.log('synthetic: lasting/same-minute/jailed/dawn meets, public-act ends, fit/eviction, speech/tick privacy PASS');
}

async function run() {
  ensureFeed(404);
  if (!fault) for (const name of ['lookahead', 'missing-partner', 'random']) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(child.status, 1, `${name} must fail`);
    assert.match(child.stderr, /PROPERTY/, `${name} must fail a routine property`);
    console.log(`CONTROL ${name}: ${child.stderr.trim()}`);
  }
  const { createRoutinePlanner, LOOP_ROLES } = await moduleUnderTest();
  // Even a random call whose result gets discarded must fail this gate.
  const random = Math.random;
  Math.random = () => { throw new Error('PROPERTY planner called Math.random'); };
  try {
    if (!fault) synthetic(createRoutinePlanner);
    for (const seed of fault ? [404] : [404, 405, 406]) {
      ensureFeed(seed);
      const text = fs.readFileSync(fileOf(seed), 'utf8'), frames = freeze(parseFeed(text));
      const before = JSON.stringify(frames), planner = createRoutinePlanner(frames);
      const repeat = createRoutinePlanner(parseFeed(text)), cutFrames = [], cut = createRoutinePlanner(cutFrames);
      const player = createRecordPlayer(frames), cityIds = new Set([...Object.keys(CITY_PLACES), ...HOUSE_LOTS.map(l => l.id)]);
      let cursor = 0, board = null, minutes = 0, agentMinutes = 0, gaps = 0, meetCount = 0, guards = 0;
      for (let minute = frames[0].minute; minute <= frames.at(-1).minute; minute++) {
        while (cursor < frames.length && frames[cursor].minute <= minute) cutFrames.push(frames[cursor++]);
        const dueBoard = frames.findLast(f => due(f) <= minute && f.board);
        board = dueBoard?.board ?? board;
        const rows = planner.at(minute);
        equal(rows, cut.at(minute), `seed ${seed} feed cut at ${minute} gives same schedule`);
        equal(rows, repeat.at(minute), `seed ${seed} same feed repeats at ${minute}`);
        if (minute % 1440 < 360 || minute % 1440 > 1260) continue;
        minutes++;
        equal(rows.map(r => r.agent), board.agents.map(a => a.id), 'one row per roster id');
        for (const agent of board.agents) {
          const row = rows.find(r => r.agent === agent.id);
          if (!agent.jailed) { agentMinutes++; if (!row?.role) gaps++; }
          property(row && LOOP_ROLES.includes(row.role), 'every agent has a loop role');
          property(row.minute <= minute && cityIds.has(row.place.cityPlace), 'no future or unmapped destination');
          if (agent.jailed) property(row.place.cityPlace === 'jail', 'jail stays Iron Island');
          if (row.place.corePlace === 'home' || row.place.corePlace.startsWith('lab-')) property(row.walk === null, 'visible high outdoors only');
        }
      }
      property(gaps === 0, `no idle gaps (${gaps}/${agentMinutes} agent-minutes)`);
      const days = [...new Set(frames.map(f => f.day))].filter(d => d >= 1 && d <= 14);
      for (const day of days) {
        const end = day * 1440 + 1260, plan = planner.day(day);
        const meets = frames.filter(f => due(f) <= end).flatMap(f => f.events)
          .filter(e => e.type === 'meet' && e.day === day);
        verifyMeetings(plan, meets, `seed ${seed}`); meetCount += meets.length;
        const lines = frames.filter(f => due(f) <= end).flatMap(f => f.events)
          .filter(e => e.type === 'outloud' && e.day === day);
        equal(plan.bubbles.map(b => [b.eventId, b.agent, b.minute, b.line]),
          lines.map(e => [e.id, e.agent, e.minute, e.line]), 'every public outloud exactly once');
        for (const minute of [day * 1440 + 360, day * 1440 + 810, end]) {
          const guard = createRoutinePlanner(guarded(frames, minute));
          equal(guard.at(minute), planner.at(minute), `no private or future payload read at ${minute}`); guards++;
          const snapshot = player.seek(minute), targets = targetsAt(snapshot, minute, planner);
          for (const row of planner.at(minute)) {
            const target = targets.find(t => t.agent === row.agent);
            equal(target.cityPlace, row.place.cityPlace, 'placement reads planner at the same clock');
          }
          equal(planner.at(minute), createRoutinePlanner(frames.filter(f => f.minute <= minute)).at(minute), 'fresh truncated feed and backward seek agree');
          equal(planner.day(day, minute), createRoutinePlanner(frames.filter(f => f.minute <= minute)).day(day, minute), 'whole day prefix contains no future duration or cue');
        }
        const preShow = day * 1440 + 1264.999;
        equal(createRoutinePlanner(guarded(frames, preShow)).at(preShow), planner.at(preShow), 'no night payload before 21:05');
        guards++;
      }
      equal(JSON.stringify(frames), before, 'planner never mutates feed');
      console.log(`seed ${seed}: ${minutes} daytime minutes, ${agentMinutes} free agent-minutes, ${meetCount} paired meets, ${guards} guarded prefixes; gaps ${gaps} (0 unassigned loop seconds/agent-hour) PASS`);
    }
  } finally { Math.random = random; }
  console.log('ROUTINECHECK PASS');
}
try { await run(); }
catch (error) { console.error(`ROUTINECHECK FAIL${fault ? ` (${fault})` : ''}: ${error.message}`); process.exitCode = 1; }
