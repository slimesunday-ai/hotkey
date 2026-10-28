// C1-3, the drawn half · THE RECORD'S TRIPS, booked by the city's own travel (world/export/travel.mjs: walking, skateboards, scooters
// from bays, bikes, cabs, the subway). Presentation only: no rule reads a trip, and nothing here decides where anyone is
// (placement.js does). A trip is a pure function of (agent, from, to, departure minute), so seeking there equals playing there.
// Units: travel.mjs books real seconds and writes them as its own 2.5 s "game minutes"; the island clock is one game day per real
// day (60 s an island minute at Live: record/clock.js sets GAME_MIN = 60 / speed for the drawing). A trip is booked on the island's
// real-second clock (the subway's timetable and the lights stay on their own seconds) and its dep/arr are rescaled to island minutes.
import world from '../../../../world/export/world.json' with { type: 'json' };
import { createTravel, GAME_MIN as TRAVEL_MIN } from '../../../../world/export/travel.mjs';
import { tuneWorld } from '../movetune.mjs';
import { pickMode } from '../movemock.mjs';

export const ISLAND_MIN_S = 60;
const K = ISLAND_MIN_S / TRAVEL_MIN;
const rescale = (o, dep) => ({ ...o, dep: dep + (o.dep - dep * K) / K, arr: dep + (o.arr - dep * K) / K });

export function createTrips() {
  const T = createTravel(tuneWorld(structuredClone(world))), cache = new Map(), stat = { built: 0, walked: 0, failed: 0, modes: {} };
  const pos = id => { try { const a = T.attachOf(id); return [a.x, a.z]; } catch { return null; } };
  // → { from, to, dep, arr, mode, legs } in island minutes, or null (no way: the drawing cuts to the arrival)
  // walk: on foot whatever pickMode would pick (C1-7: night 14's walk to the dock, GAME.md §15 "walk from home to the dock")
  function plan(agent, from, to, dep, { walk = false } = {}) {
    const key = `${agent}|${from}>${to}@${dep}${walk ? '|walk' : ''}`;
    if (cache.has(key)) return cache.get(key);
    let out = null;
    const a = pos(from), b = pos(to);
    if (a && b && from !== to) {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), night = (dep % 1440) >= 1200 || (dep % 1440) < 360;
      let mode = walk ? 'walk' : pickMode(agent, `${from}>${to}@${dep}`, d), tr = null;
      try { tr = T.trip(from, to, mode, { dep: dep * K, night }); } catch { tr = null; }
      // (nobody takes a train slower than their feet: movemock.mjs's rule)
      if (tr && mode === 'subway') { const w = T.best(from, to, 'walk'); if (w && tr.seconds > w.s * 1.25) tr = null; }
      if (!tr && mode !== 'walk') { mode = 'walk'; stat.walked++; try { tr = T.trip(from, to, 'walk', { dep: dep * K }); } catch { tr = null; } }
      if (tr?.legs?.length) {
        out = Object.freeze({ from: tr.from, to: tr.to, mode, dep, arr: rescale(tr, dep).arr, fare: tr.fare,
          legs: tr.legs.map(l => rescale(l, dep)) });
        stat.built++; stat.modes[mode] = (stat.modes[mode] || 0) + 1;
      } else stat.failed++;
    }
    cache.set(key, out);
    return out;
  }
  return { plan, has: id => T.has(id), stats: () => ({ ...stat, cached: cache.size }) };
}
