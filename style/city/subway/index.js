// MOVEMENT W3b · THE SUBWAY IN THE CITY (MOVEMENT.md §3, §5). Loaded by main.js on a live page and for ?subway=1; nothing heavy loads
// until a ride opens (carriage.js and its rigs come in on the first open).
//   STAIRS   an agent on a `stairs` leg walks to the station's stairs and goes down them out of view on the stairs_down clip, the feet
//            on the treads (flight() below); underground (the platform waits, the rides) it isn't drawn; on the `stairs` leg up it
//            comes up the same flight on stairs_up, and W3a's walker takes the walk from there. The seam is W3a's: simstate/movement.js
//            UNDER.hook(leg, simNow, legs, agent) → a draw ({ show, x, y, z, yaw, vc }) for the legs it hands over (stairs, platform, ride).
//   RIDE     when the camera follows an agent that goes underground, the carriage scene opens over the city (the city's loop pauses)
//            and runs for the legs' real time on the sim's clock; when the ride's last leg ends it closes, and the follow camera picks
//            the agent up coming up the stairs (follow finds the walker again by the agent's id).
//   ?subway=1  a demo ride straight away (&from=<place>&to=<place>, default trailer → docks: SUNNY ACRES on the NEON, change at
//            WASHINGTON for the TIDE, up at LOW TIDE; &speed=<×>, &at=<s> to start that far in).
import { GAME_MIN, loadNet, programOf } from './net.js';
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
let openRide = null;
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
  const S = { rides: 0, stairs: 0, hooked: false };
  if (Q?.get('subway') && Q.get('subway') !== 'stairs') demo(api, Q).catch(e => console.error('subway demo:', e));   // (?subway=stairs: the module only, for the stairs stand-in)
  let net = null; loadNet().then(n => { net = n; }).catch(e => console.warn('subway: no network', e));
  import('../simstate/movement.js').then(M => { if (!M.UNDER) return; S.hooked = true; M.UNDER.hook = (L, now, legs, a) => net ? under(L, now, legs, a) : null; }).catch(() => {});
  const OUT = { show: true, x: 0, y: 0, z: 0, yaw: 0, vc: 0, mode: 'stairs' };
  function under(L, now, legs, a) {
    if (L.kind !== 'stairs') { maybeRide(a, legs, now); return null; }   // the platform, the ride: out of view (the carriage, if followed)
    const W = wellOf(net, L.from, api.ANCHORS); if (!W) return null; S.stairs++;
    return flight(L, now, legs, a, W);
  }
  // the flight: down — the walk in to the top nosing, then stairs_down on its own clock, then out of view (the ride may open); up — out
  // of view, then stairs_up from the foot of the flight, then the walk out onto the sidewalk, timed off the leg's END so the walker is
  // out just as the walk after it starts. A short leg runs the whole thing faster, the clip with it (the feet stay put). No stairs clips
  // (an older cast): the same lines with the walk's legs going.
  function flight(L, now, legs, a, W) {
    const T = Math.max(.5, (L.arr - L.dep) * GAME_MIN), tau = Math.max(0, (now - L.dep) * GAME_MIN), down = L.dir !== 'up', clips = !!(CL?.CLIP?.stairs_down && CL.CLIP.stairs_up);
    const tSt = (down ? N : N + 1) * TREAD / V, tWalk = (down ? FLIGHT.out : FLIGHT.out - TREAD) / FLIGHT.walk, k = Math.min(1, T / (tWalk + tSt + .2));
    const s = down ? tau / k : (tau - (T - (tWalk + tSt) * k)) / k, [tx, tz] = W.top, [dx, dz] = W.dir;
    const at = (al, y, yaw, o) => ({ show: true, x: tx + dx * al, y, z: tz + dz * al, yaw, mode: 'stairs', ...o });
    const yWalk = al => al >= -W.nose ? W.y : al <= -W.nose - .12 ? SIDE : SIDE + (W.y - SIDE) * (al + W.nose + .12) / .12;   // (the sidewalk, then up onto an entrance's pad)
    const step = (clip, t) => clips ? { vc: 0, clip, clipT: t, stand: true } : { vc: V * k };
    if (down) { if (s < tWalk) { const al = -FLIGHT.out + s * FLIGHT.walk; return at(al, yWalk(al), W.yaw, { vc: FLIGHT.walk * k }); }
      const t = s - tWalk; if (t >= tSt) { maybeRide(a, legs, now); return null; }
      const al = t * V; return at(al, W.y - al * RISE / TREAD, W.yaw, step('stairs_down', t)); }
    if (s < 0) return null;
    if (s < tSt) { const al = N * TREAD - s * V; return at(al, W.y - RISE - al * RISE / TREAD, W.yaw + Math.PI, step('stairs_up', s)); }
    const al = -TREAD - Math.min(FLIGHT.out - TREAD, (s - tSt) * FLIGHT.walk); return at(al, yWalk(al), W.yaw + Math.PI, { vc: s - tSt < tWalk ? FLIGHT.walk * k : 0 });
  }
  // the follow camera's subject is an agent going under → the ride opens (once per trip)
  const followed = a => { const s = api.cam?.subject; return !!(s && s.agent && String(s.aid) === String(a.id)); };
  // NOT ON THE TAPE (2026-10-10, the tape click-through): the carriage pauses the city's loop and covers the page, and the tape's clock,
  // its transport and its marker clicks all run in that loop — a followed agent going under on the tape (Watch tape at @xXbadvibesXx,
  // the tape at D1 10:50: on the HARBOR line) froze the tape under a carriage for the rest of the ride, and every click on the timeline
  // hit the carriage (tools/tapeclick.mjs --open watch:xXbadvibesXx --at 650). On the tape the rider is out of view underground, like
  // anyone indoors; the ride is LIVE's
  function maybeRide(a, legs, now) {
    if (openRide || !net || !followed(a) || a.rodeLegs === legs || tape.active) return; a.rodeLegs = legs;
    const P = programOf(net, legs); if (!P) return; const t = (now - P.t0) * GAME_MIN; if (t > P.dur - 3) return;   // (nearly there: not worth opening)
    const simRate = () => window.__simlive?.agents?.clock?.rate || 1 / GAME_MIN, n0 = now, p0 = performance.now();   // the sim's clock runs on while the city is paused
    S.rides++; ride(api, net, P, { id: a.id, handle: a.rec?.handle || a.rec?.id || a.id }, () => (n0 + (performance.now() - p0) / 1000 * simRate() - P.t0) * GAME_MIN).catch(e => console.error('subway ride:', e));
  }
  // a stand-in walker down (or up) a kiosk's stairs, on the hook's own path: for looking at the stairs without waiting for a trip (shots, clips)
  function stairsDemo(id, dir = 'down', secs = 6, look = 5) { const sim = api.peds?.sim; if (!sim || !net) return null; const L = { kind: 'stairs', from: id, to: id, dep: 0, arr: secs / GAME_MIN, dir }, legs = [L], who = { id: 'w3b-stairs-' + dir };
    const d0 = under(L, 0, legs, who) || under(L, L.arr * .99, legs, who); if (!d0) return null; sim.removeAgent?.(who.id); const w = sim.putAgent({ id: who.id, look, fix: [d0.x, d0.y, d0.z, d0.yaw] }); if (!w) return null;
    const t0 = performance.now(); return new Promise(res => { const tick = () => { const p = (performance.now() - t0) / 1000 / secs, d = under(L, Math.min(1, p) * L.arr, legs, who);
      if (d) { w.fix = [d.x, d.y, d.z, d.yaw]; w.vc = d.vc; w.ph += .05; w.mv = d.clip ? d : null; } if (p < 1.15) requestAnimationFrame(tick); else { sim.removeAgent(who.id); res(true); } }; tick(); }); }
  api.subway = { stats: () => ({ ...S, open: !!openRide }), get open() { return openRide; }, ride: (P, agent, now) => ride(api, net, P, agent, now), stairsDemo, under: (L, now, legs, a) => net ? under(L, now, legs, a) : null,
    well: id => net ? wellOf(net, id, api.ANCHORS) : null };
  return api.subway;
}

// open the carriage over the city: the city's loop pauses while it is open (api.pauseLoop, main.js), resumes when it closes
async function ride(api, net, P, agent, now, legs = null) {
  if (openRide) return openRide; const { openCarriage } = await import('./carriage.js');
  api.pauseLoop?.(true); document.body.classList.add('subway-open');
  try { openRide = await openCarriage({ program: P, net, now, agent, seed: (P.t0 * 13) | 0, onClose: () => { openRide = null; document.body.classList.remove('subway-open'); api.pauseLoop?.(false); } }); }
  catch (e) { api.pauseLoop?.(false); document.body.classList.remove('subway-open'); throw e; }
  return openRide;
}

// ?subway=1: a demo ride (the export's own trip planner, so it is the ride the sim would book)
async function demo(api, Q) {
  const [net, W, T] = await Promise.all([loadNet(), fetch(new URL(sdata('../../../world/export/world.json'), import.meta.url)).then(r => r.json()), import('../../../world/export/travel.mjs')]);
  const tr = T.createTravel(W).trip(Q.get('from') || 'trailer', Q.get('to') || 'docks', 'subway', { dep: +(Q.get('dep') || 600) });
  const P = tr && programOf(net, tr.legs); if (!P) { console.warn('subway demo: no subway ride for that trip'); return; }
  const speed = +(Q.get('speed') || 1), at = +(Q.get('at') || 0), t0 = performance.now(), seed = Q.get('seed');
  const agent = { id: Q.get('agent') || 'xXbadvibesXx', handle: Q.get('agent') || 'xXbadvibesXx' };
  const now = () => at + (performance.now() - t0) / 1000 * speed;
  api.subwayDemo = { trip: tr, program: P };
  return ride(api, net, P, agent, now);
}
export { GAME_MIN };
