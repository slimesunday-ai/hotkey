// SIM LIVE pass · ?sim=live[&simport=5251][&simpoll=1000][&simtod=0]: the city draws the RUNNING sim (sim2/server.mjs GET /state, or
// tools/simreplay.mjs). main.js calls startLive() once; everything else happens here:
//   feed     feed.js in a worker (feedworker.js): polls /state, adapts it (adapter.js, the only code that knows the sim's field names)
//            and posts only what changed. A failed poll keeps the last state, shows SIM OFFLINE (index.html #simbadge) and retries with
//            backoff; the badge goes when the sim answers again.
//   layer    layer.js in its live mode: homes (lights, zzz, FOR RENT, security, scars), piles by bank, hotspots by sales and price,
//            patrol cars — each diff redrawn per group within a frame budget (no hitch on a poll)
//   agents   agents.js (+ looks.js): the sim's agents as walkers — standing at their place's stand spots (stands.json), walking their
//            trips on the sidewalk graph timed to the sim's clock, jailed on Iron Island
//   clock    day and night follow the sim's clock: the page is built for one or the other (TOD.night, main.js), so when the sim's night
//            and the page's differ the page reloads into the sim's, keeping the camera (?simtod=0 keeps the page's own ?tod) and, through
//            ui/reload.js, what the viewer has open; a link's one-time openers (?tape=1 …, ?people=, ?home=) are dropped
//   bench    ?bench=1: the feed's and the frame's costs (__city.simlive.bench(), and a line under the bench results)
// Without ?sim=live none of this loads; ?sim=demo draws demo.json through the one-shot path, exactly as before.
import { createSimLayer } from './layer.js';
import { createAgents } from './agents.js';
import { createLooks } from './looks.js';
import { createStationCops } from './stationcops.js';   // (STATION COPS: the posted stations' officers)
import { createFeed } from './feed.js';
import { notes } from './adapter.js';
import { createLine, mergeDiff, delayS } from './broadcast.js';   // (BROADCAST: the delay line, simstate/broadcast.js)
import { sdata } from '../../../world/city.js';   // (SPREAD: the data this spread reads)

const q = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3); };
export async function startLive({ Q, SHOT = false, BENCH = false, NIGHT = false, scene, mats, lib, places, peds, camera, controls, cornerKits, isShown, ANCHORS, log = console.log, noteFail = () => {} }) {
  const port = +(Q.get('simport') || 5251), url0 = Q.get('simurl') || `http://127.0.0.1:${port}/state`, url = Q.get('movemock') === '1' ? url0 + (url0.includes('?') ? '&' : '?') + 'movemock=1' : url0,   /* (MOVEMENT W3a: ?movemock=1, the replay's dev mock of the trip legs) */ interval = Math.max(250, +(Q.get('simpoll') || 1000));
  const followTod = Q.get('simtod') !== '0';
  if (Q.has('simstands')) {   // (node simstate/stands.mjs: the stand spots, made from the blocks' audit builds — no feed, no layer)
    const { makeStands } = await import('./stands.js'), flags = { neutral: Q.get('neutral') !== '0' && Q.get('pass2') !== '0', pass2: Q.get('pass2') !== '0', faces: Q.get('faces') !== '0' };
    try { window.__simStands = await makeStands({ places, flags, cornerKits, log }); } catch (e) { window.__simStands = { error: String(e && e.stack || e) }; }
    document.title = 'stands-ready'; return { layer: null, info: { source: 'stands' } }; }
  const layer = createSimLayer({ scene, mats, lib, night: NIGHT, cornerKits, isShown, live: true, budgetMs: SHOT ? Infinity : +(Q.get('simbudget') || 2) });   // (a shot draws everything in its one frame)
  // the lots' and buildings' doors (where an agent goes in), from the anchors the blocks hand back
  const doorIx = new Map(), indexDoors = a => { for (const [id, l] of Object.entries(a?.lots || {})) if (l.door) doorIx.set(id, l.door); for (const b of a?.buildings || []) for (const u of b.units || []) if (b.entrance?.door) doorIx.set(u.id, b.entrance.simDoor ? [b.entrance.simDoor[0], 0, b.entrance.simDoor[1]] : b.entrance.door); };
  { const add = layer.addAnchors; layer.addAnchors = (k, a) => { add(k, a); indexDoors(a); }; }
  for (const [k, a] of ANCHORS) layer.addAnchors(k, a);
  const info = { source: 'live', url, status: 'connecting', t: null, ts: null, night: null, notes: [], errors: 0 };
  // ── the badge
  const badge = typeof document !== 'undefined' ? document.getElementById('simbadge') : null;
  // offline: the badge counts down to the next try, once a second (review 10-09 #13: it said "retrying in 16 s" until the next failure)
  let retryAt = 0, countdown = 0;
  const badgeText = () => { const s = Math.ceil((retryAt - Date.now()) / 1000), t = s >= 1 ? `SIM OFFLINE · retrying in ${s} s` : 'SIM OFFLINE · retrying…'; if (badge.textContent !== t) badge.textContent = t; };
  const setBadge = s => { if (!badge) return; if (s.ok) { clearInterval(countdown); countdown = 0; badge.hidden = true; badge.textContent = ''; return; }
    badge.hidden = false; retryAt = Date.now() + (s.retryIn || 1000); badgeText(); badge.title = `${url}: ${s.error || 'no answer'}`; if (!countdown) countdown = setInterval(badgeText, 250); };
  // ── the agents (when the walkers are on: ?peds=0 turns both off)
  let agents = null, looks = null, stands = null, cops = null;
  try { const r = await fetch(new URL(sdata('./stands.json'), import.meta.url), { cache: 'no-store' }); if (r.ok) stands = await r.json(); } catch {}
  if (!stands) log('sim live: no simstate/stands.json — every agent at a place is indoors (node style/city/simstate/stands.mjs makes it)');
  if (peds) {
    try { const CH = await import('../cast.js'); looks = createLooks({ peds, CH, log: m => log('sim live: ' + m), worker: !SHOT }); } catch (e) { log('sim live: no agent looks (' + (e && e.message || e) + ')'); }
    agents = createAgents({ peds, places, stands, doorOf: id => doorIx.get(id) || null, looks, log: m => log('sim live: ' + m), scene }); peds.driver = agents.drive;
    cops = createStationCops({ peds, looks, ANCHORS, log: m => log('sim live: ' + m) });
    { const drive = agents.drive; agents.drive = (...a) => { drive(...a); cops.tick(); }; peds.driver = agents.drive; }   // (the officers' looks, once baked: before the stage wraps the drive)
    { const add = layer.addAnchors; layer.addAnchors = (k, a) => { add(k, a); if (a?.transit?.some(t => t.kind === 'subway')) cops.refresh(); }; } }   // (a station's block came in: its posted pair stands)
  // STAGE (stage/index.js): the sim's events play out in the city: robberies, arrests, burglaries, deals, deaths (?stage=0: off)
  let stage = null;
  if (agents && !SHOT && Q.get('stage') !== '0') import('../stage/index.js').then(m => { stage = m.createStage({ scene, mats, peds, agents, layer, places, camera, night: NIGHT, log: msg => log(msg) });
    const drive = agents.drive; peds.driver = (t, dt, f, cam, R) => { drive(t, dt, f, cam, R); stage.frame(dt); }; }).catch(e => log('stage: ' + (e && e.stack || e)));
  // ── diffs from the feed
  const B = { applyMs: [], diffs: 0, feed: null, reloads: 0 }; let first = true, todMiss = 0, started = performance.now(), lastDiff = null;
  // BROADCAST (simstate/broadcast.js): a diff reaches the map D s after it came, in order (?delay=, Settings; D = 0 and a shot: at once)
  const line = createLine({ name: 'map', release: applyDiff, merge: mergeDiff, tOf: d => d.hasClock ? d.t : null, ...(SHOT ? { delay: () => 0 } : {}) });
  function onDiff(d) { line.push(d, d.since ? { ago: (Date.now() - d.since) / 1000 } : undefined); }   // (since: a state the join backfilled)
  function applyDiff(d) {
    const t0 = performance.now(); lastDiff = d; B.diffs++; B.feed = d.stats;
    layer.applyDiff(d); peds?.setDemand(d.crowd, null);   // (the sim's crowd already carries its rush)
    if (agents) { agents.setClock(d.hasClock ? d.t : null, agents.clock.pageT, d.running); agents.setAgents(d.agents || []); }
    if (cops && d.stationCops !== undefined) cops.set(d.stationCops);   // (STATION COPS: the shift's rota)
    Object.assign(info, { status: 'live', t: d.t, ts: d.ts, night: d.hasClock ? d.clock.night : null, running: d.running, wanted: d.wanted, patrols: d.patrols, rush: d.rush, boards: d.boards });
    if (d.notes?.length) info.notes.push(...d.notes);
    B.applyMs.push(performance.now() - t0); if (B.applyMs.length > 300) B.applyMs.shift();
    if (first) { first = false; if (SHOT) layer.flush(); }
    if (d.hasClock && followTod && !SHOT) { todMiss = d.clock.night !== NIGHT ? todMiss + 1 : 0; if (todMiss >= (B.diffs <= 1 ? 1 : 2)) reloadForTod(d.clock.night); }
  }
  function reloadForTod(night) {   // the page is built for day or night: reload into the sim's, where the camera is
    let lastAt = 0; try { lastAt = +(sessionStorage.getItem('simlive-reload') || 0); } catch {} if (Date.now() - lastAt < 15000) return;   // (never in a loop)
    try { sessionStorage.setItem('simlive-reload', String(Date.now())); } catch {}
    const u = new URL(location.href), p = camera.position, t = controls.target, r = v => +v.toFixed(2); u.searchParams.set('tod', night ? 'night' : 'day');
    // a link's one-time openers go (review 10-09 #2: a page opened from ?tape=1&tapeat=… went back into that old TAPE moment at every
    // dusk and dawn); what the viewer has open is the UI's to keep (ui/reload.js, sessionStorage), told just before the page goes
    for (const k of ['tape', 'tapeat', 'tapeagent', 'tapeplay', 'people', 'home']) u.searchParams.delete(k);
    try { dispatchEvent(new Event('simlive:reload')); } catch {}
    if (performance.now() - started > 4000) { u.searchParams.set('cam', [p.x, p.y, p.z].map(r).join(',')); u.searchParams.set('look', [t.x, t.y, t.z].map(r).join(',')); u.searchParams.set('fov', String(r(camera.fov))); u.searchParams.delete('view'); }
    B.reloads++; log(`sim live: the sim's clock says ${night ? 'night' : 'day'} — reloading into it`); location.replace(u.href); }
  function onStatus(s) { info.status = s.ok ? 'live' : 'offline'; if (!s.ok) { info.errors++; info.lastError = s.error; } setBadge(s); }
  // ── the feed: a worker, else inline
  const opt = { url, places, night: NIGHT, interval, delay: SHOT ? 0 : delayS() }; let feed = null, worker = null, polled = new Map(), pid = 0;
  if (SHOT) startInline(); else try { worker = new Worker(new URL('./feedworker.js', import.meta.url), { type: 'module' });   // (a shot polls here: headless virtual time waits for the page's own fetches, not a worker's)
    worker.onmessage = e => { const m = e.data; if (m.type === 'diff') onDiff(m.d); else if (m.type === 'status') onStatus(m.s); else if (m.type === 'polled') { polled.get(m.id)?.(); polled.delete(m.id); } };
    worker.onerror = e => { log('sim live: the feed worker failed (' + (e.message || 'error') + ') — polling on the main thread'); worker?.terminate(); worker = null; startInline(); };
    worker.postMessage({ type: 'start', opt }); }
  catch (e) { worker = null; startInline(); }
  function startInline() { if (feed) return; feed = createFeed({ ...opt, onDiff, onStatus }); feed.start(); }
  const pollNow = () => worker ? new Promise(res => { const id = ++pid; polled.set(id, res); worker.postMessage({ type: 'poll', id }); }) : feed ? feed.pollNow() : Promise.resolve();
  // a shot draws one moment: the first state (two tries, 5 s each; no answer: the badge says so), every look baked, everything drawn at once
  if (SHOT) { await feed.pollNow(); if (first) await feed.pollNow(); feed.stop();   // (one moment: no more polls)
    if (first) log('sim live: no state from ' + url + ' — the shot shows the city without it');
    else if (peds && looks) { const t1 = performance.now(); while (!peds.ready && performance.now() - t1 < 4000) await new Promise(r => setTimeout(r, 20)); await looks.pumpAll(); agents?.setAgents(lastDiff.agents || []); if (lastDiff.stationCops !== undefined) cops?.set(lastDiff.stationCops); } }
  // ── ?bench=1 and the console
  const bench = () => { const L = layer.liveStats(), G = agents?.stats(), F = B.feed || {}, K = looks?.stats();
    return { polls: F.polls, fails: F.fails, bytes: F.bytes, fetchMs: F.fetchMs, parseMs: F.parseMs, adaptMs: F.adaptMs, feedMaxMs: +(F.maxMs || 0).toFixed(2), worker: !!worker,
      applyP50: q(B.applyMs, .5), applyMax: +Math.max(0, ...B.applyMs).toFixed(3), layerFrameP50: L.p50, layerFrameP95: L.p95, layerFrameMax: L.maxMs, groupMaxMs: L.groupMax, groupsDrawn: L.groups, batchGrows: L.grows, batchCompacts: L.compacts,
      agentsP50: G?.p50 ?? 0, agentsP95: G?.p95 ?? 0, agentsMax: G?.maxMs ?? 0, agents: G?.agents ?? 0, walking: G?.walking ?? 0, standing: G?.standing ?? 0, looksBaked: K?.baked ?? 0, lookMsAvg: K?.msAvg ?? 0, lookMsMax: K?.maxMs ?? 0 }; };
  const benchLine = () => { const b = bench(); return `SIM LIVE · ${b.polls} polls (${b.fails} failed) · ${(b.bytes / 1024).toFixed(0)} KB · in the ${b.worker ? 'worker' : 'main thread'}: fetch ${b.fetchMs} parse ${b.parseMs} adapt ${b.adaptMs} ms (max ${b.feedMaxMs}) · main thread per diff p50 ${b.applyP50} max ${b.applyMax} ms · layer per frame p50 ${b.layerFrameP50} p95 ${b.layerFrameP95} max ${b.layerFrameMax} ms (${b.groupsDrawn} groups redrawn, slowest ${b.groupMaxMs} ms; one batch, grown ${b.batchGrows}×) · agents per frame p50 ${b.agentsP50} p95 ${b.agentsP95} max ${b.agentsMax} ms (${b.agents}: ${b.walking} walking, ${b.standing} standing) · looks ${b.looksBaked} baked, avg ${b.lookMsAvg} max ${b.lookMsMax} ms`; };
  if (BENCH) { const wait = setInterval(() => { if (!window.__bench) return; clearInterval(wait); const line = benchLine(); window.__bench.simlive = bench(); log(line); const pre = document.querySelector('#bench pre'); if (pre) pre.textContent += '\n' + line; }, 500); }
  const api = { layer, info, get agents() { return agents; }, get looks() { return looks; }, get cops() { return cops; }, get stage() { return stage; }, bench, benchLine, pollNow, stands, notes, feedStats: () => B.feed, get worker() { return !!worker; }, stop() { worker?.postMessage({ type: 'stop' }); worker?.terminate(); feed?.stop(); line.clear(); clearInterval(countdown); } };
  if (typeof window !== 'undefined') window.__simlive = api;
  return api;
}
