import { SPEEDS } from './player.js';
import { createShowPlayer } from './show-plan.js';
import { islandClock } from './adapter.js';
import { createSimClock } from '../simclock.js';
import { sim } from '../store.js';

export function loadInWorker(url) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const finish = (error, frames) => { worker.terminate(); error ? reject(new Error(error)) : resolve(frames); };
    worker.onmessage = ({ data }) => {
      if (data.type === 'feed') finish(null, data.frames);
      else if (data.type === 'error') finish(data.error);
    };
    worker.onerror = event => finish(event.message || 'record worker failed');
    worker.postMessage({ type: 'load', url });
  });
}

// C1-3: the record's agents and fights are drawn by draw.js (walkers, trips, the show's scenes) when the page has walkers.
export async function startRecord({ Q, NIGHT, SHOT = false, camera, controls, scene = null, mats = null, peds = null, ANCHORS = new Map(), cornerKits = new Set(), isShown = () => true, log = console.log, ferry = null }) {
  if (!Q.get('feed')) throw new Error('record mode needs ?feed=<public feed URL>');
  const url = new URL(Q.get('feed'), location.href).href, frames = await loadInWorker(url);
  const clock = createSimClock().clock;
  // C1-6 (D4 (c)): the staged player. Each night's results reach the store (the board, the ticker, the cards) as their scenes pay
  // off; the night's board is held until the show closes (show-plan.js, SHOW.md)
  const player = createShowPlayer(frames, { speed: +(Q.get('recordSpeed') || 1), clock });
  // the store keeps C1-2's fields (STORE.md), with the held results; the scene plan (`show`) is the stager's, read from the player
  sim.useRecord(storeView(player));
  const at = Q.has('recordAt') ? +Q.get('recordAt') : player.minute;
  if (Q.get('recordShows') === '1') player.playShows(Math.floor(at / 1440));
  player.seek(at);
  if (Q.get('recordPaused') !== '1') player.play(); else player.pause();
  let draw = null;
  if (scene && Q.get('agents') !== '0') {
    const { createRecordDraw } = await import('./draw.js');
    draw = await createRecordDraw({ Q, SHOT, NIGHT, scene, mats, camera, peds, ANCHORS, frames, player, cornerKits, isShown, log, ferry });
    // (a shot draws one moment: every look baked, everyone placed)
    if (SHOT && peds && draw.looks) { const t1 = performance.now(); while (!peds.ready && performance.now() - t1 < 4000) await new Promise(r => setTimeout(r, 20)); draw.update(true); await draw.looks.pumpAll(); draw.update(true); }
    else draw.update(true);
  }
  const info = { source: 'record', url, status: 'record', clock, player };
  const refresh = !SHOT ? mountControls(player) : () => {};
  let last = null, reloading = false;
  function frame(pageT) {
    clock.pageT = pageT;
    const dt = last === null ? 0 : Math.max(0, pageT - last); last = pageT;
    player.advance(dt); refresh(); draw?.update();
    const night = islandClock(player.minute).night;
    if (Q.get('simtod') === '0' || SHOT || night === NIGHT || reloading) return;
    reloading = true;
    const next = new URL(location.href);
    next.searchParams.set('tod', night ? 'night' : 'day');
    next.searchParams.set('recordAt', String(player.minute));
    next.searchParams.set('recordSpeed', String(player.speed));
    next.searchParams.set('recordPaused', player.running ? '0' : '1');
    next.searchParams.set('recordShows', player.mode === 'shows' ? '1' : '0');
    for (const [key, value] of [['cam', camera.position], ['look', controls.target]]) next.searchParams.set(key, [value.x, value.y, value.z].join(','));
    // (C1-8: a camera the reload wrote, not one the link named: the director's first visit still counts)
    if (!Q.has('cam') || Q.get('camBy') === 'reload') next.searchParams.set('camBy', 'reload');
    next.searchParams.delete('view');
    location.replace(next.href);
  }
  const page = { layer: draw?.layer ?? null, info, player, clock, frame, draw, frames };
  window.__record = page;
  return page;
}

// the player as the store sees it: the same playhead, controls and held results, without the stager's scene plan
function storeView(player) {
  const strip = ({ show, ...state }) => state;
  return Object.create(player, {
    snapshot: { value: () => strip(player.snapshot()) },
    on: { value: fn => player.on((state, meta) => fn(strip(state), meta)) },
  });
}

function mountControls(player) {
  const el = document.createElement('div'); el.id = 'record-player';
  el.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:60;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;background:#171b22;color:white;font:14px system-ui;border-radius:8px';
  const make = (tag, text, label) => { const n = document.createElement(tag); if (text) n.textContent = text; if (label) n.setAttribute('aria-label', label); el.append(n); return n; };
  const play = make('button', 'Pause', 'Play or pause');
  play.onclick = () => { player.running ? player.pause() : player.play(); refresh(); };
  const speed = make('select', null, 'Playback speed');
  for (const v of SPEEDS) speed.add(new Option(v === 1 ? 'Live' : `${v}×`, v));
  speed.value = player.speed; speed.onchange = () => player.setSpeed(+speed.value);
  const stamp = make('output');
  const scrub = make('input', null, 'Seek through the season');
  scrub.type = 'range'; scrub.min = '0'; scrub.max = player.bounds.to; scrub.step = '0.1'; scrub.style.flex = '1';
  scrub.oninput = () => { player.seek(+scrub.value); refresh(); };
  const minute = make('input', null, 'Seek to island minute');
  minute.type = 'number'; minute.min = '0'; minute.max = player.bounds.to; minute.step = 'any'; minute.style.width = '90px';
  minute.onchange = () => { player.seek(+minute.value); refresh(); };
  const night = make('select', null, 'Night to replay');
  for (const s of player.shows()) night.add(new Option(`Night ${s.night}`, s.night));
  const jump = make('button', 'Go to show'); jump.onclick = () => { player.jumpShow(+night.value); refresh(); };
  const shows = make('button', 'Shows back to back'); shows.onclick = () => { player.playShows(+night.value); refresh(); };
  const season = make('button', 'Whole season'); season.onclick = () => { player.playSeason(); refresh(); };
  function refresh() {
    const c = islandClock(player.minute); stamp.textContent = `Day ${c.day} ${c.hhmm}`;
    play.textContent = player.running ? 'Pause' : 'Play';
    if (document.activeElement !== scrub) scrub.value = player.minute;
    if (document.activeElement !== minute) minute.value = +player.minute.toFixed(3);
  }
  document.body.append(el); refresh();
  return refresh;
}
