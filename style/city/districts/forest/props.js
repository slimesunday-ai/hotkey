// BLACKPINE WOODS · the crafted props (owner: the Blackpine Woods agent). Worker-safe. Authored once in city voxels (origin at the base
// centre, facing +z), memoised per key and time of day (lit parts glow at night), stamped by the kit's builders with ctx.put.
import { Vol, meshed, textMask } from '../../vox.js';
import { PAL, CV, hash, shade } from '../../style.js';
import { TOD } from '../../kit.js';
import { REG } from '../../audit.js';

const memo = new Map();
export const M = (key, kind, f) => { const k = key + '|' + (TOD.night ? 1 : 0); let b = memo.get(k); if (!b) { b = f(); b.kind = kind; memo.set(k, b); } return b; };
export const pv = (nx, ny, nz, cx = nx / 2, cz = nz / 2, s = CV) => new Vol(Math.max(1, Math.round(nx)), Math.max(1, Math.round(ny)), Math.max(1, Math.round(nz)), { s, org: [-cx * s, 0, -cz * s], ground: true });
export const done = (V, kind) => Object.assign(meshed(V), { kind });
export const lit = (day = 1) => TOD.night ? 3 : day;
const TM = new Map(); export const tm = s => { let m = TM.get(s); if (!m) TM.set(s, m = textMask(s)); return m; };
export const tw = s => tm(s).w;
// lettering on the +z face (dir 1) of a board one voxel behind it; every voxel recorded for the audit (board behind, viewer in front)
export function txt(V, s, x0, ytop, z, c, l = 0, dir = 1, sc = 1) { const t = tm(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const x = dir > 0 ? x0 + i * sc + a : x0 + (t.w - 1 - i) * sc + (sc - 1 - a), y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, 0, dir); }
  return t.w * sc; }
// lettering on a ±x face (dir 1: reads on the +x face, its board at x − 1)
export function txtX(V, s, z0, ytop, x, c, l = 0, dir = 1, sc = 1) { const t = tm(s); V.recNext();
  for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
    const z = dir > 0 ? z0 + (t.w - 1 - i) * sc + (sc - 1 - a) : z0 + i * sc + a, y = ytop - j * sc - b; V.set(x, y, z, c, l); V.recN(s, x, y, z, dir, 0); }
  return t.w * sc; }
export function cyl(V, cx, cz, r, y0, y1, c, l = 0) { for (let y = y0; y < y1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
// a cylinder lying along x (or z): axis at (cy, cz) in the cross-section
export function cylX(V, x0, x1, cy, cz, r, c, l = 0) { for (let x = x0; x < x1; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++) if (Math.hypot(y + .5 - cy, z + .5 - cz) <= r) V.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
export function line(V, x0, y0, z0, x1, y1, z1, c, l = 0, t = 1) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)))); for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n), z = Math.round(z0 + (z1 - z0) * k / n); V.box(x, y, z, x + t, y + t, z + t, c, l); } }
// a sagging rope or chain between two points (each step touching the last)
export function sag(V, x0, y0, z0, x1, y1, z1, s, c, l = 0) { const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0))); let px = null, py, pz;
  for (let k = 0; k <= n; k++) { const t = k / n, x = Math.round(x0 + (x1 - x0) * t), z = Math.round(z0 + (z1 - z0) * t), y = Math.round(y0 + (y1 - y0) * t - s * 4 * t * (1 - t));
    if (px !== null && Math.abs(y - py) > 1) { const lo = Math.min(y, py), hi = Math.max(y, py); for (let yy = lo; yy <= hi; yy++) V.set(px, yy, pz, c, l); } V.set(x, y, z, c, l); px = x; py = y; pz = z; } }

export const K = { ink: PAL.ink, white: 0xf4f1ea, chalk: 0xf7f7f2, wood: 0x9a6a3c, woodD: 0x6b4526, woodL: 0xc4935a, log: 0x7a4a26, logEnd: 0xd9b27a, steel: 0x8a9099, steelL: 0xb9bec6, steelD: 0x4b4f58,
  galv: 0xb9bcc4, rust: 0xa4502a, rustD: 0x7a3a1e, tarp: 0x2f6fe0, tarpL: 0x5a92f0, camo: [0x4f6b33, 0x6b5a33, 0x2f4a2a, 0x8a7a4a], red: 0xe8232a, yellow: 0xffc21a, hazard: 0xffd21f,
  green: 0x25b84c, blue: 0x2f5bff, orange: 0xff7a1a, stone: [0x9a968e, 0x857f77, 0xb3aea4], char: 0x2a2624, ember: 0xff6a1a, burlap: 0xc8a46a, burlapD: 0xa88550, leaf: [0x4ec43f, 0x3aa83a, 0x6fdc4a, 0x2f8f35] };

// ── A HAND-PAINTED BOARD (0.05 grain): plywood or tin with painted letters on stakes, a post, or for a wall (posts 0).
//   lines: 'NO/HUNTING' ('/' breaks a line) · o: { bg, fg, posts, h (post height to the board's foot, m), tilt, drip, frame, arrow, tin, sc, kind }
export function board(lines, o = {}) {
  return M('board:' + lines + JSON.stringify(o), o.kind || 'sign', () => {
    const s = .05, rows = lines.split('/'), sc = o.sc ?? 1, pad = o.pad ?? 3, gap = 2 * sc;
    const w = Math.max(...rows.map(r => tw(r) * sc)) + 2 * pad + (o.arrow ? 8 : 0), h = rows.length * 7 * sc + (rows.length - 1) * gap + 2 * pad;
    const post = o.posts ?? 2, ph = Math.round((o.h ?? .5) / s), tilt = o.tilt ? Math.ceil(w / 14) : 0, th = post ? ph + h + tilt + 1 : h + tilt + 1, D = 4;
    const V = new Vol(w + 2, th + 1, D, { s, org: [-(w + 2) * s / 2, 0, -D * s / 2], ground: true }), bg = o.bg ?? 0xe9dcc0, fg = o.fg ?? PAL.ink, y0 = post ? ph : 0;
    const off = x => o.tilt ? Math.round((o.tilt > 0 ? x : w - x) / 14) : 0;
    if (post === 1) V.box((w >> 1), 0, 0, (w >> 1) + 2, y0 + h - 2, 2, o.postC ?? K.woodD);
    if (post === 2) for (const x of [2, w - 2]) V.box(x, 0, 0, x + 2, y0 + off(x) + h - 2, 2, o.postC ?? K.woodD);
    for (let x = 1; x < w + 1; x++) { const yb = y0 + off(x); let top = yb + h, bot = yb;
      if (o.arrow === 'R' && x > w - 8) { const k = x - (w - 8); bot += k; top -= k; } if (o.arrow === 'L' && x < 9) { const k = 9 - x; bot += k; top -= k; }
      if (!o.clean && hash(x, 7, lines.length) > .86) top -= 1; if (!o.clean && hash(x, 9, lines.length) > .9) bot += 1;
      if (top > bot) V.box(x, bot, 2, x + 1, top, 3, (xx, y) => o.tin ? (x % 3 === 0 ? shade(bg, .86) : bg) : (o.edge && (y === bot || y === top - 1 || x === 1 || x === w) ? o.edge : bg)); }
    if (o.frame) for (let x = 3; x < w - 1; x++) { const yb = y0 + off(x); V.set(x, yb + 1, 3, o.frame); V.set(x, yb + h - 2, 3, o.frame); }
    rows.forEach((r, k) => { const rw = tw(r) * sc, xs = 1 + (o.arrow === 'L' ? 8 : 0) + pad + (((w - 2 * pad - (o.arrow ? 8 : 0)) - rw) >> 1), top = y0 + h - pad - k * (7 * sc + gap) - 1, t = tm(r); V.recNext();
      for (let j = 0; j < 7; j++) for (let i = 0; i < t.w; i++) if (t.at(i, j)) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const x = xs + i * sc + a, y = top - j * sc - b + off(x); V.set(x, y, 3, fg); V.recN(r, x, y, 3, 0, 1); }
      if (o.drip) for (let i = 0; i < t.w; i += 3) if (t.at(i, 6) && hash(i, k, 31) > .5) { const x = xs + i * sc, y = top - 7 * sc + off(x); if (y > y0 + off(x) + 1) V.set(x, y, 3, fg); } });
    return done(V, o.kind || 'sign'); });
}

// ── THE PARK SIGN at the main trailhead: BLACKPINE / WOODS routed into a brown board, two log posts, a little shingled roof, a pine
export const parkSign = () => M('parksign', 'park-sign', () => {
  const s = .05, W = 80, V = new Vol(W + 8, 58, 10, { s, org: [-(W + 8) * s / 2, 0, -5 * s], ground: true }), B = 0x5a3a22, L = 0xf2d27a, R = 0x2f5a3a;
  for (const x of [3, W + 1]) cyl(V, x + 2, 4, 2.6, 0, 50, K.log);                                      // the log posts
  V.box(2, 22, 2, W + 6, 46, 6, B); V.box(2, 22, 6, W + 6, 23, 7, 0x4a2e1a); V.box(2, 45, 6, W + 6, 46, 7, 0x4a2e1a);   // the board, its routed edge
  for (let k = 0; k < 6; k++) V.box(1 + k, 47 + k, 0, W + 7 - k, 48 + k, 9, k % 2 ? R : shade(R, .82));   // the roof, stepping in (shingles)
  // a pine on the left of the board: three tiers of green, raised
  for (let k = 0; k < 3; k++) { const r = 5 - k * 1.5, y = 26 + k * 5; for (let x = Math.round(12 - r); x <= Math.round(12 + r); x++) V.box(x, y, 6, x + 1, y + 5 - k, 7, 0x1f7a45); } V.box(11, 24, 6, 13, 26, 7, 0x6b4226);
  txt(V, 'BLACKPINE', 22, 43, 6, L, 0, 1, 1); txt(V, 'WOODS', 22 + ((tw('BLACKPINE') - tw('WOODS')) >> 1), 33, 6, L, 0, 1, 1);
  return done(V, 'park-sign'); });
// ── THE TRAIL MAP: a kiosk panel with a painted map (the woods, the lake, the trails in red, YOU ARE HERE), two posts, a roof
export const mapBoard = () => M('mapboard', 'map-board', () => {
  const s = .05, W = 30, V = new Vol(W + 6, 50, 8, { s, org: [-(W + 6) * s / 2, 0, -4 * s], ground: true });
  for (const x of [2, W + 2]) V.box(x, 0, 3, x + 2, 44, 5, K.woodD);
  V.box(1, 18, 2, W + 5, 42, 5, K.wood); V.box(3, 20, 5, W + 3, 40, 6, 0x2f6a3a);                         // frame, map ground
  for (let x = 5; x < W + 1; x++) for (let y = 22; y < 38; y++) { const dx = (x - 11) / 5.5, dy = (y - 32) / 4.2; if (dx * dx + dy * dy < 1) V.set(x, y, 6, 0x3f86d8); }   // the lake
  for (let x = 6; x < W + 1; x += 2) V.set(x, 26 + Math.round(Math.sin(x * .45) * 2), 6, 0xe8232a); for (let y = 24; y < 38; y += 2) V.set(24, y, 6, 0xe8232a);   // trails
  V.box(23, 29, 6, 26, 32, 7, 0xffe23a); V.box(1, 42, 1, W + 5, 44, 7, 0x3b2a1a); V.box(2, 44, 2, W + 4, 46, 6, 0x3b2a1a);   // you are here, the roof
  txt(V, 'TRAILS', 3 + ((W - tw('TRAILS')) >> 1), 17, 6, K.chalk); V.box(2, 10, 5, W + 4, 18, 6, 0x3b2a1a);   // the name plate under the map
  return done(V, 'map-board'); });
// ── FIRE DANGER TODAY: the ranger's dial board (LOW · MOD · HIGH · EXTREME), the arrow on HIGH
export const fireDanger = () => M('firedanger', 'fire-board', () => {
  const s = .05, W = 44, V = new Vol(W + 4, 56, 8, { s, org: [-(W + 4) * s / 2, 0, -4 * s], ground: true }), cx = (W + 4) / 2, cy = 26, SEC = [0x25b84c, 0x2f5bff, 0xffc21a, 0xff7a1a, 0xe8232a];
  for (const x of [4, W - 2]) V.box(x, 0, 2, x + 2, 50, 4, K.woodD);
  V.box(1, 16, 4, W + 3, 52, 5, K.chalk); V.box(1, 16, 5, W + 3, 17, 6, 0x6b4526); V.box(1, 51, 5, W + 3, 52, 6, 0x6b4526);
  for (let x = 4; x < W; x++) for (let y = cy; y < cy + 17; y++) { const dx = x + .5 - cx, dy = y + .5 - cy, r = Math.hypot(dx, dy); if (r > 16.5 || r < 5) continue; const a = Math.atan2(dy, dx); V.set(x, y, 5, SEC[Math.min(4, Math.floor((Math.PI - a) / Math.PI * 5))]); }
  line(V, Math.round(cx), cy, 6, Math.round(cx + 4), cy + 12, 6, K.ink);                                   // the arrow, on HIGH
  txt(V, 'FIRE DANGER', 2 + ((W - tw('FIRE DANGER')) >> 1), 50, 5, 0xe8232a); txt(V, 'TODAY', 2 + ((W - tw('TODAY')) >> 1), 24, 5, K.ink);
  return done(V, 'fire-board'); });

// ── the cook's kit
export const drum = (c = 0x2f5bff, v = 0) => M('drum' + c + v, 'drum', () => { const V = pv(8, 10, 8);
  cyl(V, 4, 4, 3.6, 0, 9, (x, y) => y === 2 || y === 6 ? shade(c, .78) : c, c === K.steelL ? 2 : 0); V.box(3, 9, 2, 5, 10, 3, K.steelD);
  if (v % 2) { V.box(2, 4, 7, 5, 7, 8, K.chalk); V.set(3, 5, 8, 0xe8232a); } else { V.box(3, 3, 7, 5, 6, 8, K.hazard); }
  return done(V, 'drum'); });
export const generator = () => M('gen', 'generator', () => { const V = pv(10, 8, 7), Y = 0x3b3f4a;
  for (const [x, z] of [[0, 0], [9, 0], [0, 6], [9, 6]]) V.box(x, 0, z, x + 1, 7, z + 1, Y); for (const y of [0, 6]) { V.box(0, y, 0, 10, y + 1, 1, Y); V.box(0, y, 6, 10, y + 1, 7, Y); }
  V.box(1, 1, 1, 7, 5, 6, 0x8a2a22); V.box(2, 5, 2, 6, 6, 5, 0xb8322a); V.box(3, 6, 3, 4, 7, 4, 0x2a2d38); V.box(7, 2, 2, 9, 4, 5, 0x6d707a, 2); V.box(1, 3, 6, 3, 5, 7, 0xd8dbe2);
  return done(V, 'generator'); });
export const jerrycan = (c = 0xe8232a) => M('jerry' + c, 'jerrycan', () => { const V = pv(5, 6, 3); V.box(0, 0, 0, 5, 5, 3, c); V.box(1, 5, 1, 3, 6, 2, shade(c, .8)); V.box(3, 5, 1, 4, 6, 2, K.steelD); return done(V, 'jerrycan'); });
export const propane = () => M('propane', 'propane', () => { const V = pv(5, 13, 5); cyl(V, 2.5, 2.5, 2.3, 0, 11, K.chalk); cyl(V, 2.5, 2.5, 1.2, 11, 13, 0xc9ced6, 2); return done(V, 'propane'); });
export const campChair = (c = 0x2f7a3a) => M('cchair' + c, 'chair', () => { const V = pv(7, 10, 7);
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) V.box(x, 0, z, x + 1, 5, z + 1, K.steelD); V.box(0, 4, 0, 7, 5, 7, c); V.box(0, 5, 0, 7, 10, 1, c); for (const x of [0, 6]) V.box(x, 5, 1, x + 1, 6, 6, shade(c, .8));
  V.set(6, 6, 5, 0xe8232a); return done(V, 'chair'); });
export const cooler = (c = 0x2f5bff) => M('cooler' + c, 'cooler', () => { const V = pv(7, 5, 4); V.box(0, 0, 0, 7, 4, 4, c); V.box(0, 4, 0, 7, 5, 4, K.chalk); V.box(2, 3, 4, 5, 4, 5, K.chalk); return done(V, 'cooler'); });
export const bucket = (c = 0xff7a1a) => M('bucket' + c, 'bucket', () => { const V = pv(4, 4, 4); cyl(V, 2, 2, 1.8, 0, 4, (x, y, z) => y > 0 && Math.hypot(x + .5 - 2, z + .5 - 2) < 1 ? undefined : c); return done(V, 'bucket'); });
// the IBC tote: a white tank in a steel cage on a pallet (water for the cook)
export const ibc = () => M('ibc', 'tote', () => { const V = pv(11, 12, 10); V.box(0, 0, 0, 11, 1, 10, K.wood); V.box(1, 1, 1, 10, 11, 9, 0xe9e7df);
  for (let x = 0; x < 11; x += 3) { V.box(x, 1, 0, x + 1, 12, 1, K.galv, 2); V.box(x, 1, 9, x + 1, 12, 10, K.galv, 2); } for (let y = 1; y < 12; y += 3) { V.box(0, y, 0, 11, y + 1, 1, K.galv, 2); V.box(0, y, 9, 11, y + 1, 10, K.galv, 2); }
  V.box(4, 11, 4, 7, 12, 6, K.steelD); return done(V, 'tote'); });
// the fire ring: stones round a heap of charred logs (embers glow at night)
export const fireRing = () => M('firering', 'fire-ring', () => { const V = pv(15, 5, 15);
  for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2, x = Math.round(7 + Math.cos(t) * 6), z = Math.round(7 + Math.sin(t) * 6); V.box(x, 0, z, x + 2, 2, z + 2, K.stone[a % 3]); }
  V.box(4, 0, 4, 11, 1, 11, K.char); line(V, 4, 1, 5, 10, 2, 9, K.log); line(V, 5, 1, 10, 10, 2, 5, 0x5a3620); V.box(6, 1, 6, 9, 2, 9, TOD.night ? K.ember : 0x4a3a30, TOD.night ? 3 : 0);
  return done(V, 'fire-ring'); });
// a canoe (upside down on the shore, or afloat), 4.8 m
export const canoe = (c = 0xe8232a, up = true) => M('canoe' + c + up, 'canoe', () => { const L = 48, V = pv(10, 6, L + 2);
  for (let z = 1; z <= L; z++) { const t = (z - .5) / L, w = Math.max(1, Math.round(4.4 * Math.sin(Math.PI * t))), h = up ? 4 : 3;
    for (let x = 5 - w; x < 5 + w; x++) for (let y = 0; y < h; y++) { const edge = x === 5 - w || x === 4 + w; if (up ? (y === h - 1 || edge) : (y === 0 || edge)) V.set(x, y + (up ? 0 : 0), z, y === (up ? h - 1 : 0) || !edge ? c : shade(c, .8)); } }
  if (!up) for (const z of [16, 32]) V.box(2, 2, z, 8, 3, z + 1, K.wood); return done(V, 'canoe'); });
// the log deck: a stacked pile of cut logs, ends showing
export const logPile = () => M('logpile', 'log-pile', () => { const V = pv(40, 14, 16);
  const put = (x0, cy, cz, r) => cylX(V, x0, x0 + 38 - ((cz * 7) % 5), cy, cz, r, (x, y, z) => x === x0 || x === x0 + 37 - ((cz * 7) % 5) ? K.logEnd : (y + z) % 5 === 0 ? 0x5a3620 : K.log);
  for (let k = 0; k < 4; k++) put(1, 2.2, 2.5 + k * 3.7, 2.2); for (let k = 0; k < 3; k++) put(2, 6, 4.3 + k * 3.7, 2.2); for (let k = 0; k < 2; k++) put(1, 9.8, 6.2 + k * 3.7, 2.2);
  return done(V, 'log-pile'); });
// a trail post: a 4 × 4 with a painted blaze
export const trailPost = (c = 0xe8232a) => M('tpost' + c, 'trail-post', () => { const V = pv(3, 10, 3); V.box(0, 0, 0, 3, 9, 3, K.wood); V.box(0, 6, 0, 3, 8, 3, c); V.box(0, 9, 0, 3, 10, 3, K.woodD); return done(V, 'trail-post'); });
// the chain across the south track at Grand Ave's dead end: two galvanised posts, a sagging chain, a plate hanging from it
export const chainGate = () => M('chaingate', 'gate', () => { const W = 40, V = pv(W + 2, 12, 3);
  for (const x of [0, W]) { V.box(x, 0, 0, x + 2, 10, 2, K.galv, 2); V.box(x, 10, 0, x + 2, 11, 2, K.yellow); } sag(V, 1, 8, 1, W, 8, 1, 2, 0x6d707a, 2);
  return done(V, 'gate'); });
// the pipe gate on the north track (Route 9): a yellow tubular farm gate, shut, a padlocked chain
export const pipeGate = () => M('pipegate', 'gate', () => { const W = 44, V = pv(W + 3, 13, 3), Y = 0xffc21a;
  V.box(0, 0, 0, 2, 12, 2, K.steelD); V.box(W + 1, 0, 0, W + 3, 12, 2, K.steelD);
  for (const y of [3, 7, 10]) V.box(2, y, 1, W + 1, y + 1, 2, Y); for (let x = 6; x < W; x += 8) V.box(x, 3, 1, x + 1, 11, 2, Y); line(V, 2, 3, 1, 14, 10, 1, Y);
  V.box(W - 1, 5, 0, W + 1, 8, 1, 0x9a9ca4, 2); return done(V, 'gate'); });
// the leaf crop: a bushy plant of serrated fans (three builds)
export const leafPlant = v => M('leafp' + (v % 3), 'leaf-plant', () => { const V = pv(9, 9, 9), C = K.leaf, h = 5 + (v % 3);
  V.box(4, 0, 4, 5, h, 5, 0x2f7a2a);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + v, y = 2 + (k % 3) + (v % 2); for (let q = 1; q <= 4; q++) { const x = Math.round(4 + Math.cos(a) * q), z = Math.round(4 + Math.sin(a) * q); V.set(x, y + (q > 2 ? 1 : 0), z, C[(k + q) % 4]); } }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) V.set(4 + dx, h, 4 + dz, C[2]); return done(V, 'leaf-plant'); });
// a burlap sack, tied (two builds), a pile of them
export const sacks = n => M('sacks' + n, 'sacks', () => { const V = pv(14, 7, 9);
  for (let k = 0; k < n; k++) { const x = 2 + k * 4, z = 2 + (k % 2) * 2; V.box(x, 0, z, x + 4, 5, z + 4, (xx, y) => y === 4 ? K.burlapD : K.burlap); V.box(x + 1, 5, z + 1, x + 3, 6, z + 3, K.burlapD); V.set(x + 2, 6, z + 2, 0x6fdc4a); }
  return done(V, 'sacks'); });
export const wheelbarrow = () => M('wbarrow', 'wheelbarrow', () => { const V = pv(7, 6, 14); V.box(1, 2, 3, 6, 5, 10, 0x25b84c); V.box(2, 5, 4, 5, 6, 9, 0x3fa84a); V.box(2, 0, 1, 5, 3, 2, 0x1b1b20);
  for (const x of [1, 5]) { line(V, x, 3, 1, x, 4, 13, K.woodD); V.box(x, 0, 9, x + 1, 2, 10, K.steelD); } return done(V, 'wheelbarrow'); });
// the drying rack: an A-frame of poles, leaf bundles hanging from the ridge
export const dryingRack = () => M('drack', 'drying-rack', () => { const L = 30, V = pv(12, 18, L + 2);
  for (const z of [1, L]) { line(V, 1, 0, z, 6, 16, z, K.woodD); line(V, 11, 0, z, 6, 16, z, K.woodD); } V.box(5, 16, 1, 7, 17, L + 1, K.wood);
  for (let z = 4; z < L - 1; z += 4) { V.box(6, 12, z, 7, 16, z + 1, K.burlapD); V.box(5, 8, z - 1, 8, 12, z + 2, K.leaf[(z >> 2) % 4]); }
  return done(V, 'drying-rack'); });
// a trestle table: scale, sorted leaves in heaps, a lantern (lit at night)
export const sortTable = () => M('stable', 'table', () => { const V = pv(22, 12, 10); V.box(0, 7, 0, 22, 8, 10, K.woodL); for (const x of [2, 18]) { line(V, x, 0, 1, x + 2, 7, 5, K.woodD); line(V, x, 0, 9, x + 2, 7, 5, K.woodD); }
  V.box(2, 8, 2, 7, 10, 7, K.leaf[1]); V.box(8, 8, 3, 12, 9, 7, K.leaf[2]); V.box(14, 8, 2, 18, 9, 5, 0xd8dbe2, 2); V.box(15, 9, 3, 17, 10, 4, K.leaf[0]); V.box(19, 8, 6, 21, 11, 8, TOD.night ? 0xffd27a : 0xe9e1c8, TOD.night ? 3 : 1);
  return done(V, 'table'); });
// a lantern on a pole (lit at night): the leaf field works late
export const lanternPole = () => M('lpole', 'lantern', () => { const V = pv(9, 26, 5); V.box(0, 0, 1, 2, 24, 3, K.woodD); V.box(2, 22, 1, 8, 23, 3, K.woodD); V.box(4, 21, 1, 6, 22, 3, 0x2a2d38); V.box(3, 16, 0, 8, 21, 4, 0x2a2d38); V.box(4, 17, 0, 7, 20, 4, TOD.night ? 0xffd27a : 0xe9e1c8, TOD.night ? 3 : 1); V.box(3, 15, 0, 8, 16, 4, 0x2a2d38);
  return done(V, 'lantern'); });
export const shovel = () => M('shovel', 'shovel', () => { const V = pv(3, 12, 3); V.box(1, 0, 1, 2, 3, 2, 0x9a9ca4, 2); V.box(0, 0, 1, 3, 2, 2, 0x9a9ca4, 2); V.box(1, 3, 1, 2, 11, 2, K.wood); V.box(0, 11, 1, 3, 12, 2, K.woodD); return done(V, 'shovel'); });
// the dump: a mattress, a fridge on its back, a TV
export const mattress = () => M('mattress', 'mattress', () => { const V = pv(20, 3, 14); V.box(0, 0, 0, 20, 2, 14, 0xe8e2d0); for (let x = 2; x < 20; x += 4) V.box(x, 2, 1, x + 1, 3, 13, 0xd0c8b4); V.box(12, 2, 3, 18, 3, 8, 0xc4a86a); return done(V, 'mattress'); });
export const fridge = () => M('fridge', 'fridge', () => { const V = pv(7, 7, 14); V.box(0, 0, 0, 7, 6, 14, K.white); V.box(0, 6, 4, 7, 7, 5, 0xd8dbe2); V.box(6, 6, 1, 7, 7, 3, 0xc9ced6, 2); return done(V, 'fridge'); });
export const tvSet = () => M('tvset', 'tv', () => { const V = pv(7, 6, 6); V.box(0, 0, 0, 7, 6, 6, 0x2b2b33); V.box(1, 1, 6, 6, 5, 6, 0x6fb8c0, 1); return done(V, 'tv'); });
// the dog's house at the tin shack
export const kennel = () => M('kennel', 'doghouse', () => { const V = pv(10, 10, 10); V.box(0, 0, 0, 10, 6, 10, 0x9a6a3c); for (let k = 0; k < 5; k++) V.box(k, 6 + k, 0, 10 - k, 7 + k, 10, 0x6b4526);
  V.box(3, 0, 9, 7, 5, 10, 0x1b1b20); return done(V, 'doghouse'); });
// firewood stacked between two stakes
export const woodpile = () => M('woodpile', 'woodpile', () => { const V = pv(22, 10, 5); for (const x of [0, 21]) V.box(x, 0, 0, x + 1, 10, 5, K.woodD);
  for (let y = 0; y < 9; y += 2) for (let x = 1; x < 21; x += 2) V.box(x, y, 0, x + 2, y + 2, 5, (xx, yy, z) => z === 4 ? K.logEnd : (x + y) % 4 ? K.log : 0x5a3620); return done(V, 'woodpile'); });
// the outhouse (a moon cut in the door)
export const outhouse = () => M('outhouse', 'outhouse', () => { const V = pv(11, 24, 11); V.box(0, 0, 0, 11, 20, 11, (x, y, z) => x % 3 === 0 ? 0x7a5230 : 0x8a6038);
  for (let k = 0; k < 3; k++) V.box(-1 + k, 20 + k, -1 + k, 12 - k, 21 + k, 12 - k, 0x5a5d66); V.box(3, 1, 10, 8, 18, 11, 0x6b4526); V.box(5, 15, 10, 7, 17, 11, 0x1b1b20); return done(V, 'outhouse'); });
// the wreck: an old sedan gone to rust in the trees — no wheels, glass out, leaves on the roof, a sapling through the bonnet
export const wreck = () => M('wreck', 'wreck', () => { const L = 44, Wd = 18, V = pv(Wd + 2, 22, L + 2), B = 0x6f8fa0, R = K.rust;
  const body = (x, y, z) => hash(x >> 1, y >> 1, z >> 2) < .35 ? R : hash(x, y, z) < .08 ? K.rustD : B;
  V.box(1, 0, 1, Wd + 1, 7, L + 1, body); V.box(1, 7, 12, Wd + 1, 16, 32, body); V.box(2, 16, 13, Wd, 17, 31, body);
  V.box(2, 8, 12, Wd, 15, 13, 0x1b1f28); V.box(2, 8, 31, Wd, 15, 32, 0x1b1f28); for (const x of [1, Wd]) V.box(x, 8, 14, x + 1, 15, 30, 0x1b1f28);   // glass gone: dark holes
  for (let x = 3; x < Wd - 1; x++) for (let z = 15; z < 30; z++) if (hash(x, z, 5) < .5) V.set(x, 17, z, [0xd8681f, 0xe8892a, 0x9c6230][(x + z) % 3]);   // leaves on the roof
  V.box(4, 7, 34, Wd - 2, 8, L, 0x2a2624); V.box(8, 7, 37, 11, 20, 40, 0x6b4226); for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let y = 17; y < 21; y++) if (Math.abs(dx) + Math.abs(dz) < 4 + (y < 19 ? 1 : 0)) V.set(9 + dx, y, 38 + dz, 0x46a052);   // the sapling
  return done(V, 'wreck'); });
// the hunting stand at the meadow's edge: four splayed legs, a platform at 3.2 m with a seat, a camo skirt, a ladder
export const huntingStand = () => M('hstand', 'hunting-stand', () => { const V = pv(24, 48, 24), T = 32, C = K.camo;
  for (const [x, z] of [[1, 1], [22, 1], [1, 22], [22, 22]]) line(V, x, 0, z, x < 12 ? 6 : 17, T, z < 12 ? 6 : 17, 0x7a5230, 0, 2);
  V.box(5, T, 5, 19, T + 1, 19, K.wood); for (let y = T + 1; y < T + 9; y++) for (let k = 5; k < 19; k++) { const c = C[(hash(k >> 1, y >> 1, 3) * 4) | 0]; V.set(k, y, 5, c); V.set(k, y, 18, c); V.set(5, y, k, c); V.set(18, y, k, c); }
  for (let k = 0; k < 4; k++) V.box(5 + k, T + 13 + k, 5 + k, 19 - k, T + 14 + k, 19 - k, C[k % 4]); for (const [x, z] of [[5, 5], [18, 5], [5, 18], [18, 18]]) V.box(x, T + 9, z, x + 1, T + 13, z + 1, 0x5a3620);
  V.box(10, T + 1, 12, 15, T + 4, 16, 0x3b3f4a);
  line(V, 8, 0, 23, 8, T, 19, 0x7a5230); line(V, 15, 0, 23, 15, T, 19, 0x7a5230); for (let y = 2; y < T; y += 3) { const z = 23 - Math.round(4 * y / T); V.box(8, y, z, 16, y + 1, z + 1, 0x7a5230); }
  return done(V, 'hunting-stand'); });
// a concrete jersey barrier, red and white striped (the Dock St dead end)
export const barrier = () => M('jersey', 'barrier', () => { const V = pv(8, 9, 22); for (let y = 0; y < 8; y++) { const w = y < 3 ? 4 : y < 5 ? 3 : 2; V.box(4 - w, y, 0, 4 + w, y + 1, 22, (x, yy, z) => ((z + yy) >> 2) & 1 ? 0xe8232a : 0xf4f1ea); }
  V.box(2, 8, 0, 6, 9, 22, 0xd3d4d7); return done(V, 'barrier'); });
// pallets stacked into a lookout platform (0.6 m): deck boards and stringers, the top deck solid
export const pallets = n => M('pallets' + n, 'pallets', () => { const V = pv(12, 6, 10);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) for (let z = 0; z < 10; z++) { const deck = y % 2 === 1, c = deck ? (y < 5 && z % 3 === 2 ? undefined : (z % 3 === 1 ? K.woodD : K.wood)) : ((x === 0 || x === 5 || x === 11) ? K.woodD : undefined); if (c !== undefined) V.set(x, y, z, c); }
  return done(V, 'pallets'); });
// a burn barrel: a rusted drum with holes punched round it, charred at the rim, embers glowing inside at night
export const burnBarrel = () => M('burnbarrel', 'burn-barrel', () => { const V = pv(8, 10, 8), R = 0x8a3f22;
  cyl(V, 4, 4, 3.6, 0, 9, (x, y, z) => y === 8 ? 0x2a2624 : (y === 3 || y === 6) && (x + z) % 3 === 0 ? (TOD.night ? 0xff6a1a : 0x1b1b20) : y % 3 === 1 ? 0x7a3a1e : R, 0);
  V.box(2, 8, 2, 6, 9, 6, TOD.night ? 0xff8a2a : 0x3b3530, TOD.night ? 3 : 0); V.set(3, 9, 4, 0x2a2624); V.set(5, 9, 3, 0x5a3620);
  for (let y = 3; y < 7; y += 3) for (const [x, z] of [[4, 0], [0, 4], [7, 4], [4, 7]]) if (V.has(x, y, z)) V.set(x, y, z, TOD.night ? 0xff6a1a : 0x1b1b20, TOD.night ? 3 : 0);
  return done(V, 'burn-barrel'); });
// the dig's spoil: a heap of turned soil (three builds), a shovel-cut face on one side
export const spoilHeap = v => M('spoil' + (v % 3), 'spoil', () => { const V = pv(18, 8, 14), C = [0x5a3e26, 0x7a5434, 0x6b4a2c];
  for (let y = 0; y < 7; y++) { const rx = 8.5 - y * 1.2 - (v % 3) * .3, rz = 6.5 - y * .9; for (let x = 0; x < 18; x++) for (let z = 0; z < 14; z++) { const dx = (x + .5 - 9) / Math.max(1, rx), dz = (z + .5 - 7) / Math.max(1, rz); if (dx * dx + dz * dz > 1) continue; if (y > 0 && hash(x, z + y * 17, v) < .1) continue; V.set(x, y, z, C[(hash(x >> 1, y, z >> 1) * 3) | 0]); } }
  return done(V, 'spoil'); });
// a survey stake with orange flagging tape (the dig is marked out)
export const flagStake = () => M('flagstake', 'stake', () => { const V = pv(4, 12, 3); V.box(1, 0, 1, 2, 11, 2, 0xc49a6c); V.box(2, 8, 1, 4, 10, 2, 0xff5a1f); V.box(2, 7, 1, 3, 8, 2, 0xff5a1f); return done(V, 'stake'); });
