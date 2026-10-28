// C1-9b · A SEEK GIVES EXACTLY THE PICTURE PLAYING THERE GIVES: headless Chrome on ?sim=record, real input on the record player's own
// controls (the minute box, play/pause, the speed) and real pointer events on the scrubber's markers, against the feed read in node.
//   node style/city/tools/seekscenario.mjs --port 5960 [--seeds 404,405,406] [--every 60] [--only hours,scenes,clicks] [--plant <name>]
// Steps (each reports its numbers; the run passes when every step passes):
//   1 hours    every hour of each seed (minute 0 to the record's end, --every island minutes): played there (a seek LEAD island minutes
//              before it, played at 60x, paused just past the hour), then sought to the very minute it paused at. The two pictures are
//              compared: every roster agent drawn or not alike; a standing walker within 0.05 m and in the same clip, a walker on a
//              trip's legs within 0.5 m, any other within 1.5 m; the scenes on and their figures (stand-ins and borrowed agents, by
//              handle), each within 2 m; the store's board and its events; the panels' words (the board, People, the cards, the
//              ticker, the dossier); the sets' effects (sparks, steam, glows). And, on both pictures, no event before its publication: every event in the store, every marker on
//              the scrubber, every card's replay id, every row of an open marker list and the missed card on show was first published (the feed played forward in node) at or before the minute
//   2 scenes   the same, inside the shows: each night's first fight or arrest scene, 3 s after its payoff and at its midpoint, played
//              from a quarter minute before the scene at 10x and paused there, then sought there
//   3 clicks   a sample of each seed's markers (every kind it has, and the moments C1-9b-ui listed), each on a fresh page just after
//              its publication: a real click on its pip; from the landing, for 3 s, every walker within 50 m of the camera's target is
//              tracked per frame (the record at 10x, TV mode off, as tapescenario clicks): none steps further in a frame than its own
//              travel allows (2 m, plus 20 m/s on a trip's legs or 3 m/s otherwise, times the frame's island seconds: a pop or a jump) or
//              rises or drops 0.4 m (a dip)
// --plant <seekpos|early|scene|pop>: a violation planted in the page (in memory, never in a source file) on a short run of seed 404,
// to show the step that guards it fails: seekpos (a seek moves every standing agent 0.3 m), early (the season's last event in the
// store from the start), scene (a seek drops one figure of each scene), pop (a standing walker near the landing has its spot moved 3 m once: it jumps there).
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, choose, click, typeMinute, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), PLANT = arg('plant', null), BASE = `http://127.0.0.1:${PORT}`;
const PLANT_STEPS = { seekpos: ['hours'], early: ['hours'], scene: ['scenes'], pop: ['clicks'] };
const ONLY = arg('only', null)?.split(',') ?? (PLANT ? PLANT_STEPS[PLANT] : null), want = k => !ONLY || ONLY.includes(k);
const SEEDS = arg('seeds', '404,405,406').split(',').map(Number), EVERY = +arg('every', PLANT ? 360 : 60), LEAD = .5;
const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c1-9b-seek')));
const FEED = s => `/core/runs/${s}-A/feed.jsonl`, DAY = 1440, sleep = ms => new Promise(r => setTimeout(r, ms));
const FAR = 'cam=-300,40,300&look=-300,0,260';
const TOL = { stand: .05, leg: .5, other: 1.5, figure: 2 };
const { createShowPlayer, createShowPlanner } = await import('../simstate/record/show-plan.js');
const { revealAt } = await import('../simstate/record/player.js');
const { createTapeReader } = await import('../simstate/record/tape-data.js');
const { CITY_PLACES, HOUSE_LOTS } = await import('../simstate/record/places.js');
const placeXZ = p => { if (!p) return null; const q = HOUSE_LOTS.find(l => l.id === p.cityPlace) ?? CITY_PLACES[p.standPlace] ?? CITY_PLACES[p.cityPlace]; return q ? { x: q.x, z: q.z } : null; };

// ── a season in node: each event's first publication (the feed played forward through every cue), the shows, the markers
function season(seed) {
  const file = path.join(ROOT, FEED(seed).slice(1));
  if (!fss.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  const frames = fss.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l)), planner = createShowPlanner(frames), reader = createTapeReader(frames);
  const P = createShowPlayer(frames, { speed: 60 }), first = new Map();
  const note = s => { for (const e of s.events) if (!first.has(e.id)) first.set(e.id, s.minute); };
  P.on(note); note(P.snapshot());
  const nights = frames.filter(f => f.step.kind === 'night').map(f => f.day), cues = new Set(frames.map(revealAt));
  for (const n of nights) { const p = planner.night(n); cues.add(p.start); cues.add(p.end); for (const s of p.scenes) cues.add(s.end); }
  P.play();
  for (const c of [...cues].sort((a, b) => a - b)) { if (c <= P.minute) continue; if (!P.running) P.play(); P.advance((c - P.minute) * 60 / 60 + 1e-6); }
  const bounds = P.bounds, all = reader.markersAt(createShowPlayer(frames).seek(bounds.to));
  return { seed, frames, planner, first, bounds, all, nights };
}

// ── in the page: the picture at the playhead
const SNAP = `(async () => { const { sim } = await import('/style/city/simstate/store.js'); const R = window.__record, m = R.player.minute, D = R.draw;
  const agents = [...D.agents.map.values()].map(a => [a.id, a.w ? [+a.w.p[0].toFixed(3), +a.w.p[1].toFixed(3), +a.w.p[2].toFixed(3), a.mode, a.w.mv?.clip ?? null, a.step ? 1 : 0] : null]);
  const scenes = [...(D.scenes?.live.values() ?? [])].filter(S => S.alive).map(S => [S.sc.id, S.actors.filter(A => !A.freed && A.w).map(A => [A.h, +A.x.toFixed(3), +A.z.toFixed(3), A.clip ?? null])]);
  const rec = sim.record(), text = id => { const n = document.getElementById(id); return n ? n.textContent.replace(/\\s+/g, ' ').trim() : null; };
  const markers = [...document.querySelectorAll('#record-player .r-tape-mk')].flatMap(b => (b.dataset.ids || '').split(',').filter(Boolean).map(Number));
  const replays = [...document.querySelectorAll('#r-cards [data-event], #r-cards [data-replay]')].map(n => +(n.dataset.event ?? n.dataset.replay)).filter(Number.isFinite);
  const menu = [...document.querySelectorAll('#r-tape-pop:not([hidden]) [data-marker]')].map(n => +n.dataset.marker);
  const card = document.querySelector('#r-missed .r-paper:not([hidden])'), missed = card?.dataset.ev ? [+card.dataset.ev] : [];
  const fx = D.scenes?.fxStats?.() ?? null;
  return { minute: m, agents, scenes, menu, missed, fx: fx && JSON.stringify(fx), board: JSON.stringify(rec?.board ?? null), events: (rec?.events ?? []).map(e => e.id), markers, replays,
    panels: Object.fromEntries(['r-board', 'r-people', 'r-cards', 'r-ticker', 'r-dossier'].map(id => [id, text(id)])) }; })()`;
const PLANTS = {
  seekpos: `window.__record.player.on((_, meta) => { if (!meta.reset) return; setTimeout(() => { for (const a of window.__record.draw.agents.map.values()) if (a.spot && a.mode === 'stand') { a.spot.x += .3; } }, 50); })`,
  early: `(() => { const P = window.__record.player, F = window.__record.frames, last = F.at(-1).events.at(-1), s = P.snapshot.bind(P); P.snapshot = () => { const o = s(); return { ...o, events: [...o.events, last] }; }; })()`,
  scene: `window.__record.player.on((_, meta) => { if (!meta.reset) return; setTimeout(() => { for (const S of window.__record.draw.scenes.live.values()) { const A = S.actors.find(A => !A.freed); if (A) A.freed = true; } }, 900); })`,
  pop: `(() => { let done = false, t0 = null; const R = window.__record, T = window.__city.controls.target; (function f() { if (!done && window.__recordUI?.tape?.log?.visits?.at(-1)?.landed && (t0 ??= performance.now()) < performance.now() - 1500) { for (const a of R.draw.agents.map.values()) { const w = a.w; if (w && a.spot && a.mode === 'stand' && Math.hypot(w.p[0] - T.x, w.p[2] - T.z) < 40) { a.spot.x += 3; done = true; break; } } } requestAnimationFrame(f); })(); })()`,
};
async function open(B, seed, q) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&simtod=0&${q}` }); await ready(B);
  for (let t = 0; t < 100 && !(await B.ev('!!window.__recordUI?.tape && !!window.__record?.draw', false).catch(() => false)); t++) await sleep(200);
  if (PLANT && PLANTS[PLANT]) await B.ev(PLANTS[PLANT], false);
  await sleep(600);
}
const PLAY = '#record-player button[aria-label="Play or pause"]', SPEED = '#record-player select[aria-label="Playback speed"]';
const frames = (B, n) => B.ev(`new Promise(r => { let k = 0; (function f() { if (++k > ${n}) r(true); else requestAnimationFrame(f); })(); })`);
async function pause(B) { if (await B.ev('window.__record.player.running')) await click(B, PLAY); }
// played to `to`: sought LEAD before it, played at `speed`, paused at the first frame at or past it → the minute it paused at
async function playTo(B, to, lead, speed) {
  await pause(B); await typeMinute(B, Math.max(0, +(to - lead).toFixed(4)));
  if (await B.ev('window.__record.player.speed') !== speed) await choose(B, SPEED, speed);
  await frames(B, 8);
  // (the pause is a real click, sent from the page's own frame once the playhead is there: the minute it lands on is then read)
  await B.ev(`window.__pauseAt = ${to}; (function f() { const P = window.__record.player; if (P.running && P.minute >= window.__pauseAt) { P.pause(); window.__pausedAt = P.minute; return; } requestAnimationFrame(f); })()`, false);
  await click(B, PLAY);
  for (let k = 0; k < 400 && await B.ev('window.__record.player.running'); k++) await sleep(25);
  await frames(B, 6);
  return B.ev('window.__record.player.minute');
}
async function seekTo(B, m) { await typeMinute(B, m); await frames(B, 12); await sleep(150); return B.ev('window.__record.player.minute'); }

// ── the two pictures compared
function compare(A, Bs, S, label) {
  const bad = [], dist = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
  const bm = new Map(Bs.agents); let worst = { stand: 0, leg: 0, other: 0, figure: 0 };
  for (const [id, p] of A.agents) { const q = bm.get(id) ?? null;
    if (!!p !== !!q) { bad.push(`${label} ${id}: drawn ${!!p} played, ${!!q} sought`); continue; } if (!p) continue;
    const kind = p[3] === 'stand' && q[3] === 'stand' && !p[5] && !q[5] ? 'stand' : p[3] === 'leg' && q[3] === 'leg' ? 'leg' : 'other', d = dist(p, q);
    worst[kind] = Math.max(worst[kind], d);
    if (d > TOL[kind]) bad.push(`${label} ${id}: ${kind} ${p[3]}/${q[3]} ${d.toFixed(2)} m apart`);
    else if (kind === 'stand' && p[4] !== q[4]) bad.push(`${label} ${id}: clip ${p[4]} played, ${q[4]} sought`); }
  const sa = new Map(A.scenes), sb = new Map(Bs.scenes);
  for (const id of new Set([...sa.keys(), ...sb.keys()])) { const x = sa.get(id), y = sb.get(id);
    if (!x || !y) { bad.push(`${label} scene ${id}: ${x ? 'played only' : 'sought only'}`); continue; }
    const hx = x.map(f => f[0]).sort().join(), hy = y.map(f => f[0]).sort().join();
    if (hx !== hy) { bad.push(`${label} scene ${id}: figures ${x.length} played, ${y.length} sought`); continue; }
    for (const f of x) { const g = y.find(z => z[0] === f[0]), d = Math.hypot(f[1] - g[1], f[2] - g[2]); worst.figure = Math.max(worst.figure, d); if (d > TOL.figure) bad.push(`${label} scene ${id} ${f[0]}: ${d.toFixed(2)} m apart`); } }
  if (A.board !== Bs.board) bad.push(`${label}: board differs`);
  if (A.events.join() !== Bs.events.join()) bad.push(`${label}: events differ (${A.events.length} played, ${Bs.events.length} sought)`);
  for (const [k, v] of Object.entries(A.panels)) if (v !== Bs.panels[k]) bad.push(`${label}: panel ${k} differs`);
  if (A.fx !== Bs.fx) bad.push(`${label}: the sets' effects differ (${A.fx} played, ${Bs.fx} sought)`);
  for (const P of [A, Bs]) { const late = [...P.events, ...P.markers, ...P.replays, ...P.menu, ...P.missed].filter(id => !(S.first.get(id) <= P.minute + 1e-6));
    if (late.length) bad.push(`${label}: ${late.length} shown before publication at ${P.minute.toFixed(3)} (first ${late[0]} published ${S.first.get(late[0])?.toFixed(3) ?? 'never'})`); }
  return { bad, worst };
}

// ── the walkers near the target after a landing (tapescenario's measure, judged here)
// (a step is a pop when its own travel can't account for it: over 2 m, plus what the frame's island seconds allow at its pace — 20 m/s
// on a trip's legs, a ride or a cab; 3 m/s standing, stepping or walking to a spot — so a scooter at 10x is no pop, a cut is)
const JITTER = ms => `new Promise(r => { const R = window.__record, T = window.__city.controls.target, last = new Map(), out = { frames: 0, walkers: 0, pops: [], dips: [] }; const t0 = performance.now(); let m0 = R.player.minute;
  (function f() { out.frames++; const ids = new Set(), dI = Math.max(0, R.player.minute - m0) * 60; m0 = R.player.minute;
    for (const [id, a] of R.draw.agents?.map ?? []) { const w = a.w; if (!w || w.gone || Math.hypot(w.p[0] - T.x, w.p[2] - T.z) > 50) { last.delete(id); continue; } ids.add(id); const p = last.get(id);
      if (p) { const d = Math.hypot(w.p[0] - p[0], w.p[2] - p[2]), dy = Math.abs(w.p[1] - p[1]); if (d > 2 + (a.mode === 'leg' ? 20 : 3) * dI) out.pops.push({ id, m: +d.toFixed(2), minute: +R.player.minute.toFixed(2), mode: a.mode, islandS: +dI.toFixed(2) }); if (dy > .4) out.dips.push({ id, dy: +dy.toFixed(2), minute: +R.player.minute.toFixed(2), mode: a.mode }); }
      last.set(id, [w.p[0], w.p[1], w.p[2]]); }
    out.walkers = Math.max(out.walkers, ids.size); if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else r(out); })(); })`;
const centre = (B, js) => B.ev(`(() => { const n = ${js}; if (!n) return null; const r = n.getBoundingClientRect(); return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`);
async function press(B, p) { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); }
const pipOf = id => `[...document.querySelectorAll('#record-player .r-tape-mk')].find(b => b.dataset.ids.split(',').includes('${id}'))`;
async function clickMarker(B, id) {
  const p = await centre(B, pipOf(id)); if (!p) return { ok: false, why: 'no pip' };
  await press(B, p); await sleep(350);
  const n = await B.ev(`(${pipOf(id)})?.dataset.ids.split(',').length ?? 0`);
  if (n > 1) { const q = await centre(B, `document.querySelector('#r-tape-pop [data-marker="${id}"]')`); if (!q) return { ok: false, why: 'no row in the list' }; await press(B, q); }
  return { ok: true };
}
const VISIT = `(() => { const t = window.__recordUI.tape; return { v: t.visit, log: t.log.visits.at(-1) ?? null, minute: window.__record.player.minute }; })()`;
async function untilPlay(B, timeout = 20000) { const t0 = Date.now(); let s = null; while (Date.now() - t0 < timeout) { s = await B.ev(VISIT); if (s.log && (s.log.landed || s.log.cancelled) && (!s.v || s.v.phase === 'play')) return s; await sleep(100); } return s; }
// C1-9b-ui's listed pops and jumps (its commit message): seed → minutes; the marker whose replay starts nearest each is clicked
const LISTED = { 404: [4680.03, 7025.5], 405: [2705.17, 7560.01], 406: [2705.42] };

const result = { seeds: SEEDS, plant: PLANT, steps: {} }, step = (k, ok, o, all = null) => { result.steps[k] = { ok, ...o, ...(all ? { all } : {}) }; console.log(`${ok ? 'PASS' : 'FAIL'} ${k} ${JSON.stringify(o).slice(0, 1500)}`); };
const server = await serve();
let B = null;
try {
  B = await chrome();
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  if (want('hours')) {
    const out = { compared: 0, bad: [], worst: { stand: 0, leg: 0, other: 0, figure: 0 }, ms: 0 }, t0 = Date.now();
    for (const seed of SEEDS) { const S = season(seed);
      await open(B, seed, `tod=day&recordPaused=1&recordAt=0&${FAR}`);
      for (let H = 0; H <= S.bounds.to; H += EVERY) {
        if (B.errors.length) { out.bad.push(`${seed}: page error ${B.errors[0]}`); break; }
        const p = await playTo(B, H, LEAD, 60), A = await B.ev(SNAP), q = await seekTo(B, p), Bs = await B.ev(SNAP);
        if (Math.abs(q - p) > 1e-6) out.bad.push(`${seed}@${H}: sought ${q}, paused ${p}`);
        const c = compare(A, Bs, S, `${seed}@${p.toFixed(2)}`); out.compared++; out.bad.push(...c.bad); for (const k in c.worst) out.worst[k] = Math.max(out.worst[k], c.worst[k]);
      } }
    out.ms = Date.now() - t0;
    for (const k in out.worst) out.worst[k] = +out.worst[k].toFixed(3);
    step('hours', out.compared > 0 && out.bad.length === 0, { compared: out.compared, every: EVERY, worst: out.worst, nBad: out.bad.length, bad: out.bad.slice(0, 12), realSeconds: Math.round(out.ms / 1000) }, out.bad);
  }
  if (want('scenes')) {
    const out = { compared: 0, figures: 0, bad: [], worst: { stand: 0, leg: 0, other: 0, figure: 0 } };
    for (const seed of SEEDS) { const S = season(seed);
      await open(B, seed, `tod=night&recordPaused=1&recordAt=${S.nights[0] * DAY + 1260}&${FAR}`);
      for (const n of (PLANT ? S.nights.slice(1, 3) : S.nights)) { const sc = S.planner.night(n).scenes.find(s => s.beat === 'fight' || s.beat === 'arrest'); if (!sc) continue;
        for (const at of [(sc.start + sc.end) / 2, sc.end + 3 / 60]) {
          const p = await playTo(B, at, at - sc.start + .25, 10), A = await B.ev(SNAP), q = await seekTo(B, p), Bs = await B.ev(SNAP);
          const c = compare(A, Bs, S, `${seed}/n${n}@${p.toFixed(3)}`); out.compared++; out.figures += A.scenes.reduce((k, s) => k + s[1].length, 0); out.bad.push(...c.bad);
          for (const k in c.worst) out.worst[k] = Math.max(out.worst[k], c.worst[k]); } } }
    for (const k in out.worst) out.worst[k] = +out.worst[k].toFixed(3);
    step('scenes', out.compared > 0 && out.figures > 0 && out.bad.length === 0, { compared: out.compared, figures: out.figures, worst: out.worst, nBad: out.bad.length, bad: out.bad.slice(0, 12) }, out.bad);
  }
  if (want('clicks')) {
    const out = { clicked: 0, landed: 0, walkers: 0, pops: [], dips: [], missed: [] };
    for (const seed of SEEDS) { const S = season(seed), kinds = new Map();
      for (const M of S.all) if (!kinds.has(M.kind)) kinds.set(M.kind, M);
      const pick = new Map([...kinds.values()].map(M => [M.id, M]));
      for (const t of LISTED[seed] ?? []) { const M = S.all.reduce((b, M) => Math.abs(M.replayStart - t) < Math.abs(b.replayStart - t) ? M : b); pick.set(M.id, M); }
      for (const M of (PLANT ? [...pick.values()].slice(0, 2) : pick.values())) {
        const pub = S.first.get(M.id) ?? M.minute, at = +(Math.min(S.bounds.to, pub + 5)).toFixed(3), night = (at % DAY) >= 1200 || (at % DAY) < 360;
        await open(B, seed, `tod=${night ? 'night' : 'day'}&recordPaused=1&recordAt=${at}&recordSpeed=10&tv=0`);
        const c = await clickMarker(B, M.id); out.clicked++; if (!c.ok) { out.missed.push(`${seed} ${M.kind} ${M.id}: ${c.why}`); continue; }
        const v = await untilPlay(B); if (!v?.log?.landed) { out.missed.push(`${seed} ${M.kind} ${M.id}: no landing`); continue; } out.landed++;
        const J = await B.ev(JITTER(3000), true, 30000); out.walkers += J.walkers;
        out.pops.push(...J.pops.map(p => ({ seed, marker: `${M.kind} ${M.id}`, ...p }))); out.dips.push(...J.dips.map(p => ({ seed, marker: `${M.kind} ${M.id}`, ...p })));
      } }
    step('clicks', out.landed > 0 && out.landed === out.clicked && !out.pops.length && !out.dips.length, { clicked: out.clicked, landed: out.landed, walkers: out.walkers, pops: out.pops.length, dips: out.dips.length, examples: [...out.pops, ...out.dips].slice(0, 10), missed: out.missed });
  }
} catch (e) { step('run', false, { error: String(e && e.stack || e).slice(0, 800) }); }
finally { await B?.close(); server?.kill(); }
await fs.mkdir(OUT, { recursive: true }).catch(() => {});
await fs.writeFile(path.join(OUT, `seekscenario${PLANT ? '-plant-' + PLANT : ''}-${SEEDS.join('-')}.json`), JSON.stringify(result, null, 1)).catch(() => {});
const ok = Object.values(result.steps).every(s => s.ok);
console.log(ok ? 'seekscenario PASS' : 'seekscenario FAIL');
process.exit(ok ? 0 : 1);
