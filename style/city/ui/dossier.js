// HUMAN LAYER · THE DOSSIER (section 1): one click on an agent in the city opens it, docked to the side the agent isn't on.
//   head     the portrait (ui/portrait.js: its real look, turning), handle, class, model, crew, home, marks (trophies)   LIVE
//   actions  Follow (F: the camera rig's follow) · Watch tape (section 2a: TAPE at this agent; in TAPE: Back to live) · Star (kept in this browser)
// IN TAPE (section 2a, ui/tape/index.js setSource): the whole dossier is the agent AS OF the tape time — every section wears the TAPE
// (or ARCHIVE) badge with an "as of Day N · hh:mm" stamp that moves with the scrubber; nothing live is mixed in.
//   Now      the "now" sentence, the last thing said, WANTED                                                            LIVE
//   tabs     Record (the rap sheet: public) · Pockets (cash, heat, inventory, stash) · Head (thoughts, plan, whispers) · People · Home
//            (their own city home + Go there, LIVE: public, rule 5 holds; their Mainland plot: "No land yet", or ?mainland=demo's mock)
//            Pockets and Head are TAPE (a game day late, stamped "as of …", or "on tape tomorrow" while pending), YOURS live on your
//            own agent (?as=), ARCHIVE on a finished season. Every section wears its lens badge; the tab dots wear its colour.
// It reads the store only (sim.agent / sim.agents / sim.where), never a private field outside its lens: the store hands over only what
// the lens allows, and this file shows tape fields only under a TAPE badge, the owner's only under YOURS.
// Smooth: text is redrawn in one batch at most 4× a second, only while open; closed, it holds no timers and no subscriptions.
import { h, set, attr, lens as lensBadge, button, chip, statRow, list, tabs as makeTabs, panel as makePanel, icon, toast, prefs, onSkinChange, screens } from './kit.js';
import { iconFor, slots, slot, groupStacks, info as iconInfo, ready as iconsReady } from './icons/icons.js';   // (item icons: the inventory as an icon grid, marks as badges)
import { flyTo } from './goto.js';
import { cityHome, mainlandPlot, mainlandDemo, kindIcon, noneIcon } from './home/index.js';   // (the Home tab: their city home, their Mainland plot)

const STAR_KEY = 'aicity.ui.stars', TAB_KEY = 'aicity.ui.tab';
const fmtTs = ts => { const m = /^D(\d+)\s+(\d\d:\d\d)$/.exec(ts || ''); return m ? `Day ${m[1]} · ${m[2]}` : (ts || ''); };
const money = n => typeof n === 'number' ? '$' + Math.round(n).toLocaleString('en-US') : '–';
const itemsOf = x => { if (!x) return []; if (Array.isArray(x)) return x.map(i => typeof i === 'string' ? { label: i, n: 1 } : { label: i.label || i.k || i.id || '?', n: i.n ?? 1, fake: i.fake, q: i.q });
  if (typeof x === 'object') return Object.entries(x).filter(([, v]) => v).map(([k, v]) => typeof v === 'object' ? { label: v.label || k, n: v.n ?? 1 } : { label: k, n: v }); return []; };
const stars = { get() { try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) || '[]')); } catch { return new Set(); } }, put(s) { try { localStorage.setItem(STAR_KEY, JSON.stringify([...s])); } catch {} } };

export function createDossier({ api, sim, root, city, portraits, onWatchTape = null }) {
  const P = makePanel({ side: 'right', label: 'Agent dossier' }); root.append(P.el);
  // ── head
  const pv = h('canvas', { width: 208, height: 256, 'aria-hidden': 'true' }), wait = h('div', { class: 'd-wait' }, 'developing…'), rec = h('div', { class: 'd-rec' }, 'REC');
  const portrait = h('div', { class: 'd-portrait' }, pv, wait); const player = portraits.player(pv);
  const handleT = h('span', { class: 'd-handle-t' }), handleEl = h('h2', { class: 'd-handle', id: 'd-handle' }, handleT), clsEl = h('b'), modelEl = h('span'), crewEl = h('b'), homeEl = h('span'), marksEl = h('div', { class: 'd-marks' });
  const xBtn = button('', { icon: 'close', tip: 'Close (Esc)', cls: 'd-x', onclick: () => close() });
  let tsrc = null;   // (section 2a: the tape's view of the agent, as of the tape time, while TAPE is open — null in LIVE)
  const asof = lensBadge('tape'); asof.classList.add('d-asof'); asof.hidden = true;
  const head = h('div', { class: 'd-head' }, portrait, h('div', { class: 'd-id' }, handleEl, h('div', { class: 'd-meta' }, h('div', null, clsEl, ' · ', modelEl), h('div', null, 'crew ', crewEl, h('span', { class: 'k-muted' }, ' · home '), homeEl)), asof, marksEl), xBtn);
  const followBtn = button('Follow', { icon: 'follow', kbd: 'F', primary: true, tip: 'Follow with the camera (F)', onclick: () => toggleFollow() });
  const tapeBtn = button('Watch tape', { icon: 'tapeplay', tip: 'Watch the tape at this agent: the city a day ago, secrets and all', onclick: () => { if (tsrc) tsrc.back(); else if (cur && onWatchTape) onWatchTape(cur); } });

  const starBtn = button('', { icon: 'star', tip: 'Star this agent', onclick: () => toggleStar() });
  const actions = h('div', { class: 'd-actions' }, followBtn, tapeBtn, starBtn);
  const more = h('div', { class: 'd-more' });   // (section 2b: "Where they went" · "Diary", mounted by ui/diary-toys.js)
  // ── now (LIVE)
  const nowLens = lensBadge('live'), nowSentence = h('p', { class: 'd-sentence' }), quote = h('blockquote', { class: 'd-quote', hidden: true }), quoteText = h('span'), quoteCite = h('cite'), wantedEl = h('div', { class: 'd-wanted', hidden: true }, h('span', { class: 'k-chip is-wanted' }, 'WANTED · heat over 75'));   // (both hidden until a card says otherwise: review 10-09 #9)
  quote.append(quoteText, quoteCite);
  const now = h('div', { class: 'd-sec d-now', 'data-lens': 'live' }, h('div', { class: 'd-sec-h' }, h('h3', { class: 'k-h' }, 'Now'), nowLens), nowSentence, quote, wantedEl);
  now.style.padding = '0';
  // ── tabs
  let cur = null, unsub = null, timer = 0, dirty = false, lastDraw = 0, coverT = 0, lastFocus = null;
  const secs = {}; const sec = (id, title) => { const b = lensBadge('live'), body = h('div', { class: 'd-body' }); const el = h('div', { class: 'd-sec', 'data-lens': 'live', role: 'tabpanel', 'aria-labelledby': 'k-tab-' + id, hidden: true }, h('div', { class: 'd-sec-h' }, h('h3', { class: 'k-h' }, title), b), body); secs[id] = { el, badge: b, body }; return el; };
  const T = makeTabs([{ id: 'record', label: 'Record', lens: 'live', tip: 'The public record' }, { id: 'pockets', label: 'Pockets', lens: 'tape' }, { id: 'head', label: 'Head', lens: 'tape' }, { id: 'people', label: 'People', lens: 'live' }, { id: 'home', label: 'Home', lens: 'live', tip: 'Their home in the city, and their land on the Mainland' }],
    { selected: prefs.get(TAB_KEY) || 'record', onchange: (id, user) => { if (user) prefs.set(TAB_KEY, id); showTab(id); } });
  const scroll = h('div', { class: 'k-scroll' }, h('div', { class: 'd-now-wrap', style: 'padding: 0 16px 12px' }, now), T.el, sec('record', 'Rap sheet'), sec('pockets', 'Cash, heat, stuff'), sec('head', 'Thoughts and plan'), sec('people', 'Crew and dealings'), sec('home', 'Their city home'));
  const foot = h('div', { class: 'd-foot' }, h('span', { class: 'd-clock k-mono' }), h('span', { class: 'd-keys' }, '[ ] next agent · Esc close'));
  P.el.append(head, actions, more, scroll, foot);
  showTab(T.selected);
  P.el.setAttribute('aria-labelledby', 'd-handle');
  function showTab(id) { for (const [k, s] of Object.entries(secs)) s.el.hidden = k !== id; if (cur) render(true); }
  // ── state
  const following = () => api.cam?.mode === 'follow' && api.cam?.subject?.agent && api.cam.subject.aid === cur;
  function lensOfPrivate(a) { if (tsrc) return tsrc.lens; if (sim.lens === 'archive') return 'archive'; if (a?.mine) return 'yours'; return 'tape'; }
  const asOf = () => tsrc ? 'as of ' + tsrc.stamp() : '';
  function schedule() { dirty = true; if (timer) return; const wait = Math.max(0, 250 - (performance.now() - lastDraw)); timer = setTimeout(() => { timer = 0; if (dirty && cur) render(); }, wait); }
  // ── open / close
  function open(handle, { from = null } = {}) {
    if (!handle) return; const was = cur; cur = handle; city.select(handle);
    unsub?.(); unsub = sim.on('agent:' + handle, schedule);
    if (!P.isOpen) { lastFocus = document.activeElement; dock(true); screens.open('dossier', { esc: close, isOpen: () => P.isOpen }); }   // (the Esc stack: kit.js)
    render(true); P.open();
    const card = sim.agent(handle)?.live; player.show(handle, card?.status === 'jail', { delay: was ? 0 : 200 });   // (first open: after the slide-in)
    if (!was) { tick = setInterval(tickQuarter, 250); }
    if (from === 'key') followBtn.focus({ preventScroll: true });
    self.onAgent?.(handle);
  }
  function close() { if (!cur) return; cur = null; city.select(null); unsub?.(); unsub = null; clearTimeout(timer); timer = 0; clearInterval(tick); tick = 0; player.stop(); P.close(); screens.close('dossier');
    if (lastFocus && P.el.contains(document.activeElement)) { try { lastFocus.focus?.({ preventScroll: true }); } catch {} } }
  let tick = 0;
  function tickQuarter() { if (!cur) return; dock(false); const c = sim.clock(); set(foot.firstChild, tsrc ? 'tape · ' + tsrc.stamp() : c ? `Day ${c.day} · ${c.hhmm}` : ''); syncFollow(); }
  // dock to the side the agent isn't on; while open, move only when it has stayed under the panel for over a second (and not following)
  function dock(force) {
    const s = city.screenOf(cur), W = innerWidth, pw = P.el.offsetWidth || 380; if (!s) return;
    const under = side => side === 'right' ? s.x > W - pw - 40 : s.x < pw + 40;
    if (force) { P.dock(under('right') ? 'left' : 'right'); coverT = 0; return; }
    if (following()) { coverT = 0; return; }
    if (under(P.side)) { coverT += .25; if (coverT > 1.1 && !under(P.side === 'right' ? 'left' : 'right')) { P.dock(P.side === 'right' ? 'left' : 'right'); coverT = 0; } } else coverT = 0;
  }
  // ── actions
  function syncFollow() { const on = following(); followBtn.classList.toggle('is-on', on); set(followBtn.querySelector('.k-btn-label'), on ? 'Following' : 'Follow');
    const kb = followBtn.querySelector('kbd'); if (kb && kb.style.display !== (on ? 'none' : '')) kb.style.display = on ? 'none' : '';   // (once following, F is the camera's zoom out: KEYS.md)
    const w = cur && sim.where(cur), can = !!(w && w.drawn) || on; attr(followBtn, 'aria-disabled', can ? null : 'true');
    attr(followBtn, 'data-tip', on ? 'Following: click (or 1) to stop · F now zooms out' : can ? 'Follow with the camera (F)' : `Not on the street right now${sim.agent(cur)?.live?.placeName ? ': ' + sim.agent(cur).live.placeName : ''}`); }
  function toggleFollow() {
    const rig = api.cam; if (!cur || !rig) return;
    if (following()) { rig.setMode('orbit'); syncFollow(); return; }
    const w = rig.people.byAid(cur); if (!w) { toast(`@${cur} isn't on the street right now`); return; }
    rig.setMode('follow', { subject: w }); city.follow(cur); setTimeout(syncFollow, 50);
  }
  function toggleStar() { if (!cur) return; const s = stars.get(); const on = !s.has(cur); on ? s.add(cur) : s.delete(cur); stars.put(s); syncStar(); toast(on ? `Starred @${cur}` : `Unstarred @${cur}`); }
  function syncStar() { const on = stars.get().has(cur); starBtn.replaceChildren(icon(on ? 'starOn' : 'star')); starBtn.classList.toggle('is-on', on); attr(starBtn, 'aria-pressed', on ? 'true' : 'false'); attr(starBtn, 'data-tip', on ? 'Unstar' : 'Star this agent'); attr(starBtn, 'aria-label', on ? 'Unstar' : 'Star'); }
  // ── drawing (batched)
  let drawn = { handle: null, rap: null, people: null, tape: null, mine: null, home: null, tab: null };
  const homeKey = c => `${c.home || ''}|${c.homeName || ''}|${c.handle === sim.me}`;
  function render(force = false) {
    if (!cur) return; dirty = false; lastDraw = performance.now();
    const A = tsrc ? tsrc.get(cur) : sim.agent(cur);
    if (!A) { blank(); return; }
    asof.hidden = !tsrc; if (tsrc) asof.update(tsrc.lens, asOf());
    { const k = tsrc ? tsrc.lens : 'live'; nowLens.update(k, tsrc ? asOf() : ''); attr(now, 'data-lens', k); }
    set(tapeBtn.querySelector('.k-btn-label'), tsrc ? 'Back to live' : 'Watch tape'); attr(tapeBtn, 'data-tip', tsrc ? 'Back to LIVE: everything as it was' : 'Watch the tape at this agent: the city a day ago, secrets and all');
    const c = A.live, newAgent = drawn.handle !== cur;
    // head
    if (handleT.textContent !== '@' + c.handle || newAgent) { set(handleT, '@' + c.handle); fitHandle(); } set(clsEl, c.cls || 'citizen'); set(modelEl, c.npc ? 'a Local' : (c.model || 'unknown model').replace(/^[^/]+\//, '')); attr(modelEl, 'title', c.model || null);
    set(crewEl, c.crew || 'none'); set(homeEl, c.homeName || (c.home ? c.home : 'none'));
    const mine = c.handle === sim.me, mk = (c.marks || []).join('|') + (mine ? '|me' : ''); if (marksEl.dataset.k !== mk) { marksEl.dataset.k = mk; marksEl.replaceChildren(mine ? chip('your agent', 'is-yours') : '', ...(c.marks || []).map(markIcon), (c.marks || []).length ? '' : h('span', { class: 'k-muted' }, 'no trophies yet')); }
    if (portrait.querySelector('.d-rec') === null && root.dataset.skin === '98') portrait.prepend(rec); else if (root.dataset.skin !== '98' && rec.parentNode) rec.remove();
    // now
    set(nowSentence, cap(c.now || c.status || ''));
    if (c.lastSay?.text) { quote.hidden = false; set(quoteText, c.lastSay.text); attr(quote, 'title', c.lastSay.text); const ck = sim.clock(), sameDay = ck && c.lastSay.t != null && Math.floor(c.lastSay.t / 1440) === Math.floor(ck.t / 1440); set(quoteCite, `said ${c.lastSay.to && c.lastSay.to !== 'here' ? 'to @' + c.lastSay.to + ' ' : ''}${c.lastSay.t != null ? (sameDay ? 'at ' + hhmm(c.lastSay.t) : 'on ' + dayHhmm(c.lastSay.t)) : ''}`); } else quote.hidden = true;
    wantedEl.hidden = !c.wanted;
    if (newAgent) syncStar(); syncFollow();
    // lenses of the private tabs
    const pl = lensOfPrivate(A); T.lens('pockets', pl); T.lens('head', pl);
    const tab = T.selected;
    if (force || newAgent || tab !== drawn.tab || (tab === 'record' && drawn.rap !== A.rap) || (tab === 'people' && drawn.people !== A.people) || (tab === 'home' && drawn.home !== homeKey(c)) || ((tab === 'pockets' || tab === 'head') && (drawn.tape !== A.tape || drawn.mine !== A.mine))) {
      drawTab(tab, A, pl); drawn = { handle: cur, rap: A.rap, people: A.people, tape: A.tape, mine: A.mine, home: homeKey(c), tab }; }
  }
  // no record of them (in TAPE: pending, or before the tape's frame lands; LIVE: not in the city): only their handle and why, nothing
  // of whoever the dossier showed before (review 10-09 #9: ] showed the new handle over the last agent's crew, home and rap sheet)
  function blank() {
    const msg = !tsrc ? 'Not in the city right now.' : tsrc.stamp() ? 'Finding them on the tape…' : 'Nothing on the tape yet.';   // (no stamp: the tape has no moment to show)
    if (handleT.textContent !== '@' + cur) { set(handleT, '@' + cur); fitHandle(); }
    set(clsEl, '–'); set(modelEl, ''); attr(modelEl, 'title', null); set(crewEl, '–'); set(homeEl, '–'); marksEl.dataset.k = ''; marksEl.replaceChildren();
    set(nowSentence, msg); quote.hidden = true; wantedEl.hidden = true; asof.hidden = true;
    const k = tsrc ? tsrc.lens : 'live'; nowLens.update(k, ''); attr(now, 'data-lens', k);   // (in a pending TAPE: TAPE badges, not the LIVE ones of the last render)
    for (const s of Object.values(secs)) { s.body.replaceChildren(h('div', { class: 'k-empty' }, msg)); s.badge.update(k, ''); attr(s.el, 'data-lens', k); }
    syncStar(); syncFollow();
    drawn = { handle: null, rap: null, people: null, tape: null, mine: null, home: null, tab: null };
  }
  // the handle on one line: step the size down until it fits (once per agent or skin, never per frame); a handle too long even then wraps
  function fitHandle() { handleT.style.fontSize = ''; handleEl.classList.remove('is-wrap'); const room = handleEl.clientWidth - parseFloat(getComputedStyle(handleEl).paddingRight || 0); if (room <= 0) return;
    let size = parseFloat(getComputedStyle(handleT).fontSize), n = 0; while (handleT.offsetWidth > room && size > 15 && n++ < 12) { size -= 1.5; handleT.style.fontSize = size + 'px'; }
    if (handleT.offsetWidth > room) handleEl.classList.add('is-wrap'); }
  onSkinChange(() => requestAnimationFrame(() => { if (cur) fitHandle(); }));
  document.fonts?.addEventListener?.('loadingdone', () => { if (cur) fitHandle(); });   // (a skin's fonts arrive after it switches)
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const hhmm = t => { const m = ((t % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const dayHhmm = t => `Day ${Math.floor(t / 1440) + 1} · ${hhmm(t)}`;
  function stamp(sec, kind, A) {   // the lens badge of a private section: TAPE as of …, on tape tomorrow, YOURS, ARCHIVE
    const tp = A.tape; let at = '';
    if (tsrc) at = asOf(); else if (kind === 'tape') at = tp === 'pending' ? 'on tape tomorrow' : tp && typeof tp === 'object' ? 'as of ' + (tp.ts ? fmtTs(tp.ts) : dayHhmm(tp.asOf ?? 0)) : 'not on tape';
    sec.badge.update(kind, at); attr(sec.el, 'data-lens', kind);
  }
  function pending(kind, A) {
    if (A.tape === 'pending') { const hz = sim.tape?.delay; return h('div', { class: 'd-pending' }, h('b', null, 'On tape tomorrow'), h('span', null, `Private things reach the tape one game day late${hz ? ` (${Math.round(hz / 60)} game hours)` : ''}. Nothing from today yet.`)); }
    return h('div', { class: 'd-pending' }, h('b', null, 'No tape here'), h('span', null, 'This server doesn’t keep a director’s cut, so private things stay private.'));
  }
  function drawTab(tab, A, pl) {
    const S = secs[tab], c = A.live;
    const pub = tsrc ? tsrc.lens : 'live';   // (in TAPE the public tabs are as of the tape time too)
    if (tab === 'record') { S.badge.update(pub, tsrc ? asOf() : ''); attr(S.el, 'data-lens', pub);
      const rows = (A.rap || []).slice(0, 40).map(r => ({ when: (r.ts || '').replace(/^D(\d+)\s+/, 'D$1 '), what: r.text }));
      S.body.replaceChildren(rows.length ? list(rows) : h('div', { class: 'k-empty' }, `Clean record. Nothing on @${c.handle} in the public log yet.`)); return; }
    if (tab === 'people') { S.badge.update(pub, tsrc ? asOf() : ''); attr(S.el, 'data-lens', pub);
      const p = A.people || {}, kids = [];
      if (p.crew) kids.push(h('div', { class: 'k-stats' }, statRow('Crew', p.crew.name), statRow('Leader', p.crew.leader ? '@' + p.crew.leader : '–'), statRow('Members', String((p.crew.members || []).length)), p.crew.turf?.length ? statRow('Turf', p.crew.turf.join(', ')) : ''));
      else kids.push(h('div', { class: 'k-empty' }, 'No crew.'));
      const ties = (p.ties || []).slice(0, 12);
      if (ties.length) { kids.push(h('h4', { class: 'k-h', style: 'margin: 14px 0 4px' }, 'Dealings and rivals'));
        kids.push(list(ties.map(t => h('li', null, h('button', { type: 'button', class: 'k-btn d-tie', style: 'justify-content:flex-start;min-height:32px;padding:0 6px;background:none', onclick: () => open(t.handle) }, '@' + t.handle),
          h('span', { class: 'k-when' }, [t.deals ? `${t.deals} deal${t.deals > 1 ? 's' : ''}` : '', t.fights ? `${t.fights} fight${t.fights > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || `${t.n}×`))), 'is-people')); }
      // private dealings: TAPE (a day late) or YOURS
      const deals = pl === 'yours' ? (A.mine?.myEvents || []).filter(e => ['offer', 'loan_offer', 'hire_offer', 'whisper', 'tip'].includes(e.type)).slice(-8).reverse() : A.tape && typeof A.tape === 'object' ? [...(A.tape.deals || []), ...(A.tape.whispers || []).map(w => ({ ...w, type: 'whisper' }))].sort((a, b) => b.t - a.t).slice(0, 8) : null;
      const sub = h('div', { class: 'd-sec', 'data-lens': pl, style: 'padding: 14px 0 0' }); const b = lensBadge(pl); sub.append(h('div', { class: 'd-sec-h' }, h('h4', { class: 'k-h' }, 'Deals and whispers'), b));
      stampBadge(b, pl, A);
      sub.append(deals === null ? pending(pl, A) : deals.length ? list(deals.map(e => ({ when: (e.ts || '').replace(/^D(\d+)\s+/, 'D$1 '), what: e.text || e.type }))) : h('div', { class: 'k-empty' }, 'No private deals on record.'));
      kids.push(sub); S.body.replaceChildren(...kids); return; }
    if (tab === 'home') { S.badge.update(pub, tsrc ? asOf() : ''); attr(S.el, 'data-lens', pub); S.body.replaceChildren(...drawHome(c)); return; }
    stamp(S, pl, A);
    const src = pl === 'yours' ? A.mine?.me : A.tape && typeof A.tape === 'object' ? A.tape : null;
    if (!src) { S.body.replaceChildren(pending(pl, A)); return; }
    if (tab === 'pockets') {
      // ITEM ICONS: one slot per thing (the sim's stacks merged per item: count, average quality, flags), the name on hover. Same fields, same
      // lens as before: the carried and stashed goods are the tape's (or yours); only the worn traits and the house's visible security are
      // public, and those wear their own LIVE badge (in TAPE they are the tape's public card, as of the tape time)
      const inv = groupStacks(stackList(src.inv)), st = stashOf(src.stash), worn = Object.entries(c.wear || {}).filter(([, k]) => k);
      const kids = [h('div', { class: 'k-stats' }, statRow('Cash', money(src.cash), true), statRow('Heat', typeof src.heat === 'number' ? `${Math.round(src.heat)} / 100${src.heat >= 75 ? ' · wanted' : ''}` : '–'), src.budget != null ? statRow('Model budget', money(src.budget)) : '')];
      kids.push(h('h4', { class: 'k-h', style: 'margin: 14px 0 0' }, 'Carrying'), inv.length ? slots(inv) : h('div', { class: 'k-empty' }, 'Empty pockets.'));
      kids.push(h('h4', { class: 'k-h', style: 'margin: 14px 0 0' }, 'Stash at home'), st.rows.length ? slots(st.rows) : h('div', { class: 'k-empty' }, st.none ? 'No home stash.' : 'Nothing stashed.'));
      const pub = h('div', { class: 'd-pub', style: 'margin-top: 14px' }), pb = lensBadge(tsrc ? tsrc.lens : 'live'); if (tsrc) pb.update(tsrc.lens, asOf());
      pub.append(h('div', { class: 'k-icohead' }, h('h4', { class: 'k-h' }, 'Wearing'), pb));
      pub.append(worn.length ? slots(worn.map(([sl, k]) => ({ key: k, n: 1, label: null, slot: sl })), { cls: 'is-small', size: 30 }) : h('div', { class: 'k-empty' }, 'Wearing nothing from Fit Street.'));
      const house = houseOf(c, src); if (house) pub.append(h('h4', { class: 'k-h', style: 'margin: 12px 0 0' }, 'The house'), house.length ? slots(house, { cls: 'is-small', size: 30, count: false }) : h('div', { class: 'k-empty' }, 'No security on the house.'));
      kids.push(pub); S.body.replaceChildren(...kids);
      return; }
    if (tab === 'head') {
      const kids = [], thoughts = pl === 'yours' ? (src.lastThink ? [{ ts: '', think: src.lastThink }] : []) : (src.thoughts || []).slice(-5).reverse();
      if (pl !== 'yours' && !thoughts.length && src.think) thoughts.push({ ts: src.ts, think: src.think });
      if (thoughts.length) { kids.push(h('h4', { class: 'k-h', style: 'margin: 2px 0 8px' }, pl === 'yours' ? 'Thinking now' : 'Thinking, that day'));
        for (const t of thoughts) kids.push(h('p', { class: 'd-think' }, t.think, t.ts ? h('span', { class: 'k-muted k-mono', style: 'display:block;font-style:normal;font-size:11px;margin-top:2px' }, fmtTs(t.ts) + (t.did ? ' · then ' + t.did : '')) : '')); }
      const plan = src.plan; if (plan) { kids.push(h('h4', { class: 'k-h', style: 'margin: 12px 0 6px' }, 'The plan'));
        if (Array.isArray(plan.steps) && plan.steps.length) kids.push(h('ol', { class: 'd-plan', style: 'margin:0;padding-left:18px' }, ...plan.steps.slice(0, 6).map(s => h('li', null, typeof s === 'string' ? s : s.text || s.do || JSON.stringify(s)))));
        else kids.push(h('p', { class: 'd-plan' }, typeof plan === 'string' ? plan : plan.text || '')); }
      S.body.replaceChildren(...(kids.length ? kids : [h('div', { class: 'k-empty' }, 'Nothing on their mind on tape.')])); }
  }
  // ── Home: their OWN city home (public: the card's home lot; never where they are, never a lot they don't own: rule 5) + their Mainland plot
  function drawHome(c) {
    const H = cityHome(c), kids = [];
    if (H) { const go = button('Go there', { icon: 'pin', tip: `The camera to ${H.name}${H.distName ? ', ' + H.distName : ''}`, cls: 'd-home-go', onclick: () => { if (!flyTo(api, { place: H.id })) toast('Can’t go there right now'); } });
      kids.push(h('div', { class: 'd-home', 'data-tier': H.tier || 'house' }, h('span', { class: 'd-home-pic' }, kindIcon(H.tier)), h('div', { class: 'd-home-t' }, h('b', null, H.kind), h('span', null, H.name), H.distName ? h('small', null, H.distName) : ''), go)); }
    else kids.push(h('div', { class: 'd-home is-none' }, h('span', { class: 'd-home-pic' }, noneIcon()), h('div', { class: 'd-home-t' }, h('b', null, 'No home'), h('span', null, c.npc ? 'A Local: they live on the street they work.' : 'No lot in the city: they sleep rough.'))));
    const land = h('div', { class: 'd-land-sec', 'data-lens': 'live' }, h('div', { class: 'd-sec-h' }, h('h4', { class: 'k-h' }, 'On the Mainland'), mainlandDemo() ? chip('demo', 'd-land-demo') : ''));
    const M = c.npc ? null : mainlandPlot(c.handle, { mine: c.handle === sim.me });
    if (!M) land.append(h('div', { class: 'd-land is-none' }, h('b', null, 'No land yet'), h('span', null, 'The Mainland, across the water: homes there don’t reset with the season. Land can’t be claimed yet.')));
    else { const visit = button(M.mine ? 'Walk there' : 'Visit', { icon: 'pin', tip: M.mine ? `The Mainland: walk out of your front door at ${M.address}` : `The Mainland, at ${M.address} (opens a new tab)`, cls: 'd-land-go', onclick: () => window.open(M.url, '_blank', 'noopener') });
      land.append(h('div', { class: 'd-land' }, h('img', { class: 'd-land-img', src: M.pic, alt: `${M.style} at ${M.address}`, loading: 'lazy', decoding: 'async', draggable: 'false' }),
        h('div', { class: 'd-land-t' }, h('b', null, M.address), h('span', null, M.style), h('small', { class: 'k-mono' }, M.id + ' · the Mainland')), visit)); }
    kids.push(land); return kids;
  }
  // ── item icons: the marks (head), the stash, the house
  function markIcon(m) { const id = typeof m === 'string' ? m : m?.id, I = iconInfo('mark:' + id), el = iconFor('mark:' + id, { size: 26, label: I?.name || id });
    attr(el, 'data-tip', I ? `${I.name}: ${I.what}` : `Mark: ${id}`); attr(el, 'tabindex', '0'); el.classList.add('d-mark'); return el; }
  const stackList = x => Array.isArray(x) ? x.map(i => typeof i === 'string' ? { k: i, n: 1 } : i) : x && typeof x === 'object' ? Object.entries(x).filter(([, v]) => v).map(([k, v]) => typeof v === 'object' ? { k, ...v } : { k, n: v }) : [];
  function stashOf(x) {   // the sim's stash: a number (cash, in the recorded snapshots) or { cash, inv } (the live server); null: no home
    if (x === null || x === undefined) return { rows: [], none: true };
    const cash = typeof x === 'number' ? x : typeof x?.cash === 'number' ? x.cash : 0, items = typeof x === 'object' ? (Array.isArray(x) ? x : x.inv || []) : [];
    const rows = groupStacks(stackList(items)); if (cash > 0) rows.unshift({ key: 'cash', label: 'cash', n: Math.round(cash), cash: true });
    return { rows: rows.map(r => r.cash ? { ...r, n: Math.round(r.n) } : r), none: false }; }
  // the house: its visible security (public: the street sees a dog, a steel door, a camera) and its gear when the source carries it
  function houseOf(c, src) {
    if (!c.home) return null; const out = [], SEC = { lock: 'burglary −25%', door: 'burglary −20%', dog: 'burglary −35%', alarm: 'may trip and wake the owner', safe: 'halves a burglar’s take', camera: 'records a burglar', cctv: 'records a burglar' };
    const lot = !tsrc && window.__simlive?.layer?.model?.homes?.get?.(c.home), sec = src.sec ? Object.entries(src.sec).filter(([, v]) => v).map(([k]) => k) : lot?.sec ? [...lot.sec] : [];
    for (const k of sec) out.push({ key: k, n: 1, label: null, tipx: SEC[k] });
    for (const [k, v] of Object.entries(src.gear || {})) if (v) out.push({ key: k, n: v, label: null, tipx: `${v} batch${v > 1 ? 'es' : ''} left` });
    return out.map(r => ({ ...r, tip: `${iconInfo(r.key)?.name || r.key}${r.tipx ? ' · ' + r.tipx : ''}` })); }
  function stampBadge(b, kind, A) { const tp = A.tape; if (tsrc) { b.update(kind, asOf()); return; } b.update(kind, kind === 'tape' ? (tp === 'pending' ? 'on tape tomorrow' : tp && typeof tp === 'object' ? 'as of ' + (tp.ts ? fmtTs(tp.ts) : dayHhmm(tp.asOf ?? 0)) : 'not on tape') : ''); }
  // ── prev / next over the roster (the store's order; dead and retired skipped)
  function step(d) { const L = sim.agents().filter(a => !a.retired && a.status !== 'dead').map(a => a.handle); if (!L.length) return; const k = L.indexOf(cur), n = L[(k + d + L.length) % L.length];
    const wasFollow = following(); open(n); if (wasFollow) { const w = api.cam.people.byAid(n); if (w) api.cam.setMode('follow', { subject: w }); } }
  // section 2a: TAPE sets the source (the agent as of the tape time) and asks for a redraw as the scrubber moves (batched, ≤ 4 Hz)
  function setSource(s) { tsrc = s || null; if (cur) { drawn.handle = null; render(true); } }
  iconsReady.then(() => { if (cur) { drawn.handle = null; render(true); } });
  const self = { el: P.el, open, close, step, toggleFollow, toggleStar, get current() { return cur; }, get isOpen() { return P.isOpen; }, render, more, onAgent: null, setSource, refresh: () => { if (cur) schedule(); }, get source() { return tsrc; } };
  import('./diary-toys.js').then(m => m.mountToys({ api, sim, portraits, dossier: self })).catch(e => console.warn('[ui] section 2b toys:', e));   // (trails, heat, diary, clips)
  return self;
}
