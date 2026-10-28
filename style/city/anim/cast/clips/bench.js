// CLIPS · bench (activities): the Gunrunner's bench: hammering, assembling, testing a build (GAME.md §20; 2026-10-15). One owner; CLIPS.md has the entry format.
//   bench_hammer    2.8 s loop  the hammer up beside the head and down on the anvil, three strikes (STRIKES: the sparks' beats), the
//                               −x hand steadying the work on the bench; then a lean in to look at it
//   bench_assemble  4.0 s loop  head down over a piece held in the −x hand: the +x hand takes a part from the tray, fits it, pushes it
//                               home, screws it in, taps it twice; the piece turned to the light and looked at
//   bench_stamp     3.4 s loop  forging the warrant: the stamp inked on the pad, raised beside the head and slammed down on the paper,
//                               twice (SLAMS: the seal's beats), the −x hand pinning the paper; a look at the seal
//   bench_test_gun  4.0 s one-shot (holds its last pose)  the finished gun lifted out of its stand, the slide racked with the −x hand,
//                               sighted along the arm out to the side (one dry click), turned over, put back in its stand
// The bench, the anvil, the paper, the pad, the tray, the gun's stand and the lamp are the CITY'S SET (bench-props.js BENCH: where each
// one goes, in the walker's body frame; bench.md: what to place and when). The walker stands on its spot facing the bench; every clip
// is standing.
//
// THE TOOL RIDES ITS HAND RIGIDLY (bench-props.js: the hammer and the stamp; gun-prop.js: the gun, reused). As robbery.js's aim clips and
// react.js's film_phone: the body is ONE track of expressions valid in GLSL and JS (absolute values), and the CPU runs walk2.js's forward
// kinematics (the elbow's rigid hand about the hinge line, the shoulder's turn, the chest's turn about the standing pelvis) to place the
// tool, so the fist and the tool cannot part. THE OTHER HAND is put on its target by work.js's two-bone IK on the elbow (copied here, as
// ride.js and falls.js did): a point of the bench (body frame: it stays planted while the chest moves) or a point of the tool in the other
// hand (that hand's rest frame, carried by its own pose: the hands meet on the tool exactly), mixed, and blended over the arm's own keyed
// angles. prop.pose(t) / prop.matrix(THREE, t, out): the CLIPS.md prop contract (gun-prop.js's { p, R, show }), plus the beats' points.
//
// THE TOON ARM reaches only 0.40–0.45 m from the shoulder (elbows ≤ 1.45 rad, under the thick sleeve's soft cap), and the big head (x ±0.5,
// y 0.9–1.7, z −0.35…0.45, on the neck at y 0.95) hangs over everything in front of the chest. So: the bench top is low (y 0.435, under the
// toon's belt), the hands work at y 0.55–0.65 just in front of the belly, the head bows only as far as its chin edge clears the fists, and
// every big move (the hammer's wind-up, the stamp's lift, the gun sighted) goes OUT TO THE +x SIDE, beside the head, where the street's
// camera sees it. The swings are keyed through a pose out at the side (the fist below the head's corner) so a tool never cuts the head.
import { GUN, gunGeometry, gunMatrix, gunPoint, gunDir } from './gun-prop.js';
import { HAMMER, STAMP, BENCH, benchGeometry, benchMatrix, benchPoint, benchDir, benchSetGeometry } from './bench-props.js';

const PI = Math.PI, f = v => (+v).toFixed(4);
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1,
    smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key: cS, cIn, cOut,
// cR, cBack; work.js's keys). A value may be a number or an expression string.
function keys(K, T = 't') { const n = v => typeof v === 'number' ? v : null;
  let s = typeof K[0][1] === 'number' ? f(K[0][1]) : `(${K[0][1]})`;
  for (let i = 1; i < K.length; i++) { const a = K[i - 1][1], b = K[i][1];
    if (n(a) !== null && n(b) !== null) { const d = b - a; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; }
    else s += ` + ((${typeof b === 'number' ? f(b) : b}) - (${typeof a === 'number' ? f(a) : a})) * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; }
  return `(${s})`; }

// ── THE TRACK: one expression per channel, absolute values, in t (the clip clock; a loop gets it wrapped) and the vars
//   body tx ty tz (the chest's pitch / yaw / roll), drop, bx (the hips' sway), pr (the pelvis roll) · feet zL lL fL zR lR fR (cFoot)
//   the eyes hx hy hz (body frame; P.head = this − the chest) · the +x arm rp rr ry rt re and the −x arm lp lr ly lt le (cArm's pitch,
//   roll out, yaw in, twist in + the elbow)
const KEYS = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr', 'zL', 'lL', 'fL', 'zR', 'lR', 'fR', 'hx', 'hy', 'hz', 'rp', 'rr', 'ry', 'rt', 're', 'lp', 'lr', 'ly', 'lt', 'le'];
const D0 = { tz: '0.', bx: '0.', pr: '0.', lL: '0.', fL: '0.', lR: '0.', fR: '0.', hz: '0.' };
const val = (T, k) => { const v = T[k] ?? D0[k]; if (v === undefined) throw new Error(`bench track: no ${k}`); return typeof v === 'number' ? f(v) : v; };
function trackJs(T, dur, loop, extra = []) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]);
  const src = `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { ${KEYS.map(k => `${k}: ${val(T, k)}`).join(', ')}${extra.map(([k, e]) => `, ${k}: ${e}`).join('')} };`;
  const fn = new Function(...ks, 't', 'D', src);
  return t => fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur);
}

// ── the rig (walk2.js; chars.js voxels × 0.05): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre),
// in the arm's rest frame (hanging); the standing legs (gait2.js R2)
const RIG = { hipY: .5, hipZ: .025, hipX: .125, L: (.2 + .175) * .998, ank: .125, heel: .175, toe: .275, shX: .25, shY: .825, hinge: [0, .65, .05], gripX: .325, gripY: .39 };
// the IK's reach (work.js): |grip − shoulder|² = RA + RB cos(e − φ), the branch e ≥ φ up to EMAX (below the thick sleeve's soft cap)
const gx = RIG.gripX - RIG.shX, hy = RIG.hinge[1] - RIG.shY, hz = RIG.hinge[2], gy = RIG.gripY - RIG.hinge[1], gz = -RIG.hinge[2];
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);

// THE GLSL of a clip: the body, the feet, the eyes, both arms' keyed angles, then THE OTHER HAND ON ITS TARGET (ik, optional):
//   ik = { side: 0 | 1 (the arm it moves), k: expr (1 = on the target, 0 = the arm's keyed angles), m: expr (0 = the bench point,
//          1 = the point on the other hand), bench: [x, y, z] (body frame, exprs), hand: [x, y, z] (the other arm's REST frame, exprs: a
//          point of its tool), pole: [x, y, z] (where the elbow points, chest frame) }
function trackGlsl(T, ik) {
  const v = k => val(T, k);
  const head = /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${v('tx')}, ${v('ty')}, ${v('tz')}); P.drop = ${v('drop')}; P.bodyX = ${v('bx')}; P.pRoll = ${v('pr')};
  cFoot(P, 0, ${v('zL')}, ${v('lL')}, ${v('fL')}); cFoot(P, 1, ${v('zR')}, ${v('lR')}, ${v('fR')});
  P.head = vec3(${v('hx')} - P.torso.x, ${v('hy')} - P.torso.y, ${v('hz')});
  cArm(P, 1, vec4(${v('rp')}, ${v('rr')}, ${v('ry')}, ${v('rt')}), ${v('re')}, 1.);
  cArm(P, 0, vec4(${v('lp')}, ${v('lr')}, ${v('ly')}, ${v('lt')}), ${v('le')}, 1.);`;
  if (!ik) return head;
  const sx = ik.side ? '1.' : '-1.', so = ik.side ? '-1.' : '1.', eo = ik.side ? 'P.elb.x' : 'P.elb.y';
  return head + /* glsl */`
  // THE OTHER HAND ON ITS TARGET (work.js's two-bone IK): the bench point (body frame → the chest's rest frame, through walk2.js's standing
  // pelvis and the chest's turn) mixed with a point of the other hand's tool (its rest frame → the chest's rest frame: its elbow, then its
  // shoulder's turn); then the elbow from the reach, and the arm's turn that takes the bent rest arm's grip onto it, the elbow to the pole
  {
    float bnK = ${ik.k}, bnM = ${ik.m ?? '0.'};
    float bnL = (A_L1 + A_L2) * .998, bnSr = sin(P.pRoll) * A_HIPX;
    float bnHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(bnL * bnL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + bnSr, P.ank.w + sqrt(max(bnL * bnL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - bnSr));
    mat3 bnMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));
    vec3 bnB = vec3(0., A_HIPY, A_HIPZ) + bnMt * (vec3(${ik.bench.join(', ')}) - vec3(P.bodyX, bnHip, A_HIPZ));
    vec3 bnP = vec3(${ik.hand.join(', ')}), bnE = vec3(bnP.x, ${f(RIG.hinge[1])}, ${f(RIG.hinge[2])}), bnS = vec3(${so} * A_SHX, A_SHY, 0.);
    vec3 bnQ = bnS + aArmRot(P, ${so}) * (bnE + aRX(-${eo}) * (bnP - bnE) - bnS);
    float sx = ${sx};
    vec3 wkT = mix(bnB, bnQ, bnM) - vec3(sx * A_SHX, A_SHY, 0.), wkH = vec3(${ik.pole.join(', ')});
    float wr2 = clamp(dot(wkT, wkT), ${f(RMIN ** 2)}, ${f(RMAX ** 2)}), we = ${f(PHI)} + acos(clamp((wr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), wc = cos(we), ws = sin(we);
    vec3 wv = vec3(sx * ${f(gx)}, ${f(hy)} + wc * ${f(gy)} + ws * ${f(gz)}, ${f(hz)} - ws * ${f(gy)} + wc * ${f(gz)}), wl = vec3(sx * ${f(gx)}, ${f(RIG.hinge[1] - RIG.shY)}, 0.);
    vec3 e1 = normalize(wv), e2 = normalize(wl - dot(wl, e1) * e1), f1 = normalize(wkT), f2 = normalize(wkH - dot(wkH, f1) * f1);
    mat3 wR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
    // R = Rz(a) Rx(b) Ry(c) (idle.js aArmRot with no yaw), the branch with |a| ≤ π/2
    float wb = asin(clamp(wR[1][2], -1., 1.)), wa = atan(-wR[1][0], wR[1][1]), wcc = atan(-wR[0][2], wR[2][2]);
    if (abs(wa) > 1.5707963) { wa -= sign(wa) * 3.14159265; wb = (wb >= 0. ? 3.14159265 : -3.14159265) - wb; wcc += wcc > 0. ? -3.14159265 : 3.14159265; }
    cArm(P, ${ik.side}, vec4(-wb, sx * wa, 0., -sx * wcc), we, bnK);
  }`;
}

// ── THE FORWARD KINEMATICS of a hand (walk2.js, the standing body, the walk's weight 0; react.js handFK's, both arms): its rest-frame
// points (the arm hanging) → the walker's body frame. GLSL's aRX / aRY / aRZ, as matrices on column vectors.
const R3 = { x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; } };
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const ankle = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
function handFK(v, side) {
  const sx = side ? 1 : -1, a = side ? [v.rp, v.rr, v.ry, v.rt] : [v.lp, v.lr, v.ly, v.lt], e = side ? v.re : v.le;
  const L = ankle(v.zL, v.fL, v.lL), Rr = ankle(v.zR, v.fR, v.lR), sr = Math.sin(v.pr) * RIG.hipX;
  const hL = L[1] + Math.sqrt(Math.max(RIG.L ** 2 - L[0] ** 2 - v.bx ** 2, 0)) + sr, hR = Rr[1] + Math.sqrt(Math.max(RIG.L ** 2 - Rr[0] ** 2 - v.bx ** 2, 0)) - sr;
  const hip = Math.min(RIG.hipY - v.drop, hL, hR), pc = [0, RIG.hipY, RIG.hipZ], sh = [sx * RIG.shX, RIG.shY, 0];
  const chest = d => R3.z(v.tz + .5 * v.pr, R3.x(v.tx, R3.y(v.ty, d)));
  const arm = d => { d = R3.y(-sx * a[3], d); d = R3.x(-a[0], d); d = R3.z(sx * a[1], d); return R3.y(-sx * a[2], d); };
  const rot = d => chest(arm(R3.x(-e, d)));
  const pt = p => vadd([v.bx, hip, RIG.hipZ], chest(vsub(vadd(sh, arm(vsub(vadd(RIG.hinge, R3.x(-e, vsub(p, RIG.hinge))), sh))), pc)));
  return { pt, rot, hip };
}
// THE TOOL IN THE HAND: its axes (columns: the tool's x, y, z) in the +x hand's rest frame; its grip point sits on the hand's (the
// mitten's centre). A −x hand mirrors x.
function toolPose(v, side, axes, grip) {
  const sx = side ? 1 : -1, H = handFK(v, side), g = [sx * grip[0], grip[1], grip[2]];
  // (mirrored for the −x hand: x flips; then fix the handedness by flipping the x column)
  const ax = axes.map(c => [sx * c[0], c[1], c[2]]);
  if (!side) ax[0] = ax[0].map(c => -c);
  return { p: H.pt(g), R: ax.flatMap(H.rot) };
}
// a rotation (column-major 3×3, as gun-prop.js's R) ↔ a quaternion, and the slerp between two
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
// the clip entry's prop: { id, geometry(THREE), pose(t) → { p, R, show }, matrix(THREE, t, out), track(t), …points }. The tool rides
// `hand`. With `lie` (expr, 0 … 1) it rests on the bench while lie is 1: at `bench: { p, R }` (body frame), or where the hand holds it
// at the clip time `lieAt` (the hand is keyed to the same pose when it picks it up and puts it down, so nothing jumps); between 0 and 1
// it is blended between the two (the grip point slid, the axes slerped). prop.bench is that resting pose, for the city to draw the tool
// on the bench while another clip plays.
function propOf(o, T, dur, loop) {
  const extra = [['show', o.show ?? '1.'], ['lie', o.lie ?? '0.']];
  const tr = trackJs(T, dur, loop, extra);
  const held = v => ({ ...toolPose(v, o.hand, o.axes, [RIG.gripX, RIG.gripY, 0]), show: v.show });
  const B = o.bench || (o.lieAt !== undefined ? (({ p, R }) => ({ p, R }))(held(tr(o.lieAt))) : null), qB = B ? quatOf(B.R) : null;
  const pose = t => { const v = tr(t); if (!B || v.lie <= 0) return held(v); if (v.lie >= 1) return { p: B.p.slice(), R: B.R.slice(), show: v.show };
    const h = held(v), k = v.lie; return { p: h.p.map((x, i) => x + (B.p[i] - x) * k), R: rotOf(slerp(quatOf(h.R), qB, k)), show: v.show }; };
  const P = { id: o.id, hand: o.hand ? 'R' : 'L', geometry: o.geometry, pose, track: tr, matrix: (THREE, t, out) => o.matrix(THREE, pose(t), out) };
  if (B) P.bench = { p: B.p.slice(), R: B.R.slice() };
  for (const [k, fn] of Object.entries(o.points || {})) P[k] = t => fn(pose(t));
  return P;
}
// set: the lab's stand-in of the city's bench (bench-props.js benchSetGeometry; CLIPS.md § The lab), drawn under the actor so the tools
// land on something; the city builds its own set to BENCH
const SET = { id: 'bench', geometry: THREE => benchSetGeometry(THREE) };
const clip = o => ({ name: o.name, dur: o.dur, loop: !!o.loop, hold: !!o.hold, blendIn: o.blendIn ?? .3, blendOut: o.blendOut ?? .3, note: o.note,
  ...(o.beats || {}), prop: propOf(o.prop, o.track, o.dur, !!o.loop), set: SET, glsl: trackGlsl(o.track, o.ik) });
// a timeline of KEY POSES → one keyed expression per channel: tl = [[t, pose, ease?], …]; a pose is { channel: value } and may give an arm
// as R: [pitch, roll, yaw, twist, elbow] (or L: …); a channel a key leaves out holds its value there (a flat segment)
const ARM = { R: ['rp', 'rr', 'ry', 'rt', 're'], L: ['lp', 'lr', 'ly', 'lt', 'le'] };
function timeline(tl, chans) {
  const flat = p => { const o = { ...p }; for (const s of ['R', 'L']) if (p[s]) { ARM[s].forEach((k, i) => o[k] = p[s][i]); delete o[s]; } return o; };
  const T = tl.map(([t, p, e]) => [t, flat(p), e]), out = {};
  for (const c of chans) { const K = []; let last; for (const [t, p, e] of T) { const v = p[c] ?? last; if (v === undefined) continue; K.push([t, v, e]); last = v; } if (K.length) out[c] = keys(K); }
  return out;
}
const sum = (...a) => `(${a.filter(Boolean).join(' + ')})`;
export const CLIPS = [];

// ═══ BENCH_HAMMER (2.8 s loop): the hammer rests face-down on the anvil at t 0 · three strikes, the IMPACTS at 0.6, 1.2 and 1.8 s (the
// sparks' beats: STRIKES; prop.face(t): where they fly from and which way): each time a quick rebound off the anvil (REB, 0.06 s), the
// hammer lifted straight up off the work (HIGH, its face 14 cm over the anvil, its head tipped up) and swung up and OUT past the +x
// shoulder to beside the head, cocked (TOP, 0.36 s after the impact), held a beat (0.07 s), then the blow: swung down and in, faster
// and faster, to HIGH over the anvil (0.135 s) and SNAPPED straight down onto it (0.035 s), the face flat on the anvil's top at the
// impact. The chest coils away on the wind-up (the +x shoulder back, the head tipped away from the hammer) and drops into the blow, the
// knees give; at the impact the shoulders jolt forward, the head dips with the blow and then flinches from the sparks, and the −x hand,
// lifted off the bench through the wind-up, is planted again on it · 1.95–2.78 the hammer rests, the walker leans in a little and
// turns to look at the work, the −x hand pats the bench beside it · back to rest by 2.8.
// THE HAMMER IN THE HAND: its handle runs out of the fist along the fingers, tipped 10° toward the thumb, the face to the pinky's side,
// so at the impact (the forearm level) the handle lies along the anvil and the face comes down flat. The poses were solved against the
// bench (bench-props.js BENCH.anvil) with the hand's forward kinematics, the mitten's box (0.25 m deep), the hammer's cells and the
// head's box: IMP puts the whole face on the anvil's top (its four corners within 0.3 mm of y 0.50, its normal 0.3° off straight down;
// the head bowed 0.2, its chin clear of the fist), HIGH is as high over the anvil as the fist can go under the chin (the head lifts to
// 0.09 to let it by, ≥ 2.5 cm), the top is as high as the head allows (the hammer's head at y 1.09, beside the head's lower third);
// elbows ≤ 1.43. (The refine pass, 2026-10-16: the old blow came down out at the side to bench height and swept in sideways at the
// anvil's height, into the anvil's side, landing 9° tilted, one edge 1.3 cm in; the lift slid back out the same way.)
const HAM_A = 10 * PI / 180, HAM_AXES = [[1, 0, 0], [0, -Math.cos(HAM_A), Math.sin(HAM_A)], [0, -Math.sin(HAM_A), -Math.cos(HAM_A)]];
const HAM_D = 2.8, STRIKES = [.6, 1.2, 1.8];
// the +x arm's key poses (pitch, roll out, yaw in, twist in, elbow) and the body's at each
const HP = {
  IMP: { R: [.8195, -.0481, .1717, .0822, .6583], tx: .08, ty: .047, drop: .014, hx: .2, hy: .02, hz: 0 },
  REB: { R: [.4781, -.0154, .1173, .097, 1.2102], tx: .065, ty: .047, drop: .01, hx: .161, hy: .02, hz: .04 },
  HIGH: { R: [.3902, -.0001, .0844, .078, 1.4203], tx: .039, ty: .055, drop: .015, hx: .09, hy: 0, hz: .05 },
  TOP: { R: [.2492, .9723, -.2492, -1.2772, 1.1967], tx: .07, ty: .1, drop: .01, hx: .18, hy: -.05, hz: .07 },
};
const HAM_TL = (() => { const tl = [[0, HP.IMP]];
  // (the previous impact, or the rest at t 0)
  for (const s of STRIKES) { const a = s - .6;
    tl.push([a + .06, HP.REB, 'cOut'], [a + .2, HP.HIGH, 'cS'], [a + .36, HP.TOP, 'cOut'], [a + .43, HP.TOP], [a + .565, HP.HIGH, 'cIn'], [s, HP.IMP, 'cR']); }
  const e = STRIKES[2];
  // (the last rebound settles; it rests through the look)
  tl.push([e + .06, HP.REB, 'cOut'], [e + .22, HP.IMP, 'cS'], [HAM_D, HP.IMP]);
  return tl; })();
// (fl: the flinch after each impact; jt: the jolt through the body, after the rebound has lifted the hammer; nd: the head's dip into
// each blow; wu: each wind-up, 0 at the impacts)
const hammer = { vars: [['br', `sin(${f(2 * PI / HAM_D)} * t)`], ['lk', 'cS(t, 1.95, 2.25) * (1. - cS(t, 2.5, 2.78))'], ['pt', 'cBump(t, 2.22, 2.36) + cBump(t, 2.36, 2.5)'],
    ['fl', STRIKES.map(s => `cBump(t, ${f(s)}, ${f(s + .14)})`).join(' + ')], ['nd', STRIKES.map(s => `cBump(t, ${f(s - .06)}, ${f(s + .05)})`).join(' + ')],
    ['jt', STRIKES.map(s => `cBump(t, ${f(s + .04)}, ${f(s + .2)})`).join(' + ')],
    ['wu', STRIKES.map(s => `cS(t, ${f(s - .4)}, ${f(s - .24)}) * (1. - cS(t, ${f(s - .17)}, ${f(s)}))`).join(' + ')]],
  ...timeline(HAM_TL, ['rp', 'rr', 'ry', 'rt', 're', 'tx', 'ty', 'drop', 'hx', 'hy', 'hz']),
  zL: -.04, zR: .04, lp: .4, lr: -.2, ly: .16, lt: .15, le: 1.16 };
// the look (1.95–2.78): the chest leans in a little and turns to the work (the hammer arm lifts with it, clear of the bench), the head
// turns to it; at each impact the shoulders jolt forward and the knees give, the head dips with the blow, then flinches; a breath
hammer.tx = sum(hammer.tx, '.01 * lk', '.02 * jt'); hammer.rp = sum(hammer.rp, '.06 * lk'); hammer.re = sum(hammer.re, '-.02 * lk'); hammer.ty = sum(hammer.ty, '.03 * lk'); hammer.drop = sum(hammer.drop, '.01 * lk', '.008 * jt');
hammer.hx = sum(hammer.hx, '.04 * nd', '-.07 * fl', '-.004 * br'); hammer.hy = sum(hammer.hy, '.06 * lk'); hammer.hz = sum(hammer.hz, '.02 * fl');
// the −x hand on the bench (body frame): it steadies the work, lifting off the bench as the body winds up and planted again with each
// blow (a jolt with the impact); on the look it draws back a little and pats the bench
const HAM_L = { x: -.15, y: .607, z: .41 };
CLIPS.push(clip({ name: 'bench_hammer', dur: HAM_D, loop: true, blendIn: .35, blendOut: .3, track: hammer, beats: { strikes: STRIKES },
  ik: { side: 0, k: '1.', bench: [`${f(HAM_L.x)} - .03 * lk - .012 * wu`, `${f(HAM_L.y)} - .02 * lk - .012 * pt + .024 * wu + .006 * fl`, `${f(HAM_L.z)} + .01 * lk - .015 * wu`], hand: ['0.', '0.', '0.'], pole: ['-.7', '-1.', '-.3'] },
  prop: { id: 'hammer', hand: 1, axes: HAM_AXES, geometry: THREE => benchGeometry(THREE, 'hammer'), matrix: benchMatrix,
    points: { face: q => ({ p: benchPoint(q, HAMMER.face), n: benchDir(q, HAMMER.up) }) } },
  note: 'a loop at the bench (prop: hammer, in the +x hand; the city places the bench and the anvil, bench-props.js BENCH): the hammer rests on the anvil · three strikes, the IMPACTS at 0.6, 1.2 and 1.8 s (the sparks: `strikes`, from prop.face(t)): a quick rebound, the hammer lifted straight up off the work and swung up past the +x shoulder to beside the head (0.36 s after each impact), held a beat, then swung down and in, faster and faster, and snapped straight down onto the anvil, the face landing flat (0.17 s) · the chest coils on each wind-up and drops into the blow, the shoulders jolt and the knees give at the impact, the head dips with it and flinches from the sparks; the −x hand lifts off the bench through each wind-up and is planted again with the blow · 1.95–2.78 a lean in to look at the work, the −x hand pats the bench · rests again by 2.8' }));

// ═══ BENCH_STAMP (3.4 s loop): forging the warrant. The stamp held over the paper at t 0 (HOVER) · inked on the pad at the +x side, two
// dabs (0.28, 0.44 s) · twice: lifted up beside the head (UP, 0.24 s before the slam), a held beat, then SLAMMED down onto the paper
// (the PRESSES at 1.08 and 2.04 s: SLAMS, the seal's beats; prop.seal(t)) through a low pass (LOW) so the fist stays under the head's
// corner; the knees give and the chest drops into it; pressed (and rocked, the first time) · 2.55–3.3 the walker reads the seal, the
// head turned and tilted, while the −x hand smooths the paper · back over the paper by 3.4.
// THE STAMP IN THE HAND: its handle through the fist like the gun's grip (gun-prop.js: the knob at the thumb end, the base and the rubber
// under the pinky end, the base's long side along the fingers), so with the forearm level the stamp stands upright and comes down flat.
// The −x hand pins the paper's left edge throughout (IK on the bench point). The fist can't rise above y ≈ 0.63 over the paper (the head's chin
// edge), so the slam's weight is in the knees and the chest, and the wind-up goes out to the side.
// (its handle up through the fist, the base's long side along the fingers)
const STAMP_AXES = [[0, -1, 0], [0, 0, 1], [-1, 0, 0]];
const ST_D = 3.4, SLAMS = [1.08, 2.04];
const SP = {
  HOVER: { R: [.4063, -.0081, .3343, .307, 1.44], tx: .08, ty: -.02, drop: .01, hx: .12, hy: 0, hz: 0 },
  PRESS: { R: [.682, -.1463, .4081, .3883, .9927], tx: .15, ty: -.03, drop: .04, hx: .2, hy: 0, hz: 0 },
  INK: { R: [.7272, .1306, -.3394, -.2558, .9386], tx: .1, ty: -.08, drop: .02, hx: .14, hy: .15, hz: 0 },
  // (up beside the head: as high as it clears the head by 2.5 cm)
  UP: { R: [.4977, 1.0554, -.7479, -1.2351, .7376], tx: .05, ty: .1, drop: 0, hx: .14, hy: -.05, hz: .07 },
};
// (the in-betweens: a key blended between two others, channel by channel)
const between = (a, b, k) => { const o = {}; for (const c of Object.keys(a)) o[c] = Array.isArray(a[c]) ? a[c].map((v, i) => v + (b[c][i] - v) * k) : a[c] + (b[c] - a[c]) * k; return o; };
SP.INKUP = { ...between(SP.INK, SP.HOVER, .45) };
// (the slam's pass, out and low: the fist 3.5 cm under the head's corner, the stamp 2.5 cm over the bench)
SP.LOW = { R: [.3641, .1081, -.2525, -.1332, 1.4402], tx: .1, ty: .02, drop: .02, hx: .18, hy: -.02, hz: .03 };
const ST_TL = [[0, SP.HOVER], [.28, SP.INK], [.36, SP.INKUP, 'cOut'], [.44, SP.INK, 'cIn'], [.54, SP.INKUP, 'cOut']];
for (const s of SLAMS) ST_TL.push([s - .24, SP.UP, 'cOut'], [s - .1, SP.UP], [s - .04, SP.LOW, 'cIn'], [s, SP.PRESS, 'cR'], [s + .26, SP.PRESS], [s + .46, SP.HOVER, 'cS']);
ST_TL.push([ST_D, SP.HOVER]);
const stamp = { vars: [['rk', `sin(${f(2 * PI * 3 / .35)} * (t - ${f(SLAMS[0])})) * cBump(t, ${f(SLAMS[0] + .03)}, ${f(SLAMS[0] + .24)})`], ['th', SLAMS.map(s => `cBump(t, ${f(s)}, ${f(s + .2)})`).join(' + ')],
    ['lk', 'cS(t, 2.55, 2.75) * (1. - cS(t, 3.0, 3.3))'], ['sm', 'cBump(t, 2.6, 3.2)']],
  ...timeline(ST_TL, ['rp', 'rr', 'ry', 'rt', 're', 'tx', 'ty', 'drop', 'hx', 'hy', 'hz']),
  zL: -.04, zR: .04, lp: .4, lr: -.2, ly: .16, lt: .15, le: 1.16 };
// the rock while pressed; the head jolts up off each slam (the chin can't come down: the fist is under it); the look (the head turned
// and tilted). The thump is in the keys: the knees and the chest go down WITH the slam, so the stamp lands as they bottom out
stamp.rt = sum(stamp.rt, '.03 * rk'); stamp.rr = sum(stamp.rr, '.01 * rk'); stamp.hx = sum(stamp.hx, '-.04 * th');
stamp.hy = sum(stamp.hy, '-.12 * lk'); stamp.hz = sum(stamp.hz, '.08 * lk');
// the −x hand pins the paper's left edge (body frame)
const ST_L = { x: -.14, y: .605, z: .42 };
CLIPS.push(clip({ name: 'bench_stamp', dur: ST_D, loop: true, blendIn: .35, blendOut: .3, track: stamp, beats: { slams: SLAMS },
  ik: { side: 0, k: '1.', bench: [`${f(ST_L.x)} + .05 * sm`, `${f(ST_L.y)}`, `${f(ST_L.z)} + .02 * sm`], hand: ['0.', '0.', '0.'], pole: ['-.7', '-1.', '-.3'] },
  prop: { id: 'stamp', hand: 1, axes: STAMP_AXES, geometry: THREE => benchGeometry(THREE, 'stamp'), matrix: benchMatrix,
    points: { seal: q => ({ p: benchPoint(q, STAMP.face), n: benchDir(q, STAMP.up) }) } },
  note: 'a loop at the bench, forging a warrant (prop: stamp, in the +x hand; the city places the paper and the ink pad, bench-props.js BENCH): the stamp over the paper · inked on the pad, two dabs at 0.28 and 0.44 s · lifted up beside the head by 0.84, held · SLAMMED onto the paper at 1.08 s (`slams`; the seal at prop.seal(t)), the knees give, pressed and rocked · up beside the head again by 1.8, held · SLAMMED at 2.04, pressed · 2.55–3.3 a look at the seal, the −x hand smooths the paper · over the paper again by 3.4' }));

// ═══ BENCH_ASSEMBLE (4.0 s loop): head down over a piece (the pistol being built: gun-prop.js's model, reused) held low over the bench
// in the −x hand (HOLD) · the +x hand leaves it for the parts tray at the +x side (0.05–0.45 s), picks a part (a dip, 0.45–0.6), brings it
// back (0.6–0.95) and fits it at the frame: two pushes along the barrel (1.0–1.4), screws it in (small circles of the hand: the toon
// forearm can't roll, and the arm's twist swings the bent forearm about the upper arm instead, 1.45–1.95), two taps (2.05–2.45) · the
// piece lifted out to the −x side toward the lamp and turned in the light, the head turned to it (LOOK, 2.55–3.35), the +x hand resting
// on the bench · back down to work by 3.8.
// THE +x HAND ON THE PIECE: the IK's target is a point of the piece in the −x hand's rest frame (against its right side by the frame,
// where a mitten touches it), carried there by the −x arm's own pose, so the hands meet on the piece exactly while it moves; mixed with the tray (a
// bench point) when the hand goes for a part. The head bows only as far as its chin edge clears the work (≥ 3 cm, solved).
// (gun-prop.js GUN_IN_HAND: the grip in the fist, the barrel along the fingers)
const PIECE_AXES = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
const AS_D = 4;
const AP = {
  HOLD: { L: [.4829, -.0613, .3493, .2636, 1.1488], tx: .16, ty: .02, drop: .025, hx: .26, hy: -.04, hz: .02 },
  LOOK: { L: [.603, .2534, -.1574, -.2057, 1.0166], tx: .06, ty: -.12, drop: .015, hx: .1, hy: -.36, hz: -.04 },
};
// a point of the piece (gun frame) → the −x hand's rest frame (the IK's `hand` target): (−0.325 + x, 0.39 − z, y)
const onPiece = q => [-RIG.gripX + q[0], RIG.gripY - q[2], q[1]];
// (against the piece's right side by the frame, a fist-width right of the −x fist: the +x fist's centre)
const SLIDE = onPiece([.165, .02, .06]);
const AS_TL = [[0, AP.HOLD], [2.6, AP.HOLD], [3.0, AP.LOOK, 'cS'], [3.3, AP.LOOK], [3.7, AP.HOLD, 'cS'], [AS_D, AP.HOLD]];
const assemble = { vars: [['tr', 'cS(t, .05, .4) * (1. - cS(t, .62, .95))'], ['dp', 'cBump(t, .42, .62)'],
    ['pu', 'cBump(t, 1., 1.2) + cBump(t, 1.2, 1.4)'], ['sk', 'cS(t, 1.45, 1.55) * (1. - cS(t, 1.85, 1.95))'], ['sc', `sin(${f(2 * PI / .25)} * (t - 1.45)) * sk`], ['sc2', `(1. - cos(${f(2 * PI / .25)} * (t - 1.45))) * sk`],
    ['tp', 'cBump(t, 2.05, 2.25) + cBump(t, 2.25, 2.45)'], ['lk', 'cS(t, 2.45, 2.75) * (1. - cS(t, 3.68, 3.95))'], ['nd', 'cBump(t, 1., 1.4) + .6 * cBump(t, 2.05, 2.45)']],
  ...timeline(AS_TL, ['lp', 'lr', 'ly', 'lt', 'le', 'tx', 'ty', 'drop', 'hx', 'hy', 'hz']),
  zL: -.04, zR: .04, rp: .3, rr: .05, ry: .1, rt: .1, re: 1.3 };
// the head: a glance at the tray as the hand goes for the part (lifted a little: the hand passes under its corner); small tilts with the
// pushes and taps (a nod would bring the chin onto the fists); held up while the piece comes back from the light; while it's in the light
// the piece turns a little in the hand (the −x arm's twist)
assemble.hy = sum(assemble.hy, '.08 * tr'); assemble.hx = sum(assemble.hx, '-.15 * tr', '-.1 * cS(t, 3.35, 3.6) * (1. - cS(t, 3.75, 3.98))'); assemble.hz = sum(assemble.hz, '-.04 * nd'); assemble.hz = sum(assemble.hz, '.07 * tr'); assemble.lt = sum(assemble.lt, `.12 * sin(${f(2 * PI / .8)} * (t - 2.95)) * cS(t, 2.9, 3.0) * (1. - cS(t, 3.3, 3.4))`);
const AS_TRAY = { x: .38, y: .645, z: .42 }, AS_REST = { x: .36, y: .615, z: .36 };
CLIPS.push(clip({ name: 'bench_assemble', dur: AS_D, loop: true, blendIn: .35, blendOut: .3, track: assemble,
  ik: { side: 1, k: '1.', m: '(1. - tr) * (1. - lk)',
    bench: [`mix(${f(AS_REST.x)}, ${f(AS_TRAY.x)}, tr)`, `mix(${f(AS_REST.y)}, ${f(AS_TRAY.y)}, tr) - .025 * dp - .022 * cBump(t, 2.42, 2.8)`, `mix(${f(AS_REST.z)}, ${f(AS_TRAY.z)}, tr)`],
    hand: [`${f(SLIDE[0])} + .015 * tp + .014 * sc`, `${f(SLIDE[1])} - .03 * pu`, `${f(SLIDE[2])} + .01 * tp - .014 * sc2 - .022 * cBump(t, 2.42, 2.8)`], pole: ['1.', '-.6', '-.3'] },
  prop: { id: 'pistol', hand: 0, axes: PIECE_AXES, geometry: THREE => gunGeometry(THREE), matrix: gunMatrix,
    points: { muzzle: q => ({ p: gunPoint(q, GUN.muzzle), d: gunDir(q, GUN.dir) }) } },
  note: 'a loop at the bench (prop: pistol, the piece being built, in the −x hand; the city places the parts tray, bench-props.js BENCH): head down over the piece held low · the +x hand to the parts tray 0.05–0.45 s, picks a part, back by 0.95 · fits it at the frame: two pushes 1.0–1.4, screws it in 1.45–1.95, two taps 2.05–2.45 · the piece lifted to the −x side toward the lamp and turned in the light 2.55–3.35, the head turned to it · back to work by 3.8' }));

// ═══ BENCH_TEST_GUN (4.0 s one-shot, holds its last pose): the finished gun stands upright in a small stand on the bench by the +x hand
// (gun-prop.js's pistol, reused; prop.bench is where: the city places the stand under it, bench-props.js BENCH.stand) · the hand goes
// to it (0–0.3 s), grips it and lifts it out (0.38) · the walker leans back with it (the head up: the −x fist on the slide must clear
// the chin) and the −x hand comes to the slide and RACKS it (the pull at 1.05–1.13 s, the snap back 1.16–1.2: RACK, the action's beat)
// · sighted out along the arm to the front-right side, the chest and the eyes turned to it (1.35–2.55), one DRY CLICK at 2.2 (CLICK:
// the trigger, no flash) · turned in the light and looked over (2.6–3.25) · put back in its stand (3.55–3.65) · the hands at rest on
// the bench; held there until stopClip. The stand holds it UPRIGHT because the toon forearm can't roll: the fist can't lie flat on a
// bench to pick a gun up off its side.
// (gun-prop.js GUN_IN_HAND)
const GUN_AXES = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
const TG_D = 4, RACK = [1.05], CLICK = [2.2];
const GP = {
  REST: { R: [.3166, .0146, -.0381, -.0362, 1.4401], tx: .14, ty: -.02, tz: 0, drop: .02, hx: .24, hy: .02, hz: 0 },
  GRAB: { R: [.3915, .0123, .0786, .0727, 1.3813], tx: .16, ty: -.04, tz: 0, drop: .03, hx: .24, hy: .06, hz: 0 },
  // (the rack: leaning back, the head up, so the −x fist on the slide clears the chin)
  LIFT: { R: [.2625, -.0903, .1455, .1411, 1.1422], tx: -.05, ty: -.04, tz: 0, drop: .01, hx: .02, hy: .04, hz: 0 },
  AIM: { R: [.8132, .0914, -.6635, -.1745, .8806], tx: .02, ty: .15, tz: -.03, drop: .01, hx: .04, hy: .75, hz: -.04 },
  LOOK: { R: [.5452, -.7719, -.1104, -.1317, 1.4401], tx: .06, ty: 0, tz: 0, drop: .015, hx: .16, hy: .05, hz: .06 },
};
const TG_TL = [[0, GP.REST], [.3, GP.GRAB, 'cS'], [.38, GP.GRAB], [.78, GP.LIFT, 'cS'], [1.35, GP.LIFT], [1.75, GP.AIM, 'cS'], [2.55, GP.AIM],
  [2.95, GP.LOOK, 'cS'], [3.25, GP.LOOK], [3.55, GP.GRAB, 'cS'], [3.65, GP.GRAB], [3.95, GP.REST, 'cS'], [TG_D, GP.REST]];
const testGun = { vars: [['pl', 'cS(t, 1.05, 1.13) * (1. - cS(t, 1.16, 1.2))'], ['rk', 'cS(t, .8, 1.) * (1. - cS(t, 1.28, 1.5))'], ['ck', 'cBump(t, 2.2, 2.3)'],
    ['ey', 'cS(t, .6, .8) * (1. - cS(t, 1.3, 1.5))']],
  ...timeline(TG_TL, ['rp', 'rr', 'ry', 'rt', 're', 'tx', 'ty', 'tz', 'drop', 'hx', 'hy', 'hz']),
  zL: -.04, zR: .04, lp: .4, lr: -.2, ly: .16, lt: .15, le: 1.16 };
// the rack: the gun hand braces against the pull (a push forward); the click: the muzzle dips a hair as the trigger breaks, the head
// tips to listen; the head stays up while the −x fist is on the slide and while the gun goes back to its stand (both pass under the chin)
testGun.rp = sum(testGun.rp, '.05 * pl', '-.03 * ck'); testGun.hz = sum(testGun.hz, '.05 * ck'); testGun.hx = sum(testGun.hx, '-.03 * ey', '-.1 * cBump(t, 3.2, 3.7)'); testGun.hy = sum(testGun.hy, '-.06 * ey');
// the −x hand: at rest on the bench, then on the slide's left side at its rear (a point of the gun in the +x hand's rest frame:
// (0.325 + x, 0.39 − z, y)), pulled back along the barrel and let go
const onGun = q => [RIG.gripX + q[0], RIG.gripY - q[2], q[1]], TG_SLIDE = onGun([-.1, .1, -.03]), TG_L = { x: -.15, y: .615, z: .41 };
CLIPS.push(clip({ name: 'bench_test_gun', dur: TG_D, hold: true, blendIn: .3, blendOut: .35, track: testGun, beats: { rack: RACK, click: CLICK },
  ik: { side: 0, k: '1.', m: 'rk', bench: [f(TG_L.x), f(TG_L.y), f(TG_L.z)], hand: [f(TG_SLIDE[0]), `${f(TG_SLIDE[1])} + .06 * pl`, f(TG_SLIDE[2])], pole: ['-.7', '-1.', '-.3'] },
  prop: { id: 'pistol', hand: 1, axes: GUN_AXES, geometry: THREE => gunGeometry(THREE), matrix: gunMatrix, lieAt: .38, lie: '1. - step(.38, t) + step(3.6, t)',
    points: { muzzle: q => ({ p: gunPoint(q, GUN.muzzle), d: gunDir(q, GUN.dir) }) } },
  note: 'a one-shot at the bench (prop: pistol, the finished gun, standing upright in its stand on the bench by the +x hand: prop.bench is where, the city places the stand; it holds its last pose): the hand goes to it 0–0.3 s, grips it and lifts it out at 0.38, brings it up as the walker leans back · the −x hand racks the slide: the pull at 1.05 s (`rack`), the snap back by 1.2 · sighted out to the front-right side, the eyes along it, 1.35–2.55; one dry click at 2.2 (`click`: no flash) · turned in the light 2.6–3.25 · back in its stand 3.55–3.65 · the hands at rest on the bench by 4.0, held' }));
