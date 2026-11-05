// slime, 10-31, on the slimmer feed (readers carry unchanged sightings forward): "Slim". Check the wire codec
// against an independent dense fold at every reducer prefix and playback edge.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseFeed, createRecordAdapter } from '../simstate/record/adapter.js';
import { createRecordPlayer, revealAt } from '../simstate/record/player.js';
import { readFeed } from '../simstate/record/worker.js';
import { createRoutinePlanner } from '../simstate/record/routines.js';
import { createShowPlanner, createShowPlayer } from '../simstate/record/show-plan.js';
import { createTapeReader } from '../simstate/record/tape-data.js';
import { createCutPlanner } from '../simstate/record/cut-plan.js';
const arg = n => process.argv.includes(n) ? process.argv[process.argv.indexOf(n)+1] : null;
const root = fileURLToPath(new URL('../../../',import.meta.url));
const feeds = path.resolve(arg('--feeds') ?? path.join(root,'core/runs'));
// Small adversarial prefixes also prove explicit clearing and validation.
const wireFixture = [
  {i:0,t:0,day:0,minute:360,step:{kind:'setup'},events:[],board:{agents:[],corners:[]},sightings:{},nightsLeft:14,over:false},
  {i:1,t:2,day:1,minute:1800,step:{kind:'dawn'},events:[],nightsLeft:14,over:false},
  {i:2,t:3,day:1,minute:2700,step:{kind:'night'},events:[{id:0,t:3,day:1,minute:2700,type:'show',night:1}],sightings:{a01:[{night:1,place:'mall'}]},nightsLeft:13,over:false},
  {i:3,t:4,day:2,minute:3240,step:{kind:'dawn'},events:[],nightsLeft:13,over:false},
  {i:4,t:4,day:2,minute:3260,step:{kind:'errand',round:1},events:[],sightings:{},nightsLeft:13,over:false},
];
const encode = frames => frames.map(f=>JSON.stringify(f)).join('\n')+'\n';
const fixture = parseFeed(encode(wireFixture));
assert.deepEqual(fixture[1].sightings,{});
assert.deepEqual(fixture[3].sightings,fixture[2].sightings);
assert.deepEqual(fixture[4].sightings,{});
assert.deepEqual(parseFeed(encode(fixture)),fixture,'legacy dense frames');
for(let i=1;i<=fixture.length;i++) assert.deepEqual(parseFeed(encode(wireFixture.slice(0,i))),fixture.slice(0,i),'no future sightings in an earlier prefix');
const missing=structuredClone(wireFixture);delete missing[0].sightings;
assert.throws(()=>parseFeed(encode(missing)),/invalid feed frame/);
const invalid=structuredClone(wireFixture);invalid[1].sightings=null;
assert.throws(()=>parseFeed(encode(invalid)),/invalid feed frame/);
const fp=createRecordPlayer(wireFixture),fd=createRecordPlayer(fixture);
for(const m of [360,1800,2704.999,2705,3240,3260,3240,2704.999,1800,360]) assert.equal(JSON.stringify(fp.seek(m)),JSON.stringify(fd.seek(m)),'fixture forward/backward/night hold');
assert.deepEqual(fp.seek(2704.999).sightings,{});
assert.deepEqual(fp.seek(2705).sightings,fixture[2].sightings);
console.log('Synthetic: carry, empty replacement, legacy dense, every prefix, malformed first/null frames, night hold and rewind PASS');
for (const seed of [404,405,406]) {
  const text=fs.readFileSync(path.join(feeds,`${seed}-A/feed.jsonl`),'utf8');
  const wire=text.trim().split('\n').map(JSON.parse);
  let last={}, previous=null, repeated=0;
  const dense=wire.map(f=>{
    if (f.sightings!==undefined) {
      const signature=JSON.stringify(f.sightings);
      if(signature===previous) repeated++;
      previous=signature; last=f.sightings;
    }
    return {...f,sightings:last};
  });
  assert.deepEqual(parseFeed(text),dense,'decoder retains the dense frame interface');
  assert.deepEqual(await readFeed('https://record.invalid/feed.jsonl',async()=>({ok:true,text:async()=>text})),dense,'worker retains the same values');
  const sparseAdapter=createRecordAdapter(), denseAdapter=createRecordAdapter();
  for(let i=0;i<wire.length;i++) assert.equal(JSON.stringify(sparseAdapter.apply(wire[i])),JSON.stringify(denseAdapter.apply(dense[i])),`seed ${seed} reducer prefix ${i}`);
  const sparsePlayer=createRecordPlayer(wire), densePlayer=createRecordPlayer(dense);
  const points=[...new Set(wire.flatMap(f=>[revealAt(f),Math.max(wire[0].minute,revealAt(f)-.001)]))].sort((a,b)=>a-b);
  for(const minute of [...points,...points.slice().reverse()]) assert.equal(JSON.stringify(sparsePlayer.seek(minute)),JSON.stringify(densePlayer.seek(minute)),`seed ${seed} playback/reverse ${minute}`);
  // c2lib and the show/director/seek/tape/routine browser scenarios pass raw
  // JSON frames into these node-safe oracles. Exercise that exact seam too.
  const routines=[createRoutinePlanner(wire),createRoutinePlanner(dense)];
  const shows=[createShowPlanner(wire),createShowPlanner(dense)];
  const staged=[createShowPlayer(wire),createShowPlayer(dense)];
  const tape=[createTapeReader(wire),createTapeReader(dense)];
  const cuts=[createCutPlanner(wire),createCutPlanner(dense)];
  for(let n=1;n<=14;n++) {
    assert.deepEqual(routines[0].day(n),routines[1].day(n),'raw routine oracle');
    const a=shows[0].night(n),b=shows[1].night(n);
    assert.deepEqual(a,b,'raw show oracle');
    assert.deepEqual(cuts[0].night(n),cuts[1].night(n),'raw director oracle');
    for(const minute of [a.start-.001,a.start,...a.scenes.map(s=>s.end),a.end]) {
      const snap=staged.map(p=>p.seek(minute));
      assert.equal(JSON.stringify(snap[0]),JSON.stringify(snap[1]),'raw staged player');
      for(const method of ['markersAt','betrayalsAt']) assert.deepEqual(tape[0][method](snap[0]),tape[1][method](snap[1]),`raw tape ${method}`);
      assert.deepEqual(cuts[0].at(minute),cuts[1].at(minute),'raw director at cue');
    }
  }
  if(process.argv.includes('--deltas')) assert.equal(repeated,0,'wire repeats no unchanged sightings');
  console.log(`seed ${seed}: ${wire.length} reducer prefixes, ${points.length*2} playback/reverse points, parser/worker/raw routine/show/tape/director oracles identical; ${repeated} repeated sightings`);
}
console.log('FEED READER CHECK PASS');
