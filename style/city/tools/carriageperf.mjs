// C2-carriageperf · WHAT THE SUBWAY CARRIAGE COSTS ON THE RECORD (GAME.md §41, slime 10-31: "We already created an inside the carriage
// subway scene"). Headless Chrome on ?sim=record: the agent's card opened with a real click, F sent as a page KeyboardEvent (a CDP key
// event stops headless Chrome's frames), the record played at --speed from just before the agent's first subway trip on --night until the
// carriage opens on it; then seeked back before the trip and played into it again, --rides times in all. Per ride:
//   street     the frames while following the agent on the street before the ride (from 1 s after play to the opening)
//   stall      the opening: from the frame the subway starts a ride (api.subway.stats().rides) to 1.5 s after the carriage is open: the
//              longest frame interval in it (the page stood still that long), the frames over 50 ms, and the record minutes the longest
//              interval skipped (the record's clock runs on real time: island seconds = the interval × the speed)
//   carriage   --secs real s of frames from 1.5 s after the carriage opened: the frame interval (mean, p95, max), and the CPU ms per frame
//              of each requestAnimationFrame callback (the city's loop: three's onAnimationFrame; the carriage's: loop), the city's split
//              into its parts (stream, walkers, record, traffic, ambient crowd, sim layer, camera, ui, dyn, post.render)
//   (--carspeed: the record's speed once the carriage is open, default 1, so the ride lasts the window; 0 keeps --speed)
//   (--profile N: from the agent's stairs down to 1.5 s after the carriage opened, sampled every 0.1 ms)
//   longtasks  the page's long tasks (PerformanceObserver) during the stall window
//   opening    the carriage's own account of its opening (subway stats().lastOpen: stage, bakes, riders, compile, the first frame, ms; the
//              programs compiled)
// --profile N: a CPU profile (CDP Profiler) over ride N's opening, top self-time functions. --dump <js>: an expression's value, printed
// once the carriage is open (a diagnostic). --gpu: also time each render with gl.finish()
// (a diagnostic; headless Chrome returns from it at once, 0.01 ms: no GPU time there).
//   node style/city/tools/carriageperf.mjs --port 5961 [--seed 404] [--id a04] [--night 4] [--speed 10] [--rides 3] [--secs 6]
//     [--carspeed 1] [--profile 1] [--gpu] [--dump <js>] [--tag before] [--out style/city/shots/c2-carriageperf]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';
import { clickAgent } from './c2lib.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5961), SEED = +arg('seed', 404), NIGHT = +arg('night', 4), ID = arg('id', 'a04'), SPEED = +arg('speed', 10), RIDES = +arg('rides', 3), SECS = +arg('secs', 6);
const DUMP = arg('dump', null), CARSPEED = +arg('carspeed', 1), PROFILE = +arg('profile', 0), GPU = process.argv.includes('--gpu'), TAG = arg('tag', 'probe'), BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-carriageperf')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };
const url = at => `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(at)}&recordAt=${at}&recordSpeed=${SPEED}&recordPaused=1`;
const RIDE = `(() => { const D = window.__record.draw, L = D.timeline.segs.get(${JSON.stringify(ID)}) || [], a = ${NIGHT * 1440 + 360}, b = a + 1440;
  for (let i = 0; i < L.length; i++) { const d = D.rule.at(${JSON.stringify(ID)}, i); if (d?.trip?.legs?.some(l => l.kind === 'subway') && d.dep >= a && d.dep < b) return { dep: d.dep, arr: d.trip.arr }; } return null; })()`;

// ── in the page from the first script on: every requestAnimationFrame callback timed, per frame (by the callback's name)
const HOOK = `(() => { if (window.__cp) return; const P = window.__cp = { on: false, frames: [], longs: [] };
  const raf0 = window.requestAnimationFrame.bind(window); let cur = null, lastTs = null;
  P.part = (name, ms) => { if (cur) cur.m[name] = (cur.m[name] || 0) + ms; };
  window.requestAnimationFrame = cb => raf0(ts => { if (ts !== lastTs) { lastTs = ts; cur = { ts, cb: {}, m: {} }; if (P.on) P.frames.push(cur); }
    const t0 = performance.now(); try { return cb(ts); } finally { const n = cb.name || 'anon'; cur.cb[n] = (cur.cb[n] || 0) + performance.now() - t0; } });
  try { new PerformanceObserver(l => { if (P.on) for (const e of l.getEntries()) P.longs.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)]); }).observe({ type: 'longtask' }); } catch {}
})();`;
// the city's parts, timed where main.js's frame() calls them (method lookups on the api's objects), and a per-frame state sample
const PARTS = `(() => { const c = window.__city, P = window.__cp, R = window.__record;
  const wrap = (o, k, name) => { if (!o || typeof o[k] !== 'function' || o[k].__cp) return; const f = o[k]; o[k] = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { P.part(name, performance.now() - t0); } }; o[k].__cp = 1; };
  wrap(c.stream, 'update', 'stream'); wrap(c.walk, 'update', 'walkers'); wrap(R, 'frame', 'record'); wrap(R.draw, 'update', 'record.draw'); wrap(c.traffic, 'update', 'traffic');
  wrap(c.peds, 'update', 'peds'); wrap(c.sim, 'update', 'simLayer'); wrap(c, 'late', 'cam.late'); wrap(c.cam, 'update', 'cam.update'); wrap(c.ui, 'frame', 'ui'); wrap(c.dyn, 'frame', 'dyn');
  wrap(c.post, 'render', 'post.render');
  for (const k of ['step', 'populate', 'animate', 'where', 'face']) wrap(c.peds?.sim, k, 'peds.' + k); for (const k of ['tick', 'populate']) wrap(c.traffic?.sim, k, 'traffic.' + k);
  ${GPU ? `{ const gl = c.renderer.getContext(), f = c.post.render; c.post.render = function (...a) { const r = f.apply(this, a); const t0 = performance.now(); gl.finish(); P.part('city.gpu', performance.now() - t0); return r; }; }` : ''}
  const tick = () => { const s = c.subway, f = P.frames[P.frames.length - 1]; if (f && P.on) { f.rides = s?.stats?.().rides ?? 0; f.open = s?.openFor ?? null; f.covered = !!c.covered; f.min = R.player.minute; f.ct = s?.open?.t ?? null; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick); return true; })()`;
const GPU_CAR = `(() => { const h = window.__city.subway?.open; if (!h || h.view.renderer.__cp) return false; const r = h.view.renderer, gl = r.getContext(), f = r.render; r.__cp = 1;
  r.render = function (...a) { const t0 = performance.now(); const x = f.apply(this, a); window.__cp.part('carriage.cpu', performance.now() - t0); const t1 = performance.now(); gl.finish(); window.__cp.part('carriage.gpu', performance.now() - t1); return x; }; return true; })()`;

const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + .5))]; };
const r1 = x => x == null ? null : +x.toFixed(1), r2 = x => x == null ? null : +x.toFixed(2);
function summarize(frames) {
  const iv = []; for (let k = 1; k < frames.length; k++) iv.push(frames[k].ts - frames[k - 1].ts);
  const cb = {}, m = {}; for (const f of frames.slice(1)) { for (const [k, v] of Object.entries(f.cb)) cb[k] = (cb[k] || 0) + v; for (const [k, v] of Object.entries(f.m)) m[k] = (m[k] || 0) + v; }
  const n = Math.max(1, frames.length - 1), per = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v / n)]));
  return { frames: n, mean: r1(iv.reduce((a, b) => a + b, 0) / n), p95: r1(q(iv, .95)), max: r1(Math.max(...iv)), cpuPerFrame: per(cb), cityParts: per(m) };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), out = { seed: SEED, id: ID, night: NIGHT, speed: SPEED, tag: TAG, rides: [] };
  try {
    await B.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
    await B.send('Page.navigate', { url: url(NIGHT * 1440 + 360) }); await ready(B, 240000); await sleep(1500);
    const R = await B.ev(RIDE); if (!R) throw new Error(`${ID} has no subway trip on day ${NIGHT}`);
    out.trip = R;
    await B.send('Page.navigate', { url: url(R.dep - .3) }); await ready(B, 240000); await sleep(5000);
    let on = false;
    for (let k = 0; k < 3 && !on; k++) { if (await clickAgent(B, ID).catch(() => null) === ID) {
      await B.ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true, cancelable: true }))`);
      for (let j = 0; j < 10 && !on; j++) { await sleep(300); on = await B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}; })()`); } } }
    if (!on) throw new Error('could not follow ' + ID);
    await B.ev(PARTS);
    for (let ride = 1; ride <= RIDES; ride++) {
      if (ride > 1) { await B.ev(`(() => { window.__record.player.pause(); window.__record.player.seek(${R.dep - .3}); return true; })()`); await sleep(2500);
        const st = await B.ev(`({ open: window.__city.subway.openFor, follow: window.__city.cam?.subject?.aid ?? null })`); if (st.open || st.follow !== ID) throw new Error('after the seek back: ' + JSON.stringify(st)); }
      await B.ev(`(() => { window.__cp.frames.length = 0; window.__cp.longs.length = 0; window.__cp.on = true; window.__cp.t0 = performance.now(); return true; })()`);
      const prof = PROFILE === ride; let profOn = false; if (prof) { await B.send('Profiler.enable'); await B.send('Profiler.setSamplingInterval', { interval: 100 }); }
      await B.ev('window.__record.player.play()');
      const t0 = Date.now(); let opened = null;
      while (Date.now() - t0 < 180000) {
        // (the profile from the agent's stairs down to 1.5 s after the carriage opened)
        if (prof && !profOn && await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(ID)}); const L = a?.run?.trip?.legs?.[a.run.k]; return !!L && (L.kind === 'stairs' || L.kind === 'wait' || L.kind === 'subway'); })()`, false).catch(() => false)) { await B.send('Profiler.start'); profOn = true; } opened = await B.ev(`window.__city.subway.openFor === ${JSON.stringify(ID)} ? performance.now() : null`, false).catch(() => null); if (opened) break; await sleep(50); }
      if (!opened) throw new Error('the carriage did not open on ride ' + ride);
      if (CARSPEED) await B.ev(`window.__record.player.setSpeed(${CARSPEED})`);
      await sleep(1500);
      const measures = await B.ev(`(() => { const m = performance.getEntriesByType('measure').filter(e => e.name.startsWith('sbw:')).map(e => [e.name.slice(4), +e.duration.toFixed(1)]); performance.clearMeasures(); return m; })()`);
      const opening = await B.ev(`(() => { const s = window.__city.subway, o = s.open; return { ...(s.stats().lastOpen || {}), programsNow: o?.view?.renderer?.info?.programs?.length ?? null }; })()`);
      console.log('  opening (carriage.js timing, ms)', JSON.stringify(opening));
      if (DUMP) console.log('  dump', JSON.stringify(await B.ev(DUMP).catch(e => String(e))));
      let prof0 = null; if (prof && profOn) { prof0 = (await B.send('Profiler.stop')).result.profile; }
      if (GPU) await B.ev(GPU_CAR);
      const mark = await B.ev('window.__cp.frames.length');
      await sleep(SECS * 1000);
      const D = await B.ev(`(() => { const P = window.__cp; P.on = false; return { frames: P.frames, longs: P.longs }; })()`);
      await B.ev('window.__record.player.pause()');
      const F = D.frames, i0 = F.findIndex(f => f.rides >= (F[0]?.rides ?? 0) + 1), iOpen = F.findIndex(f => f.open === ID);
      const street = F.slice(0, Math.max(0, i0)).filter(f => f.ts - F[0].ts > 1000), win = F.slice(Math.max(0, i0 - 1), mark), car = F.slice(mark).filter(f => f.covered);
      let worst = { ms: 0 }, over50 = []; for (let k = 1; k < win.length; k++) { const d = win[k].ts - win[k - 1].ts; if (d > 50) over50.push(r1(d)); if (d > worst.ms) worst = { ms: d, skip: (win[k].min - win[k - 1].min) * 60, at: k, before: { cb: win[k - 1].cb, parts: win[k - 1].m, open: win[k - 1].open, rides: win[k - 1].rides, msFromRide: r1(win[k - 1].ts - (F[i0]?.ts ?? 0)) } }; }
      const wa = win[0]?.ts ?? 0, wb = win[win.length - 1]?.ts ?? 0;
      const rec = { ride, street: summarize(street), stall: { longestMs: r1(worst.ms), recordSkippedIslandS: r2(worst.skip), longestBefore: worst.before, framesOver50ms: over50, windowMs: r1(wb - wa), toOpenMs: iOpen >= 0 && i0 >= 0 ? r1(F[iOpen].ts - F[i0].ts) : null,
        longtasks: D.longs.filter(([s]) => s >= wa - 100 && s <= wb) }, carriage: summarize(car), coveredFrames: car.filter(f => f.covered).length };
      if (measures.length) { rec.measures = measures; console.log('  measures', JSON.stringify(measures.filter(([n, d]) => !/^f\d/.test(n) || d > 8))); }
      rec.opening = opening;
      if (prof0) rec.profile = topSelf(prof0);
      out.rides.push(rec);
      console.log(`ride ${ride}: street ${JSON.stringify({ mean: rec.street.mean, p95: rec.street.p95, max: rec.street.max })} · stall ${JSON.stringify(rec.stall)}`);
      console.log(`  carriage ${JSON.stringify({ n: rec.carriage.frames, mean: rec.carriage.mean, p95: rec.carriage.p95, max: rec.carriage.max, covered: rec.coveredFrames })}`);
      console.log(`  carriage cpu/frame ${JSON.stringify(rec.carriage.cpuPerFrame)}`);
      console.log(`  city parts/frame (covered) ${JSON.stringify(rec.carriage.cityParts)}`);
      console.log(`  street cpu/frame ${JSON.stringify(rec.street.cpuPerFrame)} · parts ${JSON.stringify(rec.street.cityParts)}`);
      if (rec.profile) { console.log('  profile (self ms, the opening):'); for (const p of rec.profile.slice(0, 30)) console.log('   ', p.ms, p.fn); }
    }
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
  } finally { await B.close(); if (served) served.kill(); }
  const file = path.join(OUT, `carriageperf-${SEED}-${ID}-${TAG}.json`); await fs.writeFile(file, JSON.stringify(out, null, 1)); console.log('wrote', path.relative(ROOT, file));
}
// a CPU profile's self time by function (name · file:line), the top ones
function topSelf(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), self = new Map(), dt = p.timeDeltas;
  for (let k = 0; k < p.samples.length; k++) { const n = byId.get(p.samples[k]), cf = n.callFrame, key = `${cf.functionName || '(anon)'} · ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[k] || 0) / 1000); }
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([fn, ms]) => ({ fn, ms: r1(ms) }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
