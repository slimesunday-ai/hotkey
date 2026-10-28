// C1-4, the drawn half · OUT-LOUD LINES AS SPEECH BUBBLES. Each public `outloud` cue of the routine planner (routines.js day().bubbles:
// {agent, minute, line, eventId, place}) shows over its speaker for BUBBLE_S seconds of the viewer's time from its minute, as a DOM
// bubble that follows the walker's head (crisp at every camera distance the city uses). Only the cue's `line` is ever shown: never a
// sit-down's words (`say`), crew chat, memory or a board snapshot: those are not cues, and nothing here reads an event.
// Pure in (minute, speed): the window is BUBBLE_S × speed / 60 island minutes (6 s at Live, 6 island minutes at 60×), so seeking there
// equals playing there. A speaker not drawn at that moment (on a ride, indoors) shows its bubble at its place's anchor instead.
import * as THREE from 'three';

export const BUBBLE_S = 6;
export const HEAD = 2.7;
const CSS = `.rec-bubbles{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden}
.rec-bubble{position:absolute;left:0;top:0;max-width:260px;padding:7px 11px;border-radius:12px;background:#fffdf6;color:#14161c;
font:600 15px/1.25 system-ui,-apple-system,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);transform:translate(-50%,-100%);white-space:normal}
.rec-bubble::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#fffdf6}
.rec-bubble b{display:block;font:700 11px/1.2 system-ui,sans-serif;color:#7a5a12;letter-spacing:.04em;margin-bottom:2px}`;

// cues: the planner's bubble cues; where(agent) → [x, y, z] of the drawn walker's feet, or null; anchor(cue) → [x, y, z] or null
// gone(agent) → true while the speaker is off the island (C1-7d: departed on the SECOND CHANCE): its bubble isn't drawn at all
export function createBubbles({ cues, player, camera, where, anchor = () => null, nameOf = id => id, gone = () => false, root = document.body }) {
  const sorted = cues.slice().sort((a, b) => a.minute - b.minute || a.eventId - b.eventId);
  const minutes = sorted.map(c => c.minute);
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const layer = document.createElement('div'); layer.className = 'rec-bubbles'; root.append(layer);
  const els = new Map(), V = new THREE.Vector3(), shown = [];
  const span = () => BUBBLE_S * (player.speed || 1) / 60;
  // the cues up at minute m: cue.minute ≤ m < cue.minute + span
  function active(m = player.minute) {
    const w = span();
    let lo = 0, hi = minutes.length;
    // Keep the original expiry addition: subtracting w from m can round
    // differently at a fractional boundary. Both seeks and speed changes work.
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (m < minutes[mid] + w) hi = mid; else lo = mid + 1;
    }
    const first = lo;
    hi = minutes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (minutes[mid] > m) hi = mid; else lo = mid + 1;
    }
    return sorted.slice(first, lo);
  }
  function frame() {
    const up = active().filter(c => !gone(c.agent)), keep = new Set(up.map(c => c.eventId)); shown.length = 0;
    for (const [id, el] of els) if (!keep.has(id)) { el.remove(); els.delete(id); }
    const W = innerWidth, H = innerHeight;
    for (const c of up) {
      let el = els.get(c.eventId);
      if (!el) { el = document.createElement('div'); el.className = 'rec-bubble'; el.dataset.agent = c.agent; el.dataset.event = c.eventId;
        const who = document.createElement('b'); who.textContent = nameOf(c.agent); const line = document.createElement('span'); line.textContent = c.line;
        el.append(who, line); layer.append(el); els.set(c.eventId, el); }
      const p = where(c.agent), at = p ?? anchor(c);
      let vis = false, sx = 0, sy = 0;
      if (at) { V.set(at[0], at[1] + HEAD, at[2]).project(camera); vis = V.z < 1 && V.z > -1 && Math.abs(V.x) <= 1.05 && Math.abs(V.y) <= 1.05; sx = (V.x + 1) / 2 * W; sy = (1 - V.y) / 2 * H; }
      el.style.display = vis ? '' : 'none';
      if (vis) el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
      shown.push({ agent: c.agent, eventId: c.eventId, minute: c.minute, line: c.line, onWalker: !!p, onScreen: vis, x: +sx.toFixed(1), y: +sy.toFixed(1) });
    }
  }
  return { frame, active, cues: () => sorted, shown: () => shown.slice(), span };
}
