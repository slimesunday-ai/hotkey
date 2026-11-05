// §41: "Watch the action live, details a day late". Linearly interpolated lag
// percentiles, physical visit counts, and on-disk sizes; no invented trip clock.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const arg = key => process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : null;
const root = path.resolve(arg('--root') ?? fileURLToPath(new URL('../../../', import.meta.url)));
const feeds = path.resolve(arg('--feeds') ?? path.join(root, 'core/runs'));
// Measured on 437bd82 with runner --seed <n> --rule A --cast layer4 --feed.
const TRUNK_BYTES = {404:3025977,405:3250946,406:2826791};
const baseline = arg('--size-baseline') ? path.resolve(arg('--size-baseline')) : null;
const { createRoutinePlanner } = await import(pathToFileURL(path.join(root, 'style/city/simstate/record/routines.js')));
const { parseFeed } = await import(pathToFileURL(path.join(root, 'style/city/simstate/record/adapter.js')));
const percentile = (values, q) => {
  if (!values.length) return 0;
  const at = (values.length - 1) * q, lo = Math.floor(at), hi = Math.ceil(at);
  return values[lo] + (values[hi] - values[lo]) * (at - lo);
};
const distribution = values => {
  const a = values.slice().sort((a,b) => a-b);
  return { count:a.length, p50:percentile(a,.5),p90:percentile(a,.9),p99:percentile(a,.99),max:a.at(-1)??0,
    over30:a.filter(x=>x>30).length,over60:a.filter(x=>x>60).length };
};
const report = {};
let failed = false;
for (const seed of [404,405,406]) {
  const file = dir => path.join(dir,`${seed}-A/feed.jsonl`);
  const raw = fs.readFileSync(file(feeds),'utf8'), frames = parseFeed(raw);
  const planner = createRoutinePlanner(frames);
  const cues = Array.from({length:14},(_,i)=>planner.day(i+1,(i+1)*1440+1265).acts).flat();
  const acts = cues.filter(a=>!a.blocked);
  const kinds = [...new Set(acts.map(a=>a.kind))];
  const byKind = Object.fromEntries(kinds.map(kind=>[kind,distribution(acts.filter(a=>a.kind===kind).map(a=>a.minute-a.published))]));
  const lag = distribution(acts.map(a=>a.minute-a.published));
  const bytes = Buffer.byteLength(raw), sizeBefore = baseline ? fs.statSync(file(baseline)).size : TRUNK_BYTES[seed];
  const wire = raw.trim().split('\n').map(JSON.parse);
  const row = { ...lag, blocked:cues.length-acts.length,frames:frames.length,bytes,baselineBytes:sizeBefore,ratio:bytes/sizeBefore,
    sightingsFrames:wire.filter(f=>Object.hasOwn(f,'sightings')).length,
    sightingsBytes:wire.reduce((n,f)=>n+(f.sightings===undefined?0:Buffer.byteLength(JSON.stringify(f.sightings))),0),
    byKind,over30ByKind:Object.fromEntries(kinds.map(k=>[k,byKind[k].over30]).filter(([,n])=>n).sort((a,b)=>b[1]-a[1])) };
  report[seed] = row;
  if (process.argv.includes('--check')) failed ||= lag.p90 > 30 || row.ratio > 1.2 || row.blocked > 0;
  console.log(`seed ${seed}: ${JSON.stringify(row)}`);
}
if (arg('--out')) fs.writeFileSync(arg('--out'),JSON.stringify(report,null,2)+'\n');
console.log(`ERRAND METRICS ${failed?'FAIL':'PASS'} (p90<=30; bytes<=1.2x 437bd82)`);
process.exitCode = failed ? 1 : 0;
