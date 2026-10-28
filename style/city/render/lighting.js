// LIGHTING PASS (2026-09-28) · LIGHT, SKY, FOG, CLOUDS, CONTACT SHADOWS, NIGHT and the TIMES OF DAY, as registered settings
// (render/settings.js, meta.group 'light'). main.js calls createLighting() where it used to build the sky, haze, sun and fill.
// THE DEFAULT IS TODAY'S LOOK: every field's default is today's value (day), ?tod=night applies the 'night' time (today's night values),
// and every new effect registers off. Sections, in registration order (the time comes first so a preset's own values win over it):
//   time     day · golden hour · overcast · blue hour · night: a bundle of light, sky and fog values, blended over `blend` s when switched.
//            Blue hour and night need the night build (lit windows, baked per time of day): switching across that line reloads the
//            page with ?tod=night (or without it), carrying the whole look over in sessionStorage — a quick reload from the bake
//   light    sun colour, strength, elevation, azimuth · hemisphere sky/ground fill · environment · shadow type, softness, strength
//   sky      render/sky.js · clouds: render/sky-clouds.js · fog: near/far (street and overhead), height haze, sky-matched or a colour
//   contact  render/lighting-contacts.js · night: render/night.js
// Per frame: the sky mesh's onBeforeRender (the dome is drawn every frame; no hook in main.js's render call). window.__light: the api.
import * as THREE from 'three';
import * as S from './settings.js';
import { PAL } from '../style.js';
import { kindAt, urban } from '../plan.js';
import { cornerLamps, cornerPosts, LAMP_REACH } from '../ground.js';
import { MODS } from '../modules.js';
import { createSky, SKY_FIELDS } from './sky.js';
import { createClouds, CLOUD_FIELDS } from './sky-clouds.js';
import { createNight, NIGHT_FIELDS } from './night.js';
import { createContacts, CONTACT_FIELDS } from './lighting-contacts.js';
import { installTodGrade } from './grade.js';

// ── the height haze: one term in three's fog chunks, so every fogged material picks it up. fogHaze = (amount, base height, thinning
// height, distance it takes to build up); amount 0 skips it (the fog is exactly today's). The world height comes from the view-space
// position (world y = dot(view matrix column 1, mvPosition − view translation)), no world-position varying needed.
const HAZE = { x: 0, y: 0, z: 18, w: 220 };   // (a plain {x,y,z,w}: cloneUniforms keeps the reference, so one object drives every material)
{ const C = THREE.ShaderChunk, want = { fog_vertex: '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n#endif', fog_pars_vertex: '#ifdef USE_FOG\n\tvarying float vFogDepth;\n#endif' };
  if (C.fog_vertex === want.fog_vertex && C.fog_pars_vertex === want.fog_pars_vertex && C.fog_fragment.includes('\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );') && C.fog_pars_fragment.includes('\tvarying float vFogDepth;')) {
    C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogWY;\n#endif';
    C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogWY = dot( viewMatrix[ 1 ].xyz, mvPosition.xyz - viewMatrix[ 3 ].xyz );\n#endif';
    C.fog_pars_fragment = C.fog_pars_fragment.replace('\tvarying float vFogDepth;', '\tvarying float vFogDepth;\n\tvarying float vFogWY;\n\tuniform vec4 fogHaze;');
    C.fog_fragment = C.fog_fragment.replace('\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
      '\tif ( fogHaze.x > 0. ) fogFactor = 1. - ( 1. - fogFactor ) * ( 1. - clamp( fogHaze.x * exp( - max( vFogWY - fogHaze.y, 0. ) / fogHaze.z ) * smoothstep( 0., fogHaze.w, vFogDepth ), 0., 1. ) );\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );');
    for (const s of Object.values(THREE.ShaderLib)) if (s.uniforms?.fogColor) s.uniforms.fogHaze = { value: HAZE };
  } else console.warn('lighting: three fog chunks are not the r185 text — the height haze is off');
}

const deg = THREE.MathUtils.radToDeg, rad = THREE.MathUtils.degToRad, hex = n => '#' + n.toString(16).padStart(6, '0');
const DEF_DIR = new THREE.Vector3(-0.52, 0.74, 0.42).normalize(), DEF_EL = deg(Math.asin(DEF_DIR.y)), DEF_AZ = (deg(Math.atan2(DEF_DIR.x, DEF_DIR.z)) + 360) % 360;
export const TODS = ['day', 'golden', 'overcast', 'blue', 'night'], NIGHT_TODS = new Set(['blue', 'night']);
const LIGHT_FIELDS = {
  sunColor: { v: '#fff2dc', color: true, label: 'sun colour' },
  sun: { v: 3.0, min: 0, max: 8, step: .01, label: 'sun strength' },
  elevation: { v: DEF_EL, min: 2, max: 90, step: .1, label: 'sun elevation (°)' },
  azimuth: { v: DEF_AZ, min: 0, max: 360, step: .1, label: 'sun azimuth (°)' },
  skyFill: { v: '#d6ecff', color: true, label: 'fill: sky colour', hint: 'hemisphere light from above (the shadow sides)' },
  groundFill: { v: '#e0cfb0', color: true, label: 'fill: ground colour' },
  fill: { v: 1.05, min: 0, max: 3, step: .01, label: 'fill strength', hint: 'today ~1/3 of the sun: shadow sides stay bright' },
  env: { v: .55, min: 0, max: 2, step: .01, label: 'environment (sky reflections)' },
  shadows: { v: 'PCF', options: ['PCF', 'basic', 'VSM'], label: 'shadow type' },
  shadowRadius: { v: 1, min: 0, max: 8, step: .1, label: 'shadow softness' },
  shadowStrength: { v: 1, min: 0, max: 1, step: .01, label: 'shadow strength' },
};
const FOG_FIELDS = {
  near: { v: 90, min: 0, max: 400, step: 1, label: 'street: near (m)' }, far: { v: 380, min: 60, max: 900, step: 1, label: 'street: far (m)' },
  nearHigh: { v: 150, min: 0, max: 400, step: 1, label: 'overhead: near (m)' }, farHigh: { v: 340, min: 60, max: 900, step: 1, label: 'overhead: far (m)' },
  haze: { v: 0, min: 0, max: 1, step: .01, label: 'height haze', hint: 'haze pooled low over streets and water; roofs stay crisp' },
  hazeTop: { v: 18, min: 2, max: 120, step: .5, label: 'haze thins over (m)' },
  hazeBase: { v: 0, min: -5, max: 60, step: .5, label: 'haze base height (m)' },
  hazeDist: { v: 220, min: 20, max: 800, step: 1, label: 'haze builds over (m)' },
  matched: { v: true, label: 'sky-matched', hint: 'the fog is the horizon colour (the rule); off: the colour below' },
  color: { v: hex(PAL.horizon), color: true, label: 'fog colour (when not sky-matched)' },
};
const TIME_FIELDS = { tod: { v: 'day', options: TODS, label: 'time of day', hint: 'blue hour and night reload with the night build (lit windows)' },
  blend: { v: 1.5, min: 0, max: 6, step: .1, label: 'blend (s)' } };
// the times of day: values for light, sky and fog (everything not listed is the default); 'day' is the default, 'night' today's night
const BUNDLE = {
  day: {},
  golden: { light: { sunColor: '#ffac5e', sun: 3.3, elevation: 17, azimuth: 286, skyFill: '#a4b4f4', groundFill: '#e8a878', fill: .62, env: .28, shadowRadius: 1.6 },
    sky: { top: '#2d56e0', horizon: '#ff9c8a', ground: '#ff9c8a', curve: .45, band: .72, bandColor: '#ffa044', bandWidth: .13, sunDisc: 1.6, sunSize: 2.2, sunGlow: .75, glowSize: 18 },   // (orange → coral → indigo: saturated, never pastel)
    fog: { haze: .16, hazeTop: 22 } },
  overcast: { light: { sunColor: '#eef1f5', sun: 1.1, elevation: 62, skyFill: '#dfe6ee', groundFill: '#b3ada4', fill: 1.55, env: .7, shadowRadius: 4, shadowStrength: .45 },
    sky: { top: '#8b99ae', horizon: '#d2d9e1', ground: '#d2d9e1', curve: .85 }, fog: { far: 330, farHigh: 300, haze: .3, hazeTop: 26 } },
  blue: { light: { sunColor: '#7c86ff', sun: .7, elevation: 9, azimuth: 286, skyFill: '#5b6be0', groundFill: '#3b2447', fill: .8, env: .3, shadowRadius: 2.5, shadowStrength: .6 },
    sky: { top: '#16268c', horizon: '#7458d6', ground: '#7458d6', curve: .55, band: .5, bandColor: '#ff6c98', bandWidth: .1, nightGlow: .35 }, fog: { haze: .12 } },
  night: { light: { sunColor: '#8fa4ff', sun: .35, skyFill: '#4050a0', groundFill: '#201830', fill: .5, env: .25 },
    sky: { top: hex(PAL.nightTop), horizon: hex(PAL.nightHor), ground: hex(PAL.nightHor) } },
};
const BUNDLED = { light: Object.keys(LIGHT_FIELDS).filter(k => k !== 'shadows'), sky: Object.keys(SKY_FIELDS), fog: ['near', 'far', 'nearHigh', 'farHigh', 'haze', 'hazeTop', 'hazeBase', 'hazeDist'] };
const bundleOf = tod => { const b = BUNDLE[tod] || {}, F = { light: LIGHT_FIELDS, sky: SKY_FIELDS, fog: FOG_FIELDS }, out = {};
  for (const [sec, keys] of Object.entries(BUNDLED)) { out[sec] = {}; for (const k of keys) out[sec][k] = b[sec]?.[k] ?? F[sec][k].v; } return out; };
const STASH = 'city:look-reload';

export function createLighting({ scene, renderer, night: NIGHT = false, shot: SHOT = false, bake = false, grade: GRADE = false, Q = new URLSearchParams() }) {
  if (GRADE) installTodGrade();   // (TAPE's time-of-day grade: its blue grade in three's tone-mapping chunk, before any material compiles)
  if (!SHOT && !bake) try { const st = sessionStorage.getItem(STASH); if (st) { sessionStorage.removeItem(STASH); S.load(JSON.parse(st), { reset: true }); } } catch {}   // (a time-of-day switch across the night build: the look, carried over)
  // ── objects, created in today's order (sky, environment, fog, sun, fill)
  const sky = createSky({ scene }), clouds = createClouds({ scene });
  scene.fog = new THREE.Fog(new THREE.Color(PAL.horizon), 90, 380);
  const sunDir = DEF_DIR.clone(), sun = new THREE.DirectionalLight(0xfff2dc, 3.0); sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05); scene.add(hemi);
  const night = createNight({ scene, lampHeads, night: NIGHT, grade: GRADE });   // (V1: on a night page this installs the lamp term in three's light chunk, before any lit material compiles; the grade: on a day page too)
  const contacts = createContacts({ scene, posts: cornerPostsAll });
  const pm = new THREE.PMREMGenerator(renderer); let envRT = null, envKey = '', envAt = -1e9;
  // ── the rendered state (tgt: from the settings; cur: what is drawn — equal, except while a time-of-day switch blends)
  const col = () => new THREE.Color(), NUM = ['sunInt', 'el', 'hemiInt', 'env', 'shR', 'shS', 'curve', 'band', 'bandW', 'disc', 'discSize', 'glow', 'glowSize', 'city', 'cityW', 'near', 'far', 'nearH', 'farH', 'haze', 'hazeTop', 'hazeBase', 'hazeDist'];
  const COL = ['sunCol', 'hemiSky', 'hemiGnd', 'top', 'hor', 'gnd', 'bandCol', 'cityCol', 'fogCol'];
  const mk = () => { const o = { az: 0, fogMatched: true }; for (const k of NUM) o[k] = 0; for (const k of COL) o[k] = col(); return o; };
  const tgt = mk(), cur = mk(), from = mk(); let blend = null, ready = false, appliedTod = 'day';
  const copy = (d, s) => { for (const k of NUM) d[k] = s[k]; for (const k of COL) d[k].copy(s[k]); d.az = s.az; d.fogMatched = s.fogMatched; d.azExact = s.azExact; d.elExact = s.elExact; };
  const FADE = { street: [90, 380], overhead: [150, 340], h0: 6, h1: 150, close: .92 };   // (main.js's haze rule reads it: fadeFor)
  const lastDir = new THREE.Vector3(); const C1 = new THREE.Color();
  function draw(st) {
    sun.color.copy(st.sunCol); sun.intensity = st.sunInt; sun.shadow.radius = st.shR; sun.shadow.intensity = st.shS;
    if (st.elExact && st.azExact) sunDir.copy(DEF_DIR); else { const e = rad(st.el), a = rad(st.az); sunDir.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)); }
    if (!sunDir.equals(lastDir)) { lastDir.copy(sunDir); sun.position.copy(sun.target.position).addScaledVector(sunDir, 260); renderer.shadowMap.needsUpdate = true; }
    hemi.color.copy(st.hemiSky); hemi.groundColor.copy(st.hemiGnd); hemi.intensity = st.hemiInt; scene.environmentIntensity = st.env;
    sky.set({ top: st.top, hor: st.hor, gnd: st.gnd, curve: st.curve, band: st.band, bandCol: st.bandCol, bandW: st.bandW, disc: st.disc, discSize: st.discSize, glow: st.glow, glowSize: st.glowSize, city: st.city, cityCol: st.cityCol, cityW: st.cityW }, st.sunCol, sunDir);
    if (st.fogMatched) sky.horizonOf(scene.fog.color); else scene.fog.color.copy(st.fogCol);
    FADE.street[0] = st.near; FADE.street[1] = st.far; FADE.overhead[0] = st.nearH; FADE.overhead[1] = st.farH;
    Object.assign(HAZE, { x: st.haze, y: st.hazeBase, z: st.hazeTop, w: st.hazeDist });
    clouds.light({ sunCol: st.sunCol, sunInt: st.sunInt, sunDir, top: st.top, hor: st.hor, curve: st.curve, bandCol: st.bandCol, band: st.band });
    const k = [st.top, st.hor, st.gnd, st.bandCol, st.sunCol, st.cityCol].map(c => c.getHexString()).join() + [st.curve, st.band, st.bandW, st.disc, st.discSize, st.glow, st.glowSize, st.city, st.cityW].join() + sunDir.toArray().map(x => x.toFixed(3));
    if (k !== envKey) { envKey = k; envDirty = true; } }
  let envDirty = false;
  // ── TAPE's time-of-day grade (render/grade.js sets k): what is drawn goes from the build's own state (k 0) through blue hour (.5) to the
  // other build's time (1): night on a day build, day on a night build. The times' own bundles; the sun keeps the build's direction
  // (no shadow redraw) and the fog its sky-matching. Every push is graded, so a time-of-day blend under the grade stays graded.
  const gBlue = mk(), gOther = mk(), gst = mk(); let gk = 0, gEnds = false, gAt = -1e9;
  function graded(st) { if (!(gk > 0)) return st;
    if (!gEnds) { gEnds = true; for (const [d, tod] of [[gBlue, 'blue'], [gOther, NIGHT ? 'day' : 'night']]) { const b = bundleOf(tod); intoLight(d, b.light); intoSky(d, b.sky); intoFog(d, b.fog); } }
    const a = gk < .5 ? st : gBlue, b = gk < .5 ? gBlue : gOther, e = gk < .5 ? gk * 2 : gk * 2 - 1;
    for (const k of NUM) gst[k] = a[k] + (b[k] - a[k]) * e; for (const k of COL) gst[k].copy(a[k]).lerp(b[k], e);
    gst.el = st.el; gst.az = st.az; gst.elExact = st.elExact; gst.azExact = st.azExact; gst.fogMatched = st.fogMatched; gst.fogCol.copy(st.fogCol); return gst; }
  const push = st => draw(graded(st));
  function regenEnv() { const rt = pm.fromScene(sky.envScene, .02); scene.environment = rt.texture; envRT?.dispose(); envRT = rt; envDirty = false; envAt = performance.now(); }
  const commit = () => { if (!blend) { copy(cur, tgt); push(cur); } };
  // ── sections (apply → the target state)
  const meta = (title, order) => ({ title, group: 'light', order });
  let first = 0; const live = () => !SHOT && first > 0 && performance.now() - first > 800;   // (blend only a switch made in the running page: a start-up ?preset= or a shot is instant)
  const vT = S.register('time', TIME_FIELDS, v => { if (!ready || v.tod === appliedTod) return; setTod(v.tod, { instant: !(v.blend > 0) || !live() }); }, meta('Time of day', 0));
  function intoLight(st, v) { st.sunCol.set(v.sunColor); st.sunInt = v.sun; st.el = v.elevation; st.az = v.azimuth; st.elExact = v.elevation === DEF_EL; st.azExact = v.azimuth === DEF_AZ;
    st.hemiSky.set(v.skyFill); st.hemiGnd.set(v.groundFill); st.hemiInt = v.fill; st.env = v.env; st.shR = v.shadowRadius; st.shS = v.shadowStrength; }
  function intoSky(st, v) { st.top.set(v.top); st.hor.set(v.horizon); st.gnd.set(v.ground); st.curve = v.curve; st.band = v.band; st.bandCol.set(v.bandColor); st.bandW = v.bandWidth;
    st.disc = v.sunDisc; st.discSize = v.sunSize; st.glow = v.sunGlow; st.glowSize = v.glowSize; st.city = v.nightGlow; st.cityCol.set(v.nightGlowColor); st.cityW = v.nightGlowWidth; }
  function intoFog(st, v) { st.near = v.near; st.far = v.far; st.nearH = v.nearHigh; st.farH = v.farHigh; st.haze = v.haze; st.hazeTop = v.hazeTop; st.hazeBase = v.hazeBase; st.hazeDist = v.hazeDist;
    if ('matched' in v) { st.fogMatched = v.matched; st.fogCol.set(v.color); } }
  const vL = S.register('light', LIGHT_FIELDS, v => { intoLight(tgt, v);
    const type = { PCF: THREE.PCFShadowMap, basic: THREE.BasicShadowMap, VSM: THREE.VSMShadowMap }[v.shadows] ?? THREE.PCFShadowMap;
    if (renderer.shadowMap.type !== type) { renderer.shadowMap.type = type; renderer.shadowMap.needsUpdate = true; }
    commit(); }, meta('Light', 1));
  const vS = S.register('sky', SKY_FIELDS, v => { intoSky(tgt, v); commit(); }, meta('Sky', 2));
  const vF = S.register('fog', FOG_FIELDS, v => { intoFog(tgt, v); commit(); }, meta('Fog and haze', 3));
  S.register('clouds', CLOUD_FIELDS, v => clouds.apply(v), meta('Clouds', 4));
  S.register('contact', CONTACT_FIELDS, v => contacts.apply(v), meta('Contact shadows', 5));
  S.register('night', NIGHT_FIELDS, v => night.apply(v), meta('Night lights', 6));
  // ── the time of day: write its bundle (one load: a preset's explicit values, loaded after, still win), blend, or reload for the build
  function setTod(tod, { instant = false } = {}) { if (!BUNDLE[tod]) return; const wasNight = NIGHT_TODS.has(appliedTod); appliedTod = tod;
    if (S.get('time').tod !== tod) S.get('time').tod = tod;   // (a ?time= start or the page's own time: the field shows it)
    if (!instant && ready) { copy(from, cur); blend = { t0: performance.now(), dur: Math.max(.05, S.get('time').blend) * 1000 }; }
    S.load(bundleOf(tod), { reset: false }); if (instant || !ready) { blend = null; copy(cur, tgt); push(cur); }
    if (ready && !SHOT && !bake && NIGHT_TODS.has(tod) !== NIGHT) setTimeout(() => reloadFor(tod), 0); }   // (after the load that set it has finished: the stash then holds the whole look)
  function reloadFor(tod) { try { sessionStorage.setItem(STASH, JSON.stringify(S.snapshot())); } catch {}
    const u = new URL(location.href); if (NIGHT_TODS.has(tod)) u.searchParams.set('tod', 'night'); else u.searchParams.delete('tod'); u.searchParams.delete('time'); location.href = u.href; }
  const mine = [['light', vL, LIGHT_FIELDS], ['sky', vS, SKY_FIELDS], ['fog', vF, FOG_FIELDS]];
  const atDefaults = mine.every(([, v, F]) => Object.entries(F).every(([k, s]) => v[k] === s.v));
  const urlTod = Q.get('time');
  if (TODS.includes(urlTod)) setTod(urlTod, { instant: true });
  else if (vT.tod !== 'day' && atDefaults) setTod(vT.tod, { instant: true });   // (a preset that names only the time)
  else if (vT.tod === 'day' && NIGHT && atDefaults) setTod('night', { instant: true });   // (?tod=night: today's night)
  else appliedTod = vT.tod;
  copy(cur, tgt); push(cur); regenEnv(); ready = true;
  if (!SHOT && !bake && NIGHT_TODS.has(appliedTod) !== NIGHT) reloadFor(appliedTod);   // (a preset whose time needs the other build)
  // ── per frame (the sky dome's onBeforeRender: once per frame, before the clouds draw)
  let last = null, clock = 0; const camP = new THREE.Vector3();
  sky.mesh.onBeforeRender = (r, s, camera) => { const now = performance.now(); if (last !== null && now - last < 1) return; const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000); last = now;
    if (!first) first = now; if (!SHOT) clock += dt; camera.getWorldPosition(camP);
    if (blend) { const p = Math.min(1, (now - blend.t0) / blend.dur), e = p * p * (3 - 2 * p);
      for (const k of NUM) cur[k] = from[k] + (tgt[k] - from[k]) * e; for (const k of COL) cur[k].copy(from[k]).lerp(tgt[k], e);
      let da = ((tgt.az - from.az) % 360 + 540) % 360 - 180; cur.az = (from.az + da * e + 360) % 360; cur.fogMatched = tgt.fogMatched; cur.elExact = p >= 1 && tgt.elExact; cur.azExact = p >= 1 && tgt.azExact;
      push(cur); if (p >= 1) { blend = null; copy(cur, tgt); push(cur); } }
    if (envDirty && now - envAt > (blend || now - gAt < 400 ? 350 : 120)) regenEnv();   // (while a blend or the grade moves: the sky light every 350 ms)
    sky.follow(camP); clouds.update(SHOT ? 0 : dt, camP); night.update(clock); contacts.update(camP, window.__city?.peds, window.__city?.traffic); };
  const api = { sun, sunDir, hemi, sky, clouds, night, contacts, FADE, settings: S, TODS, relamp: () => night.apply(S.get('night')), setTod: t => S.set('time', 'tod', t), get tod() { return appliedTod; }, get blending() { return !!blend; },
    regenEnv,   // (V7: main.js re-renders the environment after a WebGL context restore: a rendered target comes back empty)
    grade: { set(k) { k = Math.max(0, Math.min(1, +k || 0)); if (k === gk) return; gk = k; gAt = performance.now(); if (ready) push(cur); }, get k() { return gk; } },   // (render/grade.js)
    stats: () => ({ tod: appliedTod, grade: gk, cloudVoxels: clouds.voxels, contacts: contacts.count, lampPools: night.lamps }) };
  window.__light = api; return api;
}

// every street lamp's head on the island ([x, z]): the corner lamps of every urban and woods block (ground.js cornerLamps, as main.js's
// placeLamps finds them) and the lamps each kit declares
const LAMP_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]];
function lampHeads() { const out = [];
  for (let i = -32; i < 32; i++) for (let j = -32; j < 32; j++) { const k = kindAt(i, j); if (!urban(k) && k !== '.') continue; for (const [x, z, rot] of cornerLamps(i, j)) out.push([x + LAMP_DIR[rot][0] * LAMP_REACH, z + LAMP_DIR[rot][1] * LAMP_REACH]); }
  for (const k of MODS.kits.values()) for (const [x, z, rot] of k.lamps || []) out.push([x + LAMP_DIR[rot][0] * LAMP_REACH, z + LAMP_DIR[rot][1] * LAMP_REACH]);
  return out; }
function cornerPostsAll() { const out = []; for (let i = -32; i < 32; i++) for (let j = -32; j < 32; j++) { const k = kindAt(i, j); if (!urban(k) && k !== '.') continue; for (const p of cornerPosts(i, j)) out.push(p); } return out; }
