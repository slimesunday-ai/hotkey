// HUMAN LAYER · THE STORE'S FEED (runs in storeworker.js; inline when a worker can't start). Polls the sim for the human layer and derives
// everything the screens read, once per poll, off the main thread, and posts only what changed. It is independent of the map's own
// feed (feed.js → layer.js / agents.js), which it never touches: ?sim=live draws exactly as before whether the store runs or not.
//   every poll (1 s)       GET /state?view=public — or view=owner&handle=&token= when the page claims an agent (?as=) — then the
//                          lens again here (lens.js publicOf: a full state, e.g. the replay's --view full, is cut down to the public
//                          view; news loses `think`), and the derived cards, rap sheets and people for the agents that changed
//   every 5 s              GET /state?view=director: the director's cut (the last hourly snapshot before now − delay, and the events up
//                          to the cut) → each agent's `tape` as of the cut (the snapshot advanced to it: simstate/timeline.js), or
//                          'pending' until the city is a day old. Accepted only when the answer carries delayMinutes or pending (a
//                          static file is never taken for a director's cut)
//   THE LOG IS COMPLETE (audit F18). /state carries only the last 150 public events (fewer once the lens drops DMs and warns), the
//   director's cut the last 150 up to the cut. GET /events?since=<last id> (the replay and the sim, b46c49e) fills the public log: on
//   joining (the log before the page), and whenever a poll's window doesn't reach back to the last event the page holds (a busy minute, a
//   slow or failed poll, a hidden tab). GET /tape?from=&snaps=0 does the same for the director's events. When a server can't fill a gap
//   the page knows it: `history` on every state ({ complete, from, gaps, lastGap, trimmed }, STORE.md) — never a silent loss.
//   THE BROADCAST'S JOIN (2026-10-09, simstate/broadcast.js): with a delay (opt.delay, s) the first poll asks …&lag=0; a server that
//   serves its recent past (`lag` in its answer: the replay) also gives the last D s of states, which go through here oldest first, each
//   posted with `since` (the wall-clock ms it was the sim's present), so the page's delay line starts D behind. Otherwise: one state.
// Messages: { type: 'state', … } per poll that changed something, { type: 'status', ok, error, retryIn } per poll outcome.
import { publicOf, leaks, ownerEvents, statsCutOf } from './lens.js';
import { joinStates } from './broadcast.js';
import { placeBook, liveOf, rapEntry, addTie, peopleOf, tapeOf } from './derive.js';
import { createTimeline, stamp } from './timeline.js';

const RAP_MAX = 80, EVENTS_MAX = 20000, DIR_MAX = 8000, FULL_START = 100;   // FULL_START: a first window this short is the whole log (the server's is 150)
export function createStoreFeed({ url, places, as = null, token = null, interval = 1000, directorEvery = 5000, maxBackoff = 30000, delay = 0, onMsg }) {
  const B = placeBook(places), base = new URL(url), sib = p => { const u = new URL(p, base); return u; };
  const stateUrl = view => { const u = new URL(base); for (const k of ['view', 'handle', 'token']) u.searchParams.delete(k); u.searchParams.set('view', view);
    if (view === 'owner') { u.searchParams.set('handle', as); u.searchParams.set('token', token); } return u.href; };
  const get = async (u, ms = 5000) => { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms); try { const r = await fetch(u, { cache: 'no-store', signal: ctl.signal }); return r; } finally { clearTimeout(to); } };
  let S = fresh(), timer = null, stopped = false, fails = 0, inflight = null, dirAt = -Infinity, ownerErr = null, tokenTried = false, canEvents = null, canTape = null, joined = !(delay > 0);
  const stats = { polls: 0, fails: 0, bytes: 0, deriveMs: 0, maxDeriveMs: 0, leaks: 0, dirPolls: 0 };
  function fresh() { return { t: null, lastId: 0, events: [], loud: new Map(), statsCut: null, rap: new Map(), ties: new Map(), sig: new Map(), roster: '', dir: new Map(), dirLast: 0, dirSnap: null, dirPending: false, dirDelay: null, tapes: new Map(), myEvents: new Map(), mine: null, crews: [],
    history: { complete: true, from: null, gaps: 0, lastGap: null, trimmed: 0 } }; }
  function addPublic(list, out) {   // new public events (by id, oldest first) → rap sheets, ties, the log
    for (const e of list) { if (!(e.id > S.lastId)) continue; S.lastId = e.id; S.events.push(e); out?.push(e); if (e.type === 'say' && e.who) S.loud.set(e.who, { text: e.text, to: 'here', t: e.t });
      for (const h of new Set([e.who, e.to])) { if (typeof h !== 'string') continue; const r = rapEntry(e, h, B); if (r) { let L = S.rap.get(h); if (!L) S.rap.set(h, L = []); L.push(r); if (L.length > RAP_MAX) L.shift(); } }
      addTie(S.ties, e); }
    if (S.events.length > EVENTS_MAX) { const cut = S.events.length - EVENTS_MAX; S.events.splice(0, cut); S.history.trimmed += cut; S.history.from = S.events[0].t; }
  }
  // the public log after the cursor (GET /events?since=: the replay and the sim). → true when the server answered (the events are in)
  async function catchUp(t, out) {
    if (canEvents === false) return false; try { const r = await get(sib('events') + `?since=${S.lastId}&upto=${t}`, 15000); if (!r.ok) { if (r.status === 404) canEvents = false; return false; }
      const j = await r.json(); canEvents = true; addPublic((j.events || []).filter(e => e.t <= t).sort((a, b) => a.id - b.id), out); return true; } catch { return false; }
  }
  // a window that doesn't reach back to what the page holds may have skipped events: fill it, or say so
  const reaches = (win, last) => !last || !win.length || win[0].id <= last;
  function gap(H, after, before, t) { H.complete = false; H.gaps++; H.lastGap = { after, before, t, ts: stamp(t) }; }
  async function claimToken() {   // ?as=<handle> without &token=: the replay hands out a dev token (GET /dev/token); the real sim never does
    tokenTried = true; try { const r = await get(sib('dev/token') + `?handle=${encodeURIComponent(as)}`); if (r.ok) { const j = await r.json(); if (j.token) token = j.token; } } catch {}
    if (!token) ownerErr = `no owner token for @${as} (pass &token=, or run the replay, which hands out dev tokens)`;
  }
  async function director(t) {
    dirAt = Date.now(); stats.dirPolls++;
    try { const r = await get(stateUrl('director')); if (!r.ok) { S.dirSnap = null; S.dirPending = false; S.tapes.clear(); return; } const d = await r.json();
      if (d.pending) { S.dirPending = true; S.dirDelay = d.delayMinutes ?? null; S.dirSnap = null; S.statsCut = null; S.tapes.clear(); return; }
      if (typeof d.delayMinutes !== 'number' || !Array.isArray(d.agents)) { S.dirSnap = null; S.dirPending = false; return; }   // (not a director's cut: a static file, or an older sim)
      S.dirPending = false; S.dirDelay = d.delayMinutes; const cut = t - d.delayMinutes; S.statsCut = statsCutOf(d, d.delayMinutes);   // (yesterday's secret stats: lens.js rule 4)
      // the director's events: the day before the cut on the first answer, then whatever a window doesn't reach back to (GET /tape)
      const win = (d.events || []).filter(e => e.t <= cut).sort((a, b) => a.id - b.id), take = list => { for (const e of list) if (e.t <= cut) { S.dir.set(e.id, e); if (e.id > S.dirLast) S.dirLast = e.id; } };
      const from = S.dir.size === 0 ? Math.max(0, cut - 1440) : !reaches(win, S.dirLast) ? S.dir.get(S.dirLast)?.t ?? Math.max(0, cut - 1440) : null;
      if (from !== null) { const after = S.dirLast; let ok = false;
        if (canTape !== false) { try { const q = await get(sib('tape') + `?from=${from}&to=${cut}&snaps=0`, 15000); if (q.ok) { canTape = true; ok = true; take((await q.json()).events || []); } else if (q.status === 404) canTape = false; } catch {} }
        if (after && (!ok || !reaches(win, S.dirLast))) gap(S.dirHistory ||= { complete: true, from: null, gaps: 0, lastGap: null, trimmed: 0 }, after, win[0]?.id ?? null, cut); }
      take(win);
      if (S.dir.size > DIR_MAX) { const ids = [...S.dir.keys()].sort((a, b) => a - b); for (const id of ids.slice(0, S.dir.size - DIR_MAX)) S.dir.delete(id); }
      const evs = [...S.dir.values()].sort((a, b) => a.id - b.id);
      // the snapshot (the last hour before the cut) advanced to the cut by the events between: cash and pockets as of the cut (F17)
      const { events: _e, delayMinutes: _d, ...snap } = d, at = createTimeline({ snaps: [snap], events: evs, places }).advance(Math.max(d.t, cut));
      S.dirSnap = { t: at.t, ts: at.ts, cut, delay: d.delayMinutes };
      S.tapes.clear(); for (const a of at.agents) { const tp = tapeOf(at, a.handle, evs); if (tp) S.tapes.set(a.handle, tp); }
    } catch { /* keep the last cut */ }
  }
  const schedule = ms => { if (stopped) return; clearTimeout(timer); timer = setTimeout(poll, ms); };
  const poll = () => inflight ??= once().finally(() => { inflight = null; });
  async function once() {
    try {
      if (as && !token && !tokenTried) await claimToken();
      const owner = !!(as && token), su = stateUrl(owner ? 'owner' : 'public');
      const fetchState = async lag => { const r = await get(lag === null ? su : su + '&lag=' + lag); if (r.status === 403 && owner) return { refused: true };
        if (!r.ok) throw new Error('HTTP ' + r.status); const text = await r.text(), raw = JSON.parse(text); if (!raw || !Array.isArray(raw.agents)) throw new Error('not a sim state'); return { text, raw }; };
      let list; if (joined) list = [await fetchState(null)];
      else { joined = true; const wall = Date.now(); list = (await joinStates(fetchState, { delay, interval })).map(s => ({ ...s, since: s.ago ? wall - s.ago * 1000 : null })); }   // (the join: the delay line's backfill)
      if (list[0]?.refused) { ownerErr = `the owner token for @${as} was refused`; token = null; tokenTried = true; schedule(0); return; }
      for (const s of list) await take(s.raw, s.text, owner, s.since ?? null);
      schedule(interval);
    } catch (e) { fails++; stats.fails++; const wait = Math.min(maxBackoff, interval * 2 ** Math.min(5, fails - 1)); onMsg({ type: 'status', ok: false, error: String(e && e.message || e).slice(0, 160), retryIn: wait }); schedule(wait); }
  }
  // one state (a poll, or a backfilled one: since) → the lens, the derivations, the message
  async function take(raw, text, owner, since) {
      delete raw.lag; const t = raw.t ?? 0; let t0 = now(), ms = 0;
      if (S.t !== null && t < S.t - 1) S = fresh();   // (the clock went back: a replay seek or loop, a restarted sim — start the log over)
      const first = S.t === null; S.t = t;
      const pub = publicOf(raw, { places }), leak = leaks(pub);   // (the lens again, whatever the server sent)
      if (leak.length) { stats.leaks += leak.length; pub.events = []; pub.news = []; }   // (never pass on what the lens didn't expect: the check script reports these)
      const win = (pub.events || []).slice().sort((a, b) => a.id - b.id), fresh_ = [];
      if (first) { ms += now() - t0; if (!(await catchUp(t)) && win.length >= FULL_START) { S.history.complete = false; S.history.from = win[0].t; } t0 = now(); }
      else if (!reaches(win, S.lastId)) { ms += now() - t0; const before = win[0].id, after = S.lastId; if (!(await catchUp(t, fresh_)) || !reaches(win, S.lastId)) gap(S.history, after, before, t); t0 = now(); }
      addPublic(win, fresh_);
      if (owner && raw.me) { for (const e of raw.myEvents || []) S.myEvents.set(e.id, e); const my = [...S.myEvents.values()].sort((a, b) => a.id - b.id).slice(-200); S.myEvents = new Map(my.map(e => [e.id, e])); S.mine = { me: raw.me, myEvents: ownerEvents(my, as, raw.lots) }; ownerErr = null; }   // (the city's owner rules again, whatever the server sent)
      if (Date.now() - dirAt >= directorEvery) { ms += now() - t0; await director(t); t0 = now(); }
      // the cards: every agent; posted only when changed
      S.crews = pub.crews || []; const changed = [], roster = pub.agents.map(a => a.handle).join('\n');
      for (const a of pub.agents) { const h = a.handle;
        if (!a.lastSay && S.loud.has(h)) a.lastSay = S.loud.get(h);
        if (h === as && raw.me?.handle === h) for (const k of ['at', 'x', 'z', 'trip', 'act']) a[k] = raw.me[k];   // (the owner knows where its agent really is)   // (its last line said out loud, from the log: a DM never shows)
        const entry = { handle: h, live: liveOf(a, B), rap: (S.rap.get(h) || []).slice().reverse(), people: peopleOf(h, S.ties, S.crews), tape: S.tapes.get(h) ?? (S.dirPending ? 'pending' : null), mine: h === as && S.mine ? S.mine : null };
        const sig = JSON.stringify(entry); if (S.sig.get(h) !== sig) { S.sig.set(h, sig); changed.push(entry); } }
      ms += now() - t0; stats.polls++; stats.bytes = text.length; stats.deriveMs = +ms.toFixed(2); stats.maxDeriveMs = Math.max(stats.maxDeriveMs, +ms.toFixed(2));
      fails = 0; onMsg({ type: 'status', ok: true });
      onMsg({ type: 'state', t, ts: raw.ts ?? null, running: raw.running ?? null, archive: !!raw.archive, as, ownerErr, changed, roster: roster !== S.roster ? (S.roster = roster).split('\n') : null,
        events: first ? S.events.slice() : fresh_, reset: first, crews: S.crews, loans: pub.loans || [], news: pub.news || [], cityEv: pub.cityEv || null, mostWanted: pub.mostWanted ?? null, stationCops: pub.stationCops ?? null, cityStats: pub.stats || null, statsCut: S.statsCut ?? pub.statsCut ?? null,
        horizon: S.dirSnap ? S.dirSnap.cut : null, asOf: S.dirSnap?.t ?? null, delay: S.dirDelay, pending: S.dirPending, history: { ...S.history, director: S.dirHistory ? { ...S.dirHistory } : null }, stats: { ...stats },
        ...(since !== null ? { since } : {}) });
  }
  return { start() { stopped = false; return poll(); }, stop() { stopped = true; clearTimeout(timer); }, pollNow() { clearTimeout(timer); return poll(); }, directorNow() { dirAt = -Infinity; return this.pollNow(); }, stats };
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
