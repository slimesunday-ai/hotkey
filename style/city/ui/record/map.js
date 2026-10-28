// C1-11, the drawn half · THE PAPER MAP ON THE RECORD PATH (M, or the Map button). The printed sheet is section 3b's own base (ui/map/
// geo.js + paper.js: water, blocks, roads, street names), drawn once per open or resize without the old sim's place symbols. Over it,
// as DOM, every value of mapAt at the playhead: the city export's places, each district's police level and tonight's level (the
// board's own words), the eight corners with their holders, and the wanted posters. Nothing is computed here; a value with no source
// is left out. It sits between the menu and the ticker, never over the record player's controls.
import { h, button, screens } from '../kit.js';
import { buildGeo } from '../map/geo.js';
import { drawBase, toScreen } from '../map/paper.js';
import { mapAt } from '../../simstate/record/panel-data.js';
import { CITY_PLACES } from '../../simstate/record/places.js';
import { val, fill } from './dossier.js';
import { sameInputs } from './view.js';
import { watchDrawing } from './drawing.js';

const TOKENS = ['ink', 'ink-2', 'halo', 'woods', 'woods-dot', 'ground', 'water', 'water-ink', 'block', 'block-line', 'lot', 'ave', 'hwy', 'hwy-ink', 'grid', 'ruler', 'symbol-bg', 'corner', 'corner-ink', 'cross'];
const TINTS = ['downtown', 'strip', 'suburbs', 'estates', 'trailer', 'industrial', 'docks', 'junkyard', 'jail', 'hospital', 'highway', 'mall', 'park', 'plaza', 'parking'];
export function createMap({ sim, root, onOpen = () => {} }) {
  if (!document.querySelector('link[data-map-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('../map/map.css', import.meta.url).href, 'data-map-css': '' }));
  const el = h('section', { id: 'r-map', class: 'r-panel r-map', role: 'dialog', 'aria-label': 'Island map', 'aria-hidden': 'true', hidden: true });
  const cv = h('canvas', { class: 'r-map-base', 'aria-hidden': 'true' }), marks = h('div', { class: 'r-map-marks' }), posters = h('aside', { class: 'r-posters' });
  const legend = h('div', { class: 'r-map-legend' }, h('h2', { class: 'r-title' }, 'The island'), h('div', { class: 'r-sub' }, h('span', { class: 'r-live' }, 'PUBLIC'), ' · police levels: now / tonight'));
  el.append(h('div', { class: 'r-map-sheet' }, cv, marks), legend, posters, button('', { icon: 'close', tip: 'Close (M or Esc)', cls: 'r-x r-map-x', onclick: () => close() }));
  root.append(el);
  const drawing = watchDrawing(root, el, [cv, marks, posters]);
  let open = false, view = null, sig = '', G = null;
  function fit() {
    const r = el.getBoundingClientRect(), ps = Object.values(CITY_PLACES), pad = 40;
    const x0 = Math.min(...ps.map(p => p.x)), x1 = Math.max(...ps.map(p => p.x)), z0 = Math.min(...ps.map(p => p.z)), z1 = Math.max(...ps.map(p => p.z));
    const W = Math.max(1, r.width - 220), H = Math.max(1, r.height);
    view = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, s: Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0)), W, H, dpr: Math.min(2, devicePixelRatio || 1) };
  }
  function base() {
    G ??= { ...buildGeo(), places: [] };
    const cs = getComputedStyle(el), v = k => cs.getPropertyValue('--k-map-' + k).trim(), T = Object.fromEntries(TOKENS.map(k => [k.replace(/-(\w)/g, (_, c) => c.toUpperCase()), v(k)]));
    Object.assign(T, { font: v('font') || 'system-ui', fontStreet: v('font-street') || 'system-ui', fontDisplay: v('font-display') || 'system-ui', wDistrict: v('w-district') || '700', wPlace: v('w-place') || '600', wStreet: v('w-street') || '500', wAve: v('w-ave') || '700' });
    for (const t of TINTS) T['t-' + t] = v('t-' + t);
    cv.width = Math.round(view.W * view.dpr); cv.height = Math.round(view.H * view.dpr); cv.style.width = view.W + 'px'; cv.style.height = view.H + 'px';
    drawBase(cv.getContext('2d'), view, G, T, { places: false });
  }
  const at = (x, z) => { const [sx, sy] = toScreen(view, x, z); return `translate(${Math.round(sx)}px, ${Math.round(sy)}px)`; };
  function update(force = false, s = sim.record()) {
    if (!open) return;
    const k = [s.board];
    el.dataset.minute = String(s.minute);
    const intact = drawing.intact();
    if (!force && sameInputs(sig, k) && intact) return;
    drawing.repair();
    if (force || !intact) { fit(); base(); }
    const m = mapAt(s, s.minute), name = id => s.board?.agents.find(a => a.id === id)?.name ?? '';
    const placeEls = m.places.map((p, i) => h('div', { class: 'r-mk r-place is-' + p.kind, 'data-row': 'map.places', style: `transform:${at(p.x, p.z)}` },
      // (a street corner's name stays off the sheet: its corner marker below names the corner and its holder)
      h('i'), p.kind === 'corner' ? null : val(`map.places.${i}.name`, p.name, 'name', 'span')));
    const districtEls = m.districts.map((d, i) => { const p = CITY_PLACES[d.anchor.cityPlace];
      return p ? h('div', { class: 'r-mk r-district', 'data-row': 'map.districts', 'data-district': d.district, style: `transform:${at(p.x, p.z)}` },
        h('b', null, d.district.toUpperCase()), h('span', { class: 'r-police' }, 'police ', val(`map.districts.${i}.level`, d.level, 'level', 'b'), ' / ', val(`map.districts.${i}.tonight`, d.tonight, 'tonight', 'b'))) : null; });
    const cornerEls = m.corners.map((c, i) => { const p = c.anchor && CITY_PLACES[c.anchor.cityPlace];
      return p ? h('div', { class: 'r-mk r-corner' + (c.hot ? ' is-hot' : ''), 'data-row': 'map.corners', 'data-corner': c.corner, style: `transform:${at(p.x, p.z)}` },
        h('i'), h('span', null, val(`map.corners.${i}.corner`, c.corner, 'corner', 'b'), ' ', c.holder ? [h('span', null, name(c.holder)), ' ', val(`map.corners.${i}.holder`, c.holder, 'holder', 'small')] : 'open',
          c.hot ? [' ', val(`map.corners.${i}.hot`, c.hot, 'hot', 'em')] : null)) : null; });
    fill(marks, ...placeEls, ...districtEls, ...cornerEls);
    declutter();
    fill(posters, h('h3', { class: 'r-h' }, 'Wanted'), ...(m.wanted.length ? m.wanted.map((w, i) => h('div', { class: 'r-poster', 'data-row': 'map.wanted', 'data-agent': w.agent },
      h('b', { class: 'r-poster-w' }, val(`map.wanted.${i}.wanted`, w.wanted, 'wanted', 'span')), h('div', { class: 'r-poster-n' }, name(w.agent)), val(`map.wanted.${i}.agent`, w.agent, 'agent', 'small'),
      h('div', null, '★ ', val(`map.wanted.${i}.heat`, w.heat, 'heat', 'b')))) : [h('p', { class: 'r-none' }, 'Nobody is wanted.')]));
    sig = k; drawing.painted();
  }
  // labels never print over each other: the corners' diamonds are fixed; district boxes, then the corners' labels, take the nearest clear
  // offset (down, up, right, left, growing); then a place's name only where it fits (its dot stays). Layout reads only, once per redraw.
  function declutter() {
    const boxes = [...marks.querySelectorAll('.r-corner > i')].map(n => n.getBoundingClientRect());
    const hits = r => boxes.some(b => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top);
    const settle = (el, move) => {
      const r0 = el.getBoundingClientRect(), sy = Math.ceil(r0.height / 2) + 2, sx = Math.ceil(r0.width / 4) + 2;
      const at = (dx, dy) => ({ left: r0.left + dx, right: r0.right + dx, top: r0.top + dy, bottom: r0.bottom + dy });
      let best = [0, 0];
      if (hits(r0)) for (let k = 1; k <= 8; k++) { const c = [[0, k * sy], [0, -k * sy], [k * sx, 0], [-k * sx, 0]].find(([dx, dy]) => !hits(at(dx, dy))); if (c) { best = c; break; } }
      move(...best); boxes.push(at(...best)); };
    for (const d of marks.querySelectorAll('.r-district')) settle(d, (dx, dy) => { d.style.marginLeft = dx + 'px'; d.style.marginTop = dy + 'px'; });
    for (const c of marks.querySelectorAll('.r-corner > span')) settle(c, (dx, dy) => { c.style.left = (10 + dx) + 'px'; c.style.top = (4 + dy) + 'px'; });
    for (const n of marks.querySelectorAll('.r-place > span')) { const r = n.getBoundingClientRect(); if (hits(r)) n.remove(); else boxes.push(r); }
  }
  function show() { if (open) return; open = true; onOpen(); el.hidden = false; el.setAttribute('aria-hidden', 'false'); sig = ''; update(true); screens.open('r-map', { esc: close, isOpen: () => open }); }
  function close() { if (!open) return; open = false; el.hidden = true; el.setAttribute('aria-hidden', 'true'); fill(marks); cv.width = cv.height = 1; screens.close('r-map'); }
  addEventListener('resize', () => { if (open) { sig = ''; update(true); } });
  return { open: show, close, toggle: () => open ? close() : show(), update, get isOpen() { return open; }, el };
}
