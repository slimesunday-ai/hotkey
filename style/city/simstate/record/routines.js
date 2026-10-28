import { CORNERS, DROPS, DISTRICTS, SITES } from './places.js';
import { addressesFor, idHash } from './addresses.js';
import { createRecordAdapter } from './adapter.js';
import { revealAt } from './player.js';
import { meetingPlace } from './routine-places.js';

export const LOOP_ROLES = Object.freeze(['deal', 'work', 'patrol', 'hang', 'cook', 'bench', 'meet']);
export const MEET_MINUTES = 5;
const DAY = 1440, DAWN = 360, SHOW = 1265;
const owns = (object, key) => Object.hasOwn(object, key);
const daytime = minute => minute % DAY >= DAWN && minute % DAY < SHOW;
const home = address => ({ corePlace: 'home', cityPlace: address.home, district: 'suburbs',
  lot: address.lot, standPlace: null });
const outdoor = place => place.corePlace !== 'home' && !place.corePlace.startsWith('lab-')
  && !['diner', 'sitdown-car'].includes(place.corePlace);
const walkOf = (agent, place) => outdoor(place) && ['wired', 'spaced', 'guarded'].includes(agent.walk) ? agent.walk : null;
const publicFields = agent => JSON.stringify([agent.fit, agent.fitHidden, agent.crew, agent.jailed, agent.evicted, agent.walk]);

// Public, current facts only. In particular the latest three *past* shows supply
// habitual districts, never an unseen attacker, a play, target, memory or chat.
function ordinary(agent, minute, context) {
  const { book, seed, board, shows } = context, day = Math.floor(minute / DAY);
  const hash = idHash(JSON.stringify([seed, agent.id, day, Math.floor(minute % DAY / 60)]));
  const rest = agent.evicted ? SITES.heap : home(book[agent.id]);
  if (agent.jailed) return { place: SITES.jail, act: 'yard', role: 'hang' };
  if (day === 0) return { place: SITES.docks, act: 'arrival', role: 'hang' };
  if (!daytime(minute)) return { place: rest, act: 'rest', role: 'hang' };
  const corner = board.corners?.find(c => c.holder === agent.id);
  const recent = shows.filter(s => s.night < day).slice(-3)
    .filter(s => owns(s.seen, agent.id)).map(s => s.seen[agent.id]);
  const known = recent.filter(p => owns(DISTRICTS, p));
  const familiar = known.length ? DISTRICTS[known[hash % known.length]] : null;
  // A held corner remains the Dealer's public daytime anchor. A night hustle
  // supplies a familiar district, not a prediction or a daytime honest shift.
  if (corner) return { place: CORNERS[corner.corner], act: 'deal', role: 'deal' };
  if (agent.evicted) return { place: SITES.heap, act: 'hang', role: 'hang' };
  if (hash % 5 === 0) return { place: SITES.diner, act: 'hang', role: 'hang' };
  if (hash % 5 === 1) return { place: familiar ?? rest, act: 'hang', role: 'hang' };
  switch (agent.trade?.toLowerCase()) {
    case 'chemist': {
      const forest = recent.includes('forest');
      const labs = ['lab-north', 'lab-west', 'lab-south'];
      return { place: forest ? SITES[labs[idHash(agent.id) % labs.length]] : rest, act: 'cook', role: 'cook' };
    }
    case 'gunrunner': return { place: rest, act: 'craft', role: 'bench' };
    case 'cop': return { place: familiar ?? SITES.precinct, act: 'patrol', role: 'patrol' };
    case 'smuggler': {
      const drops = recent.filter(p => owns(DROPS, p));
      return drops.length ? { place: DROPS[drops[hash % drops.length]], act: 'gather', role: 'work' }
        : { place: rest, act: 'prepare', role: 'work' };
    }
    default: return { place: familiar ?? rest, act: 'hang', role: 'hang' };
  }
}

function lastAt(rows, minute) {
  let lo = 0, hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (rows[mid].minute <= minute) lo = mid + 1; else hi = mid; }
  return lo ? rows[lo - 1] : null;
}

// Build lazily, in publication order, with C1-2's reducer and night hold. Future
// boards/event payloads are not inspected. Cached rows are immutable and never
// acquire an end time learned later. Backward seeks just select earlier rows.
export function createRoutinePlanner(frames) {
  const adapter = createRecordAdapter(), rows = new Map(), active = new Map();
  const meetings = [], bubbles = [], shows = [], seenEvents = new Set();
  const pending = [], heldUntil = new Map(), speech = [];
  let cursor = 0, tick = 0, wake = Infinity, sunset = SHOW;
  let horizon = -1, seed = 0, board = null, book = null;
  const context = () => ({ board, book, seed, shows });
  const agents = () => board?.agents ?? [];
  const agentOf = id => agents().find(a => a.id === id);
  function put(agent, minute, value, source) {
    const list = rows.get(agent.id) ?? [];
    const place = Object.freeze({ ...value.place, lot: value.place.lot ?? null });
    const entry = Object.freeze({ agent: agent.id, minute, place, act: value.act, role: value.role,
      walk: walkOf(agent, place), loopSeed: idHash(JSON.stringify([seed, agent.id, minute, value.act])),
      source: Object.freeze(source), ...(value.meet !== undefined
        ? { meet: value.meet, cut: true, scenePlace: value.scenePlace } : {}),
      ...(value.lineEvent !== undefined ? { lineEvent: value.lineEvent } : {}) });
    list.push(entry); rows.set(agent.id, list);
    return entry;
  }
  function normal(agent, minute, source = { kind: 'routine' }) {
    return put(agent, minute, ordinary(agent, minute, context()), source);
  }
  function leave(id, minute) {
    const meeting = active.get(id);
    if (!meeting) return;
    for (const partner of [meeting.a, meeting.b]) {
      active.delete(partner);
      const agent = agentOf(partner);
      if (agent) normal(agent, minute, { kind: 'resume', eventId: meeting.eventId });
    }
  }
  function act(id, minute, kind, eventId, place = null) {
    const agent = agentOf(id);
    if (!agent) return null;
    const previous = rows.get(id)?.at(-1);
    leave(id, minute);
    const base = ordinary(agent, minute, context());
    const destination = agent.jailed ? SITES.jail : place ?? (kind === 'housing' ? base.place : previous?.place ?? base.place);
    return put(agent, minute, { ...base, place: destination,
      act: kind, role: 'hang', ...(kind === 'outloud' ? { lineEvent: eventId } : {}) },
    { kind: 'public-act', eventId: eventId ?? null });
  }
  function enqueue(ids, minute, kind, value) {
    pending.push({ ids, minute, kind, value });
  }
  function meet(event, minute) {
    const a = agentOf(event.a), b = agentOf(event.b);
    if (!a || !b) throw new Error(`meet ${event.id} needs both public roster ids`);
    const end = event.day * DAY + SHOW;
    const cut = minute + MEET_MINUTES > end;
    const cue = Object.freeze({ eventId: event.id, sitdown: event.sitdown, a: a.id, b: b.id,
      minute, published: event.minute, minimum: MEET_MINUTES, ...meetingPlace(a.id, b.id),
      cut: true, reason: cut ? 'day-end' : 'announced-now' });
    meetings.push(cue);
    if (cut) return;
    leave(a.id, minute); leave(b.id, minute);
    active.set(a.id, cue); active.set(b.id, cue);
    for (const agent of [a, b]) put(agent, minute,
      { place: agent.jailed ? SITES.jail : cue.place, scenePlace: cue.place,
        act: 'meet', role: 'meet', meet: event.id }, { kind: 'meet', eventId: event.id });
    for (const id of [a.id, b.id]) heldUntil.set(id, minute + MEET_MINUTES);
  }
  // These are staging jobs from already public frames, not forecasts. An older
  // waiting pair blocks either actor's later jobs; unrelated pairs can proceed.
  function flush(minute) {
    pending.sort((a, b) => a.minute - b.minute || Number(b.kind === 'meet') - Number(a.kind === 'meet'));
    const blocked = new Set();
    wake = Infinity;
    for (let i = 0; i < pending.length;) {
      const job = pending[i];
      if (job.ids.some(id => blocked.has(id) || (heldUntil.get(id) ?? -Infinity) > minute)) {
        for (const id of job.ids) {
          blocked.add(id);
          const until = heldUntil.get(id);
          if (until > minute) wake = Math.min(wake, until);
        }
        i++; continue;
      }
      pending.splice(i, 1);
      if (job.kind === 'meet') meet(job.value, minute);
      else if (job.kind === 'corner') {
        leave(job.ids[0], minute);
        normal(agentOf(job.ids[0]), minute, { kind: 'corner' });
      } else act(job.ids[0], minute, job.kind, job.value.eventId, job.value.place);
    }
  }
  function apply(frame, minute) {
    const before = board;
    board = adapter.apply(frame).board;
    book = addressesFor(agents().map(a => a.id));
    // Seed comes only from the public season event, never a file name or suffix.
    for (const event of frame.events) if (event.type === 'season') seed = event.seed;
    for (const agent of agents()) {
      const old = before?.agents.find(a => a.id === agent.id);
      if (!old) normal(agent, minute);
      else if (publicFields(old) !== publicFields(agent)) {
        const kind = old.jailed && !agent.jailed ? 'release' : old.walk !== agent.walk ? 'high'
          : old.crew !== agent.crew ? 'crew' : old.evicted !== agent.evicted ? 'housing' : 'fit';
        enqueue([agent.id], minute, kind, { eventId: null, place: kind === 'release' ? SITES.jail : null });
      }
      const was = before?.corners?.find(c => c.holder === agent.id)?.corner;
      const now = board.corners?.find(c => c.holder === agent.id)?.corner;
      if (old && was !== now) enqueue([agent.id], minute, 'corner', null);
    }
    for (const event of frame.events) {
      if (seenEvents.has(event.id)) continue;
      seenEvents.add(event.id);
      if (event.type === 'show') {
        // Only seen is read, after the whole-night hold. Never show.plays.
        shows.push({ night: event.night, seen: event.seen });
        continue;
      }
      // Delayed disclosures are history, never a reason to act today. In
      // particular close is private at the time it happens: do not end a live
      // meeting using tomorrow's disclosure, or persist one without a new meet.
      if (!['meet', 'outloud', 'release', 'high', 'crew'].includes(event.type)) continue;
      if (event.day !== Math.floor(minute / DAY) || !daytime(minute)) continue;
      if (event.type === 'meet') {
        enqueue([event.a, event.b], minute, 'meet', event);
      } else if (event.type === 'outloud') {
        enqueue([event.agent], minute, 'outloud', { eventId: event.id });
        speech.push(event);
      } else if (event.type === 'release') enqueue([event.agent], minute, 'release', { eventId: event.id, place: SITES.jail });
      else if (event.type === 'high') enqueue([event.agent], minute, 'high', { eventId: event.id });
      else if (event.type === 'crew' && ['form', 'join', 'leave', 'dissolve'].includes(event.act)) {
        enqueue([event.agent], minute, 'crew', { eventId: event.id });
      }
    }
  }
  function ensure(minute) {
    if (!Number.isFinite(minute) || minute < 0) throw new RangeError('routine minute must be nonnegative and finite');
    if (minute <= horizon) return;
    while (true) {
      const due = cursor < frames.length ? revealAt(frames[cursor]) : Infinity;
      const next = Math.min(due, tick, wake, sunset);
      if (next > minute) break;
      if (sunset === next) {
        active.clear(); heldUntil.clear();
        for (const agent of agents()) normal(agent, next);
        sunset += DAY;
      }
      if (tick === next) {
        if (!daytime(tick) || tick % DAY === DAWN) active.clear();
        for (const agent of agents()) if (!active.has(agent.id)) normal(agent, tick);
        tick += 60;
      }
      // Public acts win over a simultaneous routine tick, including dawn.
      // Collect the whole published minute before staging it, so public rows at
      // that minute follow its meets. No row is written ahead of this cursor.
      while (cursor < frames.length && revealAt(frames[cursor]) === next) apply(frames[cursor++], next);
      flush(next);
      // Speech keeps its core publication time, at the speaker's current place;
      // its movement row may wait behind a sit-down's minimum.
      for (const event of speech.splice(0)) {
        const row = rows.get(event.agent)?.at(-1);
        if (row) bubbles.push(Object.freeze({ agent: event.agent, minute: next, line: event.line,
          eventId: event.id, place: row.place }));
      }
    }
    horizon = minute;
  }
  function at(minute) {
    ensure(minute);
    return [...rows.values()].map(list => lastAt(list, minute)).filter(Boolean);
  }
  function day(day, asOf = day * DAY + 1260) {
    if (!Number.isInteger(day) || day < 0) throw new RangeError('routine day must be a nonnegative integer');
    ensure(asOf);
    const start = day * DAY + DAWN, end = Math.min(asOf, day * DAY + SHOW);
    const entries = [...rows.values()].flatMap(list => {
      const first = lastAt(list, start);
      return [...(first && first.minute < start ? [{ ...first, minute: start }] : []),
        ...list.filter(row => row.minute >= start && row.minute <= end)];
    }).filter(row => row.minute <= end).sort((a, b) => a.minute - b.minute || (a.agent < b.agent ? -1 : a.agent > b.agent ? 1 : 0));
    return { day, asOf: end, entries, meetings: meetings.filter(c => c.minute >= start && c.minute <= end),
      bubbles: bubbles.filter(c => c.minute >= start && c.minute <= end) };
  }
  return Object.freeze({ at, day });
}
