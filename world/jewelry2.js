// JEWELLERY v2 (AI City · Fit Street, 2026-09-29): the drop 02 jewellery redrawn in place (same ids, same tiers, 3–4 colourways)
// and 12 new pieces + 3 v2 alternates of approved pieces, all behind NEW_TRAITS like the rest of the drop. chars.js wires it with one
// call after the drop is registered: installJewelry({ NECK, MOUTH, EARS, ACC, NEWT, NEWI, NAMES }).
// Self-contained (no import of chars.js, so no import cycle): the Grid's own methods only (set, has, frontZ).
//
// What reads at 1/20 (the study, world/TRAITS-NEW.md "Jewelry"): a link is one voxel, so a chain's TYPE is its rhythm (figaro 3+1,
// rope diagonals, cuban paired blocks, franco chevrons), never its shape; metal on layer 2 goes olive under a blue sky, so every
// metal mixes gloss glints (layer 1) into its links; ice is the white / blue checker plus a lit (layer 3) glint or two, the only
// thing that still reads at 10 m; the chest under the chin is 8 rows (y 9…17), so a pendant is ≤ 6 × 6 and hangs from a short V.
//
// Rigging: neck pieces stay in x −5…4 (the chest); a pendant is a flat plate hung from the chain's lowest link. Every plate voxel is
// recorded in B.jw (voxel key → pivot height in metres, + 2 when iced), which anim/bake.js (o.jewel) turns into the aJw attribute
// for anim/jewelry-motion.js (the swing, lab only). Ice on chains and grills is recorded too (pivot 0: the sparkle only).
const K = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256);   // chars.js Vox.k
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const S = 1 / 20;
import { strand, plate as layPlate, faceRing } from './fit/layers.js';   // the necklace renderer (ring + drop + flat plate)

// ── colourways (shared lists): metals, and the ice's settings
const Y = 0xe7bd4a, W = 0xdfe6ee, R = 0xe8a08a, O = 0x1e1e22, ICEW = 0xffffff, ICEB = 0xa8e4ff;
const METALS = [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['onyx / gold', O, Y]];
const ICED = [['iced / yellow', Y], ['iced / white', W], ['iced / rose', R], ['black ice', O]];

// ── the registry (NEWT's shape): slot → id → [name, tier, colourways, why (grails)]. Drop 02's ids keep their name and tier.
export const JEWEL_REG = {
  mouth: { diamond: ['diamond tooth', 'rare'], openface: ['open-face gold', 'rare'], fangs: ['gold fangs', 'epic'], perms: ['gold perms', 'epic'],
    gems: ['sherbet gem grill', 'grail', null, 'Every tooth a different stone: the one grill you can read from across the street.'],
    gapgold: ['gap-tooth golds', 'common'], septum: ['gold septum', 'rare'] },
  ears: {
    earstack: ['ear stack', 'common', [['gold / ice', Y, ICEB], ['silver / ice', W, ICEB], ['gold / ruby', Y, 0xe0182d], ['rose / ice', R, ICEB]]],
    cross: ['cross drop', 'common', [['gold', Y, 2], ['silver', W, 2], ['iced', ICEB, 1], ['rose', R, 2]]],
    icestud: ['princess-cut studs', 'rare', [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['black diamond', O]]],
    hoopstack: ['hoops + huggies', 'common', [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['gold / ice', Y, 1]]],
  },
  neck: {
    pearls: ['pearl strand', 'rare', [['white', 0xf4efe4], ['black pearl', 0x3a3a46], ['pink', 0xf7c9d8], ['gold-spaced', 0xf4efe4, Y]]],
    choker: ['iced choker', 'rare', [['ice', W], ['onyx / gold', O, Y], ['rose ice', R], ['yellow ice', Y]]],
    catpiece: ['bodega-cat piece', 'epic', [['gold / emerald', Y, 0x2ecc40], ['white gold / sapphire', W, 0x2b6cff], ['rose / ruby', R, 0xe0182d], ['black cat', O, Y]]],
    icecuban: ['iced cuban', 'grail', [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['two-tone', Y, W]], 'Thick enough that the whole block clocks it: the chain robbers look for first.'],
    cuffs: ['iced handcuffs', 'grail', [['ice / gold', 'ice', Y], ['all gold', Y, Y], ['blacked out', 0x1e1e22, 0x9aa0a6], ['ice / rose', 'ice', R]], 'Crime-world humour you have to be rich to wear: iced cuffs hanging off a Cuban.'],
    // new
    figaro: ['figaro chain', 'common', [['yellow gold', Y], ['white gold', W], ['rose gold', R]]],
    franco: ['franco chain', 'rare', METALS],
    tennischoker: ['tennis choker', 'rare', [['white gold', W], ['yellow gold', Y], ['rose gold', R], ['sapphire', W, 0x2b6cff]]],
    nameplate: ['initial plate', 'rare', [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['onyx / ice', O, Y]]],
    layers: ['three-length stack', 'epic', [['all yellow', Y, Y, Y], ['all white', W, W, W], ['tri-gold', W, Y, R], ['onyx mix', O, Y, W]]],
    noggin: ['Lil Noggin piece', 'epic', [['gold / red cap', Y, 0xd7141a], ['white / royal cap', W, 0x1d4ed8], ['rose / pink cap', R, 0xff5ea8], ['onyx / gold cap', O, Y]]],
    chase: ['chase-figure piece', 'epic', [['gold / slime', Y, 0x6cf542, 0xff5ea8], ['white / cop blue', W, 0x1d4ed8, 0xf2f2f2], ['rose / bubblegum', R, 0xff9ccb, 0x2de2e6], ['black / fire', O, 0xff6a00, 0xffd21f]]],
    exhibit: ['exhibit A', 'grail', [['iced yellow', Y], ['iced white', W], ['iced rose', R]], 'A chain in an evidence bag, worn on an iced Cuban: the piece that says the case went away.'],
    // v2 alternates of approved pieces (the originals stay as they are)
    dollar2: ['iced dollar v2', 'rare', ICED],
    padlock2: ['heavy padlock v2', 'rare', [['iced / yellow', 'ice', Y], ['iced / white', 'ice', W], ['all gold', Y, Y], ['onyx / gold', O, Y]]],
    rope2: ['twisted rope v2', 'common', [['yellow gold', Y], ['white gold', W], ['rose gold', R]]],
  },
  acc: {
    digital: ['digital watch', 'common', [['black / green lcd', 0x151517, 0x9cff7a], ['white / blue lcd', 0xf2f2f2, 0x7cc3ff], ['olive / orange lcd', 0x4a5a3a, 0xff8c1a], ['jelly', 0xbfe8ff, 0xff7ab6]]],
    rings: ['ring stack', 'rare', [['gold', Y, 0xe0182d], ['silver', W, 0x2b6cff], ['gold / ice', Y, ICEB], ['rose / ice', R, ICEB]]],
    pinky: ['iced pinky ring', 'epic', [['gold', Y], ['white gold', W], ['rose gold', R], ['black ice', O]]],
    bustdown: ['bust-down watch', 'grail', [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['two-tone', Y, W]], 'Fully iced watch and tennis bracelet: the wrist that says you already won.'],
    cubanwatch: ['cuban + watch stack', 'epic', [['yellow gold', Y], ['white gold', W], ['rose gold', R], ['two-tone', Y, W]]],
  },
};
// the ids that were drop 02's before this pass (redrawn), the v2 alternates, and the new ones
export const REDRAWN = ['diamond', 'openface', 'fangs', 'perms', 'gems', 'earstack', 'cross', 'icestud', 'pearls', 'choker', 'catpiece', 'icecuban', 'cuffs', 'digital', 'rings', 'pinky', 'bustdown'];
export const V2 = { dollar2: 'dollar', padlock2: 'padlock', rope2: 'rope' };
export const NEWJ = ['gapgold', 'septum', 'hoopstack', 'figaro', 'franco', 'tennischoker', 'nameplate', 'layers', 'noggin', 'chase', 'exhibit', 'cubanwatch'];
const cwOf = (id, p) => { let slot = null; for (const s in JEWEL_REG) if (JEWEL_REG[s][id]) slot = s; const l = JEWEL_REG[slot][id][2]; return l[((((p && p.cw) | 0) % l.length) + l.length) % l.length]; };

// ── metals: three tones and a gloss glint, so gold stays gold under any sky
const tones = M => M === O ? [0x3a3a44, O, 0x0c0c0e] : [shade(M, 1.16), M, shade(M, .72)];
const iceAt = (x, y, z = 0) => ((x + y + z) & 1) ? ICEW : ICEB;
const jwMark = (G, x, y, z, v) => { (G.jw ||= new Map()).set(K(x, y, z), v); };
const put = (G, x, y, z, cl, piv = 0) => { if (!cl) return; const [c, l, ice] = cl; G.set(x, y, z, c, l); if (piv || ice) jwMark(G, x, y, z, piv + (ice ? 2 : 0)); };
// palette letters → [colour, layer, iced?]: H highlight (gloss) · G metal · D shadow metal · I ice · * lit glint · K black enamel · others per piece
function metalPal(M, extra = {}) { const [h, g, d] = tones(M), onyx = M === O;
  return { H: [h, 1], G: [g, 1], D: [onyx ? d : g, onyx ? 1 : 2], I: (x, y, z) => [iceAt(x, y, z), 1, 1], '*': [0xffffff, 3, 1], K: [0x141416, 1], ...extra }; }
const cell = (pal, ch, x, y, z) => { const v = pal[ch]; return typeof v === 'function' ? v(x, y, z) : v; };

// ── the hang (fit layers, 2026-09-30): every piece is a ring round the neck + a drop lying on the chest, drawn by world/fit/layers.js
// (strand: the ring along the look's neckRing, the drop on chestFront + 1; plate: a pendant flat at one z). The curve is chars.js
// chainV's parabola (`u`: a stiff U for heavy links); `rows` is the band's height on the chest. `depth` and `lift` are gone: nothing
// stands more than 1 proud, a chain's type is its link rhythm and colour (LINK). col(t, k, x, y) → cell, t: links counted from the
// collar down each side (symmetric), k: 0 bottom row · 1 middle · 2 top.
function chain(B, { low, half, rows = 1, u = false, col }) { strand(B, { low, half, rows, u, col }, put); }
// a flat pendant plate: rows top → bottom, hung at `top` (its first row sits under the chain's lowest link), at ONE z (the chest's front
// under its footprint + 1) so it can swing without cutting into what it lies on. One voxel thick: the setting reads in the colours
// (`back` is kept in the signature, no longer a second layer). Every voxel swings about the plate's top edge.
function plate(B, rows, pal, x0, top, o = {}) { const cells = [], piv = (top + 1 + (o.pivot || 0)) * S;
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.' && r[i] !== ' ') { const ch = r[i]; cells.push([x0 + i, top - j, (x, y, z) => cell(pal, ch, x, y, z)]); } });
  return layPlate(B, cells, (G, x, y, z, c) => put(G, x, y, z, c, piv)); }

// ── link rhythms (t runs along the chain, k across it)
const LINK = {
  figaro: P => t => [P.H, P.D, P.G, P.D, P.G, P.D, P.H, P.H][t & 7],   // three short links, one long (the bright pair)
  rope: P => (t, k) => [P.H, P.G, P.D][((t + (k ? 1 : 0)) % 3 + 3) % 3],   // diagonal twists, offset row to row
  cuban: P => (t, k) => k === 0 ? ((t & 1) ? P.D : P.G) : ((t & 1) ? P.G : P.H),   // paired flat links, lit top row, dark bottom edge
  franco: P => (t, k) => ((t + (k ? 0 : 1)) & 1) ? P.H : (k ? P.G : P.D),   // tight chevrons (a checker the eye reads as V's)
  tennis: P => (t, k, x, y) => (t % 4 === 3) ? P.G : [iceAt(x, y), 1, 1],   // stones, a setting every fourth
};

// ── neck
const NECK = {
  pearls(B, p) { const [, P, Sp] = cwOf('pearls', p), pc = (t, x, y) => Sp !== undefined && t % 3 === 0 ? [Sp, 2] : [((x + y) & 1) ? P : shade(P, .82), 1];
    chain(B, { low: 15, half: 3, col: (t, k, x, y) => pc(t, x, y) }); chain(B, { low: 13, half: 4, col: (t, k, x, y) => pc(t + 1, x, y) });
    plate(B, ['PP', 'PQ'], { P: [P, 1], Q: [shade(P, .8), 1] }, -1, 12); },   // a bigger drop pearl
  choker(B, p) { const [, M, A] = cwOf('choker', p), onyx = M === O, P = metalPal(onyx ? A : M);
    chain(B, { low: 16, half: 3, rows: 2, col: (t, k, x, y) => k === 2 ? (onyx ? [O, 1] : P.G) : (onyx ? ((t & 1) ? [O, 1] : P.H) : [iceAt(x, y), 1, 1]) });
    plate(B, ['.G.', 'I*I', '.I.'], { ...P, I: onyx ? P.G : P.I, '*': onyx ? P.H : P['*'] }, -2, 14); },   // a small iced drop
  catpiece(B, p) { const [, M, E] = cwOf('catpiece', p), onyx = M === O, P = metalPal(onyx ? E : M), body = onyx ? [O, 1] : P.G;
    chain(B, { low: 15, half: 4, rows: 1, col: LINK.rope(metalPal(onyx ? E : M)) });
    plate(B, ['H.HH.H', 'BBBBBB', 'BEBBEB', 'DBNNBD', '.BBBB.'], { ...P, B: body, E: onyx ? [E, 2] : [E, 1], N: [0xff7ab6, 1], H: onyx ? [E, 2] : P.H, D: onyx ? [E, 2] : P.D }, -3, 14, { back: onyx ? [E, 2] : P.D }); },
  icecuban(B, p) { const [, M, M2] = cwOf('icecuban', p), P = metalPal(M), P2 = metalPal(M2 ?? M);
    chain(B, { low: 13, half: 4, rows: 4, depth: 2, u: true, col: (t, k, x, y) => k === 1 ? (hash3(x, y, 7) % 7 === 0 ? P['*'] : [iceAt(x, y), 1, 1]) : (k === 2 ? ((t & 1) ? P.H : P.G) : ((t & 1) ? P2.G : P2.D)) }); },
  cuffs(B, p) { const [, Rc, M] = cwOf('cuffs', p), ice = Rc === 'ice', P = metalPal(M);
    chain(B, { low: 16, half: 4, rows: 2, depth: 1, u: true, col: LINK.cuban(P) });
    plate(B, ['...GG...', '.RRGGRR.', 'R..RR..R', 'R..RR..R', '.RR..RR.'], { ...P, R: ice ? P.I : (Rc === M ? P.H : [Rc, 2]) }, -4, 14, { back: ice ? 'G' : null }); },
  // new chains
  figaro(B, p) { const [, M] = cwOf('figaro', p); chain(B, { low: 13, half: 4, col: LINK.figaro(metalPal(M)) }); },
  franco(B, p) { const [, M, A] = cwOf('franco', p), P = metalPal(M), Pa = A ? metalPal(A) : P; chain(B, { low: 13, half: 4, rows: 2, depth: 2, col: (t, k) => (A && t % 4 === 0) ? Pa.H : LINK.franco(P)(t, k) }); },
  rope2(B, p) { const [, M] = cwOf('rope2', p); chain(B, { low: 12, half: 4, rows: 2, depth: 2, col: LINK.rope(metalPal(M)) }); },
  tennischoker(B, p) { const [, M, St] = cwOf('tennischoker', p), P = metalPal(M);
    chain(B, { low: 15, half: 3, col: (t, k, x, y) => St !== undefined ? ((t & 1) ? [St, 1, 1] : [iceAt(x, y), 1, 1]) : (t % 5 === 2 ? P['*'] : [iceAt(x, y), 1, 1]) }); },
  layers(B, p) { const [, A, Bm, C] = cwOf('layers', p);
    chain(B, { low: 11, half: 4, rows: 2, depth: 1, u: true, col: LINK.cuban(metalPal(C)) });
    chain(B, { low: 13, half: 4, rows: 1, col: LINK.rope(metalPal(Bm)) });
    chain(B, { low: 16, half: 3, col: LINK.tennis(metalPal(A)) }); },
  nameplate(B, p) { const [, M, A] = cwOf('nameplate', p), onyx = M === O, P = metalPal(onyx ? A : M), g = glyph(p && p.ch);
    chain(B, { low: 16, half: 4, col: LINK.figaro(P) });
    const rows = ['.GGG.']; for (let j = 0; j < 5; j++) rows.push('G' + [0, 1, 2].map(i => g[j][i] === '1' ? 'I' : 'B').join('') + 'G'); rows.push('.GGG.');
    plate(B, rows, { ...P, B: onyx ? [O, 1] : P.D, I: onyx ? P.I : P.H }, -3, 15, { back: 'D' }); },
  noggin(B, p) { const [, M, Cap] = cwOf('noggin', p), onyx = M === O, P = metalPal(M);
    chain(B, { low: 15, half: 4, col: LINK.rope(metalPal(onyx ? Cap : M)) });
    plate(B, ['.CCCC.', 'CCCCCC', 'GIGGIG', 'GGGGGG', 'GKWWKG', '.GGGG.'], { ...P, C: [Cap, onyx ? 2 : 1], W: [0xf6f4ef, 1], G: onyx ? [O, 1] : P.G, I: P.I }, -3, 14, { back: 'D' }); },
  chase(B, p) { const [, M, Cl, Sk] = cwOf('chase', p), P = metalPal(M);
    chain(B, { low: 15, half: 4, col: LINK.figaro(P) });
    plate(B, ['.HHHH.', '.KGGK.', '.GGGG.', '..CC..', '.SCCS.', 'IIIIII'], { ...P, C: [Cl, 1], S: [Sk, 1], G: M === O ? [O, 1] : P.G, H: M === O ? [0x3a3a44, 1] : P.H }, -3, 14, { back: 'D' }); },
  exhibit(B, p) { const [, M] = cwOf('exhibit', p), P = metalPal(M), clear = (x, y) => [((x * 3 + y) % 5 === 0) ? 0xf4fbff : 0xd4e6f1, 1];
    chain(B, { low: 16, half: 4, rows: 2, depth: 2, u: true, col: (t, k, x, y) => k === 0 ? ((t & 1) ? P.G : P.D) : (hash3(x, y, 3) % 5 === 0 ? P['*'] : [iceAt(x, y), 1, 1]) });
    plate(B, ['RRWRRWRR', 'CCCCCCCC', 'CCHGHCCC', 'CGCCCGCT', 'CCHGHCCC', 'CCCCCCCC'], { ...P, R: [0xd7141a, 1], W: [0xf4f4f4, 1], C: (x, y) => clear(x, y), T: [0xe8d39a, 1] }, -4, 14, { back: 'C' }); },
  dollar2(B, p) { const [, M] = cwOf('dollar2', p), P = metalPal(M);
    chain(B, { low: 16, half: 4, rows: 1, col: LINK.franco(P) });
    plate(B, ['..GG..', '.IIII.', 'II.G..', '.IIII.', '..G.II', '.IIII.', '..GG..'], { ...P, G: M === O ? metalPal(Y).G : P.G }, -3, 15, { back: 'D' }); },
  padlock2(B, p) { const [, Bd, M] = cwOf('padlock2', p), ice = Bd === 'ice', onyx = Bd === O, P = metalPal(M);
    chain(B, { low: 16, half: 4, rows: 2, depth: 1, u: true, col: LINK.cuban(P) });
    plate(B, ['.GGGG.', '.G..G.', 'GBBBBG', 'GBKKBG', 'GBKKBG', 'GGGGGG'], { ...P, B: ice ? P.I : (onyx ? [O, 1] : P.H), K: [0x141416, 1] }, -3, 14, { back: 'D' }); },
};
// initials for the plate (3 × 5); the sim passes the agent's initial as neck.ch; without one, a star
const FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110',
  '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110', '*': '000010101010000' };
function glyph(ch) { const g = FONT[String(ch || '*').toUpperCase()[0]] ?? FONT['*']; return [0, 1, 2, 3, 4].map(j => g.slice(j * 3, j * 3 + 3)); }

// ── ears (H; skipped where there is no ear: the ear's column must be there). Left ear x −10…−9, right 8…9; y 23…27; z −1…1.
const EAR = [[-11, -10, -9], [10, 9, 8]];   // [outer face x, ear column, inner ear column]
const EARS = {
  earstack(H, p) { const [, A, Bc] = cwOf('earstack', p), P = metalPal(A), st = Bc === ICEB ? P.I : [Bc, 1];
    for (const [x, e] of EAR) { if (!H.has(e, 24, 0)) continue;
      put(H, x, 23, 1, P.H); put(H, x, 22, 1, P.G); put(H, x, 22, 0, P.D);   // a lobe huggie
      put(H, x, 25, 1, cell({ S: st }, 'S', x, 25, 1)); put(H, x, 26, 0, P.G); put(H, e, 28, 1, P.H); put(H, x, 27, 1, P.G); } },   // a stone, a stud, a helix cuff over the top
  cross(H, p) { const [, G, l] = cwOf('cross', p), P = metalPal(l === 1 ? W : G), c = (x, y, z) => l === 1 ? [iceAt(x, y, z), 1, 1] : ((y & 1) ? P.H : P.G);
    if (!H.has(-10, 24, 0)) return; put(H, -10, 22, 1, P.D);
    for (let y = 17; y < 22; y++) put(H, -10, y, 1, c(-10, y, 1)); put(H, -11, 20, 1, c(-11, 20, 1)); put(H, -9, 20, 1, c(-9, 20, 1));
    if (H.has(9, 24, 0)) { put(H, 10, 23, 1, P.H); put(H, 10, 22, 1, P.G); } },   // (and a plain huggie on the right)
  icestud(H, p) { const [, M] = cwOf('icestud', p), P = metalPal(M), black = M === O;
    for (const [x, e] of EAR) { if (!H.has(e, 24, 0)) continue; const ix = x < 0 ? x : x;
      H.box(ix, 23, 0, ix + 1, 25, 2, (xx, y, z) => black ? ((y + z) & 1 ? 0x2a2a34 : 0x101014) : iceAt(0, y, z), 1); if (!black) jwMark(H, ix, 24, 1, 2);
      for (const [y, z] of [[22, 0], [22, 1], [25, 0], [25, 1]]) put(H, ix, y, z, black ? metalPal(Y).G : P.G); put(H, ix, 24, 1, black ? [0x6a6a78, 1] : P['*']); } },
  hoopstack(H, p) { const [, M, ice] = cwOf('hoopstack', p), P = metalPal(M);
    for (const [x, e] of EAR) { if (!H.has(e, 24, 0)) continue;
      faceRing(19.8, .5, 2.4, 2.2).forEach(([y, z], a) => put(H, x, y, z, (a & 1) ? P.G : P.H)); put(H, x, 23, 1, P.G);   // the door-knocker (face-connected, hung from the lobe)
      put(H, x, 24, 1, ice ? P.I(x, 24, 1) : P.H); put(H, x, 25, 1, ice ? P['*'] : P.G); put(H, x, 26, 1, ice ? P.I(x, 26, 0) : P.H); } },   // three huggies up the rim
};

// ── grills: the 6-wide mouth grid (x −3…2, y 21…19, z 7). The letters paint the face; .fx the metal tones, the glints and the stones
const g6 = (rows, fx) => Object.assign(rows, { fx });
const tooth = (F, x, y, M, alt) => F.set(x, y, 7, alt ? shade(M, 1.16) : M, alt ? 1 : 2);
const MOUTH = {
  diamond: g6(['K....K', '.WWWW.', '......'], F => { F.set(0, 20, 7, 0xffffff, 3); F.set(-1, 20, 7, Y, 2); F.set(1, 20, 7, Y, 2); jwMark(F, 0, 20, 7, 2); }),
  openface: g6(['K....K', '.GWWG.', '.GGGG.'], F => { for (let x = -2; x < 2; x++) tooth(F, x, 19, Y, x & 1); for (const x of [-2, 1]) tooth(F, x, 20, Y, 1); F.set(-1, 20, 7, 0xf6f4ef, 1); F.set(0, 20, 7, 0xf6f4ef, 1); }),
  fangs: g6(['K....K', 'GWWWWG', '.G..G.'], F => { for (const x of [-3, 2]) tooth(F, x, 20, Y, 0); for (const x of [-2, 1]) tooth(F, x, 19, Y, 1); }),
  perms: g6(['K....K', 'GGGGGG', '.GGGG.'], F => { for (let x = -3; x < 3; x++) tooth(F, x, 20, Y, x & 1); for (let x = -2; x < 2; x++) tooth(F, x, 19, Y, !(x & 1)); F.set(-1, 20, 7, 0xfff2b0, 1); }),
  gems: g6(['K....K', '.1234.', '.5678.'], F => { const C = [0xff3b6b, 0x2de2e6, 0x6cf542, 0xffd21f, 0x8a3cff, 0xff8c1a, 0x2b6cff, 0xff7ab6];
    C.forEach((c, i) => F.set(-2 + (i & 3), i < 4 ? 20 : 19, 7, c, 1)); F.set(-1, 20, 7, 0xffffff, 3); F.set(1, 19, 7, 0xffffff, 3); for (const x of [-3, 2]) F.set(x, 20, 7, Y, 2); }),
  gapgold: g6(['K....K', '.WG.GW', '......'], F => { tooth(F, -1, 20, Y, 1); tooth(F, 1, 20, Y, 0); F.set(0, 20, 7, 0x2a0c0c); F.set(-2, 19, 7, 0x3a1414); F.set(2, 19, 7, 0x3a1414); }),
  septum: g6(['......', '.KKKK.', '......'], F => { for (const [x, y, z] of [[-2, 22, 8], [1, 22, 8], [-2, 21, 8], [1, 21, 8], [-1, 21, 8], [0, 21, 8]]) F.set(x, y, z, y === 22 ? Y : shade(Y, 1.16), y === 22 ? 2 : 1); }),
};

// ── accessories (as: the body part each rides; a wrist piece rides the arm, one piece from the shoulder to the hand)
// hands (chars.js hands(), drawn after acc and over it): mittens x −8…−6 and 5…7, y 6…9, z −2…1, thumb at (−6 | 5, 7…8, 2)
const wristBand = (B, x0, y, cellAt) => { for (let x = x0; x < x0 + 4; x++) for (let z = -3; z < 3; z++) { const edge = x === x0 || x === x0 + 3 || z === -3 || z === 2; put(B, x, y, z, edge ? cellAt(x, y, z) : [0x202024, 0]); } };
const ACC = {
  digital(B, p, as) { as('armR'); const [, C, Lc] = cwOf('digital', p); B.box(5, 10, -3, 9, 12, 3, C, 1); B.box(9, 9, -2, 10, 12, 2, shade(C, .8), 1); B.box(10, 10, -1, 11, 12, 1, Lc, 3); B.set(10, 11, 1, 0x9a9aa0, 2); B.set(10, 9, -1, 0x9a9aa0, 2); },
  rings(B, p, as) { const [, M, St] = cwOf('rings', p), P = metalPal(M), st = St === ICEB ? P.I : [St, 1];
    for (const [part, x0, xo, tx] of [['armL', -8, -9, -6], ['armR', 5, 8, 5]]) { as(part);
      for (let x = x0; x < x0 + 3; x++) if (x !== tx) { put(B, x, 7, 2, P.H); put(B, x, 6, 2, P.G); }   // two bands across the knuckles (the thumb keeps its spot)
      for (let z = -2; z < 2; z++) { put(B, xo, 7, z, P.G); put(B, xo, 6, z, P.D); } put(B, xo, 7, 1, typeof st === 'function' ? st(xo, 7, 1) : st); put(B, x0 + 1, 7, 3, P['*']); } },   // a stone on each
  pinky(B, p, as) { const [, M] = cwOf('pinky', p), P = metalPal(M), black = M === O, st = (x, y, z) => black ? [((x + y + z) & 1) ? 0x2a2a34 : 0x101014, 1] : [iceAt(x, y, z), 1, 1];
    as('armR'); for (let z = -2; z < 1; z++) put(B, 8, 6, z, P.G); for (let y = 5; y < 8; y++) for (let z = -2; z < 1; z++) put(B, 9, y, z, st(9, y, z)); put(B, 9, 7, 0, P['*']);
    as('armL'); wristBand(B, -9, 10, (x, y, z) => ((x + z) & 1) ? P.H : P.G); },
  bustdown(B, p, as) { const [, M, M2] = cwOf('bustdown', p), P = metalPal(M), P2 = metalPal(M2 ?? M), ice = (x, y, z) => hash3(x, y, z) % 9 === 0 ? P['*'] : [iceAt(x, y, z), 1, 1];
    as('armL'); wristBand(B, -9, 10, ice); wristBand(B, -9, 11, ice);
    for (let y = 9; y < 12; y++) for (let z = -2; z < 2; z++) put(B, -10, y, z, (y === 10 && (z === -1 || z === 0)) ? P2.G : ice(-10, y, z)); put(B, -11, 10, 0, P2.H); put(B, -11, 10, -1, P['*']);   // iced dial, the hands in metal
    as('armR'); wristBand(B, 5, 10, (x, y, z) => (x + z) % 3 === 0 ? P.G : [iceAt(x, y, z), 1, 1]); },
  cubanwatch(B, p, as) { const [, M, M2] = cwOf('cubanwatch', p), P = metalPal(M), P2 = metalPal(M2 ?? M), link = PP => (x, y, z) => ((x + z) & 1) ? PP.H : PP.G;
    as('armL'); wristBand(B, -9, 10, link(P)); wristBand(B, -9, 11, link(P2));
    for (let y = 9; y < 12; y++) for (let z = -2; z < 2; z++) put(B, -10, y, z, (y === 9 || y === 11 || z === -2 || z === 1) ? P.G : [0x141416, 1]); put(B, -10, 10, 0, P['*']);   // the watch: a gold case on the outside of the wrist
    as('armR'); wristBand(B, 5, 10, link(P)); wristBand(B, 5, 11, (x, y, z) => (x + z) % 3 === 0 ? P2.G : [iceAt(x, y, z), 1, 1]); },
};

// ── wiring (chars.js, one call after the registry is built, like installShoes2): the registry entries (NEWT, NEWI, NAMES) and the
// draw functions. The replaced ones are kept for the board's old-vs-new (legacy(true) puts them back, colourways included).
const OLD = { reg: {}, draw: {} }; let T = null;
export function installJewelry(t) { T = t; const { NEWT, NEWI, NAMES } = t;
  for (const [s, o] of Object.entries(JEWEL_REG)) { NEWT[s] ||= {}; OLD.reg[s] = {};
    for (const [id, e] of Object.entries(o)) { if (NEWT[s][id]) OLD.reg[s][id] = NEWT[s][id]; NEWT[s][id] = e; const [name, tier, cw, why] = e;
      NEWI[id] = { id, slot: s, name, tier, cw: cw || null, why: why || null, new: true }; NAMES[s][id] = name; } }
  for (const [k, tab] of Object.entries(DRAW)) { OLD.draw[k] = {}; for (const id of Object.keys(tab)) { if (t[k][id]) OLD.draw[k][id] = t[k][id]; t[k][id] = tab[id]; } } }
const DRAW = { NECK, MOUTH, EARS, ACC };
// the board: draw the drop's jewellery as it was (on) or as redrawn (off)
export function legacy(on) { if (!T) return;
  for (const [k, tab] of Object.entries(DRAW)) for (const id of Object.keys(OLD.draw[k])) T[k][id] = on ? OLD.draw[k][id] : tab[id];
  for (const s of Object.keys(OLD.reg)) for (const [id, e] of Object.entries(OLD.reg[s])) T.NEWI[id].cw = (on ? e[2] : JEWEL_REG[s][id][2]) || null; }

// ── showcase looks (the lab's &jewel=1 and the jewellery page): jewellery-led fits on the approved wardrobe
export const JEWEL_LOOKS = [
  { handle: 'noggin.king', skin: 'deep', hair: { id: 'buzz', c: 0x151214 }, eyes: 'bored', mouth: 'perms', top: { id: 'tee', c: 0x151517, print: 'star' }, neck: { id: 'noggin', cw: 0 }, bottom: { id: 'baggy', c: 0x2b3f66 }, shoes: { id: 'dad' }, acc: { id: 'cubanwatch', cw: 0 } },
  { handle: 'exhibit.a', skin: 'tan', hair: { id: 'buzz', c: 0x2a1c14 }, eyes: 'mean', mouth: 'gems', top: { id: 'hoodie', c: 0x151517, logo: 'small' }, neck: { id: 'exhibit', cw: 0 }, ears: { id: 'icestud', cw: 1 }, bottom: { id: 'cargo', c: 0x2a2a2c }, shoes: { id: 'foam', c: 0x151517 }, acc: { id: 'bustdown', cw: 0 } },
  { handle: 'chase.me', skin: 'pale', hair: { id: 'buzz', c: 0x151214 }, eyes: 'side', mouth: 'gapgold', top: { id: 'tee', c: 0xf2f2f2, print: 'heart' }, neck: { id: 'chase', cw: 0 }, ears: { id: 'hoopstack', cw: 0 }, bottom: { id: 'sweats' }, shoes: { id: 'slides' } },
  { handle: 'lock.smith', skin: 'terracotta', hair: { id: 'afro' }, eyes: 'mean', mouth: 'diamond', top: { id: 'velour', c: 0x6e1f3a }, neck: { id: 'padlock2', cw: 0 }, bottom: { id: 'track', c: 0x151517 }, shoes: { id: 'dad' }, acc: { id: 'rings', cw: 2 } },
  // (the iced-out ladder, common → grail: 5, 6, 7, 8, 0, 1)
  { handle: 'corner.gold', skin: 'brown', hair: { id: 'buzz', c: 0x151214 }, eyes: 'side', mouth: 'gapgold', top: { id: 'flannel', c: 0xd7141a }, neck: { id: 'figaro', cw: 0 }, ears: { id: 'hoopstack', cw: 0 }, bottom: { id: 'baggy', c: 0x2b3f66 }, shoes: { id: 'slides' }, acc: { id: 'digital', cw: 0 } },
  { handle: 'rope.walk', skin: 'pale', hair: { id: 'buzz', c: 0x2a1c14 }, eyes: 'bored', mouth: 'smirk', top: { id: 'hoodie', c: 0xd7141a, logo: 'small' }, neck: { id: 'rope2', cw: 0 }, ears: { id: 'earstack', cw: 3 }, bottom: { id: 'cargo', c: 0x2a2a2c }, shoes: { id: 'dad' }, acc: { id: 'digital', cw: 1 } },
  { handle: 'kilo.k', skin: 'deep', hair: { id: 'buzz', c: 0x151214 }, eyes: 'mean', mouth: 'diamond', top: { id: 'velour', c: 0x151517 }, neck: { id: 'nameplate', cw: 0, ch: 'K' }, ears: { id: 'cross', cw: 0 }, bottom: { id: 'track', c: 0x151517 }, shoes: { id: 'dad' }, acc: { id: 'rings', cw: 0 } },
  { handle: 'dollar.dan', skin: 'tan', hair: { id: 'buzz', c: 0x151214 }, eyes: 'sleepy', mouth: 'openface', top: { id: 'puffer', c: 0x151517 }, neck: { id: 'dollar2', cw: 0 }, ears: { id: 'icestud', cw: 0 }, bottom: { id: 'cargo', c: 0x2a2a2c }, shoes: { id: 'dad' } },
];
