// LIGHTING PASS (2026-09-28) · THE SKY DOME. Today's two-stop gradient (horizon → top, `ground` below the horizon), plus, each off by
// default: a deeper horizon band (a colour pooled on the horizon, fading up over `bandWidth`), a sun disc and a sun glow toward the sun,
// and a night glow on the horizon over downtown (the sodium haze of the city, its azimuth taken from the camera each frame).
// fog: false like before; the fog colour follows horizonOf() (the horizon as drawn, band included) while the fog is sky-matched.
import * as THREE from 'three';

export const SKY_FIELDS = {
  top: { v: '#2f9bff', color: true, label: 'top' },
  horizon: { v: '#9fdcff', color: true, label: 'horizon' },
  ground: { v: '#9fdcff', color: true, label: 'below horizon' },
  curve: { v: .5, min: .15, max: 2, step: .01, label: 'gradient curve', hint: 'lower keeps the horizon colour higher up the sky' },
  band: { v: 0, min: 0, max: 1, step: .01, label: 'horizon band', hint: 'a deeper colour pooled on the horizon (the fog follows it)' },
  bandColor: { v: '#ffb27a', color: true, label: 'band colour' },
  bandWidth: { v: .12, min: .02, max: .5, step: .01, label: 'band height' },
  sunDisc: { v: 0, min: 0, max: 4, step: .01, label: 'sun disc' },
  sunSize: { v: 1.6, min: .3, max: 6, step: .05, label: 'sun disc size (°)' },
  sunGlow: { v: 0, min: 0, max: 2, step: .01, label: 'sun glow' },
  glowSize: { v: 14, min: 2, max: 60, step: .5, label: 'glow size (°)' },
  nightGlow: { v: 0, min: 0, max: 1.5, step: .01, label: 'city glow (night horizon)' },
  nightGlowColor: { v: '#ff8a3d', color: true, label: 'city glow colour' },
  nightGlowWidth: { v: 55, min: 10, max: 180, step: 1, label: 'city glow width (°)' },
};

const VERT = 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }';
// the base line is today's shader, character for character (the default renders identically); every extra is gated off at 0
const FRAG = `uniform vec3 top, hor, gnd, bandC, sunC, sunD, glowC; uniform float curve; uniform vec4 bandP, sunP, cityP; varying vec3 vD;
void main(){ float h = vD.y; vec3 c = h > 0. ? mix(hor, top, curve == .5 ? pow(clamp(h,0.,1.), .5) : pow(clamp(h,0.,1.), curve)) : gnd;
  if ( bandP.x > 0. ) c = mix( c, bandC, bandP.x * ( 1. - smoothstep( 0., bandP.y, abs( h ) ) ) );
  if ( cityP.x > 0. ) { float a = dot( normalize( vD.xz + 1e-5 ), cityP.zw ), w = cos( radians( cityP.y ) * .5 );
    c += glowC * cityP.x * smoothstep( w - .35, 1., a ) * ( 1. - smoothstep( -.02, .22, h ) ); }
  if ( sunP.y > 0. || sunP.w > 0. ) { float d = dot( normalize( vD ), sunD ), r = acos( clamp( d, -1., 1. ) );
    c += sunC * ( sunP.y * ( 1. - smoothstep( sunP.x * .8, sunP.x, r ) ) + sunP.w * exp( - r * r / ( sunP.z * sunP.z ) ) ); }
  gl_FragColor = vec4(c,1.);
#include <colorspace_fragment>
}`;

export function createSky({ scene }) {
  const U = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, curve: { value: .5 },
    bandC: { value: new THREE.Color() }, bandP: { value: new THREE.Vector4(0, .12, 0, 0) }, sunC: { value: new THREE.Color(1, 1, 1) }, sunD: { value: new THREE.Vector3(0, 1, 0) },
    sunP: { value: new THREE.Vector4(.03, 0, .25, 0) }, glowC: { value: new THREE.Color() }, cityP: { value: new THREE.Vector4(0, 55, 0, -1) } };
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U, vertexShader: VERT, fragmentShader: FRAG });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat); mesh.renderOrder = -1; mesh.frustumCulled = false; scene.add(mesh);
  // the environment's copy of the dome shares the uniforms (a PMREM of it lights every PBR material: regenerated when the sky changes)
  const envMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U, vertexShader: VERT, fragmentShader: FRAG });
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), envMat));
  const C = new THREE.Color();
  return { mesh, mat, U, envScene,
    // the horizon as drawn at h = 0 (what the sky-matched fog takes)
    horizonOf: (out = C) => out.copy(U.hor.value).lerp(U.bandC.value, U.bandP.value.x),
    // the sky colour at elevation sin e (the clouds fade into it)
    set(s, sunCol, sunDir) { U.top.value.copy(s.top); U.hor.value.copy(s.hor); U.gnd.value.copy(s.gnd); U.curve.value = s.curve;
      U.bandC.value.copy(s.bandCol); U.bandP.value.set(s.band, s.bandW, 0, 0);
      U.sunC.value.copy(sunCol); U.sunD.value.copy(sunDir); U.sunP.value.set(THREE.MathUtils.degToRad(s.discSize), s.disc, THREE.MathUtils.degToRad(s.glowSize), s.glow);
      U.glowC.value.copy(s.cityCol); U.cityP.value.x = s.city; U.cityP.value.y = s.cityW; },
    // the city glow's azimuth: from the camera toward downtown (0, 0)
    follow(cam) { const dx = -cam.x, dz = -cam.z, l = Math.hypot(dx, dz); if (l > 1) U.cityP.value.set(U.cityP.value.x, U.cityP.value.y, dx / l, dz / l); else U.cityP.value.set(U.cityP.value.x, U.cityP.value.y, 0, -1); },
  };
}
