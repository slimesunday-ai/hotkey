// FINE PAINT on the walker (2026-10-01): ONE shared atlas for every walker and one shader hook on the walker material. No per-walker
// material, no extra draw call. The bake (bake.js bakeSegFull) gives each look its own tiles (FT: 4 × 4 RGBA texels a painted face,
// alpha 0 = unpainted, so the voxel's colour shows) and FI (Uint16 a vertex: tile + 1, 0 = none; 2 bytes a vertex). A painted face's
// AO index and corner ride in its colour alpha's 4 spare low bits (bake.js), so nothing else is added to the vertex.
//   const atlas = createFineAtlas(THREE);           once (the city: once for the near tier)
//   atlas.adopt(full);                                each baked look, on the main thread, before its geometry is made: moves its tiles
//                                                     into the atlas (deduplicated) and renumbers full.FI in place
//   geometry.setAttribute('aFine', fineAttr(THREE, full));   every walker geometry has it (a BatchedMesh needs one attribute set)
//   installFine(material, atlas);                     the walker material (after tierize, before or after installAnim2: it chains)
// The fragment takes the texel at the fragment's quarter-voxel cell (texelFetch: no filtering, no bleeding), shaded by the face's AO;
// once a texel is smaller than a pixel it fades to the tile's mean (mip 2), so a crowd never shimmers.
// Painted texels replace the vertex colour; unpainted ones keep it. Lighting, the lit flag, the material and the night are the
// walker material's own: the texel is just the albedo. Mid / far tiers never sample the atlas: bake.js FA holds each painted face in
// its average colour, and chars.js build() draws painted faces in their average (the city's mid bake resamples that).
const TILE = 4;
export function createFineAtlas(THREE, { size = 256, max = 2048 } = {}) {
  const make = n => { const t = new THREE.DataTexture(new Uint8Array(n * n * 4), n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };   // (mip 2: one texel a tile, its mean)
  const A = { size, tiles: new Map(), data: [], tex: make(size) };   // data: every tile's 64 bytes, by id (for regrowing)
  const uniforms = { uFine: { value: A.tex }, uFineW: { value: size / TILE }, uFinePx: { value: 1000 } };   // (uFinePx: the viewport's pixels a unit of view depth, set per draw)
  const blit = (id, bytes) => { const w = A.size / TILE, tx = (id % w) * TILE, ty = Math.floor(id / w) * TILE, d = A.tex.image.data;
    for (let j = 0; j < TILE; j++) d.set(bytes.subarray(j * TILE * 4, (j + 1) * TILE * 4), ((ty + j) * A.size + tx) * 4); };
  const grow = () => { if (A.size >= max) throw new Error('fine atlas full (' + A.tiles.size + ' tiles)'); A.size *= 2; const old = A.tex; A.tex = make(A.size);
    uniforms.uFine.value = A.tex; uniforms.uFineW.value = A.size / TILE; A.data.forEach((b, id) => blit(id, b)); old.dispose(); };
  return {
    uniforms, get tex() { return A.tex; },
    // a baked look's tiles → the atlas; full.FI renumbered to atlas ids (idempotent: a look is adopted once)
    adopt(full) { if (!full || !full.FT || !full.FT.length || full.fineAtlas === this) return full; const n = full.FT.length / 64, map = new Uint32Array(n); let dirty = false;
      for (let t = 0; t < n; t++) { const bytes = full.FT.subarray(t * 64, t * 64 + 64), key = bytes.join(','); let id = A.tiles.get(key);
        if (id === undefined) { id = A.tiles.size; if ((id + 1) * TILE * TILE > A.size * A.size) grow(); A.tiles.set(key, id); A.data.push(bytes.slice()); blit(id, bytes); dirty = true; }
        map[t] = id; }
      const FI = full.FI; for (let i = 0; i < FI.length; i++) if (FI[i]) FI[i] = map[FI[i] - 1] + 1;
      if (A.tiles.size > 65534) throw new Error('fine atlas: tile ids are 16-bit');
      if (dirty) A.tex.needsUpdate = true; full.fineAtlas = this; return full; },
    stats() { return { tiles: A.tiles.size, size: A.size, bytes: A.size * A.size * 4 }; },
  };
}
// the per-vertex attribute (zeros for a look with no paint: every geometry in a BatchedMesh carries the same attributes)
export const fineAttr = (THREE, full) => new THREE.BufferAttribute(full.FI && full.FI.length ? full.FI : new Uint16Array(full.P.length / 3), 1);

// ONE varying a vertex: vFine = (atlas texel u, v, AO, fade), centroid-sampled so it never extrapolates past its face; x < 0 = no paint.
// The corners sit a hair inside their tile, so the tile's origin is floor(uv / 4) × 4 anywhere on the face.
const VERT = `
  vFine = vec4( -1. );
  if ( aFine > .5 ) { float fid = aFine - 1., fab = floor( color.a * 255. + .5 ), fy = fab >= 240. ? 255. - fab : mod( fab, 85. ), fao = floor( fy / 4. ), fcn = fy - fao * 4.;
    vec2 fo = vec2( mod( fid, uFineW ), floor( fid / uFineW ) ) * 4.;
    vFine = vec4( fo + .002 + vec2( mod( fcn, 2. ), floor( fcn / 2. ) ) * 3.996, fao < .5 ? .55 : fao < 1.5 ? .72 : fao < 2.5 ? .87 : 1.,   // (chars.js AOV)
      smoothstep( .5, 1.5, gl_Position.w / ( .0125 * uFinePx ) ) ); }`;   // (texels a pixel: a texel is S / 4 = 1.25 cm)
// texels smaller than a pixel (a crowd, the far end of the near tier) fade to the tile's mean (mip 2 of the atlas: painted colour × its
// share), so fine paint never shimmers: the face then reads as its average, as the mid and far tiers draw it. The fade is per vertex
// (view depth against uFinePx), so nothing runs on a fragment without paint.
const FRAG = `
  if ( vFine.x >= 0. ) { vec2 fo = floor( vFine.xy * .25 ) * 4.; vec4 ft = texelFetch( uFine, ivec2( clamp( floor( vFine.xy ), fo, fo + 3. ) ), 0 ), fa = texelFetch( uFine, ivec2( fo * .25 + .5 ), 2 );
    fa.rgb /= max( fa.a, 1e-4 ); ft = mix( ft, fa, vFine.w );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * ft.rgb * vFine.z, ft.a ); }`;
// the walker material → draws fine paint (chains the material's own onBeforeCompile: tierize, installAnim2, debug hooks)
export function installFine(mat, atlas) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, atlas.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFine; uniform float uFineW, uFinePx; centroid varying vec4 vFine;')
      .replace('#include <fog_vertex>', VERT + '\n#include <fog_vertex>');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform highp sampler2D uFine; centroid varying vec4 vFine;')
      .replace('#include <color_fragment>', '#include <color_fragment>' + FRAG); };
  const prevR = mat.onBeforeRender;   // (the target's height in pixels × the projection's focal scale: the per-vertex fade's pixels a unit of depth)
  mat.onBeforeRender = function (r, sc, cam, ...rest) { prevR?.call(this, r, sc, cam, ...rest); const rt = r.getRenderTarget();
    atlas.uniforms.uFinePx.value = (rt ? rt.height : r.getContext().drawingBufferHeight) * cam.projectionMatrix.elements[5] / 2; };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|fine';
  return mat;
}
