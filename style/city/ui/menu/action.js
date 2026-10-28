// HUMAN LAYER · SECTION 4 · WHERE'S THE ACTION: one button (and the . key) jumps the camera to the newest notable public event and shows
// who was in it; again (.) steps back to the one before, , steps forward again. A card under the menu bar: what happened, when, where
// (a place: the camera goes there), the agents in it (one click: follow + the dossier, as People's rows; their beacons in the city).
//   notable   robberies, burglaries, arrests, deaths and killings, the Director's calls (rushes …), turf changes, bounties, warrants, the
//             hospital. LIVE: the store's public events (sim.events), so an unseen robber or a burglar is never named (the lens).
// Cost: closed, nothing. Open: the card's "how long ago" once a second (the store's tick), nothing per frame but the beacons.
import { h, set, attr, lens as lensBadge, toast } from '../kit.js';
import { flyTo, placesNow, resolve } from '../goto.js';
import { shotsFor } from '../../camera/shots.js';
import { svg } from './icons.js';

export const ACTION_TYPES = { rob: 'Robbery', burgle: 'Burglary', arrest: 'Arrest', death: 'Death', killed: 'Killing', director: 'The Director', turf: 'Turf', bounty: 'Bounty', warrant: 'Warrant', hospital: 'Hospital' };
const KIND_OF = { rob: 'crime', burgle: 'crime', killed: 'crime', death: 'death', arrest: 'law', warrant: 'law', bounty: 'law', director: 'city', turf: 'crew', hospital: 'death' };
const hhmm = t => { const m = ((t % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const ago = d => d < 2 ? 'just now' : d < 60 ? `${Math.round(d)}m ago` : d < 1440 ? `${Math.floor(d / 60)}h${Math.round(d % 60) ? ' ' + Math.round(d % 60) + 'm' : ''} ago` : `${Math.floor(d / 1440)}d ago`;

export function createAction({ api, sim, root, beacons, go, anchor = () => null, onChange = () => {} }) {
  const kind = h('span', { class: 'ac-kind' }), when = h('span', { class: 'ac-when' }), nth = h('span', { class: 'ac-n' }), badge = lensBadge('live');
  const x = h('button', { type: 'button', class: 'k-btn is-icon ac-x', 'data-tip': 'Close (Esc)', 'aria-label': 'Close' }, svg('close')); x.onclick = () => close();
  const text = h('p', { class: 'ac-text', 'aria-live': 'polite' }), where = h('button', { type: 'button', class: 'ac-where' }), who = h('div', { class: 'ac-who' });
  const newer = h('button', { type: 'button', class: 'k-btn ac-nav', 'data-tip': 'The one after (,)' }, svg('left'), h('span', { class: 'k-btn-label' }, 'Newer'), h('kbd', null, ','));
  const older = h('button', { type: 'button', class: 'k-btn ac-nav', 'data-tip': 'The one before (.)' }, h('span', { class: 'k-btn-label' }, 'Older'), h('kbd', null, '.'), svg('right'));
  newer.onclick = () => step(-1); older.onclick = () => step(1);
  const el = h('section', { class: 'mn-pop ac-card', role: 'dialog', 'aria-label': 'Where’s the action', hidden: true, 'data-safe-avoid': '' },
    h('header', { class: 'ac-head' }, kind, when, h('span', { class: 'ac-grow' }), badge, x), text, h('div', { class: 'ac-row' }, where), who, h('footer', { class: 'ac-foot' }, newer, nth, older));
  root.append(el);
  let isOpen = false, list = [], idx = 0, curId = null, unsub = null;
  const listNow = () => sim.events({ types: Object.keys(ACTION_TYPES) }).filter(e => e.text).slice(-60).reverse();   // (newest first)
  function open() { list = listNow(); if (!list.length) { toast('Nothing has happened yet. Quiet streets.'); return false; }
    isOpen = true; el.hidden = false; unsub = sim.on('tick', tick); onChange(true); return true; }
  function close() { if (!isOpen) return false; isOpen = false; el.hidden = true; unsub?.(); unsub = null; curId = null; beacons.show([]); onChange(false); return true; }
  // . : closed → the newest; open → one older. , : one newer
  function next() { if (!isOpen) { if (open()) show(0); return; } step(1); }
  function prev() { if (!isOpen) { if (open()) show(0); return; } step(-1); }
  function step(d) { list = listNow(); const k = Math.max(0, list.findIndex(e => e.id === curId)); const n = k + d; if (n < 0) { toast('That’s the newest'); return; } if (n >= list.length) { toast('That’s the oldest on the record'); return; } show(n); }
  function show(k) {
    idx = k; const e = list[k]; if (!e) return; curId = e.id;
    const ty = e.type === 'director' ? (e.kind ? e.kind.toUpperCase() : 'The Director') : ACTION_TYPES[e.type] || e.type; set(kind, ty); attr(kind, 'data-k', KIND_OF[e.type] || 'city');
    // the text, with each @handle a button (follow + the dossier)
    const parts = String(e.text).split(/(@[\w.\-]+[\w])/g); text.replaceChildren(...parts.map(p => p.startsWith('@') ? h('button', { type: 'button', class: 'ac-h', onclick: () => go(p.slice(1)) }, p) : p));
    const B = placesNow(), at = e.at, tgt = at ? (at.startsWith('dist:') ? { dist: at.slice(5) } : { place: at }) : null, r = tgt ? resolve(tgt) : null, nm = at ? (B?.name(at) || (at.startsWith('dist:') ? B?.distName(at.slice(5)) : null) || B?.distName(at) || at) : null;
    where.hidden = !r; if (r) { where.replaceChildren(svg('pin'), h('span', null, nm || r.label)); where.onclick = () => flyTo(api, tgt); attr(where, 'data-tip', 'Take the camera there'); }
    // the agents in it (public names only: the event's who/to and the @handles of its text)
    const hs = [...new Set([e.who, e.to, ...(String(e.text).match(/@([\w.\-]+[\w])/g) || []).map(s => s.slice(1))].filter(s => typeof s === 'string' && s && !s.startsWith('dist:')))].slice(0, 4);
    const cards = new Map(sim.agents().map(c => [c.handle, c]));
    who.replaceChildren(...hs.map(hh => { const c = cards.get(hh); return h('button', { type: 'button', class: 'ac-agent', 'data-tip': c ? `Follow @${hh} · ${c.now || ''}` : `@${hh}`, onclick: () => go(hh) },
      svg('follow'), h('b', null, '@' + hh), c ? h('span', null, c.now || '') : ''); }));
    who.hidden = !hs.length;
    beacons.show(hs.filter(hh => cards.has(hh)).map(hh => ({ handle: hh, card: cards.get(hh), sub: cards.get(hh).now || '' })));
    tick(); attr(newer, 'aria-disabled', k === 0 ? 'true' : null); attr(older, 'aria-disabled', k >= list.length - 1 ? 'true' : null); set(nth, `${k + 1} of ${list.length}`);
    frame(e, tgt, r, hs);
    position();
  }
  // THE SHOT (TV plan A2, camera/shots.js): the people in it, framed (a two-shot, a group), where they are now and within REACH m of its
  // place; nobody drawn there: the place (an establishing shot; a district: wide). Public only: the event's who / to and the @handles of
  // its text as the lens hands them over (an unseen robber or a burglar is never among them), never anyone shown only by district.
  const REACH = 40;
  function frame(e, tgt, r, hs) {
    if (!r && !hs.length) return false; if (r?.coarse) return flyTo(api, tgt);
    const people = hs.map(hh => { const w = sim.where(hh); return w?.drawn && !w.coarse ? { h: hh, x: w.x, y: w.y, z: w.z } : null; }).filter(Boolean);
    const anchor = r || people[0] || null, near = anchor ? people.filter(a => Math.hypot(a.x - anchor.x, a.z - anchor.z) <= REACH) : [];
    if (!near.length) return r ? flyTo(api, tgt) : false;
    shotsFor(api).go({ actors: near, scene: 'action:' + e.id, label: r?.label || '@' + near[0].h }); return true;
  }
  function tick() { const e = list[idx], ck = sim.clock(); if (!e) return; const today = ck && Math.floor(ck.t / 1440) === Math.floor(e.t / 1440); set(when, `${today ? '' : 'Day ' + (Math.floor(e.t / 1440) + 1) + ' · '}${hhmm(e.t)}${ck ? ' · ' + ago(ck.t - e.t) : ''}`); }
  // under its menu button, kept on screen
  function position() { const a = anchor(); if (!a) return; const r = a.getBoundingClientRect(), w = el.offsetWidth || 340; const left = Math.round(Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2))); el.style.left = left + 'px'; }
  addEventListener('resize', () => { if (isOpen) position(); });
  return { el, open, close, next, prev, get isOpen() { return isOpen; }, get current() { return list[idx] || null; }, stats: () => ({ open: isOpen, n: list.length, idx }) };
}
