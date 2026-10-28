import { createRecordPlayer, showMinute, SHOW_MINUTES } from './player.js';
import { targetsAt, fightsAt } from './placement.js';
import { DISTRICTS, SITES, placeIn } from './places.js';
import { stageNight, planMint } from './staging.js';

const owns = (object, key) => Object.hasOwn(object, key);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const anchor = row => ({ corePlace: row.corePlace, cityPlace: row.cityPlace,
  district: row.district, standPlace: row.standPlace ?? null, lot: row.lot ?? null });

// Only the night's public frame and the preceding board are inputs. Delayed play
// receipts, card subjects, event prose and the night's resulting board are never
// used to identify an attacker, reconstruct a group, or predict a game result.
export function planShow(frame, board) {
  if (frame.step.kind !== 'night') throw new TypeError('show needs a night frame');
  const show = frame.events.find(e => e.type === 'show' && e.night === frame.day);
  if (!show?.plays) throw new Error(`night ${frame.day} needs C1-5 public show.plays`);
  const start = Math.max(frame.minute, showMinute(frame.day));
  const snapshot = { board, events: [show, ...frame.events.filter(e =>
    ['fight', 'arrest'].includes(e.type) && e.night === frame.day)], minute: start,
  day: frame.day, frame: null, reveal: { night: frame.day } };
  const targets = new Map(targetsAt(snapshot).map(row => [row.agent, row]));
  const fights = new Map(fightsAt(snapshot, frame.day).map(row => [row.eventId, row]));
  const visible = id => typeof id === 'string' && owns(show.seen, id);
  const scenes = [];
  function add(eventId, key, kind, beat, place, actors = [], hoodedCount = 0, revealIds = []) {
    const scene = { id: `${show.id}:${key}`, night: frame.day, eventId, kind, beat,
      place: anchor(place), start, end: start, publicActors: [...new Set(actors.filter(visible))].sort(),
      hoodedCount, revealIds: [...revealIds] };
    scenes.push(scene); return scene;
  }
  for (const id of Object.keys(show.plays).sort()) {
    if (!visible(id)) throw new Error('public play is absent from seen');
    const play = show.plays[id], target = targets.get(id);
    if (!target?.cityPlace) throw new Error(`no public city target for ${id}`);
    const hustle = frame.events.find(e => e.type === 'hustle' && e.night === frame.day && e.agent === id);
    const scene = add(hustle?.id ?? show.id, `play:${id}`, play.kind, 'ambient', target, [id], 0,
      hustle ? [hustle.id] : []);
    // Eight variants come verbatim from the public hustle receipt, never a second
    // district-to-hustle rule table. Unknown/missing variants stay absent.
    if (play.kind === 'hustle' && hustle) scene.variant = hustle.how;
  }
  for (const event of frame.events) {
    if (event.night !== frame.day) continue;
    if (event.type === 'fight') {
      const fight = fights.get(event.id);
      add(event.id, `fight:${event.id}`, event.kind, 'fight', fight,
        [...fight.defence.ids, ...fight.sides.flatMap(side => side.ids)],
        fight.sides.reduce((count, side) => count + side.hooded, 0), [event.id]);
    } else if (event.type === 'arrest') {
      const collar = event.why === 'collar' && [...fights.values()].find(f => f.kind === 'collar' && f.target === event.agent);
      add(event.id, `arrest:${event.id}`, 'arrest', 'arrest',
        event.why === 'dock' ? SITES.ferry : collar || placeIn(DISTRICTS, event.place),
        [event.agent, event.by], visible(event.agent) ? 0 : 1, [event.id]);
    }
  }
  // Public fight sides already account for these anonymous attackers. Stage the
  // remaining district count without assigning anyone an identity, kind or target.
  const unaccounted = new Map(Object.entries(show.hooded));
  for (const scene of scenes.filter(s => s.beat === 'fight' && s.hoodedCount)) {
    const district = scene.place.district;
    unaccounted.set(district, (unaccounted.get(district) ?? 0) - scene.hoodedCount);
  }
  for (const [district, count] of [...unaccounted].sort(([a], [b]) => a.localeCompare(b))) {
    if (count < 0) throw new Error(`fight hooded count exceeds show.hooded in ${district}`);
    if (count) add(show.id, `hooded:${district}`, 'hooded', 'ambient', placeIn(DISTRICTS, district), [], count);
  }
  const focus = scenes.filter(s => s.beat === 'fight' || s.beat === 'arrest');
  const noteworthy = frame.day === 14 || focus.length || Object.values(show.hooded).some(Boolean)
    || Object.values(show.plays).some(p => ['grab', 'vault', 'collar', 'board'].includes(p.kind));
  const duration = noteworthy ? SHOW_MINUTES : 3, end = start + duration;
  const ambient = scenes.filter(s => s.beat === 'ambient');
  ambient.forEach((scene, i) => {
    scene.start = start + .125 + i / Math.max(1, ambient.length) * (duration - 1.75);
    scene.end = scene.start + 1.25;
  });
  focus.forEach((scene, i) => {
    const slot = (duration - 1) / focus.length;
    scene.start = start + .5 + i * slot; scene.end = scene.start + slot * .8;
  });
  const closing = add(show.id, 'results', 'results', 'results', SITES.precinct);
  closing.start = end - .25; closing.end = end;
  stageNight({ frame, show, scenes, add, visible, start, end, board });
  // Disclosure of previous days remains intact. The show envelope contains safe
  // staging inputs, not outcomes. Unmatched current results wait for the close.
  const openingIds = frame.events.filter(e => e.id === show.id || e.t < frame.t).map(e => e.id);
  const assigned = new Set([...openingIds, ...scenes.flatMap(s => s.revealIds)]);
  for (const event of frame.events) {
    if (assigned.has(event.id)) continue;
    const deal = event.type === 'turf' && scenes.filter(s => s.kind === 'deal'
      && show.plays[s.publicActors[0]]?.corner === event.corner)
      .reduce((last, scene) => !last || scene.end > last.end ? scene : last, null);
    (deal || closing).revealIds.push(event.id);
  }
  scenes.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return freeze({ night: frame.day, frame: frame.i, eventId: show.id, start, end, openingIds, scenes });
}

// Stateless selection: playback, reverse seeks and fresh players use identical
// absolute scene intervals. At an end boundary the result is due and the scene
// is no longer active. Drawing uses progress, not elapsed wall time or an RNG.
export function showState(plan, minute) {
  if (!plan || minute < plan.start || minute >= plan.end) return null;
  return { night: plan.night, start: plan.start, end: plan.end,
    active: plan.scenes.filter(s => s.start <= minute && minute < s.end)
      .map(scene => ({ ...scene, progress: (minute - scene.start) / (scene.end - scene.start) })),
    completed: plan.scenes.filter(s => s.end <= minute).map(s => s.id) };
}

export function createShowPlanner(frames) {
  const cache = new Map();
  let mint = null;
  function day(n) {
    if (n !== 15) throw new RangeError('only day 15 has a mint plan');
    const frame = frames.find(f => f.day === 15 && f.step.kind === 'dawn');
    if (!frame) throw new RangeError('no day-15 dawn frame');
    return mint ??= freeze(planMint(frame));
  }
  function night(n) {
    if (cache.has(n)) return cache.get(n);
    let board = null;
    for (const frame of frames) {
      if (frame.step.kind === 'night' && frame.day === n) {
        const plan = planShow(frame, board); cache.set(n, plan); return plan;
      }
      if (frame.board !== undefined) board = frame.board;
    }
    throw new RangeError(`no show for night ${n}`);
  }
  const planner = { night, day, at(minute) {
    const n = Math.floor(minute / 1440);
    if (minute < showMinute(n) || minute >= showMinute(n) + SHOW_MINUTES
      || !frames.some(f => f.step.kind === 'night' && f.day === n && f.minute <= minute)) return null;
    return showState(night(n), minute);
  }, stagingAt(minute) {
    const frame = frames.find(f => f.day === 15 && f.step.kind === 'dawn' && f.minute <= minute);
    if (!frame) return planner.at(minute);
    const plan = day(15);
    if (minute >= plan.end) return null;
    return { day: 15, start: plan.start, end: plan.end,
      active: plan.scenes.filter(s => s.start <= minute && minute < s.end)
        .map(scene => ({ ...scene, progress: (minute - scene.start) / (scene.end - scene.start) })),
      completed: plan.scenes.filter(s => s.end <= minute).map(s => s.id) };
  } };
  return planner;
}

// Explicit opt-in keeps C1-2's single-beat player and its existing consumers
// unchanged until the visual builder wires this factory into record/page.js.
export function createShowPlayer(frames, options = {}) {
  return createRecordPlayer(frames, { ...options, showPlanner: createShowPlanner(frames) });
}
