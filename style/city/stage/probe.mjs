// STAGE · THE PROBE (stage-a, 2026-10-08): many staged robberies and shots, seeded, in the live city on a paused replay, each watched
// from the default city camera (~25 m off, looking down, a seeded azimuth). __stage.probe(true) turns on stage/index.js's per-frame
// checks; the gate is:
//   removedInView   bodies removed while the camera could see them (stage/index.js free → seen()): 0
//   overlapPairs    two upright actors' heads (1.0 × 0.8 m boxes at their yaw) overlapping during a scene: 0
//   insidePairs     an upright actor inside a standing bystander (bodies < 0.6 m apart): 0
//   fallHits        a body going down onto a wall, a prop (occupancy > 0.3 m over its feet) or a person: 0
//   crowd heads     (2026-10-09) an upright actor's head box overlapping anyone else's, the crowd or an agent, walking or standing: 0
//   crowd bodies    the same, bodies closer than 0.6 m: 0
// STAGE-B (2026-10-08): arrests too — kinds arrest-plain, arrest-flee, arrest-scuffle (forced: e.stage.resist), arrest-patrol (a WANTED
// pickup by a patrol car: who null, the cop a stand-in out of the cruiser), arrest (the seeded share). The suspect's record is turned to
// jail as the sim's would be (the stage's `leaving` hold, then the event). Their gate, besides the above:
//   cuff gap        at the click, the cop's hands (1.22 − 0.39 m ahead of its root, where the lab's pair has them) against the suspect's
//                   wrists (0.39 m behind its root), as both are drawn: ≤ 0.05 m
//   into the car    at the door's shut the suspect's root is inside the hull's side (outBy ≤ 0.12 m) and alongside the rear door; hidden
// THE CRUISER (2026-10-09, stage/cruiser.js: it double-parks, and drives in the traffic). Each arrest records its stop (kerb · double ·
// none · no-lane), the walk to the door (m), roadD (the nearest traffic lane, m) and `was` (the pre-cruiser search's choice there: car ·
// kerb-taken · far · wall · no-kerb · no-lane). The share: arrests with the cruiser of those with a road within 40 m, now and before. And:
//   cars through it  traffic cars whose bodies overlap the cruiser's as drawn, any frame of its drive, stop and drive off: 0
//   the queue        cars standing behind it when it leaves, and the seconds until every one has moved 6 m on (recover)
// --survey: no scenes — every standing agent's stop, now and before (the share over all of them), then exit.
// After each trial the camera moves on (to the next place), so the bodies left lying (the dead) or leaving (hospital, jail) go once it
// can't see them; the run ends by sending the camera away and waiting for the last ones.
//   node style/city/stage/probe.mjs [--base http://127.0.0.1:5395/style/city/] [--simport 5396] [--seed 1] [--n 10] [--kinds a,b,…] [--places p,q]
// kinds: rob-hurt rob-hurt-gone rob fail fail-gone unseen-hurt shot shot-gone shot-dead rob-shot-dead arrest-plain arrest-flee
// arrest-scuffle arrest-patrol arrest (default: all, in turn; --kinds arrests: the five arrest kinds)
// Needs the city served and a replay (tools/simreplay.mjs <run> --port <simport> --speed 0).
import { open, sleep } from '../ui/tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SQ = process.env.SPREAD ? '&spread=' + process.env.SPREAD : '';   // (SPREAD=<m>: the page at ?spread=<m> — style/city/SPREAD.md; run its replay at the same SPREAD)
const BASE = opt('base', 'http://127.0.0.1:5395/style/city/'), PORT = opt('simport', '5396'), SEED = +opt('seed', 1), N = +opt('n', 10);
const ARRESTS = 'arrest-plain,arrest-flee,arrest-scuffle,arrest-patrol,arrest', KINDS = (opt('kinds', '') === 'arrests' ? ARRESTS : opt('kinds', '') || 'rob-hurt,rob-hurt-gone,rob,fail,fail-gone,unseen-hurt,shot,shot-gone,shot-dead,rob-shot-dead,' + ARRESTS).split(',');
let r = SEED >>> 0; const rnd = () => { r |= 0; r = r + 0x6D2B79F5 | 0; let t = Math.imul(r ^ r >>> 15, 1 | r); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const S = await open({ w: 1280, h: 720 }), out = [];
// --tape (2026-10-09, slime at the Grand Ave & 1st robbery: "the dude getting robbed's head is intersecting with a pedestrian"): no
// seeded scenes — every robbery and arrest of a recorded run, visited on the TAPE as a viewer does it (ui/tape/index.js goToEvent: the
// camera there, the tape playing, the stage on it), with the run's own people and crowd. Measured every frame on the page, on its own
// (stage/index.js's probe not needed, so an older stage measures the same): the scene's actors (the walkers the stage holds, stand-ins
// included), upright (no fall or lie clip) —
//   heads a/a   two actors' head boxes (1.0 × 0.8 m at their yaw, as stage/index.js `heads`) overlapping
//   heads a/b   an actor's head box overlapping anyone else's: the crowd or another agent, walking or standing (a kerb waiter, a passer-by)
//   bodies      an actor and anyone else closer than 0.6 m (their bodies inside each other)
// counted in frames and in distinct pairs (a pair once per 5 s). Needs the replay with --archive (the whole run on the tape):
//   node style/city/stage/probe.mjs --tape [--run <dir>] --base http://127.0.0.1:<port>/style/city/ --simport <archive replay port>
const TAPE = args.includes('--tape'), RUNDIR = opt('run', `${process.env.HOME}/Desktop/deadnet-sim-move/sim2/runs/2026-10-09T12-43-05-133Z-dry`);
async function tapeRun() {
  const fs = await import('node:fs'), EV = fs.readFileSync(RUNDIR + '/events.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.type === 'rob' || e.type === 'arrest');
  const only = opt('only', null)?.split(',').map(Number); const pick = only ? EV.filter(e => only.includes(e.id)) : EV;
  await S.go(`${BASE}?sim=live&simport=${PORT}&simtod=0&tape=1${SQ}`, { until: `window.__ui?.tape?.active && window.__city && !__city.loading && window.__simlive?.stage && window.__tape && !__tape.loading && __tape.window().horizon !== null`, ms: 300000 });
  await sleep(3000);
  await S.ev(`(() => { const C = window.__city, W = C.peds.sim.walkers, ctx = __stage.ctx, LOW = /^(shove_fall|fall_back|lie_|death_collapse|shot_hit|get_up)/, H = [.5, .4];
    const ax = r => [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]], box = w => ({ x: w.p[0], z: w.p[2], a: ax(w.yawS ?? w.p[3]) });
    const heads = (a, b) => { const d = [b.x - a.x, b.z - a.z]; for (const n of [...a.a, ...b.a]) { const r = q => H[0] * Math.abs(n[0] * q.a[0][0] + n[1] * q.a[0][1]) + H[1] * Math.abs(n[0] * q.a[1][0] + n[1] * q.a[1][1]); if (Math.abs(d[0] * n[0] + d[1] * n[1]) > r(a) + r(b) - .02) return false; } return true; };
    const T = window.__pt = { frames: 0, aaHead: 0, abHead: 0, abHeadWalk: 0, abBody: 0, aa: new Set(), ab: new Set(), body: new Set(), last: [], minAB: 99 };
    const isActor = w => typeof w.aid === 'string' && (w.aid.startsWith('stage:') || ctx.busy(w.aid)), id = w => w.aid || 'crowd' + w.id;
    const tick = () => { try { const A = W.filter(w => !w.gone && w.p && isActor(w)); if (A.length) { T.frames++; const win = Math.floor(performance.now() / 5000), up = A.filter(w => !LOW.test(w.g?.clip?.name || '')), mine = new Set(A);
        for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) if (heads(box(up[i]), box(up[j]))) { T.aaHead++; T.aa.add(id(up[i]) + '|' + id(up[j]) + '|' + win); }
        for (const a of up) for (const w of W) { if (mine.has(w) || w.gone || !w.p || Math.abs(w.p[0] - a.p[0]) > 1.5 || Math.abs(w.p[2] - a.p[2]) > 1.5) continue; const d = Math.hypot(w.p[0] - a.p[0], w.p[2] - a.p[2]); T.minAB = Math.min(T.minAB, d);
          if (heads(box(a), box(w))) { T.abHead++; if ((w.vc || 0) > .1) T.abHeadWalk++; const k = id(a) + '|' + id(w) + '|' + win; if (!T.ab.has(k)) { T.ab.add(k); T.last.push({ a: id(a), w: id(w), d: +d.toFixed(2), vc: +(w.vc || 0).toFixed(2), clip: a.g?.clip?.name || null }); if (T.last.length > 40) T.last.shift(); } }
          if (d < .6) { T.abBody++; T.body.add(id(a) + '|' + id(w) + '|' + win); } } } } catch (e) {} requestAnimationFrame(tick); };
    requestAnimationFrame(tick); return 1; })()`);
  const snap = async () => JSON.parse(await S.ev(`JSON.stringify((() => { const T = __pt, s = __stage.stats(); return { frames: T.frames, aaHead: T.aaHead, abHead: T.abHead, abHeadWalk: T.abHeadWalk, abBody: T.abBody, aa: T.aa.size, ab: T.ab.size, body: T.body.size, nLast: T.last.length, staged: s.staged, aftermath: s.aftermath, skipped: s.skipped }; })())`));
  const rows = [];
  for (const e of pick) {
    const m = { id: e.id, t: e.t, kind: e.type === 'arrest' ? 'arrest' : 'rob', text: e.text || e.type, who: e.who ?? null, to: e.to ?? null, at: e.at ?? null }, b = await snap();
    const went = await S.ev(`__ui.tape.goToEvent(${JSON.stringify(m)})`); let t0 = Date.now();
    for (let k = 0; k < 250; k++) { await sleep(100); if (await S.ev('!window.__ui.tape.visit')) break; }
    t0 = Date.now(); let seen = false; const cap = e.type === 'arrest' ? 170000 : 70000;
    while (Date.now() - t0 < cap) { await sleep(400); const n = await S.ev('__stage.list().length'); if (n) seen = true; if (seen && !n) break; if (!seen && Date.now() - t0 > 15000) break; }
    await S.ev(`(async () => { (await import(new URL('ui/tape/state.js', location.href).href)).tape.pause(); return 1; })()`);
    const a = await snap(), d = k => a[k] - b[k], kinds = o => Object.entries(a[o]).map(([k, v]) => [k, v - (b[o][k] || 0)]).filter(([, v]) => v).map(([k, v]) => k + ':' + v).join(' ');
    const last = d('nLast') > 0 ? JSON.parse(await S.ev(`JSON.stringify(__pt.last.slice(-${Math.min(3, d('nLast'))}))`)) : [];
    const row = { id: e.id, ts: e.ts, type: e.type, ok: e.ok, seen: e.seen, who: e.who, to: e.to, at: e.at, went, staged: kinds('staged'), aftermath: kinds('aftermath'), skipped: kinds('skipped'), frames: d('frames'), aaHead: d('aa'), aaFrames: d('aaHead'), abHead: d('ab'), abFrames: d('abHead'), abWalk: d('abHeadWalk'), body: d('body'), bodyFrames: d('abBody'), last };
    rows.push(row); console.log(`#${e.id} ${e.ts} ${e.type}${e.ok === false ? '(failed)' : ''}${e.seen === false ? '(unseen)' : ''} ${e.who}→${e.to} @${e.at} · staged ${row.staged || '-'}${row.aftermath ? ' · aftermath ' + row.aftermath : ''}${row.skipped ? ' · skipped ' + row.skipped : ''} · ${row.frames} frames · heads a/a ${row.aaHead} (${row.aaFrames} f) · heads a/b ${row.abHead} (${row.abFrames} f, walking ${row.abWalk} f) · bodies ${row.body} (${row.bodyFrames} f)${last.length ? ' ' + JSON.stringify(last) : ''}`);
  }
  const sum = k => rows.reduce((s, r) => s + r[k], 0), T = JSON.parse(await S.ev('JSON.stringify({ minAB: +__pt.minAB.toFixed(2) })'));
  console.log(`\nTAPE · ${rows.length} events (${rows.filter(r => r.type === 'rob').length} robberies, ${rows.filter(r => r.type === 'arrest').length} arrests) · staged in ${rows.filter(r => r.staged).length} · scene frames ${sum('frames')} · heads actor/actor ${sum('aaHead')} pairs (${sum('aaFrames')} frames) · heads actor/bystander ${sum('abHead')} pairs (${sum('abFrames')} frames, the bystander walking in ${sum('abWalk')}) · bodies ${sum('body')} pairs (${sum('bodyFrames')} frames) · nearest bystander ${T.minAB} m`);
  if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(rows, null, 1));
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5)); const logs = S.logs.filter(l => /stage/i.test(l)); if (logs.length) console.log('stage logs:', logs.slice(0, 5));
  process.exitCode = sum('aaHead') || sum('abHead') || sum('body') || S.errs.length ? 1 : 0; }
try { run: { if (TAPE) { await tapeRun(); break run; }
  await S.go(`${BASE}?sim=live&simport=${PORT}&movemock=1${SQ}`,{ until: 'window.__city && __city.marks.full && window.__simlive && __simlive.agents && !__city.loading && window.__stage', ms: 300000 });
  await sleep(3000); await S.ev('(__stage.probe(true), 1)');
  // the jail, as the sim sends it: an arrested agent's record says jail from the arrest on (the replay is paused: its records never change)
  await S.ev(`(() => { const G = __simlive.agents, f = G.setAgents.bind(G); G.__jail = new Set(); G.setAgents = (l, o) => f(l.map(r => G.__jail.has(r.id) ? { ...r, status: 'jail', at: 'jail', trip: null } : r), o); return 1; })()`);
  const places = JSON.parse(await S.ev(`JSON.stringify((() => { const by = {}; for (const a of __simlive.agents.map.values()) if (a.w && a.mode === 'stand' && a.spot) (by[a.spot.place] ||= []).push(a.id); return Object.entries(by).filter(([, l]) => l.length >= 2); })())`));
  if (args.includes('--survey')) {   // every standing agent: the stop now and before
    const rows = JSON.parse(await S.ev(`(async () => { const V = await import('./stage/vignettes.js'), C = __stage.ctx, out = [];
      for (const a of __simlive.agents.map.values()) { if (!a.w || a.mode !== 'stand' || !a.spot) continue; const A = { x: a.w.p[0], z: a.w.p[2], y: a.w.p[1] };
        for (const standIn of [false, true]) { const r = V._arrestDbg.plan(C, A, { standIn }); out.push({ id: a.id, place: a.spot.place, standIn, was: V._arrestDbg.was(C, A), now: r.plan ? r.plan.kind : r.why === 'no-lane' ? 'no-lane' : 'none', walk: r.plan ? +r.plan.walkLen.toFixed(1) : null, roadD: r.roadD, ms: r.ms, why: r.plan ? null : r.why }); } }
      return JSON.stringify(out); })()`));
    for (const r of rows) console.log(`${r.place.padEnd(16)} ${r.id.padEnd(20)} ${r.standIn ? 'stand-in' : 'agent   '} road ${String(r.roadD).padStart(5)} m · before ${r.was.padEnd(10)} · now ${r.now.padEnd(7)} ${r.walk !== null ? 'walk ' + r.walk + ' m' : ''} ${r.ms} ms ${r.why ? JSON.stringify(r.why) : ''}`);
    const near = rows.filter(r => r.roadD !== null && r.roadD <= 40); console.log(`\nSURVEY · ${rows.length} (agents × cop kinds) · a road within 40 m: ${near.length} · the cruiser before ${near.filter(r => r.was === 'car').length} (${(100 * near.filter(r => r.was === 'car').length / Math.max(1, near.length)).toFixed(0)} %) · now ${near.filter(r => r.now === 'kerb' || r.now === 'double').length} (${(100 * near.filter(r => r.now === 'kerb' || r.now === 'double').length / Math.max(1, near.length)).toFixed(0)} %) · all: before ${rows.filter(r => r.was === 'car').length}, now ${rows.filter(r => r.now === 'kerb' || r.now === 'double').length} of ${rows.length}`);
    process.exit(0); }
  const ONLY = opt('places', null)?.split(','); if (ONLY) places.splice(0, places.length, ...places.filter(p => ONLY.includes(p[0])));   // (--places a,b: only these: the arrests' cruiser wants a kerb)
  console.log(`probe · seed ${SEED} · ${places.length} places with two or more standing: ${places.map(p => p[0] + ':' + p[1].length).join(' ')}`);
  for (let k = 0; k < N; k++) {
    const kind = KINDS[(k + SEED) % KINDS.length], [place, ids] = places[Math.floor(rnd() * places.length)], i = Math.floor(rnd() * ids.length); let j = Math.floor(rnd() * (ids.length - 1)); if (j >= i) j++;
    const V = ids[i], R = ids[j], az = rnd() * Math.PI * 2;
    const ok = await S.ev(`(() => { const C = __city, a = __simlive.agents.map.get(${JSON.stringify(V)}), b = __simlive.agents.map.get(${JSON.stringify(R)}); if (!a?.w || !b?.w || a.held || b.held || a.mode !== 'stand' || b.mode !== 'stand' || a.step || b.step || __stage.ctx.busy(a.id) || __stage.ctx.busy(b.id)) return false;
      const x = (a.w.p[0] + b.w.p[0]) / 2, z = (a.w.p[2] + b.w.p[2]) / 2; C.controls.target.set(x, 0, z); C.camera.position.set(x + Math.sin(${az}) * 18, 17, z + Math.cos(${az}) * 18); C.camera.lookAt(C.controls.target); C.controls.update(); return true; })()`);
    if (!ok) { console.log(`#${k} ${kind} @${place}: pair not free, skipped`); continue; }
    await sleep(1200);
    const gone = kind.endsWith('-gone') ? (kind.startsWith('fail') ? R : V) : null; if (gone) await S.ev(`(__stage.goneSet.add(${JSON.stringify(gone)}), 1)`);
    const evs = { 'rob-hurt': [{ type: 'rob', who: R, to: V, seen: true, hurt: true }], 'rob-hurt-gone': [{ type: 'rob', who: R, to: V, seen: true, hurt: true }], rob: [{ type: 'rob', who: R, to: V, seen: true }],
      fail: [{ type: 'rob', who: R, to: V, seen: true, ok: false }], 'fail-gone': [{ type: 'rob', who: R, to: V, seen: true, ok: false }], 'unseen-hurt': [{ type: 'rob', who: R, to: V, seen: false, hurt: true }],
      shot: [{ type: 'shot', who: V, to: R }], 'shot-gone': [{ type: 'shot', who: V, to: R }], 'shot-dead': [{ type: 'shot', who: V, to: R, dead: true }],
      'rob-shot-dead': [{ type: 'rob', who: R, to: V, seen: true }, { type: 'death', who: V, text: `${V} shot during a robbery at ${place}` }],
      'arrest-plain': [{ type: 'arrest', who: R, to: V, text: `@${R} ARRESTED @${V}`, stage: { resist: 'plain' } }], 'arrest-flee': [{ type: 'arrest', who: R, to: V, text: `@${R} ARRESTED @${V}`, stage: { resist: 'flee' } }],
      'arrest-scuffle': [{ type: 'arrest', who: R, to: V, text: `@${R} ARRESTED @${V}`, stage: { resist: 'scuffle' } }], 'arrest-patrol': [{ type: 'arrest', who: null, to: V, patrol: true, text: `A Precinct 9 patrol ARRESTED @${V} (WANTED)` }],
      arrest: [{ type: 'arrest', who: R, to: V, text: `@${R} ARRESTED @${V}`, t: 2000 + k }] }[kind];
    if (kind.startsWith('arrest')) await S.ev(`(() => { const G = __simlive.agents; G.__jail.add(${JSON.stringify(V)}); G.setAgents([...G.map.values()].map(a => a.rec).filter(Boolean)); return 1; })()`);
    const before = JSON.parse(await S.ev('JSON.stringify(__stage.stats())'));
    await S.ev(`(${JSON.stringify(evs)}.forEach(e => __stage.play(e)), 1)`);
    const t0 = Date.now(); let seen = false;
    while (Date.now() - t0 < (kind.startsWith('arrest') ? 170000 : 45000)) { await sleep(400); const L = JSON.parse(await S.ev('JSON.stringify(__stage.list())')); if (L.length) seen = true; if (seen && !L.length) break; if (!seen && Date.now() - t0 > 3000) break; }
    const st = JSON.parse(await S.ev('JSON.stringify(__stage.stats())')), P = st.probe, B = before.probe, d = key => P[key] - B[key];
    const ar = kind.startsWith('arrest') ? P.arrests[P.arrests.length - 1] : null;
    const row = { k, kind, place, V, R, staged: seen, arrest: ar && ar.to === V ? ar : null, secs: +((Date.now() - t0) / 1000).toFixed(1), lingering: st.lingering, removedInView: d('removedInView'), overlapPairs: d('overlapPairs'), insidePairs: d('insidePairs'), falls: d('falls'), fallHits: d('fallHits'), minGap: P.minGap, axis: P.axis ? [P.axis.k, P.axis.bad] : null };
    out.push(row); console.log(`#${k} ${kind.padEnd(13)} @${place.padEnd(14)} ${seen ? 'staged' : 'NOT STAGED'} ${row.secs}s · removedInView ${row.removedInView} · heads ${row.overlapPairs} · inside ${row.insidePairs} · falls ${row.falls} (hits ${row.fallHits}) · lingering ${row.lingering} · axis ${JSON.stringify(row.axis)}${row.arrest ? ' · arrest ' + JSON.stringify(row.arrest) : ''}${d('overlapPairs') ? ' ' + JSON.stringify(P.lastOverlap) : ''}${d('insidePairs') ? ' ' + JSON.stringify(P.lastInside) : ''}${d('fallHits') ? ' ' + JSON.stringify(P.fallBad.slice(-1)) : ''}`);
    if (gone) await S.ev(`(__stage.goneSet.delete(${JSON.stringify(gone)}), 1)`);
    if (kind.startsWith('arrest')) { await S.ev(`(() => { const C = __city; C.controls.target.set(0, 0, 400); C.camera.position.set(0, 120, 520); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`);   // (out of jail for the next trial, the camera away while it comes back)
      for (let q = 0; q < 30; q++) { await sleep(500); if (!(await S.ev('__stage.stats().lingering'))) break; }
      await S.ev(`(() => { const G = __simlive.agents; G.__jail.delete(${JSON.stringify(V)}); G.setAgents([...G.map.values()].map(a => a.rec).filter(Boolean)); return 1; })()`); await sleep(2500); }
  }
  // the camera away: the last bodies lying or leaving go once it can't see them
  await S.ev(`(() => { const C = __city; C.controls.target.set(0, 0, 400); C.camera.position.set(0, 120, 520); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`);
  for (let k = 0; k < 20; k++) { await sleep(500); if (!(await S.ev('__stage.stats().lingering'))) break; }
  const st = JSON.parse(await S.ev('JSON.stringify(__stage.stats())')), P = st.probe;
  console.log(`\nGATE · trials ${out.length} (staged ${out.filter(o => o.staged).length}) · removals ${P.removals} · removed in view ${P.removedInView} · head overlaps ${P.overlapPairs} (${P.overlapFrames} frames) · inside a bystander ${P.insidePairs} · heads in a bystander's (standing or walking) ${P.crowdHeadPairs || 0} (${P.crowdHeadFrames || 0} frames) · bodies in a bystander's ${P.crowdBodyPairs || 0} (${P.crowdBodyFrames || 0} frames)${P.lastCrowd ? ' ' + JSON.stringify(P.lastCrowd) : ''} · falls ${P.falls}, onto something ${P.fallHits} (a passer-by on its lane crossing the footprint as it fell: ${P.passing || 0}) · min gap ${P.minGap} m · lingering at the end ${st.lingering}`);
  const cg = P.cuffs.map(c => c.gap), ci = P.carIns, modes = {}, ends = {}; for (const a of P.arrests) { modes[a.mode] = (modes[a.mode] || 0) + 1; ends[a.end] = (ends[a.end] || 0) + 1; }
  console.log(`ARRESTS · ${P.arrests.length} (${JSON.stringify(modes)}) · ended ${JSON.stringify(ends)} · cuffed ${cg.length}, the wrist gap at the click max ${cg.length ? Math.max(...cg) : '-'} m (mean ${cg.length ? (cg.reduce((a, b) => a + b, 0) / cg.length).toFixed(3) : '-'}) · into the car ${ci.length}: outside the hull by max ${ci.length ? Math.max(...ci.map(c => c.outBy)) : '-'} m, by the rear door ${ci.filter(c => c.inZ).length}/${ci.length} · a car still in view at its hiding ${P.arrests.filter(a => a.carHidInView).length}`);
  { const A = P.arrests, near = A.filter(a => a.roadD !== null && a.roadD !== undefined && a.roadD <= 40), used = a => a.car, was = a => a.was === 'car', st = {}; for (const a of A) st[a.stop] = (st[a.stop] || 0) + 1;
    const q = A.filter(a => a.queue !== undefined), rc = A.filter(a => typeof a.recover === 'number').map(a => a.recover);
    console.log(`CRUISER · stops ${JSON.stringify(st)} · a road within 40 m ${near.length}/${A.length}: the cruiser now ${near.filter(used).length} (${(100 * near.filter(used).length / Math.max(1, near.length)).toFixed(0)} %), before ${near.filter(was).length} (${(100 * near.filter(was).length / Math.max(1, near.length)).toFixed(0)} %) · drives ${JSON.stringify(A.reduce((o, a) => (a.drive && (o[a.drive] = (o[a.drive] || 0) + 1), o), {}))} · walks ${A.filter(a => a.walk !== undefined).map(a => a.walk).join(' ')} m`);
    console.log(`TRAFFIC · cars through the cruiser ${A.reduce((s, a) => s + (a.thru || 0), 0)} (${A.reduce((s, a) => s + (a.thruFrames || 0), 0)} frames) · the queue as it left ${q.map(a => a.queue).join(' ') || '-'} (max standing ${A.map(a => a.queueMax || 0).join(' ')}) · recovered in ${rc.join(' ') || '-'} s${A.some(a => a.recover === 'stuck') ? ' · STUCK ' + A.filter(a => a.recover === 'stuck').length : ''}`); }
  console.log(`stage frame ms: p50 ${st.p50} · p95 ${st.p95} · max ${st.maxMs} · the slowest scene start ${st.startMs} ms · occupancy renders ${st.occ}`);
  if (P.inView.length) console.log('in view:', JSON.stringify(P.inView)); if (P.fallBad.length) console.log('falls onto something:', JSON.stringify(P.fallBad));
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5)); const logs = S.logs.filter(l => /stage/i.test(l)); if (logs.length) console.log('stage logs:', logs.slice(0, 5));
  process.exitCode = P.arrests.some(a => a.thru) || P.arrests.some(a => a.recover === 'stuck') || P.removedInView || P.overlapPairs || P.insidePairs || P.crowdHeadPairs || P.crowdBodyPairs || P.fallHits || S.errs.length || cg.some(g => g > .05) || ci.some(c => c.outBy > .12 || !c.inZ) ? 1 : 0;
} } finally { await S.close(); }
