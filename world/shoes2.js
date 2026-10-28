// AI CITY · SHOES 2 (the shoe pass, 2026-09-29): Drop 02's seven shoes redrawn in place (same ids, same tiers) + ten new pairs.
// Every silhouette, mark and colourway is invented: no real models, no swooshes, no stripes.
// Wired into chars.js by one call, installShoes2({ SHOES, NEWT, NEWI, NAMES }): each shoe joins NEWT.shoes (so rollLook skips it
// while NEW_TRAITS is off and the city's walkers never change), NEWI (tier + colourways, { id, cw }) and NAMES.shoes, and its draw
// replaces SHOES[id]. The old Drop 02 draws are kept for the side-by-side (withLegacy). Self-contained: no imports.
//
// HOW A SHOE IS DRAWN. Each shoe is a SIDE PROFILE (rows top → bottom = y 5…0; columns z −4…6, toes at +z) of palette letters, swept
// across the foot's width in local u: u 0 = the inner face (x −2 / 1, keeping chars.js's 2-voxel gap between the feet), u 4 = the
// outer face (x −6 / 5), u 5 = an outboard flare (x −7 / 6). The row's front voxel is rounded (u 1…3) so the toe reads as a toe.
// Rig (anim/bake.js partOf, walk v2): y ≤ 2 is the FOOT; y 3…5 at z ≥ 3 (toe box) or z ≤ −3 (heel) is the foot too; y 3…5 over
// the ankle (z −2…2) rides the SHIN; y ≥ 6 would ride the thigh, so nothing here goes above y 5. The heel pivots at z −3, the toe
// at z 6 (the sole's ends): soles span z −3…5 and any toe past z 5 rides one voxel up (toe spring), so it never cuts the ground.
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const FOOT = [[-1, u => -2 - u], [1, u => 1 + u]];   // [side, local u → chars.js x]
const DEF = { h: [1, 1], T: [0, 2], W: [5, 6] };      // default spans: heel tab, popped tongue, heel wing
const GLOSS = c => [c, 1], METAL = c => [c, 2], LIT = c => [c, 3];
// the sweep. o: span {ch: [u0, u1] | (y, z) → [u0, u1]}, paint (ch, u, y, z, side, u0, u1) → colour | [colour, layer] | null (skip),
// z0 (first column's z), toe (round the front, default on), heel (round the back from this y up, default 2)
function last(B, P, rows, o = {}) {
  const Z0 = o.z0 ?? -4, H = rows.length, sp = o.span || {};
  for (const [side, X] of FOOT) for (let j = 0; j < H; j++) { const y = H - 1 - j, row = rows[j];
    let zf = -99, zb = 99; for (let i = 0; i < row.length; i++) if (!'.hTW'.includes(row[i])) { zf = Math.max(zf, i + Z0); zb = Math.min(zb, i + Z0); }
    for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; const z = i + Z0;
      let s = sp[ch]; if (typeof s === 'function') s = s(y, z); let [u0, u1] = s || DEF[ch] || [0, 4];
      if (u1 - u0 >= 4 && ((z === zf && o.toe !== false) || (z === zb && y >= (o.heel ?? 2)))) { u0++; u1--; }
      for (let u = u0; u <= u1; u++) { let v = o.paint ? o.paint(ch, u, y, z, side, u0, u1) : undefined; if (v === undefined) v = P[ch];
        if (typeof v === 'function') v = v(u, y, z, side); if (v == null) continue; const [c, l] = Array.isArray(v) ? v : [v, 0]; B.set(X(u), y, z, c, l); } } }
}
// a mark on the outer face: rows top → bottom from yTop, columns from z0 ('X' = on)
const mark = (rows, z0, yTop) => { const s = new Set(); rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') s.add((yTop - j) * 64 + z0 + i); }); return (y, z) => s.has(y * 64 + z); };
const outer = (u, u1) => u === u1 && u1 >= 4;
const laces = (L, T) => (u, y, z) => u <= 2 ? (((u + z) & 1) ? L : T) : undefined;   // criss-cross over the tongue; the eyestay (u ≥ 3) stays upper
const knit = C => (u, y, z) => ((u + y + z) & 1) ? C : shade(C, .9);
const nub = C => (u, y, z, s) => { const h = hash3(u * s, y, z) % 5; return h === 0 ? shade(C, .88) : h === 1 ? shade(C, 1.06) : C; };
// the house marks (invented): PATCH square, HOOP ring, STEP, PIP
const PATCH = mark(['XX', 'XX'], 0, 3), HOOP = mark(['XXX', 'X.X', 'XXX'], -1, 4), STEP = mark(['X..', 'XXX'], 0, 3), PIP = mark(['XX', 'X.'], 0, 3);

const SHOES2 = {
  // ───────── Drop 02, redrawn (tiers unchanged)
  courtlow: ['court lows', 'common', [
    ['white / green', { u: 0xf6f6f6, a: 0x0a5a3a, m: 0xefe9dc, o: 0xcfc6b0 }], ['white / red', { u: 0xf6f6f6, a: 0xd7141a, m: 0xf6f6f6, o: 0xd0d0d0 }],
    ['white / navy', { u: 0xf6f6f6, a: 0x1d3a8a, m: 0xe9e2cf, o: 0xa0612b }], ['triple black', { u: 0x19191b, a: 0x2e2e33, m: 0x19191b, o: 0x0c0c0c, l: 0x2e2e33 }]],
  null, (B, c) => last(B, { o: c.o, m: c.m, u: c.u, v: c.a, c: c.u, T: c.a, t: c.u, k: c.u, l: c.u, h: c.a }, [
    '.v....T....',
    'hvukkktl...',
    '.vuuuuuucc.',
    '.mmmmmmmmm.',
    '.oooooooo..'], { paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 't' && u <= 2) return c.a; if (ch === 'k' && u <= 2) return c.a; if (ch === 'l') return laces(c.l ?? 0xffffff, shade(c.u, .9))(u, y, z);
      if (ch === 'c' && y === 2 && u > u0 && u < u1 && ((u + z) & 1)) return shade(c.u, .86);   // toe perfs
      if (ch === 'm' && outer(u, u1) && (z & 1)) return shade(c.m, .9);   // cupsole stitch
      if (outer(u, u1) && PATCH(y, z)) return c.a; } })],
  lugboot: ['lug-sole boots', 'common', [
    ['black / yellow stitch', { u: 0x141414, s: 0xffd21f, o: 0x1c1c1c, w: 0x242424 }], ['brown', { u: 0x4a2e1a, s: 0xe7bd4a, o: 0x1c1712, w: 0x2a1c12 }],
    ['cherry', { u: 0x5a0d18, s: 0xefe6d2, o: 0x161616, w: 0x2a2020 }], ['ghost', { u: 0xe9e6de, s: 0x151515, o: 0x1c1c1c, w: 0x2a2a2a }]],
  null, (B, c) => last(B, { o: c.o, w: c.w, u: GLOSS(c.u), k: shade(c.u, .7), T: shade(c.u, .8), l: GLOSS(c.u), h: c.s }, [
    '..kkkkT....',
    'huuuuutl...',
    '.uuuuullu..',
    '.wwwwwwwww.',
    '.ooooooooo.',
    '.ooo.o.oo..'], { paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'w' && (u === u0 || u === u1 || z === 5 || z === -3)) return ((u + z) & 1) ? c.s : shade(c.s, .72);   // the stitched welt, all round
      if (ch === 'l') return u <= 2 ? (((u + y) & 1) ? shade(c.u, .6) : c.s) : (u === 3 ? METAL(0xc0c0c0) : undefined);   // laces + eyelets
      if (ch === 'o' && y === 0 && outer(u, u1)) return shade(c.o, .8); } })],
  chunky: ['chunky runners', 'rare', [
    ['triple white', { u: 0xf4f4f4, v: 0xdcdcdc, m: 0xefe9dc, n: 0xd4d4d4, o: 0xb8b8b8, t: 0xf4f4f4 }], ['sail / volt', { u: 0xefe9dc, v: 0x9aa0a6, m: 0xefe9dc, n: 0xc6ff3a, o: 0x6f757c, t: 0xc6ff3a }],
    ['black ice', { u: 0x1a1a1e, v: 0x34343a, m: 0x2a2a2e, n: 0x7cc3ff, o: 0x101012, t: 0x7cc3ff }], ['bodega', { u: 0xefe6d2, v: 0xd7141a, m: 0xefe6d2, n: 0x0a5a3a, o: 0x8a5a2b, t: 0xd7141a }]],
  null, (B, c) => last(B, { o: c.o, m: c.m, n: c.n, u: knit(c.u), v: c.v, k: c.v, T: c.t, t: c.u, l: c.u, h: c.t }, [
    '..k...T....',
    'hvkuuutl...',
    'hvvuuullum.',
    '.nnmmmnnmm.',
    '.mmnnmmmmm.',
    '.oooooooo..'], { span: { m: (y, z) => y >= 1 && y <= 2 && z <= 2 ? [0, 5] : [0, 4], n: (y, z) => z <= 2 ? [0, 5] : [0, 4], h: [1, 2] },
    paint: (ch, u, y, z) => { if (ch === 't' && u <= 2) return c.t; if (ch === 'l') return laces(0xffffff, c.t)(u, y, z); } })],
  furslide: ['fur slides + socks', 'rare', [
    ['cream', { f: 0xefe6d2, s: 0xf6f6f6, b: 0xd9ccb0 }], ['pink', { f: 0xff9ccb, s: 0xf6f6f6, b: 0xe07aa8 }],
    ['brown', { f: 0x6b4a2e, s: 0x151515, b: 0x3a2616 }], ['leopard', { f: 0xd9a441, s: 0xf6f6f6, b: 0x2a1c14, spot: 0x2a1c14 }]],
  null, (B, c) => { const fur = (u, y, z, s) => { const h = hash3(u + 7 * s, y, z); if (c.spot !== undefined && h % 5 === 0) return c.spot; return (h & 1) ? c.f : shade(c.f, .86); };
    last(B, { s: knit(c.s), f: fur, b: c.b, o: 0x1a1a1a }, [
      '...sss.....',
      '...sssfff..',
      '.sssssffff.',
      '.ssssfffff.',
      '.bbbbbbbbb.',
      '.oooooooo..'], { heel: 9, span: { s: (y, z) => y >= 4 ? [0, 2] : [0, 3], f: [0, 5] },
      paint: (ch, u, y, z, s, u0, u1) => { if (ch === 'f' && u === 5 && (y === 4 || z === 5 || z === 2) && hash3(u, y + 3, z * s) % 2 === 0) return null; } });   // fuzzy edge
    for (const [side, X] of FOOT) for (let z = 0; z < 4; z++) for (let u = 1; u < 4; u++) if (hash3(u, z, side) % 3 === 0) B.set(X(u), 5, z, c.spot !== undefined && hash3(z, u, 1) % 4 === 0 ? c.spot : shade(c.f, 1.04)); }],   // tufts
  courtking: ['court kings', 'epic', [
    ['night shift', { a: 0x151517, b: 0xd7141a }], ['cop car', { a: 0x151517, b: 0x1d4ed8 }], ['money', { a: 0x0a5a3a, b: 0xe7bd4a }], ['royal', { a: 0x1d4ed8, b: 0x151517 }]],
  null, (B, c) => last(B, { o: GLOSS(0xbfe0ff), m: 0xf4f4f4, c: GLOSS(c.a), u: 0xf7f7f7, k: c.a, x: c.b, t: 0xf7f7f7, l: 0xf7f7f7, h: c.b }, [
    '..kkxxx....',
    'hkuuxxtl...',
    '.cuuuullc..',
    '.ccccccccc.',
    '.mmmmmmmmm.',
    '.oooooooo..'], { paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'x' && outer(u, u1) && y === 5 && z === 1) return METAL(0xdfe6ee);   // the strap's buckle
      if (ch === 'l') return laces(0xf7f7f7, c.a)(u, y, z); if (ch === 't' && u <= 2) return c.b;
      if (outer(u, u1) && STEP(y, z) && ch === 'u') return c.a; } })],
  clogs: ['platform clogs', 'epic', [
    ['taupe suede', { c: 0x8a7a66, s: 0xf4f4f4 }], ['black', { c: 0x1a1a1a, s: 0x9a9ca3 }], ['lilac', { c: 0xb9a3e3, s: 0xf4f4f4 }], ['mustard', { c: 0xd9a441, s: 0x3a2616 }]],
  null, (B, c) => { const cork = (u, y, z, s) => y === 2 ? 0xdcc79e : (hash3(u * s, y, z) % 3 === 0 ? 0xa8895c : 0xcfb58a);
    last(B, { o: 0x2a2016, k: cork, u: nub(c.c), s: knit(c.s), x: shade(c.c, .75) }, [
      '...sssuu...',
      '...sssuuu..',
      '.sssssuuuu.',
      '.kkkkkkkkk.',
      '.kkkkkkkkk.',
      '.oooooooo..'], { heel: 9, span: { s: (y, z) => y >= 4 ? [0, 2] : [0, 3], u: (y, z) => y === 5 ? [0, 3] : [0, 4] },
      paint: (ch, u, y, z, s, u0, u1) => { if (ch === 'u' && z === 2 && y <= 4) return outer(u, u1) && y === 4 ? METAL(0xe7bd4a) : shade(c.c, .72);   // the strap + gold buckle
        if (ch === 'u' && outer(u, u1) && y === 3 && z === 3) return METAL(0xe7bd4a); } }); }],
  chromes: ['liquid chromes', 'grail', [
    ['liquid silver', { c: 0xdfe6ee }], ['24k', { c: 0xe7bd4a }], ['oil slick', { c: [0x8a3cff, 0x2b6cff, 0x2de2e6, 0x6cf542, 0xffd21f, 0xff5ea8] }], ['gunmetal', { c: 0x5a5e68 }]],
  'Liquid-chrome high-tops: the sneaker the drop only ever sells one of.',
  (B, c) => { const ch = (u, y, z) => METAL(Array.isArray(c.c) ? c.c[((y + z + (u >> 1)) % c.c.length + c.c.length) % c.c.length] : (y >= 5 ? shade(c.c, .82) : c.c));
    const drip = (u, z, s) => { const h = hash3(z, u, s + 3) % 7; return h < 2 ? 2 : h < 4 ? 1 : 0; };   // how far the chrome runs down the sole here (0 · 1 · 2)
    last(B, { o: 0x111111, m: GLOSS(0x151515), u: ch, k: GLOSS(0x151515), T: GLOSS(0x151515), l: ch, h: ch }, [
      '..kkkkT....',
      'huuuuutl...',
      '.uuuuullu..',
      '.uuuuuuuuu.',
      '.mmmmmmmmm.',
      '.oooooooo..'], { paint: (ch2, u, y, z, s, u0, u1) => {
        if ((ch2 === 'm' || ch2 === 'o') && (u === u0 || u === u1 || z === -3 || z === 5) && drip(u, z, s) >= 2 - y) return ch(u, 2, z);   // liquid runs onto the sole
        if (ch2 === 'u' && outer(u, u1) && (y + z === 4 || y + z === 5) && y >= 2) return GLOSS(0xffffff);   // the highlight streak
        if (ch2 === 'l' && u <= 2) return ((u + z) & 1) ? GLOSS(0x151515) : ch(u, y, z); } }); }],

  // ───────── new
  retrohigh: ['hardwood highs', 'rare', [
    ['home whites', { u: 0xf6f6f6, a: 0xd7141a, k: 0x151517, o: 0xd7141a }], ['night game', { u: 0x19191b, a: 0x1d4ed8, k: 0xf6f6f6, o: 0x19191b }],
    ['gold rush', { u: 0xf6f6f6, a: 0xe7bd4a, k: 0x5a2bd6, o: 0x5a2bd6 }], ['court green', { u: 0xefe9dc, a: 0x0a5a3a, k: 0x0a5a3a, o: 0xefe9dc }]],
  null, (B, c) => last(B, { o: c.o, m: 0xf4f4f4, u: c.u, v: c.a, c: c.a, k: c.k, T: c.u, t: c.u, l: c.u, h: c.k }, [
    '..kkkkT....',
    'hvvuuutl...',
    '.vuuuullc..',
    '.vuuuuuccc.',
    '.mmmmmmmmm.',
    '.oooooooo..'], { span: { k: [0, 5] }, paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'k' && u === 5 && (z === -2 || z === 0)) return null;   // the padded collar: a ring that bulges, rounded
      if (ch === 'T' && y === 5 && u === 1) return c.a;   // the tongue tag
      if (ch === 'l') return laces(c.u === 0x19191b ? 0xf6f6f6 : 0xffffff, c.a)(u, y, z) ?? c.a;   // laces over a team-colour eyestay
      if (ch === 't' && u <= 2) return c.a;
      if (ch === 'c' && y === 2 && u > u0 && u < u1 && ((u + z) & 1)) return shade(c.a, .7);   // toe perfs
      if (ch === 'm' && y === 1 && (u === u0 || u === u1) && (z & 1)) return 0xdcdcdc;
      if (outer(u, u1) && HOOP(y, z)) return c.a; } })],
  sculptrun: ['cloud tanks', 'rare', [
    ['cloud white', { u: 0xf4f4f4, m: 0xf4f4f4, n: 0xc9d3da, o: 0x9aa0a6, a: 0xc9d3da }], ['lava', { u: 0x19191b, m: 0xff6a00, n: 0x19191b, o: 0x19191b, a: 0xff6a00 }],
    ['glacier', { u: 0xf4f4f4, m: 0xdff3ff, n: 0x7cc3ff, o: 0x7cc3ff, a: 0x7cc3ff }], ['toxic', { u: 0x2a2a2e, m: 0x19191b, n: 0xc6ff3a, o: 0xc6ff3a, a: 0xc6ff3a }]],
  null, (B, c) => last(B, { o: c.o, m: c.m, u: knit(c.u), k: c.a, T: c.a, t: c.u, l: c.u, h: c.n }, [
    '..k...T....',
    'hkuuuutlu..',
    'hmmmmmmmmm.',
    '.mmmmmmmmmm',
    '.ooooooo...'], { span: { m: (y, z) => z <= -1 ? [0, 5] : [0, 4], h: [1, 3] },
    paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'm' && y === 2 && (u === u1 || u === u0) && z >= -2 && z <= 3) return c.n;   // the carved channel, both walls
      if (ch === 'm' && y === 1 && z === 6) return c.n;   // the rocker toe tip
      if (ch === 'l') return laces(c.a, c.u)(u, y, z); if (ch === 't' && u <= 2) return c.a; } })],
  puffskate: ['fat tongues', 'common', [
    ['suede black', { u: 0x1c1c1e, k: 0x2c2c30, T: 0x1c1c1e, m: 0xf4f4f4, o: 0xf4f4f4, l: 0xf4f4f4 }], ['tan gum', { u: 0xc8a06b, k: 0xa8804b, T: 0xc8a06b, m: 0xefe6d2, o: 0xa0612b, l: 0xefe6d2 }],
    ['baby blue', { u: 0x9fd8ff, k: 0xf4f4f4, T: 0xf4f4f4, m: 0xf4f4f4, o: 0x1d3a8a, l: 0xf4f4f4 }], ['grape', { u: 0x5a2bd6, k: 0x6cf542, T: 0x5a2bd6, m: 0xf4f4f4, o: 0x151517, l: 0x6cf542 }]],
  null, (B, c) => last(B, { o: c.o, m: c.m, u: nub(c.u), k: c.k, T: c.T, t: c.T, l: c.u, c: c.m, h: c.k }, [
    '......TT...',
    '.kk...TT...',
    'hkuuuutlu..',
    '.uuuuuuuuc.',
    '.mmmmmmmmc.',
    '.oooooooo..'], { span: { T: [0, 3], k: [0, 5] }, paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'T' && y === 5 && (u === 0 || u === 3) && z === 3) return null;   // the fat tongue's rounded top
      if (ch === 'k' && u === 5 && z === -3 && y === 4) return null;
      if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? c.l : shade(c.l, .82)) : undefined;   // fat laces
      if (ch === 't' && u > 2) return c.u; if (ch === 'm' && outer(u, u1) && y === 1) return shade(c.m, .9);
      if (outer(u, u1) && PIP(y, z) && ch === 'u') return c.m; } })],
  tacboot: ['field ops', 'common', [
    ['coyote', { u: 0xc2a878, c: 0x6b5a3a, o: 0x3a3026, k: 0x8a7654 }], ['black', { u: 0x232326, c: 0x121214, o: 0x121214, k: 0x2e2e33 }],
    ['olive', { u: 0x5a6b4a, c: 0x2f3a28, o: 0x1f2419, k: 0x4a5a3a }], ['urban grey', { u: 0x8e8e94, c: 0x2e2e33, o: 0x1e1e20, k: 0x5e5e64 }]],
  null, (B, c) => last(B, { o: c.o, c: c.c, u: knit(c.u), k: c.k, T: c.k, l: c.u, h: c.c }, [
    '..kkkkT....',
    'huuuuutl...',
    '.uuuuullc..',
    '.ccuuuuccc.',
    '.ooooooooo.',
    '.oo.oo.oo..'], { paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'l') return u <= 2 ? (((u + y + z) & 1) ? 0x111111 : c.k) : (u === 3 ? METAL(0x3a3a3a) : undefined);   // laces + speed hooks
      if (ch === 'u' && outer(u, u1) && y === 4 && z === -1) return METAL(0x3a3a3a);   // the D-ring
      if (ch === 'o' && y === 1 && (u === u0 || u === u1) && (z & 1)) return shade(c.o, 1.4); } })],
  lugloafer: ['lug loafers', 'rare', [
    ['black patent', { u: 0x111113, o: 0x111113, s: 0xf4f4f4 }], ['oxblood', { u: 0x5a0d18, o: 0x151515, s: 0xf4f4f4 }],
    ['chocolate', { u: 0x4a2e1a, o: 0x1c1712, s: 0xe9e2cf }], ['cream / black sole', { u: 0xefe6d2, o: 0x151515, s: 0x151517 }]],
  null, (B, c) => last(B, { o: c.o, u: GLOSS(c.u), x: GLOSS(shade(c.u, .8)), s: knit(c.s) }, [
    '...sss.....',
    '...sss.....',
    '.uusssxxu..',
    '.uuuuuxxuu.',
    '.ooooooooo.',
    '.oo.o.ooo..'], { span: { s: [0, 2] }, paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'x' && y === 3 && z === 2 && u >= 1 && u <= 2) return METAL(0xe7bd4a);   // the coin in the strap's slot
      if (ch === 'x' && y === 3 && z === 3 && u >= 1 && u <= 2) return GLOSS(shade(c.u, .55));
      if (ch === 'o' && y === 1 && (u === u0 || u === u1) && (z & 1)) return shade(c.o, 1.8); } })],   // the welt stitch
  splittoe: ['split toes', 'epic', [
    ['ivory', { u: 0xefe9dc, m: 0xefe9dc, o: 0xb8ab90 }], ['black', { u: 0x151517, m: 0x151517, o: 0x0a0a0a }], ['blood red', { u: 0x9e1020, m: 0x2a0a0e, o: 0x151515 }], ['sand', { u: 0xc8b58a, m: 0xe0d2ac, o: 0x8a7a55 }]],
  null, (B, c) => last(B, { o: c.o, m: c.m, u: c.u, g: METAL(0xc0c0c0) }, [
    '.guuu......',
    '.guuuuuu...',
    '.uuuuuuuuu.',
    '.mmmmmmmmm.',
    '.oooooooo..'], { span: { g: [1, 3] }, paint: (ch, u, y, z, s, u0, u1) => {
      if (u === 2 && z >= 4 && y >= 1) return null;   // THE SPLIT: big toe (u 0–1) and the rest (u 3–4)
      if (u === 2 && z === 3 && y === 3) return shade(c.u, .7);   // the seam, down to the split
      if (ch === 'g' && ((y + u) & 1)) return c.u; } })],
  socksneak: ['sock runners', 'epic', [
    ['all black', { s: 0x19191b, m: 0x19191b, o: 0x0c0c0c, r: 0x34343a }], ['black / white sole', { s: 0x19191b, m: 0xf4f4f4, o: 0xdcdcdc, r: 0xf4f4f4 }],
    ['red', { s: 0xc0272d, m: 0xc0272d, o: 0x7a1418, r: 0x19191b }], ['triple white', { s: 0xf4f4f4, m: 0xf4f4f4, o: 0xdcdcdc, r: 0xd4d4d4 }]],
  null, (B, c) => last(B, { o: c.o, m: c.m, s: knit(c.s), r: c.r, k: GLOSS(shade(c.m, .85)) }, [
    '...rrr.....',
    '..ssss.....',
    '.kssssssss.',
    '.mmmmmmmmm.',
    '.mmmmmmmmm.',
    '.oooooooo..'], { span: { r: [0, 2], s: (y, z) => y >= 4 ? [0, 3] : [0, 4], k: [0, 4] }, paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'm' && (u === u0 || u === u1) && ((z + y) & 1)) return shade(c.m, .84);   // the moulded ribs
      if (ch === 's' && y === 3 && u === 1 && z >= 1) return c.r; } })],   // one knit rib down the vamp
  workboot: ['yard boots', 'rare', [
    ['wheat', { u: 0xc8964a, p: 0x6b4a2e, o: 0x3a2616, w: 0xb07a3a }], ['black', { u: 0x232326, p: 0x121214, o: 0x121214, w: 0x2e2e33 }],
    ['blood', { u: 0x5a1420, p: 0x2e0a10, o: 0x1a1a1a, w: 0x8a5a2b }], ['olive', { u: 0x5a6b4a, p: 0x2f3a28, o: 0x2a2016, w: 0xb8a47a }]],
  null, (B, c) => last(B, { o: c.o, w: c.w, u: nub(c.u), P: c.p, T: nub(c.u), l: nub(c.u), h: c.p }, [
    '..PPPPTT...',
    'huuuuulT...',
    '.uuuuulluu.',
    '.uuuuuuuuu.',
    '.wwwwwwwww.',
    '.oooooooo..'], { span: { P: [0, 5], T: [0, 2] }, paint: (ch, u, y, z, s, u0, u1) => {
      if (ch === 'P' && u === 5 && (z === -2 || z === 0)) return null;   // the padded collar, rounded
      if (ch === 'T' && y === 4 && u === 1) return c.p;   // the tongue flops out over the laces
      if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? 0xe7bd4a : c.u) : (u === 3 ? METAL(0xb08840) : undefined);
      if (ch === 'w' && (u === u0 || u === u1 || z === 5) && (z & 1)) return shade(c.w, 1.25);   // welt stitch
      if (ch === 'o' && y === 0 && (u === u0 || u === u1) && !(z & 1)) return shade(c.o, .7); } })],
  sandalsocks: ['dad sandals + socks', 'common', [
    ['hiker', { x: 0x19191b, s: 0x9a9ca3, b: 0x3a3026, o: 0x19191b }], ['tourist', { x: 0x6b4a2e, s: 0xf4f4f4, b: 0xcfb58a, o: 0x3a2616 }],
    ['rave', { x: 0x6cf542, s: 0xff9ccb, b: 0x19191b, o: 0x19191b }], ['tie-dye', { x: 0x1d3a8a, s: 'dye', b: 0x2a2a2e, o: 0x19191b }]],
  null, (B, c) => { const DYE = [0xff7ab6, 0xffd21f, 0x6cf542, 0x2de2e6, 0x8a3cff], sock = c.s === 'dye' ? (u, y, z) => DYE[((y * 2 + z + u) % 5 + 5) % 5] : knit(c.s);
    last(B, { o: c.o, b: c.b, s: sock, x: c.x }, [
      '...sss.....',
      '...sss.....',
      '.xssssxsx..',
      '.xssssxsxs.',
      '.bbbbbbbbb.',
      '.oooooooo..'], { span: { s: (y, z) => y >= 4 ? [0, 2] : [0, 3] }, paint: (ch, u, y, z, s, u0, u1) => {
        if (ch === 'x' && outer(u, u1) && y === 3) return shade(c.x, .7);   // the hook-and-loop tabs
        if (ch === 'b' && (u === u0 || u === u1) && (z & 1)) return shade(c.b, 1.25); } }); }],
  bulbs: ['moon bulbs', 'grail', [
    ['moon white', { u: 0xf4f4f4, L: 0x7cc3ff, w: 0xe7bd4a, k: 0x7cc3ff }], ['bubblegum', { u: 0xff7ab6, L: 0xff4fa3, w: 0xdfe6ee, k: 0xf4f4f4 }],
    ['toxic', { u: 0x6cf542, L: 0x9cff7a, w: 0xdfe6ee, k: 0x151517 }], ['midnight', { u: 0x151517, L: 0xff2424, w: 0xe7bd4a, k: 0xff2424 }]],
  'One pair exists: cartoon bulb toes on a lit sole, with heel wings. Worn once on Fit Street, then robbed.',
  (B, c) => { last(B, { o: 0x151515, L: LIT(c.L), u: GLOSS(c.u), k: GLOSS(c.k), W: METAL(c.w) }, [
      'W.kkk.......',
      'Wuuuu.......',
      'Wuuuu.......',
      '..uuu.......',
      '.LLLLLLLLLLL',
      '.oooooooo...'], { heel: 9, toe: false, span: { W: (y, z) => [5, y === 5 ? 6 : 5] } });
    for (const [side, X] of FOOT) for (let u = 0; u <= 5; u++) for (let y = 2; y <= 5; y++) for (let z = -1; z <= 7; z++) {   // the bulb
      const d = ((u - 2.5) / 3.5) ** 2 + ((y - 2.4) / 3.3) ** 2 + ((z - 3.4) / 4.3) ** 2; if (d > 1) continue;
      B.set(X(u), y, z, y === 5 || d > .8 && hash3(u, y, z) % 4 === 0 ? GLOSS(shade(c.u, 1.08))[0] : c.u, 1); }
    for (const [side, X] of FOOT) { B.set(X(4), 4, 5, 0xffffff, 1); B.set(X(3), 5, 4, 0xffffff, 1); } }],   // a cartoon highlight
};

// ───────── install (chars.js calls this once, after Drop 02's draws)
const pick = (list, p) => list[((((p && p.cw) | 0) % list.length) + list.length) % list.length];
const LEGACY = {}; let REF = null;
export function installShoes2({ SHOES, NEWT, NEWI, NAMES }) {
  REF = { SHOES, NEWI };
  for (const [id, [name, tier, cw, why, draw]] of Object.entries(SHOES2)) {
    const was = NEWI[id]; if (was) LEGACY[id] = { draw: SHOES[id], cw: was.cw };
    const t = was ? was.tier : tier;   // a redrawn Drop 02 shoe keeps its tier
    NEWT.shoes[id] = [name, t, cw, why || undefined]; NEWI[id] = { id, slot: 'shoes', name, tier: t, cw, why: why || null, new: true, shoes2: was ? 'redrawn' : 'new' };
    NAMES.shoes[id] = name; SHOES[id] = (B, p) => draw(B, pick(cw, p)[1], p);
  }
}
// the side-by-side: run fn with Drop 02's original shoe draws (and colourways) in place, then put the new ones back
export function withLegacy(fn) { if (!REF) return fn(); const keep = {};
  for (const [id, o] of Object.entries(LEGACY)) { keep[id] = [REF.SHOES[id], REF.NEWI[id].cw]; REF.SHOES[id] = o.draw; REF.NEWI[id].cw = o.cw; }
  try { return fn(); } finally { for (const [id, [d, cw]] of Object.entries(keep)) { REF.SHOES[id] = d; REF.NEWI[id].cw = cw; } } }
export const SHOE_IDS = Object.keys(SHOES2), REDRAWN = ['courtlow', 'lugboot', 'chunky', 'furslide', 'courtking', 'clogs', 'chromes'];
