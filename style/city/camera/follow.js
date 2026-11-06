// CAMERA BUILD 2/4 (2026-10-05) · FOLLOW (RESEARCH.md §4.4): a third-person camera on any walker — the city's generic walkers and the
// live sim's agents alike (both walk in peds.sim, the agents with `agent` and their sim id `aid`). It smooths PARAMETERS, never the
// camera's position: a pivot at shoulder height (springs), the azimuth and pitch (the VIEWER's: input lands on them at once and nothing
// else moves them), the arm's length (the viewer's distance), and the assists below (each acceleration-limited: no velocity steps).
//   THE VIEWER OWNS THE ANGLE AND THE ZOOM (slime 10-09: "camera shouldn't drift back, human controls zoom level"). No drift back behind
//   anyone: the orbit angle stays where it was left (a world bearing) through a turn, a hold, a cut, Tab, G and a click. The distance
//   is the viewer's (CAM.follow.viewerDist, kept in this browser: a subject switch, a shot handing back to follow and a reload all come
//   back to it), and so is the pitch (viewerPitch, 10-09b, kept the same way); only input writes them. Walls push the arm in and the search swings it as ASSISTS on top (sArm, sLen, sAz), which go
//   back to the viewer's angle and distance once the view there is clear. A cut is the search's swing too, not a new angle.
// The pose is made from them every frame in the rig's LATE step (after the walkers moved: this frame's position, RESEARCH D13).
// Collision is world.js:
//   the ARM     swept with the camera's body (r .22, STATIC_WIDE) from a root .5 m out from the pivot; the camera always sits
//               on that swept segment. Walls and cars never get between the person and the camera: the body in a wall → in at once;
//               a wall onto the arm with the body clear → in fast but continuous; the arm from where the pivot will be in 1 s eases it
//               in ahead of an awning or a wall; it eases back out slower than half the walker's pace (never a stall). Posts, poles,
//               signs and trunks (THIN columns, and solids narrower than the arm swept .45 m to either side) never shorten it (D3).
//   a POST      on the line of sight or at the camera's body, now or .4 s on: the camera side-steps round it (≤ .75 m, the side
//               that sees past it, the shoulder's first), and steps back once past. No fading, no pull-in.
//   a WALL      hiding the person for .2 s (or no room for the 2.2 m arm): a search over swings (± .26 / .52 / .87 rad), a lift
//               (+.25 rad) and a pull-in picks the cheapest clear view; released .5 s after the line is
//               clear (at the viewer's own angle and distance: then the swing and the pull-in go back to 0).
//               (10-09b) A wall that would PULL the arm under .75 × the viewer's distance (now, or 1 or 2 s on along their way) is
//               searched the same way, wide swings and "behind a walker" included, and a close arm is priced (occl.w.close): a short
//               swing round them beats pulling in at the blocked angle; it holds its swing (occl.stick) until the viewer's angle has
//               .9 × their distance now and 2 s on, then swings back. Walkers and cars on the line or at the camera FADE (fade.js).
//   PEOPLE      never move the arm: over the shoulder (shoulder .3 m) keeps the line out of the queue (D7); a walker at the camera
//               lifts it over their head. Never within .5 m of the subject's axis; the close arm looks over the shoulder (D5).
//   SWITCHES    Tab / G / click: a person ≤ 25 m away with a clear line → the pivot glides over (a temporary half-life), every frame
//               collision-correct; else a cut (D8). The viewer's angle and distance carry over to the new person either way.
//               Into follow from another mode: down the line of sight in parameter space (the arm, pitch and distance glide from where
//               the camera was onto the viewer's distance), or a cut when that line is blocked; the rig's blend only turns the view.
//   RATES       half-lives and per-second limits with exact exponentials (damp.js) or trapezoid steps: 30, 60 and 120 Hz trace the same
//               path (D9). Nothing sprung on the position (D4: no teleports); the view's auto-motion ≤ 2.5 rad/s, 12 rad/s² (input: free).
//   drag / two-finger swipe / A D ← → / Q E orbit (it stays where it is left) · W S ↑ ↓ pitch · wheel / pinch / R F distance (kept) ·
//   Tab / Shift-Tab next / previous person nearby · G next sim agent
//   a person who vanishes (indoors, out of range) is waited for (an agent comes back under the same id), then the nearest one is followed;
//   an agent is waited for as long as it takes (C2): the camera holds where it was last
import * as THREE from 'three';
import { CAM, savePrefs } from './config.js';
import { damp, dampAngle, wrap, clamp, smootherstep, spring, decay } from './damp.js';
import { STATIC, PEOPLE, CARS, STATIC_WIDE, STATIC_THIN } from './world.js';

const E3 = new THREE.Euler(0, 0, 0, 'YXZ'), P = new THREE.Vector3(), H = new THREE.Vector3();
const vec = () => ({ x: 0, y: 0, z: 0 }), put = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };

// the people the camera can follow (peds.sim.walkers: drawn ones have tier 1–3)
export function createPeople(getPeds) {
  const A = vec();
  const all = () => getPeds()?.sim?.walkers || [];
  return {
    all, label: w => !w ? '' : w.agent ? `agent ${w.aid}` : `walker #${w.id}`,
    heightOf: w => (w && getPeds()?.heightOf?.(w)) || 1.75,   // (peds.heightOf when it exists: the look's real height)
    // (C2: an agent riding out of view, in a cab or underground, is found by its ride's stand-in under its id: simstate/movement.js)
    byAid: aid => all().find(w => w.agent && w.aid === aid && !w.gone) || getPeds()?.sim?.rideOf?.(aid) || null,
    nearest(x, z, skip = null, r = 1e9) { let best = null, bd = r * r; for (const w of all()) { if (w === skip || w.gone) continue; const d = (w.p[0] - x) ** 2 + (w.p[2] - z) ** 2; if (d < bd) { bd = d; best = w; } } return best; },
    // the person under a screen point (NDC): nearest to the camera among those whose body is within the pick radius, unhidden first
    pick(camera, nx, ny, px, world, maxD = 400) { let best = null, bd = 1e9; const W = innerWidth, Hh = innerHeight;
      for (const w of all()) { if (!w.tier || w.gone) continue; P.set(w.p[0], w.p[1] + .9, w.p[2]).project(camera); if (P.z > 1 || P.z < -1) continue;
        H.set(w.p[0], w.p[1] + 1.7, w.p[2]).project(camera); const hpx = Math.abs(H.y - P.y) * Hh / 2, r = Math.max(px, hpx * 1.1), d = Math.hypot((P.x - nx) * W / 2, (P.y - ny) * Hh / 2);
        if (d > r) continue; const dist = Math.hypot(w.p[0] - camera.position.x, w.p[1] - camera.position.y, w.p[2] - camera.position.z); if (dist > maxD) continue;
        let score = d / r + dist / 60; if (world && dist < 120) { const h = world.ray(put(A, w.p[0], w.p[1] + 1, w.p[2]), camera.position, STATIC_WIDE); if (h && h.t * dist < dist - .8) score += 1.5; }   // (behind a wall from here: pick someone in view first)
        if (score < bd) { bd = score; best = w; } }
      return best; },
  };
}

// x toward target (s = { x, v }): the exponential approach (half-life hl), its speed ≤ maxV and its change ≤ maxA·dt, braking in time;
// exact while neither limit holds, a trapezoid step while one does — no velocity step, so no acceleration spike (F3)
function chase(s, target, hl, maxV, maxA, dt) {
  if (!(dt > 0)) return s.x; const gap = target - s.x;   // (camera build 2c: a speed over a new, lower maxV is shed at maxA, not clamped in one frame — that clamp was a velocity step)
  let wd = clamp((damp(s.x, target, hl, dt) - s.x) / dt, -maxV, maxV); wd = Math.sign(wd) * Math.min(Math.abs(wd), Math.sqrt(2 * maxA * Math.max(0, Math.abs(gap) - Math.abs(s.v) * dt)));   // (braking curve one step early: the step lags it by a frame)
  const v1 = clamp(wd, s.v - maxA * dt, s.v + maxA * dt), nx = s.x + (s.v + v1) / 2 * dt;
  if ((target - nx) * gap < 0 && Math.abs(v1) <= maxA * dt) { s.x = target; s.v = 0; } else { s.x = nx; s.v = v1; } return s.x; }   // (onto the target when it can stop there within maxA; else it passes and turns back — camera build 2c: a target that moves onto x no longer zeroes the speed in one frame)
const cs = () => ({ x: 0, v: 0 }), zero = (...l) => { for (const s of l) s.x = s.v = 0; };

// ── INDOORS (C2-camera, GAME.md §41, slime 10-31: "Rise to the cutaway"): while the agent followed is inside its home, the camera rises
// to its room's own three-quarter view from the street side (interiors/city/index.js frameOf, through rooms.of(aid): interiors/city/
// record.js cutaway — whether it is inside is draw.js's indoor plan, the frame is interiors') and eases back down at the door.
//   at the door     the agent crossing its front wall (inside flips while its door is open): an ease in PARAMETER space from the
//                   follow pose (live) to the room's: the look point slides from the person to the room, the bearing turns, the camera
//                   rises and draws back (a rise, not a straight line through the house), the view slerps; out, the same back onto a
//                   follow re-entered at the person (cut(): the viewer's angle and distance, which nothing inside touched)
//   a time jump     a seek or a reload into a stay (inside with its door shut) opens straight onto the room's view; out of one, straight
//                   onto the follow pose. A room not open yet is waited for holding still (≤ room.holdMax s), never flown in from
//                   elsewhere
//   a switch        Tab / G / a click onto someone at home: an ease from where the camera is (or at once past room.snapFar m)
//   input inside    orbits and zooms the room's view (its own offsets, kept this session, clamped to the street side); the follow's
//                   angle, pitch and distance are not touched, so they come back exactly
const M4 = new THREE.Matrix4(), QL = new THREE.Quaternion(), UP3 = new THREE.Vector3(0, 1, 0), FW = new THREE.Vector3(), DV = new THREE.Vector3();
const poseOf = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), piv: new THREE.Vector3() });
// a pose's offset from its look point as bearing, elevation and log distance (the blend's parameters)
function sph(P) { DV.subVectors(P.p, P.piv); const d = Math.max(1e-3, DV.length()); return { az: Math.atan2(DV.x, DV.z), el: Math.asin(clamp(DV.y / d, -1, 1)), ld: Math.log(d) }; }
// k: the path's shape { e, p } — how early the elevation and the distance move (e > 1: up early on the way up, down late on the way
// down; e < -1 the other way round: low first) and the look point (p > 1 early, p < -1 late), so the camera passes over (or under)
// what stands between the street and the room (a tree's crown, a porch) instead of through it, with the person in sight
const ease = (s, k, rise) => { const q = Math.abs(k); return (rise === (k > 0)) ? 1 - (1 - s) ** q : s ** q; };
function blendPose(A, B, s, out, k = { e: 1, p: 1 }) {
  const a = sph(A), b = sph(B), se = ease(s, k.e, b.el > a.el), sp = ease(s, k.p, true);
  const az = a.az + wrap(b.az - a.az) * s, el = a.el + (b.el - a.el) * se, d = Math.exp(a.ld + (b.ld - a.ld) * se), ce = Math.cos(el);
  out.piv.lerpVectors(A.piv, B.piv, sp); out.p.set(out.piv.x + Math.sin(az) * ce * d, out.piv.y + Math.sin(el) * d, out.piv.z + Math.cos(az) * ce * d);
  // (the view: from one end's to the other's, drawn toward the look point between them — the person, then the room — most at the middle)
  out.q.slerpQuaternions(A.q, B.q, s); M4.lookAt(out.p, out.piv, UP3); QL.setFromRotationMatrix(M4); out.q.slerp(QL, 4 * s * (1 - s)); return out; }

export function createFollow(world, people, rooms = null) {
  const F = () => CAM.follow;
  const pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: CAM.follow.fov }, focus = new THREE.Vector3(), last = new THREE.Vector3();
  const Pv = vec(), PvV = vec(), Pc = vec(), PcV = vec(), Hp = vec(), Pg = vec(), Bo = vec(), Cp = vec(), A = vec(), La = vec(), LaV = vec(), Lk = vec(), C = vec(), T = vec(), T2 = vec(), PT = [vec(), vec(), vec(), vec(), vec()], PT2 = [vec(), vec(), vec(), vec(), vec()];
  const vs = () => ({ w: 0, a: 0, o: 0, ov: 0 });   // (the view's auto-motion per axis: track() below)
  const S1 = { x: 0, v: 0 }, ent = { t: 1e9, dur: 1, pt: 0, len: 0 }, view = { yaw: 0, pitch: 0, ty: 0, tp: 0, ok: false, Y: vs(), P: vs() };
  const sAz = cs(), sPt = cs(), sLen = cs(), sDodge = cs(), sLift = cs(), sClose = cs(), sArm = cs(), asT = { az: 0, pt: 0, len: 0 };
  let w = null, aid = null, history = [], lost = 0, entered = false, now = 0, hgt = 1.75;
  let hold = false, coupled = true, relT = 0, holds = 0, brakes = 0, pushV = 0, cpOk = false, bodyN = 0, hOcc = 0, visW = 1, wantCut = false, fresh = false, rN = 1e9, cutAt = -1e9;   // (camera build 2c: the tight-space hold; the body's cushion round posts)
  // the viewer's distance and pitch: theirs from the last session (prefs), else the defaults; written by input only, kept (savePrefs,
  // debounced). (10-09b: the pitch is kept as the distance is — Tab, a cut, a hold, a shot's hand-back and a reload come back to it)
  const ownDist = () => { const v = +F().viewerDist; return clamp(Number.isFinite(v) && v > 0 ? v : F().dist, F().distRange[0], F().distRange[1]); };
  const ownPitch = () => { const v = F().viewerPitch; return clamp(v !== null && Number.isFinite(+v) ? +v : F().pitch, F().pitchRange[0], F().pitchRange[1]); };
  let saveAt = 0; const keepView = () => { F().viewerDist = +dist.toFixed(3); F().viewerPitch = +pt.toFixed(4); clearTimeout(saveAt); saveAt = setTimeout(savePrefs, 300); };
  let az = 0, pt = ownPitch(), dist = ownDist(), Ls = dist, armColl = dist;
  let gL = dist;   // (C2-camera2: last frame's arm length, for the enter glide's pace)
  let walled = 0, walledCut = 0, snapM = 0, snapMax = 0, snapT = [-1e9, -1e9], pullN = 0, brake = false, occT = 0, clrT = 0, searchAt = -1, vis = 1, thinN = 0, flip = 0, dodgeT = 0, dodgeAt = -1, liftT = 0, glide = 1e9, safety = 0, cuts = 0, snaps = 0, nanSeen = 0, slides = 0, searches = 0, dodges = 0;
  sArm.x = dist;

  // ── INDOORS state: src (what the camera is on: 'follow' or 'room'), the ease onto it (t of dur s, from the live follow pose or a still),
  // the room's frame, the viewer's own offsets inside (yaw, pitch, zoom), a hold for a room not open yet
  const CW = { src: 'follow', t: 1e9, dur: 1, from: 'still', still: poseOf(), room: null, fr: null, yaw: 0, pitch: 0, zoom: 1, holdT: -1, aid: null, walkIn: false,
    k: null, gaveUp: null, n: { in: 0, out: 0, snapIn: 0, snapOut: 0, switches: 0, holds: 0, holdMax: 0, blocked: 0, blind: 0, gaveUp: 0 } };
  const FP = poseOf(), RP = poseOf(), OUT = poseOf();
  const R = () => F().room;
  function roomPose(out) { const f = CW.fr, r = R(); DV.subVectors(f.pos, f.tgt); const d0 = Math.max(.5, DV.length()), az = Math.atan2(DV.x, DV.z) + CW.yaw, el0 = Math.asin(clamp(DV.y / d0, -1, 1));
    const el = clamp(el0 + CW.pitch, r.el[0], r.el[1]), d = d0 * CW.zoom, ce = Math.cos(el);
    out.piv.copy(f.tgt); out.p.set(f.tgt.x + Math.sin(az) * ce * d, f.tgt.y + Math.sin(el) * d, f.tgt.z + Math.cos(az) * ce * d);
    M4.lookAt(out.p, out.piv, UP3); out.q.setFromRotationMatrix(M4); return out; }
  // the camera's pose this frame (what the last frame put out) as a still to ease from: its look point the distance to `toward` ahead
  // (its look point: the one it was put out with — the person's, the room's, or between — else, from another mode, its view ahead)
  function takeStill(src, toward) { CW.still.p.copy(src.p); CW.still.q.copy(src.q); FW.set(0, 0, -1).applyQuaternion(src.q);
    if (src.pivOk) CW.still.piv.copy(src.piv); else CW.still.piv.copy(src.p).addScaledVector(FW, Math.max(1, toward ? src.p.distanceTo(toward) : 5)); }
  // the ease's path: of the shapes (room.ks × room.kp), one along which the camera's body meets nothing solid (walls, crowns, signs:
  // STATIC_WIDE), the fewest frames with a solid on its sight line to the person (where it will be: posts and trunks too, STATIC);
  // none clear → at once (a cut, never a frame inside a tree or on a wall). The open house's cut-away (its roof, front slab and storey)
  // is not solid to the world while its room is open (camera/world.js THE CUT), so the camera passes over it and sees in
  const PB = poseOf(), SA = vec(), SB = vec();
  function pathK(A, B, dur) {
    const hd = w ? heading(w) : 0, v = w && (w.vc ?? 0) > .1 ? w.vc : 0, h = hgt; let best = null;
    for (const e of R().ks) for (const p of R().kp) { const k = { e, p }; let hit = false, blind = 0;
      for (let i = 1; i < 12 && !hit; i++) { const s = i / 12; blendPose(A, B, s, PB, k); if (world.overlap(PB.p, F().body.rWide + .02, STATIC_WIDE)) { hit = true; break; }
        if (!w) continue; const ah = s * dur * v; put(SA, w.p[0] + Math.sin(hd) * ah, w.p[1] + .6 * h, w.p[2] + Math.cos(hd) * ah); put(SB, PB.p.x, PB.p.y, PB.p.z);
        if (world.ray(SB, SA, STATIC)) blind++; }
      if (!hit && (!best || blind < best.blind)) best = { k, blind }; if (best && !best.blind) break; }
    if (best) CW.n.blind += best.blind; return best && (best.blind === 0 || R().blindOk) ? best.k : null; }
  function goTo(src, how, dur) { const prev = CW.src; CW.src = src; CW.holdT = -1; CW.walkIn = false;
    if (src === 'follow' && prev === 'room') wantCut = true;   // (back at the person at the viewer's own angle and distance)
    if (how === 'snap') { CW.t = CW.dur = 1e-6; CW.n[src === 'room' ? 'snapIn' : 'snapOut']++; return; }
    if (how === 'still') takeStill(OUT, src === 'room' ? CW.fr.tgt : null);
    CW.from = how; CW.t = 0; CW.dur = dur; CW.k = null; }   // (its path is picked once this frame's follow pose is made: compose)
  // each frame, before the follow's own step: what the camera is on (the agent's indoor state and its room's frame, read)
  function indoors(dt) {
    const aidNow = w?.agent ? w.aid : null, info = aidNow && rooms ? rooms.of(aidNow) : null, r = R(), switched = aidNow !== CW.aid; CW.aid = aidNow;
    if (CW.t < CW.dur) CW.t += dt;
    const inside = !!info?.inside, door = info?.door > 0, holding = CW.holdT >= 0;
    if (inside && info.frame && (info.room !== CW.room || !CW.fr)) { const f = info.frame(); if (f) { CW.room = info.room; CW.fr = { pos: f.pos.clone(), tgt: f.tgt.clone() }; } }
    if (inside && info.frame && CW.room === info.room) {
      CW.gaveUp = null;
      if (CW.src === 'room' && !switched && !holding) return;
      // into the room: across its door (played) eases from the follow pose; a switch eases from where the camera is (or at once past
      // snapFar); a seek or a reload (inside with its door shut, or held for the room) at once
      const near = OUT.ok && OUT.p.distanceTo(roomPose(RP).p) <= r.snapFar;
      if (CW.src === 'follow' && (door || CW.walkIn) && !switched && !holding) { CW.n.in++; goTo('room', CW.t >= CW.dur ? 'follow' : 'still', r.inT); }
      else if (switched && near) { CW.n.switches++; goTo('room', 'still', r.switchT); }
      else goTo('room', 'snap');
      return; }
    if (inside) {
      // its room isn't open yet: a walk in through its door keeps following until it is; a jump into a stay (a seek, a reload, a switch
      // to someone at home, another room) holds the camera still a moment rather than fly in from elsewhere or look at a wall
      if (holding) { CW.holdT += dt; CW.n.holdMax = Math.max(CW.n.holdMax, CW.holdT); if (CW.holdT >= r.holdMax) { CW.holdT = -1; CW.gaveUp = info.room; CW.n.gaveUp++; if (CW.src === 'room') goTo('follow', 'snap'); } return; }
      if (CW.gaveUp === info.room) return;   // (held as long as it may: the follow's own view until the room opens)
      if (CW.src === 'follow' && door && !switched) { CW.walkIn = true; return; }
      if (OUT.ok && !CW.walkIn) { takeStill(OUT, null); CW.holdT = 0; CW.n.holds++; }
      return; }
    CW.holdT = -1; CW.walkIn = false; CW.gaveUp = null;
    if (CW.src === 'room') {
      // out: through its door eases back down; a switch to someone outside nearby eases from where the camera is; a seek out at once
      if (door && !switched) { CW.n.out++; goTo('follow', 'still', r.outT); }
      else if (switched && OUT.ok && Math.hypot(OUT.p.x - last.x, OUT.p.z - last.z) < r.snapFar) { CW.n.switches++; goTo('follow', 'still', r.switchT); }
      else goTo('follow', 'snap'); }
  }
  // the pose put out: the follow's (FP), the room's (RP), the ease between, or the still held
  function compose() {
    let out;
    if (CW.holdT >= 0) out = CW.still;
    else { const to = CW.src === 'room' && CW.fr ? roomPose(RP) : FP;
      if (CW.k === null && CW.t < CW.dur) { CW.k = pathK(CW.from === 'follow' ? FP : CW.still, to, CW.dur); if (!CW.k) { CW.k = 0; CW.t = CW.dur; CW.n.blocked++; CW.n[CW.src === 'room' ? 'snapIn' : 'snapOut']++; } }
      if (CW.t >= CW.dur) out = to;
      else out = blendPose(CW.from === 'follow' ? FP : CW.still, to, smootherstep(clamp(CW.t / CW.dur, 0, 1)), OUT, CW.k || undefined); }
    if (out !== OUT) { OUT.p.copy(out.p); OUT.q.copy(out.q); OUT.piv.copy(out.piv); }
    OUT.ok = OUT.pivOk = true; pose.p.copy(OUT.p); pose.q.copy(OUT.q); }

  const heading = x => x.yawS ?? x.p[3];
  // FOLLOW WOBBLE (10-09) · the heading the camera looks ahead along: the subject's, eased (headHL); a turn of more than
  // flipTurn rad is taken only once it has held flipHold s. A heading flipped round for a frame or two (a step back along the path, a
  // bad frame) never swings the camera; a U-turn or a kickturn still comes, a beat late.
  let hdC = null, flipT = 0;
  function headingC(x, dt) { const h = heading(x); if (hdC === null || !(dt > 0)) { hdC = h; flipT = 0; return hdC; }
    if (Math.abs(wrap(h - hdC)) > F().flipTurn) { flipT += dt; if (flipT < F().flipHold) return hdC; } else flipT = 0;
    return hdC = dampAngle(hdC, h, F().headHL, dt); }
  // (C2: the pivot never goes under the street: on a station's stairs the subject goes down into the ground and the camera, following
  // it down, was in the stairwell's walls — a dark frame. It stays at street level and looks down the flight; the angle and the distance
  // are the viewer's as ever)
  function anchor(x, out) { if (x) hgt = people.heightOf(x); const b = x ? x.p : [last.x, last.y, last.z]; return put(out, b[0], Math.max(b[1], F().floorY) + F().anchorH * hgt, b[2]); }
  // the camera point: arm direction (a azimuth, p pitch), length len, lat m to the view's right, up m lifted — at the arm's full length
  // L; a shorter arm (len < L) sits on the same straight segment, scaled (so the swept segment is exactly where it can be)
  function camAt(a, p, len, lat, up, out, L = len, O = Pc) { const cp = Math.cos(p), s = Math.sin(a), c = Math.cos(a), k = L > 1e-6 ? len / L : 0;
    return put(out, O.x + (s * cp * L + c * lat) * k, O.y + (Math.sin(p) * L + up) * k, O.z + (c * cp * L - s * lat) * k); }
  // the longest arm the swept body allows out to len (walls and cars; THIN columns never), swept from its ROOT .5 m out from the pivot
  // (what the person brushes — a lintel over a doorway, a wall beside them, a car at the kerb — is theirs, not the arm's; a root inside a
  // solid leaves the arm no room: crushed, and the search swings it)
  // (camera build 2c: the old NARROW rule — a solid the arm swept .45 m to either side passes counts as a post — is gone: it let the camera
  // into sign boxes up to .9 m wide. world.js now flags THIN per height, so a post is thin and the box on it is solid, at their heights.)
  const R0 = vec();   // (the arm's root)
  function armMax(a, p, len, lat, up, O = Pc) { camAt(a, p, len, lat, up, T, len, O); const D = Math.hypot(T.x - O.x, T.y - O.y, T.z - O.z) || 1, r = F().radius, k0 = Math.min(.5, D * .5) / D;
    put(R0, O.x + (T.x - O.x) * k0, O.y + (T.y - O.y) * k0, O.z + (T.z - O.z) * k0); if (world.overlap(R0, .1, STATIC_WIDE)) return k0 * len;
    const h = world.sweep(R0, T, r, STATIC_WIDE); if (!h) return len; const tt = k0 + h.t * (1 - k0);
    return Math.max(k0 * len, (tt - .05 / D) * len); }
  // the five sight-line points on the subject (head, chest, hips, both shoulders), shifted by (dx, dz), the shoulders across the line from `from`
  function targets(out, from, dx = 0, dz = 0) { const px = (w ? w.p[0] : last.x) + dx, pz = (w ? w.p[2] : last.z) + dz, py = w ? w.p[1] : last.y, h = hgt;
    let lx = from.z - pz, lz = px - from.x; const l = Math.hypot(lx, lz) || 1; lx *= .18 / l; lz *= .18 / l;
    put(out[0], px, py + .95 * h, pz); put(out[1], px, py + .7 * h, pz); put(out[2], px, py + .45 * h, pz); put(out[3], px + lx, py + .78 * h, pz + lz); put(out[4], px - lx, py + .78 * h, pz - lz); return out; }
  const fan = (from, pts) => world.fan(from, pts, STATIC, w);
  const latOf = (L, dodge) => F().shoulder * Math.min(1, L / F().dist) + dodge;
  // (10-09b) the price of an arm L of a wanted len: 0 down to occl.pull × len, w.close at the shortest arm, squared between — a swing
  // round the person is cheaper than a close pull-in at a blocked angle (both go back to the viewer's angle and distance)
  const pullAt = len => Math.max(F().distRange[0] + .05, len * F().occl.pull);
  function closeCost(L, len) { const o = F().occl, m0 = F().distRange[0], top = pullAt(len); if (!(o.w.close > 0) || L >= top || top <= m0 + .05) return 0;
    const k = clamp((top - L) / (top - m0), 0, 1); return o.w.close * k * k; }

  // ── a WALL hides them: the cheapest of the swings × lifts, and a pull-in to the first wall on the line (≥ the shortest arm)
  // (camera build 2b) the arm's room counts where the pivot is now AND where it will be in armAhead s (Fut, when moving): a swing that is
  // clear now but crushed in a second is no answer; an arm under the shortest (2.2 m) costs W.short — the search swings or lifts first
  const Fut = vec(), Fut2 = vec(); let futOn = false, fut2On = false, SO = null;   // (SO: the search's pivot — the person's own while the camera holds: room for THEM is the question)
  // (10-09b: a wide search — a hidden or pulled-in view — also asks for room 2 × armAhead s on, Fut2: a swing just past the wall now is
  // blocked again two steps on along it, and the search flip-flopped between such swings)
  function evalAt(a, p, len, lat, up) { const O = SO || Pc; let L = Math.min(len, armMax(a, p, len, lat, up, O)); if (futOn) L = Math.min(L, armMax(a, p, len, lat, up, Fut) + .3); if (fut2On) L = Math.min(L, armMax(a, p, len, lat, up, Fut2) + .6); camAt(a, p, L, lat, up, T, len, O); return { vis: 1 - fan(T, targets(PT, T)).wide / 5, L }; }
  function search(a, p, len, lat, up, wide = false) { const o = F().occl, W = o.w, m0 = F().distRange[0]; let best = null; searches++;
    const yaws = wide ? [...o.yaws, ...o.wideYaws] : o.yaws, cand = [0, ...yaws, ...yaws.map(x => -x)];
    // (10-09b) wide: BEHIND a walker is a candidate at half the yaw price (where they came from is open, and they walk away from it), and
    // the swing it holds now keeps a bonus (o.stick): a new one has to be clearly better, so the search no longer flip-flops along a wall
    const back = wide && w && (w.vc ?? 0) > .25 && !w.fix && hdC !== null ? wrap(hdC + Math.PI - a) : null, cur = asT.az || asT.pt ? asT.az : null;
    if (back !== null) cand.push(back); if (cur !== null && !cand.includes(cur)) cand.push(cur);
    fut2On = wide && futOn; put(Fut2, Fut.x + (Fut.x - Pc.x), Fut.y, Fut.z + (Fut.z - Pc.z));
    for (const dy of cand) for (const dp of [0, o.lift, -o.drop]) { const e = evalAt(a + dy, p + dp, len, lat, up);   // (a drop: under an awning)
      const sc = (dy === back ? -.5 * W.yaw * Math.abs(dy) : 0) + (dy === cur && dp === asT.pt ? -(o.stick ?? 0) : 0) + W.vis * (1 - e.vis) + W.yaw * Math.abs(dy) + W.pitch * Math.abs(dp) + W.len * Math.max(0, len - e.L) / dist + W.short * Math.max(0, m0 - e.L) / m0 + closeCost(e.L, len) + (flip && dy && Math.sign(dy) !== flip ? W.flip : 0);
      if (!best || sc < best.sc - 1e-9) best = { sc, az: dy, pt: dp, len: 0 }; }
    camAt(a, p, len, lat, up, T2, len, SO || Pc); targets(PT, T2); const h = world.ray(PT[1], T2, STATIC_WIDE);   // (the pull-in: to the first wall from the chest)
    if (h) { const want = Math.max(F().distRange[0], h.t * Math.hypot(T2.x - PT[1].x, T2.y - PT[1].y, T2.z - PT[1].z) - .3);
      fut2On = false; if (want < len - .1) { const e = evalAt(a, p, want, lat, up), sc = W.vis * (1 - e.vis) + W.len * (len - want) / dist + W.short * Math.max(0, m0 - e.L) / m0 + closeCost(Math.min(want, e.L), len); if (sc < best.sc) best = { sc, az: 0, pt: 0, len: want - len }; } }
    fut2On = false; return best; }
  // ── a POST in the way: side-step round it, on one side (picked when the step starts: the side that sees past it now and `ahead` s on,
  // the shoulder's side on a tie) until it is passed. The post on the line of sight → the full step; at the body → the least that clears
  // it; neither, now or ahead, from where the camera would be without a step → back to none. A step that would bring a wall onto the arm
  // is not taken.
  let side = 1; const Fd = vec();
  function probe(a, p, len, L, lat, up, vx, vz, s) { const k = F().dodge.ahead; camAt(a, p, len, lat + s, up, T, L); put(T2, T.x + vx * k, T.y, T.z + vz * k);
    const cl = Math.min(world.distance(T, .6, STATIC), world.distance(T2, .6, STATIC)), thin = fan(T, targets(PT, T)).thin + fan(T2, targets(PT2, T2, vx * k, vz * k)).thin;
    return { cl, thin, arm: s ? Math.min(armMax(a, p, L, lat + s, up), armMax(a, p, L, lat + s, up, put(Fd, Pc.x + vx * k, Pc.y, Pc.z + vz * k)) + .05) : L }; }   // (camera build 2c: room for the arm now and `ahead` s on — a sign on the post is solid at its height)
  function solveDodge(a, p, len, L, lat, up, vx, vz) { const d = F().dodge, need = d.clear + .15, r = F().radius; dodges++;
    const z = probe(a, p, len, L, lat, up, vx, vz, 0), ok = q => q.arm >= Math.min(L, armColl) - .05; if (!z.thin && z.cl >= need) return 0;
    const C2 = []; for (const s of d.steps) C2.push(side * s); for (const s of d.steps) C2.push(-side * s);
    const Q = C2.map(s => ({ s, ...probe(a, p, len, L, lat, up, vx, vz, s) })).filter(ok);
    if (z.thin) { const top = Q.filter(q => q.cl >= r + .05).sort((x, y) => x.thin - y.thin || (Math.sign(y.s) === side) - (Math.sign(x.s) === side) || Math.abs(y.s) - Math.abs(x.s))[0];   // (sees past it best, this side, the full step)
      if (top && top.thin < z.thin) { side = Math.sign(top.s); return top.s; } }
    const body = Q.filter(q => q.cl >= need)[0] || Q.sort((x, y) => y.cl - x.cl)[0];   // (the least step that clears the body, this side first; else the clearest)
    if (body && body.cl > z.cl) { side = Math.sign(body.s); return body.s; }
    return 0; }
  // the view angle toward a target angle (auto-motion only): the target's own motion moves the view, its speed ≤ rate, its change ≤ acc
  // and that change's ≤ jerk·dt (F4); what those limits hold back is an OFFSET from the target, taken back to 0 by an exact critically
  // damped spring (half-life hl; slower for a big offset, so its pull stays ≤ acc). Exact when the target moves smoothly.
  // FOLLOW WOBBLE (10-09): open loop on purpose. The old tracker steered on its own error through the acc and jerk limits: a relay loop
  // that rang ±6–12° at about 1.5 Hz after any kick at 60 Hz and never settled at 120 Hz (slime's "fast wobble left and right" on zooms).
  // Nothing here reads the view's error back, so it cannot overshoot or ring. s = { w, a, o, ov }: speed, its change, offset, offset speed.
  function track(s, tgt, prev, dt, rate, acc, jerk, hl) {
    const d = wrap(tgt - prev); let a = clamp((d / dt - s.w) / dt, -acc, acc); if (jerk > 0) a = clamp(a, s.a - jerk * dt, s.a + jerk * dt);
    const w1 = clamp(s.w + a * dt, -rate, rate); s.a = (w1 - s.w) / dt; s.w = w1;
    S1.x = s.o - (d - w1 * dt); S1.v = s.ov; spring(S1, 0, Math.max(hl, 2 * Math.LN2 * Math.sqrt(Math.abs(S1.x) / acc)), dt); s.o = S1.x; s.ov = S1.v;
    return wrap(tgt + s.o); }
  // a direct frame (input, a cut, the enter glide): the view on the target, its speed the target's own
  const onTarget = (s, w) => { s.w = w; s.a = 0; s.o = 0; s.ov = 0; };

  // some swing round the person with room for the shortest arm at P (the cut's candidates): where a held camera can cut to
  function roomAny(P, p, L, m0) { for (const dy of [0, .52, -.52, 1.05, -1.05, 1.57, -1.57, 2.1, -2.1, Math.PI]) if (armMax(wrap(az + dy), p, L, latOf(L, 0), 0, P) >= m0 - .05) return true; return false; }
  function resetAssists() { zero(sAz, sPt, sLen, sDodge, sLift, sClose); asT.az = asT.pt = asT.len = 0; dodgeT = liftT = 0; occT = clrT = 0; flip = 0; }
  const Ca = vec(), Cr = vec();   // (the cut's look ahead along the subject's way; the arm's own point this frame, before the cushions)
  // re-enter at once at the subject, at the viewer's angle and distance: a switch that can't glide, a lost person found far off, a hold
  // that lost them (10-09: a cut no longer puts the camera back behind them; az is not touched unless it is not a number)
  function cut() { anchor(w, A); put(Pv, A.x, A.y, A.z); put(PvV, 0, 0, 0); put(Pc, A.x, A.y, A.z); put(PcV, 0, 0, 0); put(Pg, A.x, A.y, A.z); put(Bo, 0, 0, 0); hold = false; coupled = true; relT = 0; cpOk = false; put(La, 0, 0, 0); put(LaV, 0, 0, 0);
    if (!Number.isFinite(az)) az = w ? wrap(heading(w) + Math.PI) : 0; if (!Number.isFinite(pt)) pt = ownPitch(); if (!Number.isFinite(dist)) dist = ownDist();
    hdC = null; sArm.x = Math.max(F().distRange[0], dist); sArm.v = 0; resetAssists(); glide = 1e9; ent.t = 1e9; view.ok = false; cuts++;
    // (camera build 2c) a cut lands where the arm has room and the person is in view: the viewer's angle first, then behind a walker, then
    // swung further round.
    // The swing is the wall search's assist (sAz, asT.az), not a new angle: once the view at the viewer's angle is clear it swings back.
    // (10-09) Room = the hold's release margin (m0 + .2, probed past the arm) where they are and hold.ahead s on along their way: a swing
    // with less trips the hold again at once, and with the angle no longer reset behind them that looped (hold, cut, hold) along a wall
    if (w) { const m0 = F().distRange[0], L = sArm.x, LP = Math.max(L, m0 + .25), lat0 = latOf(L, 0), h0 = heading(w), k = ((w.vc ?? 0) > .25 && !w.fix ? w.vc : 0) * F().hold.ahead;
      put(Ca, Pc.x + Math.sin(h0) * k, Pc.y, Pc.z + Math.cos(h0) * k); let best = null; const back = k ? wrap(h0 + Math.PI - az) : null;   // (behind a walker: the way they came is open)
      for (const dy of [0, ...(back === null ? [] : [back]), .52, -.52, 1.05, -1.05, 1.57, -1.57, 2.1, -2.1, Math.PI]) { const a = wrap(az + dy), r = armMax(a, pt, LP, lat0, 0), room = k ? Math.min(r, armMax(a, pt, LP, lat0, 0, Ca)) : r; camAt(a, pt, Math.min(L, r), lat0, 0, T, L);
        const sc = (room >= m0 + .2 ? closeCost(Math.min(L, room), L) : 10 + m0 + .2 - room + (back !== null && dy !== back ? 1 : 0)) + (fan(T, targets(PT, T)).wide >= 3 ? 5 : 0) + (dy === back ? Math.min(.25, Math.abs(dy) * .5) : Math.abs(dy) * .5); if (!best || sc < best.sc) best = { sc, dy, r }; if (sc === 0) break; }   // (10-09b: no room anywhere → behind a walker, where they came from and walk away from: the viewer's angle put a held camera in their way)
      sAz.x = asT.az = best.dy; flip = Math.sign(best.dy); sArm.x = Math.min(L, best.r); } fresh = true; }
  function pushHistory(x) { history.push(x); if (history.length > 32) history.shift(); }
  // a subject switch (Tab, G, click, a lost person found): ≤ switchGlideMax with a clear line from the pivot → the pivot glides; else a cut
  function switchTo(x, push = true) { if (!x || x === w) return x; if (push && w) pushHistory(w); w = x; aid = x.agent ? x.aid : null; lost = 0; hdC = null;
    if (!entered) return x; anchor(x, A);
    if (Math.hypot(A.x - Pv.x, A.y - Pv.y, A.z - Pv.z) <= F().switchGlideMax && !world.ray(Pv, A, STATIC)) { glide = 0; if (hold) { hold = false; relT = 0; } put(Pg, A.x, A.y, A.z); } else cut();   // (a held camera lets go: it glides to the new person)
    return x; }

  function step(dt, I) {
    const f = F(); now += dt; const live = dt > 0;
    // ── the subject: one who vanished is waited for (an agent comes back under the same id), then the nearest is followed
    if (w && w.gone) { const x = aid ? people.byAid(aid) : null; if (x) w = x; else { last.set(w.p[0], w.p[1], w.p[2]); w = null; lost = 1e-6; } }
    // (C2, GAME.md §41, slime 10-30: "you lost the continuity of following an agent": an AGENT is never swapped for the nearest
    // stranger. Out of view (indoors, out of range) the camera holds where it was last, at the viewer's angle and distance, until it is
    // drawn again or the viewer picks someone else. A city walker that vanishes is still followed on by the nearest after lostWait)
    if (!w && live) { lost += dt; let x = aid ? people.byAid(aid) : null; if (!x && !aid && lost > f.lostWait) x = people.nearest(last.x, last.z, null, 120); if (x) switchTo(x, false); }
    if (w) last.set(w.p[0], w.p[1], w.p[2]);
    // ── indoors: the room's view or the follow's (C2-camera)
    indoors(dt);
    // ── orbit input: straight onto the angles and the distance (no lag, D6)
    let dYaw = 0, dPitch = 0, dDist = 0;
    if (I) { const s = CAM.look.base * CAM.look.sens * 1.4, inv = CAM.look.invertY ? -1 : 1;
      dYaw -= I.look.x * s; dPitch += I.look.y * s * inv;
      dYaw += (I.wheelX || 0) * s;   // (10-09: a trackpad's two-finger swipe sideways, or Shift-wheel, orbits like a drag; up and down stays distance)
      dYaw += ((I.any('KeyA', 'ArrowLeft', 'KeyQ') ? 1 : 0) - (I.any('KeyD', 'ArrowRight', 'KeyE') ? 1 : 0)) * f.orbitRate * dt - I.rate.x * f.orbitRate * dt;
      dPitch += ((I.any('KeyW', 'ArrowUp') ? 1 : 0) - (I.any('KeyS', 'ArrowDown') ? 1 : 0)) * f.orbitRate * .6 * dt + I.rate.y * inv * f.orbitRate * .6 * dt;
      dDist = I.wheel * .0011 + ((I.key('KeyF') ? 1 : 0) - (I.key('KeyR') ? 1 : 0)) * 1.1 * dt - (I.pad ? I.move.z * 1.1 * dt : 0); }
    // (inside, the viewer's input orbits and zooms the room's view: its own offsets; the follow's angle, pitch and distance stay as left)
    if (CW.src === 'room' && (dYaw || dPitch || dDist)) { const r = R(); CW.yaw = clamp(CW.yaw + dYaw, -r.yaw, r.yaw); CW.pitch = clamp(CW.pitch + dPitch, r.pitch[0], r.pitch[1]);
      CW.zoom = clamp(CW.zoom * Math.exp(dDist), r.zoom[0], r.zoom[1]); dYaw = dPitch = dDist = 0; }
    const input = !!(dYaw || dPitch || dDist);
    az = wrap(az + dYaw); pt = clamp(pt + dPitch, f.pitchRange[0], f.pitchRange[1]);
    if (dDist) dist = clamp(dist * Math.exp(dDist), f.distRange[0], f.distRange[1]);
    if (dDist || dPitch) keepView();   // (the viewer's distance and pitch: the only place they are set)
    const hdc = w ? headingC(w, dt) : 0;
    // ── the pivot: shoulder height, springs (xz quick, y slow: curbs and the gait filtered); a switch glides it over, eased back
    if (wantCut && w) { cut(); cutAt = now; } wantCut = false;   // (a held camera that lost the person: a deliberate cut, decided last frame)
    anchor(w, A); const g = glide < f.switchT ? smootherstep(glide / f.switchT) : 1; glide += dt;
    const hx = f.switchHL + (f.pivotHL[0] - f.switchHL) * g, hy = f.switchHL + (f.pivotHL[1] - f.switchHL) * g;
    for (const [k, h] of [['x', hx], ['y', hy], ['z', hx]]) { S1.x = Pv[k]; S1.v = PvV[k]; spring(S1, A[k], h, dt); Pv[k] = S1.x; PvV[k] = S1.v; }
    // ── the CAMERA's pivot Pc (camera build 2c): the subject's pivot, except in a TIGHT SPACE (a doorway, a shelter, a corridor under an
    // awning: no room for the shortest arm there, now or hold.ahead s on): it brakes to a stop at the last spot with room (a spring onto
    // it — no velocity step) and holds there, framing the person; when their own pivot has room again it glides back (an offset spring
    // to 0, so no lag behind a walker) — re-acquired. The arm never goes under distRange[0] for want of room (F11)
    const hd2 = f.hold;
    if (coupled || !live) { put(Pc, Pv.x, Pv.y, Pv.z); put(PcV, PvV.x, PvV.y, PvV.z); }
    else if (hold) for (const k of ['x', 'y', 'z']) { S1.x = Pc[k]; S1.v = PcV[k]; spring(S1, Hp[k], hd2.hl, dt); Pc[k] = S1.x; PcV[k] = S1.v; }
    else { let n2 = 0; for (const k of ['x', 'y', 'z']) { S1.x = Pc[k] - Pv[k]; S1.v = PcV[k] - PvV[k]; spring(S1, 0, hd2.backHL, dt); Pc[k] = Pv[k] + S1.x; PcV[k] = PvV[k] + S1.v; n2 += S1.x * S1.x + S1.v * S1.v * .01; }
      if (n2 < 1e-8) coupled = true; }
    // ── the look point: the pivot, a little ahead of a walker (their velocity × lookAhead s, ≤ lookAheadMax m), sprung
    const moving = !!w && (w.vc ?? 0) > .25 && !w.fix, hd = hdc, vc = moving ? w.vc : 0, vx = Math.sin(hd) * vc, vz = Math.cos(hd) * vc, la = Math.min(vc * f.lookAhead, f.lookAheadMax);
    for (const [k, t] of [['x', Math.sin(hd) * la], ['z', Math.cos(hd) * la]]) { S1.x = La[k]; S1.v = LaV[k]; spring(S1, t, f.lookAheadHL, dt); La[k] = S1.x; LaV[k] = S1.v; }
    put(Lk, Pv.x + La.x, Pv.y + .1, Pv.z + La.z);
    // ── auto-motion (no input), from last frame's findings: the wall assist, the post step, the lift over people, the close-arm look over
    // the shoulder — all acceleration-limited, all on top of the viewer's angles (10-09: no drift back behind a walker; az is the viewer's)
    const prev = { a: sAz.x, p: sPt.x, l: sLen.x, d: sDodge.x, u: sLift.x };
    // BRAKE (camera build 2c, predictive): where this auto-motion takes the arm in brakeAhead s (each auto velocity held) — a swing that
    // would bring a wall onto the arm faster than the arm may come in is braked now, at the motions' own acceleration limits, and stops
    // short of the wall: the slide-undo below (a velocity step) is left as the backstop
    brake = false;
    if (live && !input && ent.t >= ent.dur && w) { const tau = f.brakeAhead, LA = Math.max(f.distRange[0], dist + sLen.x + sLen.v * tau);
      const cA = armMax(wrap(az + sAz.x + sAz.v * tau), clamp(pt + sClose.x + sPt.x + sPt.v * tau, -1.4, 1.45), LA, latOf(LA, sDodge.x + sDodge.v * tau), sLift.x);
      brake = cA < Math.min(sArm.x, LA) - f.brakeSlack; if (brake) brakes++; }
    const o = f.occl, ah = asT.az || asT.pt || asT.len ? o.inHL : o.outHL, d = f.dodge;
    chase(sAz, brake ? sAz.x : asT.az, ah, o.rate[0], o.rate[1], dt); chase(sPt, brake ? sPt.x : asT.pt, ah, o.rate[0], o.rate[1], dt); chase(sLen, asT.len, ah, f.armRate[0], f.armRate[1], dt);
    chase(sDodge, dodgeT, Math.abs(dodgeT) >= Math.abs(sDodge.x) ? d.inHL : d.outHL, d.rate[0], d.rate[1], dt); chase(sLift, liftT, f.liftHL, d.rate[0], d.rate[1], dt);
    spring(sClose, f.closeLift.max * clamp((f.closeLift.from - sArm.x) / (f.closeLift.from - f.distRange[0]), 0, 1), .25, dt);   // (sprung: it tilts the swept arm)
    // ── the arm: the viewer's angles + the assists + the enter glide; swept (walls and cars cap it at once; it eases back out)
    ent.t += dt; const ek = ent.t < ent.dur ? 1 - smootherstep(ent.t / ent.dur) : 0;
    let aE = wrap(az + sAz.x), pB = pt + sClose.x, pE = clamp(pB + sPt.x + ent.pt * ek, -1.4, 1.45);
    Ls = Math.max(f.distRange[0], dist + sLen.x) + ent.len * ek; let lat = latOf(Ls, sDodge.x);
    armColl = armMax(aE, pE, Ls, lat, sLift.x);
    // ahead: the arm from where the pivot will be in armAhead s (an awning they walk under, a wall they near) — eased in before it arrives
    // (camera build 2b: from the pivot's REAL motion — its spring velocity — not the walker's facing × speed: a sidestep into a bus shelter
    // or a turn at a corner moves them across their facing, and that is where the walls come from)
    const mvx = hold ? 0 : PvV.x, mvz = hold ? 0 : PvV.z, mv = Math.hypot(mvx, mvz) > .25 && live;
    // (10-09b: at the angle the wall assist's swing will have reached by then — at most rate × armAhead on toward its aim — so a swing
    // under way round a wall doesn't also pull the arm in ahead of a wall it is swinging away from)
    const aS = asT.az !== sAz.x ? wrap(aE + clamp(asT.az - sAz.x, -f.occl.rate[0] * f.armAhead, f.occl.rate[0] * f.armAhead)) : aE;
    const soft = mv ? armMax(aS, pE, Ls, lat, sLift.x, put(T2, Pc.x + mvx * f.armAhead, Pc.y, Pc.z + mvz * f.armAhead)) : Ls;
    // the hold: room at the subject's own pivot, now and hold.ahead s on (from its real motion); none → hold at the last spot with room.
    // (10-09) The room is probed at least m0 + .25 m out, whatever the arm: zoomed all the way in (an arm of m0) the probe could never
    // pass its own m0 + .05 test, so the camera held for good and cut every few seconds — with the zoom kept, that would follow the viewer
    rN = 1e9; if (live && w && ek === 0) { const m0 = f.distRange[0], sp = Math.hypot(PvV.x, PvV.z) > .25, LP = Math.max(Ls, m0 + .25); rN = armMax(aE, pE, LP, lat, sLift.x, Pv); const
        rA = sp ? armMax(aE, pE, LP, lat, sLift.x, put(T2, Pv.x + PvV.x * hd2.ahead, Pv.y, Pv.z + PvV.z * hd2.ahead)) : rN;
      if (!hold) { if (rN < m0 + .05 || rA < m0 + .05) { hold = true; coupled = false; relT = 0; holds++; const g = rN < m0 + .05 && Math.hypot(Pg.x - Pc.x, Pg.y - Pc.y, Pg.z - Pc.z) < 4 ? Pg : Pc; put(Hp, g.x, g.y, g.z); }   // (the last spot with room: here, or where the person last had it)
        else put(Pg, Pv.x, Pv.y, Pv.z);
        // (C2-camera3, docs/redesign/camera-20261104.md A) the glide back from a hold keeps the hold's reach: a pivot more than
        // hold.max from the person has lost them (at 10x a walker gets 6 m ahead of the glide round a corner, the camera then
        // looking at them through a wall), so it cuts
        if (!hold && !coupled && Math.hypot(Pv.x - Pc.x, Pv.z - Pc.z) > hd2.max) wantCut = true; }
      else { relT = rN >= m0 + .2 && rA >= m0 + .1 ? relT + dt : 0; hOcc = visW < f.occl.vis ? hOcc + dt : 0;
        if (relT >= hd2.release) { hold = false; if (world.ray(Pc, Pv, STATIC_WIDE)) wantCut = true; }   // (back to them — through open air only)
        // (C2-camera3, docs/redesign/camera-20261104.md A) lost them — out of the hold's reach, or hidden where they have room — cuts
        // whatever the cool: at 10x the hold trips again right after each cut, and the cool kept a held camera looking through a wall
        // at someone 12 m off for a second. The cool still limits the cuts that trade one held view for another (stuck; came back past)
        else if (Math.hypot(Pv.x - Pc.x, Pv.z - Pc.z) > hd2.max || (hOcc >= hd2.cutOcc && roomAny(Pv, pE, Ls, m0) && (!sp || roomAny(put(T2, Pv.x + PvV.x * hd2.ahead, Pv.y, Pv.z + PvV.z * hd2.ahead), pE, Ls, m0)))
          || (now - cutAt > hd2.cool && (hOcc >= hd2.cutStuck || Math.hypot(C.x - Pv.x, C.y - Pv.y, C.z - Pv.z) < m0 - .1))) wantCut = true; } }   // (hidden once through it, where they have room: cut; … or they came back past it)   // (they went through a wall, or on out of reach: cut to them)
    // auto-motion slides along a wall rather than cutting the arm: when this frame's auto-motion alone would snap the arm in, it is undone
    // (camera build 2c: OFF by default — the undo zeroed every auto velocity in one frame, a 100–300 m/s² step (F3); the arm's rate-limited
    // chase and the hold now carry it)
    if (f.slideUndo && live && !input && ek === 0 && armColl < sArm.x - f.armRate[0] * dt - .01) {   // (prev: last frame's auto parameters)
      const pE0 = clamp(pB + prev.p, -1.4, 1.45), a0 = wrap(az + prev.a), L0 = Math.max(f.distRange[0], dist + prev.l), lat0 = latOf(L0, prev.d), c0 = armMax(a0, pE0, L0, lat0, prev.u);
      if (c0 > armColl + .02) { sAz.x = prev.a; sPt.x = prev.p; sLen.x = prev.l; sDodge.x = prev.d; sLift.x = prev.u; sAz.v = sPt.v = sLen.v = sDodge.v = sLift.v = 0;
        aE = a0; pE = pE0; Ls = L0; lat = lat0; armColl = c0; slides++; } }
    // (camera build 2c) no instant arm: shortening is predicted (the pivot's look-ahead, the hold, the search) and rate-limited — a wall onto
    // the arm brings it in fast (cutRate) but continuously; the eased look-ahead never takes it under the shortest arm (the hold does that
    // job). Only the viewer's own orbit input may put the arm straight at a wall it swung into (the move is theirs).
    const ta = Math.min(Ls, armColl), tb = Math.min(ta, Math.max(soft + .3, f.distRange[0]));
    if (!live || fresh) { sArm.x = ta; sArm.v = 0; fresh = false; }   // (a cut: the new pose at once)
    // (C2-camera2) the ENTER GLIDE owns the arm: down the line of sight in parameter space, the arm on its length (eased: smootherstep, so
    // no velocity step at either end). The rate-limited chase below crawled in at 3 m/s behind the glide (an 85 m glide after a reload:
    // ~27 s of the camera far off, behind the walls of the room the agent was in). A wall that caps the arm mid-glide (the person moved
    // off the glide's line: at 60x a skater does in a frame) brings it in no faster than the glide's own pace this frame plus the wall
    // chase's rate (cutRate): taken at once it was a 58 m step in one frame (glideprobe)
    else if (ek > 0) { const gd = Math.max(0, gL - Ls) + f.cutRate[0] * dt, gu = Math.max(0, Ls - gL) + f.armRate[0] * dt, to = clamp(ta, sArm.x - gd, sArm.x + gu); sArm.v = (to - sArm.x) / dt; sArm.x = to; }
    else if (input && ta < sArm.x && armColl < Ls - 1e-4 && world.overlap(camAt(aE, pE, sArm.x, lat, sLift.x, T, Ls), f.radius, STATIC_WIDE | CARS)) { sArm.x = ta; sArm.v = 0; snaps++; }   // (input swung the body into a wall)
    else if (ta < sArm.x - f.armRate[0] * dt && armColl < Ls - 1e-4) chase(sArm, ta, .02, f.cutRate[0], f.cutRate[1], dt);   // (a wall onto the arm: in fast, still continuous)
    else chase(sArm, tb, tb < sArm.x ? f.armInHL : f.armOutHL, tb < sArm.x || !moving ? f.armRate[0] : Math.min(f.armRate[0], .45 * vc), f.armRate[1], dt);   // (out behind a walker: slower than half their pace — never a stall)
    gL = Ls; camAt(aE, pE, sArm.x, lat, sLift.x, C, Ls);
    // ── the BODY round posts (camera build 2c): THIN spans never shorten the arm, so the step round a post (below) is the plan and this the
    // guarantee — the camera's own motion into a thin span's cushion (body.r + body.cushion) loses its approaching part smoothly (none left
    // at body.r: it slides round), and an offset so made decays back (body.hl). A cushion, not a clamp: no jump where a face flips (D4)
    put(Cr, C.x, C.y, C.z);   // (the arm's own point, before the cushions: the wall test below)
    const bd = f.body; { const k = decay(bd.hl, dt); put(T, C.x + Bo.x * k, C.y + Bo.y * k, C.z + Bo.z * k);
      if (live && cpOk) { let mx = T.x - Cp.x, my = T.y - Cp.y, mz = T.z - Cp.z; const o2 = world.overlap(Cp, bd.r + bd.cushion, STATIC_THIN);
        if (o2) { const d0 = bd.r + bd.cushion - o2.depth, n = o2.n, mn = mx * n[0] + my * n[1] + mz * n[2]; bodyN++;
          if (mn < 0) { const q = 1 - smootherstep((d0 - bd.r) / bd.cushion); mx -= n[0] * mn * q; my -= n[1] * mn * q; mz -= n[2] * mn * q; }
          let ov = d0 < bd.r ? (bd.r - d0) * (1 - decay(bd.pushHL, dt)) / dt : 0; ov = clamp(ov, pushV - bd.pushAcc * dt, pushV + bd.pushAcc * dt); pushV = Math.max(0, ov);   // (out at a speed that grows with the depth, its change ≤ pushAcc: no step)
          if (pushV > 0) { const out = pushV * dt; mx += n[0] * out; my += n[1] * out; mz += n[2] * out; } }
        else pushV = Math.max(0, pushV - bd.pushAcc * dt);
        const o3 = bd.cushionWide > 0 && world.overlap(Cp, bd.rWide + bd.cushionWide, STATIC_WIDE);   // (and a thinner one round every other solid: a guard while the arm's rate-limited chase is still coming in)
        if (o3) { const d0 = bd.rWide + bd.cushionWide - o3.depth, n = o3.n, mn = mx * n[0] + my * n[1] + mz * n[2]; bodyN++;
          if (mn < 0) { const q = 1 - smootherstep((d0 - bd.rWide) / bd.cushionWide); mx -= n[0] * mn * q; my -= n[1] * mn * q; mz -= n[2] * mn * q; }
          if (d0 < bd.rWide) { const out = (bd.rWide - d0) * (1 - decay(bd.pushHL, dt)); mx += n[0] * out; my += n[1] * out; mz += n[2] * out; } }
        put(T, Cp.x + mx, Cp.y + my, Cp.z + mz); }
      put(Bo, T.x - C.x, T.y - C.y, T.z - C.z); put(C, T.x, T.y, T.z); put(Cp, C.x, C.y, C.z); cpOk = live; }
    // (C2-camera4, docs/redesign/camera-20261104-c.md A) THE CAMERA ON ITS ARM'S SIDE OF EVERY WALL, decided from this frame's pose: the
    // cushions above keep the camera out of a solid by holding it back from where its arm puts it, and an arm that swings or slides past a
    // wall's end leaves it held on the wall's far side, the lens against the wall, looking at the person through it (a05 at 10x, 6661.18:
    // 0.6 s of one flat colour, the arm itself clear). A wall on the line from the arm's root to the camera put out puts the camera onto
    // its arm at once, this frame (camera-20261104-c.md A': a cut only when that place is walled off too — A's cut every time looped
    // along a facade at 10x) (the arm's root as armMax has it; a root inside a solid is the crushed arm's, left to the hold and the search)
    if (live && w && ek === 0) { const dx = Cr.x - Pc.x, dy = Cr.y - Pc.y, dz = Cr.z - Pc.z, D = Math.hypot(dx, dy, dz) || 1, k0 = Math.min(.5, D * .5) / D; put(R0, Pc.x + dx * k0, Pc.y + dy * k0, Pc.z + dz * k0);
      if (!world.overlap(R0, .1, STATIC_WIDE) && world.ray(R0, C, STATIC_WIDE)) { walled++;
        // (onto the arm's own swept place, at once: the cushion's offset dropped and the arm in to the place the chase aims at, the room it
        // will have armAhead s on — "the body in a wall → in at once", one snap, not a run; a cut when that place is walled off too, or when
        // this would be the third snap within 1 s: camera-20261104-c.md addendum 2)
        const L = Math.min(sArm.x, tb); camAt(aE, pE, L, lat, sLift.x, T, Ls);
        if (!world.ray(R0, T, STATIC_WIDE) && !(now - snapT[0] < 1)) { snapT[0] = snapT[1]; snapT[1] = now; snapM = Math.hypot(T.x - C.x, T.y - C.y, T.z - C.z); snapMax = Math.max(snapMax, snapM); sArm.x = L; sArm.v = 0; put(Bo, 0, 0, 0); put(C, T.x, T.y, T.z); }
        else { cut(); cutAt = now; walledCut++; snapT[0] = snapT[1] = -1e9; camAt(wrap(az + sAz.x), clamp(pt, -1.4, 1.45), sArm.x, latOf(sArm.x, 0), 0, C); }
        put(Cp, C.x, C.y, C.z); } }
    // ── findings for the next frames, from where the camera is: the line of sight (walls: the search; posts: the step), people
    const fv = fan(C, targets(PT, C)); vis = visW = 1 - fv.wide / 5; thinN = fv.thin;
    const crushed = armColl < Math.min(Ls, f.distRange[0]) - .05 || (o.crushAhead && soft < Math.min(Ls, f.distRange[0]) - .05) || (hold && rN < f.distRange[0] - .05); if (crushed) vis = Math.min(vis, .4);   // (crushed, now or within armAhead s: a wall at the pivot leaves no room for the arm — search at once, as if hidden, over wide swings)
    // (10-09b) PULLED: a wall pulls the arm under occl.pull × the viewer's distance, now or armAhead s on — searched as a hidden view is
    // (over the wide swings too), so a short swing round them can win over a close pull-in at the blocked angle
    const pa = pullAt(dist), pq = Math.min(Ls, pa) - .05, pulled = o.pull > 0 && ek === 0 && pa > f.distRange[0] + .05 && (armColl < pq || (o.crushAhead && mv && (soft < pq
      || armMax(aS, pE, Ls, lat, sLift.x, put(T2, Pc.x + mvx * f.armAhead * 2, Pc.y, Pc.z + mvz * f.armAhead * 2)) < pq - .3))); pullN += pulled ? 1 : 0;   // (and 2 × armAhead s on: a swing round a corner takes a second or two)
    if (live && w) {
      if (vis < o.vis || pulled) { occT += dt; clrT = 0; } else { clrT += dt; occT = 0; }
      if (occT >= (crushed && o.crushNow ? 0 : o.minTime) && ek === 0 && now - searchAt >= o.every) { searchAt = now; futOn = mv && o.crushAhead; put(Fut, Pc.x + mvx * f.armAhead, Pc.y, Pc.z + mvz * f.armAhead);
        SO = hold ? Pv : null; const b = search(az, pB, Math.max(f.distRange[0], dist), latOf(dist, sDodge.x), sLift.x, crushed || pulled); futOn = false; SO = null; asT.az = b.az; asT.pt = b.pt; asT.len = b.len; if (b.az) flip = Math.sign(b.az); }
      else if (clrT >= o.clearTime && !o.holdRelease) asT.az = asT.pt = asT.len = 0;
      else if (clrT >= o.clearTime && (asT.az || asT.pt || asT.len) && now - searchAt >= o.every) { searchAt = now; futOn = mv && o.crushAhead; put(Fut, Pc.x + mvx * f.armAhead, Pc.y, Pc.z + mvz * f.armAhead);   // (released only when the view WITHOUT it is clear and has room: else it swings back into the wall it left)
        fut2On = futOn; put(Fut2, Pc.x + mvx * f.armAhead * 2, Pc.y, Pc.z + mvz * f.armAhead * 2);   // (10-09b: room two steps on too, as the trigger asks)
        const m0 = f.distRange[0], e = evalAt(az, pB, Math.max(m0 + .25, dist), latOf(dist, sDodge.x), sLift.x); futOn = fut2On = false; if (e.vis >= o.vis && e.L >= Math.max(m0 + .2, o.pull > 0 ? dist * o.pullOut : 0)) asT.az = asT.pt = asT.len = 0; }   // (10-09b: and pullOut × their distance: else it swings back into the pull it left)
      // (10-09) room at the viewer's angle means the hold's own release margin (m0 + .2), probed past the arm: with the angle now the
      // viewer's for good, a release onto a wall the hold trips on (< m0 + .05) swung back and forth along it (hold, cut, release …)
      let need = thinN > 0 || dodgeT !== 0;
      if (!need) need = world.distance(C, .6, STATIC) < d.clear + .15 || (moving && world.distance(put(T2, C.x + vx * d.ahead, C.y, C.z + vz * d.ahead), .6, STATIC) < d.clear + .15);
      if (need && now - dodgeAt >= d.every) { dodgeAt = now; dodgeT = solveDodge(aE, pE, sArm.x, Ls, lat - sDodge.x, sLift.x, vx, vz); }
      // people: a walker at the camera → rise over their head; the subject's own axis → over their head too
      let lt = 0; const base = C.y - sLift.x * (Ls > 1e-6 ? sArm.x / Ls : 0);
      if (world.distance(put(T2, C.x, w.p[1] + 1.4, C.z), .3, PEOPLE, w) < f.peopleClear - .32) lt = Math.min(f.peopleLiftMax, w.p[1] + 1.75 + .35 - base);
      if (Math.hypot(C.x - w.p[0], C.z - w.p[2]) < .5) lt = Math.max(lt, w.p[1] + hgt + .5 - base);
      // cars (camera build 2c): out of the arm — one turning or passing behind the person moves faster than the arm may (never a snap,
      // never a 1.3 m arm): the camera cranes over one on its arm instead (the least lift that clears it, as it does over people)
      if (world.sweep(Pc, camAt(aE, pE, sArm.x, lat, 0, T, Ls), f.radius, CARS)) { for (const up of f.carLift) if (!world.sweep(Pc, camAt(aE, pE, sArm.x, lat, up, T, Ls), f.radius, CARS)) { lt = Math.max(lt, up); break; } }
      // a sign, a box or an awning OVER the arm, now or armAhead s on (camera build 2c): duck under it (a negative lift) rather than pull in
      let duck = 0; if (lt <= 0 && Math.min(armColl, soft) < Ls - .3) { const fut = mv ? put(T2, Pc.x + mvx * f.armAhead, Pc.y, Pc.z + mvz * f.armAhead) : Pc;
        for (const up of f.duck) if (armMax(aE, pE, Ls, lat, up) >= Ls - .05 && armMax(aE, pE, Ls, lat, up, fut) >= Ls - .05) { duck = up; break; } }
      liftT = duck < 0 ? duck : Math.max(0, lt);
    }
    if (live && world.overlap(C, .1, STATIC_WIDE | CARS)) safety++;   // (counted only: the camera sits on the swept segment — no clamp after the smoothing, D4; a push-out here was tried and jumps where a column's nearest face flips)
    if (!(Number.isFinite(C.x + C.y + C.z + Pv.x + Pv.y + Pv.z + sArm.x + Ls + az + pE))) {   // (a non-finite parameter: report it once, re-enter at the subject)
      if (!nanSeen++) console.warn('follow: non-finite state, re-entering', JSON.stringify({ C, Pv, arm: sArm.x, Ls, az, pt, pE, dodge: sDodge.x, lift: sLift.x, as: [sAz.x, sPt.x, sLen.x], sub: w && w.p, vc: w && w.vc, ent }));
      cut(); camAt(wrap(az + sAz.x), clamp(pt, -1.4, 1.45), sArm.x, latOf(sArm.x, 0), 0, C); }
    pose.p.set(C.x, C.y, C.z);
    // ── the view: at the look point; its auto-motion limited (a leftover pop is eased), input never
    const fx = Lk.x - C.x, fy = Lk.y - C.y, fz = Lk.z - C.z, fl = Math.hypot(fx, fy, fz) || 1, ty = Math.atan2(-fx, -fz), tp = Math.asin(clamp(fy / fl, -1, 1));
    if (!view.ok || !live || input || ek > 0) { const on = view.ok && live; onTarget(view.Y, on ? wrap(ty - view.ty) / dt : 0); onTarget(view.P, on ? (tp - view.tp) / dt : 0); view.yaw = ty; view.pitch = tp; view.ok = true; }
    else { view.yaw = track(view.Y, ty, view.ty, dt, f.autoRate, f.autoAcc, f.autoJerk, f.viewHL); view.pitch = track(view.P, tp, view.tp, dt, f.autoRate, f.autoAcc, f.autoJerk, f.viewHL); }
    view.ty = ty; view.tp = tp; E3.set(view.pitch, view.yaw, 0, 'YXZ'); pose.q.setFromEuler(E3);
    // (C2-camera: the follow's pose, then what is put out: it, the room's view, or the ease between)
    FP.p.copy(pose.p); FP.q.copy(pose.q); FP.piv.set(Lk.x, Lk.y, Lk.z); compose();
    if (live) pose.fov = damp(pose.fov, f.fov, .2, dt);
    focus.copy(last); return pose;
  }

  return {
    name: 'follow', pose, focus,
    get dbg() { return { vpitch: pt, ty: view.ty, vyaw: view.yaw, viewOff: view.Y.o, hd: hdC, az, allowed: hold || !coupled ? Math.min(sArm.x, Math.hypot(C.x - Pv.x, C.y - Pv.y, C.z - Pv.z)) : sArm.x, arm: sArm.x, brakes, hold, held: Math.hypot(Pc.x - Pv.x, Pc.y - Pv.y, Pc.z - Pv.z), holds, body: bodyN, dist: Ls, want: dist, armColl, L: [Pc.x, Pc.y, Pc.z], pitch: clamp(pt + sPt.x, -1.4, 1.45), vis, thin: thinN, dodge: sDodge.x, lift: sLift.x, assist: { az: sAz.x, pt: sPt.x, len: sLen.x }, glide, enter: ent.t < ent.dur, safety, cuts, snaps, slides, searches, dodges, pulled: pullN, aim: { az: asT.az, pt: asT.pt, len: asT.len }, brake, walled, walledCut, snapM, snapMax, coupled, Pv: [Pv.x, Pv.y, Pv.z], hOcc, relT, cutAt, now,
      room: { src: CW.src, ease: CW.t < CW.dur ? +(CW.t / CW.dur).toFixed(3) : 1, hold: CW.holdT >= 0, room: CW.room, yaw: CW.yaw, pitch: CW.pitch, zoom: CW.zoom, frame: CW.fr && { pos: CW.fr.pos.toArray(), tgt: CW.fr.tgt.toArray() }, k: CW.k, ...CW.n }, pivot: [Lk.x, Lk.y, Lk.z] }; },
    get subject() { return w; }, get lost() { return lost > 0; }, get distance() { return dist; }, get entering() { return ent.t < ent.dur; },
    set(subject) { if (!subject) return false; switchTo(subject); return true; },
    back() { while (history.length) { const h = history.pop(); const x = h.gone && h.agent ? people.byAid(h.aid) : h.gone ? null : h; if (x) return switchTo(x, false); } return null; },
    // into follow from another mode: 'glide' (down the line of sight from `from`, in parameter space, onto the viewer's distance), 'cut'
    // (that line is blocked or too long, or no `from`), false (nobody to follow). The rig blends the view only on a glide.
    enter(from, subject) {
      if (subject && subject !== w) { if (w) pushHistory(w); w = subject; aid = subject.agent ? subject.aid : null; lost = 0; }
      if (!w) return false; const f = F(); entered = true;
      // (C2-camera: into follow onto someone at home → the room's view; a room not open yet holds the camera where it was)
      CW.src = 'follow'; CW.t = CW.dur = 1e-6; CW.holdT = -1; CW.aid = null; CW.walkIn = false; OUT.ok = !!from; OUT.pivOk = false; if (from) { OUT.p.copy(from.p); OUT.q.copy(from.q); } last.set(w.p[0], w.p[1], w.p[2]); anchor(w, A);
      put(Pv, A.x, A.y, A.z); put(PvV, 0, 0, 0); put(Pc, A.x, A.y, A.z); put(PcV, 0, 0, 0); put(Pg, A.x, A.y, A.z); put(Bo, 0, 0, 0); hold = false; coupled = true; relT = 0; cpOk = false; put(La, 0, 0, 0); put(LaV, 0, 0, 0); resetAssists(); glide = 1e9; view.ok = false; pt = ownPitch(); pose.fov = f.fov; hdC = null;   // (dist and pitch: the viewer's, kept — 10-09: a shot handing back, Esc and 3 again)
      const dx = from ? from.p.x - A.x : 0, dy = from ? from.p.y - A.y : 0, dz = from ? from.p.z - A.z : 0, len = Math.hypot(dx, dy, dz);
      let how = 'cut'; if (from && len > 1 && len < f.enterMax && !world.sweep(A, from.p, f.radius, STATIC_WIDE | CARS)) how = 'glide';
      if (how === 'glide') { az = Math.atan2(dx, dz); ent.t = 0; ent.dur = clamp(f.enterT[0] + len / 40, f.enterT[0], f.enterT[1]); ent.pt = Math.atan2(dy, Math.hypot(dx, dz)) - pt; ent.len = len - dist; sArm.x = len; }
      else { az = wrap(heading(w) + Math.PI); ent.t = 1e9; ent.pt = ent.len = 0; sArm.x = dist; }
      sArm.v = 0; step(0, null); return how; },
    update(dt, I) { return step(dt, I); },
    // the next person within cycleRadius of the one followed, nearest first, skipping the ones already visited this round
    next(dir = 1) {
      if (dir < 0) return this.back();
      const c = w ? w.p : [last.x, last.y, last.z], R2 = F().cycleRadius ** 2, seen = new Set(history.slice(-12)), list = [];
      for (const x of people.all()) { if (x === w || x.gone || !x.tier) continue; const d = (x.p[0] - c[0]) ** 2 + (x.p[2] - c[2]) ** 2; if (d < R2) list.push([d, x]); }
      list.sort((a, b) => a[0] - b[0]); const pick = (list.find(([, x]) => !seen.has(x)) || list[0])?.[1]; if (pick) switchTo(pick); return pick || null; },
    nextAgent() { const L = people.all().filter(x => x.agent && !x.npc && !x.gone).sort((a, b) => String(a.aid).localeCompare(String(b.aid))); if (!L.length) return null;
      const k = w?.agent ? L.findIndex(x => x.aid === w.aid) : -1, x = L[(k + 1) % L.length]; switchTo(x); return x; },
    drop() { w = null; aid = null; history = []; lost = 0; entered = false; CW.src = 'follow'; CW.t = CW.dur = 1e-6; CW.holdT = -1; CW.aid = null; OUT.ok = false; },
  };
}
