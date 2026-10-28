// OPUS SKINS (2026-10-01): twelve new skins, ids opus_*, studio origin 'opus'. Installed last by chars.js (one line).
// A skin is surface only: the skeleton, the face grid and every trait stay where they are. Each entry builds the full skin record
// skinOf returns (chars.js skinOf's `make` hook): c(x, y, z) / sh(x, y, z) paint every bare voxel (head, ears, hands, the legs
// under shorts), layer is the material (0 matte · 1 gloss · 2 metal), and ink / brow / mouth / lash / lip keep the face readable.
// Patterns stay off the joints (shoulder columns, neck, wrists, hips) so a walk never breaks them, and off the eye and mouth boxes.
// Registered as new traits (NEWT.skin, origin 'opus'): the city's roll never draws them (rollLook's skin ladder is untouched).
//
// Coordinates (chars.js base): head x −8…7, y 19…33, z −7…7 (face z 7) · eyes x −7…−3 / 2…6, rows 23…26 · mouth x −3…2, rows 19…21
// ears x −10…−9 / 8…9, y 23…27 · arms x −8…−6 / 5…7, y 10…16 · hands y 6…9 · torso x −5…4, y 10…17 · legs y 0…9.

let shade, lerpHex, hash3;   // chars.js's helpers, handed over at install
const H = (x, y, z, s = 0) => hash3(x + s * 31, y - s * 17, z + s * 7);
const face = (y, z) => y >= 19 && z >= 7;                                                   // the head's front plane (and anything proud of it)
const eyeBox = (x, y) => y >= 22 && y <= 29 && ((x >= -8 && x <= -2) || (x >= 1 && x <= 7)); // eyes + brows, a cell of margin
const mouthBox = (x, y) => y >= 18 && y <= 22 && x >= -4 && x <= 3;                         // mouth + nose, a cell of margin
const arm = (x, y) => y >= 10 && y <= 16 && (x <= -6 || x >= 5);
const hand = (x, y) => y >= 4 && y <= 9 && (x <= -5 || x >= 5);
const joint = (x, y) => y === 9 || y === 10 || y >= 16 && y <= 19 || x === -6 || x === -5 || x === 4 || x === 5;   // seams the walk bends

// ── the paints (x, y, z integers; return a colour)
const seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
const near = (px, py, line, w) => { for (let i = 1; i < line.length; i++) if (seg(px, py, ...line[i - 1], ...line[i]) < w) return true; return false; };
const tri = v => { const f = ((v % 4) + 4) % 4; return f < 2 ? f : 4 - f; };   // a zigzag 0…2…0, period 4
const P = {
  // freckles: a light dusting over the nose bridge and the cheekbones, a few more on the shoulders
  freckle(B, F) { const spots = new Set(['-6,22', '-4,21', '-7,21', '-2,23', '1,23', '3,21', '5,22', '6,21', '-1,24']);
    return (x, y, z) => { if (face(y, z)) return spots.has(x + ',' + y) ? F : B;
      if (arm(x, y) && !joint(x, y) && y >= 12 && H(x, y, z, 1) % 7 === 0) return F; return B; }; },
  // sunburn: a band across the nose and the cheekbones, the ear tops and the shoulders caught the sun; the rest stayed pale
  sunburn(B, R) { const r2 = lerpHex(B, R, .5);
    return (x, y, z) => { if (face(y, z)) { if (y === 22 && x >= -7 && x <= 6) return R; if (y === 23 && x >= -2 && x <= 1) return R; if (y === 21 && ((x >= -7 && x <= -5) || (x >= 4 && x <= 6))) return r2; return B; }
      if ((x <= -9 || x >= 8) && y >= 26) return R;                       // ear tops
      if (arm(x, y) && y >= 14 && !(x === -6 || x === 5)) return y === 14 ? r2 : R;   // the shoulders' outer faces (the arm piece only)
      return B; }; },
  // split colourway: a designer toy's two-tone run, cut straight down the middle (left of the centre line A, right B)
  split(A, Bc) { return (x) => x < 0 ? A : Bc; },
  // brick: running bond, 5 × 2 bricks in pale mortar, never through the eyes, the mouth or a joint
  brick(B, M) { const m = (v, n) => ((v % n) + n) % n;
    return (x, y, z) => { if (face(y, z) && (eyeBox(x, y) || mouthBox(x, y))) return B; if (joint(x, y) && y < 19) return B;
      if (m(y, 3) === 0) return M; const off = m(Math.floor(y / 3), 2) * 3; return m(x + z + off, 6) === 0 ? M : B; }; },
  // inked: sparse old-school tattoos on a human tone: a band and a little red heart on each arm, an outer-arm dash, dots across the
  // knuckles, a diamond and a cross on the calves (the face stays clean: face ink is its own slot)
  inked(B, K, R) { const calf = { L: ['.X.', 'X.X', '.X.'], R: ['X.X', '.X.', 'X.X'] };
    return (x, y, z) => { if (y >= 17) return B;
      if (arm(x, y) && !joint(x, y)) { const lx = x <= -6 ? x + 8 : 7 - x;   // 0 outer … 2 inner
        if (z === 0) { if (y === 14) return K; if (y === 12 && lx !== 1) return R; if (y === 11 && lx === 1) return R; }
        if (lx === 0 && z === -1 && (y === 12 || y === 13)) return K; return B; }
      if (hand(x, y)) { const lx = x <= -5 ? x + 8 : 7 - x; return z === 1 && y === 7 && (lx === 0 || lx === 2) ? K : B; }
      if (y >= 4 && y <= 6 && z >= 1 && x >= -4 && x <= 3) { const r = calf[x < 0 ? 'L' : 'R'][6 - y], lx = x < 0 ? x + 4 : x - 1; if (r && r[lx] === 'X') return x < 0 ? K : R; }
      return B; }; },
  // patina: weathered copper, green with darker run-off streaks down the sides and back; a copper glint here and there
  patina(B, S, Cu) { return (x, y, z) => { if (face(y, z)) return B;
    const col = H(x, 0, z, 5); if (col % 4 === 0 && ((y + (col >> 3) % 9) % 11) < 5 && !joint(x, y)) return S;
    return !joint(x, y) && !hand(x, y) && H(x, y, z, 6) % 53 === 0 ? Cu : B; }; },
  // toon gold: a deep gold body with a painted shine (a diagonal streak on the head, the arms' and legs' front edges)
  gold(B, Hi, Lo) { return (x, y, z) => { if (face(y, z) && (eyeBox(x, y) || mouthBox(x, y))) return B;
    if (y >= 19) { const d = (x + 8) - (33 - y) * .7; if (z >= 7 && d >= 1 && d < 2.6) return Hi; if (x <= -8 && z >= 3 && y >= 26) return Hi; if (z <= -7 || x >= 7) return Lo; return B; }
    if ((arm(x, y) || hand(x, y)) && z >= 1 && (x === -8 || x === 7) && !joint(x, y)) return Hi;
    if (y < 9 && !hand(x, y) && z >= 1 && (x === -4 || x === 1)) return Hi; return B; }; },
  // kintsugi: celadon porcelain, broken and mended: gold seams drawn on the head's faces, a glued ring round each arm and leg
  kintsugi(B, G) { const eyeCell = (x, y) => y >= 23 && y <= 26 && ((x >= -7 && x <= -3) || (x >= 2 && x <= 6)), mouthCell = (x, y) => y >= 19 && y <= 21 && x >= -3 && x <= 2;
    const front = [[[-6, 32.5], [-3.5, 30.6], [-1.2, 28.6], [-.2, 26.5], [-1, 24.6], [.4, 23.4], [3.5, 22.4], [5.8, 20.6], [8, 19.6]], [[-8.5, 21.5], [-7, 20.4], [-6.2, 18.5]]],
      right = [[[7.5, 31], [5, 28], [3.5, 25.5], [1, 23], [-1, 21], [-3, 18.5]]], left = [[[-7.5, 22], [-5, 24], [-4, 27], [-1.5, 28.5], [1, 31], [3, 33.5]]],
      back = [[[-8.5, 26], [-5, 27.5], [-2, 25.5], [1, 27], [4, 24.5], [7.5, 26]]], W = .6;
    return (x, y, z) => { if (face(y, z) && (eyeCell(x, y) || mouthCell(x, y))) return B; const cx = x + .5, cy = y + .5, cz = z + .5;
      if (y >= 19) { if (z >= 7) return front.some(l => near(cx, cy, l, W)) ? G : B; if (x >= 7 && x <= 9) return right.some(l => near(cz, cy, l, W)) ? G : B;
        if (x <= -8 && x >= -10) return left.some(l => near(cz, cy, l, W)) ? G : B; if (z <= -7) return back.some(l => near(cx, cy, l, W)) ? G : B; return B; }
      if (arm(x, y) && !joint(x, y)) return Math.abs(cy - (12.6 + tri(cx * 1.3 + cz * 1.7) * .9)) < .55 ? G : B;
      if (y <= 8 && !hand(x, y)) return Math.abs(cy - (5.4 + tri(cx * 1.3 + cz * 1.7 + 1) * .9)) < .55 ? G : B;
      return B; }; },
  // holo foil: a trading card's rainbow in toon bands, sweeping diagonally across the body (a one-cell blend between bands)
  holo(stops) { const n = stops.length, per = 3.4;
    return (x, y, z) => { const t = (x * .45 + y * .6 + z * .3) / per, i = Math.floor(t), f = t - i, a = ((i % n) + n) % n; return f < .72 ? stops[a] : lerpHex(stops[a], stops[(a + 1) % n], .5); }; },
};

// ── the skins: [name, tier, who they are in the city, build]. build → { c (colour) | paint (x,y,z → colour), layer, ink, brow, mouth, lash, lip }
const SKINS = {
  opus_golden: ['golden', 'common', 'Deli counters, bus drivers, the block\'s aunties: a warm golden tone that holds its colour under the noon sun.',
    () => ({ c: 0xd88f42, ink: 0x2a1a14 })],
  opus_ebony: ['ebony', 'common', 'The deepest tone on the island: night-shift security, the corner barber, the man who owns the laundromat.',
    () => ({ c: 0x4a2d22, ink: 0x0c0708, brow: 0x0d0808, mouth: 0x8c4a3e, lash: 0x0a0606, lip: 0x7a3e36 })],
  opus_freckle: ['freckled', 'common', 'Bike messengers and stoop kids: a peach tone dusted with freckles on the nose, cheeks and shoulders.',
    () => ({ c: 0xf2bc94, paint: P.freckle(0xf2bc94, 0xd58e5e) })],
  opus_sunburn: ['sunburnt', 'common', 'The day-tripper who queued all afternoon for a drop: pale, burnt across the nose, the ear tops and the shoulders.',
    () => ({ c: 0xf6d2b8, paint: P.sunburn(0xf6d2b8, 0xef9078) })],
  opus_vinyl: ['designer vinyl', 'rare', 'A collector\'s agent cast as its own art toy: glossy bubblegum vinyl, still smelling of the box.',
    () => ({ c: 0xf98dbe, layer: 1, ink: 0x6e1240, brow: 0x6e1240, mouth: 0x6e1240, lash: 0x3a0820, lip: 0xd8508e })],
  opus_brick: ['brick', 'rare', 'The after-hours bouncer, built like the wall he leans on: red brick, pale mortar, painted over twice.',
    () => ({ c: 0xb9563c, paint: P.brick(0xb9563c, 0xeadfca), ink: 0x2a1410, brow: 0x2a1410, mouth: 0x3a1a12, lash: 0x1e0e0a, lip: 0x8e3a28 })],
  opus_inked: ['inked', 'rare', 'The tattoo parlour\'s best customer: sailor bands, a heart for mom on each arm, dots across the knuckles, flash on the calves.',
    () => ({ c: 0xd49a68, paint: P.inked(0xd49a68, 0x27305a, 0xd0303c) })],
  opus_split: ['split colourway', 'epic', 'The drop\'s split run: half tangerine, half sky, one of 500. Collectors clock which side faces them.',
    () => ({ c: 0xff8a3d, layer: 1, paint: P.split(0xff8a3d, 0x52b8f2), ink: 0x14182e, brow: 0x14182e, mouth: 0x14182e, lash: 0x0c0e1c, lip: 0xd85a2a })],
  opus_patina: ['harbour patina', 'epic', 'The harbour statue\'s double, off its plinth: weathered copper gone green, rain streaks and all.',
    () => ({ c: 0x63c2a7, paint: P.patina(0x63c2a7, 0x3f9784, 0xc27a45), ink: 0x123a32, brow: 0x16443b, mouth: 0x16443b, lash: 0x0e2c26, lip: 0x3f9784 })],
  opus_gold: ['24k', 'epic', 'The kingpin\'s agent, gold-plated after the first big score: every inch of it is the flex.',
    () => ({ c: 0xe0a422, layer: 1, paint: P.gold(0xe0a422, 0xffe08a, 0xc4861a), ink: 0x4a2c04, brow: 0x4a2c04, mouth: 0x4a2c04, lash: 0x2a1802, lip: 0xb87a18 })],
  opus_kintsugi: ['kintsugi', 'grail', 'Broken in a hit and mended in gold: celadon porcelain with every crack filled. Worth more since.',
    () => ({ c: 0xaccfba, layer: 1, paint: P.kintsugi(0xaccfba, 0xeeb22a), ink: 0x23362d, brow: 0x2e463b, mouth: 0x2e463b, lash: 0x1c2a24, lip: 0x8fb39e })],
  opus_holo: ['holo foil', 'grail', 'The first-edition holo, pulled once from a pack and never sleeved: a rainbow that moves as they walk past.',
    () => ({ c: 0x9c8cff, layer: 1, paint: P.holo([0x5fe0ee, 0x9c8cff, 0xff86cf, 0xffd86a, 0x86f0a8]), ink: 0x1d1636, brow: 0x241a48, mouth: 0x3a1f55, lash: 0x150f28, lip: 0xc45aa8 })],
};
export const OPUS_SKINS = Object.fromEntries(Object.entries(SKINS).map(([id, [name, tier, who]]) => [id, { name, tier, who }]));

function record(id, s) {   // the record skinOf returns for a built-in skin, with this skin's paints
  const c = s.paint ? ((x, y, z) => s.paint(Math.round(x), Math.round(y), Math.round(z))) : (() => s.c);
  return { id, c, sh: (x, y, z) => shade(c(x, y, z), .8), layer: s.layer ?? 0, ink: s.ink ?? 0x2a1a14, brow: s.brow ?? 0x22160f, mouth: s.mouth ?? 0x3e211a,
    lash: s.lash ?? 0x160f0f, lip: s.lip ?? lerpHex(shade(s.c, .85), 0xd0505a, .35), noEars: false, alienEyes: false, screen: undefined, decorate: undefined };
}

export function installOpusSkins({ SPECIES, NAMES, TIER, NEWT, NEWI, shade: sh, lerpHex: lh, hash3: h3 }) {
  shade = sh; lerpHex = lh; hash3 = h3;
  NEWT.skin ??= {};
  for (const [id, [name, tier, who, build]] of Object.entries(SKINS)) {
    const s = build();
    SPECIES[id] = { c: s.c, make: () => record(id, s) };
    NAMES.skin[id] = name; TIER[id] = tier;
    NEWT.skin[id] = [name, tier, null, tier === 'grail' ? who : undefined];
    NEWI[id] = { id, slot: 'skin', name, tier, cw: null, why: who, new: true, origin: 'opus', wearer: who };
  }
}
