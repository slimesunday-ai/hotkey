// CAMERA PASS · THE HUD: the mode indicator (bottom centre: the four modes, clickable or tappable, and one line of what the keys do
// right now), the ? key-help overlay (every mode's keys, mouse sensitivity and invert Y, kept in this browser), short toasts, and the
// fly crosshair. PHOTO hides all of it (body.cam-photo; photo.js has its own bar). Styled like the page's own bar (index.html).
import { CAM, savePrefs } from './config.js';

const CSS = `
#camhud { position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%); width: max-content; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; font: 800 calc(12.5 * var(--k-px, 1px))/1 "Arial Black", Impact, sans-serif; letter-spacing: .03em; text-transform: uppercase; }
#camhud .modes { display: flex; gap: 4px; pointer-events: auto; }
#camhud button { font: inherit; text-transform: uppercase; border: 0; background: #f7f7f2; color: #17171b; padding: 6px 8px 5px; cursor: pointer; box-shadow: 2px 2px 0 #17171b; }
#camhud button kbd { font: inherit; opacity: .72; margin-left: 5px; }
#camhud button:hover { background: #ffc21a; } #camhud button.on { background: #17171b; color: #ffc21a; box-shadow: 2px 2px 0 #ffc21a; }
#camhud button.on kbd { opacity: .75; } #camhud button.off { background: #d9d9d1; color: #45454c; box-shadow: 2px 2px 0 #8a8a90; }   /* (off: muted paper, not see-through: it is still a key and still a plate) */
#camhud button:focus-visible { outline: 3px solid #ff4fa3; outline-offset: 2px; }
#camhud .ctx { color: #fff; background: rgba(23, 23, 27, .88); padding: 3px 8px 2px; text-shadow: none; text-transform: none; letter-spacing: 0; font: 700 calc(12.5 * var(--k-px, 1px))/1.3 Arial, "Helvetica Neue", sans-serif; text-align: center; max-width: min(calc(760 * var(--k-px, 1px)), calc(100vw - 32px)); }   /* (on an ink plate: white on the scene vanished over pale sidewalks) */
#camhud .ctx:empty { display: none; }
#camhud .ctx b { color: #ffc21a; font-weight: 800; }
#camtoast { position: fixed; left: 50%; top: 64px; transform: translateX(-50%); z-index: 12; background: #17171b; color: #f7f7f2; padding: 7px 11px 6px; box-shadow: 3px 3px 0 #ffc21a; font: 800 calc(12.5 * var(--k-px, 1px))/1.2 "Arial Black", Impact, sans-serif; text-transform: uppercase; letter-spacing: .03em; transition: opacity .3s; pointer-events: none; }
#camtoast.off { opacity: 0; }
#camx { position: fixed; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1.5px #17171b; z-index: 5; pointer-events: none; }
#camx[hidden] { display: none; }
#camhelp { position: fixed; inset: 0; z-index: 25; display: grid; place-items: center; background: rgba(23, 23, 27, .55); }
#camhelp[hidden] { display: none; }
#camhelp .box { width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; background: #17171b; color: #f7f7f2; box-shadow: 6px 6px 0 #ffc21a; padding: 16px 18px 14px; font: 600 calc(12.5 * var(--k-px, 1px))/1.45 ui-monospace, Menlo, monospace; }
#camhelp h2 { margin: 0 0 10px; font: 800 calc(18 * var(--k-px, 1px))/1 "Arial Black", Impact, sans-serif; color: #ffc21a; text-transform: uppercase; letter-spacing: .04em; }
#camhelp .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px 18px; }
#camhelp h3 { margin: 0 0 4px; font: 800 calc(13 * var(--k-px, 1px))/1.2 "Arial Black", Impact, sans-serif; text-transform: uppercase; color: #9fdcff; }
#camhelp h3.on { color: #6cff4a; }
#camhelp dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; }
#camhelp dt { color: #ffc21a; white-space: nowrap; } #camhelp dd { margin: 0; color: #d9d9e0; }
#camhelp .set { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid #34343c; }
#camhelp .set label { display: flex; gap: 8px; align-items: center; } #camhelp input[type=range] { accent-color: #ffc21a; width: 140px; } #camhelp input[type=checkbox] { accent-color: #ffc21a; }
#camhelp .x { float: right; font: 800 calc(12.5 * var(--k-px, 1px))/1 "Arial Black", sans-serif; border: 0; background: #f7f7f2; color: #17171b; padding: 6px 8px 5px; cursor: pointer; text-transform: uppercase; }
body.cam-photo .ui, body.cam-photo .hint, body.cam-photo #camhud, body.cam-photo #modfail, body.cam-photo #simbadge, body.cam-photo #camx, body.cam-photo #homeov { display: none !important; }
@media (max-width: 640px) { #camhud button kbd { display: none; } }
`;
export const MODE_KEYS = {
  all: [['1 2 3 4', 'orbit · fly · follow · photo'], ['Esc', 'back (photo → where you were, else the map)'], ['?', 'this help'], ['\\', 'render panel']],
  orbit: [['drag', 'move'], ['right / shift-drag', 'turn'], ['scroll · pinch', 'zoom'], ['W A S D · arrows', 'move (eased)'], ['Q E', 'turn'], ['R F', 'zoom'], ['Shift', 'faster'], ['click a person', 'follow them'], ['click a home', 'look inside'], ['views · Go to', 'ease there · jump there']],
  fly: [['click', 'mouse-look (pointer lock) · Esc lets go'], ['drag', 'look, without the lock'], ['W A S D', 'fly · strafe'], ['E / Space · Q / C', 'up · down'], ['arrows', 'look'], ['Shift · Alt', 'boost · slow'], ['wheel', 'speed'], ['click (locked)', 'follow the person at the dot']],
  follow: [['click a person', 'follow them'], ['Tab · Shift-Tab', 'next · previous person nearby'], ['G', 'next sim agent (?sim=live)'], ['drag · two-finger swipe · A D · ← →', 'orbit round them (it stays where you leave it)'], ['W S · ↑ ↓', 'higher · lower (yours: kept, as the distance is)'], ['wheel · pinch · R F', 'closer · further (yours: kept for the next person and a reload)']],
  photo: [['Enter', 'still at the format'], ['R', 'record a clip · again to stop'], ['V', 'next format (screen, 2×, 4K, 9:16, 4:5, 1:1)'], ['B', 'depth of field on / off'], ['[ ]', 'focus nearer · further (manual)'], ['F', 'free camera ↔ follow the person'], ['wheel · - =', 'lens (field of view)'], ['Z X', 'roll'], ['W A S D E Q · drag', 'move · look (slow, smooth)'], ['H', 'hide / show the photo bar']],
  pad: [['left stick · right stick', 'move · look'], ['LT RT · LB RB', 'down · up'], ['L3', 'boost'], ['A', 'follow / next person'], ['B', 'back'], ['X', 'still (photo) · previous person'], ['Y', 'photo'], ['Start', 'fly'], ['Back', 'help'], ['d-pad', 'speed · people']],
  touch: [['left side', 'move stick (fly, photo)'], ['right side', 'look / orbit'], ['pinch', 'speed · distance · lens'], ['tap a person', 'follow them'], ['tap the mode bar', 'switch modes']],
};
const LABEL = { orbit: 'Orbit', fly: 'Fly', follow: 'Follow', photo: 'Photo', walk: 'Walk' };

export function createHud(rig) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const h = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const box = h('div', { id: 'camhud', role: 'toolbar', 'aria-label': 'Camera mode' }), modes = h('div', { class: 'modes' }), ctx = h('div', { class: 'ctx', 'aria-live': 'polite' });
  const btns = {}; ['orbit', 'fly', 'follow', 'photo', 'walk'].forEach((m, k) => { const b = h('button', { type: 'button', title: `${LABEL[m]} (${k + 1})` }); b.append(LABEL[m], h('kbd', {}, String(k + 1))); b.onclick = () => { rig.setMode(m); b.blur(); }; btns[m] = b; modes.append(b); });
  const q = h('button', { type: 'button', title: 'keys (?)', 'aria-label': 'Camera keys' }, '?'); q.onclick = () => { help(); q.blur(); }; modes.append(q);
  box.append(modes, ctx); document.body.append(box);
  const toastEl = h('div', { id: 'camtoast', class: 'off', role: 'status' }), x = h('div', { id: 'camx', hidden: '' }); document.body.append(toastEl, x);
  const hint = document.querySelector('.hint'), hint0 = hint?.innerHTML;
  let mode = 'orbit', tT = 0, helpEl = null, helpX = null, helpFrom = null, locked = false, lockErr = false, lastCtx = '';
  function context() {
    if (mode === 'orbit') return 'drag move · right-drag turn · scroll zoom · <b>click a person</b> to follow · <b>?</b> keys';
    if (mode === 'fly') { const c = rig.fly, sp = Math.round(c.speed), mul = c.speedMul;
      return `${locked ? 'mouse looks · <b>Esc</b> lets go' : lockErr ? 'drag to look (no pointer lock here)' : '<b>click</b> for mouse-look · or drag'} · WASD · E/Q up/down · Shift boost · wheel speed <b>×${mul.toFixed(mul < 1 ? 2 : 1)}</b> · ${sp} m/s · <b>Esc</b> map`; }
    if (mode === 'follow') { const s = rig.subject, L = rig.people.label(s); return `${rig.follow.lost ? 'lost them — waiting' : 'following <b>' + L + '</b>'} · <b>Tab</b> next · G agent · drag or swipe orbit · wheel distance · <b>Esc</b> map`; }
    if (mode === 'walk') return rig.ctrl?.hud?.() || 'walk';
    return '';
  }
  function mode_(m) { mode = m; for (const [k, b] of Object.entries(btns)) { b.classList.toggle('on', k === m); b.setAttribute('aria-pressed', String(k === m)); }
    btns.walk.hidden = !rig.registered?.('walk'); btns.walk.classList.add('off');
    x.hidden = !(m === 'fly' && locked); lastCtx = ''; if (helpEl && !helpEl.hidden) fillHelp();
    if (hint) hint.innerHTML = m === 'orbit' ? hint0 : ''; }
  function tick(dt, frame) { if (tT > 0 && (tT -= dt) <= 0) toastEl.classList.add('off'); if (frame % 8) return; const c = context(); if (c !== lastCtx) { ctx.innerHTML = c; lastCtx = c; } }
  function toast(msg, s = 2.2) { toastEl.textContent = msg; toastEl.classList.remove('off'); tT = s; }
  function fillHelp() {
    const b = helpEl.querySelector('.grid'); b.textContent = '';
    for (const [k, list] of Object.entries(MODE_KEYS)) { const sec = h('div'), t = h('h3', { class: k === mode ? 'on' : '' }, { all: 'Every mode', pad: 'Gamepad', touch: 'Touch' }[k] || LABEL[k] + (k === mode ? ' · now' : ''));
      const dl = h('dl'); for (const [key, what] of list) dl.append(h('dt', {}, key), h('dd', {}, what)); sec.append(t, dl); b.append(sec); }
  }
  function help(open) {
    if (!helpEl) { helpEl = h('div', { id: 'camhelp', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Camera keys', hidden: '' }); const inner = h('div', { class: 'box' });
      const xb = h('button', { class: 'x', type: 'button' }, 'close ✕'); xb.onclick = () => help(false); helpX = xb;
      const set = h('div', { class: 'set' }), sl = h('input', { type: 'range', min: '.2', max: '3', step: '.05', 'aria-label': 'Mouse sensitivity' }), iv = h('input', { type: 'checkbox', 'aria-label': 'Invert Y' }), out = h('span', {}, '');
      sl.value = CAM.look.sens; iv.checked = CAM.look.invertY; out.textContent = '×' + (+sl.value).toFixed(2);
      sl.oninput = () => { CAM.look.sens = +sl.value; out.textContent = '×' + CAM.look.sens.toFixed(2); savePrefs(); }; iv.onchange = () => { CAM.look.invertY = iv.checked; savePrefs(); };
      const l1 = h('label', {}, 'mouse sensitivity '); l1.append(sl, out); const l2 = h('label', {}, 'invert Y '); l2.append(iv);
      set.append(l1, l2, h('span', { style: 'color:#9a9aa6' }, 'kept in this browser · every other value: camera/config.js'));
      inner.append(xb, h('h2', {}, 'Camera'), h('div', { class: 'grid' }), set); helpEl.append(inner); document.body.append(helpEl);
      helpEl.addEventListener('click', e => { if (e.target === helpEl) help(false); }); }
    const want = open ?? helpEl.hidden, was = !helpEl.hidden; if (want) { rig.input?.unlock(); fillHelp(); } helpEl.hidden = !want;
    // modal: the focus goes in (its close button) and back where it was when it closes (rig.js takes every key while it is open)
    if (want && !was) { helpFrom = document.activeElement; helpX.focus({ preventScroll: true }); }
    else if (!want && was) { const f = helpFrom; helpFrom = null; if (helpEl.contains(document.activeElement)) { try { f?.focus?.({ preventScroll: true }); } catch {} if (helpEl.contains(document.activeElement)) document.activeElement.blur(); } }
  }
  // Tab and Shift+Tab walk only the help's own controls (close, the sensitivity slider, invert Y), round and round. → true for a Tab
  function trap(e) { if (e.key !== 'Tab' || !helpEl) return false; e.preventDefault(); const f = [...helpEl.querySelectorAll('button, input')].filter(el => !el.disabled);
    const i = f.indexOf(document.activeElement); f[i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus({ preventScroll: true }); return true; }
  return { mode: mode_, tick, toast, help, trap, get helpOpen() { return !!helpEl && !helpEl.hidden; }, get helpEl() { return helpEl; },
    lock(l, err) { locked = l; if (err) lockErr = true; x.hidden = !(mode === 'fly' && locked); lastCtx = ''; } };
}
