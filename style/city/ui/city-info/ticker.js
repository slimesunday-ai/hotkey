// HUMAN LAYER · SECTION 3a · THE TICKER AND THE CLOCK: the one always-on piece. A slim bar along the very bottom edge of the screen:
//   clock    DAY 4 · 12:04 · rent in 17h 56m (06:00: rent, salaries, the broke-and-homeless check) · RUSH in Glasswall → 10:00 (click: go there)
//   crawl    the city's public news (feed.js): robberies, arrests, deaths, marks, turf, the Director, the drop. Click a story: the camera goes
//            where it happened; click a @handle: that agent's dossier. Hover holds the crawl still.
//   buttons  CH 9 (City TV, N) · City (the boards, L)
// In TAPE the clock and the crawl follow the tape time (the transport sits on top of the bar), with the tape-only stories in the TAPE colour.
// SMOOTH AND CHEAP: the crawl is one Web Animation of a CSS transform (the compositor moves it; no per-frame JS, no per-frame layout). A
// story is added at the end and dropped once it has left on the left, with the animation's time moved back by its width in the same task,
// so nothing jumps: one small layout per story, a few times a minute. New stories go next in line. The clock's text is set at most once
// a second (only when it changed). Hidden (Shift+N, kept in this browser), it does nothing at all.
// BROADCAST (2026-10-09): LIVE is D s behind the sim (simstate/broadcast.js), and the clock's badge says so: LIVE · 15 s delay.
import { h, set, attr, lens as lensBadge, prefs } from '../kit.js';
import { delayS, onDelay } from '../../simstate/broadcast.js';
import { newsOf, partsOf, hhmm, dayOf, dur, toRent, rushAt, KIND } from './feed.js';
import { places, placesNow, flyTo } from '../goto.js';

const SPEED = 62, BIG = 4e6, KEEP = 18, SPAN = 24 * 60, KEY = 'aicity.ui.ticker';   // px/s · the animation's length · stories in rotation · LIVE: the last 24 game hours
export function createTicker({ api, sim, tape, root, openAgent, onTV, onCity }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ── DOM
  const badge = lensBadge('live'); badge.classList.add('ci-lens');
  const dayEl = h('span', { class: 'ci-day' }), timeEl = h('b', { class: 'ci-time' }), rentEl = h('span', { class: 'ci-rent', 'data-tip': 'Rent is due at 06:00: rent, the cops’ pay and the broke-and-homeless check' });
  const rushB = h('button', { type: 'button', class: 'ci-rush', hidden: true, onclick: () => rush && flyTo(api, { dist: rush.dist }) });
  const clock = h('div', { class: 'ci-clock' }, badge, dayEl, timeEl, rentEl, rushB);
  const track = h('div', { class: 'ci-track' }), crawl = h('div', { class: 'ci-crawl', 'aria-hidden': 'true' }, track);
  const quiet = h('div', { class: 'ci-quiet', hidden: true }, 'No news yet today.');
  const tvB = h('button', { type: 'button', class: 'ci-b', 'data-tip': 'City TV: the day’s stories as news cards (N)', onclick: () => onTV() }, h('span', { class: 'ci-b-ch' }, 'CH 9'), h('kbd', null, 'N'));
  const cityB = h('button', { type: 'button', class: 'ci-b', 'data-tip': 'The City: ladders, turf, money, crime, the dead (L)', onclick: () => onCity() }, 'City', h('kbd', null, 'L'));
  const bar = h('section', { class: 'ci-bar', role: 'region', 'aria-label': 'City news and clock', 'data-safe-avoid': '', 'data-lens': 'live' }, clock, h('div', { class: 'ci-crawl-wrap' }, crawl, quiet), h('div', { class: 'ci-btns' }, tvB, cityB));
  root.append(bar);
  let on = new URLSearchParams(location.search).get('ticker') === '0' ? false : prefs.get(KEY) !== '0', rush = null;   // (?ticker=0: off for this page, not kept)
  // ── the conveyor
  let anim = null, items = [], endX = 0, viewW = 0, timer = 0, held = false, playlist = [], cursor = 0, next = [], seen = new Set();
  const offset = () => anim ? (anim.currentTime || 0) * SPEED / 1000 : 0;
  function startAnim() { anim?.cancel(); if (reduce) { anim = null; return; } anim = track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-BIG}px,0,0)` }], { duration: BIG / SPEED * 1000, easing: 'linear', fill: 'both' }); if (held || !on) anim.pause(); }
  function itemEl(s) {
    const el = h('span', { class: 'ci-item' + (s.tape ? ' is-tape' : ''), 'data-kind': s.kind, 'data-id': String(s.id) }, h('i', { class: 'ci-dot', style: `--ev: var(${KIND[s.kind]?.token || '--k-ink-3'})` }), h('time', null, timeOf(s.t)));
    const tx = h('span', { class: 'ci-text' }); for (const p of partsOf(s.text)) tx.append(typeof p === 'string' ? p : h('button', { type: 'button', class: 'ci-h', tabindex: '-1', 'data-h': p.handle }, '@' + p.handle));
    el.append(tx); if (s.tape) el.prepend(h('b', { class: 'ci-tapetag' }, 'TAPE')); el._s = s; return el;
  }
  // a story from another day says which (the clock says the day)
  function timeOf(t) { const now = tapeOn() ? tape.time() : sim.clock()?.t; return now != null && Math.floor(t / 1440) !== Math.floor(now / 1440) ? `D${dayOf(t)} ${hhmm(t)}` : hhmm(t); }
  function append(s) { const el = itemEl(s); track.append(el); const w = el.offsetWidth + parseFloat(getComputedStyle(el).marginRight || 0); items.push({ el, x: endX, w }); endX += w; }
  function take() { if (next.length) { const s = next.shift(); return s; } if (!playlist.length) return null; const s = playlist[cursor % playlist.length]; cursor++; return s; }
  function pump() {
    clearTimeout(timer); timer = 0; if (!on) return;
    if (reduce) { showStill(); return; }
    viewW = crawl.clientWidth || viewW; let off = offset(), gone = 0;
    while (items.length > 1 && items[0].x + items[0].w <= off - 4) { const it = items.shift(); it.el.remove(); gone += it.w; }
    if (gone) { for (const it of items) it.x -= gone; endX -= gone; if (anim) anim.currentTime = Math.max(0, anim.currentTime - gone / SPEED * 1000); off = offset(); }
    let n = 0; while (endX - off < viewW * 2 + 200 && n++ < 24) { const s = take(); if (!s) break; append(s); }
    quiet.hidden = !!items.length; crawl.hidden = !items.length;
    if (items.length && anim && !held) { const lead = items[0], ms = Math.max(400, (lead.x + lead.w - off) / SPEED * 1000 + 60); timer = setTimeout(pump, Math.min(ms, 15000)); }
    else if (items.length && anim && held) { /* resumes on pointerleave */ }
  }
  // reduced motion: one story at a time, no movement, the next every 7 s
  function showStill() { const s = take(); track.replaceChildren(); items = []; endX = 0; if (s) { append(s); } quiet.hidden = !!s; crawl.hidden = !s; timer = setTimeout(pump, 7000); }
  function restart() { clearTimeout(timer); timer = 0; track.replaceChildren(); items = []; endX = 0; cursor = 0; startAnim(); pump(); }
  // hover holds it still (so a moving story can be clicked); click: a handle → the dossier, else the camera goes there
  crawl.addEventListener('pointerenter', () => { held = true; anim?.pause(); });
  crawl.addEventListener('pointerleave', () => { held = false; if (on) { anim?.play(); pump(); } });
  crawl.addEventListener('click', e => { const hb = e.target.closest?.('.ci-h'); if (hb) { openAgent(hb.dataset.h); return; } const it = e.target.closest?.('.ci-item'); if (it?._s?.where) flyTo(api, it._s.where); });
  new ResizeObserver(() => { if (on && Math.abs((crawl.clientWidth || 0) - viewW) > 2) pump(); }).observe(crawl);
  // ── the stories: LIVE from the store, TAPE from the tape (following its time)
  const tapeOn = () => !!tape?.active && tape.time() !== null;
  function liveList() { const c = sim.clock(); if (!c) return []; return newsOf(sim.events({ since: c.t - SPAN })).slice(-KEEP); }
  function tapeList(t) { return newsOf(tape.events({ from: t - SPAN / 4, to: t }), { tape: true }).slice(-KEEP); }
  function rebuild() { playlist = (tapeOn() ? tapeList(tape.time()) : liveList()).reverse(); next = []; seen = new Set(playlist.map(s => s.id)); if (on) restart(); }   // (newest first)
  function fresh(list) { for (const s of list) { if (seen.has(s.id)) continue; seen.add(s.id); next.push(s); playlist.unshift(s); } if (playlist.length > KEEP) playlist.length = KEEP; if (next.length > 6) next.splice(0, next.length - 6); if (on && !timer) pump(); }
  sim.on('event', e => { if (tapeOn()) return; fresh(newsOf([e])); });
  let lastT = null; sim.on('tick', ({ t }) => { if (lastT !== null && t < lastT - 1 && !tapeOn()) rebuild(); lastT = t; });   // (the replay seeked back: start over)
  let tapeT = null, tapeAt = 0;
  if (tape) {
    tape.on('mode', ({ active }) => { attr(bar, 'data-lens', active ? tape.lens : 'live'); tapeT = null; rebuild(); tick(); });
    tape.on('seek', ({ t }) => { tapeT = t; rebuild(); tick(); });
    tape.on('time', ({ t }) => { tick(); const now = performance.now(); if (tapeT === null || t < tapeT || now - tapeAt < 900) return; const from = tapeT; tapeT = t; tapeAt = now; fresh(newsOf(tape.events({ from: from + 1e-6, to: t }), { tape: true }).filter(s => s.t > from)); });
  }
  // ── the clock (≤ 1 Hz in LIVE; with the tape's time events in TAPE)
  function tick() {
    const T = tapeOn(), t = T ? tape.time() : sim.clock()?.t; if (t === null || t === undefined) { set(timeEl, '--:--'); return; }
    set(dayEl, `Day ${dayOf(t)}`); set(timeEl, hhmm(t)); set(rentEl, `rent in ${dur(toRent(t))}`);
    const lens = T ? tape.lens : sim.lens === 'archive' ? 'archive' : 'live', d = lens === 'live' ? delayS() : 0;
    if (badge.dataset.k !== lens + d) { badge.dataset.k = lens + d; badge.update(lens, d ? `${d} s delay` : ''); if (d) attr(badge, 'data-tip', `Live, ${d} s behind the sim: the broadcast delay (Settings)`); }
    const ev = !T && sim.world()?.cityEv?.rush; rush = T ? rushAt(tape.events({ from: t - 200, to: t }), t) : ev && ev.until > t ? { dist: ev.dist, until: ev.until } : null;
    rushB.hidden = !rush; if (rush) { const nm = placesNow()?.distName(rush.dist) || rush.dist; set(rushB, `RUSH · ${nm} → ${hhmm(rush.until)}`); attr(rushB, 'data-tip', `The Director: the crowd on ${nm}’s corners doubles until ${hhmm(rush.until)}. Click to go there`); }
  }
  let clockTimer = 0;
  function show(v, keep = true) {
    on = v; if (keep) prefs.set(KEY, on ? '1' : '0'); bar.classList.toggle('is-off', !on); document.documentElement.classList.toggle('ci-tick-on', on);
    clearInterval(clockTimer); clockTimer = 0; clearTimeout(timer); timer = 0;
    if (on) { clockTimer = setInterval(() => { if (!tapeOn()) tick(); }, 1000); tick(); rebuild(); } else { anim?.pause(); }
    return on;
  }
  places().then(() => tick()); onDelay(() => { if (on) tick(); });
  sim.ready.then(() => { rebuild(); tick(); });
  show(on, false);
  return { el: bar, show, toggle: () => show(!on), get on() { return on; }, rebuild,
    stats: () => ({ on, items: items.length, playlist: playlist.length, queued: next.length, offset: Math.round(offset()), playState: anim?.playState ?? null }) };
}
