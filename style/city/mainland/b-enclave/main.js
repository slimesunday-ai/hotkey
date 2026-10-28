// MAINLAND · candidate B · "Collectors' enclave" — ROOT ACCESS, a gated modernist cul-de-sac (LA hills + Palm Springs) across the
// water from AI City. A vignette on its own page: it reuses the city's voxel kit, fleet, props, the SECOND CHANCE ferry and the
// chars.js cast read-only, and builds nothing into the city.
//   ?tod=night · ?shot=1 (no UI) · ?view=arrive|above|street|home|night|island · ?cam=x,y,z&look=x,y,z&fov=54
// World frame: the shore is z = 0, the water (and the island, ~330 m out) is −z; the enclave climbs +z toward the hills.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Vol, meshed, Bank, stamp, textMask, rasterMask } from '../../vox.js';
import { packMerged } from '../../lod.js';
import { tierize, meshOf } from '../../gpu.js';
import { PAL, hash } from '../../style.js';
import { TOD } from '../../kit.js';
import { vehicleMesh } from '../../vehicles/three.js';
import { lawnChair, umbrella, bench, hotTub } from '../../props.js';
import { ferry } from '../../districts/sea/boats.js';
import { S, build, pose, look, LOOKS, rollLook } from '../../cast.js';

const Q = new URLSearchParams(location.search), NIGHT = Q.get('tod') === 'night', SHOT = Q.has('shot');
TOD.night = NIGHT; if (NIGHT) document.body.classList.add('night');
const H = (a, b = 0, c = 0) => hash(Math.round(a) | 0, Math.round(b) | 0, Math.round(c) | 0);
const shadeC = (c, f) => { const m = k => Math.max(0, Math.min(255, Math.round(((c >> k) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const mixC = (a, b, t) => { const m = k => Math.round(((a >> k) & 255) * (1 - t) + ((b >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const C = {
  white: 0xf4f1ea, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, ink: 0x17171b, chalk: 0xf7f7f2, cream: 0xfff0d0,
  pink: 0xff4fa3, orange: 0xff7a1a, yellow: 0xffc21a, sign: 0xffe23a, teal: 0x12b3a0, red: 0xef4a2a, blue: 0x2f5bff, lime: 0x6cff4a, green: 0x14a83b,
  gold: 0xe7bd4a, goldL: 0xffe08a, chrome: 0xdfe6ee, granite: 0x26262e,
  grass: 0x46c046, grassB: 0x3cb13f, hedge: 0x1d8f3c, hedgeT: 0x2aa84a, hedgeD: 0x187a34, leaf: 0x25a748, leafL: 0x2fbf55, leafD: 0x1d8f3c,
  trunk: 0x9a6a3a, trunkD: 0x7a4a22, shag: 0xc49a6c, shagD: 0xa87e52,
  asph: 0x5d5e6b, asphP: 0x565764, walk: 0xcdc5b8, joint: 0xb9b0a2, curb: 0xece8df, curbF: 0xb7b0a3, pave: 0xe4ddd0, paveJ: 0xcfc7b8,
  trav: 0xefe6d2, drive: 0xe9e4da, driveJ: 0xcfc7b8, dg: 0xdcc9a0, dg2: 0xcfb98c, dg3: 0xe8d8b5, gravel: 0xeceae4,
  water: 0x2fc4ff, waterD: 0x1f8fd8, caustic: 0xbff0ff, sea: NIGHT ? 0x1b3f86 : 0x2f86d8, conc: 0xcfc9bc, wood: 0xa4652f, woodD: 0x8a5226, pile: 0x5a3a22,
};
const LITL = NIGHT ? 3 : 0;   // the lit layer by night (neon, glass, pool water)

// ── renderer, sky, haze, light
const W = innerWidth, Hh = innerHeight, renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(SHOT ? 1 : Math.min(devicePixelRatio, 2)); renderer.setSize(W, Hh);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(), HOR = NIGHT ? PAL.nightHor : PAL.horizon, TOP = NIGHT ? PAL.nightTop : PAL.sky;
scene.fog = new THREE.Fog(HOR, 90, 380);
{ const U = { top: { value: new THREE.Color(TOP) }, hor: { value: new THREE.Color(HOR) } };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor; gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n}' });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), m); dome.renderOrder = -1; dome.frustumCulled = false; scene.add(dome); }
{ const es = new THREE.Scene(); es.background = new THREE.Color(HOR); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .02).texture; scene.environmentIntensity = NIGHT ? .2 : .55; }
const SUN_DIR = new THREE.Vector3(-45, 70, -55).normalize();
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -.0004; sun.shadow.normalBias = .05; scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .55 : 1.05));
const MAT = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), { vmat: true });
const FAR = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, fog: false }), { vmat: true });
const PANE = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: NIGHT ? .08 : .2, roughness: .05, metalness: .1, depthWrite: false });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xe7bd4a, metalness: .85, roughness: .28 });
const LIGHTS = [];   // night point lights [colour, intensity, distance, x, y, z]
const addLight = (c, i, d, x, y, z) => { if (NIGHT) LIGHTS.push([c, i, d, x, y, z]); };

// ── a Vol addressed in metres (colour functions get world-ish centres and offsets from the box start; return [colour, layer] to set a layer)
class Box {
  constructor(x0, y0, z0, x1, y1, z1, s = .1) { this.s = s; this.o = [x0, y0, z0]; this.V = new Vol(Math.round((x1 - x0) / s), Math.round((y1 - y0) / s), Math.round((z1 - z0) / s), { s, org: [x0, y0, z0], ground: true }); }
  ix(v) { return Math.round((v - this.o[0]) / this.s); } iy(v) { return Math.round((v - this.o[1]) / this.s); } iz(v) { return Math.round((v - this.o[2]) / this.s); }
  box(x0, y0, z0, x1, y1, z1, c, l = 0) {
    const V = this.V, a = [this.ix(x0), this.iy(y0), this.iz(z0), this.ix(x1), this.iy(y1), this.iz(z1)];
    if (typeof c !== 'function') { if (Array.isArray(c)) V.box(a[0], a[1], a[2], a[3], a[4], a[5], c[0], c[1]); else V.box(a[0], a[1], a[2], a[3], a[4], a[5], c, l); return; }
    const s = this.s, [ox, oy, oz] = this.o;
    for (let y = Math.max(0, a[1]); y < Math.min(V.ny, a[4]); y++) for (let z = Math.max(0, a[2]); z < Math.min(V.nz, a[5]); z++) for (let x = Math.max(0, a[0]); x < Math.min(V.nx, a[3]); x++) {
      const v = c(ox + (x + .5) * s, oy + (y + .5) * s, oz + (z + .5) * s, x - a[0], y - a[1], z - a[2]); if (v === undefined || v === null) continue;
      if (Array.isArray(v)) V.set(x, y, z, v[0], v[1]); else V.set(x, y, z, v, l); }
  }
  clear(x0, y0, z0, x1, y1, z1) { this.box(x0, y0, z0, x1, y1, z1, -1); }
  cyl(cx, cz, r, y0, y1, c, l = 0) { this.box(cx - r - .2, y0, cz - r - .2, cx + r + .2, y1, cz + r + .2, (x, y, z, i, j, k) => Math.hypot(x - cx, z - cz) <= r ? (typeof c === 'function' ? c(x, y, z, i, j, k) : c) : undefined, l); }
  // lettering on a face: ax = the centre along the face, ytop, af = the face plane; letters stand proud of it by `depth` cells
  text(M, ax, ytop, af, face, col, sc = 1, depth = 1, l = 0) {
    const V = this.V, Wd = M.w * sc, yt = this.iy(ytop); V.recNext?.();
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { if (!M.at(i, j)) continue;
      for (let su = 0; su < sc; su++) for (let sv = 0; sv < sc; sv++) { const u = i * sc + su, y = yt - 1 - (j * sc + sv);
        for (let d = 0; d < depth; d++) {
          if (face === '-z') V.set(this.ix(ax) + (Wd >> 1) - 1 - u, y, this.iz(af) - 1 - d, col, l);
          else if (face === '+z') V.set(this.ix(ax) - (Wd >> 1) + u, y, this.iz(af) + d, col, l);
          else if (face === '+x') V.set(this.ix(af) + d, y, this.iz(ax) + (Wd >> 1) - 1 - u, col, l);
          else V.set(this.ix(af) - 1 - d, y, this.iz(ax) - (Wd >> 1) + u, col, l); } } }
  }
  bank() { return meshed(this.V); }
}
const LIFT = new THREE.Group(); LIFT.position.y = .2; scene.add(LIFT);   // world boxes authored from the sidewalk top (y 0 = 0.2)
const center = B => [B.o[0] + B.V.nx * B.s / 2, B.o[1], B.o[2] + B.V.nz * B.s / 2];
function addBank(bank, o, parent = scene, mat = MAT, cast = true) { const t = packMerged(bank, o); if (!t) return null; const m = meshOf(t, mat, { cast }); parent.add(m); return m; }
const addBox = (B, parent = scene, stamps = [], mat = MAT, cast = true) => { const b = B.bank(); for (const s of stamps) stamp(s[0], b, s[1], s[2], s[3], s[4]); return addBank(b, center(B), parent, mat, cast); };
const PX = new Map(), px = s => { let m = PX.get(s); if (!m) PX.set(s, m = textMask(s)); return m; };

// ── shared pieces (drawn into a Box)
const glassF = (lit, y0, y1) => (x, y, z, i, j, k) => { const t = (y - y0) / Math.max(.1, y1 - y0);
  if (NIGHT) { const bay = H(((x + 400) / 1.4) | 0, ((z + 400) / 1.4) | 0, 5); return lit && bay > .3 ? [t > .55 ? PAL.litHi : PAL.litLo, 3] : lit && bay > .15 ? [t > .5 ? 0xb07a48 : 0x8a5a36, 3] : (t > .6 ? 0x2a3566 : 0x1b2240); }
  const g = (i + k + j) % 29; return [g < 2 && t > .25 ? PAL.glint : t > .55 ? PAL.glassHi : PAL.glassLo, 1]; };
// a glass curtain on the front plane z (the mass occupies z ≥ zf): panes + slim white mullions every `bay` metres
function curtain(B, x0, x1, y0, y1, zf, lit, mull = C.chalk, bay = 1.4) {
  B.box(x0, y0, zf, x1, y1, zf + .2, glassF(lit, y0, y1));
  for (let x = x0; x <= x1 + .01; x += bay) B.box(x - .05, y0, zf - .1, x + .05, y1, zf + .1, mull);
  B.box(x0, y0 - .1, zf - .1, x1, y0, zf + .1, mull); B.box(x0, y1, zf - .1, x1, y1 + .1, zf + .1, mull);
}
// a flat roof slab with a chalk fascia and a pale gravel top (roofs are neutral)
function roof(B, x0, z0, x1, z1, y, t = .3, fascia = C.chalk) { B.box(x0, y, z0, x1, y + t, z1, fascia); B.box(x0 + .3, y + t - .1, z0 + .3, x1 - .3, y + t, z1 - .3, (x, yy, z, i, j, k) => H(i, k, 3) > .93 ? C.grey : C.pale); }
// a door on the front plane (the wall occupies z ≥ zf): colour slab, a brass pull
function door(B, x, zf, col, w = 1.2, h = 2.4) { B.box(x - w / 2 - .1, 0, zf - .05, x + w / 2 + .1, h + .1, zf + .1, C.chalk); B.box(x - w / 2, 0, zf - .1, x + w / 2, h, zf + .1, col); B.box(x + w / 2 - .3, 1.0, zf - .2, x + w / 2 - .2, 1.6, zf - .1, C.gold, 2); }
// breeze block: a 0.5 m module with four holes round a solid cross (the Palm Springs screen)
const bbHole = (a, j) => ((a % 5 === 1 || a % 5 === 3) && (j % 5 === 1 || j % 5 === 3));
function breezeX(B, x0, x1, z, h, col) { B.box(x0, 0, z, x1, h, z + .2, (x, y, zz, i, j) => (j >= 1 && j < Math.round(h / .1) - 1 && bbHole(i, j - 1)) ? undefined : col); B.box(x0 - .05, h, z - .05, x1 + .05, h + .1, z + .25, C.chalk); }
function breezeZ(B, x, z0, z1, h, col) { B.box(x, 0, z0, x + .2, h, z1, (xx, y, z, i, j, k) => (j >= 1 && j < Math.round(h / .1) - 1 && bbHole(k, j - 1)) ? undefined : col); B.box(x - .05, h, z0 - .05, x + .25, h + .1, z1 + .05, C.chalk); }
function hedge(B, x0, z0, x1, z1, h) { B.box(x0, 0, z0, x1, h, z1, (x, y, z, i, j, k) => y > h - .15 ? C.hedgeT : H(i >> 1, j >> 1, k >> 1) > .8 ? C.hedgeD : C.hedge); }
// a pool in a travertine deck: water 0.1 below the chalk coping, lit at night
function pool(B, x0, z0, x1, z1, deck = 1.4) {
  B.box(x0 - deck, 0, z0 - deck, x1 + deck, .3, z1 + deck, (x, y, z, i, j, k) => (i + k) % 12 === 0 && H(i, k) > .5 ? C.paveJ : C.trav);
  B.box(x0 - .3, .2, z0 - .3, x1 + .3, .3, z1 + .3, C.chalk);
  B.box(x0, 0, z0, x1, .3, z1, (x, y, z, i, j, k) => { if (y > .2) return -1; const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
    if (NIGHT) return [e < .35 ? 0x1aa6ee : H(i, k, 9) > .96 ? 0xd8fbff : 0x46dcff, 3];
    return [e < .35 ? C.waterD : H(i, k, 9) > .965 ? C.caustic : C.water, 1]; });
  addLightL(0x46d8ff, 14, 9, (x0 + x1) / 2, 1.0, (z0 + z1) / 2);
}
// a glass garage (the Palm Springs showroom): open front behind a pane, lit floor + ceiling, the car inside nose-out
function garage(B, P, x0, x1, z0, z1, h, wall, car) {
  B.box(x0, 0, z0, x1, .1, z1, NIGHT ? [0xfff4dc, 3] : 0xe9e6df);
  B.box(x0, 0, z0, x0 + .3, h, z1, wall); B.box(x1 - .3, 0, z0, x1, h, z1, wall); B.box(x0, 0, z1 - .3, x1, h, z1, wall);
  B.box(x0, h - .35, z0, x1, h, z1, wall); B.box(x0 + .5, h - .45, z0 + .6, x1 - .5, h - .35, z1 - .6, NIGHT ? [0xfff2d6, 3] : C.chalk);   // the light soffit
  B.box(x0 + .3, .1, z1 - .5, x1 - .3, 2.6, z1 - .3, (x, y, z, i, j) => j % 6 === 0 ? C.pale : C.white);   // a clean back wall
  const bays = car.length, bw = (x1 - x0) / bays;
  for (let b = 1; b < bays; b++) B.box(x0 + b * bw - .07, 0, z0, x0 + b * bw + .07, h, z0 + .15, C.ink);
  car.forEach((c, b) => P.cars.push({ ...c, x: x0 + (b + .5) * bw, z: (z0 + z1) / 2 + .1, ry: Math.PI }));
  P.panes.push([x0 + .3, .1, z0 + .05, x1 - .3, h - .35, z0 + .1]);
  addLightL(0xffe2b0, 10, 8, (x0 + x1) / 2, h - .8, (z0 + z1) / 2);
}
// the address monolith: a white slab by the drive, brass numerals
function monolith(B, x, z, no) { const M = px(no); B.box(x - M.w * .05 - .3, 0, z, x + M.w * .05 + .3, 1.1, z + .4, C.white); B.text(M, x, .95, z, '-z', NIGHT ? C.goldL : C.gold, 1, 1, NIGHT ? 3 : 2); }
let LOTXF = null; const addLightL = (c, i, d, x, y, z) => { const [X, Z] = LOTXF ? LOTXF(x, z) : [x, z]; addLight(c, i, d, X, y + (LOTXF ? .2 : 0), Z); };

// ── templates: the Washingtonia palm (tall, a shag skirt, a fan head; uplit by night), the agave, the modern lamp post
const TPL = new Map(), tpl = (k, f) => { let b = TPL.get(k); if (!b) TPL.set(k, b = f()); return b; };
const palm = (h, v = 0) => tpl('palm' + h + '|' + v, () => {
  const n = Math.round(h / .1), V = new Vol(60, n + 14, 60, { s: .1, org: [-3, 0, -3], ground: true }), c = 30, lean = [0, 1, -1, .5][v & 3];
  let tx = c;
  for (let y = 0; y < n; y++) { const t = y / n; tx = c + Math.round(lean * t * t * 6);
    const col = NIGHT && t < .7 ? [mixC(0xf2c68a, 0x5a3a22, Math.sqrt(t / .7)), 3] : (y % 5 === 0 ? C.trunkD : C.trunk);
    V.box(tx - 2, y, c - 2, tx + 2, y + 1, c + 2, Array.isArray(col) ? col[0] : col, Array.isArray(col) ? col[1] : 0); }
  V.box(tx - 4, n - 14, c - 4, tx + 4, n, c + 4, (x, y, z) => NIGHT && y < n - 9 ? 0xe7b870 : (x + y + z) % 4 === 0 ? C.shagD : C.shag, NIGHT ? 3 : 0);
  for (let y = n - 14; y < n - 9; y++) for (let x = tx - 4; x < tx + 4; x++) for (let z = c - 4; z < c + 4; z++) if (H(x, y, z) > .6) V.del(x, y, z);
  V.box(tx - 3, n, c - 3, tx + 3, n + 4, c + 3, C.leafD);
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + v * .4, ca = Math.cos(a), sa = Math.sin(a);
    for (let d = 2; d < 25; d++) { const x = tx + ca * d, z = c + sa * d, y = n + 4 + Math.round(1.6 - d * d / 70), sp = d > 8 ? Math.min(3, (d / 7) | 0) : 0;
      for (let w = -sp; w <= sp; w++) { const col = d > 22 ? C.leafD : (k + (w & 1)) % 2 ? C.leaf : C.leafL; V.set(x - sa * w, y, z + ca * w, NIGHT && d < 12 ? 0x78c25a : col, NIGHT && d < 12 ? 3 : 0); } } }
  if (NIGHT) { V.box(c + 4, 0, c - 1, c + 7, 2, c + 2, C.ink); V.box(c + 4, 2, c - 1, c + 7, 3, c + 2, 0xfff0c8, 3); }
  return meshed(V); });
const agave = v => tpl('agave' + v, () => { const V = new Vol(14, 10, 14, { s: .1, org: [-.7, 0, -.7], ground: true }), g = [0x6fa89a, 0x5e9a7c, 0x86b08a][v % 3];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + v; for (let d = 0; d < 7; d++) V.set(7 + Math.cos(a) * d, Math.round(d * 1.1), 7 + Math.sin(a) * d, d === 6 ? 0xd9c36a : g); }
  V.box(6, 0, 6, 8, 3, 8, g); return meshed(V); });
const lampPost = () => tpl('lamp', () => { const V = new Vol(16, 46, 6, { s: .1, org: [-.3, 0, -.3], ground: true });
  V.box(1, 0, 1, 5, 2, 5, C.slate); V.box(2, 2, 2, 4, 44, 4, C.ink); V.box(2, 42, 2, 15, 45, 4, C.ink); V.box(8, 41, 2, 14, 42, 4, NIGHT ? 0xffe3a0 : C.pale, NIGHT ? 3 : 0); return meshed(V); });
const bollard = () => tpl('bollard', () => { const V = new Vol(4, 9, 4, { s: .1, org: [-.2, 0, -.2], ground: true }); V.box(0, 0, 0, 4, 8, 4, C.chalk); V.box(0, 6, 0, 4, 7, 4, NIGHT ? 0xfff0c8 : C.grey, NIGHT ? 3 : 0); V.box(1, 8, 1, 3, 9, 3, C.grey); return meshed(V); });
const planterT = c => tpl('pl' + c, () => { const V = new Vol(12, 12, 12, { s: .1, org: [-.6, 0, -.6], ground: true }); V.box(0, 0, 0, 12, 6, 12, c); V.box(1, 5, 1, 11, 6, 11, 0x6b3a1e);
  for (let k = 0; k < 6; k++) { const a = k * 1.05; for (let d = 0; d < 5; d++) V.set(6 + Math.cos(a) * d, 6 + Math.round(d * 1.2), 6 + Math.sin(a) * d, 0x6fa89a); } V.box(5, 6, 5, 7, 8, 7, 0x5e9a7c); return meshed(V); });

// ── the plan
const CZ = 88, RI = 7, RC = 15, RW = 17.2, GZ = 36;   // the bulb's centre z (x = 0), island, curb and sidewalk radii; the gate wall
const isRoad = (x, z) => { const r = Math.hypot(x, z - CZ); if (r >= RI && r < RC) return true; if (Math.abs(x) < 4.5 && z >= 6.4 && z < CZ) return !(z > 31 && z < 41 && Math.abs(x) < 1.4); return false; };
function kindAt(x, z) {
  if (z < .4) return 'sea'; if (z < 6.4) return 'prom';
  if (isRoad(x, z)) return 'road';
  const r = Math.hypot(x, z - CZ);
  if (r < RI - .2) return 'island';
  if (isRoad(x - .2, z) || isRoad(x + .2, z) || isRoad(x, z - .2) || isRoad(x, z + .2)) return 'curb';
  if (Math.abs(x) < 1.4 && z > 31 && z < 41) return 'median';
  if (r < RW || (Math.abs(x) < 6.6 && z < CZ)) return 'walk';
  if (x < -6.6 && x > -72 && z < 28) return 'pave';
  if (z > GZ + .4 && z < 134 && Math.abs(x) < 48) return 'lawn';
  return 'dg';
}
// the lots: stem lots face the stem, bulb lots face the island (local +z points away from the street; x across the frontage)
const LOTS = [
  { id: 'A', kind: 'slab', th: 90, ox: 6.6, oz: 47, W: 18, D: 25, no: '1' },
  { id: 'X1', kind: 'avail', th: -90, ox: -6.6, oz: 47, W: 18, D: 25, no: '2' },
  { id: 'B', kind: 'butterfly', th: 124, W: 20, D: 24, no: '3' },
  { id: 'C', kind: 'cantilever', th: 62, W: 20, D: 24, no: '5' },
  { id: 'D', kind: 'vault', th: 0, W: 20, D: 24, no: '7' },
  { id: 'X2', kind: 'avail', th: -62, W: 20, D: 24, no: '6' },
  { id: 'E', kind: 'aframe', th: -124, W: 20, D: 24, no: '4' },
];
for (const L of LOTS) { const t = L.th * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); if (L.ox === undefined) { L.ox = RW * s; L.oz = CZ + RW * c; }
  L.c = c; L.s = s; L.toW = (x, z) => [L.ox + x * c + z * s, L.oz - x * s + z * c]; L.toL = (X, Z) => { const dx = X - L.ox, dz = Z - L.oz; return [dx * c - dz * s, dx * s + dz * c]; }; }

// ── the ground (0.2 m): promenade, roads, curbs, sidewalks, the lawns, the desert outside the wall; lots paint their own lawns
function ground() {
  const G = new Box(-72, -.8, 0, 72, .2, 140, .2), V = G.V, K = [];
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = -72 + (i + .5) * .2, z = (k + .5) * .2, kd = kindAt(x, z); K[k * V.nx + i] = kd;
    let top = 4, col = C.dg, sub = C.dg2;
    switch (kd) {
      case 'sea': col = C.curb; sub = C.conc; break;
      case 'prom': col = (i % 10 === 0 || k % 10 === 0) ? C.paveJ : (k < 4 ? C.curb : C.pave); sub = C.conc; break;
      case 'road': top = 3; col = H(i >> 2, k >> 2, 5) > .9 ? C.asphP : C.asph; sub = C.asph; break;
      case 'curb': col = C.curb; sub = C.curbF; break;
      case 'median': col = (i + k) % 6 === 0 ? C.paveJ : C.pave; sub = C.curbF; break;
      case 'walk': col = (i % 8 === 0 || k % 8 === 0) ? C.joint : C.walk; sub = C.curbF; break;
      case 'pave': col = (i % 10 === 0 || k % 10 === 0) ? C.paveJ : C.pave; break;
      case 'island': col = C.grass; sub = 0x6b4a2a; break;
      case 'lawn': col = ((Math.floor((x + 200) / 1.8)) & 1) ? C.grass : C.grassB; sub = 0x6b4a2a; break;
      default: { const h = H(i, k, 7); col = h > .93 ? C.dg2 : h < .05 ? C.dg3 : C.dg; }
    }
    for (let y = 0; y < top; y++) V.set(i, y, k, sub); V.set(i, top, k, col); }
  // the lots paint their lawns (striped along the lot), drives, stepping stones, gravel beds and, on an open lot, the ghost footprint
  for (const L of LOTS) { const cs = [[-L.W / 2, -2.4], [L.W / 2, -2.4], [-L.W / 2, L.D], [L.W / 2, L.D]].map(([x, z]) => L.toW(x, z));
    const [x0, x1] = [Math.min(...cs.map(p => p[0])), Math.max(...cs.map(p => p[0]))], [z0, z1] = [Math.min(...cs.map(p => p[1])), Math.max(...cs.map(p => p[1]))];
    for (let k = Math.max(0, Math.floor(z0 / .2)); k < Math.min(V.nz, Math.ceil(z1 / .2)); k++) for (let i = Math.max(0, Math.floor((x0 + 72) / .2)); i < Math.min(V.nx, Math.ceil((x1 + 72) / .2)); i++) {
      const X = -72 + (i + .5) * .2, Z = (k + .5) * .2, [x, z] = L.toL(X, Z), kd = K[k * V.nx + i]; if (Math.abs(x) > L.W / 2 || z > L.D || z < -2.1) continue;
      const c = L.paint(x, z, kd); if (c !== null && c !== undefined) V.set(i, 4, k, c); } }
  addBox(G, scene, [], MAT, false).receiveShadow = true;
  // land beyond the vignette, the seawall along the whole shore, the sea
  const flat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .95 });
  for (const [x0, x1, z0, z1] of [[-1600, -72, 0, 1600], [72, 1600, 0, 1600], [-72, 72, 140, 1600]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), flat(C.dg)); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, .19, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); }
  for (const [x0, x1] of [[-1600, -72], [72, 1600]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.0, .4), flat(C.conc)); m.position.set((x0 + x1) / 2, -.3, .2); scene.add(m); }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: C.sea, roughness: .35, metalness: 0 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -.55, -1000); sea.receiveShadow = true; scene.add(sea);
  // surf along the seawall and round the pier piles
  const F = new Box(-72, -.6, -1.2, 72, -.4, 0, .2); F.box(-72, -.6, -1.2, 72, -.4, 0, (x, y, z, i, j, k) => { const h = H(i, k, 11); return (k === 5 && h > .25) || (k === 4 && h > .7) || (k === 3 && h > .92) ? (h > .6 ? 0xf4f8fb : 0xdcecf6) : undefined; });
  addBox(F, scene, [], MAT, false);
}

// ── lots: paint + build
const stripes = (x, z) => ((Math.floor((x + 40) / 1.5)) & 1) ? C.grass : C.grassB;
function lotPaint(L, o) {   // o: { drive: [x0, x1, z1], path: [x, z1], bed: [x0, x1], ghost: [x0, z0, x1, z1] }
  L.paint = (x, z, kd) => {
    if (o.drive && x > o.drive[0] && x < o.drive[1] && z < o.drive[2]) return kd === 'walk' || kd === 'lawn' ? ((((z + 10) % 2.2) < .2) ? C.driveJ : C.drive) : null;
    if (kd !== 'lawn' || z < 0) return null;
    if (o.path && Math.abs(x - o.path[0]) < .7 && z < o.path[1] && ((z + 10) % 1.2) < .8) return C.trav;
    if (o.bed && x > o.bed[0] && x < o.bed[1] && z > 2.6 && z < 4.6) return H(x * 5, z * 5, 3) > .8 ? C.pale : C.gravel;
    if (o.ghost) { const [g0, h0, g1, h1] = o.ghost, on = (Math.abs(x - g0) < .2 || Math.abs(x - g1) < .2) && z > h0 && z < h1 || (Math.abs(z - h0) < .2 || Math.abs(z - h1) < .2) && x > g0 && x < g1;
      if (on && (((x + z + 20) % 1.2) < .7)) return 0xf7f7f2; }
    return stripes(x, z);
  };
}
const HOMES = {
  slab(B, P) {   // A · white, one storey, a roof slab running over a glass garage; an orange breeze-block screen and door
    garage(B, P, -8.6, -3.6, 5, 12.6, 3.2, C.white, [{ id: 'supercar', v: 0 }]);
    B.box(-3.6, 0, 6, 8.2, 3.2, 15.6, C.white);
    curtain(B, 1.0, 8.0, .1, 3.0, 6, true); door(B, -1.6, 6, C.orange);
    roof(B, -9.2, 4.2, 9.0, 16.8, 3.2, .35);
    breezeX(B, -3.4, 1.4, 3.4, 2.5, C.orange);
    pool(B, -2.4, 18.6, 7.6, 22);
    totem(B, 6.4, 2.6);
    hedge(B, -9, 14, -8.3, 25, 1.4); hedge(B, 8.3, 4, 9, 25, 1.4); hedge(B, -9, 24.3, 9, 25, 2.2);
    P.stamps.push([palm(12, 1), 0, 7.8, 0, 1.4], [palm(10, 2), 0, -8, 0, 23], [palm(13, 0), 0, 7.4, 0, 23.4], [lawnChair(C.orange), 2, 1.2, .3, 16.4], [lawnChair(C.orange), 2, 3.0, .3, 16.4], [umbrella(C.orange), 0, 5.6, .3, 16.2]);
    P.stamps.push([agave(0), 0, 2.6, 0, 3.6], [agave(1), 0, 4.3, 0, 3.8], [agave(2), 0, 6.0, 0, 3.4]);
    monolith(B, -2.4, .6, '1');
    P.chars.push({ lk: rollLook(0x5a11), x: -6.0, z: 3.4, ry: 0, act: 'arms' });
    lotPaint(P.L, { drive: [-8.4, -3.8, 5], path: [-1.6, 3.4], bed: [2, 7] });
  },
  butterfly(B, P) {   // B · teal, a butterfly roof over clerestory glass, a white breeze planter wall; the lowrider in the glass garage
    garage(B, P, -9.4, -4.6, 4.8, 12.2, 3.0, C.teal, [{ id: 'lowrider', v: 1 }]); roof(B, -9.8, 4.4, -4.6, 12.6, 3.0, .3);
    B.box(-4.6, 0, 6, 8.8, 2.8, 14.6, C.teal);
    curtain(B, 2.4, 8.2, .1, 2.7, 6, true); door(B, 0, 6, C.sign);
    const yt = x => 2.95 + Math.abs(x - 2.1) * .15;
    B.box(-5.4, 2.8, 5.0, 9.6, 4.4, 15.4, (x, y, z, i, j, k) => { const t = yt(x); if (y >= t || y < t - .3) return; return (y > t - .1 && x > -5.1 && x < 9.3 && z > 5.3 && z < 15.1) ? (H(i, k, 3) > .93 ? C.grey : C.pale) : C.chalk; });
    for (const zf of [6, 14.4]) B.box(-4.6, 2.8, zf, 8.8, 4.4, zf + .2, (x, y, z, i, j, k) => y < yt(x) - .3 ? (i % 12 === 0 ? C.chalk : glassF(true, 2.8, 4.2)(x, y, z, i, j, k)) : undefined);
    breezeX(B, -4.2, 1.6, 3.6, 1.4, C.white);
    pool(B, -3, 17, 7, 20.8);
    ring(B, 6.6, 2.4);
    hedge(B, -10, 13, -9.3, 24, 1.4); hedge(B, 9.3, 5, 10, 24, 1.4); hedge(B, -10, 23.3, 10, 24, 2.2);
    P.stamps.push([palm(11, 2), 0, 8.6, 0, 3.4], [palm(13, 1), 0, -8.2, 0, 22], [lawnChair(C.teal), 2, -1, .3, 15], [lawnChair(C.teal), 2, .8, .3, 15], [umbrella(C.sign), 0, 5, .3, 15]);
    P.stamps.push([agave(1), 0, -3.4, 0, 2.2], [agave(2), 0, -2, 0, 2.6]);
    monolith(B, -3.2, .6, '3');
    lotPaint(P.L, { drive: [-9.2, -4.8, 4.8], path: [0, 6], bed: [-4.2, -1] });
  },
  cantilever(B, P) {   // C · a yellow box cantilevered over a slate base and the garage, a ribbon window; chrome GG on the lawn
    B.box(-2.8, 0, 8.4, 6.2, 3.0, 15.2, C.slate);
    curtain(B, -2.2, 5.8, .1, 2.9, 8.4, true, C.chalk, 1.6); door(B, -1.4, 8.4, C.pink);
    garage(B, P, -9.2, -3.4, 5.2, 12.8, 3.0, C.slate, [{ id: 'livery', v: 0 }]);
    B.box(-9.8, 3.0, 5.0, 9.6, 6.2, 13.4, C.yellow);
    B.box(-9.0, 3.8, 4.9, 8.8, 5.6, 5.1, glassF(true, 3.8, 5.6)); for (let x = -9; x <= 8.9; x += 2.2) B.box(x - .05, 3.8, 4.8, x + .05, 5.6, 5.0, C.ink);
    B.box(-9.3, 6.1, 5.5, 9.1, 6.2, 12.9, (x, y, z, i, j, k) => H(i, k, 3) > .93 ? C.grey : C.pale);
    B.box(3, 3.0, 13.4, 6, 5.6, 13.6, glassF(false, 3, 5.6));
    pool(B, -4, 17.2, 8.2, 20.8);
    gg(B, 6.2, 2.2);
    hedge(B, -10, 13.5, -9.3, 24, 1.4); hedge(B, 9.3, 4, 10, 24, 1.4); hedge(B, -10, 23.3, 10, 24, 2.2);
    P.stamps.push([palm(12, 0), 0, 8.8, 0, 16], [palm(10, 3), 0, -8.6, 0, 16.5], [lawnChair(C.sign), 2, 1.2, .3, 15.6], [umbrella(C.pink), 0, 3.8, .3, 15.8]);
    P.stamps.push([agave(0), 0, 1, 0, 3.2], [agave(2), 0, 2.8, 0, 3.8]);
    monolith(B, -2.6, .6, '5');
    P.chars.push({ lk: L('bail.money'), x: 1.2, y: .55, z: 15.4, ry: Math.PI, act: 'lounge' }, { lk: rollLook(0x77c3), x: -.6, y: .3, z: 16.4, ry: Math.PI - .5, act: 'phone' });
    lotPaint(P.L, { drive: [-9, -3.6, 5.2], path: [-1.4, 8.4], bed: [.2, 5.4] });
  },
  vault(B, P) {   // D · the head of the loop: bone, stepped, a three-car glass gallery, a brass pivot door, the owner's gold statue
    garage(B, P, -9.6, -1.8, 4.4, 11.8, 3.4, C.bone, [{ id: 'lowrider', v: 3 }, { id: 'supercar', v: 1 }, { id: 'supercar', v: 5 }]);
    B.box(-1.8, 0, 7.6, 9.4, 3.4, 17.6, C.bone);
    curtain(B, .6, 9.0, .1, 3.3, 7.6, true, C.ink, 1.4); door(B, 1.8, 7.4, C.gold, 1.6, 3.1);
    B.box(-4.2, 3.4, 5.8, 7.4, 6.8, 16.4, C.bone);
    B.box(-3.6, 4.2, 5.7, 6.8, 6.0, 5.9, glassF(true, 4.2, 6.0)); for (let x = -3.6; x <= 6.9; x += 1.5) B.box(x - .05, 4.2, 5.6, x + .05, 6.0, 5.8, C.ink);
    B.box(-4.4, 6.8, 5.6, 7.6, 7.0, 16.6, C.chalk); B.box(-4.1, 6.9, 5.9, 7.3, 7.0, 16.3, (x, y, z, i, j, k) => H(i, k, 3) > .93 ? C.grey : C.pale);
    roof(B, -9.8, 4.2, -4.2, 12.0, 3.4, .3); roof(B, 7.4, 7.2, 9.6, 17.8, 3.4, .3);
    B.box(7.6, 3.7, 7.4, 9.4, 4.7, 7.5, 0xbfe6ff, 1);   // the terrace's glass rail
    curtain(B, .4, 9.0, .1, 3.3, 17.4, true, C.ink, 1.4); B.box(-3.6, 4.2, 16.4, 6.8, 6.0, 16.6, glassF(true, 4.2, 6.0));
    B.box(4.6, 0, 2.2, 7.4, .6, 5.0, C.granite, 1); P.statue = { x: 6.0, y: .6, z: 3.6 };
    pool(B, -8, 19.6, 8.4, 22.4, 1.2);
    hedge(B, -10, 12.5, -9.3, 24, 1.4); hedge(B, 9.3, 4, 10, 24, 1.4); hedge(B, -10, 23.4, 10, 24, 1.2);
    P.stamps.push([palm(14, 0), 0, -9.2, 0, 18.4], [palm(15, 2), 0, 9.0, 0, 18.8], [palm(11, 3), 0, 9, 0, 1.4], [lawnChair(C.chalk), 2, -5, .3, 17.8], [lawnChair(C.chalk), 2, -3.2, .3, 17.8], [umbrella(C.ink), 0, -.6, .3, 18]);
    P.stamps.push([agave(0), 0, 8.2, 0, 5.4], [agave(1), 0, 3.6, 0, 6.2]);
    monolith(B, -1, .6, '7');
    P.chars.push({ lk: rollLook(0x3b07), x: 2.9, z: 4.8, ry: -2.6, act: 'phone' });
    lotPaint(P.L, { drive: [-9.4, -2, 4.4], path: [1.8, 7.4] });
  },
  aframe(B, P) {   // E · pink A-frame (the roof is the building), a glazed gable, the hot tub; a giant sneaker on the lawn
    const cx = 2.6, hw = 4.4, top = 7.4;
    B.box(cx - hw - .4, 0, 5.4, cx + hw + .4, top + .2, 15.6, (x, y, z, i, j, k) => { const half = hw * (1 - y / top) + .35, dx = Math.abs(x - cx);
      if (dx > half) return; if (dx > half - .4) return y > top - .5 ? C.chalk : C.pink;
      if ((z >= 6.2 && z <= 14.8) || z < 6.0 || z > 15.0) return; return (z < 6.2 || z > 14.8) ? (Math.abs(x - cx) < .1 || j % 14 === 0 ? C.chalk : glassF(true, 0, top)(x, y, z, i, j, k)) : undefined; });
    B.box(cx - hw + .5, 0, 6, cx + hw - .5, .1, 15, C.trav);
    door(B, cx, 6.0, C.sign, 1.2, 2.4);
    garage(B, P, -9.2, -3.2, 5, 12.4, 3.0, C.white, [{ id: 'supercar', v: 3 }]); roof(B, -9.6, 4.6, -3.0, 12.8, 3.0, .3);
    pool(B, -3.6, 18, 5.4, 21.4);
    sneaker(B, 7.2, 1.2);
    hedge(B, -10, 13, -9.3, 24, 1.4); hedge(B, 9.3, 4, 10, 24, 1.4); hedge(B, -10, 23.3, 10, 24, 2.2);
    P.stamps.push([palm(12, 3), 0, -8.4, 0, 16], [palm(14, 1), 0, 8.6, 0, 18], [hotTub(), 0, 7.6, .3, 20.6], [lawnChair(C.pink), 2, -2.6, .3, 16.2], [umbrella(C.teal), 0, 1.6, .3, 16.4]);
    P.stamps.push([agave(2), 0, -1.6, 0, 3.4], [agave(0), 0, -.2, 0, 3.8]);
    monolith(B, -1.2, .6, '4');
    P.chars.push({ lk: rollLook(0x1e44), x: 9.0, z: 5.4, ry: Math.PI / 2 + .3, act: 'garden' });
    lotPaint(P.L, { drive: [-9, -3.4, 5], path: [cx, 6.2], bed: [-2.6, 1] });
  },
  avail(B, P) {   // an open lot: the ghost footprint chalked on the lawn, survey stakes with pink flags, the AVAILABLE board
    const g = [-6, 5, 6, 16];
    for (const [x, z] of [[g[0], g[1]], [g[2], g[1]], [g[0], g[3]], [g[2], g[3]]]) { B.box(x - .1, 0, z - .1, x + .1, .9, z + .1, C.wood); B.box(x - .1, .7, z + .1, x + .1, .9, z + .5, C.pink); }
    const bx = 0, bz = 2.2, M1 = px('AVAILABLE'), M2 = px('CLAIM IT'), bw = M1.w * .1 + .8;
    for (const x of [bx - bw / 2 + .5, bx + bw / 2 - .5]) B.box(x - .1, 0, bz + .4, x + .1, 3.3, bz + .6, C.ink);
    B.box(bx - bw / 2, 1.2, bz + .2, bx + bw / 2, 3.4, bz + .4, C.sign);
    B.box(bx - bw / 2, 1.2, bz + .2, bx + bw / 2, 2.1, bz + .4, C.pink);
    B.text(M1, bx, 3.2, bz + .2, '-z', C.ink, 1, 1, LITL); B.text(M2, bx, 2.0, bz + .2, '-z', C.chalk, 1, 1, LITL);
    addLightL(0xffe3a0, 8, 7, bx, 1.2, bz - 1.4);
    hedge(B, -10, 12, -9.3, 24, 1.4); hedge(B, -10, 23.3, 10, 24, 2.2);
    P.stamps.push([palm(11, P.L.id === 'X1' ? 2 : 0), 0, -8, 0, 1.6], [palm(13, 1), 0, 8, 0, 22]);
    lotPaint(P.L, { ghost: g });
  },
};
const L = h => structuredClone(LOOKS.find(x => x.handle === h));
// sculptures
function totem(B, x, z) { B.box(x - .7, 0, z - .7, x + .7, .3, z + .7, C.granite, 1); [[.9, C.red, .1], [.75, C.sign, -.12], [.6, C.blue, .08], [.45, C.chalk, 0]].reduce((y, [s, c, o]) => { B.box(x - s / 2 + o, y, z - s / 2, x + s / 2 + o, y + s, z + s / 2, c, 1); return y + s; }, .3); }
function ring(B, x, z) { B.box(x - .9, 0, z - .5, x + .9, .3, z + .5, C.granite, 1); B.box(x - 2, .3, z - .2, x + 2, 4.1, z + .2, (xx, y) => Math.abs(Math.hypot(xx - x, y - 2.1) - 1.6) < .24 ? C.red : undefined, 1); }
function gg(B, x, z) { const M = px('GG'); B.box(x - 1.9, 0, z - .4, x + 1.9, .25, z + .6, C.granite, 1); for (let d = 0; d < 4; d++) B.text(M, x, 2.4, z - .2 + d * .1 + .1, '-z', C.chrome, 3, 1, 2); }
function sneaker(B, x, z) {   // along −x (toe) → +x (heel), laces on top
  B.box(x - 1.8, 0, z - .8, x + 1.8, .2, z + .8, C.trav);
  B.box(x - 1.5, .2, z - .6, x + 1.5, 1.6, z + .6, (xx, y, zz) => { const u = xx - (x - 1.5), hwz = u < .5 ? .3 + .25 * u / .5 : .55, dz = Math.abs(zz - z); if (dz > hwz) return;
    const top = u < .8 ? .55 + .35 * u / .8 : u < 2.0 ? .9 + .2 * (u - .8) / 1.2 : 1.1 + .35 * (u - 2) / 1; if (y - .2 > top) return;
    if (u > 2.0 && u < 2.7 && y - .2 > .85 && dz < .32) return; const yy = y - .2;
    if (yy < .08) return 0xc9a26a; if (yy < .28) return C.chalk;
    if (dz < .22 && u > .9 && u < 2 && yy > top - .12) return (Math.round(u * 10) % 3 === 0) ? C.ink : C.chalk;
    if (u < .7 || u > 2.6) return C.blue; if (dz > hwz - .12 && Math.abs(yy - (.35 + (u - .7) * .22)) < .09) return C.lime; return C.chalk; }, 1); }

// build each lot in its own frame: a Box, the ground paint, stamps, cars, the people, panes
const lotGroups = [];
function buildLot(lot) {
  const g = new THREE.Group(); g.position.set(lot.ox, .2, lot.oz); g.rotation.y = lot.th * Math.PI / 180; scene.add(g); lotGroups.push(g);
  const B = new Box(-lot.W / 2 - .4, 0, -.6, lot.W / 2 + .4, 8.2, lot.D + .4, .1), P = { L: lot, stamps: [], cars: [], chars: [], panes: [] };
  LOTXF = (x, z) => lot.toW(x, z); HOMES[lot.kind](B, P); LOTXF = null;
  addBox(B, g, P.stamps);
  for (const c of P.cars) { const m = vehicleMesh(c.id, { variant: c.v, lights: false, driver: false, night: NIGHT }, MAT); m.position.set(c.x, .1, c.z); m.rotation.y = c.ry; g.add(m); }
  for (const p of P.panes) { const m = new THREE.Mesh(new THREE.BoxGeometry(p[3] - p[0], p[4] - p[1], p[5] - p[2]), PANE); m.position.set((p[0] + p[3]) / 2, (p[1] + p[4]) / 2, (p[2] + p[5]) / 2); m.renderOrder = 2; g.add(m); }
  for (const c of P.chars) person(g, c.lk, c.x, c.y ?? 0, c.z, c.ry, c.act);
  if (P.statue) { const o = person(g, L('56kballer'), P.statue.x, P.statue.y, P.statue.z, 0, 'win', 3); o.traverse(m => { if (!m.isMesh) return; const k = m.material.clone(); k.metalness = .3; k.roughness = .38; const ca = m.geometry.getAttribute('color');
    if (ca) { m.geometry = m.geometry.clone(); const a = m.geometry.getAttribute('color'); for (let v = 0; v < a.count; v++) { const l = .45 + .55 * Math.min(1, (.3 * a.getX(v) + .59 * a.getY(v) + .11 * a.getZ(v)) * 1.6); a.setXYZ(v, 1.0 * l, .74 * l, .16 * l); } a.needsUpdate = true; k.color = new THREE.Color(0xffffff); } else k.color = new THREE.Color(0xe7bd4a);
    m.material = k; }); }
}

// ── people (chars.js, posed like the city's cast)
function person(parent, lk, x, y, z, ry, act, scale = 1) {
  const o = build(lk); o.rotation.order = 'YXZ'; o.position.set(x, y, z); o.rotation.y = ry; if (scale !== 1) o.scale.setScalar(S * scale); pose(o, 0, 0); o.userData.open.visible = true;
  const rg = o.userData.rig, arms = (a, b) => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
  switch (act) {
    case 'arms': arms(-1.3, -.35); break; case 'talk': arms(-.55, 0); break; case 'talk2': arms(0, -.8); break; case 'phone': arms(0, -2.3); break;
    case 'carry': arms(-.25, -.15); break; case 'shoot': arms(-2.9, -2.8); break; case 'win': arms(-2.7, -2.5); break;
    case 'garden': arms(-1.1, -.9); o.rotation.x = .28; break;
    case 'lounge': rg.legL.rotation.x = rg.legR.rotation.x = -1.35; arms(.35, .35); o.rotation.x = -.35; break;
    case 'walk': pose(o, 1.2, 1); break;
  }
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); parent.add(o); return o;
}

// ── the landing: promenade rail, the pier, the terminal (MAINLAND on its fascia, the FERRY fin), the ferry
const DX = -14, LAND = new THREE.Group(); LAND.position.set(DX, .2, 0); scene.add(LAND);   // the landing sits 14 m west of its authored x
function landing(SB) {
  const T = new Box(-56, 0, 1.6, -26, 5.0, 20, .1);
  T.box(-52, 0, 6.8, -34, .1, 15.6, C.trav);
  T.box(-50, 0, 7.0, -36, 3.8, 15.2, (x, y, z, i, j, k) => { const edge = x < -49.8 || x > -36.2 || z < 7.2 || z > 15.0; if (!edge) return; return (i % 16 === 0 || k % 16 === 0 || j === 0) ? C.chalk : glassF(true, 0, 3.8)(x, y, z, i, j, k); });
  T.box(-49.8, 0, 12.4, -44, 3.7, 15.0, C.teal);   // the service core
  T.box(-54, 4.0, 2.4, -28, 4.4, 18.4, C.chalk); T.box(-53.6, 4.3, 2.8, -28.4, 4.4, 18.0, (x, y, z, i, j, k) => H(i, k, 3) > .93 ? C.grey : C.pale);
  T.box(-54, 3.2, 2.4, -28, 4.0, 2.6, C.teal); T.text(px('MAINLAND'), -41, 3.9, 2.4, '-z', C.chalk, 1, 1, LITL);
  for (const [x, z] of [[-53, 3.4], [-29, 3.4], [-53, 17.4], [-29, 17.4]]) T.box(x - .1, 0, z - .1, x + .1, 4.0, z + .1, C.ink);
  T.box(-46.2, 0, 3.4, -42.0, 2.2, 3.6, C.ink); T.box(-46.0, 1.2, 3.3, -42.2, 2.1, 3.4, 0x2a2a31); T.text(px('ISLAND'), -44.1, 2.0, 3.3, '-z', C.sign, 1, 1, 3);
  for (let x = -50; x < -34; x += 4) SB.push([bench(), 0, x + DX, .2, 17.2]);
  addBox(T, LAND); addLight(0xffe2b0, 30, 16, -43 + DX, 3.2, 10);
  const F = new Box(-56.2, 0, 2.0, -54.4, 13.0, 4.2, .1);   // the fin at the terminal's far end: FERRY stacked, lit by night
  F.box(-56.0, 0, 2.4, -54.6, 12.4, 4.0, C.pink); F.box(-56.1, 12.4, 2.3, -54.5, 12.6, 4.1, C.chalk);
  'FERRY'.split('').forEach((ch, n) => F.text(px(ch), -55.3, 11.6 - n * 2.2, 2.4, '-z', NIGHT ? 0xfff4f9 : C.chalk, 2, 1, LITL));
  addBox(F, LAND);
  // the pier (0.1): planks, stringers, piles, bollards, cleats
  const Pi = new Box(-41.4, -1.8, -40, -36.6, 1.0, 1.2, .1);
  Pi.box(-41.2, -.2, -39.6, -36.8, .0, .6, (x, y, z, i, j, k) => (k % 3 === 2) ? C.woodD : (H(k, 0, 4) > .8 ? 0xb4753c : C.wood));
  Pi.box(-41.4, -.4, -39.8, -36.6, -.2, .6, C.woodD);
  for (let z = -38; z < 0; z += 4) for (const x of [-41.1, -37.1]) Pi.box(x - .2, -1.8, z - .2, x + .2, -.2, z + .2, C.pile);
  for (let z = -36; z < 0; z += 8) { Pi.box(-41.3, 0, z - .15, -41.0, .4, z + .15, C.ink); Pi.box(-36.9, 0, z - .15, -36.6, .4, z + .15, C.ink); }
  addBox(Pi, LAND);
  for (const z of [-36]) SB.push([lampPost(), 1, -41.0 + DX, .2, z]);
  addLight(0xffd9a0, 14, 12, -38.5 + DX, 4, -24); addLight(0xffd9a0, 14, 12, -38.5 + DX, 4, -8);
  // the promenade: a rail on the seawall except the pier's mouth, bollards, lamps
  const R = new Box(-58, 0, .2, 86, 1.2, .8, .1);
  R.box(-58, 0, .3, 86, 1.1, .5, (x, y, z, i, j) => { if (x > -41.6 && x < -36.4) return; return j >= 9 ? C.chalk : (i % 20 === 0 ? C.chalk : j === 4 ? C.grey : undefined); });
  addBox(R, LAND);
  for (let x = -66; x < 70; x += 12) if (x < -58 || x > -46) SB.push([lampPost(), 1, x, .2, 1.2]);
  const b = ferry(); stamp(b, SB.ferry, 2, -45.4 + DX, -.55 - .8, -20);
  const G = new Box(-41.6, 0, -21.2, -40.8, .8, -18.8, .1); G.box(-41.6, 0, -21.2, -40.8, .1, -18.8, C.grey); G.box(-41.6, .1, -21.2, -40.8, .6, -21.0, C.chalk); G.box(-41.6, .1, -19.0, -40.8, .6, -18.8, C.chalk); addBox(G, LAND);
}

// ── the gate: breeze-block and stucco walls, ROOT ACCESS in brass, the gatehouse under a floating canopy, booms, pillars
function gate(SB) {
  const Wl = new Box(-48.2, 0, 35.4, -6.4, 4.2, 37.0, .1);
  Wl.box(-48, 0, 36, -8, 3.2, 36.6, C.bone); Wl.box(-48.1, 3.2, 35.9, -7.9, 3.4, 36.7, C.slate);
  Wl.box(-34, 0, 35.8, -12, .2, 36.0, NIGHT ? [0xffe3a0, 3] : C.slate);   // the wall-washer slot
  const M = rasterMask('ROOT ACCESS', '900 30px "Helvetica Neue", Helvetica, Arial, sans-serif');
  Wl.text(M, -26, 2.8, 36, '-z', NIGHT ? C.goldL : C.gold, 1, 2, NIGHT ? 3 : 2);
  Wl.box(-8, 0, 35.6, -6.6, 3.6, 37.0, C.white); Wl.box(-8.1, 3.6, 35.5, -6.5, 3.8, 37.1, C.slate); Wl.box(-7.8, 3.8, 35.8, -6.8, 4.1, 36.8, NIGHT ? [0xffe3a0, 3] : C.chalk);
  addBox(Wl, LIFT);
  const We = new Box(6.4, 0, 35.4, 48.2, 4.2, 37.0, .1);
  breezeX(We, 8, 48, 36.1, 2.8, C.white); We.box(6.6, 0, 35.6, 8, 3.6, 37.0, C.white); We.box(6.5, 3.6, 35.5, 8.1, 3.8, 37.1, C.slate); We.box(6.8, 3.8, 35.8, 7.8, 4.1, 36.8, NIGHT ? [0xffe3a0, 3] : C.chalk);
  We.box(8.8, 1.0, 35.9, 15.2, 2.2, 36.1, C.slate); We.text(px('RESIDENTS'), 12, 2.05, 35.9, '-z', C.chalk, 1, 1, LITL); We.box(8.8, .9, 35.9, 15.2, 1.0, 36.1, C.pink);
  addBox(We, LIFT);
  const Gh = new Box(-6.4, 0, 30.4, 6.4, 4.4, 41.6, .1);
  Gh.box(-1.1, 0, 33.8, 1.1, 2.7, 37.8, (x, y, z, i, j, k) => (y > 1.0 && y < 2.4 && (Math.abs(x) > .95 || z < 34 || z > 37.6) && !(z < 34 && Math.abs(x) < .4 && y < 2.4)) ? glassF(true, 1.0, 2.4)(x, y, z, i, j, k) : C.bone);
  Gh.box(-.4, 0, 33.7, .4, 2.3, 33.8, C.orange);
  Gh.box(-6.2, 3.0, 32.8, 6.2, 3.3, 38.8, C.chalk); Gh.box(-6.0, 3.25, 33.0, 6.0, 3.3, 38.6, C.pale); Gh.box(-6.2, 2.9, 32.8, 6.2, 3.0, 33.0, NIGHT ? [0xffe3a0, 3] : C.chalk);
  for (const x of [-5.9, 5.9]) for (const z of [33.2, 38.4]) Gh.box(x - .1, 0, z - .1, x + .1, 3.0, z + .1, C.ink);
  Gh.box(1.2, 0, 32.4, 1.6, 1.1, 32.8, C.ink); Gh.box(1.6, .9, 32.5, 4.3, 1.0, 32.7, (x, y, z, i) => ((i / 4) | 0) % 2 ? C.red : C.chalk);   // the inbound boom
  Gh.box(-1.6, 0, 39.2, -1.2, 1.1, 39.6, C.ink); Gh.box(-4.3, .9, 39.3, -1.6, 1.0, 39.5, (x, y, z, i) => ((i / 4) | 0) % 2 ? C.red : C.chalk);
  Gh.box(-.25, 0, 31.4, .25, 1.3, 31.8, C.slate); Gh.box(-.2, .9, 31.3, .2, 1.2, 31.4, NIGHT ? [0x6cff4a, 3] : C.ink);   // the call box
  addBox(Gh, LIFT); addLight(0xffe2b0, 16, 10, 0, 2.8, 35.8);
  person(scene, look({ handle: 'guard', skin: 'brown', hat: { id: 'fitted', c: 0x1b2a4a, m: 0xe7bd4a }, eyewear: { id: 'wrap' }, eyes: 'mean', mouth: 'flat', top: { id: 'track', c: 0x1b2a4a }, bottom: { id: 'track', c: 0x1b2a4a }, shoes: { id: 'boots' }, held: { id: 'flip' } }), .9, .2, 33.0, -.35, 'talk2');
  // the street sign inside the gate: SUDO CT, and NO OUTLET under it
  const Sg = new Box(-6.4, 0, 40.2, -3.0, 3.6, 41.0, .1);
  Sg.box(-5.0, 0, 40.5, -4.8, 3.2, 40.7, C.ink); Sg.box(-6.2, 2.4, 40.4, -3.6, 3.3, 40.5, C.green); Sg.text(px('SUDO CT'), -4.9, 3.2, 40.4, '-z', C.chalk, 1, 1);
  Sg.box(-5.9, 1.3, 40.4, -3.9, 2.2, 40.5, C.sign); Sg.text(px('NO'), -4.9, 2.15, 40.4, '-z', C.ink, 1, 1); addBox(Sg, LIFT);
  // the allee: palms both sides from the promenade to the gate and on up the stem, lamps between
  for (let z = 10; z < 34; z += 9) for (const x of [-7.6, 7.6]) SB.push([palm(15 + (z % 3), (z | 0) & 3), 0, x, .2, z]);
  for (let z = 44; z < 70; z += 10) for (const x of [-7.4, 7.4]) SB.push([palm(16 + (z % 2), ((z | 0) + 1) & 3), 0, x, .2, z]);
  for (const z of [20, 52]) for (const [x, q] of [[-5.3, 1], [5.3, 3]]) SB.push([lampPost(), q, x, .2, z]);
  for (let a = 0; a < 6; a++) { const t = (a / 6) * Math.PI * 2 + .5; SB.push([lampPost(), 0, Math.sin(t) * 16.4, .2, CZ + Math.cos(t) * 16.4]); }
  // the outside: desert beds with agaves and bollards along the plaza
  for (let k = 0; k < 26; k++) { const x = 10 + H(k, 1) * 36, z = 8 + H(k, 2) * 24; SB.push([agave(k % 3), k & 3, x, .2, z]); }
  for (let k = 0; k < 14; k++) { const x = -54 + H(k, 5) * 44, z = 24 + H(k, 6) * 8; if (x > -8) continue; SB.push([agave(k % 3), k & 3, x, .2, z]); }
  for (let x = -26; x < -8; x += 3) SB.push([bollard(), 0, x, .2, 7.0]);
  for (const [x, z] of [[-22, 14], [-12, 22]]) SB.push([planterT(C.white), 0, x, .2, z], [palm(13, 1), 0, x, .6, z]);
}

// ── the loop's island: a round basin; the giant pink cursor stands on its tip and clicks the water (rings ripple out)
function island() {
  const I = new Box(-7, 0, CZ - 7, 7, 1.0, CZ + 7, .1);
  I.cyl(0, CZ, 5.0, 0, .6, C.bone); I.cyl(0, CZ, 4.6, 0, .6, (x, y, z, i, j, k) => { if (y > .45) return -1; const r = Math.hypot(x, z - CZ), rip = [.9, 1.9, 3.1].some(q => Math.abs(r - q) < .09);
    if (NIGHT) return [rip ? 0xd8fbff : r > 4.2 ? 0x1aa6ee : 0x46dcff, 3]; return [rip ? 0xf4f8fb : r > 4.2 ? C.waterD : C.water, 1]; });
  I.cyl(0, CZ, 6.8, 0, .1, (x, y, z) => Math.hypot(x, z - CZ) > 5 ? C.hedgeT : undefined);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; I.box(Math.sin(a) * 5.9 - .4, 0, CZ + Math.cos(a) * 5.9 - .4, Math.sin(a) * 5.9 + .4, .7, CZ + Math.cos(a) * 5.9 + .4, C.hedge); }
  addBox(I, LIFT); addLight(0x46d8ff, 30, 12, 0, 1.2, CZ);
  const rows = ['#...........', '##..........', '#o#.........', '#oo#........', '#ooo#.......', '#oooo#......', '#ooooo#.....', '#oooooo#....', '#ooooooo#...', '#oooooooo#..', '#ooooooooo#.',
    '#oooooo#####', '#ooo#oo#....', '#oo##oo#....', '#o#..#oo#...', '##...#oo#...', '#.....#oo#..', '......#oo#..', '.......##...'];
  const K = new Box(-.1, 0, -.4, 3.8, 6.0, .4, .1);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; const y = (rows.length - 1 - j) * .3; K.box(i * .3, 5.7 - y - .3 + .0, -.3, i * .3 + .3, 5.7 - y, .3, ch === '#' ? C.chalk : C.pink, 1); }));
  const g = new THREE.Group(); g.position.set(-.4, .62, CZ); g.rotation.set(0, .22, -.42); scene.add(g); addBox(K, g);
}

// the enclave's perimeter: a clipped ficus wall, 2.6 m, round the lawns (the street wall carries the name)
function perimeter() { const P = new Box(-48.8, 0, 36.4, 48.8, 2.8, 134.8, .2);
  hedge(P, -48.8, 36.6, -48, 134.8, 2.6); hedge(P, 48, 36.6, 48.8, 134.8, 2.6); hedge(P, -48, 134, 48, 134.8, 2.6); addBox(P, LIFT); }
// ── the backdrop: the LA hills (2 m), with white boxes on the ridges; the island across the water (a haze-tinted silhouette)
function hills() {
  const B = new Box(-240, 0, 20, 240, 60, 360, 2);
  const h = (x, z) => { const ex = Math.max(0, Math.abs(x) - 62), ez = Math.max(0, z - 140); if (z < 26 && Math.abs(x) < 90) return 0;
    const d = Math.max(ez * .42, ex * .34 * Math.min(1, (z - 20) / 30)); if (d <= 0) return 0;
    const n = Math.sin(x * .021 + 1.3) * 7 + Math.sin(x * .047 - z * .013) * 5 + Math.sin(z * .031 + x * .011) * 5; return Math.max(0, Math.min(52, d + n * Math.min(1, d / 14))); };
  B.box(-240, 0, 20, 240, 60, 360, (x, y, z, i, j, k) => { const t = h(x, z); if (y > t) return; const n = H(i >> 2, k >> 2, 17);
    if (y > t - 2) return n > .72 ? 0x5f8a3c : n > .45 ? 0x9aa75a : t > 30 ? 0xc9a45c : 0xd6b36a; return 0x9a7a4a; });
  for (let n = 0; n < 16; n++) { const x = -180 + H(n, 21) * 360, z = 170 + H(n, 22) * 110, t = h(x, z); if (t < 6) continue;
    B.box(x - 6, t - 2, z - 4, x + 6, t + 4, z + 4, n % 3 ? C.white : C.bone); B.box(x - 5, t + 1, z - 4.1, x + 5, t + 3, z - 3.9, NIGHT ? [PAL.litLo, 3] : PAL.glassLo); }
  for (let n = 0; n < 30; n++) { const x = -200 + H(n, 31) * 400, z = 150 + H(n, 32) * 150, t = h(x, z); if (t < 4) continue; B.box(x - 1, t, z - 1, x + 1, t + 14, z + 1, C.trunk); B.box(x - 3, t + 14, z - 3, x + 3, t + 16, z + 3, C.leafD); }
  addBox(B, scene, [], MAT, true);
}
function island2() {   // AI City across the water: towers (Gatehill tallest), the docks' cranes, Iron Island's lighthouse
  const B = new Box(-330, 0, -470, 230, 140, -250, 2), hz = t => mixC(t, HOR, NIGHT ? .55 : .3);
  B.box(-330, 0, -430, 150, 3, -300, hz(0x8a9a7a));
  for (let n = 0; n < 110; n++) { const x = -300 + H(n, 1) * 420, z = -420 + H(n, 2) * 100, gh = x > -120 && x < -30 && z < -350;
    const h = gh ? 50 + H(n, 3) * 76 : 8 + H(n, 3) ** 2 * 46, w = gh ? 8 + H(n, 4) * 6 : 8 + H(n, 4) * 14, d = 8 + H(n, 5) * 10;
    const base = [C.white, C.bone, C.grey, C.slate, C.white, 0x9b4f3a, 0xffc21a, 0xef4a2a, 0xff4fa3, 0x7a3cff, 0x3fa9f5, 0x2f5bff, 0x12b3a0, 0xff7a1a, 0x25b84c][(H(n, 6) * 15) | 0], col = hz(base), win = hz(mixC(base, PAL.glassLo, .55));
    B.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, (xx, y, zz, i, j, k) => NIGHT && (i + k) % 2 === 0 && j % 2 === 1 && H(i + n, j, k) > .55 ? [mixC(PAL.litLo, HOR, .25), 3] : [NIGHT ? mixC(0x141a3a, HOR, .35) : (j % 2 === 1 && (i + k) % 2 === 0 && j < h / 2 - 1 ? win : col), 3]);
    if (h > 30 && n % 2) B.box(x - w / 2 + 2, h, z - d / 2 + 2, x + w / 2 - 2, h + 8, z + d / 2 - 2, [NIGHT ? mixC(0x141a3a, HOR, .35) : hz(shadeC(base, .9)), 3]);
    if (gh && n % 3 === 0) B.box(x - 1, h, z - 1, x + 1, h + 14, z + 1, [NIGHT ? 0x141a3a : hz(C.gold), 3]); }
  for (const x of [80, 104]) { B.box(x, 0, -330, x + 2, 34, -328, [hz(0xef4a2a), 3]); B.box(x - 10, 30, -330, x + 18, 33, -328, [hz(0xef4a2a), 3]); }
  B.box(-330, 0, -470, 230, 2, -440, [hz(0x8a9a7a), 3]);
  addBox(B, scene, [], FAR, false);
  // Iron Island: the rock, the wall, the lighthouse (red and white bands, the lantern)
  const Lh = new Box(10, -1, -260, 70, 34, -210, .5), LX = 56, LZ = -236;
  Lh.box(10, -1, -260, 70, 2, -222, (x, y, z) => Math.hypot((x - 40) / 30, (z + 241) / 19) < 1 ? [hz(0x8e9299), 3] : undefined);
  Lh.box(16, 2, -256, 54, 7, -232, (x, y, z, i, j, k) => (Math.abs(x - 35) > 18.4 || Math.abs(z + 244) > 11.4) ? [hz(C.grey), 3] : undefined);
  Lh.cyl(LX, LZ, 2.2, 2, 24, (x, y) => [hz(((y / 3) | 0) % 2 ? C.chalk : 0xe8232a), 3]);
  Lh.cyl(LX, LZ, 3.0, 24, 25, [hz(C.ink), 3]); Lh.cyl(LX, LZ, 1.8, 25, 28, NIGHT ? [0xfff2c0, 3] : [hz(0x9fdcff), 3]); Lh.cyl(LX, LZ, 2.2, 28, 30, [hz(0xe8232a), 3]);
  addBox(Lh, scene, [], FAR, false);
  if (NIGHT) { const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 150, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: .1, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(56 - 70, 26.5, -236 + 30); beam.rotation.set(0, 0, 0); beam.lookAt(56, 26.5, -236); beam.rotateX(Math.PI / 2); scene.add(beam); }
  // cubic clouds (day)
  if (!NIGHT) { const Cl = new Box(-320, 90, -420, 320, 150, 220, 6); for (let n = 0; n < 12; n++) { const x = -280 + H(n, 41) * 560, z = -400 + H(n, 42) * 600, y = 110 + H(n, 43) * 25, w = 30 + H(n, 44) * 50;
    for (let q = 0; q < 5; q++) { const ox = (H(n, q, 45) - .5) * w, oz = (H(n, q, 46) - .5) * w * .5, r = w * (.25 + H(n, q, 47) * .2); Cl.box(x + ox - r, y, z + oz - r * .6, x + ox + r, y + 6 + H(n, q, 48) * 12, z + oz + r * .6, (xx, yy) => [yy < y + 3 ? 0xeef6ff : 0xffffff, 3]); } } addBox(Cl, scene, [], FAR, false); }
}

// ── arrivals: people on the pier and the plaza, the car waiting at the landing
function arrivals() {
  person(scene, L('www.girl'), -38.0 + DX, .2, -9.0, 2.4, 'shoot');
  person(scene, Object.assign(rollLook(0x4d21), { held: { id: 'duffel' } }), -39.6 + DX, .2, -6.4, .15, 'carry');
  person(scene, Object.assign(L('late.night'), { held: { id: 'duffel' } }), -38.4 + DX, .2, -2.8, .05, 'walk');
  person(scene, rollLook(0x2f90), -40.2 + DX, .2, -19.6, -.4, 'talk');
  person(scene, rollLook(0x3c55), -1.4, .2, 30.4, Math.PI - .4, 'talk2');
  person(scene, rollLook(0x6a02), -20.4, .2, 13.4, 2.4, 'phone');
  person(scene, L('dealwithit.mp3'), -11.2, .2, 77.6, 2.2, 'talk'); person(scene, rollLook(0x81c9), -12.3, .2, 76.6, 2.2 + Math.PI - .5, 'talk2');
  person(scene, rollLook(0x9e13), -14.2, .2, 1.3, Math.PI + .15, 'phone'); person(scene, L('tag.crew'), -12.6, .2, 1.4, Math.PI - .2, 'arms');
  const x2 = LOTS.find(l => l.id === 'X2'), [sx, sz] = x2.toW(1.5, 5.5); person(scene, L('macpaint.artist'), sx, .2, sz, x2.th * Math.PI / 180 + Math.PI + .3, 'shoot');
  const car = vehicleMesh('livery', { variant: 1, lights: NIGHT, driver: true, night: NIGHT }, MAT); car.position.set(-2.6, 0, 16); car.rotation.y = 0; scene.add(car);
  const cart = vehicleMesh('supercar', { variant: 4, lights: NIGHT, driver: true, night: NIGHT }, MAT); cart.position.set(2.6, 0, 58); cart.rotation.y = Math.PI; scene.add(cart);
}

// ── build it all
const SBk = new Bank(), SB = []; SB.ferry = SBk;
for (const Lt of LOTS) buildLot(Lt); ground(); landing(SB); gate(SB); island(); perimeter(); hills(); island2(); arrivals();
for (const s of SB) stamp(s[0], SBk, s[1], s[2], s[3], s[4]);
addBank(SBk, [0, 0, 0]);
// night: the lights nearest the camera (a budget), the moon on the water
function placeLights(cam) { if (!NIGHT) return; for (const l of scene.userData.pl || []) scene.remove(l);
  const pick = LIGHTS.map(l => [l, Math.hypot(l[3] - cam.x, l[5] - cam.z)]).sort((a, b) => a[1] - b[1]).slice(0, 18);
  scene.userData.pl = pick.map(([[c, i, d, x, y, z]]) => { const p = new THREE.PointLight(c, i, d, 1.5); p.position.set(x, y, z); scene.add(p); return p; }); }
for (const g of lotGroups) g.updateMatrixWorld(true);

// ── camera, views, shadows fitted per view, the haze by height
const VIEWS = {
  arrive: { cam: [-54.2, 2.4, -17.6], look: [-24, 3.8, 34], fov: 54 },
  above: { cam: [46, 66, 20], look: [0, 0, 80], fov: 44 },
  street: { cam: [2.4, 2.9, 62], look: [-.5, 3.4, 112], fov: 54 },
  home: { cam: [-1.5, 1.5, 93.5], look: [1.8, 3.0, 112], fov: 46 },
  night: { cam: [13, 4.4, 135.5], look: [-4, 2.6, 100], fov: 55 },
  island: { cam: [-24.2, 2.3, 6.2], look: [-30, 17, -300], fov: 36 },
};
const camera = new THREE.PerspectiveCamera(54, W / Hh, .1, 4000), controls = new OrbitControls(camera, renderer.domElement);
const V3 = s => s.split(',').map(Number);
let viewName = Q.get('view') || (NIGHT ? 'night' : 'arrive');
function setView(k) { const v = VIEWS[k] || VIEWS.arrive; viewName = k;
  camera.position.set(...(Q.get('cam') ? V3(Q.get('cam')) : v.cam)); controls.target.set(...(Q.get('look') ? V3(Q.get('look')) : v.look)); camera.fov = +(Q.get('fov') || v.fov); camera.updateProjectionMatrix(); controls.update(); fit(); placeLights(camera.position);
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === k)); }
function fit() {   // the sun's shadow box round the part of the ground in view; the fade band by eye height (STYLE §4)
  const t = controls.target, c = camera.position, dir = new THREE.Vector3().subVectors(t, c).setY(0); const reach = Math.min(70, Math.max(30, dir.length()));
  dir.normalize(); const f = new THREE.Vector3(c.x + dir.x * reach * .8, 0, c.z + dir.z * reach * .8);
  sun.target.position.copy(f); sun.position.copy(f).addScaledVector(SUN_DIR, 150); const R2 = reach * 1.15; Object.assign(sun.shadow.camera, { left: -R2, right: R2, top: R2, bottom: -R2, near: 10, far: 320 }); sun.shadow.camera.updateProjectionMatrix();
  const u = THREE.MathUtils.clamp((c.y - 6) / 144, 0, 1); scene.fog.near = 90 + 60 * u; scene.fog.far = 380 - 40 * u;
}
controls.addEventListener('end', () => { fit(); placeLights(camera.position); });
const vb = document.getElementById('views'); for (const k of Object.keys(VIEWS)) { const b = document.createElement('button'); b.textContent = k; b.dataset.v = k; b.onclick = () => { const u = new URL(location); u.searchParams.set('view', k); u.searchParams.delete('cam'); u.searchParams.delete('look'); history.replaceState(null, '', u); setView(k); }; vb.appendChild(b); }
document.getElementById('tod').onclick = () => { const u = new URL(location); if (NIGHT) u.searchParams.delete('tod'); else u.searchParams.set('tod', 'night'); u.searchParams.set('view', viewName); location.href = u; };
setView(viewName);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__mainland = { scene, camera, controls, setView, VIEWS };
