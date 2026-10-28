// Pass 2 · TRANSIT AND SAFEHOUSE SLOTS (core, systems agent). The sim will add taxis and a subway (and safehouses) later; the
// map reserves their places now. A kit declares them as places with coordinates (districts/<name>.js: transit, safehouses) and the
// engine builds the demo ones:
//   subway  a station house on the mid-row lot under (x, z): a one-storey green kiosk, SUBWAY band, line bullets, a stairwell
//           going down under the street, two globe lamps (gen.js builds the lot type 'transit'; planBlock converts the lot). A slot
//           marked entry: 'stairs' (a block the generator doesn't build: the Yards, a park, the mall's lot) is an open stair entrance
//           on the lot behind the sidewalk instead: railings, two globe posts, the SUBWAY board with the line, the name on the railings
//           (subway stations agent, 2026-10-08). Both go down the same flight, cut to the stairs clips' steps (STAIR, stairwell below)
//   bus     a shelter at the curb, reserved before anything else is placed so the lots' clutter keeps clear of it (the buses are gone,
//           2026-10-09: the shelters stay as street furniture, NO SVC on the board)
//   taxi    a stand sign at the curb (reserved strip)
// Everything declared is also written out for the future sim (tools/reserved.mjs → simstate/reserved.json).
import { Vol, meshed, textMask, stamp } from './vox.js';
import { PAL, CV, SIDE, hash, shade } from './style.js';
import { TOD } from './kit.js';
import { REG } from './audit.js';
import { slab } from './ground.js';
// pass 3 · signage: the shelter's ad panel is a design from the transit pool (a 0.05-grain lightbox, allocated per block)
import { shelterAd } from './signage/index.js';
import { Bank, meshVol } from './vox.js';
// MOVEMENT W3b · the signs read the network (transitnet.js, pure data): the kiosk's line bullets and its line map, the entrances' boards
import { LINES } from './transitnet.js';
import { P as PITCH } from '../../world/city.js';   // (SPREAD: the plan's pitch, never a literal 32)

const memo = new Map(), M = (k, f) => { k += '|' + TOD.night; let b = memo.get(k); if (!b) { memo.set(k, b = f()); } return b; };
const pv = (nx, ny, nz, cx = nx / 2, cz = nz / 2) => new Vol(nx, ny, nz, { s: CV, org: [-cx * CV, 0, -cz * CV], ground: true });
const lit = () => TOD.night ? 3 : 0;
function word(V, s, x0, ytop, z, c, l = 0, dir = 1) { const t = textMask(s); V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) { const x = dir > 0 ? x0 + i : x0 + t.w - 1 - i; V.set(x, ytop - j, z, c, l); V.recN(s, x, ytop - j, z, 0, dir); } return t.w; }
const hexOf = c => parseInt(String(c).slice(1), 16);
// a line's bullet → its colour (T TIDE blue, N NEON pink, H HARBOR orange, U UNION green), and → the line (its stops, for the kiosk's map)
export const LINE_COLOURS = Object.fromEntries(LINES.map(l => [l.bullet, hexOf(l.colour)]));
const LINE_BY_BULLET = new Map(LINES.filter(l => l.kind === 'subway').map(l => [l.bullet, l]));
const inkOn = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255 > .6 ? PAL.ink : PAL.white;
// a line's bullet by night (ART FIXES 2026-10-10, slime): the night's blue light carries TIDE's blue and NEON's pink (their squares on
// an entrance board read ~(1, 4, 85) and (33, 0, 49) on screen) but not HARBOR's orange or UNION's green, which went near black
// (~(30, 3, 0), (0, 20, 19)) round a lit white letter. A colour with little blue (under half its strongest channel) is lit by night,
// at NIGHT_BULLET of its colour, so its square reads as T's and N's do; T and N themselves stay as they were
const NIGHT_BULLET = .6;
const nightCarries = c => (c & 255) >= .5 * Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255);
const scaled = (c, k) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

// ── props (base centre, facing +z = toward the road for the shelter, toward the street for the lamp)
export const busShelter = () => { const ad = shelterAd(); return M('shelter|' + (ad ? ad.design.key : ''), () => {
  // 2.8 × 0.8 m, 2.5 m to the roof (under the 2.6 m awnings), a board on the roof's road edge; the east end is the ad panel, ground to roof
  // (pass 3 · signage: a poster in each face, lit at night); 0.8 m deep so a walker passes behind it on 2 m. The board: NO SVC on slate
  // (BUSES OUT, 2026-10-09: no bus stops here any more; it read BUS <route> in the route's colour)
  const BC = 0x6d707a, TC = inkOn(BC);
  const L = 28, Dp = 8, V = pv(L + 4, 36, Dp + 2), G = PAL.lamp, I = PAL.iron, GL = 0x9fd8ff, lab = 'NO SVC';
  for (const z of [1, Dp - 1]) V.box(1, 0, z, 2, 23, z + 1, G);                                                    // two posts (the ad panel is the east end)
  V.box(0, 23, 0, L + 2, 25, Dp, G); V.box(1, 25, 1, L + 1, 26, Dp - 1, 0xd9d5cc);                                 // roof + neutral top
  V.box(2, 3, 1, L - 1, 21, 2, GL, 1); for (let x = 7; x < L - 1; x += 7) V.box(x, 3, 1, x + 1, 21, 2, G);          // back glass (toward the sidewalk)
  V.box(1, 3, 2, 2, 21, Dp - 1, GL, 1);                                                                              // west end glass
  V.box(3, 5, 2, L - 1, 6, 5, PAL.wood); for (const x of [4, L - 3]) V.box(x, 0, 3, x + 1, 5, 4, I);             // the bench
  const w = textMask(lab).w, bx = ((L + 2 - w) >> 1); V.box(bx - 2, 26, Dp - 2, bx + w + 2, 35, Dp - 1, BC); word(V, lab, bx, 33, Dp - 1, TC, lit());   // NO SVC on slate
  const b = meshed(V);
  if (ad) { const P = ad.V, org = [V.org[0] + (L - 1) * CV + .05, 0, V.org[2]], k = new Bank(); meshVol(Object.assign(Object.create(P), { org }), k); stamp(k, b, 0, 0, 0, 0); }   // the panel: x 2.75–2.95, z 0–0.8 of the shelter
  return Object.assign(b, { kind: 'bus-shelter' }); }); };
export const globeLamp = () => M('globe', () => { const V = pv(6, 34, 6), G = PAL.lamp;
  V.box(1, 0, 1, 5, 2, 5, G); V.box(2, 2, 2, 4, 26, 4, G); V.box(1, 26, 1, 5, 27, 5, G);
  for (let y = 27; y < 33; y++) for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) { const dx = x - 2.5, dz = z - 2.5, dy = y - 29.5; if (dx * dx + dz * dz + dy * dy * 1.2 <= 8.5) V.set(x, y, z, y < 30 ? 0x25b84c : 0xf7f7f2, lit() || 1); }
  return Object.assign(meshed(V), { kind: 'globe-lamp' }); });
export const taxiSign = () => M('taxisign', () => { const V = pv(4, 26, 4); V.box(1, 0, 1, 3, 20, 3, PAL.iron); V.box(0, 18, 1, 4, 26, 3, 0xffb400); word(V, 'T', 1, 25, 3, PAL.ink); return Object.assign(meshed(V), { kind: 'taxi-sign' }); });

// ── the station house on a lot (gen.js calls this for lot type 'transit'). f = the street frame (kit.js), L = frontage (voxels)
export function stationFront(f, L, H, t) {
  const G = 0x1f7a52, GD = 0x155a3c, open = Math.min(L - 10, 40), a0 = (L - open) >> 1;
  f.box(0, 0, 0, L, H, 2, G); f.box(0, H - 8, 0, L, H, 3, GD);                                                       // green iron front, fascia
  const nm = 'SUBWAY'; f.box((L >> 1) - 18, H - 7, 3, (L >> 1) + 18, H - 1, 4, GD); f.text(nm, L >> 1, H - 1, 3, 4, PAL.white, lit(), 1, 1);
  // the stairwell (subway stations agent, 2026-10-08): the opening is carved down to the sidewalk from the street back to where the
  // flight goes under the kiosk's floor, a dark wall over that; the flight itself is below the sidewalk (stairwell(), built by gen.js
  // transitLot). The landing between the facade and the top nosing is the sidewalk: the walker steps off it onto the first tread.
  // (It used to be six 0.6 m treads standing 0.1–0.3 m ABOVE the sidewalk, and the walker sank 1.8 m through them.)
  const D = Math.round((STAIR.kiosk.nose + STAIR.open * STAIR.tread) / CV);   // 5.0 m in from the street line
  f.box(a0, 0, -(D - 1), a0 + open, H - 9, 2, -1);
  f.box(a0, 0, -D, a0 + open, H - 9, -(D - 1), 0x0e0f14); f.box(a0 - 1, 0, -(D - 1), a0, H - 9, 2, GD); f.box(a0 + open, 0, -(D - 1), a0 + open + 1, H - 9, 2, GD);
  // a plate under the fascia: the station name and its line bullets, centred; the name drops out if the frontage is too narrow
  const lines = String(t.lines || '').split(/\s+/).filter(Boolean).slice(0, 3), stn0 = (t.name || '').slice(0, 12), bw = lines.length * 9;
  const stn = stn0 && textMask(stn0).w + 4 + bw <= L - 8 ? stn0 : '', nw = stn ? textMask(stn).w + 4 : 0, x0 = (L - nw - bw) >> 1;
  if (nw + bw) f.box(x0 - 2, H - 19, 2, x0 + nw + bw + 1, H - 9, 3, PAL.white);
  if (stn) f.text(stn, x0, H - 10, 3, 4, GD, 0);
  lines.forEach((ln, k) => { const cx = x0 + nw + k * 9 + 3, c = LINE_COLOURS[ln] ?? 0x2f5bff; f.box(cx - 3, H - 18, 3, cx + 4, H - 10, 4, c); f.text(ln, cx - 2, H - 10, 4, 5, PAL.white, lit()); });
  // (W3b) a line map on each pier beside the stairwell: the line's stations top to bottom on its colour, this one lit pink (the left pier
  // the first line, the right the second, or the same line again); a white plate, 0.4 m wide, at eye height
  const here = t.id, pw = a0 - 1;
  if (pw >= 4) for (const [k, px] of [[0, 1], [1, a0 + open + 1]]) { const ln = LINE_BY_BULLET.get(lines[k] ?? lines[0]); if (!ln) continue;
    const n = ln.stops.length, step = 3, hh = n * step + 3, y0 = 11, pl = Math.min(pw - 1, 5), c = hexOf(ln.colour), xm = px + (pl >> 1);
    f.box(px, y0, 2, px + pl, y0 + hh, 3, PAL.white); f.box(xm, y0 + 2, 3, xm + 1, y0 + hh - 1, 4, c);
    ln.stops.forEach((sid, i) => { const y = y0 + hh - 3 - i * step, me = sid === here; f.box(xm - (me ? 1 : 0), y, 3, xm + 1 + (me ? 1 : 0), y + (me ? 2 : 1), me ? 5 : 4, me ? PAL.pink : PAL.ink, me ? lit() : 0); });
    f.box(px, y0 + hh, 2, px + pl, y0 + hh + 3, 3, c); }
  return { door: L >> 1, open, depth: D };
}

// ── THE STAIRS (subway stations agent, 2026-10-08). Every station goes down one flight, cut to the stairs clips' own steps
// (anim/cast/clips/transit.js stairs_down / stairs_up: rise 0.18 m, tread 0.36 m). Down, the clip plants each foot in the middle of a
// tread while its owner (subway/index.js) moves the walker 0.9 m/s along and 0.45 m/s down the line through the nosings, from the top
// nosing; up, it sets each foot just behind a nosing while the walker climbs the line through the feet of the risers (0.18 m lower),
// from the foot of the flight. Built in 0.09 m voxels: 2 make a riser, 4 a tread, exactly. N treads: the first OPEN are open to the sky
// (a hole in the ground: ground.js holes), the rest go on under a soffit (its underside 0.36 m below the landing: clear of a 1.8 m
// walker's head all the way down), so the walker is under the floor before it leaves the scene going down and before it appears going
// up. A landing at the foot, a dark wall at the end.
export const STAIR = { rise: .18, tread: .36, n: 14, open: 13, s: .09, kiosk: { w: 46, nose: .32 }, stairs: { w: 16, nose: .45, margin: 1 } };
const TILE = 0xd9d5cc, IRON = 0x1f7a52, IRON_D = 0x155a3c, CONC = 0xc9c4b8, JOINT_C = 0xb3ad9f, KERB = 0x8f929b, KERB_T = 0xa7a9b1, NOSE_Y = 0xffe23a;
// stairwell({ x, z, dir, y0, w, cover, style }) → { V, hole, top, w, y }. (x, z): the middle of the top nosing; dir: down the flight, a
// unit axis vector; y0: the landing; w: the stair's width (voxels); cover: how far along the flight (m from the nosing) something solid
// lies over the well at y0 (the kiosk's floor; the entrance's own pad): past it everything stays under the ground. style 'kiosk': the
// well alone (its top is the sidewalk); 'stairs': the open entrance's well and its concrete pad out to the lot line (what stands on the
// pad is entranceFurniture). World-aligned, meshed straight into the block bank (a structure); nothing in it is above y0.
// hole: the opening [x0, z0, x1, z1], from the top nosing's front edge to the soffit (ground.js cuts it out of the slab).
export function stairwell(o) {
  const { s, rise, tread, n, open } = STAIR, Rv = Math.round(rise / s), Tv = Math.round(tread / s), st = o.style === 'stairs';
  const mv = st ? STAIR.stairs.margin : 0, wall = 2, wv = o.w, NU = wv + 2 * (wall + mv), f0 = st ? Math.round(STAIR.stairs.nose / s) : 1;
  const foot = 4, back = 2, NA = f0 + n * Tv + foot + back, NYB = Rv * (n + 1) + 2;
  const [dx, dz] = o.dir, alongX = dx !== 0, sg = alongX ? dx : dz, a0 = -f0 * s, lenA = NA * s, lenU = NU * s;
  const ox = alongX ? (sg > 0 ? o.x + a0 : o.x - a0 - lenA) : o.x - lenU / 2, oz = alongX ? o.z - lenU / 2 : (sg > 0 ? o.z + a0 : o.z - a0 - lenA);
  const V = new Vol(alongX ? NA : NU, NYB, alongX ? NU : NA, { s, org: [ox, o.y0 - NYB * s, oz], ground: true }); V.keepHoles = true;
  const set = (iu, iy, ia, c, l = 0) => { const A = sg > 0 ? ia : NA - 1 - ia; if (alongX) V.set(A, iy, iu, c, l); else V.set(iu, iy, A, c, l); };
  const col = (iu, ia, y0, y1, c, l = 0) => { for (let y = y0; y < y1; y++) set(iu, y, ia, typeof c === 'function' ? c(y) : c, l); };
  const lowCap = NYB + Math.floor((SIDE - .005 - o.y0) / s), nl = TOD.night ? 3 : 1;   // (uncovered: the top stays under the slab)
  const treadC = k => shade(0xa7a9b1, Math.max(.42, 1.04 - k * .045)), padC = al => (Math.round(al / s) % 10 === 0 ? JOINT_C : CONC);
  const wallC = (y, alc) => { const up = (y - NYB) * s + alc / 2; if (st && y >= NYB - 2 && alc <= o.cover) return padC(alc);   // (m above the nosing line; the pad's own top)
    return up > 1.08 && up < 1.27 ? shade(IRON, Math.max(.5, 1 - (NYB - y) * .02)) : shade(TILE, Math.max(.34, 1 - (NYB - y) * .024)); };   // tiles, a green band
  for (let ia = 0; ia < NA; ia++) {
    const al0 = a0 + ia * s, alc = al0 + s / 2, cap = al0 + s <= o.cover + 1e-6 ? NYB : lowCap, k = Math.floor(alc / tread) + 1;
    const isBack = ia >= NA - back, flight = alc > 0 && alc < n * tread, footRow = alc > n * tread && !isBack, soffit = alc > open * tread, nosingRow = ia === f0 - 1;
    for (let iu = 0; iu < NU; iu++) {
      const inStair = iu >= mv + wall && iu < mv + wall + wv, inWall = !inStair && iu >= mv && iu < NU - mv;
      if (ia < f0 - 1 || (!inStair && !inWall)) { if (st && cap === NYB) col(iu, ia, NYB - 2, NYB, padC(alc)); continue; }   // the pad: the approach, the margins
      if (isBack) { col(iu, ia, 0, cap, y => st && y >= NYB - 2 ? padC(alc) : 0x0e0f14); continue; }
      if (inWall) { col(iu, ia, 0, cap, y => wallC(y, alc)); continue; }
      if (nosingRow) { col(iu, ia, 0, NYB - 1, treadC(0)); set(iu, NYB - 1, ia, NOSE_Y, nl); continue; }   // the top landing's nosing
      if (flight) { const top = NYB - Rv * k, front = al0 + s >= k * tread - 1e-6; col(iu, ia, 0, top - 1, treadC(k)); set(iu, top - 1, ia, front ? NOSE_Y : treadC(k), front ? nl : 0); }
      else if (footRow) col(iu, ia, 0, NYB - Rv * (n + 1), 0x2a2d38);
      if (soffit) col(iu, ia, NYB - 2 * Rv, cap, y => st && y >= NYB - 2 ? padC(alc) : 0x3b3d45);
    }
  }
  const hw = wv * s / 2, P = al => [o.x + dx * al, o.z + dz * al], p0 = P(-s), p1 = P(open * tread);
  const hole = alongX ? [Math.min(p0[0], p1[0]), o.z - hw, Math.max(p0[0], p1[0]), o.z + hw] : [o.x - hw, Math.min(p0[1], p1[1]), o.x + hw, Math.max(p0[1], p1[1])];
  return { V, hole: hole.map(v => +v.toFixed(3)), top: [+o.x.toFixed(3), +o.z.toFixed(3)], w: +(wv * s).toFixed(2), y: o.y0 };
}
// ── the open entrance's furniture: everything that stands on its pad, one 0.05-grain volume (world-aligned, from y0 up, so it never
// shares a voxel with the well below): a granite kerb round the opening (its sides and its back), green railings on it, the SUBWAY board
// across the back facing the street (SUBWAY on green; the line's bullet and its name in its colour on white) on two globe posts at its
// ends (green below, white above, lit at night), and the station's name on a green plate on the outside of each side railing.
// Reading directions: seen from the street, left → right is +u (u: across the flight, p = (−dz, dx)); the plate on the +u side reads
// down the flight, the one on the −u side up it. lines: the station's lines (transitnet.js LINES); name: the station's.
export function entranceFurniture(o, lines, name) {
  const s = .05, [dx, dz] = o.dir, alongX = dx !== 0, sg = alongX ? dx : dz, px = -dz, pz = dx, pSg = alongX ? pz : px;
  const backAl = STAIR.open * STAIR.tread, A1 = Math.ceil((backAl + STAIR.stairs.nose) / s - 1e-6), a0 = backAl - A1 * s;   // (along: from just in front of the street line, so the back kerb's first row, A1, starts at 4.68 m exactly)
  const NU = 44, NA = A1 + 6, NY = 54, u0 = -1.1, lenA = NA * s, lenU = NU * s, aOf = al => Math.round((al - a0) / s);
  const ox = alongX ? (sg > 0 ? o.x + a0 : o.x - a0 - lenA) : o.x + (pSg > 0 ? u0 : -u0 - lenU), oz = alongX ? o.z + (pSg > 0 ? u0 : -u0 - lenU) : (sg > 0 ? o.z + a0 : o.z - a0 - lenA);
  const V = new Vol(alongX ? NA : NU, NY, alongX ? NU : NA, { s, org: [ox, o.y0, oz], ground: true });
  const set = (iu, y, ia, c, l = 0) => { if (iu < 0 || iu >= NU || ia < 0 || ia >= NA) return; const A = sg > 0 ? ia : NA - 1 - ia, U = pSg > 0 ? iu : NU - 1 - iu; if (alongX) V.set(A, y, U, c, l); else V.set(U, y, A, c, l); };
  const box = (u0_, u1, y0, y1, a0_, a1, c, l = 0) => { for (let iu = u0_; iu < u1; iu++) for (let y = y0; y < y1; y++) for (let ia = a0_; ia < a1; ia++) set(iu, y, ia, typeof c === 'function' ? c(iu, y, ia) : c, l); };
  const mir = iu => NU - 1 - iu, nl = TOD.night ? 3 : 1, nt = TOD.night ? 3 : 0, KH = 3, F0 = aOf(-.12);   // F0: the kerbs' and the railings' front row, beside the top nosing
  // the kerb: 0.2 m wide over the well's side walls (u 0.70 … 0.90, a 2 cm lip over the opening), 0.15 high; across the back 4.68 … 4.88
  const kerbC = (iu, y) => y === KH - 1 ? KERB_T : KERB;
  box(4, 8, 0, KH, F0, A1 + 4, kerbC); box(mir(7), mir(3), 0, KH, F0, A1 + 4, kerbC); box(4, NU - 4, 0, KH, A1, A1 + 4, kerbC);
  // railings: 0.1 m posts every 0.45 m, a mid rail and a top rail (1.0 m over the kerb), on the kerb's middle; the back one too
  const rail = (iu0, ia0, alongRail, len) => { for (let k = 0; k < len; k++) { const iu = alongRail ? iu0 : iu0 + k, ia = alongRail ? ia0 + k : ia0, post = k % 9 === 0 || k >= len - 2;
    if (post) box(iu, iu + 2, KH, KH + 20, ia, ia + 1, IRON); else { box(iu, iu + 2, KH + 9, KH + 11, ia, ia + 1, IRON); box(iu, iu + 2, KH + 18, KH + 20, ia, ia + 1, IRON_D); } } };
  rail(5, F0, true, A1 + 2 - F0); rail(mir(6), F0, true, A1 + 2 - F0); rail(5, A1 + 1, false, NU - 10);
  // the board: 2.0 m × 1.1 m, its bottom 1.15 m over the kerb (on the back railing's top rail), on two globe posts at its ends; raised
  // letters toward the street (row A1 − 1). ART FIXES 2026-10-10 (slime): the globe posts stood at the front ends, beside the top nosing,
  // 4.7 m in front of the board, so from any street angle off the flight's axis the near one crossed SUBWAY and hid a letter (route9's
  // street frame: S_BWAY; every new entrance lost one). Now they carry the board: 0.15 m square, on the back kerb behind the board's
  // ends (the board's own posts were there), each globe 0.45 m across sitting on the board's top corner, above the letters (centred over
  // the board's front row: inside the volume and the reservation), so the entrance's own furniture no longer stands between the street
  // and the word. The walkway and the stairs keep what they had: the posts are inside the entrance's own reservation, on the kerb behind
  // the open flight; the globe tops are 2.7 m over the pad, the reservation's height (the board came down 0.1 m to keep them there).
  // The railings now run to the front row, where the posts were
  const B0 = KH + 20, B1 = B0 + 22, bu0 = 2, bu1 = NU - 2, ba = A1 + 1;
  for (const c0 of [4, mir(6)]) { box(c0, c0 + 3, KH, B1, ba, ba + 3, IRON);
    const cu = c0 + 1.5, ca = ba + .5, cy = B1 + 4; for (let iu = c0 - 4; iu < c0 + 7; iu++) for (let ia = ba - 4; ia < ba + 7; ia++) for (let y = cy - 5; y < cy + 5; y++) {
      const du = iu + .5 - cu, da = ia + .5 - ca, dy = y + .5 - cy; if (du * du + da * da + dy * dy > 4.6 * 4.6) continue; set(iu, y, ia, dy < -1 ? 0x25b84c : 0xf7f7f2, dy < -1 ? 0 : nl); } }
  box(bu0, bu1, B0, B1, ba, ba + 2, (iu, y) => y >= B0 + 11 ? IRON : y === B0 + 10 ? IRON_D : PAL.white);
  const letters = (str, uL, ytop, c, l) => { const t = textMask(str); for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) set(uL + i, ytop - j, ba - 1, c, l); return t.w; };
  { const t = textMask('SUBWAY'); letters('SUBWAY', bu0 + ((bu1 - bu0 - t.w) >> 1), B1 - 3, PAL.white, nt); }
  // (the line's name beside its bullet when the board holds both — one line, a short name: [U] UNION, [T] TIDE; else the bullets alone,
  // centred: [H] at BLACKPINE, [H][U] at ELM ST, [T][H] at LOW TIDE — SUBWAY PLAN 2026-10-09: HARBOR's 47 voxels overran the 40-voxel board)
  const L0 = lines[0], nb = lines.length, bw = nb * 9 + (nb - 1) * 2, n0 = L0 ? L0.name.split(' ')[0] : '', lname = nb === 1 && n0 && bw + 3 + textMask(n0).w <= bu1 - bu0 ? n0 : '', t2 = textMask(lname), total = bw + (lname ? 3 + t2.w : 0);
  const ub = bu0 + ((bu1 - bu0 - total) >> 1), yb = B0 + 9;
  lines.forEach((ln, k) => { const c = hexOf(ln.colour), bx = ub + k * 11, glow = TOD.night && !nightCarries(c);   // (lit by night: HARBOR, UNION — NIGHT_BULLET above)
    box(bx, bx + 9, yb - 8, yb + 1, ba - 1, ba, glow ? scaled(c, NIGHT_BULLET) : c, glow ? 3 : 0); const tb = textMask(ln.bullet); letters(ln.bullet, bx + ((9 - tb.w) >> 1), yb - 1, inkOn(c), nt); });
  if (lname) letters(lname, ub + bw + 3, yb - 1, hexOf(L0.colour), 0);
  // the name plates: on the outside of each side railing (u 0.85 … 0.95), 0.5 m tall over the mid and top rails, raised letters
  const tn = textMask(name), PL = tn.w + 6, pa0 = Math.max(F0 + 4, ((F0 + 4 + A1) >> 1) - (PL >> 1)), PY0 = KH + 8, PY1 = PY0 + 10;
  for (const side of [1, -1]) { const iuP = side > 0 ? 39 : mir(39), iuL = side > 0 ? 40 : mir(40);
    box(iuP, iuP + 1, PY0, PY1, pa0, pa0 + PL, (iu, y) => y === PY0 || y === PY1 - 1 ? IRON_D : IRON);
    for (let j = 0; j < 7; j++) for (let i = 0; i < tn.w; i++) if (tn.at(i, j)) set(iuL, PY1 - 2 - j, side > 0 ? pa0 + 3 + i : pa0 + PL - 4 - i, PAL.white, nt); }
  return V;
}
// STATION COPS (2026-10-09) · where the sim's posted officers stand at an entrance (simstate/stationcops.js draws them, the anchor's
// `cops`: [[x, z, yaw] × 0–2]): one each side of the mouth, facing the street and turned a little toward the mouth, just outside what the
// entrance covers (the open stairs' railings, the kiosk's opening and its globe posts), on the sidewalk's building side or the lot. Each
// stand is checked like the cast's standing people (REG.fitsPerson with the clear walkway rule, personClear, headClear: clear of every
// prop, wall, reservation — the entrance's own and the kerb strip in front of it — and of the walkers' clear path), kept COP_STAND.life m
// from the block's own standing people, and slides along the street (up to COP_STAND.slide m), then further out from the street line
// (COP_STAND.out), until it fits; a side with no room has none (a lone officer there). The stands are reserved once chosen ('cop-stand':
// nothing else is placed there — CROWD GRID, 2026-10-10: but the walkers' lanes no longer bend round them, audit.js WALK_FREE. A stand is
// empty unless the station is posted; a posted officer is a body on the crowd's body map, and the walkers step round it: pedsim.js bodyStep).
export const COP_STAND = { side: .45, out: [.55, .8, .35, 1.1, 1.4], slide: 3, step: .25, turn: .45, life: .8 };
function copStands(s, life) {
  const C = COP_STAND, [dx, dz] = s.dir, px = -dz, pz = dx, sx = s.top[0] - dx * s.nose, sz = s.top[1] - dz * s.nose, face = Math.atan2(-dx, -dz);
  const half = (s.entry === 'kiosk' ? Math.max(2, s.w / 2) : 1.1) + C.side, tries = [], out = [];
  for (const o of C.out) for (let a = 0; a <= C.slide + 1e-6; a += C.step) tries.push([o, a, a + Math.abs(o - C.out[0]) * 2]);
  tries.sort((p, q) => p[2] - q[2]);   // (nearest the mouth first: along the street before out from it)
  for (const sg of [1, -1]) for (const [o, a] of tries) { const u = sg * (half + a), x = sx - dx * o + px * u, z = sz - dz * o + pz * u;
    if (life.some(p => Math.hypot(p.x - x, p.z - z) < C.life) || !REG.fitsPerson(x, z, SIDE, { ignore: 'plinth', items: false }) || !REG.personClear(x, SIDE, z) || !REG.headClear(x, SIDE, z)) continue;
    REG.keep([x - .25, SIDE, z - .25, x + .25, SIDE + 1.8, z + .25], 'cop-stand'); out.push([+x.toFixed(2), +z.toFixed(2), +(face - sg * C.turn).toFixed(3)]); break; }
  return out;
}
// an open entrance's geometry from its slot: the lot line on the slot's face, the flight going down into the lot from just behind it,
// centred on the slot along the street. rect: what it covers on the lot (the pad, the kerb, the railings, the board) · front: the
// sidewalk's kerb strip in front of it (nothing tall is placed there: the way in stays open) · door: its middle on the lot line
export function entranceAt(b, t) {
  const R = b.R, face = t.face || '-z', dir = { '-z': [0, 1], '+z': [0, -1], '-x': [1, 0], '+x': [-1, 0] }[face], nose = STAIR.stairs.nose, alongX = dir[0] !== 0;
  const line = face === '-z' ? R.z0 : face === '+z' ? R.z1 : face === '-x' ? R.x0 : R.x1, x = alongX ? line + dir[0] * nose : t.x, z = alongX ? t.z : line + dir[1] * nose;
  const hw = STAIR.stairs.w * STAIR.s / 2 + .18 + .09, len = STAIR.open * STAIR.tread + .27, P = al => [x + dir[0] * al, z + dir[1] * al];
  const span = (a, b2, h) => { const p = P(a), q = P(b2); return alongX ? [Math.min(p[0], q[0]), z - h, Math.max(p[0], q[0]), z + h] : [x - h, Math.min(p[1], q[1]), x + h, Math.max(p[1], q[1])]; };
  return { x, z, dir, face, rect: span(-nose, len, hw + .1), front: span(-nose - 2, -nose - 2 + .85, hw + .3), door: P(-nose), cover: len, y0: SIDE + CV };
}

// ── the slots in a block (the kit's transit list), reservations first, props last
const inBlock = (b, t) => Math.floor(t.x / PITCH) === b.i && Math.floor(t.z / PITCH) === b.j;   // (SPREAD: /32 dropped a station at a spread)
export function transitLots(b, lots, kit) {   // planBlock: the lot under a subway slot becomes a station house (spec pass: far and near agree)
  for (const t of kit.transit || []) { if (t.kind !== 'subway' || t.entry === 'stairs' || !inBlock(b, t)) continue;   // (an open stair entrance: transitBefore)
    const l = lots.find(l => t.x >= l.x0 && t.x < l.x1 && t.z >= l.z0 && t.z < l.z1 && l.spec && !['tower', 'alley'].includes(l.spec.type)); if (!l) continue;
    Object.assign(l.spec, { type: 'transit', st: 1, ground: 'transit', shops: [], fire: false, fireBack: false, canopy: null, piece: null, gag: null, roofPeople: false, transit: t, wall: 0x1f7a52, trim: PAL.white }); }
}
const curbBox = (b, bk, rot, x, z) => REG.boxOf(bk, rot, x, SIDE, z);
// a stop stays on its block's sidewalk, 2.5 m clear of the corners (crossings, signals): a slide never carries it into the road
const onWalk = (b, e, ax) => { const s = slab(b.i, b.j), m = 2.5; return ax ? e[0] >= s.x0 + m && e[3] <= s.x1 - m && e[2] >= s.z0 - .01 && e[5] <= s.z1 + .01 : e[2] >= s.z0 + m && e[5] <= s.z1 - m && e[0] >= s.x0 - .01 && e[3] <= s.x1 + .01; };
export function transitBefore(b, kit, bank, A) {   // bus / taxi strips: find a clear spot along the curb now (lamps and signals are reserved already), keep it
  A.transit = [];
  for (const t of kit.transit || []) { if (t.kind === 'subway' || !inBlock(b, t)) continue; const bk = t.kind === 'bus' ? busShelter() : taxiSign(), rot = t.rot ?? 0, ax = rot & 1 ? 0 : 1, az = rot & 1 ? 1 : 0;
    let spot = null; for (const d of [0, .5, -.5, 1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4]) { const x = t.x + ax * d, z = t.z + az * d, e = curbBox(b, bk, rot, x, z); if (onWalk(b, e, ax) && !REG.why(e, { items: false, doors: false, ignore: 'plinth', walk: false })) { spot = [x, z]; REG.keep(e, 'transit'); break; } }   // (a stop may narrow the clear path: the lane goes behind it)
    if (spot) A.transit.push({ t, bk, rot, x: spot[0], z: spot[1], keep: REG.blk?.keep[REG.blk.keep.length - 1] }); else REG.skip(bk.kind, [t.x, SIDE, t.z], 'no clear curb for the ' + t.kind + ' stop'); }
  // (subway stations agent) an open stair entrance: its rect on the lot is reserved now, before the block is built — nothing is put
  // there, and any floor, fence or path a builder draws over it is cut out when it is meshed (REG.holes: vox.js meshVol); the kerb
  // strip in front of it stays clear of trees, hydrants and parked cars (street.js keeps 2.2 m either side of a transit reservation)
  A.entrances = [];
  for (const t of kit.transit || []) { if (t.kind !== 'subway' || t.entry !== 'stairs' || !inBlock(b, t)) continue; const e = entranceAt(b, t), [x0, z0, x1, z1] = e.rect, fr = e.front;
    const why = REG.why([x0, SIDE, z0, x1, SIDE + 2.6, z1], { items: false, doors: false, walk: false, ignore: 'plinth' });
    if (why) { REG.skip('subway-entrance', [e.x, SIDE, e.z], 'no room for the stairs: ' + why); continue; }
    REG.keep([x0, SIDE, z0, x1, SIDE + 2.8, z1], 'transit'); REG.keep([fr[0], SIDE, fr[1], fr[2], SIDE + 2.6, fr[3]], 'transit');
    if (REG.blk) (REG.blk.holes ??= []).push([x0, SIDE - 3.2, z0, x1, SIDE + 3.2, z1]); A.entrances.push({ t, e }); }
}
const FACE_ROT = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 };
export function transitAfter(b, kit, bank, A) {
  // the facades are built now: slide off any awning, stand or canopy the lots put over the reserved strip (never force it in)
  REG.group('transit'); for (const s of A.transit || []) { const ax = s.rot & 1 ? 0 : 1, az = s.rot & 1 ? 1 : 0; let done = false;
    for (const soft of [true, false]) { for (const d of [0, .5, -.5, 1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7]) { const x = s.x + ax * d, z = s.z + az * d, e = curbBox(b, s.bk, s.rot, x, z);   // (first a spot clear of bags too)
      if (onWalk(b, e, ax) && !REG.why(e, { ignore: ['transit', 'plinth'], soft, walk: false })) { stamp(s.bk, bank, s.rot, x, SIDE, z); s.x = x; s.z = z; if (s.keep) s.keep.box = e; done = true; break; } } if (done) break; }   // (the reserved strip follows the stop: no phantom keep where it was)
    if (!done) { REG.skip(s.bk.kind, [s.x, SIDE, s.z], 'no clear curb once the facades were built'); s.skipped = true; if (s.keep) s.keep.box = [0, -99, 0, 0, -99, 0]; } }
  A.transit = (A.transit || []).filter(s => !s.skipped);
  // (subway stations agent) the open stair entrances reserved before the build: the well and its pad, then what stands on the pad
  REG.group('station');
  for (const { t, e } of A.entrances || []) {
    const lines = String(t.lines || '').split(/\s+/).filter(Boolean).map(bl => LINE_BY_BULLET.get(bl)).filter(Boolean);
    const W = stairwell({ x: e.x, z: e.z, dir: e.dir, y0: e.y0, w: STAIR.stairs.w, cover: e.cover, style: 'stairs' }); meshVol(W.V, bank);
    const F = entranceFurniture({ x: e.x, z: e.z, dir: e.dir, y0: e.y0 }, lines, t.name || ''); F.keepHoles = true; meshVol(F, bank);
    (A.stations ??= []).push({ id: t.id, x: e.door[0], z: e.door[1], rot: FACE_ROT[e.face], top: W.top, dir: e.dir, y: W.y, w: W.w, nose: STAIR.stairs.nose, hole: W.hole, entry: 'stairs' }); }
  // STATION COPS (2026-10-09): every station's two stands for the sim's posted officers (copStands), now that everything is in
  for (const s of A.stations || []) if (s.top && s.dir) s.cops = copStands(s, A.life || []);
  // the anchors: every stop where it ended up; a station's door on the street line, and (subway stations agent) its flight — the top
  // nosing's middle (top), down the flight (dir), the landing's height (y), the stair's width (w), how far the nosing is in from the
  // street line (nose) — which subway/index.js walks the stairs on; holes: the stairwells' openings, cut out of the ground (ground.js)
  const anchors = A.anchors ??= { lots: {}, sites: [] }; anchors.transit = (A.transit || []).map(s => ({ id: s.t.id, kind: s.t.kind, x: +s.x.toFixed(2), z: +s.z.toFixed(2), rot: s.rot }))
    .concat((A.stations || []).map(s => ({ id: s.id, kind: 'subway', x: +s.x.toFixed(2), z: +s.z.toFixed(2), rot: s.rot, ...(s.top ? { top: s.top, dir: s.dir, y: +s.y.toFixed(3), w: s.w, nose: s.nose, entry: s.entry, cops: s.cops || [] } : {}) })));
  const holes = (A.stations || []).filter(s => s.hole).map(s => s.hole); if (holes.length) anchors.holes = holes;
}
