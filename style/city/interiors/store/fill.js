// STORE FIT-OUT (2026-09-28, the shop fit-out agent) · a stocked room behind every generated shopfront's glass.
// gen.js asks shopRoom() for the room behind a main-face shop (null when the lot is too shallow or the shop too narrow), passes
// `room: true` to the shopfront (signage/shop.js: the window display loses its back panel and stands low on the sill), then calls
// shopFitout(): the room is carved in the building's own volume (floor tiles, interior walls, a lit back wall and ceiling, fluorescent
// tubes on the lit flag), and the shop's fit-out (index.js fitoutFor → FITOUTS) is laid out in a separate near-only volume with the
// objects' `far` versions (0.1 m, the city grain): the back wall run, the side-wall run on the window side, the counter by the door
// facing the aisle (surface pieces on its top), a floor piece or two, wall pieces, a ceiling fan. meshFitouts() meshes those volumes
// into the lot's own bank after meshVol (near tier only: mid sees the lit room shell as a tint, never the stock) and flags their
// normals (length < 1: gpu.js lifts those fragments toward their albedo, the interior glow). Seeded per shop: variants, the order of
// every run, repeats of the signature piece, the stockroom shelf and the extras, so no two neighbours match.
// Custom kits: fitWindow() is the one-line version for a kit's own shopfront (objects drawn straight into its volume).
import { Vol, Bank, meshVol, HOOKS } from '../../vox.js';
import { AIR, TOD } from '../../kit.js';
import { rng, shade } from '../../style.js';
import { REG } from '../../audit.js';
import { byId, buildObject, FITOUTS, fitoutFor } from './index.js';
import { tradeOf } from '../../signage/lexicon.js';

export const FIT = { on: true, rooms: 0, objects: 0, tris: 0, kitCalls: 0, fronts: null };
// hardening (2026-10-05) · the coverage log: every shop window the city draws (a generated shopfront, a Gatehill niche, a kit's own
// window) reports here, with whether a stocked room stands behind it. Off (null) unless a tool sets FIT.fronts = [] (tools/shopcover.mjs).
export function noteFront(f, a0, a1, where, room) { if (!FIT.fronts) return; const V = f.V, [x, z] = f.xz((a0 + a1) >> 1, 0);
  FIT.fronts.push({ where, room: !!room, w: a1 - a0, x: +(V.org[0] + (x + .5) * V.s).toFixed(1), z: +(V.org[2] + (z + .5) * V.s).toFixed(1), side: f.side }); }
const FRONT = -11, CEIL = 30;                                   // the room: d ≤ −11 (behind the display niche), y 1 … 29, ceiling slab at 30
const END0 = { '+z': '-x', '-z': '+x', '-x': '-z', '+x': '+z' }, END1 = { '+z': '+x', '-z': '-x', '-x': '+z', '+x': '-z' };   // the lot side at a = 0 / a = L
// the interior look per fit-out: walls, floor (one colour or a 0.3 m checker)
const LOOK = {
  bodega: [[0xe4efdc, 0xf2efe6, 0xfff3c4], [0xefe9dc, 0x8f97a3]], pizza: [[0xfff1d6, 0xf4f1ea], [0xf4f1ea, 0xd9443a]], diner: [[0xffe4ee, 0xdff3f0], [0xf4f1ea, 0x2a2d38]],
  takeout: [[0xfff4d6, 0xffe4ee], [0xf4f1ea, 0x9a4a3a]], bakery: [[0xffe4ee, 0xfff4d6], [0xf4f1ea, 0xe8a0b8]], pawn: [[0xd9dde6, 0xe6e1d6], [0x8a7b6a]],
  sneakers: [[0xf4f4f4, 0xe6e6ea], [0x3a3d45]], streetwear: [[0xefeeea, 0xf4f4f4], [0xb08a5a]], cards: [[0xdfe6f5, 0xefeeea], [0x6d707a]],
  laundromat: [[0xfff7d6, 0xe4f1ff], [0xf4f1ea, 0x5aa0d8]], barber: [[0xeaf6ff, 0xf4f1ea], [0xf4f1ea, 0x17171b]], liquor: [[0xe6e1d6, 0xd9dde6], [0x7a6a5a]],
  checks: [[0xdfe8e0, 0xe6e1d6], [0x9a9aa6]], office: [[0xf0ede4, 0xe6e6ea], [0x8f949c]], pharmacy: [[0xf4f8fa, 0xeaf6ff], [0xd3d4d7]],
  dollar: [[0xfff6c8, 0xf2efe6], [0xd3d4d7, 0xb9bec6]], phones: [[0xf4f4f4, 0xe4f1ff], [0x6d707a]], general: [[0xf0ede4, 0xe4efdc], [0xb9b3a5]],
  // hardening · Gatehill's shops (nicheRoom): marble, cream and wood, a gallery white; the 'lux' look overrides any fit-out's colours
  florist: [[0xeaf6e4, 0xf6f1e6], [0x5a3a22]], jeweler: [[0x2a2d38, 0xe6e1d6], [0x17171b, 0x3a3f4a]], cellar: [[0x5a3a22, 0xe6e1d6], [0x3a2418]], gallery: [[0xffffff, 0xf6f4ef], [0xd9d4ca]],
  lux: [[0xf6f1e6, 0xe9e2d0, 0xeef0f4], [0xeeeae2, 0xcfc6b4]] };
const TOPS = ['store-register', 'store-cctv-monitor'];   // hardening (density): every counter has a till, and often a monitor
const TUBE = 0xf6fbff, EXTRAS = ['store-atm', 'store-vending-machine', 'store-claw-machine', 'store-mop-bucket', 'store-case-stack', 'store-shoebox-stack'];

// ───────────────────────── the room behind a shop between a0 and a1 (frame units), or null
// ends: 4 voxels of wall at a lot edge, 14 where another street face meets it (its own window niche stays whole), 2 between two shops.
// hardening (2026-10-05) · every street face, not the main one only: a corner shop's second face gets its own room, kept a wall clear of
// any room already carved in the building (V.rooms: the main face's room reaches back along it), and the stretch of its window in front of
// that room looks straight into it (`see`: a corner shop's two windows, one shop). The room may be as shallow as 1.2 m (a short lot).
// A kit's own shopfront (Gatehill's niches: nicheRoom) passes its window `win` [a0, a1), its niche's back plane `front`, the window's
// height `wy` [y0, y1) and the `panel` that closes a stretch with nothing behind it.
export function shopRoom(f, { a0, a1, faces = [], depth, doorLeft, win, front = FRONT, ends, wy, panel }) {
  if (!FIT.on || a1 - a0 < 30) return null; const L = f.len;   // (narrower: the shopfront has no window display, so nothing would show)
  const [lo, hi] = ends || [a0 <= 0 ? (faces.includes(END0[f.side]) ? 14 : 4) : 2, a1 >= L ? (faces.includes(END1[f.side]) ? 14 : 4) : 2];
  const doorAt = doorLeft ? a0 + 3 : a1 - 17, [wa0, wa1] = win || [doorLeft ? doorAt + 16 : a0 + 3, doorLeft ? a1 - 3 : doorAt - 3];
  let ra0 = a0 + lo, ra1 = a1 - hi; const dB = -Math.min(38, depth - 8), P = f.V.rooms || [];
  const inP = (a, d, m) => { const [x, z] = f.xz(a, d); return P.some(b => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m); };
  if (P.length) {   // the free columns (wall, floor and air all a wall's width clear of every carved room); keep the run that shows most window
    let best = null, bs = -1, s0 = null; for (let a = ra0 - 1; a <= ra1 + 1; a++) { let ok = a <= ra1; for (let d = dB - 1; ok && d <= front; d++) if (inP(a, d, 1)) ok = false;
      if (ok && s0 === null) s0 = a; if (!ok && s0 !== null) { const r0 = s0 + 1, r1 = a - 1, sc = Math.min(r1, wa1) - Math.max(r0, wa0); if (r1 - r0 >= 16 && sc > bs) { bs = sc; best = [r0, r1]; } s0 = null; } }
    [ra0, ra1] = best || [0, 0]; }
  const own = ra1 - ra0 >= (P.length ? 16 : 20) && front - dB >= 12, see = [];
  for (let a = wa0; a < wa1; a++) { if (own && a >= ra0 && a < ra1) continue; for (let d = front - 1; d >= front - 6; d--) if (inP(a, d, 0)) { see.push([a, d]); break; } }
  if (!own && !see.length) return null;
  return { ra0: own ? ra0 : null, ra1, dB, dF: front, doorAt, doorLeft: !!doorLeft, wa0, wa1, see, wy: wy || [6, 23], panel: panel || { d: -11, y0: 6, y1: 24, c: 0xf2efe6 } };
}

// ───────────────────────── object volumes (far versions, cached per worker: id · variant · state · stock seed)
const CACHE = new Map();
function objVol(id, variant, state, sb) { const k = id + '|' + variant + '|' + state + '|' + sb; let v = CACHE.get(k);
  if (v === undefined) { const o = byId(id); v = o && o.far ? buildObject(o, { variant, seed: 1 + sb * 977, state, far: true }) : null; CACHE.set(k, v); } return v; }

// ───────────────────────── the fit-out: carve + shell (in the building's volume) and the stock (a near-only volume, or the building's own)
export function shopFitout(f, R, o = {}) {
  const V = f.V, night = TOD.night, key = o.fitout || fitoutFor({ type: o.type, disp: o.disp, trade: tradeOf(o.name) }), F = FITOUTS[key] || FITOUTS.general;
  const r = rng(((o.seed | 0) * 7919 + 0x51f7) | 0), pick = a => a[(r() * a.length) | 0], shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const { ra0, ra1, dB, dF } = R, inV = !!o.inV;
  // 0 · the window's stretches with no room of their own: into the room behind (another face's: a corner shop's second window), else a
  // lit back panel as before
  if (R.wa0 !== undefined) { const seen = new Map(R.see || []), [wy0, wy1] = R.wy, pn = R.panel;
    for (let a = R.wa0; a < R.wa1; a++) { if (ra0 !== null && a >= ra0 && a < ra1) continue; const d = seen.get(a);
      if (d !== undefined) f.box(a, wy0, d + 1, a + 1, wy1, dF + 1, AIR); else f.box(a, pn.y0, pn.d, a + 1, pn.y1, pn.d + 1, pn.c); } }
  if (ra0 === null) return null;
  // 1 · the room, carved in the building (and remembered: another face's room keeps clear of it)
  f.box(ra0, 1, dB, ra1, CEIL, dF + 1, AIR);
  { const [xa, za] = f.xz(ra0, dB), [xb, zb] = f.xz(ra1 - 1, dF); (V.rooms ??= []).push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) }); }
  // 2 · the shell: floor, and lit walls and ceiling (the store's own light: the back brightest, the sides a step down), fluorescent tubes
  const [walls, floors] = (o.look === 'lux' && !['florist', 'jeweler', 'cellar', 'gallery'].includes(key) ? LOOK.lux : LOOK[key]) || LOOK.general, wall = pick(walls), fl = floors, back = shade(wall, night ? .94 : .8), side = shade(wall, night ? .8 : .7), ceil = shade(0xf4f1ea, night ? .96 : .84);
  // (built, not painted: in the city's solid masses it only recolours, and a kit's hollow building gets its walls; the front row is
  // left alone, it holds the window niche)
  f.box(ra0 - 1, 0, dB - 1, ra1 + 1, 1, dF + 1, fl.length > 1 ? (a, y, d) => fl[(((a - ra0) / 3 | 0) + ((d - dB) / 3 | 0)) & 1] : fl[0]);
  f.box(ra0 - 1, 1, dB - 1, ra0, CEIL, dF + 1, side, 3); f.box(ra1, 1, dB - 1, ra1 + 1, CEIL, dF + 1, side, 3); f.box(ra0, 1, dB - 1, ra1, CEIL, dB, back, 3);
  f.box(ra0 - 1, CEIL, dB - 1, ra1 + 1, CEIL + 1, dF + 1, ceil, 3);
  const fan = (F.ceiling || []).includes('store-ceiling-fan') && r() < .7;   // (a fan takes the back of the ceiling: one row of tubes then)
  for (let d = dF - 4; d > dB + 3 && !(fan && d < dF - 4); d -= 12) for (let a = ra0 + 3; a < ra1 - 3; a++) f.set(a, CEIL - 1, d, TUBE, 3);
  // 3 · the stock's volume: exactly the room's air (the shell is outside it, so faces against it are culled and AO sees it)
  const [xa, za] = f.xz(ra0, dB), [xb, zb] = f.xz(ra1 - 1, dF), ox = Math.min(xa, xb), oz = Math.min(za, zb);
  const IV = new Vol(Math.abs(xb - xa) + 1, CEIL - 1, Math.abs(zb - za) + 1, { s: V.s, org: [V.org[0] + ox * V.s, V.org[1] + V.s, V.org[2] + oz * V.s], ground: false });
  if (!inV) (V.fit ??= []).push({ IV, ox, oz });
  const inRoom = (a, y, d) => a >= ra0 && a < ra1 && d >= dB && d <= dF && y >= 1 && y < CEIL;
  const occ = (a, y, d) => { const [x, z] = f.xz(a, d); return V.has(x, y, z) || IV.has(x - ox, y - 1, z - oz); };
  const put1 = (a, y, d, c, l) => { const [x, z] = f.xz(a, d); IV.set(x - ox, y - 1, z - oz, c, l); };
  const dims = (O, face) => face === 'S' ? [O.nx, O.nz] : [O.nz, O.nx];
  const fits = (fa, fd, na, nd, y, ny, avoid) => { for (let a = fa; a < fa + na; a++) for (let d = fd; d < fd + nd; d++) { if (avoid && avoid(a, d)) return false;
    for (let yy = y; yy < y + ny; yy++) if (!inRoom(a, yy, d) || occ(a, yy, d)) return false; } return true; };
  let placed = 0;
  const put = (O, face, fa, fd, y) => { const { nx, ny, nz, d: D, pal, lay, sxz } = O;
    for (let yy = 0; yy < ny; yy++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const v = D[x + z * nx + yy * sxz]; if (!v) continue;
      const a = face === 'S' ? fa + x : face === 'L' ? fa + z : fa + (nz - 1 - z), d = face === 'S' ? fd + z : face === 'L' ? fd + (nx - 1 - x) : fd + x; put1(a, y + yy, d, pal[v], lay[v]); }
    placed++; FIT.objects++; };
  const vol = id => { const ob = byId(id); if (!ob || !ob.far) return null; const st = ob.states ? (id === 'store-cooler' ? (r() < .2 ? 'open' : 'shut') : ob.states.includes('lit') ? (night || r() < .6 ? 'lit' : 'dark') : ob.states[0]) : undefined;
    return { ob, O: objVol(id, (r() * (ob.variants || 1)) | 0, st, (r() * 4) | 0) }; };
  const floorOnly = l => (l || []).filter(id => byId(id)?.place === 'floor');
  const door0 = R.doorAt - 1, door1 = R.doorAt + 14, aisle = (a) => a >= door0 && a < door1;   // the walk in from the door stays clear
  const winSide = R.doorLeft ? 'R' : 'L', dir = R.doorLeft ? -1 : 1;   // the side wall opposite the door is the one the window looks along
  // 4 · the counter by the door, facing the aisle (clerk on the window side), right behind the display niche; surface pieces on its top
  const cands = [...floorOnly(F.counter), 'store-register-counter']; let counter = null;
  for (const id of cands) { const P = vol(id); if (!P?.O) continue; const O = P.O, face = R.doorLeft ? 'R' : 'L', [na, nd] = dims(O, face), fa = R.doorLeft ? door1 : door0 - na, fd = dF - nd + 1;
    if (!fits(fa, fd, na, nd, 1, O.ny)) continue; put(O, face, fa, fd, 1);
    const top = 1 + Math.round((P.ob.tops?.[0] ?? .7) * 10), tops = shuffle([...(F.top || []), ...TOPS].filter((t, k, A) => byId(t)?.far && A.indexOf(t) === k));
    counter = { fa, fd, na, nd };
    for (const t of tops.slice(0, 3 + (r() < .5 ? 1 : 0))) { const Q = vol(t); if (!Q?.O) continue; const S = Q.O;
      for (let k = 0; k < 6; k++) { const a = fa + ((r() * Math.max(1, na - S.nx)) | 0), d = fd + ((r() * Math.max(1, nd - S.nz)) | 0);
        if (!fits(a, d, S.nx, S.nz, top, S.ny)) continue; let sup = 0; for (let aa = a; aa < a + S.nx; aa++) for (let dd = d; dd < d + S.nz; dd++) if (occ(aa, top - 1, dd)) sup++;
        if (sup >= S.nx * S.nz * .6) { put(S, 'S', a, d, top); break; } } }
    break; }
  // 5 · the back wall run (signature piece first, sometimes twice or three times: a cooler wall), from the window side toward the door;
  // each piece takes the first gap that holds it (the counter may already stand at the door end)
  const sig = floorOnly(F.back), rest = shuffle([...floorOnly(F.back).slice(1), ...floorOnly(F.side), ...(F.backroom && r() < .45 ? [pick(F.backroom)] : [])]);
  const seq = []; if (sig.length) { const n = key === 'bodega' ? 1 + ((r() * 3) | 0) : key === 'laundromat' ? 2 + ((r() * 2) | 0) : 1; for (let k = 0; k < n; k++) seq.push(sig[0]); } seq.push(...rest, ...rest);
  let cur = dir > 0 ? ra0 : ra1, backD = 0, nBack = 0;
  for (const id of seq) { if (nBack >= 7) break; const P = vol(id); if (!P?.O) continue; const O = P.O, [na, nd] = dims(O, 'S'); if (nd > 14) continue;
    for (let s = 0; s < 80; s += 2) { const fa = dir > 0 ? cur + s : cur - s - na; if (fa < ra0 || fa + na > ra1) break;
      if (fits(fa, dB, na, nd, 1, O.ny)) { put(O, 'S', fa, dB, 1); nBack++; backD = Math.max(backD, nd); const g = r() < .5 ? 0 : 1; cur = dir > 0 ? fa + na + g : fa - g; break; } } }
  // 6 · the side-wall run on the window side, from the back run's front toward the glass
  { let cd = dB + backD + 1; for (const id of shuffle(floorOnly(F.side)).slice(0, 4)) { const P = vol(id); if (!P?.O) continue; const O = P.O, [na, nd] = dims(O, winSide), fa = winSide === 'L' ? ra0 : ra1 - na;
    if (cd + nd - 1 > dF) break; if (!fits(fa, cd, na, nd, 1, O.ny)) continue; put(O, winSide, fa, cd, 1); cd += nd + (r() < .5 ? 0 : 1); } }
  // 6b · hardening (density) · the door side's wall too, from the back run toward the street, short of the walk in (1.4 m clear by the door)
  { const ds = winSide === 'L' ? 'R' : 'L', pool = shuffle([...floorOnly(F.side), ...floorOnly(F.back).slice(0, 1), ...(F.backroom || [])]); let cd = dB + backD + 1;
    for (const id of pool.slice(0, 3)) { const P = vol(id); if (!P?.O) continue; const O = P.O, [na, nd] = dims(O, ds), fa = ds === 'L' ? ra0 : ra1 - na;
      if (cd + nd - 1 > dF - 14) break; if (!fits(fa, cd, na, nd, 1, O.ny)) continue; put(O, ds, fa, cd, 1); cd += nd + (r() < .5 ? 0 : 1); } }
  // 7 · the floor: one or two pieces in the middle, facing the street (plus, now and then, an extra: ATM, vending, claw, mop, cases)
  { const list = shuffle(floorOnly(F.floor)).slice(0, 3); if (r() < .5 && o.look !== 'lux') list.push(pick(EXTRAS));
    for (const id of list) { const P = vol(id); if (!P?.O) continue; const O = P.O, [na, nd] = dims(O, 'S');
      for (let k = 0; k < 14; k++) { const fa = ra0 + ((r() * Math.max(1, ra1 - ra0 - na)) | 0), fd = dB + backD + 2 + ((r() * Math.max(1, dF - dB - backD - nd - 3)) | 0);
        if (fits(fa - 1, fd - 1, na + 2, nd + 2, 1, O.ny, aisle)) { put(O, 'S', fa, fd, 1); break; } } } }
  // 8 · wall pieces: the back wall over low stock, else a side wall (signs, the menu board, the camera, the guitar and shoe walls)
  for (const id of shuffle(F.wall || []).slice(0, 4)) { const P = vol(id); if (!P?.O || P.ob.place !== 'wall') continue; const O = P.O, y = Math.min(CEIL - 1 - O.ny, 1 + Math.round((P.ob.mount ?? 1.4) * 10));
    const tries = []; for (let a = ra0; a + O.nx <= ra1; a += 3) tries.push(['S', a, dB]);
    for (const face of ['L', 'R']) { const [na, nd] = dims(O, face); for (let d = dB + backD; d + nd - 1 <= dF - 2; d += 3) tries.push([face, face === 'L' ? ra0 : ra1 - na, d]); }
    for (const [face, fa, fd] of shuffle(tries).slice(0, 24)) { const [na, nd] = dims(O, face); if (fits(fa, fd, na, nd, y, O.ny)) { put(O, face, fa, fd, y); break; } } }
  // 9 · a ceiling fan where the fit-out has one (the tubes are the shell's)
  { const P = fan ? vol('store-ceiling-fan') : null;
    if (P?.O) { const O = P.O, fa = ((ra0 + ra1 - O.nx) >> 1), fd = dB + 1; if (fits(fa, fd, O.nx, O.nz, CEIL - O.ny, O.ny)) put(O, 'S', fa, fd, CEIL - O.ny); } }
  // 10 · hardening (density) · people from the city's cast (jobs.js castOf reads A.life; meshFitouts hands V.life over): the clerk behind
  // the counter facing the aisle, now and then a customer at the counter or one at the back wall. act 'clerk': indoors on purpose
  // (jobs.js HOME: never nudged out of the room). A person needs 0.4 m of floor and 0.6 m round the head (1.1–1.8 m) clear of the stock.
  if (!inV) { const life = (V.life ??= []), wpt = (a, d) => { const [x, z] = f.xz(a, d); return [V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s]; };
    const man = (a, d, da, dd, seed) => { if (!fits(a - 2, d - 2, 4, 4, 1, 18) || !fits(a - 4, d - 4, 8, 8, 10, 9)) return false;
      const [x0, z0] = wpt(a - 2, d - 2), [x1, z1] = wpt(a + 1, d + 1), [p0, q0] = f.xz(a, d), [p1, q1] = f.xz(a + da, d + dd), px = (x0 + x1) / 2, pz = (z0 + z1) / 2;
      if (life.some(q => Math.hypot(q.x - px, q.z - pz) < .9)) return false;   // (another room's clerk through the wall: heads stay apart)
      life.push({ x: +((x0 + x1) / 2).toFixed(2), y: +(V.org[1] + V.s).toFixed(3), z: +((z0 + z1) / 2).toFixed(2), ry: Math.atan2(p1 - p0, q1 - q0), act: 'clerk', seed }); return true; };
    const sd = (o.seed | 0) * 31;
    if (counter) { const { fa, fd, na, nd } = counter, cd = fd + (nd >> 1), da = R.doorLeft ? -1 : 1;
      man(R.doorLeft ? fa + na + 3 : fa - 3, cd, da, 0, sd + 7) || man(R.doorLeft ? fa + na + 3 : fa - 3, cd - 3, da, 0, sd + 7);
      if (r() < .35) man(R.doorLeft ? fa - 4 : fa + na + 4, cd, -da, 0, sd + 11); }
    if (r() < .3) for (let k = 0; k < 8; k++) { const a = ra0 + 4 + ((r() * Math.max(1, ra1 - ra0 - 8)) | 0); if (man(a, dB + backD + 4, 0, -1, sd + 13)) break; } }
  if (inV) { dropFloaters(IV); const { nx, ny, nz, d, pal, lay, sxz } = IV; for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const v = d[x + z * nx + y * sxz]; if (v) V.set(x + ox, y + 1, z + oz, pal[v], lay[v]); } }   // (a kit's shop: into its own volume)
  FIT.rooms++; if (FIT.log) { const [x, z] = f.xz((ra0 + ra1) >> 1, 0), n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[f.side];
    FIT.log.push({ key, x: +(V.org[0] + (x + .5) * V.s).toFixed(2), z: +(V.org[2] + (z + .5) * V.s).toFixed(2), n, placed }); }   // (tools: where each room's glass is, its outward normal)
  return key;
}

// ───────────────────────── drop what floats: a piece that touches no face of the room's volume through its 26 neighbours (a pane's glint
// where the glass is air, a claw inside its cabinet) is left out, as the audit would flag it (audit.js islands)
function dropFloaters(V) {
  const { nx, ny, nz, d, sxz } = V, keep = new Uint8Array(d.length), q = new Int32Array(d.length); let t = 0, h = 0;
  for (let i = 0; i < d.length; i++) { if (!d[i]) continue; const y = (i / sxz) | 0, r = i - y * sxz, z = (r / nx) | 0, x = r - z * nx;
    if (y === 0 || x === 0 || z === 0 || x === nx - 1 || z === nz - 1 || y === ny - 1) { keep[i] = 1; q[t++] = i; } }
  while (h < t) { const c = q[h++], y = (c / sxz) | 0, r = c - y * sxz, z = (r / nx) | 0, x = r - z * nx;
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= ny) continue; for (let dz = -1; dz <= 1; dz++) { const zz = z + dz; if (zz < 0 || zz >= nz) continue;
      for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= nx) continue; const o = xx + zz * nx + yy * sxz; if (d[o] && !keep[o]) { keep[o] = 1; q[t++] = o; } } } } }
  for (let i = 0; i < d.length; i++) if (d[i] && !keep[i]) d[i] = 0;
}
// ───────────────────────── mesh a lot's stock volumes into its own bank (near only), normals flagged for gpu.js' interior lift
const LIFT = { day: 108 / 127, night: 92 / 127 };   // |n| = 1 − lift / 2 → lift .3 by day, .55 at night (gpu.js vIn)
export function meshFitouts(V, bank, A) {
  if (V.life) { if (A) (A.shops ??= []).push(...V.life); V.life = null; }   // hardening: the shops' people join the block's cast (castspec.js: after A.life, so no id moves)
  const L = V.fit; V.fit = null; if (!L || !L.length || !bank || bank.farOnly) return; const hw = HOOKS.wall; HOOKS.wall = null;   // (the walls pass paints buildings, not shelves)
  try { const k = TOD.night ? LIFT.night : LIFT.day;
    for (const { IV, ox, oz } of L) { dropFloaters(IV); IV.outside = (x, y, z) => V.has(x + ox, y + 1, z + oz);
      const b = meshVol(IV, new Bank(true)); FIT.tris += b.tris();
      b.L.forEach((O, li) => { if (!O.v) return; const D = bank.L[li], base = D.v; D.P.need(O.P.n); D.N.need(O.N.n); D.C.need(O.C.n); D.I.need(O.I.n);
        D.P.a.set(O.P.a.subarray(0, O.P.n), D.P.n); D.P.n += O.P.n; D.C.a.set(O.C.a.subarray(0, O.C.n), D.C.n); D.C.n += O.C.n;
        for (let q = 0; q < O.N.n; q++) D.N.a[D.N.n++] = Math.round(O.N.a[q] * k);
        for (let q = 0; q < O.I.n; q++) D.I.a[D.I.n++] = O.I.a[q] + base; D.v += O.v; });
      if (REG.blk && REG.audit) (bank.vols ??= []).push(IV); } }   // the audit sees the stock as part of the building
  finally { HOOKS.wall = hw; }
}

// ───────────────────────── a custom kit's own shopfront: one call after its window is drawn. The window's glass plane between wa0 and
// wa1 (y0 … y1, at depth dg) is opened, and a room with the fit-out goes behind it, drawn straight into the building's volume.
// o: { a0, a1, door (its left edge a), wa0, wa1, y0, y1, dg, depth, fitout | disp | trade | type, seed }
export function fitWindow(f, o) {
  if (!FIT.on) return null; FIT.kitCalls++; const V = f.V, dg = o.dg ?? -3, dF = dg - 1, mid = ((o.a0 + o.a1) >> 1), inV = d => { const [x, z] = f.xz(mid, d); return V.in(x, 1, z); };
  let depth = 0; while (inV(-depth - 1) && depth < 200) depth++;   // (to the volume's back edge: its pad is ≤ 3)
  const dB = Math.max(dF - 27, -(depth - 8)), ra0 = o.a0 + 2, ra1 = o.a1 - 2, ok = !(ra1 - ra0 < 20 || dF - dB < 14); noteFront(f, o.wa0, o.wa1, 'kit', ok); if (!ok) return null;
  for (let a = o.wa0; a < o.wa1; a++) for (let y = o.y0; y < o.y1; y++) { const [x, z] = f.xz(a, dg + 1); if (!V.has(x, y, z)) f.set(a, y, dg, AIR); }   // the painted backdrop behind the glass
  return shopFitout(f, { ra0, ra1, dB, dF, doorAt: (o.door ?? ra1) < (ra0 + ra1) / 2 ? Math.max(o.door, ra0 + 1) : Math.min(o.door ?? ra1, ra1 - 15), doorLeft: (o.door ?? ra1) < (ra0 + ra1) / 2 }, { ...o, fitout: o.fitout || KIT_FIT[o.kind] || 'general', inV: true });
}
const KIT_FIT = { shelves: 'bodega', menu: 'diner', bar: 'liquor', marine: 'general' };   // the Yards' window kinds (districts/industrial/works.js showcase)

// ───────────────────────── hardening (2026-10-05) · Gatehill (districts/estates/shops.js): a room behind a display niche whose back plane
// is d −12 (the stock in front of it, 0.1 cubes, the window y0 … y1). The niche's back wall opens wherever nothing hangs on it (a painting,
// a plaque, a rack of wine keeps its stretch of wall, so nothing is left floating). Rooms and people mesh like a generated shop's: the
// caller runs meshFitouts(V, bank, A) after meshing its volume. o: { a0, a1, s0, s1, y0, y1, depth, doorLeft, ends, disp, back, seed }
const LUX_FIT = { flowers: 'florist', flowers2: 'florist', cigars: 'cellar', cigars2: 'cellar', wine: 'cellar', wine2: 'cellar', caviar: 'cellar', cakes: 'bakery', juice: 'takeout', dining: 'diner',
  bags: 'streetwear', fashion: 'streetwear', tailor: 'streetwear', luggage: 'streetwear', drip: 'office', sneakers: 'sneakers', tennis: 'sneakers', watches: 'jeweler', jewels: 'jeweler', jewels2: 'jeweler',
  pawn: 'jeweler', perfume: 'pharmacy', clinic: 'office', bank: 'office', art: 'gallery', auction: 'gallery', objects: 'gallery', cars: 'gallery', gym: 'gallery', dogs: 'gallery' };
export function nicheRoom(f, o) {
  if (!FIT.on || !LUX_FIT[o.disp]) return null;   // (the club's frosted glass shows nothing)
  const V = f.V, { s0, s1, y0, y1 } = o, held = [], top = Math.min(y1 - 1, CEIL);
  for (let a = s0; a < s1; a++) for (let y = y0 + 3; y < y1 - 1; y++) { const [x, z] = f.xz(a, -11); if (V.has(x, y, z)) { held.push(a); break; } }
  const R = shopRoom(f, { a0: o.a0, a1: o.a1, depth: o.depth, doorLeft: o.doorLeft, win: [s0, s1], front: -13, ends: o.ends, wy: [y0 + 3, top], panel: { d: -12, y0, y1, c: o.back } });
  if (!R) return null; const key = shopFitout(f, R, { fitout: LUX_FIT[o.disp], look: 'lux', seed: o.seed }), seen = new Set(R.see.map(p => p[0]));
  for (let a = s0; a < s1; a++) if (!held.includes(a) && ((R.ra0 !== null && a >= R.ra0 && a < R.ra1) || seen.has(a))) f.box(a, y0 + 3, -12, a + 1, top, -11, AIR);   // (over a 0.8 m sill)
  return key || (R.see.length ? 'see' : null);   // ('see': the window looks into the room behind another face's window)
}
