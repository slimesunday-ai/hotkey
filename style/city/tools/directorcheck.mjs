// C1-8 logic gate: Node only. Production-source and day-observation faults fail
// in child processes BEFORE the unmodified properties run. No file faults or port.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parseFeed } from '../simstate/record/adapter.js';
import { createShowPlanner, createShowPlayer } from '../simstate/record/show-plan.js';
import { createRoutinePlanner } from '../simstate/record/routines.js';
import { SITES } from '../simstate/record/places.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RECORD = new URL('../simstate/record/', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const dayFaults = { 'early-closeup': 'routine payoff needs thirty seconds after its establishing view',
  'changed-loop': 'routine payoff needs the same loop at its close-up minute',
  'missing-establishing': 'routine payoff needs an observed establishing view',
  'unstaged-window': 'day >=70% cuts with public or routine payoff' };
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => property(isDeepStrictEqual(a, b), label);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const totals = { nights: 0, fights: 0, arrests: 0, cuts: 0, hoodedScenes: 0, replaysNamed: 0,
  windows: 0, dayCuts: 0, routineSetups: 0, eventSetups: 0, payoffs: 0 };
function feed(seed) {
  const file = new URL(`../../../core/runs/${seed}-A/feed.jsonl`, import.meta.url);
  if (!fs.existsSync(file)) {
    const child = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed),
      '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    console.log(`generated seed ${seed}`);
  }
  return freeze(parseFeed(fs.readFileSync(file, 'utf8')));
}
async function underTest() {
  const source = Object.fromEntries(['cut-plan.js', 'day-director.js'].map(name =>
    [name, fs.readFileSync(new URL(name, RECORD), 'utf8')]));
  function replace(name, before, after) {
    assert(source[name].includes(before), `missing fault injection site: ${before}`);
    source[name] = source[name].replace(before, after);
  }
  if (fault === 'missing-fight') replace('cut-plan.js', 'plan.scenes.filter(required)', 'plan.scenes.filter(() => false)');
  else if (fault === 'cut-rate') replace('cut-plan.js', 'Math.abs(other.start - scene.start) < .5', 'Math.abs(other.start - scene.start) < 0');
  else if (fault === 'hooded-cut') replace('cut-plan.js', 'subjects: [...scene.publicActors]', 'subjects: board.agents.map(a => a.id)');
  else if (fault === 'hooded-caption') replace('cut-plan.js', 'captionSubjects(scene.publicActors, board)', 'captionSubjects(board.agents.map(a => a.id), board)');
  else if (fault === 'early-record') replace('cut-plan.js', 'disclosed.minute <= plan.end + 1440', 'disclosed.minute < plan.start');
  else if (fault === 'future-day') replace('day-director.js', 'routines.at(minute)', 'routines.at(minute + 1)');
  else if (fault === 'short-setup') replace('day-director.js', "best.kind === 'routine' ? minute + .5", "best.kind === 'routine' ? minute + .1");
  else if (fault && !Object.hasOwn(dayFaults, fault)) throw new Error(`unknown fault: ${fault}`);
  const loaded = {};
  for (const name of ['cut-plan.js', 'day-director.js']) {
    const code = source[name].replace(/'((?:\.\.\/|\.\/)[^']+\.js)'/g, (_, dep) =>
      JSON.stringify(loaded[dep.replace('./', '')]?.url ?? new URL(dep, RECORD).href));
    const url = 'data:text/javascript,' + encodeURIComponent(code);
    loaded[name] = { url, module: await import(url) };
  }
  return { ...loaded['cut-plan.js'].module, ...loaded['day-director.js'].module };
}
function cutRate(cuts) {
  for (const cut of cuts) property(cuts.filter(other => other.start >= cut.start
    && other.start < cut.start + 1 - 1e-8).length <= 2, 'at most two cuts in every rolling minute');
}
const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object'
  ? Object.values(value).flatMap(strings) : [];
function nightProperties(api, frames, seed) {
  const planner = createShowPlanner(frames), player = createShowPlayer(frames), camera = api.createCutPlanner(frames);
  let board = null;
  for (const frame of frames) {
    if (frame.step.kind === 'night') {
      const plan = planner.night(frame.day), cuts = api.planCuts(plan, board);
      equal(cuts, api.planCuts(plan, board), 'deterministic night cuts');
      equal(camera.night(frame.day), cuts, 'camera planner uses same cut shape');
      equal(camera.at(plan.start), cuts[0], 'camera reads opening cut');
      equal(camera.at(plan.end), null, 'camera returns after show');
      equal(camera.at(plan.start - .01), null, 'no camera cut before show');
      equal(cuts, api.planCuts(createShowPlanner(frames.filter(f => f.i <= frame.i)).night(frame.day), board),
        'night cut ignores later frames');
      const show = frame.events.find(e => e.type === 'show');
      const hidden = board.agents.filter(a => !Object.hasOwn(show.seen, a.id));
      cutRate(cuts);
      property(cuts.length > 0 && cuts[0].start === plan.start && cuts.at(-1).end === plan.end, 'cut covers the whole show');
      for (const [i, cut] of cuts.entries()) {
        const scene = plan.scenes.find(s => s.id === cut.sceneId);
        property(scene && cut.start <= scene.start && cut.end > cut.start, 'cut references a scene at its setup');
        property(i === cuts.length - 1 || cut.end === cuts[i + 1].start, 'continuous nonoverlapping cut');
        property(cut.subjects.every(id => scene.publicActors.includes(id)), 'cut names only public actors');
        equal(cut.captionFields, api.sceneCaption(scene, board), 'caption equals typed scene fields');
        equal(Object.keys(cut.captionFields).sort(), ['kind', 'beat', 'place', 'subjects', 'anonymousCount'].sort(),
          'live caption has only typed public fields');
        property(hidden.every(a => !strings(cut).includes(a.id) && (!a.name || !strings(cut).includes(a.name))),
          'no hooded name anywhere in live cut or caption');
        equal(cut.captionFields.subjects.map(a => a.id), [...cut.subjects].sort(), 'caption subjects match cut');
        for (const subject of cut.captionFields.subjects) {
          const agent = board.agents.find(a => a.id === subject.id);
          equal(subject, { id: agent.id, name: agent.name, driver: agent.driver }, 'board owns name/driver');
        }
        equal(api.cutAt(cuts, cut.start), cut, 'cut at start');
        totals.hoodedScenes += Number(scene.hoodedCount > 0);
      }
      for (const scene of plan.scenes.filter(s => ['fight', 'arrest'].includes(s.beat))) {
        const cut = cuts.find(c => c.sceneId === scene.id);
        property(cut && cut.start <= scene.start && cut.end >= scene.end, 'every fight/arrest scene fully covered');
        totals[scene.beat === 'fight' ? 'fights' : 'arrests']++;
        for (const minute of [plan.start, plan.end, plan.end + 1440]) {
          const snapshot = player.seek(minute);
          equal(api.replayCut(cut, scene, plan, snapshot), cut, 'no named record overlay within 24 hours');
        }
        const disclosed = player.seek(Math.min(player.bounds.to, plan.end + 1440 + .01));
        const replay = api.replayCut(cut, scene, plan, disclosed);
        if (replay !== cut) {
          const receipt = disclosed.events.find(e => e.id === replay.captionFields.recordEventId);
          property(receipt && receipt.minute <= disclosed.minute && disclosed.minute > plan.end + 1440,
            'D6 names require old night and disclosed receipt');
          property(replay.subjects.every(id => cut.subjects.includes(id) || receipt.members.includes(id)), 'D6 uses typed receipt members');
          totals.replaysNamed++;
        }
      }
      totals.nights++; totals.cuts += cuts.length;
    }
    if (frame.board !== undefined) board = frame.board;
  }
  console.log(`seed ${seed}: 14 night plans verified`);
}
function poisonFuture(frames, horizon) {
  return frames.map(frame => {
    if (frame.minute <= horizon && frame.step.kind !== 'night') return frame;
    if (frame.step.kind === 'night' && frame.minute + 5 <= horizon) return frame;
    const copy = { ...frame };
    for (const field of ['events', 'board', 'sightings']) Object.defineProperty(copy, field,
      { get() { throw new Error(`PROPERTY future payload read ${field}`); } });
    return copy;
  });
}
// Credit a realized payoff only after observing its establishing cut. A mark
// alone is insufficient; C1-4 must still report that loop at the close-up time.
function dayObservation(routines) {
  const cuts = [], publicPayoffs = new Set(), routinePayoffs = new Set(), payoffs = new Set();
  const views = new Map(), checked = new Set();
  function observe({ action, minute, cut }) {
    if (!cut) return;
    if (action === 'cut') { cuts.push(cut); views.set(cut.sceneId, { minute, cut }); }
    const view = views.get(cut.sceneId);
    if (!view || view.minute !== cut.start || !isDeepStrictEqual(view.cut, cut)) return;
    if (cut.routineCloseup !== null && cut.routineCloseup <= minute && !checked.has(cut.sceneId)) {
      checked.add(cut.sceneId);
      const row = routines.at(cut.routineCloseup).find(r => r.agent === cut.setup.source.agent);
      if (cut.routineCloseup - view.minute >= .5 - 1e-8 && row
        && row.minute === cut.setup.source.minute && row.act === cut.setup.source.act
        && row.place.cityPlace === cut.place.cityPlace) {
        routinePayoffs.add(cut.sceneId); payoffs.add(cut.sceneId);
      }
    }
    if (cut.payoff && minute >= cut.payoff.minute && cut.payoff.minute - view.minute >= .5 - 1e-8) {
      publicPayoffs.add(cut.sceneId); payoffs.add(cut.sceneId);
    }
  }
  return { observe, cuts, publicPayoffs, routinePayoffs, payoffs };
}
function dayBar(payoffCount, cutCount) {
  property(payoffCount / cutCount >= .7,
    `day >=70% cuts with public or routine payoff: ${payoffCount}/${cutCount}`);
}
function stagingProbes(api, frames) {
  const snapshot = { ...createShowPlayer(frames).seek(frames[0].minute), events: [] };
  const minute = snapshot.minute, agent = snapshot.board.agents[0].id;
  const row = { agent, minute, act: 'hang', role: 'hang', place: SITES.diner };
  function sample({ early = false, changed = false, establishing = true, unstaged = false, seconds = 31 } = {}) {
    let now = minute;
    const routines = { at(at) {
      property(at <= now, 'staging observer never queries a future minute');
      return [changed && at >= minute + .5 ? { ...row, minute: minute + .5, act: 'patrol' } : row];
    } };
    const director = api.createDayDirector({ routines, delay: () => 15 }), observation = dayObservation(routines);
    for (let second = 0; second < seconds; second++) {
      now = minute + second / 60;
      const result = director.tick({ ...snapshot, minute: now });
      // Faults corrupt observed cuts/current rows in memory, never feed files.
      const cut = result.cut && { ...result.cut, routineCloseup: unstaged ? null
        : early ? result.cut.start + .49 : result.cut.routineCloseup };
      if (establishing || result.action !== 'cut') observation.observe({ ...result, cut });
    }
    return observation;
  }
  property(sample({ early: fault === 'early-closeup' }).routinePayoffs.size === 1, dayFaults['early-closeup']);
  property(sample({ changed: fault === 'changed-loop' }).routinePayoffs.size === 1, dayFaults['changed-loop']);
  property(sample({ establishing: fault !== 'missing-establishing' }).routinePayoffs.size === 1, dayFaults['missing-establishing']);
  for (const options of [{ early: true }, { changed: true }, { establishing: false }]) {
    property(sample(options).payoffs.size === 0, 'invalid routine close-up earns no credit');
  }
  const window = sample({ unstaged: fault === 'unstaged-window', seconds: 600 });
  dayBar(window.payoffs.size, window.cuts.length);
}
// Uniform seeded starts in the public day, two windows per season = ten. The
// observer validates a routine close-up against C1-4 again at its actual time;
// merely scheduling one, or seeing an unrelated later event, earns no credit.
function dayProperties(api, frames, seed) {
  let random = seed;
  const draw = () => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let window = 0; window < 2; window++) {
    const day = 1 + Math.floor(draw() * 13), from = day * 1440 + 360 + Math.floor(draw() * 890);
    const player = createShowPlayer(frames), routines = createRoutinePlanner(frames);
    const director = api.createDayDirector({ routines, delay: () => 15 });
    const observation = dayObservation(routines);
    const { cuts, publicPayoffs: qualified, routinePayoffs: staged, payoffs } = observation;
    for (let second = 0; second < 600; second++) {
      const minute = from + second / 60, snapshot = player.seek(minute);
      const result = director.tick(snapshot);
      equal(result, director.tick(snapshot), 'same-second tick is idempotent');
      property(result.broadcastDelay === 15, 'scorer reads configured broadcast delay');
      if (result.action === 'cut') {
        property(result.cut.start === minute && result.cut.setup.publicSince <= minute, 'cut starts from an already public setup');
        if (result.cut.routineCloseup !== null) property(result.cut.routineCloseup - minute >= .5 - 1e-8,
          'routine setup lasts at least thirty seconds');
      }
      // Event payoffs are only counted when their announced public trip remains
      // selected through its actual arrival, never on the basis of future data.
      observation.observe(result);
    }
    cutRate(cuts);
    property(cuts.length > 0, 'day window has actual cuts');
    const ratio = payoffs.size / cuts.length;
    // Fresh prefix, full archive, and a future-payload trap must give identical
    // initial choices. The director receives no future frame or queued event.
    const snapshot = player.seek(from);
    const initial = inputs => api.createDayDirector({ routines: createRoutinePlanner(inputs), delay: () => 15 }).tick(snapshot);
    const prefix = frames.filter(f => f.minute <= from);
    equal(initial(frames), initial(prefix), 'day archive suffix independence');
    equal(initial(frames), initial(poisonFuture(frames, from)), 'no future payload reads');
    totals.windows++; totals.dayCuts += cuts.length;
    totals.routineSetups += staged.size;
    totals.eventSetups += qualified.size;
    totals.payoffs += payoffs.size;
    console.log(`day seed ${seed} window ${window + 1} @ ${from}: public ${qualified.size}/${cuts.length}; routine ${staged.size}/${cuts.length}; total ${payoffs.size}/${cuts.length} = ${(100 * ratio).toFixed(1)}% >=30s`);
  }
}
function probes(api, frames) {
  const player = createShowPlayer(frames), minute = frames[0].minute;
  const snapshot = player.seek(minute), ids = snapshot.board.agents.slice(0, 2).map(a => a.id);
  const rows = [{ agent: ids[0], minute, act: 'hang', role: 'hang', place: SITES.diner }];
  const routines = { at(at) { property(at <= minute, 'day scorer must query routines at current minute'); return rows; } };
  const director = api.createDayDirector({ routines, delay: () => 0 });
  const result = director.tick(snapshot);
  property(result.action === 'cut' && result.cut.routineCloseup - minute >= .5 - 1e-8, 'D=0 still stages thirty seconds of setup');
  assert.throws(() => director.tick(player.seek(minute - 1)), /reset/);
  director.reset(); equal(director.tick(snapshot), result, 'epoch reset deterministic');
  // Public announced arrivals have an independently supplied payoff, not a time
  // guessed from a route. A future announcement is completely ignored.
  const trip = { id: 'public-trip', announcedMinute: minute, setupMinute: minute,
    minute: minute + 1, subjects: [ids[0]], place: SITES.docks };
  const arrivals = api.publicMoments(snapshot, [], [trip]);
  property(arrivals.length === 1 && arrivals[0].payoff.minute === trip.minute, 'public arrival keeps typed payoff');
  equal(api.publicMoments(snapshot, [], [{ ...trip, announcedMinute: minute + 1 }]), [], 'future arrival announcement ignored');
  const scores = api.scoreMoments(arrivals, minute, { preferred: [ids[0]] });
  equal(scores[0].score, 14, 'owner/star doubles public score');
  equal(api.scoreMoments(arrivals, minute, { recent: [{ start: minute, place: trip.place, subjects: trip.subjects }] })[0].score,
    3.5, 'repeated public subject/place halves score');
  const arrivalDirector = api.createDayDirector({ routines: { at: () => [] }, delay: () => 15 });
  const arrivalCut = arrivalDirector.tick(snapshot, { arrivals: [trip] });
  property(arrivalCut.action === 'cut' && arrivalCut.cut.payoff.minute - arrivalCut.cut.start >= .5, 'arrival starts thirty seconds before known payoff');
  const held = arrivalDirector.tick({ ...snapshot, minute: trip.minute }, { arrivals: [trip] });
  property(held.action === 'hold' && held.cut.sceneId === arrivalCut.cut.sceneId, 'arrival remains framed at payoff');
  const observedArrival = dayObservation({ at: () => [] });
  observedArrival.observe(arrivalCut); observedArrival.observe(held);
  property(observedArrival.publicPayoffs.size === 1 && observedArrival.payoffs.size === 1, 'public payoff earns day credit');
  // Exercise types absent in free bot seasons, without introducing event prose.
  const meetRows = ids.map(agent => ({ agent, minute, act: 'meet', meet: 999, place: SITES.diner }));
  const eventSnapshot = { ...snapshot, events: [...snapshot.events,
    { type: 'meet', id: 999, day: 1, minute, a: ids[0], b: ids[1] },
    { type: 'outloud', id: 1000, day: 1, minute, agent: ids[0] },
    { type: 'release', id: 1001, day: 1, minute, agent: ids[1] }] };
  const kinds = api.publicMoments(eventSnapshot, meetRows).map(m => m.kind);
  for (const kind of ['meet', 'outloud', 'release', 'routine']) property(kinds.includes(kind), `day supports ${kind}`);
  Object.defineProperty(eventSnapshot.events.at(-2), 'line', { get() { throw new Error('caption read event words'); } });
  api.publicMoments(eventSnapshot, meetRows);
  // A direct disclosed receipt permits names only strictly after the full day.
  const scene = { id: 's', kind: 'hit', beat: 'fight', night: 1, eventId: 1,
    place: SITES.docks, publicActors: [ids[1]], hoodedCount: 1 };
  const cut = { subjects: [ids[1]], captionFields: api.sceneCaption(scene, snapshot.board) };
  const plan = { start: minute, end: minute + 15 };
  const events = [{ id: 1, type: 'fight', minute, night: 1, target: ids[1], place: 'docks' },
    { id: 2, type: 'rob', minute, night: 1, target: ids[1], place: 'docks', members: [ids[0]] }];
  const disclosed = at => ({ ...snapshot, frame: null, minute: at, events });
  equal(api.replayCut(cut, scene, plan, disclosed(plan.end + 1440)), cut, 'D6 strict 24-hour boundary');
  property(api.replayCut(cut, scene, plan, disclosed(plan.end + 1440 + .01)).subjects.includes(ids[0]), 'D6 positive typed named replay');
  const ambiguous = { ...disclosed(plan.end + 1440 + 1), events: [...events, { ...events[1], id: 3 }] };
  equal(api.replayCut(cut, scene, plan, ambiguous), cut, 'ambiguous record stays anonymous');
  const empty = { ...disclosed(plan.end + 1440 + 1), events: events.slice(0, 1) };
  equal(api.replayCut(cut, scene, plan, empty), cut, 'missing disclosure stays anonymous');
}

try {
  if (!fault) {
    const plants = { 'missing-fight': 'every fight/arrest scene', 'cut-rate': 'two cuts',
      'hooded-cut': 'cut names only public', 'hooded-caption': 'caption subjects match cut',
      'early-record': '24', 'future-day': 'current minute', 'short-setup': 'thirty seconds', ...dayFaults };
    for (const [name, expected] of Object.entries(plants)) {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 3e6 });
      property(child.status === 1 && (child.stdout + child.stderr).includes(expected), `planted ${name} fails intended property: ${child.stderr.slice(-600)}`);
      if (Object.hasOwn(dayFaults, name)) property(child.stderr.trim().startsWith(`PROPERTY ${expected}`),
        `planted ${name} fails first for intended property`);
      console.log(`planted ${name}: exit 1 (${expected})`);
    }
  }
  const api = await underTest();
  probes(api, feed(404));
  stagingProbes(api, feed(404));
  for (const seed of [404, 405, 406, 407, 408]) {
    const frames = feed(seed);
    nightProperties(api, frames, seed); dayProperties(api, frames, seed);
  }
  console.log(`director measurements ${JSON.stringify(totals)}`);
  dayBar(totals.payoffs, totals.dayCuts);
  console.log('PASS directorcheck');
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
