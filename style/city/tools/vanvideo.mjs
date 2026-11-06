// C2-CLEANERS round 3 (2026-11-05) · VANVIDEO: a short clip of the Cleaners' van at work for slime (traffic/cleaners.js), in the record's
// playback (404-A, tv=0, real traffic): the camera onto one of bodyland's landings (--row k: vansweep.mjs's numbering), a body laid there
// (accident.js lay), the job run covered at 0.1 s to the state named (--from guard|drive|gate|out|bag|ready|lift|carry|load|inA|outB|
// mopOut|mop|back|inB|leave, less --lead s), then the page's own loop in real time, its frames read with CDP screenshots (the 3D view:
// tv=0, no UI), cut by 4 % top and bottom, encoded with ffmpeg; stills of the states --stills names.
// LIMITS (slime, 11-04: "limit the ammount of recording"): ≤ 15 s a clip, ≤ 30 fps, CRF 27, the frames on disk only while ffmpeg
// encodes, the Chrome profile removed once Chrome has exited (jaycheck.mjs's way).
//   node style/city/tools/vanvideo.mjs --port <p> --row <k> [--tod day|night] [--from out] [--lead 0] [--secs 15] [--fps 30]
//        [--cam dist,height,angle] [--stills carry,load] --out <file.mp4>
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), SPOTS = +arg('spots', 240), SEED = +arg('seed', 7), PACE = 1, TOD = arg('tod', 'day'), DONE = 400, SPOT = arg('spot', null), AT = arg('at', null), FROM = arg('from', 'bag'), LEAD = +arg('lead', 0), SECS = Math.min(15, +arg('secs', 15)), FPS = Math.min(30, +arg('fps', 30)), OUTF = arg('out', null), STILLS = (arg('stills', '') || '').split(',').filter(Boolean), CAMA = (arg('cam', '13,7,35') || '').split(',').map(Number);
if (!PORT || !OUTF) { console.error('vanvideo: --port <p> --out <file.mp4> --row <k>'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), SHOTS = path.join(ROOT, 'style/city/shots/c2-cleaners');
const W = 1280, H = 720;
// the Chrome profile, removed only once Chrome has exited (jaycheck.mjs's way)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'vanvideo-'));
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  const exited = new Promise(r => ch.once('exit', r)), kill = () => { LIVE.delete(kill); return rmProfile(ch, prof, exited); }; LIVE.add(kill);
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
  if (!port) { await kill(); throw new Error('chrome did not start'); }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning') && /cleaners|accident/i.test(JSON.stringify(m.params.args).slice(0, 2000))) errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, timeout = 600000) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errs, async close() { try { ws.close(); } catch {} await kill(); } };
}

const ROWS = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err && r.body));
const FILM = async (sp, FROM, LEAD, CAMA) => {
  const c = window.__city, A = c.traffic.accidents, CL = A.cleaners; c.pauseLoop(true); c.cover(true); A.GORE.on = false; await CL.prepare(); window.__cc = { c, CL };
  const yaw = sp.yaw, fx = Math.cos(yaw), fz = -Math.sin(yaw), [dist, hgt, ang] = CAMA, a = ang * Math.PI / 180, side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  // (from the kerb side of the body, turned `ang` degrees along the road, aimed between the body and where the van will stand)
  const put = t => { const dx = side[0] * Math.cos(a) - fx * Math.sin(a), dz = side[1] * Math.cos(a) - fz * Math.sin(a); c.controls.target.set(t[0], .8, t[1]); c.camera.position.set(t[0] + dx * dist, hgt, t[1] + dz * dist); c.camera.lookAt(t[0], .8, t[1]); c.controls.update?.(); c.camera.lookAt(t[0], .8, t[1]); };
  put([sp.x, sp.z]); for (let k = 0; k < 400; k++) { c.tick(.1, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) c.tick(.1, 1);
  const K = A.lay(sp.x, sp.z, sp.yaw); if (!K) return { err: 'lay' }; let T = 0, started = false;
  for (; T < 400; T += .1) { c.tick(.1, 1); const C = CL.job; if (C && C.K === K) started = true; if (started && !C) return { err: 'ended before ' + FROM, log: [CL.stats().last?.log, CL.stats().why] };
    if (C && C.ph === FROM && C.t >= Math.max(0, -LEAD)) break; if (!started && T > 4) return { err: 'no job', why: CL.stats().why, ns: CL.stats().lastNoStop }; }
  const C0 = CL.job; if (!C0) return { err: 'no job at ' + FROM }; put([(sp.x + C0.tail[0]) / 2, (sp.z + C0.tail[1]) / 2]); c.cover(false);
  for (let k = 0; k < 20; k++) await new Promise(r => setTimeout(r, 30));
  window.__film = { door: C0.stop.kind + (C0.stop.flip ? ':left' : '') }; return { ok: true, cam: c.camera.position.toArray(), T: C0.T, sp, CAMA };
};
const S = await open(); let code = 1;
try {
  const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' }); if (TOD === 'night') qs.set('tod', 'night');
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.cleaners && window.__record?.draw?.stage?.ctx)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load');
  await sleep(3000); const sp = ROWS[+arg('row', 0)].body;
  const r = await S.ev(`(${FILM.toString()})(${JSON.stringify(sp)}, ${JSON.stringify(FROM)}, ${LEAD}, ${JSON.stringify(CAMA)})`);
  if (r.err) throw new Error(r.err + ' ' + JSON.stringify(r.log || r.why || '')); if (process.argv.includes('--debug')) console.log(JSON.stringify(r));
  // (the page's own loop runs the job now, in real time; its frames are read with CDP's screenshot, at most FPS a second)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanersvideo-frames-')); let nf = 0; const stills = {}, seenS = {};
  // (each frame stepped at 1/FPS s of the page's clock and drawn, then read off the canvas in the same task: the 3D view only)
  try { const n = Math.round(SECS * FPS);
    for (let k = 0; k < n; k++) { const f = await S.ev(`(() => { const c = window.__cc.c; c.cover(false); c.tick(${1 / FPS}, 1); const gl = c.renderer.getContext(), px = new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return { d: c.renderer.domElement.toDataURL('image/jpeg', .85), ph: window.__cc.CL.job?.ph ?? null, px: [...px], cam: c.camera.position.toArray().map(v => +v.toFixed(1)), tg: c.controls.target.toArray().map(v => +v.toFixed(1)), cov: c.covered }; })()`); if (k === 0 && process.argv.includes('--debug')) console.log(JSON.stringify({ px: f.px, cam: f.cam, tg: f.tg, cov: f.cov }));
      if (!f.ph) break; const d = f.d.split(',')[1]; fs.writeFileSync(path.join(dir, String(nf++).padStart(4, '0') + '.jpg'), Buffer.from(d, 'base64')); seenS[f.ph] = (seenS[f.ph] || 0) + 1; if (STILLS.includes(f.ph) && !stills[f.ph] && seenS[f.ph] > FPS * .8) stills[f.ph] = d; }
    const secs = nf / FPS; await S.ev(`(() => { const c = window.__cc.c; c.cover(true); return true; })()`);
    r.stills = stills; r.ph = Object.keys(seenS); r.door = await S.ev('window.__film.door'); r.frames = { length: nf }; r.fps = Math.min(FPS, nf / secs);
    const { execFileSync } = await import('node:child_process'); fs.mkdirSync(path.dirname(path.resolve(OUTF)), { recursive: true });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', r.fps.toFixed(2), '-i', path.join(dir, '%04d.jpg'), '-vf', 'crop=in_w:in_h-2*trunc(in_h*0.04):0:trunc(in_h*0.04),scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '27', '-pix_fmt', 'yuv420p', '-r', '30', OUTF]);
    for (const [k, d] of Object.entries(r.stills)) fs.writeFileSync(OUTF.replace(/\.mp4$/, `-${k}.jpg`), Buffer.from(d, 'base64'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`vanvideo: ${OUTF} · ${r.frames.length} frames at ${r.fps.toFixed(1)} fps (${(r.frames.length / r.fps).toFixed(1)} s) · ${r.door} · states ${r.ph.join(' ')} · stills ${Object.keys(r.stills).join(' ') || '-'}`); code = 0;
} catch (e) { console.error('vanvideo: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); process.exit(code);
