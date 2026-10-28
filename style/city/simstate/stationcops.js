// STATION COPS (2026-10-09; sim/subway cfe86be, rules.mjs STATION_COPS { share .5, shiftMin 120 }) · the sim posts the police at 7 of the
// 13 subway stations, a new posting every 2 game hours; the public state says which (`stationCops: { posted: [station ids], from, until }`,
// lens.js stationCopsOf: a city-wide rota drawn from the seed, nothing about any agent). The city stands two officers at each posted
// station's entrance and changes them with the shift:
//   where    the stands the station's block chose when it was built (transit.js copStands, the anchor's `cops`): one each side of the
//            mouth, facing the street, just outside the entrance (its railings, the kiosk's opening and globe posts), on the sidewalk's
//            building side or the lot — each checked like the cast's standing people: clear of every prop and wall, never in front of
//            the mouth (the way in stays open: transit.js's kerb strip) and never on the walkway's clear path. No room on a side: a lone
//            officer. (An anchor from an older bake has no `cops`: the plain geometry, COPS.out m out, COPS.side m clear of the sides.)
//   who      the precinct officer (cast.js OUTFITS.officer, the jail's and the sally port's: no new art) over a rolled look, from a pool of
//            COPS.pool officers; a station's pair is drawn from the pool by the station and the shift, so a new shift is new faces
//   how      sim agents' walkers standing off the lanes (pedsim putAgent { fix }), the officer's look baked by looks.js (outfit: 'officer');
//            ids 'cop:<station>:<k>', `npc: 'cop'` on the walker (the follow cam's Tab skips them: camera/follow.js nextAgent)
// A station whose block isn't built yet (no anchors) gets its pair when its block comes in. TAPE (ui/tape/map.js) wraps set(): in the
// rewind the cops are the tape's rota at the scrub time, and back in LIVE the live one.
import { SIDE } from '../style.js';

export const COPS = { per: 2, out: .55, side: .45, pool: 8, turn: .45 };   // per station · m out onto the sidewalk · m clear of the entrance's sides · officers · rad turned toward the mouth
const hash = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };

// the stand spots at a station from its block's anchor → [[x, y, z, yaw] × 0–2]: the stands the block's build chose and checked
// (transit.js copStands: clear of every prop and wall, the entrance's own reservations and the walkway's clear path; a side without room
// has none), else — an anchor from an older bake — the plain geometry (top = the top nosing's middle, dir = down the flight, nose = m in
// from the street line, w = the stair's width, entry 'stairs' | 'kiosk'), unchecked
export function copSpots(a) {
  if (Array.isArray(a.cops)) return a.cops.slice(0, COPS.per).map(([x, z, yaw]) => [x, SIDE, z, yaw]);
  const [dx, dz] = a.dir, px = -dz, pz = dx, nose = a.nose ?? .3, sx = a.top[0] - dx * nose, sz = a.top[1] - dz * nose;   // (s: the mouth's middle on the street line)
  const half = (a.entry === 'kiosk' ? Math.max(2, (a.w ?? 4) / 2) : 1.1) + COPS.side, face = Math.atan2(-dx, -dz);
  return [1, -1].slice(0, COPS.per).map(sg => [sx - dx * COPS.out + px * sg * half, SIDE, sz - dz * COPS.out + pz * sg * half, face - sg * COPS.turn]);
}

export function createStationCops({ peds, looks, ANCHORS, log = () => {} }) {
  const live = new Map();   // walker id → { w, station, k }
  let want = null, key = '';
  const sim = () => peds?.sim;
  const anchorOf = id => { for (const A of ANCHORS.values()) for (const t of A?.transit || []) if (t.id === id && t.kind === 'subway' && t.top && t.dir) return t; return null; };
  const lookOf = (station, shift, k) => { const n = (hash(station + '|' + shift) + k * 3) % COPS.pool; return looks ? looks.of({ id: 'cop#' + n, outfit: 'officer' }) : 0; };
  if (looks) for (let n = 0; n < COPS.pool; n++) looks.of({ id: 'cop#' + n, outfit: 'officer' });   // (the whole pool baked up front: a shift change never shows a stand-in look while the new officers bake)
  function remove(id) { sim()?.removeAgent(id); live.delete(id); }
  // draw what `want` says: a pair at each posted station whose anchors are in, none anywhere else
  function sync() { const S = sim(); if (!S) return; const posted = new Set(want?.posted || []), shift = want?.from ?? 0, seen = new Set();
    for (const station of posted) { const a = anchorOf(station); if (!a) continue;
      copSpots(a).forEach((fix, k) => { const id = `cop:${station}:${k}`, look = lookOf(station, shift, k); seen.add(id); let c = live.get(id);
        if (c && c.shift !== shift) { remove(id); c = null; }   // (a new shift: new officers)
        if (!c) { const w = S.putAgent({ id, look, fix }); if (!w) return; w.npc = 'cop'; w.yawS = fix[3]; live.set(id, c = { w, station, k, shift }); }
        else if (c.w.look !== look) c.w.look = look; }); }   // (the officer's look baked since: swap the pooled one for it)
    for (const id of [...live.keys()]) if (!seen.has(id)) remove(id); }
  return {
    // the rota (null: none — an older sim): drawn now, and again whenever anchors come in (refresh)
    set(sc) { want = sc && Array.isArray(sc.posted) ? sc : null; const k = want ? want.from + ':' + want.posted.join() : ''; if (k !== key) { key = k; if (want) log(`station cops: ${want.posted.length} stations, shift ${want.from}–${want.until}`); } sync(); },
    refresh: sync,
    // every frame (live.js, through the agents' drive): an officer's look baked since it stood (looks.js bakes it after it is asked for)
    tick() { if (!looks) return; for (const c of live.values()) { const L = lookOf(c.station, c.shift, c.k); if (c.w.look !== L) c.w.look = L; } },
    get want() { return want; },
    list: () => [...live.values()].map(c => ({ station: c.station, k: c.k, shift: c.shift, x: +c.w.p[0].toFixed(2), z: +c.w.p[2].toFixed(2), look: c.w.look })),
    clear() { for (const id of [...live.keys()]) remove(id); want = null; key = ''; },
  };
}
