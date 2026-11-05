// GAME §41, 10-31, slime: "Do your recommendation here". Deferred public jobs
// keep their cast, venue, publication time, trips and full minimum after close.
// --root demonstrates failure on an untouched tree; --feeds selects existing
// scripted fixtures without generating or changing any core files.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const root = path.resolve(arg('--root') ?? fileURLToPath(new URL('../../../', import.meta.url)));
const load = name => import(pathToFileURL(path.join(root, 'style/city/simstate/record', name)).href);
const [{ createRoutinePlanner }, { createShowPlanner, createShowPlayer }, { targetsAt }, { createTrips },
  { revealAt, createRecordPlayer }, { parseFeed }, { meetingPlace }, { buildTimeline, createTripRule }] = await Promise.all([
  load('routines.js'), load('show-plan.js'), load('placement.js'), load('trips.js'), load('player.js'), load('adapter.js'), load('routine-places.js'), load('continuity.js'),
]);
const DAY = 1440, trips = createTrips(), eps = 1e-7;
const travelId = p => p.corePlace === 'home' ? p.cityPlace : p.standPlace ?? p.cityPlace;
const roster = ['a','b','c'].map(id => ({id,trade:'chemist',fit:[],walk:null,crew:null,jailed:false,evicted:false}));
const board = {agents:roster,corners:[]};
const frame = (i, day, minute, events, kind = 'errand', state) => ({i,day,minute,t:day*2+(kind==='night'?1:0),
  step:{kind},events,sightings:{},...(state ? {board:state} : {})});
const event = (id, day, minute, type, fields) => ({id,day,minute,t:day*2,type,...fields});
function fixture(day = 1, nightMinute = day*DAY+1264.99) {
  const at = day*DAY+1264.9;
  const jobs = [event(1,day,at,'meet',{a:'a',b:'b',sitdown:'late-one'}),
    event(2,day,at+.01,'act',{agent:'c',kind:'bribe',place:'precinct',counterpart:{kind:'cops'}}),
    event(3,day,at+.02,'act',{agent:'a',kind:'give',place:'meeting',counterpart:{kind:'agent',id:'c'}}),
    event(4,day,at+.03,'meet',{a:'a',b:'b',sitdown:'late-two'}),
    event(5,day,at+.04,'act',{agent:'a',kind:'ask',place:'current',counterpart:{kind:'agent',id:'b'}})];
  const show = event(6,day,nightMinute,'show',{night:day,seen:{a:'forest',b:'downtown',c:'home'},hooded:{},
    plays:{a:{kind:'cook',place:'forest'},b:{kind:'hustle',place:'downtown'},c:{kind:'laylow',place:'home'}}});
  const start = frame(0,day,day*DAY+360,[event(0,day,day*DAY+360,'season',{seed:404})],'setup',board);
  return { jobs, frames:[start,...jobs.map((e,i)=>frame(i+1,day,e.minute,[e])),
    frame(6,day,nightMinute,[show],'night'),frame(7,day+1,(day+1)*DAY+600,[],'dawn')] };
}
function guarded(frames, minute) {
  return frames.map(f => {
    if (revealAt(f) <= minute) return f;
    const copy = {...f};
    for (const key of ['events','board','sightings']) Object.defineProperty(copy,key,{get(){throw new Error(`future ${key} at ${minute}`);}});
    return copy;
  });
}
function verify({frames,jobs}, label) {
  const day=jobs[0].day, shows=createShowPlanner(frames), plan=shows.night(day), routines=createRoutinePlanner(frames);
  const end = Math.max(plan.end+300, ...frames.map(revealAt));
  const daily=routines.day(day,end), cues=[...daily.meetings,...daily.acts].filter(c=>jobs.some(e=>e.id===c.eventId))
    .sort((a,b)=>a.departure-b.departure || a.minute-b.minute);
  assert.equal(cues.length,jobs.length,`${label}: all queued jobs staged`);
  assert.deepEqual(cues.map(c=>c.eventId),jobs.map(e=>e.id),`${label}: publication order`);
  const positions=new Map(plan.movements.map(m=>[m.agent,{place:m.place,ready:m.arrival}]));
  let until=plan.end;
  const points=new Set([jobs[0].minute-.01,...jobs.map(e=>e.minute),plan.start-.0001,plan.start,plan.end-.0001,plan.end]);
  if(day===14) assert(plan.end>=plan.finale.leave.end, 'night 14 queue is after ferry');
  for(const cue of cues) {
    const e=jobs.find(e=>e.id===cue.eventId), ids=e.type==='meet'?[e.a,e.b]:[e.agent,...(e.kind==='give'?[e.counterpart.id]:[])];
    assert.equal(cue.published,e.minute); assert(!cue.cut&&!cue.blocked);
    assert(cue.departure>=until-eps,`${label}: serial queue after close`);
    if(e.type==='meet') assert.deepEqual(cue.place,meetingPlace(e.a,e.b).place);
    else { assert.equal(cue.kind,e.kind); assert.deepEqual(cue.counterpart,e.counterpart); assert.deepEqual(cue.participants,ids); }
    const minimum=ids.length===2?5:2; assert.equal(cue.minimum,minimum);
    let arrival=cue.departure;
    for(const id of ids) {
      const previous=positions.get(id);
      assert(cue.departure>=previous.ready-eps,`${label}: final show/previous trip finishes for ${id}`);
      const trip=travelId(previous.place)===travelId(cue.place)||cue.place.cityPlace==='jail'?null
        :trips.plan(id,travelId(previous.place),travelId(cue.place),cue.departure);
      arrival=Math.max(arrival,trip?.arr??cue.departure);
      positions.set(id,{place:cue.place,ready:cue.minute+minimum});
    }
    assert(Math.abs(cue.minute-arrival)<eps,`${label}: trips.js arrival for ${cue.eventId}`);
    for(const m of [cue.departure,cue.minute,cue.minute+minimum/2,cue.minute+minimum-.0001,cue.minute+minimum]) points.add(m);
    for(const m of [cue.minute,cue.minute+minimum/2,cue.minute+minimum-.0001]) {
      const rows=routines.at(m), snapshot=createShowPlayer(frames).seek(m), targets=targetsAt(snapshot,m,routines);
      for(const id of ids) {
        const row=rows.find(r=>r.agent===id), target=targets.find(r=>r.agent===id);
        assert.equal(e.type==='meet'?row.meet:row.errand,e.id,`${label}: full minimum for ${id}`);
        assert.equal(e.type==='meet'?target.meet:target.errand,e.id,`${label}: post-show placement for ${id}`);
        assert.equal(target.cityPlace,cue.place.cityPlace);
      }
    }
    until=cue.minute+minimum;
  }
  const played=createShowPlayer(frames,{speed:60}); played.play();
  for(const m of [...points].sort((a,b)=>a-b)) {
    played.advance(m-played.minute);
    const snap=played.snapshot();
    assert.deepEqual(targetsAt(createShowPlayer(frames).seek(m),m,createRoutinePlanner(frames)),targetsAt(snap,m,routines),`${label}: seek = play ${m}`);
  }
  for(const m of [...points].sort((a,b)=>b-a)) {
    const prefix=createRoutinePlanner(frames.filter(f=>revealAt(f)<=m)), guard=createRoutinePlanner(guarded(frames,m));
    assert.deepEqual(routines.at(m),prefix.at(m),`${label}: reverse = fresh ${m}`);
    assert.deepEqual(guard.at(m),prefix.at(m),`${label}: no future payload ${m}`);
    assert.deepEqual(routines.day(day,m),prefix.day(day,m),`${label}: day prefix ${m}`);
  }
  const timeline=buildTimeline(frames,createRoutinePlanner(frames),shows), rule=createTripRule({timeline,planner:shows,trips});
  let checked=0;
  for(const cue of cues) for(const id of cue.participants??[cue.a,cue.b]) {
    const list=timeline.segs.get(id), i=list.findLastIndex(s=>s.start<=cue.minute);
    const segment=list[i], row=[{start:segment.start,t:segment.t},...(segment.more??[])].findLast(r=>r.start<=cue.minute).t;
    assert.equal(cue.participants?row.errand:row.meet,cue.eventId,`${label}: drawing timeline includes arrival`);
    if(day===14) assert(!list.some(s=>s.start>=plan.finale.leave.start && s.start<cue.departure && s.t.reason==='departed'), `${label}: ferry leaves a physical origin for queued walker`);
    const ride=rule.at(id,i);
    if(ride) { assert(!ride.cut,`${label}: drawing has no interrupted trip`); checked++; }
  }
  for(const [id,list] of timeline.segs) for(let i=0;i<list.length;i++) {
    if(list[i].start<plan.start || list[i].start>until+60) continue;
    const ride=rule.at(id,i);
    if(ride&&!ride.jail) assert(!ride.cut,`${label}: uninterrupted drawing trip for ${id} at ${list[i].start}`);
  }
  console.log(`${label}: drawing timeline has every cue, ${checked} continuous trip intervals PASS`);
  console.log(`${label}: ${cues.length} jobs, full minima, trips.js origins, publication order; ${points.size} seek/play/guarded prefixes PASS`);
}
const ordinary=fixture();
verify(ordinary,'ordinary close');
const ordered=fixture();
ordered.jobs=[event(1,1,2700.5,'meet',{a:'a',b:'b',sitdown:'older'}),
  event(2,1,2700.75,'act',{agent:'a',kind:'ask',place:'current',counterpart:{kind:'agent',id:'b'}})];
ordered.frames=[ordered.frames[0],frame(1,1,2699,[event(99,1,2699,'act',
  {agent:'a',kind:'ask',place:'current',counterpart:{kind:'agent',id:'b'}})]),
  ...ordered.jobs.map((e,i)=>frame(i+2,1,e.minute,[e])),
  {...ordered.frames.at(-2),i:4},{...ordered.frames.at(-1),i:5}];
verify(ordered,'older queued pair before later fitting phone');
const growing=ordinary.frames.slice(0,-2), growingPlanner=createRoutinePlanner(growing);
growingPlanner.at(ordinary.jobs.at(-1).minute);
growing.push(...ordinary.frames.slice(-2));
assert.deepEqual(growingPlanner.at(2800),createRoutinePlanner(ordinary.frames).at(2800),'appended public night equals full archive');
console.log('incremental publication: queued prefix resumes when its night arrives PASS');
const burst=fixture(), minute=2700.5;
burst.jobs=Array.from({length:4},(_,i)=>event(i+1,1,minute,'act',{agent:'a',kind:'ask',place:'current',counterpart:{kind:'agent',id:'b'}}));
burst.frames=[burst.frames[0],frame(1,1,minute,burst.jobs),
  {...burst.frames.at(-2),i:2}, {...burst.frames.at(-1),i:3}];
const burstPlan=createRoutinePlanner(burst.frames).day(1), burstShow=createShowPlanner(burst.frames).night(1);
assert.equal(burstPlan.acts.length,4,'all parts of a split burst survive');
assert(burstPlan.acts.slice(0,2).every(c=>c.minute+c.minimum<=2705));
assert(burstPlan.acts.slice(2).every(c=>c.departure>=burstShow.end&&!c.blocked));
console.log('partial visit: 2 fitting acts before opening, 2 complete acts after close PASS');
verify(fixture(1,2864.9),'midnight close');
// The same physical data as the seeded finale, without changing any core receipt.
const feeds=path.resolve(arg('--feeds')??path.join(root,'core/runs'));
const source=parseFeed(fs.readFileSync(path.join(feeds,'405-A/feed.jsonl'),'utf8'));
const night=source.find(f=>f.day===14&&f.step.kind==='night');
const before=source.slice(0,source.indexOf(night)).findLast(f=>f.board).board;
const ids=before.agents.filter(a=>!a.jailed).slice(0,3).map(a=>a.id);
const finale=fixture(14), renamed=new Map([['a',ids[0]],['b',ids[1]],['c',ids[2]]]);
finale.jobs=finale.jobs.map(e=>({...e,agent:renamed.get(e.agent),a:renamed.get(e.a),b:renamed.get(e.b),
  ...(e.counterpart?{counterpart:{...e.counterpart,...(e.counterpart.id?{id:renamed.get(e.counterpart.id)}:{})}}:{})}));
finale.frames=[{...finale.frames[0],board:before},...finale.jobs.map((e,i)=>frame(i+1,14,e.minute,[e])),
  {...night,i:6},frame(7,15,15*DAY+600,[],'dawn')];
verify(finale,'night 14 after ferry');
const returning=structuredClone(finale), returningNight=returning.frames.find(f=>f.step.kind==='night');
const receipt=returningNight.events.find(e=>e.type==='board'&&e.agent===ids[0]);
assert(receipt,'synthetic missed boat starts with a published boarder');
receipt.type='missed';
if(returningNight.board) returningNight.board.agents.find(a=>a.id===ids[0]).boarded=false;
const returningPlan=createShowPlanner(returning.frames).night(14);
assert(returningPlan.movements.findLast(m=>m.agent===ids[0]).arrival>returningPlan.end,'missed return trip extends beyond close');
verify(returning,'night 14 unfinished return');
// No night 15 exists, so late day-15 work starts as soon as its actual walk finishes.
const day15=fixture(15), noShow=day15.frames.filter(f=>f.step.kind!=='night'), p=createRoutinePlanner(noShow);
const dayPlan=p.day(15,16*DAY+360);
assert.equal(dayPlan.meetings.length+dayPlan.acts.length,5,'day 15 has no blocked jobs');
for(const c of [...dayPlan.meetings,...dayPlan.acts]) {
  assert(!c.blocked&&!c.cut); assert(c.departure>=c.published);
  for(const id of c.participants??[c.a,c.b]) {
    const minute=c.minute+c.minimum-.0001, snap=createRecordPlayer(noShow).seek(minute);
    const target=targetsAt(snap,minute,p).find(r=>r.agent===id);
    assert.equal(c.participants?target.errand:target.meet,c.eventId,'day 15 full visible minimum');
  }
}
console.log('day 15: 5 late jobs staged without a next show PASS');
console.log('LATEMEETCHECK PASS');
