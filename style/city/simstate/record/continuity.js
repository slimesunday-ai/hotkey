// C2 · THE DRAWING'S CONTINUITY (GAME.md §41, slime 10-30: "no one wants to watch people drop off screen... you lost the continuity of
// following an agent"). Node-safe, as trips.js is: draw.js draws from it and tools/continuitycheck.mjs --drawing reads the same decision,
// so the check never restates the drawing's rule beside it. Nothing here decides a game fact: places are placement.js's, scene order,
// departures and arrivals show-plan.js's (plan.movements), routes and trip times trips.js's.
//   timeline   each agent's place, minute by minute, is piecewise constant: it can only change at a frame's reveal, a show's start or
//              end, a scene's or a beat's boundary, a plan movement's minute, 06:00 or a routine entry's start. The record is walked once,
//              in order, on a second player over the same frames; each entry is computed from the snapshot AT its own minute (a prefix:
//              never a later frame), so what is drawn at minute m depends only on frames up to m. Seeking there equals playing there.
//   trips      an agent whose place changed at minute c leaves the place it was drawn at, at c, on the trip trips.js books (on foot when
//              the plan's movement row says walk), and is drawn on it to its arrival: no deadline cuts it short. The plan holds its scenes
//              for their people and the routines hold a traveller until it arrives, so a trip ends before the agent's place changes
//              again (its deadline). One that would not is a cut, and the check counts it.
//   jail       a trip to Iron Island is the cruiser's ride (stage/record.js drives it); jail to jail is no trip.
import { targetsAt, fightsAt } from './placement.js';
import { createShowPlayer, createShowPlanner } from './show-plan.js';
import { showMinute, revealAt, SHOW_MINUTES } from './player.js';
import { SITES } from './places.js';
import { idHash } from './addresses.js';

export const ORIGIN = SITES.docks.standPlace;
export const HOME = 'home:';
export const placeOf = t => t.reason === 'home' ? HOME + t.cityPlace : t.standPlace ?? t.cityPlace;
export const travelId = p => p.startsWith(HOME) ? p.slice(HOME.length) : p;
const keyOf = t => t.reason === 'hidden' || t.reason === 'departed' ? t.reason : `${placeOf(t)}|${t.reason === 'jail' ? 'jail' : ''}`;
// (a plan's place, as the timeline names it)
const planPlace = p => p.corePlace === 'home' ? HOME + p.cityPlace : p.standPlace ?? p.cityPlace;

// The season's places, in island-minute order, from prefixes only. → { segs: Map(agent → [{ start, t, more? }]), from, to, cands }
// Walked on the staged show player (show-plan.js), as the page plays it: each show ends at its plan's end, and its results reach the
// board as their scenes pay off. A won collar's target stays at the arrest's place until the show closes, when jail takes it.
export function buildTimeline(frames, routines, planner = createShowPlanner(frames)) {
  const days = [...new Set(frames.map(f => f.day))], C = new Set(frames.map(revealAt));
  const nights = frames.filter(f => f.step.kind === 'night').map(f => f.day), ends = new Map();
  for (const n of nights) {
    const plan = planner.night(n); ends.set(n, plan.end);
    for (const k of [0, SHOW_MINUTES]) C.add(showMinute(n) + k); C.add(plan.end);
    for (const sc of plan.scenes) { C.add(sc.start); C.add(sc.end); for (const b of sc.beats || []) { C.add(b.start); C.add(b.end); } }
    // (C2: a movement's minute is a place change too: the plan's departures, each its own segment start)
    for (const mv of plan.movements ?? []) C.add(mv.minute);
  }
  for (const d of days) { C.add(d * 1440 + 360); C.add(d * 1440 + 1280); for (const e of routines.day(d).entries) C.add(e.minute); }
  const from = frames[0].minute, to = Math.max(...frames.map(revealAt)), cands = [...C].filter(m => m >= from && m <= to).sort((a, b) => a - b);
  const probe = createShowPlayer(frames, { speed: 60 }), segs = new Map();
  probe.seek(from); probe.play();
  for (const m of cands) {
    if (m > probe.minute) probe.advance(m - probe.minute);
    const snap = { ...probe.snapshot(), minute: m }, rows = targetsAt(snap, m, routines);
    const night = snap.reveal?.night, inShow = night != null && m >= showMinute(night) && m < (ends.get(night) ?? showMinute(night) + SHOW_MINUTES);
    const held = new Map();
    if (inShow) for (const f of fightsAt(snap, night)) if (f.kind === 'collar' && f.target && snap.board.agents.find(a => a.id === f.target)?.jailed) held.set(f.target, f);
    for (const t0 of rows) {
      const f = held.get(t0.agent), t = f ? { ...t0, reason: f.lot ? 'home' : 'district', cityPlace: f.cityPlace, standPlace: f.standPlace, lot: f.lot, district: f.district, arrest: f.eventId } : t0;
      const list = segs.get(t.agent) || segs.set(t.agent, []).get(t.agent), last = list.at(-1);
      if (!last || keyOf(last.t) !== keyOf(t)) list.push({ start: m, t });
      // (the same place, a new row: kept beside the segment's first, so minute m draws the row at or before m, never a later one)
      else (last.more ||= []).push({ start: m, t });
    }
  }
  return { segs, from, to, cands };
}

// THE TRIP RULE: segment i of agent id → null (no travel: the same place, hidden, departed, or the first place before anything), else
// { from, to, dep, walk, deadline, trip, jail, cut }. from: where it was drawn last (the docks before its first place, D9 (h): the ferry
// drops everyone there; they leave a few at a time over the first three minutes, by id); walk: the plan's movement row's; deadline:
// the start of its next segment; cut: the trip missing, or running past that deadline.
export function createTripRule({ timeline, planner, trips }) {
  const nights = new Set(), rows = new Map();
  for (const m of timeline.cands) { const n = Math.floor(m / 1440); if (!nights.has(n)) { nights.add(n); try { for (const r of planner.night(n).movements ?? []) rows.set(`${r.agent}|${r.minute}|${planPlace(r.place)}`, r); } catch {} } }
  const cache = new Map();
  function at(id, i) {
    const k = `${id}|${i}`; if (cache.has(k)) return cache.get(k);
    const list = timeline.segs.get(id) || [], cur = list[i], prev = list[i - 1];
    let out = null;
    if (cur && cur.t.reason !== 'hidden' && cur.t.reason !== 'departed') {
      const to = placeOf(cur.t), from = prev ? (prev.t.reason === 'hidden' || prev.t.reason === 'departed' ? null : placeOf(prev.t)) : ORIGIN;
      const jail = cur.t.reason === 'jail';
      if (from && from !== to && !(jail && prev?.t.reason === 'jail')) {
        const dep = cur.start + (i === 0 ? (idHash(id) % 30) / 10 : 0), deadline = list[i + 1]?.start ?? Infinity;
        const row = rows.get(`${id}|${cur.start}|${to}`), walk = !!row?.walk;
        const trip = trips.plan(id, travelId(from), travelId(to), dep, { walk });
        out = { from, to, dep, walk, deadline, trip, jail, cut: !trip || trip.arr > deadline + 1e-7 };
      }
    }
    cache.set(k, out); return out;
  }
  return { at };
}

// C2 · WHO WORE THE HOOD, scene by scene (GAME.md §41, slime 10-30: "you watch X mask up and do it, and the hood only fools people who
// aren't watching X"). show.masked {id: {place, home?, fight?}} says who (from 9:05; home is a break-in's doorstep); a hooded scene's stand-ins
// drop by the masked agents in it, who play it as themselves. Typed facts only, never a guess at who did what:
//   fight      the core's publication-local fight id equals its scene's eventId; never substitute another fight at the same place
//   one scene  a place (the doorstep, the district) whose masked agents fill the one hooded fight or prowl staged there, count for count
// A prowl (no fight id) keeps place/count matching. Arrest and ferry receipts
// also keep their named walker for the continuation; they aren't another masked play. → { byScene, byAgent, unresolved, masked }
export function maskedCast(frame, plan, book, districts) {
  const show = frame.events.find(e => e.type === 'show' && e.night === frame.day), masked = show?.masked ?? {};
  const byScene = new Map(), byAgent = new Map(), unresolved = [];
  const cast = (sc, id) => { if (byScene.get(sc.id)?.includes(id)) return; (byScene.get(sc.id) || byScene.set(sc.id, []).get(sc.id)).push(id); (byAgent.get(id) || byAgent.set(id, []).get(id)).push(sc.id); };
  const ids = Object.keys(masked).sort();
  if (!ids.length) return { byScene, byAgent, unresolved, masked };
  const keyOfMask = at => at.home && book[at.home] ? HOME + book[at.home].home : planPlace(districts[at.place]);
  const receipts = new Map(frame.events.filter(e => ['arrest', 'board', 'missed'].includes(e.type)).map(e => [e.id, e]));
  const hooded = plan.scenes.filter(s => s.hoodedCount > 0), rest = hooded.filter(sc => sc.beat === 'fight' || sc.kind === 'hooded');
  for (const id of ids) {
    if (masked[id].fight == null) continue;
    const scs = plan.scenes.filter(sc => sc.beat === 'fight' && sc.eventId === masked[id].fight);
    if (scs.length === 1) cast(scs[0], id);
    else unresolved.push({ id, place: keyOfMask(masked[id]), scenes: scs.map(sc => sc.id) });
  }
  const at = new Map(); for (const id of ids.filter(id => masked[id].fight == null)) { const k = keyOfMask(masked[id]); (at.get(k) || at.set(k, []).get(k)).push(id); }
  for (const [k, group] of at) {
    const scs = rest.filter(sc => planPlace(sc.place) === k && !byScene.has(sc.id));
    if (scs.length === 1 && scs[0].hoodedCount === group.length) { for (const id of group) cast(scs[0], id); continue; }
    for (const id of group) {
      const named = hooded.filter(sc => !sc.publicActors.includes(id) && [sc.eventId, ...(sc.revealIds ?? [])].some(eid => receipts.get(eid)?.agent === id));
      if (named.length === 1) cast(named[0], id);
      else unresolved.push({ id, place: k, scenes: scs.map(sc => sc.id) });
    }
  }
  // Receipt scenes must still borrow the same walker for cuffs and boarding.
  // They never choose which fight or prowl the masked agent plays.
  for (const sc of hooded.filter(sc => sc.beat !== 'fight' && sc.kind !== 'hooded')) {
    const named = [sc.eventId, ...(sc.revealIds ?? [])].map(id => receipts.get(id)).filter(e => e && Object.hasOwn(masked, e.agent) && !sc.publicActors.includes(e.agent));
    for (const id of new Set(named.map(e => e.agent))) cast(sc, id);
  }
  return { byScene, byAgent, unresolved, masked };
}

// THE HOOD, ON AND OFF: a masked agent's hood goes on once it stands at its play's place (its trip there arrived, MASK_UP island minutes
// for the mask-up a follower sees, stage/record.js) and comes off once it is out of the play: MASK_OFF after it leaves for its next
// place when the show is over (home, the Heap) or the cruiser's ride. → Map(id → { night, place, arrive, on, off })
export const MASK_UP = .04, MASK_OFF = .12;
export function maskWindows(timeline, rule, plan, cast, book, districts) {
  const out = new Map();
  for (const [id, at] of Object.entries(cast.masked)) {
    const key = at.home && book[at.home] ? HOME + book[at.home].home : planPlace(districts[at.place]), list = timeline.segs.get(id) || [];
    const i = list.findIndex(s => s.start >= plan.start && s.start < plan.end && placeOf(s.t) === key); if (i < 0) continue;
    const arrive = rule.at(id, i)?.trip?.arr ?? list[i].start;
    const j = list.findIndex((s, k) => k > i && (s.start >= plan.end || s.t.reason === 'jail' || s.t.reason === 'departed'));
    out.set(id, { night: plan.night, place: key, arrive, on: arrive + MASK_UP, off: j < 0 ? Infinity : list[j].start + MASK_OFF });
  }
  return out;
}
// A RIDE TO IRON ISLAND (a jail segment's trip, createTripRule): from its start the arrested walks cuffed to the cruiser and gets in
// (BOARD), then rides, out of sight in it, to the ride's arrival. → the minute it is in the car
export const rideBoarded = ride => ride.dep + Math.min(.25, (ride.arr - ride.dep) * .3);

// C2-seek · WHERE EACH AGENT IS DRAWN AT MINUTE m, as draw.js draws it (moved here from draw.js so the stand plan and its check read the
// drawing's own decision, node-safe). scenes: () → the stage's record scenes (stage/record.js: venue, actSpot, rideIn) or null (no stage,
// node): a sit-down then stands at its place, an act at its place, a ride's boarding at rideBoarded
export function createStateAt({ frames, timeline: TL, rule, meetings, scenes = () => null }) {
  const S = scenes, opening = frames[0].minute;
  // ── where each agent is drawn at minute m (and which row: a segment's later rows at the same place, at or before m)
  const rowAt = (seg, m) => { let t = seg.t; if (seg.more) for (const r of seg.more) { if (r.start > m) break; t = r.t; } return t; };
  // (C1-9b: the row's start, for the loops on the island's clock: the first minute of this run of the segment's rows with its seed)
  const anchorAt = (seg, m) => { let a = seg.start, k = seg.t.loopSeed; if (seg.more) for (const r of seg.more) { if (r.start > m) break; if (r.t.loopSeed !== k) { a = r.start; k = r.t.loopSeed; } } return a; };
  // (C1-9b: before the setup frame nobody is on the island yet: the roster's ids are known, nothing of the setup is drawn)
  function stateAt(id, m) {
    if (m < opening) return { id, hidden: true, t: null, next: opening };
    const list = TL.segs.get(id) || [];
    let i = -1; for (let lo = 0, hi = list.length - 1; lo <= hi;) { const mid = (lo + hi) >> 1; if (list[mid].start <= m) { i = mid; lo = mid + 1; } else hi = mid - 1; }
    if (i < 0) return { id, place: ORIGIN, t: null, next: list[0]?.start ?? Infinity };
    const cur = list[i], prev = list[i - 1], next = list[i + 1]?.start ?? Infinity, t = rowAt(cur, m), seed = cur.start, anchor = anchorAt(cur, m);
    // (off the ferry: they leave the docks a few at a time over the first three minutes, by id, not all from one point at once)
    const dep = cur.start + (i === 0 ? (idHash(id) % 30) / 10 : 0);
    if (m < dep) return { id, place: ORIGIN, t: null, next: dep };
    // (C1-7d: departed, aboard the SECOND CHANCE from its leave beat, through day 15 — no walker, no bubble, nothing of it on the island)
    if (t.reason === 'hidden' || t.reason === 'departed') return { id, hidden: true, departed: t.reason === 'departed', t, next };
    // (C1-7: a sit-down's pair at its venue, stage/record.js venue(): its own two spots, a booth, a car's doorway or the garage's roof;
    // C2: an act's own marks, a hand-over's pair face to face or the fence's shelf, stage/record.js actSpot())
    const vk = t.role === 'meet' && t.meet != null && t.reason !== 'jail' ? S()?.venue?.(meetings.get(t.meet)) ?? null : t.live && t.errand !== undefined ? S()?.actSpot?.(t) ?? null : null;
    const place = vk ?? placeOf(t), base = { id, place, t, next, jail: t.reason === 'jail', seed, anchor };
    // (C2: the trip rule's decision, continuity.js: from where it was drawn, on the plan's trip, to its arrival; nothing cuts it short)
    const d = rule.at(id, i);
    if (!d) return base;
    // (C2 · a ride to Iron Island: it stays at the arrest's place, the stage's to walk cuffed to the cruiser and drive (stage/record.js
    // ride), until the ride's booked arrival, when the yard takes it)
    if (d.jail && d.trip && m < d.trip.arr) {
      const ride = { id, from: d.from, dep: d.dep, arr: d.trip.arr, trip: d.trip }, inCar = S()?.rideIn?.(id) ?? rideBoarded(ride);
      return m < inCar ? { ...base, place: d.from, jail: false, ride, next: Math.min(next, inCar) } : { id, hidden: true, riding: true, ride, t, next: Math.min(next, ride.arr) };
    }
    if (d.jail) return base;
    const trip = d.trip;
    // (C1-9b: arrived by its trip: where the trip ended, so a seek places it on the spot the walk off the trip claims, agents.js)
    const end = trip && m >= trip.arr ? trip.legs.at(-1)?.path?.at(-1) : null;
    if (!trip || m >= trip.arr) return { ...base, cutFrom: trip ? null : true, arrive: end ? [end[0], 0, end[1]] : null, since: trip ? trip.arr : cur.start };
    return { ...base, trip, next: Math.min(next, trip.arr) };
  }
  return stateAt;
}
