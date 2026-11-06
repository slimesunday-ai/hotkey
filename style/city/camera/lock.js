// C2-lock (2026-11-04) · LOCK: the second way to watch a person (slime 11-04: "what if another setting just locked onto a subject and
// you could rotate and zoom around them instead of the camera trying to avoid everything and move so much?"; on walls: "see through is
// way better"). Follow (follow.js) stays exactly as it is; this registers beside it (rig.register('lock', …)).
//   THE ANGLE AND THE ZOOM ARE THE VIEWER'S, fixed to the world: a bearing, a pitch and a distance round the person's pivot (shoulder
//   height, follow's anchor). Only input writes them (drag / two-finger swipe / A D ← → Q E turn, W S ↑ ↓ tilt, wheel / pinch / R F
//   zoom); it never turns when the person turns. Kept in this browser (CAM.lock.viewerAz / viewerPitch / viewerDist), so the record's
//   day / night reload comes back to the same view.
//   CARRIED, NOT CHASED: the pivot is the person's own position this frame (the rig's LATE step, after the walkers moved), so the camera's
//   step is the person's step plus the viewer's input, at 1×, 10× and 60× alike: nobody runs out of frame. Nothing else moves it: no
//   avoidance, no hold, no cut, no automatic zoom. The one limit is the ground: the lens stays CAM.lock.floor m over their feet.
//   WHAT'S IN THE WAY GOES SEE-THROUGH: the rig hands fade.js this person (setFade's hole): the static city's fragments round the line
//   from the lens to their chest dissolve (gpu.js HOLE), and walkers and cars on it already do (fade.js THE LINE, CLEAR).
//   HAND-OFFS: in from follow (or anywhere within distRange) the camera stays exactly where it is — its offset from the person becomes
//   the viewer's angle and distance — and only the view turns onto them (viewT s). From further off it glides in along the line to
//   them, in parameter space (log distance, pitch: enterT s). Out to follow, the rig blends relative to the person (rig.js). A switch of
//   subject (a click, Tab, G, the card) to someone ≤ switchGlideMax m away with a clear line between glides the pivot over (switchT s);
//   otherwise, and on a seek or a ride's stand-in, the camera is on them at once, at the same angle and distance: never a glide through
//   walls. Someone who vanishes is waited for where they were (an agent under the same id, its ride's stand-in: people.byAid).
// A controller (rig.js): { name, pose, focus, enter(from, o), update(dt, intent), hud(), keys, handoff: 'own' } + subject, set, next,
// back, nextAgent, dbg (the last frame's steps: what the lock check measures).
import * as THREE from 'three';
import { CAM, savePrefs } from './config.js';
import { clamp, wrap, smootherstep, damp } from './damp.js';
import { STATIC } from './world.js';

const M4 = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), QL = new THREE.Quaternion();

export function createLock(world, people) {
  const K = () => CAM.lock;
  const pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: CAM.follow.fov }, focus = new THREE.Vector3();
  const piv = new THREE.Vector3(), A = new THREE.Vector3(), Ap = new THREE.Vector3(), last = new THREE.Vector3(), C0 = new THREE.Vector3(), prevCam = new THREE.Vector3();
  const glide = { t: 1e9, dur: 1, off: new THREE.Vector3() }, ent = { t: 1e9, dur: 1, ld: 0, el: 0 }, view = { t: 1e9, dur: 1, q0: new THREE.Quaternion() };
  let w = null, aid = null, history = [], hgt = 1.75, lost = 0, have = false, prevW = null;
  const ownDist = () => { const k = K(), v = +k.viewerDist; return clamp(Number.isFinite(v) && v > 0 ? v : k.dist, k.distRange[0], k.distRange[1]); };
  const ownPitch = () => { const k = K(), v = k.viewerPitch; return clamp(v !== null && Number.isFinite(+v) ? +v : k.pitch, k.pitchRange[0], k.pitchRange[1]); };
  let az = 0, el = ownPitch(), d = ownDist();
  let saveAt = 0; const keep = () => { const k = K(); k.viewerDist = +d.toFixed(3); k.viewerPitch = +el.toFixed(4); k.viewerAz = +az.toFixed(4); clearTimeout(saveAt); saveAt = setTimeout(savePrefs, 300); };
  // (the last frame, for the lock check: the camera's step, the person's (their pivot's), the input's share, and whether a hand-off or a
  // switch was moving the camera on top)
  const D = { cam: 0, sub: 0, input: 0, auto: false, swap: false, frames: 0, switches: 0, glides: 0, recentres: 0, held: 0 };
  // the pivot: the person's position (feet, or where they were last), at anchorH × their height; never under the street (follow's floorY)
  function anchor(x, out) { if (x) hgt = people.heightOf(x); const b = x ? x.p : [last.x, last.y, last.z]; return out.set(b[0], Math.max(b[1], CAM.follow.floorY) + K().anchorH * hgt, b[2]); }
  // the camera point round pivot P at bearing a, elevation e, distance r (the lens kept floor m over the feet at fy)
  function camAt(P, a, e, r, fy, out) { const em = Math.asin(clamp((fy + K().floor - P.y) / r, -1, 1)), ee = Math.max(e, em), ce = Math.cos(ee);
    return out.set(P.x + Math.sin(a) * ce * r, P.y + Math.sin(ee) * r, P.z + Math.cos(a) * ce * r); }
  const pushHistory = x => { history.push(x); if (history.length > 32) history.shift(); };

  function step(dt, I) {
    const k = K(), live = dt > 0;
    // ── the person: one who vanished is waited for (an agent under the same id, or its ride's stand-in); a city walker gives way to the
    // nearest after follow's lostWait, as follow does
    if (w && w.gone) { const x = aid ? people.byAid(aid) : null; if (x) w = x; else { last.set(w.p[0], w.p[1], w.p[2]); w = null; lost = 1e-6; } }
    if (!w && live) { lost += dt; let x = aid ? people.byAid(aid) : null; if (!x && !aid && lost > CAM.follow.lostWait) x = people.nearest(last.x, last.z, null, 120); if (x) { w = x; aid = x.agent ? x.aid : null; lost = 0; } }
    if (w) last.set(w.p[0], w.p[1], w.p[2]); else D.held++;
    const swap = have && w !== prevW; prevW = w;
    // ── input: straight onto the viewer's bearing, pitch and distance (follow's keys and gestures)
    const az0 = az, el0 = el, d0 = d; let dYaw = 0, dPitch = 0, dDist = 0;
    if (I) { const s = CAM.look.base * CAM.look.sens * 1.4, inv = CAM.look.invertY ? -1 : 1, r = k.orbitRate;
      dYaw -= I.look.x * s; dPitch += I.look.y * s * inv; dYaw += (I.wheelX || 0) * s;
      dYaw += ((I.any('KeyA', 'ArrowLeft', 'KeyQ') ? 1 : 0) - (I.any('KeyD', 'ArrowRight', 'KeyE') ? 1 : 0)) * r * dt - I.rate.x * r * dt;
      dPitch += ((I.any('KeyW', 'ArrowUp') ? 1 : 0) - (I.any('KeyS', 'ArrowDown') ? 1 : 0)) * r * .6 * dt + I.rate.y * inv * r * .6 * dt;
      dDist = I.wheel * .0011 + ((I.key('KeyF') ? 1 : 0) - (I.key('KeyR') ? 1 : 0)) * 1.1 * dt - (I.pad ? I.move.z * 1.1 * dt : 0); }
    az = wrap(az + dYaw); el = clamp(el + dPitch, k.pitchRange[0], k.pitchRange[1]); if (dDist) d = clamp(d * Math.exp(dDist), k.distRange[0], k.distRange[1]);
    if (dYaw || dPitch || dDist) keep();
    // ── the pivot: the person's, plus what is left of a switch's glide; the arm: the viewer's, plus what is left of the glide in
    Ap.copy(A); anchor(w, A);
    glide.t += dt; const gk = glide.t < glide.dur ? 1 - smootherstep(glide.t / glide.dur) : 0; piv.copy(A).addScaledVector(glide.off, gk);
    ent.t += dt; const ek = ent.t < ent.dur ? 1 - smootherstep(ent.t / ent.dur) : 0, fy = w ? w.p[1] : last.y;
    const arm = r0 => Math.exp(Math.log(r0) + ent.ld * ek);
    camAt(piv, az, el + ent.el * ek, arm(d), fy, pose.p); camAt(piv, az0, el0 + ent.el * ek, arm(d0), fy, C0);
    // ── the view: on the pivot; after a hand-off it turns there from where it was (the position never jumps, only the view eases)
    M4.lookAt(pose.p, piv, UP); QL.setFromRotationMatrix(M4); view.t += dt;
    if (view.t < view.dur) pose.q.slerpQuaternions(view.q0, QL, smootherstep(view.t / view.dur)); else pose.q.copy(QL);
    if (live) pose.fov = damp(pose.fov, CAM.follow.fov, .2, dt);
    if (live) { D.frames++; D.cam = have ? pose.p.distanceTo(prevCam) : 0; D.sub = have ? A.distanceTo(Ap) : 0; D.input = pose.p.distanceTo(C0); D.auto = gk > 0 || ek > 0; D.swap = swap; }
    prevCam.copy(pose.p); have = true;
    focus.copy(last); return pose;
  }

  // a switch of subject: a short clear hop glides the pivot over; else at once (the angle and the distance stay the viewer's)
  function switchTo(x, push = true) { if (!x || x === w) return x; if (push && w) pushHistory(w); const k = K(), from = piv.clone();
    w = x; aid = x.agent ? x.aid : null; lost = 0; last.set(x.p[0], x.p[1], x.p[2]); anchor(x, A); D.switches++;
    const dist = from.distanceTo(A); if (have && dist <= k.switchGlideMax && !world.ray(from, A, STATIC)) { glide.off.subVectors(from, A); glide.t = 0; glide.dur = clamp(k.switchT[0] + dist / 40, k.switchT[0], k.switchT[1]); D.glides++; }
    else { glide.t = 1e9; D.recentres++; }
    return x; }

  return {
    name: 'lock', pose, focus, handoff: 'own',
    get subject() { return w; }, get lost() { return !w; }, get distance() { return d; }, get angles() { return { az, el, d }; },
    get dbg() { return { ...D, az, el, d, glide: glide.t < glide.dur, enter: ent.t < ent.dur, view: view.t < view.dur, pivot: [piv.x, piv.y, piv.z] }; },
    // into lock: o.subject (or the one it had); o.restore: the viewer's kept angle and distance at once (a reload); else from `from`
    enter(from, o = {}) {
      const s = o.subject || w; if (!s) return false; if (s !== w && w) pushHistory(w); w = s; aid = s.agent ? s.aid : null; lost = 0; prevW = w; have = false;
      const k = K(); last.set(s.p[0], s.p[1], s.p[2]); anchor(s, A); piv.copy(A); glide.t = 1e9; ent.t = 1e9; view.t = 1e9;
      const dx = from ? from.p.x - A.x : 0, dy = from ? from.p.y - A.y : 0, dz = from ? from.p.z - A.z : 0, L = Math.hypot(dx, dy, dz);
      if (o.restore || !from || L < 1e-3) { const va = k.viewerAz; az = va !== null && Number.isFinite(+va) ? +va : L > 1e-3 ? Math.atan2(dx, dz) : wrap((s.yawS ?? s.p[3] ?? 0) + Math.PI); el = ownPitch(); d = ownDist(); }
      else { az = Math.atan2(dx, dz); const e0 = Math.asin(clamp(dy / L, -1, 1)); el = clamp(e0, k.pitchRange[0], k.pitchRange[1]);
        d = L >= k.distRange[0] && L <= k.distRange[1] ? L : ownDist(); ent.ld = Math.log(L) - Math.log(d); ent.el = e0 - el;
        if (Math.abs(ent.ld) > 1e-4 || Math.abs(ent.el) > 1e-4) { ent.t = 0; ent.dur = clamp(k.enterT[0] + Math.abs(ent.ld) * .5, k.enterT[0], k.enterT[1]); }
        view.q0.copy(from.q); view.t = 0; view.dur = Math.max(k.viewT, ent.t === 0 ? ent.dur : 0); keep(); }
      if (from?.fov) pose.fov = from.fov; step(0, null); return true; },
    update(dt, I) { return step(dt, I); },
    set(subject) { if (!subject) return false; switchTo(subject); return true; },
    // (C2-lock2) a ride's stand-in for the person locked on (rig.carry): on it at once, as for a walker who vanished (people.byAid)
    carry(x) { if (!x || x === w) return x; w = x; aid = x.agent ? x.aid : null; lost = 0; last.set(x.p[0], x.p[1], x.p[2]); glide.t = 1e9; return x; },
    back() { while (history.length) { const h = history.pop(); const x = h.gone && h.agent ? people.byAid(h.aid) : h.gone ? null : h; if (x) return switchTo(x, false); } return null; },
    // the next person within cycleRadius, nearest first, skipping the ones visited this round (follow's Tab)
    next(dir = 1) { if (dir < 0) return this.back();
      const c = w ? w.p : [last.x, last.y, last.z], R2 = K().cycleRadius ** 2, seen = new Set(history.slice(-12)), list = [];
      for (const x of people.all()) { if (x === w || x.gone || !x.tier) continue; const q = (x.p[0] - c[0]) ** 2 + (x.p[2] - c[2]) ** 2; if (q < R2) list.push([q, x]); }
      list.sort((a, b) => a[0] - b[0]); const pick = (list.find(([, x]) => !seen.has(x)) || list[0])?.[1]; if (pick) switchTo(pick); return pick || null; },
    nextAgent() { const L = people.all().filter(x => x.agent && !x.npc && !x.gone).sort((a, b) => String(a.aid).localeCompare(String(b.aid))); if (!L.length) return null;
      const i = w?.agent ? L.findIndex(x => x.aid === w.aid) : -1, x = L[(i + 1) % L.length]; switchTo(x); return x; },
    drop() { w = null; aid = null; history = []; lost = 0; have = false; },
    hud() { const L = people.label(w); return `${w ? 'locked on <b>' + L + '</b>' : 'lost them — waiting where they were'} · drag turn · wheel zoom · walls go see-through · <b>Tab</b> next · <b>3</b> follow · <b>Esc</b> map`; },
    keys: [['click a person', 'lock onto them'], ['Tab · Shift-Tab', 'next · previous person nearby'], ['G', 'next sim agent'], ['drag · two-finger swipe · A D · ← →', 'turn round them (fixed to the world: it never turns when they do)'], ['W S · ↑ ↓', 'higher · lower'], ['wheel · pinch · R F', 'closer · further'], ['3', 'back to follow'], ['what is in the way', 'goes see-through']],
  };
}
