// C1-9 · THE TAPE, CLICKED (the record path's scrubber, markers, missed card and replays: ui/record/tape.js): headless Chrome on
// ?sim=record, real pointer events (CDP Input) on the scrubber's markers and the cards' buttons, measured on screen and against the feed
// read in node (tape-data.js's createTapeReader on a player sought to the same minute).
//   node style/city/tools/tapescenario.mjs --port 5976 [--seeds 404,405,406] [--out <dir>] [--plant <name>]
//        [--only markers,clicks,missed,card,hooded,layout,network,frames,shots]
// Steps (each reports its numbers; the run passes when every step passes):
//   1 markers   at three paused moments of each seed (night 2's close, day 7 noon, the season's end) the scrubber's markers are exactly
//               markersAt(the snapshot at that minute); then night 3's show played at 60×, polled 5× a real second: no marker on the bar
//               whose event's first publication (the feed played forward in node) is after the page's minute. All six kinds by the end
//   2 clicks    one marker of each kind a seed has (show, fight, arrest, turf, sale, ferry), each on a fresh page just after its
//               publication: a real click on its pip (a pip of several: then on its row in the list). The visit starts at
//               marker.replayStart (±0.01 island min); the camera's target lands within 2 m of the marker's place (a marker with a
//               place); the record then plays. Walkers within 50 m of the target are tracked for 3 s after the landing: a frame step over
//               2 m (a pop) or a 0.4 m drop or rise (a dip) is recorded with its minute (reported, not judged: the seek bugs are the next
//               job's, C1-9 brief)
//   3 missed    a show played at 60× with the camera far from it, TV mode off: a paper card comes up for a fight or arrest nobody saw
//               (never one whose place was on screen), at most one new card per 20 s; a real click on its Replay: the replay starts at
//               paper.replayStart, lands within 2 m of paper.framing.place, shows the victim on screen (when the victim has a walker),
//               and ends with the playhead back at the minute of the click (±0.05) and the camera back where it was (≤ 0.5 m)
//   4 card      (seed 404, the day / night reload on) a morning card's Replay, a real click: the replay crosses into the night and back;
//               it starts at the card's scene (scene.start), lands within 2 m of its place, and ends back at the morning with the camera
//               where the viewer had it (≤ 0.5 m)
//   5 hooded    D6: a replay of a fight whose attackers the show hid, from a horizon 2 days later: the lower third names exactly
//               recordSideAt's names for that victim; from a horizon under 24 hours later: no hidden attacker's name anywhere in it
//   6 layout    1280×720, 1440×900, 1920×1080, three panel sets each with the missed card or the replay's lower third up: no two of the
//               menu, the panels, the ticker, the player's bar, the missed card and the lower thirds overlap; the card is on screen
//   7 network   only GETs of this server's static files, the feeds and the pinned three.js module
//   8 frames    frame time p95: a show at 10× on the record path with the tape up vs the same view with no sim, back to back (rerun
//               once on a miss); bar: ≤ 16.8 ms or ≤ 1.15 × no-sim's
//   9 shots     the scrubber with its markers, a marker click landing, a missed card, a replay framed on the victim: ≤ 2×2 tiles a
//               sheet, each labelled with its moment and its step's pass / fail
// --plant <future|pointer|away|start|hooded|overlap|network|frames>: a violation planted in the page (in memory, never in a source
// file), on a short run (seed 404), to show the step that guards it fails.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), PLANT = arg('plant', null), BASE = `http://127.0.0.1:${PORT}`;
const PLANT_STEPS = { future: ['markers'], pointer: ['clicks'], away: ['clicks'], start: ['clicks'], hooded: ['hooded'], overlap: ['layout'], network: ['markers', 'network'], frames: ['frames'] };
const ONLY = arg('only', null)?.split(',') ?? (PLANT ? PLANT_STEPS[PLANT] : null), want = k => !ONLY || ONLY.includes(k);
const SEEDS = (arg('seeds', PLANT ? '404' : '404,405,406')).split(',').map(Number);
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c1-9', PLANT ? 'plant-' + PLANT : '')));
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/', DAY = 1440, sleep = ms => new Promise(r => setTimeout(r, ms));
const FEED = s => `/core/runs/${s}-A/feed.jsonl`, FAR = 'cam=-300,40,300&look=-300,0,260';
const { createShowPlayer, createShowPlanner } = await import('../simstate/record/show-plan.js');
const { revealAt } = await import('../simstate/record/player.js');
const { createTapeReader, recordSideAt } = await import('../simstate/record/tape-data.js');
const { cardsAt } = await import('../simstate/record/cards.js');
const { CITY_PLACES, HOUSE_LOTS } = await import('../simstate/record/places.js');
// (camera/director.js placeXZ, without three: a scene's place → its anchor, a home lot, else the stand set, else the place)
const placeXZ = p => { if (!p) return null; const q = HOUSE_LOTS.find(l => l.id === p.cityPlace) ?? CITY_PLACES[p.standPlace] ?? CITY_PLACES[p.cityPlace]; return q ? { x: q.x, z: q.z } : null; };

// ── the seasons, read in node: the markers, each event's first publication (the feed played forward), the shows
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
  for (const c of [...cues].sort((a, b) => a - b)) { if (c <= P.minute) continue; if (!P.running) P.play(); P.advance(c - P.minute + 1e-6); }
  const stateAt = m => { const { show, ...s } = createShowPlayer(frames).seek(m); return s; };
  const bounds = P.bounds, all = reader.markersAt(stateAt(bounds.to));
  return { seed, frames, planner, reader, first, stateAt, bounds, all, nights };
}

// ── in the page
const PREP = `(() => { window.__rafN = 0; (function f() { window.__rafN++; requestAnimationFrame(f); })(); return true; })()`;
const DOM_IDS = `[...document.querySelectorAll('#record-player .r-tape-mk')].flatMap(b => b.dataset.ids.split(',').map(Number))`;
const PLANTS = {
  future: last => `setInterval(() => { const p = document.querySelector('#record-player .r-tape-pips'); if (p && !p.querySelector('[data-plant]')) { const b = document.createElement('button'); b.className = 'r-tape-mk is-fight'; b.dataset.ids = '${last}'; b.dataset.plant = '1'; b.style.left = '50%'; p.append(b); } }, 200)`,
  pointer: `(() => { const s = document.createElement('style'); s.textContent = '#record-player .r-tape-mk, #record-player .r-tape-item { pointer-events: none !important; }'; document.head.append(s); })()`,
  away: `(() => { const d = window.__recordUI.director, v = d.visit; d.visit = o => v({ ...o, spec: null }); })()`,
  start: `(() => { const P = window.__record.player, s = P.seek; P.seek = m => s.call(P, m + 1); })()`,
  hooded: name => `setInterval(() => { const c = document.getElementById('r-tape-cap'), w = c?.querySelector('.r-tv-who'); if (c && !c.hidden && !w.textContent.includes(${JSON.stringify(name)})) w.textContent += ' · hood off: ' + ${JSON.stringify(name)}; }, 100)`,
  overlap: `(() => { const s = document.createElement('style'); s.textContent = '#k .r-missed { top: 90px !important; }'; document.head.append(s); })()`,
  network: `fetch('https://example.com/plant.json').catch(() => {})`,
  frames: `(function f() { const t = performance.now(); while (performance.now() - t < 26); requestAnimationFrame(f); })()`,
};
const plant = async (B, which, extra) => { if (PLANT === which) await B.ev(typeof PLANTS[which] === 'function' ? PLANTS[which](extra) : PLANTS[which], false); };
async function shot(B, file) { const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
async function tapeUp(B) { for (let t = 0; t < 100 && !(await B.ev('!!window.__recordUI?.tape && !!window.__record?.draw', false).catch(() => false)); t++) await sleep(200); }
async function open(B, seed, q) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&${q}` }); await ready(B); await tapeUp(B);
  await B.ev(PREP); await sleep(800);
}
const centre = (B, js) => B.ev(`(() => { const n = ${js}; if (!n) return null; const r = n.getBoundingClientRect(); return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`);
async function press(B, p) { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); }
const pipOf = id => `[...document.querySelectorAll('#record-player .r-tape-mk')].find(b => b.dataset.ids.split(',').includes('${id}'))`;
// a marker, clicked as a viewer does: its pip, and its row when the pip holds several
async function clickMarker(B, id) {
  const p = await centre(B, pipOf(id)); if (!p) return { ok: false, why: 'no pip' };
  await press(B, p); await sleep(350);
  const n = await B.ev(`(${pipOf(id)})?.dataset.ids.split(',').length ?? 0`);
  if (n > 1) { const q = await centre(B, `document.querySelector('#r-tape-pop [data-marker="${id}"]')`); if (!q) return { ok: false, why: 'no row in the list', pip: n }; await press(B, q); }
  return { ok: true, pip: n };
}
const VISIT = `(() => { const t = window.__recordUI.tape; return { v: t.visit, log: t.log.visits.at(-1) ?? null, minute: window.__record.player.minute, running: window.__record.player.running, tgt: window.__city.controls.target.toArray() }; })()`;
async function untilPlay(B, timeout = 20000) {
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < timeout) { s = await B.ev(VISIT); if (s.log && (s.log.landed || s.log.cancelled) && (!s.v || s.v.phase === 'play')) return s; await sleep(250); }
  return s;
}
// the walkers near the camera's target for ms after now: a frame step over 2 m (a pop), a 0.4 m drop or rise (a dip)
const JITTER = ms => `new Promise(r => { const R = window.__record, T = window.__city.controls.target, last = new Map(), out = { frames: 0, walkers: 0, pops: [], dips: [] }; const t0 = performance.now();
  (function f() { out.frames++; const ids = new Set();
    for (const [id, a] of R.draw.agents?.map ?? []) { const w = a.w; if (!w || w.gone || Math.hypot(w.p[0] - T.x, w.p[2] - T.z) > 50) { last.delete(id); continue; } ids.add(id); const p = last.get(id);
      if (p) { const d = Math.hypot(w.p[0] - p[0], w.p[2] - p[2]), dy = Math.abs(w.p[1] - p[1]); if (d > 2) out.pops.push({ id, m: +d.toFixed(2), minute: +R.player.minute.toFixed(2) }); if (dy > .4) out.dips.push({ id, dy: +dy.toFixed(2), minute: +R.player.minute.toFixed(2) }); }
      last.set(id, [w.p[0], w.p[1], w.p[2]]); }
    out.walkers = Math.max(out.walkers, ids.size); if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else r(out); })(); })`;
// a figure on screen (in frame, above the bars)
const ONSCREEN = `(id) => { const R = window.__record, C = window.__city, a = R.draw.agents?.map.get(id), w = a?.w; if (!w || w.gone) return null; const V = new C.THREE.Vector3(w.p[0], w.p[1] + 1.2, w.p[2]).project(C.camera);
  const floor = Math.min(...['r-ticker', 'record-player', 'r-tape-cap'].map(k => { const n = document.getElementById(k); return n && !n.hidden ? n.getBoundingClientRect().top : innerHeight; }));
  const py = (1 - V.y) / 2 * innerHeight; return V.z < 1 && Math.abs(V.x) < .96 && Math.abs(V.y) < .96 && py < floor; }`;
const RECTS = `(() => { const out = {}; const vis = n => !!n && !n.hidden && n.getAttribute('aria-hidden') !== 'true' && getComputedStyle(n).visibility !== 'hidden' && getComputedStyle(n).display !== 'none';
  for (const id of ['r-board', 'r-cards', 'r-dossier', 'r-people', 'r-ch9', 'r-ticker', 'r-menu', 'r-map', 'record-player', 'r-missed', 'r-tape-cap', 'r-tv-cap']) { const n = document.getElementById(id); if (!vis(n)) continue; const b = n.getBoundingClientRect(); if (b.width && b.height) out[id] = [b.left, b.top, b.right, b.bottom]; }
  return out; })()`;
function overlaps(rects) {
  const ids = Object.keys(rects), bad = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = rects[ids[i]], b = rects[ids[j]];
    const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (w > .5 && h > .5) bad.push([ids[i], ids[j], Math.round(w), Math.round(h)]); }
  return bad;
}
const stamp = m => `day ${Math.floor(m / DAY)} ${String(Math.floor(m % DAY / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const tod = m => { const h = Math.floor(m % DAY / 60); return h >= 20 || h < 6 ? 'night' : 'day'; };
const nameIn = (text, name) => new RegExp(`(^|[^a-z0-9])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(String(text).toLowerCase());

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/tapescenario.mjs --port <port>'); process.exit(2); }
  await fs.mkdir(OUT, { recursive: true });
  const seasons = SEEDS.map(season), server = await serve(), result = { seeds: SEEDS, plant: PLANT, steps: [] }, tiles = [];
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`); };
  let B = await chrome();
  try {
    // 1 · the markers: exactly the presented snapshot's, never one before its publication
    if (want('markers')) {
      const out = [];
      for (const S of seasons) {
        const n2 = S.planner.night(S.nights[1]), last = S.all.at(-1).id;
        for (const m of [n2.end + 1, 7 * DAY + 720, S.bounds.to]) {
          await open(B, S.seed, `recordAt=${m}&recordPaused=1&tod=${tod(m)}&simtod=0&tv=0`); await plant(B, 'future', last); await plant(B, 'network'); await sleep(600);
          const dom = [...new Set(await B.ev(DOM_IDS))].sort((a, b) => a - b), want_ = S.reader.markersAt(S.stateAt(m)).map(x => x.id).sort((a, b) => a - b);
          const extra = dom.filter(id => !want_.includes(id)), missing = want_.filter(id => !dom.includes(id));
          out.push({ seed: S.seed, minute: m, n: dom.length, extra: extra.slice(0, 5), missing: missing.slice(0, 5), ok: !extra.length && !missing.length });
          if (m === S.bounds.to && S.seed === SEEDS[0] && !PLANT) {
            const kinds = [...new Set(S.all.map(x => x.kind))];
            const pip = await centre(B, `[...document.querySelectorAll('#record-player .r-tape-mk')].filter(b => b.dataset.ids.split(',').length > 2).at(-2)`);
            if (pip) { await press(B, pip); await sleep(500); }
            tiles.push({ file: await shot(B, path.join(OUT, 'scrubber.png')), label: `Seed ${S.seed} ${stamp(m)} · the scrubber: ${dom.length} markers (${kinds.join(', ')})`, step: 'markers' });
          }
        }
        // the show played at 60×: no marker before its event's first publication
        const n3 = S.planner.night(S.nights[2]);
        await open(B, S.seed, `recordAt=${n3.start - 3}&recordSpeed=60&tod=night&simtod=0&tv=0`); await plant(B, 'future', last);
        let samples = 0, early = [];
        for (let t = 0; t < 120; t++) {
          const s = await B.ev(`({ minute: window.__record.player.minute, ids: ${DOM_IDS} })`); samples++;
          for (const id of s.ids) if (!(S.first.get(id) <= s.minute + .01)) early.push({ id, at: +s.minute.toFixed(3), published: S.first.get(id) ?? null });
          if (s.minute > n3.end + 1) break; await sleep(200);
        }
        out.push({ seed: S.seed, played: [n3.start - 3, n3.end + 1], samples, early: early.slice(0, 5), ok: samples > 10 && !early.length });
      }
      const kinds = seasons.map(S => ({ seed: S.seed, kinds: [...new Set(S.all.map(x => x.kind))].length }));
      step('markers', out.every(o => o.ok) && kinds.every(k => k.kinds === 6), { checks: out, kinds });
    }
    // 2 · marker clicks: there, at its moment, framed, playing
    if (want('clicks')) {
      const out = [], pops = [];
      for (const S of seasons) {
        const pick = ['show', 'fight', 'arrest', 'turf', 'sale', 'ferry'].map(k => k === 'ferry' ? S.all.find(m => m.kind === k && m.subjects.agent) ?? S.all.find(m => m.kind === k) : (k === 'fight' ? S.all.find(m => m.kind === k && m.place && m.subjects.agent) ?? S.all.find(m => m.kind === k && m.place) : S.all.find(m => m.kind === k))).filter(Boolean);
        for (const m of PLANT ? pick.slice(1, 3) : pick) {
          const at = S.first.get(m.id) + 5;
          await open(B, S.seed, `recordAt=${at}&recordPaused=1&recordSpeed=10&tod=${tod(at)}&simtod=0&tv=0`); await plant(B, 'pointer'); await plant(B, 'away'); await plant(B, 'start');
          const c = await clickMarker(B, m.id), s = await untilPlay(B), place = placeXZ(m.place);
          const visited = !!s?.log && s.log.id === m.id && s.log.kind === 'marker';
          const off = place && s?.log?.landed ? +Math.hypot(s.log.landed.x - place.x, s.log.landed.z - place.z).toFixed(2) : null;
          const startOk = visited && Math.abs(s.log.sought - m.replayStart) <= .01;
          const o = { seed: S.seed, id: m.id, kind: m.kind, replayStart: +m.replayStart.toFixed(3), sought: s?.log?.sought ?? null, pip: c.pip ?? null, why: c.why ?? null, off, landedMs: s?.log?.landed?.ms ?? null,
            playing: s?.running ?? false, ok: c.ok && visited && startOk && (!place || (off !== null && off <= 2)) && !!s?.running };
          if (visited && s.log.landed) { const j = await B.ev(JITTER(3000)); o.jitter = { walkers: j.walkers, pops: j.pops.length, dips: j.dips.length }; for (const p of j.pops) pops.push({ seed: S.seed, marker: m.id, kind: m.kind, ...p, what: 'pop' }); for (const p of j.dips) pops.push({ seed: S.seed, marker: m.id, kind: m.kind, ...p, what: 'dip' }); }
          out.push(o);
          if (S.seed === SEEDS[0] && m.kind === 'fight' && !PLANT) { await sleep(1200); tiles.push({ file: await shot(B, path.join(OUT, 'marker-click.png')), label: `Seed ${S.seed} ${stamp(m.replayStart)} · fight marker clicked: ${off} m from its place`, step: 'clicks' }); }
        }
      }
      result.pops = pops;
      step('clicks', out.length > 0 && out.every(o => o.ok), { clicks: out.length, ok: out.filter(o => o.ok).length, bad: out.filter(o => !o.ok).slice(0, 6), all: out.map(o => [o.seed, o.id, o.kind, o.off, o.ok]), pops: pops.length });
    }
    // 3 · the missed card and its replay
    if (!PLANT && want('missed')) {
      const out = [];
      for (const S of seasons) {
        // (the first night whose first fight or arrest on the bar has someone to frame: the card that comes up first is that one)
        const firstOf = n => S.all.filter(m => (m.kind === 'fight' || m.kind === 'arrest') && Math.floor(m.minute / DAY) === n).sort((a, b) => S.first.get(a.id) - S.first.get(b.id))[0];
        const framed = n => { const m = firstOf(n); return m && m.place && S.reader.paperCardAt(S.stateAt(S.first.get(m.id) + .5), m.id)?.framing.agent; };
        const night = S.nights.find(framed) ?? S.nights.find(firstOf), plan = S.planner.night(night);
        await open(B, S.seed, `recordAt=${plan.start - .5}&recordSpeed=60&tod=night&simtod=0&tv=0&${FAR}`);
        let card = null;
        for (let t = 0; t < 80 && !card; t++) { await sleep(250); card = await B.ev(`window.__recordUI.tape.missed.shown`); }
        const log = await B.ev(`window.__recordUI.tape.log.missed`), seen = await B.ev(`window.__recordUI.tape.seen`);
        if (card === null) { out.push({ seed: S.seed, night, card: null, log, ok: false }); continue; }
        if (S.seed === SEEDS[0]) tiles.push({ file: await shot(B, path.join(OUT, 'missed-card.png')), label: `Seed ${S.seed} ${stamp(S.first.get(card))} · missed card for event ${card}`, step: 'missed' });
        const clicked = await B.ev('window.__record.player.minute'), home = await B.ev(`window.__city.camera.position.toArray()`);
        const p = await centre(B, `document.querySelector('#r-missed .r-paper-replay')`); await press(B, p);
        const s = await untilPlay(B), paper = S.reader.paperCardAt(S.stateAt(s.log?.clicked ?? clicked), card), place = placeXZ(paper?.framing.place);
        const off = place && s?.log?.landed ? +Math.hypot(s.log.landed.x - place.x, s.log.landed.z - place.z).toFixed(2) : null;
        let victim = paper?.framing.agent ? { id: paper.framing.agent, drawn: false, seen: false } : null, vShot = false;
        for (let t = 0; t < 240; t++) {
          const v = await B.ev(`({ v: window.__recordUI.tape.visit, close: !!window.__recordUI.tape.log.visits.at(-1)?.close, on: ${victim ? `(${ONSCREEN})(${JSON.stringify(victim.id)})` : 'null'} })`);
          if (victim && v.on !== null) { victim.drawn = true; if (v.on) { victim.seen = true; if (!vShot && S.seed === SEEDS[0] && (v.close || t > 60)) { vShot = true; await sleep(300); tiles.push({ file: await shot(B, path.join(OUT, 'replay-victim.png')), label: `Seed ${S.seed} ${stamp(paper.replayStart)} · replay of ${paper.kind} ${card}, framed on ${victim.id}`, step: 'missed' }); } } }
          if (!v.v) break; await sleep(250);
        }
        await sleep(4000);
        const end = await B.ev(`({ minute: window.__record.player.minute, cam: window.__city.camera.position.toArray(), log: window.__recordUI.tape.log.visits.at(-1) })`);
        const back = end.log?.back ?? null, dHome = +Math.hypot(...end.cam.map((v, j) => v - home[j])).toFixed(2);
        const startOk = !!paper && !!s?.log && s.log.kind === 'missed' && Math.abs(s.log.sought - paper.replayStart) <= .01;
        const shownSeen = log.filter(x => x.why === 'seen').map(x => x.id).includes(card);
        if (!vShot && S.seed === SEEDS[0]) tiles.push({ file: null, label: 'replay-victim', step: 'missed' });
        out.push({ seed: S.seed, night, card, missedLog: log.length, seenScenes: seen.length, replayStart: paper?.replayStart ?? null, sought: s?.log?.sought ?? null, off, victim, clicked: s?.log?.clicked ?? null, back, dHome,
          ok: startOk && !shownSeen && (!place || (off !== null && off <= 2)) && (!victim?.drawn || victim.seen) && back !== null && Math.abs(back - s.log.clicked) <= .05 && dHome <= .5 });
      }
      step('missed', out.every(o => o.ok), { replays: out });
    }
    // 4 · a morning card's Replay across the day / night reload and back
    if (!PLANT && want('card')) {
      const S = seasons[0], dawnOf = d => S.frames.find(f => f.step.kind === 'dawn' && f.day === d)?.minute;
      let pick = null;
      for (const n of S.nights) { const m = dawnOf(n + 1); if (m == null) continue; const c = cardsAt(S.stateAt(m + 1), undefined, m + 1).find(x => S.planner.night(x.replay.night).scenes.some(s => s.eventId === x.replay.eventId)); if (c) { pick = { m: m + 60, c }; break; } }
      const scene = S.planner.night(pick.c.replay.night).scenes.find(s => s.eventId === pick.c.replay.eventId), home = [100, 40, -200];
      await open(B, S.seed, `recordAt=${pick.m}&recordPaused=1&tod=day&tv=0&panels=cards&cam=${home.join(',')}&look=88,0,-262`);
      const p = await centre(B, `document.querySelector('#r-cards [data-ev="${pick.c.source.eventId}"] .m-replay')`); if (p) await press(B, p);
      let s = null, nightSeen = false;
      for (let t = 0; t < 200; t++) {
        await sleep(400); const q = await B.ev(`({ tod: new URLSearchParams(location.search).get('tod'), up: !!window.__recordUI?.tape })`, false).catch(() => null);
        if (!q?.up) continue; if (q.tod === 'night') { nightSeen = true; const v = await B.ev(VISIT).catch(() => null); if (v?.log?.landed) s ??= v; }
        if (nightSeen && q.tod === 'day') break;
      }
      await ready(B); await tapeUp(B); await sleep(3000);
      const end = await B.ev(`({ minute: window.__record.player.minute, cam: window.__city.camera.position.toArray(), tod: new URLSearchParams(location.search).get('tod') })`);
      const place = placeXZ(scene.place), off = s?.log?.landed ? +Math.hypot(s.log.landed.x - place.x, s.log.landed.z - place.z).toFixed(2) : null, dHome = +Math.hypot(...end.cam.map((v, j) => v - home[j])).toFixed(2);
      step('card', !!p && nightSeen && !!s && Math.abs(s.log.sought - scene.start) <= .01 && off !== null && off <= 2 && end.tod === 'day' && Math.abs(end.minute - pick.m) <= .05 && dHome <= .5,
        { card: pick.c.source.eventId, kind: pick.c.kind, scene: scene.id, sceneStart: scene.start, sought: s?.log?.sought ?? null, off, nightSeen, back: end.minute, clicked: pick.m, dHome });
    }
    // 5 · D6: hooded attackers named only from the disclosed record, past 24 hours
    if (want('hooded')) {
      const out = [];
      for (const S of seasons) {
        let pick = null;
        for (const n of S.nights) {
          const plan = S.planner.night(n), old = (n + 2) * DAY + 720;
          if (old > S.bounds.to) continue;
          for (const sc of plan.scenes.filter(x => x.beat === 'fight' && x.hoodedCount > 0)) {
            const paper = S.reader.paperCardAt(S.stateAt(old), sc.eventId); if (!paper?.framing.agent) continue;
            const names = recordSideAt(S.stateAt(paper.replayStart), S.stateAt(old)).names.filter(x => x.victim === paper.framing.agent);
            if (names.length) { pick = { n, sc, paper, names, old, young: plan.end + 30 }; break; }
          }
          if (pick) break;
        }
        if (!pick) { out.push({ seed: S.seed, none: true, ok: true }); continue; }
        const hidden = pick.names.map(x => x.name).filter(Boolean), cap = async () => {
          for (let t = 0; t < 60; t++) { const c = await B.ev(`(() => { const c = document.getElementById('r-tape-cap'); return c.hidden ? null : { text: [...c.children].map(n => n.textContent).join(' | '), names: c.dataset.names }; })()`); if (c) return c; await sleep(250); } return null; };
        await open(B, S.seed, `recordAt=${pick.old}&recordPaused=1&tod=day&simtod=0&tv=0`);
        await B.ev(`(() => { window.__recordUI.tape.replayPaper(${JSON.stringify(pick.paper)}); return true; })()`);
        const oldCap = await cap();
        await open(B, S.seed, `recordAt=${pick.young}&recordPaused=1&tod=night&simtod=0&tv=0`); await plant(B, 'hooded', hidden[0] ?? 'nobody');
        const youngPaper = S.reader.paperCardAt(S.stateAt(pick.young), pick.sc.eventId);
        await B.ev(`window.__recordUI.tape.replayPaper(${JSON.stringify(youngPaper)})`); await sleep(1500);
        const youngCap = await cap();
        const named = (oldCap?.names ?? '').split(',').filter(Boolean).sort(), wantNames = pick.names.map(x => x.agent).sort();
        const leak = hidden.filter(nm => nameIn(youngCap?.text ?? '', nm)).concat((youngCap?.names ?? '').split(',').filter(Boolean));
        out.push({ seed: S.seed, night: pick.n, fight: pick.sc.eventId, victim: pick.paper.framing.agent, old: { minute: pick.old, named, want: wantNames, text: oldCap?.text ?? null }, young: { minute: pick.young, leak, text: youngCap?.text ?? null },
          ok: !!oldCap && !!youngCap && JSON.stringify(named) === JSON.stringify(wantNames) && !leak.length });
      }
      step('hooded', out.length > 0 && out.every(o => o.ok) && out.some(o => !o.none), { checks: out });
    }
    // 6 · the layout at three sizes, the card or a lower third up
    if (want('layout')) {
      const out = [], S = seasons[0], m = 3 * DAY + 420, arrest = S.all.find(x => x.kind === 'arrest');
      for (const [w, hgt] of [[1280, 720], [1440, 900], [1920, 1080]]) {
        await B.send('Emulation.setDeviceMetricsOverride', { width: w, height: hgt, deviceScaleFactor: 1, mobile: false });
        await open(B, S.seed, `recordAt=${m}&recordPaused=1&tod=day&simtod=0&tv=0`); await plant(B, 'overlap');
        const push = `window.__recordUI.tape.missed.push({ paper: { id: -1 }, what: 'A jump in the street', line: 'penny · Neon Row corner · day 2 21:08' }, -1e9)`;
        const sets = [
          ['people+board+missed', `(() => { const U = window.__recordUI; U.people.open(); U.board.open(); ${push}; return true; })()`],
          ['cards+missed', `(() => { const U = window.__recordUI; U.people.close(); U.board.close(); U.cards.open(); ${push}; return true; })()`],
          ['ch9+dossier+replay', `(() => { const U = window.__recordUI; U.cards.close(); U.ch9.open(); U.dossier.open('a01'); U.tape.replayPaper(${JSON.stringify(S.reader.paperCardAt(S.stateAt(m), arrest.id))}); return true; })()`],
        ];
        for (const [name, js] of sets) {
          await B.ev(js); await sleep(1500);
          const rects = await B.ev(RECTS), bad = overlaps(rects), card = rects['r-missed'], onScreen = !card || (card[0] >= 0 && card[1] >= 0 && card[2] <= w && card[3] <= hgt);
          const need = name.includes('missed') ? 'r-missed' : 'r-tape-cap';
          out.push({ size: `${w}x${hgt}`, set: name, panels: Object.keys(rects), overlaps: bad, onScreen, ok: !bad.length && onScreen && !!rects[need] && !!rects['record-player'] });
        }
      }
      await B.send('Emulation.clearDeviceMetricsOverride');
      step('layout', out.every(o => o.ok), { sets: out });
    }
    // 7 · the network
    if (want('network')) {
      const bad = B.requests.filter(r => { if (r.url.startsWith('data:') || r.url.startsWith('blob:')) return false; if (r.url.startsWith(THREE_CDN) && r.method === 'GET') return false;
        const u = new URL(r.url); if (u.origin !== BASE || r.method !== 'GET') return true; if (u.pathname.startsWith('/core/')) return !SEEDS.some(s => u.pathname === FEED(s));
        return /^\/(state|tape|events|api|__bake)\b/.test(u.pathname) || u.search.includes('since='); });
      step('network', B.requests.length > 0 && bad.length === 0, { requests: B.requests.length, bad: bad.slice(0, 6).map(r => r.method + ' ' + r.url) });
    }
    // 8 · frames: a show at 10× with the tape up vs no sim, the same view, back to back (rerun once on a miss)
    if (want('frames')) {
      const S = seasons[0], n2 = S.planner.night(S.nights[1]), view = 'cam=100,20,-245&look=88,0.6,-262&simtod=0';
      const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`);
      const pair = async () => {
        await open(B, S.seed, `recordAt=${n2.start + .3}&recordSpeed=10&tod=night&tv=0&${view}`); await plant(B, 'frames'); await sleep(3000);
        const tape = { ...(await measure()), markers: await B.ev(`document.querySelectorAll('#record-player .r-tape-mk').length`) };
        await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}&tod=night` });
        for (let t = 0; t < 240 && !(await B.ev(`document.title`, false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
        await sleep(5000); return { tape, noSim: await measure() };
      };
      let f = await pair(); const pass = x => x.tape.markers > 0 && (x.tape.p95 <= 16.8 || x.tape.p95 <= 1.15 * x.noSim.p95);
      const firstTry = f; if (!pass(f)) f = await pair();
      step('frames', pass(f), { tape: f.tape, noSim: f.noSim, firstTry: firstTry === f ? null : firstTry, bar: '≤ 16.8 ms or ≤ 1.15 × no-sim' });
    }
    if (!PLANT && want('shots')) step('shots', tiles.filter(t => t.file).length >= 4, { tiles: tiles.map(t => t.label) });
  } catch (e) { result.error = String(e.stack || e); console.log('FAIL ' + result.error); }
  finally {
    result.pageErrors = B.errors.slice(0, 5);
    const passed = n => result.steps.find(s => s.name === n)?.ok, T = tiles.filter(t => t.file).map(t => ({ file: t.file, label: `${t.label} · ${t.step} ${passed(t.step) === undefined ? 'not run here' : passed(t.step) ? 'PASS' : 'FAIL'}` })), sheets = [];
    for (let k = 0; k < T.length; k += 4) { const sheet = path.join(OUT, `sheet-${k / 4 + 1}.jpg`), py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(T.slice(k, k + 4))], { encoding: 'utf8' }); if (py.status) console.log('sheet: ' + py.stderr); else sheets.push(sheet); }
    result.sheets = sheets;
    await fs.writeFile(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
    await B.close(); server?.kill();
    const ok = !result.error && result.steps.length > 0 && result.steps.every(s => s.ok) && !result.pageErrors.length;
    console.log(`${ok ? 'TAPESCENARIO PASS' : 'TAPESCENARIO FAIL'}${PLANT ? ' (plant ' + PLANT + ')' : ''} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
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
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
