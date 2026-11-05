import { createRecordPlayer, showMinute, SHOW_MINUTES } from './player.js';
import { targetsAt, fightsAt, restingPlace } from './placement.js';
import { DISTRICTS, SITES, CORNERS, placeIn } from './places.js';
import { stageNight, planMint } from './staging.js';
import { createRoutinePlanner } from './routines.js';
import { continuityTrips } from './routine-places.js';
import { addressesFor } from './addresses.js';

const owns = (object, key) => Object.hasOwn(object, key);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const anchor = row => ({ corePlace: row.corePlace, cityPlace: row.cityPlace,
  district: row.district, standPlace: row.standPlace ?? null, lot: row.lot ?? null });

// Only the night's public frame, preceding board and public departure rows are inputs. Delayed play
// receipts, card subjects, event prose and the night's resulting board are never
// used to identify an attacker, reconstruct a group, or predict a game result.
export function planShow(frame, board, { origins = null, trips = continuityTrips } = {}) {
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
  const scenes = [], suppliedActors = new Map();
  // A hood keeps captions anonymous, not the walker's identity (§41, 10-30).
  // Keep typed scene subjects for placement even when add omits their names
  // from publicActors. In particular an anonymous boarder still walks aboard.
  const actorsOf = scene => [...new Set([...scene.publicActors, ...(suppliedActors.get(scene.id) ?? [])])];
  function add(eventId, key, kind, beat, place, actors = [], hoodedCount = 0, revealIds = []) {
    const scene = { id: `${show.id}:${key}`, night: frame.day, eventId, kind, beat,
      place: anchor(place), start, end: start, publicActors: [...new Set(actors.filter(visible))].sort(),
      hoodedCount, revealIds: [...revealIds] };
    suppliedActors.set(scene.id, actors.filter(id => targets.has(id)));
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
  const duration = noteworthy ? SHOW_MINUTES : 3;
  let end = start + duration;
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
  // §41, 10-30: "no one wants to watch people drop off screen". The trip
  // service is the only travel clock. Move from the public 9:05 row, wait for
  // arrival, then play the scene. No rule result or board value enters timing.
  const travelPlace = p => p.corePlace === 'home' ? p.cityPlace : p.standPlace ?? p.cityPlace;
  const samePlace = (a, b) => travelPlace(a) === travelPlace(b);
  const reason = p => p.corePlace === 'home' ? 'home' : p.corePlace === 'heap' ? 'heap' : p.cityPlace === 'jail' ? 'jail'
    : p.cityPlace === 'docks' ? 'docks' : owns(CORNERS, p.corePlace) ? 'corner' : 'site';
  const movements = [], positions = new Map();
  const walk = scene => !!scene.route && (scene.kind === 'walk' || scene.kind === 'board' && scene.beat === 'ambient'
    || scene.kind === 'back' && scene.beats?.[0]?.name === 'walk');
  function move(id, from, to, minute, onFoot = false) {
    const trip = samePlace(from, to) || to.cityPlace === 'jail' ? null
      : trips.plan(id, travelPlace(from), travelPlace(to), minute, { walk: onFoot });
    if (!samePlace(from, to) && to.cityPlace !== 'jail' && !trip) throw new Error(`no continuous trip for ${id}: ${travelPlace(from)} -> ${travelPlace(to)}`);
    const row = { agent: id, minute, from: anchor(from), place: anchor(to), reason: reason(to),
      arrival: trip?.arr ?? minute, walk: onFoot };
    movements.push(row);
    return { place: to, ready: row.arrival, available: minute };
  }
  for (const [id, target] of targets) {
    const from = origins?.get(id)?.place ?? origins?.get(id) ?? target;
    const onFoot = frame.day === 14 && scenes.some(s => walk(s) && actorsOf(s).includes(id));
    positions.set(id, move(id, from, target, start, onFoot));
  }
  const opening = Math.max(start, ...[...positions.values()].map(p => p.ready));
  // This shared arrival boundary is also a drawing timeline boundary. An actor
  // whose first scene is elsewhere leaves here, after its opening trip, never
  // at an unobserved instant between two of the drawing's placement samples.
  const ready = add(show.id, 'arrivals', 'arrival', 'arrival', SITES.precinct);
  ready.start = opening; ready.end = opening + .0625;
  for (const p of positions.values()) p.available = ready.end;
  // A finale route starts where the day left the walker, just like any other
  // show trip. Its arrival scene precedes the route walk; drawing must not
  // substitute its home for that public departure point.
  for (const scene of [...scenes].filter(walk)) for (const id of actorsOf(scene)) {
    if (scenes.some(s => s !== scene && actorsOf(s).includes(id) && s.start < scene.start)) continue;
    const arrival = add(show.id, `arrival:${id}`, 'arrival', 'arrival', targets.get(id), [id]);
    arrival.start = start; arrival.end = start + .0625;
  }
  // Finish street scenes before boarding: a hooded actor must not leave the
  // gangway to perform a late anonymous scene, then vanish onto the ferry.
  const phase = scene => frame.day !== 14 ? 0 : scene.kind === 'missed' ? 4 : scene.kind === 'ferry' ? 3
    : scene.kind === 'board' && scene.beat === 'finale' ? 2 : 1;
  const running = scenes.filter(s => s !== closing && s !== ready)
    .sort((a, b) => phase(a) - phase(b) || a.start - b.start || a.id.localeCompare(b.id));
  let focusEnd = opening, ferryEnd = opening, boardingEnd = opening;
  const retime = (scene, at, width) => {
    scene.start = at; scene.end = at + width;
    if (scene.beats) {
      const step = width / scene.beats.length;
      scene.beats = scene.beats.map((beat, i) => ({ ...beat, start: at + i * step,
        end: i === scene.beats.length - 1 ? scene.end : at + (i + 1) * step }));
    }
  };
  for (const scene of running) {
    const width = scene.end - scene.start;
    const masked = scene.hoodedCount ? Object.keys(show.masked ?? {}).filter(id => {
      const p = targets.get(id);
      return samePlace(p, scene.place);
    }) : [];
    const actors = [...new Set([...actorsOf(scene), ...masked])];
    let at = scene.start + opening - start;
    for (const id of actors) {
      let p = positions.get(id);
      if (!p || p.place.cityPlace === 'jail') continue;
      if (!samePlace(p.place, scene.place) || p.place.cityPlace !== scene.place.cityPlace) {
        p = move(id, p.place, scene.place, Math.max(p.available, p.ready), walk(scene)
          || frame.day === 14 && scene.place.cityPlace === 'docks');
        positions.set(id, p);
      }
      at = Math.max(at, p.ready, p.available);
    }
    if (['fight', 'arrest'].includes(scene.beat)) at = Math.max(at, focusEnd);
    if (scene.kind === 'board' && scene.beat === 'finale') at = Math.max(at, focusEnd);
    if (scene.kind === 'ferry') at = Math.max(at, boardingEnd, focusEnd);
    if (scene.kind === 'missed') at = Math.max(at, ferryEnd);
    retime(scene, at, width);
    for (const id of actors) if (positions.has(id)) positions.get(id).available = scene.end;
    if (['fight', 'arrest'].includes(scene.beat)) focusEnd = scene.end;
    if (scene.kind === 'board' && scene.beat === 'finale') boardingEnd = Math.max(boardingEnd, scene.end);
    if (scene.kind === 'ferry') ferryEnd = scene.end;
    if (scene.kind === 'missed' && scene.place.cityPlace !== 'jail') for (const id of actorsOf(scene)) {
      const agent = board.agents.find(a => a.id === id), address = addressesFor(board.agents.map(a => a.id))[id];
      const destination = restingPlace(agent, { [id]: address });
      positions.set(id, move(id, scene.place, destination, scene.end));
    }
  }
  end = Math.max(ready.end, ...running.map(s => s.end)) + .25;
  closing.start = end - .25; closing.end = end;
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
  movements.sort((a, b) => a.minute - b.minute || a.agent.localeCompare(b.agent));
  const finale = frame.day === 14 ? {
    leave: { start: scenes.find(s => s.kind === 'ferry').start, end: scenes.find(s => s.kind === 'ferry').end },
  } : null;
  return freeze({ night: frame.day, frame: frame.i, eventId: show.id, start, end, openingIds, scenes, movements, finale });
}

// Stateless selection: playback, reverse seeks and fresh players use identical
// absolute scene intervals. At an end boundary the result is due and the scene
// is no longer active. Drawing uses progress, not elapsed wall time or an RNG.
export function showState(plan, minute) {
  if (!plan || minute < plan.start || minute >= plan.end) return null;
  return { night: plan.night, start: plan.start, end: plan.end,
    placements: [...new Map((plan.movements ?? []).filter(row => row.minute <= minute).map(row => [row.agent, row])).values()],
    finale: plan.finale,
    active: plan.scenes.filter(s => s.start <= minute && minute < s.end)
      .map(scene => ({ ...scene, progress: (minute - scene.start) / (scene.end - scene.start) })),
    completed: plan.scenes.filter(s => s.end <= minute).map(s => s.id) };
}

export function createShowPlanner(frames) {
  const cache = new Map();
  const routines = createRoutinePlanner(frames), trips = continuityTrips;
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
        const origins = new Map(routines.at(showMinute(n) - .0001).map(row => [row.agent, row]));
        const plan = planShow(frame, board, { origins, trips }); cache.set(n, plan); return plan;
      }
      if (frame.board !== undefined) board = frame.board;
    }
    throw new RangeError(`no show for night ${n}`);
  }
  const planner = { night, day, at(minute) {
    const frame = frames.findLast(f => f.step.kind === 'night' && f.minute <= minute && showMinute(f.day) <= minute);
    return frame ? showState(night(frame.day), minute) : null;
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
