// Opus hair: thirteen new cuts for AI City (slime: "more hair"), ids opus_*, studio origin 'opus'.
// The kept cuts stay as they are (afro, buzz, spikes, swoop, buns, dreads, long, mohawk, braids, leopard). chars.js installs
// this with one call: installOpusHair({ HAIR, NEWT, NEWI, NAMES }).
//
// Coordinates are chars.js head voxels: head x −8…7, y 19…33, z −7…7 (the face is z 7), ears x −10…−9 / 8…9, y 23…27, z −1…1.
// Fit rules every cut here follows (world/fit/contract.js, world/fit/layers.js):
//   · every voxel is face-connected to the scalp, so a hat's cover can clip it (layers.js clipHair) and whatever survives under
//     the hat stays joined: what hangs below a cap (the mullet, the pony, the cornrow tails, the bowl's sides) hugs the head;
//   · the ear items' cells stay clear (x −11 / 10 round the lobe, y 17…28, z −2…2) unless the cut hides the ears outright; the
//     one that does (the skate mop) joins contract EARS_COVERED, like `long`;
//   · nothing sits where the headphones' cups (z −3…3, y 21…29) or band (z 0…1) pass, so bunches, knots and rollers sit behind;
//   · nothing on the face plane below the brows (eyewear frames are z 8, y 23…28);
//   · geometry is mirror-symmetric (x ↔ −1 − x): colour may differ side to side, shape never by a few voxels.
import { EARS_COVERED } from '../contract.js';

const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const lerp = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const cwPick = (cw, p) => cw[((((p && p.cw) | 0) % cw.length) + cw.length) % cw.length];
// a cell is a colour or [colour, layer] (0 matte · 1 gloss · 2 metal); null leaves the voxel alone
const put = (H, x, y, z, c) => { if (c === null || c === undefined) return; if (Array.isArray(c)) H.set(x, y, z, c[0], c[1]); else H.set(x, y, z, c); };
// inclusive box; f is a cell or (x, y, z) → cell
const fill = (H, x0, x1, y0, y1, z0, z1, f) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(H, x, y, z, typeof f === 'function' ? f(x, y, z) : f); };
// the short shell most cuts sit on (the kept cuts' convention): the cap over the crown (y 33…cap), the side panels (x −9 / 8,
// from y `side` up, back to z −8, forward to z `front`), the back (z −8, from y `back` up) and a lip on the hairline (z 8, y lip…32)
function shell(H, f, { side = 27, front = 4, back = 24, lip = 32, cap = 34 } = {}) {
  fill(H, -9, 8, 33, cap, -8, 7, f);
  fill(H, -9, -9, side, 32, -8, front, f); fill(H, 8, 8, side, 32, -8, front, f);
  fill(H, -9, 8, back, 32, -8, -8, f);
  if (lip !== null) fill(H, -8, 7, lip, 32, 8, 8, f);
}
// the line-up: the temples cut square (the shell's side panel carried forward to the face, y 30…32)
const temples = (H, f) => { fill(H, -9, -9, 30, 32, 5, 7, f); fill(H, 8, 8, 30, 32, 5, 7, f); };
// a blob of hair: a 3×3×3 (r 1) or 5×5×5 (r 2) block round (x, y, z) with its corners off
const blob = (H, x, y, z, r, f) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) if (a * a + b * b + c * c <= r * r + 1) put(H, x + a, y + b, z + c, typeof f === 'function' ? f(x + a, y + b, z + c) : f); };
// a 4×4 cylinder (corners off) along x, from x0 to x1, its section's low corner at (y0, z0)
const roller = (H, x0, x1, y0, z0, f) => { for (let x = x0; x <= x1; x++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) if (!((j === 0 || j === 3) && (k === 0 || k === 3))) put(H, x, y0 + j, z0 + k, f(x, j, k)); };
// the same along z, its section's low corner at (x0, y0)
const rollerZ = (H, z0, z1, x0, y0, f) => { for (let z = z0; z <= z1; z++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) if (!((j === 0 || j === 3) && (k === 0 || k === 3))) put(H, x0 + j, y0 + k, z, f(z, j, k)); };

// razor-art glyphs, cut into the side panels (8 rows, y 32 → 25; columns z 4 → −8); 'X' is a razor line (the skin shows)
const GLYPH = [
  ['...XXXXX.....', '....XX.......', '.....XX......', '......XXXXX..', '........XX...', '.........XX..', '..........XX.', '...........X.'],   // bolt
  ['..X...X...X..', '..XX.XXX.XX..', '..X.X...X.X..', '..X.......X..', '..XXXXXXXXX..', '.............', '.............', '.............'],   // crown
  ['..X...X...X..', '...X...X...X.', '....X...X...X', 'X....X...X...', '.X....X...X..', '..X....X...X.', '......XX...X.', '.......X...X.'],   // slashes
  ['........X....', '.......X.X...', '......X...X..', '.....X.....X.', '......X...X..', '.......X.X...', '........X....', '.............'],   // ice (a diamond)
];
// soft-serve toppings by colourway: [colours…] laid as 1×2 sprinkles (or chips) on the swirl's top faces
const TOPPING = [[0xff3b6b, 0xffd21f, 0x2de2e6, 0x6cf542, 0x8a3cff, 0xff8c1a], [0xffffff, 0xff3b6b, 0xffe9f2], [0xff7ab6, 0xffd21f, 0x2de2e6, 0xf3f3f3], [0x3a2616, 0x24170e]];

export const DESIGNS = [
  // ── commons
  { id: 'opus_waves', name: '360 waves', tier: 'common', ears: false,
    wearer: 'ballers, barbershop regulars, the corner',
    why: 'Brushed till the pomade rings ripple out from the crown, with a line-up you could cut paper on. Fits under every hat on the block.',
    cw: [['jet', 0x151214, 0x5c6580], ['chestnut', 0x3a2616, 0x8a6644], ['bleach', 0xe9c14d, 0xfff2c4], ['royal', 0x2b6cff, 0xa8c4ff]],
    draw(H, [, C, Hi]) { const w = (x, y, z) => (Math.floor(Math.hypot(x + .5, (y - 37) * 1.15, z + 1.5) / 2) & 1) ? [Hi, 1] : C;
      shell(H, w, { side: 28, back: 23 }); temples(H, w); } },

  { id: 'opus_cornrows', name: 'straight-back cornrows', tier: 'common', ears: false,
    wearer: 'ballers, rappers on the billboard, county',
    why: 'Five plaits front to back with the scalp showing in the parts, ending in short tails with metal cuffs at the nape.',
    cw: [['jet / gold', 0x151214, 0xe7bd4a], ['chestnut / silver', 0x3a2616, 0xdfe6ee], ['red / gold', 0xd8262e, 0xe7bd4a], ['bleach / onyx', 0xe9c14d, 0x26262c]],
    draw(H, [, C, Cf]) { const D = shade(C, .74), pl = (s, t) => ((s + t) & 1) ? C : D;
      [[-7, -6], [-4, -3], [-1, 0], [2, 3], [5, 6]].forEach(([a], i) => { const tail = 17 + [2, 1, 0, 1, 2][i];
        for (const x of [a, a + 1]) { const t = x - a; put(H, x, 33, 8, pl(0, t));
          for (let z = 7; z >= -8; z--) put(H, x, 34, z, pl(8 - z, t));
          for (let y = 33; y > tail; y--) put(H, x, y, -8, y === tail + 2 ? [Cf, 2] : pl(50 - y, t)); put(H, x, tail, -8, D); } });
      for (const sx of [-9, 8]) for (const y0 of [28, 31]) for (const y of [y0, y0 + 1]) for (let z = -8; z <= 6; z++) put(H, sx, y, z, pl(z, y - y0)); } },

  { id: 'opus_mullet', name: 'trailer mullet', tier: 'common', ears: false,
    wearer: 'the trailer park, demolition-derby drivers, the motel night desk',
    why: 'Business up front, party in the back: a feathered crop on top and a long, flicked-out back that still hangs out under a bucket or a beanie.',
    cw: [['dirty blonde', 0xc9a24a, 0xc9a24a], ['jet', 0x151214, 0x151214], ['frosted', 0x3a2616, 0xe9c14d], ['hot rod', 0xd8262e, 0x151214]],
    draw(H, [, C, B]) { const T = (x, y, z) => (((x * 7 + z * 3) % 5 + 5) % 5 === 0) ? shade(C, .82) : C, Bk = x => ((x + 9) % 3 === 0) ? shade(B, .84) : B;
      shell(H, T, { side: 28, front: 4, back: 31, lip: null });
      fill(H, -8, 7, 35, 35, -2, 6, T);   // a feathered top
      for (let x = -8; x <= 7; x++) { const a = Math.abs(x + .5); put(H, x, 32, 8, T(x, 32, 8)); if (Math.floor(a) & 1) put(H, x, 31, 8, T(x, 31, 8)); }   // feathered bangs
      for (let x = -9; x <= 8; x++) { const a = Math.abs(x + .5), bot = 17 + (a > 6 ? 2 : a > 4 ? 1 : 0) - ((Math.floor(a) & 1) ? 0 : 1), b = Bk(x);   // the party
        for (let y = Math.max(bot, x < -8 || x > 7 ? 19 : bot); y <= 32; y++) { put(H, x, y, -8, b); if (y <= 30 && x >= -8 && x <= 7) put(H, x, y, -9, b); }
        if (x >= -8 && x <= 7) for (let y = bot; y <= bot + 2; y++) put(H, x, y, -10, shade(b, .9)); }   // flicked out at the ends
      for (const sx of [-9, 8]) fill(H, sx, sx, 19, 27, -8, -5, B); } },   // long behind the ears too

  { id: 'opus_bowl', name: 'skate mop', tier: 'common', ears: true,
    wearer: 'skaters at the plaza, the deli stock boy, every younger brother',
    why: 'A heavy bowl that hangs over the ears and rests a fringe on the brows: the eyes still read, nothing else does.',
    cw: [['bleach', 0xe9c14d], ['jet', 0x151214], ['mouse', 0x6b4a2e], ['lime', 0x6cf542]],
    draw(H, [, C]) { const S = (x, y, z) => (((x + z) % 3 + 3) % 3 === 0) ? shade(C, .84) : C;
      fill(H, -10, 9, 33, 35, -9, 8, S); for (let x = -10; x <= 9; x++) for (let z = -9; z <= 8; z++) if (x === -10 || x === 9 || z === -9 || z === 8) H.del(x, 35, z);   // a rounded crown
      fill(H, -10, -9, 22, 32, -9, 7, S); fill(H, 8, 9, 22, 32, -9, 7, S);   // over the ears
      fill(H, -10, 9, 22, 32, -9, -8, S);
      fill(H, -9, 8, 29, 32, 8, 8, S); fill(H, -8, 7, 30, 32, 9, 9, S); } },   // the fringe, down to the brows

  { id: 'opus_hitop', name: 'hi-top fade', tier: 'common', ears: false,
    wearer: 'ballers, the 90s block party, the bodega owner\'s son',
    why: 'A flat-topped box standing a hand tall off a faded side, the front edge a step higher. Biggest silhouette on the corner.',
    cw: [['jet', 0x151214, 0x151214], ['chestnut', 0x3a2616, 0x2a1c12], ['gold top', 0xe9c14d, 0x151214], ['blue top', 0x2b6cff, 0x151214]],
    draw(H, [, C, F]) { const Tx = (x, y, z) => (hash3(x, y, z) % 5 === 0) ? shade(C, .9) : C;
      // the fade: solid up top, then thinning out (a dither on the head's own side, so every voxel still sits on the skin), the line-up
      for (const sx of [-9, 8]) { fill(H, sx, sx, 31, 32, -8, 4, F); fill(H, sx, sx, 29, 30, -7, 4, (x, y, z) => ((y + z) & 1) ? F : null); fill(H, sx, sx, 28, 28, -7, 4, (x, y, z) => (((z % 3) + 3) % 3 === 0) ? F : null); }
      fill(H, -9, 8, 29, 32, -8, -8, F); fill(H, -8, 7, 26, 28, -8, -8, (x, y) => ((Math.abs(x + .5) + .5 + y) & 1) ? F : null); fill(H, -8, 7, 32, 32, 8, 8, F);
      for (let x = -9; x <= 8; x++) for (let z = -8; z <= 7; z++) { const top = 42 + (z >= 1 ? 1 : 0), corner = (x === -9 || x === 8) && (z === -8 || z === 7);
        for (let y = 33; y <= top; y++) if (!corner || y === 33) put(H, x, y, z, y === top ? shade(C, 1.1) : Tx(x, y, z)); } } },

  // ── rares
  { id: 'opus_pony', name: 'snatched pony', tier: 'rare', ears: false,
    wearer: 'the strip, bottle girls, lash techs, the getaway driver',
    why: 'Scraped back glossy into a high pony with a scrunchie; the tail lies down the back of the head, so it still swings out under a fitted.',
    cw: [['jet / red', 0x151214, 0xd8262e], ['honey / pink', 0xc9892e, 0xff7ab6], ['barbie', 0xff7ab6, 0xf3f3f3], ['platinum / jet', 0xf3f3f3, 0x151214]],
    draw(H, [, C, Sc]) { const Hi = lerp(C, 0xffffff, .28), G = (x) => [(x === -6 || x === 5 || x === -3 || x === 2) ? Hi : C, 1];
      shell(H, G, { side: 27, front: 6, back: 24 });
      const zc = y => y >= 39 ? -10 : y >= 37 ? -11 : y >= 32 ? -12 : y >= 26 ? -11 : -10, half = y => y >= 40 ? 0 : y >= 38 ? 1 : y >= 33 ? 2 : y >= 20 ? 1 : 0;   // the tail: its outer face and half-width by height
      for (let y = 17; y <= 40; y++) { const k = half(y); for (let x = -1 - k; x <= k; x++) for (let z = zc(y); z <= -9; z++) put(H, x, y, z, G(x === -1 - k || x === k ? -6 : 0)); }
      fill(H, -3, 2, 34, 36, -9, -6, (x, y) => [(y & 1) ? Sc : shade(Sc, .8), 0]); } },   // the scrunchie

  { id: 'opus_bunches', name: 'club-kid bunches', tier: 'rare', ears: false,
    wearer: 'club kids at the after-hours, the arcade, the rave flyer girl',
    why: 'Split-dye bunches flaring out from high on the head, a bobble at each root and blunt micro-bangs. Two colours, one per side.',
    cw: [['pink / blue', 0xff7ab6, 0x2b6cff, 0xf3f3f3], ['lime / jet', 0x6cf542, 0x151214, 0xff7ab6], ['cyan / pink', 0x2de2e6, 0xff7ab6, 0x151214], ['red / white', 0xd8262e, 0xf3f3f3, 0x151214]],
    draw(H, [, A, B, T]) { const col = x => x < -.5 ? A : B;
      shell(H, x => col(x), { side: 27, front: 5, back: 24, lip: null }); fill(H, -7, 6, 30, 32, 8, 8, x => col(x));
      for (const s of [-1, 1]) { const X = x => s < 0 ? x : -1 - x, c = col(X(-12));
        for (const x of [-11, -10]) fill(H, X(x), X(x), 29, 31, -7, -5, [T, 1]);   // the bobble
        for (const [x, y, z, r] of [[-13, 30, -6, 1], [-14, 30, -6, 1], [-15, 29, -7, 1], [-16, 28, -7, 2], [-17, 26, -7, 2], [-17, 24, -7, 1]]) blob(H, X(x), y, z, r, (xx, yy, zz) => (((yy + zz) % 3 + 3) % 3 === 0) ? shade(c, .82) : c); } } },

  { id: 'opus_rollers', name: 'bodega rollers', tier: 'rare', ears: false,
    wearer: 'the bodega auntie, laundromat mornings, the trailer-park stoop',
    why: 'Set in plastic rollers and not taking them out for anybody: the woman who actually runs the block, from behind the counter.',
    cw: [['candy', 0x151214, 0xff7ab6, 0x2de2e6, 0xffd21f], ['all pink', 0x3a2616, 0xff7ab6, 0xff9ccb, 0xff7ab6], ['lime', 0xe9c14d, 0x6cf542, 0xb6ff8a, 0x6cf542], ['blue', 0xf3f3f3, 0x2b6cff, 0x7cc3ff, 0x2b6cff]],
    draw(H, [, C, ...R]) { shell(H, C, { side: 26, front: 5, back: 23 });
      // a tube's cell: its two ends show the hole (dark centre, a shaded rim), ribs every third voxel along it
      const tube = (c, a0, a1) => (a, j, k) => [a === a0 || a === a1 ? (((j === 1 || j === 2) && (k === 1 || k === 2)) ? shade(c, .42) : shade(c, .78)) : ((a - a0) % 3 === 1 ? shade(c, .86) : c), 1];
      [[-7, R[1]], [-2, R[2]], [3, R[1]]].forEach(([x0, c]) => rollerZ(H, -6, 4, x0, 35, tube(c, -6, 4)));   // three along the crown
      roller(H, -6, 5, 34, 6, tube(R[0], -6, 5));   // the big one over the forehead
      roller(H, -6, 5, 24, -12, tube(R[0], -6, 5)); } },   // one at the nape

  { id: 'opus_bantu', name: 'bantu knots', tier: 'rare', ears: false,
    wearer: 'Brooklyn, the braid shop, club kids',
    why: 'Parted into sections and coiled into knots: six on the crown, two each side, two at the back, the scalp showing in the parts.',
    cw: [['jet', 0x151214], ['honey', 0xc9892e], ['burgundy', 0x6a1a26], ['pink', 0xff7ab6]],
    draw(H, [, C]) { const D = shade(C, .7), L = lerp(C, 0xffffff, .22);
      fill(H, -9, 8, 34, 34, -8, 7, (x, y, z) => (x === -1 || x === 0 || z === 2 || z === -3) ? null : C);   // the parted base (the head's own top shows in the parts)
      fill(H, -9, -9, 27, 34, -8, 5, C); fill(H, 8, 8, 27, 34, -8, 5, C); fill(H, -9, 8, 24, 34, -8, -8, C);
      // a knot: from base cell o along a: a narrow root, the full coil, its crown, a tip
      const knot = (o, a, u, v) => { const at = (k, i, j) => [o[0] + a[0] * k + u[0] * i + v[0] * j, o[1] + a[1] * k + u[1] * i + v[1] * j, o[2] + a[2] * k + u[2] * i + v[2] * j];
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { if (!(i && j)) { put(H, ...at(0, i, j), C); put(H, ...at(2, i, j), C); } put(H, ...at(1, i, j), ((i + j) & 1) ? D : C); }
        put(H, ...at(3, 0, 0), L); };
      for (const x of [-5, 4]) for (const z of [5, 0, -5]) knot([x, 35, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      for (const z of [3, -3]) { knot([-10, 32, z], [-1, 0, 0], [0, 0, 1], [0, 1, 0]); knot([9, 32, z], [1, 0, 0], [0, 0, 1], [0, 1, 0]); }
      for (const x of [-4, 3]) knot([x, 29, -9], [0, 0, -1], [1, 0, 0], [0, 1, 0]); } },

  { id: 'opus_slick', name: 'penthouse slickback', tier: 'rare', ears: false,
    wearer: 'penthouse money, the loan shark, the lawyer on the bus shelter',
    why: 'Combed straight back wet, the comb\'s teeth still in it, and a little flick at the collar. Money you can smell.',
    cw: [['jet', 0x151214, 0x4f5c7a], ['silver fox', 0xa9adb6, 0xf3f3f3], ['oil slick', 0x151214, 0x2de2e6], ['bottle blond', 0xe9c14d, 0xfff3c0]],
    draw(H, [, C, Ln]) { const gr = lerp(C, Ln, .3), G = x => [x === -4 || x === -3 || x === 2 || x === 3 ? Ln : ((x + 9) % 3 === 0 ? gr : C), 1];   // comb grooves, two shine streaks
      fill(H, -9, 8, 33, 34, -8, 7, x => G(x)); fill(H, -8, 7, 35, 35, -1, 7, x => G(x)); fill(H, -7, 6, 36, 36, 3, 8, x => G(x)); fill(H, -8, 7, 33, 35, 8, 8, x => G(x));   // the crown, swept up and back off the hairline
      for (const sx of [-9, 8]) fill(H, sx, sx, 27, 32, -8, 3, (x, y) => [y % 3 === 0 ? gr : C, 1]);
      fill(H, -9, 8, 22, 32, -8, -8, x => G(x)); fill(H, -7, 6, 22, 23, -9, -9, [C, 1]); } },   // the back, the flick

  // ── epics
  { id: 'opus_pompadour', name: 'greaser pompadour', tier: 'epic', ears: false,
    wearer: 'the strip\'s doormen, rockabilly bartenders, the slot-machine king',
    why: 'A lacquered roll that climbs a hand above the forehead and leans out over it, slicked sides and a duck tail at the back.',
    cw: [['jet', 0x151214, 0x6f86c0], ['bottle red', 0xb81c26, 0xff9a9a], ['silver fox', 0xb9bcc4, 0xffffff], ['bleach', 0xe9c14d, 0xfff6cf]],
    draw(H, [, C, Sh]) {
      const T = z => z <= -6 ? 35 : z <= -3 ? 36 : z <= -1 ? 37 : z <= 2 ? 38 : z <= 4 ? 39 : z <= 6 ? 40 : z <= 9 ? 41 : z === 10 ? 40 : 38;
      const hw = z => z <= 6 ? 9 : z <= 9 ? 8 : 7, bot = z => z <= 7 ? 33 : z === 8 ? 31 : 34, top = (x, z) => { const a = Math.abs(x + .5); return T(z) - (a > 7 ? 2 : a > 5 ? 1 : 0); };
      const cell = (x, y, z) => [(z >= 9 && y === top(x, z) && Math.abs(x + .5) < 7) ? Sh : (((x + 9) % 3 === 0 && y >= top(x, z) - 1) ? shade(C, .78) : C), 1];
      for (let z = -8; z <= 11; z++) for (let x = -hw(z); x <= hw(z) - 1; x++) for (let y = bot(z); y <= top(x, z); y++) put(H, x, y, z, cell(x, y, z));
      for (const sx of [-9, 8]) fill(H, sx, sx, 27, 32, -8, 5, [C, 1]);
      fill(H, -9, 8, 24, 32, -8, -8, [C, 1]); fill(H, -7, 6, 25, 31, -9, -9, x => [(x === -1 || x === 0) ? shade(C, .7) : C, 1]); } },   // the duck tail

  { id: 'opus_razor', name: 'razor-art fade', tier: 'epic', ears: false,
    wearer: 'barbershop royalty, ballers, the corner\'s best dressed',
    why: 'A tight Caesar with a design razored into both sides, down to the skin: a bolt, a crown, slashes or a stone.',
    cw: [['bolt · jet', 0x151214, 0], ['crown · gold', 0xe9c14d, 1], ['slashes · red', 0xd8262e, 2], ['ice · royal', 0x2b6cff, 3]],
    draw(H, [, C, g]) { shell(H, C, { side: 33, front: 4, back: 23 }); temples(H, C);
      const G = GLYPH[g] || GLYPH[0];   // the side panels drawn cell by cell: round the ear (never over it), the design left out
      for (let y = 25; y <= 32; y++) for (let z = -8; z <= 4; z++) { if (y <= 27 && z >= -1 && z <= 1) continue; if (G[32 - y][4 - z] === 'X') continue; put(H, -9, y, z, C); put(H, 8, y, z, C); } } },

  // ── grail
  { id: 'opus_softserve', name: 'soft-serve swirl', tier: 'grail', ears: false,
    wearer: 'the ice-cream truck crew, club kids at the after-hours',
    why: 'The head is the waffle cone and the hair is the serve: five piped rings and a curl, with sprinkles. The truck is a front; the swirl is the flex.',
    cw: [['vanilla · rainbow', 0xf6efdc, 0], ['strawberry', 0xff9ccb, 1], ['chocolate dip', 0x4a2a18, 2], ['mint chip', 0x9fe3c7, 3]],
    draw(H, [, C, si]) { const Wf = 0xd9a24e, Wd = shade(Wf, .68), waffle = (a, b) => ((((a + b) % 3) + 3) % 3 === 0 || (((a - b) % 3) + 3) % 3 === 0) ? Wd : Wf;
      fill(H, -9, -9, 26, 32, -8, 6, (x, y, z) => waffle(y, z)); fill(H, 8, 8, 26, 32, -8, 6, (x, y, z) => waffle(y, z)); fill(H, -9, 8, 24, 32, -8, -8, (x, y) => waffle(y, x));   // the cone
      const sv = new Map(), K = (x, y, z) => x + ',' + y + ',' + z, add = (x, y, z) => sv.set(K(x, y, z), [x, y, z]), gl = si === 2 ? 1 : 0;   // (the chocolate dip sets glossy)
      const ring = (y, r, cz) => { for (let x = -11; x <= 10; x++) for (let z = -11; z <= 11; z++) if ((x + .5) ** 2 + (z + .5 - cz) ** 2 <= r * r) add(x, y, z); };
      for (let k = 0; k < 5; k++) { const r = 9.6 - 1.55 * k, cz = .4 * k, y0 = 33 + 3 * k; ring(y0, r - .9, cz); ring(y0 + 1, r, cz); ring(y0 + 2, r - .9, cz); }   // five piped rings, stepping in, leaning forward
      for (const [y, z] of [[48, 2], [49, 2], [50, 2], [50, 3]]) for (const x of [-1, 0]) add(x, y, z);   // the curl on top
      const top = new Set(); for (const [k, [x, y, z]] of sv) { put(H, x, y, z, [(y - 33) % 3 === 0 && y < 48 ? shade(C, .84) : C, gl]); if (!sv.has(K(x, y + 1, z))) top.add(k); }
      const T = TOPPING[si] || TOPPING[0];
      for (const k of top) { const [x, y, z] = sv.get(k); if (y >= 48 || hash3(x, y, z) % 6 !== 0 || !top.has(K(x + 1, y, z))) continue;
        const c = T[hash3(z, x, y) % T.length]; put(H, x, y, z, [c, 1]); put(H, x + 1, y, z, [c, 1]); } } },   // sprinkles, two voxels each
];

// registry: NEWT (slot → id → [name, tier, colourways, why]), NEWI (origin 'opus'), NAMES, the draws, and the ears they hide
export function installOpusHair({ HAIR, NEWT, NEWI, NAMES }) {
  for (const d of DESIGNS) {
    NEWT.hair[d.id] = [d.name, d.tier, d.cw, d.why];
    NEWI[d.id] = { id: d.id, slot: 'hair', name: d.name, tier: d.tier, cw: d.cw, why: d.why, wearer: d.wearer, new: true, origin: 'opus', collection: 'opus-hair' };
    NAMES.hair[d.id] = d.name;
    HAIR[d.id] = (H, p) => d.draw(H, cwPick(d.cw, p), p);
    if (d.ears && !EARS_COVERED.includes(d.id)) EARS_COVERED.push(d.id);   // (contract EARS_COVERED: the cut hangs over the ears, like `long`)
  }
}
