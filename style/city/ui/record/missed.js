// C1-9, the drawn half · THE MISSED-EVENT CARD ON THE RECORD PATH (TV plan A4; GAME.md §20 "the small paper card that takes you to a
// replay of an event you missed"). ui/record/tape.js decides what was missed (a fight or an arrest published while its place was never
// on screen, TV mode off); this file only draws it:
//   card     top right, one small paper card at a time: MISSED, the public action, the victim's name, the place and the island time,
//            ▶ Replay and ×. 12 s at full size, then it folds into the pill
//   pill     "N missed": the cards not yet replayed or dismissed; a click shows the newest again
//   pace     at most one new card per 20 s; the rest wait in the pill. It never takes focus, moves the camera or plays a sound
// Words come from the tape's typed fields only (tape.js words()), never event text.
import { h, button } from '../kit.js';

export const MISSED = { everyS: 20, lifeS: 12, keep: 30 };

export function createMissed({ root, onReplay }) {
  const kind = h('b', { class: 'r-paper-what' }), line = h('span', { class: 'r-paper-line' });
  const replay = button('Replay', { icon: 'tapeplay', tip: 'Replay it from the moment it happened', cls: 'r-paper-replay', onclick: () => { const it = shown; if (!it) return; drop(it); onReplay(it.paper); } });
  const x = button('', { icon: 'close', tip: 'Dismiss', cls: 'r-paper-x', onclick: () => { if (shown) drop(shown); } });
  const card = h('div', { class: 'r-paper', hidden: true }, h('span', { class: 'r-paper-tag' }, 'MISSED'), h('div', { class: 'r-paper-text' }, kind, line), replay, x);
  const pill = button('', { tip: 'The events you missed', cls: 'r-paper-pill', onclick: () => { const it = list.at(-1); if (it) show(it, performance.now()); } });
  pill.hidden = true; pill.classList.remove('is-icon'); pill.removeAttribute('aria-label');
  const el = h('aside', { id: 'r-missed', class: 'r-missed', 'aria-label': 'Missed events', 'data-safe-avoid': '' }, card, pill);
  root.append(el);
  let list = [], shown = null, shownAt = 0, lastNew = -1e9;
  function show(it, now) {
    shown = it; it.seen = true; shownAt = now; kind.textContent = it.what; line.textContent = it.line;
    card.dataset.ev = String(it.paper.id); card.hidden = false; paint();
  }
  function drop(it) { list = list.filter(o => o !== it); if (shown === it) { shown = null; card.hidden = true; } paint(); }
  function paint() {
    const waiting = list.filter(o => o !== shown).length;
    pill.hidden = !waiting; pill.querySelector('.k-btn-label')?.remove();
    if (waiting) pill.append(h('span', { class: 'k-btn-label' }, `${waiting} missed`));
    el.hidden = card.hidden && pill.hidden;
  }
  return {
    el,
    // a missed event: { paper (tape-data's paper row), what, line }
    push(it, now = performance.now()) {
      if (list.some(o => o.paper.id === it.paper.id)) return false;
      list.push(it); if (list.length > MISSED.keep) list = list.slice(-MISSED.keep);
      if (now - lastNew >= MISSED.everyS * 1000) { lastNew = now; show(it, now); } else paint();
      return true;
    },
    frame(now = performance.now()) {
      if (shown && now - shownAt > MISSED.lifeS * 1000) { shown = null; card.hidden = true; paint(); }
      const next = list.filter(o => o !== shown).at(-1);
      if (!shown && next && !next.seen && now - lastNew >= MISSED.everyS * 1000) { next.seen = true; lastNew = now; show(next, now); }
    },
    clear() { list = []; shown = null; card.hidden = true; paint(); },
    // (C1-9b: only the cards whose event the playhead has published: a seek back before one takes its card, shown or waiting)
    retain(keep) { const n = list.length; list = list.filter(o => keep(o.paper.id)); if (shown && !keep(shown.paper.id)) { shown = null; card.hidden = true; } if (list.length !== n || card.hidden) paint(); },
    get shown() { return shown ? shown.paper.id : null; }, get count() { return list.length; },
    stats: () => ({ shown: shown?.paper.id ?? null, waiting: list.length, lastNew }),
  };
}
