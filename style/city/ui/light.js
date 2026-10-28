// TAPE · LIGHT (2026-10-09). The page is built for day or night (lit windows and signs per voxel: main.js ?tod=night). In LIVE,
// simstate/live.js reloads into the sim's build at 20:00 and 06:00; TAPE holds that reload off, so the tape's time of day and the
// build's can differ. Two answers, both mounted here (ui/index.js), nothing in ui/tape/:
//   A · THE GRADE   every frame k eases (TAU s) toward api.grade.amountAt(the tape time): 0 while the tape's time of day is the
//                   build's, in LIVE and while TAPE has no moment; night on a day build, day on a night build, coming in over the
//                   panel's `dusk` game minutes after 20:00 / 06:00, so playing or scrubbing through dusk and dawn blends. No reload, no
//                   recompile: render/grade.js
//   B · RELOAD TO LIGHT   while the tape's time of day is not the build's, a chip over the transport, "Light it as night (~N s)" or
//                   "…as day" (N: this page's own load time, as the other build's will be about that): the page reloads into the
//                   matching build where the camera is (?tod=night or day, the camera in ?cam/look/fov, a link's openers dropped), and
//                   ui/reload.js ('simlive:reload') puts TAPE back at its minute (agent, speed, playing) with the dossier, follow, panel
//                   and heat map. Until TAPE is back the new page must not reload itself into the LIVE sim's build (live.js reloads when
//                   the sim's day / night is not the page's): the chip stamps live.js's own loop guard (sessionStorage
//                   'simlive-reload', 15 s) holdMs ahead, and the new page, once TAPE is open again, sets it to now (TAPE keeps it
//                   fresh from there, and Back to LIVE lets the reload come as always); TAPE not back within holdMs: the guard expires.
import { h, button, toast } from './kit.js';
import { tape } from './tape/state.js';

export const LIGHT_RELOAD = { key: 'aicity.ui.light-reload', guard: 'simlive-reload', holdMs: 60000, tau: .25 };
const MOON = '<path d="M10.8 2.2a5.8 5.8 0 1 0 3 9.9A6.2 6.2 0 0 1 10.8 2.2z" fill="currentColor"/>';
const SUN = '<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';
const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = d; return s; };

export function mountLight(api, { root }) {
  const G = api.grade, NIGHT = G ? G.night : new URLSearchParams(location.search).get('tod') === 'night', B = { reloads: 0, restoredMs: null, loadS: null };
  let k = 0, chip = null, chipNight = null, placedAt = 0, forced = null;
  // ── this page's own load time (the chip's "~N s": the other build loads about as long — from the bake ~5 s, built live much longer)
  const secs = () => Math.max(3, Math.round(performance.now() / 1000));
  if (!api.loading) B.loadS = secs(); else addEventListener('city:loading', e => { if (e.detail?.phase === 'done' && B.loadS === null) B.loadS = secs(); });
  const loadS = () => B.loadS ?? secs();
  // ── B, the new page: hold live.js's reload until TAPE is back
  let pend = null; try { pend = JSON.parse(sessionStorage.getItem(LIGHT_RELOAD.key) || 'null'); sessionStorage.removeItem(LIGHT_RELOAD.key); } catch { pend = null; }
  if (pend && Date.now() - pend.at < LIGHT_RELOAD.holdMs) {
    const done = () => { off(); clearTimeout(tm); B.restoredMs = Date.now() - pend.at; try { sessionStorage.setItem(LIGHT_RELOAD.guard, String(Date.now())); } catch {} };
    const off = tape.on('mode', m => { if (m.active) done(); });
    const tm = setTimeout(() => { off(); try { sessionStorage.setItem(LIGHT_RELOAD.guard, String(Date.now() - 15000)); } catch {} }, Math.max(0, pend.at + LIGHT_RELOAD.holdMs - Date.now()));
    B.pending = { night: pend.night, t: pend.t };
    if (api.loading) addEventListener('city:loading', e => { if (e.detail?.phase === 'done' && B.litMs == null) B.litMs = Date.now() - pend.at; }); else B.litMs = Date.now() - pend.at;   // (click → this page's city up)
  }
  // ── B, the chip
  function relight() {
    const night = !NIGHT, t = tape.time(); if (t === null) return;
    try { dispatchEvent(new Event('simlive:reload')); } catch {}   // (ui/reload.js keeps the UI, TAPE at its minute among it)
    try { sessionStorage.setItem(LIGHT_RELOAD.key, JSON.stringify({ v: 1, at: Date.now(), night, t })); sessionStorage.setItem(LIGHT_RELOAD.guard, String(Date.now() + LIGHT_RELOAD.holdMs)); } catch {}
    const u = new URL(location.href), cam = api.camera, ctl = api.controls, r = x => +x.toFixed(2);
    u.searchParams.set('tod', night ? 'night' : 'day');
    for (const q of ['tape', 'tapeat', 'tapeagent', 'tapeplay', 'people', 'home', 'view']) u.searchParams.delete(q);   // (a link's one-time openers, as live.js drops them)
    if (cam && ctl) { u.searchParams.set('cam', [cam.position.x, cam.position.y, cam.position.z].map(r).join(',')); u.searchParams.set('look', [ctl.target.x, ctl.target.y, ctl.target.z].map(r).join(',')); u.searchParams.set('fov', String(r(cam.fov))); }
    B.reloads++; toast(night ? 'Lighting it as night…' : 'Lighting it as day…'); setTimeout(() => location.replace(u.href), 60);
  }
  function ensureChip() { if (chip) return chip;
    if (!document.querySelector('style[data-lt-css]')) document.head.append(h('style', { 'data-lt-css': '' }, `#k .lt-relight { position: absolute; right: 16px; bottom: 200px; display: flex; padding: 4px; border-radius: var(--k-r2); background: var(--k-bg);
  -webkit-backdrop-filter: var(--k-blur); backdrop-filter: var(--k-blur); box-shadow: var(--k-shadow-s); pointer-events: auto; }
#k .lt-relight[hidden] { display: none; } #k .lt-relight .k-btn { min-height: 28px; padding: 0 10px; } #k .lt-relight svg { width: 14px; height: 14px; }
#k[data-skin="zte"] .lt-relight { border-radius: 0; background: var(--zt-grid), var(--zt-bone); box-shadow: 4px 4px 0 var(--zt-ink); }`));
    const b = button('Light it', { tip: 'Reload into the build lit for the tape’s time of day: TAPE comes back at this minute', onclick: relight });
    chip = h('div', { class: 'lt-relight', hidden: '' }, b); chip.btn = b; root.append(chip); return chip; }
  function showChip(night) { const c = ensureChip();
    if (night !== chipNight) { chipNight = night; c.btn.replaceChildren(svg(night ? MOON : SUN), h('span', { class: 'k-btn-label' }, `Light it as ${night ? 'night' : 'day'} (~${loadS()} s)`)); }
    if (c.hidden) c.hidden = false;
    const now = performance.now(); if (now - placedAt > 300) { placedAt = now; const bar = root.querySelector('.tp-bar.is-on');   // (over the transport's right end)
      if (bar) { const r = bar.getBoundingClientRect(); c.style.bottom = Math.round(innerHeight - r.top + 8) + 'px'; c.style.right = Math.round(innerWidth - r.right) + 'px'; } } }
  const hideChip = () => { if (chip && !chip.hidden) chip.hidden = true; };
  // ── per frame (ui/index.js frame)
  function frame(dt) {
    const t = tape.active ? tape.time() : null, c = t === null ? null : tape.clock(t);
    if (G) { const want = forced ?? (t === null ? 0 : G.amountAt(t)); k += (want - k) * (1 - Math.exp(-Math.max(0, dt) / LIGHT_RELOAD.tau)); if (Math.abs(want - k) < .002) k = want; G.set(k); }
    if (c && c.night !== NIGHT) showChip(c.night); else hideChip();
  }
  const out = { frame, relight, get k() { return k; }, force(x = null) { forced = x === null ? null : Math.max(0, Math.min(1, +x)); },   // (force: a measuring / preview switch: k eases to x whatever the tape says; null: the tape again)
    stats: () => ({ k: +k.toFixed(3), build: NIGHT ? 'night' : 'day', chip: !!chip && !chip.hidden, ...B, grade: G?.stats() ?? null }) };
  return out;
}
