// CARS pass · the fleet lineup page (shots only): ?tod=night · ?mode=wheel&deg=30 (a wheel close-up turned by deg) · ?cam=x,y,z&look=x,y,z
import * as THREE from 'three';
import { tierize } from '../gpu.js';
import { PAL } from '../style.js';
import { VEHICLES } from './index.js';
import { vehicleMesh } from './three.js';

const Q = new URLSearchParams(location.search), NIGHT = Q.get('tod') === 'night', MODE = Q.get('mode') || 'lineup', DEG = +(Q.get('deg') || 0);
if (NIGHT) document.body.classList.add('night');
const W = innerWidth, H = innerHeight, renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(NIGHT ? PAL.nightTop : PAL.sky);
{ const es = new THREE.Scene(); es.background = new THREE.Color(NIGHT ? PAL.nightHor : PAL.horizon); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .02).texture; scene.environmentIntensity = NIGHT ? .2 : .6; }
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3); sun.position.set(-14, 22, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 20, bottom: -20, near: 1, far: 80 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; scene.add(sun);
scene.add(new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
if (NIGHT) for (const x of [-10, 4, 18]) { const l = new THREE.PointLight(0xffd9a0, 40, 18, 1.6); l.position.set(x, 5.5, -3); scene.add(l); }
const mat = tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), { vmat: true });
const flat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), flat(PAL.asphalt)); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
const walk = new THREE.Mesh(new THREE.BoxGeometry(80, .2, 6), flat(PAL.walk)); walk.position.set(0, .1, -12); walk.receiveShadow = true; scene.add(walk);
const kerb = new THREE.Mesh(new THREE.BoxGeometry(80, .21, .2), flat(PAL.curbTop)); kerb.position.set(0, .105, -8.9); scene.add(kerb);
for (let x = -36; x < 40; x += 3) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.5, .01, .16), flat(PAL.lineY)); d.position.set(x, .005, 8.5); scene.add(d); }

const camera = new THREE.PerspectiveCamera(+(Q.get('fov') || 38), W / H, .05, 300), tags = [];
const V3 = s => s.split(',').map(Number);
if (MODE === 'wheel') {
  const car = vehicleMesh('sedan', { variant: 1, lights: NIGHT, driver: true, night: NIGHT }, mat); car.rotation.y = Math.PI / 2; scene.add(car);   // nose to +x, its left side (+x local) toward +z (the camera)
  for (const p of car.userData.wheels) p.rotation.x = DEG * Math.PI / 180;
  const w = car.userData.spec.wheels.find(w => w.x < 0 && w.z > 0); const wx = w.z, wz = -w.x;   // local → world (rotation y +90°: x' = z, z' = −x)
  camera.position.set(...(Q.get('cam') ? V3(Q.get('cam')) : [wx + .4, .75, wz + 2.9])); camera.lookAt(...(Q.get('look') ? V3(Q.get('look')) : [wx, .38, wz]));
} else {
  const list = VEHICLES.filter(v => v.id !== 'bus'), rows = [list.slice(0, 6), list.slice(6)];
  rows.forEach((row, r) => row.forEach((v, k) => { const x = (k - 2.5) * 3.6 - r * 1.2, z = r ? -2.2 : 4.2, car = vehicleMesh(v.id, { variant: (k + r) % 2, lights: NIGHT, driver: true, night: NIGHT }, mat);
    car.position.set(x, 0, z); car.rotation.y = -.5; scene.add(car); tags.push([v, new THREE.Vector3(x, v.dims.h + .25, z)]); }));
  const bus = vehicleMesh('bus', { lights: NIGHT, driver: true, night: NIGHT }, mat); bus.position.set(9.5, 0, -2.6); bus.rotation.y = -.5; scene.add(bus); tags.push([VEHICLES.find(v => v.id === 'bus'), new THREE.Vector3(9.5, 3.25, -2.6)]);
  camera.position.set(...(Q.get('cam') ? V3(Q.get('cam')) : [-1.2, 11, 21.5])); camera.lookAt(...(Q.get('look') ? V3(Q.get('look')) : [-.2, .5, 0]));
}
camera.updateMatrixWorld();
if (!Q.has('notags')) for (const [v, p] of tags) { const q = p.clone().project(camera), d = document.createElement('div'); d.className = 'tag';
  d.innerHTML = `${v.name.replace(/ \(.*\)/, '')}<i>${v.id} · ${v.dims.l.toFixed(1)} m</i>`; d.style.left = ((q.x + 1) / 2 * W) + 'px'; d.style.top = ((1 - q.y) / 2 * H) + 'px'; document.body.appendChild(d); }
renderer.setAnimationLoop(() => renderer.render(scene, camera));
