import { CORNERS, DROPS, DISTRICTS, SITES, ROUTES, placeIn } from './places.js';
import { addressesFor, idHash } from './addresses.js';
import { SHOW_MINUTES, showMinute } from './player.js';
import { finaleTiming } from './staging.js';

// Input is sim.record() / player.snapshot(), never sim.events()' compatibility t.
// It must already be presented at or before minute. A future snapshot cannot be
// rewound from its latest board/event forms: reject it instead of guessing history.
export function publicAt(snapshot, minute = snapshot.minute) {
  if (!Number.isFinite(minute) || minute < 0) throw new RangeError('placement minute must be nonnegative and finite');
  if (snapshot.minute > minute || snapshot.frame?.minute > minute
    || (snapshot.frame?.step.kind === 'night' && showMinute(snapshot.day) > minute)
    || (snapshot.events || []).some(e => e.minute > minute)) throw new Error('placement needs a snapshot at or before the requested minute');
  return (snapshot.events || []).filter(e => e.minute <= minute);
}

const owns = (table, id) => table && Object.hasOwn(table, id);
const showFor = (events, night) => events.find(e => e.type === 'show' && e.night === night);
// The revealed plan's end survives after the active show becomes null. A plain
// record snapshot has no plan and retains C1-3's compatibility window.
const showEnd = (snapshot, night) => snapshot.reveal?.night === night
  ? snapshot.reveal.end ?? showMinute(night) + SHOW_MINUTES : showMinute(night) + SHOW_MINUTES;
function duringShow(snapshot, minute, events) {
  const night = snapshot.reveal?.night;
  if (night == null || minute < showMinute(night) || minute >= showEnd(snapshot, night)) return null;
  return showFor(events, night) ?? null;
}
const location = (place, reason, source) => ({ reason, corePlace: place.corePlace, cityPlace: place.cityPlace,
  district: place.district, lot: null, standPlace: place.standPlace, source });
function atHome(address, source) {
  return { reason: 'home', corePlace: 'home', cityPlace: address.home, district: 'suburbs', lot: address.lot, standPlace: null, source };
}
function rest(agent, book, source) {
  return agent.evicted ? location(SITES.heap, 'heap', source) : atHome(book[agent.id], source);
}

const absent = (reason, source) => ({ reason, corePlace: null, cityPlace: null,
  district: null, lot: null, standPlace: null, source });
const boardedAtFinale = (events, id) => events.some(e => e.type === 'board' && e.day === 14 && e.agent === id);
const arrestedAtFinale = (events, id) => events.some(e => e.type === 'arrest' && e.night === 14 && e.agent === id);
function finaleTarget(snapshot, minute, events, show, agent, book, fallback) {
  const timing = finaleTiming(snapshot.show?.start ?? snapshot.reveal?.start ?? showMinute(14), showEnd(snapshot, 14));
  const from = { kind: 'show', eventId: show.id, night: 14 };
  if (minute >= timing.leave.start && (agent.boarded || boardedAtFinale(events, agent.id))) return absent('departed', from);
  // Staged arrest forms publish at escort's end, while the board is still held.
  // planShow's construction snapshot has no active plan; its inputs are anchors.
  if (snapshot.reveal?.end !== undefined && arrestedAtFinale(events, agent.id)) return location(SITES.jail, 'jail', from);
  if (!owns(show.seen, agent.id)) return fallback;
  const scene = snapshot.show?.active.find(s => s.start <= minute && minute < s.end && s.publicActors.includes(agent.id));
  if (scene) return { ...location(scene.place, scene.place.cityPlace === 'jail' ? 'jail'
    : scene.place.cityPlace === 'docks' ? 'docks' : 'site', from), lot: scene.place.lot };
  if (minute >= timing.missed.end && events.some(e => e.type === 'missed' && e.day === 14 && e.agent === agent.id)) return rest(agent, book, from);
  if (minute >= timing.boarding.start) return location(SITES.ferry, 'docks', from);
  const fight = snapshot.reveal?.end !== undefined && fightsAt(snapshot, 14).findLast(f => f.defence.ids.includes(agent.id) || f.sides.some(s => s.ids.includes(agent.id)));
  if (fight) return { ...location(fight, 'site', from), lot: fight.lot };
  const play = show.plays?.[agent.id], route = show.seen[agent.id];
  return ['board', 'back'].includes(play?.kind) && owns(ROUTES, route)
    ? location(ROUTES[route], 'district', from) : fallback;
}

function playLocation(play, agent, book, source) {
  if (play.kind === 'hit' || play.kind === 'breakin') return null;
  if (play.kind === 'deal') return location(placeIn(CORNERS, play.corner), 'corner', source);
  if (play.kind === 'run') return location(placeIn(DROPS, play.place), 'site', source);
  if (play.kind === 'laylow' || play.kind === 'build' || (play.kind === 'cook' && ['home', 'suburbs'].includes(play.place))) return rest(agent, book, source);
  if (play.kind === 'cook' && play.place === 'forest') {
    const labs = ['lab-north', 'lab-west', 'lab-south'];
    return location(SITES[labs[idHash(agent.id) % labs.length]], 'site', source);
  }
  if (play.kind === 'grab') return location(SITES.crate, 'docks', source);
  if (play.kind === 'guard' || play.kind === 'vault') return location(SITES.vault, 'site', source);
  if (play.kind === 'board') return location(placeIn(ROUTES, play.place), 'district', source);
  // Backers use their own PUBLIC place, never chase target/accept/private play.
  if (play.place === 'home') return rest(agent, book, source);
  return location(placeIn(DISTRICTS, play.place), 'district', source);
}

// One row per roster id, in roster order. hidden rows only remove a real walker;
// scenes get anonymous stand-ins from fightsAt, never the missing roster ids.
// {agent, reason, corePlace, cityPlace, district, lot, standPlace, home, source}
// reason: home|corner|district|site|jail|docks|heap|hidden|departed.
// hidden and departed have null locations and permit no visible walker.
// departed means off the island, including after close and day 15's mint.
// Pass C1-4's createRoutinePlanner(frames) as the third argument for daytime
// routines, including historical board changes. It uses this same playhead.
export function targetsAt(snapshot, minute = snapshot.minute, routinePlanner = null) {
  const events = publicAt(snapshot, minute), agents = snapshot.board?.agents || [];
  const book = addressesFor(agents.map(a => a.id)), show = duringShow(snapshot, minute, events);
  const daytime = minute % 1440 >= 360 && minute < showEnd(snapshot, Math.floor(minute / 1440));
  const routine = routinePlanner && !show && daytime ? new Map(routinePlanner.at(minute).map(row => [row.agent, row])) : null;
  return agents.map(agent => {
    const source = { kind: 'board', frame: snapshot.frame?.i ?? null };
    let target;
    if (agent.jailed) target = location(SITES.jail, 'jail', source);
    else if (minute >= showEnd(snapshot, 14) && arrestedAtFinale(events, agent.id)) target = location(SITES.jail, 'jail', { kind: 'after-show' });
    else if (!show && (agent.boarded || (minute >= showEnd(snapshot, 14) && boardedAtFinale(events, agent.id)))) target = absent('departed', { kind: 'after-show' });
    else if (!show && minute >= showEnd(snapshot, 14) && events.some(e => e.type === 'missed' && e.day === 14 && e.agent === agent.id)) target = rest(agent, book, { kind: 'after-show' });
    else if (minute < 1440) target = location(SITES.docks, 'docks', { kind: 'arrival' });
    else if (show) {
      const from = { kind: 'show', eventId: show.id, night: show.night };
      // Absence from seen is deliberately not a claim about which attack it made.
      // In particular do not attach a place, target id, or delayed play to this row.
      if (!owns(show.seen, agent.id)) target = { reason: 'hidden', corePlace: null, cityPlace: null, district: null, lot: null, standPlace: null, source: from };
      else if (show.seen[agent.id] === 'home') target = rest(agent, book, from);
      else if (owns(show.plays, agent.id)) target = playLocation(show.plays[agent.id], agent, book, from);
      if (!target) target = show.seen[agent.id] === 'home' ? rest(agent, book, from)
        : location(placeIn(DISTRICTS, show.seen[agent.id]), 'district', from);
      if (show.night === 14) target = finaleTarget(snapshot, minute, events, show, agent, book, target);
    } else if (daytime) {
      if (routine) {
        const row = routine.get(agent.id);
        if (!row || row.minute > minute) throw new Error(`missing public routine for ${agent.id}`);
        target = { ...location(row.place, row.place.corePlace === 'home' ? 'home'
          : row.place.corePlace === 'heap' ? 'heap' : Object.hasOwn(CORNERS, row.place.corePlace) ? 'corner' : 'site', row.source),
        lot: row.place.lot, act: row.act, role: row.role, walk: row.walk, loopSeed: row.loopSeed,
        ...(row.meet !== undefined ? { meet: row.meet, cut: row.cut, scenePlace: row.scenePlace } : {}) };
      } else {
        const corner = snapshot.board.corners?.find(c => c.holder === agent.id);
        target = agent.evicted ? rest(agent, book, source) : corner ? location(placeIn(CORNERS, corner.corner), 'corner', source) : rest(agent, book, source);
      }
    } else target = rest(agent, book, { kind: 'after-show' });
    return { agent: agent.id, ...target, home: book[agent.id].home };
  });
}

// Placement uses the public victim/location only, never an attacking id, even
// when an older night's private play has subsequently become public.
export function fightsAt(snapshot, night) {
  const events = publicAt(snapshot), show = showFor(events, night);
  if (!show || snapshot.minute < showMinute(night)) return [];
  const book = addressesFor((snapshot.board?.agents || []).map(a => a.id));
  return events.filter(e => e.type === 'fight' && e.night === night).map(e => {
    const arrest = events.find(a => a.type === 'arrest' && a.night === night && a.why === 'collar' && a.agent === e.target);
    let place;
    if (e.kind === 'breakin' || (e.kind === 'collar' && show.seen?.[e.target] === 'home')) {
      if (!owns(book, e.target)) throw new Error(`fight ${e.id} has no public target address`);
      place = atHome(book[e.target], { kind: 'fight', eventId: e.id });
    } else {
      const at = e.kind === 'grab' ? SITES.crate : e.kind === 'vault' ? SITES.vault
        : e.corner ? placeIn(CORNERS, e.corner) : placeIn(DISTRICTS, arrest?.place ?? e.place);
      place = location(at, e.kind === 'grab' ? 'docks' : e.corner ? 'corner' : 'district', { kind: 'fight', eventId: e.id });
    }
    const hooded = e.kind === 'hit' || e.kind === 'breakin';
    // The present feed names no attacking-side members. Preserve its size and
    // strength rather than reverse-engineering groups from plays or omissions.
    const sides = (e.sides || []).map(s => ({ ids: [], count: s.size, hooded: hooded ? s.size : 0, strength: s.strength }));
    // A successful collar's arrest explicitly names its Cop; nobody else is inferred.
    if (!hooded && arrest?.by && sides.length === 1) sides[0].ids = [arrest.by];
    return { eventId: e.id, night, kind: e.kind, target: e.target ?? null, ...place,
      sides, defence: { ids: owns(book, e.target) ? [e.target] : [], strength: e.defence },
      cops: e.cops, patrol: e.patrol ?? null, guard: e.guard ?? null };
  });
}
