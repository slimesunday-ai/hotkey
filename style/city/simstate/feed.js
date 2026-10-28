// SIM LIVE pass · THE FEED. Polls the live sim (GET <url>/state: sim2/server.mjs, or tools/simreplay.mjs), adapts each snapshot
// (adapter.js adaptLive: the only code that knows the sim's field names) and hands the page only what CHANGED since the last one:
//   homes / piles / corners   the ones whose drawing changed (a signature of exactly what layer.js draws), agents: all of them (small),
//   plus the clock, the crowd, the rush, the patrol count and the boards (carried, not drawn).
// It runs in a module worker (feedworker.js), so fetching, parsing and adapting never touch the frame; the page runs it inline only
// when a worker can't start. A failed poll keeps the last state and retries with backoff (1 s, 2, 4 … 30 s); the page shows SIM OFFLINE.
// BROADCAST (2026-10-09, simstate/broadcast.js): with a delay (opt.delay, s) the first poll is the join: GET …&lag=0, and when the server
// serves its recent past (lag in its answer) the last D s of states, oldest first, each posted with `since` (the wall-clock ms it was the
// sim's present), so the page's delay line starts D behind. A server without lag: the one state, as before.
// Pure JS: no three, no DOM.
import { adaptLive, createTracker, placeIndex, checkFields, notes } from './adapter.js';
import { joinStates } from './broadcast.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
export function createFeed({ url, places, night = false, interval = 1000, maxBackoff = 30000, delay = 0, onDiff, onStatus = () => {} }) {
  const P = placeIndex(places), tracker = createTracker(), prev = { homes: new Map(), piles: new Map(), corners: new Map() };
  const stats = { polls: 0, fails: 0, bytes: 0, fetchMs: 0, parseMs: 0, adaptMs: 0, maxMs: 0, homes: 0, piles: 0, corners: 0 };
  let timer = null, stopped = false, fails = 0, lastOk = 0, noteN = 0, inflight = null, joined = !(delay > 0);
  // exactly what the layer draws from each: a change of anything else never costs a redraw (day: the lights don't show)
  const sigHome = h => `${h.tier}|${h.owner ? 1 : 0}|${h.forRent ? 1 : 0}|${[...h.sec].sort().join(',')}|${[...h.scars].sort().join(',')}` + (night ? `|${h.lit ? 1 : 0}${h.asleep ? 1 : 0}${h.away ? 1 : 0}` : '');
  const sigPile = p => `${Math.round(p.level)}|${p.spill ? 1 : 0}`;
  const sigCorner = c => { const h = c.rush ? 1 : Math.max(0, Math.min(1, c.heat)); return `${Math.round(h * 4)}|${h > .62 ? 2 : h > .3 ? 1 : 0}`; };   // (simassets heatStep · placeholders' three steps)
  const changed = (map, sig, list, pack) => { const out = []; for (const v of list) { const s = sig(v); if (map.get(v.id) !== s) { map.set(v.id, s); out.push(pack(v)); } } return out; };
  const schedule = ms => { if (stopped) return; clearTimeout(timer); timer = setTimeout(poll, ms); };
  const poll = () => inflight ??= once().finally(() => { inflight = null; });   // (one poll at a time: a second caller waits for the one in flight)
  async function getText(u) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, to = setTimeout(() => ctl?.abort(), 5000);
    try { const r = await fetch(u, { cache: 'no-store', signal: ctl?.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(to); }
  }
  async function once() {
    const t0 = now();
    try {
      if (joined) take(await getText(url), t0);
      else { joined = true; const wall = Date.now();   // (the join: the delay line's backfill, broadcast.js joinStates)
        for (const s of await joinStates(async lag => { const text = await getText(url + (url.includes('?') ? '&' : '?') + 'lag=' + lag); return { text, raw: JSON.parse(text) }; }, { delay, interval }))
          take(s.text, t0, s.ago ? wall - s.ago * 1000 : null); }
      schedule(interval);
    } catch (e) {
      fails++; stats.fails++; const wait = Math.min(maxBackoff, interval * 2 ** Math.min(5, fails - 1));
      onStatus({ ok: false, error: String(e && e.message || e).slice(0, 120), retryIn: wait, fails, lastOk }); schedule(wait);
    }
  }
  function take(text, t0, since = null) {
      const t1 = now(), state = JSON.parse(text), t2 = now(); if (!checkFields(state)) throw new Error('not a sim state'); delete state.lag;
      const m = adaptLive(state, places, P, tracker), t3 = now();
      const homes = changed(prev.homes, sigHome, m.homes.values(), h => ({ id: h.id, tier: h.tier, owner: h.owner, vacant: h.vacant, forRent: !!h.forRent, lit: h.lit, asleep: h.asleep, away: h.away, sec: [...h.sec], scars: [...h.scars] }));
      const piles = changed(prev.piles, sigPile, m.piles.values(), p => ({ ...p }));
      const corners = changed(prev.corners, sigCorner, m.corners.values(), c => ({ ...c }));
      stats.polls++; stats.bytes = text.length; stats.fetchMs = +(t1 - t0).toFixed(2); stats.parseMs = +(t2 - t1).toFixed(2); stats.adaptMs = +(t3 - t2).toFixed(2); stats.maxMs = Math.max(stats.maxMs, t3 - t1);
      stats.homes += homes.length; stats.piles += piles.length; stats.corners += corners.length;
      const all = notes(), fresh = all.slice(noteN); noteN = all.length;
      fails = 0; lastOk = Date.now(); onStatus({ ok: true, lastOk });
      onDiff({ t: m.t, ts: m.ts, clock: m.clock, hasClock: m.hasClock, running: m.running, crowd: m.crowd, rush: m.rush, wanted: m.wanted, patrols: m.patrols, boards: m.boards, holders: m.holders, stationCops: m.stationCops,
        agents: m.agents, homes, piles, corners, notes: fresh, stats: { ...stats },
        me: state.me && typeof state.me === 'object' ? { handle: state.me.handle ?? null, home: state.me.home ?? null } : null, ...(since !== null ? { since } : {}) });   // (me: the home builder's owner view, view=owner · since: a backfilled state)
  }
  return { start() { stopped = false; return poll(); }, stop() { stopped = true; clearTimeout(timer); }, pollNow() { clearTimeout(timer); return poll(); }, stats };
}
