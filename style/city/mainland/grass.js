// MAINLAND LAWNS (2026-10-06) · the page side of the painted lawn (lawn.js): the two lawn maps as textures, the ground material that
// reads them, and THE TUFTS: blades of grass instanced near the camera, placed on the GPU by world position (a grid that follows the
// camera and wraps, so a tuft never moves while you walk), grown where the map's alpha says (fence lines, tree rings, wild plots), coloured
// from the lawn under them and swaying a little in the wind. One draw call; nothing above ~45 m (the map carries the overview); not in the
// shadow pass, not in the walk grid (its own material), so it never stops you.
import { GRIDS } from './lawn.js';

// the maps: RGBA8 sRGB, crisp voxels near (nearest), smooth far (mipmaps, anisotropy)
// grids (every function here): two rasters of the same shape as GRIDS ({ x0, z0, x1, z1, s, nx, nz }) to read instead of the Mainland's
// whole maps: the interior view (interiors/city/view.js) paints just the rect round its house, with the same painters
export function lawnTextures(THREE, renderer, data, grids = GRIDS) {
  const out = {}, an = renderer.capabilities.getMaxAnisotropy();
  for (const k of ['fine', 'coarse']) { const g = grids[k], t = new THREE.DataTexture(data[k], g.nx, g.nz, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = an;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; out[k] = t; }
  return out;
}
const rectOf = (THREE, g) => new THREE.Vector4(g.x0, g.z0, g.x1 - g.x0, g.z1 - g.z0);
const GLSL_LAWN = `uniform sampler2D uLawnF, uLawnC; uniform vec4 uLawnRF, uLawnRC;`;

// the ground's material: its top faces (up, at the lawn's height: lawns, verges, walks, curbs) take the map's colour (times the material's
// own colour: white on the Mainland, the interior view's hazed far ring darker); the roads (y 0) and every side face keep their own (so the
// curb's road face and the asphalt's corner shading stay). local: the map is read at the mesh's OWN coordinates (Mainland world metres in
// a group the interior view moves and turns round its house) instead of the scene's
export function lawnMaterial(THREE, base, tex, { grids = GRIDS, local = false } = {}) {
  const m = base.clone(); m.name = 'ml-lawn';
  const U = { uLawnF: { value: tex.fine }, uLawnC: { value: tex.coarse }, uLawnRF: { value: rectOf(THREE, grids.fine) }, uLawnRC: { value: rectOf(THREE, grids.coarse) } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLawnW; varying float vLawnUp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vLawnW = ${local ? 'transformed' : '( modelMatrix * vec4( transformed, 1. ) ).xyz'}; vLawnUp = normalize( mat3( modelMatrix ) * objectNormal ).y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_LAWN}\nvarying vec3 vLawnW; varying float vLawnUp;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  { vec2 uf = ( vLawnW.xz - uLawnRF.xy ) / uLawnRF.zw, uc = ( vLawnW.xz - uLawnRC.xy ) / uLawnRC.zw; vec3 lf = texture2D( uLawnF, uf ).rgb, lc = texture2D( uLawnC, uc ).rgb;
    if ( vLawnUp > .5 && vLawnW.y > .1 ) { if ( uf.x > 0. && uf.y > 0. && uf.x < 1. && uf.y < 1. ) diffuseColor.rgb = lf * diffuse; else if ( uc.x > 0. && uc.y > 0. && uc.x < 1. && uc.y < 1. ) diffuseColor.rgb = lc * diffuse; } }`); };
  m.customProgramCacheKey = () => local ? 'ml-lawn-local' : 'ml-lawn';
  return { mat: m, U };
}

// ── THE TUFTS. G × G cells of CELL metres round a focus ahead of the camera; one tuft per cell at most (a hash against the map's density)
const G = 132, CELL = .4, RAD = 25;
function tuftGeometry(THREE) {
  const P = [], N = [], H = [];
  // a blade: a thin box from the root (y 0) to the tip (y h, leaning by (lx, lz)); four sides and the tip, flat-shaded
  const blade = (cx, cz, w, h, lx, lz) => { const b = [[cx - w, cz - w], [cx + w, cz - w], [cx + w, cz + w], [cx - w, cz + w]], tp = b.map(([x, z]) => [x + lx, z + lz]);
    const quad = (a, b2, c, d, ha, hb, n) => { for (const [p, hh] of [[a, ha], [b2, ha], [c, hb], [a, ha], [c, hb], [d, hb]]) { P.push(p[0], p[1], p[2]); N.push(...n); H.push(hh); } };
    for (let k = 0; k < 4; k++) { const j = (k + 1) & 3, a = [b[k][0], 0, b[k][1]], b2 = [b[j][0], 0, b[j][1]], c = [tp[j][0], h, tp[j][1]], d = [tp[k][0], h, tp[k][1]];
      const ex = b[j][0] - b[k][0], ez = b[j][1] - b[k][1], l = Math.hypot(ex, ez); quad(a, b2, c, d, 0, 1, [ez / l, 0, -ex / l]); }
    quad([tp[0][0], h, tp[0][1]], [tp[3][0], h, tp[3][1]], [tp[2][0], h, tp[2][1]], [tp[1][0], h, tp[1][1]], 1, 1, [0, 1, 0]); };
  blade(0, 0, .028, 1, .03, -.02);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .4, r = .055 + (k & 1) * .03, h = .5 + ((k * 37) % 5) / 10; blade(Math.cos(a) * r, Math.sin(a) * r, .024, h, Math.cos(a) * .09 * h, Math.sin(a) * .09 * h); }
  blade(.02, .03, .07, .22, 0, 0);   // the clump at the root (reads as a tuft from a distance)
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(H, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(P.length).fill(1), 3)); g.instanceCount = G * G; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}
// (grids: as above; the mesh grows its tufts at its own coordinates, so in the interior view it goes in the group that holds the Mainland's
// ground, and update() takes that group's inverse world matrix to find the camera in Mainland metres)
export function createTufts(THREE, { tex, night, grids = GRIDS }) {
  const U = { uLawnF: { value: tex.fine }, uLawnC: { value: tex.coarse }, uLawnRF: { value: rectOf(THREE, grids.fine) }, uLawnRC: { value: rectOf(THREE, grids.coarse) },
    uFocus: { value: new THREE.Vector3(0, 0, 0) }, uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
${GLSL_LAWN}
uniform vec3 uFocus; uniform float uTime; attribute float aH;
float tH( vec2 p, float s ) { uvec2 q = uvec2( ivec2( p ) + 65536 ); uint h = q.x * 1597334677u ^ q.y * 3812015801u ^ uint( s ) * 2654435761u; h ^= h >> 15; h *= 0x85EBCA6Bu; h ^= h >> 13; h *= 0xC2B2AE35u; h ^= h >> 16; return float( h & 0xFFFFFFu ) / 16777216.; }
vec4 tLawn( vec2 w ) { vec2 uf = ( w - uLawnRF.xy ) / uLawnRF.zw; if ( uf.x > 0. && uf.y > 0. && uf.x < 1. && uf.y < 1. ) return texelFetch( uLawnF, ivec2( uf * vec2( textureSize( uLawnF, 0 ) ) ), 0 );
  vec2 uc = ( w - uLawnRC.xy ) / uLawnRC.zw; if ( uc.x > 0. && uc.y > 0. && uc.x < 1. && uc.y < 1. ) return texelFetch( uLawnC, ivec2( uc * vec2( textureSize( uLawnC, 0 ) ) ), 0 ); return vec4( 0. ); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  float tG = ${G}.; vec2 tId = vec2( float( gl_InstanceID % ${G} ), float( gl_InstanceID / ${G} ) ), tCf = floor( uFocus.xy / ${CELL} );
  vec2 tWc = tCf + mod( tId - tCf + tG * .5, tG ) - tG * .5;
  float tH1 = tH( tWc, 1. ), tH2 = tH( tWc, 2. ), tH3 = tH( tWc, 3. ), tH4 = tH( tWc, 4. );
  vec2 tWp = ( tWc + .15 + vec2( tH1, tH2 ) * .7 ) * ${CELL};
  vec4 tL = tLawn( tWp ); float tD = length( tWp - uFocus.xy );
  float tVis = step( tH3, tL.a * 1.15 - .04 ) * smoothstep( ${RAD.toFixed(2)}, ${(RAD * .72).toFixed(2)}, tD ) * uFocus.z;
  float tA = tH4 * 6.2832; mat2 tR = mat2( cos( tA ), sin( tA ), -sin( tA ), cos( tA ) ); objectNormal.xz = tR * objectNormal.xz; objectNormal = normalize( mix( objectNormal, vec3( 0., 1., 0. ), .6 ) );   // (lit like the lawn it grows from)`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  float tHt = ( .09 + .34 * tL.a * tL.a + .1 * tH1 ) * tVis, tW = ( .75 + .7 * tL.a + .3 * tH2 ) * step( .001, tVis );
  transformed.xz = tR * ( transformed.xz * tW ); transformed.y *= tHt;
  float tS = sin( uTime * 1.7 + tWp.x * .55 + tWp.y * .35 ) + .45 * sin( uTime * 2.9 + tWp.x * 1.4 - tWp.y * .8 );
  transformed.xz += vec2( .9, .5 ) * tS * .045 * aH * aH * min( 1., tHt / .25 );
  transformed.xz += tWp; transformed.y += .2;
  vColor.rgb = tL.rgb * mix( .58, 1.12, aH ) + vec3( .018, .026, 0. ) * aH;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal *= faceDirection;'); };
  mat.customProgramCacheKey = () => 'ml-tufts';
  // (two-sided blades keep their upturned normal on the back face too: flipped, a blade's back went black under the night sky)
  const mesh = new THREE.Mesh(tuftGeometry(THREE), mat); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'ml:tufts';
  const fwd = new THREE.Vector3(), cp = new THREE.Vector3();
  function update(camera, t, inv = null) { const c = cp.copy(camera.position); if (inv) c.applyMatrix4(inv); const f = Math.max(0, Math.min(1, (46 - c.y) / 18)); mesh.visible = f > 0; if (!f) return;
    camera.getWorldDirection(fwd); if (inv) fwd.transformDirection(inv); const l = Math.hypot(fwd.x, fwd.z) || 1, ahead = RAD * .55 * Math.min(1, l * 1.4);
    U.uFocus.value.set(c.x + fwd.x / l * ahead, c.z + fwd.z / l * ahead, f); U.uTime.value = t / 1000; }
  return { mesh, update, U };
}
