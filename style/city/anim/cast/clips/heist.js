// CLIPS · heist (events): the vault heist at Precinct 9: working the vault door, the loot carried out, the guards' fight (GAME.md §20; 2026-10-15). One owner; CLIPS.md has the entry format.
// (the heist agent, 2026-10-15; heist.md has the staging the city needs: the vault door, the spots, the timing, the partners)
//   vault_drill    4 s loop · braced at the vault door with a big drill (prop: drill), the bit in the door at the belly: the drill
//                  shudders, two hard pushes, he backs the bit out and peers at the hole, runs it back in, a glance over the shoulder
//   vault_heave    4.6 s one-shot · both hands on the door's wheel: steps up and tips back on his heels, two heaves, the door gives
//                  (door.open(t)) and he walks it open, lets go, staggers back out of its swing, a fist pump; ends in the stand 0.9 m
//                  back (shift)
//   loot_carry     MOVING loop at 1.5 m/s · a fat loot sack slung over the +x shoulder (prop: sack), the fist up by the head on its neck,
//                  hustling: short heavy steps, leaning into it, the free arm pumping, a hitch of the sack, a heavy dip
//   vault_shove    2.7 s one-shot (pair → guard_bowled) · the jobber: a juke, steps in, the clinch, rips the guard's arms down and
//                  shoves him over with both hands; follows through a step, shakes it off; ends 0.3 m on (shift)
//   guard_bowled   1.75 s one-shot · the guard: stamps into a wide block (arms spread, palms out), catches the jobber in the clinch,
//                  holds, gets his arms ripped down; ends in the plain stand at the shove → shove_fall (falls.js) → lie_hurt
//   lookout_wave   3.2 s loop · the lookout on the balls of his feet: scans the street both ways, then looks back at the crew and
//                  waves them on with two big sweeps of the +x arm, from out wide round to forward ("come on, this way!")
// THE METHOD (work.js's, CLIPS.md § Props): every clip is ONE TRACK of scalar expressions valid in both GLSL and JS (the body, the feet,
// the root, the eyes, each hand's target or free angles, each prop's pose). The GLSL poses the body from it and puts each hand ON its
// target with a two-bone IK on the elbow (the reach sets the elbow, the shoulder turns the bent arm so its grip point lands on the
// target, the elbow toward a pole); the CPU evaluates the same strings for the props, the door and the sparks, so a fist and its
// prop cannot part. THE TOON ARM reaches only 0.403–0.453 m from the shoulder with the elbow ≤ 83° (under the thick sleeve's soft
// cap); the big head owns everything above y 0.95 inside x ±0.4 (the ears to ±0.5 from y 1.15) and z −0.35…0.40, so a door, a wheel
// or a drill is worked BELOW the chin, in the band 0.35–0.45 m in front of the shoulders.
// Arms are [pitch fwd, roll out, yaw in, twist in] (rad) + the elbow; torso / head: x = pitch forward (head: look down), y = yaw (+: the
// front turns to +x), z = roll (+: the top toward −x). Feet: cFoot (the body-frame z of the foot's ground point; a planted foot under a
// moving root sits at its spot − the root).
import { HEIST, heistGeometry, heistMatrix, heistPoint, heistDir } from './heist-props.js';
import { WALK2, R2, buildGait, table, LEVELS } from '../gait2.js';

const f = v => (+v).toFixed(4), PI = Math.PI;
// ── the rig (walk2.js; chars.js voxels × 0.05): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre)
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
const EMAX = 1.45, RMIN = Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), RMAX = Math.sqrt(RA + RB);
export const REACH = { min: RMIN, max: RMAX };

// ── the shared expressions' JS side: clips/index.js CLIP_HELPERS and GLSL's built-ins
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, sign: Math.sign,
    smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; the ease of the segment that ENDS at the key: cS, cIn,
// cOut, cR, cBack). work.js keys(), with the same output.
export function keys(K, T = 't') { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; }

// ── THE TRACK: { vars: [[name, expr], …] (scalars, in order), body: { tx, ty, tz, drop, bx, pr } (absolute), feet: { zL, lL, fL, zR,
// lR, fR } (cFoot; a moving clip leaves them out: the walk's legs), root: { rx, ry, cx, cy, cz, mx, mz } (the whole body's pitch and
// yaw about (cx, cy, cz) and its move: cRot.xy, cPiv, cMov; clips/index.js clipRoot), head: { hx, hy, hz } (where the eyes look: body-frame pitch, yaw, roll; P.head = this − the chest −
// the root), arms: [−x, +x], each { free: [pitch, roll, yaw, twist, elbow] (cArm's angles), fk (its weight, default 1), ik: { x, y, z,
// pole: [x, y, z], k } (the grip point's target and where the elbow points; k blends the IK in over the free pose) }, frame: 'body'
// (targets and props in the walker's body frame, a standing clip: the GLSL takes them into the chest's rest frame through the clip's
// root and walk2.js's standing pelvis) or 'chest' (in the chest's rest frame: a moving clip), props: { <name>: { model, x, y, z, yaw,
// pitch, roll, show } } (heist-props.js heistMatrix's pose, in the same frame), extra: GLSL lines after the body (before the arms) }
const BODY = ['tx', 'ty', 'tz', 'drop', 'bx', 'pr'], FEET = ['zL', 'lL', 'fL', 'zR', 'lR', 'fR'], ROOT = ['rx', 'ry', 'cx', 'cy', 'cz', 'mx', 'mz'], HEAD = ['hx', 'hy', 'hz'], PROP = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'show'];
const D0 = { tz: '0.', bx: '0.', pr: '0.', hz: '0.', rx: '0.', ry: '0.', cx: '0.', cy: '0.', cz: '0.', mx: '0.', mz: '0.', yaw: '0.', pitch: '0.', roll: '0.', show: '1.' };
const val = (o, k) => o?.[k] ?? D0[k] ?? '0.';
const grp = (o, ks) => `{ ${ks.map(k => `${k}: ${val(o, k)}`).join(', ')} }`;
// the JS side: (t, u, w) → every channel's value, and the vars (a loop wraps t itself)
function jsTrack(T, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]);
  const arm = a => `{ free: [${(a.free || ['0.', '.04', '0.', '0.', '0.']).join(', ')}], fk: ${a.free ? a.fk ?? '1.' : '0.'}, ik: ${a.ik ? `{ x: ${a.ik.x}, y: ${a.ik.y}, z: ${a.ik.z}, k: ${a.ik.k ?? '1.'}${a.ik.root ? `, root: { x: ${a.ik.root.x}, y: ${a.ik.root.y}, z: ${a.ik.root.z}, k: ${a.ik.root.k} }` : ''} }` : 'null'} }`;
  const src = `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { body: ${grp(T.body, BODY)}, feet: ${T.feet ? grp(T.feet, FEET) : 'null'}, root: ${grp(T.root, ROOT)}, head: ${grp(T.head, HEAD)},
    arms: [${T.arms.map(arm).join(', ')}], props: { ${Object.entries(T.props || {}).map(([n, p]) => `${n}: ${grp(p, PROP)}`).join(', ')} }, vars: { ${(T.vars || []).map(([k]) => k).join(', ')} } };`;
  const fn = new Function(...ks, 't', 'D', 'u', 'w', src);
  return (t, u = 0, w = 0) => fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur, u, w);
}
// arm poses as key poses blended in order: [P0, [P1, k1], [P2, k2], …] → five scalar expressions (pitch, roll, yaw, twist, elbow),
// each mix(mix(P0, P1, k1), P2, k2)… (valid GLSL and JS); a pose's entries may be expressions
const poseMix = (P0, ...rest) => [0, 1, 2, 3, 4].map(i => rest.reduce((e, [Q, k]) => `mix(${e}, ${typeof Q[i] === 'number' ? f(Q[i]) : Q[i]}, ${k})`, typeof P0[i] === 'number' ? f(P0[i]) : P0[i]));
// THE HAND IK (work.js / talk-patrol.js, GLSL): side 0 (−x) / 1 (+x); T = the grip point's target, H = where the elbow points (both in the
// chest's rest frame); k = its weight over the arm as it is
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
  const body = T.frame !== 'chest', anyIK = T.arms.some(a => a.ik);
  // a body-frame target is in the walker's frame: the clip's root is undone first; ik.root = { x, y, z, k } blends in a target given in the
  // root's own frame (it moves with the body: a hand that has let go of the door)
  const chest = (p, r) => body ? `(vec3(0., A_HIPY, A_HIPZ) + hMt * (mix(cPiv + hRq * (${p} - cPiv - cMov), vec3(${r ? `${r.x}, ${r.y}, ${r.z}` : '0.'}), ${r ? r.k : '0.'}) - vec3(P.bodyX, hHip, A_HIPZ)))` : p;
  return /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${val(T.body, 'tx')}, ${val(T.body, 'ty')}, ${val(T.body, 'tz')}); P.drop = ${val(T.body, 'drop')}; P.bodyX = ${val(T.body, 'bx')}; P.pRoll = ${val(T.body, 'pr')};
  ${T.feet ? `cFoot(P, 0, ${val(T.feet, 'zL')}, ${val(T.feet, 'lL')}, ${val(T.feet, 'fL')}); cFoot(P, 1, ${val(T.feet, 'zR')}, ${val(T.feet, 'lR')}, ${val(T.feet, 'fR')});` : ''}
  ${T.root ? `cRot.xy = vec2(${val(T.root, 'rx')}, ${val(T.root, 'ry')}); cPiv = vec3(${val(T.root, 'cx')}, ${val(T.root, 'cy')}, ${val(T.root, 'cz')}); cMov = vec3(${val(T.root, 'mx')}, 0., ${val(T.root, 'mz')});` : ''}
  P.head = vec3(${val(T.head, 'hx')} - P.torso.x, ${val(T.head, 'hy')} - P.torso.y - cRot.y, ${val(T.head, 'hz')});
  ${T.extra || ''}
  ${anyIK && body ? `// the walker's body frame → the chest's rest frame: the clip's root undone, then walk2.js's standing pelvis and the chest's turn
  mat3 hRq = transpose(aRY(cRot.y) * aRX(cRot.x)); float hL = (A_L1 + A_L2) * .998, hSr = sin(P.pRoll) * A_HIPX;
  float hHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(hL * hL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + hSr, P.ank.w + sqrt(max(hL * hL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - hSr));
  mat3 hMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));` : ''}
  ${T.arms.map((a, s) => [a.free ? `cArm(P, ${s}, vec4(${a.free.slice(0, 4).join(', ')}), ${a.free[4] ?? '0.'}, ${a.fk ?? '1.'});` : '',
    a.ik ? ik(s, chest(`vec3(${a.ik.x}, ${a.ik.y}, ${a.ik.z})`, a.ik.root), `vec3(${a.ik.pole.join(', ')})`, a.ik.k ?? '1.') : ''].join('\n  ')).join('\n  ')}`;
}
// the chest's rest frame → the walker's body frame (walk2.js), for a chest-frame prop (loot_carry's sack): work.js chestMatrix. g: the
// walker's gait state (gait2.js; the city has it in the gait hook): the walk's pelvis height and roll and the turn's lean. Without it
// (the lab's live preview, which passes only t) a steady walk at the clip's speed is assumed: the pelvis at its mean height, no roll.
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
// a clip's prop (CLIPS.md § Props): the model and its pose at the clip clock t (a loop wraps it itself). matrix takes the walker's gait
// state g as a 4th argument (a chest-frame prop needs it; a body-frame one ignores it). pose(t, u, w) → heist-props.js's pose (in the
// track's frame); track(t, u, w) → every channel.
function propOf(name, T, dur, loop, speed = 0) {
  const tr = jsTrack(T, dur, loop), chest = T.frame === 'chest', model = T.props[name].model, aRef = .4 + .6 * Math.min(1, speed / WALK2.vRef);
  let pym = null;
  const pose = (t, u = 0, w = 0) => tr(t, u, w).props[name];
  return { id: model, model, frame: chest ? 'chest' : 'body', geometry: (THREE, scheme) => heistGeometry(THREE, model, scheme), pose, track: tr,
    matrix(THREE, t, out = new THREE.Matrix4(), g = null) { const r = tr(t, g?.u ?? 0, g?.w ?? (chest ? 1 : 0));
      heistMatrix(THREE, r.props[name], out); if (!chest) return out;
      if (!g && pym === null) pym = pyMean(Math.min(1, Math.max(LEVELS[0], aRef)));
      return out.premultiply(chestMatrix(THREE, { ...r.body, pyMean: pym }, g, new THREE.Matrix4())); } };
}
const clip = o => ({ name: o.name, dur: o.dur, loop: !!o.loop, hold: !!o.hold, next: o.next || null, blendIn: o.blendIn ?? .25, blendOut: o.blendOut ?? .3,
  moving: !!o.moving, speed: o.speed || 0, stride: o.stride ?? 1, shift: o.shift || null, pair: o.pair || null, note: o.note,
  ...(o.prop ? { prop: propOf(o.prop, o.track, o.dur, !!o.loop, o.speed || 0) } : {}), track: jsTrack(o.track, o.dur, !!o.loop), ...(o.more || {}), glsl: o.glsl ?? glslTrack(o.track) });
// a rhythm that divides D (n whole: seamless)
const sw = (n, D, ph = 0) => `sin(${f(2 * PI * n / D)} * t${ph ? ` + ${f(ph)}` : ''})`;

// ═══ VAULT_DRILL (4 s loop). THE SPOT: square to the door, its face 1.01 m ahead (DRILL.face), the bit going in at body x 0.12, y 0.7
// (DRILL.at): the city places the door there (heist.md). The drill is level, the bit along +z, its pistol grip in the +x fist and its
// side handle in the −x fist (both by the IK; the drill's own frame is heist-props.js's), held at the belly: both fists fit the reach
// shell only there, below the chin, 0.3–0.35 m ahead. Beats: drilling 0–1.9 s (the drill shudders and the body with it; two hard
// pushes 0.35–0.85 and 1.15–1.6, the chest leaning in, the back heel up) · backs the bit out 1.5 cm 1.9–2.25, the nose up, the head tilts
// in to look at the hole · runs it back in 2.55–2.9 · drilling, a glance over the +x shoulder 3.0–3.75. sparks(t): the bit's tip (body
// frame), the spray's direction and whether the bit is in (on, 0 or 1).
const DR_D = 4, DRILL = { face: 1.01, at: [.12, .7] };
const drill = (() => { const D = DR_D, tip = HEIST.drill.tip, side = HEIST.drill.side;
  const vars = [['on', '(1. - cS(t, 1.86, 1.94) * (1. - cS(t, 2.86, 2.94)))'], ['vb', `(${sw(44, D)} + .6 * ${sw(31, D, 1.3)}) * on`], ['ps', '(cBump(t, .35, .85) + .8 * cBump(t, 1.15, 1.6))'],
    ['bk', 'cS(t, 1.9, 2.25) * (1. - cS(t, 2.55, 2.9))'], ['gl', 'cS(t, 3.0, 3.3) * (1. - cS(t, 3.45, 3.75))'], ['br', sw(1, D)],
    ['gz', `(${f(DRILL.face - tip[2])} + .01 * ps - .015 * bk + .003 * vb)`], ['gy', `(${f(DRILL.at[1] - tip[1])} + .004 * vb + .01 * bk)`], ['pt', '(-.04 * bk)']];
  return { frame: 'body', vars,
    body: { tx: '(.1 + .04 * ps - .03 * bk + .01 * br + .006 * vb)', ty: '(.04 + .06 * gl)', tz: '(.012 * vb)', drop: '(.06 + .02 * ps - .01 * bk)', bx: '-.01', pr: '-.03' },
    feet: { zL: '.14', lL: '0.', fL: '0.', zR: '-.14', lR: '0.', fR: '(-.1 * ps)' },
    head: { hx: '(.06 - .03 * bk - .06 * gl)', hy: '(.04 + .15 * bk + 1.05 * gl)', hz: '(-.08 * bk + .01 * vb)' },
    // the −x fist on the side handle: the drill's point (side) turned by its pitch (about x: y' = y cos − z sin, z' = y sin + z cos)
    arms: [{ ik: { x: f(DRILL.at[0] + side[0]), y: `(gy + ${f(side[1])} * cos(pt) - ${f(side[2])} * sin(pt))`, z: `(gz + ${f(side[1])} * sin(pt) + ${f(side[2])} * cos(pt))`, pole: ['-1.', '-.8', '-.2'] } },
      { ik: { x: f(DRILL.at[0]), y: 'gy', z: 'gz', pole: ['1.', '-1.', '-.3'] } }],
    props: { drill: { model: 'drill', x: f(DRILL.at[0]), y: 'gy', z: 'gz', pitch: 'pt' } } }; })();

// ═══ VAULT_HEAVE (4.6 s one-shot, shift [0, −0.9]). THE SPOT: square to the door's wheel, the door's face 0.52 m ahead (HEAVE.face),
// the wheel's grips (on its rim, either side of the hub) at body (±0.2, 0.70, 0.40), the hinge on the −x side 0.95 m out, on the face's
// plane (HEAVE.hinge). door.open(t) (rad) turns the door about the hinge's vertical axis, the free side toward the walker; the hands ride
// the wheel with it. THE LEAN: the whole body tips back about the heels (the root's pitch, as falls.js sits), the toes up, the heels dug
// in: the big head tipping back is what reads at the city's distance. The toon arm is 0.45 m long, so the feet step up to the door's foot
// (the toes 3 cm off its face) to keep the wheel in reach while leaning 16°. A swinging door sweeps everything within its width of the
// hinge, and the rig's feet can't step sideways, so the walker can't walk round with it: he walks it 0.3 rad open, lets go, and staggers
// back out of its sweep while it swings on to 0.55 rad on its own, slower than he retreats (the clearance is checked against a 1.56 m
// round door 0.25 m thick: its far edge sweeps 1.7 m from the hinge, so swing it wider only once he has walked off: heist.md).
// Beats: the hands go to the wheel 0–0.4 s · the brace: steps up to the door, tips back 0.35–0.8 · HEAVE 0.8–1.3 (shaking), a breath,
// HEAVE 1.35–1.8 · the door gives at 1.75 and he walks it 0.3 rad open by 2.4, the chin up (the head's front edge clear of the wheel's
// rim) · lets go 2.4–2.55 (the arms flung out), staggers back three steps to 3.3 while the door swings on (0.55 rad by 3.7) · watches
// it, a fist pump 3.45–4.0 · the stand by 4.6, 0.9 m back (shift).
const HV_D = 4.6, HEAVE = { face: .52, wheel: [0, .7, .4], half: .2, hinge: [-.95, .52], give: 1.75, rel: 2.4, openRel: .3, openEnd: .55, back: -.9, up: .22 };
const heave = (() => { const H = HEAVE;
  const vars = [['th', `(${f(H.openRel)} * (.3 * cIn(t, ${f(H.give)}, ${f(H.give + .3)}) + .7 * cS(t, ${f(H.give + .2)}, ${f(H.rel)})) + ${f(H.openEnd - H.openRel)} * cS(t, 2.6, 3.7))`],
    ['h1', 'cBump(t, .8, 1.3)'], ['h2', 'cBump(t, 1.35, 1.8)'], ['hv', '(h1 + h2) * (1. - cS(t, 1.75, 2.0))'], ['sk', `${sw(23, 1)} * hv`],
    ['wb', 'cS(t, 1.8, 2.2) * (1. - cS(t, 2.4, 2.8))'], ['rl', 'cS(t, 2.4, 2.55)'], ['ft', 'cS(t, 3.35, 3.6) * (1. - cS(t, 3.95, 4.25))'], ['dn', 'cS(t, 4.05, 4.55)'],
    ['cth', 'cos(th)'], ['sth', 'sin(th)'],
    // THE LEAN: the root tips back about the heels (rx) while he heaves, handing over to the chest's lean (lb) as he walks the door back
    ['rx', '(-(.18 * cS(t, .3, .8) + .07 * h1 + .1 * h2) * (1. - cS(t, 1.8, 2.2)))'], ['lb', '(-.04 * hv - .12 * wb)'], ['psi', '(.6 * min(th, .3) * (1. - cS(t, 2.5, 3.3)))'],
    // THE ROOT keeps the shoulders ~0.42 behind the wheel's grips: m = (the grips' mean z, gm) − 0.42 + the leans' pull-back (0.8 per rad
    // of the root's pitch, 0.33 per rad of the chest's), so stepping up, leaning, coming upright and the door's swing all keep the wheel
    // in reach; after the release he staggers back to H.back, out of the door's sweep
    ['gm', `(${f(H.hinge[1])} - ${f(H.wheel[0] - H.hinge[0])} * sin(min(th, .3)) + ${f(H.wheel[2] - H.hinge[1])} * cos(min(th, .3)))`],
    ['m', `mix(mix(0., gm - .42 - .8 * rx - .33 * lb, cS(t, .3, .7)), ${keys([[2.4, -.26], [2.7, -.5], [3.0, -.74], [3.3, H.back]], 't')}, cS(t, 2.4, 2.6))`]];
  // the wheel's grips ride the door: each turns about the hinge (aRY(th): (x, z) → (x cos + z sin, −x sin + z cos)); before they reach
  // it the targets swing up from the hanging hands along the arm's reach (the hands forward, never across the chest)
  const gp = s => { const rx = H.wheel[0] + s * H.half - H.hinge[0], rz = H.wheel[2] - H.hinge[1];
    return { x: `(${f(H.hinge[0])} + ${f(rx)} * cth + ${f(rz)} * sth)`, z: `(${f(H.hinge[1])} - ${f(rx)} * sth + ${f(rz)} * cth)` }; };
  const reach = (s, g) => { const sx = s ? 1 : -1, way = [sx * .33, .5, .26], rest = [sx * .36, .42, .1], k1 = 'cS(t, 0., .22)', k2 = 'cS(t, .18, .4)';
    return { x: `mix(mix(${f(rest[0])}, ${f(way[0])}, ${k1}), ${g.x}, ${k2})`, y: `mix(mix(${f(rest[1])}, ${f(way[1])}, ${k1}), ${f(H.wheel[1])}, ${k2})`, z: `mix(mix(${f(rest[2])}, ${f(way[2])}, ${k1}), ${g.z}, ${k2})` }; };
  // after the release the targets ride the body (the root's frame): flung out as the door rips away, held out for balance through the
  // stagger, then the −x hand hangs and the +x fist pumps up beside the head (outside its lower corner) and comes down
  const free = s => { const sx = s ? 1 : -1, fl = [sx * .5, .7, .14], hang = [sx * .38, .43, .1], up = [.62, .98, -.04];
    const P3 = i => s ? `mix(mix(mix(${f(fl[i])}, ${f(hang[i])}, cS(t, 3.0, 3.3)), ${f(up[i])}${i === 1 ? ' - .06 * cBump(t, 3.62, 3.85)' : ''}, ft), ${f(hang[i])}, dn)` : `mix(${f(fl[i])}, ${f(hang[i])}, cS(t, 3.0, 3.4))`;
    return { x: P3(0), y: P3(1), z: P3(2), k: 'rl' }; };
  const pole = s => { const sx = s ? 1 : -1; return [`(${f(sx)} * mix(.2, .6, cS(t, .1, .35)) * (1. - rl) + ${f(sx)} * ${s ? 'mix(.5, 1., ft)' : '.5'} * rl)`, `mix(mix(0., -1., cS(t, .1, .35)), -.5, rl)`, `mix(mix(-1., -.2, cS(t, .1, .35)), -.3, rl)`]; };
  // the feet's ground spots (the walker frame): side by side at the door's foot for the lean (both heels on the pivot line), then back
  const zL = keys([[0, 0], [.35, 0], [.6, H.up], [2.0, H.up], [2.25, -.18], [2.45, -.18], [2.7, -.5], [2.95, -.5], [3.2, -.85], [3.3, -.85], [3.45, H.back]]),
    zR = keys([[0, 0], [.5, 0], [.75, H.up], [1.8, H.up], [2.05, 0], [2.2, 0], [2.45, -.32], [2.6, -.32], [2.85, -.66], [3.1, -.66], [3.35, H.back]]);
  vars.push(['fl', `(${zL} - m)`], ['fr', `(${zR} - m)`]);
  return { frame: 'body', vars,
    root: { rx: 'rx', ry: 'psi', cz: '(.5 * (fl + fr) - .175)', mz: 'm' },
    feet: { zL: 'fl', lL: '(.05 * cBump(t, .35, .6) + .06 * cBump(t, 2.0, 2.25) + .06 * cBump(t, 2.45, 2.7) + .05 * cBump(t, 2.95, 3.2) + .02 * cBump(t, 3.3, 3.45))', fL: '0.',
      zR: 'fr', lR: '(.05 * cBump(t, .5, .75) + .05 * cBump(t, 1.8, 2.05) + .05 * cBump(t, 2.2, 2.45) + .06 * cBump(t, 2.6, 2.85) + .03 * cBump(t, 3.1, 3.35))', fR: '0.' },
    body: { tx: '(lb - .06 * cBump(t, 2.45, 3.2) + .05 * ft * (1. - dn))', ty: '(-.05 * ft * (1. - dn))', tz: '(.03 * sk + .04 * sin(9. * (t - 2.5)) * cBump(t, 2.5, 3.3))',
      drop: '(.04 * cS(t, .3, .8) * (1. - cS(t, 1.8, 2.2)) + .02 * hv + .025 * cBump(t, 2.5, 3.4) - .015 * ft * (1. - dn))', bx: '0.', pr: '0.' },
    head: { hx: '(.05 * cS(t, 0., .35) * (1. - cS(t, 3.3, 3.8)) + .04 * hv - .14 * wb - .1 * cBump(t, 2.6, 3.6) - .1 * ft * (1. - dn))', hy: '(psi - .35 * cBump(t, 2.7, 3.7))', hz: '(.04 * sk)' },
    // (the arms: IK from the start to 4.2 s, then handed back to the stand's own arms: the end is the plain stand, 0.9 m back, exactly)
    arms: [0, 1].map(s => { const g = reach(s, gp(s ? 1 : -1)); return { ik: { ...g, pole: pole(s), k: 'cS(t, 0., .12) * (1. - cS(t, 4.2, 4.55))', root: free(s) } }; }) }; })();

// ═══ LOOT_CARRY (MOVING loop at 1.5 m/s, stride ×1.15, the knees ×1.18: short heavy steps). The sack (heist-props.js, authored in this
// pose) rides the CHEST frame: its neck in the +x fist beside the head's lower corner, the body of the sack hanging down behind the +x
// shoulder. The body leans into it (0.2) and a little away from the sack's side; a bouncing pelvis; the free (−x) arm pumps, the elbow
// bent; a hitch of the sack 0.5–0.95 s (bumped up, re-gripped); a heavy step 1.7–2.3, the head and shoulders dipping into it. THE HEAD
// DOESN'T TURN: the sack boxes it in (turned toward −x its back corner meets the fist on the neck: the mitten points at the head; toward
// +x it meets the sack). The walk's own arm swing, chest turn and hip sway are replaced by the track's (written from the walk's cycle
// u), so the CPU knows the chest exactly (work.js carry_box).
// THE SACK'S SECONDARY MOTION (the refine pass, 2026-10-16; it turns about the neck in the fist, so the fist and the sack never part):
// each step it lands a beat after the pelvis's low point (u 0.125 and 0.625, gait2.js): the fist gives 1.2 cm and the sack swings down,
// then floats back up as the body rises (sd, the settle: lowest at u + 0.08); side to side it hangs back against the sway and the chest's
// twist (roll, yaw: it stays put in the world while the body moves under it, a beat late); on the hitch it lags as the fist jerks it up,
// then swings up past rest and settles; the heavy step leaves it behind, then it lands hard
const LC_D = 3.2, LC_V = 1.5, SACK = { neck: [.59, .95, -.22] };
const carry = (() => {
  const vars = [['T2', '6.2831853'], ['st', 'cos(T2 * (u - .27))'], ['swg', 'cos(T2 * (u - .07))'], ['hi', 'cBump(t, .5, .95)'], ['lb', 'cBump(t, 1.7, 2.3)'],
    ['bo', '(.5 + .5 * cos(2. * T2 * (u - .1)))'], ['sd', '(.5 + .5 * cos(2. * T2 * (u - .205)))'], ['ny', `(${f(SACK.neck[1])} + .025 * hi - .012 * sd * w)`]];
  return { frame: 'chest', vars,
    body: { tx: '(.2 * w + .02 * hi + .05 * lb)', ty: '(.06 * swg * w)', tz: '(.05 * w + .02 * st * w)', drop: '(.025 * w + .022 * bo * w)', bx: '(-.012 * st * w)', pr: '0.' },
    head: { hx: '(-.02 + .07 * lb)', hy: '0.', hz: '(-.03 * st * w)' },
    arms: [{ free: ['(.1 - .45 * swg * w)', '(.32 + .05 * max(swg, 0.))', '0.', '-.3', '(.95 + .15 * max(-swg, 0.))'] },
      { ik: { x: f(SACK.neck[0]), y: 'ny', z: f(SACK.neck[2]), pole: ['1.', '-.6', '.3'] } }],
    // (pitch +: the sack up and back; roll +: its body out to +x; yaw +: its body in toward −x)
    props: { sack: { model: 'sack', x: f(SACK.neck[0]), y: 'ny', z: f(SACK.neck[2]),
      pitch: '(.16 * (.5 - sd) * w - .08 * cBump(t, .5, .8) + .06 * cBump(t, .75, 1.1) + .04 * cBump(t, 1.7, 1.95) - .08 * cBump(t, 1.9, 2.4))',
      roll: '(.06 * cos(T2 * (u - .31)) * w)', yaw: '(-.035 * cos(T2 * (u - .11)) * w)' } } }; })();

// ═══ THE FIGHT AT THE VAULT: vault_shove (the jobber, the lead) and guard_bowled (the guard, its pair: gap 1.2 m, facing, the same
// start). The guard's last pose is EXACTLY the plain stand (its root moved by its shift) at the moment of the shove, so it chains into
// falls.js's shove_fall (the robbery's knockdown: the hit, two steps back, the sit, the roll) → lie_hurt (and get_up from there): the
// chain is exact because shove_fall's first pose is the plain stand, as fall_back's is (shot_hit → fall_back).
// The big heads set the distance: face to face the walkers need ≥ 0.8 m (both fronts at z 0.40), so the clinch is at arm's length
// (scuffle_pair's: the hands locked on the other's forearms at a 1.2 m gap) and the shove lands with straight arms. The guard's head
// overhangs his chest by 0.25 m and the jobber's fists lead his own head by only 0.1 m, so the fists land at the guard's chin line at
// the chain point (the jobber 0.14 m in, the lunge eased), and the rest of the lunge follows the guard's snap back: measured on the real
// shader, the two heads stay ≥ 6.5 cm apart.
const SV_D = 2.7, GB_D = 1.75, STAND = [0, .04, 0, 0, 0];
// scuffle_pair's clinch arms (arrest.js): the lead's and the partner's
const CL_J = [1.28, .1, .12, 0, .3], CL_G = [1.24, .24, -.06, 0, .3];
const shove = (() => {
  const vars = [['ju', 'cBump(t, .12, .5)'], ['ch', 'cS(t, .02, .3) * (1. - cS(t, .45, .7))'], ['cl', 'cS(t, .5, .75)'], ['pp', 'sin(9.42478 * (t - .75)) * cS(t, .75, .85) * (1. - cS(t, 1.2, 1.3))'],
    ['rp', 'cS(t, 1.3, 1.45)'], ['cb', 'cS(t, 1.45, 1.58)'], ['th', 'cOut(t, 1.6, 1.74)'], ['ln', 'cOut(t, 1.65, 1.9)'], ['lb', 'cBack(t, 1.62, 1.8) * (1. - cS(t, 1.9, 2.3))'],
    ['re', 'cS(t, 1.9, 2.3)'], ['sh', 'cBump(t, 2.15, 2.55)'], ['dn', 'cS(t, 2.3, 2.7)'],
    // the root: steps in for the clinch, the push-pull, a recoil as he rips the guard's arms down, then the lunge (rob_lunge_grab's)
    ['m', '(.08 * cS(t, .48, .75) + .03 * pp - .08 * rp + .22 * ln + .08 * cS(t, 2.0, 2.4))']];
  const CH = [.3, .3, 0, .3, 1.5], RP = [.35, .55, 0, -.4, .7], CB = [.7, .25, .1, -.2, 1.2], TH = [1.45, .04, .2, -.2, .05], RE = [.35, .3, 0, -.1, .4];
  const arm = s => poseMix(STAND, [CH, 'ch'], [[CL_J[0], CL_J[1], CL_J[2], CL_J[3], `(.3 + .15 * max(0., ${s ? 1 : -1}. * pp))`], 'cl'], [RP, 'rp'], [CB, 'cb'], [TH, 'th'], [RE, 're'], [[.1, .5, 0, -.3, .5], 'sh'], [STAND, 'dn']);
  return { frame: 'body', vars,
    root: { mz: 'm' },
    // the feet: the −x foot steps in for the clinch, back on the recoil, then 0.32 into the lunge; the +x foot follows the clinch step, its
    // heel up in the lunge, then closes up
    feet: { zL: '(.12 * cS(t, .48, .7) - .06 * cS(t, 1.3, 1.45) + .24 * cS(t, 1.62, 1.82) - m)', lL: '(.05 * cBump(t, .48, .7) + .03 * cBump(t, 1.3, 1.45) + .07 * cBump(t, 1.62, 1.82))', fL: '(.12 * cBump(t, 1.66, 1.9))',
      zR: '(-.06 * cS(t, .05, .3) + .12 * cS(t, .55, .78) - .04 * cS(t, 1.32, 1.47) + .28 * cS(t, 2.0, 2.3) - m)', lR: '(.03 * cBump(t, .05, .3) + .04 * cBump(t, .55, .78) + .03 * cBump(t, 1.32, 1.47) + .05 * cBump(t, 2.0, 2.3))', fR: '(-.35 * cS(t, 1.66, 1.8) * (1. - cS(t, 1.95, 2.1)))' },
    body: { tx: '(.06 * ch + .18 * cl * (1. - rp) + .03 * pp + .35 * lb - .05 * sh)', ty: '(-.25 * ju + .12 * cBump(t, .3, .55) - .1 * rp * (1. - cb) + .1 * cb * (1. - th))', tz: '(.06 * ju)',
      drop: '(.05 * ch + .05 * cl * (1. - rp) + .03 * cS(t, 1.4, 1.6) * (1. - cS(t, 1.85, 2.3)) + .02 * sh)', bx: '(-.03 * ju)', pr: '(-.05 * ju)' },
    head: { hx: '(.02 * cl * (1. - rp) - .08 * lb - .06 * sh)', hy: '(.12 * ju + .25 * sh)', hz: '(.06 * sh)' },
    arms: [{ free: arm(0) }, { free: arm(1) }] }; })();
const guard = (() => {
  const vars = [['bl', 'cS(t, .02, .35)'], ['cl', 'cS(t, .5, .78)'], ['pp', 'sin(9.42478 * (t - .75)) * cS(t, .75, .85) * (1. - cS(t, 1.2, 1.3))'],
    ['rp', 'cS(t, 1.3, 1.45)'], ['dn', 'cS(t, 1.45, 1.75)'], ['m', '(.04 * cS(t, .05, .3) - .05 * cS(t, .8, 1.3) - .03 * pp + .04 * rp)']];
  const BL = [.85, .9, 0, -.6, .6], RP = [.3, .5, 0, .3, .3];
  const arm = s => poseMix(STAND, [BL, 'bl'], [[CL_G[0], CL_G[1], CL_G[2], CL_G[3], `(.3 + .15 * max(0., ${s ? -1 : 1}. * pp))`], 'cl'], [RP, 'rp'], [STAND, 'dn']);
  return { frame: 'body', vars,
    root: { mz: 'm' },
    feet: { zL: `(.1 * cS(t, .05, .3) - .07 * cS(t, 1.3, 1.6) - m)`, lL: '(.05 * cBump(t, .05, .3) + .03 * cBump(t, 1.3, 1.6))', fL: '0.',
      zR: `(-.06 * cS(t, .1, .35) + .09 * cS(t, 1.42, 1.7) - m)`, lR: '(.03 * cBump(t, .1, .35) + .04 * cBump(t, 1.42, 1.7))', fR: '0.' },
    body: { tx: '(.12 * bl * (1. - cl) + .18 * cl * (1. - rp) - .03 * pp - .08 * rp * (1. - dn))', ty: '(.03 * pp)', tz: '0.', drop: '(.07 * bl * (1. - cl) + .05 * cl * (1. - rp) + .02 * rp * (1. - dn))', bx: '0.', pr: '0.' },
    head: { hx: '(-.02 * cl * (1. - rp) - .05 * rp * (1. - dn))', hy: '0.', hz: '0.' },
    arms: [{ free: arm(0) }, { free: arm(1) }] }; })();

// ═══ LOOKOUT_WAVE (3.2 s loop): on the balls of his feet (the heels up, a nervous bounce twice a second), the knees soft; scans the
// street to −x 0–0.7 s and to +x 0.75–1.25; turns back toward the crew over the +x shoulder and waves them on: two big sweeps of the
// +x arm from out wide toward the crew (rolled out 1.3, back) round to forward, pointing the way out, fast forward and slower back
// ("come on, this way!") 1.4–2.56; back to the street. The sweep stays out at the side and low: the big head owns the space above.
const LW_D = 3.2;
const lookout = (() => { const D = LW_D;
  const vars = [['bo', `(.5 - .5 * cos(${f(2 * PI * 6 / D)} * t))`], ['sl', 'cS(t, 0., .5) * (1. - cS(t, .7, 1.0))'], ['sr', 'cS(t, .75, 1.0) * (1. - cS(t, 1.15, 1.4))'],
    ['bk', 'cS(t, 1.25, 1.45) * (1. - cS(t, 2.6, 2.95))'], ['wk', 'cS(t, 1.3, 1.45) * (1. - cS(t, 2.5, 2.7))'],
    // each sweep: a fast stroke forward (0 → 0.4 of it), a slower return; s1, s2 the two sweeps' phases (0 → 1)
    ['s1', 'cR(t, 1.4, 1.98)'], ['s2', 'cR(t, 1.98, 2.56)'], ['sp', '(s1 < 1. ? s1 : s2)'], ['fw', '(sp < .4 ? smoothstep(0., .4, sp) : 1. - smoothstep(.4, 1., sp))']];
  return { frame: 'body', vars,
    feet: { zL: '.06', lL: '0.', fL: '(-.16 * bo - .06)', zR: '-.08', lR: '0.', fR: '(-.12 * bo - .06)' },
    body: { tx: '(.1 + .03 * bo - .05 * bk)', ty: '(-.15 * sl + .15 * sr + .45 * bk)', tz: '(-.04 * bk)', drop: '(.04 + .025 * bo)', bx: '0.', pr: '0.' },
    head: { hx: '(-.04 - .02 * bo)', hy: '(-.95 * sl + .95 * sr + 1.25 * bk)', hz: '(.05 * sl - .05 * sr)' },
    arms: [{ free: ['(.1 + .05 * bo)', '(.28 + .05 * bo)', '0.', '-.2', '(.5 + .1 * bo)'] },
      { free: poseMix([.1, .28, 0, -.2, .5], [['mix(-.5, 1.25, fw)', 'mix(1.35, .75, fw)', '0.', 'mix(-.6, -.3, fw)', 'mix(.5, .2, fw)'], 'wk']) }] }; })();

export const CLIPS = [
  clip({ name: 'vault_drill', dur: DR_D, loop: true, blendIn: .35, blendOut: .35, prop: 'drill', track: drill,
    more: { door: { face: DRILL.face, at: DRILL.at }, sparks: (() => { const tr = jsTrack(drill, DR_D, true); return t => { const v = tr(t), p = v.props.drill; return { p: heistPoint(p, HEIST.drill.tip), d: heistDir(p, [0, .35, -1]), on: v.vars.on > .5 ? 1 : 0 }; }; })() },
    note: 'a loop (prop: drill; the door\'s face 1.01 m ahead, the bit in at body x 0.12, y 0.7): braced, the drill shuddering, the body with it · two hard pushes 0.35–0.85 and 1.15–1.6 s · backs the bit out 1.9–2.25 and looks at the hole · runs it back in 2.55–2.9 · a glance over the +x shoulder 3.0–3.75 · sparks(t) while the bit is in' }),
  clip({ name: 'vault_heave', dur: HV_D, blendIn: .2, blendOut: .3, shift: [0, HEAVE.back], track: heave,
    more: { door: { face: HEAVE.face, wheel: HEAVE.wheel, hinge: HEAVE.hinge, open: (() => { const tr = jsTrack(heave, HV_D, false); return t => tr(t).vars.th; })() } },
    note: 'a one-shot (the door\'s face 0.52 m ahead, its wheel\'s grips at body (±0.2, 0.70, 0.40), the hinge 0.95 m to −x; door.open(t) swings it): the hands to the wheel 0–0.4 s · steps up to the door and tips back on his heels 0.35–0.8 · HEAVE 0.8–1.3, HEAVE 1.35–1.8 · the door gives at 1.75, he walks it 0.3 rad open by 2.4 · lets go 2.4–2.55, staggers back out of its sweep to 3.3 while it swings on to 0.55 rad (by 3.7) · a fist pump 3.45–4.0 · the stand by 4.6, 0.9 m back (shift)' }),
  clip({ name: 'loot_carry', dur: LC_D, loop: true, moving: true, speed: LC_V, stride: 1.15, blendIn: .3, blendOut: .3, prop: 'sack', track: carry,
    glsl: `  cLegK = vec2(1.06, 1.18);\n${glslTrack(carry)}`,
    note: 'a MOVING loop at 1.5 m/s (stride ×1.15, the knees ×1.18; prop: sack, in the chest frame: pass the gait state to prop.matrix): the loot sack over the +x shoulder, the fist up by the head on its neck · leaning into it, heavy bouncing steps, the −x arm pumping · a hitch of the sack 0.5–0.95 s · a heavy step 1.7–2.3, the head and shoulders dipping (the head never turns: the sack boxes it in)' }),
  clip({ name: 'vault_shove', dur: SV_D, blendIn: .15, blendOut: .3, shift: [0, .3], track: shove, pair: { with: 'guard_bowled', gap: 1.2, delay: 0 },
    note: 'the jobber (pair: guard_bowled 1.2 m ahead, facing, the same start): a juke 0.1–0.5 s, fists up · steps in, the clinch 0.5–1.35 (hands locked, push-pull) · rips the guard\'s arms down 1.33–1.46 · the SHOVE: both arms snap out, a lunge, contact at 1.75 (the guard → shove_fall) · follows through a step, shakes it off 2.15–2.55 · the stand by 2.7, 0.42 m on (shift)' }),
  clip({ name: 'guard_bowled', dur: GB_D, next: 'shove_fall', blendIn: .15, blendOut: .3, shift: [0, .03], track: guard,
    note: 'the guard (vault_shove\'s partner): stamps into a wide block 0–0.35 s (arms spread, palms out) · catches the jobber in the clinch 0.5–1.35, gives a little · his arms are ripped down 1.35–1.5 · straightens: the plain stand at 1.75 = the shove; chains to shove_fall → lie_hurt (ends 0.03 m on, shift)' }),
  clip({ name: 'lookout_wave', dur: LW_D, loop: true, blendIn: .3, blendOut: .35, track: lookout,
    note: 'a loop: on the balls of his feet, bouncing · scans the street to −x 0–0.7 s and to +x 0.75–1.25 · turns back to the crew over the +x shoulder and waves them on, two big sweeps of the arm from behind forward 1.4–2.56 ("go, go!") · back to the street' }),
];
