// MOVEMENT W3a · the sim's transit numbers over the map export (sim2/rules.mjs MOVE, sim2/world.mjs tune() on sim/movement, 2026-10-07):
// the sim times its trips with these, not the export's first guess, so the city and the dev mock must too. When the export is re-baked
// to the same numbers (W3b) this is a no-op. Pure JS: node (simstate/movemock.mjs) and the page (simstate/movement.js).
export const MOVE_TUNE = { subway: { speed: 16, dwell: 8, headway: 6, stairs: 15, transfer: 20 }, taxi: { hail: 20, stand: 5 } };   // (BUSES OUT, 2026-10-09: no bus row. CAB TRAFFIC, 2026-10-10: the hail back to 20 s, as the sim's MOVE.taxi)
// TRANSIT TIMING (2026-10-08): a run the export MEASURED on the city's traffic (d.timed === 'measured') and a measured taxi are kept as they
// are — the sim's world.mjs tune() books them the same way; only a flat run is re-timed from these numbers.
// SUBWAY PLAN (2026-10-09): a line with its OWN CLOCK (the export's transit.lines[].speed / dwellS) keeps it — its speed, its dwell and its
// headwayMin — and only a line without one is timed from MOVE_TUNE's mode row.
export function tuneWorld(W, M = MOVE_TUNE) { const measuredTaxi = W.modes?.taxi?.t0 !== undefined && !!W.modes.taxi.measured;
  Object.assign(W.transit.timing, { subwaySpeed: M.subway.speed, subwayDwell: M.subway.dwell, stairs: M.subway.stairs, transfer: M.subway.transfer }, measuredTaxi ? {} : { taxiStandWait: M.taxi.stand, taxiHailWait: M.taxi.hail });
  if (W.modes?.subway) W.modes.subway.speed = M.subway.speed;
  for (const l of W.transit.lines) { const R = M[l.kind]; if (!R) continue; const own = l.speed !== undefined, sp = own ? l.speed : R.speed, dw = l.dwellS ?? R.dwell; if (!own && R.headway) l.headwayMin = R.headway;
    for (const d of Object.values(l.dirs)) { if (d.timed === 'measured') continue; d.run.forEach((r, i) => { if (!i) { r.arr = r.dep = 0; return; } const p = d.run[i - 1]; r.arr = +(p.dep + (r.m - p.m) / sp).toFixed(2); r.dep = i === d.run.length - 1 ? r.arr : +(r.arr + dw).toFixed(2); }); } }
  delete W.travel; return W; }
