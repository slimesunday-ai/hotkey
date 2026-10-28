// MOVEMENT W3a · THE DEV MOCK OF THE SIM'S TRIP LEGS (MOVEMENT.md §3), until the sim's movement branch (W1, sim/movement) puts
// `trip.legs` on every agent in /state. tools/simreplay.mjs applies it to what it serves when started with --movemock (or per request:
// /state?movemock=1; the page's ?movemock=1 adds that to its feed and store URLs). Pure node/browser JS: world/export/travel.mjs only.
//   for each recorded trip   a mode, picked deterministically from the agent's handle (everyone has a favourite), the trip's straight
//                            distance and the trip's index, so every mode shows up; then travel.mjs trip(from, to, mode, { dep }) builds
//                            the legs (paths, the subway timetable's waits, the taxi's hail). No route for that mode, or a subway much
//                            slower than walking → walked.
//   true sync                the mock's legs are the law the city draws: its arrival is usually later than the recording's (the run
//                            was recorded at 25 m per game minute), so an agent whose mock trip is still under way is served on that
//                            trip (status busy, at null) whatever the recording says, and a recorded trip that starts meanwhile is queued
//                            behind it, from where the agent really is. Jail, hospital and death cut a trip short (an event: the sim's).
//   privacy                  applied AFTER the lens: a trip to someone else's lot is already coarse (dist:…) and gets no legs.
import { createTravel } from '../../../world/export/travel.mjs';
import { tuneWorld } from './movetune.mjs';   // (the sim's own transit numbers: a line's own clock, hail 10 s)

const MODES = ['walk', 'skate', 'bike', 'scooter', 'subway', 'taxi'];   // (BUSES OUT, 2026-10-09)
const hash = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };
export function pickMode(handle, k, d) {   // d: straight metres from → to
  const fav = MODES[hash(handle) % MODES.length], u = (hash(handle + '#' + k) % 10007) / 10007;
  if (d < 70) return fav === 'skate' ? 'skate' : 'walk';
  const W = { walk: d < 350 ? 3 : .6, skate: 1.6, bike: 1.3, scooter: 1, subway: d > 220 ? 2.4 : 0, taxi: d > 260 ? 1.4 : .2 };
  if (W[fav] > 0) W[fav] *= 3.5; let sum = 0; for (const m of MODES) sum += W[m]; let x = u * sum;
  for (const m of MODES) { x -= W[m]; if (x <= 0) return m; } return 'walk'; }

export function createMoveMock(world, { log = () => {} } = {}) {
  const T = createTravel(tuneWorld(world)), M = new Map(), N = new Map(), stat = { built: 0, walked: 0, failed: 0, queued: 0, modes: {} }; let lastT = null;
  const pos = id => { try { const a = T.attachOf(id); return [a.x, a.z]; } catch { return null; } };
  function build(h, from, to, dep) {
    const a = pos(from), b = pos(to); if (!a || !b) return null; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), k = `${from}>${to}@${Math.round(dep)}`;   // (by the trip itself: the same after any seek)
    const night = (dep % 1440) >= 1200 || (dep % 1440) < 360; let mode = pickMode(h, k, d), tr = null;
    try { tr = T.trip(from, to, mode, { dep, night }); } catch (e) { tr = null; }
    if (tr && mode === 'subway') { const w = T.best(from, to, 'walk'); if (w && tr.seconds > w.s * 1.25) tr = null; }   // (nobody takes a train slower than their feet)
    if (!tr && mode !== 'walk') { mode = 'walk'; stat.walked++; try { tr = T.trip(from, to, 'walk', { dep }); } catch { tr = null; } }
    if (!tr || !tr.legs.length) { stat.failed++; return null; }
    stat.built++; stat.modes[mode] = (stat.modes[mode] || 0) + 1; return tr; }
  // S: a served state (its agents are changed in place: pass a copy); t: its game minute
  function apply(S, t) {
    if (lastT !== null && t < lastT - 1) { M.clear(); N.clear(); } lastT = t;
    for (const a of S.agents || []) {
      const h = a.handle; let m = M.get(h);
      if (a.status === 'jail' || a.status === 'hospital' || a.status === 'dead') { if (m) M.delete(h); continue; }   // (an event cuts it short)
      const rt = a.trip && typeof a.trip === 'object' && typeof a.trip.dep === 'number' ? a.trip : null;
      if (rt && T.has(rt.from) && T.has(rt.to) && rt.from !== rt.to) { const key = `${rt.from}>${rt.to}@${rt.dep}`;
        if (!m || (m.key !== key && !m.queue.some(q => q.key === key))) {
          const busy = m && m.trip.arr > t, last = busy ? (m.queue.length ? m.queue[m.queue.length - 1] : m) : null;
          const from = last ? last.trip.to : rt.from, dep = last ? Math.max(rt.dep, last.trip.arr) : rt.dep, tr = from !== rt.to ? build(h, from, rt.to, dep) : null;
          if (tr) { const q = { key, trip: { ...tr, src: { dep: rt.dep, arr: rt.arr } } }; if (busy) { m.queue.push(q); stat.queued++; } else M.set(h, m = { ...q, queue: [] }); } } }
      if (!m) continue;
      while (m.trip.arr <= t && m.queue.length) { const q = m.queue.shift(); m.key = q.key; m.trip = q.trip; }
      if (m.trip.arr <= t) {   // (done: there, while the recording still has them on that trip — a fast mode beats the recording; then as recorded)
        if (rt && m.key === `${rt.from}>${rt.to}@${rt.dep}`) { a.trip = null; a.at = m.trip.to; if (a.status === 'busy') a.status = 'active'; if ('act' in a) a.act = null; } else M.delete(h); continue; }
      if (m.trip.dep > t) { a.trip = null; a.at = m.trip.from; if (a.status === 'busy') a.status = 'active'; continue; }   // (queued: still where the last one ended)
      a.trip = { from: m.trip.from, to: m.trip.to, dep: m.trip.dep, arr: m.trip.arr, mode: m.trip.mode, fare: m.trip.fare, legs: m.trip.legs, mock: true };
      a.status = 'busy'; a.at = null; if ('act' in a) a.act = null; }
    return S; }
  return { apply, stat: () => ({ ...stat, active: M.size }), travel: T };
}
