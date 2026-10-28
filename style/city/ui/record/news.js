// C1-11, the drawn half · THE TICKER AND CH 9 ON THE RECORD PATH, from newsAt's two spans and each story's `parts` only.
//   ticker   along the bottom, over the record player: LIVE (the newest public stories first), then RECORD (the newest disclosed
//            stories, each wearing the disclosed-record badge). The track scrolls; hover holds it.
//   CH 9     the island's channel (N, or the CH 9 button), top centre between the side panels: the top story (newsAt's presentation
//            weight, newest first among equals), the next three, and the newest
//            two from the 24-hour record. During a show the pool is what its scenes have released (the staged reveal's ids). The show's banner comes from C1-6's staged player (its actual start and close).
// No story is written here: the words are panel-events.js's, rendered as text.
import { h, button, screens } from '../kit.js';
import { newsAt } from '../../simstate/record/panel-data.js';
import { rowEl, recordBadge } from './parts.js';
import { fill } from './dossier.js';
import { clock } from './format.js';
import { windowAt, sameInputs, LIVE, RECORD } from './view.js';
import { watchDrawing } from './drawing.js';

export function createTicker({ sim, root }) {
  const track = h('div', { class: 'r-track' }), el = h('div', { id: 'r-ticker', class: 'r-panel r-ticker', role: 'region', 'aria-label': 'News ticker' }, h('div', { class: 'r-tick-k' }, 'NEWS'), h('div', { class: 'r-tick-win' }, track));
  root.append(el);
  const drawing = watchDrawing(root, el, [track]);
  let sig = null, on = true;
  function update(force = false, s = windowAt(sim.record())) {
    if (!on) return;
    const k = [s.board, ...s.uiWindow.ticker];
    el.dataset.minute = String(s.minute);
    if (!force && sameInputs(sig, k) && drawing.intact()) return;
    drawing.repair();
    const n = newsAt(s, s.minute), live = n.live.slice(-LIVE).reverse(), rec = n.record.slice(-RECORD).reverse();
    fill(track, h('span', { class: 'r-live' }, 'LIVE'), ...live.map(r => rowEl(r, { list: 'news.live', tag: 'span' })),
      rec.length ? h('span', { class: 'r-tick-sep' }, 'FROM THE 24-HOUR RECORD') : null, ...rec.map(r => rowEl(r, { list: 'news.record', tag: 'span' })));
    sig = k; drawing.painted();
    // (the scroll's length follows the track's: about 60 px a second)
    requestAnimationFrame(() => { const w = track.scrollWidth; track.style.setProperty('--r-tick-s', Math.max(20, Math.round(w / 60)) + 's'); });
  }
  return { el, update, get on() { return on; }, toggle() { on = !on; el.hidden = !on; if (on) { sig = ''; update(); } return on; } };
}

export function createCh9({ sim, root, showOf }) {
  const banner = h('div', { class: 'r-ch9-banner' }), top = h('div', { class: 'r-ch9-top' }), more = h('ul', { class: 'r-list r-rows' }), rec = h('ul', { class: 'r-list r-rows' });
  const el = h('section', { id: 'r-ch9', class: 'r-panel r-ch9', role: 'dialog', 'aria-label': 'CH 9', hidden: true },
    h('header', { class: 'r-head' }, h('div', { class: 'r-id' }, h('h2', { class: 'r-title' }, 'CH 9'), h('div', { class: 'r-sub' }, h('span', { class: 'r-live' }, 'LIVE'), ' · island news')),
      button('', { icon: 'close', tip: 'Close (N or Esc)', cls: 'r-x', onclick: () => close() })),
    h('div', { class: 'r-body' }, banner, top, more, h('p', { class: 'r-note' }, recordBadge(), ' from the 24-hour record'), rec));
  root.append(el);
  const drawing = watchDrawing(root, el, [banner, top, more, rec]);
  let open = false, sig = null;
  function update(force = false, snapshot) {
    if (!open) return;
    const s = snapshot ?? windowAt({ ...sim.record(), show: showOf() }), show = s.show;
    const k = [s.board, show?.night, show?.start, show?.end, Math.floor(s.minute), ...s.uiWindow.ch9];
    el.dataset.minute = String(s.minute);
    if (!force && sameInputs(sig, k) && drawing.intact()) return;
    drawing.repair();
    const n = newsAt(s, s.minute);
    // (during the show: the stories its scenes have released so far, C1-6's staged reveal; else the newest)
    const shown = new Set(show && s.reveal?.night === show.night ? s.reveal.revealIds : []);
    const pool = (show ? n.live.filter(r => shown.has(r.id)) : n.live).slice(-20);
    const best = [...pool].reverse().sort((a, b) => b.weight - a.weight)[0] ?? null;
    fill(banner, ...(show ? [h('b', null, 'TONIGHT’S SHOW'), ` · night ${show.night} · ${clock(show.start)} to ${clock(show.end)}`] : [h('b', null, 'ON AIR'), ' · ', clock(s.minute)]));
    fill(top, best ? rowEl(best, { list: 'news.live', tag: 'div' }) : h('p', { class: 'r-none' }, 'Quiet on the island.'));
    fill(more, ...n.live.slice(-4).reverse().filter(r => r !== best).slice(0, 3).map(r => rowEl(r, { list: 'news.live' })));
    fill(rec, ...(n.record.length ? n.record.slice(-2).reverse().map(r => rowEl(r, { list: 'news.record' })) : [h('li', { class: 'r-none' }, 'Nothing disclosed yet.')]));
    sig = k; drawing.painted();
  }
  function show() { if (open) return; open = true; el.hidden = false; sig = ''; update(); screens.open('r-ch9', { esc: close, isOpen: () => open }); }
  function close() { if (!open) return; open = false; el.hidden = true; screens.close('r-ch9'); }
  return { el, open: show, close, update, toggle: () => open ? close() : show(), get isOpen() { return open; } };
}
