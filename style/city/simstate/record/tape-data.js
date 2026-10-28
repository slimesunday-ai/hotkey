import { publicAt, fightsAt } from './placement.js';
import { createShowPlanner } from './show-plan.js';
import { showMinute } from './player.js';
import { CORNERS, DISTRICTS, SITES } from './places.js';

const DAY = 1440;
const subjects = (agent = null, others = []) => ({ agent, others: [...new Set(others.filter(Boolean))] });
const anchor = place => place ? Object.fromEntries(['corePlace', 'cityPlace', 'district', 'standPlace', 'lot']
  .map(key => [key, place[key] ?? null])) : null;
const district = id => anchor(DISTRICTS[id]);
const nightOf = event => event.card?.night ?? event.night ?? (event.type === 'board' ? event.day : undefined);
const markerKind = event => ({ show: 'show', fight: 'fight', arrest: 'arrest', turf: 'turf',
  buy: 'sale', season: 'ferry', board: 'ferry' })[event.type] ?? null;

// The supplied frames are the public feed, never the core log. Plans are asked
// for only after the matching show envelope is in the presented store. They
// read that night's frame and preceding boards, never a later frame.
export function createTapeReader(frames) {
  const planner = createShowPlanner(frames);
  function planAt(snapshot, night) {
    if (!snapshot.events.some(e => e.type === 'show' && e.night === night)) return null;
    const plan = planner.night(night);
    if (plan.frame > snapshot.frame.i || plan.start > snapshot.minute) throw new Error('tape plan is not public yet');
    return plan;
  }
  function cue(snapshot, event) {
    const plan = planAt(snapshot, nightOf(event));
    const scene = plan?.scenes.find(s => s.revealIds.includes(event.id));
    return { plan, scene, minute: scene?.end ?? (event.type === 'show' ? plan.start : event.minute) };
  }
  function marker(snapshot, event) {
    const kind = markerKind(event);
    if (!kind) return null;
    const { plan, scene, minute } = cue(snapshot, event);
    let place = null, people = subjects();
    if (event.type === 'fight') {
      place = anchor(fightsAt(snapshot, event.night).find(f => f.eventId === event.id));
      people = subjects(event.target);
    } else if (event.type === 'arrest') {
      place = anchor(scene?.place) ?? (event.why === 'dock' ? anchor(SITES.ferry) : district(event.place));
      const show = snapshot.events.find(e => e.type === 'show' && e.night === event.night);
      const visible = id => id && Object.hasOwn(show?.seen ?? {}, id) ? id : null;
      people = subjects(visible(event.agent), [visible(event.by)]);
    } else if (event.type === 'turf') {
      place = anchor(CORNERS[event.corner]); people = subjects(event.holder, [event.was]);
    } else if (event.type === 'buy') people = subjects(event.agent);
    else if (kind === 'ferry') {
      place = anchor(SITES.ferry); people = subjects(event.type === 'board' ? event.agent : null);
    }
    const replayScene = event.type === 'board' ? plan?.scenes.find(s => s.kind === 'board'
      && s.publicActors.includes(event.agent)) ?? scene : scene;
    return { id: event.id, minute, kind, place,
      replayStart: Math.max(plan?.start ?? 0, (replayScene?.start ?? minute) - .25), subjects: people };
  }
  function markersAt(snapshot) {
    // Feed-local ids retain first-publication order even when staging releases
    // several forms in a different beat order. Replacements retain their id.
    return publicAt(snapshot).map(e => marker(snapshot, e)).filter(Boolean).sort((a, b) => a.id - b.id);
  }
  function paperCardAt(snapshot, eventId) {
    const events = publicAt(snapshot), event = events.find(e => e.id === eventId);
    if (!event) return null;
    const marked = marker(snapshot, event);
    const card = event.card, night = nightOf(event), plan = planAt(snapshot, night);
    if (card && snapshot.minute < (night + 1) * DAY + 360) return null;
    const victim = card ? (['Took', 'Lost', 'Turned'].includes(card.kind)
      ? card.subjects.others[0] ?? null : card.subjects.agent) :
      event.type === 'robbed' ? event.agent : ['rob', 'burgle', 'fight'].includes(event.type)
        ? event.target : marked?.subjects.agent ?? null;
    const kind = card?.kind ?? event.type;
    const candidates = events.filter(e => e.type === 'fight' && e.night === night && e.target === victim
      && (card ? ['Took', 'Lost'].includes(card.kind) && ['hit', 'breakin'].includes(e.kind)
        : e.kind === (event.type === 'burgle' ? 'breakin' : event.type === 'rob' ? 'hit' : event.kind)));
    // A typed target can join a unique fight; an ambiguous/missing beat falls
    // back to the whole show rather than inventing which fight produced loot.
    const fight = candidates.length === 1 ? candidates[0] : null;
    const scene = fight && plan?.scenes.find(s => s.eventId === fight.id && s.beat === 'fight');
    const place = fight ? anchor(fightsAt(snapshot, night).find(f => f.eventId === fight.id))
      : marked?.place ?? district(card?.place ?? event.place);
    const people = card ? subjects(card.subjects.agent, card.subjects.others) : marked?.subjects ?? subjects(victim);
    if (!marked && !plan) return null;
    return { id: event.id, night: night ?? null, kind,
      minute: marked?.minute ?? scene?.end ?? plan.start, place,
      replayStart: scene ? Math.max(plan.start, scene.start - .25) : marked?.replayStart ?? plan.start,
      subjects: people, framing: { agent: victim, place } };
  }
  return Object.freeze({ markersAt, paperCardAt });
}

// Two explicit views: replay is sought to the old minute; disclosed is the
// presented viewing horizon. Seeking never silently upgrades the old store.
// Literal age AND actual feed disclosure are required, including the day-15
// exception. Public card identities never authorise an unmasking.
export function recordSideAt(replay, disclosed) {
  publicAt(replay); publicAt(disclosed);
  if (disclosed.minute < replay.minute) throw new RangeError('record horizon precedes replay');
  const result = { minute: replay.minute, asOf: disclosed.minute, events: [], names: [] };
  if (disclosed.minute - replay.minute <= DAY) return result;
  result.events = disclosed.events.filter(e => e.t === replay.frame?.t && e.minute <= disclosed.minute);
  const night = Math.floor(replay.minute / DAY);
  const show = replay.events.find(e => e.type === 'show' && e.night === night);
  if (!show || replay.minute < showMinute(night)) return result;
  const plays = disclosed.events.filter(e => e.type === 'play' && e.day === night);
  const roster = new Map((disclosed.board?.agents ?? []).map(a => [a.id, a.name]));
  for (const play of plays) {
    if (Object.hasOwn(show.seen, play.agent)) continue;
    const receipt = disclosed.events.find(e => e.type === 'robbed' && e.night === night && e.by === play.agent);
    result.names.push({ agent: play.agent, name: roster.get(play.agent) ?? null,
      play: Object.fromEntries(['kind', 'place', 'target', 'corner'].filter(k => Object.hasOwn(play, k)).map(k => [k, play[k]])),
      victim: ['hit', 'breakin'].includes(play.kind) ? play.target ?? receipt?.agent ?? null : receipt?.agent ?? null,
      source: { eventId: play.id, minute: play.minute, robbedId: receipt?.id ?? null } });
  }
  return result;
}
