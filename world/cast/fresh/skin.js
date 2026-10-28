// FRESH REGISTRY · skin (slot 'skin'). This file has exactly one owner: the skin designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Skin. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// SKIN · the 2026-10-01 batch. The owner picks a tone at spawn (the commons: seven tones, each with its own brow, mouth, lip and ink
// tuned for contrast by day and by night); the morning drop sells the rest. Skin is surface only, so everything here is one of four levers:
//   c(x, y, z)  a per-voxel colour over the WHOLE body (head, ears, neck, torso, arms, hands, bare legs, ankles). The only lever that
//               reaches the hands and the legs (they are drawn after the skin's fine pass), so anything that must read on a dressed
//               walker lives here: knuckles, wrists, forearms below a tee's sleeve, the sides and back of the head.
//   sh          the shade: the eyelids, the nose, the inner ear and the fingertip row.
//   decorate    head recolours (cheeks), always OFF the eye grids and the mouth grid (the face grid would be carved away there).
//   fine        4 × 4 texels a face: freckles, line-work on the bare forearms and the forehead.
// The face front stays clean of pattern (face ink belongs to mouth.js, and the eyes must read on every skin): patterns run on the
// limbs, the torso and the head's sides and back.
import { shade, lerpHex, hash3 } from './kit.js';

// ── body regions (character voxels; README § The body)
const HEAD = y => y >= 19;
const FRONT = (y, z) => y >= 19 && z >= 7;                                 // the face plane (and the lids / nose at z 8)
const EAR = (x, y) => y >= 19 && (x <= -9 || x >= 8);
const HAND = (x, y) => y >= 6 && y <= 9 && (x <= -6 || x >= 5);
const ARM = (x, y) => y >= 10 && y <= 16 && (x <= -6 || x >= 5);
const LEG = (x, y) => y <= 9 && x >= -5 && x <= 4 && !HAND(x, y);
const TORSO = (x, y) => y >= 10 && y <= 18 && x >= -5 && x <= 4;
const M = x => (x < 0 ? -x - 1 : x);                                       // mirrored x: 0 at the centre line, both sides alike
const OUTER = x => M(x) === 7;                                              // the arms' and hands' outer column (x −8 / 7)
// a limb's surface position, counted round it (front → outer side → back), so a band or a flame wraps the limb
const roundArm = (x, z) => (z >= 0 ? (M(x) - 5) : 3 + (M(x) === 7 ? 0 : 2 - (M(x) - 5)) + (z < -1 ? 1 : 0));

const tone = (name, c, o = {}) => ({ name, c, ...o });

export default {
  // ── COMMON · the seven tones a new citizen picks from at Sunny Acres
  limestone: tone('Limestone', 0xf5caa6, { why: 'common · the fair tone: rosy lip, warm brown brow',
    sh: 0xdca482, brow: 0x5a3622, mouth: 0x82343a, lip: 0xe08a84, lash: 0x2a1a14, ink: 0x22304c }),
  buff: tone('Buff', 0xe8b07a, { why: 'common · light golden, the walk-ups\' buff brick',
    sh: 0xc98f58, brow: 0x3e2414, mouth: 0x6e2a22, lip: 0xcc7462, ink: 0x1f2a40 }),
  olive: tone('Olive', 0xcca266, { why: 'common · olive, a green-gold undertone',
    sh: 0xab834c, brow: 0x2c1e12, mouth: 0x5c2a1e, lip: 0xb46e54, ink: 0x1c2238 }),
  terracotta: tone('Terracotta', 0xc8784a, { why: 'common · medium, warm red-orange',
    sh: 0xa55f36, brow: 0x2a140c, mouth: 0x4e1a12, lip: 0xae4e3c, ink: 0x161a2c }),
  brownstone: tone('Brownstone', 0xa4643e, { why: 'common · medium-deep, the stoop colour',
    sh: 0x834c2e, brow: 0x1c0e08, mouth: 0x2e100a, lip: 0x8a3e34, ink: 0xecd8bc }),
  night_shift: tone('Night Shift', 0x7a4a30, { why: 'common · deep warm brown',
    sh: 0x603824, brow: 0x140a06, mouth: 0x200c08, lip: 0x8c4440, ink: 0xecd8bc }),
  blacktop: tone('Blacktop', 0x553426, { why: 'common · the deepest tone, a cool undertone',
    sh: 0x43281d, brow: 0x0e0806, mouth: 0x140808, lip: 0x7c3c40, lash: 0x0a0606, ink: 0xecd8bc }),

  // ── RARE
  // the Springfield classic: toon yellow, the colour of every cab on Fit Street
  cab_yellow: { name: 'Cab Yellow', why: 'rare · the toon classic, cab yellow', c: 0xf7c41c, sh: 0xd9a10e,
    brow: 0x3a240c, mouth: 0x5c2410, lip: 0xe8823c, lash: 0x24160a, ink: 0x1c2040 },

  // January on the corner: bitten red nose, ears, cheeks and knuckles
  wind_chill: { name: 'Wind Chill', why: 'rare · January on the corner: red nose, ears, cheeks and knuckles',
    c: (x, y, z) => EAR(x, y) ? 0xec8a78 : HAND(x, y) && (z >= 1 || OUTER(x)) && y >= 7 ? 0xee9a86 : 0xf3cbb0,
    sh: (x, y, z) => FRONT(y, z) && y === 22 ? 0xe2584e : EAR(x, y) ? 0xd06454 : HAND(x, y) ? 0xe0705e : 0xd9a88e,
    brow: 0x6a3e26, mouth: 0x8a2e34, lip: 0xe06a6e, lash: 0x2e1c14, ink: 0x23304c,
    decorate(H) { for (const x of [-7, -6, -5, 4, 5, 6]) for (const y of [21, 22]) H.set(x, y, 7, M(x) === 6 && y === 22 ? 0xf1ad9a : 0xef9c8a); } },

  // a summer on the stoop in a tank top: tanned arms and shoulders, the tank's pale outline on the torso, a sunburnt nose, a few
  // freckles over the cheeks and the bridge
  summer_stoop: { name: 'Summer Stoop', why: 'rare · a summer in a tank top: the tan line, a burnt nose, a few freckles',
    c: (x, y, z) => {
      const TAN = 0xd9955f, PALE = 0xf1c89e;
      if (TORSO(x, y) && y <= 15 && x >= -4 && x <= 3) return PALE;                               // under the tank
      if (TORSO(x, y) && y >= 16 && y <= 17 && (M(x) === 1 || M(x) === 2)) return PALE;          // the straps
      return TAN; },
    sh: (x, y, z) => FRONT(y, z) && y === 22 ? 0xd0644c : 0xb57a4c,
    brow: 0x4a2612, mouth: 0x5e2216, lip: 0xc8664e, ink: 0x1f2a40,
    fine(P) { const F = 0x9a4a24;
      const cells = [];
      for (const x of [-6, -5, -4, 3, 4, 5]) cells.push([x, 22]);
      for (const x of [-2, 1]) cells.push([x, 23]);
      for (const [x, y] of cells) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const h = hash3(M(x) * 4 + (x < 0 ? 3 - i : i), y * 4 + j, 7);
        if (h % 6 === 0) P.paint('+z', 4 * x + i, 4 * y + j, F); } } },

  // done time: blue-black yard ink, wrist bands, knuckle dots, a star behind each ear, a clock with no hands on the forearm
  yard_ink: { name: 'Yard Ink', why: 'rare · Iron Island ink: wrist bands, knuckle dots, stars behind the ears',
    c: (x, y, z) => {
      const INK = 0x34465a, S = 0xc98e64;
      if (HAND(x, y)) { if (y === 9) return INK; if (z === 1 && y === 8 && M(x) !== 6) return INK; if (OUTER(x) && y === 7 && z === -1) return INK; return S; }
      if (ARM(x, y) && y === 12) return INK;                                                   // the forearm band (below a tee's sleeve)
      return S; },
    sh: 0xa8724c, brow: 0x24140c, mouth: 0x4a1c12, lip: 0xa85440, ink: 0x2a3a50,
    fine(P) { const I = 0x34465a;
      // a clock with no hands on each forearm's front (doing time), 3 voxels wide × 2 tall over y 10..11
      const clock = ['..IIII..', '.I....I.', 'I......I', 'I..II..I', 'I..II..I', 'I......I', '.I....I.', '..IIII..'];
      for (const x0 of [-8, 5]) P.bmp('+z', clock, { I }, 4 * x0 + 2, 4 * 12 - 1);
      // three stars down the outer upper arm
      const star = ['..I..', '.III.', 'IIIII', '.I.I.'];
      P.bmp('-x', star, { I }, -3, 4 * 16 + 2); P.bmp('+x', star, { I }, 2, 4 * 16 + 2);
      P.bmp('-x', star, { I }, -3, 4 * 14 + 2); P.bmp('+x', star, { I }, 2, 4 * 14 + 2);
      // a five-point star behind each ear (the head's sides, z −6..−4, y 24..26): 10 × 10 texels
      const big = ['....II....', '....II....', '...IIII...', 'IIIIIIIIII', '.IIIIIIII.', '..IIIIII..', '..IIIIII..', '.III..III.', '.II....II.', 'I........I'];
      P.bmp('-x', big, { I }, 4 * -6 + 1, 4 * 27 - 1); P.bmp('+x', big, { I }, 4 * -3 - 2, 4 * 27 - 1); } },

  // a writer's hands: fingers dipped in two cans, hot pink and lime, a drip up the wrist
  overspray: { name: 'Overspray', why: 'rare · a writer\'s hands: dipped in pink and lime, a drip up the wrist',
    c: (x, y, z) => {
      const S = 0x9a5c3a, PINK = 0xff3d8b, LIME = 0xa6e22a, can = x < 0 ? PINK : LIME;
      if (HAND(x, y)) { if (y <= 6) return can; if (y === 7 && (z >= 0 || OUTER(x))) return can; if (y === 8 && z === 1 && M(x) === 6) return can; return S; }
      if (ARM(x, y) && y === 10 && z === 0 && M(x) === 7) return can;                         // the drip, up the outer wrist
      return S; },
    sh: (x, y) => HAND(x, y) ? (x < 0 ? 0xd62a6e : 0x86bc18) : 0x7c4a2e,
    brow: 0x160a06, mouth: 0x2c0e08, lip: 0x8c4038, ink: 0xecd8bc,
    fine(P) { // overspray mist: a few flecks on the forearms' fronts (bare arms only)
      for (const [x0, col] of [[-8, 0xff3d8b], [5, 0xa6e22a]]) for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { const h = hash3(i, j, x0);
        if (h % 9 === 0) P.paint('+z', 4 * x0 + i, 4 * 10 + j, col); } } },

  // ── EPIC
  // wall to wall: a traditional bodysuit in red, black and gold. Flames up the forearms and the shins, black shoulder caps, a red sun
  // on the chest, a lattice down the back, gold knuckles, and an eye in the back of the head. The face stays bare.
  wall_to_wall: { name: 'Wall to Wall', why: 'epic · a full bodysuit: flames up the arms and shins, a red sun, an eye in the back of the head',
    c: (x, y, z) => {
      const S = 0xdca07a, RED = 0xd8342a, GOLD = 0xf2b221, BLK = 0x1d1c26;
      const flame = (u, h0) => { const H = [3, 5, 2, 4, 6, 3, 4, 2][((u % 8) + 8) % 8]; return h0 < H - 1 ? RED : h0 === H - 1 ? GOLD : null; };
      if (HAND(x, y)) { if (y === 9) return BLK; if (z === 1 && y === 8 && M(x) !== 6) return GOLD; return S; }
      if (ARM(x, y)) { if (y >= 15) return BLK; if (y === 14) return S; return flame(roundArm(x, z), y - 10) || S; }
      if (LEG(x, y)) { const u = (M(x) - 1) + (z >= 1 ? 0 : 3); return flame(u + 2, y - 4) || S; }
      if (TORSO(x, y)) { const dx = x + .5, dy = y - 14; if (z >= 2 && dx * dx + dy * dy <= 7) return RED;                       // the sun
        if (z >= 2 && Math.abs(dx) <= 4.5 && dx * dx + dy * dy <= 16 && (Math.abs(Math.round(dx)) === Math.abs(dy) || dy === 0 || Math.round(dx) === 0)) return GOLD;
        if (z <= -2 && ((x + y) % 4 === 0 || (x - y) % 4 === 0)) return BLK; return S; }
      if (HEAD(y) && z === -7) { const r = Math.hypot(x + .5, y - 26); if (r <= 1.6) return BLK; if (r <= 3.1) return RED; if (r <= 4.4) return BLK; }   // the eye
      return S; },
    sh: 0xbb8462, brow: 0x2a160c, mouth: 0x4e1a12, lip: 0xb85448, ink: 0x1d1c26 },

  // harbour patina: weathered copper gone green, rubbed bright where hands touch it (the nose, the knuckles, the ear lobes)
  harbor_patina: { name: 'Harbor Patina', why: 'epic · copper gone green in the salt air, rubbed bright at the nose and knuckles',
    c: (x, y, z) => {
      const G = 0x5fb59a, G2 = 0x52a48c, CU = 0xd07a40;
      if (HAND(x, y) && (z === 1 || (z === 2))) return CU;                                      // rubbed knuckles and thumbs
      if (EAR(x, y) && y === 23) return CU;                                                     // the lobes
      if (FRONT(y, z)) return G;
      return (hash3(x, 0, z) % 3 === 0 && (hash3(x, y >> 2, z) % 2 === 0)) ? G2 : G; },          // rain streaks, running down
    sh: (x, y, z) => FRONT(y, z) && y === 22 ? 0xe08a4c : HAND(x, y) ? 0xb0622e : 0x4a9682,
    brow: 0x1f4a40, mouth: 0x173a32, lip: 0xc8743e, lash: 0x163a32, ink: 0x14302a },

  // counterfeit: printed like a bill, engraved all over in two greens; a hundred across the forehead
  counterfeit: { name: 'Counterfeit', why: 'epic · printed like a bill: engraved greens, a hundred on the forehead',
    c: (x, y, z) => {
      const P0 = 0xb4d0a0, P1 = 0x9cc08c, DK = 0x3f6a4a;
      if (FRONT(y, z)) return P0;
      if (HAND(x, y)) return y === 9 ? DK : P0;
      if (ARM(x, y) && (y === 10 || y === 16)) return DK;
      return (y & 1) ? P0 : P1; },
    sh: 0x8fb07e, brow: 0x24442e, mouth: 0x2a4a34, lip: 0x6f9a6e, lash: 0x1a3424, ink: 0x1f3a2a,
    fine(P) { const D = 0x3f6a4a;
      // "100" across the forehead (y 30..31), centred: read as seen from the front
      P.bmp('+z', ['I..III..III.', 'I..I.I..I.I.', 'I..I.I..I.I.', 'I..I.I..I.I.', 'I..III..III.'].map(r => '.' + r), { I: D }, -7, 4 * 32 - 1);
      // a seal on the chest (bare torso): a ring of 12 × 12 texels
      P.bmp('+z', ['....IIII....', '..II....II..', '.I..IIII..I.', '.I.I....I.I.', 'I.I......I.I', 'I.I..II..I.I', 'I.I..II..I.I', 'I.I......I.I', '.I.I....I.I.', '.I..IIII..I.', '..II....II..', '....IIII....'],
        { I: D }, -6, 4 * 16 - 1); } },

  // ── GRAIL
  // flooded: pavé from crown to toe, set in a two-tone facet; the face is set in one stone so the eyes still read
  flooded: { name: 'Flooded', why: 'grail · flooded: pavé from crown to toe, a body set in ice', layer: 1,
    c: (x, y, z) => FRONT(y, z) ? 0xd8e6f4 : ((x + y + z) & 1 ? 0xe9f3ff : 0xa8bdd8),
    sh: 0xb2c4da, brow: 0x1c2a40, mouth: 0x23324a, lip: 0x8fb4e0, lash: 0x16202e, ink: 0x1c2a40,
    fine(P) { const W = 0xffffff, B = 0x7fa6dc;   // glints: a few four-point sparkles on the forehead, the temples and the shoulders
      const glint = ['.W.', 'WBW', '.W.'];
      for (const [qa, qb] of [[4 * -5 + 1, 4 * 32 + 1], [4 * 3 + 2, 4 * 31 + 2], [4 * -1, 4 * 30 + 3]]) P.bmp('+z', glint, { W, B }, qa, qb);
      P.bmp('-x', glint, { W, B }, 4 * 2 + 1, 4 * 30 + 1); P.bmp('+x', glint, { W, B }, 4 * -3 + 2, 4 * 28 + 1);
      P.bmp('+y', glint, { W, B }, 4 * -8 + 1, 4 * 0); P.bmp('+y', glint, { W, B }, 4 * 6, 4 * -1 + 1); } },

  // dipped: the whole body dipped in gold, with toon shine strokes (the street has no reflections to sell metal: the strokes do)
  dipped: { name: 'Dipped', why: 'epic · the whole body dipped in gold, toon shine on the head and shoulders', layer: 1, c: 0xe9a224, sh: 0xbd7a10,
    brow: 0x3a2206, mouth: 0x3c1806, lip: 0xf0b860, lash: 0x2a1804, ink: 0x17171b,
    fine(P) { const W = 0xfff2c0, Y = 0xffd870;
      const stroke = ['......WW', '....WWW.', '..WWW...', '.WW.....', 'WW......'], dot = ['YW', 'WY'];
      P.bmp('+z', stroke, { W }, 4 * -7 + 1, 4 * 33 + 2); P.bmp('+z', dot, { W, Y }, 4 * -4 + 3, 4 * 32 + 1);   // the forehead's upper left
      P.bmp('-x', stroke, { W }, 4 * -3, 4 * 32 + 2);                                                          // the right side of the head
      P.bmp('+x', stroke.map(r => [...r].reverse().join('')), { W }, 4 * 3, 4 * 32 + 2);                      // the left side
      P.bmp('+z', stroke, { W }, 4 * -5 + 2, 4 * 17 + 2);                                                      // the chest (bare)
      P.bmp('+y', ['WWWW', 'W...'], { W }, 4 * -8 + 2, 4 * 0 + 2); P.bmp('+y', ['WWWW', '...W'], { W }, 4 * 6 - 2, 4 * 0 + 2); } },   // the shoulders
};
