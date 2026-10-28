// BROADCAST (2026-10-09, TV plan §2.1 · A1) · THE DELAY LINE. The public city reaches the screen D real seconds after the sim served it,
// so the page always knows the next D seconds before the viewer sees them (a future camera director cuts to a robbery before it plays).
// It sits between the two workers and the main thread:
//   map      live.js onDiff: the map feed's diffs (feed.js) → layer, walkers, clock, the dusk/dawn reload
//   store    store.js onMsg: the store feed's states (storefeed.js) → cards, events, the ticker, CH 9, the stage, sim.clock()
// Each message is released D s after it arrived, in arrival order, on a timer (and on every arrival: a hidden tab's main-thread timers
// are throttled, the workers' messages are not), so a hidden tab never piles up a burst. Messages due together (a late timer) are folded
// into one (merge: the map's diffs by id, the store's cards by handle and events in order) and applied once.
//   D        delayS(): ?delay=<s> for this page (not kept), else Settings (setDelay, kept in localStorage), else BROADCAST.delay.
//            D = 0 is the page as it was: push() hands the message straight to release(), synchronously.
//   ramp     the line starts empty (the page joins, a new epoch, a longer D): its first message goes at once, and it releases at 0.8×
//            (BROADCAST.ramp: each gap between two arrivals is played 1.25× as long) until it is D behind — about a minute of slight
//            slow motion at D = 15 s. A gap in the feed (the sim offline) doesn't restart it: the line stays D behind. A state the
//            server served from its past (push(m, { ago }): GET /state?lag=, the join's backfill) goes at its own broadcast time, so
//            a join that can backfill D s starts D behind, with no ramp.
//   epoch    the sim's clock went back (a replay seek back or loop, a restarted sim: t < the last t − 1, the store's own test): what is
//            queued belongs to a timeline the sim left, so the line flushes it — folded into the new state (the layer stays consistent;
//            the store's new state is a complete reset) and released at once; the ramp starts again.
// Status (SIM OFFLINE) is never delayed: live.js and store.js apply it as it comes. Pure JS: no three, no DOM (node: tools/clockcheck.mjs).
//   ahead()  the store line's queued public events and cards, each with its release time: ONLY camera/director.js may import it, and
//            nothing on screen shows it (tools/broadcastcheck.mjs: the grep gate, and what it returns checked against the lens).
export const BROADCAST = { delay: 15, ramp: .8, max: 60, choices: [0, 10, 15, 20, 30], key: 'aicity.broadcast.delay' };

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clampD = s => Math.max(0, Math.min(BROADCAST.max, Math.round(+s * 10) / 10));
const urlDelay = () => { try { const v = new URLSearchParams(location.search).get('delay'); return v !== null && v !== '' && Number.isFinite(+v) ? clampD(v) : null; } catch { return null; } };
const kept = () => { try { const v = localStorage.getItem(BROADCAST.key); return v !== null && Number.isFinite(+v) ? clampD(v) : null; } catch { return null; } };
let D = null; const lines = new Map(), queues = new Map(), watchers = new Set();   // (queues: each named line's queue, for ahead() only)

// the delay in real seconds
export const delayS = () => D ??= urlDelay() ?? kept() ?? BROADCAST.delay;
// ?delay= set it for this page (Settings says so)
export const delayFromUrl = () => urlDelay() !== null;
// Settings: a new delay, now. Longer: the line slows down until it is that far behind; shorter: what is due now goes at once
export function setDelay(s, { keep = true } = {}) {
  D = clampD(s); if (keep) { try { localStorage.setItem(BROADCAST.key, String(D)); } catch {} }
  for (const L of lines.values()) L.retarget(); for (const f of watchers) { try { f(D); } catch {} } return D; }
export const onDelay = f => { watchers.add(f); return () => watchers.delete(f); };
// every line's counts (no contents): { map: { delay, lag, queued, pushed, released, folded, maxBatch, flushes, dropped }, store: … }
export const lineStats = () => Object.fromEntries([...lines].map(([k, L]) => [k, L.stats()]));

// a delay line. release(m) gets each message at broadcast time; merge(a, b) folds two consecutive messages into one (null: keep both);
// tOf(m) is its game minute (the epoch test). now / timer / delay are injectable (node: tools/clockcheck.mjs drives a simulated page)
export function createLine({ name = null, release, merge = null, tOf = m => m?.t, delay = delayS, ramp = BROADCAST.ramp, now = perfNow, timer = null }) {
  const T = timer || { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id) };
  const q = [], S = { pushed: 0, released: 0, folded: 0, maxBatch: 0, flushes: 0, dropped: 0, lagMs: 0 };
  let lastA = null, lastR = null, lastT = null, tid = null;
  const out = m => { S.released++; try { release(m); } catch (e) { console.error('[broadcast]', name, e); } };
  function fold(list) { const o = []; for (const m of list) { const f = o.length && merge ? merge(o[o.length - 1], m) : null; if (f) { o[o.length - 1] = f; S.folded++; } else o.push(m); } return o; }
  const unschedule = () => { if (tid !== null) { T.clear(tid); tid = null; } };
  function pump() {
    unschedule(); const n = now(); let k = 0; while (k < q.length && q[k].r <= n + .5) k++;
    if (k) { const due = q.splice(0, k); S.maxBatch = Math.max(S.maxBatch, k); S.lagMs = n - due[k - 1].a; for (const m of fold(due.map(x => x.m))) out(m); }
    if (q.length) tid = T.set(pump, Math.max(0, q[0].r - now()));
  }
  // m: the next message; ago: how many s before now it was the sim's present (a backfilled state; 0: now)
  function push(m, { ago = 0 } = {}) {
    S.pushed++; const n = now(), Lms = delay() * 1000, t = tOf(m), back = typeof t === 'number' && lastT !== null && t < lastT - 1, a = n - Math.max(0, +ago || 0) * 1000;
    if (typeof t === 'number') lastT = t;
    if (Lms <= 0 && !q.length) { lastA = lastR = n; out(m); return; }   /* D = 0: today's path */
    if (back) {   /* a new epoch: what is queued is flushed into this state, released now */
      S.flushes++; S.dropped += q.length; const list = fold([...q.map(x => x.m), m]); q.length = 0; unschedule(); lastA = lastR = n; S.lagMs = 0;
      for (const x of list) out(x); return; }
    let r = lastA === null ? Math.min(a + Lms, n) : Math.min(a + Lms, lastR + Math.max(0, a - lastA) / ramp); if (lastR !== null) r = Math.max(r, lastR);   /* (the ramp) */
    lastA = a; lastR = r; q.push({ m, a, r }); pump();
  }
  // a new delay: a shorter one releases what is due now (folded); a longer one ramps (0.8×) until the line is that far behind
  function retarget() { const Lms = delay() * 1000; for (const x of q) x.r = Math.min(x.r, x.a + Lms); if (q.length) pump(); }
  const L = { name, push, pump, retarget, clear() { unschedule(); q.length = 0; lastA = lastR = lastT = null; },
    get delayed() { return delay() > 0 || q.length > 0; },
    stats: () => ({ delay: delay(), lag: +(S.lagMs / 1000).toFixed(2), queued: q.length, pushed: S.pushed, released: S.released, folded: S.folded, maxBatch: S.maxBatch, flushes: S.flushes, dropped: S.dropped }) };
  if (name) { lines.set(name, L); queues.set(name, { q: () => q, now }); }
  return L;
}

// ── THE LOOKAHEAD (TV plan §2.1): what the viewer will see in the next D s. ONLY camera/director.js may import this (the grep gate in
// tools/broadcastcheck.mjs); nothing on screen shows it, nor does any window.__ handle reach it. It reads the store line's queue: the
// events and cards the store feed made through lens.js in its worker (public, lensed twice: the server's and the city's), never a
// state's `mine`, `tape`, `rap` or `people`, nor the claimed agent's own card (its owner's view), nor a reset's backfilled log. →
// { delay, lag (s), events: [{ at, in, t, e }], agents: [{ at, in, t, handle, card }] }, oldest first: at = the release time
// (performance.now() ms), in = s from now, t = the state's game minute. Read only: these are the objects the store will be handed.
export function ahead() {
  const Q = queues.get('store'), out = { delay: lines.get('store')?.stats().delay ?? delayS(), lag: lines.get('store')?.stats().lag ?? 0, events: [], agents: [] }; if (!Q) return out;
  const n = Q.now(); for (const { m, r } of Q.q()) { if (m?.type !== 'state' || m.reset) continue; const x = { at: r, in: Math.max(0, (r - n) / 1000), t: m.t };
    for (const e of m.events || []) out.events.push({ ...x, e });
    for (const c of m.changed || []) if (c.handle !== m.as) out.agents.push({ ...x, handle: c.handle, card: c.live }); }
  return out;
}

// ── the folds. The map feed's diffs: homes, piles and corners are only what changed (by id: the later wins), the rest is whole
export function mergeDiff(a, b) {
  const by = (x = [], y = []) => { if (!x.length) return y; const M = new Map(x.map(v => [v.id, v])); for (const v of y) M.set(v.id, v); return [...M.values()]; };
  return { ...b, homes: by(a.homes, b.homes), piles: by(a.piles, b.piles), corners: by(a.corners, b.corners), notes: [...(a.notes || []), ...(b.notes || [])] }; }
// the store feed's states: the cards that changed (by handle: the later wins), the new events in order, the roster when it changed. A
// reset (the first state, or the sim went back) is complete: what came before it is replaced; one is never folded into a later state
export function mergeState(a, b) {
  if (a?.type !== 'state' || b?.type !== 'state' || a.reset) return null; if (b.reset) return b;
  const ch = new Map(a.changed.map(c => [c.handle, c])); for (const c of b.changed) ch.set(c.handle, c);
  return { ...b, changed: [...ch.values()], roster: b.roster ?? a.roster, events: a.events.concat(b.events) }; }

// ── THE JOIN'S BACKFILL (run in the feeds' workers: feed.js, storefeed.js). A server that serves its recent past (GET /state?lag=<game
// min>: tools/simreplay.mjs, and the sim once it keeps a ring of its last ~30 per-minute views) lets a joining page start D s behind with
// no ramp: the line gets the polls a page that had been running would have had over the last D s, one per poll interval, each with its
// age. get(lag) → { raw, … } for /state?…&lag=<lag>; get(0) is the join's own first poll, so a server without lag (no `lag` in its
// answer, or paused: ago null) costs nothing extra and the line ramps. → [{ …, ago (s) }], oldest first; the last is the state now (ago 0)
export async function joinStates(get, { delay = 0, interval = 1000, maxLag = 30 } = {}) {
  const now0 = await get(0), L = now0?.raw?.lag;
  if (!(delay > 0) || !L || !(L.rate > 0) || typeof L.ago !== 'number' || typeof L.t !== 'number') return [{ ...now0, ago: 0 }];
  const step = Math.max(.25, interval / 1000), K = Math.ceil(delay / step), T = L.t + L.ago * L.rate, minAt = k => Math.floor(T - k * step * L.rate), byMin = new Map(), out = [];
  for (let k = K; k >= 1; k--) { const m = minAt(k), lag = L.t - m; if (m >= L.t || lag > maxLag || byMin.has(m)) continue;
    let s = null; try { s = await get(lag); } catch {} byMin.set(m, s?.raw?.lag?.t === m ? s : null); }   /* (a minute the server hasn't: from there the line ramps) */
  for (let k = K; k >= 1; k--) { const m = minAt(k), s = m >= L.t ? now0 : byMin.get(m); if (s) out.push({ ...s, ago: k * step }); }
  out.push({ ...now0, ago: 0 }); return out;
}
