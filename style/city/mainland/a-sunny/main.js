// AI CITY · THE MAINLAND · DIRECTION A — "Sunny Springfield cul-de-sac" (design candidate, 2026-09-29)
// A vignette on its own page: the ferry dock you step off at, Harbor Rd with the ice cream truck and the bus stop, SUNNY COURT (a
// curving cul-de-sac, six houses on pie lots round a bulb with a blossom tree in its island, two lots up for grabs), and AI City's
// skyline + the jail lighthouse across the water. Reuses the city's modules read-only (vox, kit, style, suburbs props, vehicles,
// the sea kit's ferry, chars.js); nothing in the city is edited.
// URL: ?tod=night · ?view=arrive|above|street|house|island|night · ?cam=x,y,z&look=x,y,z&fov=n · ?shot=1 (no UI)
import * as THREE from 'three';
import { Vol, Bank, meshVol, stampA, boxInto } from '../../vox.js';
import { geoOf } from '../../glue.js';
import { frame, TOD } from '../../kit.js';
import { PAL, CV, hash, shade } from '../../style.js';
import { build, pose, LOOKS, rollLook, S as CS } from '../../cast.js';
import { createSky } from '../../render/sky.js';

const Q = new URLSearchParams(location.search), NIGHT = Q.get('tod') === 'night';
TOD.night = NIGHT;
const { buildLot, LAWN, SHERBET } = await import('./houses.js');
const { ferry } = await import('../../districts/sea/boats.js');
const { gull, bollard } = await import('../../districts/jail/lib.js');
const { lampPost, bench, hydrant, newsBox, bike, picnic } = await import('../../props.js');
const { tree, lantern, bin } = await import('../../districts/suburbs/props.js');
const { vehicleProp } = await import('../../vehicles/index.js');
if (Q.has('shot')) document.body.classList.add('shot');

// ── renderer, sky, fog, light (STYLE §3–4 numbers; the fade is THREE.Fog in exactly the horizon colour)
const W = innerWidth, H = innerHeight, renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(W, H); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(), sky = createSky({ scene });
const TOP = NIGHT ? PAL.nightTop : PAL.sky, HOR = NIGHT ? PAL.nightHor : PAL.horizon;
sky.U.top.value.setHex(TOP); sky.U.hor.value.setHex(HOR); sky.U.gnd.value.setHex(HOR);
if (NIGHT) { sky.U.cityP.value.set(.55, 70, 0, 1); sky.U.glowC.value.setHex(0xff8a3d); }   // the island's sodium glow on the southern horizon
scene.fog = new THREE.Fog(HOR, 110, 560);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(sky.envScene, .02).texture; scene.environmentIntensity = NIGHT ? .2 : .55; }
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
scene.add(sun, sun.target); scene.add(new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
const MAT = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
const addBank = (b, shadow = true) => b.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), MAT[li]); m.castShadow = shadow && li !== 3; m.receiveShadow = true; scene.add(m); });
const WB = new Bank(true), FAR = new Bank(true);
const put = (b, x, z, ang = 0, y = LAWN) => stampA(b, WB, ang, x, y, z);

// ── the plan (metres; +z is south, toward the water and the island)
const WATER = -0.9, HX = 12, B = { x: 80, z: -84 }, RB = 13;                       // Harbor Rd centreline x; the bulb and its asphalt radius
const bez = (t, P0, P1, P2) => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
const COURT = Array.from({ length: 29 }, (_, k) => bez(k / 28, [HX, -62], [60, -62], [70, -76]));
const segD = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const polyD = (px, pz, P) => { let d = 1e9; for (let k = 0; k + 1 < P.length; k++) d = Math.min(d, segD(px, pz, P[k], P[k + 1])); return d; };
const rad = d => d * Math.PI / 180;
const bulbLot = (phi, kind) => { const d = [Math.sin(rad(phi)), Math.cos(rad(phi))]; return { kind, x: B.x + d[0] * 16.4, z: B.z + d[1] * 16.4, ang: Math.atan2(-d[0], -d[1]) }; };
const LOTS = [
  { kind: 'ranch', x: 29.5, z: -69.4, ang: 0, drive: [3.6, 9] },
  { kind: 'porch', x: 52.5, z: -73.2, ang: 0, drive: [5.5, 9] },
  { ...bulbLot(210, 'cape'), drive: [7, 10] },
  { ...bulbLot(150, 'trophy'), drive: [4.6, 9.2] },
  { ...bulbLot(90, 'springfield'), drive: [3.1, 8.6] },
  { ...bulbLot(30, 'gambrel'), drive: [-9.7, -5] },
  { kind: 'empty', x: 36, z: -55.2, ang: Math.PI, sign: ['FOR SALE', 'CLAIM THIS LOT', 0xe8232a], lot: 'LOT 9' },
  { kind: 'empty', x: HX + 6.8, z: -22, ang: -Math.PI / 2, sign: ['AVAILABLE', 'CLAIM THIS LOT', 0xffc21a], lot: 'LOT 1' },
];
for (const L of LOTS) { L.c = Math.cos(L.ang); L.s = Math.sin(L.ang); }
const toLocal = (L, wx, wz) => { const dx = wx - L.x, dz = wz - L.z; return [dx * L.c - dz * L.s, dx * L.s + dz * L.c]; };
export const toWorld = (L, lx, lz) => [L.x + lx * L.c + lz * L.s, L.z - lx * L.s + lz * L.c];

// ── the ground: one 0.1 m raster over the whole vignette (roads 0.1 thick at y 0, everything raised to the 0.2 curb)
const X0 = -44, X1 = 126, Z0 = -130, Z1 = 0;
{
  const NX = (X1 - X0) * 10, NZ = (Z1 - Z0) * 10, G = new Vol(NX, 3, NZ, { s: CV, org: [X0, -0.1, Z0], ground: true }), sxz = G.sxz;
  const ASPH = 0x5d5e6b, CURB = PAL.curbTop, VERGE = 0x6cc453, WALK = 0xd6d0c4, JOINT = 0xbdb5a7, GRASS = [0x58b046, 0x55ac43], STRIPE = [0x68c650, 0x58b346], CONC = 0xd8d1c3;
  const PAVE = [0xe1cfb2, 0xd3bd9c], PLANK = [0xc79a64, 0xb98b57];
  const cls = (x, z) => {
    if (z > -0.5) return [3, 0xece8df];                                            // the seawall coping
    if (z > -7.5) { if (x > -18 && x < 6) return [3, PLANK[Math.floor(x / .45) & 1]]; return [3, PAVE[(Math.floor(x / .6) + Math.floor(z / .3)) & 1]]; }   // the promenade: boardwalk at the dock, pavers either side
    if (x > -34 && x < HX - 6.8 && z > -30) return [3, PAVE[(Math.floor(x / .6) + Math.floor(z / .3)) & 1]];   // the ferry plaza
    const eH = (z <= -7.5) ? Math.abs(x - HX) : 1e9, eM = x <= HX ? Math.abs(z + 40) : 1e9, eC = x > HX ? polyD(x, z, COURT) : 1e9, rb = Math.hypot(x - B.x, z - B.z), eB = rb - (RB - 4);
    if (rb < 4.6) return rb < 4.3 ? [3, (hash(Math.floor(x * 2), Math.floor(z * 2)) > .8 ? 0xff7ab6 : VERGE)] : [3, CURB];   // the island (petals under the blossom tree)
    const e = Math.min(eH, eM, eC, eB);
    if (e <= 6.8) for (const L of LOTS) if (L.drive) { const [lx, lz] = toLocal(L, x, z); if (lx > L.drive[0] && lx < L.drive[1] && lz > 0 && lz < 4.2 && e > 4) return [e <= 4.3 ? 2 : 3, CONC]; }
    if (e <= 4) { if (e === eH && Math.abs(x - HX) < .08 && Math.floor(z / 1.5) & 1 && z < -9) return [1, PAL.lineY];
      if (e === eH && z > -12 && z < -9.4 && Math.floor(x / .6) & 1) return [1, 0xf4f3ee];            // the zebra at the promenade
      return [1, ASPH]; }
    if (e <= 4.3) return [3, CURB];
    if (e <= 5.3) return [3, VERGE];
    if (e <= 6.8) return [3, (((x + 200) % 1.5) < .1 || ((z + 200) % 1.5) < .1) ? JOINT : WALK];
    for (const L of LOTS) { const [lx, lz] = toLocal(L, x, z); if (lx > -10.5 && lx < 10.5 && lz < 0 && lz > -25.5) return [3, STRIPE[Math.floor((lx + 10.5) / 1.4) & 1]]; }
    return [3, GRASS[hash(Math.floor(x / 3), Math.floor(z / 3)) > .5 ? 1 : 0]];
  };
  for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { const [h, c] = cls(X0 + (ix + .5) / 10, Z0 + (iz + .5) / 10), ci = G.ci(c, 0); for (let y = 0; y < h; y++) G.d[ix + iz * NX + y * sxz] = ci; }
  meshVol(G, WB);
  // land beyond the raster (lawn to the fog) and the seawall face down to the water
  const LAND = 0x57ae45; boxInto(WB, 0, -2000, -1, -2000, X0, .2, 0, LAND); boxInto(WB, 0, X1, -1, -2000, 2000, .2, 0, LAND); boxInto(WB, 0, X0, -1, -2000, X1, .2, Z0, LAND);
  boxInto(WB, 0, -2000, WATER - .6, -.35, 2000, .2, 0, 0xcfc9bc); boxInto(WB, 0, -2000, .2, -.45, X0, .25, .05, 0xece8df); boxInto(WB, 0, X1, .2, -.45, 2000, .25, .05, 0xece8df);
  boxInto(WB, 0, HX - 4, .2, -2000, HX + 4, .22, Z0, 0x5d5e6b); boxInto(WB, 0, -2000, .2, -44, X0, .22, -36, 0x5d5e6b);   // Harbor Rd and Maple Loop run on out of the vignette
}
// ── the water, with a little surf on the seawall and ripples
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(5000, 2500), new THREE.MeshStandardMaterial({ color: NIGHT ? 0x1b3f8a : 0x2f86d8, roughness: .55, metalness: 0 })); m.rotation.x = -Math.PI / 2; m.position.set(0, WATER, 1250); m.receiveShadow = true; scene.add(m);
  for (let k = 0; k < 420; k++) { const x = -160 + hash(k, 1) * 320, z = 2 + hash(k, 2) ** 1.6 * 200, w = .6 + hash(k, 3) * 2.4; boxInto(WB, 0, x, WATER, z, x + w, WATER + .03, z + .2, hash(k, 4) > .5 ? 0xf4f8fb : 0xdcecf6); }
  for (let x = -120; x < 180; x += 1.1) { const w = .4 + hash(x * 10 | 0, 9) * .7; boxInto(WB, 0, x, WATER, .02, x + w, WATER + .05, .3 + hash(x * 10 | 0, 8) * .5, 0xf4f8fb); }
}

// ── a volume helper for the built things below (metres, world axes)
const vol = (x0, y0, z0, x1, y1, z1, s = CV) => { const V = new Vol(Math.round((x1 - x0) / s), Math.round((y1 - y0) / s), Math.round((z1 - z0) / s), { s, org: [x0, y0, z0], ground: true });
  const q = m => Math.round(m / s); return { V, s, box: (a, b, c, d, e, f, col, l = 0) => V.box(q(a - x0), q(b - y0), q(c - z0), q(d - x0), q(e - y0), q(f - z0), col, l), face: (a, c, d, f, side) => frame(V, { x0: q(a - x0), x1: q(d - x0), z0: q(c - z0), z1: q(f - z0) }, side) }; };
const lit = (day = 0) => NIGHT ? 3 : day, TEAL = 0x12b3a0, TRIM = 0xfffaf0, INK = PAL.ink;

// ── THE PIER + THE WELCOME ARCH
{ const P = vol(-11, WATER - .6, -.4, -1, 6.2, 31);
  P.box(-9, .0, -.4, -3, .2, 30, (x, y, z) => (z % 4 === 0) ? 0xa57a4b : 0xc49563);                     // deck planks
  for (let z = 1; z < 30; z += 3) for (const x of [-9, -3.4]) P.box(x, WATER - .6, z, x + .4, 0, z + .4, 0x6e4a2c);   // piles
  P.box(-9, .2, 0, -8.8, 1.2, 30, (x, y, z) => y === 11 || z % 20 === 0 ? TRIM : undefined); P.box(-9, 1.1, 0, -8.8, 1.2, 30, TRIM);   // west rail
  for (const x of [-9.4, -2.7]) { P.box(x, .2, .6, x + .5, 5.0, 1.1, TEAL); P.box(x - .1, .2, .5, x + .6, .6, 1.2, TRIM); }
  P.box(-10.6, 4.9, .6, -1.4, 5.2, 1.5, TEAL); P.box(-10.4, 3.0, 1.1, -1.6, 4.9, 1.4, 0xffe23a);            // the arch: posts, beam, the yellow board
  const f = P.face(-10.4, 1.1, -1.6, 1.4, '+z'), fb = P.face(-10.4, 1.1, -1.6, 1.4, '-z'); f.text('WELCOME TO', 44, 62, 0, 1, INK, 0, 1, 1); f.text('THE MAINLAND', 44, 53, 0, 1, 0xe8232a, 0, 1, 1); fb.text('BON VOYAGE', 44, 58, 0, 1, INK, 0, 1, 1);
  P.box(-6.2, 5.2, .9, -5.8, 5.9, 1.2, 0xff4fa3); P.box(-6.3, 5.9, .85, -5.7, 6.0, 1.25, 0xffe23a);        // a little sun on top
  // the gangway from the ferry's door onto the deck
  P.box(-3.0, .1, 14.4, -2.5, .2, 16.6, 0x8a9099); P.box(-3.0, .2, 14.4, -2.5, 1.1, 14.5, TRIM); P.box(-3.0, .2, 16.5, -2.5, 1.1, 16.6, TRIM);
  meshVol(P.V, WB);
  for (const z of [4, 10, 22, 28]) put(bollard(0xffc21a), -3.4, z, 0, .2);
  for (const z of [9, 27]) put(lampPost(), -8.6, z, Math.PI / 2, .2);
}
// the ferry: the sea kit's SECOND CHANCE, bow in, alongside the pier (at night her cabin glass is lit)
stampA(ferry(), WB, Math.PI, 1.8, WATER - .8, 15.5);
// gulls on the pilings and one in the air
put(gull(0), -3.2, 6.5, .5, .3); put(gull(1), -9.1, 13, 2, 1.25); put(gull(2, true), 6, 6, 1.2, 7.5); put(gull(0, true), -14, 12, -.4, 9);

// ── THE FERRY TERMINAL: white clapboard, teal trim, a clock cupola on the ridge, MAINLAND FERRY on the band, TICKETS window
{ const x0 = -15, x1 = 2, z0 = -21, z1 = -10, T = vol(x0 - 2, 0, z0 - 2, x1 + 2, 14, z1 + 4), WH = 0xf4f1ea;
  T.box(x0, 0, z0, x1, 5.2, z1, (x, y) => y < 4 ? 0xb9b3a8 : y % 3 === 0 ? 0xe6e1d6 : WH);
  { let y = 5.2, a = z0 - .4, b = z1 + .4, k = 0; while (b - a > .2) { T.box(x0 - .3, y, a, x1 + .3, y + .1, Math.min(b, a + .3), k === 0 ? TEAL : (k & 1 ? 0x6d707a : 0x62656f)); T.box(x0 - .3, y, Math.max(a, b - .3), x1 + .3, y + .1, b, k === 0 ? TEAL : (k & 1 ? 0x6d707a : 0x62656f)); T.box(x0, y, a + .3, x1, y + .1, b - .3, WH); y += .1; a += .2; b -= .2; k++; } }
  const f = T.face(x0, z0, x1, z1, '+z');
  f.box(0, 36, 0, 170, 48, 2, TEAL); f.text('MAINLAND FERRY', 85, 45, 1, 3, TRIM, 0, 1, 1);
  f.box(58, 2, 0, 112, 33, 2, TRIM); f.box(60, 2, -2, 110, 32, 2, (a, y) => ((a - 60) % 10 === 0 || y === 20) ? TEAL : (NIGHT ? (y > 20 ? PAL.litHi : PAL.litLo) : (y > 18 ? PAL.glassHi : PAL.glassLo)), NIGHT ? 3 : 1);
  f.box(78, 2, -3, 92, 26, -2, 0x1b2a55, 1);
  f.box(122, 9, 0, 168, 32, 3, TEAL); f.box(125, 11, -1, 165, 22, 3, NIGHT ? PAL.litLo : 0x3f6bc4, NIGHT ? 3 : 1); f.box(124, 22, 0, 166, 31, 3, 0xffe23a); f.text('TICKETS', 145, 30, 3, 4, INK, 0, 1, 1);
  f.box(122, 9, 3, 168, 10, 8, TRIM);
  // the departures board left of the door: FERRY · 20 MIN
  f.box(10, 11, 0, 52, 31, 2, INK); f.text('FERRY', 31, 29, 2, 3, 0xffc21a, NIGHT ? 3 : 0, 1, 1); f.text('20 MIN', 31, 20, 2, 3, 0x6cff4a, NIGHT ? 3 : 0, 1, 1);
  // the cupola: teal, a clock on each face, a pennant
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; T.box(cx - 1.2, 6.8, cz - 1.2, cx + 1.2, 8.8, cz + 1.2, TEAL); T.box(cx - 1.5, 8.8, cz - 1.5, cx + 1.5, 9.0, cz + 1.5, TRIM);
  for (let k = 0; k < 9; k++) T.box(cx - 1.4 + k * .15, 9 + k * .15, cz - 1.4 + k * .15, cx + 1.4 - k * .15, 9.15 + k * .15, cz + 1.4 - k * .15, k & 1 ? 0x62656f : 0x6d707a);
  T.box(cx - .05, 10.3, cz - .05, cx + .05, 12.2, cz + .05, INK); T.box(cx + .05, 11.6, cz - .02, cx + 1.1, 12.1, cz + .02, 0xff4fa3);
  for (const [side, fc] of [['+z', 0], ['-z', 0], ['+x', 0], ['-x', 0]]) { const c = T.face(cx - 1.2, cz - 1.2, cx + 1.2, cz + 1.2, side); c.box(5, 72, 0, 19, 86, 1, TRIM, lit(0)); c.box(11, 79, 1, 12, 85, 2, INK); c.box(12, 79, 1, 17, 80, 2, INK); c.box(4, 71, 0, 20, 72, 1, INK); }
  meshVol(T.V, WB);
  for (const x of [-12, -8.5]) put(bench(), x, -8.6, 0);
  put(newsBox(0xe8232a), -2.8, -9.3); put(bin(0x2f7a3a), 3.2, -9.4);
  put(lampPost(), 4.2, -6.4, 0); put(lampPost(), -24, -6.4, 0); put(lampPost(), 26, -6.4, 0);
  put(tree('oak', 2, 1), -21, -16); put(tree('maple', 1, 0), -28, -22); put(tree('oak', 1, 2), -19, -26);
}

// ── HARBOR RD: street trees in the verge, lamps, the bus stop, the ice cream truck, a hydrant, the street signs
for (let z = -26; z > -126; z -= 13) { put(tree('oak', 1, (z * 7) & 3, true), HX - 4.8, z); if (z > -58 || z < -70) put(tree('maple', 1, (z * 3) & 3, true), HX + 4.8, z - 6); }
for (const z of [-16, -48, -80, -112]) { put(lampPost(), HX - 4.7, z, Math.PI / 2); }
put(hydrant(), HX + 4.7, -34.5); put(hydrant(), 60, -57.3);
{ const S = vol(HX + 4.4, 0, -46, HX + 6.9, 3.2, -40.5), f = S.face(HX + 4.4, -46, HX + 6.9, -40.5, '-x');   // the bus stop shelter (facing the road, west)
  S.box(HX + 6.5, .2, -45.8, HX + 6.8, 2.7, -40.7, 0xbfeaff, 1); S.box(HX + 4.6, .2, -45.8, HX + 6.8, 2.7, -45.6, 0xbfeaff, 1); S.box(HX + 4.6, .2, -40.9, HX + 6.8, 2.7, -40.7, 0xbfeaff, 1);
  for (const [x, z] of [[HX + 4.6, -45.8], [HX + 4.6, -40.9], [HX + 6.6, -45.8], [HX + 6.6, -40.9]]) S.box(x, .2, z, x + .2, 2.8, z + .2, TEAL);
  S.box(HX + 4.4, 2.8, -46, HX + 6.9, 3.0, -40.5, TEAL); S.box(HX + 5.2, .6, -45.4, HX + 6.4, .7, -41.4, 0xb07a45);
  S.box(HX + 6.4, .8, -44.8, HX + 6.6, 2.5, -42.2, NIGHT ? 0xfff0d0 : 0xff4fa3, lit(0)); const g = S.face(HX + 6.4, -44.8, HX + 6.6, -42.2, '-x'); g.text('SPF', 13, 23, 0, 1, INK, 0, 1, 1); g.text('50', 13, 15, 0, 1, INK, 0, 1, 1);
  meshVol(S.V, WB);
  const P = vol(HX + 4.5, 0, -39.4, HX + 5.2, 3.4, -38.6); P.box(HX + 4.75, .2, -39.1, HX + 4.95, 2.6, -38.9, 0x8a9099); P.box(HX + 4.55, 2.4, -39.35, HX + 5.15, 3.3, -39.25, TEAL);
  const pf = P.face(HX + 4.55, -39.35, HX + 5.15, -39.25, '-x'); meshVol(P.V, WB);
}
// street-name blades at the corner of Harbor Rd and Sunny Ct, and at Maple Loop
function blades(x, z, a, b) { const S = vol(x - 1.6, 0, z - 1.6, x + 1.6, 3.8, z + 1.6, .05); S.box(x - .05, 0, z - .05, x + .05, 3.5, z + .05, 0x1f5c4a);
  S.box(x - 1.4, 2.5, z - .05, x + 1.4, 3.0, z + .05, 0x14a83b); S.box(x - .05, 3.0, z - 1.4, x + .05, 3.5, z + 1.4, 0x14a83b);
  for (const [fa, sd, t] of [[S.face(x - 1.4, z - .05, x + 1.4, z + .05, '+z'), 0, a], [S.face(x - 1.4, z - .05, x + 1.4, z + .05, '-z'), 0, a]]) fa.text(t, 28, 58, 0, 1, TRIM, 0, 1, 1);
  for (const fa of [S.face(x - .05, z - 1.4, x + .05, z + 1.4, '-x'), S.face(x - .05, z - 1.4, x + .05, z + 1.4, '+x')]) fa.text(b, 28, 68, 0, 1, TRIM, 0, 1, 1);
  const bk = new Bank(true); meshVol(S.V, bk); stampA(bk, WB, 0, 0, LAWN, 0); }
blades(HX + 5.8, -56.5, 'HARBOR', 'SUNNY CT'); blades(HX - 5.8, -46, 'HARBOR', 'MAPLE LP');
put(vehicleProp('icecream', { variant: 0, driver: true, night: NIGHT, kind: 'truck' }), HX - 2.8, -19.5, 0, 0);
put(vehicleProp('sedan', { variant: 2, kind: 'car' }), HX + 2.9, -31, Math.PI, 0);

// ── SUNNY COURT: the lots, the island's blossom tree, lanterns round the bulb, the pocket park
const lotA = [];
for (const L of LOTS) { const { bank, A } = buildLot(L.kind, 1); stampA(bank, WB, L.ang, L.x, LAWN, L.z); lotA.push([L, A]);
  if (L.sign) { const [a, b, col] = L.sign, [sx, sz] = toWorld(L, -4.6, -2.0), S = vol(-1.8, 0, -.3, 1.8, 2.6, .3, .05);   // the realtor sign (built facing +z, turned with the lot)
    S.box(-1.7, 0, -.05, -1.6, 2.5, .05, TRIM); S.box(1.6, 0, -.05, 1.7, 2.5, .05, TRIM); S.box(-1.75, 2.4, -.1, 1.75, 2.5, .1, TRIM);
    S.box(-1.55, 1.25, -.05, 1.55, 2.35, .05, col); S.box(-1.3, .8, -.05, 1.3, 1.25, .05, col === 0xe8232a ? TRIM : INK);
    const fr = S.face(-1.55, -.05, 1.55, .05, '+z'), fg = col === 0xe8232a ? TRIM : INK; fr.text(a, 31, 45, 0, 1, fg, 0, 1, 1); fr.text(L.lot, 31, 35, 0, 1, fg, 0, 1, 1);
    fr.text('CLAIM IT', 31, 24, 0, 1, col === 0xe8232a ? 0xe8232a : 0xffc21a, NIGHT ? 3 : 0, 1, 1);
    const bk = new Bank(true); meshVol(S.V, bk); stampA(bk, WB, L.ang, sx, LAWN, sz); }
}
put(tree('blossom', 2, 1), B.x, B.z);
for (let k = 3; k < 26; k += 4) { const [ax, az] = COURT[k], [bx, bz] = COURT[k + 1], dx = bx - ax, dz = bz - az, n = Math.hypot(dx, dz), nx = -dz / n, nz = dx / n;
  for (const sd of [1, -1]) { if (sd === 1 && k > 20) continue; put(tree(k % 8 === 3 ? 'maple' : 'oak', 1, k + sd & 3, true), ax + nx * 4.8 * sd, az + nz * 4.8 * sd); } }
for (const L of LOTS) if (L.kind !== 'empty') for (const [lx, lz, sp, v] of [[-6.5, -22, 'oak', 0], [6.5, -21.5, 'maple', 1]]) { const [x, z] = toWorld(L, lx, lz); put(tree(sp, 2, v + L.x & 3), x, z); }
for (let i = 0; i < 70; i++) { const x = X0 + hash(i, 71) * (X1 - X0), z = Z0 + hash(i, 72) * (Z1 - Z0 - 20); let ok = Math.abs(x - HX) > 9 && Math.abs(z + 40) > 9 && Math.hypot(x - B.x, z - B.z) > 48 && polyD(x, z, COURT) > 12 && !(x < 8 && z > -32);
  for (const L of LOTS) { const [lx, lz] = toLocal(L, x, z); if (lx > -12 && lx < 12 && lz < 6 && lz > -27) ok = false; } if (ok) put(tree(['oak', 'maple', 'pine', 'birch', 'oak'][i % 5], 1 + (i & 1), i & 3), x, z); }
for (const k of [0, 1, 2]) { const a = rad([60, 180, 240][k]), r = RB + 1.1; put(lampPost(), B.x + Math.sin(a) * r, B.z + Math.cos(a) * r, Math.atan2(-Math.sin(a), -Math.cos(a))); }
put(lampPost(), 40, -70.2, Math.PI);
for (const [x, z, sp, sz, v] of [[56, -48, 'oak', 2, 0], [66, -44, 'maple', 2, 1], [62, -35, 'birch', 1, 2], [50, -38, 'oak', 1, 1], [72, -54, 'blossom', 1, 2], [110, -40, 'oak', 2, 2], [-30, -60, 'oak', 2, 1], [-18, -90, 'maple', 2, 0], [-30, -110, 'oak', 2, 2], [-8, -70, 'pine', 1, 0], [-26, -80, 'birch', 1, 1], [104, -120, 'pine', 2, 1], [120, -60, 'maple', 1, 2], [30, -118, 'oak', 2, 0], [16, -104, 'maple', 1, 1]])
  put(tree(sp, sz, v), x, z);
put(picnic(0xe8232a), 58, -42, .3); put(bench(), 64, -52, Math.PI + .2);

// ── MAPLE LOOP and the lots beyond: the Mainland grows with the user base — more streets, more houses, going off into the haze
{ const cols = [SHERBET.coral, SHERBET.butter, SHERBET.sky, SHERBET.mint, SHERBET.lilac, SHERBET.pink, 0xf4f1ea, 0xe6e1d6, 0xf4f1ea], roofs = [0x6e5244, 0x62656f, 0x4f4e57, 0x8c7568];
  const far = (x, z, k, face) => { const c = cols[k % cols.length], w = 7 + hash(k, 1) * 4, d = 7 + hash(k, 2) * 2, h = hash(k, 3) > .5 ? 6.2 : 3.4, rc = roofs[k & 3], bank = hash(k, 5) > .6 ? FAR : WB;
    boxInto(bank, 0, x - w / 2, .2, z - d / 2, x + w / 2, h, z + d / 2, c);
    for (let i = 0; i < 5; i++) { const t = i * .45; if (face === 'x') boxInto(bank, 0, x - w / 2 - .4, h + t, z - d / 2 - .4 + t, x + w / 2 + .4, h + t + .45, z + d / 2 + .4 - t, shade(rc, i & 1 ? .9 : 1)); else boxInto(bank, 0, x - w / 2 - .4 + t, h + t, z - d / 2 - .4, x + w / 2 + .4 - t, h + t + .45, z + d / 2 + .4, shade(rc, i & 1 ? .9 : 1)); }
    if (hash(k, 7) > .45) { const tx = x + (hash(k, 8) - .5) * 14, tz = z + (hash(k, 9) - .5) * 10; boxInto(bank, 0, tx - .3, .2, tz - .3, tx + .3, 2, tz + .3, 0x7a4a22); boxInto(bank, 0, tx - 1.8, 2, tz - 1.8, tx + 1.8, 5.2, tz + 1.8, [0x2fbf55, 0x25a748, 0x46d466][k % 3]); }
    if (NIGHT && hash(k, 11) > .3) boxInto(bank, 3, x - 1.2, 1.4, face === 'x' ? z - .6 : z + d / 2, x + .2, 2.6, face === 'x' ? z + .6 : z + d / 2 + .05, PAL.litLo); };
  let k = 0; for (let x = -60; x > -330; x -= 14) { far(x, -26, k++, 'x'); far(x, -54, k++, 'x'); }                       // Maple Loop, both sides
  for (let z = -144; z > -420; z -= 14) { far(-4, z, k++, 'z'); far(28, z, k++, 'z'); }                                 // Harbor Rd on north
  for (const [cx, cz] of [[-120, -150], [70, -200], [-220, -110], [180, -150], [-60, -290], [160, -300], [250, -60]]) for (let a = 0; a < 6; a++) { const t = rad(a * 60 + 20); far(cx + Math.sin(t) * 26, cz + Math.cos(t) * 26, k++, a & 1 ? 'x' : 'z'); }   // other culs, far off
  for (let i = 0; i < 90; i++) { const x = -420 + hash(i, 31) * 900, z = -140 - hash(i, 32) * 400; if (Math.abs(x - HX) < 30) continue; boxInto(FAR, 0, x - 2.5, .2, z - 2.5, x + 2.5, 7 + hash(i, 33) * 5, z + 2.5, [0x2fbf55, 0x1d8f3c, 0x25a748][i % 3]); }
}

// ── ACROSS THE WATER: AI City's skyline and IRON POINT (the jail's lighthouse) on the horizon — cheap boxes the fog makes a silhouette
{ const I = FAR, air = (c, t) => { const h = HOR, m = s => Math.round(((c >> s) & 255) * (1 - t) + ((h >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
  const CITY = [0xffc21a, 0xef4a2a, 0xff4fa3, 0x7a3cff, 0x3fa9f5, 0x2f5bff, 0x12b3a0, 0xf4f1ea, 0xd3d4d7, 0xa7a9b1, 0x9b4f3a, 0xe6e1d6, 0x6d707a];
  boxInto(I, 0, -330, WATER - .5, 392, 120, 1.6, 520, air(0x9d9686, .2));
  for (let i = 0; i < 90; i++) { const x = -300 + hash(i, 41) * 400, z = 405 + hash(i, 42) * 80, core = Math.exp(-((x + 90) ** 2) / 7000), h = 6 + core * 62 * (.45 + hash(i, 43)) + hash(i, 44) * 10, w = 9 + hash(i, 45) * 16, d = 9 + hash(i, 46) * 12, c = air(hash(i, 49) < .45 ? CITY[7 + ((hash(i, 47) * 6) | 0)] : CITY[(hash(i, 47) * 7) | 0], .12);
    boxInto(I, 0, x - w / 2, 1.6, z - d / 2, x + w / 2, h, z + d / 2, c); if (h > 40) boxInto(I, 0, x - w / 4, h, z - d / 4, x + w / 4, h + 4 + hash(i, 48) * 8, z + d / 4, shade(c, .92));
    if (h > 55) boxInto(I, 0, x - .3, h, z - .3, x + .3, h + 16, z + .3, 0x6d707a);
    if (NIGHT) for (let y = 4; y < h - 2; y += 3) for (let u = -w / 2 + 1; u < w / 2 - 1; u += 2.2) if (hash(i * 97 + y, u * 10 | 0) > .55) boxInto(I, 3, x + u, y, z - d / 2 - .1, x + u + 1.1, y + 1.4, z - d / 2, hash(i, y) > .5 ? PAL.litLo : 0xffe3a0); }
  boxInto(I, 0, -64, 22, 404, -36, 34, 406, 0x17171b); boxInto(I, NIGHT ? 3 : 0, -62, 23, 403.8, -38, 33, 404, 0xffe23a);   // a roof billboard reads even that far
  // IRON POINT: a rock islet, the red-and-white tower, the gallery and the lamp; the jail's grey walls and a guard tower behind it
  const lx = -70, lz = 262; boxInto(I, 0, lx - 16, WATER - .5, lz - 8, lx + 20, 2.2, lz + 12, 0x8e9299); boxInto(I, 0, lx - 8, 2.2, lz - 4, lx + 12, 3.4, lz + 8, 0x7b8088);
  for (let k = 0; k < 7; k++) boxInto(I, 0, lx - 1.8 + k * .1, 3.4 + k * 3, lz - 1.8 + k * .1, lx + 1.8 - k * .1, 6.4 + k * 3, lz + 1.8 - k * .1, k & 1 ? 0xe8232a : 0xf4f1ea);
  boxInto(I, 0, lx - 2.2, 24.4, lz - 2.2, lx + 2.2, 24.8, lz + 2.2, INK); boxInto(I, NIGHT ? 3 : 1, lx - 1.1, 24.8, lz - 1.1, lx + 1.1, 26.8, lz + 1.1, NIGHT ? 0xfff1b0 : 0xffe3a0); boxInto(I, 0, lx - 1.4, 26.8, lz - 1.4, lx + 1.4, 27.6, lz + 1.4, 0xe8232a);
  boxInto(I, 0, lx + 16, 1.6, lz + 14, lx + 70, 9, lz + 16, air(0xd3d4d7, .2)); boxInto(I, 0, lx + 26, 1.6, lz + 18, lx + 60, 14, lz + 40, air(0xa7a9b1, .2)); boxInto(I, 0, lx + 64, 1.6, lz + 10, lx + 70, 17, lz + 16, air(0xe6e1d6, .2)); boxInto(I, 0, lx + 63, 17, lz + 9, lx + 71, 19, lz + 17, air(0xff7a1a, .2));
  if (NIGHT) { const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, 9, 120, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: .12, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2; beam.rotation.y = .35; beam.position.set(lx - 55, 25.8, lz - 20); scene.add(beam); }
}
// clouds: cubic, in the sky only (day)
if (!NIGHT) { const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), g = new THREE.BoxGeometry(1, 1, 1);
  for (let c = 0; c < 16; c++) { const a = hash(c, 61) * Math.PI * 2, r = 380 + hash(c, 62) * 500, cx = Math.sin(a) * r, cz = Math.cos(a) * r, cy = 110 + hash(c, 63) * 90;
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(g, cm); m.scale.set(30 + hash(c, k) * 40, 10 + hash(c, k + 9) * 10, 20 + hash(c, k + 5) * 20); m.position.set(cx + (k - 2) * 18, cy + (k & 1) * 6, cz + hash(c, k + 3) * 16); scene.add(m); } } }

// ── THE PEOPLE: chars.js characters, posed and standing where someone would stand
const L_ = h => LOOKS.find(l => l.handle === h) || rollLook(h.length * 977);
function person(look, x, z, ry, fn, y = LAWN, sc = 1) { const o = build(look); o.rotation.order = 'YXZ'; o.position.set(x, y, z); o.rotation.y = ry; if (sc !== 1) o.scale.setScalar(CS * sc); pose(o, 0, 0); fn?.(o.userData.rig, o);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(o); return o; }
const arms = (a, b) => rg => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
const held = (seed, id) => Object.assign(rollLook(seed), { held: { id } });
person(held(0x5a11, 'duffel'), -5.6, 9.0, .5, arms(0, -.2));                          // just off the boat, bag in hand
person(held(0x5a12, 'flip'), -4.4, 7.8, -2.3, arms(0, -2.2));                           // phoning home
person(L_('www.girl'), -7.5, 3.4, .35, arms(-.3, 0));
person(rollLook(0x5a13), -0.6, -8.2, Math.PI, arms(-.9, 0));                                     // at the TICKETS window
person(rollLook(0x5a14), HX - 5.4, -17.8, Math.PI / 2, arms(-1.1, 0));                            // buying a cone at the truck window
person(held(0x5a15, 'can'), HX - 6.2, -20.6, Math.PI / 2 - .6, arms(-.6, 0));
person(rollLook(0x5a16), HX + 5.9, -43.1, -Math.PI / 2, null);                                   // waiting for the bus
person(held(0x5a17, 'flip'), HX + 7.6, -20.5, Math.PI / 2 + .4, arms(0, -2.2), LAWN);          // sizing up the AVAILABLE lot
for (const [L, A] of lotA) {
  const w = (p, dx = 0, dz = 0) => toWorld(L, p[0] + dx, p[1] + dz);
  if (A.hoop) { const [x, z] = w(A.hoop); person(rollLook(L.kind.length * 331), x, z, L.ang + Math.PI, arms(-2.9, -2.7), LAWN + .1); }
  if (A.stand) { const [x, z] = w(A.stand, 0, -.9), [bx, bz] = w(A.stand, 0, 1.6); person(rollLook(0x6a01), x, z, L.ang, arms(-.7, -.7), LAWN, .82); person(held(0x6a02, 'cash'), bx, bz, L.ang + Math.PI, arms(-.8, 0), LAWN, .95); }
  if (A.porch) { const [x, z] = w(A.porch); person(rollLook(0x6a03), x, z, L.ang, rg => { rg.legL.rotation.x = rg.legR.rotation.x = -1.3; rg.armL.rotation.x = rg.armR.rotation.x = -.4; }, LAWN + 1.1 - .5 + .02); }
  if (A.roof) { const [x, z] = w(A.roof); person(L_('xXbadvibesXx'), x, z, L.ang + .4, arms(-2.6, 0), LAWN + A.roof[1]); }
  if (A.lawn && L.kind === 'cape') { const [x, z] = w(A.lawn); person(rollLook(0x6a05), x, z, L.ang + 1.2, arms(-.8, 0)); }
  if (A.look && L.lot === 'LOT 9') { const [x, z] = w(A.look); person(rollLook(0x6a06), x, z, L.ang + Math.PI + .3, arms(0, -.3)); }
}
{ const T = vol(13.4, 0, -1.6, 14.4, 1.9, -.6); T.box(13.8, .2, -1.2, 14.0, 1.2, -1.0, 0x8a9099); T.box(13.55, 1.2, -1.45, 14.25, 1.6, -.75, 0x14a83b); T.box(13.6, 1.3, -.75, 13.8, 1.5, -.65, INK); T.box(14.0, 1.3, -.75, 14.2, 1.5, -.65, INK); T.box(13.5, .2, -1.4, 14.3, .3, -.8, 0x8a9099); meshVol(T.V, WB); }
person(rollLook(0x7b01), 15.4, -1.1, -.25, arms(-.3, -1.4)); put(bench(), 24.5, -2.2, Math.PI);
// a dog in the Springfield yard, a kid on a bike on the sidewalk of the bulb
{ const { dog } = await import('../../props.js'); const L = LOTS.find(l => l.kind === 'springfield'), [x, z] = toWorld(L, -4.5, -4.2); put(dog(1, 2, 'sit', 0), x, z, L.ang + .6); }

// ── meshes, night lamps
addBank(WB); addBank(FAR, false);
if (NIGHT) for (const [x, z] of [[-8.6, 9], [-8.6, 27], [4.2, -6.4], [-24, -6.4], [26, -6.4], [HX - 4.7, -16], [HX - 4.7, -48], [HX - 4.7, -80], [40, -70.2], ...[60, 180, 240].map(a => [B.x + Math.sin(rad(a)) * (RB + 1.1), B.z + Math.cos(rad(a)) * (RB + 1.1)])]) { const l = new THREE.PointLight(0xffd9a0, 70, 24, 1.5); l.position.set(x, 5.0, z); scene.add(l); }

// ── cameras (STYLE §5: street eye 2.6–3.6 fov 50–58 · close-ups eye 1.3–1.6 fov 40–46 · overview ~55° down fov 42–44)
const VIEWS = {
  arrive: { cam: [-2.1, 5.3, 21], look: [2.5, 1.4, -42], fov: 54, r: 70 },
  above: { cam: [38, 92, -6], look: [70, 0, -80], fov: 43, r: 95 },
  street: { cam: [44, 2.9, -66], look: [80, 3.2, -88], fov: 54, r: 60 },
  house: { cam: [84.5, 1.5, -79.2], look: [97, 3.1, -86], fov: 44, r: 40 },
  night: { cam: [44, 2.9, -66], look: [80, 3.2, -88], fov: 54, r: 60 },
  island: { cam: [19.5, 3.0, -14], look: [-40, 6, 300], fov: 36, r: 40 },
};
const v = VIEWS[Q.get('view')] || VIEWS.arrive, V3 = s => s.split(',').map(Number);
const cam = Q.get('cam') ? V3(Q.get('cam')) : v.cam, look = Q.get('look') ? V3(Q.get('look')) : v.look;
const camera = new THREE.PerspectiveCamera(+(Q.get('fov') || v.fov), W / H, .1, 2600); camera.position.set(...cam); camera.lookAt(...look);
// fog by camera height: street 110→560 (open water needs the reach), tightening overhead; sun shadow fitted round the look point
{ const t = Math.min(1, Math.max(0, (cam[1] - 6) / 144)); scene.fog.near = 110 + t * 40; scene.fog.far = 560 - t * 120;
  const r = +(Q.get('r') || v.r), tx = (cam[0] + look[0]) / 2, tz = (cam[2] + look[2]) / 2; sun.target.position.set(tx, 0, tz); sun.position.set(tx - 60, 90, tz + 75);
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 400 }); sun.shadow.camera.updateProjectionMatrix(); }
// orbit when not shooting
if (!Q.has('shot')) { const { OrbitControls } = await import('three/addons/controls/OrbitControls.js'); const oc = new OrbitControls(camera, renderer.domElement); oc.target.set(...look); oc.update(); }
renderer.setAnimationLoop(() => renderer.render(scene, camera));
window.__ready = true;
