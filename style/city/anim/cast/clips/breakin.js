// CLIPS · breakin (events): break-ins: picking the lock at the door, creeping in, searching by flashlight (GAME.md §20; 2026-10-15). One owner; CLIPS.md has the entry format.
// "Break in | a lockpick at the door, a flashlight inside." Five clips, one burglar, in the order the show plays them (breakin.md has
// the staging the city owes them: the door, the drawer, the beam, the timing):
//   pick_lock          6.0 s loop      crouched at the door, both fists at the keyhole under the chin (prop: lockpick, a wrench and a pick):
//                                     rakes, listens, freezes and looks back over each shoulder
//   door_give          1.8 s one-shot  from pick_lock's first pose: the last turn, the lock gives, the tools away, a hand pushes the door in,
//                                     two steps through the opening (shift [0, 0.4])
//   creep_walk         4.8 s loop      a WALKING OVERLAY at the walker's own pace (high.js's convention): hunched, the torch out ahead in
//                                     the +x hand (prop: flashlight), its beam on the floor, scanning
//   flashlight_search  6.4 s loop      standing in the dark room, sweeping the beam across it, a closer look, a startle at a noise
//   rummage            4.4 s loop      bent over a low open drawer, both hands digging, a fling, a freeze to listen, something to the pocket
// THE RIG'S LIMITS shape all of it. The toon arm reaches only 0.403–0.453 m from the shoulder, and the big head (x ±0.5, y 0.9–1.7, its
// front at z 0.45) owns everything above the shoulders inside its width. So the hands work under the chin, never at the face; a head that
// turns sweeps its corners 0.15–0.22 m forward (so the burglar backs off the door before it looks round); and the house kit's knob
// (1.0–1.2 m up: the toon's face) is out of reach, so the lock the clips work is at 0.59 m (breakin.md).
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow (cArm's 5-argument form); torso / head: x = pitch forward (head: look
// down), y = yaw (+: the front turns to +x), z = roll.
import { TOOL, toolGeometry, toolMatrix, toolPoint, toolDir, lockpickLive } from './breakin-props.js';
import { WALK2, buildGait, table } from '../gait2.js';

const f = v => (+v).toFixed(4), PI = Math.PI;
// ── the expression helpers on the JS side (clips/index.js CLIP_HELPERS and the GLSL built-ins the tracks use)
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, pow: Math.pow,
    smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key: cS, cIn,
// cOut, cR, cBack; work.js's keys)
const keys = (K, T = 't') => { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; };

// ── the rig (walk2.js; chars.js voxels × 0.05): the hips, the legs, the shoulder pivot, the neck, the elbow's hinge line and the hand's
// grip point (the mitten's centre), in the arm's rest frame (hanging)
const RIG = { hipY: .5, hipZ: .025, hipX: .125, L: (.2 + .175) * .998, ank: .125, heel: .175, toe: .275, shX: .25, shY: .825, neck: .95, hinge: [0, .65, .05], grip: [.325, .39, 0] };
// the reach of the bent arm (talk-patrol.js / work.js): |grip − shoulder|² = RA + RB cos(e − PHI), e from PHI (the farthest) to EMAX
// (83°, under the thick sleeve's soft cap)
const gx = RIG.grip[0] - RIG.shX, hy = RIG.hinge[1] - RIG.shY, hz = RIG.hinge[2], gy = RIG.grip[1] - RIG.hinge[1], gz = RIG.grip[2] - RIG.hinge[2];
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);

// ── vectors and the rotations (GLSL's aRX / aRY / aRZ on column vectors)
const R3 = { x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; } };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(...a));

// ═══ THE TRACK: a clip's body, written once as expressions valid in GLSL and in JS (robbery.js's aim clips' and work.js's way), so the
// shader poses the body from it and the CPU places the tools from the very same numbers. The fields:
//   vars   [[name, expr], …]  scalars the rest may use (in order; t, D and, on a walking overlay, u and w are in scope)
//   body   { tx, ty, tz, drop, bx, pr }  the chest's pitch / yaw / roll (absolute), the pelvis drop, the hips' sway, the pelvis roll.
//          A WALKING OVERLAY gives only tx, ty, tz: the drop, the sway and the roll stay the walk's (CLIPS.md § Moods and reactions)
//   feet   { zL, lL, fL, zR, lR, fR }  cFoot of each foot (a standing clip; an overlay walks on the walk's legs)
//   root   { ry, cx, cz, mz }  the whole body's yaw about the ground point (cx, cz), then its move along z (cRot.y, cPiv, cMov)
//   head   { hx, hy, hz }  where the head points: pitch (+ down) and yaw in the BODY frame, roll; P.head = this − the chest − the root
//   L, R   the −x and the +x hand: { b: [x, y, z] (a target in the body frame), c: [x, y, z] (a target in the chest's rest frame), m: the
//          blend from b (0) to c (1), pole: [x, y, z] (where the elbow points, chest frame), k: 1 = on the target by the IK, toward 0 the
//          arm goes to `free` ([pitch, roll, yaw, twist, elbow], cArm's angles) }. A hand with no target is free. Every field is an expression.
//   show   the tool in the hand (≥ 0.5: shown)
// A WALKING OVERLAY can't know the pelvis's height inside the shader (the walk's keyed pelvis), so its hands take chest-frame targets only.
const CH = { tx: '0.', ty: '0.', tz: '0.', drop: '0.', bx: '0.', pr: '0.', zL: '0.', lL: '0.', fL: '0.', zR: '0.', lR: '0.', fR: '0.', ry: '0.', cx: '0.', cz: '0.', mz: '0.', hx: '0.', hy: '0.', hz: '0.', show: '1.' };
const S = e => typeof e === 'number' ? f(e) : e;
// the track → { channel: expression }
function flat(T) {
  const o = { ...CH }, put = (k, v) => { if (v !== undefined) o[k] = S(v); };
  for (const g of ['body', 'feet', 'root', 'head']) for (const [k, v] of Object.entries(T[g] || {})) put(k, v);
  put('show', T.show);
  for (const s of ['L', 'R']) { const h = T[s] || {}, b = h.b || [0, 0, 0], c = h.c || [0, 0, 0], p = h.pole || [s === 'L' ? -1 : 1, -1, -.3], fr = h.free || [0, .04, 0, 0, 0];
    Object.assign(o, { [s + 'bx']: S(b[0]), [s + 'by']: S(b[1]), [s + 'bz']: S(b[2]), [s + 'cx']: S(c[0]), [s + 'cy']: S(c[1]), [s + 'cz']: S(c[2]), [s + 'm']: S(h.m ?? (h.c && !h.b ? 1 : 0)),
      [s + 'px']: S(p[0]), [s + 'py']: S(p[1]), [s + 'pz']: S(p[2]), [s + 'k']: S(h.k ?? (h.b || h.c ? 1 : 0)),
      [s + 'fp']: S(fr[0]), [s + 'fr']: S(fr[1]), [s + 'fy']: S(fr[2]), [s + 'ft']: S(fr[3]), [s + 'fe']: S(fr[4]) }); }
  return o;
}
// THE JS SIDE: t (and u, w) → every channel's value
function trackJs(T, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]), F = flat(T), names = Object.keys(F);
  const fn = new Function(...ks, 't', 'D', 'u', 'w', `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${names.map(k => `${k}: ${F[k]}`).join(', ')} };`);
  return (t, u = 0, w = 0) => fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur, u, w);
}
// THE GLSL SIDE: the body, the feet, the root, the head, then the hands (each target into the chest's rest frame, the two-bone IK)
function trackGlsl(T, o = {}) {
  const F = flat(T), overlay = !!o.overlay, A = (s, k) => F[s + k], usesBody = ['L', 'R'].some(s => T[s] && T[s].b);
  if (overlay && usesBody) throw new Error('breakin: a walking overlay takes chest-frame hand targets only');
  const lines = [(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')];
  if (overlay) lines.push(`P.torso = vec3(${F.tx}, ${F.ty}, ${F.tz});`);
  else lines.push(`P.torso = vec3(${F.tx}, ${F.ty}, ${F.tz}); P.drop = ${F.drop}; P.bodyX = ${F.bx}; P.pRoll = ${F.pr};`,
    `cFoot(P, 0, ${F.zL}, ${F.lL}, ${F.fL}); cFoot(P, 1, ${F.zR}, ${F.lR}, ${F.fR});`,
    `cRot.y = ${F.ry}; cPiv = vec3(${F.cx}, 0., ${F.cz}); cMov = vec3(0., 0., ${F.mz});`);
  lines.push(`P.head = vec3(${F.hx} - P.torso.x, ${F.hy} - P.torso.y${overlay ? '' : ' - cRot.y'}, ${F.hz});`);
  const sides = ['L', 'R'].filter(s => T[s]);
  if (!sides.length) return '\n  ' + lines.join('\n  ');
  lines.push('// THE HANDS: each target into the chest\'s rest frame, then the two-bone IK on the elbow (high.js / talk-patrol.js ik); a free arm takes its angles', '{');
  if (usesBody) lines.push(`  // the walker's body frame → the chest's rest frame: the clip's root undone, walk2.js's standing pelvis, the chest's turn about it
  float bkL = (A_L1 + A_L2) * .998, bkSr = sin(P.pRoll) * A_HIPX;
  float bkHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(bkL * bkL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + bkSr, P.ank.w + sqrt(max(bkL * bkL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - bkSr));
  mat3 bkMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y)), bkQ = transpose(aRY(cRot.y));`);
  for (const s of sides) { const i = s === 'L' ? 0 : 1, sx = i ? 1 : -1, h = T[s];
    lines.push(`  // the ${i ? '+x' : '−x'} ${h.b || h.c ? 'hand' : 'arm, free'}`);
    if (!h.b && !h.c) { lines.push(`  cArm(P, ${i}, vec4(${A(s, 'fp')}, ${A(s, 'fr')}, ${A(s, 'fy')}, ${A(s, 'ft')}), ${A(s, 'fe')}, 1.);`); continue; }
    lines.push(`  {
    cArm(P, ${i}, vec4(${A(s, 'fp')}, ${A(s, 'fr')}, ${A(s, 'fy')}, ${A(s, 'ft')}), ${A(s, 'fe')}, 1.);`);
    if (h.b) lines.push(`    vec3 kB = cPiv + bkQ * (vec3(${A(s, 'bx')}, ${A(s, 'by')}, ${A(s, 'bz')}) - cPiv - cMov);
    vec3 kT = mix(vec3(0., A_HIPY, A_HIPZ) + bkMt * (kB - vec3(P.bodyX, bkHip, A_HIPZ)), vec3(${A(s, 'cx')}, ${A(s, 'cy')}, ${A(s, 'cz')}), ${A(s, 'm')}) - vec3(${f(sx * RIG.shX)}, ${f(RIG.shY)}, 0.);`);
    else lines.push(`    vec3 kT = vec3(${A(s, 'cx')}, ${A(s, 'cy')}, ${A(s, 'cz')}) - vec3(${f(sx * RIG.shX)}, ${f(RIG.shY)}, 0.);`);
    lines.push(`    vec3 kH = vec3(${A(s, 'px')}, ${A(s, 'py')}, ${A(s, 'pz')});
    float kr2 = clamp(dot(kT, kT), ${f(RMIN ** 2)}, ${f(RMAX ** 2)}), ke = ${f(PHI)} + acos(clamp((kr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), kc = cos(ke), ks = sin(ke);
    vec3 kv = vec3(${f(sx * gx)}, ${f(hy)} + kc * ${f(gy)} + ks * ${f(gz)}, ${f(hz)} - ks * ${f(gy)} + kc * ${f(gz)}), kl = vec3(${f(sx * gx)}, ${f(RIG.hinge[1] - RIG.shY)}, 0.);
    vec3 e1 = normalize(kv), e2 = normalize(kl - dot(kl, e1) * e1), f1 = normalize(kT), f2 = normalize(kH - dot(kH, f1) * f1);
    mat3 kR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
    float kb = asin(clamp(kR[1][2], -1., 1.)), ka = atan(-kR[1][0], kR[1][1]), kcc = atan(-kR[0][2], kR[2][2]);
    if (abs(ka) > 1.5707963) { ka -= sign(ka) * 3.14159265; kb = (kb >= 0. ? 3.14159265 : -3.14159265) - kb; kcc += kcc > 0. ? -3.14159265 : 3.14159265; }
    cArm(P, ${i}, vec4(-kb, ${f(sx)} * ka, 0., ${f(-sx)} * kcc), ke, ${A(s, 'k')});
  }`); }
  lines.push('}');
  return '\n  ' + lines.join('\n  ');
}

// ═══ THE CPU HALF: the same pose, in JS (walk2.js on a standing walker; robbery.js / react.js handFK). v: a track's values at t.
// the standing pelvis (walk2.js: as high as both posed ankles allow)
const ankle = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
function hipOf(v) { const Lf = ankle(v.zL, v.fL, v.lL), Rf = ankle(v.zR, v.fR, v.lR), sr = Math.sin(v.pr) * RIG.hipX;
  return Math.min(RIG.hipY - v.drop, Lf[1] + Math.sqrt(Math.max(RIG.L ** 2 - Lf[0] ** 2 - v.bx ** 2, 0)) + sr, Rf[1] + Math.sqrt(Math.max(RIG.L ** 2 - Rf[0] ** 2 - v.bx ** 2, 0)) - sr); }
const PC = [0, RIG.hipY, RIG.hipZ];
// the chest's rest frame → the body frame (and back), the clip's root included. o: a walking overlay's chest from the walk (walkChest
// below: { hip, bx, wRoll, turnRoll }); a standing clip's is its own.
function frameOf(v, o = {}) {
  const hip = o.hip ?? hipOf(v), bx = o.bx ?? v.bx, roll = v.tz + .5 * v.pr + (o.wRoll ?? 0) * .4, piv = [v.cx, 0, v.cz], mv = [0, 0, v.mz], ry = v.ry, turn = o.turnRoll ?? 0;
  const rot = d => R3.z(roll, R3.x(v.tx, R3.y(v.ty, d))), unrot = d => R3.y(-v.ty, R3.x(-v.tx, R3.z(-roll, d)));
  const root = q => add(add(piv, R3.y(ry, sub(q, piv))), mv), unroot = q => add(piv, R3.y(-ry, sub(sub(q, mv), piv)));
  const toBody = p => R3.z(turn, root(add([bx, hip, RIG.hipZ], rot(sub(p, PC))))), toChest = q => add(PC, unrot(sub(unroot(R3.z(-turn, q)), [bx, hip, RIG.hipZ])));
  const dirToBody = d => R3.z(turn, R3.y(ry, rot(d)));
  return { hip, rot, toBody, toChest, dirToBody };
}
// A WALKING OVERLAY's chest (walk2.js while walking: the keyed pelvis, the hips' sway, the swing side's roll and the turn's lean), from
// the walker's gait state g (gait2.js; the city has it in the gait hook). Without g (the anim lab's live preview passes only t) a steady
// creep at CREEP_V is assumed: the pelvis at its mean height, no sway or roll (the tool then drifts up to 2.3 cm off the hand).
const CREEP_V = .6;
let GAIT = null, PY_MEAN = null;
const gaitOf = () => GAIT || (GAIT = buildGait(WALK2));
function walkChest(g) {
  if (!g) { if (PY_MEAN === null) { const G = gaitOf(), a = .4 + .6 * JS.smoothstep(0, WALK2.vRef, CREEP_V); let s = 0; for (let j = 0; j < 64; j++) s += table(G, G.pt, a, j / 64); PY_MEAN = s / 64; }
    return { hip: PY_MEAN, bx: 0, wRoll: 0, turnRoll: 0 }; }
  const w = g.w ?? 0, a = g.a ?? 1, st = Math.cos(2 * PI * ((g.u ?? 0) - .27)), wa = w * a, hipS = Math.min(RIG.hipY, RIG.ank + RIG.L);
  return { hip: hipS + ((g.py ?? RIG.hipY) - hipS) * w, bx: -WALK2.sway * st * wa, wRoll: -WALK2.roll * st * wa, turnRoll: Math.max(-.3, Math.min(.3, -.09 * (g.omega || 0) * (g.v || 0))) };
}
// the two-bone IK (high.js ik(), in JS): T, H in the chest's rest frame → { a: [pitch, roll, yaw, twist], e }. The constants are the
// GLSL's, to 4 decimals: the CPU's hand then lands where the shader's does (≤ 0.001 mm on the real shader).
const Kg = { RA: +f(RA), RB: +f(RB), PHI: +f(PHI), R2MIN: +f(RMIN ** 2), R2MAX: +f(RMAX ** 2) };
function ikJs(sx, T, H) {
  const kT = sub(T, [sx * RIG.shX, RIG.shY, 0]), kr2 = Math.min(Kg.R2MAX, Math.max(Kg.R2MIN, dot(kT, kT)));
  const ke = Kg.PHI + Math.acos(Math.min(1, Math.max(-1, (kr2 - Kg.RA) / Kg.RB))), kc = Math.cos(ke), ks = Math.sin(ke);
  const kv = [sx * gx, hy + kc * gy + ks * gz, hz - ks * gy + kc * gz], kl = [sx * gx, RIG.hinge[1] - RIG.shY, 0];
  const e1 = norm(kv), e2 = norm(sub(kl, mul(e1, dot(kl, e1)))), f1 = norm(kT), f2 = norm(sub(H, mul(f1, dot(H, f1)))), e3 = cross(e1, e2), f3 = cross(f1, f2);
  // (F · Eᵀ)[row r, column c]
  const E = [e1, e2, e3], Fm = [f1, f2, f3], R = (r, c) => Fm[0][r] * E[0][c] + Fm[1][r] * E[1][c] + Fm[2][r] * E[2][c];
  let kb = Math.asin(Math.min(1, Math.max(-1, R(2, 1)))), ka = Math.atan2(-R(0, 1), R(1, 1)), kcc = Math.atan2(-R(2, 0), R(2, 2));
  if (Math.abs(ka) > 1.5707963) { ka -= Math.sign(ka) * 3.14159265; kb = (kb >= 0 ? 3.14159265 : -3.14159265) - kb; kcc += kcc > 0 ? -3.14159265 : 3.14159265; }
  return { a: [-kb, sx * ka, 0, -sx * kcc], e: ke, reach: Math.sqrt(dot(kT, kT)) };
}
// the arm of one side (0: −x, 1: +x) as the shader leaves it: the free angles, then the IK's by k (cArm's mix)
function armOf(v, side, fr) {
  const s = side ? 'R' : 'L', sx = side ? 1 : -1, free = [v[s + 'fp'], v[s + 'fr'], v[s + 'fy'], v[s + 'ft']], fe = v[s + 'fe'], k = v[s + 'k'];
  if (!(k > 0)) return { a: free, e: fe, target: null };
  const tb = fr.toChest([v[s + 'bx'], v[s + 'by'], v[s + 'bz']]), tc = [v[s + 'cx'], v[s + 'cy'], v[s + 'cz']], m = v[s + 'm'];
  const T = [0, 1, 2].map(i => tb[i] + (tc[i] - tb[i]) * m), ik = ikJs(sx, T, [v[s + 'px'], v[s + 'py'], v[s + 'pz']]);
  return { a: free.map((x, i) => x + (ik.a[i] - x) * k), e: fe + (ik.e - fe) * k, target: T, reach: ik.reach };
}
// a point of the hand's rest frame (the arm hanging) → the chest's rest frame: the elbow's rigid hand about the hinge line, then the
// shoulder's turn (aArmRot: aRY(−sx yaw) aRZ(sx roll) aRX(−pitch) aRY(−sx twist))
const armRot = (sx, a, d) => R3.y(-sx * a[2], R3.z(sx * a[1], R3.x(-a[0], R3.y(-sx * a[3], d))));
function handPoint(sx, arm, p) { const h = RIG.hinge, sh = [sx * RIG.shX, RIG.shY, 0];
  const q = add(h, R3.x(-arm.e, sub(p, h))); return add(sh, armRot(sx, arm.a, sub(q, sh))); }
const handDir = (sx, arm, d) => armRot(sx, arm.a, R3.x(-arm.e, d));
// the tool's axes in the hand's rest frame (the arm hanging): x across, its y (up) to the hand's front (the thumb side, +z), its z down
// the fingers (−y): aRX(π/2), the gun's mapping (robbery.js GUN_IN_HAND)
const IN_HAND = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
// the hand's frame in the BODY frame: { p: the grip point, R: the tool's axes (column-major) }; off = [rx, ry, rz]: the tool turned in
// the fist, about its own axes (Rx · Ry · Rz)
function handFrame(v, side, fr, off = null) {
  const sx = side ? 1 : -1, arm = armOf(v, side, fr), grip = [sx * RIG.grip[0], RIG.grip[1], RIG.grip[2]];
  let A = IN_HAND;
  if (off) A = [0, 1, 2].map(j => { let e = [0, 0, 0]; e[j] = 1; e = R3.x(off[0], R3.y(off[1], R3.z(off[2], e))); return [0, 1, 2].map(i => IN_HAND[0][i] * e[0] + IN_HAND[1][i] * e[1] + IN_HAND[2][i] * e[2]); });
  const p = fr.toBody(handPoint(sx, arm, grip)), R = A.flatMap(d => fr.dirToBody(handDir(sx, arm, d)));
  return { p, R, arm };
}
// the head's box (chars.js: x ±0.5, y 0.9 … 1.7, z −0.35 … 0.45 in the chest's rest frame, turning about the neck) → its 8 corners, body frame
function headCorners(v, fr) {
  const hp = v.hx - v.tx, hyw = v.hy - v.ty - v.ry, hr = v.hz, N = [0, RIG.neck, 0], out = [];
  for (const x of [-.5, .5]) for (const y of [.9, 1.7]) for (const z of [-.35, .45]) out.push(fr.toBody(add(N, R3.y(hyw, R3.x(hp, R3.z(hr, sub([x, y, z], N)))))));
  return out;
}
// ═══ the design-time model (the scratch probes and breakin.md's numbers read it; the city doesn't need it)
export const MODEL = { JS, RIG, RMIN, RMAX, PHI, EMAX, trackJs, trackGlsl, flat, frameOf, ikJs, armOf, handFrame, handPoint, headCorners, hipOf, walkChest, R3 };

// ═══ THE LOCKPICK PAIR (breakin-props.js): the tension wrench in the −x fist, the pick in the +x fist, each turned in its fist so its tip
// line runs through the keyhole at the work pose (OFF: Rx · Ry about the tool's own axes, found once at pick_lock's t 0)
const OFF = { wrench: [-.495, .1, 0], pick: [.25, -.035, 0] };
// one live mesh for the lab's single prop slot, shared by every lockpick clip (lab.js caches the geometry by prop id)
let LIVE = null;
function lockpickProp(T, dur, loop) {
  const tr = trackJs(T, dur, loop);
  const pose = t => { const v = tr(t), fr = frameOf(v), w = handFrame(v, 0, fr, OFF.wrench), p = handFrame(v, 1, fr, OFF.pick);
    return { wrench: { p: w.p, R: w.R, show: v.show }, pick: { p: p.p, R: p.R, show: v.show } }; };
  return { id: 'lockpick', parts: ['wrench', 'pick'], pose, track: tr,
    tips: t => { const q = pose(t); return { wrench: toolPoint(q.wrench, TOOL.wrench.tip), pick: toolPoint(q.pick, TOOL.pick.tip), show: q.pick.show }; },
    partGeometry: (THREE, part, scheme) => toolGeometry(THREE, part, scheme),
    partMatrices: (THREE, t, outs = null) => { const q = pose(t); return ['wrench', 'pick'].map((id, n) => [id, toolMatrix(THREE, q[id], outs?.[n]?.[1] || new THREE.Matrix4())]); },
    geometry: THREE => LIVE ||= lockpickLive(THREE),
    matrix(THREE, t, out = new THREE.Matrix4()) { const q = pose(t); LIVE?.userData.pose([q.wrench, q.pick]); return out.identity(); } };
}

// ═══ THE DOOR (a city set; breakin.md says what to place). In the burglar's body frame at the lock: the door's face is the plane z
// DOOR.z (the walker faces it, its ground point DOOR.z out from it), the keyhole at DOOR.key, the opening DOOR.half each side of the
// walker's centre line (the house kit's 1.2 m), hinged at DOOR.hinge (x, z) and swinging in. The hands can only work at a lock under
// the chin (above), so the keyhole is 0.59 m up. The head's front stays ≥ 7 cm behind the door's face bare, ≥ 3 cm in the Stick-Up Knit.
export const DOOR = { z: .62, key: [0, .59, .62], half: .6, hinge: [.6, .62] };

// ═══ PICK_LOCK (6 s loop): crouched at the door on the balls of the feet, leaning in, both fists at the keyhole under the chin: the
// tension wrench steady in the −x hand, the pick raking in the +x hand (four strokes 0.25–1.25 s: out and down, the +x shoulder dipping
// with each), the head tilted to listen (0.9–1.7) · a FREEZE at 1.75: the hands come off the lock to the chest, the body rocks back off the
// door (8 cm) and only then the head whips round over the +x shoulder (2.0–2.26; its corners sweep forward as it turns, so it turns only
// once it is clear of the door), held, a small scan · the head back, the body forward, the hands back on (2.7–3.2) · slow single-pin
// lifts with the head tilted the other way (3.4–4.3), a frustrated jiggle (4.3–4.65) · a quick look over the −x shoulder (rocked back
// again, 4.75–5.75) · back on the lock by 5.85. The pose at 0 (= 6) is door_give's first: switch there.
const PL_D = 6;
// the fists at the lock (body frame): the −x one lower with the wrench, the +x one with the pick; both well under the chin, so a padded
// sleeve or a ski mask's skirt clears it
const HL = [-.15, .52, .46], HR = [.13, .58, .465];
const pickTrack = {
  vars: [
    // a breath every 3 s (two a loop)
    ['br', 'sin(6.2831853 * t / 3.)'],
    // glance A: the rock back off the door (and the hands off the lock), then the head round over the +x shoulder
    ['ra', 'cS(t, 1.8, 2.05) * (1. - cS(t, 2.88, 3.18))'], ['la', 'cOut(t, 2., 2.26) * (1. - cS(t, 2.68, 2.93))'],
    // glance B: the same, over the −x shoulder
    ['rc', 'cS(t, 4.72, 4.95) * (1. - cS(t, 5.5, 5.8))'], ['lc', 'cOut(t, 4.88, 5.12) * (1. - cS(t, 5.3, 5.52))'],
    // both rock backs; the freeze (a start)
    ['rb', 'ra + rc'], ['fz', 'cBump(t, 1.7, 1.86)'],
    // the rake strokes, the single-pin lifts, the jiggle
    ['rk', 'cBump(t, .25, .5) + cBump(t, .5, .75) + cBump(t, .75, 1.) + cBump(t, 1., 1.25)'],
    ['pn', 'cBump(t, 3.4, 3.62) + cBump(t, 3.74, 3.96) + cBump(t, 4.08, 4.3)'],
    ['jg', 'sin(6.2831853 * 12. * t) * cBump(t, 4.3, 4.65)'],
    // the listening tilt
    ['ls', '.1 * cS(t, .9, 1.3) * (1. - cS(t, 1.55, 1.8)) - .08 * cS(t, 3.32, 3.7) * (1. - cS(t, 4.3, 4.6))']],
  body: { tx: '.18 - .24 * rb + .012 * br + .015 * rk', ty: '.03 * rk + .45 * la - .4 * lc', tz: '-.025 * rk + .06 * la - .05 * lc', drop: '.17 + .004 * (.5 - .5 * br) - .012 * fz' },
  feet: { zL: '.07 + .08 * rb', fL: '-.12', zR: '-.1 + .08 * rb', fR: '-.32' },
  root: { mz: '-.08 * rb' },
  head: { hx: '-.02 - .04 * fz - .03 * rb + .01 * pn', hy: '.03 * rk + 1.75 * la - .12 * cBump(t, 2.3, 2.68) * la - 1.6 * lc', hz: 'ls + .05 * la - .05 * lc' },
  L: { b: [`${f(HL[0])} + .004 * jg`, `${f(HL[1])} - .004 * cBump(t, 1.2, 1.7) + .006 * jg`, f(HL[2])], c: [-.21, .64, .42], m: 'rb', pole: [-1, '-.6 + .7 * rb', '-.2 - .2 * rb'] },
  R: { b: [`${f(HR[0])} + .004 * rk`, `${f(HR[1])} - .01 * rk - .01 * pn + .008 * jg`, `${f(HR[2])} - .022 * rk`], c: [.21, .64, .42], m: 'rb', pole: [1, '-.6 + .7 * rb', '-.2 - .2 * rb'] },
};

// ═══ DOOR_GIVE (1.8 s one-shot, from pick_lock's first pose: switch at a wrap of pick_lock): the last turn of the wrench (0.05–0.28 s)
// · the lock gives at 0.3 (a jolt, the head pops) · the pick comes out and goes to the hoodie pocket with the +x hand, the wrench up the
// −x sleeve (the tools hidden from 0.58) · the −x hand comes up flat on the door 0.45–0.8 and pushes it (0.85–1.1) while the body rises
// out of the crouch and leans in; then it goes out for balance · the door swings in on its own, fast (doorSwing: open 1.55 rad by 1.5)
// · two steps through the opening (the −x foot 1.1–1.42, the +x 1.42–1.76), the head low and forward · ends standing hunched 0.4 m in
// (shift [0, 0.4]), the +x hand at the pocket, the −x arm out: then creep_walk (blending in as the walker moves off). The opening is
// 1.2 m wide and the head 1.0 m: the walker must be centred in it, and the head can't turn in the doorway (its corners sweep out 0.15 m
// as it turns: into the jambs), so the look round is the creep's.
const DG_D = 1.8;
// the −x arm out for balance, beside the hip: inside the jambs (0.6 m off the centre line) and clear of the stepping thigh
const BAL = [.15, .35, 0, .25, .6];
// the hoodie's front pocket (deal-hang.js: the elbow out, the hand in front of the belly)
const PK = [.54, .38, .32, .5, .85];
const giveTrack = {
  vars: [['tn', 'cS(t, .05, .28)'], ['ck', 'cBump(t, .26, .4)'], ['po', 'cS(t, .38, .62)'], ['pu', 'cS(t, .45, .8)'], ['pd', 'cS(t, .85, 1.1)'], ['rl', 'cS(t, 1.15, 1.45)'],
    ['up', 'cS(t, .7, 1.25)'], ['sL', 'cS(t, 1.1, 1.42)'], ['sR', 'cS(t, 1.42, 1.76)'], ['mz', '.2 * sL + .2 * sR']],
  body: { tx: '.18 + .14 * cS(t, .6, 1.) - .04 * cS(t, 1.4, 1.8)', ty: '.04 * tn - .06 * pu * (1. - rl)', tz: '-.03 * pu * (1. - rl)', drop: '.172 - .015 * ck - .11 * up' },
  feet: { zL: 'mix(.07, .45, sL) - mz', lL: '.06 * cBump(t, 1.1, 1.42)', fL: '-.12 * (1. - sL)', zR: 'mix(-.1, .32, sR) - mz', lR: '.06 * cBump(t, 1.42, 1.76)', fR: '-.32 * (1. - up) * (1. - sR)' },
  root: { mz: 'mz' },
  head: { hx: '-.02 - .05 * ck + .06 * cS(t, 1.2, 1.8)', hy: '.04 * tn * (1. - po)', hz: '-.05 * ck' },
  L: { b: [`mix(${f(HL[0])} - .012 * tn, -.24, pu)`, `mix(${f(HL[1])} - .022 * tn, .6, pu)`, `mix(${f(HL[2])} + .008 * tn, .53 + .065 * pd, pu)`], pole: [-1, -.6, -.2], k: '1. - rl', free: BAL },
  R: { b: [f(HR[0]), `${f(HR[1])} + .01 * tn`, `${f(HR[2])} - .05 * cS(t, .36, .5)`], pole: [1, -.6, -.2], k: '1. - po', free: PK },
  show: '1. - step(.58, t)',
};
// the door's swing (rad about its hinge, + = in, away from the burglar): pushed 0.85–1.1, then on its own, open by 1.5. The entry's
// `door` field: the city swings its leaf by it, the sheets' preview draws it
const doorSwing = t => .08 * JS.cS(t, .85, 1.1) + 1.47 * JS.cOut(t, 1.05, 1.5);

// ═══ THE FLASHLIGHT (breakin-props.js): in the +x fist, the gun's grip (it points where the fingers point). Its BEAM leaves the lens along
// the torch (prop.beam(t[, g]) → { p, d, show }, body frame): the light is the city's (a spot light there, a cone), the clip says where.
// A walking overlay's tool rides the chest over the walk: pass the walker's gait state g to pose / matrix / beam (as carry_box's box).
// off: the torch turned in the fist (Rx · Ry · Rz about its own axes; + rx tips the beam down, as a wrist would)
function flashlightProp(T, dur, loop, overlay = false, off = null) {
  const tr = trackJs(T, dur, loop);
  const pose = (t, g = null) => { const v = tr(t, g?.u ?? 0, g ? g.w : overlay ? 1 : 0), fr = overlay ? frameOf(v, walkChest(g)) : frameOf(v), h = handFrame(v, 1, fr, off);
    return { p: h.p, R: h.R, show: v.show }; };
  return { id: 'flashlight', pose, track: tr, frame: overlay ? 'walk' : 'body',
    geometry: (THREE, scheme) => toolGeometry(THREE, 'flashlight', scheme),
    matrix: (THREE, t, out = new THREE.Matrix4(), g = null) => toolMatrix(THREE, pose(t, g), out),
    beam: (t, g = null) => { const q = pose(t, g); return { p: toolPoint(q, TOOL.flashlight.lens), d: toolDir(q, TOOL.flashlight.dir), show: q.show }; } };
}
// the flashlight hand's target in the chest's rest frame: from the +x shoulder, yaw ay (+: to +x) and pitch ap (+: up), r out (the reach
// shell is 0.403–0.453); the pole puts the elbow down, so the forearm (the torch) points ~18° above the shoulder → hand line
const aimAt = (ay, ap, r = .435) => [`${f(RIG.shX)} + ${f(r)} * sin(${ay}) * cos(${ap})`, `${f(RIG.shY)} + ${f(r)} * sin(${ap})`, `${f(r)} * cos(${ay}) * cos(${ap})`];
const FL_POLE = [.4, -1, -.2];
// the torch tipped down in the fist: flashlight_search 0.3 rad (the beam along the shoulder → hand line), creep_walk 0.1. An overhand hold
// (the elbow up and out) aims down without it, but the raised elbow goes into the big head.
const FL_TIP = [.3, 0, 0], CREEP_TIP = [.1, 0, 0];

// ═══ CREEP_WALK (4.8 s loop, a WALKING OVERLAY at the walker's own pace: moving, speed 0, stride 1; high.js's convention: it writes only
// the chest, the head and the arms, so the legs are the walk's, bit for bit): hunched low over the walk, the chin tucked, the torch held
// out ahead in the +x hand, its beam on the floor 1.2–1.6 m ahead, scanning slowly left and right (once a loop, the eyes leading it); the
// −x arm out to the side for balance, the elbow bent, a little swing with the steps. Standing still (w → 0) it holds the same look: switch
// to flashlight_search there (both blend from the stand). Walk it slowly: ~0.5–0.7 m/s (the walk's own short steps).
const CW_D = 4.8;
const creepTrack = {
  vars: [['sc', 'sin(6.2831853 * t / D)'], ['s2', 'sin(12.566371 * t / D)'], ['yb', '.35 * sc'], ['pb', '-.3 + .05 * s2'], ['ty', '.12 * sc']],
  body: { tx: '.38 + .015 * s2', ty: 'ty', tz: '0.' },
  head: { hx: '.12 - .2 * pb', hy: '1.1 * yb', hz: '.04 * s2' },
  R: { c: aimAt('yb - ty + .12', 'pb - .3 + .38', .447), pole: FL_POLE },
  L: { free: ['.3 - .1 * cos(6.2831853 * (u - .07)) * w', '.42 + .03 * sin(6.2831853 * t / 1.6)', '0.', '.25', '.75 + .1 * sin(6.2831853 * t / 1.6 + 1.)'] },
};

// ═══ FLASHLIGHT_SEARCH (6.4 s loop): standing in the dark room, the knees soft, the torch out in front at chest height in the +x hand,
// the beam on the floor ahead to the −x side · sweeps across the room to the +x side 0.6–2.2 s (the chest turns with it, the eyes lead
// it) · holds the beam on something there (2.2–2.8) and leans in for a closer look · drops the beam to the floor near the feet (3.15) and
// back out · a NOISE: the beam whips to the −x side 3.6–3.85, the body ducks and the −x hand comes up, held, then relaxes back to the
// start by 6.4. The beam stays 13–17° below level (the hand under the head's edge); its spot is on the floor 1.7–2.7 m out.
const FS_D = 6.4;
const searchTrack = {
  vars: [['br', 'sin(6.2831853 * t / 3.2)'],
    // the beam's yaw and pitch (body frame)
    ['yb', keys([[0, -.75], [.6, -.75], [2.2, .8], [2.8, .8], [3.15, .55], [3.6, .2], [3.85, -.9, 'cOut'], [4.7, -.9], [5.5, -.75], [FS_D, -.75]])],
    ['pb', keys([[0, -.32], [.6, -.32], [1.4, -.22], [2.2, -.25], [2.5, -.08], [2.8, -.08], [3.15, -.3], [3.45, -.2], [3.6, -.22], [3.85, -.25, 'cOut'], [4.7, -.25], [5.5, -.32], [FS_D, -.32]])],
    // the startle; the closer look
    ['st', 'cOut(t, 3.6, 3.85) * (1. - cS(t, 4.6, 5.3))'], ['lc', 'cS(t, 2.2, 2.5) * (1. - cS(t, 2.75, 3.05))'],
    // the arm's yaw on the chest (the chest turns 0.72 of the beam's), and its pitch: well under the head's edge (a ski mask's skirt)
    // unless the hand is out past it
    ['ar', '.28 * yb + .1'], ['ap', 'min(pb, mix(-.2, 0., smoothstep(.35, .7, ar))) - .08 * st']],
  body: { tx: '.06 + .012 * br + .07 * lc - .06 * st', ty: '.72 * yb', tz: '-.03 * st', drop: '.05 + .004 * (.5 - .5 * br) + .05 * st' },
  feet: { zL: '.06', fL: '0.', zR: '-.08', fR: '-.12 * lc' },
  head: { hx: '-.35 * pb + .05 * lc - .12 * st', hy: 'yb', hz: '.06 * lc' },
  R: { c: aimAt('ar', 'ap', .447), pole: FL_POLE },
  L: { free: ['mix(.22, .75, st)', 'mix(.26, .5, st)', 'mix(.02, .1, st)', 'mix(.2, .3, st)', 'mix(.45, 1., st)'] },
};

// ═══ THE DRAWER (a city set; breakin.md): a dresser in front of the burglar, a drawer pulled out of it toward the body. In the burglar's
// body frame: the carcass's front at z RUMMAGE.front, its top at RUMMAGE.top; the drawer RUMMAGE.w wide, out RUMMAGE.d (its front panel at
// z front − d), its floor at RUMMAGE.floor and its rim at RUMMAGE.rim. The fists work just under the rim: the big head (its bottom 0.67 m
// up when it looks in) must stay over them, so the drawer is a LOW one (the second of a dresser, or an open chest).
export const RUMMAGE = { front: .62, top: .78, w: .7, d: .32, floor: .34, rim: .48 };
// ═══ RUMMAGE (4.4 s loop, no tool: the torch is set down or away): bent over the drawer, both hands in it, digging in turn (four pushes
// 0.2–1.4 s, each in and up, the chest turning a little to the working hand) · the +x hand flings something aside 1.45–2.15 · two more
// digs · a FREEZE to listen 2.6–3.3: the hands come up to the rim, the head up and round to the −x side, the chest straightening · the −x
// hand takes something to the hoodie pocket 3.3–3.95 · back in by 4.4.
const RM_D = 4.4;
const rummageTrack = {
  vars: [
    // the −x hand's pushes, the +x hand's
    ['dl', 'cBump(t, .2, .5) + cBump(t, .8, 1.1) + cBump(t, 2.15, 2.4)'], ['dr', 'cBump(t, .5, .8) + cBump(t, 1.1, 1.4) + cBump(t, 2.35, 2.6)'],
    // the fling (the +x hand out), the listen, the −x hand to the pocket
    ['ts', 'cS(t, 1.45, 1.7) * (1. - cS(t, 1.85, 2.15))'], ['ls', 'cS(t, 2.6, 2.8) * (1. - cS(t, 3.05, 3.3))'], ['pk', 'cS(t, 3.3, 3.55) * (1. - cS(t, 3.75, 4.1))'],
    ['br', 'sin(6.2831853 * t / 2.2)']],
  body: { tx: '.2 + .02 * (dl + dr) - .1 * ls + .006 * br', ty: '.06 * (dr - dl) - .15 * ls + .05 * ts', tz: '.02 * (dl - dr)', drop: '.12 + .01 * (dl + dr) + .003 * (.5 - .5 * br)' },
  feet: { zL: '.04', fL: '0.', zR: '-.06', fR: '-.1 * ls' },
  head: { hx: '.25 - .3 * ls - .03 * ts', hy: '.05 * (dr - dl) - .75 * ls + .12 * ts', hz: '.05 * (dl - dr)' },
  L: { b: ['-.19 + .03 * dl', '.45 + .04 * dl + .06 * ls', '.41 + .04 * dl - .02 * ls'], pole: [-1, -.3, -.3], k: '1. - pk', free: PK },
  R: { b: ['.19 - .03 * dr', '.45 + .04 * dr + .06 * ls', '.41 + .04 * dr - .02 * ls'], pole: [1, -.3, -.3], k: '1. - ts', free: [-.15, 1.0, 0, -.6, 1.2] },
};

// the tracks, for the scratch probes (seams, reach, the head against the door) and breakin.md's tables
export const TRACKS = { pick_lock: [pickTrack, PL_D], door_give: [giveTrack, DG_D], creep_walk: [creepTrack, CW_D], flashlight_search: [searchTrack, FS_D], rummage: [rummageTrack, RM_D] };
export const CLIPS = [
  { name: 'pick_lock', dur: PL_D, loop: true, blendIn: .4, blendOut: .35, prop: lockpickProp(pickTrack, PL_D, true), glsl: trackGlsl(pickTrack),
    note: 'a loop at the door (prop: lockpick, the wrench in the −x fist, the pick in the +x; the door is the city\'s: its face 0.62 m ahead, the keyhole 0.59 m up): crouched on the balls of the feet, leaning in, both fists at the keyhole under the chin · four rake strokes 0.25–1.25 s, the head tilted to listen · a freeze at 1.75: the hands come off to the chest, the body rocks back off the door, the head whips round over the +x shoulder 2.0–2.26, held · back on the lock by 3.2 · single-pin lifts 3.4–4.3, a frustrated jiggle 4.3–4.65 · a quick look over the −x shoulder 4.75–5.75 · switch to door_give at a wrap' },
  { name: 'door_give', dur: DG_D, blendIn: .1, blendOut: .35, shift: [0, .4], prop: lockpickProp(giveTrack, DG_D, false), door: doorSwing, glsl: trackGlsl(giveTrack),
    note: 'a one-shot from pick_lock\'s first pose (switch at a wrap; prop: lockpick, hidden from 0.58): the last turn of the wrench, the lock gives at 0.3 (a jolt) · the pick to the hoodie pocket · the −x hand flat on the door 0.45–0.8, pushes it 0.85–1.1 while the body rises · the door swings in (door(t): 1.55 rad by 1.5) · two steps through 1.1–1.76, the head low and forward · ends standing hunched 0.4 m in (shift [0, 0.4]); then creep_walk' },
  { name: 'creep_walk', dur: CW_D, loop: true, moving: true, stride: 1, speed: 0, blendIn: .4, blendOut: .4, prop: flashlightProp(creepTrack, CW_D, true, true, CREEP_TIP), glsl: trackGlsl(creepTrack, { overlay: true }),
    note: 'a MOVING overlay at the walker\'s own pace (speed 0, stride 1; no root or leg channel: the legs are the walk\'s; prop: flashlight, pass g to pose/matrix/beam): hunched low over the walk, the chin tucked, the torch out ahead in the +x hand, the beam on the floor ahead, scanning left and right once a loop (the eyes lead it) · the −x arm out for balance · drive it slowly (~0.5–0.7 m/s)' },
  { name: 'flashlight_search', dur: FS_D, loop: true, blendIn: .4, blendOut: .4, prop: flashlightProp(searchTrack, FS_D, true, false, FL_TIP), glsl: trackGlsl(searchTrack),
    note: 'a loop in a dark room (prop: flashlight; the beam: prop.beam(t), the city\'s light): the torch out in front at chest height, the beam ahead to the −x side on the floor · sweeps across to the +x side 0.6–2.2 s, the chest turning, the eyes leading · holds on something 2.2–2.8 and leans in · down to the floor by the feet and back · a noise: the beam whips to the −x side 3.6–3.85, a duck, the −x hand up, held · relaxes back by 6.4' },
  { name: 'rummage', dur: RM_D, loop: true, blendIn: .4, blendOut: .35, glsl: trackGlsl(rummageTrack),
    note: 'a loop at an open drawer (the city\'s set: breakin.js RUMMAGE, a low drawer pulled out 0.3–0.62 m ahead): bent over it, both hands in it, digging in turn 0.2–1.4 s · the +x hand flings something aside 1.45–2.15 · two more digs · a freeze to listen 2.6–3.3, the head up and round to the −x side · the −x hand takes something to the hoodie pocket 3.3–3.95 · back in by 4.4' },
];
