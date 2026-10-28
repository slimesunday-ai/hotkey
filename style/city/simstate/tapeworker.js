// HUMAN LAYER · SECTION 2a · the tape player's data side (tapeplay.js) in a module worker: fetching the director's cut (a few MB), the
// state between snapshots and the city diffs stay off the main thread, so opening TAPE never stalls the page.
// The page (ui/tape/index.js) sends:
//   { type: 'open', url, places, night }     fetch GET /tape?from=0&to=<all> (the server clamps it to its horizon), then keep extending
//   { type: 'extend' }                        fetch what is new since the horizon (the live city moved on)
//   { type: 'seed', model }                   what the live layer shows now (homes / piles / corners): frames send only what differs
//   { type: 'frame', id, t, agents, snap }    → { type: 'frame', id, f }   (tapeplay.js frame: the diff, the secrets, the agents asked for)
//   { type: 'state', id, t }                  → { type: 'state', id, state } (the full state at t, clamped)
//   { type: 'reset' }                         the sim's clock went back (the store's epoch): a new, empty player; the next load is a reset
// and gets { type: 'data', window, markers, events: JSON text of the new events, reset? } after every load (reset: true — a new epoch —
// the events are the whole tape: the page drops the ones it held), { type: 'error', error } on a failure.
import { createTapePlayer } from './tapeplay.js';

let tp = null, base = null, loading = null, opt = null;
const post = m => postMessage(m);
// A NEW EPOCH (the sim's clock went back: review 10-09 #5) — the player dropped what it held (tapeplay.js take) or the page said so
// ('reset': the store's epoch) — and the page is told with reset: true and the whole tape, so it drops its own copy of the events
async function load(full) {
  if (loading) return loading;
  return loading = (async () => {
    try { const get = async from => { const u = new URL('tape', base); u.searchParams.set('from', String(from)); u.searchParams.set('to', '99999999');
        const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`GET /tape: HTTP ${r.status}${r.status === 404 ? ' (this sim serves no tape yet)' : ''}`); return r.json(); };
      const w = tp.window(), ep = w.epoch, whole = full || w.horizon === null; let resp = await get(whole ? 0 : w.horizon), before = tp.stats().events; tp.take(resp);
      const back = tp.window().epoch !== ep; if (back && !whole) { resp = await get(0); tp.take(resp); }   // (the player dropped it all: the whole tape)
      const reset = back || reset0; reset0 = false; if (reset) before = 0;
      const all = tp.events(), fresh = all.slice(before);
      post({ type: 'data', window: tp.window(), markers: tp.markers(), events: JSON.stringify(fresh), pending: resp.pending || null, ...(reset ? { reset: true } : {}) }); }
    catch (e) { post({ type: 'error', error: String(e && e.message || e) }); }
    finally { loading = null; }
  })();
}
let reset0 = false;   // (the page's reset: the next data the worker posts is a reset)
onmessage = async e => { const m = e.data || {};
  // a reopen: what it holds at once, then what is new (review 10-09 #10: a tape opened while the sim was offline held nothing, and the
  // reopen said "Nothing on tape yet" until the 10 s extend); nothing held yet: the whole tape again
  if (m.type === 'open') { if (!tp) { opt = { places: m.places, night: !!m.night }; tp = createTapePlayer(opt); base = m.url; await load(true); return; }
    if (tp.window().horizon === null) { await load(true); return; } post({ type: 'data', window: tp.window(), markers: tp.markers(), events: null }); await load(false); return; }
  if (!tp) return;
  if (m.type === 'reset') { if (loading) await loading; tp = createTapePlayer(opt); reset0 = true; return; }   // (the store's epoch: the page closed TAPE; the next open fetches it all)
  if (m.type === 'extend') { await load(false); return; }
  if (m.type === 'seed') { tp.seed(m.model); return; }
  if (m.type === 'frame') { let f = null; try { f = tp.frame(m.t, { agents: m.agents || [], snap: !!m.snap }); } catch (err) { post({ type: 'error', error: 'frame: ' + (err && err.stack || err) }); } post({ type: 'frame', id: m.id, f }); return; }
  if (m.type === 'state') { post({ type: 'state', id: m.id, state: tp.stateAt(m.t) }); return; }
};
