// HANDS + GRIPS (construction only). The hands are drawn last in compose() so nothing eats them. A free hand is a mitten with a
// thumb; a GRIPPING hand is a closed FIST around a channel, and a held trait passes THROUGH that channel (world/fresh/README.md § Held).
//
// Rest frame = chars.js voxels, arms hanging. Each hand is the box x 5..7 (the +x hand) or x −8..−6 (the −x hand: the mirror
// x → −1 − x), y 6..9, z −2..1, its thumb at the inner column, z 2. Everything here is given for the +x hand; mirror() gives the other.
//
// THE GRIP ANCHOR: the inside of the closed fist. The fist is the hand's box with one straight run of cells left open through it, the
// CHANNEL, along the pose's grip axis:
//   axis 'z' (front to back): x 6, y 7, z −2..1 · the fingers wrap it below (y 6) and outside (x 7), the palm above (y 8..9), the
//            thumb closes over its front end (x 5..6, y 8, z 2)
//   axis 'x' (side to side): x 5..7, y 7, z −1 · the fingers wrap it in front (z 0..1) and below (y 6), the palm behind (z −2) and
//            above (y 8..9), the thumb at the inner front (x 5, y 7..8, z 2)
// A held trait fills every channel cell, so from outside it goes into the fist on one face and comes out of the opposite one.
//
// THE HOLD POSES (HOLD): the arm pose the walk shader compiles (style/city/anim/grip.js → GRIP_GLSL). The baked body carries a look's
// hold in aPart's fraction. Named by geometry only:
//   down     one hand down at the side, the arm rolled out from the leg, a shorter, late swing (the hang rule)
//   forward  one hand forward, the arm pitched ahead of the hip, half the walk's swing
//   both     two hands in front, both arms pitched forward as one, no swing (the thing between them rides both arms as one piece)
//   raised   one hand raised in front of the chest, out from the head, barely swinging
// pose: [pitch forward, roll out, yaw in, twist in] of the one-piece arm at the shoulder (rad). swing: the share of the walk's arm
// swing kept · armOut: keep the walk's outward tilt (0/1) · lag: extra swing lag (share of the cycle) · hands: 1 (the +x hand) or 2 ·
// axis: the channel's axis · busy: the idles that hand can't do (grip.js swaps them for the one given) · elbow: the gripping arm's
// elbow bend (rad, default 0 = straight; style/city/anim/ELBOW.md). grip.js SETS it, so the walk's elbow swing never bends a gripping
// arm; a two-hand hold gives both arms the same elbow, so the thing between them rides both forearms as one piece. The envelopes and
// budgets below are measured at these elbows (held-motion-check): a hold that changes its elbow is re-measured.
export const HAND = { x0: 5, x1: 7, y0: 6, y1: 9, z0: -2, z1: 1 };   // inclusive, the +x hand
export const HOLD = {
  none:    { id: 0 },
  down:    { id: 1, hands: 1, axis: 'z', pose: [.04, .24, 0, 0], swing: .55, armOut: 1, lag: .05, elbow: 0 },
  forward: { id: 2, hands: 1, axis: 'z', pose: [.62, .28, 0, 0], swing: .3, armOut: 1, elbow: 0 },
  both:    { id: 3, hands: 2, axis: 'x', pose: [1.25, 0, 0, 0], swing: 0, armOut: 0, elbow: 0 },
  raised:  { id: 4, hands: 1, axis: 'z', pose: [1.0, .06, -.45, 0], swing: .08, armOut: 0, elbow: 0 },
};
export const HOLDS = Object.keys(HOLD);   // by id
export const POSES = HOLDS.filter(k => k !== 'none');
export const mirror = x => -1 - x;
const CH_Z = { x: 6, y: 7, z: [-2, -1, 0, 1] }, CH_X = { x: [5, 6, 7], y: 7, z: -1 };
// the channel cells of the +x hand for an axis, and of every gripping hand for a pose
export const channelOf = axis => axis === 'x' ? CH_X.x.map(x => [x, CH_X.y, CH_X.z]) : CH_Z.z.map(z => [CH_Z.x, CH_Z.y, z]);
export const gripCells = pose => { const h = HOLD[pose]; if (!h || !h.axis) return []; const c = channelOf(h.axis);
  return h.hands === 2 ? [...c, ...c.map(([x, y, z]) => [mirror(x), y, z])] : c; };

// BUDGETS for a held trait, in rest voxels for the +x hand (inclusive). ENVELOPE: every voxel and fine voxel lies inside it (a two-hand
// pose: x is the span between the two hands). It is measured: style/city/anim/held-motion-check.mjs poses the WHOLE envelope of each
// pose (base-kit.js FIXTURES.held) through the walk, turns and every idle, and it clears the torso, the legs, the shoes, the head and
// the other arm. Inside a hand's box only the channel is the held trait's; the fist owns the rest.
export const ENVELOPE = {
  down:    { x: [5, 8], y: [2, 8], z: [-4, 3] },   // the hang: down to y 2 (4 below the fist), never inward of the hand's inner face
  forward: { x: [5, 8], y: [5, 8], z: [-3, 4] },
  both:    { x: [-8, 7], y: [4, 8], z: [-1, 2] },   // the span between the fists; nothing past their outer faces
  raised:  { x: [5, 8], y: [6, 8], z: [-2, 4] },   // along the channel: up past the fist (+z) when raised, nothing hanging
};
export const BUDGET = { voxels: 120, finePaint: 64, fineVoxels: 32, clearance: 1 };   // clearance: voxels kept from the leg's outer column at rest (one-hand poses)
export const inEnvelope = (pose, x, y, z) => { const e = ENVELOPE[pose]; if (!e) return false;
  return x >= e.x[0] && x <= e.x[1] && y >= e.y[0] && y <= e.y[1] && z >= e.z[0] && z <= e.z[1]; };
export const inHand = (x, y, z) => { const X = x < 0 ? mirror(x) : x; return X >= HAND.x0 && X <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1 && z >= HAND.z0 && z <= HAND.z1; };

// a look's hold: chars.js registers each held trait's pose (registerHeld), so this file needs no registry import
const POSE_OF = new Map();
export const registerHeld = (id, pose) => POSE_OF.set(id, pose);
export const poseOf = L => { const id = L && L.held && L.held.id; if (!id || id === 'none') return 'none'; if (id.startsWith('base:')) { const p = id.slice(5); return HOLD[p] ? p : 'none'; } return POSE_OF.get(id) || 'none'; };
export const holdOf = L => HOLD[poseOf(L)];
export const holdId = L => holdOf(L).id;
// which hands grip: [the −x hand, the +x hand]
export const gripping = L => { const h = holdOf(L); return [h.hands === 2, h.hands >= 1]; };

// the hands: a mitten on a free hand, a fist round the channel on a gripping one (y 6 is the fingers' row, a shade down)
export function hands(B, sk, L) {
  const lay = sk.layer, g = gripping(L), axis = holdOf(L).axis;
  for (const [side, x0, tx] of [[0, -8, -6], [1, 5, 5]]) {
    const m = x => side ? x : mirror(x);   // +x hand coordinates → this hand
    if (!g[side]) { B.box(x0, 6, -2, x0 + 3, 10, 2, sk.c, lay); B.set(tx, 7, 2, sk.c(tx, 7, 2), lay); B.set(tx, 8, 2, sk.c(tx, 8, 2), lay);
      for (let x = x0; x < x0 + 3; x++) B.set(x, 6, 1, sk.sh(x, 6, 1), lay); continue; }
    const open = new Set(channelOf(axis).map(([x, y, z]) => m(x) + ',' + y + ',' + z));
    const finger = (X, y, z) => axis === 'x' ? (z >= 0 && y <= 7) || y === 6 : y === 6 || (X === 7 && y === 7);   // (X: +x-hand column)
    for (let X = 5; X <= 7; X++) for (let y = 6; y <= 9; y++) for (let z = -2; z <= 1; z++) { const x = m(X); if (open.has(x + ',' + y + ',' + z)) { B.del(x, y, z); continue; }
      B.set(x, y, z, finger(X, y, z) ? sk.sh(x, y, z) : sk.c(x, y, z), lay); }
    const thumb = axis === 'x' ? [[5, 7, 2], [5, 8, 2]] : [[5, 7, 2], [5, 8, 2], [6, 8, 2]];
    for (const [X, y, z] of thumb) B.set(m(X), y, z, sk.c(m(X), y, z), lay);
  }
}
// chars.js build() (the static rig: thumbnails, the photo booth): a gripping arm takes its hold pose (an inner group carries it, so
// pose()'s swing on the outer group still composes). The rotation is grip.js / idle.js aArmRot's: RY(−s·yaw) RZ(s·roll) RX(−pitch) RY(−s·twist)
// about the shoulder (s = ±1, the arm's side), the shader's own order.
export function holdArm(THREE, L, n, g, part, pv, meshes) {
  if (n !== 'armL' && n !== 'armR') return false;   // only the arms take a hold (build() calls this for the legs too)
  const h = holdOf(L), side = n === 'armR' ? 1 : 0; if (!h.hands || !gripping(L)[side]) return false;
  const s = side ? 1 : -1, [p, r, yw, tw] = h.pose, M = new THREE.Matrix4(), T = new THREE.Matrix4(), sh = [s * 5, 16.5, 0];
  M.makeRotationY(-s * yw).multiply(T.makeRotationZ(s * r)).multiply(T.makeRotationX(-p)).multiply(T.makeRotationY(-s * tw));
  const inner = new THREE.Group(); inner.position.set(sh[0] - pv[0], sh[1] - pv[1], sh[2] - pv[2]); inner.setRotationFromMatrix(M); g.add(inner);
  for (const m of meshes(part, inner, 0)) m.position.set(-sh[0], -sh[1], -sh[2]);
  return true;
}
// chars.js pose(): the share of the walk's arm swing each arm keeps ([−x arm, +x arm]; null: both swing fully)
export const holdSwing = L => { const h = holdOf(L); if (!h.hands) return null; const g = gripping(L); return [g[0] ? h.swing : 1, g[1] ? h.swing : 1]; };
