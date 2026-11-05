// GAME §41, 2026-10-30: "no one wants to watch people drop off screen".
// Node-only: use the drawing's actual timeline and its trip departure/deadline
// rules, plus the core's public frames. --root permits the same check on trunk.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const root = path.resolve(arg('--root') ?? fileURLToPath(new URL('../../../', import.meta.url)));
const feeds = path.resolve(arg('--feeds') ?? path.join(root, 'core/runs'));
const record = name => pathToFileURL(path.join(root, 'style/city/simstate/record', name)).href;
const [{ parseFeed }, { createRoutinePlanner }, { createShowPlanner, createShowPlayer }, { createTrips }, { addressesFor, idHash }, { SITES }, timing] = await Promise.all([
  import(record('adapter.js')), import(record('routines.js')), import(record('show-plan.js')), import(record('trips.js')),
  import(record('addresses.js')), import(record('places.js')), import(record('timing.js')),
]);
const { targetsAt } = await import(record('placement.js'));
const { DISTRICTS } = await import(record('places.js'));
const source = fs.readFileSync(path.join(root, 'style/city/simstate/record/draw.js'), 'utf8');
const timelineSource = source.slice(source.indexOf('export function buildTimeline('), source.indexOf('export async function createRecordDraw('));
const prelude = `import {targetsAt,fightsAt} from ${JSON.stringify(record('placement.js'))};
import {createShowPlayer,createShowPlanner} from ${JSON.stringify(record('show-plan.js'))};
import {showMinute,revealAt,SHOW_MINUTES} from ${JSON.stringify(record('player.js'))};
import {SETTLE,ARREST_END} from ${JSON.stringify(record('timing.js'))};
const placeOf=t=>t.reason==='home'?'home:'+t.cityPlace:t.standPlace??t.cityPlace;
const keyOf=t=>['hidden','departed'].includes(t.reason)?t.reason:placeOf(t)+'|'+(t.reason==='jail'?'jail':'');\n`;
// C2: the drawing's own decision, from its node-safe module (continuity.js: buildTimeline and the trip rule draw.js draws from).
// A checkout without it (--root on an older trunk) keeps the timeline extracted from draw.js and the deadline rule restated below.
const drawing = fs.existsSync(path.join(root, 'style/city/simstate/record/continuity.js')) ? await import(record('continuity.js')) : null;
const { buildTimeline } = drawing ?? await import('data:text/javascript,' + encodeURIComponent(prelude + timelineSource));
const placeOf = t => t.reason === 'home' ? 'home:' + t.cityPlace : t.standPlace ?? t.cityPlace;
const travelId = p => p?.startsWith('home:') ? p.slice(5) : p;
const showMinute = n => n * 1440 + 1265;
const isWalk = s => !!s.route && (s.kind === 'walk' || (s.kind === 'board' && s.beat === 'ambient') || (s.kind === 'back' && s.beats?.[0]?.name === 'walk'));
const totals = {};
let failed = false, drawingCuts = 0;
for (const seed of [404, 405, 406]) {
  const frames = parseFeed(fs.readFileSync(path.join(feeds, `${seed}-A/feed.jsonl`), 'utf8'));
  const routines = createRoutinePlanner(frames), planner = createShowPlanner(frames), player = createShowPlayer(frames);
  const timeline = buildTimeline(frames, routines, planner), trips = createTrips();
  const plans = frames.filter(f => f.step.kind === 'night').map(f => planner.night(f.day));
  const book = addressesFor(frames[0].board.agents.map(a => a.id));
  const count = { changes: 0, hidden: 0, missingTrip: 0, interrupted: 0, deadlineCuts: 0, sceneLate: 0,
    scenePlace: 0, forcedCuts: 0, wrongOrigin: 0, maskedMissing: 0, maskedEarly: 0, maskedInSightings: 0, maskedInBriefing: 0, maskedWrongPlace: 0, departedFromElsewhere: 0 };
  const examples = [], openingCuts = {}, deadlineKinds = {};
  const participants = (scene, plan) => {
    const show = frames[plan.frame].events.find(e => e.type === 'show');
    const receipts = frames[plan.frame].events.filter(e => scene.kind !== 'ferry' && ['board', 'missed', 'arrest'].includes(e.type)
      && (e.id === scene.eventId || scene.eventIds?.includes(e.id))).flatMap(e => [e.agent, ...(e.by ? [e.by] : [])]);
    return [...new Set([...scene.publicActors, ...receipts, ...Object.entries(show.masked ?? {}).filter(([id, at]) => {
      if (!scene.hoodedCount) return false;
      const place = at.home ? { cityPlace: book[at.home].home, standPlace: null } : DISTRICTS[at.place];
      return scene.kind === 'hooded' ? !at.home && at.place === scene.place.district
        : (place.standPlace ?? place.cityPlace) === (scene.place.standPlace ?? scene.place.cityPlace);
    }).map(([id]) => id)])];
  };
  for (const [id, list] of timeline.segs) {
    for (let i = 0; i < list.length; i++) {
      const cur = list[i], prev = list[i - 1], next = list[i + 1]?.start ?? Infinity, t = cur.t;
      if (t.reason === 'hidden') count.hidden++;
      if (t.reason === 'departed' && (!prev || placeOf(prev.t) !== SITES.docks.standPlace)) {
        count.departedFromElsewhere++;
        console.log(`  departedFromElsewhere ${JSON.stringify({id,minute:cur.start,from:prev?.t})}`);
      }
      if (['hidden', 'departed', 'jail'].includes(t.reason)) continue;
      const day = Math.floor(cur.start / 1440), plan = plans.find(p => p.night === day);
      const scenes = plan?.scenes ?? [], own = scenes.filter(s => s.publicActors.includes(id));
      const walk = own.find(isWalk), others = own.filter(s => !isWalk(s));
      const wk = walk && cur.start >= showMinute(day) && cur.start < walk.end && placeOf(t) === (walk.place.standPlace ?? walk.place.cityPlace) ? walk : null;
      const before = wk && others.some(s => s.start < wk.start);
      const actualFrom = prev ? (prev.t.reason === 'hidden' ? null : placeOf(prev.t)) : SITES.docks.standPlace;
      const from = wk && !before && book[id] ? 'home:' + book[id].home : actualFrom, to = placeOf(t);
      if (from && actualFrom && from !== actualFrom && cur.start === showMinute(day)) count.wrongOrigin++;
      if (!from || from === to) continue;
      count.changes++;
      if (t.cut) count.forcedCuts++;
      const dep = cur.start + (i === 0 ? (idHash(id) % 30) / 10 : 0);
      const inShow = cur.start > showMinute(day) && cur.start < (plan?.end ?? -Infinity);
      const toDock = inShow && day === 14 && t.reason === 'docks';
      const trip = trips.plan(id, travelId(from), travelId(to), dep, { walk: !!wk || toDock });
      if (!trip) { count.missingTrip++; continue; }
      const back = own.find(s => s.kind === 'back' && !isWalk(s));
      const group = back ? scenes.filter(s => s.kind === 'back' && !isWalk(s)
        && (s.place.standPlace ?? s.place.cityPlace) === (back.place.standPlace ?? back.place.cityPlace)) : [];
      const first = Math.min(Infinity, ...others.map(s => s.start), ...group.map(s => s.start));
      const arrive = wk?.beats?.find(b => b.name === 'arrive')?.start ?? wk?.end;
      const walkCut = wk ? Math.min(arrive, ...others.filter(s => s.start >= wk.start).map(s => s.start)) : Infinity;
      const boardFrom = Math.min(Infinity, ...scenes.filter(s => s.kind === 'board' && s.beat === 'finale').map(s => s.start));
      const deadline = wk ? walkCut : cur.start === showMinute(day) ? Math.min(cur.start + timing.SETTLE, first)
        : inShow ? Math.min(cur.start + timing.MAX_TRIP, ...others.filter(s => s.start >= cur.start).map(s => s.start), toDock ? boardFrom + .5 : Infinity)
          : cur.start + timing.MAX_TRIP;
      if (trip.arr > next + 1e-7) {
        count.interrupted++;
        console.log(`  interrupted ${JSON.stringify({id,dep,from,to,arrival:trip.arr,next})}`);
      }
      // (C2: with the drawing's module the cuts are its own decision, counted after this loop over every segment)
      if (!drawing && trip.arr > deadline + 1e-7) {
        count.deadlineCuts++;
        const kind = wk ? 'walk' : cur.start === showMinute(day) ? 'opening' : toDock && deadline === boardFrom + .5 ? 'boarding' : 'scene-or-max';
        deadlineKinds[kind] = (deadlineKinds[kind] ?? 0) + 1;
        if (cur.start === showMinute(day)) openingCuts[day] = (openingCuts[day] ?? 0) + 1;
        if (examples.length < 5) examples.push({ id, departure: dep, arrival: trip.arr, deadline, next });
      }
      for (const scene of scenes.filter(s => participants(s, plan).includes(id) && s.start >= cur.start && s.start < next)) {
        if (isWalk(scene)) continue;
        if (trip.arr > scene.start + 1e-7) {
          count.sceneLate++;
          console.log(`  sceneLate ${JSON.stringify({id,dep,from,to,arrival:trip.arr,scene:scene.id,start:scene.start})}`);
        }
      }
    }
  }
  for (const plan of plans) {
    const frame = frames.find(f => f.step.kind === 'night' && f.day === plan.night);
    const show = frame.events.find(e => e.type === 'show');
    const before = player.seek(plan.start - .0001), at = player.seek(plan.start);
    const envelope = at.events.find(e => e.id === show.id);
    if (!envelope?.masked) count.maskedMissing++;
    if (envelope?.masked) {
      if (Object.keys(envelope.masked).length !== Object.values(show.hooded).reduce((n,v)=>n+v,0)) count.maskedMissing++;
      const rows = targetsAt(at);
      for (const [id, location] of Object.entries(envelope.masked)) {
        const row = rows.find(r => r.agent === id);
        const wanted = location.home ? book[location.home].home : DISTRICTS[location.place].cityPlace;
        if (!row || row.cityPlace !== wanted) count.maskedWrongPlace++;
      }
    }
    if (before.events.some(e => e.id === show.id && e.masked)) count.maskedEarly++;
    for (const scene of plan.scenes) for (const id of participants(scene, plan)) {
      const list = timeline.segs.get(id), row = list?.findLast(s => s.start <= scene.start)?.t;
      if (!row) { count.scenePlace++; continue; }
      if (placeOf(row) !== (scene.place.corePlace === 'home' ? 'home:' + scene.place.cityPlace : scene.place.standPlace ?? scene.place.cityPlace)) count.scenePlace++;
    }
  }
  for (const frame of frames) {
    if (JSON.stringify(frame.sightings).includes('"masked"')) count.maskedInSightings++;
    for (const event of frame.events) if (event.type !== 'show' && Object.hasOwn(event, 'masked') && event.type !== 'card' && !event.card) count.maskedEarly++;
  }
  const [{ Game }, { viewFor }, { read }, { briefing }] = await Promise.all([
    import(pathToFileURL(path.join(root, 'core/test/helpers.mjs')).href),
    import(pathToFileURL(path.join(root, 'core/rules/view.mjs')).href),
    import(pathToFileURL(path.join(root, 'core/agents/tools.mjs')).href),
    import(pathToFileURL(path.join(root, 'core/agents/briefing.mjs')).href),
  ]);
  const game = new Game({ n: 5, seed });
  const settled = game.night({ a01: { kind: 'hit', target: 'a03', place: 'mall', accept: ['a02'] },
    a02: { kind: 'back', target: 'a01' } });
  const log = game.log.slice(0, game.log.length - settled.events.length + settled.beforeDawn.eventCount);
  const stripped = log.map(event => { const copy = structuredClone(event); if (copy.type === 'show') delete copy.masked; return copy; });
  for (const id of Object.keys(settled.beforeDawn.state.agents)) {
    const actual = viewFor(settled.beforeDawn.state, log, id, 'agent');
    const expected = viewFor(settled.beforeDawn.state, stripped, id, 'agent');
    const brief = view => briefing(read(view, { audience: 'seat', seed: 'continuity' }).result);
    if (actual.events.some(e => e.type === 'show' && Object.hasOwn(e, 'masked'))
      || JSON.stringify(brief(actual)) !== JSON.stringify(brief(expected))) count.maskedInBriefing++;
  }
  totals[seed] = count;
  // The requested logic contract is arrival before the next change and scene.
  // C2: the drawing's own trip rule (continuity.js createTripRule, which draw.js's stateAt draws from): every
  // place change it draws, a jail ride's included, is cut when its trip is missing or runs past its deadline.
  if (drawing) {
    const rule = drawing.createTripRule({ timeline, planner, trips });
    for (const [id, list] of timeline.segs) for (let i = 0; i < list.length; i++) {
      const d = rule.at(id, i); if (!d?.cut) continue;
      count.deadlineCuts++;
      const day = Math.floor(list[i].start / 1440), kind = d.jail ? 'jail' : !d.trip ? 'missing' : list[i].start === showMinute(day) ? 'opening' : 'deadline';
      deadlineKinds[kind] = (deadlineKinds[kind] ?? 0) + 1;
      if (list[i].start === showMinute(day)) openingCuts[day] = (openingCuts[day] ?? 0) + 1;
      if (examples.length < 5) examples.push({ id, departure: d.dep, arrival: d.trip?.arr ?? null, deadline: d.deadline });
    }
  }
  // Without continuity.js (an older checkout): draw.js's restated deadline rule
  // above, reported as a separate integration gate. --drawing fails on it.
  const errors = Object.entries(count).filter(([k, v]) => !['changes', 'deadlineCuts'].includes(k) && v);
  drawingCuts += count.deadlineCuts;
  failed ||= errors.length > 0;
  console.log(`seed ${seed}: ${JSON.stringify(count)} openingCuts=${JSON.stringify(openingCuts)} rendererDeadlines=${JSON.stringify(deadlineKinds)}`);
  if (examples.length) console.log(`  examples ${JSON.stringify(examples)}`);
  console.log(`  show minutes ${plans.map(p => +(p.end - p.start).toFixed(3)).join(', ')}`);
}
console.log(`CONTINUITY LOGIC ${failed ? 'FAIL' : 'PASS'} ${JSON.stringify(totals)}`);
console.log(`DRAWING ${drawingCuts ? 'FAIL' : 'PASS'}: ${drawingCuts} trips the drawing still cuts`);
process.exitCode = failed || (process.argv.includes('--drawing') && drawingCuts) ? 1 : 0;
