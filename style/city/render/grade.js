// TAPE · THE TIME-OF-DAY GRADE (2026-10-09, slime: "grade now, one build later"). The page is built for day or night: lit windows and
// signs are per voxel, baked per time of day (main.js ?tod=night). In LIVE, simstate/live.js reloads into the sim's build at 20:00 and
// 06:00; TAPE holds that reload off, so a tape scrubbed or played into the night on a day build stayed day, and the reverse. This grades
// the build toward the tape's time instead: k 0 … 1, 0 being the build exactly as it is (ui/light.js eases k toward amountAt(tape time)).
//   night on a day build   light, sky and fog go day → blue hour → night (lighting.js grade: the times of day's own bundles, the sun's
//                          direction kept so the shadow map isn't redrawn), exposure × the night build's 1.25, a share of the day glass
//                          lit as the night build lights its windows (gpu.js TODWIN, uWinX.w > 0), warm pools under the street lamps,
//                          the water's moon glitter; optionally the night build's lamp light (lampLight) and a blue grade (lut)
//   day on a night build   light, sky and fog go night → blue hour → day, exposure back to the day build's, the lamp light, pools and the
//                          water's lamp streaks out, the lit windows back to day glass one by one (uWinX.w < 0)
// NOTHING RECOMPILES WHEN IT MOVES. Every term is in the shaders from the start — installed before any material compiles, on grading
// pages only (main.js GRADE: ?sim=live, never shots, bakes, hashes or audits; ?grade=0 turns it off) — and switched by uniforms; the
// pools are built at start and compiled in main.js's warm-up. At k = 0 every term is off and the build renders as before.
// MEASURED (the render review's paused-loop GPU bench, 3200 × 1826, p10; overview, avenue, low; scene / whole frame through the default
// look): moving k 0 → 1 costs +0.00–0.015 ms on either build; being installed costs +0.04–0.07 / +0.09–0.12 ms on a day page at k = 0
// (the lamp term and the blue grade compiled in) and +0.00–0.06 on a night page, against ?grade=0. The night build's lamp light on the
// graded day build (lampLight) costs +0.23–0.31 / +0.43–0.60 ms more at street level — the night build pays the same. ON by default
// since the art fixes (2026-10-10, slime). Re-measured then (same bench, the archive replay of 10-09T22-14-31 dry, p10, lampLight off →
// on): a day build at a 22:00 tape (k = 1) avenue +0.31 / +0.60, low +0.22 / +0.43, ROUTE 9's street camera +0.20 / +0.19, the
// subway frames' default camera over it (26 m up) +0.28 / +0.27; the page's own default camera (the overview, 152 m) +0.00, since from
// 90 m up the term is off anyway. At a noon tape (k = 0) and on the night build (its own lamp light, always on) it changes nothing (±0.02).
// NOT GRADED (they are per voxel or the traffic's, baked or built for one time of day): lit signs and neon, shopfront interiors and
// lit curtains, lamp heads, the traffic lights' night glow, cars' head and tail lights, the homes' night lights, the water's lamp
// streaks on a day build. The panel's "Tape: time-of-day grade" section (group light) holds the knobs.
import * as THREE from 'three';
import * as S from './settings.js';
import { WIN } from '../gpu.js';
import { RULES } from '../simstate/adapter.js';

// ── the blue grade, in three's tone-mapping chunk: after toneMapping() (display-linear 0–1), before the sRGB encode and the fog, so the
// fog and the sky (not tone-mapped) keep the night bundle's own colours, and the lit voxels (MeshBasic, not tone-mapped) stay lit.
// cityGrade: x amount · y saturation · z gamma (> 1 crushes the darks) · cityGradeT rgb: the tint (luminance kept). One uniform branch
// at amount 0; a lit tier fragment (a window, a sign: gpu.js tLit) sets cityGradeK = 0 and keeps its colour. Off by default: measured
// against the night build (mean RGB of the frame and of its unlit surfaces, 6 views), the night bundle alone already matches it within
// ~0.01 (the overview to the third decimal); the blue grade only moved it away (avenue: red −19 %, blue +11 %, saturation −21 %).
// (Plain {x,y,z,w} values: three keeps them by reference, so one object drives every program.)
const GR = { x: 0, y: 1, z: 1, w: 0 }, GT = { x: 1, y: 1, z: 1, w: 0 };
let installed = false;
export function installTodGrade() {
  if (installed) return true; const C = THREE.ShaderChunk;
  if (!C.tonemapping_fragment.includes('gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );')) { console.warn('grade: three tone-mapping chunk is not the r185 text — no blue grade'); return false; }
  installed = true;
  C.tonemapping_pars_fragment += `
#define CITY_GRADE
uniform vec4 cityGrade; uniform vec4 cityGradeT; float cityGradeK = 1.;
vec3 cityGradeOf( vec3 c ) { float y = dot( c, vec3( .2126, .7152, .0722 ) ); vec3 g = max( mix( vec3( y ), c, cityGrade.y ), 0. ) * cityGradeT.rgb;
	g = pow( g, vec3( cityGrade.z ) ); return mix( c, g, cityGrade.x * cityGradeK ); }`;
  C.tonemapping_fragment = C.tonemapping_fragment.replace('gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );', 'gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n\tif ( cityGrade.x > 0. ) gl_FragColor.rgb = cityGradeOf( gl_FragColor.rgb );');
  for (const s of Object.values(THREE.ShaderLib)) if (s.uniforms) { s.uniforms.cityGrade = { value: GR }; s.uniforms.cityGradeT = { value: GT }; }
  return true;
}

export const GRADE_FIELDS = {
  dusk: { v: 30, min: 5, max: 120, step: 1, label: 'dusk and dawn (game min)', hint: 'how long the grade takes to come in after 20:00 / 06:00 on the tape' },
  exposure: { v: 0, min: -1.5, max: 1.5, step: .05, label: 'night: exposure (EV)', hint: 'over the night build’s own exposure' },
  lut: { v: 0, min: 0, max: 1, step: .01, label: 'night: blue grade', hint: 'a day-for-night grade in the materials; 0: the night bundle alone already matches the night build (measured 10-09)' },
  tint: { v: '#c4d2ff', color: true, label: 'night: blue grade tint' },
  saturation: { v: .8, min: 0, max: 1.5, step: .01, label: 'night: blue grade saturation' },
  gamma: { v: 1.1, min: .6, max: 2, step: .01, label: 'night: blue grade gamma', hint: '> 1 sinks the darks' },
  lampLight: { v: true, label: 'night: lamp light (+0.2–0.6 ms)', hint: 'the night build’s own lamp term (on by default since 2026-10-10): the lamps nearest the camera light walls, ground and people, as on the night build — at street level +0.20–0.31 ms of GPU for the scene, +0.19–0.60 ms for the whole frame (3200 × 1826), only while the grade is in (a tape past 20:00 on a day build); off from 90 m up' },
  pools: { v: .8, min: 0, max: 3, step: .01, label: 'night: lamp pools', hint: 'a warm pool on the ground under every street lamp (the night section’s pools; with the lamp light on, faded out near the camera where it is): ~0 ms; out from 90 m up, as the night build shows none' },
  windows: { v: .42, min: 0, max: 1, step: .01, label: 'night: day glass lit', hint: 'share of the day build’s window glass lit at night' },
  dayGlass: { v: 1, min: 0, max: 4, step: .05, label: 'day: lit glass → day glass', hint: 'the unlit glass’s brightness by day, where the night build had a lit window' },
};

export function createTodGrade({ LIGHT, post, water = null, NIGHT }) {
  let k = 0, v = null; const tint = new THREE.Color();
  const apply = () => { const x = k;
    LIGHT.grade.set(x);   // light, sky, fog: day → blue → night, or night → blue → day
    LIGHT.night.level(NIGHT ? 1 - x : x, NIGHT ? {} : { pools: v.pools, term: v.lampLight });   // the lamp light and the pools
    if (!NIGHT) LIGHT.night.poolNear(v.lampLight ? 10 : 0, v.lampLight ? 26 : 0);
    water?.setNight(NIGHT ? 1 - x : x);   // (the water: sun or moon glitter; the night build's lamp streaks fade out by day)
    WIN.extra.value.w = NIGHT ? -x : x * v.windows; WIN.glass.value = v.dayGlass;   // the windows (gpu.js TODWIN)
    const lut = NIGHT ? 0 : x * v.lut; GR.x = lut; GR.y = v.saturation; GR.z = v.gamma; tint.set(v.tint); const l = .2126 * tint.r + .7152 * tint.g + .0722 * tint.b || 1; GT.x = tint.r / l; GT.y = tint.g / l; GT.z = tint.b / l;
    post.setExposureScale(NIGHT ? (1 / 1.25) ** x : (1.25 * 2 ** v.exposure) ** x); };
  v = S.register('todgrade', GRADE_FIELDS, vals => { v = vals; apply(); }, { title: 'Tape: time-of-day grade', group: 'light', order: 7 });
  const api = {
    night: NIGHT, get k() { return k; }, get settings() { return v; },
    set(x) { x = Math.max(0, Math.min(1, +x || 0)); if (x === k) return; k = x; apply(); },
    // the grade's target at tape minute t: 0 while the tape's time of day is the build's; past 20:00 (06:00) it comes in over `dusk`
    // game minutes on a day (night) build, and goes out over the `dusk` minutes before 06:00 (20:00), so it is whole by night (day)
    amountAt(t, from = RULES.TIME.nightFrom, to = RULES.TIME.nightTo) { const m = ((t % 1440) + 1440) % 1440, R = v.dusk, a = from * 60, b = to * 60, ss = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
      if (!NIGHT) { const n = m >= a ? m - a : m < b ? m + 1440 - a : -1; if (n < 0) return 0; const len = b + 1440 - a; return ss(Math.min(n / R, (len - n) / R)); }
      if (m < b || m >= a) return 0; const n = m - b, len = a - b; return ss(Math.min(n / R, (len - n) / R)); },
    stats: () => ({ k: +k.toFixed(3), night: NIGHT, exposure: +post.exposureScale.toFixed(3), lut: GR.x, windows: WIN.extra.value.w, lamps: LIGHT.night.levelNow }),
  };
  return api;
}
