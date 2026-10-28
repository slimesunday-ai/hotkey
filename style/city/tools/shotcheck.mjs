// TV PLAN A2 · THE SHOT CHECK (2026-10-09): every robbery and arrest of a recorded run, visited on the TAPE the way a viewer does it
// (ui/tape/index.js goToEvent), measured on the page (headless Chrome over CDP, no dependencies):
//   shot      the camera once it is there: distance to its target, pitch (the view's angle below the horizon), the tape's shot record
//   actors    while the scene plays (every 0.2 s for 12 s): each actor's walker (who, to: the agent's own, or the stage's stand-in), on
//             screen (inside 95 % of the frame) and seen (a collision-world ray, camera/world.js, from the camera to the chest or the
//             head: STATIC = walls and posts, WIDE = walls only; only where the world's blocks along it are the real ones, not a block's
//             far massing still: those samples are left out and counted). An actor counts as unoccluded when it is on screen and seen in at
//             least half of the samples of the beat: ±0.4 s round the first moment, once the tape is past the event's minute, the
//             two are within 3 m of each other (the contact). No contact in 10 s (the stage brought nobody together): ±0.4 s round the
//             event's minute, and an actor more than 14 m from the shot's target then is offstage (not counted, reported)
//   sides     the 180° rule: the camera's side of the line between the two actors (handles in sorted order, so a payback with the roles
//             swapped has the same line) at every shot; consecutive shots of one scene (same place, same pair, ≤ 15 game min apart)
//             on opposite sides are a flip — at the beat, so a stage that turns the pair round counts — and the shots' own sides
//             (planFlips: camera/shots.js's line). --scene also plans the establishing shot of each event and checks its side
//   frames    rAF intervals from the click to 1 s after the camera arrived, long frames with what the shot was doing and the height-map
//             renders in them; a far cut (the load-in came down) separately. --far-every n: every nth event the camera first goes 900 m off
//   --keep stores every sample; --debug also a screenshot a second; --eval '<expr>' is evaluated on the page 1.4 s into each scene
//   node style/city/tools/shotcheck.mjs --label before|after [--run <stamp>] [--base http://127.0.0.1:5485/style/city/] [--simport 5486]
//        [--far-every 3] [--only 0,5,9] [--sheet 12] [--scene] [--samples 60] [--debug] [--keep] [--eval <expr>] [--w 1280 --h 720]
// The page and the replay must be running: node style/serve.mjs 5485 · node style/city/tools/simreplay.mjs <run> --port 5486 --speed 0
// --archive. Writes tools/runs/shotcheck-<label>.json and shots/a2-shots/<label>/*.jpg (the --sheet events, at the beat).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; }, has = k => args.includes('--' + k);
const LABEL = opt('label', 'run'), BASE = opt('base', 'http://127.0.0.1:5485/style/city/'), SIMPORT = opt('simport', '5486'), FAR_EVERY = +opt('far-every', 3), W = +opt('w', 1280), H = +opt('h', 720);
const SHEET = +opt('sheet', 12), ONLY = opt('only', null)?.split(',').map(Number) ?? null, SCENE = has('scene'), DEBUG = has('debug'), KEEP = has('keep'), EVAL = opt('eval', null), SAMPLES = +opt('samples', 60);
const SIM2 = process.env.SIM2 || [path.join(os.homedir(), 'Desktop/deadnet-sim-move/sim2'), path.join(os.homedir(), 'Desktop/deadnet/sim2')].find(d => fss.existsSync(path.join(d, 'runs')));
const RUN = (r => fss.existsSync(r) ? r : path.join(SIM2, 'runs', r))(opt('run', '2026-10-09T12-43-05-133Z-dry'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const OUTDIR = path.join(CITY, 'shots/a2-shots', LABEL); await fs.mkdir(OUTDIR, { recursive: true });

// ── the events: every robbery and arrest of the run, in time order
const EV = fss.readFileSync(path.join(RUN, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.type === 'rob' || e.type === 'arrest');
const pick = ONLY ? ONLY : EV.map((e, k) => k);
const sheetSet = new Set(Array.from({ length: Math.min(SHEET, pick.length) }, (_, k) => pick[Math.round(k * (pick.length - 1) / Math.max(1, Math.min(SHEET, pick.length) - 1))]));

// ── chrome
const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-shotcheck-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0',
  `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
console.log(`chrome pid ${ch.pid}`);
let port = null; for (let t = 0; t < 150 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
if (!port) { ch.kill('SIGKILL'); throw new Error('chrome did not start'); }
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; }); let id = 0; const wait = new Map(), errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300)); };
const send = (method, params = {}, ms = 60000) => new Promise(r => { const k = ++id; const tm = setTimeout(() => { wait.delete(k); r({ timeout: true }); }, ms); wait.set(k, m => { clearTimeout(tm); r(m); }); ws.send(JSON.stringify({ id: k, method, params })); });
const ev = async (expr, ms = 60000) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, ms); if (r.timeout) throw new Error('timed out: ' + expr.slice(0, 80));
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
const shot = async file => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86 }, 20000); if (r.result?.data) await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); };
const out = { label: LABEL, run: path.basename(RUN), base: BASE, at: new Date().toISOString(), events: [], errs };
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}?sim=live&simport=${SIMPORT}&simtod=0&tape=1` });
  // up: the load-in done, the tape open and loaded
  let up = false; for (let t = 0; t < 240 && !up; t++) { await sleep(500); try { up = await ev(`(async () => { const T = window.__ui?.tape; if (!T || !window.__city || window.__city.loading) return false; const { tape } = await import(new URL('ui/tape/state.js', location.href).href); return !!(T.active && !tape.loading && tape.window().horizon !== null && window.__simlive?.stage); })()`); } catch {} }
  if (!up) throw new Error('the page / the tape never came up');
  console.log('page up');
  await ev(`(() => { const S = window.__sc = { ft: [], on: false, loads: 0, loaf: [] }; let last = null;
    try { new PerformanceObserver(l => { if (!S.on) return; for (const e of l.getEntries()) if (e.duration > 34) S.loaf.push({ d: Math.round(e.duration), block: Math.round(e.blockingDuration || 0), scripts: (e.scripts || []).filter(x => x.duration > 4).map(x => Math.round(x.duration) + 'ms ' + (x.sourceURL || '').replace(/^.*\\/city\\//, '') + ':' + (x.sourceFunctionName || '') + '@' + x.sourceCharPosition) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
    S.occ = []; S.long = [];
    const tick = now => { if (S.on && last !== null) { const d = now - last; S.ft.push(d); if (d > 34) S.long.push({ t: Math.round(now - S.t0), d: +d.toFixed(1), state: window.__city.shots?.current?.state ?? null, loading: !!window.__city.loading, occ: S.occ.filter(o => o.t > last - 1 && o.t <= now).map(o => o.kind + ' ' + o.ms) }); } last = now; if (S.on && window.__city.loading) S.loads++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    { const R = window.__city.renderer, r0 = R.render.bind(R), rp = R.readRenderTargetPixels.bind(R);   // (the height maps' cost, frame by frame)
      R.render = (sc, cm) => { if (!cm?.isOrthographicCamera || cm.far < 17 || !S.on) return r0(sc, cm); const t = performance.now(); const out = r0(sc, cm); S.occ.push({ t, kind: 'draw' + Math.round(cm.far), ms: +(performance.now() - t).toFixed(2) }); return out; };
      R.readRenderTargetPixels = (...a) => { if (!S.on) return rp(...a); const t = performance.now(); const out = rp(...a); S.occ.push({ t, kind: 'syncread', ms: +(performance.now() - t).toFixed(2) }); return out; }; }
    const C = window.__city, T3 = C.THREE, FR = new T3.Frustum(), PM = new T3.Matrix4(), V = new T3.Vector3(), A = new T3.Vector3(), B = new T3.Vector3();
    const walkerOf = h => { if (!h) return null; const a = window.__simlive.agents?.map?.get(h); if (a?.w && !a.w.gone) return a.w;
      for (const w of C.peds.sim.walkers) if (!w.gone && typeof w.aid === 'string' && w.aid.startsWith('stage:' + h + ':')) return w; return null; };
    S.pose = () => { const c = C.camera, t = C.controls.target; const f = new T3.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
      return { cam: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(2)), tgt: [t.x, t.y, t.z].map(v => +v.toFixed(2)), pitch: +(Math.asin(-f.y) * 180 / Math.PI).toFixed(1), dist: +c.position.distanceTo(t).toFixed(2), fov: c.fov, mode: C.cam?.mode, blending: !!C.cam?.blending }; };
    import(new URL('ui/tape/state.js', location.href).href).then(m => { S.tape = m.tape; });
    S.sample = (hs) => { const c = C.camera; S.hit = null; c.updateMatrixWorld(); PM.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); FR.setFromProjectionMatrix(PM); const W = C.cam.world;
      return hs.map(h => { const w = walkerOf(h); if (!w || !w.p) return { h, drawn: false };
        // (the world's rays only where its blocks are the real ones: a block still on its far massing has 1 m boxes for buildings)
        const cp = c.position, ready = [[cp.x, cp.z], [w.p[0], w.p[2]], [(cp.x + w.p[0]) / 2, (cp.z + w.p[2]) / 2]].every(([x, z]) => W.ready(x, z));
        const pts = [1.1, 1.6].map(y => [w.p[0], (w.p[1] || 0) + y, w.p[2]]); let onScreen = false, seen = false, seenWide = false;
        for (const p of pts) { V.set(...p).project(c); if (Math.abs(V.x) < .95 && Math.abs(V.y) < .95 && V.z < 1) onScreen = true;
          A.copy(c.position); B.set(...p); const hr = W.ray(A, B, 1); if (!hr) seen = true; else if (!S.hit) S.hit = { t: +hr.t.toFixed(3), at: [A.x + (B.x - A.x) * hr.t, A.y + (B.y - A.y) * hr.t, A.z + (B.z - A.z) * hr.t].map(v => +v.toFixed(2)), thin: hr.thin, to: h }; if (!W.ray(A, B, 8)) seenWide = true; }
        const ar = window.__simlive.agents?.map?.get(h); return { h, drawn: true, ready, mode: ar?.mode, spot: ar?.spot ? [+ar.spot.x.toFixed(1), +ar.spot.z.toFixed(1), ar.spot.place] : null, x: +w.p[0].toFixed(2), z: +w.p[2].toFixed(2), onScreen, seen, seenWide, standIn: typeof w.aid === 'string' && w.aid.startsWith('stage:') }; }).concat([{ t: S.tape?.time?.() ?? null, hit: S.hit }]); };
    return true; })()`);
  const tapeState = `(await import(new URL('ui/tape/state.js', location.href).href)).tape`;
  let n = 0;
  for (const k of pick) {
    const e = EV[k], m = { id: e.id, t: e.t, kind: e.type === 'arrest' ? 'arrest' : 'rob', text: e.text || e.type, who: e.who ?? null, to: e.to ?? null, at: e.at ?? null };
    const rec = { k, id: e.id, t: e.t, ts: e.ts, type: e.type, ok: e.ok, seen: e.seen, who: e.who, to: e.to, at: e.at };
    // a far cut every FAR_EVERY events: the camera first goes 900 m off (through the load-in) so the event is far
    if (FAR_EVERY > 0 && n % FAR_EVERY === FAR_EVERY - 1) {
      await ev(`(() => { const C = window.__city, t = C.controls.target, x = t.x + (t.x > 0 ? -900 : 900), z = t.z; C.cam?.toOrbit({ instant: true }); C.goTo(x, z, 'away'); return true; })()`);
      for (let t = 0; t < 60; t++) { await sleep(250); if (await ev('!window.__city.loading')) break; } await sleep(800); rec.forcedFar = true; }
    n++;
    const before = await ev('window.__sc.pose()');
    await ev(`(async () => { const T = window.__ui.tape, tape = ${tapeState}; tape.pause(); window.__sc.ft = []; window.__sc.loaf = []; window.__sc.long = []; window.__sc.occ = []; window.__sc.loads = 0; window.__sc.on = true; window.__sc.t0 = performance.now(); return T.goToEvent(${JSON.stringify(m)}); })()`);
    // arrived: the visit is over (the tape plays)
    let arrived = false, t0 = Date.now(); for (let t = 0; t < 120 && !arrived; t++) { await sleep(100); arrived = await ev('!window.__ui.tape.visit'); }
    rec.arriveS = +((Date.now() - t0) / 1000).toFixed(2); rec.arrived = arrived;
    rec.pose = await ev('window.__sc.pose()'); rec.from = before;
    rec.shotInfo = await ev(`(() => { const s = window.__city.shots; return s?.last ? s.last() : null; })()`);
    rec.spec = await ev(`(() => { const sp = window.__city.shots?.lastSpec?.(); return sp ? { at: sp.at && { x: +sp.at.x.toFixed(2), z: +sp.at.z.toFixed(2) }, actors: (sp.actors || []).map(a => ({ h: a.h, x: +a.x.toFixed(2), z: +a.z.toFixed(2), from: a.from ? [+a.from.x.toFixed(1), +a.from.z.toFixed(1)] : null })), scene: sp.scene, kind: sp.kind } : null; })()`);
    // the scene plays: samples (and the beat's frame for the sheet)
    const hs = [e.who, e.to].filter(Boolean), S = []; let shotDone = false;
    for (let s = 0; s < SAMPLES; s++) { await sleep(200); const smp = await ev(`window.__sc.sample(${JSON.stringify(hs)})`); S.push(smp); if (DEBUG && s % 5 === 0) await shot(path.join(OUTDIR, `dbg${String(k).padStart(2, '0')}-${String(s).padStart(2, '0')}.jpg`));
      if (s === 14) rec.pose2 = await ev('window.__sc.pose()');   // (after the pre-roll's reframe, if one came)
      if (EVAL && s === 7) rec.eval = await ev(EVAL).catch(e => 'ERR ' + e.message);
      if (s === 5) { await ev('window.__sc.on = false'); rec.frames = await ev('(() => { const f = window.__sc.ft; return { n: f.length, max: +Math.max(0, ...f).toFixed(1), over34: f.filter(x => x > 34).length, over50: f.filter(x => x > 50).length, p95: +(f.slice().sort((a, b) => a - b)[Math.floor(f.length * .95)] || 0).toFixed(1), loads: window.__sc.loads, loaf: window.__sc.loaf.slice(0, 6), long: window.__sc.long.slice(0, 8), occ: window.__sc.occ.map(o => o.kind + " " + o.ms), stage: { occDrawMs: window.__stage?.stats?.().occDrawMs ?? null, startMs: window.__stage?.stats?.().startMs ?? null } }; })()'); }
      const sa = smp.slice(0, -1), both = sa.length === 2 && sa.every(a => a.drawn) && Math.hypot(sa[0].x - sa[1].x, sa[0].z - sa[1].z) < 2.5 && smp[smp.length - 1].t >= e.t;
      if (sheetSet.has(k) && !shotDone && (both || s === 25)) { shotDone = true; await shot(path.join(OUTDIR, `ev${String(k).padStart(2, '0')}-${e.id}.jpg`)); rec.sheet = s; } }
    rec.far = (rec.frames?.loads || 0) > 0;
    // unoccluded: each actor over the beat (both within 3 m), else the first 3 s
    const tOf = smp => smp[smp.length - 1]?.t, A2 = smp => smp.slice(0, -1), close = smp => { const a = A2(smp); return a.length === 2 && a.every(x => x.drawn) && Math.hypot(a[0].x - a[1].x, a[0].z - a[1].z) < 3; };
    const k0 = Math.max(0, S.findIndex(smp => tOf(smp) !== null && tOf(smp) >= e.t)), kb = S.findIndex((smp, j) => j >= k0 && j <= k0 + 50 && close(smp));
    const win = (kb >= 0 ? S.slice(Math.max(k0, kb - 2), kb + 3) : S.slice(Math.max(0, k0 - 2), k0 + 3)).map(A2); rec.eventAt = k0; rec.beatAt = kb;
    // no contact (the stage brought nobody together): an actor more than 14 m from the shot's target at the event isn't in the scene (offstage)
    const off = new Set(); if (kb < 0) for (const h of hs) { const L = win.flat().filter(a => a.h === h && a.drawn); if (!L.length || L.every(a => Math.hypot(a.x - rec.pose.tgt[0], a.z - rec.pose.tgt[2]) > 14)) off.add(h); }
    if (DEBUG || KEEP) rec.samples = S;
    rec.actors = hs.map((h, j) => { const L = win.map(smp => smp[j]).filter(a => a?.drawn && a.ready), unready = win.map(smp => smp[j]).filter(a => a?.drawn && !a.ready).length; const f = key => L.length ? +(L.filter(a => a[key] && a.onScreen).length / L.length).toFixed(2) : null;
      return { h, samples: L.length, vis: f('seen'), visWide: f('seenWide'), onScreen: L.length ? +(L.filter(a => a.onScreen).length / L.length).toFixed(2) : null, standIn: L.some(a => a.standIn), offstage: off.has(h), unready }; });
    rec.window = kb >= 0 ? 'beat' : 'start';
    // the side of the line (sorted handles) the camera is on, at the shot
    const pos = h => { const L = win.flat().filter(a => a.h === h && a.drawn); return L.length ? L[0] : null; }, [ha, hb] = [e.who, e.to].filter(Boolean).sort(), pa = pos(ha), pb = pos(hb);
    const P2 = rec.pose2 || rec.pose; if (pa && pb && Math.hypot(pa.x - pb.x, pa.z - pb.z) > .3) { const lx = pb.x - pa.x, lz = pb.z - pa.z, cx = P2.cam[0] - (pa.x + pb.x) / 2, cz = P2.cam[2] - (pa.z + pb.z) / 2; rec.side = Math.sign(lx * cz - lz * cx); }
    if (SCENE) rec.establishing = await ev(`(() => { const s = window.__city.shots, sp = s?.lastSpec?.(); if (!sp) return null; const p = s.planNow({ ...sp, kind: 'establishing' }); return p && { side: p.side, d: p.d, pitch: +(p.pitch * 180 / Math.PI).toFixed(1), vis: p.vis, how: p.how }; })()`);
    await ev(`(async () => { (${tapeState}).pause(); return true; })()`);
    const a = rec.actors.filter(x => !x.offstage), unocc = a.length && a.every(x => x.vis !== null && x.vis >= .5);
    console.log(`#${k} ${e.ts} ${e.type}${e.ok === false ? '(fail)' : ''} ${e.who}→${e.to} @${e.at} · ${rec.far ? 'FAR' : 'near'} ${rec.arriveS}s · d ${rec.pose.dist} m pitch ${rec.pose.pitch}° · ${a.map(x => `${x.h}:${x.vis}/${x.visWide}`).join(' ')} ${unocc ? 'OK' : 'OCCL'} · frames max ${rec.frames?.max} >34: ${rec.frames?.over34}`);
    out.events.push(rec);
  }
  out.shots = await ev('window.__city.shots?.stats?.() ?? null');
  out.stage = await ev('(() => { const s = window.__stage?.stats?.(); return s ? { occSync: s.occ, occAsync: s.occAsync ?? 0, occHits: s.occHits ?? 0, occDrawMaxMs: s.occDrawMs ?? null, sceneStartMaxMs: s.startMs ?? null } : null; })()');
} catch (err) { out.error = String(err && err.stack || err); console.error(err); }
finally { try { ws.close(); } catch {} ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }

// ── the summary
const E = out.events, has2 = E.filter(r => r.actors?.length);
const on = r => (r.actors || []).filter(x => !x.offstage), unocc = E.filter(r => on(r).length && on(r).every(x => x.vis !== null && x.vis >= .5)), unoccWide = E.filter(r => on(r).length && on(r).every(x => x.visWide !== null && x.visWide >= .5));
const beats = E.filter(r => r.beatAt >= 0), unoccBeat = beats.filter(r => r.actors.every(x => x.vis !== null && x.vis >= .5));
const pitchOK = E.filter(r => [r.pose, r.pose2].filter(Boolean).every(p => p.pitch >= 25 - .05 && p.pitch <= 35 + .05));
// scenes: same place, same unordered pair, ≤ 15 game min apart → consecutive shots must keep the side
let flips = 0, pairs = 0; const sc = new Map();
for (const r of E) { if (!r.side) continue; const key = r.at + '|' + [r.who, r.to].sort().join('+'), p = sc.get(key); if (p && r.t - p.t <= 15) { pairs++; if (p.side !== r.side) flips++; } sc.set(key, { t: r.t, side: r.side }); }
let planFlips = 0, planPairs = 0; const sp = new Map();   // (the shots' own sides: their lines, in handle order)
for (const r of E) { const sd = r.shotInfo?.side; if (!sd) continue; const key = r.shotInfo.scene, p = sp.get(key); if (p && r.t - p.t <= 15) { planPairs++; if (p.side !== sd) planFlips++; } sp.set(key, { t: r.t, side: sd }); }
let estFlips = 0, estN = 0; for (const r of E) if (r.establishing && r.establishing.side && r.shotInfo?.side) { estN++; if (r.establishing.side !== r.shotInfo.side) estFlips++; }
const far = E.filter(r => r.far), near = E.filter(r => !r.far);
out.summary = { events: E.length, arrived: E.filter(r => r.arrived).length, withActors: has2.length,
  unoccluded: `${unocc.length}/${has2.length}`, unreadySamples: E.reduce((n, r) => n + (r.actors || []).reduce((m, a) => m + (a.unready || 0), 0), 0), contacts: beats.length, unoccludedAtContact: `${unoccBeat.length}/${beats.length}`, offstage: E.reduce((n, r) => n + (r.actors || []).filter(x => x.offstage).length, 0), unoccludedPct: has2.length ? +(100 * unocc.length / has2.length).toFixed(1) : null, unoccludedWidePct: has2.length ? +(100 * unoccWide.length / has2.length).toFixed(1) : null,
  pitchInRange: `${pitchOK.length}/${E.length}`, pitch: E.map(r => r.pose?.pitch), dist: E.map(r => r.pose?.dist),
  sceneShotPairs: pairs, sideFlips: flips, planPairs, planFlips, establishingChecked: estN, establishingFlips: estFlips,
  far: { n: far.length, maxFrame: Math.max(0, ...far.map(r => r.frames?.max || 0)), over34: far.reduce((s, r) => s + (r.frames?.over34 || 0), 0), arriveS: far.map(r => r.arriveS) },
  near: { n: near.length, maxFrame: Math.max(0, ...near.map(r => r.frames?.max || 0)), over34: near.reduce((s, r) => s + (r.frames?.over34 || 0), 0), arriveS: near.map(r => r.arriveS) }, errors: errs.length };
await fs.writeFile(path.join(CITY, 'tools/runs', `shotcheck-${LABEL}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary, null, 1)); console.log('shots', JSON.stringify(out.shots), 'stage', JSON.stringify(out.stage)); if (errs.length) console.log('page errors:', errs.slice(0, 8));
