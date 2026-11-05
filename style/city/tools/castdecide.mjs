// C2-cast · THE DECIDING TEST (docs/redesign/stage-20261031.md §5): the cast plan's figures for a seed's fights and prowls
// (simstate/record/cast-plan.js, computed in the page on the stage's own ground) against what the page plays for those scenes.
//   node style/city/tools/castdecide.mjs --port 5971 [--seed 404] [--out <dir>]
// Each night with a fight or a prowl: sought a half minute before its first such scene and played from there, at 1x from a quarter
// minute before each scene's start to a minute after it, at 10x between. Read per scene: the stage's ledger (stage/record.js log():
// every agent drawn as itself, every stand-in), and each figure's mark at 40% of a prowl's window / 80% of a fight's (before the
// payoff). Match: the plan's ids and stand-in count equal the ledger's. Marks: each figure's distance from its planned mark.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';
import { createShowPlanner } from '../simstate/record/show-plan.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), SEED = +arg('seed', 404), BASE = `http://127.0.0.1:${PORT}`, OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-cast')));
const FEED = `/core/runs/${SEED}-A/feed.jsonl`, sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = (await fs.readFile(path.join(ROOT, FEED.slice(1)), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
const planner = createShowPlanner(frames), nights = frames.filter(f => f.step.kind === 'night').map(f => f.day);
const isProwl = sc => sc.kind === 'hooded' && sc.beat === 'ambient', want = sc => sc.beat === 'fight' || isProwl(sc);

const PLAN = `(async () => { const R = window.__record, D = R.draw, C = D.stage.ctx;
  const [{ createCastPlan }, { default: stands }] = await Promise.all([import('/style/city/simstate/record/cast-plan.js'), import('/style/city/simstate/stands.json', { with: { type: 'json' } })]);
  const P = createCastPlan({ frames: R.frames, planner: D.planner, book: D.book, stands, ground: { occ: (x, z, h) => C.occ(x, z, h), laneNear: (x, z, r) => C.psim?.laneNear?.(x, z, r) ?? null, door: lot => D.layer.homeAt(lot) } });
  window.__castPlan = P; return true; })()`;
const RUN = (ids, stop) => `(() => { const R = window.__record, D = R.draw, P = R.player, want = ${JSON.stringify(ids)}, scs = want.map(id => D.planner.night(Math.floor(${stop} / 1440)).scenes.find(s => s.id === id));
  const W = window.__cd = { samples: {}, done: false };
  (function f() { const m = P.minute;
    for (const sc of scs) { const at = sc.start + (sc.end - sc.start) * (sc.beat === 'fight' ? .8 : .4); const S = D.scenes.live.get(sc.id);
      if (!W.samples[sc.id] && m >= at && S) W.samples[sc.id] = { m, figs: S.actors.filter(A => !A.freed && A.w).map(A => ({ h: A.h, kind: A.kind, x: +(A.marks?.[0]?.x ?? A.tx ?? A.x).toFixed(2), z: +(A.marks?.[0]?.z ?? A.tz ?? A.z).toFixed(2) })) }; }
    const slow = scs.some(sc => m >= sc.start - .25 && m < sc.start + 1), sp = slow ? 1 : 10; if (P.speed !== sp) P.setSpeed(sp);
    if (m >= ${stop}) { P.pause(); W.done = true; return; } requestAnimationFrame(f); })(); return true; })()`;

const server = await serve(), B = await chrome(), result = { seed: SEED, scenes: [] };
try {
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const first = nights.find(n => planner.night(n).scenes.some(want));
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&simtod=0&tod=night&recordPaused=1&recordAt=${first * 1440 + 1260}` }); await ready(B);
  for (let t = 0; t < 150 && !(await B.ev('!!window.__record?.draw?.scenes', false).catch(() => false)); t++) await sleep(200);
  await sleep(1500);
  await B.ev(PLAN); console.log('plan ready');
  // --replan <json>: the plan as it is now against a run's played ledger, no playing (the page computes the plan on its own ground)
  const REPLAN = arg('replan', null), old = REPLAN ? JSON.parse(await fs.readFile(REPLAN, 'utf8')) : null;
  if (old) for (const r of old.scenes) {
    const pl = await B.ev(`window.__castPlan.night(${r.night}).scenes.get(${JSON.stringify(r.id)}).figures.map(f => ({ id: f.id, key: f.key, short: !!f.mark?.short }))`);
    const ids = pl.filter(f => f.id).map(f => f.id).sort(), nS = pl.filter(f => !f.id).length;
    const ok = !!r.played && r.played.actors.slice().sort().join() === ids.join() && r.played.standIns === nS;
    const row = { night: r.night, id: r.id, ok, plan: { ids, standIns: nS, short: pl.filter(f => f.short).length }, played: r.played, marks: r.marks }; result.scenes.push(row); console.log(JSON.stringify(row)); }
  for (const n of old ? [] : nights) {
    const scs = planner.night(n).scenes.filter(want); if (!scs.length) continue;
    const from = Math.min(...scs.map(s => s.start)) - .5, stop = Math.max(...scs.map(s => s.end)) + .05;
    await B.ev(`(() => { const P = window.__record.player; P.pause(); P.seek(${from}); window.__record.draw.scenes.clearLog(); return true; })()`);
    await sleep(1500);
    await B.ev(RUN(scs.map(s => s.id), stop));
    await B.ev(`window.__record.player.setSpeed(1); window.__record.player.play(); true`);
    console.log('night', n, 'from', from.toFixed(2), 'to', stop.toFixed(2)); const t0 = Date.now(); while (!(await B.ev('window.__cd.done', false).catch(() => false))) { if ((Date.now() - t0) % 60000 < 1000) console.log('  at', await B.ev('window.__record.player.minute', false).catch(e => String(e)), await B.ev('window.__record.player.running', false).catch(() => null)); if (Date.now() - t0 > 40 * 60000) throw new Error('night ' + n + ' did not finish'); await sleep(1000); }
    const got = await B.ev(`(() => { const L = window.__record.draw.scenes.log(), W = window.__cd, P = window.__castPlan;
      return ${JSON.stringify(scs.map(s => s.id))}.map(id => { const l = L.find(x => x.id === id), pl = P.night(${n}).scenes.get(id);
        return { id, log: l ? { actors: l.actors, standIns: l.standIns.length } : null, sample: W.samples[id] ?? null, plan: pl.figures.map(f => ({ id: f.id, key: f.key, x: f.mark.x, z: f.mark.z, short: !!f.mark.short })) }; }); })()`);
    for (const g of got) {
      const ids = g.plan.filter(f => f.id).map(f => f.id).sort(), nS = g.plan.filter(f => !f.id).length;
      const ok = !!g.log && g.log.actors.slice().sort().join() === ids.join() && g.log.standIns === nS;
      // marks: the sample's figures to the plan's, an agent by its id, the stand-ins nearest first
      const dist = [];
      if (g.sample) { const pS = g.plan.filter(f => !f.id).slice();
        for (const F of g.sample.figs) { if (F.kind === 'held') { const q = g.plan.find(f => f.id === F.h); dist.push(q ? Math.hypot(q.x - F.x, q.z - F.z) : null); continue; }
          let bi = -1, bd = Infinity; pS.forEach((q, i) => { const d = Math.hypot(q.x - F.x, q.z - F.z); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) pS.splice(bi, 1); dist.push(bi >= 0 ? bd : null); } }
      const row = { night: n, id: g.id, ok, plan: { ids, standIns: nS, short: g.plan.filter(f => f.short).length }, played: g.log, marks: dist.map(d => d === null ? null : +d.toFixed(2)), sampledFigures: g.sample?.figs.length ?? null };
      result.scenes.push(row); console.log(JSON.stringify(row));
    }
  }
} catch (e) { result.error = String(e && e.stack || e); console.log('ERROR', result.error); }
finally { await B.close(); server?.kill(); }
const n = result.scenes.length, ok = result.scenes.filter(s => s.ok).length, D = result.scenes.flatMap(s => s.marks).filter(d => d !== null);
result.summary = { scenes: n, figuresMatch: ok, rate: n ? +(ok / n).toFixed(3) : 0, marks: D.length, within2m: D.filter(d => d <= 2).length, within05m: D.filter(d => d <= .5).length };
console.log('SUMMARY', JSON.stringify(result.summary));
await fs.mkdir(OUT, { recursive: true }); await fs.writeFile(path.join(OUT, `castdecide-${SEED}.json`), JSON.stringify(result, null, 1));
