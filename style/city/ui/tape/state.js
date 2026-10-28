// HUMAN LAYER · SECTION 2a · THE TAPE'S TIME: the one module every tape screen reads (the transport, the city on tape, the dossier,
// and section 2b's trails, heat map, diary room and clips). API and rules: TAPE.md.
//   import { tape } from './tape/state.js'
// It holds the tape clock (the game minute on screen while TAPE is open), play/pause/speed, the tape's window (start … horizon) and the
// timeline's extra marks and layers. It never holds sim data itself: the controller (ui/tape/index.js) binds the data side (events,
// stateAt) and does the opening and closing. THE RULE: tape.time() is never past the horizon (now − delay; a finished season: its end).
// Every seek, step, jump and play is clamped here, in one spot (tools/lenscheck.mjs checks it).
import { clockOf } from '../../simstate/adapter.js';

export const SPEEDS = [1, 4, 16, 60];   // × the sim's own pace (1× = the live city's game minutes per real second)
export const EDGE_BACK = 120;   // game minutes before the horizon: where TAPE opens (ui/tape/index.js OPEN_BACK) and where Play at the end goes
const subs = new Map();
const S = { active: false, lens: 'tape', handle: null, t: null, playing: false, speed: 4, base: 1.6, start: null, horizon: null, loadedTo: null, delay: null, loading: false, error: null };
const marks = new Map(), ranges = new Map(), layers = new Map();
let ctrl = null, lastTimeEmit = 0;
const emit = (type, v) => { const s = subs.get(type); if (s) for (const fn of [...s]) { try { fn(v); } catch (e) { console.error('[tape]', type, e); } } };
const nowMs = () => performance.now();
const pad = n => String(n).padStart(2, '0');
// the one clamp: [start, horizon]. Before the tape has a window, nothing can be shown (null)
function clamp(t) { if (S.horizon === null || S.start === null || t === null || t === undefined || Number.isNaN(+t)) return null; return Math.max(S.start, Math.min(S.horizon, +t)); }

export const tape = {
  SPEEDS,
  get active() { return S.active; },            // TAPE is open
  get lens() { return S.lens; },                // 'tape' (a live season: up to now − delay) | 'archive' (a finished season: all of it)
  get handle() { return S.handle; },            // the agent the tape was opened at (selected and followed), or null
  get playing() { return S.playing; },
  get speed() { return S.speed; },              // one of SPEEDS
  get rate() { return S.base * S.speed; },      // game minutes per real second while playing
  get loading() { return S.loading; },          // the tape's data is still on its way (the transport shows it)
  get error() { return S.error; },
  // the game minute on screen (a float), or null while TAPE is closed. Never past the horizon.
  time() { return S.active ? S.t : null; },
  // { t, day, hh, mm, hhmm, ts: 'D3 14:05', label: 'Day 3 · 14:05', night } for t (default: the tape time), or null
  clock(t = S.t) { if (t === null || t === undefined) return null; const m = Math.floor(t), c = clockOf(m), hhmm = `${pad(c.hh)}:${pad(c.mm)}`;
    return { t, day: c.day, hh: c.hh, mm: c.mm, hhmm, ts: `D${c.day} ${hhmm}`, label: `Day ${c.day} · ${hhmm}`, night: c.night }; },
  // the tape's window: start = the first moment on tape, horizon = the newest it may show (it moves on with the live city), loadedTo =
  // how far the page holds data (≤ horizon), delay = the director's delay in game minutes (0 in archive)
  window() { return { start: S.start, horizon: S.horizon, loadedTo: S.loadedTo, delay: S.delay, archive: S.lens === 'archive' }; },
  // 'mode' { active, handle, lens } · 'seek' { t, by } (a jump: scrub, step, click, open) · 'play' { playing, speed } · 'time' { t } (≤ 10 Hz
  // while playing, and after every seek) · 'data' { window, events } (the tape's data or horizon changed) · 'timeline' (marks / ranges /
  // layers changed) · 'end' (play reached the horizon). Returns unsubscribe.
  on(type, fn) { let s = subs.get(type); if (!s) subs.set(type, s = new Set()); s.add(fn); return () => s.delete(fn); },

  // ── controls (the transport and the keys use these; so may 2b)
  seek(t, by = 'seek') { if (!S.active) return null; const c = clamp(t); if (c === null) return null; S.t = c; emit('seek', { t: c, by }); emit('time', { t: c }); lastTimeEmit = nowMs(); return c; },
  // Play at the end: a finished season (ARCHIVE) from its start; a live season from EDGE_BACK before the horizon, the moment TAPE opens at
  // (review 10-09 #6: it went back to Day 1, and at 1x the horizon moves on only every 10 s, so a watcher near the edge hit it again and again)
  play() { if (!S.active || S.playing || S.t === null) return; if (S.t >= S.horizon - .5) tape.seek(S.lens === 'archive' ? S.start : S.horizon - EDGE_BACK, 'rewind'); S.playing = true; emit('play', { playing: true, speed: S.speed }); },
  pause() { if (!S.playing) return; S.playing = false; emit('play', { playing: false, speed: S.speed }); },
  toggle() { S.playing ? tape.pause() : tape.play(); },
  setSpeed(x) { if (!SPEEDS.includes(x) || x === S.speed) return; S.speed = x; emit('play', { playing: S.playing, speed: x }); },
  jump(minutes, by = 'jump') { if (S.t !== null) return tape.seek(S.t + minutes, by); },
  // the previous / next marked event (the timeline's markers: robberies, arrests, deaths, marks, turf, the Director) from the tape time.
  // It lands a hair before the event's minute: the city as it stood just before (at the minute itself the event has happened: an
  // arrestee is already on Iron Island), so play shows it happen (stage/index.js stages what play crosses).
  step(dir) { const L = ctrl?.markers?.() || [], t = S.t; if (!L.length || t === null) return null;
    const e = dir > 0 ? L.find(m => m.t > t + .5 && m.t <= S.horizon) : [...L].reverse().find(m => m.t < t - .5 && m.t >= S.start); return e ? tape.seek(e.t - .01, 'step') : null; },
  // open TAPE (optionally at an agent: selected and followed; at: a game minute) / back to LIVE, everything as it was
  open(opt = {}) { return ctrl?.open(opt); },
  close() { return ctrl?.close(); },

  // ── the data, read-only (bound by the controller; never past the horizon)
  // the tape's events, oldest first: every event, private ones too (thoughts, DMs, deals) — up to the horizon only.
  // opt { from, to, handle, types, limit }
  events(opt = {}) { return ctrl?.events?.(opt) || []; },
  // the timeline's markers: [{ id, t, kind: 'rob' | 'arrest' | 'death' | 'mark' | 'turf' | 'director', type (the event's: 'burgle' for a
  // break-in, a 'rob' marker), text, who, to, at }] — a break-in's report (`of`: found later) is none: the tape has the break-in itself
  markers() { return ctrl?.markers?.() || []; },
  // the FULL sim state at game minute t (agents with cash, heat, inv, at, trip …; lots; crews), clamped to the horizon → Promise
  stateAt(t) { const c = clamp(t); return c === null ? Promise.resolve(null) : ctrl?.stateAt?.(c) ?? Promise.resolve(null); },
  // the tape's view of one agent at the tape time (what the dossier shows): { live, rap, people, tape, asOf } | null
  agent(handle) { return ctrl?.agent?.(handle) ?? null; },

  // ── the timeline: section 2b adds its own marks, in/out ranges and drawing layers here; the transport draws them
  timeline: {
    // marks(id, [{ t, label, color?: '--k-token' | css colour, kind? }]) a row of ticks of its own (null removes it)
    marks(id, list) { if (list) marks.set(id, list); else marks.delete(id); emit('timeline', { id }); },
    // range(id, { from, to, label?, color? }) an in/out span (a clip) drawn over the track (null removes it)
    range(id, r) { if (r) ranges.set(id, r); else ranges.delete(id); emit('timeline', { id }); },
    // layer(id, draw(ctx, { x(t), w, h, from, to, dpr })) a canvas drawing of its own, under the playhead (null removes it)
    layer(id, draw) { if (draw) layers.set(id, draw); else layers.delete(id); emit('timeline', { id }); },
    all() { return { marks, ranges, layers }; },
  },

  // ── internal (the controller)
  _bind(c) { ctrl = c; },
  _set(patch) { const was = { active: S.active, horizon: S.horizon, start: S.start, loadedTo: S.loadedTo };
    Object.assign(S, patch); if (S.t !== null && S.horizon !== null && S.t > S.horizon) S.t = S.horizon;   // (the horizon only moves on; a smaller one clamps the time)
    if (S.active !== was.active) { if (!S.active) { S.playing = false; S.t = null; } emit('mode', { active: S.active, handle: S.handle, lens: S.lens }); }
    if (S.horizon !== was.horizon || S.start !== was.start || S.loadedTo !== was.loadedTo || 'loading' in patch) emit('data', { window: tape.window() }); },
  // per frame while TAPE is open and playing: the clock moves on at rate; at the horizon it stops (the rest is still live)
  _advance(dt) { if (!S.active || !S.playing || S.t === null) return false;
    const n = clamp(S.t + dt * S.base * S.speed); if (n === null) return false; S.t = n;
    const now = nowMs(); if (now - lastTimeEmit > 100) { lastTimeEmit = now; emit('time', { t: n }); }
    if (n >= S.horizon) { S.playing = false; emit('time', { t: n }); emit('play', { playing: false, speed: S.speed }); emit('end', { t: n }); }
    return true; },
  _clamp: clamp,
};
if (typeof window !== 'undefined') window.__tape = tape;
