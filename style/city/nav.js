// Walking the city: keys on top of MapControls (drag moves, right- or shift-drag turns, scroll zooms).
// WASD / arrows move across the ground in the direction the camera faces, Q / E turn around the focus point, R / F zoom,
// Shift is 3× faster. Speed scales with how far out the camera is, so it feels the same at street level and overhead.
// Camera pass (2026-10-05): the keys ease in and out (velocity, turn and zoom rates ramp over camera/config.js orbit.accel / brake: no
// steps, a glide to a stop), and goTo calls nav.onJump first (the camera rig hands back to the map before a Go-to cut).
import * as THREE from 'three';
import { kindAt, urban, P } from './plan.js';
import { CAM } from './camera/config.js';

const MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const KEYS = new Set([...Object.keys(MOVE), 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'ShiftLeft', 'ShiftRight']);

export function createNav({ camera, controls, onMove = () => {} }) {
  const held = new Set(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), off = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), vel = new THREE.Vector3(); let turnV = 0, zoomV = 0;
  const ease = (dt, on) => 1 - Math.exp(-dt / Math.max(1e-3, on ? CAM.orbit.accel : CAM.orbit.brake));
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '');
  addEventListener('keydown', e => { if (typing(e) || e.metaKey || e.ctrlKey || !KEYS.has(e.code)) return; held.add(e.code); if (MOVE[e.code]) e.preventDefault(); });
  addEventListener('keyup', e => held.delete(e.code));
  addEventListener('blur', () => held.clear());
  const nav = {
    onJump: null,
    update(dt) {
      if (!controls.enabled) { vel.set(0, 0, 0); turnV = zoomV = 0; return false; }
      if (!held.size && !turnV && !zoomV && vel.lengthSq() === 0) return false;
      dt = Math.min(dt, .05);
      const dist = camera.position.distanceTo(controls.target), fast = held.has('ShiftLeft') || held.has('ShiftRight') ? 3 : 1;
      let mx = 0, mz = 0, moved = false;
      for (const k of held) if (MOVE[k]) { mx += MOVE[k][0]; mz += MOVE[k][1]; }
      camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize(); right.crossVectors(fwd, up).normalize();
      const sp = Math.max(6, dist * .9) * fast;   // m/s (the old per-frame step, as a velocity the keys ease toward)
      off.copy(fwd).multiplyScalar(mz * sp).addScaledVector(right, mx * sp); vel.lerp(off, ease(dt, mx || mz));
      if (!(mx || mz) && vel.length() < .02 * Math.max(1, sp / 6)) vel.set(0, 0, 0);
      if (vel.lengthSq()) { off.copy(vel).multiplyScalar(dt); camera.position.add(off); controls.target.add(off); moved = true; }
      const turn = (held.has('KeyQ') ? 1 : 0) - (held.has('KeyE') ? 1 : 0); turnV += (turn * 1.4 - turnV) * ease(dt, turn); if (!turn && Math.abs(turnV) < .005) turnV = 0;
      if (turnV) { off.subVectors(camera.position, controls.target).applyAxisAngle(up, turnV * dt); camera.position.copy(controls.target).add(off); moved = true; }
      const zoom = (held.has('KeyF') ? 1 : 0) - (held.has('KeyR') ? 1 : 0); zoomV += (zoom * 1.2 - zoomV) * ease(dt, zoom); if (!zoom && Math.abs(zoomV) < .005) zoomV = 0;
      if (zoomV) { off.subVectors(camera.position, controls.target).multiplyScalar(Math.exp(zoomV * dt)); const d = off.length();
        if (d > controls.minDistance && d < controls.maxDistance) { camera.position.copy(controls.target).add(off); moved = true; } else zoomV = 0; }
      if (moved) onMove();
      return moved;
    },
    // frame a spot from about corner-rooftop height, keeping the current heading
    goTo(x, z, o = {}) {
      nav.onJump?.(); vel.set(0, 0, 0); turnV = zoomV = 0;
      // a place in the woods (the labs, the leaf clearing) is seen from nearly overhead, or the canopy hides it. Hardening pass: from
      // well above the canopy too — the woods' tallest pines reach ~19 m (forest/plan.js HMAX × 1.18), and 30 m at 1.2 rad put the camera
      // 9 m over them with crowns filling the frame (Go to → the west shack read as landing in the trees). 44 m at 1.25 rad: 42 m up, and
      // the sight line still clears a 19 m crown 7 m out from the spot (a lab's yard is 8 m across)
      const woods = !urban(kindAt(Math.floor(x / P), Math.floor(z / P))), { dist = woods ? 44 : 46, pitch = woods ? 1.25 : .62 } = o;
      off.subVectors(camera.position, controls.target); off.y = 0; if (off.lengthSq() < 1e-6) off.set(0, 0, 1); off.normalize();
      controls.target.set(x, 0, z);
      camera.position.set(x + off.x * dist * Math.cos(pitch), dist * Math.sin(pitch), z + off.z * dist * Math.cos(pitch));
      controls.update(); onMove();
    },
  };
  return nav;
}
