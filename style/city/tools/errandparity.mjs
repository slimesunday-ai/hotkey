// Extend continuityparity's before/after audit for §41, 10-31:
// "Who and where show". Normalize publication ids, never receipt payloads/times.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
const arg = n => process.argv[process.argv.indexOf(n) + 1];
if (!process.argv.includes('--before') || !process.argv.includes('--after')) throw new Error('usage: errandparity.mjs --before <runs> --after <runs>');
const before = path.resolve(arg('--before')), after = path.resolve(arg('--after'));
const json = file => JSON.parse(fs.readFileSync(file,'utf8'));
const lines = file => fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
function strip(e) {
  const v = structuredClone(e); delete v.live;
  if (v.type === 'show') for (const at of Object.values(v.masked ?? {})) delete at.fight;
  return v;
}
function normalize(frames, checkpoint) {
  const source = new Map(checkpoint.feed.exporter.ids.map(([n,id])=>[id,n]));
  let previous = null, sightings = null;
  return frames.flatMap(({i,events,...wire})=>{
    // slime, 10-31, on the slimmer feed (readers carry unchanged sightings forward): "Slim"; compare decoded values, not repeated wire snapshots.
    if (wire.sightings !== undefined) sightings = wire.sightings;
    const frame = {...wire,sightings};
    const projected = events.filter(e=>e.type!=='act').map(e=>{
      const v=strip(e); v.id=source.get(e.id);
      if (v.type==='orders') v.of=v.of.map(id=>source.get(id));
      return v;
    });
    const rest=JSON.stringify([frame.day,frame.nightsLeft,frame.midseason,frame.over,frame.sightings]);
    const changed=frame.board || projected.length || rest!==previous;
    previous=rest;
    return changed?[{...frame,events:projected}]:[];
  });
}
let failed=false;
for (const seed of [404,405,406]) {
  const dir=side=>path.join(side,`${seed}-A`);
  const ckA=json(path.join(dir(before),'checkpoint.json')),ckB=json(path.join(dir(after),'checkpoint.json'));
  const logA=lines(path.join(dir(before),'events.jsonl')),logB=lines(path.join(dir(after),'events.jsonl'));
  const feedA=lines(path.join(dir(before),'feed.jsonl')),feedB=lines(path.join(dir(after),'feed.jsonl'));
  const resultA=json(path.join(dir(before),'result.json')),resultB=json(path.join(dir(after),'result.json'));
  const result=v=>{const c=structuredClone(v);delete c.seasonKey;delete c.provenance.source.core;delete c.provenance.source.rules;return c;};
  const count={acts:feedB.flatMap(f=>f.events).filter(e=>e.type==='act').length,
    annotatedReceipts:logB.filter(e=>e.live).length,
    maskedFightIds:logB.filter(e=>e.type==='show').flatMap(e=>Object.values(e.masked??{})).filter(at=>at.fight!==undefined).length,
    changedLogRows:logA.filter((e,i)=>!equal(e,logB[i])).length,
    extraFrames:feedB.length-feedA.length,
    receiptDifferences:logA.filter((e,i)=>!equal(strip(e),strip(logB[i]))).length+Math.abs(logA.length-logB.length),
    playDifferences:equal(logA.filter(e=>e.type==='play'),logB.filter(e=>e.type==='play'))?0:1,
    feedDifferences:equal(normalize(feedA,ckA),normalize(feedB,ckB))?0:1,
    resultDifferences:equal(result(resultA),result(resultB))?0:1,
    stateDifferences:equal(ckA.state,ckB.state)?0:1};
  failed ||= ['receiptDifferences','playDifferences','feedDifferences','resultDifferences','stateDifferences'].some(k=>count[k]);
  console.log(`seed ${seed}: ${JSON.stringify(count)}`);
}
console.log(`ERRAND PARITY ${failed?'FAIL':'PASS'}`);process.exitCode=failed?1:0;
