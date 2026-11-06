// C2-lock · THE LOCK CAMERA THROUGH A WHOLE DAY AND NIGHT (camera/lock.js, slime 11-04: "another setting just locked onto a subject and
// you could rotate and zoom around them instead of the camera trying to avoid everything"; walls: "see through is way better").
// followprobe's run (its windows, speeds and reloads), on Lock instead of Follow: headless Chrome on ?sim=record, one Chrome per agent
// (--par at once), the agent's card opened with a real click on it and its Lock pressed with a real click (the player's own way), then the
// record played from --from to --to without a seek: --busy× through every trip of the agent and the night's show, --quiet× between (set as
// its speed box does). The page's own day / night reloads happen on the way; the lock is carried by ?follow=<id>&lock=1
// (ui/record/follow.js). Per frame (an rAF after the city's render), read from the page's camera and drawing, never from lock.js:
//   on         frames the rig is in lock on the agent (its walker or its ride's stand-in) · off: in some other mode or on someone else
//              while the viewer did nothing (each time, with what it was on) · held: lock with nobody (the agent not drawn)
//   visible    sampled every --every frames while on: a depth pick (the homes runtime's hitAt, what the screen draws: the cut and the lock
//              hole applied) at the person's chest; VISIBLE when it hits the person (in their drawn body: ≤ .75 m from their axis — the
//              near walkers' meshes reach .7 m, a big head stands out in front of the chest — feet to 2.1 m up, where they were when the
//              pick was drawn; or no nearer than 0.5 m short of their chest) or nothing; else BLOCKED, by what it hit: a car or a walker within reach of the hit, else the static city. The chest off
//              screen counts as blocked too
//   steps      the camera's step per frame against the person's (their feet, 3-D) — no input is sent, so the viewer's share is 0: the
//              excess (camera − person) per frame, its max, and frames over 1 cm; frames where the camera's subject changed object (a
//              ride's stand-in, put back after a reload) are counted apart
//   frame ms   the page's frame time
// Exit 1 when any agent is visible in < 99 % of its samples, or has an off frame, or a step excess over 1 cm.
//   node style/city/tools/lockprobe.mjs --port 5972 [--seed 404] [--ids a04,a05,a07,a10,a18,a19] [--from 6110] [--to 7570] [--par 3]
//     [--busy 10] [--quiet 60] [--every 6] [--out tmp/c2-lock] [--tag probe]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started. At most two screenshots per agent
// (its first blocked samples), jpeg.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5972), SEED = +arg('seed', 404), IDS = arg('ids', 'a04,a05,a07,a10,a18,a19').split(','), PAR = +arg('par', 3), EVERY = +arg('every', 6);
const FROM = +arg('from', 4 * 1440 + 350), TO = +arg('to', 5 * 1440 + 370), BUSY = +arg('busy', 10), QUIET = +arg('quiet', 60), TAG = arg('tag', 'probe');
const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-lock'))), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms)), dbg = (...a) => { if (process.env.LP_DEBUG) console.log('[lp]', ...a); };
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };
const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `d${Math.floor(m / 1440)} ${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}`; };

// ── in the page (serialized): the windows to play at --busy (followprobe's), and the per-frame sampler
function windows(id, from, to) {
  const D = window.__record.draw, L = D.timeline.segs.get(id) || [], out = [];
  for (let i = 0; i < L.length; i++) { if (L[i].start > to) break; const d = D.rule.at(id, i); if (!d?.trip) continue; const a = d.dep - 1, b = Math.max(d.trip.arr, d.dep) + 1; if (b >= from) out.push([a, b, d.trip.mode]); }
  for (let n = Math.floor(from / 1440); n <= Math.floor(to / 1440); n++) { try { const p = D.planner.night(n); if (p && p.end >= from && p.start <= to) out.push([p.start - 1, p.end + 1, 'show']); } catch {} }
  return out.sort((x, y) => x[0] - y[0]);
}
const fresh = () => ({ frames: 0, on: 0, held: 0, offs: [], offFrames: 0, reloadFrames: 0, samples: 0, visible: 0, blocked: { static: 0, car: 0, walker: 0, offscreen: 0 }, blockedAt: [], steps: 0, maxExcess: 0, over: 0, overAt: [], swaps: 0, maxSwapStep: 0, ms: [], first: null, last: null, shotWant: 0 });
function sampler(id, o) {
  const D = window.__record.draw, P = window.__record.player, city = window.__city, cam = city.cam, T = city.THREE, H = city.recordHomes?.H;
  const W = window.__lp = { done: false, d: o.fresh() };
  let t0 = performance.now(), seenOn = false, wasOn = false, lastCam = null, lastFeet = null, lastSub = null, fno = 0, busy = 0;
  const inWin = m => o.win.some(([a, b]) => m >= a && m < b);
  const near = (h, R, fp) => { const tr = city.traffic?.sim?.cars || []; for (const c of tr) if (c && !c.gone && Math.hypot(c.x - h.x, c.z - h.z) < 2.6 && h.y < 2.4) return 'car';
    for (const w of city.peds?.sim?.walkers || []) if (!w.gone && w !== R && Math.hypot(w.p[0] - h.x, w.p[2] - h.z) < .6 && h.y - w.p[1] < 2.1) return 'walker'; return 'static'; };
  const f = () => {
    if (W.done) return; const R = W.d, m = P.minute, now = performance.now(), ms = now - t0; t0 = now; fno++; R.frames++;
    if (R.first === null) R.first = m; R.last = m; if (fno > 1) R.ms.push(+ms.toFixed(1));
    const sp = inWin(m) ? o.busy : o.quiet; if (P.running && P.speed !== sp) P.setSpeed(sp);
    if (P.running && m >= o.to) P.pause();
    const s = cam?.subject ?? null, mode = cam?.mode, on = mode === 'lock' && !!s && s.aid === id && !s.gone, p = city.camera.position;
    if (on) { R.on++; seenOn = wasOn = true; }
    else if (!seenOn) R.reloadFrames++;
    else if (mode === 'lock' && !s) R.held++;
    else { R.offFrames++; if (wasOn && R.offs.length < 40) R.offs.push([+m.toFixed(3), mode, s ? (s.aid ?? 'walker#' + s.id) : null]); wasOn = false; }
    // the steps: the camera against the person's feet (no input is sent)
    if (on) { const feet = [s.p[0], s.p[1], s.p[2]];
      if (lastCam && lastFeet) { const dc = Math.hypot(p.x - lastCam[0], p.y - lastCam[1], p.z - lastCam[2]), ds = Math.hypot(feet[0] - lastFeet[0], feet[1] - lastFeet[1], feet[2] - lastFeet[2]);
        if (s !== lastSub) { R.swaps++; R.maxSwapStep = Math.max(R.maxSwapStep, +dc.toFixed(3)); }
        else { R.steps++; const ex = dc - ds; if (ex > R.maxExcess) R.maxExcess = +ex.toFixed(4); if (ex > .01) { R.over++; if (R.overAt.length < 12) R.overAt.push([+m.toFixed(3), +dc.toFixed(3), +ds.toFixed(3)]); } } }
      lastCam = [p.x, p.y, p.z]; lastFeet = feet; lastSub = s; }
    else { lastCam = lastFeet = lastSub = null; }
    // visible: a depth pick at the chest (what the screen draws), every EVERY frames, one in flight at a time
    if (on && H && fno % o.every === 0 && !busy) { const chest = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), v = chest.clone().project(city.camera), cp = p.clone(), d = cp.distanceTo(chest), mm = m, fp = [s.p[0], s.p[1], s.p[2]];
      R.samples++;
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) { R.blocked.offscreen++; if (R.blockedAt.length < 20) R.blockedAt.push([+mm.toFixed(3), 'offscreen']); }
      else { const r = city.renderer.domElement.getBoundingClientRect(); busy = 1;
        H.hitAt(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height).then(h => { busy = 0;
          if (!h || h.distanceTo(cp) >= d - .5 || (Math.hypot(h.x - fp[0], h.z - fp[2]) < .75 && h.y > fp[1] - .1 && h.y < fp[1] + 2.1)) { W.d.visible++; return; }
          const k = near(h, s, fp); W.d.blocked[k]++; if (W.d.blockedAt.length < 20) W.d.blockedAt.push([+mm.toFixed(3), k, +h.distanceTo(cp).toFixed(2), +d.toFixed(2), [h.x, h.y, h.z].map(x => +x.toFixed(1))]); W.d.shotWant++; }).catch(() => { busy = 0; W.d.samples--; }); } }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}
const DRAIN = `(() => { const W = window.__lp; if (!W) return null; const d = W.d; W.d = (${fresh})(); return d; })()`;
function merge(T, d) {
  for (const k of ['frames', 'on', 'held', 'offFrames', 'reloadFrames', 'samples', 'visible', 'steps', 'over', 'swaps']) T[k] += d[k];
  for (const k in d.blocked) T.blocked[k] += d.blocked[k];
  T.offs.push(...d.offs); T.blockedAt.push(...d.blockedAt); T.overAt.push(...d.overAt); T.ms.push(...d.ms); T.shotWant += d.shotWant;
  T.maxExcess = Math.max(T.maxExcess, d.maxExcess); T.maxSwapStep = Math.max(T.maxSwapStep, d.maxSwapStep);
  if (d.first !== null && T.first === null) T.first = d.first; if (d.last !== null) T.last = d.last;
}
const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(1), p95: s[Math.floor(s.length * .95)], max: s[s.length - 1] }; };

async function lockOne(id) {
  const B = await chrome(), T = { id, ...fresh(), reloads: 0, how: null, shots: [] };
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=${QUIET}&recordPaused=1` });
    await ready(B, 240000); await sleep(4000); dbg(id, 'loaded');
    // the player's way in: a click on the agent opens its card (c2lib clickAgent's way), a click on the card's Lock
    const { clickAgent, centre, press } = await import('./c2lib.mjs');
    const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'lock' && c.subject?.aid === ${JSON.stringify(id)}; })()`);
    let on = false;
    for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, id).catch(() => null); dbg(id, 'card', card);
      if (card === id) { const b = await centre(B, `document.querySelector('#r-dossier [data-act=lock]')`); if (b) await press(B, b); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(2000); }
    T.how = on ? 'card + Lock' : null;
    // (not drawn at --from: the keeper's own way, ?follow=&lock=1, put back once the walker is placed)
    if (!on) {
      B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=${QUIET}&recordPaused=1&follow=${id}&lock=1` });
      await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(2000)]);
      await ready(B, 240000); await sleep(4000); T.how = '?follow=&lock=1';
    }
    // (the card closed: the run watches the city, as followprobe does once Follow is pressed)
    await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`);
    const opts = w => JSON.stringify({ win: w, busy: BUSY, quiet: QUIET, to: TO, every: EVERY });
    const win = await B.ev(`(${windows})(${JSON.stringify(id)}, ${FROM}, ${TO})`); T.windows = win.length;
    await B.ev(`(${sampler})(${JSON.stringify(id)}, { ...${opts(win)}, fresh: ${fresh} })`);
    await B.ev('window.__record.player.play()');
    let pageWas = await B.ev('performance.timeOrigin'), stuck = 0, mPrev = -1;
    for (const t0 = Date.now(); Date.now() - t0 < 4 * 3600e3;) {
      await sleep(250);
      const st = await B.ev(`(() => ({ origin: performance.timeOrigin, lp: !!window.__lp, m: window.__record?.player?.minute ?? null }))()`, false).catch(() => null);
      if (!st) continue;
      if (st.origin !== pageWas) {
        pageWas = st.origin; T.reloads++; await ready(B, 240000).catch(() => {}); const w2 = await B.ev(`(${windows})(${JSON.stringify(id)}, ${FROM}, ${TO})`);
        await B.ev(`(${sampler})(${JSON.stringify(id)}, { ...${opts(w2)}, fresh: ${fresh} })`); continue; }
      const d = await B.ev(DRAIN, false).catch(() => null); if (d) merge(T, d);
      if (d?.shotWant && T.shots.length < 2) { const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); const f = path.join(OUT, `${TAG}-${SEED}-${id}-blocked-${T.shots.length}.jpg`); await fs.writeFile(f, Buffer.from(r.result.data, 'base64')); T.shots.push(path.relative(ROOT, f)); }
      if (st.m !== null && st.m >= TO) break;
      if (st.m === mPrev) { if (++stuck > 240) { T.stalled = st.m; break; } } else { stuck = 0; mPrev = st.m; }
    }
    const d = await B.ev(DRAIN, false).catch(() => null); if (d) merge(T, d);
    T.errors = B.errors.slice(0, 5);
  } catch (e) { T.error = String(e && e.message || e); }
  finally { await B.close(); }
  return T;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), res = new Map(); let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(PAR, IDS.length) }, async () => { while (next < IDS.length) { const id = IDS[next++]; const t0 = Date.now(); const T = await lockOne(id); T.secs = Math.round((Date.now() - t0) / 1000); res.set(id, T);
      console.log(`${id} done in ${T.secs} s (${T.first?.toFixed?.(1)} → ${T.last?.toFixed?.(1)}, ${T.reloads} reloads${T.error ? ', ERROR ' + T.error : ''}${T.stalled ? ', STALLED at ' + T.stalled : ''})`); } }));
  } finally { if (served) served.kill(); }
  const rows = IDS.map(id => res.get(id)).filter(Boolean); let bad = false;
  console.log(`\nlockprobe · seed ${SEED} · ${hhmm(FROM)} → ${hhmm(TO)} · ${BUSY}× on trips and the show, ${QUIET}× between · pick every ${EVERY} frames · ${TAG}`);
  console.log('agent  how           frames      on   held  off  visible/samples      %   blocked s/c/w/off   max excess m  >1cm  swaps (max m)  ms mean/p95');
  for (const T of rows) { const a = stat(T.ms), pct = T.samples ? 100 * T.visible / T.samples : 0, b = T.blocked;
    const fail = pct < 99 || T.offFrames || T.over || T.error || T.stalled || (T.last ?? 0) < TO - 1; if (fail) bad = true;
    console.log(`${T.id.padEnd(6)} ${String(T.how).padEnd(13)} ${String(T.frames).padStart(6)} ${String(T.on).padStart(7)} ${String(T.held).padStart(6)} ${String(T.offFrames).padStart(4)} ${(T.visible + '/' + T.samples).padStart(16)} ${pct.toFixed(2).padStart(6)}   ${[b.static, b.car, b.walker, b.offscreen].join('/').padStart(14)}   ${String(T.maxExcess).padStart(11)} ${String(T.over).padStart(5)}  ${(T.swaps + ' (' + T.maxSwapStep + ')').padStart(13)}  ${a ? a.mean + '/' + a.p95 : '-'}  ${fail ? 'FAIL' : 'ok'}`); }
  for (const T of rows) {
    if (T.error) console.log(`  ${T.id} error: ${T.error}`);
    if (T.offs.length) console.log(`  ${T.id} off [minute, mode, onto]:`, JSON.stringify(T.offs.slice(0, 8)));
    if (T.blockedAt.length) console.log(`  ${T.id} blocked [minute, by, hit m, chest m, hit]:`, JSON.stringify(T.blockedAt.slice(0, 8)), T.shots.join(' '));
    if (T.overAt.length) console.log(`  ${T.id} step over 1 cm [minute, camera m, person m]:`, JSON.stringify(T.overAt.slice(0, 8)));
    if (T.held) console.log(`  ${T.id} held (lock waiting where they were, nobody drawn): ${T.held} frames`);
    if (T.reloadFrames) console.log(`  ${T.id} frames before the lock was on it (load, reloads): ${T.reloadFrames}`);
    if (T.errors?.length) console.log(`  ${T.id} page errors:`, T.errors);
  }
  const file = path.join(OUT, `${TAG}-${SEED}-lockprobe.json`);
  await fs.writeFile(file, JSON.stringify(rows.map(({ ms, ...r }) => ({ ...r, msAll: stat(ms) })), null, 1));
  console.log(`${bad ? 'LOCKPROBE FAIL' : 'LOCKPROBE PASS'} · ${path.relative(ROOT, file)}`);
  process.exitCode = bad ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
