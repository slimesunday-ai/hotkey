// CAMERA PASS (2026-10-05) · THE CAMERA RIG: one camera system, five modes, eased hand-offs between them.
//   ORBIT  the map: three's MapControls (drag moves, right- or shift-drag turns, scroll zooms) + nav.js keys (eased now), the views and
//          Go-to. The rig only watches here: nav.update before the frame, controls.update after it, exactly as before
//   FLY    fly.js: a free camera with weight on the collision world (world.js): buildings, posts, people and cars solid; a speed governor
//          (no wall slam), collide-and-slide, depenetration; raw mouse-look in pointer lock (camera build 3/4)
//   FOLLOW follow.js: a third-person camera on a walker or a live sim agent, smoothed in parameter space on the collision world
//          (world.js); click a person, Tab for the next one. Its pose is made in the LATE step, after the walkers moved
//   PHOTO  photo.js: every bit of UI hidden, the free camera with photo tuning (or the follow camera, F), depth of field, stills, clips
//   WALK   not built here: a first-person mode registers with rig.register('walk', controller) (the hook below) and key 5 enters it
//   LOCK   lock.js (C2-lock, slime 11-04): on a person, the viewer's angle and zoom fixed to the world and carried with them; what is in
//          the way goes see-through (fade.js's hole) instead of the camera moving. Registered through register('lock'); key 6, the card's
//          Lock. In from follow it stays where it is (handoff 'own': no blend); out to follow the blend is RELATIVE to the person (the
//          from pose rides with them, so a hand-off at 10× never trails), with the hole easing away under it. Its pose is made in the LATE
//          step too. Clicks, Tab, [ ] and G switch its subject, as in follow
// HAND-OFFS: every switch blends from the camera's pose at that moment to the new mode's live pose (which keeps moving while it eases:
// a walker keeps walking), smoothstep over min…max s by distance, rising in an arc on long hops. Into FOLLOW the travel is follow's own
// (down the line of sight in parameter space, collision-correct every frame, or a cut; RESEARCH §4.7): the blend only turns the view,
// ≤ follow.blendIn s, and `blending` stays true until follow's glide is done. A subject switch while following is follow's (glide or cut). Into orbit it eases to a fixed pose
// (a view, or the point the camera looks at) and hands MapControls a camera that is already there. The views ease too; Go-to stays
// a cut behind the load-in. controls.target is the focus in every mode (the walkers, traffic, haze and shadows live round it), so the
// stream, walkers and shadows follow the camera whatever drives it. Settings: camera/config.js. Shots (?shot) never create the rig.
//
// A controller (the WALK hook): { name, pose: { p: Vector3, q: Quaternion, fov }, focus: Vector3, enter(fromPose, opts) → bool,
//   update(dt, intent) → pose, exit?(), hud?() → string (the indicator's line), keys?: [[key, what], …] (the help overlay) }.
//   intent (input.js take()): move {x right, y up, z forward}, look {x, y} px, rate {x, y} (sticks), wheel, boost, slow, key(code), any(…).
//   rig.world (camera/world.js: the column-interval collision world with walkers and cars; fly, follow, the person picker and the
//   autofocus ray use it — solid.js's slab grid is retired) and rig.people are there for it to use. main.js calls rig.late after the walkers
//   moved (api.late): follow's pose is made there (?camlate=0: in update, the old order).
import * as THREE from 'three';
import { CAM, loadPrefs } from './config.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createFly } from './fly.js';
import { createFollow, createPeople } from './follow.js';
import { createLock } from './lock.js';
import { setFade } from './fade.js';
import { createHud } from './hud.js';
import { createPhoto } from './photo.js';
import { DOF_LIVE } from '../render/dof.js';
import * as S from '../render/settings.js';

const smooth = x => x * x * x * (x * (x * 6 - 15) + 10);   // smootherstep: no velocity or acceleration step at either end
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), M = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3();

export function createCameraRig(api, { Q } = {}) {
  loadPrefs();
  const { camera, controls, renderer, nav } = api, el = renderer.domElement;
  const people = createPeople(() => api.peds), world = createWorld(api);   // (world.js: the collision world — fly, follow, the picker and the autofocus on it)
  const LATE = Q?.get?.('camlate') !== '0'; let deferred = null;   // (camera build: follow poses in the LATE step, after the walkers moved; ?camlate=0 = the old order)
  // (C2-camera: the record's homes, once loaded, say whether a followed agent is inside and frame its open room: interiors/city/record.js
  // cutaway; follow.js rises to that view while it is inside)
  const rooms = { of: aid => api.recordHomes?.cutaway?.(aid) ?? null };
  const fly = createFly(world), free = createFly(world, { photo: true }), follow = createFollow(world, people, rooms), extra = new Map(), lock = createLock(world, people);
  let mode = 'orbit', ctrl = null, blend = null, photoSub = 'free', photoFrom = 'orbit', perf = { ms: 0, max: 0, n: 0 }, frame = 0, focusD = null;
  const from = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50 }, fromFocus = new THREE.Vector3(), dest = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50, tgt: new THREE.Vector3() };
  const fixed = { name: 'orbit', pose: { p: dest.p, q: dest.q, fov: 50 }, focus: dest.tgt, update() { this.pose.fov = dest.fov; return this.pose; } };
  let onDone = null;

  const input = createInput(el, { onClick, onPad, onLock: (l, err) => { hud.lock(l, err); } });
  const rig = {};
  const hud = createHud(rig), photo = createPhoto(api, rig, hud);

  const snap = o => { o.p.copy(camera.position); o.q.copy(camera.quaternion); o.fov = camera.fov; o.v = null; return o; };
  // the camera's own velocity (last frame's move), handed to fly / the free photo camera when they take over from a moving mode (follow,
  // photo, fly), so the hand-off glides on and eases to a stop instead of halting dead (camera build 3/4, RESEARCH §4.7)
  const camV = new THREE.Vector3(), lastCam = new THREE.Vector3(); let lastDt = 0, haveLast = false;
  const moving = (o, was) => { if ((was === 'follow' || was === 'photo' || was === 'fly') && camV.length() < 30) o.v = camV; return o; };
  function startBlend(dist = null, cap = Infinity, rel = null) { snap(from); fromFocus.copy(controls.target); const pose = ctrl.pose, d = dist ?? from.p.distanceTo(pose.p), a = from.q.angleTo(pose.q);
    const dur = Math.min(cap, d < .5 && a < .05 ? .25 : Math.min(CAM.blend.max, CAM.blend.min + d * CAM.blend.perMetre + a * .25));
    blend = { t: 0, dur, arc: d > 80 && cap === Infinity ? Math.min(CAM.blend.arcMax, d * CAM.blend.arc) : 0, rel: null };
    // (C2-lock: out of lock the from pose rides with the person — its offset from them, kept — so the hand-off never trails a walker)
    if (rel?.p) { blend.rel = rel; blend.off = new THREE.Vector3(from.p.x - rel.p[0], from.p.y - rel.p[1], from.p.z - rel.p[2]); blend.fromF = new THREE.Vector3(fromFocus.x - rel.p[0], fromFocus.y - rel.p[1], fromFocus.z - rel.p[2]); blend.hole = rel; } }
  // into follow: already following → a subject switch (follow's glide or cut); else follow's own hand-off from this pose (a glide down
  // the line of sight, the blend only turning the view; or a cut)
  function intoFollow(subject) { if (ctrl === follow && follow.subject) { if (subject) follow.set(subject); return; }
    const was = ctrl; ctrl = follow; const how = follow.enter(snap(from), subject);
    // (C2-lock: from lock — glide or cut — a blend relative to the person, CAM.lock.outT s: no jump either way)
    if (was === lock && follow.subject) startBlend(null, how === 'glide' ? Math.max(CAM.follow.blendIn, CAM.lock.outT) : CAM.lock.outT, follow.subject);
    else if (how === 'glide') startBlend(null, CAM.follow.blendIn); else blend = null; }
  // (C1-8: a press MapControls saw whose release it never got — a click on a person stops the pointerup — left it mid-drag, and once
  // it had the camera again every mouse move panned it. Taking the camera, or handing it back, ends MapControls' gesture)
  function endGesture() { const c = controls; if (!c._pointers?.length) return; const doc = el.ownerDocument;
    if (c._onPointerMove) doc.removeEventListener('pointermove', c._onPointerMove); if (c._onPointerUp) doc.removeEventListener('pointerup', c._onPointerUp);
    for (const id of c._pointers) { try { el.releasePointerCapture(id); } catch {} } c._pointers.length = 0; for (const k in c._pointerPositions || {}) delete c._pointerPositions[k]; c.state = -1; }
  function leaveOrbit() { if (mode !== 'orbit') return; api.homes?.current && api.homes.close({ instant: true }); endGesture(); controls.enabled = false; input.active = true; api.clearFixedShadow?.(); }
  // ── switching
  function setMode(next, o = {}) {
    if (next === 'photo' && mode === 'photo' && !o.subject) return setMode(photoFrom);
    if (next === mode && next !== 'orbit' && !o.subject) return true;
    if (next === 'walk' && !extra.has('walk')) { hud.toast('first-person walk isn’t built yet'); return false; }
    if (next === 'lock' && mode === 'lock' && o.subject) { lock.set(o.subject); hud.mode(mode); return true; }
    if (next === 'follow' || next === 'lock' || (next === 'photo' && o.subject)) { const cur = ctrl === lock ? lock.subject : ctrl === follow ? follow.subject : null;
      const s = o.subject || cur || follow.subject || people.pick(camera, 0, 0, 160, world, 90) || people.nearest(controls.target.x, controls.target.z, null, 90);
      if (!s && !follow.subject) { hud.toast(api.peds ? 'no one to follow here: click a person, or come closer' : 'the walkers are off (?peds=0)'); return false; } o.subject = s; }
    const was = mode; if (was === 'photo' && next !== 'photo') photo.exit();
    if (next === 'orbit') return toOrbit(o);
    leaveOrbit(); if (was === 'fly' && next !== 'fly') input.unlock();
    if (next === 'fly') { ctrl = fly; fly.enter(moving(snap(from), was)); blend = null; if (o.lock !== false) input.lock(); }
    else if (next === 'follow') { const keep = mode === 'photo' && photoSub === 'follow' && !o.subject; if (!keep) intoFollow(o.subject); ctrl = follow; }
    else if (next === 'photo') { if (was !== 'photo') photoFrom = was; photoSub = o.subject || (was === 'follow' && follow.subject) ? 'follow' : 'free';
      if (photoSub === 'follow') { const go = o.subject || was !== 'follow'; if (go) intoFollow(o.subject); ctrl = follow; } else { free.enter(moving(snap(from), was)); ctrl = free; blend = null; }
      if (was !== 'photo') photo.enter(); }
    else { const c = extra.get(next); if (!c.enter(snap(from), o)) return false; ctrl = c; if (c.handoff === 'own') blend = null; else startBlend(); }
    mode = next; hud.mode(mode); return true;
  }
  // into the map: ease to a fixed pose (a view, or the ground point the camera looks at), then hand MapControls a camera that is there
  function toOrbit(o = {}) {
    const was = mode; if (was === 'fly') input.unlock(); if (was === 'photo') photo.exit();
    if (o.instant) { blend = null; ctrl = null; finishOrbit(); if (was !== 'orbit') hud.mode('orbit'); return true; }
    if (o.view) { dest.p.set(...o.view.pos); dest.tgt.set(...o.view.tgt); dest.fov = o.view.fov ?? camera.fov; }
    else { FWD.set(0, 0, -1).applyQuaternion(camera.quaternion); const p = camera.position, h = Math.max(.5, p.y);
      let t = FWD.y < -.08 ? h / -FWD.y : Math.max(30, h * 1.5); t = Math.min(t, 420); dest.tgt.copy(p).addScaledVector(FWD, t); dest.tgt.y = 0;
      dest.p.copy(p); if (dest.p.y < dest.tgt.y + 1.2) dest.p.y = dest.tgt.y + 1.2; dest.fov = 50; }
    M.lookAt(dest.p, dest.tgt, UP); dest.q.setFromRotationMatrix(M);
    if (was === 'orbit') { leaveOrbit(); mode = 'orbit'; } else mode = 'orbit';
    controls.enabled = false; input.active = false; ctrl = fixed; onDone = o.done || null; startBlend(); hud.mode('orbit'); return true;
  }
  function finishOrbit() {
    if (ctrl === fixed) { camera.position.copy(dest.p); controls.target.copy(dest.tgt); if (camera.fov !== dest.fov) { camera.fov = dest.fov; camera.updateProjectionMatrix(); } }
    controls._sphericalDelta?.set(0, 0, 0); controls._panOffset?.set(0, 0, 0); if (controls._scale !== undefined) controls._scale = 1; endGesture();
    ctrl = null; blend = null; mode = 'orbit'; input.active = false; controls.enabled = true; controls.update();
    const f = onDone; onDone = null; f?.();
  }
  // ── per frame: before the frame (pose) and after it (orbit's controls.update, the clip's frame)
  let failed = 0;
  function update(dt) { try { step(dt); } catch (e) { if (failed++ < 3) console.error('camera rig:', e); try { toOrbit({ instant: true }); } catch {} } }   // (a bug here must never stop the frame loop)
  function step(dt) {
    const t0 = performance.now(); dt = Math.min(Math.max(dt, 0), .1); frame++; world.tick(camera.position);
    if (haveLast && lastDt > 0) camV.subVectors(camera.position, lastCam).divideScalar(lastDt); else camV.set(0, 0, 0); lastCam.copy(camera.position); lastDt = dt; haveLast = true;
    if (deferred) { const d = deferred; deferred = null; pose(d.dt, d.I); }   // (a late step that never ran: apply it now)
    if (mode === 'orbit' && !blend) { nav.update(dt); setFade(camera.position, null, { dt }); }
    else { const I = input.active ? input.take() : null; if (LATE && (ctrl === follow || ctrl === lock)) deferred = { dt, I }; else pose(dt, I); }
    autofocus(dt); photo.tick(dt); hud.tick(dt, frame);
    const ms = performance.now() - t0; perf.n++; perf.ms += (ms - perf.ms) * .05; perf.max = Math.max(perf.max * .998, ms);
  }
  // the pose of the frame: the controller, and the hand-off blend into it
  function pose(dt, I) {
    { const pose = ctrl.update(dt, blend && ctrl === fixed ? null : I);
      if (blend) { blend.t += dt; const k = smooth(Math.min(1, blend.t / blend.dur));
        // (a relative blend: the from pose rides with the person, whatever carries them now — follow's subject, a ride's stand-in)
        const r = blend.rel && (ctrl === follow && follow.subject?.p ? follow.subject : blend.rel), fp = r ? V.set(r.p[0], r.p[1], r.p[2]).add(blend.off) : from.p, ff = r ? V2.set(r.p[0], r.p[1], r.p[2]).add(blend.fromF) : fromFocus;
        camera.position.lerpVectors(fp, pose.p, k); if (blend.arc) camera.position.y += blend.arc * 4 * k * (1 - k);
        camera.quaternion.slerpQuaternions(from.q, pose.q, k); setFov(from.fov + (pose.fov - from.fov) * k); controls.target.lerpVectors(ff, ctrl.focus, k);
        if (k >= 1) { blend = null; if (ctrl === fixed) finishOrbit(); } }
      else { camera.position.copy(pose.p); camera.quaternion.copy(pose.q); setFov(pose.fov); controls.target.copy(ctrl.focus); }
    }
    // (10-09b: the camera fade — the near zone, and the line to the person followed; C2-lock: and the hole, to the person locked on, kept
    // through the hand-off out of lock and then eased away)
    const on = ctrl === follow ? follow.subject : ctrl === lock ? lock.subject : null;
    setFade(camera.position, on, { dt, hole: ctrl === lock ? lock.subject : blend?.hole && blend.rel ? (follow.subject || blend.rel) : null });
  }
  // LATE (main.js frame(), after traffic and walkers updated, before the render): follow's pose from this frame's walker positions
  function late() { world.invalidate(); if (!deferred) return; const d = deferred; deferred = null; const t0 = performance.now();
    try { pose(d.dt, d.I); } catch (e) { if (failed++ < 3) console.error('camera rig:', e); try { toOrbit({ instant: true }); } catch {} }
    const ms = performance.now() - t0; perfL.n++; perfL.ms += (ms - perfL.ms) * .05; perfL.max = Math.max(perfL.max * .998, ms); }
  const perfL = { ms: 0, max: 0, n: 0 }; api.late = dt => rig.late(dt);
  function after() { if (mode === 'orbit' && !blend) controls.update(); try { photo.afterRender(); } catch (e) { if (failed++ < 3) console.error('camera rig:', e); } }
  const setFov = f => { if (Math.abs(camera.fov - f) > 1e-3) { camera.fov = f; camera.updateProjectionMatrix(); } };
  // ── autofocus for the depth of field (render/dof.js): the person followed · fly and photo: the centre of the frame (a person near the
  // centre ray first, else the collision world, else the ground) · orbit: the target. Racked smoothly (in log distance).
  function autofocus(dt) {
    const v = S.get('dof'); if (!v || !v.on || !v.auto) { DOF_LIVE.focus = null; focusD = null; return; }
    let d = null;
    if ((ctrl === follow || ctrl === lock) && (ctrl.subject)) { const w = ctrl.subject; d = Math.hypot(w.p[0] - camera.position.x, w.p[1] + 1.2 - camera.position.y, w.p[2] - camera.position.z); }
    else if (mode === 'orbit') d = camera.position.distanceTo(controls.target);
    else if (frame % 3 === 0 || focusD === null) { FWD.set(0, 0, -1).applyQuaternion(camera.quaternion); V2.copy(camera.position).addScaledVector(FWD, 400); const h = world.ray(camera.position, V2, world.STATIC); d = h ? Math.max(.5, h.t * 400) : 400;
      for (const w of people.all()) { if (!w.tier || w.tier > 2) continue; V.set(w.p[0] - camera.position.x, w.p[1] + 1 - camera.position.y, w.p[2] - camera.position.z); const t = V.dot(FWD); if (t < .5 || t > d) continue;
        V2.copy(FWD).multiplyScalar(t); if (V2.distanceTo(V) < Math.max(.5, t * .025)) d = t; } }
    if (d === null) return; d = Math.max(.4, d);
    focusD = focusD === null || !dt ? d : Math.exp(Math.log(focusD) + (Math.log(d) - Math.log(focusD)) * (1 - Math.exp(-dt / CAM.photo.focusSmooth)));
    DOF_LIVE.focus = focusD;
  }
  // ── clicks: a person → follow them (in photo: switch the subject); fly: the first click locks the mouse, then the crosshair picks
  function onClick(e, button) {
    if (button !== 0 || api.homes?.editing) return;   // (home builder: a click in edit mode is the builder's)
    if (mode === 'fly' && !input.locked) { e.stopImmediatePropagation(); input.lock(); return; }
    const r = el.getBoundingClientRect(), nx = mode === 'fly' ? 0 : (e.clientX - r.left) / r.width * 2 - 1, ny = mode === 'fly' ? 0 : -((e.clientY - r.top) / r.height * 2 - 1);
    const w = people.pick(camera, nx, ny, e.pointerType === 'touch' ? 26 : 14, world);
    if (w) { e.stopImmediatePropagation(); if (mode === 'photo') setMode('photo', { subject: w }); else if (mode === 'lock') { lock.set(w); hud.toast('locked on ' + people.label(w)); hud.mode(mode); return; } else setMode('follow', { subject: w }); hud.toast('following ' + people.label(w)); return; }
    if (mode !== 'orbit') e.stopImmediatePropagation();   // (homes open from the map only)
  }
  // ── gamepad buttons (standard mapping): A follow / next · B back to the map · X still (photo) / previous · Y photo · Start fly · Back help
  function onPad(i) {
    if (i === 0) { if (mode === 'follow') { follow.next(1); hud.mode(mode); } else setMode('follow'); }
    else if (i === 1) { if (mode === 'photo') setMode(photoFrom); else if (mode !== 'orbit') setMode('orbit'); }
    else if (i === 2) { if (mode === 'photo') photo.still(); else if (mode === 'follow') { follow.next(-1); hud.mode(mode); } }
    else if (i === 3) setMode('photo');
    else if (i === 9) setMode(mode === 'fly' ? 'orbit' : 'fly', { lock: false });
    else if (i === 8) hud.help();
    else if (i === 12 || i === 13) { (mode === 'photo' ? free : fly).nudgeSpeed(i === 12 ? 1.25 : .8); }
    else if (i === 14 || i === 15) { if (mode === 'follow') { follow.next(i === 15 ? 1 : -1); hud.mode(mode); } }
  }
  // ── keys
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  // Tab is the camera's (next person) only while the page itself has the focus: the body or the canvas (review 10-09 #7: with the focus
  // on the dossier or the menu, Tab jumped the camera to the next walker and the focus never moved)
  const pageFocus = e => { const t = e.target; return !t || t === document.body || t === document.documentElement || t === el; };
  // THE HELP IS MODAL: while it is open it takes every key before the UI and the camera (capture, added before the UI's keys: main.js
  // mounts ui/ after the rig), and nothing behind it hears one (the UI-keys leftover: keys moved the camera, opened panels and played
  // the tape behind it). Esc and ? close it (review 10-09 #12: Esc left TAPE and the help stayed open); Tab walks its own controls; its
  // slider and checkbox keep their keys; ⌘ / Ctrl keep the browser's
  addEventListener('keydown', e => { if (!hud.helpOpen) return; e.stopImmediatePropagation(); if (e.metaKey || e.ctrlKey) return;
    if (e.code === 'Escape' || e.key === '?' || (e.code === 'Slash' && e.shiftKey)) { e.preventDefault(); hud.help(false); return; }
    hud.trap(e); }, true);
  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey) return;
    const k = e.code, num = /^(Digit|Numpad)([1-6])$/.exec(k);
    if (e.key === '?' || (k === 'Slash' && e.shiftKey)) { e.preventDefault(); hud.help(); return; }
    if (k === 'Escape') { if (api.homes?.current) return;
      if (mode === 'photo') setMode(photoFrom); else if (mode !== 'orbit') setMode('orbit'); return; }
    if (num && !e.altKey) { const m = ['orbit', 'fly', 'follow', 'photo', 'walk', 'lock'][+num[2] - 1]; e.preventDefault(); if (m === 'photo' || m !== mode) setMode(m); return; }
    if (mode === 'photo' && photo.onKey(e)) return;
    if (ctrl === lock) {
      if (k === 'Tab' && !pageFocus(e)) return;
      if (k === 'Tab' || k === 'BracketRight' || k === 'BracketLeft') { e.preventDefault(); const w = lock.next(k === 'BracketLeft' || (k === 'Tab' && e.shiftKey) ? -1 : 1); hud.toast(w ? 'locked on ' + people.label(w) : 'no one else nearby'); hud.mode(mode); return; }
      if (k === 'KeyG') { const w = lock.nextAgent(); hud.toast(w ? 'locked on ' + people.label(w) : 'no sim agents here (?sim=live)'); hud.mode(mode); return; }
    }
    if (ctrl === follow) {
      if (k === 'Tab' && !pageFocus(e)) return;   // (a button or a field has the focus: Tab moves it on, the camera keeps its subject)
      if (k === 'Tab' || k === 'BracketRight' || k === 'BracketLeft') { if (mode === 'photo' && k !== 'Tab') return; e.preventDefault(); const w = follow.next(k === 'BracketLeft' || (k === 'Tab' && e.shiftKey) ? -1 : 1); if (w) hud.toast('following ' + people.label(w)); else hud.toast('no one else nearby'); hud.mode(mode); return; }
      if (k === 'KeyG') { const w = follow.nextAgent(); hud.toast(w ? 'following ' + people.label(w) : 'no sim agents here (?sim=live)'); hud.mode(mode); return; }
    }
    if (mode === 'photo' && k === 'KeyF') { if (photoSub === 'free') { if (follow.subject || people.pick(camera, 0, 0, 160, world, 90)) setMode('photo', { subject: follow.subject || people.pick(camera, 0, 0, 160, world, 90) }); }
      else { photoSub = 'free'; free.enter(moving(snap(from), 'photo')); ctrl = free; } hud.mode(mode); return; }
  });
  // ── the views (index.html's buttons) ease there; Go-to (nav.goTo) cuts, behind the load-in
  nav.onJump = () => { if (mode !== 'orbit' || blend) toOrbit({ instant: true }); };
  Object.defineProperties(rig, Object.getOwnPropertyDescriptors({   // (descriptors: the getters stay live)
    update, after, late, setMode, world, people, input, fly, follow, free, lock, config: CAM, hud, photo,
    get mode() { return mode; }, get blending() { return !!blend || (ctrl === follow && follow.entering); }, get subject() { return ctrl === lock ? lock.subject : follow.subject; }, get photoSub() { return photoSub; }, get ctrl() { return ctrl; },
    // THE PERSON WATCHED (C2-lock2): the one answer for everything outside the rig that asks whether a person is being watched (the
    // subway's carriage, the rides' stand-ins, the homes' room, the label, the card, the tape's focus and its restore, the reload): the
    // person Follow is on (follow, or photo on a person: photo's F), or the one Lock is on; null in the map, fly, free photo and walk.
    // It is the person the camera is on, drawn or not (a ride's stand-in under their id). In follow it is follow.subject, as it was
    get watched() { return mode === 'follow' || (mode === 'photo' && photoSub === 'follow') ? follow.subject : mode === 'lock' ? lock.subject : null; },
    // a ride's stand-in for the person watched (simstate/movement.js, stage/record.js): onto whichever camera watches them — follow's set
    // (as before), or lock's carry (at once, at the viewer's angle and distance; no glide, not a visit in Shift-Tab's history)
    carry(p) { if (!p) return null; return mode === 'lock' ? lock.carry(p) : follow.set(p); },
    view(k) { const v = api.VIEWS[k]; if (!v) return; api.clearFixedShadow?.(); toOrbit({ view: v, done: () => api.setView(k) }); },
    toOrbit, endGesture, register(name, c) { extra.set(name, c); hud.mode(mode); }, registered: name => extra.has(name),
    stats: () => ({ mode, blending: !!blend || (ctrl === follow && follow.entering), updateMs: +perf.ms.toFixed(4), updateMax: +perf.max.toFixed(3), lateMs: +perfL.ms.toFixed(4), lateMax: +perfL.max.toFixed(3), late: LATE, frames: perf.n, world: { ...world.stat }, speed: ctrl?.speed ?? 0, subject: people.label(follow.subject), focus: DOF_LIVE.focus }),
 
  }));
  rig.register('lock', lock);
  hud.mode(mode);
  return rig;
}
