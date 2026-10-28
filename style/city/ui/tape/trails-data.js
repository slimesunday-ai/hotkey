// HUMAN LAYER · SECTION 2b · TRAILS, THE DATA (pure: no DOM, no three; ui/tools/diarycheck.mjs runs it in node).
// One agent's path over a time window, from PUBLIC movement only: the sim's `move` events (from → to, dep → arr, x0 z0 → x1 z1, taxi)
// and nothing else. A position is public (a witness on the street sees you walk by), so a trail may be drawn LIVE; every other event
// type is ignored here, whatever the caller hands over (a tape window holds private events too).
//   legs    [{ id, t0, t1, from, to, x0, z0, x1, z1, taxi }]   each trip that overlaps the window
//   stops   [{ t0, t1, place, x, z, home }]                    where it stayed between trips (clipped to the window)
// THE LIVE CUTS (the city's rules 2 and 3: no burglar, no unseen robber named anywhere): the public log has the burglar's `move` to the
// victim's lot and the burglary at that lot (its `who` stripped). Put on a map side by side they name the burglar. So in the LIVE lens a
// stay at someone else's lot during which that lot was burgled, and the trip into it, are left off the trail (`cut` counts them). The
// same for a robbery nobody saw (`rob` with `seen: false`, its `who` stripped): a stay at that place during it is left off the trail of
// everyone there but the victim (the public log can't say which of them robbed, so none of them is shown there). The tape shows them.
// Since rule 5 a stay at someone else's lot is public only by its district ('dist:trailer', at the district's middle): such a stay is
// cut when a burglary or an unseen robbery happens during it at a place in that district (the item's `dist`: the caller looks it up in
// sim2/places.json). ui-review 2026-10-09 #1: the cut matched `lot:` stays only, so it never fired, and the trail named the burglar.
// The move OUT of someone else's lot isn't public live (lens.js rule 5, the departure), so with opt.pos (id → { x, z }) such a stay ends
// where the agent next shows up in public: its next public `arrive` at a public place starts a stay there (no leg between: not public).
export const TRAIL_TYPES = new Set(['move']);
export const DAY = 1440;

// opt: { lens: 'live' | 'tape' | 'archive' | 'yours', burgles: [{ at, t, dist? }] (the public burgle events), robs: [{ at, t, to, seen,
//        dist? }] (the public rob events: only `seen: false` ones cut), home: the agent's home lot id, pos?: id → { x, z } | null }
//        (dist: the district of `at`; pos: the place book, for a district stay's end at a public `arrive`)
// robsOf(events) → the unseen robberies of a public log, in the shape `robs` takes
export const robsOf = events => (events || []).filter(e => e && e.type === 'rob' && e.seen === false && e.at).map(e => ({ at: e.at, t: e.t, to: e.to ?? null, seen: false }));
export function tripsOf(events, handle, from, to, opt = {}) {
  const moves = [];
  for (const e of events || []) if (e && TRAIL_TYPES.has(e.type) && e.who === handle && typeof e.x0 === 'number' && typeof e.x1 === 'number') moves.push(e);
  moves.sort((a, b) => (a.dep ?? a.t) - (b.dep ?? b.t));
  const legs = [], stops = [];
  let prev = null;   // the last trip that ended before the window: where it was when the window opened
  for (const m of moves) { const t0 = m.dep ?? m.t, t1 = Math.max(t0, m.arr ?? t0); if (t1 < from) { prev = m; continue; } if (t0 > to) break;
    legs.push({ id: m.id, t0, t1, from: m.from ?? null, to: m.to ?? null, x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1, taxi: !!m.taxi }); }
  // stays: before the first trip (from the window's start), between trips, after the last (to the window's end)
  const stay = (t0, t1, place, x, z) => { const a = Math.max(from, t0), b = Math.min(to, t1); if (b >= a) stops.push({ t0: a, t1: b, place, x, z, home: !!opt.home && place === opt.home }); };
  if (legs.length) {
    const f = legs[0]; stay(prev ? prev.arr ?? prev.t : from, f.t0, f.from, f.x0, f.z0);
    for (let k = 0; k < legs.length; k++) { const L = legs[k], n = legs[k + 1]; stay(L.t1, n ? n.t0 : to, L.to, L.x1, L.z1); }
  } else if (prev) stay(from, to, prev.to, prev.x1, prev.z1);
  if (opt.pos) for (const e of events || []) { if (!e || e.type !== 'arrive' || e.who !== handle || !e.at || String(e.at).startsWith('dist:')) continue;   // (a district stay's end)
    const k = stops.findIndex(s => String(s.place).startsWith('dist:') && e.t > s.t0 && e.t <= s.t1), p = k >= 0 ? opt.pos(e.at) : null; if (!p) continue;
    const s = stops[k], t1 = s.t1; s.t1 = e.t; stops.splice(k + 1, 0, { t0: e.t, t1, place: e.at, x: p.x, z: p.z, home: !!opt.home && e.at === opt.home }); }
  let cut = 0;
  const robs = (opt.robs || []).filter(r => r.seen === false && r.to !== handle);   // (the victim is named in public anyway: its stay stays)
  if ((opt.lens || 'live') === 'live' && (opt.burgles?.length || robs.length)) {
    const coarse = s => String(s.place).startsWith('dist:'), there = (x, s) => x.at === s.place || (coarse(s) && !!x.dist && 'dist:' + x.dist === s.place);
    const during = (x, s) => there(x, s) && x.t >= s.t0 - 1 && x.t <= s.t1 + 1;
    const hit = s => s.place && !s.home && (((String(s.place).startsWith('lot:') || coarse(s)) && (opt.burgles || []).some(b => during(b, s))) || robs.some(r => during(r, s)));
    for (let k = stops.length - 1; k >= 0; k--) { const s = stops[k]; if (!hit(s)) continue; cut++; stops.splice(k, 1);
      for (let j = legs.length - 1; j >= 0; j--) if (legs[j].to === s.place && Math.abs(legs[j].t1 - s.t0) <= 1) { legs.splice(j, 1); break; }
      for (let j = 0; j < legs.length; j++) if (legs[j].from === s.place && Math.abs(legs[j].t0 - s.t1) <= 1) { legs[j] = { ...legs[j], hideStart: true }; break; } }
  }
  return { handle, from, to, legs, stops, cut };
}

// where the agent was at game minute t on the trail (for the tape's "now" dot): { x, z, moving } | null
export function posAt(trail, t) {
  for (const L of trail.legs) if (t >= L.t0 && t <= L.t1) { const k = L.t1 > L.t0 ? (t - L.t0) / (L.t1 - L.t0) : 1; return { x: L.x0 + (L.x1 - L.x0) * k, z: L.z0 + (L.z1 - L.z0) * k, moving: true, leg: L }; }
  for (const s of trail.stops) if (t >= s.t0 && t <= s.t1) return { x: s.x, z: s.z, moving: false, stop: s };
  return null;
}
export const hhmm = t => { const m = ((Math.floor(t) % DAY) + DAY) % DAY; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const dayOf = t => Math.floor(t / DAY) + 1;
export const stampOf = t => `D${dayOf(t)} ${hhmm(t)}`;
export const durOf = m => { m = Math.max(0, Math.round(m)); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + 'm' : ''}` : `${m}m`; };
