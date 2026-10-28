// Read-only artifact rescore and mechanism report. Does not execute policies or call a model.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seasonMetrics,summarize} from './metrics.mjs';
import {summarizeActionCounters} from './evidence.mjs';
import {summaryMarkdown} from './report.mjs';
export function readSeasonEvidence(dir) {
  const ck=JSON.parse(fs.readFileSync(path.join(dir,'checkpoint.json'),'utf8'));
  if(!ck.state.over) throw new Error(`incomplete season: ${dir}`);
  const log=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  if(log.length!==ck.logLength) throw new Error(`checkpoint/log length mismatch: ${dir}`);
  const m=seasonMetrics(ck.state,log,{...ck.bench,models:ck.models},ck.cast);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'result.json'),'utf8'));
  for(const [id,haul] of Object.entries(saved.haul)) if(m.haul[id]!==haul) throw new Error(`saved haul differs for ${dir}/${id}`);
  return m;
}
export function auditRun(dir) {
  const seasons=at=>fs.readdirSync(at,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(at,e.name,'result.json'))).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>readSeasonEvidence(path.join(at,e.name)));
  const results=seasons(dir),twins=fs.existsSync(path.join(dir,'bots'))?seasons(path.join(dir,'bots')):[];
  if(!results.length) throw new Error(`no completed seasons: ${dir}`);
  return {input:path.resolve(dir),actionCounters:summarizeActionCounters(results.filter(r=>(r.modelSeats || []).length).map(r=>r.actionCounters)),summary:summarize(results,{twins}),results,twins};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.length!==4 || args[0]!=='--run'||args[2]!=='--out') throw new Error('usage: node core/bench/audit-run.mjs --run SAVED_RUN --out NEW_REPORT_DIR');
  const out=path.resolve(args[3]),input=path.resolve(args[1]);
  if(out===input || out.startsWith(input+path.sep)) throw new Error('report output must be outside the saved run');
  const r=auditRun(input);fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(r,null,2)+'\n');
  fs.writeFileSync(path.join(out,'README.md'),summaryMarkdown(r.summary,{seeds:`Read-only rescore: ${r.results.length} completed seasons from ${input}.`}));
  console.log(JSON.stringify({seasons:r.results.length,twins:r.twins.length,actionCounters:r.actionCounters,modelBar:r.summary.rows.find(r=>r.key==='models')?.cells.at(-1),out},null,2));
}
