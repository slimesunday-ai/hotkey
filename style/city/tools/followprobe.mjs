// C2 · FOLLOWING ONE AGENT THROUGH A WHOLE DAY AND NIGHT (GAME.md §41, slime 10-30: "you go to follow an agent from the start and they
// just vanish... you lost the continuity of following an agent"). Headless Chrome on ?sim=record, one Chrome per agent (--par at once):
// the agent's card opened with a real click on it and Follow pressed with the F key (the player's own way), then the record played from
// --from to --to without a seek: 10× through every trip of the agent and the night's show, 60× in between (the player's own speeds, set
// as its speed box does). The page's own day / night reloads happen on the way; the follow is carried by ?follow= (ui/record/follow.js).
// Per frame (an rAF after the city's render), for the followed agent:
//   jumps      its walker drawn further from its last frame's place than its travel allows (c2probe's allowance: 2 m, plus 20 m per island
//              second on a trip's legs or 3 m otherwise), the first frame of a walker (put back after a ride, a reload) not counted
//   undrawn    frames with no walker while the drawing has it on the street (draw.js stateAt: not hidden) and nothing of it carries the
//              camera (a ride's stand-in under its id: a cab, the subway; the cruiser), by what it was doing (trip mode / leg / place)
//   switches   the camera off the agent: on someone else, or out of follow, while the viewer did nothing (each time, with what it was on);
//              frames after a reload until the follow is back on the agent are counted apart (reloadFrames)
//   blank      sampled every 6th frame: the canvas read back at 40×25 right after the render, luminance spread < 2.5 (one flat colour)
//   frame ms   the page's frame time: every frame, and the frames on a subway trip
//   (C2-transit) per subway ride (by its trip's departure): the island and real seconds the follower spent with the carriage open on this
//              agent (subway/index.js) vs underground on the street stand-in, and the frame time with the carriage open. While the carriage
//              is open the blank sample reads ITS canvas (what the viewer sees: the city under it is not drawn, main.js api.cover)
//   (C2-transit) the woods (slime 10-31, "Hold at the edge"): frames with no walker on a trip to or from a forest place (woods, the labs,
//              the lookout, the ferry landing), named apart from the street's (they still count in undrawn), with the camera then: held,
//              on, or switched, and how far it moved while it held
// Exit 1 when any agent has a jump, an undrawn street frame, a switch or a blank frame.
//   node style/city/tools/followprobe.mjs --port 5961 [--seed 404] [--ids a04,a05,a07,a10,a18,a19] [--from 6110] [--to 7570] [--par 3]
//     [--busy 10] [--quiet 60] [--out style/city/shots/c2-follow] [--tag before]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5961), SEED = +arg('seed', 404), IDS = arg('ids', 'a04,a05,a07,a10,a18,a19').split(','), PAR = +arg('par', 3);
const FROM = +arg('from', 4 * 1440 + 350), TO = +arg('to', 5 * 1440 + 370), BUSY = +arg('busy', 10), QUIET = +arg('quiet', 60), TAG = arg('tag', 'probe');
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-follow'))), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms)), dbg = (...a) => { if (process.env.FP_DEBUG) console.log('[fp]', ...a); };
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };
const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `d${Math.floor(m / 1440)} ${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}`; };

// ── in the page (serialized): the windows to play at --busy, and the per-frame sampler
function windows(id, from, to) {
  const D = window.__record.draw, L = D.timeline.segs.get(id) || [], out = [];
  for (let i = 0; i < L.length; i++) { if (L[i].start > to) break; const d = D.rule.at(id, i); if (!d?.trip) continue; const a = d.dep - 1, b = Math.max(d.trip.arr, d.dep) + 1; if (b >= from) out.push([a, b, d.trip.mode]); }
  const nights = [...new Set(D.timeline.segs.get(id)?.map(s => Math.floor(s.start / 1440)) ?? [])];
  for (let n = Math.floor(from / 1440); n <= Math.floor(to / 1440); n++) { try { const p = D.planner.night(n); if (p && p.end >= from && p.start <= to) out.push([p.start - 1, p.end + 1, 'show']); } catch {} }
  return out.sort((x, y) => x[0] - y[0]);
}
function sampler(id, o) {
  const D = window.__record.draw, P = window.__record.player, city = window.__city, cam = city.cam, gl = city.renderer?.domElement || document.querySelector('canvas');
  const W = window.__fp = { done: false, d: { frames: 0, drawn: 0, jumps: [], undrawn: {}, undrawnN: 0, switches: [], switchFrames: 0, holdFrames: 0, reloadFrames: 0, blank: [], blankN: 0, samples: 0, ms: [], subMs: [], carMs: [], rides: {}, woods: {}, first: null, last: null } };
  const FOREST = p => /^(woods|lab-|forest\.)/.test(String(p ?? ''));
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 25; const cx = cv.getContext('2d', { willReadFrequently: true });
  let m0 = P.minute, t0 = performance.now(), last = null, wasOn = false, seenOn = false, fno = 0, lastW = null;
  const inWin = m => o.win.some(([a, b]) => m >= a && m < b);
  const f = () => {
    if (W.done) return; const R = W.d, m = P.minute, dm = m - m0, now = performance.now(), ms = now - t0; m0 = m; t0 = now; fno++; R.frames++;
    if (R.first === null) R.first = m; R.last = m;
    // (the player's speed, as its speed box sets it: --busy through the agent's trips and the show, --quiet between)
    const sp = inWin(m) ? o.busy : o.quiet; if (P.running && P.speed !== sp) P.setSpeed(sp);
    if (P.running && m >= o.to) P.pause();
    const a = D.agents?.map.get(id), w = a?.w && !a.w.gone ? a.w : null, s = D.stateAt(id, m), sub = cam?.subject ?? null, mode = cam?.mode;
    const on = mode === 'follow' && !!sub && sub.aid === id && !sub.gone, stand = on && sub !== w && !!sub.ride;
    const cruiser = D.scenes?.rides?.get?.(id)?.car, carried = stand || !!(cruiser && cruiser.visible !== false && cruiser.parent);
    if (fno > 1) R.ms.push(+ms.toFixed(1));
    if (s.trip?.mode === 'subway' && fno > 1) R.subMs.push(+ms.toFixed(1));
    // (C2-transit: the subway ride, carriage or street stand-in; the woods)
    const subw = city.subway, car = subw?.openFor === id ? subw.open : null, under = !!a?.run?.under;
    if (car && fno > 1) R.carMs.push(+ms.toFixed(1));
    if (s.trip?.mode === 'subway' && (under || car) && fno > 1) { const r = R.rides[s.trip.dep] ??= { carIsland: 0, carReal: 0, streetIsland: 0, streetReal: 0 }; if (car) { r.carIsland += dm * 60; r.carReal += ms / 1000; } else { r.streetIsland += dm * 60; r.streetReal += ms / 1000; } }
    const wood = s.trip && (FOREST(s.trip.from) || FOREST(s.trip.to)) && !w && !s.hidden;
    if (wood && fno > 1) { const k = String(s.trip.dep) + ' ' + s.trip.from + '>' + s.trip.to, u = R.woods[k] ??= { frames: 0, held: 0, on: 0, other: 0, camMove: 0, from: null, to: null }, cp = city.camera.position;
      u.frames++; if (on) u.on++; else if (mode === 'follow' && !sub) u.held++; else u.other++; if (!u.from) u.from = +m.toFixed(3); u.to = +m.toFixed(3);
      if (u.cp) u.camMove = Math.max(u.camMove, +Math.hypot(cp.x - u.cp[0], cp.y - u.cp[1], cp.z - u.cp[2]).toFixed(2)); else u.cp = [cp.x, cp.y, cp.z]; }
    // the camera: on the agent (its walker or its ride's stand-in), holding where it was (nobody), or on someone else / out of follow
    if (on) { wasOn = true; seenOn = true; }
    else if (!seenOn) R.reloadFrames++;
    else if (mode === 'follow' && !sub) R.holdFrames++;
    else { R.switchFrames++; if (wasOn) R.switches.push([+m.toFixed(3), mode, sub ? (sub.aid ?? 'walker#' + sub.id) : null, w ? 'drawn' : s.hidden ? 'hidden' : s.trip ? 'trip:' + s.trip.mode : 'at ' + s.place]); wasOn = false; }
    // its walker: drawn, and how far it moved
    if (w) { R.drawn++; const p = [w.p[0], w.p[2]];
      if (last && lastW === w && dm >= 0 && dm < .25) { const d = Math.hypot(p[0] - last[0], p[1] - last[1]), allow = 2 + (a.mode === 'leg' || s.trip ? 20 : 3) * dm * 60;
        if (d > allow && R.jumps.length < 400) R.jumps.push([+m.toFixed(3), +d.toFixed(1), a.mode, s.trip ? s.trip.mode : 'place', last.map(v => +v.toFixed(1)), p.map(v => +v.toFixed(1)), +(dm * 60).toFixed(2)]); }
      last = p; lastW = w; }
    else { last = null; lastW = null; if (!s.hidden && !carried) { R.undrawnN++; const k = (wood ? 'woods ' : '') + (s.trip ? 'trip:' + s.trip.mode : s.ride ? 'ride' : 'at ' + String(s.place).replace(/^home:.*/, 'home')); const u = R.undrawn[k] ??= { n: 0, at: [] }; u.n++; if (!u.at.length || m - u.at[u.at.length - 1][1] > .5) { if (u.at.length < 12) u.at.push([+m.toFixed(3), +m.toFixed(3)]); } else u.at[u.at.length - 1][1] = +m.toFixed(3); } }
    // a blank frame: the canvas, read back right after the render, one flat colour
    const shown = car?.view?.renderer?.domElement || gl;
    if (shown && fno % 6 === 0) { try { cx.drawImage(shown, 0, 0, 40, 25); const px = cx.getImageData(0, 0, 40, 25).data; let s1 = 0, s2 = 0, r = 0, g = 0, b = 0; const n = 1000;
      for (let k = 0; k < px.length; k += 4) { const L = .2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]; s1 += L; s2 += L * L; r += px[k]; g += px[k + 1]; b += px[k + 2]; }
      const sd = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2)); R.samples++; if (sd < 2.5) { R.blankN++; if (R.blank.length < 40) R.blank.push([+m.toFixed(3), +sd.toFixed(2), [r / n | 0, g / n | 0, b / n | 0], (on ? 'on' : mode) + (car ? ' carriage' : '')]); } } catch {} }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}
// drained every poll (the page may reload into night or day at any frame: what is drained is kept)
const DRAIN = `(() => { const W = window.__fp; if (!W) return null; const d = W.d; W.d = { frames: 0, drawn: 0, jumps: [], undrawn: {}, undrawnN: 0, switches: [], switchFrames: 0, holdFrames: 0, reloadFrames: 0, blank: [], blankN: 0, samples: 0, ms: [], subMs: [], carMs: [], rides: {}, woods: {}, first: null, last: null }; return d; })()`;
function merge(T, d) {
  for (const k of ['frames', 'drawn', 'undrawnN', 'switchFrames', 'holdFrames', 'reloadFrames', 'blankN', 'samples']) T[k] += d[k];
  T.jumps.push(...d.jumps); T.switches.push(...d.switches); T.blank.push(...d.blank); T.ms.push(...d.ms); T.subMs.push(...d.subMs); T.carMs.push(...(d.carMs || []));
  for (const [k, r] of Object.entries(d.rides || {})) { const t = T.rides[k] ??= { carIsland: 0, carReal: 0, streetIsland: 0, streetReal: 0 }; for (const f in r) t[f] += r[f]; }
  for (const [k, u] of Object.entries(d.woods || {})) { const t = T.woods[k] ??= { frames: 0, held: 0, on: 0, other: 0, camMove: 0, from: u.from, to: u.to }; for (const f of ['frames', 'held', 'on', 'other']) t[f] += u[f]; t.camMove = Math.max(t.camMove, u.camMove); t.to = u.to; }
  for (const [k, u] of Object.entries(d.undrawn)) { const t = T.undrawn[k] ??= { n: 0, at: [] }; t.n += u.n; for (const iv of u.at) { const l = t.at[t.at.length - 1]; if (l && iv[0] - l[1] <= .5) l[1] = iv[1]; else t.at.push(iv); } }
  if (d.first !== null && T.first === null) T.first = d.first; if (d.last !== null) T.last = d.last;
}
const stat = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(1), p95: s[Math.floor(s.length * .95)], max: s[s.length - 1] }; };

async function followOne(id) {
  const B = await chrome(), T = { id, frames: 0, drawn: 0, jumps: [], undrawn: {}, undrawnN: 0, switches: [], switchFrames: 0, holdFrames: 0, reloadFrames: 0, blank: [], blankN: 0, samples: 0, ms: [], subMs: [], carMs: [], rides: {}, woods: {}, first: null, last: null, reloads: 0, how: null, shots: [] };
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=${QUIET}&recordPaused=1` });
    await ready(B, 240000); await sleep(4000); dbg(id, 'loaded');
    // the player's way in: a click on the agent opens its card (c2lib clickAgent's way), F presses Follow
    const { clickAgent, key } = await import('./c2lib.mjs');
    const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(id)}; })()`);
    let on = false;
    for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, id).catch(() => null); dbg(id, 'card', card);
      if (card === id) { await key(B, 'f', 'KeyF', 70); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(2000); }
    T.how = on ? 'card + F' : null;
    // (not drawn at --from: the keeper's own way, ?follow=, put back once the walker is placed)
    if (!on) {
      B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=${QUIET}&recordPaused=1&follow=${id}` });
      // (a dialog the old page raised on leaving would stop the navigation and every evaluation: accepted)
      await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(2000)]);
      await ready(B, 240000); await sleep(4000); T.how = '?follow=';
    }
    const win = await B.ev(`(${windows})(${JSON.stringify(id)}, ${FROM}, ${TO})`); T.windows = win.length;
    await B.ev(`(${sampler})(${JSON.stringify(id)}, ${JSON.stringify({ win, busy: BUSY, quiet: QUIET, to: TO })})`);
    await B.ev('window.__record.player.play()');
    let lastShot = 0, pageWas = await B.ev('performance.timeOrigin'), stuck = 0, mPrev = -1;
    for (const t0 = Date.now(); Date.now() - t0 < 4 * 3600e3;) {
      await sleep(250);
      const st = await B.ev(`(() => ({ origin: performance.timeOrigin, fp: !!window.__fp, m: window.__record?.player?.minute ?? null }))()`, false).catch(() => null);
      if (!st) { continue; }
      // (the day / night reload: the new page, once its walkers are made, gets the sampler again)
      if (st.origin !== pageWas) {
        pageWas = st.origin; T.reloads++; await ready(B, 240000).catch(() => {}); const w2 = await B.ev(`(${windows})(${JSON.stringify(id)}, ${FROM}, ${TO})`);
        await B.ev(`(${sampler})(${JSON.stringify(id)}, ${JSON.stringify({ win: w2, busy: BUSY, quiet: QUIET, to: TO })})`); continue; }
      const d = await B.ev(DRAIN, false).catch(() => null); if (d) merge(T, d);
      if (d?.blankN && T.shots.length < 4 && Date.now() - lastShot > 3000) { lastShot = Date.now(); const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); const f = path.join(OUT, `${TAG}-${SEED}-${id}-blank-${T.shots.length}.jpg`); await fs.writeFile(f, Buffer.from(r.result.data, 'base64')); T.shots.push(path.relative(ROOT, f)); }
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
    await Promise.all(Array.from({ length: Math.min(PAR, IDS.length) }, async () => { while (next < IDS.length) { const id = IDS[next++]; const t0 = Date.now(); const T = await followOne(id); T.secs = Math.round((Date.now() - t0) / 1000); res.set(id, T);
      console.log(`${id} done in ${T.secs} s (${T.first?.toFixed?.(1)} → ${T.last?.toFixed?.(1)}, ${T.reloads} reloads${T.error ? ', ERROR ' + T.error : ''}${T.stalled ? ', STALLED at ' + T.stalled : ''})`); } }));
  } finally { if (served) served.kill(); }
  const rows = IDS.map(id => res.get(id)).filter(Boolean); let bad = false;
  console.log(`\nfollowprobe · seed ${SEED} · ${hhmm(FROM)} → ${hhmm(TO)} · ${BUSY}× on trips and the show, ${QUIET}× between · ${TAG}`);
  console.log('agent  how        frames  drawn  jumps  undrawn  switches  blank/samples  reloads  ms mean/p95 (all)  ms mean/p95 (subway)');
  for (const T of rows) { const a = stat(T.ms), s = stat(T.subMs); const fail = T.jumps.length || T.undrawnN || T.switches.length || T.blankN || T.error || T.stalled || (T.last ?? 0) < TO - 1; if (fail) bad = true;
    console.log(`${T.id.padEnd(6)} ${String(T.how).padEnd(10)} ${String(T.frames).padStart(6)} ${String(T.drawn).padStart(6)} ${String(T.jumps.length).padStart(6)} ${String(T.undrawnN).padStart(8)} ${String(T.switches.length).padStart(9)} ${(T.blankN + '/' + T.samples).padStart(14)} ${String(T.reloads).padStart(8)}  ${a ? (a.mean + '/' + a.p95).padStart(16) : '-'.padStart(16)}  ${s ? (s.mean + '/' + s.p95 + ' (' + s.n + ' f)').padStart(20) : '-'.padStart(20)}  ${fail ? 'FAIL' : 'ok'}`); }
  for (const T of rows) {
    if (T.error) console.log(`  ${T.id} error: ${T.error}`);
    if (T.jumps.length) console.log(`  ${T.id} jumps [minute, m, mode, trip, from, to, island s]:`, JSON.stringify(T.jumps.slice(0, 8)));
    for (const [k, u] of Object.entries(T.undrawn)) console.log(`  ${T.id} undrawn ${k}: ${u.n} frames, at`, JSON.stringify(u.at.slice(0, 6)));
    if (T.switches.length) console.log(`  ${T.id} switches [minute, mode, onto, agent]:`, JSON.stringify(T.switches.slice(0, 8)));
    if (T.holdFrames) console.log(`  ${T.id} held (camera waiting where it was, nobody): ${T.holdFrames} frames`);
    if (T.reloadFrames) console.log(`  ${T.id} frames before the follow was on it (load, reloads): ${T.reloadFrames}`);
    if (T.blankN) console.log(`  ${T.id} blank [minute, spread, rgb, cam]:`, JSON.stringify(T.blank.slice(0, 6)), T.shots.join(' '));
    if (T.errors?.length) console.log(`  ${T.id} page errors:`, T.errors);
    for (const [k, r] of Object.entries(T.rides)) console.log(`  ${T.id} subway ride dep ${k}: carriage ${r.carIsland.toFixed(1)} island s (${r.carReal.toFixed(1)} real s), street stand-in ${r.streetIsland.toFixed(1)} island s (${r.streetReal.toFixed(1)} real s)`);
    if (T.carMs.length) { const c = stat(T.carMs); console.log(`  ${T.id} frame ms with the carriage open: mean ${c.mean} p95 ${c.p95} max ${c.max} (${c.n} f)`); }
    for (const [k, u] of Object.entries(T.woods)) console.log(`  ${T.id} woods ${k} (${u.from} → ${u.to}): ${u.frames} frames undrawn, camera held ${u.held}, on the agent ${u.on}, elsewhere ${u.other}; it moved at most ${u.camMove} m while there`);
  }
  const file = path.join(OUT, `${TAG}-${SEED}-followprobe.json`);
  await fs.writeFile(file, JSON.stringify(rows.map(({ ms, subMs, carMs, ...r }) => ({ ...r, msAll: stat(ms), msSubway: stat(subMs), msCarriage: stat(carMs || []) })), null, 1));
  console.log(`${bad ? 'FOLLOWPROBE FAIL' : 'FOLLOWPROBE PASS'} · ${path.relative(ROOT, file)}`);
  process.exitCode = bad ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
