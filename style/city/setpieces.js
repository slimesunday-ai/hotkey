// Roof set pieces + calm lots (pass 1c). Roofs are neutral; the colour of a block lives in 1–3 BIG set pieces sized to be read from
// the overview camera (~6 px per metre): a burger on a tank stand, a billboard with a 4× character, a pool, a court, a tilted neon
// frame, a roof garden, a disco party, a giant sneaker, a boxing ring, a grow-op greenhouse, a painted roof throw-up, a giant pizza,
// a giant cash stack. Placement is hash-based (never the block rng), so the far tier (far.js) and the full build agree.
// Every piece is authored in its own Vol and stamped from a bank marked `.big` (the mid tier keeps it at full detail).
import { Vol, Bank, meshVol, stamp, rasterMask, tempBank } from './vox.js';
import { REG } from './audit.js';
import { PAL, CV, SIDE, hash, shade } from './style.js';
import { TOD } from './kit.js';
import { BILLBOARDS } from './lexicon.js';
import { tree, bench, hoop, speaker, lawnChair, umbrella, picnic, milkCrate , streetTree } from './props.js';
// pass 3 · signage: the billboard piece, the neon frame's word and the roof throw-up's word are allocated per block (signage/alloc.js)
import { roofBillboard, roofWord, giantLook, NEON_SHORT, THROW_SHORT } from './signage/index.js';

// ───────────────────────── helpers
const lit = () => (TOD.night ? 3 : 0);
const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
function vol(x0, z0, x1, z1, top, h) { const nx = Math.max(2, Math.round((x1 - x0) / CV)), nz = Math.max(2, Math.round((z1 - z0) / CV)); return new Vol(nx, h, nz, { s: CV, org: [x0, top, z0], ground: true }); }
// pass 1d: a person beside a piece stands 0.35 m clear of it, on the roof (the first side that fits), never clamped into it
function beside(F, prefer) { const R = F.roof || F, mx = (F.x0 + F.x1) / 2, mz = (F.z0 + F.z1) / 2, c = [[mx, F.z1 + .35, 0], [F.x1 + .35, mz, 1], [mx, F.z0 - .35, 2], [F.x0 - .35, mz, 3]];
  const ok = ([x, z]) => x > R.x0 + .25 && x < R.x1 - .25 && z > R.z0 + .25 && z < R.z1 - .25; const list = prefer ? [c[prefer], ...c] : c; return list.find(ok) || null; }
// is a world box free of a piece volume's solid voxels (above its floor layer)? — for props set onto a piece
function clearIn(V, e) { const i0 = Math.max(0, Math.floor((e[0] + .02 - V.org[0]) / V.s)), i1 = Math.min(V.nx, Math.ceil((e[3] - .02 - V.org[0]) / V.s)), k0 = Math.max(0, Math.floor((e[2] + .02 - V.org[2]) / V.s)), k1 = Math.min(V.nz, Math.ceil((e[5] - .02 - V.org[2]) / V.s)), j1 = Math.min(V.ny, Math.ceil((e[4] - V.org[1]) / V.s));
  for (let y = 1; y < j1; y++) for (let k = k0; k < k1; k++) for (let i = i0; i < i1; i++) if (V.d[i + k * V.nx + y * V.sxz]) return false; return true; }
let PIECE = 'piece'; function emit(bank, V) { const bk = tempBank(bank); meshVol(V, bk); bk.big = true; bk.kind = PIECE; stamp(bk, bank, 0, 0, 0, 0); }   // pass 1d: ids read i_j·L<k>·piece-<kind>·n
const cyl = (V, cx, cz, r, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); };
const life = (A, x, y, z, ry, act, seed, extra = {}) => { A.life ??= []; A.life.push({ x, y, z, ry, act, seed: seed | 0, ...extra }); };
const TMC = new Map(), raster = (s, px) => { const k = s + px; let m = TMC.get(k); if (!m) TMC.set(k, m = rasterMask(s, `900 ${px}px Impact, "Arial Black", sans-serif`)); return m; };
const BOLD = [0xff4fa3, 0xffe23a, 0x2de2e6, 0x6cff4a, 0xff7a1a, 0x2f5bff, 0xe8232a, 0x7a3cff];

// ───────────────────────── the catalogue: minimum roof (w × d in metres, either orientation), storeys, weight
export const PIECES = {
  burger: { min: [3.8, 3.8], st: 2, w: 3 }, billboard: { min: [6.0, 2.2], st: 3, w: 2 }, pool: { min: [4.2, 5.4], st: 2, w: 3 }, court: { min: [4.8, 6.6], st: 2, w: 3 },
  neon: { min: [4.2, 2.4], st: 2, w: 3 }, garden: { min: [3.8, 4.8], st: 1, w: 3 }, party: { min: [4.2, 4.8], st: 2, w: 3 }, sneaker: { min: [2.8, 5.4], st: 1, w: 2 },
  ring: { min: [4.6, 4.6], st: 2, w: 2 }, grow: { min: [3.8, 5.0], st: 2, w: 2 }, tag: { min: [3.8, 4.6], st: 1, w: 3 }, pizza: { min: [4.2, 4.2], st: 2, w: 2 }, cash: { min: [3.4, 3.4], st: 2, w: 2 },
};
const ORDER = ['neon', 'tag', 'burger', 'ring', 'garden', 'pool', 'cash', 'court', 'sneaker', 'grow', 'party', 'billboard', 'pizza'];
const fits = (k, rw, rd, st) => { const [a, b] = PIECES[k].min; return st >= PIECES[k].st && ((rw >= a && rd >= b) || (rw >= b && rd >= a)); };
const HEROK = 'WCSPB';

// roof rect of a lot as gen.buildLot will pass it (inside the parapet, 0.3 margin; stoop buildings set back 2.5 on the main face)
function roofDims(l) { const st = l.spec.ground === 'stoop' ? 2.5 : 0, mx = l.main[1] === 'x';
  return { rw: l.w - .6 - (mx ? st : 0), rd: l.d - .6 - (mx ? 0 : st) }; }

// ───────────────────────── choice (end of gen.specify): calm lots + 1–3 pieces per block
export function chooseSetPieces(b, lots, seedBase, PC = { calm: .6, count: [.62, .2], heroCount: 1, order: ORDER }) {
  const hero = HEROK.includes(b.k) || !!b.place;
  for (const l of lots) if (l.spec) { l.spec.roofPeople = false; l.spec.piece = null; }
  const cen = l => [(l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2], far = (p, q, d) => Math.hypot(cen(p)[0] - cen(q)[0], cen(p)[1] - cen(q)[1]) >= d;
  // calm lot: a mid-row lot becomes a pocket plaza or a green (never a corner, the alley, a gag lot, or beside the alley / parking)
  if (!hero && hash(seedBase, 71) < PC.calm) {
    const gaps = lots.filter(l => ['alley', 'parking'].includes(l.spec?.type));
    const c = lots.filter(l => l.spec && !l.corner && l.faces.length === 1 && !['alley', 'parking', 'tower'].includes(l.spec.type) && !l.spec.gag && l.front >= 4 && l.front <= 7.5 && gaps.every(g => far(l, g, 9)));
    if (c.length) { const l = c[(hash(seedBase, 74) * c.length) | 0]; Object.assign(l.spec, { type: 'calm', calm: hash(seedBase, 75) < .5 ? 'plaza' : 'green', st: 0, shops: [], ground: 'calm', fire: false, fireBack: false, canopy: null }); }
  }
  // pieces: count the existing billboard gag as one
  const gag = lots.filter(l => l.spec?.gag?.kind === 'billboard');
  let want = hero ? PC.heroCount : 1 + (hash(seedBase, 72) < PC.count[0] ? 1 : 0) + (hash(seedBase, 73) < PC.count[1] ? 1 : 0); want -= gag.length; if (want <= 0) return;
  const cands = lots.filter(l => l.spec && !['alley', 'parking', 'tower', 'calm'].includes(l.spec.type) && l.spec.gag?.kind !== 'billboard' && l.w >= 3.6 && l.d >= 3.6)
    .map(l => { const { rw, rd } = roofDims(l); return { l, rw, rd, sc: rw * rd * (.55 + .09 * Math.min(10, l.spec.st)) * (.8 + hash(l.spec.seed, 76) * .4) }; }).sort((p, q) => q.sc - p.sc);
  // deck: a fixed tour of the catalogue, rotated per block (neighbours lead with different pieces), lightly shuffled after the lead
  const K = PC.order, o = (((b.i * 5 + b.j * 3) % K.length) + K.length) % K.length, rot = K.slice(o).concat(K.slice(0, o));
  const deck = [rot[0], rot[1], ...rot.slice(2).map((k, n) => [k, hash(seedBase, n * 7919 + 13, 77)]).sort((p, q) => p[1] - q[1]).map(p => p[0])];
  const taken = [...gag], used = new Set(gag.length ? ['billboard'] : []);
  for (const c of cands) { if (want <= 0) break; if (!taken.every(t => far(c.l, t, 10.5))) continue;
    const k = deck.find(k => !used.has(k) && fits(k, c.rw, c.rd, c.l.spec.st)); if (!k) continue;
    used.add(k); taken.push(c.l); want--;
    c.l.spec.piece = { kind: k, seed: (c.l.spec.seed * 7 + 13) | 0, alongX: c.rw >= c.rd, col: BOLD[(hash(c.l.spec.seed, 78) * BOLD.length) | 0], col2: BOLD[(hash(c.l.spec.seed, 79) * BOLD.length) | 0] };
    if (c.l.spec.piece.col2 === c.l.spec.piece.col) c.l.spec.piece.col2 = BOLD[(BOLD.indexOf(c.l.spec.piece.col) + 3) % BOLD.length];
    if (k === 'burger' || k === 'billboard' || k === 'pizza') c.l.spec.tank = false;
  }
}

// ───────────────────────── footprint on the roof (world sub-rect; planRoof keeps utility items out of it)
export function pieceFoot(piece, R) {
  const W = R.x1 - R.x0, D = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, box = (w, d) => ({ x0: cx - Math.min(W, w) / 2, z0: cz - Math.min(D, d) / 2, x1: cx + Math.min(W, w) / 2, z1: cz + Math.min(D, d) / 2 });
  const ax = piece.alongX, strip = (D > 7.8 && !ax) || (W > 7.8 && ax) ? 2.8 : 0;      // big roofs keep a service strip (stair hatch + a unit) at one end
  const whole = () => ax ? { x0: R.x0 + strip, z0: R.z0, x1: R.x1, z1: R.z1 } : { x0: R.x0, z0: R.z0 + strip, x1: R.x1, z1: R.z1 };
  switch (piece.kind) {
    case 'burger': return box(6.4, 6.4); case 'pizza': return box(6.4, 4.6); case 'cash': return box(5.2, 3.6);
    case 'neon': return box(9.0, 3.4); case 'billboard': return box(8.2, 2.0);
    case 'sneaker': return ax ? box(7.2, 3.2) : box(3.2, 7.2); case 'ring': return box(5.6, 5.6); case 'grow': return ax ? box(5.4, 4.0) : box(4.0, 5.4);
    default: return whole();
  }
}

// ───────────────────────── build
export function buildSetPiece(bank, piece, rect, top, s, A) {
  const F = pieceFoot(piece, rect), f = BUILD[piece.kind]; PIECE = 'piece-' + piece.kind; F.roof = rect; if (f) f(bank, piece, F, top, s, A); PIECE = 'piece';
  (A.pieces ??= []).push({ kind: piece.kind, x: (F.x0 + F.x1) / 2, z: (F.z0 + F.z1) / 2, y: top });
}
const BUILD = {
  // BURGER TANK: four steel legs + braces, a painted steel deck with a red rail, then the burger (bun, patty, cheese, lettuce, tomato, domed bun)
  burger(bank, P, F, top, s, A) {
    const n = Math.round(Math.min(F.x1 - F.x0, F.z1 - F.z0) / CV), cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2, V = vol(cx - n * CV / 2, cz - n * CV / 2, cx + n * CV / 2, cz + n * CV / 2, top, 72), m = n / 2;
    const R = Math.min(30, m - 2.5), legH = 26, lg = Math.round(R * .6), I = PAL.iron, y0 = legH + 2;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) V.box(m + dx * lg - 1, 0, m + dz * lg - 1, m + dx * lg + 1, legH, m + dz * lg + 1, I);
    for (let y = 5; y < legH; y += 7) { V.box(m - lg - 1, y, m - lg - 1, m + lg + 1, y + 1, m - lg, I); V.box(m - lg - 1, y, m + lg, m + lg + 1, y + 1, m + lg + 1, I); V.box(m - lg - 1, y, m - lg - 1, m - lg, y + 1, m + lg + 1, I); V.box(m + lg, y, m - lg - 1, m + lg + 1, y + 1, m + lg + 1, I); }
    cyl(V, m, m, R * .8, legH, legH + 2, 0x2f5bff);
    cyl(V, m, m, R * .8, legH + 2, legH + 4, (x, y, z) => Math.hypot(x + .5 - m, z + .5 - m) > R * .8 - 1.2 ? PAL.red : undefined);
    const BUN = 0xf0a030, BUN2 = 0xd9861f;
    cyl(V, m, m, R - 1, y0, y0 + 6, (x, y) => y === y0 ? BUN2 : BUN);                                             // bottom bun
    cyl(V, m, m, R + .4, y0 + 5, y0 + 9, 0x6b3a1e);                                                              // patty
    for (let x = -R - 2; x <= R + 2; x++) for (let z = -R - 2; z <= R + 2; z++) if (Math.max(Math.abs(x), Math.abs(z)) <= R * .92 && Math.hypot(x, z) <= R + 2.2) V.set(m + x, y0 + 9, m + z, 0xffd21f);   // cheese slice
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) V.box(m + x * Math.round(R * .68) - 1, y0 + 6, m + z * Math.round(R * .68) - 1, m + x * Math.round(R * .68) + 1, y0 + 9, m + z * Math.round(R * .68) + 1, 0xffd21f);   // pass 1d: cheese drips hang off the patty (they floated beyond it)
    for (let x = -R - 3; x <= R + 3; x++) for (let z = -R - 3; z <= R + 3; z++) { const a = Math.atan2(z, x), r = Math.hypot(x + .5, z + .5); if (r <= R + 1.4 + Math.sin(a * 9) * 1.2) V.set(m + x, y0 + 10, m + z, (x * 3 + z * 5) % 7 === 0 ? 0x2fae2f : 0x46d446); }   // lettuce frill
    cyl(V, m, m, R - .2, y0 + 11, y0 + 12, PAL.red);                                                             // tomato
    const dome = Math.round(R * .6); for (let k = 0; k < dome; k++) cyl(V, m, m, Math.max(2, (R - .4) * Math.sqrt(1 - (k / (dome + .5)) ** 2)), y0 + 12 + k, y0 + 13 + k, (x, y, z) => hash(x, y, z) > .93 && k > 1 ? 0xfff3d6 : BUN);   // domed bun + sesame
    emit(bank, V);
  },
  // BILLBOARD with a 4× character on the catwalk (people.js bakes the giant from A.giants)
  billboard(bank, P, F, top, s, A) {
    const cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2 + .2, r = roofBillboard(P.seed, { giant: true, flip: false, at: [cx, cz] });   // pass 3: signage (the face = far's colour)
    stamp(r.bank, bank, 0, cx, top, cz); A.giants ??= []; A.giants.push({ x: cx + 2.2, z: cz + .45, y: top + 1.8, rot: 0, seed: P.seed, look: giantLook(r.design, P.seed) });
  },
  // ROOFTOP POOL: white tile deck over the footprint, a cyan pool with a bold coping, a float, loungers, an umbrella, people
  pool(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 8), nx = V.nx, nz = V.nz, ax = nx >= nz, L = ax ? nx : nz, Wd = ax ? nz : nx, C = P.col === 0xffe23a || P.col === 0x6cff4a ? 0xff4fa3 : P.col;
    V.box(0, 0, 0, nx, 1, nz, (x, y, z) => (x % 8 === 0 || z % 8 === 0) ? 0xe2dfd8 : 0xf6f5f0);
    const pw = Math.max(14, Wd - 22), pl = Math.max(20, L - 26), a0 = ax ? Math.round((nx - pl) / 2) + 3 : Math.round((nx - pw) / 2) - 3, b0 = ax ? Math.round((nz - pw) / 2) - 3 : Math.round((nz - pl) / 2) + 3;
    const [x0, x1, z0, z1] = ax ? [a0, a0 + pl, b0, b0 + pw] : [a0, a0 + pw, b0, b0 + pl];
    V.box(x0 - 3, 0, z0 - 3, x1 + 3, 2, z1 + 3, C); V.box(x0, 0, z0, x1, 2, z1, -1);
    V.box(x0, 0, z0, x1, 1, z1, (x, y, z) => ((ax ? z - z0 : x - x0) === (pw >> 1) || (ax ? z - z0 : x - x0) === (pw >> 1) - 1) ? 0x1f8fd8 : (hash(x, z, 5) > .97 ? 0xbff0ff : 0x2fc4ff), TOD.night ? 3 : 1);
    { const fx = x0 + ((x1 - x0) * .3 | 0), fz = z0 + ((z1 - z0) * .6 | 0); for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const r = Math.hypot(a, b); if (r <= 4.2 && r >= 2) V.set(fx + a, 1, fz + b, (a + b + 8) % 4 < 2 ? 0xffe23a : 0xff7a1a); } }
    emit(bank, V);
    const wx = x => F.x0 + x * CV, wz = z => F.z0 + z * CV, side = ax ? [wx((x0 + x1) / 2), wz(Math.max(3, z0 - 9))] : [wx(Math.max(3, x0 - 9)), wz((z0 + z1) / 2)];
    for (let k = 0; k < 2; k++) { const u = (k - .5) * 1.4, px = ax ? side[0] + u : side[0], pz = ax ? side[1] : side[1] + u; stamp(lawnChair(k ? 0xffe23a : 0xff4fa3), bank, ax ? 2 : 3, px, top + CV, pz); life(A, px, top + CV, pz, ax ? Math.PI : -Math.PI / 2, 'lounge', s.seed + k * 7); }
    stamp(umbrella(0x2de2e6), bank, 0, ax ? side[0] + 2.2 : side[0], top + CV, ax ? side[1] : side[1] + 2.2);
    life(A, wx(x0 + (x1 - x0) * .62), top + CV, wz(z0 + (z1 - z0) * .45), hash(s.seed, 3) * 6, 'soak', s.seed + 3);
    life(A, wx(x1 + 5 < nx ? x1 + 5 : x0 - 5), top + CV, wz((z0 + z1) / 2), -Math.PI / 2, 'phone', s.seed + 5);
  },
  // COURT: bold orange court, blue keys + border, white lines, hoops at both ends, a chain-link fence, players
  court(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 26), nx = V.nx, nz = V.nz, ax = nx >= nz, L = ax ? nx : nz, Wd = ax ? nz : nx, OR = 0xff6a1a, BL = 0x2f5bff, W = 0xf7f7f2;
    const uv = (x, z) => ax ? [x, z] : [z, x];
    V.box(0, 0, 0, nx, 1, nz, (x, y, z) => { const [u, v] = uv(x, z), e = Math.min(u, v, L - 1 - u, Wd - 1 - v); if (e < 4) return BL; if (e === 4) return W;
      const cu = L >> 1, cv = Wd >> 1, key = Math.abs(v - cv) <= 10 && (u < 4 + 19 || u > L - 24); if (u === cu) return W;
      if ((Math.hypot(u - cu, v - cv) | 0) === 11) return W; if (key && (Math.abs(v - cv) === 10 || u === 4 + 19 || u === L - 24)) return W; if (key) return BL; return OR; });
    for (let k = 0; k < nx; k++) for (const z of [0, nz - 1]) if (k % 12 === 0) V.box(k, 1, z, k + 1, 24, z + 1, PAL.iron); else if (k % 2 === 0) V.set(k, 23, z, PAL.iron);
    for (let k = 0; k < nz; k++) for (const x of [0, nx - 1]) if (k % 12 === 0) V.box(x, 1, k, x + 1, 24, k + 1, PAL.iron); else if (k % 2 === 0) V.set(x, 23, k, PAL.iron);
    emit(bank, V);
    const w = (u, v) => ax ? [F.x0 + u * CV, F.z0 + v * CV] : [F.x0 + v * CV, F.z0 + u * CV], [h0x, h0z] = w(6, Wd / 2), [h1x, h1z] = w(L - 6, Wd / 2);
    stamp(hoop(), bank, ax ? 1 : 0, h0x, top + CV, h0z); stamp(hoop(), bank, ax ? 3 : 2, h1x, top + CV, h1z);
    const [p1x, p1z] = w(L * .3, Wd * .45), [p2x, p2z] = w(L * .38, Wd * .62), [p3x, p3z] = w(L * .62, Wd * .4), face = ax ? -Math.PI / 2 : Math.PI;
    life(A, p1x, top + CV, p1z, face, 'shoot', s.seed + 1); life(A, p2x, top + CV, p2z, face + .5, 'arms', s.seed + 2); life(A, p3x, top + CV, p3z, face + Math.PI, 'stand', s.seed + 3);
  },
  // NEON FRAME: a big sign tilted back 35° on an A-frame so it reads from the street AND the overview; tube border + a word, both faces
  neon(bank, P, F, top, s, A) {
    const cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
    const nw = Math.round((F.x1 - F.x0) / CV), nzv = Math.round((F.z1 - F.z0) / CV), V = vol(F.x0, F.z0, F.x1, F.z1, top, 72);
    let word = roofWord('neon', cx, cz, w => raster(w, 20).w <= nw - 16, NEON_SHORT), M = null; for (let px = 56; px >= 18; px -= 4) { M = raster(word, px); if (M.w <= nw - 16) break; }   // pass 3: the word is allocated (signage)
    const c1 = P.col === 0x2f5bff ? 0xff2d95 : P.col, c2 = c1 === 0x2de2e6 ? 0xff2d95 : 0x2de2e6, Hp = M.h + 12, Wp = Math.min(nw - 2, M.w + 14), p0 = Math.round((nw - Wp) / 2), zc = nzv - 5;
    const ca = Math.cos(.61), sa = Math.sin(.61), put = (a, j, d, c, l = 0) => { const y = 8 + Math.round(j * ca), z = zc - Math.round(j * sa) - d; V.set(p0 + a, y, z, c, l); V.set(p0 + a, y, z - 1, c, l); };
    for (let j = 0; j < Hp; j++) for (let a = 0; a < Wp; a++) { const e = Math.min(a, j, Wp - 1 - a, Hp - 1 - j); put(a, j, 1, e < 2 ? c1 : e === 2 ? PAL.ink : 0x1b1b2a, e < 2 ? 3 : 0); }
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const a = Math.round((Wp - M.w) / 2) + i, jj = Hp - 6 - j; put(a, jj, -1, c2, 3); put(Wp - 1 - a, jj, 3, c2, 3); }
    for (const a of [4, Wp - 6]) { V.box(p0 + a, 0, zc - 1, p0 + a + 2, 10, zc + 1, PAL.iron); for (let y = 0; y < 8 + Math.round(Hp * ca * .7); y++) V.box(p0 + a, y, zc - 6 - Math.round(y * .9), p0 + a + 2, y + 1, zc - 4 - Math.round(y * .9), PAL.iron); }
    emit(bank, V);
  },
  // ROOF GARDEN: turf with mow stripes, a paved path, raised beds in bloom, cubic trees, a bench; a gardener and a sitter
  garden(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 36), nx = V.nx, nz = V.nz, ax = nx >= nz, G1 = 0x46c046, G2 = 0x3aad3a, PATH = 0xe2dccf;
    V.box(0, 0, 0, nx, 1, nz, (x, y, z) => { if ((ax ? z : x) === ((ax ? nz : nx) >> 1) || (ax ? z : x) === ((ax ? nz : nx) >> 1) + 1 || (ax ? z : x) === ((ax ? nz : nx) >> 1) - 1) return PATH; return ((ax ? x : z) / 6 | 0) % 2 ? G1 : G2; });
    const L = ax ? nx : nz, Wd = ax ? nz : nx, put = (u, v, w, d, y0, y1, c) => ax ? V.box(u, y0, v, u + w, y1, v + d, c) : V.box(v, y0, u, v + d, y1, u + w, c);
    const FL = [0xff4fa3, 0xffe23a, 0xe8232a, 0xff7a1a, 0xffffff];
    for (let k = 0, u = 4; u + 18 < L - 16 && k < 3; k++, u += 24) { put(u, 3, 18, (Wd >> 1) - 6, 1, 5, 0x8b4a24); put(u + 1, 4, 16, (Wd >> 1) - 8, 5, 6, 0x5a3a22);
      for (let a = u + 2; a < u + 16; a += 3) for (let b = 5; b < (Wd >> 1) - 4; b += 3) { const h = 2 + ((hash(a, b, P.seed) * 4) | 0); put(a, b, 2, 2, 6, 6 + h, (a + b) % 3 ? 0x2fbf55 : 0x46d466); if (hash(b, a, P.seed) > .45) put(a, b, 1, 1, 6 + h, 7 + h, FL[(hash(a * 7, b) * FL.length) | 0]); } }
    const tree1 = (u, v) => { put(u - 1, v - 1, 2, 2, 1, 14, 0x7a4a22); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = 0; c < 3; c++) { if (Math.abs(a) + Math.abs(b) + (c === 2 ? 1 : 0) > 2 && hash(u + a, v + b, c) > .4) continue; put(u + a * 4 - 2, v + b * 4 - 2, 4, 4, 12 + c * 4, 16 + c * 4, [0x1d8f3c, 0x25a748, 0x2fbf55][(c + Math.abs(a + b)) % 3]); } };
    tree1(L - 10, Wd - 10); if (L > 60) tree1(L - 10, 10); tree1(Math.min(L - 26, 30), Wd - 9);
    emit(bank, V);
    const w = (u, v) => ax ? [F.x0 + u * CV, F.z0 + v * CV] : [F.x0 + v * CV, F.z0 + u * CV], br = ax ? 0 : 1;
    // pass 1d: the bench goes on open turf (it could land in a bed or a tree trunk)
    let bpos = null; for (const u of [L - 22, L - 26, L - 30, L - 18, 30, 26]) { const [x, z] = w(u, 7); if (clearIn(V, REG.boxOf(bench(), br, x, top + CV, z))) { bpos = [x, z]; break; } }
    if (bpos) { const [bx, bz] = bpos; stamp(bench(), bank, br, bx, top + CV, bz); life(A, bx - (ax ? 0 : .1), top + CV, bz - (ax ? .1 : 0), ax ? Math.PI : -Math.PI / 2, 'sit', s.seed + 1, { seatY: .5 }); }
    const [gx, gz] = w(14, (Wd >> 1) - 1); life(A, gx, top + CV, gz, ax ? Math.PI : Math.PI / 2, 'garden', s.seed + 2);
  },
  // PARTY: a disco floor of bold tiles, a pink DJ booth + speakers, string lights, a balloon bunch, a crowd
  party(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 40), nx = V.nx, nz = V.nz, T = [0xff4fa3, 0xffe23a, 0x2de2e6, 0x7a3cff, 0x6cff4a];
    V.box(0, 0, 0, nx, 1, nz, (x, y, z) => { const e = Math.min(x, z, nx - 1 - x, nz - 1 - z); if (e < 3) return PAL.ink; return T[(hash(x >> 3, z >> 3, P.seed) * T.length) | 0]; }, TOD.night ? 3 : 0);
    const bx = nx >> 1, bz = 8; V.box(bx - 10, 1, bz - 4, bx + 10, 11, bz + 5, PAL.ink); V.box(bx - 10, 2, bz + 5, bx + 10, 10, bz + 6, 0xff4fa3); V.box(bx - 11, 11, bz - 5, bx + 11, 12, bz + 6, 0xffe23a);
    for (const dx of [-5, 5]) { cyl(V, bx + dx, bz, 2.6, 12, 13, 0x2a2a30); V.set(bx + dx, 13, bz, 0xdfe6ee); }
    const poles = [[2, 2], [nx - 3, 2], [nx - 3, nz - 3], [2, nz - 3]], bulbs = [0xffe23a, 0xff4fa3, 0x2de2e6, 0x6cff4a, 0xff7a1a];
    for (const [x, z] of poles) V.box(x, 1, z, x + 1, 24, z + 1, PAL.iron);
    for (let k = 0; k < 4; k++) { const [x0, z0] = poles[k], [x1, z1] = poles[(k + 1) % 4], n = Math.round(Math.hypot(x1 - x0, z1 - z0)); for (let t = 0; t <= n; t++) { const u = t / n, y = 23 - Math.sin(u * Math.PI) * 5; V.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u, PAL.iron); if (t % 5 === 2) V.set(x0 + (x1 - x0) * u, y - 1, z0 + (z1 - z0) * u, bulbs[(t / 5 | 0) % 5], 3); } }
    const gx = nx - 9, gz = nz - 9; V.box(gx - 1, 1, gz - 1, gx + 2, 3, gz + 2, PAL.ink); for (let k = 0; k < 7; k++) { const a = k * 2.4, r = k ? 3.2 : 0, x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r, y = 26 + (k % 3) * 3; for (let yy = 3; yy < y - 2; yy++) V.set(gx + Math.round((x - gx) * (yy / y)), yy, gz + Math.round((z - gz) * (yy / y)), 0xf7f7f2); V.ell(x, y, z, 2.6, 3, 2.6, BOLD[(k + (P.seed & 3)) % BOLD.length]); }
    emit(bank, V);
    const w = (x, z) => [F.x0 + x * CV, F.z0 + z * CV], [spx, spz] = w(bx - 16, bz), [sqx, sqz] = w(bx + 16, bz);
    stamp(speaker(), bank, 0, spx, top + CV, spz); stamp(speaker(), bank, 0, sqx, top + CV, sqz);
    { const [x, z] = w(bx, bz - 7); life(A, x, top + CV, z, 0, 'dj', s.seed + 1); }   // pass 1d: behind the booth, not in it
    for (let k = 0; k < 4; k++) { const [x, z] = w(nx * (.3 + (k % 2) * .4), nz * (.48 + (k >> 1) * .26)); life(A, x, top + CV, z, hash(s.seed, k) * 6.28, 'dance', s.seed + 10 + k); }
  },
  // GIANT SNEAKER: a high-top the size of a van — white upper, bold side panel, lime laces, ink collar and outsole, on a black plinth
  sneaker(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 40), nx = V.nx, nz = V.nz, ax = nx >= nz, L = Math.min(ax ? nx : nz, 70), Wd = Math.min(ax ? nz : nx, 28), o = [Math.round(((ax ? nx : nz) - L) / 2), Math.round(((ax ? nz : nx) - Wd) / 2)];
    const put = (u, y, v, c) => ax ? V.set(o[0] + u, y, o[1] + v, c) : V.set(o[1] + v, y, o[0] + u, c), PANEL = [0xe8232a, 0xff4fa3, 0x2f5bff, 0x7a3cff, 0xff7a1a][(hash(P.seed, 21) * 5) | 0];
    for (let u = -1; u <= L; u++) for (let v = -1; v <= Wd; v++) put(u, 0, v, PAL.ink);
    for (let u = 0; u < L; u++) { const toe = u > L * .72 ? Math.sqrt(Math.max(0, 1 - ((u - L * .72) / (L * .3)) ** 2)) : 1, half = Wd / 2 * (u < 4 ? .8 : 1) * (.55 + .45 * toe);
      const k = L / 54, hTop = Math.round(u < L * .34 ? 23 * k : u < L * .72 ? (23 - (u - L * .34) / (L * .38) * 10) * k : (5 + 8 * toe) * k);
      for (let v = 0; v < Wd; v++) { const dv = Math.abs(v + .5 - Wd / 2); if (dv > half) continue;
        for (let y = 1; y < hTop; y++) { const side = dv > half - 1.2, open = u > 3 && u < L * .3 && dv < half - 3 && y > 17 * k;
          if (open) { if (y === Math.floor(17 * k) + 1) put(u, y, v, PAL.ink); continue; }
          let c = y < 2 ? 0x2a2a30 : y < 5 ? 0xf7f7f2 : PANEL;
          if (y >= 6 && side && Math.abs((u - L * .5) + (y - 12 * k) * 1.4) < 3.2 * k) c = 0xffffff;
          if (u < 3 * k && y > 6) c = 0x6cff4a; if (u >= 6 * k && u <= 11 * k && y > 13 * k) c = PAL.ink; if (y === hTop - 1 && u > L * .34 && u < L * .7 && dv < 5 && (u % 3 === 0)) c = 0xffffff;
          put(u, y, v, c); } } }
    emit(bank, V);
    const at = beside(F); if (at) life(A, at[0], top, at[1], [Math.PI, -Math.PI / 2, 0, Math.PI / 2][at[2]], 'phone', s.seed + 1);   // pass 1d: beside the sneaker (was clamped into it)
  },
  // BOXING RING: black skirt with a bold band, blue canvas, coloured corner posts, white ropes; two fighters, a ref, onlookers
  ring(bank, P, F, top, s, A) {
    const n = Math.round(Math.min(F.x1 - F.x0, F.z1 - F.z0, 5.2) / CV), cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2, V = vol(cx - n * CV / 2, cz - n * CV / 2, cx + n * CV / 2, cz + n * CV / 2, top, 20);
    const CAN = P.col === 0xe8232a ? 0x2f5bff : P.col === 0x6cff4a || P.col === 0xffe23a ? 0x2f5bff : P.col;
    V.box(1, 0, 1, n - 1, 5, n - 1, (x, y) => y === 2 ? PAL.red : PAL.ink); V.box(1, 5, 1, n - 1, 6, n - 1, (x, y, z) => (Math.hypot(x - n / 2, z - n / 2) | 0) === 6 ? PAL.white : CAN);
    [[2, 2, PAL.red], [n - 4, 2, 0x2f5bff], [2, n - 4, PAL.white], [n - 4, n - 4, PAL.white]].forEach(([x, z, c]) => V.box(x, 6, z, x + 2, 18, z + 2, c));
    for (const y of [9, 12, 15]) for (let k = 3; k < n - 3; k++) { V.set(k, y, 2, PAL.white); V.set(k, y, n - 3, PAL.white); V.set(2, y, k, PAL.white); V.set(n - 3, y, k, PAL.white); }
    emit(bank, V);
    const y1 = top + .6; life(A, cx - .8, y1, cz, Math.PI / 2, 'arms', s.seed + 1); life(A, cx + .8, y1, cz + .1, -Math.PI / 2, 'arms', s.seed + 2); life(A, cx + .1, y1, cz - 1.3, 0, 'stand', s.seed + 3);
    life(A, cx - n * CV / 2 - .45, top, cz + .8, Math.PI / 2, 'phone', s.seed + 4); life(A, cx + .6, top, cz + n * CV / 2 + .45, Math.PI, 'arms', s.seed + 5);
  },
  // GROW-OP GREENHOUSE: white frame, green glass, open ridge vents over lime rows, magenta grow-light bars (always on)
  grow(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 30), nx = V.nx, nz = V.nz, ax = nx >= nz, L = ax ? nx : nz, Wd = ax ? nz : nx, FR = 0xe4e8ec, GL = 0x9ff0c0;
    const put = (u, y, v, c, l = 0) => ax ? V.set(u, y, v, c, l) : V.set(v, y, u, c, l), half = Wd / 2;
    for (let u = 1; u < L - 1; u++) for (let v = 1; v < Wd - 1; v++) { const dv = Math.abs(v + .5 - half), roofY = 18 + Math.max(0, Math.round((half - 1.5 - dv) * .45)), /* pass 1d: eaves sit on the wall tops */ frameU = (u - 1) % 9 === 0 || u === L - 2, edge = v === 1 || v === Wd - 2;
      put(u, 0, v, 0x5a3a22);
      if (edge || u === 1 || u === L - 2) for (let y = 1; y < 18; y++) put(u, y, v, frameU || y === 1 || y === 17 || (edge && (u === 1 || u === L - 2)) ? FR : GL, frameU ? 0 : 1);
      const vent = ((u - 1) / 9 | 0) % 2 === 1 && dv < half - 2; if (!vent || frameU) put(u, roofY, v, frameU || dv < 1 ? FR : GL, frameU ? 0 : 1);
      if (!edge && u > 2 && u < L - 3 && (v % 5 === 2) && dv < half - 1.5) { put(u, 1, v, PAL.ink); const h = 5 + ((hash(u, v, P.seed) * 4) | 0); for (let y = 2; y < h; y++) put(u, y, v, (u + y) % 3 ? 0x6cff4a : 0x2fbf55); }
      if (!edge && (v === Math.round(half) - 2 || v === Math.round(half) + 1) && u > 2 && u < L - 3) put(u, roofY - 1, v, 0xff2dd4, 3); }   // pass 1d: grow lights hang from the roof
    emit(bank, V);
    const at = beside(F); if (at) life(A, at[0], top, at[1], [Math.PI, -Math.PI / 2, 0, Math.PI / 2][at[2]], 'arms', s.seed + 1);   // pass 1d: beside the greenhouse (was clamped into its wall)
  },
  // ROOF THROW-UP: bubble letters painted flat across the roof — fill, ink outline, white highlight, a drop shadow
  tag(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 2), nx = V.nx, nz = V.nz, rot = false, LW = rot ? nz : nx, LH = rot ? nx : nz;
    let w = roofWord('throw', (F.x0 + F.x1) / 2, (F.z0 + F.z1) / 2, t => { const m = raster(t, 18); return m.w <= LW - 10 && m.h <= LH - 10; }, THROW_SHORT), M = null;   // pass 3: the word is allocated (signage)
    for (let px = 90; px >= 14; px -= 4) { M = raster(w, px); if (M.w <= LW - 10 && M.h <= LH - 10) break; }
    const W = M.w + 8, H = M.h + 8, g = new Uint8Array(W * H), at = (i, j) => i >= 0 && j >= 0 && i < W && j < H ? g[i + j * W] : 0;
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) g[i + 4 + (j + 4) * W] = 1;
    const out = new Uint8Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!g[i + j * W]) { let near = false; for (let a = -2; a <= 2 && !near; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) + Math.abs(b) <= 3 && at(i + a, j + b)) { near = true; break; } if (near) out[i + j * W] = 1; }
    const ox = Math.round((LW - W) / 2), oy = Math.round((LH - H) / 2), fill = P.col === 0x2f5bff || P.col === 0x7a3cff ? 0x6cff4a : P.col, shadow = fill === 0xff4fa3 ? 0x7a3cff : 0xff4fa3;
    const put = (i, j, c) => { const a = ox + i, b = oy + j; if (rot) V.set(nx - 1 - b, 0, a, c); else V.set(a, 0, b, c); };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (!out[i + j * W] && !g[i + j * W] && (at(i - 2, j - 2) || (out[(i - 2) + (j - 2) * W] && i >= 2 && j >= 2))) put(i, j, shadow); }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (out[i + j * W]) put(i, j, PAL.ink); else if (g[i + j * W]) put(i, j, (!at(i - 1, j) || !at(i, j - 1)) && (!at(i - 2, j) || !at(i, j - 2)) ? 0xffffff : fill); }
    emit(bank, V);
    life(A, F.x1 - .5, top, F.z1 - .5, Math.PI * .75, 'arms', s.seed + 1);
  },
  // GIANT PIZZA: a whole pie tilted back on a black A-frame, one slice missing
  pizza(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 64), nx = V.nx, nz = V.nz, R = Math.min(30, (nx >> 1) - 2), cx = nx >> 1, zc = nz - 6, a = .95, ca = Math.cos(a), sa = Math.sin(a);
    const pep = [[0, 0]]; for (let k = 0; k < 7; k++) { const t = k / 7 * 6.28 + hash(P.seed, k) * .5, r = R * .55; pep.push([Math.cos(t) * r, Math.sin(t) * r]); } for (let k = 0; k < 4; k++) { const t = k / 4 * 6.28 + .8; pep.push([Math.cos(t) * R * .27, Math.sin(t) * R * .27]); }
    for (let u = -R; u <= R; u++) for (let v = -R; v <= R; v++) { const r = Math.hypot(u, v); if (r > R) continue; 
      let c = r > R - 3 ? 0xd9861f : 0xffd23a; if (r <= R - 3 && pep.some(([pu, pv]) => Math.hypot(u - pu, v - pv) < R * .13)) c = 0xd7141a; else if (r <= R - 3 && hash(u, v, P.seed) > .96) c = 0x2fae2f;
      const y = 9 + Math.round((v + R) * sa), z = zc - Math.round((v + R) * ca); V.set(cx + u, y, z, c); V.set(cx + u, y, z - 1, 0xd9861f); }
    for (const x of [cx - R + 4, cx + R - 5]) { V.box(x, 0, zc - 1, x + 2, 11, zc + 2, PAL.ink); for (let y = 0; y < 9 + Math.round(R * 1.4 * sa); y++) { const zb = zc - 2 - Math.round(Math.max(0, y - 9) * ca / sa); V.box(x, y, zb - 1, x + 2, y + 1, zb + 1, PAL.ink); } }   // pass 1d: the easel touches the pie (it stood a metre behind it)
    emit(bank, V);
  },
  // GIANT CASH STACK: banded bills the size of a car, loose notes around it, somebody guarding it
  cash(bank, P, F, top, s, A) {
    const V = vol(F.x0, F.z0, F.x1, F.z1, top, 24), nx = V.nx, nz = V.nz, bw = Math.min(nx - 18, 46), bd = Math.min(nz - 8, 24), x0 = Math.max(3, ((nx - bw) >> 1) - 5), z0 = (nz - bd) >> 1;   // pass 2: room left for the counter (on narrow roofs he stood in the stack)
    V.box(x0, 0, z0, x0 + bw, 18, z0 + bd, (x, y, z) => (x === x0 || x === x0 + bw - 1 || z === z0 || z === z0 + bd - 1) ? (y % 2 ? 0x2f8f3f : 0xeaf5e0) : 0x3fae4f);
    V.box(x0, 18, z0, x0 + bw, 19, z0 + bd, (x, y, z) => { const e = Math.min(x - x0, z - z0, x0 + bw - 1 - x, z0 + bd - 1 - z); return e === 1 ? 0x2f8f3f : (Math.abs(x - x0 - bw / 2) < 3 && Math.abs(z - z0 - bd / 2) < 4) ? 0x2f8f3f : 0x7fd08a; });
    const b0 = x0 + Math.round(bw * .42), b1 = x0 + Math.round(bw * .58); V.box(b0, 0, z0 - 1, b1, 20, z0 + bd + 1, 0xffe23a); V.box(b0 + 1, 19, z0 + 1, b1 - 1, 20, z0 + bd - 1, 0xffd000);
    for (let k = 0; k < 6; k++) { const x = 2 + ((hash(P.seed, k) * (nx - 8)) | 0), z = 2 + ((hash(P.seed, k, 2) * (nz - 6)) | 0); if (x > x0 - 6 && x < x0 + bw && z > z0 - 4 && z < z0 + bd) continue; V.box(x, 0, z, x + 5, 1, z + 3, 0x7fd08a); }
    emit(bank, V);
    const gx = F.x0 + (x0 + bw + 4) * CV, gz = F.z0 + (z0 + bd / 2) * CV; life(A, Math.min(gx, F.x1 - .3), top, gz, -Math.PI / 2, 'arms', s.seed + 1, {});
  },
};

// ───────────────────────── far tier: a few 0.5-grain coloured boxes per piece (world units)
export function farSetPiece(piece, rect, top) {
  const F = pieceFoot(piece, rect), cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2, W = F.x1 - F.x0, D = F.z1 - F.z0, b = (x0, y0, z0, x1, y1, z1, c) => [x0, top + y0, z0, x1, top + y1, z1, c], C = piece.col;
  const R = Math.min(3.0, Math.min(W, D) / 2 - .25);
  switch (piece.kind) {
    case 'burger': return [b(cx - .6, 0, cz - .6, cx + .6, 2.6, cz + .6, PAL.iron), b(cx - R * .8, 2.6, cz - R * .8, cx + R * .8, 2.8, cz + R * .8, 0x2f5bff), b(cx - R, 2.8, cz - R, cx + R, 4.0, cz + R, 0x6b3a1e), b(cx - R - .1, 4.0, cz - R - .1, cx + R + .1, 4.2, cz + R + .1, 0x46d446), b(cx - R * .85, 4.2, cz - R * .85, cx + R * .85, 4.2 + R * .55, cz + R * .85, 0xf0a030)];
    case 'billboard': { const bg = BILLBOARDS[piece.seed % BILLBOARDS.length][3]; return [b(cx - 4, 0, cz - .2, cx + 4, 2.0, cz + .3, PAL.ink), b(cx - 4, 2.0, cz - .2, cx + 4, 6.4, cz + .3, bg), b(cx + 1.7, 1.8, cz + .3, cx + 2.8, 8.6, cz + 1.0, 0xff7a1a)]; }
    case 'pool': return [b(F.x0, 0, F.z0, F.x1, .1, F.z1, 0xf6f5f0), b(F.x0 + .8, .05, F.z0 + .8, F.x1 - .8, .2, F.z1 - .8, 0x2fc4ff)];
    case 'court': return [b(F.x0, 0, F.z0, F.x1, .1, F.z1, 0x2f5bff), b(F.x0 + .5, .05, F.z0 + .5, F.x1 - .5, .2, F.z1 - .5, 0xff6a1a)];
    case 'neon': return [b(cx - W / 2 + .5, .8, cz - .8, cx + W / 2 - .5, 4.4, cz + .6, C === 0x2f5bff ? 0xff2d95 : C)];
    case 'garden': return [b(F.x0, 0, F.z0, F.x1, .1, F.z1, 0x46c046), b(F.x1 - 1.6, .1, F.z1 - 1.6, F.x1 - .4, 2.4, F.z1 - .4, 0x1d8f3c), b(F.x0 + 1.4, .1, F.z1 - 1.8, F.x0 + 2.8, 2.2, F.z1 - .5, 0x25a748)];
    case 'party': return [b(F.x0, 0, F.z0, F.x1, .15, F.z1, 0xff4fa3), b(cx - 1, .1, F.z0 + .3, cx + 1, 1.2, F.z0 + 1.2, 0xffe23a), b(F.x1 - 1.4, 2.2, F.z1 - 1.4, F.x1 - .4, 3.4, F.z1 - .4, 0x2de2e6)];
    case 'sneaker': { const U = [0xe8232a, 0xff4fa3, 0x2f5bff, 0x7a3cff, 0xff7a1a][(hash(piece.seed, 21) * 5) | 0]; return piece.alongX ? [b(cx - 3.4, 0, cz - 1.3, cx + 3.4, .5, cz + 1.3, 0xf7f7f2), b(cx - 3.4, .5, cz - 1.3, cx + 3.2, 1.6, cz + 1.3, U), b(cx - 3.4, 1.6, cz - 1.3, cx - .8, 2.9, cz + 1.3, U)] : [b(cx - 1.3, 0, cz - 3.4, cx + 1.3, .5, cz + 3.4, 0xf7f7f2), b(cx - 1.3, .5, cz - 3.4, cx + 1.3, 1.6, cz + 3.2, U), b(cx - 1.3, 1.6, cz - 3.4, cx + 1.3, 2.9, cz - .8, U)]; }
    case 'ring': return [b(cx - 2.5, 0, cz - 2.5, cx + 2.5, .5, cz + 2.5, PAL.ink), b(cx - 2.5, .5, cz - 2.5, cx + 2.5, .6, cz + 2.5, C === 0xe8232a || C === 0x6cff4a || C === 0xffe23a ? 0x2f5bff : C)];
    case 'grow': return [b(F.x0 + .1, 0, F.z0 + .1, F.x1 - .1, 2.0, F.z1 - .1, 0x9ff0c0), b(F.x0 + .4, 1.4, cz - .3, F.x1 - .4, 1.8, cz + .3, 0xff2dd4)];
    case 'tag': return [b(F.x0 + .4, 0, F.z0 + .6, F.x1 - .4, .1, F.z1 - .6, C === 0x2f5bff || C === 0x7a3cff ? 0x6cff4a : C)];
    case 'pizza': return [b(cx - R, .9, cz - 1.2, cx + R, .9 + R * 1.6, cz + .4, 0xffd23a), b(cx - R - .1, .9, cz + .4, cx + R + .1, 1.4, cz + .9, 0xd9861f)];
    case 'cash': return [b(cx - 1.6, 0, cz - .8, cx + 1.6, 1.5, cz + .8, 0x3fae4f), b(cx - .3, 0, cz - .9, cx + .3, 1.6, cz + .9, 0xffe23a)];
  }
  return [];
}

// ───────────────────────── calm lots: a pocket plaza or a small green — a rest between the busy frontages
export function calmLot(bank, l, A) {
  if (l.spec.calm === 'site') return siteYard(bank, l);
  const s = l.spec, V = new Vol(Math.round(l.w / CV), 12, Math.round(l.d / CV), { s: CV, org: [l.x0, SIDE, l.z0] }), nx = V.nx, nz = V.nz, side = l.main, plaza = s.calm !== 'green';
  const back = { '-z': 'z1', '+z': 'z0', '-x': 'x1', '+x': 'x0' }[side], PAVE = 0xe2dccf, JOINT = 0xcfc7b8, G1 = 0x5cc24a, G2 = 0x4fb444;
  V.box(0, 0, 0, nx, 1, nz, (x, y, z) => plaza ? ((x % 10 === 0 || z % 10 === 0) ? JOINT : PAVE) : (((x >> 1) * 7 + (z >> 1) * 3) % 13 === 0 ? G2 : G1));
  if (!plaza) { const across = side[1] === 'z'; V.box(across ? (nx >> 1) - 5 : 0, 0, across ? 0 : (nz >> 1) - 5, across ? (nx >> 1) + 5 : nx, 1, across ? nz : (nz >> 1) + 5, PAVE); }
  // a low planter wall along the back and the two party sides (seat height), the street side stays open
  const wall = (x0, z0, x1, z1) => { V.box(x0, 0, z0, x1, 5, z1, 0xbdb6a8); V.box(x0, 5, z0, x1, 6, z1, 0xd8d2c4); };
  if (back === 'z1') wall(0, nz - 4, nx, nz); if (back === 'z0') wall(0, 0, nx, 4); if (back === 'x1') wall(nx - 4, 0, nx, nz); if (back === 'x0') wall(0, 0, 4, nz);
  if (side[1] === 'z') { wall(0, 0, 3, nz); wall(nx - 3, 0, nx, nz); } else { wall(0, 0, nx, 3); wall(0, nz - 3, nx, nz); }
  REG.surface(V); meshVol(V, bank);   // pass 1d: paving/grass is a walkable surface: trees, benches and tables stand on it, not in it
  // trees: two or three cubic street trees, benches facing the street, one or two people sitting
  const P = (u, v) => { const a = u * l.front, d = v * (side[1] === 'z' ? l.d : l.w); return side === '-z' ? [l.x1 - a, l.z0 + d] : side === '+z' ? [l.x0 + a, l.z1 - d] : side === '-x' ? [l.x0 + d, l.z0 + a] : [l.x1 - d, l.z1 - a]; };
  const rot = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 }[side], ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][rot];
  // pass 1d: a piece goes down only where its footprint is clear of the planter walls (voxel test) and of everything placed so far;
  // trees are the slim street kind (a full crown in a 4–9 m pocket reached into both neighbours)
  const clear = (bk, r2, x, z) => { const e = REG.boxOf(bk, r2, x, SIDE, z); if (!REG.fits(e, { doors: false, ignore: 'plinth' })) return false; const i0 = Math.max(0, Math.floor((e[0] + .02 - l.x0) / CV)), i1 = Math.min(nx, Math.ceil((e[3] - .02 - l.x0) / CV)), k0 = Math.max(0, Math.floor((e[2] + .02 - l.z0) / CV)), k1 = Math.min(nz, Math.ceil((e[5] - .02 - l.z0) / CV));
    for (let y = 1; y < 8; y++) for (let k = k0; k < k1; k++) for (let i = i0; i < i1; i++) if (V.d[i + k * nx + y * V.sxz]) return false; return bk.kind === 'street-tree' || (e[0] > l.x0 && e[3] < l.x1 && e[2] > l.z0 && e[5] < l.z1); };   // (a crown may overhang the sidewalk)
  const putC = (bk, r2, u, v) => { for (const [du, dv] of [[0, 0], [.08, 0], [-.08, 0], [0, .08], [0, -.08], [.15, .1], [-.15, -.1]]) { const [x, z] = P(u + du, v + dv); if (clear(bk, r2, x, z)) { stamp(bk, bank, r2, x, SIDE, z); return [x, z]; } } return null; };
  const trees = plaza ? [[.26, .7], [.74, .72]] : [[.22, .68], [.62, .78], [.8, .42]];
  trees.forEach(([u, v], k) => putC(streetTree((s.seed + k * 5) | 0), rot, u, v));
  const benches = plaza ? [[.5, .62]] : [[.35, .45]]; benches.forEach(([u, v], k) => { const at = putC(bench(), (rot + 2) & 3, u, v); if (at) { const [sx, sz] = P(u - .06, v - .04); life(A, sx + at[0] - P(u, v)[0], SIDE, sz + at[1] - P(u, v)[1], ry, 'sit', s.seed + k, { seatY: .5 }); } });
  if (!plaza) putC(picnic(0xa4652f), rot, .7, .2);
  else { const at = putC(milkCrate(PAL.red), rot, .8, .3); if (at) life(A, at[0] + .2, SIDE, at[1] + .2, ry + .6, 'phone', s.seed + 9); }
  return 0;
}

// pass 2 · a sim supply site's yard (gen.js siteYards): packed gravel, a chain-link fence on the sides that aren't the street, open to it
function siteYard(bank, l) {
  const V = new Vol(Math.round(l.w / CV), 16, Math.round(l.d / CV), { s: CV, org: [l.x0, SIDE, l.z0] }), nx = V.nx, nz = V.nz, side = l.main;
  V.box(0, 0, 0, nx, 1, nz, (x, y, z) => ((x * 7 + z * 13) % 11 === 0) ? 0x8f8a80 : ((x * 3 + z * 5) % 17 === 0) ? 0xb3ada1 : 0xa39d92);
  const fence = (x0, z0, x1, z1) => V.box(x0, 1, z0, x1, 15, z1, (x, y, z) => (y === 14 || ((x + z) % 12 === 0)) ? 0x6f727b : ((x + y + z) % 2 === 0 ? 0x9a9aa6 : undefined));
  if (side !== '-z') fence(0, 0, nx, 1); if (side !== '+z') fence(0, nz - 1, nx, nz); if (side !== '-x') fence(0, 0, 1, nz); if (side !== '+x') fence(nx - 1, 0, nx, nz);
  REG.surface(V); meshVol(V, bank); return 0;
}
