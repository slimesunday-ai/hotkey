// C1-11, the drawn half · THE DOSSIER ON THE RECORD PATH. A click on an agent's walker opens it (ui/city.js picks only drawn roster
// walkers: a hooded stand-in is the stage's own figure, never an agent, so it opens no one's dossier). Every value is panel-data.js's,
// for the presented snapshot at the playhead: the card, the bounties on it, the rap (public, newest first), the 24-hour side (tapeAt,
// with recordSideAt when a replay supplies one), its home and its people. Values print through format.js; a value with no source is
// left out. Each value's element names its path (data-k), so tools/panelscenario.mjs can compare it with panelsAt at that minute.
import { h, button, panel as makePanel, screens, lens as lensBadge } from '../kit.js';
import { panelsAt, homeAt } from '../../simstate/record/panel-data.js';
import { recordSideAt } from '../../simstate/record/tape-data.js';
import { eventRow, subjectsOf } from '../../simstate/record/panel-events.js';
import { fmt, has, clock } from './format.js';
import { rowEl, recordBadge } from './parts.js';
import { windowAt, sameInputs, ROWS, TIES } from './view.js';
import { watchDrawing } from './drawing.js';

const LABEL = { trade: 'trade', driver: 'driver', crew: 'crew', heat: 'heat', wanted: 'wanted', jailed: 'jail', bail: 'bail', evicted: 'home', tab: 'compute tab',
  boarded: 'ferry', walk: 'walk', fit: 'fit', fitHidden: 'fit', lastSay: 'said today' };
// a value's element: <b data-k="card.heat">3</b>, or nothing when the value has no source
export { fill };
export function val(path, value, key = path.split('.').at(-1), tag = 'b') {
  const text = fmt(key, value);
  return text === null ? null : h(tag, { 'data-k': path }, text);
}
const stat = (label, el) => el ? h('div', { class: 'k-stat r-stat' }, h('span', null, label), el) : null;
const section = (title, ...kids) => h('section', { class: 'r-sec', 'data-sec': title }, h('h3', { class: 'r-h' }, title), ...kids);
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k !== null && k !== undefined && k !== false));
const nameOf = (board, id) => board?.agents?.find(a => a.id === id)?.name ?? null;

export function createDossier({ api, sim, root, city, where, onClose = () => {} }) {
  const P = makePanel({ side: 'right', label: 'Agent dossier' }); P.el.id = 'r-dossier'; P.el.classList.add('r-panel'); root.append(P.el);
  const title = h('h2', { class: 'r-title' }), sub = h('div', { class: 'r-sub' }), body = h('div', { class: 'k-scroll r-body' });
  const go = button('Go there', { icon: 'pin', tip: 'Fly the camera to this agent', onclick: () => goTo() });
  const x = button('', { icon: 'close', tip: 'Close (Esc)', cls: 'r-x', onclick: () => close() });
  P.el.append(h('header', { class: 'r-head' }, h('div', { class: 'r-id' }, title, sub), go, x), body);
  const drawing = watchDrawing(root, P.el, [title, sub, body]);
  let cur = null, sig = '', replay = null;
  function open(id) {
    if (!id) return;
    cur = id; sig = ''; city.select(id); P.open(); screens.open('r-dossier', { esc: close, isOpen: () => P.isOpen });
    update(true); keepInURL(); }
  function close() { if (!cur && !P.isOpen) return; cur = null; city.select(null); P.close(); screens.close('r-dossier'); keepInURL(); onClose(); }
  function keepInURL() { const u = new URL(location.href); if (cur) u.searchParams.set('dossier', cur); else u.searchParams.delete('dossier'); history.replaceState(history.state, '', u); }
  function goTo() {
    const w = where(cur) ?? homeAt(sim.record(), cur)?.address;
    if (w) api.goTo(w.x, w.z, cur);
  }
  // re-render when the presented record changed (a frame, a staged reveal, a seek), never per page frame
  function update(force = false, s = windowAt(sim.record(), cur)) {
    if (!cur) return;
    const k = [cur, s.board, Math.floor(s.minute), replay, ...s.uiWindow.dossier];
    body.dataset.minute = String(s.minute); body.dataset.frame = String(s.frame?.i ?? '');
    if (!force && sameInputs(sig, k) && drawing.intact()) return;
    drawing.repair(); render(s); sig = k; drawing.painted();
  }
  function render(s) {
    const p = panelsAt(s, cur, s.minute), c = p.card;
    fill(title, (c && val('card.name', c.name, 'name', 'span')) || '—');
    fill(sub, ...(c ? [val('card.id', c.id, 'id', 'span'), c.wanted ? h('span', { class: 'r-flag is-wanted' }, val('card.wanted', true, 'wanted', 'span')) : null,
      c.jailed ? h('span', { class: 'r-flag' }, val('card.jailed', true, 'jailed', 'span')) : null] : []));
    if (!c) { fill(body, h('p', { class: 'r-none' }, 'Not on the island’s board.')); return; }
    const f = path => val('card.' + path, c[path], path);
    const card = section('Card',
      ...['trade', 'driver', 'heat', 'wanted', 'jailed', 'bail', 'evicted', 'tab', 'boarded', 'walk'].map(k => stat(LABEL[k], f(k))),
      stat('crew', p.people?.crew ? h('span', null, val('people.crew.name', p.people.crew.name, 'name'), ' ', h('small', null, '(', f('crew'), ')')) : f('crew')),
      c.fitHidden ? stat('fit', f('fitHidden')) : stat('fit', f('fit')),
      c.lastSay ? h('blockquote', { class: 'r-say' }, val('card.lastSay', c.lastSay, 'lastSay', 'span')) : null);
    const bounties = section('Bounties', p.bounties.length ? h('ul', { class: 'r-list' }, ...p.bounties.map((b, i) => h('li', { class: 'r-bounty', 'data-row': 'bounties' },
      val(`bounties.${i}.amount`, b.amount, 'amount'), ' on ', val(`bounties.${i}.trait`, b.trait, 'trait', 'span'), has(b.tier) ? h('small', null, ' · ', val(`bounties.${i}.tier`, b.tier, 'tier', 'span')) : null)))
      : h('p', { class: 'r-none' }, 'No bounty on the board.'));
    const total = s.uiWindow.counts.rap;
    const rap = section('Rap', h('p', { class: 'r-note' }, h('span', { class: 'r-live' }, 'PUBLIC'), ` · newest first${total > ROWS ? ` · the last ${ROWS} of ${total}` : ''}`),
      p.rap.length ? h('ul', { class: 'r-list r-rows' }, ...p.rap.slice(0, ROWS).map(r => rowEl(r, { list: 'rap' }))) : h('p', { class: 'r-none' }, 'Nothing public yet.'));
    fill(body, card, bounties, rap, side(p, s), home(p), people(p, s));
    body.dataset.minute = String(s.minute); body.dataset.frame = String(s.frame?.i ?? '');
  }
  // the 24-hour side: what the record has disclosed by now, under its badge; a replay's side when one is supplied
  function side(p, s) {
    const t = p.tape, m = t.memory;
    const head = h('p', { class: 'r-note' }, recordBadge(), ' as of ', val('tape.asOf', t.asOf, 'asOf', 'span'));
    if (t.pending) return section('24 hours', head, h('p', { class: 'r-none' }, 'Nothing of theirs has come out yet: private moves reach the record a game day late.'));
    const mem = m ? h('div', { class: 'r-mem', 'data-row': 'tape.memory' },
      h('p', { class: 'r-note' }, 'Memory as of day ', val('tape.memory.asOfDay', m.asOfDay, 'asOfDay', 'span'), has(m.asOfClock) ? [' · ', val('tape.memory.asOfClock', m.asOfClock, 'asOfClock', 'span')] : null),
      ...(m.plan ?? []).map((q, i) => stat('plan', h('span', null, val(`tape.memory.plan.${i}.trait`, q.trait, 'trait', 'span'), ' · ', val(`tape.memory.plan.${i}.routes`, q.routes, 'routes', 'span')))),
      ...(m.orders ?? []).map((o, i) => stat('order', h('span', null, ...['kind', 'item', 'units', 'agent', 'stars', 'max', 'min'].flatMap(k => has(o[k]) ? [val(`tape.memory.orders.${i}.${k}`, o[k], k, 'span'), ' '] : [])))),
      ...(m.creed ?? []).map((line, i) => h('blockquote', { class: 'r-say' }, val(`tape.memory.creed.${i}`, line, 'creed', 'span'))),
      ...(m.journal ?? []).map((j, i) => stat('journal', h('span', null, 'day ', val(`tape.memory.journal.${i}.day`, j.day, 'day', 'span'), ': ', val(`tape.memory.journal.${i}.line`, j.line, 'line', 'span')))))
      : null;
    const events = t.events.slice(-ROWS).reverse();
    const kids = [head, t.holdings ? h('ul', { class: 'r-list r-rows' }, rowEl(t.holdings, { list: 'tape.holdings' })) : null, mem,
      events.length ? h('ul', { class: 'r-list r-rows' }, ...events.map(r => rowEl(r, { list: 'tape.events' }))) : null];
    if (replay) {
      const r = recordSideAt(replay.replay, replay.disclosed);
      const rows = r.events.filter(e => subjectsOf(e).includes(cur)).slice(0, ROWS)
        .map(e => eventRow(e, replay.disclosed.board)).filter(Boolean);
      kids.push(h('div', { class: 'r-replay', 'data-row': 'replay' }, h('p', { class: 'r-note' }, lensBadge('tape', `replay of ${clock(r.minute)}`)),
        rows.length ? h('ul', { class: 'r-list r-rows' }, ...rows.map(e => rowEl(e, { list: 'replay.events' }))) : h('p', { class: 'r-none' }, 'Nothing more than 24 hours old from that moment.')));
    }
    return section('24 hours', ...kids);
  }
  function home(p) {
    const a = p.home?.address;
    return section('Home', a ? h('div', null, stat('address', val('home.address.name', a.name, 'name')), stat('district', val('home.address.district', a.district, 'district')),
      stat('tenancy', val('home.evicted', p.home.evicted, 'evicted'))) : h('p', { class: 'r-none' }, 'No address.'));
  }
  function people(p, s) {
    const tie = list => (t, i) => h('li', { class: 'r-tie', 'data-row': list, 'data-agent': t.agent }, h('span', { class: 'r-when' }, clock(t.minute)), ' ',
      h('span', null, nameOf(s.board, t.agent) ?? ''), ' ', val(`people.${list}.${i}.agent`, t.agent, 'agent', 'small'), ' · ', val(`people.${list}.${i}.type`, t.type, 'type', 'span'));
    const newest = list => p.people[list].slice(-TIES).map((t, i, rows) => [t, s.uiWindow.counts[list] - rows.length + i]).reverse();
    return section('People',
      p.people.crew ? stat('crew members', val('people.crew.members', p.people.crew.members, 'members')) : null,
      h('p', { class: 'r-note' }, h('span', { class: 'r-live' }, 'PUBLIC'), ' · seen together'),
      p.people.public.length ? h('ul', { class: 'r-list' }, ...newest('public').map(([t, i]) => tie('public')(t, i))) : h('p', { class: 'r-none' }, 'No public ties yet.'),
      h('p', { class: 'r-note' }, recordBadge(), ' · on the record'),
      p.people.record.length ? h('ul', { class: 'r-list' }, ...newest('record').map(([t, i]) => tie('record')(t, i))) : h('p', { class: 'r-none' }, 'Nothing disclosed yet.'));
  }
  return { open, close, update, get current() { return cur; }, get isOpen() { return P.isOpen; }, el: P.el,
    // a replay (C1-9's tape) supplies { replay: snapshot at the replayed minute, disclosed: the retained later horizon }; null clears it
    setReplay(r) { replay = r ? { ...r, key: `${r.replay.minute}|${r.disclosed.minute}` } : null; update(true); } };
}
