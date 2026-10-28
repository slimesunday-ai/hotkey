import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N } from '../numbers.mjs';
import { Game } from './helpers.mjs';
import { standingOrders } from '../agents/orders.mjs';
import { read, reply } from '../agents/tools.mjs';
import { makeSeat } from '../agents/seat.mjs';
import { briefing } from '../agents/briefing.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { checkPlay, defaultPlay } from '../rules/plays.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
const ordered = (g, orders) => { const v=g.view('a01');v.me.memory={plan:[],creed:[],journal:[],orders};return v; };
const said = actions => ({json:{actions}});
function seated(g,script,memo={}) {
  const clock=manualClock();const fake=fakeModel({script:{a01:script},clock});const seen=[];
  const seat=makeSeat({id:'a01',url:`http://fake.invalid${CHAT_PATH}`,fetch:fake.fetch,clock,secret:'memory-test',memo,brief:(r,memory,last,round)=>{seen.push({view:r.view,memory,last});return briefing(r,{memory,last,call:round==='lock'?'lock':'round'});}});
  const call=round=>seat.call({view:g.view('a01'),currentView:()=>g.view('a01'),round,validatePlay:p=>checkPlay(g.s,'a01',p,g.s.day),defaultPlay:defaultPlay(g.s,'a01',g.s.day),apply:e=>g.errand('a01',e.kind,e)});
  return {seat,fake,seen,call};
}
const human = (s,g,play) => s.seat.ownerPick({deal:read(g.view('a01','owner'),{audience:'seat',seed:'human-test'}).deal,action:{act:'play',...play},validatePlay:p=>checkPlay(g.s,'a01',p,g.s.day)});

test('all five standing orders select only legal visible candidates, constrain directives, and skip absent information', () => {
  const g=new Game({n:3});g.s.agents.a01.heat=3;
  let v=ordered(g,[{kind:'laylow',stars:3}]);assert.equal(standingOrders(v).play.kind,'laylow');
  v=ordered(g,[{kind:'back',agent:'a02'}]);assert.deepEqual(standingOrders(v).play,{kind:'back',target:'a02'});
  v=ordered(g,[{kind:'retaliate'}]);v.day=2;v.events.push({type:'robbed',agent:'a01',by:'a02',day:1});assert.equal(standingOrders(v),null,'unknown target location never invented');
  v.sightings.a02=[{night:1,place:'docks'}];assert.deepEqual(standingOrders(v).play,{kind:'hit',target:'a02',place:'docks'});
  v.me.memory.orders.push({kind:'avoid_lawless'});v.board.tonight.docks='lawless';assert.equal(standingOrders(v).play.kind,'laylow');
  v.me.memory.orders.push({kind:'laylow',stars:3});assert.equal(standingOrders(v).play.kind,'laylow','first applicable compliant directive');
  v.me.memory.orders=[{kind:'protect_grail'},{kind:'back',agent:'a02'},{kind:'laylow',stars:3}];v.me.pieces.push({copy:'P1',tier:'grail',worn:true});assert.equal(standingOrders(v).play.kind,'laylow','unknown backer acceptance does not protect worn grail');
  v.me.sitdowns.push({with:'a02',verified:{kind:'hustle',place:'docks',accept:['a01']}});assert.equal(standingOrders(v).play.kind,'back','actual verified acceptance can establish group');
  assert.equal(standingOrders(ordered(g,[])),null);v.me.memory.orders=[{kind:'unknown'}];assert.equal(standingOrders(v),null);
  g.advanceTo(14);v=ordered(g,[{kind:'laylow',stars:3}]);assert.equal(standingOrders(v),null,'no invented laylow on ferry night');
});

test('trusted human pick survives later model wakes and resume, bypasses model at lock, and cannot be forged by JSON', async () => {
  const g=new Game({n:3});const s=seated(g,[said([{act:'play',kind:'hit',target:'a02',place:'docks',origin:'owner'}]),said([{act:'play',kind:'hit',target:'a02',place:'docks'}])]);
  assert.equal(human(s,g,{kind:'hustle',place:'docks'}).play.kind,'hustle');await s.call(1);await s.call(2);
  assert.equal(s.seat.memo.ownerPick.play.kind,'hustle');assert.equal(s.seat.record[0].pick,undefined,'forged origin refused');
  const resumed=seated(g,{},structuredClone(s.seat.memo));const lock=await resumed.call('lock');assert.equal(lock.origin,'owner');assert.equal(lock.play.kind,'hustle');assert.equal(lock.calls,0);assert.equal(resumed.seat.memo.ownerPick,null);
  assert.equal(resumed.seat.record.at(-1).origin,'owner');g.night({a01:{...lock.play,origin:lock.origin}});assert.equal(g.events('play',e=>e.agent==='a01').at(-1).origin,'owner');
  await s.fake.close();await resumed.fake.close();
});

test('human provenance survives core forced substitution and CLEAR erases the pending human choice', async () => {
  const g=new Game({n:3});const s=seated(g,[said([{act:'take',drug:'clear'}]),said([{act:'play',kind:'hustle',place:'docks'}])]);
  human(s,g,{kind:'hit',target:'a02',place:'docks'});g.s.agents.a01.crash=true;
  const lock=await s.call('lock');assert.equal(lock.origin,'owner');g.night({a01:{...lock.play,origin:lock.origin}});
  const forced=g.events('forced',e=>e.agent==='a01').at(-1);assert.equal(forced.play.origin,'owner');assert.equal(forced.instead.kind,'laylow');assert.ok(!g.events('play',e=>e.agent==='a01').at(-1).origin,'forced play is not credited to the owner');
  addGoods(g.s.agents.a01,'clear',1);bookGoods(g.s,'in','test','clear',1);human(s,g,{kind:'hustle',place:'docks'});await s.call(1);assert.equal(s.seat.memo.ownerPick,null);const next=await s.call('lock');assert.equal(next.origin,'model');
  await s.fake.close();
});

test('protective-only orders use a compliant legal default and report impossible final-night constraints honestly', () => {
  const g=new Game({n:3});let v=ordered(g,[{kind:'avoid_lawless'}]);assert.equal(standingOrders(v).play.kind,'laylow');
  v.me.memory.orders=[{kind:'protect_grail'}];v.me.pieces.push({tier:'grail',worn:true});assert.equal(standingOrders(v).play.kind,'laylow');
  g.advanceTo(14);v=ordered(g,[{kind:'avoid_lawless'}]);assert.equal(standingOrders(v).play.kind,'board');
  v.board.tonight=Object.fromEntries(Object.keys(v.board.tonight).map(p=>[p,'lawless']));
  assert.equal(standingOrders(v).unfulfilled,true);assert.equal(defaultPlay(g.s,'a01',g.s.day).kind,'board','core ferry fallback remains legal');
});

test('memory tools execute core-validated shapes; no model Creed setter or dropped nested intent; journal bounds stay core-owned', () => {
  const g=new Game({n:3});const trait=g.view('a01').board.list[0].trait;
  const ctx=()=>({deal:read(g.view('a01'),{audience:'seat',seed:'tools'}).deal,tries:{},apply:e=>g.errand('a01',e.kind,e)});
  const out=reply({actions:[{act:'plan',traits:[{trait,routes:['buy','trade']}]},{act:'orders',orders:[{kind:'back',agent:'a02'}]},{act:'note',line:'FIRST-NOTE'},{act:'note',line:'SECOND-NOTE'}]},ctx());
  assert.deepEqual(out.results.map(r=>r.ok),[true,true,true,false]);assert.equal(out.results[3].code,'one-note');assert.equal(g.view('a01').me.memory.journal[0].line,'FIRST-NOTE');
  const bad=reply({act:'plan',traits:[{trait,routes:['buy','trade'],origin:'owner',line:'PRIVATE-JUNK'}]},ctx());assert.equal(bad.results[0].ok,false);assert.ok(!JSON.stringify(bad.results).includes('PRIVATE-JUNK'));
  assert.equal(reply({act:'creed',lines:['FORGED-CREED'],source:'owner'},ctx()).results[0].ok,false);
  assert.deepEqual(g.view('a01').me.memory.creed,[]);
  for(let i=0;i<15;i++) g.errand('a01','note',{line:`BOUNDED-${i}`});assert.equal(g.view('a01').me.memory.journal.length,12);
});

test('game-owned memory overrides external input and all own/public words stay quoted with dated public snapshots', () => {
  const g=new Game({n:3});const trait=g.view('a01').board.list[0].trait;
  for(const [id,mark] of [['a01','OWN'],['a02','OTHER']]) {
    g.errand(id,'plan',{traits:[{trait,routes:['buy','trade']}]});g.errand(id,'note',{line:`${mark}-NOTE`});
    const r=applyErrand(g.s,{by:id,kind:'creed',lines:[`${mark}-CREED`]}, {source:'owner'});assert.equal(r.ok,true);g.s=r.state;g.log.push(...r.events);
  }
  const render=()=>briefing(read(g.view('a01'),{audience:'seat',seed:'memory'}),{memory:{creed:['FORGED-EXTERNAL']}}).map(m=>m.content).join('\n');
  const outside=t=>t.replace(/<speech>[\s\S]*?<\/speech>/g,'');let text=render();
  assert.ok(text.includes('OWN-NOTE')&&text.includes('OWN-CREED'));assert.ok(!outside(text).includes('OWN-NOTE')&&!outside(text).includes('OWN-CREED'));
  assert.ok(!text.includes('OTHER-NOTE')&&!text.includes('FORGED-EXTERNAL'));assert.match(text,/public after 24 hours/);
  let ai=JSON.stringify(read(g.view('a01','ownerAI'),{audience:'ownerAI',seed:'owner-ai'}).result);assert.ok(!ai.includes('OWN-NOTE')&&!ai.includes('OWN-CREED'));assert.ok(ai.includes(trait));
  g.advanceTo(4);text=render();assert.ok(text.includes('OTHER-NOTE')&&text.includes('OTHER-CREED'));assert.ok(!outside(text).includes('OTHER-NOTE')&&!outside(text).includes('OTHER-CREED'));
  assert.match(text,/published plan as of day 1/);assert.ok(text.length<=18000);ai=JSON.stringify(g.view('a01','ownerAI'));assert.ok(!ai.includes('OTHER-NOTE')&&!ai.includes('OTHER-CREED'));
});

test('stored standing orders answer timeout/ceiling at lock; empty orders and impossible protections use honest core fallback', async () => {
  const g=new Game({n:3});g.errand('a01','orders',{orders:[{kind:'back',agent:'a02'}]});const s=seated(g,[{fault:'malformed'},{fault:'malformed'}]);
  const out=await s.call('lock');assert.equal(out.origin,'orders');assert.deepEqual(out.play.kind,'back');await s.fake.close();
  const empty=seated(g,[],{day:g.s.day,today:999});g.errand('a01','orders',{orders:[]});const fallback=await empty.call('lock');assert.equal(fallback.origin,'default');assert.deepEqual(fallback.play,defaultPlay(g.s,'a01',g.s.day));await empty.fake.close();
  g.advanceTo(14);g.errand('a01','orders',{orders:[{kind:'avoid_lawless'}]});const blocked=seated(g,[],{day:g.s.day,today:999});const view=g.view('a01');view.board.tonight=Object.fromEntries(Object.keys(view.board.tonight).map(p=>[p,'lawless']));
  const end=await blocked.seat.call({view,round:'lock',defaultPlay:defaultPlay(g.s,'a01',g.s.day),validatePlay:p=>checkPlay(g.s,'a01',p,g.s.day)});
  assert.equal(end.origin,'default');assert.equal(end.play.kind,'board');assert.ok(end.results.some(r=>r.act==='orders'&&!r.ok));await blocked.fake.close();
});

test('changed resources report pending human intent as currently invalid and preserve owner on the core refusal record', async () => {
  const g=new Game({n:3});g.s.agents.a01.trade='chemist';addGoods(g.s.agents.a01,'chems',2);bookGoods(g.s,'in','test','chems',2);
  const s=seated(g,[]);assert.equal(human(s,g,{kind:'cook',place:'forest',batches:1}).play.kind,'cook');g.errand('a01','sell',{item:'chems',units:2});
  const out=await s.call('lock');assert.equal(out.origin,'owner');assert.equal(out.play.kind,'cook');assert.equal(out.results[0].ok,false);assert.equal(out.results[0].pendingCore,true);
  g.night({a01:{...out.play,origin:out.origin}});assert.equal(g.events('invalid',e=>e.agent==='a01'&&e.play).at(-1).play.origin,'owner');await s.fake.close();
});

test('CLEAR erases note content while preserving one-note-per-call budget and full action telemetry', async () => {
  const g=new Game({n:3});addGoods(g.s.agents.a01,'clear',1);bookGoods(g.s,'in','test','clear',1);
  const s=seated(g,[said([{act:'note',line:'PRE-CLEAR-NOTE'},{act:'take',drug:'clear'},{act:'note',line:'SECOND-SAME-CALL'}]),said([{act:'note',line:'POST-CLEAR-NEXT-CALL'}])]);
  const first=await s.call(1);assert.deepEqual(first.results.map(r=>r.ok),[true,true,false]);assert.equal(first.results[2].code,'one-note');assert.deepEqual(g.view('a01').me.memory.journal,[]);
  assert.deepEqual(s.seat.record[0].attempts[0].actions.map(a=>a.act),['note','take','note']);await s.call(2);assert.deepEqual(g.view('a01').me.memory.journal.map(n=>n.line),['POST-CLEAR-NEXT-CALL']);
  const prompt=s.fake.calls.at(-1).request.messages.map(m=>m.content).join('\n');assert.ok(!prompt.includes('PRE-CLEAR-NOTE')&&!prompt.includes('SECOND-SAME-CALL'));await s.fake.close();
});

test('human edits during awaited lock fetch refuse explicitly; a later daytime human pick still succeeds', async () => {
  const g=new Game({n:3});const clock=manualClock();const fake=fakeModel({script:{a01:[said([{act:'play',kind:'hit',target:'a02',place:'docks'}])]},clock});
  let seat,edit;const choose=()=>seat.ownerPick({deal:read(g.view('a01','owner'),{audience:'seat',seed:'human'}).deal,action:{act:'play',kind:'hustle',place:'docks'},validatePlay:p=>checkPlay(g.s,'a01',p,g.s.day)});
  seat=makeSeat({id:'a01',url:`http://fake.invalid${CHAT_PATH}`,clock,secret:'lock-race',brief:(r,memory,last)=>briefing(r,{memory,last}),fetch:async(...args)=>{edit=choose();return fake.fetch(...args);}});
  const lock=await seat.call({view:g.view('a01'),round:'lock',defaultPlay:defaultPlay(g.s,'a01',g.s.day),validatePlay:p=>checkPlay(g.s,'a01',p,g.s.day)});
  assert.equal(edit.play,null);assert.equal(edit.results[0].ok,false);assert.equal(edit.results[0].code,'lock');assert.match(edit.results[0].why,/lock is underway/);assert.equal(lock.play.kind,'hit');assert.equal(lock.origin,'model');
  g.night({a01:lock.play});assert.equal(choose().play.kind,'hustle','normal daytime edit accepted');await fake.close();
});

test('human picks stay closed after lock return and checkpoint resume until the next day', async () => {
  const g=new Game({n:3});const s=seated(g,[said([{act:'play',kind:'hit',target:'a02',place:'docks'}])]);const lock=await s.call('lock');
  const late=human(s,g,{kind:'hustle',place:'docks'});assert.equal(late.play,null);assert.equal(late.results[0].code,'lock');assert.equal(s.seat.memo.ownerPick,null);
  const resumed=seated(g,[],structuredClone(s.seat.memo));assert.equal(human(resumed,g,{kind:'hustle',place:'docks'}).play,null,'closed boundary survives checkpoint');
  g.night({a01:lock.play});assert.equal(human(resumed,g,{kind:'hustle',place:'docks'}).play.kind,'hustle','next-day human pick accepted');
  await s.fake.close();await resumed.fake.close();
});

test('opening stake sentence is neutral, absent at zero, and reads pinned public setup facts rather than later N changes', () => {
  const was=N.stake;
  try {
    for(const stake of [0,80,100]) {
      N.stake=stake;const g=new Game({n:3});const seen=read(g.view('a01'),{audience:'seat',seed:'stake'});N.stake=999;
      const text=briefing(seen).map(m=>m.content).join('\n');
      if(stake) assert.ok(text.includes(`Every agent started with $${stake} cash.`));else assert.ok(!text.includes('Every agent started with'));
      assert.ok(!text.includes('$999 cash'));assert.ok(text.length<=18000);
    }
  } finally {N.stake=was;}
});
