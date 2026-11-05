import { CORNERS, DROPS, DISTRICTS, SITES } from './places.js';
import { addressesFor, idHash } from './addresses.js';
import { createRecordAdapter } from './adapter.js';
import { revealAt } from './player.js';
import { meetingPlace, actPlace, actAgents, phoneAct, homePlace, planShow, continuityTrips as trips } from './routine-places.js';

export const LOOP_ROLES = Object.freeze(['deal', 'work', 'patrol', 'hang', 'cook', 'bench', 'meet']);
export const MEET_MINUTES = 5;
export const ACT_MINUTES = 2;
const DAY = 1440, DAWN = 360, SHOW = 1265;
const owns = (object, key) => Object.hasOwn(object, key);
const daytime = minute => minute % DAY >= DAWN && minute % DAY < SHOW;
const errandTime = minute => daytime(minute) || Math.floor(minute / DAY) >= 15 && minute % DAY >= DAWN;
const travelPlace = p => p.corePlace === 'home' ? p.cityPlace : p.standPlace ?? p.cityPlace;
const home = address => homePlace(address);
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
  const meetings = [], acts = [], bubbles = [], shows = [], seenEvents = new Set();
  const pending = [], heldUntil = new Map(), speech = [];
  const arrivals = [], waitingShows = [], closed = new Set();
  let closing = null, order = 0, afterUntil = -Infinity;
  let cursor = 0, tick = 0, wake = Infinity, sunset = SHOW;
  let horizon = -1, seed = 0, board = null, book = null;
  const context = () => ({ board, book, seed, shows });
  const agents = () => board?.agents ?? [];
  const agentOf = id => agents().find(a => a.id === id);
  function put(agent, minute, value, source) {
    const list = rows.get(agent.id) ?? [];
    const place = Object.freeze({ ...value.place, lot: value.place.lot ?? null });
    const previous = list.at(-1);
    const from = previous?.place ?? SITES.docks;
    if (source.kind !== 'show-close' && travelPlace(from) !== travelPlace(place) && place.cityPlace !== 'jail') {
      const departure = minute + (previous ? 0 : (idHash(agent.id) % 30) / 10);
      const trip = trips.plan(agent.id, travelPlace(from), travelPlace(place), departure);
      if (!trip) throw new Error(`no routine trip for ${agent.id}`);
      // Ordinary life cannot begin a trip that the show would interrupt.
      // These destinations are already public; no future payload is read.
      if (Math.floor(minute / DAY) < 15 && daytime(minute) && trip.arr > Math.floor(minute / DAY) * DAY + SHOW) return previous;
      heldUntil.set(agent.id, Math.max(heldUntil.get(agent.id) ?? minute, trip.arr));
    }
    const entry = Object.freeze({ agent: agent.id, minute, place, act: value.act, role: value.role,
      walk: walkOf(agent, place), loopSeed: idHash(JSON.stringify([seed, agent.id, minute, value.act])),
      source: Object.freeze(source), ...(value.afterShow ? { afterShow: true } : {}), ...(value.meet !== undefined
        ? { meet: value.meet, scenePlace: value.scenePlace } : {}),
      ...(value.lineEvent !== undefined ? { lineEvent: value.lineEvent } : {}),
      ...(value.errand !== undefined ? { errand: value.errand, live: value.live } : {}) });
    list.push(entry); rows.set(agent.id, list);
    return entry;
  }
  function normal(agent, minute, source = { kind: 'routine' }) {
    if ((heldUntil.get(agent.id) ?? -Infinity) > minute || pending.some(job => job.ids.includes(agent.id))) return rows.get(agent.id)?.at(-1);
    const value = ordinary(agent, minute, context()), previous = rows.get(agent.id)?.at(-1);
    // Finish the return trip too before ordinary placement takes over.
    if (previous?.afterShow && travelPlace(previous.place) !== travelPlace(value.place)) value.afterShow = true;
    return put(agent, minute, value, source);
  }
  function leave(id, minute) {
    const meeting = active.get(id);
    if (!meeting) return;
    for (const partner of [meeting.a, meeting.b]) {
      active.delete(partner);
      const agent = agentOf(partner);
      const previous = rows.get(partner)?.at(-1);
      if (agent && previous) put(agent, minute, { place: previous.place, act: 'hang', role: 'hang', afterShow: previous.afterShow },
        { kind: 'resume', eventId: meeting.eventId });
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
    pending.push({ ids, minute, kind, value, order: order++ });
  }
  function meet(job, minute) {
    const event = job.value;
    const a = agentOf(event.a), b = agentOf(event.b);
    if (!a || !b) throw new Error(`meet ${event.id} needs both public roster ids`);
    const end = event.day < 15 && !job.afterShow ? event.day * DAY + SHOW : Infinity, venue = meetingPlace(a.id, b.id);
    const arrival = Math.max(minute, ...[a, b].map(agent => {
      const from = rows.get(agent.id).at(-1).place;
      if (agent.jailed || travelPlace(from) === travelPlace(venue.place)) return minute;
      const trip = trips.plan(agent.id, travelPlace(from), travelPlace(venue.place), minute);
      if (!trip) throw new Error(`no meeting trip for ${agent.id}`);
      return trip.arr;
    }));
    // §41, 10-31: "Do your recommendation here"; keep the whole job for the close.
    if (arrival + MEET_MINUTES > end) { pending.push({ ...job, afterShow: true }); return; }
    const cue = Object.freeze({ eventId: event.id, sitdown: event.sitdown, a: a.id, b: b.id,
      minute: arrival, departure: minute, published: event.minute, minimum: MEET_MINUTES, ...venue,
      cut: false, reason: 'travel', ...(job.afterShow || event.day >= 15 ? { afterShow: true } : {}) });
    meetings.push(cue);
    leave(a.id, minute); leave(b.id, minute);
    for (const agent of [a, b]) {
      put(agent, minute, { place: agent.jailed ? SITES.jail : cue.place,
        act: 'travel', role: 'hang', afterShow: cue.afterShow }, { kind: 'meet-travel', eventId: event.id });
      heldUntil.set(agent.id, arrival + MEET_MINUTES);
    }
    if (job.afterShow) afterUntil = arrival + MEET_MINUTES;
    arrivals.push({ minute: arrival, cue });
  }
  function stageVisit(jobs, minute, place) {
    const ids = jobs[0].ids, first = jobs[0].value, afterShow = jobs[0].afterShow || first.day >= 15;
    const arrival = Math.max(minute, ...ids.map(id => {
      const from = rows.get(id).at(-1).place;
      if (travelPlace(from) === travelPlace(place)) return minute;
      const trip = trips.plan(id, travelPlace(from), travelPlace(place), minute);
      if (!trip) throw new Error(`no act trip for ${id}: ${first.kind}`);
      return trip.arr;
    }));
    let start = arrival;
    const staged = [];
    for (const job of jobs) {
      const event = job.value, minimum = ids.length > 1 ? MEET_MINUTES : ACT_MINUTES;
      // §41, 10-31: "Do your recommendation here"; the show starts at 21:05.
      if (!afterShow && event.day < 15 && start + minimum > event.day * DAY + SHOW) {
        pending.push({ ...job, afterShow: true });
        continue;
      }
      // Sharing a travel anchor doesn't turn the fence booth into an ambient
      // Heap scene. Each act keeps its own set within that one visit.
      const scenePlace = phoneAct(event) ? place : actPlace(event, { book, agentOf, current: id => rows.get(id).at(-1).place });
      const cue = Object.freeze({ eventId: event.id, agent: event.agent, kind: event.kind,
        ...(event.counterpart ? { counterpart: Object.freeze({ ...event.counterpart }) } : {}),
        participants: Object.freeze([...ids]), visit: first.id,
        place: Object.freeze({ ...scenePlace }), minute: start,
        departure: staged.length ? start : minute, published: event.minute,
        minimum, blocked: false, ...(afterShow ? { afterShow: true } : {}) });
      acts.push(cue);
      staged.push(cue);
      start += minimum;
    }
    if (!staged.length) return;
    for (const id of ids) {
      leave(id, minute);
      put(agentOf(id), minute, { place, act: 'travel', role: 'hang', afterShow }, { kind: 'act-travel', eventId: first.id });
      heldUntil.set(id, staged.at(-1).minute + staged.at(-1).minimum);
    }
    if (afterShow) afterUntil = start;
    for (const cue of staged) arrivals.push({ minute: cue.minute, live: cue, ids });
  }
  function liveVisit(job, minute) {
    const current = id => rows.get(id).at(-1).place;
    const place = actPlace(job.value, { book, agentOf, current });
    const same = p => (p.corePlace === 'home' ? p.cityPlace : p.standPlace ?? p.cityPlace)
      === (place.corePlace === 'home' ? place.cityPlace : place.standPlace ?? place.cityPlace);
    const jobs = [job];
    // Only already published acts in this burst can join the visit. No later
    // frame can add duration or move a row already presented to the follower.
    for (let i = 0; i < pending.length;) {
      const next = pending[i];
      const pair = next.ids.length === job.ids.length && next.ids.every(id => job.ids.includes(id));
      if (!job.afterShow && !next.afterShow && next.kind === 'live' && next.minute === job.minute && pair
        && (phoneAct(next.value) || same(actPlace(next.value, { book, agentOf, current })))) {
        jobs.push(next); pending.splice(i, 1);
      } else i++;
    }
    stageVisit(jobs, minute, place);
  }
  // These are staging jobs from already public frames, not forecasts. An older
  // waiting pair blocks either actor's later jobs; unrelated pairs can proceed.
  function flush(minute) {
    for (let i = 0; i < arrivals.length;) {
      const job = arrivals[i];
      if (job.minute > minute) { i++; continue; }
      arrivals.splice(i, 1);
      if (job.live) {
        for (const id of job.ids) put(agentOf(id), job.minute, { place: job.live.place,
          act: job.live.kind, role: 'hang', afterShow: job.live.afterShow, errand: job.live.eventId, live: job.live },
        { kind: 'act', eventId: job.live.eventId });
        continue;
      }
      for (const id of [job.cue.a, job.cue.b]) {
        const agent = agentOf(id);
        active.set(id, job.cue);
        put(agent, job.minute, { place: agent.jailed ? SITES.jail : job.cue.place,
          scenePlace: job.cue.place, afterShow: job.cue.afterShow, act: 'meet', role: 'meet', meet: job.cue.eventId },
        { kind: 'meet', eventId: job.cue.eventId });
      }
    }
    // A call stays where its speaker is before the burst’s trips and sit-down.
    const priority = job => job.kind === 'live' && phoneAct(job.value) ? 2 : Number(job.kind === 'meet');
    pending.sort((a, b) => a.minute - b.minute
      || (a.afterShow || b.afterShow ? a.order - b.order : priority(b) - priority(a)));
    const blocked = new Set();
    let deferredWaiting = false;
    wake = Infinity;
    for (let i = 0; i < pending.length;) {
      const job = pending[i];
      const waitingShow = job.afterShow && !closed.has(job.value.day);
      const waitingQueue = job.afterShow && afterUntil > minute;
      if (waitingShow || waitingQueue || job.afterShow && deferredWaiting || job.ids.some(id => blocked.has(id) || (heldUntil.get(id) ?? -Infinity) > minute)) {
        if (job.afterShow) deferredWaiting = true;
        if (waitingQueue) wake = Math.min(wake, afterUntil);
        for (const id of job.ids) {
          blocked.add(id);
          const until = heldUntil.get(id);
          if (until > minute) wake = Math.min(wake, until);
        }
        i++; continue;
      }
      pending.splice(i, 1);
      if (job.kind === 'meet') meet(job, minute);
      else if (job.kind === 'live') liveVisit(job, minute);
      else if (job.kind === 'corner') {
        leave(job.ids[0], minute);
        normal(agentOf(job.ids[0]), minute, { kind: 'corner' });
      } else act(job.ids[0], minute, job.kind, job.value.eventId, job.value.place);
      // A newly deferred pair owns its actors before any later job in this
      // flush, including a short call that could otherwise overtake it.
      if (pending.some(waiting => waiting.order === job.order && waiting.afterShow)) {
        for (const id of job.ids) blocked.add(id);
      }
    }
    wake = Math.min(wake, ...arrivals.map(job => job.minute));
  }
  function apply(frame, minute) {
    const before = board;
    if (frame.step.kind === 'night') {
      // Work still waiting on another actor/trip at the opening belongs after
      // the show too, even if its first departure was never attempted.
      for (const job of pending) if (['meet', 'live'].includes(job.kind)) job.afterShow = true;
    }
    if (frame.step.kind === 'night' && pending.some(job => job.afterShow)) {
      const origins = new Map([...rows].map(([id, list]) => [id, lastAt(list, minute - .0001)]));
      closing = planShow(frame, before, { origins, trips });
      waitingShows.push({ start: minute, end: closing.end,
        ids: [...new Set(pending.filter(job => job.afterShow).flatMap(job => job.ids))] });
    }
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
        // Habits read only seen. The show planner above owns the public
        // staging envelope, including its close and final movements.
        shows.push({ night: event.night, seen: event.seen });
        continue;
      }
      if (event.type === 'act') {
        if (event.day === Math.floor(minute / DAY) && errandTime(minute)) {
          const ids = actAgents(event);
          enqueue(ids, minute, 'live', event);
        }
        continue;
      }
      // Delayed disclosures are history, never a reason to act today. In
      // particular close is private at the time it happens: do not end a live
      // meeting using tomorrow's disclosure, or persist one without a new meet.
      if (!['meet', 'outloud', 'release', 'high', 'crew'].includes(event.type)) continue;
      if (event.day !== Math.floor(minute / DAY) || !errandTime(minute)) continue;
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
      const next = Math.min(due, tick, wake, sunset, closing?.end ?? Infinity);
      if (next > minute) break;
      if (sunset === next) {
        active.clear(); heldUntil.clear();
        for (const agent of agents()) normal(agent, next);
        sunset = sunset < 14 * DAY + SHOW ? sunset + DAY : Infinity;
      }
      const routineTick = tick === next;
      if (routineTick) {
        if (!daytime(tick) || tick % DAY === DAWN) {
          for (const id of active.keys()) if ((heldUntil.get(id) ?? -Infinity) <= tick) active.delete(id);
        }
        tick += 60;
      }
      // Public acts win over a simultaneous routine tick, including dawn.
      // Collect the whole published minute before staging it, so public rows at
      // that minute follow its meets. No row is written ahead of this cursor.
      while (cursor < frames.length && revealAt(frames[cursor]) === next) apply(frames[cursor++], next);
      if (closing?.end === next) {
        const plan = closing; closing = null; closed.add(plan.night);
        const positions = new Map(plan.movements.map(row => [row.agent, row]));
        const waiting = new Set(pending.filter(job => job.afterShow).flatMap(job => job.ids));
        for (const id of waiting) {
          const last = positions.get(id), agent = agentOf(id);
          if (!last || !agent) throw new Error(`missing show-close place for ${id}`);
          active.delete(id);
          put(agent, next, { place: last.place, act: 'hang', role: 'hang', afterShow: true },
            { kind: 'show-close', night: plan.night });
          heldUntil.set(id, Math.max(next, last.arrival));
        }
      }
      flush(next);
      // Already published jobs own this interval before ambient life chooses a trip.
      if (routineTick) for (const agent of agents()) if (!active.has(agent.id)) normal(agent, next);
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
  // The complete routine day includes its night tail. Explicit asOf callers
  // still get only that public prefix; continuity can enumerate every boundary.
  function day(day, asOf = (day + 1) * DAY + DAWN) {
    if (!Number.isInteger(day) || day < 0) throw new RangeError('routine day must be a nonnegative integer');
    ensure(asOf);
    const start = day * DAY + DAWN, end = asOf;
    const entries = [...rows.values()].flatMap(list => {
      const first = lastAt(list, start);
      return [...(first && first.minute < start ? [{ ...first, minute: start }] : []),
        ...list.filter(row => row.minute >= start && row.minute <= end)];
    }).filter(row => row.minute <= end).sort((a, b) => a.minute - b.minute || (a.agent < b.agent ? -1 : a.agent > b.agent ? 1 : 0));
    return { day, asOf: end, entries, meetings: meetings.filter(c => c.minute >= start && c.minute <= end),
      acts: acts.filter(c => c.departure >= start && c.departure <= end),
      bubbles: bubbles.filter(c => c.minute >= start && c.minute <= end) };
  }
  return Object.freeze({ at, day,
    afterShow(minute) { return at(minute).filter(row => row.afterShow); },
    waitingAfterShow(minute) {
      ensure(minute);
      return waitingShows.filter(window => window.start <= minute && minute < window.end).flatMap(window => window.ids);
    },
  });
}
