// C1-10, the drawn half · THE MORNING CARDS ON THE RECORD PATH (Y, or the Cards button): the night's top 5 at dawn, pictures first, one
// line of words. Every value is cardsAt's (simstate/record/cards.js) for the presented snapshot at the playhead (the latest morning's
// night), and a card's picture comes only from its typed card: the faces are subjects.agent and subjects.others (ui/portrait.js, the
// same look the city draws for that id; Booked wears the county jumpsuit, a mugshot), the piece is card.pieces. A masked Took shows a
// ski mask and names no one, even after disclosure. Replay goes through ui/record/replay.js, the one call C1-9 replaces.
// They open on their own when a new morning's cards arrive during play (unless CH 9 or the map has the centre), never on a fresh load
// or a seek: those only set the morning already seen (the baseline). The 06:00 reload carries it in the URL (?cardsSeen=), so the
// morning that arrives with the reload still opens them. They share the centre with CH 9.
import * as THREE from 'three';
import { h as h0, button, screens } from '../kit.js';
import { cardsAt } from '../../simstate/record/cards.js';
import { boardAt } from '../../simstate/record/board-data.js';
import { createPortraits } from '../portrait.js';
import { bval } from './board.js';
import { traitName } from './board-format.js';
import { sameInputs } from './view.js';
import { watchDrawing } from './drawing.js';

const h = (tag, attrs, ...kids) => h0(tag, attrs, ...kids.flat(Infinity));
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));
const WORDS = { Took: 'took', Turned: 'turned on', Booked: 'booked', Bought: 'bought', Outbid: 'outbid on' };

export function createCards({ sim, root, sceneOf, onReplay, onOpen = () => {}, seen = null, onSeen = () => {} }) {
  const el = h('section', { id: 'r-cards', class: 'r-panel r-cards', role: 'dialog', 'aria-label': 'The morning cards', 'aria-hidden': 'true', hidden: true });
  const title = h('h2', { class: 'r-title' }), list = h('div', { class: 'm-cards' });
  el.append(h('header', { class: 'r-head' }, h('div', { class: 'r-id' }, title, h('div', { class: 'r-sub' }, h('span', { class: 'r-live' }, 'PUBLIC'), ' · the night’s top 5')),
    button('', { icon: 'close', tip: 'Close (Y or Esc)', cls: 'r-x', onclick: () => close() })), list);
  root.append(el);
  const drawing = watchDrawing(root, el, [title, list]);
  let open = false, sig = '', lastNight = seen, based = seen !== null, portraits = null;
  const faces = () => portraits ??= createPortraits({ THREE });
  // a face: the agent's look for its id (a mugshot for Booked); its img fills in when the thumbnail is ready
  function face(s, B, path, id, { jailed = false, lost = false } = {}) {
    const name = s.board?.agents?.find(a => a.id === id)?.name ?? null;
    const img = h('img', { class: 'm-img', alt: name ?? id, 'data-agent': id });
    const cached = faces().thumbNow(id, jailed); if (cached) img.src = cached; else faces().thumb(id, jailed).then(u => { if (u) img.src = u; }).catch(() => {});
    return h('figure', { class: 'm-face' + (jailed ? ' is-mug' : '') + (lost ? ' is-lost' : ''), 'data-agent': id }, h('div', { class: 'm-frame' }, img),
      h('figcaption', null, name ? h('span', { class: 'b-name', 'data-name': id }, name) : null, bval(B, path, id, 'agent', 'small')));
  }
  const mask = path => h('figure', { class: 'm-face is-masked', 'data-k-masked': path }, h('div', { class: 'm-frame' }, h('div', { class: 'm-hood', 'aria-label': 'A ski mask' })), h('figcaption', null, 'ski mask'));
  const piece = (B, i, p, j, struck = false) => h('div', { class: 'm-piece' + (struck ? ' is-struck' : ''), 'data-trait': p.trait }, bval(B, `cards.${i}.pieces.${j}.trait`, p.trait, 'trait', 'span'));
  function card(s, B, c, i) {
    const subj = c.subjects.agent, others = c.subjects.others, path = `cards.${i}.subjects`;
    const main = subj ? face(s, B, `${path}.agent`, subj, { jailed: c.kind === 'Booked' }) : mask(`${path}.agent`);
    const rest = others.map((o, j) => face(s, B, `${path}.others.${j}`, o, { lost: c.kind === 'Took' || c.kind === 'Turned' }));
    const pieces = c.pieces.map((p, j) => piece(B, i, p, j, c.kind === 'Outbid'));
    const pic = h('div', { class: 'm-pic is-' + c.kind.toLowerCase() }, main, pieces.length || rest.length ? h('div', { class: 'm-arrow', 'aria-hidden': 'true' }, c.kind === 'Took' ? '←' : c.kind === 'Turned' ? '✕' : '') : null,
      pieces.length ? h('div', { class: 'm-pieces' }, pieces) : null, rest);
    // one line of words: the kind's verb, its pieces' names, the value moved and where
    const line = h('p', { class: 'm-line' }, WORDS[c.kind] ?? null, c.pieces.length ? [' ', c.pieces.map(p => traitName(B, p.trait)).join(', ')] : null,
      ' · ', bval(B, `cards.${i}.value`, c.value, 'value', 'b'), c.place ? [' · ', bval(B, `cards.${i}.place`, c.place, 'place', 'span')] : null);
    const scene = sceneOf(c.replay);
    return h('article', { class: 'm-card is-' + c.kind.toLowerCase(), 'data-row': 'cards', 'data-i': String(i), 'data-ev': String(c.source.eventId), 'data-kind': c.kind },
      h('div', { class: 'm-top' }, h('span', { class: 'm-rank' }, '#' + c.rank), bval(B, `cards.${i}.kind`, c.kind, 'kind', 'b', 'm-kind'), c.masked ? bval(B, `cards.${i}.masked`, c.masked, 'masked', 'small', 'm-mask') : null),
      pic, line,
      button(scene ? 'Replay' : 'The night', { icon: 'tapeplay', tip: scene ? 'Watch it in the show' : 'Watch that night’s show', cls: 'm-replay', onclick: () => onReplay(c.replay) }));
  }
  function update(force = false, s = sim.record()) {
    // (the morning: the night cardsAt reads by default, snapshot.day - 1, with cards or without)
    const cards = cardsAt(s, undefined, s.minute), night = s.day == null ? null : s.day - 1;
    // a new morning's cards open on their own, once; the first look after a load or a seek is the baseline
    if (!based) { based = true; lastNight = night; if (night !== null) onSeen(night); }
    else if (night !== null && night !== lastNight) { lastNight = night; if (cards.length && !open && onOpen('auto') !== false) show(s, false); onSeen(night); }
    if (!open) return;
    const k = [s.board, night, JSON.stringify(cards)];
    el.dataset.minute = String(s.minute);
    if (!force && sameInputs(sig, k) && drawing.intact()) return;
    drawing.repair();
    const B = boardAt(s, s.minute);
    title.textContent = cards.length ? `Night ${cards[0].night}` : 'The morning cards';
    fill(list, cards.length ? cards.map((c, i) => card(s, B, c, i)) : h('p', { class: 'r-none' }, 'No cards this morning.'));
    sig = k; drawing.painted();
  }
  function show(s = sim.record(), refresh = true) { if (open) return; open = true; el.hidden = false; el.setAttribute('aria-hidden', 'false'); sig = ''; if (refresh) update(true, s); screens.open('r-cards', { esc: close, isOpen: () => open }); }
  function close() { if (!open) return; open = false; el.hidden = true; el.setAttribute('aria-hidden', 'true'); screens.close('r-cards'); }
  return { open: () => { onOpen('user'); show(); }, close, rebase: () => { based = false; }, toggle: () => open ? close() : (onOpen('user'), show()), update, get isOpen() { return open; }, get night() { return lastNight; }, el };
}
