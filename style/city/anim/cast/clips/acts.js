// CLIPS · acts (activities): the day's errands, watchable (GAME.md §41; slime 10-30: "every action the agent preforms ... needs to be
// watchable"; the city's stage/acts-clips.md is the spec). One owner; CLIPS.md has the entry format, acts.md what the city must stage.
// A FIRST PASS for slime to art-direct (10-31: "Make a first pass"; "if anything is related to art, I make the decision").
//   phone_up / phone_call / phone_down   1.05 s one-shot → 4.8 s loop → 1.2 s one-shot · a call: phone_tip cut in three (prop: phone)
//   phone_type        4 s loop · the phone in both hands at chest height, thumbing, a pause, a look round (prop: phone)
//   earpiece_listen   5 s loop · the +x hand up at the ear (the earpiece), the head down and still, a glance round
//   parcel_tuck       2.4 s one-shot · the taker of a hand-over (after act_take): the parcel weighed, turned, tucked into the hoodie
//                     (prop: parcel, the kraft envelope: errands-props.js's model in the plain colourway)
//   haggle_counter    4.4 s loop · forearms on a counter (its top 0.74 m: acts-props.js counter), a point, a shrug, a head shake
//   change_clothes    6 s one-shot · the top pulled off over the head and tossed, the new one (prop: garment) shaken open and pulled on
//   floorboard_lift / floorboard_rummage / floorboard_close   2.0 s one-shot → 1.6 s loop → 1.9 s one-shot · the stash: crouched at a
//                     loose floorboard (acts-props.js floor + board: the entry's `board`), pried up, a hand in at the parcel (prop:
//                     the same plain parcel as parcel_tuck's), the board back down, up
//   sleep             4 s loop · on the back in a bed under a duvet (prop: duvet), a slow breath
//   shove_walk        0.45 s one-shot, a WALKING OVERLAY (moving, speed 0) · both arms thrust out to one side at chest height (the side
//                     of cLook: the city sets g.look to the shoved one's bearing), the torso twisting into it; the legs are the walk's
// NEUTRAL BY §19: no label, number or drug colour on any prop (acts-props.js).
// THE METHOD (errands.js's, heist.js's): every clip is ONE TRACK of scalar expressions valid in GLSL and JS; a held prop's pose IS its
// fist's IK target (the two-bone IK on the elbow), so they cannot part. THE TOON ARM reaches only 0.403–0.453 m from the shoulder
// (x ±0.25, y 0.825) with the elbow ≤ 83°; the big head (x ±0.4, the ears to ±0.5 at y 1.15–1.4, y 0.95–1.7, z −0.35…0.4) owns
// everything above the chin. Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward
// (head: look down), y = yaw (+: the front turns to +x), z = roll (+: the top toward −x). The head's channels are the EYES in the body
// frame (P.head = them − the chest).

import { phoneGeometry, phoneMatrix, phonePoint } from './phone-prop.js';
import { errandsGeometry, errandsMatrix, errandsPoint, ERRANDS } from './errands-props.js';
import { ACTS, actsGeometry, actsMatrix, actsPoint } from './acts-props.js';

// ── the shared track machinery: errands.js's, copied (each group owns its file; CLIPS.md)
const f = v => (+v).toFixed(4), PI = Math.PI;
// ── the rig (walk2.js; chars.js voxels × 0.05): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre)
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
const RIG = { hipY: .5, hipZ: .025, hipX: .125, L: (.2 + .175) * .998, ank: .125, heel: .175, toe: .275 };

// ── the shared expressions' JS side: clips/index.js CLIP_HELPERS and GLSL's built-ins
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, sign: Math.sign, fract: x => x - Math.floor(x),
    smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key: cS, cIn,
// cOut, cR, cBack). A value may be a number or an expression string (bench.js keys).
function keys(K, T = 't') { const num = v => typeof v === 'number', ex = v => num(v) ? f(v) : `(${v})`;
  let s = ex(K[0][1]);
  for (let i = 1; i < K.length; i++) { const a = K[i - 1][1], b = K[i][1], e = `${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`;
    if (num(a) && num(b)) { const d = b - a; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${e}`; } else s += ` + (${ex(b)} - ${ex(a)}) * ${e}`; }
  return `(${s})`; }
// a rhythm that divides D (n whole: seamless at the loop's wrap)
const sw = (n, D, ph = 0) => `sin(${f(2 * PI * n / D)} * t${ph ? ` + ${f(ph)}` : ''})`;

// ── THE TRACK: { vars: [[name, expr], …] (scalars, in order; valid GLSL and JS), body: { tx, ty, tz, drop, bx, pr } (absolute), feet:
// { zL, lL, fL, zR, lR, fR } (cFoot) or ank: { zL, yL, fL, zR, yR, fR } (the ankles themselves, P.ank's frame, and the feet's pitch: a
// walking foot, wFoot below), head: { hx, hy, hz } (the eyes: body-frame pitch, yaw, roll), arms: [−x, +x], each { free: [pitch, roll,
// yaw, twist, elbow] (exprs; default the plain stand's hanging arm), ik: { x, y, z (the grip point's target) or T (a GLSL vec3), frame:
// 'body' (the walker's frame: planted while the chest moves) | 'chest' (the chest's rest frame: carried by it), pole: [x, y, z] (where
// the elbow points, chest frame), k (its weight over the free arm) } }, props: { <name>: { x, y, z, yaw, pitch, roll, show, frame } (the
// prop's origin and its turn R = Ry(yaw) · Rx(pitch) · Rz(roll), as heist-props.js; in the walker's frame, or the chest's rest frame:
// frame 'chest'), extra: GLSL lines after the body, before the arms }. A prop's `show` is the CPU's alone: it may read T, the clock
// unwrapped (a loop's first pass), as well as t.
const BODY = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr'], FEET = ['zL', 'lL', 'fL', 'zR', 'lR', 'fR'], ANK = ['zL', 'yL', 'fL', 'zR', 'yR', 'fR'], HEAD = ['hx', 'hy', 'hz'], PROP = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'show'];
const D0 = { tz: '0.', drop: '0.', bx: '0.', pr: '0.', lL: '0.', fL: '0.', lR: '0.', fR: '0.', hz: '0.', yaw: '0.', pitch: '0.', roll: '0.', show: '1.' };
const val = (o, k) => { const v = o?.[k] ?? D0[k] ?? '0.'; return typeof v === 'number' ? f(v) : v; };
// (the plain stand's arm: walk2.js's rest pose)
const STAND = ['0.', '.04', '0.', '0.', '0.'];
// the JS side: T (the clip clock, unwrapped) → every channel's value and the vars, at t (a loop's clock wrapped)
function jsTrack(Tk, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]), grp = (o, K) => `{ ${K.map(k => `${k}: ${val(o, k)}`).join(', ')} }`;
  const src = `${(Tk.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { body: ${grp(Tk.body, BODY)}, feet: ${Tk.feet ? grp(Tk.feet, FEET) : 'null'}, ank: ${Tk.ank ? grp(Tk.ank, ANK) : 'null'}, head: ${grp(Tk.head, HEAD)},
    props: { ${Object.entries(Tk.props || {}).map(([n, p]) => `${n}: ${grp(p, PROP)}`).join(', ')} }, vars: { ${(Tk.vars || []).map(([k]) => k).join(', ')} } };`;
  const fn = new Function(...ks, 't', 'T', 'D', src);
  return T => fn(...vals, loop ? JS.mod(Math.max(T, 0), dur) : Math.max(T, 0), Math.max(T, 0), dur);
}
// THE HAND IK (talk-patrol.js / heist.js's, GLSL): side 0 (−x) / 1 (+x); T = the grip point's target, H = where the elbow points (both in
// the chest's rest frame); k = its weight over the arm as it is
function ik(side, T, H, k) {
  const sx = side ? 1 : -1;
  return /* glsl */`{ vec3 kT = (${T}) - vec3(${f(sx * SH.x)}, ${f(SH.y)}, 0.), kH = (${H});
    float kr2 = clamp(dot(kT, kT), ${f(RMIN ** 2)}, ${f(RMAX ** 2)}), ke = ${f(PHI)} + acos(clamp((kr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), kc = cos(ke), ks = sin(ke);
    vec3 kv = vec3(${f(sx * gx)}, ${f(hy)} + kc * ${f(gy)} + ks * ${f(gz)}, ${f(hz)} - ks * ${f(gy)} + kc * ${f(gz)}), kl = vec3(${f(sx * gx)}, ${f(ELB.y - SH.y)}, 0.);
    vec3 e1 = normalize(kv), e2 = normalize(kl - dot(kl, e1) * e1), f1 = normalize(kT), f2 = normalize(kH - dot(kH, f1) * f1);
    mat3 kR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
    float kb = asin(clamp(kR[1][2], -1., 1.)), ka = atan(-kR[1][0], kR[1][1]), kcc = atan(-kR[0][2], kR[2][2]);
    if (abs(ka) > 1.5707963) { ka -= sign(ka) * 3.14159265; kb = (kb >= 0. ? 3.14159265 : -3.14159265) - kb; kcc += kcc > 0. ? -3.14159265 : 3.14159265; }
    cArm(P, ${side}, vec4(-kb, ${f(sx)} * ka, 0., ${f(-sx)} * kcc), ke, ${k}); }`;
}
// a prop's point as a GLSL vec3: its origin plus its turn applied to q (the prop's own frame; heist-props.js heistMatrix's order)
const propPt = (p, q) => `(vec3(${val(p, 'x')}, ${val(p, 'y')}, ${val(p, 'z')}) + aRY(${val(p, 'yaw')}) * aRX(${val(p, 'pitch')}) * aRZ(${val(p, 'roll')}) * vec3(${q.map(v => typeof v === 'number' ? f(v) : v).join(', ')}))`;
// the GLSL side
function glslTrack(Tk) {
  const anyBody = Tk.arms.some(a => a.ik && (a.ik.frame || 'body') === 'body');
  // a body-frame target into the chest's rest frame, through walk2.js's standing pelvis and the chest's turn
  const chest = (a, p) => (a.ik.frame || 'body') === 'body' ? `(vec3(0., A_HIPY, A_HIPZ) + eMt * ((${p}) - vec3(P.bodyX, eHip, A_HIPZ)))` : p;
  return /* glsl */`
  ${(Tk.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${val(Tk.body, 'tx')}, ${val(Tk.body, 'ty')}, ${val(Tk.body, 'tz')}); P.drop = ${val(Tk.body, 'drop')}; P.bodyX = ${val(Tk.body, 'bx')}; P.pRoll = ${val(Tk.body, 'pr')};
  ${Tk.feet ? `cFoot(P, 0, ${val(Tk.feet, 'zL')}, ${val(Tk.feet, 'lL')}, ${val(Tk.feet, 'fL')}); cFoot(P, 1, ${val(Tk.feet, 'zR')}, ${val(Tk.feet, 'lR')}, ${val(Tk.feet, 'fR')});` : ''}
  ${Tk.ank ? `P.ank = vec4(${val(Tk.ank, 'zL')}, ${val(Tk.ank, 'yL')}, ${val(Tk.ank, 'zR')}, ${val(Tk.ank, 'yR')}); P.fp = vec2(${val(Tk.ank, 'fL')}, ${val(Tk.ank, 'fR')});` : ''}
  P.head = vec3(${val(Tk.head, 'hx')} - P.torso.x, ${val(Tk.head, 'hy')} - P.torso.y, ${val(Tk.head, 'hz')});
  ${Tk.extra || ''}
  ${anyBody ? `float eL = (A_L1 + A_L2) * .998, eSr = sin(P.pRoll) * A_HIPX;
  float eHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(eL * eL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + eSr, P.ank.w + sqrt(max(eL * eL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - eSr));
  mat3 eMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));` : ''}
  ${Tk.arms.map((a, s) => [`cArm(P, ${s}, vec4(${(a.free || STAND).slice(0, 4).join(', ')}), ${(a.free || STAND)[4] ?? '0.'}, ${a.fk ?? '1.'});`,
    a.ik ? ik(s, chest(a, a.ik.T || `vec3(${a.ik.x}, ${a.ik.y}, ${a.ik.z})`), `vec3(${a.ik.pole.join(', ')})`, a.ik.k ?? '1.') : ''].join('\n  ')).join('\n  ')}`;
}
// the CPU's chest frame (walk2.js, the standing body, the walk's weight 0): the standing pelvis from the feet, the chest's turn about
// it. (A clip on its own legs has its pelvis from the track alone: no gait state needed.)
const ankleOf = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
const R3 = { x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; } };
// r: a track's values (jsTrack): the ankles from its feet (cFoot) or its ank (P.ank's frame: z from the hips' line)
function chestOf(r) {
  const b = r.body, A = r.ank ? [[r.ank.zL, r.ank.yL], [r.ank.zR, r.ank.yR]] : [ankleOf(r.feet.zL, r.feet.fL, r.feet.lL), ankleOf(r.feet.zR, r.feet.fR, r.feet.lR)], sr = Math.sin(b.pr) * RIG.hipX;
  const hL = A[0][1] + Math.sqrt(Math.max(RIG.L ** 2 - A[0][0] ** 2 - b.bx ** 2, 0)) + sr, hR = A[1][1] + Math.sqrt(Math.max(RIG.L ** 2 - A[1][0] ** 2 - b.bx ** 2, 0)) - sr;
  const hip = Math.min(RIG.hipY - b.drop, hL, hR), rot = d => R3.z(b.tz + .5 * b.pr, R3.x(b.tx, R3.y(b.ty, d)));
  return { hip, rot, pt: p => { const q = rot([p[0], p[1] - RIG.hipY, p[2] - RIG.hipZ]); return [b.bx + q[0], hip + q[1], RIG.hipZ + q[2]]; } };
}
// a prop pose { x, y, z, yaw, pitch, roll, show } → the gun's contract { p, R (column-major: the prop's x, y, z axes), show }
const turn = q => { const ax = d => R3.y(q.yaw, R3.x(q.pitch, R3.z(q.roll, d))); return [...ax([1, 0, 0]), ...ax([0, 1, 0]), ...ax([0, 0, 1])]; };
// THE PROPS SHOW only while the clip's weight is ≥ 0.6 (the gun's rule, CLIPS.md): pass the walker's gait state g and the prop hides
// itself below that (g.iw: the clip's weight, stepClip's); and each clip's own `show` keeps it hidden until its hand has fetched it.
export const SHOW_W = .6;
// a clip's prop (CLIPS.md § Props; the gun's pose contract): pose(t, g?) → { p, R, show } in the walker's body frame (a chest-frame prop
// is carried through the CPU's standing chest, chestOf: exact from the clock alone); matrix(THREE, t, out, g?) its local → walker
// matrix; geometry(THREE, scheme?) its mesh. t = the clip clock (state.t; a loop wraps it itself). `map` turns the pose into another
// walker's frame (bribe_take: the briber's envelope, seen by the cop).
function propOf(name, Tk, dur, loop, M, map = null) {
  const tr = jsTrack(Tk, dur, loop), S = Tk.props[name], chest = S.frame === 'chest';
  const pose = (t, g = null) => { const r = tr(t), q = r.props[name];
    let p = [q.x, q.y, q.z], R = S.rot ? S.rot(loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0)) : turn(q);
    if (chest) { const C = chestOf(r); p = C.pt(p); R = [0, 1, 2].flatMap(i => C.rot(R.slice(3 * i, 3 * i + 3))); }
    if (map) ({ p, R } = map(p, R));
    return { p, R, show: q.show >= .5 && (!g || (g.iw ?? 1) >= SHOW_W) ? 1 : 0 }; };
  return { id: M.id, model: M.id, frame: 'body', geometry: (THREE, scheme) => M.geometry(THREE, scheme), pose, track: tr,
    matrix: (THREE, t, out = new THREE.Matrix4(), g = null) => M.matrix(THREE, pose(t, g), out), point: (t, q) => M.point(pose(t), q) };
}
const clip = o => ({ name: o.name, dur: o.dur, loop: !!o.loop, hold: !!o.hold, next: o.next || null, blendIn: o.blendIn ?? .25, blendOut: o.blendOut ?? .3,
  moving: !!o.moving, speed: o.speed || 0, stride: o.stride ?? 1, shift: o.shift || null, pair: o.pair || null, note: o.note,
  ...(o.prop ? { prop: propOf(o.prop, o.track, o.dur, !!o.loop, o.model, o.map) } : {}), track: jsTrack(o.track, o.dur, !!o.loop), ...(o.more || {}), glsl: o.glsl ?? glslTrack(o.track) });

// a prop turned by keyed rotations (CPU only: the GLSL needs a prop's points, not its turn): [[t, R (column-major), ease?], …] → (t) → R,
// slerped between the keys with the segment's ease (bench.js's quaternions)
function quatOf(R) { const [m00, m10, m20, m01, m11, m21, m02, m12, m22] = R, tr = m00 + m11 + m22; let q;
  if (tr > 0) { const s = .5 / Math.sqrt(tr + 1); q = [.25 / s, (m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [(m21 - m12) / s, .25 * s, (m01 + m10) / s, (m02 + m20) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m02 - m20) / s, (m01 + m10) / s, .25 * s, (m12 + m21) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, .25 * s]; }
  return q; }
function rotOf([w, x, y, z]) { return [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)]; }
function slerp(a, b, k) { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(v => -v); d = -d; }
  if (d > .9995) { const q = a.map((v, i) => v + (b[i] - v) * k), l = Math.hypot(...q); return q.map(v => v / l); }
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - k) * th) / s, wb = Math.sin(k * th) / s; return a.map((v, i) => wa * v + wb * b[i]); }
const rotKeys = K => { const Q = K.map(k => quatOf(k[1])); return t => { if (t <= K[0][0]) return K[0][1].slice(); for (let i = 1; i < K.length; i++) if (t <= K[i][0]) {
  const k = JS[K[i][2] || 'cS'](t, K[i - 1][0], K[i][0]); return rotOf(slerp(Q[i - 1], Q[i], k)); } return K[K.length - 1][1].slice(); }; };
// axes from where the prop's x axis points and roughly where its z axis points (column-major R: x, y, z)
const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); }, crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const axesXZ = (x, z) => { const X = nrm(x), d = z[0] * X[0] + z[1] * X[1] + z[2] * X[2], Z = nrm(z.map((v, i) => v - d * X[i])), Y = crs(Z, X); return [...X, ...Y, ...Z]; };

// a hand's way between two targets ON THE REACH SHELL (chest frame): round the shoulder on a great circle, the distance from the shoulder
// eased between the ends' (a straight or bezier path between two targets cuts inside the shell, 0.403–0.453 m from the shoulder, and
// the IK then clamps the reach: the hand leaves its target). By k (0 → 1). Expressions valid in GLSL and JS.
function onShell(side, a, b, k) {
  const S = [side ? SH.x : -SH.x, SH.y, 0], da = a.map((v, i) => v - S[i]), db = b.map((v, i) => v - S[i]), ra = Math.hypot(...da), rb = Math.hypot(...db);
  const ua = da.map(v => v / ra), ub = db.map(v => v / rb), W = Math.acos(ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]), sW = Math.sin(W);
  return [0, 1, 2].map(i => `(${f(S[i])} + mix(${f(ra)}, ${f(rb)}, ${k}) * (${f(ua[i] / sW)} * sin(${f(W)} * (1. - ${k})) + ${f(ub[i] / sW)} * sin(${f(W)} * ${k})))`);
}

// THE HOODIE'S FRONT POCKET (deal-hang.js's PK, as a target): the hands just in front of the belly, the elbows bent and out at the sides
// (chest frame); every pocket clip gated clean there. A hand that fetches something goes in here first.
const POCKET = [.16, .63, .37], POCKET_POLE = [1, -.8, -.5];
const L_ = p => [-p[0], p[1], p[2]];
const POCKET_L = L_(POCKET), POCKET_POLE_L = L_(POCKET_POLE);
// the props' models
const PHONE_M = { id: 'phone', geometry: (THREE, s) => phoneGeometry(THREE, s), matrix: phoneMatrix, point: phonePoint };
// (the plain parcel the city hands over: errands-props.js's envelope in kraft paper, its bills end the paper's own; nothing reads as money)
const KRAFT = { paper: 0xb38b5d, flap: 0x8f6b42, bills: 0xb38b5d, billsD: 0x9a774c };
const ENVELOPE_M = { id: 'parcel', geometry: (THREE, s) => errandsGeometry(THREE, 'envelope', s ?? KRAFT), matrix: errandsMatrix, point: errandsPoint };
const ACTS_M = id => ({ id, geometry: (THREE, s) => actsGeometry(THREE, id, s), matrix: actsMatrix, point: actsPoint });
const GARMENT_M = ACTS_M('garment'), DUVET_M = ACTS_M('duvet');
// a lab-only stand-in set (CLIPS.md § Refine: drawn under the actor, never under &dbg=back)
const setOf = (id, M = null) => ({ id: 'acts-' + id, geometry: THREE => M ? M(THREE) : actsGeometry(THREE, id) });

// ═══ THE CALL (phone_tip cut in three: GAME.md §13's tip, and every call, ask, answer, crew invite …: stage/acts.js ACT_SETS.call).
// phone_up (1.05 s → phone_call): both hands in the hoodie pocket; the phone out (0.45) and up to the ear round the shoulder on the
// reach shell (0.55–1.05), the head tilted to it: phone_tip's first second, without its breath, so it lands EXACTLY on the call's pose.
// phone_call (4.8 s loop): THE CALL'S POSE at 0 and 4.8: the fist beside the head's lower side (EAR: the shell allows no higher), the phone
// standing up from it to the ear, the head tilted to it, the −x hand in the pocket. Two breaths; the weight shifts over and back; two
// nods ("mm-hm", 0.55–1.2); the free hand comes out of the pocket and turns out once ("what can I do", 2.0–3.25), the eyes on it; a
// glance round (3.45–4.55: the chest turns to −x, away from the phone, the head with it: turned toward the phone its corner meets the
// fist). No lip sync. phone_down (1.2 s): from the call's pose the phone down into the pocket (gone at 0.6) and a look back over the −x
// shoulder; ends with the hands in the pocket (the blend out takes them from there).
const EAR = [.665, .95, .08], EAR_POLE = [.8, -.8, .5], GEST_L = [-.42, .68, .36], GEST_POLE_L = [-1, -.6, -.2];
const PH_AXES = { pocket: axesXZ([.3, -.2, -.93], [0, 1, 0]), out: axesXZ([-.9, -.15, -.4], [0, 1, 0]), ear: axesXZ([.3, -1, -.08], [.75, .25, .62]) };
const CALL = { tx: .03, tz: .08, drop: .01, bx: -.02, pr: -.05, hx: .02, hz: -.15, zL: .03, zR: -.04 };
const pocketArm = (side = 0) => ({ ik: { x: f(side ? POCKET[0] : POCKET_L[0]), y: f(POCKET[1]), z: f(POCKET[2]), frame: 'chest', pole: (side ? POCKET_POLE : POCKET_POLE_L).map(f) } });
const phoneArm = k => { const [x, y, z] = onShell(1, POCKET, EAR, k); return { x, y, z, ik: { x, y, z, frame: 'chest', pole: [0, 1, 2].map(i => `mix(${f(POCKET_POLE[i])}, ${f(EAR_POLE[i])}, ${k})`) } }; };
const phoneUp = (() => { const A = phoneArm('up');
  return { vars: [['up', 'cS(t, .55, 1.05)']],
    body: { tx: f(CALL.tx), ty: '0.', tz: `(${f(CALL.tz)} * up)`, drop: f(CALL.drop), bx: f(CALL.bx), pr: f(CALL.pr) },
    feet: { zL: f(CALL.zL), zR: f(CALL.zR) },
    head: { hx: `(${f(CALL.hx)} + .12 * cBump(t, .3, .8))`, hy: '0.', hz: `(${f(CALL.hz)} * up)` },
    arms: [pocketArm(0), { ik: A.ik }],
    props: { phone: { frame: 'chest', x: A.x, y: A.y, z: A.z, show: 'step(.45, t)', rot: rotKeys([[.55, PH_AXES.pocket], [.8, PH_AXES.out], [1.05, PH_AXES.ear]]) } } }; })();
const PC_D = 4.8;
const phoneCall = (() => { const [gx, gy, gz] = onShell(0, POCKET_L, GEST_L, 'fh');
  return { vars: [['br', sw(2, PC_D)], ['ws', sw(1, PC_D)], ['nd', '(.07 * cBump(t, .55, .8) + .06 * cBump(t, .95, 1.2))'], ['fh', 'cS(t, 2.0, 2.35) * (1. - cS(t, 2.85, 3.25))'],
      ['gl', keys([[0, 0], [3.45, 0], [3.8, -.3], [4.15, -.3], [4.55, 0], [PC_D, 0]])]],
    body: { tx: `(${f(CALL.tx)} + .012 * br)`, ty: 'gl', tz: f(CALL.tz), drop: `(${f(CALL.drop)} + .003 * br)`, bx: `(${f(CALL.bx)} + .025 * ws)`, pr: `(${f(CALL.pr)} + .05 * ws)` },
    feet: { zL: f(CALL.zL), zR: f(CALL.zR), fR: '(-.1 * max(-ws, 0.))' },
    head: { hx: `(${f(CALL.hx)} + nd - .01 * br + .06 * fh)`, hy: '(gl - .18 * fh)', hz: f(CALL.hz) },
    arms: [{ ik: { x: gx, y: gy, z: gz, frame: 'chest', pole: [0, 1, 2].map(i => `mix(${f(POCKET_POLE_L[i])}, ${f(GEST_POLE_L[i])}, fh)`) } },
      { ik: { x: f(EAR[0]), y: `(${f(EAR[1])} + .006 * nd)`, z: f(EAR[2]), frame: 'chest', pole: EAR_POLE.map(f) } }],
    props: { phone: { frame: 'chest', x: f(EAR[0]), y: `(${f(EAR[1])} + .006 * nd)`, z: f(EAR[2]), show: '1.', rot: () => PH_AXES.ear.slice() } } }; })();
const phoneDown = (() => { const A = phoneArm('up');
  return { vars: [['up', '(1. - cS(t, .05, .55))'], ['lb', 'cBump(t, .62, 1.2)']],
    body: { tx: f(CALL.tx), ty: '(-.12 * lb)', tz: `(${f(CALL.tz)} * up)`, drop: f(CALL.drop), bx: f(CALL.bx), pr: f(CALL.pr) },
    feet: { zL: f(CALL.zL), zR: f(CALL.zR) },
    head: { hx: `(${f(CALL.hx)} - .04 * lb)`, hy: '(-.62 * lb)', hz: `(${f(CALL.hz)} * up)` },
    arms: [pocketArm(0), { ik: A.ik }],
    props: { phone: { frame: 'chest', x: A.x, y: A.y, z: A.z, show: '(1. - step(.6, t))', rot: rotKeys([[.05, PH_AXES.ear], [.3, PH_AXES.out], [.55, PH_AXES.pocket]]) } } }; })();

// ═══ PHONE_TYPE (4 s loop): a message, a note, an order (stage/acts.js message, order). The phone in BOTH hands at chest height in
// landscape, its screen tipped up to the eyes (lit plain, nothing on it: never readable), the +x fist on its grip end and the −x on its
// far end, under the head's overhang (the head pitches down only a little: its front edge must stay over the phone, film_phone's
// lesson). Thumbing 0–1.6 s (the fists tap, 7 a second, out of step) · a pause, reading 1.6–2.4 · the head up and round once 2.4–3.2
// (a look over the phone and to each side) · thumbing again 3.2–4.
const TY_D = 4, TY = { grip: [.13, .64, .38] }, TY_AXES = axesXZ([1, 0, 0], [0, -.66, .75]);
const phoneType = (() => {
  const vars = [['br', sw(1, TY_D)], ['tp', '(1. - cS(t, 1.5, 1.7) + cS(t, 3.1, 3.3))'], ['hu', 'cS(t, 2.4, 2.62) * (1. - cS(t, 3.0, 3.22))'],
    ['hr', keys([[0, 0], [2.5, 0], [2.72, .42], [2.95, -.3], [3.2, 0], [TY_D, 0]])], ['ta', `(tp * sin(${f(2 * PI * 7)} * t))`]];
  const yR = `(${f(TY.grip[1])} + .006 * ta)`, yL = `(${f(TY.grip[1])} - .006 * ta)`;
  return { vars,
    body: { tx: '(.08 + .01 * br - .04 * hu)', ty: '(.12 * hr)', tz: '0.', drop: '.01', bx: '0.', pr: '0.' },
    feet: { zL: '.03', zR: '-.03' },
    head: { hx: '(.17 + .005 * br - .3 * hu)', hy: '(.95 * hr)', hz: '(.03 * tp)' },
    arms: [{ ik: { x: f(TY.grip[0] - .25), y: yL, z: f(TY.grip[2]), frame: 'chest', pole: ['-1.', '-.8', '-.3'] } },
      { ik: { x: f(TY.grip[0]), y: yR, z: f(TY.grip[2]), frame: 'chest', pole: ['1.', '-.8', '-.3'] } }],
    props: { phone: { frame: 'chest', x: f(TY.grip[0]), y: `(${f(TY.grip[1])} + .002 * ta)`, z: f(TY.grip[2]), show: '1.', rot: () => TY_AXES.slice() } } }; })();

// ═══ EARPIECE_LISTEN (5 s loop): `listen` (stage/acts.js call set: the earpiece's counterpart). No prop: the earpiece is the hand at
// the ear (the toon fist is a mitten: "two fingers" read as the fist pressed beside the head's lower side, where the phone's fist sits,
// the reach shell's highest). A press at the loop's start (0.05–0.5 s: the fist in, the head tilts into it) · the head down and still,
// listening (the chest a little hunched) · a glance round 4.0–4.7 (the chest turns to −x, away from the hand, the head with it) · the
// hand stays up the whole loop. The blend in raises it the way hail_taxi's does (the elbow out to the side: a side-raise).
const EP_D = 5, EP = [.66, .96, .07];
const earpiece = {
  vars: [['br', sw(2, EP_D)], ['pp', 'cBump(t, .05, .5)'], ['gl', keys([[0, 0], [4.0, 0], [4.25, -.32], [4.45, -.32], [4.7, 0], [EP_D, 0]])]],
  body: { tx: '(.1 + .01 * br)', ty: 'gl', tz: '(.04 + .02 * pp)', drop: '.012', bx: '-.015', pr: '-.04' },
  feet: { zL: '.03', zR: '-.04' },
  head: { hx: '(.2 + .005 * br - .05 * cBump(t, 4.0, 4.7))', hy: 'gl', hz: '(-.1 - .06 * pp)' },
  arms: [pocketArm(0), { ik: { x: `(${f(EP[0])} - .012 * pp)`, y: f(EP[1]), z: f(EP[2]), frame: 'chest', pole: EAR_POLE.map(f) } }] };

// ═══ PARCEL_TUCK (2.4 s one-shot): the taker of a hand-over (stage/acts.js handover's partner), played after act_take (bribe_take's
// track: the parcel taken at 0.92 and into its −x pocket at 1.3, gone). It starts on bribe_take's last pose (the −x hand at its
// pocket, the +x thumb in the belt, the chin up) with the parcel back in that hand: out of the pocket and weighed in the hand in front
// of the chest (0–0.6, two little bounces, the head down to it) · turned once about its long side (0.6–1.2) · tucked into the hoodie's
// front (1.2–2.0, gone at 1.85) · the hoodie patted flat with both hands (2.0–2.4); ends with both hands at the pocket (blends out).
const TK_D = 2.4, TK = { start: [-.16, .629, .37], belt: [.17, .625, .365], weigh: [-.08, .74, .47], tuck: [-.06, .63, .4] };
const tuck = (() => { const G = ERRANDS.envelope.gripA;
  // the parcel's centre (body frame), its long axis's yaw and pitch, its roll about it: the fist on its closed end (gripA)
  const P0 = [TK.start[0], TK.start[1] + .02, TK.start[2] + .13];
  const vars = [['wb', '(-.02 * cBump(t, .32, .44) - .015 * cBump(t, .46, .58))'],
    ['pcx', keys([[0, P0[0]], [.55, TK.weigh[0]], [1.2, TK.weigh[0]], [1.6, TK.tuck[0]], [TK_D, TK.tuck[0]]])],
    ['pcy', `(${keys([[0, P0[1]], [.55, TK.weigh[1]], [1.2, TK.weigh[1]], [1.6, TK.tuck[1]], [TK_D, TK.tuck[1]]])} + wb)`],
    ['pcz', keys([[0, P0[2]], [.55, TK.weigh[2]], [1.2, TK.weigh[2]], [1.6, TK.tuck[2]], [1.85, TK.tuck[2] - .04], [TK_D, TK.tuck[2] - .04]])],
    ['pyw', keys([[0, 0], [.55, .55], [1.2, .55], [1.6, 1.35], [TK_D, 1.35]])], ['ppt', keys([[0, -.1], [.55, -.25], [1.2, -.25], [1.6, -.05], [TK_D, -.05]])],
    ['prl', keys([[0, 0], [.6, 0], [1.2, PI], [TK_D, PI]])],
    ['pt', 'cBump(t, 2.02, 2.2) + cBump(t, 2.2, 2.38)'], ['fin', 'cS(t, 1.85, 2.05)']];
  const parcel = { x: 'pcx', y: 'pcy', z: 'pcz', yaw: 'pyw', pitch: 'ppt', roll: 'prl', show: '(1. - step(1.85, t))' };
  const grip = propPt(parcel, G).replace(/^\(/, '(').trim();
  return { vars,
    body: { tx: '(.015 + .05 * cS(t, .1, .5) - .02 * cS(t, 1.9, 2.3))', ty: '(-.06 * cS(t, .3, .7) * (1. - cS(t, 1.4, 1.9)))', drop: '.006', bx: '0.', pr: '0.' },
    feet: { zL: '-.02', zR: '.03' },
    head: { hx: keys([[0, -.4], [.35, .2], [1.2, .2], [1.45, -.05], [1.75, .25], [2.4, .08]]), hy: '(-.06 * cS(t, .3, .7) * (1. - cS(t, 1.4, 1.9)) + .25 * cBump(t, 1.2, 1.7))', hz: '0.' },
    arms: [{ ik: { T: `mix(${grip}, vec3(${f(POCKET_L[0])}, ${f(POCKET_L[1])} - .02 * pt, ${f(POCKET_L[2])}), fin)`, frame: 'body', pole: ['-.8', '-1.', '-.2'] } },
      { ik: { x: `mix(${f(TK.belt[0])}, ${f(POCKET[0])}, cS(t, 1.9, 2.05))`, y: `(mix(${f(TK.belt[1])}, ${f(POCKET[1])}, cS(t, 1.9, 2.05)) - .02 * pt)`, z: `mix(${f(TK.belt[2])}, ${f(POCKET[2])}, cS(t, 1.9, 2.05))`, frame: 'chest', pole: POCKET_POLE.map(f) } }],
    props: { parcel } }; })();

// ═══ HAGGLE_COUNTER (4.4 s loop): at the fence's booth (stage/acts.js fence). THE COUNTER is the toon's, not a real one's: the cast's
// shoulders are at 0.825 m, so its top is 0.74 m up (ACTS.counter), its near edge 0.26 m ahead of the ground point; the Heap's
// booth shelf (~1.2 m) is above the shoulders, where no forearm can rest (acts.md). The hands are planted on the counter (body frame).
// Forearms on the counter, leaning on it, the elbows out (0–0.8) · a point at something on it: the +x hand slides forward, the chest
// leans into it and turns a little, the eyes down to it (0.8–1.6) · a shrug: both hands up off it, out and open, the chest back, the
// head tilted (1.6–2.4) · a head shake and a lean back, the hands pushing on the counter's edge (2.4–3.4) · back on the counter (3.4–4.4).
const HG_D = 4.4, HG = { rest: [.13, .82, .48], point: [.13, .80, .56], shrug: [.42, .9, .42], push: [.24, .78, .43] };
const haggle = (() => {
  const K = (s, i) => { const v = n => (s ? 1 : -1) ** (i === 0 ? 1 : 0) * HG[n][i], pt = s ? v('point') : v('rest');
    return keys([[0, v('rest')], [.8, v('rest')], [1.05, pt], [1.45, pt], [1.7, v('rest')], [1.8, v('shrug')], [2.3, v('shrug')], [2.6, v('push')], [3.3, v('push')], [3.75, v('rest')], [HG_D, v('rest')]]); };
  const vars = [['br', sw(2, HG_D)], ['sh', 'cS(t, 1.65, 1.85) * (1. - cS(t, 2.25, 2.5))'], ['nk', `sin(${f(2 * PI * 2.5)} * (t - 2.5)) * cBump(t, 2.5, 3.3)`],
    ['ln', keys([[0, .2], [.8, .2], [1.05, .32], [1.45, .32], [1.7, .12], [2.3, .1], [2.6, -.02], [3.3, -.02], [3.7, .2], [HG_D, .2]])]];
  return { vars,
    body: { tx: '(ln + .01 * br)', ty: '(.1 * cBump(t, .85, 1.65))', tz: '(-.04 * sh)', drop: '(.012 - .012 * sh)', bx: '0.', pr: '0.' },
    feet: { zL: '.02', zR: '-.05' },
    head: { hx: '(ln - .08 + .25 * cBump(t, .85, 1.6) - .12 * sh)', hy: '(.1 * cBump(t, .85, 1.65) + .28 * nk)', hz: '(.13 * sh)' },
    arms: [0, 1].map(s => ({ ik: { x: K(s, 0), y: K(s, 1), z: K(s, 2), frame: 'body', pole: [s ? 'mix(1., .8, sh)' : 'mix(-1., -.8, sh)', 'mix(-.2, -.6, sh)', '-.3'] } })) }; })();
const COUNTER_SET = setOf('counter');

// ═══ CHANGE_CLOTHES (6 s one-shot, then the stand): dressing (stage/acts.js dress). The walker's look never changes here (a hoodie
// conceals the fit: the board's business); this is the gesture. THE GARMENT (acts-props.js: a plain grey tee, held up by its
// shoulders) is the new top; the old one comes off as a mime. Hands to the hem (0.4–0.75) · pulled up to the chin, hunched and the
// head ducked into it (0.75–1.25) · up and out at the head's sides, the head popping free (1.25–1.85) · tossed down and aside (1.9–2.4)
// · the new one from beside the +x hip (both fists on it at 2.5) and shaken open in front (2.75–3.35) · pulled on: up to the chin, the
// head ducks into it (3.4–4.0, gone at 4.0), the hands drawing it down the chest to the hem (4.0–4.8) · the hem tugged twice and a look
// down at it (5.0–5.9). The hands are at the hem from the first frame to the last: the clip's blend in and out carry them there and
// back (a hand moving inside a clip from the hanging arm to the front sweeps the thigh: the hand gate, errands.md's lesson).
const CC_D = 6, GARM = { at: [0, .66, .38], hi: [0, .87, .40] };
const change = (() => { const g = ACTS.garment.grip[0];
  const hand = s => { const sx = s ? 1 : -1, P = (x, y, z) => [sx * x, y, z];
    const T = [[0, P(.17, .6, .37)], [.75, P(.17, .6, .37)], [1.25, P(.2, .86, .4)], [1.6, P(.64, .97, .1)], [1.85, P(.64, .97, .1)], [2.15, P(.22, .82, .44)], [2.4, P(.3, .6, .4)],
      [2.5, P(g, GARM.at[1], GARM.at[2])], [4.0, P(g, GARM.hi[1], GARM.hi[2])], [4.25, P(.2, .8, .42)], [4.8, P(.17, .6, .37)], [5.1, P(.17, .565, .37)], [5.25, P(.17, .6, .37)], [5.45, P(.17, .565, .37)], [5.6, P(.17, .6, .37)], [CC_D, P(.17, .6, .37)]];
    return [0, 1, 2].map(i => keys(T.map(([t, p]) => [t, p[i]]))); };
  const vars = [['sk', `(sin(${f(2 * PI * 5)} * t) * cBump(t, 2.75, 3.35))`], ['on', 'cS(t, 2.35, 2.5) * (1. - cS(t, 4.0, 4.1))'],
    ['gy', `(${keys([[0, GARM.at[1]], [2.5, GARM.at[1]], [2.75, GARM.at[1]], [3.4, GARM.at[1] + .01], [4.0, GARM.hi[1]], [CC_D, GARM.hi[1]]])} + .03 * sk)`],
    ['gz', keys([[0, GARM.at[2]], [3.4, GARM.at[2]], [4.0, GARM.hi[2]], [CC_D, GARM.hi[2]]])], ['ik', '1.']];
  const garment = { frame: 'chest', x: '0.', y: 'gy', z: 'gz', yaw: '0.', pitch: '(.1 * sk)', roll: '(.06 * sk)', show: 'step(2.5, t) * (1. - step(4.0, t))' };
  return { vars,
    body: { tx: keys([[0, .02], [.75, .08], [1.25, .2], [1.65, -.05], [2.3, .1], [3.4, .05], [3.9, .18], [4.3, .02], [5.4, .12], [CC_D, .02]]), ty: '(-.25 * cBump(t, 2.0, 2.55))', tz: '(.04 * cBump(t, 1.4, 1.8))', drop: '.01', bx: '0.', pr: '0.' },
    feet: { zL: '.03', zR: '-.03' },
    head: { hx: keys([[0, 0], [.4, .2], [.75, .2], [1.25, .38], [1.65, -.05], [1.9, 0], [2.3, .15], [2.6, .22], [3.4, .1], [3.8, .3], [4.0, .32], [4.3, 0], [5.0, .1], [5.4, .32], [5.9, .05], [CC_D, 0]]),
      hy: '(-.3 * cBump(t, 2.0, 2.55) + .15 * cBump(t, 2.4, 2.9))', hz: '(.08 * sin(18. * t) * cBump(t, 1.55, 1.9))' },
    arms: [0, 1].map(s => { const [x, y, z] = hand(s), G = propPt(garment, [s ? g : -g, 0, 0]);
      return { ik: { T: `mix(vec3(${x}, ${y}, ${z}), ${G}, on)`, frame: 'chest', pole: [s ? '1.' : '-1.', '-.7', '-.3'], k: 'ik' } }; }),
    props: { garment } }; })();

// ═══ THE STASH: floorboard_lift (2.0 s → floorboard_rummage) · floorboard_rummage (1.6 s loop) · floorboard_close (1.9 s one-shot)
// (stage/acts.js stash: a stash put or a stash take at home). The spec's 5.5 s one-shot with its middle (2.0–3.6) looped, cut where
// the registry can loop it (aim_draw → aim_hold → aim_lower's way): lift's last pose = rummage's first = rummage's last = close's first.
// THE RIG CAN'T KNEEL (the leg cloth wants the hip ≥ ~0.12 m over the ankle: CLIPS.md, get_up), and IT CAN'T REACH THE FLOOR IN FRONT:
// bent over far enough, the big head comes down onto the work, and a hand between the knees goes through them (the hand gate). So
// the floorboard is BESIDE the walker, at its +x side (FB.at), where the +x arm reaches straight down from a deep crouch on the balls
// of the feet, the chest leaning over to that side; the −x arm hangs out for balance. THE FLOORBOARD (acts-props.js floor and board, the
// entry's `board`): a patch of three planks along z, the middle one loose, hinged on its outer long edge. Its NEUTRAL open state: the
// dark gap and a plain parcel in it (the hand-over's kraft envelope), nothing else (no cash, no gold, no product: §19).
// Crouch, leaning over (0–0.8) · the +x hand under the loose board's inner edge, prised up (0.8–1.4: open at 1.4) and flipped up onto
// its outer edge, where it stands (1.4–1.75) · the hand to the gap (1.75–2.0, the rummage's start) · rummage: the hand in at the
// parcel (0–0.55), lifts it, turns it over and sets it back (0.6–1.4), back (1.4–1.6) · close: the board pushed back down from its top
// edge (0.1–0.6: closed at 0.6), pressed flat, up out of the crouch (0.9–1.9). In or out is the record's, a day late: the clip shows
// only the parcel handled in the gap.
const FB = { at: [.6, 0, .2], drop: .2, lean: -.5, tx: .3 }, BW = ACTS.board.w / 2, BY = ACTS.board.y, HN = [FB.at[0] + BW, BY, FB.at[2]];
// the board's pose (its centre's underside, body frame) from its lift angle a (0 shut … π/2 standing on its outer edge)
const boardPose = a => { const c = Math.cos(a), s = Math.sin(a);
  return { p: [HN[0] - BW * c, HN[1] + BW * s, HN[2]], R: [c, -s, 0, s, c, 0, 0, 0, 1] }; };
// the +x hand on the board's inner edge (a little over it), for a lift angle expression: GLSL / JS
const edge = a => [`(${f(HN[0])} - ${f(2 * BW)} * cos(${a}) + .035 * sin(${a}))`, `(${f(HN[1])} + ${f(2 * BW)} * sin(${a}) + .035 * cos(${a}))`, f(FB.at[2])];
const FB_UP = PI / 2, FB_LET = 1.05;
const crouch = c => ({ tx: `(${f(FB.tx)} * ${c})`, tz: `(${f(FB.lean)} * ${c})`, drop: `(${f(FB.drop)} * ${c})`, bx: `(.03 * ${c})` });
// the parcel in the gap (its centre, body frame: the envelope lying flat, its long side along z, its closed end toward −z) and up in
// the hand
const PCL = { gap: [FB.at[0], .025 + ERRANDS.envelope.d / 2, FB.at[2] + .03], up: [FB.at[0] - .03, .19, FB.at[2] + .01], roll: PI / 2 };
const HOVER = [FB.at[0] + .02, .16, FB.at[2] - .1], OUT = [.5, .48, .05], BAL = ['.25', '.55', '0.', '.1', '.25'];
const floorFeet = c => ({ zL: '.06', fL: `(-.14 * ${c})`, zR: '-.06', fR: `(-.3 * ${c})` });
const fbLift = (() => {
  const vars = [['c', 'cS(t, 0., .8)'], ['a', `min(${f(FB_UP)} * cS(t, .95, 1.6) + .05 * cBump(t, .8, .95), ${f(FB_UP)})`], ['k', 'cS(t, .55, .85) * (1. - cS(t, 1.3, 1.5))'],
    ['ah', `min(a, ${f(FB_LET)})`], ['rch', 'cS(t, 1.45, 1.95)']];
  const C = crouch('c'), [ex, ey, ez] = edge('ah');
  return { vars,
    body: { tx: C.tx, ty: '0.', tz: C.tz, drop: C.drop, bx: C.bx, pr: '0.' },
    feet: floorFeet('c'),
    head: { hx: '(.45 * c)', hy: '(.3 * c)', hz: `(${f(FB.lean)} * c * .6)` },
    arms: [{ free: BAL, fk: 'c' },
      { ik: { T: `mix(mix(vec3(${OUT.map(f).join(', ')}), vec3(${ex}, ${ey}, ${ez}), k), vec3(${HOVER.map(f).join(', ')}), rch)`, frame: 'body', pole: ['1.', '.1', '-.5'], k: 'cS(t, .02, .3)' } }],
    props: { parcel: { x: f(PCL.gap[0]), y: f(PCL.gap[1]), z: f(PCL.gap[2]), roll: f(PCL.roll), show: 'step(1.4, t)' } } }; })();
const RM_D = 1.6;
const fbRummage = (() => {
  // h: the +x hand on the parcel (0.5–1.5), lifted (0.65–1.3) and turned over about its long side (0.75–1.2)
  const vars = [['br', sw(1, RM_D)], ['h', 'cS(t, .3, .55) * (1. - cS(t, 1.35, 1.55))'], ['lf', 'cS(t, .6, .8) * (1. - cS(t, 1.1, 1.3))'], ['tn', 'cS(t, .75, 1.2)']];
  const C = crouch('1.'), up = PCL.up, gp = PCL.gap;
  const parcel = { x: `mix(${f(gp[0])}, ${f(up[0])}, lf)`, y: `mix(${f(gp[1])}, ${f(up[1])}, lf)`, z: `mix(${f(gp[2])}, ${f(up[2])}, lf)`, yaw: '0.', pitch: '(.2 * lf)', roll: `(${f(PCL.roll)} + ${f(PI)} * tn)`, show: '1.' };
  const G = propPt(parcel, ERRANDS.envelope.gripA);
  return { vars,
    body: { tx: `(${C.tx} + .01 * br)`, ty: '(.04 * lf)', tz: C.tz, drop: C.drop, bx: C.bx, pr: '0.' },
    feet: floorFeet('1.'),
    head: { hx: '(.45 - .05 * lf)', hy: '.3', hz: f(FB.lean * .6) },
    arms: [{ free: BAL }, { ik: { T: `mix(vec3(${HOVER.map(f).join(', ')}), ${G}, h)`, frame: 'body', pole: ['1.', '.1', '-.5'] } }],
    props: { parcel } }; })();
const CL_D = 1.9;
const fbClose = (() => {
  const vars = [['c', '(1. - cS(t, .9, 1.9))'], ['a', `(${f(FB_UP)} * (1. - cS(t, .15, .6)))`], ['k', 'cS(t, 0., .14) * (1. - cS(t, .8, .95))'], ['ps', 'cBump(t, .6, .78)'],
    ['ah', `min(a, ${f(FB_LET)})`]];
  const C = crouch('c'), [ex, ey, ez] = edge('ah');
  return { vars,
    body: { tx: C.tx, ty: '0.', tz: C.tz, drop: `(${C.drop} + .01 * ps)`, bx: C.bx, pr: '0.' },
    feet: floorFeet('c'),
    head: { hx: '(.45 * c)', hy: '(.3 * c - .25 * cBump(t, 1.1, 1.9))', hz: `(${f(FB.lean)} * c * .6)` },
    arms: [{ free: BAL, fk: 'c' },
      { ik: { T: `mix(mix(vec3(${HOVER.map(f).join(', ')}), vec3(${ex}, ${ey} - .015 * ps, ${ez}), k), vec3(${OUT.map(f).join(', ')}), cS(t, .95, 1.6))`, frame: 'body', pole: ['1.', '.1', '-.5'] } }],
    props: { parcel: { x: f(PCL.gap[0]), y: f(PCL.gap[1]), z: f(PCL.gap[2]), roll: f(PCL.roll), show: '(1. - step(.6, t))' } } }; })();
// the board, for the city's stage and the sheets: { at (the patch's centre, body frame), geometry(THREE, scheme?) (the loose board),
// floor(THREE, scheme?) (the patch), angle(t), pose(t) → { p, R } (body frame), matrix(THREE, t, out), floorMatrix(THREE, out) }, by each
// clip's own clock
const boardOf = angle => ({ at: FB.at.slice(), geometry: (THREE, s) => actsGeometry(THREE, 'board', s), floor: (THREE, s) => actsGeometry(THREE, 'floor', s),
  angle, pose: t => boardPose(angle(t)), matrix: (THREE, t, out = new THREE.Matrix4()) => actsMatrix(THREE, boardPose(angle(t)), out),
  floorMatrix: (THREE, out = new THREE.Matrix4()) => out.makeTranslation(FB.at[0], FB.at[1], FB.at[2]) });
const BOARD_LIFT = boardOf(t => Math.min(FB_UP * JS.cS(t, .95, 1.6) + .05 * JS.cBump(t, .8, .95), FB_UP)), BOARD_UP = boardOf(() => FB_UP), BOARD_CLOSE = boardOf(t => FB_UP * (1 - JS.cS(t, .15, .6)));
// (the lab's stand-in: the floor patch, where the city's stage lays it)
const FLOOR_SET = { id: 'acts-floor', geometry: THREE => { const g = actsGeometry(THREE, 'floor').clone(); g.translate(FB.at[0], FB.at[1], FB.at[2]); return g; } };

// ═══ SLEEP (4 s loop): asleep at home (interiors/city/plan.js: the bed's lie). ON THE BACK in a bed, A DUVET over the body to the chin
// (acts-props.js duvet: its own cover over the bed's), one slow breath a loop (the chest rises, the duvet with it), the head on the
// pillow, the chin tucked (the big head is 0.35 m deep behind the neck: level it would sink into the mattress), the arms down the sides
// under the duvet, the legs out straight. THE WALKER'S FRAME: its ground point on the mattress top at the sleeper's FEET, facing the
// bed's foot; the body lies back along −z from there (the head 1.7 m behind: the bed's pillow end). The root turns the whole body back
// a quarter turn about the pelvis and lays it on the mattress (SL).
const SL_D = 4, SL = { piv: [0, .5, .025], mov: [0, -.36, -.5] };
const sleep = {
  vars: [['br', sw(1, SL_D)]],
  body: { tx: '(.22 + .025 * br)', ty: '0.', tz: '0.', drop: '0.', bx: '0.', pr: '0.' },
  feet: { zL: '0.', fL: '.1', zR: '0.', fR: '.1' },
  head: { hx: '(.22 + .32 - .01 * br)', hy: '0.', hz: '.1' },
  extra: `cPiv = vec3(${SL.piv.map(f).join(', ')}); cRot.x = -1.5708; cMov = vec3(${SL.mov.map(f).join(', ')});`,
  arms: [{ free: ['.05', '.07', '0.', '.1', '.12'] }, { free: ['.05', '.07', '0.', '.1', '.12'] }],
  props: { duvet: { x: '0.', y: '(.006 * br)', z: '0.', show: '1.' } } };

// ═══ SHOVE_WALK (0.45 s one-shot, a WALKING OVERLAY: moving, speed 0, stride 1): an agent held up behind a walker shoves it out of the
// way without stopping (the city's lane C2-gore, traffic/accident.js). It writes only the chest, the head and the arms, so the legs are
// the walk's (CLIPS.md § Moods and reactions). THE SIDE is cLook's sign (the city sets g.look to the shoved walker's bearing, body
// frame, + to +x; 0 shoves to +x): both arms thrust out to that side at chest height, the lead arm out straight, the other across the
// chest, the elbows snapping straight (0.06–0.14 s, held to 0.25), the torso twisting into it and the head with it, then the arms come
// back into the walk's swing (0.25–0.42). The walk's own arm swing is the blend: every channel is mixed by k, so at k 0 it is the walk.
const SHOVE_GLSL = /* glsl */`
  float sd = cLook < 0. ? -1. : 1., k = cOut(t, .04, .13) * (1. - cS(t, .24, .43)), hit = cBump(t, .1, .2);
  int ld = sd > 0. ? 1 : 0, tr = 1 - ld;
  P.torso.y += sd * (.42 * k + .06 * hit * w); P.torso.z -= sd * .06 * k; P.torso.x += .08 * k;
  P.head.y += sd * .12 * k; P.head.x -= .05 * k;
  cArm(P, ld, vec4(1.05, 1.05, -.1, .2), mix(1.2, .08, cS(t, .06, .14)), k);
  cArm(P, tr, vec4(1.38, .3, .55, .1), mix(1.25, .3, cS(t, .07, .15)), k);`;

export const CLIPS = [
  clip({ name: 'phone_up', dur: 1.05, next: 'phone_call', blendIn: .2, blendOut: .3, track: phoneUp, prop: 'phone', model: PHONE_M,
    note: 'a one-shot → phone_call (prop: phone, the +x hand): both hands in the hoodie pocket (the blend-in takes them there), the phone out (0.45 s) and up to the ear round the shoulder 0.55–1.05, the head tilts to it; ends exactly on the call\'s pose' }),
  clip({ name: 'phone_call', dur: PC_D, loop: true, blendIn: .3, blendOut: .3, track: phoneCall, prop: 'phone', model: PHONE_M,
    note: 'a loop, on the phone (prop: phone at the ear, the +x fist beside the head; start it from phone_up, end it with phone_down at a wrap): two breaths, the weight over and back · two nods 0.55–1.2 s · the free hand out of the pocket and turned out once 2.0–3.25, the eyes on it · a glance round 3.45–4.55 (the chest turns away from the phone, the head with it) · no lip sync' }),
  clip({ name: 'phone_down', dur: 1.2, blendIn: .2, blendOut: .3, track: phoneDown, prop: 'phone', model: PHONE_M,
    note: 'a one-shot from the call\'s pose (phone_call at a wrap): the phone down into the pocket 0.05–0.55 (gone at 0.6) · a look back over the −x shoulder 0.62–1.2 · ends with the hands in the pocket (blends out)' }),
  clip({ name: 'phone_type', dur: TY_D, loop: true, blendIn: .3, blendOut: .3, track: phoneType, prop: 'phone', model: PHONE_M,
    note: 'a loop (prop: phone in both hands at chest height, its screen up to the eyes, plain): thumbing 0–1.6 s · a pause, reading 1.6–2.4 · the head up and round once 2.4–3.2 · thumbing again 3.2–4' }),
  clip({ name: 'earpiece_listen', dur: EP_D, loop: true, blendIn: .4, blendOut: .4, track: earpiece,
    note: 'a loop, no prop: the +x hand up at the ear (the earpiece), pressed in 0.05–0.5 s, the head tilting into it · the head down and still, listening · a glance round 4.0–4.7 (the chest away from the hand) · the hand stays up' }),
  clip({ name: 'parcel_tuck', dur: TK_D, blendIn: .1, blendOut: .3, track: tuck, prop: 'parcel', model: ENVELOPE_M,
    note: 'a one-shot after act_take (bribe_take\'s last pose: the −x hand at its pocket, the chin up; prop: the plain parcel, the −x hand): out of the pocket and weighed in the hand 0–0.6 s (two bounces), the head down to it · turned once 0.6–1.2 · a glance round · tucked into the hoodie\'s front 1.2–2.0 (gone at 1.85) · patted flat with both hands 2.0–2.4 · ends with both hands at the pocket (blends out)' }),
  clip({ name: 'haggle_counter', dur: HG_D, loop: true, blendIn: .35, blendOut: .35, track: haggle, more: { set: COUNTER_SET, counter: { ...ACTS.counter } },
    note: 'a loop at a counter (its top 0.74 m, its near edge 0.26 m ahead: acts-props.js counter, the lab\'s stand-in): forearms on it, leaning, the elbows out 0–0.8 s · a point: the +x hand slides forward, the chest leans in, the eyes down 0.8–1.6 · a shrug, the hands up off it and open 1.6–2.4 · a head shake and a lean back, the hands on its edge 2.4–3.4 · back on the counter 3.4–4.4' }),
  clip({ name: 'change_clothes', dur: CC_D, blendIn: .25, blendOut: .4, track: change, prop: 'garment', model: GARMENT_M,
    note: 'a one-shot, then the stand (prop: garment, the new top, both hands): the hands at the hem (the blend-in takes them there) · pulled up to the chin, the head ducked into it 0.75–1.25 · up and out at the head\'s sides 1.25–1.85 · tossed down and aside 1.9–2.4 · the new one from beside the hip (2.5), shaken open in front 2.75–3.35 · pulled on over the head 3.4–4.0 (gone) · drawn down to the hem 4.0–4.8 · the hem tugged twice, a look down 5.0–5.9 · ends with the hands at the hem (blends out to the stand)' }),
  clip({ name: 'floorboard_lift', dur: 2, next: 'floorboard_rummage', blendIn: .25, blendOut: .3, track: fbLift, prop: 'parcel', model: ENVELOPE_M, more: { board: BOARD_LIFT, set: FLOOR_SET },
    note: 'a one-shot → floorboard_rummage (the floorboard patch ahead: the entry\'s `board`; prop: the plain parcel in the gap): down into a crouch on the balls of the feet, leaning over to the +x side where the patch lies 0–0.8 s · the +x hand under the loose board\'s inner edge, prised up 0.8–1.4 (open at 1.4) and flipped up onto its outer edge, standing 1.4–1.6 · the hand to the gap 1.45–2.0; the −x arm out for balance' }),
  clip({ name: 'floorboard_rummage', dur: RM_D, loop: true, blendIn: .2, blendOut: .3, track: fbRummage, prop: 'parcel', model: ENVELOPE_M, more: { board: BOARD_UP, set: FLOOR_SET },
    note: 'a loop, crouched at the open floorboard (between floorboard_lift and floorboard_close, switching at a wrap): the +x hand in at the parcel 0.3–0.55 s · lifts it, turns it over and sets it back 0.6–1.3 · back 1.35–1.55. In or out is the record\'s, a day late' }),
  clip({ name: 'floorboard_close', dur: CL_D, blendIn: .2, blendOut: .3, track: fbClose, prop: 'parcel', model: ENVELOPE_M, more: { board: BOARD_CLOSE, set: FLOOR_SET },
    note: 'a one-shot from floorboard_rummage at a wrap: the board pushed back down from its top edge 0.15–0.6 s (closed at 0.6, the parcel under it), pressed flat · up out of the crouch 0.9–1.9, a look round; ends in the stand' }),
  clip({ name: 'sleep', dur: SL_D, loop: true, blendIn: .4, blendOut: .4, track: sleep, prop: 'duvet', model: DUVET_M,
    note: 'a loop: on the back in a bed under a duvet (prop: duvet), the walker\'s ground point on the mattress at the feet, facing the bed\'s foot (the body lies back along −z, the head 1.7 m behind) · one slow breath a loop, the duvet rising with it · the chin tucked on the pillow, the arms down the sides' }),
  { ...clip({ name: 'shove_walk', dur: .45, moving: true, speed: 0, stride: 1, blendIn: .05, blendOut: .15, track: { body: {}, head: {}, arms: [] }, glsl: SHOVE_GLSL,
    note: 'a one-shot WALKING OVERLAY (moving, speed 0: the walker keeps its own pace and legs): both arms thrust out to cLook\'s side (+x when cLook ≥ 0) at chest height 0.04–0.13 s, held to 0.24, the torso twisting into it, back into the walk\'s swing by 0.43' }) },
];
