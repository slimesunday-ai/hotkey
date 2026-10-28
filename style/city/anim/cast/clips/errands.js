// CLIPS · errands (activities): the small ones: phoning in a tip, handing over a bribe, a Cop on guard, the ferry gangway, an evicted agent carrying everything (GAME.md §20; 2026-10-15). One owner; CLIPS.md has the entry format.
// (the errands agent, 2026-10-15; errands.md has what the city must stage: the vault door, the gangway and its rail, the cop)
//   phone_tip        6 s one-shot · phoning in a tip: the phone out of the hoodie pocket and up to the ear, a glance round, a short
//                    call, the phone away (prop: phone, phone-prop.js)
//   bribe_pass       1.8 s one-shot (pair → bribe_take) · the briber: an envelope out of the pocket, passed low and quick at the side,
//                    let go (prop: envelope, errands-props.js)
//   bribe_take       2 s one-shot · the cop: takes the envelope and pockets it (prop: the same envelope, from the handoff)
//   guard_post       12 s loop · a Cop on guard at the vault door: feet planted, the chest up, the thumbs in the belt at its front (the
//                    elbows out); long looks left and right, a rock up onto the toes, a belt hitch, a look at the watch
//   gangway_up       0.85 s loop, TRAVELLING on its own legs up a slope · boarding the ferry: leaning into the climb, the +x hand
//                    sliding up the rail
//   evicted_carry    4.4 s loop, TRAVELLING on its own legs · an evicted agent with everything it owns tied up in a bedsheet, hugged at
//                    the chest (prop: bundle, errands-props.js): a tired, heavy walk; the bundle bounces and sways a beat behind it
// THE METHOD (heist.js's, work.js's): every clip is ONE TRACK of scalar expressions valid in GLSL and JS (the body, the feet, the eyes,
// each arm's free angles or its hand's IK target, each prop's pose). The GLSL poses the body from it and puts a hand ON its target with
// the two-bone IK on the elbow (the reach sets the elbow, the shoulder turns the bent arm so its grip point lands on the target, the
// elbow toward a pole); the CPU evaluates the same strings for the props, so a fist and its prop cannot part (a prop's pose IS its
// hand's target). THE TOON ARM reaches only 0.403–0.453 m from the shoulder (x ±0.25, y 0.825) with the elbow ≤ 83° (under the thick
// sleeve's soft cap); the big head (x ±0.4, the ears to ±0.5 at y 1.15–1.4, y 0.95–1.7, z −0.35…0.4) owns everything above the chin.
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll (+: the top toward −x). The head's channels are the EYES in the body frame (P.head = them − the chest).
// Feet: cFoot (the ground point's body-frame z), or a walking foot placed by its own pivot (wFoot, below).

import { phoneGeometry, phoneMatrix, phonePoint } from './phone-prop.js';
import { errandsGeometry, errandsMatrix, errandsPoint } from './errands-props.js';

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

// ── A WALKING FOOT on its own legs (a clip that travels at `speed` with the walk's weight at 0: walk_hurt's and the stairs' way), on
// level ground or a slope (rise sl per metre, angle th). ph = the foot's cycle phase (one cycle C s = two steps); the stance [0, ST):
// the heel lands at zH (P.ank's frame: z from the hips' line) toe-up by aS, the foot rolls flat by p1 and stays planted (it slides
// back at the travel, V·C a cycle: the ground under a moving body), the heel lifts about the planted toe from p2 to the toe-off at
// ST (heel up by aO); the swing carries the ankle from the toe-off to the next heel strike, lifted by `lift`, the toe up as it passes.
// Every pivot is ON the slope (a heel or a toe at z sits at sl · (z + A_HIPZ)), so the planted foot never slips or sinks. Returns the
// track vars it needs (named after n) and the ankle's z and y and the foot's pitch, expressions valid in GLSL and JS (P.ank, P.fp).
function wFoot(n, o) {
  const { C, ph0, ST, p1, p2, zH, V, th = 0, aS, aO, lift } = o, sl = Math.tan(th), LT = RIG.heel + RIG.toe, run = V * C;
  const PH = `${n}ph`, HZ = `${n}hz`, TZ = `${n}tz`, FS = `${n}fs`, SS = `${n}ss`, SW = `${n}sw`, PV = `${n}pv`;
  // the swing's ends (numbers): the toe-off (the toe pivot at ST) and the next strike (the heel pivot at the landing spot)
  const fO = th - aO, fI = th + aS, tO = zH + LT * Math.cos(th) - run * ST;
  const z0 = tO - RIG.toe * Math.cos(fO) - RIG.ank * Math.sin(fO), y0 = sl * (tO + RIG.hipZ) - RIG.toe * Math.sin(fO) + RIG.ank * Math.cos(fO);
  const z1 = zH + RIG.heel * Math.cos(fI) - RIG.ank * Math.sin(fI), y1 = sl * (zH + RIG.hipZ) + RIG.heel * Math.sin(fI) + RIG.ank * Math.cos(fI);
  const vars = [[PH, `mod(t / ${f(C)} + ${f(ph0)}, 1.)`],
    // the stance: the heel's spot and the toe's (both slide back at the travel), the pitch; the pivot (heel, then toe); the swing's share
    [HZ, `(${f(zH)} - ${f(run)} * ${PH})`], [TZ, `(${f(zH + LT * Math.cos(th))} - ${f(run)} * ${PH})`],
    [SW, `step(${f(ST)}, ${PH})`], [PV, `step(${f(p2)}, ${PH})`], [SS, `clamp((${PH} - ${f(ST)}) / ${f(1 - ST)}, 0., 1.)`],
    [FS, `mix(${f(th)} + ${f(aS)} * (1. - cS(${PH}, 0., ${f(p1)})) - ${f(aO)} * cS(${PH}, ${f(p2)}, ${f(ST)}), mix(${f(fO)}, ${f(fI)}, cS(${SS}, .1, .85)) + .12 * cBump(${SS}, .15, .7), ${SW})`]];
  const heelZ = `${HZ} + ${f(RIG.heel)} * cos(${FS}) - ${f(RIG.ank)} * sin(${FS})`, heelY = `${f(sl)} * (${HZ} + ${f(RIG.hipZ)}) + ${f(RIG.heel)} * sin(${FS}) + ${f(RIG.ank)} * cos(${FS})`;
  const toeZ = `${TZ} - ${f(RIG.toe)} * cos(${FS}) - ${f(RIG.ank)} * sin(${FS})`, toeY = `${f(sl)} * (${TZ} + ${f(RIG.hipZ)}) - ${f(RIG.toe)} * sin(${FS}) + ${f(RIG.ank)} * cos(${FS})`;
  return { vars, fp: FS,
    z: `mix(mix(${heelZ}, ${toeZ}, ${PV}), mix(${f(z0)}, ${f(z1)}, smoothstep(0., 1., ${SS})), ${SW})`,
    y: `mix(mix(${heelY}, ${toeY}, ${PV}), mix(${f(y0)}, ${f(y1)}, ${SS}) + ${f(lift)} * sin(3.14159265 * ${SS}), ${SW})` };
}

// ═══ GUARD_POST (12 s loop): a Cop on guard at the vault door (Precinct 9, Glasswall: GAME.md §13; the city stands the guard with the
// door behind it, errands.md). Feet planted, a hair apart, the chest up and the chin up (from the street camera: the face, not the
// crown), the thumbs in the belt at its front (the hands where the hoodie pocket's are, a hair wider, the elbows out: the toon arm can't
// fold, and a hand ON the hip is inside the reach shell). Beats: a long look to −x 0.9–3.6 s · a long look to +x 3.9–6.6 · up onto the
// toes twice and back 6.9–8.1 (a rock: the heels up, the body rising) · a belt hitch 8.35–8.9 (both hands hike it, the knees dip) ·
// a look at the watch 9.3–10.9 (the −x forearm comes across the front, the head down to it) · a settle of the shoulders 11.1–11.7.
// Three 4 s breaths and a 12 s weight shift: every rhythm divides D, every key returns to its start.
const GP_D = 12, BELT = [.17, .625, .365], BELT_POLE = [1, -.8, -.5], WATCH = [-.1, .67, .385];
const guard = (() => {
  const vars = [['br', sw(3, GP_D)], ['ws', `(.5 * ${sw(1, GP_D)} + .3 * ${sw(2, GP_D, .7)})`],
    ['lk', keys([[0, 0], [.9, 0], [1.5, -.85], [3.0, -.85], [3.6, 0], [3.9, 0], [4.5, .85], [6.0, .85], [6.6, 0], [GP_D, 0]])],
    ['rk', '(cBump(t, 6.9, 7.5) + .8 * cBump(t, 7.5, 8.1))'], ['hh', 'cBump(t, 8.35, 8.9)'],
    ['wt', 'cS(t, 9.3, 9.65) * (1. - cS(t, 10.5, 10.9))'], ['wl', 'cS(t, 9.45, 9.75) * (1. - cS(t, 10.35, 10.7))'], ['sh', 'cBump(t, 11.1, 11.7)']];
  return { vars,
    body: { tx: '(-.05 + .02 * br + .05 * wl - .025 * sh)', ty: '(.2 * lk - .05 * wl)', tz: '(-.03 * ws)', drop: '(.008 + .004 * (.5 - .5 * br) - .035 * rk + .022 * hh)', bx: '(.02 * ws)', pr: '(.06 * ws)' },
    feet: { zL: '.05', fL: '(-.22 * rk)', zR: '-.05', fR: '(-.22 * rk)' },
    head: { hx: '(-.07 + .01 * br + .32 * wl - .06 * sh)', hy: '(lk - .12 * wl)', hz: '(.03 * ws - .04 * sh)' },
    arms: [{ ik: { x: `mix(${f(-BELT[0])}, ${f(WATCH[0])}, wt)`, y: `(mix(${f(BELT[1])}, ${f(WATCH[1])}, wt) + .035 * hh)`, z: `(mix(${f(BELT[2])}, ${f(WATCH[2])}, wt) + .01 * hh)`, frame: 'chest',
      pole: [`mix(${f(-BELT_POLE[0])}, -1., wt)`, `mix(${f(BELT_POLE[1])}, -.4, wt)`, `mix(${f(BELT_POLE[2])}, -.3, wt)`] } },
      { ik: { x: f(BELT[0]), y: `(${f(BELT[1])} + .035 * hh)`, z: `(${f(BELT[2])} + .01 * hh)`, frame: 'chest', pole: BELT_POLE.map(f) } }] }; })();

// ═══ PHONE_TIP (6 s one-shot): phoning in a tip (GAME.md §13: name an agent and its target tonight). THE PHONE is phone-prop.js's (the
// loud case: what the street sees), in the +x fist. The hand goes to the hoodie pocket and the phone appears in it (0.45 s), comes up
// to the ear round the shoulder on the reach shell (out in front, then up at the side below the head: onShell; a straight Euler blend
// would carry the fist through the head's corner, hail_taxi's lesson) and is held there, the fist beside the head's lower side (EAR: hail_taxi's raised hand, the reach shell
// allows no higher), the phone standing up from it along the side of the head to the ear, its back out; the head tilts to it. A glance
// round while it rings (the chest turns, the head with it: turned toward the phone it would meet the fist) · the call: hunched into it,
// turned a little away, three nods · the phone down to the pocket (gone by 5.12) and a look back over the −x shoulder. Both hands are
// in the hoodie pocket from the start (the −x one throughout) and at the end: the blend in and out carry them there and back, as for
// the deal-hang pocket clips (an in-clip move from the hanging arm into the pocket swept the hand through a baggy thigh: the hand gate).
const PT_D = 6, EAR = [.665, .95, .08], EAR_POLE = [.8, -.8, .5];
// (the phone's x axis points from its far end to the grip end; at the ear its back, the loud case, faces out and forward)
const PH_AXES = { pocket: axesXZ([.3, -.2, -.93], [0, 1, 0]), out: axesXZ([-.9, -.15, -.4], [0, 1, 0]), ear: axesXZ([.3, -1, -.08], [.75, .25, .62]) };
const phoneTip = (() => {
  const vars = [['up', 'cS(t, .55, 1.05) * (1. - cS(t, 4.55, 5.05))'],
    ['gl', keys([[0, 0], [1.25, 0], [1.6, -.35], [2.05, -.35], [2.4, .3], [2.85, .3], [3.15, 0], [PT_D, 0]])], ['cl', 'cS(t, 3.0, 3.3) * (1. - cS(t, 4.45, 4.8))'],
    ['tk', '(.07 * cBump(t, 3.25, 3.5) + .05 * cBump(t, 3.6, 3.85) + .07 * cBump(t, 4.05, 4.3))'], ['lb', 'cS(t, 5.25, 5.45) * (1. - cS(t, 5.65, 5.95))'], ['br', sw(2, PT_D)]];
  const [ex, ey, ez] = onShell(1, POCKET, EAR, 'up');
  return { vars,
    body: { tx: '(.03 + .05 * cl + .015 * br)', ty: '(gl - .12 * cl)', tz: '(.08 * up)', drop: '.01', bx: '-.02', pr: '-.05' },
    feet: { zL: '.03', zR: '-.04', fR: '(-.12 * cl)' },
    head: { hx: '(.12 * cBump(t, .3, .8) + tk + .02 - .04 * lb)', hy: '(gl + .35 * min(gl, 0.) - .12 * cl - .55 * lb)', hz: '(-.15 * up + .04 * cl)' },
    arms: [{ ik: { x: f(-POCKET[0]), y: f(POCKET[1]), z: f(POCKET[2]), frame: 'chest', pole: [f(-POCKET_POLE[0]), f(POCKET_POLE[1]), f(POCKET_POLE[2])] } },
      { ik: { x: ex, y: ey, z: ez, frame: 'chest', pole: [0, 1, 2].map(i => `mix(${f(POCKET_POLE[i])}, ${f(EAR_POLE[i])}, up)`) } }],
    props: { phone: { frame: 'chest', x: ex, y: ey, z: ez, show: 'step(.45, t) * (1. - step(5.12, t))',
      // (on the way, its far end swings out to the side: pointing up any sooner it clipped the chin's corner)
      rot: rotKeys([[.55, PH_AXES.pocket], [.8, PH_AXES.out], [1.05, PH_AXES.ear], [4.55, PH_AXES.ear], [4.8, PH_AXES.out], [5.05, PH_AXES.pocket]]) } } }; })();

// ═══ BRIBE_PASS and BRIBE_TAKE (a pair, face to face 1.02 m apart, the same start): handing a cop an envelope, low and quick (GAME.md §13:
// "cops can be bribed"). The briber's +x hand and the cop's −x hand are on the same side (facing, one's +x is the other's −x), so the
// envelope passes straight between them, low (at the hips) and out at that side, under the big heads' overhang. THE ENVELOPE
// (errands-props.js) is ONE track in the briber's frame (its centre and the way its long axis points), and each fist is put on it by
// the IK: the briber's on its closed end (gripA), the cop's on its bills end (gripB), mapped into the cop's frame (turned round and
// 1.02 m on). Each clip draws it while its own hand has it: the briber's from its pocket (0.3 s) to the handoff (0.92), the cop's
// from the handoff to its own pocket (1.3); at 0.92 both are the same place. THE HEADS set the gap (both fronts at z 0.4): through the
// pass both keep their chins UP, the eyes over the other's head (neither looks at the other or at the money: "I see nothing"), which
// tips the big heads' fronts back and lifts a cap's brim clear of the other's face (a fitted cap's brim sticks out 0.75 m from the neck:
// level, at this gap it would be 0.2 m inside the other's head). So no glances while they stand there: a turned head swings its brim
// across. THE REACH: both fists stay 0.41–0.42 m from their shoulders through the pass (the shell is 0.403–0.453), so the cop doesn't
// dip its knees. The briber: its +x hand in the hoodie pocket from the start, the envelope out low to its +x side (0.3–0.56), the cop's
// fingers close on it (0.72), a press, let go (0.92), the hand back in the pocket, a nod (the chin up a little more), the chest turned
// a little away · the cop: the +x thumb in the belt from the start, the −x hand out low (0.48–0.7), takes it (0.92) to its pocket (1.3:
// gone), the chest turned a little away. Both end with their hands where they are (the pocket, the belt) and blend out from there.
const BR = { gap: 1.02, pass: [.3, .62, .39], pocket: [.16, .629, .37], copPocket: [-.16, .629, .37], half: .13 };
const dirOf = (yw, pt) => [Math.cos(pt) * Math.sin(yw), Math.sin(pt), Math.cos(pt) * Math.cos(yw)];
const envelope = (() => {
  const d0 = [.4, -.2], d1 = [0, 0], d3 = [-.31, -.2], D0v = dirOf(...d0), D3v = dirOf(...d3), H = BR.half;
  const c0 = BR.pocket.map((v, i) => v + H * D0v[i]), c1 = [BR.pass[0], BR.pass[1], BR.pass[2] + H];
  // (the cop's pocket, in the briber's frame)
  const cp = [-BR.copPocket[0], BR.copPocket[1], BR.gap - BR.copPocket[2]], c3 = cp.map((v, i) => v - H * D3v[i]);
  const K = (i, a, b, c) => keys([[0, a[i]], [.3, a[i]], [.56, b[i], 'cOut'], [.92, b[i]], [1.3, c[i]]]);
  return [['ecx', K(0, c0, c1, c3)], ['ecy', `(${K(1, c0, c1, c3)} - .006 * cBump(t, .7, .86))`], ['ecz', `(${K(2, c0, c1, c3)} + .01 * cBump(t, .72, .88))`],
    ['eyw', K(0, d0, d1, d3)], ['ept', K(1, d0, d1, d3)],
    ['edx', 'cos(ept) * sin(eyw)'], ['edy', 'sin(ept)'], ['edz', 'cos(ept) * cos(eyw)']]; })();
// the envelope prop: its centre, its long axis along +z turned by (yaw, −pitch), its face upright
const ENV_PROP = { x: 'ecx', y: 'ecy', z: 'ecz', yaw: 'eyw', pitch: '(-ept)', roll: '0.' };
// the briber's fist leaves the envelope at the handoff: its target freezes where gripA was then
const BR_REL = (() => { const tr = jsTrack({ vars: envelope, body: {}, head: {}, arms: [] }, 2, false), v = tr(.92).vars; return [v.ecx - BR.half * v.edx, v.ecy - BR.half * v.edy, v.ecz - BR.half * v.edz]; })();
const bribePass = { vars: [...envelope, ['rl', 'cS(t, .95, 1.28)'], ['ln', 'cS(t, .3, .55) * (1. - cS(t, .95, 1.3))'],
    ['la', 'cS(t, 1.35, 1.5) * (1. - cS(t, 1.6, 1.78))']],
  body: { tx: '.01', ty: '(-.06 * ln - .08 * la)', drop: '(.006 + .03 * ln)', bx: '(.015 * ln)', pr: '(.035 * ln)' },
  feet: { zL: '.02', zR: '-.03' },
  head: { hx: '(-.4 - .06 * cBump(t, 1.12, 1.4))', hy: '0.', hz: '0.' },
  // (the free hand eased out from the thigh as the knees dip)
  arms: [{ free: ['(-.04 * ln)', '(.1 + .08 * ln)', '0.', '.2', '(.12 + .05 * ln)'] },
    { ik: { x: `mix(mix(ecx - ${f(BR.half)} * edx, ${f(BR_REL[0])}, step(.92, t)), ${f(BR.pocket[0])}, rl)`, y: `mix(mix(ecy - ${f(BR.half)} * edy, ${f(BR_REL[1])}, step(.92, t)), ${f(BR.pocket[1])}, rl)`,
      z: `mix(mix(ecz - ${f(BR.half)} * edz, ${f(BR_REL[2])}, step(.92, t)), ${f(BR.pocket[2])}, rl)`, frame: 'body', pole: ['.8', '-1.', '-.2'] } }],
  props: { envelope: { ...ENV_PROP, show: 'step(.3, t) * (1. - step(.92, t))' } } };
const bribeTake = { vars: [...envelope, ['kB', 'cS(t, .48, .7)'], ['tl', 'cS(t, .45, .7) * (1. - cS(t, 1., 1.35))'],
    ['la', 'cS(t, 1.35, 1.5) * (1. - cS(t, 1.6, 1.78))']],
  // (no dip: the take stays in the reach shell)
  body: { tx: '(.015 - .025 * tl)', ty: '(.06 * tl - .08 * la)', drop: '.006', bx: '(-.015 * tl)', pr: '(-.035 * tl)' },
  feet: { zL: '-.02', zR: '.03' },
  head: { hx: '-.4', hy: '0.', hz: '0.' },
  arms: [{ ik: { x: `(-(ecx + ${f(BR.half)} * edx))`, y: `(ecy + ${f(BR.half)} * edy)`, z: `(${f(BR.gap)} - (ecz + ${f(BR.half)} * edz))`, frame: 'body', pole: ['-.8', '-1.', '-.2'], k: 'kB' } },
    { ik: { x: f(BELT[0]), y: f(BELT[1]), z: f(BELT[2]), frame: 'chest', pole: BELT_POLE.map(f) } }],
  props: { envelope: { ...ENV_PROP, show: 'step(.92, t) * (1. - step(1.3, t))' } } };
// the briber's frame → the cop's: turned round (π about y) and BR.gap on
const toCop = (p, R) => ({ p: [-p[0], p[1], BR.gap - p[2]], R: R.map((v, i) => i % 3 === 1 ? v : -v) });

// ═══ GANGWAY_UP (0.85 s loop, TRAVELLING at 0.75 m/s on its own legs up a slope of 0.24 rad, 13.75°): every agent who boards the
// ferry on the last night (GAME.md §15). A standing-leg clip with a speed (stairs_up's contract): the owner moves the walker along the
// gangway at `speed` and up at ramp.vy, keeps the walk weight at 0 and starts it at the gangway's foot. Two steps a loop, each foot
// planted ON the slope (the heel strikes toe-up, rolls flat along the slope, pushes off from the toe), shorter, more careful steps than
// the walk; the body leans into the climb (the chest 0.3 rad), the eyes on the ramp a few metres ahead; the +x hand slides up the rail
// (GW.rail: its top 0.6 m over the ramp, 0.64 m out to +x, the hand on it 0.16 m ahead: the city builds the rail there, errands.md),
// the −x arm swings against the legs, out wide (its hand clears the baggy thigh swinging past it).
const GW = { th: .24, V: .75, C: .85, rail: { x: .64, h: .6, z: .16 } }, GW_SL = Math.tan(GW.th);
const gangway = (() => { const o = { C: GW.C, ST: .62, p1: .12, p2: .42, zH: .025, V: GW.V, th: GW.th, aS: .15, aO: .4, lift: .05 };
  const L = wFoot('fl', { ...o, ph0: 0 }), R = wFoot('fr', { ...o, ph0: .5 });
  const vars = [...L.vars, ...R.vars, ['cy', `cos(${f(2 * PI / GW.C)} * t)`], ['sx', `sin(${f(2 * PI / GW.C)} * t - ${f(2 * PI * .06)})`], ['bo', `cos(${f(4 * PI / GW.C)} * t)`]];
  return { vars, ank: { zL: L.z, yL: L.y, fL: L.fp, zR: R.z, yR: R.y, fR: R.fp },
    body: { tx: '(.3 + .02 * bo)', ty: '(.07 * cy)', tz: '(-.02 * sx)', drop: '-.03', bx: '(-.018 * sx)', pr: '(.04 * sx)' },
    head: { hx: '(.08 - .01 * bo)', hy: '(-.03 * cy)', hz: '(.015 * sx)' },
    arms: [{ free: ['(.1 - .3 * cy)', '(.22 + .04 * max(cy, 0.))', '0.', '.15', '(.2 + .25 * max(-cy, 0.))'] },
      { ik: { x: f(GW.rail.x), y: f(GW.rail.h + GW_SL * (GW.rail.z + RIG.hipZ)), z: f(GW.rail.z), frame: 'body', pole: ['1.', '-.5', '-.6'] } }] }; })();

// ═══ EVICTED_CARRY (4.4 s loop, TRAVELLING at 0.62 m/s on its own legs): an evicted agent carrying everything it owns (GAME.md §10: no
// home, so everything you own is on you). THE BUNDLE (errands-props.js: a bedsheet tied round it all, a lamp sticking out of the knot)
// is hugged at the chest in both arms, the hands on its sides (the IK, on the bundle's own grip points, so they ride it). A tired,
// heavy walk on its own legs (walk_hurt's way: the owner moves it at `speed`, the walk weight at 0): short, flat, scuffing steps (the
// feet barely lift), the weight dropping onto each one, a waddle side to side over the standing foot, leaning back against the load,
// the head down and tilted. THE BUNDLE'S SECONDARY MOTION: it sinks a beat after each step lands and comes back (a bounce, lagging
// the body's dip by ~0.1 s), and it rolls and twists a beat behind the waddle (a sway), the hands going with it; a hitch at 2.4–2.9 s
// (bumped up, re-gripped); a slow, weary roll of the head 3.4–4.2. It shows from 0.5 s of the clip's first pass on (the blend-in is
// done and the hands are on it; between plays, at t 0, it is not drawn).
const EV = { V: .62, C: 1.1, n: 4 }, EV_D = EV.C * EV.n, BUN = { y: .665, z: .385, grip: .34 };
const evicted = (() => { const o = { C: EV.C, ST: .66, p1: .1, p2: .45, zH: .03, V: EV.V, th: 0, aS: .12, aO: .3, lift: .03 };
  const L = wFoot('fl', { ...o, ph0: 0 }), R = wFoot('fr', { ...o, ph0: .5 }), w = f(2 * PI / EV.C);
  const vars = [...L.vars, ...R.vars,
    // the waddle (the −x foot's stance peaks at t ≈ 0.36 s), the dip after each step lands (twice a cycle) and the bundle's, a beat later
    ['sx', `sin(${w} * t - ${f(2 * PI * .08)})`], ['sl', `sin(${w} * t - ${f(2 * PI * .2)})`], ['cy', `cos(${w} * t)`],
    ['dq', `(.5 + .5 * cos(${f(4 * PI / EV.C)} * t - ${f(2 * PI * .15)}))`], ['dp', 'dq * dq'], ['bq', `(.5 + .5 * cos(${f(4 * PI / EV.C)} * t - ${f(2 * PI * .35)}))`], ['bb', 'bq * bq'],
    ['hi', 'cBump(t, 2.4, 2.9)'], ['hs', 'cS(t, 3.4, 3.7) * (1. - cS(t, 3.9, 4.25))']];
  const bundle = { frame: 'chest', x: '(.015 * sl)', y: `(${f(BUN.y)} - .026 * bb + .04 * hi)`, z: `(${f(BUN.z)} + .008 * dp)`, yaw: '(.03 * cy)', pitch: '(.12 + .04 * bb - .04 * hi)', roll: '(.075 * sl)', show: 'step(.5, T)' };
  return { vars, ank: { zL: L.z, yL: L.y, fL: L.fp, zR: R.z, yR: R.y, fR: R.fp },
    body: { tx: '(-.06 + .03 * dp - .05 * hi)', ty: '(.05 * cy)', tz: '(.055 * sx)', drop: '(.02 + .018 * dp + .015 * hi)', bx: '(-.02 * sx)', pr: '(.05 * sx)' },
    head: { hx: '(.04 + .02 * dp - .08 * hi)', hy: '(-.03 * cy - .25 * hs)', hz: '(.08 + .02 * sx - .14 * hs)' },
    arms: [0, 1].map(s => ({ ik: { T: propPt(bundle, [s ? BUN.grip : -BUN.grip, 0, 0]), frame: 'chest', pole: [s ? '1.' : '-1.', '-.5', '-.3'] } })),
    props: { bundle } }; })();

// the props' models (phone-prop.js; errands-props.js)
const PHONE_M = { id: 'phone', geometry: (THREE, s) => phoneGeometry(THREE, s), matrix: phoneMatrix, point: phonePoint };
const ENV_M = { id: 'envelope', geometry: (THREE, s) => errandsGeometry(THREE, 'envelope', s), matrix: errandsMatrix, point: errandsPoint };
const BUNDLE_M = { id: 'bundle', geometry: (THREE, s) => errandsGeometry(THREE, 'bundle', s), matrix: errandsMatrix, point: errandsPoint };

export const CLIPS = [
  clip({ name: 'phone_tip', dur: PT_D, blendIn: .2, blendOut: .3, track: phoneTip, prop: 'phone', model: PHONE_M,
    note: 'a one-shot (prop: phone, the +x hand): both hands in the hoodie pocket (the blend-in takes them there), the phone out (0.45 s) and up to the ear round the shoulder 0.55–1.05, the head tilts to it · a glance round while it rings 1.25–3.15 (the chest turns, the head with it) · the call 3.0–4.5: hunched, turned a little away, three nods · the phone down to the pocket 4.55–5.05 (gone at 5.12) · a look back over the −x shoulder 5.25–5.95 · ends with the hands in the pocket (blends out)' }),
  clip({ name: 'bribe_pass', dur: 1.8, blendIn: .1, blendOut: .3, track: bribePass, prop: 'envelope', model: ENV_M, pair: { with: 'bribe_take', gap: BR.gap, delay: 0 },
    note: 'the briber (pair: bribe_take 1.02 m ahead, facing, the same start; prop: envelope, the +x hand): the chin up, the eyes over the cop\'s head throughout, the hand in the hoodie pocket · the envelope out low to its +x side 0.3–0.56 (the knees dip), held out to the cop · the cop\'s fingers close on it 0.72, a press · let go 0.92 (the envelope is the cop\'s now) · the hand back in the pocket 0.95–1.28, a nod (the chin up a little more) 1.12–1.4, the chest turns away a little 1.35–1.78 · ends with the hand in the pocket (blends out)' }),
  clip({ name: 'bribe_take', dur: 2, blendIn: .1, blendOut: .3, track: bribeTake, prop: 'envelope', model: ENV_M, map: toCop,
    note: 'the cop (bribe_pass\'s partner; prop: envelope, the −x hand, shown from the handoff): the +x thumb in the belt, the chin up, the eyes over the briber\'s head throughout ("I see nothing") · the −x hand out low 0.48–0.7 · takes the envelope 0.92 and pockets it 0.92–1.3 (gone) · the chest turns away a little 1.35–1.78 · ends with the hand in the pocket and the thumb in the belt (blends out)' }),
  clip({ name: 'guard_post', dur: GP_D, loop: true, blendIn: .4, blendOut: .4, track: guard,
    note: 'a loop: a Cop on guard at the vault door (the door behind it, errands.md): feet planted, the chest up, the chin up, the thumbs in the belt at its front, the elbows out · a long look to −x 0.9–3.6 s · a long look to +x 3.9–6.6 · up on the toes twice 6.9–8.1 · a belt hitch 8.35–8.9 · a look at the watch 9.3–10.9 (the −x forearm across the front, the head down) · a settle of the shoulders 11.1–11.7' }),
  clip({ name: 'gangway_up', dur: GW.C, loop: true, speed: GW.V, blendIn: .2, blendOut: .25, track: gangway,
    more: { ramp: { slope: GW.th, rise: +GW_SL.toFixed(4), vy: +(GW.V * GW_SL).toFixed(4), rail: { ...GW.rail } } },
    note: 'a loop of two steps, TRAVELLING at 0.75 m/s on its own legs up a 0.24 rad (13.75°) slope (not `moving`: the owner moves it along at `speed` and up at ramp.vy, the walk weight at 0, from the gangway\'s foot at t 0): each foot strikes toe-up, rolls flat along the slope, pushes off from the toe · leaning into the climb, the eyes on the ramp ahead · the +x hand slides up the rail (ramp.rail: its top 0.6 m over the ramp, 0.64 m out to +x), the −x arm swings' }),
  clip({ name: 'evicted_carry', dur: EV_D, loop: true, speed: EV.V, blendIn: .3, blendOut: .3, track: evicted, prop: 'bundle', model: BUNDLE_M,
    note: 'a loop, TRAVELLING at 0.62 m/s on its own legs (not `moving`: the owner moves it at `speed`, the walk weight at 0; prop: bundle, both hands): everything it owns tied up in a bedsheet, hugged at the chest · a tired, heavy walk: short, flat, scuffing steps, the weight dropping onto each, a waddle, leaning back against the load, the head down and tilted · the bundle sinks a beat after each step and sways a beat behind the waddle, the hands with it · a hitch 2.4–2.9 s · a weary roll of the head 3.4–4.2' }),
];
