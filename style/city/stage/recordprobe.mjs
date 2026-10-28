// C1-6 · THE STAGE PROBE ON THE RECORD: stage/probe.mjs's gate (removals in view, overlapping heads, bodies inside a bystander, falls onto
// something, crowd heads and bodies) measured on the record path's show, the scenes staged by stage/record.js from show-plan.js's
// running order, instead of seeded vignettes on an old run. The page's own counters (stage/index.js probe()) are turned on; an in-page
// director keeps the camera on the scene that matters now (a fight or an arrest first, else the anonymous prowlers, else a named
// play), ~25 m off and looking down as stage/probe.mjs's trials are watched, so a removal in view or an overlap is one a viewer sees.
//   import { PROBE_ON, PROBE_OFF, PROBE_READ, gate } from '../stage/recordprobe.mjs'   (tools/showscenario.mjs runs it per night)
//   node style/city/stage/recordprobe.mjs --port <p> [--seed 404] [--nights 2,3]   (its own run: the city served on --port)
// The gate: removedInView 0 · overlapPairs 0 · insidePairs 0 · fallHits 0 · crowdHeadPairs 0 · crowdBodyPairs 0.
export const PROBE_ON = `(() => { const S = window.__stage, R = window.__record; S.probe(true); const c = window.__city;
  const W = window.__recProbe = { on: true, aimed: [] }; let last = null;
  const f = () => { if (!W.on) return; const sh = R.player.snapshot().show;
    if (sh) { const pri = s => s.beat === 'fight' || s.beat === 'arrest' ? 0 : s.kind === 'hooded' ? 1 : s.kind === 'results' ? 9 : 2;
      const best = sh.active.filter(s => s.kind !== 'results').sort((a, b) => pri(a) - pri(b) || a.start - b.start)[0], L = best && R.draw.scenes.live.get(best.id);
      const w = L?.where; if (best && w && last !== best.id) { last = best.id; W.aimed.push(best.id); c.controls.target.set(w.x, .6, w.z); c.camera.position.set(w.x + 12, 18, w.z + 17); c.controls.update?.(); } }
    requestAnimationFrame(f); }; requestAnimationFrame(f); return true; })()`;
export const PROBE_OFF = `(() => { if (window.__recProbe) window.__recProbe.on = false; return true; })()`;
export const PROBE_READ = `(() => { const P = window.__stage.probe(true); return { removals: P.removals, removedInView: P.removedInView, inView: P.inView.slice(-5), overlapPairs: P.overlapPairs, overlapFrames: P.overlapFrames,
  lastOverlap: P.lastOverlap ?? null, insidePairs: P.insidePairs, lastInside: P.lastInside ?? null, falls: P.falls, fallHits: P.fallHits, crowdHeadPairs: P.crowdHeadPairs || 0, crowdBodyPairs: P.crowdBodyPairs || 0,
  lastCrowd: P.lastCrowd ?? null, minGap: P.minGap, aimed: window.__recProbe?.aimed.length ?? 0 }; })()`;
export const GATE = ['removedInView', 'overlapPairs', 'insidePairs', 'fallHits', 'crowdHeadPairs', 'crowdBodyPairs'];
export const gate = P => ({ ok: GATE.every(k => !P[k]), failing: GATE.filter(k => P[k]).map(k => `${k} ${P[k]}`) });

// ── its own run: the nights given (default: every night of the seed with a fight or an arrest), each played at 10× from 9:05 to its close
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { chrome, ready, choose, clickText, playUntil } = await import('../tools/recordscenario.mjs');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
  const PORT = +arg('port', 0), SEED = +arg('seed', 404); if (!PORT) { console.error('usage: node style/city/stage/recordprobe.mjs --port <p>'); process.exit(2); }
  const B = await chrome(), base = `http://127.0.0.1:${PORT}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&recordPaused=1&tod=night&simtod=0`;
  let total = null;
  try {
    await B.send('Page.navigate', { url: base }); await ready(B);
    const nights = arg('nights') ? arg('nights').split(',').map(Number) : await B.ev(`window.__record.player.shows().map(s => s.night).filter(n => window.__record.draw.planner.night(n).scenes.some(s => s.beat === 'fight' || s.beat === 'arrest'))`);
    await B.ev(PROBE_ON);
    for (const n of nights) {
      await choose(B, '#record-player select[aria-label="Night to replay"]', n); await clickText(B, 'Go to show'); await ready(B); await B.ev(PROBE_ON);
      await choose(B, '#record-player select[aria-label="Playback speed"]', 10);
      const end = await B.ev(`window.__record.draw.planner.night(${n}).end`); await playUntil(B, end + .5, 600000);
      total = await B.ev(PROBE_READ); console.log(`night ${n}: ${JSON.stringify(total)}`);
    }
    const g = gate(total); console.log(`RECORDPROBE ${g.ok ? 'PASS' : 'FAIL ' + g.failing.join(', ')}`); process.exitCode = g.ok ? 0 : 1;
  } catch (e) { console.log('RECORDPROBE FAIL ' + e.message); process.exitCode = 1; }
  await B.close();
}
