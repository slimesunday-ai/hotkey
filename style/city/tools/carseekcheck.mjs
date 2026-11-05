// C2-carseek: seed's longest planned ride, opened late on a paused record, plus 60x CPU cost.
// New probe only; existing gates remain unchanged. Run ONE browser at a time:
// TMPDIR=/tmp node style/city/tools/carseekcheck.mjs --port 5989 [--seed 404] [--revision b160b71] [--tag before] [--out /tmp/c2-carseek] [--loop-limit 1.55]
// Also usable as --import for existing browser checks: pins their Chrome debugger to 5988.
// Baseline-only instrumentation times the old synchronous replay without changing its work.
import child from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5989), SEED = +arg('seed', 404), TAG = arg('tag', 'probe'), OUT = arg('out', '/tmp/c2-carseek');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const spawn = child.spawn;
child.spawn = function (cmd, args, options) {
  if (cmd !== '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') return spawn(cmd, args, options);
  args = args.map(a => a === '--remote-debugging-port=0' ? '--remote-debugging-port=5988' : a);
  const profile = args.find(a => a.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
  const ch = spawn(cmd, args, options);
  process.once('exit', () => ch.kill());
  (async () => {
    for (let i = 0; i < 150 && ch.exitCode === null; i++) {
      await sleep(100);
      try {
        const v = await (await fetch('http://127.0.0.1:5988/json/version')).json();
        await fs.writeFile(profile + '/DevToolsActivePort', '5988\n' + new URL(v.webSocketDebuggerUrl).pathname + '\n');
        return;
      } catch {}
    }
  })();
  return ch;
};
syncBuiltinESMExports();

const PICTURE = `h => {
  const mesh = h.view.scene.getObjectByName('subway:riders'), sh = { uniforms: {}, vertexShader: '', fragmentShader: '' };
  mesh.material.onBeforeCompile(sh, h.view.renderer);
  const tex = sh.uniforms.uAnim.value, data = tex.image.data, cap = tex.image.width, M = h.view.camera.matrixWorld.clone(), bodies = [];
  for (let k = 0; k < h.state().crowd.bodies; k++) if (mesh.getVisibleAt(k)) {
    mesh.getMatrixAt(k, M); const anim = [];
    for (let row = 0; row < 3; row++) anim.push(...data.slice((row * cap + k) * 4, (row * cap + k) * 4 + 4));
    bodies.push({ k, matrix: M.elements.slice(), anim });
  }
  return { bodies, camera: h.view.camera.matrixWorld.elements.slice(), fade: h.view.root.style.getPropertyValue('--sbw-fade'), age: h.view.root.style.getPropertyValue('--sbw-age') };
}`;
const HOOK = `(() => {
  const P = window.__carseek = { frames: [], on: false, clock: 0 }, raf = window.requestAnimationFrame.bind(window);
  let last = null, frame;
  window.requestAnimationFrame = cb => raf(ts => {
    if (last !== ts) { last = ts; frame = { ts, cpu: {} }; if (P.on) P.frames.push(frame); }
    const t = performance.now(); try { return cb(ts); } finally { const k = cb.name || 'anon'; frame.cpu[k] = (frame.cpu[k] || 0) + performance.now() - t; }
  });
})();`;
async function main() {
  if (![5986, 5987, 5989].includes(PORT)) throw new Error('probe port must be 5986, 5987 or 5989 (Chrome uses 5988)');
  const revision = arg('revision', null);
  const read = async name => revision ? execFileSync('git', ['show', `${revision}:style/city/subway/${name}.js`], { cwd: ROOT, encoding: 'utf8' }) : fs.readFile(new URL(`../subway/${name}.js`, import.meta.url), 'utf8');
  const source = await read('carriage'), riders = await read('riders');
  const baseline = !source.includes('timing.replay');
  const carriage = baseline ? source.replace('while (tick < endTick) {', 'const replay0 = performance.now(); while (tick < endTick) {')
    .replace("root.style.setProperty('--sbw-fade'", "timing.probeReplay = performance.now() - replay0; root.style.setProperty('--sbw-fade'") : source;
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'), file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403); res.end(); return; }
      const body = url.pathname === '/style/city/subway/carriage.js' ? carriage : url.pathname === '/style/city/subway/riders.js' ? riders : await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  let B;
  const out = { seed: SEED, tag: TAG, revision, baselineInstrumentation: baseline, openings: [] };
  try {
    B = await chrome(); await B.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
    const url = at => `http://127.0.0.1:${PORT}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${at % 1440 >= 360 && at % 1440 < 1200 ? 'day' : 'night'}&recordAt=${at}&recordPaused=1`;
    await B.send('Page.navigate', { url: url(360) }); await ready(B, 240000); await sleep(4000);
    out.ride = await B.ev(`(async () => {
      const { loadNet, programOf } = await import('./subway/net.js'), net = await loadNet(), D = window.__record.draw;
      let best = null, count = 0;
      for (const [id, L] of D.timeline.segs) for (let i = 0; i < L.length; i++) {
        const d = D.rule.at(id, i), P = d?.trip && programOf(net, d.trip.legs, 60); if (!P) continue; count++;
        if (!best || P.dur > best.program.dur) best = { id, dep: d.dep, program: P };
      }
      return best && { ...best, scannedRides: count };
    })()`);
    if (!out.ride) throw new Error('no subway ride');
    console.log('deepest ride', JSON.stringify(out.ride));
    const P = out.ride.program, deepest = Math.floor((P.dur - 3.1) * 60) / 60;
    for (const depth of [...new Set([deepest, ...(deepest >= 180 ? [180] : [])])]) {
      const minute = P.t0 + depth / 60;
      await B.send('Page.navigate', { url: url(minute) }); await ready(B, 240000); await sleep(4000);
      await B.ev(`import('./subway/carriage.js').then(m => m.prewarmCarriage())`);
      await B.ev(`window.__carseek.picture = ${PICTURE}`);
      // Opening, including its bakes and final draw, through the page's normal subway ride entry.
      const result = await B.ev(`(async () => {
        const P = window.__carseek; P.clock = ${depth}; P.frames.length = 0; P.on = true;
        await new Promise(r => requestAnimationFrame(r));
        const h = await window.__city.subway.ride(${JSON.stringify(out.ride.program)}, { id: ${JSON.stringify(out.ride.id)} }, () => P.clock);
        const timing = { ...h.timing };
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        P.on = false;
        const frames = P.frames, intervals = frames.slice(1).map((f, i) => f.ts - frames[i].ts);
        const result = { timing, longestFrameMs: Math.max(...intervals), over50: intervals.filter(v => v > 50.01).length,
          frames: frames.length,
          replayMs: timing.replay ?? timing.probeReplay, state: h.state(), picture: P.picture(h) };
        h.close(); return result;
      })()`, true, 120000);
      out.openings.push({ id: out.ride.id, minute, depth, ...result });
      const { picture, ...summary } = out.openings.at(-1); console.log('opening', JSON.stringify(summary));
    }
    // 60 actual carriage RAF callbacks; advance exactly one island second before each callback.
    out.speed60 = await B.ev(`(async () => {
      const P = window.__carseek; P.clock = 0;
      const h = await window.__city.subway.ride(${JSON.stringify(out.ride.program)}, { id: ${JSON.stringify(out.ride.id)} }, () => P.clock);
      P.frames.length = 0; P.on = true;
      await new Promise(resolve => { let n = 0; const advance = () => { P.clock = ++n; if (n < 61) requestAnimationFrame(advance); else resolve(); }; requestAnimationFrame(advance); });
      P.on = false;
      const a = P.frames.filter(f => f.cpu.loop !== undefined).slice(1).map(f => f.cpu.loop);
      const speed = { frames: a.length, loopMsPerFrame: a.reduce((a,b) => a+b,0)/a.length, maxLoopMs: Math.max(...a) };
      h.pause(true); const pictures = [];
      for (const depth of ${JSON.stringify([...new Set([...(deepest >= 180 ? [180] : []), deepest])])}) {
        while (h.t < depth - 1e-8) { await new Promise(r => requestAnimationFrame(r)); h.advance(Math.min(1, depth - h.t)); }
        pictures.push({ depth, picture: P.picture(h) });
      }
      h.close(); return { ...speed, pictures };
    })()`);
    const { pictures, ...speed } = out.speed60; console.log('60x carriage loop', JSON.stringify(speed));
    const canonical = o => JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(7) : v);
    out.parity = pictures.map(p => ({ depth: p.depth, equal: canonical(p.picture) === canonical(out.openings.find(o => o.depth === p.depth).picture) }));
    console.log('seek equals play (visible GPU matrices, clip/idle/gait texture, camera, fade)', JSON.stringify(out.parity));
    if (!baseline) {
      out.cancellation = await B.ev(`(async () => {
        let calls = 0; const h = await window.__city.subway.ride(${JSON.stringify(out.ride.program)}, { id: ${JSON.stringify(out.ride.id)} }, () => ++calls >= 3 ? null : ${deepest});
        return { calls, closed: h === null, roots: document.querySelectorAll('.sbw').length, covered: window.__city.covered };
      })()`);
      console.log('clock lost during a replay yield', JSON.stringify(out.cancellation));
    }
    if (B.errors.length) throw new Error(B.errors.join('\n'));
  } finally { if (B) await B.close(); await new Promise(r => server.close(r)); }
  await fs.mkdir(OUT, { recursive: true }); await fs.writeFile(path.join(OUT, `carseek-${SEED}-${TAG}.json`), JSON.stringify(out, null, 2) + '\n');
  const ok = out.openings.every(o => o.longestFrameMs <= 50.01) && out.parity.every(p => p.equal)
    && out.speed60.frames === 60 && out.speed60.loopMsPerFrame <= +arg('loop-limit', Infinity)
    && (baseline || (out.cancellation.closed && !out.cancellation.roots && !out.cancellation.covered));
  console.log(`CARSEEKCHECK ${ok ? 'PASS' : 'FAIL'} (opening <= 50 ms; seek equals play; 60x loop; cancellation)`);
  if (!ok) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exitCode = 1; });
