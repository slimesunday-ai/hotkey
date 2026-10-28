import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { actionCounters, summarizeActionCounters } from '../bench/evidence.mjs';
import { refusalLines, mechanismLines } from '../bench/report.mjs';

// Trimmed typed checkpoint attempts and selected-seat events from unchanged paid artifacts.
// Source paths and scope: core/reports/R5/refusal-reassessment/README.md.
const paid=JSON.parse(fs.readFileSync(new URL('./fixtures/paid-refusals.json',import.meta.url),'utf8'));
const count=r=>actionCounters(r.models,r.log,Object.keys(r.models.seats));
const arm=(run,arm)=>summarizeActionCounters(paid.filter(r=>r.run.endsWith(run) && r.arm===arm).map(count));

test('paid stake canonical attempts recover all 47 refusals, 31 affected calls and 907 submissions',()=>{
  const rows=paid.filter(r=>r.run.endsWith('stake'));
  assert.deepEqual(rows.map(r=>{const c=count(r);return [r.arm,r.seed,c.refusals.errands,c.refusals.playSelections,c.refusals.total,c.callsWithRefusal];}),[
    ['stake0',416,6,5,11,7],['stake0',417,11,2,13,10],['stake100',416,11,3,14,8],['stake100',417,9,0,9,6],
  ]);
  const c=summarizeActionCounters(rows.map(count));
  assert.deepEqual([c.coverage,c.calls,c.actions,c.callsWithTelemetry,c.callsWithRefusal,c.refusals.errands,c.refusals.playSelections,c.refusals.total,c.coreRefusals,c.toolRefusals],['complete',533,907,533,31,37,10,47,1,46]);
  assert.equal(c.seasons,4);
  assert.equal(c.executedInvalidPlays,0);
  assert.equal(c.coreInvalidErrandEvents,1);
  const text=refusalLines(c).join('\n');
  assert.match(text,/47\/907 \(5.18%\)/);
  assert.match(text,/31\/533 \(5.82%\)/);
  assert.match(text,/\| tools \| 36 \| 10 \| 0 \/ 0 \| 46 \|/);
});

test('clarity full refusal comparison stays distinct from the core-only 24 to 2',()=>{
  const old=arm('clarity','legacy'),current=arm('clarity','current');
  assert.deepEqual([old.refusals.errands,current.refusals.errands,old.refusals.playSelections,current.refusals.playSelections,old.refusals.total,current.refusals.total],[26,13,2,8,28,21]);
  assert.deepEqual([old.coreRefusals,current.coreRefusals,old.toolRefusals,current.toolRefusals],[24,2,4,19]);
});

test('count a call once despite several refusals; ignore repeated receipts and ceiling placeholders',()=>{
  const models={seats:{a:{record:[{feedback:['pay refused','pay refused'],attempts:[{call:1,actions:[{act:'pay',ok:false,source:'tools'},{act:'play',ok:false,source:'tools'},{act:'play',ok:true,source:'tools'}]},{call:2,actions:[]},{call:null,outcome:'ceiling'}]}]}}};
  const c=actionCounters(models,[{type:'invalid',by:'a',errand:'pay'},{type:'play',agent:'a',kind:'hustle'}],['a']);
  assert.deepEqual([c.calls,c.actions,c.callsWithRefusal,c.refusals.total,c.refusals.errands,c.refusals.playSelections,c.executedInvalidPlays,c.executedPlays],[2,3,1,2,1,1,0,1]);
  assert.match(mechanismLines({modelSeats:['a'],actionCounters:c}).join('\n'),/Core invalid-errand events count core refusals only/);
});

test('missing historical attempts keep totals and rates unknown, with observed lower bounds',()=>{
  const complete=actionCounters({seats:{a:{record:[{attempts:[{call:1,actions:[{act:'say',ok:false,source:'tools'}]}]}]}}},[],['a']);
  for (const models of [undefined,{seats:{a:{record:[{}]}}},{seats:{a:{record:[{attempts:[{call:1}]}]}}}]) {
    const c=actionCounters(models,[],['a']);
    assert.equal(c.coverage,'legacy/unknown');
    assert.equal(c.actions,null);
    const combined=summarizeActionCounters([complete,c]);
    assert.equal(combined.callsWithRefusal,null);
    assert.equal(combined.refusals.total,1);
    assert.match(refusalLines(combined).join('\n'),/unknown rate/);
    assert.match(refusalLines(combined).join('\n'),/Unknown historical counts are not zeros/);
  }
});


test('read and lookup retrievals stay outside errand and play counts',()=>{
  const c=actionCounters({seats:{a:{record:[{attempts:[{call:1,actions:[{act:'lookup',ok:true,source:'tools'},{act:'lookup',ok:false,source:'tools'},{act:'read',ok:false,source:'tools'}]}]}]}}},[],['a']);
  assert.deepEqual([c.actions,c.reads,c.errands,c.playSelections,c.refusals.total,c.refusals.reads,c.refusals.bySource.tools.reads],[3,3,0,0,2,2,2]);
});


test('executed invalid replacement events do not fabricate submitted-action refusals',()=>{
  const c=actionCounters({seats:{a:{record:[{attempts:[{call:1,actions:[{act:'play',ok:true,source:'tools'}]}]}]}}},[{type:'invalid',agent:'a',instead:'hustle'},{type:'play',agent:'a',kind:'hustle'}],['a']);
  assert.deepEqual([c.refusals.total,c.callsWithRefusal,c.executedInvalidPlays,c.executedPlays],[0,0,1,1]);
  const unknown=summarizeActionCounters([c,undefined]);
  assert.deepEqual([unknown.coverage,unknown.calls,unknown.actions,unknown.seasons],['legacy/unknown',null,null,2]);
  const combined=summarizeActionCounters([summarizeActionCounters([c,c]),c]);
  assert.equal(combined.seasons,3);
});
