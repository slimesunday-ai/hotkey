// HUMAN LAYER · SECTION 4 · SETTINGS: the toggles that were scattered over keys and the developer bar, in one small sheet under the
// menu's Settings button (` opens it). Each control drives the module that owns the setting, through that module's own API, and that
// module keeps it (kit.js prefs: localStorage behind try/catch), so a key and this sheet never disagree:
//   look      the UI skin (U)                                   ui/kit.js setSkin
//   city      citizen pins (P) · the news ticker (Shift+N)      ui/city.js setPins · ui/city-info/ticker.js
//             the broadcast delay (Off, 10–30 s; ?delay= for one page)   simstate/broadcast.js setDelay
//   map       turf colours on the map                          ui/map setLayer('turf')
//   tape      secrets over the agents (T in TAPE)               ui/tape toggleSecrets
//   camera    mouse sensitivity, invert Y                       camera/config.js CAM.look + savePrefs (the ? help has the same two)
//   graphics  the quality preset (reloads the page, as the developer bar's buttons do; kept for the next visit: main.js reads it)
//   dev       the developer bar on / off (Shift+`, or ?dev=1)
// Cost: closed, nothing. Values are read when it opens and after each change.
import { h, set, attr, SKINS, getSkin, setSkin, prefs, toast } from '../kit.js';
import { savePrefs } from '../../camera/config.js';
import { svg } from '../menu/icons.js';
import { BROADCAST, delayS, setDelay, delayFromUrl } from '../../simstate/broadcast.js';

export const QUALITY_KEY = 'aicity.ui.quality', DEV_KEY = 'aicity.ui.dev';
const SKIN_NAME = { zte: 'Zine × TE', clean: 'Clean', '98': '98', zine: 'Zine' }, QS = [['low', 'Low'], ['medium', 'Med'], ['high', 'High'], ['auto', 'Auto']];

export function createSettings({ api, sim, city, root, refs, anchor = () => null, setDev, onChange = () => {} }) {
  const x = h('button', { type: 'button', class: 'k-btn is-icon st-x', 'data-tip': 'Close (Esc)', 'aria-label': 'Close settings' }, svg('close')); x.onclick = () => close();
  const el = h('section', { class: 'mn-pop st', role: 'dialog', 'aria-label': 'Settings', hidden: true, 'data-safe-avoid': '' }, h('header', { class: 'st-head' }, h('h2', null, 'Settings'), x));
  const body = h('div', { class: 'st-body' }); el.append(body); root.append(el);
  const sec = (title, ...rows) => h('div', { class: 'st-sec' }, h('h3', { class: 'k-h' }, title), ...rows);
  const row = (label, kbd, control, note = null) => h('div', { class: 'st-row' }, h('span', { class: 'st-l' }, label, kbd ? h('kbd', null, kbd) : '', note ? h('small', null, note) : ''), control);
  function sw(get, put, label) { const b = h('button', { type: 'button', role: 'switch', class: 'st-sw', 'aria-label': label }, h('i')); b.onclick = () => { put(!get()); sync(); }; b._get = get; return b; }
  function seg(opts, get, put, label) { const g = h('div', { class: 'st-seg', role: 'radiogroup', 'aria-label': label });
    for (const [v, l] of opts) { const b = h('button', { type: 'button', role: 'radio', 'data-v': v }, l); b.onclick = () => { put(v); sync(); }; g.append(b); } g._get = get; return g; }
  const R = () => refs() || {};
  // ── the controls
  const skin = seg(SKINS.map(s => [s, SKIN_NAME[s] || s]), getSkin, s => setSkin(s), 'UI skin');
  const pins = sw(() => city.pins, on => { city.setPins(on); }, 'Citizen pins');
  const ticker = sw(() => !!R().info?.ticker?.on, on => { const t = R().info?.ticker; if (t && t.on !== on) t.toggle(); }, 'News ticker');
  const delay = seg(BROADCAST.choices.map(v => [String(v), v ? v + ' s' : 'Off']), () => String(delayS()), v => setDelay(+v), 'Broadcast delay');
  const turf = sw(() => !!R().map?.layers?.().turf, on => R().map?.setLayer?.('turf', on), 'Turf on the map');
  const secretsOn = () => prefs.get('aicity.ui.tape.secrets') !== '0';
  const secrets = sw(secretsOn, on => { if (secretsOn() !== on) R().tape?.toggleSecrets?.(); }, 'Tape secrets');
  const L = api.cam?.config?.look;
  const sens = h('input', { type: 'range', class: 'st-range', min: '0.25', max: '3', step: '0.05', 'aria-label': 'Mouse sensitivity' }), sensV = h('output', { class: 'st-v k-mono' });
  sens.oninput = () => { if (!L) return; L.sens = +sens.value; savePrefs(); set(sensV, (+sens.value).toFixed(2) + '×'); };
  const invert = sw(() => !!L?.invertY, on => { if (L) { L.invertY = on; savePrefs(); } }, 'Invert Y');
  const PR = api.PR || {}, qNow = h('small', null, `now ${PR.name || '?'}${PR.auto ? ' (auto)' : ''} · reloads`);
  const qWant = () => { try { return new URLSearchParams(location.search).get('q') || prefs.get(QUALITY_KEY) || 'auto'; } catch { return 'auto'; } };
  const quality = seg(QS, qWant, v => {
    if (v === qWant()) return; prefs.set(QUALITY_KEY, v); const u = new URL(location.href); u.searchParams.set('q', v); toast('Reloading at ' + v + ' quality…'); setTimeout(() => { location.href = u; }, 250); }, 'Quality');
  const dev = sw(() => document.body.classList.contains('dev'), on => setDev(on), 'Developer bar');
  body.append(
    sec('Look', row('Skin', 'U', skin)),
    sec('In the city', row('Citizen pins', 'P', pins), row('News ticker', 'Shift N', ticker)),
    sec('Broadcast', h('div', { class: 'st-row st-col' }, h('span', { class: 'st-l' }, 'Delay', h('small', null, delayFromUrl() ? 'the city airs this long after the sim · ?delay= on this page' : 'the city airs this long after the sim')), delay)),
    sec('Map and tape', row('Turf colours on the map', null, turf), row('Secrets on the tape', 'T', secrets, 'thoughts, DMs and deals, in TAPE')),
    L ? sec('Camera', row('Mouse sensitivity', null, h('span', { class: 'st-rangew' }, sens, sensV)), row('Invert Y', null, invert)) : '',
    sec('Graphics', h('div', { class: 'st-row st-col' }, h('span', { class: 'st-l' }, 'Quality', qNow), quality)),
    sec('Developer', row('Developer bar', 'Shift `', dev, 'views, Go to, render panel')));
  const switches = [pins, ticker, turf, secrets, invert, dev], segs = [skin, delay, quality];
  function sync() {
    for (const b of switches) attr(b, 'aria-checked', b._get() ? 'true' : 'false');
    for (const g of segs) { const v = g._get(); for (const b of g.children) { const on = b.dataset.v === v; attr(b, 'aria-checked', on ? 'true' : 'false'); attr(b, 'tabindex', on ? '0' : '-1'); } }
    if (L) { sens.value = String(L.sens); set(sensV, (+L.sens).toFixed(2) + '×'); }
    turf.closest('.st-row').hidden = !R().map; secrets.closest('.st-row').hidden = !R().tape; ticker.closest('.st-row').hidden = !R().info?.ticker;
  }
  // segments: ← → move the choice (a radio group); stopped here, so the camera (nav.js, camera/input.js) never moves with them (review 10-09 #11)
  for (const g of segs) g.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); e.stopPropagation(); const bs = [...g.children], k = bs.findIndex(b => b.getAttribute('aria-checked') === 'true'), n = bs[(k + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length]; n.focus(); if (g !== quality) n.click(); });
  let isOpen = false;
  function open() { if (isOpen) return; isOpen = true; sync(); el.hidden = false; position(); (el.querySelector('.st-seg [aria-checked="true"]') || x).focus({ preventScroll: true }); onChange(true); }
  function close() { if (!isOpen) return false; isOpen = false; el.hidden = true; if (el.contains(document.activeElement)) anchor()?.focus({ preventScroll: true }); onChange(false); return true; }
  function position() { const a = anchor(); if (!a) return; const r = a.getBoundingClientRect(), w = el.offsetWidth || 330; el.style.left = Math.round(Math.max(10, Math.min(innerWidth - w - 10, r.left))) + 'px'; }
  addEventListener('resize', () => { if (isOpen) position(); });
  addEventListener('pointerdown', e => { if (isOpen && !el.contains(e.target) && !anchor()?.contains(e.target)) close(); }, true);
  return { el, open, close, toggle: () => isOpen ? close() : open(), sync, get isOpen() { return isOpen; } };
}
