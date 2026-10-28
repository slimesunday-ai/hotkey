// C1-3, the drawn half · THE RECORD'S AGENTS IN THE CITY. Every roster agent is a walker (agents.js, the live path's own walkers,
// trips drawn by movement.js) at the place placement.js gives it (targetsAt, with C1-4's routine planner by day), travelling between
// places on the city's own travel (trips.js) at the clock C1-2 sets. Nothing here decides a game fact or reads event text.
//   timeline   each agent's place, minute by minute, is piecewise constant: it can only change at a frame's reveal, a show's start or
//              end, 06:00 or a routine entry's start. At load the record is walked once, in order, on a second player over the same
//              frames; each entry is computed from the snapshot AT its own minute (a prefix: never a later frame), so what is drawn at
//              minute m depends only on frames up to m. Seeking there equals playing there.
//   trips      an agent whose place changed at minute c leaves its last place at c on the trip trips.js books. A trip that can't make
//              its deadline cuts to the arrival (GAME.md §20): the show's trips by 9:10 p.m. (SETTLE), any other within MAX_TRIP.
//              A meeting's arrival is a cut (ROUTINES.md). Jail is a cut (the cruiser takes them); so is the hooded's return home.
//   day 0      the record starts at day 1, 06:00; before an agent's first place it was at the docks (D9 (h): the ferry drops everyone
//              there), so the season opens with everyone leaving the docks.
//   the show   a hooded agent (absent from show.seen) is not drawn during the show (D9 (c)). C1-6: the running order is show-plan.js's
//              (the page's player is createShowPlayer: results reach the store as their scenes pay off, the board at the close). Inside
//              its own play's window an agent plays its play (loops.js SHOW_LOOPS); a show trip still running at the first scene that
//              names it (a back's group: the group's first) cuts to its arrival, placed outright; stage/record.js stages the rest.
import world from '../../../../world/export/world.json' with { type: 'json' };
import stands from '../stands.json' with { type: 'json' };
import { createSimLayer } from '../layer.js';
import { createAgents } from '../agents.js';
import { createLooks } from '../looks.js';
import { targetsAt, fightsAt } from './placement.js';
import { createRoutinePlanner } from './routines.js';
import { showMinute, revealAt, SHOW_MINUTES } from './player.js';
import { createShowPlayer, createShowPlanner } from './show-plan.js';
import { SITES } from './places.js';
import { addressesFor, idHash } from './addresses.js';
import { createTrips } from './trips.js';
import { createLoops, walkClipOf } from './loops.js';
import { createBubbles } from './bubbles.js';
import { CITY_PLACES, HOUSE_LOTS } from './places.js';

import { SETTLE, ARREST_END, MAX_TRIP } from './timing.js';
export { SETTLE, ARREST_END, MAX_TRIP };
const ORIGIN = SITES.docks.standPlace;
const HOME = 'home:';
const placeOf = t => t.reason === 'home' ? HOME + t.cityPlace : t.standPlace ?? t.cityPlace;
const travelId = p => p.startsWith(HOME) ? p.slice(HOME.length) : p;
const keyOf = t => t.reason === 'hidden' || t.reason === 'departed' ? t.reason : `${placeOf(t)}|${t.reason === 'jail' ? 'jail' : ''}`;

// The season's places, in island-minute order, from prefixes only. → Map(agent → [{ start, t }])
// C1-6: walked on the staged show player (show-plan.js), as the page plays it: each show ends at its plan's end (3 minutes on a quiet
// night), when everyone goes home, and its results reach the board as their scenes pay off
export function buildTimeline(frames, routines, planner = createShowPlanner(frames)) {
  const days = [...new Set(frames.map(f => f.day))], C = new Set(frames.map(revealAt));
  const nights = frames.filter(f => f.step.kind === 'night').map(f => f.day);
  // (C1-7d: and every scene's and beat's boundary of its plan: night 14's placement follows its active scene — the walk, a route fight or
  // a dock arrest, the boarding at the docks, the ferry's leave beat — so a place can change at any of them; SHOW.md "C1-7a2")
  for (const n of nights) { for (const k of [0, SETTLE, ARREST_END, SHOW_MINUTES]) C.add(showMinute(n) + k); const plan = planner.night(n); C.add(plan.end);
    for (const sc of plan.scenes) { C.add(sc.start); C.add(sc.end); for (const b of sc.beats || []) { C.add(b.start); C.add(b.end); } } }
  for (const d of days) { C.add(d * 1440 + 360); C.add(d * 1440 + 1280); for (const e of routines.day(d).entries) C.add(e.minute); }
  const from = frames[0].minute, to = Math.max(...frames.map(revealAt)), cands = [...C].filter(m => m >= from && m <= to).sort((a, b) => a - b);
  const probe = createShowPlayer(frames, { speed: 60 }), segs = new Map();
  probe.seek(from); probe.play();
  for (const m of cands) {
    if (m > probe.minute) probe.advance(m - probe.minute);
    const snap = { ...probe.snapshot(), minute: m }, rows = targetsAt(snap, m, routines);
    // a won collar: its target is staged at the arrest's place, then taken to Iron Island
    const night = snap.reveal?.night, inShow = night != null && m >= showMinute(night) && m < showMinute(night) + ARREST_END;
    const held = new Map();
    if (inShow) for (const f of fightsAt(snap, night)) if (f.kind === 'collar' && f.target && snap.board.agents.find(a => a.id === f.target)?.jailed) held.set(f.target, f);
    for (const t0 of rows) {
      const f = held.get(t0.agent), t = f ? { ...t0, reason: f.lot ? 'home' : 'district', cityPlace: f.cityPlace, standPlace: f.standPlace, lot: f.lot, district: f.district, arrest: f.eventId } : t0;
      const list = segs.get(t.agent) || segs.set(t.agent, []).get(t.agent), last = list.at(-1);
      if (!last || keyOf(last.t) !== keyOf(t) || (t.cut && !last.t.cut)) list.push({ start: m, t });
      // (the same place, a new row: kept beside the segment's first, so minute m draws the row at or before m, never a later one)
      else (last.more ||= []).push({ start: m, t: { ...t, ...(last.t.cut ? { cut: true } : {}) } });
    }
  }
  return { segs, from, to, cands };
}

export async function createRecordDraw({ Q, SHOT = false, NIGHT = false, scene, mats, camera, peds, ANCHORS, frames, player, cornerKits, isShown, log = () => {}, ferry = null }) {
  const layer = createSimLayer({ scene, mats, lib: (await import('../placeholders.js')), night: NIGHT, cornerKits, isShown, live: true, budgetMs: SHOT ? Infinity : 2 });
  const routines = createRoutinePlanner(frames), trips = createTrips(), t0 = performance.now(), planner = createShowPlanner(frames), TL = buildTimeline(frames, routines, planner);
  // C1-6 · the show's scenes by agent: its own play's window (the loops play it), and the first scene that names it, when a trip there
  // still running cuts to its arrival (GAME.md §20). A back's group arrives together: the earliest of the group's own windows
  // C1-7 · night 14's walk to the dock (SHOW.md "Finale and day 15"): a named walk row (the ambient board row, or kind walk) is the agent's
  // show trip, walked on foot from its home in Pleasantview to the row's place on its route (GAME.md §15 "walk from home to the dock").
  // It cuts to the arrival at the row's arrive beat, or sooner at the first other scene that names the agent (a back's group: the group's)
  const nightsOf = frames.filter(f => f.step.kind === 'night').map(f => f.day), plays = new Map(), firstAt = new Map(), bounds = new Set();
  // (C1-7d: a backer's ambient row on night 14 is its walk too, by its walk beat, SHOW.md "C1-7a2"; it walks as a walker, not with a group)
  const walks = new Map(), isWalk = sc => !!sc.route && (sc.kind === 'walk' || (sc.kind === 'board' && sc.beat === 'ambient') || (sc.kind === 'back' && sc.beats?.[0]?.name === 'walk'));
  for (const n of nightsOf) {
    const plan = planner.night(n), groups = new Map();
    for (const sc of plan.scenes) {
      const walk = isWalk(sc) && sc.publicActors.length === 1;
      if ((sc.beat === 'ambient' || walk) && sc.publicActors.length === 1) { const id = sc.publicActors[0]; (plays.get(id) || plays.set(id, []).get(id)).push(sc); bounds.add(sc.start); bounds.add(sc.end);
        if (sc.kind === 'back' && !walk) { const k = sc.place.standPlace ?? sc.place.cityPlace; (groups.get(k) || groups.set(k, []).get(k)).push(sc); } }
      if (walk) walks.set(`${sc.publicActors[0]}|${n}`, { sc, arrive: sc.beats?.find(b => b.name === 'arrive')?.start ?? sc.end });
      if (!isWalk(sc)) for (const id of sc.publicActors) { const k = `${id}|${n}`; firstAt.set(k, Math.min(firstAt.get(k) ?? Infinity, sc.start)); }
      bounds.add(sc.start); bounds.add(sc.end); for (const b of sc.beats || []) { bounds.add(b.start); bounds.add(b.end); }
    }
    for (const g of groups.values()) { const t = Math.min(...g.map(sc => sc.start)); for (const sc of g) firstAt.set(`${sc.publicActors[0]}|${n}`, Math.min(firstAt.get(`${sc.publicActors[0]}|${n}`), t)); }
    // (a walker's own walk row still begins its show: without another scene its trip cuts at the arrive beat)
    for (const [k, w] of walks) if (k.endsWith(`|${n}`)) firstAt.set(k, Math.min(firstAt.get(k) ?? Infinity, w.arrive));
    // (C1-7d: its trip cuts at the arrive beat or the agent's next scene after the walk's start; a walk after another scene of the
    // agent's — the vault's jobber running for the boat through Glasswall, GAME.md §15 — starts where that scene left it, not at home)
    for (const [k, w] of walks) { if (!k.endsWith(`|${n}`)) continue; const id = w.sc.publicActors[0], other = plan.scenes.filter(sc => sc !== w.sc && !isWalk(sc) && sc.publicActors.includes(id));
      w.before = other.some(sc => sc.start < w.sc.start); w.cut = Math.min(w.arrive, ...other.filter(sc => sc.start >= w.sc.start).map(sc => sc.start)); w.at = w.sc.place.standPlace ?? w.sc.place.cityPlace; }
  }
  // (C1-7d: each agent's scenes of a night, by start, but its walk: a trip that begins inside the show, after its first trips, runs on
  // the clock until the next of them and cuts to its arrival there — on night 14 the leg from its route to the docks, by its boarding)
  const ownScenes = new Map();
  for (const n of nightsOf) for (const sc of planner.night(n).scenes) if (!isWalk(sc)) for (const id of sc.publicActors) { const k = `${id}|${n}`; (ownScenes.get(k) || ownScenes.set(k, []).get(k)).push(sc.start); }
  for (const L of ownScenes.values()) L.sort((a, b) => a - b);
  const nextOwn = (id, n, m) => ownScenes.get(`${id}|${n}`)?.find(x => x >= m) ?? Infinity;
  // (C1-7: day 15's mint tail, when the record reaches its dawn)
  if (frames.some(f => f.day === 15 && f.step.kind === 'dawn')) { try { for (const sc of planner.day(15).scenes) { bounds.add(sc.start); bounds.add(sc.end); } } catch {} }
  // (C1-7d: the SECOND CHANCE, second-chance.js: alongside the docks from day 14's dawn frame, sailing in night 14's leave beat, then gone)
  const leaveBeat = nightsOf.includes(14) ? planner.night(14).scenes.find(sc => sc.kind === 'ferry')?.beats?.find(b => b.name === 'leave') ?? null : null;
  const boardFrom = nightsOf.includes(14) ? Math.min(...planner.night(14).scenes.filter(sc => sc.kind === 'board' && sc.beat === 'finale').map(sc => sc.start)) : Infinity;
  const dawn14 = frames.find(f => f.day === 14 && f.step.kind === 'dawn'), moorAt = dawn14 ? revealAt(dawn14) : 14 * 1440 + 360, FL = ferry ? await import('../../second-chance.js') : null;
  // (C1-9b: her mooring and sailing read only frames at or before the minute: moored from day 14's dawn frame, alongside until night
  // 14's frame is out and its leave beat comes; before that frame no leave beat is known, so she stays alongside, STAY)
  const night14 = frames.find(f => f.day === 14 && f.step.kind === 'night'), leaveFrom = night14 ? revealAt(night14) : Infinity, STAY = Object.freeze({ start: Infinity, end: Infinity });
  const sceneBounds = [...bounds].sort((a, b) => a - b), planEnd = new Map(nightsOf.map(n => [n, planner.night(n).end]));
  const playAt = (id, m) => plays.get(id)?.find(sc => sc.start <= m && m < sc.end) ?? null;
  log(`record: ${TL.cands.length} place changes over the season in ${(performance.now() - t0).toFixed(0)} ms`);
  const roster = frames[0].board.agents.map(a => a.id), book = addressesFor(roster);
  // home steps: each dealt house's doorstep (its door from the block's anchors, else the sidewalk in front of the lot)
  const homes = new Map(Object.values(book).map(b => [HOME + b.home, b]));
  const placesList = { places: [...world.places, ...[...homes].map(([id, b]) => ({ id, name: b.name, kind: 'home', dist: 'suburbs', x: b.x, z: b.z }))], lots: world.lots };
  // stand places at their measured spots, and room beside each (1 m either side) for a crowd larger than the spots
  const wide = { ...stands, places: Object.fromEntries(Object.entries(stands.places).map(([id, p]) => [id, { ...p, spots: [...p.spots, ...[1, -1].flatMap(s => p.spots.map(sp => {
    const ry = sp.ry ?? 0; return { ...sp, x: sp.x + Math.cos(ry) * s, z: sp.z - Math.sin(ry) * s, ax: sp.x, az: sp.z, kind: 'open', pace: undefined, beat: undefined, lean: undefined, sit: undefined, over: true };
  }))] }])) };
  let agents = null, looks = null, stage = null, scenes = null, bubbles = null, loops = null;
  // C1-4: the sit-downs by event id (the planner's cues; each is used only while a row names it) and every out-loud cue
  const days = [...new Set(frames.map(f => f.day))], meetings = new Map(), cues = [];
  for (const d of days) { const p = routines.day(d); for (const c of p.meetings) meetings.set(c.eventId, c); cues.push(...p.bubbles); }
  if (peds) {
    try { const CH = await import('../../cast.js'); looks = createLooks({ peds, CH, log: m => log('record: ' + m), worker: !SHOT }); } catch (e) { log('record: no agent looks (' + (e && e.message || e) + ')'); }
    // C1-4: every standing agent loops by its row's role (loops.js: seeded by loopSeed, within RANGE of its spot); ?life=0 turns them off
    agents = createAgents({ peds, places: placesList, stands: wide, doorOf: id => layer.homeAt(id)?.door || null, looks, log: m => log('record: ' + m), scene, clockNow: () => player.minute,
      // (C1-6: a loop step keeps out of a staged scene's figures' room, stage/record.js keepOut)
      // (C1-9b: on the island's clock, life.js `at`: a loop's phase is a function of the minute and its row, not of the frames' dt)
      life: Q.get('life') !== '0', lifeOpts: { ...(loops = createLoops({ meetings, A: null, now: () => player.minute })), at: () => player.minute * 60, keepOut: (x, z) => scenes?.keepOut(x, z) ?? false } });
    loops.bind(agents.map);
    peds.driver = agents.drive;
    player.attachClock(agents.clock);
  }
  // ── the doorsteps
  const homeSpot = new Map();
  function doorstep(id) {
    const b = homes.get(id), h = layer.homeAt(b.home), psim = peds?.sim;
    let x = b.x, z = b.z, ry = 0, real = false;
    if (h?.door) { x = h.door[0] + h.face[0] * 1.4; z = h.door[2] + h.face[1] * 1.4; ry = Math.atan2(h.face[0], h.face[1]); real = true; }
    else { const L = psim?.laneNear(b.x, b.z, 40); if (L) { const p = psim.where({ E: L.E, s: L.s }, [0, 0, 0, 0]), d = Math.hypot(p[0] - b.x, p[2] - b.z), k = d > 10 ? 10 / d : 1; x = b.x + (p[0] - b.x) * k; z = b.z + (p[2] - b.z) * k; ry = Math.atan2(p[0] - b.x, p[2] - b.z); } }
    const L = psim?.laneNear(x, z, 30), lane = L && L.E.len > 2.6 ? { E: L.E, s: Math.max(1.3, Math.min(L.E.len - 1.3, L.s)) } : null;
    return { x, y: 0.2, z, ry, k: 0, place: id, taken: null, kind: 'open', lane, real };
  }
  function ensureHome(id) {
    if (!agents || !homes.has(id)) return;
    const cur = agents.spots.get(id)?.[0];
    if (cur && (cur.real || cur.taken)) return;
    const sp = doorstep(id); if (cur?.taken) return; agents.spots.set(id, [sp]); homeSpot.set(id, sp);
  }
  { const add = layer.addAnchors; layer.addAnchors = (k, a) => { add(k, a); for (const lot of Object.keys(a?.lots || {})) if (homes.has(HOME + lot)) ensureHome(HOME + lot); }; }
  for (const [k, a] of ANCHORS) layer.addAnchors(k, a);
  // ── where each agent is drawn at minute m (and which row: a segment's later rows at the same place, at or before m)
  const rowAt = (seg, m) => { let t = seg.t; if (seg.more) for (const r of seg.more) { if (r.start > m) break; t = r.t; } return t; };
  // (C1-9b: the row's start, for the loops on the island's clock: the first minute of this run of the segment's rows with its seed)
  const anchorAt = (seg, m) => { let a = seg.start, k = seg.t.loopSeed; if (seg.more) for (const r of seg.more) { if (r.start > m) break; if (r.t.loopSeed !== k) { a = r.start; k = r.t.loopSeed; } } return a; };
  // (C1-9b: before the setup frame nobody is on the island yet: the roster's ids are known, nothing of the setup is drawn)
  const opening = frames[0].minute;
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
    // (C1-7: a sit-down's pair at its venue, stage/record.js venue(): its own two spots, a booth, a car's doorway or the garage's roof)
    const vk = t.role === 'meet' && t.meet != null && t.reason !== 'jail' ? scenes?.venue?.(meetings.get(t.meet)) ?? null : null;
    const place = vk ?? placeOf(t), base = { id, place, t, next, jail: t.reason === 'jail', seed, anchor };
    // (C1-7d: the walk's segment: at its row's place, from the show's start to the row's end)
    const day = Math.floor(cur.start / 1440), isShow = cur.start % 1440 === showMinute(0), w0 = walks.get(`${id}|${day}`);
    const wk = w0 && cur.start >= showMinute(day) && cur.start < w0.sc.end && place === w0.at ? w0 : null, home = wk && !wk.before && book[id] ? HOME + book[id].home : null;
    const from = home && homes.has(home) ? home : prev ? (prev.t.reason === 'hidden' ? null : placeOf(prev.t)) : ORIGIN;
    if (base.jail || t.cut || !from || from === place) return base;
    const inShow = !isShow && cur.start > showMinute(day) && cur.start < (planEnd.get(day) ?? -Infinity), toDock = inShow && day === 14 && t.reason === 'docks';
    // (the walk on to the docks for the boarding: there within half a minute of boarding's start, to stand in the line, else cut there)
    const deadline = wk ? wk.cut : isShow ? Math.min(cur.start + SETTLE, firstAt.get(`${id}|${day}`) ?? Infinity) : inShow ? Math.min(cur.start + MAX_TRIP, nextOwn(id, day, cur.start), toDock ? boardFrom + .5 : Infinity) : cur.start + MAX_TRIP;
    const trip = trips.plan(id, travelId(from), travelId(place), dep, { walk: !!wk || toDock });
    // (C1-9b: arrived by its trip: where the trip ended, so a seek places it on the spot the walk off the trip claims, agents.js)
    const end = trip && m >= trip.arr ? trip.legs.at(-1)?.path?.at(-1) : null;
    if (!trip || m >= Math.min(trip.arr, deadline)) return { ...base, cutFrom: trip && m < trip.arr ? trip : null, toDock, arrive: end ? [end[0], 0, end[1]] : null, since: trip ? trip.arr : cur.start };
    return { ...base, trip, next: Math.min(next, trip.arr, deadline) };
  }
  let rows = [], next = -Infinity, seeked = true, lastMinute = null;
  const states = new Map(), lastScene = new Map();
  player.on((_, meta) => { if (meta.reset) seeked = true; });
  function rowOf(s) {
    if (s.hidden) return { id: s.id, status: 'hidden', at: null, trip: null };
    if (s.place.startsWith(HOME)) ensureHome(s.place);
    const t = s.t, act = t?.act ?? (t?.reason === 'corner' ? 'deal' : 'hang'), meet = t?.role === 'meet' ? t.meet ?? null : null, cue = meet != null ? meetings.get(meet) : null;
    // C1-6: inside its own play's window the agent plays its play (loops.js SHOW_LOOPS, seeded by the scene)
    const sc = s.trip ? null : playAt(s.id, s.m);
    if (sc) return { id: s.id, status: s.jail || scenes?.taken.has(s.id) ? 'jail' : 'active', at: s.place, trip: null, act, loopRole: 'show', show: { kind: sc.kind, variant: sc.variant ?? null, sceneId: sc.id, face: scenes?.faceOf(sc.id) ?? null, beats: sc.beats ?? null },
      loopSeed: idHash(sc.id), loopAnchor: sc.start, walk: t?.walk ?? null, walkClip: walkClipOf(t?.walk), meet: null, pairWith: null };
    // C1-4: the loops' inputs, all from the row (a show's rows have no role: a corner deals, the rest hang; seeded by id and segment)
    return { id: s.id, status: s.jail || scenes?.taken.has(s.id) ? 'jail' : 'active', at: s.trip ? null : s.place, trip: s.trip ?? null, act,
      loopRole: t?.role ?? (t?.reason === 'corner' ? 'deal' : 'hang'), loopSeed: t?.loopSeed ?? idHash(`${s.id}|${s.seed}`), loopAnchor: s.anchor ?? s.seed ?? null, walk: t?.walk ?? null, walkClip: walkClipOf(t?.walk),
      meet, pairWith: cue ? (cue.a === s.id ? cue.b : cue.a) : null, arrive: s.arrive ?? null };
  }
  function update(force = false) {
    if (!agents) return;
    bubbles?.frame();
    const m = player.minute, seek = seeked; seeked = false;
    if (FL) ferry.set(FL.poseAt(m, m >= leaveFrom ? leaveBeat : dawn14 ? STAY : null, moorAt));
    if (scenes?.frame()) force = true;
    if (!force && !seek && m < next && (lastMinute === null || m >= lastMinute)) { lastMinute = m; return; }
    const back = lastMinute !== null && m < lastMinute; lastMinute = m;
    scenes?.update(m, seek || back);
    next = TL.cands.find(c => c > m) ?? Infinity; rows = [];
    next = Math.min(next, sceneBounds.find(c => c > m) ?? Infinity);
    const snapIds = new Set(), restart = [];
    for (const id of roster) { const s = stateAt(id, m), was = states.get(id); s.m = m; states.set(id, s); next = Math.min(next, s.next);
      // (a show trip cut to its arrival: placed there outright, not hurried along the streets while its scene plays)
      // (C1-7d: and the walk on to the docks cut before it began — the first boarder, due on the gangway at boarding's start)
      if (s.cutFrom && !s.trip && (was?.trip || (s.toDock && was && was.place !== s.place))) snapIds.add(id);
      // (a meeting's arrival is a cut, ROUTINES.md: placed at the venue outright, not walked there through its one island minute)
      if (s.t?.cut && !s.trip && was && !was.hidden && was.place !== s.place) snapIds.add(id);
      const row = rowOf(s); rows.push(row);
      if ((row.show?.sceneId ?? null) !== (lastScene.get(id) ?? null)) { lastScene.set(id, row.show?.sceneId ?? null); restart.push(id);
        // (its scene begins and it is still walking the last stretch there, a late arrival: it cuts to the arrival, GAME.md §20)
        const a = agents.map.get(id); if (row.show && a && !(a.mode === 'stand' && !a.step)) snapIds.add(id); } }
    // (C1-9b: a seek places everyone in the order they came to where they are, as playing there claimed their spots: by arrival)
    const order = new Map([...states].map(([id, s]) => [id, s.since ?? s.seed ?? -Infinity]));
    if (seek || back) rows.sort((x, y) => (order.get(x.id) ?? -Infinity) - (order.get(y.id) ?? -Infinity) || (x.id < y.id ? -1 : 1));
    agents.setAgents(rows, seek || back ? { snap: 'all' } : snapIds.size ? { snapIds } : {});
    // (into or out of its scene: its loops start over at once, the scene's plan first)
    for (const id of restart) { const L = agents.map.get(id)?.life; if (L) { L.q = []; L.cur = null; L.wait = 0; L.settle = 0; } }
  }
  // ── what is drawn, for placecheck's checkDrawn: one row per roster agent from the walkers themselves
  function drawn() {
    const out = [];
    for (const id of roster) {
      const s = states.get(id), a = agents?.map.get(id);
      if (!s || s.hidden) { out.push({ agent: id, hidden: true }); continue; }
      if (!a?.w && !s.trip) continue;
      const home = s.place.startsWith(HOME) ? homes.get(s.place) : null;
      const row = { agent: id, cityPlace: home ? home.home : s.place.startsWith('venue:') ? placeOf(s.t) : s.place, lot: home ? home.lot : null, mode: a?.mode ?? null, trip: !!s.trip };
      // (C1-7d: a boarder the boarding line holds — queued on the quay, on the gangway or below — is on its way aboard, not at a stand
      // spot: its place's label only, as a walker on a trip)
      if (a?.w && a.mode === 'stand' && !scenes?.boarding?.(id)) { row.x = +a.w.p[0].toFixed(2); row.z = +a.w.p[2].toFixed(2); }
      out.push(row);
    }
    return out;
  }
  // ── C1-4: the out-loud bubbles, over the speaker's drawn walker (else its place's anchor)
  const anchorOf = c => { const p = c.place, lot = p?.corePlace === 'home' ? HOUSE_LOTS.find(l => l.id === p.cityPlace) : null, q = lot ?? CITY_PLACES[p?.standPlace] ?? CITY_PLACES[p?.cityPlace]; return q ? [q.x, 0, q.z] : null; };
  if (typeof document !== 'undefined') bubbles = createBubbles({ cues, player, camera, anchor: anchorOf, nameOf: id => frames[0].board.agents.find(a => a.id === id)?.name ?? id, gone: id => !!states.get(id)?.departed,
    where: id => { const a = agents?.map.get(id); return a?.w ? [a.w.p[0], a.w.p[1], a.w.p[2]] : null; } });
  const api = { layer, routines, trips, timeline: TL, update, drawn, stateAt, book, homes, meetings, bubbles, planner, playAt, get loops() { return loops; },
    get agents() { return agents; }, get looks() { return looks; }, get stage() { return stage; }, get scenes() { return scenes; },
    fights: () => scenes?.drawn() ?? [] };
  // ── the stage (vignettes, the arrest's cruiser) and the show's scenes
  if (agents && Q.get('stage') !== '0') {
    try {
      const [{ createStage }, { createScenes }] = await Promise.all([import('../../stage/index.js'), import('../../stage/record.js')]);
      // C1-9b · the stage on the record's clock: its scenes, their figures and the clips they play advance by the page's seconds while
      // the record plays and stand still while it is paused (a paused record is one picture); a seek moves nothing (the scenes start
      // over at the minute, their timers read from it, stage/record.js update and paid0)
      let stageSeek = true, stageDt = 0; player.on((_, meta) => { if (meta.reset) stageSeek = true; });
      stage = createStage({ scene, mats, peds, agents, layer, places: placesList, camera, night: NIGHT, log, storeEvents: false, clipProps: true, clipDt: () => stageDt });
      const drive = agents.drive; peds.driver = (t, dt, f, cam, R) => { drive(t, dt, f, cam, R); stageDt = stageSeek || !player.running ? 0 : dt; stageSeek = false; stage.frame(stageDt); };
      scenes = createScenes({ stage, scene, agents, layer, looks, player, planner, frames, book, homes, wide, meetings, night: NIGHT, log });
    } catch (e) { log('record stage: ' + (e && e.stack || e)); }
  }
  return api;
}
