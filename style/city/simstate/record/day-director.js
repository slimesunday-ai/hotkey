import { delayS } from '../broadcast.js';
import { publicAt } from './placement.js';
import { captionSubjects } from './cut-plan.js';

const DAY = 1440, SECOND = 1 / 60;
const LOOP_ACTS = new Set(['arrival', 'hang', 'yard', 'gather', 'prepare', 'cook', 'craft', 'deal', 'patrol', 'meet']);
const order = (a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const anchor = place => ({ corePlace: place.corePlace, cityPlace: place.cityPlace,
  district: place.district, standPlace: place.standPlace ?? null, lot: place.lot ?? null });
const stageable = place => typeof place?.cityPlace === 'string' && !place.cityPlace.startsWith('dist:');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};

// Already-presented snapshot + C1-4's as-of rows, never an archive suffix.
// arrivals are optional PUBLIC presentation-trip announcements, with an explicit
// announcedMinute and setup/arrival times. No travel time or game fact is inferred.
export function publicMoments(snapshot, rows, arrivals = []) {
  const minute = snapshot.minute, day = Math.floor(minute / DAY), events = publicAt(snapshot);
  const roster = new Set((snapshot.board?.agents ?? []).map(agent => agent.id));
  const byId = new Map(rows.filter(row => row.minute <= minute).map(row => [row.agent, row]));
  const moments = [];
  function put(id, kind, subjects, place, setupMinute, payoff = null, source = null) {
    if (!stageable(place) || !subjects.length || subjects.some(id => !roster.has(id))) return;
    moments.push({ id, kind, subjects: [...subjects].sort(), place: anchor(place), setupMinute, payoff, source });
  }
  for (const event of events) {
    if (event.day !== day || event.minute > minute || minute - event.minute > 1.5) continue;
    if (event.type === 'meet') {
      const a = byId.get(event.a), b = byId.get(event.b);
      if (a?.meet !== event.id || b?.meet !== event.id) continue;
      put(`meet:${event.id}`, 'meet', [event.a, event.b], a.scenePlace ?? a.place,
        event.minute, null, { eventId: event.id });
    } else if (event.type === 'outloud' || event.type === 'release') {
      const row = byId.get(event.agent);
      if (row) put(`${event.type}:${event.id}`, event.type, [event.agent], row.place,
        event.minute, { minute: event.minute, kind: event.type, eventId: event.id }, { eventId: event.id });
    }
  }
  for (const row of byId.values()) {
    if (!roster.has(row.agent) || row.minute < day * DAY || !LOOP_ACTS.has(row.act)) continue;
    // A routine has no known game payoff. Keep the current public loop as a
    // setup; its subsequent close-up is a presentation mark, labelled separately.
    put(`routine:${row.agent}:${row.minute}:${row.act}`, 'routine', [row.agent], row.place,
      row.minute, null, { agent: row.agent, minute: row.minute, act: row.act });
  }
  for (const arrival of arrivals) {
    if (!Number.isFinite(arrival.announcedMinute) || arrival.announcedMinute > minute
      || arrival.setupMinute > minute || arrival.minute < minute - 1.5
      || arrival.setupMinute < arrival.announcedMinute || arrival.minute < arrival.setupMinute) continue;
    put(`arrival:${arrival.id}`, 'arrival', arrival.subjects, arrival.place, arrival.setupMinute,
      { minute: arrival.minute, kind: 'arrival', tripId: arrival.id }, { tripId: arrival.id });
  }
  return freeze(moments);
}

export function scoreMoments(moments, minute, { recent = [], preferred = [] } = {}) {
  const base = { arrival: 7, release: 7, outloud: 6, meet: 5, routine: 2 };
  return moments.map(moment => {
    const repeat = recent.some(cut => minute - cut.start < 3 && (cut.place.cityPlace === moment.place.cityPlace
      || cut.subjects.some(id => moment.subjects.includes(id))));
    const personal = moment.subjects.some(id => preferred.includes(id));
    return { ...moment, score: (base[moment.kind] ?? 1) * (personal ? 2 : 1) * (repeat ? .5 : 1) };
  }).sort(order);
}

// Caller drives this at 1 Hz of the EXISTING island clock (one second = 1/60
// minute at live pace). Same-second calls are idempotent. No timer/second clock.
// Epoch/seek: reset(), then feed presented snapshots forward from that point.
// No queued broadcast payload enters this module. Only camera/director.js may
// consume the lookahead; 15 seconds of it cannot supply 30 seconds of setup.
export function createDayDirector({ routines, delay = delayS, preferred = [] } = {}) {
  if (!routines?.at) throw new TypeError('day director needs the public routine planner');
  let lastSecond = -Infinity, lastMinute = -Infinity, current = null, recent = [], result = null;
  function reset() {
    lastSecond = lastMinute = -Infinity; current = result = null; recent = [];
  }
  function tick(snapshot, { arrivals = [] } = {}) {
    const minute = snapshot.minute;
    publicAt(snapshot);
    if (minute < lastMinute) throw new Error('reset day director after a backward seek');
    const second = Math.floor(minute * 60 + 1e-6);
    if (second === lastSecond) return result;
    lastSecond = second; lastMinute = minute;
    const broadcastDelay = delay();
    if (!Number.isFinite(broadcastDelay) || broadcastDelay < 0) throw new RangeError('invalid broadcast delay');
    const time = minute % DAY;
    if (time < 360 || time >= 1260 || snapshot.over) {
      current = null; return result = freeze({ action: 'idle', minute, broadcastDelay, cut: null });
    }
    const moments = publicMoments(snapshot, routines.at(minute), arrivals);
    recent = recent.filter(cut => minute - cut.start < 3);
    const candidates = scoreMoments(moments, minute, { recent, preferred });
    // Retain a public setup for at least thirty seconds, including D=0. An
    // announced arrival also retains the shot through its payoff when possible.
    if (current && minute < current.end - SECOND / 2) {
      return result = freeze({ action: 'hold', minute, broadcastDelay, cut: current });
    }
    const best = candidates.find(candidate => !recent.some(cut => cut.momentId === candidate.id));
    if (!best) {
      current = null; return result = freeze({ action: 'idle', minute, broadcastDelay, cut: null });
    }
    const payoff = best.payoff;
    const end = Math.max(minute + 1, payoff && payoff.minute >= minute ? payoff.minute + .25 : minute + 1);
    current = freeze({ sceneId: `day:${second}:${best.id}`, momentId: best.id, score: best.score,
      start: minute, end, subjects: [...best.subjects], place: best.place,
      setup: { minute, publicSince: best.setupMinute, source: best.source }, payoff,
      routineCloseup: best.kind === 'routine' ? minute + .5 : null,
      captionFields: { kind: best.kind, place: best.place.corePlace,
        subjects: captionSubjects(best.subjects, snapshot.board), anonymousCount: 0 } });
    recent.push(current);
    return result = freeze({ action: 'cut', minute, broadcastDelay, cut: current });
  }
  return { tick, reset };
}
