// $0 same-view formatter comparison. Both arms read identical legal views from current core seasons; no replies replayed.
// Usage: node core/test/paid-interface-briefing-metrics.mjs <frozen-legacy-briefing.mjs> <output.json>
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { viewFor } from '../rules/view.mjs';
import { N } from '../numbers.mjs';
import { rng, shuffle } from '../rng.mjs';
import { makeCast, makeBot, CASTS } from '../bench/bots.mjs';
import { MIDSEASON_ROTATION } from '../bench/runner.mjs';
import { read } from '../agents/tools.mjs';
import { briefing } from '../agents/briefing.mjs';
const legacyPath = process.argv[2]; const output = process.argv[3];
if (!legacyPath || !output) throw new Error('pass frozen legacy formatter and output JSON paths');
const { briefing: legacy } = await import(pathToFileURL(legacyPath));
const measures = () => ({ calls: 0, systemChars: 0, totalChars: 0, maxChars: 0, overBudget: 0, oldPlayCalls: 0, stashCalls: 0, speechLines: 0, cuts: {} });
const digest = files => crypto.createHash('sha256').update(files.map(f => fs.readFileSync(f)).join('\n')).digest('hex');
const formatterSources = { legacy: digest([legacyPath, path.join(path.dirname(legacyPath), 'legacy-tools.mjs')]), corrected: digest([new URL('../agents/briefing.mjs', import.meta.url), new URL('../agents/tools.mjs', import.meta.url)]) };
const result = { formatterSources, seeds: [404,405,406], rule: 'A', rounds: 3, cast: 'layer4', zeroStartingStake: true, network: false, legacy: legacyPath, arms: { legacy: measures(), corrected: measures() } };
function measure(id, s, log, from) {
  const rd = read(viewFor(s, log, id, 'agent'), { audience: 'seat', seed: 'same-view-free-comparison', from: from[id] }); from[id] = rd.deal.next;
  for (const [arm, formatter] of [['legacy',legacy],['corrected',briefing]]) {
    const msgs = formatter(rd.result); const text = msgs.map(m => m.content).join('\n'); const m = result.arms[arm];
    m.calls++; m.systemChars += msgs[0].content.length; m.totalChars += text.length; m.maxChars = Math.max(m.maxChars,text.length); m.overBudget += text.length > N['gap.briefing'].chars;
    const cut = text.match(/Left out to fit: (.+)\./)?.[1]?.split('; ') || []; for (const c of cut) m.cuts[c] = (m.cuts[c] || 0) + 1;
    m.oldPlayCalls += /played: its play on night|; played (?:night \d+ )?\w/.test(msgs[1].content);
    m.stashCalls += /had: its stash and cash|; had (?:on day \d+ )?\$/.test(msgs[1].content);
    m.speechLines += (text.match(/<speech>\n([\s\S]*?)\n<\/speech>/)?.[1] || '').split('\n').filter(Boolean).length;
  }
}
for (const seed of result.seeds) {
  const cast = makeCast(seed, CASTS.layer4); const r = newSeason({ seed, rule:'A', midseason:MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length], items:ITEMS, agents:cast.map(c=>({id:c.id,name:c.name,trade:c.trade,driver:`bot:${c.type}`})) });
  let s = r.state; const log = [...r.events]; const ids=Object.keys(s.agents).sort(); const from=Object.fromEntries(ids.map(id=>[id,1])); const memos={};
  const every=cast.some(c=>c.works); const bots=Object.fromEntries(cast.map(c=>[c.id,makeBot(every?{...c,every}:c,(memos[c.id]||={}))]));
  while (!s.over) {
    const day=s.day;
    for (let round=1;round<=3;round++) for (const id of shuffle(rng(seed,'order',day,round),ids)) {
      measure(id,s,log,from); const view=viewFor(s,log,id,'agent');
      for (const e of bots[id].day(view,{seed,day,round,rounds:3,rng:rng(seed,'bot',id,day,round)})) { const r=applyErrand(s,{...e,by:id});s=r.state;log.push(...r.events); }
    }
    const plays={}; for (const id of ids) if (!s.agents[id].jail) { measure(id,s,log,from);const view=viewFor(s,log,id,'agent'); const {play,reason}=bots[id].night(view,{seed,day,round:'night',rng:rng(seed,'bot',id,day,'night')});plays[id]={...play,reason}; }
    const night=settleNight(s,plays);s=night.state;log.push(...night.events);
  }
}
for (const m of Object.values(result.arms)) { m.meanSystemChars=m.systemChars/m.calls; m.meanTotalChars=m.totalChars/m.calls; }
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result));
