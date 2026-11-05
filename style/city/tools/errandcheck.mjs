// GAME §41, 10-31: "Who and where show". Independent receipt coverage,
// live allow-list, travel and minimum intervals; no model, server or drawing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import os from 'node:os';
const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const root = path.resolve(arg('--root') ?? fileURLToPath(new URL('../../../', import.meta.url)));
const feeds = path.resolve(arg('--feeds') ?? path.join(root, 'core/runs'));
const load = name => import(pathToFileURL(path.join(root, 'style/city/simstate/record', name)).href);
const [{ createRoutinePlanner }, { parseFeed }, { createTrips }, { revealAt, createRecordPlayer }, { targetsAt }] = await Promise.all([
  load('routines.js'), load('adapter.js'), load('trips.js'), load('player.js'), load('placement.js'),
]);
// Only errand receipts: dawn's expiry/holdings/betrayal and night results aren't errands.
const privateReceipt = e => e.t % 2 === 0 && (['viewer-act', 'wear', 'bid', 'order', 'fence', 'give', 'pay', 'stash', 'ask',
  'decline', 'say', 'overheard', 'chat', 'tip', 'bribe', 'bounty', 'look', 'write', 'invalid'].includes(e.type)
  || e.type === 'close' && e.why === 'closed'
  || e.type === 'memory' && !['clear', 'dawn'].includes(e.part)
  || e.type === 'crew' && e.act === 'invite');
const travelId = p => p.corePlace === 'home' ? p.cityPlace : p.standPlace ?? p.cityPlace;
const { runSeason } = await import(pathToFileURL(path.join(root, 'core/bench/runner.mjs')).href);
const { CASTS } = await import(pathToFileURL(path.join(root, 'core/bench/bots.mjs')).href);
let failed = false;
for (const seed of [404, 405, 406]) {
  const dir = path.join(feeds, `${seed}-A`);
  const log = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
  const frames = parseFeed(fs.readFileSync(path.join(dir, 'feed.jsonl'), 'utf8'));
  const ids = new Map(ck.feed.exporter.ids), events = frames.flatMap(f => f.events);
  // The bot tape emits acceptance as meet alone; speech is a separate errand.
  const expected = log.filter(e => privateReceipt(e) || e.type === 'take'
    && !log.some(h => h.type === 'high' && h.n === e.n + 1));
  const planner = createRoutinePlanner(frames), trips = createTrips(), player = createRecordPlayer(frames);
  const points = new Set(frames.map(revealAt));
  const plans = Array.from({ length: 15 }, (_, d) => planner.day(d, d * 1440 + 1265));
  const expectedIds = new Set(expected.map(e => ids.get(`act:${e.n}`)));
  const count = { expected: expected.length, live: events.filter(e => e.type === 'act').length,
    unexpected: events.filter(e => e.type === 'act' && !expectedIds.has(e.id)).length,
    missing: 0, duplicate: 0, wrongMinute: 0, detailFields: 0, missingStage: 0, absent: 0, interrupted: 0, late: 0,
    earlyDetail: 0, maskedFightMissing: 0, maskedFightWrong: 0, blocked: 0, placement: 0, castMismatch: 0, phoneTravel: 0, visitGaps: 0 };
  const allowed = ['id', 't', 'day', 'type', 'agent', 'kind', 'counterpart', 'place', 'minute'];
  for (const receipt of expected) {
    const acts = events.filter(e => e.id === ids.get(`act:${receipt.n}`));
    if (acts.length !== 1) { count[acts.length ? 'duplicate' : 'missing']++; continue; }
    const act = acts[0], frame = frames.find(f => f.events.includes(act));
    if (act.type !== 'act' || act.day !== receipt.day || frame.t !== receipt.t || frame.step.kind !== 'errand') count.wrongMinute++;
    if (Object.keys(act).some(k => !allowed.includes(k)) || Object.keys(act.counterpart ?? {}).some(k => !['kind', 'id'].includes(k))) count.detailFields++;
    const cue = plans[act.day]?.acts?.find(c => c.eventId === act.id);
    if (!cue) { count.missingStage++; continue; }
    // §41: "Watch the action live". Orchestrator: single-agent acts >=2m; only give/pay require a second physical agent and 5m.
    const actors = [...new Set([act.agent, ...(['give','pay'].includes(act.kind) ? [act.counterpart.id] : [])])];
    const minimum = actors.length > 1 ? 5 : 2;
    if (cue.published !== act.minute || cue.departure < act.minute || cue.minute < cue.departure || cue.minimum < minimum) count.wrongMinute++;
    if (cue.participants && JSON.stringify(cue.participants.slice().sort()) !== JSON.stringify(actors.slice().sort())) count.castMismatch++;
    if (cue.blocked) {
      count.blocked++;
      console.log(`  BLOCKED ${JSON.stringify({seed,day:act.day,agent:act.agent,kind:act.kind,counterpart:act.counterpart,published:act.minute,place:cue.place.cityPlace,by:cue.blockedBy})}`);
      continue;
    }
    for (const minute of [act.minute, cue.departure, cue.minute, cue.minute + cue.minimum - .00001, cue.minute + cue.minimum]) points.add(minute);
    for (const id of new Set(actors)) {
      const list = plans[act.day].entries.filter(r => r.agent === id);
      const visit = plans[act.day].acts.find(c => c.eventId === (cue.visit ?? cue.eventId));
      const travel = list.find(r => r.source.kind === 'act-travel' && r.source.eventId === visit.eventId);
      const previous = travel && list[list.indexOf(travel) - 1];
      if (travel && previous && travelId(previous.place) !== travelId(cue.place)) {
        const trip = trips.plan(id, travelId(previous.place), travelId(cue.place), visit.departure);
        if (!trip || trip.arr > cue.minute + 1e-7) count.late++;
        if (['ask','answer','decline','say','close','chat','crew_invite','listen','write','plan','orders','note','creed','tip','lookout'].includes(act.kind)) count.phoneTravel++;
      }
      for (const minute of [cue.minute, cue.minute + cue.minimum / 2, cue.minute + cue.minimum - .00001]) {
        const row = planner.at(minute).find(r => r.agent === id);
        if (row?.errand !== act.id || travelId(row.place) !== travelId(cue.place)) count.absent++;
        const drawn = targetsAt(player.seek(minute), minute, planner).find(r => r.agent === id);
        if (drawn?.errand !== act.id || drawn.cityPlace !== cue.place.cityPlace) count.placement++;
      }
      const next = list.find(r => r.minute > cue.minute && r.errand !== act.id);
      if (next && next.minute < cue.minute + cue.minimum - 1e-7) count.interrupted++;
    }
  }
  for (const plan of plans) {
    const visits = new Map();
    for (const cue of plan.acts ?? []) if (!cue.blocked && cue.visit !== undefined) {
      const list = visits.get(cue.visit) ?? []; list.push(cue); visits.set(cue.visit,list);
    }
    for (const cues of visits.values()) for (let i=1;i<cues.length;i++) {
      if (Math.abs(cues[i].minute - cues[i-1].minute - cues[i-1].minimum) > 1e-7) count.visitGaps++;
    }
  }
  for (const frame of frames) for (const event of frame.events) {
    const raw = log.find(e => ids.get(e.n) === event.id);
    if (raw?.vis.to !== 'all' && raw && frame.t < raw.vis.pub && !event.card) count.earlyDetail++;
  }
  // Read resolved membership from the core in a $0 replay, never event prose
  // or a guess from a district shared by two fights. Includes interrupted
  // backers defending themselves (404 n11 a09; 406 n11 a26).
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'errandcheck-'));
  try {
    runSeason({ seed, rule: 'A', mix: CASTS.layer4, outDir: temporary, observe({ at, day, result }) {
      if (at !== 'night') return;
      const show = log.find(e => e.type === 'show' && e.night === day);
      const rawFights = log.filter(e => e.type === 'fight' && e.night === day);
      for (const [id, anchor] of Object.entries(show.masked ?? {})) {
        const attack = result.fights.fights.findIndex(f => f.attackers.some(g => g.members.includes(id)));
        const index = attack >= 0 ? attack : result.fights.fights.findIndex(f => f.defenders.includes(id));
        const wanted = index < 0 ? undefined : rawFights[index].n;
        if (wanted !== undefined && anchor.fight === undefined) count.maskedFightMissing++;
        else if (anchor.fight !== wanted) count.maskedFightWrong++;
        for (const form of events.filter(e => e.type === 'show' && e.night === day)) {
          if (form.masked?.[id]?.fight !== (wanted === undefined ? undefined : ids.get(wanted))) count.maskedFightWrong++;
        }
      }
    } });
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  // Advancing under throwing future-payload getters must equal reverse seeks
  // into the already-built full archive at EVERY act boundary/publication.
  let horizon = -1;
  const guarded = frames.map(frame => new Proxy(frame, { get(target, key) {
    if (['board','events','sightings'].includes(key) && revealAt(target) > horizon) throw new Error(`future ${String(key)} at ${horizon}`);
    return Reflect.get(target, key);
  } }));
  const prefix = createRoutinePlanner(guarded);
  for (const minute of [...points].sort((a,b) => a-b)) {
    horizon = minute;
    assert.deepEqual(prefix.at(minute), planner.at(minute), `seed ${seed} reverse/guarded prefix ${minute}`);
    const day = Math.floor(minute / 1440);
    assert.deepEqual(prefix.day(day, minute), planner.day(day, minute), `seed ${seed} day-plan prefix ${minute}`);
  }
  console.log(`  ${points.size} act/publication boundaries: guarded forward = full-archive reverse`);
  const errors = Object.entries(count).filter(([k,v]) => !['expected','live'].includes(k) && v);
  failed ||= errors.length > 0;
  console.log(`seed ${seed}: ${JSON.stringify(count)}`);
}

// Exercise the physical-cast exception independently of season habits.
const [{ addressesFor }, { SITES }] = await Promise.all([load('addresses.js'),load('places.js')]);
const ids = ['caller','keeper','prisoner'];
const board = { agents: ids.map(id=>({id,trade:'chemist',fit:[],crew:null,walk:null,jailed:id!=='caller',evicted:false})),corners:[] };
const base = {i:0,t:2,day:1,minute:1800,step:{kind:'setup'},sightings:{},board,
  events:[{id:0,t:2,day:1,minute:1800,type:'season',seed:404}]};
const act = (id,kind,place,agent='caller',counterpart={kind:'agent',id:'keeper'})=>({id,t:2,day:1,minute:2100,type:'act',agent,kind,place,counterpart});
const synthetic = createRoutinePlanner([base,{i:1,t:2,day:1,minute:2100,step:{kind:'errand',round:1},sightings:{},events:[
  act(1,'ask','current'),act(2,'stash_put','keeper-home','caller',{kind:'keeper',id:'keeper'}),
  act(3,'fence_list','fence','caller',{kind:'fence'}),act(4,'shop','home','caller',{kind:'fence'}),
  act(5,'fence_buy','fence','caller',{kind:'fence'}),act(6,'close','current'),
  act(7,'stash_take','keeper-home','prisoner',{kind:'keeper',id:'keeper'}),
]}]);
const syntheticPlan = synthetic.day(1,2705);
if (syntheticPlan.acts?.[0]?.participants) {
  const cue = id => syntheticPlan.acts.find(c=>c.eventId===id);
  assert.deepEqual(cue(1).participants,['caller']);
  assert.notEqual(cue(1).place.cityPlace,SITES.jail.cityPlace);
  assert.equal(cue(1).minute,2100);
  assert.equal(cue(6).minute,2102);
  assert.deepEqual(cue(2).participants,['caller']);
  assert.equal(cue(2).place.cityPlace,addressesFor(ids).keeper.home);
  assert.equal(cue(7).place.cityPlace,SITES.jail.cityPlace);
  assert.deepEqual(cue(7).participants,['prisoner']);
  assert.ok(syntheticPlan.acts.every(c=>!c.blocked&&c.minimum===2));
  assert.equal(cue(3).visit,cue(5).visit);
  assert.equal(cue(5).minute,cue(3).minute+2);
  assert.equal(cue(3).place.corePlace,'fence');
  assert.equal(syntheticPlan.entries.filter(r=>r.agent==='caller'&&r.source.kind==='act-travel'&&r.source.eventId===3).length,1);
  for(const c of syntheticPlan.acts) assert.equal(synthetic.at(c.minute).find(r=>r.agent==='keeper').place.cityPlace,SITES.jail.cityPlace);
  console.log('Synthetic: remote phone counterpart, actor-only stash, jailed actor, nonconsecutive fence burst, single trip PASS');
}

// §41, 10-31: "Do your recommendation here"; the deadline is the 21:05 show.
// This original bribe fits that gap; latemeetcheck also covers a deferred bribe.
const lateFrames = [
  { i: 0, t: 2, day: 1, minute: 1800, step: {kind:'setup'}, sightings: {},
    board: {agents:[{id:'late',trade:'chemist',fit:[],crew:null,walk:null,jailed:false,evicted:false}],corners:[]},
    events:[{id:0,t:2,day:1,minute:1800,type:'season',seed:404}] },
  { i: 1, t: 2, day: 1, minute: 2699.999, step: {kind:'errand',round:1}, sightings: {},
    events:[{id:1,t:2,day:1,minute:2699.999,type:'act',agent:'late',kind:'bribe',counterpart:{kind:'cops'},place:'precinct'}] },
];
const late = createRoutinePlanner(lateFrames), latePlan = late.day(1,2705);
if (latePlan.acts) {
  assert.equal(latePlan.acts.length,1);
  // §41, 10-31: "Do your recommendation here"; the synthetic blocked bribe count is now zero.
  assert.equal(latePlan.acts[0].blocked,false);
  // §41, 10-31: "Do your recommendation here"; both the walk and full live act are staged.
  assert.ok(latePlan.entries.some(row=>row.errand===1) && latePlan.entries.some(row=>row.source.kind==='act-travel'));
  // §41, 10-31: "Do your recommendation here"; report the uncropped act before 21:05.
  console.log(`Late submission: 0 blocked cues; bribe published 2699.999, arrival ${latePlan.acts[0].minute}; full act before 21:05`);
}
console.log(`ERRANDCHECK ${failed ? 'FAIL' : 'PASS'}`);
process.exitCode = failed ? 1 : 0;
