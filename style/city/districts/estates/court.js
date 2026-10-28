// GATEHILL · the two entrance courts of a tower (the sim's doors): a recess in the middle of the north and the south frontage, paved in
// pale stone with a granite drive lane at the street edge and a red carpet from the lobby door; the lobby on the court's back wall
// (bronze and glass, a recessed revolving door, brass lanterns, the name and the street number over the door); a canopy (a porte-cochère
// across the court, a marquee over the door, or none: brass letters and banners); the car line; planters; the doorman.
// The sim-state layer draws its doorman lobby (canopy, carpet, podium, stanchions: simassets doormanLobby) at the lobby door, on the wall
// plane, 5.6 m wide and 2 m deep: nothing of the build stands in that box, so the two never collide (only the paving: see PASS notes).
import { AIR } from '../../kit.js';
import { C, CV, SIDE, H, TOD, REG, px, ftext, inkOn, lit, logSign, fw, FACE_ROT, RY, r2 } from './lib.js';
import { suv, sedan, limo, roadster, supercar, topiary, lantern, valetStand, cone, luggageCart, pier } from './props.js';
import { stamp } from '../../vox.js';
import { security } from '../../simassets/index.js';

export const STAND = { x: 1.3, z: .6 };   // simassets STAND: the doorman's feet from the lobby's origin (along the wall, out of it)
const PIECE = { w: 2.9, d: 2.05, h: 4.25 };   // the doorman lobby's box (half width, depth, height) and a little air

export function courts(ctx, P, T, gf) {
  for (const side of ['N', 'S']) court(ctx, P, T, gf, side);
}
function court(ctx, P, T, gf, side) {
  const W = gf.walls[side === 'N' ? 'courtN' : 'courtS'], back = W.back, L = back.len, m = L >> 1, spec = T.lobby[side] || {}, [x0, z0, x1, z1] = P.courts[side];
  const n = side === 'N' ? -1 : 1, zWall = side === 'N' ? z1 : z0, zLot = side === 'N' ? z0 : z1, rot = side === 'N' ? 2 : 0, seed = P.seed + (side === 'N' ? 11 : 23);
  const lots = ctx.simLots.map(l => ctx.lot(l)), lot = lots.find(l => l.face === (side === 'N' ? '-z' : 'z')), no = (lot?.addr || '').split(' ')[0] || '';
  const g = T.gf, trim = g.trim, band = g.band;
  REG.group('lobby' + side);
  // ── the lobby wall: lobby glass (lit inside), bronze mullions, the revolving door in a recess, lanterns, the number, the name
  const glassLo = 0x2a2d38, warm = y => y > 30 ? C.litHi : glassLo, gl = TOD.night ? 3 : 1;
  for (const [a0, a1] of [[6, m - 24], [m + 24, L - 6]]) if (a1 - a0 > 6) { back.box(a0 - 2, 3, 0, a1 + 2, 42, 2, trim); back.box(a0, 4, -2, a1, 40, 2, AIR);
    back.box(a0, 4, -3, a1, 40, -2, (a, y) => warm(y), gl); for (let a = a0 + 10; a < a1 - 2; a += 11) back.box(a, 4, -2, a + 1, 40, 0, trim, 2); back.box(a0, 30, -2, a1, 31, 0, trim, 2); }
  // the revolving door: a 2.6 m recess 1.2 m deep between two stone piers, a drum of glass and brass in it, a lit transom (all behind the
  // wall plane: the doorman lobby's portal and drum stand in front of it)
  back.box(m - 24, 0, 0, m - 14, 42, 1, g.wall); back.box(m + 14, 0, 0, m + 24, 42, 1, g.wall);
  back.box(m - 13, 1, -12, m + 13, 34, 1, AIR); back.box(m - 13, 1, -13, m + 13, 34, -12, (a, y) => y > 26 ? C.litHi : 0xf2e6c8, TOD.night ? 3 : 1);
  for (let a = -9; a <= 9; a++) { const d = -12 + Math.round(Math.sqrt(Math.max(0, 81 - a * a))); back.box(m + a, 1, d - 1, m + a + 1, 26, d, Math.abs(a) % 4 === 0 ? C.brass : 0xbfe6ff, Math.abs(a) % 4 === 0 ? 2 : 1); back.box(m + a, 26, -12, m + a + 1, 28, d, C.brass, 2); }
  back.box(m - 14, 34, 0, m + 14, 36, 1, trim);
  for (const a of [m - 20, m + 19]) { back.box(a, 20, 1, a + 2, 22, 3, C.brass, 2); back.box(a, 22, 1, a + 2, 28, 3, 0xfff3c4, TOD.night ? 3 : 1); back.box(a, 28, 1, a + 2, 29, 3, C.brass, 2); }   // lanterns on the piers (outside the doorman lobby's portal)
  REG.door(P.cx, zWall + n * .5, rot);
  // the name and the street number over the lobby (a plate at 4.2–5.0 m, clear of the doorman lobby's tie rods), unless a canopy
  // carries them; logged as one sign per lobby (name + number: the north and the south lobby read differently)
  const name = T.name, canopy = spec.canopy || 'letters', key = no ? `${name} ${no}` : name;
  const plate = (M, a, ytop, bg, fg, align = 1) => { const w = M.w + 4, a0 = align ? a - (w >> 1) : a; back.box(a0, ytop - 9, 0, a0 + w, ytop + 1, 2, bg); ftext(back, M, a0 + 2, ytop - 1, { align: 0, d0: 2, d1: 3, c: fg, l: lit() }); return w; };
  if (canopy === 'letters' || canopy === 'covered') { const M = px(name), N2 = px(no), w = M.w + (no ? N2.w + 8 : 4);
    if (w <= L - 12) { const a0 = m - (w >> 1), pb = band === C.gold ? C.ink : band; plate(M, a0, 51, pb, C.gold, 0); if (no) plate(N2, a0 + M.w + 6, 51, C.ink, C.chalk, 0); const [x, z] = fw(back, m, 0); logSign(key, x, z, { where: 'lobby' }); } }
  // banners for 'letters': two tall banners flat on the wall in the tower's colour with its initial, hung from brass arms
  if (canopy === 'letters') for (const a of [m - 42, m + 34]) { if (a < 4 || a + 8 > L - 4) continue; back.box(a - 1, 42, 1, a + 9, 43, 3, C.brass, 2); const bc = T.neutral ? (T.accent === T.trim ? C.ink : T.accent) : T.wall, fc = bc === C.ink ? C.gold : inkOn(bc); back.box(a, 16, 1, a + 8, 42, 2, bc); back.box(a, 16, 1, a + 8, 17, 2, fc);
    const ini = px(T.short[0]); ftext(back, ini, a + 4, 36, { d0: 2, d1: 3, c: fc, l: 0 }); }
  // ── the canopy: a porte-cochère over the whole court (4.4–5.0 m, a 0.9 m fascia with the name), or a marquee over the door
  if (canopy === 'porte' || canopy === 'marquee') { const wide = canopy === 'porte', a0 = wide ? 3 : m - 38, a1 = wide ? L - 3 : m + 38, dd = wide ? Math.round(T.court.d * 10) - 12 : 30, col = g.mat === 'granite' || band === C.gold ? C.ink : band;
    back.box(a0, 44, 1, a1, 50, dd, col); back.box(a0, 49, 1, a1, 50, dd, trim); back.box(a0, 41, dd - 2, a1, 50, dd, col); back.box(a0, 41, dd - 2, a1, 42, dd, trim, 2);
    for (let a = a0 + 6; a < a1 - 4; a += 10) back.box(a, 43, 6, a + 2, 44, dd - 4, 0xfff3c4, TOD.night ? 3 : 1);   // downlights in the soffit
    const full = px(no ? `${name} · ${no}` : name), short = px(no ? `${T.short} · ${no}` : T.short), t = full.w + 6 <= a1 - a0 ? full : short;
    if (t.w + 6 <= a1 - a0) { ftext(back, t, (a0 + a1) >> 1, 49, { d0: dd, d1: dd + 1, c: col === C.ink ? C.gold : inkOn(col), l: lit() }); const [x, z] = fw(back, m, dd); logSign(t.s, x, z, { where: 'canopy' }); }
    if (wide) for (const a of [a0 + 1, a1 - 3]) back.box(a, 1, dd - 3, a + 2, 44, dd - 1, C.brass, 2); }   // (from the paving's top: 0.1 m up)   // two brass posts at the front corners
  // ── the court walls either side: a tall window and a brass sconce each
  for (const f of [W.west, W.east]) { const l2 = f.len; if (l2 < 24) continue; const a = (l2 >> 1) - 6; f.box(a - 2, 4, 0, a + 14, 40, 2, trim); f.box(a, 6, -2, a + 12, 38, 2, AIR); f.box(a, 6, -3, a + 12, 38, -2, (x, y) => warm(y), gl); }
  // ── the paving: granite setts in the drive lane at the street edge, pale stone beyond, the red carpet from the door (0.2 m off the walls)
  const px0 = x0 + .2, px1 = x1 - .2, pz0 = side === 'N' ? z0 : z0 + .2, pz1 = side === 'N' ? z1 - .2 : z1, lane = 2.8, V = ctx.volume(px0, SIDE, pz0, px1, SIDE + CV, pz1, { walk: true });
  V.box(0, 0, 0, V.nx, 1, V.nz, (x, y, z) => { const wx = px0 + (x + .5) * CV, wz = pz0 + (z + .5) * CV, v = Math.abs(wz - zLot), u = wx - P.cx;
    if (v < lane) return v > lane - .2 ? 0x6d6a64 : (((Math.floor(wx / .3) + Math.floor(wz / .3)) & 1) ? 0x8f8a82 : 0x7d786f);
    if (Math.abs(u) < .7 && v >= lane) return Math.abs(u) > .58 ? C.gold : C.carpet;
    return (Math.abs((wx * 10) % 10) < 1 || Math.abs((wz * 10) % 10) < 1) ? C.paveJ : C.pave; });
  // ── the car line in the drive lane (parallel to the street), then planters, gate piers, the doorman, a valet or a chauffeur
  const zc = zLot - n * 1.45, cars = spec.cars || 'sedan', put = (bk, x, z, o = {}) => ctx.put(bk, x, z, { rot: o.rot ?? 1, slide: [1, 0], reach: o.reach ?? 1.2 });
  const people = [], life = (x, z, ry, act, k) => people.push({ x: r2(x), y: SIDE, z: r2(z), ry, act, seed: seed + k * 31, hand: true });
  const faceSt = side === 'N' ? RY[2] : RY[0];
  // planters with topiary against the lobby wall (clear of the doorman lobby's 5.8 m); gate piers at the street corners, placed before
  // the cars (a short car line only: two SUVs or a limo need the court's whole width)
  for (const [x, k] of [[x0 + 1.05, 0], [x1 - 1.05, 1]]) if (Math.abs(x - P.cx) > PIECE.w + .7) ctx.put(topiary(k ^ (seed & 1), g.mat === 'marble' || g.mat === 'stone' ? C.ink : C.stone), x, zWall + n * 1.0, { rot, slide: [1, 0], reach: .4 });
  if (x1 - x0 >= 12 && cars !== 'suvs' && cars !== 'limo') for (const x of [x0 + .8, x1 - .8]) ctx.put(pier(g.mat === 'granite' || g.mat === 'bronze' ? C.stone : g.wall), x, zLot - n * .55, { rot, slide: [0, 1], reach: .3 });
  if (cars === 'limo') { const p = put(limo(H(seed, 3) < .3), P.cx + .6, zc, { rot: H(seed, 4) < .5 ? 1 : 3 }); if (p) life(p[0] - 1.6, zc - n * 1.3, faceSt + .6, 'lean', 1); }
  else if (cars === 'suvs') { put(suv(), P.cx - 2.55, zc, { rot: 1, reach: .6 }); put(suv(), P.cx + 2.55, zc, { rot: 1, reach: .6 }); }
  else if (cars === 'sedan') { const p = put(sedan(), P.cx + 1.8, zc, { rot: 3 }); ctx.put(luggageCart(), P.cx - 3.3, zc + n * .2, { rot: 1, slide: [1, 0], reach: .8 }); if (p) life(P.cx - 2.1, zc - n * 1.2, faceSt - .4, 'carry', 2); }
  else if (cars === 'roadster') { const c = [0x7a1020, 0x0b5a3a, 0xf2e6c8, C.sky][(H(seed, 5) * 4) | 0], p = put(roadster(c), P.cx - 1.2, zc, { rot: 1 }); if (p) life(p[0] + 2.8, zc + n * .1, RY[3], 'arms', 3); }
  else if (cars === 'supercar') { const c = [0x6cff4a, C.orange, C.yellow, C.rasp][(H(seed, 6) * 4) | 0], p = put(supercar(c), P.cx + 1.2, zc, { rot: 3 }); if (p) life(p[0] - 3.2, zc - n * .3, RY[1], 'phone', 4); }
  else if (cars === 'valet') { ctx.put(valetStand(), x0 + 2.0, zc - n * .2, { rot: 1, slide: [1, 0], reach: .5 }); put(sedan(), P.cx + 1.6, zc, { rot: 1 }); for (const k of [0, 1, 2]) ctx.put(cone(), x0 + 2.8 + k * .9, zLot - n * .25, { rot: 0, slide: [1, 0], reach: .4 });
    life(x0 + 2.0, zc - n * .95, faceSt, 'stand', 5); }
  // security that is always there: a CCTV camera (simassets) on each side wall of the court, 0.6 m off the lobby wall, 2.8 m up, watching
  // the door (wall-mounted: stamped outside strict mode, like any sign; the audit still checks it)
  const cam = security('camera').bank, zc2 = zWall + n * .6, strict = REG.strict; REG.strict = false;
  stamp(cam, ctx.bank, FACE_ROT['+x'], x0, SIDE + 2.8, zc2); stamp(cam, ctx.bank, FACE_ROT['-x'], x1, SIDE + 2.8, zc2); REG.strict = strict;
  // the doorman: behind where the doorman lobby's podium stands (simassets STAND), facing the street
  life(P.cx + (side === 'N' ? -STAND.x : STAND.x), zWall + n * STAND.z, faceSt, 'stand', 0);
  for (const p of people) ctx.A.life.push(p);
}
