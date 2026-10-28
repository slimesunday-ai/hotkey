// Preview board for the sim-state assets: every piece in every state, mounted on real kit.js facades (the same window and door depths
// the generator uses), under STYLE.md's light, with chars.js people for scale.
//   ?view=all | facade | piles | street | lots · ?tod=night · ?shot=1 (renders once, then document.title = 'ready') · ?labels=0
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PAL, SIDE } from '../style.js';
import { TOD, mass, win, AIR } from '../kit.js';
import { Vol, Bank, meshVol, stamp, boxInto } from '../vox.js';
import { geoOf } from '../glue.js';
import { build, LOOKS } from '../cast.js';

const Q = new URLSearchParams(location.search), NIGHT = Q.get('tod') === 'night', SHOT = Q.has('shot'), VIEW = Q.get('view') || 'all';
TOD.night = NIGHT;                                                        // before any piece is built (lit layers follow it)
const A = await import('./index.js');
const { lampPost } = await import('../props.js');

// ── renderer, sky, haze, light: STYLE.md §3–4 (the city's numbers)
const W = +(Q.get('w') || innerWidth), H = +(Q.get('h') || innerHeight);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(SHOT ? 1 : Math.min(2, devicePixelRatio)); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(), C = h => new THREE.Color(h), skyTop = C(NIGHT ? PAL.nightTop : PAL.sky), skyHor = C(NIGHT ? PAL.nightHor : PAL.horizon);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: skyTop }, hor: { value: skyHor }, gnd: { value: skyHor } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top, hor, gnd; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : gnd; gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n}' });
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
{ const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone())); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .02).texture; scene.environmentIntensity = NIGHT ? .25 : .55; }
scene.fog = new THREE.Fog(skyHor, 90, 380);
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3.0), sunDir = new THREE.Vector3(-0.52, 0.74, 0.42).normalize();
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = .03;
sun.position.copy(sunDir).multiplyScalar(80); sun.target.position.set(0, 0, 0); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
scene.add(sun, sun.target, new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
const MATS4 = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
const lamps = [];

// ── one bank for the board (ground, facades, pieces, props)
const bank = new Bank(true), put = (V, rot, x, y, z) => stamp(A.bankOf(V), bank, rot, x, y, z), slab = (x0, y0, z0, x1, y1, z1, c) => boxInto(bank, 0, x0, y0, z0, x1, y1, z1, c);
const labels = [], label = (text, x, y, z, views = ['all'], sm = false) => labels.push({ text, p: new THREE.Vector3(x, y, z), views, sm });
const people = [], person = (k, x, y, z, ry = 0) => people.push({ k, x, y, z, ry });

// ground: road, two sidewalks with curbs, the lots and the pile yard
slab(-60, -0.2, -60, 60, 0, 60, PAL.asphalt);
slab(-27, 0, -18, 25, SIDE, -9.2, PAL.walk); slab(-27, 0, -9.2, 25, SIDE, -9, PAL.curbTop);
for (let x = -26; x < 25; x += 3) slab(x, 0, -6.08, x + 1.8, .012, -5.92, PAL.lineW);
slab(-27, 0, -3, 25, SIDE, -2.8, PAL.curbTop); slab(-27, 0, -2.8, 25, SIDE, 7.4, PAL.walk);
for (let x = -26; x < 25; x += 2) slab(x, SIDE, -2.8, x + .04, SIDE + .006, 7.4, PAL.joint);

// ── the walk-up: a yellow three-storey on kit.js (26 m front, ground floor of doors, two floors of windows)
const WALK = { x0: -24, z: -11 }, wv = (() => {
  const B = { x0: 2, z0: 2, x1: 262, z1: 42 }, V = new Vol(264, 110, 48, { org: [WALK.x0 - .2, SIDE, WALK.z - 4.2], ground: true }), F = mass(V, B, 96, 0xffc21a, PAL.cream, ['+z']), f = F('+z');
  const X = a => WALK.x0 + a * .1;                                                                      // world x of facade column a (+ B.x0 offset folded in)
  const resi = (a, col) => { f.box(a - 1, 0, 0, a + 15, 28, 3, PAL.cream); f.box(a + 1, 1, -3, a + 13, 25, 3, AIR); f.box(a + 1, 1, -4, a + 13, 25, -3, (aa, y) => y > 20 ? 0xffe3a0 : col, 1); return { x: X(a + 7), y0: 1, w: 12, h: 24 }; };
  const shop = (a0, a1, door, name) => { f.box(a0, 0, 0, a1, 36, 2, PAL.ink); f.box(a0, 27, 0, a1, 36, 4, PAL.red); f.text(name, (a0 + a1) >> 1, 35, 4, 5, PAL.white, NIGHT ? 3 : 0, 1, 1);
    f.box(door, 1, -4, door + 13, 26, 3, AIR); f.box(door, 1, -5, door + 13, 26, -4, (a, y) => (y > 21 || a === door + 6) ? 0xffe3a0 : 0x2a2d38, 1); return { x: X(door + 6.5), y0: 1, w: 13, h: 25 }; };
  const doors = { lock: resi(6, 0x0b5a3a), door: resi(40, 0x7a1020), gate: shop(70, 104, 76, 'PAWN'), gateOpen: shop(106, 140, 112, 'BAGELS'), foreclosed: resi(148, 0x2f5bff), boarded: resi(182, 0x17171b), burned: resi(214, 0x0b5a3a), plain: resi(242, 0x7a1020) };
  const wins = [0, 1].map(fl => Array.from({ length: 8 }, (_, k) => { const a = 12 + k * 31, y0 = 43 + fl * 30; win(f, a, y0, 13, 17, PAL.cream); return { x: X(a + 6.5), y0, w: 13, h: 17 }; }));
  meshVol(V, bank); return { doors, wins };
})();
const onWall = (o, V, dy = 0) => put(V, 0, o.x, SIDE + (o.y0 + dy) * .1, WALK.z);
const D = wv.doors, [F2, F3] = wv.wins;
onWall(D.lock, A.security('lock', { w: 12, h: 24 })); put(A.security('buzzer'), 0, D.lock.x + 1.05, SIDE + 1.0, WALK.z);
onWall(D.door, A.security('door', { w: 12, h: 24 })); put(A.security('camera'), 0, D.door.x, SIDE + 2.95, WALK.z);
onWall(D.gate, A.security('gate', { w: 13, h: 25 })); onWall(D.gateOpen, A.security('gate', { w: 13, h: 25, open: .5 }));
onWall(D.foreclosed, A.scar('foreclosed', { w: 12, h: 24, door: true })); onWall(D.boarded, A.scar('boarded', { w: 12, h: 24, door: true })); onWall(D.burned, A.scar('burned', { w: 12, h: 24, door: true }));
const WC = [null, ['zzz'], ['curtain', 0], ['rentcard'], ['forRent'], ['bars'], ['burned'], null], WC3 = [['boarded'], ['foreclosed'], ['curtain', 3], ['zzz'], ['burned'], ['curtain', 1], ['forRent'], null];
const mount = (o, spec) => { if (!spec) return; const [k, seed] = spec;
  if (k === 'rentcard') put(A.forRentSign({ style: 'window' }), 0, o.x - .1, SIDE + o.y0 * .1, WALK.z);
  else if (k === 'bars') onWall(o, A.security('gate', { style: 'bars', w: o.w, h: o.h }));
  else if (['burned', 'boarded', 'foreclosed'].includes(k)) onWall(o, A.scar(k, { w: o.w, h: o.h, door: false }));
  else onWall(o, A.windowCard(k, { w: o.w, h: o.h, seed })); };
F2.forEach((o, k) => mount(o, WC[k])); F3.forEach((o, k) => mount(o, WC3[k]));
const WL = { zzz: 'asleep · zzz', curtain: 'curtain', rentcard: 'for rent · window', forRent: 'vacant · for rent', bars: 'gate · bars', burned: 'burned', boarded: 'boarded', foreclosed: 'foreclosed' };
F2.forEach((o, k) => WC[k] && label(WL[WC[k][0]], o.x, SIDE + (o.y0 + 19) * .1, WALK.z + .3, ['facade'], true));
F3.forEach((o, k) => WC3[k] && label(WL[WC3[k][0]], o.x, SIDE + (o.y0 + 19) * .1, WALK.z + .3, ['facade'], true));
[['lock + buzzer', D.lock], ['reinforced door + camera', D.door], ['gate · roll-down', D.gate], ['gate · open 0.5', D.gateOpen], ['foreclosed', D.foreclosed], ['boarded', D.boarded], ['burned', D.burned]]
  .forEach(([t, o]) => label(t, o.x, SIDE + 3.25, WALK.z + .4, ['facade'], true));
label('walk-up: <i>windows · doors · security · scars</i>', -11, 10.6, WALK.z, ['all']);

// ── the tower podium (kit.js mass + the tower's ink ground floor and glass bays) and the doorman lobby at its centre
const TW = { x0: 6, z: -11 };
{ const B = { x0: 2, z0: 2, x1: 162, z1: 62 }, V = new Vol(164, 76, 68, { org: [TW.x0 - .2, SIDE, TW.z - 6.2], ground: true }), F = mass(V, B, 66, 0x12b3a0, PAL.white, ['+z'], { parapet: 3 }), f = F('+z');
  f.box(0, 0, 0, f.len, 36, 2, PAL.ink); f.box(0, 27, 0, f.len, 36, 3, PAL.white);
  for (let a = 6; a + 24 < f.len - 4; a += 30) { f.box(a, 3, -3, a + 24, 28, 3, AIR); f.box(a, 3, -4, a + 24, 28, -3, (aa, y) => y > 22 ? PAL.litHi : 0x243a6a, 1); }
  for (const a0 of [10, 37, 64, 91, 118]) win(f, a0 + 7, 42, 13, 17, PAL.white);
  meshVol(V, bank); }
const LX = TW.x0 + 8, LOB = A.doormanLobby({ width: 56 }); put(LOB, 0, LX, SIDE, TW.z);
put(A.forRentSign({ style: 'lobby' }), 0, LX - 3.3, SIDE, TW.z + .75);
person(12, LX + A.STAND.x, SIDE, TW.z + A.STAND.z, 0);                                                  // the doorman on his spot
label('doorman lobby', LX, 4.6, TW.z + 1, ['all', 'street']); label('for rent · lobby', LX - 3.3, 2.5, TW.z + .8, ['street'], true);

// ── the road: patrol cars, lights off and on
put(A.patrolCar({ lights: false }), 3, 7.5, 0, -7.4); put(A.patrolCar({ lights: true }), 1, 20, 0, -4.6);
label('patrol · lights off', 7.5, 2.5, -7.4, ['all', 'street'], true); label('patrol · lights on', 20, 2.5, -4.6, ['all', 'street'], true);
person(2, 21.4, SIDE, -2.0, -.3);

// ── the corner row: hotspot heat 0 · .25 · .5 · .75 · 1 (front = +z)
// (?compact=1: the tight corners' set, 3.2 × 2.6 m, in the same row)
const HZ = 3.4, CMP = Q.get('compact') === '1'; [0, .25, .5, .75, 1].forEach((h, k) => { const x = -22 + k * 4; put(A.hotspot({ heat: h, compact: CMP }), 0, x, SIDE, HZ); label((CMP ? 'compact ' : 'hotspot ') + h, x, 3.1, HZ, ['all', 'corner'], true); });
person(3, -10.5, SIDE, HZ + 2.3, .2); person(15, -6.8, SIDE, HZ + 2.2, -.2); person(5, -5.0, SIDE, HZ + 2.4, -.5); person(11, -21.2, SIDE, HZ + 2.2, .3);

// ── the lots row: lawn sign, safe, crime scene, memorial (against a low wall)
slab(-3.6, SIDE, 1.4, 1.4, SIDE + .02, 6.2, PAL.yard); put(A.forRentSign({ style: 'lawn' }), 0, -1.3, SIDE + .02, 3.4); person(1, 1.0, SIDE + .02, 4.9, -.5);
slab(2.8, SIDE, 2.3, 5.2, SIDE + .2, 4.5, 0xd6d2ca); put(A.security('safe'), 0, 4.0, SIDE + .2, 3.4);
put(A.scar('crimeScene'), 0, 8.8, SIDE, 3.6); person(13, 11.2, SIDE, 5.6, -.4);
slab(12.6, SIDE, 1.2, 16.6, SIDE + 1.3, 2.2, 0xb04a3a); slab(12.55, SIDE + 1.3, 1.15, 16.65, SIDE + 1.4, 2.25, 0xd6d2ca);   // a low brick wall
put(A.scar('memorial'), 0, 14.6, SIDE, 2.8); person(7, 17.6, SIDE, 3.4, -.6);
label('for rent · lawn', -1.3, 2.5, 3.4, ['all', 'lots'], true); label('security · safe', 4.0, 1.6, 3.4, ['all', 'lots'], true);
label('scar · crime scene', 8.8, 1.5, 3.6, ['all', 'lots'], true); label('scar · memorial', 14.6, 2.2, 2.8, ['all', 'lots'], true);

// ── the pile yard: rows = kinds, columns = level 0 · .25 · .5 · .75 · 1
const KINDS = ['scrap', 'salts', 'goo', 'leaf', 'cloth'], LV = [0, .25, .5, .75, 1], PX = c => -8.4 + c * 3.7, PZ = r => 9.6 + r * 3.7;
slab(-10.6, 0, 7.4, 8.6, SIDE, 26.6, PAL.walk); slab(-10.3, SIDE, 7.6, 8.3, SIDE + .02, 26.3, PAL.lot);
KINDS.forEach((k, r) => LV.forEach((l, c) => { const x = PX(c), z = PZ(r); put(A.pile(k, l), 0, x, SIDE + .02, z); if (c === 0) label(k, x - 2.3, .9, z, ['all', 'piles'], true); if (r === 0) label('level ' + l, x, .3, z - 2.1, ['piles'], true); }));
person(9, PX(4) + 1.9, SIDE + .02, PZ(0) - .6, -.3); person(10, PX(2) + 1.9, SIDE + .02, PZ(2) + .6, -.5);
person(0, WALK.x0 - .9, SIDE, -9.9, .5); person(6, D.gate.x + 1.4, SIDE, -10.2, 0);

// lamps: posts along the sidewalks (and their light at night)
for (const [x, z, r] of [[3.4, -9.6, 0], [-25, -9.6, 0], [-24.5, -2.4, 2], [-2.5, -2.4, 2], [23, -2.4, 2]]) { stamp(lampPost(), bank, r, x, SIDE, z); lamps.push([x, z + (r === 2 ? -1.8 : 1.8)]); }
if (NIGHT) for (const [x, z] of lamps) { const l = new THREE.PointLight(0xffd79a, 22, 15, 1.4); l.position.set(x, 5.4, z); scene.add(l); }
if (NIGHT) for (const [x, y, z] of [[LX, 2.2, TW.z + 1.2], [-11, 2.4, -9.8], [-14, 2.4, 6], [6, 2.2, 6], [-1, 3, 14], [-1, 3, 22]]) { const l = new THREE.PointLight(0xffd79a, 10, 10, 1.4); l.position.set(x, y, z); scene.add(l); }

// ── the bank → meshes (the city's four layers)
bank.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), MATS4[li]); m.castShadow = li !== 3; m.receiveShadow = true; scene.add(m); });
for (const p of people) { const o = build(LOOKS[p.k % LOOKS.length]); o.position.set(p.x, p.y, p.z); o.rotation.y = p.ry; o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); scene.add(o); }

// ── views
const VIEWS = {
  all: { pos: [-1.5, 36, 44], tgt: [-1.5, 0, 5.5], fov: 48 },
  facade: { pos: [-11, 3.2, 0.2], tgt: [-11, 5.2, -11], fov: 58 },
  doors: { pos: [-19.2, 2.0, -4.4], tgt: [-19.2, 2.1, -11], fov: 52 },
  piles: { pos: [-1, 22, 36], tgt: [-1, 0, 16.5], fov: 44 },
  street: { pos: [16.4, 3.3, 3.4], tgt: [15.4, 1.9, -11], fov: 56 },
  corner: { pos: [-14, 5.5, 14.5], tgt: [-14, 1.0, 3.4], fov: 50 },
  lots: { pos: [10, 5.2, 12.5], tgt: [7.2, .6, 3.6], fov: 52 },
  car: { pos: [23.8, 3.6, -0.6], tgt: [18.6, .9, -4.8], fov: 46 },
  memorial: { pos: [14.6, 1.9, 6.4], tgt: [14.6, .7, 2.8], fov: 46 },
  lawn: { pos: [1.2, 1.9, 8.2], tgt: [-1.1, 1.1, 3.4], fov: 46 },
  burn: { pos: [-3.6, 5.4, -4.2], tgt: [-3.6, 5.6, -11], fov: 46 },
};
const camera = new THREE.PerspectiveCamera(50, W / H, .1, 1200), v = VIEWS[VIEW] || VIEWS.all;
camera.position.set(...v.pos); camera.fov = v.fov; camera.updateProjectionMatrix();
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(...v.tgt); controls.update();
const LAB = document.getElementById('labels');
const els = labels.filter(l => l.views.includes(VIEW)).map(l => { const e = document.createElement('div'); e.className = 'lab' + (l.sm ? ' sm' : ''); e.innerHTML = l.text; LAB.appendChild(e); return [e, l.p]; });
const tmp = new THREE.Vector3();
function frame() { renderer.render(scene, camera);
  for (const [e, p] of els) { tmp.copy(p).project(camera); const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05; e.style.display = vis ? '' : 'none'; e.style.left = ((tmp.x + 1) / 2 * W) + 'px'; e.style.top = ((1 - tmp.y) / 2 * H) + 'px'; } }
addEventListener('resize', () => { if (SHOT) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
if (SHOT) { frame(); requestAnimationFrame(() => { frame(); document.title = 'ready'; }); }
else renderer.setAnimationLoop(() => { controls.update(); frame(); });
window.__sim = { A, scene, camera, renderer, VIEWS };
