// HUMAN LAYER · SECTION 1: the UI kit, clicking an agent in the city, the dossier. main.js mounts it on a ?sim=live page (never in
// shots, bakes, hashes or reports; ?ui=0 leaves it off) and calls api.ui.frame(dt, t) once a frame, after the walkers and the camera
// moved and before the render. Everything else is events.
//   keys     Esc close · F follow (once following, or held: the camera's zoom out) · [ ] previous / next agent (while the dossier is open) · P pins on / off · U next skin
//   tape     section 2a (ui/tape/): the dossier's Watch tape, or the Tape chip → TAPE; Space ← → Shift+← → T, Esc back to LIVE (TAPE.md)
//   info     section 3a (ui/city-info/): the news ticker + clock along the bottom edge · N City TV · L the City boards · Shift+N ticker. All keys: KEYS.md
//   map      section 3b (ui/map/): B the city map (a paper street map of the island, full screen); B or Esc closes it
//   menu     section 4 (ui/menu/): the menu bar top left — People (/: ui/people), Map, City, TV, Tape, Action (.), Settings (`: ui/settings);
//            it hides the developer bar (?dev=1 or Shift+` shows it). Mounted before the map, 3a and the tape so its Esc closes its own first.
//   mouse    hover an agent: ring + label · click: the dossier · click away: close · a crowd marker: choose who
//   ?ui=clean|98|zine   the skin (also U; kept in this browser) · ?as=<handle> your own agent (the store's YOURS lens)
// The camera rig keeps its own clicks for plain walkers (follow them). For a click on a sim agent the dossier opens instead: the rig's
// person picker and the homes' click step aside for that one release (api.ui.claimed, see city.js).
import { mountRoot, tooltips, nextSkin, getSkin, toast, h, onSkinChange, simOffline, screens } from './kit.js';
import { createCityLayer } from './city.js';
import { createDossier } from './dossier.js';
import { createPortraits } from './portrait.js';
import { mountTape } from './tape/index.js';
import { mountCityInfo } from './city-info/index.js';
import { mountMap } from './map/index.js';
import { mountMenu } from './menu/index.js';
import { keepAcrossReload } from './reload.js';
import { mountLight } from './light.js';
import { tape } from './tape/state.js';

export async function mountUI(api, { Q }) {
  const { sim } = await import('../simstate/store.js');
  const root = mountRoot(Q); tooltips();
  const portraits = createPortraits({ THREE: api.THREE });
  let chooser = null;
  const city = createCityLayer({ api, sim, root, onPick: (handle, o) => { closeChooser(); if (o?.cluster) return openChooser(o.cluster, o.x, o.y); dossier.open(handle); },
    onMiss: () => { closeChooser(); if (dossier.isOpen) dossier.close(); } });   // (click away: a click on the map that hit no agent closes the dossier)
  const dossier = createDossier({ api, sim, root, city, portraits, onWatchTape: h0 => tapeCtl.open({ handle: h0 }) });
  let map = null, info = null, tapeCtl = null;
  const menu = mountMenu(api, { sim, dossier, city, root, portraits, Q, refs: () => ({ map, info, tape: tapeCtl }) });   // (section 4: the menu bar, People, Settings — first, so its keys come before the screens it opens)
  map = mountMap(api, { sim, dossier, city, root });   // (section 3b: the city map — nothing runs until B opens it; mounted before the tape so its Esc closes the map first)
  import('./map/transit.js').then(m => m.mountTransitLayer(map, root)).catch(e => console.warn('map transit layer: ' + (e && e.message || e)));   // (movement W2: the transit layer + its legend toggle; off until toggled)
  info = mountCityInfo(api, { sim, dossier, root });   // (section 3a: the ticker + clock, City TV, the boards — before the tape, so Esc closes their panel first)
  tapeCtl = mountTape(api, { sim, dossier, city, root });   // (section 2a: the tape player — nothing runs until it is opened)
  const light = mountLight(api, { root });   // (TAPE · light: the time-of-day grade toward the tape's time + the reload-to-light chip: ui/light.js)
  // the crowd chooser: a cluster of pins clicked → pick one (≥ 34 px rows)
  function openChooser(handles, x, y) {
    const cards = new Map(sim.agents().map(c => [c.handle, c]));
    chooser = h('div', { class: 'k-chooser', role: 'menu', 'aria-label': 'Who here' }, h('div', { class: 'k-h' }, `${handles.length} here`),
      ...handles.map(hh => h('button', { type: 'button', role: 'menuitem', onclick: () => { closeChooser(); dossier.open(hh, { from: 'key' }); } }, '@' + hh, h('span', null, cards.get(hh)?.cls || ''))));
    root.append(chooser); const w = chooser.offsetWidth, hh2 = chooser.offsetHeight;
    chooser.style.transform = `translate(${Math.round(Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)))}px, ${Math.round(Math.max(8, Math.min(innerHeight - hh2 - 8, y + 14)))}px)`;
    chooser.querySelector('button')?.focus({ preventScroll: true }); screens.open('chooser', { esc: closeChooser, isOpen: () => !!chooser });   // (the Esc stack: kit.js)
  }
  function closeChooser() { chooser?.remove(); chooser = null; screens.close('chooser'); }
  // the rig's person picker steps aside for a release the UI claimed (a click on a sim agent → the dossier, not follow)
  const rig = api.cam;
  if (rig?.people?.pick) { const pick0 = rig.people.pick; rig.people.pick = function (...a) { return city.claimed ? null : pick0.apply(this, a); }; }
  addEventListener('pointerdown', e => { if (chooser && !chooser.contains(e.target)) closeChooser(); }, true);
  // keys (capture: before the rig and nav see them, so F follows here instead of zooming, [ ] step agents). Added after the menu's,
  // the map's, 3a's and the tape's (mounted above): a key one of them used arrives here defaultPrevented and is left alone, so one Esc
  // closes one thing (review 10-09 #3: Esc closed the dossier too). The diary room takes every key before all of them (kit.js keysFirst),
  // and Esc goes to the newest open screen first (kit.js screens: the chooser and the dossier are on that stack; their Esc here is for
  // one that is off it).
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  addEventListener('keydown', e => {
    if (e.defaultPrevented || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; const k = e.code;
    if (k === 'KeyU' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); const s = nextSkin(); toast(`Skin: ${s}`); return; }
    if (k === 'KeyP' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); const on = city.setPins(!city.pins); toast(on ? 'Citizen pins on' : 'Citizen pins off'); return; }
    if (chooser && k === 'Escape') { e.preventDefault(); e.stopPropagation(); closeChooser(); return; }
    if (!dossier.isOpen) return;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); dossier.close(); return; }
    if (k === 'KeyF') {   // F: start following the open agent. Held F (key repeat) and F while the camera already follows them are the camera's own
      // "further" (zoom out: camera/follow.js, nav.js): let those through, so holding F never flips follow ↔ orbit 30× a second. Photo mode keeps its F.
      const rig2 = api.cam, already = rig2?.mode === 'follow' && rig2.subject?.agent && rig2.subject.aid === dossier.current;
      if (e.repeat || already || document.body.classList.contains('cam-photo')) return;
      e.preventDefault(); e.stopPropagation(); dossier.toggleFollow(); return; }
    if (k === 'BracketLeft' || k === 'BracketRight') { e.preventDefault(); e.stopPropagation(); dossier.step(k === 'BracketLeft' ? -1 : 1); return; }
  }, true);
  // the day / night reload: what the viewer has open comes back on the new page (ui/reload.js; review 10-09 #2)
  const keep = keepAcrossReload({ api, sim, dossier, city, menu, refs: () => ({ map, info, tape: tapeCtl }), tape });
  // the sim offline: every LIVE badge says OFFLINE until it answers again (the store's status is never delayed; review 10-09 #13)
  sim.on('status', ({ status }) => simOffline(status === 'offline')); simOffline(sim.info.status === 'offline');
  // the frame hook: pins, rings, hover, the label on whoever the rig follows
  const frame = (dt, t) => { try { tapeCtl.frame(dt); light.frame(dt); menu.frame(); const s = rig?.mode === 'follow' ? rig.subject : null; city.follow(s?.agent ? s.aid : null); city.frame(dt, t); } catch (e) { if (!frame.failed) { frame.failed = true; console.error('[ui]', e); } } };
  // the portrait renderer warms up when the page is idle
  (window.requestIdleCallback || (f => setTimeout(f, 3000)))(() => portraits.prewarm(), { timeout: 8000 });
  const ui = { frame, claimed: e => city.claimed === e, sim, city, dossier, portraits, root, skin: getSkin, nextSkin, tape: tapeCtl, info, map, menu, keep, light,
    stats: () => ({ skin: getSkin(), dossier: dossier.current, ...city.stats(), portraits: portraits.stats(), tape: tapeCtl.stats(), light: light.stats(), info: info.stats(), map: map.stats(), menu: menu.stats() }) };
  api.ui = ui; window.__ui = ui;
  return ui;
}
