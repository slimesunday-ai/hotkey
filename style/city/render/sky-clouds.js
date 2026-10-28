// LIGHTING PASS (2026-09-28) · THE CLOUDS. Big puffy cumulus in chunky voxels (the Simpsons-intro sky, built like the city): each cloud
// is a few overlapping puffs on a flat base, voxelized, and only its surface voxels kept. One instanced cube (one draw call, no
// shadows) for the whole sky: a 3.6 km tile of clouds that wraps round the camera and drifts with the wind.
// Lit in toon steps by the sun (colour and direction: warm at golden hour, dim and moonlit at night), undersides in the sky's own blue,
// and they sink into the sky colour toward the horizon (the haze), so the wrap at the tile's edge is never seen. Off by default.
import * as THREE from 'three';

export const CLOUD_FIELDS = {
  on: { v: false, label: 'clouds' },
  coverage: { v: .45, min: 0, max: 1, step: .01, label: 'coverage' },
  size: { v: 1, min: .4, max: 2.5, step: .01, label: 'size' },
  altitude: { v: 240, min: 90, max: 600, step: 1, label: 'altitude (m)' },
  speed: { v: 5, min: 0, max: 40, step: .1, label: 'drift (m/s)' },
  heading: { v: 70, min: 0, max: 360, step: 1, label: 'wind heading (°)' },
  shading: { v: .6, min: 0, max: 1, step: .01, label: 'shading', hint: '0: flat white · 1: strong toon steps and blue undersides' },
  brightness: { v: 1, min: .3, max: 1.6, step: .01, label: 'brightness' },
  haze: { v: .3, min: .05, max: 1, step: .01, label: 'horizon haze', hint: 'how high up the sky the clouds stay sunk in the haze' },
  style: { v: 'puffy', options: ['puffy', 'chunky', 'towering', 'flat'], label: 'style' },
  seed: { v: 1, min: 1, max: 99, step: 1, label: 'seed' },
};
const TILE = 3600;
const STYLE = { puffy: { vox: 10, puffs: [4, 7], h: .62, w: [110, 200] }, chunky: { vox: 15, puffs: [3, 5], h: .7, w: [120, 210] },
  towering: { vox: 11, puffs: [5, 8], h: 1.15, w: [90, 160] }, flat: { vox: 11, puffs: [6, 10], h: .3, w: [180, 360] } };

function rngOf(seed) { let a = (seed * 0x9e3779b1) | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// one cloud: puffs (ellipsoids) on a flat base, voxelized at `v` m; surface voxels only → [ox, oy, oz] offsets from its base centre
function cloudVoxels(r, st, scale) {
  const v = st.vox * Math.sqrt(scale), W = (st.w[0] + r() * (st.w[1] - st.w[0])) * scale, n = st.puffs[0] + ((r() * (st.puffs[1] - st.puffs[0] + 1)) | 0), ax = r() * Math.PI, ca = Math.cos(ax), sa = Math.sin(ax), P = [];
  for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : k / (n - 1) - .5, along = t * W * .75 + (r() - .5) * W * .12, side = (r() - .5) * W * .3, mid = 1 - Math.abs(t) * 1.1;
    const rad = W * (.2 + .16 * Math.max(0, mid) + r() * .08); P.push([along * ca - side * sa, rad * st.h * (.25 + .3 * r()), along * sa + side * ca, rad, rad * st.h * 1.25]); }
  const R = W * .75, G = Math.ceil(R / v), top = Math.max(...P.map(p => p[1] + p[4])), GY = Math.ceil(top / v), solid = new Set(), key = (i, j, k) => i + ',' + j + ',' + k;
  const inside = (x, y, z) => { if (y < 0) return false; for (const [px, py, pz, rr, ry] of P) { const dx = (x - px) / rr, dy = (y - py) / ry, dz = (z - pz) / rr; if (dx * dx + dy * dy + dz * dz <= 1) return true; } return false; };
  for (let i = -G; i <= G; i++) for (let k = -G; k <= G; k++) for (let j = 0; j <= GY; j++) if (inside((i + .5) * v, (j + .5) * v, (k + .5) * v)) solid.add(key(i, j, k));
  const out = []; for (const s of solid) { const [i, j, k] = s.split(',').map(Number);
    if (j === 0 || !solid.has(key(i + 1, j, k)) || !solid.has(key(i - 1, j, k)) || !solid.has(key(i, j + 1, k)) || !solid.has(key(i, j, k + 1)) || !solid.has(key(i, j, k - 1))) out.push([(i + .5) * v, j * v, (k + .5) * v]); }
  return { vox: out, v, h: (GY + 1) * v }; }

const VERT = `attribute vec4 aC; attribute vec4 aO; uniform vec3 uCam; uniform vec2 uDrift; uniform float uAlt, uTile; varying vec3 vN, vW; varying float vT;
void main() { vec2 c = aC.xz + uDrift; c = mod( c - uCam.xz + uTile * .5, uTile ) - uTile * .5 + uCam.xz;
  vec3 w = vec3( c.x, uAlt, c.y ) + aO.xyz + ( position + vec3( 0., .5, 0. ) ) * aO.w; vN = normal; vW = w; vT = clamp( aO.y / aC.w, 0., 1. );
  gl_Position = projectionMatrix * viewMatrix * vec4( w, 1. ); }`;
const FRAG = `uniform vec3 uCam, uSunD, uLit, uShadow, uTop, uHor, uBandC; uniform vec4 uP; uniform float uCurve, uTile; varying vec3 vN, vW; varying float vT;
void main() { float up = vN.y, s = dot( vN, uSunD );
  float l = up > .5 ? .74 + .26 * clamp( uSunD.y * 2., 0., 1. ) : up < -.5 ? .18 : s > .2 ? .9 : s > -.2 ? .66 : .5;   // toon steps: top (less when the sun is low) · sunny side · edge-on · shade · underside
  l = mix( l, 1., ( 1. - uP.x ) * .85 ) * mix( 1., .72 + .28 * vT, uP.x );                  // shading control · darker toward the flat base
  vec3 col = mix( uShadow, uLit, l ) * uP.y;
  vec3 d = vW - uCam; float e = d.y / length( d ), dh = length( d.xz );
  vec3 sky = mix( uHor, uTop, pow( clamp( e, 0., 1. ), uCurve ) ); sky = mix( sky, uBandC, uP.w * ( 1. - smoothstep( 0., .12, e ) ) );
  float hz = max( 1. - smoothstep( 0., uP.z, e ), smoothstep( uTile * .3, uTile * .47, dh ) );
  gl_FragColor = vec4( mix( col, sky, hz ), 1. );
#include <colorspace_fragment>
}`;

export function createClouds({ scene }) {
  const box = new THREE.BoxGeometry(1, 1, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index; for (const k of ['position', 'normal']) geo.setAttribute(k, box.attributes[k]);
  const U = { uCam: { value: new THREE.Vector3() }, uDrift: { value: new THREE.Vector2() }, uAlt: { value: 240 }, uTile: { value: TILE }, uSunD: { value: new THREE.Vector3(0, 1, 0) },
    uLit: { value: new THREE.Color(1, 1, 1) }, uShadow: { value: new THREE.Color(.7, .8, .95) }, uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBandC: { value: new THREE.Color() },
    uP: { value: new THREE.Vector4(.6, 1, .3, 0) }, uCurve: { value: .5 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, fog: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = -.5; mesh.castShadow = mesh.receiveShadow = false; scene.add(mesh);
  let built = '', n = 0, drift = [0, 0];
  function build(v) { const k = [v.coverage, v.size, v.style, v.seed].join('|'); if (k === built) return; built = k;
    const st = STYLE[v.style] || STYLE.puffy, r = rngOf(v.seed), count = Math.round(v.coverage * (v.style === 'flat' ? 30 : 50) * (1 / Math.max(.5, v.size))), C = [], O = [];
    const cells = Math.ceil(Math.sqrt(count || 1)), cw = TILE / cells;   // jittered grid: even cover, no clumps
    for (let q = 0; q < count; q++) { const cx = ((q % cells) + .15 + r() * .7) * cw - TILE / 2, cz = (((q / cells) | 0) + .15 + r() * .7) * cw - TILE / 2, sc = v.size * (.7 + r() * .6), cl = cloudVoxels(r, st, sc);
      for (const o of cl.vox) { C.push(cx, 0, cz, cl.h); O.push(o[0], o[1], o[2], cl.v); } }
    n = C.length / 4; geo.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(C), 4)); geo.setAttribute('aO', new THREE.InstancedBufferAttribute(new Float32Array(O), 4)); geo.instanceCount = n; }
  return { mesh, U, get voxels() { return n; },
    apply(v) { mesh.visible = !!v.on && v.coverage > 0; if (mesh.visible) build(v); U.uAlt.value = v.altitude; U.uP.value.x = v.shading; U.uP.value.y = v.brightness; U.uP.value.z = v.haze; this.v = v; },
    // lighting from the sun and sky (called whenever they change): lit side = white warmed by the sun colour, scaled by its strength
    light({ sunCol, sunInt, sunDir, top, hor, curve, bandCol, band }) { const k = Math.min(1.15, Math.max(.13, sunInt / 3)), sc = sunCol.clone(), m = Math.max(sc.r, sc.g, sc.b) || 1; sc.multiplyScalar(1 / m);
      const sat = 1 - Math.min(sc.r, sc.g, sc.b);   // (a near-white sun leaves the clouds white; a golden or moonlit one colours them)
      U.uLit.value.setRGB(1, 1, 1).lerp(sc, .9 * Math.pow(sat, 1.5)).multiplyScalar(k); U.uShadow.value.copy(top).lerp(new THREE.Color(1, 1, 1), .5).lerp(hor, .25).multiplyScalar(Math.max(.18, k * .9));
      U.uSunD.value.copy(sunDir); U.uTop.value.copy(top); U.uHor.value.copy(hor); U.uCurve.value = curve; U.uBandC.value.copy(bandCol); U.uP.value.w = band; },
    update(dt, cam) { if (!mesh.visible) return; const v = this.v, a = THREE.MathUtils.degToRad(v.heading); drift[0] = (drift[0] + Math.sin(a) * v.speed * dt) % TILE; drift[1] = (drift[1] + Math.cos(a) * v.speed * dt) % TILE;
      U.uDrift.value.set(drift[0], drift[1]); U.uCam.value.copy(cam); },
  };
}
