// MAINLAND · THE SPRINKLERS, ANIMATED (MAINLAND FIXES 2026-10-06 · slime: "should we animate sprinklers so it's not static?"). The lot
// stamps only the head (yard.js); everything that moves is here, in ONE instanced draw call for every sprinkler on the page, and all of
// the motion is in the vertex shader (no per-frame CPU but three uniforms):
//   - THE SPINNER: three little arms turning on the head (a garden rotary), standing still while the sprinkler is off
//   - THE WATER: three arcs of voxel droplets, each droplet flung out along the arm's direction at the moment it left, so the arcs curl
//     as the head turns; they fall on a toon-slow parabola and land inside the lot (reach: houses.js keeps the spray inside the fences)
//   - THE WET PATCH SHIMMER: glints that wink on and off over the wet ring (lawn.js paints the patch), drying out after it stops
//   - THE SCHEDULE: by day each sprinkler runs ON of every CYCLE seconds, staggered by its seed (the pressure ramps up and down); at night
//     they're all off. In walk mode, droplets that would pass through you splash off you instead (uYou) and the rest stop there.
// Nothing here is in the walk grid (walk.js only gathers the page's own materials): the water and the shimmer are walk-through.
//   createSprinklers({ night }) → { mesh, set(key, list), drop(key), update(tSeconds, you), count }
//     list: [[x, y, z, reach, seed]] in the mesh's parent frame (y: the head's top); you: { x, y, z } (feet) or null
import * as THREE from 'three';

export const ARMS = 3, DROPS = 20, GLINTS = 18, HEAD = 4, PER = ARMS * DROPS + GLINTS + HEAD, CYCLE = 60, ON = 44;

const VERT = /* glsl */`
attribute vec4 aS; attribute vec4 aP;
uniform float uT, uDay; uniform vec4 uYou;
varying vec3 vCol; varying float vEm;
float h1(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
`;
const BEGIN = /* glsl */`
  const float CYC = ${CYCLE.toFixed(1)}, ONS = ${ON.toFixed(1)}, FLY = 1.4, SPIN = 1.9, TAU = 6.2831853, TOP = 0.3;   // (TOP: the head's top over the lawn)
  float seed = aS.w, reach = aP.w, kind = aP.x, a = aP.y, i = aP.z;
  float cyc = uT / CYC + seed, ph = fract(cyc) * CYC;                                   // seconds into its cycle
  float press = uDay * smoothstep(0.0, 1.5, ph) * (1.0 - smoothstep(ONS, ONS + 0.8, ph)); // the pressure (0: off)
  float run = (floor(cyc) * ONS + min(ph, ONS)) * uDay;                                 // its running time (the spinner stands still while off)
  vec3 c = aS.xyz, off = vec3(0.0); vec3 size = vec3(0.0); vCol = vec3(0.75, 0.92, 1.0); vEm = 0.0;
  if (kind < 0.5) {                                   // a droplet: arm a, the i-th in its arc
    float u = fract(uT / FLY + i / ${DROPS.toFixed(1)} + h1(seed * 31.0 + a)), age = u * FLY;
    float th = SPIN * (run - age) + a * TAU / ${ARMS.toFixed(1)} + seed * TAU;
    float j = 0.82 + 0.3 * h1(i * 7.1 + a * 3.3 + seed * 91.0), vh = 2.2 * (reach / 3.08) * j * press, v0 = 2.74 * (0.75 + 0.25 * press) * (0.92 + 0.12 * j);
    vec2 d = vec2(cos(th), sin(th)); float r = vh * age, y = 0.04 + v0 * age - 2.085 * age * age;
    off = vec3(d.x * r, y, d.y * r); float s = 0.105 * step(0.03 - TOP, y) * step(0.02, press) * (1.0 - 0.35 * step(0.5, mod(i, 3.0)));
    vCol = mod(i, 3.0) < 0.5 ? vec3(0.96, 0.99, 1.0) : vec3(0.75, 0.92, 1.0); vEm = 0.18;
    // walk mode: a droplet whose arc meets you splashes off you (a short burst back and up), and goes no further
    if (uYou.w > 0.5 && s > 0.0) { vec2 q = uYou.xz - c.xz; float along = dot(d, q), side = abs(d.x * q.y - d.y * q.x);
      if (along > 0.0 && side < 0.34 && r > along - 0.26) { float ah = (along - 0.26) / max(vh, 1e-3), yh = 0.04 + v0 * ah - 2.085 * ah * ah + c.y - uYou.y;
        if (yh > -0.3 && yh < 1.55) { float since = age - ah, sx = h1(i * 3.1 + a + seed) - 0.5;
          off = vec3(d.x * (along - 0.26), yh + uYou.y - c.y, d.y * (along - 0.26)) + vec3(-d.x * 0.9 * since - d.y * sx * 1.6 * since, 1.5 * since - 4.9 * since * since, -d.y * 0.9 * since + d.x * sx * 1.6 * since);
          s = since < 0.32 ? 0.06 : 0.0; vEm = 0.3; } } }
    size = vec3(s);
  } else if (kind < 1.5) {                            // the spinner: a cap (i 0) and three arm tips turning on it
    float th = SPIN * run + seed * TAU + i * TAU / 3.0;
    if (i < 0.5) { off = vec3(0.0, 0.02, 0.0); size = vec3(0.09, 0.05, 0.09); vCol = vec3(0.91, 0.14, 0.16); }
    else { off = vec3(cos(th) * 0.1, 0.03, sin(th) * 0.1); size = vec3(0.07, 0.04, 0.07); vCol = vec3(0.86, 0.88, 0.9); }
  } else {                                            // a glint on the wet ring: winks on at a fresh spot each time
    float rate = 0.45 + 0.6 * h1(i * 3.7 + seed * 17.0), q = uT * rate + h1(i * 1.3 + seed * 5.0), n = floor(q), f = fract(q);
    float wet = uDay * (ph < ONS ? smoothstep(0.0, 6.0, ph) : 1.0 - smoothstep(ONS, ONS + 12.0, ph));
    float rr = mix(0.8, min(reach, 2.6), sqrt(h1(n * 1.7 + i * 9.1 + seed))), ta = TAU * h1(n * 2.3 + i * 4.7 + seed * 3.0), b = pow(sin(f * 3.14159), 6.0) * wet;
    off = vec3(cos(ta) * rr, 0.015 - TOP, sin(ta) * rr); size = vec3(0.16, 0.012, 0.16) * b; vCol = vec3(0.86, 0.97, 1.0); vEm = 0.9 * b;
  }
  vec3 transformed = position * size + c + off;
`;

export function createSprinklers({ night = false } = {}) {
  const box = new THREE.BoxGeometry(1, 1, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index; geo.setAttribute('position', box.attributes.position); geo.setAttribute('normal', box.attributes.normal);
  let cap = 0; const alloc = n => { cap = Math.max(64, n); geo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(cap * PER * 4), 4)); geo.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(cap * PER * 4), 4)); };
  alloc(64); geo.instanceCount = 0;
  const U = { uT: { value: 0 }, uDay: { value: night ? 0 : 1 }, uYou: { value: new THREE.Vector4() } };
  const mat = new THREE.MeshStandardMaterial({ roughness: .25, metalness: .05 });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT + sh.vertexShader.replace('#include <begin_vertex>', BEGIN);
    sh.fragmentShader = 'varying vec3 vCol; varying float vEm;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb = vCol;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vCol * vEm;'); };
  mat.customProgramCacheKey = () => 'ml-sprinklers';
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'sprinklers'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 1;
  const sets = new Map();
  function rebuild() { let n = 0; for (const l of sets.values()) n += l.length; if (n > cap) alloc(n * 2);
    const S = geo.attributes.aS.array, P = geo.attributes.aP.array; let k = 0;
    const put = (s, kind, a, i) => { S.set([s[0], s[1], s[2], s[4]], k * 4); P.set([kind, a, i, s[3]], k * 4); k++; };
    for (const l of sets.values()) for (const s of l) { for (let a = 0; a < ARMS; a++) for (let i = 0; i < DROPS; i++) put(s, 0, a, i); for (let i = 0; i < HEAD; i++) put(s, 1, 0, i); for (let i = 0; i < GLINTS; i++) put(s, 2, 0, i); }
    geo.attributes.aS.needsUpdate = geo.attributes.aP.needsUpdate = true; geo.instanceCount = k; mesh.visible = k > 0; }
  return { mesh, uniforms: U,
    set(key, list) { if (list?.length) sets.set(key, list.map(s => [s[0], s[1], s[2], s[3] ?? 3, ((s[4] ?? 0) % 1 + 1) % 1])); else sets.delete(key); rebuild(); },
    drop(key) { if (sets.delete(key)) rebuild(); },
    update(t, you) { U.uT.value = t % 3600; if (you) U.uYou.value.set(you.x, you.y, you.z, 1); else U.uYou.value.w = 0; },
    list: () => [...sets.entries()],
    get count() { let n = 0; for (const l of sets.values()) n += l.length; return n; },
    dispose() { geo.dispose(); box.dispose(); mat.dispose(); } };
}
