// HUMAN LAYER · SECTION 4 · PEOPLE → LEADERBOARDS: the City boards' ladders (ui/city-info/board-data.js ladders(): the same numbers, the
// same rules) inside People, so there is one place to browse everyone. Every row is one click (or Enter) → the camera follows them and the
// dossier opens, as a People row (ui/goto.js followAgent, through People's go). ↑ ↓ walk the rows, Home / End the ends.
//   LIVE   Drip · Most Wanted · Trophies · Longest survivor: the store's public cards and public events only
//   TAPE   Richest: cash is private, so it is the director's cut as of the horizon (a game day late), under a TAPE badge; "on tape tomorrow"
//          while the first day isn't on tape; never a live number (board-data.js cutOf / richest)
// Cost: hidden or closed, nothing (no subscription, no timer). Shown: redrawn at most every 2 s after the store's tick, and a board's rows
// are rebuilt only when that board changed (focus kept on the same agent's row). Faces: the People thumbnails (ui/portrait.js), cached.
import { h, set, attr, lens as lensBadge, chip } from '../kit.js';
import { ladders, cutOf } from '../city-info/board-data.js';
import { dur, stamp } from '../city-info/feed.js';

const BOARDS = [['drip', 'Drip'], ['wanted', 'Most Wanted'], ['marks', 'Trophies'], ['survivor', 'Longest survivor'], ['richest', 'Richest']];
const WHY = { rob: 'robbed', burgle: 'burgled', arrest: 'arrested', hospital: 'in hospital', evicted: 'evicted' };

export function createLeaderboards({ sim, portraits, go, hover }) {
  const jump = h('div', { class: 'pp-lb-jump', role: 'group', 'aria-label': 'Jump to a board' });
  const body = h('div', { class: 'pp-lb-body' }), scroll = h('div', { class: 'k-scroll pp-lb-scroll' }, body);
  const el = h('div', { class: 'pp-lb', hidden: true }, jump, scroll);
  const secs = new Map();
  for (const [id, title] of BOARDS) {
    const lens = id === 'richest' ? 'tape' : 'live', badge = lensBadge(lens), list = h('ol', { class: 'pp-lb-rows' }), note = h('p', { class: 'pp-lb-note', hidden: true }), extra = h('div', { class: 'pp-lb-extra', hidden: true });
    const sec = h('section', { class: 'pp-lb-sec', id: 'pp-lb-' + id, 'data-lens': lens, 'aria-labelledby': 'pp-lb-h-' + id }, h('div', { class: 'pp-lb-h' }, h('h3', { class: 'k-h', id: 'pp-lb-h-' + id }, title), badge), note, extra, list);
    secs.set(id, { sec, badge, list, note, extra, key: '' }); body.append(sec);
    const j = h('button', { type: 'button', class: 'k-chip pp-lb-j', 'data-lens': lens, 'data-tip': id === 'richest' ? 'Richest: TAPE only (cash is private: yesterday’s, from the tape)' : null }, title);
    j.onclick = () => { scroll.scrollTo({ top: sec.offsetTop - 4, behavior: 'smooth' }); sec.querySelector('.pp-lb-row')?.focus({ preventScroll: true }); }; jump.append(j);
  }
  // ── rows: <li><button> rank · face · @handle (+ sub) · value </button></li>; the whole row is the button (one Tab stop each, Enter follows)
  const thumbQ = []; let pumping = false;
  function face(hh) { const img = h('img', { alt: '', class: 'pp-img', draggable: 'false', decoding: 'async' }), f = h('span', { class: 'pp-face pp-lb-face' }, img);
    const u = portraits.thumbNow?.(hh); if (u) { img.src = u; f.classList.add('is-ok'); } else { thumbQ.push([hh, img, f]); setTimeout(pump, 0); } return f; }   // (after the row is in the list: pump skips a detached one)
  async function pump() { if (pumping) return; pumping = true;
    try { while (on && thumbQ.length) { const [hh, img, f] = thumbQ.shift(); if (!img.isConnected) continue; const u = await portraits.thumb?.(hh); if (u) { img.src = u; f.classList.add('is-ok'); }
      await new Promise(res => (window.requestIdleCallback || setTimeout)(res, { timeout: 120 })); } }
    catch (e) { console.warn('[people] leaderboard thumbnail:', e); } finally { pumping = false; } }
  function row(r, i) {
    const me = r.h === sim.me, b = h('button', { type: 'button', class: 'pp-lb-row', 'data-h': r.h, 'data-tip': 'Follow @' + r.h + ' (and open their card)' },
      h('span', { class: 'pp-lb-rank' }, String(i + 1)), face(r.h),
      h('span', { class: 'pp-main' }, h('span', { class: 'pp-top' }, h('b', { class: 'pp-name' }, '@' + r.h), h('span', { class: 'pp-badges' }, me ? chip('YOU', 'is-yours') : '', ...(r.chips || []))), r.sub ? h('span', { class: 'pp-sub' }, h('span', null, r.sub)) : ''),
      r.v != null ? h('span', { class: 'pp-val' }, h('b', null, r.v), r.unit ? h('small', null, r.unit) : '') : '');
    b.onclick = () => go(r.h); b.addEventListener('pointerenter', () => hover(r.h)); b.addEventListener('pointerleave', () => hover(null));
    b.addEventListener('focus', () => hover(r.h)); b.addEventListener('blur', () => hover(null));
    return h('li', null, b);
  }
  // one board: rebuilt only when its rows changed; the focused agent keeps the focus
  function fill(id, rows, emptyText) {
    const S = secs.get(id), key = JSON.stringify(rows.map(r => [r.h, r.v, r.sub, (r.chips || []).map(c => c.textContent)])) + emptyText; if (key === S.key) return; S.key = key;
    const f = document.activeElement, fh = S.list.contains(f) ? f.dataset.h : null;
    S.list.replaceChildren(...(rows.length ? rows.map(row) : [h('li', { class: 'k-empty' }, emptyText)]));
    if (fh) S.list.querySelector(`.pp-lb-row[data-h="${CSS.escape(fh)}"]`)?.focus({ preventScroll: true });
  }
  const text = (S, el2, t) => { el2.hidden = !t; if (t) set(el2, t); };
  function render() {
    if (!on) return; lastAt = performance.now();
    const ck = sim.clock(); if (!ck) { for (const S of secs.values()) { S.key = ''; S.list.replaceChildren(h('li', { class: 'k-empty' }, 'Waiting for the city…')); } return; }
    const w = sim.world() || {}, arch = sim.lens === 'archive', L = ladders({ lens: 'live', t: ck.t, agents: sim.agents(), events: sim.events(), mostWanted: w.mostWanted, cut: cutOf(sim) });
    const pub = arch ? 'archive' : 'live';
    for (const id of ['drip', 'wanted', 'marks', 'survivor']) { const S = secs.get(id); if (S.badge.dataset.lens !== pub) S.badge.update(pub); attr(S.sec, 'data-lens', pub); }
    fill('drip', L.drip.map(r => ({ h: r.handle, v: r.v.toFixed(1), unit: 'drip', sub: r.sub })), 'Nobody wears a trait yet.');
    fill('wanted', L.wanted.map(r => ({ h: r.handle, chips: r.why.map(x => chip(x === 'Most Wanted' ? 'MOST WANTED' : x.toUpperCase(), x === 'Most Wanted' || x === 'wanted' ? 'is-wanted' : '')),
      sub: r.crimes ? `${r.crimes} crime${r.crimes > 1 ? 's' : ''} on the public record` : '' })), 'Nobody is wanted right now.');
    fill('marks', L.marks.map(r => ({ h: r.handle, v: String(r.v), unit: r.v > 1 ? 'trophies' : 'trophy', sub: r.sub })), 'No trophies earned yet.');
    { const S = secs.get('survivor'); text(S, S.note, 'Alive and untouched the longest: no robbery, break-in, arrest, hospital or eviction.');
      const uk = L.untouched.join('|'); if (S.extra.dataset.k !== uk) { S.extra.dataset.k = uk; S.extra.hidden = !L.untouched.length;
        S.extra.replaceChildren(h('b', null, `Untouched all season · ${dur(ck.t - L.since)}`), h('div', { class: 'pp-lb-chips' }, ...L.untouched.map(x => { const b = h('button', { type: 'button', class: 'k-chip pp-lb-j', 'data-h': x, 'data-tip': 'Follow @' + x }, '@' + x); b.onclick = () => go(x); return b; }))); }
      fill('survivor', L.survivor.map(r => ({ h: r.handle, v: dur(r.v), sub: `last ${WHY[r.why] || r.why} ${stamp(r.since)}` })), L.untouched.length ? 'Everyone else is untouched.' : 'Nobody yet.'); }
    { const S = secs.get('richest'), R = L.richest; S.badge.update(R.lens, R.pending ? 'on tape tomorrow' : R.asOf != null ? 'as of ' + stamp(R.asOf) : ''); attr(S.sec, 'data-lens', R.lens);
      text(S, S.note, R.pending ? 'Cash is private: Richest is yesterday’s, from the tape. Nothing on it yet.' : R.none ? 'This sim keeps no director’s cut, so cash stays private.' : arch ? '' : 'Cash is private: this is yesterday’s, from the tape (cash + the home stash).');
      fill('richest', R.pending || R.none ? [] : R.rows.map(r => ({ h: r.handle, v: '$' + r.v.toLocaleString('en-US'), sub: r.stash ? `$${r.cash} on them · $${r.stash} at home` : '' })), R.pending ? 'On tape tomorrow.' : R.none ? 'No tape here.' : 'Nobody has a cent.'); }
  }
  // ── keys: ↑ ↓ through every row and chip of every board, Home / End
  el.addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return; const L = [...el.querySelectorAll('.pp-lb-row')]; if (!L.length) return;
    e.preventDefault(); e.stopPropagation(); const k = L.indexOf(document.activeElement);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? L.length - 1 : k < 0 ? 0 : Math.max(0, Math.min(L.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)));
    L[n].focus({ preventScroll: true }); L[n].scrollIntoView({ block: 'nearest' }); });
  // ── shown / hidden
  let on = false, off = null, timer = 0, lastAt = 0;
  const schedule = () => { if (!on || timer) return; timer = setTimeout(() => { timer = 0; render(); }, Math.max(0, 2000 - (performance.now() - lastAt))); };
  return { el,
    show() { if (on) return; on = true; el.hidden = false; off = sim.on('tick', schedule); for (const S of secs.values()) S.key = ''; render(); },
    hide() { if (!on) return; on = false; el.hidden = true; off?.(); off = null; clearTimeout(timer); timer = 0; thumbQ.length = 0; hover(null); },
    focusFirst() { el.querySelector('.pp-lb-row')?.focus({ preventScroll: true }); },
    get isOn() { return on; } };
}
