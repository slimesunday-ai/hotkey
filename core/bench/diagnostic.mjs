// $0 fixture diagnostic. Both arms use the same current semantic tools and deterministic submitted actions.
// There is deliberately no endpoint, credential, paid mode or implicit network transport here.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {newSeason,applyErrand,settleNight,viewFor,checkLedger,checkPlay,defaultPlay} from '../index.mjs';
import {N} from '../numbers.mjs';
import {loadItems} from './runner.mjs';
import {makeCast,LAYER4_MIX} from './bots.mjs';
import {read,reply} from '../agents/tools.mjs';
import {briefing} from '../agents/briefing.mjs';
import {briefing as legacyBriefing} from './fixtures/legacy-briefing.mjs';
import {fingerprint,semanticSource} from './evidence.mjs';

const id='a01';
function fresh(trade='chemist') {
  const cast=makeCast(404,LAYER4_MIX).map(c=>({...c,trade:c.id===id?trade:c.id==='a02'?'gunrunner':c.trade,driver:'fixture'}));
  const r=newSeason({seed:404,rule:'A',midseason:'blackout',items:loadItems(),agents:cast});
  return {state:r.state,log:r.events};
}
function errand(g,by,kind,fields={}) {
  const r=applyErrand(g.state,{by,kind,...fields});g.state=r.state;g.log.push(...r.events);checkLedger(g.state,'diagnostic errand');return r;
}
// R11: a night out is a hustle at the Mall, lawless, so it adds no star, as the shift at the docks added none (a
// star a night would make a01 a wanted attacker, and bring the city cops to its hit). Thirty in one district each take
// the floor, the rent, so a01 hustles alone at the junkyard, also lawless, and earns its rent (§9).
const plain={kind:'hustle',place:'mall'};
const alone={kind:'hustle',place:'junkyard'};
function night(g,overrides={}) {
  const plays=Object.fromEntries(Object.keys(g.state.agents).filter(i=>!g.state.agents[i].jail).map(i=>[i,i===id?alone:plain]));
  const r=settleNight(g.state,{...plays,...overrides});g.state=r.state;g.log.push(...r.events);checkLedger(g.state,'diagnostic night');return r;
}
export function frozenCases() {
  const out=[];
  const add=(name,pair,g,actions,expected,settlement)=>{
    checkLedger(g.state,`freeze ${name}`);
    const view=viewFor(g.state,g.log,id,'agent');
    out.push({id:name,pair,seat:id,state:g.state,log:g.log,view,viewHash:fingerprint(view),actions,expected,settlement});
  };
  for(const evicted of [false,true]) {
    const g=fresh();night(g,evicted?{[id]:{kind:'laylow'}}:{});night(g);
    const cash=g.state.agents[id].cash;
    if(cash<20) throw new Error('home fixture requires earned cash');
    if(cash>20) errand(g,id,'pay',{to:'a30',amount:cash-20});
    if(g.state.agents[id].evicted!==evicted) throw new Error('home fixture state drift');
    add(evicted?'evicted':'home','home',g,[{act:'rent'},{act:'play',kind:'laylow'}],[evicted,true],{play:'laylow'});
  }
  for(const open of [false,true]) {
    const g=fresh();errand(g,'a02','ask',{to:id,line:'Can we talk?'});
    const sd=Object.keys(g.state.sitdowns)[0];
    if(open) errand(g,id,'answer',{sitdown:sd,accept:true});
    add(open?'open-conversation':'pending-invitation','invitation',g,[{act:'answer',sitdown:sd,accept:true,line:'I received your invitation.'},{act:'say',sitdown:sd,say:'answer',line:'Here is my reply.'},{act:'play',...plain}],[!open,true,true],{play:'hustle',speech:'Here is my reply.',acceptedSpeech:!open});
  }
  for(const armed of [false,true]) {
    const g=fresh('gunrunner');night(g);
    night(g,{[id]:{kind:'build',guns:1,lockpicks:0},a02:armed?{kind:'build',guns:1,lockpicks:0}:plain});
    // Let the dated public build record become available before freezing the decision view.
    night(g);
    const view=viewFor(g.state,g.log,id,'agent');
    if(armed && !view.events.some(e=>e.type==='craft' && e.agent==='a02' && e.guns===1)) throw new Error('attack fixture must expose the target weapon through a public build record');
    // R8 (gap.jump 'alone', slime 10-19: "do 1 and 2"): a02 hustles alone, so the armed hit wins the 2-2 tie too;
    // with the jump off (gap.jump 0) the armed target held it, and this case expected attackWon false. R11: the hit
    // finds a02 at the Mall, where everyone hustles.
    add(armed?'unfavorable-attack':'favorable-attack','attack',g,[{act:'play',kind:'hit',target:'a02',place:'mall'}],[true],{play:'hit',attackWon:true});
  }
  for(const missing of [false,true]) {
    const g=fresh();night(g);
    if(missing) errand(g,id,'give',{to:'a30',goods:{chems:g.state.agents[id].goods.chems}});
    add(missing?'missing-inputs':'available-inputs','inputs',g,[{act:'play',kind:'cook',place:'forest',batches:1}],[!missing],{play:missing?'laylow':'cook',cooked:!missing});
  }
  return out;
}
export function runDiagnostic(options={}) {
  for(const key of Object.keys(options)) if(key!=='outDir') throw new Error(`unsupported diagnostic option: ${key}; fake/no-network only`);
  const cases=frozenCases();
  const runs=[];
  for(const c of cases) for(const [arm,format] of [['legacy',legacyBriefing],['corrected',briefing]]) {
    let state=structuredClone(c.state);const log=structuredClone(c.log);
    const r=read(c.view,{audience:'seat',seed:'diagnostic-frozen'});
    const messages=format(r.result,{call:'round'});
    const apply=e=>{const a=applyErrand(state,{...e,by:id});state=a.state;log.push(...a.events);const bad=a.events.find(e=>e.type==='invalid');return {...a,kind:bad?.kind};};
    const answer=reply({actions:c.actions},{deal:r.deal,apply,tries:{},validatePlay:p=>checkPlay(state,id,p,state.day),currentView:()=>viewFor(state,log,id,'agent')});
    const plays=Object.fromEntries(Object.keys(state.agents).filter(i=>!state.agents[i].jail).map(i=>[i,plain]));
    plays[id]=answer.play || defaultPlay(state,id,state.day);
    const settled=settleNight(state,plays);checkLedger(settled.state,'diagnostic settle');
    const emitted=settled.events.find(e=>e.type==='play'&&e.agent===id);
    const checks=c.expected.map((ok,i)=>({name:`action ${i+1} accepted=${ok}`,ok:answer.results[i]?.ok===ok}));
    checks.push({name:`settled play ${c.settlement.play}`,ok:emitted?.kind===c.settlement.play});
    if(c.settlement.speech) checks.push({name:'speech recorded',ok:log.some(e=>e.type==='say'&&e.line===c.settlement.speech)});
    if(c.settlement.acceptedSpeech) checks.push({name:'accepted speech delivered to partner',ok:viewFor(state,log,'a02','agent').me.sitdowns.some(sd=>sd.said.some(m=>m.line==='I received your invitation.'))});
    if('cooked' in c.settlement) checks.push({name:`production=${c.settlement.cooked}`,ok:settled.events.some(e=>e.type==='cook'&&e.agent===id&&e.doses>0)===c.settlement.cooked});
    if('attackWon' in c.settlement) checks.push({name:`attack won=${c.settlement.attackWon}`,ok:settled.fights.fights.some(f=>f.kind==='hit'&&f.winner===id)===c.settlement.attackWon});
    runs.push({case:c.id,arm,viewHash:c.viewHash,briefingHash:fingerprint(messages),messages,submitted:{actions:c.actions},results:answer.results,checks,settlement:settled.events.filter(e=>e.type==='play'&&e.agent===id || ['rob','cook'].includes(e.type)),cash:settled.state.agents[id].cash});
  }
  const result={schema:1,mode:'deterministic fake semantic diagnostic; not a model capability result',cost:0,networkCalls:0,source:semanticSource(),legacySource:'ab5199c (briefing and literal replyFormat snapshot)',cases:cases.map(({id,pair,seat,view,viewHash,actions,expected,settlement})=>({id,pair,seat,view,viewHash,actions,expected,settlement})),runs};
  if(options.outDir) {
    fs.mkdirSync(options.outDir,{recursive:true});
    fs.writeFileSync(path.join(options.outDir,'diagnostic.json'),JSON.stringify(result,null,2)+'\n');
    fs.writeFileSync(path.join(options.outDir,'README.md'),`# Frozen $0 diagnostic\n\nEight legitimate views × legacy/corrected briefing; 16 deterministic fake replies. ${runs.flatMap(r=>r.checks).filter(c=>c.ok).length}/${runs.flatMap(r=>r.checks).length} predeclared checks pass. Network calls 0; spend $0.\n\nThese fake replies exercise the semantic contract equally across arms. They cannot measure response differences or model skill. The JSON retains both prompts, frozen permitted views, expected checks, typed validation and actual settlement. No real-model execution path exists here.\n`);
  }
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const argv=process.argv.slice(2);
  if(argv.length!==2 || argv[0]!=='--out') throw new Error('usage: node core/bench/diagnostic.mjs --out DIR (fake/no-network only)');
  const r=runDiagnostic({outDir:path.resolve(argv[1])});
  const checks=r.runs.flatMap(r=>r.checks);console.log(JSON.stringify({cases:r.cases.length,arms:r.runs.length,checks:checks.length,failed:checks.filter(c=>!c.ok),cost:r.cost,networkCalls:r.networkCalls}));
  if(checks.some(c=>!c.ok)) process.exitCode=1;
}
