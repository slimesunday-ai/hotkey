// CLIPS · drugs (moods; the drugs agent, 2026-10-15; GAME.md §11, §20; drugs.md). Taking a dose, the crash and the withdrawal. One owner;
// CLIPS.md has the entry format. ONE LOOK FOR EVERY DRUG (slime: a drug's name never shows live): nothing here takes a drug, and the
// dose is the same packet (drugs-props.js) and the same gesture whatever was taken.
//   dose_take         2.5 s one-shot (prop: packet) · the +x hand to the hoodie's front pocket, out with a packet, up to the mouth, the
//                     pill in (the packet back in the fist), the head tossed back (a swallow), a gulp, a shudder and a shake of the head
//   crash_walk        MOVING overlay (high.js's convention: speed 0, stride 1, the walker's own pace; no root, no leg channel) · slumped,
//                     the head hanging, the arms dead and barely swinging, a heavy drop of the head and shoulders at every step, and once
//                     a loop it nods off and jerks awake
//   crash_slump       8 s standing loop · the knees soft, slumped, the head hanging, the arms dangling, a slow heavy sway; a big sigh,
//                     then it nods off and jerks awake
//   withdrawal_shake  6 s standing loop · sick: hunched over the stomach, rocking, the feet stepping in place; one forearm clutched across
//                     the stomach while the other hand holds the side of the head and scratches (one side, then the other); a constant
//                     shiver and two hard shudders; quick darting glances
//   withdrawal_walk   MOVING overlay (as crash_walk) · the same look on the walk's legs
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow (cArm's 5-argument form); torso / head: x = pitch forward (head:
// look down), y = yaw (+: the front turns to +x), z = roll. The head is posed relative to the chest.
// THE RIG'S LIMITS (high.js, talk-patrol.js, cook.md): the toon arm reaches 0.403–0.453 m from the shoulder; the big head (x ±0.4–0.5,
// y 0.95–1.7, its face at z 0.4) owns everything above y 0.9; it can pitch down only ~0.33 rad on the chest before its chin's edge meets
// the chest's top corner (so "head low" is the chest leaning, not the neck); no folded arms (the hands would need 0.55 m).
import { PACKET, packetGeometry, packetMatrix, packetPoint } from './drugs-props.js';

const f = v => (+v).toFixed(4);
// the GLSL helpers in JS (clips/index.js; react.js's twin), so one expression serves both the shader and the CPU
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBump: (t, a, b) => Math.sin(Math.PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl,
    sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max, exp: Math.exp }; })();
// a keyed channel: [[t, value, ease?], …] → one expression (eased from each key to the next: cS, or cOut / cIn)
const keys = K => { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(t, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; };

// ── the rig (walk2.js; talk-patrol.js): the shoulder pivot, the elbow's hinge line, the hand's grip point, in the arm's rest frame
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
// THE HAND IK in GLSL (talk-patrol.js's, high.js's): side 0 (−x) / 1 (+x); T = the hand's target, H = where the elbow points (chest rest frame)
function ik(side, T, H, k = '1.') {
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
// THE SAME IK in JS (the same arithmetic), to solve a keyed pose offline: → [pitch, roll, yaw, twist, elbow]
const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); }, dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function ikJs(side, T, H) {
  const sx = side ? 1 : -1, kT = [T[0] - sx * SH.x, T[1] - SH.y, T[2]], cl = JS.clamp;
  const kr2 = cl(dot3(kT, kT), RMIN ** 2, RMAX ** 2), ke = PHI + Math.acos(cl((kr2 - RA) / RB, -1, 1)), kc = Math.cos(ke), ks = Math.sin(ke);
  const kv = [sx * gx, hy + kc * gy + ks * gz, hz - ks * gy + kc * gz], kl = [sx * gx, ELB.y - SH.y, 0];
  const e1 = nrm(kv), e2 = nrm(kl.map((v, i) => v - dot3(kl, e1) * e1[i])), f1 = nrm(kT), f2 = nrm(H.map((v, i) => v - dot3(H, f1) * f1[i]));
  const E = [e1, e2, crs(e1, e2)], F = [f1, f2, crs(f1, f2)], kR = (c, r) => F[0][r] * E[0][c] + F[1][r] * E[1][c] + F[2][r] * E[2][c];
  let kb = Math.asin(cl(kR(1, 2), -1, 1)), ka = Math.atan2(-kR(1, 0), kR(1, 1)), kcc = Math.atan2(-kR(0, 2), kR(2, 2));
  if (Math.abs(ka) > Math.PI / 2) { ka -= Math.sign(ka) * Math.PI; kb = (kb >= 0 ? Math.PI : -Math.PI) - kb; kcc += kcc > 0 ? -Math.PI : Math.PI; }
  return [-kb, sx * ka, 0, -sx * kcc, ke];
}

// ── THE TRACK (dose_take; react.js's film_phone method): one expression per channel, in t (and D), absolute values, valid in GLSL and JS.
// body tx ty tz (the chest's pitch / yaw / roll), drop, bx (the hips' sway), pr (the pelvis roll) · feet zL lL fL zR lR fR (cFoot) · the
// eyes hx hy hz (body frame; P.head = this − the chest) · the dose arm (+x) ap ar ay at ae · the free arm (−x) lp lr ly lt le · show (the
// packet) · sl (the packet's slide along the hand's thumb axis, m: −0.09 inside the fist, +0.04 out between the thumb and the fingers)
const KEYS = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr', 'zL', 'lL', 'fL', 'zR', 'lR', 'fR', 'hx', 'hy', 'hz', 'ap', 'ar', 'ay', 'at', 'ae', 'lp', 'lr', 'ly', 'lt', 'le', 'show', 'sl'];
function trackJs(T, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]);
  const fn = new Function(...ks, 't', 'D', `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${KEYS.map(k => `${k}: ${T[k]}`).join(', ')} };`);
  return t => { t = Math.max(t, 0); return fn(...vals, loop ? t - dur * Math.floor(t / dur) : t, dur); };
}
const trackGlsl = T => /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${T.tx}, ${T.ty}, ${T.tz}); P.drop = ${T.drop}; P.bodyX = ${T.bx}; P.pRoll = ${T.pr};
  cFoot(P, 0, ${T.zL}, ${T.lL}, ${T.fL}); cFoot(P, 1, ${T.zR}, ${T.lR}, ${T.fR});
  P.head = vec3(${T.hx} - P.torso.x, ${T.hy} - P.torso.y, ${T.hz});
  cArm(P, 1, vec4(${T.ap}, ${T.ar}, ${T.ay}, ${T.at}), ${T.ae}, 1.);
  cArm(P, 0, vec4(${T.lp}, ${T.lr}, ${T.ly}, ${T.lt}), ${T.le}, 1.);`;
// THE FORWARD KINEMATICS of the +x hand (walk2.js, the standing body, the walk's weight 0; react.js handFK's): a rest-frame point of the
// hand (the arm hanging) → the walker's body frame. GLSL's aRX / aRY / aRZ, as matrices on column vectors.
const R3 = { x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; } };
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const RIG = { hipY: .5, hipZ: .025, hipX: .125, L: (.2 + .175) * .998, ank: .125, heel: .175, toe: .275, sh: [.25, .825, 0], hinge: [0, .65, .05], grip: [.325, .39, 0] };
const ankle = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
// the packet's axes in the hand's rest frame (the +x arm hanging): across the knuckles (x), its length up the thumb side (+z, out of the
// fist between the thumb and the fingers), its face down the fingers (−y): the phone's mapping (react.js PHONE_IN_HAND)
const PACKET_IN_HAND = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
function handFK(v) {
  const L = ankle(v.zL, v.fL, v.lL), Rr = ankle(v.zR, v.fR, v.lR), sr = Math.sin(v.pr) * RIG.hipX;
  const hL = L[1] + Math.sqrt(Math.max(RIG.L ** 2 - L[0] ** 2 - v.bx ** 2, 0)) + sr, hR = Rr[1] + Math.sqrt(Math.max(RIG.L ** 2 - Rr[0] ** 2 - v.bx ** 2, 0)) - sr;
  const hip = Math.min(RIG.hipY - v.drop, hL, hR), pc = [0, RIG.hipY, RIG.hipZ];
  const chest = d => R3.z(v.tz + .5 * v.pr, R3.x(v.tx, R3.y(v.ty, d)));
  const arm = d => { d = R3.y(-v.at, d); d = R3.x(-v.ap, d); d = R3.z(v.ar, d); return R3.y(-v.ay, d); };
  const rot = d => chest(arm(R3.x(-v.ae, d)));
  const pt = p => vadd([v.bx, hip, RIG.hipZ], chest(vsub(vadd(RIG.sh, arm(vsub(vadd(RIG.hinge, R3.x(-v.ae, vsub(p, RIG.hinge))), RIG.sh))), pc)));
  return { grip: pt(RIG.grip), p: pt([RIG.grip[0], RIG.grip[1], RIG.grip[2] + v.sl]), R: PACKET_IN_HAND.flatMap(rot), hip };
}
function packetProp(T, dur) {
  const tr = trackJs(T, dur, false);
  const pose = t => { const v = tr(t), h = handFK(v); return { p: h.p, R: h.R, show: v.show }; };
  return { id: 'packet', geometry: THREE => packetGeometry(THREE), pose, track: tr,
    matrix: (THREE, t, out) => packetMatrix(THREE, pose(t), out),
    top: t => { const q = pose(t); return { p: packetPoint(q, PACKET.top), show: q.show }; } };
}

// ═══ DOSE_TAKE (2.5 s one-shot, standing): from the plain stand. The +x hand goes to the hoodie's front pocket (0–0.3 s, a glance down
// at it), digs (0.3–0.46: the packet appears INSIDE the fist), comes up in front of the chest (the packet slides out between the thumb
// and the fingers, 0.5–0.72) to just under the mouth (0.8), and pops up to the lips as the packet slides back into the fist (0.82–0.93:
// the pill goes in; the packet hides at 1.0, inside the fist); the head turns to the hand. The head is tossed back (1.0–1.12, the
// swallow) as the hand drops away; a gulp (the chin down, 1.3–1.5); a shudder of the shoulders and a shake of the head (1.75–2.3); back
// to the plain stand by 2.5. The −x arm hangs loose throughout.
// THE MOUTH: the face is 0.45 m ahead of the shoulder and the arm reaches 0.45, so the fist can't reach the front of the face. It meets
// the mouth at the head's bottom edge, 0.1 m in front of the face (chest frame (0.30, 0.86, 0.44)), and the head turns 0.38 to it.
// Found on the real shader over sweeps of targets, poles and head turns: no hand vertex in the head; a head dipped to the fist put the
// chin's edge into it, and a raised elbow put the upper arm under the turned head's side.
const DT_D = 2.5;
// the dose arm's key poses, [pitch, roll, yaw, twist, elbow]: the plain stand's arm; the hoodie's front pocket (deal-hang.js) and the dig
// into it; the hand coming out; just under the mouth (the packet up at it); at the mouth, in front of it (the head turned 0.38 to it);
// dropping away after the toss. The last three are solved by the IK from their targets (chest rest frame) and poles.
const A = {
  rest: [0, .04, 0, 0, 0],
  pocket: [.54, .38, .32, .5, .85],
  dig: [.59, .38, .32, .5, .73],
  out: [.6, .3, .22, .52, .95],
  under: ikJs(1, [.3, .76, .45], [1.2, -.6, 0]),
  mouth: ikJs(1, [.3, .86, .44], [1.2, -.6, 0]),
  away: ikJs(1, [.36, .62, .34], [1, -.4, -.4]),
};
const armKeys = (i, K) => keys(K.map(([t, p, e]) => [t, A[p][i], e]));
const DOSE_ARM = [[0, 'rest'], [.3, 'pocket'], [.38, 'dig'], [.46, 'pocket'], [.56, 'out'], [.8, 'under'], [.93, 'mouth', 'cOut'], [1, 'mouth'], [1.25, 'away'], [1.62, 'rest']];
const DOSE = {
  vars: [['shk', `cBump(t, 1.75, 2.3)`]],
  tx: keys([[0, 0], [.3, .05], [.8, .02], [.93, .045], [1, .045], [1.12, -.07, 'cOut'], [1.3, -.05], [1.5, .05], [1.72, 0], [DT_D, 0]]),
  ty: keys([[0, 0], [.3, -.05], [.93, .04], [1.25, 0], [DT_D, 0]]),
  tz: `(.045 * shk * sin(${f(2 * Math.PI * 8)} * (t - 1.75)))`,
  drop: `(.008 * cBump(t, 1.4, 1.75) + .012 * shk)`,
  bx: keys([[0, 0], [.4, -.012], [1.9, -.012], [DT_D, 0]]),
  pr: keys([[0, 0], [.4, -.035], [1.9, -.035], [DT_D, 0]]),
  zL: '0.', lL: '0.', fL: '0.', zR: '0.', lR: '0.', fR: '0.',
  hx: keys([[0, 0], [.3, .14], [.46, .14], [.75, -.02], [.93, 0], [1, 0], [1.12, -.32, 'cOut'], [1.3, -.32], [1.5, .12], [1.7, 0], [DT_D, 0]]),
  hy: `(${keys([[0, 0], [.3, .06], [.6, .06], [.93, .38], [1, .38], [1.3, 0], [DT_D, 0]])} + .4 * shk * sin(${f(2 * Math.PI * 4)} * (t - 1.75)))`,
  hz: keys([[0, 0], [1, 0], [1.12, .07, 'cOut'], [1.4, 0], [DT_D, 0]]),
  ap: armKeys(0, DOSE_ARM), ar: armKeys(1, DOSE_ARM), ay: armKeys(2, DOSE_ARM), at: armKeys(3, DOSE_ARM), ae: armKeys(4, DOSE_ARM),
  lp: keys([[0, 0], [.4, .03], [2.2, .03], [DT_D, 0]]), lr: `(${keys([[0, .04], [.4, .08], [2.2, .08], [DT_D, .04]])} + .05 * shk)`,
  ly: '0.', lt: keys([[0, 0], [.4, .1], [2.2, .1], [DT_D, 0]]), le: keys([[0, 0], [.4, .15], [2.2, .15], [DT_D, 0]]),
  show: `(cS(t, .42, .43) * (1. - cS(t, 1., 1.01)))`,
  sl: keys([[0, -.09], [.5, -.09], [.72, .04], [.82, .04], [.93, -.09]]),
};

// ═══ CRASH_WALK (4.8 s, MOVING overlay): slumped, the chest forward, the head hanging (the chin's edge stays off the chest), the arms
// dead: straight down under the leaning chest, a small swing that trails the legs, the elbows soft. At every step's landing (u ≈ 0.1, 0.6)
// the head and shoulders drop and the arms jolt: heavy feet. The weight rolls onto each leg, late, the head lolling after it. Once a loop
// it nods off: the head and chest sink 2.3–3.4 s, and it jerks awake (the head snaps up, 3.4–3.52), sinking back by 4.6. Standing (w → 0)
// it keeps the slump and the nod-off; the city switches to crash_slump when it stops.
const crashWalk = /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .16)), hit = pow(max(cos(2. * T * (u - .1)), 0.), 6.), rl = cos(T * (u - .3));
  float sink = cS(t, 2.3, 3.4) * (1. - cOut(t, 3.4, 3.52)), jerk = cOut(t, 3.4, 3.52) * (1. - cS(t, 3.56, 4.6));
  float lean = .13 + .035 * hit * w + .05 * sink - .07 * jerk;
  P.torso.x += lean; P.head.x += .22 + .05 * hit * w + .06 * sink - .32 * jerk;
  P.torso.z += .12 * rl * w; P.head.z -= .08 * cos(T * (u - .42)) * w;
  P.head.z += .22 * sin(T * t / D) * (1. - .6 * jerk);
  P.head.y += .1 * sin(T * t / D + 1.) * (1. - sink);
  float ap = -lean;
  cArm(P, 0, vec4(ap - .13 * sw * w, .15 + .08 * max(-rl, 0.) * w, 0., .15), .12 + .12 * hit * w, 1.);
  cArm(P, 1, vec4(ap + .13 * sw * w, .15 + .08 * max(rl, 0.) * w, 0., .15), .12 + .12 * hit * w, 1.);`;

// ═══ CRASH_SLUMP (8 s standing loop): the knees soft, the weight hanging on one leg and drifting to the other once a loop; slumped, the
// head hanging, the arms dangling straight down; a big sigh 0.6–2.4 s (the chest and head come up, then fall further); it nods off
// 3.4–5.2 (the head and chest sink, the knees give) and jerks awake at 5.2 (the head snaps up, the chest straightens), sinking back by 6.8.
const crashSlump = /* glsl */`
  float T = 6.2831853, s1 = sin(T * t / D), s2 = sin(2. * T * t / D + .7);
  float sg = cS(t, .6, 1.3) * (1. - cS(t, 1.4, 2.4)), sink = cS(t, 3.4, 5.2) * (1. - cOut(t, 5.2, 5.32)), jerk = cOut(t, 5.2, 5.32) * (1. - cS(t, 5.4, 6.8));
  float ws = .8 * s1 + .2 * s2;
  P.drop += .03 + .005 * s2 + .012 * sink - .008 * jerk;
  P.bodyX += .02 * ws; P.pRoll += .05 * ws; P.torso.z -= .04 * ws; P.head.z += .16 * sin(T * t / D - .6) + .05 * sin(2. * T * t / D);
  float lean = .15 - .1 * sg + .05 * sink - .08 * jerk;
  P.torso.x += lean; P.head.x += .24 - .16 * sg + .06 * sink - .3 * jerk;
  P.head.y += .1 * sin(T * t / D + 2.) * (1. - sink);
  cArm(P, 0, vec4(-lean + .03 * s1, .15 - .03 * ws + .06 * sg, 0., .15), .12, 1.);
  cArm(P, 1, vec4(-lean - .03 * s1, .15 + .03 * ws + .06 * sg, 0., .15), .12, 1.);`;

// ═══ WITHDRAWAL_SHAKE (6 s standing loop): sick. Hunched over the stomach (the knees bent), rocking forward and back (twice a loop),
// the feet never still (stepping in place, each foot 8 times a loop); a constant fine shiver (~9 Hz) and two hard shudders (1.2–1.6 s,
// 4.0–4.4 s). One forearm clutched across the stomach while the other hand holds the side of the head, scratching at it in bursts: the
// +x hand 0.5–3.1 s, the −x hand 3.05–5.9 (a hand is at the head most of the loop: from the city camera that hand beside the head is
// the withdrawal's mark). Quick darting glances: 0.08 s to +x, 1.75 to −x, 4.5 to +x, 5.88 to −x.
// THE HANDS (talk-patrol.js's IK, the targets in the chest's rest frame): the clutch is the closest the reach allows (the hands 0.37 m in
// front of the chest at belly height; folded arms would need 0.55 m). A hand at the head targets a point of the HEAD's rest frame
// (falls.js onHead: cower's method), so it rides the head's ducks, glances and shivers; it goes up and back down on a curve out at the
// side (a straight blend from the belly to the head cuts inside the arm's reach). Found on the real shader: no hand vertex in the head,
// no arm crossing the head, on the bare body, a hoodie and the puffer.
const NECK = .95;
const onHead = p => `(vec3(0., ${f(NECK)}, 0.) + aRY(P.head.y) * aRX(P.head.x) * aRZ(P.head.z) * ((${p}) - vec3(0., ${f(NECK)}, 0.)))`;
const WD = { hug: [.14, .69, .38], hugIn: [.12, .7, .38], pole: [1, -.4, -.6], head: [.6, 1.06, -.03], poleH: [.7, -.7, .3], via: [.56, .84, .28] };
const v3 = a => `vec3(${a.map(f).join(', ')})`, mx = a => [-a[0], a[1], a[2]];
// one arm's GLSL: side 0 (−x) / 1 (+x), hold = how far up at the head (0 → 1), scr = the scratch (−1 … 1), bob = the clutch's bob (m).
// While one hand is at the head the other clutches a little further in (hugIn). The hand at the head and its elbow's pole are both in
// the head's rest frame, so the whole arm turns with the head: a glance keeps the hand where it was on the head.
const wdArm = (side, hold, other, scr, bob) => { const m = side ? a => a : mx;
  return /* glsl */`{ vec3 cl = mix(${v3(m(WD.hug))}, ${v3(m(WD.hugIn))}, ${other}) + vec3(0., ${bob}, 0.);
    vec3 hd = ${onHead(`${v3(m(WD.head))} + vec3(0., .025 * ${scr}, .02 * ${scr})`)};
    float k = ${hold}; vec3 tg = (1. - k) * (1. - k) * cl + 2. * k * (1. - k) * ${v3(m(WD.via))} + k * k * hd;
    vec3 pl = mix(${v3(m(WD.pole))}, aRY(P.head.y) * aRX(P.head.x) * aRZ(P.head.z) * ${v3(m(WD.poleH))}, k);
    ${ik(side, 'tg', 'pl')} }`; };
const withdrawal = /* glsl */`
  float T = 6.2831853, tr = sin(T * 56. * t / D), tr2 = sin(T * 47. * t / D + 1.3), rk = sin(2. * T * t / D);
  float sh = cBump(t, 1.2, 1.6) + cBump(t, 4., 4.4), shiver = .3 + sh;
  float st = sin(T * 8. * t / D), lL = .03 * pow(max(st, 0.), 2.), lR = .03 * pow(max(-st, 0.), 2.);
  cFoot(P, 0, 0., lL, -8. * lL); cFoot(P, 1, 0., lR, -8. * lR);
  P.bodyX -= .012 * st; P.pRoll -= .04 * st;
  P.drop += .075 + .01 * rk + .012 * sh;
  P.torso.x += .21 + .045 * rk + .02 * shiver * tr; P.torso.z += .02 * shiver * tr2 + .03 * st;
  float hR = cS(t, .5, .85) * (1. - cS(t, 2.75, 3.1)), hL = cS(t, 3.05, 3.4) * (1. - cS(t, 5.55, 5.9));
  float sR = sin(T * 40. * t / D) * cS(t, .9, 1.05) * (1. - cS(t, 2.3, 2.45)), sL = sin(T * 40. * t / D) * cS(t, 3.5, 3.65) * (1. - cS(t, 5.05, 5.2));
  float g = .4 * (cOut(t, .08, .2) - cS(t, .32, .45)) - .35 * (cOut(t, 1.75, 1.87) - cS(t, 2.1, 2.25)) + .35 * (cOut(t, 4.5, 4.62) - cS(t, 4.85, 5.)) - .3 * (cOut(t, 5.88, 5.94) - cS(t, 5.95, 6.));
  P.head.y += g + .02 * shiver * tr2; P.head.x += .08 - .1 * abs(g) + .02 * shiver * tr + .05 * sh; P.head.z += .03 * shiver * tr;
  float br = .015 * sin(T * 3. * t / D);
  ${wdArm(0, 'hL', 'hR', 'sL', 'br')}
  ${wdArm(1, 'hR', 'hL', 'sR', '-br')}
  P.elb = min(P.elb + vec2(.03 * shiver * tr), vec2(${f(EMAX)}));`;

// ═══ WITHDRAWAL_WALK (4.8 s, MOVING overlay; high.js's convention: no root, no leg channel): the stand's look on the walk's legs.
// Hunched, the head down; one forearm clutched across the stomach (bobbing with the steps) while the other hand holds the side of the
// head and scratches at it: the +x hand 0.3–2.55 s, the −x hand 2.5–4.75; a constant shiver and two hard shudders (1.0–1.4 s,
// 3.4–3.8); quick darting glances (1.2 s to −x, 3.45 to +x). Standing (w → 0) it keeps the look; the city switches to withdrawal_shake
// when it stops.
const withdrawalWalk = /* glsl */`
  float T = 6.2831853, sw = cos(T * (u - .07)), tr = sin(T * 45. * t / D), tr2 = sin(T * 38. * t / D + 1.3);
  float sh = cBump(t, 1., 1.4) + cBump(t, 3.4, 3.8), shiver = .3 + sh;
  P.torso.x += .16 + .03 * sh + .02 * shiver * tr; P.torso.z += .02 * shiver * tr2;
  float hR = cS(t, .3, .65) * (1. - cS(t, 2.2, 2.55)), hL = cS(t, 2.5, 2.85) * (1. - cS(t, 4.4, 4.75));
  float sR = sin(T * 32. * t / D) * cS(t, .7, .85) * (1. - cS(t, 1.95, 2.1)), sL = sin(T * 32. * t / D) * cS(t, 2.9, 3.05) * (1. - cS(t, 4.15, 4.3));
  float g = -.35 * (cOut(t, 1.2, 1.32) - cS(t, 1.55, 1.7)) + .35 * (cOut(t, 3.45, 3.57) - cS(t, 3.8, 3.95));
  P.head.y += g + .02 * shiver * tr2; P.head.x += .1 - .1 * abs(g) + .02 * shiver * tr + .05 * sh; P.head.z += .03 * shiver * tr;
  float bob = .012 * sw * w;
  ${wdArm(0, 'hL', 'hR', 'sL', 'bob')}
  ${wdArm(1, 'hR', 'hL', 'sR', '-bob')}
  P.elb = min(P.elb + vec2(.03 * shiver * tr), vec2(${f(EMAX)}));`;

// the walking overlay's entry fields (CLIPS.md § Moods and reactions, high.js): moving at the walker's own pace
const OVERLAY = { loop: true, moving: true, stride: 1, speed: 0 };
export const CLIPS = [
  { name: 'dose_take', dur: DT_D, blendIn: .15, blendOut: .3, prop: packetProp(DOSE, DT_D), glsl: trackGlsl(DOSE),
    note: 'a one-shot (prop: packet), standing: the +x hand to the hoodie pocket (a glance down), out with the packet (it slides out of the fist 0.5–0.72 s), up under the mouth, popped up to the lips as the packet goes back in (0.82–0.93: the pill in) · the head tossed back 1.0–1.12 (the swallow), a gulp 1.3–1.5 · a shudder and a shake of the head 1.75–2.3 · the plain stand by 2.5. The same for every drug' },
  { name: 'crash_walk', dur: 4.8, ...OVERLAY, blendIn: .6, blendOut: .5, glsl: crashWalk,
    note: 'a MOVING overlay at the walker\'s own pace (speed 0, stride 1; no cLegK, cMov or cRot: the legs are the walk\'s): slumped, the head hanging, the arms dead (straight down, a small late swing) · the head and shoulders drop at every step\'s landing (heavy feet) · nods off 2.3–3.4 s and jerks awake 3.4–3.52' },
  { name: 'crash_slump', dur: 8, loop: true, blendIn: .7, blendOut: .6, glsl: crashSlump,
    note: 'a loop: the knees soft, slumped, the head hanging, the arms dangling, a slow heavy sway from leg to leg · a big sigh 0.6–2.4 s · nods off 3.4–5.2 and jerks awake at 5.2, sinking back by 6.8' },
  { name: 'withdrawal_shake', dur: 6, loop: true, blendIn: .4, blendOut: .4, glsl: withdrawal,
    note: 'a loop, sick: hunched over the stomach, rocking (twice a loop), the feet stepping in place · one forearm clutched across the stomach, the other hand holding the side of the head and scratching: the +x hand 0.5–3.1 s, the −x 3.05–5.9 · a constant shiver, hard shudders 1.2–1.6 and 4.0–4.4 · darting glances 0.08 s (+x), 1.75 (−x), 4.5 (+x), 5.88 (−x)' },
  { name: 'withdrawal_walk', dur: 4.8, ...OVERLAY, blendIn: .4, blendOut: .4, glsl: withdrawalWalk,
    note: 'a MOVING overlay at the walker\'s own pace (speed 0, stride 1; no cLegK, cMov or cRot: the legs are the walk\'s): hunched, the head down · one forearm clutched across the stomach, the other hand holding the side of the head and scratching: the +x hand 0.3–2.55 s, the −x 2.5–4.75 · a constant shiver, hard shudders 1.0–1.4 and 3.4–3.8 · darting glances 1.2 s (−x), 3.45 (+x)' },
];
