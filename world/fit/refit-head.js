// REFIT · HEAD (refit agent 4, 2026-09-30): eyewear, the face's extras (laser, gum, pout, lolli, the bandaid), hats' edges and
// ear flaps, and the ear items, refitted to the fitting contract (world/fit/contract.js: eyewear 1 proud, mouth pieces 1, face ink 0,
// every piece face-connected). Same ids, same colourways; chars.js installs it with one call after the jewellery pass:
//   installHead({ EYE, MOUTH, EYEWEAR, HATS, EARS, MARKS, faceGrid, cwOf })
// Coordinates as chars.js: head x −8…7, y 19…33, z −7…7 (the face is z 7, the eyes' grid y 23…26, brows 27…29, nose (−1…0, 22, 8)),
// ears x −10…−9 and 8…9, y 23…27, z −1…1. The face grid (F) is the eyes + mouth; faceGrid.fx(F, sk, L, closed) runs at its end.
//
// EYEWEAR · everything at z 8 (1 proud of the face), never z 9. The arms are one row, inlaid in the head's side column (x −8 / 7,
//   z −1…7: flush, under any hair, into the ear's root), joined to the frame's outer corner at z 8. No frame cell sits on the nose
//   (x −1…0, y 23 stays open: the bridge arches). Under eyewear the face's own 1-proud bits in the eye region (brows, lids, tears)
//   lie flat at z 7, so the frame sits on the face instead of stacking on them.
// FACE · laser: the eyes burn (lit core) and throw a lens-flare beam flat along the face and out past the temples, 1 proud (the
//   proposal: a beam that reads as an effect, in the face plane, never a 22-voxel rod out of the head). gum: a flat bubble 1 proud
//   with a rim and a glint. pout: lips 1 proud. lolli: a flat candy disc 1 proud on its stick. bandaid: flush across the cheeks and
//   laid over the nose (0 proud of what it sits on).
// HATS · durag: no skull clip (the band lies on the forehead, not over a hollow), closed corners, a straight tail; beret: a flat
//   stepped disc and a face-connected brush; tiedana: the knot's tips joined. Covering hats (contract EARS_COVERED) draw their own ear
//   flaps in their own fabric: a panel down the side of the head over the ear (the ear keeps its bump), rounded at the bottom, so the
//   layers pass (layers.js earFlaps) finds nothing left to do.
// EARS · an ear item draws only where the ear is: a side whose item would land on hair or a hat is left off (the ear is under it);
//   every piece meets the lobe (the lobe cell it hangs from takes its metal: it goes through the ear); the cross hangs beside the lobe.

const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const lerp = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const K = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256);
const cellAt = (G, x, y, z) => { const k = K(x, y, z); for (let i = 0; i < G.L.length; i++) if (G.L[i].has(k)) return [G.L[i].get(k), i]; return null; };
const inHead = (x, y, z) => x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7;
const inEar = (x, y, z) => (x === -10 || x === -9 || x === 8 || x === 9) && y >= 23 && y <= 27 && z >= -1 && z <= 1;

// ── eyewear
// arms: one row at y, inlaid in the head's side column from the frame's corner (z 8, drawn by the design) back into the ear's root
const arms = (H, y, c, l = 1) => { for (let z = -1; z < 8; z++) { H.set(-8, y, z, c, l); H.set(7, y, z, c, l); } };
const mirror = (H, cells, c, l) => { for (const [x, y] of cells) { H.set(x, y, 8, c, l); H.set(-1 - x, y, 8, c, l); } };
function eyewear(cwOf) { return {
  shutter(H, p) { const C = p.c ?? 0xf7f7f7;
    for (let x = -7; x < -1; x++) for (const y of [23, 25, 27]) mirror(H, [[x, y]], C, 1);
    for (let y = 23; y < 28; y++) mirror(H, [[-7, y], [-2, y]], C, 1);
    mirror(H, [[-1, 26], [-8, 26]], C, 1); arms(H, 26, C); },
  wrap(H) { const cs = [0x2b6cff, 0x8a3cff, 0xff5ea8, 0xffb03a];
    for (let x = -8; x < 8; x++) { const t = (x + 8) / 15, i = Math.min(2, Math.floor(t * 3)), c = lerp(cs[i], cs[i + 1], t * 3 - i);
      for (let y = 24; y < 27; y++) if (!(y === 24 && (x === -1 || x === 0))) H.set(x, y, 8, c, 1); H.set(x, 27, 8, 0x111111, 1); }
    arms(H, 26, 0x111111); },
  ovals(H) { const K0 = 0x0c0c0e; for (let x = -7; x < -2; x++) for (const y of [24, 25]) mirror(H, [[x, y]], K0, 1);
    mirror(H, [[-2, 25], [-1, 25], [-8, 25]], K0, 1); arms(H, 25, K0); },
  dwi(H) { const K0 = 0x0a0a0a; ['XXXXXXXXXXXXXXXX', '.XXXXXX..XXXXXX.', '..XXXX....XXXX..', '...XX......XX...'].forEach((r, j) => { for (let i = 0; i < 16; i++) if (r[i] === 'X') H.set(-8 + i, 27 - j, 8, K0, 1); });
    for (const [x, y] of [[-6, 26], [2, 26], [-5, 25], [3, 25]]) H.set(x, y, 8, 0xffffff, 1); arms(H, 27, K0); },
  cursorshades(H) { const K0 = 0x0a0a0a, rows = ['K....', 'KK...', 'KKK..', 'KKKK.', 'KKKKK'];
    for (const x0 of [-7, 2]) rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'K') H.set(x0 + i, 27 - j, 8, K0, 1); });
    H.set(-6, 25, 8, 0xffffff, 1); H.set(3, 25, 8, 0xffffff, 1); for (let x = -4; x < 2; x++) H.set(x, 25, 8, K0, 1);
    H.set(-8, 23, 8, K0, 1); H.set(7, 23, 8, K0, 1); arms(H, 23, K0); },
  anaglyph(H) { const W = 0xf4f4f4;
    for (let x = -8; x < 8; x++) { H.set(x, 27, 8, W, 0); if (x !== -1 && x !== 0) H.set(x, 23, 8, W, 0); }
    for (let y = 23; y < 28; y++) for (const x of [-8, -2, 1, 7]) H.set(x, y, 8, W, 0);
    for (let x = -7; x < -2; x++) for (let y = 24; y < 27; y++) { H.set(x, y, 8, 0xe0182d, 1); H.set(-1 - x, y, 8, 0x16c8e8, 1); }
    for (let y = 24; y < 27; y++) { H.set(-1, y, 8, W, 0); H.set(0, y, 8, W, 0); } arms(H, 26, W, 0); },
  shield(H, p) { const [, A, Bc] = cwOf('shield', p);
    for (let x = -9; x < 9; x++) for (let y = 23; y < 28; y++) { if (y === 23 && x > -3 && x < 2) continue; H.set(x, y, 8, lerp(Bc, A, (y - 23) / 4), 2); }
    for (let x = -8; x < 8; x++) H.set(x, 28, 8, 0x111111, 1); arms(H, 27, 0x111111); },
  tinies(H, p) { const [, Ln, F] = cwOf('tinies', p);
    for (const x0 of [-6, 3]) { H.box(x0, 24, 8, x0 + 3, 26, 9, Ln, 1);
      for (const y of [24, 25]) { H.set(x0 - 1, y, 8, F, 2); H.set(x0 + 3, y, 8, F, 2); } for (let x = x0; x < x0 + 3; x++) { H.set(x, 26, 8, F, 2); H.set(x, 23, 8, F, 2); } }
    for (let x = -2; x < 2; x++) H.set(x, 25, 8, F, 2); H.set(-8, 25, 8, F, 2); H.set(7, 25, 8, F, 2); arms(H, 25, F, 2); },
  // ski goggles: a frame 1 proud round a recessed lens (the lens lies in the face, z 7), one strap row round the head's shell
  goggles(H, p) { const [, A, Fr, St] = cwOf('goggles', p);
    for (let x = -9; x < 9; x++) for (let y = 23; y < 28; y++) { if (y === 23 && x > -3 && x < 2) continue;
      const edge = x === -9 || x === 8 || y === 23 || y === 27;   // (one lens over a nose notch)
      if (edge) H.set(x, y, 8, Fr, 1); else if (x >= -8 && x <= 7) H.set(x, y, 7, lerp(shade(A, .55), A, (y - 23) / 4), 2); }
    for (let z = -8; z < 8; z++) { H.set(-9, 26, z, St); H.set(8, 26, z, St); } for (let x = -9; x < 9; x++) H.set(x, 26, -8, St); },
}; }

// draw a design, then lift what it meets: hair at z 8…9 touching the frame (a fringe) steps back off it, so the frame never butts
// into hair in its own plane. (Not under a balaclava: its shell is the hat's; a cell at (0, 18, 8) is only ever the balaclava's skirt.)
function wrapEyewear(draw, Grid) { return (H, p) => { const G = new Grid(); draw(G, p); const fr = new Set();
  for (let li = 0; li < G.L.length; li++) for (const [k, c] of G.L[li]) { const x = (k >> 18) - 256, y = ((k >> 9) & 511) - 256, z = (k & 511) - 256; H.set(x, y, z, c, li); if (z === 8) fr.add(K(x, y, 8)); }
  if (H.has(0, 18, 8)) return;
  for (const k of fr) { const x = (k >> 18) - 256, y = ((k >> 9) & 511) - 256;
    if (H.has(x, y, 9) && !G.has(x, y, 9)) H.del(x, y, 9);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b; if (Y > 28 || fr.has(K(X, Y, 8))) continue; for (const z of [8, 9]) if (H.has(X, Y, z) && !G.has(X, Y, z)) H.del(X, Y, z); } } }; }

// ── the face grid's extras (faceGrid.fx, after the eyes and the mouth are drawn)
const LASER = [0xff2424, 0xff8080], HOT = 0xfff1e8;
function faceFx(F, sk, L, closed) {
  const move = (x, y) => { const c = cellAt(F, x, y, 8); if (!c) return; F.del(x, y, 8); if (!F.has(x, y, 7)) F.set(x, y, 7, c[0], c[1]); };
  // under eyewear: the eye region's 1-proud bits (brows, lids, tears) lie flat, so the frame rests on the face
  if (L.eyewear && L.eyewear.id !== 'none') for (const k of [...F.L.flatMap(M => [...M.keys()])]) { const x = (k >> 18) - 256, y = ((k >> 9) & 511) - 256, z = (k & 511) - 256;
    if (z === 8 && y >= 20 && !(y === 22 && (x === -1 || x === 0))) move(x, y); }
  // laser eyes: a lit core in each eye and a flare beam flat along the face (z 8), out past the temples
  if (L.eyes === 'laser' && !closed) for (const s of [0, 1]) { const X = x => s ? -1 - x : x;
    for (const x of [-6, -5]) for (const y of [24, 25]) F.set(X(x), y, 8, HOT, 3);
    for (let x = -7; x >= -12; x--) for (const y of x >= -9 ? [24, 25] : [25]) F.set(X(x), y, 8, LASER[(x >> 1) & 1], 3);
    for (const x of [-4, -3]) F.set(X(x), 25, 8, LASER[1], 3);
    for (const x of [-6, -5]) { F.set(X(x), 26, 8, LASER[0], 3); F.set(X(x), 23, 8, LASER[0], 3); }
    F.set(X(-6), 27, 8, LASER[1], 3); F.set(X(-5), 22, 8, LASER[1], 3); }
  // pout: the lips 1 proud (no second layer)
  if (L.mouth === 'pout') { for (let x = -3; x < 3; x++) F.del(x, 20, 9); F.set(-2, 21, 8, shade(sk.lip, 1.12), 1); F.set(1, 21, 8, shade(sk.lip, 1.12), 1); }
  // bubble gum: a flat bubble over the mouth, 1 proud: a rim a shade darker, a glint
  if (L.mouth === 'gum') { for (let x = -4; x < 4; x++) for (let y = 16; y < 24; y++) for (let z = 8; z < 14; z++) { const c = cellAt(F, x, y, z); if (c && c[0] === 0xff7ab6) F.del(x, y, z); }
    const G = 0xff7ab6; for (let x = -3; x < 3; x++) for (let y = 17; y < 22; y++) { const d = ((x + .5) / 2.9) ** 2 + ((y - 19) / 2.6) ** 2; if (d > 1) continue;
      F.set(x, y, 8, d > .55 ? shade(G, .86) : G, 1); }
    F.set(-2, 20, 8, 0xffffff, 1); F.set(-1, 21, 8, 0xffd0e6, 1); }
  // lollipop: the candy a flat disc on its stick, 1 proud
  if (L.mouth === 'lolli') { for (let x = 4; x < 10; x++) for (let y = 17; y < 24; y++) for (let z = 7; z < 11; z++) { const c = cellAt(F, x, y, z); if (c && (c[0] === 0xff3b6b || c[0] === 0xffffff)) F.del(x, y, z); }
    for (let x = 2; x < 5; x++) F.set(x, 20, 8, 0xf2f2f2);
    for (let x = 5; x < 10; x++) for (let y = 18; y < 24; y++) { const d = ((x - 7) / 2.3) ** 2 + ((y - 20.5) / 2.6) ** 2; if (d <= 1) F.set(x, y, 8, ((x + y) & 1) ? 0xff3b6b : 0xffffff, 1); } }
  // the bandaid lies over the nose (the plaster follows it; the rest of the strip is flush on the cheeks)
  if (L.mark === 'bandaid') { F.set(-1, 22, 8, 0xd9b58a); F.set(0, 22, 8, 0xd9b58a); }
}

// ── hats
// an ear flap in the hat's own fabric: a panel down the head's side (x −9 / 8) from the hat's lower edge (top, exclusive) to y 22,
// over the ear (whose shape stays as a bump in the fabric), rounded at the bottom. col(x, y, z) → [colour, layer]
function flaps(H, top, col) { for (const s of [-1, 1]) { const sx = s < 0 ? -9 : 8, ex = s < 0 ? -10 : 9;
  for (let y = 22; y < top; y++) { const hw = y >= 24 ? 3 : y === 23 ? 2 : 1; for (let z = -hw; z <= hw; z++) { const [c, l] = col(sx, y, z); H.set(sx, y, z, c, l); } }
  for (let y = 23; y < 28; y++) for (let z = -1; z < 2; z++) { const [c, l] = col(ex, y, z); H.set(ex, y, z, c, l); } } }
const faceStair = (pts) => { const out = []; let p = null; for (const q of pts) { if (p) { const d = [0, 1, 2].filter(i => q[i] !== p[i]); if (d.length > 1) { const c = p.slice(); c[d[0]] = q[d[0]]; out.push(c); } } out.push(q); p = q; } return out; };
function hats(HATS, cwOf) { const o = {};
  o.durag = (H, p) => { const C = p.c ?? 0x16161a, Sh = shade(C, 1.9), sh = (x, y, z) => ((x * 3 + y * 5 + z * 7) % 9 === 0) ? Sh : C;
    H.box(-9, 33, -8, 9, 35, 8, sh, 1); H.box(-9, 28, -8, -8, 33, 8, sh, 1); H.box(8, 28, -8, 9, 33, 8, sh, 1); H.box(-9, 24, -8, 9, 33, -7, sh, 1); H.box(-9, 30, 8, 9, 33, 9, sh, 1);
    H.box(-3, 27, -10, 3, 30, -8, C, 1); for (let y = 12; y < 27; y++) H.box(-2, y, -10, 2, y + 1, -9, y === 12 ? shade(C, 1.35) : ((y & 3) === 0 ? sh(1, 0, 0) : C), 1);
    flaps(H, 28, (x, y, z) => [sh(x, y, z), 1]); };
  o.beret = (H) => { const B = 0x151515; H.clip((x, y) => y >= 33);
    H.box(-9, 33, -8, 9, 34, 9, B);   // (the band, round the crown)
    const disc = (y, rx, rz) => { for (let x = -12; x < 11; x++) for (let z = -11; z < 11; z++) if (((x + 1.5) / rx) ** 2 + ((z + .5) / rz) ** 2 <= 1) H.set(x, y, z, B); };
    disc(34, 10.6, 9.9); disc(35, 10.6, 9.9); disc(36, 9.3, 8.6);
    H.box(-1, 37, -1, 1, 39, 1, B);
    const st = []; for (let i = 0; i < 9; i++) st.push([9 + Math.floor(i / 3), 34 + i, 0]); faceStair(st).forEach(([x, y, z]) => H.set(x, y, z, 0xe0b050, 2));
    H.box(11, 43, -1, 13, 46, 1, 0x3a2616); H.box(12, 46, -1, 14, 48, 1, 0xd7141a); };
  for (const id of ['beanie', 'skully']) { const f = HATS[id], top = id === 'beanie' ? 31 : 32;
    o[id] = (H, p, sk) => { f(H, p, sk); const a = cellAt(H, 0, top, 8), b = cellAt(H, 1, top, 8); flaps(H, top, (x, y, z) => { const [c, l] = ((z & 1) ? b : a) || a; return [y === 22 ? shade(c, .82) : c, l]; }); }; }
  { const f = HATS.silkrag; o.silkrag = (H, p, sk) => { f(H, p, sk); const [, C] = cwOf('silkrag', p), Lt = shade(C, 1.5), D = shade(C, .66), sh = (x, y, z) => ((x + y * 2 + z) % 7 === 0) ? Lt : (((x * 2 + y + z) % 9 === 0) ? D : C);
    flaps(H, 27, (x, y, z) => [sh(x, y, z), 1]); }; }
  { const f = HATS.fuzzbucket; o.fuzzbucket = (H, p, sk) => { f(H, p, sk); const a = cellAt(H, -9, 31, 0) || [0xf4f4f4, 0], b = cellAt(H, -9, 32, 1) || a;
    flaps(H, 29, (x, y, z) => ((x * 7 + y * 3 + z * 5) & 3) ? a : b); }; }
  { const f = HATS.tiedana; o.tiedana = (H, p, sk) => { f(H, p, sk); const [, C] = cwOf('tiedana', p); H.set(-5, 34, 9, C); H.set(4, 34, 9, C); }; }
  return o; }

// ── ears
// wrap an ear item: draw it on a scratch grid; per side, leave it off if any piece would land on hair or a hat (the ear is under it),
// otherwise draw it and give the lobe cell it hangs from (the ear's lowest row, y 23, next to the piece) the piece's metal
function wrapEar(draw, Grid) { return (H, p) => {
  const G = new Grid(); for (let x = -11; x <= 10; x++) for (let y = 22; y <= 28; y++) for (let z = -2; z <= 2; z++) if (inEar(x, y, z) && H.has(x, y, z)) G.set(x, y, z, H.get(x, y, z));   // (the ear, so the item's own checks see it)
  const before = new Set(G.keys()); draw(G, p);
  for (const s of [-1, 1]) { const mine = []; for (let li = 0; li < G.L.length; li++) for (const [k, c] of G.L[li]) { const x = (k >> 18) - 256, y = ((k >> 9) & 511) - 256, z = (k & 511) - 256;
      if ((x < 0) !== (s < 0)) continue; if (before.has(k) && cellAt(H, x, y, z)?.[0] === c) continue; mine.push([x, y, z, c, li]); }
    if (!mine.length) continue;
    if (mine.some(([x, y, z]) => H.has(x, y, z) && !inHead(x, y, z) && !inEar(x, y, z))) continue;   // (on hair or a hat: the ear is under it)
    for (const [x, y, z, c, li] of mine) { H.set(x, y, z, c, li); const v = G.jw?.get(K(x, y, z)); if (v !== undefined) (H.jw ||= new Map()).set(K(x, y, z), v); }
    const ex = s < 0 ? -10 : 9, px = s < 0 ? -11 : 10; for (const z of [1, 0, -1]) { const m = mine.find(v => v[0] === px && v[1] === 23 && v[2] === z) || mine.find(v => v[0] === ex && v[1] === 22 && v[2] === z);
      if (m && H.has(ex, 23, z)) { H.set(ex, 23, z, m[3], m[4]); break; } } } }; }
// the cross: hung beside the lobe (on the ear's outer face), crossbar front to back; a plain huggie on the right
function crossEar(cwOf, metal) { return (H, p) => { const [, G, l] = cwOf('cross', p), P = metal(l === 1 ? 0xdfe6ee : G), c = y => (y & 1) ? P[0] : P[1];
  if (H.has(-10, 24, 0)) { for (let y = 17; y < 24; y++) H.set(-11, y, 1, c(y), l === 1 ? 1 : 2); H.set(-11, 20, 0, c(20), 2); H.set(-11, 20, 2, c(20), 2); }
  if (H.has(9, 24, 0)) { H.set(10, 23, 1, P[0], 2); H.set(10, 22, 1, P[1], 2); } }; }
// the headphones' band: a face-connected arc over whatever is on the head
function phones() { return (H, p) => { const C = p.c ?? 0xd32f2f, K0 = 0x151515, top = H.maxY((x, y, z) => Math.abs(x + .5) < 4 && z > -6 && z < 6) + 1;
  H.box(-13, 21, -3, -10, 30, 4, C, 1); H.box(10, 21, -3, 13, 30, 4, C, 1); H.box(-10, 22, -2, -9, 29, 3, K0); H.box(9, 22, -2, 10, 29, 3, K0);
  const pts = []; for (let a = 0; a <= Math.PI; a += 0.01) { const q = [Math.floor(-0.5 + 11.5 * Math.cos(a)), Math.round(29 + (top - 29) * Math.sin(a))]; const l = pts[pts.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) pts.push(q); }
  const path = []; for (const q of pts) { const l = path[path.length - 1]; if (l && l[0] !== q[0] && l[1] !== q[1]) path.push([q[0], l[1]]); path.push(q); }
  for (const [x, y] of path) for (const z of [0, 1]) H.set(x, y, z, K0, 1); }; }

// ── install
export function installHead(t) { const { EYE, EYEWEAR, HATS, EARS, MARKS, faceGrid, cwOf, Grid } = t;
  for (const [id, f] of Object.entries(eyewear(cwOf))) EYEWEAR[id] = wrapEyewear(f, Grid);
  if (EYE.laser) EYE.laser.laser = false;   // (the old beam: z 8…29; the flare is drawn by faceFx)
  faceGrid.fx = faceFx;
  MARKS.bandaid = H => { for (let x = -4; x < 4; x++) if (x < -1 || x > 0) H.set(x, 22, 7, 0xe8c9a0); for (const x of [-4, 3]) H.set(x, 23, 7, 0xe8c9a0); };
  Object.assign(HATS, hats(HATS, cwOf));
  const metal = G => [G, shade(G, .8)];
  EARS.cross = crossEar(cwOf, metal); EARS.phones = phones();
  for (const id of Object.keys(EARS)) if (id !== 'phones') EARS[id] = wrapEar(EARS[id], Grid);
}
