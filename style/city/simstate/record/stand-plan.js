// C2-seek · THE STAND PLAN (docs/redesign/tape-20261103.md, design A): which stand spot each agent stands on at a place, stay by stay.
// Node-safe, as cast-plan.js is: a pure function of the drawing's own states (continuity.js createStateAt: who is at which place from
// which minute, where its trip ended, its row's role and partner), each place's spot list, the lane cost from a trip's end to a spot,
// and the cast plan's kept-off spots, reservations and planned figure spots (cast-plan.js createStandInputs). Nothing here reads which
// walkers exist, which spot a frame found free, the order of a seek's re-placement or the crowd. Playing to a minute and seeking there
// read the same plan.
//   the sweep   every agent's state, minute by minute in time order, every place at once: when a stay ends its spot is freed; when one
//               starts its agent is given the spot agents.js claim() gives an arrival (the same cost: its partner's side, the place's
//               order, the way from its trip's end, the act's spot kind, never a kept-off spot), against the stays present then — so an
//               agent who has left since still held its spot when the next one came, as on play; at each minute the cast plan's answers
//               may change (bounds), every agent standing does what a standing agent does on that frame (onto its planned spot; off a
//               planned spot whose window is over; off a spot newly kept off, onto the best free one, else it stays)
//   causal      the sweep reaches minute m only through states at minutes up to m, and the cast plan of a night only from its
//               publication: nothing later, nothing unpublished (tools/standcheck.mjs: prefix, causal)
//   lazy        swept only as far as asked, and kept: a seek back reads the records; a seek on sweeps on from where it got
// Left out, by design (the note's condition 1): the marks of the scenes the cast plan doesn't cast, which the stage frees ground for from
// the crowd at the frame they start (stage/record.js liveKept). The drawing steps a walker aside from those live, as before.
import { HOME } from './continuity.js';

// the measured stand spots, and room beside each (1 m either side) for a crowd larger than the spots (draw.js's `wide`)
export function widenStands(stands) {
  return { ...stands, places: Object.fromEntries(Object.entries(stands.places).map(([id, p]) => [id, { ...p, spots: [...p.spots, ...[1, -1].flatMap(s => p.spots.map(sp => {
    const ry = sp.ry ?? 0; return { ...sp, x: sp.x + Math.cos(ry) * s, z: sp.z - Math.sin(ry) * s, ax: sp.x, az: sp.z, kind: 'open', pace: undefined, beat: undefined, lean: undefined, sit: undefined, over: true };
  }))] }])) };
}

// each agent's own plays of the show (draw.js): an ambient scene with one public actor, or its own walk (night 14's walk rows, the
// ambient board row, a backer's walk beat: C1-7d, SHOW.md "C1-7a2"). → playAt(id, m) → the scene it plays at m, or null
export function createPlayAt(planner, nights) {
  const plays = new Map(), isWalk = sc => !!sc.route && (sc.kind === 'walk' || (sc.kind === 'board' && sc.beat === 'ambient') || (sc.kind === 'back' && sc.beats?.[0]?.name === 'walk'));
  for (const n of nights) for (const sc of planner.night(n).scenes) {
    const walk = isWalk(sc) && sc.publicActors.length === 1;
    if ((sc.beat === 'ambient' || walk) && sc.publicActors.length === 1) { const id = sc.publicActors[0]; (plays.get(id) || plays.set(id, []).get(id)).push(sc); } }
  return (id, m) => plays.get(id)?.find(sc => sc.start <= m && m < sc.end) ?? null;
}

// an agent's stand state at minute t, from the drawing's: { st: { key, place, arrive, role, pair } | null, next } — st null when it
// stands at no place's spot (on a trip, a ride, hidden, indoors where the place has no spots); next: the next minute it may change
// (a segment's start, a row's within it, a trip's arrival: the drawing's own `next`)
export function createStandStates({ timeline: TL, stateAt, spotsOf, playAt = () => null, meetings = new Map() }) {
  const starts = new Map();
  for (const [id, list] of TL.segs) { const out = []; for (const seg of list) { out.push(seg.start); for (const r of seg.more || []) out.push(r.start); } starts.set(id, out.sort((a, b) => a - b)); }
  const after = (id, t) => { const L = starts.get(id) || []; let lo = 0, hi = L.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (L[mid] > t) hi = mid; else lo = mid + 1; } return L[lo] ?? Infinity; };
  return function stateOf(id, t) {
    const s = stateAt(id, t), next = Math.min(s.next ?? Infinity, after(id, t));
    if (s.hidden || s.trip || s.ride) return { st: null, next };
    const place = s.jail ? 'jail' : s.place;
    if (!place || place.startsWith('lot:') || !(spotsOf(place)?.length)) return { st: null, next };
    const tt = s.t, sc = playAt(id, t), cue = tt?.role === 'meet' && tt.meet != null ? meetings.get(tt.meet) : null;
    const role = sc ? 'show' : tt?.role ?? (tt?.reason === 'corner' ? 'deal' : 'hang');
    return { st: { key: `${place}|${s.since ?? s.seed ?? ''}`, place, arrive: s.arrive ?? null, role, pair: cue ? (cue.a === id ? cue.b : cue.a) : null, home: place.startsWith(HOME) }, next };
  };
}

// the cost from a trip's end p [x, y, z] to a spot, as agents.js's claim prices it: the walk the world's own graph plans (trips.js walkLen)
// up to 100 m, else straight and dearer than any. Not the walkers' lanes: those are streamed with the blocks the camera has been near
// (page history), and a plan priced on them changed with where the viewer had looked
export const nearByWalk = walkLen => p => s => { const L = walkLen([p[0], p[2]], [s.x, s.z]); return L !== null && L <= 100 ? L : Math.hypot(s.x - p[0], s.z - p[2]) + 100; };

// spotOf(id, place, m) → the spot object (an entry of spotsOf(place), or a planned spot of the cast plan's), null (no spot free:
// indoors), or undefined (no stay of its there at m: the caller claims as before)
export function createStandPlan({ roster, from, stateOf, spotsOf, near = () => null, kept = () => false, planned = () => null, bounds = () => [] }) {
  const hashS = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let T, rec, occ, cur, at;
  const S = { claims: 0, events: 0, resets: -1, ms: 0 };
  function reset() { T = -Infinity; rec = new Map(); occ = new Map(); cur = new Map(); at = new Map(); S.resets++; }
  reset();
  const occOf = place => occ.get(place) ?? occ.set(place, new Map()).get(place);
  // (a spot is held by its index in its place's list; a planned spot of the cast plan's by its object)
  const refOf = (place, sp) => { if (!sp) return null; if (sp.plan) return sp; const i = spotsOf(place)?.indexOf(sp) ?? -1; return i < 0 ? null : i; };
  const objOf = (place, r) => r === null || r === undefined ? null : typeof r === 'number' ? spotsOf(place)?.[r] ?? null : r;
  function note(id, t, place, r) { const L = rec.get(id) ?? rec.set(id, []).get(id); if (L.length && L[L.length - 1][0] === t) L.pop(); L.push([t, place, r]); }
  function free(id) { const c = cur.get(id); if (c && typeof c.r === 'number') { const O = occOf(c.st.place); if (O.get(c.r) === id) O.delete(c.r); } if (c) c.r = null; }
  function hold(id, r) { const c = cur.get(id); free(id); c.r = r; if (typeof r === 'number') occOf(c.st.place).set(r, id); }
  // agents.js claim(), on the plan's occupancy: the planned spot first; else its own spot here, kept; else the cheapest free one
  function claim(id, t, cost) {
    const c = cur.get(id), place = c.st.place, ps = planned(id, place, t);
    if (ps === false) { free(id); return; }
    if (ps) { hold(id, refOf(place, ps)); return; }
    if (typeof c.r === 'number') return;
    free(id); S.claims++;
    const list = spotsOf(place) || [], O = occOf(place), role = c.st.role, pair = c.st.pair, sit = hashS(String(id)) % 2 === 0;
    const mates = pair && [...O.values()].includes(pair) ? list.filter((s, k) => O.get(k) === pair) : [];
    let best = 1e9, bk = -1;
    list.forEach((s, k) => { if (O.has(k) || kept(s, id, t) || (s.kind === 'bench' && (role !== 'hang' || !sit))) return;
      let v = k + (mates.length ? 4 * Math.min(...mates.map(m => Math.hypot(m.x - s.x, m.z - s.z))) : 0) + (cost ? 1.5 * cost(s, k) : 0);
      if (role === 'deal' && s.pace) v -= 4; if ((role === 'patrol' || role === 'work') && s.beat) v -= 4;
      if (role === 'hang' && sit) v -= s.kind === 'bench' ? 8 : s.kind === 'stoop' ? 7 : s.kind === 'wall' ? 4 : 0;
      if (v < best) { best = v; bk = k; } });
    if (bk < 0) bk = list.findIndex((s, k) => !O.has(k));
    if (bk >= 0) hold(id, bk);
  }
  // at a bound: what a standing agent does on that frame (agents.js update, case 'stand'), on the plan's occupancy
  function react(id, t) { const c = cur.get(id); if (!c) return; const place = c.st.place, ps = planned(id, place, t), old = objOf(place, c.r);
    if (ps && ps !== old) claim(id, t, null);
    else if (!ps && old?.plan) { free(id); claim(id, t, null); }
    else if (!ps && old && kept(old, id, t)) { const k0 = c.r; free(id); claim(id, t, null); if (c.r === null) hold(id, k0); }
    else return;
    note(id, t, place, c.r); }
  function advance(m) {
    if (!(m > T)) return; const t0 = now(), bq = bounds(T, m); let nb = 0;
    if (T === -Infinity) { for (const id of roster) at.set(id, { t: from, next: from }); T = from - 1e-9; }
    for (let guard = 0; guard < 1e7; guard++) {
      let t = Infinity; for (const id of roster) { const a = at.get(id); if (a.next < t) t = a.next; }
      while (nb < bq.length && bq[nb] <= T) nb++;
      const b = nb < bq.length ? bq[nb] : Infinity; if (b < t) t = b;
      if (!(t <= m)) break;
      const moved = [];
      for (const id of roster) { const a = at.get(id); if (a.next > t) continue; const o = stateOf(id, t); a.t = t; a.next = o.next > t ? o.next : t + 1e-6;
        const c = cur.get(id); if ((c?.st.key ?? null) === (o.st?.key ?? null)) continue;
        if (c) { free(id); cur.delete(id); note(id, t, null, null); }
        if (o.st) moved.push([id, o.st]); }
      for (const [id, st] of moved) { cur.set(id, { st, r: null }); claim(id, t, st.arrive ? near(st.arrive, st.place) : null); note(id, t, st.place, cur.get(id).r); }
      if (b === t) for (const id of roster) react(id, t);
      T = t; S.events++;
    }
    T = m; S.ms += now() - t0;
  }
  function spotOf(id, place, m) { advance(m); const L = rec.get(id); if (!L?.length) return undefined;
    let lo = 0, hi = L.length - 1, i = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (L[mid][0] <= m) { i = mid; lo = mid + 1; } else hi = mid - 1; }
    if (i < 0 || L[i][1] !== place) return undefined; const r = L[i][2]; return r?.plan ? planned(id, place, m) ?? objOf(place, r) : objOf(place, r); }
  // the spot it held at minute m, wherever (a trip's lead from where it stood): undefined when none
  function heldAt(id, m) { advance(m); const L = rec.get(id); if (!L?.length) return undefined;
    let lo = 0, hi = L.length - 1, i = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (L[mid][0] <= m) { i = mid; lo = mid + 1; } else hi = mid - 1; }
    if (i < 0 || L[i][1] === null) return undefined; const r = L[i][2]; return (r?.plan ? planned(id, L[i][1], m) ?? objOf(L[i][1], r) : objOf(L[i][1], r)) ?? undefined; }
  // the records up to m, for the check: [id, [[t, place, spot index | 'plan:<scene>' | null], …]]
  function records(m) { advance(m); return [...rec].map(([id, L]) => [id, L.filter(r => r[0] <= m).map(([t, p, r]) => [+t.toFixed(6), p, r && typeof r === 'object' ? r.k : r])]); }
  return { spotOf, heldAt, reset, advance, records, stats: () => ({ ...S, T, records: [...rec.values()].reduce((n, L) => n + L.length, 0) }) };
}
