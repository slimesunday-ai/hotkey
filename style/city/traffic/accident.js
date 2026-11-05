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
// can't miss) · key X sets one off in view: the next walker in the frame near what the camera looks at that can stumble in front of a
// car does (an agent's shove if one is held up there, else the walker trips), with ?gore=often too. (It had picked the nearest walker to
// the focus in the frame or out of it, so most hits fell off screen, and under ?gore=often it only armed shoves.) With no car it can't
// miss coming yet, a walker in the frame with a lane in reach stands ready for one (GORE.ready): the walker and the car had to meet
// the right gap in the same tenth of a second (slime, 11-04: "it's really hard to trigger").
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
  // the key's bait: for its first `first` s it looks for a walking agent near the camera to hold a walker up in front of (`hold` s at most)
  bait: { first: 6, hold: 5 },
  // the key's walker standing ready: after the bait's window, a walker in the frame with a lane in reach (and a car coming on it) stops
  // where it stands for up to `hold` s — a light's whole cycle (rules.js TIMING: 44 s), so its lane's green comes — and stumbles out when
  // a car it can't miss comes; then the next one. The one whose car is already coming at speed first, then one whose car waits at a red
  ready: { hold: 44 },
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
  // the car that would meet a walker at ua on lane L, entering its way in tE s: { c, gap (m at tE), ok (an ordinary car it can't miss) };
  // bad: a cab, a cruiser or a patrol coming within 70 m (no walker goes in front of one)
  // (upstream too: on the connectors into the lane, and on the lanes before them, a car committed through the junction — c.go — or with
  // no signal to stop it. The nearest one is the one that meets it; m: its nose's distance to ua along the way)
  const isBad = o => o.route || o.stage || o.asCar || o.kind !== 'car';
  function carFor(L, ua, tE) { let c = null, m = 1e9, bad = false; const see = (o, d) => { if (d <= 0) return; if (d < 70 && isBad(o)) bad = true; if (d < m) { m = d; c = o; } };
    for (const o of L.cars) see(o, ua - o.s);
    for (const cn of L.feeds) { for (const o of cn.cars) see(o, cn.len - o.s + ua); for (const o of cn.inL.cars) if (o.next === cn && (o.go || !cn.inL.to.sig)) see(o, cn.inL.len - o.s + cn.len + ua); }
    if (!c) return { c: null, bad, ok: false }; const v = c.v, gap = m - GORE.hit.hzR - v * tE, stop = v * v / (2 * CAR.bMax);
    // (and room on the lane past it for the car to stop and the body to land: it never comes down on the next zebra)
    return { c, bad, gap, ok: !bad && !c.wreck && v > 5 && gap > .6 && gap < stop - .4 && L.len - ua > stop + c.len * .2 + GORE.throw.ahead[0] + .5 }; }
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
  const canHit = () => GORE.on && busy() < (GORE.often || armed > now ? GORE.hit.maxOften : GORE.hit.max) && now - lastHit > (GORE.often || armed > now ? GORE.hit.coolOften : GORE.hit.cool);
  const okWhy = w => w.agent ? 'agent' : w.E && !w.E.cross && (w.s <= GORE.shove.corner || w.s >= w.E.len - GORE.shove.corner) ? 'corner' : w.off || w.fix ? 'off' : !w.E ? 'noedge' : w.E.cross ? 'crossing' : w.E.joint ? 'joint' : w.dog >= 0 ? 'dog' : w.stagePose || w.gore ? 'stage' : w.kx ? 'kerbrow' : w.halt ? 'halt' : w.tier !== 1 ? 'far' : 'ok';
  const ok = w => w && !w.agent && !w.off && !w.fix && !w.gone && w.E && !w.E.cross && !w.E.joint && w.dog < 0 && !w.stagePose && !w.gore && !w.kx && (!w.halt || bait?.w === w || ready?.w === w) && w.tier === 1 && w.s > GORE.shove.corner && w.s < w.E.len - GORE.shove.corner;
  // where a walker on the walk would go: the road plan if it can reach a lane (and a car it can't miss, when `need`), else null
  // the clear strip across the walk where the walker is (pedsim's room table: [lo, hi] m from the curb, and where it is in it), or null
  const RS = [0, 0]; function strip(w) { const E = w.E, u = P.sideU(E, w.s), r = P.roomSpan(E, u - .25, u + .25, RS); if (!r) return null; return { lo: r[0], hi: r[1], c: P.laneC(E, u) + (w.dg || 0) }; }
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
  function start(w, pl, by) { if (bait?.w === w) { w.halt = false; bait = null; } const fixY = w.p[1]; if (!P.offWalker(w, [w.p[0], fixY, w.p[2], Math.atan2(-pl.rx, -pl.rz)])) return null; const yaw = Math.atan2(-pl.rx, -pl.rz);
    w.yawS = yaw; w.omega = 0; w.p[3] = yaw; const K = { w, ph: 'stumble', t: 0, ct: 0, pl, by, road: !!pl.lane, hz: null, y: fixY, look: null, clip: 'hit_stumble_back', base: 0, k: 0 };
    w.stagePose = NOOP; w.gore = (g, dt) => pose(K, g, dt); cases.add(K); S.shoves++; if (K.road) S.road++; return K; }
  const NOOP = () => {};
  // a line on screen when the key arms it (the page's own toasts are the UI's: none here)
  let tEl = null, tT = 0; const note = msg => { if (toast) return toast(msg); if (typeof document === 'undefined') return; if (!tEl) { tEl = document.createElement('div'); Object.assign(tEl.style, { position: 'fixed', left: '50%', bottom: '64px', transform: 'translateX(-50%)', padding: '6px 12px', background: 'rgba(20,10,10,.82)', color: '#ffd9c7', font: '600 13px system-ui, sans-serif', borderRadius: '6px', zIndex: 60, pointerEvents: 'none' }); document.body.appendChild(tEl); } tEl.textContent = msg; tEl.style.display = 'block'; clearTimeout(tT); tT = setTimeout(() => { tEl.style.display = 'none'; }, 2600); };
  // the shove (pedsim hooks.shove, from movement.js: once a frame while an agent is held up by w)
  const holds = new Map();
  const why = k => { S.why[k] = (S.why[k] || 0) + 1; };
  P.hooks.shove = (w, a, hx, hz, lag, bait = false) => { why('held'); if (!GORE.on || !a?.p) return;
    // (held up: behind its booking by lag s, or stopped behind someone for wait s on end — a hold that lapses for over a beat starts over)
    let h = holds.get(a); if (!h || now - h.t > .5) { h = { t: now, go: GORE.often || armed > now || Math.random() < GORE.shove.p, last: h?.last ?? -1e9, since: now }; holds.set(a, h); } h.t = now;
    if (lag < GORE.shove.lag && now - h.since < (GORE.often || armed > now ? 0 : GORE.shove.wait)) return why('lag'); if (!ok(w)) return why(okWhy(w)); if (Math.hypot(w.p[0] - a.p[0], w.p[2] - a.p[2]) > GORE.shove.near) return why('distance');
    if (!h.go || now - h.last < GORE.shove.cool) return why('roll');
    // (often / armed: wait up to 2.5 s for a car it can't miss — the bait doesn't: the agent is passing now)
    const eager = GORE.often || armed > now, R = roadPlan(w, eager && !bait && now - h.since < 2.5);
    let pl = null;
    if (R && (R.hit ? (eager || Math.random() < GORE.road.p) : !eager && Math.random() < GORE.road.pAny)) pl = R;
    // (a lane in reach: hold on for a car)
    else if (eager && !bait && now - h.since < 2.5 && roadPlan(w, false)) return;
    // (on the walk: toward whichever side of it has more clear room — never into the kerb strip's furniture or a shopfront)
    if (!pl) { const A = AXIS[w.E.side], st = strip(w); if (!A || !st) return why('room'); const toKerb = st.c - st.lo, toWall = st.hi - st.c, sg = toKerb >= toWall ? -1 : 1, room = Math.max(toKerb, toWall) - .08; if (room < .3) return why('room');
      pl = plan(w.p[0], w.p[2], sg * A[0], sg * A[1], Math.min(SHIFT + GORE.shove.slide, room), false); }
    if (start(w, pl, a)) h.last = now; };
  // the key: arm (GORE.arm s) — the next agent shove near the camera, or a walker near it that can trip in front of a car, goes
  // THE BAIT (the key only): a walking agent near the camera with a crowd walker 2–7 m ahead in its way — that walker stops where it
  // stands (pedsim's halt, as a held walker of the stage's) for up to bait.hold s, so the agent comes up behind it, is held up, and
  // shoves it (an armed shove waits up to 2.5 s for a car it can't miss). The agent's lag is the record's own crowd lag (≤ MOVE.lag.cap)
  let bait = null;
  // (the key's walker standing ready for its car: tryTrip, GORE.ready)
  let ready = null; const unready = () => { if (!ready) return; const w = ready.w; if (!w.gone && !w.gore && w.halt && !w.off) w.halt = false; ready = null; };
  function setBait() { if (bait || !focus) return false; let best = null, bd = 45;
    for (const a of P.agents) { if (!a.p || (a.vc || 0) < .6 || !a.fix) continue; const d = Math.hypot(a.p[0] - focus.x, a.p[2] - focus.z); if (d > bd) continue; const h = a.yawS ?? a.p[3], hx = Math.sin(h), hz = Math.cos(h);
      for (const w of P.walkers) { if (!ok(w) || w.vc < .3 || !inFrame(w.p[0], 1, w.p[2])) continue; const dx = w.p[0] - a.p[0], dz = w.p[2] - a.p[2], al = dx * hx + dz * hz, lat = Math.abs(dx * hz - dz * hx); if (al < 2 || al > 7 || lat > .55) continue;
        const road = !!roadPlan(w, false); if (best && best.road && !road) continue; best = { w, a, t: now, road }; bd = d; break; } }
    if (!best) return false; bait = best; best.w.halt = true; best.w.vc = 0; S.baits = (S.baits || 0) + 1; return true; }
  // (the agent weaves round whoever stands in its way, so it is seldom held up behind the bait: within reach of it, it shoves)
  function stepBait() { if (!bait) return; const w = bait.w, a = bait.a;
    if (!w.gone && !w.gore && a?.p && Math.hypot(w.p[0] - a.p[0], w.p[2] - a.p[2]) < 1.5) P.hooks.shove(w, a, 0, 0, 9, true);
    if (!bait) return; if (w.gone || w.gore || now - bait.t > GORE.bait.hold || armed <= now) { if (!w.gone && !w.gore && w.halt && !w.off) w.halt = false; bait = null; } }
  function tryTrip() { if (!focus || [...cases].some(K => K.pl.hit && (K.ph === 'stumble' || K.ph === 'dazed'))) return false; if (bait) return false;
    // (an agent walking near: give it the bait's window)
    if (now - armedAt < GORE.bait.first && (setBait() || P.agents.some(a => a.p && (a.vc || 0) > .6 && Math.hypot(a.p[0] - focus.x, a.p[2] - focus.z) < 45))) return false;
    // (a walker in the frame that can stumble in front of a car it can't miss now goes; else one with a lane in reach and a car coming on
    // it stands ready for that car — the walker and the car at the right gap in the same tenth of a second were 0.07 a look at FIT ST
    // (accidents.probe), and slime, 11-04: "it's really hard to trigger")
    let best = null, bd = 60, cand = null, cd = 1e9;
    S.tries = (S.tries || 0) + 1; for (const w of P.walkers) { if (!ok(w) || !inFrame(w.p[0], 1, w.p[2])) continue; const d = Math.hypot(w.p[0] - focus.x, w.p[2] - focus.z); if (d > 60) continue;
      if (d < bd) { const R = roadPlan(w, true); if (R) { best = [w, R]; bd = d; continue; } }
      if (!ready && d < cd) { const R = roadPlan(w, false); if (!R?.car) continue; const k = (R.car.v > 5 ? R.gap > 0 ? 0 : 1 : 2) * 100 + d; if (k < cd) { cand = [w, R]; cd = k; } } }
    if (best) { unready(); return !!start(best[0], best[1], null); }
    if (ready) { const w = ready.w, out = now - ready.t > GORE.ready.hold; if (w.gone || w.gore || !ok(w) || !inFrame(w.p[0], 1, w.p[2]) || out) { why(out ? 'readyOut' : 'readyLost'); unready(); } return false; }
    if (cand) { const [w, R] = cand; ready = { w, t: now, v0: R.car.v, gap0: R.gap }; w.halt = true; w.vc = 0; S.readied = (S.readied || 0) + 1; }
    return false; }
  if (typeof addEventListener === 'function' && typeof document !== 'undefined') addEventListener('keydown', e => {
    if (e.code !== GORE.key || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable || document.body.classList.contains('cam-photo')) return;
    if (!GORE.on) { GORE.on = true; } armed = now + GORE.arm; armedAt = now; S.armed++; note('Accident armed: the next walker near the camera that can stumble in front of a car will'); });

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
  sim.onHit = (c, h, v) => { const K = h.case; if (!K || !cases.has(K)) return false; lastHit = now; armed = 0; S.hits++; S.wrecks++;
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
    stepBait(); if (ready && armed <= now) unready(); if (armed > now && ((now * 10) | 0) !== (((now - dt) * 10) | 0)) tryTrip();
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
      if (t >= pl.Ts && pl.Tw) { const yaw = yaw0 + Math.PI * pl.turn(t) * (K.side ??= Math.random() < .5 ? 1 : -1) + .25 * Math.sin((t - pl.Ts) * 3.7) * Math.min(1, (t - pl.Ts - GORE.road.turn) * 2) * (t > pl.Ts + GORE.road.turn ? 1 : 0); f[3] = yaw; w.yawS = yaw; w.omega = 0; w.vc = GORE.road.stagger; }
      if (K.t >= pl.T) { f[0] = K.vis[0]; f[2] = K.vis[2]; K.clip = null; K.ct = 0; w.vc = 0;
        if (pl.lane && kerbOut(f[0], f[2]) <= 0) { K.ph = 'dazed'; K.t = 0; K.dz = GORE.road.dazed[0] + Math.random() * (GORE.road.dazed[1] - GORE.road.dazed[0]); }
        else { K.ph = 'back'; K.t = 0; } }
      return; }
    if (K.ph === 'dazed') { K.vis = [f[0], 0, f[2]]; f[1] = settleY(K, f[0], f[2], dt); hazard(K);
      // it turns to the car coming (or to the walk) a beat in
      if (K.t > .35 && pl.lane) { const c = carFor(pl.lane, pl.ua, 0).c, tx = c ? c.x : f[0] - pl.rx, tz = c ? c.z : f[2] - pl.rz; f[3] = Math.atan2(tx - f[0], tz - f[2]); }
      if (K.t > K.dz) { K.ph = 'back'; K.t = 0; S.nearMiss++; } return; }
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
    bait: () => bait ? { x: +bait.w.p[0].toFixed(2), z: +bait.w.p[2].toFixed(2), ax: +bait.a.p[0].toFixed(2), az: +bait.a.p[2].toFixed(2), road: bait.road } : null,
    trip: tryTrip, readyW: () => ready?.w ?? null, plan: w => roadPlan(w, false), arm(s = GORE.arm) { armed = now + s; armedAt = now; }, dbg: () => ({ armed, now, ready: ready && { x: +ready.w.p[0].toFixed(1), z: +ready.w.p[2].toFixed(1), age: +(now - ready.t).toFixed(1), v0: +ready.v0.toFixed(1), gap0: +(ready.gap0 ?? 0).toFixed(1) }, often: GORE.often, on: GORE.on, focus: !!focus, cases: cases.size, holds: [...holds].slice(0, 5).map(([a, h]) => [a.aid, a.id, +(now - h.t).toFixed(2), +(now - h.since).toFixed(2), a.tier, !!a.p]) }),
    // (for looking into why nothing goes: the walkers near the focus, filter by filter)
    probe(r = 45) { const o = { near: 0, ok: 0, lane: 0, reach: 0, car: 0, bad: 0, timing: 0, gaps: [] }; if (!focus) return o;
      for (const w of P.walkers) { if (w.agent || Math.hypot(w.p[0] - focus.x, w.p[2] - focus.z) > r) continue; o.near++; if (!ok(w)) continue; o.ok++; const A = AXIS[w.E.side], lo = laneOut(w.p[0], w.p[2], -A[0], -A[1]); if (!lo) continue; o.lane++;
        const D = lo.d - .2; if (D > GORE.road.reach || D < .9) continue; o.reach++; const pl = plan(w.p[0], w.p[2], -A[0], -A[1], D, true), cf = carFor(lo.L, lo.ua, enterT(pl, lo.d));
        if (cf.bad) o.bad++; if (cf.c) { o.car++; if (o.gaps.length < 12) o.gaps.push([+cf.gap.toFixed(1), +cf.c.v.toFixed(1), +lo.d.toFixed(2)]); } if (cf.ok) o.timing++; const st = strip(w); if (!st || st.lo > .2) o.blockedKerb = (o.blockedKerb || 0) + 1; if (parkedOn(w.p[0], w.p[2], -A[0], -A[1], D)) o.parked = (o.parked || 0) + 1; } return o; } };
}
