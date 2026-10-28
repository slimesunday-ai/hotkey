// THE TAPE CLICK-THROUGH (2026-10-10, slime: "the first 3 things on the timeline i click, nothing happens? … he just starts glitching and
// tweaking on the road, doesnt even take us to his house"). A viewer's clicks, replayed: a fresh page on the live city, the Tape chip
// clicked (or a dossier's Watch tape: --open watch:<handle>), then the first N markers of the timeline, left to right (a stack top to
// bottom), each one hovered and clicked with the mouse (CDP Input events on the transport's canvas: the real pointerdown / pointerup).
// For each click, SECS s of the page frame by frame (requestAnimationFrame's own timestamps, the clock the city's loop runs on):
//   toast     what the page said
//   camera    the controls' target and the camera, the rig's mode, the tape time, playing, the visit's phase (ui/tape/index.js goToEvent)
//   actors    the event's named agents (who, to): their walker's position and heading every frame (their own, held, or a stage stand-in)
//   walkers   every walker on the near tier (drawn in full, in view): position every frame — for the jitter
//   errors    uncaught exceptions, rejections and console.error
// FAILS a click on:
//   no move   the visit never handed over to play, or the camera neither moved nor stood within --near m of the event's place
//   place     an event with a place where it happens (a burglary's house, a robbery's corner; not a district, not the jail): the camera's
//             target ends more than --near m from it ("doesnt even take us to his house")
//   error     any of the errors above
//   jitter    a walker on the near tier that DIPS (1–3 frames under 40 % of its median speed between frames over 70 % of it, losing
//             ≥ 0.1 m on its median) or POPS (a frame over 2.5× its median speed, ≥ 0.25 m past it) more than --jitter times in the window,
//             or pops once more than 1 m past it (a teleport in view) ("glitching and tweaking"); walkers with a median under 0.6 m/s, the
//             frames round a tape seek and a stage actor's frames (its scene's choreography: stage/probe.mjs) are not judged
//   node style/city/tools/tapeclick.mjs [--label before] [--base http://127.0.0.1:5791/style/city/] [--simport 5792,5793] [--n 10]
//        [--secs 10] [--gif 3] [--near 22] [--jitter 3] [--open chip | watch:<handle>] [--w 1280 --h 720] [--keep: the judged walkers' tracks]
//        [--pre '<expression>': evaluated on the page once it is up, before the tape opens (an A/B switch)]
//        [--at <game minute>: the tape scrubbed there before the first click — with --open watch:xXbadvibesXx --at 650 the followed
//        agent is on the subway and its ride is open over the city when the marker is clicked]
// One headless Chrome at a time (ui/tools/cdp.mjs), closed by its own PID. Needs the page server and the replays running
// (node style/serve.mjs 5791 · node style/city/tools/simreplay.mjs <run> --port 5792 --loop --from "D3 09:00" [--archive]).
// Writes tools/runs/tapeclick-<label>.json (per click: the checks, the toast, the camera's start and end, the actors' tracks) and
// shots/tapeclick/<label>/<lens>-c<k>.gif + a frame strip per click for the first --gif clicks (not committed). Exit 1 on a failure.
// A --loop replay goes back to its first snapshot at its end (from D3 09:00: ~57 real min): the tape closes (a new epoch), and a live
// season has no tape for a game day after — restart the replays before a run that would cross it (the run stops on a closed tape).
// 2026-10-10, replay 10-10T16-23-35-881Z-dry from D3 09:00, the first 10 markers, tape + archive: ad9dd27 12 failures (every burglary
// marker 34–301 m from its house, the duplicate report going nowhere, @xXbadvibesXx's crew popping 1.8–4.4 m on the road at 4×) → 0;
// --open watch:xXbadvibesXx --at 650: 6 (a subway carriage over the tape: no toast, no move) → 0 (tools/runs/tapeclick-*.json).
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { open, sleep } from '../ui/tools/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const LABEL = opt('label', 'run'), BASE = opt('base', 'http://127.0.0.1:5791/style/city/'), PORTS = opt('simport', '5792,5793').split(',').filter(Boolean);
const KEEP = args.includes('--keep'), PRE = opt('pre', null), AT = opt('at', null) === null ? null : +opt('at', null), N = +opt('n', 10), SECS = +opt('secs', 10), GIF = +opt('gif', 3), NEAR = +opt('near', 22), JIT = +opt('jitter', 3), OPEN = opt('open', 'chip'), W = +opt('w', 1280), H = +opt('h', 720);
const OUT = path.join(CITY, 'shots/tapeclick', LABEL); await fs.mkdir(OUT, { recursive: true });
const ffmpeg = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find(p => { try { return spawnSync(p, ['-version']).status === 0; } catch { return false; } });

// ── in the page: the recorder (one rAF callback; on only while a click is being watched)
const RECORDER = `(() => { if (window.__tc) return true; const R = window.__tc = { on: false, rows: [], toasts: [], errs: [], hs: [], t0: 0, seeks: 0 }; window.__tape.on('seek', () => { R.seeks++; });
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('k-toast')) R.toasts.push({ ms: Math.round(performance.now() - R.t0), text: n.textContent }); }).observe(document.body, { childList: true, subtree: true });
  const ce = console.error.bind(console); console.error = (...a) => { R.errs.push('console.error: ' + a.map(x => x && x.stack ? x.stack : String(x)).join(' ').slice(0, 400)); return ce(...a); };
  addEventListener('error', e => R.errs.push('error: ' + String(e.error?.stack || e.message).slice(0, 400)));
  addEventListener('unhandledrejection', e => R.errs.push('rejection: ' + String(e.reason?.stack || e.reason).slice(0, 400)));
  const walkerOf = h => { const a = window.__simlive?.agents?.map?.get(h); if (a?.w && !a.w.gone) return { w: a.w, k: a.held ? 'held' : 'own', mode: a.mode };
    for (const w of window.__city.peds.sim.walkers) if (!w.gone && typeof w.aid === 'string' && w.aid.startsWith('stage:' + h + ':')) return { w, k: 'standin' }; return null; };
  const r3 = v => Math.round(v * 1000) / 1000;
  const tick = ts => { if (R.on) { const C = window.__city, c = C.camera, g = C.controls.target, T = window.__ui.tape, tp = window.__tape;
      const row = { fc: T.stats().frames, sk: R.seeks, ts: r3(ts), cam: [r3(c.position.x), r3(c.position.y), r3(c.position.z)], tgt: [r3(g.x), r3(g.y), r3(g.z)], mode: C.cam?.mode ?? null, tt: tp.time() === null ? null : r3(tp.time()), playing: tp.playing, visit: T.visit?.phase ?? null, ride: !!C.subway?.open, ag: {}, near: [] };
      for (const h of R.hs) { const o = walkerOf(h); row.ag[h] = o ? [r3(o.w.p[0]), r3(o.w.p[2]), r3(o.w.yawS ?? o.w.p[3] ?? 0), o.k, o.mode ?? null] : null; }
      for (const w of C.peds.sim.walkers) if (!w.gone && w.tier === 1 && w.p) row.near.push([w.aid ?? w.id, r3(w.p[0]), r3(w.p[2]), w.agent ? 1 : 0, w.stagePose ? 1 : 0]);
      R.rows.push(row); }
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`;

// ── the checks on one click's rows
function judge(rows, m, place) {
  const r0 = rows[0], rl = rows[rows.length - 1], fails = [];
  const moved = r0 && rl ? Math.hypot(rl.tgt[0] - r0.tgt[0], rl.tgt[2] - r0.tgt[2]) : 0, played = rows.some((r, i) => i > 2 && r.playing && r.visit === null && rows.slice(1, i).some(q => !q.playing || q.visit !== null));
  const dPlace = place && rl ? Math.hypot(rl.tgt[0] - place.x, rl.tgt[2] - place.z) : null;
  if (!played || (moved < 1 && !(dPlace !== null && dPlace <= NEAR))) fails.push(`no move (moved ${moved.toFixed(1)} m, played ${played})`);
  if (place && dPlace > NEAR) fails.push(`place: the camera ends ${dPlace.toFixed(1)} m from ${m.at}`);
  // the jitter: per near-tier walker, its speed frame by frame (frames round a seek left out: from the tape's seek to its snap — the
  // worker's frame for the new time, which places every walker outright, lands a few frames later — and 3 more)
  const seekAt = new Set(); for (let i = 1; i < rows.length; i++) if (rows[i].sk !== rows[i - 1].sk) {
    let e = i; while (e < rows.length - 1 && e < i + 90 && !(rows[e].fc >= rows[i].fc + 2)) e++; for (let j = i - 2; j <= e + 3; j++) seekAt.add(j); }
  const tr = new Map(); rows.forEach((row, i) => { for (const [id, x, z, ag, st] of row.near) { let L = tr.get(id); if (!L) tr.set(id, L = []); L.push({ i, ts: row.ts, x, z, ag, st }); } });
  const walkers = [];
  for (const [id, L] of tr) { const v = []; for (let k = 1; k < L.length; k++) { const a = L[k - 1], b = L[k]; if (b.i !== a.i + 1 || seekAt.has(b.i) || a.st || b.st) { v.push(null); continue; } /* (a stage actor's frames: its scene's own choreography, stage/probe.mjs's to judge) */ const dt = b.ts - a.ts; v.push(dt > 0 ? { v: Math.hypot(b.x - a.x, b.z - a.z) / (dt / 1000), d: Math.hypot(b.x - a.x, b.z - a.z), i: b.i } : null); }
    const vs = v.filter(Boolean).map(o => o.v).sort((p, q) => p - q); if (vs.length < 15) continue; const mov = vs.filter(x => x > .3), med = mov.length > vs.length * .4 ? mov[Math.floor(mov.length / 2)] : 0; if (med < .6) continue;
    let stalls = 0, pops = 0, jump = 0; const at = [];
    for (let k = 1; k < v.length - 1; k++) { const o = v[k]; if (!o) continue; const dt = o.v > 0 ? o.d / o.v : 1 / 60;
      if (o.v > 2.5 * med && o.d - med * dt > .25) { pops++; jump = Math.max(jump, o.d - med * dt); if (at.length < 4) at.push(`pop ${o.d.toFixed(2)} m @${o.i}`); continue; }
      // a dip: 1–3 frames under 40 % of its median between frames over 70 % of it, that lose ≥ 0.1 m on the median (a crowd walker's
      // fixed-step updates at walking pace — 0, 1.6 cm, 0 … as it sets off — lose millimetres: not a stutter anyone sees)
      if (o.v < .4 * med && v[k - 1] && v[k - 1].v > .7 * med) { let e = k, lost = 0; while (e < v.length && e - k < 3 && v[e] && v[e].v < .4 * med) { lost += (med - v[e].v) * (v[e].v > 0 ? v[e].d / v[e].v : 1 / 60); e++; }
        if (e - k <= 3 && v[e] && v[e].v > .7 * med && lost >= .1) { stalls++; if (at.length < 4) at.push(`dip ${e - k}f ${lost.toFixed(2)} m @${o.i}`); } } }
    walkers.push({ id, agent: !!L[0].ag, frames: L.length, med: +med.toFixed(2), stalls, pops, jump: +jump.toFixed(2), at, ...(KEEP && stalls + pops ? { track: L.map(o => [o.i, o.ts, o.x, o.z, o.st]) } : {}) }); }
  walkers.sort((a, b) => (b.jump > 1) - (a.jump > 1) || (b.stalls + b.pops) - (a.stalls + a.pops));
  const worst = walkers[0] || null; if (worst && (worst.stalls + worst.pops > JIT || worst.jump > 1)) fails.push(`jitter: ${worst.id} ${worst.stalls} dips + ${worst.pops} pops (median ${worst.med} m/s; ${worst.at.join(', ')})`);
  return { fails, moved: +moved.toFixed(1), played, dPlace: dPlace === null ? null : +dPlace.toFixed(1), jitter: walkers.slice(0, 5), judged: walkers.length };
}

const summary = { label: LABEL, base: BASE, at: new Date().toISOString(), n: N, secs: SECS, open: OPEN, lenses: [] };
let failed = 0;
for (const port of PORTS) {
  const S = await open({ w: W, h: H }), L = { simport: port, lens: null, clicks: [], error: null };
  console.log(`── simport ${port}`);
  try {
    await S.go(`${BASE}?sim=live&simport=${port}`, { until: 'window.__city && __city.marks.full && window.__ui?.tape && window.__simlive?.stage && !__city.loading', ms: 240000 });
    await sleep(2500); await S.ev(RECORDER); if (PRE) console.log('   --pre:', JSON.stringify(await S.ev(PRE)));
    // in: the Tape chip (or a dossier's Watch tape), clicked
    if (OPEN.startsWith('watch:')) { const h = OPEN.slice(6); await S.ev(`(() => { window.__ui.dossier.open(${JSON.stringify(h)}); return true; })()`); await sleep(1500);
      const b = await S.ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /Watch tape/.test(x.textContent) && x.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!b) throw new Error('no Watch tape button'); await S.click(b.x, b.y); }
    else { const c = await S.ev(`(() => { const b = document.querySelector('.tp-in button'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`); await S.click(c.x, c.y); }
    let up = false; for (let k = 0; k < 160 && !up; k++) { await sleep(250); up = await S.ev(`(() => { const t = window.__tape, T = window.__ui.tape; return t.active && !t.loading && t.time() !== null && (T.stats().frames || 0) > 0 && (T.transport?.placed()?.length || 0) > 0; })()`); }
    if (!up) throw new Error('the tape never came up');
    await sleep(2000);
    if (AT !== null) { await S.ev(`(() => { window.__tape.seek(${AT}, 'scrub'); return true; })()`); await sleep(4000); L.rideOpen = await S.ev('!!window.__city.subway?.open'); console.log(`   --at ${AT}: the tape there${L.rideOpen ? ', a subway ride open over the city' : ''}`); }
    L.lens = await S.ev('window.__tape.lens'); L.window = await S.ev('window.__tape.window()');
    const all = await S.ev('window.__tape.markers()');
    console.log(`   lens ${L.lens} · window ${L.window.start}…${L.window.horizon} · ${all.length} markers`);
    for (let k = 0; k < N; k++) {
      if (!await S.ev('window.__tape.active')) throw new Error(`the tape closed before click ${k + 1} (the sim's clock went back: a --loop replay starting over? restart it)`);   // (clicks would land on the city)
      const placed = (await S.ev('window.__ui.tape.transport.placed()')).sort((a, b) => a.x - b.x || a.y - b.y), p = placed[k]; if (!p) break;
      const same = placed.slice(0, k).filter(q => q.t === p.t && q.kind === p.kind && q.text === p.text).length, m = all.filter(q => q.t === p.t && q.kind === p.kind && q.text === p.text)[same] || all.find(q => q.t === p.t) || {};
      const hs = [m.who, m.to].filter(h => typeof h === 'string');
      // the event's place, where it has one the camera should end up at: a lot or a corner (not a district, the jail, the hospital)
      const place = m.at && !/^dist:/.test(m.at) && /^(lot:|apt:|corner-)/.test(m.at) ? await S.ev(`(() => { const p = window.__simlive.stage.ctx.placePos(${JSON.stringify(m.at)}); return p ? { x: p.x, z: p.z } : null; })()`) : null;
      const errs0 = S.errs.length, cast = k < GIF; if (cast) await S.cast(true, { quality: 62, every: 1 });
      await S.move(p.x, p.y); await sleep(350);   // (the hover: the marker's tip, as a viewer sees it before the click)
      await S.ev(`(() => { const R = window.__tc; R.rows = []; R.toasts = []; R.errs = []; R.hs = ${JSON.stringify(hs)}; R.t0 = performance.now(); R.on = true; return true; })()`);
      await S.click(p.x, p.y);
      await sleep(SECS * 1000);
      if (cast) await S.cast(false);
      const R = await S.ev(`(() => { const R = window.__tc; R.on = false; return { rows: R.rows, toasts: R.toasts, errs: R.errs }; })()`);
      const errs = [...R.errs, ...S.errs.slice(errs0).map(e => 'exception: ' + e)].filter((e, i, a) => a.indexOf(e) === i);
      const J = judge(R.rows, m, place); if (errs.length) J.fails.push(`error: ${errs[0]}${errs.length > 1 ? ` (+${errs.length - 1})` : ''}`);
      const r0 = R.rows[0], rl = R.rows[R.rows.length - 1];
      const rec = { k: k + 1, marker: { t: m.t, kind: m.kind, type: m.type ?? null, text: m.text, who: m.who ?? null, to: m.to ?? null, at: m.at ?? null }, place, toasts: R.toasts, errs, ...J,
        from: r0 && { tgt: r0.tgt, tt: r0.tt, mode: r0.mode }, to: rl && { tgt: rl.tgt, cam: rl.cam, tt: rl.tt, mode: rl.mode, playing: rl.playing }, phases: [...new Set(R.rows.map(r => r.visit))], ride: R.rows.some(r => r.ride),
        actors: Object.fromEntries(hs.map(h => [h, R.rows.map(r => r.ag[h] ? [r.ts, ...r.ag[h]] : [r.ts, null])])) };
      L.clicks.push(rec); if (rec.fails.length) failed++;
      console.log(`   click ${k + 1}: ${m.kind}${m.type && m.type !== m.kind ? '/' + m.type : ''} ${m.t} "${String(m.text).slice(0, 70)}"`);
      console.log(`      toast ${JSON.stringify(R.toasts.map(t => t.text))} · camera ${r0?.tgt.map(v => v.toFixed(0)).join(',')} → ${rl?.tgt.map(v => v.toFixed(0)).join(',')} (moved ${J.moved} m${place ? `, ${J.dPlace} m from ${m.at}` : ''}) · tape ${r0?.tt?.toFixed(1)} → ${rl?.tt?.toFixed(1)} · phases ${rec.phases.join('/')}${rec.ride ? ' · SUBWAY RIDE OPEN' : ''}`);
      console.log(`      jitter: ${J.judged} walkers judged, worst ${J.jitter[0] ? `${J.jitter[0].id} ${J.jitter[0].stalls}+${J.jitter[0].pops} (${J.jitter[0].at.join(', ')})` : '—'} · errors ${errs.length}`);
      console.log(`      ${rec.fails.length ? 'FAIL ' + rec.fails.join(' · ') : 'ok'}`);
      if (cast) { const frames = S.frames.splice(0), d = path.join(OUT, `${L.lens}-c${k + 1}`); await fs.rm(d, { recursive: true, force: true }); await fs.mkdir(d, { recursive: true });
        for (let j = 0; j < frames.length; j++) await fs.writeFile(path.join(d, `f${String(j).padStart(4, '0')}.jpg`), Buffer.from(frames[j].data, 'base64'));
        if (ffmpeg && frames.length) { const span = (frames.at(-1).t - frames[0].t) || 1, fps = Math.max(4, Math.min(30, Math.round(frames.length / span)));
          spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(d, 'f%04d.jpg'), '-vf', 'fps=8,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', path.join(OUT, `${L.lens}-c${k + 1}.gif`)]);
          spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(d, 'f%04d.jpg'), '-vf', `fps=${(8 / SECS).toFixed(3)},scale=480:-1,tile=4x2`, '-frames:v', '1', path.join(OUT, `${L.lens}-c${k + 1}-strip.jpg`)]); }
        await fs.rm(d, { recursive: true, force: true });   // (the raw frames: the GIF and the strip keep what they showed)
        rec.gif = path.relative(CITY, path.join(OUT, `${L.lens}-c${k + 1}.gif`)); }
    }
  } catch (e) { L.error = String(e && e.stack || e); failed++; console.error('   ERROR', L.error); }
  finally { await S.close(); }
  summary.lenses.push(L);
}
summary.failed = failed;
await fs.writeFile(path.join(CITY, 'tools/runs', `tapeclick-${LABEL}.json`), JSON.stringify(summary));
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
