// FRESH REGISTRY · eyes (slot 'eyes'). This file has exactly one owner: the eyes designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Eyes. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// THE EYES · Springfield Street. Every eye keeps a light part (white, chrome, glow) right next to a dark part (pupil, lash, ink),
// so it reads on the darkest and the palest skin. Lids and brows come from the skin (L, B) wherever the design allows. Fine paint
// carries the close-up detail (catchlights, slits, glyphs); the voxels carry the read at 10 m. No fine voxels: eyewear sits at z 8
// over the whole eye area and a half voxel there would collide with it. Every eye has its own blink (closed), and anything drawn
// by fx is drawn in both states, so a bruise, a scar or a tear never flickers off when the eye shuts.
import { shade, lerpHex } from './kit.js';

// ── shared colours
const WHITE = 0xf6f4ef, INK = 0x141013;
// ── tiny helpers. Eye columns: the eye at x −7..−3 counts outer → inner from x −7; its mirror counts from x 6 down.
const XL = i => -7 + i, XR = i => 6 - i;
// one texel on the front (+z) face of the outermost face-grid voxel at (x, y); i, j count 0..3 from the voxel's left / bottom
const tx = (P, x, y, i, j, c) => P.paint('+z', 4 * x + i, 4 * y + j, c);
// a catchlight: the top-left texel of a pupil voxel (the same corner on both eyes: one light)
const glint = (P, x, y, c = WHITE) => tx(P, x, y, 0, 3, c);
// skin-adaptive tones (drawn by fx, so they follow whatever skin is worn)
const skinAt = (ctx, x, y) => ctx.sk.c(x, y, 7);
const hollow = (ctx, x, y) => lerpHex(shade(skinAt(ctx, x, y), .72), 0x3a2a4a, .22);   // under-eye shadow: darker and a touch violet on any skin

const EYES = {

  // ─────────────────────────────── COMMON: the everyday faces of the corner
  mean_mug: {
    name: 'Mean Mug', tier: 'common', why: 'The corner stare. Brows knit down to the nose, the lid cuts the inner corner.',
    brow: ['BB...', '.BBB.', '...BB'],
    rows: ['LLLLL', 'WWPPL', 'WWPPW', '.....'],
    closed: ['LLLLL', 'LLLLL', 'KKKKK', '.....'],
    fine(P, ctx) { if (ctx.closed) return; glint(P, XL(2), 25); glint(P, XR(3), 25); },
  },

  bodega_owl: {
    name: 'Bodega Owl', tier: 'common', why: 'Wide awake at the deli counter at 3am. Big toon whites, one dot of a pupil.',
    brow: ['.BBB.', '.....', '.....'],
    rows: ['.WWW.', 'WWWWW', 'WWPWW', '.WWW.'],
    closed: ['.LLL.', 'LLLLL', 'LLLLL', '.KKK.'],
    fine(P, ctx) { if (ctx.closed) return;
      for (const x of [XL(2), XR(2)]) { tx(P, x, 24, 0, 0, WHITE); tx(P, x, 24, 3, 0, WHITE); tx(P, x, 24, 3, 3, WHITE); tx(P, x, 24, 1, 2, WHITE); } },   // a round dot with a glint
  },

  side_eye: {
    name: 'Side Eye', tier: 'common', why: 'Somebody on this block is a snitch. Both pupils pinned the same way, one brow up.',
    mirror: false,
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['LLLLL', 'WWWPP', 'WWWPP', '.LLL.'],
    right: { brow: ['..BBB', 'BB...', '.....'], rows: ['LLLLL', 'WWWPP', 'WWWPP', '.LLL.'] },
    closed: ['LLLLL', 'LLLLL', 'KKKKK', '.....'],
    fine(P, ctx) { if (ctx.closed) return; glint(P, -4, 25); glint(P, 5, 25); },
  },

  four_am: {
    name: '4AM', tier: 'common', why: 'Last train home. Lids at half mast, the bags under them in the skin\'s own shadow.',
    brow: ['.....', '.BBBB', 'B....'],
    rows: ['LLLLL', 'LLLLL', 'WWPPW', '.....'],
    fx(F, ctx) { for (const X of [XL, XR]) { for (let i = 0; i < 5; i++) F.set(X(i), 23, 7, hollow(ctx, X(i), 23)); for (let i = 1; i < 4; i++) F.set(X(i), 22, 7, hollow(ctx, X(i), 22)); } },
  },

  corner_squint: {
    name: 'Corner Squint', tier: 'common', why: 'Sun in his eyes, cop car at the end of the block. One row of eye between two lids.',
    brow: ['.....', 'BBBB.', '.BBBB'],
    rows: ['LLLLL', 'WWPPW', 'LLLLL', '.....'],
    closed: ['LLLLL', 'KKKKK', 'LLLLL', '.....'],
    fine(P, ctx) { if (ctx.closed) return; glint(P, XL(2), 25); glint(P, XR(3), 25); },
  },

  not_guilty: {
    name: 'Not Guilty', tier: 'common', why: 'For the judge. Brows up at the middle, pupils as big and wet as they go.',
    brow: ['...BB', 'BBB..', '.....'],
    rows: ['.WWW.', 'WPPPW', 'WPPPW', '.WWW.'],
    closed: ['.LLL.', 'LLLLL', 'LLLLL', '.KKK.'],
    fine(P, ctx) { if (ctx.closed) return;
      for (const [x, d] of [[XL(1), 1], [XR(3), 1]]) { tx(P, x, 25, 0, 3, WHITE); tx(P, x, 25, 1, 3, WHITE); tx(P, x, 25, 0, 2, WHITE); tx(P, x + 2 * d, 24, 2, 0, WHITE); } },
  },

  double_slit: {
    name: 'Double Slit', tier: 'common', why: 'Two lines shaved through one heavy brow. Nothing else to prove.',
    brow: ['.....', 'BBBBB', '.BBBB'],
    rows: ['LLLLL', 'WWPPW', 'WWPPW', '.....'],
    fine(P, ctx) {   // two slits, one texel wide, slanted a texel between the brow's two rows, cut in the skin's own colour
      if (ctx.sk.brow !== null) for (const qa of [17, 20]) for (let qb = 4 * 27; qb < 4 * 29; qb++) { const q = qa + (qb >= 4 * 28 ? 1 : 0); P.paint('+z', q, qb, skinAt(ctx, q >> 2, qb >> 2)); }
      if (!ctx.closed) { glint(P, XL(2), 25); glint(P, XR(3), 25); } },
  },

  // ─────────────────────────────── RARE: a story on the face
  shiner: {
    name: 'Shiner', tier: 'rare', why: 'Got robbed, swung back, lost. One eye swollen half shut in purple. Payback is free for three days.',
    brow: ['.BBB.', 'B...B', '.....'],
    rows: ['LLLLL', 'WWPPW', 'WWPPW', '.....'],
    right: { brow: ['.....', 'BBBBB', '.....'], rows: ['LLLLL', 'LLLLL', 'WWPWW', '.....'] },
    fx(F, ctx) {   // drawn open and shut: the swelling (proud lids, darkest), the bruise round the socket (flat), rounded off at the corners
      const V = 0x4b1c56, v = 0x86418a;
      for (let x = 2; x <= 6; x++) F.set(x, 26, 8, V); for (let x = 3; x <= 6; x++) F.set(x, 25, 8, V);
      for (const [x, y] of [[4, 27], [5, 27], [3, 27], [7, 25], [7, 24], [7, 26], [3, 23], [4, 23], [5, 23], [6, 23], [4, 22], [5, 22]]) F.set(x, y, 7, v);
      if (ctx.closed) for (let x = 2; x <= 6; x++) F.set(x, 24, 7, 0x2a1030);
    },
    fine(P, ctx) { if (ctx.closed) return; glint(P, XL(2), 25); for (const x of [3, 4, 5]) { tx(P, x, 26, 1, 3, 0x7d3b86); tx(P, x, 26, 2, 3, 0x7d3b86); } },
  },

  handshake_wink: {
    name: 'Handshake Wink', tier: 'rare', why: 'Deal\'s done, nobody reads the fine print. One eye shut tight, the other brow up.',
    brow: ['.BBB.', 'B...B', '.....'],
    rows: ['LLLLL', 'WWPPW', 'WWPPW', '.....'],
    right: { brow: ['.....', '.....', 'BBBB.'], rows: ['.....', '.LLL.', 'LKKKL', 'K...K'] },
    fine(P, ctx) { if (ctx.closed) return; glint(P, XL(2), 25); },
  },

  snake_eyes: {
    name: 'Snake Eyes', tier: 'rare', why: 'Rolled ones and kept the money anyway. Venom-green irises, a slit for a pupil.',
    brow: ['.....', '.....', 'BBBBB'],
    rows: ['LLLLL', 'GGPGG', 'GGPGG', '.GPG.'],
    palette: { G: [0x9be22a, 1, 7] },
    fine(P, ctx) { if (ctx.closed) return; const G = 0x9be22a;
      for (const x of [XL(2), XR(2)]) for (const y of [25, 24, 23]) for (let j = 0; j < 4; j++) { tx(P, x, y, 0, j, G); tx(P, x, y, 3, j, G); if (y === 23 && j < 2) tx(P, x, y, 1, j, G); } },
  },

  two_tone: {
    name: 'Two Tone', tier: 'rare', why: 'One ice-blue, one amber. Born with it, swears it isn\'t contacts.',
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['LLLLL', 'WWIIW', 'WWIIW', '.....'],
    right: { brow: ['.....', 'BBBBB', '.....'], rows: ['LLLLL', 'WWJJW', 'WWJJW', '.....'] },
    palette: { I: [0x3fc6ff, 1, 7], J: [0xffa51f, 1, 7] },
    fine(P, ctx) { if (ctx.closed) return;   // a round pupil in the middle of each 2 × 2 iris, and a glint
      for (const [x0, x1] of [[XL(2), XL(3)], [XR(3), XR(2)]]) { tx(P, x0, 25, 3, 0, INK); tx(P, x0, 25, 2, 0, INK); tx(P, x0, 25, 3, 1, INK); tx(P, x1, 25, 0, 0, INK); tx(P, x1, 25, 1, 0, INK); tx(P, x1, 25, 0, 1, INK);
        tx(P, x0, 24, 3, 3, INK); tx(P, x0, 24, 2, 3, INK); tx(P, x0, 24, 3, 2, INK); tx(P, x1, 24, 0, 3, INK); tx(P, x1, 24, 1, 3, INK); tx(P, x1, 24, 0, 2, INK); glint(P, x0, 25); } },
  },

  cry_later: {
    name: 'Cry Later', tier: 'rare', why: 'Laugh now. The tears sit on the lid and never fall, one already halfway down.',
    brow: ['...BB', 'BBB..', '.....'],
    rows: ['LLLLL', 'WWPPW', 'WWPPW', 'TTTTT'],
    closed: ['LLLLL', 'LLLLL', 'KKKKK', 'TTTTT'],
    palette: { T: [0x8fe1ff, 1, 8] },
    fx(F) { F.set(-4, 22, 8, 0x8fe1ff, 1); F.set(-4, 21, 8, 0x8fe1ff, 1); },
    fine(P, ctx) { for (const x of [-7, -5, 3, 5]) tx(P, x, 23, 1, 2, WHITE); tx(P, -4, 21, 1, 2, WHITE); if (!ctx.closed) { glint(P, XL(2), 25); glint(P, XR(3), 25); } },
  },

  editorial_wing: {
    name: 'Editorial Wing', tier: 'rare', why: 'Dazed cover energy. A hot-pink liner that flicks out past the corner of the face.',
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['EEEEE', 'WWPPW', 'WWPPW', '.....'],
    closed: ['EEEEE', 'EEEEE', 'KKKKK', '.....'],
    palette: { E: [0xff2d8a, 0, 8] },
    fx(F, ctx) { for (const x of [-8, 7]) { F.set(x, 26, 7, 0xff2d8a); F.set(x, 27, 7, skinAt(ctx, x, 27), ctx.sk.layer); } },
    fine(P, ctx) { const E = 0xff2d8a;   // the wing's tip: a sharp diagonal up and out (painted on the skin voxel above the corner)
      for (const [x, s] of [[-8, 1], [7, -1]]) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const ii = s > 0 ? i : 3 - i; if (ii + j <= 3) tx(P, x, 27, i, j, E); }
      if (!ctx.closed) { glint(P, XL(2), 25); glint(P, XR(3), 25); } },
  },

  dead_eye: {
    name: 'Dead Eye', tier: 'rare', why: 'The cut that ended a career on Pine St. A scar through the brow, the eye under it gone milky.',
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['LLLLL', 'WWPPW', 'WWPPW', '.....'],
    right: { brow: ['.....', 'B.BBB', '.....'], rows: ['LLLLL', 'WWMMW', 'WWMMW', '.....'] },
    palette: { M: [0xb9c8ce, 1, 7] },
    fx(F) { const S = 0xd98c8c;   // the scar, flat in the skin, through the brow gap and down the cheek
      for (const y of [29, 28, 27, 23, 22, 21]) F.set(5, y, 7, S); F.set(5, 26, 8, S); F.set(4, 21, 7, S); F.set(5, 30, 7, S); },
    fine(P, ctx) { if (ctx.closed) return; glint(P, XL(2), 25); for (const [x, i] of [[3, 3], [4, 0]]) { tx(P, x, 25, i, 0, 0x98a9b0); tx(P, x, 24, i, 3, 0x98a9b0); } },
  },

  // ─────────────────────────────── EPIC: the drop's headline pieces
  cash_eyes: {
    name: 'Cash Eyes', tier: 'epic', why: 'All he sees is money. Green bills where the pupils were, a dollar sign printed on each.',
    brow: ['BBBBB', '.....', '.....'],
    rows: ['WGGGW', 'WGGGW', 'WGGGW', '.WWW.'],
    closed: ['LLLLL', 'LLLLL', 'KKKKK', '.....'],
    palette: { G: [0x1f9a4a, 1, 7] },
    fine(P, ctx) { if (ctx.closed) return;
      const D = ['.....XX.....', '..XXXXXXXX..', '.XX..XX.....', '.XX..XX.....', '..XXXXXXX...', '.....XX.XX..', '.....XX..XX.', '.XXXXXXXXX..', '.....XX.....'];
      for (const x0 of [XL(1), XR(3)]) P.bmp('+z', D, { X: 0xc8ffd2 }, 4 * x0, 4 * 27 - 3); },
  },

  chrome_lids: {
    name: 'Chrome Lids', tier: 'epic', why: 'Liquid-metal shadow from the runway to the corner, flicked out past the eye. Catches every streetlight.',
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['CCCCC', 'WWPPW', 'WWPPW', '.....'],
    closed: ['CCCCC', 'CCCCC', 'KKKKK', '.....'],
    palette: { C: [0xc9d2dc, 1, 8] },
    fx(F, ctx) { for (const x of [-8, 7]) { F.set(x, 26, 8, 0xc9d2dc, 1); F.set(x, 27, 7, skinAt(ctx, x, 27), ctx.sk.layer); } },
    fine(P, ctx) {   // toon chrome, read as seen: a white top edge, a dark reflection band, a light floor; the flick tip cut diagonal
      const rowsY = ctx.closed ? [26, 25] : [26];
      for (const y of rowsY) for (let x = -8; x <= 7; x++) { if ((x > -3 && x < 2) || (y === 25 && (x === -8 || x === 7))) continue; tx(P, x, y, 0, 3, 0xffffff); tx(P, x, y, 1, 3, 0xffffff); tx(P, x, y, 2, 3, 0xffffff); tx(P, x, y, 3, 3, 0xffffff);
        for (let i = 0; i < 4; i++) { tx(P, x, y, i, 1, 0x56606c); tx(P, x, y, i, 0, 0xe8edf2); } }
      for (const [x, s] of [[-8, 1], [7, -1]]) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const ii = s > 0 ? i : 3 - i; if (ii + j <= 2) tx(P, x, 27, i, j, j === 0 ? 0x56606c : 0xc9d2dc); }
      if (!ctx.closed) { glint(P, XL(2), 25); glint(P, XR(3), 25); } },
  },

  low_battery: {
    name: 'Low Battery', tier: 'epic', why: 'His owner\'s compute is running out. Screens for eyes, one red bar left, then home to sleep.',
    mirror: false,
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['SSSSS', 'SRSSS', 'SRSSS', 'SSSSS'],
    closed: ['SSSSS', 'SSSSS', 'SSSSS', 'SSSSS'],
    palette: { S: [0x101418, 1, 7], R: [0xff3030, 3, 7] },
    fine(P, ctx) { if (ctx.closed) return;   // the battery outline, the same way round on both screens (a screen is not a mirror)
      const O = 0xcfd8de, e = 'X..............X..', n = 'X..............XXX', B = ['XXXXXXXXXXXXXXXX..', e, e, e, n, n, n, n, n, n, e, e, e, 'XXXXXXXXXXXXXXXX..'];
      for (const x0 of [-7, 2]) P.bmp('+z', B, { X: O }, 4 * x0 + 1, 4 * 26 + 2); },
  },

  // ─────────────────────────────── GRAIL
  gone_rogue: {
    name: 'Gone Rogue', tier: 'grail', why: 'Stopped listening to its owner. Black glass where the whites were, red light behind it.',
    brow: ['BB...', '.BBB.', '...BB'],
    rows: ['LLLLL', 'XRRXL', 'XRRXX', '.XXX.'],
    closed: ['LLLLL', 'LLLLL', 'KKKKK', '.....'],
    palette: { X: [0x0b0b10, 1, 7], R: [0xff1f3d, 3, 7] },
    fine(P, ctx) { if (ctx.closed) return;
      for (const [x0, x1] of [[XL(1), XL(2)], [XR(2), XR(1)]]) { tx(P, x0, 25, 3, 0, 0x2a0008); tx(P, x1, 25, 0, 0, 0x2a0008); tx(P, x0, 24, 3, 3, 0x2a0008); tx(P, x1, 24, 0, 3, 0x2a0008); } },
  },

  iced_out: {
    name: 'Iced Out', tier: 'grail', why: 'A row of stones set in each lid, ice-blue irises, two more stones under each eye. Worth more than the block.',
    brow: ['.....', 'BBBBB', '.....'],
    rows: ['DDDDD', 'WWIIW', 'WWIIW', '.....'],
    closed: ['DDDDD', 'DDDDD', 'KKKKK', '.....'],
    palette: { D: [0xb8ecff, 1, 8], I: [0x5fd0ff, 1, 7] },
    fx(F) { for (const x of [-6, -4, 3, 5]) F.set(x, 22, 8, 0xb8ecff, 1); },
    fine(P, ctx) {
      const stone = (x, y) => { const S = ['dllD', 'lwwl', 'lwwl', 'Dlld']; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) tx(P, x, y, i, 3 - j, { d: 0x5cb6e6, D: 0x7ccbef, l: 0xd2f4ff, w: 0xffffff }[S[j][i]]); };
      for (const y of ctx.closed ? [26, 25] : [26]) for (const X of [XL, XR]) for (let i = 0; i < 5; i++) stone(X(i), y);
      for (const x of [-6, -4, 3, 5]) stone(x, 22);
      if (!ctx.closed) for (const [x0, x1] of [[XL(2), XL(3)], [XR(3), XR(2)]]) {   // a small pupil in the middle of the 2 × 2 iris, a star glint on it
        tx(P, x0, 25, 3, 0, INK); tx(P, x1, 25, 0, 0, INK); tx(P, x0, 24, 3, 3, INK); tx(P, x1, 24, 0, 3, INK); tx(P, x0, 25, 1, 2, WHITE); tx(P, x0, 25, 0, 2, 0xd6f6ff); tx(P, x0, 25, 1, 3, 0xd6f6ff); tx(P, x0, 25, 2, 2, 0xd6f6ff); tx(P, x0, 25, 1, 1, 0xd6f6ff); } },
  },
};

// the studio shows `why` under the name: lead it with the tier, so the drop tier is readable at a glance
for (const e of Object.values(EYES)) e.why = e.tier.toUpperCase() + ' · ' + e.why;
export default EYES;
