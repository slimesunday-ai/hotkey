// C2-seek · THE STAND PLAN IS A PURE, CAUSAL FUNCTION OF THE RECORD (docs/redesign/tape-20261103.md, design A; simstate/record/stand-plan.js).
//   node style/city/tools/standcheck.mjs [--seeds 404,405,406] [--cuts 6]
// On each seed's feed, in node (no page: the measured stand spots widened as the drawing widens them, each home's three doorstep spots at
// its lot, the drawing's walk cost (nearByWalk), no venues: a sit-down stands at its place, as the drawing without a stage has it), the season swept to its end:
//   pure      the plan built twice from the same record gives the same spot to every stay, record for record
//   prefix    the plan built from the record cut at a frame (every --cuts-th night frame and the day frame before it) equals the whole
//             season's up to that frame's publication: no later frame changes where anyone stood before it
//   causal    built on the whole record with every frame published after the minute behind a proxy that counts reads, the sweep to that
//             minute reads none of them (the cast plan of a night only from its publication, nothing later)
//   claims    every stay at a place with spots gets one or is the place's overflow (none free), and no two stays hold one spot at once
// The agreement with play (the note's §5: the same spot play gives) needs the page: tools/standagree.mjs.
// --plant <impure|peek|prefix|twice>: a fault planted in memory (never in a source file) on seed 404, to show the step that guards it
// fails: impure (a random cost), peek (every state read also reads the season's last frame), prefix (a stay's spot read from the season's
// length), twice (every claim takes the place's first spot, held or not)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PLANT = arg('plant', null), SEEDS = (PLANT ? '404' : arg('seeds', '404,405,406')).split(',').map(Number), CUTS = +arg('cuts', 6);
const rec = f => import(new URL(`../simstate/record/${f}`, import.meta.url));
const [{ parseFeed }, { createRoutinePlanner }, { createShowPlanner }, { addressesFor }, C, { createCastPlan, createStandInputs }, SP, { revealAt }, { createTrips }] = await Promise.all(
  ['adapter.js', 'routines.js', 'show-plan.js', 'addresses.js', 'continuity.js', 'cast-plan.js', 'stand-plan.js', 'player.js', 'trips.js'].map(rec));
const stands = JSON.parse(fs.readFileSync(path.join(ROOT, 'style/city/simstate/stands.json'), 'utf8')), wide = SP.widenStands(stands);
const trips = createTrips();

function feed(seed) {
  const file = path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
  if (!fs.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  return parseFeed(fs.readFileSync(file, 'utf8'));
}
// the drawing's inputs, from these frames alone (draw.js builds the same from the page's)
function planOf(frames) {
  const routines = createRoutinePlanner(frames), planner = createShowPlanner(frames), TL = C.buildTimeline(frames, routines, planner), rule = C.createTripRule({ timeline: TL, planner, trips });
  const roster = frames[0].board.agents.map(a => a.id), book = addressesFor(roster), meetings = new Map();
  for (const d of new Set(frames.map(f => f.day))) for (const c of routines.day(d).meetings) meetings.set(c.eventId, c);
  const homes = new Map(); for (const b of Object.values(book)) { const id = C.HOME + b.home, sp = { x: b.x, y: .2, z: b.z, ry: 0, k: 0, place: id, kind: 'open' };
    homes.set(id, [sp, { ...sp, x: sp.x + 1.4, k: 1 }, { ...sp, x: sp.x - 1.4, k: 2 }]); }
  const lists = new Map([...Object.entries(wide.places).map(([id, p]) => [id, p.spots.map((s, k) => ({ ...s, k, place: id }))]), ...homes]);
  const spotsOf = p => lists.get(p);
  const nights = frames.filter(f => f.step.kind === 'night').map(f => f.day), published = new Map(nights.map(n => [n, revealAt(frames.find(f => f.step.kind === 'night' && f.day === n))]));
  const cplan = createCastPlan({ frames, planner, book, stands: wide }), SI = createStandInputs({ cplan, spotsOf });
  const stateAt = C.createStateAt({ frames, timeline: TL, rule, meetings }), playAt = SP.createPlayAt(planner, nights);
  const bounds = (a, b) => { const out = []; for (const n of nights) { if (!(published.get(n) <= b)) continue; for (const x of SI.planBounds(n)) if (x > a && x <= b) out.push(x); } return out.sort((x, y) => x - y); };
  const states = SP.createStandStates({ timeline: TL, stateAt, spotsOf, playAt, meetings });
  const stateOf = PLANT === 'peek' ? (id, t) => { void frames[frames.length - 1].step; return states(id, t); } : PLANT === 'prefix' ? (id, t) => { const o = states(id, t); if (o.st) o.st = { ...o.st, role: frames.length % 2 ? 'deal' : 'hang' }; return o; } : states;
  const near = PLANT === 'impure' ? () => () => Math.random() * 20 : SP.nearByWalk(trips.walkLen), planned = PLANT === 'twice' ? (id, place) => spotsOf(place)?.[0] ?? null : SI.planSpotAt;
  const plan = SP.createStandPlan({ roster, from: frames[0].minute, stateOf, spotsOf, near, kept: SI.keptAt, planned, bounds });
  return { plan, TL };
}
const sig = (P, m) => JSON.stringify(P.records(m));
const out = { seeds: SEEDS, stays: 0, impure: [], prefix: [], causal: [], twice: [], cuts: 0, ms: {} };
for (const seed of SEEDS) {
  const frames = feed(seed), t0 = Date.now(), A = planOf(frames), end = A.TL.to;
  const a = sig(A.plan, end), b = sig(planOf(frames).plan, end); out.ms[seed] = Date.now() - t0;
  if (a !== b) out.impure.push(`${seed}`);
  // claims: no two stays on one spot at once (the records replayed: each agent's latest record at every record minute)
  { const R = A.plan.records(end), ev = []; for (const [id, L] of R) for (const r of L) ev.push([r[0], id, r[1], r[2]]); ev.sort((x, y) => x[0] - y[0]);
    const holder = new Map(), at = new Map(); out.stays += ev.filter(e => e[2] !== null).length;
    for (let i = 0; i < ev.length; i++) { const [t, id, place, r] = ev[i]; const o = at.get(id); if (o && holder.get(o) === id) holder.delete(o); at.delete(id);
      if (place !== null && r !== null && typeof r === 'number') { const k = `${place}#${r}`; at.set(id, k); if (holder.has(k) && holder.get(k) !== id && (ev[i + 1]?.[0] !== t)) out.twice.push(`${seed}@${t.toFixed(2)} ${k}: ${holder.get(k)} and ${id}`); holder.set(k, id); } } }
  // prefix and causal at cuts: night frames (every CUTS-th) and the frame before each
  const idx = frames.map((f, i) => [f, i]).filter(([f]) => f.step.kind === 'night').map(([, i]) => i).filter((_, k) => k % CUTS === 0).flatMap(i => [i - 1, i]).filter(i => i > 0 && i < frames.length - 1);
  for (const i of idx) { const M = revealAt(frames[i]); out.cuts++;
    const cut = planOf(frames.slice(0, i + 1)).plan;
    if (sig(cut, M) !== sig(A.plan, M)) out.prefix.push(`${seed} cut at frame ${i} (minute ${M})`);
    let armed = false, reads = 0, first = null; const spy = frames.map((f, j) => revealAt(f) > M ? new Proxy(f, { get: (o, k) => { if (armed) { reads++; first ??= `frame ${j} .${String(k)}`; } return o[k]; } }) : f);
    const P = planOf(spy).plan; armed = true; P.advance(M); armed = false;
    if (reads) out.causal.push(`${seed} to minute ${M}: ${reads} reads of later frames (first ${first})`); }
}
const steps = { pure: !out.impure.length, prefix: !out.prefix.length, causal: !out.causal.length, claims: !out.twice.length };
for (const [k, ok] of Object.entries(steps)) console.log(`${ok ? 'PASS' : 'FAIL'} ${k}`);
console.log(JSON.stringify({ ...out, prefix: out.prefix.slice(0, 10), causal: out.causal.slice(0, 10), nTwice: out.twice.length, twice: out.twice.slice(0, 10) }));
const ok = out.stays > 0 && out.cuts > 0 && Object.values(steps).every(Boolean);
if (PLANT) { const guard = { impure: 'pure', peek: 'causal', prefix: 'prefix', twice: 'claims' }[PLANT], caught = steps[guard] === false;
  console.log(`plant ${PLANT}: ${guard} ${caught ? 'FAILS, as it must' : 'still passes: the step does not guard it'}`); process.exit(caught ? 1 : 2); }
console.log(ok ? 'standcheck PASS' : 'standcheck FAIL');
process.exit(ok ? 0 : 1);
