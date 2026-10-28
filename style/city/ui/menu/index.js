// HUMAN LAYER · SECTION 4 · THE MENU: one slim bar, always there, top left, so any agent, place or screen is one or two clicks away.
//   People /   the roster (ui/people): search, filter, sort; a row → follow them + the dossier
//   Map B      3b's paper street map (ui/map)          City L   3a's boards (ui/city-info)      TV N   3a's CH 9 News
//   Tape       2a's tape player (ui/tape); in TAPE the entry reads Live and takes you back
//   Action .   where's the action (./action.js): the newest notable public event, again for the one before, , for the one after
//   Settings ` the toggles in one place (ui/settings)
// The clock: 3a's ticker carries the day, time and lens along the bottom; the bar shows its own small one only while the ticker is off
// (Shift+N), so they never say it twice. The bar is [data-safe-avoid] (the tape's bubbles keep out of it); photo mode hides it.
// THE LAYOUT (who owns which edge): top left the bar (top 10, 40 px) · the side panels (dossier, People, City, TV) from top 60 down,
// docked left or right, People opposite the dossier · bottom: 3a's ticker on the very edge; above it the LIVE/Tape chip (left), the
// tape's transport and the camera bar (centre) · the map full screen under the bar (its top 54). One left-side sheet at a time: People,
// City and TV close each other; the map closes People. The popovers (Settings, the action card) hang under their buttons.
// THE DEVELOPER BAR (index.html .ui: views, Go to, Day/Night, Rush, quality, Render) is hidden on a page with the menu; ?dev=1 or Shift+`
// shows it again (under the menu bar), and Settings has the switch. Its elements stay in the page either way (the render panel's \
// key, photo mode and tools/shots.mjs's ?view= presets don't depend on it being visible).
// ?people=1 opens People on load, ?people=<text> with that search (a link to a search; bench runs with People open).
// Cost: the bar is static DOM; it re-reads which screen is open after a click or a key and when a side panel's class changes (no timer,
// nothing per frame).
import { h, set, attr, prefs, lens as lensBadge, screens } from '../kit.js';
import { svg } from './icons.js';
import { createBeacons } from './beacon.js';
import { createAction } from './action.js';
import { createPeople } from '../people/index.js';
import { createSettings, DEV_KEY } from '../settings/index.js';
import { tape } from '../tape/state.js';
import { delayS } from '../../simstate/broadcast.js';   // (BROADCAST: LIVE · 15 s delay on the bar's own clock)

export function mountMenu(api, { sim, dossier, city, root, portraits, Q, refs }) {
  if (!document.querySelector('link[data-mn-css]')) for (const f of ['./menu.css', '../people/people.css', '../settings/settings.css']) document.head.append(h('link', { rel: 'stylesheet', href: new URL(f, import.meta.url).href, 'data-mn-css': '' }));
  const B = document.body; B.classList.add('k-menu');
  const setDev = (on, keep = true) => { B.classList.toggle('dev', !!on); if (keep) prefs.set(DEV_KEY, on ? '1' : '0'); };
  setDev(Q?.get?.('dev') === '1' || (Q?.get?.('dev') !== '0' && prefs.get(DEV_KEY) === '1'), false);
  const R = () => refs() || {};
  // ── the bar
  const ITEMS = [
    { id: 'people', label: 'People', icon: 'people', kbd: '/', tip: 'Everyone in the city: search, filter, one click to follow (/)' },
    { id: 'map', label: 'Map', icon: 'map', kbd: 'B', tip: 'The city map: places, people, what happened where (B)' },
    { id: 'city', label: 'City', icon: 'city', kbd: 'L', tip: 'The City: ladders, turf, money, crime, the dead (L)' },
    { id: 'tv', label: 'TV', icon: 'tv', kbd: 'N', tip: 'CH 9 News, the city’s own channel (N)' },
    { id: 'tape', label: 'Tape', icon: 'tape', kbd: null, tip: 'Watch the tape: the city a day ago, secrets and all' },
    { id: 'action', label: 'Action', icon: 'bolt', kbd: '.', tip: 'Where’s the action: the newest robbery, arrest, rush or death (.) · again for the one before' },
    { id: 'settings', label: 'Settings', icon: 'gear', kbd: '`', tip: 'Skin, pins, ticker, quality, camera (`)' },
  ];
  const btn = {};
  const brand = h('div', { class: 'mn-brand', 'aria-hidden': 'true' }, h('i', { class: 'mn-mark' }), h('span', null, 'AI City'));
  const clock = h('span', { class: 'mn-clock', hidden: true }), clockBadge = lensBadge('live'), clockT = h('span', { class: 'mn-clock-t k-mono' }); clock.append(clockBadge, clockT);
  const nav = h('nav', { class: 'mn-bar', 'aria-label': 'Menu', 'data-safe-avoid': '' }, brand);
  const group = h('div', { class: 'mn-items', role: 'toolbar', 'aria-label': 'Screens' });
  for (const it of ITEMS) { const b = h('button', { type: 'button', class: 'mn-item', 'data-id': it.id, 'data-tip': it.tip, 'aria-label': it.label + (it.kbd ? ` (${it.kbd})` : ''), 'aria-pressed': 'false' },
      h('span', { class: 'mn-ic' }, svg(it.icon)), h('span', { class: 'mn-label' }, it.label), it.kbd ? h('kbd', null, it.kbd) : '');
    b.onclick = () => run(it.id); btn[it.id] = b; group.append(b); if (it.id === 'tape') group.append(h('i', { class: 'mn-sep', 'aria-hidden': 'true' })); }
  nav.append(group, clock); root.append(nav);
  // the toolbar's own keys: ← → walk the buttons, Home / End (one tab stop for the whole bar)
  const order = ITEMS.map(i => btn[i.id]); let roving = 0; order.forEach((b, k) => attr(b, 'tabindex', k === 0 ? '0' : '-1'));
  group.addEventListener('keydown', e => { const k = order.indexOf(document.activeElement); if (k < 0) return; let n = null;
    if (e.key === 'ArrowRight') n = (k + 1) % order.length; else if (e.key === 'ArrowLeft') n = (k - 1 + order.length) % order.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = order.length - 1;
    if (n === null) return; e.preventDefault(); e.stopPropagation(); attr(order[roving], 'tabindex', '-1'); roving = n; attr(order[n], 'tabindex', '0'); order[n].focus(); });
  group.addEventListener('focusin', e => { const k = order.indexOf(e.target); if (k >= 0 && k !== roving) { attr(order[roving], 'tabindex', '-1'); roving = k; attr(order[k], 'tabindex', '0'); } });
  // ── the screens
  const beacons = createBeacons({ api, sim, root });
  // (each on the Esc stack while open, kit.js screens: one Esc closes the newest screen)
  const stacked = (id, x) => on => on ? screens.open(id, { esc: () => (x().esc || x().close)(), isOpen: () => x().isOpen }) : screens.close(id);
  const people = createPeople({ api, sim, dossier, city, root, portraits, beacons, onChange: on => { stacked('people', () => people)(on); if (on) { R().info?.close?.(); if (R().map?.isOpen) R().map.close(); settings?.close(); action?.close(); } sync(); } });
  const action = createAction({ api, sim, root, beacons, go: hh => people.go(hh), anchor: () => btn.action, onChange: on => { stacked('action', () => action)(on); if (on) settings?.close(); sync(); } });
  const settings = createSettings({ api, sim, city, root, refs: () => ({ map: R().map, info: R().info, tape: R().tape }), anchor: () => btn.settings, setDev: on => setDev(on), onChange: on => { stacked('settings', () => settings)(on); if (on) action.close(); sync(); } });
  function run(id) {
    const r = R();
    if (id === 'people') { people.isOpen ? people.close() : people.open(); }
    else if (id === 'map') { if (!r.map) return; if (!r.map.isOpen) { people.close(); action.close(); } r.map.toggle(); }
    else if (id === 'city' || id === 'tv') { if (r.map?.isOpen) r.map.close(); people.close(); r.info?.show(id); }
    else if (id === 'tape') { if (!r.tape) return; if (tape.active) r.tape.close(); else { people.close(); r.tape.open({}); } }
    else if (id === 'action') { if (r.map?.isOpen) r.map.close(); action.next(); }
    else if (id === 'settings') settings.toggle();
    sync();
  }
  // ── which screen is open: re-read after any click or key (they all open and close on input), never on a timer
  let was = {}, clockOn = false, clockUnsub = null;
  function sync() {
    const r = R(), s = { people: people.isOpen, map: !!r.map?.isOpen, city: r.info?.open === 'city', tv: r.info?.open === 'tv', tape: !!tape.active, action: action.isOpen, settings: settings.isOpen };
    // one left sheet at a time: City / TV / the map opened by their own keys close People
    if (s.people && ((s.city && !was.city) || (s.tv && !was.tv) || (s.map && !was.map))) { people.close(); s.people = false; }
    for (const [id, on] of Object.entries(s)) { const b = btn[id]; if (!b) continue; b.classList.toggle('is-on', on); attr(b, 'aria-pressed', on ? 'true' : 'false'); }
    // Tape ↔ Live
    const tb = btn.tape, inTape = s.tape; if (tb._tape !== inTape) { tb._tape = inTape; tb.querySelector('.mn-ic').replaceChildren(svg(inTape ? 'live' : 'tape')); set(tb.querySelector('.mn-label'), inTape ? 'Live' : 'Tape');
      attr(tb, 'data-tip', inTape ? 'Back to LIVE (Esc)' : ITEMS[4].tip); attr(tb, 'aria-label', inTape ? 'Back to live' : 'Tape'); tb.classList.toggle('is-tape', inTape); }
    // the small clock: only while 3a's ticker (which has the clock) is off
    const want = !document.documentElement.classList.contains('ci-tick-on');
    if (want !== clockOn) { clockOn = want; clock.hidden = !want; clockUnsub?.(); clockUnsub = want ? sim.on('tick', drawClock) : null; if (want) drawClock(); }
    was = s;
  }
  function drawClock() { const c = sim.clock(); if (tape.active) { clockBadge.update(tape.lens || 'tape'); const t = tape.time?.(); set(clockT, t != null ? `Day ${Math.floor(t / 1440) + 1} · ${String(Math.floor((t % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}` : ''); return; }
    const L = sim.lens === 'archive' ? 'archive' : 'live', d = L === 'live' ? delayS() : 0; clockBadge.update(L, d ? `${d} s delay` : ''); if (d) attr(clockBadge, 'data-tip', `Live, ${d} s behind the sim: the broadcast delay (Settings)`);
    set(clockT, c ? `Day ${c.day} · ${c.hhmm}` : ''); }
  const later = () => setTimeout(sync, 0);
  addEventListener('pointerup', later, true); addEventListener('keyup', later, true);
  // the screens that open late (3a's panels load their module first; the map marks #k.is-map): watch the side panels' classes and the
  // root's own, so a panel opened by its key is seen the moment it opens (a few mutations per open or close; nothing while nothing moves)
  const watched = new WeakSet(), mo = new MutationObserver(recs => { if (recs.some(r => r.type === 'childList')) watchKids(); sync(); });
  function watchKids() { for (const el of root.children) if (!watched.has(el) && el.classList.contains('k-panel')) { watched.add(el); mo.observe(el, { attributes: true, attributeFilter: ['class'] }); } }
  mo.observe(root, { childList: true, attributes: true, attributeFilter: ['class'] }); watchKids();
  // ── keys (registered before the map's, 3a's and the tape's: see ui/index.js; capture; never while typing, with ⌘/Ctrl/Alt, in photo mode or the diary)
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || B.classList.contains('cam-photo') || window.__toys?.diary?.isOpen) return;
    const k = e.code, r = R(); let used = true;
    if (k === 'Slash' && !e.shiftKey) { if (r.map?.isOpen) r.map.close(); if (people.isOpen) people.focus(); else run('people'); }
    else if (k === 'Period' && !e.shiftKey) run('action');
    else if (k === 'Comma' && !e.shiftKey) { if (action.isOpen) action.prev(); else run('action'); }
    else if (k === 'Backquote' && e.shiftKey) { setDev(!B.classList.contains('dev')); settings.sync(); }
    else if (k === 'Backquote') run('settings');
    else if (k === 'Escape') {
      // (the Esc stack, kit.js screens, closes the newest open screen before any of this runs; what follows is only for a screen that is
      // off the stack) the popovers, then People — before the tape's Esc means "back to LIVE"
      if (settings.isOpen) settings.close(); else if (action.isOpen) action.close();
      else if (people.isOpen && !r.map?.isOpen && !dossier.isOpen && !root.querySelector('.k-chooser') && !r.info?.open) people.close();
      else used = false;
    } else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); later(); }
  }, true);
  sync();
  if (Q?.has?.('people')) setTimeout(() => people.open({ focus: false, query: Q.get('people') && Q.get('people') !== '1' ? Q.get('people') : null }), 0);   // (?people=1 opens People; ?people=<text> with that search)
  const frame = () => { people.frame(); beacons.frame(); };
  return { el: nav, people, action, settings, beacons, run, sync, frame, setDev, stats: () => ({ people: people.stats(), action: action.stats(), settings: settings.isOpen, dev: B.classList.contains('dev') }) };
}
