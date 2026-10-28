// CLIPS · grab (events): the crate grab at the docks: lifting the crate, tugging it away, shoving a rival off (GAME.md §20; 2026-10-15). One owner; CLIPS.md has the entry format.
// (the grab agent, 2026-10-15; grab.md has the staging the city needs: the crate on the ground, the spots, the pairs' gaps, the chains)
// "Grab | a scramble for the crate at the docks" (GAME.md §20). A shipment's crate lands at the Low Tide Docks on nights 2, 5, 8 and
// 11 (§9) and the strongest group takes it. The crate is one prop (grab-props.js, 0.55 × 0.40 × 0.25 m, the contents' colourway):
//   crate_lift       3.2 s one-shot · the crate on the ground ahead: squats, takes the two rope handles, a first heave that won't budge
//                    it, a breath, THE HEAVE from the legs up to the belly, a hitch up to the chest, staggers back a step under the
//                    weight, settles; ends 0.12 m back (shift) holding it → crate_run
//   crate_run        MOVING loop (2.0 m/s) · the hurried heavy carry: short quick steps leaning into it, the crate hugged at the chest,
//                    a jolt on every step (it drops and swings, the arms give), a hitch, a glance back for whoever is after it; at
//                    walk weight 0 it is the hold, still (every clip that ends holding the crate lands there, crate_ram starts there)
//   crate_tug        4.6 s one-shot (pair → crate_tug_lose) · the scramble: both at the crate on the ground; the winner lifts it, the
//                    loser hooks its far edge as it comes up; three surges and a deadlock; the winner twists it free and staggers
//                    back into the hold (shift) → crate_run
//   crate_tug_lose   4.4 s one-shot · the loser: hangs back, steps in and hooks the edge, pulls and is dragged, his fists slip off
//                    as it's twisted free, reels back three steps, catches himself (shift)
//   crate_ram        2.5 s one-shot (pair → crate_rammed) · "shoving a rival off the crate": the holder (from the hold) has a rival's
//                    fists on its edge; rips it back, winds up and rams him with it at arm's length (shift) → crate_run
//   crate_rammed     1.25 s one-shot · the rival: steps in, grabs the edge, tussles, it's torn out of his fists; the plain stand at
//                    the ram → shove_fall (falls.js) → lie_hurt
// THE METHOD (heist.js's and work.js's, CLIPS.md § Props): every clip is ONE TRACK of scalar expressions valid in both GLSL and JS
// (the body, the feet, the root, the eyes, the crate's pose, each hand's target). The GLSL poses the body from it and puts each hand ON
// its target with a two-bone IK on the elbow (the reach sets the elbow, the shoulder turns the bent arm so its grip point lands on the
// target, the elbow toward a pole); the CPU evaluates the same strings for the crate's matrix, so the fists and the crate cannot part.
// A hand's target is a point of the crate (its handle: CRATE.grip) wherever the crate is, or a path toward it before it is taken.
// THE CRATE NEVER MOVES BEFORE THE HANDS HAVE IT: it stands on the ground (its pose = groundPose) until both fists are on its
// handles, and it is hoisted only by the track the fists follow.
// THE TOON ARM reaches only 0.403–0.453 m from the shoulder (the elbow ≤ 83°, under the thick sleeve's soft cap) and the big head owns
// everything above y 0.95 inside x ±0.4 (the ears to ±0.5) and z −0.35…0.40. So the crate is carried at the chest with the fists on
// its two ends, 0.415 m out (its back face 0.29 m from the chest: a puffer's front is at 0.30), its top 0.15 m under the chin (the head
// nods 0.3 rad when a runner stops: it still clears); reaching it on the ground takes a deep squat (the knees bent ~100°) and the chest
// pitched ~0.65 rad.
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll (+: the top toward −x). Feet: cFoot (the body-frame z of the foot's ground point; a planted foot under a
// moving root sits at its spot − the root).
import { CRATE, crateGeometry, crateMatrix, cratePoint } from './grab-props.js';
import { WALK2, R2, buildGait, table, LEVELS } from '../gait2.js';

const f = v => (+v).toFixed(4), PI = Math.PI;
// ── the rig (walk2.js; chars.js voxels × 0.05): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre)
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
export const REACH = { min: RMIN, max: RMAX, shoulder: [SH.x, SH.y, 0] };

// ── the shared expressions' JS side: clips/index.js CLIP_HELPERS and GLSL's built-ins
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, exp: Math.exp, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, sign: Math.sign,
    smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key: cS, cIn,
// cOut, cR, cBack). work.js keys(), except that each step is rounded against the running sum (a), not on its own: every key is hit to
// the 4th decimal however many keys there are (the solved channels have ~100), so a clip that ends on the hold ends on it exactly
export function keys(K, T = 't') { let a = +f(K[0][1]), s = f(a); for (let i = 1; i < K.length; i++) { const d = +f(K[i][1] - a); if (Math.abs(d) < 1e-9) continue; a = +f(a + d); s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; }

// ── THE TRACK: { vars: [[name, expr], …] (scalars, in order), body: { tx, ty, tz, drop, bx, pr } (absolute), feet: { zL, lL, fL, zR,
// lR, fR } (cFoot; a moving clip leaves them out: the walk's legs), root: { rx, ry, cx, cy, cz, mx, mz } (the whole body's pitch and yaw
// about (cx, cy, cz) and its move: cRot.xy, cPiv, cMov), head: { hx, hy, hz } (where the eyes look: body-frame pitch, yaw, roll; P.head
// = this − the chest − the root), crate: { x, y, z, yaw, pitch, roll, show } (grab-props.js's pose, in the track's frame), mirror: m (a
// pair's PARTNER: the crate's pose is its LEAD's, in the lead's walker frame, and this walker stands m ahead of the lead facing it, so
// a crate point p is (−p.x, p.y, m − p.z) here), arms: [−x, +x], each { free: [pitch, roll, yaw, twist, elbow] (cArm's angles), fk
// (its weight, default 1), ik: { on: [x, y, z] (a point of the crate's frame: CRATE.grip[s], …), at: [x, y, z] (a point of the
// track's frame), mk (on ← at: 0 the `at` point, 1 the crate's; default 1 with `on`, 0 without), pole: [x, y, z] (where the elbow
// points, chest frame), k (the IK over the free pose), root: { x, y, z, k } (a target in the root's own frame, blended in: heist.js) } },
// frame: 'body' (targets and the crate in the walker's body frame, a standing clip: the GLSL takes them into the chest's rest frame
// through the clip's root and walk2.js's standing pelvis) or 'chest' (in the chest's rest frame: a moving clip), extra: GLSL lines after
// the body (before the arms) }
const BODY = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr'], FEET = ['zL', 'lL', 'fL', 'zR', 'lR', 'fR'], ROOT = ['rx', 'ry', 'cx', 'cy', 'cz', 'mx', 'mz'], HEAD = ['hx', 'hy', 'hz'], POSE = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'show'];
const D0 = { tz: '0.', bx: '0.', pr: '0.', hz: '0.', rx: '0.', ry: '0.', cx: '0.', cy: '0.', cz: '0.', mx: '0.', mz: '0.', yaw: '0.', pitch: '0.', roll: '0.', show: '1.' };
const val = (o, k) => o?.[k] ?? D0[k] ?? '0.';
const grp = (o, ks) => `{ ${ks.map(k => `${k}: ${val(o, k)}`).join(', ')} }`;
const PV = CRATE.pivot, rel = q => q.map((v, i) => v - PV[i]);
const ikMk = a => a.ik.mk ?? (a.ik.on ? '1.' : '0.');
// the JS side: (t, u, w) → every channel's value, the vars and each arm's target (in the track's frame; a loop wraps t itself)
function jsTrack(T, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]);
  const arm = a => `{ free: [${(a.free || ['0.', '.04', '0.', '0.', '0.']).join(', ')}], fk: ${a.free ? a.fk ?? '1.' : '0.'}, ik: ${a.ik ? `{ at: ${a.ik.at ? `[${a.ik.at.join(', ')}]` : 'null'}, mk: ${ikMk(a)}, k: ${a.ik.k ?? '1.'}${a.ik.root ? `, root: { x: ${a.ik.root.x}, y: ${a.ik.root.y}, z: ${a.ik.root.z}, k: ${a.ik.root.k} }` : ''} }` : 'null'} }`;
  const src = `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { body: ${grp(T.body, BODY)}, feet: ${T.feet ? grp(T.feet, FEET) : 'null'}, root: ${grp(T.root, ROOT)}, head: ${grp(T.head, HEAD)},
    crate: ${T.crate ? grp(T.crate, POSE) : 'null'}, arms: [${T.arms.map(arm).join(', ')}], vars: { ${(T.vars || []).map(([k]) => k).join(', ')} } };`;
  const fn = new Function(...ks, 't', 'D', 'u', 'w', src), M = T.mirror;
  return (t, u = 0, w = 0) => { const r = fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur, u, w);
    r.arms.forEach((a, s) => { const ik = T.arms[s].ik; if (!ik) return;
      let on = ik.on && r.crate ? cratePoint(r.crate, ik.on) : null; if (on && M !== undefined) on = [-on[0], on[1], M - on[2]];
      const at = a.ik.at, k = a.ik.mk; a.ik.target = on && at ? at.map((v, i) => v + (on[i] - v) * k) : on || at; });
    return r; };
}
// arm poses as key poses blended in order: [P0, [P1, k1], [P2, k2], …] → five scalar expressions (pitch, roll, yaw, twist, elbow),
// each mix(mix(P0, P1, k1), P2, k2)… (valid GLSL and JS); a pose's entries may be expressions
const poseMix = (P0, ...rest) => [0, 1, 2, 3, 4].map(i => rest.reduce((e, [Q, k]) => `mix(${e}, ${typeof Q[i] === 'number' ? f(Q[i]) : Q[i]}, ${k})`, typeof P0[i] === 'number' ? f(P0[i]) : P0[i]));
// THE HAND IK (work.js / talk-patrol.js / heist.js, GLSL): side 0 (−x) / 1 (+x); T = the grip point's target, H = where the elbow points
// (both in the chest's rest frame); k = its weight over the arm as it is
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
// the GLSL side
function glslTrack(T) {
  const body = T.frame !== 'chest', anyIK = T.arms.some(a => a.ik), M = T.mirror;
  // a body-frame target is in the walker's frame: the clip's root is undone first; ik.root = { x, y, z, k } blends in a target given in
  // the root's own frame (it moves with the body: a hand that has let go)
  const chest = (p, r) => body ? `(vec3(0., A_HIPY, A_HIPZ) + hMt * (mix(cPiv + hRq * (${p} - cPiv - cMov), vec3(${r ? `${r.x}, ${r.y}, ${r.z}` : '0.'}), ${r ? r.k : '0.'}) - vec3(P.bodyX, hHip, A_HIPZ)))` : p;
  // a point of the crate where the crate is (crP, crM: its pivot and turn), in this walker's frame (a partner's: mirrored)
  const onCrate = q => { const e = `(crP + crM * vec3(${rel(q).map(f).join(', ')}))`; return M === undefined ? e : `(vec3(-1., 1., -1.) * ${e} + vec3(0., 0., ${f(M)}))`; };
  const target = a => { const on = a.ik.on ? onCrate(a.ik.on) : null, at = a.ik.at ? `vec3(${a.ik.at.join(', ')})` : null; return on && at ? `mix(${at}, ${on}, ${ikMk(a)})` : on || at; };
  return /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${val(T.body, 'tx')}, ${val(T.body, 'ty')}, ${val(T.body, 'tz')}); P.drop = ${val(T.body, 'drop')}; P.bodyX = ${val(T.body, 'bx')}; P.pRoll = ${val(T.body, 'pr')};
  ${T.feet ? `cFoot(P, 0, ${val(T.feet, 'zL')}, ${val(T.feet, 'lL')}, ${val(T.feet, 'fL')}); cFoot(P, 1, ${val(T.feet, 'zR')}, ${val(T.feet, 'lR')}, ${val(T.feet, 'fR')});` : ''}
  ${T.root ? `cRot.xy = vec2(${val(T.root, 'rx')}, ${val(T.root, 'ry')}); cPiv = vec3(${val(T.root, 'cx')}, ${val(T.root, 'cy')}, ${val(T.root, 'cz')}); cMov = vec3(${val(T.root, 'mx')}, 0., ${val(T.root, 'mz')});` : ''}
  P.head = vec3(${val(T.head, 'hx')} - P.torso.x, ${val(T.head, 'hy')} - P.torso.y - cRot.y, ${val(T.head, 'hz')});
  ${T.extra || ''}
  ${T.crate ? `// the crate: its pivot and its turn (grab-props.js crateMatrix: the same pose)
  vec3 crP = vec3(${val(T.crate, 'x')}, ${val(T.crate, 'y')}, ${val(T.crate, 'z')}); mat3 crM = aRY(${val(T.crate, 'yaw')}) * aRX(${val(T.crate, 'pitch')}) * aRZ(${val(T.crate, 'roll')});` : ''}
  ${anyIK && body ? `// the walker's body frame → the chest's rest frame: the clip's root undone, then walk2.js's standing pelvis and the chest's turn
  mat3 hRq = transpose(aRY(cRot.y) * aRX(cRot.x)); float hL = (A_L1 + A_L2) * .998, hSr = sin(P.pRoll) * A_HIPX;
  float hHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(hL * hL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + hSr, P.ank.w + sqrt(max(hL * hL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - hSr));
  mat3 hMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));` : ''}
  ${T.arms.map((a, s) => [a.free ? `cArm(P, ${s}, vec4(${a.free.slice(0, 4).join(', ')}), ${a.free[4] ?? '0.'}, ${a.fk ?? '1.'});` : '',
    a.ik ? `vec3 gbT${s} = ${target(a)};\n  ${ik(s, chest(`gbT${s}`, a.ik.root), `vec3(${a.ik.pole.join(', ')})`, a.ik.k ?? '1.')}` : ''].join('\n  ')).join('\n  ')}`;
}
// the chest's rest frame → the walker's body frame (walk2.js), for crate_run's crate: work.js chestMatrix. g: the walker's gait state
// (gait2.js; the city has it in the gait hook): the walk's pelvis height and roll and the turn's lean. Without it (the lab's live
// preview, which passes only t) a steady walk at the clip's speed is assumed: the pelvis at its mean height, no roll.
let GAIT = null; const gaitOf = () => GAIT || (GAIT = buildGait(WALK2));
const pyMean = a => { const G = gaitOf(); let s = 0; for (let j = 0; j < 64; j++) s += table(G, G.pt, a, j / 64); return s / 64; };
export function chestMatrix(THREE, b, g, out = new THREE.Matrix4()) {
  const K = WALK2, w = g ? g.w : 1, a = g ? g.a : 1, u = g ? g.u : 0, st = Math.cos(2 * PI * (u - .27)), wa = w * a;
  const bx = b.bx, wRoll = g ? -K.roll * st * wa : 0, L = (R2.kneeY - R2.ankY + R2.hipY - R2.kneeY) * .998, sr = Math.sin(b.pr) * R2.hipX;
  const hs = Math.min(R2.hipY - b.drop, R2.ankY + Math.sqrt(Math.max(L * L - bx * bx, 0)) + sr, R2.ankY + Math.sqrt(Math.max(L * L - bx * bx, 0)) - sr);
  const hip = g ? hs + (g.py - b.drop - hs) * w : (b.pyMean ?? R2.hipY) - b.drop;
  const A = new THREE.Matrix4(), turnRoll = g ? Math.max(-.3, Math.min(.3, -.09 * (g.omega || 0) * (g.v || 0))) : 0;
  out.makeRotationZ(turnRoll).multiply(A.makeTranslation(bx, hip, R2.hipZ)).multiply(A.makeRotationZ(b.tz + .5 * b.pr + .4 * wRoll)).multiply(A.makeRotationX(b.tx)).multiply(A.makeRotationY(b.ty))
    .multiply(A.makeTranslation(0, -R2.hipY, -R2.hipZ));
  return out;
}
// ── THE BACK FOLLOWS THE HANDS: for a standing clip whose fists hold the crate, the legs and the crate are keyed and the chest's pitch
// (P.torso.x) is SOLVED so the hands' mean reach stays at r0 (mid-shell: the IK never clamps, so the fists stay on the handles), through
// the shader's own body → chest conversion (glslTrack's hRq, hHip, hMt). As in a real lift: the hips go where the legs put them and
// the back angle is what keeps the hands on the load. Solved once at load, sampled every `step` s, keyed linearly (cR).
const rX = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; };
const rY = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
const rZ = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };
const ankleOf = (z, fp, lift) => { const c = Math.cos(fp), s = Math.sin(fp), r = fp >= 0 ? [R2.heel, R2.ankY] : [-R2.toe, R2.ankY];
  return [(fp >= 0 ? z - R2.heel : z + R2.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift]; };
// a body-frame point → the chest's rest frame (a standing clip's track values v; tx overrides the chest's pitch)
export function toChest(p, v, tx = v.body.tx) {
  const b = v.body, F = v.feet, rt = v.root, aL = F ? ankleOf(F.zL, F.fL, F.lL) : [0, R2.ankY], aR = F ? ankleOf(F.zR, F.fR, F.lR) : [0, R2.ankY];
  const L = (R2.hipY - R2.ankY) * .998, sr = Math.sin(b.pr) * R2.hipX;
  const hip = Math.min(R2.hipY - b.drop, aL[1] + Math.sqrt(Math.max(L * L - aL[0] ** 2 - b.bx ** 2, 0)) + sr, aR[1] + Math.sqrt(Math.max(L * L - aR[0] ** 2 - b.bx ** 2, 0)) - sr);
  let q = rX(-rt.rx, rY(-rt.ry, [p[0] - rt.mx - rt.cx, p[1] - rt.cy, p[2] - rt.mz - rt.cz])); q = [q[0] + rt.cx, q[1] + rt.cy, q[2] + rt.cz];
  const c = rY(-b.ty, rX(-tx, rZ(-(b.tz + .5 * b.pr), [q[0] - b.bx, q[1] - hip, q[2] - R2.hipZ])));
  return [c[0], c[1] + R2.hipY, c[2] + R2.hipZ];
}
// the hands' reach (each arm with a target: the distance from its shoulder, chest frame)
export const reachOf = (v, frame, tx) => v.arms.map((a, s) => { if (!a.ik?.target) return null; const c = frame === 'chest' ? a.ik.target : toChest(a.ik.target, v, tx);
  return Math.hypot(c[0] - (s ? SH.x : -SH.x), c[1] - SH.y, c[2]); });
function solveTx(T, dur, from, to, step, r0, guess) {
  const tr = jsTrack(T, dur, false), out = [];
  for (let k = 0, n = Math.round((to - from) / step); k <= n; k++) { const t = from + k * step, v = tr(t), R = r0(t), g = guess(t);
    const F = x => { const r = reachOf(v, 'body', x).filter(e => e !== null); return r.reduce((a, e) => a + e, 0) / r.length - R; };
    let best = null;
    for (let x = -.6; x < 1.3; x += .01) { const a = F(x), b = F(x + .01); if ((a < 0) === (b < 0)) continue;
      let lo = x, hi = x + .01, flo = a; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, fm = F(m); if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
      const r = (lo + hi) / 2; if (best === null || Math.abs(r - g) < Math.abs(best - g)) best = r; }
    if (best === null) { best = g; for (let x = -.6; x < 1.3; x += .002) if (Math.abs(F(x)) < Math.abs(F(best))) best = x; }
    out.push([t, best, k ? 'cR' : 'cS']); }
  return out;
}
// a chest-frame point → the walker's body frame for a STANDING body (walk2.js's standing pelvis with both feet planted under the hips):
// where a standing clip's crate must be to meet crate_run's at its walk weight 0 (the chain lands there)
function chestToBody(p, b) {
  const L = (R2.hipY - R2.ankY) * .998, hip = Math.min(R2.hipY - b.drop, R2.ankY + Math.sqrt(Math.max(L * L - b.bx * b.bx, 0)));
  const c = Math.cos(b.tx), s = Math.sin(b.tx), y = p[1] - R2.hipY, z = p[2] - R2.hipZ;
  return [p[0] + b.bx, hip + c * y - s * z, R2.hipZ + s * y + c * z];
}
// and back
function bodyToChest(p, b) {
  const L = (R2.hipY - R2.ankY) * .998, hip = Math.min(R2.hipY - b.drop, R2.ankY + Math.sqrt(Math.max(L * L - b.bx * b.bx, 0)));
  const c = Math.cos(b.tx), s = Math.sin(b.tx), y = p[1] - hip, z = p[2] - R2.hipZ;
  return [p[0] - b.bx, R2.hipY + c * y + s * z, R2.hipZ - s * y + c * z];
}
// the clip's prop (CLIPS.md § Props): the crate and its pose at the clip clock t (a loop wraps it itself). matrix takes the walker's gait
// state g as a 4th argument (a chest-frame crate needs it; a body-frame one ignores it). pose(t, u, w) → grab-props.js's pose (in the
// track's frame); track(t, u, w) → every channel.
function propOf(T, dur, loop, speed = 0, shift = null) {
  const tr = jsTrack(T, dur, loop), chest = T.frame === 'chest', aRef = .4 + .6 * Math.min(1, speed / WALK2.vRef);
  let pym = null;
  // (past a one-shot's end the walker has moved by its shift and the shader takes it off the clip's root: the crate too)
  const past = (c, t) => !loop && shift && Math.fround(t) >= Math.fround(dur) ? { ...c, x: c.x - shift[0], z: c.z - shift[1] } : c;
  const pose = (t, u = 0, w = 0) => past(tr(t, u, w).crate, t);
  return { id: 'crate', model: 'crate', frame: chest ? 'chest' : 'body', geometry: (THREE, scheme) => crateGeometry(THREE, scheme), pose, track: tr,
    matrix(THREE, t, out = new THREE.Matrix4(), g = null) { const r = tr(t, g?.u ?? 0, g?.w ?? (chest ? 1 : 0));
      crateMatrix(THREE, past(r.crate, t), out); if (!chest) return out;
      if (!g && pym === null) pym = pyMean(Math.min(1, Math.max(LEVELS[0], aRef)));
      return out.premultiply(chestMatrix(THREE, { ...r.body, pyMean: pym }, g, new THREE.Matrix4())); } };
}
const clip = o => ({ name: o.name, dur: o.dur, loop: !!o.loop, hold: !!o.hold, next: o.next || null, blendIn: o.blendIn ?? .25, blendOut: o.blendOut ?? .3,
  moving: !!o.moving, speed: o.speed || 0, stride: o.stride ?? 1, shift: o.shift || null, pair: o.pair || null, note: o.note,
  ...(o.prop ? { prop: propOf(o.track, o.dur, !!o.loop, o.speed || 0, o.shift || null) } : {}), track: jsTrack(o.track, o.dur, !!o.loop), ...(o.more || {}), glsl: o.glsl ?? glslTrack(o.track) });
// a rhythm that divides D (n whole: seamless)
const sw = (n, D, ph = 0) => `sin(${f(2 * PI * n / D)} * t${ph ? ` + ${f(ph)}` : ''})`;
// one shared expression as a JS function of t (a solve's guess)
const expr = e => { const fn = new Function(...Object.keys(JS), 't', `return ${e};`), vals = Object.values(JS); return t => fn(...vals, t); };

// ═══ THE HOLD: the crate carried at the chest, the chest's rest frame (crate_run's at its walk weight 0, where every clip that ends
// holding the crate lands). The pivot (between the handles) at y 0.70, 0.415 m out: the fists 0.445 m from the shoulders (the reach is
// 0.403–0.453); the crate's back face 0.29 m out, its top at 0.80, its bottom at 0.40. Leaning back a hair against the weight (the chest
// −0.04), the chin up; the crate kept level (its own pitch takes the lean off).
const HOLD0 = { y: .70, z: .415, tx: -.04, hx: -.06 };
// the hold in a standing walker's body frame (no drop, the feet under the hips): where crate_lift, crate_tug and crate_ram end (before
// their shifts), on the 4-decimal grid their keys write; and back in the chest's frame from it, for crate_run (6 decimals), so the
// seams are exact
const HOLD_B = (() => { const p = chestToBody([0, HOLD0.y, HOLD0.z], { tx: HOLD0.tx, drop: 0, bx: 0 }); return { x: 0, y: +f(p[1]), z: +f(p[2]) }; })();
const HOLD = { ...HOLD0, ...(() => { const c = bodyToChest([0, HOLD_B.y, HOLD_B.z], { tx: HOLD0.tx, drop: 0, bx: 0 }); return { y: c[1], z: c[2] }; })() };
const f6 = v => (+v).toFixed(6);
// the reach the solved clips keep while the fists hold the crate (mid-shell), and the hold's own
const R_MID = .428, HOLD_R = Math.hypot(CRATE.grip[1][0] - SH.x, HOLD.y - SH.y, HOLD.z);
const HOLD_POLE = s => [s ? '1.' : '-1.', '-1.', '-.3'];

// ═══ CRATE_LIFT (3.2 s one-shot, shift [0, −0.12], → crate_run). THE SPOT: the crate stands on the ground square across the walker's
// path, its middle 0.48 m ahead (LIFT.z: its near face 0.355 m out, past the toes and the bent knees). Beats: the squat 0–0.55 s (the
// knees ~100°, the chest pitched ~0.65, the eyes on the crate), the fists reach down outside the knees and close on the rope handles by
// 0.5 · a settle ·
// THE FIRST HEAVE 0.75–1.2: the strain shakes him, the crate comes up 2 cm and thumps back · a breath 1.2–1.5, the head up and back
// down · THE HEAVE 1.5–2.15: the legs drive, the chest comes up, the crate rises to the belly, still shaking · THE HITCH 2.1–2.45: the
// knees dip and pop, the crate thrown up to the chest, the chest back under it, the chin up · the weight takes him back: a step back
// with the −x foot 2.45–2.65 and the +x foot 2.62–2.85, the crate swings and sags · settles into the hold by 3.2, 0.12 m back.
const LF_D = 3.2, LIFT = { z: .48, back: -.12 };
const lift = (() => { const G0 = CRATE.rest, L = LIFT;
  const vars = [['s1', 'cBump(t, .78, 1.12)'], ['s2', 'cBump(t, 1.5, 2.15)'], ['sk', `${sw(22, 1)}`],
    ['m', `${f(L.back)} * cS(t, 2.45, 2.85)`],
    // the crate: on the ground until the first heave; 2 cm up and back down (cIn: a thump); the heave to the belly; the hitch to the
    // hold; it sags and swings as he staggers, then settles into the hold (0.12 m back with him)
    ['cy', keys([[0, G0], [.8, G0], [.98, G0 + .022, 'cOut'], [1.12, G0, 'cIn'], [1.55, G0], [2.15, .5], [2.42, HOLD_B.y + .015, 'cOut'], [2.62, HOLD_B.y - .02], [2.9, HOLD_B.y + .006], [3.15, HOLD_B.y]])],
    ['cz', keys([[0, L.z], [1.55, L.z], [2.15, .44], [2.42, HOLD_B.z], [LF_D, HOLD_B.z]])],
    // its pitch about the handles: level on the ground; coming up, its bottom swings out off the thighs (− : the top in); it nods
    // forward as he catches it in the stagger, and settles level
    ['cp', keys([[0, 0], [1.55, 0], [1.9, -.08], [2.15, -.13], [2.42, -.05], [2.62, .07], [2.9, -.02], [3.15, 0]])],
    ['crl', `.035 * s2 * ${sw(3, 1)} * cS(t, 1.6, 1.7)`]];
  // the chest's pitch: keyed into the squat (TXA, also the solve's guess), then solved from the reach once the fists are on (0.42 s
  // on): the reach eases from mid-shell (0.428 m) to the hold's at the end, where the solve lands on the hold's own lean exactly
  const TXA = keys([[0, 0], [.55, .7], [.8, .7], [.98, .64], [1.15, .7], [1.32, .6], [1.5, .72], [2.15, .22], [2.45, -.1], [2.75, 0], [3.1, HOLD.tx]]);
  const T = { frame: 'body', vars,
    root: { mz: 'm' },
    feet: { zL: `(${f(L.back)} * cS(t, 2.45, 2.65) - m)`, lL: '(.05 * cBump(t, 2.45, 2.65))', fL: '0.',
      zR: `(${f(L.back)} * cS(t, 2.62, 2.85) - m)`, lR: '(.045 * cBump(t, 2.62, 2.85))', fR: '0.' },
    body: { tx: TXA, ty: '(.04 * cBump(t, 2.45, 2.85))', tz: '(.02 * sk * (s1 + .7 * s2) - .03 * cBump(t, 2.45, 2.85))',
      drop: keys([[0, 0], [.55, .145], [.62, .153], [.75, .145], [.98, .125], [1.15, .145], [1.32, .135], [1.5, .15], [2.12, .05], [2.24, .085], [2.42, 0], [2.65, .03], [2.95, 0]]), bx: '0.', pr: '0.' },
    head: { hx: keys([[0, 0], [.5, .24], [.8, .24], [.98, .06], [1.15, .22], [1.32, -.06], [1.5, .2], [2.15, 0], [2.42, -.14], [2.75, -.02], [3.1, HOLD.hx]]), hy: '(.12 * cBump(t, 2.5, 2.95))', hz: '(.04 * sk * s1)' },
    crate: { x: '0.', y: 'cy', z: '(cz + m)', pitch: 'cp', roll: 'crl' },
    // the fists: from the hanging hands (the IK takes them from 0.1 s, in front of the thighs), forward and down past the knees
    // (outside them), onto the handles by 0.5 s
    arms: [0, 1].map(s => { const sx = s ? 1 : -1, way = [sx * .4, .42, .34];
      return { ik: { at: [`mix(${f(sx * .36)}, ${f(way[0])}, cS(t, .04, .3))`, `mix(.41, ${f(way[1])}, cS(t, .04, .3))`, `mix(.08, ${f(way[2])}, cS(t, .04, .3))`], on: CRATE.grip[s], mk: 'cS(t, .2, .5)',
        pole: [`${f(sx)}`, 'mix(-.5, -1., cS(t, 2.1, 2.6))', 'mix(-.5, -.3, cS(t, 2.1, 2.6))'], k: 'cS(t, .1, .28)' } }; }) };
  const S = solveTx(T, LF_D, .4, LF_D, .04, t => R_MID + (HOLD_R - R_MID) * JS.cS(t, 2.6, 3.1), expr(TXA));
  S.at(-1)[1] = HOLD.tx;
  T.body.tx = `(mix(${TXA}, ${keys(S)}, cS(t, .42, .52)) + .012 * sk * (s1 + s2))`;
  return T; })();

// ═══ CRATE_RUN (MOVING loop, 3 s, at 2.0 m/s, stride ×1.25, the hips and knees ×1.12 / ×1.25: short, quick, heavy steps). The crate in
// the CHEST frame (the hold), the fists on its handles. Everything the walk adds is scaled by its weight w, so at w 0 it is the hold
// exactly (crate_lift's end). THE JOLT: every foot strike (u 0 and ½, gait2.js) drops the crate 3 cm a beat after the pelvis dips, the
// arms giving (it comes in 1 cm: the reach holds), its front nods and it swings back up with a small rebound; it rolls toward the
// stance foot and twists with the stride. The chest leans into the run, turns with the stride, rolls over each foot. A hitch 1.0–1.4
// s (bumped up 3.5 cm, re-gripped), a glance back over the +x shoulder 1.9–2.8 s (whoever is after it). Standing (w 0) it is the hold,
// still: the hitch and the glance ride the walk too, so a clip that starts from the hold (crate_ram) never pops.
const RN_D = 3, RN_V = 2;
const run = (() => {
  const vars = [['T2', '6.2831853'], ['st', 'cos(T2 * (u - .27))'], ['swg', 'cos(T2 * (u - .07))'], ['ph', 'mod(2. * u, 1.)'],
    ['jo', '(-sin(3.14159265 * clamp(ph / .45, 0., 1.)) + .3 * sin(3.14159265 * clamp((ph - .45) / .4, 0., 1.))) * w'],
    ['hi', 'cBump(t, 1.0, 1.4) * w'], ['gl', 'cS(t, 1.9, 2.15) * (1. - cS(t, 2.55, 2.8)) * w'], ['lean', `(${f(HOLD.tx)} + .15 * w)`]];
  return { frame: 'chest', vars,
    body: { tx: '(lean + .015 * jo)', ty: '(.05 * swg * w + .14 * gl)', tz: '(.03 * st * w)', drop: '(.035 * w - .012 * jo)', bx: '(-.012 * st * w)', pr: '0.' },
    head: { hx: `(${f(HOLD.hx)} - .05 * w - .025 * jo)`, hy: '(.95 * gl)', hz: '(-.03 * st * w)' },
    crate: { x: '(.01 * st * w)', y: `(${f6(HOLD.y)} + .03 * jo + .035 * hi)`, z: `(${f6(HOLD.z)} + .012 * jo - .008 * hi)`, yaw: '(.02 * swg * w)', pitch: '(-lean - .12 * w - .07 * jo)', roll: '(.03 * st * w)' },
    arms: [0, 1].map(s => ({ ik: { on: CRATE.grip[s], pole: HOLD_POLE(s) } })) }; })();

// ═══ THE RAM: crate_ram (the holder, the lead) ⇄ crate_rammed (the rival, its pair: 1.15 m ahead, facing, the same start). "Shoving a
// rival off the crate": the holder has it (from the hold: crate_lift's end, crate_run standing, crate_tug's end); the rival steps in and
// grabs its top front edge (his fists hooked over it, 0.28 s), they tussle (he pulls it his way, it wiggles), the holder RIPS it back
// with a twist (0.66–0.8: the rival's grip breaks, his hands fly out), winds up (leans back, the crate in tight and high) and RAMS: a
// lunge with the crate out at arm's length and up, its front edge driving in under the rival's chin at 1.25 s, the contact: the rival
// stands there in the plain stand (0.10 m in from where he started), so crate_rammed chains into falls.js's shove_fall (the knockdown)
// → lie_hurt; the holder follows through a step, gathers the crate back into the hold, 0.27 m on (shift) → crate_run.
// THE HEADS SET IT (heist.js's vault_shove): face to face the walkers need ≥ 0.8 m (both fronts at z 0.40), and the crate can't go
// further from the shoulders than the arms reach. So the holder rams UPRIGHT, the crate at arm's length (no lean: leaning swings the
// head forward faster than the crate), its front 0.16 m ahead of his own head's; at the contact it is ~7 cm past the rival's chin line
// with the heads still ≥ 7.5 cm apart (the real shader, the head boxes), and the rest of the lunge follows the rival's snap back.
const RM_D = 2.5, RD_D = 1.25, RAM = { gap: 1.15, lunge: .27, back: .1 }, STAND = [0, .04, 0, 0, 0];
// the crate's track, shared (crate_rammed reads it mirrored): the holder's root, and the crate off the hold in the root's frame
const RAM_CRATE = [
  // the holder's root: a hair back in the wind-up, the lunge 1.02–1.25 (0.155 at the contact), on through the rival's snap back to
  // 0.27 by 1.7
  ['rm', keys([[0, 0], [.8, 0], [1.02, -.03], [1.25, .155], [1.4, .22, 'cOut'], [1.7, RAM.lunge]])],
  // pulled 2.5 cm away by the rival's tug, ripped back in the yank, held in for the wind-up, thrust out to the arms' reach and up into
  // the ram, back to the hold; the tussle's wiggle and the yank's twist (yaw), a nod
  ['kz', keys([[0, 0], [.3, 0], [.5, .01], [.6, .005], [.72, -.05, 'cOut'], [1.0, -.045], [1.24, .03, 'cOut'], [1.55, 0]])],
  ['ky', keys([[0, 0], [.3, 0], [.5, -.015], [.72, .02], [1.0, .03], [1.24, .075, 'cOut'], [1.6, -.01], [2.0, 0]])],
  ['kyaw', '(.08 * sin(17. * t) * cBump(t, .32, .6) + .16 * cOut(t, .68, .8) * (1. - cS(t, .9, 1.1)))'],
  ['kpit', keys([[0, 0], [1.06, .04], [1.24, -.07], [1.6, .03], [2.0, 0]])]];
// (the twist turns the crate about the holder's own vertical axis, his chest with it: in the chest's frame the crate barely moves, so
// both fists stay in reach)
const RAM_POSE = { x: `(sin(kyaw) * (${f(HOLD_B.z - R2.hipZ)} + kz))`, y: `(${f(HOLD_B.y)} + ky)`, z: `(${f(R2.hipZ)} + cos(kyaw) * (${f(HOLD_B.z - R2.hipZ)} + kz) + rm)`, yaw: 'kyaw', pitch: 'kpit', roll: '0.' };
const ram = (() => {
  const vars = [...RAM_CRATE, ['tk', 'cBump(t, .3, .9)']];
  const T = { frame: 'body', vars,
    root: { mz: 'rm' },
    // the −x foot steps 0.27 into the lunge (1.05–1.28), the +x foot's heel up behind it, then it follows (1.45–1.7)
    feet: { zL: `(${f(RAM.lunge)} * cS(t, 1.05, 1.28) - rm)`, lL: '(.07 * cBump(t, 1.05, 1.28))', fL: '0.',
      zR: `(${f(RAM.lunge)} * cS(t, 1.45, 1.7) - rm)`, lR: '(.05 * cBump(t, 1.45, 1.7))', fR: '(-.22 * cS(t, 1.1, 1.26) * (1. - cS(t, 1.42, 1.55)))' },
    // the chest turns with the crate's twist (so both fists stay in reach), shakes in the tussle
    body: { tx: f(HOLD.tx), ty: 'kyaw', tz: '(.025 * sin(17. * t) * tk)', drop: keys([[0, 0], [.35, 0], [.6, .03], [.8, .02], [1.02, .035], [1.24, .02], [1.6, .03], [2.0, 0]]), bx: '0.', pr: '0.' },
    // (chin up, glaring down his nose at the rival through the tussle: the head's front edge back off the rival's)
    head: { hx: keys([[0, HOLD.hx], [.3, -.14], [.62, -.14], [.86, -.04], [1.02, .04], [1.24, -.1], [1.7, -.03], [2.2, HOLD.hx]]), hy: '(.5 * kyaw)', hz: '0.' },
    crate: RAM_POSE,
    arms: [0, 1].map(s => ({ ik: { on: CRATE.grip[s], pole: HOLD_POLE(s) } })) };
  const S = solveTx(T, RM_D, 0, RM_D, .04, t => HOLD_R + (R_MID - HOLD_R) * JS.cS(t, .1, .4) * (1 - JS.cS(t, 1.9, 2.3)), () => HOLD.tx);
  S[0][1] = HOLD.tx; S.at(-1)[1] = HOLD.tx;
  T.body.tx = keys(S); return T; })();
const rammed = (() => {
  const vars = [...RAM_CRATE,
    // his root: steps in 0.22 for it, leans back pulling, yanked his way as it's ripped off him, stumbles back to 0.10: the plain stand
    // there (shift)
    ['pn', keys([[0, 0], [.28, .22], [.55, .19], [.68, .23], [.85, .14], [1.1, RAM.back]])],
    // his fists: up in front of the crate's face 0–0.16, down onto its edge 0.12–0.28, torn off 0.62–0.68 (they fly out to the sides,
    // and drop back to the stand 0.84–1.08)
    ['kwy', 'cS(t, .02, .16)'], ['kon', 'cS(t, .12, .28) * (1. - cS(t, .62, .68))'], ['kop', 'cS(t, .62, .76)']];
  // the IK holds both arms from 0.02 s (its target: the hanging hand → the crate's edge → out to the sides), handed back to the plain
  // stand's own arms 0.84–1.08
  const free = STAND.map(f);
  const TXP = keys([[0, 0], [.28, -.03], [.6, -.08], [.72, .1], [.9, .03], [1.15, 0]]);
  const T = { frame: 'body', mirror: RAM.gap, vars,
    root: { mz: 'pn' },
    feet: { zL: `(.24 * cS(t, .04, .24) - ${f(.24 - RAM.back)} * cS(t, .78, .96) - pn)`, lL: '(.05 * cBump(t, .04, .24) + .045 * cBump(t, .78, .96))', fL: '0.',
      zR: `(.2 * cS(t, .14, .3) - ${f(.2 - RAM.back)} * cS(t, .9, 1.08) - pn)`, lR: '(.04 * cBump(t, .14, .3) + .035 * cBump(t, .9, 1.08))', fR: '0.' },
    body: { tx: TXP, ty: '0.', tz: '0.', drop: keys([[0, 0], [.28, .03], [.6, .04], [.75, .02], [1.15, 0]]), bx: '0.', pr: '0.' },
    head: { hx: keys([[0, 0], [.28, -.12], [.6, -.12], [.75, -.08], [1.15, 0]]), hy: '0.', hz: '0.' },
    crate: RAM_POSE,
    // his fists hooked over the crate's top front edge (the edge toward him), either side of its middle; his −x fist on its +x half
    arms: [0, 1].map(s => { const sx = s ? 1 : -1;
      // (the path off the crate: the hanging hand, up in front of the crate's face to over its edge, after it's torn away out to the
      // sides at chest height, carried by his root; from there the plain stand's own arms take them, 0.84–1.08: they come down
      // outside the legs)
      return { free, ik: { on: [-sx * .14, CRATE.size[1] + .065, CRATE.size[2] / 2 - .015], at: [`mix(mix(${f(sx * .325)}, ${f(sx * .17)}, kwy), ${f(sx * .56)}, kop)`, 'mix(mix(.39, .87, kwy), .74, kop)', `mix(mix(0., ${f(RAM.gap - HOLD_B.z - CRATE.size[2] / 2 - .1)}, kwy), .15 + pn, kop)`], mk: 'kon',
        pole: [f(sx * .6), '-1.', '-.2'], k: 'cS(t, .02, .12) * (1. - cS(t, .84, 1.08))' } }; }) };
  const S = solveTx(T, RD_D, .24, .72, .04, () => R_MID, expr(TXP));
  T.body.tx = `mix(${TXP}, ${keys(S)}, kon)`; return T; })();

// ═══ THE TUG: crate_tug (the winner, the lead) ⇄ crate_tug_lose (the loser, its pair: 1.45 m ahead, facing, the same start). "A
// tug-of-war over it": both get to the crate at once, standing over it from either side (1.45 m apart, the crate 0.48 m from the
// lead). The lead squats and takes the handles (the loser hangs back: two bent-over heads would meet over it) and heaves it up to his
// belly; the loser steps in and hooks both fists over its far top edge as it comes up (1.55 s). Three surges: the loser yanks it his way (the lead lurches after it), the lead yanks it back
// (the loser stumbles in), the loser again; a deadlock, both leaning back, shaking. The lead twists it and rips it free (3.6 s): the
// loser's fists slip off the edge and he reels back three steps, arms windmilling, and catches himself, 0.53 m back from where he
// pulled (0.05 m behind where he started); the lead staggers back a step with it, up into the hold, 0.15 m back (shift) → crate_run.
const TG_D = 4.6, TL_D = 4.4, TUG = { gap: 1.45, at: .48, back: -.15, lose: -.05 };
// the crate's track, shared (crate_tug_lose reads it mirrored), in the lead's walker frame: the lead's root (tm), the crate's height
// (gy), its distance along the line from the lead's body axis (gz: the surges move it), its tip toward whoever pulls (gp: + its top
// toward the loser) and its yaw (gw: a wobble, the twist that rips it free; it turns about the lead's own vertical axis, his chest
// with it, as crate_ram's)
const TUG_CRATE = [
  // the crate's pivot height, and its distance along the line from the lead's start (gz, from his hip axis: the surges move it)
  ['gy', keys([[0, CRATE.rest], [.75, CRATE.rest], [1.3, .68], [3.5, .68], [3.75, .73, 'cOut'], [4.05, HOLD_B.y + .012], [4.35, HOLD_B.y]])],
  ['gz', `(${keys([[0, TUG.at - R2.hipZ], [.75, TUG.at - R2.hipZ], [1.3, .44], [1.6, .44], [2.0, .55], [2.5, .35], [3.0, .53], [3.5, .46], [3.75, HOLD_B.z - R2.hipZ + TUG.back + .06, 'cOut'], [4.05, HOLD_B.z - R2.hipZ + TUG.back]])} + .006 * sin(41. * t) * cBump(t, 3.0, 3.5))`],
  ['gp', keys([[0, 0], [.75, 0], [1.05, -.1], [1.4, -.06], [1.6, 0], [2.0, .13], [2.5, -.06], [3.0, .11], [3.5, .09], [3.75, -.1], [4.05, .04], [4.35, 0]])],
  ['gw', '(.06 * sin(9. * t) * cBump(t, 1.6, 3.5) + .3 * cOut(t, 3.55, 3.7) * (1. - cS(t, 3.8, 4.15)))'],
  // THE EFFORTS: each one's hips from the crate (the lead's from its pivot, the loser's from its far edge): shorter is leaning back
  // harder on it, longer is being dragged in; each one's root follows from the crate and that, so the bodies go where it goes
  ['dL', keys([[0, .4], [1.3, .4], [1.6, .37], [2.0, .43], [2.5, .335], [3.0, .42], [3.5, .35]])],
  ['dP', keys([[0, .42], [1.45, .42], [1.65, .38], [2.0, .32], [2.5, .44], [3.0, .33], [3.5, .345]])],
  // the lead's root: still for the lift, then at dL behind the crate; staggers back with it at the end (0.15 back)
  ['tm', `mix(mix(0., ${f(R2.hipZ)} + gz - dL, cS(t, 1.3, 1.6)), ${f(TUG.back)}, cS(t, 3.6, 3.95))`]];
// (the twist turns the crate about the lead's own vertical axis, through his hips, his chest with it)
const TUG_POSE = { x: '(sin(gw) * (gz - tm))', y: 'gy', z: `(${f(R2.hipZ)} + tm + cos(gw) * (gz - tm))`, yaw: 'gw', pitch: 'gp', roll: '0.' };
const tug = (() => {
  const vars = [...TUG_CRATE, ['dk', 'cBump(t, 3.0, 3.5)'], ['skk', 'sin(41. * t)']];
  const TXA = keys([[0, 0], [.55, .7], [.75, .7], [1.3, .2], [2.0, .05], [3.5, -.1], [3.8, -.1], [4.3, HOLD.tx]]);
  const T = { frame: 'body', vars,
    root: { mz: 'tm' },
    // the feet: under him for the lift; then the tug's stance, both planted forward (the −x 0.20, the +x 0.12: the toes under the crate)
    // with the hips sitting back behind them (1.3–1.6), so the chest leans back on the pull; the legs take the lurches; at the end both
    // under him, 0.15 back
    feet: { zL: `(${keys([[0, 0], [1.3, 0], [1.5, .2], [3.6, .2], [3.82, TUG.back]])} - tm)`, lL: '(.05 * cBump(t, 1.3, 1.5) + .05 * cBump(t, 3.6, 3.82))', fL: '0.',
      zR: `(${keys([[0, 0], [1.42, 0], [1.6, .12], [3.7, .12], [3.95, TUG.back]])} - tm)`, lR: '(.04 * cBump(t, 1.42, 1.6) + .04 * cBump(t, 3.7, 3.95))', fR: '0.' },
    body: { tx: TXA, ty: 'gw', tz: '(.02 * skk * dk)',
      drop: keys([[0, 0], [.5, .145], [.75, .145], [1.3, .06], [1.6, .09], [2.0, .07], [2.5, .1], [3.0, .08], [3.5, .1], [3.75, .04], [3.95, .06], [4.35, 0]]), bx: '0.', pr: '0.' },
    // (the head: chin back when he pulls, pitched forward when he's dragged in: at the city's distance the heads tell the tug)
    head: { hx: keys([[0, 0], [.5, .24], [.75, .24], [1.3, -.05], [1.6, -.14], [2.0, .02], [2.5, -.26], [3.0, .0], [3.5, -.2], [3.75, -.14], [4.3, HOLD.hx]]), hy: '(.6 * gw)', hz: '(.03 * skk * dk)' },
    crate: TUG_POSE,
    // the fists: down past the knees onto the handles by 0.5 s (crate_lift's path), and on them to the end
    arms: [0, 1].map(s => { const sx = s ? 1 : -1, way = [sx * .4, .42, .34];
      return { ik: { at: [`mix(${f(sx * .36)}, ${f(way[0])}, cS(t, .04, .3))`, `mix(.41, ${f(way[1])}, cS(t, .04, .3))`, `mix(.08, ${f(way[2])}, cS(t, .04, .3))`], on: CRATE.grip[s], mk: 'cS(t, .2, .5)',
        pole: [`${f(sx)}`, 'mix(-.5, -1., cS(t, 3.6, 4.1))', 'mix(-.5, -.3, cS(t, 3.6, 4.1))'], k: 'cS(t, .1, .28)' } }; }) };
  const S = solveTx(T, TG_D, .4, TG_D, .04, t => R_MID + (HOLD_R - R_MID) * JS.cS(t, 4.0, 4.5), expr(TXA));
  S.at(-1)[1] = HOLD.tx;
  T.body.tx = `(mix(${TXA}, ${keys(S)}, cS(t, .42, .52)) + .012 * skk * dk)`; return T; })();
const tugLose = (() => {
  const vars = [...TUG_CRATE,
    // his root: hangs back, steps in (~0.5) as the crate comes up, at dP behind its far edge (pulls back on his yanks, dragged in on the
    // lead's); when it rips free he reels back three steps past where he started (0.05 m) and catches himself
    ['pn', `mix(mix(0., ${f(TUG.gap - R2.hipZ - CRATE.size[2] / 2)} - gz - dP, cS(t, 1.05, 1.5)), ${keys([[3.6, .5], [3.9, .2, 'cOut'], [4.15, .03], [4.32, TUG.lose]])}, cS(t, 3.6, 3.68))`],
    // his fists: up in front of the crate's far face 1.1–1.35, down onto its top edge by 1.55, slipping off as it's twisted free 3.58–3.66
    ['kwy', 'cS(t, 1.1, 1.35)'], ['kon', 'cS(t, 1.35, 1.55) * (1. - cS(t, 3.58, 3.66))'], ['kop', 'cS(t, 3.58, 3.7)'], ['kfl', 'cS(t, 3.62, 3.75) * (1. - cS(t, 4.0, 4.3))'], ['dk', 'cBump(t, 3.0, 3.5)']];
  // waiting, the arms reach out for it ("hey!"); after the slip they windmill (flung up and back, round, out) and come down to the
  // stand by 4.3
  const REACH = [.9, .25, 0, 0, .35], FLUNG = [-.4, 1.35, 0, -.5, .5];
  const free = poseMix(STAND, [REACH, 'cS(t, .45, .8)'], [FLUNG, 'cS(t, 3.62, 3.78)'], [[.6, 1.1, 0, -.4, .4], 'cS(t, 3.85, 4.0)'], [STAND, 'cS(t, 4.05, 4.3)']);
  const TXP = keys([[0, 0], [.45, 0], [.8, .1], [1.05, .1], [1.4, .08], [1.6, -.15], [2.0, -.25], [2.5, -.05], [3.0, -.22], [3.5, -.24], [3.66, -.26], [3.9, -.12], [4.3, 0]]);
  const T = { frame: 'body', mirror: TUG.gap, vars,
    root: { mz: 'pn' },
    // three steps in to the tug's stance (1.05–1.55: both feet planted forward, the toes under the crate, the hips sitting back
    // behind them); the legs take the surges; three steps back as he reels
    feet: { zL: `(${keys([[0, 0], [1.05, 0], [1.22, .3], [1.36, .3], [1.55, .68], [3.6, .68], [3.78, .2], [4.0, .2], [4.2, TUG.lose]])} - pn)`, lL: '(.05 * cBump(t, 1.05, 1.22) + .05 * cBump(t, 1.36, 1.55) + .06 * cBump(t, 3.6, 3.78) + .05 * cBump(t, 4.0, 4.2))', fL: '0.',
      zR: `(${keys([[0, 0], [1.18, 0], [1.4, .58], [3.68, .58], [3.88, .02], [4.12, .02], [4.3, TUG.lose]])} - pn)`, lR: '(.05 * cBump(t, 1.18, 1.4) + .06 * cBump(t, 3.68, 3.88) + .04 * cBump(t, 4.12, 4.3))', fR: '0.' },
    body: { tx: TXP, ty: '(-.08 * kfl)', tz: '(.06 * sin(13. * t) * kfl)', drop: keys([[0, 0], [1.45, .05], [1.65, .09], [2.0, .1], [2.5, .07], [3.0, .1], [3.5, .1], [3.7, .04], [3.9, .05], [4.3, 0]]), bx: '0.', pr: '0.' },
    head: { hx: keys([[0, 0], [.6, .12], [1.1, .08], [1.5, -.08], [2.0, -.26], [2.5, .03], [3.0, -.24], [3.5, -.18], [3.7, -.24], [4.0, .05], [4.35, 0]]), hy: '(.25 * sin(11. * t) * kfl)', hz: '(.04 * sin(41. * t) * dk)' },
    crate: TUG_POSE,
    arms: [0, 1].map(s => { const sx = s ? 1 : -1;
      // (the IK takes the arms from his reach out for it, up in front of the crate's far face, down onto its edge; as it's torn away, out
      // to the sides and back, where the windmill takes them)
      return { free, ik: { on: [-sx * .15, CRATE.size[1] + .065, CRATE.size[2] / 2 - .015], at: [`mix(mix(${f(sx * .3)}, ${f(sx * .18)}, kwy), ${f(sx * .52)}, kop)`, 'mix(mix(.55, .8, kwy), .85, kop)', `(mix(mix(.32, .3, kwy), .08, kop) + pn)`], mk: 'kon',
        pole: [f(sx * .6), '-1.', '-.2'], k: 'cS(t, 1.0, 1.1) * (1. - cS(t, 3.68, 3.8))' } }; }) };
  const S = solveTx(T, TL_D, 1.5, 3.6, .04, () => R_MID, expr(TXP));
  T.body.tx = `(mix(${TXP}, ${keys(S)}, kon) + .012 * sin(41. * t) * dk)`; return T; })();

export const CLIPS = [
  clip({ name: 'crate_lift', dur: LF_D, next: 'crate_run', blendIn: .25, blendOut: .3, shift: [0, LIFT.back], prop: true, track: lift,
    more: { spot: { crate: [0, LIFT.z], yaw: 0 } },
    note: 'a one-shot (prop: crate; it stands on the ground across his path, its middle 0.48 m ahead): squats, the fists close on the rope handles by 0.5 s · the first heave 0.75–1.2 won\'t budge it (2 cm, a thump) · a breath · THE HEAVE 1.5–2.15 from the legs, to the belly · the hitch 2.1–2.45 up to the chest · staggers back a step 2.45–2.85 · settles into the hold by 3.2, 0.12 m back (shift) → crate_run' }),
  clip({ name: 'crate_run', dur: RN_D, loop: true, moving: true, speed: RN_V, stride: 1.25, blendIn: .3, blendOut: .3, prop: true, track: run,
    glsl: `  cLegK = vec2(1.12, 1.25);\n${glslTrack(run)}`,
    note: 'a MOVING loop at 2.0 m/s (stride ×1.25, the hips and knees ×1.12 / ×1.25; prop: crate, in the chest frame: pass the gait state to prop.matrix): the crate hugged at the chest, short quick heavy steps leaning into it · a jolt on every step (the crate drops and nods, the arms give) · a hitch 1.0–1.4 s · a glance back over the +x shoulder 1.9–2.8 · at walk weight 0 it is the standing hold, still (crate_lift\'s end; crate_ram\'s start)' }),
  clip({ name: 'crate_tug', dur: TG_D, next: 'crate_run', blendIn: .25, blendOut: .3, shift: [0, TUG.back], prop: true, track: tug, pair: { with: 'crate_tug_lose', gap: TUG.gap, delay: 0 },
    more: { spot: { crate: [0, TUG.at], yaw: 0 } },
    note: 'the winner (pair: crate_tug_lose 1.45 m ahead, facing, the same start; prop: crate, on the ground 0.48 m ahead, between them): squats and takes the handles by 0.5 s · heaves it to the belly 0.75–1.3 as the loser hooks the far edge · the tug: the loser yanks it his way 1.6–2.0, the winner yanks it back 2.0–2.5, the loser again 2.5–3.0 · a deadlock, both straining 3.0–3.5 · twists it and rips it free 3.55–3.75 · staggers back a step with it into the hold, 0.15 m back (shift) → crate_run' }),
  clip({ name: 'crate_tug_lose', dur: TL_D, blendIn: .25, blendOut: .3, shift: [0, TUG.lose], track: tugLose,
    note: 'the loser (crate_tug\'s partner): hangs back while the winner bends over it · steps in ~0.5 m (three steps) 1.05–1.55 and hooks both fists over its far top edge as it comes up · the tug, leaning back: yanks 1.6–2.0, stumbles in 2.0–2.5, yanks 2.5–3.0, the deadlock · his fists slip off as it is twisted free 3.58–3.66 · reels back three steps, arms windmilling, catches himself: the plain stand at 4.4, 0.05 m behind where he started (shift)' }),
  clip({ name: 'crate_ram', dur: RM_D, next: 'crate_run', blendIn: .15, blendOut: .3, shift: [0, RAM.lunge], prop: true, track: ram, pair: { with: 'crate_rammed', gap: RAM.gap, delay: 0 },
    note: 'the holder (from the hold; pair: crate_rammed 1.15 m ahead, facing, the same start; prop: crate): the rival hooks its top front edge by 0.28 s · the tussle 0.3–0.62 (it wiggles) · RIPS it back with a twist 0.66–0.8 · winds up 0.8–1.02 (leans back, the crate in tight and high) · THE RAM 1.02–1.25: a lunge with the crate at arm\'s length, in under the rival\'s chin at 1.25 (the rival → shove_fall) · follows through a step, gathers it into the hold, 0.27 m on (shift) → crate_run' }),
  clip({ name: 'crate_rammed', dur: RD_D, next: 'shove_fall', blendIn: .15, blendOut: .3, shift: [0, RAM.back], track: rammed,
    note: 'the rival (crate_ram\'s partner): steps in 0.22 m and hooks both fists over the crate\'s top front edge 0–0.28 s · pulls, leaning back 0.3–0.62 · it is torn out of his fists 0.62–0.68, his hands fly out to the sides, drop back by 1.08 · stumbles back: the plain stand at 1.25 = the ram, 0.10 m on (shift); chains to shove_fall → lie_hurt' }),
];
