// THE SUPPLY SIDE · buildings, fences, floors and roofs (owner: the supply agent). Everything builds through the engine's ctx (engine.js):
// masses are registered and clipped, facade projections become keep-outs, props go down through ctx.put. Facades are drawn on kit.js
// frames: a along the wall (left → right seen from outside), y up from the slab (0.1 voxels), d out of the wall (0 = the skin).
//   brick     brick loft warehouse: piers, steel-sash windows, the old painted name under a corbelled cornice, roll-ups at grade
//   shed      corrugated steel shed with a gable roof, clerestory band, big end doors, the name on the long side
//   sawtooth  factory with a sawtooth roof (north glass), the teeth showing on the end walls
//   cold      cold storage box: insulated panels, a huge painted name, dock seals
//   garage    auto shop: bays at grade under a backlit fascia sign
//   quonset   half-barrel hut with a painted end wall
//   front     a small two-storey front (lunch counter, bodega, check cashing, the union hall) with a shop sign
import { Vol } from '../../vox.js';
import { frame, AIR, TOD, fireEscape } from '../../kit.js';
import { stamp } from '../../vox.js';
import { plate } from './props.js';
import { C, PAL, CV, SIDE, REG, shade, hash, H, px, stencil, hand, serif, impact, script, ftext, doorAt, fw, faceRot, inkOn, lit, logSign } from './lib.js';
import { fitWindow } from '../../interiors/store/fill.js';   // fit-out pass (interiors/store/fill.js)

// ── lettering that fits: the biggest scale / size of a face that fits w × h voxels, on up to two lines
export function fitName(name, kind, w, h) {
  const tryOne = t => { if (kind === 'serif' || kind === 'serif-even' || kind === 'impact' || kind === 'script') { for (const s of [44, 38, 32, 27, 23, 20, 17, 14, 12]) { const M = kind === 'serif' || kind === 'serif-even' ? serif(t, s, kind === 'serif-even') : kind === 'script' ? script(t, s) : impact(t, s); if (M.w <= w && M.h <= h) return { M, sc: 1 }; } return null; }
    const M = kind === 'stencil' ? stencil(t) : kind === 'hand' ? hand(t, t.length) : px(t); for (const sc of [4, 3, 2, 1]) if (M.w * sc <= w && M.h * sc <= h) return { M, sc }; return null; };
  if (kind === 'serif' || kind === 'serif-even' || kind === 'impact' || kind === 'script') { const r = fitName(name, 'rasterOnly:' + kind, w, h); return r || fitName(name, 'px', w, h); }   // (serif-even: the serif with even letter spacing, vox.js rasterMask o.even)
  if (kind.startsWith('rasterOnly:')) kind = kind.slice(11);
  const one = tryOne(name); const words = name.split(' ');
  if (words.length > 1) { let best = null; for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), A = tryOne2(a, b); if (A && (!best || A.sc * A.M.h > best.sc * best.M.h)) best = A; }
    if (best && (!one || best.M.h * best.sc > one.M.h * one.sc * 1.35)) return best; }
  return one;
  function tryOne2(a, b) { const hh = Math.floor((h - 2) / 2); const A = tryOneH(a, hh), B = tryOneH(b, hh); if (!A || !B) return null; const sc = Math.min(A.sc, B.sc); return { M: A.M, M2: B.M, sc, two: true, fa: A, fb: B }; }
  function tryOneH(t, hh) { const save = h; h = hh; const r = tryOne(t); h = save; return r; }
}
// draw a fitted name on a frame, centred on a, its top at ytop (painted: d 0, the skin; raised: d 1, proud of the board)
export function paintName(f, fit, a, ytop, col, o = {}) {
  if (!fit) return 0; const d0 = o.d0 ?? (o.raised ? 1 : 0), d1 = d0 + 1, l = o.l ?? 0;
  { const [x, z] = fw(f, a, 0); logSign(fit.two ? fit.fa.M.s + ' ' + fit.fb.M.s : fit.M.s, x, z); }
  if (fit.two) { const A = fit.fa, B = fit.fb; ftext(f, A.M, a, ytop, { sc: A.sc, c: col, d0, d1, l }); ftext(f, B.M, a, ytop - A.M.h * A.sc - 3, { sc: B.sc, c: col, d0, d1, l }); return A.M.h * A.sc + B.M.h * B.sc + 3; }
  ftext(f, fit.M, a, ytop, { sc: fit.sc, c: col, d0, d1, l }); return fit.M.h * fit.sc;
}
export const nameH = fit => !fit ? 0 : fit.two ? fit.fa.M.h * fit.fa.sc + fit.fb.M.h * fit.fb.sc + 3 : fit.M.h * fit.sc;
export const nameW = fit => !fit ? 0 : fit.two ? Math.max(fit.fa.M.w * fit.fa.sc, fit.fb.M.w * fit.fb.sc) : fit.M.w * fit.sc;

// ── facade pieces (all in frame voxels)
// steel-sash window: recessed 0.2, iron muntins, a concrete sill; arched: a stepped brick arch over it; lit panes at night (a night shift)
export function sash(f, a0, y0, w, h, o = {}) {
  const trim = o.trim ?? C.concL, seed = o.seed ?? 0;
  f.box(a0 - 1, y0 - 1, 0, a0 + w + 1, y0 + h + 1, 1, o.frame ?? C.steelD);
  f.box(a0, y0, -2, a0 + w, y0 + h, 1, AIR);
  const on = TOD.night && hash(a0, y0, seed) > (o.litShare ?? .62);
  f.box(a0, y0, -3, a0 + w, y0 + h, -2, (a, y) => ((a - a0) % 4 === 3 || (y - y0) % 5 === 4) ? C.iron : on ? (y - y0 > h * .55 ? C.lit : C.litLo) : (y - y0 > h * .6 ? PAL.glassHi : PAL.glassLo), on ? 3 : 1);
  if (!on && hash(a0, y0, seed + 3) > .78) f.box(a0 + 4, y0 + 5, -3, a0 + 7, y0 + 9, -2, 0xe8e2d0);                                  // a broken pane patched with board
  f.box(a0 - 1, y0 - 2, 0, a0 + w + 1, y0 - 1, 2, trim);
  if (o.arch) for (let t = 0; t < 3; t++) f.box(a0 - 1 + t, y0 + h + 1 + t, 0, a0 + w + 1 - t, y0 + h + 2 + t, 1, o.archCol ?? shade(o.wall ?? C.brick, .82));
}
// roll-up door at y0 (0 at grade, 12 on a dock): steel jambs, slats recessed 0.3, the coil hood over it; returns the door's centre (a)
export function rollup(f, a0, w, h, col, y0 = 0, o = {}) {
  f.box(a0 - 2, y0, 0, a0 + w + 2, y0 + h + 4, 1, C.steelD);
  if (!y0 && !o.plain) for (const a of [a0 - 2, a0 + w]) f.box(a, 0, 0, a + 2, 12, 2, (aa, y) => ((y >> 1) & 1) ? C.hazard : C.ink);
  f.box(a0, y0 + (y0 ? 0 : 1), -3, a0 + w, y0 + h, 2, AIR);
  const open = o.open ? Math.round(h * o.open) : 0;
  f.box(a0, y0 + (y0 ? 0 : 1) + open, -3, a0 + w, y0 + h, -2, (a, y) => (y - y0) % 3 === 0 ? shade(col, .78) : col);
  if (open) { const fl = y0 + (y0 ? 0 : 1); f.box(a0, fl, -12, a0 + w, y0 + open, -3, AIR); f.box(a0, 1, -13, a0 + w, y0 + open + 2, -12, 0x2a2d38);   // the dark back wall reaches the floor
    if (y0) f.box(a0, 1, -12, a0 + w, fl, -3, 0x5a5650);                                                                                   // the dock's floor inside, at dock height
    if (o.boxes) f.box(a0 + 3, fl, -11, a0 + 12, fl + Math.min(open, 9), -6, 0xc99a5e); }
  f.box(a0 - 1, y0 + h, 0, a0 + w + 1, y0 + h + 4, 3, shade(col, .55));
  if (o.num) { const M = stencil(o.num); if (M.w + 4 <= w + 4) { const yt = y0 + h + 13; f.box(a0 + (w >> 1) - (M.w >> 1) - 2, yt - 9, 1, a0 + (w >> 1) - (M.w >> 1) + M.w + 2, yt + 2, 2, o.numBg ?? C.ink); ftext(f, M, a0 + (w >> 1), yt, { c: o.numCol ?? C.hazard, d0: 2, d1: 3 }); } }
  return a0 + (w >> 1);
}
// a man door with a small hood and (at night) a caged lamp; registers the doorway
export function manDoor(f, a0, col, side, o = {}) {
  f.box(a0 - 1, 0, 0, a0 + 13, 24, 1, C.steelD); f.box(a0, 1, -2, a0 + 12, 23, 2, AIR); f.box(a0, 1, -3, a0 + 12, 23, -2, (a, y) => (y === 12 && a > a0 + 8) ? PAL.gold : col);
  f.box(a0 - 2, 24, 0, a0 + 14, 26, 4, C.steelD); f.box(a0 + 5, 27, 0, a0 + 8, 30, 2, C.iron); f.box(a0 + 5, 27, 2, a0 + 8, 29, 3, 0xffe9b0, TOD.night ? 3 : 1);
  if (o.plate) namePlate(o.ctx, f, a0 + 15, 1.3, o.plate, side, o.plateBg ?? C.chalk, o.plateFg ?? C.red);
  if (!o.noDoor) doorAt(f, a0 + 6, side);
  return a0 + 6;
}
// a loading dock along a0…a1: a concrete platform 1.2 m tall and 1.4 m deep, yellow nosing, black bumpers under each door, steps at one end
export function dockPlatform(f, a0, a1, doors, o = {}) {
  f.box(a0, 0, 0, a1, 12, 14, C.conc); f.box(a0, 0, 13, a1, 12, 14, C.concD); f.box(a0, 11, 12, a1, 12, 14, C.hazard);
  for (const a of doors) for (const da of [-5, 4]) f.box(a + da, 5, 14, a + da + 2, 11, 16, C.rubber);
  if (o.steps !== false) for (let k = 0; k < 4; k++) f.box(a1, 0, 2, a1 + 8 - k * 2, 12 - k * 3, 12, C.concD);
  if (o.canopy) f.box(a0 - 2, o.canopy, 0, a1 + 2, o.canopy + 2, 16, C.steelD);
}
// a building's interior is air behind a 0.5 m shell (the far downsample still fills every wall cell; the audit's island search stays
// under its 4M-voxel queue; open doors look into the dark instead of into solid wall)
export function hollow(V, B, Hv, t = 5) { if (B.x1 - B.x0 <= 2 * t + 2 || B.z1 - B.z0 <= 2 * t + 2 || Hv <= t + 4) return; V.clear(B.x0 + t, 3, B.z0 + t, B.x1 - t, Hv - 3, B.z1 - t); }
export const pier = (f, a, y0, y1, col) => f.box(a, y0, 1, a + 3, y1, 2, col);
export const downpipe = (f, a, y1, col = C.steelD) => { f.box(a, 1, 1, a + 2, y1, 3, col); f.box(a - 1, y1 - 2, 1, a + 3, y1, 3, col); f.box(a, 1, 3, a + 2, 2, 4, col); };
// ── door-level life: a gooseneck lamp (lit at night), a gas meter, an electrical panel with its conduit, window bars, a blade sign
export function goose(f, a, y) { const on = TOD.night; f.box(a, y + 3, 1, a + 1, y + 4, 6, C.iron); f.box(a, y + 1, 5, a + 1, y + 3, 6, C.iron);
  f.box(a - 2, y, 4, a + 3, y + 1, 7, 0x1f5c4a); f.box(a - 2, y - 2, 4, a + 3, y, 7, on ? 0xffd27a : 0xfff2c4, on ? 3 : 1); }
export function meter(f, a) { f.box(a, 1, 1, a + 1, 9, 2, 0x9aa0a8, 2); f.box(a - 1, 9, 1, a + 3, 13, 3, 0xc9ced6); f.set(a, 11, 3, C.ink); f.set(a + 1, 11, 3, C.chalk); }
export function panel(f, a, top) { f.box(a, 10, 1, a + 5, 18, 2, 0x8a9099); f.box(a + 1, 16, 2, a + 4, 17, 3, C.hazard); f.box(a + 2, 18, 1, a + 3, top, 2, 0x8a9099); }
export function bars(f, a0, y0, w, h) { for (let a = a0; a < a0 + w; a += 2) f.box(a, y0, 1, a + 1, y0 + h, 2, C.iron); f.box(a0 - 1, y0, 1, a0 + w + 1, y0 + 1, 2, C.iron); f.box(a0 - 1, y0 + h - 1, 1, a0 + w + 1, y0 + h, 2, C.iron); }
// a blade: a board sticking out of the wall at a (voxels), its word stacked a letter to a row on both faces, lit at night if asked
export function blade(f, a, y0, word, bg, fg, o = {}) {
  const chars = [...word], BW = 9, BH = chars.length * 9 + 4, l = o.lit && TOD.night ? 3 : 0;
  f.box(a, y0 + BH - 2, 0, a + 2, y0 + BH, 3, C.iron); f.box(a, y0, 0, a + 2, y0 + 2, 3, C.iron);
  f.box(a, y0, 3, a + 2, y0 + BH, 3 + BW, bg, l); f.box(a, y0, 3 + BW - 1, a + 2, y0 + BH, 3 + BW, shade(bg, .8));
  chars.forEach((ch, k) => { if (ch === ' ') return; const M = px(ch), ytop = y0 + BH - 3 - k * 9;
    for (const side of [1, -1]) { f.V.recNext(); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const dd = side > 0 ? 3 + BW - 2 - ((BW - M.w) >> 1) - i : 3 + ((BW - M.w) >> 1) + i, aa = side > 0 ? a + 2 : a - 1;
      f.set(aa, ytop - j, dd, fg, l); f.rec(word, aa, ytop - j, dd, side, 0); } } });
}
// the company's name on a tin plate by its door (0.05 grain, mounted: stamped straight into the block, clear of the door)
export function namePlate(ctx, f, a, y, text, side, bg = C.chalk, fg = C.ink, style = 'tin') { if (!text || !ctx) return 0; const w = (px(text).w + 8) / 2; if (a + w > f.len - 1 || w > 24) return 0;
  const p = plate(text, bg, fg, style), [x, z] = fw(f, a + w / 2, 2), rot = faceRot[side];
  stamp(p, ctx.bank, rot, x, SIDE + y, z); logSign(text, x, z); return w; }

// ── a custom building volume (sheds, quonsets, sawtooth): padded like ctx.building, registered through ctx.mass, meshed at ctx.finish
export function shell(ctx, rect, hTop, faces, roofY) {
  const [x0, z0, x1, z1] = rect, pad = s => faces.includes(s) ? 16 : 4, px0 = pad('-x'), px1 = pad('+x'), pz0 = pad('-z'), pz1 = pad('+z');
  const nx = Math.round((x1 - x0) / CV) + px0 + px1, nz = Math.round((z1 - z0) / CV) + pz0 + pz1, V = new Vol(nx, hTop + 2, nz, { s: CV, org: [x0 - px0 * CV, SIDE, z0 - pz0 * CV] });
  const B = { x0: px0, z0: pz0, x1: nx - px1, z1: nz - pz1 }; ctx.mass(V, rect, { top: SIDE + hTop * CV, roofY: roofY === undefined ? undefined : SIDE + roofY * CV });
  return { V, B, F: s => frame(V, B, s) };
}
const sides = ['-z', '+z', '-x', '+x'];

// ═════════ BRICK · the loft warehouse (st 2–6: ground 4.2 m, floors 3.4 m, a name band at the top)
export function brick(ctx, s) {
  const st = s.st, Hv = 42 + (st - 1) * 34 + 18, wall = s.wall, pierC = shade(wall, .88), trim = s.trim;
  const b = ctx.building(s.x0, s.z0, s.x1, s.z1, { h: Hv * CV, wall, trim, faces: s.faces, cornice: false, parapet: 7, roof: s.roofCol, extra: st >= 5 ? 60 : 36 });
  const out = { top: b.top, H: Hv, doors: [], V: b.V, B: b.B }; hollow(b.V, b.B, Hv);
  for (const side of s.faces) { const f = b.F(side), L = f.len, main = side === s.main, bw = s.bay ?? 44, n = Math.max(1, Math.floor((L - 8) / bw)), m = (L - n * bw) >> 1;
    // piers between the bays, a corbelled cornice, the painted name in the band
    for (let k = 0; k <= n; k++) pier(f, m + k * bw - 2, 3, Hv - 8, pierC);
    f.box(-1, Hv - 8, 0, L + 1, Hv - 5, 2, trim); for (let a = 1; a < L - 1; a += 4) f.box(a, Hv - 10, 0, a + 2, Hv - 8, 2, trim); f.box(-1, Hv + 5, 0, L + 1, Hv + 8, 2, trim);
    for (let fl = 1; fl < st; fl++) { const y0 = 42 + (fl - 1) * 34 + 7; for (let k = 0; k < n; k++) { const a = m + k * bw + 5, w = bw - 10;
      if (s.win === 'pair') { const ww = (w - 4) >> 1; sash(f, a, y0, ww, 22, { arch: s.arch, wall, seed: s.seed + fl, trim }); sash(f, a + ww + 4, y0, ww, 22, { arch: s.arch, wall, seed: s.seed + fl + 9, trim }); }
      else sash(f, a, y0, w, 22, { arch: s.arch, wall, seed: s.seed + fl, trim }); } }
    // the name band: on the main face the company, on a second street face the address or the trade
    const txt = main ? s.name : (s.sub || null); if (txt) { const fit = fitName(txt, s.font, L - 16, main ? 16 : 10); if (fit) paintName(f, fit, L >> 1, Hv - 11 + (nameH(fit) > 14 ? 0 : -((14 - nameH(fit)) >> 1)), s.paint ?? C.chalk); }
    // ground floor: roll-ups and a man door per bay pattern (the dock side has its own platform)
    if (side === s.dock) { const doors = []; for (let k = 0; k < n; k++) if (k % 2 === 0 || n <= 2) doors.push(m + k * bw + (bw >> 1));
      dockPlatform(f, 2, L - 12, doors, { canopy: 12 + 34 }); for (const a of doors) { rollup(f, a - 14, 28, 30, s.door, 12, { num: s.dockNums?.shift(), open: hash(a, s.seed) > .6 ? .55 : 0, boxes: true }); out.doors.push({ side, a, world: fw(f, a, 0) }); }
      continue; }
    let manPut = false; const fire = main && st >= 3 && L >= 80;
    for (let k = 0; k < n; k++) { const a = m + k * bw; if (!manPut && (k === n - 1 || (main && k === 1))) { const d = a + (bw >> 1) - 6; manDoor(f, d, s.door2 ?? C.ink, side, { plate: main ? s.plate : null, ctx }); meter(f, d - 5); if (main && s.sub) namePlate(ctx, f, d + 15, 2.2, s.sub, side, C.ink, C.chalk); manPut = true; continue; }
      if ((k + (main ? 0 : 1)) % 2 === 0 && s.grade !== false) { const c = rollup(f, a + 7, bw - 14, 32, s.door, 0, { num: s.gradeNums?.shift() }); doorAt(f, c, side); goose(f, c, 41); out.doors.push({ side, a: c, grade: true, world: fw(f, c, 0) }); }
      else { sash(f, a + 8, 10, bw - 16, 20, { wall, seed: s.seed + 77, trim }); bars(f, a + 8, 10, bw - 16, 20); } }
    if (fire) { const lv = []; for (let fl = 1; fl < st; fl++) lv.push(42 + (fl - 1) * 34 - 1); fireEscape(f, L - 64, L - 8, lv); }
    if (main && s.blade && st >= 3) blade(f, fire ? 6 : L - 6, 30, s.blade, s.bladeBg ?? C.red, C.chalk, { lit: true });
    if (L > 60) downpipe(f, fire ? 3 : L - 5, Hv); panel(f, fire ? L - 70 : L - 12, Hv - 12);
  }
  for (const side of sides) if (!s.faces.includes(side)) { const f = b.F(side), L = f.len;   // back walls: fewer, smaller windows
    for (let fl = 1; fl < st; fl++) for (let a = 10; a + 16 < L - 8; a += 38) sash(f, a, 42 + (fl - 1) * 34 + 9, 14, 18, { wall, seed: s.seed + 5, trim }); }
  return out;
}

// ═════════ SHED · corrugated steel, a gable roof along the long axis, a clerestory band, the name on the long side
export function shed(ctx, s) {
  const [x0, z0, x1, z1] = [s.x0, s.z0, s.x1, s.z1], alongX = (x1 - x0) >= (z1 - z0), Hw = s.hw ?? 62, span = Math.round((alongX ? z1 - z0 : x1 - x0) / CV), rise = Math.round(span / 2 / 3) + 1;
  const { V, B, F } = shell(ctx, [x0, z0, x1, z1], Hw + rise + 3, s.faces), wall = s.wall, rib = shade(wall, .86), roof = s.roofCol ?? 0xb9bec6, roofE = shade(roof, .82);
  // walls with ribs: every third column one voxel proud on the four sides
  V.box(B.x0, 0, B.z0, B.x1, Hw, B.z1, wall); V.box(B.x0 + 1, Hw - 1, B.z0 + 1, B.x1 - 1, Hw, B.z1 - 1, roof); hollow(V, B, Hw);
  for (const side of sides) { const f = F(side); f.box(0, 0, 0, f.len, 3, 1, shade(wall, .7)); for (let a = 1; a < f.len - 1; a += 3) f.box(a, 3, 1, a + 1, Hw - 2, 2, rib); f.box(-1, Hw - 2, 0, f.len + 1, Hw, 2, shade(wall, .75)); }
  // gable roof: slopes on the long sides, gable triangles in the wall colour on the ends, a ridge cap and a 0.2 overhang
  const n = alongX ? B.z1 - B.z0 : B.x1 - B.x0;
  for (let k = 0; k <= rise; k++) { const lo = k * 3 - 2, hi = n - k * 3 + 2; if (hi - lo < 2) break;
    const y = Hw + k; if (alongX) { V.box(B.x0 - 2, y, B.z0 + Math.max(-2, lo), B.x1 + 2, y + 1, B.z0 + Math.min(n + 2, hi), (x, yy, z) => (z === B.z0 + Math.max(-2, lo) || z === B.z0 + Math.min(n + 2, hi) - 1) ? roofE : ((x - B.x0) % 6 === 0 ? roofE : roof));
      V.box(B.x0, y, B.z0 + Math.max(0, lo + 3), B.x0 + 1, y + 1, B.z0 + Math.min(n, hi - 3), wall); V.box(B.x1 - 1, y, B.z0 + Math.max(0, lo + 3), B.x1, y + 1, B.z0 + Math.min(n, hi - 3), wall); }
    else { V.box(B.x0 + Math.max(-2, lo), y, B.z0 - 2, B.x0 + Math.min(n + 2, hi), y + 1, B.z1 + 2, (x, yy, z) => (x === B.x0 + Math.max(-2, lo) || x === B.x0 + Math.min(n + 2, hi) - 1) ? roofE : ((z - B.z0) % 6 === 0 ? roofE : roof));
      V.box(B.x0 + Math.max(0, lo + 3), y, B.z0, B.x0 + Math.min(n, hi - 3), y + 1, B.z0 + 1, wall); V.box(B.x0 + Math.max(0, lo + 3), y, B.z1 - 1, B.x0 + Math.min(n, hi - 3), y + 1, B.z1, wall); } }
  const out = { top: SIDE + Hw * CV, H: Hw, doors: [], pitched: true };
  const longSides = alongX ? ['-z', '+z'] : ['-x', '+x'], endSides = alongX ? ['-x', '+x'] : ['-z', '+z'];
  for (const side of sides) { const f = F(side), L = f.len, isLong = longSides.includes(side), face = s.faces.includes(side) || side === s.dock;
    if (isLong) { const glow = TOD.night && hash(s.seed, 41) < .6; f.box(4, Hw - 13, 0, L - 4, Hw - 6, 1, glow ? 0xffe0a0 : 0xdfe8d8, glow ? 3 : 0); for (let a = 4; a < L - 4; a += 12) f.box(a, Hw - 13, 0, a + 1, Hw - 6, 1, C.steelD); }   // clerestory: translucent panels (the night shift lights them)
    if (!face) continue;
    if (isLong && side === s.main) { const fit = fitName(s.name, s.font, L - 20, Math.min(22, Hw - 44)); if (fit) { const w = nameW(fit), h = nameH(fit), y = Hw - 16; f.box((L >> 1) - (w >> 1) - 4, y - h - 3, 1, (L >> 1) + (w >> 1) + 4, y + 3, 2, s.panel ?? shade(wall, .8)); paintName(f, fit, L >> 1, y, s.paint ?? inkOn(s.panel ?? shade(wall, .8)), { d0: 2 }); } }
    if (!isLong || side === s.dock) { const dw = Math.min(46, L - 36), a0 = (L - dw) >> 1; if (side === s.dock) dockPlatform(f, a0 - 8, a0 + dw + 8, [a0 + (dw >> 1)], {});
      const c = rollup(f, a0, dw, side === s.dock ? 34 : 44, s.door, side === s.dock ? 12 : 0, { num: s.gradeNums?.shift(), open: hash(a0, s.seed) > .55 ? .5 : 0, boxes: true }); if (side !== s.dock) doorAt(f, c, side); out.doors.push({ side, a: c, grade: side !== s.dock, world: fw(f, c, 0) });
      { const ly = (side === s.dock ? 12 + 34 : 44) + 7; if (ly + 5 < Hw) for (const e of [-1, 1]) goose(f, c + e * ((dw >> 1) - 1), ly); }
      if (a0 > 20) { manDoor(f, 6, s.door2 ?? C.ink, side, { plate: side === s.main || !longSides.includes(s.main) ? s.plate : null, ctx }); meter(f, 22); }
      if (!isLong && s.name && side === s.main) { const fit = fitName(s.name, s.font, L - 12, Math.max(8, rise - 4)); if (fit) paintName(f, fit, L >> 1, Hw + rise - 3, s.paint ?? inkOn(wall)); } }
    else if (s.faces.includes(side)) { manDoor(f, 10, s.door2 ?? C.ink, side, { plate: s.plate }); for (let a = 30; a + 18 < L - 10; a += 40) sash(f, a, 12, 18, 16, { seed: s.seed, trim: C.concL }); } }
  return out;
}

// ═════════ SAWTOOTH · a factory whose roof is a row of north-lit teeth; the end walls step with them
export function sawtooth(ctx, s) {
  const Hw = s.hw ?? 58, teeth = s.teeth ?? 4, wall = s.wall, trim = s.trim, [x0, z0, x1, z1] = [s.x0, s.z0, s.x1, s.z1];
  const { V, B, F } = shell(ctx, [x0, z0, x1, z1], Hw + 26, s.faces, Hw), nz = B.z1 - B.z0, per = Math.floor(nz / teeth), roof = s.roofCol ?? 0xd2d3d6, glassC = TOD.night ? 0xffd98a : 0xbfe0ff;
  V.box(B.x0, 0, B.z0, B.x1, Hw, B.z1, wall); V.box(B.x0 + 1, Hw - 1, B.z0 + 1, B.x1 - 1, Hw, B.z1 - 1, roof); hollow(V, B, Hw);
  // teeth run along x: each has a vertical glass face toward −z (north) 1.6 m tall, then slopes down to the south
  for (let t = 0; t < teeth; t++) { const za = B.z0 + t * per, zb = t === teeth - 1 ? B.z1 : za + per;
    for (let z = za; z < zb; z++) { const hgt = Math.round(22 * (1 - (z - za) / (zb - za))); if (hgt <= 0) continue;
      V.box(B.x0, Hw, z, B.x1, Hw + hgt, z + 1, (x, y) => (x === B.x0 || x === B.x1 - 1) ? wall : (y === Hw + hgt - 1 ? roof : shade(roof, .96))); }
    V.box(B.x0 + 1, Hw, za, B.x1 - 1, Hw + 20, za + 1, (x, y) => (x - B.x0) % 8 === 0 || y === Hw + 10 ? C.steelD : glassC, TOD.night ? 3 : 1);
    V.box(B.x0 - 1, Hw + 21, za, B.x1 + 1, Hw + 23, za + 2, C.steelD); }
  const out = { top: SIDE + Hw * CV, H: Hw, doors: [], pitched: true };
  for (const side of s.faces) { const f = F(side), L = f.len, main = side === s.main;
    f.box(0, 0, 0, L, 3, 1, shade(wall, .75)); f.box(-1, Hw - 4, 0, L + 1, Hw - 1, 2, trim);
    for (let a = 10; a + 30 < L - 10; a += 40) sash(f, a, 18, 30, 26, { seed: s.seed, trim, litShare: .4 });
    if (main) { const fit = fitName(s.name, s.font, L - 24, 13); if (fit) { const w = nameW(fit), h = nameH(fit); f.box((L >> 1) - (w >> 1) - 5, Hw - 6 - h - 5, 0, (L >> 1) + (w >> 1) + 5, Hw - 6, 1, s.panel ?? C.chalk); paintName(f, fit, L >> 1, Hw - 9, inkOn(s.panel ?? C.chalk)); } }
    const c = rollup(f, 12, 34, 40, s.door, 0, { num: s.gradeNums?.shift() }); doorAt(f, c, side); out.doors.push({ side, a: c, grade: true, world: fw(f, c, 0) });
    manDoor(f, L - 26, s.door2 ?? C.ink, side, { plate: main ? s.plate : null }); }
  return out;
}

// ═════════ COLD · cold storage: insulated panels, few windows, a giant painted name, dock seals on the dock side
export function cold(ctx, s) {
  const Hv = s.hv ?? 130, wall = s.wall, joint = shade(wall, .92);
  const b = ctx.building(s.x0, s.z0, s.x1, s.z1, { h: Hv * CV, wall, trim: s.trim, faces: s.faces, cornice: false, parapet: 4, roof: s.roofCol, extra: 40 });
  const out = { top: b.top, H: Hv, doors: [], V: b.V, B: b.B }; hollow(b.V, b.B, Hv);
  for (const side of sides) { const f = b.F(side), L = f.len; for (let y = 12; y < Hv - 2; y += 14) f.box(0, y, 0, L, y + 1, 1, joint); }
  for (const side of s.faces) { const f = b.F(side), L = f.len, main = side === s.main;
    f.box(-1, Hv + 2, 0, L + 1, Hv + 5, 2, s.trim);
    if (main) { const fit = fitName(s.name, s.font, L - 16, Math.min(40, Hv - 60)); if (fit) paintName(f, fit, L >> 1, Hv - 10, s.paint ?? inkOn(wall)); }
    else if (s.sub) { const fit = fitName(s.sub, 'px', L - 16, 14); if (fit) paintName(f, fit, L >> 1, Hv - 12, s.paint ?? inkOn(wall)); }
    if (side === s.dock) { const doors = []; for (let a = 24; a + 24 < L - 16; a += 40) doors.push(a); dockPlatform(f, 4, L - 14, doors, {});
      for (const a of doors) { f.box(a - 18, 12, 0, a + 18, 50, 3, C.ink); rollup(f, a - 13, 26, 32, s.door, 12, { num: s.dockNums?.shift() }); out.doors.push({ side, a, world: fw(f, a, 0) }); }   // black dock seals
      continue; }
    // the office corner: a band of windows and the door at the left end
    for (let a = 6; a + 14 < Math.min(L - 30, 70); a += 18) sash(f, a, 40, 14, 16, { seed: s.seed, trim: C.concL, litShare: .35 });
    manDoor(f, 8, s.door2 ?? C.ink, side, { plate: main ? s.plate : null, ctx }); meter(f, 24); if (main && s.sub) namePlate(ctx, f, 28, 2.2, s.sub, side, C.ink, C.chalk);
    if (L > 90) { const c = rollup(f, L - 50, 32, 36, s.door, 0, { num: s.gradeNums?.shift() }); doorAt(f, c, side); goose(f, c, 50); out.doors.push({ side, a: c, grade: true, world: fw(f, c, 0) }); } }
  return out;
}

// ═════════ GARAGE · auto shop: bays at grade under a backlit fascia with the name, a customer door, a flat roof
export function garage(ctx, s) {
  const st = s.st ?? 1, Hv = st === 1 ? 52 : 82, wall = s.wall;
  const b = ctx.building(s.x0, s.z0, s.x1, s.z1, { h: Hv * CV, wall, trim: s.trim, faces: s.faces, cornice: false, parapet: 5, roof: s.roofCol, extra: 40 });
  const out = { top: b.top, H: Hv, doors: [], V: b.V, B: b.B }; hollow(b.V, b.B, Hv);
  for (const side of s.faces) { const f = b.F(side), L = f.len, main = side === s.main;
    f.box(-1, Hv + 3, 0, L + 1, Hv + 5, 2, s.trim);
    if (main) { const bays = Math.max(1, Math.min(s.bays ?? 3, Math.floor((L - 24) / 38))), span = bays * 38, a0 = Math.max(4, L - span - 20);
      for (let k = 0; k < bays; k++) { const c = rollup(f, a0 + k * 38, 32, 36, k === 1 && s.door3 ? s.door3 : s.door, 0, { open: (k + s.seed) % 3 === 0 ? .7 : 0 }); doorAt(f, c, side); out.doors.push({ side, a: c, grade: true, world: fw(f, c, 0) }); }
      manDoor(f, Math.max(3, a0 - 18), s.door2 ?? C.ink, side, {}); meter(f, Math.max(3, a0 - 18) + 15); for (let k = 0; k <= bays; k++) goose(f, a0 - 3 + k * 38, 38);
      // the fascia: a box sign across the bays, lit at night
      const fit = fitName(s.name, s.font ?? 'px', L - 12, 12), fc = s.sign ?? C.yellow; f.box(2, 42, 0, L - 2, 50, 4, fc, TOD.night ? 3 : 0); f.box(2, 41, 0, L - 2, 42, 4, C.ink); if (fit) paintName(f, fit, L >> 1, 48, inkOn(fc), { d0: 4 });
      if (st > 1) for (let a = 8; a + 20 < L - 8; a += 30) sash(f, a, 58, 20, 16, { seed: s.seed, trim: C.concL }); }
    else { if (s.sub) { const fit = fitName(s.sub, 'hand', L - 14, 10); if (fit) { const w = nameW(fit), h = nameH(fit); f.box((L >> 1) - (w >> 1) - 4, 34 - h, 0, (L >> 1) + (w >> 1) + 4, 38, 1, C.chalk); paintName(f, fit, L >> 1, 35, C.red); } }
      for (let a = 8; a + 16 < L - 8; a += 34) sash(f, a, 12, 16, 16, { seed: s.seed, trim: C.concL }); } }
  return out;
}

// ═════════ QUONSET · a half-barrel hut (corrugated), end walls with the door and a painted name
export function quonset(ctx, s) {
  const [x0, z0, x1, z1] = [s.x0, s.z0, s.x1, s.z1], alongX = (x1 - x0) >= (z1 - z0), R = Math.round((alongX ? z1 - z0 : x1 - x0) / 2 / CV);
  const { V, B, F } = shell(ctx, [x0, z0, x1, z1], R + 2, s.faces), wall = s.wall, rib = shade(wall, .85);
  const n = alongX ? B.x1 - B.x0 : B.z1 - B.z0;
  for (let u = 0; u < n; u++) for (let v = 0; v < 2 * R; v++) { const dv = v + .5 - R, hgt = Math.round(Math.sqrt(Math.max(0, R * R - dv * dv))); if (hgt <= 0) continue;
    const x = alongX ? B.x0 + u : B.x0 + v, z = alongX ? B.z0 + v : B.z0 + u, c = u % 4 === 0 ? rib : wall, inner = Math.round(Math.sqrt(Math.max(0, (R - 5) * (R - 5) - dv * dv)));
    V.box(x, 0, z, x + 1, hgt, z + 1, c); if (u >= 5 && u < n - 5 && inner > 3) V.clear(x, 3, z, x + 1, inner, z + 1); }
  const out = { top: SIDE + R * CV, H: R, doors: [], pitched: true };
  for (const side of (alongX ? ['-x', '+x'] : ['-z', '+z'])) { if (!s.faces.includes(side) && side !== s.main) continue; const f = F(side), L = f.len, mid = L >> 1;
    for (let a = 0; a < L; a++) { const dv = a + .5 - R, hgt = Math.round(Math.sqrt(Math.max(0, R * R - dv * dv))); if (hgt > 0) f.box(a, 0, 0, a + 1, hgt, 1, shade(wall, 1.08)); }
    const c = rollup(f, mid - 18, 36, Math.min(40, R - 6), s.door, 0, {}); doorAt(f, c, side); out.doors.push({ side, a: c, grade: true, world: fw(f, c, 0) });
    if (side === s.main && s.name) { const fit = fitName(s.name, s.font ?? 'stencil', Math.round(R * 1.2), Math.max(7, R - 50)); if (fit) paintName(f, fit, mid, R - 8, inkOn(shade(wall, 1.08))); } }
  return out;
}

// what a shop window shows (window-local a, y from its sill): shelves of stock, rope coils and life rings, beer neons, a menu; warm light
function showcase(kind, a, y, w, seed) {
  const bg = TOD.night ? 0xffd9a0 : 0x3b3f4a, shelf = TOD.night ? 0xc98a4b : 0x5a5650;
  if (y > 17) return TOD.night ? 0xffe3a0 : 0x4a4e5a;
  if (kind === 'marine') { const ring = (cx, cy, r) => { const d = Math.hypot(a - cx, y - cy); return d < r && d > r - 2; };
    if (ring(w * .3, 9, 5)) return 0xff7a1a; if (ring(w * .3, 9, 3)) return C.chalk; if (ring(w * .72, 7, 4.2)) return 0xc98a4b; if (Math.hypot(a - w * .72, y - 14) < 2.2) return C.red; return bg; }
  if (kind === 'bar') { if (y >= 9 && y <= 13 && a > 2 && a < w - 2) return [0xff4fa3, 0x2de2e6, 0xffe23a][((a / 6) | 0) % 3]; if (y === 8 || y === 14) return C.ink; return TOD.night ? 0x5a2a3a : 0x2a2d38; }
  if (kind === 'menu') { if (a > 2 && a < w - 2 && y > 3 && y < 16) return (y % 3 === 0 && a > 4 && a < w - 4 && hash(a >> 1, y, seed) > .3) ? C.ink : C.chalk; return bg; }
  if (y % 5 === 0) return shelf; return hash(a >> 1, (y / 5) | 0, seed) > .45 ? [0xe8232a, 0xffc21a, 0x2f5bff, 0x25b84c, 0xf4f1ea][(hash(a >> 1, y, seed + 1) * 5) | 0] : bg;
}
// ═════════ FRONT · a small two-storey front on the street: the lunch counter, the bodega, the union hall; a shop sign over the window
export function front(ctx, s) {
  const st = s.st ?? 2, Hv = 40 + (st - 1) * 32, wall = s.wall;
  const b = ctx.building(s.x0, s.z0, s.x1, s.z1, { h: Hv * CV, wall, trim: s.trim, faces: s.faces, cornice: false, parapet: 5, roof: s.roofCol, extra: 40 });
  const out = { top: b.top, H: Hv, doors: [], V: b.V, B: b.B }; hollow(b.V, b.B, Hv);
  for (const side of s.faces) { const f = b.F(side), L = f.len, main = side === s.main;
    f.box(-1, Hv - 4, 0, L + 1, Hv - 1, 2, s.trim); f.box(-1, Hv + 3, 0, L + 1, Hv + 5, 2, s.trim);
    for (let fl = 1; fl < st; fl++) for (let a = 6; a + 13 < L - 6; a += 24) { const y0 = 40 + (fl - 1) * 32 + 8; f.box(a - 1, y0 - 1, 0, a + 14, y0 + 18, 1, s.trim); f.box(a, y0, -2, a + 13, y0 + 17, 1, AIR);
      const on = TOD.night && hash(a, fl, s.seed) > .45; f.box(a, y0, -3, a + 13, y0 + 17, -2, on ? C.lit : (fl + a) % 3 ? PAL.glassLo : PAL.glassHi, on ? 3 : 1); f.box(a - 2, y0 - 2, 0, a + 15, y0 - 1, 2, s.trim); }
    if (!main) continue;
    // shop: a window, the door, a fascia sign; night: the window glows
    f.box(0, 0, 0, L, 36, 1, s.band ?? C.ink); const door = L - 20; f.box(door, 1, -3, door + 14, 28, 2, AIR); f.box(door, 1, -3, door + 14, 28, -2, (a, y) => y > 22 ? 0xffe3a0 : 0x2a2d38, 1); doorAt(f, door + 7, side);
    for (let a = 4; a + 14 < door - 4; a += 26) { const w = Math.min(22, door - 4 - a); f.box(a, 6, -3, a + w, 26, 2, AIR); f.box(a, 6, -3, a + w, 26, -2, (aa, y) => showcase(s.display, aa - a, y - 6, w, s.seed), TOD.night ? 3 : 1); }
    fitWindow(f, { a0: 2, a1: door - 1, door, wa0: 4, wa1: door - 4, y0: 6, y1: 26, dg: -3, kind: s.display, seed: s.seed });   // fit-out pass: a stocked room behind the glass
    const sc2 = s.sign ?? C.red, fit = fitName(s.name, s.font ?? 'px', L - 8, 8); f.box(0, 28, 0, L, 36, 3, sc2, s.neon ? lit() : 0); if (fit) paintName(f, fit, L >> 1, 35, inkOn(sc2), { d0: 3, l: s.neon ? lit() : 0 });
    if (s.awning) f.box(-1, 26, 3, L + 1, 28, 12, (a) => ((a >> 2) & 1) ? s.awning : C.chalk);
    if (s.blade && st >= 2) blade(f, L - 5, 40, s.blade, s.sign ?? C.red, inkOn(s.sign ?? C.red), { lit: true }); }
  return out;
}
