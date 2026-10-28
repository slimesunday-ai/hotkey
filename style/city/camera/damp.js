// CAMERA BUILD (2026-10-05) · THE SHARED MATH (RESEARCH.md §4.3): frame-rate-independent smoothing for every camera mode. Every rate
// here is a HALF-LIFE in seconds (the time to close half the gap) used with an exact exponential, so 30, 60 and 120 Hz trace the same
// path (D9). Rule: no constant per-frame multipliers anywhere in the rig. Pure functions, no three: works on {x, y, z} objects
// (THREE.Vector3 included) and plain numbers. Converters for the other conventions: a time constant τ (e^(−t/τ)) is half-life τ·ln2;
// a Cinemachine / Unity damp time T (≈1 % left after T) is half-life T·ln2/4.605.
export const LN2 = Math.LN2;
export const hlOfTau = tau => tau * LN2;
export const hlOfDampTime = T => T * LN2 / 4.605;
// the fraction of the gap that remains after dt (0 when hl ≤ 0: snap)
export const decay = (hl, dt) => hl > 0 ? Math.pow(2, -dt / hl) : 0;
export const wrap = a => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));   // into [−π, π)
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const smootherstep = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

// exponential decay toward target: x' = target + (x − target)·2^(−dt/hl)
export const damp = (x, target, hl, dt) => target + (x - target) * decay(hl, dt);
// the same on an angle, the short way round (result wrapped)
export const dampAngle = (a, target, hl, dt) => wrap(a + wrap(target - a) * (1 - decay(hl, dt)));
// the same on a vector, in place (v and target: {x, y, z}); hl may be [hx, hy, hz] (e.g. a pivot with its own vertical half-life)
export function dampVec3(v, target, hl, dt) {
  if (Array.isArray(hl)) { v.x = damp(v.x, target.x, hl[0], dt); v.y = damp(v.y, target.y, hl[1], dt); v.z = damp(v.z, target.z, hl[2], dt); return v; }
  const k = decay(hl, dt); v.x = target.x + (v.x - target.x) * k; v.y = target.y + (v.y - target.y) * k; v.z = target.z + (v.z - target.z) * k; return v;
}

// Holden's exact critically damped spring ("spring roll call"): exact at any dt, so no frame-rate drift and no overshoot.
// s = { x, v } is advanced in place toward target; returns s.x. y = 2·ln2/hl (the half-life of the gap with zero velocity).
export function spring(s, target, hl, dt) {
  if (!(hl > 0)) { s.x = target; s.v = 0; return s.x; }
  const y = 2 * LN2 / hl, j0 = s.x - target, j1 = s.v + j0 * y, e = Math.exp(-y * dt);
  s.x = e * (j0 + j1 * dt) + target; s.v = e * (s.v - j1 * y * dt); return s.x;
}
// the same per component: p (position) and v (velocity) are {x, y, z} advanced in place; hl a number or [hx, hy, hz]
const S1 = { x: 0, v: 0 };
export function spring3(p, v, target, hl, dt) {
  for (let k = 0; k < 3; k++) { const c = k === 0 ? 'x' : k === 1 ? 'y' : 'z', h = Array.isArray(hl) ? hl[k] : hl;
    S1.x = p[c]; S1.v = v[c]; spring(S1, target[c], h, dt); p[c] = S1.x; v[c] = S1.v; }
  return p;
}
// an angle spring, the short way round: s = { x, v }, x kept wrapped
export function springAngle(s, target, hl, dt) { const t = s.x + wrap(target - s.x); spring(s, t, hl, dt); s.x = wrap(s.x); return s.x; }

// rate limit for an angle (auto-motion only; direct input bypasses it): from prev toward next, the angular velocity clamped to maxVel and
// its change to maxAcc·dt. state = { w } carries the angular velocity between frames (start it at 0). Returns the new angle (wrapped).
export function limitRate(prev, next, maxVel, maxAcc, dt, state) {
  if (!(dt > 0)) return prev;
  const want = clamp(wrap(next - prev) / dt, -maxVel, maxVel), w0 = state.w || 0, dw = maxAcc * dt;
  // brake in time: never carry more speed than can be shed before the remaining gap closes (no overshoot past `next`)
  const gap = wrap(next - prev), stop = Math.sqrt(2 * maxAcc * Math.abs(gap)), cap = Math.min(Math.abs(want), stop) * Math.sign(want);
  const w = clamp(cap, w0 - dw, w0 + dw); state.w = w; return wrap(prev + w * dt);
}
