// C1-6 · THE 9:05 SHOW, WATCHED: one headless-Chrome run over seed 404's fourteen nights (and 405, 406 with --seeds) on the record path,
// driven with real input on the player's own controls (the night picker, "Go to show", the speed, play/pause).
//   node style/city/tools/showscenario.mjs --port 5960 [--seeds 404,405,406] [--speed 10] [--out <dir>] [--quick] [--only shows]
// Steps, in order; the first that fails stops the run (no shots of a broken state):
//   1 shows     every night of every seed: "Go to show", played at --speed to the show's close. Logged: every scene the page staged
//               (stage/record.js log(): kind, variant, actors, stand-ins and their looks, clips, the minutes it was seen, where). Checked
//               against show-plan.js's list, computed here in node from the same feed: every scene staged, by its kind (its kind and
//               variant, a clip of its kind; the named agent itself for a named play), at its place, inside its window (a fight, an
//               arrest and lay low stay on until the close); no hooded name: a stand-in is keyed by no agent id, wears no hooded
//               agent's own look, every actor is in show.seen; per frame, no hooded agent drawn during the show. The reveal (D4 (c)):
//               per frame, the store holds a night's result exactly from its scene's end, and the board is held until the close
//   2 replay    one night again from its frame ("Go to show" once more): the same scenes, kinds, actors and stand-in counts
//   3 probe     stage/recordprobe.mjs on the record: the stage's gate on every night of the first seed with a fight or an arrest
//   4 recheck   C1-3's and C1-4's scenarios (recordscenario, routinescenario), run as they are, their shots to --out
//   5 frames    frame time p95 during a show at 10× vs the same view with no sim
//   6 shots     one night's show (four moments), two hustle variants and a collar, on 2×2 sheets, every tile labelled
// It serves this checkout itself (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, choose, click, clickText, typeMinute, serve } from './recordscenario.mjs';
import { createShowPlanner } from '../simstate/record/show-plan.js';
import { STANDS, CITY_PLACES, HOUSE_LOTS } from '../simstate/record/places.js';
import { clipsFor } from '../stage/show-clips.js';
import { PROBE_ON, PROBE_OFF, PROBE_READ, GATE, gate } from '../stage/recordprobe.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const ONLY = arg('only', null), PORT = +arg('port', 0), SEEDS = arg('seeds', '404').split(',').map(Number), SPEED = +arg('speed', 10), QUICK = process.argv.includes('--quick');
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c1-6'))), BASE = `http://127.0.0.1:${PORT}`;
const FEED = s => `/core/runs/${s}-A/feed.jsonl`, sleep = ms => new Promise(r => setTimeout(r, ms)), DAY = 1440;
const hhmm = m => { const x = ((Math.floor(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

function framesOf(seed) {
  const file = path.join(ROOT, FEED(seed).slice(1));
  if (!fss.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  return fss.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}
// ── in the page, per frame through one show: hooded walkers drawn, the store's results against their scenes' ends, the board held
const SAMPLER = (n, seen) => `(async () => { const { sim } = await import('/style/city/simstate/store.js'), R = window.__record, plan = R.draw.planner.night(${n}), seen = new Set(${JSON.stringify(seen)});
  const due = new Map(plan.openingIds.map(id => [id, plan.start])); for (const s of plan.scenes) for (const id of s.revealIds) due.set(id, Math.min(due.get(id) ?? Infinity, s.end));
  // (the hooded: absent from show.seen and not jailed — placement's 'hidden' rows; a jailed agent stands on Iron Island)
  const roster = [...R.draw.agents.map.keys()], W = window.__c16 = { frames: 0, hoodedDrawn: [], early: [], late: [], board: 0, boardSig: null, looks: {}, done: false }, since = new Map();
  const sig = () => JSON.stringify(sim.board()?.agents?.map(a => [a.id, a.jailed, a.heat, a.cash]) ?? null);
  const f = () => { if (W.done) return; const m = R.player.minute;
    if (m >= plan.start && m < plan.end) { W.frames++;
      for (const id of roster) { if (seen.has(id) || !R.draw.stateAt(id, m).hidden) { since.delete(id); continue; }
        if (!since.has(id)) since.set(id, m); W.looks[id] = R.draw.agents.map.get(id)?.look ?? null;
        // (a walker already drawn when its row turns hidden goes on the next drive: a frame's grace, 0.05 island minutes)
        if (R.draw.agents.map.get(id)?.w && m > since.get(id) + .05) W.hoodedDrawn.push([id, +m.toFixed(2)]); }
      const have = new Set((sim.record()?.events ?? []).map(e => e.id));
      for (const [id, t] of due) { if (have.has(id) && m < t - 1e-9) W.early.push([id, +m.toFixed(3), t]); if (!have.has(id) && m >= t + .02) W.late.push([id, +m.toFixed(3), t]); }
      const s = sig(); if (W.boardSig === null) W.boardSig = s; else if (s !== W.boardSig && m < plan.end - .02) W.board++; }
    requestAnimationFrame(f); }; requestAnimationFrame(f); return roster.length; })()`;
const READ = `(() => { const W = window.__c16; W.done = true; return { frames: W.frames, hoodedDrawn: W.hoodedDrawn.slice(0, 5), nHooded: W.hoodedDrawn.length, early: W.early.slice(0, 5), nEarly: W.early.length, late: W.late.slice(0, 5), nLate: W.late.length, board: W.board, looks: W.looks,
  log: window.__record.draw.scenes.log(), roster: [...window.__record.draw.agents.map.keys()] }; })()`;

// ── the log against the plan, one night
function judge(plan, show, P, seed) {
  const errors = [], byId = new Map(P.log.map(l => [l.id, l])), roster = P.roster, hoodedLooks = new Set(Object.values(P.looks).filter(v => v !== null));
  const near = (sc, L) => { if (L.x === null) return false; const at = sc.place.standPlace ?? sc.place.cityPlace;
    if (sc.place.lot) { const lot = HOUSE_LOTS.find(l => l.id === sc.place.cityPlace); return !!lot && Math.hypot(L.x - lot.x, L.z - lot.z) <= 15; }
    const spots = STANDS[at] ?? [], p = CITY_PLACES[at]; return spots.some(s => Math.hypot(L.x - s.x, L.z - s.z) <= 4) || (!!p && Math.hypot(L.x - p.x, L.z - p.z) <= 25); };
  const stays = sc => sc.beat === 'fight' || sc.beat === 'arrest' || sc.kind === 'laylow';
  for (const sc of plan.scenes) {
    const L = byId.get(sc.id), label = `${seed}/n${plan.night} ${sc.id.split(':').slice(1).join(':')} (${sc.kind}${sc.variant ? ':' + sc.variant : ''})`;
    if (!L) { errors.push(`${label}: not staged`); continue; }
    if (L.kind !== sc.kind || (L.variant ?? null) !== (sc.variant ?? null)) errors.push(`${label}: staged as ${L.kind}:${L.variant}`);
    if (L.first < sc.start - .02 || L.first >= sc.end) errors.push(`${label}: first seen ${L.first.toFixed(2)} outside ${sc.start.toFixed(2)}–${sc.end.toFixed(2)}`);
    if (L.last > (stays(sc) ? plan.end : sc.end) + .05) errors.push(`${label}: still on at ${L.last.toFixed(2)}`);
    if (sc.kind !== 'results' && !near(sc, L)) errors.push(`${label}: staged at ${L.x},${L.z}, not at ${sc.place.standPlace ?? sc.place.cityPlace}`);
    const kinds = clipsFor(sc);
    if (sc.kind !== 'results' && !(sc.kind === 'laylow' && L.props) && !L.clips.some(c => kinds.includes(c))) errors.push(`${label}: no clip of its kind (${L.clips.join('/') || 'none'})`);
    if (sc.beat === 'ambient' && sc.kind !== 'hooded' && !L.actors.includes(sc.publicActors[0])) errors.push(`${label}: its agent not staged in it`);
    if ((sc.kind === 'hooded' || sc.hoodedCount) && !L.standIns.length) errors.push(`${label}: no anonymous stand-in for ${sc.hoodedCount} hooded`);
    for (const a of L.actors) if (!Object.hasOwn(show.seen, a)) errors.push(`${label}: hooded agent ${a} drawn as itself`);
    for (const h of L.standIns) if (roster.some(id => new RegExp(`(^|[^a-z0-9])${id}([^0-9]|$)`).test(h))) errors.push(`${label}: stand-in ${h} carries an agent id`);
    for (const k of L.looks) if (hoodedLooks.has(k)) errors.push(`${label}: stand-in wears a hooded agent's own look (${k})`);
  }
  for (const L of P.log) if (!plan.scenes.some(s => s.id === L.id)) errors.push(`${seed}/n${plan.night} ${L.id}: staged, not in the plan`);
  if (P.nHooded) errors.push(`${seed}/n${plan.night}: hooded agents drawn during the show ${JSON.stringify(P.hoodedDrawn)}`);
  if (P.nEarly) errors.push(`${seed}/n${plan.night}: ${P.nEarly} results in the store before their scene paid off ${JSON.stringify(P.early)}`);
  if (P.nLate) errors.push(`${seed}/n${plan.night}: ${P.nLate} results missing after their scene ${JSON.stringify(P.late)}`);
  if (P.board) errors.push(`${seed}/n${plan.night}: the board changed ${P.board} times before the close`);
  return errors;
}
const sig = log => log.map(l => [l.id, l.kind, l.variant, [...l.actors].sort().join(','), l.standIns.length]).sort((a, b) => a[0] < b[0] ? -1 : 1);

// play at `speed` with the player's own controls until the island minute reaches `until`, then pause
async function playTo(B, until, speed, timeout = 900000) {
  const t0 = Date.now(); await ready(B);
  if (await B.ev('window.__record.player.speed') !== speed) await choose(B, '#record-player select[aria-label="Playback speed"]', speed);
  if (!(await B.ev('window.__record.player.running'))) await click(B, '#record-player button[aria-label="Play or pause"]');
  while (Date.now() - t0 < timeout) {
    const m = await B.ev('window.__record?.player.minute ?? null', false).catch(() => null);
    if (m === null) { await ready(B); continue; }
    if (m >= until) { if (await B.ev('window.__record.player.running')) await click(B, '#record-player button[aria-label="Play or pause"]'); return m; }
    await sleep(200);
  }
  throw new Error(`timeout playing to minute ${until}`);
}
async function playShow(B, n, seen, speed) {
  await ready(B);
  await choose(B, '#record-player select[aria-label="Night to replay"]', n);
  await clickText(B, 'Go to show'); await ready(B); await sleep(400);
  await B.ev('window.__record.draw.scenes.clearLog()');
  await B.ev(SAMPLER(n, seen));
  const end = await B.ev(`window.__record.draw.planner.night(${n}).end`);
  await playTo(B, end + .1, speed);
  return B.ev(READ);
}

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/showscenario.mjs --port <port>'); process.exit(2); }
  await fs.mkdir(OUT, { recursive: true });
  const server = await serve(), result = { seeds: SEEDS, speed: SPEED, steps: [], nights: [] }, tiles = [];
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail).slice(0, 1500) : ''}`); if (!ok) throw Object.assign(new Error(name + ' failed'), { step: true }); };
  let B = null; const clips = new Map(), counts = {}, errors = [];
  try {
    B = await chrome();
    // 1 · every night, every seed
    for (const seed of SEEDS) {
      const frames = framesOf(seed), planner = createShowPlanner(frames), nights = frames.filter(f => f.step.kind === 'night').map(f => f.day);
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&recordPaused=1&tod=night&simtod=0` });
      await ready(B);
      for (const n of QUICK ? nights.slice(0, 2) : nights) {
        const plan = planner.night(n), show = frames.find(f => f.step.kind === 'night' && f.day === n).events.find(e => e.type === 'show');
        const t0 = Date.now(), P = await playShow(B, n, Object.keys(show.seen), SPEED), errs = judge(plan, show, P, seed);
        errors.push(...errs);
        for (const L of P.log) { for (const c of L.clips) clips.set(c, (clips.get(c) || 0) + 1); const k = L.kind + (L.variant ? ':' + L.variant : ''); counts[k] = (counts[k] || 0) + 1; }
        result.nights.push({ seed, night: n, scenes: plan.scenes.length, staged: P.log.length, frames: P.frames, errors: errs.length, secs: +((Date.now() - t0) / 1000).toFixed(1) });
        console.log(`  ${seed} night ${n}: ${P.log.length}/${plan.scenes.length} scenes staged · ${P.frames} frames · ${errs.length ? 'FAIL ' + errs.slice(0, 3).join(' | ') : 'ok'} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }
    result.kinds = counts; result.clips = Object.fromEntries([...clips].sort());
    // (--only shows: step 1 alone, for looking again; the run then reports FAIL: its steps did not all run)
    if (ONLY === 'shows') { result.steps.push({ name: 'shows', ok: errors.length === 0, nErrors: errors.length, errors: errors.slice(0, 30), kinds: counts, clips: result.clips }); throw new Error('--only shows'); }
    step('shows', errors.length === 0, { nights: result.nights.length, scenes: result.nights.reduce((s, n) => s + n.scenes, 0), staged: result.nights.reduce((s, n) => s + n.staged, 0), kinds: counts, clipsUsed: clips.size, errors: errors.slice(0, 12), nErrors: errors.length });
    // 2 · a replayed night: the same scenes
    const seed = SEEDS[0], frames = framesOf(seed), planner = createShowPlanner(frames);
    const busy = frames.filter(f => f.step.kind === 'night').map(f => f.day).find(n => planner.night(n).scenes.some(s => s.beat === 'fight') && planner.night(n).scenes.some(s => s.beat === 'arrest')) ?? 2;
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&recordPaused=1&tod=night&simtod=0` }); await ready(B);
    const seen = Object.keys(frames.find(f => f.step.kind === 'night' && f.day === busy).events.find(e => e.type === 'show').seen);
    const r1 = await playShow(B, busy, seen, SPEED), r2 = await playShow(B, busy, seen, SPEED), s1 = sig(r1.log), s2 = sig(r2.log);
    step('replay', JSON.stringify(s1) === JSON.stringify(s2) && s1.length === planner.night(busy).scenes.length, { seed, night: busy, scenes: s1.length, same: JSON.stringify(s1) === JSON.stringify(s2), differ: s1.filter((x, i) => JSON.stringify(x) !== JSON.stringify(s2[i])).slice(0, 4) });
    // 3 · the stage probe on the record: every night of the first seed with a fight or an arrest, each from a fresh page at 9:05
    const focus = frames.filter(f => f.step.kind === 'night').map(f => f.day).filter(n => planner.night(n).scenes.some(s => s.beat === 'fight' || s.beat === 'arrest'));
    const sum = Object.fromEntries([...GATE, 'removals', 'falls', 'overlapFrames'].map(k => [k, 0])), per = [];
    for (const n of QUICK ? focus.slice(0, 1) : focus) {
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&recordPaused=1&tod=night&simtod=0&recordAt=${n * DAY + 1264.9}` }); await ready(B); await sleep(1500);
      await B.ev(PROBE_ON);
      await playTo(B, planner.night(n).end + .3, SPEED); await sleep(2500);
      const P = await B.ev(PROBE_READ); await B.ev(PROBE_OFF);
      for (const k of Object.keys(sum)) sum[k] += P[k] || 0; per.push({ night: n, ...Object.fromEntries(GATE.map(k => [k, P[k]])), aimed: P.aimed, lastOverlap: P.lastOverlap, lastCrowd: P.lastCrowd, lastInside: P.lastInside, inView: P.inView });
      console.log(`  probe night ${n}: ${JSON.stringify(P).slice(0, 400)}`);
    }
    const g = gate(sum); result.probe = { sum, per };
    // (the probe's gate is reported with its numbers; a failing number is an open item, not a reason to stop the shots)
    result.steps.push({ name: 'probe', ok: g.ok, nights: per.length, ...sum, failing: g.failing }); console.log(`${g.ok ? 'PASS' : 'FAIL'} probe ${JSON.stringify({ nights: per.length, ...sum })}`);
    // 4 · C1-3's and C1-4's scenarios, as they are (their own servers on this port, their shots out of the tree)
    for (const [name, port] of [['recordscenario', PORT], ['routinescenario', PORT + 2]]) {
      const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(ROOT, `style/city/tools/${name}.mjs`), '--port', String(port), '--out', path.join(OUT, 'recheck', name)], { cwd: ROOT, encoding: 'utf8', timeout: 3600000 });
      const tail = (r.stdout || '').trim().split('\n').filter(l => /^(PASS|FAIL)|SCENARIO/.test(l)).map(l => l.slice(0, 300));
      result.steps.push({ name, ok: r.status === 0, secs: Math.round((Date.now() - t0) / 1000), tail }); console.log(`${r.status === 0 ? 'PASS' : 'FAIL'} ${name} (${Math.round((Date.now() - t0) / 1000)} s)\n  ${tail.join('\n  ')}`);
    }
    // 5 · frames: a show playing at 10× vs the same view with no sim
    const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`);
    const view = 'cam=100,20,-245&look=88,0.6,-262&tod=night&simtod=0';
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&recordAt=${busy * DAY + 1265.5}&recordSpeed=10&${view}` }); await ready(B); await sleep(4000); const rec = await measure();
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}` });
    for (let t = 0; t < 240 && !(await B.ev('document.title', false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
    await sleep(5000); const none = await measure();
    result.steps.push({ name: 'frames', ok: true, record: rec, noSim: none, bar: 16.8 }); console.log(`PASS frames ${JSON.stringify({ record: rec, noSim: none })}`);
    // 6 · the shots: a night's show (four moments), two hustle variants, a collar
    const plan = planner.night(busy), at = async (minute, sc, o = {}) => {
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&recordPaused=1&tod=night&simtod=0&recordAt=${minute - .4}` }); await ready(B);
      await typeMinute(B, minute); await sleep(2500);
      const w = await B.ev(`(() => { const L = window.__record.draw.scenes.live.get(${JSON.stringify(sc.id)}); return L?.where ? { x: L.where.x, z: L.where.z } : null; })()`);
      const p = w ?? (sc.publicActors[0] ? await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(sc.publicActors[0])}); return a?.w ? { x: a.w.p[0], z: a.w.p[2] } : null; })()`) : null);
      if (p) await B.ev(`(() => { const c = window.__city; c.controls.target.set(${p.x}, .8, ${p.z}); c.camera.position.set(${p.x + (o.side ?? 4)}, ${o.h ?? 6}, ${p.z + (o.back ?? 8)}); c.controls.update?.(); return true; })()`);
      await sleep(3500);
      const live = await B.ev(`(() => { const L = window.__record.draw.scenes.log().find(l => l.id === ${JSON.stringify(sc.id)}); return L ? { clips: L.clips, standIns: L.standIns.length, actors: L.actors } : null; })()`);
      const file = path.join(OUT, `${o.key}.png`); const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64'));
      return { file, live, p };
    };
    const label = (sc, m, what, live) => `${seed} night ${sc.night} ${hhmm(m)} · ${what} · ${live ? (live.clips.slice(0, 3).join('/') || '-') : 'not staged'} · ${live ? 'PASS' : 'FAIL'}`;
    const pick = (f) => plan.scenes.find(f);
    const moments = [
      ['open', pick(s => s.beat === 'ambient' && s.kind === 'hustle'), 'a hustle as the show opens'],
      ['fight', pick(s => s.beat === 'fight'), 'a fight'],
      ['arrest', pick(s => s.beat === 'arrest'), 'an arrest'],
      ['late', [...plan.scenes].reverse().find(s => s.beat === 'ambient' && s.kind !== 'hooded' && s.kind !== 'results'), 'late in the show'],
    ].filter(x => x[1]);
    for (const [key, sc, what] of moments) { const m = key === 'fight' || key === 'arrest' ? sc.end - .3 : (sc.start + sc.end) / 2, r = await at(m, sc, { key: `night-${key}`, h: key === 'fight' ? 9 : 6, back: key === 'fight' ? 11 : 7 }); tiles.push({ file: r.file, label: `${label(sc, m, `${what}: ${sc.kind}${sc.variant ? ' ' + sc.variant : ''}`, r.live)}` }); }
    // two hustle variants (another night if this one lacks them) and a collar
    const all = frames.filter(f => f.step.kind === 'night').map(f => planner.night(f.day));
    for (const v of ['stickup', 'mugging']) { const sc = all.flatMap(p => p.scenes).find(s => s.variant === v); if (!sc) continue; const m = sc.start + .9, r = await at(m, sc, { key: `hustle-${v}`, h: 4.5, back: 6, side: 3 }); tiles.push({ file: r.file, label: label(sc, m, `hustle: ${v} (${sc.publicActors[0]})`, r.live) }); }
    const collar = all.flatMap(p => p.scenes).find(s => s.kind === 'collar' && s.beat === 'fight') ?? all.flatMap(p => p.scenes).find(s => s.kind === 'arrest');
    if (collar) { const m = collar.end - .2, r = await at(m, collar, { key: 'collar', h: 7, back: 9 }); tiles.push({ file: r.file, label: label(collar, m, `a collar (${collar.kind})`, r.live) }); }
    step('shots', tiles.length >= 7 && tiles.every(t => t.label.endsWith('PASS')), { tiles: tiles.map(t => t.label) });
  } catch (e) { result.error = String(e.message || e); if (!e.step) console.log('FAIL ' + result.error + (e.stack ? '\n' + e.stack.split('\n').slice(1, 4).join('\n') : '')); }
  finally {
    result.pageErrors = B?.errors.slice(0, 5) ?? [];
    const sheets = [];
    for (let k = 0; k < tiles.length; k += 4) {
      const sheet = path.join(OUT, `sheet-${k / 4 + 1}.jpg`), py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(tiles.slice(k, k + 4))], { encoding: 'utf8' });
      if (py.status) console.log('sheet: ' + py.stderr); else sheets.push(sheet);
    }
    result.sheets = sheets; result.tiles = tiles; result.errors = errors;
    await fs.writeFile(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
    await B?.close(); server?.kill();
    const ok = !result.error && result.steps.length >= 7 && result.steps.every(s => s.ok);
    console.log(`${ok ? 'SHOWSCENARIO PASS' : 'SHOWSCENARIO FAIL'} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
    process.exitCode = ok ? 0 : 1;
  }
}
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 600, 12, 44
cols = 2 if len(tiles) > 1 else 1; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * (th + bar) + (rows + 1) * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 19)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 11), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
