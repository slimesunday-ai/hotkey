// C1-11, the drawn half · THE UI ON THE RECORD PATH (?sim=record). main.js mounts it after record/page.js has started the player (never
// in shots, bakes, hashes or reports; ?ui=0 leaves it off). It reads the store's presented record (sim.record(), the playhead's
// snapshot: nothing from a later frame) through panel-data.js, and draws:
//   dossier  a click on an agent's walker (ui/city.js picking: drawn roster walkers only) → docked right (ui/record/dossier.js)
//   People   / or the People button → docked left: the roster, the heat ladder, the crews (ui/record/people.js)
//   map      B or the Map button → the paper map with police levels, corners and wanted posters (ui/record/map.js)
//   news     the ticker along the bottom (Shift+N hides it) and CH 9 (N), from newsAt's live and record spans (ui/record/news.js)
//   board    L or the Board button → docked right, sharing the dock with the dossier (C1-10: ui/record/board.js)
//   cards    Y or the Cards button → the morning cards, centre bottom, sharing the centre with CH 9; they open on their own at a new
//            morning (C1-10: ui/record/morning.js; Replay goes through ui/record/replay.js to C1-9's replay)
//   police   each district's police level now and tonight on the 3D map (C1-10: simstate/record/police-signs.js), from boardAt
//   TV       the director (C1-8: camera/director.js) and its face (ui/record/tv.js): the lower third, the menu's TV button (key 0)
//   tape     C1-9 (ui/record/tape.js): the scrubber over the season so far, folded into the record player's bar, with markers from
//            tape-data.js; a marker click goes there; the missed card top right and its replay; the replay's lower third
// The page asks for nothing but the feed and static files: the kit's web fonts are off here (kit.js mountRoot { fonts: false }).
// Every panel stops above the record player's controls (--r-bar: the bar's height from the bottom edge, measured).
// The open dossier and panels ride the URL (?dossier=, ?panels=), so they come back after the day / night reload (record/page.js).
import { mountRoot, tooltips, h, button, screens } from '../kit.js';
import { createCityLayer } from '../city.js';
import { createDossier } from './dossier.js';
import { createPeople } from './people.js';
import { createMap } from './map.js';
import { createTicker, createCh9 } from './news.js';
import { createBoard } from './board.js';
import { createCards } from './morning.js';
import { replayCard, sceneOf } from './replay.js';
import { createPoliceView } from './police.js';
import { refreshPanels } from './view.js';
import { createTv } from './tv.js';
import { createDirector } from '../../camera/director.js';
import { createRecordTape } from './tape.js';

export async function mountRecordUI(api, { Q, page }) {
  const { sim } = await import('../../simstate/store.js');
  const root = mountRoot(Q, { fonts: false }); tooltips();
  // (the stylesheets first: a panel restored after the reload measures its box at once — the map sizes its sheet from it)
  await Promise.all([['./record.css', 'data-r-css'], ['./board.css', 'data-b-css'], ['./tape.css', 'data-tape-css'], ['../map/map.css', 'data-map-css']].map(([href, key]) => new Promise(done => {
    if (document.querySelector(`link[${key}]`)) return done();
    const link = h('link', { rel: 'stylesheet', href: new URL(href, import.meta.url).href, [key]: '' }); link.onload = link.onerror = done; document.head.append(link); })));
  root.setAttribute('data-record', ''); document.body.classList.add('r-ui'); document.body.classList.toggle('dev', Q.get('dev') === '1');
  // the walkers record/draw.js placed: only drawn roster agents (a hooded agent has no walker during the show; a stand-in is the stage's)
  const whereOf = id => { const a = page.draw?.agents?.map.get(id); return a?.w ? { x: a.w.p[0], y: a.w.p[1], z: a.w.p[2], drawn: true } : null; };
  const pickSim = { agents: () => sim.agents(), where: whereOf, me: null };
  let chooser = null;
  const city = createCityLayer({ api, sim: pickSim, root, onPick: (id, o) => { closeChooser(); if (o?.cluster) return openChooser(o.cluster, o.x, o.y); openDossier(id); },
    onMiss: () => { closeChooser(); if (dossier.isOpen) dossier.close(); } });
  const dossier = createDossier({ api, sim, root, city, where: whereOf, onClose: keep });
  const people = createPeople({ sim, root, dossier: { open: id => openDossier(id) } });
  const map = createMap({ sim, root, onOpen: () => { dossier.close(); people.close(); ch9.close(); board.close(); cards.close(); closeChooser(); } });
  const ticker = createTicker({ sim, root });
  const showOf = () => { const s = page.player.snapshot().show; return s ? { night: s.night, start: s.start, end: s.end } : null; };
  const ch9 = createCh9({ sim, root, showOf });
  const board = createBoard({ sim, root, onOpen: () => { map.close(); dossier.close(); } });
  // (the cards open on their own at a new morning only when the centre is free; the morning already seen rides the URL, ?cardsSeen=)
  const cards = createCards({ sim, root, sceneOf: r => sceneOf(page, r), seen: Q.has('cardsSeen') ? +Q.get('cardsSeen') : null, onSeen: () => keep(),
    onOpen: why => { if (why === 'auto' && (ch9.isOpen || map.isOpen)) return false; map.close(); ch9.close(); },
    onReplay: r => { cards.close(); keep(); ui.replayed = replayCard(page, r, { tape }); } });
  const police = createPoliceView({ THREE: api.THREE, scene: api.scene });
  // C1-8 · the director: TV mode by night (the show's cut) and by day; the camera goes back where it was after a scene or a replay
  const tv = createTv({ root, onToggle: () => { if (!director) return; if (director.mode === 'off') director.start('viewer'); else director.stop('viewer'); } });
  let director = null;
  try { if (api.cam && page.frames) director = createDirector({ api, page, Q, ui: tv, frames: page.frames }); } catch (e) { console.error('[record tv]', e); }
  // C1-9 · the tape: the scrubber, its markers, the missed card and the replays (the director frames them)
  let tape = null;
  try { tape = createRecordTape({ api, page, sim, Q, root, director, dossier, uiBusy: () => map.isOpen || (!!api.cam && ['photo', 'fly', 'walk'].includes(api.cam.mode)) }); } catch (e) { console.error('[record tape]', e); }
  function openDossier(id) { map.close(); board.close(); dossier.open(id); }
  // the menu (top left): the same screens as the keys
  const bar = h('nav', { id: 'r-menu', class: 'r-menu', 'aria-label': 'Panels' },
    button('People', { kbd: '/', tip: 'People and the leaderboards (/)', onclick: () => { map.close(); people.toggle(); keep(); } }),
    button('Map', { kbd: 'B', tip: 'The island map (B)', onclick: () => { map.toggle(); keep(); } }),
    button('CH 9', { kbd: 'N', tip: 'CH 9, the island news (N)', onclick: () => { map.close(); cards.close(); ch9.toggle(); keep(); } }),
    button('Board', { kbd: 'L', tip: 'The board: the list, the streets, the fits, the vault (L)', onclick: () => { board.toggle(); keep(); } }),
    button('Cards', { kbd: 'Y', tip: 'The morning cards: the night’s top 5 (Y)', onclick: () => { cards.toggle(); keep(); } }),
    button('Ticker', { tip: 'The news ticker (Shift+N)', onclick: () => { ticker.toggle(); keep(); } }), tv.button);
  root.append(bar);
  function openChooser(ids, x, y) {
    const cards = new Map(sim.agents().map(c => [c.id, c]));
    chooser = h('div', { class: 'k-chooser', role: 'menu', 'aria-label': 'Who here' }, h('div', { class: 'k-h' }, `${ids.length} here`),
      ...ids.map(id => h('button', { type: 'button', role: 'menuitem', onclick: () => { closeChooser(); openDossier(id); } }, cards.get(id)?.name ?? id, h('span', null, '@' + id))));
    root.append(chooser);
    chooser.style.transform = `translate(${Math.round(Math.max(8, Math.min(innerWidth - chooser.offsetWidth - 8, x - chooser.offsetWidth / 2)))}px, ${Math.round(Math.max(8, Math.min(innerHeight - chooser.offsetHeight - 8, y + 14)))}px)`;
    screens.open('r-chooser', { esc: closeChooser, isOpen: () => !!chooser });
  }
  function closeChooser() { chooser?.remove(); chooser = null; screens.close('r-chooser'); }
  // the record player's bar: every panel stops above it
  const fitBar = () => { const r = document.getElementById('record-player')?.getBoundingClientRect(); root.style.setProperty('--r-bar', (r ? Math.ceil(innerHeight - r.top) + 8 : 14) + 'px'); };
  fitBar(); addEventListener('resize', fitBar);
  const rec = document.getElementById('record-player'); if (rec && typeof ResizeObserver !== 'undefined') new ResizeObserver(fitBar).observe(rec);
  // the rig's person picker steps aside for a release the UI claimed (a click on an agent opens the dossier instead of following)
  const rig = api.cam;
  if (rig?.people?.pick) { const pick0 = rig.people.pick; rig.people.pick = function (...a) { return city.claimed ? null : pick0.apply(this, a); }; }
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  addEventListener('keydown', e => {
    if (e.defaultPrevented || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const act = { Slash: () => { map.close(); people.toggle(); }, KeyB: () => map.toggle(), KeyN: () => e.shiftKey ? ticker.toggle() : (map.close(), cards.close(), ch9.toggle()),
      KeyL: () => board.toggle(), KeyY: () => cards.toggle() }[e.code];
    if (!act) return; e.preventDefault(); e.stopPropagation(); act(); keep();
  }, true);
  function keep() {
    const u = new URL(location.href), open = [people.isOpen && 'people', map.isOpen && 'map', ch9.isOpen && 'ch9', !ticker.on && 'noticker',
      board.isOpen && 'board', cards.isOpen && 'cards'].filter(Boolean);
    if (open.length) u.searchParams.set('panels', open.join(',')); else u.searchParams.delete('panels');
    if (cards.night !== null) u.searchParams.set('cardsSeen', cards.night); else u.searchParams.delete('cardsSeen');
    history.replaceState(history.state, '', u);
  }
  // one refresh per published change (a frame, a staged reveal, a seek, play/pause); each panel re-renders only when its input changed
  const panels = { ticker, ch9, people, map, dossier, board, cards, police };
  const update = () => refreshPanels(sim, panels, dossier.current, showOf);
  sim.on('tick', update); sim.on('epoch', () => { cards.rebase(); setTimeout(update); });
  // what was open before the reload
  const want = new Set((Q.get('panels') || '').split(',').filter(Boolean));
  if (want.has('noticker')) ticker.toggle();
  if (want.has('people')) people.open();
  if (want.has('ch9')) ch9.open();
  if (want.has('map')) map.open();
  if (want.has('board') && !Q.get('dossier')) board.open();
  if (want.has('cards')) cards.open();
  if (Q.get('dossier') && sim.agents().some(c => c.id === Q.get('dossier'))) dossier.open(Q.get('dossier'));
  update();
  // (the board's countdowns also move between published changes: once a game minute)
  let lastMin = null;
  const frame = (dt, t) => { try { tape?.frame(); director?.frame(dt); police.frame(api.camera, { framing: !!director?.framing, avoid: uiRects, canvas: api.renderer.domElement }); if (board.isOpen && Math.floor(page.player.minute) !== lastMin) { lastMin = Math.floor(page.player.minute); board.update(); } const s = rig?.mode === 'follow' ? rig.subject : null; city.follow(s?.agent ? s.aid : null); city.frame(dt, t); } catch (e) { if (!frame.failed) { frame.failed = true; console.error('[record ui]', e); } } };
  // (the screen boxes the police signs keep clear of: the menu, the ticker, the player's bar, the caption, an open panel)
  const uiRects = () => [...document.querySelectorAll('#r-menu, #r-ticker, #record-player, #r-tv-cap, #r-tape-cap, #r-missed, #k .k-panel, #k .r-panel, #k .k-chooser')]
    .filter(el => { if (el.hidden || el.offsetParent === null) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && +cs.opacity > .05; })
    .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight);
  const ui = { frame, claimed: e => city.claimed === e, sim, city, dossier, people, map, ticker, ch9, board, cards, police, tv, director, tape, replayed: null, root, showOf, pickable: () => city.visible(),
    stats: () => ({ dossier: dossier.current, people: people.isOpen, map: map.isOpen, ch9: ch9.isOpen, ticker: ticker.on, board: board.isOpen, cards: cards.isOpen, ...city.stats() }) };
  api.ui = ui; window.__recordUI = ui;
  return ui;
}
