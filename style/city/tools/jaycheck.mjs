// C2-GORE2 (2026-11-04) · JAYCHECK: key X stages a jaywalker (traffic/accident.js GORE.jay) — slime, 11-04: "x should stage a jaywalker
// so people watching the playback can just click x and cause people to get hit as a fun little feature". In a real page (headless
// Chrome, this checkout served on --port), for each view: load, go to the view, press X (a real key event through CDP), wait for the
// hit, then the next press. Per press: hit or not, the page's seconds from the key to the hit, and whether the walker hit is in the
// frame at the hit (its middle projected through the camera on the first frame the accidents count the hit). Cabs, cruisers and patrols
// never hit (the car hit is read from the traffic, its kind and route), and never an agent (the walker hit is a crowd walker). Each hit's
// walker tier (1: the near tier, with its clips; 2 and 3: none) and its distance from the camera are reported, not gated.
//   node style/city/tools/jaycheck.mjs --port <p> [--mode live|rec1|rec10|rec60] [--tod day|night] [--views fitstreet,corner,...,tv]
//        [--presses 3] [--par 3] [--wait 20] [--json out.json]
// (From the orchestrator's goreviews-port.mjs probe, 11-04: the same five views and three presses each; it took the first hit after the
// key from any case and counted any body in view. Here the hit is the one the key set off, timed on the page's clock.)
// Prints one line a view (its frames a second over the presses: the page's seconds are the viewer's, so a slow machine is slow
// here too — run --par 1 for a viewer's rate) and the totals; exit 1 when fewer than 17 of 18 presses (scaled: all but one in 18) hit in the frame, the
// median from the key to the hit is over 6 s, or any hit is by a cab, a cruiser or a patrol, or of an agent.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), MODE = arg('mode', 'live'), TOD = arg('tod', 'day'), PRESSES = +arg('presses', 3), PAR = +arg('par', 3), WAIT = +arg('wait', 20), JSONF = arg('json', null);
const VIEWS = arg('views', 'fitstreet,corner,avenue,side-1,side-2,drop').split(',');
if (!PORT) { console.error('jaycheck: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const W = 1280, H = 720;
// the Chrome profile, removed only once Chrome has exited (its 'exit' event, at most 10 s), the removal tried again once if it fails
// (rmSync straight after SIGKILL, while Chrome was still writing, failed silently: 135 profiles, 8.2 GB, the 11-04 disk audit)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
// (every browser still open, closed and its profile removed on Ctrl-C or a kill)
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
const q = new URLSearchParams(); if (MODE.startsWith('rec')) { q.set('sim', 'record'); q.set('feed', '/core/runs/404-A/feed.jsonl'); } if (TOD === 'night') q.set('tod', 'night');
const URL0 = `http://127.0.0.1:${PORT}/style/city/index.html${[...q].length ? '?' + q : ''}`;
// (on the playback a named view is the viewer's own camera: ?tv=0, the director off, as after any input; the view `tv` is the page as
// it opens, the director's TV on — the first X, a key, hands the camera to the viewer where it is: camera/director.js)
const urlFor = v => { if (!MODE.startsWith('rec') || v === 'tv') return URL0; const u = new URLSearchParams(q); u.set('tv', '0'); return `http://127.0.0.1:${PORT}/style/city/index.html?${u}`; };
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'jaycheck-'));
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  const exited = new Promise(r => ch.once('exit', r)), kill = () => { LIVE.delete(kill); return rmProfile(ch, prof, exited); }; LIVE.add(kill);
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
  if (!port) { await kill(); throw new Error('chrome did not start'); }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errs, async close() { try { ws.close(); } catch {} await kill(); } };
}
// in the page: the key's time (a capture listener: the page's clock at the key event) and, every frame, a new hit: the case thrown
// latest, its walker's middle through the camera, the car that hit it
const HOOK = `(() => { const c = window.__city, A = c.traffic.accidents, T = c.THREE, P = c.peds.sim; window.__jay = { keys: [], hits: [], frames: 0, t0: performance.now() };
  addEventListener('keydown', e => { if (e.code === 'KeyX') __jay.keys.push(performance.now()); }, true);
  let h0 = A.stats().hits; const V = new T.Vector3(), M = new T.Matrix4();
  const tick = () => { requestAnimationFrame(tick); __jay.frames++; const h = A.stats().hits; if (h === h0) return; h0 = h;
    const cam = c.camera; cam.updateMatrixWorld(); M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const cs = A.now().filter(k => k.ph === 'thrown').sort((a, b) => a.t - b.t), k = cs[0];
    const w = k && P.walkers.filter(q => q.gore && !q.gone).sort((a, b) => Math.hypot(a.p[0] - k.x, a.p[2] - k.z) - Math.hypot(b.p[0] - k.x, b.p[2] - k.z))[0];
    const car = k && c.traffic.sim.cars.filter(o => o.wreck).sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
    let inView = false; if (k) { V.set(k.x, 1, k.z).applyMatrix4(M); inView = V.z > -1 && V.z < 1 && Math.abs(V.x) < 1 && Math.abs(V.y) < 1; }
    __jay.hits.push({ t: performance.now(), n: h, at: k ? [k.x, k.z] : null, by: k?.by ?? null, jay: !!(k && A.stats().jays), inView, agent: !!w?.agent, tier: w?.tier ?? null, dist: k ? +Math.hypot(k.x - cam.position.x, k.z - cam.position.z).toFixed(1) : null,
      car: car ? { kind: car.kind, route: !!car.route, stage: !!car.stage, asCar: !!car.asCar } : null }); };
  requestAnimationFrame(tick); return true; })()`;
const key = async S => { for (const type of ['keyDown', 'keyUp']) await S.send('Input.dispatchKeyEvent', { type, code: 'KeyX', key: 'x', windowsVirtualKeyCode: 88 }); };
async function one(v) { const S = await open(); const res = { view: v, presses: [] };
  try { await S.send('Page.navigate', { url: urlFor(v) }); const t0 = Date.now(); let ready = false;
    while (Date.now() - t0 < 180000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents)`).catch(() => false); }
    if (!ready) throw new Error('the page did not load');
    if (MODE.startsWith('rec')) { const sp = MODE.slice(3) || '1'; res.speed = await S.ev(`(() => { const s = document.querySelector('#record-player select'); if (!s) return null; s.value = '${sp}'; s.dispatchEvent(new Event('change')); return s.value; })()`); }
    // (the view as its button takes it: through the camera rig when the page has one — the playback's does, and holds the camera to
    // its own pose against a bare setView — else setView)
    if (v !== 'tv') await S.ev(`(() => { const c = window.__city, k = ${JSON.stringify(v)}; if (c.cam?.view) c.cam.view(k); else c.setView(k); })()`); await sleep(6000); await S.ev(HOOK);
    res.charNear = await S.ev(`window.__city.R?.charNear ?? null`);
    res.cam = await S.ev(`[__city.camera.position.x, __city.camera.position.z].map(Math.round)`);
    for (let p = 0; p < PRESSES; p++) { const n0 = await S.ev('__jay.hits.length'), k0 = await S.ev('__jay.keys.length'); await key(S); const t1 = Date.now(); let h = null;
      while (Date.now() - t1 < WAIT * 1000 && !h) { await sleep(250); h = await S.ev(`__jay.hits[${n0}] ?? null`); }
      const kt = await S.ev(`__jay.keys[${k0}] ?? null`), st = await S.ev(`__city.traffic.accidents.stats()`);
      res.presses.push({ hit: !!h, secs: h && kt ? +((h.t - kt) / 1000).toFixed(2) : null, inView: !!h?.inView, tier: h?.tier ?? null, dist: h?.dist ?? null, by: h?.by ?? null, agent: !!h?.agent, car: h?.car ?? null, at: h?.at ?? null, why: h ? undefined : Object.fromEntries(Object.entries(st.why).filter(([k]) => k.startsWith('jay'))) });
      await sleep(3000); }
    res.fps = await S.ev('+(__jay.frames / ((performance.now() - __jay.t0) / 1000)).toFixed(1)'); res.cam1 = await S.ev(`[__city.camera.position.x, __city.camera.position.z].map(Math.round)`);
  } catch (e) { res.error = e.message; } res.errs = S.errs.slice(0, 3); await S.close(); return res; }
const queue = [...VIEWS], out = [];
await Promise.all(Array.from({ length: Math.min(PAR, VIEWS.length) }, async () => { while (queue.length) { const v = queue.shift(), r = await one(v); out.push(r);
  console.log(`${v.padEnd(10)} ${String(r.fps ?? '?').padStart(5)} fps  cam ${r.cam} → ${r.cam1}  ${r.error ? 'ERROR ' + r.error : r.presses.map(p => p.hit ? `${p.inView ? 'hit' : 'OFF'} ${p.secs}s t${p.tier} ${p.dist}m` : 'none').join(' · ')}${r.errs.length ? '  errs: ' + r.errs.join(' | ') : ''}`); } }));
const all = out.flatMap(r => r.presses), good = all.filter(p => p.hit && p.inView), secs = all.filter(p => p.hit).map(p => p.secs).filter(x => x !== null).sort((a, b) => a - b);
const med = secs.length ? secs[secs.length >> 1] : null, p90 = secs.length ? secs[Math.min(secs.length - 1, Math.floor(secs.length * .9))] : null;
const badCar = all.filter(p => p.car && (p.car.kind !== 'car' || p.car.route || p.car.stage || p.car.asCar)).length, agents = all.filter(p => p.agent).length, errors = out.filter(r => r.error).length;
const need = all.length - Math.ceil(all.length / 18);
console.log(`jaycheck ${MODE} ${TOD}: ${good.length}/${all.length} presses hit in the frame (${all.filter(p => p.hit).length} hit at all) · key→hit median ${med} s, p90 ${p90} s, max ${secs.at(-1) ?? null} s · by a cab/cruiser/patrol ${badCar} · an agent hit ${agents} · views that failed to run ${errors}`);
const tiers = {}; for (const p of all) if (p.hit) tiers['t' + p.tier] = (tiers['t' + p.tier] || 0) + 1; const ds = all.filter(p => p.hit && p.dist !== null).map(p => p.dist).sort((a, b) => a - b);
console.log(`jaycheck ${MODE} ${TOD}: the walker hit by tier ${JSON.stringify(tiers)} (near-tier radius ${out.find(r => r.charNear)?.charNear ?? '?'} m) · its distance from the camera median ${ds[ds.length >> 1] ?? null} m, p90 ${ds[Math.min(ds.length - 1, Math.floor(ds.length * .9))] ?? null} m, max ${ds.at(-1) ?? null} m`);
if (JSONF) fs.writeFileSync(JSONF, JSON.stringify({ mode: MODE, tod: TOD, url: URL0, views: out }, null, 1));
const pass = !errors && good.length >= need && med !== null && med <= 6 && !badCar && !agents;
console.log(`jaycheck: ${pass ? 'PASS' : 'FAIL'} (needs ≥ ${need}/${all.length} in the frame, median ≤ 6 s)`); process.exit(pass ? 0 : 1);
