// HELD + GRIP (2026-09-29): every held item sits IN the hand, with a hand shaped for its grip and an arm pose for how it's carried.
// world/chars.js calls heldDraw() where it used to draw HELD[id] then hands(); the ids are the approved ones (nothing renamed), only
// their models are redrawn so the fingers, the thumb and the item line up. Plain data + voxel drawing: no imports (no cycle with chars.js).
//
// GRIPS (the hand's shape) and HOLDS (the arm's pose; anim/grip.js turns HOLD into the walkers' shader, chars.js build() into the
// fit check's static pose). Rest frame = chars.js voxels, arms hanging: right hand x 5..7, y 6..9, z −2..1, thumb (5, 7..8, 2);
// shoulder y 16.5 (x ±5). The arm is one piece, shoulder to hand (SIMPLE ARMS, 2026-09-30: no elbow); items ride it whole.
//   pinch    flat things (phones, a floppy, the mp3, the camera): the item's back against the front of the mitten, the thumb over its
//            face, two fingertips curled round its outer edge
//   fist     things with a handle or a body you close a hand on (can, spray, crowbar, cash, the mouse, the vinyl's base): the item
//            passes THROUGH the mitten, knuckles on the outside, the thumb wrapped over the front
//   hook     bag handles: the handles run through the curled fingers, the bag hangs below and just outside the hand
//   flat     the two-handed carry: both palms flat on the box's ends, thumbs on the lid
// HOLDS: [pitch fwd, roll out, yaw in, twist in] of the one-piece arm at the shoulder (rad; walk2.js's armP / armR / ayaw / atw, idle.js
//   aArmRot) and the walk: swing (share of the walk's arm swing), armOut (keep the walk's outward tilt), both (the left arm too), lag (late swing)
export const HOLD = {
  none:    { id: 0 },
  phone:   { id: 1, pose: [1.5, .04, .3, 0], swing: .12, armOut: 0 },   // the whole arm up forward, the phone under the chin, screen up at the face (= idle.js ARMPOSE.phone + the rest roll)
  side:    { id: 2, pose: [.1, .14, 0, .25], swing: .85, armOut: 1 },          // carried at the side, the arm a touch forward
  hook:    { id: 3, pose: [0, .13, 0, 0], swing: .45, armOut: 0, lag: .06 },   // a bag: arm down, out from the leg, a weighted (late) swing
  carry:   { id: 4, pose: [1.08, 0, 0, 0], swing: 0, armOut: 0, both: 1 },  // two hands: both arms forward, the palms on the box's ends, no swing
  display: { id: 5, pose: [1.4, .2, -.3, 0], swing: .12, armOut: 0 },   // shown off: the arm raised level, out front and a little to the side
  drink:   { id: 6, pose: [.42, .06, .1, 0], swing: .4, armOut: 1 },     // a can in the fist, the arm swung forward
};
export const HOLDS = Object.keys(HOLD);   // by id
// item id → [grip, hold]. Every approved held id (chars.js HELD + Drop 02) is here; an unknown id falls back to chars.js HELD + 'side'.
export const GRIP = {
  flip: ['pinch', 'phone'], phonecase: ['pinch', 'phone'], ipod: ['pinch', 'side'], camera: ['pinch', 'side'], floppydisk: ['pinch', 'side'],
  can: ['fist', 'drink'], spray: ['fist', 'side'], crowbar: ['fist', 'side'], cash: ['fist', 'side'], bricks: ['fist', 'side'], mouse: ['fist', 'side'],
  vinyl: ['fist', 'display'], bodegabag: ['hook', 'hook'], duffel: ['hook', 'hook'], kicksbox: ['flat', 'carry'],
};
export const holdOf = L => { const id = L && L.held && L.held.id; return !id || id === 'none' ? HOLD.none : HOLD[(GRIP[id] || [0, 'side'])[1]]; };
export const holdId = L => holdOf(L).id;

// ── small voxel helpers (chars.js's own, copied: this module imports nothing)
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
function line(G, a, b, c, l = 0) { const n = Math.max(1, ...[0, 1, 2].map(k => Math.abs(b[k] - a[k]))); for (let s = 0; s <= n; s++) G.set(...a.map((v, k) => Math.round(v + (b[k] - v) * s / n)), c, l); }

// ── the hands: chars.js hands() (a mitten with a thumb) for the free hand; a variant per grip for the holding hand(s)
function mitt(B, sk, R) { const L = sk.layer, x0 = R ? 5 : -8, tx = R ? 5 : -6;
  B.box(x0, 6, -2, x0 + 3, 10, 2, sk.c, L); B.set(tx, 7, 2, sk.c(tx, 7, 2), L); B.set(tx, 8, 2, sk.c(tx, 8, 2), L); for (let x = x0; x < x0 + 3; x++) B.set(x, 6, 1, sk.sh(x, 6, 1), L); }
const skin = (B, sk, x, y, z, dark) => B.set(x, y, z, dark ? sk.sh(x, y, z) : sk.c(x, y, z), sk.layer);
const HANDS = {
  // the item's face is at z = f (its back at z 2): the thumb crosses its inner edge onto the face, two fingertips hook its outer edge (x = o)
  pinch(B, sk, o = {}) { const f = o.f ?? 3, xo = o.xo ?? 8, y0 = o.y0 ?? 7;
    B.box(5, 6, -2, 8, 10, 2, sk.c, sk.layer); for (let x = 5; x < 8; x++) skin(B, sk, x, 6, 1, 1);
    skin(B, sk, 5, y0 + 1, f + 1); skin(B, sk, 5, y0, f + 1, 1); skin(B, sk, 6, y0 + 1, f + 1, 1);   // the thumb, over the face (never inside the hand's inner plane: the hip is there)
    for (let z = 1; z <= f; z++) { skin(B, sk, xo, 6, z, z === f); skin(B, sk, xo, 7, z); } },                                  // the fingertips, round the edge
  // closed on something that runs through the hand (front-back): knuckles on the outer side, the thumb wrapped over the front
  fist(B, sk, o = {}) { const zf = o.zf ?? 2;
    B.box(5, 6, -2, 8, 10, 2, sk.c, sk.layer); for (let z = -2; z < 2; z++) skin(B, sk, 8, 8, z, z & 1); for (let z = -1; z < 2; z++) skin(B, sk, 8, 7, z, 1);
    for (let x = 5; x < 8; x++) skin(B, sk, x, 6, -2, 1); skin(B, sk, 5, 9, zf, 1); skin(B, sk, 6, 9, zf); skin(B, sk, 7, 9, zf); },
  // curled round a handle: the finger row folds under, forward (the handle passes at y 6, z −1..0)
  hook(B, sk) { B.box(5, 7, -2, 8, 10, 2, sk.c, sk.layer); for (let x = 5; x < 8; x++) { skin(B, sk, x, 6, -2); skin(B, sk, x, 6, 1, 1); skin(B, sk, x, 5, 1, 1); skin(B, sk, x, 5, 0, 1); }
    skin(B, sk, 5, 8, 2); skin(B, sk, 5, 7, 2, 1); },
  // palm flat on the box's end (the palm faces the midline): a flat slab, the thumb over the lid (rest z 2 → up when the arm is level)
  flat(B, sk, R) { const x0 = R ? 5 : -8, L = sk.layer; B.box(x0, 6, -2, x0 + 3, 10, 2, sk.c, L);
    for (let y = 6; y < 10; y++) skin(B, sk, R ? x0 + 2 : x0, y, 1, 1); skin(B, sk, R ? x0 : x0 + 2, 8, 2); skin(B, sk, R ? x0 : x0 + 2, 7, 2); },   // (the thumb on the palm's own column: past it, at rest, lie the pants)
};

// ── the items, redrawn for their grip (ids unchanged; colours and colourways as before)
const ITEMS = {
  // flip phone, open: keypad half in the hand, the lit screen half past the fingertips (the phone's top is at the fingertips:
  // raised, it points away from the face, screen up)
  flip(B) { const S = 0xc9ccd2, D = 0x8e939b; B.box(5, 1, 2, 8, 9, 3, S, 2); B.box(5, 4, 3, 8, 5, 4, D, 2);
    for (let y = 5; y < 9; y++) for (const x of [5, 7]) if ((y & 1) === 0) B.set(x, y, 3, 0x3a3e44, 1); B.box(5, 1, 3, 8, 4, 4, S, 2); B.box(6, 2, 3, 8, 4, 4, 0x3aa0ff, 3); B.set(5, 2, 3, 0x1b5fa8, 3); },
  // phone in a case: case back against the hand, the screen out (lit), bear ears at the top (the fingertip end)
  phonecase(B, p, H, cw) { const [n, C, l, K] = cw('phonecase', p), pat = (x, y) => K !== undefined && hash3(x, y, 2) % 3 === 0 ? K : C;
    B.box(5, 3, 2, 8, 10, 3, pat, l); B.box(5, 3, 3, 8, 10, 4, pat, l); B.box(5, 4, 3, 8, 9, 4, 0x0f1420, 1);
    for (let y = 4; y < 8; y++) B.set(6, y, 3, y === 6 ? 0xff4fa3 : 0x2de2e6, 3); B.set(7, 5, 3, 0xffd21f, 3); B.set(7, 7, 3, 0x2b6cff, 3); B.set(5, 4, 3, 0xffffff, 3);
    if (n === 'pink bear') { B.set(5, 2, 2, C, l); B.set(7, 2, 2, C, l); } },
  // mp3 player in the palm, thumb on the wheel; the earbuds' cable runs up the sleeve, out at the collar, to both ears
  ipod(B, p, H, cw, as) { const W = 0xf6f6f6, G = 0xbdbdbd; B.box(5, 2, 2, 8, 8, 3, W, 1); B.box(5, 5, 3, 8, 8, 4, 0x1b2a4a, 3); B.set(6, 6, 3, 0x9fdcff, 3);
    for (const [x, y] of [[5, 3], [6, 2], [7, 3], [6, 4]]) B.set(x, y, 3, G, 1); B.set(6, 3, 3, W, 1); line(B, [6, 8, 2], [6, 11, 2], W, 1);
    as('torso'); for (const [x, y] of [[0, 17], [0, 16], [1, 15], [1, 14]]) B.onFront(x, y, W, 1);
    strand(H, [[0, 18, 4], [-3, 19, 7], [-7, 21, 6], [-9, 23, 3]], W); strand(H, [[0, 18, 4], [3, 19, 7], [7, 21, 6], [9, 23, 3]], W);
    H.box(-11, 23, 1, -9, 25, 3, W, 1); H.box(9, 23, 1, 11, 25, 3, W, 1); },
  // disposable camera pinched at the side, lens out, the wind wheel on top
  camera(B) { const Y = 0xf2c230; B.box(5, 3, 2, 9, 7, 4, Y, 1); B.box(5, 3, 3, 9, 4, 4, 0x151515, 1); B.box(6, 4, 4, 8, 6, 5, 0x111111, 1); B.set(7, 5, 4, 0xffffff, 1);
    B.set(8, 6, 4, 0xf4f4f4, 1); B.set(8, 2, 3, 0x333333, 1); B.set(5, 6, 4, 0xd7141a, 1); },
  // floppy pinched by its shutter edge, hanging below the fingertips
  floppydisk(B) { B.box(5, 1, 2, 10, 7, 3, 0x2b50d6, 1); B.box(6, 5, 3, 9, 7, 4, 0xc9ccd2, 2); B.box(6, 1, 3, 9, 3, 4, 0xffffff); B.set(7, 2, 3, 0x2b50d6); },
  // energy drink through the fist: rest-frame axis front-back, so a level arm stands it upright
  can(B) { const col = (x, y, z) => z >= 3 ? 0xb8b8b8 : (z % 2 ? 0x6cf542 : 0x101010); B.box(5, 6, -3, 8, 9, 4, col, 1); B.set(6, 7, 4, 0x9aa0a6, 2); B.set(6, 8, 4, 0x9aa0a6, 2); },
  // spray can in the fist, nozzle forward (ready), cap colour = the paint
  spray(B, p) { const C = p.c ?? 0xff4fa3; B.box(5, 6, -4, 8, 9, 3, (x, y, z) => z === 2 ? 0x9aa0a6 : C, 1); B.set(6, 8, 3, 0xf2f2f2, 1); B.set(6, 8, 4, 0x111111); B.set(6, 7, 3, 0xf2f2f2, 1); },
  // crowbar through the fist: the claw up behind the wrist, the shaft down and forward
  crowbar(B) { const R = 0xc0392f, K = 0x2b2b2e; B.box(6, 2, 0, 7, 10, 1, R, 1); B.set(6, 1, 1, R, 1); B.set(6, 1, 2, K, 1); B.set(6, 2, 2, K, 1); B.box(6, 10, 0, 7, 12, 1, K, 1); B.set(6, 11, -1, K, 1); B.set(6, 11, -2, K, 1); B.set(6, 10, -2, K, 1); },
  // a cash stack clutched in the middle: bills out the front and back of the fist, the band showing
  cash(B) { const bill = (x, y, z) => y === 8 ? 0x8fd07a : 0x5fa84a; B.box(5, 6, -4, 8, 9, 4, bill); for (let y = 6; y < 9; y++) { B.set(6, y, 3, 0xf2e6b0); B.set(6, y, -4, 0xf2e6b0); } B.set(7, 7, 3, 0x2e6b22); },
  // cash bricks: one brick clutched by its top, strapped, a second tucked behind it
  bricks(B, p, H, cw) { const [, Band] = cw('bricks', p), bill = (x, y, z) => y === 5 || y === 9 ? 0xcfe8b8 : (((y + z) & 1) ? 0x5fa84a : 0x6fbf58);
    B.box(5, 1, -3, 8, 10, 3, bill); B.box(6, 2, -3, 9, 7, 3, bill); for (let z = -3; z < 3; z++) { B.set(8, 3, z, Band); B.set(8, 4, z, Band); } for (let y = 1; y < 6; y++) { B.set(5, y, 0, Band); B.set(7, y, 0, Band); B.set(8, y, 0, Band); }
    for (let x = 5; x < 9; x++) B.set(x, 1, 0, Band); },
  // ball mouse clutched palm-down, buttons forward, the cable swinging from its front
  mouse(B) { const C = 0xe2dccb, D = 0x8a8472; B.box(5, 3, -2, 8, 7, 3, C); B.set(6, 3, 2, D); B.set(6, 4, 2, D); B.set(6, 3, 1, D); line(B, [6, 3, 3], [6, 2, 4], 0x555555, 1); line(B, [6, 2, 4], [6, 1, 6], 0x555555, 1); line(B, [6, 1, 6], [7, 1, 9], 0x555555, 1); },
  // the chase vinyl stands on the fist (rest +z = up when the arm is level: the display hold): a small big-head figure facing out (rest −y = forward)
  vinyl(B, p, H, cw) { const [, C, l, E] = cw('vinyl', p);
    B.box(5, 6, 2, 8, 10, 3, 0x111111, 1); B.box(4, 5, 3, 9, 9, 6, C, l);   // (4 above the fist: its top stays under the wearer's chin)
    for (let z = 4; z < 6; z++) { B.set(5, 4, z, E, 1); B.set(7, 4, z, E, 1); } B.set(6, 4, 3, shade(C, .6), l === 3 ? 3 : 1); B.set(4, 5, 5, E, 1); B.set(8, 5, 5, E, 1); },
  // bodega bag: the handles through the curled fingers, the bag hanging just outside the hand (clear of the leg), THANK YOU print
  bodegabag(B, p, H, cw) { const [, C, T] = cw('bodegabag', p);
    B.box(7, 1, -2, 12, 5, 3, (x, y) => y === 1 ? shade(C, .85) : C, 1); for (let x = 8; x < 11; x++) B.set(x, 4, 2, T, 1); for (const [x, y] of [[8, 2], [10, 2], [9, 2], [9, 3]]) B.set(x, y, 2, T, 1);
    B.box(8, 5, -1, 10, 6, 1, 0x6cf542, 1); B.set(10, 5, 1, 0xff8c1a, 1); B.set(10, 6, 1, 0xff8c1a, 1);
    for (const z of [-1, 0]) { line(B, [7, 5, z], [6, 6, z], C, 1); line(B, [11, 5, z], [8, 6, z], C, 1); } },
  // duffel: long along the stride, both handles in the fist, a white stripe
  duffel(B) { const K = 0x16161a, S = 0x2a2a30; B.box(8, 1, -4, 12, 5, 5, K); for (let z = -4; z < 5; z++) B.set(11, 2, z, 0xf2f2f2); for (let z = -3; z < 4; z++) B.set(8, 4, z, S);
    for (const z of [-4, 4]) for (let y = 2; y < 4; y++) B.set(10, y, z, 0x3a3a40); line(B, [8, 5, -2], [7, 6, -1], K); line(B, [8, 5, 2], [7, 6, 0], K); B.set(8, 5, -1, K); B.set(8, 5, 1, K); },
  // sneaker box, both hands: 10 wide between the palms. It rides the CHEST (lower refit, 2026-09-30): drawn where the carry puts it, against
  // the belly, y 11…14 (the carry's palms: y 11…14, z 5…8), so it never lies in the legs at rest (the old box, drawn under the hanging
  // hands, filled the thighs) and it can't swing into them: the carry has no swing, the palms press its ends, the thumbs reach the lid
  kicksbox(B, p, H, cw) { const [, C, Lid, Lg] = cw('kicksbox', p); let zf = 2;
    for (let x = -5; x <= 4; x++) for (let y = 11; y <= 14; y++) { const z = B.B.frontZ(x, y); if (z !== null) zf = Math.max(zf, z); }
    const z0 = zf + 1, z1 = z0 + 6; B.seg = 'chest';
    B.box(-5, 11, z0, 5, 14, z1 + 1, C); B.box(-5, 14, z0, 5, 15, z1 + 1, Lid);
    for (let x = -5; x < 5; x++) { B.set(x, 13, z0, shade(Lid, .7)); B.set(x, 13, z1, shade(Lid, .7)); } for (let z = z0; z <= z1; z++) { B.set(-5, 13, z, shade(Lid, .7)); B.set(4, 13, z, shade(Lid, .7)); }
    B.box(-2, 11, z1, 2, 13, z1 + 1, 0xf4f4f4); for (const [x, y] of [[-1, 12], [0, 12], [1, 11], [-1, 11]]) B.set(x, y, z1, Lg); for (let z = z0 + 1; z < z1; z += 2) B.set(-1, 14, z, Lg); B.seg = null; },
};
function strand(H, pts, c) { for (let i = 1; i < pts.length; i++) line(H, pts[i - 1], pts[i], c, 1); }
// per item: the pinch's face depth / fingertip column, the fist's thumb row
const HAND_OPT = { flip: { f: 3, xo: 8, y0: 7 }, phonecase: { f: 3, xo: 8, y0: 7 }, ipod: { f: 3, xo: 8, y0: 6 }, camera: { f: 3, xo: 9, y0: 6 }, floppydisk: { f: 3, xo: 10, y0: 6 },
  can: { zf: 2 }, spray: { zf: 2 }, crowbar: { zf: 2 }, cash: { zf: 2 }, bricks: { zf: 2 }, mouse: { zf: 2 }, vinyl: { zf: 2 } };
export const HELD2 = ITEMS;
// where chars.js drew `HELD[id](B, p, H); hands(B, sk)`. ctx: chars.js's { HELD, hands, cwOf, as (sets the tag), partAt (the rig
// group of B's voxel at x, y, z) }. The item, then the hand(s), go through a Pen: a voxel lands in B (tagged 'held' / 'hands' as
// before, so every reader of compose() still sees it) unless B already holds a voxel of ANOTHER limb there (at rest the two-handed
// box sits where the legs are; a thumb can touch baggy pants): those go to HX, which chars.js build() and anim/bake.js add to the
// arm, so no body voxel is ever overwritten. Returns HX.
export function heldDraw(B, H, L, sk, ctx) {
  const id = L.held && L.held.id, item = id && id !== 'none' ? ITEMS[id] : null, HX = new B.constructor();
  if (id && id !== 'none' && !item) { ctx.as('held'); ctx.HELD[id](B, L.held, H); }   // an id this module doesn't know: chars.js's own
  if (!item) { ctx.as('hands'); ctx.hands(B, sk); return HX; }
  const P = new Pen(B, 'held'), grip = GRIP[id][0]; item(P, L.held, H, ctx.cwOf, part => { P.part = part; }); P.flush(B, HX, ctx);
  const Q = new Pen(B, 'hands'); mitt(Q, sk, false);
  if (grip === 'flat') { HANDS.flat(Q, sk, false); HANDS.flat(Q, sk, true); } else HANDS[grip](Q, sk, HAND_OPT[id]);
  Q.flush(B, HX, ctx); return HX;
}
class Pen {
  constructor(B, part) { this.B = B; this.q = []; this.part = part; this.seg = null; }   // (seg: a contract region the item rides whole, e.g. the box on the chest)
  set(x, y, z, c, l) { if (c === undefined || c === null) return; this.q.push([Math.round(x), Math.round(y), Math.round(z), c, l, this.part, this.seg]); }
  box(x0, y0, z0, x1, y1, z1, c, l) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  onFront(x, y, c, l, depth = 1) { const z = this.B.frontZ(x, y); if (z !== null) for (let d = 1; d <= depth; d++) this.set(x, y, z + d, c, l); }
  flush(B, HX, ctx) {
    for (const [x, y, z, c, l, part, seg] of this.q) { ctx.as(part);
      if (seg && B.fit) { const f = B.fit, was = f.seg; f.seg = seg; try { B.set(x, y, z, c, l); } finally { f.seg = was; } continue; }   // (tagged as the item, riding its region)
      if (part !== 'held' && part !== 'hands') { B.set(x, y, z, c, l); continue; }   // (the mp3's collar cable rides the torso)
      const own = x < 0 ? 'armL' : 'armR', at = B.has(x, y, z) ? ctx.partAt(x, y, z) : own;
      if (at === own) B.set(x, y, z, c, l); else HX.set(x, y, z, c, l); }
    ctx.as('hands'); }
}
// look (for held.html, the lab's &held and the overlap check): one character per held item, on a spread of bases
export const HELD_IDS = ['phonecase', 'flip', 'ipod', 'camera', 'floppydisk', 'can', 'spray', 'crowbar', 'cash', 'bricks', 'mouse', 'vinyl', 'bodegabag', 'duffel', 'kicksbox'];
const BASES = [
  { skin: 'brown', hair: { id: 'buns' }, eyes: 'bored', top: { id: 'puffer', c: 0xc9ced6 }, bottom: { id: 'baggy' }, shoes: { id: 'dad' } },
  { skin: 'pale', hat: { id: 'beanie' }, eyes: 'side', top: { id: 'hoodie', c: 0x2b6cff }, bottom: { id: 'cargo' }, shoes: { id: 'foam' } },
  { skin: 'deep', hat: { id: 'fitted', c: 0x151517 }, eyes: 'mean', top: { id: 'tee', c: 0xf2f2f2, print: 'heart' }, bottom: { id: 'track' }, shoes: { id: 'hightop' } },
  { skin: 'tan', hair: { id: 'afro' }, eyes: 'happy', top: { id: 'varsity' }, bottom: { id: 'sweats' }, shoes: { id: 'boots' } },
  { skin: 'terracotta', hat: { id: 'bucket' }, eyes: 'sleepy', top: { id: 'track' }, bottom: { id: 'flares' }, shoes: { id: 'checker' } },
];
export const HELD_CW = { phonecase: 1, bodegabag: 0, kicksbox: 0, bricks: 0, vinyl: 1 };
export function heldLooks(look) { return HELD_IDS.map((id, k) => look({ handle: 'held.' + id, ...structuredClone(BASES[k % BASES.length]),
  held: { id, cw: HELD_CW[id] ?? 0, c: id === 'spray' ? 0x6cf542 : undefined }, bg: '#9fdcff' })); }
// chars.js build(): a holding arm gets the hold as a static pose (the fit check, the kept people): the arm group (pose() swings it)
// → the shoulder: the whole arm, hand and item turned as walk2.js turns it (idle.js aArmRot: yaw · roll · pitch · twist).
// Returns false (build() meshes the arm as before) for a free arm or no held item.
export function holdArm(THREE, L, n, g, grid, pv, meshes, Grid, dec) {
  const h = holdOf(L); if (!h.pose || !n.startsWith('arm') || (n === 'armL' && !h.both)) return false;
  const sx = n === 'armL' ? -1 : 1, [aP, aR, yw, tw] = h.pose, R = (ax, a) => new THREE.Matrix4()['makeRotation' + ax](a);
  const sh = new THREE.Group(); sh.position.set(sx * 5 - pv[0], 0, 0); sh.matrixAutoUpdate = false; g.add(sh);
  sh.matrix.copy(R('Y', -sx * yw).multiply(R('Z', sx * aR)).multiply(R('X', -aP)).multiply(R('Y', -sx * tw))).setPosition(sx * 5 - pv[0], 0, 0);
  for (const m of meshes(grid, sh, 0)) m.position.set(-sx * 5, -pv[1], -pv[2]);
  return true;
}
// chars.js pose(): the share of the walk's arm swing each arm keeps ([left, right]; null: both swing fully)
export const holdSwing = L => { const h = holdOf(L); return h.pose ? [h.both ? h.swing : 1, h.swing] : null; };
