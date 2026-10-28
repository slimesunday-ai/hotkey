// C1-10, the drawn half · THE BOARD ON THE RECORD PATH (L, or the Board button), docked right: it shares the right dock with the dossier
// (opening one closes the other). Every value is boardAt's (simstate/record/board-data.js) for the presented snapshot at the playhead,
// printed through board-format.js, as text. The header: the countdowns to the lock and the ferry and the next shipment's night. Tabs:
//   Street  each district's police level now and tonight, the wanted posters with their heat stars, the bounties (the target, never who
//           posted it), the corners and their holders
//   List    the list (price, floor, last paid, copies left, the night it opens), its grails with their wearers and buyers, every sale at dawn
//   Fits    each agent's fit on the board (a hidden fit stays hidden)
//   Vault   the vault's pieces and cash, the crate
// During the show the store holds the night's board until the show closes (STORE.md); the header says so, from the store's reveal.
// Each value's element names its path into boardAt (data-k), so tools/boardscenario.mjs can compare it with boardAt at that minute.
import { h as h0, button, panel as makePanel, screens, tabs as makeTabs } from '../kit.js';
import { boardAt } from '../../simstate/record/board-data.js';
import { bfmt } from './board-format.js';
import { clock } from './format.js';
import { sameInputs } from './view.js';
import { watchDrawing } from './drawing.js';

// (kit's h flattens one level; the board's rows nest deeper)
const h = (tag, attrs, ...kids) => h0(tag, attrs, ...kids.flat(Infinity));
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));
// a value's element: <b data-k="list.3.price">$64</b>, or nothing when the value has no source
export function bval(B, path, value, key = path.split('.').at(-1), tag = 'b', cls = null) {
  const text = bfmt(key, value, B);
  return text === null ? null : h(tag, { 'data-k': path, class: cls }, text);
}
// an agent: its board name (the presented board's roster) and @id
export function who(s, B, path, id) {
  if (id === null || id === undefined) return null;
  const name = s.board?.agents?.find(a => a.id === id)?.name ?? null;
  return h('span', { class: 'b-who' }, name ? h('span', { class: 'b-name', 'data-name': id }, name) : null, name ? ' ' : null, bval(B, path, id, 'agent', 'small'));
}
const sec = (title, ...kids) => h('section', { class: 'r-sec', 'data-sec': title }, h('h3', { class: 'r-h' }, title), ...kids);
const none = text => h('p', { class: 'r-none' }, text);

export function createBoard({ sim, root, onOpen = () => {} }) {
  const P = makePanel({ side: 'right', label: 'The board' }); P.el.id = 'r-board'; P.el.classList.add('r-panel'); root.append(P.el);
  const sub = h('div', { class: 'r-sub' }), counts = h('div', { class: 'b-counts' }), body = h('div', { class: 'k-scroll r-body' });
  let sig = '', headSig = null;
  const tabs = makeTabs([{ id: 'b-street', label: 'Street' }, { id: 'b-list', label: 'List' }, { id: 'b-fits', label: 'Fits' }, { id: 'b-vault', label: 'Vault' }],
    { onchange: () => { sig = ''; update(); } });
  P.el.append(h('header', { class: 'r-head' }, h('div', { class: 'r-id' }, h('h2', { class: 'r-title' }, 'The board'), sub),
    button('', { icon: 'close', tip: 'Close (L or Esc)', cls: 'r-x', onclick: () => close() })), counts, tabs.el, body);
  const drawing = watchDrawing(root, P.el, [sub, counts, body]);
  function header(s, B) {
    const held = s.reveal && s.reveal.end > s.minute;
    fill(sub, h('span', { class: 'r-live' }, 'PUBLIC'), held ? h('span', { class: 'b-held', 'data-held': String(s.reveal.end) }, `Tonight’s results at ${clock(s.reveal.end).slice(-5)}`) : ' · the island’s board');
    const L = B.countdowns.lock, F = B.countdowns.ferry;
    fill(counts,
      h('div', { class: 'b-count' }, h('span', null, 'Lock'), L ? bval(B, 'countdowns.lock.minutes', L.minutes, 'minutes') : h('b', null, '—')),
      h('div', { class: 'b-count' }, h('span', null, 'Ferry'), bval(B, 'countdowns.ferry.nightsLeft', F.nightsLeft, 'nightsLeft') ?? h('b', null, '—')),
      h('div', { class: 'b-count' }, h('span', null, 'Next shipment'), B.nextShipment ? bval(B, 'nextShipment.night', B.nextShipment.night, 'night') : h('b', null, 'none')));
  }
  function street(s, B) {
    const ds = Object.keys(B.police ?? {});
    return [
      sec('Police', ds.length ? h('table', { class: 'b-police' }, h('tr', null, h('th', null, ''), h('th', null, 'now'), h('th', null, 'tonight')),
        ds.map(d => h('tr', { 'data-row': 'police', 'data-district': d }, h('th', null, d),
          h('td', null, bval(B, `police.${d}`, B.police[d], 'level', 'b', 'b-lv is-' + B.police[d])),
          h('td', null, B.tonight ? bval(B, `tonight.${d}`, B.tonight[d], 'level', 'b', 'b-lv is-' + B.tonight[d]) : null))))
        : none('No police levels yet.')),
      sec('Wanted', B.wanted.length ? h('div', { class: 'b-posters' }, B.wanted.map((w, i) => h('div', { class: 'b-poster', 'data-row': 'wanted', 'data-agent': w.agent },
        bval(B, `wanted.${i}.wanted`, w.wanted, 'wanted', 'b', 'b-poster-w'), who(s, B, `wanted.${i}.agent`, w.agent),
        bval(B, `wanted.${i}.heat`, w.heat, 'heat', 'div', 'b-stars')))) : none('Nobody is wanted.')),
      sec('Bounties', B.bounties.length ? h('ul', { class: 'r-list' }, B.bounties.map((b, i) => h('li', { class: 'r-bounty', 'data-row': 'bounties' },
        'On ', who(s, B, `bounties.${i}.agent`, b.agent), ' for ', bval(B, `bounties.${i}.trait`, b.trait, 'trait'), ' ', bval(B, `bounties.${i}.tier`, b.tier, 'tier', 'small'),
        ' · ', bval(B, `bounties.${i}.amount`, b.amount, 'amount')))) : none('No bounties.')),
      sec('Corners', h('ul', { class: 'r-list b-corners' }, B.corners.map((c, i) => h('li', { class: 'b-corner' + (c.hot ? ' is-hot' : ''), 'data-row': 'corners', 'data-corner': c.corner },
        bval(B, `corners.${i}.corner`, c.corner, 'corner'), ' ', bval(B, `corners.${i}.place`, c.place, 'place', 'small'), ' · ',
        c.holder ? who(s, B, `corners.${i}.holder`, c.holder) : h('span', { class: 'r-none' }, 'open'), ' ', c.hot ? bval(B, `corners.${i}.hot`, c.hot, 'hot', 'em', 'b-hot') : null)))),
    ];
  }
  function list(s, B) {
    const grails = B.grails.map((g, i) => h('li', { class: 'b-grail', 'data-row': 'grails', 'data-trait': g.trait },
      h('div', null, bval(B, `grails.${i}.name`, g.name, 'name'), ' ', bval(B, `grails.${i}.price`, g.price, 'price'), ' · ', bval(B, `grails.${i}.left`, g.left, 'left'), ' · ', bval(B, `grails.${i}.opens`, g.opens, 'opens', 'span')),
      h('div', { class: 'b-meta' }, 'worn by ', g.wearers.length ? g.wearers.map((w, j) => [j ? ', ' : '', who(s, B, `grails.${i}.wearers.${j}.agent`, w.agent)]) : 'nobody'),
      h('div', { class: 'b-meta' }, 'bought by ', g.buyers.length ? g.buyers.map((b, j) => [j ? ', ' : '', who(s, B, `grails.${i}.buyers.${j}.agent`, b.agent), ' ', bval(B, `grails.${i}.buyers.${j}.price`, b.price, 'price'), ' ', bval(B, `grails.${i}.buyers.${j}.night`, b.night, 'night', 'small')]) : 'nobody')));
    const rows = B.list.map((t, i) => h('tr', { class: 'b-item is-' + t.tier, 'data-row': 'list', 'data-trait': t.trait },
      h('td', null, bval(B, `list.${i}.name`, t.name, 'name'), h('div', { class: 'b-meta' }, bval(B, `list.${i}.slot`, t.slot, 'slot', 'span'), ' · ', bval(B, `list.${i}.tier`, t.tier, 'tier', 'span'),
        t.ability ? [' · ', bval(B, `list.${i}.ability`, t.ability, 'ability', 'span')] : null, ' · ', bval(B, `list.${i}.opens`, t.opens, 'opens', 'span'))),
      h('td', { class: 'b-num' }, bval(B, `list.${i}.price`, t.price, 'price'), h('div', { class: 'b-meta' }, 'floor ', bval(B, `list.${i}.floor`, t.floor, 'floor', 'span'))),
      h('td', { class: 'b-num' }, bval(B, `list.${i}.left`, t.left, 'left'), h('div', { class: 'b-meta' }, t.last === null || t.last === undefined ? 'unsold' : ['last ', bval(B, `list.${i}.last`, t.last, 'last', 'span')]))));
    // (every sale at dawn, newest first)
    const sales = B.sales.map((x, i) => [x, i]).reverse().map(([x, i]) => h('li', { class: 'b-sale', 'data-row': 'sales' },
      bval(B, `sales.${i}.night`, x.night, 'night', 'small'), ' ', who(s, B, `sales.${i}.agent`, x.agent), ' bought ', bval(B, `sales.${i}.trait`, x.trait, 'trait'), ' for ', bval(B, `sales.${i}.price`, x.price, 'price')));
    return [sec('Grails', grails.length ? h('ul', { class: 'r-list' }, grails) : none('No grails on the list.')),
      sec('The list', h('table', { class: 'b-list' }, h('tr', null, h('th', null, 'piece'), h('th', null, 'price'), h('th', null, 'copies')), rows)),
      sec('Sales at dawn', sales.length ? h('ul', { class: 'r-list' }, sales) : none('Nothing sold yet.'))];
  }
  function fits(s, B) {
    return [sec('Fits', h('ul', { class: 'r-list' }, B.fits.map((f, i) => h('li', { class: 'b-fit', 'data-row': 'fits', 'data-agent': f.agent },
      who(s, B, `fits.${i}.agent`, f.agent), h('div', { class: 'b-meta' }, f.fitHidden ? bval(B, `fits.${i}.fitHidden`, f.fitHidden, 'fitHidden', 'span') : bval(B, `fits.${i}.fit`, f.fit, 'fit', 'span'))))))];
  }
  function vault(s, B) {
    const v = B.vault, c = B.crate;
    return [sec('The vault', v ? [h('div', { class: 'k-stat r-stat' }, h('span', null, 'cash'), bval(B, 'vault.cash', v.cash, 'cash')),
      v.pieces.length ? h('ul', { class: 'r-list' }, v.pieces.map((p, i) => h('li', { 'data-row': 'vault.pieces' }, bval(B, `vault.pieces.${i}.trait`, p.trait, 'trait'), ' ', bval(B, `vault.pieces.${i}.tier`, p.tier, 'tier', 'small'))))
        : none('No pieces in the vault.')] : none('No vault on the board.')),
    sec('The crate', c ? [h('div', { class: 'k-stat r-stat' }, h('span', null, 'cash'), bval(B, 'crate.cash', c.cash, 'cash')), h('div', { class: 'k-stat r-stat' }, h('span', null, 'goods'), bval(B, 'crate.goods', c.goods, 'goods'))]
      : none('No crate at the docks.'))];
  }
  function update(force = false, s = sim.record()) {
    if (!P.isOpen) return;
    const k = [tabs.selected, s.board];
    const B = boardAt(s, s.minute);
    const hk = [s.board, s.nightsLeft, s.reveal?.end, s.reveal?.end > s.minute, bfmt('minutes', B.countdowns.lock?.minutes)];
    P.el.dataset.minute = String(s.minute);
    const intact = drawing.intact();
    if (!force && sameInputs(sig, k) && sameInputs(headSig, hk) && intact) return;
    drawing.repair();
    if (force || !intact || !sameInputs(headSig, hk)) { header(s, B); headSig = hk; }
    if (force || !intact || !sameInputs(sig, k)) {
      fill(body, { 'b-street': street, 'b-list': list, 'b-fits': fits, 'b-vault': vault }[tabs.selected](s, B)); sig = k;
    }
    drawing.painted();
  }
  function open() { if (P.isOpen) return; onOpen(); P.open(); screens.open('r-board', { esc: close, isOpen: () => P.isOpen }); sig = ''; update(); }
  function close() { P.close(); screens.close('r-board'); }
  return { open, close, toggle: () => P.isOpen ? close() : open(), update, select: id => tabs.select(id, true), get tab() { return tabs.selected; }, get isOpen() { return P.isOpen; }, el: P.el };
}
