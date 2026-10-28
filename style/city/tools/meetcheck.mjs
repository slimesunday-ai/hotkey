// C1-4: measure visible intervals, rather than the presence of overwritten rows.
// Re-pinned for slime's 10-27 call ("go with a"): the minimum went from 1 to 5 island minutes.
// Node only. Controls mutate an in-memory module, never an existing check/file.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFeed } from '../simstate/record/adapter.js';
import { revealAt } from '../simstate/record/player.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MODULE = new URL('../simstate/record/routines.js', import.meta.url);
const MINIMUM = 5, DAY = 1440;
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const property = (ok, label) => assert.ok(ok, `PROPERTY ${label}`);
async function moduleUnderTest() {
  let source = fs.readFileSync(MODULE, 'utf8');
  if (fault === 'same-minute') {
    property(source.includes('export const MEET_MINUTES = 5;'), 'minimum injection site');
    source = source.replace('export const MEET_MINUTES = 5;', 'export const MEET_MINUTES = 0;');
  } else if (fault === 'lookahead') {
    const site = 'function at(minute) {';
    property(source.includes(site), 'lookahead injection site');
    source = source.replace(site, `${site}
      const future = frames.find(f => revealAt(f) > minute);
      if (future) void future.events.length;`);
  } else property(!fault, `known fault ${fault}`);
  for (const name of ['places.js', 'addresses.js', 'adapter.js', 'player.js', 'routine-places.js']) {
    source = source.replace(`'./${name}'`, JSON.stringify(new URL(name, MODULE).href));
  }
  return import('data:text/javascript,' + encodeURIComponent(source));
}
function feed(seed) {
  const file = new URL(`../../../core/runs/${seed}-A/feed.jsonl`, import.meta.url);
  if (!fs.existsSync(file)) {
    const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed),
      '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  }
  return parseFeed(fs.readFileSync(file, 'utf8'));
}
function guarded(frames, minute) {
  return frames.map(frame => {
    if (revealAt(frame) <= minute) return frame;
    const copy = { ...frame };
    for (const key of ['board', 'events', 'sightings']) Object.defineProperty(copy, key,
      { get() { throw new Error(`PROPERTY future ${key} read at ${minute}`); } });
    return copy;
  });
}
function measure(createRoutinePlanner, frames, label) {
  const planner = createRoutinePlanner(frames), events = new Map(), points = new Set();
  for (const frame of frames) {
    points.add(revealAt(frame)); points.add(Math.max(0, revealAt(frame) - .25));
    for (const event of frame.events) if (event.type === 'meet' && !events.has(event.id)) {
      events.set(event.id, { event, published: revealAt(frame) });
    }
  }
  const plans = new Map([...events.values()].map(({ event }) =>
    [event.day, planner.day(event.day, event.day * DAY + 1265)]));
  for (const plan of plans.values()) for (const row of plan.entries) {
    points.add(row.minute); points.add(Math.max(0, row.minute - .0001));
  }
  let missed = 0, cuts = 0, orderErrors = 0, metadataErrors = 0;
  const failures = [], previous = new Map();
  for (const { event, published } of events.values()) {
    const plan = plans.get(event.day), cue = plan.meetings.find(m => m.eventId === event.id);
    property(cue && cue.a === event.a && cue.b === event.b, `${label} meet ${event.id} paired cue`);
    property(cue.minute >= published, `${label} meet ${event.id} never precedes publication`);
    if (cue.published !== published || cue.minimum !== MINIMUM) metadataErrors++;
    // An arrival cut alone cannot excuse an overwritten/zero-length meeting.
    if (cue.reason === 'day-end') {
      property(cue.cut && cue.minute + MINIMUM > event.day * DAY + 1265,
        `${label} meet ${event.id} justified day-end cut`);
      cuts++; continue;
    }
    let duration = Infinity;
    for (const id of [event.a, event.b]) {
      const list = plan.entries.filter(r => r.agent === id);
      const row = planner.at(cue.minute).find(r => r.agent === id);
      if (row?.meet !== event.id) duration = 0;
      const next = list.find(r => r.minute > cue.minute && r.meet !== event.id);
      duration = Math.min(duration, (next?.minute ?? event.day * DAY + 1265) - cue.minute);
      const last = previous.get(`${event.day}/${id}`);
      if (last && cue.minute < last.minute + MINIMUM) orderErrors++;
      previous.set(`${event.day}/${id}`, cue);
    }
    if (duration < MINIMUM) { missed++; failures.push(`${event.id}@${cue.minute}=${duration}`); }
    else {
      for (const minute of [cue.minute, cue.minute + MINIMUM / 2, cue.minute + MINIMUM - .0001]) {
        const pair = [event.a, event.b].map(id => planner.at(minute).find(r => r.agent === id));
        property(pair.every(r => r?.meet === event.id && r.role === 'meet'), `${label} meet ${event.id} minimum interval`);
        property(pair.every(r => r.place.cityPlace === cue.place.cityPlace)
          || (cue.cut && pair.every(r => r.cut && r.scenePlace.cityPlace === cue.place.cityPlace)),
        `${label} meet ${event.id} together or paired scene cut`);
      }
    }
    for (const minute of [cue.minute, cue.minute + .5, cue.minute + MINIMUM]) points.add(minute);
  }
  console.log(`${label}: ${events.size} meets, ${missed} below ${MINIMUM}-minute minimum, ${cuts} day-end cuts${failures.length ? ` (${failures.slice(0, 6).join(', ')})` : ''}`);
  property(missed === 0, `${label}: ${missed}/${events.size} meets lack their minimum`);
  property(metadataErrors === 0, `${label}: ${metadataErrors} missing publication/minimum declarations`);
  property(orderErrors === 0, `${label}: ${orderErrors} meetings violate per-agent feed order`);
  // Compare full-archive reverse seeks with fresh cut feeds, and trap any read
  // of later payloads. Include fractional staging boundaries, not only frames.
  for (const minute of [...points].sort((a, b) => b - a)) {
    const cut = frames.filter(f => revealAt(f) <= minute);
    const fresh = createRoutinePlanner(cut), guard = createRoutinePlanner(guarded(frames, minute));
    const expected = fresh.at(minute);
    assert.deepEqual(planner.at(minute), expected, `PROPERTY ${label} prefix at ${minute}`);
    assert.deepEqual(guard.at(minute), expected, `PROPERTY ${label} guarded prefix at ${minute}`);
    const day = Math.floor(minute / DAY);
    assert.deepEqual(planner.day(day, minute), fresh.day(day, minute), `PROPERTY ${label} day prefix at ${minute}`);
  }
  console.log(`${label}: ${points.size} guarded/reverse/fresh prefixes PASS`);
}
function synthetic(createRoutinePlanner) {
  const agents = ['a', 'b', 'c', 'd'].map(id =>
    ({ id, trade: 'chemist', fit: [], walk: null, crew: null, jailed: id === 'c' }));
  const frame = (i, minute, events, board) => ({ i, t: 2, day: 1, minute,
    step: { kind: i ? 'errand' : 'setup' }, events, sightings: {}, ...(board ? { board } : {}) });
  const event = (id, type, fields) => ({ id, day: 1, minute: 1810, type, ...fields });
  const frames = [frame(0, 1800, [{ id: 0, day: 1, minute: 1800, type: 'season', seed: 404 }], { agents, corners: [] }),
    // A public act first in the feed must still wait behind this minute's meets.
    frame(1, 1810, [event(1, 'outloud', { agent: 'a', line: 'Public now' }),
      event(2, 'meet', { a: 'a', b: 'b', sitdown: 'one' })]),
    frame(2, 1810, [event(3, 'meet', { a: 'a', b: 'c', sitdown: 'two' }),
      event(4, 'meet', { a: 'd', b: 'b', sitdown: 'three' }),
      event(5, 'meet', { a: 'a', b: 'd', sitdown: 'four' })]),
    frame(3, 1810.5, [{ id: 6, day: 1, minute: 1810.5, type: 'high', agent: 'b' }])];
  measure(createRoutinePlanner, frames, 'synthetic queue/jailed pair');
  const p = createRoutinePlanner(frames), plan = p.day(1);
  assert.deepEqual(plan.meetings.map(m => [m.eventId, m.minute]), [[2, 1810], [3, 1815], [4, 1815], [5, 1820]]);
  property(p.at(1814.75).filter(r => r.meet === 2).length === 2, 'later public act waits for minimum');
  property(p.at(1825).find(r => r.agent === 'a').lineEvent === 1, 'public row shifts after queued meets');
  property(plan.bubbles.length === 1 && plan.bubbles[0].minute === 1810, 'speech keeps publication time');
  property(p.at(1815).find(r => r.agent === 'c').place.cityPlace === 'jail', 'unavailable street walker stays jailed');
  property(p.at(1815).find(r => r.agent === 'b').meet === 4, 'shared partner waits and arrives with its pair');
  const early = createRoutinePlanner(frames.slice(0, 2));
  assert.deepEqual(p.at(1810), early.at(1810), 'later frames cannot move an earlier row');
  const boundary = frames[1].events.slice(1).map(e => ({ ...e, minute: 2700 }));
  boundary.push({ ...boundary[0], id: 3, b: 'd' });
  measure(createRoutinePlanner, [frames[0], frame(1, 2700, boundary)], 'synthetic day-end cut');
  console.log('synthetic: feed order, shared partners, shifted public rows, jailed cut, fractional arrival PASS');
}
try {
  const { createRoutinePlanner } = await moduleUnderTest();
  for (const seed of fault ? [404] : [404, 405, 406]) measure(createRoutinePlanner, feed(seed), `seed ${seed}`);
  if (!fault) synthetic(createRoutinePlanner);
  if (!fault) for (const name of ['same-minute', 'lookahead']) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 1, `${name} must fail`);
    assert.match(r.stderr, /PROPERTY/, `${name} must fail a property`);
    console.log(`CONTROL ${name}: rejected (${r.stderr.trim().split('\n')[0]})`);
  }
  console.log('MEETCHECK PASS');
} catch (error) { console.error(`MEETCHECK FAIL${fault ? ` (${fault})` : ''}: ${error.message}`); process.exitCode = 1; }
