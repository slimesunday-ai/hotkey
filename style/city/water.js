// LOOK round (2026-10-06, art review item 8) · STYLISED WATER. The bay, the sea to the horizon and the woods' lake were the ground's flat
// toon SEA (ground.js paints it into the coarse texture): one cobalt poster. This lays ONE water mesh over every 32 m cell that has water
// (plus the stitch pass's sea ring out to SEA_R), one draw call, one shader, no geometry per wave:
//   · a distance-to-shore ramp in three flat bands, teal shallows → sea blue → cobalt, its edges wobbling on a slow noise and stepped
//     on a 0.2 m grid (two city cubes), so the contours read as placed voxels, never a gradient
//   · a stepped white foam line on every shore (the field's land edge: quays, seawalls, the island, the beaches), breathing in and out
//     in 0.125 m steps, with a broken second line of pale surf beyond it; the foam on hulls, piles and riprap is the tier materials'
//     waterline band (gpu.js WATER: the same field, a 0.1 m stepped swell)
//   · sun glitter by day (and moon glitter at night): square 0.3 m glints, densest in the light's reflection path, re-rolled 5× a second
//   · at night, vertical light streaks under the waterfront lights: each lamp near the water draws a broken column of dashes on the
//     line from its foot toward the camera, centred on its mirror point (the nearest 24 lamps to the camera)
// The field: the coarse ground texture's own pixels (exactly where the ground paints SEA or the lake), a 3-4 chamfer distance at 0.5 m,
// built once on the main thread (≈ 40–70 ms), uploaded as an RG8 texture (R water, G distance to land to 40 m). The boat wakes, the
// breakwater surf and every other kit foam are voxels standing 0.1 m proud of the water: they draw over this plane as before.
// ?water=0 turns it all off (the flat ground SEA shows again).
import * as THREE from 'three';
import { P, kindAt, urban } from './plan.js';
import { cornerLamps, LAMP_REACH, SEA_R } from './ground.js';
import { MODS } from './modules.js';
import { WATER } from './gpu.js';
import { SPREAD, P0, shiftOf, remap } from '../../world/city.js';

const FIELD = { X0: -640, Z0: -512, W: 1280, D: 960, R: 2 }, DMAX = 40;   // the coarse ground's frame (ground.js COARSE): 2 px per metre
const WATERS = [0x2f86d8, 0x2f8ad0];                                       // ground.js SEA, the woods' LAKE (districts/forest.js)
const Y = .04;                                                             // over the ground (−0.01 / 0), under the kits' foam voxels (top 0.1)
const LAMP_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]];                       // (main.js: a lamp's head by its quarter turn)
// the bay's own lights (districts/sea/bay.js BREAK heads, the lit channel buoy) and the bridge's: [x, y, z, kind] — kind 0 sodium, 1 red, 2 green, 3 white
// SPREAD: today's metres, carried the way their kits carry them — the bay's in their sea block's frame (bay.js: the block's shift), the
// bridge's through the jail kit's map (districts/jail/lib.js JAIL_MAP; loaded on its own, a remap if it does not load)
const JM = SPREAD ? await import('./districts/jail/lib.js').then(m => m.JAIL_MAP).catch(() => null) : null;
const bay = ([x, y, z, k]) => { const [sx, sz] = shiftOf(Math.floor(x / P0), Math.floor(z / P0)); return [x + sx, y, z + sz, k]; };
const bridge = ([x, y, z, k]) => JM ? [JM.fx(x, z), y, JM.fz(z), k] : [remap(x, z)[0], y, remap(x, z)[1], k];
const MARKS = [...[[163.5, 3.2, -281.2, 1], [189.5, 3.2, -283.2, 2], [164.0, 2.2, -316.4, 3]].map(bay),
  ...[[215.35, 5.6, -259.6, 0], [215.35, 5.6, -282.2, 0], [262.5, 5.6, -284.35, 0], [278.5, 5.6, -284.35, 0]].map(bridge)];   // + the Long Bridge's lamps (districts/jail/bridge.js)
const lin = c => new THREE.Color(c);   // (THREE.Color takes sRGB hex into the working linear space)

function buildField(canvas) {
  const T = FIELD, nx = T.W * T.R, nz = T.D * T.R;
  if (!canvas || canvas.width !== nx || canvas.height !== nz) return null;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, nx, nz).data, n = nx * nz, wet = new Uint8Array(n);
  for (let k = 0, q = 0; k < n; k++, q += 4) { const r = px[q], g = px[q + 1], b = px[q + 2];
    for (const c of WATERS) if (Math.abs(r - (c >> 16)) <= 3 && Math.abs(g - ((c >> 8) & 255)) <= 3 && Math.abs(b - (c & 255)) <= 3) { wet[k] = 1; break; } }
  // 3-4 chamfer distance to the nearest land pixel (3 per 0.5 m step), two passes, capped at DMAX metres
  const CAP = DMAX * T.R * 3, d = new Uint16Array(n);
  for (let k = 0; k < n; k++) d[k] = wet[k] ? CAP : 0;
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const k = x + z * nx; if (!d[k]) continue; let v = d[k];
    if (x > 0) v = Math.min(v, d[k - 1] + 3); if (z > 0) { v = Math.min(v, d[k - nx] + 3); if (x > 0) v = Math.min(v, d[k - nx - 1] + 4); if (x < nx - 1) v = Math.min(v, d[k - nx + 1] + 4); } d[k] = v; }
  for (let z = nz - 1; z >= 0; z--) for (let x = nx - 1; x >= 0; x--) { const k = x + z * nx; if (!d[k]) continue; let v = d[k];
    if (x < nx - 1) v = Math.min(v, d[k + 1] + 3); if (z < nz - 1) { v = Math.min(v, d[k + nx] + 3); if (x < nx - 1) v = Math.min(v, d[k + nx + 1] + 4); if (x > 0) v = Math.min(v, d[k + nx - 1] + 4); } d[k] = v; }
  const rg = new Uint8Array(n * 2), M = T.R * 3;
  for (let k = 0; k < n; k++) { rg[k * 2] = wet[k] ? 255 : 0; rg[k * 2 + 1] = wet[k] ? Math.min(255, Math.round(d[k] / M / DMAX * 255)) : 0; }
  const tex = new THREE.DataTexture(rg, nx, nz, THREE.RGFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  // the 32 m cells with any water (the mesh covers only those)
  const cells = []; for (let cj = 0; cj < T.D / P; cj++) for (let ci = 0; ci < T.W / P; ci++) { let any = false;
    for (let z = cj * P * T.R; z < (cj + 1) * P * T.R && !any; z += 2) for (let x = ci * P * T.R; x < (ci + 1) * P * T.R; x += 2) if (wet[x + z * nx]) { any = true; break; }
    if (any) cells.push([T.X0 + ci * P, T.Z0 + cj * P]); }
  return { tex, wet, nx, nz, cells };
}

const VERT_HEAD = 'varying vec3 vWP;\n';
const FRAG_HEAD = `varying vec3 vWP;
uniform sampler2D uField; uniform vec4 uBox; uniform float uTime; uniform float uNight; uniform vec4 uLights[ 24 ]; uniform int uNL;
uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uFoam2;
float wh( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f ); return mix( mix( wh( i ), wh( i + vec2( 1., 0. ) ), f.x ), mix( wh( i + vec2( 0., 1. ) ), wh( i + vec2( 1. ) ), f.x ), f.y ); }
vec2 wField( vec2 xz ) { vec2 uv = ( xz - uBox.xy ) * uBox.zw; if ( uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1. ) return vec2( 1., ${DMAX.toFixed(1)} ); vec2 f = texture2D( uField, uv ).rg; return vec2( f.r, f.g * ${DMAX.toFixed(1)} ); }
`;
const FRAG_COLOR = `
  vec2 wq = floor( vWP.xz / .2 ) * .2 + .1;                    // stepped: the field is read on a 0.2 m grid
  vec2 wF = wField( wq ); if ( wF.x < .5 ) discard;
  float wd = wF.y, wb = wd + ( vn( wq / 7. ) - .5 ) * 3.2;     // the bands wobble on a slow noise
  vec3 wc = wb < 4.5 ? uShallow : wb < 13. ? uMid : uDeep;
  float lap = .5 + .125 * floor( 3.99 * ( .5 + .5 * sin( uTime * 1.1 + vn( wq / 3. ) * 9. ) ) ), wFo = 0.;   // the foam line breathes in 0.125 m steps
  if ( wd < lap ) { wc = uFoam; wFo = 1.; }
  else if ( wd < lap + 1.1 && wh( floor( vWP.xz / .4 ) + floor( uTime * .7 + vn( wq / 2. ) * 3. ) * 3.1 ) > .5 ) { wc = uFoam2; wFo = 1.; }
  else if ( wd > 2. && wd < 2.6 + vn( wq / 4. ) && wh( floor( vWP.xz / .4 ) ) > .72 ) { wc = mix( wc, uFoam2, .55 ); }      // a broken third ripple
  diffuseColor.rgb = wc;
`;
const FRAG_LIGHT = `
  float wFar = 1. - smoothstep( 140., 300., length( vViewPosition ) );
#if NUM_DIR_LIGHTS > 0
  { vec3 Nv = normalize( ( viewMatrix * vec4( 0., 1., 0., 0. ) ).xyz ), Vv = normalize( vViewPosition ), Rv = reflect( -Vv, Nv );
    float sp = max( dot( Rv, directionalLights[ 0 ].direction ), 0. ), path = smoothstep( .86, .995, sp );
    vec2 gc = floor( vWP.xz / .3 ); float tt = floor( uTime * 5. + wh( gc ) * 7. );
    float g = step( 1. - ( .007 + path * .3 ), wh( gc + tt * 1.37 ) );
    outgoingLight += directionalLights[ 0 ].color * g * ( 1. - wFo ) * ( .2 + path * .9 ) * mix( .25, 1., wFar ) * ( 1. - .55 * uNight ); }
#endif
  if ( uNight > 0. ) { vec3 add = vec3( 0. ); vec2 C = cameraPosition.xz; float hc = max( cameraPosition.y - ${Y.toFixed(2)}, .4 ), dc = length( vViewPosition );
    for ( int k = 0; k < 24; k++ ) { if ( k >= uNL ) break; vec4 L = uLights[ k ]; vec2 Fp = L.xz, dv = C - Fp; float D = length( dv ); if ( D < 1. ) continue;
      vec2 u = dv / D, pp = vWP.xz - Fp; float t = dot( pp, u ), s = abs( pp.x * u.y - pp.y * u.x ), hl = L.y, t0 = D * hl / ( hl + hc ), a = t0 * .45 + 1.2, b = min( t0 * 1.8 + 3., D - t0 - .5 );
      if ( t < t0 - a || t > t0 + b ) continue;
      float row = floor( t / .3 ), hr = wh( vec2( row + float( k ) * 17., floor( uTime * 4. + wh( Fp ) * 5. ) ) ), w = ( .1 + dc * .0045 ) * ( .5 + hr );
      if ( s > w || hr < .28 ) continue;
      float fall = 1. - smoothstep( .2, 1., t < t0 ? ( t0 - t ) / a : ( t - t0 ) / b ), kind = L.w;
      vec3 lc = kind < .5 ? vec3( 1., .62, .26 ) : kind < 1.5 ? vec3( 1., .14, .1 ) : kind < 2.5 ? vec3( .2, 1., .38 ) : vec3( .85, .9, 1. );
      add += lc * fall * 1.7; }
    outgoingLight += add * uNight * mix( .35, 1., wFar ); }
`;

export function createWater({ scene, ground, night = false }) {
  const t0 = performance.now(), F = buildField(ground?.coarse?.material?.map?.image);
  if (!F) { console.warn('water: no coarse ground canvas — the flat SEA stays'); return null; }
  const ms = performance.now() - t0, T = FIELD;
  // the mesh: a quad per wet cell inside the field, and the eight sea-ring quads round it out to SEA_R (the sea to the horizon)
  const pos = [], idx = [], quad = (x0, z0, x1, z1) => { const b = pos.length / 3; pos.push(x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z1); idx.push(b, b + 3, b + 2, b, b + 2, b + 1); };
  for (const [x, z] of F.cells) quad(x, z, x + P, z + P);
  const xs = [-SEA_R, T.X0, T.X0 + T.W, SEA_R], zs = [-SEA_R, T.Z0, T.Z0 + T.D, SEA_R];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== 1 || b !== 1) quad(xs[a], zs[b], xs[a + 1], zs[b + 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => k % 3 === 1 ? 1 : 0), 3)); g.setIndex(idx); g.computeBoundingSphere();
  const U = { uField: { value: F.tex }, uBox: { value: new THREE.Vector4(T.X0, T.Z0, 1 / T.W, 1 / T.D) }, uTime: { value: 0 }, uNight: { value: night ? 1 : 0 },
    uLights: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uNL: { value: 0 },
    uShallow: { value: lin(0x2ab7c6) }, uMid: { value: lin(0x2e8fd9) }, uDeep: { value: lin(0x2a6cd0) }, uFoam: { value: lin(0xf4f8fb) }, uFoam2: { value: lin(0xcfe6f4) } };
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f86d8, roughness: .95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = ( modelMatrix * vec4( transformed, 1. ) ).xyz;');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>' + FRAG_COLOR).replace('#include <opaque_fragment>', FRAG_LIGHT + '\n#include <opaque_fragment>'); };
  mat.customProgramCacheKey = () => 'look-water';
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'water'; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh);
  // the tier materials' waterline band reads the same field (gpu.js)
  WATER.tex.value = F.tex; WATER.box.value = { x: T.X0, y: T.Z0, z: 1 / T.W, w: 1 / T.D }; WATER.on.value.x = 1;
  // night: the lamps that stand within 40 m of the water (every corner lamp of the plan's blocks and the kits' own lamps), the bay's marks
  const lights = [];
  if (night) {
    const wetAt = (x, z) => { const i = Math.floor((x - T.X0) * T.R), k = Math.floor((z - T.Z0) * T.R); return i >= 0 && k >= 0 && i < F.nx && k < F.nz && F.wet[i + k * F.nx] === 1; };
    const nearWater = (x, z) => { for (let r = 4; r <= 40; r += 4) for (let a = 0; a < 16; a++) if (wetAt(x + Math.cos(a * .3927) * r, z + Math.sin(a * .3927) * r)) return true; return false; };
    const add = (x, z, rot) => { const hx = x + LAMP_DIR[rot][0] * LAMP_REACH, hz = z + LAMP_DIR[rot][1] * LAMP_REACH; if (nearWater(hx, hz)) lights.push([hx, 5.5, hz, 0]); };
    for (let i = Math.floor(T.X0 / P); i < (T.X0 + T.W) / P; i++) for (let j = Math.floor(T.Z0 / P); j < (T.Z0 + T.D) / P; j++) { const k = kindAt(i, j); if (!urban(k) && k !== '.') continue; for (const [x, z, rot] of cornerLamps(i, j)) add(x, z, rot); }
    for (const kit of MODS.kits.values()) for (const [x, z, rot] of kit.lamps || []) add(x, z, rot);
    lights.push(...MARKS);
  }
  let lastPick = -1, pickAt = null;
  const pick = cam => { const p = cam.position; if (pickAt && Math.hypot(p.x - pickAt.x, p.z - pickAt.z) < 3) return; pickAt = { x: p.x, z: p.z };
    const near = lights.map(l => [Math.hypot(l[0] - p.x, l[2] - p.z), l]).filter(q => q[0] < 260).sort((a, b) => a[0] - b[0]).slice(0, 24);
    near.forEach(([, l], k) => U.uLights.value[k].set(l[0], l[1], l[2], l[3])); U.uNL.value = near.length; };
  console.log(`water: field ${F.nx}×${F.nz} in ${ms.toFixed(0)} ms · ${F.cells.length} wet cells · ${idx.length / 3} tris · ${lights.length} waterfront lights`);
  return {
    mesh, lights, ms, tris: idx.length / 3,
    update(t, cam) { U.uTime.value = t; WATER.on.value.y = t; if (night && cam && t - lastPick > .25) { lastPick = t; pick(cam); } },
    setOn(on) { mesh.visible = on; WATER.on.value.x = on ? 1 : 0; },
    setNight(x) { U.uNight.value = x; },   // (TAPE's time-of-day grade, render/grade.js: the moon's dimmer glitter and the lamps' streaks, 0 … 1; the streaks need the night build's lamp list)
  };
}
