// Node reproduction of directorscenario's night seeks and 10x day openings.
// No renderer, model calls, or changes to the scene/meeting owners.
// node style/city/tools/directorpacingcheck.mjs --revision ab70601 --report /tmp/before.json
// node style/city/tools/directorpacingcheck.mjs --compare /tmp/before.json --report /tmp/after.json
// Add --verbose for every public meeting's publication/arrival/first-pick times.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFeed } from '../simstate/record/adapter.js';
import { revealAt } from '../simstate/record/player.js';
import { createShowPlanner, createShowPlayer } from '../simstate/record/show-plan.js';
import { createRoutinePlanner } from '../simstate/record/routines.js';
import * as nightAPI from '../simstate/record/cut-plan.js';
import * as dayAPI from '../simstate/record/day-director.js';

const DAY = 1440, TICK = 1 / 6, EPS = 1e-8;
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const reportFile = process.argv.includes('--report') ? arg('--report') : null;
const revision = process.argv.includes('--revision') ? arg('--revision') : null;
const compareFile = process.argv.includes('--compare') ? arg('--compare') : null;
const previousReport = compareFile ? JSON.parse(fs.readFileSync(compareFile, 'utf8')) : null;
let { createCutPlanner } = nightAPI, { createDayDirector, publicMoments } = dayAPI;
if (revision) {
  // Exercise the baseline modules without checking out or modifying any file.
  const directory = new URL('../simstate/record/', import.meta.url), loaded = {};
  for (const name of ['cut-plan.js', 'day-director.js']) {
    const result = spawnSync('git', ['show', `${revision}:style/city/simstate/record/${name}`],
      { cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const source = result.stdout.replace(/'((?:\.\.\/|\.\/)[^']+\.js)'/g, (_, dependency) =>
      JSON.stringify(loaded[dependency.replace('./', '')]?.url ?? new URL(dependency, directory).href));
    const url = 'data:text/javascript,' + encodeURIComponent(source);
    loaded[name] = { url, api: await import(url) };
  }
  ({ createCutPlanner } = loaded['cut-plan.js'].api);
  ({ createDayDirector, publicMoments } = loaded['day-director.js'].api);
}
const failures = [], reports = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const rate = cuts => Math.max(0, ...cuts.map(c => cuts.filter(o =>
  o.minute >= c.minute && o.minute < c.minute + 1 - 1e-9).length));

for (const seed of [404, 405, 406]) {
  const frames = parseFeed(fs.readFileSync(new URL(`../../../core/runs/${seed}-A/feed.jsonl`, import.meta.url), 'utf8'));
  const planner = createCutPlanner(frames), shows = createShowPlanner(frames);
  const planned = [], logged = [], scenes = [];
  let last = null;
  function observe(minute) {
    const cut = planner.at(minute);
    if (cut && cut.sceneId !== last) {
      logged.push({ minute, sceneId: cut.sceneId }); last = cut.sceneId;
    }
  }
  function play(from, duration) {
    // Night selection runs every render frame: 60 Hz at 10x.
    for (let frame = 0; frame <= Math.round(duration * 360); frame++) observe(from + frame / 360);
  }
  let covered = 0;
  for (const frame of frames.filter(f => f.step.kind === 'night')) {
    const plan = shows.night(frame.day), cuts = planner.night(frame.day);
    planned.push(...cuts.map(c => ({ minute: c.start, sceneId: c.sceneId })));
    for (const cut of cuts) {
      const scene = plan.scenes.find(s => s.id === cut.sceneId);
      check(cut.start <= scene.start && cut.end >= scene.start + Math.min(.25, scene.end - scene.start) - EPS,
        `${seed} ${scene.id}: selected scene still shown`);
    }
    for (const scene of plan.scenes.filter(s => ['fight', 'arrest'].includes(s.beat))) {
      if (!scenes.length) {
        // Page startup is already playing before ready() returns, then the
        // scenario seeks back to the SAME pre-roll. Include both in its log.
        play(scene.start - .25, .5);
      }
      scenes.push(scene.id);
      const cut = cuts.find(c => c.sceneId === scene.id);
      if (cut && cut.start <= scene.start && cut.end >= scene.end) covered++;
      play(scene.start - .25, 11 / 6);
    }
  }
  const night = { plannedCuts: planned.length, plannedMax: rate(planned), loggedCuts: logged.length,
    loggedMax: rate(logged), covered, required: scenes.length, sceneIds: planned.map(c => c.sceneId) };
  check(night.plannedMax <= 2, `${seed}: night planned rate ${night.plannedMax}`);
  check(night.loggedMax <= 2, `${seed}: night startup/seek logged rate ${night.loggedMax}`);
  check(covered === scenes.length, `${seed}: full fight/arrest intervals ${covered}/${scenes.length}`);
  if (previousReport) assert.deepEqual(night.sceneIds, previousReport.reports.find(r => r.seed === seed).night.sceneIds,
    `${seed}: no selected scene or caption lost`);

  // The oracle reads the finished routine plan only to measure arrival/close.
  // The director below gets a different planner, queried at presented time.
  const oracle = createRoutinePlanner(frames), publications = new Map();
  for (const frame of frames) for (const event of frame.events) {
    if (event.type === 'meet' && !publications.has(event.id)) publications.set(event.id, { event, published: revealAt(frame) });
  }
  const days = new Map(), meets = [];
  for (const { event, published } of publications.values()) {
    if (!days.has(event.day)) days.set(event.day, oracle.day(event.day, event.day * DAY + 1265));
    const plan = days.get(event.day), cue = plan.meetings.find(c => c.eventId === event.id);
    assert(cue, `seed ${seed}: meeting cue ${event.id}`);
    const close = Math.min(event.day * DAY + 1265, ...[event.a, event.b].map(id =>
      plan.entries.find(r => r.agent === id && r.minute > cue.minute && r.meet !== event.id)?.minute ?? Infinity));
    meets.push({ id: event.id, published, departure: cue.departure, arrival: cue.minute, close,
      cut: cue.cut, firstPick: null, windowFirstMeet: null, windowPickedId: null });
  }
  // Fresh prefix, full archive and poisoned suffix must agree while waiting,
  // while seated and after close. The meeting's public lifecycle must not
  // depend on tomorrow's disclosure or the routine planner's cached horizon.
  const probe = meets.find(m => !m.cut);
  const probePlayer = createShowPlayer(frames);
  for (const minute of [probe.published - .01, probe.published + .1, probe.arrival + .1, probe.close + .1]) {
    const snapshot = probePlayer.seek(minute);
    const initial = inputs => createDayDirector({ routines: createRoutinePlanner(inputs), delay: () => 15 }).tick(snapshot);
    const full = initial(frames);
    assert.deepEqual(full, initial(frames.filter(f => revealAt(f) <= minute)), `${seed}: public meeting prefix independence`);
    const guarded = frames.map(frame => {
      if (revealAt(frame) <= minute) return frame;
      const copy = { ...frame };
      for (const key of ['events', 'board', 'sightings']) Object.defineProperty(copy, key,
        { get() { throw new Error(`future ${key} payload read at ${minute}`); } });
      return copy;
    });
    assert.deepEqual(full, initial(guarded), `${seed}: no future meeting payloads`);
    const r = createRoutinePlanner(frames), rows = r.at(minute);
    const moments = publicMoments(snapshot, rows, [], r.day(snapshot.day, minute).meetings);
    check(moments.some(m => m.id === `meet:${probe.id}`) === (minute >= probe.published && minute < probe.close),
      `${seed} meet ${probe.id}: public lifecycle at ${minute}`);
  }
  const groups = Map.groupBy(meets, m => m.published);
  let windows = 0, timely = 0, held = 0, holds = 0;
  for (const [published, group] of groups) {
    const player = createShowPlayer(frames, { speed: 10 }), routines = createRoutinePlanner(frames);
    const director = createDayDirector({ routines, delay: () => 15 });
    const from = published - .2;
    let to = Math.max(...group.filter(m => !m.cut).map(m => m.close), published + 2);
    let first = null, expected = null;
    player.seek(from); player.play();
    for (let tick = 0; from + tick * TICK <= to + TICK + EPS; tick++) {
      const snapshot = tick ? player.advance(1) : player.snapshot();
      const minute = snapshot.minute, result = director.tick(snapshot);
      const id = result.cut?.momentId?.startsWith('meet:') ? Number(result.cut.momentId.slice(5)) : null;
      const measured = group.find(m => m.id === id);
      if (measured && measured.firstPick === null) measured.firstPick = minute;
      // shots accepts any public meet cut in the opening window. Concurrent
      // pairs keep their own firstPick below; a single camera cannot show all
      // of them at publication while also holding each selected meeting.
      if (id !== null && first === null) {
        first = { minute, id };
        const selected = meets.find(m => m.id === id);
        if (selected && !selected.cut) { expected = selected; holds++; to = Math.max(to, selected.close); }
      }
      if (expected && minute < expected.close - EPS) {
        check(id === expected.id, `${seed} meet ${expected.id}: cut left before public close at ${minute}`);
      } else if (expected) { held++; expected = null; }
      if (tick === 2) {
        const snapshot = player.snapshot(), rows = routines.at(minute);
        const cues = routines.day(snapshot.day, minute).meetings;
        const candidates = publicMoments(snapshot, rows, [], cues);
        for (const meet of group.filter(m => !m.cut)) check(candidates.some(c => c.id === `meet:${meet.id}`),
          `${seed} meet ${meet.id}: candidate from publication`);
      }
    }
    for (const meet of group) {
      meet.windowFirstMeet = first?.minute ?? null; meet.windowPickedId = first?.id ?? null;
    }
    windows++;
    if (first && first.minute <= published + 1.8 + EPS) timely++;
  }
  check(timely === windows, `${seed}: public opening windows ${timely}/${windows}`);
  check(held === holds && holds > 0, `${seed}: selected meetings held to close ${held}/${holds}`);
  // A routine can close at the show boundary, five minutes after the lock.
  for (const meet of meets.filter(m => !m.cut && m.close % DAY === 1265)) {
    const player = createShowPlayer(frames), routines = createRoutinePlanner(frames);
    const director = createDayDirector({ routines, delay: () => 15 });
    const beforeLock = Math.floor(meet.close / DAY) * DAY + 1259;
    const first = director.tick(player.seek(beforeLock));
    check(first.cut?.momentId === `meet:${meet.id}`, `${seed}: meeting present before lock`);
    for (const minute of [beforeLock + 1, meet.close - .1]) {
      check(director.tick(player.seek(minute)).cut?.momentId === `meet:${meet.id}`, `${seed}: selected meeting held after lock`);
    }
    check(director.tick(player.seek(meet.close)).cut === null, `${seed}: meeting hands over at show boundary`);
  }
  const day = { meetings: meets.length, picked: meets.filter(m => m.firstPick !== null).length,
    windows, timely, held, holds, meets };
  if (previousReport) for (const before of previousReport.reports.find(r => r.seed === seed).day.meets) {
    const after = meets.find(m => m.id === before.id);
    if (before.firstPick !== null) check(after && after.firstPick !== null,
      `${seed} meet ${before.id}: previously selected meeting retained`);
  }
  reports.push({ seed, night, day });
  console.log(`seed ${seed}: night planned max=${night.plannedMax} (${planned.length} cuts), startup/seek max=${night.loggedMax} (${logged.length} cuts), full scenes=${covered}/${scenes.length}`);
  console.log(`seed ${seed}: day timely public windows=${timely}/${windows}, selected held through close=${held}/${holds}, individual meetings picked=${day.picked}/${meets.length}`);
  if (process.argv.includes('--verbose')) for (const m of meets) console.log(`  meet ${m.id}: publication=${m.published} departure=${m.departure} arrival=${m.arrival.toFixed(6)} close=${m.close.toFixed(6)} firstPick=${m.firstPick?.toFixed(6) ?? 'unselected'} windowPick=${m.windowPickedId}@${m.windowFirstMeet?.toFixed(6) ?? 'none'}`);
}
if (reportFile) fs.writeFileSync(reportFile, JSON.stringify({ revision: revision ?? 'working tree', reports, failures }, null, 2) + '\n');
console.log(`${failures.length ? 'FAIL' : 'PASS'} directorpacingcheck: ${failures.length} failures`);
if (failures.length) { console.error([...new Set(failures)].slice(0, 12).join('\n')); process.exitCode = 1; }
