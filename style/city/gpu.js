// Tier meshes → three.js (main thread). Positions stay Int16 centimetres (mesh.scale = 0.01), colours stay sRGB bytes and are
// decoded in the vertex shader, the lit flag rides in the colour alpha, indices are rebuilt from the per-quad flip bits.
import * as THREE from 'three';
const DECODE = `
#if defined( USE_COLOR_ALPHA )
  vColor = vec4( mix( color.rgb / 12.92, pow( ( color.rgb + .055 ) / 1.055, vec3( 2.4 ) ), step( .04045, color.rgb ) ), 1. ); vLit = step( .9, color.a ); vMat = color.a; vIn = clamp( ( 1. - length( normal ) ) * 2. - .02, 0., 1. );
#elif defined( USE_COLOR )
  vColor = mix( color / 12.92, pow( ( color + .055 ) / 1.055, vec3( 2.4 ) ), step( .04045, color ) ); vLit = 0.; vMat = 0.; vIn = 0.;
#endif`;
// FIT-OUT PASS (2026-09-28) · the interior lift: shop stock (interiors/store/fill.js meshFitouts) carries normals shortened to 1 − lift / 2
// (the Int8 normal survives packing, baking and quarter-turn stamps unchanged; everything else is unit length → vIn 0). Those fragments
// lean toward their own warm-lit albedo: a store lit from inside, .3 by day, .55 at night (the night build flags them shorter).
// pass 1d · dithered fade: uFade ≥ 1 draws everything; 0 ≤ p < 1 fades in (keeps the pixels whose 4×4 Bayer threshold < p); −1 − p fades
// out with the complementary pattern, so a tier swap is a clean dissolve (no pixel drawn twice, no z-fight between tiers).
const DITHER = `
  if ( uFade < 1. ) { vec2 q = mod( floor( gl_FragCoord.xy ), 4. ); int k = int( q.x ) + int( q.y ) * 4;
    float b = ( float( k == 0 ? 0 : k == 1 ? 8 : k == 2 ? 2 : k == 3 ? 10 : k == 4 ? 12 : k == 5 ? 4 : k == 6 ? 14 : k == 7 ? 6 : k == 8 ? 3 : k == 9 ? 11 : k == 10 ? 1 : k == 11 ? 9 : k == 12 ? 15 : k == 13 ? 7 : k == 14 ? 13 : 5 ) + .5 ) / 16.;
    float p = uFade >= 0. ? uFade : -1. - uFade; if ( ( uFade >= 0. ) != ( b < p ) ) discard; }`;
// LIGHTING PASS (2026-09-28) · window-light variety (render/night.js drives it; off by default: uWin.x = 0 and no dark share → the branch
// never runs). A lit fragment in the warm lit-glass colours (PAL.litLo / litHi) takes one of four tints by a hash of its world cell (4.2 m
// bays × 3 m floors: clusters by floor and bay) — cool fluorescent, TV blue (flickering on uWinX.y, the time), neon, else tungsten — and
// a share of them (uWinX.x) goes dark again. Batched and instanced meshes (walkers, cars) are skipped: their model matrix isn't the world.
export const WIN = { value: { x: 0, y: .22, z: .14, w: .07 }, extra: { value: { x: 0, y: 0, z: 0, w: 0 } }, glass: { value: 1 } };   // (plain {x,y,z,w}: three uploads them as vec4; no THREE at module level, so node and workers import this file as before)
export const setLitMask = on => { WIN.extra.value.z = on ? 1 : 0; };   // (the emissive mask, below)
const WINTINT = `
#if !defined( USE_BATCHING ) && !defined( USE_INSTANCING )
  if ( ( uWin.x > 0. || uWinX.x > 0. ) && tLit > .5 ) { vec3 c = diffuseColor.rgb;
    if ( c.r > .9 && c.g > .45 && c.g < .88 && c.b > .08 && c.b < .45 ) {
      vec3 q = floor( vec3( vWinP.x / 4.2, ( vWinP.y - .2 ) / 3., vWinP.z / 4.2 ) );
      float h = fract( sin( dot( q, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ), h2 = fract( h * 91.37 + .13 ), h3 = fract( h * 47.13 + .71 ), t = smoothstep( .55, .8, c.g );
      vec3 tint = c * mix( vec3( 1., .8, .62 ), vec3( 1. ), h2 );
      if ( h < uWin.y ) tint = mix( vec3( .55, .78, 1. ), vec3( .88, .96, 1. ), t );
      else if ( h < uWin.y + uWin.z ) tint = mix( vec3( .16, .32, 1. ), vec3( .42, .62, 1. ), t ) * ( .8 + .2 * sin( uWinX.y * ( 5. + h2 * 7. ) + h2 * 40. ) );
      else if ( h < uWin.y + uWin.z + uWin.w ) tint = h2 < .5 ? mix( vec3( 1., .22, .62 ), vec3( 1., .5, .82 ), t ) : mix( vec3( .2, 1., .85 ), vec3( .55, 1., .92 ), t );
      outgoingLight = mix( outgoingLight, tint, uWin.x );
      if ( h3 < uWinX.x ) outgoingLight = vec3( .012, .02, .045 ); } }
#endif`;
// TAPE · THE TIME-OF-DAY GRADE's windows (render/grade.js drives uWinX.w; 0: the branch never runs and tLit is vLit). The lit flag the
// rest of the shader reads is tLit, a copy of vLit this may change:
//   w > 0  a day build graded to night: the day glass (glassLo / glassHi, gloss: told apart by its blue's proportions, so the baked AO
//          shading of a voxel doesn't matter) of a share w of the 4.2 m × 3 m world cells (the hash's own order: windows come on one by
//          one as w grows) is lit in the night build's lit-glass colours (litLo below, litHi above, as kit.js glass() splits them)
//   w < 0  a night build graded to day: a share −w of the lit windows (the warm lit-glass proportions) is day glass again. Standard
//          materials (the mid tier) keep their shading, scaled from the lit colour's albedo to the glass's; the full tier's lit layer is
//          unlit (MeshBasic), so its glass is the albedo × uWinG, the day light's level (render/grade.js `dayGlass`)
// Batched and instanced meshes (walkers, cars) are skipped, as for the tints.
const TODWIN = `
  float tLit = vLit;
#if !defined( USE_BATCHING ) && !defined( USE_INSTANCING )
  if ( uWinX.w != 0. ) { vec3 c = diffuseColor.rgb;
    bool cand = uWinX.w > 0. ? vLit < .5 && vMat > .2 && vMat < .5 && c.b > .004 && abs( c.r - .1 * c.b ) < .045 * c.b && abs( c.g - .26 * c.b ) < .06 * c.b
                             : vLit > .5 && c.r > .04 && c.g > .45 * c.r && c.g < .88 * c.r && c.b > .08 * c.r && c.b < .45 * c.r;   // (the warm lit glass, by its proportions: a window's AO-darkened rim too)
    if ( cand ) { bool top = uWinX.w > 0. ? c.b > .2 : c.g > .67 * c.r;   // (a window's upper 40 % (glassHi, litHi) or its lower part: the cell is taken at the window's middle, so a window is rarely cut in two)
      vec3 q = floor( vec3( vWinP.x / 4.2, ( vWinP.y + ( top ? -.45 : .35 ) - .2 ) / 3., vWinP.z / 4.2 ) ); float h = fract( fract( sin( dot( q, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 61.7 + .37 );
      if ( h < abs( uWinX.w ) ) {
        if ( uWinX.w > 0. ) { tLit = 1.; diffuseColor.rgb = ( top ? vec3( 1., .768, .352 ) : vec3( 1., .571, .133 ) ) * min( 1., c.b / ( top ? .552 : .0908 ) ); }   // (× the voxel's AO)
        else { tLit = 0.; vec3 gc = ( top ? vec3( .0497, .147, .552 ) : vec3( .0103, .0232, .0908 ) ) * c.r;   // (× c.r: the rim's AO kept)
#ifdef STANDARD
          outgoingLight *= gc / c;
#else
          outgoingLight = gc * uWinG;
#endif
          diffuseColor.rgb = gc; } } } }
#endif
#if defined( TONE_MAPPING ) && defined( CITY_GRADE )
  cityGradeK = 1. - tLit;   // (a lit fragment keeps its colour under the grade's blue: render/grade.js)
#endif`;
// LIGHTING PASS · the EMISSIVE MASK for the post stack's bloom ('emissive only'): while setLitMask(true) (render/post.js turns it on only
// for the scene's draw into its own target, never on the canvas, whose alpha three composites) a tier material writes alpha = 1 − lit:
// lit-flag fragments (lit windows, signs, neon, lamps) carry alpha 0, everything else 1. fx.js's bloom prefilter reads 1 − alpha. Off: a
// uniform branch, nothing written.
// HOMES pass (2026-09-28) · THE CUTAWAY (interiors/city/ drives it): while a home is open, every tier material discards the fragments in
// three boxes of that home's frame (local x across its front, local z toward the street, all ending at z1): its roof above the interior
// ceiling (A), the storey's front wall slab (F) and the storey inside its own walls (B) — so the merged block meshes need no rebuild and a
// house keeps its side and back walls. Closed (the default): uCut[1].w = 0, one uniform branch, nothing discarded.
// Columns: [cx, cz, cos, sin] · [hxW, yA0, yA1, on] · [zA0, zF0, z1, hxB] · [yS0, yS1, zB0, _]   (A and F span hxW; B spans hxB)
export const CUT = { value: new Float32Array(16) };   // (a plain array: three uploads it as a mat4; no THREE at module level)
const CUTOUT = `
  if ( uCut[1].w > 0. ) { vec2 cd = vWinP.xz - uCut[0].xy; float clx = abs( cd.x * uCut[0].z - cd.y * uCut[0].w ), clz = cd.x * uCut[0].w + cd.y * uCut[0].z;
    bool wide = clx < uCut[1].x, sto = vWinP.y > uCut[3].x && vWinP.y < uCut[3].y;
    if ( clz < uCut[2].z && ( ( wide && vWinP.y > uCut[1].y && vWinP.y < uCut[1].z && clz > uCut[2].x ) || ( sto && ( ( wide && clz > uCut[2].y ) || ( clx < uCut[2].w && clz > uCut[3].z ) ) ) ) ) discard; }`;
// LOOK round (2026-10-06) · THE WATERLINE BAND (water.js drives it; off until the water exists: uSeaOn.x = 0, one uniform branch). Any tier
// side face (not a top: decks and rock tops keep their colour) below 0.34 m standing well inside the water field (hulls, piles,
// riprap, a pier's legs, the bridge's feet) takes a stepped foam band: white to 0.13 m, pale surf to 0.23 m, the pair lifted 0.1 m on a stepped swell per 0.8 m cell. The field is water.js's RG8
// texture (R = water); uSeaBox = [x0, z0, 1/W, 1/D]; uSeaOn.y = the time. (Plain objects: no THREE at module level, as WIN.)
export const WATER = { on: { value: { x: 0, y: 0, z: 0, w: 0 } }, box: { value: { x: 0, y: 0, z: 0, w: 0 } }, tex: { value: null } };
const WATERLINE = `
  if ( uSeaOn.x > 0. ) { float sup = abs( normalize( cross( dFdx( vWinP ), dFdy( vWinP ) ) ).y );   // (the face's world normal from the derivatives, in uniform control flow: every tier material has vWinP, not all have vNormal)
    vec2 suv = ( vWinP.xz - uSeaBox.xy ) * uSeaBox.zw;
    if ( vWinP.y < .34 && vWinP.y > -1.2 && sup < .6 && suv.x > 0. && suv.y > 0. && suv.x < 1. && suv.y < 1. && textureLod( uSeaTex, suv, 0. ).r > .6 ) {
      float sc = floor( vWinP.x * 1.25 ) * 7. + floor( vWinP.z * 1.25 ) * 13., sy = vWinP.y - .1 * floor( 2. * fract( uSeaOn.y * .4 + fract( sin( sc ) * 43758.5453 ) ) );
      if ( sy < .13 ) diffuseColor.rgb = vec3( .905, .94, .965 ); else if ( sy < .23 ) diffuseColor.rgb = vec3( .62, .79, .9 ); } }`;
// sRGB-byte decode + lit mix (+ optional per-cluster hide mask for character mid meshes)
export function tierize(mat, o = {}) {
  const prev = mat.onBeforeCompile; mat._tierOpts = o; mat._uFade ??= { value: 1 };   // own props, not userData (Material.copy JSON-clones userData)
  mat.onBeforeCompile = (sh, r) => { prev?.(sh, r); sh.uniforms.uFade = mat._uFade;
    sh.uniforms.uWin = WIN; sh.uniforms.uWinX = WIN.extra; sh.uniforms.uWinG = WIN.glass; sh.uniforms.uCut = CUT; sh.uniforms.uSeaOn = WATER.on; sh.uniforms.uSeaBox = WATER.box; sh.uniforms.uSeaTex = WATER.tex;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLit; varying float vMat; varying float vIn; varying vec3 vWinP;' + (o.mask ? '\nattribute float aK; uniform vec4 uMask;' : ''))
      .replace('#include <color_vertex>', DECODE).replace('#include <project_vertex>', '#include <project_vertex>\n  vWinP = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );');   // (from mvPosition, after it: the clip position is computed exactly as before)
    if (o.mask) { sh.uniforms.uMask = o.mask; sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { int k = int( aK + .5 ); float hide = k == 0 ? uMask.x : k == 1 ? uMask.y : k == 2 ? uMask.z : uMask.w; if ( hide > .5 ) transformed = vec3( 0. ); }'); }
    if (sh.fragmentShader) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLit; varying float vMat; varying float vIn; uniform float uFade; varying vec3 vWinP; uniform vec4 uWin; uniform vec4 uWinX; uniform float uWinG; uniform mat4 uCut; uniform vec4 uSeaOn; uniform vec4 uSeaBox; uniform sampler2D uSeaTex;')
      .replace('#include <color_fragment>', '#include <color_fragment>' + WATERLINE)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + DITHER + CUTOUT)
      .replace('#include <metalnessmap_fragment>', o.vmat ? '#include <metalnessmap_fragment>\n  if ( vMat > .2 && vMat < .5 ) { roughnessFactor = .22; metalnessFactor = .1; } else if ( vMat >= .5 && vMat < .9 ) { roughnessFactor = .3; metalnessFactor = .85; }' : '#include <metalnessmap_fragment>')
      .replace('#include <opaque_fragment>', o.lit === false ? '#include <opaque_fragment>' : 'outgoingLight = mix( outgoingLight, diffuseColor.rgb * vec3( 1., .95, .86 ), vIn );' + TODWIN + '\n  outgoingLight = mix( outgoingLight, diffuseColor.rgb, tLit );' + WINTINT + '\n#include <opaque_fragment>\n  if ( uWinX.z > 0. ) gl_FragColor.a = 1. - tLit;'); };
  mat.customProgramCacheKey = () => 'tier' + (o.mask ? 'm' : '') + (o.lit === false ? 'n' : '') + (o.vmat ? 'v' : '') + (mat.type);
  return mat;
}
export function geometryOf(t, withK = false) {
  const g = new THREE.BufferGeometry(), nq = t.n / 4, I = new Uint32Array(nq * 6);
  for (let q = 0; q < nq; q++) { const v = q * 4, k = q * 6; if (t.F[q >> 3] & (1 << (q & 7))) { I[k] = v + 1; I[k + 1] = v + 2; I[k + 2] = v + 3; I[k + 3] = v + 1; I[k + 4] = v + 3; I[k + 5] = v; }
    else { I[k] = v; I[k + 1] = v + 1; I[k + 2] = v + 2; I[k + 3] = v; I[k + 4] = v + 2; I[k + 5] = v + 3; } }
  g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true)); g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true));
  if (withK && t.K) g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(t.K), 1));
  g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
}
export function meshOf(t, mat, o = {}) {
  const m = new THREE.Mesh(geometryOf(t, !!o.k), mat); m.scale.setScalar(.01); m.position.set(t.o[0], t.o[1], t.o[2]); m.castShadow = o.cast ?? true; m.receiveShadow = true;
  m.matrixAutoUpdate = false; m.updateMatrix(); if (o.depth) m.customDepthMaterial = o.depth; return m;
}
// a fade clone of a tierized material: same program (same cache key), its own uFade — pooled per base material
export function fadeClone(base) { const pool = base._fadePool ??= []; if (pool.length) return pool.pop();
  const c = base.clone(); c._uFade = { value: 1 }; tierize(c, base._tierOpts || {}); c._fadeBase = base; if (base.customDepthMaterial) c.customDepthMaterial = base.customDepthMaterial; return c; }
export function fadeRelease(c) { c._uFade.value = 1; c._fadeBase?._fadePool.push(c); }
export const trisOf = t => !t ? 0 : t.n / 2;
export function disposeMesh(m) { if (!m) return; m.geometry.dispose(); m.removeFromParent(); }
