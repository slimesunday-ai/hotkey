// SUNNY ACRES · the trailer park's own props (owner: the Sunny Acres / Millennium Mall section agent). Authored once in city voxels
// (base centre, facing +z), memoised per variant. Everything is flat toon colour, sized to the big-head body (STYLE §1).
import { PAL, CV, hash, shade, TOD, M, lit, pv, done, txt, txtX, tw, cyl, ring, line, board } from './brush.js';

const IRON = PAL.iron, WD = PAL.wood, WDD = PAL.woodD, INK = PAL.ink, WHITE = PAL.white;
export const TYRE = 0x1b1b20, RIM = 0xc9ced6, CHROME = 0xdfe3ea, RUST = 0x9a4a24, RUSTD = 0x6e3418, GALV = 0xb9bcc4, CONC = 0xb8b3a8;

// ── vehicles (4.2–4.8 m): a body box, a cab, glass, wheels in wells, lamps. v picks the variant
function wheels(V, x0, x1, zs, W, rim = RIM) { for (const z of zs) for (const x of [x0, x1 - 3]) { V.box(x, 0, z - 3, x + 3, 7, z + 4, TYRE); V.box(x + (x === x0 ? 0 : 2), 2, z - 1, x + 1 + (x === x0 ? 0 : 2), 5, z + 2, rim, 2); } }
export const pickup = (c, v = 0) => M('pickup' + c + v, 'car', () => {
  const L = 46, W = 19, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = x0 + W, rust = v === 1;
  V.box(x0, 3, 1, x1, 10, L + 1, (x, y, z) => rust && hash(x, y, z) > .86 ? RUST : c);              // chassis + lower body
  V.box(x0, 10, 1, x1, 13, 21, c); V.clear(x0 + 1, 10, 2, x1 - 1, 13, 20);                            // the bed walls
  V.box(x0 + 1, 9, 2, x1 - 1, 10, 20, shade(c, .7));                                                 // bed floor
  V.box(x0, 10, 22, x1, 20, 33, c); V.box(x0 + 1, 20, 23, x1 - 1, 21, 32, c);                         // cab
  V.box(x0 + 1, 12, 32, x1 - 1, 19, 33, 0x9fd8ff, 1); V.box(x0 + 1, 12, 22, x1 - 1, 19, 23, 0x9fd8ff, 1);
  for (const x of [x0, x1 - 1]) V.box(x, 12, 24, x + 1, 19, 31, 0x9fd8ff, 1);
  V.box(x0, 10, 33, x1, 11, L + 1, c); V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); V.box(x0 - 1, 3, 0, x1 + 1, 5, 2, CHROME, 2);
  V.box(x0, 6, L + 1, x0 + 4, 9, L + 2, 0xffffff, 1); V.box(x1 - 4, 6, L + 1, x1, 9, L + 2, 0xffffff, 1); V.box(x0, 6, 0, x0 + 3, 9, 1, 0xd7141a, 1);
  if (v === 2) { V.box(x0, 13, 2, x1, 20, 21, 0xe6e1d6); V.box(x0 + 1, 15, 1, x1 - 1, 18, 2, 0x9fd8ff, 1); }   // a camper shell on the bed
  wheels(V, x0 - 1, x1 + 1, [8, L - 9], W); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4);
  return done(V, 'car'); });
export const van = (c, stripe) => M('van' + c + stripe, 'car', () => {
  const L = 48, W = 20, V = pv(W + 2, 30, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 3, 1, x1, 23, L - 6, c); V.box(x0, 3, L - 6, x1, 13, L + 1, c); V.box(x0 + 1, 13, L - 6, x1 - 1, 20, L - 5, 0x9fd8ff, 1);
  for (let z = 5; z < L - 10; z += 11) for (const x of [x0, x1 - 1]) V.box(x, 14, z, x + 1, 19, z + 7, 0x9fd8ff, 1);
  if (stripe) V.box(x0, 9, 1, x1, 12, L - 6, (x, y, z) => ((z + y) % 8 < 4) ? stripe : shade(stripe, .8));
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); V.box(x0, 7, L + 1, x0 + 4, 10, L + 2, 0xffffff, 1); V.box(x1 - 4, 7, L + 1, x1, 10, L + 2, 0xffffff, 1);
  V.box(x0 + 2, 23, 6, x1 - 2, 24, 30, shade(c, .85));
  wheels(V, x0 - 1, x1 + 1, [8, L - 9], W); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4);
  return done(V, 'car'); });
export const sedan = (c, v = 0) => M('sedan' + c + v, 'car', () => {   // an old four-door, a primer panel or a missing hubcap
  const L = 44, W = 18, V = pv(W + 2, 26, L + 2), x0 = 1, x1 = x0 + W;
  V.box(x0, 3, 1, x1, 10, L + 1, (x, y, z) => v === 1 && z > 30 ? 0x8a8c94 : c); V.box(x0 + 1, 10, 11, x1 - 1, 18, 31, c); V.box(x0 + 2, 18, 12, x1 - 2, 19, 30, c);
  V.box(x0 + 2, 11, 30, x1 - 2, 17, 31, 0x9fd8ff, 1); V.box(x0 + 2, 11, 11, x1 - 2, 17, 12, 0x9fd8ff, 1); for (const x of [x0 + 1, x1 - 2]) V.box(x, 11, 13, x + 1, 17, 29, 0x9fd8ff, 1);
  V.box(x0 - 1, 3, L, x1 + 1, 5, L + 2, CHROME, 2); V.box(x0 - 1, 3, 0, x1 + 1, 5, 2, CHROME, 2);
  V.box(x0, 6, L + 1, x0 + 4, 9, L + 2, 0xffffff, 1); V.box(x1 - 4, 6, L + 1, x1, 9, L + 2, 0xffffff, 1); V.box(x0, 6, 0, x0 + 3, 9, 1, 0xd7141a, 1); V.box(x1 - 3, 6, 0, x1, 9, 1, 0xd7141a, 1);
  wheels(V, x0 - 1, x1 + 1, [8, L - 9], W, v === 2 ? TYRE : RIM); for (const z of [8, L - 9]) V.clear(x0 + 2, 0, z - 3, x1 - 2, 3, z + 4);
  return done(V, 'car'); });
export const motorbike = c => M('moto' + c, 'moto', () => { const V = pv(8, 13, 22);
  for (const z of [3, 18]) { for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; V.set(4, 3 + Math.round(Math.sin(t) * 3), z + Math.round(Math.cos(t) * 3), TYRE); } V.box(4, 3, z, 5, 4, z + 1, RIM, 2); }
  V.box(3, 5, 5, 6, 8, 17, c); V.box(3, 8, 7, 6, 10, 13, INK); V.box(3, 6, 14, 6, 11, 16, c); line(V, 4, 4, 18, 4, 11, 16, CHROME, 2); V.box(1, 11, 15, 8, 12, 16, CHROME, 2); V.box(4, 8, 17, 5, 10, 18, 0xffffff, 1);
  line(V, 4, 4, 3, 4, 6, 7, CHROME, 2); V.box(4, 1, 8, 5, 5, 9, IRON); return done(V, 'moto'); });
export const boat = c => M('boat' + c, 'boat', () => {   // a runabout on its trailer: V hull, windscreen, outboard
  const L = 46, V = pv(22, 22, L + 4, 11, 22);
  for (const z of [16, 30]) { V.box(1, 0, z - 3, 4, 6, z + 4, TYRE); V.box(18, 0, z - 3, 21, 6, z + 4, TYRE); }
  V.box(4, 4, 2, 18, 5, L + 2, IRON); V.box(10, 3, L + 1, 12, 5, L + 4, IRON);                             // frame + tongue
  for (let z = 4; z < L; z++) { const t = z < L - 12 ? 0 : (z - (L - 12)) / 12, hw = Math.round(9 * (1 - t * t * .9)); V.box(11 - hw, 7, z, 11 + hw, 11, z + 1, (x, y) => y < 9 ? c : WHITE); V.box(11 - Math.max(1, hw - 3), 5, z, 11 + Math.max(1, hw - 3), 7, z + 1, shade(c, .8)); }
  V.box(4, 11, 20, 18, 12, 30, 0xd9d2c3); V.box(5, 12, 26, 17, 16, 27, 0x9fd8ff, 1);                        // deck, windscreen
  V.box(8, 7, 0, 14, 17, 4, INK); V.box(9, 3, 1, 13, 7, 3, INK);                                            // outboard
  return done(V, 'boat'); });

// ── yard life
export const flamingo = v => M('flamingo' + (v & 1), 'flamingo', () => { const s = .05, V = pv(8, 18, 8, 4, 4, s), P = 0xff4fa3;
  V.box(3, 0, 4, 4, 9, 5, 0xffb0cf); V.box(5, 0, 4, 6, 9, 5, 0xffb0cf); V.box(2, 9, 2, 7, 12, 7, P); V.box(3, 12, 5, 6, 13, 7, P);
  if (v & 1) { V.box(4, 11, 7, 5, 13, 8, P); V.box(4, 9, 7, 5, 11, 8, P); V.box(4, 8, 6, 5, 9, 8, INK); }                        // pecking
  else { V.box(4, 12, 6, 5, 17, 7, P); V.box(4, 16, 6, 6, 18, 8, P); V.box(5, 16, 7, 6, 17, 8, INK); }
  return done(V, 'flamingo'); });
export const gnome = c => M('gnome' + c, 'gnome', () => { const s = .05, V = pv(6, 12, 6, 3, 3, s); V.box(1, 0, 1, 5, 5, 5, 0x2f5bff); V.box(1, 5, 1, 5, 7, 5, 0xffd2a8); V.box(1, 5, 4, 5, 6, 5, WHITE); V.box(2, 7, 2, 4, 10, 4, c); V.box(2, 10, 2, 3, 12, 3, c); return done(V, 'gnome'); });
export const propane = (c = WHITE) => M('propane' + c, 'propane', () => { const V = pv(6, 13, 6); cyl(V, 3, 3, 2.4, 0, 10, c); cyl(V, 3, 3, 1.8, 10, 11, shade(c, .9)); ring(V, 3, 3, 1.4, 2.4, 11, 13, shade(c, .8)); V.box(2, 11, 2, 4, 12, 4, 0xc9a23a, 2); return done(V, 'propane'); });
export const burnBarrel = () => M('burn', 'barrel', () => { const V = pv(8, 12, 8); cyl(V, 4, 4, 3.2, 0, 9, (x, y, z) => (y === 1 || y === 7) ? RUSTD : hash(x, y, z) > .8 ? RUSTD : RUST);
  cyl(V, 4, 4, 2.3, 8, 9, 0x2a2420); for (const [x, z, h] of [[3, 4, 11], [5, 3, 10], [4, 5, 12], [5, 5, 10]]) V.box(x, 9, z, x + 1, h, z + 1, TOD.night ? 0xffa52a : 0x5a4f48, TOD.night ? 3 : 0);
  return done(V, 'barrel'); });
export const firePit = v => M('pit' + (v % 2), 'firepit', () => { const V = pv(12, 5, 12); ring(V, 6, 6, 3.6, 5.8, 0, 2, (x, y, z) => hash(x, z) > .5 ? 0x9a9aa6 : 0x7b7c86);
  V.box(3, 0, 5, 9, 1, 7, WDD); V.box(5, 1, 3, 7, 2, 9, WDD); if (TOD.night) { V.box(5, 2, 5, 7, 4, 7, 0xffb030, 3); V.box(6, 4, 6, 7, 5, 7, 0xffe080, 3); } else V.box(4, 1, 4, 8, 2, 8, 0x3a3330);
  if (v % 2) for (const [x, z] of [[1, 1], [10, 10]]) V.box(x, 0, z, x + 1, 3, z + 1, 0x8a8c94);
  return done(V, 'firepit'); });
export const trampoline = c => M('tramp' + c, 'trampoline', () => { const R = 18, V = pv(38, 10, 38, 19, 19);
  for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2, x = 19 + Math.round(Math.cos(t) * 16.5), z = 19 + Math.round(Math.sin(t) * 16.5); V.box(x, 0, z, x + 1, 8, z + 1, GALV, 2); }
  ring(V, 19, 19, R - 3, R, 8, 9, c); cyl(V, 19, 19, R - 3, 8, 9, 0x1d1d24); ring(V, 19, 19, R - 3, R - 2, 8, 9, GALV, 2);
  return done(V, 'trampoline'); });
export const doghouse = (c, name) => M('dog' + c + name, 'doghouse', () => { const V = pv(12, 13, 14, 6, 7);
  V.box(1, 0, 1, 11, 7, 13, c); V.clear(4, 0, 12, 8, 5, 13); V.box(4, 0, 11, 8, 5, 12, 0x2a2420);
  for (let k = 0; k < 6; k++) V.box(k, 7 + k, 0, 12 - k, 8 + k, 14, (x, y, z) => (x === k || x === 11 - k) ? shade(PAL.red, .8) : PAL.red);
  V.box(0, 0, 13, 1, 1, 14, 0x9a9aa6);
  return done(V, 'doghouse'); });
// the chain stake and bowl go with every doghouse (a dog lives here even if nobody drew it)
export const bowl = () => M('bowl', 'bowl', () => { const V = pv(6, 2, 4); V.box(0, 0, 0, 3, 1, 3, 0xe8232a); V.box(4, 0, 1, 5, 2, 2, IRON); return done(V, 'bowl'); });
export const resinChair = c => M('resin' + c, 'chair', () => { const V = pv(7, 10, 7); for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) V.box(x, 0, z, x + 1, 4, z + 1, c);
  V.box(0, 4, 0, 7, 5, 7, c); V.box(0, 5, 0, 7, 10, 1, c); for (const x of [0, 6]) V.box(x, 5, 1, x + 1, 7, 6, c); return done(V, 'chair'); });
export const cooler = c => M('cooler' + c, 'cooler', () => { const V = pv(7, 5, 5); V.box(0, 0, 0, 7, 4, 5, c); V.box(0, 4, 0, 7, 5, 5, WHITE); V.box(2, 5, 2, 5, 5, 3, WHITE); return done(V, 'cooler'); });
export const smoker = () => M('smoker', 'smoker', () => { const V = pv(16, 16, 8); for (const [x, z] of [[1, 1], [14, 1], [1, 6], [14, 6]]) V.box(x, 0, z, x + 1, 6, z + 1, IRON);
  for (let x = 1; x < 15; x++) for (let y = 6; y < 12; y++) for (let z = 1; z < 7; z++) if (Math.hypot(y - 8.8, z - 3.8) < 3.4) V.set(x, y, z, INK);
  V.box(0, 8, 3, 1, 9, 5, 0x9a9aa6); V.box(12, 12, 3, 14, 16, 5, INK); V.box(3, 11, 6, 9, 12, 7, 0x9a9aa6); return done(V, 'smoker'); });
export const cinder = n => M('cinder' + n, 'blocks', () => { const V = pv(8, 2 * n + 1, 4); for (let k = 0; k < n; k++) V.box(k % 2, k * 2, 0, 8 - (k + 1) % 2, k * 2 + 2, 4, (x, y, z) => (x % 4 === 1 && z === 0) ? 0x7f7f86 : CONC); return done(V, 'blocks'); });
export const pallets = n => M('pallets' + n, 'pallets', () => { const V = pv(12, n * 2, 10); for (let k = 0; k < n; k++) { const y = k * 2; for (const z of [0, 4, 9]) V.box(0, y, z, 12, y + 1, z + 1, WD); for (let x = 0; x < 12; x += 3) V.box(x, y + 1, 0, x + 2, y + 2, 10, shade(WD, 1.08)); } return done(V, 'pallets'); });
export const washer = () => M('washer', 'appliance', () => { const V = pv(7, 9, 7); V.box(0, 0, 0, 7, 9, 7, 0xf2f2ee); V.box(0, 8, 0, 7, 9, 7, 0xdfe2e8); cyl(V, 3.5, 3.5, 1.8, 9, 9, INK);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= 5) V.set(3 + a, 4 + b, 7 - 1, a * a + b * b <= 2 ? 0x2a3564 : 0x9a9aa6, 2); V.box(1, 7, 6, 3, 8, 7, 0x2f5bff); return done(V, 'appliance'); });
export const fridge = c => M('fridge' + c, 'appliance', () => { const V = pv(7, 17, 7); V.box(0, 0, 0, 7, 17, 7, c); V.box(0, 11, 6, 7, 12, 7, shade(c, .8)); V.box(5, 12, 7 - 1, 6, 16, 7, CHROME, 2); V.box(5, 4, 6, 6, 10, 7, CHROME, 2); return done(V, 'appliance'); });
export const slide = c => M('slide' + c, 'toy', () => { const V = pv(8, 13, 22, 4, 11); V.box(0, 0, 0, 8, 9, 6, c); V.box(1, 9, 1, 7, 10, 5, c); for (let z = 6; z < 21; z++) { const y = Math.round(9 - (z - 6) * .6); V.box(1, Math.max(0, y - 1), z, 7, y + 1, z + 1, PAL.yellow); V.box(0, y + 1, z, 1, y + 2, z + 1, PAL.yellow); V.box(7, y + 1, z, 8, y + 2, z + 1, PAL.yellow); }
  for (let y = 1; y < 9; y += 2) V.box(2, y, 0, 6, y + 1, 1, 0x2f5bff); return done(V, 'toy'); });
export const playhouse = c => M('play' + c, 'toy', () => { const V = pv(14, 16, 12); V.box(0, 0, 0, 14, 10, 12, 0xf2e8d0); V.clear(5, 0, 11, 9, 7, 12); V.box(5, 0, 10, 9, 7, 11, c); V.box(2, 5, 11, 4, 8, 12, 0x9fd8ff, 1); V.box(10, 5, 11, 12, 8, 12, 0x9fd8ff, 1);
  for (let k = 0; k < 6; k++) V.box(k, 10 + k, 0, 14 - k, 11 + k, 12, c); return done(V, 'toy'); });
export const pinwheel = c => M('pinw' + c, 'toy', () => { const s = .05, V = pv(8, 18, 3, 4, 1, s); V.box(3, 0, 1, 4, 13, 2, WHITE); for (const [dx, dy, cc] of [[-2, 2, c], [2, 2, PAL.yellow], [-2, -2, 0x2f5bff], [2, -2, 0x25b84c]]) V.box(3 + (dx > 0 ? 1 : dx), 14 + (dy > 0 ? 1 : dy), 2, 3 + (dx > 0 ? 3 : 0), 14 + (dy > 0 ? 3 : 0), 3, cc); V.box(3, 14, 1, 4, 15, 3, WHITE); return done(V, 'toy'); });
export const tikiTorch = () => M('tiki', 'torch', () => { const s = .05, V = pv(4, 32, 4, 2, 2, s); V.box(1, 0, 1, 3, 26, 3, 0xa4652f); V.box(0, 26, 0, 4, 29, 4, 0x8a5a2a); V.box(1, 29, 1, 3, 32, 3, TOD.night ? 0xffb030 : 0x3a3330, TOD.night ? 3 : 0); return done(V, 'torch'); });
export const bucketGarden = v => M('bucket' + (v % 3), 'planter', () => { const V = pv(5, 9, 5); cyl(V, 2.5, 2.5, 2.3, 0, 4, [0xff7a1a, WHITE, 0x2f5bff][v % 3]); V.box(1, 4, 1, 4, 5, 4, 0x6b3a1e);
  if (v % 3 === 1) { V.box(2, 5, 2, 3, 9, 3, 0x2f8a3a); V.box(1, 8, 1, 4, 9, 4, PAL.yellow); } else { V.box(1, 5, 1, 4, 7, 4, 0x3aa64a); V.box(2, 7, 2, 3, 8, 3, 0xe8232a); }
  return done(V, 'planter'); });
export const hammock = c => M('hammock' + c, 'hammock', () => { const V = pv(36, 14, 4, 18, 2); for (const x of [0, 34]) V.box(x, 0, 1, x + 2, 14, 3, WDD);
  for (let x = 2; x < 34; x++) { const t = (x - 2) / 31, y = Math.round(11 - 6 * 4 * t * (1 - t)); V.box(x, y, 0, x + 1, y + 1, 4, ((x >> 1) & 1) ? c : WHITE); } return done(V, 'hammock'); });
export const flagPole = (kind) => M('flag' + kind, 'flag', () => { const V = pv(14, 40, 4, 1, 2); V.box(0, 0, 1, 1, 40, 2, GALV, 2);
  if (kind === 'checker') for (let x = 1; x < 13; x++) for (let y = 30; y < 38; y++) V.set(x, y, 1, (((x - 1) >> 1) + ((y - 30) >> 1)) & 1 ? INK : WHITE);
  else for (let x = 1; x < 13; x++) { const r = Math.max(1, Math.round(3 - x * .18)); for (let y = 35 - r - (x >> 2); y <= 35 + r - (x >> 2); y++) for (let z = 2 - r + 1; z < 2 + r; z++) V.set(x, y, z, ((x >> 1) & 1) ? 0xff7a1a : WHITE); }   // a windsock, drooping
  return done(V, 'flag'); });
// the old C-band dish: three metres of mesh on a steel mast, aimed at a satellite nobody uses any more (a yard gag)
export const bigDish = () => M('bigdish', 'dish', () => { const V = pv(34, 40, 16, 17, 8), c = 0xe9e9e4;
  V.box(15, 0, 6, 19, 14, 10, GALV, 2); V.box(13, 0, 4, 21, 1, 12, CONC);
  for (let x = 0; x < 34; x++) for (let y = 0; y < 34; y++) { const dx = x + .5 - 17, dy = y + .5 - 17, r = Math.hypot(dx, dy); if (r > 16.5) continue; const z = Math.round(2 + r * r / 60); V.set(x, y + 6, z, (Math.round(r) % 4 === 0 || x === 17) ? shade(c, .85) : c); }
  line(V, 17, 23, 3, 17, 23, 13, GALV, 2); for (const [x, y] of [[5, 11], [29, 11], [17, 38]]) line(V, x, y, 7, 17, 23, 13, GALV, 2); V.box(16, 22, 13, 19, 25, 15, INK);
  return done(V, 'dish'); });
// ground-mounted dish on a short post (the usual one)
export const smallDish = v => M('sdish' + (v % 2), 'dish', () => { const V = pv(12, 16, 10, 6, 5), c = v % 2 ? WHITE : 0x3a3d45; V.box(5, 0, 4, 7, 9, 6, GALV, 2);
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) { const r = Math.hypot(x + .5 - 6, y + .5 - 6); if (r > 5.5) continue; V.set(x, y + 4, Math.round(6 + r * r / 20), c); } line(V, 6, 9, 6, 6, 9, 1, GALV, 2); V.box(5, 8, 0, 7, 10, 2, INK); return done(V, 'dish'); });
// utility pedestal: the meter post at the back of every pad (the pad's electric)
export const pedestal = () => M('pedestal', 'meter', () => { const V = pv(4, 12, 3); V.box(1, 0, 1, 3, 12, 3, GALV, 2); V.box(0, 6, 0, 4, 10, 3, 0x9a9ca4, 2); V.box(1, 7, 0, 3, 9, 1, 0xeaf6ff, 1); return done(V, 'meter'); });
// a mailbox on a post, the pad number on its flank (a different build per style)
export const mailbox = (n, style) => M('mail' + n + style, 'mailbox', () => { const s = .05, V = pv(13, 26, 18, 5, 9, s), c = [0x17171b, 0xf2f2ee, 0x2f5bff, 0x25b84c, 0xe8232a][style % 5], lab = String(n), w = tw(lab);
  if (style % 3 === 2) { V.box(3, 0, 7, 7, 16, 11, WD); for (let k = 0; k < 4; k++) V.box(2 - (k & 1), 3 + k * 3, 6, 8 + (k & 1), 4 + k * 3, 12, WDD); } else V.box(4, 0, 8, 6, 17, 10, style % 3 ? GALV : WDD);
  V.box(1, 16, 1, 9, 25, 17, c); V.box(0, 20, 12, 1, 26, 13, 0xe8232a);                                     // the box, its flag (−x flank)
  const z0 = 9 - (w >> 1); V.box(9, 16, z0 - 1, 10, 25, z0 + w + 1, style % 5 === 1 ? INK : WHITE); txtX(V, lab, z0, 23, 10, style % 5 === 1 ? WHITE : INK, 0, 1);   // the pad number on the +x flank
  return done(V, 'mailbox'); });
// the above-ground pool (Pad 47): a round steel wall with its rim and posts, blue water with a float or two, the A-frame ladder
export const pool = () => M('agpool', 'pool', () => { const R = 19.5, V = pv(44, 16, 44, 22, 22), c = 22;
  ring(V, c, c, R - 1.2, R, 0, 11, (x, y, z) => { const a = Math.atan2(z - c, x - c), post = Math.abs(((a / Math.PI * 12) % 1 + 1) % 1 - .5) < .07; return post ? 0xdfe3ea : y > 7 ? 0x3fa9f5 : 0x2f5bff; }, 0);
  ring(V, c, c, R - 1.8, R + .6, 11, 12, 0xf2f2ee); cyl(V, c, c, R - 1.2, 0, 9, 0x2a7fd0); cyl(V, c, c, R - 1.2, 9, 10, (x, y, z) => hash(x >> 1, z >> 1, 9) > .93 ? 0xeaf6ff : 0x3fc8ff, TOD.night ? 3 : 1);
  // a pink flamingo float and a yellow ring on the water
  ring(V, c - 7, c + 4, 1.5, 3.4, 10, 11, 0xffe23a); V.box(c + 3, 10, c - 6, c + 9, 11, c - 3, 0xff4fa3); V.box(c + 7, 11, c - 5, c + 8, 14, c - 4, 0xff4fa3); V.box(c + 7, 13, c - 5, c + 9, 14, c - 4, 0xff4fa3);
  // the ladder: two rails up and over the rim at the front
  for (const x of [c - 2, c + 2]) { for (let y = 0; y < 14; y++) V.set(x, y, c + R + 1 - Math.max(0, y - 12), 0xdfe3ea, 2); V.box(x, 12, c + R - 2, x + 1, 14, c + R + 1, 0xdfe3ea, 2); }
  for (let y = 2; y < 12; y += 3) V.box(c - 2, y, c + R + 1, c + 3, y + 1, c + R + 2, 0xdfe3ea, 2);
  return done(V, 'pool'); });
export const lounger = c => M('lounger' + c, 'chair', () => { const V = pv(8, 7, 20, 4, 10); for (const [x, z] of [[0, 1], [7, 1], [0, 18], [7, 18]]) V.box(x, 0, z, x + 1, 3, z + 1, 0xf2f2ee);
  V.box(0, 3, 1, 8, 4, 19, (x, y, z) => (z & 1) ? c : 0xf2f2ee); for (let k = 0; k < 4; k++) V.box(0, 4 + k, 19 - k - 1, 8, 5 + k, 19 - k, (x, y, z) => (z & 1) ? c : 0xf2f2ee); return done(V, 'chair'); });
// the giant pink flamingo (3 m, fibreglass, the yard gag of lane 1)
export const bigFlamingo = () => M('bigflamingo', 'giant-flamingo', () => { const V = pv(16, 32, 20, 8, 10), P = 0xff4fa3, L = 0xffb0cf;
  V.box(3, 0, 6, 13, 1, 14, 0x9a9ca4); for (const x of [6, 9]) V.box(x, 1, 9, x + 1, 13, 10, L); V.box(5, 12, 9, 11, 13, 10, L);
  V.ell(8, 16, 9, 5, 4, 7, P); V.box(6, 18, 2, 10, 20, 5, P); for (let y = 18; y < 28; y++) V.box(7, y, 13 + Math.round(Math.sin((y - 18) / 3) * 1.5), 9, y + 1, 15 + Math.round(Math.sin((y - 18) / 3) * 1.5), P);
  V.box(6, 27, 12, 10, 30, 16, P); V.box(7, 26, 16, 9, 28, 19, 0xf7f7f2); V.box(7, 25, 18, 9, 27, 19, PAL.ink); V.set(6, 29, 14, PAL.ink); V.set(9, 29, 14, PAL.ink); return done(V, 'giant-flamingo'); });
// the psychic's palm: a big purple hand on a pole with an eye in it (lit at night), stars round it
export const palmSign = () => M('palmsign', 'giant-palm', () => { const V = pv(24, 50, 6, 12, 3), H = 0x7a3cff, lt = TOD.night ? 3 : 0;
  V.box(11, 0, 2, 13, 26, 4, PAL.iron); V.box(9, 0, 1, 15, 1, 5, 0x9a9ca4);
  V.box(5, 26, 1, 19, 40, 4, H, lt); for (const [x, h] of [[5, 7], [8, 9], [11, 10], [14, 9]]) V.box(x, 40, 1, x + 3, 40 + h, 4, H, lt); V.box(17, 30, 1, 22, 34, 4, H, lt); V.box(19, 34, 1, 22, 38, 4, H, lt);
  V.ell(12, 33, 4, 4, 2.6, 1, 0xf7f7f2, lt); V.ell(12, 33, 4.2, 1.6, 1.6, 1, 0x2de2e6, lt); V.set(12, 33, 5, PAL.ink);
  return done(V, 'giant-palm'); });
// what got dragged out back: a lumpy pile under a tarp, tyres holding it down; a pickup's camper shell left on cinder blocks
export const tarpPile = c => M('tarppile' + c, 'junk', () => { const V = pv(18, 9, 14, 9, 7);
  for (let x = 0; x < 18; x++) for (let z = 0; z < 14; z++) { const d = Math.hypot((x + .5 - 9) / 9, (z + .5 - 7) / 7); if (d > 1) continue; const hgt = Math.max(1, Math.round((1 - d * d) * 6 + (hash(x >> 1, z >> 1, 3) - .5) * 2));
    for (let y = 0; y < hgt; y++) V.set(x, y, z, y === hgt - 1 ? (hash(x >> 2, z >> 2, 5) > .85 ? shade(c, .82) : c) : 0x5a4a3a); }
  for (const [x, z] of [[3, 4], [13, 9]]) { let y = 0; while (V.has(x, y, z)) y++; ring(V, x, z, 1.2, 2.6, y - 1, y + 1, 0x1b1b20); }
  return done(V, 'junk'); });
export const camperShell = c => M('shell' + c, 'junk', () => { const V = pv(20, 12, 16, 10, 8);
  for (const [x, z] of [[1, 1], [16, 1], [1, 12], [16, 12]]) V.box(x, 0, z, x + 3, 2, z + 3, 0xb8b3a8);
  V.box(0, 2, 0, 20, 10, 16, c); V.box(1, 10, 1, 19, 11, 15, shade(c, .9)); V.box(2, 5, 0, 18, 9, 1, 0x9fd8ff, 1); V.box(2, 5, 15, 18, 9, 16, 0x9fd8ff, 1); for (const x of [0, 19]) V.box(x, 5, 3, x + 1, 9, 13, 0x9fd8ff, 1);
  V.box(0, 2, 0, 20, 3, 16, 0x3a3d45); return done(V, 'junk'); });
