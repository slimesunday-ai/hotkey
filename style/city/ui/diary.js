// HUMAN LAYER · SECTION 2b · THE DIARY ROOM: per agent per game day, a short confession — that day's thoughts and the lines it said —
// framed like a reality-TV confessional shot on a camcorder in '98:
//   title card   "DAY 3 · DIARY", the handle, a beat, a cut
//   the shot     a close-up of the agent in its real look (ui/portrait.js: the same sprite sheet the dossier turns, front cells), in the
//                diary-room chair against the wall, with a slow handheld drift and a push-in on each line
//   captions     typed out line by line, a timecode and what it was (THINKING · SAID · DM → @x) on each; the red REC dot, the tape's
//                timecode, scanlines and a little tape noise over it all
//   short        ≤ 7 lines (ui/diary-data.js picks them), ~3 s a line; → or a click skips a line, ← goes back, Esc closes, [ ] other days
// The lens (it is all private): TAPE for everyone — only a day behind the horizon, a day not on tape yet shows "pending" with the
// time it reaches the tape, a day the horizon cuts through shows up to the horizon · YOURS live for your own agent (?as=) · ARCHIVE
// everything. Data from sim.tape.get (clamped by the server) and, for your own agent, sim.agent(h).mine.myEvents; diary-data.js
// clamps again (ui/tools/diarycheck.mjs checks it).
// It draws on its own small canvas (960 × 540, ≤ 30 fps, only while open), never on the city's: the city keeps its frame. Save clip
// plays the diary from the title to the end into a webm (ui/clip.js recorder on the same canvas).
import { h, set, attr, button, lens as lensBadge, toast, getRoot, onSkinChange, keysFirst, trapTab } from './kit.js';
import { diaryOf, opensAt, DAY } from './diary-data.js';
import { recorder, download, stamp, wrap } from './clip.js';

const W = 960, H = 540, FPS = 30, TITLE = 1.5, GAP = .35, CPS = 38;
const css = () => { if (!document.querySelector('link[data-diary-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./diary.css', import.meta.url).href, 'data-diary-css': '' })); };
const pad = n => String(n).padStart(2, '0'), hm = t => `${pad(Math.floor(((t % DAY) + DAY) % DAY / 60))}:${pad(Math.floor(t % 60))}`, stampOf = t => `D${Math.floor(t / DAY) + 1} ${hm(t)}`;

export function createDiary({ sim, portraits }) {
  css();
  const root = getRoot();
  let open = false, handle = null, day = 1, entry = null, sheet = null, raf = 0, t0 = 0, clock = 0, idx = -1, lastDraw = 0, rec = null, gen = 0, lastFocus = null, onClose = () => {};
  const cv = h('canvas', { width: W, height: H, class: 'dy-cv', 'aria-hidden': 'true' }), g = cv.getContext('2d');
  // ── the room (DOM): the screen, the caption for screen readers, the controls
  const sr = h('div', { class: 'dy-sr', 'aria-live': 'polite' }), badge = lensBadge('tape'), title = h('h2', { class: 'dy-title', id: 'dy-title' });
  const prevB = button('', { icon: 'tapeplay', tip: 'The day before ([)', cls: 'dy-prev', onclick: () => go(day - 1) }), nextB = button('', { icon: 'tapeplay', tip: 'The day after (])', cls: 'dy-next', onclick: () => go(day + 1) });
  const skipB = button('Skip', { kbd: '→', tip: 'Next line (→)', onclick: () => skip(1) }), againB = button('Again', { tip: 'From the top', onclick: () => restart() });
  const saveB = button('Save clip', { tip: 'Save this diary as a webm', onclick: () => saveClip() }), xB = button('', { icon: 'close', tip: 'Close (Esc)', cls: 'dy-x', onclick: () => close() });
  const bar = h('div', { class: 'dy-bar' }, prevB, h('div', { class: 'dy-mid' }, title, badge), nextB, h('span', { class: 'dy-sp' }), skipB, againB, saveB, xB);
  const screen = h('div', { class: 'dy-screen' }, cv);
  const room = h('section', { class: 'dy-room', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dy-title', hidden: true }, h('div', { class: 'dy-box' }, screen, bar, sr));
  room.addEventListener('pointerdown', e => { if (e.target === room) close(); });
  cv.addEventListener('click', () => skip(1));
  root.append(room);
  // ── tokens → the canvas (read once per open and on a skin change)
  let T = null;
  const readTokens = () => { const cs = getComputedStyle(root), v = (k, d) => cs.getPropertyValue(k).trim() || d;
    T = { wall: v('--d-wall', '#3a1450'), wall2: v('--d-wall-2', '#24093a'), chair: v('--d-chair', '#ff3d6e'), chair2: v('--d-chair-2', '#b8124a'), rec: v('--d-rec', '#ff2b2b'), osd: v('--d-osd', '#f4f4ea'),
      cap: v('--d-cap-bg', 'rgba(8,8,12,.78)'), capInk: v('--d-cap-ink', '#fff'), think: v('--d-think', '#ffd84d'), say: v('--d-say', '#7fe7ff'), dm: v('--d-dm', '#ff8ad8'),
      disp: v('--k-font-display', 'monospace'), mono: v('--k-font-mono', 'monospace'), body: v('--k-font', 'sans-serif'), tape: v('--k-tape', '#ffb62e'), live: v('--k-live', '#52ff86'), yours: v('--k-yours', '#ff6ad5'), archive: v('--k-archive', '#a4b6cc') }; };
  onSkinChange(() => requestAnimationFrame(() => { if (open) readTokens(); }));
  // pre-rendered noise + scanlines (once)
  const noise = document.createElement('canvas'); noise.width = 256; noise.height = 256; { const ng = noise.getContext('2d'), id = ng.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } ng.putImageData(id, 0, 0); }
  const scan = document.createElement('canvas'); scan.width = 4; scan.height = 4; { const sg = scan.getContext('2d'); sg.fillStyle = 'rgba(0,0,0,.28)'; sg.fillRect(0, 0, 4, 1); sg.fillStyle = 'rgba(0,0,0,.08)'; sg.fillRect(0, 2, 4, 1); }
  // ── the lens of a diary
  const lensOf = h2 => sim.lens === 'archive' ? 'archive' : h2 === sim.me && sim.agent(h2)?.mine ? 'yours' : 'tape';
  function defaultDay(h2) { const now = sim.clock()?.t ?? 0, L = lensOf(h2); if (L !== 'tape') return Math.floor(now / DAY) + 1;
    const hz = sim.tape.horizon; if (hz == null) return Math.floor(now / DAY) + 1; const d = Math.floor(hz / DAY) + 1; return hz >= d * DAY - 1 ? d : Math.max(1, d - 1); }
  // ── load one day: the entry + the plan of the clip (when each line starts and ends)
  async function load() {
    const my = ++gen, L = lensOf(handle), t1 = day * DAY - 1, t0d = (day - 1) * DAY, hz = sim.tape.horizon, now = sim.clock()?.t ?? 0;
    entry = { handle, day, lens: L, state: 'loading', lines: [] }; restart(); syncBar();
    let evs = [];
    try {
      if (L === 'archive') evs = (await sim.tape.get(t0d, t1, { handle, snaps: false })).events;
      else if (L === 'tape') { if (hz != null && hz >= t0d) evs = (await sim.tape.get(t0d, Math.min(t1, hz), { handle, snaps: false })).events; }
      else { const mine = sim.agent(handle)?.mine?.myEvents || []; const tp = hz != null && hz >= t0d ? (await sim.tape.get(t0d, Math.min(t1, hz), { handle, snaps: false }).catch(() => ({ events: [] }))).events : [];
        const ids = new Set(tp.map(e => e.id)); evs = [...tp, ...mine.filter(e => !ids.has(e.id))]; }
    } catch (e) { if (my === gen) { entry = { handle, day, lens: L, state: 'error', error: String(e.message || e), lines: [] }; restart(); syncBar(); } return; }
    if (my !== gen) return;
    entry = diaryOf(evs, handle, day, { lens: L, horizon: hz, now });
    if (entry.state === 'pending' && L === 'tape') entry.opens = opensAt(day, sim.tape.delay ?? DAY);
    let t = TITLE + GAP; for (const l of entry.lines) { l.at = t; l.type = Math.max(.7, l.text.length / CPS); l.hold = 1.2 + l.text.length / 95; t += l.type + l.hold + GAP; } entry.dur = t + .8;
    restart(); syncBar(); set(sr, entry.lines.map(l => `${hm(l.t)} ${l.kind === 'think' ? 'thinking' : 'said'}: ${l.text}`).join(' · '));
  }
  // ── open / close / days
  async function show(h2, { day: d = null } = {}) {
    if (!h2) return; handle = h2; day = d ?? defaultDay(h2); if (!open) { open = true; lastFocus = document.activeElement; room.hidden = false; requestAnimationFrame(() => room.classList.add('is-open')); readTokens(); loop(); }
    sheet = null; portraits.sheet(h2, sim.agent(h2)?.live?.status === 'jail').then(s => { if (handle === h2) sheet = s; }).catch(() => {});
    await document.fonts?.load?.(`40px ${getComputedStyle(root).getPropertyValue('--k-font-display').trim() || 'monospace'}`).catch(() => {});
    load(); skipB.focus({ preventScroll: true });
  }
  function close() { if (!open) return; open = false; gen++; cancelAnimationFrame(raf); raf = 0; room.classList.remove('is-open'); room.hidden = true; if (rec) { rec.R.stop(); rec = null; }
    try { lastFocus?.focus?.({ preventScroll: true }); } catch {} onClose(); }
  function go(d) { const max = Math.floor((sim.clock()?.t ?? 0) / DAY) + 1; if (d < 1 || d > max) return; day = d; load(); }
  function restart() { t0 = performance.now(); clock = 0; idx = -1; }
  function skip(dir) { clock = (performance.now() - t0) / 1000; if (!entry?.lines?.length) { if (dir > 0 && clock < TITLE) { t0 -= (TITLE - clock) * 1000; } return; }
    const L = entry.lines, cur = L.findIndex(l => clock >= l.at && clock < l.at + l.type + l.hold + GAP);
    if (dir > 0) { if (clock < TITLE + GAP) { t0 -= (L[0].at - clock) * 1000; return; } if (cur >= 0 && clock < L[cur].at + L[cur].type) { t0 -= (L[cur].at + L[cur].type - clock) * 1000; return; }
      const n = L[cur + 1]; if (n) t0 -= (n.at - clock) * 1000; else t0 -= (entry.dur - clock) * 1000; }
    else { const p = L[Math.max(0, (cur < 0 ? L.length : cur) - 1)]; t0 += (clock - p.at) * 1000; } }
  function syncBar() {
    const L = entry?.lens || lensOf(handle), max = Math.floor((sim.clock()?.t ?? 0) / DAY) + 1;
    set(title, `@${handle} · Day ${day}`); attr(prevB, 'aria-disabled', day <= 1 ? 'true' : null); attr(nextB, 'aria-disabled', day >= max ? 'true' : null);
    badge.update(L, L === 'tape' ? (entry?.state === 'pending' ? 'on tape tomorrow' : entry?.state === 'partial' ? 'up to ' + stampOf(entry.upTo) : sim.tape.horizon != null ? 'as of ' + stampOf(sim.tape.horizon) : '') : '');
    attr(saveB, 'aria-disabled', entry?.lines?.length ? null : 'true'); attr(skipB, 'aria-disabled', entry?.lines?.length ? null : 'true');
  }
  // ── the frame
  function loop() { raf = requestAnimationFrame(loop); const now = performance.now(); if (!rec && now - lastDraw < 1000 / FPS - 2) return; lastDraw = now; clock = (now - t0) / 1000; try { draw(clock); } catch (e) { if (!loop.failed) { loop.failed = true; console.error('[diary]', e); } } }
  function draw(c) {
    if (!T) readTokens(); const E = entry, osdT = performance.now() / 1000;
    if (!E || E.state === 'loading') { card('LOADING TAPE…', '', c, true); return osd(c, null); }
    if (E.state === 'pending') { card(`DAY ${E.day} · DIARY`, `ON TAPE TOMORROW`, c, true, E.opens != null ? `reaches the tape at ${stampOf(E.opens)}` : 'the tape is a game day behind'); return osd(c, null); }
    if (E.state === 'error') { card('NO SIGNAL', E.error || '', c, true); return osd(c, null); }
    if (c < TITLE) { card(`DAY ${E.day} · DIARY`, '@' + E.handle, c, false, E.lines.length ? (E.state === 'partial' ? `on tape up to ${hm(E.upTo)} · the rest is pending` : '') : 'nothing on tape for this day'); flash(c, TITLE - .08, .08); return osd(c, null); }
    // the shot
    const L = E.lines, k = L.findIndex(l => c >= l.at && c < l.at + l.type + l.hold + GAP), line = k >= 0 ? L[k] : null, prev = k > 0 ? L[k - 1] : null;
    shot(c, line);
    if (!L.length) { lower('They kept it to themselves.', 'NOTHING ON TAPE', T.osd, null, 1); }
    else if (line) { const n = Math.floor(Math.max(0, Math.min(1, (c - line.at) / line.type)) * line.text.length); lower(line.text.slice(0, n), tagOf(line), colOf(line), line.t, 1, n < line.text.length, prev ? prev.text : null); }
    else if (c >= E.dur - .8) { endCard(c); }
    flash(c, TITLE, .1); osd(c, line ? line.t : null);
  }
  const tagOf = l => l.kind === 'think' ? 'THINKING' : l.kind === 'dm' ? `DM → @${l.to}` : 'SAID';
  const colOf = l => l.kind === 'think' ? T.think : l.kind === 'dm' ? T.dm : T.say;
  function wall() {
    const gr = g.createRadialGradient(W * .42, H * .38, 30, W * .5, H * .5, W * .75); gr.addColorStop(0, T.wall); gr.addColorStop(1, T.wall2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalAlpha = .18; g.strokeStyle = '#000'; g.lineWidth = 3; for (let x = 40; x < W; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } g.globalAlpha = 1;
  }
  function shot(c, line) {
    const drift = Math.sin(c * .7) * 6 + Math.sin(c * 1.9) * 2, bob = Math.cos(c * .9) * 4, push = line ? 1 + Math.min(1, (c - line.at) / 3) * .035 : 1;
    g.save(); g.translate(W / 2, H / 2); g.scale(push, push); g.translate(-W / 2 + drift, -H / 2 + bob);
    wall();
    // the chair: a big round back, two arms (the diary-room chair)
    const cx = W * .40, cy = H * .60; rr(cx - 215, cy - 250, 430, 560, 150, T.chair2); rr(cx - 195, cy - 232, 390, 540, 136, T.chair);   // (a wingback: the back, its tufting, the arms)
    g.fillStyle = T.chair2; for (let r = 0; r < 3; r++) for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(cx + k * 64 + (r % 2) * 32, cy - 170 + r * 62, 5, 0, Math.PI * 2); g.fill(); }
    rr(cx - 285, cy + 50, 120, 280, 54, T.chair2); rr(cx + 165, cy + 50, 120, 280, 54, T.chair2);
    // the agent: the front cells of its portrait sheet, head and shoulders, with a slow sway between them
    if (sheet) { const cw = sheet.width / 16, chh = sheet.height, cell = [0, 1, 2, 1][Math.floor(c * 1.1) % 4], sy = chh * .02, sh = chh * .7, scale = H * .9 / sh;
      g.imageSmoothingEnabled = true; g.drawImage(sheet, cell * cw, sy, cw, sh, cx - cw * scale / 2, H - sh * scale + 24, cw * scale, sh * scale); }
    else { g.fillStyle = 'rgba(0,0,0,.35)'; ell(cx, H * .62, 120, 170); }
    // the spotlight falloff
    const v = g.createRadialGradient(cx, H * .45, H * .25, cx, H * .5, W * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(-20, -20, W + 40, H + 40);
    g.restore();
  }
  const ell = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const rr = (x, y, w, h2, r, c) => { g.fillStyle = c; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h2, r); else g.rect(x, y, w, h2); g.fill(); };
  function lower(text, tag, col, t, a, typing = false, prevText = null) {
    const x = 56, w = W - 112, by = H - 64; g.save(); g.font = `500 27px ${T.body}`; const lines = wrap(g, text + (typing ? '▌' : ''), w - 40).slice(-3), lh = 34, bh = lines.length * lh + 52, y = by - bh;
    if (prevText) { g.globalAlpha = .45; g.font = `italic 400 18px ${T.body}`; const pl = wrap(g, prevText, w - 40).slice(-1); g.fillStyle = T.capInk; g.fillText(pl[0] || '', x + 20, y - 14); g.globalAlpha = 1; }
    g.fillStyle = T.cap; g.fillRect(x, y, w, bh); g.fillStyle = col; g.fillRect(x, y, 6, bh);
    g.font = `400 22px ${T.mono}`; g.fillStyle = col; g.textBaseline = 'top'; g.fillText(tag + (t != null ? '   ' + stampOf(t) : ''), x + 20, y + 12);
    g.font = `${tag === 'THINKING' ? 'italic ' : ''}500 27px ${T.body}`; g.fillStyle = T.capInk; lines.forEach((l, i) => g.fillText(l, x + 20, y + 44 + i * lh)); g.restore();
  }
  function card(big, small, c, staticky, sub = '') {
    g.fillStyle = '#060608'; g.fillRect(0, 0, W, H); if (staticky) { g.globalAlpha = .22; g.drawImage(noise, (Math.random() * 200) | 0, (Math.random() * 200) | 0, 56, 56, 0, 0, W, H); g.globalAlpha = 1; }
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; const pop = Math.min(1, c / .25);
    g.font = `400 ${Math.round(84 * (.9 + .1 * pop))}px ${T.disp}`; g.fillStyle = T.osd; g.fillText(big, W / 2, H / 2 - 30);
    if (small) { g.font = `400 34px ${T.disp}`; g.fillStyle = staticky ? T.tape : T.chair; g.fillText(small, W / 2, H / 2 + 34); }
    if (sub) { g.font = `400 20px ${T.mono}`; g.fillStyle = T.osd; g.globalAlpha = .75; g.fillText(sub, W / 2, H / 2 + 78); }
    g.restore();
  }
  function endCard(c) { g.save(); g.fillStyle = 'rgba(6,6,8,.72)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 46px ${T.disp}`; g.fillStyle = T.osd; g.fillText('END OF DIARY', W / 2, H / 2); g.restore(); }
  function flash(c, at, len) { const d = c - at; if (d < 0 || d > len) return; g.fillStyle = `rgba(255,255,255,${(1 - d / len) * .7})`; g.fillRect(0, 0, W, H); }
  function osd(c, t) {
    const L = entry?.lens || 'tape', col = L === 'yours' ? T.yours : L === 'archive' ? T.archive : T.tape;
    g.save(); g.textBaseline = 'top'; g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowOffsetY = 2;
    if (Math.floor(c * 1.6) % 2 === 0) { g.fillStyle = T.rec; g.beginPath(); g.arc(46, 40, 10, 0, Math.PI * 2); g.fill(); }
    g.font = `400 34px ${T.disp}`; g.fillStyle = T.osd; g.fillText('REC', 64, 22);
    g.textAlign = 'right'; g.font = `400 26px ${T.disp}`; g.fillStyle = col; g.fillText(L === 'yours' ? 'YOURS · LIVE' : L === 'archive' ? 'ARCHIVE' : 'TAPE', W - 36, 24);
    g.fillStyle = T.osd; g.font = `400 26px ${T.mono}`; g.fillText(`DAY ${entry?.day ?? day}${t != null ? '  ' + hm(t) + ':' + pad(Math.floor(c * 25) % 60) : ''}`, W - 36, H - 46);
    g.textAlign = 'left'; g.fillText('SP', 36, H - 46); g.restore();
    // tape: scanlines, a tracking band, grain
    g.save(); g.fillStyle = g.createPattern(scan, 'repeat'); g.fillRect(0, 0, W, H);
    const band = (c * 90) % (H + 80) - 40; g.globalAlpha = .06; g.fillStyle = '#fff'; g.fillRect(0, band, W, 14); g.globalAlpha = .07; g.globalCompositeOperation = 'overlay'; g.drawImage(noise, (c * 997) % 200 | 0, (c * 613) % 200 | 0, 56, 56, 0, 0, W, H); g.restore();
  }
  // ── save the diary as a webm: from the title to the end card, then back to where it was
  async function saveClip() {
    if (!entry?.lines?.length || rec) return null; const R = recorder(cv, { fps: FPS, bitrate: 1.6e6 }); if (!R) { toast('Clips need MediaRecorder: this browser has none'); return null; }
    rec = { R }; restart(); R.start(); toast('Recording the diary…'); const my = gen;
    await new Promise(r => { const wait = () => (!open || my !== gen || (performance.now() - t0) / 1000 >= Math.min(60, entry.dur + .3)) ? r() : setTimeout(wait, 100); wait(); });
    const out = await R.stop(); rec = null; if (!out) return null; const name = `ai-city-diary-${handle}-day${day}-${stamp()}.${R.ext}`; lastClip = { ...out, name, w: W, h: H };
    download(out.blob, name); toast(`Saved ${name} · ${out.secs.toFixed(1)} s`); return lastClip;
  }
  let lastClip = null;
  // keys while open: the room is modal, so it takes EVERY key before any other screen or the camera (kit.js keysFirst; review 10-09 #4:
  // ] also stepped the dossier behind it, Space and → played and stepped the tape). Its own keys don't do the browser's thing either;
  // any other key keeps it (Enter presses the focused button), but nothing behind the room hears it. Tab and Shift+Tab walk only the
  // room's own buttons, round and round (kit.js trapTab; the UI-keys leftover: Tab left the room for the page behind it)
  keysFirst(e => { if (!open) return false; if (e.metaKey || e.ctrlKey || e.altKey) return true; const k = e.code; let used = true;
    if (trapTab(e, room)) return true;
    if (k === 'Escape') close(); else if (k === 'ArrowRight' || k === 'Space') skip(1); else if (k === 'ArrowLeft') skip(-1); else if (k === 'BracketLeft') go(day - 1); else if (k === 'BracketRight') go(day + 1); else used = false;
    if (used) e.preventDefault(); return true; });
  return { show, close, go, skip, restart, saveClip, get isOpen() { return open; }, get entry() { return entry; }, get lastClip() { return lastClip; }, get handle() { return handle; }, get day() { return day; }, canvas: cv,
    set onClose(f) { onClose = f; }, lensOf };
}
