// HUMAN LAYER · SECTION 3a · CITY TV, "CH 9 NEWS": the day's stories as TV cards, camcorder '98 (N, or CH 9 on the ticker).
//   screen   the cards play on their own, one every 7 s: Top stories · each headline (the sim's own `card` stories first) · the Fit Street
//            drop · the Most Wanted · the Director's rush. ◀ ▶ step, ‖ holds; a click on the picture sends the camera there.
//   below    Top stories today · The Director today · Yesterday, on tape (LIVE: the private stories of the director's cut — bribes,
//            tip-offs, the burglar's name — under the TAPE badge, never past the horizon)
//   TAPE     everything as of the tape time, the tape-only stories in the TAPE colour.
// The picture is tv-screen.js on a canvas, so an in-world TV can play the same cards later. Closed, it holds no timers, no subscriptions.
import { h, set, attr, button, lens as lensBadge, onSkinChange, getRoot } from '../kit.js';
import { newsOf, topOf, yesterdayOf, KIND, hhmm, stamp, dayStart, rushAt } from './feed.js';
import { createScreen, themeFrom } from './tv-screen.js';
import { placesNow, flyTo } from '../goto.js';

const EVERY = 7000;
export function createTV({ api, sim, tape, host, openAgent }) {
  const { body } = host;
  const canvas = h('canvas', { class: 'ci-tv-cv' }), flash = h('div', { class: 'ci-tv-flash' }), tc = h('span', { class: 'ci-tv-tc' }), ch = h('span', { class: 'ci-tv-n' });
  const osd = h('div', { class: 'ci-tv-osd', 'aria-hidden': 'true' }, h('span', { class: 'ci-tv-play' }, '▶ PLAY'), tc);
  const screenEl = h('button', { type: 'button', class: 'ci-tv-screen', 'aria-label': 'The news card: click to go there' }, canvas, h('i', { class: 'ci-tv-lines' }), flash, osd);
  const scr = createScreen({ canvas, theme: themeFrom(getRoot()) });
  const prevB = button('', { icon: 'tapeplay', tip: 'Previous card', cls: 'ci-prev', onclick: () => step(-1) }), nextB = button('', { icon: 'tapeplay', tip: 'Next card', onclick: () => step(1) });
  const holdB = button('Hold', { tip: 'Hold this card / play on', onclick: () => { held = !held; syncHold(); } });
  const goB = button('Go there', { icon: 'pin', tip: 'Send the camera where it happened', onclick: () => go() });
  const who = h('div', { class: 'ci-tv-who' });
  const ctl = h('div', { class: 'ci-tv-ctl' }, prevB, holdB, nextB, ch, h('span', { class: 'ci-grow' }), goB);
  const topL = h('ol', { class: 'ci-stories' }), dirL = h('ol', { class: 'ci-stories' }), tapeL = h('ol', { class: 'ci-stories' }), tapeBadge = lensBadge('tape');
  const tapeSec = h('section', { class: 'ci-sec', 'data-lens': 'tape' }, h('div', { class: 'ci-sec-h' }, h('h3', { class: 'k-h' }, 'Yesterday, on tape'), tapeBadge), tapeL);
  const topBadge = lensBadge('live'), dirBadge = lensBadge('live');
  body.append(h('div', { class: 'ci-tv' }, screenEl, ctl, who), h('div', { class: 'k-scroll ci-scroll' },
    h('section', { class: 'ci-sec' }, h('div', { class: 'ci-sec-h' }, h('h3', { class: 'k-h' }, 'Top stories today'), topBadge), topL),
    h('section', { class: 'ci-sec' }, h('div', { class: 'ci-sec-h' }, h('h3', { class: 'k-h' }, 'The Director today'), dirBadge), dirL), tapeSec));
  let cards = [], k = 0, held = false, timer = 0, open = false, offs = [], yday = { hz: null, list: [], busy: false }, deb = 0, lt = 0;
  const tapeOn = () => !!tape?.active && tape.time() !== null;
  const nowT = () => tapeOn() ? tape.time() : sim.clock()?.t ?? null;
  const lensNow = () => tapeOn() ? tape.lens : sim.lens === 'archive' ? 'archive' : 'live';
  const nameOf = w => !w ? '' : w.handle ? '' : placesNow()?.name(w.place) || placesNow()?.distName(w.dist) || w.place || w.dist || '';
  // ── the cards
  function build() {
    const t = nowT(); if (t === null) return; const T = tapeOn(), lens = lensNow(), d0 = dayStart(t);
    let stories = T ? newsOf(tape.events({ from: d0, to: t }), { tape: true }) : newsOf(sim.events({ since: d0 - 1 }));
    if (stories.length < 3) stories = T ? newsOf(tape.events({ from: t - 1440, to: t }), { tape: true }) : newsOf(sim.events({ since: t - 1440 }));
    const top = topOf(stories, 5), out = [];
    const story = (s, l = lens) => ({ type: 'story', id: s.id, kind: s.kind, label: s.tape ? 'On tape · ' + (KIND[s.kind]?.label || 'News') : KIND[s.kind]?.label || 'News', head: s.text, time: stamp(s.t), place: nameOf(s.where), lens: s.tape ? (T ? lens : 'tape') : l, where: s.where, story: s });
    out.push(top.length ? { type: 'top', label: `Top stories · Day ${Math.floor(t / 1440) + 1}`, items: top.map(s => ({ kind: s.kind, text: s.text, time: hhmm(s.t) })), lens, time: stamp(t), place: 'AI City' }
      : { type: 'quiet', label: `Day ${Math.floor(t / 1440) + 1}`, head: 'A quiet day in the city so far. Nothing on the wire yet.', lens, time: stamp(t), place: 'AI City' });
    const heads = [...stories].filter(s => s.card || s.weight >= 6).sort((a, b) => b.t - a.t).slice(0, 8); for (const s of heads) out.push(story(s));
    const drop = [...stories].reverse().find(s => s.type === 'drop'); if (drop) { const items = [...drop.text.matchAll(/(\w+) \((\w+), (\d+)cr\)/g)].map(m => ({ k: m[1], tier: m[2], price: +m[3] }));
      if (items.length) out.push({ type: 'drop', kind: 'drop', label: 'Fit Street drop', sub: /\(([^)]*is in today)\)/.exec(drop.text)?.[1] || '', items, lens, time: stamp(drop.t), place: 'Fit Street', where: { place: 'fitstreet' } }); }
    const mw = T ? null : sim.world()?.mostWanted; if (mw) out.push({ type: 'wanted', kind: 'arrest', label: 'Most Wanted', head: '@' + mw, sub: 'The most crimes on the public record: robberies seen, warrants, arrests.', lens, time: stamp(t), place: '', where: { handle: mw }, handle: mw });
    const ru = T ? rushAt(tape.events({ from: t - 200, to: t }), t) : (() => { const r = sim.world()?.cityEv?.rush; return r && r.until > t ? r : null; })();
    if (ru) { const nm = placesNow()?.distName(ru.dist) || ru.dist; out.push({ type: 'rush', kind: 'director', label: 'The Director · Rush', head: `Rush in ${nm}`, sub: `The crowd on its corners doubles until ${hhmm(ru.until)}.`, lens, time: stamp(t), place: nm, where: { dist: ru.dist } }); }
    if (!T) for (const s of yday.list.slice(-3).reverse()) out.push({ ...story(s, 'tape'), lens: sim.lens === 'archive' ? 'archive' : 'tape', asOf: 'as of ' + stamp(yday.hz) });
    const curId = cards[k]?.id ?? cards[k]?.type; cards = out; const j = cards.findIndex(c => (c.id ?? c.type) === curId); k = j >= 0 ? j : Math.min(k, cards.length - 1);
    // the lists under the screen
    fill(topL, top, lens); fill(dirL, stories.filter(s => s.type === 'director').slice(-6).reverse(), lens, 'No Director today: the city is busy enough on its own.');
    host.badge.update(lens, T ? 'as of ' + stamp(t) : ''); topBadge.update(lens, T ? 'as of ' + stamp(t) : ''); dirBadge.update(lens, T ? 'as of ' + stamp(t) : '');
    tapeSec.hidden = T; if (!T) { const L = sim.lens === 'archive' ? 'archive' : 'tape'; tapeBadge.update(L, sim.tape.pending ? 'on tape tomorrow' : yday.hz != null ? 'as of ' + stamp(yday.hz) : ''); attr(tapeSec, 'data-lens', L);
      fill(tapeL, yday.list.slice(-5).reverse(), L, sim.tape.pending ? 'Private things reach the tape a game day late. Nothing on it yet.' : sim.tape.horizon == null ? 'This sim keeps no director’s cut.' : 'Nothing secret made the news yesterday.'); }
  }
  function fill(ol, list, lens, empty = 'Nothing yet today.') {   // (a story's @handles open the dossier; the row sends the camera there)
    ol.replaceChildren(...(list.length ? list.map(s => { const li = h('li', { class: 'ci-story' + (s.tape ? ' is-tape' : ''), 'data-kind': s.kind }, h('i', { class: 'ci-dot', style: `--ev: var(${KIND[s.kind]?.token || '--k-ink-3'})` }), h('time', null, hhmm(s.t)));
      const tx = h('span', { class: 'ci-text' }); for (const p of s.text.split(/(@[A-Za-z0-9_][A-Za-z0-9_.\-]*[A-Za-z0-9_])/)) if (p) tx.append(p[0] === '@' ? h('button', { type: 'button', class: 'ci-h', onclick: e => { e.stopPropagation(); openAgent(p.slice(1)); } }, p) : p);
      li.append(tx); if (s.where) { li.classList.add('is-go'); li.addEventListener('click', () => flyTo(api, s.where)); attr(li, 'title', 'Click: go there'); } return li; }) : [h('li', { class: 'k-empty' }, empty)]));
  }
  function showCard(anim = true) {
    if (!cards.length) build(); const c = cards[k]; if (!c) return; scr.show(c);
    set(tc, c.time || ''); set(ch, `${k + 1}/${cards.length}`); attr(screenEl, 'aria-label', `${c.label}: ${c.head || (c.items || []).map(i => i.text || i.k).join('; ')}`);
    const hs = [...new Set(((c.head || '') + ' ' + (c.items || []).map(i => i.text || '').join(' ')).match(/@[A-Za-z0-9_][A-Za-z0-9_.\-]*[A-Za-z0-9_]/g) || [])].slice(0, 4);
    who.replaceChildren(...hs.map(x => button(x, { tip: 'Open their card', cls: 'ci-who', onclick: () => openAgent(x.slice(1)) })));
    attr(goB, 'aria-disabled', c.where ? null : 'true');
    if (anim) { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); }
  }
  function step(d) { if (!cards.length) return; k = (k + d + cards.length) % cards.length; showCard(); restartTimer(); }
  function go() { const c = cards[k]; if (c?.where) flyTo(api, c.where); }
  screenEl.addEventListener('click', go);
  function syncHold() { holdB.classList.toggle('is-on', held); set(holdB.querySelector('.k-btn-label'), held ? 'Held' : 'Hold'); restartTimer(); }
  function restartTimer() { clearInterval(timer); timer = 0; if (open && !held) timer = setInterval(() => { k = (k + 1) % Math.max(1, cards.length); showCard(); }, EVERY); }
  const soon = () => { clearTimeout(deb); deb = setTimeout(() => { if (open) { build(); showCard(false); } }, 400); };
  // yesterday's private stories (LIVE): the director's cut's events of the day before the horizon, via the store's tape (clamped by the
  // server; filtered here again: never past the horizon)
  async function fetchYesterday() {
    const hz = sim.tape.horizon; if (tapeOn() || hz == null || yday.busy || (yday.hz != null && hz - yday.hz < 60)) return; yday.busy = true;
    try { const r = await sim.tape.get(Math.max(0, hz - 1440), hz, { snaps: false }); const H = Math.min(hz, r.horizon ?? hz); yday = { hz: H, list: yesterdayOf(r.events, H), busy: false }; soon(); }
    catch { yday.busy = false; }
  }
  return {
    open() { if (open) return; open = true; scr.setTheme(themeFrom(getRoot())); build(); showCard(false); restartTimer(); fetchYesterday();
      offs.push(sim.on('event', e => { if (!tapeOn() && newsOf([e]).length) soon(); }), onSkinChange(() => requestAnimationFrame(() => scr.setTheme(themeFrom(getRoot())))));
      if (tape) offs.push(tape.on('seek', soon), tape.on('mode', soon), tape.on('time', () => { if (performance.now() - lt > 3000) { lt = performance.now(); soon(); } }));
      const iv = setInterval(fetchYesterday, 60000); offs.push(() => clearInterval(iv));
      const fl = () => scr.redraw(); document.fonts?.addEventListener?.('loadingdone', fl); offs.push(() => document.fonts?.removeEventListener?.('loadingdone', fl)); },
    close() { if (!open) return; open = false; clearInterval(timer); timer = 0; clearTimeout(deb); for (const f of offs.splice(0)) f(); },
    get isOpen() { return open; }, get cards() { return cards; }, get index() { return k; }, show: i => { k = i; showCard(false); }, screen: scr, step,
  };
}
