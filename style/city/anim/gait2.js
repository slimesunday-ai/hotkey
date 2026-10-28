// ANIM LAB · walk v2, the CPU half (plain JS, no three: node can test it). walk2.js is the GPU half.
//
// v2 is a KEYED cycle, not IK. The left leg's cycle u (0 → 1, two steps; the right leg is u + ½) has the animator's eight poses:
//   u   0 contact · ⅛ down · ¼ passing · ⅜ up · ½ contact (other foot) · ⅝ down · ¾ passing · ⅞ up
// and three curves through them: the hip (thigh pitch, forward +), the knee (bend +) and the FOOT's pitch to the ground (toe up +;
// the ankle is whatever makes it so). Curves are monotone cubic Hermite (Catmull-Rom tangents, flattened at a turn so a held key
// never overshoots: the flat foot stays flat); no linear corners.
// The keys an animator sets (sliders): knee at down (the dip), swing knee, heel-strike and toe-off pitch. The stance HIP keys are
// then solved once (not per frame) so the planted heel, then toe, stays put on the key frames: this is how the stride is matched
// to the body's travel without IK. The cycle is driven by distance (u += metres / cycle length), so the feet plant at any speed.
// Slower walks use shorter steps: the keys are built for five step sizes (40 % → 100 % of the stride) and blended.
// The pelvis height is keyed too (contact, down: dips, passing, up: rises) and the planted leg's keys are solved under it, so the
// key frames plant exactly. The head is a damped spring on the pelvis's accelerations (follow-through).
export const WALK2 = {
  stride: .40,   // step length at vRef (m; one foot to the other)
  vRef: 1.2,     // the walking speed the stride is set for (m/s)
  reach: .22,    // where the ankle lands ahead of the hip at heel strike (share of the cycle length; sets the hip angles)
  bob: .009,     // the pelvis dip at down, below contact (m)
  rise: .012,    // the pelvis rise at up, above passing (m; capped by a straight leg)
  lift: .05,     // swing: how high the sole clears the ground (m; the knee folds to make it)
  heel: .25,     // toe up at heel strike (rad)
  toe: .36,      // heel up at toe-off (rad)
  arm: .40,      // shoulder swing each way (rad)
  arc: .14,      // the arm's sweep in across the body at the front of its swing (rad; simple arms: was the elbow's bend there)
  overlap: .07,  // the arms trail the legs by this share of the cycle; the hand's turn trails the arm by half again
  head: 1,       // head spring (× the settle)
  twist: .06,    // hip / shoulder counter-rotation (rad each way)
  sway: .012,    // pelvis sway over the stance foot (m)
  roll: .045,    // pelvis roll (rad)
  lean: .06,     // forward lean at vRef (rad)
  armOut: .08,   // the arms' extra outward tilt while walking (rad; .05 until the walk polish: at .08 the hands clear the hips)
};
export const SLIDERS2 = [['stride', 'stride m', .2, .6, .01], ['bob', 'bob: dip m', 0, .03, .0005], ['rise', 'bob: rise m', 0, .03, .0005], ['lift', 'swing lift m', .01, .12, .002], ['heel', 'heel strike', 0, .6, .01],
  ['toe', 'toe-off', .1, 1, .01], ['arm', 'arm swing', 0, 1, .01], ['arc', 'arm arc', 0, .5, .01], ['overlap', 'overlap', 0, .2, .005], ['head', 'head spring', 0, 3, .05],
  ['twist', 'counter-rot', 0, .2, .005], ['roll', 'pelvis roll', 0, .12, .005], ['sway', 'sway m', 0, .04, .001], ['lean', 'lean', 0, .25, .01], ['reach', 'reach', .12, .32, .005], ['armOut', 'arms out', 0, .2, .005]];

// the rig (metres; chars.js voxels × 0.05): hip y 10 · knee y 6 · ankle y 2.5 · heel 3.5 voxels behind the ankle, toe 5.5 ahead
export const R2 = { hipX: .125, hipY: .5, hipZ: .025, kneeY: .3, ankY: .125, heel: .175, toe: .275 };
const T1 = R2.hipY - R2.kneeY, T2 = R2.kneeY - R2.ankY;
export const LEVELS = [.4, .55, .7, .85, 1];   // step size (× stride) of each key set

// monotone cubic Hermite through 8 periodic keys (p: array of 8 numbers), at u ∈ [0, 1)
export const NK = 16;   // keys per cycle as the GPU sees them (the animator's 8 poses, and the solved in-betweens)
export function tangent(p, i, mono = false) { const n = p.length, a = p[(i + n - 1) % n], b = p[i % n], c = p[(i + 1) % n], d0 = b - a, d1 = c - b;
  if (!mono) return (d0 + d1) / 2; if (d0 * d1 <= 0) return 0; const m = (d0 + d1) / 2, lim = 3 * Math.min(Math.abs(d0), Math.abs(d1)); return Math.sign(m) * Math.min(Math.abs(m), lim); }
export function curve(p, u, mono = false) { const n = p.length; u = ((u % 1) + 1) % 1; const x = u * n, i = Math.floor(x) % n, f = x - Math.floor(x), f2 = f * f, f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * p[i] + (f3 - 2 * f2 + f) * tangent(p, i, mono) + (-2 * f3 + 3 * f2) * p[(i + 1) % n] + (f3 - f2) * tangent(p, i + 1, mono); }

// forward kinematics in the leg's plane: hip pitch H, knee K, foot pitch F → heel and toe soles relative to the hip joint (y, z)
export function fk(H, K, F, o = {}) {
  const ky = -T1 * Math.cos(H), kz = T1 * Math.sin(H), ay = ky - T2 * Math.cos(H - K), az = kz + T2 * Math.sin(H - K), c = Math.cos(F), s = Math.sin(F);
  o.ay = ay; o.az = az; o.hy = ay - R2.ankY * c - R2.heel * s; o.hz = az + R2.ankY * s - R2.heel * c; o.ty = ay - R2.ankY * c + R2.toe * s; o.tz = az + R2.ankY * s + R2.toe * c;
  o.low = Math.min(o.hy, o.ty); return o; }
const solve = (f, lo, hi, target) => { let flo = f(lo) - target; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2, fm = f(m) - target; if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; } return (lo + hi) / 2; };

// the leg's own IK, used OFFLINE on the key frames only: the ankle at (y, z) from the hip → hip pitch H, knee K (≥ 0)
export function ik2(y, z) { const d = Math.min(Math.hypot(y, z), T1 + T2 - 1e-6), phi = Math.atan2(z, -y);
  const al = Math.acos(Math.max(-1, Math.min(1, (T1 * T1 + d * d - T2 * T2) / (2 * T1 * d)))), K = Math.PI - Math.acos(Math.max(-1, Math.min(1, (T1 * T1 + T2 * T2 - d * d) / (2 * T1 * T2))));
  return [phi + al, K]; }
// the heel (h = 1) or toe (h = 0) sole point relative to the ankle, for foot pitch F
const soleOff = (F, heel) => { const c = Math.cos(F), s = Math.sin(F); return heel ? [-R2.ankY * c - R2.heel * s, R2.ankY * s - R2.heel * c] : [-R2.ankY * c + R2.toe * s, R2.ankY * s + R2.toe * c]; };
// one key set for step size a (× stride): H, K, F (the left leg) and P (the pelvis: hip-joint height), NK keys each.
// Authored: the foot's pitch through the 8 poses (heel strike, flat, flat, heel rising, toe-off, trailing, level, toe up), the pelvis
// (contact, down: dips, passing, up: rises) and the swing's lift. The hips and knees on the NK key frames are then SOLVED, once, not
// per frame: in stance the heel holds its spot to ¼, then the toe to ½, on the ground under the pelvis; in swing the ankle follows a
// smooth arc that leaves the ground moving back, lifts (the knee folds), reaches past the contact and draws back into it, so the heel
// lands with no speed over the ground. At run time the joints just follow these curves: no IK, nothing to snap.
export function buildKeys(K, a) {
  const D = 2 * K.stride * a, s = .3 + .7 * a, o = {};
  const F8 = [K.heel * s, 0, 0, -.28 * K.toe * s, -.82 * K.toe * s, -.62 * K.toe * s, -.06 * s, .72 * K.heel * s];
  const Kc = .04, za = K.reach * D, H0 = solve(h => fk(h, Kc, F8[0], o).az, -1.2, 1.2, za), f0 = fk(H0, Kc, F8[0], {}), hc = -f0.low, zh = f0.hz;
  const plant = (F, py, heel, z) => { const [oy, oz] = soleOff(F, heel); const [h, kn] = ik2(-py - oy, z - oz); return [h, Math.max(0, kn), -fk(h, Math.max(0, kn), F, o).low]; };
  const top = (F, heel, z) => { const [oy, oz] = soleOff(F, heel), az = z - oz; return Math.sqrt(Math.max(0, (T1 + T2) ** 2 - az * az)) - oy; };   // a straight leg's pelvis height
  const zt = zh - D / 4 + (R2.heel + R2.toe), dip = K.bob * a, rise = K.rise * a;
  const P8 = [hc, Math.min(hc, top(0, 1, zh - D / 8) - .001) - dip, top(0, 1, zh - D / 4) - .0012, 0];
  P8[3] = Math.min(top(F8[3], 0, zt - D / 8) - .0008, P8[2] + rise); for (let k = 4; k < 8; k++) P8[k] = P8[k - 4];
  const H = [], Kn = [], F = [], P = [];
  for (let j = 0; j < NK; j++) { const u = j / NK; F[j] = curve(F8, u, true); P[j] = curve(P8, u); }
  // stance (j = 0 … NK/2): planted
  for (let j = 0; j <= NK / 2; j++) { const u = j / NK, heel = u <= .25, z = heel ? zh - D * u : zt - D * (u - .25);
    if (j === 0) { H[0] = H0; Kn[0] = Kc; continue; } const [h, kn, reach] = plant(F[j], P[j], heel ? 1 : 0, z); H[j] = h; Kn[j] = kn; if (j < NK / 2) P[j] = Math.min(P[j], reach); }
  for (let j = NK / 2; j < NK; j++) P[j] = P[j - NK / 2];
  // swing (j = NK/2+1 … NK-1): the ankle's arc, from its toe-off place to its heel-strike place, leaving and landing at ground speed
  const A0 = fk(H[NK / 2], Kn[NK / 2], F[NK / 2], {}), A1 = f0, lift = K.lift * s;
  for (let j = NK / 2 + 1; j < NK; j++) { const t = (j - NK / 2) / (NK / 2), t2 = t * t, t3 = t2 * t, m = -D / 2;
    const az = (2 * t3 - 3 * t2 + 1) * A0.az + (t3 - 2 * t2 + t) * m + (-2 * t3 + 3 * t2) * A1.az + (t3 - t2) * m;
    const up = Math.max(-soleOff(F[j], 1)[0], -soleOff(F[j], 0)[0]), gy = up + lift * 6.75 * t * (1 - t) * (1 - t);   // ankle over the ground: the sole clears it by the lift, which peaks a third in (the heel flicks up, then the foot glides in low)   // ankle height above the ground
    const [h, kn] = ik2(gy - P[j], az); H[j] = h; Kn[j] = Math.max(0, kn); }
  return { H, K: Kn, F, P, D, F8, P8 };
}
export const NT = 64;   // pelvis table samples per cycle (the CPU reads the pelvis height and its acceleration from it)
export function buildGait(K) { const sets = LEVELS.map(a => buildKeys(K, a)), pt = new Float32Array(LEVELS.length * NT), pa = new Float32Array(LEVELS.length * NT);
  sets.forEach((ks, i) => { for (let j = 0; j < NT; j++) { const u = j / NT, e = 1 / 256; pt[i * NT + j] = curve(ks.P, u); pa[i * NT + j] = (curve(ks.P, u + e) - 2 * curve(ks.P, u) + curve(ks.P, u - e)) / (e * e); } });
  return { sets, D: sets.map(s => s.D), pt, pa }; }
// the body's own rhythms (all walk2.js mirrors these in GLSL): st = +1 at the left foot's mid-stance
export const stance = u => Math.cos(2 * Math.PI * (u - .27));
export const pelvisRoll = (K, a, u) => -K.roll * a * stance(u);   // the swing side drops (the stance hip up)

// ── per walker
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function gait2State(o = {}) { return { u: o.u ?? 0, a: 1, py: R2.hipY, w: 0, v: 0, vPrev: 0, shuf: 0, hp: 0, hv: 0, hr: 0, hrv: 0, idle: o.idle ?? -1, iw: 0, it: o.it ?? 0, look: 0, still: 0, wasStill: false, omega: 0, scale: o.scale ?? 1 }; }
export function level(a) { const x = Math.max(0, Math.min(LEVELS.length - 1.0001, (a - LEVELS[0]) / (LEVELS[1] - LEVELS[0]))), i = Math.floor(x); return [i, x - i]; }
export function keyed(G, name, a, u) { const [i, f] = level(a); return curve(G.sets[i][name], u) * (1 - f) + curve(G.sets[i + 1][name], u) * f; }
export function table(G, T, a, u) { const [i, f] = level(a), x = (((u % 1) + 1) % 1) * NT, j = Math.floor(x) % NT, g = x - Math.floor(x), j1 = (j + 1) % NT;
  return (T[i * NT + j] * (1 - g) + T[i * NT + j1] * g) * (1 - f) + (T[(i + 1) * NT + j] * (1 - g) + T[(i + 1) * NT + j1] * g) * f; }
const cycleLen = (G, a) => { const [i, f] = level(a); return G.D[i] * (1 - f) + G.D[i + 1] * f; };
// dist: metres moved along the heading this frame · turn: heading change this frame (a standing turn shuffles the feet)
export function stepGait2(g, dist, dt, K, G, turn = 0) {   // sub-stepped at ≤ 1/120 s: the same walk at any frame rate
  if (dt <= 0) return g; const n = Math.max(1, Math.ceil(dt * 120 - 1e-6)); for (let k = 0; k < n; k++) sub(g, dist / n, dt / n, K, G, turn / n); return g; }
function sub(g, dist, dt, K, G, turn) {
  let d = Math.max(0, dist);
  g.vPrev = g.v; g.v += (d / dt - g.v) * (1 - Math.exp(-dt / .08));
  const turning = g.v < .3 && Math.abs(turn) / dt > .6; g.shuf += ((turning ? 1 : 0) - g.shuf) * (1 - Math.exp(-dt / .1));
  if (g.shuf > .05) d += Math.abs(turn) * .2 * g.shuf;
  const spd = Math.max(g.v, g.shuf * .45), moving = g.v > .04 || g.shuf > .25;
  const at = .4 + .6 * smooth(0, K.vRef, spd); g.a += (at - g.a) * (1 - Math.exp(-dt / .15));   // step size follows speed (eased: no pop)
  const L = cycleLen(G, g.a) * g.scale, du = d / L; g.u = (g.u + du) % 1; g.py = table(G, G.pt, g.a, g.u);   // the pelvis height (m), for the GPU
  const tw = moving ? Math.min(1, .35 + spd / .35) * (g.v < .04 ? .7 : 1) : 0;
  g.w += (tw - g.w) * (1 - Math.exp(-dt / (tw > g.w ? .12 : .2)));
  // the head: two damped springs (pitch on the pelvis's vertical and forward accelerations, roll on its sway)
  const rate = du / dt, ay = table(G, G.pa, g.a, g.u) * rate * rate * g.w, az = (g.v - g.vPrev) / dt, ax = 4 * Math.PI * Math.PI * rate * rate * K.sway * g.a * stance(g.u) * g.w;
  const h = dt, Hk = K.head;
  g.hv += (-480 * g.hp - 15 * g.hv + Hk * (.7 * ay - 12 * az)) * h; g.hp += g.hv * h;   // ~3.5 Hz, ζ ≈ .35: the step's dip nods it a beat late; a stop tips it forward and it settles
  g.hrv += (-480 * g.hr - 15 * g.hrv - Hk * 11 * ax) * h; g.hr += g.hrv * h;
  g.hp = Math.max(-.3, Math.min(.3, g.hp)); g.hr = Math.max(-.2, Math.min(.2, g.hr));
}
