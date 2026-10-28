// C1-7 node properties. Faults mutate returned plans in memory, never fixtures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseFeed } from '../simstate/record/adapter.js';
import { createShowPlanner, createShowPlayer, planShow } from '../simstate/record/show-plan.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const controls = ['missing-set', 'missing-actor', 'missing-beat', 'early-beat', 'hooded-name', 'wrong-route', 'missing-walk', 'missing-missed', 'missing-route-fight', 'early-mint', 'lost-cuffs', 'missing-guard'];
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => assert.deepEqual(a, b, `PROPERTY ${label}`);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function feed(seed, rule) {
  const file = path.join(ROOT, `core/runs/${seed}-${rule}/feed.jsonl`);
  if (!fs.existsSync(file)) {
    const args = ['core/bench/runner.mjs', '--seed', String(seed), '--rule', rule, '--cast', 'layer4', '--feed', '--out', 'core/runs'];
    const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  return freeze(parseFeed(fs.readFileSync(file, 'utf8')));
}
const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const has = (scene, name) => scene.beats?.some(b => b.name === name);
const counts = { seasons: 0, nights: 0, sets: 0, beats: 0, walks: 0, boarded: 0, missed: 0, routeFights: 0, dockArrests: 0, mints: 0, vaults: 0, lostVaults: 0 };
const receipts = { gather: 0, craft: 0, cook: 0, grab: 0, vault: 0 };
const drops = new Set(), cooks = new Set(), routes = new Set(), vaultSeasons = [];
let planted = false;
function mutate(plan, show, frame) {
  if (planted || !fault) return;
  const set = plan.scenes.find(s => s.kind === 'run' && s.beat === 'ambient');
  const hidden = Object.keys(show.hooded).length && frame.board.agents.find(a => !Object.hasOwn(show.seen, a.id))?.id;
  if (['missing-set', 'missing-actor', 'missing-beat', 'early-beat'].includes(fault) && set) {
    if (fault === 'missing-set') plan.scenes.splice(plan.scenes.indexOf(set), 1);
    if (fault === 'missing-actor') { set.actors = []; set.publicActors = []; }
    if (fault === 'missing-beat') set.beats = [];
    if (fault === 'early-beat') set.beats[0].start = frame.minute - 1;
  } else if (fault === 'hooded-name' && hidden && set) { set.actors.push(hidden); set.publicActors.push(hidden); }
  else if (fault === 'wrong-route' && frame.day === 14) plan.scenes.find(s => s.kind === 'board' && s.beat === 'finale').route = 'forest';
  else if (fault === 'missing-walk' && frame.day === 14) {
    const row=plan.scenes.find(s=>has(s,'walk')); row.beats=[];
  }
  else if (fault === 'missing-missed' && frame.day === 14 && plan.scenes.some(s=>s.kind==='missed')) plan.scenes=plan.scenes.filter(s=>s.kind!=='missed');
  else if (fault === 'missing-route-fight' && frame.day === 14 && plan.scenes.some(s => s.beat === 'fight' && s.kind === 'hit')) plan.scenes = plan.scenes.filter(s => !(s.beat === 'fight' && s.kind === 'hit'));
  else return;
  planted = true;
}
function sceneProperties(scene, plan, frame, show) {
  property(scene.start >= Math.max(frame.minute, plan.start) && scene.end <= plan.end && scene.end > scene.start, 'scene inside published window');
  if (!scene.beats) return;
  property(scene.actors && scene.eventIds?.length && scene.beats.length, 'staging shape has actors, source ids and beats');
  equal(scene.actors, scene.publicActors, 'actors alias matches C1-6 public actors');
  property(scene.actors.every(id => Object.hasOwn(show.seen, id)), 'no hooded actor');
  const hidden = (frame.board?.agents || []).filter(a => !Object.hasOwn(show.seen, a.id));
  const text = strings(scene);
  property(hidden.every(a => !text.includes(a.id) && (!a.name || !text.includes(a.name))), 'no hooded name anywhere');
  const available = new Set(frame.events.map(e => e.id));
  property(scene.eventIds.every(id => available.has(id)), 'only this frame supplies staging sources');
  let previous = scene.start;
  for (const beat of scene.beats) {
    property(beat.start >= previous && beat.start >= frame.minute && beat.end <= scene.end && beat.end > beat.start, 'ordered beat inside scene and after frame');
    property(beat.eventIds.length && beat.eventIds.every(id => scene.eventIds.includes(id)), 'beat sources belong to scene');
    previous = beat.end; counts.beats++;
  }
}
function nightProperties(plan, frame, board) {
  const show = frame.events.find(e => e.type === 'show');
  mutate(plan, show, frame);
  for (const scene of plan.scenes) sceneProperties(scene, plan, frame, show);
  for (const [id, play] of Object.entries(show.plays)) {
    if (!['vault', 'grab', 'build', 'run', 'cook', 'guard'].includes(play.kind)) continue;
    const scene = plan.scenes.find(s => s.beat === 'ambient' && s.kind === play.kind && s.actors?.includes(id));
    property(scene, `every public set has its kind and actor (${frame.day}/${id}/${play.kind})`);
    property(scene.beats?.length > 0 && scene.eventIds.includes(show.id), 'set has beats and public show source');
    if (play.kind === 'build') {
      property(['clamp','hammer','file','fit','assemble'].every(n => has(scene,n)), 'bench work beats');
      const home = board.agents.find(a => a.id === id);
      property(scene.place.corePlace === (home.evicted ? 'heap' : 'home'), 'build uses existing home placement');
    }
    if (play.kind === 'cook') {
      cooks.add(play.place);
      property(['stir','pour','check'].every(n => has(scene,n)), 'cook batch beats');
      property(play.place !== 'forest' || has(scene,'fan'), 'woods cook fans steam');
    }
    if (play.kind === 'run') {
      drops.add(play.place);
      const required = play.place === 'forest' ? ['dig','unearth','carry'] : play.place === 'docks' ? ['container','lift','carry'] : ['search','pick_up','carry'];
      property(required.every(n => has(scene,n)), 'run beats follow typed drop place');
      equal(scene.place.corePlace, play.place, 'run uses its public drop');
    }
    if (play.kind === 'guard') property(has(scene,'post'), 'vault guard post');
    counts.sets++;
  }
  for (const event of frame.events.filter(e => e.type === 'fight' && ['vault','grab'].includes(e.kind))) {
    const scene = plan.scenes.find(s => s.eventIds?.includes(event.id) && s.beat === 'fight');
    property(scene?.kind === event.kind, 'set fight keeps kind and source');
    const named = Object.entries(show.plays).filter(([,p]) => p.kind === event.kind || event.kind === 'vault' && p.kind === 'guard').map(([id])=>id).sort();
    equal(scene.actors, named, 'set has all public jobbers/grabbers and guards without guessing backers');
    const names = event.kind === 'vault' ? ['shove', ...(event.won ? ['drill','heave','carry'] : ['struggle'])] : ['scramble', ...(event.won ? ['tug','ram','carry'] : ['struggle'])];
    property(names.every(n => has(scene,n)), 'set fight choreography follows public outcome');
    property(plan.scenes.filter(s => s.beat === 'ambient' && [event.kind, ...(event.kind === 'vault' ? ['guard'] : [])].includes(s.kind)).every(s => s.end <= scene.start), 'set arrivals and posts precede confrontation');
    if (event.kind === 'vault') {
      counts.vaults++;
      if (!event.won) {
        counts.lostVaults++;
        for (const arrest of frame.events.filter(e => e.type === 'arrest' && e.why === 'fight' && e.place === event.place)) {
          const row = plan.scenes.find(s => s.eventId === arrest.id && s.kind === 'arrest');
          property(row && has(row,'cuff') && row.start >= scene.end, 'lost vault arrests follow struggle');
        }
      }
    }
  }
  if (frame.day !== 14) return;
  const fights = frame.events.filter(e => e.type === 'fight');
  for (const event of fights) {
    const scene = plan.scenes.find(s => s.eventId === event.id && s.beat === 'fight');
    property(scene && has(scene,'fight') && scene.route === event.place, 'every finale route fight has a route beat');
    counts.routeFights++;
  }
  const departure = plan.scenes.find(s => s.kind === 'ferry');
  property(departure && has(departure,'leave'), 'SECOND CHANCE leaves');
  for (const event of frame.events.filter(e => ['board','missed'].includes(e.type))) {
    const scene = plan.scenes.find(s => s.kind === event.type && s.beat === 'finale' && s.eventIds.includes(event.id));
    property(scene, 'every boarded or missed agent has its receipt scene');
    equal(scene.actors, Object.hasOwn(show.seen,event.agent) ? [event.agent] : [], 'finale identity is live-safe');
    if (event.type === 'board') {
      equal(scene.route,event.route,'boarding route comes from board receipt');
      property(has(scene,'queue') && has(scene,'gangway') && scene.end <= departure.start, 'boarding before departure');
      const walk = plan.scenes.find(s => has(s,'walk') && s.eventIds.includes(event.id));
      property(walk && walk.route === event.route && walk.end <= scene.start, 'every board receipt has its public route walk');
      equal(walk.place.corePlace,event.route,'route walk uses matching public route anchor');
      equal(walk.actors,scene.actors,'walk and boarding use same public actor');
      property(fights.every(e => plan.scenes.find(s => s.eventId === e.id && s.beat === 'fight').end <= scene.start), 'route fights precede boarding');
      routes.add(event.route); counts.walks++; counts.boarded++;
    } else {
      property(has(scene,'missed') && scene.start >= departure.end, 'missed boat follows departure');
      counts.missed++;
    }
  }
  for (const event of frame.events.filter(e => e.type === 'arrest' && e.why === 'dock')) {
    const scene = plan.scenes.find(s => s.eventId === event.id && s.kind === 'arrest');
    property(scene && has(scene,'cuff') && scene.end <= departure.start && scene.place.corePlace === 'ferry', 'dock arrests before departure');
    counts.dockArrests++;
  }
}

function receiptAudit(frames, planner) {
  // Delayed receipts are an independent coverage oracle ONLY in this check.
  // Production plans never read membership, output goods, drugs or recipes.
  const latest=new Map(frames.flatMap(f=>f.events.map(e=>[e.id,e])));
  const kinds={gather:'run',craft:'build',cook:'cook',grab:'grab',vault:'vault'};
  for(const e of latest.values()) {
    if(!Object.hasOwn(kinds,e.type)) continue;
    const plan=planner.night(e.night), frame=frames[plan.frame], show=frame.events.find(x=>x.type==='show');
    const actor=e.agent??e.leader;
    const scene=plan.scenes.find(s=>s.kind===kinds[e.type]&&s.actors?.includes(actor));
    property(scene?.beats.length,'every actual set receipt has its public kind, actor and beats');
    property(scene.eventIds.every(id=>frame.events.some(x=>x.id===id)),'actual set never borrows a future receipt id');
    for(const member of e.members??[]) {
      property(Object.hasOwn(show.seen,member)&&plan.scenes.some(s=>s.publicActors.includes(member)),'actual vault/grab members remain unhooded in their public scenes');
    }
    receipts[e.type]++;
  }
}

function lossFixture() {
  // All six measured vault jobs won. Exercise the documented loss projection
  // explicitly, without claiming this constructed public frame was a season.
  const frames=feed(415,'A'), source=frames.find(f=>f.step.kind==='night'&&f.day===5);
  let board=null;
  for(const frame of frames.slice(0,source.i)) board=frame.board??board;
  const jobber='a04', guard='a02', back='a06';
  const show={...source.events.find(e=>e.type==='show'), seen:{[jobber]:'downtown',[guard]:'downtown',[back]:'downtown'}, hooded:{},
    plays:{[jobber]:{kind:'vault',place:'downtown'},[guard]:{kind:'guard',place:'downtown'},[back]:{kind:'back',place:'downtown'}}};
  const fight={...source.events.find(e=>e.type==='fight'&&e.kind==='vault'),won:false,guard:5};
  const arrest={id:9001,type:'arrest',night:5,day:5,t:source.t,minute:source.minute,agent:jobber,why:'fight',place:'downtown'};
  const frame={...source,events:[show,fight,arrest]};
  const plan=structuredClone(planShow(freeze(frame),board));
  const set=plan.scenes.find(s=>s.beat==='fight'), cuffs=plan.scenes.find(s=>s.eventId===arrest.id);
  if(fault==='lost-cuffs') { cuffs.beats=[]; planted=true; }
  if(fault==='missing-guard') { set.actors=[jobber]; set.publicActors=[jobber]; planted=true; }
  equal(set.actors,[guard,jobber].sort(),'loss fixture names public jobber and guard only');
  equal(set.roles,{jobbers:[jobber],guards:[guard]},'public guard roles, no inferred back membership');
  property(has(set,'shove')&&has(set,'struggle')&&!['drill','heave','carry'].some(n=>has(set,n)),'lost vault stops at struggle');
  property(cuffs.actors.includes(jobber)&&has(cuffs,'cuff')&&has(cuffs,'escort')&&cuffs.start>=set.end,'lost vault has subsequent cuffs and escort');
  equal(cuffs.place.cityPlace,'police','lost jobber arrested at Precinct 9');
  equal(cuffs.revealIds,[arrest.id],'loss arrest retains original reveal cue');
  console.log('constructed public loss/guard fixture PASS (six measured jobs all won)');
}

function guardedInputs() {
  const frames=structuredClone(feed(406,'A'));
  for(const frame of frames) {
    if(frame.board) Object.defineProperty(frame.board,'memories',{get(){throw new Error('private memories read');}});
    for(const event of frame.events) {
      for(const key of ['text','line','reason','accept','drug','cards','goods','copies']) Object.defineProperty(event,key,{configurable:true,get(){throw new Error(`forbidden ${key} read`);}});
      if(['play','gather','craft','cook','grab','vault'].includes(event.type)) {
        for(const key of ['agent','kind','place','members','leader','guns','doses']) Object.defineProperty(event,key,{configurable:true,get(){throw new Error(`delayed ${event.type}.${key} read`);}});
      }
    }
  }
  const random=Math.random;
  Math.random=()=>{throw new Error('staging RNG read');};
  try {
    const planner=createShowPlanner(frames);
    for(const f of frames.filter(f=>f.step.kind==='night')) planner.night(f.day);
    planner.day(15); planner.stagingAt(frames.at(-1).minute);
  } finally { Math.random=random; }
  console.log('private receipt/prose/product getters and RNG trap PASS');
}

function jailedFinaleFixture() {
  const frames=feed(406,'A'), source=frames.find(f=>f.step.kind==='night'&&f.day===14);
  let preceding=null;
  for(const frame of frames.slice(0,source.i)) preceding=frame.board??preceding;
  const board=structuredClone(preceding);
  board.agents.forEach(a=>{a.jailed=true;});
  const show={...source.events.find(e=>e.type==='show'),seen:{},hooded:{},plays:{}};
  const missed=board.agents.map((a,i)=>({id:10000+i,type:'missed',agent:a.id,day:14,t:source.t,minute:source.minute}));
  const frame={...source,events:[show,...missed]};
  Object.defineProperty(frame,'board',{get(){throw new Error('resulting night board read');}});
  const plan=planShow(frame,board), leave=plan.scenes.find(s=>s.kind==='ferry');
  equal(plan.end-plan.start,15,'all-jailed finale still has full ferry window');
  for(const event of missed) {
    const scene=plan.scenes.find(s=>s.kind==='missed'&&s.eventId===event.id);
    property(scene&&scene.place.corePlace==='jail'&&scene.start>=leave.end,'already-jailed missed agent stays in jail after ferry departure');
    equal(scene.actors,[],'unseen jailed subject has no live scene identity');
    property(!('route' in scene),'no invented route for a missed jailed agent');
  }
  property(plan.scenes.every(s=>s.start>=plan.start&&s.end<=plan.end),'all-jailed finale fits show window');
  console.log('constructed all-jailed finale PASS; resulting-board getter unread');
}
function checkSeason(seed, rule) {
  const frames=feed(seed,rule), before=JSON.stringify(frames), planner=createShowPlanner(frames);
  let board=null;
  for(const frame of frames) {
    if(frame.step.kind==='night') {
      const plan=structuredClone(planner.night(frame.day));
      nightProperties(plan,frame,board); counts.nights++;
      equal(planner.night(frame.day),createShowPlanner(frames.slice(0,frame.i+1)).night(frame.day),'no future frames in night plan');
      equal(planner.at(plan.start-.001),null,'nothing before show frame/window');
    }
    board=frame.board??board;
  }
  const dawn=frames.find(f=>f.day===15), mint=structuredClone(planner.day(15));
  if(fault==='early-mint') { mint.scenes[0].start=dawn.minute-1; planted=true; }
  property(mint.start>=dawn.minute && mint.end>mint.start,'day 15 has a published timed window');
  const shown={seen:Object.fromEntries(dawn.board.agents.map(a=>[a.id,true]))};
  for(const scene of mint.scenes) sceneProperties(scene,mint,dawn,shown);
  for(const e of dawn.events.filter(e=>e.type==='mint')) {
    const scene=mint.scenes.find(s=>s.kind==='mint' && s.actors.includes(e.agent) && s.eventIds.includes(e.id));
    property(scene && has(scene,'mint'),'every public mint has a day-15 scene'); counts.mints++;
  }
  property(!planner.at(dawn.minute-.001),'mint is absent before day-15 frame');
  equal(planner.stagingAt(dawn.minute).active.map(s=>s.id),mint.scenes.filter(s=>s.start<=dawn.minute).map(s=>s.id),'mint activates at publication');
  equal(planner.day(15),createShowPlanner(frames.slice(0,dawn.i+1)).day(15),'mint has no future dependence');
  const partial=createShowPlanner(frames.slice(0,dawn.i));
  equal(partial.stagingAt(dawn.minute),null,'partial feed cannot invent mint');
  const player=createShowPlayer(frames);
  for (const minute of [mint.start, ...mint.scenes.flatMap(s=>[s.start,s.end])]) {
    const state=planner.stagingAt(minute);
    equal(createShowPlanner(frames).stagingAt(minute),state,'fresh and cached mint selection agree');
  }
  equal(player.seek(dawn.minute-.001).show,null,'player does not show mint early');
  property(planner.stagingAt(player.seek(dawn.minute).minute)?.active.some(s=>s.kind==='mint'),'staging selector exposes mint at day-15 publication');
  equal(JSON.stringify(frames),before,'feed is immutable'); counts.seasons++;
  receiptAudit(frames,planner);
}
try {
  if(!fault) {
    for(const name of controls) {
      const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--fault',name],{cwd:ROOT,encoding:'utf8'});
      property(r.status===1 && /PROPERTY/.test(r.stderr),`control ${name} rejected by a property: ${r.stderr}`);
      console.log(`CONTROL ${name}: ${r.stderr.trim()}`);
    }
  }
  // All forty measured layer-4 seasons are scanned; only baseline and actual
  // vault seasons enter the full property suite. No historical report counts.
  const seasons=[];
  for(let seed=404;seed<=423;seed++) for(const rule of ['A','B']) {
    if(fault && (seed!==406 || rule!=='A')) continue;
    const frames=feed(seed,rule);
    const jobs=frames.flatMap(f=>f.events.filter(e=>e.type==='fight'&&e.kind==='vault').map(e=>({night:e.night,won:e.won})));
    if(jobs.length) vaultSeasons.push({seed,rule,jobs});
    if(jobs.length || rule==='A'&&seed<=406) seasons.push([seed,rule]);
  }
  for(const [seed,rule] of seasons) { checkSeason(seed,rule); console.log(`season ${seed}-${rule} PASS`); }
  if(!fault || ['lost-cuffs','missing-guard'].includes(fault)) lossFixture();
  if(fault) property(planted,`fault ${fault} reached its fixture`);
  else {
    property(counts.vaults>0,'real vault fixtures');
    property(counts.missed>0 && counts.dockArrests>0 && counts.routeFights>0,'real finale outcomes exercised');
    equal([...routes].sort(),['downtown','industrial','junkyard'],'all three public ferry routes');
    guardedInputs();
    jailedFinaleFixture();
    console.log(`vault seasons: ${JSON.stringify(vaultSeasons)}`);
    console.log(`coverage: ${JSON.stringify({...counts,receipts,drops:[...drops].sort(),cooks:[...cooks].sort()})}`);
  }
  console.log('STAGECHECK PASS');
} catch(e) { console.error(`STAGECHECK FAIL${fault?` (${fault})`:''}: ${e.message}`); process.exitCode=1; }
