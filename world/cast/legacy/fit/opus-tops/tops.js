// OPUS TOPS (2026-10-01): a drop of fourteen new tops for the street, ids opus_*, studio origin 'opus' (NEWI origin).
// slime: "we need some super sick stuff and some rare stuff". Chunky silhouettes, strong materials (stacked baffles, fur, satin,
// mirror tiles, croc), flat prints and letters, invented marks only. chars.js installs them (installOpusTops) before the necklines
// are stamped on TOPS; each declares its flank and neckline in body.js TOPFIT.
//
// Fit (world/fit/contract.js, body.js): every top is built on one of the shapes the audit and the see-through gate already pass,
// so the arm and the idles (hands behind the back, hands on hips) clear it the same way:
//   JACKET  (flank 1) shell x −6…5, y 9…17, z −3…3 · one sleeve per arm x −9…−7, y 10…17 (short: y 14…17), z −2…1 (the varsity cut)
//   PARKA   (flank 2) shell x −7…6, y 9…17, z −4…4 · sleeve x −10…−8, y 9…17, z −3…2 (the puffer cut)
//   BUBBLE  (flank 2) shell x −7…6, y 9…17, z −5…5 quilted every third row · sleeve x −11…−8, y 9…17, z −4…3 (the bubble cut)
//   · the shell rides the chest; the sleeve is one piece on the arm; shell cells that share a face with a sleeve are taken out
//     (unhook: a closed channel behind the sleeve, hidden at rest), so a swung arm never tears a face of the jacket
//   · the hem is y 9 all round: it laps over the fuller pants' waist (y 8: x −5…4, z −2…3); nothing below y 9, nothing at y 18
//   · prints, letters and patches recolour the shell (0 proud); collars are the y 17 row, at most one proud; only the *puffer /
//     *fuzz ids carry puffer structure (≤ 2); the geometry is mirror-symmetric (any noise that shapes it is hashed on |x|)
//   · accents are two cells or more, or sit on a patch of their own colour (a lone cell on the shell reads as a speck)
import { TOPFIT, onSeg } from '../body.js';

// ── colour + noise
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const mx = x => (x < 0 ? -1 - x : x);   // the mirror-symmetric x (noise that shapes geometry is hashed on it)
const MATTE = 0, GLOSS = 1, METAL = 2;

// ── voxels
const put = (B, x, y, z, c, l = 0) => { if (c === undefined || c === null) return; if (Array.isArray(c)) B.set(x, y, z, c[0], c[1]); else B.set(x, y, z, c, l); };
const fill = (B, x0, x1, y0, y1, z0, z1, paint, l = 0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(B, x, y, z, typeof paint === 'function' ? paint(x, y, z) : paint, l); };
const K = (x, y, z) => x * 4096 + y * 64 + z, dec = k => { const x = Math.round(k / 4096), r = k - x * 4096, y = Math.round(r / 64); return [x, y, r - y * 64]; };
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// the cells a draw writes (the shell), so the unhook knows them
function track(B, fn) { const got = new Set(), set0 = B.set; B.set = function (x, y, z, c, l) { set0.call(this, x, y, z, c, l); if (c !== undefined && c !== null) got.add(K(Math.round(x), Math.round(y), Math.round(z))); };
  try { fn(); } finally { B.set = set0; } return got; }
// one sleeve per arm (box for the LEFT arm, inclusive; the right is mirrored x → −1 − x); paint(x, y, z, side) → colour | [colour, layer] | null
function sleeves(B, { x0, x1, y0, y1, z0, z1 }, paint, l = 0) { const cells = new Set();
  for (const s of 'LR') onSeg(B, 'arm' + s, () => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const c = paint(x, y, z, s); if (c === null || c === undefined) continue; const [col, li] = Array.isArray(c) ? c : [c, l], X = s === 'L' ? x : -1 - x; B.set(X, y, z, col, li); cells.add(K(X, y, z)); } });
  return cells; }
// a shell cell sharing a face with a sleeve cell goes (+ any corner left hanging by one face): the closed channel behind the sleeve
function unhook(B, cells, shell) { const cut = [];
  for (const k of cells) { const [x, y, z] = dec(k); for (const [dx, dy, dz] of N6) { const n = K(x + dx, y + dy, z + dz); if (shell.has(n) && !cells.has(n) && B.has(x + dx, y + dy, z + dz)) { B.del(x + dx, y + dy, z + dz); cut.push([x + dx, y + dy, z + dz]); } } }
  for (const [x, y, z] of cut) for (const [dx, dy, dz] of N6) { const X = x + dx, Y = y + dy, Z = z + dz;
    if (shell.has(K(X, Y, Z)) && B.has(X, Y, Z) && N6.filter(d => B.has(X + d[0], Y + d[1], Z + d[2])).length <= 1) B.del(X, Y, Z); } }

// the three cuts. shell(x, y, z) and sleeve(x, y, z, side) paint; deco() draws the shell's flat art (inside the track, before the unhook)
const SLEEVE = { jacket: { x0: -9, x1: -7, y0: 10, y1: 17, z0: -2, z1: 1 }, short: { x0: -9, x1: -7, y0: 14, y1: 17, z0: -2, z1: 1 },
  parka: { x0: -10, x1: -8, y0: 9, y1: 17, z0: -3, z1: 2 }, bubble: { x0: -11, x1: -8, y0: 9, y1: 17, z0: -4, z1: 3 } };
function jacket(B, { shell, sleeve, deco, short = false, l = 0 }) {
  const S = track(B, () => { fill(B, -6, 5, 9, 17, -3, 3, shell, l); deco?.(); });
  unhook(B, sleeves(B, short ? SLEEVE.short : SLEEVE.jacket, sleeve, l), S); }
function parka(B, { shell, sleeve, deco, l = 0, d = 4 }) {
  const S = track(B, () => { fill(B, -7, 6, 9, 17, -d, d, shell, l); deco?.(); });
  unhook(B, sleeves(B, SLEEVE.parka, sleeve, l), S); }
// the stacked baffles: a groove every third row (y 9, 12, 15: the outermost front, back and side cells out; groove(x, y, z) paints the
// cell the groove bares), the sleeve grooved on its outer column
function bubble(B, { shell, groove, sleeve, deco, l = 0, d = 5 }) {
  const S = track(B, () => { fill(B, -7, 6, 9, 17, -d, d, shell, l);
    for (let y = 9; y < 18; y += 3) { for (let x = -7; x <= 6; x++) { B.del(x, y, d); B.del(x, y, -d); if (groove) { put(B, x, y, d - 1, groove(x, y, d - 1), l); put(B, x, y, -d + 1, groove(x, y, -d + 1), l); } }
      for (let z = -d; z <= d; z++) { B.del(-7, y, z); B.del(6, y, z); if (groove && z > -d && z < d) { put(B, -6, y, z, groove(-6, y, z), l); put(B, 5, y, z, groove(5, y, z), l); } } }
    deco?.(); });
  unhook(B, sleeves(B, SLEEVE.bubble, (x, y, z, s) => x === -11 && y % 3 === 0 ? null : x === -10 && y % 3 === 0 && groove ? groove(x, y, z, s) : sleeve(x, y, z, s), l), S); }

// ── flat art: rows top → bottom; front reads left → right from the front (x up), back from behind (x down)
const art = (B, rows, pal, x0, top, z, l = 0) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) put(B, x0 + i, top - j, z, c, l); } });
const artBack = (B, rows, pal, xr, top, z, l = 0) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) put(B, xr - i, top - j, z, c, l); } });
// a 3 × 5 block font (flat letters)
const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001111', V: '101101101101010' };
const glyphRows = s => [0, 1, 2, 3, 4].map(r => [...s].map(ch => (GLYPH[ch] || '000000000000000').slice(r * 3, r * 3 + 3).replace(/1/g, 'X').replace(/0/g, '.')).join('.'));
const word = (B, s, x0, top, z, c, l = 0) => art(B, glyphRows(s), { X: c }, x0, top, z, l);
const wordBack = (B, s, xr, top, z, c, l = 0) => artBack(B, glyphRows(s), { X: c }, xr, top, z, l);

// ── the motifs
const STAR = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'];
const BOLT = ['..XX', '.XX.', 'XXXX', '.XX.', 'XX..'];
const DOLLAR = ['.XX.', 'XXXX', 'XX..', '.XX.', '..XX', 'XXXX', '.XX.'];
const SMILEY = ['..YYYY..', '.YYYYYY.', 'YYKYYKYY', 'YYKYYKYY', 'YYYYYYYY', '.YKYYKY.', '..YKKY..'];
const TIGER = ['.OO....OO.', 'OKOOKKOOKO', 'OYKOOOOKYO', 'KOOOWWOOOK', 'OKOWPPWOKO', '.OWWKKWWO.', '..OWWWWO..'];
const CROWN = ['Y.Y.Y', 'YYYYY', 'YRYRY', 'YYYYY'];
const DISC5 = ['.XXX.', 'XXXXX', 'XXXXX', 'XXXXX', '.XXX.'];
const fur = (C, C2, x, y, z) => { const h = hash3(x, y, z) & 3; return h === 0 ? C2 : h === 1 ? shade(C, .88) : C; };   // flat fur: three close tones
const rib = (A, Bc, i) => ((i & 1) ? A : Bc);

export const OPUS_TOPS = [
  // ───────────── GRAIL
  { id: 'opus_bankroll_puffer', name: 'Bankroll puffer', tier: 'grail', flank: 2, neckline: 'high', wearer: 'corner bosses, penthouse money',
    why: 'The stacked-baffle puffer printed edge to edge in banknotes, a bank strap down the front: you wear the stack.',
    cw: [['greenback', 0x5fa84a, 0xd7141a], ['pink fifties', 0xff7ab6, 0xe7bd4a], ['gold notes', 0xe7bd4a, 0x151517]],
    draw(B, [, G, Sp]) { const Lt = shade(G, 1.18), D = shade(G, .58);   // (the note's edge and medallion are shades of it: one colour family, so the baffles' relief stays structure)
      // a bill every six cells round the jacket, staggered per baffle: pale edge, the note, a dark medallion in the middle
      const bill = (u, y) => { const b = Math.floor((y - 10) / 3), v = ((u + (b & 1) * 3) % 6 + 6) % 6; return v === 0 ? Lt : v === 3 || v === 4 ? D : G; };   // (the medallion two wide: it never hangs alone if a neighbour is cut)
      const uOf = (x, z) => (Math.abs(z) >= 4 ? x : z + 20);
      const strap = (x, z) => x >= -3 && x <= 2 && Math.abs(z) >= 4;   // the bank strap down the front and the back
      bubble(B, { l: GLOSS, d: 5,
        shell: (x, y, z) => strap(x, z) ? (x === -3 || x === 2 ? shade(Sp, .75) : Sp) : bill(uOf(x, z), y),
        groove: () => shade(D, .8),
        sleeve: (x, y, z) => bill(z + x * 2, y),
        deco: () => { for (const sz of [1, -1]) DOLLAR.forEach((r, j) => { const y = 16 - j; for (let i = 0; i < 4; i++) if (r[i] === 'X') B.set(i - 2, y, sz * (y % 3 ? 5 : 4), 0xf4f4f4, GLOSS); });   // a big flat $ on the strap, front and back (sunk into the grooves it crosses)
          for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) B.set(x, 17, z, shade(D, .85), GLOSS); } });   // the dark collar
    } },
  { id: 'opus_gator_mink', name: 'Gator & mink jacket', tier: 'grail', flank: 2, neckline: 'collar', wearer: 'penthouse money, the boss at the back of the club',
    why: 'Gloss croc scales with a mink collar, mink lapels and mink cuffs, gold zip: the jacket that tells the block who owns it.',
    cw: [['emerald gator / mink', 0x2f7a3a, 0x1d4a26, 0x5fae5a, 0x5a3a26, 0x7a5236, 0xe7bd4a], ['bone gator / black mink', 0xe6dcc6, 0xb3a588, 0xf6f0e0, 0x1e1a18, 0x3a302a, 0xe7bd4a],
      ['candy gator / pink fox', 0xc0272d, 0x7a1418, 0xe8504f, 0xff9ccb, 0xffbfdc, 0xdfe6ee]],
    draw(B, [, C, Ln, Bl, M, M2, Au]) {
      // the scales: 4 × 3 tiles in brick bond, a dark seam on one column and one row, a glint in each tile's top corner
      const scale = (u, y, belly) => { const r = Math.floor((y - 9) / 3), uu = u + (r & 1) * 2, i = ((uu % 4) + 4) % 4, j = (y - 9) % 3, T = belly ? Bl : C;
        const t = hash3(Math.floor(uu / 4), r, 7) & 1 ? T : shade(T, .84); return i === 0 || j === 0 ? Ln : j === 2 ? shade(t, 1.22) : t; };   // (the lit top row domes each scale)
      const lapel = (x, y) => { const w = y - 13; return w >= 0 && w <= 3 && ((x >= -2 - w && x <= -2) || (x >= 1 && x <= 1 + w)); };   // the shawl: widening to the collar
      parka(B, { l: GLOSS, d: 4,
        shell: (x, y, z) => { if (y === 17) return [fur(M, M2, mx(x), y, z), MATTE]; if (z === 4 && lapel(x, y)) return [fur(M, M2, mx(x), y, z), MATTE];
          return Math.abs(z) === 4 ? scale(mx(x), y, z === 4 && x >= -5 && x <= 4) : scale(z + 21, y, false); },
        sleeve: (x, y, z) => y <= 10 ? [fur(M, M2, x, y, z), MATTE] : scale(z + x * 3 + 30, y, false),
        deco: () => { for (let x = -7; x <= 6; x++) { B.set(x, 17, 5, fur(M, M2, mx(x), 17, 5), MATTE); B.set(x, 17, -5, fur(M, M2, mx(x), 17, -5), MATTE); }   // the mink collar, one proud all round
          for (let y = 9; y < 17; y++) { B.set(-1, y, 4, Au, GLOSS); B.set(0, y, 4, Au, GLOSS); }   // the gold zip, two wide
          for (const x of [-6, 5]) for (const y of [10, 11]) B.set(x, y, 4, Au, GLOSS); } });   // the gold hip snaps (two high)
      // the mink cuffs flare one wider on the outer side (sideways only)
      onSeg(B, 'armL', () => { for (let y = 9; y <= 10; y++) for (let z = -3; z <= 2; z++) B.set(-11, y, z, fur(M, M2, -11, y, z), MATTE); });
      onSeg(B, 'armR', () => { for (let y = 9; y <= 10; y++) for (let z = -3; z <= 2; z++) B.set(10, y, z, fur(M, M2, -11, y, z), MATTE); });
    } },
  // ───────────── EPIC
  { id: 'opus_mirrorball', name: 'Mirrorball bomber', tier: 'epic', flank: 2, neckline: 'collar', wearer: 'club kids, the strip after midnight',
    why: 'A bomber tiled in mirror squares that throw colour back at the street lights, fat knit rib at the collar, cuffs and hem.',
    cw: [['silver / black rib', 0xdfe6ee, 0xb9c2cc, 0xf6f8fb, 0x151517, 0xff4fa3, 0x2de2e6], ['gold / purple rib', 0xe7bd4a, 0xc99a2e, 0xffe08a, 0x5a2bd6, 0xffffff, 0xff7a1a],
      ['oil slick / pink rib', 0x8a7cff, 0x2de2e6, 0xff7ab6, 0xff4fa3, 0x9cff3a, 0xffd21f]],
    draw(B, [, T1, T2, T3, R, G1, G2]) {
      const tile = (x, y, z) => { const h = hash3(x >> 1, y >> 1, z >> 1); return h % 11 === 0 ? [G1, GLOSS] : h % 13 === 0 ? [G2, GLOSS] : [[T1, T2, T3][h % 3], GLOSS]; };
      parka(B, { d: 4,
        shell: (x, y, z) => y === 9 ? rib(R, shade(R, .8), x) : (y === 17 && x >= -5 && x <= 4) ? rib(R, shade(R, .8), x) : tile(x + 8, y, z + 8),
        sleeve: (x, y, z) => y <= 10 ? rib(R, shade(R, .8), z) : tile(x + 8, y, z + 8),
        deco: () => { for (let x = -5; x <= 4; x++) B.set(x, 17, -5, rib(R, shade(R, .8), x)); } });   // the knit collar, one proud at the back
    } },
  { id: 'opus_sukajan', name: 'Tiger sukajan', tier: 'epic', flank: 1, neckline: 'collar', wearer: 'collectors, hustlers who travel',
    why: 'A gloss satin souvenir jacket, two-tone with striped rib, a big flat tiger across the back and a bolt on the chest.',
    cw: [['black / gold', 0x151517, 0xe7bd4a, 0xff7a1a], ['royal / red', 0x1d3a8a, 0xd7141a, 0xff8a1f], ['jade / pink', 0x0a8a6a, 0xff7ab6, 0xffc21a]],
    draw(B, [, A, Sl, Or]) {
      const stripe = i => rib(A, Sl, i);
      jacket(B, { l: GLOSS,
        shell: (x, y) => (y === 17 ? stripe(x) : A),
        sleeve: (x, y, z) => y <= 11 ? [stripe(y), MATTE] : Sl,
        deco: () => { for (let x = -5; x <= 4; x++) B.set(x, 17, -4, stripe(x), MATTE);   // the rib collar, one proud at the back
          for (let x = -6; x <= 5; x++) for (const z of [-3, 3]) B.set(x, 9, z, stripe(mx(x) >> 1), MATTE); for (let z = -2; z <= 2; z++) { B.set(-6, 9, z, stripe((z + 4) >> 1), MATTE); B.set(5, 9, z, stripe((z + 4) >> 1), MATTE); }   // the rib hem (two-wide stripes)
          artBack(B, TIGER, { O: Or, K: 0x151515, Y: 0xffe23a, W: 0xf4f4f4, P: 0xff7ab6 }, 4, 16, -3, MATTE);   // the tiger, flat on the back
          art(B, BOLT, { X: Sl }, 1, 16, 3, MATTE); } });   // the bolt on the chest
    } },
  { id: 'opus_barrel_puffer', name: 'Traffic-barrel puffer', tier: 'epic', flank: 2, neckline: 'high', wearer: 'night-shift hustlers, the corner in January',
    why: 'Fat stacked baffles in construction-barrel stripes with reflective tape sunk in every groove: you can see it from the next block.',
    cw: [['barrel', 0xff6a00, 0xf4f4f4, 0xdfe6ee], ['night barrel', 0x151517, 0xffd21f, 0xdfe6ee], ['acid barrel', 0x9cff3a, 0x5a2bd6, 0xf4f7fb]],
    draw(B, [, A, Bc, Rf]) {
      const band = y => (Math.floor((y - 10) / 3) & 1 ? Bc : A), lit = (c, y) => (y % 3 === 2 ? shade(c, 1.08) : c);
      bubble(B, { l: GLOSS, d: 5, shell: (x, y) => lit(band(y), y), groove: () => [Rf, METAL], sleeve: (x, y) => lit(band(y), y),
        deco: () => { for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) B.set(x, 17, z, Bc, GLOSS);   // the funnel collar
          for (let y = 10; y < 18; y++) if (y % 3) { B.set(-1, y, 5, 0x2a2c31, METAL); B.set(0, y, 5, 0x2a2c31, METAL); } } });
    } },
  // ───────────── RARE
  { id: 'opus_patch_denim', name: "Collector's patch jacket", tier: 'rare', flank: 1, neckline: 'collar', wearer: 'collectors, record-store kids, skaters',
    why: 'A trucker jacket covered in flat patches: a star, a bolt, sleeve flashes and a giant smiley across the back.',
    cw: [['mid wash', 0x4f79b5, 0x8a5a2b], ['black denim', 0x2a2a2e, 0xb8b0a0], ['bleach wash', 0x9bb8dd, 0x3a2616]],
    draw(B, [, C, Cd]) {
      const tw = (x, y) => (((x + y) & 3) === 0 ? shade(C, 1.12) : C), D = shade(C, .78);
      jacket(B, {
        shell: (x, y) => y === 17 ? (x & 1 ? Cd : shade(Cd, .85)) : y === 9 || y === 15 ? D : tw(x, y),
        sleeve: (x, y, z, s) => y === 10 ? D : y === 17 ? C : (x === -9 && y >= 13 && y <= 15) ? (s === 'L' ? 0xd7141a : 0x25b84c) : tw(z, y),
        deco: () => { for (let x = -6; x <= 5; x++) B.set(x, 17, -4, x & 1 ? Cd : shade(Cd, .85));   // the corduroy collar, one proud at the back
          art(B, STAR, { X: 0xffd21f }, -6, 14, 3); art(B, BOLT, { X: 0xff4fa3 }, 1, 14, 3);
          for (const y of [10, 11, 12, 13]) B.set(-1, y, 3, 0xc8744a, METAL);   // the copper buttons, as a placket
          artBack(B, SMILEY, { Y: 0xffe23a, K: 0x151515 }, 3, 16, -3); } });
    } },
  { id: 'opus_racer', name: 'Pit-lane racing jacket', tier: 'rare', flank: 1, neckline: 'high', wearer: 'street racers, the strip, getaway drivers',
    why: 'Gloss nylon colour-block with a chequered-flag sleeve, a number roundel on the chest and V12 across the back.',
    cw: [['red / white', 0xd7141a, 0xf2f2f2, 0x151517], ['yellow / black', 0xffd21f, 0x151517, 0xd7141a], ['teal / orange', 0x12b3a0, 0xff7a1a, 0xf2f2f2]],
    draw(B, [, A, Bc, C]) {
      const chk = (u, v) => ((((u >> 1) + (v >> 1)) & 1) ? 0x151515 : 0xf4f4f4);
      jacket(B, { l: GLOSS,
        shell: (x, y) => y === 12 || y === 15 ? C : (y === 13 || y === 14) ? Bc : y === 17 ? Bc : A,
        sleeve: (x, y, z) => y <= 13 ? chk(z + 2 + (x + 9), y - 10) : y === 14 || y === 17 ? Bc : A,
        deco: () => { art(B, DISC5, { X: 0xf4f4f4 }, 0, 15, 3); word(B, '7', 1, 15, 3, 0x151515);   // the roundel and its number
          for (let y = 9; y < 17; y++) B.set(-1, y, 3, 0xbdbdbd, METAL);   // the zip
          fill(B, -6, 5, 10, 16, -3, -3, Bc); wordBack(B, 'V12', 4, 15, -3, A); } });   // V12 on a plain back panel
    } },
  { id: 'opus_fuzz_cardigan', name: 'Mohair fuzz cardigan', tier: 'rare', flank: 2, neckline: 'vee', wearer: 'club kids, skaters, the art-school corner',
    why: 'An oversized mohair cardigan in loud stripes, fuzz standing off the knit, buttons as big as coins.',
    cw: [['acid stripe', 0x9cff3a, 0x8c52ff, 0xff4fa3], ['beach towel', 0xff7a1a, 0x3fa9f5, 0xffe23a], ['bubblegum', 0xff7ab6, 0xfff1a8, 0x2de2e6]],
    draw(B, [, A, Bc, C], p, sk) {
      const stripe = y => [A, Bc, C][Math.floor((y - 9) / 3) % 3], knit = (x, y, z) => { const c = stripe(y), h = hash3(mx(x), y, z) & 3; return h === 0 ? shade(c, 1.1) : h === 1 ? shade(c, .9) : c; };
      const vee = (x, y) => (y === 17 && x >= -2 && x <= 1) || (y === 16 && x >= -1 && x <= 0);
      parka(B, { d: 4,
        shell: (x, y, z) => z === 4 && vee(x, y) ? [sk.c(x, y, z), sk.layer] : knit(x, y, z),
        sleeve: (x, y, z) => (y <= 10 ? shade(A, .82) : knit(x, y, z)),
        deco: () => { for (let y = 9; y < 16; y++) { B.set(-1, y, 4, shade(C, .7)); B.set(0, y, 4, shade(C, .7)); }   // the button band
          for (const y of [10, 13]) for (const [x, yy] of [[-1, y], [0, y], [-1, y + 1], [0, y + 1]]) B.set(x, yy, 4, 0xf4f4f4, GLOSS);   // the coin buttons, 2 × 2
          for (let x = -6; x <= 5; x++) for (let y = 10; y <= 16; y++) for (const z of [-5]) if (hash3(mx(x) >> 1, y, z) % 5 === 0 && (mx(x) & 1) === 0)   // the fuzz: pairs of tufts, one proud, on the back (the front stays flat for the chains)
            { B.set(x, y, z, knit(x, y, z)); B.set(x < 0 ? x - 1 : x + 1, y, z, knit(x, y, z)); } } });
    } },
  { id: 'opus_snorkel', name: 'Snorkel parka', tier: 'rare', flank: 2, neckline: 'high', wearer: 'dock workers, winter hustlers, the bus stop at 5 am',
    why: 'A big matte parka with a fur ruff round the neck, the orange lining showing at the hem and huge flap pockets.',
    cw: [['olive / orange', 0x4a5a3a, 0xff6a00, 0x8e8478, 0xd8d2c4], ['navy / orange', 0x1b2a4a, 0xff6a00, 0x8e8478, 0xd8d2c4], ['black / cream', 0x18181b, 0xefe6d2, 0xd8d2c4, 0xf4efe4]],
    draw(B, [, C, Ln, F1, F2], p) {
      const D = shade(C, .72), pocket = (x, y) => y >= 10 && y <= 13 && ((x >= -6 && x <= -3) || (x >= 2 && x <= 5));
      parka(B, { d: 4,
        shell: (x, y, z) => y === 9 ? Ln : y === 17 ? fur(F1, F2, mx(x), y, z) : (z === 4 && pocket(x, y)) ? (y === 13 ? D : shade(C, 1.3)) : C,
        sleeve: (x, y, z, s) => y === 9 ? Ln : (x === -10 && y >= 14 && y <= 15 && z >= -1 && z <= 0) ? 0xf4f4f4 : (x === -10 && y >= 13 && y <= 16 && z >= -2 && z <= 1) ? Ln : C,
        deco: () => { for (let x = -7; x <= 6; x++) for (const z of [5, -5]) B.set(x, 17, z, fur(F1, F2, mx(x), 17, z));   // the ruff, one proud all round
          for (let y = 10; y < 17; y++) { B.set(-1, y, 4, D); B.set(0, y, 4, D); }   // the storm flap
          for (const x of [-5, -4, 3, 4]) B.set(x, 12, 4, Ln); } });   // the flap tabs (pairs)
    } },
  { id: 'opus_warmup', name: 'Dynasty warm-up', tier: 'rare', flank: 1, neckline: 'high', wearer: 'ballers, the court at the park, AAU dads',
    why: 'A gloss tear-away warm-up: contrast yoke, snap stripes down the sleeves, a gold crown on the chest and 00 on the back.',
    cw: [['purple / gold', 0x5a2bd6, 0xe7bd4a, 0xf4f4f4], ['black / red', 0x151517, 0xd7141a, 0xf4f4f4], ['white / royal', 0xf2f2f2, 0x1d3a8a, 0xe8232a]],
    draw(B, [, A, Y, P]) {
      jacket(B, { l: GLOSS,
        shell: (x, y) => y >= 15 ? Y : y === 14 ? P : A,
        sleeve: (x, y, z) => x === -9 && z >= -1 && z <= 0 ? ((y === 11 || y === 12 || y === 14 || y === 15) && z === 0 ? [0xf4f4f4, METAL] : P) : y >= 15 ? Y : y === 10 ? shade(A, .8) : A,
        deco: () => { art(B, CROWN, { Y: Y === 0xe7bd4a ? 0xffe23a : 0xe7bd4a, R: 0xd7141a }, 0, 13, 3, GLOSS);
          for (let y = 9; y < 17; y++) B.set(-1, y, 3, 0xc9ced4, METAL);
          wordBack(B, '00', 2, 13, -3, Y); } });
    } },
  // ───────────── COMMON
  { id: 'opus_hivis', name: 'Dock hi-vis vest', tier: 'common', flank: 1, neckline: 'crew', wearer: 'dock workers, road crews, the Yards',
    why: 'A neon safety vest over a waffle thermal, reflective tape round the waist and over both shoulders.',
    cw: [['safety yellow / navy', 0xd8ff1a, 0x1b2a4a, 0xdfe6ee], ['safety orange / black', 0xff6a00, 0x151517, 0xdfe6ee], ['union pink / grey', 0xff4fa3, 0x6f6f74, 0xf4f7fb]],
    draw(B, [, V, T, Rf]) {
      const tape = (x, y) => (y === 10 || y === 11) || (y >= 12 && ((x >= -4 && x <= -3) || (x >= 2 && x <= 3)));
      jacket(B, {
        shell: (x, y, z) => (y === 17 && x >= -2 && x <= 1) ? T : tape(x, y) ? [Rf, GLOSS] : V,
        sleeve: (x, y) => y === 10 ? shade(T, .8) : (y & 1 ? T : shade(T, .9)),
        deco: () => { for (let y = 12; y < 17; y++) { B.set(-1, y, 3, shade(V, .8)); B.set(0, y, 3, shade(V, .8)); } } });   // the zip band
    } },
  { id: 'opus_scrubs', name: 'Night-shift scrubs', tier: 'common', flank: 1, neckline: 'vee', wearer: 'nurses, orderlies, the 24-hour pharmacy',
    why: 'Short-sleeve scrubs in a loud print (pills, hearts or stars) with a chest pocket and a pen.',
    cw: [['ceil / pills', 0x3fa9f5, 0xff4fa3, 0xf4f4f4], ['hot pink / hearts', 0xff4fa3, 0xd7141a, 0xffd1e3], ['night navy / stars', 0x1b2a4a, 0xffd21f, 0xfff1a8]],
    draw(B, [n, C, M1, M2], p, sk) {
      const kind = n.split('/ ')[1], D = shade(C, .78);
      const motif = (u, v, lo = -99, hi = 99) => { const P = kind === 'pills' ? 2 : 4, r = Math.floor(v / P), c0 = ((u + (r & 1) * 2) % 5 + 5) % 5, rr = ((v % P) + P) % P;   // a motif every 5 × 4 cells (pills 5 × 2), staggered
        if (u - c0 + 1 < lo || u - c0 + 3 > hi) return null;   // (only whole motifs: a half pill at a panel edge reads as a speck)
        if (kind === 'pills') return rr === 1 && c0 === 1 ? M1 : rr === 1 && c0 === 2 ? M2 : null;
        if (kind === 'hearts') return (rr === 2 && (c0 === 1 || c0 === 3)) || (rr === 1 && c0 >= 1 && c0 <= 3) || (rr === 0 && c0 === 2) ? M1 : null;
        return (rr === 1 && c0 >= 1 && c0 <= 3) || ((rr === 0 || rr === 2) && c0 === 2) ? M1 : null; };
      const vee = (x, y) => (y === 17 && x >= -2 && x <= 1) || (y === 16 && x >= -1 && x <= 0), trim = (x, y) => (y === 17 && (x === -3 || x === 2)) || (y === 16 && (x === -2 || x === 1)) || (y === 15 && (x === -1 || x === 0));
      const pocket = (x, y) => x >= 1 && x <= 4 && y >= 11 && y <= 14;
      jacket(B, { short: true,
        shell: (x, y, z) => { if (z === 3 && vee(x, y)) return [sk.c(x, y, z), sk.layer]; if (z === 3 && trim(x, y)) return D; if (y === 9) return D;
          if (z === 3 && pocket(x, y)) return y === 14 ? D : C; return Math.abs(z) === 3 ? motif(x + 8, y, 3, 12) ?? C : C; },
        sleeve: (x, y, z) => y === 14 ? D : motif(z + 8, y) ?? C,
        deco: () => { B.set(3, 14, 3, 0xf4f4f4); B.set(3, 15, 3, 0xf4f4f4); B.set(3, 16, 3, 0x151515); } });   // the pen in the pocket
    } },
  { id: 'opus_stripes', name: 'Lockup stripes', tier: 'common', flank: 1, neckline: 'crew', wearer: 'inmates, ex-cons, cartoon burglars',
    why: 'The cartoon convict top: fat horizontal bands all the way round and a big flat number across the back.',
    cw: [['jailhouse', 0x151517, 0xf2f2f2], ['county orange', 0xff6a00, 0xf2f2f2], ['pink lockup', 0xff4fa3, 0x151517]],
    draw(B, [, A, Bc]) {
      const band = y => ((y >> 1) & 1 ? A : Bc);
      jacket(B, {
        shell: (x, y) => band(y),
        sleeve: (x, y) => band(y),
        deco: () => { fill(B, -6, 5, 10, 16, -3, -3, Bc); wordBack(B, '613', 4, 15, -3, A); } });   // the number panel on the back
    } },
  { id: 'opus_windbreaker', name: 'Pier windbreaker', tier: 'common', flank: 1, neckline: 'high', wearer: 'skaters, the boardwalk, pier fishermen',
    why: 'A gloss nineties windbreaker cut in zig-zag colour blocks, odd sleeves and a half-zip.',
    cw: [['teal / purple / magenta', 0x12b3a0, 0x8c52ff, 0xff4fa3], ['yellow / royal / red', 0xffd21f, 0x2f5bff, 0xe83b5b], ['black / lime / orange', 0x151517, 0x6cff4a, 0xff7a1a]],
    draw(B, [, A, Bc, C]) {
      const zig = u => { const t = ((u % 4) + 4) % 4; return t === 3 ? 1 : t; };
      const block = (u, y) => (y > 13 + zig(u) ? A : y > 10 + zig(u + 2) ? Bc : C);
      jacket(B, { l: GLOSS,
        shell: (x, y, z) => block(Math.abs(z) === 3 ? x : z, y),
        sleeve: (x, y, z, s) => y === 10 ? A : y >= 16 ? A : s === 'L' ? Bc : C,
        deco: () => { for (let y = 13; y < 18; y++) B.set(-1, y, 3, 0xdfe6ee, METAL); B.set(0, 13, 3, 0xdfe6ee, METAL); } });   // the half-zip and its pull
    } },
];
for (const t of OPUS_TOPS) if (t.cw.length !== 3) throw new Error('opus tops: three colourways each (' + t.id + ')');

export function installOpusTops({ TOPS, NEWT, NEWI, NAMES }) {
  for (const t of OPUS_TOPS) {
    NEWT.top[t.id] = [t.name, t.tier, t.cw, t.why]; NEWI[t.id] = { id: t.id, slot: 'top', name: t.name, tier: t.tier, cw: t.cw, why: t.why, new: true, origin: 'opus', wearer: t.wearer };
    NAMES.top[t.id] = t.name; TOPFIT[t.id] = { flank: t.flank, neckline: t.neckline };
    TOPS[t.id] = (B, p = {}, sk) => t.draw(B, t.cw[((((p && p.cw) | 0) % t.cw.length) + t.cw.length) % t.cw.length], p, sk || { c: () => 0xd9a06b, layer: 0 });
  }
}
