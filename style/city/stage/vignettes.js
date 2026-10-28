// STAGE · THE VIGNETTES (stage/index.js runs them). Each: where(ctx, ev) → the point it plays at (or null), start(ctx, ev, at) → a running
// scene { actors, step(t, dt) → still on, end(aborted) } or null, and aftermath() for when it plays off screen (or at 16× / 60× on tape).
// All motion is the walkers' own: borrowed (held) and moved by w.fix, posed through the gait (an idle variant held at a moment of its
// loop: hands behind the back = cuffed, the phone arm = a shove or a hand-off, the stretch's V = hands up, pockets = patting them),
// tilted as a whole body (w.tq: a stumble, a lunge, a fall). Toon timing: fast in, a held beat, out.
// ROBBERIES play authored CLIPS now (A.clip = '<name>': stage/index.js plays it; anim/cast/clips/robbery.js). The idle-held stand-ins
// and the w.tq tilts remain for what has no clip yet (arrests, the scuffle). DEALS play brush_pass (W8, 2026-10-08). STAGE-A (2026-10-08):
// the knock-down and get-up, nobody vanishing in view, the re-staged shot, the spacing — below, from "STAGE-A".
//   idle ids (anim/idle.js IDLE): 0 shift · 1 look around · 2 phone (one arm straight forward) · 3 pockets · 4 hands behind the back · 5 stretch (V at it 8)
import { CLIP, playClip, stopClip, stepClip, clearClip } from '../anim/cast/clips/index.js';   // (the authored clips: the robbery's, falls.js's — anim/cast/clips/)
import { CRUISER } from './props.js';   // (stage-b: the cruiser's hull and kerb-side doors)
import { planStop, driveCar, doorSpots, walkTo, carsThrough } from './cruiser.js';   // (2026-10-09: the cruiser double-parks, and drives in the traffic)
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), ease = x => { x = cl(x); return x * x * (3 - 2 * x); }, ramp = (t, a, b) => cl((t - a) / (b - a));
const dirTo = (A, B) => { const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d, d]; };
const SHOVE = { idle: 2, iw: 1, w: 0, it: 1 }, HANDSUP = { idle: 5, iw: 1, w: 0, it: 8 }, CUFFED = { idle: 4, iw: 1, w: 0, it: 3 }, PATS = t => ({ idle: 3, iw: .55 + .45 * Math.abs(Math.sin(t * 9)), w: 0, it: 1, hp: .38 });
// walk an actor back to where it was taken; true when there (the cop, the dealer: the robbery's and the shot's actors use backTo)
function goHome(A, v = 1.35) { const [x, , z] = A.home; if (Math.hypot(A.x - x, A.z - z) < .03) { A.x = x; A.z = z; A.tx = null; A.ry = A.home[3]; A.faceTo = null; A.back = false; return true; } if (A.tx === null || A.tx !== x) { A.tx = x; A.tz = z; A.v = v; A.faceTo = null; A.back = false; } return false; }
// a fall: backward (s = −1) or forward (+1), with a bounce; k 0 → 1 (only without the falls clips)
function fall(A, k, s = -1) { const f = k < .7 ? (k / .7) ** 2 : 1, b = k > .7 ? Math.sin((k - .7) / .3 * Math.PI) * .12 * (1 - (k - .7) / .3) : 0; A.pitch = s * (1.48 * f - b); A.lift = .19 * f; }
// FALLS (anim/cast/clips/falls.js): the hurt go down with fall_back (→ lie_hurt, a loop on the back), the dead with death_collapse
// (→ lie_still); a shot first plays shot_hit (→ fall_back) or shot_hit_dead (→ death_collapse); a shove, shove_fall (→ lie_hurt).
function goDown(A, dead, shot = false) { const c = shot ? (dead ? 'shot_hit_dead' : 'shot_hit') : (dead ? 'death_collapse' : 'fall_back'); if (!CLIP[c]) return false; A.pitch = A.roll = 0; A.lift = 0; A.faceTo = null; A.pose = null; A.clip = c; return true; }

// ═══ STAGE-A (2026-10-08; slime: "instead of them disappearing, they should fall down and get back up" · "the shooting one didnt play
// out so good" · "def show gun and flash"). NOBODY SINKS INTO THE GROUND ANY MORE (the old fadeAway): a body the sim keeps gets up
// (lie_hurt → get_up at its 2 s wrap: stage/index.js A.seam) and walks on; one the sim takes away (hospital, jail) gets up and leaves on
// foot (walk_hurt, a limp, or run_getaway) along the sidewalks, out of the camera's view; the dead lie (lie_still) until the camera
// can't see them. ctx.free(A, { remove: true }) itself waits for that (stage/index.js: "nobody vanishes in view").
// get up at lie_hurt's next 2 s wrap at least `lie` s in (CLIPS.md: anywhere else its head roll pops)
const getUp = (A, lie = 1.9) => { A.next = { clip: 'get_up', seam: { from: 'lie_hurt', P: 2, after: lie } }; };   // (queued behind the fall: stage/index.js applyPose)
// THE FOOTPRINT a fall covers, in the faller's body frame from where it stood (x across, z ahead; m): on the back (shove_fall: 0.36 back,
// fall_back, shot_hit: 0.28 back, then the lie: the big head on the ground ~1.9 m behind the heels) · on the side (death_collapse: over
// the right foot onto the +x side)
const BACK_FP = [-.62, .62, -2.45, .45], SIDE_FP = [-.6, 2.3, -1.05, .7];
const toW = (x, z, ry, bx, bz) => [x + bx * Math.cos(ry) + bz * Math.sin(ry), z - bx * Math.sin(ry) + bz * Math.cos(ry)];
// what a fall there would land on: walls and props (occupancy cells more than 0.3 m over the faller's feet) and people (anyone within
// 0.35 m of the footprint, never `skip`)
function fallHits(C, O, x, z, ry, y0, fp, skip = [], near = null, standing = false) { let solid = 0, n = 0;
  let road = 0; for (let bx = fp[0]; bx <= fp[1] + 1e-6; bx += .2) for (let bz = fp[2]; bz <= fp[3] + 1e-6; bz += .2) { const [wx, wz] = toW(x, z, ry, bx, bz), h = O ? O.at(wx, wz) : null; n++; if (h !== null && h > y0 + .3) solid++; else if (h !== null && h < y0 - .12) road++; }
  let people = 0; const c = Math.cos(ry), s = Math.sin(ry);
  let passing = 0; for (const [px, pz, w] of near || C.walkersNear(x, z, 4.5, skip)) { const dx = px - x, dz = pz - z, bx = dx * c - dz * s, bz = dx * s + dz * c; if (bx > fp[0] - .35 && bx < fp[1] + .35 && bz > fp[2] - .35 && bz < fp[3] + .35) { if (standing && (w.vc || 0) > .1) passing++; else people++; } }
  return { solid, people, passing, road, n }; }
// the probe's count: a body going down now, its footprint checked against what is there THIS frame
function downNow(C, A, fp, skip = []) { const P = C.probe; if (!P?.on) return; P.falls++; const O = C.occ(A.x, A.z, 3.5), r = fallHits(C, O, A.x, A.z, A.ry, A.y, fp, skip, null, true); P.passing = (P.passing || 0) + r.passing;
  if (r.solid > 1 || r.people) { P.fallHits++; P.fallBad.push({ h: A.h, solid: r.solid, people: r.people }); if (P.fallBad.length > 12) P.fallBad.shift(); } }
// THE PAIR'S AXIS: u (unit, from P toward its partner Q at P + u·D) among 24 directions, the nearest to u0 that is good: Q's spot is
// standing ground (no wall or prop within 0.35 m, the same level ±0.3 m) with nobody within 1.25 m; with `los` the line between them is
// clear above the waist; each fall's footprint lands on open ground (falls: P's — facing u, its back away from Q — and/or Q's — facing
// −u). P stays where it is: only the partner moves (and P turns).
// THE CAMERA'S SIDE (2026-10-09; TV plan A2's misses, the failed robberies at Kent St & 1st): the camera is placed (camera/shots.js)
// before the scene turns the pair, and a partner's spot behind the corner's 3.3 m structure, from the side of the line the first shot
// took, was never seen. Each candidate's partner spot now costs what the camera can't see of it (chest and head: camView, hiddenAt).
function pickAxis(C, O, P, u0, { D = 0, falls = [], skip = [], los = false, q = true, side = 0, view } = {}) {
  const viewOf = () => view === undefined ? (view = camView(C, P)) : view;   // (only when there is a partner to see: camView may draw a map)
  const a0 = Math.atan2(u0[0], u0[1]), y0 = P.y, cf = [P.x - C.camera.position.x, P.z - C.camera.position.z], cl = Math.hypot(cf[0], cf[1]) || 1; let best = null;
  const near = C.walkersNear(P.x, P.z, D + 4, skip), nearAt = (x, z, r) => near.filter(([px, pz]) => Math.hypot(px - x, pz - z) < r);   // (everyone round once: the candidates filter it)   // (side: a preference for the axis across the camera's view: the pair side-on, neither hiding the other or the gun)
  for (let k = 0; k < 24; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 12, u = [Math.sin(a), Math.cos(a)], qx = P.x + u[0] * D, qz = P.z + u[1] * D; let bad = 0;
    if (q && D > 0) { for (const [ox, oz] of [[0, 0], [.35, 0], [-.35, 0], [0, .35], [0, -.35]]) { const h = O ? O.at(qx + ox, qz + oz) : null; if (h === null || h > y0 + .3 || h < y0 - .35) bad += 3; }
      bad += 4 * nearAt(qx, qz, 1.3).length; }
    let low = 0; if (los && D > 0) for (let f = .12; f < .9; f += .08) { const h = O ? O.at(P.x + u[0] * D * f, P.z + u[1] * D * f) : null; if (h !== null && h > y0 + .65) bad += 2; else if (h !== null && h > y0 + .3) low++; }   // (low: a pile in the way: it hides the shooter from the street)
    const why = []; for (const F0 of falls) { const F = { ...F0, fp: [F0.fp[0] - .12, F0.fp[1] + .12, F0.fp[2] - .12, F0.fp[3] + .12] }, fd = F.d ?? D, r = F.who === 'Q' ? fallHits(C, O, P.x + u[0] * fd, P.z + u[1] * fd, a + Math.PI, y0, F.fp, skip, near) : fallHits(C, O, P.x, P.z, a, y0, F.fp, skip, near); bad += r.solid + 6 * r.people; low += r.road / 8; why.push(r.solid, r.people); }   // (off the kerb into the road: a soft cost — the traffic)
    const hid = q && D > 0 ? unseenAt(C, viewOf(), O, qx, qz, y0) : 0;   // (the camera's side: what of the partner it can't see there)
    const cost = bad * 10 + low * 3 + hid * 4 + Math.ceil(k / 2) * .4 + side * Math.abs(u[0] * cf[0] + u[1] * cf[1]) / cl; if (C.probe?.on) (C.probe.axes ||= []).push([k, bad, low, hid, ...why]);
    if (!best || cost < best.cost) best = { u, a, q: [qx, qz], bad, hid, cost, k }; if (bad === 0 && !low && !hid && !side) break; }
  if (C.probe?.on) { C.probe.axis = { k: best.k, bad: best.bad, tried: C.probe.axes.slice(-24) }; C.probe.axes.length = 0; }
  return best; }
// NO CLEAR AXIS where P stands (a narrow sidewalk, a corner by a wall): look for a better place for P to step to first — up to 1.6 m off,
// standing ground nobody is on — and the axis there. → { x, z, ax } (x, z: P's own place when that is best)
// (2026-10-09, the Grand Ave & 1st robbery: the victim's own place counts too — someone standing within 1.3 m of it, a kerb waiter 0.8 m
// off, their big heads in each other all scene: P steps clear of them first)
// (2026-10-09, the camera's side: P's own place counts too — a step to where the camera sees it, and its partner, when here it can't)
function placeFor(C, O, P, u0, o) { const view = o.view || camView(C, P), oo = { ...o, view }, here = pickAxis(C, O, P, u0, oo), near = C.walkersNear(P.x, P.z, 4, o.skip || []), crowd = near.filter(([px, pz, w]) => (w.vc || 0) < .3 && Math.hypot(px - P.x, pz - P.z) < 1.3).length, hidP = unseenAt(C, view, O, P.x, P.z, P.y);
  if (!here.bad && !crowd && !here.hid && !hidP) return { x: P.x, z: P.z, ax: here };
  let best = { x: P.x, z: P.z, ax: here, cost: here.bad * 10 + crowd * 25 + (here.hid + hidP) * 4 }; const P2 = { ...P };
  for (const r of [.8, 1.6, 2.4]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r, h = O ? O.at(x, z) : null;
    if (h === null || Math.abs(h - P.y) > .12 || near.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.3)) continue;
    let wall = false; if (O) for (let f = .2; f <= 1; f += .2) { const hh = O.at(P.x + (x - P.x) * f, P.z + (z - P.z) * f); if (hh !== null && hh > P.y + .3) wall = true; } if (wall) continue;
    P2.x = x; P2.z = z; const A = pickAxis(C, O, P2, u0, oo), hid = A.hid + unseenAt(C, view, O, x, z, P.y), cost = A.bad * 10 + hid * 4 + r * 2; if (cost < best.cost) best = { x, z, ax: A, cost }; if (!A.bad && !hid) break; }
  return best; }
// INDOORS (2026-10-09, D1 12:00 at Grand Ave & 1st on the tape): the victim's walker was 2 m inside the corner building (the tape had it
// walking in at that minute) and the robbery played in there, seen by no camera from anywhere. A body standing in something solid
// (over 1.5 m above its feet) plays its part from the nearest standing ground within 4.5 m (the sidewalk's height, nothing over 0.3 m
// round it), and is there at once (`snap`: unseen in there, it comes out of the wall, not through it)
function outdoors(O, P, snap = false) { const h = O ? O.at(P.x, P.z) : null; if (h === null || h < P.y + 1.5) return P;
  for (let r = .5; r <= 4.5 + 1e-6; r += .5) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
    if (![[0, 0], [.35, 0], [-.35, 0], [0, .35], [0, -.35]].every(([ox, oz]) => { const g = O.at(x + ox, z + oz); return g !== null && Math.abs(g - P.y) < .12; })) continue;
    if (snap && P.w) { P.x = x; P.z = z; P.w.fix = [x, P.y, z, P.ry]; if (P.w.p) { P.w.p[0] = x; P.w.p[2] = z; } return P; } return { ...P, x, z }; }
  return P; }
// what the camera sees from: where it is, or where the shot moving it will put it (ctx.camAim), and the shots' wide height map round
// the scene when one is cached (camera/shots.js plans on it: 32 m round, 160 m high) — else the scene's own small map. Farther than
// 45 m (a wide view, the default city camera pulled back) nothing is judged
function camView(C, P) { const c = C.camAim ? C.camAim() : C.camera?.position; if (!c || Math.hypot(c.x - P.x, c.z - P.z) > 45) return null;
  const k = P.view; if (k && k.c.x === c.x && k.c.z === c.z && Math.hypot(k.x - P.x, k.z - P.z) < 3) return k.v;   // (one per scene start: the same camera, the same place)
  // the map: the shots' (cached, 32 m round the scene, 160 m high) when it covers the stretch to the camera, else one drawn now over it
  // (one render, 40 m high: the scene's own small map is 14 m high, and taller is its hollow, clipped shell)
  const mx = (P.x + c.x) / 2, mz = (P.z + c.z) / 2, half = Math.min(24, Math.max(Math.abs(P.x - c.x), Math.abs(P.z - c.z)) / 2 + 4);
  const M = C.occCover?.(mx, mz, half, { top: 30 }) || (C.occ ? C.occ(mx, mz, half, { n: 128, top: 40 }) : null);
  const v = { cam: { x: c.x, y: c.y, z: c.z }, M, W: window.__city?.cam?.world || null }; P.view = { c: { x: c.x, z: c.z }, x: P.x, z: P.z, v }; return v; }
// how many of a body's chest (1.1 m) and head (1.6 m) at (x, z) the camera can't see (0–2): out of its frame, or behind something solid
const unseenAt = (C, view, O, x, z, y0) => { if (!view) return 0; const off = C.onScreen ? 2 - C.onScreen(x, z, y0) : C.inView(x, z) ? 0 : 2; return off === 2 ? 2 : Math.max(off, hiddenAt(view, O, x, z, y0)); };
// THE SHOT FOLLOWS THE MARKS (TV plan A2's hook, 2026-10-09). The tape's shot frames where its people were about to be (their stand
// spots); the scene plays where they are when it starts — a victim on its beat 5 m down the kerb, a step to clearer ground — and at
// Kent St & 1st that was out of the frame or behind the corner's structure. When the marks the scene has set (P, and its partner at Q)
// can't both be seen from where the camera is, the shot moves to them (camera/shots.js go, quick: 0.6 s, the scene's own side of the
// line; from higher, up to 45°, only when 25–35° can't see them). TAPE only, the camera the tape's shot of this very scene (its last
// spec: the scene key ends with the pair) and in orbit, nothing moving it: LIVE the camera is the viewer's.
function followMarks(C, e, marks) { if (C.lens() !== 'tape') return false; const S = C.shots?.(), r = window.__city?.cam; if (!S || (S.current && !S.current.over) || (r && r.mode !== 'orbit')) return false;
  const sp = S.lastSpec?.(), pair = [e.who, e.to].filter(Boolean).sort().join('+'); if (!sp?.scene || !String(sp.scene).startsWith('tape:') || !String(sp.scene).endsWith(':' + pair)) return false;
  let x = 0, z = 0; for (const m of marks) { x += m.x / marks.length; z += m.z / marks.length; }
  S.go({ kind: 'two', at: { x, z }, actors: marks.map(m => ({ x: m.x, z: m.z, y: m.y, h: m.h })), scene: sp.scene, sceneT: sp.sceneT, label: sp.label }, { quick: true }); if (C.probe) { C.probe.follows = (C.probe.follows || 0) + 1; C.probe.followLast = { t: +C.clock.toFixed(1), marks: marks.map(m => [+m.x.toFixed(2), +m.z.toFixed(2)]) }; } return true; }
// (and the collision world's own ray, camera/world.js, STATIC: walls and posts — where its blocks along the line are the real ones: what
// camera/shots.js and tools/shotcheck.mjs judge by; a post a map's cell misses)
function hiddenAt(view, O, x, z, y0) { if (!view) return 0; const M = view.M || O, W = view.W, c = view.cam; let n = 0;
  const real = W?.ready && [0, .5, 1].every(k => W.ready(x + (c.x - x) * k, z + (c.z - z) * k));
  for (const hy of [1.1, 1.6]) if ((M && rayHits(M, x, y0 + hy, z, c)) || (real && W.ray(c, { x, y: y0 + hy, z }, 1))) n++; return n; }
// the line from a point to the camera through a height map (camera/shots.js occBlocked's walk, widened 0.2 m to each side as there: a
// post seen from above is a pixel thin, or missed): solid above the line anywhere on the map → hidden; off the map: as far as it can tell, clear
function rayHits(M, x, y, z, cam) { const dx = cam.x - x, dz = cam.z - z, L = Math.hypot(dx, dz); if (L < .01) return false; const step = Math.max(.12, M.half * 2 / M.n * .6), wx = -dz / L * .2, wz = dx / L * .2;
  for (let s = .35; s < L; s += step) { const k = s / L, px = x + dx * k, pz = z + dz * k, h = M.at(px, pz), yy = y + (cam.y - y) * k + .05; if (h === null) return false;
    if (h > yy || M.at(px + wx, pz + wz) > yy || M.at(px - wx, pz - wz) > yy) return true; } return false; }
// walk to a point by way of a side point when the straight line would go through `P` (an actor walking round its partner)
// (O: the occupancy: the way round is the one whose legs cross nothing over the knees, at the smallest radius that does)
// (cam, 2026-10-09: both ways round are tried and the one kept nearer the camera's far side wins — a robber arcing round its victim
// on the camera's side walked out under the bottom of the frame, Kent St & 1st)
function around(A, P, to, r = 1.4, O = null, force = false, cam = null) { const ax = A.x - P.x, az = A.z - P.z, bx = to[0] - P.x, bz = to[1] - P.z, a = Math.atan2(ax, az), b = Math.atan2(bx, bz), d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const clear = (x0, z0, x1, z1) => { if (!O) return true; for (let f = 0; f <= 1; f += .1) { const h = O.at(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f); if (h !== null && h > P.y + .35) return false; } return true; };
  const near = force && segDist([P.x, P.z], [A.x, A.z], to) < r;   // (force: the walk back, 2026-10-09 — not straight past P, however small the turn)
  if (Math.abs(d) < 1.1 && !near && clear(A.x, A.z, to[0], to[1])) return [to];
  // THE ARC IS CLOSE ROUND P (2026-10-09, the Grand Ave & 1st robbery): at r, reached from a walker farther off along its tangent. It was
  // at the walker's own distance: the robber, 7.8 m off, went 20 m round, was still walking when the scene's 6 s were up and lunged
  // at the air 10 m from the victim ("happens across the street")
  const L = Math.hypot(ax, az), found = [];
  for (const dd of [d, d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI]) { for (const rr of [r, r + .8, r + 1.6, r + 2.4]) { const sg = Math.sign(dd) || 1, t0 = L > rr ? Math.acos(rr / L) : 0, span = Math.abs(dd) - t0;
    if (span <= 0) { if (clear(A.x, A.z, to[0], to[1])) return [to]; continue; }   // (the tangent is already past it: straight there)
    const pts = [], n = Math.max(1, Math.ceil(span / .7)); let x = A.x, z = A.z, ok = true;
    for (let k = t0 > 0 ? 0 : 1; k <= n; k++) { const m = a + sg * (t0 + span * k / (n + 1)), px = P.x + Math.sin(m) * rr, pz = P.z + Math.cos(m) * rr; if (!clear(x, z, px, pz)) { ok = false; break; } pts.push([px, pz]); x = px; z = pz; }
    if (ok && clear(x, z, to[0], to[1])) { found.push([...pts, to]); break; } }
    if (found.length && !cam) break; }
  if (found.length) { if (found.length === 1) return found[0];   // (cam: the way whose nearest point to the camera is farther, unless much longer)
    const score = pts => { let len = 0, x = A.x, z = A.z, near = 1e9; for (const [px, pz] of pts) { len += Math.hypot(px - x, pz - z); x = px; z = pz; near = Math.min(near, Math.hypot(px - cam.x, pz - cam.z)); } return len + 6 * Math.max(0, 7 - near); };
    return score(found[0]) <= score(found[1]) ? found[0] : found[1]; }
  if (Math.abs(d) < 1.1 && !near) return [to]; const r0 = Math.min(Math.max(r, L), r + .8), n = Math.max(1, Math.ceil(Math.abs(d) / .9)), pts = []; for (let k = 1; k <= n; k++) { const m = a + d * k / (n + 1); pts.push([P.x + Math.sin(m) * r0, P.z + Math.cos(m) * r0]); } return [...pts, to]; }
const goTo = (A, pts, v) => { A.path = pts.slice(); A.tx = null; A.v = v; A.faceTo = null; A.back = false; };
const arrived = A => A.tx === null && !A.path?.length;
// HAND-BACK: where an actor goes when its part is over. Taken off a lane: back to that lane point (it walks on). Off a stand spot: its own
// spot when nobody else stands within 1.25 m of it (the stage's own actors aside: those that stay are in `avoid`, [x, z, r]), else the nearest
// free spot of its place that is (claimed for it: ctx.respot), else its own. Picked once; walked to at v; true when there.
function backTo(C, A, avoid = [], v = 1.3, O = null) {
  if (!A.back2) { const a = C.agents.map.get(A.h), [hx, , hz, hr] = A.home, ok = (x, z) => C.walkersNear(x, z, 1.25, [A]).every(([, , w]) => w.stagePose) && avoid.every(p => Math.hypot(p[0] - x, p[1] - z) >= (p[2] ?? 1.25));
    A.back2 = [hx, hz, hr];
    if (A.kind === 'held' && a?.spot && !a.held?.E && !ok(hx, hz)) { let best = null, bd = 1e9;
      for (const sp of C.agents.spots.get(a.spot.place) || []) { if ((sp.taken && sp.taken !== a.id) || sp.kind === 'bench' || !ok(sp.x, sp.z)) continue; const d = Math.hypot(sp.x - A.x, sp.z - A.z); if (d < bd) { bd = d; best = sp; } }
      if (best && C.respot(A, best)) A.back2 = [best.x, best.z, best.ry ?? hr]; } }
  const [x, z, ry] = A.back2; if (Math.hypot(A.x - x, A.z - z) < .03) { A.x = x; A.z = z; A.tx = null; A.path = null; A.ry = ry; A.faceTo = null; A.back = false; A.back2go = 0; return true; }
  // THE WAY BACK GOES ROUND THE SCENE (2026-10-09): it was a straight line, and the robber walked back through its victim (the tape
  // probe's actor-in-actor heads 4 → 134 frames). Now round the first of the stage's other people (standing, lying or cowering) within
  // 1.35 m of that line (around(), forced: however small the turn), planned once; again only if something else cleared its way
  if (!A.back2go || (A.tx === null && !A.path?.length)) { A.back2go = 1; goTo(A, wayBack(C, A, [x, z], O), v); }
  return false; }
// the way from an actor to T clear of the stage's other people: [T], or round the first one in the way (by its distance along the line)
function wayBack(C, A, T, O = null) { const R = 1.35, L = Math.hypot(T[0] - A.x, T[1] - A.z); if (L < .3) return [T]; let P = null, pt = 1e9;
  for (const [px, pz, w] of C.walkersNear((A.x + T[0]) / 2, (A.z + T[1]) / 2, L / 2 + R, [A])) { if (!w.stagePose || Math.hypot(px - T[0], pz - T[1]) < 1) continue;   // (one standing by its own spot: no way round that)
    if (segDist([px, pz], [A.x, A.z], T) >= R) continue; const t = ((px - A.x) * (T[0] - A.x) + (pz - A.z) * (T[1] - A.z)) / L; if (t < pt) { pt = t; P = { x: px, z: pz, y: w.p[1] }; } }
  return P ? around(A, P, T, 1.5, O, true) : [T]; }
// LEAVING ON FOOT: a path along the sidewalks (the walkers' own lanes: clear of walls and props) toward and past the camera's ground point
// (the nearest way out of its view: looking down, the frame's bottom edge is only ~10–15 m off), walked at v with `clip` (walk_hurt: the
// limp, at its own 0.8 m/s, the walk's legs off; run_getaway; none: the walk). The caller then frees it with remove: it goes once unseen.
export function leaveOnFoot(C, A, { v = 1.35, clip = null, away = null } = {}) {
  const P = C.psim, cam = C.camera.position, path = []; let gx = cam.x - A.x, gz = cam.z - A.z; const gl = Math.hypot(gx, gz) || 1;
  if (away) { const ax = A.x - away[0], az = A.z - away[1], al = Math.hypot(ax, az) || 1; if ((ax * gx + az * gz) / (al * gl) < -.2) { gx = ax / al * gl; gz = az / al * gl; } }   // (never back through the scene)
  const L = P.laneNear?.(A.x, A.z, 16), tx = A.x + gx / gl * Math.max(30, gl * 1.6), tz = A.z + gz / gl * Math.max(30, gl * 1.6), G = L && P.laneNear(tx, tz, 40), way = G && P.wayTo(L.E, L.s, G), at = (E, s) => { const p = P.where({ E, s }, [0, 0, 0, 0]); return [p[0], p[2]]; };
  if (L && way) { path.push(at(L.E, L.s)); const edges = [L.E, ...way]; edges.forEach((E, k) => { const s0 = k ? 0 : L.s, s1 = k === edges.length - 1 ? G.s : E.len; if (way.length === 0 && k === 0 && G.s < L.s) return;
      for (let s = s0 + 6; s < s1; s += 6) path.push(at(E, s)); path.push(at(E, Math.max(0, Math.min(E.len, s1)))); }); }
  else path.push([tx, tz]);
  A.path = path; A.tx = null; A.v = clip && CLIP[clip]?.speed ? CLIP[clip].speed : v; A.faceTo = null; A.back = false; A.snap = false; A.pose = null; A.pitch = A.roll = A.lift = 0; A.leaving = true; if (clip !== undefined) A.clip = clip; return path; }
// the sim takes them away (sticky: once seen gone, gone)
const goneOf = (C, A, e) => (A.gone ||= C.gone(A.h) || (e?.hurtGone ?? false));
// BYSTANDERS (falls.js cower): near a crime a few of the crowd's walkers (never an agent) stop where they are, turn to it and cower for a
// few seconds, then walk on. stepCowers (stage/index.js frame) times them; the gait hook (w.stagePose) plays the clip. `out(x, z)` →
// a point to step to first (a shot's line of fire: they get out of it, then cower) or null.
const COWERS = [];
export function cowerNear(C, x, z, { n = 3, r = 9, secs = 3.2, out = null } = {}) {
  if (!CLIP.cower) return 0; const pick = C.psim.walkers.filter(w => !w.agent && !w.gone && w.E && !w.fix && !w.stagePose && w.tier === 1 && Math.hypot(w.p[0] - x, w.p[2] - z) < r)
    .sort((a, b) => Math.hypot(a.p[0] - x, a.p[2] - z) - Math.hypot(b.p[0] - x, b.p[2] - z)).slice(0, n);
  pick.forEach((w, k) => { const to = out ? out(w.p[0], w.p[2]) : null, c = { w, t: -.12 - .18 * k, end: secs + .5 * k + (to ? 1.2 : 0), on: false, to, at: [x, z], k };
    w.halt = true; w.vc = 0; w.fix = [w.p[0], w.p[1], w.p[2], Math.atan2(x - w.p[0], z - w.p[2]) + (k % 2 ? .35 : -.35)];
    w.stagePose = (g, dt) => { if (c.t >= 0 && !c.on && !c.to) { c.on = true; playClip(g, 'cower', { t: Math.random() * 2.4 }); } if (c.t > c.end && g.clip?.name === 'cower' && !g.clip.out) stopClip(g); if (g.clip) { if (!g.clip.out) g.w = 0; stepClip(g, dt); } };
    COWERS.push(c); }); return pick.length; }
export function stepCowers(dt) { for (let k = COWERS.length - 1; k >= 0; k--) { const c = COWERS[k], w = c.w; c.t += dt;
  if (c.to && !w.gone) { const f = w.fix, dx = c.to[0] - f[0], dz = c.to[1] - f[2], d = Math.hypot(dx, dz), st = 2.6 * dt;   // (out of the line of fire first, in a hurry)
    if (d <= st) { w.fix = [c.to[0], f[1], c.to[1], Math.atan2(c.at[0] - c.to[0], c.at[1] - c.to[1]) + (c.k % 2 ? .35 : -.35)]; c.to = null; w.vc = 0; }
    else { w.fix = [f[0] + dx / d * st, f[1], f[2] + dz / d * st, Math.atan2(dx, dz)]; w.vc = 2.6; w.ph += 2.6 * dt * 3.1; } }
  if (w.gone || c.t > c.end + .45) { if (!w.gone) { w.stagePose = null; if (w.g?.clip) clearClip(w.g); w.fix = null; w.halt = false; w.vc = 0; } COWERS.splice(k, 1); } } }
// the line of fire from S to V (and a fall's footprint behind V): where a body at (x, z) steps to, clear of it (2.6 m off the line, on its
// own side, on standing ground nobody else is on), or null when it isn't in the way
function outOfLine(C, O, S, V, fp, ry, x, z, taken = null) {   // (taken: the points already given out in this scene: 1.4 m apart at least)
  const lx = V.x - S.x, lz = V.z - S.z, L = Math.hypot(lx, lz) || 1, ux = lx / L, uz = lz / L, px = x - S.x, pz = z - S.z, along = px * ux + pz * uz, side = px * -uz + pz * ux, c = Math.cos(ry), s = Math.sin(ry);
  const dx = x - V.x, dz = z - V.z, bx = dx * c - dz * s, bz = dx * s + dz * c, inFp = fp && bx > fp[0] - .6 && bx < fp[1] + .6 && bz > fp[2] - .6 && bz < fp[3] + .6;
  const inLine = along > -1.3 && along < L + 1.3 && Math.abs(side) < 1.4, nearS = Math.hypot(px, pz) < 1.4; if (!inLine && !inFp && !nearS) return null;
  const sg = side >= 0 ? 1 : -1; for (const k of [sg, -sg]) for (const off of [2.6, 3.3, 4]) { const t = Math.max(.3, Math.min(L * .7, along)), ox = S.x + ux * t + -uz * off * k, oz = S.z + uz * t + ux * off * k, h = O ? O.at(ox, oz) : null;
    if (h === null || h > V.y + .3 || h < V.y - .35) continue; if (C.walkersNear(ox, oz, 1.1).length || taken?.some(p => Math.hypot(p[0] - ox, p[1] - oz) < 1.4)) continue; taken?.push([ox, oz]); return [ox, oz]; }
  return null; }

// A SHOT (stage-a, 2026-10-08). The shooter (when the lens names one and it is drawn near) STEPS BACK to 3.5 m from the victim, square to
// it: the pair's axis is turned (pickAxis) so the victim falls onto open ground (its footprint clear of walls, props and people), the
// shooter's spot is standing ground nobody is on, and the line between them is clear. Bystanders in the line of fire (agents, borrowed;
// the crowd, cowerNear's `out`) get out of it and cower. aim_draw (the gun in the hand from the draw) → aim_hold (1.6 s: the victim's
// hands go up, "?!") → aim_fire: BANG — a big muzzle flash at the muzzle and smoke, a "BANG!" burst, the hit (a white puff, no gore);
// the victim: shot_hit → fall_back → lie_hurt (4 s) → get_up (hurt, staying: a pat of the pockets, back) or, the sim taking them to
// hospital, the limp off (walk_hurt) out of view; shot_hit_dead → death_collapse → lie_still (the chalk; the body stays until the camera
// can't see it). The shooter: aim_lower → run_getaway. No shooter: the shot from off screen (the BANG over the victim). `cash`: a
// robbery's bills burst at the hit.
function shotScene(C, e, V, S, dead, { cash = false } = {}) {
  const B = {}, D = 3.5, fp = dead ? SIDE_FP : BACK_FP, O = C.occ(V.x, V.z, 6), skip = [V, S].filter(Boolean), y0 = V.y, V0 = outdoors(O, V, true);
  const u0 = S ? [S.x - V0.x, S.z - V0.z] : [Math.sin(V.ry), Math.cos(V.ry)], pl = placeFor(C, O, V0, Math.hypot(u0[0], u0[1]) > .01 ? u0 : [0, 1], { D: S ? D : 0, falls: [{ who: 'P', fp }], skip, los: !!S, q: !!S, side: S ? 5 : 0 }), ax = pl.ax;
  if (Math.hypot(pl.x - V.x, pl.z - V.z) > .05) { V.tx = pl.x; V.tz = pl.z; V.v = 1.3; }   // (a step to clearer ground first: it backs off from the gun)
  const aim = Math.atan2(ax.u[0], ax.u[1]), Q = { x: ax.q[0], z: ax.q[1] }, actors = [V, S].filter(Boolean), helpers = [];
  V.snap = false; V.faceTo = null;
  if (S) { const vw = camView(C, V); if (unseenAt(C, vw, O, pl.x, pl.z, V.y) || unseenAt(C, vw, O, Q.x, Q.z, V.y)) followMarks(C, e, [{ x: pl.x, z: pl.z, y: V.y, h: V.h }, { x: Q.x, z: Q.z, y: V.y, h: S.h }]); }   // (the shot follows the marks: TAPE)
  if (S) { S.snap = false; const dx = Q.x - S.x, dz = Q.z - S.z, d = Math.hypot(dx, dz), backing = (dx * (S.x - V.x) + dz * (S.z - V.z)) > 0 && d < 3;
    if (d > .08) { if (backing) { S.path = null; S.tx = Q.x; S.tz = Q.z; S.v = 2.2; S.back = true; S.faceTo = [V.x, V.z]; } else goTo(S, around(S, { x: pl.x, z: pl.z, y: V.y }, [Q.x, Q.z], 1.6, O, false, C.camAim?.()), 2.6); } }
  // the bystanders: agents in the line of fire (or V's fall, or S's spot) are borrowed and step out of it, then cower
  const taken = [];
  if (S) for (const a of C.agents.map.values()) { if (!a.w || C.busy(a.id) || actors.some(A => A.h === a.id)) continue; const to = outOfLine(C, O, Q, V, fp, aim, a.w.p[0], a.w.p[2], taken); if (!to) continue;
    const H = C.actor(a.id); if (!H) continue; H.cower = 0; goTo(H, [to], 2.6); helpers.push(H); actors.push(H); }
  return { actors, step(t, dt) {
    // ── the shooter: in place, square up, draw
    if (S && B.arr === undefined) { V.faceTo = V.tx === null ? [S.x, S.z] : null; if (((arrived(S) && !S.back) || (S.back && S.tx === null) || t > 6) && (V.tx === null || t > 6)) { V.tx = null; B.arr = t; S.tx = null; S.path = null; S.back = false; S.faceTo = [V.x, V.z]; } }
    if (S && B.arr !== undefined && B.draw === undefined && t > B.arr + .25) { B.draw = t; S.snap = true; S.faceTo = [V.x, V.z]; S.clip = 'aim_draw'; }
    if (!S && B.draw === undefined) { B.draw = 0; V.faceTo = null; }
    if (!S && V.tx === null && t < 2.5 && B.fire === undefined) V.ry += Math.atan2(Math.sin(aim - V.ry), Math.cos(aim - V.ry)) * Math.min(1, dt * 8);   // (turned so its fall is clear)
    if (B.draw !== undefined && B.fire === undefined) {
      if (S) { const s = t - B.draw;
        if (s > .3 && !B.cow) { B.cow = 1 + cowerNear(C, V.x, V.z, { out: (x, z) => outOfLine(C, O, Q, V, fp, aim, x, z, taken) }); }
        if (s > .45 && !B.hands) { B.hands = 1; V.faceTo = [S.x, S.z]; if (CLIP.hands_up_point) V.clip = 'hands_up_point'; if (!this.ex) { this.ex = 1; C.props.exclaim(V.w, 1.4); } }
        if (s > .7 && !B.ask) { B.ask = 1; S.clip = 'aim_fire'; S.seam = { from: 'aim_hold', P: .8, after: 1.5 }; }   // (a beat to read: 1.6 s on aim)
        if (S.now === 'aim_fire' || s > 4.2) { if (S.now !== 'aim_fire') S.seam = null; B.fire = t; } }
      else if (t > .6 && V.tx === null) B.fire = t; }
    // ── BANG
    if (B.fire !== undefined && !B.bang) { B.bang = 1; const u = ax.u, mz = S?.muzzle && S.now === 'aim_fire' ? S.muzzle : S ? [S.x + u[0] * -.77, y0 + .87, S.z + u[1] * -.77] : null;
      if (mz) { C.props.bang(mz[0], mz[1], mz[2], { fsize: 2.6, puffs: 4, size: 1.35, dir: [-u[0], -u[1]] }); C.props.bangText(mz[0] - u[0] * .9, mz[1] + 1.75, mz[2] - u[1] * .9); }
      else { C.props.bang(V.x, y0 + 1.05, V.z, { fsize: 1.6, puffs: 2 }); C.props.bangText(V.x, y0 + 2.9, V.z); }
      C.props.bang(V.x + u[0] * .15, y0 + 1.05, V.z + u[1] * .15, { flash: false, puffs: 2, colour: 0xffffff, size: .6, dir: u });
      V.faceTo = null; V.tx = null; V.path = null; V.ry = aim; V.snap = true; V.pose = null; if (!goDown(V, dead, true)) B.plank = t; downNow(C, V, fp, actors);
      if (cash) C.props.burst(V.x, 1.1, V.z, 14, -u[0] * .4, -u[1] * .4, 45); if (!S) cowerNear(C, V.x, V.z); }
    if (B.plank !== undefined) { V.roll = 0; fall(V, ramp(t, B.plank, B.plank + .5), -1); }
    const s = B.bang ? t - B.fire : -1;
    // ── the shooter: lower, run
    if (S && B.bang && !this.sOut) {
      if (s > .3 && !B.low) { B.low = 1; S.clip = 'aim_lower'; S.seam = { from: 'aim_hold', P: .8, after: 0 }; }
      if (S.now === 'aim_lower' && B.lowT === undefined) B.lowT = t;
      if (!B.run && ((B.lowT !== undefined && S.now !== 'aim_lower') || s > 3.2)) { B.run = t; S.seam = null; S.snap = false; S.faceTo = null;
        if (goneOf(C, S, null)) { leaveOnFoot(C, S, { clip: 'run_getaway', away: [V.x, V.z] }); this.sOut = 1; C.free(S, { remove: true }); }
        else { S.clip = 'run_getaway'; const g = lanePath(C, S, [S.x - V.x, S.z - V.z], 10, [V.x, V.z]); goTo(S, g, CLIP.run_getaway.speed); } }
      if (B.run && !this.sOut && arrived(S) && !B.ran) { B.ran = t; S.clip = null; }
      if (B.ran && t > B.ran + .6 && backTo(C, S, [[V.x, V.z, 3]], 1.3, O) && !this.sOut) { this.sOut = 1; C.free(S); } }
    // ── the victim
    if (B.bang && dead && s > 2.6 && !this.mark) { this.mark = 1; const m = { x: V.x, z: V.z, ry: V.ry + Math.PI }; C.props.chalk(m.x, m.z, m.ry, { key: C.lens() }); if (C.lens() === 'live') C.liveMarks.push(m); }
    if (B.bang && !this.vOut) {
      if (dead) { if (s > 4) { this.vOut = 1; C.free(V, { remove: true }); } }   // (it lies: removed once the camera can't see it)
      else { if (!B.upAsk && s > .2) { B.upAsk = 1; getUp(V, 3.9); }
        if (V.now === 'get_up' && B.upT === undefined) B.upT = t; if (B.upT === undefined && s > 9) { V.seam = null; B.upT = t; }   // (no gait hook: force it)
        if (B.upT !== undefined && !B.up && V.now !== 'get_up' && t > B.upT + .5) { B.up = t;
          if (goneOf(C, V, e)) { leaveOnFoot(C, V, { clip: 'walk_hurt', away: S ? [S.x, S.z] : null }); this.vOut = 1; C.free(V, { remove: true }); } }
        if (B.up && !this.vOut) { const k = t - B.up; if (k < 1.7) { if (!B.pat) { B.pat = 1; V.clip = 'pat_pockets'; } } else { if (!B.patOff) { B.patOff = 1; V.clip = null; } if (backTo(C, V, S ? [[S.x, S.z, 1.3]] : [], 1.3, O)) { this.vOut = 1; C.free(V); } } } } }
    // ── the bystanders: out of the line, cower till the shooter runs, then back
    for (const H of helpers) { if (H.freed || H.done) continue;
      if (H.cower === 0 && arrived(H)) { H.cower = t; H.faceTo = [V.x, V.z]; H.clip = 'cower'; }
      if (H.cower && (B.run || t > 14) && t > H.cower + 2 && !H.up) { H.up = t; H.clip = null; H.faceTo = null; }
      if (H.up && t > H.up + .5 && backTo(C, H, [[V.x, V.z, 2.2]], 1.3, O)) { H.done = 1; C.free(H); } }
    return !(this.vOut && (!S || this.sOut) && helpers.every(H => H.done || H.freed)) && t < 40; },
    end(abort) { C.free(V, { remove: dead || goneOf(C, V, e), now: abort }); if (S) C.free(S, { remove: goneOf(C, S, null), now: abort }); for (const H of helpers) C.free(H, { now: abort }); } };
}
// a run along the sidewalk (the lane by A, its direction nearest `dir`) for m metres: [[x, z], …]
// (never back past `from`, the one it runs from: a leg within 1.4 m of it → straight away from it instead)
function lanePath(C, A, dir, m, from = null) { const ln = C.psim.laneNear?.(A.x, A.z, 8), E = ln?.E; let gx = dir[0], gz = dir[1]; const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
  const straight = [[A.x + gx * m, A.z + gz * m]], segD = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t); };
  const path = lanePath0(C, A, gx, gz, m, ln, E); if (!from) return path; let a = [A.x, A.z]; for (const b of path) { if (segD(from, a, b) < 1.4) return straight; a = b; } return path; }
function lanePath0(C, A, gx, gz, m, ln, E) {
  if (!E?.from || !E?.to) return [[A.x + gx * m, A.z + gz * m]];
  const ex = E.to.x - E.from.x, ez = E.to.z - E.from.z, el = Math.hypot(ex, ez) || 1, sg = (ex * gx + ez * gz) >= 0 ? 1 : -1, p0 = C.psim.where({ E, s: ln.s }, [0, 0, 0, 0]), s1 = Math.max(.5, Math.min(E.len - .5, ln.s + sg * m)), p1 = C.psim.where({ E, s: s1 }, [0, 0, 0, 0]);
  return [[p0[0], p0[2]], [p1[0], p1[2]]]; }   // (a short lane: a short run)

export const VIGNETTES = {
  // ── a robbery the street saw (and, on TAPE, every robbery): the robber and the victim
  robSeen: {
    where: (C, e) => C.posOf(e.to) || C.posOf(e.who) || C.placePos(e.at),
    start(C, e, at) {
      PS = C.psim; const V = C.actor(e.to, { standIn: C.lens() === 'tape' && !C.posOf(e.to)?.drawn ? standNear(at, 0) : null }), R = C.actor(e.who, { standIn: C.lens() === 'tape' && !C.posOf(e.who)?.drawn ? standNear(at, 1) : null });
      if (!V && !R) return null; if (!V || !R) { const one = V || R; return one === V ? unseen(C, e, V) : (C.free(R), null); }
      if (e.shot) { const deadIsR = e.shot.dead === e.who, hurt = !e.shot.dead; return deadIsR ? shotScene(C, e, R, V, true) : shotScene(C, e, V, R, !hurt, { cash: e.ok !== false }); }   // (a death "shot during a robbery", merged: stage/index.js)
      // CLIPS (anim/cast/clips/robbery.js + falls.js). THE PAIR: the robber stops at the clip's gap in front of the victim and plays
      // rob_lunge_grab; the victim its partner 0.34 s later (pair.delay): hit_stumble_back, or — hurt (the sim sends them to hospital, or
      // the event says hurt) — shove_fall → a short lie_hurt (to its first 2 s wrap) → get_up. Then: the "?!" and hands_up_point after the
      // fleeing robber (or a pat of the pockets) and back to its spot; or, taken to hospital, the limp off (walk_hurt) out of view. The
      // robber runs off with run_getaway. A FAILED attempt: the robber lunges from a step further (the grab misses), the victim shoves
      // back (rob_lunge_grab, from the same gap), the robber goes down (shove_fall), gets up and runs. THE AXIS (pickAxis): the robber's
      // spot is turned round the victim so the one who falls lands on open ground and the robber's spot is clear.
      const ok = e.ok !== false, PAIR = CLIP.rob_lunge_grab.pair, GAP = PAIR.gap, HIT = PAIR.delay, D = ok ? GAP : GAP + CLIP.rob_lunge_grab.shift[1];
      const O = C.occ(V.x, V.z, 5), V0 = outdoors(O, V, true), [ux0, uz0] = dirTo(V0, R), pl = placeFor(C, O, V0, [ux0, uz0], { D, falls: [{ who: ok ? 'P' : 'Q', fp: BACK_FP, d: GAP }], skip: [V, R], side: 2 }), ax = pl.ax;
      let [ux, uz] = ax.u; const Q = { x: ax.q[0], z: ax.q[1] }, B = { wind: null };
      if (Math.hypot(pl.x - V.x, pl.z - V.z) > .05) { V.tx = pl.x; V.tz = pl.z; V.v = 1.2; }   // (a step to clearer ground first)
      { const vw = camView(C, V); if (unseenAt(C, vw, O, pl.x, pl.z, V.y) || unseenAt(C, vw, O, Q.x, Q.z, V.y)) followMarks(C, e, [{ x: pl.x, z: pl.z, y: V.y, h: V.h }, { x: Q.x, z: Q.z, y: V.y, h: R.h }]); }   // (the shot follows the marks: TAPE)
      // the robber's way in: once the victim has taken its mark (its step to clearer ground; 2.5 s at most) — it came in while the victim
      // was still stepping, past a post, and the two met off their marks (2026-10-09, Kent St & 1st)
      const approach = () => { B.in = 1; if (Math.hypot(R.x - Q.x, R.z - Q.z) <= .12) return; const back = (Q.x - R.x) * (R.x - V.x) + (Q.z - R.z) * (R.z - V.z) > 0 && Math.hypot(R.x - Q.x, R.z - Q.z) < 2;
        if (back) { R.tx = Q.x; R.tz = Q.z; R.v = 1.4; R.back = true; R.faceTo = [V.x, V.z]; } else goTo(R, around(R, { x: pl.x, z: pl.z, y: V.y }, [Q.x, Q.z], 1.5, O, false, C.camAim?.()), 3.2); };
      if (V.tx === null) approach();
      V.snap = false;
      // the getaway: along the sidewalk, away from the victim
      const flee = () => { R.faceTo = null; R.snap = false; R.back = false; R.seam = null;
        if (goneOf(C, R, null)) { leaveOnFoot(C, R, { clip: 'run_getaway', away: [V.x, V.z] }); this_.rOut = 1; C.free(R, { remove: true }); }
        else { R.clip = 'run_getaway'; goTo(R, lanePath(C, R, [R.x - V.x, R.z - V.z], 10, [V.x, V.z]), CLIP.run_getaway.speed); B.run = 1; } };
      const this_ = { actors: [V, R], step(t) {
        if (B.wind === null) { if (V.tx === null) V.faceTo = [R.x, R.z]; if (!B.in && (V.tx === null || t > 2.5)) approach();
          const there = (arrived(R) && !R.back) || (R.back && R.tx === null), far = Math.hypot(R.x - V.x, R.z - V.z) > D + .45;
          // NEVER FROM AFAR (2026-10-09): 6 s in, a robber still on its way comes straight in to the gap on its own side (the axis turned to
          // it) and lunges there. It lunged wherever it was: 10 m off, the victim knocked down by nobody
          if (!there && far && t > 6 && !B.late) { B.late = t; const [vx, vz] = dirTo(V, R); ax.u = [vx, vz]; ax.a = Math.atan2(vx, vz); [ux, uz] = ax.u; goTo(R, [[V.x + vx * D, V.z + vz * D]], 3.2); }
          if ((there || (t > 6 && !far) || t > 14) && (V.tx === null || t > 6)) { V.tx = null; B.wind = t; R.tx = null; R.path = null; R.back = false; R.faceTo = [V.x, V.z]; R.snap = true; R.clip = 'rob_lunge_grab'; } return true; }
        const w = t - B.wind, h = w - HIT;   // h: since the contact
        if (ok) {
          if (h >= 0 && !B.hit) { B.hit = 1; B.hurt = !!(goneOf(C, V, e) || e.hurt); V.faceTo = null; V.ry = ax.a; V.snap = true;
            V.clip = B.hurt && CLIP.shove_fall ? 'shove_fall' : 'hit_stumble_back'; if (B.hurt) { downNow(C, V, BACK_FP, [V, R]); if (CLIP.get_up) getUp(V, 1.9); } }
          if (h > .02 && !this.cash) { this.cash = 1; C.props.burst(V.x - ux * .2, 1.2, V.z - uz * .2, 18, -ux * .4, -uz * .4, 45); }
          if (w > 1.05 && !B.fled) { B.fled = 1; flee(); }   // the getaway
          if (B.run && !B.ran && arrived(R)) { B.ran = h; R.clip = null; }
          if (B.ran !== undefined && h > B.ran + .9 && !this_.rOut && backTo(C, R, [[V.x, V.z, 3]], 1.3, O)) { this_.rOut = 1; C.free(R); }
          if (B.hurt) {   // down, a short lie, up
            if (V.now === 'get_up' && B.upT === undefined) B.upT = h; if (B.upT === undefined && h > 6.5) { V.seam = null; B.upT = h; }
            if (B.upT !== undefined && !B.up && V.now !== 'get_up' && h > B.upT + .5) { B.up = h; V.snap = false;
              if (goneOf(C, V, e)) { leaveOnFoot(C, V, { clip: 'walk_hurt', away: [R.x, R.z] }); this_.vOut = 1; C.free(V, { remove: true }); }
              else if (!this_.rOut && C.seen(R) && Math.hypot(R.x - V.x, R.z - V.z) > 3) { B.beat = 'hands'; V.faceTo = [R.x, R.z]; V.clip = 'hands_up_point'; C.props.exclaim(V.w, 1.6); }
              else { B.beat = 'pat'; V.clip = 'pat_pockets'; } }
            if (B.up !== undefined && !this_.vOut) { const k = h - B.up;
              if (k > (B.beat === 'hands' ? 1.5 : 1.7)) { if (!B.beatOff) { B.beatOff = 1; V.clip = null; V.faceTo = null; } if (k > 1.9 && backTo(C, V, [[R.x, R.z, 1.3]], 1.3, O)) { this_.vOut = 1; C.free(V); } } } }
          else if (h > .85 && h < 2.6) { V.snap = false; V.faceTo = [R.x, R.z]; if (!B.up) { B.up = 1; V.clip = 'hands_up_point'; } if (!this.ex) { this.ex = 1; C.props.exclaim(V.w, 1.6); } }
          else if (h >= 2.6 && h < 4.2) { V.faceTo = null; if (!B.upOff) { B.upOff = 1; V.clip = null; } if (h > 2.95 && !B.pat) { B.pat = 1; V.clip = 'pat_pockets'; } }
          else if (h >= 4.2) { if (!B.patOff) { B.patOff = 1; V.clip = null; } V.faceTo = null; if (h > 4.5 && !this_.vOut && backTo(C, V, [[R.x, R.z, 1.3]], 1.3, O)) { this_.vOut = 1; C.free(V); } }
          return !(this_.vOut && this_.rOut) && h < 30; }
        // a failed attempt: the lunge (from a step further: the grab misses); the victim shoves back (the same clip, from the pair's gap now)
        // and the robber goes down (shove_fall, its partner's place and delay), lies a moment, gets up and runs
        if (w >= .92 && !B.lungeOff) { B.lungeOff = 1; R.clip = null; }
        if (w >= .9 && !B.shove) { B.shove = 1; V.faceTo = null; V.ry = ax.a; V.snap = true; V.clip = 'rob_lunge_grab'; if (!this.ex) { this.ex = 1; C.props.exclaim(V.w, 1.3); } }
        if (w >= .9 + HIT && !B.knock) { B.knock = 1; R.faceTo = null; R.ry = ax.a + Math.PI; R.snap = true; R.clip = CLIP.shove_fall ? 'shove_fall' : 'hit_stumble_back'; downNow(C, R, BACK_FP, [V, R]); if (CLIP.get_up) getUp(R, 1.9); }
        if (w >= 2.2 && !B.vOff) { B.vOff = 1; V.clip = null; V.snap = false; }
        if (B.knock && !B.fled) { if (R.now === 'get_up' && B.upT === undefined) B.upT = w; if (B.upT === undefined && w > 7.5) { R.seam = null; B.upT = w; }
          if (B.upT !== undefined && R.now !== 'get_up' && w > B.upT + .5) { B.fled = 1; flee(); } }
        if (B.run && !B.ran && arrived(R)) { B.ran = w; R.clip = null; }
        if (B.ran !== undefined && w > B.ran + .9 && !this_.rOut && backTo(C, R, [[V.x, V.z, 3]], 1.3, O)) { this_.rOut = 1; C.free(R); }
        if (w >= 2.2 && !this_.vOut) { if (goneOf(C, V, e)) { if (!B.vLeave) { B.vLeave = 1; leaveOnFoot(C, V, { clip: 'walk_hurt', away: [R.x, R.z] }); this_.vOut = 1; C.free(V, { remove: true }); } }
          else if (B.fled) { V.faceTo = null; if (backTo(C, V, [[R.x, R.z, 1.3]], 1.3, O)) { this_.vOut = 1; C.free(V); } } else V.faceTo = [R.x, R.z]; }
        else if (w < .9) V.faceTo = [R.x, R.z];
        return !(this_.vOut && this_.rOut) && w < 30; },
        end(abort) { C.free(V, { remove: goneOf(C, V, e), now: abort }); C.free(R, { remove: goneOf(C, R, null), now: abort }); } };
      return this_;
    } },
  // ── LIVE: a robbery nobody saw. Only the victim: knocked, then patting the pockets, "?!"
  robUnseen: {
    where: (C, e) => C.posOf(e.to) || C.placePos(e.at),
    start(C, e) { const V = C.actor(e.to); if (V && e.shot && e.shot.dead === e.to) return shotScene(C, e, V, null, true, { cash: e.ok !== false }); return V ? unseen(C, e, V) : null; } },
  // ── an arrest: the cruiser pulls up; the cop cuffs them (a run and a scuffle first, when they resist); into the car; it drives off
  // (STAGE-B: arrestScene below)
  arrest: {
    where: (C, e) => C.posOf(e.to),
    start: (C, e) => arrestScene(C, e) },
  // ── a burglary: at the house, a flashlight in a window; the alarm lamp if it has one; then the tape. TAPE: the burglar slips out
  burglary: {
    where: (C, e) => { const h = C.layer?.homeAt?.(e.at); return h?.door ? { x: h.door[0], z: h.door[2], home: h } : null; },
    start(C, e, at) {
      const h = at.home, win = h.windows[0], alarm = !!(e.alarm || C.layer?.model?.homes?.get(e.at)?.sec?.has('alarm')) && h.alarm, ok = e.ok !== false;
      if (!win && !alarm) return null; C.layer.holdScar?.(e.at, 5200);
      const F = C.props.flick, L = C.props.lamp, G = C.props.lampGlow; if (win) { C.props.windowAt(F, win, h.rot); F.visible = false; }
      if (alarm) { L.position.set(...h.alarm); G.position.set(h.alarm[0] + h.face[0] * .05, h.alarm[1], h.alarm[2] + h.face[1] * .05); G.rotation.set(0, Math.atan2(h.face[0], h.face[1]), 0); }
      let B = null; const out = { x: h.door[0] + h.face[0] * 4.5, z: h.door[2] + h.face[1] * 4.5 };
      return { actors: [], step(t) {
        // the flashlight: a beam that comes and goes, brightest in the middle
        if (win) { const on = t > .4 && t < (ok ? 3.4 : 1.6) && (Math.sin(t * 13) + Math.sin(t * 7.3) > -.3); F.visible = on; F.material.opacity = .55 + .4 * Math.abs(Math.sin(t * 5)); F.material.color.setHex(C.night ? 0xfff1c4 : 0xfffbe8); }
        if (alarm) { const al = t > (ok ? 1.2 : .9), b = al && Math.floor(t * 5) % 2 === 0; L.visible = al; L.material.color.setHex(b ? 0xff2a2a : 0x401010); G.visible = b; G.material.opacity = C.night ? .5 : .2; }
        if (C.lens() === 'tape' && e.who && ok && t > 2.8 && !B) { B = C.actor(e.who, { standIn: { x: h.door[0] + h.face[0] * .5, z: h.door[2] + h.face[1] * .5, ry: Math.atan2(h.face[0], h.face[1]) } }); if (B) { this.actors.push(B); B.tx = out.x; B.tz = out.z; B.v = 3.6; } }
        if (B && B.tx === null && !this.bOut) { this.bOut = 1; leaveOnFoot(C, B, { clip: 'run_getaway', away: [h.door[0], h.door[2]] }); C.free(B, { remove: true }); }   // (on out of view, then gone)
        return t < 4.6 || (B && !this.bOut && t < 8); },
        end(abort) { F.visible = false; L.visible = false; G.visible = false; if (B) C.free(B, { remove: true, now: abort }); C.layer.holdScar?.(e.at, 0); } };
    } },
  // ── a deal on a corner: a brush pass with someone walking by. W8 (2026-10-08): the authored pair, brush_pass (deal-hang.js: a low dap,
  // 0.6 s, a pair with itself at gap 1.02 m): the buyer, a walker going by, stops and turns to the dealer; the dealer closes to the gap;
  // both start the clip on the same frame (in sync), the baggie and the bill cross at the palms; the buyer walks on, the dealer goes back.
  // Without the clip: the old hand-off (the phone arm held out).
  deal: {
    where: (C, e) => { const p = C.posOf(e.who); return p?.drawn ? p : null; },
    start(C, e) {
      const a = C.agents.map.get(e.who); if (!a || a.mode !== 'stand' || !a.spot) return null; const D = C.actor(e.who); if (!D) return null;
      const lane = a.spot.lane, lp = lane ? C.psim.where({ E: lane.E, s: lane.s }, [0, 0, 0, 0]) : null, [ux, uz, dd] = lp ? dirTo(D, { x: lp[0], z: lp[2] }) : [Math.sin(D.ry), Math.cos(D.ry), 1];
      const reach = { x: D.x + ux * Math.min(.55, dd * .5), z: D.z + uz * Math.min(.55, dd * .5) }, bag = C.props.bag, note = C.props.note, PAIR = CLIP.brush_pass?.pair; let buyer = null, tPass = null, tClip = null, bw = null;
      D.tx = reach.x; D.tz = reach.z; D.v = 1.1;
      const letGo = () => { if (!bw) return; const w = bw; bw = null; w.stagePose = null; w.bpDone = 0; if (w.g?.clip) clearClip(w.g); w.fix = null; w.halt = false; };
      return { actors: [D], step(t) {
        if (tPass === null && t > .4 && t < 3.4) { let best = null, bd = 2.3; for (const w of C.psim.walkers) { if (w.agent || w.vc < .2 || w.gone || w.stagePose || w.fix) continue; const d = Math.hypot(w.p[0] - reach.x, w.p[2] - reach.z); if (d < bd) { bd = d; best = w; } }
          if (best && bd < 1.9) { buyer = best; tPass = t;
            if (PAIR) { bw = buyer; const ry = Math.atan2(D.x - buyer.p[0], D.z - buyer.p[2]); buyer.halt = true; buyer.vc = 0; buyer.fix = [buyer.p[0], buyer.p[1], buyer.p[2], ry];   // (the buyer stops where it is, on its lane, and turns to the dealer)
              const [vx, vz, vd] = dirTo({ x: buyer.p[0], z: buyer.p[2] }, D); D.tx = buyer.p[0] + vx * PAIR.gap; D.tz = buyer.p[2] + vz * PAIR.gap; D.v = 1.3; D.faceTo = [buyer.p[0], buyer.p[2]];
              buyer.stagePose = (g, dt) => { if (tClip !== null && !g.clip && !buyer.bpDone) { buyer.bpDone = 1; playClip(g, 'brush_pass', { t: 0 }); } if (g.clip) { if (!g.clip.out) g.w = 0; stepClip(g, dt); } }; } } }
        if (tPass !== null && PAIR) { const s = t - tPass;
          if (tClip === null) { D.faceTo = [buyer.p[0], buyer.p[2]]; if ((D.tx === null && Math.abs(Math.atan2(Math.sin(D.ry - Math.atan2(buyer.p[0] - D.x, buyer.p[2] - D.z)), Math.cos(D.ry - Math.atan2(buyer.p[0] - D.x, buyer.p[2] - D.z)))) < .2) || s > 1.4) { tClip = t; D.tx = null; D.snap = true; D.ry = Math.atan2(buyer.p[0] - D.x, buyer.p[2] - D.z); D.clip = 'brush_pass'; } }   // (both on the same frame: in sync)
          if (tClip !== null) { const c = t - tClip, k = ease(ramp(c, .14, .36)), hb = [D.x + Math.sin(D.ry) * .4, .2 + .78, D.z + Math.cos(D.ry) * .4], hw = [buyer.p[0] - Math.sin(D.ry) * .4, .2 + .78, buyer.p[2] - Math.cos(D.ry) * .4];
            bag.visible = note.visible = c > .1 && c < .5; bag.position.set(hb[0] + (hw[0] - hb[0]) * k, hb[1], hb[2] + (hw[2] - hb[2]) * k); note.position.set(hw[0] + (hb[0] - hw[0]) * k, hw[1] + .02, hw[2] + (hb[2] - hw[2]) * k); bag.rotation.y = note.rotation.y = D.ry;
            if (c > CLIP.brush_pass.dur + .25) letGo();
            if (c > CLIP.brush_pass.dur + .45) { D.clip = D.clip === 'brush_pass' ? null : D.clip; D.faceTo = null; D.snap = false; if (goHome(D, 1.1)) return false; } }
          return t < 8; }
        if (tPass !== null) { const s = t - tPass, hb = [D.x + Math.sin(D.ry) * .32, 1.0, D.z + Math.cos(D.ry) * .32], hw = [buyer.p[0], .95, buyer.p[2]];
          D.faceTo = s < .9 ? [buyer.p[0], buyer.p[2]] : null; D.pose = s < .7 ? { ...SHOVE, iw: .85 } : null;
          if (s < 1.6) { const k = ease(ramp(s, .15, .5)); bag.visible = note.visible = true;
            bag.position.set(hb[0] + (hw[0] - hb[0]) * k, hb[1] + Math.sin(Math.PI * k) * .08, hb[2] + (hw[2] - hb[2]) * k); note.position.set(hw[0] + (hb[0] - hw[0]) * k, hw[1] + Math.sin(Math.PI * k) * .06, hw[2] + (hb[2] - hw[2]) * k);
            bag.rotation.y = note.rotation.y = D.ry; if (s > .9) { note.visible = false; } if (s > 1.4) bag.visible = false; }
          else { bag.visible = note.visible = false; } }
        else if (t > 3.4) D.pose = { idle: 1, iw: 1, w: 0 };   // (nobody came by: a look round)
        const back = tPass !== null ? t - tPass > 1.1 : t > 4.2; if (back) { D.pose = null; D.faceTo = null; if (goHome(D, 1.1)) return false; } return t < 7; },
        end() { bag.visible = note.visible = false; letGo(); C.free(D); } };
    } },
  // ── a death: the fall (turned so it lands on open ground), the chalk outline, the memorial; the body lies until the camera can't see it
  death: {
    where: (C, e) => C.posOf(e.who) || C.placePos(e.at),
    start(C, e, at) { const A = C.actor(e.who); if (!A) return null; const s = -1, clip = !!CLIP.death_collapse, ax = clip ? pickAxis(C, C.occ(A.x, A.z, 4), A, [Math.sin(A.ry), Math.cos(A.ry)], { falls: [{ who: 'P', fp: SIDE_FP }], skip: [A] }) : null;
      return { actors: [A], step(t, dt) {   // (death_collapse → lie_still; without the clip, the old plank tilt)
        if (t < .5) { A.roll = .2 * Math.sin(t * 22) * (1 - t / .5); A.pitch = -.08 * Math.sin(t * 15); if (ax) A.ry += Math.atan2(Math.sin(ax.a - A.ry), Math.cos(ax.a - A.ry)) * Math.min(1, dt * 9); }
        else if (clip) { if (!this.down) { this.down = 1; A.roll = A.pitch = 0; A.ry = ax.a; A.snap = true; goDown(A, true); downNow(C, A, SIDE_FP, [A]); cowerNear(C, A.x, A.z, { n: 2 }); } }
        else if (t < 1.1) { A.roll = 0; fall(A, ramp(t, .5, 1.1), s); }
        if (t > (clip ? 2.4 : 1.6) && !this.mark) { this.mark = 1; const m = { x: A.x, z: A.z, ry: A.ry + Math.PI }; C.props.chalk(m.x, m.z, m.ry, { key: C.lens() }); if (C.lens() === 'live') C.liveMarks.push(m); }
        return t < 4.3; },   // (then free → it lies there till the camera can't see it: stage/index.js)
        end(abort) { C.free(A, { remove: true, now: abort }); } };
    } },
};
// ── A SHOT (2026-10-08): a death "shot during a robbery" (or "shot at P": the lens took the killer's name) that isn't part of a staged
// robbery, or a hand-played { type: 'shot', who (hit), to (shooter), dead }. The shooter is staged only when the event names them
// (LIVE: the lens has already taken an unseen robber's name off) and they are drawn within 20 m.
VIGNETTES.shot = {
  where: (C, e) => C.posOf(e.who) || C.placePos(e.at),
  start(C, e) { const V = C.actor(e.who); if (!V) return null; const p = e.to ? C.posOf(e.to) : null;
    const S = p?.drawn && Math.hypot(p.x - V.x, p.z - V.z) < 20 ? C.actor(e.to) : null; return shotScene(C, e, V, S, e.type === 'death' || !!e.dead); } };
// a robbery victim alone (LIVE: the robber unseen): knocked (hit_stumble_back from nowhere), patting the pockets, "?!", a look round, back.
// Hurt: knocked down (shove_fall, turned so it falls onto open ground), a short lie, up (get_up), then the pockets and back — or, the sim
// taking them to hospital, the limp off (walk_hurt) out of view
function unseen(C, e, V) {
  const O = C.occ(V.x, V.z, 5.5), hurt = !!(goneOf(C, V, e) || e.hurt) && !!CLIP.shove_fall, pl = placeFor(C, O, outdoors(O, V, true), [Math.sin(V.ry), Math.cos(V.ry)], { falls: hurt ? [{ who: 'P', fp: BACK_FP }] : [], skip: [V] }), ax = pl.ax;
  if (Math.hypot(pl.x - V.x, pl.z - V.z) > .05) { V.tx = pl.x; V.tz = pl.z; V.v = 1.2; }   // (staggered a step or two first: to clear ground, clear of anyone standing there — 2026-10-09: not only when it falls)
  const ux = Math.sin(V.ry), uz = Math.cos(V.ry), B = {};
  return { actors: [V], step(t) {
    if (V.tx !== null && t < 4) return true; V.tx = null;
    if (!this.hit) { this.hit = 1; if (hurt) { V.ry = ax.a; V.snap = true; V.clip = 'shove_fall'; downNow(C, V, BACK_FP, [V]); getUp(V, 1.9); } else V.clip = 'hit_stumble_back'; }
    if (t > .1 && !this.cash && e.ok !== false) { this.cash = 1; C.props.burst(V.x, 1.1, V.z, 4, -ux, -uz, 40); }
    let t1 = t;   // (the pockets' clock: from the stumble, or from getting up)
    if (hurt) { if (V.now === 'get_up' && B.upT === undefined) B.upT = t; if (B.upT === undefined && t > 6) { V.seam = null; B.upT = t; }
      if (B.upT === undefined || V.now === 'get_up' || t < B.upT + .5) return t < 30; if (B.up === undefined) { B.up = t; V.snap = false;
        if (goneOf(C, V, e)) { leaveOnFoot(C, V, { clip: 'walk_hurt' }); this.out = 1; C.free(V, { remove: true }); } }
      if (this.out) return false; t1 = t - B.up + .85; }
    if (t1 > .85 && t1 < 3.4) { if (!this.pat) { this.pat = 1; V.clip = 'pat_pockets'; } if (!this.ex && t1 > .9) { this.ex = 1; C.props.exclaim(V.w, 2.1); } }
    else if (t1 >= 3.4 && t1 < 4.7) { if (!this.patOff) { this.patOff = 1; V.clip = null; } V.pose = { idle: 1, iw: 1, w: 0, it: (t1 - 3.4) * 2.4 + 1 }; }
    else if (t1 >= 4.7) { V.pose = null; if (backTo(C, V, [], 1.1, O)) { this.out = 1; return false; } }
    return t < 30; },
    end(abort) { C.free(V, { remove: goneOf(C, V, e), now: abort }); } };
}
// a stand-in's spot near a place (TAPE: an agent the live map has indoors)
// (snapped to the nearest sidewalk: a corner's own point is the middle of its crossing)
let PS = null; function standNear(at, k) { if (!at) return null; const L = PS?.laneNear?.(at.x, at.z, 30);
  if (L) { const E = L.E, s = Math.max(.5, Math.min(E.len - .5, L.s + (k ? 1.7 : 0))), p = PS.where({ E, s }, [0, 0, 0, 0]), q = PS.where({ E, s: k ? s - 1.7 : Math.min(E.len - .5, s + 1.7) }, [0, 0, 0, 0]);
    return { x: p[0], z: p[2], ry: Math.atan2(q[0] - p[0], q[2] - p[2]) }; }
  return { x: at.x + (k ? 1.6 : 0), z: at.z + (k ? .9 : 0), ry: k ? -2.1 : 1 }; }
// ═══ STAGE-B (2026-10-08): THE ARREST ON THE CLIPS (anim/cast/clips/arrest.js; its header's THE CITY is the contract). The cruiser
// pulls up at the kerb (lights going), its side 0.14 m off the kerb (found in a top-down height map: occ). The cop — the arresting
// agent's own walker when it is drawn within 40 m, else a stand-in in a cop's look getting out of the cruiser's front kerb-side door
// (no car: walking in from out of view) — walks up and comes round BEHIND the suspect, who turns its back (cuff_apply's pair is
// back-to-front: the suspect 1.22 m ahead of the cop, facing the same way; the axis turned so the cop's spot is clear standing ground):
// cuff_apply, the suspect's cuffed_idle 0.45 s after it; the CLICK at 1.31 s. From the click the suspect is CUFFED, a state: cuffed_idle
// standing, cuffed_walk moving (0.7 m/s), get_in_car at the car — switched with playClip straight (A.clip), never a stopClip between.
// The walk to the cruiser's rear kerb-side door (the cop behind, then round to the guide spot); the door swings open (props.js: the
// model has no door that opens, so the stage draws one); get_in_car + guide_in_car on one frame (the suspect 0.45 m off the door,
// facing the car's tail so the door is on its −x; the cop 1.2 m before it, facing it); on get_in_car's end frame its shift
// [−0.45, 0.25] (stage/index.js applyPose); the cop swings the door shut at 1.6–2.05 s of guide_in_car; at the shut the suspect is in
// the car (hidden, A.inCar: never seen again) and is handed back removed. The cop walks back to its spot (a stand-in gets back in by
// the front door), and the cruiser drives off, lights going, until the camera can't see it.
// RESISTING (arrestMode): the sim's arrest event carries no flight or resistance; its one signal is a WANTED pickup (patrol: true, the
// text's "(WANTED)": a patrol car took someone the city had flagged) — they always run. Any other arrest resists 1 time in 3, seeded by
// the event (to, t, who), half of those running first. RUN: flee_run (3.3 m/s) along the sidewalk away from the cop, the cop after it
// with run_getaway (2.9 m/s); caught where the run ends, face to face 1.2 m: scuffle_pair (the cop) + scuffle_partner on one frame, for
// one or two 2.8 s rounds (seeded), parted 0.6 s into a round (stopped on one frame); the suspect is turned round, the cuffing as above.
// SCUFFLE: the same, where they stand. NO KERB (no lane by them, or no pavement at its side): no cruiser; the cop walks the cuffed
// suspect out of the camera's view along the sidewalks, and both go once it can't see them. Bystander agents standing on the cop's
// spots, the door's or the walk to it step aside first and go back once the cruiser has left.
const WAYLEN = 10;   // m of an arrest's way ahead of its people that the crowd keeps clear (arrestScene way(), stage/crowd.js)
const hash01 = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
// what an arrest plays: 'flee' | 'scuffle' | 'plain' (a hand-played event may force one: e.stage.resist)
export function arrestMode(e) { const f = e?.stage?.resist; if (f === 'flee' || f === 'scuffle' || f === 'plain') return f;
  if (e.patrol || /\(WANTED\)/.test(e.text || '')) return 'flee';
  const u = hash01(`${e.to}|${e.t ?? 0}|${e.who ?? 'P9'}`); return u < 1 / 6 ? 'flee' : u < 1 / 3 ? 'scuffle' : 'plain'; }
// the cruiser's frame at its stop: pt(lx, lz) → world [x, z] (lx < 0: the kerb side), local(x, z) → [lx, lz]
function carFrame(s) { const { ux, uz } = s; return { x: s.x, z: s.z, ux, uz, nx: s.nx, nz: s.nz, pt: (lx, lz) => [s.x + lx * uz + lz * ux, s.z - lx * ux + lz * uz], local: (x, z) => { const dx = x - s.x, dz = z - s.z; return [dx * uz - dz * ux, dx * ux + dz * uz]; } }; }
// the kerb by a stop (the pavement's edge across the lane, from a height map there): the cruiser pulled in to 0.14 m off it → the stop
// with .kerb (m from the lane's line) and its lateral offset, or the stop without (no pavement found: no door to walk to)
// A PARKED CAR (or anything over 0.35 m) where the cruiser would stand: the stop moves along the lane (±12 m, a coarse height map) to
// the nearest clear length of kerb, the kerb then found on a fine one there; none clear → the stop without .kerb (no door: they walk)
function kerbStop(C, stop) { if (!stop) return null; const { L, nx, nz, ux, uz } = stop;
  const kerbAt = (O, x0, z0) => { const pave = f => { const h = O.at(x0 + nx * f, z0 + nz * f); return h !== null && Math.abs(h - C.SIDE) < .07; }; for (let f = .6; f < 5.6; f += .05) if (pave(f) && pave(f + .25) && pave(f + .5)) return f; return null; };
  const O1 = C.occ(stop.x0 + nx * 2.4, stop.z0 + nz * 2.4, 15); if (!O1) return stop;
  for (const ds of [0, 1.2, -1.2, 2.4, -2.4, 3.6, -3.6, 4.8, -4.8, 6, -6, 7.2, -7.2, 8.4, -8.4, 9.6, -9.6, 10.8, -10.8, 12, -12]) { const sc = stop.s + ds; if (sc < 3 || sc > L.len - 2.5) continue; const x0 = L.x0 + ux * sc, z0 = L.z0 + uz * sc;
    const k1 = kerbAt(O1, x0, z0); if (k1 === null) continue; const lat = Math.max(0, k1 - CRUISER.hw - .14); let clear = true;
    for (let lz = -CRUISER.half - .4; lz <= CRUISER.half + .4 && clear; lz += .25) for (let lx = -CRUISER.hw - .15; lx <= CRUISER.hw + .15; lx += .25) { const h = O1.at(x0 + nx * lat + ux * lz - nx * lx, z0 + nz * lat + uz * lz - nz * lx); if (h !== null && h > .35) { clear = false; break; } }
    if (!clear) continue; const O2 = C.occ(x0 + nx * 2.4, z0 + nz * 2.4, 3.8), kerb = (O2 && kerbAt(O2, x0, z0)) ?? k1, lat2 = Math.max(0, kerb - CRUISER.hw - .14);
    return { ...stop, x0, z0, s: sc, lat: lat2, x: x0 + nx * lat2, z: z0 + nz * lat2, kerb, moved: ds }; }
  return { ...stop, parked: true }; }
// a way from a to b clear of anything over the knees (the height map, y: the ground): [b], or [side point, b] (the side point off the
// segment's middle, 0.8–3.2 m either side), or null. Each leg is checked from 0.35 m out: where it stands is not in its way
function detour(O, a, b, y) { const clear = (p, q) => { if (!O) return true; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let f = Math.min(1, .35 / (L || 1)); f <= 1; f += Math.min(.5, .15 / (L || 1))) { const h = O.at(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f); if (h !== null && (h > y + .35 || h < y - .3)) return false; } return true; };
  if (clear(a, b)) return [b]; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, px = -(b[1] - a[1]) / L, pz = (b[0] - a[0]) / L;
  for (const o of [.8, -.8, 1.6, -1.6, 2.4, -2.4, 3.2, -3.2]) { const m = [mx + px * o, mz + pz * o]; if (clear(a, m) && clear(m, b)) return [m, b]; } return null; }
// the yaw error of a held walker against its actor's (what the gait has turned it to)
const yawErr = A => { const y = A.w.yawS ?? A.w.p[3]; return Math.abs(Math.atan2(Math.sin(y - A.ry), Math.cos(y - A.ry))); };
const segDist = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t); };
// bystander agents standing where the scene needs the ground (within r of a point or a segment): borrowed, stepped 1.6–2.8 m aside onto
// standing ground nobody is on; → the helpers (each H.aside = its point)
function clearWay(C, O, pts, segs, skip, r = 1.3) {
  const near = (x, z, m) => pts.some(p => Math.hypot(p[0] - x, p[1] - z) < m) || segs.some(([a, b]) => segDist([x, z], a, b) < m - .2), out = [], taken = [];
  for (const a of C.agents.map.values()) { if (!a.w || C.busy(a.id) || skip.includes(a.id)) continue; const x = a.w.p[0], z = a.w.p[2]; if (!near(x, z, r)) continue;
    let best = null; for (const rr of [1.6, 2.2, 2.8]) { for (let k = 0; k < 8 && !best; k++) { const g = k * Math.PI / 4, px = x + Math.sin(g) * rr, pz = z + Math.cos(g) * rr, h = O ? O.at(px, pz) : null;
      if (h === null || Math.abs(h - a.w.p[1]) > .12 || near(px, pz, r + .3) || C.walkersNear(px, pz, 1.2).some(([, , w]) => w !== a.w) || taken.some(p => Math.hypot(p[0] - px, p[1] - pz) < 1.4)) continue; best = [px, pz]; } if (best) break; }
    if (!best) continue; const H = C.actor(a.id); if (!H) continue; taken.push(best); H.aside = best; goTo(H, [best], 1.6); out.push(H); }
  return out; }

function arrestScene(C, e) {
  const A = C.actor(e.to); if (!A) return null;
  const mode = arrestMode(e), rounds = hash01(`${e.to}|${e.t ?? 0}|rounds`) < .5 ? 1 : 2, P = C.probe, rec = { to: e.to, mode, car: false, cop: null, end: null };
  const GAP = CLIP.cuff_apply.pair.gap, IN = CLIP.get_in_car.pair.gap, HW = CRUISER.hw, [rz0, rz1] = CRUISER.doors.rear;
  // the cop: the arresting agent's walker when drawn within 40 m, else a stand-in out of the cruiser (it needs the front door too)
  const pc = e.who ? C.posOf(e.who) : null, kAgent = !!(pc?.drawn && Math.hypot(pc.x - A.x, pc.z - A.z) < 40), look = C.copLook(e.who);
  // THE STOP (stage/cruiser.js planStop, 2026-10-09): at a free kerb, else double-parked in the travel lane where its rear door opens, the
  // nearest by the walk; none (no lane in reach, every door blocked, a bus's way): no cruiser — they walk off
  if (P?.on) rec.was = wasStop(C, A);   // (the probe's before: what the pre-cruiser kerb search chose here)
  const O = C.occ(A.x, A.z, 7); outdoors(O, A, true);   // (2026-10-09: a suspect the tape has inside a building is arrested outside it, INDOORS above)
  const pl = planStop(C, A, { IN, standIn: !kAgent, skip: [A, { w: e.who ? C.agents.map.get(e.who)?.w : null }].filter(o => o.w) }), stop = pl.plan, cf = stop ? carFrame(stop) : null;
  rec.roadD = pl.roadD; rec.planMs = pl.ms; if (P?.on && !stop) rec.why = pl.why;
  const { dz, DS, GS, FX, ryIn } = cf ? doorSpots(cf, IN) : {};   // (FX[0] deep enough that the big head is inside the hull)
  // the shot follows the marks (followMarks, TAPE): the suspect where it stands (alone: the scene's line and side stay the first shot's)
  { const vw = camView(C, A); if (unseenAt(C, vw, O, A.x, A.z, A.y)) followMarks(C, e, [{ x: A.x, z: A.z, y: A.y, h: A.h }]); }
  // the height map with the cruiser in it (around(): the cop's way round never goes through the car)
  const O2 = !O ? null : { at(x, z) { if (cf) { const [lx, lz] = cf.local(x, z); if (Math.abs(lx) < HW + .15 && Math.abs(lz) < CRUISER.half + .2) return 2; } return O.at(x, z); } };
  let door = !!stop; rec.stop = stop ? stop.kind : pl.why === 'no-lane' || pl.why === 'no-traffic' ? 'no-lane' : 'none'; if (stop) { rec.walk = +stop.walkLen.toFixed(1); rec.lat = +stop.lat.toFixed(2); rec.street = stop.ave ? 'avenue' : 'one-way'; }
  let car = null; if (door) C.props.car().then(c => { car = c; });
  // the drive: a car of the traffic (traffic/sim.js STAGE CARS); no way in (no traffic, every lane before it in view): the old free drive
  const drv = door ? driveCar(C, stop) : null; rec.drive = door ? (drv ? 'traffic' : 'free') : null; const TS = C.traffic(), thru = new Set();
  let K = kAgent ? C.actor(e.who) : null;
  // (2026-10-09, Kent St & 1st: the cop agent was mid-step up to its own spot, which can't be borrowed — simstate/agents.js hold — and a
  // stand-in played the cop while the real one walked on by, 11 m off. Now the scene starts, the cruiser comes, and the cop agent is
  // taken the moment its step ends — 10 s at most, then the stand-in as before)
  const kWait = kAgent && !K && !!C.agents.map.get(e.who)?.step;
  rec.cop = K ? 'agent' : door ? 'car' : 'walks-in'; rec.car = door;
  const st = { ph: 'arrive', c: null, carGone: !door, aOut: false, kOut: false }, actors = [A], helpers = [];
  if (K) actors.push(K);
  // a stand-in cop with no car: from the far end of a way out of view, walking in
  // (from the first point of a way out of view that the camera can't see: no longer a walk than it needs)
  const walkIn = () => { const tmp = { x: A.x, z: A.z }; leaveOnFoot(C, tmp); const pts = tmp.path || []; let k = pts.findIndex(p => !C.inView(p[0], p[1])); if (k < 0) k = pts.length - 1; const s0 = pts[k];
    if (s0) { K = C.actor(`P9:${e.to}:${Math.round(C.clock * 10)}`, { standIn: { x: s0[0], z: s0[1], ry: 0, look } }); if (K) { actors.push(K); goTo(K, [...pts.slice(0, k).reverse(), [A.x, A.z]], 1.5); K.walkIn = true; } } };
  if (!K && !door && !kWait) walkIn();   // (and when the cop agent it waited for never came free: step() below)
  // bystanders off the ground the scene needs: the door's spots and the walk there, the front door's way out
  if (door) { const w = [[A.x, A.z], ...stop.walk], segs = w.slice(1).map((p, k) => [w[k], p]); helpers.push(...clearWay(C, O2 || O, [DS, GS, FX[1]], segs, [e.to, e.who].filter(Boolean))); }
  actors.push(...helpers);
  if (P?.on) P.arrests.push(rec);
  // where the cop cuffs: behind the suspect, the axis turned from where the cop comes (clear standing ground, nobody within 1.25 m)
  const cuffSpot = from => { const ax = pickAxis(C, O, A, [from[0] - A.x, from[1] - A.z], { D: GAP, skip: [A, K].filter(Boolean) }); return { u: ax.u, q: ax.q, ry: Math.atan2(-ax.u[0], -ax.u[1]) }; };
  const faceSpot = from => { const ax = pickAxis(C, O, A, [from[0] - A.x, from[1] - A.z], { D: CLIP.scuffle_pair.pair.gap, skip: [A, K].filter(Boolean) }); return { u: ax.u, q: ax.q }; };
  const exclaim = (d = 1.3) => { if (!st.ex) { st.ex = 1; C.props.exclaim(A.w, d); } };
  // the cuffed state: the walk while moving, the idle standing (switched straight: the same arm pose in both)
  const cuffedClip = () => { if (st.cuffed && (A.clip === 'cuffed_idle' || A.clip === 'cuffed_walk' || A.clip === undefined || A.clip === null)) A.clip = A.moving > .05 || A.tx !== null || A.path?.length ? 'cuffed_walk' : 'cuffed_idle'; };
  function startCuff(t) { st.ph = 'cuff'; st.tc = t; A.tx = K.tx = null; A.path = K.path = null; A.faceTo = K.faceTo = null; A.snap = K.snap = true; K.ry = A.ry; K.clip = 'cuff_apply'; }
  function car_(t, dt) {   // the cruiser: in from out of view at speed, braking to the kerb; waits; away, until the camera can't see it
    if (drv) return carT(t, dt); if (!car || !door) return; const R = car.root;
    if (!st.c) { let s0 = 60; for (const d of [22, 30, 40, 50, 60]) { const p = [stop.x0 - stop.ux * d, stop.z0 - stop.uz * d]; if (!C.inView(p[0], p[1]) && !C.inView(p[0] + stop.ux * 2.2, p[1] + stop.uz * 2.2)) { s0 = d; break; } }
      st.c = { s: -s0, v: 15, ph: 0 }; R.visible = true; car.flash = true; car.ft = 0; car.door('rear', 0); car.door('front', 0); }
    const c = st.c; if (c.ph < 2) { const left = -c.s; c.v = Math.min(15, Math.sqrt(Math.max(0, 2 * 6.5 * left))); if (left < .05) { c.v = 0; c.s = 0; c.ph = 1; if (st.stopT === undefined) st.stopT = t; } }
    else c.v = Math.min(14, c.v + 6 * dt);
    const ds = c.v * dt; c.s += ds; car.roll(ds); const lat = Math.min(1, ease((c.s + 6) / 6)) * stop.lat * (c.ph >= 2 ? Math.max(0, 1 - c.s / 10) : 1);
    R.position.set(stop.x0 + stop.ux * c.s + stop.nx * lat, 0, stop.z0 + stop.uz * c.s + stop.nz * lat); R.rotation.y = Math.atan2(stop.ux, stop.uz);
    if (c.ph >= 2 && c.s > 8) { const x = R.position.x, z = R.position.z, vis = [-2.2, 0, 2.2].some(o => C.inView(x + stop.ux * o, z + stop.uz * o)); if (!vis || c.s > 160) { R.visible = false; car.flash = false; st.carGone = true; if (vis) rec.carHidInView = 1; } } }
  // THE DRIVE IN THE TRAFFIC: the model where the sim car is (eased to the kerb at a kerb stop); stopped: out of the lane at a free kerb
  // (drv.park); away (st.c.ph 2): back into the lane when nothing comes, on until the camera can't see it. The probe: every traffic car
  // whose body overlaps the cruiser's while it is drawn, and the queue behind it (how long it takes to move off once it has gone)
  function carT(t, dt) { const c = drv.c; if (!st.c) st.c = { ph: 0 }; const p = drv.step();
    if (st.c.ph < 2 && drv.stopped()) { if (st.c.ph === 0) { st.c.ph = 1; if (st.stopT === undefined) { st.stopT = t; rec.tStop = +t.toFixed(1); } } drv.park(); }
    if (st.c.ph === 2 && !st.c.went && P?.on && st.c.waitOut > 8 && !rec.blockedBy) rec.blockedBy = stop.L.cars.filter(q => Math.abs(q.s - c.s) < 30).slice(0, 4).map(q => [+(q.s - c.s).toFixed(1), +q.v.toFixed(1), q.kind, q.hold || null]);
    if (st.c.ph === 2 && !st.c.went) { st.c.waitOut = (st.c.waitOut || 0) + dt; if (drv.go(st.c.waitOut)) { st.c.went = t; st.c.q = queue(); rec.queue = st.c.q.length; rec.tGo = +t.toFixed(1); rec.waitOut = +st.c.waitOut.toFixed(1); } }
    if (car && !st.carGone) { const R = car.root; if (!R.visible) { R.visible = true; car.flash = true; car.ft = 0; car.door('rear', 0); car.door('front', 0); }
      R.position.set(p.x, 0, p.z); R.rotation.y = p.h; car.roll(p.ds || 0);
      if (P?.on) { const h = carsThrough(TS, R, c); if (h.length) { rec.thruFrames = (rec.thruFrames || 0) + 1; for (const q of h) { if (!thru.has(q.id) && (rec.thruAt ||= []).length < 4) { const dx = q.x - p.x, dz = q.z - p.z; rec.thruAt.push({ t: +t.toFixed(1), ph: st.c.ph, kin: !!c.kin, lat: +p.lat.toFixed(2), kind: q.kind, v: +q.v.toFixed(1), lx: +(dx * Math.cos(p.h) - dz * Math.sin(p.h)).toFixed(2), lz: +(dx * Math.sin(p.h) + dz * Math.cos(p.h)).toFixed(2), dh: +Math.atan2(Math.sin(q.h - p.h), Math.cos(q.h - p.h)).toFixed(2), same: q.L === c.L, onL: q.L === stop.L, cL: c.L === stop.L }); } thru.add(q.id); } rec.thru = thru.size; } }
      if (st.c.went !== undefined && (c.gone || !(c.L === stop.L && c.s < drv.sStop + 8))) { const x = R.position.x, z = R.position.z, vis = [-2.2, 0, 2.2].some(o => C.inView(x + Math.sin(p.h) * o, z + Math.cos(p.h) * o));
        if (!vis || c.gone || t > st.c.went + 40) { R.visible = false; car.flash = false; st.carGone = true; rec.tGone = +t.toFixed(1); if (vis) rec.carHidInView = 1; drv.drop(); } } }
    if (st.c.q && st.c.rec === undefined) { const moved = st.c.q.every(([q, s0, L0]) => q.gone || q.L !== L0 || q.s - s0 > 6); if (moved) { st.c.rec = t - st.c.went; rec.recover = +st.c.rec.toFixed(1); } else if (t > st.c.went + 30) { st.c.rec = -1; rec.recover = 'stuck'; } }
    if (P?.on && st.c.ph >= 1 && !st.c.went) rec.queueMax = Math.max(rec.queueMax || 0, queue().length); }
  // the cars standing behind it on its lane and the lane before (within 40 m)
  const queue = () => { const L = stop.L, back = drv.sStop - 2 * CRUISER.half, out = []; for (const q of L.cars) if (q !== drv.c && q.s < back + .5 && back - q.s < 40 && q.v < .6) out.push([q, q.s, q.L]);
    for (const f of L.feeds) for (const q of f.inL.cars) if (q.next === f && f.inL.len - q.s < 12 && q.v < .6) out.push([q, q.s, q.L]); return out; };
  const doorTo = (which, k1, rate, dt) => { if (!car) return; const d = car.doors[which]; car.door(which, d.k + Math.sign(k1 - d.k) * Math.min(Math.abs(k1 - d.k), rate * dt)); };
  // ITS WAY (stage/crowd.js, 2026-10-09): where its people will walk in the next WAYLEN m — each one's own path, and the cuffed walk to the
  // cruiser's door from the start (so nobody is held where it will go) — as [ax, az, bx, bz] segments: the crowd is never held in it
  const way = () => { const W = [], add = pts => { let left = WAYLEN; for (let k = 1; k < pts.length && left > 0; k++) { const [ax, az] = pts[k - 1], d = Math.hypot(pts[k][0] - ax, pts[k][1] - az) || 1e-6, f = Math.min(1, left / d);
      W.push([ax, az, ax + (pts[k][0] - ax) * f, az + (pts[k][1] - az) * f]); left -= d; } };
    for (const X of [A, K]) if (X && !X.freed && !X.inCar && (X.tx !== null || X.path?.length)) add([[X.x, X.z], ...(X.tx !== null ? [[X.tx, X.tz]] : []), ...(X.path || [])]);
    if (door && st.tw === undefined && !A.freed) add([[A.x, A.z], ...stop.walk]); return W; };
  return { actors, way, focus: door ? [(A.x + DS[0]) / 2, (A.z + DS[1]) / 2, stop.nx, stop.nz] : [A.x, A.z], phase: () => st.ph + (st.shut ? ':shut' : '') + (st.c?.ph === 2 ? ':away' : ''), step(t, dt) {
    car_(t, dt); const stopped = !door || (st.c?.ph === 1);
    if (kWait && !K && !st.kGot && t < 10) { K = C.actor(e.who); if (K) { st.kGot = t; actors.splice(1, 0, K); rec.cop = 'agent'; } }
    const kPending = kWait && !K && t < 10; if (kWait && !K && !kPending && !door && !st.walkIn) { st.walkIn = 1; walkIn(); }
    // ── the stand-in cop out of the front door, once the car has stopped
    if (!K && !kPending && door && stopped && st.stopT !== undefined) { if (!st.fd) { st.fd = t; } doorTo('front', 1, 2.2, dt);
      if (car && car.doors.front.k > .85 && !st.kIn) { st.kIn = 1; K = C.actor(`P9:${e.to}:${Math.round(C.clock * 10)}`, { standIn: { x: FX[0][0], z: FX[0][1], ry: Math.atan2(stop.nx, stop.nz), look } }); if (K) { actors.splice(1, 0, K); goTo(K, [FX[1]], 1.1); K.outT = t; } else { rec.end = 'no-cop'; st.ph = 'gone'; } } }
    if (K && K.outT !== undefined && st.kShut === undefined && arrived(K)) { st.kShut = t; } if (st.kShut !== undefined && st.ph !== 'home') doorTo('front', 0, 2.4, dt);
    if (!K) { if (t < 1.4) A.faceTo = cf ? [cf.x, cf.z] : null; if (t > .5) exclaim(1.1); if (!door && t > 1 && !kPending) { rec.end = 'no-cop'; return false; } return t < (drv ? 60 : 30); }   // (in the traffic the cruiser may wait at a light or behind a queue)
    const ready = K.outT === undefined ? !K.walkIn || Math.hypot(K.x - A.x, K.z - A.z) < 9 : st.kShut !== undefined;
    // ── ARRIVE: the suspect looks at the cruiser; the cop comes (agent: at once; the stand-in once out)
    if (st.ph === 'arrive') { A.faceTo = cf && t < 2.2 ? [cf.x, cf.z] : [K.x, K.z]; if (t > .5) exclaim(1.1);
      if (ready && (stopped || t > 2)) { st.ph = 'approach'; st.ta = t; K.walkIn = false;
        // (a cop more than 5 m off comes in briskly, 2.4 m/s: the agent that had to finish stepping up to its own spot first — kWait
        // above — took 13 s to reach a suspect 7 m away, Kent St & 1st)
        const kv = Math.hypot(K.x - A.x, K.z - A.z) > 5 ? 2.4 : 1.5;
        if (mode === 'plain') { st.cs = cuffSpot([K.x, K.z]); goTo(K, around(K, A, st.cs.q, 1.3, O2), kv); }
        else if (mode === 'scuffle') { st.fs = faceSpot([K.x, K.z]); goTo(K, around(K, A, st.fs.q, 1.3, O2), kv); }
        else goTo(K, [[A.x + (K.x - A.x) * .3, A.z + (K.z - A.z) * .3]], kv);
        // the shot follows the marks (followMarks, TAPE): every metre of the cop's way in is to be seen — at Kent St & 1st it ran behind
        // the corner's 3.3 m structure — else the shot frames the suspect and the hidden stretch nearest it
        { const vw = camView(C, A), way = [[K.x, K.z], ...(K.path || [])], pts = [];   // (every metre of its way in)
          for (let k = 1; k < way.length; k++) { const [ax, az] = way[k - 1], [bx, bz] = way[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az))); for (let f = 0; f <= n; f++) pts.push([ax + (bx - ax) * f / n, az + (bz - az) * f / n]); }
          const hid = (pts.length ? pts : way).filter(([x, z]) => unseenAt(C, vw, O, x, z, A.y)), last = hid[hid.length - 1];   // (the hidden stretch nearest the suspect: where they meet)
          if (last) followMarks(C, e, [{ x: A.x, z: A.z, y: A.y, h: A.h }, { x: last[0], z: last[1], y: A.y, h: e.who || K.h }]); } } }
    // ── APPROACH
    if (st.ph === 'approach') { const d = Math.hypot(K.x - A.x, K.z - A.z), s = t - st.ta;
      if (mode === 'plain') { if (Math.hypot(K.x - st.cs.q[0], K.z - st.cs.q[1]) < 2.6 || s > 6) { A.faceTo = null; A.ry = st.cs.ry; } else A.faceTo = [K.x, K.z];
        if (arrived(K) && st.arrK === undefined) { st.arrK = t; K.faceTo = null; K.ry = st.cs.ry; }
        if (st.arrK !== undefined && ((yawErr(A) < .07 && yawErr(K) < .07) || t > st.arrK + 1.4)) startCuff(t); }
      else if (mode === 'scuffle') { if (d < 3.6) A.faceTo = [K.x, K.z];
        if (arrived(K) && st.arrK === undefined) { st.arrK = t; K.faceTo = [A.x, A.z]; A.faceTo = [K.x, K.z]; }
        if (st.arrK !== undefined && ((yawErr(A) < .08 && yawErr(K) < .08) || t > st.arrK + 1.2)) st.ph = 'scuffle'; }
      else { A.faceTo = [K.x, K.z]; if (d > 1.6) { K.tx = A.x + (K.x - A.x) / d * 1.4; K.tz = A.z + (K.z - A.z) / d * 1.4; K.path = null; K.v = 1.5; }
        if (d < 4.2 || s > 4) {   // RUN
          st.ph = 'run'; st.tr = t; st.ex = 1; C.props.exclaim(A.w, 1.4); const path = lanePath(C, A, [A.x - K.x, A.z - K.z], 6.5, [K.x, K.z]); A.faceTo = null; A.snap = false; A.clip = 'flee_run'; goTo(A, path, CLIP.flee_run.speed);
          K.clip = 'run_getaway'; K.faceTo = null; K.path = null; } } }
    // ── RUN: the suspect along the sidewalk, the cop after it; caught where the run ends
    if (st.ph === 'run') { const d = Math.hypot(K.x - A.x, K.z - A.z);
      if (arrived(A) && !st.stopA) { st.stopA = t; A.clip = null; }
      if (st.stopA) A.faceTo = [K.x, K.z];
      if (!st.atA) { const tx = A.x + (K.x - A.x) / (d || 1) * CLIP.scuffle_pair.pair.gap, tz = A.z + (K.z - A.z) / (d || 1) * CLIP.scuffle_pair.pair.gap;
        if (st.stopA && d < 1.6) { st.atA = 1; K.tx = tx; K.tz = tz; K.v = 1.2; } else { K.tx = st.stopA ? tx : A.x - (A.x - K.x) / (d || 1) * 1.25; K.tz = st.stopA ? tz : A.z - (A.z - K.z) / (d || 1) * 1.25; K.v = d > 1.3 ? CLIP.run_getaway.speed : 1; } }
      if (st.atA && arrived(K) && !st.atK) { st.atK = t; K.clip = null; K.faceTo = [A.x, A.z]; }
      if (st.atK && ((yawErr(A) < .08 && yawErr(K) < .08) || t > st.atK + 1)) st.ph = 'scuffle';
      if (t - st.tr > 12) st.ph = 'scuffle'; }
    // ── SCUFFLE: face to face at the pair's gap, both clips on one frame; parted 0.6 s into a round, stopped on one frame
    if (st.ph === 'scuffle' && st.ts === undefined) { st.ts = t; const [ux, uz, d] = dirTo(A, K); K.x = A.x + ux * CLIP.scuffle_pair.pair.gap; K.z = A.z + uz * CLIP.scuffle_pair.pair.gap; K.tx = A.tx = null; K.path = A.path = null;
      A.faceTo = K.faceTo = null; A.ry = Math.atan2(ux, uz); K.ry = A.ry + Math.PI; A.snap = K.snap = true; K.clip = 'scuffle_pair'; A.clip = 'scuffle_partner'; rec.scuffle = rounds; }
    if (st.ph === 'scuffle' && st.ts !== undefined) { const T = K.now === 'scuffle_pair' ? K.nowT : t - st.ts;
      if (T >= rounds * CLIP.scuffle_pair.dur + .6) { st.ph = 'turn'; st.tt = t; K.clip = null; A.clip = null; A.snap = false; K.snap = false; A.ry = Math.atan2(A.x - K.x, A.z - K.z); } }
    // ── TURNED ROUND: the suspect's back to the cop, the cop to exactly the cuffing gap behind it
    if (st.ph === 'turn') { const f = [Math.sin(A.ry), Math.cos(A.ry)], q = [A.x - f[0] * GAP, A.z - f[1] * GAP];
      if (!st.tq && (yawErr(A) < .1 || t > st.tt + 1.2)) { st.tq = t; K.tx = q[0]; K.tz = q[1]; K.v = .8; K.back = Math.hypot(q[0] - K.x, q[1] - K.z) < .3; K.faceTo = null; K.ry = A.ry; }
      if (st.tq && arrived(K) && ((yawErr(A) < .07 && yawErr(K) < .07) || t > st.tq + 1)) { K.back = false; startCuff(t); } }
    // ── CUFF: cuff_apply; the suspect's cuffed_idle 0.45 s after (its back to the cop); the CLICK at 1.31 s
    if (st.ph === 'cuff') { const T = K.now === 'cuff_apply' ? K.nowT : t - st.tc;
      if (T >= CLIP.cuff_apply.pair.delay && !st.idle) { st.idle = 1; A.clipT = Math.max(0, T - CLIP.cuff_apply.pair.delay); A.clip = 'cuffed_idle'; } else if (st.idle && A.now === 'cuffed_idle') A.clipT = 0;
      if (T >= 1.31 && !st.cuffed) { st.cuffed = t;   // the click: where the cop's hands are against the suspect's wrists (the lab's pair puts them together:
        // hands IN − 0.39 ahead of the cop's root, wrists 0.39 behind the suspect's — arrest.js ELBOW: the fists at the small of the back)
        const wa = A.w, wk = K.w, ya = wa.yawS ?? wa.p[3], yk = wk.yawS ?? wk.p[3], hx = wk.p[0] + Math.sin(yk) * (GAP - .39), hz = wk.p[2] + Math.cos(yk) * (GAP - .39), wx = wa.p[0] - Math.sin(ya) * .39, wz = wa.p[2] - Math.cos(ya) * .39;
        const gap = Math.hypot(hx - wx, hz - wz), dy = Math.abs(Math.atan2(Math.sin(ya - yk), Math.cos(ya - yk))); rec.cuffGap = +gap.toFixed(3); rec.cuffYaw = +dy.toFixed(3);
        if (P?.on) P.cuffs.push({ gap: +gap.toFixed(3), dyaw: +dy.toFixed(3), d: +Math.hypot(wa.p[0] - wk.p[0], wa.p[2] - wk.p[2]).toFixed(3), clips: [K.now, A.now], tiers: [wk.tier, wa.tier] }); }
      if (st.cuffed && (T >= CLIP.cuff_apply.dur + .05 || (K.now !== 'cuff_apply' && t > st.tc + 1.5)) && !st.stepT) { st.stepT = t; K.clip = null; K.snap = false; A.snap = false; A.clipT = 0;   // the cop steps back to 1.5 m first
        const f = [Math.sin(A.ry), Math.cos(A.ry)]; K.tx = A.x - f[0] * 1.5; K.tz = A.z - f[1] * 1.5; K.v = .8; K.back = true; K.faceTo = null; }
      if (st.stepT && (arrived(K) || t > st.stepT + 1.2)) { K.back = false; K.tx = null;
        if (door) { st.ph = 'walk'; st.tw = t; rec.tWalk = +t.toFixed(1); const w = walkTo(C, A, DS, cf, [A, K]) || stop.walk, r = around(A, K, w[0], 1.35, O2); goTo(A, r.length > 1 ? [...r.slice(0, -1), ...w] : w, CLIP.cuffed_walk.speed); st.wcap = 40 + pathLen(A, A.path) / CLIP.cuffed_walk.speed; }   // (never back through the cop behind it)
        else { st.ph = 'out'; st.tw = t; leaveOnFoot(C, A, { clip: 'cuffed_walk', away: [K.x, K.z] }); while (A.path.length > 1 && Math.hypot(A.path[0][0] - K.x, A.path[0][1] - K.z) < 1.8) A.path.shift(); const r = A.path.length ? around(A, K, A.path[0], 1.6, O) : [];   // (ahead, away from the cop behind it: never back through it)
          if (r.length > 1) A.path.unshift(...r.slice(0, -1)); C.free(A, { remove: true }); st.aOut = 1; rec.end = 'walked-off'; } } }
    if (st.cuffed && st.ph !== 'in' && st.ph !== 'out' && !A.freed) cuffedClip();
    // ── WALK to the door: the suspect cuffed (0.7 m/s); the cop behind it, then round to its guide spot; the rear door swings open
    if (st.ph === 'walk') { const dA = Math.hypot(A.x - DS[0], A.z - DS[1]), d = Math.hypot(K.x - A.x, K.z - A.z);
      if (dA < 3.2 || st.open) { st.open = 1; doorTo('rear', 1, 1.6, dt); }
      if (!st.toG) { if (arrived(A)) { st.toG = t; goTo(K, around(K, A, GS, 1.35, O2), 1); } else if (d > 1.45) { const [ux, uz] = dirTo(K, A); K.tx = A.x - ux * 1.3; K.tz = A.z - uz * 1.3; K.v = Math.min(1, CLIP.cuffed_walk.speed + (d - 1.3)); K.path = null; } else K.tx = null; }
      if (arrived(A)) { A.ry = ryIn; A.faceTo = null; } if (st.toG && arrived(K)) { K.faceTo = null; K.ry = ryIn + Math.PI; }
      if (arrived(A) && st.toG && arrived(K) && car && car.doors.rear.k > .97) { if (st.both === undefined) st.both = t;
        if ((yawErr(A) < .06 && yawErr(K) < .06) || t > st.both + 2) {   // INTO THE CAR: both clips on one frame
          st.ph = 'in'; st.ti = t; A.snap = K.snap = true; A.ry = ryIn; K.ry = ryIn + Math.PI; A.x = DS[0]; A.z = DS[1]; K.x = GS[0]; K.z = GS[1]; A.clip = 'get_in_car'; K.clip = 'guide_in_car'; st.at0 = [A.x, A.z]; } }
      if (t - st.tw > (st.wcap || 40)) { st.ph = 'in'; st.ti = t; A.clip = 'get_in_car'; K.clip = 'guide_in_car'; st.at0 = [A.x, A.z]; } }
    // ── IN: get_in_car + guide_in_car; the door shut at 1.6–2.05 s of the cop's clip; the suspect is in at the shut
    if (st.ph === 'in') { const T = K.now === 'guide_in_car' ? K.nowT : t - st.ti;
      if (!st.shut) { if (T >= 1.6) car?.door('rear', 1 - ease((T - 1.6) / .45));
        if (T >= 2.01 && Math.hypot(A.x - st.at0[0], A.z - st.at0[1]) < .1 && A.now !== 'get_in_car') { const [sx, sz] = CLIP.get_in_car.shift, y = A.ry; A.x += sx * Math.cos(y) + sz * Math.sin(y); A.z += -sx * Math.sin(y) + sz * Math.cos(y); }   // (no gait hook ran: the shift by hand)
        if (T >= 2.05) { st.shut = t; car?.door('rear', 0); const w = A.w, [lx, lz] = cf.local(w.p[0], w.p[2]), outBy = Math.max(0, -lx - HW), inZ = lz > rz0 - .3 && lz < rz1 + .3;
          rec.carIn = { outBy: +outBy.toFixed(3), lz: +lz.toFixed(2), inZ, clip: A.now }; if (P?.on) P.carIns.push(rec.carIn);
          A.inCar = true; C.free(A, { remove: true }); st.aOut = 1; rec.end = 'in-car'; rec.tIn = +t.toFixed(1); if (P?.on) P.intoCar++; } }
      if (st.shut && !st.kBack && K.now !== 'guide_in_car' && t > st.shut + .2) { st.kBack = t; K.clip = null; K.snap = false; st.ph = 'home'; } }
    // ── HOME: the cop back to its spot (an agent) or into the front door (the stand-in); then the cruiser drives off
    if (st.ph === 'home') {
      if (K.kind === 'held') { if (!st.kOut && backTo(C, K, [[cf.x, cf.z, 3.2]], 1.2, O2)) { st.kOut = 1; C.free(K); } if (t > st.kBack + 1.2 && st.c && st.c.ph === 1) st.c.ph = 2; }
      else { if (!st.kGo) { st.kGo = 1; goTo(K, around(K, { x: DS[0], z: DS[1], y: A.y }, FX[1], 1.2, O2), 1.2); }
        if (st.kGo === 1 && arrived(K)) { doorTo('front', 1, 2.4, dt); K.faceTo = [FX[0][0], FX[0][1]]; if (car.doors.front.k > .97) { st.kGo = 3; K.faceTo = null; K.tx = FX[0][0]; K.tz = FX[0][1]; K.v = 1.1; K.back = false; } }
        if (st.kGo === 3) { const [lx] = cf.local(K.x, K.z); if (lx > -HW + .45 && !st.kOut) { st.kOut = 1; K.inCar = true; C.free(K, { remove: true }); st.kGo = 4; } }   // (in through the dark doorway: then gone)
        if (st.kGo === 4) { doorTo('front', 0, 3.2, dt); if (car.doors.front.k <= 0 && st.kInT === undefined) st.kInT = t; }
        if (st.kInT !== undefined && t > st.kInT + .5 && st.c && st.c.ph === 1) st.c.ph = 2; } }
    // ── OUT (no car): the cop behind the cuffed suspect along its way out of view; both go once the camera can't see them
    if (st.ph === 'out' && !st.kOut) { const d = Math.hypot(K.x - A.x, K.z - A.z), [ux, uz] = dirTo(K, A);   // (1.4 m behind it, never nearer; once it is gone, on the same way)
      if (!A.freed) { if (d > 1.5) { K.tx = A.x - ux * 1.4; K.tz = A.z - uz * 1.4; K.v = Math.min(1, CLIP.cuffed_walk.speed + (d - 1.4)); K.path = null; K.back = false; }
        else if (d < 1.3) { K.tx = A.x - ux * 1.45; K.tz = A.z - uz * 1.45; K.v = .8; K.back = true; K.faceTo = [A.x, A.z]; K.path = null; } else { K.tx = null; K.back = false; K.faceTo = null; } st.lastA = [A.x, A.z, ux, uz]; }   // (it comes back toward the cop: the cop gives way)
      else { const [x, z, gx, gz] = st.lastA || [A.x, A.z, ux, uz]; K.faceTo = null; goTo(K, [[x, z], [x + gx * 30, z + gz * 30]], .9); st.kOut = 1; C.free(K, { remove: true }); } }
    // ── the bystanders: aside, then back once the cruiser has gone (or the cop has walked them off)
    for (const H of helpers) { if (H.freed || H.done) continue; if (arrived(H) && !H.faced) { H.faced = 1; H.faceTo = [A.x, A.z]; }
      if ((st.carGone && st.aOut) || t > 60) { H.faceTo = null; if (backTo(C, H, [], 1.2, O2 || O)) { H.done = 1; C.free(H); } } }
    if (st.ph === 'gone') return false;
    return !(st.aOut && (st.kOut || !K) && st.carGone && helpers.every(H => H.done || H.freed)) && t < 90 + (st.wcap || 0); },
    end(abort) { if (!A.freed) C.free(A, { remove: true, now: abort }); if (K && !K.freed) C.free(K, { remove: K.kind === 'standin', now: abort }); for (const H of helpers) C.free(H, { now: abort });
      if (car) { car.root.visible = false; car.flash = false; car.door('rear', 0); car.door('front', 0); } drv?.drop(); if (!rec.end) rec.end = abort ? 'aborted' : 'capped'; } };
}
// where a cruiser pulls up for someone at (x, z): the nearest traffic lane with them on its kerb side → { x0, z0 (its stop), ux, uz, nx, nz (kerbward), lat, x, z, L, s }
// (stage-b: a corner's people stand by a junction, past the ends of every lane: the stop is clamped onto the lane, the car's nose short
// of the stop bar, and a lane is chosen by how far they are off its kerb plus how far past its ends)
function curbStop(C, x, z) {
  const T = C.traffic(); if (!T?.lanes) return null; let best = null, bc = 26;
  for (const L of T.lanes) { if (L.x0 === undefined || L.len < 8) continue; const px = x - L.x0, pz = z - L.z0, s = px * L.ux + pz * L.uz; if (s < -6 || s > L.len + 6) continue;
    const nx = -L.uz, nz = L.ux, side = px * nx + pz * nz; if (side < 1.2 || side > 26) continue; const cost = side + 1.5 * Math.max(0, 3 - s, s - (L.len - 2.5)); if (cost < bc) { bc = cost; best = { L, s, side, nx, nz }; } }
  if (!best) return null; const { L, s, side, nx, nz } = best, sc = Math.max(3, Math.min(L.len - 2.5, s + 1.3)), lat = Math.max(0, Math.min(1.1, side - 2.6));
  return { x0: L.x0 + L.ux * sc, z0: L.z0 + L.uz * sc, ux: L.ux, uz: L.uz, nx, nz, lat, x: L.x0 + L.ux * sc + nx * lat, z: L.z0 + L.uz * sc + nz * lat, L, s: sc }; }
const pathLen = (A, pts) => { let a = [A.x, A.z], d = 0; for (const p of pts || []) { d += Math.hypot(p[0] - a[0], p[1] - a[1]); a = p; } return d; };
// THE PROBE'S BEFORE: what the pre-cruiser search (stage-b: kerbStop round curbStop, the door within 14 m by a clear walk) chose here
function wasStop(C, A) { const stop = kerbStop(C, curbStop(C, A.x, A.z)); if (!stop) return 'no-lane'; if (!stop.kerb) return stop.parked ? 'kerb-taken' : 'no-kerb';
  const cf = carFrame(stop), HW = CRUISER.hw, [rz0, rz1] = CRUISER.doors.rear, DS = cf.pt(-HW - .45, (rz0 + rz1) / 2 + .05); if (Math.hypot(DS[0] - A.x, DS[1] - A.z) >= 14) return 'far';
  const O = C.occ(A.x, A.z, 7), O2 = !O ? null : { at(x, z) { const [lx, lz] = cf.local(x, z); if (Math.abs(lx) < HW + .15 && Math.abs(lz) < CRUISER.half + .2) return 2; return O.at(x, z); } };
  return detour(O2, [A.x, A.z], DS, A.y) ? 'car' : 'wall'; }
// off screen (or tape at speed): only what lasts
export function aftermath(C, kind, e, at) {
  if ((kind === 'robSeen' || kind === 'robUnseen') && e.ok !== false) { const p = at || C.placePos(e.at); if (p) C.props.litter(p.x, p.z, 4, 90); }
  if ((kind === 'robSeen' || kind === 'robUnseen') && e.shot?.dead) { const p = at || C.placePos(e.at); if (p) { const m = { x: p.x + .5, z: p.z + .3, ry: 0 }; C.props.chalk(m.x, m.z, m.ry, { key: C.lens() }); if (C.lens() === 'live') C.liveMarks.push(m); } }
  if (kind === 'death' || (kind === 'shot' && (e.type === 'death' || e.dead))) { const p = at || C.placePos(e.at); if (p) { const m = { x: p.x + .5, z: p.z + .3, ry: 0 }; C.props.chalk(m.x, m.z, m.ry, { key: C.lens() }); if (C.lens() === 'live') C.liveMarks.push(m); } }
}
export const _arrestDbg = { curbStop: (C, x, z) => curbStop(C, x, z), kerbStop: (C, s) => kerbStop(C, s), plan: (C, A, o) => planStop(C, A, o), was: (C, A) => wasStop(C, A) };   // (stage/probe.mjs, tests)
