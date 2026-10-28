// HUMAN LAYER · THE UI KIT (section 1): the root (#k), the three skins, the fonts, and the components every later screen builds from:
//   panel/sheet · card · tabs · chip · stat row · list · button · toast · tooltip · hover label · lens badge (+ icons)
// Components are plain DOM factories styled by ui/kit.css; a skin is only tokens and per-skin restyles on the same markup, so a screen
// written once wears them all. Skin: ?ui=zte|clean|98|zine (zte, Zine × TE · Pink, is the default since W7; slime's pick from the style
// lab), the U key cycles (ui/index.js), the choice is kept in this browser (a new key since zte: an older pick doesn't hide the default).
// Nothing here runs per frame. Text that changes with the sim goes through set() (writes only when the value changed).

export const SKINS = ['zte', 'clean', '98', 'zine'];
export const DEFAULT_SKIN = 'zine';
const FONTS = {
  zte: 'family=Space+Mono:ital,wght@0,400;0,700;1,400',
  clean: 'family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600',
  '98': 'family=VT323&family=IBM+Plex+Mono:wght@400;500;600',
  zine: 'family=Anton&family=Courier+Prime:wght@400;700&family=Rubik+Dirt',
};
const KEY = 'aicity.ui.skin.v2';
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
export const prefs = store;

// ── DOM
export function h(tag, attrs = null, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export const set = (el, text) => { const s = text ?? ''; if (el.textContent !== s) el.textContent = s; return el; };   // (no DOM write when nothing changed)
export const attr = (el, k, v) => { const s = v === null || v === undefined || v === false ? null : String(v); if (el.getAttribute(k) !== s) { if (s === null) el.removeAttribute(k); else el.setAttribute(k, s); } return el; };

// ── icons (inline SVG, currentColor)
const P = {
  live: '<circle cx="8" cy="8" r="3.2" fill="currentColor"/><path d="M3.6 3.6a6.2 6.2 0 0 0 0 8.8M12.4 3.6a6.2 6.2 0 0 1 0 8.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  tape: '<rect x="1.5" y="3.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5.3" cy="7.6" r="1.6" fill="currentColor"/><circle cx="10.7" cy="7.6" r="1.6" fill="currentColor"/><path d="M4 12.5l1.2-2h5.6l1.2 2" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  yours: '<circle cx="5.5" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 8h6M12.5 8v2.6M14.5 8v1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  archive: '<rect x="2" y="3" width="12" height="3" rx=".8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 6v6.5h10V6M6.5 8.6h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  follow: '<path d="M8 1.8l5.2 12.4L8 11.3l-5.2 2.9z" fill="currentColor"/>',
  tapeplay: '<path d="M4.5 3l8 5-8 5z" fill="currentColor"/>',
  star: '<path d="M8 1.6l1.95 4.1 4.45.55-3.27 3.08.84 4.42L8 11.6l-3.97 2.15.84-4.42L1.6 6.25l4.45-.55z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  starOn: '<path d="M8 1.6l1.95 4.1 4.45.55-3.27 3.08.84 4.42L8 11.6l-3.97 2.15.84-4.42L1.6 6.25l4.45-.55z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  pin: '<path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.2-4.5 8.5-4.5 8.5S3.5 9.2 3.5 6A4.5 4.5 0 0 1 8 1.5z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6" r="1.6" fill="currentColor"/>',
};
export const icon = (k, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls); s.innerHTML = P[k] || ''; return s; };

// ── the root and the skins
let root = null, skin = DEFAULT_SKIN, onSkin = new Set();
// fonts: false (the record path, C1-11) keeps the page to its feed and static files: no web-font request, the skins' system fallbacks
export function mountRoot(Q, { fonts = true } = {}) {
  if (root) return root;
  if (!fonts) webFonts = false;
  if (!document.querySelector('link[data-k-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./kit.css', import.meta.url).href, 'data-k-css': '' }));
  if (webFonts) for (const u of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) document.head.append(h('link', { rel: 'preconnect', href: u, crossorigin: '' }));
  root = h('div', { id: 'k', 'data-skin': DEFAULT_SKIN }); document.body.append(root);
  const want = Q?.get?.('ui'); setSkin(SKINS.includes(want) ? want : SKINS.includes(store.get(KEY)) ? store.get(KEY) : DEFAULT_SKIN, { keep: false });
  addEventListener('keydown', e => { for (const f of firstKeys) if (f(e)) { e.stopImmediatePropagation(); return; }
    if (e.code === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && screens.esc()) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  return root;
}
// THE ESC STACK: one Esc closes the NEWEST open screen (the UI-keys leftover: the order was fixed by which listener was added first, so
// the City panel opened after the dossier waited behind it). A screen Esc closes says so as it opens and as it closes:
//   screens.open(id, { esc, isOpen })   on top (a screen already open keeps its place) · esc(): one step back (the map: its card first)
//   screens.close(id)                    off the stack, wherever it is
// The modals come before it (the camera help: camera/rig.js; the diary room: keysFirst); with nothing on it, Esc goes on to TAPE's back
// to LIVE and the camera's back to the map. An entry whose isOpen() says no is dropped (a screen closed by a way that didn't say so)
const stack = [];
export const screens = {
  open(id, { esc, isOpen = () => true } = {}) { const k = stack.findIndex(x => x.id === id); if (k >= 0) { stack[k] = { id, esc, isOpen }; return; } stack.push({ id, esc, isOpen }); },
  close(id) { const k = stack.findIndex(x => x.id === id); if (k >= 0) stack.splice(k, 1); },
  // Esc: the newest open screen's one step back → true when there was one
  esc() { for (let k = stack.length - 1; k >= 0; k--) if (!stack[k].isOpen()) stack.splice(k, 1);
    const top = stack[stack.length - 1]; if (!top) return false; try { top.esc(); } catch (err) { console.error('[screens]', top.id, err); stack.splice(stack.indexOf(top), 1); } return true; },
  get top() { return stack.length ? stack[stack.length - 1].id : null; },
  list: () => stack.map(x => x.id),
};
// keys a modal takes before every screen (the diary room): one capture listener, added with the root, so before any screen's (capture
// listeners run in the order added). A taker returns true for a key that is its: no other listener hears it (it calls preventDefault
// itself when the browser's own action must not happen either)
const firstKeys = new Set();
export const keysFirst = f => { firstKeys.add(f); return () => firstKeys.delete(f); };
// a modal's focus trap: Tab / Shift+Tab walk only the box's own controls, round and round (from outside the box: its first or last).
// → true when the key was a Tab (it is handled: preventDefault)
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
export function trapTab(e, box) {
  if (e.key !== 'Tab') return false; e.preventDefault();
  const f = [...box.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && !el.closest('[hidden]') && (el.offsetWidth || el.offsetHeight));
  if (!f.length) return true; const i = f.indexOf(document.activeElement);
  f[i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus({ preventScroll: true }); return true;
}
const loaded = new Set();
let webFonts = true;
function loadFonts(s) { if (loaded.has(s)) return; loaded.add(s); if (webFonts) document.head.append(h('link', { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${FONTS[s]}&display=swap` }));
  // zte letters its labels in the city's own sign face (ui/signfont.js, built from signage/type); once it's in, anything that measured
  // text (the dossier's handle fit, the canvases' fonts) hears a skin change and measures again
  if (s === 'zte') import('./signfont.js').then(m => m.loadSignFont()).then(() => { if (skin === 'zte') for (const f of onSkin) f(skin); }).catch(() => {}); }
export function setSkin(s, { keep = true } = {}) { if (!SKINS.includes(s)) return skin; skin = s; loadFonts(s); root?.setAttribute('data-skin', s); if (keep) store.set(KEY, s); for (const f of onSkin) f(s); return s; }
export const getSkin = () => skin;
export const nextSkin = () => setSkin(SKINS[(SKINS.indexOf(skin) + 1) % SKINS.length]);
export const onSkinChange = f => { onSkin.add(f); return () => onSkin.delete(f); };
export const token = name => getComputedStyle(root).getPropertyValue(name).trim();
export const getRoot = () => root;

// ── components
export const LENS_NAME = { live: 'LIVE', tape: 'TAPE', yours: 'YOURS', archive: 'ARCHIVE' };
export const LENS_TIP = {
  live: 'Live: what anyone on the street can see right now',
  tape: 'Tape: private, shown one game day late',
  yours: 'Yours: your own agent, everything live',
  archive: 'Archive: a finished season, everything',
};
// a lens badge: lens('tape', 'as of Day 3 · 06:00') · lens('live'). While the sim is offline (simOffline) every LIVE badge says
// OFFLINE, grey and still: what is on screen is the last state the sim sent, not live (review 10-09 #13: every LIVE stayed on)
let simOff = false;
const OFF_TIP = 'Offline: the sim stopped answering. This is the last state it sent; it comes back by itself';
export function lens(kind, at = '') {
  const b = h('span', { class: 'k-lens', 'data-lens': kind, 'data-tip': LENS_TIP[kind] });
  b.append(kind === 'live' ? h('i', { class: 'k-live-dot' }) : icon(kind), h('span', { class: 'k-lens-name' }, LENS_NAME[kind]));
  const atEl = h('span', { class: 'k-lens-at' }); b.append(atEl); b.update = (k2, at2 = '') => { const off = k2 === 'live' && simOff; b._at = at2; attr(b, 'data-lens', k2); attr(b, 'data-off', off); attr(b, 'data-tip', off ? OFF_TIP : LENS_TIP[k2]);
    const nm = b.querySelector('.k-lens-name'); set(nm, off ? 'OFFLINE' : LENS_NAME[k2]); const first = b.firstChild; const want = k2 === 'live' ? 'I' : 'svg';
    if (first.nodeName.toLowerCase() !== want.toLowerCase()) first.replaceWith(k2 === 'live' ? h('i', { class: 'k-live-dot' }) : icon(k2)); else if (want === 'svg') first.innerHTML = P[k2];
    set(atEl, at2 && !off ? '· ' + at2 : ''); };
  b.update(kind, at); return b;
}
// the sim's status (ui/index.js: the store's 'status'): offline turns every LIVE badge on the page into OFFLINE, and back
export function simOffline(on) { on = !!on; if (on === simOff) return; simOff = on; root?.toggleAttribute('data-sim-offline', on);
  for (const b of document.querySelectorAll('.k-lens[data-lens="live"]')) b.update?.('live', b._at || ''); }
export function button(label, { icon: ic = null, kbd = null, primary = false, tip = null, onclick = null, cls = '' } = {}) {
  const b = h('button', { type: 'button', class: 'k-btn' + (primary ? ' is-primary' : '') + (cls ? ' ' + cls : '') + (!label ? ' is-icon' : ''), 'data-tip': tip, 'aria-label': !label ? tip : null });
  if (ic) b.append(icon(ic)); if (label) b.append(h('span', { class: 'k-btn-label' }, label)); if (kbd) b.append(h('kbd', null, kbd)); if (onclick) b.addEventListener('click', onclick); return b;
}
export const chip = (text, cls = '') => h('span', { class: 'k-chip' + (cls ? ' ' + cls : '') }, text);
export const card = (...kids) => h('div', { class: 'k-card' }, ...kids);
export function statRow(label, value = '', big = false) { const v = h('b', null, value), r = h('div', { class: 'k-stat' + (big ? ' is-big' : '') }, h('span', null, label), v); r.value = x => set(v, x); return r; }
export function list(items = [], cls = '') { const ul = h('ul', { class: 'k-list' + (cls ? ' ' + cls : '') }); ul.fill = rows => { ul.replaceChildren(...rows.map(r => r.nodeType ? r : h('li', null, h('span', { class: 'k-when' }, r.when ?? ''), h('span', { class: 'k-what' }, r.what ?? '')))); }; ul.fill(items); return ul; }
// tabs: [{ id, label, lens }] → { el, select(id), onchange }
export function tabs(defs, { selected = defs[0]?.id, onchange = () => {} } = {}) {
  const el = h('div', { class: 'k-tabs', role: 'tablist' }), btns = new Map();
  for (const d of defs) { const b = h('button', { type: 'button', class: 'k-tab', role: 'tab', id: 'k-tab-' + d.id, 'data-lens': d.lens || 'live', 'aria-selected': 'false', tabindex: '-1', 'data-tip': d.tip || null }, d.label);
    b.addEventListener('click', () => api.select(d.id, true)); btns.set(d.id, b); el.append(b); }
  // ← → walk the tabs; stopped here, so the camera (nav.js, camera/input.js: window listeners) never moves with them (review 10-09 #11)
  el.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); e.stopPropagation(); const ids = defs.map(d => d.id), k = ids.indexOf(api.selected), n = ids[(k + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length]; api.select(n, true); btns.get(n).focus(); });
  const api = { el, selected: null, buttons: btns,
    select(id, user = false) { if (!btns.has(id)) id = defs[0].id; if (api.selected === id) return; api.selected = id; for (const [k, b] of btns) { attr(b, 'aria-selected', k === id ? 'true' : 'false'); attr(b, 'tabindex', k === id ? '0' : '-1'); } onchange(id, user); },
    lens(id, l) { const b = btns.get(id); if (b) attr(b, 'data-lens', l); } };
  api.select(selected); return api;
}
// a panel (sheet) docked to a side: { el, open(), close(), side(s), isOpen }
export function panel({ side = 'right', label = 'Panel' } = {}) {
  const el = h('section', { class: 'k-panel dock-' + side, role: 'dialog', 'aria-label': label, 'aria-hidden': 'true' });
  let open = false, cur = side;
  return { el, get isOpen() { return open; }, get side() { return cur; },
    open() { if (open) return; open = true; el.classList.add('is-open'); attr(el, 'aria-hidden', 'false'); },
    close() { if (!open) return; open = false; el.classList.remove('is-open'); attr(el, 'aria-hidden', 'true'); },
    dock(s) { if (s === cur) return; el.classList.replace('dock-' + cur, 'dock-' + s); cur = s; } };
}
// toasts: toast('Starred xXbadvibesXx')
let toastBox = null;
export function toast(text, ms = 1800) {
  if (!root) return; if (!toastBox) { toastBox = h('div', { class: 'k-toasts', role: 'status', 'aria-live': 'polite' }); root.append(toastBox); }
  const t = h('div', { class: 'k-toast' }, text); toastBox.append(t); while (toastBox.children.length > 3) toastBox.firstChild.remove();
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 260); }, ms);
}
// tooltips: any element with data-tip inside #k (one shared bubble; 350 ms on hover, at once on keyboard focus)
export function tooltips() {
  const tip = h('div', { class: 'k-tip', role: 'tooltip' }); root.append(tip); let timer = 0, on = null;
  const show = (el, now) => { clearTimeout(timer); timer = setTimeout(() => { on = el; set(tip, el.getAttribute('data-tip')); const r = el.getBoundingClientRect(), tw = Math.min(240, tip.offsetWidth || 160);
    let x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)), y = r.bottom + 8; if (y + 40 > innerHeight) y = r.top - 8 - (tip.offsetHeight || 28);
    tip.style.transform = `translate(${x | 0}px, ${y | 0}px)`; tip.classList.add('is-on'); }, now ? 0 : 350); };
  const hide = () => { clearTimeout(timer); on = null; tip.classList.remove('is-on'); };
  root.addEventListener('pointerover', e => { const el = e.target.closest?.('[data-tip]'); if (el && el !== on) show(el); });
  root.addEventListener('pointerout', e => { const el = e.target.closest?.('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hide(); });
  root.addEventListener('focusin', e => { const el = e.target.closest?.('[data-tip]'); if (el && e.target.matches(':focus-visible')) show(el, true); });
  root.addEventListener('focusout', hide); root.addEventListener('pointerdown', hide);
  return { hide };
}
// the hover label (one element, moved with a transform): label.show(x, y, { name, sub, wanted }) · label.names(x, y, [names]) · label.hide()
export function hoverLabel() {
  const el = h('div', { class: 'k-label', 'aria-hidden': 'true' }), name = h('div', { class: 'k-name' }), sub = h('div', { class: 'k-sub' }), names = h('div', { class: 'k-names' });
  el.append(name, sub); root.append(el); let mode = 'one', on = false, lx = -1, ly = -1;
  const place = (x, y) => { const w = el.offsetWidth, hh = el.offsetHeight; const X = Math.round(Math.max(6, Math.min(innerWidth - w - 6, x - w / 2))), Y = Math.round(Math.max(6, y - hh - 10)); if (X !== lx || Y !== ly) { el.style.transform = `translate(${X}px, ${Y}px)`; lx = X; ly = Y; } };
  return { el,
    show(x, y, { name: n, sub: s, wanted = false }) { if (mode !== 'one') { el.replaceChildren(name, sub); mode = 'one'; } set(name, n); if (sub.dataset.k !== s + wanted) { sub.dataset.k = s + wanted; sub.replaceChildren(s ? h('span', null, s) : '', wanted ? chip('WANTED', 'is-wanted') : ''); } place(x, y); if (!on) { on = true; el.classList.add('is-on'); } },
    names(x, y, list) { const key = list.join('|'); if (mode !== 'many' || names.dataset.k !== key) { names.dataset.k = key; names.replaceChildren(...list.slice(0, 5).map(n => h('div', null, n)), list.length > 5 ? h('div', { class: 'k-muted' }, `+${list.length - 5} more`) : ''); el.replaceChildren(h('div', { class: 'k-sub' }, `${list.length} here · click to choose`), names); mode = 'many'; } place(x, y); if (!on) { on = true; el.classList.add('is-on'); } },
    move(x, y) { if (on) place(x, y); },
    hide() { if (on) { on = false; el.classList.remove('is-on'); } },
    get on() { return on; } };
}
