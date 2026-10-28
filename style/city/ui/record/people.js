// C1-11, the drawn half · PEOPLE AND ITS LEADERBOARDS ON THE RECORD PATH (docked left). Roster: peopleAt(snapshot), the public cards.
// Heat: leadersAt's heat ladder (the board's own heat, sorted). Crews: leadersAt's crews by membership. No crime ladder, wealth or
// survival score: the record has none (PANELS.md). A row opens that agent's dossier. Values print through format.js with their paths.
import { h, button, panel as makePanel, screens, tabs as makeTabs } from '../kit.js';
import { peopleAt, leadersAt } from '../../simstate/record/panel-data.js';
import { val, fill } from './dossier.js';
import { sameInputs } from './view.js';
import { watchDrawing } from './drawing.js';

const FLAGS = ['wanted', 'jailed', 'evicted', 'boarded'];
export function createPeople({ sim, root, dossier }) {
  const P = makePanel({ side: 'left', label: 'People' }); P.el.id = 'r-people'; P.el.classList.add('r-panel'); root.append(P.el);
  const body = h('div', { class: 'k-scroll r-body' });
  let sig = '';
  const tabs = makeTabs([{ id: 'roster', label: 'Roster' }, { id: 'heat', label: 'Heat' }, { id: 'crews', label: 'Crews' }], { onchange: () => { sig = ''; update(); } });
  P.el.append(h('header', { class: 'r-head' }, h('div', { class: 'r-id' }, h('h2', { class: 'r-title' }, 'People'), h('div', { class: 'r-sub' }, h('span', { class: 'r-live' }, 'PUBLIC'), ' · the island’s board')),
    button('', { icon: 'close', tip: 'Close (Esc)', cls: 'r-x', onclick: () => close() })), tabs.el, body);
  const drawing = watchDrawing(root, P.el, [body]);
  const row = (list, id, kids) => h('li', { class: 'r-person', 'data-row': list, 'data-agent': id, tabindex: '0', role: 'button', onclick: () => dossier.open(id),
    onkeydown: e => { if (e.key === 'Enter') dossier.open(id); } }, ...kids);
  function update(force = false, s = sim.record()) {
    if (!P.isOpen) return;
    const k = [tabs.selected, s.board];
    P.el.dataset.minute = String(s.minute);
    if (!force && sameInputs(sig, k) && drawing.intact()) return;
    drawing.repair();
    if (!s.board) { fill(body, h('p', { class: 'r-none' }, 'No people on the board yet.')); sig = k; drawing.painted(); return; }
    if (tabs.selected === 'roster') {
      const cards = peopleAt(s, null, s.minute);
      fill(body, h('ul', { class: 'r-list r-roster' }, ...cards.map(c => row('people', c.id, [
        h('span', { class: 'r-pname' }, val('name', c.name, 'name', 'b'), ' ', val('id', c.id, 'id', 'small')),
        h('span', { class: 'r-pmeta' }, val('trade', c.trade, 'trade', 'span'), c.crew ? [' · crew ', val('crew', c.crew, 'crew', 'span')] : null, ' · heat ', val('heat', c.heat, 'heat', 'span')),
        h('span', { class: 'r-pflags' }, ...FLAGS.filter(f => c[f]).map(f => h('span', { class: 'r-flag' + (f === 'wanted' ? ' is-wanted' : '') }, val(f, c[f], f, 'span'))))]))));
    } else if (tabs.selected === 'heat') {
      const L = leadersAt(s, s.minute), name = id => s.board.agents.find(a => a.id === id)?.name ?? '';
      fill(body, h('p', { class: 'r-note' }, 'The board’s heat stars, highest first.'), h('ol', { class: 'r-list r-ladder' }, ...L.heat.map((r, i) => row('leaders.heat', r.agent, [
        h('span', { class: 'r-rank' }, String(i + 1)), h('span', { class: 'r-pname' }, h('b', null, name(r.agent)), ' ', val(`leaders.heat.${i}.agent`, r.agent, 'agent', 'small')),
        h('span', { class: 'r-heat' }, '★ ', val(`leaders.heat.${i}.heat`, r.heat, 'heat', 'b')), r.wanted ? h('span', { class: 'r-flag is-wanted' }, val(`leaders.heat.${i}.wanted`, r.wanted, 'wanted', 'span')) : null]))));
    } else {
      const L = leadersAt(s, s.minute), name = id => s.board.agents.find(a => a.id === id)?.name ?? id;
      fill(body, L.crews.length ? h('ol', { class: 'r-list r-ladder' }, ...L.crews.map((c, i) => h('li', { class: 'r-crew', 'data-row': 'leaders.crews', 'data-crew': c.id },
        h('span', { class: 'r-rank' }, String(i + 1)), h('span', { class: 'r-pname' }, val(`leaders.crews.${i}.name`, c.name, 'name', 'b'), ' ', h('small', null, val(`leaders.crews.${i}.members`, c.members, 'members', 'span'), ' members')),
        h('span', { class: 'r-pmeta' }, c.members.map(name).join(', ')))))
        : h('p', { class: 'r-none' }, 'No crews yet.'));
    }
    sig = k; drawing.painted();
  }
  function open() { P.open(); screens.open('r-people', { esc: close, isOpen: () => P.isOpen }); sig = ''; update(); }
  function close() { P.close(); screens.close('r-people'); }
  return { open, close, toggle: () => P.isOpen ? close() : open(), update, select: id => { tabs.select(id, true); }, get isOpen() { return P.isOpen; }, el: P.el };
}
