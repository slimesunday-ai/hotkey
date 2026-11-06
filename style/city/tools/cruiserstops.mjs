// C2-CLEANERS round 3 (2026-11-05) · CRUISERSTOPS: the arrest's cruiser stops where it stopped before the van's stop was added to
// stage/cruiser.js planStop (offered to the van only). The reference: cruiser.js as of --ref (git show; trunk a084874 by default),
// served beside this checkout's for the run as stage/_cruiser_ref.js and removed after. In a real page (record 404-A, this checkout on
// --port), for vanstop.mjs's 60 body landings (40 kerbside, 15 parking, 5 shoulder: the arrest's suspect stood at the body), the camera
// onto it, then on the SAME frame planStop(stage ctx, suspect) from both — the plain cruiser call (IN 1.2, stand-in) and the arrest's
// agent cop (standIn false) — and every field of the plan compared: kind, lane, s, lat, x, z, walkLen, out, the walk. Exit 1 on any
// difference.
//   node style/city/tools/cruiserstops.mjs --port <p> [--par 2] [--ref a084874]
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), PAR = +arg('par', 2), DT = +arg('dt', .1), REF = arg('ref', 'a084874');
if (!PORT) { console.error('cruiserstops: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const W = 960, H = 600;
// ── the rows: 40 kerbside, 15 parking, 5 shoulder, evenly through bodyland's rows (both seeds, in order)
const ALL = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err).map(r => ({ ...r, seed: +s })));
const pick = (place, n) => { const rs = ALL.filter(r => r.place === place); return Array.from({ length: Math.min(n, rs.length) }, (_, k) => rs[Math.floor(k * rs.length / n)]); };
const ROWS = [...pick('kerbside', 40), ...pick('parking', 15), ...pick('shoulder', 5)].map((r, k) => ({ k, seed: r.seed, i: r.i, d: r.d, place: r.place, cls: r.car.cls, lane: r.car.lane, body: r.body, marks: r.marks, pivot: r.pivot }));
// the Chrome profile, removed only once Chrome has exited (jaycheck.mjs's way)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cruiserstops-'));
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  const exited = new Promise(r => ch.once('exit', r)), kill = () => { LIVE.delete(kill); return rmProfile(ch, prof, exited); }; LIVE.add(kill);
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
  if (!port) { await kill(); throw new Error('chrome did not start'); }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, timeout = 600000) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errs, async close() { try { ws.close(); } catch {} await kill(); } };
}


const REFF = path.join(ROOT, 'style/city/stage/_cruiser_ref.js');
fs.writeFileSync(REFF, execSync(`git -C "${ROOT}" show ${REF}:style/city/stage/cruiser.js`, { encoding: 'utf8' }));
const cleanup = () => { try { fs.unlinkSync(REFF); } catch {} }; process.on('exit', cleanup);
const RUN = async (V, DT) => { const c = window.__city, C = window.__record.draw.stage.ctx, B = new URL('.', location.href).pathname;
  const [NEW, OLD] = await Promise.all([import(B + 'stage/cruiser.js'), import(B + 'stage/_cruiser_ref.js')]); c.pauseLoop(true); c.cover(true);
  const bx = V.body.x, bz = V.body.z, yaw = V.body.yaw, fx = Math.cos(yaw), fz = -Math.sin(yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(bx, .6, bz); c.camera.position.set(bx + side[0] * 20 - fx * 12, 15, bz + side[1] * 20 - fz * 12); c.camera.lookAt(bx, .6, bz); c.controls.update?.(); c.camera.lookAt(bx, .6, bz);
  for (let k = 0; k < 400; k++) { c.tick(DT, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) c.tick(DT, 1);
  const A = { x: bx, z: bz, y: 0, ry: 0 }, pick = r => r.plan ? { kind: r.plan.kind, L: r.plan.L.id, s: r.plan.s, lat: +r.plan.lat.toFixed(4), x: +r.plan.x.toFixed(4), z: +r.plan.z.toFixed(4), walkLen: +r.plan.walkLen.toFixed(4), out: r.plan.out, walk: JSON.stringify(r.plan.walk) } : { none: JSON.stringify(r.why) };
  const out = { k: V.k, place: V.place, cases: [] };
  for (const o of [{ IN: 1.2, standIn: true }, { IN: 1.2, standIn: false }]) { const a = pick(OLD.planStop(C, A, o)), b = pick(NEW.planStop(C, A, o)); out.cases.push({ same: JSON.stringify(a) === JSON.stringify(b), ref: a, now: b }); }
  return out; };
const res = [];
async function worker(list) { const S = await open();
try { const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' });
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__record?.draw?.stage?.ctx)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load (or no stage)'); await sleep(3000);
  for (const V of list) { const r = await S.ev(`(${RUN.toString()})(${JSON.stringify(V)}, ${DT})`); res.push(r); } }
catch (e) { console.error('cruiserstops: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | ')); await S.close(); }
await Promise.all(Array.from({ length: PAR }, (_, k) => ROWS.filter((_, i) => i % PAR === k)).map(l => worker(l)));
res.sort((a, b) => a.k - b.k); cleanup();
const all = res.flatMap(r => r.cases.map((c, j) => ({ k: r.k, place: r.place, j, ...c }))), diff = all.filter(c => !c.same);
const kinds = {}; for (const c of all) { const k = c.ref.kind || 'none'; kinds[k] = (kinds[k] || 0) + 1; }
for (const d of diff) console.log(`DIFF #${d.k} ${d.place} case ${d.j}: ref ${JSON.stringify(d.ref).slice(0, 200)} · now ${JSON.stringify(d.now).slice(0, 200)}`);
console.log(`cruiserstops vs ${REF}: ${res.length} suspects × 2 calls = ${all.length} plans (${JSON.stringify(kinds)}), the same ${all.length - diff.length}, different ${diff.length}`);
const pass = res.length === ROWS.length && !diff.length; console.log(`cruiserstops: ${pass ? 'PASS' : 'FAIL'}`); process.exit(pass ? 0 : 1);
