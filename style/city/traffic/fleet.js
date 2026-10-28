// THE FLEET (2026-10-09; CAB TRAFFIC, 2026-10-10) · what the traffic keeps for the movement: the cabs (traffic/cabs.js) and the movement
// clock. Node- and worker-safe (no three, no DOM).
//   the path      decodePath: the export's road path decoded onto the traffic sim's links
//   the fleet     createFleet: the movement clock the traffic keeps (setNow each frame, pace() for traffic/sim.js tick), the SIGNAL CLOCK
//                 locked to it (rules.js lockClock: the lights' second is the movement's — game minute × 2.5 — so the sim can book a cab's
//                 red lights from its departure minute), and the cabs' sync at the top of every traffic step
// (CAB TRAFFIC, 2026-10-10: the TAXI CLOCK's side of it went with the clocked cab — the conflict table the cars held short of, the
// junction windows that gave a cab its green (rules.js CABWIN), the zebras kept busy ahead of it, the escort. A cab is an ordinary car.)
import { lockClock } from './rules.js';

import { GAME_MIN } from '../simstate/simclock.js';
export const PACE = { jump: 1.5, quiet: .5 };   // game min the movement clock may move between two frames and still be the pace (more: a seek — simclock.js CLOCK.leap); s without a setNow before the traffic goes back to the page's dt

// ── the export's road path → the traffic sim's links: { links, at: [{ i, s }] per path point, s0 }
export function decodePath(TS, path) {
  if (!TS || !path?.length) return null;
  const laneAt = (x, z) => { let best = null, bd = .15; for (const L of TS.lanes) { const u = (x - L.x0) * L.ux + (z - L.z0) * L.uz; if (u < -.05 || u > L.len + .05) continue;
    const d = Math.hypot(L.x0 + L.ux * u - x, L.z0 + L.uz * u - z); if (d < bd) { bd = d; best = { L, s: Math.max(0, Math.min(L.len, u)) }; } } return best; };
  const p0 = laneAt(path[0][0], path[0][1]); if (!p0) return null; const links = [p0.L], at = [{ i: 0, s: p0.s }]; let L = p0.L;
  for (let k = 1; k < path.length; k++) { const [x, z] = path[k];
    if (k + 2 < path.length && Math.hypot(L.x0 + L.ux * L.len - x, L.z0 + L.uz * L.len - z) < .08) { const q = path[k + 2], cn = L.next.find(c => Math.hypot(c.out.x0 - q[0], c.out.z0 - q[1]) < .08);
      if (cn) { at[k] = { i: links.length - 1, s: L.len }; links.push(cn); at[k + 1] = { i: links.length - 1, s: cn.len / 2 }; links.push(cn.out); L = cn.out; at[k + 2] = { i: links.length - 1, s: 0 }; k += 2; continue; } }
    const u = (x - L.x0) * L.ux + (z - L.z0) * L.uz; if (Math.hypot(L.x0 + L.ux * u - x, L.z0 + L.uz * u - z) > .2) return null;
    at[k] = { i: links.length - 1, s: Math.max(0, Math.min(L.len, u)) }; }
  return { links, at, s0: p0.s };
}

// ── THE FLEET, live. setNow(game min) each frame (simstate/movement.js: the movement's clock, the riders' own); sync() — called at the top
// of the traffic's step — locks the signal clock to it and runs the cabs (o.cabs = traffic/cabs.js createCabs: passed in, not imported —
// cabs.js imports this file, and the build worker's bundler (worker.js) takes no import cycle)
export function createFleet(TS, { cabs: mkCabs = null } = {}) {
  const cabs = mkCabs ? mkCabs(TS) : null;
  // MOVEMENT REVIEW #5 #6 (2026-10-09) · the traffic runs on this clock: pace() hands traffic/sim.js tick() the seconds the movement clock
  // moved since it last asked (setNow), and between two setNow calls the fleet runs on the traffic's own time (TS.t) — every step of a
  // frame, so the signal clock moves step by step with the cars
  let now = null, at = 0, tsAt = 0, owed = null, ext = .25, nowR = 0;   // (game min, the page time and the traffic's time it was set, s owed to the traffic — null: none, take the page's dt —, s it may run on past it)
  const S = { ms: 0 };
  function sync() { if (now === null) return; const t0 = typeof performance !== 'undefined' ? performance.now() : 0, gm = now + Math.min(ext, Math.max(0, TS.t - tsAt)) / GAME_MIN;
    nowR = gm * GAME_MIN; lockClock(nowR);   // (CAB TRAFFIC: the lights on the movement's second)
    cabs?.sync(nowR);
    S.ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0; }
  const fleet = { sync, cabs, stats: () => ({ ...S, cabs: cabs ? cabs.stats() : null }),
    setNow(g) { const p = typeof performance !== 'undefined' ? performance.now() : 0, d = now === null ? null : g - now;
      owed = d === null || d < 0 || d > PACE.jump ? null : (owed ?? 0) + d * GAME_MIN; now = g; at = p; tsAt = TS.t; },   // (back, or more than a leap at once: a seek — the traffic takes the page's dt)
    // the traffic's seconds this frame (sim.js tick): the movement clock's since the last call; null — no movement clock, it went quiet, or it jumped
    pace() { const p = typeof performance !== 'undefined' ? performance.now() : 0; if (now === null || p - at > PACE.quiet * 1000) { owed = null; ext = .25; return null; }
      const o = owed; owed = 0; ext = o === null ? .25 : Math.max(.25, o * 1.25); return o; },
    get now() { return now; }, get nowR() { return nowR; } };
  return fleet;
}
