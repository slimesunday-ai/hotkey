// WALLS · the paint layer on bare walls (owner: the walls agent; STYLE §12, PASS-walls.md). NYC's walls talk: hand-painted side-wall
// ads high on firewalls, murals, memorial walls, and graffiti (tags, throw-ups, full pieces, sprayed shutters, heaven spots).
//
// How it runs: one core hook (vox.js HOOKS.wall, called by meshVol just before a building volume is meshed, after the neighbour clip),
// so it covers every district, generator kits and custom kits alike, without touching a kit. For each face of the building's mass it
// reads the real voxels: a pixel is BARE when the wall skin there is the face's own wall colour, nothing stands in front of it for
// 0.3 m, and no other building's mass hides it. Paint only ever recolours bare skin (never a window, door, sign, set piece, mural
// or a hero), so everything that exists stays exactly where it is. Heroes' blocks are skipped whole.
//   · the far tier: the big pieces are remembered per block (REG.blk.walls.far) and painted as colour onto the block's 0.5-cube far
//     volume when it is meshed in the same build (the spec-pass far fill, a kit's far(ctx)); downsampled far tiers carry them anyway.
//   · variety: murals, pieces and art walls are drawn city-wide on a class lattice (signage/alloc.js's idea: block (i, j) draws only
//     from class (i mod n, j mod n), without replacement in a block), so no design shows twice within n − 1 blocks; painted ads come
//     from the signage wall pool itself (signage/alloc.js pick). Writers' tags are the one exception: they recur, sparsely.
//   · the audit: the paint is part of the building's structure; relief (candles, a shutter's housing) is kept clear with REG.keep;
//     every design is logged with signage/alloc.js logSign (the sign-repeat check: murals 128–192 m, a writer's tag within its block).
import { HOOKS, Vol, meshed } from '../vox.js';
import { REG } from '../audit.js';
import { PAL, hash } from '../style.js';
import { frame } from '../kit.js';
import { kitFor } from '../modules.js';
import { mix } from '../signage/art.js';
import { POOLS } from '../signage/designs.js';
import { pick, state, logSign } from '../signage/alloc.js';
import { wallImg } from '../signage/boards.js';
import * as PT from './paint.js';
import { WRITERS, WAYS, RIP_NICK, RIP_LAST, RIP_LINE, FIGHTERS, RING, COURTS, HOOP, COLLECT, ARTISTS, HOOD, PAINTERS } from './roster.js';
import { P as PITCH, HS, SPREAD, unshift } from '../../../world/city.js';   // (SPREAD: the plan's pitch, never a literal 32; unshift: the rolls read today's place)

export const WALLS = { on: true };
// ── density by district (the kit that builds the block). p: the share of blocks that get any paint; the rest are caps per block
const PROFILE = {
  heavy: { p: 1, big: 2, ad: 1, piece: 2, throw: 4, tag: 6, heaven: 2, gate: .6, side: 1, total: 16 },
  medium: { p: .8, big: 1, ad: 1, piece: 1, throw: 2, tag: 3, heaven: 1, gate: .35, side: 1, total: 9 },
  light: { p: .6, big: 1, ad: 1, piece: 0, throw: 1, tag: 2, heaven: 1, gate: .15, side: 0, total: 3 },
  section1: { p: .5, big: 1, ad: 1, piece: 0, throw: 1, tag: 1, heaven: 1, gate: .08, side: 0, total: 1 },
  minimal: { p: 1, big: 1, ad: 0, piece: 0, throw: 0, tag: 0, heaven: 0, gate: 0, side: 0, total: 1 },
};
const DIST = { junkyard: 'heavy', industrial: 'heavy', docks: 'heavy', strip: 'heavy', trailer: 'heavy', downtown: 'medium', mall: 'medium', hospital: 'light', highway: 'light', suburbs: 'minimal', estates: 'minimal' };
// the minimal districts paint in one block only (Pleasantview: the block across from P.S. 280; Gatehill: one commissioned wall). Neither has a
// bare wall big enough today (houses and glass towers), so both stay clean: PASS-walls.md asks the school's and the towers' owners for one
const MINIMAL = { suburbs: [4, 7], estates: [-8, 6] };
// memorial walls (asked for: the Yards, the docks, the fringe's west side, Sunny Acres; MARISOL is the docks' first): the first wall in the block that fits one
const MEMO = new Set(['5,-7', '4,-8', '-5,-1', '-6,-1']);
// what a big wall becomes, by district (weights). ad: a hand-painted side-wall ad · rip: a memorial wall · box / hoop: the ring, the
// court · collect: grails in slabs · art: the art scene · hood: the neighbourhood's own mural · piece: a writer's full piece
const MIX = {
  junkyard: { ad: 1, rip: 2, box: 1, art: 1, hood: 2, piece: 4 }, industrial: { ad: 4, rip: 1, box: 1, art: 1, hood: 2, piece: 3 },
  docks: { ad: 4, rip: 2, box: 2, art: 1, hood: 2, piece: 2 }, strip: { ad: 4, rip: 1, box: 1, hoop: 1, collect: 2, art: 3, hood: 1, piece: 2 },
  trailer: { ad: 1, rip: 2, hoop: 2, art: 1, hood: 3, piece: 2 }, downtown: { ad: 4, rip: 1, box: 1, hoop: 1, collect: 1, art: 2, hood: 1, piece: 1 },
  mall: { ad: 2, rip: 1, hoop: 1, collect: 2, art: 3, hood: 2, piece: 2 }, hospital: { ad: 2, rip: 1, art: 2, hood: 3 }, highway: { ad: 4, art: 1, hood: 2, piece: 1 },
  suburbs: { hood: 1 }, estates: { art: 1 },
};
const FADED = { industrial: .7, docks: .7, junkyard: .6, highway: .75, trailer: .5, mall: .6, downtown: .35, strip: .2, hospital: .3 };
const GROUND_ONLY = new Set(['rip', 'box', 'hoop', 'piece']);

// ── the design pools (built once). Keys are what the audit compares; each list is dealt round the lattice classes.
const R2 = (k, s) => hash(k, s, 5101);
// what people leave at the foot of a memorial wall (voxels 0.1–0.2 m proud of the wall, on the ground or the base course)
const OFFER = [['candles', 'flowers'], ['candles', 'bottle'], ['flowers', 'photo'], ['candles', 'photo', 'bottle'], ['flowers', 'bottle', 'candles'], ['photo', 'candles', 'teddy']];
const lookOf = k => ({ roll: (k * 2654435761 + 12345) >>> 8 });
const RIP = RIP_NICK.map((nick, k) => { const born = 1968 + ((R2(k, 1) * 38) | 0), died = Math.min(2026, Math.max(born + 17, 2009 + ((R2(k, 2) * 18) | 0)));
  return { key: 'RIP ' + nick, kind: 'rip', nick, full: nick + ' ' + RIP_LAST[k % RIP_LAST.length], born, died, line: RIP_LINE[k % RIP_LINE.length], seed: 1000 + k * 17, look: lookOf(k + 300), gold: k % 3 === 0,
    pal: (k + (k >> 1) * 5) % 6, style: ['wings', 'photo', 'clouds', 'sun', 'stars'][(k + ((k / 4) | 0) * 3) % 5], title: ['R.I.P.', 'REST IN PEACE', 'IN LOVING MEMORY', 'R.I.P.', 'FOREVER'][(k + ((k / 3) | 0)) % 5], offer: OFFER[(k + (k >> 1) * 5) % OFFER.length] }; });   // (the placed ones differ in all four)
const BOX = FIGHTERS.map((name, k) => { const w = 18 + ((R2(k, 3) * 22) | 0), l = (R2(k, 4) * 4) | 0; return { key: 'CHAMP ' + name, kind: 'box', name, title: RING[k % RING.length], rec: `${w}-${l} ${Math.round(w * .7)} KO`, seed: 2000 + k * 13, look: lookOf(k + 500) }; });
const HOOPS = COURTS.map((court, k) => ({ key: 'COURT ' + court, kind: 'hoop', court, rule: HOOP[k % HOOP.length], seed: 3000 + k * 11, look: lookOf(k + 700) }));
const COLL = COLLECT.map((head, k) => ({ key: 'SLABS ' + head, kind: 'collect', head, seed: 4000 + k * 7 }));
const ART_ICONS = ['diamond', 'chain', 'crown', 'flame', 'heart', 'money', 'star', 'sneaker', 'bolt', 'rat', 'dice', 'record'];
const ART = Array.from({ length: 72 }, (_, k) => { const style = ['head', 'icon', 'geo'][k % 3]; return { key: `ART ${ARTISTS[k % ARTISTS.length]} ${k}`, kind: 'art', style, icon: ART_ICONS[(k / 3 | 0) % ART_ICONS.length], look: lookOf(k + 900), seed: 5000 + k * 19, sig: `${ARTISTS[k % ARTISTS.length]} '${19 + (k % 8)}` }; });
const HOOD_ANY = ['BLOCK LOVE', 'WE STILL HERE', 'RESPECT THE BLOCK', 'SUMMER 26', 'NEIGHBORS', 'STAY GOLD', 'KEEP IT CLEAN', 'LOOK OUT FOR EACH OTHER', 'BORN HERE', 'SLOW DOWN KIDS PLAY', 'NO PLACE LIKE IT',
  'HOME TEAM', 'SAME CORNER SINCE 88', 'MAMA SAID COME HOME', 'SUNDAY DOMINOES', 'EVERYBODY EATS', 'HOLD THE DOOR', 'OPEN HYDRANT SEASON', 'GRANDMA WATCHING', 'NO SLEEP TIL THE 9', 'WAVE TO THE BUS'];
const HOODS = {}; for (const [dist, lines] of Object.entries(HOOD)) HOODS[dist] = [...lines, ...(dist === 'suburbs' || dist === 'estates' ? [] : HOOD_ANY)].map((line, k) => ({ key: 'HOOD ' + line, kind: 'hood', line, seed: 6000 + k * 23 + dist.length * 101, kids: dist === 'suburbs' }));
const PIECES = []; WRITERS.forEach((wr, a) => wr.w >= 1 && WAYS.forEach((way, b) => PIECES.push({ key: `PIECE ${wr.name} ${way.key}`, kind: 'piece', wr, way, seed: 7000 + a * 37 + b * 5 })));
// the lattice: block (i, j) draws only from class (i mod n, j mod n) (designs dealt round the n² classes), in a tile-seeded order,
// never a design already used in the block (the block's signage state). n = 6 → nothing repeats within 5 blocks (160 m).
const mod = (a, n) => ((a % n) + n) % n;
function draw(list, i, j, n, ok) { const N = n * n, c = mod(i, n) + n * mod(j, n), ti = Math.floor(i / n), tj = Math.floor(j / n), used = state(i, j).used;
  const S = list.filter((d, k) => k % N === c).map((d, k) => [d, hash(ti * 7919 + k * 31 + c, tj * 104729 + k, 3301)]).sort((a, b) => a[1] - b[1]);
  for (const [d] of S) { if (used.has(d.key) || (ok && !ok(d))) continue; used.add(d.key); return d; } return null; }
const LAT = { rip: 5, box: 3, hoop: 3, collect: 3, art: 6, hood: 5, piece: 4 };

// ── per-block state (REG.blk is the block being built; it is fresh for every block)
function blockState() {
  const b = REG.blk; if (b.walls) return b.walls; const { i, j } = b; let kit = null; try { kit = kitFor(i, j); } catch { kit = null; }
  const hero = !kit || kit.status === 'broken' || !!kit.heroAt?.(i, j), dist = kit?.district || '*', sec1 = dist === 'downtown' && i >= -3 && i <= 2 && j >= -3 && j <= 0;
  let prof = sec1 ? 'section1' : DIST[dist] || null; if (prof === 'minimal' && !(MINIMAL[dist] && MINIMAL[dist][0] === i && MINIMAL[dist][1] === j)) prof = null;
  const P = prof ? PROFILE[prof] : null;
  const memo = globalThis.WALLS_MEMO_SCAN ? ['industrial', 'docks', 'trailer'].includes(dist) || (dist === 'downtown' && i <= -4) : MEMO.has(i + ',' + j);
  return b.walls = { i, j, dist, prof, P, hero, memo, live: WALLS.on && !!kit && kit.status !== 'broken' && !!P && hash(i, j, 4403) < P.p, n: { total: 0 }, writers: new Map(), far: [], log: [] };
}
const can = (S, k) => (S.n[k] || 0) < (S.P[k] ?? 0) && S.n.total < S.P.total;
const took = (S, k, big) => { S.n[k] = (S.n[k] || 0) + 1; S.n.total++; if (big) S.n.big = (S.n.big || 0) + 1; };
// a writer for this block: home writers first, never the same writer twice for the same kind of mark in one block
// (the wink writer, AFK, only ever turns up on a roofline)
function writerFor(S, kind, salt, heaven = false) {
  const used = S.writers.get(kind) || new Set(); let best = null, bs = -1;
  WRITERS.forEach((wr, k) => { if (used.has(wr.name) || (heaven && !wr.heaven) || (!heaven && wr.w < 1)) return; const w = wr.w * (wr.home.includes(S.dist) ? 5 : 1), sc = Math.pow(Math.max(1e-6, hash(S.i * 131 + k, S.j * 71 + salt, 919)), 1 / w); if (sc > bs) { bs = sc; best = wr; } });
  if (best) { used.add(best.name); S.writers.set(kind, used); } return best; }

// ───────────────────────── one face of a building: the bare map
const SIDES = ['-z', '+z', '-x', '+x'];
const NORM = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] };
function faceOf(V, B0, side, own) {
  const s = V.s, d = V.d, nx = V.nx, sxz = V.sxz; let B = { ...B0 }, f = frame(V, B, side), L = f.len, top = B0.top;
  const at = (a, y, dd) => { const [x, z] = f.xz(a, dd); return x >= 0 && z >= 0 && y >= 0 && x < nx && z < V.nz && y < V.ny ? d[x + z * nx + y * sxz] : 0; };
  // the skin may sit a voxel or two inside the footprint (a custom mass): take the depth most samples agree on
  const cnt = [0, 0, 0]; for (let a = 2; a < L - 2; a += 3) for (let y = 2; y < top - 2; y += 4) for (let k = 0; k < 3; k++) if (at(a, y, -k)) { cnt[k]++; break; }
  const inset = cnt.indexOf(Math.max(...cnt)); if (inset) { B = { ...B }; if (side === '+z') B.z1 -= inset; if (side === '-z') B.z0 += inset; if (side === '+x') B.x1 -= inset; if (side === '-x') B.x0 += inset; f = frame(V, B, side); }
  const at2 = (a, y, dd) => { const [x, z] = f.xz(a, dd); return x >= 0 && z >= 0 && y >= 0 && x < nx && z < V.nz && y < V.ny ? d[x + z * nx + y * sxz] : 0; };
  const hist = new Map(); for (let a = 1; a < L - 1; a += 2) for (let y = 1; y < top - 1; y += 2) { const v = at2(a, y, 0); if (v && !at2(a, y, 1)) hist.set(v, (hist.get(v) || 0) + 1); }
  let wall = 0, wn = 0; for (const [v, n] of hist) if (n > wn) { wn = n; wall = v; } if (!wall || wn < 30) return null;   // (under ~120 bare pixels: nothing fits)
  const WS = new Set([wall]), wc = V.pal[wall], ch = (c, k) => (c >> k) & 255;   // (a stripe of the wall's own shade: siding, corrugated sheet)
  for (const [v, n] of hist) { if (v === wall || n < wn * .2) continue; const c = V.pal[v], r = [16, 8, 0].map(k => (ch(c, k) + 1) / (ch(wc, k) + 1)); if (Math.max(...r) - Math.min(...r) < .12 && r[0] > .55 && r[0] < .97) WS.add(v); }
  const [nX, nZ] = NORM[side], plane = side === '+z' ? V.org[2] + B.z1 * s : side === '-z' ? V.org[2] + B.z0 * s : side === '+x' ? V.org[0] + B.x1 * s : V.org[0] + B.x0 * s;
  const along = a => { const [x, z] = f.xz(a, 0); return nX ? V.org[2] + (z + .5) * s : V.org[0] + (x + .5) * s; };
  const world = (a, out) => { const u = along(a), p = plane + (nX || nZ) * out; return nX ? [p, u] : [u, p]; };
  // hidden: another building's mass (built, or planned for this block) stands within 0.9 m of the face
  const hid = new Uint8Array(L * top), b = REG.blk, sg = nX || nZ;
  for (const m of b.feet.concat(b.plan)) { if (m === own || m.group === own.group) continue; const bx = m.box, n0 = nX ? bx[0] : bx[2], n1 = nX ? bx[3] : bx[5];
    const lo = sg > 0 ? plane + .01 : plane - .9, hi = sg > 0 ? plane + .9 : plane - .01; if (n1 <= lo || n0 >= hi) continue; const u0 = nX ? bx[2] : bx[0], u1 = nX ? bx[5] : bx[3], yt = Math.min(top, Math.ceil((bx[4] - V.org[1]) / s));
    for (let a = 0; a < L; a++) { const u = along(a); if (u > u0 && u < u1) for (let y = 0; y < yt; y++) hid[a + y * L] = 1; } }
  const bare = (a, y) => a >= 0 && y >= 0 && a < L && y < top && !hid[a + y * L] && WS.has(at2(a, y, 0)) && !at2(a, y, 1) && !at2(a, y, 2) && !at2(a, y, 3);
  const M = new Uint8Array(L * top); let nb = 0; for (let y = 0; y < top; y++) for (let a = 0; a < L; a++) if (bare(a, y)) { M[a + y * L] = 1; nb++; }
  const [cx, cz] = world(L >> 1, 1.2), g = REG.groundAt ? REG.groundAt(cx, cz) : .2, street = REG.onWalk(cx, cz) || g < .1;
  // the lettered things on this face (text records: ghost signs, boards, painted ads): tags keep off them, so a writer's name never reads as the shop's
  const signs = []; if (V.texts) for (const t of V.texts) { let a0 = 1e9, a1 = -1e9, y0 = 1e9, y1 = -1e9; const p = t.pts;
    for (let k = 0; k < p.length; k += 8) { const x = p[k], y = p[k + 1], z = p[k + 2], [a, dd] = side === '+z' ? [x - B.x0, z - (B.z1 - 1)] : side === '-z' ? [B.x1 - 1 - x, B.z0 - z] : side === '-x' ? [z - B.z0, B.x0 - x] : [B.z1 - 1 - z, x - (B.x1 - 1)];
      if (dd < -1 || dd > 4) continue; if (a < a0) a0 = a; if (a > a1) a1 = a; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (a1 >= a0) signs.push([a0, a1, y0, y1]); }
  const flush = (a, y) => { const v = at2(a, y, 0); return v && !WS.has(v) && !at2(a, y, 1); };   // flat paint of another colour: a painted ad's panel, a ghost sign, a mural
  return { V, f, side, L, top, wall, wallCol: V.pal[wall], bare, at: at2, M: erode(M, L, top, 2, 1), nb, world, plane, along, street, ground: g, s, lay: V.lay[wall], signs, flush };
}
// a cell stays bare only if its (2r+1)² neighbourhood is: paint keeps clear of trims, sills, signs and edges
function erode(M, W, Hh, r, ry = r) { const T = new Uint8Array(M.length), O = new Uint8Array(M.length), n = 2 * r + 1, m = 2 * ry + 1;
  for (let y = 0; y < Hh; y++) { let run = 0; for (let a = 0; a < W; a++) { run = M[a + y * W] ? run + 1 : 0; if (run >= n) T[a - r + y * W] = 1; } }
  for (let a = 0; a < W; a++) { let run = 0; for (let y = 0; y < Hh; y++) { run = T[a + y * W] ? run + 1 : 0; if (run >= m) O[a + (y - ry) * W] = 1; } }
  return O; }
// the largest bare rectangle (histogram method) with at least minW × minH
function bestRect(M, W, Hh, minW, minH) { const hg = new Int32Array(W), st = new Int32Array(W + 1); let best = null, ba = 0;
  for (let y = 0; y < Hh; y++) { for (let a = 0; a < W; a++) hg[a] = M[a + y * W] ? hg[a] + 1 : 0; let sp = 0;
    for (let a = 0; a <= W; a++) { const h = a < W ? hg[a] : 0; while (sp && hg[st[sp - 1]] >= h) { const t = st[--sp], hh = hg[t], left = sp ? st[sp - 1] + 1 : 0, w = a - left;
      if (hh >= minH && w >= minW && w * hh > ba) { ba = w * hh; best = { a0: left, y0: y - hh + 1, w, h: hh }; } } st[sp++] = a; } }
  return best; }
const clearRect = (M, W, R, pad) => { for (let y = Math.max(0, R.y0 - pad); y < R.y0 + R.h + pad; y++) for (let a = Math.max(0, R.a0 - pad); a < Math.min(W, R.a0 + R.w + pad); a++) if (y * W + a < M.length) M[a + y * W] = 0; };

// lay a picture on the face: bottom-left at (a0, y0). Only bare skin takes paint; relief pixels (I.z) stand proud into free air.
function lay(F, I, a0, y0) { let n = 0;
  for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) { const k = i + j * I.w, c = I.c[k]; if (c < 0) continue; const a = a0 + i, y = y0 + I.h - 1 - j; if (!F.bare(a, y)) continue;
    F.f.set(a, y, 0, c, I.l[k]); n++; for (let z = 1; z <= I.z[k]; z++) F.f.set(a, y, z, c, I.l[k]); }
  return n; }
// the world box of a stretch of the face (for REG.keep and the sign log)
function wbox(F, a0, a1, y0, y1, out) { const s = F.s, oy = F.V.org[1], [nX] = NORM[F.side], u0 = Math.min(F.along(a0), F.along(a1)) - s / 2, u1 = Math.max(F.along(a0), F.along(a1)) + s / 2, p0 = Math.min(F.plane, F.plane + (nX || NORM[F.side][1]) * out) + .005, p1 = Math.max(F.plane, F.plane + (nX || NORM[F.side][1]) * out);
  return nX ? [p0, oy + y0 * s, u0, p1, oy + y1 * s, u1] : [u0, oy + y0 * s, p0, u1, oy + y1 * s, p1]; }   // (out of the wall only: never into its own mass)
function note(S, F, kind, key, a0, w, y0, h, fam, r, big, I) {
  const [x, z] = F.world(a0 + (w >> 1), .1); logSign(fam, key, x, z, { r, where: 'walls-' + kind, cat: kind, face: F.side, y: +(F.V.org[1] + (y0 + h / 2) * F.s).toFixed(1), wm: +(w * F.s).toFixed(1), hm: +(h * F.s).toFixed(1) });
  S.log.push({ kind, key, x: +x.toFixed(1), z: +z.toFixed(1), w: +(w * F.s).toFixed(1), h: +(h * F.s).toFixed(1) });
  if (big && I) S.far.push({ side: F.side, plane: F.plane, u0: F.along(a0), u1: F.along(a0 + w - 1), y0: F.V.org[1] + y0 * F.s, y1: F.V.org[1] + (y0 + h) * F.s, I, flip: F.along(a0 + 1) < F.along(a0) }); }

// ───────────────────────── the placements
const FITS = new Map(), fits = (d, w, h) => { const k = d.key + '|' + w + '|' + h; let r = FITS.get(k); if (!r) { const I = wallImg(d, w, h); r = I.miss ? 'miss' : I.fell ? 'fell' : 'ok'; FITS.set(k, r); } return r; };
function placeBig(S, F, R, kind, salt) {
  const s = F.s, { i, j } = S;
  if (kind === 'ad') { // a hand-painted side-wall ad, high on the wall: a signage design in a painted frame, the painter's credit; old ones faded
    const w = Math.min(R.w, 140), h = Math.min(R.h, 96, Math.round(w * .78)), iw = w - 6, ih = h - 10; if (iw < 30 || ih < 20) return false;
    const d = pick(POOLS.wall, i, j, { ok: d => fits(d, iw, ih) === 'ok' && (!d.look || iw > ih * 1.25) }) || pick(POOLS.wall, i, j, { ok: d => fits(d, iw, ih) !== 'miss' });
    if (!d) return false; const inner = wallImg(d, iw, ih), old = hash(i * 17 + salt, j, 61) < (FADED[S.dist] ?? .4), bd = [PAL.ink, PAL.red, 0x2f5bff, PAL.cream][(hash(i, j, salt) * 4) | 0];
    const I = PT.framed(inner, w, h, { border: bd, bg: inner.pal?.bg, credit: PAINTERS[(hash(i, j + salt, 5) * PAINTERS.length) | 0] }); if (old) PT.fade(I, F.wallCol, .3, i * 31 + j + salt);
    const a0 = R.a0 + ((R.w - w) >> 1), y0 = R.y0 + R.h - h; lay(F, I, a0, y0); note(S, F, old ? 'ad-faded' : 'ad', d.key, a0, w, y0, h, 'wall', 96, true, I); return true; }
  const n = LAT[kind], list = kind === 'rip' ? RIP : kind === 'box' ? BOX : kind === 'hoop' ? HOOPS : kind === 'collect' ? COLL : kind === 'art' ? ART : kind === 'hood' ? HOODS[S.dist] || HOODS.downtown : PIECES;
  let w, h; const MW = R.w, MH = R.h;
  if (kind === 'rip') { w = Math.min(MW, 90); h = Math.min(MH, Math.round(w * 1.25), 110); if (h < 38 && S.memo) { w = Math.min(MW, 80); h = Math.min(MH, 34); if (w < 40 || h < 20) return false; } else if (w < 40 || h < 38) return false; }
  else if (kind === 'box' || kind === 'hoop') { w = Math.min(MW, 110); h = Math.min(MH, Math.round(w * .95), 100); if (w < 50 || h < 46) return false; }
  else if (kind === 'collect') { w = Math.min(MW, 130); h = Math.min(MH, Math.round(w * .62), 80); if (w < 56 || h < 34) return false; }
  else if (kind === 'art') { w = Math.min(MW, 130); h = Math.min(MH, 120); if (w < 50 || h < 44) return false; }
  else if (kind === 'hood') { w = Math.min(MW, 150); h = Math.min(MH, Math.round(w * .6), 90); if (w < 60 || h < 36) return false; }
  else { w = Math.min(MW, 140); h = Math.min(MH, 46, Math.round(w * .5)); if (w < 40 || h < 22) return false; }
  const d = draw(list, i, j, n, kind === 'piece' ? (d => d.wr.home.includes(S.dist) || hash(i, j, d.seed) < .35) : null) || (kind === 'piece' ? draw(list, i, j, n) : null); if (!d) return false;
  let I = null; if (kind === 'piece') { I = PT.pieceImg(d.wr, d.way, w, h, d.seed + i * 7 + j); if (!I) return false; }
  else I = kind === 'rip' ? PT.ripImg(d, w, h) : kind === 'box' ? PT.boxImg(d, w, h) : kind === 'hoop' ? PT.hoopImg(d, w, h) : kind === 'collect' ? PT.collectImg(d, w, h) : kind === 'art' ? PT.artImg(S.dist === 'estates' ? { ...d, style: 'geo', plaque: true, sig: 'GATEHILL TRUST ' + d.sig } : d, w, h) : PT.hoodImg(d, w, h);
  const a0 = R.a0 + ((R.w - w) >> 1), y0 = GROUND_ONLY.has(kind) || kind === 'hood' ? R.y0 : R.y0 + ((R.h - h) >> 1); if (!lay(F, I, a0, y0)) return false;
  if (kind === 'rip') offerings(F, a0, w, y0, d.offer || ['candles', 'flowers'], d.seed);
  note(S, F, kind, d.key, a0, w, y0, h, kind === 'piece' ? 'piece' : 'mural', LAT[kind] * PITCH, true, I); return true;
}
// offerings at the foot of a memorial wall: candles, flowers, a bottle, a photo in a frame, a teddy bear. They stand in free air on the
// ground or on the base course, 0.1–0.2 m proud, kept clear of props (REG.keep), and each wall's set is its own
const OFFER_DRAW = {
  candles: (F, a, b, k) => { const c = [PAL.red, PAL.white, PAL.yellow, 0x2f5bff, 0x7a3cff][(k * 3) % 5], t = 1 + (k % 2); for (let y = 0; y < t; y++) F.f.set(a, b + y, 1, c, 1); F.f.set(a, b + t, 1, 0xffc766, 3); return 1; },
  flowers: (F, a, b, k) => { const c = [PAL.pink, PAL.red, PAL.yellow, PAL.white][k % 4]; F.f.set(a, b, 1, 0x1d8f3c); F.f.set(a, b + 1, 1, 0x1d8f3c); F.f.set(a, b + 2, 1, c); F.f.set(a + 1, b + 2, 1, [PAL.pink, PAL.red, PAL.yellow, PAL.white][(k + 1) % 4]); F.f.set(a, b, 2, 0x1d8f3c); return 2; },
  bottle: (F, a, b) => { for (let y = 0; y < 3; y++) F.f.set(a, b + y, 1, 0x6e3e19, 1); F.f.set(a, b + 1, 2, 0xfff0d0); F.f.set(a, b + 3, 1, 0xe7bd4a, 2); return 1; },
  photo: (F, a, b, k) => { for (let i = 0; i < 3; i++) for (let y = 0; y < 4; y++) F.f.set(a + i, b + y, 1, i === 1 && y > 0 && y < 3 ? [0x3fa9f5, 0xff7a1a, 0x25b84c][k % 3] : PAL.white); return 3; },
  teddy: (F, a, b) => { for (let i = 0; i < 2; i++) for (let y = 0; y < 3; y++) F.f.set(a + i, b + y, 1, 0x9a6a3a); F.f.set(a, b + 3, 1, 0x9a6a3a); F.f.set(a + 1, b + 3, 1, 0x9a6a3a); F.f.set(a, b + 1, 2, PAL.red); return 2; },
};
function offerings(F, a0, w, y0, set, seed) { if (F.V.org[1] + y0 * F.s - F.ground > 1.4) return; const n = Math.max(5, Math.round(w / 6));
  for (let k = 0; k < n; k++) { const kind = set[k % set.length], a = a0 + 3 + Math.round(k * (w - 8) / Math.max(1, n - 1)) + ((hash(k, a0, seed) * 3) | 0) - 1; let base = -1;
    for (let y = 0; y <= y0 + 1; y++) if (!F.at(a, y, 1) && !F.at(a + 2, y, 1) && !F.at(a, y, 2) && (y === 0 || (F.at(a, y - 1, 1) && F.at(a + 2, y - 1, 1)))) { base = y; break; } if (base < 0) continue;
    const box = wbox(F, a, a + 3, base, base + 5, .25); if (REG.why(box, { ignore: ['plinth', 'facade', 'walkway', 'corner-zone'], doors: true, walk: false })) continue;
    OFFER_DRAW[kind](F, a, base, k); REG.keep(box, 'facade'); }
}
// a roll-down shutter painted on a bare ground-floor wall (a side gate), sprayed with a writer's throw-up
function sideGate(S, F, R, salt) { const w = Math.min(R.w, 32), h = Math.min(R.h, 28); if (w < 24 || h < 24) return false;
  const wr = writerFor(S, 'throw', salt), spray = wr && (PT.throwImg(wr, w - 2, h - 8, salt) || PT.tagImg(wr, w - 2, h - 8, salt)), I = PT.gateImg(w, h, salt, spray), a0 = R.a0 + ((R.w - w) >> 1), y0 = R.y0;
  if (!lay(F, I, a0, y0)) return false; REG.keep(wbox(F, a0, a0 + w, y0 + h - 4, y0 + h, .25), 'facade'); note(S, F, 'gate', 'GATE ' + (wr ? wr.name : salt), a0, w, y0, h, 'tag', 0, false); return true; }
// a mark this close to a sign (0.5 m to the side, 0.9 m above or below) would read as part of it
const nearSign = (F, a0, a1, y0, y1) => { if (F.signs.some(([b0, b1, c0, c1]) => a1 >= b0 - 5 && a0 <= b1 + 5 && y1 >= c0 - 9 && y0 <= c1 + 9)) return true;
  for (let a = a0 - 3; a <= a1 + 3; a += 2) for (const y of [y0 - 2, y0 - 5, y0 - 8, y1 + 2, y1 + 5]) if (F.flush(a, y)) return true; return false; };   // (nor flush on top of a painted panel)
function small(S, F, R, kind, salt) {
  const wr = writerFor(S, kind, salt, kind === 'heaven'); if (!wr) return false; let I = null;
  if (kind === 'tag') I = PT.tagImg(wr, Math.min(R.w, 90), Math.min(R.h, 26), salt);
  else if (kind === 'throw') I = PT.throwImg(wr, Math.min(R.w, 70), Math.min(R.h, 30), salt);
  else I = PT.heavenImg(wr, Math.min(R.w, 80), Math.min(R.h, 22), salt);
  if (!I || I.w > R.w || I.h > R.h) return false; let a0 = R.a0 + (((R.w - I.w) * hash(salt, 3, 7)) | 0), y0 = kind === 'heaven' ? R.y0 + R.h - I.h : R.y0 + (((R.h - I.h) * hash(salt, 4, 7) * .6) | 0);
  if (nearSign(F, a0, a0 + I.w, y0, y0 + I.h)) { let ok = false; for (let t = 0; t <= R.w - I.w && !ok; t += 4) for (const y of [R.y0, R.y0 + ((R.h - I.h) >> 1), R.y0 + R.h - I.h]) if (!nearSign(F, R.a0 + t, R.a0 + t + I.w, y, y + I.h)) { a0 = R.a0 + t; y0 = y; ok = true; break; } if (!ok) return false; }
  if (!lay(F, I, a0, y0)) return false; note(S, F, kind, (kind === 'heaven' ? 'HEAVEN ' : kind === 'throw' ? 'THROW ' : 'TAG ') + wr.name, a0, I.w, y0, I.h, 'tag', 0, false); return true; }
// the choice for a big wall, weighted by the district's mix; ground-level kinds need the wall to reach the ground
function bigKind(S, high, salt, taken) { if (S.memo && !high && !S.n.rip && !S.vol) return 'rip'; const mixW = S.vol ? { piece: 1 } : MIX[S.dist] || MIX.downtown, opts = [];
  for (const [k, w] of Object.entries(mixW)) { if (!w || taken.has(k) || (high && GROUND_ONLY.has(k)) || (k === 'ad' && !can(S, 'ad')) || (k === 'piece' && !can(S, 'piece'))) continue; opts.push([k, w * (k === 'ad' && high ? 2 : 1)]); }
  if (!opts.length) return null; const t = opts.reduce((a, o) => a + o[1], 0); let x = hash(S.i * 7 + salt, S.j * 13, 211) * t; for (const [k, w] of opts) if ((x -= w) < 0) return k; return opts[0][0]; }

// ───────────────────────── gates that already exist: the half-down roll gates of the shopfronts (signage/shop.js) get sprayed
const GATE = new Set([0x8f949c, 0xb9bec6]);
function sprayGates(S, F, salt) { const L = F.L, top = Math.min(F.top, 30), isG = (a, y) => { const v = F.at(a, y, 2); return v && GATE.has(F.V.pal[v]) && !F.at(a, y, 3); };
  let a = 0, done = 0; while (a < L) { if (!isG(a, 20) && !isG(a, 16)) { a++; continue; } let a1 = a; while (a1 < L && (isG(a1, 20) || isG(a1, 16) || F.at(a1, 20, 3))) a1++;
    let y0 = 0; while (y0 < top && !isG(a + 1, y0) && !isG((a + a1) >> 1, y0)) y0++; const w = a1 - a, h = 24 - y0;
    if (w >= 16 && h >= 9 && hash(S.i * 3 + a + salt, S.j, 97) < S.P.gate) { const wr = writerFor(S, 'gate', salt + a); const I = wr && (PT.throwImg(wr, w - 2, h - 1, salt + a) || PT.tagImg(wr, w - 2, h - 1, salt + a));
      if (I) { const ox = a + ((w - I.w) >> 1), oy = y0 + Math.max(0, ((h - I.h) >> 1) - 2); let n = 0;
        for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) { const c = I.c[i + j * I.w]; if (c < 0) continue; const aa = ox + i, yy = oy + I.h - 1 - j; if (!isG(aa, yy)) continue; F.f.set(aa, yy, 2, c); n++; }
        if (n > 20) { note(S, F, 'shutter', 'SHUTTER ' + wr.name, a, w, y0, h, 'tag', 0, false); done++; } } }
    a = a1 + 1; }
  return done; }

// ───────────────────────── the hook: a building volume about to be meshed
function paintBuilding(V, own = V.own, vol = false, far = false) {
  const S = blockState(); if (!S.live || Math.abs(V.s - .1) > 1e-6 || S.n.total >= S.P.total) return; const s = V.s, bx = own.box; S.vol = vol;
  if (S.hero && !/^L\d+$/.test(own.group || '')) return;   // a hero block: only the generated lots round the hero take paint, never the hero itself
  const B = { x0: Math.round((bx[0] - V.org[0]) / s), x1: Math.round((bx[3] - V.org[0]) / s), z0: Math.round((bx[2] - V.org[2]) / s), z1: Math.round((bx[5] - V.org[2]) / s), top: Math.min(V.ny, Math.round((bx[4] - V.org[1]) / s)) };
  if (B.x1 - B.x0 < 12 || B.z1 - B.z0 < 12 || B.top < 20) return;
  const [ux, uz] = unshift(bx[0], bx[2]), seed = Math.round(ux * 10) * 7 + Math.round(uz * 10) * 13;   // (SPREAD: today's corner, so a wall keeps its paint)
  for (const side of SIDES) { if (S.n.total >= S.P.total) return; const F = faceOf(V, B, side, own); if (!F) continue; const salt = seed + side.charCodeAt(1) * 5;
    if (F.street && S.P.gate && !far) sprayGates(S, F, salt);
    if (F.nb < 120) continue; const taken = new Set();
    for (let pass = 0; pass < 3 && S.n.total < S.P.total; pass++) {
      const R = bestRect(F.M, F.L, F.top, 12, 8); if (!R) break; const W = R.w * s, Hm = R.h * s, yb = V.org[1] + R.y0 * s - F.ground, atTop = R.y0 + R.h >= F.top - 3, ps = salt + pass * 101;
      let ok = false;
      const high = yb > 1.6;
      if ((W >= (high ? 5 : 4.2) && Hm >= (high ? 3.4 : 3) || (S.memo && !S.n.rip && !high && W >= 4 && Hm >= 2)) && (S.n.big || 0) < S.P.big) {
        if (!high && Hm >= 7.5 && W >= 6 && can(S, 'piece') && hash(ps, 1, 3) < .5) {   // a tall wall down to the street: an ad or a mural up top, graffiti below
          const low = { a0: R.a0, y0: R.y0, w: R.w, h: 28 }, up = { a0: R.a0, y0: R.y0 + 36, w: R.w, h: R.h - 36 };
          if (placeBig(S, F, low, 'piece', ps)) { took(S, 'piece', true); ok = true; } const k2 = bigKind(S, true, ps + 3, taken); if (k2 && (S.n.big || 0) < S.P.big && placeBig(S, F, up, k2, ps + 5)) { took(S, k2, true); taken.add(k2); ok = true; } }
        else { const k = bigKind(S, high, ps, taken); if (k && hash(ps, 2, 9) < .85) { if (placeBig(S, F, R, k, ps)) { took(S, k, true); taken.add(k); ok = true; } } }
      }
      if (far) { clearRect(F.M, F.L, R, 3); continue; }   // (a far-only build: the small marks don't read at 0.5 m)
      if (!ok && S.P.side && can(S, 'side') && yb < .8 && W >= 2.6 && Hm >= 2.6 && hash(ps, 5, 9) < .35) { const G = { ...R, w: Math.min(R.w, 32) }; if (sideGate(S, F, G, ps)) { took(S, 'side'); ok = true; clearRect(F.M, F.L, { ...G, a0: R.a0 + ((R.w - G.w) >> 1) }, 4); } }
      if (!ok && atTop && yb > 5 && Hm >= .8 && W >= 2 && can(S, 'heaven') && hash(ps, 6, 9) < .6) { const T = { ...R, y0: Math.max(R.y0, R.y0 + R.h - 24), h: Math.min(R.h, 24) }; if (small(S, F, T, 'heaven', ps)) { took(S, 'heaven'); ok = true; } }
      if (!ok && W >= 2.4 && Hm >= 1.3 && can(S, 'throw') && hash(ps, 7, 9) < .45) { if (small(S, F, R, 'throw', ps)) { took(S, 'throw'); ok = true; } }
      if (!ok && W >= 1.2 && Hm >= .7 && can(S, 'tag') && hash(ps, 8, 9) < .8) { if (small(S, F, R, 'tag', ps)) { took(S, 'tag'); ok = true; } }
      clearRect(F.M, F.L, R, 3);   // whatever happened, the next pass looks at another stretch of this face
    }
  }
}
// the far tier: paint the block's big pieces as colour onto its 0.5-cube far volume (the spec-pass fill, a kit's far(ctx))
const AIR = c => mix(c, PAL.horizon, .3);
function paintFar(V) { const S = REG.blk.walls; if (!S?.far.length) return; const s = V.s, o = V.org, at = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < V.nx && y < V.ny && z < V.nz && V.d[x + z * V.nx + y * V.sxz] !== 0;
  for (const p of S.far) { const [nX, nZ] = NORM[p.side], sg = nX || nZ, I = p.I, u0 = Math.min(p.u0, p.u1), u1 = Math.max(p.u0, p.u1);
    for (let y = p.y0 + s / 2; y < p.y1; y += s) for (let u = u0 + s / 2; u < u1; u += s) { const fi = Math.round((u - u0) / Math.max(.01, u1 - u0) * (I.w - 1)), px = p.flip ? I.w - 1 - fi : fi, py = Math.round((1 - (y - p.y0) / Math.max(.01, p.y1 - p.y0)) * (I.h - 1)), c = I.c[Math.max(0, Math.min(I.w - 1, px)) + Math.max(0, Math.min(I.h - 1, py)) * I.w]; if (c < 0) continue;
      const gy = Math.floor((y - o[1]) / s); for (let k = 0; k < 6; k++) { const n = p.plane - sg * (s * (k + .5)), X = nX ? Math.floor((n - o[0]) / s) : Math.floor((u - o[0]) / s), Z = nX ? Math.floor((u - o[2]) / s) : Math.floor((n - o[2]) / s);
        if (!at(X, gy, Z)) continue; if (!at(X + nX, gy, Z + nZ)) V.set(X, gy, Z, AIR(c)); break; } } } }
// ───────────────────────── a kit's free-standing structures (engine.js ctx.volume) in the heavy districts, known by the keep box they
// registered: booths, the office trailer, stalls, the market hall take marks on their bare skin; the Heap's crusher too. A fence is a
// sheet one voxel thick: it gets a one-sided decal (a layer grown onto the side that faces the street, or the Heap's market), never
// paint through the sheet, which would show mirrored on the other side.
const BOXY = new Set(['booth', 'trailer', 'stall', 'crusher', 'market']), HEAP_HERO = new Set(['crusher', 'fence']);
const keepOf = (b, V) => { const x1 = V.org[0] + V.nx * V.s, y1 = V.org[1] + V.ny * V.s, z1 = V.org[2] + V.nz * V.s, e = 1e-4;
  for (const k of b.keep) { const q = k.box; if (Math.abs(q[0] - V.org[0]) < e && Math.abs(q[2] - V.org[2]) < e && Math.abs(q[3] - x1) < e && Math.abs(q[5] - z1) < e && Math.abs(q[1] - V.org[1]) < e && Math.abs(q[4] - y1) < e) return k; } return null; };
function growVol(V, axis, sg) {   // one more layer of voxels on one side (sg: +1 / −1) of a volume, before it is meshed
  const nx = V.nx + (axis === 'x' ? 1 : 0), nz = V.nz + (axis === 'z' ? 1 : 0), ox = axis === 'x' && sg < 0 ? 1 : 0, oz = axis === 'z' && sg < 0 ? 1 : 0, d = new Uint16Array(nx * V.ny * nz);
  for (let y = 0; y < V.ny; y++) for (let z = 0; z < V.nz; z++) for (let x = 0; x < V.nx; x++) d[x + ox + (z + oz) * nx + y * nx * nz] = V.d[x + z * V.nx + y * V.sxz];
  V.d = d; V.nx = nx; V.nz = nz; V.sxz = nx * nz; V.org = [V.org[0] - ox * V.s, V.org[1], V.org[2] - oz * V.s]; }
function paintFence(V, S) {
  const ax = V.nz === 1 && V.nx >= 40 ? 'x' : V.nx === 1 && V.nz >= 40 ? 'z' : null; if (!ax || Math.abs(V.s - .1) > 1e-6) return; const n = ax === 'x' ? V.nx : V.nz, s = V.s, o = V.org;
  const solid = (u, y) => V.d[ax === 'x' ? u + y * V.sxz : u * V.nx + y * V.sxz] !== 0;
  let top = 0; for (let y = 0; y < V.ny; y++) { let c = 0; for (let u = 0; u < n; u += 2) if (solid(u, y)) c++; if (c >= Math.ceil(n / 2) * .95) top = y + 1; else if (y > 2) break; } if (top < 14) return;   // sheets and block walls, never chain-link or slats
  const ctr = ax === 'x' ? [o[0] + n * s / 2, o[2] + s / 2] : [o[0] + s / 2, o[2] + n * s / 2], out = (sg, d = 1.2) => ax === 'x' ? [ctr[0], ctr[1] + sg * d] : [ctr[0] + sg * d, ctr[1]];
  const street = (sg, d) => { const [x, z] = out(sg, d); return REG.onWalk(x, z) || (REG.groundAt ? REG.groundAt(x, z) < .1 : false); };
  let sg = street(1) && !street(-1) ? 1 : street(-1) && !street(1) ? -1 : 0;
  // (SPREAD: a compound's fence stands its margin back from the lot line, so the street may be past it: look out as far again)
  if (!sg && HS) for (const d of [1.2 + HS, 1.2 + SPREAD]) { const a = street(1, d), b = street(-1, d); if (a !== b) { sg = a ? 1 : -1; break; } }
  if (!sg && S.dist === 'junkyard') { const [cx, cz] = unshift(ctr[0], ctr[1]); sg = ax === 'x' ? (-191 > cz ? 1 : -1) : (-33 > cx ? 1 : -1); }   // (inside the Heap: the side that faces the market, at (−33, −191) in today's metres)
  if (!sg) return;
  growVol(V, ax === 'x' ? 'z' : 'x', sg); const t = sg > 0 ? 1 : 0, tf = sg > 0 ? 0 : 1, flip = (ax === 'x') !== (sg > 0);   // decal layer, sheet layer; the picture reads left → right from outside
  const vox = (u, y, tt) => ax === 'x' ? u + tt * V.nx + y * V.sxz : tt + u * V.nx + y * V.sxz, pal = c => V.ci(c, 0);
  const lay = (I, u0, y0) => { let k = 0; for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) { const c = I.c[i + j * I.w]; if (c < 0) continue; const u = flip ? u0 + I.w - 1 - i : u0 + i, y = y0 + I.h - 1 - j;
    if (u < 0 || u >= n || y < 0 || y >= top || !V.d[vox(u, y, tf)]) continue; V.d[vox(u, y, t)] = pal(c); k++; } return k; };
  const O = V.org, world = (u0, u1, y1) => { const a = O[0] + (ax === 'x' ? u0 * s : t * s), b = O[2] + (ax === 'x' ? t * s : u0 * s); return ax === 'x' ? [a, O[1], b, O[0] + u1 * s, O[1] + y1 * s, b + s] : [a, O[1], b, a + s, O[1] + y1 * s, O[2] + u1 * s]; };   // (after the growth: V.org may have moved)
  const clear = (u0, u1) => !REG.why(world(u0, u1, top), { ignore: ['fence', 'plinth', 'walkway', 'corner-zone', 'corner-furniture'], doors: false, walk: false });
  // a run along the sheet: maybe a full piece, throw-ups and tags, with bare sheet between them (and a rest now and then)
  let u = 4 + ((hash(S.i * 5 + n, S.j, 13) * 10) | 0), q = 0; const [ux, uz] = unshift(o[0], o[2]);   // (SPREAD: the sheet's rolls read today's place)
  while (u < n - 12 && S.n.total < S.P.total) { const salt = Math.round(ux * 10) * 7 + Math.round(uz * 10) * 3 + u, r = hash(salt, q, 29); let I = null, kind = null, wr = null;
    if (r < .3 && can(S, 'piece') && n - u > 50) { const d = draw(PIECES, S.i, S.j, LAT.piece, d => d.wr.home.includes(S.dist) || hash(S.i, S.j, d.seed) < .4); if (d) { I = PT.pieceImg(d.wr, d.way, Math.min(90, n - u - 4), top - 1, d.seed + u, true); kind = 'piece'; wr = d.wr; if (I) I.key = d.key; } }
    if (!I && r < .65 && can(S, 'throw')) { wr = writerFor(S, 'throw', salt); I = wr && PT.throwImg(wr, Math.min(60, n - u - 4), top - 2, salt); kind = 'throw'; }
    if (!I && r < .92 && can(S, 'tag')) { wr = writerFor(S, 'tag', salt); I = wr && PT.tagImg(wr, Math.min(40, n - u - 4), Math.min(16, top - 4), salt); kind = 'tag'; }
    const U = I ? (flip ? n - u - I.w : u) : 0;
    if (I && u + I.w < n - 2 && clear(U - 2, U + I.w + 2)) { const y0 = Math.max(1, Math.min(top - I.h - 1, 2 + ((hash(salt, 5, 3) * Math.max(1, top - I.h - 3)) | 0)));
      if (lay(I, U, y0) > 20) { took(S, kind, kind === 'piece'); REG.keep(world(U, U + I.w, y0 + I.h), 'fence'); const [x0, , z0, x1, , z1] = world(U, U + I.w, top);
        logSign(kind === 'piece' ? 'piece' : 'tag', I.key || (kind === 'throw' ? 'THROW ' : 'TAG ') + wr.name, (x0 + x1) / 2, (z0 + z1) / 2, { r: kind === 'piece' ? LAT.piece * PITCH : 0, where: 'walls-' + kind, cat: kind, face: 'fence' }); S.log.push({ kind, key: wr.name }); }
      u += I.w + 6 + ((hash(salt, 6, 3) * 14) | 0); }
    else u += 8 + ((r * 10) | 0);
    q++; }
}
// ───────────────────────── things: now and then a stamped tank, dumpster or news box is swapped for a copy with a writer's tag on it.
// The copy is the template's own voxels with the tag projected onto its front (the first solid voxel from outside), so it wraps round
// a tank; it is cached per template and writer, so a tagged thing costs one small mesh the first time and nothing after.
const THINGS = { tank: 1, dumpster: 1, newsbox: .5 }, RATE = { heavy: .4, medium: .22, light: .12, section1: .06 }, TAGGED = new WeakMap();
function tagThing(src, rot, tx, ty, tz) {
  const w0 = THINGS[src.kind]; if (!w0 || !src.vol || src.big) return null; const S = blockState(); if (!S.live || !RATE[S.prof] || (S.hero && S.dist !== 'junkyard')) return null;
  const [ux, uz] = unshift(tx, tz);   // (SPREAD: the roll and the writer read the thing's place today)
  if (hash(Math.round(ux * 10), Math.round(uz * 10), 811 + Math.round(ty * 10)) > RATE[S.prof] * w0) return null;
  const wr = writerFor(S, 'thing', Math.round(ux * 7 + uz * 13)); if (!wr) return null; let m = TAGGED.get(src); if (!m) TAGGED.set(src, m = new Map()); if (!m.has(wr.name)) m.set(wr.name, tagCopy(src, wr));
  const b = m.get(wr.name); if (b) { const f = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[b.tagFace], c = [1, 0, -1, 0][rot & 3], sn = [0, 1, 0, -1][rot & 3];
    logSign('tag', 'THING ' + src.kind + ' ' + wr.name, tx, tz, { r: 0, where: 'walls-thing', cat: src.kind, y: +ty.toFixed(1), face: (f[0] * c + f[1] * sn) + ',' + (-f[0] * sn + f[1] * c) }); S.log.push({ kind: 'thing', key: wr.name }); }
  return b; }
function tagCopy(src, wr) {
  const V0 = src.vol, V = new Vol(V0.nx, V0.ny, V0.nz, { s: V0.s, org: V0.org, ground: V0.ground }); V.d = V0.d.slice(); V.pal = V0.pal.slice(); V.lay = V0.lay.slice(); V.pm = new Map(V0.pm); V.texts = V0.texts;
  const k = Math.max(1, Math.round(.1 / V.s)); let best = null;   // the widest front: columns whose first voxel from outside is within a quarter of the depth
  for (const side of ['+z', '-z', '+x', '-x']) { const along = side[1] === 'z' ? V.nx : V.nz, dep = side[1] === 'z' ? V.nz : V.nx, lim = Math.max(2, dep >> 2), M = new Uint8Array(along * V.ny), dz = new Int16Array(along * V.ny).fill(-1);
    for (let y = 0; y < V.ny; y++) for (let a = 0; a < along; a++) for (let d = 0; d < lim; d++) { const [x, z] = side === '+z' ? [a, V.nz - 1 - d] : side === '-z' ? [V.nx - 1 - a, d] : side === '+x' ? [V.nx - 1 - d, V.nz - 1 - a] : [d, a]; if (V.d[x + z * V.nx + y * V.sxz]) { M[a + y * along] = 1; dz[a + y * along] = d; break; } }
    const R = bestRect(M, along, V.ny, 6 * k, 5 * k); if (R && (!best || R.w * R.h > best.R.w * best.R.h)) best = { side, R, dz, along }; }
  if (!best) return null;
  const TX = new Set(); if (V.texts) for (const t of V.texts) for (let q = 0; q < t.pts.length; q += 8) TX.add(t.pts[q] + ',' + t.pts[q + 1] + ',' + t.pts[q + 2]);
  const { side, R, dz, along } = best, T = PT.tinyTag(wr, Math.floor(R.w / k) - 1, Math.floor(R.h / k) - 1, V0.nx * 31 + V0.ny); if (!T) return null;
  const a0 = R.a0 + ((R.w - T.w * k) >> 1), y0 = R.y0 + ((R.h - T.h * k) >> 1) + ((R.h - T.h * k) >> 2);
  for (let j = 0; j < T.h * k; j++) for (let i = 0; i < T.w * k; i++) { const c = T.c[((i / k) | 0) + ((j / k) | 0) * T.w]; if (c < 0) continue; const a = a0 + i, y = y0 + T.h * k - 1 - j, d = dz[a + y * along]; if (d < 0) continue;
    const [x, z] = side === '+z' ? [a, V.nz - 1 - d] : side === '-z' ? [V.nx - 1 - a, d] : side === '+x' ? [V.nx - 1 - d, V.nz - 1 - a] : [d, a]; if (!TX.has(x + ',' + y + ',' + z)) V.set(x, y, z, c); }
  const b = meshed(V); b.kind = src.kind; b.tagFace = side; return b;
}
HOOKS.thing = (src, rot, tx, ty, tz) => WALLS.on ? tagThing(src, rot, tx, ty, tz) : null;
HOOKS.wall = (V, bank) => { const b = REG.blk; if (!b) return; const far = !!bank?.farOnly;
  if (V.own) { if (WALLS.on) paintBuilding(V, V.own, false, far); return; } if (V.s >= .45) { if (b.walls) paintFar(V); return; }
  if (!WALLS.on || far || Math.abs(V.s - .1) > 1e-6 || V.ny < 14 || V.nx * V.nz < 40 || !b.keep.length) return;   // (cheap exits first: most volumes are floors, props and trim)
  const o = V.org, x0 = b.i * PITCH - 2, z0 = b.j * PITCH - 2; if (o[0] < x0 || o[0] > x0 + PITCH + 4 || o[2] < z0 || o[2] > z0 + PITCH + 4) return;
  const S = blockState(); if (!S.live || S.prof !== 'heavy') return; const k = keepOf(b, V); if (!k || (S.hero && !(S.dist === 'junkyard' && HEAP_HERO.has(k.tag)))) return;
  if (k.tag === 'fence') paintFence(V, S); else if (BOXY.has(k.tag) && V.nx >= 20 && V.nz >= 20 && V.ny >= 18) paintBuilding(V, { box: k.box, group: '~' + k.tag }, true); };
// what the layer placed in the block being built (tools and the census read it; the audit sees the paint in the structures)
export const wallsLog = () => REG.blk?.walls?.log || [];
