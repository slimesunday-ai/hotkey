// C2-cast · SEEKSCENARIO'S SCENES STEP, EACH PICTURE PAUSED. tools/seekscenario.mjs --only scenes, its own code (season, the picture,
// the comparison, the minutes it compares), with one difference: its play leg waits until the record has paused at the minute (up to
// 120 s; seekscenario polls 400 × 25 ms, and a play leg of over ~1.4 island minutes at 10x is still running when it gives up: the played
// picture is then taken while playing, the seek lands while playing, and the sought picture is taken ~0.03-0.06 island minutes later).
// Each pair is then two paused pictures at the same minute, and the minutes are reported.
//   node style/city/tools/seekscenes.mjs --port 5974 [--seeds 404]
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
const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-cast')));
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
  for (let k = 0; k < 4800 && await B.ev('window.__record.player.running'); k++) await sleep(25);
  if (await B.ev('window.__record.player.running')) throw new Error('the play to ' + to + ' did not pause in 120 s');
  await frames(B, 6);
  return B.ev('window.__record.player.minute');
}
async function seekTo(B, m) { await typeMinute(B, m); await frames(B, 12); await sleep(150); if (await B.ev('window.__record.player.running')) throw new Error('playing after the seek to ' + m); return B.ev('window.__record.player.minute'); }

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

const result = { seeds: SEEDS, steps: {} }, step = (k, ok, o, all = null) => { result.steps[k] = { ok, ...o, ...(all ? { all } : {}) }; console.log(`${ok ? 'PASS' : 'FAIL'} ${k} ${JSON.stringify(o).slice(0, 1500)}`); };
const server = await serve();
let B = null;
try {
  B = await chrome();
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const out = { compared: 0, figures: 0, bad: [], worst: { stand: 0, leg: 0, other: 0, figure: 0 }, minutes: [] };
  for (const seed of SEEDS) { const S = season(seed);
    await open(B, seed, `tod=night&recordPaused=1&recordAt=${S.nights[0] * DAY + 1260}&${FAR}`);
    for (const n of S.nights) { const sc = S.planner.night(n).scenes.find(s => s.beat === 'fight' || s.beat === 'arrest'); if (!sc) continue;
      for (const at of [(sc.start + sc.end) / 2, sc.end + 3 / 60]) {
        const p = await playTo(B, at, at - sc.start + .25, 10), A = await B.ev(SNAP), q = await seekTo(B, p), Bs = await B.ev(SNAP);
        out.minutes.push([+p.toFixed(4), +A.minute.toFixed(4), +Bs.minute.toFixed(4)]);
        const c = compare(A, Bs, S, `${seed}/n${n}@${p.toFixed(3)}`); out.compared++; out.figures += A.scenes.reduce((k, s) => k + s[1].length, 0); out.bad.push(...c.bad);
        for (const k in c.worst) out.worst[k] = Math.max(out.worst[k], c.worst[k]); } } }
  for (const k in out.worst) out.worst[k] = +out.worst[k].toFixed(3);
  step('scenes', out.compared > 0 && out.figures > 0 && out.bad.length === 0, { compared: out.compared, figures: out.figures, worst: out.worst, nBad: out.bad.length, bad: out.bad.slice(0, 12), sameMinute: out.minutes.every(([p, a, b]) => a === b) }, out.bad);
  result.minutes = out.minutes;
} catch (e) { step('run', false, { error: String(e && e.stack || e).slice(0, 800) }); }
finally { await B?.close(); server?.kill(); }
await fs.mkdir(OUT, { recursive: true }).catch(() => {});
await fs.writeFile(path.join(OUT, `seekscenes-${SEEDS.join('-')}.json`), JSON.stringify(result, null, 1)).catch(() => {});
const ok = Object.values(result.steps).every(s => s.ok);
console.log(ok ? 'seekscenes PASS' : 'seekscenes FAIL');
process.exit(ok ? 0 : 1);
