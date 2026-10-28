// CLIPS · work (activities; MOVEMENT.md §6–§7A; the work animation agent, 2026-10-08). Five loops that keep a worker busy at a spot:
//   dig_pick     1.8 s  a pickaxe: lift to shoulder height in front, a beat, the chop straight down, impact 0.65 m ahead, a recoil, a breath
//   dig_shovel   2.4 s  a short shovel: the stab, a foot up on the blade pushes it down, a deep-crouch lever, the blade swings up to the +x
//                       side dish up, a flick tosses the load (the blade turns over), back to ready
//   carry_box    2.0 s  MOVING (0.85 m/s, the walk's legs): a box hugged at the chest, the forearms along its sides; a hitch, glances
//   stock_shelf  3.6 s  the +x hand takes a product box from a crate at the hip, lifts it up and out onto a shelf at chest height, lets go;
//                       a weight shift and a look along the shelf
//   sweep        2.4 s  a broom held in front, two short strokes right to left with the bristles on the ground, a small step between
// Every loop is seamless at D (each channel is keyed back to its start; no rhythm that doesn't divide D) and fine from any frame: the
// city starts each worker at a different time.
//
// THE TOOLS are props (CLIPS.md § Props): one voxel model per object in work-tools.js (pickaxe, shovel, broom, box, item), posed by the
// clip's clock: `prop.matrix(THREE, t, out, g)` is the tool's local → walker matrix (× the walker's world matrix, as the skateboard).
// carry_box's box rides the CHEST: pass the walker's gait state g (gait2.js; the city has it in the gait hook) and the box follows the
// walk's pelvis bob and roll and the turn's lean exactly; without g (the lab's live preview, which passes only t) it assumes the
// pelvis at its mean height and drifts up to ~2 cm off the hands as the pelvis bobs (the sheets and the webm pass g). stock_shelf's item is hidden (`pose(t).show` < 0.5, collapsed in the matrix) between the shelf and
// the next grab. The lab draws one prop per clip (lab.js drawProps); nothing here needs a lab change.
//
// THE HANDS ON THE TOOL: the track (below) is written once as expressions valid in GLSL and JS (CLIPS.md: the skateboard's way). The JS
// side evaluates it for the tool's matrix; the GLSL side poses the body from it and puts each hand on the tool with a two-bone IK on the
// elbow (ELBOW.md: cArm with the elbow): the elbow bend gives the reach, then the shoulder's turn takes the bent arm's grip point (the
// mitten's centre, rigid on the forearm) onto the target, the elbow toward a pole. So the hands cannot drift off the tool: measured on
// the real shader (transform feedback, the cast's elbow compiled in), hand to handle ≤ 6 mm on every clip and look (0 on most).
// THE TOON ARM reaches only 0.403–0.453 m from the shoulder (the upper arm is 0.175 m, the forearm and hand 0.275 m; elbows stay ≤ 83°,
// under the thick sleeve's soft cap, so every top bends alike). Everything below is built around that shell:
//   · a grip along a handle SLIDES to the nearest place the arm reaches (a pick's top hand slides as it would); the poses were searched
//     so both hands stay on their part of the handle, ≥ 0.15 m apart (the mittens are 0.15 wide)
//   · the shovel and the broom are short (0.75 / 0.825 m): a full-length shaft puts the grip in the chest
//   · the shovel's foot push is one-handed (the −x hand on the T-grip, the +x hand on the knee): no pose keeps both hands on a shaft that
//     low with the blade in front of the +x foot; the lever after it is a deep crouch (drop 0.2) so the +x hand reaches the shaft
//   · the box hangs 0.31 m out from the chest's rest frame (clear of every puffer, whose fronts reach 0.30); the fur coat (0.35) brushes it
//   · puffy tops and hoodies: at the pick's strike the lower hand presses into the jacket front (the handle ends inside the fist, so it is
//     the hand, not the tool): the arms can't hold the grip any further out
//   · stock_shelf's "small step to the side" is a weight shift with the +x foot lifted and set back: cFoot moves a foot only along z
// The right elbow's pole points out and down (the forearm clears the handle's top by the other hand).
import { TOOL, toolGeometry, toolMatrix } from './work-tools.js';
import { WALK2, R2, buildGait, table, LEVELS } from '../gait2.js';

const f = v => (+v).toFixed(4), PI = Math.PI;
// ── the rig (walk2.js; chars.js voxels × 0.05): the shoulder pivot, the elbow's hinge line, the hand's grip point (the mitten's centre,
// where a handle passes through it), all in the arm's rest frame (hanging)
const SH = { x: .25, y: .825 }, HINGE = { y: .65, z: .05 }, GRIP = { x: .325, y: .39, z: 0 }, ELB = { y: .65 };
// the reach of the bent arm: |grip − shoulder|² = A + B cos(e − φ) (e: the elbow's bend). The IK uses the branch e ≥ φ (the elbow
// visibly bent) up to EMAX = 1.45 rad (83°): below the thick sleeve's soft cap (85°, elbow/styles/thick.js), so every top bends the same
const gx = GRIP.x - SH.x, hy = HINGE.y - SH.y, hz = HINGE.z, gy = GRIP.y - HINGE.y, gz = GRIP.z - HINGE.z;
const RA = gx * gx + hy * hy + hz * hz + gy * gy + gz * gz, Bc = 2 * (hy * gy + hz * gz), Bs = 2 * (hy * gz - hz * gy), RB = Math.hypot(Bc, Bs), PHI = Math.atan2(Bs, Bc);
export const EMAX = 1.45;
export const REACH = { min: Math.sqrt(RA + RB * Math.cos(EMAX - PHI)), max: Math.sqrt(RA + RB), phi: PHI };

// ── shared expressions (valid GLSL and valid JS): the helpers of clips/index.js CLIP_HELPERS and GLSL's mix / clamp / sin…
const JS = (() => { const cl = (x, a, b) => Math.min(b, Math.max(a, x)), cR = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  return { cR, cS: (t, a, b) => { const x = cR(t, a, b); return x * x * (3 - 2 * x); }, cOut: (t, a, b) => { const x = cR(t, a, b); return 1 - (1 - x) * (1 - x); },
    cIn: (t, a, b) => { const x = cR(t, a, b); return x * x; }, cBack: (t, a, b) => { const x = cR(t, a, b) - 1; return 1 + x * x * (2.7 * x + 1.7); },
    cBump: (t, a, b) => Math.sin(PI * cR(t, a, b)), mix: (a, b, k) => a + (b - a) * k, clamp: cl, sin: Math.sin, cos: Math.cos, abs: Math.abs,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, mod: (x, y) => x - y * Math.floor(x / y), step: (e, x) => x < e ? 0 : 1, smoothstep: (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); } }; })();
// a keyed channel: [[t, v, ease?], …] → one expression (eased steps added up; ease of the segment that ENDS at the key: cS, cIn, cOut, cR, cBack)
export function keys(K, T = 't') { let s = f(K[0][1]); for (let i = 1; i < K.length; i++) { const d = K[i][1] - K[i - 1][1]; if (Math.abs(d) < 1e-9) continue; s += ` + ${f(d)} * ${K[i][2] || 'cS'}(${T}, ${f(K[i - 1][0])}, ${f(K[i][0])})`; } return `(${s})`; }

// ── THE TRACK of a work clip: written once, read by both sides
//   vars   [[name, expr], …]  scalars the rest may use (in order)
//   body   { tx, ty, tz, drop, bx, pr }  the torso's pitch / yaw / roll, the pelvis drop, the hips' sway, the pelvis roll (ABSOLUTE)
//   feet   { zL, lL, fL, zR, lR, fR }    cFoot of each foot (standing clips; a moving clip walks on the walk's legs)
//   tool   { x, y, z, az, el, sp, px, py, pz, show }  work-tools.js toolMatrix's pose: the tool's point (px, py, pz) of its own frame
//          goes to (x, y, z) (the walker's body frame, or the chest's rest frame: `frame: 'chest'`)
//   hands  [L, R]: { s: expr (a grip along the handle, m from its butt: the hand slides to the nearest place it reaches) | pt: [x, y, z]
//          (a point of the tool's frame), pole: [x, y, z] (where the elbow points, chest frame), k: expr (1 = on the tool; toward 0 the
//          arm goes to `free`: [pitch, roll, yaw, twist, elbow], cArm's angles, or stays as the walk / the stand left it) }
//   root   { ry, cx, cz, mx, mz }  the whole body's yaw about the ground point (cx, cz) and its move (CLIPS.md: cRot.y, cPiv, cMov): a pivot step
//   head   { hx, hy }  where the eyes look: pitch (+ down) and yaw in the body frame (the head is posed relative to the chest: P.head = this − torso)
const FIELDS = { body: ['tx', 'ty', 'tz', 'drop', 'bx', 'pr'], feet: ['zL', 'lL', 'fL', 'zR', 'lR', 'fR'], tool: ['x', 'y', 'z', 'az', 'el', 'sp', 'px', 'py', 'pz', 'show'], root: ['ry', 'cx', 'cz', 'mx', 'mz'], head: ['hx', 'hy'] };
const D0 = { tz: '0.', bx: '0.', pr: '0.', show: '1.', hx: '0.', hy: '0.' };
function jsTrack(T, dur, loop) {
  const ks = Object.keys(JS), vals = ks.map(k => JS[k]), g = (grp) => `{ ${FIELDS[grp].map(k => `${k}: ${T[grp]?.[k] ?? D0[k] ?? '0.'}`).join(', ')} }`;
  const hand = h => `{ ${h.s !== undefined ? `s: ${h.s}` : `pt: [${h.pt.join(', ')}]`}, k: ${h.k ?? '1.'}, pole: [${h.pole.join(', ')}] }`;
  const src = `${(T.vars || []).map(([k, e]) => `const ${k} = ${e};`).join(' ')} return { body: ${g('body')}, feet: ${T.feet ? g('feet') : 'null'}, tool: ${g('tool')}, root: ${T.root ? g('root') : 'null'}, head: ${g('head')}, hands: [${T.hands.map(hand).join(', ')}] };`;
  const fn = new Function(...ks, 't', 'D', 'u', 'w', src);
  return (t, u = 0, w = 0) => fn(...vals, loop ? JS.mod(Math.max(t, 0), dur) : Math.max(t, 0), dur, u, w);
}
// the GLSL: the body, the feet, the root, the head, any extra lines, then THE HANDS ON THE TOOL (two-bone IK per arm)
function glslTrack(T, extra = '') {
  const v = (grp, k) => T[grp]?.[k] ?? D0[k] ?? '0.', hs = T.hands;
  const hsel = (fn) => `s == 0 ? ${fn(hs[0])} : ${fn(hs[1])}`;
  const chest = T.frame === 'chest';
  return /* glsl */`
  ${(T.vars || []).map(([k, e]) => `float ${k} = ${e};`).join(' ')}
  P.torso = vec3(${v('body', 'tx')}, ${v('body', 'ty')}, ${v('body', 'tz')}); P.drop = ${v('body', 'drop')}; P.pRoll = ${v('body', 'pr')};
  P.bodyX = ${v('body', 'bx')};   // (absolute: a moving clip takes the walk's hip sway off too, so the chest carries its prop steadily)
  ${T.feet ? `cFoot(P, 0, ${v('feet', 'zL')}, ${v('feet', 'lL')}, ${v('feet', 'fL')}); cFoot(P, 1, ${v('feet', 'zR')}, ${v('feet', 'lR')}, ${v('feet', 'fR')});` : ''}
  ${T.root ? `cRot.y = ${v('root', 'ry')}; cPiv = vec3(${v('root', 'cx')}, 0., ${v('root', 'cz')}); cMov = vec3(${v('root', 'mx')}, 0., ${v('root', 'mz')});` : ''}
  P.head.x = ${v('head', 'hx')} - P.torso.x; P.head.y = ${v('head', 'hy')} - P.torso.y;
  ${extra}
  { // THE TOOL (work-tools.js toolMatrix: the same pose) and the hands on it
    mat3 wkR = aRY(${v('tool', 'az')}) * aRX(1.5707963 - (${v('tool', 'el')})) * aRY(${v('tool', 'sp')});
    vec3 wkB = vec3(${v('tool', 'x')}, ${v('tool', 'y')}, ${v('tool', 'z')}) - wkR * vec3(${v('tool', 'px')}, ${v('tool', 'py')}, ${v('tool', 'pz')});   // the tool's origin
    ${T.root ? `mat3 wkQ = transpose(aRY(cRot.y)); wkB = cPiv + wkQ * (wkB - cPiv - cMov); wkR = wkQ * wkR;   // (under the clip's root: clips/index.js clipRoot)` : ''}
    ${chest ? '' : `// the walker's body frame → the chest's rest frame (walk2.js: the standing pelvis, then the chest's turn about it)
    float wkL = (A_L1 + A_L2) * .998, wkSr = sin(P.pRoll) * A_HIPX;
    float wkHip = min(A_HIPY - P.drop, min(P.ank.y + sqrt(max(wkL * wkL - P.ank.x * P.ank.x - P.bodyX * P.bodyX, 0.)) + wkSr, P.ank.w + sqrt(max(wkL * wkL - P.ank.z * P.ank.z - P.bodyX * P.bodyX, 0.)) - wkSr));
    mat3 wkMt = transpose(aRZ(P.torso.z + .5 * P.pRoll) * aRX(P.torso.x) * aRY(P.torso.y));
    wkB = vec3(0., A_HIPY, A_HIPZ) + wkMt * (wkB - vec3(P.bodyX, wkHip, A_HIPZ)); wkR = wkMt * wkR;`}
    vec3 wkD = wkR[1];   // the handle's direction (the tool's +y)
    for (int s = 0; s < 2; s++) {
      float sx = s == 0 ? -1. : 1.;
      vec3 wkS = vec3(sx * A_SHX, A_SHY, 0.), wkH = s == 0 ? vec3(${hs[0].pole.join(', ')}) : vec3(${hs[1].pole.join(', ')}), wkT;
      float wkK = ${hsel(h => h.k ?? '1.')};
      ${hs.map((h, i) => h.free ? `if (s == ${i}) cArm(P, ${i}, vec4(${h.free.slice(0, 4).join(', ')}), ${h.free[4] ?? '0.'}, 1.);` : '').join(' ')}
      ${hs.map((h, i) => `${i ? 'else ' : ''}if (s == ${i}) ${h.s !== undefined ? `{ // a grip along the handle: the place nearest the wanted one (s) at a distance the arm reaches
        float wkSa = ${h.s}; vec3 w0 = wkB - wkS; float wd = dot(w0, wkD), wr = clamp(length(w0 + wkSa * wkD), ${f(REACH.min)}, ${f(REACH.max)});
        float wq = sqrt(max(wd * wd - dot(w0, w0) + wr * wr, 0.)), s1 = -wd + wq, s2 = -wd - wq; wkT = w0 + (abs(s1 - wkSa) < abs(s2 - wkSa) ? s1 : s2) * wkD; }`
        : `wkT = wkB + wkR * vec3(${h.pt.join(', ')}) - wkS;   // a point of the tool`}`).join('\n      ')}
      // the elbow from the reach, then the arm's turn that takes the bent rest arm's grip onto the target, the elbow toward the pole
      float wr2 = clamp(dot(wkT, wkT), ${f(REACH.min ** 2)}, ${f(REACH.max ** 2)}), we = ${f(PHI)} + acos(clamp((wr2 - ${f(RA)}) / ${f(RB)}, -1., 1.)), wc = cos(we), ws = sin(we);
      vec3 wv = vec3(sx * ${f(gx)}, ${f(hy)} + wc * ${f(gy)} + ws * ${f(gz)}, ${f(hz)} - ws * ${f(gy)} + wc * ${f(gz)}), wl = vec3(sx * ${f(gx)}, ${f(ELB.y - SH.y)}, 0.);
      vec3 e1 = normalize(wv), e2 = normalize(wl - dot(wl, e1) * e1), f1 = normalize(wkT), f2 = normalize(wkH - dot(wkH, f1) * f1);
      mat3 wR = mat3(f1, f2, cross(f1, f2)) * transpose(mat3(e1, e2, cross(e1, e2)));
      // R = Rz(a) Rx(b) Ry(c) (idle.js aArmRot with no yaw), the branch with |a| ≤ π/2
      float wb = asin(clamp(wR[1][2], -1., 1.)), wa = atan(-wR[1][0], wR[1][1]), wcc = atan(-wR[0][2], wR[2][2]);
      if (abs(wa) > 1.5707963) { wa -= sign(wa) * 3.14159265; wb = (wb >= 0. ? 3.14159265 : -3.14159265) - wb; wcc += wcc > 0. ? -3.14159265 : 3.14159265; }
      cArm(P, s, vec4(-wb, sx * wa, 0., -sx * wcc), we, wkK);
    }
  }`;
}
// the chest's rest frame → the walker's body frame (walk2.js), for a tool carried in the chest frame (carry_box). g: the walker's gait
// state (gait2.js; the city passes it): the walk's pelvis height and roll and the turn's lean (the clip sets the hips' sway itself).
// Without it (the lab's preview) a steady walk at the clip's speed is assumed: the pelvis at its mean height, no roll.
let GAIT = null; const gaitOf = () => GAIT || (GAIT = buildGait(WALK2));
const pyMean = (a) => { const G = gaitOf(); let s = 0; for (let j = 0; j < 64; j++) s += table(G, G.pt, a, j / 64); return s / 64; };
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
// the clip entry's prop (CLIPS.md § Props): the tool's model and its pose at the clip clock t (a loop wraps it itself). matrix takes the
// walker's gait state g as a 4th argument (a chest-frame tool needs it; the others ignore it). track(t) gives the whole shared track.
function propOf(id, T, dur, loop, speed = 0) {
  const tr = jsTrack(T, dur, loop), chest = T.frame === 'chest', aRef = .4 + .6 * Math.min(1, speed / WALK2.vRef);
  let pym = null;
  const pose = t => { const r = tr(t), p = r.tool; return { x: p.x, y: p.y, z: p.z, az: p.az, el: p.el, sp: p.sp, piv: [p.px, p.py, p.pz], show: p.show }; };
  return { id, tool: id, frame: chest ? 'chest' : 'body', geometry: (THREE) => toolGeometry(THREE, id), pose, track: tr,
    matrix(THREE, t, out = new THREE.Matrix4(), g = null) { const r = tr(t, g?.u ?? 0, g?.w ?? 0);
      toolMatrix(THREE, pose(t), out); if (!chest) return out;
      if (!g && pym === null) pym = pyMean(Math.min(1, Math.max(LEVELS[0], aRef)));
      const M = chestMatrix(THREE, { ...r.body, pyMean: pym }, g, new THREE.Matrix4()); return out.premultiply(M); } };
}
function clip(o) {
  const T = o.track, glsl = glslTrack(T, o.glsl || '');
  return { name: o.name, dur: o.dur, loop: true, blendIn: o.blendIn ?? .3, blendOut: o.blendOut ?? .3, moving: !!o.moving, speed: o.speed || 0, note: o.note,
    prop: propOf(o.tool, T, o.dur, true, o.speed || 0), glsl };
}

// ═══ the clips
// DIG_PICK (1.8 s loop): the pick planted in the ground at t 0 (the breath's end) · a pry, the handle pressed down 0–0.18 · the lift
// 0.18–0.66: up in front to shoulder height, the head high over the ground ahead (the big head blocks overhead), elbows bent · a beat
// at the top 0.66–0.8 (a little higher, the chest back) · THE CHOP 0.8–0.97: straight down in the handle's own plane, the chest pitches,
// the knees give · impact at 0.97, the tip 0.65 m ahead · the recoil 0.97–1.15 (the tip bounces 3 cm) · a breath 1.15–1.8, the tip in.
// The track keys the LEFT (butt) hand's grip point; the right hand slides along the handle to where it reaches (work.js: the hands).
const PICK_D = 1.8;
const pk = (impact, top) => keys([[0, impact], [.18, impact], [.66, top], [.8, top], [.97, impact, 'cIn'], [PICK_D, impact]]);
const pick = {
  vars: [['rc', 'cBump(t, .97, 1.15)'], ['pr', 'cBump(t, 0., .18)'], ['tp', 'cBump(t, .62, .84)'], ['br', '.5 - .5 * cos(6.2831853 * cS(t, 1.15, 1.8))']],
  body: { tx: `${pk(.35, -.1)} - .03 * tp + .05 * rc - .05 * br`, ty: `${pk(-.1, .2)}`, drop: `${pk(.07, .015)} + .012 * rc - .008 * br` },
  feet: { zL: '.1', lL: '0.', fL: '0.', zR: '-.06', lR: '0.', fR: '0.' },
  tool: { px: '0.', py: '.005', pz: '0.', x: `${pk(.06, .1)}`, y: `${pk(.59, .68)} + .02 * pr + .015 * tp + .02 * rc`, z: `${pk(.29, .26)} - .015 * pr`,
    az: `${pk(.05, .45)}`, el: `${pk(-.5, 1.)} - .06 * pr + .05 * tp + .05 * rc`, sp: '0.' },
  hands: [{ s: '.005', pole: ['-1.', '0.', '-.3'] }, { s: '.19', pole: ['1.', '-.7', '0.'] }],
};
pick.head = { hx: `${pk(.25, -.12)} + .08 * rc`, hy: `.1 * cBump(t, .2, .7) + .4 * ${pk(-.1, .2)}` };

// DIG_SHOVEL (2.4 s loop): ready, both hands on, the blade over the ground ahead (t 0) · the stab 0–0.3: the −x hand drives it in on
// the T-grip, the +x hand comes off to the knee · the +x foot steps up onto the blade's top edge 0.35–0.55 and pushes it down 0.55–0.8
// (the toon arms can't keep both hands on a shaft that low: one hand presses the grip, the other the knee) · the foot down, a deep
// crouch, the +x hand back on the shaft, the lever 0.8–1.05 · the blade breaks out and swings up to the +x side, dish up 1.05–1.45 ·
// the toss 1.45–1.72: on up, a flick, the blade turns over · back to ready 1.72–2.4. The track keys the T-grip (the −x hand); the +x
// hand slides along the shaft to where it reaches.
const SH_D = 2.4, ST = TOOL.shovel;
// keys: ready (0) · stab (0.3, held to 0.55) · pushed (0.8) · levered (1.05) · breaking out (1.25) · lift (1.45) · toss (1.72) · ready
const sh = (ready, stab, push, lever, brk, lift, toss) => keys([[0, ready], [.3, stab, 'cIn'], [.55, stab], [.8, push], [1.05, lever], [1.25, brk], [1.45, lift], [1.72, toss], [SH_D, ready]]);
const shovel = {
  vars: [['fo', 'cS(t, .33, .5) * (1. - cS(t, .8, .95))'], ['fz', 'cS(t, .38, .55) * (1. - cS(t, .8, .95))'], ['kr', 'cS(t, 1.08, 1.25) * (1. - cS(t, 1.95, 2.15))']],
  body: { tx: sh(.25, .3, .33, .2, .1, 0., .1), ty: sh(0., 0., 0., -.15, 0., -.2, .4), drop: sh(.06, .06, .09, .2, .1, .04, .04), bx: '-.03 * fo', pr: '-.04 * fo' },
  feet: { zL: '.06', lL: '0.', fL: '0.', zR: 'mix(-.04, .22, fz)', lR: `fo * (${keys([[0, .175], [.55, .175], [.8, .065]])} + .03 * cBump(t, .35, .55)) + .07 * cBump(t, .8, .97)`, fR: '0.' },
  tool: { px: '0.', py: f(ST.grip[1]), pz: '0.',
    x: sh(0., 0., 0., 0., 0., -.15, .15), y: sh(.7, .65, .54, .57, .65, .6, .7), z: sh(.38, .39, .39, .37, .36, .35, .35),
    az: sh(0., 0., 0., 0., .9, 1.2, 1.5), el: sh(-1.35, -1.45, -1.45, -1.3, -.4, .2, .45), sp: sh(0, 0, 0, 0, 1.5, 3.14, 4.7) },
  hands: [{ s: '.012', pole: ['-1.', '-.3', '-.3'] }, { s: sh(.2, .2, .2, .18, .18, .26, .22), k: 'kr', pole: ['.6', '-1.', '0.'], free: ['.5', '.6', '0.', '.2', '.5'] }],
};
shovel.head = { hx: sh(.35, .45, .5, .4, .25, .1, .05), hy: sh(.05, .05, .1, 0., .3, .4, .6) };

// CARRY_BOX (2 s loop, MOVING at 0.85 m/s: the walk's legs): the box hugged at the chest, the forearms along its sides (elbows bent
// ~60°), the hands on its sides; the chest a touch back against the weight · a hitch 0.9–1.3 (the box bumped up 3 cm and re-gripped) ·
// the head over the box: a glance left 0.2–0.8, right 1.3–1.9. The box rides in the CHEST frame (prop.matrix takes the walker's gait
// state: its pelvis height, sway and roll move the box with the chest). Its back face is 0.31 m out from the chest's rest frame: clear of
// every puffer (their fronts reach 0.30); the fur coat's fur (0.35) brushes it (the arms reach no further: 0.45 m from the shoulder).
const CARRY_D = 2, BX = TOOL.box;
const carry = { frame: 'chest',
  vars: [['hi', 'cBump(t, .9, 1.3)']],
  body: { tx: '-.07 + .02 * hi', ty: '.03 * sin(6.2831853 * t / 2.)', drop: '.01' },
  tool: { px: '0.', py: '0.', pz: '0.', x: '0.', y: `.6 + .03 * hi`, z: f(.31 + BX.d / 2), az: '0.', el: '1.5707963', sp: '0.' },   // (the bottom at chest y 0.6, the top 0.9: under the chin)
  hands: [{ pt: [f(-BX.w / 2 - .075), '.12 - .03 * hi', '0.'], pole: ['-.6', '-1.', '-.4'] }, { pt: [f(BX.w / 2 + .075), '.12 - .03 * hi', '0.'], pole: ['.6', '-1.', '-.4'] }],
};
carry.head = { hx: '-.04 + .05 * hi', hy: '-.35 * cBump(t, .2, .8) + .35 * cBump(t, 1.3, 1.9)' };

// STOCK_SHELF (3.6 s loop): a reach down to a crate at the +x hip (0–0.5) · the grab 0.5 (the item appears in the hand) · up and out in an
// arc to a shelf at chest height ahead 0.6–1.2 · pushed in 1.2–1.45 · the hand lets go 1.45–1.7 (the item stays put, then is gone at
// 1.9: the city draws no shelf) · a settle and a look along the shelf · a step to the side 2.2–3.2 (the feet can't move sideways on
// this rig, cFoot is z only: a weight shift onto the −x foot, the +x foot lifted and set back, the chest and eyes along the shelf) ·
// ready for the next 3.2–3.6. The item is in the +x hand; the −x arm hangs, swinging a little (`free`).
const STK_D = 3.6;
const stock = {
  vars: [['g', 'cS(t, .45, .55) * (1. - cS(t, 1.45, 1.7))'], ['ss', 'cS(t, 2.2, 2.6) * (1. - cS(t, 2.8, 3.2))'], ['fl', 'cBump(t, 2.25, 2.55) + cBump(t, 2.85, 3.15)']],
  body: { tx: keys([[0, .05], [.5, .14], [.6, .14], [1.2, 0], [1.45, .02], [1.9, .02], [STK_D, .05]]), ty: keys([[0, .05], [.5, .25], [.6, .25], [1.2, 0], [1.9, 0], [2.4, -.25], [3.0, -.25], [STK_D, .05]]),
    drop: keys([[0, .03], [.5, .09], [.6, .09], [1.2, .01], [1.45, .005], [1.9, .02], [STK_D, .03]]), bx: '-.05 * ss', pr: '-.1 * ss' },
  feet: { zL: '.02', lL: '0.', fL: '0.', zR: '-.02', lR: '.05 * fl', fR: '0.' },
  // the item's place: at the crate, carried up and out in an arc, on the shelf (pushed in), back at the crate before the next grab
  tool: { px: '0.', py: '0.', pz: '0.', x: keys([[0, .4], [.6, .4], [1.2, .15], [1.45, .15], [3.5, .15], [3.55, .4], [STK_D, .4]]),
    y: keys([[0, .45], [.6, .45], [1.2, .76], [1.45, .76], [3.5, .76], [3.55, .45], [STK_D, .45]]),
    z: `${keys([[0, .3], [.6, .3], [1.2, .48], [1.45, .52], [3.5, .52], [3.55, .3], [STK_D, .3]])} + .08 * cBump(t, .6, 1.2)`,
    az: '0.', el: '1.5707963', sp: '0.', show: 'step(.5, t) * step(t, 1.9)' },
  hands: [{ pt: ['-.1', '0.', '0.'], k: '0.', pole: ['-1.', '-.3', '-.3'], free: ['-.1 + .04 * sin(6.2831853 * t / 1.8)', '.45', '0.', '.3', '.15'] },
    { pt: ['.05', '.05', '-.07'], k: 'g', pole: ['1.', '-.3', '-.3'], free: ['.1', '.12', '0.', '.1', '.3'] }],
};
stock.head = { hx: keys([[0, .2], [.5, .45], [.6, .45], [1.2, .05], [1.9, 0], [STK_D, .2]]), hy: '-.5 * ss + .3 * cBump(t, 1.7, 2.2)' };

// SWEEP (2.4 s loop): a broom held in front, the −x hand at the top, the +x hand down the handle · two short strokes (0–0.5 and
// 1.2–1.65): the bristles drag right to left over the ground · each return lifts them a hair and swings back · between, a small step
// (a foot lifted and set down, the weight shifting) · the head down, on the floor.
const SW_D = 2.4;
const sw = (a, b) => keys([[0, a], [.5, b], [.8, a], [1.2, a], [1.65, b], [1.95, a], [SW_D, a]]);
const sweep = {
  vars: [['lf', 'cBump(t, .5, .8) + cBump(t, 1.65, 1.95)'], ['st', 'cBump(t, .8, 1.15)'], ['st2', 'cBump(t, 1.95, 2.35)']],
  body: { tx: '.2 + .02 * cBump(t, 0., .5) + .02 * cBump(t, 1.2, 1.65)', ty: `${sw(.2, -.25)}`, drop: '.045 + .01 * cBump(t, 0., .5) + .01 * cBump(t, 1.2, 1.65)', bx: '.02 * st - .02 * st2', pr: '.05 * st - .05 * st2' },
  feet: { zL: '.03', lL: '.04 * st2', fL: '0.', zR: '-.03', lR: '.04 * st', fR: '0.' },
  tool: { px: '0.', py: f(TOOL.broom.tip[1]), pz: '0.', x: sw(.27, .05), y: '.012 * lf', z: sw(.65, .7), az: sw(.5, .2), el: '-1.15', sp: '0.' },
  hands: [{ s: '.05', pole: ['-1.', '-.3', '-.3'] }, { s: '.23', pole: ['.6', '-1.', '0.'] }],
};
sweep.head = { hx: '.28', hy: sw(.15, -.15) };

export const CLIPS = [
  clip({ name: 'dig_pick', dur: PICK_D, tool: 'pickaxe', track: pick, note: "a loop with a pickaxe (prop: pickaxe): the pick planted at t 0 · a pry 0–0.18 s · the lift 0.18–0.66, up in front to shoulder height, elbows bent · a beat at the top 0.66–0.8 · the chop 0.8–0.97 straight down, the chest pitches and the knees give · impact at 0.97, the tip 0.65 m ahead · a recoil (the tip bounces 3 cm) 0.97–1.15 · a breath to 1.8. The right hand slides along the handle" }),
  clip({ name: 'dig_shovel', dur: SH_D, tool: 'shovel', track: shovel, note: "a loop with a short shovel (prop: shovel): ready, both hands on · the stab 0–0.3 s, the +x hand comes off to the knee · the +x foot up on the blade 0.35–0.55, pushes it down to 0.8 · a deep crouch, the hand back on, the lever 0.8–1.05 · the blade breaks out and swings up to the +x side, dish up, 1.05–1.45 · the toss 1.45–1.72 (the blade turns over) · back to ready by 2.4" }),
  clip({ name: 'carry_box', dur: CARRY_D, tool: 'box', track: carry, moving: true, speed: .85, note: "a MOVING loop at 0.85 m/s (the walk's legs; prop: box, in the chest frame: pass the gait state to prop.matrix): the box hugged at the chest, the forearms along its sides, the chest a touch back · a hitch 0.9–1.3 s (bumped up 3 cm, re-gripped) · glances left 0.2–0.8 and right 1.3–1.9" }),
  clip({ name: 'stock_shelf', dur: STK_D, tool: 'item', track: stock, note: "a loop (prop: item, hidden between the shelf and the next grab): reach down to a crate at the +x hip 0–0.5 s · the grab · up and out to a shelf at chest height 0.6–1.2 · pushed in to 1.45 · let go 1.45–1.7 (the item stays to 1.9) · a look along the shelf · a weight shift onto the −x foot, the +x foot lifted and set back 2.2–3.2 · ready by 3.6" }),
  clip({ name: 'sweep', dur: SW_D, tool: 'broom', track: sweep, note: "a loop with a broom (prop: broom): held in front, the −x hand at the top · a short stroke right to left, the bristles on the ground, 0–0.5 s · the return, lifted a hair, 0.5–0.8 · a small step (the +x foot lifts) 0.8–1.15 · the second stroke 1.2–1.65, return, a step with the −x foot 1.95–2.35 · the head down on the floor" }),
];
