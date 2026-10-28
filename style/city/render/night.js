// LIGHTING PASS (2026-09-28) · NIGHT. Each part its own control, all off by default (the night renders as it did):
//   pools    a warm pool of light on the ground under EVERY street lamp on the island (the corner lamps street.js stamps and the lamps a
//            kit declares): one instanced additive decal, no real lights, so the street grid glows from the overview. The fog fades
//            a pool to nothing (additive light must fade to black, not to the fog colour)
//   windows  window-light variety in gpu.js's tier shader: each lit window (the warm lit-glass colours) takes one of four tints —
//            warm tungsten, cool fluorescent, TV blue (flickering), neon pink — by a hash of its place (clusters by floor and bay), and a
//            share of the lit windows can be switched dark again
//   lamps    the lamp light lent to the lamps nearest the camera (below: the lamp term, no three lights): its colour and strength
// The night horizon glow over downtown is a sky control (sky.js `nightGlow`).
// V1 (render review 2026-10-09) · THE LAMP LIGHT WITHOUT FORWARD LIGHTS. The night build lent 11 PointLights (6 medium, 3 low) and the Fit
// Street SpotLight to the lamps nearest the camera, and every lit fragment on screen ran three's physical BRDF for all twelve, 150 m up
// or not: about 10 ms of GPU at the overview, 2.6 ms in the street. Now the same light is one term appended to three's light chunk, on
// night pages only: LAMP_SLOTS world positions, one colour x strength, the same cut-off (15 m) and decay (1.4), and three's own RE_Direct
// for each lamp in reach, so the ground, walls, people and cars take the light they took (diffuse and highlight). A fragment outside
// the sphere round the lamps in use pays one distance test (and the spot's); inside it, LAMP_SLOTS tests, and the BRDF only for the lamps
// in reach. The spot is the last slot, with its cone (one call site: the BRDF is inlined once). Fixed size and no three lights at all,
// so nothing recompiles as the lamps move. The term is switched on only while this scene renders (its onBeforeRender / onAfterRender),
// so another scene or renderer on the page (portraits, an interior) never takes the city's lamps.
import * as THREE from 'three';
import { WIN } from '../gpu.js';
import { paintedTexture } from '../canvastex.js';   // (black-ground fix: repainted after a GPU-process reset)

export const LAMP_SLOTS = 12;
// the term's uniforms, shared by reference by every lit material (three keeps a Float32Array or a plain {x,y,z,w} value by reference)
//   cityLampP[i]  xyz: a lamp's world position (unused slots far below the world)
//   cityLampK     rgb: colour x strength (linear, as three's light colour) · w: cut-off distance
//   cityLampX     x: decay · y: the spot's penumbra cosine · z: on (this scene is rendering)
//   cityLampB     the sphere round the lamps in use: xyz centre, w radius² (0: no lamps)
//   citySpotP     xyz: the spot's position, w: cut-off (0: no spot) · citySpotD xyz: from its target to it, w: cone cosine · citySpotK rgb: colour x strength, w: decay
const LU = { cityLampP: { value: new Float32Array(LAMP_SLOTS * 4) }, cityLampK: { value: { x: 0, y: 0, z: 0, w: 15 } }, cityLampX: { value: { x: 1.4, y: 1, z: 0, w: 0 } },
  cityLampB: { value: { x: 0, y: 0, z: 0, w: 0 } }, citySpotP: { value: { x: 0, y: 0, z: 0, w: 0 } }, citySpotD: { value: { x: 0, y: 1, z: 0, w: 1 } }, citySpotK: { value: { x: 0, y: 0, z: 0, w: 1 } } };
const LAMP_PARS = `
#define CITY_LAMPS ${LAMP_SLOTS}
uniform vec4 cityLampP[ CITY_LAMPS ]; uniform vec4 cityLampK; uniform vec4 cityLampX; uniform vec4 cityLampB; uniform vec4 citySpotP; uniform vec4 citySpotD; uniform vec4 citySpotK;`;
const LAMP_TERM = `
#if defined( RE_Direct )
	if ( cityLampX.z > 0. ) {
		vec3 cwp = ( geometryPosition - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix ), ccd = cwp - cityLampB.xyz;
		for ( int i = dot( ccd, ccd ) < cityLampB.w ? 0 : CITY_LAMPS; i <= CITY_LAMPS; i ++ ) {
			bool sp = i == CITY_LAMPS; vec4 lp = sp ? citySpotP : cityLampP[ min( i, CITY_LAMPS - 1 ) ]; float cut = sp ? citySpotP.w : cityLampK.w;
			vec3 lv = lp.xyz - cwp; float d2 = dot( lv, lv );
			if ( d2 < cut * cut ) { float ld = sqrt( d2 ); vec3 ldir = lv / ld; float sa = sp ? smoothstep( citySpotD.w, cityLampX.y, dot( ldir, citySpotD.xyz ) ) : 1.;
				directLight.direction = mat3( viewMatrix ) * ldir; directLight.color = ( sp ? citySpotK.rgb : cityLampK.rgb ) * sa * getDistanceAttenuation( ld, cut, sp ? citySpotK.w : cityLampX.x ); directLight.visible = true;
				RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); } }
	}
#endif`;
// install once, before any lit material compiles (createLighting runs before main.js makes its materials): the chunk text for every lit
// material (standard, physical, lambert, phong, toon), the uniforms on their ShaderLib entries (cloned per program, values by reference)
// TAPE's grade (2026-10-09) installs it on a DAY page too (createNight grade), where only the grade lights it (render/grade.js lampLight).
// The same text: on the render review's paused-loop bench (3200 × 1826, p10) every other shape tried (fewer slots, Lambert only, no
// loop, the spot out of the loop) raised the cost of EVERY frame with the term off by up to +0.5 ms; this one by ~0.04 (scene).
let installed = false;
function installLampTerm(scene) {
  if (!installed) { installed = true; const C = THREE.ShaderChunk;
    C.lights_pars_begin += LAMP_PARS; C.lights_fragment_begin += LAMP_TERM;
    for (const k of ['standard', 'physical', 'lambert', 'phong', 'toon']) if (THREE.ShaderLib[k]) Object.assign(THREE.ShaderLib[k].uniforms, LU); }
  const before = scene.onBeforeRender, after = scene.onAfterRender;
  scene.onBeforeRender = function (...a) { before.apply(this, a); LU.cityLampX.value.z = gate && lampsOn ? 1 : 0; };
  scene.onAfterRender = function (...a) { after.apply(this, a); LU.cityLampX.value.z = 0; };
}
let gate = true, lampsOn = true;   // (lampsOn: TAPE's time-of-day grade — the lamp light's level is above 0)

export const NIGHT_FIELDS = {
  pools: { v: 0, min: 0, max: 3, step: .01, label: 'lamp pools', hint: 'warm light decals under every street lamp (0: off)' },
  poolSize: { v: 11, min: 3, max: 24, step: .1, label: 'pool size (m)' },
  poolColor: { v: '#ffc47a', color: true, label: 'pool colour' },
  windows: { v: 0, min: 0, max: 1, step: .01, label: 'window tints', hint: 'mix of tints over the warm lit windows (0: all warm, as today)' },
  cool: { v: .22, min: 0, max: 1, step: .01, label: 'share cool fluorescent' },
  tv: { v: .14, min: 0, max: 1, step: .01, label: 'share TV blue' },
  neon: { v: .07, min: 0, max: 1, step: .01, label: 'share neon' },
  dark: { v: 0, min: 0, max: .8, step: .01, label: 'lit windows off', hint: 'share of the lit windows switched dark again' },
  lampLight: { v: 22, min: 0, max: 80, step: .5, label: 'lamp light', hint: 'the light the lamps nearest the camera cast (the lamp term in the light shader)' },
  lampColor: { v: '#ffd79a', color: true, label: 'lamp light colour' },
};

function poolTexture() {
  const t = paintedTexture(128, 128, g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.28, 'rgba(255,255,255,.62)'); gr.addColorStop(.62, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }); t.colorSpace = THREE.NoColorSpace; return t; }

// TAPE · THE TIME-OF-DAY GRADE (render/grade.js): `grade` installs the lamp term on a day page too and builds the pools at start (main.js's
// warm-up compiles them), and level(a, { pools, term }) sets the lamps' level, 0 … 1: the lamp light and the spot are × a (the term is off
// at 0, and with term false), the pools are the night section's own × a on the night build, `pools` × a on a day build. Default 1 on the
// night build, 0 on a day one.
export function createNight({ scene, lampHeads, night = false, grade = false }) {   // night: the page runs the night build (blue hour, night); pools draw only then, and the lamp light
  let pools = null, heads = null, vals = null, level = night ? 1 : 0, dayPools = 0, term = true, placed = 0, hf = 1; const col = new THREE.Color(), spotK = { x: 0, y: 0, z: 0 };
  if (night || grade) installLampTerm(scene);
  lampsOn = level > 0;
  const lampK = () => { if (!vals) return; const a = term ? level * hf : 0; col.set(vals.lampColor).multiplyScalar(vals.lampLight * a); Object.assign(LU.cityLampK.value, { x: col.r, y: col.g, z: col.b });
    Object.assign(LU.citySpotK.value, { x: spotK.x * a, y: spotK.y * a, z: spotK.z * a }); lampsOn = a > 0 && (night || placed > 0); };
  const poolsNow = () => { if (!pools || !vals) return; const p = (night ? vals.pools : dayPools * hf) * level; pools.visible = (night || grade) && p > 0; mat.color.set(vals.poolColor).multiplyScalar(p * .8); };
  const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const near = { value: { x: 0, y: 0 } };   // (TAPE's grade: the pools fade in from x to y m from the camera, where its term lights the lamps nearest it; 0, 0: no fade)
  mat.onBeforeCompile = sh => { sh.uniforms.poolNear = near; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec2 poolNear;').replace('#include <fog_fragment>', '#ifdef USE_FOG\n  gl_FragColor.rgb *= ( 1. - smoothstep( fogNear, fogFar, vFogDepth ) ) * clamp( ( vFogDepth - poolNear.x ) / max( poolNear.y - poolNear.x, 1e-3 ), 0., 1. );\n#endif'); };
  mat.customProgramCacheKey = () => 'light-pools';
  function build(size) { heads ??= lampHeads(); const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); mat.map = poolTexture();
    pools = new THREE.InstancedMesh(g, mat, Math.max(1, heads.length)); const M = new THREE.Matrix4();
    heads.forEach(([x, z], k) => { M.makeScale(size, 1, size).setPosition(x, .215, z); pools.setMatrixAt(k, M); }); pools.count = heads.length;
    pools.computeBoundingSphere(); pools.renderOrder = 2; pools.castShadow = pools.receiveShadow = false; pools.userData.size = size; scene.add(pools); }
  return {
    get lamps() { return heads ? heads.length : 0; }, get pools() { return pools; },
    apply(v) { vals = v;
      if (v.pools > 0 || grade) { if (!pools) build(v.poolSize); else if (pools.userData.size !== v.poolSize) { const M = new THREE.Matrix4(); heads.forEach(([x, z], k) => { M.makeScale(v.poolSize, 1, v.poolSize).setPosition(x, .215, z); pools.setMatrixAt(k, M); }); pools.instanceMatrix.needsUpdate = true; pools.computeBoundingSphere(); pools.userData.size = v.poolSize; } }
      poolsNow();
      Object.assign(WIN.value, { x: v.windows, y: v.cool, z: v.tv, w: v.neon }); WIN.extra.value.x = v.dark;
      lampK();
    },
    level(a, { pools: p = null, term: t = true } = {}) { a = Math.max(0, Math.min(1, a)); if (a === level && (p === null || p === dayPools) && !!t === term) return; level = a; term = !!t; if (p !== null) dayPools = p; lampK(); poolsNow(); },
    get levelNow() { return level; }, get lit() { return level > 0 && term; },
    heightFade(f) { if (f === hf) return; hf = f; lampK(); poolsNow(); },   // (main.js, a day page under the grade: the lamp light and the pools × f by the camera's height — the night build shows neither from high up)
    poolNear(a = 0, b = 0) { near.value.x = a; near.value.y = b; },   // (render/grade.js: the pools fade in from a to b m off the camera, where the lamp light is)
    update(t) { WIN.extra.value.y = t; },
    // the lamps in use, [[x, y, z], …] (main.js: the nearest to the camera, at most LAMP_SLOTS), and the sphere round them
    place(pts) { const P = LU.cityLampP.value, B = LU.cityLampB.value, n = Math.min(LAMP_SLOTS, pts.length); let cx = 0, cy = 0, cz = 0; placed = n;
      for (let k = 0; k < LAMP_SLOTS; k++) { const q = k < n ? pts[k] : [0, -1e4, 0]; P[k * 4] = q[0]; P[k * 4 + 1] = q[1]; P[k * 4 + 2] = q[2]; P[k * 4 + 3] = 0; if (k < n) { cx += q[0] / n; cy += q[1] / n; cz += q[2] / n; } }
      let r = 0; for (let k = 0; k < n; k++) r = Math.max(r, Math.hypot(P[k * 4] - cx, P[k * 4 + 1] - cy, P[k * 4 + 2] - cz));
      Object.assign(B, { x: cx, y: cy, z: cz, w: n ? (r + LU.cityLampK.value.w) ** 2 : 0 }); lampK(); },
    // the one spot (main.js: the Fit Street billboard's), as three's SpotLight(color, intensity, distance, angle, penumbra, decay)
    spot({ pos, target, color, intensity, distance, angle, penumbra = 0, decay = 2 }) { col.set(color).multiplyScalar(intensity);
      const d = new THREE.Vector3(...pos).sub(new THREE.Vector3(...target)).normalize();
      Object.assign(LU.citySpotP.value, { x: pos[0], y: pos[1], z: pos[2], w: distance }); Object.assign(LU.citySpotD.value, { x: d.x, y: d.y, z: d.z, w: Math.cos(angle) });
      Object.assign(spotK, { x: col.r, y: col.g, z: col.b }); LU.citySpotK.value.w = decay; lampK(); LU.cityLampX.value.y = Math.cos(angle * (1 - penumbra)); },
    gate(on) { gate = !!on; },   // (a measuring switch: tools time the scene with the lamp light off)
  };
}
