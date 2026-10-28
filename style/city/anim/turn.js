// ANIM LAB · turning. Today (pedsim.js where()) a walker's heading is its lane segment's direction: at a corner node it snaps to the
// next segment in one frame, and the body pivots on the spot. Here:
//   · turnToward: the heading chases its target at a limited angular speed (WALK.turnRate), with a limited angular acceleration,
//     so a turn starts and ends softly; st.omega (rad/s) feeds the lean into the turn and the head's lead (walk.js)
//   · roundedPath: a polyline whose corners are short arcs (radius r, shrunk to fit short legs), walked by distance → x, z, heading
//   · cornerPoint: the same arc for ONE corner, in the form pedsim.js can use at a node (see pedsimHeading and MERGE.md)
//   · a walker standing still that turns shuffles its feet (walk.js stepGait's `turn` argument)
export const wrapPi = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export function turnToward(st, target, dt, rate = 3.2, gain = 7, acc = 22) {
  const err = wrapPi(target - st.yaw); const want = Math.max(-rate, Math.min(rate, err * gain));
  st.omega += Math.max(-acc * dt, Math.min(acc * dt, want - st.omega));
  let step = st.omega * dt; if (Math.sign(step) === Math.sign(err) && Math.abs(step) > Math.abs(err)) { step = err; st.omega = dt > 0 ? err / dt : 0; }
  if (Math.sign(step) !== Math.sign(err) && Math.abs(err) < 1e-3) { step = 0; st.omega = 0; }
  st.yaw = wrapPi(st.yaw + step); return step;
}
// a polyline [[x, z], …] with rounded corners → { len, at(s) → [x, z, yaw] } (closed: loops)
export function roundedPath(pts, r = .8, closed = false) {
  const n = pts.length, seg = [], dir = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, l]; };
  const legs = []; for (let i = 0; i < (closed ? n : n - 1); i++) legs.push(dir(pts[i], pts[(i + 1) % n]));
  const cut = legs.map(() => [0, 0]);   // how much each leg loses at its start and end to the arcs
  const arcs = [];
  for (let i = 0; i < n; i++) { if (!closed && (i === 0 || i === n - 1)) { arcs.push(null); continue; }
    const a = legs[(i - 1 + legs.length) % legs.length], b = legs[i % legs.length], phi = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
    if (phi < .02 || phi > 2.7) { arcs.push(null); continue; }
    let t = r * Math.tan(phi / 2); t = Math.min(t, a[2] * .45, b[2] * .45); const rr = t / Math.tan(phi / 2), side = Math.sign(a[0] * b[1] - a[1] * b[0]);
    const p1 = [pts[i][0] - a[0] * t, pts[i][1] - a[1] * t], c = [p1[0] - a[1] * rr * side, p1[1] + a[0] * rr * side];
    arcs.push({ p1, c, rr, side, phi, a0: Math.atan2(p1[0] - c[0], p1[1] - c[1]) }); cut[(i - 1 + legs.length) % legs.length][1] = t; cut[i % legs.length][0] = t; }
  for (let i = 0; i < legs.length; i++) { const A = pts[i], [dx, dz, l] = legs[i], [c0, c1] = cut[i];
    seg.push({ kind: 'line', x: A[0] + dx * c0, z: A[1] + dz * c0, dx, dz, len: Math.max(0, l - c0 - c1) });
    const arc = arcs[(i + 1) % n]; if (arc && (closed || i + 1 < n - 1)) seg.push({ kind: 'arc', ...arc, len: arc.rr * arc.phi }); }
  const len = seg.reduce((s, q) => s + q.len, 0);
  const at = (s, out = [0, 0, 0]) => { if (closed) s = ((s % len) + len) % len; else s = Math.max(0, Math.min(len, s));
    for (const q of seg) { if (s > q.len && q !== seg[seg.length - 1]) { s -= q.len; continue; }
      if (q.kind === 'line') { out[0] = q.x + q.dx * s; out[1] = q.z + q.dz * s; out[2] = Math.atan2(q.dx, q.dz); }
      else { const ang = q.a0 - q.side * s / q.rr; out[0] = q.c[0] + Math.sin(ang) * q.rr; out[1] = q.c[1] + Math.cos(ang) * q.rr; out[2] = Math.atan2(-q.side * Math.cos(ang), q.side * Math.sin(ang)); }
      return out; }
    return out; };
  return { len, at, seg };
}
// ONE corner, for pedsim: the walker is `s` m along the path measured from the corner node (negative: still on the edge coming in,
// positive: on the edge going out); u1 = the incoming unit direction, u2 = the outgoing one. Inside the arc's reach (|s| < t) the
// point moves onto the arc; outside it is the polyline itself. Returns [x, z, yaw].
export function cornerPoint(bx, bz, u1x, u1z, u2x, u2z, s, r = .8, out = [0, 0, 0]) {
  const phi = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1z * u2z))), t = phi < .02 || phi > 2.7 ? 0 : r * Math.tan(phi / 2);
  if (t === 0 || Math.abs(s) >= t) { const [ux, uz] = s < 0 ? [u1x, u1z] : [u2x, u2z]; out[0] = bx + ux * s; out[1] = bz + uz * s; out[2] = Math.atan2(ux, uz); return out; }
  const f = (s + t) / (2 * t), p1x = bx - u1x * t, p1z = bz - u1z * t, p2x = bx + u2x * t, p2z = bz + u2z * t;   // quadratic Bézier p1 → B → p2 (the arc's close twin)
  const a = (1 - f) * (1 - f), b = 2 * (1 - f) * f, c = f * f; out[0] = a * p1x + b * bx + c * p2x; out[1] = a * p1z + b * bz + c * p2z;
  const tx = (1 - f) * (bx - p1x) + f * (p2x - bx), tz = (1 - f) * (bz - p1z) + f * (p2z - bz); out[2] = Math.atan2(tx, tz); return out;
}
// pedsim adapter: call after sim.where(w) each frame. It keeps the walker's drawn heading (w.yawS) and turn rate (w.omega), chasing
// the lane's heading (w.p[3]) at a limited rate; returns the heading to draw. (A walker on the kerb-shuffle keeps pedsim's own.)
export function pedsimHeading(w, dt, rate = 3.2) {
  if (w.yawS === undefined) { w.yawS = w.p[3]; w.omega = 0; }
  const st = { yaw: w.yawS, omega: w.omega }; const step = turnToward(st, w.p[3], dt, rate); w.yawS = st.yaw; w.omega = st.omega; w.dyaw = step; return w.yawS;
}
