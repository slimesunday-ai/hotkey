// CARS pass (2026-09-28) · the fleet on the main thread: BufferGeometries for instancing, or a ready Group per car.
// Geometries are gpu.js tier geometry (positions in cm): draw them with main.js mats.tier at scale 0.01 (as simstate/layer.js does).
//   vehicleGeometries(id, { variant, lights, driver, night }) → { spec, body, wheel, brake, far }   (wheel: centred on its axle)
//   vehicleMesh(id, opts, mat) → THREE.Group: .userData = { spec, wheels: [pivot…], brake, roll(dist), setBrake(on) }
//     roll(d): add d metres of forward travel to every wheel (rotation.x += d / r); setBrake(on): show / hide the lit brake plates.
//     A model with rear doors (spec.doors: the Cleaners' van) also has .userData.setDoors(open) (open 0…1) and .leaves (C2-VAN).
// For an InstancedMesh / BatchedMesh fleet: one body instance per car, and one wheel instance per spec.wheels entry with the matrix
// T(car) · R(car) · T(wheel.x, wheel.y, wheel.z) · Rx(distance / wheel.r) · S(0.01). Brake plates: the brake geometry at the car's matrix.
// (A BatchedMesh's own bounding sphere is computed once and never refreshed: set perObjectFrustumCulled = true, frustumCulled = false.)
import * as THREE from 'three';
import { geometryOf } from '../gpu.js';
import { vehicleTiers, doorYaw } from './index.js';

const GEO = new Map();
export function vehicleGeometries(id, o = {}) {
  const k = `${id}|${o.variant | 0}|${o.lights ? 1 : 0}|${o.driver ? 1 : 0}|${o.night ? 1 : 0}`; let g = GEO.get(k);
  if (!g) { const t = vehicleTiers(id, o); g = { spec: t.spec, body: geometryOf(t.body), wheel: geometryOf(t.wheel), brake: t.brake ? geometryOf(t.brake) : null, far: geometryOf(t.far) };
    // (C2-VAN: a model with rear doors: the open bay and the two leaves)
    if (t.bay) { g.bay = geometryOf(t.bay); g.leaves = t.leaves.map(geometryOf); }
    GEO.set(k, g); }
  return g;
}
export function vehicleMesh(id, o = {}, mat) {
  const g = vehicleGeometries(id, o), root = new THREE.Group(), cm = m => { m.scale.setScalar(.01); m.castShadow = true; m.receiveShadow = true; return m; };
  root.add(cm(new THREE.Mesh(g.body, mat)));
  const wheels = g.spec.wheels.map(w => { const p = new THREE.Object3D(); p.position.set(w.x, w.y, w.z); p.add(cm(new THREE.Mesh(g.wheel, mat))); root.add(p); p.userData.r = w.r; return p; });
  const brake = g.brake ? cm(new THREE.Mesh(g.brake, mat)) : null; if (brake) { brake.visible = false; root.add(brake); }
  root.userData = { spec: g.spec, wheels, brake, roll(d) { for (const p of wheels) p.rotation.x += d / p.userData.r; }, setBrake(on) { if (brake) brake.visible = !!on; } };
  // C2-VAN · rear doors (spec.doors): the shut body until they open; then the open bay and the two leaves, each turned about its hinge
  // by doorYaw (index.js). setDoors(open): open 0…1, the stage's value
  if (g.bay) { const body = root.children[0], bay = cm(new THREE.Mesh(g.bay, mat)), D = g.spec.doors; bay.visible = false; root.add(bay);
    const leaves = g.leaves.map((geo, k) => { const h = D.leaves[k].hinge, p = new THREE.Object3D(), m = cm(new THREE.Mesh(geo, mat)); p.position.set(h[0], 0, h[1]); m.position.set(-h[0], 0, -h[1]); p.add(m); p.visible = false; root.add(p); return p; });
    root.userData.leaves = leaves; root.userData.setDoors = open => { const on = open > 0; body.visible = !on; bay.visible = on; leaves.forEach((p, k) => { p.visible = on; p.rotation.y = doorYaw(g.spec.id, k, open); }); };
    root.userData.setDoors(0); }
  return root;
}
