// ?bench=1 (pass 1c): after the first load settles, fly a fixed path and measure every frame, then show a results panel.
//   1 overview (the default camera, slow orbit) · 2 avenue (dolly down Central Ave at eye height) · 3 side street (dolly into side-1)
//   4 stress fly-over (switches to every urban block of the plan and crosses the island at 140 m)
// Per segment: wall-clock frame time p50/p95/worst (rAF intervals), GPU time p50/p95 (timer query, where the browser allows it),
// draw calls and triangles per frame (incl. shadow re-renders), tiers on screen. Plus load to first view / fully streamed.
import { remap } from '../../world/city.js';
// SPREAD (pass 5b): the fixed paths are today's metres, carried into the spread world (world/city.js remap: the same blocks framed)
const RM = ([x, y, z]) => { const [X, Z] = remap(x, z); return [X, y, Z]; };
const SEG = [
  { name: 'overview', dur: 6, path: t => { const a = .35 + t * .25, r = 110; return { pos: RM([Math.sin(a) * r * .45 + 18, 152, 92 - (1 - Math.cos(a)) * 20]), tgt: RM([0, 0, -33]), fov: 44 }; } },
  { name: 'avenue', dur: 7, path: t => ({ pos: RM([-78 + t * 70, 2.9, -1.3]), tgt: RM([-78 + t * 70 + 30, 4.0, -1.3]), fov: 54 }) },
  { name: 'side street', dur: 6, path: (t, V) => { const v = V['side-1'], d = [v.tgt[0] - v.pos[0], v.tgt[2] - v.pos[2]], L = Math.hypot(...d); return { pos: [v.pos[0] + d[0] / L * t * 20, 2.9, v.pos[2] + d[1] / L * t * 20], tgt: [v.tgt[0] + d[0] / L * t * 20, v.tgt[1], v.tgt[2] + d[1] / L * t * 20], fov: v.fov }; } },
  // W8 · CITY LIFE: a busy corner (a live page: the place with the most sim agents standing, their loops and walks running; skipped
  // without one): a slow orbit 10 m out, 6 m up
  { name: 'busy corner', dur: 7, corner: true, path: (t, V, c) => { const a = .4 + t * 1.3; return { pos: [c.x + Math.sin(a) * 10, 6, c.z + Math.cos(a) * 10], tgt: [c.x, 1, c.z], fov: 50 }; } },
  { name: 'stress fly-over', dur: 12, stress: true, path: t => ({ pos: RM([-260 + t * 480, 140, 170 - t * 330]), tgt: RM([-260 + t * 480 + 70, 0, 170 - t * 330 - 130]), fov: 50 }) },
];
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const f1 = x => x === null || x === undefined ? '–' : x.toFixed(1), f2 = x => x === null || x === undefined ? '–' : x.toFixed(2);

export async function runBench(api) {
  const { camera, controls, renderer, stream, VIEWS, dyn, marks, PR, R, log } = api, gl = renderer.getContext();
  controls.enabled = false; api.clearFixedShadow();
  const res = { preset: PR.name + (PR.auto ? ' (auto)' : ''), gpu: PR.gpu || '?', size: `${renderer.domElement.width}×${renderer.domElement.height}`, dpr: devicePixelRatio,
    loadFirst: marks.first / 1000, loadFull: marks.full / 1000, workersReady: marks.workers / 1000, cache: { ...api.cache().stats }, timer: dyn.timer, segs: [] };
  for (const S of SEG) {
    let car = null;
    if (S.corner) { const G = window.__simlive?.agents, by = new Map(); if (G) for (const a of G.map.values()) if (a.mode === 'stand' && a.w && a.spot) { const k = a.spot.place, o = by.get(k) || { n: 0, x: 0, z: 0 }; o.n++; o.x += a.w.p[0]; o.z += a.w.p[2]; by.set(k, o); }
      const top = [...by.values()].sort((a, b) => b.n - a.n)[0]; if (!top) continue; car = { x: top.x / top.n, z: top.z / top.n }; }
    if (S.stress) { api.setStress(true); }
    const rec = { name: S.name, ft: [], gpu: [], calls: [], tris: [], scale: [], ped: [], walkers: 0, tiers: null, t0: performance.now() };   // (cleanup pass: + the walkers' step, pedsim.js: following, corners, moving)
    await new Promise(done => { let last = performance.now(), n = 0; const t0 = performance.now();
      const step = () => { const now = performance.now(), t = (now - t0) / 1000 / S.dur;
        if (t >= 1) { done(); return; }
        const v = S.path(Math.min(1, t), VIEWS, car); camera.position.set(...v.pos); camera.fov = v.fov; camera.updateProjectionMatrix(); controls.target.set(...v.tgt); camera.lookAt(controls.target);
        if (n++ > 3 && now - t0 > 400) { rec.ft.push(now - last); rec.calls.push(renderer.info.render.calls); rec.tris.push(renderer.info.render.triangles); rec.scale.push(dyn.ratio); const g = dyn.gpu; if (g !== null) rec.gpu.push(g);
          if (api.peds?.sim) { rec.ped.push(api.peds.sim.stat.ms); rec.walkers = Math.max(rec.walkers, api.peds.count); } }
        last = now; requestAnimationFrame(step); };
      requestAnimationFrame(step); });
    rec.tiers = stream.counts(); res.segs.push(rec);
    log(`BENCH ${S.name}: p50 ${f1(q(rec.ft, .5))} p95 ${f1(q(rec.ft, .95))} ms · gpu p50 ${f2(q(rec.gpu, .5))} · calls ${Math.round(q(rec.calls, .5))} · tris ${(q(rec.tris, .5) / 1e6).toFixed(2)}M · walkers ${rec.walkers} step p50 ${f2(q(rec.ped, .5))} p95 ${f2(q(rec.ped, .95))} max ${f2(q(rec.ped, 1))} ms`);
  }
  res.cacheEnd = { ...api.cache().stats }; res.jobs = { ...stream.stat };
  render(res); window.__bench = res; document.title = 'bench done';
}
function render(res) {
  const rows = res.segs.map(s => ({ seg: s.name, p50: f1(q(s.ft, .5)), p95: f1(q(s.ft, .95)), worst: f1(q(s.ft, 1)), gpu50: f2(q(s.gpu, .5)), gpu95: f2(q(s.gpu, .95)), calls: Math.round(q(s.calls, .5)), callsMax: Math.max(...s.calls),
    tris: (q(s.tris, .5) / 1e6).toFixed(2), trisMax: (Math.max(...s.tris) / 1e6).toFixed(2), res: `${Math.min(...s.scale).toFixed(2)}–${Math.max(...s.scale).toFixed(2)}`, tiers: `${s.tiers.full}/${s.tiers.mid}/${s.tiers.far}`, chars: `${s.tiers.charFull}/${s.tiers.charMid}/${s.tiers.charFar}`, frames: s.ft.length }));
  const text = [`AI City bench · pass 1d · ${new Date().toISOString().slice(0, 16)}`, `preset ${res.preset} · GPU ${res.gpu} · canvas ${res.size} (dpr ${res.dpr}) · GPU timer ${res.timer ? 'yes' : 'no'}`,
    `load: first view ${res.loadFirst.toFixed(2)} s · fully streamed ${res.loadFull.toFixed(2)} s · workers ready ${res.workersReady.toFixed(2)} s · cache hits ${res.cache.hits ?? 0} / misses ${res.cache.misses ?? 0}`,
    'segment          | frame p50  p95  worst ms | GPU p50  p95 ms | calls p50 (max) | tris p50 (max) M | pixel ratio | tiers near/mid/far | chars full/mid/box | walkers · step p50/p95/max ms',
    ...rows.map((r, k) => { const P = res.segs[k].ped; return `${r.seg.padEnd(16)} | ${r.p50.padStart(6)} ${r.p95.padStart(5)} ${r.worst.padStart(6)} | ${r.gpu50.padStart(6)} ${r.gpu95.padStart(5)} | ${String(r.calls).padStart(5)} (${r.callsMax}) | ${r.tris.padStart(5)} (${r.trisMax}) | ${r.res} | ${r.tiers} | ${r.chars} | ${res.segs[k].walkers} · ${f2(q(P, .5))}/${f2(q(P, .95))}/${f2(q(P, 1))}`; }),
    `jobs: ${res.jobs.jobsFar} far · ${res.jobs.jobsBlock} block builds · ${res.jobs.idb} cache reads · ${res.jobs.charsBuilt} characters baked`].join('\n');
  const el = document.createElement('div'); el.id = 'bench';
  el.innerHTML = `<b>BENCH RESULTS</b><pre></pre><button type="button">Copy results</button><span class="hint2">paste these lines back</span>`;
  el.querySelector('pre').textContent = text; el.querySelector('button').onclick = async e => { try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch { const r = document.createRange(); r.selectNodeContents(el.querySelector('pre')); getSelection().removeAllRanges(); getSelection().addRange(r); e.target.textContent = 'Selected: press ⌘C / Ctrl+C'; } };
  document.body.appendChild(el); res.text = text; console.log(text);
}
