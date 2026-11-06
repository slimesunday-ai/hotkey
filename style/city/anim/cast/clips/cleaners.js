// CLIPS · cleaners (events; 2026-11-04, slime: "cleaners is better, go with that"). When a body from a street accident lies in view, two
// figures in white hazmat suits step out of the nearest door, bag the body, carry it inside, and one comes back out and mops up the blood.
// Nobody reacts; it is always the same two. This group is their animation only: where they walk, which door, the road and the blood are
// the city's (cleaners.md says what it must stage). Seven clips, three of them a pair's partner:
//   bag_body        5.4 s one-shot, hold   cleaner A (the lead) crouched at the body's side: lays the empty bag out between, holds its edge
//                                          up while B rolls the body over into it, then runs the zip along the near side; stands
//   bag_body_b      5.4 s one-shot, hold   cleaner B (the partner, across the body, facing A): the push that rolls the body into the bag,
//                                          then sits back and watches the zip; stands
//   bag_lift        2.2 s one-shot → carry_back    A at the bag's FEET end, facing along it: crouches, takes the two foot loops, rises
//   bag_lift_front  2.2 s one-shot → carry_front   B at the HEAD end, its back to the bag: squats, takes the head loops behind it, rises
//   carry_back      2.0 s loop, MOVING 0.8 m/s     A walks behind with the bag slung between the hands in front of it (the walk's legs)
//   carry_front     2.0 s loop, MOVING 0.8 m/s     B walks in front, the bag's head loops in its hands behind it
//   mop             2.4 s loop                     work.js `sweep`'s own body and track, verbatim, with a mop on the broom's frame
// THE VAN (C2-VAN, 2026-11-05: they arrive in the city's `cleanvan`; THE VAN below): six more, after mop, every older id unchanged
//   van_step_down_back 2.55 s one-shot, shift  A from 0.9 m in the bay: three steps to the lip, down to the road · pair: van_step_down
//   van_step_down      2.55 s one-shot, shift  B from the lip: down to the road, three steps on
//   bag_in             5.4 s one-shot, shift   A at the feet end, from the carry: walks the bag in behind B, pushes it home · pair: bag_in_front
//   bag_in_front       5.4 s one-shot, hold    B at the head end: up into the bay pulling, sets it down, lets go, to the front of the bay
//   van_in             2.5 s one-shot, hold    from the road at the lip: a hand on the jamb, up into the bay, three steps in
//   van_in_close       3.6 s one-shot, hold    the last one in: up, a step in, turns round, pulls the doors to (doors(t): 1 → 0)
// THE BAG (cleaners-props.js body_bag) is ONE model in two states: empty is the full model flattened by the clip's matrix (BAG.flat), so
// the outline never changes. It is the LEAD's prop in every bag clip (bag_body, bag_lift, carry_back); the partners carry none. Its
// pose is written once as expressions valid in GLSL and JS (breakin.js's track model, imported: MODEL), so the hands that hold it and
// the bag's matrix read the same numbers. The hands are put ON their loops by the two-bone IK on the elbow (breakin.js trackGlsl).
// THE TWO-PERSON CARRY: the bag rides the LEAD's chest frame (prop.matrix takes the lead's gait state, as carry_box does); the partner's
// hands hold the far loops in ITS chest frame. The two meet exactly when both walkers' gaits are in step (the same cycle u: same speed,
// started on the same frame), as the stage must keep them; tools/cleanershands.mjs measures the hands against the loops on the real shader.
import { MODEL } from './breakin.js';
import { CLIPS as WORK } from './work.js';
import { BAG } from './cleaners-props.js';
import { cleanersGeometry } from './cleaners-props.js';
import { toolMatrix } from './work-tools.js';

const { JS, trackJs, trackGlsl, frameOf, walkChest } = MODEL;
const f = v => (+v).toFixed(4), PI = Math.PI;
const keys = (K, T = 't') => { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; };

// ═══ THE LAYOUT (metres, the lead's body frame: +z ahead, +x its left)
// bag_body: the bag lies ACROSS in front of A, its head end to A's +x, centred at BB; the body (lie_still) lies beyond it, between the bag
// and B: its walker's ground point at BODY.at with A's heading (lie_still lies along its own +x, on its side: falls.js LS); B is
// BODY.gap in front of A, facing A. At BODY.hide (bag_body's clock) the city hides the body: it is in the bag from then on.
export const BODY = { at: [-.85, 1.25], yaw: 0, gap: 2.15, hide: 2.0 };
const BB = [.2, 0, .65];
// bag_lift / carry: the bag along +z in front of A (the back carrier), its FEET end toward A: the bag's origin at LIFT (yaw −π/2: the
// bag's +x along A's +z, its +z along A's −x). B (the front carrier) is CARRY_GAP in front, facing the same way. The rise lifts it LIFT_Y.
export const LIFT = { at: [0, 0, 1.245], yaw: -PI / 2, rise: .275 };
export const CARRY_GAP = 2.55;
// the bag's matrix: T(p) · Ry(yaw) · Rx(tilt about its far long edge, bag_body's held-up near edge) · S(sx, sy, 1)
const bagMatrix = (THREE, b, out) => { const A = new THREE.Matrix4();
  out.makeTranslation(b.p[0], b.p[1], b.p[2]).multiply(A.makeRotationY(b.yaw));
  if (b.tilt) out.multiply(A.makeTranslation(0, 0, BAG.width / 2)).multiply(A.makeRotationX(b.tilt)).multiply(A.makeTranslation(0, 0, -BAG.width / 2));
  out.multiply(A.makeScale(b.sx, b.sy, 1)); if (b.show < .5) out.multiply(A.makeScale(1e-4, 1e-4, 1e-4)); return out; };
// a point of the bag's frame → the lead's body frame (no tilt or scale: the loops of the full bag)
const onBag = (p, yaw, q) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [p[0] + q[0] * c + q[2] * s, p[1] + q[1], p[2] - q[0] * s + q[2] * c]; };
// the loops as hand targets: [−x hand, +x hand] for A at the feet end and for B at the head end (bag +z → A's −x: the +z loop is the −x hand's)
const FEET = [BAG.handles.feet[1], BAG.handles.feet[0]], HEAD = [BAG.handles.head[1], BAG.handles.head[0]];

// ═══ bag_body · A (5.4 s): crouch 0–0.6 · the folded bag out and unfurled along the body 0.4–1.0, its near edge held up in both hands ·
// B rolls the body over into it 1.1–2.0 (A holds the edge up, leaning in) · in at 2.0 (the body hidden; the bag fills 2.0–2.25) · the −x
// hand flat on the bag, the +x hand runs the zip from the feet toward the head 2.5–3.9 · hands off, up 4.1–4.9 · held standing
const BB_D = 5.4;
const bbA = {
  vars: [['cr', 'cS(t, 0., .6) * (1. - cS(t, 4.1, 4.9))'], ['un', 'cS(t, .4, 1.)'], ['rl', 'cBump(t, 1.05, 2.05)'], ['sw', 'cS(t, 2.05, 2.4)'], ['zp', 'cS(t, 2.5, 3.9)'],
    ['hk', 'cS(t, .45, .75) * (1. - cS(t, 3.95, 4.3))'], ['up', '.15 * (1. - cS(t, .6, .95)) + .15 * cBump(t, 2.05, 2.45)']],
  body: { tx: 'mix(.55 + .05 * rl, .55, sw) * cr', ty: '.12 * cBump(t, 2.4, 4.)', drop: '.22 * cr' },
  feet: { zL: '.08', zR: '-.02' },
  head: { hx: '.35 * cr + .08 * zp * (1. - cS(t, 3.9, 4.3))', hy: '(-.15 + .35 * zp) * cS(t, 2.3, 2.6) * (1. - cS(t, 3.9, 4.4))' },
  L: { b: ['mix(-.3 - .12 * un, -.4, sw)', 'mix(.19 + .02 * rl, .34, sw) + up', 'mix(.34, .52, sw)'], k: 'hk', pole: [-1, -.6, -.4], free: ['.45 * cr', '.3', '0.', '0.', '.5 * cr'] },
  R: { b: ['mix(.3 + .12 * un, .1 + .25 * zp, sw)', 'mix(.19 + .02 * rl, .33, sw) + up', 'mix(.34, .51, sw)'], k: 'hk', pole: [1, -.6, -.4], free: ['.45 * cr', '.3', '0.', '0.', '.5 * cr'] },
  // the bag: shown from 0.3 (folded: 15 % of its length), unfurled 0.4–1.0, its near edge held up (tilted about the far edge) until it fills
  bag: { sx: '.35 + .65 * un', sy: `mix(${f(BAG.flat)}, 1., cS(t, 2., 2.25))`, tilt: '(.24 + .03 * rl) * (1. - cS(t, 2., 2.3))', show: 'step(.3, t)' },
};
// bag_body_b · B (5.4 s, facing A, BODY.gap in front): crouch 0–0.6 · both hands on the body's far side 0.8–1.1 · the push 1.1–2.0 (the
// chest leans in) · hands off as it goes in (2.0–2.3), sits back on its heels, watches the zip · up 4.1–4.9 · held standing
const bbB = {
  vars: [['cr', 'cS(t, 0., .6) * (1. - cS(t, 4.1, 4.9))'], ['pu', 'cS(t, 1.1, 2.)'], ['hk', 'cS(t, .75, 1.05) * (1. - cS(t, 2., 2.3))']],
  body: { tx: '(.55 + .12 * pu * (1. - cS(t, 2., 2.5)) - .25 * cS(t, 2.2, 2.8)) * cr', drop: '.22 * cr' },
  feet: { zL: '.04', zR: '-.06' },
  head: { hx: '(.4 + .1 * pu) * cr', hy: '.25 * cS(t, 2.4, 2.9) * (1. - cS(t, 3.9, 4.4))' },
  L: { b: ['-.36', '.3 + .05 * pu', '.52 + .05 * pu'], k: 'hk', pole: [-1, -.6, -.3], free: ['.55 * cr', '.35', '0.', '.2', '.7 * cr'] },
  R: { b: ['.36', '.3 + .05 * pu', '.52 + .05 * pu'], k: 'hk', pole: [1, -.6, -.3], free: ['.55 * cr', '.35', '0.', '.2', '.7 * cr'] },
};

// ═══ bag_lift · A at the FEET end (2.2 s → carry_back): a crouch 0–0.5, the hands into the foot loops 0.4–0.65, up with the bag 0.8–1.7
// (it rises LIFT.rise: its loops from 0.225 to 0.50 m), settled by 2.2 in carry_back's first pose. bag_lift_front · B at the HEAD end,
// its back to the bag: a straight-backed squat, the hands back and down into the head loops, up with it (the same rise)
const LF_D = 2.2, RISE = `${f(LIFT.rise)} * cS(t, .8, 1.7)`;
const loopB = (q, dz) => onBag(LIFT.at, LIFT.yaw, q).map((v, i) => i === 1 ? `${f(v)} + ${RISE}` : f(i === 2 ? v - dz : v));
const lift = {
  vars: [['cr', 'cS(t, 0., .5) * (1. - cS(t, .8, 1.7))'], ['hk', 'cS(t, .4, .65)']],
  body: { tx: '.48 * cr', drop: '.19 * cr' }, feet: { zL: '.04', zR: '-.04' }, head: { hx: '.3 * cr + .05' },
  L: { b: loopB(FEET[0], 0), k: 'hk', pole: [-1, -.8, -.3], free: ['.4 * cr', '.3', '0.', '0.', '.3 * cr'] }, R: { b: loopB(FEET[1], 0), k: 'hk', pole: [1, -.8, -.3], free: ['.4 * cr', '.3', '0.', '0.', '.3 * cr'] },
  bag: { sx: '1.', sy: '1.', tilt: '0.', show: '1.' },
};
const liftF = {
  vars: [['cr', 'cS(t, 0., .5) * (1. - cS(t, .8, 1.7))'], ['hk', 'cS(t, .4, .65)']],
  body: { tx: '-.04 * cr', drop: '.24 * cr' }, feet: { zL: '.06', zR: '-.02' }, head: { hx: '.1 * cr', hy: '-.5 * cBump(t, .2, .9)' },
  L: { b: loopB(HEAD[0], CARRY_GAP), k: 'hk', pole: [-1, -.4, -1], free: ['-.1', '.35', '0.', '0.', '0.'] }, R: { b: loopB(HEAD[1], CARRY_GAP), k: 'hk', pole: [1, -.4, -1], free: ['-.1', '.35', '0.', '0.', '0.'] },
};
// ═══ carry_back / carry_front (2.0 s loops, MOVING at 0.8 m/s: the walk's legs): the chest square (P.torso 0: the walk's counter-turn
// is held off, so the chest frame moves with the pelvis only, and the bag with it), the hands on the loops in the chest's rest frame
// (carry_back: its foot loops in front; carry_front: the head loops behind it). A glance now and then.
const CARRY_D = 2, CARRY_V = .8;
const loopC = (q, dz) => onBag([LIFT.at[0], LIFT.rise, LIFT.at[2]], LIFT.yaw, q).map((v, i) => f(i === 2 ? v - dz : v));
const carryB = { head: { hx: '.18', hy: '.25 * cBump(t, .3, 1.1)' },
  L: { c: loopC(FEET[0], 0), pole: [-1, -.8, -.3] }, R: { c: loopC(FEET[1], 0), pole: [1, -.8, -.3] } };
const carryF = { head: { hx: '.05', hy: '-.3 * cBump(t, 1.1, 1.8)' },
  L: { c: loopC(HEAD[0], CARRY_GAP), pole: [-1, -.4, -1] }, R: { c: loopC(HEAD[1], CARRY_GAP), pole: [1, -.4, -1] } };

// ═══ the bag prop (the lead's): its pose in the lead's BODY frame at the clip clock t. frame 'body' (bag_body, bag_lift: the bag on the
// ground or rising in the hands) · 'chest' (carry_back: rigid in the lead's chest frame, so pass the lead's gait state g to matrix/pose,
// as the city does in the gait hook; without g a steady walk at CARRY_V is assumed, the pelvis at its mean height)
function bagProp(T, dur, loop, frame) {
  const tr = trackJs(T, dur, loop), B = T.bag || {}, ks = Object.keys(JS), vals = ks.map(k => JS[k]);
  const ex = new Function(...ks, 't', 'D', `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { sx: ${B.sx ?? '1.'}, sy: ${B.sy ?? '1.'}, tilt: ${B.tilt ?? '0.'}, show: ${B.show ?? '1.'} };`);
  const at = t => ex(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur);
  const place = frame === 'bag_body' ? (() => ({ p: BB, yaw: 0 })) : (t => { const v = tr(t); return { p: [LIFT.at[0], LIFT.at[1] + (frame === 'carry' ? LIFT.rise : LIFT.rise * JS.cS(loop ? JS.mod(t, dur) : t, .8, 1.7)), LIFT.at[2]], yaw: LIFT.yaw, v }; });
  // the bag (in the lead's body frame for the body clips, its chest's rest frame for the carry) → the lead's body frame
  const toBody = (t, g) => { if (frame !== 'carry') return null; const v = tr(t, g?.u ?? 0, g?.w ?? 1); return frameOf(v, walkChest(g)); };
  const pose = (t, g = null) => { const b = { ...place(t), ...at(t) }; return { p: b.p, yaw: b.yaw, sx: b.sx, sy: b.sy, tilt: b.tilt, show: b.show, fr: toBody(t, g) }; };
  return { id: 'body_bag', frame: frame === 'carry' ? 'chest' : 'body', geometry: THREE => cleanersGeometry(THREE, 'body_bag'), pose, track: tr,
    matrix(THREE, t, out = new THREE.Matrix4(), g = null) { const b = pose(t, g); bagMatrix(THREE, b, out); if (!b.fr) return out;
      const fr = b.fr, o = fr.toBody([0, 0, 0]), ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(d => fr.dirToBody(d)), M = new THREE.Matrix4();
      M.set(ax[0][0], ax[1][0], ax[2][0], o[0], ax[0][1], ax[1][1], ax[2][1], o[1], ax[0][2], ax[1][2], ax[2][2], o[2], 0, 0, 0, 1); return out.premultiply(M); },
    // the four loops' grip points in the lead's body frame (the full bag; the checks and the stage read them): { feet: [−x, +x], head: [−x, +x] }
    loops(t, g = null) { const b = pose(t, g), m = q => { const p = onBag(b.p, b.yaw, q); return b.fr ? b.fr.toBody(p) : p; }; return { feet: FEET.map(m), head: HEAD.map(m), show: b.show }; } };
}
const entry = (o, T, frame, glslO = {}) => ({ name: o.name, dur: o.dur, loop: !!o.loop, hold: !!o.hold, next: o.next || null, blendIn: o.blendIn ?? .3, blendOut: o.blendOut ?? .35,
  moving: !!o.moving, speed: o.speed || 0, pair: o.pair || null, note: o.note, ...(frame ? { prop: bagProp(T, o.dur, !!o.loop, frame) } : {}), ...(o.extra || {}),
  track: trackJs(T, o.dur, !!o.loop), glsl: trackGlsl(T, glslO) });

// a van clip: the rise put into the root (withRise), and bag_in's prop
const vanEntry = (o, T, prop = null) => ({ name: o.name, dur: o.dur, loop: false, hold: !!o.hold, next: null, blendIn: o.blendIn ?? .3, blendOut: o.blendOut ?? .35,
  moving: false, speed: 0, shift: o.shift || null, pair: o.pair || null, note: o.note, ...(prop ? { prop: bagInProp(T, o.dur) } : {}), ...(o.extra || {}),
  track: trackJs(T, o.dur, false), glsl: withRise(trackGlsl(T)) });

// ═══ mop: work.js sweep, verbatim (its GLSL and its track), the broom swapped for the mop (cleaners-props.js: the broom's frame)
const SWEEP = WORK.find(c => c.name === 'sweep');
const mopProp = { ...SWEEP.prop, id: 'mop', tool: 'mop', geometry: THREE => cleanersGeometry(THREE, 'mop'),
  matrix(THREE, t, out = new THREE.Matrix4()) { return toolMatrix(THREE, SWEEP.prop.pose(t), out); } };

// ═══ THE VAN (C2-VAN, 2026-11-05; slime 11-05: "Vans is fine if you think that's the best option"). The Cleaners arrive in a plain
// white van stopped in the travel lane beside the body (the city's vehicles/ model `cleanvan`; cleaners.md § The van): they step out of the back, bag the body, carry it to the van's
// tail, load it, and climb back in. Three beats, six clips (each beat a pair, or one actor twice). THE FLOOR IS THE VAN'S: the bay's
// floor is VAN.floor (0.2 m: one stair riser, transit.js stairs' 0.18) above the road, flush with the rear sill at the tail's face (the lip). A walker's ground point stays ON
// THE ROAD throughout; while it stands in the bay the clip itself raises the body by the floor (cMov.y: the `rise` below), so the stage
// never moves a walker up or down: it places the walker on the road under where the clip says, plays the clip, and applies `shift` at a
// one-shot's end. The rig's legs are short (the hip 0.5 m up; 0.3 m was measured too high: the leg cloth wants the hip ≥ ~0.12 m over
// each ankle, and the hip is held under BOTH feet), so across the step the root leads, the lower foot goes on its toes and stays under
// the hip, and the body leans into it.
export const VAN = { floor: .2 };
// a foot's path in the clip's GROUND frame (z from the walker's start, y up from the road): a start and steps { t: [a, b], dz, dy } of a
// kind: 'up' (onto a higher surface: it rises first, then goes on), 'down' (off one: on and down together, landing toe first), 'flat'
// (a walking step, lifted h); toes: [[t0, t1, k]] a held heel-up of k rad (the lower foot across the step: it holds the hip up).
// → { z, y, base (y without the lift's arc), sup (the surface it stands on: it changes as the weight comes onto it, late in the step), fp }
// expressions in t (GLSL and JS)
const footPath = (z0, y0, steps, toes = []) => { let z = f(z0), base = f(y0), sup = f(y0), arc = '', fp = '0.';
  for (const s of steps) { const [a, b] = s.t, L = b - a, w = (u, v) => `${f(a + u * L)}, ${f(a + v * L)}`, h = s.h ?? (s.kind === 'flat' ? .06 : s.kind === 'up' ? .04 : 0);
    const [zw, yw] = s.kind === 'up' ? [w(.3, 1), w(0, .65)] : s.kind === 'down' ? [w(0, .6), w(.08, .85)] : [w(0, 1), w(0, 1)];
    if (Math.abs(s.dz) > 1e-6) z += ` + ${f(s.dz)} * cS(t, ${zw})`; if (s.dy) { base += ` + ${f(s.dy)} * cS(t, ${yw})`; sup += ` + ${f(s.dy)} * cS(t, ${w(.7, 1.15)})`; } arc += ` + ${f(h)} * cBump(t, ${w(0, 1)})`;
    if (s.kind !== 'down') fp += ` - .28 * cBump(t, ${f(a - .1)}, ${f(a + .3 * L)})`;   // (off the floor, the foot leaves flat: its heel up would lift the ankle the hip must clear)
    if (s.kind === 'up') fp += ` + .15 * cBump(t, ${w(.25, .75)})`; }
  for (const [t0, t1, k] of toes) fp += ` - ${f(k)} * (cS(t, ${f(t0)}, ${f(t0 + .12)}) - cS(t, ${f(t1 - .12)}, ${f(t1)}))`;
  return { z: `(${z})`, base: `(${base})`, sup: `(${sup})`, y: `(${base}${arc})`, fp: `(${fp})` }; };
// the feet from footfalls [foot, a, b, z] (the ground-frame z it lands at), the ground's height under a z, the start (both feet's z);
// each step's kind from the heights it leaves and meets. THE ROOT FOLLOWS THE FEET: mz is the mean of the two feet's z and the rise the
// mean of the surfaces under them, so the hip stays between the feet (the hip is solved under BOTH feet: a foot out of reach pulls it
// down, and the leg cloth tears) and comes up the step as the weight goes over. end: where each foot ends, and the root's end (mz)
function feetPlan(ground, start, steps, toes = { L: [], R: [] }) {
  const P = { L: [], R: [] }, cur = { ...start };
  for (const [ft, a, b, z1] of steps) { const z0 = cur[ft], y0 = ground(z0), y1 = ground(z1);
    P[ft].push({ kind: y1 > y0 + 1e-6 ? 'up' : y1 < y0 - 1e-6 ? 'down' : 'flat', t: [a, b], dz: z1 - z0, dy: y1 - y0 }); cur[ft] = z1; }
  const L = footPath(start.L, ground(start.L), P.L, toes.L), R = footPath(start.R, ground(start.R), P.R, toes.R);
  // the free arms' swing, against the legs: as a foot steps, its own side's arm goes back and the other's forward (clear of the thighs)
  const sw = { L: '0.', R: '0.' }; for (const [ft, a, b] of steps) { const o = ft === 'L' ? 'R' : 'L'; sw[ft] += ` - .28 * cBump(t, ${f(a)}, ${f(b)})`; sw[o] += ` + .2 * cBump(t, ${f(a)}, ${f(b)})`; }
  return { L, R, mz: `((${L.z} + ${R.z}) * .5)`, rs: `((${L.sup} + ${R.sup}) * .5)`, end: { ...cur, mz: +((cur.L + cur.R) / 2).toFixed(4) }, swing: { L: `(${sw.L})`, R: `(${sw.R})` } };
}
// a free arm (cArm's [pitch, roll, yaw, twist, elbow]): hanging out from the hips (the roll keeps the mitten off the thigh), swinging with the steps
const freeArm = (ft, side, extra = {}) => [`.06 + ${ft.swing[side]}${extra.p ? ' + ' + extra.p : ''}`, extra.r ?? '.26', '0.', '.2', extra.e ?? '.35'];
// the feet of a track whose root moves by vars mz (along) and rs (the rise): each foot's ground-frame path, back into the body frame
const vanFeet = (L, R) => ({ zL: `${L.z} - mz`, lL: `${L.y} - rs`, fL: L.fp, zR: `${R.z} - mz`, lR: `${R.y} - rs`, fR: R.fp });
// the rise goes into the root's move (cMov.y) BEFORE the hands' IK, which takes cMov off a body-frame target: a target in the ground
// frame then stays put in the world as the body climbs (breakin.js trackGlsl writes cMov = vec3(0., 0., mz); the y is put in here)
const withRise = (glsl, rs = 'rs') => { const k = 'cMov = vec3(0., 0., '; if (!glsl.includes(k)) throw new Error('cleaners: trackGlsl changed shape (cMov)'); return glsl.replace(k, `cMov = vec3(0., ${rs}, `); };

// ── van_step_down (B: from the lip of the bay down to the road, then two steps on) · van_step_down_back (A: from 0.9 m deeper in the
// bay: three steps along the floor to the lip, then the same step down). Both start standing in the bay facing out, the body raised by
// the floor; the stage starts them with playClip(g, …, { snap: true }) on the frame the walker is shown (it was in the van, hidden).
const SD = { lip: .21, back: .9 };
function stepDown(back) {
  const F = VAN.floor, o = back ? SD.back : 0, T0 = back ? 1.15 : 0, lip = SD.lip + o, ground = z => z < lip ? F : 0, land = lip + .18;
  const steps = [...(back ? [['R', .1, .45, .45], ['L', .4, .8, o - .01], ['R', .75, 1.1, o + .01]] : []), ['R', T0 + .15, T0 + .65, land + .02], ['L', T0 + .75, T0 + 1.1, land - .02],
    ...(back ? [] : [['R', 1.2, 1.6, land + .45], ['L', 1.55, 1.95, land + .9], ['R', 1.9, 2.25, land + .98]])];
  const ft = feetPlan(ground, { L: -.01, R: .01 }, steps, { L: [], R: [[T0 + .25, T0 + 1.0, .3]] }), D = +((back ? T0 + 1.1 : 2.25) + .3).toFixed(4);
  const dn = `cBump(t, ${f(T0 + .1)}, ${f(T0 + 1.15)})`;
  return { D, shift: [0, ft.end.mz], T: {
    vars: [['mz', ft.mz], ['rs', ft.rs], ['dn', dn]],
    body: { tx: `.05 + .2 * dn`, ty: `.06 * cBump(t, ${f(T0 + .15)}, ${f(T0 + .65)}) - .05 * cBump(t, ${f(T0 + .65)}, ${f(T0 + 1.05)})`, drop: `-.12 * dn` },
    feet: vanFeet(ft.L, ft.R), root: { mz: 'mz' }, head: { hx: `.12 + .3 * dn`, hy: '0.' },
    L: { free: freeArm(ft, 'L', { p: '.2 * dn', r: '.26 + .2 * dn', e: '.35 + .25 * dn' }) }, R: { free: freeArm(ft, 'R', { p: '.12 * dn', r: '.26 + .25 * dn', e: '.35 + .2 * dn' }) } } };
}
const SDF = stepDown(false), SDB = stepDown(true);

// ── bag_in (A, the lead, at the bag's FEET end) · bag_in_front (B, CARRY_GAP ahead at its HEAD end, its back to the bag): from the
// carry, at the van's tail. B's toes stop at the lip (BI.lip ahead of A); B steps up into the bay with the head loops in its hands
// behind it, and walks in pulling, A following with the feet end raised (the bag rides level, its bottom LIFT.rise + the floor up, its
// place the mean of the two walkers'); in the bay they set it down (its bottom on the floor), B lets go and steps on to the front of the
// bay, A pushes the feet end in over the lip and lets go. A ends standing at the tail (shift); B holds standing at the front of the bay
// (the stage hides it there).
const BI = { lip: CARRY_GAP + .32, D: 5.4, slide: .13 };
const BI_A = feetPlan(() => 0, { L: .04, R: -.04 }, [['R', .6, 1.0, .26], ['L', .95, 1.35, .52], ['R', 1.3, 1.7, 1.0], ['L', 1.65, 2.05, 1.46], ['R', 2.0, 2.4, 1.92], ['L', 2.35, 2.75, 1.88],
  ['R', 3.9, 4.3, 2.2], ['L', 4.25, 4.65, 2.43], ['R', 4.6, 4.95, 2.51]], { L: [], R: [] });
const BI_B = (() => { const lip = BI.lip - CARRY_GAP; return feetPlan(z => z > lip ? VAN.floor : 0, { L: .04, R: -.04 },
  [['R', .55, 1.0, lip + .2], ['L', .95, 1.35, lip + .24], ['R', 1.3, 1.7, 1.04], ['L', 1.65, 2.05, 1.5], ['R', 2.0, 2.4, 1.96], ['L', 2.35, 2.75, 1.88], ['R', 3.6, 4.0, 2.3], ['L', 3.95, 4.35, 2.34]],
  { L: [[.8, 1.1, .3]], R: [] }); })();
const BAG_IN = (() => { const F = VAN.floor, carried = `((${BI_A.mz} + ${BI_B.mz}) * .5)`, held = `cS(t, 3.45, 3.75)`;
  // the bag's z: the two walkers' mean while both hold it; once B lets go, A's alone (plus the last slide off A's hands)
  const dz = `(mix(${carried}, ${BI_A.mz}, ${held}) + ${f(BI.slide)} * cS(t, 3.9, 4.75))`;
  return { lip: BI.lip, by: `(${f(LIFT.rise)} + ${f(F)} * cS(t, .75, 1.3) - ${f(LIFT.rise)} * cS(t, 2.95, 3.5))`, bz: `(${f(LIFT.at[2])} + ${dz})`,
    rest: [0, F, +(LIFT.at[2] + BI_A.end.mz + BI.slide).toFixed(4)] }; })();
// a loop of the bag (bag frame q) at t, in A's ground frame (dz: B's frame is CARRY_GAP further on) as expressions
const loopAt = (q, dz = 0) => { const c = Math.cos(LIFT.yaw), s = Math.sin(LIFT.yaw), x = q[0] * c + q[2] * s, z = -q[0] * s + q[2] * c;
  return [f(LIFT.at[0] + x), `${BAG_IN.by} + ${f(q[1])}`, `${BAG_IN.bz} + ${f(z - dz)}`]; };
const bagInA = { vars: [['mz', BI_A.mz], ['rs', BI_A.rs], ['hk', '1. - cS(t, 4.75, 5.05)'], ['pu', 'cS(t, 3.8, 4.1) * (1. - cS(t, 4.75, 5.1))']],
  body: { tx: `.12 + .3 * pu + .1 * cS(t, 2.95, 3.5) * (1. - cS(t, 3.8, 4.2))`, drop: '.03 * pu' }, feet: vanFeet(BI_A.L, BI_A.R), root: { mz: 'mz' },
  head: { hx: '.25 + .1 * pu', hy: '.2 * cBump(t, .2, 1.)' },
  L: { b: loopAt(FEET[0]), k: 'hk', pole: [-1, -.8, -.3], free: freeArm(BI_A, 'L') }, R: { b: loopAt(FEET[1]), k: 'hk', pole: [1, -.8, -.3], free: freeArm(BI_A, 'R') },
  bag: { sx: '1.', sy: '1.', tilt: '0.', show: '1.' } };
const bagInB = { vars: [['mz', BI_B.mz], ['rs', BI_B.rs], ['hk', '1. - cS(t, 3.4, 3.8)'], ['cr', 'cBump(t, 2.9, 3.75)']],
  body: { tx: `.08 + .22 * cBump(t, .5, 1.4) + .1 * cr`, drop: `-.1 * cBump(t, .5, 1.4) + .2 * cr` }, feet: vanFeet(BI_B.L, BI_B.R), root: { mz: 'mz' },
  head: { hx: '.2 + .25 * cBump(t, .4, 1.3) - .1 * cr', hy: '-.4 * cBump(t, 2.95, 3.6) + .5 * cBump(t, 4.3, 5.3)' },
  L: { b: loopAt(HEAD[0], CARRY_GAP), k: 'hk', pole: [-1, -.4, -1], free: freeArm(BI_B, 'L', { r: '.4' }) }, R: { b: loopAt(HEAD[1], CARRY_GAP), k: 'hk', pole: [1, -.4, -1], free: freeArm(BI_B, 'R', { r: '.4' }) } };
// the bag in bag_in: level, along A's +z, in A's GROUND frame (A's start: the prop rides the walker's ground point, which stays put until
// bag_in's end shift); it ends in the bay at BAG_IN.rest (where the stage draws it, resting, until the doors are shut)
function bagInProp(T, dur) {
  const tr = trackJs(T, dur, false), ks = Object.keys(JS), vals = ks.map(k => JS[k]), ex = new Function(...ks, 't', `return [${BAG_IN.by}, ${BAG_IN.bz}];`);
  const pose = t => { const [y, z] = ex(...vals, Math.max(0, t)); return { p: [LIFT.at[0], y, z], yaw: LIFT.yaw, sx: 1, sy: 1, tilt: 0, show: 1 }; };
  return { id: 'body_bag', frame: 'body', geometry: THREE => cleanersGeometry(THREE, 'body_bag'), pose, track: tr, rest: BAG_IN.rest,
    matrix(THREE, t, out = new THREE.Matrix4()) { return bagMatrix(THREE, pose(t), out); },
    loops(t) { const b = pose(t), m = q => onBag(b.p, b.yaw, q); return { feet: FEET.map(m), head: HEAD.map(m), show: 1 }; } };
}

// ── van_in (up into the bay and three steps in: out of sight; hold) · van_in_close (the last one in: up, a step in, a turn round to
// face out, both hands out to the leaves, and the doors pulled to: `doors(t)` is the doors' open value the clip asks the stage for,
// 1 → 0). Both start on the road facing the van, the toes at the lip (VI.lip ahead), in line with the doorway's middle.
const VI = { lip: .32 };
function vanIn(close) {
  const F = VAN.floor, lip = VI.lip, ground = z => z > lip ? F : 0;
  const ft = feetPlan(ground, { L: .04, R: -.04 }, [['R', .3, .75, lip + .2], ['L', .7, 1.1, lip + .24], ...(close ? [['R', 1.15, 1.45, .99], ['L', 1.4, 1.7, .91]] : [['R', 1.15, 1.55, 1.0], ['L', 1.5, 1.9, 1.46], ['R', 1.85, 2.2, 1.5]])],
    { L: [[.55, .85, .3]], R: [] });
  const D = close ? 3.6 : 2.5, end = ft.end.mz;
  const T = { vars: [['mz', ft.mz], ['rs', ft.rs], ['up', 'cBump(t, .2, 1.2)'], ['tu', close ? 'cS(t, 1.75, 2.35)' : '0.'], ['kr', close ? 'cS(t, 2.3, 2.45)' : '0.'], ['rc', close ? 'cS(t, 2.45, 2.75)' : '0.'], ['pl', close ? 'cS(t, 2.5, 3.25)' : '0.']],
    body: { tx: `.08 + .25 * up + .25 * rc - .15 * pl * rc`, drop: '-.1 * up' }, feet: vanFeet(ft.L, ft.R), root: { ry: `${f(PI)} * tu`, mz: 'mz' },
    head: { hx: `.15 + .3 * up - .1 * rc`, hy: `${f(PI)} * tu` },
    // the +x hand on the doorway's +x jamb while it climbs (a ground-frame point: it stays on the jamb as the body rises); van_in_close's
    // two hands, once it has turned, take hold beside the hips (kr: where they hang, so the blend onto the IK is short) and go out to the
    // leaves' edges ahead of it (rc; its −z in the ground frame), and pull them in (pl)
    R: close ? { b: [`(t < 1.6 ? .62 : mix(-.42, -.4, rc))`, `(t < 1.6 ? 1.0 : mix(${f(F + .5)}, ${f(F + .85)}, rc))`, `(t < 1.6 ? ${f(lip + .06)} : mix(${f(end - .05)}, ${f(end - .55)} + .12 * pl, rc))`],
        k: 'max(cS(t, .2, .45) * (1. - cS(t, 1.0, 1.3)), kr)', pole: [1, -.6, -.3], free: freeArm(ft, 'R', { r: '.4' }) }
      : { b: ['.62', '1.0', f(lip + .06)], k: 'cS(t, .2, .45) * (1. - cS(t, 1.0, 1.3))', pole: [1, -.6, -.3], free: freeArm(ft, 'R', { r: '.4' }) },
    L: close ? { b: [`mix(.42, .4, rc)`, `mix(${f(F + .5)}, ${f(F + .85)}, rc)`, `mix(${f(end - .05)}, ${f(end - .55)} + .12 * pl, rc)`], k: 'kr', pole: [-1, -.6, -.3], free: freeArm(ft, 'L') } : { free: freeArm(ft, 'L') } };
  return { D, T, doors: close ? (t => 1 - JS.cS(t, 2.5, 3.25)) : null };
}
const VIN = vanIn(false), VINC = vanIn(true);
// where the stage puts them (metres, each clip's own frame at its start: +z the way it faces): the lip of the bay (the tail's face) ahead
// of the walker's ground point. out: van_step_down's lip (van_step_down_back's is back further on) · in: van_in / van_in_close's · bag:
// bag_in's (ahead of A; B is CARRY_GAP on) and where the bag rests at its end (A's start frame: the bag's origin, its +x along A's +z)
export const VAN_MARKS = { out: { lip: SD.lip, back: SD.back }, in: { lip: VI.lip }, bag: { lip: BI.lip, rest: BAG_IN.rest } };

export const CLIPS = [
  entry({ name: 'bag_body', dur: BB_D, hold: true, pair: { with: 'bag_body_b', gap: BODY.gap, delay: 0 }, extra: { body: BODY },
    note: "cleaner A at the body's side (the body, lie_still, lies beyond the bag: BODY.at; B across it, BODY.gap ahead, facing): crouch 0–0.6 s · the folded bag out and unfurled 0.4–1.0, its near edge held up · B rolls the body in 1.1–2.0 · in at 2.0 (the city hides the body: BODY.hide), the bag fills 2.0–2.25 · the zip along the near side 2.5–3.9 · up 4.1–4.9 · holds standing (prop: body_bag)" }, bbA, 'bag_body'),
  entry({ name: 'bag_body_b', dur: BB_D, hold: true,
    note: "cleaner B (bag_body's partner, across the body, facing A): crouch 0–0.6 s · both hands on the body's far side 0.8–1.1 · the push that rolls it over into the bag 1.1–2.0 · hands off, sits back, watches the zip · up 4.1–4.9 · holds standing" }, bbB, null),
  entry({ name: 'bag_lift', dur: LF_D, next: 'carry_back', pair: { with: 'bag_lift_front', gap: CARRY_GAP, delay: 0, face: 'away' }, extra: { lift: LIFT },
    note: "cleaner A at the bag's feet end, facing along it (B at the head end, CARRY_GAP ahead, its back to A): a crouch 0–0.5 s · the hands into the foot loops 0.4–0.65 · up with the bag 0.8–1.7 · chains to carry_back (prop: body_bag)" }, lift, 'lift'),
  entry({ name: 'bag_lift_front', dur: LF_D, next: 'carry_front',
    note: "cleaner B at the bag's head end, its back to the bag: a straight-backed squat 0–0.5 s, a look back over the shoulder · the hands back into the head loops 0.4–0.65 · up with it 0.8–1.7 · chains to carry_front" }, liftF, null),
  entry({ name: 'carry_back', dur: CARRY_D, loop: true, moving: true, speed: CARRY_V, pair: { with: 'carry_front', gap: CARRY_GAP, delay: 0, face: 'away' },
    note: "a MOVING loop at 0.8 m/s (the walk's legs): cleaner A behind, the bag's foot loops in both hands in front, the bag slung ahead to B; a glance aside 0.3–1.1 s (prop: body_bag, in A's chest frame: pass A's gait state; both walkers' gaits in step)" }, carryB, 'carry', { overlay: true }),
  entry({ name: 'carry_front', dur: CARRY_D, loop: true, moving: true, speed: CARRY_V,
    note: "a MOVING loop at 0.8 m/s (the walk's legs): cleaner B in front, the bag's head loops in both hands behind it; a glance back 1.1–1.8 s" }, carryF, null, { overlay: true }),
  { name: 'mop', dur: SWEEP.dur, loop: true, blendIn: SWEEP.blendIn, blendOut: SWEEP.blendOut, glsl: SWEEP.glsl, prop: mopProp,
    note: "work.js sweep's body and track verbatim, with a mop (prop: mop, on the broom's frame): two short strokes right to left 0–0.5 s and 1.2–1.65, the mop head on the ground, a small step between · the head down on the floor" },
  // ── C2-VAN (2026-11-05): the van beats (above: THE VAN). New entries go last: every older clip keeps its id and its GLSL
  vanEntry({ name: 'van_step_down_back', dur: SDB.D, shift: SDB.shift, blendIn: .05, pair: { with: 'van_step_down', gap: SD.back, delay: 0, face: 'away' }, extra: { van: VAN },
    note: `cleaner A in the bay, ${SD.back} m in from the lip, facing out (B ${SD.back} m ahead at the lip, its back to A): three steps along the floor to the lip 0.1–1.15 s · the +x foot over the lip and down to the road toe first 1.35–1.87 · the body down off the floor 1.47–2.37 · the −x foot down beside it 1.85–2.35 · ends standing on the road (shift). The body is raised by the floor (VAN.floor) until it steps down: start it with { snap: true }` }, SDB.T),
  vanEntry({ name: 'van_step_down', dur: SDF.D, shift: SDF.shift, blendIn: .05,
    note: "cleaner B at the lip of the bay, facing out (the body raised by the floor): the +x foot over the lip and down to the road toe first 0.2–0.72 s · the body down 0.32–1.22 · the −x foot down 0.7–1.2 · two steps on 1.2–1.95 · ends standing on the road (shift). Start it with { snap: true }" }, SDF.T),
  vanEntry({ name: 'bag_in', dur: BI.D, shift: [0, BI_A.end.mz], blendIn: .35, pair: { with: 'bag_in_front', gap: CARRY_GAP, delay: 0, face: 'away' }, extra: { van: VAN, bagIn: BAG_IN },
    note: `from the carry (carry_back / carry_front stopped in step), at the van's tail: B's toes at the lip (${f(BI.lip)} m ahead of A). B steps up into the bay 0.4–1.25 s and both walk it in ${BI_A.end.mz - .57} m by 2.95 (A on the road, the feet end raised: the bag level, its bottom ${f(LIFT.rise + VAN.floor)} m up) · set down on the floor 2.95–3.5 · B lets go 3.45–3.75 · A pushes it on 3.9–4.75 (the feet end in over the lip), lets go 4.75–5.05 · A ends standing at the tail (shift); the bag rests in the bay at bagIn.rest (prop: body_bag)` }, bagInA, 'bag_in'),
  vanEntry({ name: 'bag_in_front', dur: BI.D, hold: true, blendIn: .35,
    note: "cleaner B, bag_in's partner (CARRY_GAP ahead, its back to the bag, the head loops in its hands behind it): up onto the floor (the +x foot first) 0.4–1.25 s, three steps in pulling 1.45–3.1 · crouches to set it down 2.95–3.5, lets go 3.45–3.75 · two steps on to the front of the bay 3.6–4.4, a look back · holds standing in the bay (the stage hides it)" }, bagInB, null),
  vanEntry({ name: 'van_in', dur: VIN.D, hold: true, blendIn: .25, extra: { van: VAN },
    note: `a cleaner on the road facing the van's tail, toes at the lip (${VI.lip} m ahead), in line with the doorway: the +x hand on the jamb 0.1–1.25 s · the +x foot up onto the floor 0.15–0.6 · the body up 0.35–1.0 · the −x foot up 0.55–1.0 · two steps in, out of sight 1.15–2.3 · holds (the stage hides it)` }, VIN.T),
  vanEntry({ name: 'van_in_close', dur: VINC.D, hold: true, blendIn: .25, extra: { van: VAN, doors: VINC.doors },
    note: "the last one in: up onto the floor as van_in (the hand on the jamb) 0.1–1.25 s · a step in 1.15–1.75 · turns round to face out 1.75–2.35 · both hands out to the leaves 2.2–2.5 and pulls them to 2.5–3.25: doors(t), the doors' open value the clip asks for (1 → 0) · holds facing out (the stage hides it once the doors are shut)" }, VINC.T),
];
