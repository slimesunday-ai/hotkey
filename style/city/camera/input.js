// CAMERA PASS · INPUT: keyboard, mouse (pointer lock or drag), wheel and trackpad, touch, gamepad → one intent per frame.
// The rig sets `active` (false in orbit, where MapControls owns the canvas) and reads take() once a frame. Actions (mode keys, Tab…)
// are the rig's own keydown handler; this file only keeps what is held and what moved. Pointer-lock deltas pass a spike filter
// (camera build 3/4, RESEARCH D12: fly.spikePx, fly.lockQuietMs).
//   touch (fly, photo): a finger on the left 40 % of the screen is a move stick, a finger on the right drags the look, two fingers
//   pinch (follow: distance; photo: lens; fly: speed) · gamepad (standard mapping): left stick moves, right stick looks, triggers
//   down / up, L3 boost; button edges go to onPad(index)
import { CAM } from './config.js';

const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;

export function createInput(el, { onClick = () => {}, onPad = () => {}, onLock = () => {} } = {}) {
  const held = new Set(), look = { x: 0, y: 0 }, out = { move: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0 }, rate: { x: 0, y: 0 }, wheel: 0, wheelX: 0, boost: false, slow: false, pad: false, touch: false };
  let wheel = 0, wheelX = 0, drag = null, down = null, active = false, locked = false, pads = false, prevBtn = [], wantLook = true, lockAt = -1e9, spikes = 0;
  const touches = new Map(); let stick = null, pinch0 = 0;
  addEventListener('keydown', e => { if (typing(e) || e.metaKey || e.ctrlKey) return; held.add(e.code); });
  addEventListener('keyup', e => held.delete(e.code));
  addEventListener('blur', () => { held.clear(); drag = null; touches.clear(); stick = null; });
  // ── mouse: a click (press and release within 6 px and 450 ms) goes to onClick; a drag looks (or orbits) when the pointer is not locked
  el.addEventListener('pointerdown', e => {
    down = e.isPrimary ? [e.clientX, e.clientY, performance.now(), e.button] : null;
    if (e.pointerType === 'touch') { if (active) touchDown(e); return; }
    if (active && !locked && (e.button === 0 || e.button === 2)) { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture?.(e.pointerId); }
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') { touchMove(e); return; }
    if (!active) return;
    if (locked) { const c = CAM.fly, mx = e.movementX || 0, my = e.movementY || 0;   // (Chrome's pointer lock emits spurious ±300–400 px jumps — three.js #12757: an event over spikePx, or any motion within lockQuietMs of a lock change, is dropped)
      if (performance.now() - lockAt < (c.lockQuietMs ?? 150) || Math.abs(mx) > (c.spikePx ?? 400) || Math.abs(my) > (c.spikePx ?? 400)) { spikes++; return; }
      look.x += mx; look.y += my; return; }
    if (drag) { look.x += e.clientX - drag.x; look.y += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; }
  });
  const up = e => {
    if (e.pointerType === 'touch') touchUp(e); else drag = null;
    const d = down; down = null;
    if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 6 && performance.now() - d[2] < 450) onClick(e, d[3]);
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', e => { drag = null; down = null; touchUp(e); });
  el.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });
  // the wheel: up and down → wheel (distance, speed, lens); sideways (a trackpad's two-finger swipe, Shift-wheel) → wheelX (follow orbits
  // on it). A pinch (ctrlKey) is always distance. A GESTURE picks one axis and keeps it (Apple's directional lock): its first
  // CAM.wheelAxis.px px (or .ms ms) decide, held back until then, and the lock holds until the events pause .gapMs ms — a two-finger
  // zoom's sideways drift, even an event that drifts more sideways than up, never orbits, and a swipe never zooms
  const gest = { axis: null, ax: 0, ay: 0, sx: 0, sy: 0, t0: 0, last: -1e9 };
  el.addEventListener('wheel', e => { if (!active) return; e.preventDefault(); const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1, c = CAM.wheelAxis, now = performance.now();
    if (e.ctrlKey) { wheel += e.deltaY * k; return; }
    let dx = e.deltaX * k, dy = e.deltaY * k; if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    if (now - gest.last > c.gapMs) Object.assign(gest, { axis: null, ax: 0, ay: 0, sx: 0, sy: 0, t0: now }); gest.last = now;
    if (!gest.axis) { gest.ax += Math.abs(dx); gest.ay += Math.abs(dy); gest.sx += dx; gest.sy += dy;
      if (gest.ax + gest.ay < c.px && now - gest.t0 < c.ms) return; gest.axis = gest.ax > gest.ay ? 'x' : 'y'; dx = gest.sx; dy = gest.sy; }
    if (gest.axis === 'x') wheelX += dx; else wheel += dy; }, { passive: false });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === el; lockAt = performance.now(); drag = null; onLock(locked); });
  document.addEventListener('pointerlockerror', () => { locked = false; onLock(false, true); });
  // ── touch
  function touchDown(e) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, side: e.clientX < innerWidth * .4 ? 'move' : 'look' });
    if (touches.size === 1 && touches.get(e.pointerId).side === 'move') stick = e.pointerId;
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } }
  function touchMove(e) { const t = touches.get(e.pointerId); if (!t) return;
    if (touches.size === 2) { const [a, b] = [...touches.values()]; t.x = e.clientX; t.y = e.clientY; const p = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) wheel += (pinch0 - p) * 2.5; pinch0 = p; return; }
    if (t.side === 'look' || stick !== e.pointerId) { look.x += (e.clientX - t.x) * CAM.touch.look; look.y += (e.clientY - t.y) * CAM.touch.look; }
    t.x = e.clientX; t.y = e.clientY; }
  function touchUp(e) { touches.delete(e.pointerId); if (stick === e.pointerId) stick = null; pinch0 = 0; }
  addEventListener('gamepadconnected', () => { pads = true; });
  const dz = (x, y) => { const m = Math.hypot(x, y), d = CAM.gamepad.dead; if (m < d) return [0, 0]; const s = Math.min(1, (m - d) / (1 - d)) / m; return [x * s, y * s]; };
  const k = c => held.has(c) ? 1 : 0;
  out.key = c => held.has(c); out.any = (...c) => c.some(x => held.has(x));
  return {
    held, key: c => held.has(c), any: (...c) => c.some(x => held.has(x)),
    get active() { return active; }, set active(v) { active = v; if (!v) { drag = null; look.x = look.y = 0; wheel = wheelX = 0; touches.clear(); stick = null; } },
    get locked() { return locked; }, set wantLook(v) { wantLook = v; }, get spikes() { return spikes; },
    lock() { if (locked || !el.requestPointerLock) return; try { const p = el.requestPointerLock({ unadjustedMovement: true }); p?.catch?.(() => { try { el.requestPointerLock()?.catch?.(() => {}); } catch {} }); } catch {} },
    unlock() { if (document.pointerLockElement === el) document.exitPointerLock(); },
    // the frame's intent: move (x right, y up, z forward, −1…1), look (px), rate (stick look, −1…1), wheel (px), boost, slow
    take() {
      const m = out.move; m.x = k('KeyD') - k('KeyA'); m.z = k('KeyW') - k('KeyS'); m.y = 0;
      out.look.x = look.x; out.look.y = look.y; look.x = look.y = 0; out.rate.x = out.rate.y = 0; out.wheel = wheel; wheel = 0; out.wheelX = wheelX; wheelX = 0;
      out.boost = held.has('ShiftLeft') || held.has('ShiftRight'); out.slow = held.has('AltLeft') || held.has('AltRight'); out.pad = false; out.touch = touches.size > 0;
      if (stick !== null) { const t = touches.get(stick); if (t) { const r = CAM.touch.stick, dx = (t.x - t.x0) / r, dy = (t.y - t.y0) / r, l = Math.max(1, Math.hypot(dx, dy)); m.x += dx / l; m.z -= dy / l; } }
      if (pads && navigator.getGamepads) for (const g of navigator.getGamepads()) { if (!g || !g.connected) continue; out.pad = true;
        const [lx, ly] = dz(g.axes[0] || 0, g.axes[1] || 0), [rx, ry] = dz(g.axes[2] || 0, g.axes[3] || 0), b = i => g.buttons[i] ? (g.buttons[i].value ?? (g.buttons[i].pressed ? 1 : 0)) : 0;
        m.x += lx; m.z -= ly; out.rate.x += rx; out.rate.y += ry; m.y += b(7) - b(6) + b(5) - b(4); if (b(10) > .5) out.boost = true;
        const prev = prevBtn[g.index] || []; g.buttons.forEach((x, i) => { const p = x.pressed; if (p && !prev[i]) onPad(i); prev[i] = p; }); prevBtn[g.index] = prev; }
      return out;
    },
  };
}
