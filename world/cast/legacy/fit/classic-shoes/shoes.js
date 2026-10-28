// Classic shoes: the legacy shoe traits (world/chars.js SHOES + world/shoes2.js: the originals, Drop 02 redrawn,
// the shoe pass's new pairs) rebuilt as native rigid feet for astra's legs. Ids classic_<oldid>, collection 'classic'.
// The legacy traits themselves are untouched and still roll in the city; these are review-only new traits.
//
// Foot-local coordinates, mirrored per side exactly like world/fit/opus-shoes/shoes.js:
//   u grows outwards from the fixed inner edge (u0 = x-2 left, x1 right), 0..4 (u5 meets the pockets-idle hand)
//   y 0..3 (the leg's cloth starts at y4; a tall shoe is cut at the ankle row)
//   z heel -> toe; ground cells stay inside z-3..5, z-4 is a heel tab and z6 a raised toe point only.
// The y3 row is the collar: u0..3 behind the instep, u0..2 from z2 forward (the pockets-idle hand's corner stays clear).
// Every shoe owns the 3x3 ankle socket (u0..2, y3, z-1..1) under the leg.
// Materials: 0 matte, 1 gloss, 2 metal, 3 lit (the moon bulbs' sole, as the legacy draw had it).
// Palette rows: [name, ...colors]. Names and marks are the legacy traits' own (all invented).

const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const GLOSS = c => [c, 1], METAL = c => [c, 2], LIT = c => [c, 3];
const knit = C => (u, y, z) => ((u + y + z) & 1) ? C : shade(C, .9);
const nub = C => (u, y, z) => { const h = hash3(u, y, z) % 5; return h === 0 ? shade(C, .88) : h === 1 ? shade(C, 1.06) : C; };
const RAINBOW = [0x61bb46, 0xfdb827, 0xf5821f, 0xe03a3e, 0x963d97, 0x009ddc];

function pad() {
  const cells = new Map(), k = (u, y, z) => `${u},${y},${z}`;
  const F = {
    cells,
    set(u, y, z, c, l = 0) { if (Array.isArray(c)) [c, l] = c; cells.set(k(u, y, z), [u, y, z, c, l]); },
    del(u, y, z) { cells.delete(k(u, y, z)); },
    has(u, y, z) { return cells.has(k(u, y, z)); },
    paint(u, y, z, c, l) { const q = cells.get(k(u, y, z)); if (!q) return; if (Array.isArray(c)) [c, l] = c; cells.set(k(u, y, z), [u, y, z, c, l ?? q[4]]); },
    each(fn) { for (const q of [...cells.values()]) fn(...q); },
  };
  return F;
}
// The last: a side profile, rows top -> bottom = y3..y0, columns z-4..z6, swept across the foot in u.
// A row's frontmost (and, from y `heel` up, backmost) cell is rounded by one on both sides, like shoes2.js.
// o.span[ch] = [u0,u1] | (y,z) => [u0,u1]; o.paint(ch,u,y,z,u0,u1) -> colour | [colour,layer] | null (skip) | undefined.
function last(F, P, rows, o = {}) {
  const Z0 = -4, H = rows.length, sp = o.span || {};
  for (let j = 0; j < H; j++) {
    const y = H - 1 - j, row = rows[j]; let zf = -99, zb = 99;
    for (let i = 0; i < row.length; i++) if (!'.h'.includes(row[i])) { zf = Math.max(zf, i + Z0); zb = Math.min(zb, i + Z0); }
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]; if (ch === '.') continue; const z = i + Z0;
      let s = sp[ch]; if (typeof s === 'function') s = s(y, z);
      let [u0, u1] = s || (ch === 'h' ? [1, 2] : y === 3 ? (z >= 2 ? [0, 2] : [0, 3]) : [0, 4]);
      if (u1 - u0 >= 3 && ((z === zf && o.toe !== false) || (z === zb && y >= (o.heel ?? 2)))) { u0++; u1--; }
      for (let u = u0; u <= u1; u++) {
        let v = o.paint ? o.paint(ch, u, y, z, u0, u1) : undefined; if (v === undefined) v = P[ch];
        if (typeof v === 'function') v = v(u, y, z); if (v == null) continue; F.set(u, y, z, v);
      }
    }
  }
}
const socket = (F, c) => { for (let u = 0; u <= 2; u++) for (let z = -1; z <= 1; z++) if (!F.has(u, 3, z)) F.set(u, 3, z, c); };
const outer = (u, u1) => u === u1 && u1 >= 3;

const ALL = [
  // ───────── the originals (world/chars.js SHOES)
  {
    id: 'classic_dad', old: 'dad', name: 'dad shoes', tier: 'common', cut: null,
    why: 'The blocky white dad runner: two-tone chunky sole, a coloured side panel and a contrast heel stripe.',
    cw: [['white / red', 0xf6f6f6, 0xd7141a, 0x1d3a8a], ['white / green', 0xf6f6f6, 0x2ecc40, 0xd7261e], ['white / grape', 0xf6f6f6, 0x5a2bd6, 0x2de2e6]],
    // [upper, side panel, heel stripe]
    build(F, [U, A, A2]) {
      last(F, { U, L: 0xd0d0d0, M: 0xefe9dc, O: 0xbdbdbd }, [
        '..UUUUL....',
        '..UUUUUUU..',
        '.MMMMMMMMM.',
        '.OOOOOOOOO.'], { toe: false, heel: 9, paint: (ch, u, y, z, u0, u1) => {
          if (z === -2 && u === 2 && y >= 2) return A2;                       // the heel stripe
          if (ch === 'U' && y === 2 && outer(u, u1) && z >= -1 && z <= 3) return A;   // the side panel
          if (ch === 'U' && y === 3 && z === 1 && u >= 1) return 0xd0d0d0;   // laces
        } });
      F.set(1, 2, 5, 0xd0d0d0); F.del(0, 2, 4); F.del(4, 2, 4); F.set(1, 2, 4, U); F.set(2, 2, 4, U); F.set(3, 2, 4, U);
      socket(F, U);
    },
  },
  {
    id: 'classic_hightop', old: 'hightop', name: 'cursor high-tops', tier: 'rare', cut: 'cut from a 7-row high-top to the ankle; the black collar sits on the y3 ring, the cursor shrinks to three rows',
    why: 'Colour-blocked court shoe with a white toe, black collar and a white cursor arrow on the outside.',
    cw: [['red', 0xd7141a, 0x121212], ['royal', 0x1d3a8a, 0x121212], ['purple', 0x5a2bd6, 0x121212]],
    // [upper, collar]
    build(F, [M, K]) {
      const W = 0xf7f7f7;
      last(F, { M, K, W }, [
        '..KKKKW....',
        '..MMMMMWW..',
        '..MMMMMWWW.',
        '..WWWWWWWW.'], { toe: false, heel: 9 });
      // the cursor arrow on the outer face: X.. / XX. / XXX (its tail runs into the white sole)
      F.paint(3, 3, 0, W); F.paint(4, 2, 0, W); F.paint(4, 2, 1, W); F.paint(4, 1, 0, W); F.paint(4, 1, 1, W); F.paint(4, 1, 2, W);
      socket(F, K);
    },
  },
  {
    id: 'classic_slides', old: 'slides', name: 'slides + socks', tier: 'common', cut: null,
    why: 'Black slides over white sports socks: a flat bed, one broad strap and two white logo dots.',
    cw: [['black / white', 0x151515, 0xf6f6f6]],
    // [bed + strap, sock]
    build(F, [K, S]) {
      last(F, { K, S, D: 0xffffff }, [
        '..SSKKK....',
        '..SSKKKKD..',
        '..SSSSSS...',
        '.KKKKKKKK..'], { toe: false, heel: 9, span: { S: (y, z) => y === 3 ? [0, 2] : [0, 3], D: [1, 2], K: (y, z) => y === 3 ? (z >= 2 ? [0, 2] : [0, 3]) : [0, 4] } });
      socket(F, S);
    },
  },
  {
    id: 'classic_foam', old: 'foam', name: 'foam runners', tier: 'rare', cut: null,
    why: 'One moulded foam blob on a rocker bottom, punched with dark vent holes down both sides.',
    cw: [['bone', 0xe9e2cf], ['lime', 0x6cf542], ['black', 0x151517], ['pink', 0xff7ab6]],
    build(F, [C]) {
      const D = shade(C, .62);
      for (let z = -2; z <= 4; z++) for (let u = 1; u <= 3; u++) F.set(u, 0, z, C);
      for (let z = 0; z <= 2; z++) { F.set(0, 0, z, C); F.set(4, 0, z, C); }
      for (let z = -3; z <= 5; z++) for (let u = 0; u <= 4; u++) if (!((u === 0 || u === 4) && (z === -3 || z === 5))) F.set(u, 1, z, C);
      for (let z = -3; z <= 5; z++) for (let u = 0; u <= 4; u++) if (!((u === 0 || u === 4) && (z === -3 || z === 5))) F.set(u, 2, z, C);
      for (let z = -2; z <= 3; z++) for (let u = 0; u <= (z >= 2 ? 2 : 3); u++) if (!(z === -2 && (u === 0 || u === 3)) && !(z === 3 && u === 0)) F.set(u, 3, z, C);
      for (const [y, z] of [[2, -1], [2, 2], [1, 4]]) { F.paint(4, y, z, D); F.paint(0, y, z, D); }   // vent holes
      F.paint(3, 3, -1, D); F.paint(3, 3, 1, D);
      socket(F, C);
    },
  },
  {
    id: 'classic_checker', old: 'checker', name: 'checker slip-ons', tier: 'common', cut: null,
    why: 'The flat skate slip-on: a white rubber sole and a black-and-white checkerboard upper, toe to heel.',
    cw: [['black / white', 0x111111, 0xf4f4f4]],
    build(F, [K, W]) {
      const ck = (u, y, z) => ((u + y + z) & 1) ? K : W;
      last(F, { c: ck, W }, [
        '..cccccc...',
        '..ccccccc..',
        '..cccccccW.',
        '..WWWWWWWW.'], { toe: false, heel: 9 });
      socket(F, W);
    },
  },
  {
    id: 'classic_button', old: 'button', name: 'button kicks', tier: 'common', cut: null,
    why: 'A grey desktop-button shoe: bevelled white and dark edges and a blue title-bar gradient down the outside.',
    cw: [['desktop grey', 0xc0c0c0, 0x000080, 0x1084d0]],
    // [face, title bar from, title bar to]
    build(F, [G, T0, T1]) {
      const lerp = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
      last(F, { G, W: 0xffffff }, [
        '..GGGGGG...',
        '..GGGGGGG..',
        '..GGGGGGG..',
        '..WWWWWWWW.'], { toe: false, heel: 9 });
      for (let z = -2; z <= 3; z++) F.paint(4, 2, z, lerp(T0, T1, (z + 2) / 5));   // the title bar
      for (let u = 0; u <= 4; u++) F.paint(u, 1, 4, 0x5e5e5e);                     // bevel: dark bottom edge
      F.paint(4, 2, 4, 0xffffff); F.paint(0, 2, 4, 0x5e5e5e); F.paint(0, 1, 4, 0x5e5e5e);
      for (let u = 0; u <= 2; u++) F.paint(u, 3, 3, 0xffffff);                     // bevel: white top edge
      for (let z = -2; z <= 3; z++) F.paint(0, 1, z, 0x5e5e5e);
      socket(F, G);
    },
  },
  {
    id: 'classic_boots', old: 'boots', name: 'work boots', tier: 'common', cut: 'cut from a 7-row boot to the ankle: the darker padded collar drops onto the y3 ring, the laces move onto the instep',
    why: 'Wheat nubuck work boots on a dark sole: a round toe box, dark laces up the front and a darker padded collar.',
    cw: [['wheat nubuck', 0xc8964a, 0x4a3020, 0x3a2616]],
    // [nubuck, sole, laces]
    build(F, [C, So, La]) {
      const D = shade(C, .72);
      last(F, { C, D, o: So }, [
        '..DDDDC....',
        '..CCCCCCCC.',
        '..CCCCCCCC.',
        '.ooooooooo.'], { heel: 9 });
      for (const [u, y, z] of [[1, 3, 2], [1, 2, 3], [3, 2, 3], [2, 2, 4], [1, 2, 5], [3, 2, 5]]) if (F.has(u, y, z)) F.paint(u, y, z, La);
      socket(F, D);
    },
  },
  {
    id: 'classic_platinum', old: 'platinum', name: 'platinum high-tops', tier: 'grail', cut: 'cut from a 7-row high-top to the ankle; the rainbow stripe keeps all six colours as a two-a-row staircase',
    why: 'Platinum-grey high-tops with a six-colour rainbow stripe climbing the outside.',
    cw: [['platinum', 0xdcdcdc, 0x9a9a9a, 0xf4f4f4]],
    // [upper, collar, sole]
    build(F, [P, K, W]) {
      last(F, { P, K, W }, [
        '..KKKKP....',
        '..PPPPPPP..',
        '..PPPPPPP..',
        '..WWWWWWWW.'], { toe: false, heel: 9 });
      [[4, 1, 3], [4, 1, 2], [4, 2, 2], [4, 2, 1], [3, 3, 1], [3, 3, 0]].forEach(([u, y, z], i) => F.paint(u, y, z, RAINBOW[i]));
      socket(F, K);
    },
  },

  // ───────── Drop 02, redrawn (world/shoes2.js)
  {
    id: 'classic_courtlow', old: 'courtlow', name: 'court lows', tier: 'common', cut: null,
    why: 'A clean leather court low: accent heel counter, collar lining and tongue, toe perfs and a square side patch.',
    cw: [['white / green', 0xf6f6f6, 0x0a5a3a, 0xefe9dc, 0xcfc6b0, 0xffffff], ['white / red', 0xf6f6f6, 0xd7141a, 0xf6f6f6, 0xd0d0d0, 0xffffff],
      ['white / navy', 0xf6f6f6, 0x1d3a8a, 0xe9e2cf, 0xa0612b, 0xffffff], ['triple black', 0x19191b, 0x2e2e33, 0x19191b, 0x0c0c0c, 0x2e2e33]],
    // [upper, accent, midsole, outsole, laces]
    build(F, [U, A, M, O, L]) {
      last(F, { h: A, v: A, k: U, T: A, u: U, l: L, c: U, m: M, o: O }, [
        'hvkkkkT....',
        '.vuuuuulcc.',
        '.mmmmmmmmm.',
        '.oooooooo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'k' && u <= 2) return A;                                          // the collar lining
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? L : shade(U, .9)) : U;
          if (ch === 'c' && u > u0 && u < u1 && ((u + z) & 1)) return shade(U, .86);   // toe perfs
          if (ch === 'm' && outer(u, u1) && (z & 1)) return shade(M, .9);             // cupsole stitch
          if (ch === 'u' && outer(u, u1) && (z === 0 || z === 1)) return A;            // the square patch
        } });
      socket(F, A);
    },
  },
  {
    id: 'classic_lugboot', old: 'lugboot', name: 'lug-sole boots', tier: 'common', cut: 'cut from a 6-row boot to the ankle: one outsole row (the lugs) under the stitched welt',
    why: 'Glossy lace-up boots on a stitched welt and a gapped lug sole, metal eyelets up the front.',
    cw: [['black / yellow stitch', 0x141414, 0xffd21f, 0x1c1c1c, 0x242424], ['brown', 0x4a2e1a, 0xe7bd4a, 0x1c1712, 0x2a1c12],
      ['cherry', 0x5a0d18, 0xefe6d2, 0x161616, 0x2a2020], ['ghost', 0xe9e6de, 0x151515, 0x1c1c1c, 0x2a2a2a]],
    // [upper, stitch, outsole, welt]
    build(F, [U, S, O, W]) {
      last(F, { h: S, k: GLOSS(shade(U, .7)), T: GLOSS(shade(U, .8)), u: GLOSS(U), l: GLOSS(U), w: W, o: O }, [
        'hkkkkkT....',
        '.uuuuullu..',
        '.wwwwwwwww.',
        '.ooo.o.oo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'w' && (u === u0 || u === u1 || z === 5 || z === -3)) return ((u + z) & 1) ? S : shade(S, .72);   // the stitched welt, all round
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? GLOSS(shade(U, .6)) : S) : METAL(0xc0c0c0);              // laces + eyelets
          if (ch === 'o' && outer(u, u1)) return shade(O, .8);
        } });
      socket(F, GLOSS(shade(U, .7)));
    },
  },
  {
    id: 'classic_chunky', old: 'chunky', name: 'chunky runners', tier: 'rare', cut: 'the flared midsole is pulled in to the u4 envelope; it rises as a ledge round the knit upper instead',
    why: 'A knit runner sunk into a thick striped midsole that wraps up its sides, a pull tab at the heel.',
    cw: [['triple white', 0xf4f4f4, 0xdcdcdc, 0xefe9dc, 0xd4d4d4, 0xb8b8b8, 0xf4f4f4], ['sail / volt', 0xefe9dc, 0x9aa0a6, 0xefe9dc, 0xc6ff3a, 0x6f757c, 0xc6ff3a],
      ['black ice', 0x1a1a1e, 0x34343a, 0x2a2a2e, 0x7cc3ff, 0x101012, 0x7cc3ff], ['bodega', 0xefe6d2, 0xd7141a, 0xefe6d2, 0x0a5a3a, 0x8a5a2b, 0xd7141a]],
    // [knit, overlay, midsole, stripe, outsole, tab/tongue]
    build(F, [U, V, M, N, O, T]) {
      const mid = (u, y, z) => (z === -2 || z === -1 || z === 2 || z === 3) ? N : M;
      last(F, { h: T, k: V, T, v: V, u: knit(U), l: U, m: mid, o: O }, [
        'hkkkkkT....',
        'hvvuuullu..',
        '.mmmmmmmmm.',
        '.oooooooo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (y === 2 && ch !== 'h' && u === 4) return mid(u, 1, z);                   // the midsole ledge wraps the upper
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? 0xffffff : T) : U;
        } });
      F.set(1, 2, 5, M); F.set(2, 2, 5, M); F.set(3, 2, 5, M);                        // the bumper climbs the toe
      socket(F, V);
    },
  },
  {
    id: 'classic_furslide', old: 'furslide', name: 'fur slides + socks', tier: 'rare', cut: 'the fur strap stops at the ankle row and its fuzz stays inside u4',
    why: 'A shaggy fur strap on a flat bed, worn over white socks.',
    cw: [['cream', 0xefe6d2, 0xf6f6f6, 0xd9ccb0], ['pink', 0xff9ccb, 0xf6f6f6, 0xe07aa8], ['brown', 0x6b4a2e, 0x151515, 0x3a2616], ['leopard', 0xd9a441, 0xf6f6f6, 0x2a1c14, 0x2a1c14]],
    // [fur, sock, bed, (spots)]
    build(F, [Fu, S, B, Sp]) {
      const fur = (u, y, z) => { const h = hash3(u + 7, y, z); if (Sp !== undefined && h % 5 === 0) return Sp; return (h & 1) ? Fu : shade(Fu, .86); };
      last(F, { s: knit(S), f: fur, b: B, o: 0x1a1a1a }, [
        '..sssfff...',
        '.sssffffff.',
        '.bbbbbbbbb.',
        '.oooooooo..'], { heel: 9, span: { s: (y, z) => y === 3 ? [0, 2] : [0, 3] },
        paint: (ch, u, y, z) => { if (ch === 'f' && u === 4 && hash3(u, y + 3, z) % 3 === 0) return null; } });   // fuzzy edge
      socket(F, fur(1, 3, 0));
    },
  },
  {
    id: 'classic_courtking', old: 'courtking', name: 'court kings', tier: 'epic', cut: 'cut from a 6-row mid: the strap and its buckle now cross the ankle ring, the white midsole row is dropped',
    why: 'A patent mudguard on a white court upper, an icy clear sole and a buckled strap across the ankle.',
    cw: [['night shift', 0x151517, 0xd7141a], ['cop car', 0x151517, 0x1d4ed8], ['money', 0x0a5a3a, 0xe7bd4a], ['royal', 0x1d4ed8, 0x151517]],
    // [patent, strap]
    build(F, [A, Bc]) {
      last(F, { h: Bc, k: A, x: Bc, t: Bc, c: GLOSS(A), u: 0xf7f7f7, l: 0xf7f7f7, o: GLOSS(0xbfe0ff) }, [
        'hkkxxxt....',
        '.cuuuullc..',
        '.ccccccccc.',
        '.oooooooo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'x' && u === u1 && z === 0) return METAL(0xdfe6ee);              // the buckle
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? 0xf7f7f7 : A) : 0xf7f7f7;
          if (ch === 'u' && outer(u, u1) && (z === 0 || z === 1)) return A;            // the step mark
        } });
      F.paint(4, 2, 2, A);
      socket(F, Bc);
    },
  },
  {
    id: 'classic_clogs', old: 'clogs', name: 'platform clogs', tier: 'epic', cut: 'the cork platform keeps two rows by dropping the thin dark outsole line',
    why: 'Suede clogs on a mottled cork platform, a dark strap with a gold buckle, socks at the open heel.',
    cw: [['taupe suede', 0x8a7a66, 0xf4f4f4], ['black', 0x1a1a1a, 0x9a9ca3], ['lilac', 0xb9a3e3, 0xf4f4f4], ['mustard', 0xd9a441, 0x3a2616]],
    // [suede, sock]
    build(F, [C, S]) {
      const cork = (u, y, z) => y === 1 ? (hash3(u, y, z) % 4 === 0 ? 0xcfb58a : 0xdcc79e) : (hash3(u, y, z) % 3 === 0 ? 0xa8895c : 0xcfb58a);
      last(F, { k: cork, u: nub(C), s: knit(S) }, [
        '..sssuuu...',
        '.ssssuuuuu.',
        '.kkkkkkkkk.',
        '.kkkkkkkk..'], { heel: 9, span: { s: (y, z) => y === 3 ? [0, 2] : [0, 3] },
        paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'u' && z === 2) return outer(u, u1) && y === 2 ? METAL(0xe7bd4a) : shade(C, .72);   // the strap + gold buckle
          if (ch === 'k' && y === 0) return hash3(u, 0, z) % 3 === 0 ? 0x8a6f48 : 0xa8895c;
        } });
      socket(F, S);
    },
  },
  {
    id: 'classic_chromes', old: 'chromes', name: 'liquid chromes', tier: 'grail', cut: 'cut from a 6-row high-top: the black gloss collar sits on the ankle ring',
    why: 'Liquid-chrome sneakers: the chrome runs down a black gloss sole in drips, with a white highlight streak.',
    cw: [['liquid silver', 0xdfe6ee], ['24k', 0xe7bd4a], ['oil slick', [0x8a3cff, 0x2b6cff, 0x2de2e6, 0x6cf542, 0xffd21f, 0xff5ea8]], ['gunmetal', 0x5a5e68]],
    build(F, [C]) {
      const ch = (u, y, z) => METAL(Array.isArray(C) ? C[((y + z + (u >> 1)) % C.length + C.length) % C.length] : (y >= 3 ? shade(C, .82) : C));
      const drip = (u, z) => { const h = hash3(z, u, 3) % 7; return h < 2 ? 2 : h < 4 ? 1 : 0; };
      last(F, { o: 0x111111, m: GLOSS(0x151515), u: ch, k: GLOSS(0x151515), T: GLOSS(0x151515), l: ch, h: ch }, [
        'hkkkkkT....',
        '.uuuuullu..',
        '.mmmmmmmmm.',
        '.oooooooo..'], { paint: (c2, u, y, z, u0, u1) => {
          if ((c2 === 'm' || c2 === 'o') && (u === u0 || u === u1 || z === -3) && drip(u, z) >= 2 - y) return ch(u, 2, z);   // the chrome runs onto the sole
          if (c2 === 'l' && u <= 2) return ((u + z) & 1) ? GLOSS(0x151515) : ch(u, y, z);
        } });
      F.paint(4, 2, 2, GLOSS(0xffffff)); F.paint(4, 2, 3, GLOSS(0xffffff)); F.paint(3, 3, 1, GLOSS(0xffffff));   // the highlight streak
      socket(F, GLOSS(0x151515));
    },
  },

  // ───────── the shoe pass's new pairs (world/shoes2.js)
  {
    id: 'classic_retrohigh', old: 'retrohigh', name: 'hardwood highs', tier: 'rare', cut: 'cut from a 6-row high-top to the ankle: the padded collar becomes the y3 ring, the hoop is drawn across three faces',
    why: 'A team-colour basketball shoe: coloured heel and toe, a padded contrast collar and the hoop ring on the side.',
    cw: [['home whites', 0xf6f6f6, 0xd7141a, 0x151517, 0xd7141a], ['night game', 0x19191b, 0x1d4ed8, 0xf6f6f6, 0x19191b],
      ['gold rush', 0xf6f6f6, 0xe7bd4a, 0x5a2bd6, 0x5a2bd6], ['court green', 0xefe9dc, 0x0a5a3a, 0x0a5a3a, 0xefe9dc]],
    // [upper, team colour, collar, outsole]
    build(F, [U, A, K, O]) {
      last(F, { h: K, k: K, T: U, v: A, u: U, l: U, c: A, m: 0xf4f4f4, o: O }, [
        'hkkkkkT....',
        '.vvuuulccc.',
        '.mmmmmmmmm.',
        '.oooooooo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'T' && u === 1) return A;                                                  // the tongue tag
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? (U === 0x19191b ? 0xf6f6f6 : 0xffffff) : A) : A;
          if (ch === 'c' && u > u0 && u < u1 && ((u + z) & 1)) return shade(A, .7);           // toe perfs
          if (ch === 'm' && (u === u0 || u === u1) && (z & 1)) return 0xdcdcdc;
        } });
      F.paint(3, 3, -1, A); F.paint(3, 3, 0, A); F.paint(3, 3, 1, A);   // the hoop: top on the collar,
      F.paint(4, 2, -1, A); F.paint(4, 2, 1, A);                        // its sides on the upper,
      F.paint(4, 1, -1, A); F.paint(4, 1, 0, A); F.paint(4, 1, 1, A);   // its foot on the midsole
      socket(F, K);
    },
  },
  {
    id: 'classic_sculptrun', old: 'sculptrun', name: 'cloud tanks', tier: 'rare', cut: 'the heel flare is pulled in to u4; the two-row sculpted midsole keeps its channel and rocker toe',
    why: 'A low knit runner on a towering sculpted midsole: a carved channel down both walls and a rocker toe.',
    cw: [['cloud white', 0xf4f4f4, 0xf4f4f4, 0xc9d3da, 0x9aa0a6, 0xc9d3da], ['lava', 0x19191b, 0xff6a00, 0x19191b, 0x19191b, 0xff6a00],
      ['glacier', 0xf4f4f4, 0xdff3ff, 0x7cc3ff, 0x7cc3ff, 0x7cc3ff], ['toxic', 0x2a2a2e, 0x19191b, 0xc6ff3a, 0xc6ff3a, 0xc6ff3a]],
    // [knit, midsole, channel, outsole, accent]
    build(F, [U, M, N, O, A]) {
      last(F, { h: N, k: A, u: knit(U), T: A, l: U, m: M, o: O }, [
        'hkuuuuTl...',
        '.mmmmmmmmm.',
        '.mmmmmmmmmm',
        '.ooooooo...'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'm' && y === 2 && (u === u1 || u === u0) && z >= -2 && z <= 3) return N;   // the carved channel, both walls
          if (ch === 'm' && y === 1 && z === 6) return N;                                       // the rocker toe tip
          if (ch === 'l') return ((u + z) & 1) ? A : U;
        } });
      socket(F, knit(U)(1, 3, 0));
    },
  },
  {
    id: 'classic_puffskate', old: 'puffskate', name: 'fat tongues', tier: 'common', cut: 'cut from a 6-row skate: the fat tongue can no longer stand above the collar, so it lolls forward over the laces',
    why: 'A puffy suede skate shoe: padded collar, fat laces and an oversized tongue, with the pip mark on the side.',
    cw: [['suede black', 0x1c1c1e, 0x2c2c30, 0x1c1c1e, 0xf4f4f4, 0xf4f4f4, 0xf4f4f4], ['tan gum', 0xc8a06b, 0xa8804b, 0xc8a06b, 0xefe6d2, 0xa0612b, 0xefe6d2],
      ['baby blue', 0x9fd8ff, 0xf4f4f4, 0xf4f4f4, 0xf4f4f4, 0x1d3a8a, 0xf4f4f4], ['grape', 0x5a2bd6, 0x6cf542, 0x5a2bd6, 0xf4f4f4, 0x151517, 0x6cf542]],
    // [suede, collar, tongue, midsole, outsole, laces]
    build(F, [U, K, T, M, O, L]) {
      last(F, { h: K, k: K, T, u: nub(U), l: U, c: M, m: M, o: O }, [
        'hkkuTTTT...',
        '.uuuuullc..',
        '.mmmmmmmmc.',
        '.oooooooo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? L : shade(L, .82)) : U;
          if (ch === 'm' && outer(u, u1)) return shade(M, .9);
          if (ch === 'u' && outer(u, u1) && y === 2 && (z === -1 || z === 0)) return M;   // the pip
        } });
      F.paint(2, 3, 2, shade(T, .85)); F.paint(0, 3, 2, shade(T, .92));
      socket(F, K);
    },
  },
  {
    id: 'classic_tacboot', old: 'tacboot', name: 'field ops', tier: 'common', cut: 'cut from a 6-row boot to the ankle: one lugged outsole row, the D-ring moves onto the collar',
    why: 'A knit tactical boot: rubber rand at toe and heel, dark laces on speed hooks, a lugged sole and a D-ring.',
    cw: [['coyote', 0xc2a878, 0x6b5a3a, 0x3a3026, 0x8a7654], ['black', 0x232326, 0x121214, 0x121214, 0x2e2e33],
      ['olive', 0x5a6b4a, 0x2f3a28, 0x1f2419, 0x4a5a3a], ['urban grey', 0x8e8e94, 0x2e2e33, 0x1e1e20, 0x5e5e64]],
    // [knit, rand, outsole, collar]
    build(F, [U, C, O, K]) {
      last(F, { h: C, k: K, T: K, u: knit(U), l: U, c: C, o: O }, [
        'hkkkkkT....',
        '.cuuuullc..',
        '.ccuuuuccc.',
        '.oo.oo.oo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? 0x111111 : K) : METAL(0x3a3a3a);   // laces + speed hooks
        } });
      F.paint(3, 3, -1, METAL(0x3a3a3a));   // the D-ring
      socket(F, K);
    },
  },
  {
    id: 'classic_lugloafer', old: 'lugloafer', name: 'lug loafers', tier: 'rare', cut: null,
    why: 'A glossy penny loafer on a chunky lug sole, a gold coin in the strap and a white sock at the ankle.',
    cw: [['black patent', 0x111113, 0x111113, 0xf4f4f4], ['oxblood', 0x5a0d18, 0x151515, 0xf4f4f4], ['chocolate', 0x4a2e1a, 0x1c1712, 0xe9e2cf], ['cream / black sole', 0xefe6d2, 0x151515, 0x151517]],
    // [leather, sole, sock]
    build(F, [U, O, S]) {
      last(F, { u: GLOSS(U), x: GLOSS(shade(U, .8)), s: knit(S), o: O }, [
        '.uusssxx...',
        '.uuuuuxxuu.',
        '.ooooooooo.',
        '.oo.o.ooo..'], { span: { s: [0, 2] }, paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'x' && y === 3 && z === 2 && u >= 1) return METAL(0xe7bd4a);           // the coin in the strap's slot
          if (ch === 'x' && y === 3 && z === 3) return GLOSS(shade(U, .55));
          if (ch === 'o' && y === 1 && (u === u0 || u === u1) && (z & 1)) return shade(O, 1.8);   // the welt stitch
        } });
      socket(F, knit(S)(1, 3, 0));
    },
  },
  {
    id: 'classic_splittoe', old: 'splittoe', name: 'split toes', tier: 'epic', cut: null,
    why: 'A tabi split-toe: the big toe parted from the rest by a real gap, a metal zip up the heel.',
    cw: [['ivory', 0xefe9dc, 0xefe9dc, 0xb8ab90], ['black', 0x151517, 0x151517, 0x0a0a0a], ['blood red', 0x9e1020, 0x2a0a0e, 0x151515], ['sand', 0xc8b58a, 0xe0d2ac, 0x8a7a55]],
    // [upper, midsole, outsole]
    build(F, [U, M, O]) {
      last(F, { g: METAL(0xc0c0c0), u: U, m: M, o: O }, [
        '.guuuuu....',
        '.uuuuuuuuu.',
        '.mmmmmmmmm.',
        '.oooooooo..'], { span: { g: [1, 2] }, paint: (ch, u, y, z) => {
          if (u === 2 && z >= 4 && y >= 1) return null;          // THE SPLIT: big toe (u0-1) and the rest (u3-4)
          if (u === 2 && z === 3 && y === 2) return shade(U, .7); // the seam, down to the split
          if (ch === 'g' && ((y + u) & 1)) return U;
        } });
      F.set(0, 2, 5, U); F.set(1, 2, 5, U); F.set(3, 2, 5, U); F.set(4, 2, 5, U);   // both toe boxes stay square to the split
      F.del(4, 2, 5); F.del(0, 2, 5);
      socket(F, U);
    },
  },
  {
    id: 'classic_socksneak', old: 'socksneak', name: 'sock runners', tier: 'epic', cut: 'cut from a 6-row sock collar to the ankle: the ribbed cuff becomes the y3 ring',
    why: 'A knit sock upper on a ribbed moulded sole, one rib down the vamp and a ribbed cuff at the ankle.',
    cw: [['all black', 0x19191b, 0x19191b, 0x0c0c0c, 0x34343a], ['black / white sole', 0x19191b, 0xf4f4f4, 0xdcdcdc, 0xf4f4f4],
      ['red', 0xc0272d, 0xc0272d, 0x7a1418, 0x19191b], ['triple white', 0xf4f4f4, 0xf4f4f4, 0xdcdcdc, 0xd4d4d4]],
    // [knit, midsole, outsole, rib]
    build(F, [S, M, O, R]) {
      last(F, { r: R, s: knit(S), k: GLOSS(shade(M, .85)), m: M, o: O }, [
        '..rrrrs....',
        '.ksssssss..',
        '.mmmmmmmmm.',
        '.oooooooo..'], { span: { r: [0, 2] }, paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'm' && (u === u0 || u === u1) && ((z + y) & 1)) return shade(M, .84);   // the moulded ribs
          if (ch === 's' && y === 2 && u === 1 && z >= 3) return R;                          // the rib down the vamp
        } });
      F.set(3, 3, -2, knit(S)(3, 3, -2)); F.set(3, 3, -1, knit(S)(3, 3, -1)); F.set(3, 3, 0, knit(S)(3, 3, 0));
      socket(F, R);
    },
  },
  {
    id: 'classic_workboot', old: 'workboot', name: 'yard boots', tier: 'rare', cut: 'cut from a 6-row boot to the ankle: the padded collar becomes the y3 ring, the tongue flops over the laces',
    why: 'Nubuck yard boots on a stitched welt: a padded collar, gold laces on metal hooks and a tongue flopping out.',
    cw: [['wheat', 0xc8964a, 0x6b4a2e, 0x3a2616, 0xb07a3a], ['black', 0x232326, 0x121214, 0x121214, 0x2e2e33],
      ['blood', 0x5a1420, 0x2e0a10, 0x1a1a1a, 0x8a5a2b], ['olive', 0x5a6b4a, 0x2f3a28, 0x2a2016, 0xb8a47a]],
    // [nubuck, collar, outsole, welt]
    build(F, [U, P, O, W]) {
      last(F, { h: P, P, T: nub(U), u: nub(U), l: nub(U), w: W, o: O }, [
        'hPPPPPTT...',
        '.uuuuullu..',
        '.wwwwwwwww.',
        '.oooooooo..'], { paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'T' && u === 1) return P;                                                // the tongue's tab
          if (ch === 'l') return u <= 2 ? (((u + z) & 1) ? 0xe7bd4a : U) : METAL(0xb08840);  // gold laces, metal hooks
          if (ch === 'w' && (u === u0 || u === u1 || z === 5) && (z & 1)) return shade(W, 1.25);   // welt stitch
          if (ch === 'o' && (u === u0 || u === u1) && !(z & 1)) return shade(O, .7);
        } });
      socket(F, P);
    },
  },
  {
    id: 'classic_sandalsocks', old: 'sandalsocks', name: 'dad sandals + socks', tier: 'common', cut: 'the sock tube stops at the ankle row',
    why: 'Hook-and-loop hiking sandals strapped over thick socks, on a stitched footbed.',
    cw: [['hiker', 0x19191b, 0x9a9ca3, 0x3a3026, 0x19191b], ['tourist', 0x6b4a2e, 0xf4f4f4, 0xcfb58a, 0x3a2616],
      ['rave', 0x6cf542, 0xff9ccb, 0x19191b, 0x19191b], ['tie-dye', 0x1d3a8a, 0xff7ab6, 0x2a2a2e, 0x19191b]],
    // [strap, sock, footbed, outsole]
    build(F, [X, S, B, O], i) {
      const DYE = [0xff7ab6, 0xffd21f, 0x6cf542, 0x2de2e6, 0x8a3cff];
      const sock = i === 3 ? (u, y, z) => DYE[((y * 2 + z + u) % 5 + 5) % 5] : knit(S);
      last(F, { s: sock, x: X, b: B, o: O }, [
        '..sssx.....',
        '.xssssxsx..',
        '.bbbbbbbbb.',
        '.oooooooo..'], { heel: 9, span: { s: (y, z) => y === 3 ? [0, 2] : [0, 3] }, paint: (ch, u, y, z, u0, u1) => {
          if (ch === 'x' && outer(u, u1) && y === 2) return shade(X, .7);              // the hook-and-loop tabs
          if (ch === 'b' && (u === u0 || u === u1) && (z & 1)) return shade(B, 1.25);
        } });
      F.set(1, 2, 5, sock(1, 2, 5)); F.set(2, 2, 5, sock(2, 2, 5));   // the sock's toes past the front strap
      socket(F, sock(1, 3, 0));
    },
  },
  {
    id: 'classic_bulbs', old: 'bulbs', name: 'moon bulbs', tier: 'grail', cut: 'the bulb toe is halved (four rows to two) and pulled inside u4; the heel wings fold onto the heel',
    why: 'One pair exists: cartoon bulb toes on a lit sole, with heel wings. Worn once on Fit Street, then robbed.',
    cw: [['moon white', 0xf4f4f4, 0x7cc3ff, 0xe7bd4a, 0x7cc3ff], ['bubblegum', 0xff7ab6, 0xff4fa3, 0xdfe6ee, 0xf4f4f4],
      ['toxic', 0x6cf542, 0x9cff7a, 0xdfe6ee, 0x151517], ['midnight', 0x151517, 0xff2424, 0xe7bd4a, 0xff2424]],
    // [bulb, lit sole, wings, collar]
    build(F, [U, L, W, K]) {
      last(F, { o: 0x151515, L: LIT(L), u: GLOSS(U), k: GLOSS(K) }, [
        '...kkkuuu..',
        '.kkuuuuuuuu',
        '.LLLLLLLLLL',
        '.oooooooo..'], { heel: 2, span: { k: (y, z) => y === 3 ? [0, 2] : [0, 3] } });   // a low heel, so the bulb toe is the crown of the shoe
      F.paint(1, 3, 3, 0xffffff, 1); F.paint(4, 2, 3, 0xffffff, 1);   // a cartoon highlight
      F.set(4, 2, -4, METAL(W)); F.set(3, 2, -4, METAL(W)); F.set(4, 2, -3, METAL(W)); F.set(4, 1, -4, METAL(W));   // the heel wing
      socket(F, GLOSS(K));
    },
  },
];

// Tall shoes cut to the ankle are kept only if they still read as themselves. Not kept (drawn above for the record, never registered):
export const NOT_KEPT = {
  classic_bulbs: 'the cartoon bulb toe needs four rows of dome; cut to the y3 ankle row it reads as a white sneaker on a lit sole, not the moon bulbs',
};
export const DESIGNS = ALL.filter(d => !NOT_KEPT[d.id]);

// Build every colorway once, as per-foot cell lists.
const built = new Map();
export function footCells(id, cw = 0) {
  const t = ALL.find(d => d.id === id); if (!t) return null;
  const i = ((cw | 0) % t.cw.length + t.cw.length) % t.cw.length, key = `${id}#${i}`;
  if (!built.has(key)) { const F = pad(); t.build(F, t.cw[i].slice(1), i); built.set(key, Object.freeze([...F.cells.values()].map(q => Object.freeze(q)))); }
  return built.get(key);
}

// Catalog view (plain data). collection 'classic' drives the Trait Studio's classic origin.
export const CLASSIC_SHOES = Object.fromEntries(DESIGNS.map(({ build, ...t }) => [t.id, { ...t, category: 'shoes', collection: 'classic' }]));

// Install after the legacy adapter: native rigid feet, like the Opus drop. The legacy ids stay as they were.
export function installClassicShoes({ SHOES, NEWT, NEWI, NAMES }) {
  for (const t of Object.values(CLASSIC_SHOES)) {
    const { id, name, tier, cw, why } = t;
    NEWT.shoes[id] = [name, tier, cw, why];
    NEWI[id] = { id, slot: 'shoes', name, tier, cw, why, new: true, origin: 'lower', collection: 'classic' };
    NAMES.shoes[id] = name;
    SHOES[id] = (grid, p = {}) => {
      for (const side of [-1, 1]) for (const [u, y, z, c, l] of footCells(id, p.cw)) grid.set(side < 0 ? -2 - u : 1 + u, y, z, c, l);
    };
  }
}
