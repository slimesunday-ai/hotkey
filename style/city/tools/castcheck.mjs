// C2-cast · THE CAST PLAN IS A PURE FUNCTION OF THE RECORD (docs/redesign/stage-20261031.md, design A; simstate/record/cast-plan.js).
//   node style/city/tools/castcheck.mjs [--seeds 404,405,406]
// On each seed's feed, in node (no page, no ground: the plan's marks on the stand spots alone), for every show scene:
//   pure       the plan built twice from the same record is the same, figure for figure and mark for mark
//   prefix     a night's plan built from the record cut just after its own night frame equals the one built from the whole season:
//              no later frame changes an earlier scene's figures or marks
//   masked     every masked agent with a fight (show.masked[id].fight) is a figure of exactly that fight's scene and of no other
//              fight or prowl; one that is its own fight's target stands in it as its target, never in an attacker's slot (slime,
//              10-31: "As the hooded target")
//   once       no agent is a figure of two scenes on at the same minute (a fight, an arrest and lay low stay on to the close)
//   room       no two figures of the scenes on at once stand nearer than ROOM, unless the plan says the ground ran short
//   published  before a night frame's publication (revealAt) the plan neither reads that frame's events nor gives marks for that
//              night (marksAt): a daytime claim never reads tonight's cast
//   ground     a plan built while the injected ground has no map is not kept: once a map comes, the plan is the one built fresh on
//              it (a test map with walls in it), never the one sampled before
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const SEEDS = arg('seeds', '404,405,406').split(',').map(Number);
const { createCastPlan, ROOM } = await import('../simstate/record/cast-plan.js');
const { createShowPlanner } = await import('../simstate/record/show-plan.js');
const { addressesFor } = await import('../simstate/record/addresses.js');
const stands = JSON.parse(fs.readFileSync(path.join(ROOT, 'style/city/simstate/stands.json'), 'utf8'));

function feed(seed) {
  const file = path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
  if (!fs.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  return fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}
const planOf = frames => createCastPlan({ frames, planner: createShowPlanner(frames), book: addressesFor(frames[0].board.agents.map(a => a.id)), stands });
const sig = N => JSON.stringify([...N.scenes.values()].map(P => [P.id, P.figures.map(f => [f.id, f.key, f.role, f.mark?.x, f.mark?.z, f.mark?.ry])]));
const onTill = (P, plan) => P.beat === 'fight' || P.beat === 'arrest' || P.kind === 'laylow' ? plan.end : P.end;

const out = { seeds: SEEDS, nights: 0, scenes: 0, figures: 0, impure: [], prefix: [], masked: [], maskedTargets: [], twice: [], room: [], short: 0, early: [], frozen: [] };
const { revealAt } = await import('../simstate/record/player.js');
// (a test map: sidewalk at 0.2 m with a wall 1.5 m high on every third metre square, so ground read or not changes the marks)
const flat = (x, z, h) => ({ at: (px, pz) => Math.abs(px - x) <= h && Math.abs(pz - z) <= h ? ((Math.floor(px) + Math.floor(pz)) % 3 === 0 ? 1.5 : .2) : null });
for (const seed of SEEDS) {
  const frames = feed(seed), A = planOf(frames), B = planOf(frames);
  for (const [i, f] of frames.entries()) { if (f.step.kind !== 'night') continue; const n = f.day;
    const a = A.night(n), b = B.night(n); out.nights++;
    // (the night frame behind a proxy that notes any read of its events: none before its publication)
    { const at = revealAt(f); let read = 0; const spy = new Proxy(f, { get: (o, k) => { if (k === 'events') read++; return o[k]; } }), fs = frames.map(g => g === f ? spy : g);
      const early = planOf(fs).marksAt(at - .01); if (early.length || read) out.early.push(`${seed} n${n}: ${early.length} marks, its events read ${read} times before ${at}`); }
    { let ready = false; const mk = () => createCastPlan({ frames, planner: createShowPlanner(frames), book: addressesFor(frames[0].board.agents.map(a => a.id)), stands, ground: { occ: (x, z, h) => ready ? flat(x, z, h) : null } });
      const G = mk(); G.night(n); ready = true; const kept = sig(G.night(n)), fresh = sig(mk().night(n)); if (kept !== fresh) out.frozen.push(`${seed} n${n}`); }
    if (sig(a) !== sig(b)) out.impure.push(`${seed} n${n}`);
    const cut = planOf(frames.slice(0, i + 1)).night(n);
    if (sig(cut) !== sig(a)) out.prefix.push(`${seed} n${n}`);
    const scenes = [...a.scenes.values()]; out.scenes += scenes.length; out.figures += scenes.reduce((k, P) => k + P.figures.length, 0);
    out.short += scenes.reduce((k, P) => k + P.short, 0);
    // masked: in exactly its fight
    const show = f.events.find(e => e.type === 'show' && e.night === n), masked = show?.masked ?? {};
    for (const [id, m] of Object.entries(masked)) { if (m.fight == null) continue;
      const ev = f.events.find(e => e.id === m.fight);
      const inScenes = scenes.filter(P => (P.beat === 'fight' || P.kind === 'hooded') && P.figures.some(g => g.id === id));
      // (slime, 10-31, GAME.md §41, "As the hooded target": one that is its own fight's target stands in that fight as its target)
      if (ev?.target === id) { out.maskedTargets.push(`${seed} n${n} ${id}: target of fight ${m.fight}; figure of ${inScenes.map(P => P.id).join(',') || 'none'}`);
        if (inScenes.length !== 1 || inScenes[0].sc.eventId !== m.fight || inScenes[0].figures.filter(g => g.id === id).map(g => g.role).join() !== 'target') out.masked.push(`${seed} n${n} ${id}: target of fight ${m.fight}, not its hooded target alone (${inScenes.map(P => P.id + ':' + P.figures.filter(g => g.id === id).map(g => g.role)).join(', ')})`); continue; }
      if (inScenes.length !== 1 || inScenes[0].sc.eventId !== m.fight || inScenes[0].beat !== 'fight') out.masked.push(`${seed} n${n} ${id}: fight ${m.fight}, figure of [${inScenes.map(P => P.id).join(', ')}]`);
      else if (inScenes[0].figures.filter(g => g.id === id).length !== 1) out.masked.push(`${seed} n${n} ${id}: twice in ${inScenes[0].id}`); }
    // once: no agent in two scenes on at once; room between figures of scenes on at once
    for (let x = 0; x < scenes.length; x++) for (let y = x; y < scenes.length; y++) { const P = scenes[x], Q = scenes[y];
      if (P !== Q && !(P.start < onTill(Q, a.plan) && Q.start < onTill(P, a.plan))) continue;
      if (P !== Q) for (const g of P.figures) if (g.id && Q.figures.some(h => h.id === g.id)) out.twice.push(`${seed} n${n} ${g.id}: ${P.id} and ${Q.id}`);
      if (P === Q) { const ids = P.figures.filter(g => g.id).map(g => g.id); if (new Set(ids).size !== ids.length) out.twice.push(`${seed} n${n} ${P.id}: an agent twice`); }
      for (const g of P.figures) for (const h of Q.figures) { if (g === h || (P === Q && P.figures.indexOf(h) <= P.figures.indexOf(g)) || !g.mark || !h.mark || g.mark.short || h.mark.short) continue;
        // (a set piece's own pairs, and a fight's target with its attackers round it at arm's length, stand nearer by design)
        if (P === Q && (P.set || g.role === 'target' || h.role === 'target')) continue;
        const d = Math.hypot(g.mark.x - h.mark.x, g.mark.z - h.mark.z); if (d < ROOM - 1e-6) out.room.push(`${seed} n${n} ${P.id}/${Q.id} ${g.id ?? g.key}-${h.id ?? h.key} ${d.toFixed(2)} m`); } }
  }
}
const steps = { pure: !out.impure.length, prefix: !out.prefix.length, masked: !out.masked.length, once: !out.twice.length, room: !out.room.length, published: !out.early.length, ground: !out.frozen.length };
for (const [k, ok] of Object.entries(steps)) console.log(`${ok ? 'PASS' : 'FAIL'} ${k}`);
console.log(JSON.stringify({ ...out, impure: out.impure.slice(0, 10), prefix: out.prefix.slice(0, 10), masked: out.masked.slice(0, 20), twice: out.twice.slice(0, 20), room: out.room.slice(0, 20), nRoom: out.room.length, early: out.early.slice(0, 10), frozen: out.frozen.slice(0, 10) }, null, 1));
const ok = out.nights > 0 && Object.values(steps).every(Boolean);
console.log(ok ? 'castcheck PASS' : 'castcheck FAIL');
process.exit(ok ? 0 : 1);
