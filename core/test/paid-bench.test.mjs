import test from 'node:test';
import assert from 'node:assert/strict';
import { pairSeasons, acrossSeasons, haulsOf } from '../bench/passbars.mjs';
import { summaryMarkdown } from '../bench/report.mjs';
import { table } from '../bench/bars.mjs';
import { twinValidation, actionCounters, acquisitionProfile } from '../bench/evidence.mjs';

const pair = (i = 1) => {
  const cast = [{id:'a01',type:'dealer',trade:'dealer',model:true},{id:'a02',type:'scout',trade:'cop',sharp:false,model:false}];
  const provenance={schema:1,source:{rules:'rules',core:'core',benchmark:'measure'},cast:cast.map(({model,...c})=>c),config:{seed:i,rule:'A',midseason:'blackout',rounds:3,overrides:{},options:{cast:'models'},numbers:'numbers'},initial:{agents:cast.map(({model,...c})=>c),drop:[{trait:'t',price:40}]}};
  const model={seed:i,rule:'A',seasonKey:`m${i}`,modelSeats:['a01'],typeOf:{a01:'dealer'},haul:{a01:101+i%2},provenance};
  const bot={...model,seasonKey:`b${i}`,modelSeats:[],haul:{a01:100},provenance:structuredClone(provenance)};
  return [model,bot];
};
test('unsettled positive model point estimate renders UNSETTLED on both surfaces',()=>{
  const ps=Array.from({length:3},(_,i)=>pair(i));
  const x=acrossSeasons(ps.map(p=>p[0]),{twins:ps.map(p=>p[1])});
  const row=x.rows.find(r=>r.key==='models');
  assert.equal(row.verdict,true);
  assert.equal(row.status,'UNSETTLED');
  assert.equal(row.cells.at(-1).settled,false);
  const summary=summaryMarkdown({groups:x.groups,rows:x.rows,keyNumbers:[]});
  assert.match(summary,/UNSETTLED/); assert.doesNotMatch(summary,/: PASS/);
  const v={ways:{},roles:{clean:{},habit:{},guess:{}},cleanBeat:{},medians:{byType:{}}};
  const page=table([{name:'fake',n:3,distinct:3,rows:[{...row,cell:row.cells.at(-1)}],shadow:{},valued:{paid:v,mark:v,open:v},medians:{},cast:'models'}]);
  assert.match(page,/UNSETTLED/);assert.doesNotMatch(page,/: PASS/);
});
test('new twins require full semantic/config/source/drop equality, including unselected seats',()=>{
  const [m,b]=pair();
  assert.equal(twinValidation(m,b).status,'verified');
  for (const mutate of [p=>p.cast[1].sharp=true,p=>p.source.rules='other',p=>p.source.benchmark='other',p=>p.config.options.controllerSource='different policy',p=>p.config.rounds=4,p=>p.config.overrides.stake=100,p=>p.initial.drop[0].price=41]) {
    const other=structuredClone(b);mutate(other.provenance);
    assert.equal(twinValidation(m,other).status,'invalid');
    assert.equal(pairSeasons([m],[other])[0].bots,null);
  }
});
test('legacy numeric pairs remain readable and explicitly unknown; partial provenance cannot certify',()=>{
  const [m,b]=pair(); delete m.provenance;delete b.provenance;
  const p=pairSeasons([m],[b])[0];
  assert.ok(p.bots); assert.equal(p.validation.status,'legacy/unknown');
  m.provenance={schema:1};assert.equal(twinValidation(m,b).status,'legacy/unknown');
  b.provenance={schema:1,config:{rounds:3}};m.provenance={schema:1,config:{rounds:3,options:{}}};
  assert.equal(twinValidation(m,b).status,'legacy/unknown');
  b.provenance.config.rounds=4;assert.equal(twinValidation(m,b).status,'invalid');
});
test('typed action telemetry distinguishes attempts, refusals, calls, selections and executions',()=>{
  const models={seats:{a01:{record:[{attempts:[{call:1,actions:[{act:'rent',ok:false,source:'core',code:'rules'},{act:'play',ok:false,source:'tools',code:'off-menu'},{act:'play',ok:true,source:'tools'}]},{call:2,actions:[{act:'say',ok:false,source:'tools',code:'fields'}]}]}]}}};
  const c=actionCounters(models,[{type:'invalid',errand:'rent',by:'a01'},{type:'play',agent:'a01',kind:'hustle'}],['a01']);
  assert.deepEqual([c.actions,c.errands,c.playSelections,c.coreRefusals,c.toolRefusals,c.calls,c.callsWithRefusal,c.executedPlays],[4,2,2,1,2,2,2,1]);
  assert.equal(actionCounters({seats:{a01:{record:[{attempts:[{call:1}]}]}}},[],['a01']).coverage,'legacy/unknown');
});
test('acquisition reports cash, unique traits/slots, rarity and original purchase provenance',()=>{
  const log=[{type:'buy',copy:'k1',agent:'a01',price:40},{type:'buy',copy:'k2',agent:'a02',price:60},{type:'mint',agent:'a01',mainland:13,cards:[{copy:'k1',trait:'t',tier:'rare'},{copy:'k2',trait:'t',tier:'rare'}]}];
  const p=acquisitionProfile({copies:{k1:{slot:'head'},k2:{slot:'head'}}},log,['a01']).a01;
  assert.deepEqual([p.cash,p.minted,p.uniqueTraits,p.slots,p.ownList,p.otherOrigin,p.bookValue],[13,2,1,1,1,1,100]);
});
test('new copy-paid mint presentation preserves old mark shadow and legacy cards',()=>{
 const log=[{type:'season',drop:[{trait:'t',price:50}]},{type:'buy',copy:'k1',price:40},{type:'mint',agent:'a01',mainland:10,cards:[{copy:'k1',trait:'t',value:40,mark:70}]}];
 assert.deepEqual(haulsOf(log,['a01']),{paid:{a01:50},mark:{a01:80},open:{a01:60}});
 delete log[2].cards[0].mark;log[2].cards[0].value=70;assert.equal(haulsOf(log,['a01']).mark.a01,80);
});

test('diagnostic freezes eight real player views and executes sixteen fake arms with no endpoint option',async()=>{
  const {runDiagnostic}=await import('../bench/diagnostic.mjs');
  const r=runDiagnostic();
  assert.equal(r.cases.length,8); assert.equal(r.runs.length,16);
  assert.ok(r.runs.every(r=>r.checks.every(c=>c.ok)));
  assert.equal(r.networkCalls,0);assert.equal(r.cost,0);
  assert.throws(()=>runDiagnostic({url:'https://example.invalid'}),/unsupported/);
  for (const c of r.cases) {
    const arms=r.runs.filter(r=>r.case===c.id);
    assert.equal(arms[0].viewHash,arms[1].viewHash);
    assert.deepEqual(arms[0].checks,arms[1].checks);
  }
});

test('free comparison manifest fixes selected identities and leaves surrounding layer4 policies fixed',async()=>{
  const {comparisonManifest,safeAcquisitionPolicy}=await import('../bench/free-comparison.mjs');
  const m=comparisonManifest({seeds:[404,405],rules:['A']});
  assert.equal(m.runs.length,6);assert.equal(m.cost,0);
  for(const seed of [404,405]) {
    const arms=m.runs.filter(r=>r.seed===seed);
    assert.deepEqual(arms.map(r=>r.selected),Array(3).fill(arms[0].selected));
    assert.equal(arms[0].selected.length,4);
    assert.equal(new Set(arms.map(r=>r.surroundingCast)).size,1);
  }
  const policy=safeAcquisitionPolicy({});
  const view={day:5,me:{cash:100,evicted:false,pieces:[],offers:[]},board:{list:[{trait:'a',slot:'head',opens:1,left:1,price:40},{trait:'b',slot:'head',opens:1,left:1,price:20}]}};
  assert.deepEqual(policy.day(view),[{kind:'offer',trait:'b',amount:20}]);
  assert.deepEqual(policy.day(view),[],'at most one new offer per day');
  assert.equal(policy.night(view).play.kind,'hustle');
  assert.throws(()=>comparisonManifest({seeds:Array.from({length:21},(_,i)=>i)}),/bounded/);
});

test('ten/forty and noise thresholds stay unchanged while displayed model status respects settlement',()=>{
  const readings=n=>{const ps=Array.from({length:n},(_,i)=>{const [m,b]=pair(i);m.haul.a01=b.haul.a01+(i%2?100:-99);return [m,b];});return acrossSeasons(ps.map(p=>p[0]),{twins:ps.map(p=>p[1])}).rows.find(r=>r.key==='models');};
  const ten=readings(10),forty=readings(40);
  assert.equal(ten.cells.at(-1).noise,true);assert.equal(ten.verdict,true);assert.equal(ten.status,'UNSETTLED');
  assert.equal(forty.cells.at(-1).noise,true);assert.equal(forty.verdict,true);assert.equal(forty.status,'PASS');
  const negative=Array.from({length:10},(_,i)=>{const [m,b]=pair(i);m.haul.a01=0;return [m,b];});
  const row=acrossSeasons(negative.map(p=>p[0]),{twins:negative.map(p=>p[1])}).rows.find(r=>r.key==='models');
  assert.equal(row.status,'FAIL');assert.equal(row.cells.at(-1).settled,true);
});
test('bar denominators expose absent readings without counting them as failures',()=>{
  const rows=acrossSeasons([{seed:1,rule:'A',seasonKey:'one',bars:{turtle:{pass:true}}},{seed:2,rule:'A',seasonKey:'two',bars:{turtle:{pass:null}}}]).rows;
  const c=rows.find(r=>r.key==='turtle').cells.at(-1);
  assert.deepEqual([c.pass,c.n,c.total,c.missing,c.rate],[1,1,2,1,1]);
});

test('missing selected-seat records never certify zero requests, actions or affected calls',()=>{
  const absent=actionCounters(undefined,[{type:'play',agent:'a01',kind:'hustle'}],['a01']);
  assert.equal(absent.coverage,'legacy/unknown');
  assert.deepEqual([absent.calls,absent.actions,absent.callsWithRefusal],[null,null,null]);
  assert.deepEqual([absent.observedCalls,absent.observedActions,absent.callsWithRefusalObserved,absent.executedPlays],[0,0,0,1]);
  const empty=actionCounters({seats:{a01:{record:[]}}},[],['a01']);
  assert.equal(empty.coverage,'complete');
  assert.deepEqual([empty.calls,empty.actions,empty.callsWithRefusal],[0,0,0]);
  const partial=actionCounters({seats:{a01:{record:[{attempts:[{call:1,actions:[{act:'rent',ok:false,source:'core'}]}]}]}}},[],['a01','a02']);
  assert.deepEqual([partial.calls,partial.actions,partial.callsWithRefusal],[null,null,null]);
  assert.deepEqual([partial.observedCalls,partial.observedActions,partial.callsWithRefusalObserved],[1,1,1]);
});
