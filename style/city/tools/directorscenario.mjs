// C1-8 · THE DIRECTOR, WATCHED (C-director's bars, moved to the record path): headless Chrome on ?sim=record, measured on screen.
//   node style/city/tools/directorscenario.mjs --port 5971 [--seeds 404,405,406,407,408] [--out <dir>] [--plant <name>] [--only first,night,day,handback,return,network,frames,shots]
// Steps (each reports its numbers; the run passes when every step passes):
//   1 first      a first visit (a fresh profile, a page opened with no camera of its own, playing) opens in TV mode; a link that names
//                a camera opens with the viewer in control
//   2 night      every fight and arrest of the shows of the seeds, in TV mode (?tv=1, no input): the record sought (the player's API,
//                not input) a beat before the scene, played at 10×, sampled three times inside it. Staged in view = at 2 of the 3
//                samples at least half the scene's drawn figures (the stage's borrowed walkers and stand-ins, else the cut's public
//                actors' walkers within 30 m) are in frame, above the caption / ticker / player bar, and no STATIC solid of the camera's
//                collision world between the camera and their chest or head. Bar: ≥ 80 %. Also: ≤ 2 director cuts in every rolling
//                island minute; no caption text (the DOM's lower third, and every caption the director put up) naming an agent the
//                night's show hides (absent from show.seen)
//   3 day        10 seeded random 10-minute windows (two a seed, 06:00–20:50), TV mode at 10×, polled twice a real second: a day cut
//                is credited when its establishing view showed the moment's place on screen and its close-up showed a subject on
//                screen 0.5 island minutes (30 s at live pace) or more later. Bar: ≥ 70 % of the windows' day cuts
//   4 handback   20 scripted inputs (mouse move, wheel, Shift, a touch, a click, a key), TV mode put on with the 0 key each time and
//                a shot left to start: each ends TV mode in the input's own event (the frame counter at the event = the director's
//                stop), and for the inputs that don't move the camera themselves, the camera holds still afterwards in the map (no
//                drift; a follow the viewer's own click started keeps following its subject, as TV-PLAN's hand-back says)
//   5 return     after a scene (the end of night 2's show in TV mode) and after a morning card's Replay (a real click), the camera
//                ends where the viewer had it (≤ 0.5 m)
//   6 network    only GETs of this server's static files, the feeds and the pinned three.js module
//   7 frames     frame time p95: TV mode on night 2's show at 10× vs the same view with no sim, back to back (rerun once on a miss);
//                bar: TV p95 ≤ 16.8 ms or ≤ 1.15 × no-sim's
//   8 shots      a night fight on the cut, a day sit-down in TV mode, the hand-back: ≤ 2×2 tiles a sheet, labelled with pass / fail
// --plant <away|cutrate|hooded|handback|network|frames>: a violation planted in the page (in memory, never in a source file), on a
// short run (seed 404), to show the step that guards it fails.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, click, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), PLANT = arg('plant', null), ONLY = arg('only', null)?.split(','), want = k => !ONLY || ONLY.includes(k), BASE = `http://127.0.0.1:${PORT}`;
const SEEDS = (arg('seeds', PLANT ? '404' : '404,405,406,407,408')).split(',').map(Number);
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c1-8', PLANT ? 'plant-' + PLANT : '')));
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/', DAY = 1440, sleep = ms => new Promise(r => setTimeout(r, ms));
const FEED = s => `/core/runs/${s}-A/feed.jsonl`;
const { createCutPlanner } = await import('../simstate/record/cut-plan.js');
const { createShowPlanner } = await import('../simstate/record/show-plan.js');

// ── the seasons, read in node: the fights and arrests, the names each night's show hides, the sit-downs
function season(seed) {
  const file = path.join(ROOT, FEED(seed).slice(1));
  if (!fss.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  const frames = fss.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l)), shows = createShowPlanner(frames), cuts = createCutPlanner(frames);
  const nights = [], meets = []; let board = null;
  for (const f of frames) {
    if (f.step.kind === 'night') {
      const show = f.events.find(e => e.type === 'show'), plan = shows.night(f.day);
      const hidden = (board?.agents ?? []).filter(a => !Object.hasOwn(show?.seen ?? {}, a.id)).map(a => a.name).filter(Boolean);
      nights.push({ night: f.day, start: plan.start, end: plan.end, hidden, cuts: cuts.night(f.day),
        scenes: plan.scenes.filter(s => ['fight', 'arrest'].includes(s.beat)).map(s => ({ id: s.id, beat: s.beat, kind: s.kind, start: s.start, end: s.end, actors: s.publicActors, place: s.place })) });
    } else for (const e of f.events ?? []) if (e.type === 'meet' && e.minute % DAY > 400 && e.minute % DAY < 1200) meets.push(e.minute);
    if (f.board !== undefined) board = f.board;
  }
  return { seed, nights, meets };
}
// two seeded random day windows a season (06:00–20:50 of days 1–14)
function windows(seed) { let x = seed * 2654435761 % 4294967296; const rnd = () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return [0, 1].map(() => { const d = 1 + Math.floor(rnd() * 13); return d * DAY + 360 + Math.floor(rnd() * 880); }); }

// ── in the page: what the camera shows of a set of figures, measured from where it is
const SEEN = `(figs) => { const C = window.__city, T = C.THREE, cam = C.camera, W = C.cam?.world, r = C.renderer.domElement.getBoundingClientRect();
  let floor = r.bottom; for (const id of ['r-tv-cap', 'r-ticker', 'record-player']) { const el = document.getElementById(id), b = el && !el.hidden ? el.getBoundingClientRect() : null; if (b && b.height > 0) floor = Math.min(floor, b.top); }
  const V = new T.Vector3(); let seen = 0, blocked = 0, out = 0, unknown = 0;
  for (const f of figs) { let ok = false, why = 'out';
    for (const dy of [1.1, 1.6]) { V.set(f.x, (f.y || 0) + dy, f.z).project(cam); const py = r.top + (1 - V.y) / 2 * r.height;
      if (V.z > 1 || Math.abs(V.x) > .96 || Math.abs(V.y) > .96 || py > floor - 6) continue;
      if (!W?.ready?.(f.x, f.z)) { why = 'unknown'; continue; }
      if (W.ray(cam.position, { x: f.x, y: (f.y || 0) + dy, z: f.z }, 1)) { why = 'blocked'; continue; }
      ok = true; break; }
    if (ok) seen++; else if (why === 'blocked') blocked++; else if (why === 'unknown') unknown++; else out++; }
  return { n: figs.length, seen, blocked, out, unknown }; }`;
const FIGS = `(sceneId, subjects, at) => { const R = window.__record, S = R.draw.scenes?.live?.get(sceneId), out = [];
  if (S) for (const A of S.actors) if (!A.freed && A.w) out.push({ x: A.w.p[0], y: A.w.p[1], z: A.w.p[2], h: A.h });
  for (const id of subjects) { if (out.some(o => o.h === id)) continue; const a = R.draw.agents?.map.get(id); if (a?.w && (!at || Math.hypot(a.w.p[0] - at.x, a.w.p[2] - at.z) < 30)) out.push({ x: a.w.p[0], y: a.w.p[1], z: a.w.p[2], h: id }); }
  return out; }`;
const AT = `(place) => { const P = window.__placesForCheck; if (!place) return null; const lot = P.HOUSE_LOTS.find(l => l.id === place.cityPlace), q = lot ?? P.CITY_PLACES[place.standPlace] ?? P.CITY_PLACES[place.cityPlace]; return q ? { x: q.x, z: q.z } : null; }`;
const PREP = `(async () => { window.__placesForCheck = await import('/style/city/simstate/record/places.js'); window.__dirSeen = ${SEEN}; window.__dirFigs = ${FIGS}; window.__dirAt = ${AT};
  const d = window.__recordUI.director; window.__inp = null; window.__rafN = 0; (function f() { window.__rafN++; requestAnimationFrame(f); })();
  for (const t of ['pointerdown', 'wheel', 'keydown', 'touchstart', 'pointermove']) addEventListener(t, e => { window.__inp = { type: e.type, frame: d.frameN, t: performance.now() }; }, { capture: true });
  return true; })()`;
const PLANTS = {
  away: `setInterval(() => { const d = window.__recordUI.director, C = window.__city; if (d.mode !== 'off') { C.camera.position.y = 600; C.controls.target.set(C.camera.position.x + 900, 600, C.camera.position.z); C.camera.lookAt(C.controls.target); } }, 100)`,
  cutrate: `(() => { let last = null; setInterval(() => { const d = window.__recordUI.director, c = d.current; if (c && c.id !== last) { last = c.id; for (let k = 0; k < 3; k++) setTimeout(() => { d.stop('plant'); d.start('plant'); }, 150 * (k + 1)); } }, 50); })()`,
  hooded: name => `(() => { const tv = window.__recordUI.tv, cap = tv.caption; tv.caption = (f, k) => cap(f ? { ...f, subjects: [...(f.subjects || []), { id: 'plant', name: ${JSON.stringify(name)}, driver: null }] } : f, k); })()`,
  handback: `(() => { const d = window.__recordUI.director; for (const t of ['pointerdown', 'wheel', 'keydown', 'touchstart', 'pointermove']) addEventListener(t, () => queueMicrotask(() => d.start('plant')), { capture: true }); })()`,
  network: `fetch('https://example.com/plant.json').catch(() => {})`,
  frames: `(function f() { const t = performance.now(); while (performance.now() - t < 26); requestAnimationFrame(f); })()`,
};
async function shot(B, file) { const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
async function open(B, seed, q) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&${q}` }); await ready(B);
  for (let t = 0; t < 100 && !(await B.ev('!!window.__recordUI?.director', false).catch(() => false)); t++) await sleep(200);
  await B.ev(PREP); await sleep(800);
}
const plant = async (B, which, extra) => { if (PLANT === which) await B.ev(typeof PLANTS[which] === 'function' ? PLANTS[which](extra) : PLANTS[which], false); };
const nameIn = (text, name) => new RegExp(`(^|[^a-z0-9])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(String(text).toLowerCase());

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/directorscenario.mjs --port <port>'); process.exit(2); }
  await fs.mkdir(OUT, { recursive: true });
  const seasons = SEEDS.map(season), server = await serve(), result = { seeds: SEEDS, plant: PLANT, steps: [] }, tiles = [];
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`); };
  let B = await chrome();
  try {
    // 1 · the first visit, then a link with a camera
    if (!PLANT && want('first')) {
      const n2 = seasons[0].nights[1];
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEEDS[0])}&recordAt=${n2.start - .2}&recordSpeed=10` }); await ready(B);
      for (let t = 0; t < 50 && !(await B.ev('!!window.__recordUI?.director', false).catch(() => false)); t++) await sleep(200);
      const first = await B.ev(`({ mode: window.__recordUI.director.mode, reason: window.__recordUI.director.reason, url: new URLSearchParams(location.search).get('tv') })`);
      await open(B, SEEDS[0], `recordAt=${n2.start - .2}&recordSpeed=10&cam=108,24,-236&look=88,0.6,-262`);
      const deep = await B.ev(`({ mode: window.__recordUI.director.mode, armed: window.__recordUI.director.armed })`);
      step('first', first.mode === 'tv' && first.reason === 'first' && deep.mode === 'off', { first, deepLink: deep });
    }
    // 2 · the nights
    const night = { scenes: 0, inView: 0, fights: [0, 0], arrests: [0, 0], misses: [], cuts: [], captions: [], hooded: [], domCaps: 0, maxRate: 0 };
    let nightShot = null;
    for (const S of (want('night') ? seasons : [])) {
      const list = S.nights.flatMap(n => n.scenes.map(sc => ({ ...sc, night: n.night, hidden: n.hidden })));
      // (a planted run: four scenes; the hooded plant takes them from a night whose show hides someone)
      const todo = PLANT === 'hooded' ? list.filter(s => s.hidden.length).slice(0, 4) : PLANT ? list.slice(0, 4) : list;
      if (!todo.length) continue;
      await open(B, S.seed, `recordAt=${todo[0].start - .25}&recordSpeed=10&tod=night&simtod=0&tv=1`);
      await plant(B, 'away'); await plant(B, 'cutrate'); await plant(B, 'hooded', todo.find(s => s.hidden.length)?.hidden[0] ?? 'nobody'); await plant(B, 'network');
      for (const sc of todo) {
        await B.ev(`(() => { const p = window.__record.player; p.seek(${sc.start - .25}); p.setSpeed(10); p.play(); return true; })()`);
        const samples = [];
        for (const wait of [5000, 3000, 3000]) {
          await sleep(wait);
          const s = await B.ev(`(() => { const d = window.__recordUI.director, at = window.__dirAt(${JSON.stringify(sc.place)}), figs = window.__dirFigs(${JSON.stringify(sc.id)}, ${JSON.stringify(sc.actors)}, at);
            const cap = document.getElementById('r-tv-cap'); return { minute: window.__record.player.minute, mode: d.mode, cut: d.current?.id ?? null, cap: cap && !cap.hidden ? cap.textContent : null, ...window.__dirSeen(figs) }; })()`);
          samples.push(s);
          if (s.cap) { night.domCaps++; for (const nm of sc.hidden) if (nameIn(s.cap, nm)) night.hooded.push({ seed: S.seed, night: sc.night, name: nm, cap: s.cap }); }
        }
        const good = samples.filter(s => s.mode === 'tv' && s.n > 0 && s.seen >= Math.ceil(s.n / 2)).length >= 2;
        night.scenes++; if (good) night.inView++; const k = sc.beat === 'fight' ? night.fights : night.arrests; k[0]++; if (good) k[1]++;
        if (!good) night.misses.push({ seed: S.seed, night: sc.night, id: sc.id, kind: sc.kind, samples: samples.map(s => [+s.minute.toFixed(2), s.mode, s.n, s.seen, s.blocked, s.out, s.unknown]) });
        if (good && !nightShot && sc.beat === 'fight' && !PLANT) nightShot = { file: await shot(B, path.join(OUT, 'night-fight.png')), label: `Seed ${S.seed} night ${sc.night} · ${sc.kind} at ${sc.place.cityPlace} on the cut`, step: 'night' };
      }
      const log = await B.ev(`({ cuts: window.__recordUI.director.log.cuts, captions: window.__recordUI.director.log.captions })`);
      for (const c of log.cuts) night.cuts.push({ seed: S.seed, minute: c.minute });
      for (const c of log.captions) { const n = S.nights.find(n => c.minute >= n.start - .5 && c.minute <= n.end); if (n && c.text) for (const nm of n.hidden) if (nameIn(c.text, nm)) night.hooded.push({ seed: S.seed, night: n.night, name: nm, cap: c.text }); night.captions.push(c.text); }
      // (cut rate over each seed's log: the island minutes only move forward here)
      const ms = log.cuts.map(c => c.minute).sort((a, b) => a - b);
      for (const m of ms) night.maxRate = Math.max(night.maxRate, ms.filter(x => x >= m && x < m + 1 - 1e-9).length);
    }
    const share = night.scenes ? night.inView / night.scenes : 0;
    if (want('night')) step('night', share >= .8, { inView: `${night.inView}/${night.scenes} = ${(share * 100).toFixed(1)}%`, fights: night.fights.join('/'), arrests: night.arrests.join('/'), misses: night.misses.slice(0, 6) });
    if (want('night')) step('cutrate', night.maxRate <= 2, { maxCutsInARollingMinute: night.maxRate, cuts: night.cuts.length });
    if (want('night')) step('hooded', night.hooded.length === 0 && night.captions.length > 0, { captionsChecked: night.captions.length, domCaptionsChecked: night.domCaps, named: night.hooded.slice(0, 4) });
    // 3 · the day
    const day = { cuts: 0, credited: 0, windows: [] };
    if ((!PLANT || PLANT === 'away') && want('day')) for (const S of seasons) for (const w0 of (PLANT ? windows(S.seed).slice(0, 1) : windows(S.seed))) {
      await open(B, S.seed, `recordAt=${w0}&recordSpeed=10&tod=day&simtod=0&tv=1`); await plant(B, 'away');
      await B.ev(`window.__record.player.seek(${w0}); window.__record.player.play(); true`);
      const seen = new Map(); let t0 = Date.now();
      while (Date.now() - t0 < 64000) {
        const s = await B.ev(`(() => { const d = window.__recordUI.director, c = d.current, m = window.__record.player.minute; if (!c || c.kind !== 'day' || c.moving) return { m, c: null };
          const at = window.__dirAt(c.place); const est = at ? window.__dirSeen([{ x: at.x, y: -.1, z: at.z }]) : { seen: 0 };
          const subj = window.__dirSeen(c.subjects.map(id => { const a = window.__record.draw.agents?.map.get(id); return a?.w ? { x: a.w.p[0], y: a.w.p[1], z: a.w.p[2] } : null; }).filter(Boolean));
          return { m, c: { id: c.id, phase: c.phase, start: c.minute }, est: est.seen > 0 || subj.seen > 0, close: subj.seen > 0 }; })()`);
        if (s.m >= w0 + 10) break;
        if (s.c && s.m >= w0) { const e = seen.get(s.c.id) ?? { start: s.c.start, est: null, close: null }; seen.set(s.c.id, e);
          if (s.c.phase === 'est' && s.est && e.est === null) e.est = s.m; if (s.c.phase === 'close' && s.close && e.close === null) e.close = s.m; }
        await sleep(500);
      }
      const cuts = (await B.ev(`window.__recordUI.director.log.cuts.filter(c => c.kind === 'day' && c.minute >= ${w0} && c.minute < ${w0 + 10}).map(c => c.id)`));
      const credited = cuts.filter(id => { const e = seen.get(id); return e && e.est !== null && e.close !== null && e.close - e.start >= .5 - 1e-6; }).length;
      day.cuts += cuts.length; day.credited += credited; day.windows.push({ seed: S.seed, start: w0, cuts: cuts.length, credited });
    }
    if ((!PLANT || PLANT === 'away') && want('day')) step('day', day.cuts > 0 && day.credited / day.cuts >= .7, { credited: `${day.credited}/${day.cuts} = ${day.cuts ? (day.credited / day.cuts * 100).toFixed(1) : 0}%`, windows: day.windows });
    // 4 · the hand-back: 20 scripted inputs
    if ((!PLANT || PLANT === 'handback') && want('handback')) {
      const S = seasons[0], w0 = windows(S.seed)[0], trials = [];
      await open(B, S.seed, `recordAt=${w0}&recordSpeed=10&tod=day&simtod=0&tv=idle`); await plant(B, 'handback');
      const C = 640, Y = 300, INPUTS = [
        ['move', [['Input.dispatchMouseEvent', { type: 'mouseMoved', x: C + 40, y: Y + 10 }]], true],
        ['wheel', [['Input.dispatchMouseEvent', { type: 'mouseWheel', x: C, y: Y, deltaX: 0, deltaY: 40 }]], false],
        ['shift', [['Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 }], ['Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 }]], true],
        ['touch', [['Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: C, y: Y }] }], ['Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }]], false],
        ['click', [['Input.dispatchMouseEvent', { type: 'mousePressed', x: C, y: 120, button: 'left', clickCount: 1 }], ['Input.dispatchMouseEvent', { type: 'mouseReleased', x: C, y: 120, button: 'left', clickCount: 1 }]], false],
      ];
      for (let i = 0; i < (PLANT ? 5 : 20); i++) {
        const [name, events, still] = INPUTS[i % INPUTS.length];
        if ((await B.ev('window.__recordUI.director.mode')) === 'off') {
          for (const type of ['keyDown', 'keyUp']) await B.send('Input.dispatchKeyEvent', { type, key: '0', code: 'Digit0', windowsVirtualKeyCode: 48, text: type === 'keyDown' ? '0' : undefined });
        }
        await sleep(1200 + (i % 3) * 700);
        const before = await B.ev(`({ mode: window.__recordUI.director.mode, moving: window.__recordUI.director.current?.moving ?? false, stops: window.__recordUI.director.log.stops.length })`);
        for (const [m, p] of events) await B.send(m, p);
        const after = await B.ev(`new Promise(r => requestAnimationFrame(() => { const d = window.__recordUI.director, s = d.log.stops.at(-1), c = window.__city.camera.position; const p0 = c.toArray();
          let k = 0; (function f() { if (++k < 12) return requestAnimationFrame(f); r({ mode: d.mode, rig: window.__city.cam.mode, stop: d.log.stops.length > ${before.stops} ? s : null, inp: window.__inp, drift: Math.hypot(...c.toArray().map((v, j) => v - p0[j])) }); })(); }))`);
        const frames = after.stop && after.inp ? after.stop.frame - after.inp.frame : null;
        trials.push({ i, name, wasOn: before.mode === 'tv', inFlight: before.moving, off: after.mode === 'off', frames, drift: +after.drift.toFixed(3), rig: after.rig, ok: before.mode === 'tv' && after.mode === 'off' && frames !== null && frames <= 1 && (!still || after.rig !== 'orbit' || after.drift < .05) });
        if (i === 4 && !PLANT) tiles.push({ file: await shot(B, path.join(OUT, 'handback.png')), label: `Hand-back · ${name}: TV off in ${frames} frames`, step: 'handback' });
      }
      step('handback', trials.length >= (PLANT ? 5 : 20) && trials.every(t => t.ok), { trials: trials.length, ended: trials.filter(t => t.ok).length, inFlight: trials.filter(t => t.inFlight).length, maxFrames: Math.max(...trials.map(t => t.frames ?? 99)), bad: trials.filter(t => !t.ok).slice(0, 4) });
    }
    // 5 · back where it was: after the show (night 2), after a Replay
    if (!PLANT && want('return')) {
      const S = seasons[0], n2 = S.nights[1], home = [100, 40, -200];
      await open(B, S.seed, `recordAt=${n2.end - .6}&recordSpeed=10&tod=night&simtod=0&tv=1&cam=${home.join(',')}&look=88,0,-262`);
      const was = await B.ev(`window.__recordUI.director.home`);
      for (let t = 0; t < 40 && (await B.ev('window.__record.player.minute')) < n2.end + .1; t++) await sleep(500);
      await sleep(4000);
      const scene = await B.ev(`({ cam: window.__city.camera.position.toArray(), returns: window.__recordUI.director.log.returns, cuts: window.__recordUI.director.log.cuts.length })`);
      const dScene = Math.hypot(...scene.cam.map((v, j) => v - home[j]));
      // a morning card's Replay, a real click: day 3's cards, open
      const m3 = 3 * DAY + 420; let dReplay = null, rep = null;
      await open(B, S.seed, `recordAt=${m3}&recordSpeed=60&tod=day&simtod=0&panels=cards&cam=${home.join(',')}&look=88,0,-262`);
      const hasReplay = await B.ev(`!!document.querySelector('.m-replay')`);
      if (hasReplay) {
        await click(B, '.m-replay'); rep = await B.ev(`({ replay: window.__recordUI.director.replay, home: window.__recordUI.director.home, minute: window.__record.player.minute })`);
        for (let t = 0; t < 60 && (await B.ev('!!window.__recordUI.director.replay')); t++) await sleep(500);
        await sleep(3500); const cam = await B.ev(`window.__city.camera.position.toArray()`); dReplay = Math.hypot(...cam.map((v, j) => v - home[j]));
      }
      step('return', dScene <= .5 && scene.cuts > 0 && dReplay !== null && dReplay <= .5, { afterScene: { metres: +dScene.toFixed(2), home: was?.pos, returns: scene.returns.length }, afterReplay: { metres: dReplay === null ? null : +dReplay.toFixed(2), replay: rep?.replay ?? null } });
    }
    // 6 · the network
    const bad = B.requests.filter(r => { if (r.url.startsWith('data:') || r.url.startsWith('blob:')) return false; if (r.url.startsWith(THREE_CDN) && r.method === 'GET') return false;
      const u = new URL(r.url); if (u.origin !== BASE || r.method !== 'GET') return true; if (u.pathname.startsWith('/core/')) return !SEEDS.some(s => u.pathname === FEED(s));
      return /^\/(state|tape|events|api|__bake)\b/.test(u.pathname) || u.search.includes('since='); });
    step('network', bad.length === 0, { requests: B.requests.length, bad: bad.slice(0, 6).map(r => r.method + ' ' + r.url) });
    // 7 · frames: TV mode on a show vs no sim, the same view, back to back (rerun once on a miss)
    if ((!PLANT || PLANT === 'frames') && want('frames')) {
      const n2 = seasons[0].nights[1], view = 'cam=100,20,-245&look=88,0.6,-262&simtod=0';
      const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`);
      const pair = async () => {
        await open(B, seasons[0].seed, `recordAt=${n2.start + .3}&recordSpeed=10&tod=night&tv=1&${view}`); await plant(B, 'frames'); await sleep(3000);
        const tv = { ...(await measure()), mode: await B.ev('window.__recordUI.director.mode') };
        await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}&tod=night` });
        for (let t = 0; t < 240 && !(await B.ev(`document.title`, false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
        await sleep(5000); return { tv, noSim: await measure() };
      };
      let f = await pair(); const pass = x => x.tv.mode === 'tv' && (x.tv.p95 <= 16.8 || x.tv.p95 <= 1.15 * x.noSim.p95);
      const first = f; if (!pass(f)) f = await pair();
      step('frames', pass(f), { tv: f.tv, noSim: f.noSim, firstTry: first === f ? null : first, bar: '≤ 16.8 ms or ≤ 1.15 × no-sim' });
    }
    // 8 · a day sit-down in TV mode
    if (!PLANT && want('shots')) {
      let sit = null;
      for (const S of seasons) { for (const m of S.meets.slice(0, 6)) {
        await open(B, S.seed, `recordAt=${m - .2}&recordSpeed=10&tod=day&simtod=0&tv=1`);
        for (let t = 0; t < 24; t++) { const c = await B.ev(`(() => { const c = window.__recordUI.director.current; return c && /meet:/.test(c.id) ? c : null; })()`); if (c && (c.phase === 'close' || t > 12) && !c.moving) { sit = { seed: S.seed, minute: m, c }; break; } await sleep(500); }
        if (sit) break; } if (sit) break; }
      if (sit) { await sleep(800); tiles.unshift({ file: await shot(B, path.join(OUT, 'day-sitdown.png')), label: `Seed ${sit.seed} day ${Math.floor(sit.minute / DAY)} · a sit-down in TV mode`, step: 'day' }); }
      if (nightShot) tiles.unshift(nightShot);
      if (!nightShot && !want('night')) { const S = seasons[0], n2 = S.nights[1], sc = n2.scenes[0]; await open(B, S.seed, `recordAt=${sc.start - .25}&recordSpeed=10&tod=night&simtod=0&tv=1`); await sleep(8000); nightShot = { file: await shot(B, path.join(OUT, 'night-fight.png')), label: `Seed ${S.seed} night ${n2.night} · ${sc.kind} at ${sc.place.cityPlace} on the cut`, step: 'night' }; tiles.unshift(nightShot); }
      step('shots', !!nightShot && !!sit && tiles.length >= 3, { night: !!nightShot, sitdown: sit ? { seed: sit.seed, minute: sit.minute } : null, handback: tiles.some(t => t.step === 'handback') });
    }
  } catch (e) { result.error = String(e.stack || e); console.log('FAIL ' + result.error); }
  finally {
    result.pageErrors = B.errors.slice(0, 5);
    const passed = n => result.steps.find(s => s.name === n)?.ok, T = tiles.filter(t => t.file).map(t => ({ file: t.file, label: `${t.label} · ${t.step} ${passed(t.step) === undefined ? 'not run here' : passed(t.step) ? 'PASS' : 'FAIL'}` })), sheets = [];
    for (let k = 0; k < T.length; k += 4) { const sheet = path.join(OUT, `sheet-${k / 4 + 1}.jpg`), py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(T.slice(k, k + 4))], { encoding: 'utf8' }); if (py.status) console.log('sheet: ' + py.stderr); else sheets.push(sheet); }
    result.sheets = sheets;
    await fs.writeFile(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
    await B.close(); server?.kill();
    const ok = !result.error && result.steps.length > 0 && result.steps.every(s => s.ok) && !result.pageErrors.length;
    console.log(`${ok ? 'DIRECTORSCENARIO PASS' : 'DIRECTORSCENARIO FAIL'}${PLANT ? ' (plant ' + PLANT + ')' : ''} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
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
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
