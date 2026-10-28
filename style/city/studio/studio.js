// TRAIT STUDIO (2026-09-29) · slime's curation tool for AI City's characters: every trait ever made (catalogue), on the city's own
// walker (stage.js: walk v2, idles, grips, pendant swing), stacked slot by slot into fits, and kept or killed. Decisions save to
// world/traits-curation.json (POST /api/curation, style/serve.mjs); world/curation.js turns them into a roll filter (not on yet).
// URL (for shots and links): ?mode=idle|tread|circle &idle=<0-8|cycle> &v=<m/s> &slot= &origin=a,b &tier=a,b &status= &q= &cwx=1
//   &fit=<preset handle> &fitB=<preset handle> &compare=1 &pfp=1 &focus=<slot/id> &t=<s> (simulate, then hold) &demo=1 (sample
//   decisions, never saved) &shot=1 (timers instead of rAF; title 'ready' when drawn) &sweep=1 (the headless gate, window.__sweep)
import * as CH from '../../../world/chars.js';
import { JEWEL_LOOKS } from '../../../world/jewelry2.js';
import { FITS } from '../traits/fits.js';
import { buildCatalog, SLOTS, SLOT_LABEL, ORIGINS, TIERS, OPTIONAL, paletteOf, hexCss } from './catalog.js';
import { createStage, IDLE_NAMES, MODES } from './stage.js';
import { thumb, cancelThumb, renderThumbs, initCache, pfp, pending, thumbStats, wearOne, BASE, snap } from './photo.js';

const Q = new URLSearchParams(location.search), SHOT = Q.has('shot'), DEMO = Q.has('demo'), SWEEP = Q.has('sweep');
const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LS = { get(k, d) { try { const v = localStorage.getItem('trait-studio.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('trait-studio.' + k, JSON.stringify(v)); } catch {} } };
const toastEl = $('toast'); let toastT = 0; const toast = m => { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1800); };
const tierCls = t => t === '1 of 1' ? 'oneof' : t;
const STRING_SLOTS = new Set(['skin', 'eyes', 'mouth', 'mark']);

// ── data
const [proposal, simTiers, disk] = await Promise.all([fetch('../../../world/traits-proposal.json').then(r => r.json()),
  fetch('./sim-tiers.json').then(r => r.json()).catch(() => ({ TRAITS: {} })), fetch('../../../world/traits-curation.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)]);
const CAT = buildCatalog(proposal, simTiers), BY = new Map(CAT.map(e => [e.key, e]));
await initCache(['../../../world/chars.js', '../../../world/shoes2.js', '../../../world/jewelry2.js', '../../../world/held2.js', './photo.js'], { idb: !SHOT });   // (the thumbnail cache's version: a hash of the trait sources)
let cur = disk && disk.version === 1 && disk.traits ? disk : { version: 1, traits: {} };
if (DEMO) cur = demoCuration();
const statusOf = (key, cw = null) => { const e = cur.traits[key]; if (!e) return 'undecided'; if (cw !== null && e.cw && e.cw[cw]) return e.cw[cw].status; return e.status; };
const ownStatus = (key, cw = null) => { const e = cur.traits[key]; if (!e) return null; return cw === null ? (e.status !== 'undecided' ? e.status : null) : (e.cw && e.cw[cw] && e.cw[cw].status !== 'undecided' ? e.cw[cw].status : null); };
const noteOf = (key, cw = null) => { const e = cur.traits[key]; if (!e) return ''; return (cw === null ? e.note : e.cw && e.cw[cw] && e.cw[cw].note) || ''; };
function demoCuration() { const t = {}; CAT.forEach((e, i) => { const h = (i * 2654435761) >>> 0; if (h % 5 < 2) t[e.key] = { status: h % 7 < 5 ? 'keep' : 'kill', note: h % 11 === 0 ? 'demo note: reads well at 10 m' : undefined }; });
  return { version: 1, traits: t }; }

// ── state (fits, locks, filters, UI) — per-viewer conveniences in localStorage, overridable by the URL
const PRESETS = [...CH.LOOKS.map(L => ['approved', L]), ...FITS.map(f => ['drop 02 · ' + f.tier, f.L]), ...JEWEL_LOOKS.map(L => ['jewellery', CH.look(structuredClone(L))])];
const presetByHandle = h => { const p = PRESETS.find(([, L]) => L.handle === h); return p ? structuredClone(p[1]) : null; };
const saved = LS.get('state', {});
const F = { fits: [Q.has('fit') && presetByHandle(Q.get('fit')) || saved.fits?.[0] || structuredClone(CH.LOOKS[0]), Q.has('fitB') && presetByHandle(Q.get('fitB')) || saved.fits?.[1] || structuredClone(CH.LOOKS[12])],
  active: 0, compare: Q.has('compare') ? Q.get('compare') !== '0' : !!saved.compare, locks: new Set(saved.locks || []), keepOnly: !!saved.keepOnly };
const csv = k => Q.has(k) ? new Set(Q.get(k).split(',').filter(Boolean)) : null;
const FL = { slot: Q.get('slot') ?? saved.slot ?? null, origins: csv('origin') ?? new Set(saved.origins || []), tiers: csv('tier') ?? new Set(saved.tiers || []), status: Q.get('status') ?? saved.status ?? 'all',
  q: Q.get('q') ?? '', cwx: Q.has('cwx') ? Q.get('cwx') !== '0' : !!saved.cwx };
const UI = { pfp: Q.has('pfp') || !!saved.pfp, pfpBg: saved.pfpBg || null };
const persistState = () => LS.set('state', { fits: F.fits, compare: F.compare, locks: [...F.locks], keepOnly: F.keepOnly, slot: FL.slot, origins: [...FL.origins], tiers: [...FL.tiers], status: FL.status, cwx: FL.cwx,
  pfp: UI.pfp, pfpBg: UI.pfpBg, mode: stage.S.mode, idle: stage.S.cycle ? 'cycle' : stage.S.idle, v: stage.S.v });
const fit = () => F.fits[F.active];
// a saved fit may name a trait that has since been killed and deleted from chars.js: that slot falls back to a plain default
const DEF = CH.look({ skin: 'pale', top: { id: 'tee' }, bottom: { id: 'baggy' }, shoes: { id: 'dad' } });
function sanitize(L) { for (const s of SLOTS) { const v = L[s], id = STRING_SLOTS.has(s) ? v : v && v.id; if (!id || !Object.hasOwn(CH.NAMES[s], id)) L[s] = structuredClone(DEF[s]); } return L; }
F.fits.forEach(sanitize);

// ── stage
const stage = createStage($('stage'), { preserve: SHOT || SWEEP });
stage.S.mode = MODES.includes(Q.get('mode')) ? Q.get('mode') : MODES.includes(saved.mode) ? saved.mode : 'tread';
{ const iv = Q.get('idle') ?? saved.idle ?? 0; stage.S.v = +(Q.get('v') ?? saved.v ?? 1.2); stage.setIdle(iv === 'cycle' ? 'cycle' : +iv); }
let lastSwitchMs = 0;
function applyFits(o = {}) { const t0 = performance.now();
  stage.setLooks(F.compare ? F.fits : [fit()]); if (o.mode) stage.setMode(stage.S.mode); stage.draw(); if (o.finish) stage.finish();
  lastSwitchMs = performance.now() - t0; renderSlots(); markWorn(); queuePfp(); persistState(); return lastSwitchMs; }

// ── the fit panel
function slotEntry(L, s) { const id = STRING_SLOTS.has(s) ? L[s] : L[s] && L[s].id; return id && id !== 'none' ? BY.get(s + '/' + id) : null; }
function renderSlots() {
  const L = fit(), el = $('slots'); el.innerHTML = '';
  for (const s of SLOTS) { const e = slotEntry(L, s), locked = F.locks.has(s), row = document.createElement('div'); row.className = 'slot' + (locked ? ' locked' : '');
    const st = e ? statusOf(e.key) : '';
    row.innerHTML = `<button class="lock${locked ? ' on' : ''}" title="${locked ? 'Unlock' : 'Lock'} ${SLOT_LABEL[s]} (randomise leaves it)" aria-pressed="${locked}">${locked ? '🔒' : '🔓'}</button>
      <span class="sl">${SLOT_LABEL[s]}</span><button class="nm${e ? '' : ' none'}" title="Show ${SLOT_LABEL[s]} in the catalogue">${e ? `<i class="st ${st}"></i>${esc(e.name)}` : 'none'}</button>
      ${OPTIONAL.has(s) && e ? '<button class="clr" title="Take it off">×</button>' : '<span></span>'}`;
    row.querySelector('.lock').onclick = () => { locked ? F.locks.delete(s) : F.locks.add(s); renderSlots(); persistState(); };
    row.querySelector('.nm').onclick = () => { setFilter('slot', FL.slot === s ? null : s); if (e) focusKey(e.key); };
    const clr = row.querySelector('.clr'); if (clr) clr.onclick = () => { L[s] = s === 'mark' ? 'none' : { id: 'none' }; applyFits(); };
    // colourways: a new trait's named colourways, or an original's free colour (the roller's palette; ∅ = the drawing's default)
    const cws = document.createElement('div'); cws.className = 'cws';
    if (e && e.cws) e.cws.forEach((c, i) => { const b = document.createElement('button'); b.className = 'sw' + ((L[s].cw | 0) === i ? ' on' : '') + (statusOf(e.key, i) === 'kill' ? ' kill' : ''); b.title = c.name;
      b.innerHTML = c.sw.map(x => `<i style="background:${x}"></i>`).join(''); b.onclick = () => { L[s] = { ...L[s], cw: i }; applyFits(); syncDec(); }; cws.appendChild(b); });
    else if (e) { const pal = paletteOf(s, e.id); if (pal) { const [p, list] = pal, d = document.createElement('button'); d.className = 'sw def' + (L[s][p] === undefined ? ' on' : ''); d.textContent = '∅'; d.title = 'the drawing\'s own colour';
      d.onclick = () => { const n = { ...L[s] }; delete n[p]; L[s] = n; applyFits(); }; cws.appendChild(d);
      for (const c of list) { const b = document.createElement('button'); b.className = 'sw' + (L[s][p] === c ? ' on' : ''); b.title = hexCss(c) + ' (' + p + ')'; b.innerHTML = `<i style="background:${hexCss(c)}"></i>`;
        b.onclick = () => { L[s] = { ...L[s], [p]: c }; applyFits(); }; cws.appendChild(b); } } }
    if (cws.children.length) { row.append(document.createElement('span'), document.createElement('span'), cws); }
    el.appendChild(row); }
  $('ab').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.s === F.active); });
  $('cmpBtn').classList.toggle('on', F.compare);
}
$('ab').onclick = e => { const b = e.target.closest('button'); if (!b) return; F.active = +b.dataset.s; if (F.active === 1 && !F.compare) { F.compare = true; } applyFits(); toast(`editing fit ${'AB'[F.active]}`); };
// randomise: each unlocked slot from its non-killed traits (only keeps, if asked); colourways skip killed ones
function randomise() { const L = fit(), r = Math.random, skipped = [];
  const pNone = { hair: .1, hat: .55, eyewear: .6, mark: .55, ears: .65, neck: .5, held: .65, acc: .7 };
  for (const s of SLOTS) { if (F.locks.has(s)) continue;
    let pool = CAT.filter(e => e.slot === s && statusOf(e.key) !== 'kill');
    if (F.keepOnly) { const k = pool.filter(e => statusOf(e.key) === 'keep'); if (!k.length && !OPTIONAL.has(s)) skipped.push(SLOT_LABEL[s]); pool = k.length || !OPTIONAL.has(s) ? (k.length ? k : pool) : []; }
    if (OPTIONAL.has(s) && (!pool.length || r() < pNone[s])) { L[s] = s === 'mark' ? 'none' : { id: 'none' }; continue; }
    if (!pool.length) continue; const e = pool[(r() * pool.length) | 0];
    if (STRING_SLOTS.has(s)) { L[s] = e.id; continue; }
    if (e.cws) { const ok = e.cws.map((_, i) => i).filter(i => statusOf(e.key, i) !== 'kill'); L[s] = { id: e.id, cw: ok.length ? ok[(r() * ok.length) | 0] : 0 }; }
    else { const pal = paletteOf(s, e.id); L[s] = { id: e.id }; if (pal && r() < .75) L[s][pal[0]] = pal[1][(r() * pal[1].length) | 0]; } }
  L.handle = 'random.' + Math.floor(r() * 1e4).toString().padStart(4, '0');
  applyFits(); toast(skipped.length ? `no keeps yet in ${skipped.join(', ')}: rolled from the undecided` : F.keepOnly ? 'rolled from your keeps' : 'rolled every unlocked slot'); }
$('rand').onclick = randomise;
$('keepOnly').checked = F.keepOnly; $('keepOnly').onchange = e => { F.keepOnly = e.target.checked; persistState(); };
// saved fits (localStorage) and presets
const fitList = () => LS.get('fits', []);
function renderFitList() { const el = $('fitlist'), list = fitList(); el.innerHTML = list.length ? '' : '<span class="empty">No saved fits yet.</span>';
  list.forEach((f, i) => { const d = document.createElement('div'); d.innerHTML = `<button class="ld" title="Load into fit ${'AB'[F.active]}">${esc(f.name)}</button><button class="rm" title="Delete">×</button>`;
    d.querySelector('.ld').onclick = () => { F.fits[F.active] = sanitize(structuredClone(f.L)); applyFits(); toast(`loaded “${f.name}” into ${'AB'[F.active]}`); };
    d.querySelector('.rm').onclick = () => { const l = fitList(); l.splice(i, 1); LS.set('fits', l); renderFitList(); }; el.appendChild(d); }); }
$('saveFit').onclick = () => { const name = $('fitName').value.trim() || fit().handle || 'fit ' + (fitList().length + 1); const l = fitList().filter(f => f.name !== name);
  l.unshift({ name, L: structuredClone(fit()), at: new Date().toISOString() }); LS.set('fits', l); fit().handle = name; $('fitName').value = ''; renderFitList(); toast(`saved “${name}”`); };
$('fitName').onkeydown = e => { if (e.key === 'Enter') $('saveFit').click(); };
{ const sel = $('presets'); let grp = null, og = null; PRESETS.forEach(([g, L]) => { if (g !== grp) { og = document.createElement('optgroup'); og.label = grp = g; sel.appendChild(og); } const o = document.createElement('option'); o.value = L.handle; o.textContent = L.handle; og.appendChild(o); });
  sel.onchange = () => { const L = presetByHandle(sel.value); if (L) { F.fits[F.active] = L; applyFits(); toast(`loaded ${L.handle} into ${'AB'[F.active]}`); } sel.value = ''; }; }

// ── stage controls
const MODE_LAB = { idle: 'Idle', tread: 'Walk in place', circle: 'Circle' };
function renderModes() { const seg = $('modeSeg'); seg.innerHTML = ''; MODES.forEach((m, i) => { const b = document.createElement('button'); b.innerHTML = `${MODE_LAB[m]}<kbd>${i + 1}</kbd>`; b.className = stage.S.mode === m ? 'on' : ''; b.onclick = () => setMode(m); seg.appendChild(b); });
  const id = $('idles'); id.innerHTML = ''; id.style.display = stage.S.mode === 'idle' ? '' : 'none';
  if (stage.S.mode === 'idle') { IDLE_NAMES.forEach((n, i) => { const b = document.createElement('button'); b.className = 'ichip' + (!stage.S.cycle && stage.S.idle === i ? ' on' : ''); b.innerHTML = `<b>${i + 1}</b>${esc(n)}`; b.onclick = () => setIdle(i); id.appendChild(b); });
    const c = document.createElement('button'); c.className = 'ichip' + (stage.S.cycle ? ' on' : ''); c.innerHTML = `<b>∞</b>cycle all${stage.S.cycle ? ' · ' + esc(IDLE_NAMES[stage.S.idle]) : ''}`; c.onclick = () => setIdle('cycle'); id.appendChild(c); } }
function setMode(m) { stage.setMode(m); renderModes(); persistState(); }
function setIdle(i) { stage.setIdle(i); renderModes(); persistState(); }
$('speed').value = stage.S.v; const speedOut = () => { $('speedOut').textContent = stage.S.v.toFixed(2) + ' m/s'; }; speedOut();
$('speed').oninput = e => { stage.S.v = +e.target.value; speedOut(); persistState(); };
const setPause = p => { stage.S.paused = p; $('pause').textContent = p ? '▶ Play' : '❚❚ Pause'; $('pause').classList.toggle('on', p); };
$('pause').onclick = () => setPause(!stage.S.paused);
$('turn').onclick = () => { stage.S.turntable = !stage.S.turntable; $('turn').classList.toggle('on', stage.S.turntable); };
$('resetV').onclick = () => { stage.S.turntable = false; $('turn').classList.remove('on'); stage.resetView(); };
$('cmpBtn').onclick = () => toggleCompare();
function toggleCompare() { F.compare = !F.compare; if (!F.compare) F.active = 0; applyFits({ mode: true }); toast(F.compare ? 'comparing A | B · the fit panel edits the highlighted one' : 'compare off'); }
// PFP: the fit check's avatar framing, redrawn when the fit changes
const pfpCv = document.querySelector('#pfpCard .c192'), pfpSq = document.querySelector('#pfpCard .sq'), pfp48 = document.querySelector('#pfpCard .c48'); let pfpDirty = true;
const PFP_BGS = ['#ff4fa3', '#2f5bff', '#ff7a1a', '#6cff4a', '#ffe23a', '#7cc3ff', '#161616', '#c89bf5', '#ededed', '#ff3b30', '#008080'];
function queuePfp() { pfpDirty = true; }
function drawPfp() { if (!UI.pfp || !pfpDirty) return; pfpDirty = false; const L = fit(); pfp(L, pfpCv.getContext('2d'), UI.pfpBg || L.bg);
  for (const c of [pfpSq, pfp48]) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(pfpCv, 0, 0, c.width, c.height); } }
function setPfp(on) { UI.pfp = on; $('pfpCard').classList.toggle('on', on); $('pfpBtn').classList.toggle('on', on); pfpDirty = true; persistState(); }
$('pfpBtn').onclick = () => setPfp(!UI.pfp);
{ const el = $('pfpBgs'); for (const c of [null, ...PFP_BGS]) { const b = document.createElement('button'); b.style.background = c || 'linear-gradient(135deg,#fff 45%,#d00 47%,#d00 53%,#fff 55%)'; b.title = c ? c : "the fit's own background";
  b.onclick = () => { UI.pfpBg = c; pfpDirty = true; persistState(); }; el.appendChild(b); } }
$('pfpSave').onclick = () => { const a = document.createElement('a'); a.href = pfpCv.toDataURL('image/png'); a.download = (fit().handle || 'fit') + '-pfp.png'; a.click(); };

// ── the catalogue: filters, grid, focus
const SLOT_ORDER = new Map(SLOTS.map((s, i) => [s, i])), ORIGIN_ORDER = new Map(ORIGINS.map((s, i) => [s, i])), TIER_ORDER = new Map(TIERS.map((s, i) => [s, i]));
const SORTED = [...CAT].sort((a, b) => SLOT_ORDER.get(a.slot) - SLOT_ORDER.get(b.slot) || ORIGIN_ORDER.get(a.origin) - ORIGIN_ORDER.get(b.origin) || TIER_ORDER.get(a.tier) - TIER_ORDER.get(b.tier) || a.name.localeCompare(b.name));
let items = [], cards = [], focus = -1;
const itemStatus = it => statusOf(it.e.key, it.cw);
function matches(e, ignore) { const q = FL.q.trim().toLowerCase();
  return (ignore === 'slot' || !FL.slot || e.slot === FL.slot) && (ignore === 'origin' || !FL.origins.size || FL.origins.has(e.origin)) && (ignore === 'tier' || !FL.tiers.size || FL.tiers.has(e.tier))
    && (!q || (e.name + ' ' + e.id + ' ' + e.origin + ' ' + e.slot + ' ' + (e.cws ? e.cws.map(c => c.name).join(' ') : '') + ' ' + noteOf(e.key)).toLowerCase().includes(q)); }
const stMatch = st => FL.status === 'all' || st === FL.status;
function setFilter(k, v) { FL[k] = v; renderFilters(); renderGrid(); persistState(); }
function chipRow(el, list, isOn, count, click, label = x => x) { el.querySelectorAll('.fc').forEach(n => n.remove());
  for (const v of list) { const b = document.createElement('button'); b.className = 'fc' + (isOn(v) ? ' on' : ''); b.innerHTML = `${esc(label(v))}<em>${count(v)}</em>`; b.onclick = ev => click(v, ev); el.appendChild(b); } }
function renderFilters() {
  const toggle = (set, v, ev) => { if (ev.shiftKey || ev.metaKey) { set.has(v) ? set.delete(v) : set.add(v); } else { const only = set.size === 1 && set.has(v); set.clear(); if (!only) set.add(v); } renderFilters(); renderGrid(); persistState(); };
  chipRow($('fSlot'), ['all', ...SLOTS], v => v === 'all' ? !FL.slot : FL.slot === v, v => CAT.filter(e => (v === 'all' || e.slot === v) && matches(e, 'slot')).length, v => setFilter('slot', v === 'all' || FL.slot === v ? null : v), v => v === 'all' ? 'all' : SLOT_LABEL[v]);
  chipRow($('fOrigin'), ORIGINS, v => FL.origins.has(v), v => CAT.filter(e => e.origin === v && matches(e, 'origin')).length, (v, ev) => toggle(FL.origins, v, ev));
  chipRow($('fTier'), TIERS.filter(t => CAT.some(e => e.tier === t)), v => FL.tiers.has(v), v => CAT.filter(e => e.tier === v && matches(e, 'tier')).length, (v, ev) => toggle(FL.tiers, v, ev));
  const inView = CAT.filter(e => matches(e));
  chipRow($('fStatus'), ['all', 'undecided', 'keep', 'kill'], v => FL.status === v, v => v === 'all' ? inView.length : inView.filter(e => statusOf(e.key) === v).length, v => setFilter('status', v));
  $('cwx').classList.toggle('on', FL.cwx); $('q').value = FL.q; }
$('q').oninput = e => { FL.q = e.target.value; renderFilters(); renderGrid(); };
$('cwx').onclick = () => { FL.cwx = !FL.cwx; renderFilters(); renderGrid(); persistState(); };
const io = new IntersectionObserver(ents => { for (const en of ents) { const c = en.target, it = items[+c.dataset.i]; if (!it) continue;
  if (en.isIntersecting) { if (!c._req) { c._req = true; thumb(it.e, it.cw ?? wornCw(it.e) ?? 0, url => { const img = c.querySelector('img'); img.onload = () => img.classList.add('ok'); img.src = url; }); } }
  else if (c._req && !c.querySelector('img').src) { cancelThumb(it.e, it.cw ?? 0); c._req = false; } } }, { root: $('grid'), rootMargin: '300px 0px' });
const wornCw = e => { const L = fit(); return !STRING_SLOTS.has(e.slot) && L[e.slot] && L[e.slot].id === e.id && e.cws ? L[e.slot].cw | 0 : null; };
function renderGrid(keepFocusKey) {
  const g = $('grid'), prevKey = keepFocusKey ?? (items[focus] ? itemKey(items[focus]) : null); io.disconnect(); g.innerHTML = ''; items = []; cards = [];
  for (const e of SORTED) { if (!matches(e)) continue; if (FL.cwx && e.cws) e.cws.forEach((_, i) => { if (stMatch(statusOf(e.key, i))) items.push({ e, cw: i }); }); else if (stMatch(statusOf(e.key))) items.push({ e, cw: null }); }
  let lastSlot = null; const frag = document.createDocumentFragment();
  items.forEach((it, i) => { const e = it.e;
    if (e.slot !== lastSlot) { lastSlot = e.slot; const n = items.filter(x => x.e.slot === e.slot).length, h = document.createElement('div'); h.className = 'gh'; h.innerHTML = `<h3>${esc(SLOT_LABEL[e.slot])}</h3><span>${n} ${FL.cwx ? 'cards' : 'traits'}</span>`; frag.appendChild(h); }
    const c = document.createElement('div'); c.className = 'card'; c.dataset.i = i; c.setAttribute('role', 'button');
    const cwName = it.cw !== null ? e.cws[it.cw].name : null, dots = e.cws && it.cw === null ? `<span class="dots">${e.cws.slice(0, 5).map(x => `<i style="background:${x.sw[0]}"></i>`).join('')}</span>` : '';
    c.innerHTML = `<div class="th"><img alt=""><span class="stamp"></span><span class="noted">note</span><span class="on">ON</span></div><div class="nm" title="${esc(e.name)} · ${esc(e.id)}">${esc(e.name)}</div>
      ${cwName ? `<div class="cwn">${esc(cwName)}</div>` : ''}<div class="mt"><span class="tier ${tierCls(e.tier)}" title="tier from ${esc(e.tierSrc)}">${esc(e.tier)}</span><span class="org ${e.origin}">${e.origin}</span>${dots}</div>`;
    c.onclick = () => setFocus(i, true); cards.push(c); frag.appendChild(c); decorate(i); });
  if (!items.length) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'Nothing matches these filters.'; frag.appendChild(d); }
  g.appendChild(frag); cards.forEach(c => io.observe(c)); markWorn();
  const j = prevKey ? items.findIndex(it => itemKey(it) === prevKey) : -1; focus = -1; if (j >= 0) setFocus(j, false, true); else if (items.length) setFocus(Math.min(Math.max(0, focus), items.length - 1), false, true); else syncDec();
  updateProgress(); }
const itemKey = it => it.e.key + (it.cw !== null ? '#' + it.cw : '');
function decorate(i) { const c = cards[i], it = items[i]; if (!c) return; const own = ownStatus(it.e.key, it.cw), st = itemStatus(it);
  c.classList.toggle('keep', st === 'keep'); c.classList.toggle('kill', st === 'kill'); c.classList.toggle('inh', it.cw !== null && !own && st !== 'undecided');
  c.querySelector('.stamp').textContent = st === 'keep' ? 'KEEP' : st === 'kill' ? 'KILL' : ''; c.classList.toggle('hasnote', !!noteOf(it.e.key, it.cw)); }
function markWorn() { const on = new Set(); for (const L of F.compare ? F.fits : [fit()]) for (const s of SLOTS) { const e = slotEntry(L, s); if (e) on.add(e.key + (FL.cwx && e.cws ? '#' + (L[s].cw | 0) : '')); }
  items.forEach((it, i) => cards[i].classList.toggle('worn', on.has(itemKey(it)))); }
function setFocus(i, wear = true, quiet = false) { if (i < 0 || i >= items.length) return; if (cards[focus]) cards[focus].classList.remove('focus'); focus = i; const c = cards[i]; c.classList.add('focus');
  if (!quiet || SHOT) c.scrollIntoView({ block: 'nearest' }); if (wear) wearItem(items[i]); syncDec(); }
function focusKey(key) { const i = items.findIndex(it => it.e.key === key); if (i >= 0) setFocus(i, false); }
function wearItem(it, cwOverride) { const e = it.e, L = fit(), s = e.slot;
  if (STRING_SLOTS.has(s)) L[s] = e.id;
  else if (e.cws) { const keep = L[s] && L[s].id === e.id ? L[s].cw | 0 : 0; L[s] = { id: e.id, cw: cwOverride ?? it.cw ?? keep }; }
  else if (!(L[s] && L[s].id === e.id)) L[s] = { id: e.id };
  return applyFits(); }
function moveFocus(d) { if (!items.length) return; if (focus < 0) return setFocus(0); if (d === -1 || d === 1) return setFocus(Math.max(0, Math.min(items.length - 1, focus + d)));
  const c0 = cards[focus], y = c0.offsetTop, x = c0.offsetLeft, dir = Math.sign(d); let best = -1, rowY = null, bd = 1e9;
  for (let i = focus + dir; i >= 0 && i < cards.length; i += dir) { const c = cards[i]; if (c.offsetTop === y) continue; if (rowY === null) rowY = c.offsetTop; if (c.offsetTop !== rowY) break; const dd = Math.abs(c.offsetLeft - x); if (dd < bd) { bd = dd; best = i; } }
  if (best >= 0) setFocus(best); }
// the decision bar: the focused trait, its colourways, keep / kill / undecided, a note
function syncDec() { const el = $('dec'), it = items[focus]; if (!it) { el.innerHTML = '<div class="scope">Pick a trait.</div>'; return; }
  const e = it.e, wc = wornCw(e), cwShown = it.cw ?? wc, st = statusOf(e.key, it.cw), scope = it.cw !== null ? `colourway “${e.cws[it.cw].name}”` : 'the whole trait';
  el.innerHTML = `<div class="big"><img alt=""></div>
    <div class="t1"><b title="${esc(e.name)}">${esc(e.name)}</b><span>${esc(e.slot)}/${esc(e.id)}</span></div>
    <div class="t2"><span class="tier ${tierCls(e.tier)}">${esc(e.tier)}</span><span>tier: ${esc(e.tierSrc)}</span><span class="org ${e.origin}">${e.origin}</span>${e.pass ? `<span>redrawn in the ${e.pass} pass</span>` : ''}${e.v2of ? `<span>v2 of ${esc(e.v2of)}</span>` : ''}</div>
    ${e.why ? `<div class="why">${esc(e.why)}</div>` : '<div></div>'}
    <div class="cwrow">${e.cws ? e.cws.map((c, i) => { const s = ownStatus(e.key, i); return `<button class="cwc${cwShown === i ? ' on' : ''}${s ? ' ' + s : ''}" data-cw="${i}" title="wear ${esc(c.name)}"><span class="sw">${c.sw.map(x => `<i style="background:${x}"></i>`).join('')}</span>${esc(c.name)}</button>`; }).join('') : '<span style="color:#6b6b66;font-size:12px">one colourway' + (paletteOf(e.slot, e.id) ? ' · free colour: pick it in the fit panel' : '') + '</span>'}</div>
    <div class="decide"><button class="k${st === 'keep' ? ' on' : ''}" data-d="keep">Keep<kbd>K</kbd></button><button class="x${st === 'kill' ? ' on' : ''}" data-d="kill">Kill<kbd>X</kbd></button><button class="u${st === 'undecided' ? ' on' : ''}" data-d="undecided">Undecided<kbd>U</kbd></button>
      <input id="note" type="text" maxlength="200" placeholder="one-line note  ( N )" value="${esc(noteOf(e.key, it.cw))}"></div>
    <div class="scope">Deciding ${scope}${it.cw === null && e.cws ? ' · ⇧K / ⇧X decide just the colourway on the character' : ''}</div>`;
  thumb(e, cwShown ?? 0, url => { const img = el.querySelector('.big img'); if (img && items[focus] === it) img.src = url; });
  el.querySelectorAll('.cwc').forEach(b => b.onclick = () => { const i = +b.dataset.cw; if (it.cw !== null) { const j = items.findIndex(x => x.e === e && x.cw === i); if (j >= 0) return setFocus(j); } wearItem(it, i); syncDec(); });
  el.querySelectorAll('.decide button').forEach(b => b.onclick = () => decide(b.dataset.d, false, false));
  const note = $('note'); let nt = 0; note.oninput = () => { clearTimeout(nt); nt = setTimeout(() => setNote(it, note.value), 350); };
  note.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { clearTimeout(nt); setNote(it, note.value); note.blur(); $('grid').focus(); } ev.stopPropagation(); }; }
function entryFor(key) { return cur.traits[key] || (cur.traits[key] = { status: 'undecided' }); }
function prune(key) { const t = cur.traits[key]; if (!t) return; if (t.cw) { for (const [i, c] of Object.entries(t.cw)) if (c.status === 'undecided' && !c.note) delete t.cw[i]; if (!Object.keys(t.cw).length) delete t.cw; }
  if (t.note === '') delete t.note; if (t.status === 'undecided' && !t.note && !t.cw) delete cur.traits[key]; }
function decide(d, cwOnly, advance = true) { const it = items[focus]; if (!it) return; const e = it.e; let cw = it.cw, label;
  if (cwOnly && cw === null) { if (!e.cws) return toast('one colourway: decide the trait'); cw = wornCw(e) ?? 0; }
  const t = entryFor(e.key), at = new Date().toISOString();
  if (cw === null) { t.status = d; t.at = at; label = e.name; } else { t.cw ||= {}; t.cw[cw] = { ...(t.cw[cw] || {}), status: d, at }; label = e.name + ' · ' + e.cws[cw].name; }
  prune(e.key); save(); toast(`${d === 'keep' ? 'KEEP' : d === 'kill' ? 'KILL' : 'undecided'} · ${label}`);
  const key = itemKey(it), still = stMatch(itemStatus(it));
  if (!still) { const i = focus; renderGrid('__none__'); if (items.length) setFocus(Math.min(i, items.length - 1), advance); }
  else { decorate(focus); renderFilters(); updateProgress(); renderSlots(); if (advance && focus < items.length - 1) setFocus(focus + 1); else syncDec(); }
  void key; }
function setNote(it, v) { const t = entryFor(it.e.key); v = v.trim().slice(0, 200); if (it.cw === null) t.note = v; else { t.cw ||= {}; t.cw[it.cw] = { status: 'undecided', ...(t.cw[it.cw] || {}), note: v }; }
  prune(it.e.key); save(); const i = items.indexOf(it); if (i >= 0) decorate(i); }
function updateProgress() { const n = CAT.length, k = CAT.filter(e => statusOf(e.key) === 'keep').length, x = CAT.filter(e => statusOf(e.key) === 'kill').length;
  let cwd = 0, cwn = 0; for (const e of CAT) if (e.cws) { cwn += e.cws.length; const t = cur.traits[e.key]; if (t && t.cw) cwd += Object.values(t.cw).filter(c => c.status !== 'undecided').length; }
  $('progN').textContent = `${k + x} of ${n} decided`; $('barK').style.width = (k / n * 100) + '%'; $('barX').style.width = (x / n * 100) + '%';
  $('progSub').textContent = `${k} keep · ${x} kill · ${n - k - x} undecided · colourways ${cwd} of ${cwn}`; }
// save: debounced POST of the whole file (it's small); a failure keeps the decisions in this tab and retries on the next one
let saveT = 0, saving = false, again = false, dirty = false;
function save() { cur.updated = new Date().toISOString(); const k = CAT.filter(e => statusOf(e.key) === 'keep').length, x = CAT.filter(e => statusOf(e.key) === 'kill').length; cur.counts = { traits: CAT.length, keep: k, kill: x, undecided: CAT.length - k - x };
  if (DEMO) { setSave('demo decisions · not saved', 'demo'); return; } LS.set('curation-backup', cur); dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, 300); setSave('saving…'); }
async function flush() { if (saving) { again = true; return; } saving = true;
  try { const r = await fetch('/api/curation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cur) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.status); if (!again) dirty = false; setSave('saved · world/traits-curation.json · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 'ok'); }
  catch (err) { setSave('✗ not saved (' + String(err.message || err).slice(0, 40) + ') · kept in this tab', 'bad'); }
  finally { saving = false; if (again) { again = false; flush(); } } }
function setSave(t, cls = '') { const el = $('save'); el.textContent = t; el.className = 'px ' + cls; }
setSave(DEMO ? 'demo decisions · not saved' : disk ? `loaded · ${Object.keys(cur.traits).length} decided in world/traits-curation.json` : '✗ could not read world/traits-curation.json', DEMO ? 'demo' : disk ? 'ok' : 'bad');
addEventListener('beforeunload', () => { if (dirty && !DEMO) { clearTimeout(saveT); fetch('/api/curation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cur), keepalive: true }); } });

// ── keyboard
addEventListener('keydown', ev => {
  const tag = (ev.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') { if (ev.key === 'Escape') { ev.target.blur(); $('grid').focus(); } return; }
  if (tag === 'button' && (ev.key === 'Enter' || ev.key === ' ')) return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return; const k = ev.key, K = k.toLowerCase(); let hit = true;
  if ($('help').classList.contains('on')) { if (k === 'Escape' || k === '?') $('help').classList.remove('on'); return; }
  if (k === 'ArrowRight') moveFocus(1); else if (k === 'ArrowLeft') moveFocus(-1); else if (k === 'ArrowDown') moveFocus(2); else if (k === 'ArrowUp') moveFocus(-2);
  else if (K === 'k') decide('keep', ev.shiftKey); else if (K === 'x') decide('kill', ev.shiftKey); else if (K === 'u') decide('undecided', ev.shiftKey);
  else if (K === 'n') { const n = $('note'); if (n) { n.focus(); n.select(); } } else if (k === '/') $('q').focus();
  else if (k === 'Enter') { if (items[focus]) wearItem(items[focus]); }
  else if (K === 'c') { const it = items[focus]; if (it && it.e.cws) { if (it.cw !== null) moveFocus(1); else { wearItem(it, ((wornCw(it.e) ?? -1) + 1) % it.e.cws.length); syncDec(); } } }
  else if (k === '1' || k === '2' || k === '3') setMode(MODES[+k - 1]);
  else if (k === '[' || k === ']') { const n = IDLE_NAMES.length; if (stage.S.mode !== 'idle') setMode('idle'); setIdle(((stage.S.cycle ? stage.S.idle : stage.S.idle) + (k === ']' ? 1 : n - 1)) % n); }
  else if (k === ' ') setPause(!stage.S.paused); else if (K === 't') $('turn').click(); else if (K === 'r') randomise(); else if (K === 'p') setPfp(!UI.pfp); else if (K === 'v') toggleCompare();
  else if (K === 'b') { if (!F.compare) toggleCompare(); F.active = 1 - F.active; renderSlots(); toast(`editing fit ${'AB'[F.active]}`); }
  else if (K === 'l') { const it = items[focus]; if (it) { const s = it.e.slot; F.locks.has(s) ? F.locks.delete(s) : F.locks.add(s); renderSlots(); persistState(); toast(`${F.locks.has(s) ? 'locked' : 'unlocked'} ${SLOT_LABEL[s]}`); } }
  else if (k === '?') $('help').classList.add('on'); else if (k === 'Escape') $('help').classList.remove('on'); else hit = false;
  if (hit) ev.preventDefault(); });
$('helpBtn').onclick = () => $('help').classList.add('on'); $('help').onclick = e => { if (e.target.id === 'help') $('help').classList.remove('on'); };

// ── go
renderModes(); renderFilters(); renderFitList(); setPfp(UI.pfp); applyFits({ mode: true }); stage.compile(); lastSwitchMs = stage.lastSwitch.total;   // (the first draw compiles the shaders: not a switch)
renderGrid(); if (Q.has('focus')) { const i = items.findIndex(it => it.e.key === Q.get('focus')); if (i >= 0) setFocus(i, false); }
if (Q.has('t')) { stage.advance(+Q.get('t')); setPause(true); }
const statsEl = $('stats'), labelsEl = $('labels'); let fps = 0, acc = 0, nf = 0, last = performance.now(), shownIdle = -1;
function frame(now) { const dt = Math.min(.1, (now - last) / 1000); last = now; if (!stage.S.paused) stage.advance(dt); stage.draw(); drawPfp();
  renderThumbs(SHOT ? 60 : 7); if (stage.S.cycle && shownIdle !== stage.S.idle) { shownIdle = stage.S.idle; renderModes(); }
  if (F.compare) { const hs = stage.heads(); if (labelsEl.children.length !== hs.length) labelsEl.innerHTML = hs.map((_, k) => `<span>${'AB'[k]}</span>`).join('');
    hs.forEach(([x, y, on], k) => { const s = labelsEl.children[k]; s.style.display = on ? '' : 'none'; s.style.left = x + 'px'; s.style.top = y + 'px'; s.textContent = `${'AB'[k]}${k === F.active ? ' ✎' : ''} · ${F.fits[k].handle || 'fit'}`; }); }
  else if (labelsEl.children.length) labelsEl.innerHTML = '';
  acc += dt; nf++; if (acc > .5) { fps = nf / acc; acc = 0; nf = 0; const ls = stage.lastSwitch;
    statsEl.textContent = `switch ${lastSwitchMs.toFixed(0)} ms (bake ${ls.bake.toFixed(0)} · batch ${ls.batch.toFixed(1)})\n${Math.round(ls.tris || 0).toLocaleString()} tris · ${fps.toFixed(0)} fps${pending() ? ` · thumbs ${pending()} to go` : ''}`; }
  if (SHOT && !pending() && document.title !== 'ready' && performance.now() - bootT > 1500) document.title = 'ready';
  schedule(frame); }
const bootT = performance.now(), schedule = SHOT ? f => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;
if (!SWEEP) schedule(frame);

// ── the headless gate: every trait (and every colourway) worn, baked, animated in all three modes, drawn; its thumbnail built
window.__studio = { CAT, F, stage, cur, applyFits, items: () => items, thumbStats };
window.__sweep = async function (o = {}) { const res = { traits: 0, variants: 0, fail: [], times: [], glErrors: 0, thumbs: 0 }, base = structuredClone(CH.LOOKS[0]); F.compare = false; F.active = 0;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const ctx = cv.getContext('2d');
  for (const e of CAT) { res.traits++; const cws = e.cws ? e.cws.map((_, i) => i) : [null];
    for (const cw of cws) { res.variants++; try { F.fits[0] = structuredClone(base); const L = F.fits[0];
        if (STRING_SLOTS.has(e.slot)) L[e.slot] = e.id; else L[e.slot] = cw === null ? { id: e.id } : { id: e.id, cw };
        const ms = applyFits({ finish: true }); res.times.push(ms);
        for (const m of MODES) { stage.setMode(m); stage.advance(.35); stage.draw(); }
        stage.setMode('idle'); stage.setIdle(2); stage.advance(.8); stage.draw();   // (check phone: the held grip and the idle together)
        const err = stage.finish(); if (err) { res.glErrors++; res.fail.push(e.key + (cw !== null ? '#' + cw : '') + ': gl error ' + err); }
        if (o.thumbs !== false) { snap(wearOne(BASE, e, cw ?? 0), '#e4e4e4', 'bust', .42, 64, 64, ctx); res.thumbs++; }
        if (window.__errors.length) { res.fail.push(e.key + (cw !== null ? '#' + cw : '') + ': ' + window.__errors.splice(0).join(' | ')); } }
      catch (err) { res.fail.push(e.key + (cw !== null ? '#' + cw : '') + ': ' + (err.stack || err).toString().split('\n').slice(0, 2).join(' ')); } }
    if (res.traits % 20 === 0) await new Promise(r => setTimeout(r, 0)); }
  const t = [...res.times].sort((a, b) => a - b); res.switchMs = { p50: +t[t.length >> 1].toFixed(1), p95: +t[Math.floor(t.length * .95)].toFixed(1), max: +t[t.length - 1].toFixed(1) };
  delete res.times; return res; };
if (SWEEP) document.title = 'sweep-ready'; else if (!SHOT) document.title = 'Trait Studio';
