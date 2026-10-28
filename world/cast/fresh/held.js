// HELD · a thing in the hand(s): it passes through the closed fist and rides the gripping arm (README § Held). One owner.
// Each entry: { name, pose: 'down' | 'forward' | 'both' | 'raised', draw(G, ctx), fine?(P, ctx) } · ctx.grip: the pose, its channel
// cells and its envelope (world/fit/held.js). The only import allowed is './kit.js'.
//
// THE CARRY · what the corner has in its hands. Everything is invented: no real brands, no phones, no firearms, no real drugs. Each
// entry carries `tier` (common · rare · epic · grail) and a `why` line. One colour scheme per trait.
//
// How each pose is used here (rest frame, the +x hand; the fist is x 5..7, y 6..9, z −2..1, its thumb at (5,7,2) (5,8,2) (6,8,2)):
//   down     the hang: a handle fills the channel (6, 7, −2..1), leaves the fist at its front (z 2) and back (z −3) and drops into a
//            bag or case hanging below the fist (y 2..5). Nothing inward of x 5. The broad face of the bag looks out (+x).
//   forward  a cylinder through the fist: the channel is its core, its front end shows past the fingers (z 2..4, the thumb closing
//            over the top-inner corner of z 2), its back end behind them (z −3). Posed, the front end points forward and up.
//   raised   the same, but the front end is the top: it rises past the fist (z 2..4) in front of the chest.
//   both     a thing between the fists: its edge or its side grips run through both channels (x 5..7 and −8..−6, y 7, z −1).
//            Posed, rest −y is its FRONT (it faces the street) and rest +z its top, so the face art is painted on '-y'.
import { shade } from './kit.js';

const INK = 0x17171b;
const bx = (G, x0, x1, y0, y1, z0, z1, c, l = 0) => G.box(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1, c, l);   // inclusive box
const grip = (G, ctx, c, l = 0) => { for (const [x, y, z] of ctx.grip.cells) G.set(x, y, z, c, l); };
// the strap / handle of a hanging thing: down from the fist's front (z 2) and back (z −3) to the top of what hangs (y 5 → 7)
const hangers = (G, c, l = 0, y0 = 6) => { for (const z of [-3, 2]) for (let y = y0; y <= 7; y++) G.set(6, y, z, c, l); };

// ── lettering: a 3 × 5 block face ('x' ink, '.' none), scaled k×
const FONT = {
  A: 'xxx x.x xxx x.x x.x', B: 'xx. x.x xx. x.x xx.', C: 'xxx x.. x.. x.. xxx', D: 'xx. x.x x.x x.x xx.', E: 'xxx x.. xx. x.. xxx',
  F: 'xxx x.. xx. x.. x..', G: 'xxx x.. x.x x.x xxx', H: 'x.x x.x xxx x.x x.x', I: 'xxx .x. .x. .x. xxx', K: 'x.x x.x xx. x.x x.x',
  L: 'x.. x.. x.. x.. xxx', M: 'x.x xxx xxx x.x x.x', N: 'xx. x.x x.x x.x x.x', O: 'xxx x.x x.x x.x xxx', P: 'xxx x.x xxx x.. x..',
  R: 'xxx x.x xx. x.x x.x', S: 'xxx x.. xxx ..x xxx', T: 'xxx .x. .x. .x. .x.', U: 'x.x x.x x.x x.x xxx', Y: 'x.x x.x xxx .x. .x.',
  0: 'xxx x.x x.x x.x xxx', 1: '.x. xx. .x. .x. xxx', 2: 'xxx ..x xxx x.. xxx', 4: 'x.x x.x xxx ..x ..x', 6: 'xxx x.. xxx x.x xxx',
  9: 'xxx x.x xxx ..x xxx', '#': 'x.x xxx x.x xxx x.x', '-': '... ... xxx ... ...', ' ': '... ... ... ... ...',
};
const rowsOf = (s, k = 1) => { const out = Array.from({ length: 5 * k }, () => '');
  [...s].forEach((ch, i) => { const g = (FONT[ch] || FONT[' ']).split(' ');
    for (let r = 0; r < 5; r++) { const wide = [...((i ? '.' : '') + g[r])].map(c => c.repeat(k)).join(''); for (let t = 0; t < k; t++) out[r * k + t] += wide; } });
  return out; };
const say = (P, face, s, qa, qb, c, k = 1) => P.bmp(face, rowsOf(s, k), { x: c }, qa, qb);
const wOf = (s, k = 1) => (4 * s.length - 1) * k;
// a disc of texels round (cqa, cqb) (quarter units, a texel's centre is at +½); f(d) → colour | undefined by the distance
const disc = (P, face, cqa, cqb, r, f) => P.rect(face, Math.floor(cqa - r), Math.floor(cqb - r), Math.ceil(cqa + r), Math.ceil(cqb + r),
  (a, b) => { const d = Math.hypot(a + .5 - cqa, b + .5 - cqb); return d <= r ? f(d) : undefined; });

// the forward / raised cylinder through the fist: its slice at z 2 leaves the thumb's three cells to the thumb
const RING2 = [[5, 6], [6, 6], [7, 6], [6, 7], [7, 7], [7, 8]];
const sq3 = (G, z, c, l = 0) => bx(G, 5, 7, 6, 8, z, z, c, l);
const plus = (G, z, c, l = 0) => { for (const [x, y] of [[6, 7], [5, 7], [7, 7], [6, 6], [6, 8]]) G.set(x, y, z, c, l); };

export default {
  // ════════════ DOWN · the hang ════════════
  deli_bag: {
    name: 'Thank You Bag', tier: 'common', pose: 'down',
    why: 'common · the bodega\'s white bag, THANK YOU in red, a wrapped hero and a juice riding up out of it',
    draw(G, ctx) { const W = 0xf1eee6, PAPER = 0xfaf7ef, JUICE = 0xff8a1f;
      bx(G, 5, 8, 3, 5, -3, 2, W, 1); bx(G, 6, 7, 2, 2, -2, 1, W, 1);          // the bag, its bottom rounded under the load
      for (const z of [-3, 2]) { G.set(7, 6, z, W, 1); }                          // the corners pulled up into the handles
      hangers(G, W, 1); grip(G, ctx, W, 1);
      G.set(8, 6, 2, PAPER); G.set(8, 7, 2, PAPER);                               // the hero in deli paper, up out of the front corner
      G.set(8, 6, -3, JUICE, 1); },                                               // the juice cap, at the back
    fine(P) { const R = 0xd8262b;
      say(P, '+x', 'THANK', 9, 22, R); say(P, '+x', 'YOU', 5, 16, R);
      P.bmp('+z', ['.x....x.', '.x....x.', '........', 'x......x', '.x....x.', '..xxxx..'], { x: R }, 24, 21);   // the smiley on the end
      P.rect('+y', 32, 8, 36, 12, 0xd9a45a);                                     // the bread end of the hero
      P.at(8, 6, -3, '+y', 1, 1, 0xffffff); P.at(8, 6, -3, '+y', 2, 2, 0xffffff); },
  },
  drop_bag: {
    name: '4AM Drop Bag', tier: 'rare', pose: 'down',
    why: 'rare · the stiff red shopping bag from the 4AM drop on Fit Street, black rope handles, white tissue still in it',
    draw(G, ctx) { const R = 0xd3262d, TISSUE = 0xf7f5ef;
      bx(G, 5, 7, 2, 5, -4, 3, R);                                                // the bag (paper, matte)
      for (let z = -3; z <= 2; z++) for (let y = 3; y <= 5; y++) G.del(6, y, z);  // open at the top
      for (let z = -3; z <= 2; z++) G.set(6, 4, z, TISSUE);                       // the tissue inside
      for (const z of [-2, 0, 1]) G.set(6, 5, z, TISSUE);                         // ...puffing up to the rim
      hangers(G, INK, 0, 5); grip(G, ctx, INK); },                                // the rope, tied to the rim
    fine(P) { const Wt = 0xffffff; say(P, '+x', '4AM', 10, 20, Wt, 2);
      P.rect('+x', -16, 9, 16, 10, Wt); },                                        // a hairline along the base
  },
  cash_duffel: {
    name: 'Bag Money Duffel', tier: 'epic', pose: 'down',
    why: 'epic · black nylon, orange ends, the zip ran open on the way out and the banded stacks show; the bag, literally',
    draw(G, ctx) { const BODY = 0x1d1d23, END = 0xee5a24, CASH = 0x3f8f45, BILL = 0x9ad28c;
      for (let z = -4; z <= 3; z++) for (let x = 5; x <= 8; x++) for (let y = 2; y <= 5; y++) {
        if ((x === 5 || x === 8) && (y === 2 || y === 5)) continue;               // a round body
        G.set(x, y, z, z === -4 || z === 3 ? END : BODY, 1); }
      for (let z = -2; z <= 1; z++) G.set(8, 4, z, CASH);                         // the open zip: stacks inside
      G.set(8, 5, -1, BILL); G.set(8, 5, 0, BILL);                                // bills riding up out of it
      hangers(G, END, 1); grip(G, ctx, END, 1); },
    fine(P) { const BAND = 0xf3e7b0, ZIP = 0xd9b23c, Wt = 0xffffff;
      for (let z = -2; z <= 1; z++) { for (let j = 0; j < 4; j++) P.at(8, 4, z, '+x', 1, j, BAND); P.at(8, 3, z, '+x', 0, 3, ZIP); P.at(8, 3, z, '+x', 2, 3, ZIP); }
      P.at(8, 3, 2, '+x', 3, 3, ZIP); P.at(8, 3, 2, '+x', 2, 2, ZIP);             // the pull
      P.bmp('+z', ['..x..', '.xxxx', 'x.x..', '.xxx.', '..x.x', 'xxxx.', '..x..'], { x: Wt }, 26, 19); },   // $ on the end panel
  },
  bail_case: {
    name: 'Bail Money Case', tier: 'rare', pose: 'down',
    why: 'rare · a ribbed aluminium attaché with black corners, the bondsman\'s yellow BAIL sticker slapped on the side',
    draw(G, ctx) { const AL = 0xc9cdd3, RIM = 0x2b2d33;
      bx(G, 6, 7, 2, 5, -4, 3, AL, 2);
      for (const x of [6, 7]) for (const y of [2, 5]) for (const z of [-4, 3]) G.set(x, y, z, RIM, 1);   // corner caps
      hangers(G, INK, 1); grip(G, ctx, INK, 1); },
    fine(P) { const RIB = 0x8d939c, GOLD = 0xe2b33a, Y = 0xf5c518, BLU = 0x2b46d6;
      P.rect('+x', -12, 13, 12, 14, RIB); P.rect('+x', -12, 18, 12, 19, RIB);     // the two ribs
      P.rect('+x', -11, 21, -9, 23, GOLD); P.rect('+x', 9, 21, 11, 23, GOLD);      // latches
      P.rect('+x', -8, 11, 9, 18, Y); say(P, '+x', 'BAIL', 7, 16, BLU); },         // the sticker
  },
  gas_can: {
    name: 'Last Chance Can', tier: 'common', pose: 'down',
    why: 'common · a red jerry can filled at the Last Chance on Route 9, yellow spout, the X pressed in the side; nobody asks',
    draw(G, ctx) { const R = 0xd92a20, Y = 0xf5c518;
      bx(G, 5, 7, 2, 5, -3, 2, R, 1); hangers(G, R, 1); grip(G, ctx, R, 1);
      G.set(6, 5, 3, Y, 1); G.set(6, 6, 3, Y, 1); },                              // the spout
    fine(P) { const D = shade(0xd92a20, .72);
      for (let t = 0; t <= 19; t++) { const a = 9 - t, b = 21 - Math.round(t * 11 / 19); P.paint('+x', a, b, D); P.paint('+x', a, 31 - b, D); }
      P.at(6, 6, 3, '+z', 1, 1, INK); P.at(6, 6, 3, '+z', 2, 1, INK); P.at(6, 6, 3, '+z', 1, 2, INK); P.at(6, 6, 3, '+z', 2, 2, INK); },
  },
  rooftop_coop: {
    name: 'Rooftop Coop', tier: 'rare', pose: 'down',
    why: 'rare · a teal pigeon carrier off a Glasswall roof, black wire, one white roller inside; the pigeon guys don\'t sell',
    draw(G, ctx) { const TEAL = 0x14a39a, WIRE = INK, BIRD = 0xf3f1ea;
      bx(G, 5, 8, 2, 2, -3, 2, TEAL, 1); bx(G, 5, 8, 5, 5, -3, 2, TEAL, 1);      // the tray and the roof
      for (const [x, z] of [[5, -3], [8, -3], [5, 2], [8, 2], [5, -1], [8, -1], [7, -3], [6, 2]])
        for (const y of [3, 4]) G.set(x, y, z, WIRE, 1);                           // the wire: corners and a bar mid-side
      hangers(G, WIRE, 1); grip(G, ctx, WIRE, 1);
      bx(G, 6, 7, 3, 3, -2, 0, BIRD); G.set(6, 4, 0, BIRD); G.set(7, 4, 0, BIRD); G.set(6, 4, 1, BIRD); G.set(7, 4, 1, BIRD); },   // the roller
    fine(P) { const GREY = 0x9aa0aa, EYE = 0xd8262b, BEAK = 0xf0b080, Wt = 0xffffff;
      for (const z of [-2, -1]) { P.at(7, 3, z, '+x', 0, 3, GREY); P.at(7, 3, z, '+x', 1, 3, GREY); P.at(7, 3, z, '+x', 2, 2, GREY); P.at(7, 3, z, '+x', 3, 2, GREY); }
      P.at(7, 4, 1, '+x', 1, 2, EYE); P.at(6, 4, 1, '-x', 2, 2, EYE);
      P.at(6, 4, 1, '+z', 3, 1, BEAK); P.at(7, 4, 1, '+z', 0, 1, BEAK);
      P.rect('+x', -12, 21, 12, 22, Wt); P.rect('+z', 20, 21, 36, 22, Wt); },      // a white line round the roof
  },

  snatched_piece: {
    name: 'Took It Off Him', tier: 'grail', pose: 'down',
    why: 'grail · somebody\'s iced-out 9 piece on a fat gold Cuban, dangling from the fist that snatched it',
    draw(G, ctx) { const GOLD = 0xe9b934;
      grip(G, ctx, GOLD, 2);
      for (const [y, z] of [[7, -3], [6, -3], [5, -3], [5, -2], [5, -1], [5, 0], [5, 1], [7, 2], [6, 2], [5, 2]]) G.set(6, y, z, GOLD, 2);   // the Cuban, out of the fist and under it
      for (let y = 2; y <= 4; y++) for (let z = -2; z <= 1; z++) { if ((y === 2 || y === 4) && (z === -2 || z === 1)) continue;
        G.set(6, y, z, GOLD, 2); G.set(7, y, z, GOLD, 2); } },                     // the piece, hung from the middle
    fine(P) { const GOLD = 0xffd75e, GD = 0xb98a1c, SP = [0xffffff, 0xbfe6ff, 0xe4f1ff, 0x9fb4c8];
      const on = (a, b) => { const z = a >> 2, y = b >> 2; return z >= -2 && z <= 1 && y >= 2 && y <= 4 && !((y === 2 || y === 4) && (z === -2 || z === 1)); };   // (its corners are cut)
      const ice = (a, b) => on(a, b) && on(a - 1, b) && on(a + 1, b) && on(a, b - 1) && on(a, b + 1) ? SP[((a * 7 + b * 13) & 7) % 4] : undefined;
      for (const f of ['+x', '-x']) P.rect(f, -8, 8, 8, 20, ice);                  // the ice in a gold rim, both sides
      say(P, '+x', '9', 2, 18, GOLD, 2); P.bmp('-x', rowsOf('9', 2), { x: GOLD }, -3, 18);
      P.rect('+z', 24, 12, 32, 16, (a, b) => SP[(a + b) % 4]);                      // the front edge, iced
      for (const [y, z] of [[7, -3], [6, -3], [5, -3], [5, -2], [5, -1], [5, 0], [5, 1], [7, 2], [6, 2], [5, 2]])
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) P.at(6, y, z, '+x', i, j, GD); },
  },

  // ════════════ FORWARD · the cylinder in the fist, pointing ahead ════════════
  lights_out: {
    name: 'Lights Out Torch', tier: 'common', pose: 'forward',
    why: 'common · a black metal torch for dark houses, the beam already on; what the night crew carries up the fire escape',
    draw(G, ctx) { const B = 0x222329, CH = 0x8d949e, LENS = 0xfff1b0;
      G.set(6, 7, -3, B, 1); grip(G, ctx, B, 1); G.set(6, 7, 2, B, 1);
      plus(G, 3, B, 1); sq3(G, 4, CH, 2); G.set(6, 7, 4, LENS, 3); },
    fine(P) { const Y = 0xf5c518;                                                // a yellow band below the bezel
      P.at(7, 7, 3, '+x', 0, 1, Y); P.at(7, 7, 3, '+x', 1, 1, Y); P.at(7, 7, 3, '+x', 2, 1, Y); P.at(7, 7, 3, '+x', 3, 1, Y);
      P.at(6, 6, 3, '-y', 0, 1, Y); P.at(6, 6, 3, '-y', 1, 1, Y); P.at(6, 6, 3, '-y', 2, 1, Y); P.at(6, 6, 3, '-y', 3, 1, Y);
      P.at(6, 7, -3, '-z', 1, 1, 0xd8262b); P.at(6, 7, -3, '-z', 2, 1, 0xd8262b); P.at(6, 7, -3, '-z', 1, 2, 0xd8262b); P.at(6, 7, -3, '-z', 2, 2, 0xd8262b); },
  },
  whole_car_can: {
    name: 'Whole Car Can', tier: 'common', pose: 'forward',
    why: 'common · a chrome spray can with a hot-pink fat cap, its own paint already run down the side; Neon Row\'s walls know it',
    draw(G, ctx) { const CAN = 0xc4c9d0, CAP = 0xff3d9a;
      sq3(G, -3, CAN, 2); grip(G, ctx, CAN, 2); for (const [x, y] of RING2) G.set(x, y, 2, CAN, 2); sq3(G, 3, CAN, 2); plus(G, 4, CAP, 1); },
    fine(P) { const PK = 0xff3d9a, Wt = 0xffffff;
      P.rect('+x', 12, 24, 16, 36, PK); P.rect('-x', 12, 24, 16, 36, PK); P.rect('-y', 20, 12, 32, 16, PK); P.rect('+y', 20, 12, 32, 16, PK);   // the band
      P.rect('+x', 9, 29, 12, 30, PK); P.rect('+x', 10, 33, 12, 34, PK); P.rect('-y', 23, 9, 24, 12, PK); P.rect('-y', 29, 10, 30, 12, PK);  // its drips
      P.rect('-z', 20, 24, 32, 36, (a, b) => (a + b) % 4 === 0 ? 0x8a9099 : undefined);                     // the base, ringed
      P.at(6, 7, 4, '+z', 1, 2, Wt); P.at(6, 7, 4, '+z', 2, 2, Wt); P.at(6, 7, 4, '+z', 1, 1, INK); P.at(6, 7, 4, '+z', 2, 1, INK); },
  },
  brown_bag: {
    name: 'Brown Bag Special', tier: 'common', pose: 'forward',
    why: 'common · whatever it is, it\'s in a brown paper bag, gold cap up; the stoop\'s oldest move',
    draw(G, ctx) { const K = 0xb8894f, GL = 0x5a3214, CAP = 0xe2b33a;
      bx(G, 5, 8, 5, 8, -3, -3, K); G.set(8, 8, -2, K); G.set(5, 5, -2, K);    // the bag round the bottle's base, behind the fist
      for (const [x, y] of RING2) if (!(x === 6 && y === 7)) G.set(x, y, 2, K);  // its crumpled top, round the neck
      grip(G, ctx, GL, 1); G.set(6, 7, 2, GL, 1); G.set(6, 7, 3, GL, 1); G.set(6, 7, 4, CAP, 2); },   // the neck and the cap
    fine(P) { const D = 0x8f6634;
      P.rect('-z', 20, 20, 36, 36, (a, b) => (a * 3 + b * 5) % 7 === 0 ? D : undefined);       // the creased base
      P.rect('+x', 8, 24, 12, 36, (a, b) => (a + b) % 3 === 0 ? D : undefined);
      P.rect('+x', -12, 20, -8, 36, (a, b) => (a + 2 * b) % 5 === 0 ? D : undefined);
      P.at(6, 7, 3, '+x', 1, 1, 0x8a5a2a); P.at(6, 7, 3, '+x', 1, 2, 0x8a5a2a); },             // a glint on the glass
  },
  chopped_cheese: {
    name: 'Chopped Cheese', tier: 'common', pose: 'forward',
    why: 'common · off the bodega grill on a hero, half out of the white paper: meat, cheese, lettuce, tomato',
    draw(G, ctx) { const PAPER = 0xf4f1e6, ROLL = 0xd9a45a, MEAT = 0x6b3a22;
      sq3(G, -3, PAPER); grip(G, ctx, PAPER); for (const [x, y] of RING2) G.set(x, y, 2, PAPER);
      for (const z of [3, 4]) for (let x = 5; x <= 7; x++) { G.set(x, 8, z, ROLL); G.set(x, 7, z, MEAT); G.set(x, 6, z, ROLL); } },
    fine(P) { const CRUST = 0xb7742f, BREAD = 0xf3dca6, LET = 0x5fb84a, TOM = 0xd8392b, CHEESE = 0xf5c02c, MEAT = 0x6b3a22;
      const end = ['cccccccccccc', 'bbbbbbbbbbbb', 'llllllllllll', 'tttmmmtttmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'hhhhhhhhhhhh', 'hhmhhhmhhhhm',
        'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'cccccccccccc'];
      P.bmp('+z', end, { c: CRUST, b: BREAD, l: LET, t: TOM, m: MEAT, h: CHEESE }, 20, 35);
      for (const z of [3, 4]) for (let i = 0; i < 4; i++) { P.at(7, 7, z, '+x', i, 3, LET); P.at(7, 7, z, '+x', i, 0, CHEESE); P.at(5, 7, z, '-x', i, 3, LET); P.at(5, 7, z, '-x', i, 0, CHEESE); }
      for (let i = 0; i < 4; i++) { P.at(7, 8, 3, '+x', i, 3, CRUST); P.at(7, 8, 4, '+x', i, 3, CRUST); }
      P.rect('+x', 8, 24, 12, 36, (a, b) => (a + b) % 3 === 0 ? 0xdcd6c4 : undefined); },                   // the torn paper edge
  },

  // ════════════ RAISED · up in front of the chest ════════════
  sing_sing_mic: {
    name: 'Sing Sing Mic', tier: 'rare', pose: 'raised',
    why: 'rare · the gold karaoke mic from SING SING on Neon Row (yes, like the prison); walked out with it at closing',
    draw(G, ctx) { const GOLD = 0xe2b33a, GR = 0xb9bfc7;
      grip(G, ctx, GOLD, 2); for (const [x, y] of [[6, 7], [7, 7], [6, 6], [7, 6]]) G.set(x, y, 2, GOLD, 2);
      sq3(G, 3, GR, 2); plus(G, 4, GR, 2); },
    fine(P) { const H = 0x3a3e46, GOLD = 0xe2b33a;
      const mesh = (x, y, z, f) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) P.at(x, y, z, f, i, j, H); };
      for (let y = 6; y <= 8; y++) { mesh(7, y, 3, '+x'); mesh(5, y, 3, '-x'); }
      for (let x = 5; x <= 7; x++) { mesh(x, 8, 3, '+y'); mesh(x, 6, 3, '-y'); }
      for (const [x, y] of [[6, 7], [5, 7], [7, 7], [6, 6], [6, 8]]) mesh(x, y, 4, '+z');
      for (const [x, y, f] of [[7, 7, '+x'], [7, 6, '+x'], [7, 6, '-y'], [6, 6, '-y']]) for (let i = 0; i < 4; i++) P.at(x, y, 2, f, i, 2, INK); },   // the collar's black line
  },
  lighters_up: {
    name: 'Lighters Up', tier: 'common', pose: 'raised',
    why: 'common · a chrome flip lighter, lid thrown open, flame up; Neon Row at 2 a.m.',
    draw(G, ctx) { const CH = 0xd0d4da, F1 = 0xffdd55, F2 = 0xff7a1a;
      grip(G, ctx, CH, 2); for (const [x, y] of [[6, 7], [7, 7], [6, 6], [7, 6]]) G.set(x, y, 2, CH, 2);
      G.set(7, 6, 3, CH, 2); G.set(7, 7, 3, CH, 2); G.set(6, 6, 3, CH, 2);       // the chimney
      for (const y of [6, 7]) for (const z of [2, 3]) G.set(8, y, z, CH, 2);      // the lid, open
      G.set(6, 7, 3, F1, 3); G.set(6, 7, 4, F2, 3); },                            // the flame
    fine(P) { const H = 0x5a5f66;
      for (const x of [6, 7]) for (const [i, j] of [[0, 1], [2, 1], [1, 3], [3, 3]]) P.at(x, 6, 3, '-y', i, j, H);   // the chimney's holes
      P.at(7, 7, 3, '+z', 1, 1, H); P.at(7, 7, 3, '+z', 2, 2, H); P.at(6, 6, 3, '+z', 1, 2, H); P.at(6, 6, 3, '+z', 2, 1, H); },
  },

  two_am_rose: {
    name: 'Two A.M. Rose', tier: 'common', pose: 'raised',
    why: 'common · the single red rose the man sells bar to bar on Neon Row at 2 a.m.; bought one, kept it',
    draw(G, ctx) { const STEM = 0x2c7d37, LEAF = 0x46b24f, RED = 0xd31c3a;
      grip(G, ctx, STEM); G.set(6, 7, 2, STEM); G.set(7, 7, 2, LEAF); G.set(8, 7, 2, LEAF);   // the stem, a leaf off it
      plus(G, 3, RED, 1); sq3(G, 4, RED, 1); },                                    // the bloom
    fine(P) { const D = 0x8f0f26, L = 0xff4a6a;
      P.bmp('+z', ['.LLLLLLLLLL.', 'LLDDDDDDDDLL', 'LDLLLLLLLLDL', 'LDLDDDDDDLDL', 'LDLDLLLLDLDL', 'LDLDLDDLDLDL', 'LDLDLLDLDLDL', 'LDLDDDDLDLDL', 'LDLLLLLLDLDL',
        'LDDDDDDDDLDL', 'LLLLLLLLLLDL', '.LLLLLLLLLL.'], { D, L }, 20, 35);                                  // the spiral, from above
      for (let y = 6; y <= 8; y++) { P.at(7, y, 4, '+x', 0, 1, D); P.at(7, y, 4, '+x', 1, 2, D); P.at(5, y, 4, '-x', 3, 1, D); }
      P.at(8, 7, 2, '+y', 1, 1, 0x2c7d37); P.at(8, 7, 2, '+y', 2, 2, 0x2c7d37); },
  },

  // ════════════ BOTH · held out front between the fists ════════════
  block_blaster: {
    name: 'Block Party Blaster', tier: 'epic', pose: 'both',
    why: 'epic · a candy-red boombox, chrome speakers and handle, tape deck in the middle, carried out front to the block party',
    draw(G, ctx) { const R = 0xd62f2a, CH = 0xc9ced6, GRIP = 0x1b1b20;
      bx(G, -5, 4, 5, 7, -1, 1, R, 1); bx(G, -3, 2, 6, 6, 2, 2, CH, 2); grip(G, ctx, GRIP, 1); },
    fine(P) { const CH = 0xd9dde3, CONE = 0x1b1c21, DECK = 0x26272d, Wt = 0xffffff, Y = 0xf5c518;
      for (const cx of [-14, 14]) disc(P, '-y', cx, 2, 6, d => d > 4.6 ? CH : d < 1.2 ? CH : d < 2.2 ? 0x3a3c44 : CONE);   // the speakers
      P.rect('-y', -8, -3, 8, 6, DECK); P.rect('-y', -6, 0, 6, 4, 0x3b3d46);         // the deck and its window
      for (const a of [-4, 2]) { P.rect('-y', a, 1, a + 2, 3, Wt); }                 // the reels
      P.rect('-y', -6, 5, 6, 6, Y);                                                  // the level lights
      for (let a = -6; a < 6; a += 3) P.rect('+z', a, 20, a + 2, 22, a < 0 ? INK : Y); },   // the keys on top
  },
  booking_board: {
    name: 'Booking Board', tier: 'rare', pose: 'both',
    why: 'rare · the Precinct 9 letterboard from the mugshot, held up like a trophy; you only get one by doing it',
    draw(G, ctx) { const B = 0x1d1d22; bx(G, -5, 4, 7, 7, -1, 2, B); grip(G, ctx, B); },
    fine(P) { const Wt = 0xf2f2ee; say(P, '-y', 'PRECINCT 9', -20, 10, Wt); say(P, '-y', '#041926', -14, 3, Wt);
      P.rect('-y', -18, -3, 18, -2, 0x8a8d94); },
  },
  title_belt: {
    name: 'Drip Ladder Title', tier: 'grail', pose: 'both',
    why: 'grail · the championship belt for the top of the Drip Ladder: gold plate, red enamel, stones; one exists a season',
    draw(G, ctx) { const GOLD = 0xe9b934, LEA = 0x18181c;
      bx(G, -5, 4, 7, 7, -1, 0, LEA, 1); grip(G, ctx, LEA, 1);                     // the strap, through both fists
      for (let x = -4; x <= 3; x++) for (let z = -1; z <= 2; z++) { if ((x === -4 || x === 3) && (z === -1 || z === 2)) continue; G.set(x, 6, z, GOLD, 2); }   // the plate
      bx(G, -2, 1, 5, 5, 0, 2, GOLD, 2); },                                        // the centre, raised
    fine(P) { const EN = 0xc8202b, GOLD = 0xffd75e, GEMS = [0xe0263a, 0x2bb3ff, 0x3ccf6a, 0xffffff];
      P.rect('-y', -7, 1, 7, 11, EN); say(P, '-y', 'DRIP', -7, 8, GOLD);         // the enamel centre
      let k = 0; const gem = (x, z) => { const c = GEMS[k++ % 4]; P.rect('-y', 4 * x + 1, 4 * z + 1, 4 * x + 3, 4 * z + 3, c); };
      for (let x = -3; x <= 2; x++) gem(x, -1); for (const z of [0, 1]) { gem(-4, z); gem(3, z); } gem(-3, 2); gem(2, 2); gem(-3, 1); gem(2, 1); },
  },
  stolen_safe: {
    name: 'Walked Out With It', tier: 'epic', pose: 'both',
    why: 'epic · a green steel safe with the SMITH maker\'s plate, carried out the front door; open it later',
    draw(G, ctx) { const S = 0x24483a; bx(G, -3, 2, 5, 8, -1, 2, S, 1);
      for (const x of [3, 4, -4, -5]) G.set(x, 7, -1, INK, 1); grip(G, ctx, INK, 1); },   // the side grips
    fine(P) { const GOLD = 0xe2b33a, SEAM = 0x16302a, CH = 0xd9dde2;
      P.rect('-y', -12, -4, 12, 12, (a, b) => a === -12 || a === 11 || b === -4 || b === 11 ? GOLD : undefined);   // the pinstripe
      P.rect('-y', -10, -2, 10, 10, (a, b) => a === -10 || a === 9 || b === -2 || b === 9 ? SEAM : undefined);     // the door
      say(P, '-y', 'SMITH', -9, 8, GOLD);
      disc(P, '-y', -4, 0, 3, d => d > 2.2 ? INK : CH);
      P.rect('-y', 1, -1, 8, 0, CH);
      P.halfBox(-3, 9, -1, -1, 10, 1, CH, 2);                                      // the dial's knob
      P.halfBox(1, 9, -1, 4, 10, 0, CH, 2); },                                     // the lever
  },

  // ════════════ ROUND 2 ════════════
  side_box: {
    name: 'Hand-Me-Down Box', tier: 'rare', pose: 'down',
    why: 'rare · the silver boombox out of an uncle\'s closet, carried one-handed by its handle down the block, antenna up, still plays',
    draw(G, ctx) { const AL = 0xbfc4cb, CH = 0xe3e6ea;
      bx(G, 5, 7, 2, 5, -4, 3, AL, 2); hangers(G, CH, 2); grip(G, ctx, CH, 2);
      for (let y = 6; y <= 8; y++) G.set(7, y, -4, CH, 2); },                     // the antenna, up behind the fist
    fine(P) { const CONE = 0x1b1c21, RING = 0xf2f3f5, DK = 0x2a2c33, R = 0xe23b2b, Y = 0xf5c518;
      for (const c of [10, -10]) disc(P, '+x', c, 15, 5.5, d => d > 4.4 ? RING : d < 1.3 ? RING : d < 2.3 ? 0x40434b : CONE);   // the speakers
      P.rect('+x', -4, 11, 4, 20, DK); P.rect('+x', -3, 13, 3, 17, 0x4a4d56); P.rect('+x', -2, 14, -1, 16, 0xffffff); P.rect('+x', 1, 14, 2, 16, 0xffffff);   // the deck
      P.rect('+x', -3, 18, 3, 19, R); P.rect('+x', -16, 21, 16, 22, DK);
      for (let a = 20; a < 32; a += 3) P.rect('+y', a, -4, a + 2, -2, a < 26 ? INK : Y); },   // the keys on top
  },
  big_face_wad: {
    name: 'Big Face Wad', tier: 'epic', pose: 'forward',
    why: 'epic · a brick of hundreds, every note squared up, a gold bank strap round the middle, held out front; count it again',
    // ONE brick of notes, 3 wide × 2 thick × 8 long (x 5..7, y 6..7, z −3..4): the same footprint at every slice, front, back and top.
    // The fist closes round its middle (inside the fist only the channel is the wad's); the thumb presses on its top corner at z 2.
    draw(G, ctx) { const NOTE = 0x8fbf78;
      for (let z = -3; z <= 4; z++) for (let x = 5; x <= 7; x++) for (const y of [6, 7]) {
        if (z >= -2 && z <= 1 && !(x === 6 && y === 7)) continue; if (x === 5 && y === 7 && z === 2) continue;
        G.set(x, y, z, NOTE); } },
    fine(P) { const INKG = 0x234a2a, PORT = 0xdbe9c8, OVAL = 0x3f6e3c, BAND = 0xd8b24a, BAND2 = 0x8a6a22, PAPER = 0xf0f4e4, EDGE = 0x7fae6c;
      // the top and bottom notes (+y / −y: a = x quarter 20..31, b = z quarter −12..19): border, portrait oval, corner roundels,
      // the 100 at the back, the bank strap at z 2 (just in front of the fist)
      const note = (a, b) => {
        if (b >= 8 && b <= 10) return b === 9 && (a & 1) ? BAND2 : BAND;
        if (a === 20 || a === 31 || b === -12 || b === 19) return INKG;
        const e = ((a + .5 - 26) / 2.7) ** 2 + ((b + .5 - 14.5) / 3.3) ** 2; if (e < .5) return PORT; if (e < 1) return OVAL;
        if (b >= 16 && b <= 17 && (a === 21 || a === 22 || a === 29 || a === 30)) return OVAL;   // the front corner roundels
        if (b >= -11 && b <= -9) { const c = ['x.xxx.xxx', 'x.x.x.x.x', 'x.xxx.xxx'][b + 11][a - 21]; return c === 'x' ? INKG : undefined; }   // 100
        return undefined; };
      for (const f of ['+y', '-y']) { P.rect(f, 20, -12, 32, -8, note); P.rect(f, f === '+y' ? 24 : 20, 8, 32, 12, note); P.rect(f, 20, 12, 32, 20, note); }
      // the paper edges: the sides and both ends, layered row by row; the strap carries round the sides
      const edges = (a, b) => (b & 1 ? PAPER : EDGE);
      for (const f of ['+x', '-x']) { P.rect(f, -12, 24, -8, 32, edges); P.rect(f, 12, 24, 20, 32, edges);
        P.rect(f, 8, 24, 12, f === '-x' ? 28 : 32, (a, b) => a <= 10 ? (b & 1 ? BAND : BAND2) : edges(a, b)); }
      P.rect('+z', 20, 24, 32, 32, edges); P.rect('-z', 20, 24, 32, 32, edges); },
  },
  fat_cap: {
    name: 'Fat Cap Can', tier: 'common', pose: 'forward',
    why: 'common · a black can of lime with a fat cap, mid-spray, the cloud hanging off the nozzle; Whole Car\'s louder cousin',
    draw(G, ctx) { const K = 0x1c1d22, LIME = 0xb6f23a, MIST = 0xd6ff86;
      sq3(G, -3, K, 1); grip(G, ctx, K, 1); for (const [x, y] of RING2) G.set(x, y, 2, K, 1);
      plus(G, 3, LIME, 1);                                                         // the cap
      for (const [x, y] of [[6, 7], [7, 7], [6, 8], [7, 8]]) G.set(x, y, 4, MIST); },   // the spray, leaving it
    fine(P) { const LIME = 0xb6f23a, MIST = 0xd6ff86, Wt = 0xffffff, RIM = 0x9aa0a8;
      let n = 0; for (const hz of [8, 9]) for (let hx = 10; hx <= 17; hx++) for (let hy = 10; hy <= 17; hy++) {   // the cloud's ragged edge, round the core
        if (hx >= 12 && hx <= 15 && hy >= 14) continue; const d = Math.hypot(hx + .5 - 14, hy + .5 - 16);
        if (d < (hz === 8 ? 3.4 : 2.6) && n < 30) { P.half(hx, hy, hz, MIST); n++; } }
      P.rect('+x', 8, 33, 12, 36, LIME); P.rect('+x', 9, 29, 10, 33, LIME); P.rect('+x', 11, 31, 12, 33, LIME);   // drips down the can
      P.rect('-y', 20, 9, 32, 12, LIME);
      P.rect('-z', 20, 24, 32, 36, (a, b) => a === 20 || a === 31 || b === 24 || b === 35 ? RIM : undefined);
      P.at(6, 8, 3, '+y', 1, 1, Wt); P.at(6, 8, 3, '+y', 2, 1, Wt); P.at(6, 8, 3, '+y', 1, 2, Wt); P.at(6, 8, 3, '+y', 2, 2, Wt); },   // the nozzle
  },
  copper_run: {
    name: 'Copper Run', tier: 'common', pose: 'down',
    why: 'common · a coil of copper stripped out of the dead mall\'s walls, taped twice, on its way to the Heap at 3.10',
    draw(G, ctx) { const CU = 0xe2853f, TAPE = INK;
      grip(G, ctx, CU, 1);
      const ring = [[7, -3], [7, 2], [6, -3], [6, 2], [5, -4], [5, -3], [5, 2], [5, 3], [4, -4], [4, 3], [3, -4], [3, -3], [3, 2], [3, 3], [2, -3], [2, -2], [2, -1], [2, 0], [2, 1], [2, 2]];
      for (const [y, z] of ring) for (const x of [6, 7]) G.set(x, y, z, (y === 4 && z === -4) || (y === 2 && z === 0) ? TAPE : CU, 1); },
    fine(P) { const DK = 0xa8582a, HI = 0xffb27a;
      for (const [y, z] of [[7, -3], [7, 2], [6, -3], [6, 2], [5, -4], [5, -3], [5, 2], [5, 3], [4, 3], [3, -4], [3, -3], [3, 2], [3, 3], [2, -3], [2, -2], [2, -1], [2, 1], [2, 2]])
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const k = (i + j) % 4; if (k === 0 || k === 2) P.at(7, y, z, '+x', i, j, k ? HI : DK); } },   // the windings
  },
  shack_lantern: {
    name: 'Blackpine Lantern', tier: 'common', pose: 'down',
    why: 'common · a green tin lantern for the cook shacks out in Blackpine, the globe lit amber behind its wire cage',
    draw(G, ctx) { const GR = 0x2f5b3a, AMB = 0xffc35a;
      bx(G, 5, 7, 2, 2, -2, 1, GR, 2); bx(G, 5, 7, 3, 4, -2, 1, AMB, 3); bx(G, 5, 7, 5, 5, -2, 1, GR, 2);
      G.set(6, 5, -3, INK, 2); G.set(6, 5, 2, INK, 2); hangers(G, INK, 2); grip(G, ctx, INK, 2); },   // the bail
    fine(P) { const W = 0x2a2a2e, bar = (a, b) => (a & 7) === 6 ? W : undefined;   // a wire every other voxel
      P.rect('+x', -8, 12, 8, 20, bar); P.rect('-x', -8, 12, 8, 20, bar); P.rect('+z', 20, 12, 32, 20, bar); P.rect('-z', 20, 12, 32, 20, bar); },
  },
  purse_dog: {
    name: 'Purse Dog', tier: 'epic', pose: 'down',
    why: 'epic · a lilac croc top-handle bag from Gatehill, gold hardware, and the little white dog in it is coming everywhere',
    draw(G, ctx) { const LIL = 0xb48be6, GOLD = 0xe2b33a, DOG = 0xf6f3ec;
      bx(G, 5, 7, 2, 4, -4, 2, LIL, 1); hangers(G, GOLD, 2, 5); grip(G, ctx, GOLD, 2);
      bx(G, 8, 8, 4, 5, -4, -3, DOG); },                                            // the dog, out of the side pocket
    fine(P) { const DK = 0x8f68c4, GOLD = 0xe2b33a, DOG = 0xf6f3ec;
      P.rect('+x', -8, 8, 12, 20, (a, b) => ((a >> 1) + (b >> 1)) % 2 ? DK : undefined);   // croc
      P.rect('+x', -2, 16, 3, 19, GOLD);                                            // the clasp
      P.bmp('+x', ['........', '.kk..kk.', '.kw..kw.', '........', '...kk...', '..pkkp..', '...pp...', '........'], { k: INK, w: 0xffffff, p: 0xf28aa0 }, -9, 23);   // its face
      P.half(16, 12, -8, DOG); P.half(16, 12, -5, DOG); },                          // its ears
  },
  off_the_wire: {
    name: 'Off the Wire', tier: 'epic', pose: 'down',
    why: 'epic · one deadstock hi-top hung by its laces, sail and cobalt with a gold 9 on the collar; never touched pavement',
    draw(G, ctx) { const SAIL = 0xf1ead8, COB = 0x2f4fd8, SOLE = 0xf7f5ef, LACE = 0xffffff;
      bx(G, 5, 7, 2, 2, -4, 3, SOLE); bx(G, 5, 7, 3, 3, -4, 3, SAIL); bx(G, 5, 7, 4, 4, -4, 1, SAIL); bx(G, 5, 7, 5, 5, -4, -2, COB);   // sole, upper, hi collar
      bx(G, 5, 7, 3, 3, 2, 3, COB); bx(G, 5, 7, 3, 4, -4, -4, COB);               // toe cap, heel
      G.del(5, 3, 3); G.del(7, 3, 3);                                              // a rounder toe
      for (let y = 4; y <= 7; y++) G.set(6, y, 2, LACE); for (const y of [6, 7]) G.set(6, y, -3, LACE); grip(G, ctx, LACE); },   // the laces, knotted through the fist
    fine(P) { const GUM = 0xc98a4a, COB = 0x2f4fd8, GOLD = 0xe2b33a;
      P.rect('+x', -16, 8, 16, 10, GUM); P.rect('-x', -16, 8, 16, 10, GUM);
      P.rect('+x', -9, 12, 2, 18, (a, b) => b === 12 + Math.floor((a + 9) / 2) || b === 13 + Math.floor((a + 9) / 2) ? COB : undefined);   // the side stripe
      say(P, '+x', '9', -9, 23, GOLD); },
  },
  armored_sack: {
    name: 'Armored Truck Sack', tier: 'grail', pose: 'down',
    why: 'grail · a grey canvas bank sack off the back of an armored truck, a big black $ on it, the lead seal still on the knot',
    draw(G, ctx) { const CAN = 0xa9a596, SEAL = 0x7d8288;
      for (let y = 2; y <= 5; y++) for (let z = -3; z <= 2; z++) for (let x = 5; x <= 8; x++) {
        const edgeX = x === 5 || x === 8, endZ = z === -3 || z === 2;
        if (endZ && (edgeX || y === 2 || y === 5)) continue; if (y === 5 && edgeX) continue;   // a round sack, gathered at the top
        G.set(x, y, z, CAN); }
      hangers(G, CAN, 0, 5); grip(G, ctx, CAN); G.set(7, 7, 2, SEAL, 2); },              // the gathered neck and its seal
    fine(P) { const K = 0x1b1b20, D = 0x8e8a7c;
      P.bmp('+x', ['..xx......', '..xx......', 'xxxxxxxx..', 'xx..xx....', 'xx..xx....', 'xxxxxxx...', '..xx..xx..', '..xx..xx..', 'xxxxxxxxx.', '..xx......', '..xx......']
        .map(r => r.split('').reverse().join('')), { x: K }, 6, 19);                 // the $
      P.rect('-x', -8, 8, 8, 20, (a, b) => (a * 5 + b * 3) % 11 === 0 ? D : undefined);
      P.rect('+z', 24, 12, 32, 20, (a, b) => (a * 5 + b * 3) % 11 === 0 ? D : undefined); },
  },
  precinct_dozen: {
    name: 'Precinct 9 Dozen', tier: 'common', pose: 'both',
    why: 'common · a pink box of a dozen, lid up, carried back to Precinct 9 in both hands like evidence',
    draw(G, ctx) { const PINK = 0xf49ac1, LID = 0xf7b6d2, DOUGH = 0xe0a35a;
      bx(G, -5, 4, 4, 8, -1, -1, PINK); bx(G, -5, 4, 8, 8, 0, 2, LID); grip(G, ctx, PINK);   // the box, its lid up
      for (const x0 of [-4, -2, 0, 2]) bx(G, x0, x0 + 1, 4, 5, 0, 0, DOUGH); },     // the front row
    fine(P) { const ICE = [0xff7eb6, 0x5a3220, 0xf7e3a8, 0xff7eb6], HOLE = 0x9a6a36, Wt = 0xffffff, SPR = [0x3fd1ff, 0xf5c518, 0x7be04a];
      [-4, -2, 0, 2].forEach((x0, i) => disc(P, '+z', 4 * x0 + 4, 20, 3.6, d => d < 1.2 ? HOLE : d < 3.1 ? (i === 0 && ((d * 7) | 0) % 3 === 0 ? SPR[(d * 5 | 0) % 3] : ICE[i]) : undefined));   // the icing
      [-4, -2, 0, 2].forEach((x0, i) => disc(P, '+z', 4 * x0 + 4, 28, 3.6, d => d < 1.2 ? 0x8a5a2a : d < 3.4 ? ICE[(i + 1) % 4] : undefined));   // the back row
      say(P, '-y', 'DONUTS', -12, 10, Wt); P.rect('-y', -12, 3, 11, 4, Wt); },
  },
  wash_day: {
    name: 'Wash Day', tier: 'common', pose: 'both',
    why: 'common · a blue laundry basket out of the Sunny Acres wash house, somebody\'s whites and a red hoodie on top',
    draw(G, ctx) { const BL = 0x3fa9f5, CL = [0xf4f4f0, 0xd8262b, 0xf5c518, 0x7b4bd6, 0x3b5b9a, 0xf4f4f0];
      bx(G, -4, 3, 4, 8, -1, -1, BL, 1);                                            // the floor
      for (let x = -4; x <= 3; x++) for (let y = 4; y <= 8; y++) if (x === -4 || x === 3 || y === 4 || y === 8) { G.set(x, y, 0, BL, 1); G.set(x, y, 1, BL, 1); }
      G.set(4, 7, -1, BL, 1); G.set(-5, 7, -1, BL, 1); grip(G, ctx, BL, 1);         // the side grips
      for (let x = -3; x <= 2; x++) for (let y = 5; y <= 7; y++) G.set(x, y, 1, CL[(x * 3 + y * 5 + 40) % 6]);   // the wash
      for (const [x, y] of [[-1, 6], [0, 6], [0, 5], [1, 7], [-2, 7]]) G.set(x, y, 2, x === 1 ? 0xf4f4f0 : 0xd8262b); },
    fine(P) { const H = 0x1f5f9a;
      P.rect('-y', -16, -4, 16, 8, (a, b) => b >= 0 && (a & 3) === 1 && (b & 3) !== 3 && b < 7 ? H : undefined); },   // the lattice
  },
  bodega_cat: {
    name: 'Bodega Cat', tier: 'rare', pose: 'both',
    why: 'rare · the deli\'s ginger cat, carried out the door like a loaf; it allows this for exactly one block',
    draw(G, ctx) { const GIN = 0xe88a3a;
      bx(G, -5, 4, 5, 7, -1, 1, GIN); G.del(-2, 5, 1); G.del(-2, 7, 1);          // the loaf, a neck
      G.set(-5, 6, 2, GIN); G.set(-3, 6, 2, GIN); G.set(4, 6, 2, GIN); G.set(3, 6, 2, GIN); grip(G, ctx, GIN); },   // ears, the tail curled up
    fine(P) { const ST = 0xb85f1e, Wt = 0xffffff;
      P.rect('+z', -4, 20, 20, 32, (a, b) => a % 6 < 2 ? ST : undefined);          // the tabby stripes
      P.rect('-y', -4, -4, 20, 8, (a, b) => a % 6 < 2 && b > -3 ? ST : b < -2 && (a < 0 || a > 15) ? Wt : undefined);   // ...and white socks
      P.bmp('-y', ['............', '............', '.ggg....ggg.', '.gkg....gkg.', '.ggg....ggg.', '............', '.....pp.....', 'w...wppw...w', '.wwwwwwwwww.', '..ww.ww.ww..', '............', '............'],
        { g: 0x9ad94a, k: INK, p: 0xf28aa0, w: Wt }, -20, 7);
      P.rect('+z', -20, 24, -16, 28, 0xf28aa0); P.rect('+z', -12, 24, -8, 28, 0xf28aa0); },   // the inside of the ears
  },
  jimmy_bar: {
    name: 'Jimmy Bar', tier: 'common', pose: 'forward',
    why: 'common · a red pry bar with black claws; the dark houses on Pine St open with it',
    draw(G, ctx) { const R = 0xc8262a, K = 0x26272c;
      G.set(6, 7, -3, K, 2); G.set(6, 8, -3, K, 2);                                // the flat claw, behind the fist
      grip(G, ctx, R, 1); for (const z of [2, 3, 4]) G.set(6, 7, z, R, 1);
      G.set(6, 6, 4, K, 2); G.set(6, 5, 4, K, 2); G.set(6, 5, 3, K, 2); },         // the hook, curling back
  },
  rocket_pop: {
    name: 'Rocket Pop', tier: 'common', pose: 'raised',
    why: 'common · a red, white and blue ice pop off the Pleasantview truck, already running down the stick',
    draw(G, ctx) { const STICK = 0xe2c48f, R = 0xe2262f, Wt = 0xf6f4ee, B = 0x2b5fe0;
      grip(G, ctx, STICK); G.set(6, 7, 2, STICK);
      for (let x = 6; x <= 8; x++) for (const y of [6, 7]) { if (!(x === 6 && y === 7)) G.set(x, y, 2, B, 1); G.set(x, y, 3, Wt, 1); G.set(x, y, 4, R, 1); }
      G.set(6, 7, 2, B, 1); },                                                      // (the stick runs up into it)
    fine(P) { const R = 0xe2262f, B = 0x2b5fe0;
      P.rect('-y', 24, 12, 36, 13, R); P.rect('-y', 25, 13, 26, 14, R); P.rect('-y', 31, 13, 32, 15, R); },   // the melt, running
  },

  // ════════════ ROUND 3 · one-handed ════════════
  st_mercy_bag: {
    name: 'St. Mercy Belongings', tier: 'common', pose: 'down',
    why: 'common · the white drawstring bag St. Mercy hands back on the way out: your clothes, your wallet, minus whatever they took',
    draw(G, ctx) { const W = 0xf2f4f6, BL = 0x2b5fd8; bx(G, 5, 7, 2, 5, -4, 3, W, 1); hangers(G, BL); grip(G, ctx, BL); },
    fine(P) { const BL = 0x2b5fd8; say(P, '+x', 'ST MERCY', 15, 22, BL); say(P, '+x', 'PATIENT', 13, 15, BL);
      P.rect('+z', 25, 12, 27, 20, BL); P.rect('+z', 22, 15, 30, 17, BL); },        // St. Mercy's blue plus on the end
  },
  smith_box: {
    name: 'Smith\'s Box', tier: 'rare', pose: 'down',
    why: 'rare · the smith\'s red steel toolbox, SMITH stenciled on the side: locks, steel doors, safes, whatever else',
    draw(G, ctx) { const R = 0xc8262a, CH = 0xd9dde2; bx(G, 5, 7, 2, 4, -4, 3, R, 1); bx(G, 5, 7, 5, 5, -3, 2, R, 1); hangers(G, CH, 2); grip(G, ctx, CH, 2); },
    fine(P) { const K = 0x1b1b20, Wt = 0xffffff, CH = 0xd9dde2;
      P.rect('+x', -16, 18, 16, 19, K); say(P, '+x', 'SMITH', 9, 15, Wt);          // the lid seam, the stencil
      P.rect('+x', -14, 16, -11, 18, CH); P.rect('+x', 11, 16, 14, 18, CH); },      // the latches
  },
  low_tide_catch: {
    name: 'Low Tide Catch', tier: 'rare', pose: 'down',
    why: 'rare · a striped bass off the Low Tide fish market, carried home on a loop of twine through the gill',
    draw(G, ctx) { const S = 0xa9b3be, BELLY = 0xeef1f3, TW = 0xc9a36a;
      bx(G, 6, 7, 3, 4, -2, 3, S); bx(G, 6, 7, 2, 2, -1, 2, BELLY);                // the body, the belly; the head at z 3
      G.set(6, 5, -1, S); G.set(6, 5, 0, S); G.set(6, 3, -3, S); G.set(6, 4, -3, S); // the dorsal fin, the tail's wrist
      for (const y of [2, 3, 4, 5]) G.set(6, y, -4, S);                            // the tail
      grip(G, ctx, TW); for (const y of [5, 6, 7]) G.set(6, y, 2, TW); },          // the twine, through the gill
    fine(P) { const D = 0x3f4a57, Wt = 0xffffff;
      P.rect('+x', -8, 14, 12, 15, D); P.rect('+x', -8, 17, 12, 18, D);            // the stripes
      P.rect('+y', 24, -8, 32, 12, D); P.at(7, 4, 3, '+x', 1, 2, INK); P.at(7, 4, 3, '+x', 2, 2, Wt); P.at(7, 4, 3, '+x', 1, 3, Wt);
      P.rect('+x', 11, 12, 12, 19, 0x7c8792); },                                    // the eye, the gill line
  },
  dock_cooler: {
    name: 'Dock Shift Cooler', tier: 'common', pose: 'down',
    why: 'common · the white and blue cooler that rides the dock shift: lunch, ice, two cold ones; LOCAL on the side',
    draw(G, ctx) { const Wt = 0xf4f5f2, BL = 0x2a7de1; bx(G, 5, 8, 2, 4, -3, 2, Wt, 1); bx(G, 5, 8, 5, 5, -3, 2, BL, 1); hangers(G, BL, 1); grip(G, ctx, BL, 1); },
    fine(P) { const BL = 0x2a7de1; P.rect('+x', -12, 8, 12, 9, BL); say(P, '+x', 'LOCAL', 9, 17, BL); P.rect('+z', 20, 8, 36, 9, BL); },
  },
  car_battery: {
    name: 'Chop Shop Battery', tier: 'common', pose: 'down',
    why: 'common · a car battery walked out of the chop shop in the Yards by its strap, red post and grey post, still holds a charge',
    draw(G, ctx) { const K = 0x26272c; bx(G, 5, 7, 2, 4, -3, 2, K, 1); hangers(G, INK, 1, 5); grip(G, ctx, INK, 1);
      G.set(7, 5, -2, 0xd8262b, 1); G.set(7, 5, 1, 0x8a9099, 2); },                 // the posts
    fine(P) { const Y = 0xf5c518; P.rect('+x', -10, 9, 10, 17, Y); say(P, '+x', 'VOLT', 7, 15, INK); },   // the label
  },
  orange_drink: {
    name: 'Orange Drink', tier: 'common', pose: 'down',
    why: 'common · a whole gallon of bodega orange drink, cap on, swinging by its handle; it\'s for the house',
    draw(G, ctx) { const OR = 0xff8a1f; bx(G, 5, 7, 2, 5, -3, 2, OR, 1); hangers(G, OR, 1); grip(G, ctx, OR, 1); G.set(5, 6, 2, 0xf7f7f2, 1); },   // the jug, its cap
    fine(P) { const Wt = 0xf7f7f2; P.rect('+x', -12, 12, 12, 19, Wt); say(P, '+x', 'ORANGE', 11, 17, 0xe2401f); },
  },
  count_machine: {
    name: 'Count Machine', tier: 'epic', pose: 'down',
    why: 'epic · the dealer\'s bill counter carried by its handle, 10K glowing on the display, a stack still in the hopper',
    draw(G, ctx) { const GR = 0xc9c6be, DK = 0x3a3c42, LCD = 0x0f3a1c, BILL = 0x8fbf78;
      bx(G, 5, 7, 2, 2, -4, 2, DK, 1); bx(G, 5, 7, 3, 5, -4, 2, GR, 1);
      for (let z = -1; z <= 1; z++) for (const y of [3, 4]) G.set(7, y, z, LCD, 3);  // the display
      for (let x = 5; x <= 7; x++) G.set(x, 6, -4, BILL);                            // a stack in the hopper
      hangers(G, INK, 1); grip(G, ctx, INK, 1); },
    fine(P) { say(P, '+x', '10K', 5, 18, 0x6dff8a); P.rect('+y', 20, -16, 32, -12, (a, b) => b & 1 ? 0xeef3e2 : undefined); },
  },
  monogram_weekender: {
    name: 'Monogram Weekender', tier: 'grail', pose: 'down',
    why: 'grail · a cobalt monogram weekender, tan leather and gold hardware, from a Gatehill boutique with no sign; the lock tag swings',
    draw(G, ctx) { const CAN = 0x2b46a8, TAN = 0xc98a4a, GOLD = 0xe2b33a;
      for (let z = -4; z <= 3; z++) for (let x = 5; x <= 8; x++) for (let y = 2; y <= 5; y++) {
        if ((x === 5 || x === 8) && (y === 2 || y === 5)) continue; G.set(x, y, z, z === -4 || z === 3 ? TAN : CAN, 1); }
      hangers(G, TAN, 1); grip(G, ctx, TAN, 1); G.set(8, 5, 2, GOLD, 2); },           // the handles, the lock tag
    fine(P) { const GOLD = 0xe2b33a, CREAM = 0xf1e6cc, TAN = 0xc98a4a;
      const mono = (a, b) => { const i = a & 3, j = b & 3, c = ((a >> 2) + (b >> 2)) & 1;
        if (c === 0 && (i === 1 || i === 2) && (j === 1 || j === 2)) return GOLD; if (c === 1 && ((i === 1 && j === 2) || (i === 2 && j === 1))) return CREAM; return undefined; };
      P.rect('+x', -12, 12, 12, 20, mono); P.rect('-x', -12, 12, 12, 20, mono); P.rect('+y', 24, -12, 32, 12, mono);
      P.rect('+x', -12, 12, 12, 13, TAN); P.rect('-x', -12, 12, 12, 13, TAN); },    // the leather piping
  },
  tallboy: {
    name: '99 Tallboy', tier: 'common', pose: 'forward',
    why: 'common · a 99-cent tallboy of lemon tea off the bodega cooler, sweating, top popped',
    draw(G, ctx) { const Y = 0xf5c518, AL = 0xc9ced6;
      sq3(G, -3, AL, 2); grip(G, ctx, Y, 1); for (const [x, y] of RING2) G.set(x, y, 2, Y, 1); sq3(G, 3, Y, 1); sq3(G, 4, AL, 2); },
    fine(P) { const R = 0xe2262f;
      P.rect('+x', 8, 26, 16, 28, R); say(P, '+x', '99', 15, 34, INK);
      P.rect('-y', 20, 10, 32, 12, R); P.rect('+z', 24, 30, 28, 33, 0x7a8088); P.rect('+z', 25, 26, 28, 28, INK); },   // the band, the price, the popped top
  },
  squeegee: {
    name: 'Squeegee', tier: 'common', pose: 'forward',
    why: 'common · the squeegee man\'s tool, yellow handle and black rubber, coming at the windshield at the Route 9 light',
    draw(G, ctx) { const Y = 0xf5c518, ST = 0xb8bec6, K = 0x1b1b20;
      G.set(6, 7, -3, Y, 1); grip(G, ctx, Y, 1); G.set(6, 7, 2, Y, 1); G.set(6, 7, 3, ST, 2);
      for (let x = 5; x <= 8; x++) { G.set(x, 7, 4, ST, 2); G.set(x, 6, 4, K, 1); } },   // the blade: steel over black rubber
  },
};
