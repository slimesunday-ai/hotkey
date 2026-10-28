// HUMAN LAYER · THE PAGE STORE: the only module the human-facing screens read sim data from. API and rules: STORE.md.
//   import { sim } from './simstate/store.js'
// It starts itself on a ?sim=live page (or ?sim=demo), polling in its own worker (storeworker.js → storefeed.js: the lens, the cards,
// the rap sheets, people, the tape — all derived once per poll, never per frame). The map's own feed, layer and walkers are untouched:
// without this module ?sim=live draws exactly as before, and with it too. The lens is enforced in the feed (lens.js, the sim's own
// filter code): what reaches this module is the public view, plus the claimed agent's owner view and the director's cut, delayed.
// Reading is free: every getter returns what the last poll left (cached arrays and objects; don't mutate them).
import { publicCards, cityEvent, islandClock } from './record/adapter.js';
import { createLine, mergeState, delayS } from './broadcast.js';   // (BROADCAST: the delay line, simstate/broadcast.js)

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const MODE = Q.get('sim'), SIDE_Y = 0.2;   // (style.js SIDE: the sidewalk's height, for an agent that isn't drawn)
let clockOf, sdata, recordPlayer = null, recordOff = null, recordState = null;
const subs = new Map(), cards = new Map(), byHandle = new Map(), events = [];
let list = [], started = false, worker = null, inline = null, places = null, book = null, resolveReady, info = { status: 'off', error: null, lastOk: 0, stats: null, ownerErr: null };
let C = { t: null, at: 0, rate: 0, running: false }, last = null, history = { complete: true, from: null, gaps: 0, lastGap: null, trimmed: 0, director: null }, tapeInfo = { horizon: null, asOf: null, delay: null, pending: false }, world = { crews: [], loans: [], news: [], cityEv: null, mostWanted: null, stats: null, statsCut: null };
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const emit = (type, v) => { const s = subs.get(type); if (s) for (const fn of [...s]) { try { fn(v); } catch (e) { console.error('[sim store]', type, e); } } };

export const sim = {
  ready: new Promise(r => { resolveReady = r; }),
  lens: 'public',          // 'public' (a live season) | 'archive' (a finished one: the replay's --archive)
  me: null,                // the claimed handle (?as=), or null
  get info() { return info; },
  // { t, day, hhmm, night, speed }: t runs on between polls at the rate measured between them (game minutes per real second = speed).
  // Offline, once the delay line has played out what it held, it stands at the last state the sim sent (review 10-09 #13: it ran on
  // 3 game minutes past it, stopped, and jumped back when the sim answered again)
  clock() { if (recordPlayer) return { ...islandClock(recordPlayer.minute), speed: recordPlayer.running ? recordPlayer.speed / 60 : 0, running: recordPlayer.running };
    if (C.t === null) return null; const n = info.status === 'offline' && !line.stats().queued ? Math.min(nowMs(), Math.max(offAt, C.at)) : nowMs();
    const t = C.t + Math.min(C.rate * (n - C.at) / 1000, Math.max(3, C.rate * 3)), c = clockOf(Math.floor(t));
    return { t, day: c.day, hhmm: `${String(c.hh).padStart(2, '0')}:${String(c.mm).padStart(2, '0')}`, night: c.night, speed: C.running ? +C.rate.toFixed(3) : 0, running: C.running }; },
  agents() { return list; },   // the public cards: [{ handle, cls, model, look, status, at, placeName, now, crew, home, homeName, wear, drip, marks, wanted, lastSay, npc, localOf, retired, trip, act, x, z, district, indoors, coarse }]
  agent(h) { return byHandle.get(h) || null; },   // { live, mine | null, tape | 'pending' | null, rap: [...], people: { crew, ties } }
  // where the agent is in the world: its walker (drawn: true), else the place it is in (drawn: false, indoors: true), else on a ride
  // between two places (drawn: false, moving: true); null when unknown or dead
  where(h) {
    const a = typeof window !== 'undefined' ? window.__simlive?.agents?.map?.get(h) : null, p = a?.w?.p;
    if (p) return { x: p[0], y: p[1], z: p[2], drawn: true, indoors: false, place: a.d?.place ?? null };
    const c = cards.get(h); if (!c || c.status === 'dead' || !book) return null;
    if (c.trip && C.t !== null) { const f = book.get(c.trip.from), to = book.get(c.trip.to); if (f && to) { const t = sim.clock().t, k = c.trip.arr > c.trip.dep ? Math.max(0, Math.min(1, (t - c.trip.dep) / (c.trip.arr - c.trip.dep))) : 1;
      return { x: f.x + (to.x - f.x) * k, y: SIDE_Y, z: f.z + (to.z - f.z) * k, drawn: false, indoors: false, moving: true, place: null }; } }
    const id = c.status === 'jail' ? 'jail' : c.status === 'hospital' ? 'hospital' : c.at, P = book.get(id);
    if (P) return { x: P.x, y: SIDE_Y, z: P.z, drawn: false, indoors: true, place: id };
    if (typeof c.x === 'number' && typeof c.z === 'number') return c.coarse ? { x: c.x, y: SIDE_Y, z: c.z, drawn: false, indoors: false, coarse: true, place: id ?? null } : { x: c.x, y: SIDE_Y, z: c.z, drawn: false, indoors: true, place: id ?? null };   // (coarse: someone else's lot, the district's middle — lens.js rule 5)
    return null; },
  // the agent nearest a world point (a click on the ground, a hover): only drawn walkers, within r m. → handle | null
  pick(x, z, r = 1.5) { let best = null, bd = r * r; const M = typeof window !== 'undefined' ? window.__simlive?.agents?.map : null; if (!M) return null;
    for (const [h, a] of M) { const p = a.w?.p; if (!p) continue; const d = (p[0] - x) ** 2 + (p[2] - z) ** 2; if (d < bd) { bd = d; best = h; } } return best; },
  // 'tick' (every poll, ~1 s: { t, changed: [handles] }), 'event' (each new public event), 'agent:<handle>' (that agent's card, rap, people,
  // tape or mine changed: the new sim.agent(h)), 'mine' (each new event of the claimed agent's own: an owner's alert, at broadcast time),
  // 'status' ({ status, error }), 'lens' (the lens or the claim changed), 'epoch' ({ t }: the sim's clock went back — a replay's loop or
  // seek back, a restarted sim — and everything was started over: the tape too). All at broadcast time (the delay line) but 'status', and
  // 'agent:<me>' when only the claimed agent's mine changed: that one is real time. Returns unsubscribe.
  on(type, fn) { let s = subs.get(type); if (!s) subs.set(type, s = new Set()); s.add(fn); sim.start(); return () => s.delete(fn); },
  // the public events the page has seen (and the whole public log before it joined, from the server's GET /events), oldest first
  events({ handle = null, types = null, since = null, limit = 0 } = {}) {
    const T = types ? new Set(types) : null; let out = events.filter(e => (!handle || e.who === handle || e.to === handle) && (!T || T.has(e.type)) && (since === null || e.t > since));
    return limit > 0 ? out.slice(-limit) : out; },
  // the world's public extras: crews, loans (debts are public), news, the Director's city event, the Most Wanted, the live public stats,
  // and statsCut: the secret counts (scams, bribes …) as of the director's cut (yesterday's totals; null while pending)
  world() { return world; },
  // Record seam: raw feed projection, presented board, and playback controls. Never exposes future frames.
  record() { return recordPlayer?.snapshot() ?? null; },
  board() { return recordState?.board ?? null; },
  get playback() { return recordPlayer; },
  useRecord(player) {
    recordOff?.(); recordPlayer = player; started = true; sim.me = null; sim.lens = 'public';
    info = { ...info, source: 'record', status: 'record', error: null };
    recordOff = player.on(applyRecord); applyRecord(player.snapshot(), { reset: true });
    return sim;
  },
  // is sim.events() the whole public log? { complete, from (null: from the season's start; else the game minute it starts at), gaps (how
  // many times the server's window skipped events the page couldn't fetch: a server without GET /events), lastGap { after, before, t, ts },
  // trimmed (events dropped off the page's 20 000), director (the same for the director's events, or null) }
  history() { return history; },
  // the director's cut, for section 2's scrubbable tape: horizon = the newest game minute it may show (null: pending or not served)
  tape: {
    get horizon() { return tapeInfo.horizon; }, get asOf() { return tapeInfo.asOf; }, get delay() { return tapeInfo.delay; }, get pending() { return tapeInfo.pending; },
    // GET /tape (the replay, and the sim since b46c49e): { horizon, from, to, clamped, snapshots: [full hourly snapshots], events: [all events] }
    // opt.handle: only that agent's events; opt.snaps: false skips the snapshots. Clamped to the horizon by the server, not here.
    async get(from, to, opt = {}) { if (recordPlayer) return { horizon: recordPlayer.minute, from, to: Math.min(to, recordPlayer.minute), snapshots: [],
        events: sim.events({ handle: opt.handle }).filter(e => e.t >= from && e.t <= to) };
      if (!info.url) throw new Error('the store has no sim'); const u = new URL('tape', info.url); u.searchParams.set('from', from); u.searchParams.set('to', to);
      if (opt.handle) u.searchParams.set('handle', opt.handle); if (opt.snaps === false) u.searchParams.set('snaps', '0');
      const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`tape: HTTP ${r.status}`); return r.json(); },
  },
  pollNow() { if (recordPlayer) return; worker ? worker.postMessage({ type: 'poll' }) : inline?.pollNow(); },
  // start polling: automatic on a ?sim=live / ?sim=demo page; opt { url, as, token, interval, places } for tests and other pages
  start(opt = {}) {
    if (started) return sim; const live = MODE === 'live', demo = MODE === 'demo' || MODE === '1';
    if (!opt.url && !live && !demo) return sim; started = true;
    let port = +(Q.get('simport') || 5251), url = opt.url || (demo ? new URL('./demo.json', import.meta.url).href : Q.get('simurl') || `http://127.0.0.1:${port}/state`);
    if (!opt.url && !demo && Q.get('movemock') === '1') url += (url.includes('?') ? '&' : '?') + 'movemock=1';   // (MOVEMENT W3a: the replay's dev mock of the trip legs)
    const as = opt.as ?? Q.get('as') ?? null, token = opt.token ?? Q.get('token') ?? null, interval = opt.interval ?? (demo ? 60000 : Math.max(250, +(Q.get('simpoll') || 1000)));
    sim.me = as; info = { ...info, status: 'connecting', url };
    (async () => {
      const [adapter, city] = await Promise.all([import('./adapter.js'), import('../../../world/city.js')]);
      clockOf = adapter.clockOf; sdata = city.sdata;
      places = opt.places || await fetch(new URL(sdata('../../../sim2/places.json'), import.meta.url)).then(r => r.json()).catch(() => ({ places: [], lots: [] }));
      book = new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p]));
      const o = { url, places, as, token, interval, delay: Q.has('shot') ? 0 : delayS() };   // (delay: the join backfills the delay line, storefeed.js)
      try { worker = new Worker(new URL('./storeworker.js', import.meta.url), { type: 'module' }); worker.onmessage = e => onMsg(e.data);
        worker.onerror = e => { console.warn('[sim store] worker failed (' + (e.message || 'error') + '): polling on the main thread'); worker?.terminate(); worker = null; startInline(o); };
        worker.postMessage({ type: 'start', opt: o }); }
      catch { worker = null; startInline(o); }
    })();
    return sim; },
  stop() { if (recordPlayer) { recordPlayer.pause(); recordOff?.(); recordOff = null; } worker?.postMessage({ type: 'stop' }); worker?.terminate(); worker = null; inline?.stop(); line.clear(); },
};
function applyRecord(state, meta) {
  const previous = new Map(events.map(e => [e.id, e]));
  recordState = state;
  list = publicCards(state); cards.clear(); byHandle.clear();
  for (const c of list) { cards.set(c.id, c); byHandle.set(c.id, { live: c, mine: null, tape: null, rap: null, people: null }); }
  events.length = 0; for (const e of state.events) events.push(cityEvent(e));
  world = { ...state.board, news: events };
  history = { complete: true, from: null, gaps: 0, lastGap: null, trimmed: 0, director: null };
  // These getters follow the playhead, even between feed frames.
  tapeInfo = { get horizon() { return recordPlayer.minute; }, get asOf() { return recordPlayer.minute; }, delay: 0, pending: false };
  if (meta.reset) emit('epoch', { t: state.minute });
  else for (const e of events) if (JSON.stringify(previous.get(e.id)) !== JSON.stringify(e)) emit('event', e);
  const changed = list.map(c => c.id);
  for (const h of changed) emit('agent:' + h, byHandle.get(h));
  emit('tick', { t: state.minute, changed });
  if (resolveReady) { resolveReady(sim); resolveReady = null; }
}
async function startInline(o) { if (inline) return; const { createStoreFeed } = await import('./storefeed.js'); inline = createStoreFeed({ ...o, onMsg }); inline.start(); }

// BROADCAST (simstate/broadcast.js): a state reaches the page D s after it came, in order (?delay=, Settings; D = 0 and a shot: at
// once, as before); every getter and every event (tick, event, agent:) runs at broadcast time. A status is never delayed
const line = createLine({ name: 'store', release: applied, merge: mergeState, tOf: m => m.t, ...(Q.has('shot') ? { delay: () => 0 } : {}) });
function onMsg(m) { if (m.type !== 'state') return apply(m); if (line.delayed) takeMine(m); else mineNow = undefined; line.push(m, m.since ? { ago: (Date.now() - m.since) / 1000 } : undefined); }   // (since: a state the join backfilled)
// THE OWNER UNDER THE DELAY (slime, 2026-10-09: the TV plan's pick 5). The public city is delayed for everyone; an owner's own panel is
// not: the claimed agent's `mine` (me, myEvents: sim.agent(me).mine) is taken the moment a state arrives, and 'agent:<me>' fires then.
// Its alerts wait for broadcast time: 'mine' fires once per new event of its own (myEvents) when the state that brought it is released,
// with the public events of that moment. D = 0: none of this (the state is applied as it comes, mine with it).
let mineNow, mineSig = '', alertId = null, offAt = 0;   // (offAt: when the sim stopped answering: the clock stands from then)
function takeMine(m) {
  if (!m.as || m.as !== sim.me) return; const c = m.changed.find(c => c.handle === m.as); if (!c) return;
  const sig = JSON.stringify(c.mine ?? null); if (mineNow !== undefined && sig === mineSig) return; mineSig = sig; mineNow = c.mine ?? null;
  const cur = byHandle.get(m.as); if (cur) { byHandle.set(m.as, { ...cur, mine: mineNow }); emit('agent:' + m.as, byHandle.get(m.as)); } }
function applied(m) { const t0 = nowMs(); apply(m); if (m.type === 'state') { const ms = nowMs() - t0; info.applyMs = +ms.toFixed(3); info.applyMaxMs = Math.max(info.applyMaxMs || 0, info.applyMs); } }
function apply(m) {
  if (m.type === 'status') { const st = m.ok ? 'live' : 'offline'; if (st === 'offline' && info.status !== 'offline') offAt = nowMs(); if (st !== info.status || m.error !== info.error) { info = { ...info, status: st, error: m.ok ? null : m.error, retryIn: m.retryIn ?? null, lastOk: m.ok ? Date.now() : info.lastOk }; emit('status', { status: st, error: info.error }); } return; }
  if (m.type !== 'state') return;
  const epoch = !!(m.reset && last && m.t < last.t - 1);   // (the sim's clock went back: broadcast.js's epoch, released the moment the line flushed)
  const pageT = nowMs();   // the clock: the rate measured between polls (smoothed), reset when the sim jumps back
  if (C.t !== null && m.t < C.t - 1) C.rate = 0; else if (C.t !== null && pageT - C.at > 250) { const r = Math.max(0, (m.t - C.t) / ((pageT - C.at) / 1000)); C.rate = C.rate ? C.rate * .6 + r * .4 : r; }
  C = { t: m.t, at: pageT, rate: m.running === false ? 0 : C.rate, running: m.running !== false };
  if (m.reset) { events.length = 0; }
  const lens = m.archive ? 'archive' : 'public', lensChanged = lens !== sim.lens || (last && last.ownerErr !== m.ownerErr); sim.lens = lens;
  info = { ...info, stats: m.stats, ownerErr: m.ownerErr, applyMs: info.applyMs, applyMaxMs: info.applyMaxMs };
  tapeInfo = { horizon: m.horizon, asOf: m.asOf, delay: m.delay, pending: m.pending }; if (m.history) history = m.history;
  world = { crews: m.crews, loans: m.loans, news: m.news, cityEv: m.cityEv, mostWanted: m.mostWanted, stationCops: m.stationCops ?? null, stats: m.cityStats, statsCut: m.statsCut };
  for (const e of m.events) events.push(e); if (events.length > 20000) events.splice(0, events.length - 20000);
  const changed = [];
  for (const c of m.changed) { cards.set(c.handle, c.live); byHandle.set(c.handle, { live: c.live, mine: c.handle === sim.me && mineNow !== undefined ? mineNow : c.mine, tape: c.tape, rap: c.rap, people: c.people }); changed.push(c.handle); }   // (mineNow: the owner's own, real time)
  if (m.roster) { const keep = new Set(m.roster); for (const h of [...cards.keys()]) if (!keep.has(h)) { cards.delete(h); byHandle.delete(h); } }
  if (changed.length || m.roster) list = (m.roster || list.map(c => c.handle)).map(h => cards.get(h)).filter(Boolean);
  last = m;
  if (lensChanged) emit('lens', { lens, me: sim.me, ownerErr: m.ownerErr });
  if (epoch) emit('epoch', { t: m.t });
  if (!m.reset) for (const e of m.events) emit('event', e);   // (the first poll's events are the log so far: history, not news)
  if (sim.me) { const my = m.changed.find(c => c.handle === sim.me)?.mine?.myEvents; if (my?.length) { const top = my.reduce((x, e) => Math.max(x, e.id), -Infinity);   // (the owner's alerts, at broadcast time)
    if (m.reset || alertId === null) alertId = top; else { for (const e of my) if (e.id > alertId) emit('mine', e); alertId = Math.max(alertId, top); } } }
  for (const h of changed) emit('agent:' + h, byHandle.get(h));
  emit('tick', { t: m.t, changed });
  if (resolveReady) { resolveReady(sim); resolveReady = null; }
}
if (typeof window !== 'undefined') { window.__simstore = sim; if (MODE === 'live' || MODE === 'demo') sim.start(); }
