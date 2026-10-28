// TRAFFIC CONTRACT (streets pass, 2026-09-28) — the shared, deterministic rules the cars, streets and traffic agents all build on.
// Keep this API stable; the streets agent may tune timings (constants) but not the shapes of what these functions return.
//
// Roads (world/city.js via plan.js): an x-line L is the N–S road on x = L·P, present beside block row j when segX(L, j);
// a z-line L is the E–W road on z = L·P, present beside block column i when segZ(L, i). Half-widths hwX(L) / hwZ(L):
// 2 = side street (4 m, one lane of travel + a parking lane once one-way), 4 = avenue (two lanes each way), 7 = Route 9.
// −z is north. Intersections sit at (Lx·P, Lz·P).
import { isAve } from '../plan.js';

// ── one-way side streets, alternating Manhattan-style; avenues and Route 9 stay two-way
export const isOneWay = (axis, L) => !isAve(axis, L);   // (SPREAD: by class, never by width — plan.js isAve)
// direction of travel on a one-way, along the road's own axis: an x-line (N–S) gives ±1 in z, a z-line (E–W) ±1 in x
// TRAFFIC FIX (2026-10-08) · the streets that break the alternation. 3rd St runs EAST: Birch St (north) and 3rd St (west) both ran INTO
// their corner at the trailer park's north-west, so nothing could leave it — the sim pruned Birch St, 3rd St west of Grand and Central
// Ave's westbound lane west of Grand, and routes 4 and 14 were funnelled into the jam. Flipping 3rd St is the one flip that frees it
// (Birch flipped only moves the trap to Birch & Jackson). The paint, the ONE WAY and DO NOT ENTER signs and the parking follow (ground.js,
// street.js, vehicles/index.js read oneWayDir).
// TRANSIT SYNC (2026-10-08) · Fox Run runs EAST too: Elm St (south) and Fox Run (west) both ran into their corner at the south-west suburbs'
// edge (node −5,9), and the sim pruned Elm St's last block and Fox Run's — the second trap. Flipping either frees it (5 → 3 dead lanes);
// Fox Run changes less on screen (12 blocks at the woods' edge, no bus route; Elm St carries the 4 and the 22 and SUNNY ACRES' shelter).
export const ONEWAY_FLIP = new Set(['z:-3', 'z:9']);
export const oneWayDir = (axis, L) => ((((L % 2) + 2) % 2 === 0) === (axis === 'x') ? -1 : 1) * (ONEWAY_FLIP.has(axis + ':' + L) ? -1 : 1);   // even x-lines northbound (−z), even z-lines eastbound (+x)

// ── the shared clock (seconds). The traffic's tick (sim.js; main.js's frame loop without the cars) calls advance; lamps, cars and walkers all read CLOCK.t,
// so what the lights show and what cars and walkers obey can never disagree. ?tclock=<s> seeds it; with ?shot it also holds it there
// (a shot's load-in runs for seconds, so a seeded clock that kept running would land on a different phase every time)
const TQ = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search) : null, TSEED = TQ?.get('tclock') ?? null;
export const CLOCK = { t: TSEED !== null ? (+TSEED || 0) : 0 };
const PINNED = TSEED !== null && TQ.has('shot');
export const advance = dt => { if (!PINNED) CLOCK.t += Math.min(dt, 1); };
// CAB TRAFFIC (2026-10-10) · THE SIGNAL CLOCK IS THE MOVEMENT CLOCK: while the page has one (traffic/fleet.js sync, every step), CLOCK.t is
// its real seconds — game minute × 2.5 — so every light's phase is a pure function of the game's time, and the sim books a cab ride's red
// lights from its departure minute (world/export/travel.mjs carDrive). Without a movement clock (no sim) the lights run on their own.
export const lockClock = t => { if (!PINNED && Number.isFinite(t)) CLOCK.t = t; };   // (MOVEMENT REVIEW #5 #6: with the traffic, traffic/sim.js tick calls it each step, up to TICK.hMax s)

// ── signals at every intersection where an N–S and an E–W road both meet (the streets agent decides which nodes get heads)
// A cycle: N–S green → yellow → all-red → E–W green → yellow → all-red. Avenues get the longer green; green waves run along
// the avenues (about one block of travel, ~3 s at ~11 m/s, per node).
// Streets pass: every node runs ONE cycle length, 44 s (avenueGreen + streetGreen = 2 × evenGreen), so the offsets hold for good — with
// 42 s at avenue × street nodes and 40 s at the rest (the first numbers) neighbours drifted a second or two per cycle and the waves broke up.
// NYC split: the avenue gets 2/3 of the green (24 s against 12 s).
export const TIMING = { yellow: 3, allRed: 1, avenueGreen: 24, streetGreen: 12, evenGreen: 18, wave: 3, flash: 5 };
const greenFor = (nsAve, ewAve) => nsAve === ewAve ? [TIMING.evenGreen, TIMING.evenGreen] : nsAve ? [TIMING.avenueGreen, TIMING.streetGreen] : [TIMING.streetGreen, TIMING.avenueGreen];
export function cycleOf(Lx, Lz) { const nsAve = isAve('x', Lx), ewAve = isAve('z', Lz), [gNS, gEW] = greenFor(nsAve, ewAve);
  const len = gNS + gEW + 2 * (TIMING.yellow + TIMING.allRed), offset = (((Lx + Lz) * TIMING.wave) % len + len) % len; return { gNS, gEW, len, offset }; }
// → { ns, ew: 'G' | 'Y' | 'R', walkAcrossNS, walkAcrossEW, flash }. Pedestrians walk alongside the green: walkAcrossNS (walking E–W,
// over the N–S road) is true while E–W traffic has green, minus the last `flash` seconds (flashing DON'T WALK: finish, don't start).
// TRAFFIC FIX (2026-10-08) · TRANSIT SIGNAL PRIORITY. A route car (traffic/sim.js spawnRoute) asks the junctions ahead of it for its
// green, so the queue in front of it clears instead of holding it through a red. PRIORITY: node key 'Lx,Lz' → { ax: 'ns' | 'ew', on, g, oY, aY, off } — from `on` the
// cross phase ends (its yellow, then the all-red), from `g` the asked axis is green, at `off` (the last route car through, or PRI.hold
// at most) its own yellow and all-red, and then the clock's cycle again; the cross phase then keeps PRI.cool s before the next window.
// The page has one traffic sim, so the table is module state (createTrafficSim clears it); every reader of the lights — lamps.js, the
// walkers (pedsim.js), the cars — goes through signalAt, so the heads, the walk signals and the cars always agree.
export const PRIORITY = new Map();
export const PRI = { reach: 170, hold: 24, cool: 9, ahead: 4 };   // m along its way a route car asks from (ahead: junctions at most); s a window may hold the green; s the cross phase keeps after one
const PHASE_T = (A, O, a, o) => ({ [A]: a, [O]: o });
export function priorityAsk(Lx, Lz, ax, t) {   // → the entry (new or the live one), or null when the junction can't give it now
  const k = Lx + ',' + Lz, p = PRIORITY.get(k), y = TIMING.yellow, r = TIMING.allRed;
  if (p && t < p.off) return p.ax === ax ? p : null;                       // live: the same axis shares it; the cross axis waits
  if (p && t < p.off + y + r + PRI.cool && p.ax === ax) return null;       // the cross phase's turn
  if (p && t < Math.max(p.g, p.off) + (p.g >= p.off ? 0 : y + r)) return null;   // still clearing
  const b = baseSignal(Lx, Lz, t), O = ax === 'ns' ? 'ew' : 'ns', { gNS, gEW, len, offset } = cycleOf(Lx, Lz), s = (((t + offset) % len) + len) % len;
  const endY = q => (q === 'ns' ? gNS + y : gNS + 2 * y + r + gEW) - s;   // s until the axis's yellow ends (while it is yellow)
  let g = t, oY = t, aY = t;
  if (b[ax] === 'G') g = t; else if (b[ax] === 'Y') { aY = t + endY(ax); g = aY + r; } else if (b[O] === 'G') { oY = t + y; g = oY + r; } else if (b[O] === 'Y') { oY = t + endY(O); g = oY + r; } else g = t + r;
  const e = { ax, on: t, g, oY, aY, off: Infinity }; PRIORITY.set(k, e); return e; }
export function priorityDone(Lx, Lz, t) { const p = PRIORITY.get(Lx + ',' + Lz); if (p && p.off === Infinity) p.off = Math.max(t, p.on); }
function baseSignal(Lx, Lz, t) {
  const { gNS, gEW, len, offset } = cycleOf(Lx, Lz), y = TIMING.yellow, r = TIMING.allRed, s = (((t + offset) % len) + len) % len;
  const a = gNS, b = a + y, c = b + r, d = c + gEW, e = d + y;
  const ns = s < a ? 'G' : s < b ? 'Y' : 'R', ew = s >= c && s < d ? 'G' : s >= d && s < e ? 'Y' : 'R';
  const walkAcrossEW = s < a - TIMING.flash, walkAcrossNS = s >= c && s < d - TIMING.flash;
  const flash = (s >= a - TIMING.flash && s < a) || (s >= d - TIMING.flash && s < d);
  return { ns, ew, walkAcrossNS, walkAcrossEW, flash };
}
// THE CAB'S GREEN — GONE (CAB TRAFFIC, 2026-10-10; slime: "cabs can arrive when they arrive like normal traffic"). The TAXI CLOCK's cab
// (2026-10-09) never waited at a red: every signalled junction on its way was given to it (CABWIN, planned round its windows), which cut
// 10–13 s of WALK at 4,0 and 7–17 s at 5,0 per ride (the pilot, the step-1 cab pilot; a local archive, not in this repository). A cab is an ordinary car
// now (traffic/cabs.js): it waits at the lights like every car, and every junction runs its fixed cycle (or a route car's PRIORITY window,
// below — none drives today: the cabs ask none, the stage's cruiser neither).
export function signalAt(Lx, Lz, t = CLOCK.t) {
  const b = baseSignal(Lx, Lz, t), p = PRIORITY.size ? PRIORITY.get(Lx + ',' + Lz) : null; if (!p || t < p.on) return b;
  const A = p.ax, O = A === 'ns' ? 'ew' : 'ns', y = TIMING.yellow, r = TIMING.allRed, NO = { walkAcrossNS: false, walkAcrossEW: false, flash: false };
  if (t < p.g && t < p.off + (p.off < p.g ? 0 : 1e9)) return { ...PHASE_T(A, O, t < p.aY ? 'Y' : 'R', t < p.oY ? 'Y' : 'R'), ...NO };   // the cross phase clearing
  if (p.off <= p.g) return t < p.g ? { ...PHASE_T(A, O, 'R', t < p.oY ? 'Y' : 'R'), ...NO } : b;   // (asked and done before its green came: back to the cycle)
  if (t < p.off) return { ...PHASE_T(A, O, 'G', 'R'), ...NO };                                        // the window: the asked axis green
  if (t >= p.off + y + r || b[A] === 'G') return b;                                                   // released (the cycle's own green carries on where it has one)
  if (baseSignal(Lx, Lz, p.off + y + r)[A] === 'G') return { ...PHASE_T(A, O, 'G', 'R'), ...NO };    // (the cycle's green for it is due: no yellow in between)
  return { ...PHASE_T(A, O, t < p.off + y ? 'Y' : 'R', 'R'), ...NO }; }
// s until the axis's red begins (the green and the yellow left), with the priority windows → sim.js's yellow decisions
export const phaseLeft = (Lx, Lz, axis, t) => phaseLeft0(Lx, Lz, axis, t);
function phaseLeft0(Lx, Lz, axis, t) { const ax = axis === 'x' ? 'ns' : 'ew', p = PRIORITY.size ? PRIORITY.get(Lx + ',' + Lz) : null, y = TIMING.yellow, r = TIMING.allRed;
  if (p && t >= p.on && t < p.off + y + r && p.off > p.g) { if (t < p.g) return ax === p.ax ? Math.max(0, p.aY - t) : Math.max(0, p.oY - t); if (t < p.off) return ax === p.ax ? 1e9 : 0;
    if (baseSignal(Lx, Lz, t)[ax] !== 'G' && baseSignal(Lx, Lz, p.off + y + r)[p.ax] !== 'G') return ax === p.ax ? Math.max(0, p.off + y - t) : 0; }
  const { gNS, gEW, len, offset } = cycleOf(Lx, Lz), s = (((t + offset) % len) + len) % len; return (axis === 'x' ? gNS + y : gNS + 2 * y + r + gEW) - s; }
