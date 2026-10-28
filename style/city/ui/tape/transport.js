// HUMAN LAYER · SECTION 2a · THE TRANSPORT (bottom of the screen, while TAPE is open):
//   row      TAPE badge · the tape time ("Day 3 · 14:05", and how far behind live) · ⏮ ▶ ⏭ · 1× 4× 16× 60× · secrets · Back to live (Esc)
//   track    the tape from its start to the horizon: day and hour ticks, night shaded, the event markers (one colour per kind: robberies,
//            arrests, deaths, marks earned, turf, the Director; hover shows the event, click goes there: onEvent), the HORIZON WALL where the tape
//            ends ("the rest is still live"; a finished season: the end of the season), section 2b's marks, ranges and layers
//   playhead a DOM element moved with a transform every frame (never a canvas redraw): a drag answers at once
// The canvas is redrawn only when the data, the size, the skin or the hover changes. Colours come from the kit's tokens (tape.css).
import { h, set, attr, lens as lensBadge, button, onSkinChange, token } from '../kit.js';
import { tape, SPEEDS } from './state.js';

const ICON = {
  play: '<path d="M4.5 2.8l8.6 5.2-8.6 5.2z" fill="currentColor"/>',
  pause: '<rect x="3.6" y="2.8" width="3.1" height="10.4" rx=".6" fill="currentColor"/><rect x="9.3" y="2.8" width="3.1" height="10.4" rx=".6" fill="currentColor"/>',
  prev: '<path d="M3 3v10M13 3L5.5 8 13 13z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  next: '<path d="M13 3v10M3 3l7.5 5L3 13z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  eye: '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/>',
};
const ic = k => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICON[k]; return s; };
export const KIND = { rob: 'Robbery', arrest: 'Arrest', death: 'Death', mark: 'Mark earned', turf: 'Turf', director: 'The Director' };
export const kindLabel = m => m.type === 'burgle' ? 'Burglary' : KIND[m.kind] || m.kind;   // (a break-in is a 'rob' marker, the robbery colour, but no robbery)
const dur = m => { m = Math.max(0, Math.round(m)); const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d}d ${hh}h` : hh ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m`; };

// onEvent(marker): a marker clicked. The controller (ui/tape/index.js goToEvent) takes the tape a beat before it, the camera to where
// it happens, and plays it. Without onEvent the click only jumps the tape there.
export function createTransport({ root, liveNow = () => null, onLive = () => {}, onSecrets = () => {}, onEvent = null, secretsOn = () => true }) {
  // ── DOM
  const badge = lensBadge('tape'); badge.classList.add('tp-lens');
  const timeB = h('b', null, '—'), timeS = h('span', null, ''), time = h('div', { class: 'tp-time', 'aria-live': 'off' }, timeB, timeS);
  const prevB = button('', { tip: 'Previous event (←)', onclick: () => tape.step(-1) }), nextB = button('', { tip: 'Next event (→)', onclick: () => tape.step(1) });
  prevB.append(ic('prev')); nextB.append(ic('next'));
  const playB = button('', { tip: 'Play (Space)', cls: 'tp-play', onclick: () => tape.toggle() }); playB.append(ic('play'));
  const speeds = h('div', { class: 'tp-speeds', role: 'group', 'aria-label': 'Speed' }, ...SPEEDS.map(x => h('button', { type: 'button', 'data-x': String(x), 'aria-pressed': String(x === tape.speed), 'data-tip': `${x}× the city's pace`, onclick: () => tape.setSpeed(x) }, `${x}×`)));
  const secB = button('Secrets', { tip: 'Thoughts, DMs and deals over the agents (T)', kbd: 'T', cls: 'tp-secrets tp-hide-s', onclick: () => onSecrets() }); secB.prepend(ic('eye'));
  const liveB = button('Back to live', { kbd: 'Esc', tip: 'Back to LIVE: everything as it was (Esc)', cls: 'tp-live', onclick: () => onLive() }); liveB.prepend(h('i', { class: 'k-live-dot' }));
  const msg = h('span', { class: 'tp-msg', hidden: true });
  const row = h('div', { class: 'tp-row' }, badge, time, h('div', { class: 'tp-btns' }, prevB, playB, nextB), speeds, msg, h('div', { class: 'tp-grow' }), secB, liveB);
  const cv = h('canvas', { 'aria-hidden': 'true' }), head = h('div', { class: 'tp-head' }), tip = h('div', { class: 'tp-tip', role: 'tooltip' }), loading = h('div', { class: 'tp-loading', hidden: true });
  const track = h('div', { class: 'tp-track', role: 'slider', tabindex: '0', 'aria-label': 'Tape position', 'aria-valuemin': '0', 'aria-valuemax': '0', 'aria-valuenow': '0' }, cv, loading, head, tip);
  const bar = h('section', { class: 'tp-bar', role: 'region', 'aria-label': 'Tape player', 'data-lens': 'tape' }, row, track);
  root.append(bar);
  const ctx = cv.getContext('2d');
  // ── geometry: [a, b] in game minutes over the track; the wall (past the horizon) gets a share of the width
  let W = 0, H = 0, dpr = 1, a = 0, b = 1, hz = 0, PAD = 8, hover = null, dirty = true, cols = {}, markers = [], placed = [], shown = false, lastHeadX = -1, lastLabel = '', scrub = null;
  const x = t => PAD + (t - a) / Math.max(1, b - a) * (W - 2 * PAD), tAt = px => a + (px - PAD) / Math.max(1, W - 2 * PAD) * (b - a);
  // (the wall past the horizon gets ~13% of the track, at least 158 px: room to say "the rest is still live")
  function range() { const w = tape.window(); if (w.start === null || w.horizon === null) return false; hz = w.horizon; a = w.start; const span = Math.max(60, hz - a), inner = Math.max(200, W - 2 * PAD);
    const share = w.archive ? Math.min(.04, 24 / inner) : Math.max(.13, Math.min(.3, 158 / inner)); b = hz + span * share / (1 - share); return true; }
  function readColours() { const k = n => token(n) || '#888'; cols = { track: k('--k-tp-track'), night: k('--k-tp-night'), tick: k('--k-tp-tick'), label: k('--k-tp-label'), wall: k('--k-tp-wall'), wall2: k('--k-tp-wall-2'),
    lens: k(tape.lens === 'archive' ? '--k-archive' : '--k-tape'), live: k('--k-live'), ink: k('--k-ink'), bg: k('--k-bg-solid'), font: k('--k-font-mono') || 'monospace',
    ev: Object.fromEntries(Object.keys(KIND).map(kk => [kk, k('--k-ev-' + kk)])) }; dirty = true; }
  onSkinChange(() => requestAnimationFrame(readColours));
  const ro = new ResizeObserver(() => { dirty = true; }); ro.observe(track);
  const col = c => !c ? cols.lens : c.startsWith('--') ? (token(c) || cols.lens) : c;
  // ── the canvas (only when something changed)
  function draw() {
    dirty = false; const r = track.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = Math.round(r.width); H = Math.round(r.height); if (!W || !H) return;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); if (!range()) return;
    const y0 = 14, y1 = H - 12, xh = x(hz);
    // the track, the night spans (22:00–06:00), the day and hour ticks
    ctx.fillStyle = cols.track; ctx.fillRect(PAD, y0, xh - PAD, y1 - y0);
    ctx.fillStyle = cols.night; for (let d = Math.floor(a / 1440) - 1; d * 1440 < b; d++) { const n0 = Math.max(a, d * 1440 + 22 * 60), n1 = Math.min(hz, d * 1440 + 30 * 60); if (n1 > n0) ctx.fillRect(x(n0), y0, x(n1) - x(n0), y1 - y0); }
    const perH = (W - 2 * PAD) / Math.max(1, (b - a) / 60);
    ctx.font = `600 10px ${cols.font}`; ctx.textBaseline = 'alphabetic';
    for (let hr = Math.ceil(a / 60); hr * 60 <= hz; hr++) { const t = hr * 60, xx = Math.round(x(t)) + .5, day = t % 1440 === 0, six = t % 360 === 0;
      if (!day && !six && perH < 4) continue;
      ctx.strokeStyle = cols.tick; ctx.globalAlpha = day ? 1 : six ? .75 : .45; ctx.lineWidth = day ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(xx, day ? 2 : y1 - (six ? 9 : 5)); ctx.lineTo(xx, y1); ctx.stroke(); ctx.globalAlpha = 1;
      if (day) { ctx.fillStyle = cols.label; ctx.fillText(`Day ${t / 1440 + 1}`, xx + 4, 10); }
      else if (six && perH * 6 > 26) { ctx.fillStyle = cols.label; ctx.globalAlpha = .8; ctx.fillText(String((t % 1440) / 60).padStart(2, '0'), xx + 3, H - 2); ctx.globalAlpha = 1; } }
    if (Math.floor(a / 1440) === Math.floor(Math.min(hz, a + 300) / 1440) && a % 1440 !== 0) { ctx.fillStyle = cols.label; ctx.fillText(`Day ${Math.floor(a / 1440) + 1}`, PAD + 2, 10); }
    // 2b's layers, then its ranges
    const { marks, ranges, layers } = tape.timeline.all();
    for (const [id, fn] of layers) { ctx.save(); try { fn(ctx, { x, w: W, h: H, from: a, to: hz, dpr }); } catch (e) { console.error('[tape timeline layer]', id, e); } ctx.restore(); }
    for (const r2 of ranges.values()) { const xa = x(Math.max(a, r2.from)), xb = x(Math.min(hz, r2.to)); if (xb <= xa) continue; ctx.fillStyle = col(r2.color); ctx.globalAlpha = .18; ctx.fillRect(xa, y0, xb - xa, y1 - y0); ctx.globalAlpha = 1;
      ctx.fillRect(xa, y0, 2, y1 - y0); ctx.fillRect(xb - 2, y0, 2, y1 - y0); if (r2.label) { ctx.fillStyle = col(r2.color); ctx.fillText(r2.label, xa + 4, y0 + 10); } }
    // the event markers: a dot per event, stacked where they crowd; then 2b's marks as ticks under them
    placed = []; const mid = (y0 + y1) / 2 - 1, cell = new Map();
    for (const m of markers) { if (m.t < a || m.t > hz) continue; const xx = x(m.t), k = Math.round(xx / 6), n = cell.get(k) || 0; cell.set(k, n + 1); if (n > 2) continue;
      const yy = mid + (n === 0 ? 0 : n === 1 ? -7 : 7); placed.push({ m, x: xx, y: yy }); }
    for (const p of placed) { const on = hover && hover.m === p.m; ctx.fillStyle = cols.ev[p.m.kind] || cols.ink; ctx.beginPath(); ctx.arc(p.x, p.y, on ? 5.5 : 3.6, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.lineWidth = 2; ctx.strokeStyle = cols.bg; ctx.stroke(); } }
    for (const list of marks.values()) for (const m of list) { if (m.t < a || m.t > hz) continue; const xx = Math.round(x(m.t)) + .5; ctx.strokeStyle = col(m.color); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xx, y1 - 8); ctx.lineTo(xx, y1); ctx.stroke(); }
    // the horizon wall: past it the tape is blank — the rest is still live (archive: the season's end)
    const wallW = W - PAD - xh; if (wallW > 2) {
      ctx.save(); ctx.beginPath(); ctx.rect(xh, y0 - 2, wallW, y1 - y0 + 4); ctx.clip(); ctx.fillStyle = cols.wall; ctx.fillRect(xh, y0 - 2, wallW, y1 - y0 + 4);
      ctx.strokeStyle = cols.wall2; ctx.lineWidth = 3; for (let s = xh - 40; s < W; s += 9) { ctx.beginPath(); ctx.moveTo(s, y1 + 2); ctx.lineTo(s + 18, y0 - 4); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = cols.lens; ctx.fillRect(xh - 1, 1, 3, H - 2);
      ctx.font = `650 10px ${cols.font}`; const lab = tape.lens === 'archive' ? 'end of the season' : 'the rest is still live', tw = ctx.measureText(lab).width;
      if (wallW > tw + 10) { ctx.fillStyle = cols.label; ctx.fillText(lab, xh + 7, 10); } else if (wallW > 16) { ctx.fillStyle = cols.label; ctx.fillText(tape.lens === 'archive' ? 'end' : 'live', xh + 5, 10); } }
  }
  // ── per frame: the playhead (a transform) and the readout (when the minute changes); the canvas only when dirty
  function frame() {
    if (!shown) return; if (dirty) draw(); const t = tape.time(); if (t === null || !W) return;
    const px = Math.round(x(t) * 2) / 2; if (px !== lastHeadX) { head.style.transform = `translateX(${px}px)`; lastHeadX = px; }
    const c = tape.clock(t), label = c ? c.label : '';
    if (label !== lastLabel) { lastLabel = label; set(timeB, label); const ln = liveNow(); set(timeS, ln !== null ? `${dur(ln - t)} behind live` : tape.lens === 'archive' ? 'the finished season' : '');
      attr(track, 'aria-valuenow', String(Math.floor(t))); attr(track, 'aria-valuetext', label); }
  }
  // ── pointer: drag anywhere to scrub (instant: the playhead moves under the pointer, the city follows within a frame or two);
  // a press and release on a marker without moving jumps to it exactly
  const hitMarker = (px, py) => { let best = null, bd = 9; for (const p of placed) { const d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = p; } } return best; };
  const local = e => { const r = track.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
  track.addEventListener('pointerdown', e => { if (e.button !== 0 || tape.time() === null) return; e.preventDefault(); track.setPointerCapture(e.pointerId); track.focus({ preventScroll: true });
    const { px, py } = local(e); scrub = { x0: px, y0: py, was: tape.playing, marker: hitMarker(px, py), moved: false }; tape.pause(); bar.classList.add('is-scrub');
    if (!scrub.marker) tape.seek(tAt(px), 'scrub'); });
  track.addEventListener('pointermove', e => { const { px, py } = local(e);
    if (scrub) { if (!scrub.moved && Math.abs(px - scrub.x0) < 3) return; scrub.moved = true; showTip(null); tape.seek(tAt(px), 'scrub'); return; }
    const p = e.pointerType === 'mouse' ? hitMarker(px, py) : null; if ((p?.m || null) !== (hover?.m || null)) { hover = p; dirty = true; showTip(p); track.style.cursor = p ? 'pointer' : ''; } });
  // (a marker clicked: onEvent plays it once the camera is there, so the play-on-release is the controller's)
  const endScrub = e => { if (!scrub) return; const s = scrub; scrub = null; bar.classList.remove('is-scrub'); try { track.releasePointerCapture(e.pointerId); } catch {}
    if (!s.moved && s.marker && onEvent && e.type === 'pointerup') { showTip(null); hover = null; dirty = true; onEvent(s.marker.m); return; }
    if (!s.moved && s.marker) tape.seek(s.marker.m.t, 'click');
    if (s.was) tape.play(); };
  track.addEventListener('pointerup', endScrub); track.addEventListener('pointercancel', endScrub);
  track.addEventListener('pointerleave', () => { if (hover) { hover = null; dirty = true; showTip(null); track.style.cursor = ''; } });
  function showTip(p) { if (!p) { tip.classList.remove('is-on'); return; } const m = p.m, c = tape.clock(m.t);
    tip.replaceChildren(h('div', { class: 'tp-tip-h', style: `--ev: ${cols.ev[m.kind] || cols.ink}` }, h('i'), kindLabel(m), h('span', null, c ? c.label : '')), h('div', null, m.text),
      ...(onEvent ? [h('div', { class: 'tp-tip-k' }, 'Click: go there and watch it')] : []));
    tip.classList.add('is-on'); const tw = Math.min(320, tip.offsetWidth || 220); tip.style.transform = `translateX(${Math.round(Math.max(0, Math.min(W - tw, p.x - tw / 2)))}px)`; }
  // ── state → buttons
  tape.on('play', ({ playing, speed }) => { playB.replaceChildren(ic(playing ? 'pause' : 'play')); attr(playB, 'data-tip', playing ? 'Pause (Space)' : 'Play (Space)'); attr(playB, 'aria-label', playing ? 'Pause' : 'Play');
    for (const b2 of speeds.children) attr(b2, 'aria-pressed', String(+b2.dataset.x === speed)); });
  tape.on('data', () => { dirty = true; const w = tape.window(); loading.hidden = !tape.loading; attr(track, 'aria-valuemin', String(w.start ?? 0)); attr(track, 'aria-valuemax', String(w.horizon ?? 0)); syncIdle(); });
  tape.on('seek', () => syncIdle());
  // no moment on the tape yet (loading, pending, no tape): play and the steps say so and do nothing (state.js play() won't either)
  function syncIdle() { const idle = tape.time() === null; for (const b2 of [prevB, playB, nextB]) attr(b2, 'aria-disabled', idle ? 'true' : null); bar.classList.toggle('is-idle', idle); }
  tape.on('timeline', () => { dirty = true; });
  return {
    el: bar, frame,
    show(on) { shown = on; bar.classList.toggle('is-on', on); attr(bar, 'data-lens', tape.lens); badge.update(tape.lens === 'archive' ? 'archive' : 'tape', ''); if (on) { readColours(); lastLabel = ''; lastHeadX = -1; } },
    setMarkers(list) { markers = list || []; dirty = true; },
    // the readout while the tape has no moment to show (review 10-09 #10: "Loading the tape…" stayed next to "Nothing on tape yet"):
    // loading → "Loading the tape…"; done with nothing to show → head (what: "Nothing on tape yet", "No tape") and text (why, in the row,
    // cut to fit with the whole of it on hover); done with data → the tape time on the next frame
    setLoading(on, text = '', head = null) { loading.hidden = !on; msg.hidden = !text; set(msg, text); attr(msg, 'title', text || null); lastLabel = ''; lastHeadX = -1;
      if (on) { set(timeB, 'Loading the tape…'); set(timeS, ''); } else if (text) { set(timeB, head || 'No tape'); set(timeS, ''); } syncIdle(); },
    setSecrets(on) { secB.classList.toggle('is-on', on); attr(secB, 'aria-pressed', String(on)); },
    redraw() { dirty = true; },
    stats: () => ({ w: W, markers: placed.length }),
    placed: () => { const r = track.getBoundingClientRect(); return placed.map(p => ({ x: r.left + p.x, y: r.top + p.y, kind: p.m.kind, t: p.m.t, text: p.m.text })); },   // (tests and shots: where each marker is on screen)
    trackRect: () => { const r = track.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, x0: r.left + x(a), xh: r.left + x(hz) }; },
  };
}
