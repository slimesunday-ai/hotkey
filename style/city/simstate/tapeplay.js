// HUMAN LAYER · SECTION 2a · THE TAPE PLAYER'S DATA SIDE (pure: no DOM; runs in simstate/tapeworker.js, and in node for
// tools/lenscheck.mjs). It holds the director's cut the server handed over (GET /tape: hourly snapshots + every event, private ones too)
// and answers, for any game minute up to the HORIZON (never past it):
//   frame(t)    the city at t as the live feed would draw it (adapter.js adaptLive → only what changed since the last frame: homes,
//               piles, corners; every agent), the secrets on screen at t (thoughts, DMs, private deals), and the selected agents'
//               dossier view at t (card, rap sheet, people, tape: cash, heat, stuff, thoughts, plan)
//   stateAt(t)  the full state at t (section 2b) · markers()  the timeline's events · events(opt)  the log, filtered
// THE RULE: nothing past the horizon. The server clamps /tape to it; this file drops anything newer anyway (defense in depth), and every
// time it is asked for is clamped to [start, horizon] first. tools/lenscheck.mjs plants data past the horizon and checks.
import { createTimeline, stamp } from './timeline.js';
import { adaptLive, createTracker, placeIndex } from './adapter.js';
import { placeBook, liveOf, rapEntry, addTie, peopleOf, tapeOf } from './derive.js';
import { isDM, WANTED, LEDGER_EVENTS } from './lens.js';

// the timeline's markers: one colour per kind (ui tokens --k-ev-<kind>)
export const MARKERS = { rob: 'rob', arrest: 'arrest', death: 'death', mark: 'mark', turf: 'turf', director: 'director' };
// A BREAK-IN'S REPORT is no marker (2026-10-10, slime: "mcpaint house burgled nothing happens"): since lens.js A BREAK-IN IS FOUND the
// sim emits the break-in at its minute (`secret`, the burglar named: the tape's) and, when the street finds it, a public `burgle` with
// `of` (the break-in's id) and no burglar. The tape has the break-in itself, so the report was a second dot for the same crime, hours
// later, where nothing happens (two break-ins found at once: two identical dots); its break-in before the tape's start: nothing to see
// either (the tape draws the house's scar from the break-in's minute on). A marker's `type` is its event's (a burglary: the house)
const markerKind = e => e.type === 'rob' ? (e.ok === false ? null : 'rob') : e.type === 'burgle' ? (e.ok && e.of == null ? 'rob' : null) : e.type === 'killed' ? 'death' : MARKERS[e.type] || null;
// a private deal, shown as a small icon over the agents: offers, whispers, tips, bribes, scams, anything secret (but the ledger's
// payouts, refunds and worn-out tools: the city's doing, not a deal; lens.js LEDGER_EVENTS)
const DEAL_ICON = new Set(['offer', 'loan_offer', 'hire_offer', 'whisper', 'tip', 'bribe', 'scam']);
const NOISE = /^\((local|plan|fallback)\)/;
export const WINDOW = { think: 90, focus: 360, dm: 24, deal: 30 };   // game minutes a thought / the focus agent's last thought / a DM / a deal stays on screen after it happened
const RAP_MAX = 80;

export function createTapePlayer({ places, night = false } = {}) {
  const P = placeIndex(places), B = placeBook(places);
  let SNAPS, EVENTS, BY_AGENT, MARKS, TL, D, epoch = 0;
  // what the live layer shows right now (the page seeds it with the live model on open): the frame sends only what differs
  const drawn = { homes: new Map(), piles: new Map(), corners: new Map() };
  let tracker = createTracker(), trackT = null;
  // everything it holds, new (and again when the sim's clock went back: a new epoch)
  function init() { SNAPS = []; EVENTS = []; BY_AGENT = new Map(); MARKS = []; TL = createTimeline({ snaps: SNAPS, events: EVENTS, places: P });
    D = { horizon: null, start: null, delay: null, archive: false, pending: null, lastId: 0 }; tracker = createTracker(); trackT = null; }
  init();
  // ── the data: load / extend (both drop anything past the horizon)
  function take(resp) {
    if (!resp || resp.pending || typeof resp.horizon !== 'number') { if (resp?.pending && !SNAPS.length) D.pending = resp.pending; return 0; }
    // THE SIM'S CLOCK WENT BACK (a replay's loop or seek back, a restarted sim: review 10-09 #5): a horizon more than a minute behind the
    // one held is a new timeline. What is held is dropped (it would let the tape run past the new horizon), the epoch counts on (the worker
    // fetches the whole tape again), and this answer is taken as the first. The test is broadcast.js's epoch (t < the last t − 1)
    if (D.horizon !== null && resp.horizon < D.horizon - 1) { init(); epoch++; }
    if (D.horizon === null || resp.horizon > D.horizon) D.horizon = resp.horizon;   // (the horizon only moves on, within an epoch)
    D.delay = resp.delay ?? D.delay; D.archive = !!resp.archive; D.pending = null; let n = 0;
    const lastSnap = SNAPS.length ? SNAPS[SNAPS.length - 1].t : -Infinity;
    for (const s of (resp.snapshots || []).slice().sort((a, b) => a.t - b.t)) if (s.t > lastSnap && s.t <= D.horizon) { SNAPS.push(s); n++; }
    for (const e of (resp.events || []).slice().sort((a, b) => a.id - b.id)) { if (!(e.id > D.lastId) || typeof e.t !== 'number' || e.t > D.horizon) continue;
      if (EVENTS.length && e.t < EVENTS[EVENTS.length - 1].t) continue;   // (the timeline needs them in time order: a server never sends one out of order)
      D.lastId = e.id; const k = EVENTS.push(e) - 1; n++;
      for (const h of new Set([e.who, e.to])) if (typeof h === 'string') { let L = BY_AGENT.get(h); if (!L) BY_AGENT.set(h, L = []); L.push(k); }
      const mk = markerKind(e); if (mk) MARKS.push({ id: e.id, t: e.t, kind: mk, type: e.type, text: e.text || e.type, who: e.who ?? null, to: e.to ?? null, at: e.at ?? null }); }
    D.start = SNAPS.length ? SNAPS[0].t : null;
    return n;
  }
  const clamp = t => D.start === null || D.horizon === null || t === null || t === undefined || Number.isNaN(+t) ? null : Math.max(D.start, Math.min(D.horizon, +t));
  const upTo = t => TL.lastEventUpTo(Math.floor(t));
  // ── the state at t (full: tape lens) and the events that drive the hotspots and piles (the last six hours, as the live feed sees them)
  function stateAt(t) { const T = clamp(t); if (T === null) return null; const m = Math.floor(T), S = TL.advance(m);
    const n = upTo(m); S.events = EVENTS.slice(TL.firstEventAt(m - 360), n); S.running = true; return S; }
  // ── one frame: the city diff, the secrets, the agents asked for
  function frame(t, { agents: want = [], snap = false } = {}) {
    const T = clamp(t); if (T === null) return null; const m = Math.floor(T), S = stateAt(m);
    if (snap || trackT === null || m < trackT || m - trackT > 240) { tracker = createTracker(); }   // (a seek: start the six-hour estimate over)
    trackT = m;
    const M = adaptLive(S, places, P, tracker);
    const homes = changed(drawn.homes, sigHome, M.homes.values(), h => ({ id: h.id, tier: h.tier, owner: h.owner, vacant: h.vacant, forRent: !!h.forRent, lit: h.lit, asleep: h.asleep, away: h.away, sec: [...h.sec], scars: [...h.scars] }));
    const piles = changed(drawn.piles, sigPile, M.piles.values(), p => ({ ...p })), corners = changed(drawn.corners, sigCorner, M.corners.values(), c => ({ ...c }));
    return { t: T, ts: stamp(m), horizon: D.horizon, start: D.start,
      diff: { t: m, ts: S.ts, clock: M.clock, hasClock: true, running: true, crowd: M.crowd, rush: M.rush, wanted: M.wanted, patrols: M.patrols, stationCops: M.stationCops, agents: M.agents, homes, piles, corners },
      secrets: secretsAt(m), agents: Object.fromEntries(want.filter(Boolean).map(h => [h, agentAt(S, h, m)])),
      cards: Object.fromEntries((S.agents || []).map(a => [a.handle, liveOf({ ...a, wanted: (a.heat || 0) >= WANTED }, B)])) };   // (every agent's card as of t: the hover label in TAPE)
  }
  // what the layer draws from each (simstate/feed.js: the same signatures, so a frame redraws exactly what the live feed would)
  const sigHome = h => `${h.tier}|${h.owner ? 1 : 0}|${h.forRent ? 1 : 0}|${[...h.sec].sort().join(',')}|${[...h.scars].sort().join(',')}` + (night ? `|${h.lit ? 1 : 0}${h.asleep ? 1 : 0}${h.away ? 1 : 0}` : '');
  const sigPile = p => `${Math.round(p.level)}|${p.spill ? 1 : 0}`;
  const sigCorner = c => { const h = c.rush ? 1 : Math.max(0, Math.min(1, c.heat)); return `${Math.round(h * 4)}|${h > .62 ? 2 : h > .3 ? 1 : 0}`; };
  const changed = (map, sig, list, pack) => { const out = []; for (const v of list) { const s = sig(v); if (map.get(v.id) !== s) { map.set(v.id, s); out.push(pack(v)); } } return out; };
  // seed: what the layer shows now (the live model: homes with sec / scars as arrays or Sets)
  function seed({ homes = [], piles = [], corners = [] } = {}) {
    drawn.homes.clear(); drawn.piles.clear(); drawn.corners.clear();
    for (const h of homes) drawn.homes.set(h.id, sigHome({ ...h, sec: new Set(h.sec), scars: new Set(h.scars) }));
    for (const p of piles) drawn.piles.set(p.id, sigPile(p)); for (const c of corners) drawn.corners.set(c.id, sigCorner(c)); }
  // ── the secrets on screen at minute m: each agent's latest thought (fading over WINDOW.think), DMs, private deals
  function secretsAt(m) {
    const from = TL.firstEventAt(m - Math.max(WINDOW.focus, WINDOW.dm, WINDOW.deal)), n = upTo(m), thinks = new Map(), dms = [], deals = [];
    for (let k = from; k < n; k++) { const e = EVENTS[k], age = m - e.t;   // (each agent's latest thought of the last WINDOW.focus minutes: the page shows the focus agent's, and the others' of the last WINDOW.think)
      if (e.think && e.who && !NOISE.test(e.think)) thinks.set(e.who, { h: e.who, text: e.think, t: e.t, did: e.type, id: e.id });
      if (isDM(e) && age <= WINDOW.dm && e.who) dms.push({ id: e.id, from: e.who, to: e.to, text: e.text, t: e.t });
      if ((e.secret || DEAL_ICON.has(e.type)) && !LEDGER_EVENTS.has(e.type) && age <= WINDOW.deal && e.who) deals.push({ id: e.id, who: e.who, to: typeof e.to === 'string' ? e.to : null, type: e.type, text: e.text, t: e.t }); }
    return { t: m, thinks: [...thinks.values()], dms, deals };
  }
  // ── one agent at minute m, as the dossier shows it (the tape lens: everything, as of m)
  function agentAt(S, h, m) {
    const a = (S.agents || []).find(x => x.handle === h); if (!a) return null;
    const ix = BY_AGENT.get(h) || [], n = upTo(m), evs = []; for (const k of ix) { if (k >= n) break; evs.push(EVENTS[k]); }
    const rap = []; for (const e of evs) { const r = rapEntry(e, h, B); if (r) rap.push(r); }
    const ties = new Map(); for (const e of evs) addTie(ties, e);
    const card = liveOf({ ...a, wanted: (a.heat || 0) >= WANTED }, B);
    return { handle: h, asOf: m, ts: stamp(m), live: card, rap: rap.slice(-RAP_MAX).reverse(), people: peopleOf(h, ties, S.crews || []), tape: tapeOf(S, h, evs), mine: null,
      x: a.x ?? null, z: a.z ?? null, at: a.at ?? null, trip: a.trip ?? null };
  }
  // ── the log, filtered (oldest first; never past the horizon: nothing past it is ever kept)
  function events({ from = null, to = null, handle = null, types = null, limit = 0 } = {}) {
    const Ty = types ? new Set(types) : null, lo = from === null ? 0 : TL.firstEventAt(from), hi = to === null ? EVENTS.length : upTo(Math.min(to, D.horizon ?? to));
    let out; if (handle) { out = []; for (const k of BY_AGENT.get(handle) || []) if (k >= lo && k < hi && (!Ty || Ty.has(EVENTS[k].type))) out.push(EVENTS[k]); }
    else { out = EVENTS.slice(lo, hi); if (Ty) out = out.filter(e => Ty.has(e.type)); }
    return limit > 0 ? out.slice(-limit) : out; }
  return {
    take, frame, seed, stateAt, events, clamp,
    markers: () => MARKS,
    window: () => ({ start: D.start, horizon: D.horizon, loadedTo: SNAPS.length ? D.horizon : null, delay: D.delay, archive: D.archive, pending: D.pending, epoch }),
    stats: () => ({ snapshots: SNAPS.length, events: EVENTS.length, markers: MARKS.length, lastId: D.lastId }),
  };
}
