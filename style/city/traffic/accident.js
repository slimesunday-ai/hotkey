// C2-GORE (2026-10-30) · THE STREET'S ACCIDENTS. slime: "what if some agents get pushed into the street, and if a car is coming they get
// smoked with blood effects lol" · "gore is in 100%" (GAME.md §41) · "nps for now": only the crowd's walkers get hit, never an agent.
//   THE SHOVE   a walking agent held up behind a crowd walker (simstate/movement.js lagStep: its lag ≥ SHOVE.lag) shoves it out of its
//               way: the walker comes off the lanes (pedsim.js offWalker) and stumbles back (hit_stumble_back), across the walk toward the
//               kerb — and sometimes (ROAD) off it, two or three stumbles out into the nearest traffic lane, where it stands dazed, turns
//               to the car coming, and (if nothing hits it) hurries back to the walk and walks on (pedsim.js onWalker).
//   THE HIT     a walker in a lane is a HAZARD to the cars (traffic/sim.js hazards): a car with room stops short; one without brakes
//               as hard as it can and, if it still can't stop, hits them (sim.onHit). The car skids to a stop askew, its hazards on;
//               the traffic behind it queues; after WRECK.stay s it pulls away (sooner, WRECK.cab s, when a cab or a cruiser queues
//               behind it: an accident must not hold up an agent's ride).
//   THE BODY    thrown by the blow (with the car, a little toward the kerb, so it lands clear of the car's lane), tumbling, a bounce, a
//               slide, then on its side (lie_still) where it lands. It lies there at least BODY.linger s and is cleared only when the
//               camera can't see it (nobody vanishes in view): back to the crowd, out of view.
//   THE GORE    stage/gorefx.js: a spray and a mist at the blow, drops that splat on the road and on the car, a trail as it tumbles, a
//               splat where it lands and a pool that spreads under it; skid marks; all of it dries away.
// Never an agent: only generic crowd walkers are shoved, stumble or are hit; an agent's place and clock stay the record's (the shove
// only takes the walker out of its way: its lag is walked off as ever). Cabs, the stage's cruisers and patrols never hit anyone
// (traffic/sim.js canHit) and no walker is sent into a lane with one of them coming.
// ART DIRECTION: ?gore=0 off · ?gore=often frequent (every held-up agent shoves, every shove that can reach a lane waits for a car it
// can't miss) · key X stages a JAYWALKER (slime, 11-04: "x should stage a jaywalker so people watching the playback can just click x and
// cause people to get hit as a fun little feature"): the CAR first — an ordinary car in the frame (traffic/sim.js canHit: never a cab, a
// cruiser or a patrol) at a speed it can't stop from — then a crowd walker in the frame on the kerb ahead of it, whose lane out is the
// car's; the walker walks on until its step off would meet the car, then turns and walks out without looking (its own walk: no new
// clip), into the car's way at a gap the car can't stop in. With no car in the frame that can do it, a line on screen says so and the key
// stays armed (GORE.arm s), trying every tenth of a second. It had waited on the walkers: the bait (an agent's shove, the first 6 s)
// and a walker standing ready at the kerb for a car (up to a light's cycle) — 11 of 18 presses, a median of about 29 s.
// Console: __city.traffic.accidents (stats, now()).
import * as THREE from 'three';
import { CLIP, playClip, stepClip, clearClip, stopClip } from '../anim/cast/clips/index.js';
import { FOOT } from '../stage/crowd.js';
import { createGoreFx, groundY } from '../stage/gorefx.js';
import { kerbOut } from '../plan.js';
import { CAR } from './sim.js';

export const GORE = {
  on: true, often: false,
  // a shove: the agent held up at least lag s behind its booking (or wait s on end), the walker within near m; p: once per hold, per agent; cool: s before
  // that agent shoves again; slide: m the walker is pushed beyond the clip's own 0.52 m on a shove that stays on the walk; corner: never
  // within this of a corner node (no side-step at a corner, a kerb or a ramp: pedsim's rule)
  shove: { lag: .45, wait: .35, near: 1.6, p: .35, cool: 10, slide: .22, corner: 2.4 },
  // off the kerb: a lane within reach m of the walker (its line), mid-block (end m from either end of the lane); p: a shove that can reach
  // one and has a car it can't miss coming goes into the road; pAny: one goes anyway (a near miss, or an empty road). The way out: two
  // stumbles back (DUR s each, 0.52 m — the clip — + its slide: stumble m in all), a turn (turn s), then a dazed stagger the rest of the
  // way at stagger m/s, weaving wobble m; dazed: s it stands in the lane (then back to the walk at back m/s); inLane: m short of the
  // lane's line it stops (inside the car's way)
  road: { reach: 6.2, end: 4.5, p: .45, pAny: .1, stumble: 1.4, turn: .5, stagger: 1.5, staggers: [1.5, 1.2, 1.85, 1, 2.2], wobble: .12, dazed: [1.1, 1.8], back: 1.6, inLane: [.05, .3] },
  // the hit: rare by default — at most `max` bodies down at once, `cool` s between hits (often: its own); hzR: the walker's body as the
  // cars see it (m)
  hit: { max: 1, cool: 75, maxOften: 4, coolOften: 4, hzR: .32 },
  // the throw: up at vy + k·v m/s; it comes to rest ahead[0] … ahead[1] m past where the car stops (most of it in the air, then a bounce
  // and a slide), its middle lat m off the car's line toward the kerb (at most the kerb less a body's half); g: gravity (toon); spin:
  // turns in the air (whole turns: it comes down flat); a bounce of bounce × vy
  throw: { vy: 2.6, k: .16, ahead: [1.2, 2.6], lat: 2.3, g: 15, spin: 1.1, bounce: .28 },
  body: { linger: 28, seenR: 260 },
  wreck: { stay: 16, cab: 3.5, yaw: .14 },
  key: 'KeyX', arm: 60,
  // the key's jaywalker: walk m/s out (a brisk walk, else a hurried one or a stroll: the first at which the car can't miss it), keep:
  // pairs staged at once (the first whose car can't miss it goes; the rest are let go), vNow: m/s the car is doing now at least, tMax: s
  // at most from the step off to the walker in its way (the forecast's horizon), edge: how far out in the frame the walker may be (the
  // middle `edge` of it each way; the hit's spot is kept in its middle 0.8), cool:
  // s after the last hit before a press's hit may come (a press is the viewer asking for one: hit.coolOften is the frequent mode's), turn s (from its way along the walk to the road), wait: s at most from choosing
  // the car to the step off (the walker walks on meanwhile), aim: where in the car's can't-stop window (0: its near end, 1: its far
  // end) the walker enters its way, tell: s with no car in the frame before the line on screen says so; reach: m out to the lane's line
  // at most (it may cross the nearer lane of a two-way street to the car's); near: m from what the camera looks at a car coming may be
  // (it is in the frame at the hit: the hit's spot is); far: m from the camera the walker may be (any tier: the mid and the far
  // have no clips — the tumble and the body laid down are its whole-body turns, w.tq / w.lieQ, as any mid- or far-tier body's); perM: m nearer
  // the camera worth a second sooner (the nearest pair first, all else alike); vMin: m/s at least at the meeting (a hit, not a bump)
  // corner: m from a walk's end it may step off (the shove keeps 2.4 m: a sideways stumble off a corner's ramp; a jaywalker walks
  // straight out), start: m past a lane's start the hit may be (just out of a junction, its far zebra behind the car)
  jay: { walk: [1.6, 1.9, 2.2, 1.35], keep: 4, vNow: 4.5, tMax: 3, edge: .92, cool: 1, corner: 1, start: 1, turn: .35, wait: 4.5, aim: .3, tell: 1.2, reach: 9, near: 90, far: 110, perM: 25, vMin: 6 },
};
const DUR = .8, SHIFT = .52, cOut = (t, a, b) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return 1 - (1 - x) * (1 - x); }, ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const AXIS = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };

export function createAccidents({ scene, peds, sim, night = false, models = [], Q = null, toast = null }) {
  const P = peds.sim, fx = createGoreFx(scene, { night }), cases = new Set(), S = { shoves: 0, road: 0, hits: 0, nearMiss: 0, bodies: 0, cleared: 0, wrecks: 0, rejoined: 0, armed: 0, early: 0, why: {} };
  const q = Q || (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()), g0 = q.get('gore');
  if (g0 === '0' || g0 === 'off' || q.has('shot') || q.has('bake')) GORE.on = false; if (g0 === 'often' || g0 === '1') GORE.often = true;
  let now = 0, armed = 0, armedAt = -1e9, lastHit = -1e9, cam = null, focus = null; const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), SP = new THREE.Sphere();
  const seen = (x, y, z, r = 1.5) => { if (!cam) return false; const d = Math.hypot(x - cam.position.x, y - cam.position.y, z - cam.position.z); if (d > GORE.body.seenR) return false; SP.center.set(x, y, z); SP.radius = r; return FR.intersectsSphere(SP); };
  // (well inside the frame, the middle `m` of it each way: a walker the key picks there stays in view as it staggers out and is thrown)
  const V3 = new THREE.Vector3(), inFrame = (x, y, z, m = .7) => { if (!cam || Math.hypot(x - cam.position.x, z - cam.position.z) > GORE.body.seenR) return false; V3.set(x, y, z).applyMatrix4(PM); return V3.z > -1 && V3.z < 1 && Math.abs(V3.x) < m && Math.abs(V3.y) < m; };
  const heightOf = c => models[c.model]?.H || 1.45;
  // ── the lanes by 32 m cell (once): the traffic lane a walker could stumble into
  const cells = new Map(); for (const L of sim.lanes) { const n = Math.ceil(L.len / 16); for (let k = 0; k <= n; k++) { const s = L.len * k / n, key = Math.floor((L.x0 + L.ux * s) / 32) + ',' + Math.floor((L.z0 + L.uz * s) / 32); let a = cells.get(key); if (!a) cells.set(key, a = []); if (!a.includes(L)) a.push(L); } }
  // the nearest lane out from a walker on side E, in the road's direction (rx, rz): { L, d (m to its line), ua (m along it) } or null
  function laneOut(x, z, rx, rz) { let best = null; const cx = Math.floor(x / 32), cz = Math.floor(z / 32);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const L of cells.get((cx + a) + ',' + (cz + b)) || []) {
      if (Math.abs(L.ux * rx + L.uz * rz) > .05) continue; const dx = L.x0 - x, dz = L.z0 - z, d = dx * rx + dz * rz; if (d < .4 || d > GORE.road.reach + 1.2) continue;
      const ua = (x - L.x0) * L.ux + (z - L.z0) * L.uz; if (ua < GORE.road.end || ua > L.len - GORE.road.end) continue; if (!best || d < best.d) best = { L, d, ua }; }
    return best; }
  // every lane out from a walker along (rx, rz) within reach m of its line, nearest first (the key's jaywalker crosses the nearer ones)
  function lanesOut(x, z, rx, rz, reach, e0 = GORE.jay.start) { const out = [], cx = Math.floor(x / 32), cz = Math.floor(z / 32);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const L of cells.get((cx + a) + ',' + (cz + b)) || []) {
      if (Math.abs(L.ux * rx + L.uz * rz) > .05 || out.some(o => o.L === L)) continue; const dx = L.x0 - x, dz = L.z0 - z, d = dx * rx + dz * rz; if (d < .4 || d > reach) continue;
      const ua = (x - L.x0) * L.ux + (z - L.z0) * L.uz; if (ua < e0 || ua > L.len - GORE.road.end) continue; out.push({ L, d, ua }); }
    return out.sort((p, q) => p.d - q.d); }
  // the car that would meet a walker at ua on lane L, entering its way in tE s: { c, gap (m at tE), ok (an ordinary car it can't miss) };
  // bad: a cab, a cruiser or a patrol coming within 70 m (no walker goes in front of one)
  // (upstream too: on the connectors into the lane, and on the lanes before them, a car committed through the junction — c.go — or with
  // no signal to stop it; soon: or bound for it and not yet committed — the key choosing a pair to stage, never the step off. The nearest one is the one that meets it; m: its nose's distance to ua along the way)
  const isBad = o => o.route || o.stage || o.asCar || o.kind !== 'car';
  function carFor(L, ua, tE, soon = false) { let c = null, m = 1e9, bad = false; const see = (o, d) => { if (d <= 0) return; if (d < 70 && isBad(o)) bad = true; if (d < m) { m = d; c = o; } };
    for (const o of L.cars) see(o, ua - o.s);
    for (const cn of L.feeds) { for (const o of cn.cars) see(o, cn.len - o.s + ua); for (const o of cn.inL.cars) if (o.next === cn && (o.go || !cn.inL.to.sig || soon)) see(o, cn.inL.len - o.s + cn.len + ua); }
    if (!c) return { c: null, bad, ok: false }; const [d, v] = drive(c, tE, L.v0 * (c.dv || 1)), gap = m - GORE.hit.hzR - d, stop = v * v / (2 * CAR.bMax);
    // (and room on the lane past it for the car to stop and the body to land: it never comes down on the next zebra)
    return { c, bad, gap, v, ok: !bad && !c.wreck && v > 5 && gap > .6 && gap < stop - .4 && L.len - ua > stop + c.len * .2 + GORE.throw.ahead[0] + .5 }; }
  // how far a car goes in t s and its speed then, at the acceleration traffic/sim.js gave it this step (a car pulling away from a
  // light or out of a turn gathers speed toward vm, its speed on the lane; one easing off slows): [m, m/s]. A forecast for timing the
  // step off, nothing more: the car's motion is the traffic's. (It had taken the speed now: a car speeding up out of a turn was past
  // before the walker was in its way)
  function drive(c, t, vm) { const v = c.v, a = Math.max(-1.5, Math.min((c.acc || 0) * .6, c.a || CAR.a));
    if (a > 0 && v < vm) { const t1 = Math.min(t, (vm - v) / a), v1 = v + a * t1; return [v * t1 + a * t1 * t1 / 2 + v1 * (t - t1), v1]; }
    if (a < 0) { const t1 = Math.min(t, v / -a); return [v * t1 + a * t1 * t1 / 2, v + a * t1]; }
    return [v * t, v]; }
  // a stumble's plan out along (rx, rz), D m in all: n stumbles back (the clip's 0.52 m each + sl), then — on the way into the road — a
  // turn and a stagger the rest of the way. at(t): m out its body is (as drawn: the clip's root included); base(t): where the walker
  // itself is (the clip's root not yet taken); turn(t): 0 → 1 over the turn (facing the walk → facing the road)
  function plan(x, z, rx, rz, D, road, vs = GORE.road.stagger) { const R = GORE.road, n = road && D > 1.9 ? 2 : 1, Ds = road ? Math.min(D, n === 2 ? R.stumble : .95) : D, sl = (Ds - n * SHIFT) / n, Ts = n * DUR, walk = Math.max(0, D - Ds - .15), Tw = walk > .05 ? R.turn + walk / vs : 0;
    const st = t => { const k = Math.min(n - 1, Math.floor(t / DUR)), u = Math.min(DUR, t - k * DUR); return [k * (SHIFT + sl) + sl * ease(u / .7), SHIFT * cOut(u, .02, .62)]; };
    const after = t => { const u = t - Ts; return Ds + (Tw ? .15 * ease(u / R.turn) + Math.min(walk, vs * Math.max(0, u - R.turn)) : 0); };
    return { n, sl, Ts, Tw, T: Ts + Tw, x, z, rx, rz, D, walk, at: t => { if (t < Ts) { const [b, c] = st(t); return b + c; } return after(t); }, base: t => t < Ts ? st(t)[0] : after(t), turn: t => Tw ? ease((t - Ts) / R.turn) : 0,
      wob: t => t > Ts + R.turn ? R.wobble * Math.sin((t - Ts - R.turn) * 7.5) * Math.min(1, (t - Ts - R.turn) * 2) : 0 }; }
  const enterT = (pl, dLine) => { const edge = dLine - (.9 + GORE.hit.hzR); for (let t = 0; t <= pl.T; t += .05) if (pl.at(t) >= edge) return t; return pl.T; };
  const landBlocked = (L, x, z, kx, kz) => { const pin = globalThis.__city?.parkedIn; if (!pin) return false; for (let a = 1.5; a <= 10; a += 1) for (let l = .6; l <= 2.8; l += .55) { const px = x + L.ux * a + kx * l, pz = z + L.uz * a + kz * l; if (pin(px - .35, pz - .35, px + .35, pz + .35)) return true; } return false; };
  // a parked car (the blocks' anchors: main.js parkedIn) on the way out from the kerb to the lane: no way through there
  const parkedOn = (x, z, rx, rz, D) => { const pin = globalThis.__city?.parkedIn; if (!pin) return false; for (let d = .5; d <= D; d += .5) { const px = x + rx * d, pz = z + rz * d; if (kerbOut(px, pz) > 0) continue; if (pin(px - .3, pz - .3, px + .3, pz + .3)) return true; } return false; };
  const busy = () => [...cases].filter(k => k.ph === 'thrown' || k.ph === 'down').length;
  const canHit = () => GORE.on && busy() < (GORE.often || armed > now ? GORE.hit.maxOften : GORE.hit.max) && now - lastHit > (armed > now ? GORE.jay.cool : GORE.often ? GORE.hit.coolOften : GORE.hit.cool);
  const okWhy = w => w.agent ? 'agent' : w.E && !w.E.cross && (w.s <= GORE.shove.corner || w.s >= w.E.len - GORE.shove.corner) ? 'corner' : w.off || w.fix ? 'off' : !w.E ? 'noedge' : w.E.cross ? 'crossing' : w.E.joint ? 'joint' : w.dog >= 0 ? 'dog' : w.stagePose || w.gore ? 'stage' : w.kx ? 'kerbrow' : w.halt ? 'halt' : w.tier !== 1 ? 'far' : 'ok';
  const ok = (w, far = false) => w && !w.agent && !w.off && !w.fix && !w.gone && w.E && !w.E.cross && !w.E.joint && w.dog < 0 && !w.stagePose && !w.gore && !w.kx && !w.halt && (w.tier === 1 || far && w.tier >= 2) && w.s > (far ? GORE.jay.corner : GORE.shove.corner) && w.s < w.E.len - (far ? GORE.jay.corner : GORE.shove.corner);
  // where a walker on the walk would go: the road plan if it can reach a lane (and a car it can't miss, when `need`), else null
  // the clear strip across the walk where the walker is (pedsim's room table: [lo, hi] m from the curb, and where it is in it), or null
  const RS = [0, 0]; function strip(w, ds = 0) { const E = w.E, u = P.sideU(E, Math.max(0, Math.min(E.len, w.s + ds))), r = P.roomSpan(E, u - .25, u + .25, RS); if (!r) return null; return { lo: r[0], hi: r[1], c: P.laneC(E, u) + (w.dg || 0) }; }
  function roadPlan(w, need) { const E = w.E, A = AXIS[E.side]; if (!A) return null; const rx = -A[0], rz = -A[1], x = w.p[0], z = w.p[2], lo = laneOut(x, z, rx, rz); if (!lo) return null;
    // (the kerb side of the walk must be clear from the walker to the curb — a bin, a hydrant, a tree pit and it stays on the walk)
    const st = strip(w); if (!st || st.lo > .25) return null;
    const into = GORE.road.inLane[0] + Math.random() * (GORE.road.inLane[1] - GORE.road.inLane[0]), D = lo.d - into; if (D > GORE.road.reach || D < .9) return null;
    // (the stagger's pace, staggers[0 …]: the first at which the car coming can't miss it — a dazed walker lurches or dawdles)
    let pl = null, tE = 0, cf = null; for (const vs of GORE.road.staggers) { pl = plan(x, z, rx, rz, D, true, vs); tE = enterT(pl, lo.d); cf = carFor(lo.L, lo.ua, tE); if (cf.bad) return null; if (cf.ok) break; }
    if (need && !(cf.ok && canHit())) return null; if (parkedOn(x, z, rx, rz, D)) return null;
    // (and where it would be thrown: up the lane the car's way, toward the kerb — a parked car there and it would land in it)
    if (landBlocked(lo.L, x + rx * D, z + rz * D, -rx, -rz)) return null;
    return { ...pl, lane: lo.L, ua: lo.ua, tE, car: cf.c, gap: cf.gap, ok: cf.ok, hit: cf.ok && canHit() }; }

  // ── a case: one walker's accident. ph: 'stumble' → ('dazed' → 'back') | 'thrown' → 'down' → cleared
  function start(w, pl, by) { const yaw = pl.jay ? pl.y0 : Math.atan2(-pl.rx, -pl.rz), fixY = w.p[1]; if (!P.offWalker(w, [w.p[0], fixY, w.p[2], yaw])) return null;
    w.yawS = yaw; w.omega = 0; w.p[3] = yaw; const K = { w, ph: 'stumble', t: 0, ct: 0, pl, by, road: !!pl.lane, hz: null, y: fixY, look: null, clip: 'hit_stumble_back', base: 0, k: 0 };
    w.stagePose = NOOP; w.gore = (g, dt) => pose(K, g, dt); cases.add(K); S.shoves++; if (K.road) S.road++; return K; }
  const NOOP = () => {};
  // a line on screen when the key arms it (the page's own toasts are the UI's: none here)
  let tEl = null, tT = 0; const note = msg => { if (toast) return toast(msg); if (typeof document === 'undefined') return; if (!tEl) { tEl = document.createElement('div'); Object.assign(tEl.style, { position: 'fixed', left: '50%', bottom: '64px', transform: 'translateX(-50%)', padding: '6px 12px', background: 'rgba(20,10,10,.82)', color: '#ffd9c7', font: '600 13px system-ui, sans-serif', borderRadius: '6px', zIndex: 60, pointerEvents: 'none' }); document.body.appendChild(tEl); } tEl.textContent = msg; tEl.style.display = 'block'; clearTimeout(tT); tT = setTimeout(() => { tEl.style.display = 'none'; }, 2600); };
  // the shove (pedsim hooks.shove, from movement.js: once a frame while an agent is held up by w)
  const holds = new Map();
  const why = k => { S.why[k] = (S.why[k] || 0) + 1; };
  P.hooks.shove = (w, a, hx, hz, lag) => { why('held'); if (!GORE.on || !a?.p) return;
    // (held up: behind its booking by lag s, or stopped behind someone for wait s on end — a hold that lapses for over a beat starts over)
    let h = holds.get(a); if (!h || now - h.t > .5) { h = { t: now, go: GORE.often || armed > now || Math.random() < GORE.shove.p, last: h?.last ?? -1e9, since: now }; holds.set(a, h); } h.t = now;
    if (lag < GORE.shove.lag && now - h.since < (GORE.often || armed > now ? 0 : GORE.shove.wait)) return why('lag'); if (!ok(w)) return why(okWhy(w)); if (Math.hypot(w.p[0] - a.p[0], w.p[2] - a.p[2]) > GORE.shove.near) return why('distance');
    if (!h.go || now - h.last < GORE.shove.cool) return why('roll');
    // (often / armed: wait up to 2.5 s for a car it can't miss)
    const eager = GORE.often || armed > now, R = roadPlan(w, eager && now - h.since < 2.5);
    let pl = null;
    if (R && (R.hit ? (eager || Math.random() < GORE.road.p) : !eager && Math.random() < GORE.road.pAny)) pl = R;
    // (a lane in reach: hold on for a car)
    else if (eager && now - h.since < 2.5 && roadPlan(w, false)) return;
    // (on the walk: toward whichever side of it has more clear room — never into the kerb strip's furniture or a shopfront)
    if (!pl) { const A = AXIS[w.E.side], st = strip(w); if (!A || !st) return why('room'); const toKerb = st.c - st.lo, toWall = st.hi - st.c, sg = toKerb >= toWall ? -1 : 1, room = Math.max(toKerb, toWall) - .08; if (room < .3) return why('room');
      pl = plan(w.p[0], w.p[2], sg * A[0], sg * A[1], Math.min(SHIFT + GORE.shove.slide, room), false); }
    if (start(w, pl, a)) h.last = now; };
  // ── THE KEY'S JAYWALKER (GORE.jay). The car first: an ordinary car in the frame, moving, not braking, whose way on (its lane, and
  // the lane past its next junction when it is through it or there is no light) has a crowd walker in the frame on the kerb beside it.
  // For each such walker: the walk out (jplan) from where it is now, the time it enters the car's way (tE), and the car's gap then at its
  // speed now; the walker steps off when that gap is `aim` of the way into the car's can't-stop window (carFor's ok). The pair whose hit
  // comes soonest is STAGED; each frame the walker (walking on along the walk) is planned again and steps off on the frame its car
  // can't miss; a pair that no longer can (the car slowed, turned, another car came between, the walker left the frame) is dropped and
  // the next chosen. Who is hit and when stays this file's; the car's motion stays traffic/sim.js's (nothing here moves a car).
  let staged = [], noneSince = -1; const JL = [], jlog = (ev, o = {}) => { JL.push({ t: +now.toFixed(2), ev, ...o }); if (JL.length > 60) JL.shift(); };
  // the car's way on: [lane, m from its nose to the lane's start] (past its junction whatever the light: the step off waits for carFor,
  // which takes a car there only once it is through or has no light to stop it)
  function wayOf(c) { const L = c.L, out = [];
    if (L.kind === 'lane') { out.push([L, -c.s]); if (c.next) out.push([c.next.out, L.len - c.s + c.next.len]); }
    else if (L.kind === 'conn' && L.out) out.push([L.out, L.len - c.s]);
    return out; }
  // the jaywalk out: a turn from its way along the walk (y0) to the road (stepping .15 m out), then its walk at vs, D m in all
  function jplan(x, z, rx, rz, D, vs, y0) { const R = GORE.jay, Tt = R.turn, st = .15, walk = Math.max(0, D - st), Tw = Tt + walk / vs, yR = Math.atan2(rx, rz);
    let dy = yR - y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const at = t => Math.min(D, st * ease(t / Tt) + Math.min(walk, vs * Math.max(0, t - Tt)));
    return { jay: true, n: 0, sl: 0, Ts: 0, Tw, T: Tw, x, z, rx, rz, D, walk, vs, y0, dy, at, base: at, turn: t => ease(t / Tt), wob: () => 0 }; }
  // the walker's jaywalk now, toward lane `want` (or its nearest lane out): { pl, lo, tE, cf } or null (no lane in reach, the kerb or
  // a parked car in the way, it would land in a parked car)
  function jayFor(w, want, vs = GORE.jay.walk[0], loose = false, soon = false) { const E = w.E, A = AXIS[E.side]; if (!A) return null; const rx = -A[0], rz = -A[1], x = w.p[0], z = w.p[2], all = lanesOut(x, z, rx, rz, GORE.jay.reach), i = all.findIndex(o => o.L === want);
    if (i < 0) return null; const lo = all[i]; const st = loose ? null : strip(w); if (!loose && (!st || st.lo > .25)) return why('jnStrip'), null;
    const D = lo.d - (GORE.road.inLane[0] + GORE.road.inLane[1]) / 2; if (D > GORE.jay.reach || D < .9) return why('jnReach'), null;
    if (!loose && parkedOn(x, z, rx, rz, D)) return why('jnParked'), null; if (landBlocked(lo.L, x + rx * D, z + rz * D, -rx, -rz)) return why('jnLand'), null;
    const pl = jplan(x, z, rx, rz, D, vs, w.yawS ?? w.p[3]), tE = enterT(pl, lo.d);
    // (the lanes it crosses on the way: never in front of a cab, a cruiser or a patrol there either)
    for (let k = 0; k < i; k++) if (carFor(all[k].L, all[k].ua, enterT(pl, all[k].d)).bad) return { pl, lo, tE, cf: { bad: true } };
    return { pl, lo, tE, cf: carFor(lo.L, lo.ua, tE, soon) }; }
  // the gap window the car can't stop in (carFor's ok), and where in it the walker aims to enter: [lo, hi, aim] m
  const windowOf = v => { const lo = .6, hi = v * v / (2 * CAR.bMax) - .4; return [lo, hi, lo + (hi - lo) * GORE.jay.aim]; };
  const plainCar = c => c.kind === 'car' && !c.route && !c.stage && !c.asCar && !c.kin && !c.wreck && !c.gone;
  // choose: every plain car in the frame at speed × every walker in the frame on the kerb of its way (not one staged already) → each
  // walker's soonest pair, soonest first
  function choose(skip) { const R = GORE.jay; const found = [];
    const cars = sim.cars.filter(c => plainCar(c) && c.v > R.vNow && (c.acc ?? 0) > -1 && (inFrame(c.x, 1, c.z, 1) || Math.hypot(c.x - focus.x, c.z - focus.z) < R.near)); if (!cars.length) { why('jayNoCar'); return []; }
    const lanes = new Map(); for (const c of cars) for (const [L, off] of wayOf(c)) { let a = lanes.get(L); if (!a) lanes.set(L, a = []); a.push([c, off]); }
    for (const w of P.walkers) { if (skip.has(w) || !ok(w, true) || !inFrame(w.p[0], 1, w.p[2], R.edge)) continue; let best = null; const dc = Math.hypot(w.p[0] - cam.position.x, w.p[2] - cam.position.z); if (dc > R.far) continue;
      const A = AXIS[w.E.side]; if (!A) continue; const los = lanesOut(w.p[0], w.p[2], -A[0], -A[1], R.reach); if (!los.length) { why('jwNoLane'); continue; }
      for (const lo0 of los) { if (!lanes.has(lo0.L)) { why('jwNotCarLane'); continue; }
      for (const vs of R.walk) { const J = jayFor(w, lo0.L, vs, true, true); if (!J) { why('jwNoWay'); break; } if (J.cf.bad) { why('jwBad'); continue; } if (!J.cf.c) { why('jwNoCarFor'); continue; } const c = J.cf.c, hit = J.lo; if (!lanes.get(hit.L).some(([q]) => q === c)) { why('jwNearerCar'); continue; }
      // (the hit's spot well in the frame too: the walker is thrown from there)
      if (!inFrame(w.p[0] - A[0] * J.pl.D, 1, w.p[2] - A[1] * J.pl.D, .8)) { why('jwSpotOut'); continue; }
      const [gLo, gHi, aim] = windowOf(J.cf.v); if (J.cf.v < R.vMin || gHi - gLo < 1 || J.cf.gap < gLo) { why('jwLate'); continue; } const wait = (J.cf.gap - aim) / Math.max(c.v, J.cf.v); if (wait > R.wait) { why('jwFar'); continue; }
      // (where it will step off from, walking on meanwhile: the kerb clear and no parked car in the way there — else it walks into a
      // tree pit's or a parked car's spot just as its car comes)
      const ds = (w.vc || 0) * Math.max(0, wait), y = w.yawS ?? w.p[3], st = strip(w, ds); if (!st || st.lo > .25 || parkedOn(w.p[0] + Math.sin(y) * ds, w.p[2] + Math.cos(y) * ds, -A[0], -A[1], J.pl.D)) { why('jwBlockedAt'); continue; }
      // (room on the lane past the hit for the car to stop and the body to land: carFor's own test)
      if (hit.L.len - hit.ua - ds * Math.abs(Math.sin(y) * hit.L.ux + Math.cos(y) * hit.L.uz) <= J.cf.v * J.cf.v / (2 * CAR.bMax) + c.len * .2 + GORE.throw.ahead[0] + 1.5) { why('jwRoom'); continue; }
      const due = Math.max(0, wait) + J.tE + aim / J.cf.v, k = due + dc / R.perM; if (!best || k < best.k) best = { w, c, L: hit.L, due, k, t: now }; } }
      if (best) found.push(best); }
    if (!found.length) why('jayNoPair'); return found.sort((a, b) => a.k - b.k); }
  // the staged pairs, each frame: the first walker whose car can't miss it now steps off (one hit a press: the others are let go)
  function stepStaged() { for (const G of staged.slice()) if (stepOne(G) === 'go') { staged = []; return; } }
  function stepOne(G) { const w = G.w, c = G.c;
    const drop = k => { why(k); jlog(k, { car: c.id, v: +c.v.toFixed(1) }); staged = staged.filter(q => q !== G); return 'drop'; };
    if (armed <= now) return drop('jayUnarmed'); if (w.gone || !ok(w, true) || !inFrame(w.p[0], 1, w.p[2], GORE.jay.edge + .05)) return drop('jayLostWalker'); if (!plainCar(c)) return drop('jayLostCar');
    let J = null; for (const vs of GORE.jay.walk) { const j = jayFor(w, G.L, vs, true); if (!j) return drop('jayNoWay'); if (j.cf.bad) return drop('jayBad'); if (!j.cf.c) continue; if (j.cf.c !== c) return drop('jayOtherCar');
      // (the car can't miss it now, but the kerb's furniture or a parked car is in its way out here: it walks on, and goes from the next clear spot)
      // (and not before the gap is down to the aim: at the window's far end the car, braking from before the walker is in its way, stops short)
      // (nor while the car is easing off for something ahead — a light, a car: it would stop short)
      // (and only on a forecast it can trust: a car already at speed, the walker in its way within tMax s — a slow car's long forecast
      // gathering speed stopped short)
      if (j.cf.ok && j.cf.gap <= windowOf(j.cf.v)[2] + .25 && (c.acc || 0) > -.6 && c.v > GORE.jay.vNow && j.tE < GORE.jay.tMax) { if (jayFor(w, G.L, vs)) { J = j; break; } why('jayBlocked'); G.blk = (G.blk || 0) + 1; } }
    if (J && canHit()) { const K = start(w, { ...J.pl, lane: J.lo.L, ua: J.lo.ua, tE: J.tE, car: c, gap: J.cf.gap, ok: true, hit: true }, null); if (K) { K.jay = true; S.jays = (S.jays || 0) + 1; S.jayLead = +(now - armedAt).toFixed(2); jlog('go', { car: c.id, v: +c.v.toFixed(1), acc: +(c.acc || 0).toFixed(1), gap: +J.cf.gap.toFixed(1), vE: +J.cf.v.toFixed(1), tE: +J.tE.toFixed(2), vs: J.pl.vs, D: +J.pl.D.toFixed(1), tier: w.tier, of: staged.length }); return 'go'; } return drop('jayStart'); }
    // (too late at every pace — the fastest walk last — or the car no longer coming at speed: the next pair)
    const Jf = jayFor(w, G.L, Math.max(...GORE.jay.walk), true), [gLo] = windowOf(Jf.cf.v); if (Jf.cf.c && (Jf.cf.gap < gLo || Jf.cf.v <= 5)) { jlog('lateWhy', { gap: +Jf.cf.gap.toFixed(1), vE: +Jf.cf.v.toFixed(1), room: +(Jf.lo.L.len - Jf.lo.ua - Jf.cf.v * Jf.cf.v / (2 * CAR.bMax) - c.len * .2 - GORE.throw.ahead[0] - .5).toFixed(1), blocked: G.blk || 0, hitOk: canHit() }); return drop('jayLate'); } if (now - G.t > GORE.jay.wait + 1.5) return drop('jayWait'); return 'wait'; }
  // (none while a jaywalker is on its way out, or stands in the road with its car still coming)
  function tryTrip() { if (!focus || [...cases].some(K => K.pl.hit && (K.ph === 'stumble' || (K.ph === 'dazed' && (K.pl.car?.v ?? 0) > .5)))) return false; if (staged.length >= GORE.jay.keep || !canHit()) return false;
    S.tries = (S.tries || 0) + 1; const add = choose(new Set(staged.map(G => G.w))).slice(0, GORE.jay.keep - staged.length);
    for (const G of add) { staged.push(G); S.staged = (S.staged || 0) + 1; jlog('staged', { car: G.c.id, v: +G.c.v.toFixed(1), due: +G.due.toFixed(2) }); }
    if (staged.length) { noneSince = -1; return true; }
    // (no car in the frame can do it: say so, once a press, and keep trying while armed)
    if (noneSince < 0) noneSince = now; else if (noneSince > -.5 && now - noneSince > GORE.jay.tell) { note('No car in view can hit anyone yet: still watching'); noneSince = -1e9; }
    return false; }
  if (typeof addEventListener === 'function' && typeof document !== 'undefined') addEventListener('keydown', e => {
    if (e.code !== GORE.key || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable || document.body.classList.contains('cam-photo')) return;
    if (!GORE.on) { GORE.on = true; } armed = now + GORE.arm; armedAt = now; noneSince = -1; staged = []; S.armed++; note('Accident armed: a jaywalker steps out in front of the next car in view'); });

  // ── the gait hook: the case's clip on its own clock (a fresh gait — the walker just came near — gets it again)
  { const anim0 = P.animate; P.animate = (w, dt, G, fresh) => { const g = anim0(w, dt, G, fresh); if (g && w.gore) w.gore(g, dt); return g; }; }
  function pose(K, g, dt) { const want = K.clip;
    if (!want) { if (g.clip) { if (!g.clip.out) stopClip(g); stepClip(g, dt); } return; }
    if (!CLIP[want]) return; if (!g.clip || g.clip.name !== want || g.clip.out) playClip(g, want, { t: K.ct, snap: true });
    const s = g.clip; s.t = K.loop ? s.t + dt : K.ct; s.w = 1; s.out = false; stepClip(g, 0); if (g.clip) { g.clip.out = false; g.clip.w = 1; } g.w = 0; g.iw = 1; }
  // the walker back to the crowd (back: onto the nearest clear lane point — false while there is none: try again next frame)
  function release(K, back = true) { const w = K.w; if (back && !w.gone && !P.onWalker(w)) return false; cases.delete(K); dropHazard(K);
    if (w.gone) return true; w.gore = undefined; w.stagePose = null; w.tq = null; w.lieQ = undefined; w.lift = 0; if (w.g?.clip) clearClip(w.g); return true; }

  // ── the hit (traffic/sim.js onHit, inside its step)
  // (→ true: the hit is taken, and the car is a wreck this file lets go; false: no live case behind that hazard — no wreck: traffic/sim.js)
  sim.onHit = (c, h, v) => { const K = h.case; if (!K || !cases.has(K)) return false; lastHit = now; armed = 0; S.hits++; S.wrecks++; if (K.jay) jlog('hit', { car: c.id, v: +v.toFixed(1), same: c === K.pl.car });
    const w = K.w, hc = c.h, fx0 = Math.sin(hc), fz0 = Math.cos(hc), T = GORE.throw;
    // toward the kerb: the side of the car's line the walker came from
    const L = c.L, side = Math.sign((w.fix[0] - L.x0) * -L.uz + (w.fix[2] - L.z0) * L.ux) || 1, rx = -L.uz * side, rz = L.ux * side;
    // (where it comes to rest: its middle lat m off the car's line toward the kerb, and ahead m on from the blow — past where the car will
    // have stopped, by ahead[0] … ahead[1] m. lie_still lays the body along its +x from its root, 0.9 m to its middle: +x runs with the car,
    // so the body lies along the road; it tumbles head over heels about its z, across the way it flies)
    // (where the car stops: in its lane — a wreck never slides on into the junction, traffic/sim.js)
    const stopD = Math.min(v * v / (2 * CAR.bMax), Math.max(0, L.len - c.s - .05)), ahead = Math.min(stopD + c.len * .2 + T.ahead[0] + Math.random() * (T.ahead[1] - T.ahead[0]), Math.max(stopD + 1, L.len - c.s - 1.5));
    // (the kerb measured where it comes to rest, on the car's line: the body stays on the road, clear of the kerb by its own depth)
    const ox = K.vis[0] + fx0 * ahead, oz = K.vis[2] + fz0 * ahead, lat0 = (K.vis[0] - L.x0) * rx + (K.vis[2] - L.z0) * rz, la = (ox - L.x0) * rx + (oz - L.z0) * rz;
    const kerb = Math.max(1.3, la + kerbAt(ox, oz, rx, rz) - .55), latT = Math.min(T.lat + Math.random() * .4, kerb) - lat0;
    const vy = T.vy + T.k * v, tf = 2 * vy / T.g, bh = vy * T.bounce, tb = 2 * bh / T.g, vf = ahead * .78 / tf, v1 = vf * .35, slideD = Math.max(0, ahead - vf * tf - v1 * tb), sl = v1 * v1 / (2 * Math.max(.3, slideD)), fwd = vf * tf, tot = ahead;
    K.ph = 'thrown'; K.t = 0; K.car = c; K.v = v; K.f = [fx0, fz0]; K.lat = [rx, rz]; K.o = [K.vis[0], K.vis[2]];
    // (whole turns in the air: it comes down flat after a quarter turn more on the bounce and the slide)
    K.fly = { vy, tf, vf, bh, tb, tot, latT, fwd, sl, yaw: Math.atan2(-fz0, fx0), spin: Math.PI * 2 * Math.max(1, Math.round(T.spin * tf / .55)), roll: (Math.random() - .5) * .9 };
    K.clip = 'hit_stumble_back'; K.ct = .13; K.loop = false; c.hgt = heightOf(c);
    dropHazard(K);
    // the gore at the blow: a spray with the car, a mist; splats on its nose (its own frame: they ride with it as it skids)
    const k = Math.max(.7, Math.min(1.7, v / 8)); fx.target(c); fx.spray(K.vis[0], 1.05, K.vis[2], fx0, .35, fz0, k);
    for (let j = 0; j < 4 + (k * 3 | 0); j++) fx.carSplat(c, (Math.random() - .5) * c.wid * .7, .45 + Math.random() * .4, c.len / 2, 0, 0, 1, .22 + Math.random() * .2);
    wrecks.set(c, { t: 0, stop: null, yaw: (Math.random() < .5 ? -1 : 1) * GORE.wreck.yaw * (.6 + Math.random() * .6), K }); return true; };
  const kerbAt = (x, z, rx, rz) => { let d = 0; for (; d < 8; d += .1) if (kerbOut(x + rx * d, z + rz * d) > 0) break; return d; };
  const wrecks = new Map(), skidding = new Set();

  // ── per frame (traffic/render.js update, before the cars step): the cases, the wrecks, the effects
  const Qy = new THREE.Quaternion(), Qt = new THREE.Quaternion(), V = new THREE.Vector3(), AXr = new THREE.Vector3(), Yv = new THREE.Vector3(0, 1, 0), UP = new THREE.Vector3();
  const MS = { avg: 0, max: 0 };
  function update(dt, camera, foc) { const T0 = typeof performance !== 'undefined' ? performance.now() : 0; update0(dt, camera, foc); const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - T0; MS.avg += (ms - MS.avg) * .05; MS.max = Math.max(MS.max * .995, ms); }
  function update0(dt, camera, foc) { now += dt; cam = camera; focus = foc || camera.position; camera.updateMatrixWorld(); PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM);
    stepStaged(); if (armed > now && ((now * 10) | 0) !== (((now - dt) * 10) | 0)) tryTrip();
    if (((now / 5) | 0) !== (((now - dt) / 5) | 0)) for (const [a, h] of holds) if (now - h.t > 30) holds.delete(a);
    for (const K of [...cases]) { const w = K.w; if (w.gone) { release(K, false); continue; } K.t += dt; step(K, dt); }
    // (every car braking as hard as it can for someone in the road lays rubber — the one that hits them, and one that just stops short)
    if (sim.hazards.length || skidding.size) { for (const c of skidding) if (c.gone || (!c.skid && !wrecks.has(c))) { fx.skid(c, false); skidding.delete(c); }
      for (const c of sim.cars) if (c.skid && c.v > .3 && !wrecks.has(c)) { skidding.add(c); fx.skid(c, true); } }
    for (const [c, W] of wrecks) { if (c.gone) { wrecks.delete(c); continue; } W.t += dt;
      if (!c.wreck) { c.yawOff *= Math.exp(-dt * 1.2); fx.skid(c, false); if (Math.abs(c.yawOff) < .002) { c.yawOff = 0; wrecks.delete(c); } continue; }
      const sk = c.v > .3; fx.skid(c, sk); skidding.delete(c); if (sk) c.yawOff += (W.yaw - c.yawOff) * Math.min(1, dt * 3) + Math.sin(W.t * 23) * .01; else if (W.stop === null) W.stop = W.t;
      if (W.stop !== null) fx.hazard(c);
      // let it go: its stay over — or sooner with a cab, a cruiser or a patrol queued behind it (an agent's ride is never held up long)
      const q = W.stop !== null && W.t - W.stop > GORE.wreck.cab && c.L.cars.some(o => o !== c && o.s < c.s && c.s - o.s < 45 && (o.route || o.stage || o.asCar || o.kind !== 'car'));
      if (W.stop !== null && (W.t - W.stop > GORE.wreck.stay || q)) { c.wreck.go = true; if (q) S.early++; } }
    fx.update(dt, camera); }
  function step(K, dt) { const w = K.w, f = w.fix, pl = K.pl;
    if (K.ph === 'stumble') { const t = Math.min(pl.T, K.t), k = Math.min(pl.n - 1, Math.floor(t / DUR)), yaw0 = Math.atan2(-pl.rx, -pl.rz);
      // (the clip's clock: each stumble starts it over — the walker already moved by the last one's shift; past them, the walk's own gait)
      K.ct = Math.min(DUR - .001, t - k * DUR); K.clip = t < pl.Ts ? 'hit_stumble_back' : null;
      const b = pl.base(t), vis = pl.at(t), wb = pl.wob(t), px = -pl.rz, pz = pl.rx; f[0] = pl.x + pl.rx * b + px * wb; f[2] = pl.z + pl.rz * b + pz * wb;
      K.vis = [pl.x + pl.rx * vis + px * wb, 0, pl.z + pl.rz * vis + pz * wb]; f[1] = settleY(K, K.vis[0], K.vis[2], dt); hazard(K);
      // (the jaywalker: from its way along the walk round to the road, then its own walk out at its pace)
      if (pl.jay) { const yaw = pl.y0 + pl.dy * pl.turn(t); f[3] = yaw; w.yawS = yaw; w.omega = 0; w.vc = t < GORE.jay.turn ? pl.vs * .6 : pl.vs; }
      else if (t >= pl.Ts && pl.Tw) { const yaw = yaw0 + Math.PI * pl.turn(t) * (K.side ??= Math.random() < .5 ? 1 : -1) + .25 * Math.sin((t - pl.Ts) * 3.7) * Math.min(1, (t - pl.Ts - GORE.road.turn) * 2) * (t > pl.Ts + GORE.road.turn ? 1 : 0); f[3] = yaw; w.yawS = yaw; w.omega = 0; w.vc = GORE.road.stagger; }
      if (K.t >= pl.T) { f[0] = K.vis[0]; f[2] = K.vis[2]; K.clip = null; K.ct = 0; w.vc = 0;
        if (pl.lane && kerbOut(f[0], f[2]) <= 0) { K.ph = 'dazed'; K.t = 0; K.dz = GORE.road.dazed[0] + Math.random() * (GORE.road.dazed[1] - GORE.road.dazed[0]); }
        else { K.ph = 'back'; K.t = 0; } }
      return; }
    if (K.ph === 'dazed') { K.vis = [f[0], 0, f[2]]; f[1] = settleY(K, f[0], f[2], dt); hazard(K);
      // it turns to the car coming (or to the walk) a beat in
      if (K.t > .35 && pl.lane) { const c = carFor(pl.lane, pl.ua, 0).c, tx = c ? c.x : f[0] - pl.rx, tz = c ? c.z : f[2] - pl.rz; f[3] = Math.atan2(tx - f[0], tz - f[2]); }
      if (K.t > K.dz) { K.ph = 'back'; K.t = 0; S.nearMiss++; if (K.jay) jlog('miss', { car: K.pl.car?.id, cv: +(K.pl.car?.v ?? -1).toFixed(1), cs: K.pl.car?.L === K.pl.lane ? +(K.pl.ua - K.pl.car.s).toFixed(1) : null, soft: K.hz?.soft }); } return; }
    if (K.ph === 'back') { const L = P.laneNear(f[0], f[2], 12), tp = L ? P.where({ E: L.E, s: L.s }, [0, 0, 0, 0]) : [pl.x, 0, pl.z], dx = tp[0] - f[0], dz = tp[2] - f[2], d = Math.hypot(dx, dz), v = GORE.road.back * Math.min(1, K.t * 2 + .2);
      K.vis = [f[0], 0, f[2]]; if (kerbOut(f[0], f[2]) <= 0) hazard(K); else dropHazard(K);
      if (d < .08) { if (release(K, true)) S.rejoined++; w.vc = 0; return; }
      const st = Math.min(d, v * dt); f[0] += dx / d * st; f[2] += dz / d * st; f[3] = Math.atan2(dx, dz); w.vc = v; f[1] = settleY(K, f[0], f[2], dt); return; }
    if (K.ph === 'thrown') { const F = K.fly, t = K.t, T = GORE.throw; let along, lat, y, ang, done = false;
      // the arc, the bounce, the slide: along the car's way (and toward the kerb in proportion)
      if (t < F.tf) { along = F.vf * t; y = F.vy * t - .5 * T.g * t * t; ang = F.spin * t / F.tf; }
      else if (t < F.tf + F.tb) { const u = t - F.tf; along = F.fwd + F.vf * .35 * u; y = 4 * F.bh * (u / F.tb) * (1 - u / F.tb); ang = F.spin + (Math.PI * .25) * u / F.tb; }
      else { const u = t - F.tf - F.tb, v0 = F.vf * .35, ts = v0 / F.sl, uu = Math.min(u, ts); along = F.fwd + v0 * F.tb + v0 * uu - .5 * F.sl * uu * uu; y = 0; ang = F.spin + Math.PI * .25 + (Math.PI * .25) * ease(uu / Math.max(.05, ts)); if (u >= ts) done = true; }
      const kf = Math.min(1, along / F.tot), cx = K.o[0] + K.f[0] * along + K.lat[0] * F.latT * kf, cz = K.o[1] + K.f[1] * along + K.lat[1] * F.latT * kf, gy = groundY(cx, cz);
      // the body tumbles about the axis across its flight, round its middle (0.9 m up): the root is placed so the middle runs the arc
      const yaw = F.yaw; Qy.setFromAxisAngle(Yv, yaw); AXr.set(0, 0, 1); Qt.setFromAxisAngle(AXr, -ang); Qt.multiply(Qt2.setFromAxisAngle(Xv, F.roll * Math.min(1, t / F.tf)));
      w.tq = (w.tq || new THREE.Quaternion()).copy(Qt); w.lift = 0; UP.set(0, .9, 0).applyQuaternion(Qt).applyQuaternion(Qy);
      // (its middle: 0.9 m up as it was hit, down to a body's half-depth, 0.3 m, by the time it comes down)
      const my = gy + Math.max(0, y) + .9 - .6 * Math.min(1, t / F.tf);
      w.fix = [cx - UP.x, my - UP.y, cz - UP.z, yaw]; w.yawS = yaw; w.omega = 0; K.vis = [cx, my, cz];
      if (((K.t * 12) | 0) !== (((K.t - dt) * 12) | 0) && t < F.tf + F.tb) fx.shed(cx, gy + .6 + Math.max(0, y), cz, K.f[0] * F.vf * .5, 1, K.f[1] * F.vf * .5, 2);
      if (!K.landed && t >= F.tf) { K.landed = true; fx.splat(cx, gy, cz, 0, 1, 0, .9); fx.spray(cx, gy + .3, cz, K.f[0], .2, K.f[1], .45); }
      if (done) { K.ph = 'down'; K.t = 0; K.clip = 'lie_still'; K.loop = true; K.ct = 0; K.rest = { yaw, q: w.tq.clone(), x: cx, z: cz, rx: cx - Math.cos(yaw) * .9, rz: cz + Math.sin(yaw) * .9, gy }; S.bodies++;
        // the pool, under its middle as lie_still lays it (on its right side, 0.9 m to its +x: stage/crowd.js ROOM.side)
        fx.pool(cx, cz, 1.8, .6); fx.pool(cx + Math.cos(yaw) * .5 + K.f[0] * .3, cz - Math.sin(yaw) * .5 + K.f[1] * .3, 1.1, 1.6); }
      return; }
    if (K.ph === 'down') { const R = K.rest, u = Math.min(1, K.t / .35);
      // settle: the tumble's tilt eases out as lie_still (its own root on the ground, the body 0.9 m to its +x) eases in
      if (u < 1) { const e = ease(u); w.tq.copy(R.q).slerp(QI, e); UP.set(0, .9, 0).applyQuaternion(w.tq).applyQuaternion(Qy.setFromAxisAngle(Yv, R.yaw)); w.fix = [(R.x - UP.x) * (1 - e) + R.rx * e, (R.gy + .3 - UP.y) * (1 - e) + R.gy * e, (R.z - UP.z) * (1 - e) + R.rz * e, R.yaw]; }
      // (lie_still poses it on the near tier; the mid and far tiers have no clips: they lay the body down whole — w.lieQ, peds.js)
      else if (w.tq) { w.tq = null; w.lieQ = LIE; w.lift = .24; w.fix = [R.rx, R.gy, R.rz, R.yaw]; }
      // (a body on the crowd's map — lie_still's footprint, stage/crowd.js FOOT.side — so walkers step round it, or stop short of it)
      if (!w.tq) { const B = P.bodies, y = R.yaw, fx = Math.sin(y), fz = Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y); for (const [l, a, r] of FOOT.side) B.push({ x: R.rx + rx * l + fx * a, z: R.rz + rz * l + fz * a, r, w, room: FOOT.room }); }
      if (K.t > GORE.body.linger && !seen(R.x, R.gy + .3, R.z, 2.2) && release(K, true)) S.cleared++; } }
  const Qt2 = new THREE.Quaternion(), Xv = new THREE.Vector3(1, 0, 0), QI = new THREE.Quaternion(); const LIE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  // the step down off the kerb (and up onto it), eased
  function settleY(K, x, z, dt) { const gy = groundY(x, z); K.y += (gy - K.y) * Math.min(1, dt * 16); return K.y; }
  // the walker as the cars see it, while it stands in the road
  // (soft: no hit may happen now — the cap, the cool-down — so every car stops short of it, as a cab always does)
  function hazard(K) { if (kerbOut(K.vis[0], K.vis[2]) > 0 && !K.hz) return; if (!K.hz) { K.hz = { x: 0, z: 0, r: GORE.hit.hzR, hit: false, soft: false, case: K }; sim.hazards.push(K.hz); } K.hz.x = K.vis[0]; K.hz.z = K.vis[2]; K.hz.soft = !canHit(); }
  function dropHazard(K) { if (!K.hz) return; const i = sim.hazards.indexOf(K.hz); if (i >= 0) sim.hazards.splice(i, 1); K.hz = null; }
  return { update, fx, GORE, stats: () => ({ ...S, why: { ...S.why }, updateMs: +MS.avg.toFixed(3), updateMax: +MS.max.toFixed(3), live: cases.size, now: +now.toFixed(2), hazards: sim.hazards.length, wrecks: wrecks.size, armed: armed > now, ...fx.stats() }),
    now: () => [...cases].map(K => ({ ph: K.ph, t: +K.t.toFixed(2), road: K.road, x: +(K.vis?.[0] ?? K.w.p[0]).toFixed(1), z: +(K.vis?.[2] ?? K.w.p[2]).toFixed(1), hit: !!K.car, by: K.by ? 'agent' : 'trip', dir: [+K.pl.rx.toFixed(3), +K.pl.rz.toFixed(3)], lane: K.pl.lane ? [K.pl.lane.ux, K.pl.lane.uz] : null, tf: K.fly ? +(K.fly.tf + K.fly.tb).toFixed(2) : null })),
    holding: () => [...holds].filter(([a, h]) => now - h.t < .5 && a.p).map(([a, h]) => ({ id: a.aid, x: +a.p[0].toFixed(1), z: +a.p[2].toFixed(1), for: +(now - h.since).toFixed(2) })),
    jlog: () => JL.slice(), trip: tryTrip, readyW: () => staged[0]?.w ?? null, staged: () => staged[0] ? staged.map(G => ({ x: +G.w.p[0].toFixed(1), z: +G.w.p[2].toFixed(1), car: G.c.id, v: +G.c.v.toFixed(1), due: +G.due.toFixed(2), age: +(now - G.t).toFixed(2) })) : null, plan: w => roadPlan(w, false), arm(s = GORE.arm) { armed = now + s; armedAt = now; }, dbg: () => ({ armed, now, staged: staged.map(G => ({ x: +G.w.p[0].toFixed(1), z: +G.w.p[2].toFixed(1), car: G.c.id, age: +(now - G.t).toFixed(1) })), often: GORE.often, on: GORE.on, focus: !!focus, cases: cases.size, holds: [...holds].slice(0, 5).map(([a, h]) => [a.aid, a.id, +(now - h.t).toFixed(2), +(now - h.since).toFixed(2), a.tier, !!a.p]) }),
    // (for looking into why nothing goes: the walkers near the focus, filter by filter)
    probe(r = 45) { const o = { near: 0, ok: 0, lane: 0, reach: 0, car: 0, bad: 0, timing: 0, gaps: [] }; if (!focus) return o;
      for (const w of P.walkers) { if (w.agent || Math.hypot(w.p[0] - focus.x, w.p[2] - focus.z) > r) continue; o.near++; if (!ok(w)) continue; o.ok++; const A = AXIS[w.E.side], lo = laneOut(w.p[0], w.p[2], -A[0], -A[1]); if (!lo) continue; o.lane++;
        const D = lo.d - .2; if (D > GORE.road.reach || D < .9) continue; o.reach++; const pl = plan(w.p[0], w.p[2], -A[0], -A[1], D, true), cf = carFor(lo.L, lo.ua, enterT(pl, lo.d));
        if (cf.bad) o.bad++; if (cf.c) { o.car++; if (o.gaps.length < 12) o.gaps.push([+cf.gap.toFixed(1), +cf.c.v.toFixed(1), +lo.d.toFixed(2)]); } if (cf.ok) o.timing++; const st = strip(w); if (!st || st.lo > .2) o.blockedKerb = (o.blockedKerb || 0) + 1; if (parkedOn(w.p[0], w.p[2], -A[0], -A[1], D)) o.parked = (o.parked || 0) + 1; } return o; } };
}
