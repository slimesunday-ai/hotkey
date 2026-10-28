// OPUS 2 SKINS (2026-10-01): thirteen skins from the culture, not the colour chart: hype drops and designer toys, art-world
// weirdness, the crime world's flex and old New York. Ids opus2_*, studio origin 'opus 2' (NEWI origin 'opus2'). Installed by
// chars.js after the first Opus skins (one line). Same construction as world/fit/opus-skins/: a skin is surface only, so the
// skeleton, the face grid and every trait stay where they are; each entry builds the record skinOf returns (its `make` hook):
// c(x, y, z) paints every bare voxel (head, ears, hands, the legs under shorts), layer is the material (0 matte · 1 gloss ·
// 2 metal · 3 unlit), and ink / brow / mouth / lash / lip are picked against the paint so the face stays readable.
// Rules kept from round 1: patterns stay out of the eye and mouth boxes (the eyes, blinks, brows and mouths of every trait land
// on a quiet field) and off the joint seams the walk bends (shoulder columns, neck, wrists, hips).
// Registered as new traits (NEWT.skin): the city's roll never draws them (rollLook's skin ladder is untouched).
//
// Coordinates (chars.js base): head x −8…7, y 19…33, z −7…7 (face z 7, lids and nose z 8) · eyes x −7…−3 / 2…6, rows 23…26 ·
// brows 27…29 · mouth x −3…2, rows 19…21 · ears x −10…−9 / 8…9, y 23…27 · arms x −8…−6 / 5…7, y 10…16 · hands y 6…9 ·
// legs (world/fit/leg-forms.js) x −2…−5 / 1…4, y 4…9.

let shade, lerpHex, hash3;   // chars.js's helpers, handed over at install
const H = (x, y, z, s = 0) => hash3(x + s * 31, y - s * 17, z + s * 7);
const mod = (v, n) => ((v % n) + n) % n;
const face = (y, z) => y >= 19 && z >= 7;                                                   // the head's front plane (and anything proud of it)
const eyeBox = (x, y) => y >= 22 && y <= 29 && ((x >= -8 && x <= -2) || (x >= 1 && x <= 7)); // eyes + brows, a cell of margin
const mouthBox = (x, y) => y >= 18 && y <= 22 && x >= -4 && x <= 3;                         // mouth + nose, a cell of margin
const quiet = (x, y, z) => face(y, z) && (eyeBox(x, y) || mouthBox(x, y));                  // the face's quiet fields
const isHead = y => y >= 19;
const ear = (x, y) => y >= 23 && y <= 27 && (x <= -9 || x >= 8);
const arm = (x, y) => y >= 10 && y <= 16 && (x <= -6 || x >= 5);
const hand = (x, y) => y >= 4 && y <= 9 && (x <= -6 || x >= 5);
const leg = (x, y) => y <= 9 && !hand(x, y);
const joint = (x, y) => y === 9 || y === 10 || y >= 16 && y <= 19 || x === -6 || x === -5 || x === 4 || x === 5;   // seams the walk bends
// the head's wrap: one coordinate running round the four sides (front 0…15, right 16…30, back 31…46, left 47…61)
const wrapU = (x, z) => z >= 7 ? x + 8 : x >= 7 ? 16 + (7 - z) : z <= -7 ? 31 + (7 - x) : x <= -8 ? 47 + (z + 7) : x + 8;
// a 2D surface coordinate for any bare voxel (a, b): the head's wrap and height, a limb's turn and height
const limbU = (x, z) => (x <= -5 ? -x : x) * 2 + z * 3;
const seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
const near = (px, py, line, w) => { for (let i = 1; i < line.length; i++) if (seg(px, py, ...line[i - 1], ...line[i]) < w) return true; return false; };
const tri = v => { const f = mod(v, 4); return f < 2 ? f : 4 - f; };   // a zigzag 0…2…0, period 4

// ── the paints (x, y, z integers; return a colour)
const P = {
  // bombed: a stainless subway car, bombed. Marker tags scrawled over every bit of steel (the face too, round its eye and mouth
  // fields); a whole-car piece of chunky wildstyle letters in a pink-orange-yellow fade wraps the sides and the back of the head with
  // a purple 3-D shadow, white shines and drips; the arms carry the piece's band, fluted steel on the legs, paint on the fingertips
  bombed(S, Sd, [Pk, Or, Ye], Sh, W, inks) {
    const G = [['XX..X', 'XX.XX', 'XXXX.', 'XXX..', 'XXXX.', 'XX.XX', 'XX..X'], ['.XXXX', 'XX...', 'XX...', '.XXX.', '...XX', '...XX', 'XXXX.'],
      ['XXXXX', 'XX...', 'XX...', 'XXXX.', 'XX...', 'XX...', 'XXXXX'], ['.XXX.', 'XX.XX', 'XX.XX', 'XXXXX', 'XX.XX', 'XX.XX', 'XX.XX'], ['XXXX.', 'XX.XX', 'XX.XX', 'XXXX.', 'XX.XX', 'XX.XX', 'XXXX.']];
    const fill = r => r >= 6 ? Pk : r >= 3 ? Or : Ye;   // r: letter row from the bottom (0) to the top (8)
    const inL = (lu, r) => { if (r < 0 || r > 8 || lu < 0 || lu > 41) return false; const k = Math.floor(lu / 6), lx = lu % 6; return lx < 5 && G[k % G.length][6 - Math.floor(r * 7 / 9)][lx] === 'X'; };
    const rnd = (i, k) => H(i, k, 3, 8) / 4294967296, tags = [];   // marker tags: short zigzag scrawls in wrap coordinates
    for (let i = 0; i < 30; i++) { let u = rnd(i, 0) * 62, y = 19.5 + rnd(i, 1) * 13; const pts = [[u, y]], n = 3 + Math.floor(rnd(i, 2) * 3);
      for (let k = 0; k < n; k++) { u += 1 + rnd(i, 10 + k) * 1.6; y += (k & 1 ? -1 : 1) * (1 + rnd(i, 20 + k) * 1.6); pts.push([u, Math.max(19.3, Math.min(32.7, y))]); }
      tags.push([pts, inks[i % inks.length]]); }
    const tagAt = (u, y) => { for (const [pts, c] of tags) for (const uu of [u, u + 62]) if (near(uu + .5, y + .5, pts, .62)) return c; return null; };
    return (x, y, z) => {
      if (isHead(y)) { if (quiet(x, y, z) || ear(x, y)) return S; if (y >= 33 && x > -8 && x < 7 && z > -7 && z < 7) return S;
        const u = wrapU(x, z), lu = u - 17, r = y - 21;
        if (!face(y, z)) { if (inL(lu, r)) return r === 8 && lu % 6 === 0 ? W : (r === 7 && lu % 6 === 1 ? W : fill(r));
          if (inL(lu - 1, r + 1)) return Sh;                                                 // the 3-D shadow, down and along
          if (y >= 19 && y <= 20 && inL(lu, 0) && H(lu, 0, 0, 3) % 3 === 0 && (y === 20 || H(lu, 1, 0, 3) % 2 === 0)) return Ye; }   // drips off the bottom row
        if (face(y, z) && y >= 22 && y <= 29) return mod(u, 3) === 0 ? Sd : S;              // (no tags between the eyes)
        return tagAt(u, y) ?? (mod(u, 3) === 0 ? Sd : S); }
      if (arm(x, y)) { if (joint(x, y)) return S; if (y === 15) return Pk; if (y === 14) return Or; if (y === 13) return Ye; if (y >= 11 && y <= 12 && H(x, 0, z, 4) % 3 === 0 && (y === 12 || H(x, 1, z, 4) % 2 === 0)) return Ye; return S; }
      if (hand(x, y)) return y === 6 ? (x & 1 ? Pk : Or) : S;
      if (y >= 5 && y <= 8 && H(x, 0, z, 5) % 7 === 0 && y >= 8 - (H(x, 1, z, 5) % 3)) return Pk;   // a few drips on the shins
      if (y === 7 && H(x, 2, z, 5) % 4 === 0) return inks[H(x, 3, z, 5) % inks.length];       // a tag's tail
      return mod(x, 2) === 0 ? Sd : S; };                                                      // fluted steel
  },
  // ransom note: the agent pasted up from magazine cut-outs. Each feature is clipped from a different magazine (left eye, right eye,
  // and the mouth in three skin tones, so every trait still lands on a quiet field); the rest of the head is cut-out letters, one per scrap (white, black, red, yellow, cyan, pink, newsprint), stuck down at
  // odd overlaps on newsprint; the limbs are banded in scraps, the hands are from the magazine too
  ransom(Fc, Edge, Np, scraps) {
    const FONT = [['.X.', 'X.X', 'XXX', 'X.X'], ['XXX', 'X..', 'X..', 'XXX'], ['XXX', 'XX.', 'X..', 'XXX'], ['X.X', 'XX.', 'XX.', 'X.X'], ['X.X', 'XXX', 'X.X', 'X.X'],
      ['XXX', 'X.X', 'X.X', 'XXX'], ['XX.', 'X.X', 'XX.', 'X.X'], ['.XX', 'X..', '..X', 'XX.'], ['XXX', '.X.', '.X.', '.X.'], ['X.X', 'X.X', '.X.', '.X.'], ['X.X', '.X.', '.X.', 'X.X'], ['XX.', 'X.X', 'X.X', 'X.X']];
    const rnd = (i, k) => H(i, k, 5, 23) / 4294967296, P2 = [];   // scraps on a jittered grid in wrap coordinates: [u0, y0 (top), glyph, scrap]
    for (let r = 0; r < 3; r++) for (let c = 0; c < 13; c++) { const i = r * 13 + c; P2.push([c * 5 - 1 + Math.floor(rnd(i, 1) * 3) + (r & 1) * 2, 33 - r * 5 - Math.floor(rnd(i, 2) * 2), Math.floor(rnd(i, 3) * FONT.length), Math.floor(rnd(i, 4) * scraps.length)]); }
    const scrapAt = (u, y) => { for (let i = P2.length - 1; i >= 0; i--) { const [u0, y0, g, k] = P2[i];
      for (const uu of [u, u + 62]) { const lx = uu - u0, ly = y0 - y; if (lx < 0 || lx > 4 || ly < 0 || ly > 5) continue;
        const gx = lx - 1, gy = ly - 1, on = gx >= 0 && gx < 3 && gy >= 0 && gy < 4 && FONT[g][gy][gx] === 'X'; return on ? scraps[k][1] : scraps[k][0]; } } return null; };
    return (x, y, z) => {
      if (isHead(y)) {
        if (face(y, z)) { if (eyeBox(x, y)) return x < 0 ? Fc[0] : Fc[1]; if (mouthBox(x, y)) return Fc[2];   // each feature clipped from a different magazine
          return y === 22 || y === 30 && x > -8 && x < 7 && (eyeBox(x, 29) || x === -1 || x === 0) && H(x, 0, 0, 24) % 2 === 0 ? Edge : scrapAt(wrapU(x, z), y) ?? Np; }
        if (ear(x, y)) return x < 0 ? Fc[0] : Fc[1];
        if (y >= 33 && x > -8 && x < 7 && z > -7 && z < 7) return mod((x >> 2) + (z >> 2), 2) ? scraps[0][0] : Np;
        return scrapAt(wrapU(x, z), y) ?? Np; }
      if (hand(x, y)) return x < 0 ? Fc[0] : Fc[1];
      if (joint(x, y)) return Np;
      const k = (x < 0 ? 1 : 3) + (y >= 13 ? 1 : 0), [bg, fg] = scraps[k % scraps.length], lu = limbU(x, z);
      if (arm(x, y)) return y === 14 && mod(lu, 3) === 0 ? fg : bg;
      return y === 6 && mod(lu, 2) === 0 ? fg : bg; };
  },
  // club kid: white greasepaint, red dots all over, painted cobalt eye patches and red-painted lips (the patches frame the eyes, the
  // lip paint frames the mouth, so the face reads louder, not lost)
  clubkid(W, R, B) {
    const patch = (x, y) => eyeBox(x, y) && !((y === 22 || y === 29) && (x === -8 || x === -2 || x === 1 || x === 7));
    const dot2 = (a, b) => { const row = Math.floor(b / 4), aa = a + (row & 1) * 3; return mod(aa, 6) < 2 && mod(b, 4) < 2; };
    return (x, y, z) => {
      if (isHead(y)) {
        if (face(y, z)) { if (patch(x, y)) return B; if (y >= 19 && y <= 21 && x >= -3 && x <= 2) return R; if (mouthBox(x, y)) return W; return dot2(x + 8, y - 19) ? R : W; }
        if (ear(x, y)) return y === 23 ? R : W;
        if (y >= 33) return dot2(x + 8, z + 7) ? R : W;
        return dot2(wrapU(x, z), y - 19) ? R : W; }
      if (joint(x, y)) return W;
      if (hand(x, y)) return y === 6 ? R : W;                                                 // painted nails
      return mod(limbU(x, z) + (y % 2) * 3, 5) === 0 && y % 2 === 1 ? R : W; };
  },
  // black ice: a black-diamond pavé, the whole body set in faceted stones: each 2 × 2 cell one stone in its own dark tone, lit at
  // its top corner and shadowed at the bottom, with white fire on some and the odd prism flash; the eye and mouth fields are polished
  // setting, so pale brows and a pale mouth read on it
  pave(base, tones, ice, prism) {
    return (x, y, z) => { if (quiet(x, y, z)) return base; if (joint(x, y) && y < 19) return tones[0];
      const cell = H(x >> 1, y >> 1, z >> 1, 11), tone = tones[cell % tones.length], top = (y & 1) === 1, left = ((x + z) & 1) === 0;
      if (top && left) return cell % 4 === 0 ? ice : cell % 17 === 1 ? prism[(cell >>> 5) % prism.length] : lerpHex(tone, ice, .32);
      return !top && !left ? shade(tone, .72) : tone; };
  },
  // counterfeit: the agent printed on a fake note. The face is the note's portrait in its oval, guilloche spandrels in the corners
  // round it; fine engraved lines everywhere else, a big rosette seal on each side (teal and red), '100' on the back of the head
  counterfeit(Pa, E, D, Teal, Red) {
    const D3 = { 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'] };
    const digit = (a, b) => { if (b < 24 || b > 28) return false; const s = '100'; for (let i = 0; i < 3; i++) { const x0 = -6 + i * 4, lx = a - x0; if (lx >= 0 && lx < 3) return D3[s[i]][28 - b][lx] === 'X'; } return false; };
    const seal = (a, b, C) => { const d = Math.hypot(a - 3.6, b - 26); if (d < 1.1) return C; if (d < 2.2) return mod(a + b, 2) ? C : Pa; if (d < 3.1) return C; return null; };
    const lines = y => mod(y, 2) === 0 ? E : Pa;
    return (x, y, z) => {
      if (isHead(y)) {
        if (face(y, z)) { const e = ((x + .5) / 8.3) ** 2 + ((y - 25.5) / 7.2) ** 2, rim = x === -8 || x === 7;
          if (e > 1.12) return mod(x + y, 2) ? D : Teal;                                          // the guilloche spandrels round the oval
          if (e > .8 && (rim || !quiet(x, y, z))) return D;                                       // the portrait's oval frame
          return quiet(x, y, z) ? Pa : lines(y); }
        if (ear(x, y)) return lines(y);
        if (z <= -7) { if (digit(-1 - x, y)) return D; if (y === 22 || y === 30) return D; return lines(y); }   // the back reads '100' from behind
        if (x <= -8 && z < 7) { const s = seal(z, y, Teal); if (s) return s; } if (x >= 7 && z < 7) { const s = seal(z, y, Red); if (s) return s; }
        if (y >= 31) return mod(wrapU(x, z) + y, 2) ? D : E; return lines(y); }
      if (joint(x, y)) return Pa;
      if (arm(x, y)) return y === 11 || y === 15 ? D : lines(y);
      if (hand(x, y)) return Pa;
      return lines(y); };
  },
  // dissected: the art toy's anatomy cut. The left half is the clean vinyl; the right half is opened up: striated muscle on the face,
  // side and back, the brain under a bone rim on the crown, a bone hand, muscle down the right arm and leg with a kneecap
  dissected(F, M, Ms, Md, Bone, Br, Bf) {
    return (x, y, z) => {
      if (x < 0) return F;
      if (isHead(y)) {
        if (y >= 31) return mod(y + tri(x * 1.5 + z), 3) === 0 ? Bf : Br;                       // the brain, folded
        if (y === 30) return Bone;                                                              // the skull's cut rim
        if (ear(x, y)) return y === 23 ? Md : Ms;
        if (face(y, z)) { if (quiet(x, y, z)) return M; return mod(x + y, 3) === 0 ? Ms : M; }   // cheek muscle, diagonal
        return mod(x + z, 3) === 0 ? Ms : y === 19 ? Md : M; }                                   // neck and jaw muscle, vertical
      if (hand(x, y)) return y <= 8 && mod(x + z, 2) === 0 ? Md : Bone;                          // finger bones
      if (arm(x, y)) return joint(x, y) ? M : mod(z + x, 2) === 0 ? Ms : M;
      if (y >= 7 && y <= 8 && z >= 1) return Bone;                                               // the kneecap
      return mod(x + z, 2) === 0 ? Ms : M; };
  },
  // glow in the dark: phosphor vinyl on the unlit layer, so it glows at night; the toy's shading is baked into the paint (crown
  // bright, sides darker, back darkest) because the unlit layer takes no light
  gid(Hi, Mid, Lo, Dk) {
    return (x, y, z) => {
      if (isHead(y)) { if (face(y, z)) return Mid; if (y >= 33) return Hi; if (ear(x, y)) return Lo; if (z <= -7) return Dk; if (x <= -8 || x >= 7) return Lo; return y === 19 ? Dk : Mid; }
      if (hand(x, y)) return y === 6 ? Lo : Mid;
      if (arm(x, y)) return x === -8 || x === 7 ? Lo : z < 0 ? Dk : Mid;
      return z <= -1 ? Dk : (x === -2 || x === 1) ? Mid : Lo; };
  },
  // splatter: the art toy's splatter run on black vinyl, flicked by hand: blobs, flecks and the odd drip in four paints; the face's
  // eye and mouth fields stay clean
  splatter(K, cols) {
    const blobs = (x, y, z) => { const gx = Math.floor(x / 4), gy = Math.floor(y / 4), gz = Math.floor(z / 4);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const cx = gx + dx, cy = gy + dy, cz = gz + dz, h = H(cx, cy, cz, 13);
        if (h % 5 === 0) continue; const px = cx * 4 + (h & 3), py = cy * 4 + ((h >>> 2) & 3), pz = cz * 4 + ((h >>> 4) & 3), r = [.8, 1.3, 1.8][(h >>> 6) % 3];
        if (Math.hypot(x - px, y - py, z - pz) < r) return cols[(h >>> 9) % cols.length];
        if (r > 1 && x === px && y < py && y >= py - 3 && ((h >>> 11) & 1)) return cols[(h >>> 9) % cols.length]; }   // a drip under the big ones
      return null; };
    return (x, y, z) => { if (quiet(x, y, z)) return K; if (joint(x, y) && y < 19) return K;
      const b = blobs(x, y, z); if (b !== null) return b; const f = H(x, y, z, 14); return f % 17 === 0 ? cols[f % cols.length] : K; };
  },
  // dipped: the gallery's ultramarine pigment. Dipped head first to above the brows with runs down the sides and between the eyes,
  // hands dipped to the wrist (they did the painting), shins dipped from the socks; the pigment is matte and a little uneven
  dipped(F, U) {
    const pig = (x, y, z) => H(x, y, z, 15) % 4 === 0 ? shade(U, .9) : U;
    const line = (x, z) => 30 + (tri(wrapU(x, z) * .7) > 1 ? 1 : 0) - (H(wrapU(x, z), 0, 0, 16) % 5 === 0 ? 1 : 0);
    const run = u => { const h = H(u, 0, 0, 17); return h % 4 === 0 ? 2 + h % 5 : 0; };   // how far a run goes below the line
    return (x, y, z) => {
      if (isHead(y)) { if (face(y, z)) { if (y >= 30) return pig(x, y, z); if ((x === -1 || x === 0) && y >= (x ? 25 : 27)) return pig(x, y, z); return F; }
        if (ear(x, y)) return F; const u = wrapU(x, z), l = line(x, z); return y >= l || y >= l - run(u) ? pig(x, y, z) : F; }
      if (hand(x, y)) return pig(x, y, z);
      if (arm(x, y)) return y === 11 && !joint(x, y) && H(x, 0, z, 18) % 3 === 0 ? pig(x, y, z) : F;
      return y <= 5 + (H(x, 0, z, 19) % 3 === 0 ? 1 : 0) + (H(x, 1, z, 19) % 5 === 0 ? 1 : 0) ? pig(x, y, z) : F; };
  },
  // mirrorball: a disco ball cut into a person: mirror tiles in a bright-dark check so the grid reads, every tile a little off
  // (a dark one here, a white flare there) and pink, cyan and gold light spots; the eye and mouth fields are one even tile
  disco(hi, lo, dark, flare, flash, even) {
    return (x, y, z) => { if (quiet(x, y, z)) return even; if (joint(x, y) && y < 19) return lo;
      const h = H(x, y, z, 21), chk = ((x + y + z) & 1) ? hi : lo;
      return h % 11 === 0 ? flash[(h >>> 4) % flash.length] : h % 7 === 0 ? flare : h % 5 === 0 ? dark : chk; };
  },
  // hot leopard: the club's leopard print dyed hot pink. Broken black rosettes (C-shaped, never closed) round magenta hearts on a
  // jittered lattice, the odd lone spot between them; the eye and mouth fields stay plain pink
  leopard(B, K, M) {
    const T = [['.KKK.', 'K.MM.', 'KMMMK', '.MMMK', '.KK..'], ['..KK.', '.KMMK', 'KMMM.', 'K.MMK', '.KK..'], ['.KK..', 'KMMMK', '.MMMK', 'KMM..', '.K.K.']];
    const ros = (a, b) => { const row = Math.floor(b / 6), o = (row & 1) * 4, col = Math.floor((a - o) / 7), la = a - o - col * 7, lb = 5 - (b - row * 6), h = H(col, row, 0, 25);
      if (la < 5 && lb >= 0 && lb < 5) { const t = T[h % T.length], ch = t[lb][(h >>> 4) & 1 ? 4 - la : la]; if (ch !== '.') return ch === 'K' ? K : M; }
      return (la >= 5 || lb >= 5) && H(a, b, 1, 26) % 11 === 0 ? K : null; };
    return (x, y, z) => { if (quiet(x, y, z) || joint(x, y) && y < 19) return B;
      const top = y >= 33 && x > -8 && x < 7 && z > -7 && z < 7, a = isHead(y) ? (top ? x + 8 : wrapU(x, z)) : limbU(x, z), b = top ? z + 7 : y; return ros(a, b) ?? B; };
  },
  // bandana: the paisley bandana print as a skin: red ground, white paisleys with a black eye on a staggered lattice, the print's
  // dotted border rows round the crown and the jaw; the eye and mouth fields stay plain red
  bandana(R, W, K) {
    const PS = ['.X..', 'XXX.', 'XXXX', '.XKX', '..XX'];   // a paisley, 4 × 5 (top row first)
    const pais = (a, b) => { const row = Math.floor(b / 6), aa = a + (row & 1) * 4, la = mod(aa, 8), lb = 5 - mod(b, 6), mir = row & 1;
      if (la > 3 || lb > 4 || lb < 0) return null; const ch = PS[lb][mir ? 3 - la : la]; return ch === 'X' ? W : ch === 'K' ? K : null; };
    return (x, y, z) => {
      if (isHead(y)) { if (quiet(x, y, z)) return R; if (y === 32 || y === 20) return mod(wrapU(x, z), 2) ? W : R; if (ear(x, y)) return R;
        if (y >= 33 && x > -8 && x < 7 && z > -7 && z < 7) return mod(x + z, 3) === 0 ? W : R; return pais(wrapU(x, z), y - 21) ?? R; }
      if (joint(x, y)) return R;
      if (hand(x, y)) return y === 8 && mod(limbU(x, z), 2) === 0 ? W : R;
      return pais(limbU(x, z), y - 3) ?? (y === 12 && mod(limbU(x, z), 2) === 0 ? W : R); };
  },
  // heat signature: the police chopper's thermal camera. Six toon bands from indigo (cold) to yellow (hot): the face and neck run
  // hot, the crown, ears and nose cold, the hands cool towards the fingertips, the legs cooler down to the socks
  heat(stops) {
    const band = t => stops[Math.max(0, Math.min(stops.length - 1, Math.round(t * (stops.length - 1))))];
    return (x, y, z) => {
      if (isHead(y)) { if (z >= 8) return band(.5);                                                            // the nose runs cold
        if (ear(x, y)) return band(.18);
        const d = Math.hypot((x + .5) / 8, (y - 24) / 9, (z - 7) / 11); let t = 1 - d * .82; if (y >= 31) t -= .2; if (y === 33) t -= .1;
        if (face(y, z) && eyeBox(x, y)) t = Math.max(t, .8); return band(t); }
      if (hand(x, y)) return band(y <= 6 ? .2 : y <= 7 ? .4 : .6);
      if (arm(x, y)) return band(y >= 14 ? .6 : .4);
      return band(y >= 8 ? .4 : y >= 6 ? .2 : .2); };
  },
};

// ── the skins: [name, tier, who they are in the city, build]. build → { c (colour) | paint (x,y,z → colour), layer, ink, brow, mouth, lash, lip }
const SKINS = {
  opus2_bombed: ['bombed', 'grail', 'A writer\'s agent that never came out of the yard: stainless steel tagged end to end, a whole-car burner round the head, paint still on the fingertips.',
    () => ({ c: 0xb8bfc8, layer: 1, paint: P.bombed(0xb8bfc8, 0xa3abb6, [0xff3f8e, 0xff8a1f, 0xffd21f], 0x3a1f78, 0xffffff, [0x17171b, 0xe0182d, 0x2f5bff, 0x17171b, 0x25b84c]), ink: 0x1d2030, brow: 0x262a36, mouth: 0x262a36, lash: 0x121420, lip: 0x8f96a3 })],
  opus2_ransom: ['ransom note', 'epic', 'Pasted up from magazine cut-outs at a kitchen table: each eye and the mouth from a different face, the demand spelled out in scraps everywhere else.',
    () => ({ c: 0xe0a982, paint: P.ransom([0xe0a982, 0xa8724e, 0xf1c9aa], 0xfbfaf6, 0xd6d1c4, [[0xfbfaf6, 0x17171b], [0x17171b, 0xfbfaf6], [0xe0182d, 0xfbfaf6], [0xffc21a, 0x17171b], [0x3fa9f5, 0xfbfaf6], [0xff4fa3, 0x17171b], [0xbdb6a6, 0x17171b]]),
      ink: 0x2a1a14, brow: 0x2a1810, mouth: 0x3e211a, lash: 0x160f0f, lip: 0xc0705a })],
  opus2_clubkid: ['club kid', 'epic', 'Off the guest list since the nineties: white greasepaint, red dots to the fingertips, cobalt eyes and painted lips. Still out.',
    () => ({ c: 0xf3efe9, paint: P.clubkid(0xf3efe9, 0xe0182d, 0x2f5bff), ink: 0x141414, brow: 0x141414, mouth: 0x141414, lash: 0x0a0a0a, lip: 0xe0182d })],
  opus2_blackice: ['black ice', 'grail', 'The fence\'s agent, set stone by stone in black diamonds after the vault job. It sparkles under the street lamps and nobody asks.',
    () => ({ c: 0x2a2c35, layer: 1, paint: P.pave(0x2a2c35, [0x22242c, 0x3a3e4c, 0x4b5062, 0x737b92], 0xeaf7ff, [0xff9cf0, 0x9cf8ff]), ink: 0xbfe6ff, brow: 0xd6ecff, mouth: 0xd6ecff, lash: 0x0b0c10, lip: 0x5a6075 })],
  opus2_counterfeit: ['counterfeit', 'epic', 'Printed in a back room on the docks, a hundred at a time: money-green paper, engraved line work, a seal on each side. Spend it fast.',
    () => ({ c: 0xd3dfbf, paint: P.counterfeit(0xd3dfbf, 0xa6bd90, 0x3d5a3a, 0x2f8f7f, 0xc8333a), ink: 0x2c4630, brow: 0x2c4630, mouth: 0x2c4630, lash: 0x1a2a1c, lip: 0x9fb98a })],
  opus2_dissected: ['dissected', 'grail', 'The art toy\'s anatomy cut, walking around: clean vinyl down one side, muscle, bone and brain down the other. Museum gift shops can\'t keep it.',
    () => ({ c: 0xeab28c, paint: P.dissected(0xeab28c, 0xc93a42, 0xe0656a, 0x9c2730, 0xf2e8d8, 0xf4a6b8, 0xd77a92), ink: 0x2a1012, brow: 0x3a1a14, mouth: 0x3a1a14, lash: 0x1e0d0a, lip: 0xc85a5a })],
  opus2_gid: ['glow in the dark', 'epic', 'The toy drop\'s GID variant: pale phosphor vinyl by day, a green glow on the corner at night. Charge it under the deli lights.',
    () => ({ c: 0xc4f2a2, layer: 3, paint: P.gid(0xe2ffcc, 0xc4f2a2, 0xa2dc82, 0x86c86a), ink: 0x2a5a20, brow: 0x2f6b25, mouth: 0x2f6b25, lash: 0x183d12, lip: 0x8fd16c })],
  opus2_splatter: ['splatter', 'rare', 'The art toy\'s splatter run, flicked by hand so no two match: black vinyl hit with bone, pink, yellow and cyan.',
    () => ({ c: 0x1d1d22, layer: 1, paint: P.splatter(0x1d1d22, [0xf4f1ea, 0xff4fa3, 0xffd21f, 0x3fd0f5]), ink: 0xffd21f, brow: 0xf4f1ea, mouth: 0xf4f1ea, lash: 0x0a0a0c, lip: 0xff4fa3 })],
  opus2_dipped: ['dipped', 'epic', 'The gallery opening\'s living brush: dipped head first in ultramarine pigment, hands dyed from the performance, blue to the shins.',
    () => ({ c: 0xc98c5e, paint: P.dipped(0xc98c5e, 0x1f3bd8), ink: 0x1a1a40, brow: 0x2a1a10, mouth: 0x3e211a, lash: 0x160f0f, lip: 0xb06a4c })],
  opus2_disco: ['mirrorball', 'grail', 'The club\'s mirrorball, gone walkabout at closing: a thousand mirror tiles, every one throwing a different light.',
    () => ({ c: 0xc9cfd8, layer: 1, paint: P.disco(0xeef1f6, 0xaab2bf, 0x6c7486, 0xffffff, [0xff7ac8, 0x6fe2ff, 0xffd86a], 0xc9cfd8), ink: 0x1a1c22, brow: 0x1a1c22, mouth: 0x1a1c22, lash: 0x0e0f12, lip: 0x9aa3b2 })],
  opus2_leopard: ['hot leopard', 'rare', 'The coat-check girl\'s best coat, worn as a skin: leopard print dyed hot pink, black rosettes round magenta hearts. Doors at eleven.',
    () => ({ c: 0xff5fb0, paint: P.leopard(0xff5fb0, 0x17171b, 0xb0186e), ink: 0x17171b, brow: 0x17171b, mouth: 0x3a0a22, lash: 0x100a0e, lip: 0xb0186e })],
  opus2_bandana: ['bandana', 'rare', 'The corner store\'s best seller for thirty years, folded into everything: red paisley print, head to shins.',
    () => ({ c: 0xc8202b, paint: P.bandana(0xc8202b, 0xf4f1ea, 0x17171b), ink: 0xf4f1ea, brow: 0x17171b, mouth: 0x17171b, lash: 0x0e0a0a, lip: 0x8e1018 })],
  opus2_heat: ['heat signature', 'epic', 'How the police chopper sees you at 2 a.m.: a thermal ghost, hot in the face, cold at the nose, the ears and the fingertips.',
    () => ({ c: 0xc8247a, paint: P.heat([0x1b0b4a, 0x4a1a8c, 0x9b1f8a, 0xe0356a, 0xff7a1f, 0xffc21a]), ink: 0x1b0b4a, brow: 0x1b0b4a, mouth: 0x1b0b4a, lash: 0x12062e, lip: 0xff7a1f })],
};
export const OPUS2_SKINS = Object.fromEntries(Object.entries(SKINS).map(([id, [name, tier, who]]) => [id, { name, tier, who }]));

function record(id, s) {   // the record skinOf returns for a built-in skin, with this skin's paints
  const memo = s.memo ??= new Map();   // (a paint is pure: each cell is worked out once per skin, shared by every build)
  const c = s.paint ? ((x, y, z) => { const X = Math.round(x), Y = Math.round(y), Z = Math.round(z), k = (X + 64) * 16384 + (Y + 64) * 128 + (Z + 64);
    let v = memo.get(k); if (v === undefined) { v = s.paint(X, Y, Z) ?? s.c; memo.set(k, v); } return v; }) : (() => s.c);
  return { id, c, sh: (x, y, z) => shade(c(x, y, z), .8), layer: s.layer ?? 0, ink: s.ink ?? 0x2a1a14, brow: s.brow ?? 0x22160f, mouth: s.mouth ?? 0x3e211a,
    lash: s.lash ?? 0x160f0f, lip: s.lip ?? lerpHex(shade(s.c, .85), 0xd0505a, .35), noEars: false, alienEyes: false, screen: undefined, decorate: undefined };
}

export function installOpus2Skins({ SPECIES, NAMES, TIER, NEWT, NEWI, shade: sh, lerpHex: lh, hash3: h3 }) {
  shade = sh; lerpHex = lh; hash3 = h3;
  NEWT.skin ??= {};
  for (const [id, [name, tier, who, build]] of Object.entries(SKINS)) {
    const s = build();
    SPECIES[id] = { c: s.c, make: () => record(id, s) };
    NAMES.skin[id] = name; TIER[id] = tier;
    NEWT.skin[id] = [name, tier, null, tier === 'grail' ? who : undefined];
    NEWI[id] = { id, slot: 'skin', name, tier, cw: null, why: who, new: true, origin: 'opus2', wearer: who };
  }
}
