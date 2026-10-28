// OPUS FACE DROP (2026-10-01): sixteen face traits for AI City's crime-world street, ids opus_*, origin 'opus' in the Trait Studio.
// Eyes, eyewear, mouth, face ink and ears; mostly rare / epic / grail, four commons; eyewear and ears carry three colourways
// (eyes, mouth and face ink are string slots: one look each). No brands, no computer references.
// chars.js installs it with one call BEFORE installHead:
//   installOpusFace({ EYE, MOUTH, EYEWEAR, EARS, MARKS, HATS, faceGrid, Grid, NEWT, NEWI, NAMES })
// so refit-head's ear wrap fits these ears too (a side whose piece would land on hair or a hat is left off; the lobe the piece
// hangs from takes its metal: it goes through the ear). The face extras chain onto faceGrid.fx: the eyes paint before refit-head's
// faceFx (so under eyewear their 1-proud bits lie flat like every other eye), the mouth pieces after it (they keep their 1 proud).
//
// Fit (world/fit/contract.js, enforced by style/city/studio/audit/run.mjs):
//   EYES   · the face grid at z 7 (flush), lit bits at z 8 at most; drawn only with the eyes open, so the blink still closes them
//            (refit-head's standard lids); flames above the eye stay through the blink. Screen skins and the alien keep their own eyes.
//   EYEWEAR· z 8 (1 proud), never z 9; arms / ties inlaid flush in the head's side column (x −8 / 7) and, for the mask, round the
//            back (z −7) with a knot 1 proud only where the back of the head is bare. No frame cell on the nose (x −1…0, y 23).
//   MOUTH  · z 8 at most (mouth piece budget 1), every cell backed by the face (y ≥ 19), no lit white pixels (slime on the gem grill).
//   INK    · z 7 only, inside the head (face ink budget 0); never on the eye or mouth grid. Screen skins skip ink (chars.js).
//   EARS   · in the ear's outer plane (x −11 / 10, 1 proud of the ear) hung from the lobe cell (px, 23): the lobe turns metal, so the
//            piece goes through the ear; gloss gold (layer 1, never the olive layer-2 metal: slime on the hoops); no gaps in a loop.
//            Every ear piece hides under the covering hats and long hair (contract EARS_COVERED): no hat-side socket.
import { faceRing } from '../layers.js';

const K = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), D = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const lerp = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const tones = M => [shade(M, 1.16), M, shade(M, .74)];   // highlight · metal · shadow, all gloss: gold stays gold under any sky

// ── the registry (NEWT's shape): slot → id → [name, tier, colourways, why (grails)]
export const OPUS_FACE = {
  eyes: {
    opus_siren: ['siren eyes', 'grail', null, 'Red and blue and lit like a light bar: the whole corner knows the heat is here before the car is.'],
    opus_flame: ['heat check', 'epic'],
    opus_snake: ['snake eyes', 'rare'],
    opus_ko: ['knocked out', 'common'],
  },
  eyewear: {
    opus_bandit: ['cat-burglar mask', 'rare', [['midnight', 0x141416, 0x2e2e36], ['blood', 0xb3121b, 0x6e0b12], ['jailbird', 0xf2f2f2, 0x141416]]],
    opus_hearts: ['heartbreaker shades', 'rare', [['cherry', 0xe0182d, 0xdfe6ee], ['bubblegum', 0xff6fb0, 0xe7bd4a], ['blackout', 0x18181c, 0xe7bd4a]]],
    opus_monocle: ['kingpin monocle', 'epic', [['yellow gold', 0xe7bd4a], ['white gold', 0xdfe6ee], ['rose gold', 0xe8a08a]]],
  },
  mouth: {
    opus_toothpick: ['wiseguy toothpick', 'common'],
    opus_rose: ['rose in the teeth', 'rare'],
    opus_cashbite: ['bite the bag', 'grail', null, 'A fresh stack clenched in the teeth, band still on: the flex you can read from across the avenue.'],
  },
  mark: {
    opus_shiner: ['shiner', 'common'],
    opus_kiss: ['lipstick kiss', 'rare'],
    opus_warpaint: ['24K war paint', 'epic'],
  },
  ears: {
    opus_safetypin: ['safety pin', 'common', [['steel', 0xc9ced4], ['gold', 0xe7bd4a], ['blackened', 0x3a3a44]]],
    opus_dice: ['loaded dice', 'rare', [['ivory / red', 0xf6f4ef, 0xe0182d], ['casino red', 0xd7141a, 0xf6f4ef], ['onyx / gold', 0x1c1c22, 0xe7bd4a]]],
    opus_knockers: ['door knockers', 'epic', [['yellow gold', 0xe7bd4a], ['rose gold', 0xe8a08a], ['white gold', 0xdfe6ee]]],
  },
};
const CW = {}; for (const o of Object.values(OPUS_FACE)) for (const [id, e] of Object.entries(o)) if (e[2]) CW[id] = e[2];
const cwOf = (id, p) => { const l = CW[id]; return l[((((p && p.cw) | 0) % l.length) + l.length) % l.length]; };

// ── eyes: the base shape (chars.js EYE spec: rows y 26 → 23, outer → inner; brows y 29 → 27), then fx paints the colour
const EYES = {
  opus_siren: { e: ['.WWW.', 'WWWWW', 'WWWWW', '.WWW.'], b: ['.....', 'BBBBB', '.....'] },
  opus_flame: { e: ['WWWWW', 'WWWWW', 'WWWWW', '.WWW.'], b: ['.....', '.....', '.....'] },   // (the flames are the brows)
  opus_snake: { e: ['WWWW.', 'WWWW.', 'WWWW.', 'WWWW.'], b: ['.....', 'BBBBB', '.....'] },
  opus_ko: { e: ['.....', '.....', '.....', '.....'], b: ['BBBBB', '.....', '.....'] },   // (brows up: the lights went out)
};
// paint rows (top row at y `top`, columns outer → inner through X) with a palette letter → [colour, layer]
const paint = (F, X, rows, top, pal, z = 7) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const v = pal[r[i]]; if (v) F.set(X(i), top - j, z, v[0], v[1]); } });
const FLAME = { R: [0xe8231a, 3], O: [0xff7a1a, 3], Y: [0xffd21f, 3], W: [0xfff3d6, 3] };
const EYEFX = {
  // a lit lens per eye, red on one side and blue on the other, white-hot in the middle, a short flare out at the temple
  opus_siren(F, sk, X, s, closed) { if (closed) return; const [A, B] = s ? [0x1f5bff, 0x8ab4ff] : [0xff1a2e, 0xff9a9a], H = [0xfff4ec, 3];
    paint(F, X, ['BAAAB', 'ABHBA', 'ABHBA', 'BAAAB'], 26, { A: [A, 3], B: [B, 3], H });
    for (const y of [24, 25]) F.set(X(-1), y, 8, B, 3); },
  // the eyes burn: an ember in the socket and the flames licking up where the brows were (the flames stay through a blink)
  opus_flame(F, sk, X, s, closed) {
    paint(F, X, ['.R...', 'ROR..', 'OYOR.', 'OYYOR'], 30, FLAME);
    if (!closed) paint(F, X, ['OYYYO', 'YWWYO', 'YWWYO', '.OYO.'], 26, FLAME); },
  // a die in each socket showing the ace: snake eyes
  opus_snake(F, sk, X, s, closed) { if (closed) return;
    paint(F, X, ['ABBA', 'BRRB', 'BRRB', 'ABBC'], 26, { A: [0xdcd6ca, 1], B: [0xf6f4ef, 1], C: [0xc9c2b4, 1], R: [0xe0182d, 1] }); },
  // knocked out: an X in each eye
  opus_ko(F, sk, X, s, closed) { if (closed) return; const I = [sk.ink, 0];
    paint(F, X, ['I...I', '.I.I.', '..I..', '.I.I.', 'I...I'], 27, { I }); },
};

// ── mouth: the base (chars.js MOUTH grid, rows y 21 → 19, x −3…2) and the piece, drawn after refit-head's face extras
const MOUTHS = {
  opus_toothpick: ['......', '.KKKK.', '......'],
  opus_rose: ['.WWWW.', '......', '.KKKK.'],   // (upper teeth on the stem, the lower lip under it)
  opus_cashbite: ['.WWWW.', '......', '......'],   // (upper teeth biting down on the stack)
};
const MOUTHFX = {
  // a toothpick out of the corner of the mouth, drooping toward the jaw
  opus_toothpick(F) { [[2, 20, 0xf3e2bd], [3, 20, 0xead2a2], [4, 20, 0xe2c48c], [5, 19, 0xd9b679], [6, 19, 0xb98a4e]].forEach(([x, y, c]) => F.set(x, y, 8, c, 0)); },
  // a red rose clenched in the teeth: the bloom on the cheek, the stem across the mouth, one leaf
  opus_rose(F) { const P = { R: [0xd7141a, 1], D: [0x8f0a12, 1], L: [0xff4a5a, 1] };
    paint(F, x => -8 + x, ['.LR.', 'RDRR', 'RRDR', '.RR.'], 22, P, 8);
    for (let x = -4; x < 4; x++) F.set(x, 20, 8, (x & 1) ? 0x1f7a3a : 0x24883f, 0);
    F.set(2, 21, 8, 0x2ecc40, 1); F.set(3, 21, 8, 0x2ecc40, 1); },
  // a banded stack of bills held in the teeth, splayed at the ends
  opus_cashbite(F) {
    for (let x = -7; x < 7; x++) for (const y of [19, 20]) { const end = x === -7 || x === 6, band = x === -1 || x === 0, med = (x === -4 || x === 3) && y === 19;
      F.set(x, y, 8, band ? (y === 20 ? 0xd9a441 : 0xb07f22) : end ? (y === 20 ? 0xdff0c8 : 0xb9d9a0) : med ? 0x3f7a33 : (y === 20 ? 0x7cc46a : 0x5fa84a), band ? 1 : 0); }
    for (const x of [-7, 6]) F.set(x, 21, 8, 0xcfe8b8, 0); },
};

// ── face ink (H at z 7, before the hair; chars.js MARKS(H, sk))
const INK = {
  // a black eye: the bruise swollen under the socket, over the lid and in the inner corner, yellowing on the cheek (inside x −7…6:
  // the face's edge columns belong to eyewear arms and long hair)
  opus_shiner(H) { const Dk = 0x4a2270, M = 0x7a3fa8, Y = 0x8d8f3a;
    for (const x of [-7, -6, -5]) H.set(x, 27, 7, M); H.set(-2, 23, 7, M); H.set(-2, 22, 7, M);
    for (let x = -7; x < -2; x++) H.set(x, 22, 7, x > -4 ? M : Dk); for (let x = -7; x < -3; x++) H.set(x, 21, 7, x === -4 ? M : Dk);
    for (const x of [-7, -6, -5]) H.set(x, 20, 7, x === -6 ? M : Y); },
  // a lipstick print on the cheek
  opus_kiss(H) { const U = 0xe8235a, Dp = 0xa80f3c, Lw = 0xff4f86;
    ['UUUU', 'DDDD', '.LL.'].forEach((r, j) => { for (let i = 0; i < 4; i++) { const c = { U, D: Dp, L: Lw }[r[i]]; if (c) H.set(3 + i, 22 - j, 7, c); } }); },
  // a band of gold leaf across the cheeks and under the eyes, two drips
  opus_warpaint(H) { const [Hi, G, Sh] = tones(0xffcf3a);   // (brighter than jewellery gold: it lies in the face's plane, often in shade)
    for (let x = -7; x < 7; x++) H.set(x, 22, 7, [-7, -3, 2, 6].includes(x) ? Hi : G, 1);
    for (const x of [-7, -6, -5, -4, 3, 4, 5, 6]) H.set(x, 21, 7, Sh, 1);
    for (const x of [-6, 5]) H.set(x, 20, 7, Sh, 1); },
};

// ── eyewear (G: the item's own grid; H: the head so far, read-only, for what the back of the head carries)
const mir = (G, x, y, c, l) => { G.set(x, y, 8, c, l); G.set(-1 - x, y, 8, c, l); };
const arms = (G, y, c, l = 1) => { for (let z = -1; z < 8; z++) { G.set(-8, y, z, c, l); G.set(7, y, z, c, l); } };
const GLASSES = {
  // a burglar's mask: a band across the eyes with almond holes, pointed at the temples, tied round the head with a knot at the back
  opus_bandit(G, p, H) { const [nm, C, Dk] = cwOf('opus_bandit', p), jail = nm === 'jailbird', col = y => jail ? ((y & 1) ? C : Dk) : (y === 23 ? Dk : C);
    for (let x = -8; x < 0; x++) for (let y = 23; y < 28; y++) { if ((y === 24 || y === 25) && x >= -7 && x <= -3) continue; if (y === 23 && x >= -2) continue; mir(G, x, y, col(y), 1); }
    for (const y of [26, 27]) mir(G, -9, y, col(y), 1);
    for (const y of [26, 27]) { for (let z = -7; z < 8; z++) { G.set(-8, y, z, col(y), 1); G.set(7, y, z, col(y), 1); } for (let x = -8; x < 8; x++) G.set(x, y, -7, col(y), 1); }
    const knot = [[-1, 26], [0, 26], [-1, 27], [0, 27], [-2, 25], [-2, 24], [-2, 23], [1, 25], [1, 24], [1, 23]];
    if (knot.every(([x, y]) => !H.has(x, y, -8))) for (const [x, y] of knot) G.set(x, y, -8, col(y), 1); },
  // heart-shaped lenses, a thin metal bridge and arms
  opus_hearts(G, p) { const [, Ln, Fm] = cwOf('opus_hearts', p), Hl = lerp(Ln, 0xffffff, .45);
    ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') mir(G, -7 + i, 27 - j, (i === 1 && (j === 1 || j === 2)) ? Hl : Ln, 1); });
    mir(G, -2, 26, Fm, 1); mir(G, -1, 26, Fm, 1); mir(G, -8, 26, Fm, 1); arms(G, 26, Fm); },
  // a gold monocle over the left eye (an open ring: the eye looks through it), its chain down the cheek and back to the ear
  opus_monocle(G, p) { const [, M] = cwOf('opus_monocle', p), [Hi, Gm, Sh] = tones(shade(M, 1.1)), ring = [];
    for (let x = 2; x < 7; x++) ring.push([x, 27]); for (let y = 26; y > 22; y--) ring.push([7, y]); for (let x = 6; x > 1; x--) ring.push([x, 22]); for (let y = 23; y < 27; y++) ring.push([1, y]);
    ring.forEach(([x, y], a) => G.set(x, y, 8, (a % 3 === 0) ? Hi : Gm, 1));
    const ch = [[7, 22, 8], [7, 21, 8], [7, 20, 8]]; for (let z = 7; z > 0; z--) ch.push([7, 20, z]); ch.push([7, 21, 1], [7, 22, 1]);
    ch.forEach(([x, y, z], a) => G.set(x, y, z, (a & 1) ? Sh : Hi, 1)); },
};
// draw a design on its own grid, then onto the head; hair at z 8…9 touching the frame steps back off it (refit-head's rule)
function wrapEyewear(draw, Grid) { return (H, p) => { const G = new Grid(); draw(G, p, H); const fr = new Set();
  for (let li = 0; li < G.L.length; li++) for (const [k, c] of G.L[li]) { const [x, y, z] = D(k); H.set(x, y, z, c, li); if (z === 8) fr.add(k); }
  if (H.has(0, 18, 8)) return;   // (a balaclava's skirt: its shell is the hat's)
  for (const k of fr) { const [x, y] = D(k); if (H.has(x, y, 9) && !G.has(x, y, 9)) H.del(x, y, 9);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b; if (Y > 28 || fr.has(K(X, Y, 8))) continue; for (const z of [8, 9]) if (H.has(X, Y, z) && !G.has(X, Y, z)) H.del(X, Y, z); } } }; }

// ── ears (H here is refit-head's scratch grid holding the ear; px: the ear's outer plane, ex: its outer column, sx: outward)
const SIDES = [[-11, -10, -1], [10, 9, 1]];
const EARRINGS = {
  // a safety pin through the lobe: the clasp head at the lobe, the pin and the body down to the coil
  opus_safetypin(H, p) { const [, M] = cwOf('opus_safetypin', p), [Hi, Gm, Sh] = tones(M);
    for (const [px, ex] of SIDES) { if (!H.has(ex, 24, 0)) continue;
      for (const z of [-1, 0, 1]) { H.set(px, 23, z, Sh, 1); H.set(px, 18, z, z === 0 ? Hi : Gm, 1); }
      for (let y = 19; y < 23; y++) { H.set(px, y, -1, Gm, 1); H.set(px, y, 1, (y & 1) ? Hi : Gm, 1); } } },
  // a die on a short gold link: every face the ace (a loaded die), the pip colour runs through its core
  opus_dice(H, p) { const [, B, P] = cwOf('opus_dice', p), L = tones(0xe7bd4a);
    for (const [px, ex, sx] of SIDES) { if (!H.has(ex, 24, 0)) continue; const xc = px + sx;
      for (let k = 0; k < 3; k++) for (let y = 18; y < 21; y++) for (let z = -1; z < 2; z++) { const x = px + sx * k, ctr = [x === xc, y === 19, z === 0].filter(Boolean).length >= 2;
        H.set(x, y, z, ctr ? P : B, 1); }
      H.set(px, 21, 0, L[1], 1); H.set(px, 22, 0, L[0], 1); H.set(px, 23, 0, L[1], 1); } },
  // big bamboo hoops through the lobe, ribbed in three tones
  opus_knockers(H, p) { const [, M] = cwOf('opus_knockers', p), [Hi, Gm, Sh] = tones(M), ring = faceRing(20, 0, 3, 2.6);
    for (const [px, ex] of SIDES) { if (!H.has(ex, 24, 0)) continue;
      ring.forEach(([y, z], a) => H.set(px, y, z, a % 4 === 2 ? Sh : (a & 1) ? Hi : Gm, 1)); } },
};

// ── install
export function installOpusFace({ EYE, MOUTH, EYEWEAR, EARS, MARKS, faceGrid, Grid, NEWT, NEWI, NAMES }) {
  for (const [slot, o] of Object.entries(OPUS_FACE)) { NEWT[slot] ||= {}; NAMES[slot] ||= {};
    for (const [id, [name, tier, cw, why]] of Object.entries(o)) {
      NEWT[slot][id] = [name, tier, cw || null, why || null];
      NEWI[id] = { id, slot, name, tier, cw: cw || null, why: why || null, new: true, origin: 'opus', collection: 'opus-face' };
      NAMES[slot][id] = name; } }
  Object.assign(EYE, EYES); Object.assign(MOUTH, MOUTHS); Object.assign(MARKS, INK); Object.assign(EARS, EARRINGS);
  for (const [id, f] of Object.entries(GLASSES)) EYEWEAR[id] = wrapEyewear(f, Grid);
  // faceGrid.fx: ours wraps whatever is installed after us (refit-head's faceFx): eyes before it, mouth pieces after it
  let next = faceGrid.fx || null;
  const fx = (F, sk, L, closed) => {
    const e = EYEFX[L.eyes]; if (e && !sk.alienEyes) for (const s of [0, 1]) e(F, sk, i => s ? 6 - i : -7 + i, s, closed);
    if (next) next(F, sk, L, closed);
    const m = MOUTHFX[L.mouth]; if (m) m(F, sk); };
  Object.defineProperty(faceGrid, 'fx', { configurable: true, enumerable: true, get: () => fx, set: f => { next = f; } });
}
