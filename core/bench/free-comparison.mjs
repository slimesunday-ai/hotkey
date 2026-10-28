// Bounded free policy ablation. No model calls or old-tape responses. CLI defaults to a manifest only.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {N} from '../numbers.mjs';
import {makeCast,makeBot,MODELS_MIX} from './bots.mjs';
import {runSeason} from './runner.mjs';
import {fingerprint,semanticSource} from './evidence.mjs';

export function safeAcquisitionPolicy(memo={}) {
  return {
    day(view) {
      if(view.day>N.listLastNight || memo.offered===view.day || view.me.jail) return [];
      const owned=new Set(view.me.pieces.map(p=>p.trait));
      const slots=new Set(view.me.pieces.map(p=>p.slot));
      const held=new Set((view.me.offers || []).map(o=>o.trait));
      const reserve=N.rent;
      const available=view.me.cash-reserve;
      const choice=view.board.list.filter(t=>t.opens<=view.day && t.left>0 && t.price<=available && !owned.has(t.trait) && !held.has(t.trait))
        .sort((a,b)=>Number(slots.has(a.slot))-Number(slots.has(b.slot)) || a.price-b.price || a.trait.localeCompare(b.trait))[0];
      if(!choice) return [];
      memo.offered=view.day;
      return [{kind:'offer',trait:choice.trait,amount:choice.price}];
    },
    night(view) {
      // R11: the hustle at the mall, lawless at the start, so it adds no star there; the walk home through downtown.
      return {play:view.day===N.nights?{kind:'board',place:'downtown'}:{kind:'hustle',place:'mall'},reason:'Safe income; buy one affordable new trait, preserve it, board.'};
    },
  };
}
export function comparisonManifest({seeds=[404],rules=['A'],modelSeats=4}={}) {
  if(!Array.isArray(seeds)||!seeds.length||seeds.length>20 || new Set(seeds).size!==seeds.length || seeds.some(s=>!Number.isSafeInteger(s))) throw new Error('free comparison seeds must be distinct integers, bounded at 20');
  if(!Array.isArray(rules)||!rules.length||rules.length>2 ||new Set(rules).size!==rules.length||rules.some(r=>!['A','B'].includes(r))) throw new Error('rules must be distinct A/B');
  const runs=[];
  for(const seed of seeds) {
    const selected=makeCast(seed,{...MODELS_MIX,models:modelSeats}).filter(c=>c.model).map(c=>c.id);
    const cast=makeCast(seed,{...MODELS_MIX,models:0});
    const surroundingCast=fingerprint(cast.filter(c=>!selected.includes(c.id)));
    for(const rule of rules) for(const arm of ['layer4','canny','safe-acquisition']) runs.push({seed,rule,arm,selected,surroundingCast});
  }
  return {schema:1,mode:'free matched selected-seat controller comparison',cost:0,networkCalls:0,source:semanticSource(),policySource:fingerprint(fs.readFileSync(fileURLToPath(import.meta.url),'utf8')),runs,
    interpretation:'Same four selected identities and full surrounding layer4 policies. Only selected policies change. Canny means canny/sharp controllers in those seats, not a full canny city. No threshold, model claim or old-tape replay.',
    safePolicy:'Hustle at the mall; reserve one dawn rent; at most one list offer per day, only an affordable unowned trait, prefer a missing outfit slot then lowest posted price and trait ID; never equip purchased traits; board downtown on night 14. No hidden state.'};
}
export function runFreeComparison({outDir,seeds=[404],rules=['A'],modelSeats=4,execute=false}={}) {
  if(!outDir) throw new Error('comparison requires an output directory');
  const manifest=comparisonManifest({seeds,rules,modelSeats});
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  if(!execute) return {manifest,results:[]};
  const results=manifest.runs.map(run=>{
    const selected=new Set(run.selected);
    const labels=Object.fromEntries(run.selected.map(id=>[id,run.arm]));
    const botFactory=(cfg,memo)=>selected.has(cfg.id)?run.arm==='safe-acquisition'?safeAcquisitionPolicy(memo):makeBot({...cfg,...(run.arm==='canny'?{canny:true,sharp:true}:{})},memo):makeBot(cfg,memo);
    const {metrics}=runSeason({seed:run.seed,rule:run.rule,outDir:path.join(outDir,run.arm),mix:{...MODELS_MIX,models:0},botFactory,controllerLabels:labels,controllerSource:manifest.policySource});
    return {...run,source:metrics.provenance.source,haul:run.selected.map(id=>metrics.haul[id]),acquisition:Object.fromEntries(run.selected.map(id=>[id,metrics.acquisition[id]])),bars:Object.fromEntries(Object.entries(metrics.bars).map(([k,b])=>[k,b.pass])),seasonKey:metrics.seasonKey};
  });
  fs.writeFileSync(path.join(outDir,'comparison.json'),JSON.stringify({manifest,results},null,2)+'\n');
  const mean=xs=>xs.reduce((n,x)=>n+x,0)/xs.length;
  const lines=['# Free selected-seat policy comparison','','Descriptive mechanisms, no replacement for the approved bars. '+manifest.interpretation,'',`Policy: ${manifest.safePolicy}`,'','| seed/rule | controller | selected seats | mean official haul | cash total | minted copies | own original purchase / other buyer |','|---|---|---|---|---|---|---|'];
  for(const r of results) {const a=Object.values(r.acquisition);const sum=k=>a.reduce((n,x)=>n+(x[k] || 0),0);lines.push(`| ${r.seed}/${r.rule} | ${r.arm} | ${r.selected.join(', ')} | ${mean(r.haul).toFixed(3)} | ${sum('cash')} | ${sum('minted')} | ${sum('ownList')} / ${sum('otherOrigin')} |`);}
  fs.writeFileSync(path.join(outDir,'README.md'),lines.join('\n')+'\n');
  return {manifest,results};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);let outDir=null,execute=false,seeds=[404],rules=['A'];
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--out') outDir=path.resolve(args[++i]);
    else if(args[i]==='--execute-free') execute=true;
    else if(args[i]==='--seeds') seeds=args[++i].split(',').map(Number);
    else if(args[i]==='--rules') rules=args[++i].split(',');
    else throw new Error(`unsupported option ${args[i]}; free/no-network only`);
  }
  const r=runFreeComparison({outDir,seeds,rules,execute});console.log(JSON.stringify({planned:r.manifest.runs.length,executed:r.results.length,cost:0,networkCalls:0}));
}
