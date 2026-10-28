// HUMAN LAYER · SECTION 3a · WHAT'S GOING ON IN THE CITY, at a glance (mounted by ui/index.js, before the tape so Esc closes these first).
//   always on   the ticker and the clock: one slim bar along the very bottom edge (ticker.js). The bottom row above it (the camera bar,
//               its hints, the LIVE/Tape chip, the tape's transport) sits on top of it, lifted by its height (city-info.css).
//   on demand   City TV, "CH 9 NEWS" (N: tv.js) · The City: ladders, turf, economy, crime, the dead (L: boards.js). One side panel at a
//               time, docked opposite the dossier; Esc closes it. Loaded on first open; closed, nothing of theirs runs.
//   keys        N City TV · L the City · Shift+N the ticker on/off · Esc close (all in ui/KEYS.md)
// Clicking a @handle anywhere opens the dossier (dossier.open); a place or a district sends the camera there (ui/goto.js, shared with 3b).
import { h, button, lens as lensBadge, panel, toast, screens } from '../kit.js';
import { tape } from '../tape/state.js';
import { createTicker } from './ticker.js';

export function mountCityInfo(api, { sim, dossier, root }) {
  if (!document.querySelector('link[data-ci-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./city-info.css', import.meta.url).href, 'data-ci-css': '' }));
  const openAgent = handle => { if (!handle) return; if (!sim.agent(handle) && !tape.active) { toast(`@${handle} isn’t in the city`); return; } dossier.open(handle); };
  // ── the side panels (one at a time): a kit panel with a header; built on first open
  const sheets = {}; let cur = null;
  function sheet(id, title, sub) {
    if (sheets[id]) return sheets[id];
    const P = panel({ side: 'right', label: title }), badge = lensBadge('live'), x = button('', { icon: 'close', tip: 'Close (Esc)', cls: 'ci-x', onclick: () => close() });
    P.el.classList.add('ci-sheet', 'ci-sheet-' + id); P.el.setAttribute('data-safe-avoid', '');
    const body = h('div', { class: 'ci-body' });
    P.el.append(h('header', { class: 'ci-head' }, h('div', { class: 'ci-title' }, h('h2', null, title), h('span', null, sub)), badge, x), body); root.append(P.el);
    return sheets[id] = { P, body, badge, ui: null };
  }
  // dock opposite the dossier (it docks away from its agent); with the dossier closed, on the right
  const side = () => dossier.isOpen && dossier.el.classList.contains('dock-right') ? 'left' : 'right';
  const mo = new MutationObserver(() => { if (cur) sheets[cur].P.dock(side()); }); mo.observe(dossier.el, { attributes: true, attributeFilter: ['class'] });
  async function show(id) {
    if (cur === id) return close(); if (cur) close();
    const S = id === 'tv' ? sheet('tv', 'CH 9 News', 'the city’s own channel') : sheet('city', 'The City', 'ladders · turf · money · crime · the dead');
    if (!S.ui) { try { S.ui = id === 'tv' ? (await import('./tv.js')).createTV({ api, sim, tape, host: S, openAgent }) : (await import('./boards.js')).createBoards({ api, sim, tape, host: S, openAgent }); }
      catch (e) { console.error('[city-info]', e); toast('This panel failed to load'); return; } }
    // (the Esc stack: kit.js)
    cur = id; S.P.dock(side()); S.P.open(); S.ui.open(); screens.open('panel', { esc: close, isOpen: () => !!cur });
    ticker.el.querySelectorAll('.ci-b').forEach((b, k) => b.classList.toggle('is-on', (k === 0) === (id === 'tv')));
  }
  function close() { if (!cur) return false; const S = sheets[cur]; cur = null; screens.close('panel'); S.ui?.close(); S.P.close(); ticker.el.querySelectorAll('.ci-b').forEach(b => b.classList.remove('is-on')); return true; }
  const ticker = createTicker({ api, sim, tape, root, openAgent, onTV: () => show('tv'), onCity: () => show('city') });
  // ── keys (capture; registered before the tape's, so Esc closes an open panel here before it means "back to LIVE")
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  addEventListener('keydown', e => {
    if (e.defaultPrevented || typing(e) || e.metaKey || e.ctrlKey || e.altKey || window.__toys?.diary?.isOpen || document.body.classList.contains('cam-photo')) return;
    const k = e.code; let used = true;
    if (k === 'KeyN' && e.shiftKey) { const on = ticker.toggle(); toast(on ? 'News ticker on' : 'News ticker off (Shift+N)'); }
    else if (k === 'KeyN') show('tv');
    else if (k === 'KeyL' && !e.shiftKey) show('city');
    else if (k === 'Escape' && cur) close();
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  const ci = { ticker, show, close, get open() { return cur; }, sheets, stats: () => ({ panel: cur, ticker: ticker.stats(), tv: sheets.tv?.ui ? { open: sheets.tv.ui.isOpen, cards: sheets.tv.ui.cards.length } : null, city: sheets.city?.ui ? { open: sheets.city.ui.isOpen, tab: sheets.city.ui.tab } : null }) };
  window.__cityinfo = ci; return ci;
}
