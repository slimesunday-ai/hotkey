// CLIP END CHECK (CLIPS.md § One-shot vs loop): stepClip (the CPU) and the shader must agree, on every frame, on whether a one-shot
// has reached its end. On that frame the CPU moves the walker by `shift` (state.shiftNow), chains into `next` or starts the blend-out,
// and the shader takes the shift off the clip's root (clipPose: `if (t >= D)`). A frame where they disagree pops the body: before the
// fix, turnstile at 60 fps had one frame with its clock at 1.4999999999999996 s, which the GPU reads as 1.5, so the shader had ended
// it while the CPU had not moved the walker yet, and the body jumped 0.7 m back for that frame.
// THE SHADER'S SIDE is read from the shader text (CLIPS_GLSL), not from index.js's CPU code: the clock reaches the GPU as a float32
// (writeGait2 into the Float32 animation texture) and the GLSL compares it with the clip's end literal (`const float D`, and the
// dispatcher's `t >= …` for a clip with a shift), itself a float32.
// Every registered clip is stepped from its start through its end and blend-out (a loop or a held one-shot is stopped after a while):
//   60 fps and 30 fps (from clock 0 and from the lab's start, one frame in) · a jittered dt (seeded, 1/240–1/34 s, random start clocks)
//   · `edge`: the step that crosses each one-shot's end lands within ±1e-7 s of it (the float32 rounding window, both sides)
//   node style/city/anim/clips/end-check.mjs [--seeds 40]     exit 1 on any frame where the CPU and the shader disagree
import { CLIPS, CLIPS_GLSL, clipOf, playClip, stopClip, stepClip } from './index.js';
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; }, SEEDS = +arg('--seeds', 40);

// the shader's end of each clip, as the float32 the GPU holds
const END = new Map(), esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const c of CLIPS) {
  const m = CLIPS_GLSL.match(new RegExp(`void clip_${c.name}\\(inout Pose P, float t, float u, float w\\) \\{[^\\n]*\\n  const float D = ([-0-9.e+]+);`));
  // (the dispatcher's branch: a switch case since 10-27, slime's "port the useful stuff" from the crafter game; the old if-chain form still parses)
  const d = CLIPS_GLSL.match(new RegExp(`(?:if \\(c == ${c.id}\\) \\{|case ${c.id}:) clip_${c.name}\\(Q, [^;]*, u, w\\);( if \\(t >= ([-0-9.e+]+)\\))?`));
  if (!m || !d) throw new Error(`clip_${c.name}: no ${m ? 'dispatcher branch' : 'const float D'} in CLIPS_GLSL`);
  if (!!d[1] !== !!(c.shift && !c.loop)) throw new Error(`clip_${c.name}: the dispatcher's shift test ${d[1] ? 'is there' : 'is missing'}`);
  if (d[2] && d[2] !== m[1]) throw new Error(`clip_${c.name}: the dispatcher's end ${d[2]} is not its D ${m[1]}`);
  if (!new RegExp(`clip_${esc(c.name)}\\(Q, ${c.loop ? 'mod\\(' : 'max\\(t, 0\\.\\)'}`).test(CLIPS_GLSL)) throw new Error(`clip_${c.name}: unexpected clock in the dispatcher`);
  END.set(c, Math.fround(parseFloat(m[1])));
}
const F = new Float32Array(1), gpu = t => (F[0] = t, F[0]);           // (writeGait2: the clock into the Float32 texture)
const shaderEnded = (c, t) => !c.loop && gpu(t) >= END.get(c);
const acts = c => !c.loop && !!(c.shift || c.next || !c.hold);         // a one-shot whose end the CPU acts on (a hold with no shift has none)

const DT = 1 / 60, EDGE = [-1e-7, -6e-8, -3e-8, -1e-8, -1e-12, 0, 1e-12, 1e-8, 3e-8, 6e-8, 1e-7];
const rnd = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// one play of clip c from clock t0; dtOf(s) → this frame's dt. Returns the frames the end was checked on and every disagreement.
function play(c, t0, dtOf) {
  const g = { idle: -1, iw: 0, it: 0, scale: 1 }; playClip(g, c.name, { t: t0 });
  let inst = { c: g.clip.c, acted: false }, checked = 0; const bad = [];
  for (let k = 0; g.clip && k < 4000; k++) {
    const s = g.clip; if (!s.out && (s.loop || s.c.hold) && s.t > (s.loop ? 2 * s.c.dur : s.c.dur + .5)) stopClip(g);   // (stopped: not an end)
    const prev = { c: s.c, t: s.t, out: s.out }, dt = dtOf(s), r = stepClip(g, dt), tc = prev.t + dt;   // tc: the clock stepClip tested
    // 1. the CPU acted on prev's end this frame (the shift, the chain, the blend-out): the shader must have ended it at that clock
    if (r && acts(prev.c) && (r.shiftNow || r.c !== prev.c || (!prev.out && r.out))) { checked++;
      if (!shaderEnded(prev.c, tc)) bad.push(`frame ${k}: the CPU ended ${prev.c.name} at ${tc} (GPU ${gpu(tc)}), the shader ends it at ${END.get(prev.c)}`);
      inst.acted = true; }
    if (r && r.c !== inst.c) inst = { c: r.c, acted: false };
    // 2. what the shader draws this frame (g.idle, g.it): it has ended the clip exactly when the CPU has
    if (g.clip && g.iw > 0) { const X = clipOf(g.idle); if (X !== inst.c) throw new Error(`${c.name}: drawing ${X?.name}, playing ${inst.c.name}`);
      if (acts(X)) { checked++; const se = shaderEnded(X, g.it);
        if (se !== inst.acted) bad.push(`frame ${k}: ${se ? 'the shader has ended' : 'the CPU has ended'} ${X.name} at clock ${g.it} (GPU ${gpu(g.it)}, end ${END.get(X)}) and ${se ? 'the CPU has not' : 'the shader has not'}${X.shift ? ` (a ${Math.hypot(...X.shift).toFixed(2)} m pop)` : ''}`); } }
  }
  if (g.clip) throw new Error(`${c.name}: still playing after 4000 frames`);
  return { checked, bad };
}
const MODES = {
  '60 fps': c => [0, DT].map(t0 => play(c, t0, () => DT)),
  '30 fps': c => [0, 2 * DT].map(t0 => play(c, t0, () => 2 * DT)),
  jitter: c => Array.from({ length: SEEDS }, (_, i) => { const R = rnd(1e4 * (c.id + 1) + i); return play(c, .05 * R(), () => (.25 + 1.5 * R()) * DT); }),
  edge: c => EDGE.map(e => { let done = null; return play(c, 0, s => { if (s.loop || s.out || done === s.c) return DT; const rem = s.c.dur - s.t; if (rem > DT) return DT; done = s.c; return Math.max(1e-9, rem + e); }); }),
};
let fail = 0;
console.log(`clip end check: ${CLIPS.length} clips (${CLIPS.filter(acts).length} one-shots whose end the CPU acts on), the CPU (stepClip) against the shader's end test (CLIPS_GLSL, float32)`);
for (const [mode, fn] of Object.entries(MODES)) { let runs = 0, checked = 0, badRuns = 0; const worst = new Map();
  for (const c of CLIPS) for (const r of fn(c)) { runs++; checked += r.checked; if (r.bad.length) { badRuns++; if (!worst.has(c.name)) worst.set(c.name, r.bad[0]); } }
  fail += badRuns; console.log(`  ${mode.padEnd(7)} ${String(runs).padStart(5)} plays · ${String(checked).padStart(7)} frames checked · ${badRuns ? `${badRuns} plays DISAGREE on ${worst.size} clips` : 'all agree'}`);
  for (const [n, b] of worst) console.log(`      ${n}: ${b}`); }
console.log(`clip end check → ${fail ? 'FAIL' : 'PASS: on every frame the CPU and the shader agree whether each one-shot has ended'}`); if (fail) process.exitCode = 1;
