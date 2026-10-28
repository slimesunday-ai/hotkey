// three.js glue for banks (main thread only)
import * as THREE from 'three';
// bake a THREE mesh (world matrix applied) into a bank layer — used to freeze posed chars.js characters
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
export function bakeMesh(mesh, dst, li) {
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, cl = g.attributes.color, idx = g.index, D = dst.L[li], base = D.v, M = mesh.matrixWorld;
  _m3.getNormalMatrix(M); D.P.need(pos.count * 3); D.N.need(pos.count * 3); D.C.need(pos.count * 3);
  for (let k = 0; k < pos.count; k++) { _v.fromBufferAttribute(pos, k).applyMatrix4(M); _n.fromBufferAttribute(nor, k).applyMatrix3(_m3).normalize();
    D.P.a[D.P.n++] = _v.x; D.P.a[D.P.n++] = _v.y; D.P.a[D.P.n++] = _v.z; D.N.a[D.N.n++] = Math.round(_n.x * 127); D.N.a[D.N.n++] = Math.round(_n.y * 127); D.N.a[D.N.n++] = Math.round(_n.z * 127);
    D.C.a[D.C.n++] = cl.getX(k); D.C.a[D.C.n++] = cl.getY(k); D.C.a[D.C.n++] = cl.getZ(k); }
  D.I.need(idx.count); for (let k = 0; k < idx.count; k++) D.I.a[D.I.n++] = idx.getX(k) + base; D.v += pos.count;
}
export function geoOf(O) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(O.P.a.slice(0, O.P.n), 3)); g.setAttribute('normal', new THREE.BufferAttribute(O.N.a.slice(0, O.N.n), 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(O.C.a.slice(0, O.C.n), 3)); g.setIndex(new THREE.BufferAttribute(O.I.a.slice(0, O.I.n), 1)); g.computeBoundingSphere(); return g;
}

