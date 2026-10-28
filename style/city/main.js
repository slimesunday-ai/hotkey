// AI City · Springfield Street · pass 1d: the distance fade + the audit. Renderer, sky + haze, sun, views,
// streaming (stream.js) fed by the worker pool (pool.js/worker.js/jobs.js) and the IndexedDB cache (cache.js), quality presets and
// dynamic resolution (quality.js), stress mode (?stress=1: every urban block of the plan) and the benchmark (?bench=1, bench.js).
// Pass 1d: the haze follows one rule at every height (fadeFor), new blocks and tier swaps dissolve in (stream.js), ?blur=1 adds an
// optional distance blur (blur.js), ?audit=1 shows the audit overlay (audit.js / audit-overlay.js), ?audit=1&report=1 builds every
// block of the section with the audit on and publishes window.__auditReport (tools/audit.mjs writes AUDIT.md + audit.json from it).
// Streaming pass: the BAKED city (cache.js openBaked, built by tools/bake.mjs through ?bake=1 below) is read before IndexedDB and the
// workers; the LOAD-IN (an overlay with progress, #loadin) holds the start and every Go-to until the view has settled, and fires
// `city:loading` events ({ kind: 'start' | 'goto', phase: 'code' | 'data' | 'view' | 'done', progress 0–1, done, total, label, ms,
// timedOut }) for a designed loading screen to hook into (window.__city.loading holds the last one; null once the view is up).
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { createNav } from './nav.js';
import { PAL, rng } from './style.js';
import { TOD } from './kit.js';
import { Bank } from './vox.js';
import { P, SECTION, PLACES, blocks, frontages, hwX, hwZ, urbanBlocks, ringBlocks, isHero, blockAt, inSection, distOf, kindAt, urban, SPREAD, isAve } from './plan.js';
import { shiftOf, sdata } from '../../world/city.js';   // (sdata: the data this spread reads)
import { camera as framing } from './districts/frame.js';   // (the kits' camera(): main.js's own `camera` is the THREE one)
import { ground, cornerLamps, LAMP_REACH, addHoles } from './ground.js';
import { landmarks } from './skyline.js';
import { MATS } from './cast.js';   // (cast pass: the characters' materials are the fresh construction's, world/cast/chars.js — the same four)
import { createStream, CHUNK } from './stream.js';
import { bundleOf, createPool } from './pool.js';
import { openCache, openBaked, packRaw } from './cache.js';
import { tierize } from './gpu.js';
import { geoOf } from './glue.js';
import { PRESETS, resolvePreset, createDynRes } from './quality.js';
import { createPost } from './render/post.js';   // render pipeline pass · the post stack (?blur=1 is its distance-blur section now) + ?preset=<name> (?look= is the camera's look-at point)
import { mountPanel } from './render/panel.js';
import { parseManifest, loadOptional, installModules, MODS, kitFor, buildsBlock } from './modules.js';
import { streetView as streetViewIn, hwOf, shotList } from './views.js';
import { CLOCK, advance } from './traffic/rules.js';

const Q = new URLSearchParams(location.search), SHOT = Q.has('shot'), BENCH = Q.has('bench'), NIGHT = Q.get('tod') === 'night', BAKE = Q.has('bake') && !SHOT; let STRESS = Q.has('stress'); TOD.night = NIGHT;
const AUDIT = Q.has('audit') && Q.get('audit') !== '0', REPORT = AUDIT && Q.has('report'), BLUR = Q.has('blur') && Q.get('blur') !== '0';
const GRADE = Q.get('sim') === 'live' && !SHOT && !BAKE && !AUDIT && !Q.has('hash') && Q.get('grade') !== '0';   // TAPE · the time-of-day grade (render/grade.js; ?grade=0: off)
const W = +(Q.get('w') || innerWidth), H = +(Q.get('h') || innerHeight), T0 = +(Q.get('t') || 2.35);
const Qsaved = !SHOT && !BENCH && !BAKE && !AUDIT && Q.get('sim') === 'live' ? (() => { try { const v = localStorage.getItem('aicity.ui.quality'); return ['low', 'medium', 'high', 'auto'].includes(v) ? v : null; } catch { return null; } })() : null;   // (section 4: the quality picked in the menu's Settings, kept for a viewer's next visit; never in shots, benches, bakes or audits)
const PR = resolvePreset(Q.get('q') || (SHOT ? 'medium' : Qsaved || 'auto')), R = { ...PRESETS[PR.name] };
if (Q.get('tiers') === 'far') Object.assign(R, { near: 0, mid: 0 });   // cleanup pass · ?tiers=far: every block at its far tier (to judge far tiers, heroes' included)
if (Q.has('cam') && Q.has('draw')) R.draw = +Q.get('draw');   // stitch pass · a review map (?cam=…&draw=<m>&fog=<near>,<far>): the whole island from far above, never a game view
const log = (...a) => console.log(`[${(performance.now() / 1000).toFixed(2)}s]`, ...a), marks = {};
// streaming pass · the load-in's events and its overlay (#loadin, index.html): `city:loading` on window, the last detail in
// __city.loading (null once the view is up). ?loadin=0 turns the overlay and the hold off (the stream still loads the same way).
// (loading screen pass: loading.js draws the overlay from these events; detail.walkers = the walker looks baked so far, { done, total })
const loadEl = document.getElementById('loadin'), LOADIN = !SHOT && !BAKE && !Q.has('hash') && !(AUDIT && Q.has('report')) && Q.get('loadin') !== '0';
let loading = null, loadKind = 'start', loadLabel = '', loadT0 = 0; const looksBaked = { done: 0, total: 0 };
function loadEvent(d) {
  if (!LOADIN) { loadEl?.classList.add('off'); return; }
  const detail = { kind: loadKind, label: loadLabel, ms: Math.round(performance.now() - loadT0), done: 0, total: 0, walkers: { ...looksBaked }, ...d }; loading = d.phase === 'done' ? null : detail;
  dispatchEvent(new CustomEvent('city:loading', { detail }));
  loadEl?.classList.toggle('off', d.phase === 'done');
}
if (!LOADIN) loadEl?.classList.add('off');
// pass 2 · flags the build jobs honour: ?neutral=0 (no neutral mix), ?pass2=0 (pass 1d exactly: no neutral mix, no transit — the regression check)
const FLAGS = { neutral: Q.get('neutral') !== '0' && Q.get('pass2') !== '0', pass2: Q.get('pass2') !== '0', faces: Q.get('faces') !== '0', letters: Q.get('letters') === 'classic' ? 'classic' : 'new' };   // (lettering pass: ?letters=classic → every storefront in the 5×7 face, signage/type)
// pass 2 · page isolation: every optional module (manifest.js) loads on its own; failures are listed in red and their blocks show a placeholder
const MANIFEST = parseManifest(await fetch(new URL('./manifest.js', import.meta.url), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => ''));
const modFail = new Map(), showFail = () => { const el = document.getElementById('modfail'); if (!el) return; el.textContent = [...modFail.values()].map(e => `✖ ${e.path}${e.block ? ' (block ' + e.block + ')' : ''} · ${e.stage}: ${e.error}`).join('\n'); };
const noteFail = list => { for (const e of list || []) { const k = e.path + '|' + (e.block || '') + '|' + e.stage; if (!modFail.has(k)) { modFail.set(k, e); console.warn('module failed:', e.path, e.stage, e.error); } } showFail(); };
let JOBS = null;
if (SHOT) { JOBS = await import('./jobs.js'); noteFail(installModules(await loadOptional(MANIFEST, p => import('./' + p))).errors); }   // shots + reports build here: every module
else noteFail(installModules(await loadOptional(MANIFEST.filter(p => p.startsWith('districts/')), p => import('./' + p))).errors);        // live: the kits (the workers load everything)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const renderer = new THREE.WebGLRenderer({ antialias: SHOT || R.aa, preserveDrawingBuffer: SHOT, powerPreference: 'high-performance' });
renderer.setSize(W, H); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.info.autoReset = false;   // one reset per frame: calls/tris count every pass
document.getElementById('stage').appendChild(renderer.domElement);
const dyn = createDynRes(renderer, R, { dpr: SHOT ? 1 : devicePixelRatio, enabled: !SHOT && !Q.has('nodyn') });
const scene = new THREE.Scene();

// ── sky + the sky-matched haze (Fog in exactly the horizon colour), sun, fill, clouds, contact shadows, night lights and the times of
// day: render/lighting.js (lighting pass, 2026-09-28). Every value is a registered setting (render/settings.js, group 'light'); with no
// preset the defaults are exactly the look before it (day; ?tod=night starts on the 'night' time: today's night values).
const LAMP_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // a lamp's head, by its quarter turn (props face +z)
const LIGHT = (await import('./render/lighting.js')).createLighting({ scene, renderer, night: NIGHT, shot: SHOT, bake: BAKE, grade: GRADE, Q });
const { sun, sunDir } = LIGHT; sun.shadow.mapSize.set(R.shadow, R.shadow);
// street level is exactly the first example (90 → 380). Overhead the band tightens (150 → 340): from 150 m up the camera sees at most
// ~260 m of depth, so a wider band would leave the far city clear and sharp; this one keeps the centre crisp and dissolves the far
// third into the horizon. It always closes before the draw distance (0.92 × draw: blocks stream in and out only behind it).
// (lighting pass: the four distances are the fog section's near/far fields; FADE is that live object)
export const FADE = LIGHT.FADE;
const fadeFor = (h, draw) => { const t = smooth(FADE.h0, FADE.h1, h), far = Math.min(FADE.street[1] + (FADE.overhead[1] - FADE.street[1]) * t, draw * FADE.close);
  return [Math.min(FADE.street[0] + (FADE.overhead[0] - FADE.street[0]) * t, far * .45), far]; };
// ── (the sun — hard shadows, cached: re-rendered only when the view refits, tiers swap, or walkers move — and the sky fill: lighting.js)
// night: the lamp light lent to the lamps nearest the camera (a fixed count never recompiles materials). Cleanup pass: the lamps are the
// corner lamps street.js stamps (ground.js cornerLamps), anywhere on the island — the pass-1 list of eleven section-1 spots lit the
// ground where no lamp stood any more; each light hangs just under its lamp's head. V1 (render review 2026-10-09): no three lights any
// more (12 forward lights cost ~10 ms of GPU at the overview): the same lamps and the Fit Street billboard's spot are the lamp term in
// the light shader (render/night.js), with three's own falloff and BRDF
const LAMPS_N = { low: 3, medium: 6, high: 11 }[PR.name] ?? 6;
if (NIGHT || GRADE) LIGHT.night.spot({ pos: [-66, 11.2, 8.3], target: [-72.3, 13.2, 8.3], color: 0xfff1d0, intensity: 90, distance: 22, angle: .5, penumbra: .5, decay: 1.2 });
let lampAt = '';
const placeLamps = p => { if (!NIGHT) LIGHT.night.heightFade(Math.min(1, Math.max(0, (90 - p.y) / 40)));   // (TAPE's grade on a day page: the lamp light and pools fade out from 50 to 90 m up — the night build's lamp light is out of sight under the camera there, and the term would cost every fragment on screen: off)
  if (!NIGHT && !LIGHT.night.lit) return;   // (a day page: only while TAPE's grade lights the lamps)
  const high = !NIGHT && p.y >= 90, key = Math.round(p.x) + ',' + Math.round(p.z) + (high ? 'h' : ''); if (key === lampAt) return; lampAt = key; if (high) { LIGHT.night.place([]); return; }
  const ci = Math.floor(p.x / P), cj = Math.floor(p.z / P), near = [];
  for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) { if (!urban(kindAt(i, j)) && kindAt(i, j) !== '.') continue; for (const [x, z, rot] of cornerLamps(i, j)) near.push([x + LAMP_DIR[rot][0] * LAMP_REACH, z + LAMP_DIR[rot][1] * LAMP_REACH]); }   // (stitch pass: + the woods blocks' corner lamps, which street.js stamps too: nine of them glowed over dark ground)
  for (const k of MODS.kits.values()) for (const [x, z, rot] of k.lamps || []) if (Math.abs(Math.floor(x / P) - ci) <= 2 && Math.abs(Math.floor(z / P) - cj) <= 2) near.push([x + LAMP_DIR[rot][0] * LAMP_REACH, z + LAMP_DIR[rot][1] * LAMP_REACH]);   // (stitch pass: and the lamps a kit declares, `lamps`)
  near.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z)); LIGHT.night.place(near.slice(0, LAMPS_N).map(q => [q[0], 5.4, q[1]])); };

// ── materials: the full tier keeps pass 1b's four layers; mid/far are one material (per-vertex gloss/metal/lit); characters use chars.js MATS
const mats = {
  full: [tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 })), tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 })),
    tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 })), tierize(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))],
  tier: tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), { vmat: true }),
  charFull: MATS.map(m => tierize(m.clone())), charMid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }),
};
tierize(mats.charMid, { vmat: true });   // (per-block clones add the cluster mask)

// ── views
const aveOf = (b, s) => s[1] === 'z' ? isAve('z', s === '-z' ? b.j : b.j + 1) : isAve('x', s === '-x' ? b.i : b.i + 1);   // (SPREAD: a side street by class, never hw 2)
// SPREAD · the views are today's framings, carried on what each frames (districts/frame.js camera, as the kits' own): the section's middle,
// Fit Street, the store, the roofs west of Main St; the corner, the avenue, the civic and stress views stand on places of their own
const VIEWS = {
  overview: framing({ pos: [18, 152, 92], tgt: [0, 0, -33], fov: 44, sh: [0, -32, 112] }, shiftOf(0, -1)),
  roofs: framing({ pos: [-34, 92, 34], tgt: [-30, 0, -40], fov: 44, sh: [-30, -40, 70] }, shiftOf(-1, -2)),
  fitstreet: framing({ pos: [-59.6, 3.5, -5.3], tgt: [-80, 7.6, 6.6], fov: 57, sh: [-76, 6, 30] }, shiftOf(-3, 0)),
  drop: framing({ pos: [-72.3, 1.55, 1.7], tgt: [-81.5, 1.45, 5.3], fov: 46, sh: [-80, 5, 12] }, shiftOf(-3, 0)),
  civic: framing({ pos: [3.5, 10.5, 1.5], tgt: [30, 8, -34], fov: 58, sh: [22, -28, 40] }, shiftOf(0, -1), 'place'),
  store: framing({ pos: [80.2, 4.2, -62.6], tgt: [80, 4.6, -82], fov: 58, sh: [80, -76, 24] }, shiftOf(2, -3)),
  corner: framing({ pos: [34.6, 2.6, -35.2], tgt: [28.5, 1.9, -28.6], fov: 50, sh: [30, -30, 16] }, shiftOf(0, -1), 'place'),
  avenue: framing({ pos: [-40, 2.9, -1.2], tgt: [0, 4.2, -1.2], fov: 54, sh: [-20, -2, 40] }, shiftOf(-1, -1), 'place'),
  stress: framing({ pos: [30, 420, 250], tgt: [0, 0, -70], fov: 46, fog: [260, 900], sh: [0, -60, 200], stress: true }, shiftOf(0, -1), 'place'),
};
// street camera rule (pass 1c) now lives in views.js (shared with tools/shots.mjs); the pass-1 views keep section 1 as their area
const inner = (b, s) => s === '-z' ? b.j > SECTION.j0 : s === '+z' ? b.j < SECTION.j1 : s === '-x' ? b.i > SECTION.i0 : b.i < SECTION.i1;
const streetView = (b, sd, label) => streetViewIn(b, sd, label, SECTION);
const BL = blocks(0), GEN = BL.filter(b => b.core && !'WCSPB'.includes(b.k) && b.place?.kind !== 'store');
// random-N: generated blocks shuffled by the fixed seed (as pass 1b), each on its widest inner street
const RSEED = 1995, pickR = rng(RSEED), GORDER = GEN.map(b => [pickR(), b]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
GORDER.slice(0, 3).forEach((b, n) => { const F = frontages(b), all = ['-z', '+z', '-x', '+x'].filter(s => F[s] && inner(b, s)), top = Math.max(...all.map(s => hwOf(b, s))), sides = all.filter(s => hwOf(b, s) === top), sd = sides[Math.floor(pickR() * sides.length)];
  VIEWS['random-' + (n + 1)] = streetView(b, sd, 'random'); });
// side-N: the first two narrow inner streets (hw 2) in the same seeded order, one per block, avoiding streets the random views used
{ const used = new Set(); let n = 0; for (const b of GORDER) { if (n >= 2) break; const F = frontages(b); for (const sd of ['-z', '+z', '-x', '+x']) { if (!F[sd] || !inner(b, sd) || aveOf(b, sd) || used.has(F[sd])) continue; used.add(F[sd]); VIEWS['side-' + (++n)] = streetView(b, sd, 'side'); break; } } }
VIEWS.night = { ...VIEWS.fitstreet };
// pass 2 · every loaded kit's fixed shot list: ?view=<district>:overhead | street-1 | street-2 | landmark | night (tools/shots.mjs)
// batch 4 (forest) · the woods: a kit may list NON-urban blocks in `built` (Blackpine Woods lists the island's 289 land blocks); they join
// the block universe, the kits' shot and audit lists and the hash far list, like the urban blocks
export const worldBlocks = () => { const out = urbanBlocks(), seen = new Set(out.map(([i, j]) => i + ',' + j));
  for (const k of MODS.kits.values()) if (Array.isArray(k.built)) for (const [i, j] of k.built) { const key = i + ',' + j; if (!seen.has(key)) { seen.add(key); out.push([i, j]); } }
  return out; };
export const kitBlocks = kit => worldBlocks().filter(([i, j]) => kitFor(i, j) === kit && buildsBlock(i, j));
for (const kit of MODS.kits.values()) for (const v of shotList(kit, kitBlocks(kit))) VIEWS[`${kit.district}:${v.key}`] = { ...v, night: v.night };
// pass 1d · any spot, for close-ups and the location agents: ?cam=x,y,z&look=x,y,z&fov=50 (street eye height if y is omitted)
if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number), l = (Q.get('look') || '').split(',').map(Number), p = c.length === 2 ? [c[0], 2.9, c[1]] : c, t = l.length === 3 ? l : l.length === 2 ? [l[0], 2, l[1]] : [p[0], 0, p[2] - 20];
  VIEWS.cam = { pos: p, tgt: t, fov: +(Q.get('fov') || 50), sh: Q.has('sh') ? Q.get('sh').split(',').map(Number) : [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, Math.max(16, Math.hypot(p[0] - t[0], p[2] - t[2]) * .8)] };
  if (Q.has('fog')) { VIEWS.cam.fog = Q.get('fog').split(',').map(Number); if (Q.has('draw')) [scene.fog.near, scene.fog.far] = VIEWS.cam.fog; } }   // (stitch pass: the review map's haze band, like the stress view's; set now, since a shot's stream culls against the fog before the first frame)
const view = Q.has('cam') ? 'cam' : VIEWS[Q.get('view')] ? Q.get('view') : 'overview'; if (VIEWS[view].stress) STRESS = true;
const camera = new THREE.PerspectiveCamera(50, W / H, .1, 4000);
const controls = new MapControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 2; controls.maxDistance = 700;   // drag moves, right- or shift-drag turns, scroll zooms (keys: nav.js)
if (Q.has('cam') && Q.has('draw')) controls.maxDistance = 4000;   // (stitch pass: the review map stands further off than a player may)
let viewFog = VIEWS[view].fog || null, shFixed = null;
function setView(k) { const v = VIEWS[k]; camera.position.set(...v.pos); camera.fov = v.fov; camera.updateProjectionMatrix(); controls.target.set(...v.tgt); controls.update(); viewFog = v.fog || null; shFixed = v.sh; fitShadow(v.sh); }
let shC = [1e9, 0, 0];
function fitShadow([cx, cz, r]) { const s = 4; cx = Math.round(cx / s) * s; cz = Math.round(cz / s) * s; if (Math.abs(cx - shC[0]) < .01 && Math.abs(cz - shC[1]) < .01 && Math.abs(r - shC[2]) < .01) return; shC = [cx, cz, r];
  const c = new THREE.Vector3(cx, 2, cz); sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sunDir, 260);
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 520 }); sun.shadow.camera.updateProjectionMatrix(); renderer.shadowMap.needsUpdate = true; }
let groundTick = 0;
function followCamera() {   // haze (one rule at every height, pass 1d) + shadow frustum (follows a free camera; views set it exactly)
  if (++groundTick % 15 === 0) groundFocus(1);
  const [near, far] = viewFog ? [Math.min(viewFog[0], viewFog[1] * .45), viewFog[1]] : fadeFor(camera.position.y, R.draw);
  scene.fog.far = Math.min(far, R.draw * FADE.close); scene.fog.near = Math.min(near, scene.fog.far * .45);   // the haze always closes before the draw distance
  if (!shFixed) { const d = camera.position.distanceTo(controls.target), r = Math.max(18, Math.min(150, d * .8)); const rr = Math.pow(2, Math.round(Math.log2(r) * 4) / 4); fitShadow([controls.target.x, controls.target.z, rr]); }
  placeLamps(camera.position);
}
setView(view);

// ── the block universe: section (built at all tiers) + the ring around it (far tier only) · stress: every urban block of the plan
// pass 2: the whole island. A block gets a full build when its district's kit builds it (downtown: section 1; a stub or a real kit:
// its blocks); every other block shows its far tier (the placeholder massing) until a section agent writes that kit. ?stress=1
// builds every urban block (with the standard grammar where there is no kit), as before.
const universeOf = stress => worldBlocks().map(([i, j]) => [i, j, buildsBlock(i, j, stress)]);
const heroOf = (i, j) => !!kitFor(i, j).heroAt(i, j);
// streaming pass · the woods' far tiers merge per CHUNK × CHUNK blocks (stream.js, jobs.js jobFarChunk): a non-urban block whose kit draws
// its far tier (a hero only when its far is the kit's) · groupOf splits the memory report into the woods and the city
const chunkOf = (i, j) => { if (urban(kindAt(i, j))) return null; const k = kitFor(i, j); if (!k.far || k.status === 'broken') return null; const s = k.heroAt(i, j); if (s && s.far !== 'kit') return null; return Math.floor(i / CHUNK) + '_' + Math.floor(j / CHUNK); };
const groupOf = (i, j) => kitFor(i, j).district === 'forest' ? 'woods' : 'city';
let stream, pool = null, cache = { get: async () => undefined, put: async () => {}, stats: {}, on: false }, hash = 'shot', baked = { on: false, stats: {} };
const onBuilt = (r, res) => { if (res.stats && Q.has('log')) log('block', r.key, res.ms.join('+') + 'ms', res.tris + ' tris → mid ' + res.trisMid, JSON.stringify(res.stats)); };
// ── ?audit=1: red boxes + labels for every issue a block job reports (audit.js runs inside the job, in the worker)
let overlay = null; if (AUDIT && !REPORT) overlay = (await import('./audit-overlay.js')).createAuditOverlay(scene, camera, renderer);
// pass 2 · what the blocks hand back beyond geometry: sim-state anchors (lots, stacked units, transit) and walker lanes
const ANCHORS = new Map(), LANES = new Map(); let simLayer = null, peds = null;
function onAnchors(r, a) { ANCHORS.set(r.key, a); simLayer?.addAnchors(r.key, a); if (a?.holes) addHoles(r.key, a.holes); }   // (subway stations: the stairwells' openings cut out of the ground)
function onLanes(r, l) { LANES.set(r.key, l); peds?.addLanes(r.key, l); }
function onAudit(r, a) { overlay?.add(r.key, a); (window.__audit ??= {})[r.key] = a; }
if (SHOT) {
  const J = JOBS;
  stream = createStream({ scene, camera, cache, night: NIGHT, mats, preset: R, sync: true, isHero: heroOf, exec: job => job.type === 'far' ? J.jobFar(job) : job.type === 'farChunk' ? J.jobFarChunk(job) : J.jobBlock(job), onBuilt, chunkOf, groupOf, farShadows: false, audit: AUDIT, onAudit, flags: FLAGS, onErrors: (r, e) => noteFail(e), onAnchors, onLanes });
} else {
  const entry = new URL('./jobs.js', import.meta.url).href, nW = Q.get('workers') ? +Q.get('workers') : Math.min(8, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
  const B = await bundleOf(entry, MANIFEST.map(p => ({ path: p, url: new URL('./' + p, import.meta.url).href }))); hash = B.hash + (FLAGS.pass2 ? '' : '-p1') + (FLAGS.neutral ? '' : '-nn') + (FLAGS.letters === 'classic' ? '-lc' : '') + (SPREAD ? '-s' + SPREAD : ''); marks.bundle = performance.now();   // (SPREAD: a spread city never reads today's cache or bake)
  for (const u of B.missing) noteFail([{ path: u.replace(/^.*\/city\//, ''), stage: 'load', error: 'file not found' }]);
  loadEvent({ phase: 'code', progress: .04, label: 'starting the workers' });
  // (streaming pass: + the baked city for this code's hash: ?nobake=1 skips it, the audit and the bake itself always build)
  // (streaming pass: the stream starts once the cache and the bake are open; build jobs wait in the pool's backlog until its workers are
  // up, so a baked city shows without waiting for them)
  pool = createPool(nW, B.bundle, entry, B.optional);
  const poolUp = pool.ready.then(() => { noteFail(pool.mods?.errors); marks.workers = performance.now(); log(`pool: ${nW} workers ready · ${B.files} modules · ${B.optional.length} optional (${pool.mods?.errors?.length || 0} failed) · hash ${hash}`); },
    e => noteFail([{ path: 'jobs.js', stage: 'load', error: String(e && e.message || e) }]));
  [cache, baked] = await Promise.all([openCache(hash, !Q.has('nocache') && !AUDIT),
    BAKE || AUDIT || Q.has('nobake') ? baked : openBaked(new URL('./baked/', import.meta.url), hash, NIGHT ? 'n' : 'd', { workers: Q.get('bakedw') ? +Q.get('bakedw') : 3 })]);   // the audit always rebuilds
  if (BAKE || !baked.on) await poolUp;   // (without a bake everything is built: nothing to gain)
  marks.stream = performance.now(); log(`stream starts · cache ${cache.on ? 'on' : 'off'} · baked ${baked.on ? 'on' : 'off'}`);
  stream = createStream({ scene, camera, cache, baked, night: NIGHT, mats, preset: R, pool, isHero: heroOf, onBuilt, farShadows: false, audit: AUDIT, onAudit, flags: FLAGS, onErrors: (r, e) => noteFail(e), onAnchors, onLanes, trace: Q.has('trace'), chunkOf, groupOf });
}
// pass 2 · generic pedestrians on every sidewalk (peds.js): looks baked once in a worker; density from the sim's street demand
// cleanup pass: the kit's peds.density scales its district's walkers; ?agents=N walks N demo agents (sim agents come first on the sidewalks)
const densityOf = d => MODS.kits.get(d)?.peds?.density ?? 1;
// cast pass (2026-10-02): the generic walkers' look pool, rolled from the city's cast (cast.js): PED_LOOKS looks (was 24; the fresh cast
// has 405 traits, so a bigger pool shows more of it), baked as PED_JOBS parallel worker jobs (≈ 30 ms a look each). The seeds are the
// one sequence of the single-job bake (seed + k · 7919), so a shot (baked inline) and the live page draw the same pool.
// ?cast=<n> rolls a different pool of walker outfits (?cast=random: a new one every load); without it the pool stays fixed so shots repeat
// NPC integration (2026-10-07): the walkers are background civilians, so the pool rolls from the NPC pool (cast.js rollLook pool 'npc';
// PED_POOL). Agents (roofs, lines, set pieces, the sim) keep the agent cast, so a viewer tells a civilian from an agent at a glance.
const PED_POOL = 'npc';
const PED_LOOKS = 48, PED_JOBS = 4, PED_SEED = !Q.has('cast') ? 0x5eed : Q.get('cast') === 'random' ? (Math.random() * 0xffffff) | 0 : (+Q.get('cast') || 0) & 0xffffff;
if (!Q.has('hash') && !REPORT && !BAKE && Q.get('peds') !== '0') { const { createPeds, PED } = await import('./peds.js'); if (Q.has('dogs')) PED.dogs = +Q.get('dogs');   // (?dogs=<share>: more walkers out with a dog, for looking at them)
  peds = createPeds({ scene, night: NIGHT, R, densityOf, avoid: Q.get('avoid') !== '0', bake: () => SHOT ? Promise.resolve(JOBS.jobPeds({ n: PED_LOOKS, seed: PED_SEED, pool: PED_POOL }))
    : (looksBaked.total = PED_LOOKS, Promise.all(Array.from({ length: PED_JOBS }, (_, j) => pool.exec({ type: 'peds', n: PED_LOOKS / PED_JOBS, seed: (PED_SEED + j * (PED_LOOKS / PED_JOBS) * 7919) & 0xffffff, dogs: j === 0, pool: PED_POOL }).then(r => { looksBaked.done += r.looks.length; return r; }))))
      .then(rs => ({ looks: rs.flatMap(r => r.looks), dogs: rs[0].dogs })) });
  for (const [k, l] of LANES) peds.addLanes(k, l); if (Q.get('rush')) peds.setDemand(null, { dist: Q.get('rush'), mult: 2 }); if (Q.get('agents')) peds.demoAgents = +Q.get('agents'); }
// traffic pass · the cars (traffic/sim.js + render.js) on the shared signal clock (traffic/rules.js CLOCK; ?tclock=<s> seeds it for shots); ?cars=0 turns them off
if (Q.has('tclock')) CLOCK.t = +Q.get('tclock');
let traffic = null; if (!Q.has('hash') && !REPORT && !BAKE && Q.get('cars') !== '0') try { traffic = await (await import('./traffic/render.js')).createTraffic({ scene, night: NIGHT, R, peds, mats }); } catch (e) { noteFail([{ path: 'traffic/render.js', stage: 'load', error: String(e && e.stack || e) }]); }
stream.setUniverse(universeOf(STRESS), STRESS ? 'stress' : 'section');
// pass 2 · the sim-state layer (?sim=demo | live): lots and stacked units from state, supply piles, corner hotspots, patrols, crowd
// C1-7d · the SECOND CHANCE, live on every path (second-chance.js; no longer baked into the bay): out in the bay heading out, as the bake had
// her; the record path moors her at the docks for night 14 and sails her out in its ferry's leave beat
let FERRY_LIVE = null; if (!REPORT && !BAKE && !Q.has('hash')) try { FERRY_LIVE = (await import('./second-chance.js')).createFerry({ scene, mats }); } catch (e) { noteFail([{ path: 'second-chance.js', stage: 'load', error: String(e && e.stack || e) }]); }
const SIM = Q.get('sim'); let simInfo = null, recordPage = null;
if (SIM && SIM !== '0' && !REPORT && !BAKE && !Q.has('hash')) { try {
  if (SIM === 'record') {
    // (C1-3: the record's walkers, trips and fights)
    recordPage = await (await import('./simstate/record/page.js')).startRecord({ Q, NIGHT, SHOT, camera, controls, scene, mats, peds, ANCHORS, log, ferry: FERRY_LIVE,
      cornerKits: new Set(PLACES.filter(p => p.kind === 'corner').map(p => p.id)), isShown: k => { const r = stream.blocks.get(k); return !!r && (r.shown === 'full' || r.shown === 'mid'); } });
    if (traffic) recordPage.layer?.setTraffic?.(traffic.sim);
    simLayer = recordPage.layer; simInfo = recordPage.info;
  } else {
  const [{ createSimLayer, loadPieces }, AD] = await Promise.all([import('./simstate/layer.js'), import('./simstate/adapter.js')]);
  const pieces = await loadPieces(); if (pieces.error) noteFail([{ path: 'simassets/index.js', stage: 'load', error: pieces.error + ' — drawing the placeholders' }]);
  const places = await fetch(new URL(sdata('../../sim2/places.json'), import.meta.url)).then(r => r.json());
  if (SIM === 'live') { const L = await (await import('./simstate/live.js')).startLive({ Q, SHOT, BENCH, NIGHT, scene, mats, lib: pieces.lib, places, peds, camera, controls, ANCHORS, log, noteFail,   // SIM LIVE pass: the running sim, &simport= (SIMLIVE.md)
    cornerKits: new Set(PLACES.filter(p => p.kind === 'corner').map(p => p.id)), isShown: k => { const r = stream.blocks.get(k); return !!r && (r.shown === 'full' || r.shown === 'mid'); } }); simLayer = L.layer; simInfo = L.info;
    if (traffic) simLayer?.setTraffic?.(traffic.sim); } else {   // (traffic fix round: live patrols drive as traffic too — the old patrol fleet ran lights, one-ways and parking lanes)
  simLayer = createSimLayer({ scene, mats, lib: pieces.lib, night: NIGHT, cornerKits: new Set(PLACES.filter(p => p.kind === 'corner').map(p => p.id)), isShown: k => { const r = stream.blocks.get(k); return !!r && (r.shown === 'full' || r.shown === 'mid'); } });
  for (const [k, a] of ANCHORS) simLayer.addAnchors(k, a); if (traffic) simLayer.setTraffic?.(traffic.sim);   // (traffic pass: patrols drive in the traffic)
  const pull = async () => { try { const m = AD.adapt(await AD.load(SIM === 'live' ? 'live' : SIM === '1' ? 'demo' : SIM), places, { rush: Q.get('rush') || undefined, night: NIGHT });   // the page's time of day drives demand
    simLayer.setModel(m); peds?.setDemand(m.crowd, null); simInfo = { source: SIM, pieces: pieces.source, clock: m.clock, homes: m.homes.size }; } catch (e) { noteFail([{ path: 'simstate/' + SIM, stage: 'state', error: String(e) }]); } };   // (the model's crowd already carries any rush)
  await pull(); if (SIM === 'live' && !SHOT) setInterval(pull, 5000); }   // the live sim: poll /state every 5 s (a failed poll keeps the last state)
  log(`sim state: ${SIM} · pieces from ${pieces.source}${pieces.missing ? ' (simassets/ not there yet)' : ''}`);
  }
} catch (e) { noteFail([{ path: 'simstate/layer.js', stage: 'load', error: String(e && e.stack || e) }]); } }
const GROUND = ground(scene, renderer.capabilities.getMaxAnisotropy());
// LOOK round (2026-10-06) · the stylised water over the ground's flat SEA (water.js: shore ramp, foam, glitter, night streaks); ?water=0 is the flat sea
const WATER = Q.get('water') === '0' ? null : (await import('./water.js')).createWater({ scene, ground: GROUND, night: NIGHT });
// the fine ground tiles follow the camera: around the point halfway to the target, wider when the camera is high
const groundFocus = (budget = 1) => { const p = camera.position, t = controls.target; return GROUND.update((p.x + t.x) / 2, (p.z + t.z) / 2, 110 + Math.min(60, p.y * .3), budget); };
groundFocus(16);
const skyBank = new Bank(); if (!STRESS) landmarks(skyBank, (i, j) => buildsBlock(i, j)); const skyMeshes = [];
const M4 = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
skyBank.L.forEach((O, i) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), M4[i]); m.castShadow = false; m.receiveShadow = false; scene.add(m); skyMeshes.push(m); });
const setStress = on => { STRESS = on; stream.setUniverse(universeOf(on), on ? 'stress' : 'section'); skyMeshes.forEach(m => m.visible = !on); };

// ── (cleanup pass: pass 1b's eight hand-placed demo walkers are gone — they paced straight lines through furniture and through the
// walkers; every sidewalk is walked by peds.js now, one system with lanes, following and corners)
let walk = null; const makeWalkers = () => {};

// ── frame
const clock0 = performance.now(); let frames = 0, shadowFrame = 0, lastT = null;
// render pipeline pass · the post stack: with nothing on, post.render IS `dyn.begin(); renderer.render(scene, camera); dyn.end()` (today's frame)
// (film emulation pass: a viewer with no ?preset gets the default look, render/looks.js DEFAULT_LOOK; shots, bakes, hashes, audits, benches
// and the nodyn tool runs stay on `current`, today's plain render, unless they pass ?preset, so the pixel regression checks stay stable)
// (an unknown ?preset — a look saved in another browser, a typo — falls back to the page's own default, with a console note)
// (V2/V5, render review 10-09: an RGBA8 scene target, its depth only when read, and the stack's foldable sections as one pass; ?fold=0: the old plumbing)
const post = createPost(renderer, scene, camera, { night: NIGHT, blur: BLUR, aa: SHOT || R.aa, fold: Q.get('fold') !== '0' }), LOOKD = SHOT || BAKE || BENCH || AUDIT || Q.has('hash') || Q.has('nodyn') ? null : post.defaultLook, LOOK0 = Q.get('preset') || LOOKD;
if (LOOK0 && !(await post.look(LOOK0)) && LOOK0 !== LOOKD) { console.info(`?preset=${LOOK0} not found · showing ${LOOKD || 'current'}`); if (LOOKD) await post.look(LOOKD); }
if (!LOOK0) await post.ready();
// TAPE · THE TIME-OF-DAY GRADE (render/grade.js): the build graded toward the tape's time of day, k from ui/light.js (api.grade)
const GRADER = GRADE ? (await import('./render/grade.js')).createTodGrade({ LIGHT, post, water: WATER, NIGHT }) : null;
// V7 (render review 2026-10-09) · after a WebGL context restore (Chrome resets its GPU process: a driver hiccup, memory pressure) three
// re-creates its GL state and re-uploads every buffer and texture, but what was RENDERED into a target comes back empty: the PMREM sky
// environment (the frame came back darker and greyer, no sky light in the materials) and the cached sun shadow map (nothing re-rendered
// it until something moved). And the lost context's timer queries never resolve: dynamic resolution froze. three's own handler runs
// first (added with the renderer), so its state is back when this one renders.
renderer.domElement.addEventListener('webglcontextrestored', () => { dyn.restore(); post.restore(); LIGHT.regenEnv(); renderer.shadowMap.needsUpdate = true; });
// V6 (render review 2026-10-09) · SHADER WARM-UP behind the load-in. Nine programs used to compile after the page was live, each a 15–80 ms
// hitch the first time its variant showed: the characters' idle mid tier and full bodies with their shadow-depth variants (stream.js
// warmObjects), and the stage's top-down depth pass (stage/index.js occ: MeshDepthMaterial with BasicDepthPacking into a float target)
// over plain, batched, instanced and instance-coloured meshes. All of them compile here with the scene's own lights, fog and environment:
// the main-pass materials in parallel (renderer.compileAsync), the shadow-depth ones in three real frames with the sun's shadow
// re-rendered, the depth pass in one render made like occ's (KEEP IN STEP with it). The warm meshes are degenerate quads under the world:
// nothing is drawn. Their materials are kept, not disposed (disposing would release the programs). The start's load-in waits for it.
let warmed = SHOT || BAKE || REPORT || Q.has('hash');
async function warmUp() {
  const g = stream.warmObjects(); g.position.set(0, -1000, 0); g.updateMatrixWorld(true);
  try { await renderer.compileAsync(g, camera, scene); } catch (e) { console.warn('warm-up: compileAsync', e); }
  if (GRADE && LIGHT.night.pools) try { await renderer.compileAsync(LIGHT.night.pools, camera, scene); } catch (e) { console.warn('warm-up: the grade\'s pools', e); }   // (TAPE's grade: the pools draw first mid-tape)
  scene.add(g); for (let k = 0; k < 3; k++) { renderer.shadowMap.needsUpdate = true; await new Promise(r => requestAnimationFrame(r)); }
  g.removeFromParent(); g.traverse(o => o.geometry?.dispose()); renderer.shadowMap.needsUpdate = true;
  // the stage's depth pass: its material over a plain, a batched, an instanced and an instance-coloured mesh, in the real scene (its
  // lights, fog), the objects occ hides hidden, into a small float target from a camera under the world
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const m0 = new THREE.MeshBasicMaterial(), bm = new THREE.BatchedMesh(1, 3, 0, m0), im = new THREE.InstancedMesh(geo, m0, 1), ic = new THREE.InstancedMesh(geo, m0, 1); bm.addInstance(bm.addGeometry(geo)); ic.setColorAt(0, new THREE.Color());
  const occ = new THREE.Group(); for (const o of [new THREE.Mesh(geo, m0), bm, im, ic]) { o.frustumCulled = false; occ.add(o); }
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking }), rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.FloatType, depthBuffer: true }), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 18);
  cam.position.set(0, -5000, 0); cam.up.set(0, 0, -1); cam.lookAt(0, -6000, 0); cam.updateMatrixWorld(); scene.add(occ);
  const hide = []; scene.traverseVisible(o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && (o.isPoints || o.isLine || o.isSprite || m.transparent || m.depthWrite === false || m.colorWrite === false)) hide.push(o); });
  const prevT = renderer.getRenderTarget(), ov = scene.overrideMaterial, bg = scene.background, br = scene.onBeforeRender, nu = renderer.shadowMap.needsUpdate;
  try { for (const o of hide) o.visible = false; scene.overrideMaterial = mat; scene.background = null; scene.onBeforeRender = () => {}; renderer.shadowMap.needsUpdate = false; renderer.setRenderTarget(rt); renderer.render(scene, cam); }
  finally { renderer.setRenderTarget(prevT); scene.overrideMaterial = ov; scene.background = bg; scene.onBeforeRender = br; renderer.shadowMap.needsUpdate = nu; for (const o of hide) o.visible = true; occ.removeFromParent(); rt.dispose(); geo.dispose(); }
}
function frame(t, now) {
  followCamera();
  const pr = stream.update(); let walkersShown = 0;
  if (walk) walkersShown = walk.update(t, camera.position, R.charMid);
  const dt = lastT === null ? 0 : Math.max(0, Math.min(.1, t - lastT)); lastT = t;
  recordPage?.frame(t);
  if (!traffic) advance(dt); const driving = traffic ? traffic.update(t, dt, camera, R, controls.target) : 0;   // (traffic pass: the one clock the lights, cars and walkers read, then the cars — with the traffic, its tick moves the clock: the buses' pace)
  const cars = simLayer ? simLayer.update(dt, controls.target) : false, walking = peds ? peds.update(t, dt, camera, R, controls.target) : 0;   // (cleanup pass: walkers live round what the camera looks at — an overhead's camera stands far off it)
  api.late?.(dt);   // (camera build: the rig's LATE step — follow poses from this frame's walkers, not last frame's (RESEARCH D13))
  const moving = (walkersShown > 0 || cars || walking > 0 || driving > 0) && camera.position.distanceTo(controls.target) < 160;
  if (stream.takeShadowDirty() || (moving && ++shadowFrame % R.shadowEvery === 0)) renderer.shadowMap.needsUpdate = true;
  renderer.info.reset(); overlay?.update(36, controls.target);
  WATER?.update(t, camera);
  api.ui?.frame(dt, t);   // (human layer: pins, rings, hover — ui/index.js; only on a ?sim=live page)
  // (blue flash fix, 10-09: dynamic resolution steps BEFORE the draw. A step resizes the canvas, which empties its buffer; stepped after
  // the draw, that empty buffer was the frame shown, and the page's blue background showed through for one frame at every step)
  if (now) dyn.frame(now, stream.queueSize() > 0 || stream.stat.pending > 0);
  post.render(t, dyn); frames++;
  return pr;
}
const api = { THREE, scene, camera, controls, renderer, stream, R, PR, dyn, VIEWS, setView, setStress, marks, log, frame, get baked() { return baked; }, get loading() { return loading; }, goTo: (x, z, label) => nav.goTo(x, z), get walk() { return walk; }, get sim() { return simLayer; }, get simInfo() { return simInfo; }, get peds() { return peds; }, get traffic() { return traffic; }, CLOCK, ANCHORS, LANES, cache: () => cache, hash: () => hash, info: renderer.info, clearFixedShadow() { shFixed = null; if (!STRESS) viewFog = null; }, post, grade: GRADER, get overlay() { return overlay; } };
// CAB FOLLOW-UP (2026-10-10) · is any car standing in the road in this footprint (the blocks' anchors.parked: jobs.js)? → traffic/cabs.js, a
// cab pulling in to the kerb to drop its rider (simstate/movement.js hands it to the traffic sim)
api.parkedIn = (x0, z0, x1, z1) => { for (const a of ANCHORS.values()) for (const p of a?.parked || []) if (p[0] < x1 && p[2] > x0 && p[1] < z1 && p[3] > z0) return true; return false; };
window.__city = api;
{ let tt = T0; api.tick = (dt = 1 / 30, n = 1) => { for (let k = 0; k < n; k++) { tt = Math.max(tt, lastT ?? T0) + dt; frame(tt); } return tt; }; }   // SIM LIVE pass · n frames of dt s, where requestAnimationFrame doesn't run (hidden headless tabs: tests, shots)
const nav = createNav({ camera, controls, onMove: () => api.clearFixedShadow() }); api.nav = nav;
// CAMERA PASS (2026-10-05) · the camera rig (camera/rig.js): orbit (MapControls + nav, as before), fly, follow and photo, eased hand-offs,
// 1–4 / ? keys. Live page only: shots, bakes, hashes and reports never create it. Created before the homes' click handlers so a click on
// a person follows them instead of opening the home behind.
const cam = !SHOT && !BAKE && !Q.has('hash') && !REPORT && Q.get('rig') !== '0' ? (await import('./camera/rig.js')).createCameraRig(api, { Q }) : null; api.cam = cam;
// HOMES pass (2026-09-28) · click or tap a home → its cutaway interior (interiors/city/). The module loads on the first click or with
// ?home=<lot id>, never before: nothing here runs while no home is opened (a click is a press and release within 6 px and 450 ms)
if (SIM !== 'record' && !BAKE && !Q.has('hash') && !REPORT) { let homes = null; const H = api.homesLoad = () => homes ??= import('./interiors/city/index.js').then(m => (api.homes = m.createHomes(api, { Q, NIGHT, SHOT })));
  if (Q.get('home')) H().catch(e => noteFail([{ path: 'interiors/city/index.js', stage: 'load', error: String(e && e.stack || e) }]));
  let d0 = null; const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { d0 = e.button === 0 && e.isPrimary ? [e.clientX, e.clientY, performance.now()] : null; });
  el.addEventListener('pointerup', e => { const d = d0; d0 = null; if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 6 && performance.now() - d[2] < 450 && !api.ui?.claimed(e)) H().then(h => h.click(e)).catch(err => noteFail([{ path: 'interiors/city/index.js', stage: 'open', error: String(err && err.stack || err) }])); }); }
// HUMAN LAYER (section 1) · the UI kit, click an agent → its dossier, citizen pins (ui/index.js). A ?sim=live page only; ?ui=0 leaves it off
if (SIM === 'live' && !SHOT && !BAKE && !Q.has('hash') && !REPORT && Q.get('ui') !== '0') import('./ui/index.js').then(m => m.mountUI(api, { Q })).catch(e => noteFail([{ path: 'ui/index.js', stage: 'load', error: String(e && e.stack || e) }]));
// C1-11 · the record path's panels (ui/record/): the dossier on a click, People, the paper map, the ticker and CH 9, from the presented record
if (SIM === 'record' && recordPage && !SHOT && !BAKE && !Q.has('hash') && !REPORT && Q.get('ui') !== '0') import('./ui/record/index.js').then(m => m.mountRecordUI(api, { Q, page: recordPage })).catch(e => noteFail([{ path: 'ui/record/index.js', stage: 'load', error: String(e && e.stack || e) }]));
// go to: every sim place (sim2/places.json), marked when no kit builds its block (cleanup pass: any district's built blocks, not section 1 only)
{ const sel = document.getElementById('goto');
  if (sel && !SHOT) fetch(sdata('../../sim2/places.json')).then(r => r.json()).then(({ places }) => {
    for (const p of places) { const o = document.createElement('option'); o.value = p.x + ',' + p.z; o.textContent = p.name + (buildsBlock(Math.floor(p.x / P), Math.floor(p.z / P)) ? '' : ' · not built yet'); sel.append(o); }
    sel.onchange = () => { if (!sel.value) return; const [x, z] = sel.value.split(',').map(Number), label = sel.selectedOptions[0]?.textContent.replace(/ · not built yet$/, '') || ''; api.goTo(x, z, label); sel.value = ''; sel.blur(); };   // (streaming pass: through the load-in)
  }).catch(e => log('go-to list unavailable', e)); }

if (Q.has('hash')) {   // pass 2 · ?hash=1&shot=1: every block of the section built on this thread, one hash per tier (tools/audit.mjs hash)
  const J = JOBS, { hashJob } = await import('./regress.js'), out = {}, t = performance.now();
  // cleanup pass · &district=<name> hashes every block that kit builds (full build) plus the far tier of every block of its district;
  // &district=all does it for every loaded kit (the look regression check across the island: tools/audit.mjs hash <label> --q=district=all)
  const D = Q.get('district'), kits = D === 'all' ? [...MODS.kits.values()] : D ? [MODS.kits.get(D)].filter(Boolean) : null;
  const built = kits ? kits.flatMap(k => kitBlocks(k)) : BL.filter(b => b.core).map(b => [b.i, b.j]);
  const farList = kits ? worldBlocks().filter(([i, j]) => kits.includes(kitFor(i, j))) : ringBlocks(4);
  for (const [i, j] of built) { const res = J.jobBlock({ i, j, night: NIGHT, audit: false, chars: true, flags: FLAGS }); out[i + '_' + j] = hashJob(res); noteFail(res.errors); }
  for (const [i, j] of farList) { const r = J.jobFar({ i, j, night: NIGHT, flags: FLAGS }); out['far:' + i + '_' + j] = hashJob(r).far; }
  window.__hashReport = { when: new Date().toISOString(), night: NIGHT, ms: Math.round(performance.now() - t), blocks: out }; document.title = 'audit-ready';
} else if (REPORT) { let walkSummary = null;   // ?audit=1&report=1: every block of the section (or &blocks=i,j;i,j · &district=<name>), built on this thread with the audit on
  const J = JOBS, out = [], t = performance.now();
  const list = Q.get('blocks') ? Q.get('blocks').split(';').filter(Boolean).map(s => s.split(',').map(Number)) : Q.get('district') ? kitBlocks(MODS.kits.get(Q.get('district')) || { district: '?' }) : BL.filter(b => b.core).map(b => [b.i, b.j]);
  const walked = [];
  for (const [i, j] of list) { const b = blockAt(i, j), res = J.jobBlock({ i, j, night: NIGHT, audit: true, chars: false, flags: FLAGS }); noteFail(res.errors);
    out.push({ ...res.audit, k: b.k, hero: heroOf(i, j), place: kitFor(i, j).heroAt(i, j)?.id || b.place?.name || null, kit: res.kit, placeholder: res.placeholder, errors: res.errors || [], lanes: res.lanes ? { pinches: res.lanes.pinches || [] } : null });
    walked.push({ i, j, lanes: res.lanes }); log('audit', i + ',' + j, res.audit.issues.length, 'issues', res.audit.ms + 'ms'); }
  // cleanup pass · the walk check: 60 s of walkers over these blocks (pedsim.js), every overlap an issue on the block it happened in
  if (FLAGS.pass2 && Q.get('walk') !== '0' && (Q.get('district') || Q.has('walk'))) { const { walkCheck } = await import('./walkcheck.js'), tw = performance.now();
    const W = walkCheck({ blocks: walked, night: NIGHT, seconds: +(Q.get('walk') || 60) || 60, densityOf });
    for (const e of W.events) { const o = out.find(b => b.key === e.block); if (o) o.issues.push({ type: e.type, id: `${e.block}·walk·${o.issues.length}`, other: e.other, kind: 'walker', group: 'walk', box: [e.x - .3, .2, e.z - .3, e.x + .3, 2.1, e.z + .3], note: e.note }); }
    walkSummary = { foci: W.foci, walkers: W.walkers, agents: W.agents, dogs: W.dogs, walkerWalker: W.ww, walkerAgent: W.wa, walkerDog: W.wd, walkerFurniture: W.wf, avoidMsAvg: +W.msAvg.toFixed(3), avoidMsMax: +W.msMax.toFixed(3), ms: Math.round(performance.now() - tw) };
    log('walk check', JSON.stringify(walkSummary)); }
  window.__auditReport = { when: new Date().toISOString(), night: NIGHT, ms: Math.round(performance.now() - t), blocks: out, modules: [...modFail.values()], walk: walkSummary }; document.title = 'audit-ready';
} else if (SHOT) {
  const HS = Q.get('home') ? await api.homesLoad?.() : null;   // HOMES pass · ?home=<id>&shot=1: aimed at the home before the drain, opened after it
  await stream.drain(); makeWalkers(); if (HS) await HS.ready;
  frame(T0); renderer.shadowMap.needsUpdate = true; frame(T0);
  const c = stream.counts(), rc = renderer.info.render;
  log(`VIEW ${view}${NIGHT ? ' night' : ''}${STRESS ? ' stress' : ''}${VIEWS[view].block ? ' [' + VIEWS[view].block + ']' : ''}: ${rc.calls} draw calls · ${(rc.triangles / 1e6).toFixed(2)}M tris (incl. shadow pass) · tiers ${c.full} near / ${c.mid} mid / ${c.far} far · chars ${c.charFull} full / ${c.charMid} mid / ${c.charFar} boxes · preset ${PR.name}`);
  document.title = 'ready';
} else if (BAKE) {   // streaming pass · ?bake=1 (tools/bake.mjs serves the page and receives the records): every block of the universe, day
  // and night, built by the worker pool exactly as the live stream builds it, each record posted raw (cache.js packRaw) to the bake server
  document.title = 'baking'; const t0 = performance.now(), U = universeOf(false), tods = (Q.get('tods') || 'd,n').split(','), rOf = (i, j) => Math.floor(i / CHUNK) + '_' + Math.floor(j / CHUNK);
  const post = async (path, body) => { let e = null; for (let k = 0; k < 3; k++) { try { const r = await fetch('/__bake/' + path, { method: 'POST', body }); if (r.ok) return; e = new Error(r.status); } catch (x) { e = x; } } throw new Error(`bake: POST ${path} failed: ${e}`); };
  const regions = {}, chunks = new Map(), key = (i, j) => i + ',' + j;
  for (const [i, j, b] of U) { const rk = rOf(i, j), G = regions[rk] ??= { far: [], mid: [], full: [], cf: [] }, c = chunkOf(i, j);
    if (c) { if (!chunks.has(c)) chunks.set(c, []); chunks.get(c).push([i, j]); } else G.far.push(key(i, j)); if (b) for (const t of ['mid', 'full', 'cf']) G[t].push(key(i, j)); }
  for (const [c, l] of chunks) { l.sort((a, b) => a[1] - b[1] || a[0] - b[0]); regions[c].far.push('chunk'); }   // (members in the stream's order: by row, then column)
  await post('plan', JSON.stringify({ hash, region: CHUNK, tods, regions, workers: pool.n, preset: PR.name }));
  const jobs = []; for (const tod of tods) for (const rk of Object.keys(regions).sort()) { const [ri, rj] = rk.split('_').map(Number);
    if (chunks.has(rk)) jobs.push({ tod, rk, kind: 'chunk', members: chunks.get(rk), o: [(ri * CHUNK + CHUNK / 2) * P, 0, (rj * CHUNK + CHUNK / 2) * P] });
    for (const k of regions[rk].far) if (k !== 'chunk') { const [i, j] = k.split(',').map(Number); jobs.push({ tod, rk, kind: 'far', i, j }); }
    for (const k of regions[rk].mid) { const [i, j] = k.split(',').map(Number); jobs.push({ tod, rk, kind: 'block', i, j }); } }
  jobs.sort((a, b) => (b.kind === 'block') - (a.kind === 'block'));   // (the long block builds first; far tiers fill the gaps)
  let next = 0, done = 0; const skipped = [];
  const send = (J, tier, k, rec, extra = {}) => post('rec', packRaw({ tod: J.tod, rk: J.rk, tier, key: k, group: J.kind === 'chunk' ? 'woods' : groupOf(J.i, J.j), ...extra }, rec));
  const one = async J => { const night = J.tod === 'n', k = J.kind === 'chunk' ? 'chunk' : key(J.i, J.j);
    const res = await pool.exec(J.kind === 'chunk' ? { type: 'farChunk', members: J.members, o: J.o, night, flags: FLAGS } : J.kind === 'far' ? { type: 'far', i: J.i, j: J.j, night, flags: FLAGS } : { type: 'block', i: J.i, j: J.j, night, audit: false, chars: true, flags: FLAGS });
    const tiers = J.kind === 'block' ? ['mid', 'full', 'cf'] : ['far'];
    if (res.errors?.length || res.placeholder) { skipped.push({ tod: J.tod, key: k, rk: J.rk, errors: (res.errors || []).map(e => e.path + ': ' + e.error).slice(0, 3) }); noteFail(res.errors); for (const t of tiers) await send(J, t, k, null, { skip: true }); }
    else if (J.kind === 'chunk') await send(J, 'far', k, { far: res.far, members: res.members }, { ms: res.ms });
    else if (J.kind === 'far') await send(J, 'far', k, { far: res.far, maxH: res.maxH }, { ms: res.ms });
    else { const c = res.chars;
      await send(J, 'mid', k, { mid: res.mid, maxH: res.maxH, stats: res.stats, trisMid: res.trisMid, pieces: res.pieces, anchors: res.anchors || null, lanes: res.lanes || null, cm: { mid: c.mid, far: c.far, count: c.count, centres: c.centres, n: c.n } }, { ms: res.ms });
      await send(J, 'full', k, { full: res.full, tris: res.tris }); await send(J, 'cf', k, { cf: c.full }); }
    if (++done % 25 === 0) document.title = `baking ${done}/${jobs.length}`; };
  try { await Promise.all(Array.from({ length: pool.n * 2 }, async () => { while (next < jobs.length) await one(jobs[next++]); }));
    await post('done', JSON.stringify({ ms: Math.round(performance.now() - t0), jobs: jobs.length, skipped, modules: [...modFail.values()] })); document.title = 'baked'; }
  catch (e) { console.error(e); document.title = 'bake failed: ' + String(e.message || e).slice(0, 200); }
} else {
  document.title = 'AI City · streaming…';
  let started = false, lastNow = null; const t1 = performance.now();
  // ── streaming pass · THE LOAD-IN. The start and every Go-to hold behind the overlay until the view and its surroundings have settled
  // (every block in range at its wanted tier: near and mid in range, far everywhere), or the timeout. The baked city is preloaded to
  // the preset's budget first (R.preload: 'all' — every tier of every block, resident in the baked-data workers; 'mid' — the far and
  // mid tiers of the whole city and full detail round the start, the rest of the full detail streams). Progress: code → data → view.
  let gate = null;
  const regionD = (rk, x, z) => { const [ri, rj] = rk.split('_').map(Number); return Math.hypot((ri + .5) * CHUNK * P - x, (rj + .5) * CHUNK * P - z); };
  function preload(kind, x, z) {
    if (!baked.on || (kind === 'goto' && R.preload === 'all')) return null;   // (everything is resident already)
    const all = R.preload === 'all', reach = R.near + CHUNK * P, list = [];
    for (const [ti, t] of (kind === 'goto' ? ['full', 'cf'] : ['far', 'mid', 'full', 'cf']).entries()) for (const rk of baked.regions(t)) { const d = regionD(rk, x, z);
      if ((t === 'full' || t === 'cf') && !all && d > reach) continue; list.push([rk, t, ti * 1e5 + d]); }
    list.sort((a, b) => a[2] - b[2]); return baked.preload(list, (n, of) => { if (gate) gate.data = [n, of]; }); }
  function holdFor(kind, label, pre, timeout) {
    gate = { kind, t0: performance.now(), pre, preDone: !pre, timeout, frames: 0, data: [0, 0], ctrl: gate ? gate.ctrl : controls.enabled };
    loadKind = kind; loadLabel = label; loadT0 = gate.t0; controls.enabled = false; const g = gate; pre?.then(() => { g.preDone = true; }); }
  function stepGate() { const g = gate; if (!g) return; g.frames++;
    const el = performance.now() - g.t0, p = stream.progress(), ok = g.frames > 2 && g.preDone && stream.settled() && (g.kind !== 'start' || (marks.first && warmed));   // (V6: the start also waits for the shader warm-up)
    if (ok || el > g.timeout) { gate = null; controls.enabled = g.ctrl; loadEvent({ phase: 'done', progress: 1, timedOut: !ok, done: p.done, total: p.want });
      if (g.kind === 'start') { marks.ready = performance.now(); log(`load-in done ${(marks.ready / 1000).toFixed(2)}s${ok ? '' : ' (timed out)'} · baked ${JSON.stringify(baked.stats || {})}`); } return; }
    if (g.frames % 4 !== 1) return; const lo = g.kind === 'start' ? .1 : 0, mid = g.pre ? lo + (1 - lo) * .5 : lo, v = p.want ? p.done / p.want : 0;
    if (!g.preDone) loadEvent({ phase: 'data', progress: lo + (mid - lo) * g.data[0] / Math.max(1, g.data[1]), done: g.data[0], total: g.data[1] });
    else loadEvent({ phase: 'view', progress: mid + (1 - mid) * v, done: p.done, total: p.want }); }
  if (LOADIN) { holdFor('start', '', preload('start', camera.position.x, camera.position.z), +(Q.get('loadtimeout') || 20000)); loadEvent({ phase: 'data', progress: .1 }); }
  else if (baked.on) preload('start', camera.position.x, camera.position.z);
  api.goTo = (x, z, label = '') => { nav.goTo(x, z); if (LOADIN) holdFor('goto', label, preload('goto', x, z), 12000); };
  const loop = now => {
    const dts = lastNow === null ? 0 : (now - lastNow) / 1000; if (cam) cam.update(dts); else nav.update(dts); lastNow = now;   // (camera pass: the rig runs nav in orbit)
    frame((now - t1) / 1000 + T0, now); if (cam) cam.after(); else controls.update(); stepGate();
    if (!marks.first && stream.firstView()) { marks.first = performance.now(); log(`first view ${(marks.first / 1000).toFixed(2)}s`); setTimeout(makeWalkers, 50); }
    if (marks.first && !marks.full && stream.settled()) { marks.full = performance.now(); const c = stream.counts(); log(`fully streamed ${(marks.full / 1000).toFixed(2)}s · ${c.full} near / ${c.mid} mid / ${c.far} far · cache ${JSON.stringify(cache.stats)}`); document.title = BENCH ? 'AI City · bench' : 'AI City · live'; }
    if (BENCH && marks.full && !started && !gate) { started = true; import('./bench.js').then(b => b.runBench(api)); }
  };
  renderer.setAnimationLoop(loop);
  warmUp().catch(e => console.warn('warm-up failed', e)).finally(() => { warmed = true; marks.warmed = performance.now(); });   // (V6: behind the load-in)
  api.pauseLoop = on => renderer.setAnimationLoop(on ? null : loop);   // (movement W3b: the subway carriage pauses the city while it is open)
  addEventListener('resize', () => { if (Q.has('w')) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  controls.addEventListener('start', () => api.clearFixedShadow());
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { const k = b.dataset.view; if (VIEWS[k].stress !== undefined && !STRESS) setStress(true);
  if (cam && VIEWS[k].stress === undefined) cam.view(k); else { cam?.toOrbit({ instant: true }); setView(k); } });   // (camera pass: the views ease there)
// pass 2 · the rush toggle: the district under the camera gets the Director's rush (its walkers double) until pressed again
document.querySelectorAll('[data-rush]').forEach(b => { let on = !!Q.get('rush'); b.onclick = () => { on = !on; const d = distOf(kindAt(Math.floor(controls.target.x / P), Math.floor(controls.target.z / P)));
  peds?.setDemand(simLayer?.model?.crowd ?? null, on ? { dist: d, mult: 2 } : null); b.textContent = on ? 'Rush: ' + d : 'Rush'; }; });
document.querySelectorAll('[data-tod]').forEach(b => b.onclick = () => { const u = new URL(location.href); u.searchParams.set('tod', b.dataset.tod); location.href = u; });
document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const u = new URL(location.href); u.searchParams.set('q', b.dataset.q); location.href = u; });
const qEl = document.getElementById('preset'); if (qEl) qEl.textContent = `${PR.name}${PR.auto ? ' (auto)' : ''}`;
if (!SHOT) mountPanel({ post, dyn });   // render pipeline pass · the RENDER button / \ key
// MOVEMENT W3b · the subway: the stairs and the carriage scene on a live page, a demo ride with ?subway=1 (subway/index.js; the carriage loads on the first ride)
if ((SIM === 'live' || Q.get('subway')) && !SHOT && !BAKE && !REPORT && !Q.has('hash')) import('./subway/index.js').then(m => m.mountSubway(api, { Q })).catch(e => noteFail([{ path: 'subway/index.js', stage: 'load', error: String(e && e.stack || e) }]));
