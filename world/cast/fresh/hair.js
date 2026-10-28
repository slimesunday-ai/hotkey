// FRESH REGISTRY · hair (slot 'hair'). This file has exactly one owner: the hair designer. Nobody else edits it.
// The entry shape and every construction rule for this slot: world/fresh/README.md § Hair. Helpers: the `ctx` passed to your draw,
// or `import { … } from './kit.js'` (the only import allowed here). One entry per trait, keyed by its id (a-z, 0-9, _; not 'none'
// or 'base'). ONE colour scheme per trait: no colourways, no colour parameters; the studio shows exactly what you draw.
// Check your work: README.md § Checks (the audit, the combo check, the see-through gate, the studio sweep).
//
// HOW THIS FILE BUILDS HAIR
// · Hair is grown OFF the head and never replaces a head voxel: a hat's cover deletes hair, and a hair voxel standing in for skin
//   would leave a dent. Flat detail (a shaved part, a centre part, laid edges) is fine paint on the skin or on the hair.
// · Every style keeps out of: the face below the hairline (z ≥ 8, y ≤ 29: brows, eyes, the eyewear front), the eyewear arms
//   (x −9 / 8, y 21..28, z ≥ 2), the ears and their items (x ≤ −9 / ≥ 8, y 19..29, z −3..2, unless the style covers the ears),
//   and everything below the jaw (y < 19).
// · Each style is built in a scratch set, then only what is 6-connected to the head is written (nothing floats, with or without a
//   hat). A hat's cover then deletes what it covers and drops what lost the scalp (world/fit/layers.js), so every style keeps a
//   tight shell round the head for the part a hat leaves showing.
// · Tiers are honest: common = the everyday cuts on every corner; rare = a statement shape; epic = a big build or dye job;
//   grail = the one you get robbed for.
import { hash3 } from './kit.js';

// ── the head (world/chars.js base): x −8..7, y 19..33, z −7..7 (the face plane z 7) · ears x −10..−9 / 8..9, y 23..27, z −1..1
const X0 = -8, X1 = 7, Y0 = 19, Y1 = 33, Z0 = -7, Z1 = 7;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const inHead = (x, y, z) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1 && z >= Z0 && z <= Z1;
const FACE = (x, y, z) => z >= 8 && y <= 29;                                                // brows, eyes, the eyewear front
const ARMS = (x, y, z) => (x === -9 || x === 8) && y >= 21 && y <= 28 && z >= 2;              // the eyewear arms
const EAR = (x, y, z) => (x <= -9 || x >= 8) && y >= 19 && y <= 29 && z >= -3 && z <= 2;      // the ear and its items (hoops, a pencil or a bill tucked over it)
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const kk = (x, y, z) => ((x + 64) << 14) | ((y + 64) << 7) | (z + 64), uk = k => [(k >> 14) - 64, ((k >> 7) & 127) - 64, (k & 127) - 64];
const sym = x => x < 0 ? -1 - x : x;                 // the head's centre is between x −1 and 0: x and −1 − x are a mirror pair
const rnd = (x, y, z, s = 0) => hash3(sym(x) + s * 131, y, z) / 4294967296;   // a mirror-symmetric hash in [0, 1)

// a scratch set of hair cells on the head grid H. o.ears: the style hangs over the ears (registered coversEars).
function hair(H, o = {}) {
  const m = new Map(), ears = !!o.ears, floor = o.floor ?? 19;
  const ok = (x, y, z) => y >= floor && !inHead(x, y, z) && !FACE(x, y, z) && !ARMS(x, y, z) && (ears || !EAR(x, y, z)) && !H.has(x, y, z);
  const A = {
    put(x, y, z, c, l = 0) { if (ok(x, y, z)) m.set(kk(x, y, z), [c, l]); },
    cut(x, y, z) { m.delete(kk(x, y, z)); },
    has: (x, y, z) => m.has(kk(x, y, z)),
    // a shell grown off the head: t(px, py, pz, ox, oy, oz) → the thickness over the nearest head cell p, in the outward direction o
    grow(t, c, l = 0, round = .3) {
      for (let x = -16; x <= 15; x++) for (let y = floor; y <= 50; y++) for (let z = -16; z <= 16; z++) { if (inHead(x, y, z)) continue;
        const px = cl(x, X0, X1), py = cl(y, Y0, Y1), pz = cl(z, Z0, Z1), ox = x - px, oy = y - py, oz = z - pz, T = t(px, py, pz, ox, oy, oz);
        if (T > 0 && Math.hypot(ox, oy, oz) <= T + round) A.put(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } },
    // an ellipsoid round (cx, cy, cz) in continuous coordinates (cell centres at +.5); fuzz roughens its surface
    ball(cx, cy, cz, rx, ry, rz, c, l = 0, fuzz = 0, keep = () => true) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
        const e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2;
        if (e <= 1 + fuzz * (rnd(x, y, z, 7) - .5) && keep(x, y, z)) A.put(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } },
    box(x0, y0, z0, x1, y1, z1, c, l = 0) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) A.put(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); },
    // a 6-connected run of cells through points [x, y, z] (one axis a step, so a strand never hangs on an edge)
    path(pts, c, l = 0) { let p = pts[0].map(Math.round); A.put(...p, typeof c === 'function' ? c(...p, 0) : c, l); let n = 0;
      for (const q0 of pts.slice(1)) { const q = q0.map(Math.round);
        while (p[0] !== q[0] || p[1] !== q[1] || p[2] !== q[2]) { const d = [0, 1, 2].map(i => q[i] - p[i]), i = [0, 1, 2].reduce((a, b) => Math.abs(d[b]) > Math.abs(d[a]) ? b : a);
          p = p.slice(); p[i] += Math.sign(d[i]); n++; A.put(...p, typeof c === 'function' ? c(...p, n) : c, l); } } },
    recolor(fn) { for (const [k, v] of m) { const r = fn(...uk(k), v[0]); if (r !== undefined) v[0] = r; } },
    exposed: (x, y, z) => N6.some(([a, b, c]) => !m.has(kk(x + a, y + b, z + c)) && !inHead(x + a, y + b, z + c)),
    // write what is 6-connected to the head (skin and ears); anything else is dropped here, so nothing ever floats
    commit() { const seen = new Set(), q = [];
      for (const k of m.keys()) { const [x, y, z] = uk(k); if (N6.some(([a, b, c]) => H.has(x + a, y + b, z + c))) { seen.add(k); q.push(k); } }
      while (q.length) { const [x, y, z] = uk(q.pop()); for (const [a, b, c] of N6) { const n = kk(x + a, y + b, z + c); if (m.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
      for (const [k, [c, l]] of m) if (seen.has(k)) { const [x, y, z] = uk(k); H.set(x, y, z, c, l); } },
  };
  return A;
}

// the hairline: is head cell p inside the hair? f(px) the lowest row on the front, s(pz) on the sides, b(px) on the back
const line = (f, s, b) => (px, py, pz, ox, oy, oz) => {
  if (oy > 0) return true;
  const lo = Math.max(oz > 0 ? f(px) : -99, oz < 0 ? b(px) : -99, ox !== 0 ? s(pz) : -99);
  return py >= lo;
};
const shell = (inside, T = 1) => (...a) => inside(...a) ? (typeof T === 'function' ? T(...a) : T) : 0;
const c = v => () => v;   // a constant hairline

// ── fine paint helpers (P is the fine painter; a hair pass paints on the head grid: its own hair, or the skin under it)
// laid edges: baby-hair swoops hanging off the hairline onto the forehead (row y), in the hair colour, mirrored left and right
function laidEdges(P, col, y = 31) {
  const S = ['########', '#..#####', '.#...###', '......#.'];   // one swoop two voxels wide, as seen from the front
  for (const x0 of [-8, -6, -4]) P.bmp('+z', S, { '#': col }, 4 * x0, 4 * y + 3);
  for (const x0 of [2, 4, 6]) P.bmp('+z', S.map(r => [...r].reverse().join('')), { '#': col }, 4 * x0, 4 * y + 3);
  for (let x = -2; x <= 1; x++) P.rect('+z', 4 * x, 4 * y + 3, 4 * x + 4, 4 * y + 4, col);
}

export default {
  // ─────────────────────────────── COMMON: the everyday cuts
  waves: { name: '360 Waves', tier: 'common', why: 'common · brushed flat and glossy till the ripples go all the way round',
    draw(H) { const A = hair(H), B = 0x1d1613, R = 0x463328;
      A.grow(shell(line(px => px <= -7 || px >= 6 ? 32 : 31, pz => pz >= 2 ? 30 : Math.max(25, 29 + Math.min(0, pz + 3)), c(25))),
        (x, y, z) => { const r = Math.hypot(x + .5, z + 2.5) + Math.max(0, 33.5 - y) * 1.15; return Math.floor(r) % 3 === 0 ? R : B; }, 1);
      A.commit(); } },

  bleach_buzz: { name: 'Bleach Buzz', tier: 'common', why: 'common · clippered down and bleached at the kitchen sink',
    draw(H) { const A = hair(H);
      A.grow(shell(line(c(31), pz => pz >= 2 ? 29 : 28, c(23))), 0xeedfa6);
      A.commit(); } },

  cornrows: { name: 'Straight Backs', tier: 'common', why: 'common · five fat cornrows front to nape, plaited tight',
    draw(H) { const A = hair(H), B = 0x17110e, D = 0x34261d, braid = x => [-7, -6, -4, -3, -1, 0, 2, 3, 5, 6].includes(x);
      A.grow((px, py, pz, ox, oy, oz) => {
        if (ox !== 0) return oy === 0 && oz === 0 && (py === 30 || py === 31) ? 1 : 0;
        if (oy > 0) return braid(px) ? 1 : 0;
        return braid(px) && py >= (oz > 0 ? 31 : 21) ? 1 : 0; },
        (x, y, z) => (x < X0 || x > X1 ? (z + y) : y > Y1 ? (x + z) : (x + y)) % 2 === 0 ? B : D);
      A.commit(); } },

  slick_back: { name: 'The Slick', tier: 'common', why: 'common · pomade, a fine comb and a back room at the social club',
    draw(H) { const A = hair(H), B = 0x16161b, L = 0x30333f;
      const col = (x, y, z) => (x < X0 || x > X1 || z < Z0) ? (y % 3 === 0 ? L : B) : ((x + 17) % 3 === 0 ? L : B);
      A.grow(shell(line(c(31), pz => pz >= 2 ? 29 : 26, c(22)), (px, py, pz, ox, oy, oz) => oy > 0 && pz >= -1 ? 2 : (oz < 0 && py >= 26 && py <= 29 && Math.abs(px + .5) <= 4 ? 2 : 1)), col, 1);
      A.commit(); } },

  fro: { name: 'Fro', tier: 'common', why: 'common · picked out round, sitting high over the ears',
    draw(H) { const A = hair(H), B = 0x2a1c14;
      A.ball(0, 32.5, -.5, 11.2, 9, 10.2, B, 0, .22, (x, y, z) => !(y < 29 && (x < X0 || x > X1) && z > -6) && !(z >= 8 && y < 31));
      A.grow(shell(line(c(31), c(28), c(24))), B);
      A.commit(); } },

  hard_part: { name: 'Hard Part', tier: 'common', why: 'common · a taper, the top swept over, the part cut in by the corner barber',
    draw(H) { const A = hair(H), B = 0x2b1d15;
      A.grow(shell(line(c(31), pz => pz >= 2 ? 30 : 29, c(25)), (px, py, pz, ox, oy, oz) => oy > 0 && pz >= -4 ? 2 : 1), B, 0, .45);
      A.commit(); },
    fine(P, ctx) {   // the part: a shaved line along the right side, just under the swept top
      for (let z = -4; z <= 7; z++) for (let i = 0; i < 4; i++) for (const j of [1, 2]) P.paint('-x', 4 * z + i, 4 * 33 + j, ctx.sk.c(-8, 33, z)); } },

  twists: { name: 'Sponge Twists', tier: 'common', why: 'common · sponged into coils on the stoop, tips catching the light',
    draw(H) { const A = hair(H), B = 0x1b1410, T = 0x3d2c22;
      A.grow(shell(line(c(31), pz => pz >= 2 ? 30 : 28, c(23))), B);
      for (let x = -9; x <= 8; x++) for (let z = -8; z <= 8; z++) if (rnd(x, 0, z, 11) < .42 && A.has(x, 34, z)) A.put(x, 35, z, T);
      for (const x of [-10, 9]) for (let y = 29; y <= 33; y++) for (let z = -7; z <= 6; z++) if (rnd(x, y, z, 12) < .3 && A.has(x < 0 ? -9 : 8, y, z)) A.put(x, y, z, T);
      for (let x = -8; x <= 7; x++) for (let y = 24; y <= 33; y++) if (rnd(x, y, 0, 13) < .3 && A.has(x, y, -8)) A.put(x, y, -9, T);
      A.commit(); } },

  // ─────────────────────────────── RARE: a statement shape
  high_top: { name: 'High-Top', tier: 'rare', why: 'rare · the box: flat on top, faded tight, a part cut in the side',
    draw(H) { const A = hair(H), B = 0x19130f;
      A.grow(shell(line(c(31), c(30), c(26))), B);
      for (let x = -9; x <= 8; x++) for (let z = -8; z <= 8; z++) for (let y = 34; y <= 42; y++) {
        const ex = x === -9 || x === 8, ez = z === -8 || z === 8; if (ex && ez) continue; if (y === 42 && (ex || ez)) continue; A.put(x, y, z, B); }
      A.commit(); },
    fine(P, ctx) { const sk = ctx.sk.c(-8, 33, 0);   // the part: a diagonal cut into the box's right side
      for (let t = 0; t < 30; t++) { const qa = 4 * 5 - t, qb = 4 * 36 + 2 - Math.round(t / 3.2); P.paint('-x', qa, qb, sk); P.paint('-x', qa, qb + 1, sk); } } },

  frohawk: { name: 'Cherry Frohawk', tier: 'rare', why: 'rare · a cherry-red crest down the middle, the sides shaved clean',
    draw(H) { const A = hair(H), R = 0xd42a3c, D = 0xa51d2e;
      const prof = [.45, .6, .78, .9, 1, 1, 1, 1, 1, 1, 1, .97, .93, .88, .83, .78, .72];   // z 8 → −8
      for (let x = -4; x <= 3; x++) for (let z = -8; z <= 8; z++) { const f = Math.sqrt(Math.max(0, 1 - ((x + .5) / 4.3) ** 2)), top = 33 + Math.round(8 * f * prof[8 - z]);
        for (let y = 34; y <= top; y++) if (!(y === top && y > 35 && rnd(x, y, z, 5) < .35)) A.put(x, y, z, (y + z + 40) % 4 === 0 ? D : R); }
      A.grow(shell((px, py, pz, ox, oy, oz) => ox === 0 && (oy > 0 ? Math.abs(px + .5) <= 3.5 : oz > 0 ? py >= 32 && Math.abs(px + .5) <= 2.5 : py >= 23 && Math.abs(px + .5) <= Math.min(3.5, 1.5 + (py - 23) * .4))), R);
      A.commit(); } },

  twin_puffs: { name: 'Twin Puffs', tier: 'rare', why: 'rare · parted down the middle, two puffs up top, edges laid',
    draw(H) { const A = hair(H), B = 0x231812;
      A.grow(shell(line(c(32), pz => pz >= 2 ? 29 : 27, c(23))), B, 1);
      for (const s of [-1, 1]) A.ball(s * 5.2, 38, -.5, 4.3, 4.1, 4.3, B, 0, .3);
      A.commit(); },
    fine(P, ctx) { const sk = (x, z) => ctx.sk.c(x, 33, z);   // the centre part (skin), then the laid edges
      for (let z = -7; z <= 8; z++) for (let j = 0; j < 4; j++) { P.paint('+y', -2, 4 * z + j, sk(-1, z)); P.paint('+y', -1, 4 * z + j, sk(-1, z)); P.paint('+y', 0, 4 * z + j, sk(0, z)); P.paint('+y', 1, 4 * z + j, sk(0, z)); }
      laidEdges(P, 0x231812, 31); } },

  bantu_knots: { name: 'Bantu Knots', tier: 'rare', why: 'rare · five knots coiled tight on a parted grid',
    draw(H) { const A = hair(H), B = 0x1a1310, D = 0x3a2a20;
      A.grow(shell(line(c(31), pz => pz >= 2 ? 30 : 28, c(23))), B);
      for (const [cx, cz, r] of [[-4.6, 3.4, 2.5], [4.6, 3.4, 2.5], [-4.6, -4.2, 2.5], [4.6, -4.2, 2.5], [0, -.4, 2.8]])
        A.ball(cx, 35 + r * .45, cz, r, r * 1.1, r, (x, y, z) => (Math.floor((Math.atan2(z + .5 - cz, x + .5 - cx) + Math.PI) / (Math.PI / 2)) + y) % 2 === 0 ? B : D);
      A.commit(); } },

  mullet: { name: 'Route 9 Mullet', tier: 'rare', why: 'rare · business at the front, a gas-station party down the back',
    draw(H) { const A = hair(H), B = 0xd2a548, D = 0xa97f2e;
      A.grow(shell(line(px => sym(px) % 3 === 1 ? 31 : 30, pz => pz >= -2 ? 29 : 19, c(19)),
        (px, py, pz, ox, oy, oz) => (oz < 0 || (ox !== 0 && pz <= -3)) ? (py <= 21 ? 3 : py <= 30 ? 2 : 1) : 1), (x, y, z) => y <= 20 && (z < Z0 - 1 || x < X0 - 1 || x > X1 + 1) ? D : B, 0, .45);
      for (let x = -9; x <= 8; x++) for (let z = -7; z <= 7; z++) if (rnd(x, 0, z, 14) < .22 && A.has(x, 34, z)) A.put(x, 35, z, B);   // a choppy top
      for (let x = -12; x <= 11; x++) for (let z = -11; z <= -3; z++) if (rnd(x, 19, z, 9) < .45) A.cut(x, 19, z);   // a ragged hem
      A.commit(); } },

  locs: { name: 'Shoulder Locs', tier: 'rare', why: 'rare · years of locs down to the jaw, a few gold cuffs',
    coversEars: true,
    draw(H) { const A = hair(H, { ears: true }), B = 0x2b1e16, D = 0x3d2b1f, G = 0xe2b04a;
      const strand = v => Math.floor(Math.abs(v + .5)) % 2 === 0;
      const tip = (a, b) => 19 + Math.floor(rnd(a, 0, b, 21) * 3);
      A.grow((px, py, pz, ox, oy, oz) => {
        if (oy > 0) return 1;
        if (oz > 0) return py >= 31 ? 1 : 0;
        if (ox !== 0 && oz === 0) return pz >= 2 ? (py >= 29 ? 1 : 0) : pz >= -3 && py >= 21 && py <= 29 ? 3 : 2;
        if (oz < 0 && ox === 0) return 2;
        return 1; }, B);
      A.recolor((x, y, z) => { if (!(x <= -10 || x >= 9 || z <= -9)) return; const s = x <= -10 || x >= 9 ? z : x; return ((y >> 1) + (strand(s) ? 0 : 1)) % 2 === 0 ? D : B; });
      // the outer layer only on the strands (a ridged curtain), the strand tips ragged
      for (let x = -12; x <= 11; x++) for (let y = 19; y <= 33; y++) for (let z = -11; z <= 8; z++) {
        const sideOuter = (x <= -10 || x >= 9) && x !== -11 && x !== 10 && z <= 1, backOuter = z <= -9;
        if (sideOuter && !strand(z) && y < 32) A.cut(x, y, z);
        if (backOuter && !strand(x) && y < 32) A.cut(x, y, z);
        if ((x <= -10 || x >= 9 || z <= -9) && y < tip(x <= -10 || x >= 9 ? z : x, x <= -10 || x >= 9 ? sym(x) : z)) A.cut(x, y, z); }
      for (const [x, z] of [[-10, -6], [9, -6], [-4, -9], [3, -9], [-11, 0], [10, 0]]) if (A.has(x, 22, z)) A.put(x, 22, z, G, 2);
      for (const x of [-11, 10]) for (let z = 2; z <= 4; z++) if (strand(z)) A.path([[x, 30, z], [x, 21, z]], (xx, yy) => ((yy >> 1) % 2 ? D : B));
      A.commit(); } },

  // ─────────────────────────────── EPIC: a big build or a dye job
  box_braids: { name: 'Burgundy Knotless', tier: 'epic', why: 'epic · jaw-length knotless braids, half up in a bun, gold beads',
    coversEars: true,
    draw(H) { const A = hair(H, { ears: true }), B = 0x7a1f35, D = 0x5c1527;
      const strand = v => Math.floor(Math.abs(v + .5)) % 2 === 0;
      A.grow((px, py, pz, ox, oy, oz) => {
        if (oy > 0) return 1;
        if (oz > 0) return py >= 31 ? 1 : 0;
        if (ox !== 0 && oz === 0) return pz >= 2 ? (py >= 29 ? 1 : 0) : (pz >= -3 && py >= 21 && py <= 29 ? 3 : 2);
        if (oz < 0 && ox === 0) return 2;
        return 1; }, (x, y, z) => (y > Y1 ? (x + z) : x < X0 || x > X1 ? z : x) % 2 === 0 ? B : D);
      for (let x = -12; x <= 11; x++) for (let y = 19; y <= 33; y++) for (let z = -11; z <= 8; z++) {
        if ((x <= -10 || x >= 9) && x !== -11 && x !== 10 && z <= 1 && !strand(z) && y < 31) A.cut(x, y, z);
        if (z <= -9 && !strand(x) && y < 31) A.cut(x, y, z); }
      A.ball(0, 37, -3.5, 3.3, 2.6, 3.3, (x, y, z) => (x + y + z) % 2 === 0 ? B : D);
      for (const x of [-11, 10]) for (let z = 2; z <= 4; z++) if (strand(z)) A.path([[x, 30, z], [x, 20, z]], (xx, yy) => yy % 2 ? D : B);
      A.commit(); },
    fine(P) { for (let x = -8; x <= 7; x++) if (Math.floor(Math.abs(x + .5)) % 2 === 0) P.half(2 * x, 37, 2 * -9, 0xe6b54a, 2); } },   // a gold bead under each back braid

  sleek_pony: { name: 'Snatched Pony', tier: 'epic', why: 'epic · gelled glass-flat into a high pony, edges laid, gold tie',
    draw(H) { const A = hair(H), B = 0x111116, G = 0xe2b04a;
      A.grow(shell(line(c(32), pz => pz >= 2 ? 29 : 26, c(22))), B, 1);
      A.ball(0, 35.6, -5, 2.6, 2, 2.6, B, 1);                       // the gather on the crown
      A.box(-2, 37, -6, 1, 37, -5, G, 2);                          // the gold tie
      const sp = [[38, -6, 2, 2], [40, -8, 2, 2], [40, -11, 2, 2], [38, -13, 2, 2], [34, -14, 2, 2], [29, -14, 1, 1], [24, -13, 1, 1], [21, -12, 1, 1]];   // [y, z, half width, depth]
      for (let i = 0; i + 1 < sp.length; i++) { const [y0, z0, w] = sp[i], [y1, z1, , d1] = sp[i + 1];
        for (let dx = -w; dx < w; dx++) for (let dz = 0; dz < d1; dz++) A.path([[dx, y0, z0 - dz], [dx, y1, z1 - dz]], B, 1); }
      A.commit(); },
    fine(P) { laidEdges(P, 0x111116, 31); } },

  blowout: { name: 'Pink Blowout', tier: 'epic', why: 'epic · a hot-pink blowout the size of a street sign',
    coversEars: true,
    draw(H) { const A = hair(H, { ears: true }), B = 0xfc4c9e, D = 0xdc3a88;
      // round on top, drawn in under the ears (so a cap's cut leaves a soft ring, not wings)
      const inside = (x, y, z) => { const t = y < 30 ? 1 - (30 - y) * .045 : 1, e = ((x + .5) / (14.5 * t)) ** 2 + ((y + .5 - 32) / 11.8) ** 2 + ((z + 1) / (13 * t)) ** 2;
        return e <= 1 + .2 * (rnd(x, y, z, 7) - .5); };
      for (let x = -16; x <= 15; x++) for (let y = 19; y <= 45; y++) for (let z = -15; z <= 14; z++) if (inside(x, y, z) && (z < 8 || x < X0 - 1 || x > X1 + 1 || y >= 31)) A.put(x, y, z, rnd(x, y, z, 2) < .18 ? D : B);
      A.commit(); } },

  finger_waves: { name: 'Ice Finger Waves', tier: 'epic', why: 'epic · platinum finger waves set like a Harlem portrait',
    draw(H) { const A = hair(H), B = 0xe8e3d4, L = 0xfffbef, S = 0xcfc8b6;
      const ridge = (x, y, z) => { const u = (x < X0 || x > X1) ? z + (33 - y) * .4 : z + Math.abs(x + .5) * .55; return Math.floor((u + 40) / 2.5) % 2 === 0; };
      A.grow(shell(line(c(31), pz => pz >= 2 ? 29 : 27, c(24)), (px, py, pz, ox, oy, oz) => ridge(px + ox, py + oy, pz + oz) && (oy > 0 || ox !== 0) ? 2 : 1),
        (x, y, z) => { const out = x < X0 - 1 || x > X1 + 1 || y > Y1 + 1; return out || z > Z1 ? L : ridge(x, y, z) ? B : S; }, 1, .45);
      A.commit(); } },

  // ─────────────────────────────── GRAIL: the one you get robbed for
  gilded_pineapple: { name: 'Gilded Pineapple', tier: 'grail', why: 'grail · locs piled up in a fountain, money-green tips, gold cuffs',
    draw(H) { const A = hair(H), B = 0x1d1511, D = 0x2e221a, G = 0x25b84c, Au = 0xe8b84a;
      A.grow(shell(line(c(31), pz => pz >= 2 ? 30 : 28, c(23))), (x, y, z) => (y > Y1 ? Math.floor(Math.abs(x + .5)) : z) % 2 === 0 ? B : D);
      const cuff = y => y === 36 || y === 39 || y === 42;
      A.box(-2, 34, -3, 1, 43, 0, (x, y) => cuff(y) ? Au : (y % 2 ? B : D));   // the gathered column, three gold cuffs
      A.recolor((x, y, z) => cuff(y) && x >= -2 && x <= 1 && z >= -3 && z <= 0 ? Au : undefined);
      for (let k = 0; k < 12; k++) { const a = (k + .5) * Math.PI / 6, ca = Math.cos(a), sa = Math.sin(a);
        const pts = [[1.4, 44], [3.5, 45], [5.5, 44], [7, 42], [8, 40], [8.6, 38]].map(([r, y]) => [Math.floor(r * ca), y, Math.floor(r * sa - 1.5)]);
        A.path([[ca > 0 ? 0 : -1, 43, sa > 0 ? -1 : -2], ...pts], (x, y, z, n) => n >= 13 ? G : n % 3 === 0 ? D : B); }
      A.recolor((x, y, z) => y === 43 && x >= -2 && x <= 1 && z >= -3 && z <= 0 ? B : undefined);
      A.commit(); },
    fine(P) { for (let k = 0; k < 12; k++) { const a = (k + .5) * Math.PI / 6; P.half(2 * Math.floor(8.6 * Math.cos(a)), 2 * 38 - 1, 2 * Math.floor(8.6 * Math.sin(a) - 1.5), 0xe8b84a, 2); } } },   // a gold bead on every tip
};
