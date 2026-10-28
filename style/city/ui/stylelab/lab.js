// UI STYLE LAB (2026-10-07) · slime curates UI styles for AI City: one fixed mock (the menu bar + a compact agent card, mock.css) in
// every style (styles.css, listed in styles.js) over a real street still. Keep / kill / maybe + a note per style save to ./picks.json
// through POST /api/stylelab (style/serve.mjs: atomic, this one file only) and to localStorage (so an old server loses nothing).
// The newer of the two (by "updated") wins on load; if the browser copy is newer the file is brought up to date.
// ROUND 2 (2026-10-07): the mock gained real assets (@www.girl's own cast look, img/agent.svg; a Carrying row of real item icons from
// ui/icons/atlas; the crew and district colours) and the city's own sign lettering (pixtype.js, from signage/type) as .mk-px twins of
// the words, hidden unless a style shows them. Styles carry round: 1 | 2; the page shows one round at a time (a tab), picks share a file.
import { STYLES } from './styles.js';
import { PIX } from './pixtype.js';
import { svg } from '../menu/icons.js';

const Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const LS = { get(k, d) { try { const v = localStorage.getItem('aicity.stylelab.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aicity.stylelab.' + k, JSON.stringify(v)); } catch {} } };
const CROP_W = 920, BGS = ['street', 'night', 'calm'], FILTERS = ['all', 'keep', 'maybe', 'undecided', 'kill'], DECIDE = ['keep', 'maybe', 'kill', 'undecided'];
const KEY = { k: 'keep', m: 'maybe', x: 'kill', u: 'undecided' }, LABEL = { keep: 'KEEP', maybe: 'MAYBE', kill: 'KILL', undecided: '' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const byId = Object.fromEntries(STYLES.map(s => [s.id, s])), roundOf = s => s.round || 1, ROUNDS = [...new Set(STYLES.map(roundOf))].sort().reverse();
const CREW = '#FFC21A', DIST = '#2F5BFF';   // the mock's colour coding: crew Sunny Cooks (wall yellow), district Downtown (wall blue)

// ── the city's sign lettering: a word as an SVG of its bitmap (one path for the ink, one for the face's second colour, one for the
// voxel bevel a style may turn on with --px-sh), sized by --px (px per bit) in CSS
const pxCache = new Map();
function px(face, word, cls = '') {
  const key = face + '|' + word; if (!pxCache.has(key)) { const R = (PIX[key] || PIX[(face.endsWith(':big') ? 'pixel:big' : 'pixel') + '|' + word] || '').split(' ');
    let ink = '', fx = '', sh = ''; R.forEach((r, j) => { for (let i = 0; i < r.length; i++) { if (r[i] === '#') { ink += `M${i} ${j}h1v1h-1z`; sh += `M${i} ${j + .78}h1v.22h-1zM${i + .8} ${j}h.2v.78h-.2z`; } else if (r[i] === '+') fx += `M${i} ${j}h1v1h-1z`; } });
    pxCache.set(key, `viewBox="0 0 ${R[0]?.length || 1} ${R.length || 1}" style="--w:${R[0]?.length || 1};--h:${R.length || 1}" shape-rendering="crispEdges" aria-hidden="true"><path class="fx" d="${fx}"/><path d="${ink}"/><path class="sh" d="${sh}"/></svg>`); }
  return `<svg class="mk-px ${cls}" ` + pxCache.get(key);
}
// ── the one mock: identical markup for every style (a style's px / pxBig only pick the lettering face of the .mk-px twins)
const ITEMS = [['people', 'People', 'people', '/'], ['map', 'Map', 'map', 'B'], ['city', 'City', 'city', 'L'], ['tv', 'TV', 'tv', 'N'], ['tape', 'Tape', 'tape', null],
  ['action', 'Action', 'bolt', '.'], ['settings', 'Settings', 'gear', '`']];
const BAG = [['sudo', 'Sudo', 3], ['salts', 'Salts', 2], ['gun', 'Gun', 1], ['trucker', 'WWW trucker', 1], ['stack', 'Stacked chains', 1]];
const CELL = { sudo: [9, 0], salts: [2, 0], gun: [1, 1], trucker: [8, 3], stack: [9, 2] };   // (atlas cells: icons.json x / 64, y / 64)
const ic = k => svg(k).outerHTML;
function mock(id) {
  const st = byId[id] || {}, f = st.px || 'pixel', F = st.pxBig?.endsWith('/s') ? st.pxBig.slice(0, -2) : (st.pxBig || 'pixel') + ':big',   // ('face/s': the handle in the small 7-px cut, scaled up)
    T = (t, w, face = f) => `<span class="mk-t">${t}</span>${px(face, w)}`;
  const items = ITEMS.map(([d, l, i, k]) => `<button class="mk-item${d === 'people' ? ' is-on' : ''}" data-id="${d}" tabindex="-1"><span class="mk-ic">${ic(i)}</span><span class="mk-lbl">${l}</span>${px(f, l.toUpperCase())}${k ? `<kbd>${esc(k)}</kbd>` : ''}</button>${d === 'tape' ? '<i class="mk-sep"></i>' : ''}`).join('');
  const bag = BAG.map(([k, n, c]) => `<li class="mk-it" data-k="${k}" title="${n}"><i class="mk-icon" style="--ix:${CELL[k][0]};--iy:${CELL[k][1]}"></i><b>${c}</b></li>`).join('');
  return `<div class="mk" data-style="${esc(id)}" data-round="${roundOf(st)}" style="--crew:${CREW};--dist:${DIST}" aria-hidden="true"><div class="mk-bg"></div>
<nav class="mk-bar"><div class="mk-brand"><i class="mk-mark"></i>${T('AI City', 'AI CITY')}</div><div class="mk-items">${items}</div></nav>
<section class="mk-card">
<header class="mk-head"><div class="mk-pic"><img src="img/agent.svg" alt=""><span class="mk-rec">REC</span></div>
<div class="mk-who"><h2 class="mk-handle">${T('@www.girl', '@WWW.GIRL', F)}</h2><p class="mk-role"><b>dealer</b> · <span class="mk-crew">crew sunny cooks</span></p></div>
<button class="mk-x" tabindex="-1">${ic('close')}</button></header>
<div class="mk-now"><div class="mk-nowrow"><span class="mk-lens is-live"><i class="mk-dot"></i>${T('LIVE', 'LIVE')}</span><p class="mk-doing">dealing at Fit &amp; 3rd</p><span class="mk-dist">${T('Downtown', 'DOWNTOWN')}</span></div>
<blockquote class="mk-quote">Corner’s mine till the lights change.<cite>said at 05:50</cite></blockquote></div>
<div class="mk-tape"><span class="mk-lens is-tape">${ic('tape')}${T('TAPE', 'TAPE')}</span><span class="mk-asof">as of Day 3 · 06:00</span></div>
<dl class="mk-stats"><div class="mk-stat" data-k="cash"><dt>${T('Cash', 'CASH')}</dt><dd>${T('$43', '$43')}</dd></div><div class="mk-stat" data-k="heat"><dt>${T('Heat', 'HEAT')}</dt><dd><span class="mk-t">12<small>/100</small></span>${px(f, '12/100')}</dd><i class="mk-meter" style="--v:.12"></i></div><div class="mk-stat" data-k="drip"><dt>${T('Drip', 'DRIP')}</dt><dd>${T('2.9', '2.9')}</dd></div></dl>
<div class="mk-carry"><span class="mk-carry-h">${T('Carrying', 'CARRYING')}</span><ul class="mk-bag">${bag}</ul></div>
<footer class="mk-acts"><button class="mk-btn is-primary" tabindex="-1">${ic('follow')}${T('Follow', 'FOLLOW')}<kbd>F</kbd></button><button class="mk-btn" tabindex="-1">${ic('tape')}${T('Watch tape', 'WATCH TAPE')}</button></footer>
</section><div class="mk-fx"></div></div>`;
}

// ── backdrop (street = a busy day still, night, calm = open sky)
const setBg = b => { if (!BGS.includes(b)) b = 'street'; S.bg = b; document.body.style.setProperty('--lab-bg', `url("${new URL(`img/${b}.jpg`, import.meta.url).href}")`);
  document.querySelectorAll('#bgs button').forEach(x => x.classList.toggle('on', x.dataset.bg === b)); LS.set('bg', b); };
const S = { bg: 'street', round: ROUNDS.includes(+Q.get('round')) ? +Q.get('round') : ROUNDS.includes(LS.get('round')) ? LS.get('round') : ROUNDS[0], filter: FILTERS.includes(LS.get('filter')) ? LS.get('filter') : 'all', size: ['s', 'm', 'l'].includes(LS.get('size')) ? LS.get('size') : 'm', picks: {}, updated: null };
setBg(Q.get('bg') || LS.get('bg', 'street'));

// ── ?shot=<id>: only the stage (tools/shoot: headless screenshots)
if (Q.has('shot')) {
  document.body.classList.add('shot'); const d = document.createElement('div'); d.className = 'shotstage'; d.innerHTML = mock(byId[Q.get('shot')] ? Q.get('shot') : 'clean'); document.body.append(d);
  document.fonts.ready.then(() => Promise.all([...d.querySelectorAll('img')].map(i => i.decode().catch(() => {})))).then(() => { document.title = 'ready'; });
} else main();

async function main() {
  // load: the file on disk vs this browser's copy, newer wins
  const disk = await fetch('./picks.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null), mine = LS.get('picks', null);
  const src = mine && (!disk || String(mine.updated || '') > String(disk.updated || '')) ? mine : disk;
  for (const [id, e] of Object.entries(src?.styles || {})) if (byId[id] && DECIDE.includes(e.status)) S.picks[id] = { status: e.status, note: e.note || '', at: e.at };
  S.updated = src?.updated || null;
  if (src && src === mine && mine.updated) { flush(); }
  else setSave(disk ? `loaded · picks.json · ${count('keep')} keep · ${count('maybe')} maybe · ${count('kill')} kill` : 'no picks.json yet · decisions save there', disk ? 'ok' : '');

  // the grid
  const grid = $('grid'); grid.dataset.size = S.size;
  const nth = {}; for (const r of ROUNDS) STYLES.filter(s => roundOf(s) === r).forEach((s, i) => { nth[s.id] = i + 1; });
  grid.innerHTML = STYLES.map(s => `<article class="card" data-id="${s.id}" tabindex="0">
<div class="thumb" title="Open full size">${mock(s.id)}<span class="stamp"></span></div>
<div class="meta"><div class="name"><b>${esc(s.name)}</b><i>${roundOf(s) > 1 ? 'R' + roundOf(s) + '·' : ''}${String(nth[s.id]).padStart(2, '0')}</i>${tag(s)}</div>
<div class="decide">${['keep', 'maybe', 'kill'].map(d => `<button data-d="${d}" tabindex="-1">${d[0].toUpperCase() + d.slice(1)}<kbd>${d === 'kill' ? 'X' : d[0].toUpperCase()}</kbd></button>`).join('')}</div>
<p class="line">${esc(s.line)}</p><input class="note" maxlength="1000" placeholder="note…" value=""></div></article>`).join('') + '<p class="empty" hidden>Nothing here.</p>';
  for (const c of grid.querySelectorAll('.card')) { const id = c.dataset.id, n = c.querySelector('.note'); n.value = S.picks[id]?.note || ''; paint(id);
    c.querySelector('.thumb').onclick = () => open(id);
    c.querySelectorAll('.decide button').forEach(b => b.onclick = () => decide(id, S.picks[id]?.status === b.dataset.d ? 'undecided' : b.dataset.d));
    n.oninput = () => setNote(id, n.value); n.onkeydown = e => { if (e.key === 'Enter' || e.key === 'Escape') n.blur(); }; }
  // thumbnails scale with the card: s = card width / the crop's width
  new ResizeObserver(() => { const t = grid.querySelector('.card:not([hidden]) .thumb'); if (t) grid.style.setProperty('--s', (t.clientWidth / CROP_W).toFixed(4)); }).observe(grid);

  // the controls
  $('rounds').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.round = +b.dataset.r; LS.set('round', S.round); marks(); filter(); };
  $('bgs').onclick = e => { const b = e.target.closest('button'); if (b) setBg(b.dataset.bg); };
  $('sizes').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.size = b.dataset.size; grid.dataset.size = S.size; LS.set('size', S.size); marks(); };
  marks(); filter();
  if (byId[Q.get('style')]) { S.round = roundOf(byId[Q.get('style')]); marks(); filter(); open(Q.get('style')); }
  addEventListener('keydown', onKey); addEventListener('resize', fitView);
  addEventListener('beforeunload', () => { if (dirty) navigator.sendBeacon?.('/api/stylelab', new Blob([JSON.stringify(doc())], { type: 'application/json' })); });
}

// ── filters
function marks() {
  document.querySelectorAll('#sizes button').forEach(x => x.classList.toggle('on', x.dataset.size === S.size));
  $('rounds').innerHTML = ROUNDS.map(r => `<button data-r="${r}" class="${S.round === r ? 'on' : ''}">Round ${r}<em>${STYLES.filter(s => roundOf(s) === r).length}</em></button>`).join('');
  const mine = STYLES.filter(s => roundOf(s) === S.round), n = f => mine.filter(s => f === 'all' ? status(s.id) !== 'kill' : status(s.id) === f).length;
  $('filters').innerHTML = FILTERS.map(f => `<button data-f="${f}" class="${S.filter === f ? 'on' : ''}">${f === 'all' ? 'all' : f}<em>${n(f)}</em></button>`).join('');
  $('filters').querySelectorAll('button').forEach(b => b.onclick = () => { S.filter = b.dataset.f; LS.set('filter', S.filter); marks(); filter(); });
}
const status = id => S.picks[id]?.status || 'undecided', count = f => STYLES.filter(s => status(s.id) === f).length;
const shows = id => roundOf(byId[id]) === S.round && (S.filter === 'all' ? status(id) !== 'kill' : status(id) === S.filter);
const tag = s => s.group === 'ref' ? '<em class="tag ref">today</em>' : s.group === 'lime' ? '<em class="tag lime">lime</em>' : s.group === 'mix' ? '<em class="tag mix">hybrid</em>' : '';
function filter() { let any = false; for (const c of $('grid').querySelectorAll('.card')) { const on = shows(c.dataset.id); c.hidden = !on; any ||= on; } $('grid').querySelector('.empty').hidden = any; }

// ── decisions
function paint(id) { const c = $('grid').querySelector(`.card[data-id="${id}"]`), st = status(id); if (!c) return;
  c.dataset.status = st; c.querySelector('.stamp').textContent = LABEL[st]; c.querySelectorAll('.decide button').forEach(b => b.classList.toggle('on', b.dataset.d === st)); }
function decide(id, st) {
  const p = S.picks[id] || (S.picks[id] = { status: 'undecided', note: '' }); p.status = st; p.at = new Date().toISOString();
  paint(id); marks(); if (V.id === id) paintView();
  if (!V.id) { const c = $('grid').querySelector(`.card[data-id="${id}"]`), had = document.activeElement === c; filter();   // (a card that just hid hands focus on)
    if (had && c.hidden) { const vis = [...$('grid').querySelectorAll('.card:not([hidden])')]; (vis.find(x => c.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) || vis.at(-1))?.focus(); } } save(); toast(`${LABEL[st] || 'undecided'} · ${byId[id].name}`);
}
function setNote(id, v) { const p = S.picks[id] || (S.picks[id] = { status: 'undecided', note: '' }); p.note = v.slice(0, 1000); p.at = new Date().toISOString();
  const n = $('grid').querySelector(`.card[data-id="${id}"] .note`); if (n && n.value !== p.note) n.value = p.note; if (V.id === id && $('vnote').value !== p.note) $('vnote').value = p.note; save(700); }

// ── save: picks.json (every style listed, so the file reads on its own) + the browser copy
let dirty = false, saveT = 0;
function doc() {
  const styles = {}; for (const s of STYLES) { const p = S.picks[s.id] || {}; styles[s.id] = { status: p.status || 'undecided', name: (roundOf(s) > 1 ? `R${roundOf(s)} · ` : '') + s.name }; if (p.note) styles[s.id].note = p.note; if (p.at) styles[s.id].at = p.at; }
  const per = r => { const L = STYLES.filter(s => roundOf(s) === r), c = f => L.filter(s => status(s.id) === f).length; return { styles: L.length, keep: c('keep'), maybe: c('maybe'), kill: c('kill'), undecided: c('undecided') }; };
  return { version: 1, about: 'AI City UI style lab picks (style/city/ui/stylelab/): keep / maybe / kill per style, with notes. Styles are in styles.css, listed in styles.js; names starting "R2 ·" are round 2.',
    updated: S.updated, counts: { styles: STYLES.length, keep: count('keep'), maybe: count('maybe'), kill: count('kill'), undecided: count('undecided'), ...Object.fromEntries(ROUNDS.map(r => ['round' + r, per(r)])) }, styles };
}
function save(wait = 250) { S.updated = new Date().toISOString(); LS.set('picks', doc()); dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, wait); setSave('saving…'); }
async function flush() {
  const body = JSON.stringify(doc()); LS.set('picks', JSON.parse(body));
  try { const r = await fetch('/api/stylelab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); dirty = false;
    setSave('saved · picks.json · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 'ok'); }
  catch (err) { setSave('✗ not saved to picks.json (' + String(err.message || err).slice(0, 40) + ') · kept in this browser', 'bad'); }
}
function setSave(t, cls = '') { const el = $('save'); el.textContent = t; el.className = 'save ' + cls; }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1300); }

// ── the full-size view (1280 x 720, scaled down only if the window is smaller)
const V = { id: null, list: [] };
function open(id) { V.list = STYLES.filter(s => shows(s.id) || s.id === id).map(s => s.id); V.id = id; $('view').hidden = false; document.body.style.overflow = 'hidden';
  $('vdecide').innerHTML = DECIDE.map(d => `<button data-d="${d}">${d === 'undecided' ? 'Undecided' : d[0].toUpperCase() + d.slice(1)}<kbd>${d === 'kill' ? 'X' : d[0].toUpperCase()}</kbd></button>`).join('');
  $('vdecide').onclick = e => { const b = e.target.closest('button'); if (b) decide(V.id, b.dataset.d); };
  $('vnote').oninput = e => setNote(V.id, e.target.value); $('vprev').onclick = () => step(-1); $('vnext').onclick = () => step(1); $('vclose').onclick = close;
  show(); fitView(); }
function show() { const s = byId[V.id]; $('vstage').innerHTML = mock(V.id); $('vname').textContent = s.name; $('vline').textContent = s.line;
  $('vtag').innerHTML = (roundOf(s) > 1 ? `<span class="tag">round ${roundOf(s)}</span> ` : '') + tag(s).replace(/<\/?em/g, m => m.replace('em', 'span'));
  $('vpos').textContent = `${V.list.indexOf(V.id) + 1} / ${V.list.length}`; $('vnote').value = S.picks[V.id]?.note || ''; paintView();
  const u = new URL(location.href); u.searchParams.set('style', V.id); history.replaceState(null, '', u); }
function paintView() { const st = status(V.id); $('vdecide').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.d === st)); }
function step(d) { const i = V.list.indexOf(V.id); V.id = V.list[(i + d + V.list.length) % V.list.length]; show(); }
function close() { const id = V.id; V.id = null; $('view').hidden = true; $('vstage').innerHTML = ''; document.body.style.overflow = ''; filter();
  const u = new URL(location.href); u.searchParams.delete('style'); history.replaceState(null, '', u);
  const c = $('grid').querySelector(`.card[data-id="${id}"]`); if (c && !c.hidden) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest' }); } }
function fitView() { if (!V.id) return; const s = Math.min(1, (innerWidth - 24) / 1280, (innerHeight - 110) / 720); $('view').style.setProperty('--vs', s.toFixed(4)); }

// ── keys: ← → in the view, K / M / X / U on the open style or the focused card, Enter opens, Esc closes
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (V.id) { if (k === 'arrowleft') step(-1); else if (k === 'arrowright') step(1); else if (k === 'escape') close(); else if (KEY[k]) decide(V.id, KEY[k]); else return; e.preventDefault(); return; }
  const c = document.activeElement?.closest?.('.card'); if (!c) return;
  if (KEY[k]) { decide(c.dataset.id, KEY[k]); e.preventDefault(); }
  else if (k === 'enter' || k === ' ') { open(c.dataset.id); e.preventDefault(); }
  else if (k === 'arrowright' || k === 'arrowleft') { const vis = [...$('grid').querySelectorAll('.card:not([hidden])')], i = vis.indexOf(c); vis[i + (k === 'arrowright' ? 1 : -1)]?.focus(); e.preventDefault(); }
}
