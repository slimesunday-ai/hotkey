// Typed evidence only: no event prose, replayed policies or alternate rules engine.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { keptActions } from '../agents/seat.mjs';

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const omit = (x, keys) => Object.fromEntries(Object.entries(x || {}).filter(([k]) => !keys.includes(k)));
const canonical = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v);
export const fingerprint = x => crypto.createHash('sha256').update(canonical(x)).digest('hex');
let source;
export function semanticSource() {
  if (source) return source;
  const files = dir => fs.readdirSync(path.join(CORE, dir), {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]).filter(f => /\.(mjs|json)$/.test(f)).sort();
  const hashFiles = fsList => fingerprint(fsList.map(f => [f, fs.readFileSync(path.join(CORE,f),'utf8')]));
  const rules = [...files('rules'),'numbers.mjs','data/items.json'].sort();
  source = {rules:hashFiles(rules),core:hashFiles([...rules,...files('agents'),'index.mjs','rng.mjs','bench/bots.mjs','bench/runner.mjs','bench/free-comparison.mjs','bench/fixtures/legacy-briefing.mjs','bench/fixtures/legacy-tools.mjs'].sort()),benchmark:hashFiles(['bench/evidence.mjs','bench/passbars.mjs','bench/metrics.mjs'])};
  return source;
}
export function setupProvenance({cast, bench, initial, numbers}) {
  return {schema:1,source:semanticSource(),cast:cast.map(c=>omit(c,['model'])),
    config:{seed:bench.seed,rule:bench.rule,midseason:bench.midseason,rounds:bench.rounds,overrides:bench.overrides || {},options:omit(bench.options,['modelSeats']),numbers:fingerprint(numbers)},
    initial:{...initial,agents:(initial.agents || []).map(a=>omit(a,['driver']))}};
}
const complete = p => p?.schema === 1 && typeof p.source?.core === 'string' && typeof p.source?.rules === 'string' && typeof p.source?.benchmark === 'string' && Array.isArray(p.cast)
  && ['seed','rule','midseason','rounds','overrides','options','numbers'].every(k=>Object.hasOwn(p.config || {},k))
  && Array.isArray(p.initial?.agents) && Array.isArray(p.initial?.drop);
// Missing fields are unknown, while every known disagreement is a hard mismatch.
function disagreements(a,b,prefix) {
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) return Object.keys(a).filter(k=>Object.hasOwn(b,k)).flatMap(k=>disagreements(a[k],b[k],`${prefix}.${k}`));
  return isDeepStrictEqual(a,b) ? [] : [prefix];
}
// R8b: the reply mode a season's model seats answered in (runner.mjs, --reply, a group's "reply"), from its setup: 'json'
// (none recorded), 'tools', or a mixed season's groups' modes in its groups' order ('tools/json/...') when they differ
// from the season's.
export const replyOf = r => {
  const o = r?.provenance?.config?.options || {};
  return Array.isArray(o.replies) ? o.replies.join('/') : o.reply || 'json';
};
// The briefing arm a season's model seats read (runner.mjs, --briefing), from its setup; none recorded is the current
// one. Two arms are two treatments: never paired or pooled as one. R8b: so are two reply modes, which the arm carries
// when they aren't JSON ('starter+tools'), as passbars.mjs reads it.
export const briefingOf = r => {
  const arm = r?.provenance?.config?.options?.briefing || 'current';
  const reply = replyOf(r);
  return reply === 'json' ? arm : `${arm}+${reply}`;
};
// R8 review (10-19): owners' Creeds are a treatment too. A season with the baseline Creed (by its sha256) or with owner
// edits (--creeds) never pools with one without. A model seat's bot twin is still matched on briefingOf alone: bots
// don't read Creeds.
export const creedOf = r => {
  const o = r?.provenance?.config?.options || {};
  const parts = [];
  if (o.creedBaseline?.sha256) parts.push(`baseline Creed ${o.creedBaseline.sha256.slice(0, 12)}`);
  if (Array.isArray(o.creeds) && o.creeds.length) parts.push(`owner Creeds ${crypto.createHash('sha256').update(JSON.stringify(o.creeds)).digest('hex').slice(0, 12)}`);
  return parts.join(', ');
};
// R9b: the dawn journal (runner.mjs --journal dawn) is a treatment too: a season whose seats were asked for journal
// entries never pools with one whose seats weren't. Bots read no journal, so a bot twin is still matched on briefingOf.
export const journalOf = r => r?.provenance?.config?.options?.journal || 'off';
// R10b: the owner's preset trade orders (runner.mjs --orders-baseline), by their sha256, are a treatment too: a season
// with them never pools with one without, or with another preset. A bot twin has no model seat to carry them, but it
// is run with the same preset (its setup keeps it), and twinValidation refuses a twin whose preset differs.
export const ordersOf = r => r?.provenance?.config?.options?.ordersBaseline?.sha256 || '';
export const treatmentOf = r => {
  const parts = [creedOf(r), journalOf(r) === 'off' ? '' : `journal ${journalOf(r)}`, ordersOf(r) ? `trade orders ${ordersOf(r).slice(0, 12)}` : ''].filter(Boolean);
  return parts.length ? `${briefingOf(r)} (${parts.join(', ')})` : briefingOf(r);
};
export function twinValidation(model, bot) {
  const reasons=[];
  if (!bot) return {status:'missing',reasons:['no matching seed/rule bot twin']};
  for (const key of ['seed','rule','midseason','overrides']) if (model[key] !== undefined && bot[key] !== undefined && !isDeepStrictEqual(model[key],bot[key])) reasons.push(key);
  if (briefingOf(model) !== briefingOf(bot)) reasons.push('briefing arm');
  if (replyOf(model) !== replyOf(bot)) reasons.push('reply mode');
  if (ordersOf(model) !== ordersOf(bot)) reasons.push('trade orders preset');
  if ((bot.modelSeats || []).length) reasons.push('twin has model seats');
  const ids=model.modelSeats || [];
  if (new Set(ids).size !== ids.length) reasons.push('duplicate selected seat');
  for (const id of ids) if (!Object.hasOwn(bot.typeOf || {},id) || bot.typeOf[id] !== model.typeOf?.[id] || !Number.isFinite(model.haul?.[id]) || !Number.isFinite(bot.haul?.[id])) reasons.push(`selected identity/haul ${id}`);
  if (model.cast && bot.cast && !isDeepStrictEqual(model.cast.map(c=>omit(c,['model'])),bot.cast.map(c=>omit(c,['model'])))) reasons.push('whole cast');
  const m=model.provenance,b=bot.provenance;
  if (m && b) {
    if (complete(m) && complete(b)) { for (const key of ['schema','source','cast','config','initial']) if (!isDeepStrictEqual(m[key],b[key])) reasons.push(`provenance.${key}`); }
    else reasons.push(...disagreements(m,b,'provenance'));
  }
  if (complete(m) && complete(b)) {
    for (const id of ids) if (!m.cast.some(c=>c.id===id && c.type===model.typeOf[id])) reasons.push(`provenance selected identity ${id}`);
    for (const [r,p] of [[model,m],[bot,b]]) {
      const castIds=p.cast.map(c=>c.id).sort();
      const setupIds=p.initial.agents.map(c=>c.id).sort();
      if(new Set(castIds).size!==castIds.length || !isDeepStrictEqual(castIds,setupIds)) reasons.push('provenance whole cast/setup identities');
      if(r.cast && !isDeepStrictEqual(r.cast.map(c=>omit(c,['model'])),p.cast)) reasons.push('artifact/provenance cast');
    }
    for (const [r,p] of [[model,m],[bot,b]]) for (const key of ['seed','rule','midseason','overrides']) if (r[key] !== undefined && !isDeepStrictEqual(r[key],p.config[key])) reasons.push(`artifact/config ${key}`);
  }
  return {status:reasons.length ? 'invalid' : complete(m) && complete(b) ? 'verified' : 'legacy/unknown',reasons,unknown:complete(m) && complete(b) ? [] : ['full setup/source/config provenance unavailable']};
}
export const modelStatus = c => !c.n ? 'NO PAIRS' : !c.settled ? 'UNSETTLED' : c.verdict ? 'PASS' : 'FAIL';

export function actionCounters(models,log,ids) {
  const selected=new Set(ids);
  const seatsKnown=ids.every(id=>Array.isArray(models?.seats?.[id]?.record));
  // R9b: a dawn journal call (round 'dawn') can't act, so it is counted apart and never dilutes the acting calls' rates.
  const all=ids.flatMap(id=>models?.seats?.[id]?.record || []);
  const records=all.filter(r=>r.round!=='dawn');
  const dawnCalls=all.filter(r=>r.round==='dawn').flatMap(r=>r.attempts || []).filter(a=>a.call!==null).length;
  const recordsKnown=seatsKnown && records.every(r=>Array.isArray(r.attempts) && r.attempts.every(a=>a.call===null || Number.isInteger(a.call)));
  const attempts=records.flatMap(r=>r.attempts || []).filter(a=>a.call !== null);
  const hasActions=attempts.filter(a=>Array.isArray(a.actions));
  const actions=hasActions.flatMap(a=>a.actions);
  const actionsKnown=recordsKnown && hasActions.length===attempts.length;
  const refused=r=>r.ok===false;
  const read=a=>['read','lookup'].includes(a.act);
  const errand=a=>a.act && a.act!=='play' && !read(a);
  const plays=log.filter(e=>e.type==='play' && selected.has(e.agent));
  const byKind=Object.fromEntries([...new Set(plays.map(e=>e.kind))].sort().map(k=>[k,plays.filter(e=>e.kind===k).length]));
  const rejected=actions.filter(refused);
  const refusalCounts={total:rejected.length,errands:rejected.filter(errand).length,playSelections:rejected.filter(a=>a.act==='play').length,reads:rejected.filter(read).length,other:rejected.filter(a=>!a.act).length};
  const refusals={...refusalCounts,bySource:Object.fromEntries(['core','tools','unknown'].map(source=>{
    const rows=rejected.filter(a=>(['core','tools'].includes(a.source)?a.source:'unknown')===source);
    return [source,{total:rows.length,errands:rows.filter(errand).length,playSelections:rows.filter(a=>a.act==='play').length,reads:rows.filter(read).length,other:rows.filter(a=>!a.act).length}];
  }))};
  // R10b: an errand the seat's trade orders sent, and the rules refused, is the routine's, not the model's: its event
  // is named in an 'orders' record's `of` (rules/errand.mjs).
  const byOrders=new Set(log.filter(e=>e.type==='orders').flatMap(e=>e.of || []));
  const coreEvents=log.filter(e=>e.type==='invalid' && 'errand' in e && selected.has(e.by ?? e.agent) && !byOrders.has(e.n));
  return {refusals,coverage:actionsKnown ? 'complete' : 'legacy/unknown',
    calls:recordsKnown ? attempts.length : null,observedCalls:attempts.length,callsWithTelemetry:hasActions.length,callsWithRefusal:actionsKnown ? hasActions.filter(a=>a.actions.some(refused)).length : null,
    callsWithRefusalObserved:hasActions.filter(a=>a.actions.some(refused)).length,
    actions:actionsKnown ? actions.length : null,
    observedActions:actions.length,errands:actions.filter(errand).length,
    playSelections:actions.filter(a=>a.act==='play').length,reads:actions.filter(read).length,coreRefusals:actions.filter(a=>refused(a) && a.source==='core').length,
    toolRefusals:actions.filter(a=>refused(a) && a.source==='tools').length,coreInvalidErrandEvents:coreEvents.length,executedInvalidPlays:log.filter(e=>e.type==='invalid' && 'instead' in e && selected.has(e.agent ?? e.by)).length,executedPlays:plays.length,executedByKind:byKind,...(dawnCalls ? {dawnCalls} : {})};
}
// Every observed field is a lower bound when any season lacks canonical attempt telemetry.
export function summarizeActionCounters(counters) {
  counters=counters.map(c=>c ?? {coverage:'legacy/unknown'});
  const add = key => counters.reduce((n,c)=>n+(c[key] ?? 0),0);
  const known = key => counters.every(c=>c[key] != null) ? add(key) : null;
  const coverage = counters.every(c=>c.coverage==='complete' && c.refusals) ? 'complete' : 'legacy/unknown';
  const keys = ['total','errands','playSelections','reads','other'];
  const counts = rows => Object.fromEntries(keys.map(k=>[k,rows.reduce((n,c)=>n+(c?.[k] ?? 0),0)]));
  const refusals = {...counts(counters.map(c=>c.refusals)),bySource:Object.fromEntries(['core','tools','unknown'].map(s=>[s,counts(counters.map(c=>c.refusals?.bySource[s]))]))};
  return {coverage,seasons:counters.reduce((n,c)=>n+(c.seasons ?? 1),0),calls:known('calls'),actions:known('actions'),callsWithRefusal:known('callsWithRefusal'),
    ...Object.fromEntries(['observedCalls','observedActions','callsWithTelemetry','callsWithRefusalObserved','errands','playSelections','reads','coreRefusals','toolRefusals','coreInvalidErrandEvents','executedInvalidPlays','executedPlays'].map(k=>[k,add(k)])),
    refusals:counters.some(c=>c.refusals) ? refusals : null,...(counters.some(c=>c.dawnCalls) ? {dawnCalls:add('dawnCalls')} : {})};
}
export function acquisitionProfile(state,log,ids) {
  const buys=log.filter(e=>e.type==='buy');
  const first=new Map();for (const e of buys) if (!first.has(e.copy)) first.set(e.copy,e);
  return Object.fromEntries(ids.map(id=>{
    const mint=log.find(e=>e.type==='mint' && e.agent===id),cards=mint?.cards || [];
    const lineage=cards.map(c=>({copy:c.copy,originalBuyer:first.get(c.copy)?.agent ?? null,originalPrice:first.get(c.copy)?.price ?? null,lastAcquisition:(state.copies[c.copy]?.hist || []).filter(h=>h.to===`agent:${id}`).at(-1)?.what ?? 'unknown'}));
    const routes=Object.fromEntries([...new Set(lineage.map(c=>c.lastAcquisition))].sort().map(k=>[k,lineage.filter(c=>c.lastAcquisition===k).length]));
    const rarity=Object.fromEntries([...new Set(cards.map(c=>c.tier))].sort().map(t=>[t,cards.filter(c=>c.tier===t).length]));
    return [id,{cash:mint?.mainland ?? state.agents?.[id]?.mainland ?? null,minted:cards.length,uniqueTraits:new Set(cards.map(c=>c.trait)).size,slots:new Set(cards.map(c=>state.copies[c.copy]?.slot).filter(Boolean)).size,rarity,routes,lineage,
      ownList:cards.filter(c=>first.get(c.copy)?.agent===id).length,otherOrigin:cards.filter(c=>first.has(c.copy) && first.get(c.copy).agent!==id).length,unknownOrigin:cards.filter(c=>!first.has(c.copy)).length,
      purchased:buys.filter(e=>e.agent===id).length,purchasedNotRetained:buys.filter(e=>e.agent===id && !cards.some(c=>c.copy===e.copy)).length,purchasedRetained:cards.filter(c=>first.get(c.copy)?.agent===id).length,
      bookValue:cards.every(c=>first.has(c.copy)) ? cards.reduce((n,c)=>n+first.get(c.copy).price,0) : null}];
  }));
}
// R7, a mixed season's use, seat by seat. The paid transport's spend record (openrouter.mjs onCall, a line a request it
// sent, 429 retries and calls cut off included): -> { seat: { sent, costed, cost, tokens: { in, out, reasoning } } }: requests sent, those whose response carried a cost. A line
// a kill cut short counts for nothing, as spentIn counts it.
export function spendBySeat(text) {
  const out = {};
  for (const raw of String(text || '').split('\n')) {
    let l;
    try {
      l = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!l || typeof l !== 'object' || typeof l.seat !== 'string') continue;
    const x = (out[l.seat] ||= { sent: 0, costed: 0, cost: 0, tokens: { in: 0, out: 0, reasoning: 0 } });
    x.sent += 1;
    if (Number.isFinite(l.cost)) {
      x.costed += 1;
      x.cost += l.cost;
    }
    for (const k of ['in', 'out', 'reasoning']) if (Number.isFinite(l.tokens?.[k])) x.tokens[k] += l.tokens[k];
  }
  return out;
}
// The actions a tape line's reply sent, as the seat read them: its one JSON value's list ({"actions": [...]}, a bare
// list or one action), after any thinking; or, cut off or with words around it, its whole actions (seat.mjs
// keptActions). The record keeps what each action did, not how a lookup was asked, so a lookup's mode is read here.
function sentActions(reply) {
  const choice = reply && reply.body && Array.isArray(reply.body.choices) ? reply.body.choices[0] : null;
  const content = choice && choice.message ? choice.message.content : null;
  if (typeof content !== 'string') return [];
  const text = content.includes('</think>') ? content.slice(content.lastIndexOf('</think>') + '</think>'.length) : content;
  let x;
  try {
    x = JSON.parse(text);
  } catch {
    return keptActions(text);
  }
  return Array.isArray(x) ? x : x && Array.isArray(x.actions) ? x.actions : x && typeof x.act === 'string' ? [x] : [];
}
// Each model seat's use: from its record (runner.mjs's checkpoint `models.seats`), the call points it was asked at, the
// requests it made and the lookups the tools ran for it; from the tape (a line a request), each request's size in
// characters (its messages' text), the tokens its reply's usage gave, and the lookups and inspects its replies sent, an
// inspect counted as used when the tools ran its lookup; and from the spend record, when there is one, what each seat's
// requests cost. -> { seat: { callPoints, requests, chars: { total, max, n }, tokens: { in, out }, lookups,
// lookupsSent, inspectsSent, inspects, spend: { sent, costed, cost, tokens } or null } }.
// R9b: a dawn journal call (its record's round 'dawn') can't act, so callPoints, requests and chars count the acting
// calls only; a seat with dawn calls gets `dawn: { requests, chars: { total, max, n } }` beside them. Tokens and spend
// stay every request's, as billed.
export function seatUsage(models, tapeText, spendText = null) {
  const spend = spendText === null ? null : spendBySeat(spendText);
  const out = {};
  for (const [id, x] of Object.entries(models.seats || {})) {
    const acting = (x.record || []).filter(r => r.round !== 'dawn');
    const dawnCalls = (x.record || []).filter(r => r.round === 'dawn').flatMap(r => r.attempts || []).filter(a => a.call !== null).map(a => a.call);
    const attempts = acting.flatMap(r => r.attempts || []).filter(a => a.call !== null);
    const looked = new Set(attempts.filter(a => (a.actions || []).some(y => y.act === 'lookup' && y.ok === true)).map(a => a.call));
    out[id] = {
      callPoints: acting.length, requests: attempts.length, chars: { total: 0, max: 0, n: 0 }, tokens: { in: 0, out: 0 },
      lookups: attempts.reduce((t, a) => t + (a.actions || []).filter(y => y.act === 'lookup' && y.ok === true).length, 0),
      lookupsSent: 0, inspectsSent: 0, inspects: 0, looked, dawnCalls: new Set(dawnCalls),
      spend: spend ? spend[id] || { sent: 0, costed: 0, cost: 0, tokens: { in: 0, out: 0, reasoning: 0 } } : null,
      ...(dawnCalls.length ? { dawn: { requests: dawnCalls.length, chars: { total: 0, max: 0, n: 0 } } } : {}),
    };
  }
  for (const raw of String(tapeText || '').split('\n')) {
    let l;
    try {
      l = JSON.parse(raw);
    } catch {
      continue;
    }
    const u = l && out[l.seat];
    if (!u) continue;
    // R8b: a message's text, a string or (a cache-marked system message, openrouter.mjs) text parts.
    const chars = ((l.request && l.request.messages) || []).reduce((t, m) => t + (typeof m.content === 'string' ? m.content.length
      : Array.isArray(m.content) ? m.content.reduce((u, p) => u + (p && typeof p.text === 'string' ? p.text.length : 0), 0) : 0), 0);
    const dawn = u.dawnCalls.has(l.call);
    const size = dawn ? u.dawn.chars : u.chars;
    size.total += chars;
    size.max = Math.max(size.max, chars);
    size.n += 1;
    if (l.tokens) for (const k of ['in', 'out']) if (Number.isFinite(l.tokens[k])) u.tokens[k] += l.tokens[k];
    // A dawn reply is the entry's text, never actions.
    if (dawn) continue;
    const lookups = sentActions(l.reply).filter(a => a && a.act === 'lookup');
    u.lookupsSent += lookups.length;
    const inspect = lookups.some(a => a.mode === 'inspect');
    if (inspect) u.inspectsSent += 1;
    if (inspect && u.looked.has(l.call)) u.inspects += 1;
  }
  for (const u of Object.values(out)) {
    delete u.looked;
    delete u.dawnCalls;
  }
  return out;
}
