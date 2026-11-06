// C2 · THE CARRIERS' HANDS ON THE BAG (lane C2-cleaners-art, 2026-11-04): measured on the REAL walker shader. WebGL transform feedback runs
// the cast's ANIM2_GLSL verbatim (anim/cast/walk2.js: walk v2, the elbow compiled in, every clip), so each hand's grip point (the
// mitten's centre, arm rest frame (±0.325, 0.39, 0), the forearm's part) lands exactly where the city draws it. The bag's loops come from
// the lead clip's own prop (cleaners.js: prop.loops(t, g), the CPU side of the same track). Both walkers are stepped as the city steps
// them (gait2.js stepGait2 at the clip's speed, clips/index.js stepClip, 1/60 s), from bag_lift → carry_back (A, the back carrier, at
// the bag's feet) and bag_lift_front → carry_front (B, CARRY_GAP ahead, at its head), for CARRY_S seconds of carrying.
//   cases   in step: both gaits on the same cycle (what the stage must keep) · out of step by a quarter and by half a cycle (the
//           carry's worst case if the stage lets them drift: the bag rides A's chest, so B's hands meet it only when B steps like A)
//   counted every frame from the moment both hands hold (bag_lift's hands fully on at 0.65 s) to the end; the blends are included
//   node style/city/tools/cleanershands.mjs --port 5972 [--carry 8] [--limit 0.03]     exit 1 if the in-step worst exceeds --limit (m)
import { ROOT, PORT, arg, chrome, serve } from './c2lib.mjs';

const CARRY_S = +arg('carry', 8), LIMIT = +arg('limit', .03);
if (!PORT) { console.error('usage: node style/city/tools/cleanershands.mjs --port <n>'); process.exit(2); }
const srv = await serve(), B = await chrome();
const probe = async (carry) => {
  const M = (p, i) => `const ${i} = await import('/style/city/${p}');`;
  return B.ev(`(async () => {
    ${M('anim/cast/walk2.js', 'W2')} ${M('anim/cast/gait2.js', 'GA')} ${M('anim/cast/clips/index.js', 'CL')} ${M('anim/cast/clips/cleaners.js', 'CN')} const THREE = await import('three');
    const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) throw new Error('WebGL2 unavailable');
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const vs = compile(gl.VERTEX_SHADER, '#version 300 es\\nprecision highp float; precision highp int; in vec3 position; in vec3 normal; out vec3 resultPosition;\\n' + W2.ANIM2_GLSL.replace(/attribute /g, 'in ') + '\\nvoid main(){ animCompute(); resultPosition = gR * position + gT; gl_Position = vec4(0.); }');
    const fs = compile(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; out vec4 color; void main(){ color = vec4(0.); }');
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.transformFeedbackVaryings(pr, ['resultPosition'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); gl.useProgram(pr);
    // the two grip points: the −x hand's on the −x forearm (part 3), the +x hand's on the +x forearm (part 4), the arm's rest frame
    const raw = new Float32Array([-.325, .39, 0, 3, .325, .39, 0, 4]), n = 2, out = new Float32Array(n * 3);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, raw, gl.STATIC_DRAW);
    for (const [name, k, off] of [['position', 3, 0], ['aPart', 1, 12]]) { const loc = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 16, off); }
    const ob = gl.createBuffer(); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, ob); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, out.byteLength, gl.DYNAMIC_READ); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, ob);
    const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 3, 0, gl.RGBA, gl.FLOAT, null); gl.uniform1i(gl.getUniformLocation(pr, 'uAnim'), 0);
    // the city's walker uniforms (peds.js: animUniforms2(tex, WALK2, { turnLean: .09 })), uploaded as the material would
    const [U, G] = W2.animUniforms2(new THREE.DataTexture(new Float32Array(12), 1, 3), GA.WALK2, { turnLean: .09 });
    gl.uniform4fv(gl.getUniformLocation(pr, 'uKeys2[0]'), new Float32Array(U.uKeys2.value.flatMap(v => [v.x, v.y, v.z, v.w])));
    for (const k of ['uB0', 'uB1', 'uB2']) gl.uniform4fv(gl.getUniformLocation(pr, k), new Float32Array([U[k].value.x, U[k].value.y, U[k].value.z, U[k].value.w]));
    const data = new Float32Array(12), hands = g => { W2.writeGait2(data, 1, 0, g); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 3, gl.RGBA, gl.FLOAT, data);
      gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, n); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
      gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, out); return [[out[0], out[1], out[2]], [out[3], out[4], out[5]]]; };
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), dt = 1 / 60, GAP = CN.CARRY_GAP;
    const run = (offset) => {
      const A = GA.gait2State({}), Bg = GA.gait2State({ u: offset }); CL.playClip(A, 'bag_lift', { t: 0 }); CL.playClip(Bg, 'bag_lift_front', { t: 0 });
      const st = { frames: 0, A: { max: 0, sum: 0 }, B: { max: 0, sum: 0 }, worst: null, byPhase: {} }; let t = 0;
      while (t < 2.2 + ${carry}) { t += dt;
        for (const g of [A, Bg]) { const s = g.clip, v = s?.c.moving ? s.c.speed : 0; g.v = v; GA.stepGait2(g, v * dt, dt, GA.WALK2, G, 0); if (!s?.c.moving) g.w = 0; CL.stepClip(g, dt); }
        const sA = A.clip; if (!sA || t < .65) continue;
        const P = sA.c.prop, L = P.loops(sA.t, A), hA = hands(A), hB = hands(Bg).map(p => [p[0], p[1], p[2] + GAP]);   // (B's frame → A's: CARRY_GAP ahead, the same heading)
        const eA = Math.max(d3(hA[0], L.feet[0]), d3(hA[1], L.feet[1])), eB = Math.max(d3(hB[0], L.head[0]), d3(hB[1], L.head[1]));
        st.frames++; st.A.max = Math.max(st.A.max, eA); st.A.sum += eA; st.B.max = Math.max(st.B.max, eB); st.B.sum += eB;
        const ph = sA.c.name; const q = st.byPhase[ph] ||= { frames: 0, A: 0, B: 0 }; q.frames++; q.A = Math.max(q.A, eA); q.B = Math.max(q.B, eB);
        if (!st.worst || Math.max(eA, eB) > st.worst.e) st.worst = { e: Math.max(eA, eB), t: +t.toFixed(3), clip: ph, who: eA > eB ? 'A' : 'B', walkW: +A.w.toFixed(3) }; }
      const mm = v => +(v * 1000).toFixed(2);
      return { frames: st.frames, A_max_mm: mm(st.A.max), A_mean_mm: mm(st.A.sum / st.frames), B_max_mm: mm(st.B.max), B_mean_mm: mm(st.B.sum / st.frames),
        byClip: Object.fromEntries(Object.entries(st.byPhase).map(([k, q]) => [k, { frames: q.frames, A_max_mm: mm(q.A), B_max_mm: mm(q.B) }])), worst: { ...st.worst, e_mm: mm(st.worst.e) } }; };
    return { inStep: run(0), quarter: run(.25), half: run(.5) };
  })()`, true, 120000);
};
try {
  await B.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/studio/cleaners.html?mode=probe` }); await new Promise(r => setTimeout(r, 1500));
  const r = await probe(CARRY_S);
  for (const [k, v] of Object.entries(r)) console.log(`${k.padEnd(7)} ${v.frames} frames · A (feet loops) max ${v.A_max_mm} mm, mean ${v.A_mean_mm} mm · B (head loops) max ${v.B_max_mm} mm, mean ${v.B_mean_mm} mm · worst ${JSON.stringify(v.worst)}\n        ${JSON.stringify(v.byClip)}`);
  const ok = r.inStep.A_max_mm <= LIMIT * 1000 && r.inStep.B_max_mm <= LIMIT * 1000;
  console.log(`cleaners hands → ${ok ? 'PASS' : 'FAIL'}: in step, every grip point within ${(LIMIT * 100).toFixed(1)} cm of its loop (worst ${Math.max(r.inStep.A_max_mm, r.inStep.B_max_mm)} mm)`);
  process.exitCode = ok ? 0 : 1;
} finally { await B.close(); if (srv) srv.kill(); }
