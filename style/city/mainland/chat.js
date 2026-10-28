// MAINLAND CHAT + PRESENCE v1 (2026-10-06) · "there should be a chat mode for humans like a chat bar, as well as when you say something it
// pops up above your agent's head, humans should be able to chat here and hangout". The page side of relay.mjs:
//   RELAY      ws://<this host>:5460/mainland (?relay=ws://host:port/room to point elsewhere, ?relay=off for none). Offline is fine: a small
//              OFFLINE · SOLO pill, chat still pops over your own head, retries back off (5 s → 60 s). net: JSON text, chatrules.mjs.
//   PRESENCE   10 Hz while you walk (where you are, your body's yaw, on the ground / jumping, away), 1 Hz otherwise; INSIDE a house you
//              send its door, so the others see your tag there. Others: peers.js (their look, walk, run, jump; interpolated).
//   CHAT       Enter (or T, or / for a command) opens the bar at the bottom; Enter sends, Esc closes; while it's open WASD types, not walks.
//              Your line pops over YOUR head (theirs over theirs) in the home-life bubbles' style (interiors/city/bubbles.js: the white
//              body with chunky stepped corners, the hard ink drop, the stepped tail; one cell = 2–4 px), stacking up to three, the
//              newest at the bottom with the tail; each fades after 4.5–10 s by length. A compact log in the corner fades when idle.
//              /wave /dap /dance: an emote (an idle-style pose, seen by everyone) · /name <handle> · /who · /help
//   HANDLE     asked the first time you walk or chat (localStorage, wrapped: a private window just asks again). ?as=<handle> for tests.
//              Later this becomes the owner's agent handle.
//   GUARDRAILS 140 characters, a rate limit and a basic word filter (chatrules.mjs, the relay enforces them); click a player's tag (or a
//              name in the log, or the people list on the pill) to MUTE their chat or HIDE them, kept in localStorage by player id.
// early({ Q }) → { seed } runs before walk.js (its keys come first, its seed is your look); init(ML) after it.
import * as THREE from 'three';
import { RULES, cleanText, cleanName, bucket, seedOf } from './chatrules.mjs';
import { createPeers, hairSeed } from './peers.js';

const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } } };
const C = { ready: false, input: null, nameInput: null, open: false, inside: false, lastInput: performance.now() };
const EMOTE_TXT = { wave: 'waves', dap: 'daps you up', dance: 'dances' };

export function early({ Q }) {
  const as = Q.get('as') ? cleanName(Q.get('as')) : '';
  let pid = as ? 'as-' + as.toLowerCase().replace(/[^a-z0-9_-]/g, '') : store.get('ml.pid');
  if (!pid || !/^[A-Za-z0-9_-]{4,40}$/.test(pid)) { const r = new Uint8Array(8); crypto.getRandomValues(r); pid = 'p-' + [...r].map(b => b.toString(36).padStart(2, '0').slice(-2)).join(''); store.set('ml.pid', pid); }
  C.pid = pid; C.as = !!as; C.asked = !!store.get('ml.asked'); C.name = as || cleanName(store.get('ml.handle') || '') || ''; C.seed = hairSeed(seedOf(pid));
  // the keys come here first (walk.js's capture listener stops everything while you walk): typing in the bar never reaches it. Any
  // input at all (typing included, so registered first) keeps you from showing as away
  for (const type of ['keydown', 'pointerdown', 'pointermove', 'wheel']) addEventListener(type, () => { C.lastInput = performance.now(); }, { capture: true, passive: true });
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', ev => { if (ev.target === C.input || ev.target === C.nameInput) ev.stopImmediatePropagation(); }, true);
  return { seed: C.seed };
}

function onKeyDown(ev) {
  const t = ev.target;
  if (t === C.input) { ev.stopImmediatePropagation(); if (ev.isComposing) return;
    if (ev.key === 'Enter') { ev.preventDefault(); C.submit(); } else if (ev.key === 'Escape') { ev.preventDefault(); C.close(); } return; }
  if (t === C.nameInput) { ev.stopImmediatePropagation(); if (ev.isComposing) return;
    if (ev.key === 'Enter') { ev.preventDefault(); C.savePrompt(); } else if (ev.key === 'Escape') { ev.preventDefault(); C.skipPrompt(); } return; }
  if (!C.ready || C.inside || ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return;
  const ae = document.activeElement; if (ae && (/INPUT|TEXTAREA|SELECT|BUTTON|^A$/.test(ae.tagName) || ae.isContentEditable)) return;   // (a focused button keeps its Enter)
  if (C.mlb && C.mlb.mode === 'build') return;
  if (ev.key === 'Escape' && C.menuOpen()) { ev.preventDefault(); ev.stopImmediatePropagation(); C.closeMenu(); return; }
  if (ev.key === 'Enter' || ev.code === 'KeyT' || ev.key === '/') { ev.preventDefault(); ev.stopImmediatePropagation(); C.openBar(ev.key === '/' ? '/' : ''); }
}

// walk.js calls this each frame with its gait (after the stride, before the anim texture): your emote
export const onGait = (g, dt, S) => C.onGait?.(g, dt, S);

export function init(ML) {
  const { scene, camera, renderer, Q, FRAME, LAWN, mlb } = ML, canvas = renderer.domElement;
  C.mlb = mlb;
  const peers = createPeers({ scene, renderer, LAWN });
  const W = () => window.__walk;

  // ── the DOM: the overhead layer (tags, bubbles), the log, the bar, the pill, the menu, the handle prompt
  const css = document.createElement('style'); css.textContent = `
  #mlc-over[hidden], .mlc-ent[hidden], #mlc-log[hidden], #mlc-bar[hidden], #mlc-pill[hidden], #mlc-menu[hidden], #mlc-prompt[hidden] { display: none !important; }
  #mlc-over { position: fixed; inset: 0; pointer-events: none; z-index: 28; overflow: hidden; }
  .mlc-ent { position: absolute; left: 0; top: 0; will-change: transform; transform-origin: 0 0; }
  .mlc-tag { position: absolute; left: 0; bottom: 0; transform: translate(-50%, 0); white-space: nowrap; pointer-events: auto; cursor: pointer;
    font: 800 11px/1 "Arial Black", Impact, sans-serif; color: #17171b; background: #fff; padding: 4px 6px 3px; box-shadow: 2px 2px 0 #17171b; transition: opacity .3s; }
  .mlc-tag i { font-style: normal; margin-left: 5px; padding: 1px 4px; background: #17171b; color: #ffc21a; font-size: 9px; text-transform: uppercase; }
  .mlc-tag i.bot { background: #ffc21a; color: #17171b; } .mlc-tag i.away, .mlc-tag i.muted { background: #a7a9b1; color: #fff; }
  .mlc-tag.away { opacity: .6; }
  .mlc-stack { position: absolute; left: 0; bottom: 0; }
  .mlc-b { position: absolute; left: 0; bottom: 0; transition: transform .22s cubic-bezier(.3, 1.3, .5, 1); }
  .mlc-b > div { position: relative; transform-origin: var(--ox) 100%; animation: mlcpop .34s cubic-bezier(.3, 1.7, .5, 1) both; }
  .mlc-b.out > div { animation: mlcout .24s ease-in both; }
  .mlc-b canvas { display: block; image-rendering: pixelated; }
  .mlc-b span { position: absolute; font: 700 13px/16px Arial, Helvetica, sans-serif; color: #17171b; overflow-wrap: anywhere; text-align: center; }
  .mlc-b.em span { font-style: italic; color: #55555e; }
  @keyframes mlcpop { from { transform: scale(.15) translateY(6px); opacity: 0; } 55% { opacity: 1; } to { transform: none; opacity: 1; } }
  @keyframes mlcout { to { transform: translateY(-8px) scale(.7); opacity: 0; } }
  #mlc-meas { position: fixed; left: -9999px; top: 0; visibility: hidden; font: 700 13px/16px Arial, Helvetica, sans-serif; max-width: 210px; overflow-wrap: anywhere; text-align: center; }
  #mlc-log { position: fixed; left: 14px; bottom: 14px; width: min(380px, calc(100vw - 28px)); display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
    z-index: 31; pointer-events: none; transition: opacity .6s; font: 700 12px/1.3 Arial, Helvetica, sans-serif; color: #17171b; }
  body.walking #mlc-log { bottom: 52px; }
  #mlc-log.idle { opacity: 0; } #mlc-log.idle * { pointer-events: none !important; }
  #mlc-log .ln { background: rgba(255,255,255,.9); padding: 3px 7px 3px 6px; box-shadow: 2px 2px 0 #17171b; max-width: 100%; overflow-wrap: anywhere; }
  #mlc-log .ln b { font: 800 11px/1 "Arial Black", Impact, sans-serif; margin-right: 5px; pointer-events: auto; cursor: pointer; }
  #mlc-log .ln b:hover { background: #ffc21a; }
  #mlc-log .ln.sys { background: rgba(23,23,27,.78); color: #e6e6ea; font-weight: 400; font-style: italic; box-shadow: none; }
  #mlc-log .ln.warn { background: #17171b; color: #ffc21a; font-style: normal; }
  #mlc-log .ln.old { opacity: .7; }
  #mlc-bar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); width: min(560px, calc(100vw - 28px)); z-index: 32; display: flex; align-items: stretch;
    background: #fff; box-shadow: 3px 3px 0 #17171b; font: 800 12px/1 "Arial Black", Impact, sans-serif; }
  #mlc-bar b { background: #17171b; color: #ffc21a; padding: 10px 9px 0; text-transform: uppercase; white-space: nowrap; }
  #mlc-bar input { flex: 1; min-width: 0; border: 0; outline: 0; padding: 9px 8px; font: 700 15px/1.2 Arial, Helvetica, sans-serif; color: #17171b; background: transparent; }
  #mlc-bar small { align-self: center; padding: 0 9px; font: 700 10px/1 Arial, sans-serif; color: #8a8a94; white-space: nowrap; }
  body.mlc-typing #wk-hud { visibility: hidden; }
  #mlc-pill { position: fixed; right: 14px; top: 14px; z-index: 31; font: 800 12px/1 "Arial Black", Impact, sans-serif; text-transform: uppercase; color: #17171b;
    background: #fff; padding: 8px 10px 7px; box-shadow: 3px 3px 0 #17171b; cursor: pointer; user-select: none; }
  #mlc-pill:hover { background: #ffc21a; }
  #mlc-pill .dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; background: #2fbf55; box-shadow: 1px 1px 0 #17171b; }
  #mlc-pill.off .dot { background: #a7a9b1; } #mlc-pill.off { color: #6d707a; }
  #mlc-pill .k { margin-left: 8px; background: #17171b; color: #ffc21a; padding: 1px 5px; }
  #mlc-menu { position: fixed; z-index: 40; min-width: 170px; max-width: min(300px, calc(100vw - 28px)); background: #fff; box-shadow: 3px 3px 0 #17171b; font: 700 12px/1.3 Arial, sans-serif; color: #17171b; }
  #mlc-menu h4 { margin: 0; padding: 8px 10px 6px; font: 800 12px/1 "Arial Black", Impact, sans-serif; background: #17171b; color: #ffc21a; }
  #mlc-menu .row { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-top: 1px solid #ececf0; }
  #mlc-menu .row .nm { flex: 1; font: 800 11px/1 "Arial Black", Impact, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #mlc-menu .row .sb { font-size: 10px; color: #8a8a94; }
  #mlc-menu button { font: 800 10px/1 "Arial Black", Impact, sans-serif; text-transform: uppercase; border: 0; background: #ececf0; color: #17171b; padding: 5px 7px; cursor: pointer; }
  #mlc-menu button:hover, #mlc-menu button.on { background: #ffc21a; }
  #mlc-menu .x { display: block; width: 100%; background: #fff; border-top: 1px solid #ececf0; padding: 7px; }
  #mlc-prompt { position: fixed; left: 50%; top: 42%; transform: translate(-50%, -50%); z-index: 45; width: min(340px, calc(100vw - 32px)); background: #fff; box-shadow: 4px 4px 0 #17171b; color: #17171b; }
  #mlc-prompt h3 { margin: 0; padding: 10px 12px 8px; font: 800 14px/1 "Arial Black", Impact, sans-serif; text-transform: uppercase; background: #17171b; color: #ffc21a; }
  #mlc-prompt p { margin: 10px 12px 8px; font: 700 12px/1.35 Arial, sans-serif; color: #55555e; }
  #mlc-prompt form { display: flex; gap: 6px; margin: 0 12px 6px; }
  #mlc-prompt input { flex: 1; min-width: 0; border: 2px solid #17171b; padding: 7px 8px; font: 700 15px/1 Arial, sans-serif; outline: 0; }
  #mlc-prompt button { border: 0; background: #ffc21a; color: #17171b; font: 800 13px/1 "Arial Black", Impact, sans-serif; padding: 0 12px; cursor: pointer; box-shadow: 2px 2px 0 #17171b; }
  #mlc-prompt .why { margin: 0 12px 10px; min-height: 14px; font: 700 11px/1.3 Arial, sans-serif; color: #c42a78; }
  #mlc-prompt .skip { float: right; margin: -2px 12px 10px 0; font: 700 11px/1 Arial, sans-serif; color: #8a8a94; cursor: pointer; text-decoration: underline; }
  @media (max-width: 640px) { #mlc-log { width: calc(100vw - 28px); } body.walking #mlc-log { bottom: 96px; } #mlc-pill .k { margin-left: 6px; padding: 3px 7px; } }
  @media (prefers-reduced-motion: reduce) { .mlc-b > div, .mlc-b.out > div { animation: none; } .mlc-b { transition: none; } }`;
  document.head.appendChild(css);
  const mk = (tag, cls, parent = document.body, html) => { const e = document.createElement(tag); if (cls) { if (cls[0] === '#') e.id = cls.slice(1); else e.className = cls; } if (html) e.innerHTML = html; parent.appendChild(e); return e; };
  const over = mk('div', '#mlc-over'), meas = mk('div', '#mlc-meas'), logEl = mk('div', '#mlc-log'), pill = mk('div', '#mlc-pill'), menu = mk('div', '#mlc-menu'); menu.hidden = true;
  const bar = mk('div', '#mlc-bar', document.body, '<b>Say</b><input maxlength="' + RULES.msgMax + '" autocomplete="off" spellcheck="false" enterkeyhint="send" aria-label="chat"><small>enter send · esc close</small>');
  bar.hidden = true; C.input = bar.querySelector('input'); logEl.classList.add('idle');
  const prompt = mk('div', '#mlc-prompt', document.body, `<h3>Who's walking?</h3><p>Pick a handle: it goes over your head when you talk. Later this becomes your agent's handle.</p>
    <form><input maxlength="${RULES.nameMax}" autocomplete="off" spellcheck="false" placeholder="your handle" aria-label="handle"><button type="submit">Go</button></form><div class="why"></div><span class="skip">skip</span><div style="clear:both"></div>`);
  prompt.hidden = true; C.nameInput = prompt.querySelector('input');

  // ── identity, mutes, hides (by player id: they survive a reconnect)
  const me = { sid: null, name: C.name || 'you', look: Q.get('look') ? { handle: Q.get('look') } : { seed: C.seed } };
  const mutes = new Set(store.json('ml.mute', [])), hides = new Set(store.json('ml.hide', []));
  const saveSets = () => { store.set('ml.mute', JSON.stringify([...mutes])); store.set('ml.hide', JSON.stringify([...hides])); };
  const names = new Map();   // sid → { name, pid, bot }

  // ── the log
  let logT = 0;
  const wake = () => { logT = performance.now(); logEl.classList.remove('idle'); };
  function logLine(kind, who, text, sid, old = false) {
    const ln = document.createElement('div'); ln.className = 'ln' + (kind !== 'chat' ? ' ' + kind : '') + (old ? ' old' : '');
    if (who) { const b = document.createElement('b'); b.textContent = '@' + who; if (sid) b.dataset.sid = sid; ln.appendChild(b); }
    ln.appendChild(document.createTextNode(text)); logEl.appendChild(ln); while (logEl.children.length > 8) logEl.firstChild.remove(); if (!old) wake(); }
  logEl.addEventListener('click', ev => { const sid = ev.target.dataset?.sid; if (sid && sid !== me.sid) openMenu(sid, ev.clientX, ev.clientY); });

  // ── the pill: online with a count, or offline (solo); click → the people list
  let status = 'offline';
  function setPill() { const n = peers.all().filter(p => p.leaving < 0).length;
    pill.classList.toggle('off', status !== 'online');
    pill.innerHTML = status === 'online' ? `<span class="dot"></span>${n + 1} here<span class="k">↵ chat</span>` : status === 'connecting' ? '<span class="dot"></span>connecting…' : '<span class="dot"></span>offline · solo<span class="k">↵ chat</span>';
    pill.title = status === 'online' ? 'people on the Mainland: click to mute or hide' : "the chat relay isn't running: chat only shows over your own head (node style/city/mainland/relay.mjs)"; }
  pill.addEventListener('click', ev => { ev.stopPropagation(); if (ev.target.closest?.('.k')) { closeMenu(); return C.openBar(''); }   // (the ↵ CHAT chip opens the bar: the way in on a phone)
    if (status === 'offline') net.poke(); if (!menu.hidden && menu.dataset.k === 'who') return closeMenu(); openWho(); });

  // ── the menu: one player (mute / hide), or everyone here
  function closeMenu() { menu.hidden = true; menu.dataset.k = ''; }
  C.menuOpen = () => !menu.hidden; C.closeMenu = closeMenu;
  const place = (x, y) => { menu.hidden = false; const r = menu.getBoundingClientRect(); menu.style.left = clampN(x, 8, innerWidth - r.width - 8) + 'px'; menu.style.top = clampN(y, 8, innerHeight - r.height - 8) + 'px'; };
  function rowFor(sid) { const p = peers.get(sid), n = names.get(sid); if (!n) return null; const pid = n.pid, row = document.createElement('div'); row.className = 'row';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = '@' + n.name; row.appendChild(nm);
    const sb = document.createElement('span'); sb.className = 'sb'; sb.textContent = n.bot ? 'bot' : !p ? '' : p.mode === 2 ? 'inside' : p.mode === 1 ? (p.away ? 'away' : 'walking') : 'browsing'; row.appendChild(sb);
    for (const [k, set, on, off] of [['mute', mutes, 'unmute', 'mute'], ['hide', hides, 'show', 'hide']]) { const b = document.createElement('button'); b.textContent = set.has(pid) ? on : off; b.classList.toggle('on', set.has(pid));
      b.addEventListener('click', ev => { ev.stopPropagation(); if (set.has(pid)) set.delete(pid); else set.add(pid); saveSets(); applyHides(); b.textContent = set.has(pid) ? on : off; b.classList.toggle('on', set.has(pid)); refreshTag(sid); }); row.appendChild(b); }
    return row; }
  function openMenu(sid, x, y) { const n = names.get(sid); if (!n) return; menu.textContent = ''; menu.dataset.k = sid;
    const h = document.createElement('h4'); h.textContent = '@' + n.name; menu.appendChild(h); const r = rowFor(sid); r.querySelector('.nm').textContent = 'only for you:'; menu.appendChild(r);
    const x_ = document.createElement('button'); x_.className = 'x'; x_.textContent = 'close'; x_.addEventListener('click', closeMenu); menu.appendChild(x_); place(x + 8, y + 8); }
  function openWho() { menu.textContent = ''; menu.dataset.k = 'who'; const h = document.createElement('h4'); const list = [...names.keys()].filter(s => s !== me.sid && peers.get(s));
    h.textContent = status === 'online' ? `${list.length + 1} on the Mainland` : 'offline · solo'; menu.appendChild(h);
    if (status !== 'online') { const p = document.createElement('div'); p.className = 'row'; p.textContent = 'start the relay: node style/city/mainland/relay.mjs'; menu.appendChild(p); }
    const you = document.createElement('div'); you.className = 'row'; you.innerHTML = '<span class="nm"></span><span class="sb">you</span>'; you.querySelector('.nm').textContent = '@' + me.name; menu.appendChild(you);
    for (const sid of list) { const r = rowFor(sid); if (r) menu.appendChild(r); }
    const x_ = document.createElement('button'); x_.className = 'x'; x_.textContent = 'close'; x_.addEventListener('click', closeMenu); menu.appendChild(x_);
    const pr = pill.getBoundingClientRect(); place(pr.right - 300, pr.bottom + 8); menu.style.left = Math.max(8, pr.right - menu.getBoundingClientRect().width) + 'px'; }
  addEventListener('pointerdown', ev => { if (!menu.hidden && !menu.contains(ev.target) && ev.target !== pill && !pill.contains(ev.target)) closeMenu(); }, true);
  function applyHides() { for (const p of peers.all()) p.hidden = hides.has(p.pid); }

  // ── overhead: each peer's tag + bubble stack, and yours (bubbles only)
  const ents = new Map();   // sid | 'me' → { root, tag, stack, bubbles: [] }
  function ent(key) { let e = ents.get(key); if (e) return e; const root = document.createElement('div'); root.className = 'mlc-ent'; root.hidden = true; over.appendChild(root);
    const stack = document.createElement('div'); stack.className = 'mlc-stack'; root.appendChild(stack); e = { root, stack, tag: null, bubbles: [], key };
    if (key !== 'me') { e.tag = document.createElement('div'); e.tag.className = 'mlc-tag'; root.appendChild(e.tag); e.tag.addEventListener('click', ev => { ev.stopPropagation(); openMenu(key, ev.clientX, ev.clientY); }); refreshTag(key, e); }
    ents.set(key, e); return e; }
  function refreshTag(sid, e = ents.get(sid)) { if (!e || !e.tag) return; const n = names.get(sid), p = peers.get(sid); if (!n) return;
    const chips = []; if (n.bot) chips.push(['bot', 'bot']); if (p?.mode === 2) chips.push(['in', 'inside' + (p.addr ? ' · ' + p.addr : '')]); else if (p?.away) chips.push(['away', 'away']); if (mutes.has(n.pid)) chips.push(['muted', 'muted']);
    const key = n.name + '|' + chips.map(c => c[1]).join(','); if (e.tag.dataset.k === key) return; e.tag.dataset.k = key;
    e.tag.textContent = '@' + n.name; for (const [c, t] of chips) { const i = document.createElement('i'); i.className = c; i.textContent = t; e.tag.appendChild(i); }
    e.tag.classList.toggle('away', !!p?.away); }
  function dropEnt(key) { const e = ents.get(key); if (e) { e.root.remove(); ents.delete(key); } }

  // the bubble: the home-life bubble's body (bubbles.js body(): rows cut 2, 1 cells at the corners, the ink one cell down-right, the stepped
  // tail), sized to the text, the tail under its middle; the text is HTML over the pixel body so it stays crisp
  const cell = () => Math.max(2, Math.min(4, Math.round(Math.min(innerWidth * .75, innerHeight) / 300)));
  const CUT = [2, 1];
  function paint(cv, W, H, tail, S) { const ctx = cv.getContext('2d'); cv.width = W + 1; cv.height = H + 4; cv.style.width = (W + 1) * S + 'px'; cv.style.height = (H + 4) * S + 'px'; ctx.clearRect(0, 0, W + 1, H + 4);
    const cx = Math.max(0, Math.floor(W / 2) - 3);
    const shape = (dx, dy, c) => { ctx.fillStyle = c; for (let y = 0; y < H; y++) { const k = CUT[y] ?? CUT[H - 1 - y] ?? 0; ctx.fillRect(k + dx, y + dy, W - 2 * k, 1); }
      if (tail) { ctx.fillRect(cx + 3 + dx, H + dy, 4, 1); ctx.fillRect(cx + 2 + dx, H + 1 + dy, 3, 1); ctx.fillRect(cx + 1 + dx, H + 2 + dy, 2, 1); } };
    shape(1, 1, '#17171b'); shape(0, 0, '#f7f7f2'); return (cx + 1.5) * S; }
  function bubble(e, text, kind = 'say') {
    const S = cell(); meas.textContent = text; const r = meas.getBoundingClientRect(), tw = Math.ceil(r.width), th = Math.ceil(r.height);
    const W = Math.max(8, Math.ceil((tw + 16) / S)), H = Math.max(5, Math.ceil((th + 10) / S));
    const el = document.createElement('div'); el.className = 'mlc-b' + (kind === 'em' ? ' em' : ''); const inner = document.createElement('div'), cv = document.createElement('canvas'), sp = document.createElement('span');
    sp.textContent = text; sp.style.width = tw + 'px'; sp.style.left = Math.round((W * S - tw) / 2) + 'px'; sp.style.top = Math.round((H * S - th) / 2) + 'px';
    inner.appendChild(cv); inner.appendChild(sp); el.appendChild(inner);
    const b = { el, inner, cv, W, H, S, tail: null, life: Math.min(10, Math.max(4.5, 3.6 + text.length * .045)), t: 0, out: false };
    e.stack.appendChild(el); e.bubbles.unshift(b); while (e.bubbles.length > 3) kill(e, e.bubbles[e.bubbles.length - 1], true);
    restack(e); return b; }
  function kill(e, b, now = false) { if (b.out) return; b.out = true; b.el.classList.add('out'); const i = e.bubbles.indexOf(b); if (i >= 0) e.bubbles.splice(i, 1);
    setTimeout(() => b.el.remove(), now ? 0 : 260); restack(e); }
  function restack(e) { let y = 0; e.bubbles.forEach((b, k) => { const tail = k === 0; if (b.tail !== tail) { b.tail = tail; b.ax = paint(b.cv, b.W, b.H, tail, b.S); b.inner.style.setProperty('--ox', b.ax + 'px'); }
    const h = (b.H + (tail ? 4 : 1)) * b.S; b.el.style.transform = `translate(${Math.round(-b.W * b.S / 2)}px, ${-y + (tail ? 0 : 3 * b.S)}px)`; y += h + 4 - (tail ? 0 : 3 * b.S) + (tail ? 0 : 0); }); }
  function say(key, text, kind) { const e = ent(key); bubble(e, text, kind); }

  // ── the bar
  const chatB = bucket(RULES.chatBurst, RULES.chatEvery);
  C.openBar = (pre = '') => { if (!C.name && !C.as && !C.asked) { askHandle(() => C.openBar(pre)); return; }
    W()?.S?.keys?.clear(); if (document.pointerLockElement) document.exitPointerLock?.();
    bar.hidden = false; C.open = true; document.body.classList.add('mlc-typing'); C.input.value = pre; C.input.focus(); wake(); net.poke(); };
  C.close = () => { bar.hidden = true; C.open = false; document.body.classList.remove('mlc-typing'); C.input.blur(); wake(); };
  C.input.addEventListener('blur', () => { if (C.open) setTimeout(() => { if (document.activeElement !== C.input && C.open) C.close(); }, 0); });
  C.submit = () => { const raw = C.input.value; C.input.value = ''; C.close(); const text = raw.trim(); if (!text) return;
    if (text[0] === '/') return command(text.slice(1));
    const clean = cleanText(text); if (!clean) return;
    if (!chatB.take()) return logLine('warn', '', 'slow down: one line every couple of seconds');
    if (net.ok()) net.send({ t: 'c', m: clean }); else { say('me', clean); logLine('chat', me.name, clean, 'me'); } };
  function command(c) { const [cmd, ...rest] = c.trim().split(/\s+/), arg = rest.join(' ');
    if (RULES.emotes.includes(cmd)) { if (net.ok()) net.send({ t: 'e', e: cmd }); else onEmote('me', cmd); return; }
    if (cmd === 'name' || cmd === 'nick') { const n = cleanName(arg); if (!n) return logLine('warn', '', "that handle won't work: 2–16 letters, numbers, _ . -"); setName(n); return; }
    if (cmd === 'who') { openWho(); return; }
    logLine('sys', '', 'say something with Enter · /wave /dap /dance · /name <handle> · /who · click a tag to mute or hide'); }

  // ── the handle prompt (the first walk or chat): stored; skip keeps "guest" and asks again next visit
  let after = null;
  function askHandle(then) { if (!prompt.hidden) return; after = then || null; W()?.S?.keys?.clear(); if (document.pointerLockElement) document.exitPointerLock?.();
    prompt.hidden = false; C.nameInput.value = C.name || ''; prompt.querySelector('.why').textContent = ''; setTimeout(() => C.nameInput.focus(), 0); }
  C.savePrompt = () => { const n = cleanName(C.nameInput.value); if (!n) { prompt.querySelector('.why').textContent = '2–16 letters, numbers, _ . - (and nothing rude)'; return; }
    setName(n); store.set('ml.asked', '1'); C.asked = true; prompt.hidden = true; C.nameInput.blur(); const f = after; after = null; f?.(); };
  C.skipPrompt = () => { store.set('ml.asked', '1'); C.asked = true; prompt.hidden = true; C.nameInput.blur(); const f = after; after = null; f?.(); };
  prompt.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); C.savePrompt(); });
  prompt.querySelector('.skip').addEventListener('click', () => C.skipPrompt());
  function setName(n) { C.name = n; me.name = n; if (!C.as) store.set('ml.handle', n); if (net.ok()) net.send({ t: 'n', n }); }

  // ── the relay
  const relayQ = Q.get('relay'), URL_ = relayQ === 'off' ? null : relayQ || `ws://${location.hostname || '127.0.0.1'}:5460/mainland`;
  const net = (() => { let ws = null, welcomed = false, tries = 0, timer = 0;
    const api = { ok: () => !!ws && ws.readyState === 1 && welcomed, send: o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }, url: URL_, retry: () => { clearTimeout(timer); open(); } };
    function setStatus(s) { status = s; setPill(); }
    function open() { if (!URL_ || ws) return; setStatus('connecting');
      try { ws = new WebSocket(URL_); } catch { ws = null; return later(); }
      ws.onopen = () => { tries = 0; wasUp = true; ws.send(JSON.stringify({ t: 'hello', v: 1, pid: C.pid, name: C.name || '', look: me.look })); };
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === 'welcome') welcomed = true; onMsg(m); };
      ws.onclose = () => { const was = welcomed; ws = null; welcomed = false; for (const p of peers.all()) { peers.remove(p.sid); } for (const k of [...ents.keys()]) if (k !== 'me') dropEnt(k);
        names.clear(); me.sid = null; setStatus('offline'); if (was) logLine('sys', '', 'lost the relay: solo for now'); later(); };
      ws.onerror = () => {}; }
    // (a refused socket prints a network line in the console, so offline retries are few: 15 s and 60 s after the first try, then
    // only when you open the chat or click the pill; a relay that drops after working is retried 5 / 15 / 30 / 60 s on)
    let wasUp = false;
    function later() { const plan = wasUp ? [5, 15, 30, 60, 60, 60] : [15, 60]; if (tries >= plan.length) return; const wait = plan[tries++] * 1000; clearTimeout(timer); timer = setTimeout(open, wait); }
    api.poke = () => { if (!ws && URL_ && (!api.lastPoke || performance.now() - api.lastPoke > 10000)) { api.lastPoke = performance.now(); clearTimeout(timer); open(); } };
    api.open = open; return api; })();

  function onMsg(m) {
    if (m.t === 'welcome') { me.sid = m.you; me.name = m.name; if (!C.name) C.name = ''; names.set(me.sid, { name: me.name, pid: C.pid }); status = 'online';
      for (const p of m.peers || []) join(p, true);
      for (const l of m.hist || []) logLine('chat', l.n, l.m, null, true);
      logLine('sys', '', (m.peers?.length ? `${m.peers.length} here already` : 'nobody else here yet') + ' · Enter to chat'); setPill(); return; }
    if (m.t === 'j') { join(m); logLine('sys', '', `@${m.n} ${m.bot ? '(bot) ' : ''}is here`); setPill(); return; }
    if (m.t === 'l') { const n = names.get(m.i); peers.remove(m.i); const e = ents.get(m.i); if (e) { e.root.style.transition = 'opacity .35s'; e.root.style.opacity = 0; setTimeout(() => dropEnt(m.i), 380); }
      if (n) logLine('sys', '', `@${n.name} left`); names.delete(m.i); setTimeout(setPill, 400); return; }
    if (m.t === 'S') { for (const s of m.a || []) { if (s.i === me.sid) continue; const p = peers.get(s.i); if (!p) continue; const was = p.mode + '|' + p.away + '|' + p.addr; peers.state(s.i, s); if (was !== p.mode + '|' + p.away + '|' + p.addr) refreshTag(s.i); } return; }
    if (m.t === 'c') { const mine = m.i === me.sid, n = names.get(m.i); if (!mine && n && mutes.has(n.pid)) return;
      say(mine ? 'me' : m.i, m.m); logLine('chat', mine ? me.name : n?.name ?? m.n, m.m, mine ? 'me' : m.i); return; }
    if (m.t === 'e') { onEmote(m.i === me.sid ? 'me' : m.i, m.e); return; }
    if (m.t === 'n') { const n = names.get(m.i); if (!n) return; const old = n.name; n.name = m.n; if (m.i === me.sid) { me.name = m.n; } else refreshTag(m.i); logLine('sys', '', `@${old} is now @${m.n}`); return; }
    if (m.t === 'w') { logLine('warn', '', m.m); return; }
  }
  function join(info, quiet) { names.set(info.i, { name: info.n, pid: info.pid, bot: !!info.bot }); const p = peers.add(info); p.hidden = hides.has(info.pid); ent(info.i); refreshTag(info.i); }
  function onEmote(key, e) { const txt = EMOTE_TXT[e]; if (!txt) return; const n = key === 'me' ? me.name : names.get(key)?.name;
    if (key !== 'me') { const nn = names.get(key); if (nn && mutes.has(nn.pid)) return; peers.emote(key, e); } else C.myEmote = { e, t: 0, dur: e === 'dance' ? 6 : e === 'wave' ? 3.2 : 2.4 };
    say(key, '*' + txt + '*', 'em'); logLine('sys', '', `@${n || '?'} ${txt}`); }
  // your own emote, on walk.js's gait (ML.onGait: after its stride, before the anim texture is written)
  const IDL = { wave: 5, dap: 2, dance: 6 };
  C.onGait = (g, dt, S) => { const E = C.myEmote; if (!E) return; E.t += dt; const moving = Math.hypot(S.vel.x, S.vel.y) > .3 || !S.ground;
    if (E.t > E.dur || moving) { C.myEmote = null; return; } g.idle = IDL[E.e]; g.wasStill = true; g.still = Math.max(g.still, .4);
    if (E.e === 'dance') g.py += Math.abs(Math.sin(E.t * Math.PI * 2.2)) * .035; };

  // ── presence out: 10 Hz on the street, 1 Hz otherwise (a timer, so it keeps going while the interior overlay pauses the page)
  let tick = 0;
  setInterval(() => { if (!net.ok()) return; tick++; const w = W(), S = w?.S, away = (!C.inside && document.hidden) || performance.now() - C.lastInput > 90e3;   // (inside: the overlay can read as hidden; idleness only)
    let st;
    if (w?.on && S && !S.inside) st = { t: 's', k: Math.round(performance.now()), m: 1, x: +S.vis.x.toFixed(3), y: +S.vis.y.toFixed(3), z: +S.vis.z.toFixed(3), r: +S.body.toFixed(3), g: S.ground ? 1 : 0, j: S.jumping ? 1 : 0, a: away ? 1 : 0 };
    else if (w?.on && S?.inside && S.back) { if (tick % 10) return; st = { t: 's', k: Math.round(performance.now()), m: 2, d: [S.back.x, S.back.z], h: S.back.addr || '', a: away ? 1 : 0 }; }
    else { if (tick % 10) return; st = { t: 's', k: Math.round(performance.now()), m: 0, a: away ? 1 : 0 }; }
    net.send(st); }, 1000 / RULES.stateHz);

  // ── per frame: the peers, then every tag and bubble placed over its head (css px), faded with distance
  const V = new THREE.Vector3(), BOX = new THREE.Box3(); let lastT = 0, myTall = 0;
  function frame(t) {
    const dt = lastT ? Math.min(.1, (t - lastT) / 1000) : 0; lastT = t; const now = performance.now();
    peers.update(dt, now);
    if (logEl.classList.contains('idle') === false && !C.open && now - logT > 10000) logEl.classList.add('idle');
    const w = W(), walking = !!(w?.on && !w.S.inside), Wd = innerWidth, Hd = innerHeight;
    if (walking && !C.name && !C.as && !C.asked && prompt.hidden && !C.open) askHandle();
    // (nearer heads draw on top, and further ones a little smaller: a crowd's bubbles read front to back)
    const show = (e, x, y, z, lift, alpha) => { const d = camera.position.distanceTo(V.set(x, y, z)); V.project(camera); if (V.z > 1 || V.z < -1) { e.root.hidden = true; return; }
      const sx = (V.x + 1) / 2 * Wd, sy = (1 - V.y) / 2 * Hd; if (sx < -200 || sx > Wd + 200 || sy < -200 || sy > Hd + 400) { e.root.hidden = true; return; }
      const k = clampN(1.12 - d / 45, .62, 1);
      e.root.hidden = false; e.root.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) scale(${k.toFixed(3)})`; e.root.style.opacity = alpha;
      e.root.style.zIndex = e.key === 'me' ? 1000 : Math.max(1, 999 - Math.round(d * 4)); e.stack.style.transform = `translateY(${-lift}px)`; };
    for (const e of ents.values()) {
      for (const b of [...e.bubbles]) { b.t += dt; if (b.t > b.life) kill(e, b); }
      if (e.key === 'me') { if (!walking || !w.S) { e.root.hidden = true; continue; }
        if (!myTall) { const you = scene.getObjectByName('walk:you'); try { myTall = you ? you.getBoundingBoxAt(0, BOX).max.y : 1.75; } catch { myTall = 1.75; } }
        if (!e.bubbles.length) { e.root.hidden = true; continue; } const s = w.S.vis; show(e, s.x, s.y + myTall + .1, s.z, 6, 1); continue; }
      const p = peers.get(e.key); if (!p || p.hidden) { e.root.hidden = true; continue; }
      let x, y, z;
      if (p.mode === 1 && p.shown) { x = p.head.x; y = p.head.y; z = p.head.z; }
      else if (p.mode === 2 && p.door) { x = p.door[0]; z = p.door[1]; y = (window.__walk?.grid?.()?.floorAt(x, z, 3) ?? LAWN) + 2.3; }
      else { e.root.hidden = true; continue; }
      const d = camera.position.distanceTo(V.set(x, y, z)), a = d < 40 ? 1 : d > 70 ? 0 : 1 - (d - 40) / 30;
      if (a <= 0) { e.root.hidden = true; continue; }
      show(e, x, y, z, (e.tag?.offsetHeight || 18) + 6, (p.fade < 1 ? Math.max(.2, p.fade) : 1) * a);
    }
  }
  FRAME.push(frame);

  addEventListener('ml:inside', () => { C.inside = true; if (C.open) C.close(); closeMenu(); over.hidden = logEl.hidden = pill.hidden = true; });
  addEventListener('ml:outside', () => { C.inside = false; over.hidden = logEl.hidden = pill.hidden = false; });
  C.ready = true; setPill(); net.open();
  // tools and tests: window.__chat
  const api = { peers, net, me, status: () => status, say: text => { C.input.value = text; C.submit(); }, open: C.openBar, close: () => C.close(), emote: e => command(e),
    ents: () => [...ents.entries()].map(([k, e]) => ({ k, hidden: e.root.hidden, op: e.root.style.opacity, bubbles: e.bubbles.map(b => b.el.textContent), tag: e.tag?.textContent ?? null, rect: e.root.hidden ? null : e.root.getBoundingClientRect().toJSON() })),
    log: () => [...logEl.children].map(l => l.textContent), mutes, hides, names, name: setName, idle: () => performance.now() - C.lastInput };
  window.__chat = api; return api;
}
function clampN(x, a, b) { return Math.max(a, Math.min(b, x)); }
