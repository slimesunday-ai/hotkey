// HUMAN LAYER · SECTION 4 · PEOPLE: every sim agent in one list, one click from following them. A kit panel docked left (opposite the
// dossier, which docks away from its agent: if the dossier takes the left, People steps to the right, as 3a's panels do).
//   rows     a portrait thumbnail (ui/portrait.js thumb(): the agent's real look, head and shoulders, cached), handle, class, crew colour
//            (the map's crew colours), the live "now" sentence, WANTED / ★ / YOU badges; jail, hospital, dead and retired rows are dimmed
//   find     search as you type (handle first, then class, crew, the now sentence, the place); filters: crew, class, status (active: not
//            in jail, hospital or dead; jailed, hospital, dead), wanted, starred, yours; sort: most going on (public events in the last 3 game hours), name, drip,
//            trophies (marks), most wanted, nearest to the camera
//   go       click a row, or ↑↓ then Enter: the camera follows them (a far one: through the load-in first) and the dossier opens. Inside a
//            building: the camera goes to the building. Rule 5 (coarse: at a lot that isn't theirs): the camera goes to the district and
//            says so, never to a precise spot. Out of sight (a coarse trip): the dossier only, and a note
//   hover    a row (or the ↑↓ choice) puts a beacon on them in the city (ui/menu/beacon.js): over the head, or at the screen's edge pointing
// LIVE only: every field is the store's public card (sim.agents) and public events (sim.events); nothing private is read here.
// Cost: closed, nothing (no subscription, no timer, no observer). Open: the rows' live text in one batch at most 4× a second, after the
// store's tick (1 Hz); thumbnails rendered one at a time for the rows on screen, then cached for the page's life.
import { h, set, attr, panel as makePanel, lens as lensBadge, chip, prefs, toast, tabs as makeTabs } from '../kit.js';
import { placesNow, followAgent } from '../goto.js';
import { createLeaderboards } from './leaderboards.js';
import { svg } from '../menu/icons.js';

const STAR_KEY = 'aicity.ui.stars', PREF_KEY = 'aicity.ui.people', BUSY_WINDOW = 180;
const NOTABLE = new Set(['rob', 'burgle', 'arrest', 'death', 'killed', 'director', 'turf', 'bounty', 'hospital', 'warrant', 'crew_payback', 'mark', 'release', 'bail', 'claim', 'evict']);
const QUIET = new Set(['move', 'arrive', 'activity', 'gather', 'cook', 'craft']);
const SORTS = [['busy', 'Most going on'], ['name', 'Name A–Z'], ['drip', 'Most drip'], ['marks', 'Most trophies'], ['wanted', 'Most wanted'], ['near', 'Nearest']];
const STATUS = [['all', 'All'], ['out', 'Active'], ['jail', 'Jailed'], ['hospital', 'Hospital'], ['dead', 'Dead']];
const stars = () => { try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) || '[]')); } catch { return new Set(); } };
const statusOf = c => c.retired ? 'retired' : c.status === 'dead' ? 'dead' : c.status === 'jail' ? 'jail' : c.status === 'hospital' ? 'hospital' : 'out';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

export function createPeople({ api, sim, dossier, city, root, portraits, beacons, onChange = () => {} }) {
  const P = makePanel({ side: 'left', label: 'People' }); P.el.classList.add('pp'); P.el.setAttribute('data-safe-avoid', ''); root.append(P.el);
  const saved = (() => { try { return JSON.parse(prefs.get(PREF_KEY) || '{}'); } catch { return {}; } })();
  const st = { q: '', crew: '', cls: '', status: 'all', wanted: false, starred: false, mine: false, sort: 'busy', ...saved, q: '' };
  const keep = () => { const { q, ...rest } = st; prefs.set(PREF_KEY, JSON.stringify(rest)); };
  // ── head
  const countEl = h('span', { class: 'pp-count' }), badge = lensBadge('live');
  const xBtn = h('button', { type: 'button', class: 'k-btn is-icon pp-x', 'data-tip': 'Close (Esc)', 'aria-label': 'Close People' }, svg('close')); xBtn.onclick = () => close();
  const head = h('header', { class: 'pp-head' }, h('div', { class: 'pp-title' }, h('h2', { id: 'pp-h' }, 'People'), countEl), badge, xBtn);
  // ── search
  const q = h('input', { type: 'text', class: 'pp-q', placeholder: 'Search a name, crew, class, place', 'aria-label': 'Search people', autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-controls': 'pp-list', 'aria-expanded': 'true', 'aria-autocomplete': 'list' });
  const qClear = h('button', { type: 'button', class: 'pp-qx', 'aria-label': 'Clear the search', hidden: true }, svg('close'));
  const search = h('label', { class: 'pp-search' }, svg('search', 'pp-qi'), q, qClear, h('kbd', { class: 'pp-qk' }, '/'));
  // ── filters: three selects (crew, class, sort) and one row of toggles (status + wanted, starred, yours)
  const sel = (label, cls) => { const s = h('select', { class: 'pp-sel ' + cls, 'aria-label': label }); return s; };
  const crewSel = sel('Crew', 'pp-crew'), clsSel = sel('Class', 'pp-cls'), sortSel = sel('Sort by', 'pp-sort');
  for (const [v, l] of SORTS) sortSel.append(h('option', { value: v }, l)); sortSel.value = st.sort;
  const sortWrap = h('label', { class: 'pp-sortw' }, sortSel);
  const tog = (id, label, tip) => { const b = h('button', { type: 'button', class: 'pp-tog', 'data-f': id, 'aria-pressed': 'false', 'data-tip': tip }, label); b.onclick = () => { if (id.startsWith('s:')) st.status = st.status === id.slice(2) ? 'all' : id.slice(2); else st[id] = !st[id]; keep(); syncToggles(); refilter(); }; return b; };
  const togs = [...STATUS.slice(1).map(([v, l]) => tog('s:' + v, l, v === 'out' ? 'Not in jail, hospital or the morgue' : null)), tog('wanted', 'Wanted', 'Wanted: heat over 75 (public)'), tog('starred', '★ Starred', 'The ones you starred in their dossier'), tog('mine', 'Yours', 'Your own agent (?as=)')];
  const filters = h('div', { class: 'pp-filters' }, h('div', { class: 'pp-sels' }, crewSel, clsSel, sortWrap), h('div', { class: 'pp-togs', role: 'group', 'aria-label': 'Filters' }, ...togs));
  crewSel.onchange = () => { st.crew = crewSel.value; keep(); refilter(); }; clsSel.onchange = () => { st.cls = clsSel.value; keep(); refilter(); }; sortSel.onchange = () => { st.sort = sortSel.value; keep(); refilter(); };
  function syncToggles() { for (const b of togs) { const f = b.dataset.f, on = f.startsWith('s:') ? st.status === f.slice(2) : !!st[f]; attr(b, 'aria-pressed', on ? 'true' : 'false'); b.classList.toggle('is-on', on); }
    togs[togs.length - 1].hidden = !sim.me; }
  // ── the list
  const list = h('ul', { class: 'pp-list', id: 'pp-list', role: 'listbox', 'aria-labelledby': 'pp-h' }), empty = h('div', { class: 'pp-empty', hidden: true });
  const scroll = h('div', { class: 'k-scroll pp-scroll' }, list, empty);
  const foot = h('div', { class: 'pp-foot' }, h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' choose · ', h('kbd', null, 'Enter'), ' follow · ', h('kbd', null, 'Esc'), ' close'));
  // ── the two views: Everyone (the roster) · Leaderboards (the City's ladders, ./leaderboards.js); the choice is kept in this browser
  const VIEW_KEY = 'aicity.ui.people.view'; let viewReady = false;
  const V = makeTabs([{ id: 'pp-all', label: 'Everyone', lens: 'live', tip: 'Everyone in the city: search, filter, sort' }, { id: 'pp-boards', label: 'Leaderboards', lens: 'live', tip: 'Drip, Most Wanted, Trophies, Longest survivor (LIVE) · Richest (TAPE)' }],
    { selected: prefs.get(VIEW_KEY) === 'boards' ? 'pp-boards' : 'pp-all', onchange: (id, user) => { if (user) prefs.set(VIEW_KEY, id === 'pp-boards' ? 'boards' : 'all'); if (viewReady) setView(); } });
  V.el.classList.add('pp-views');
  const LB = createLeaderboards({ sim, portraits, go: hh => go(hh), hover: hh => { hoverH = hh; light(); } });
  const tools = h('div', { class: 'pp-tools' }, search, filters), footAll = foot.firstChild, footLB = h('span', { hidden: true }, h('kbd', null, '↑'), h('kbd', null, '↓'), ' choose · ', h('kbd', null, 'Enter'), ' follow · ', h('kbd', null, 'Esc'), ' close'); foot.append(footLB);
  const boardsView = () => V.selected === 'pp-boards';
  function setView() { const b = boardsView(); tools.hidden = b; scroll.hidden = b; footAll.hidden = b; footLB.hidden = !b; P.el.classList.toggle('is-boards', b);
    if (!isOpen) return; if (b) { hoverH = null; LB.show(); } else { LB.hide(); render(true); } }
  P.el.append(head, V.el, tools, scroll, LB.el, foot); P.el.setAttribute('aria-labelledby', 'pp-h');
  viewReady = true; { const b = boardsView(); tools.hidden = b; scroll.hidden = b; footAll.hidden = b; footLB.hidden = !b; P.el.classList.toggle('is-boards', b); }
  // ── rows: one element per handle, built once, reused; text written only when it changed
  const rows = new Map();
  function rowFor(c) {
    let r = rows.get(c.handle); if (r) return r;
    const img = h('img', { alt: '', class: 'pp-img', draggable: 'false', decoding: 'async' }), face = h('span', { class: 'pp-face' }, img);
    const name = h('b', { class: 'pp-name' }), badges = h('span', { class: 'pp-badges' }), sub = h('span', { class: 'pp-sub' }), dot = h('i', { class: 'pp-dot' }), subT = h('span'), now = h('span', { class: 'pp-now' }), val = h('span', { class: 'pp-val' });
    sub.append(dot, subT);
    const el = h('li', { class: 'pp-row', role: 'option', id: 'pp-r-' + c.handle.replace(/[^\w-]/g, '_'), 'aria-selected': 'false', 'data-h': c.handle }, face, h('span', { class: 'pp-main' }, h('span', { class: 'pp-top' }, name, badges), sub, now), val);
    el.addEventListener('click', () => go(c.handle));
    el.addEventListener('pointerenter', () => { hoverH = c.handle; light(); });
    el.addEventListener('pointerleave', () => { if (hoverH === c.handle) { hoverH = null; light(); } });
    r = { el, img, face, name, badges, sub: subT, dot, now, val, h: c.handle, bk: '', thumbKey: '' }; rows.set(c.handle, r); io?.observe(el); return r;
  }
  // ── state while open
  let isOpen = false, unsub = null, timer = 0, lastDraw = 0, order = '', shown = [], active = 0, hoverH = null, io = null, busyMap = new Map(), busyAt = -1, crewCol = new Map(), pendingOpen = null, mo = null;
  const visible = new Set(), thumbQ = []; let pumping = false;
  function open({ focus = true, query = null } = {}) {
    if (query !== null && boardsView()) V.select('pp-all', true);   // (a search lives in Everyone)
    if (!isOpen) { isOpen = true; P.dock(sideFor()); P.open(); unsub = sim.on('tick', schedule); io = new IntersectionObserver(seen, { root: scroll, rootMargin: '120px 0px' }); for (const r of rows.values()) io.observe(r.el);
      mo = new MutationObserver(() => P.dock(sideFor())); mo.observe(dossier.el, { attributes: true, attributeFilter: ['class'] }); syncToggles(); setView(); render(true); onChange(true); }
    if (query !== null) { q.value = query; st.q = query; render(true); }
    if (focus) { if (boardsView()) { if (!P.el.contains(document.activeElement)) LB.focusFirst(); } else { q.focus({ preventScroll: true }); q.select(); } }
  }
  function close() { if (!isOpen) return false; isOpen = false; unsub?.(); unsub = null; clearTimeout(timer); timer = 0; io?.disconnect(); io = null; mo?.disconnect(); mo = null; visible.clear(); thumbQ.length = 0;
    LB.hide(); hoverH = null; beacons.show([]); pendingOpen = null; if (P.el.contains(document.activeElement)) document.activeElement.blur(); P.close(); onChange(false); return true; }
  const sideFor = () => dossier.isOpen && dossier.el.classList.contains('dock-left') ? 'right' : 'left';
  function schedule() { if (!isOpen || timer) return; timer = setTimeout(() => { timer = 0; render(); }, Math.max(0, 250 - (performance.now() - lastDraw))); }
  function refilter() { active = 0; render(true); list.parentElement.scrollTop = 0; }
  // ── the derived numbers (≤ 1× per tick, only for the sort that needs them)
  function busyCounts() { const ck = sim.clock(); if (!ck) return busyMap; const t = Math.floor(ck.t); if (t === busyAt) return busyMap; busyAt = t; const m = new Map();
    for (const e of sim.events({ since: t - BUSY_WINDOW })) { const w = NOTABLE.has(e.type) ? 3 : QUIET.has(e.type) ? .25 : 1; for (const who of [e.who, e.to, e.with]) if (typeof who === 'string') m.set(who, (m.get(who) || 0) + w); }
    return busyMap = m; }
  const CRIMES = new Set(['arrest', 'warrant', 'bounty', 'robbery', 'killed']);
  const recordOf = c => (sim.agent(c.handle)?.rap || []).filter(r => CRIMES.has(r.kind)).length;
  const wantedScore = (c, mw, n) => (c.wanted ? 1000 : 0) + (mw === c.handle ? 500 : 0) + n;
  function nearOf(c) { const w = sim.where(c.handle), T = api.controls?.target; if (!w || !T) return { d: Infinity, label: 'out of sight' }; const d = Math.hypot(w.x - T.x, w.z - T.z);
    if (w.coarse) return { d: 1e6 + d, label: '~ ' + (placesNow()?.distName(c.district) || c.district || 'somewhere') }; const L = d < 15 ? 'here' : d < 1000 ? `${Math.round(d / 5) * 5} m` : `${(d / 1000).toFixed(1)} km`; return { d, label: w.drawn ? L : 'inside · ' + L }; }
  // ── draw (batched ≤ 4 Hz; force on a filter change)
  function render(force = false) {
    if (!isOpen || boardsView()) return; lastDraw = performance.now();   // (the Leaderboards view draws itself)
    const cards = sim.agents(), S = stars(), me = sim.me, mw = sim.world()?.mostWanted || null, crews = sim.world()?.crews || [];
    // the crew colours: the map's rule (names sorted → --k-map-crew-1…6), so a crew wears one colour on every screen
    { const names = crews.map(c => c.name).sort(); crewCol = new Map(names.map((n, k) => [n, `var(--k-map-crew-${(k % 6) + 1})`])); }
    // the select options follow the roster (crews and classes come and go)
    fillSel(crewSel, 'Every crew', [...new Set(cards.map(c => c.crew).filter(Boolean))].sort((a, b) => a.localeCompare(b)), st.crew, cards.some(c => !c.crew) ? [['-', 'No crew']] : []);
    fillSel(clsSel, 'Every class', [...new Set(cards.map(c => c.cls).filter(Boolean))].sort(), st.cls, []);
    const needle = st.q.trim().toLowerCase().replace(/^@/, '');
    let L = cards.filter(c => {
      const s = statusOf(c);
      if (st.status !== 'all' && s !== st.status) return false;
      if (st.crew && (st.crew === '-' ? c.crew : c.crew !== st.crew)) return false;
      if (st.cls && c.cls !== st.cls) return false;
      if (st.wanted && !c.wanted) return false; if (st.starred && !S.has(c.handle)) return false; if (st.mine && c.handle !== me) return false;
      return true; });
    let rank = null;
    if (needle) { rank = new Map(); L = L.filter(c => { const hd = c.handle.toLowerCase(); let r = hd.startsWith(needle) ? 0 : hd.includes(needle) ? 1 : [c.crew, c.cls, c.now, c.placeName, c.district && placesNow()?.distName(c.district)].some(x => x && String(x).toLowerCase().includes(needle)) ? 2 : -1; if (r < 0) return false; rank.set(c.handle, r); return true; }); }
    const metric = new Map(), sort = st.sort;
    if (sort === 'busy') { const B = busyCounts(); for (const c of L) metric.set(c.handle, B.get(c.handle) || 0); }
    else if (sort === 'drip') for (const c of L) metric.set(c.handle, +c.drip || 0);
    else if (sort === 'marks') for (const c of L) metric.set(c.handle, (c.marks || []).length);
    const rec = new Map(); if (sort === 'wanted') for (const c of L) { const n = recordOf(c); rec.set(c.handle, n); metric.set(c.handle, wantedScore(c, mw, n)); }
    const near = new Map(); if (sort === 'near') for (const c of L) near.set(c.handle, nearOf(c));
    const gone = c => statusOf(c) === 'dead' || statusOf(c) === 'retired' ? 1 : 0;
    L.sort((a, b) => (rank ? rank.get(a.handle) - rank.get(b.handle) : 0) || gone(a) - gone(b) || (b.handle === me) - (a.handle === me) ||
      (sort === 'name' ? 0 : sort === 'near' ? near.get(a.handle).d - near.get(b.handle).d : (metric.get(b.handle) || 0) - (metric.get(a.handle) || 0)) || a.handle.localeCompare(b.handle));
    shown = L.map(c => c.handle);
    // rows: text and badges (written only when changed), then the order (one replaceChildren when it changed)
    for (const c of L) { const r = rowFor(c), s = statusOf(c);
      set(r.name, '@' + c.handle);
      const bk = [c.handle === me ? 'me' : '', c.wanted ? 'w' : '', S.has(c.handle) ? 's' : '', s].join('|');
      if (bk !== r.bk) { r.bk = bk; r.badges.replaceChildren(c.handle === me ? chip('YOU', 'is-yours') : '', c.wanted ? chip('WANTED', 'is-wanted') : '', S.has(c.handle) ? h('span', { class: 'pp-star', 'data-tip': 'Starred' }, svg('star')) : '');
        r.el.dataset.status = s; }
      set(r.sub, [c.npc ? 'a Local' : c.cls, c.crew].filter(Boolean).join(' · '));
      const col = c.crew ? crewCol.get(c.crew) || '' : ''; if (r.el.style.getPropertyValue('--crew') !== col) { if (col) r.el.style.setProperty('--crew', col); else r.el.style.removeProperty('--crew'); }
      r.dot.hidden = !c.crew;
      set(r.now, cap(c.now || c.status || ''));
      const m = metric.get(c.handle) || 0, vv = sort === 'busy' ? (m >= 1 ? [String(Math.round(m)), 'going on'] : null) : sort === 'drip' ? (c.drip ? [(+c.drip).toFixed(1), 'drip'] : null) : sort === 'marks' ? ((c.marks || []).length ? [String(c.marks.length), c.marks.length > 1 ? 'trophies' : 'trophy'] : null) : sort === 'wanted' ? (rec.get(c.handle) ? [String(rec.get(c.handle)), 'on record'] : null) : sort === 'near' ? near.get(c.handle).label.split(' · ').reverse() : null;
      const vk = vv ? vv.join('|') : ''; if (r.val._k !== vk) { r.val._k = vk; r.val.replaceChildren(...(vv ? [h('b', null, vv[0]), vv[1] ? h('small', null, vv[1]) : ''] : [])); }
      attr(r.val, 'data-tip', sort === 'busy' && m >= 1 ? 'Public events in the last 3 game hours (crimes count triple)' : sort === 'wanted' && rec.get(c.handle) ? 'Arrests, warrants, bounties and robberies on the public record' : null);
      const tk = c.handle + (s === 'jail' ? '|j' : ''); if (r.thumbKey !== tk) { const u = portraits.thumbNow?.(c.handle, s === 'jail'); if (u) { r.img.src = u; r.face.classList.add('is-ok'); r.thumbKey = tk; } else { r.face.classList.remove('is-ok'); if (visible.has(c.handle)) want(c.handle); } } }
    const key = shown.join('|'); if (force || key !== order) { order = key; list.replaceChildren(...shown.map(hh => rows.get(hh).el)); }
    if (active >= shown.length) active = Math.max(0, shown.length - 1); markActive(false);
    const total = cards.length, out = cards.filter(c => statusOf(c) === 'out').length;
    set(countEl, `${shown.length === total ? total : shown.length + ' of ' + total} · ${out} active`);
    empty.hidden = shown.length > 0; if (!shown.length) set(empty, needle ? `Nobody matches “${st.q.trim()}”${st.status !== 'all' || st.crew || st.cls || st.wanted || st.starred || st.mine ? ' with these filters' : ''}.` : 'Nobody matches these filters.');
    qClear.hidden = !st.q;
  }
  function fillSel(s, all, values, cur, extra) { const key = all + values.join('|') + extra.map(e => e[0]).join('|'); if (s._k !== key) { s._k = key; s.replaceChildren(h('option', { value: '' }, all), ...extra.map(([v, l]) => h('option', { value: v }, l)), ...values.map(v => h('option', { value: v }, v))); }
    if (s.value !== cur) s.value = [...s.options].some(o => o.value === cur) ? cur : ''; }
  // ── the active row (↑↓) and the beacon (hovered row first, else the ↑↓ choice while the search has focus)
  function markActive(scrollTo = true) { const hh = shown[active]; for (const r of rows.values()) { const on = r.h === hh; if ((r.el.getAttribute('aria-selected') === 'true') !== on) attr(r.el, 'aria-selected', on ? 'true' : 'false'); }
    const r = hh && rows.get(hh); attr(q, 'aria-activedescendant', r ? r.el.id : null); if (scrollTo && r) r.el.scrollIntoView({ block: 'nearest' }); light(); }
  function light() { if (!isOpen) return; let hh = hoverH || (document.activeElement === q && st.q ? shown[active] : null); const rig = api.cam; if (hh && !hoverH && rig?.mode === 'follow' && rig.subject?.aid === hh) hh = null;   // (the one followed already wears the city's own label)
    const c = hh && sim.agents().find(x => x.handle === hh);
    beacons.show(c ? [{ handle: hh, card: c, hot: true, sub: cap(c.now || '') }] : []); }
  // ── thumbnails: rows on screen ask, one render at a time
  function seen(entries) { for (const e of entries) { const hh = e.target.dataset.h; if (e.isIntersecting) { visible.add(hh); const r = rows.get(hh); if (r && !r.face.classList.contains('is-ok')) want(hh); } else visible.delete(hh); } }
  function want(hh) { if (!thumbQ.includes(hh)) thumbQ.push(hh); pump(); }
  async function pump() { if (pumping) return; pumping = true;
    try { while (isOpen && thumbQ.length) { const hh = thumbQ.shift(); const c = sim.agents().find(x => x.handle === hh); if (!c || !visible.has(hh)) continue; const j = c.status === 'jail';
      const u = await portraits.thumb?.(hh, j); const r = rows.get(hh); if (u && r) { r.img.src = u; r.face.classList.add('is-ok'); r.thumbKey = hh + (j ? '|j' : ''); }
      await new Promise(res => (window.requestIdleCallback || setTimeout)(res, { timeout: 120 })); } }
    catch (e) { console.warn('[people] thumbnail:', e); } finally { pumping = false; } }
  // ── keys in the search field
  q.addEventListener('input', () => { st.q = q.value; active = 0; render(true); scroll.scrollTop = 0; });
  qClear.onclick = () => { q.value = ''; st.q = ''; render(true); q.focus(); };
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); if (!shown.length) return; active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; markActive(); return; }
    if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'PageDown' ? 8 : -8))); markActive(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const hh = shown[active]; if (hh) go(hh); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (q.value) { q.value = ''; st.q = ''; render(true); } else close(); }
  });
  q.addEventListener('focus', light); q.addEventListener('blur', () => setTimeout(light, 0));
  // ── go: follow + the dossier, in one click (ui/goto.js followAgent: the same go for People, its Leaderboards and the City boards)
  function go(hh) { followAgent(api, { sim, handle: hh, open: openDossier, say: toast }); setTimeout(light, 120); }
  // the dossier docks away from its agent: if it would take People's side (the agent on screen right now under where it docks), wait until
  // the camera has brought them clear (≤ 1 s) so the two panels don't trade sides
  function openDossier(hh) {
    if (dossier.isOpen || !isOpen || P.side !== 'left') { dossier.open(hh); return; }
    const s = city.screenOf(hh), pw = dossier.el.offsetWidth || 380;
    if (s && s.x > innerWidth - pw - 40) pendingOpen = { hh, until: performance.now() + 1000, pw }; else dossier.open(hh);
  }
  function frame() { if (!pendingOpen) return; const p = pendingOpen, s = city.screenOf(p.hh); if (!s || s.x <= innerWidth - p.pw - 40 || performance.now() > p.until) { pendingOpen = null; dossier.open(p.hh); } }
  // Esc (the Esc stack, kit.js, while People is the newest screen): the search first, then People (as the search field's own Esc)
  const esc = () => { if (q.value) { q.value = ''; st.q = ''; render(true); } else close(); };
  return { el: P.el, open, close, esc, toggle: () => isOpen ? close() : open(), go, frame, get isOpen() { return isOpen; }, get side() { return P.side; }, focus: () => { if (boardsView()) V.select('pp-all', true); q.focus({ preventScroll: true }); q.select(); }, view: id => { V.select(id === 'boards' ? 'pp-boards' : 'pp-all', true); }, get leaderboards() { return LB; },
    get shown() { return shown.slice(); }, state: () => ({ ...st }), set: o => { Object.assign(st, o); if (o.q !== undefined) q.value = o.q; crewSel.value = st.crew; clsSel.value = st.cls; sortSel.value = st.sort; keep(); syncToggles(); refilter(); },
    stats: () => ({ open: isOpen, view: boardsView() ? 'boards' : 'all', rows: rows.size, shown: shown.length, thumbs: portraits.stats?.().thumbs ?? null, side: P.side }) };
}
