// MOVEMENT W3b · THE SUBWAY IN THE CITY (MOVEMENT.md §3, §5). Loaded by main.js on a live page, the record page and for ?subway=1. The
// carriage (carriage.js and its rigs) comes in at mount and builds its stage, shaders compiled, in the load-in (C2-carriageperf: before,
// on the first open, which stalled the page as the ride opened); a ride opens on that stage.
//   STAIRS   an agent on a `stairs` leg walks to the station's stairs and goes down them out of view on the stairs_down clip, the feet
//            on the treads (flight() below); underground (the platform waits, the rides) it isn't drawn; on the `stairs` leg up it
//            comes up the same flight on stairs_up, and W3a's walker takes the walk from there. The seam is W3a's: simstate/movement.js
//            UNDER.hook(leg, simNow, legs, agent) → a draw ({ show, x, y, z, yaw, vc }) for the legs it hands over (stairs, platform, ride).
//   RIDE     when the camera follows an agent that goes underground, the carriage scene opens over the city and plays the ride on the page's
//            clock (C2-transit: the movement's, simstate/movement.js ONE CLOCK — the hook hands it over): live and on the record (?sim=record)
//            alike, the city's loop runs on under it (its draw skipped while the carriage covers it: api.cover, main.js), so the record's
//            clock, its speed, pause, seek and the tape's transport keep working (the transport stays over the carriage); paused, the
//            carriage stands still. When the ride's last leg ends it closes, and the follow camera, which rode the street stand-in under the
//            carriage (simstate/movement.js standUnder), picks the agent up coming up the stairs. A seek closes it; one into a ride (or
//            still in it) opens it again where playing there would. Not opened (the stand-in on the street is the ride, as before): the
//            viewer left this ride (Esc, ×), it is nearly over (3 s), the rest of it would pass in under OPEN_MIN real s at the page's
//            speed, the live tape is open (NOT ON THE TAPE below), or the carriage failed to load
//   ?subway=1  a demo ride straight away (&from=<place>&to=<place>, default trailer → docks: SUNNY ACRES on the NEON, change at
//            WASHINGTON for the TIDE, up at LOW TIDE; &speed=<×>, &at=<s> to start that far in).
import { loadNet, programOf } from './net.js';
import * as CL from '../anim/cast/clips/index.js';   // (the stairs clips: anim/cast/clips/transit.js)
import { sdata } from '../../../world/city.js';   // (SPREAD: the data this spread reads)
import { tape } from '../ui/tape/state.js';   // (TAPE owns the clock: no ride opens while it is on, maybeRide below)

// THE FLIGHT (subway stations agent, 2026-10-08). Every station's stairs are cut to the clips' steps (transit.js STAIR: rise 0.18, tread
// 0.36, 14 treads, the first 13 under the open sky, the rest under a soffit), and its block's anchors say where (gen.js / transit.js:
// top = the top nosing's middle, dir = down the flight, y = the landing, nose = how far the nosing is in from the street line). The clips
// (anim/cast/clips/transit.js stairs_down / stairs_up: a 0.8 s loop of 2 treads, not moving clips) want their OWNER to move the walker
// 0.9 m/s along and 0.45 m/s down or up a line: down, the line through the nosings, from the top nosing at clip t = 0 (each foot lands in
// the middle of a tread); up, the line through the feet of the risers, 0.18 m lower, from the foot of the flight at t = 0 (each foot
// lands just behind a nosing), one riser more onto the landing. Down: the walk in to the top nosing (`out` m, up onto an entrance's pad
// at the street line), 14 treads in 5.6 s, gone under the soffit. Up: 15 risers in 6.0 s from under the soffit, the walk out. (It used
// to run 3.6 m down a straight line from the kiosk's door, through treads that stood above the sidewalk: the walker sank through them.)
const RISE = .18, TREAD = .36, N = 14, V = .9;   // must agree with transit.js STAIR and with the clips (checked below)
const FLIGHT = { out: 1.3, walk: 1.3 };
// (a demo's own legs, timed in its own seconds: a minute is a second)
const DEMO_CLOCK = { secondsPerMinute: 1, now: () => null, pace: () => 1, epoch: () => 0 };
// real seconds the rest of a ride must last on screen for the carriage to open (at 60× a 3-minute ride passes in 3 s)
const OPEN_MIN = 2.5;
let openRide = null, opening = false, lastOpen = null;
const SIDE = .2;
{ for (const c of [CL?.CLIP?.stairs_down, CL?.CLIP?.stairs_up]) if (c?.stair && (Math.abs(c.stair.rise - RISE) > 1e-6 || Math.abs(c.stair.tread - TREAD) > 1e-6 || Math.abs((c.speed ?? V) - V) > 1e-6))
  console.warn(`subway: the ${c.name} clip steps ${c.stair.rise} × ${c.stair.tread} at ${c.speed} m/s; the stations are cut for ${RISE} × ${TREAD} at ${V} (transit.js STAIR)`); }

// where a station's stairs are: its block's anchors (the flight's top nosing, its direction, the landing). A station whose block isn't
// built yet (or an anchor from before the stairs) falls back on the slot: the stairs going in from its street face.
function wellOf(net, id, anchors) {
  const st = net.stations.get(id); if (!st) return null;
  let a = null; for (const A of anchors?.values?.() ?? []) { const t = A?.transit?.find?.(t => t.id === id && t.kind === 'subway'); if (t) { a = t; break; } }
  if (a?.top && a?.dir) return { top: a.top, dir: a.dir, yaw: Math.atan2(a.dir[0], a.dir[1]), y: a.y ?? SIDE, nose: a.nose ?? .3, w: a.w, entry: a.entry, door: true };
  const f = st.face === '-z' ? 1 : -1, d0 = a ? [a.x, a.z] : [st.x, st.z - f * 1.5];
  return { top: [d0[0], d0[1] + f * .3], dir: [0, f], yaw: f > 0 ? 0 : Math.PI, y: SIDE, nose: .3, door: !!a };
}

export function mountSubway(api, { Q } = {}) {
  const S = { rides: 0, stairs: 0, hooked: false, ends: {}, fallback: { tape: 0, late: 0, fast: 0, failed: 0 } };
  if (Q?.get('subway') && Q.get('subway') !== 'stairs') demo(api, Q).catch(e => console.error('subway demo:', e));   // (?subway=stairs: the module only, for the stairs stand-in)
  let net = null; loadNet().then(n => { net = n; }).catch(e => console.warn('subway: no network', e));
  // (C2-carriageperf: the carriage's stage built and its shaders compiled now, in the load-in, not as the first ride opens: carriage.js
  // prewarmCarriage. Not for shots, which never ride, nor the demo, which rides at once)
  if (!Q?.has('shot') && !Q?.get('subway')) import('./carriage.js').then(m => m.prewarmCarriage()).catch(e => console.warn('subway: prewarm', e));
  import('../simstate/movement.js').then(M => { if (!M.UNDER) return; S.hooked = true; M.UNDER.hook = (L, now, legs, a, clock) => net ? under(L, now, legs, a, clock) : null; }).catch(() => {});
  const OUT = { show: true, x: 0, y: 0, z: 0, yaw: 0, vc: 0, mode: 'stairs' };
  function under(L, now, legs, a, clock = DEMO_CLOCK) {
    if (L.kind !== 'stairs') { maybeRide(a, legs, now, clock); return null; }   // the platform, the ride: out of view (the carriage, if followed)
    const W = wellOf(net, L.from, api.ANCHORS); if (!W) return null; S.stairs++;
    return flight(L, now, legs, a, W, clock);
  }
  // the flight: down — the walk in to the top nosing, then stairs_down on its own clock, then out of view (the ride may open); up — out
  // of view, then stairs_up from the foot of the flight, then the walk out onto the sidewalk, timed off the leg's END so the walker is
  // out just as the walk after it starts. A short leg runs the whole thing faster, the clip with it (the feet stay put). No stairs clips
  // (an older cast): the same lines with the walk's legs going.
  function flight(L, now, legs, a, W, clock) {
    const spm = clock.secondsPerMinute, T = Math.max(.5, (L.arr - L.dep) * spm), tau = Math.max(0, (now - L.dep) * spm), down = L.dir !== 'up', clips = !!(CL?.CLIP?.stairs_down && CL.CLIP.stairs_up);
    const tSt = (down ? N : N + 1) * TREAD / V, tWalk = (down ? FLIGHT.out : FLIGHT.out - TREAD) / FLIGHT.walk, k = Math.min(1, T / (tWalk + tSt + .2));
    const s = down ? tau / k : (tau - (T - (tWalk + tSt) * k)) / k, [tx, tz] = W.top, [dx, dz] = W.dir;
    const at = (al, y, yaw, o) => ({ show: true, x: tx + dx * al, y, z: tz + dz * al, yaw, mode: 'stairs', ...o });
    const yWalk = al => al >= -W.nose ? W.y : al <= -W.nose - .12 ? SIDE : SIDE + (W.y - SIDE) * (al + W.nose + .12) / .12;   // (the sidewalk, then up onto an entrance's pad)
    const step = (clip, t) => clips ? { vc: 0, clip, clipT: t, stand: true } : { vc: V * k };
    if (down) { if (s < tWalk) { const al = -FLIGHT.out + s * FLIGHT.walk; return at(al, yWalk(al), W.yaw, { vc: FLIGHT.walk * k }); }
      const t = s - tWalk; if (t >= tSt) { maybeRide(a, legs, now, clock); return null; }
      const al = t * V; return at(al, W.y - al * RISE / TREAD, W.yaw, step('stairs_down', t)); }
    if (s < 0) return null;
    if (s < tSt) { const al = N * TREAD - s * V; return at(al, W.y - RISE - al * RISE / TREAD, W.yaw + Math.PI, step('stairs_up', s)); }
    const al = -TREAD - Math.min(FLIGHT.out - TREAD, (s - tSt) * FLIGHT.walk); return at(al, yWalk(al), W.yaw + Math.PI, { vc: s - tSt < tWalk ? FLIGHT.walk * k : 0 });
  }
  // the follow camera's subject is an agent going under → the ride opens
  const followed = a => { const c = api.cam, s = c?.subject; return !!(c && c.mode === 'follow' && s && s.agent && String(s.aid) === String(a.id)); };
  // NOT ON THE TAPE (2026-10-10, the tape click-through): the live page's tape covers the city with its own screens and its marker clicks
  // are on the timeline the carriage would cover (tools/tapeclick.mjs --open watch:xXbadvibesXx --at 650). On the live tape the rider is
  // out of view underground, like anyone indoors. (It froze the tape before: the carriage paused the city's loop. It no longer does)
  // a.rideNo: the ride (its run's legs) the viewer left (Esc, ×) or that ran out: not opened again. A seek or a follow let go closes the
  // carriage without it: the hook opens it again where the ride is, if the agent is still under (a seek back makes a new run: new legs)
  function maybeRide(a, legs, now, clock) {
    if (openRide || opening || !net || !followed(a) || a.rideNo === legs) return;
    if (tape.active) { S.fallback.tape++; a.rideNo = legs; return; }
    const spm = clock.secondsPerMinute, P = programOf(net, legs, spm); if (!P || clock.now() === null) return;
    // (the run's own minute: a late cab before it makes the whole trip late, R.delay — the ride plays where the run has it)
    const off = now - clock.now(), ep = clock.epoch(), tOf = () => { const m = clock.now(); return m === null ? null : (m + off - P.t0) * spm; };
    const t = tOf(); if (t > P.dur - 3) { S.fallback.late++; a.rideNo = legs; return; }   // (nearly there: not worth opening)
    if ((P.dur - t) / Math.max(1e-6, clock.pace()) < OPEN_MIN) { S.fallback.fast++; a.rideNo = legs; return; }
    // (kept open while the camera follows this agent and the clock hasn't jumped: a seek or a follow let go closes it)
    const keep = () => followed(a) && clock.epoch() === ep && !tape.active;
    S.rides++; opening = true;
    ride(api, net, P, { id: a.id, handle: a.rec?.handle || a.rec?.id || a.id }, tOf, { keep, hud: hudBottom(), under: !!document.getElementById('record-player'),
      onEnd: why => { S.ends[why] = (S.ends[why] || 0) + 1; if (why === 'done' || why === 'left') a.rideNo = legs; } })
      .catch(e => { S.fallback.failed++; a.rideNo = legs; console.error('subway ride:', e); }).finally(() => { opening = false; });
  }
  // (the record's transport bar, #record-player, and its news ticker stay over the carriage — slime 10-31, "Panels on top": the carriage
  // goes under the record's panels, under: true — and the carriage's own bottom cards sit above the higher of the two)
  const hudBottom = () => { if (typeof document === 'undefined') return 16; const tops = ['record-player', 'r-ticker'].map(id => document.getElementById(id)?.getBoundingClientRect()).filter(r => r && r.height).map(r => r.top);
    return tops.length ? Math.max(16, Math.ceil(innerHeight - Math.min(...tops)) + 10) : 16; };
  // a stand-in walker down (or up) a kiosk's stairs, on the hook's own path: for looking at the stairs without waiting for a trip (shots, clips)
  function stairsDemo(id, dir = 'down', secs = 6, look = 5) { const sim = api.peds?.sim; if (!sim || !net) return null; const L = { kind: 'stairs', from: id, to: id, dep: 0, arr: secs, dir }, legs = [L], who = { id: 'w3b-stairs-' + dir };
    const d0 = under(L, 0, legs, who) || under(L, L.arr * .99, legs, who); if (!d0) return null; sim.removeAgent?.(who.id); const w = sim.putAgent({ id: who.id, look, fix: [d0.x, d0.y, d0.z, d0.yaw] }); if (!w) return null;
    const t0 = performance.now(); return new Promise(res => { const tick = () => { const p = (performance.now() - t0) / 1000 / secs, d = under(L, Math.min(1, p) * L.arr, legs, who);
      if (d) { w.fix = [d.x, d.y, d.z, d.yaw]; w.vc = d.vc; w.ph += .05; w.mv = d.clip ? d : null; } if (p < 1.15) requestAnimationFrame(tick); else { sim.removeAgent(who.id); res(true); } }; tick(); }); }
  api.subway = { stats: () => ({ ...S, open: !!openRide, openFor: openRide?.agentId ?? null, lastOpen }), get open() { return openRide; }, get openFor() { return openRide?.agentId ?? null; }, ride: (P, agent, now) => ride(api, net, P, agent, now), stairsDemo, under: (L, now, legs, a, clock) => net ? under(L, now, legs, a, clock) : null,
    well: id => net ? wellOf(net, id, api.ANCHORS) : null };
  return api.subway;
}

// open the carriage over the city: the city's loop runs on, its draw skipped while the carriage covers it (api.cover, main.js)
// o.keep() → false closes it (a seek, the follow let go); o.onEnd(why): 'done' (the ride ran out), 'left' (Esc, ×), 'seek' (keep false)
async function ride(api, net, P, agent, now, o = {}) {
  if (openRide) return openRide; const { openCarriage } = await import('./carriage.js');   // (o.under: under the page's panels, the record's)
  const end = why => { openRide = null; document.body.classList.remove('subway-open'); api.cover?.(false); o.onEnd?.(why); };
  // (C2-carriageperf: the riders bake in the page's build workers, api.pool, where it has them: carriage.js askBakes)
  const bake = api.pool?.exec ? job => api.pool.exec(job) : null, t0 = performance.now();
  const h = await openCarriage({ program: P, net, now, agent, seed: (P.t0 * 13) | 0, keep: o.keep, hud: o.hud, under: !!o.under, onClose: end, bake });
  lastOpen = h.timing ?? {}; lastOpen.ms = +(performance.now() - t0).toFixed(1);
  // (closed while it was being made — Esc during its shaders' compile: end() has run)
  if (h.closed) return null;
  openRide = h; openRide.agentId = agent?.id ?? null; document.body.classList.add('subway-open'); api.cover?.(true);
  return openRide;
}

// ?subway=1: a demo ride (the export's own trip planner, so it is the ride the sim would book)
async function demo(api, Q) {
  const [net, W, T] = await Promise.all([loadNet(), fetch(new URL(sdata('../../../world/export/world.json'), import.meta.url)).then(r => r.json()), import('../../../world/export/travel.mjs')]);
  const tr = T.createTravel(W).trip(Q.get('from') || 'trailer', Q.get('to') || 'docks', 'subway', { dep: +(Q.get('dep') || 600) });
  const P = tr && programOf(net, tr.legs);   // (the demo's legs on a live page's minute) if (!P) { console.warn('subway demo: no subway ride for that trip'); return; }
  const speed = +(Q.get('speed') || 1), at = +(Q.get('at') || 0), t0 = performance.now(), seed = Q.get('seed');
  const agent = { id: Q.get('agent') || 'xXbadvibesXx', handle: Q.get('agent') || 'xXbadvibesXx' };
  const now = () => at + (performance.now() - t0) / 1000 * speed;   // (the demo's own clock, in the program's seconds)
  api.subwayDemo = { trip: tr, program: P };
  return ride(api, net, P, agent, now);
}
