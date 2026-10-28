// MAINLAND v1 · everything built that is not a house or the ground (worker-safe): candidate A's arrival (the pier, the WELCOME TO THE
// MAINLAND arch, SECOND CHANCE with her new top deck, the teal terminal), Harbor Rd's dressing, the bus stops, the street blades, both
// courts' islands, trees and corner details, the seawall surf, the frontier's trees; and the far tier (the island across the water,
// the tree lines past the map) as a second task.
import { Vol, Bank, meshVol, stampA, boxInto } from '../vox.js';
import { frame } from '../kit.js';
import { PAL, CV, hash, shade } from '../style.js';
import { TOD } from '../kit.js';
import { ferry } from './ferry.js';
import { gull, bollard } from '../districts/jail/lib.js';
import { bench, hydrant, newsBox, picnic } from '../props.js';
import { tree as tree0, bin, planter, garden, barn, birdbath } from '../districts/suburbs/props.js';
// (MAINLAND LAWNS: every tree put down is recorded, so the lawn map can shade the grass under it and drop its leaves)
const TREEOF = new Map(), tree = (sp, size = 0, v = 0, curb = false) => { const b = tree0(sp, size, v, curb); TREEOF.set(b, [sp, size]); return b; };
import { vehicleProp } from '../vehicles/index.js';

export const LAWN = .2, WATER = -.9, HX = 12, TEAL = 0x12b3a0, TRIM = 0xfffaf0, INK = PAL.ink;
const lit = (day = 0) => TOD.night ? 3 : day, rad = d => d * Math.PI / 180;
const vol = (x0, y0, z0, x1, y1, z1, s = CV) => { const V = new Vol(Math.round((x1 - x0) / s), Math.round((y1 - y0) / s), Math.round((z1 - z0) / s), { s, org: [x0, y0, z0], ground: true });
  const q = m => Math.round(m / s); return { V, s, box: (a, b, c, d, e, f, col, l = 0) => V.box(q(a - x0), q(b - y0), q(c - z0), q(d - x0), q(e - y0), q(f - z0), col, l), face: (a, c, d, f, side) => frame(V, { x0: q(a - x0), x1: q(d - x0), z0: q(c - z0), z1: q(f - z0) }, side) }; };
const segD = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const polyD = (px, pz, P) => { let d = 1e9; for (let k = 0; k + 1 < P.length; k++) d = Math.min(d, segD(px, pz, P[k], P[k + 1])); return d; };
// the street-name blades: one blade along each street, sized to its name
function blades(WB, x, z, alongX, alongZ) {
  const w = s => Math.max(2.6, (s.length * 6 + 6) * .05), wx = w(alongX), wz = w(alongZ), S = vol(x - wx / 2 - .2, 0, z - wz / 2 - .2, x + wx / 2 + .2, 3.8, z + wz / 2 + .2, .05);
  S.box(x - .05, 0, z - .05, x + .05, 3.5, z + .05, 0x1f5c4a);
  S.box(x - wx / 2, 2.5, z - .05, x + wx / 2, 3.0, z + .05, 0x14a83b); S.box(x - .05, 3.0, z - wz / 2, x + .05, 3.5, z + wz / 2, 0x14a83b);
  const cx = Math.round(wx / 2 / .05), cz = Math.round(wz / 2 / .05);
  for (const f of [S.face(x - wx / 2, z - .05, x + wx / 2, z + .05, '+z'), S.face(x - wx / 2, z - .05, x + wx / 2, z + .05, '-z')]) f.text(alongX, cx, 58, 0, 1, TRIM, 0, 1, 1);
  for (const f of [S.face(x - .05, z - wz / 2, x + .05, z + wz / 2, '-x'), S.face(x - .05, z - wz / 2, x + .05, z + wz / 2, '+x')]) f.text(alongZ, cz, 68, 0, 1, TRIM, 0, 1, 1);
  const bk = new Bank(true); meshVol(S.V, bk); stampA(bk, WB, 0, 0, LAWN, 0); }
// a bus stop shelter (built facing −x, then turned): glass, teal posts, a bench, the ad panel, the stop flag
function busStop(WB, x, z, ang, ad) {
  const S = vol(-1.25, 0, -2.75, 1.25, 3.2, 2.75), X = 0;
  S.box(.85, .0, -2.55, 1.15, 2.5, 2.55, 0xbfeaff, 1); S.box(-1.05, 0, -2.55, 1.15, 2.5, -2.35, 0xbfeaff, 1); S.box(-1.05, 0, 2.35, 1.15, 2.5, 2.55, 0xbfeaff, 1);
  for (const [a, b] of [[-1.05, -2.55], [-1.05, 2.35], [.95, -2.55], [.95, 2.35]]) S.box(a, 0, b, a + .2, 2.6, b + .2, TEAL);
  S.box(-1.25, 2.6, -2.75, 1.25, 2.8, 2.75, TEAL); S.box(-.45, .4, -2.15, .75, .5, 2.15, 0xb07a45);
  S.box(.75, .6, -1.55, .85, 2.3, 1.05, TOD.night ? 0xfff0d0 : ad[1], lit(0)); const g = S.face(.75, -1.55, .85, 1.05, '-x'); g.text(ad[0], 13, 23, 0, 1, INK, 0, 1, 1); g.text(ad[2], 13, 15, 0, 1, INK, 0, 1, 1);
  const bk = new Bank(true); meshVol(S.V, bk); stampA(bk, WB, ang, x, LAWN, z);
  const P = vol(-.35, 0, -.4, .35, 3.4, .4); P.box(-.1, 0, -.1, .1, 2.4, .1, 0x8a9099); P.box(-.3, 2.2, -.05, .3, 3.1, .05, TEAL); const pf = P.face(-.3, -.05, .3, .05, '+z'); pf.text('BUS', 6, 26, 0, 1, TRIM, 0, 1, 1);
  const pb = new Bank(true); meshVol(P.V, pb); const c = Math.cos(ang), s = Math.sin(ang); stampA(pb, WB, ang, x + (-.6) * c + 3.4 * s, LAWN, z - (-.6) * s + 3.4 * c); }

export function buildScene(plan) {
  const WB = new Bank(true), TREES = WB.trees = [], put = (b, x, z, ang = 0, y = LAWN) => { stampA(b, WB, ang, x, y, z); const t = TREEOF.get(b); if (t) TREES.push([+x.toFixed(2), +z.toFixed(2), t[0], t[1]]); }, N = TOD.night;
  const S = id => plan.streets.find(s => s.id === id);
  // ── the seawall face, the surf and the ripples
  boxInto(WB, 0, -2000, WATER - .6, -.35, 2000, .2, 0, 0xcfc9bc);
  for (let k = 0; k < 420; k++) { const x = -160 + hash(k, 1) * 420, z = 2 + hash(k, 2) ** 1.6 * 200, w = .6 + hash(k, 3) * 2.4; boxInto(WB, 0, x, WATER, z, x + w, WATER + .03, z + .2, hash(k, 4) > .5 ? 0xf4f8fb : 0xdcecf6); }
  for (let x = -220; x < 290; x += 1.1) { const w = .4 + hash(x * 10 | 0, 9) * .7; boxInto(WB, 0, x, WATER, .02, x + w, WATER + .05, .3 + hash(x * 10 | 0, 8) * .5, 0xf4f8fb); }
  // ── THE PIER + THE WELCOME ARCH (candidate A's)
  { const P = vol(-11, WATER - .6, -.4, -1, 6.2, 31);
    P.box(-9, .0, -.4, -3, .2, 30, (x, y, z) => (z % 4 === 0) ? 0xa57a4b : 0xc49563);
    for (let z = 1; z < 30; z += 3) for (const x of [-9, -3.4]) P.box(x, WATER - .6, z, x + .4, 0, z + .4, 0x6e4a2c);
    P.box(-9, .2, 0, -8.8, 1.2, 30, (x, y, z) => y === 11 || z % 20 === 0 ? TRIM : undefined); P.box(-9, 1.1, 0, -8.8, 1.2, 30, TRIM);
    for (const x of [-9.4, -2.7]) { P.box(x, .2, .6, x + .5, 5.0, 1.1, TEAL); P.box(x - .1, .2, .5, x + .6, .6, 1.2, TRIM); }
    P.box(-10.6, 4.9, .6, -1.4, 5.2, 1.5, TEAL); P.box(-10.4, 3.0, 1.1, -1.6, 4.9, 1.4, 0xffe23a);
    const f = P.face(-10.4, 1.1, -1.6, 1.4, '+z'), fb = P.face(-10.4, 1.1, -1.6, 1.4, '-z'); f.text('WELCOME TO', 44, 62, 0, 1, INK, 0, 1, 1); f.text('THE MAINLAND', 44, 53, 0, 1, 0xe8232a, 0, 1, 1); fb.text('BON VOYAGE', 44, 58, 0, 1, INK, 0, 1, 1);
    P.box(-6.2, 5.2, .9, -5.8, 5.9, 1.2, 0xff4fa3); P.box(-6.3, 5.9, .85, -5.7, 6.0, 1.25, 0xffe23a);
    P.box(-3.0, .1, 14.4, -2.5, .2, 16.6, 0x8a9099); P.box(-3.0, .2, 14.4, -2.5, 1.1, 14.5, TRIM); P.box(-3.0, .2, 16.5, -2.5, 1.1, 16.6, TRIM);
    meshVol(P.V, WB);
    for (const z of [4, 10, 22, 28]) put(bollard(0xffc21a), -3.4, z, 0, .2);
  }
  stampA(ferry(), WB, Math.PI, 1.8, WATER - .8, 15.5);
  put(gull(0), -3.2, 6.5, .5, .3); put(gull(1), -9.1, 13, 2, 1.25); put(gull(2, true), 6, 6, 1.2, 7.5); put(gull(0, true), -14, 12, -.4, 9); put(gull(1, true), 30, 14, 2.2, 11);
  // ── THE FERRY TERMINAL (candidate A's: white clapboard, teal trim, the clock cupola, MAINLAND FERRY, TICKETS, the departures board)
  { const x0 = -15, x1 = 2, z0 = -21, z1 = -10, T = vol(x0 - 2, 0, z0 - 2, x1 + 2, 14, z1 + 4), WH = 0xf4f1ea;
    T.box(x0, 0, z0, x1, 5.2, z1, (x, y) => y < 4 ? 0xb9b3a8 : y % 3 === 0 ? 0xe6e1d6 : WH);
    { let y = 5.2, a = z0 - .4, b = z1 + .4, k = 0; while (b - a > .2) { T.box(x0 - .3, y, a, x1 + .3, y + .1, Math.min(b, a + .3), k === 0 ? TEAL : (k & 1 ? 0x6d707a : 0x62656f)); T.box(x0 - .3, y, Math.max(a, b - .3), x1 + .3, y + .1, b, k === 0 ? TEAL : (k & 1 ? 0x6d707a : 0x62656f)); T.box(x0, y, a + .3, x1, y + .1, b - .3, WH); y += .1; a += .2; b -= .2; k++; } }
    const f = T.face(x0, z0, x1, z1, '+z');
    f.box(0, 36, 0, 170, 48, 2, TEAL); f.text('MAINLAND FERRY', 85, 45, 1, 3, TRIM, 0, 1, 1);
    f.box(58, 2, 0, 112, 33, 2, TRIM); f.box(60, 2, -2, 110, 32, 2, (a, y) => ((a - 60) % 10 === 0 || y === 20) ? TEAL : (N ? (y > 20 ? PAL.litHi : PAL.litLo) : (y > 18 ? PAL.glassHi : PAL.glassLo)), N ? 3 : 1);
    f.box(78, 2, -3, 92, 26, -2, 0x1b2a55, 1);
    f.box(122, 9, 0, 168, 32, 3, TEAL); f.box(125, 11, -1, 165, 22, 3, N ? PAL.litLo : 0x3f6bc4, N ? 3 : 1); f.box(124, 22, 0, 166, 31, 3, 0xffe23a); f.text('TICKETS', 145, 30, 3, 4, INK, 0, 1, 1);
    f.box(122, 9, 3, 168, 10, 8, TRIM);
    f.box(10, 11, 0, 52, 31, 2, INK); f.text('FERRY', 31, 29, 2, 3, 0xffc21a, N ? 3 : 0, 1, 1); f.text('20 MIN', 31, 20, 2, 3, 0x6cff4a, N ? 3 : 0, 1, 1);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; T.box(cx - 1.2, 6.8, cz - 1.2, cx + 1.2, 8.8, cz + 1.2, TEAL); T.box(cx - 1.5, 8.8, cz - 1.5, cx + 1.5, 9.0, cz + 1.5, TRIM);
    for (let k = 0; k < 9; k++) T.box(cx - 1.4 + k * .15, 9 + k * .15, cz - 1.4 + k * .15, cx + 1.4 - k * .15, 9.15 + k * .15, cz + 1.4 - k * .15, k & 1 ? 0x62656f : 0x6d707a);
    T.box(cx - .05, 10.3, cz - .05, cx + .05, 12.2, cz + .05, INK); T.box(cx + .05, 11.6, cz - .02, cx + 1.1, 12.1, cz + .02, 0xff4fa3);
    for (const side of ['+z', '-z', '+x', '-x']) { const c = T.face(cx - 1.2, cz - 1.2, cx + 1.2, cz + 1.2, side); c.box(5, 72, 0, 19, 86, 1, TRIM, lit(0)); c.box(11, 79, 1, 12, 85, 2, INK); c.box(12, 79, 1, 17, 80, 2, INK); c.box(4, 71, 0, 20, 72, 1, INK); }
    meshVol(T.V, WB);
    for (const x of [-12, -8.5]) put(bench(), x, -8.6, 0);
    put(newsBox(0xe8232a), -2.8, -9.3); put(bin(0x2f7a3a), 3.2, -9.4);
    put(tree('oak', 2, 1), -21, -16); put(tree('maple', 1, 0), -28, -22); put(tree('oak', 1, 2), -19, -26); put(tree('birch', 1, 1), -38, -36); put(tree('oak', 2, 0), -4, -36);
  }
  // ── the fishing kid on the seawall (candidate A's), and a bench
  { const T = vol(13.4, 0, -1.6, 14.4, 1.9, -.6); T.box(13.8, .2, -1.2, 14.0, 1.2, -1.0, 0x8a9099); T.box(13.55, 1.2, -1.45, 14.25, 1.6, -.75, 0x14a83b); T.box(13.6, 1.3, -.75, 13.8, 1.5, -.65, INK); T.box(14.0, 1.3, -.75, 14.2, 1.5, -.65, INK); T.box(13.5, .2, -1.4, 14.3, .3, -.8, 0x8a9099); meshVol(T.V, WB); }
  put(bench(), 24.5, -2.2, Math.PI); put(bench(), 60, -2.2, Math.PI); put(bench(), 150, -2.2, Math.PI);
  // ── HARBOR RD (the built end): street trees in the verge, hydrants, the bus stop, the ice cream truck, a parked sedan
  const cross = [[-44, 1], [-72, -1], [-96, 1]];   // [z, side (+1 east)] of the side streets
  for (let z = -24; z > -112; z -= 12) for (const sd of [-1, 1]) { if (cross.some(([cz, s]) => s === sd && Math.abs(z - cz) < 9) || (sd === 1 && z > -38 && z < -24)) continue; put(tree(sd < 0 ? 'oak' : 'maple', 1, (z * 7 + sd) & 3, true), HX + sd * 4.8, z - (sd > 0 ? 6 : 0)); }
  put(hydrant(), HX + 4.7, -30.5); put(hydrant(), HX - 4.7, -66); put(hydrant(), 44, -91.4);
  busStop(WB, HX + 5.7, -31, 0, ['SPF', 0xff4fa3, '50']);
  put(vehicleProp('icecream', { variant: 0, driver: true, night: N, kind: 'truck' }), HX - 2.8, -19.5, 0, 0);
  put(vehicleProp('sedan', { variant: 2, kind: 'car' }), HX + 2.9, -58, Math.PI, 0);
  put(vehicleProp('pickup', { variant: 2, kind: 'car' }), 104, -41.3, Math.PI / 2, 0);
  blades(WB, HX + 5.8, -44 + 5.8, 'BAYVIEW DR', 'HARBOR RD'); blades(WB, HX + 5.8, -96 + 5.8, 'SUNNY CT', 'HARBOR RD'); blades(WB, HX - 5.8, -72 + 5.8, 'WILLOW BEND', 'HARBOR RD');
  blades(WB, HX + 5.8, -190 + 5.8, 'JUNIPER WAY', 'HARBOR RD'); blades(WB, HX - 5.8, -190 - 5.8, 'JUNIPER WAY', 'HARBOR RD'); blades(WB, 150 - 5.8, -44 - 5.8, 'BAYVIEW DR', 'ORCHARD LN');
  blades(WB, 150 + 5.8, -190 + 5.8, 'JUNIPER WAY', 'ORCHARD LN'); blades(WB, HX + 5.8, -258 + 5.8, 'CLOVER CT', 'HARBOR RD');
  // the frontier's bus stops: the route is already running out here
  busStop(WB, 38, -190 - 5.7, -Math.PI / 2, ['NEW', 0xffe23a, 'LOTS']); busStop(WB, 118, -44 + 5.7, Math.PI / 2, ['SPF', 0x3fa9f5, '50']);
  // ── SUNNY CT: street trees down the stem (oak and maple), the pink blossom on the island with a flower ring, the pocket park
  { const st = S('sunny').pts, B = S('sunny-bulb').bulb;
    for (let k = 3; k < st.length - 3; k += 4) { const [ax, az] = st[k], [bx, bz] = st[k + 1], dx = bx - ax, dz = bz - az, n = Math.hypot(dx, dz), nx = -dz / n, nz = dx / n;
      for (const sd of [1, -1]) put(tree(k % 8 === 3 ? 'maple' : 'oak', 1, (k + sd) & 3, true), ax + nx * 4.8 * sd, az + nz * 4.8 * sd); }
    put(tree('ornamental', 2, 1), B[0], B[1]); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; put(planter(0xf4f1ea, [0xff4fa3, 0xffe23a][k & 1]), B[0] + Math.sin(a) * 3.2, B[1] + Math.cos(a) * 3.2); }
    for (const a of [35, 125, 215]) put(tree('maple', 1, a & 3, true), B[0] + Math.sin(rad(a)) * 14.3, B[1] + Math.cos(rad(a)) * 14.3);
    // the pocket park on the south corner: A's picnic table, a bench, shade trees, a birdbath
    for (const [x, z, sp, sz, v] of [[24, -76, 'oak', 2, 0], [30, -86, 'maple', 1, 1], [21, -86, 'birch', 1, 2]]) put(tree(sp, sz, v), x, z);
    put(picnic(0xe8232a), 27, -80, .3); put(bench(), 24.5, -87.6, Math.PI + .1); put(birdbath(), 31, -76.5); }
  // ── WILLOW BEND: birch and red maple down the bend; the village green inside the loop (the big willow, the white gazebo, benches,
  //    a gravel ring); the corner inside the bend: the neighbours' mailbox kiosk, a little free library, a bench, a community garden
  { const st = S('willow').pts, Lp = S('willow-loop').loop;
    for (let k = 3; k < st.length - 2; k += 5) { const [ax, az] = st[k], [bx, bz] = st[k + 1], dx = bx - ax, dz = bz - az, n = Math.hypot(dx, dz), nx = -dz / n, nz = dx / n;
      for (const sd of [1, -1]) put(tree(k % 10 === 3 ? 'birch' : 'redmaple', 1, (k + sd) & 3, true), ax + nx * 4.8 * sd, az + nz * 4.8 * sd); }
    for (let k = 0; k < 7; k++) { const t = rad(35 + k * 48), x = Lp.c[0] + Math.cos(t) * (Lp.rx + 4.8), z = Lp.c[1] + Math.sin(t) * (Lp.rz + 4.8); put(tree(k & 1 ? 'birch' : 'redmaple', 1, k & 3, true), x, z); }
    const [gx, gz] = Lp.c; put(tree('willow', 2, 1), gx - 5.5, gz + .5);
    const G = vol(gx + 1, 0, gz - 3.4, gx + 8, 5.4, gz + 3.4), c = [gx + 4.5, gz];                                                    // the gazebo: octagon-ish deck, posts, a two-step roof, a finial
    G.box(c[0] - 2.6, 0, c[1] - 2.6, c[0] + 2.6, .4, c[1] + 2.6, (x, y, z) => (x + z) % 3 === 0 ? 0xe6e1d6 : 0xf4f1ea); G.box(c[0] - 2.8, 0, c[1] - .6, c[0] - 2.6, .2, c[1] + .6, 0xe6e1d6);
    for (const [a, b] of [[-2.3, -2.3], [2.1, -2.3], [-2.3, 2.1], [2.1, 2.1], [-2.4, -.1], [2.2, -.1], [-.1, -2.4], [-.1, 2.2]]) G.box(c[0] + a, .4, c[1] + b, c[0] + a + .2, 3.0, c[1] + b + .2, TRIM);
    for (let k = 0; k < 8; k++) G.box(c[0] - 2.9 + k * .3, 3.0 + k * .22, c[1] - 2.9 + k * .3, c[0] + 2.9 - k * .3, 3.22 + k * .22, c[1] + 2.9 - k * .3, k === 0 ? TRIM : k & 1 ? 0x2a9a8a : TEAL);
    G.box(c[0] - .1, 4.8, c[1] - .1, c[0] + .1, 5.3, c[1] + .1, 0xe7bd4a, 2); G.box(c[0] - 2.3, 1.0, c[1] - 2.3, c[0] + 2.3, 1.1, c[1] - 2.2, TRIM); G.box(c[0] - 2.3, 1.0, c[1] + 2.2, c[0] + 2.3, 1.1, c[1] + 2.3, TRIM);
    meshVol(G.V, WB); put(bench(), gx - 1.5, gz - 6.3, 0); put(bench(), gx - 1.5, gz + 6.3, Math.PI); put(birdbath(), gx + .5, gz - 2.5);
    // the corner inside the bend: the mailbox kiosk (a teal roof over the cluster box), the little free library, a bench, the garden
    const kx = -2, kz = -84.5, K = vol(kx - 2, 0, kz - 1.2, kx + 2, 3.2, kz + 1.2);
    K.box(kx - 1.3, 0, kz - .35, kx + 1.3, 1.7, kz + .35, 0xd3d4d7); for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) K.box(kx - 1.2 + a * .5, .4 + b * .42, kz + .35, kx - .8 + a * .5, .74 + b * .42, kz + .4, b === 2 && a === 4 ? 0xe7bd4a : 0xbfc2c8);
    for (const x of [kx - 1.6, kx + 1.4]) K.box(x, 0, kz - .1, x + .2, 2.4, kz + .1, TRIM); K.box(kx - 1.9, 2.4, kz - .9, kx + 1.9, 2.55, kz + .9, TEAL); K.box(kx - 1.6, 2.55, kz - .6, kx + 1.6, 2.7, kz + .6, TEAL);
    const kf = K.face(kx - 1.9, kz - .9, kx + 1.9, kz + .9, '+z'); kf.box(4, 26, 1, 34, 27, 2, TRIM);
    meshVol(K.V, WB);
    const Lb = vol(kx + 3, 0, kz - .6, kx + 4.4, 2.2, kz + .6); Lb.box(kx + 3.6, 0, kz - .05, kx + 3.8, 1.2, kz + .05, 0x7a4a22); Lb.box(kx + 3.2, 1.2, kz - .35, kx + 4.2, 1.9, kz + .35, 0xe8232a);
    Lb.box(kx + 3.3, 1.3, kz + .35, kx + 4.1, 1.8, kz + .4, N ? PAL.litLo : 0xbfeaff, N ? 3 : 1); for (let k = 0; k < 4; k++) Lb.box(kx + 3.35 + k * .18, 1.3, kz, kx + 3.48 + k * .18, 1.62, kz + .3, [0x2f5bff, 0xffc21a, 0x14a83b, 0xff4fa3][k]);
    Lb.box(kx + 3.1, 1.9, kz - .45, kx + 4.3, 2.0, kz + .45, INK); meshVol(Lb.V, WB);
    put(bench(), kx - 4, kz + .6, 0); put(tree('redmaple', 2, 0), kx - 6.5, kz - 4); put(tree('birch', 1, 2), kx + 2, kz - 9);
    for (const [x, z, v] of [[-3, -96, 0], [.6, -96, 1], [-3, -99, 1], [.6, -99, 0]]) put(garden(v), x, z); put(barn(0xe6e1d6, 1), 2.8, -104, -Math.PI / 2); put(tree('redmaple', 1, 1), -6, -108);
  }
  // ── the commons between the built lots: shade trees in clumps (no bare lawn left between the courts), species by court
  { const inQ = (x, z, Q) => { let sg = 0; for (let k = 0; k < 4; k++) { const [ax, az] = Q[k], [bx, bz] = Q[(k + 1) % 4], c = (bx - ax) * (z - az) - (bz - az) * (x - ax); if (!c) continue; if (!sg) sg = Math.sign(c); else if (Math.sign(c) !== sg) return false; } return true; };
    const clear = (x, z) => Math.min(...plan.streets.map(s => s.pts ? polyD(x, z, s.pts) - s.hw : Math.hypot(x - s.bulb[0], z - s.bulb[1]) - s.r));
    const Lp = S('willow-loop').loop, free = (x, z) => clear(x, z) > 4.2 && !plan.plots.some(P => inQ(x, z, P.corners) || Math.hypot(x - P.center[0], z - P.center[1]) < 6) && !(x < 14 && z > -42) && z < -12 &&
      !(x > 18 && x < 34 && z < -70 && z > -90) && !(x > -9 && x < 7 && z < -80 && z > -110) && ((x - Lp.c[0]) / (Lp.rx + 6)) ** 2 + ((z - Lp.c[1]) / (Lp.rz + 6)) ** 2 > 1;
    let n = 0; for (let c = 0; c < 320 && n < 230; c++) { const cx = -120 + hash(c, 81) * 246, cz = -24 - hash(c, 82) * 142; if (cz > -76 && cx > 40) continue; if (!free(cx, cz)) continue;
      const west = cx < 12, SP = west ? ['birch', 'redmaple', 'pine', 'birch', 'maple'] : ['oak', 'maple', 'oak', 'pine', 'birch'];
      for (let k = 0; k < 2 + (hash(c, 83) * 3 | 0); k++) { const x = cx + (hash(c, k + 84) - .5) * 9, z = cz + (hash(c, k + 90) - .5) * 9; if (!free(x, z)) continue; put(tree(SP[(c + k) % 5], 1 + (hash(c, k + 96) > .6), (c + k) & 3), x, z); n++; } } }
  // ── the frontier's standing trees: an old oak or pine left on a few plots, and tree lines where the map runs out
  plan.plots.forEach((P, k) => { if (P.status === 'built' || hash(k, 91) > .28) return; const [cx, cz] = P.center; const sp = ['oak', 'pine', 'maple', 'birch'][(hash(k, 92) * 4) | 0];
    put(tree(sp, 1 + (hash(k, 93) > .5), (k & 3)), cx + (hash(k, 94) - .5) * 8, cz + (hash(k, 95) - .5) * 6); });
  for (let i = 0; i < 160; i++) { const edge = i % 4, t = hash(i, 71); let x, z;
    if (edge === 0) { x = -205 + t * 480; z = -318 - hash(i, 72) * 10; } else if (edge === 1) { x = -205 - hash(i, 72) * 10; z = -30 - t * 290; } else if (edge === 2) { x = 272 + hash(i, 72) * 10; z = -60 - t * 260; } else { x = -205 + t * 480; z = -318 - hash(i, 72) * 10; }
    const near = plan.streets.some(s => s.pts ? polyD(x, z, s.pts) < 9 : Math.hypot(x - s.bulb[0], z - s.bulb[1]) < s.r + 7); if (near) continue;
    put(tree(['oak', 'pine', 'maple', 'oak', 'pine'][i % 5], 1 + (i & 1), i & 3), x, z); }
  return WB;
}

// ── THE FAR TIER: AI City across the water with IRON POINT (candidate A's hand-built silhouette, which holds at distance), the tree lines
// and the far growth past the map (flat land into the haze)
export function buildFar(HOR) {
  const I = new Bank(true), N = TOD.night, air = (c, t) => { const h = HOR, m = s => Math.round(((c >> s) & 255) * (1 - t) + ((h >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
  const CITY = [0xffc21a, 0xef4a2a, 0xff4fa3, 0x7a3cff, 0x3fa9f5, 0x2f5bff, 0x12b3a0, 0xf4f1ea, 0xd3d4d7, 0xa7a9b1, 0x9b4f3a, 0xe6e1d6, 0x6d707a];
  boxInto(I, 0, -330, WATER - .5, 392, 120, 1.6, 520, air(0x9d9686, .2));
  for (let i = 0; i < 90; i++) { const x = -300 + hash(i, 41) * 400, z = 405 + hash(i, 42) * 80, core = Math.exp(-((x + 90) ** 2) / 7000), h = 6 + core * 62 * (.45 + hash(i, 43)) + hash(i, 44) * 10, w = 9 + hash(i, 45) * 16, d = 9 + hash(i, 46) * 12, c = air(hash(i, 49) < .45 ? CITY[7 + ((hash(i, 47) * 6) | 0)] : CITY[(hash(i, 47) * 7) | 0], .12);
    boxInto(I, 0, x - w / 2, 1.6, z - d / 2, x + w / 2, h, z + d / 2, c); if (h > 40) boxInto(I, 0, x - w / 4, h, z - d / 4, x + w / 4, h + 4 + hash(i, 48) * 8, z + d / 4, shade(c, .92));
    if (h > 55) boxInto(I, 0, x - .3, h, z - .3, x + .3, h + 16, z + .3, 0x6d707a);
    if (N) for (let y = 4; y < h - 2; y += 3) for (let u = -w / 2 + 1; u < w / 2 - 1; u += 2.2) if (hash(i * 97 + y, u * 10 | 0) > .55) boxInto(I, 3, x + u, y, z - d / 2 - .1, x + u + 1.1, y + 1.4, z - d / 2, hash(i, y) > .5 ? PAL.litLo : 0xffe3a0); }
  boxInto(I, 0, -64, 22, 404, -36, 34, 406, 0x17171b); boxInto(I, N ? 3 : 0, -62, 23, 403.8, -38, 33, 404, 0xffe23a);
  const lx = -70, lz = 262; boxInto(I, 0, lx - 16, WATER - .5, lz - 8, lx + 20, 2.2, lz + 12, 0x8e9299); boxInto(I, 0, lx - 8, 2.2, lz - 4, lx + 12, 3.4, lz + 8, 0x7b8088);
  for (let k = 0; k < 7; k++) boxInto(I, 0, lx - 1.8 + k * .1, 3.4 + k * 3, lz - 1.8 + k * .1, lx + 1.8 - k * .1, 6.4 + k * 3, lz + 1.8 - k * .1, k & 1 ? 0xe8232a : 0xf4f1ea);
  boxInto(I, 0, lx - 2.2, 24.4, lz - 2.2, lx + 2.2, 24.8, lz + 2.2, INK); boxInto(I, N ? 3 : 1, lx - 1.1, 24.8, lz - 1.1, lx + 1.1, 26.8, lz + 1.1, N ? 0xfff1b0 : 0xffe3a0); boxInto(I, 0, lx - 1.4, 26.8, lz - 1.4, lx + 1.4, 27.6, lz + 1.4, 0xe8232a);
  boxInto(I, 0, lx + 16, 1.6, lz + 14, lx + 70, 9, lz + 16, air(0xd3d4d7, .2)); boxInto(I, 0, lx + 26, 1.6, lz + 18, lx + 60, 14, lz + 40, air(0xa7a9b1, .2)); boxInto(I, 0, lx + 64, 1.6, lz + 10, lx + 70, 17, lz + 16, air(0xe6e1d6, .2)); boxInto(I, 0, lx + 63, 17, lz + 9, lx + 71, 19, lz + 17, air(0xff7a1a, .2));
  // far tree clumps past the map, north, east and west, into the haze
  const ftree = (x, z, k) => { const h = 4 + hash(k, 37) * 5, r = 2.2 + hash(k, 38) * 1.6, c = [0x2fbf55, 0x1d8f3c, 0x25a748, 0x46d466][k % 4]; boxInto(I, 0, x - .5, .2, z - .5, x + .5, h, z + .5, 0x7a4a22); boxInto(I, 0, x - r, h - .5, z - r, x + r, h + r * 1.4, z + r, c); boxInto(I, 0, x - r * .6, h + r * 1.4, z - r * .6, x + r * .6, h + r * 1.9, z + r * .6, shade(c, 1.08)); };
  for (let c = 0; c < 70; c++) { const x = -560 + hash(c, 31) * 1200, z = -350 - hash(c, 32) * 420; for (let k = 0; k < 4; k++) ftree(x + (hash(c, k + 40) - .5) * 26, z + (hash(c, k + 50) - .5) * 20, c * 7 + k); }
  for (let c = 0; c < 44; c++) { const sd = c & 1 ? 1 : -1, x = sd > 0 ? 305 + hash(c, 34) * 240 : -235 - hash(c, 34) * 240, z = -24 - hash(c, 35) * 320; for (let k = 0; k < 3; k++) ftree(x + (hash(c, k + 60) - .5) * 22, z + (hash(c, k + 70) - .5) * 22, c * 5 + k); }
  return I;
}
