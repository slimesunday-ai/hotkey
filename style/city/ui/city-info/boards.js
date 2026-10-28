// HUMAN LAYER · SECTION 3a · THE CITY (L, or City on the ticker): one panel, five tabs, each a short scannable list or chart.
//   Ladders   Drip Ladder · Most Wanted · Most marks · Longest survivor (LIVE) · Richest (TAPE only: the director's cut, as of the horizon)
//   Turf      who holds each district · the crews · the Locals · recent takeovers
//   Economy   street sales today · the drop · the street's taste · corners (price, crowd, turf) · loans (debts are public) · the city's
//             money: the pool and the city tax (TAPE, as of the horizon)
//   Crime     today's public crimes (by hour) and the season's · the secret counts (scams, bribes …) as yesterday's totals (TAPE)
//   The dead  who, when, where, how — from the public death events
// A @handle opens the dossier; a ladder row (Ladders tab) is one click → the camera follows them and the dossier opens, as a People row
// (goto.js followAgent); a place or a district sends the camera there (ui/goto.js). In TAPE every tab is as of the tape time.
// Data: board-data.js (pure). Redrawn at most every 2 s while open, only when its inputs changed; closed, nothing runs.
import { h, set, attr, button, chip, lens as lensBadge, tabs as makeTabs, prefs, toast } from '../kit.js';
import { ladders, turf, economy, crime, dead, cutOf, CRIMES, SECRET, MACHINE, RULES } from './board-data.js';
import { stamp, hhmm, dur } from './feed.js';
import { placesNow, flyTo, followAgent } from '../goto.js';
import { publicOf } from '../../simstate/lens.js';

const TAB_KEY = 'aicity.ui.citytab';
const TABS = [{ id: 'ladders', label: 'Ladders', lens: 'live' }, { id: 'turf', label: 'Turf', lens: 'live' }, { id: 'economy', label: 'Economy', lens: 'live' }, { id: 'crime', label: 'Crime', lens: 'live' }, { id: 'dead', label: 'The dead', lens: 'live' }];
const DISTS = Object.keys(RULES.DEMAND);
export function createBoards({ api, sim, tape, host, openAgent }) {
  const { body } = host, view = h('div', { class: 'ci-board-body' }), scroll = h('div', { class: 'k-scroll ci-scroll' }, view);
  let open = false, offs = [], sig = '', lastAt = 0, timer = 0, econ = { at: 0, data: null, busy: false }, cutSnap = { hz: null, snap: null, busy: false }, tapeState = null, tapeReq = 0;
  const T = makeTabs(TABS, { selected: prefs.get(TAB_KEY) || 'ladders', onchange: (id, user) => { if (user) prefs.set(TAB_KEY, id); scroll.scrollTop = 0; render(true); } });
  body.append(T.el, scroll);
  const tapeOn = () => !!tape?.active && tape.time() !== null;
  const P = () => placesNow();
  // ── small builders
  const who = hd => h('button', { type: 'button', class: 'ci-h', onclick: () => openAgent(hd), 'data-tip': 'Open their card' }, '@' + hd);
  // a ladder row is one click (or Enter on its handle): the camera follows them and the dossier opens, as a People row (goto.js followAgent).
  // In TAPE the city on screen is the tape's: the row opens their card as of the tape time, and the camera stays.
  const follow = hd => { if (tapeOn()) openAgent(hd); else followAgent(api, { sim, handle: hd, open: openAgent, say: toast }); };
  const whoGo = hd => h('button', { type: 'button', class: 'ci-h', onclick: () => follow(hd), 'data-tip': tapeOn() ? 'Open their card' : 'Follow them (and open their card)' }, '@' + hd);
  const goRow = (hd, ...kids) => h('li', { class: 'ci-row is-go', 'data-h': hd, onclick: e => { if (!e.target.closest('button')) follow(hd); } }, ...kids);
  const goto = (label, target) => h('button', { type: 'button', class: 'ci-go', onclick: () => flyTo(api, target), 'data-tip': 'Go there' }, label);
  const distName = d => P()?.distName(d) || d, placeName = id => P()?.name(id) || id;
  const asOf = t => t == null ? '' : 'as of ' + stamp(t);
  const arch = () => sim.lens === 'archive' && !tapeOn();   // (a finished season: every board is open, and says ARCHIVE)
  function board(title, lens, at, ...kids) { if (arch()) { lens = 'archive'; if (/^on tape/.test(at)) at = ''; } const b = lensBadge(lens, at); return h('section', { class: 'ci-sec', 'data-lens': lens }, h('div', { class: 'ci-sec-h' }, h('h3', { class: 'k-h' }, title), b), ...kids); }
  const empty = text => h('div', { class: 'k-empty' }, text);
  function pending(lens, text) { return h('div', { class: 'd-pending', style: `--c: var(--k-${lens})` }, h('b', null, 'On tape tomorrow'), h('span', null, text || 'Private things reach the tape one game day late. Nothing on it yet.')); }
  function rows(list, { val, max = null, sub = null, rank = true } = {}) {
    if (!list.length) return null; const M = max ?? Math.max(1e-6, ...list.map(r => +r.v || 0));
    return h('ol', { class: 'ci-rows' }, ...list.map((r, i) => goRow(r.handle, rank ? h('span', { class: 'ci-rank' }, String(i + 1)) : '', h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, whoGo(r.handle), h('b', { class: 'ci-val' }, val(r))),
      max !== false ? h('i', { class: 'ci-bar-v', style: `--w: ${Math.max(2, Math.round((+r.v || 0) / M * 100))}%` }) : '', sub && sub(r) ? h('div', { class: 'ci-row-sub' }, sub(r)) : ''))));
  }
  // ── the inputs: LIVE from the store (+ the public state for the economy, + the director's cut for its private numbers); TAPE: the tape
  const cutNow = () => cutOf(sim, cutSnap.snap);   // (board-data.js: shared with People's Leaderboards)
  function liveCity() { const c = sim.clock(), w = sim.world(); if (!c) return null;
    return { lens: 'live', t: c.t, agents: sim.agents(), crews: w.crews, loans: w.loans, stats: w.stats, statsCut: w.statsCut, mostWanted: w.mostWanted, cityEv: w.cityEv, events: sim.events(), history: sim.history(), econ: econ.data, cut: cutNow() }; }
  // the economy's public numbers (trend, drop, corners): the store doesn't carry them yet (ui/NEEDS.md), so while the Economy tab is open
  // the public state is read every 5 s and cut through the same lens (lens.js publicOf). Never anything else from it.
  async function fetchEcon() {
    if (econ.busy || Date.now() - econ.at < 5000 || !sim.info?.url) return; econ.busy = true;
    try { const u = new URL(sim.info.url); for (const k of ['handle', 'token']) u.searchParams.delete(k); u.searchParams.set('view', 'public');
      const r = await fetch(u, { cache: 'no-store' }); if (r.ok) { const pub = publicOf(await r.json()); econ.data = { trend: pub.trend || null, drop: pub.drop || null, inSlot: pub.inSlot || null, corners: pub.corners || null }; } }
    catch {} econ.at = Date.now(); econ.busy = false; schedule();
  }
  // the pool and the city tax as of the horizon: the director's cut's last snapshot (the store's tape; clamped by the server, and here)
  async function fetchCut() {
    const hz = sim.tape.horizon; if (hz == null || cutSnap.busy || (cutSnap.hz != null && hz - cutSnap.hz < 60)) return; cutSnap.busy = true;
    try { const r = await sim.tape.get(Math.max(0, hz - 60), hz); const s = (r.snapshots || []).filter(x => x.t <= hz).pop(); if (s) cutSnap = { hz, snap: { t: s.t, pool: s.pool, money: s.money }, busy: false }; else cutSnap.busy = false; }
    catch { cutSnap.busy = false; } schedule();
  }
  async function tapeCity() { const t = tape.time(), id = ++tapeReq; const S = await tape.stateAt(t); if (id !== tapeReq || !S) return; tapeState = { ...S, lens: tape.lens, t: Math.min(S.t ?? t, t), events: tape.events({ to: t }) }; render(true); }
  // ── the tabs
  const DRAW = {
    ladders(c) { const L = ladders(c), lens = L.lens, at = c.lens === 'live' ? '' : asOf(c.t), R = L.richest;
      return [
        board('Drip Ladder', lens, at, rows(L.drip, { val: r => r.v.toFixed(1), sub: r => r.sub }) || empty('Nobody wears a trait yet.')),
        board('Most Wanted', lens, at, L.wanted.length ? h('ol', { class: 'ci-rows' }, ...L.wanted.map((r, i) => goRow(r.handle, h('span', { class: 'ci-rank' }, String(i + 1)), h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, whoGo(r.handle), h('span', { class: 'ci-chips' }, ...r.why.map(w => chip(w === 'Most Wanted' ? 'MOST WANTED' : w, w === 'Most Wanted' || w === 'wanted' ? 'is-wanted' : '')))),
          r.crimes ? h('div', { class: 'ci-row-sub' }, `${r.crimes} crime${r.crimes > 1 ? 's' : ''} on the public record`) : ''))) ) : empty('Nobody is wanted right now.')),
        board('Most marks', lens, at, rows(L.marks, { val: r => String(r.v), sub: r => r.sub }) || empty('No marks earned yet.')),
        board('Longest survivor', lens, at, h('p', { class: 'ci-note' }, 'Alive and untouched the longest: no robbery, break-in, arrest, hospital or eviction.'),
          L.untouched.length ? h('div', { class: 'ci-untouched' }, h('b', null, c.history && !c.history.complete ? `Nothing on this page's record · its log has gaps${c.history.lastGap ? ` (${c.history.lastGap.ts})` : c.history.from != null ? ` (it starts ${stamp(c.history.from)})` : ''}` : `Untouched all season · ${dur((c.t ?? 0) - L.since)}`), h('div', { class: 'ci-chips is-left' }, ...L.untouched.map(x => whoGo(x)))) : '',
          rows(L.survivor, { val: r => dur(r.v), sub: r => `last ${r.why === 'rob' ? 'robbed' : r.why === 'burgle' ? 'burgled' : r.why === 'arrest' ? 'arrested' : r.why === 'hospital' ? 'in hospital' : 'evicted'} ${stamp(r.since)}` }) || (L.untouched.length ? '' : empty('Nobody yet.'))),
        board('Richest', R.lens, R.pending ? 'on tape tomorrow' : R.asOf != null ? asOf(R.asOf) : '', R.pending ? pending('tape', 'Cash is private: the Richest board is yesterday’s, from the tape. Nothing on it yet.') : R.none ? empty('This sim keeps no director’s cut, so cash stays private.')
          : h('div', null, c.lens === 'live' && !arch() ? h('p', { class: 'ci-note' }, 'Cash is private: this is yesterday’s, from the tape (cash + the home stash).') : '', rows(R.rows, { val: r => '$' + r.v.toLocaleString('en-US'), sub: r => r.stash ? `$${r.cash} on them · $${r.stash} at home` : '' }) || empty('Nobody has a cent.'))),
      ]; },
    turf(c) { const D = turf(c), lens = D.lens, at = c.lens === 'live' ? '' : asOf(c.t), holder = new Map(); for (const k of [...D.locals, ...D.crews]) for (const d of k.turf) holder.set(d, k);
      const dists = [...new Set([...DISTS, ...holder.keys()])];
      return [
        board('Who holds the city', lens, at, h('ol', { class: 'ci-rows ci-dists' }, ...dists.map(d => { const k = holder.get(d); return h('li', { class: 'ci-row' + (k ? '' : ' is-open') }, h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, goto(distName(d), { dist: d }), k ? h('b', { class: 'ci-val' + (k.locals ? ' is-locals' : '') }, k.name) : h('span', { class: 'k-muted' }, 'nobody')))); }))),
        board('The crews', lens, at, D.crews.length ? h('ol', { class: 'ci-rows' }, ...D.crews.map(k => h('li', { class: 'ci-row' }, h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, h('b', { class: 'ci-crew' }, k.name), h('span', { class: 'ci-chips' }, ...(k.turf.length ? k.turf.map(d => goto(distName(d), { dist: d })) : [h('span', { class: 'k-muted' }, 'no turf')]))),
          h('div', { class: 'ci-row-sub' }, 'led by ', who(k.leader), ` · ${k.members.length} member${k.members.length === 1 ? '' : 's'}${k.corners ? ` · ${k.corners} corner${k.corners > 1 ? 's' : ''}` : ''}`))))) : empty('No player crews.')),
        board('The Locals', lens, at, h('p', { class: 'ci-note' }, 'The city’s own crews: they hold their districts until someone out-sells them, and never take more.'), D.locals.length ? h('ol', { class: 'ci-rows' }, ...D.locals.map(k => h('li', { class: 'ci-row' }, h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, h('b', { class: 'ci-crew is-locals' }, k.name), h('span', { class: 'ci-chips' }, ...(k.turf.length ? k.turf.map(d => goto(distName(d), { dist: d })) : [chip('finished')])))))) ) : empty('The Locals are gone.')),
        board('Recent takeovers', lens, at, D.moves.length ? h('ol', { class: 'ci-stories' }, ...D.moves.map(m => h('li', { class: 'ci-story is-go', 'data-kind': 'turf', onclick: () => flyTo(api, { dist: m.dist }), title: 'Click: go there' }, h('i', { class: 'ci-dot', style: '--ev: var(--k-ev-turf)' }), h('time', null, m.ts?.replace(/^D(\d+) /, 'D$1 ') || ''), h('span', { class: 'ci-text' }, m.text)))) : empty('No turf has changed hands yet.')),
      ]; },
    economy(c) { const E = economy(c), lens = E.lens, at = c.lens === 'live' ? '' : asOf(c.t), pend = c.lens === 'live' && !c.econ;
      const corners = E.corners.slice().sort((a, b) => b.today.n - a.today.n || (a.price ?? 1) - (b.price ?? 1));
      const cut = E.cut, money = cut && typeof cut === 'object' && cut.money ? Object.entries(cut.money).filter(([, v]) => v).sort((a, b) => b[1] - a[1]) : [];
      return [
        board('Today on the street', lens, at, h('div', { class: 'ci-tiles' }, tile('Street sales', `${E.sales.n}`, `$${E.sales.cr.toLocaleString('en-US')} paid today`), tile('Turf tax', E.turfTax != null ? '$' + E.turfTax : '–', 'paid to crews, all season'),
          tile('Rent today', E.rent ? `${E.rent.trailer ?? '–'} · ${E.rent.house ?? '–'} · ${E.rent.estate ?? '–'}` : '–', 'trailer · house · estate'), tile('In fashion', E.inSlot ? E.inSlot : '–', `worn there counts ×1.5`))),
        board('The drop · Fit Street', lens, at, E.drop?.length ? h('div', { class: 'ci-drop' }, ...E.drop.map(d => h('div', { class: 'ci-drop-i' + (d.stock ? '' : ' is-out') }, h('b', null, d.k), h('span', null, `$${d.price}`), h('small', null, d.stock ? `${d.stock} left` : 'sold out'))), goto('Go to Fit Street', { place: 'fitstreet' }))
          : pend ? empty('Reading the street…') : E.dropText ? h('p', { class: 'ci-note' }, E.dropText) : empty('No drop today.')),
        board('What the street wants', lens, at, E.trend ? h('ol', { class: 'ci-rows ci-dists' }, ...Object.entries(E.trend).map(([d, p]) => h('li', { class: 'ci-row' }, h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, goto(distName(d), { dist: d }), h('b', { class: 'ci-val' }, p), h('span', { class: 'k-muted' }, `${E.demand(d)}/h`)))))) : empty(pend ? 'Reading the street…' : '–'),
          h('p', { class: 'ci-note' }, `Each district wants one product ×1.6 today. Crowd: sales an hour at a corner (${E.night ? 'night' : 'day'}${E.rush ? `, rush in ${distName(E.rush.dist)} ×2` : ''}).`)),
        board('Corners', lens, at, corners.length ? h('table', { class: 'ci-table' }, h('thead', null, h('tr', null, h('th', null, 'Corner'), h('th', null, 'Price'), h('th', null, 'Sold'), h('th', null, 'Turf'))),
          h('tbody', null, ...corners.map(k => { const p = P()?.get(k.id); return h('tr', null, h('td', null, goto(placeName(k.id), { place: k.id }), h('small', null, distName(p?.dist))), h('td', null, k.price != null ? h('span', { class: 'ci-pct', style: `--w: ${Math.round(k.price * 100)}%` }, `${Math.round(k.price * 100)}%`) : '–'),
            h('td', null, `${k.today.n}`, k.today.last ? h('small', null, `${k.today.last.item} $${k.today.last.price}`) : ''), h('td', null, k.turf || h('span', { class: 'k-muted' }, '–'))); })))
          : empty(pend ? 'Reading the street…' : 'No corner sales yet.'), h('p', { class: 'ci-note' }, 'Price: what a unit fetches against a fresh corner (each sale saturates it; it recovers by the hour).')),
        board('Loans · debts are public', lens, at, E.loans.length ? h('ol', { class: 'ci-rows' }, ...E.loans.map(l => h('li', { class: 'ci-row' }, h('div', { class: 'ci-row-main' }, h('div', { class: 'ci-row-top' }, who(l.to), h('b', { class: 'ci-val' }, `$${l.left}`), l.late ? chip('LATE', 'is-wanted') : ''),
          h('div', { class: 'ci-row-sub' }, `owes ${l.from === 'shark' ? 'the loan shark' : '@' + l.from}${l.due != null ? ' · due ' + stamp(l.due) : ''}${l.paid ? ` · $${l.paid} paid` : ''}`))))) : empty('Nobody owes anybody.')),
        board('The city’s money', cut === 'pending' ? 'tape' : cut?.lens || 'tape', cut === 'pending' ? 'on tape tomorrow' : cut && typeof cut === 'object' ? asOf(cut.asOf) : '',
          cut === 'pending' ? pending('tape', 'The pool and the city tax are the city’s books: on the tape a game day late.') : !cut || cut.pool == null ? empty(sim.tape.horizon == null && c.lens === 'live' ? 'This sim keeps no director’s cut.' : 'Reading the tape…')
            : h('div', null, h('div', { class: 'ci-tiles' }, tile('The pool', '$' + cut.pool, 'pays the cops, the dock shifts, bounties'), tile('City tax', '$' + (cut.money?.tax ?? 0), '3% a day on wealth over $100')),
              money.length ? h('div', { class: 'ci-flows' }, ...money.slice(0, 10).map(([k, v]) => h('div', { class: 'ci-flow' }, h('span', null, k), h('i', { style: `--w: ${Math.round(v / money[0][1] * 100)}%` }), h('b', null, '$' + v)))) : '')),
      ]; },
    crime(c) { const C = crime(c), lens = C.lens, at = c.lens === 'live' ? '' : asOf(c.t), M = Math.max(1, ...C.byHour), S = C.secret;
      return [
        board(`Today · Day ${C.day}`, lens, at, h('div', { class: 'ci-tiles is-crime' }, ...CRIMES.filter(([k]) => C.today[k] || ['rob', 'burgle', 'arrest', 'death'].includes(k)).map(([k, label]) => tile(label, String(C.today[k] || 0), C.season[k] != null ? `${C.season[k]} this season` : ''))),
          h('div', { class: 'ci-hours', 'aria-label': 'Crimes by hour today' }, ...C.byHour.map((n, hr) => h('i', { class: hr === C.hour ? 'is-now' : hr > C.hour ? 'is-later' : '', style: `--h: ${Math.round(n / M * 100)}%`, 'data-tip': `${String(hr).padStart(2, '0')}:00 · ${n}` }))),
          h('div', { class: 'ci-hours-x' }, h('span', null, '00'), h('span', null, '06'), h('span', null, '12'), h('span', null, '18'), h('span', null, '24'))),
        board('The secret ones', S?.lens || 'tape', S?.pending ? 'on tape tomorrow' : S?.asOf != null ? asOf(S.asOf) : '', !S || S.pending ? pending('tape', 'Scams, bribes and tip-offs never show live: their totals reach the tape a game day late.')
          : h('div', null, c.lens === 'live' && !arch() ? h('p', { class: 'ci-note' }, 'Season totals as of yesterday, from the tape: nobody on the street saw these.') : '', h('div', { class: 'ci-tiles' }, ...SECRET.map(([k, label]) => tile(label, String(S.counts[k] ?? 0), ''))),
            h('h4', { class: 'k-h ci-sub-h' }, 'The machines behind the agents'), h('div', { class: 'k-stats' }, ...MACHINE.filter(([k]) => S.counts[k] != null).map(([k, label]) => statLine(label, String(S.counts[k])))))),
      ]; },
    dead(c) { const D = dead(c), lens = D.lens, at = c.lens === 'live' ? '' : asOf(c.t);
      return [board('The dead', lens, at, D.dead.length ? h('div', { class: 'ci-wall' }, ...D.dead.map(x => h('article', { class: 'ci-grave' }, who(x.handle), h('div', { class: 'ci-how' }, x.how), h('div', { class: 'ci-when' }, stamp(x.t)),
          x.at ? goto(placeName(x.at), { place: x.at }) : '', x.by ? h('div', { class: 'ci-row-sub' }, 'by ', who(x.by)) : '')))
        : h('div', { class: 'ci-nodead' }, h('b', null, 'Nobody has died this season.'), h('span', null, D.closeCalls ? `${D.closeCalls} close call${D.closeCalls > 1 ? 's' : ''}: hospital trips.` : 'Not even a close call.'))),
        D.lastHurt.length ? board('Close calls', lens, at, h('ol', { class: 'ci-stories' }, ...D.lastHurt.map(x => h('li', { class: 'ci-story', 'data-kind': 'hurt' }, h('i', { class: 'ci-dot', style: '--ev: var(--k-ev-death)' }), h('time', null, x.ts?.replace(/^D(\d+) /, 'D$1 ') || ''), h('span', { class: 'ci-text' }, x.text))))) : ''];
    },
  };
  function tile(label, v, sub) { return h('div', { class: 'ci-tile' }, h('span', null, label), h('b', null, v), sub ? h('small', null, sub) : ''); }
  function statLine(label, v) { return h('div', { class: 'k-stat' }, h('span', null, label), h('b', null, v)); }
  // ── drawing (batched: at most every 2 s, only when the inputs changed)
  function signature(c) { const ev = c.events, w = sim.world(); return [T.selected, c.lens, Math.floor((c.t ?? 0) / (c.lens === 'live' ? 10 : 1)), ev?.length, ev?.[ev.length - 1]?.id, sim.agents().length, w?.statsCut?.asOf, econ.at, cutSnap.hz, sim.tape.pending, placesNow() ? 1 : 0].join('|'); }
  function render(force = false) {
    if (!open) return; const id = T.selected;
    if (id === 'economy' && !tapeOn()) { fetchEcon(); fetchCut(); }
    const c = tapeOn() ? tapeState : liveCity(); if (!c) { view.replaceChildren(empty(tapeOn() ? 'Reading the tape…' : 'Waiting for the city…')); return; }
    const s = signature(c); if (!force && s === sig) return; sig = s; lastAt = performance.now();
    const lens = arch() ? 'archive' : c.lens; host.badge.update(lens, c.lens === 'live' ? '' : asOf(c.t)); for (const d of TABS) T.lens(d.id, lens === 'live' ? (d.id === 'ladders' || d.id === 'crime' || d.id === 'economy' ? 'live' : 'live') : lens);
    try { view.replaceChildren(...DRAW[id](c).filter(Boolean)); } catch (e) { console.error('[city-info] board', id, e); view.replaceChildren(empty('This board failed to draw: ' + e.message)); }
  }
  function schedule() { if (!open || timer) return; timer = setTimeout(() => { timer = 0; render(); }, Math.max(0, 2000 - (performance.now() - lastAt))); }
  return {
    open() { if (open) return; open = true; sig = '';
      offs.push(sim.on('tick', () => { if (!tapeOn()) schedule(); }));
      if (tape) { let deb = 0, lt = 0; const pull = () => { clearTimeout(deb); deb = setTimeout(() => { if (tapeOn()) tapeCity(); else render(true); }, 250); };
        offs.push(tape.on('seek', pull), tape.on('mode', ({ active }) => { tapeState = null; pull(); }), tape.on('time', () => { if (performance.now() - lt > 2000) { lt = performance.now(); pull(); } }), () => clearTimeout(deb)); }
      if (tapeOn()) tapeCity(); else render(true); },
    close() { if (!open) return; open = false; clearTimeout(timer); timer = 0; for (const f of offs.splice(0)) f(); },
    select(id) { T.select(id, true); }, get tab() { return T.selected; }, get isOpen() { return open; }, render,
  };
}
