// C1-3, the drawn half · THE RECORD'S AGENTS IN THE CITY. Every roster agent is a walker (agents.js, the live path's own walkers,
// trips drawn by movement.js) at the place placement.js gives it (targetsAt, with C1-4's routine planner by day), travelling between
// places on the city's own travel (trips.js) at the clock C1-2 sets. Nothing here decides a game fact or reads event text.
//   timeline   each agent's place, minute by minute, is piecewise constant (continuity.js buildTimeline, node-safe: continuitycheck
//              reads the same). Seeking there equals playing there.
//   trips      C2 (GAME.md §41, slime 10-30: "no one wants to watch people drop off screen"): an agent whose place changed at minute c
//              leaves where it was drawn at c, on the trip trips.js books (on foot where the plan's movement row says so), and is drawn
//              on it to its arrival (continuity.js createTripRule). No deadline cuts it: the show waits for its people (show-plan.js),
//              routines hold a traveller until it arrives. A ride to Iron Island is the cruiser's (stage/record.js).
//   day 0      the record starts at day 1, 06:00; before an agent's first place it was at the docks (D9 (h): the ferry drops everyone
//              there), so the season opens with everyone leaving the docks.
//   the show   C1-6: the running order is show-plan.js's (the page's player is createShowPlayer: results reach the store as their scenes
//              pay off, the board at the close). Inside its own play's window an agent plays its play (loops.js SHOW_LOOPS);
//              stage/record.js stages the rest. C2: a hooded attacker (show.masked) is drawn as itself, hooded while it is in its play.
import world from '../../../../world/export/world.json' with { type: 'json' };
import stands from '../stands.json' with { type: 'json' };
import { createSimLayer } from '../layer.js';
import { createAgents, SPEED } from '../agents.js';
import { SIDE } from '../../style.js';
import { lateArrival } from '../movement.js';
import { createLooks } from '../looks.js';
import { createRoutinePlanner } from './routines.js';
import { revealAt } from './player.js';
import { createShowPlanner } from './show-plan.js';
import { addressesFor, idHash } from './addresses.js';
import { continuityTrips } from './routine-places.js';
import { createLoops, walkClipOf } from './loops.js';
// (C2 · the day's errands, watchable: an act row's walker plays its act, stage/acts.js; the one hook here)
import { withActs, setOf as setOfAct, PASS_AT } from '../../stage/acts.js';
import { createBubbles } from './bubbles.js';
import { CITY_PLACES, HOUSE_LOTS, DISTRICTS } from './places.js';
// (C2: the timeline and the trip rule live in a node-safe module, so continuitycheck reads the drawing's own decision)
import { buildTimeline, createTripRule, createStateAt, maskedCast, maskWindows, rideBoarded, ORIGIN, HOME, placeOf } from './continuity.js';
// (C2-indoors: an agent at home drawn inside it, interiors/city/plan.js; its room dealt by interiors/city/assign.js recordRooms)
import * as INDOORS from '../../interiors/city/plan.js';
// (C2-seek: the stand plan, docs/redesign/tape-20261103.md: which spot each standing agent is on, from the record)
import { createStandPlan, createStandStates, createPlayAt, widenStands, nearByWalk } from './stand-plan.js';
import { recordRooms, RECORD_LAYOUTS } from '../../interiors/city/assign.js';
export { buildTimeline };

export async function createRecordDraw({ Q, SHOT = false, NIGHT = false, scene, mats, camera, peds, ANCHORS, frames, player, cornerKits, isShown, log = () => {}, ferry = null }) {
  const layer = createSimLayer({ scene, mats, lib: (await import('../placeholders.js')), night: NIGHT, cornerKits, isShown, live: true, budgetMs: SHOT ? Infinity : 2 });
  const routines = createRoutinePlanner(frames), trips = continuityTrips, t0 = performance.now(), planner = createShowPlanner(frames), TL = buildTimeline(frames, routines, planner);
  // C2 · every trip drawn to its end (continuity.js): the plan's departures, on foot where its movement row says so, and the agent drawn
  // on the trip until it arrives. The show waits for its people (show-plan.js), so no scene, 9:10 p.m. or boarding cuts a trip short
  const rule = createTripRule({ timeline: TL, planner, trips });
  // C1-6 · the show's scenes by agent: its own play's window (the loops play it); night 14's walk rows (the ambient board row, kind walk,
  // a backer's walk beat) are the walker's own too (C1-7d, SHOW.md "C1-7a2")
  // (C2-seek: the plays themselves, stand-plan.js createPlayAt, so the stand plan and its check read the same)
  const nightsOf = frames.filter(f => f.step.kind === 'night').map(f => f.day), bounds = new Set(), playAt = createPlayAt(planner, nightsOf);
  for (const n of nightsOf) for (const sc of planner.night(n).scenes) { bounds.add(sc.start); bounds.add(sc.end); for (const b of sc.beats || []) { bounds.add(b.start); bounds.add(b.end); } }
  // (C1-7: day 15's mint tail, when the record reaches its dawn)
  if (frames.some(f => f.day === 15 && f.step.kind === 'dawn')) { try { for (const sc of planner.day(15).scenes) { bounds.add(sc.start); bounds.add(sc.end); } } catch {} }
  // (C1-7d: the SECOND CHANCE, second-chance.js: alongside the docks from day 14's dawn frame, sailing in night 14's leave beat, then gone)
  const leaveBeat = nightsOf.includes(14) ? planner.night(14).scenes.find(sc => sc.kind === 'ferry')?.beats?.find(b => b.name === 'leave') ?? null : null;
  const dawn14 = frames.find(f => f.day === 14 && f.step.kind === 'dawn'), moorAt = dawn14 ? revealAt(dawn14) : 14 * 1440 + 360, FL = ferry ? await import('../../second-chance.js') : null;
  // (C1-9b: her mooring and sailing read only frames at or before the minute: moored from day 14's dawn frame, alongside until night
  // 14's frame is out and its leave beat comes; before that frame no leave beat is known, so she stays alongside, STAY)
  const night14 = frames.find(f => f.day === 14 && f.step.kind === 'night'), leaveFrom = night14 ? revealAt(night14) : Infinity, STAY = Object.freeze({ start: Infinity, end: Infinity });
  const roster = frames[0].board.agents.map(a => a.id), book = addressesFor(roster);
  // C2 · the hooded attackers as themselves (continuity.js maskedCast: show.masked, by the record's typed facts only): who plays which
  // hooded scene, and when each one's hood is on (maskWindows). The hood shows on the walker (cast.js OUTFITS.hooded over its own look);
  // captions, cards, the tape and the dossier keep the hood until §19's 24 hours (they read seen/publicActors, unchanged)
  const casts = new Map(), masks = new Map();
  for (const n of nightsOf) { const frame = frames.find(f => f.step.kind === 'night' && f.day === n), plan = planner.night(n), c = maskedCast(frame, plan, book, DISTRICTS); casts.set(n, c);
    for (const [id, w] of maskWindows(TL, rule, plan, c, book, DISTRICTS)) { (masks.get(id) || masks.set(id, []).get(id)).push(w); bounds.add(w.on); if (Number.isFinite(w.off)) bounds.add(w.off); }
    if (c.unresolved.length) log(`record: night ${n}: ${c.unresolved.length} hooded agents not cast (which fight is not in the record): ${c.unresolved.map(u => u.id).join(', ')}`); }
  const hoodedAt = (id, m) => !!masks.get(id)?.some(w => w.on <= m && m < w.off);
  const castOf = sc => casts.get(sc.night)?.byScene.get(sc.id) ?? [];
  // home steps: each dealt house's doorstep (its door from the block's anchors, else the sidewalk in front of the lot)
  const homes = new Map(Object.values(book).map(b => [HOME + b.home, b]));
  const placesList = { places: [...world.places, ...[...homes].map(([id, b]) => ({ id, name: b.name, kind: 'home', dist: 'suburbs', x: b.x, z: b.z }))], lots: world.lots };
  // stand places at their measured spots, and room beside each (1 m either side) for a crowd larger than the spots
  const wide = widenStands(stands);
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
      life: Q.get('life') !== '0', lifeOpts: { ...(loops = withActs(createLoops({ meetings, A: null, now: () => player.minute }), { routines, days, layer, indoors: () => indoorsApi })), at: () => player.minute * 60, keepOut: (x, z) => scenes?.keepOut(x, z) ?? false } });
    loops.bind(agents.map);
    // (C2: each masked agent's hooded look baked ahead, so the hood goes on in its own look, never a pooled stand-by while it bakes)
    if (looks) for (const id of masks.keys()) looks.of({ id, status: 'active', outfit: 'hooded' });
    peds.driver = agents.drive;
    player.attachClock(agents.clock);
  }
  // ── the doorsteps
  const homeSpot = new Map(), sceneBounds = [...bounds].sort((a, b) => a - b);
  // ── C2-indoors (GAME.md §41, slime 10-30: "if the agent goes into a house, we should watch them enter the house, then be inside the
  // house with the agent"): an agent at its own home is drawn INSIDE it. C2-indoors2: its walker is taken over where its trip home ends
  // (agents.js indoors.takes: no step-off), walks to its step, through the door (the stoop, the doorway, a free node behind it), to what
  // the hour has it doing (plan.js activityAt: asleep at night, the stove, the table, a seat or the free floor by day), and stays in until
  // something already published takes it out: its next trip's departure (the walk out through its door is that trip's first stretch:
  // the trip's run waits on its step meanwhile, agents.js indoors.out) or a scene of the show it is in, once that night's plan is out.
  // Its pose is a pure function of the island second and the published record (plan.js poseAt): a seek and playing share one clock
  // (from the trip's end, at its arrival), and no later frame changes it. The drawing only draws: where it is and when comes from the
  // timeline.
  // Rooms: recordRooms deals every home a layout from every tier's presets by its agent's trade, and a skin (slime 10-31: "One room is
  // fine as long as there is variety"); plan.js falls back along the trade's layouts when one is bigger than the house.
  const trades = new Map(frames[0].board.agents.map(a => [a.id, a.trade])), asm = new Map();
  await Promise.all(RECORD_LAYOUTS.map(n => fetch(new URL(`../../interiors/home/assemblies/${n}.json`, import.meta.url)).then(r => r.json()).then(A => asm.set(n, A)).catch(e => log(`record indoors: no layout ${n} (${e && e.message || e})`))));
  const plans = new Map(), inside = new Map(), IN = { frames: 0, ms: 0, maxMs: 0 };
  // the rooms are dealt once every home's block has handed its anchors back (the deal reads each house's size); until then an agent at
  // home stands on its step, as before
  let rooms = null; const lots = new Map();
  function lotOf(lot) { if (lots.has(lot)) return lots.get(lot); for (const [kk, a] of ANCHORS) if (a?.lots?.[lot]) { const l = a.lots[lot], h = INDOORS.lotEntry(lot, l, kk), o = h && { l, h }; lots.set(lot, o); return o; } return null; }
  function deal() { if (rooms) return rooms; for (const id of roster) if (!lotOf(book[id].home)) return null;
    rooms = recordRooms(book, id => trades.get(id), (id, n) => asm.has(n) && INDOORS.fits(lotOf(book[id].home).h, asm.get(n))); indoorsApi.rooms = rooms; return rooms; }
  function planOf(id) {
    if (plans.has(id)) return plans.get(id);
    const R = deal(), b = book[id], r = R?.[id]; if (!b || !r || !asm.has(r.name)) return null;
    const { l, h } = lotOf(b.home), p = INDOORS.homePlan(h, asm.get(r.name), { door: l.door, face: l.face });
    Object.assign(p, { name: r.name, skin: r.skin, agent: id, lot: b.home }); plans.set(id, p); return p;
  }
  // the stay this minute belongs to (C2-indoors2: from what is published at the minute only, so no later frame changes the picture):
  // [from, to, pubTo] in island minutes, from its arrival (or the end of a scene of the show it is in) to the start of the next scene it
  // is in that is already published (pubTo: when that night's plan was, revealAt). Never its next departure: that is published only
  // when it leaves (its next segment's start), and the walk out is then its trip's first stretch (exitFor)
  // (every scene of the show it is in, its own play or a scene the stage casts it in, e.g. its lay-low on its step: the stage draws it
  // there, so it is out on its step for the scene and goes back in after it)
  const inScenes = new Map();
  for (const n of nightsOf) { const fr = frames.find(f => f.step.kind === 'night' && f.day === n), pub = fr ? revealAt(fr) : -Infinity;
    // (C2-cast: a break-in's target is not out on its step for its scene: the stage stages no target there (stage/record.js fight), and
    // it stays inside, drawn in its room as at any other minute of its stay, on a seek as on play)
    for (const sc of planner.night(n).scenes) for (const id of new Set([...(sc.kind === 'breakin' ? [] : sc.publicActors || []), ...castOf(sc)])) (inScenes.get(id) || inScenes.set(id, []).get(id)).push([sc.start, sc.end, pub]); }
  const inSceneAt = (id, m) => !!inScenes.get(id)?.some(([a, b]) => a <= m && m < b);
  function stayWindow(id, s) {
    let from = s.since ?? s.seed, to = Infinity, pubTo = null;
    for (const [a, b, pub] of inScenes.get(id) || []) { if (b <= s.m && b > from) from = b; if (a > s.m && a < to && pub <= s.m) { to = a; pubTo = pub; } }
    return [from, to, pubTo];
  }
  // the stay itself: handed over where its trip ended (rec.arrive; the walker is taken over there at its arrival, agents.js indoors.takes,
  // and a seek places it on the same clock), else on its step; its step is the house's own doorstep spot (homeSpot), whoever stands there
  // (C2-indoors2 · the home errands it plays at its own home from minute `from` on: stage/acts.js's cues (routines.js's acts), each in
  // the room at its real time, plan.js stayOf; act-marks.js plays their clips and tags)
  function homeActs(id, from) {
    const list = loops?.acts?.index?.by.get(id) ?? [], lot = book[id]?.home, out = [];
    for (const c of list) { if (c.minute < from - 1e-6 || c.minute > from + 3 * 1440) continue; if (c.place?.cityPlace !== lot || !setOfAct(c.kind)) continue;
      out.push({ t0: c.minute * 60, t1: (c.minute + c.minimum) * 60, set: setOfAct(c.kind), cue: c }); }
    return out;
  }
  const stayCache = new Map(), lenOf = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]); return L; };
  function homeStay(id, s, p) {
    const [from, to, pubTo] = stayWindow(id, s), sp = homeSpot.get(s.place); if (!sp) return null;
    const step = [sp.x, sp.y ?? .2, sp.z], byTrip = !!s.arrive && s.since === from, ld = byTrip && leads.get(id)?.since === from ? leads.get(id).p : null;
    const key = `${id}|${from}|${byTrip}|${ld ? ld.join(',') : ''}`; let st = stayCache.get(key);
    if (!st) { st = INDOORS.stayOf(p, { agent: id, from: byTrip ? [s.arrive[0], step[1], s.arrive[2]] : step, spot: step, tIn: from * 60, lead: ld, acts: homeActs(id, from) }); stayCache.set(key, st);
      if (stayCache.size > 400) stayCache.delete(stayCache.keys().next().value); }
    // (out for a scene of the show at its home: from the minute its plan is published, timed to be on its step as the scene starts)
    let tx = Infinity;
    if (Number.isFinite(to)) { if (st.txFor?.to === to && st.txFor.pubTo === pubTo) tx = st.txFor.tx;
      else { const a = to * 60, t1 = a - lenOf(INDOORS.exitPath(st, a)) / INDOORS.WALK; tx = Math.max(pubTo * 60, a - lenOf(INDOORS.exitPath(st, t1)) / INDOORS.WALK); st.txFor = { to, pubTo, tx }; } }
    return { st, tx };
  }
  // the walk out of its home on its trip's first stretch: from its departure (the next segment's start: published then), the stay it
  // left, out through its door onto its step, while its trip's run waits there (agents.js indoors.out). → { st, end } | null
  const exits = new Map();
  function exitFor(id, s) {
    if (!s?.trip || !s.seed) return null; const key = `${id}|${s.seed}`; if (exits.has(key)) return exits.get(key);
    let out = null; const b = book[id], m0 = s.seed - 1e-6, prev = stateAt(id, m0), p = planOf(id);
    if (p && b && prev && !prev.hidden && !prev.trip && !prev.ride && !prev.jail && prev.place === HOME + b.home && !playAt(id, m0) && !inSceneAt(id, m0)) {
      const H = homeStay(id, { ...prev, m: m0 }, p);
      if (H) { const X = INDOORS.exitAt(H.st, Math.min(H.tx, s.seed * 60)); out = { st: H.st, X, step: [H.st.spot[0], H.st.spot[2]] }; } }
    exits.set(key, out); if (exits.size > 400) exits.delete(exits.keys().next().value); return out;
  }
  let lastT = null; const fresh = new Set();
  function indoorFrame() {
    if (!agents) return; const t0 = performance.now(), m = player.minute, T = m * 60, dT = lastT === null ? 0 : Math.max(0, Math.min(5, T - lastT)); lastT = T;
    for (const id of roster) {
      const s = states.get(id), a = agents.map.get(id), b = book[id], p = b && a?.w && !a.held && s && !s.hidden && !s.jail && !s.ride ? planOf(id) : null;
      let st = null;
      if (p && !s.trip && s.place === HOME + b.home && a.mode === 'stand' && !a.step && a.spot?.place === s.place && !playAt(id, m) && !inSceneAt(id, m)) {
        const H = homeStay(id, { ...s, m }, p); if (H) { st = H.st; INDOORS.exitAt(st, H.tx); } }
      else if (p && s.trip) { const E = exitFor(id, s); if (E && T < E.X.t1) { st = E.st; INDOORS.exitAt(st, E.X.t0); } }
      if (!st) { inside.delete(id); current.delete(id); continue; }
      current.set(id, st);
      const P = INDOORS.poseAt(st, T), w = a.w;
      // (placed outright, a seek: its heading outright too)
      if (fresh.has(id)) w.yawS = null;
      // (its place this frame at once, as pedsim's where() would put it on its next step: a paused picture is the frame's own)
      w.fix = [P.x, P.y, P.z, P.yaw]; w.p[0] = P.x; w.p[1] = P.y; w.p[2] = P.z; w.p[3] = P.yaw; w.vc = P.v; if (P.v) w.ph += P.v * dT * 3.1;
      if (P.clip) { const mv = st.mv ?? (st.mv = { stand: true, indoor: true }); mv.clip = P.clip; mv.clipT = P.clipT; w.mv = mv; } else if (w.mv) w.mv = null;
      inside.set(id, P);
    }
    fresh.clear();
    const ms = performance.now() - t0; IN.frames++; IN.ms += ms; IN.maxMs = Math.max(IN.maxMs, ms);
    // (whatever hangs on the indoor frame: the record's homes, the acts' marks; each in turn, one's failure never drops another)
    for (const f of frameHooks) { try { f(m); } catch (e) { log('record indoors hook: ' + (e && e.stack || e)); } }
    indoorsApi.onFrame?.(m);
  }
  // (agents.js's hand-overs: a trip home ends in the indoors' hands where it ends; a trip out waits on the step while the walk out lasts)
  const handovers = [], leads = new Map(), LEAD = 12;
  if (agents) agents.indoors = {
    takes: a => { const s = states.get(a.id), b = book[a.id], ok = !!(s && b && !s.trip && !s.hidden && !s.jail && !s.ride && s.arrive && s.place === HOME + b.home && planOf(a.id) && homeSpot.has(s.place) && !playAt(a.id, s.m) && !inSceneAt(a.id, s.m));
      // → 'near' | 'far' | false. Where its walker really is: walked on from there when its trip's drawing ended within LEAD m of the
      // trip's booked end; further off (a walker drawn elsewhere: under the street, far behind) it goes, as it went before, and is put
      // on the stay as a seek has it the next frame. Counted in handovers
      if (!ok) return false; const d = a.w ? Math.hypot(a.w.p[0] - s.arrive[0], a.w.p[2] - s.arrive[2]) : Infinity; if (d <= LEAD) leads.set(a.id, { since: s.since, p: [+a.w.p[0].toFixed(3), a.w.p[1], +a.w.p[2].toFixed(3)] }); else leads.delete(a.id);
      handovers.push([a.id, +s.m.toFixed(3), Number.isFinite(d) ? +d.toFixed(2) : null, d <= LEAD]); if (handovers.length > 400) handovers.shift();
      return d <= LEAD ? 'near' : 'far'; },
    out: a => { const s = states.get(a.id), E = s?.trip && a.d?.trip === s.trip ? exitFor(a.id, s) : null; return E && player.minute * 60 < E.X.t1 ? E.step : null; },
    // (C2-seek: the walk out itself, at any minute of the trip: its step and the island minute it is out of the door)
    exit: a => { const s = states.get(a.id), E = s?.trip && a.d?.trip === s.trip ? exitFor(a.id, s) : null; return E ? { step: E.step, end: E.X.t1 / 60 } : null; } };
  const frameHooks = new Set(), current = new Map();
  // (stays: for the tools only (cutawaycheck, c2cutawayshots), as C2-indoors had it: get(id) → { stay: { tIn, tOut } } for the stay drawn
  // now, tOut the minute its next segment starts by the whole timeline, × 60. Nothing that draws reads it: the drawing knows a departure
  // only once it is published)
  const staysView = { get: id => { const st = current.get(id), s = states.get(id); if (!st || !s) return undefined; const out = s.trip ? s.seed : s.next; return { stay: { tIn: st.tIn, tOut: Number.isFinite(out) ? out * 60 : Infinity } }; }, has: id => current.has(id) };
  const indoorsApi = { addFrame: f => { frameHooks.add(f); return () => frameHooks.delete(f); }, current, rooms, plans, stays: staysView, stayCache, exits, handovers, inside, stats: IN, planOf, stayWindow, homeStay, exitFor, inSceneAt, frame: indoorFrame, onFrame: null, asm };
  log(`record: ${TL.cands.length} place changes over the season in ${(performance.now() - t0).toFixed(0)} ms`);
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
    const sp = doorstep(id); if (cur?.taken) return;
    // (C2: room on the step beside it, 1.4 m either side along the house front: a break-in's crew at a door, the one at home and a
    // visitor each stand there, none sent indoors out of sight for want of a spot)
    const side = s => ({ ...sp, x: sp.x + Math.cos(sp.ry) * 1.4 * s, z: sp.z - Math.sin(sp.ry) * 1.4 * s, k: s > 0 ? 1 : 2, taken: null, lane: sp.lane });
    agents.spots.set(id, [sp, side(1), side(-1)]); homeSpot.set(id, sp);
  }
  { const add = layer.addAnchors; layer.addAnchors = (k, a) => { add(k, a); for (const lot of Object.keys(a?.lots || {})) if (homes.has(HOME + lot)) ensureHome(HOME + lot); }; }
  for (const [k, a] of ANCHORS) layer.addAnchors(k, a);
  // ── where each agent is drawn at minute m (continuity.js createStateAt: node-safe, the stand plan and its check read the same)
  const opening = frames[0].minute, stateAt = createStateAt({ frames, timeline: TL, rule, meetings, scenes: () => scenes });
  // ── C2-seek · THE STAND PLAN (stand-plan.js; docs/redesign/tape-20261103.md): which spot each standing agent is on, a function of the
  // record and the minute, read by agents.js claim() on play and on a seek alike. Built once the stage's scenes are up (their venues,
  // act spots and the cast plan's answers are its inputs); until then, and with ?stage=0 never staged, claims go as before
  let standPlan = null; const STAGED = !!agents && Q.get('stage') !== '0';
  const published = new Map(nightsOf.map(n => { const f = frames.find(f => f.step.kind === 'night' && f.day === n); return [n, f ? revealAt(f) : Infinity]; }));
  function planNow() {
    if (standPlan || !agents || (STAGED && !scenes)) return standPlan;
    const SI = scenes?.standInputs ?? null, spotsOf = p => { if (p.startsWith(HOME)) ensureHome(p); return agents.spots.get(p); };
    // (the cost from a trip's end to a spot on the world's own walk graph, stand-plan.js nearByWalk)
    const near = nearByWalk(trips.walkLen);
    const bounds = (a, b) => { if (!SI) return []; const out = []; for (const n of nightsOf) { if (!(published.get(n) <= b)) continue; for (const x of SI.planBounds(n)) if (x > a && x <= b) out.push(x); } return out.sort((x, y) => x - y); };
    standPlan = createStandPlan({ roster, from: opening, stateOf: createStandStates({ timeline: TL, stateAt, spotsOf, playAt, meetings }), spotsOf: p => agents.spots.get(p), near,
      kept: SI ? SI.keptAt : () => false, planned: SI ? SI.planSpotAt : () => null, bounds });
    return standPlan;
  }
  if (agents) { agents.standPlan = (a, place) => planNow()?.spotOf(a.id, place, player.minute); agents.heldAt = (id, m) => planNow()?.heldAt(id, m); }
  // (C2-seek · a trip that left its home late by its walk out — the walk out through the door is drawn first, and the trip's booked
  // first stretch is a step — is drawn to its end: its state stays the trip's until the run's own catch-up brings its clock to the
  // arrival, movement.js lateArrival, a function of the walk out's end and the minute, so a seek there draws it on the trip too. Without
  // it the trip was cut at its booked arrival: 404, a10 at 6600.38 drawn 15 s late on its scooter, put 41 m away on its spot)
  // (lateEnd: keep a trip until its shared movement clock arrives, including a planned stage return before its departure)
  function lateEnd(id, s, minute = s.m) {
    const ts = stateAt(id, s.since - 1e-6); if (!ts.trip || ts.trip.arr !== s.since) return { ts: null, end: s.since };
    const E = exitFor(id, ts), back = scenes?.backPlan.forTrip(id, ts.trip.dep, minute);
    const e = Math.max(ts.trip.dep, E?.X.t1 / 60 || ts.trip.dep, back?.end ?? ts.trip.dep);
    return { ts, end: lateArrival(ts.trip, e - ts.trip.dep, e) };
  }
  function lateState(id, s, m) {
    if (s.trip || s.hidden || s.ride || !s.arrive || !s.since || m > s.since + 5) return s;
    const { ts, end } = lateEnd(id, s, m); if (!ts) return s;
    return m < end ? { ...ts, next: Math.min(s.next ?? Infinity, end), late: end } : s;
  }
  // (C2-seek · the walk off a trip to its spot, a function of the minute, as the stage's walk back after a scene is: from its trip's end
  // (rec.arrive), along the walk the world's graph plans to the stand plan's spot (trips.js walkPath, the path its spot was priced on),
  // at WALK_OFF m/s from the minute its trip's drawing ends. A seek mid-way places it on that path at the minute's point; playing there
  // walks it there. agents.js walkOff. Not at its own home (the indoors walks it in), not to a venue's seat, nor a walk over 60 m (as before:
  // from the lanes). → { P: [[x, y, z], …], L, t0, dur } | null. Played, it went along the walkers' lanes from where its trip was
  // drawn to end, and a seek put it on its spot: 404@6600 a22 walking, 2.95 m from a seek's picture)
  const WALK_OFF = SPEED.stroll, offCache = new Map();
  // (the walk graph ends a walk at the graph's point nearest its spot, so a spot beside a long stretch of path was walked past and back:
  // 404 e2953, a08's 20.6 m from (-18, 198) out to (-5.2, 198) and back to its spot at (-12, 199), a metre off the first stretch. It
  // steps off where its path first passes within STEP_OFF m of the spot; the path is the graph's up to there, the spot's price unchanged)
  const STEP_OFF = 1.5;
  function stepOffAt(P) {
    if (!P || P.length < 3) return P; const q = P[P.length - 1];
    for (let k = 0; k < P.length - 2; k++) { const a = P[k], b = P[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; if (l2 < 1e-9) continue;
      const u = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2)), c = [a[0] + dx * u, a[1] + dz * u];
      if (Math.hypot(q[0] - c[0], q[1] - c[1]) <= STEP_OFF) return [...P.slice(0, k + 1), ...(u > 1e-6 ? [c] : []), q]; }
    return P;
  }
  // (from [x, z]: the same graph's walk to the spot from where the walker stands, for agents.js to time — a walker the stage held off
  // its path's clock: { P, L } | null, not cached)
  function offWalk(a, sp, from = null) {
    const s = states.get(a.id); if (!s || s.trip || s.hidden || s.ride || s.jail || !s.arrive || !s.since || !sp || sp.plan || sp.venue || sp.seat || sp.place !== s.place || s.place === HOME + book[a.id]?.home) return null;
    if (from) { const P2 = stepOffAt(trips.walkPath(from, [sp.x, sp.z])); if (!P2) return null; let L = 0; for (let k = 1; k < P2.length; k++) L += Math.hypot(P2[k][0] - P2[k - 1][0], P2[k][1] - P2[k - 1][1]);
      return L <= 60 ? { P: P2.map(([x, z], k) => [x, k === P2.length - 1 ? sp.y ?? SIDE : SIDE, z]), L } : null; }
    const key = `${a.id}|${s.since}|${sp.x},${sp.z}`; if (offCache.has(key)) return offCache.get(key);
    const P2 = stepOffAt(trips.walkPath([s.arrive[0], s.arrive[2]], [sp.x, sp.z])); let out = null;
    if (P2) { let L = 0; for (let k = 1; k < P2.length; k++) L += Math.hypot(P2[k][0] - P2[k - 1][0], P2[k][1] - P2[k - 1][1]);
      if (L <= 60) { const P = P2.map(([x, z], k) => [x, k === P2.length - 1 ? sp.y ?? SIDE : SIDE, z]); out = { P, L, t0: lateEnd(a.id, s).end, dur: Math.max(.4, L / WALK_OFF) };
        // (an act due while it walks off — routines.js's cue, the arrival the act's own start, a hand-over's partner coming last —: it
        // hurries, up to SPEED.max, to be on its spot by the act's walk-up, PASS_AT island s after the cue's minute (stage/acts.js: the pair
        // meets and the parcel passes there), never slower than the stroll. Read from the agent's act cues by the walk's own minutes, so
        // the same at any minute it is asked. At the stroll it stood 8-10.5 s after the pass: 404 e2936 a25 walked 17.6 m in 14.1 s)
        const due = (loops?.acts?.index?.by.get(a.id) ?? []).find(c => c.minute < out.t0 + out.dur / 60 && c.minute + c.minimum > out.t0);
        if (due) { const left = (due.minute - out.t0) * 60 + PASS_AT; if (out.dur > left) out.dur = Math.max(.4, left, L / SPEED.max); } } }
    offCache.set(key, out); if (offCache.size > 400) offCache.delete(offCache.keys().next().value); return out;
  }
  if (agents) agents.offWalk = offWalk;
  let rows = [], next = -Infinity, seeked = true, lastMinute = null;
  const states = new Map(), lastScene = new Map(), lateSnaps = [];
  player.on((_, meta) => { if (meta.reset) seeked = true; });
  function rowOf(s) {
    if (s.hidden) return { id: s.id, status: 'hidden', at: null, trip: null };
    if (s.place.startsWith(HOME)) ensureHome(s.place);
    const t = s.t, act = t?.act ?? (t?.reason === 'corner' ? 'deal' : 'hang'), meet = t?.role === 'meet' ? t.meet ?? null : null, cue = meet != null ? meetings.get(meet) : null;
    // C1-6: inside its own play's window the agent plays its play (loops.js SHOW_LOOPS, seeded by the scene)
    const sc = s.trip ? null : playAt(s.id, s.m);
    // (C2: hooded while its hood is on, cast.js OUTFITS.hooded over its own look; Iron Island's issue over everything)
    const outfit = !s.jail && hoodedAt(s.id, s.m) ? 'hooded' : undefined;
    if (sc) return { id: s.id, status: s.jail || scenes?.taken.has(s.id) ? 'jail' : 'active', outfit, at: s.place, trip: null, act, loopRole: 'show', show: { kind: sc.kind, variant: sc.variant ?? null, sceneId: sc.id, face: scenes?.faceOf(sc.id) ?? null, beats: sc.beats ?? null },
      loopSeed: idHash(sc.id), loopAnchor: sc.start, walk: t?.walk ?? null, walkClip: walkClipOf(t?.walk), meet: null, pairWith: null };
    // C1-4: the loops' inputs, all from the row (a show's rows have no role: a corner deals, the rest hang; seeded by id and segment)
    return { id: s.id, status: s.jail || scenes?.taken.has(s.id) ? 'jail' : 'active', outfit, at: s.trip ? null : s.place, trip: s.trip ?? null, act,
      loopRole: t?.role ?? (t?.reason === 'corner' ? 'deal' : 'hang'), loopSeed: t?.loopSeed ?? idHash(`${s.id}|${s.seed}`), loopAnchor: s.anchor ?? s.seed ?? null, walk: t?.walk ?? null, walkClip: walkClipOf(t?.walk),
      meet, pairWith: cue ? (cue.a === s.id ? cue.b : cue.a) : null, arrive: s.arrive ?? null,
      // (C2 · the act this row is, routines.js's live cue with its counterpart: stage/acts.js plays it, withActs below)
      errand: s.trip ? null : t?.errand ?? null, live: s.trip ? null : t?.live ?? null };
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
    for (const id of roster) { const s = lateState(id, stateAt(id, m), m), was = states.get(id); s.m = m; states.set(id, s); next = Math.min(next, s.next);
      // (a place change with no trip to draw — none booked: placed there outright; continuitycheck --drawing counts these)
      if (s.cutFrom && was && !was.hidden && was.place !== s.place) snapIds.add(id);
      // (C2-seek: out of hiding at a place, no trip to draw — the opening's docks crowd off the ferry: placed on its spot, as a seek places
      // it. Played, it walked up from the lane after a gap: 404@1800.02 drew 9 of them nowhere and 4 stepping off, 6.8–13 m from a seek's)
      else if (was?.hidden && !s.hidden && !s.trip && !s.ride) snapIds.add(id);
      const row = rowOf(s); rows.push(row);
      if ((row.show?.sceneId ?? null) !== (lastScene.get(id) ?? null)) { lastScene.set(id, row.show?.sceneId ?? null); restart.push(id);
        // (its trip is over by the clock but its walker is still stepping the last stretch to its spot when its own play begins — the
        // stage's figures walk on the page's seconds, so at 10x and 60x they fall behind the island's: it is put on its spot, else its
        // play passes with nobody there. Counted, lateSnaps: C2 leaves this catch-up, not a trip's cut, in place)
        const a = agents.map.get(id); if (row.show && a && !(a.mode === 'stand' && !a.step)) { snapIds.add(id); lateSnaps.n = (lateSnaps.n ?? 0) + 1; lateSnaps.push([id, +m.toFixed(3), a.mode]); if (lateSnaps.length > 200) lateSnaps.shift(); } } }
    // (C1-9b: a seek places everyone in the order they came to where they are, as playing there claimed their spots: by arrival)
    const order = new Map([...states].map(([id, s]) => [id, s.since ?? s.seed ?? -Infinity]));
    if (seek || back) rows.sort((x, y) => (order.get(x.id) ?? -Infinity) - (order.get(y.id) ?? -Infinity) || (x.id < y.id ? -1 : 1));
    agents.setAgents(rows, seek || back ? { snap: 'all' } : snapIds.size ? { snapIds } : {});
    // (C2-indoors: who was placed outright: its heading outright on its first frame inside)
    if (seek || back) { for (const id of roster) fresh.add(id); lastT = null; leads.clear(); exits.clear(); } else for (const id of snapIds) fresh.add(id);
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
  const api = { layer, routines, trips, timeline: TL, update, drawn, get standPlan() { return planNow(); }, indoors: indoorsApi, stateAt, casts, masks, hoodedAt, rule, lateSnaps, book, homes, meetings, bubbles, planner, playAt, get loops() { return loops; },
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
      scenes = createScenes({ stage, scene, agents, layer, looks, player, planner, frames, book, homes, wide, meetings, night: NIGHT, log,
        // (C2: who wore the hood in which scene, each one's mask-up, and the rides to Iron Island)
        continuity: { castOf, masks, rides: m => roster.map(id => stateAt(id, m)).filter(s => s.ride).map(s => s.ride) } });
    } catch (e) { log('record stage: ' + (e && e.stack || e)); }
  }
  // (C2-indoors: after the walkers' own frame and the stage's, the ones at home drawn inside)
  if (peds && agents) { const d0 = peds.driver; peds.driver = (...q) => { d0(...q); try { indoorFrame(); } catch (e) { log('record indoors: ' + (e && e.stack || e)); } }; }
  return api;
}
