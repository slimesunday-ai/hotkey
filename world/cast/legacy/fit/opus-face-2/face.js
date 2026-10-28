// OPUS 2 FACE (2026-10-01): ten eyes and ten mouths for AI City, ids opus2_*, origin 'opus2' (the Trait Studio's "opus 2").
// slime: "we also need more eyes and mouths … it doesnt need to be all city vibe stuff, like it's hypebeast/dazed/crime/nyc".
// Toon faces from the culture: designer-toy and art-world faces, Dazed beauty and weirdness, fictional crime-world flex, New York
// street detail, Simpsons-style cartoon expression. No grills, gold teeth or fangs, no computer / internet faces (slime's kills).
// chars.js installs it with one call BEFORE installHead:
//   installOpus2Face({ EYE, MOUTH, faceGrid, NEWT, NEWI, NAMES })
// Its face extras chain onto faceGrid.fx round the chain already there (opus face → refit-head's faceFx): our eyes paint first (so
// under eyewear their 1-proud bits lie flat, like every other eye), our mouth pieces paint last (they keep their 1 proud).
//
// Fit (world/fit/contract.js, enforced by style/city/studio/audit/run.mjs):
//   EYES  · the face at z 7 (flush), proud bits at z 8 at most; drawn only with the eyes open, so the blink closes them with
//           refit-head's standard lids. The brows and anything outside the eye box (a liner's wing) stay through the blink.
//           Screen skins and the alien keep their own eyes. Every eye carries its own contrast (a white, a dark socket or an
//           outline), so it reads on pale through ebony, the special skins (vinyl, holo, patina, 24k…) and the odd species.
//   MOUTH · z 8 at most (mouth piece budget 1), every cell backed by the face (y ≥ 19, x −8…7), no lit white pixels and no proud
//           white (slime on the gem grill: "it would be better flat"): teeth are flat; only the ember is lit, and it is orange.

const lerp = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };

// ── the registry (NEWT's shape): slot → id → [name, tier, colourways, why (grails)]
export const OPUS2_FACE = {
  eyes: {
    opus2_roll: ['eye roll', 'common'],
    opus2_allnighter: ['all-nighter', 'common'],
    opus2_googly: ['googly eyes', 'common'],
    opus2_dollar: ['cha-ching', 'rare'],
    opus2_button: ['button eyes', 'rare'],
    opus2_liner: ['graphic liner', 'rare'],
    opus2_token: ['subway tokens', 'epic'],
    opus2_nazar: ['evil eye', 'epic'],
    opus2_neon: ['psychic neon', 'grail', null, 'The palm reader\'s window sign, lit all night over the avenue: pink tube, cyan iris, readings walk-in.'],
    opus2_eroded: ['eroded', 'grail', null, 'Cast in plaster and left for the future: the sockets have crumbled open and crystal grows where the eyes were.'],
  },
  mouth: {
    opus2_bucky: ['buck teeth', 'common'],
    opus2_grin: ['ear to ear', 'common'],
    opus2_lipbite: ['lip bite', 'common'],
    opus2_busted: ['busted lip', 'common'],
    opus2_zip: ['no comment', 'rare'],
    opus2_stache: ['waxed handlebar', 'rare'],
    opus2_smudge: ['smudged lipstick', 'rare'],
    opus2_binky: ['rave binky', 'epic'],
    opus2_slice: ['dollar slice', 'epic'],
    opus2_cigar: ['kingpin cigar', 'grail', null, 'The corner office is the corner: a fat one, banded and lit, and never smoked down past the band.'],
  },
};

// paint rows (top row at y `top`, columns through X) with a palette letter → [colour, layer, z]
const paint = (F, X, rows, top, pal) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const v = pal[r[i]]; if (v) F.set(X(i), top - j, v[2] ?? 7, v[0], v[1]); } });
const W = [0xf6f4ef, 0], INK = [0x141013, 1];

// ── eyes: the base shape (chars.js EYE spec: rows y 26 → 23, outer → inner; brows y 29 → 27), then fx paints the rest
const NONE = ['.....', '.....', '.....'], UP = ['BBBBB', '.....', '.....'];
const EYES = {
  opus2_roll: { e: ['WPPPW', 'WWWWW', 'WWWWW', '.WWW.'], b: UP },   // (the pupils rolled up under the lid, the brows up with them)
  opus2_allnighter: { e: ['LLLLL', 'WWPPW', 'WWPPW', '.WWW.'], b: ['.....', 'BBBBB', '.....'] },
  opus2_googly: { e: ['.....', '.....', '.....', '.....'], b: UP },
  opus2_dollar: { e: ['.....', '.....', '.....', '.....'], b: NONE },
  opus2_button: { e: ['.....', '.....', '.....', '.....'], b: NONE },
  opus2_liner: { e: ['KKKKK', 'WWPPW', 'WWPPW', '.....'], b: UP },
  opus2_token: { e: ['.....', '.....', '.....', '.....'], b: UP },
  opus2_nazar: { e: ['.....', '.....', '.....', '.....'], b: UP },
  opus2_neon: { e: ['.....', '.....', '.....', '.....'], b: NONE },
  opus2_eroded: { e: ['.....', '.....', '.....', '.....'], b: NONE },
};
// X(i): i 0 = the outer column (x −7 / 6), 4 the inner (x −3 / 2); i −1 is the head's edge column, i 5 the bridge side
const EYEFX = {
  // eye roll: the line of the upper lid over the rolled-up pupils
  opus2_roll(F, sk, X, s, closed) { if (closed) return; for (let i = 0; i < 5; i++) F.set(X(i), 27, 7, sk.lash); },
  // all-nighter: the city that never sleeps, bloodshot whites over heavy bags (the bags are skin: they stay through the blink)
  opus2_allnighter(F, sk, X, s, closed) { const bag = (x, y, t) => lerp(shade(sk.c(x, y, 7), .8), 0x5b3a78, t);
    for (let i = 0; i < 5; i++) F.set(X(i), 22, 7, bag(X(i), 22, i === 0 || i === 4 ? .18 : .3));
    if (closed) return; const V = 0xdc5a62;
    for (const [i, y] of [[0, 24], [4, 25], [3, 23]]) F.set(X(i), y, 7, V); F.set(X(0), 23, 7, bag(X(0), 23, .3)); F.set(X(4), 23, 7, bag(X(4), 23, .3)); },
  // googly eyes: a craft-store dome stuck on, 1 proud, its pupil loose (one sank low and out, one rolled up and in)
  opus2_googly(F, sk, X, s, closed) { if (closed) return; const D = [0xfbfaf7, 1, 8], S = [0xd6d2c8, 1, 8], P = [0x0e0e10, 1, 8];
    paint(F, X, ['.DDD.', 'DDDDD', 'DDDDD', 'DDDDS', '.SSS.'], 27, { D, S });
    paint(F, X, s ? ['.....', '..PP.', '..PP.'] : ['.....', '.....', '.....', 'PP...', '.PP..'], 27, { P }); },
  // cha-ching: a green dollar sign on the white of each eye, read the right way round in both (not mirrored)
  opus2_dollar(F, sk, X, s, closed) { if (closed) return; const N = s ? (i => 2 + i) : (i => -7 + i), G = [0x12a346, 1];
    paint(F, N, ['..G..', '.GGGG', 'G.G..', '.GGG.', '..G.G', 'GGGG.', '..G..'], 28, { G });
    paint(F, N, ['', 'W....', '.W.WW', 'W...W', 'WW.W.', '....W'], 28, { W }); },
  // button eyes: an art-toy plush's eyes, mismatched buttons sewn on 1 proud, the thread's cross through four holes
  opus2_button(F, sk, X, s, closed) { if (closed) return; const C = s ? 0x4a82ff : 0xff3b4e;
    paint(F, X, ['.rrr.', 'rhBhr', 'rBhBr', 'rhBhr', '.rrr.'], 27, { r: [shade(C, .78), 1, 8], B: [C, 1, 8], h: [0x16121a, 0, 8] }); },
  // graphic liner: a black wing flicked out past the eye, a hot-pink line under it, bleached brows (they stay through the blink)
  opus2_liner(F, sk, X, s, closed) { const Bl = 0xefe0a6;
    for (let i = 0; i < 5; i++) F.set(X(i), 29, 8, i === 4 ? shade(Bl, .92) : Bl);
    F.set(X(0), 27, 7, 0x0d0b10, 1); F.set(X(-1), 28, 7, 0x0d0b10, 1);
    if (closed) return; for (let i = 1; i < 5; i++) F.set(X(i), 23, 7, 0xff2a8a, 1); F.set(X(0), 24, 7, 0xff2a8a, 1); },
  // subway tokens: the old brass fare token in each socket, the Y punched through it
  opus2_token(F, sk, X, s, closed) { if (closed) return;
    paint(F, X, ['.hrr.', 'hcgcr', 'rgcgr', 'rgcgd', '.rdd.'], 27, { h: [0xf2c65a, 1], r: [0xc4922e, 1], d: [0x93691c, 1], g: [0xffd76a, 1], c: [0x24190a, 0] }); },
  // evil eye: the blue glass charm, navy, white, sky and a black pupil
  opus2_nazar(F, sk, X, s, closed) { if (closed) return;
    paint(F, X, ['.NNN.', 'NWLWN', 'NLKLN', 'NWLWN', '.NNN.'], 27, { N: [0x1b3fb0, 1], W: [0xf6f4ef, 1], L: [0x5cc6ff, 1], K: [0x0c0c10, 1] }); },
  // psychic neon: the palm reader's window sign, a lit pink tube round an almond with a cyan iris, on black glass (off in a blink)
  opus2_neon(F, sk, X, s, closed) { if (closed) return; const Y = i => X(i - 1);
    paint(F, Y, ['..PPP..', '.PgCgP.', 'PgCCCgP', '.PgCgP.', '..PPP..'], 27, { P: [0xff3d9a, 3, 8], C: [0x3fe9ff, 3], g: [0x170c1e, 0] }); },
  // eroded: the socket crumbled open, dark inside, aqua crystal growing out of it (the points 1 proud), a hairline crack
  opus2_eroded(F, sk, X, s, closed) { if (closed) return;
    paint(F, X, ['.ddd.', 'dDDad', 'dmaDd', 'dDmad', '.ddd.'], 27, { d: [0x2a2630, 0], D: [0x141219, 0], a: [0x8fe6e4, 1], m: [0x3fb4c6, 1] });
    F.set(X(1), 25, 8, 0x5fd0d8, 1); F.set(X(2), 24, 8, 0x5fd0d8, 1); F.set(X(3), 26, 8, 0x2f98b0, 1);
    for (const [i, y] of [[-1, 28], [0, 28], [1, 22], [0, 21]]) F.set(X(i), y, 7, shade(sk.c(X(i), y, 7), .62)); },
};

// ── mouth: the base (chars.js MOUTH grid, rows y 21 → 19, x −3…2) and the piece, drawn after refit-head's face extras
const E3 = ['......', '......', '......'];
const MOUTHS = {
  opus2_bucky: ['.KKKK.', '......', '......'],
  opus2_grin: E3, opus2_lipbite: E3, opus2_busted: ['.KKKK.', '......', '......'], opus2_zip: E3, opus2_stache: E3,
  opus2_smudge: E3, opus2_binky: E3, opus2_slice: E3, opus2_cigar: E3,
};
const set = (F, cells, z = 7) => cells.forEach(([x, y, c, l]) => F.set(x, y, z, c, l ?? 0));
const MOUTHFX = {
  // buck teeth: a happy line turned up at the corners, two big front teeth over the chin (flat)
  opus2_bucky(F, sk) { F.set(-3, 22, 7, sk.mouth); F.set(2, 22, 7, sk.mouth);
    for (const y of [20, 19]) { F.set(-1, y, 7, 0xf6f4ef); F.set(0, y, 7, 0xe6e0d2); } },
  // ear to ear: a toon laugh past the mouth's width, corners up, the top teeth, a tongue at the bottom
  opus2_grin(F, sk) { const M = sk.mouth; F.set(-6, 22, 7, M); F.set(5, 22, 7, M); F.set(-5, 21, 7, M); F.set(4, 21, 7, M);
    for (let x = -4; x < 4; x++) { F.set(x, 21, 7, x === -4 || x === 3 ? 0xe2ddd0 : 0xf6f4ef); F.set(x, 20, 7, M); }
    for (let x = -3; x < 3; x++) F.set(x, 19, 7, x === -1 || x === 0 ? 0xff6b8a : M); },
  // lip bite: the top teeth sunk in the lower lip, one corner up
  opus2_lipbite(F, sk) { const M = sk.mouth, Lp = sk.lip; for (let x = -3; x < 2; x++) F.set(x, 21, 7, M); F.set(2, 22, 7, M); F.set(2, 21, 7, M);
    for (let x = -3; x < 3; x++) F.set(x, 20, 7, x === -1 ? 0xf6f4ef : x === 0 ? 0xe6e0d2 : Lp, 1);
    for (let x = -2; x < 2; x++) F.set(x, 19, 7, shade(Lp, .86), 1); },
  // busted lip: the lower lip split and swollen on one side (1 proud), a red cut
  opus2_busted(F, sk) { set(F, [[-3, 20, 0x8e2c4c, 1], [-2, 20, 0xd11a22, 1], [-1, 20, 0xa8385c, 1], [-3, 19, 0x7a2442, 1], [-2, 19, 0x9c3154, 1]], 8); },
  // no comment: the mouth zipped shut, the slider and its pull tab 1 proud at the corner
  opus2_zip(F) { const T = 0x1c1c22; for (let x = -4; x < 4; x++) { F.set(x, 21, 7, T); F.set(x, 19, 7, T); F.set(x, 20, 7, (x & 1) ? 0xc4cad1 : 0x868d97, 1); }
    set(F, [[4, 21, 0xc9ced4, 1], [4, 20, 0xa9b0b9, 1], [4, 19, 0x8a919b, 1], [5, 19, 0x9aa1aa, 1]], 8); },
  // waxed handlebar: a Brooklyn-barber moustache 1 proud, pomaded (gloss), the tips curled up; the mouth a line under it
  opus2_stache(F, sk) { const C = 0x1d1512, Hi = 0x4a352a;
    for (let x = -5; x < 5; x++) F.set(x, 21, 8, (x === -3 || x === 2) ? Hi : C, 1);
    for (let x = -3; x < 3; x++) F.set(x, 20, 8, (x === -1 || x === 0) ? shade(C, .8) : C, 1);
    F.set(-6, 22, 8, Hi, 1); F.set(5, 22, 8, Hi, 1);
    for (let x = -2; x < 2; x++) F.set(x, 19, 7, sk.mouth); },
  // smudged lipstick: the morning after a Dazed shoot, red lips (flat, gloss) dragged out across one cheek
  opus2_smudge(F, sk) { const R = 0xec1f3c, Rd = 0xb8122c, M = sk.mouth;
    for (let x = -3; x < 3; x++) { F.set(x, 21, 7, x === -3 || x === 2 ? Rd : R, 1); F.set(x, 19, 7, x === -3 || x === 2 ? Rd : R, 1); }
    for (let x = -2; x < 2; x++) F.set(x, 20, 7, M); F.set(-3, 20, 7, R, 1); F.set(2, 20, 7, R, 1);
    for (const [x, y, t] of [[3, 20, .25], [4, 20, .45], [3, 19, .35], [4, 21, .6], [5, 21, .7], [6, 22, .8], [5, 20, .7]]) F.set(x, y, 7, lerp(R, sk.c(x, y, 7), t), 1); },
  // rave binky: a candy pacifier over the mouth, 1 proud: a sky-blue butterfly shield, a hot-pink ring handle round its knob
  opus2_binky(F) { const S = 0x6fd0ff, Se = 0x2f8fd0, R = 0xff3d9a, Rd = 0xd82a7e, Kn = 0xfff07a;
    for (const [y, a, b] of [[22, -5, -4], [21, -6, -3], [20, -6, -3], [19, -5, -3]]) for (let x = a; x <= b; x++) { F.set(x, y, 8, x === a ? Se : S, 1); F.set(-1 - x, y, 8, x === a ? Se : S, 1); }
    for (let x = -2; x < 2; x++) { F.set(x, 21, 8, R, 1); F.set(x, 19, 8, Rd, 1); } F.set(-2, 20, 8, R, 1); F.set(1, 20, 8, Rd, 1);
    F.set(-1, 20, 8, Kn, 1); F.set(0, 20, 8, shade(Kn, .88), 1); },
  // dollar slice: a slice held at the corner of the mouth by its crust, pointing out over the cheek, 1 proud
  opus2_slice(F, sk) { const Cr = 0xd29444, Cd = 0xa96c2a, Ch = 0xffcf4a, Cm = 0xffe07a, Pp = 0xc0262d, Sa = 0xe0471f;
    for (let x = -3; x < 1; x++) F.set(x, 20, 7, sk.mouth);
    const rows = { 22: [2, 3], 21: [2, 5], 20: [2, 7], 19: [2, 4] };
    for (const y of [22, 21, 20, 19]) { F.set(1, y, 8, y === 22 || y === 19 ? Cd : Cr); const [a, b] = rows[y]; for (let x = a; x <= b; x++) F.set(x, y, 8, x === 2 ? Sa : ((x + y) % 3 === 0 ? Cm : Ch), 1); }
    for (const [x, y] of [[3, 21], [5, 20], [3, 19]]) F.set(x, y, 8, Pp, 1); },
  // kingpin cigar: a fat one from the corner of the mouth, drooping, a gold band and a lit ember (orange, never white)
  opus2_cigar(F, sk) { const Bd = 0x6b3f20, Bl = 0x8a5530, G = 0xe7bd4a, Gr = 0xc0262d, A = 0x9a9590, Ad = 0x6e6a66;
    for (let x = -2; x < 2; x++) F.set(x, 20, 7, sk.mouth); F.set(2, 21, 7, sk.mouth);
    set(F, [[-3, 21, Bl], [-3, 20, Bd], [-4, 21, G, 1], [-4, 20, Gr, 1], [-5, 21, Bl], [-5, 20, Bd], [-6, 20, Bl], [-6, 19, Bd],
      [-7, 20, A], [-7, 19, Ad], [-8, 20, 0xff6a1f, 3], [-8, 19, 0xe8321a, 3]], 8); },
};

// ── install
export function installOpus2Face({ EYE, MOUTH, faceGrid, NEWT, NEWI, NAMES }) {
  for (const [slot, o] of Object.entries(OPUS2_FACE)) { NEWT[slot] ||= {}; NAMES[slot] ||= {};
    for (const [id, [name, tier, cw, why]] of Object.entries(o)) {
      NEWT[slot][id] = [name, tier, cw || null, why || null];
      NEWI[id] = { id, slot, name, tier, cw: cw || null, why: why || null, new: true, origin: 'opus2', collection: 'opus-face-2' };
      NAMES[slot][id] = name; } }
  Object.assign(EYE, EYES); Object.assign(MOUTH, MOUTHS);
  // faceGrid.fx: ours wraps the chain installed so far (opus face's, which forwards to refit-head's faceFx when that is installed):
  // eyes before it, mouth pieces after it. A later assignment goes on to the chain's own setter, so nothing is dropped.
  const d = Object.getOwnPropertyDescriptor(faceGrid, 'fx'), prev = faceGrid.fx || null; let next = null;
  const fx = (F, sk, L, closed) => {
    const e = EYEFX[L.eyes]; if (e && !sk.alienEyes) for (const s of [0, 1]) e(F, sk, i => s ? 6 - i : -7 + i, s, closed);
    if (prev) prev(F, sk, L, closed); if (next) next(F, sk, L, closed);
    const m = MOUTHFX[L.mouth]; if (m) m(F, sk); };
  Object.defineProperty(faceGrid, 'fx', { configurable: true, enumerable: true, get: () => fx, set: f => { if (d && d.set) d.set(f); else next = f; } });
}
