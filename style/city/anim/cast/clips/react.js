// CLIPS · react (bystanders; the K agent, 2026-10-10; the visible-highs plan §2, CLIPS.md § Moods and reactions). What the street does when something
// happens near it (the city's simstate/react.js picks who and when; these are the bodies):
//   film_phone       3 s standing loop · the phone held out in the reach band at chest height (landscape, the +x hand), the eyes on its
//                    screen, a slow pan with the action, a look up over it at the real thing 1.3–2.1 s; the −x arm hangs
//   rubberneck_walk  MOVING overlay (speed 0, stride 1: the walker's own pace, as the moods' walks) · the head (and a little of the chest)
//                    turned to the walker's LOOK YAW, cLook (the gait state's g.look: the city points it at the incident), the arms'
//                    swing damped; a glance back at the path ahead 1.9–2.75 s
// THE PHONE RIDES THE +x HAND RIGIDLY (phone-prop.js; its grip point at the mitten's centre, its long side along the knuckles, the
// camera out of the back, which faces where the fingers point). As robbery.js's aim clips: film_phone's body is ONE track of expressions
// valid in GLSL and JS (absolute values), and the CPU runs walk2.js's forward kinematics (the elbow's rigid hand about the hinge line,
// the shoulder's turn, the chest's turn about the pelvis) to place the phone, so the fist and the phone cannot part.
// prop.pose(t) / prop.matrix(THREE, t, out) / prop.lens(t): the CLIPS.md prop contract, plus where it films from (body frame).
import { PHONE, phoneGeometry, phoneMatrix, phonePoint, phoneDir } from './phone-prop.js';

const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cBump: (t, a, b) => Math.sin(Math.PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max,
    mod: (x, y) => x - y * Math.floor(x / y) }; })();
const f = v => (+v).toFixed(4);
// THE TRACK (film_phone): one expression per channel, in t (and D), absolute values. body tx ty tz (the chest's pitch / yaw / roll),
// drop, bx (the hips' sway), pr (the pelvis roll) · feet zL lL fL zR lR fR (cFoot) · the eyes hx hy hz (body frame; P.head = this − the
// chest) · the phone arm (+x) ap ar ay at ae (cArm's pitch, roll, yaw, twist + the elbow) · the free arm (−x) lp lr ly lt le · show
const KEYS = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr', 'zL', 'lL', 'fL', 'zR', 'lR', 'fR', 'hx', 'hy', 'hz', 'ap', 'ar', 'ay', 'at', 'ae', 'lp', 'lr', 'ly', 'lt', 'le', 'show'];
function trackJs(T, dur) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]);
  const fn = new Function(...ks, 't', 'D', `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${KEYS.map(k => `${k}: ${T[k]}`).join(', ')} };`);
  return t => fn(...vals, JS.mod(Math.max(t, 0), dur), dur);
}
const trackGlsl = T => /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${T.tx}, ${T.ty}, ${T.tz}); P.drop = ${T.drop}; P.bodyX = ${T.bx}; P.pRoll = ${T.pr};
  cFoot(P, 0, ${T.zL}, ${T.lL}, ${T.fL}); cFoot(P, 1, ${T.zR}, ${T.lR}, ${T.fR});
  P.head = vec3(${T.hx} - P.torso.x, ${T.hy} - P.torso.y, ${T.hz});
  cArm(P, 1, vec4(${T.ap}, ${T.ar}, ${T.ay}, ${T.at}), ${T.ae}, 1.);
  cArm(P, 0, vec4(${T.lp}, ${T.lr}, ${T.ly}, ${T.lt}), ${T.le}, 1.);`;
// THE FORWARD KINEMATICS of the +x hand (walk2.js, the standing body, the walk's weight 0; robbery.js handFK's): a rest-frame point (the
// arm hanging) → the walker's body frame. GLSL's aRX / aRY / aRZ, as matrices on column vectors.
const R3 = { x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; } };
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const RIG = { hipY: .5, hipZ: .025, hipX: .125, L: (.2 + .175) * .998, ank: .125, heel: .175, toe: .275, sh: [.25, .825, 0], hinge: [0, .65, .05], grip: [.325, .39, 0] };
const ankle = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
// the phone's axes in the hand's rest frame (the +x arm hanging): its long side along the knuckles (x), its up to the thumb side (+z),
// its back (the camera) down the fingers (−y): the gun's mapping (robbery.js GUN_IN_HAND)
const PHONE_IN_HAND = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
function handFK(v) {
  const L = ankle(v.zL, v.fL, v.lL), Rr = ankle(v.zR, v.fR, v.lR), sr = Math.sin(v.pr) * RIG.hipX;
  const hL = L[1] + Math.sqrt(Math.max(RIG.L ** 2 - L[0] ** 2 - v.bx ** 2, 0)) + sr, hR = Rr[1] + Math.sqrt(Math.max(RIG.L ** 2 - Rr[0] ** 2 - v.bx ** 2, 0)) - sr;
  const hip = Math.min(RIG.hipY - v.drop, hL, hR), pc = [0, RIG.hipY, RIG.hipZ];
  const chest = d => R3.z(v.tz + .5 * v.pr, R3.x(v.tx, R3.y(v.ty, d)));
  const arm = d => { d = R3.y(-v.at, d); d = R3.x(-v.ap, d); d = R3.z(v.ar, d); return R3.y(-v.ay, d); };
  const rot = d => chest(arm(R3.x(-v.ae, d)));
  const pt = p => vadd([v.bx, hip, RIG.hipZ], chest(vsub(vadd(RIG.sh, arm(vsub(vadd(RIG.hinge, R3.x(-v.ae, vsub(p, RIG.hinge))), RIG.sh))), pc)));
  return { p: pt(RIG.grip), R: PHONE_IN_HAND.flatMap(rot), hip };
}
function phoneProp(T, dur) {
  const tr = trackJs(T, dur);
  const pose = t => { const v = tr(t), h = handFK(v); return { p: h.p, R: h.R, show: v.show }; };
  return { id: 'phone', geometry: (THREE, scheme) => phoneGeometry(THREE, scheme), pose, track: tr,
    matrix: (THREE, t, out) => phoneMatrix(THREE, pose(t), out),
    lens: t => { const q = pose(t); return { p: phonePoint(q, PHONE.lens), d: phoneDir(q, PHONE.dir), show: q.show }; } };
}

// ═══ FILM_PHONE (3 s loop): the phone held out at chest height in the reach band (the arm nearly straight, the grip ~0.44 m ahead of the
// chest, ~0.72 m up), level, the screen toward the face and tipped up a little; the eyes on it (the head pitched only 0.09: the big
// head's front edge must stay over the phone); a slow pan (the chest turns with the action, once a loop); a look up over the phone at
// the real thing 1.3–2.1 s, back down; a small tremble in the arm. The weight on the −x leg, the +x foot a step forward, soft. Every
// rhythm divides D, so the loop is seamless.
const FP_D = 3, w = n => `${f(2 * Math.PI * n / FP_D)} * t`;
const FILM = { vars: [['pan', `sin(${w(1)})`], ['br', `sin(${w(1)} + .8)`], ['lu', 'cS(t, 1.3, 1.55) * (1. - cS(t, 1.85, 2.15))'], ['tr', `sin(${w(17)}) + .6 * sin(${w(11)} + 1.)`]],
  tx: `(.05 + .015 * br + .02 * lu)`, ty: `(.08 * pan)`, tz: '.02', drop: `(.004 * (.5 - .5 * br))`, bx: '-.022', pr: '-.06',
  zL: '0.', lL: '0.', fL: '0.', zR: '.05', lR: '0.', fR: '0.',
  hx: `(.075 - .012 * br - .08 * lu)`, hy: `(.08 * pan + .07 + .04 * lu)`, hz: `(.035 - .02 * lu)`,
  ap: `(1.15 + .004 * tr)`, ar: '.05', ay: `(.25 + .003 * tr)`, at: '-.1', ae: `(.3 + .03 * lu)`,
  lp: `(.06 + .02 * pan)`, lr: '.12', ly: '0.', lt: '.15', le: `(.18 + .02 * br)`,   // (the −x arm hangs, the elbow soft: in the hoodie pocket its fist met the phone's far end)
  show: '1.' };

// ═══ RUBBERNECK_WALK (3 s loop, MOVING overlay): the eyes on cLook (clamped to ±1.35 rad: the head turns ≤ 1.11 on the chest, the chest
// ≤ 0.24 on the hips: more chest turn swung a hanging hand into the passing thigh; behind that the walker would have to stop and turn),
// a curious tilt toward it; the walk's arm swing damped (the attention is elsewhere); a glance back at the path ahead 1.9–2.75 s. With
// cLook 0 it is the walk with quiet arms and that glance.
const rubberneck = /* glsl */`
  float lk = clamp(cLook, -1.35, 1.35), ty = .18 * lk;
  float k = 1. - .85 * cS(t, 1.9, 2.15) * (1. - cS(t, 2.45, 2.75));
  P.torso.y += ty * k; P.head.y += (lk - ty) * k;
  P.head.z += .06 * clamp(lk, -1., 1.) * k; P.head.x -= .03 * abs(clamp(lk, -1., 1.)) * k;
  if (aGrip <= 0) { P.armP = mix(vec2(.04 * w), P.armP, .65); P.armR += vec2(.05 * w); }   // (damped, and a little wider: the swing's hand no longer leads the passing thigh)   // (a hold keeps its own arms: grip.js)`;

export const CLIPS = [
  { name: 'film_phone', dur: FP_D, loop: true, blendIn: .35, blendOut: .3, prop: phoneProp(FILM, FP_D), glsl: trackGlsl(FILM),
    note: 'a loop (prop: phone): the phone held out at chest height in landscape (the +x hand, the arm nearly straight), the eyes on its screen · a slow pan with the action (once a loop) · a look up over it at the real thing 1.3–2.1 s · the −x arm hangs, the weight on the −x leg' },
  { name: 'rubberneck_walk', dur: 3, loop: true, moving: true, stride: 1, speed: 0, blendIn: .4, blendOut: .5, glsl: rubberneck,
    glance: [-1.6, 1.6],   // (the lab only: it sweeps the look yaw g.look over this range each play, so the line-up and the see-through gate turn the head through all of it)
    note: 'a MOVING overlay at the walker\'s own pace (speed 0, stride 1; no cLegK, cMov or cRot): the head and a little of the chest turned to the walker\'s look yaw cLook (the city points g.look at the incident; it is clamped to ±1.35), a curious tilt · the arms\' swing damped · a glance back at the path 1.9–2.75 s' },
];
