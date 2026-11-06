// C2-GORE2 (2026-11-04) · GOREVIDEO: records key X's jaywalkers for slime's review (from the orchestrator's 11-04 probe gorevideo.mjs,
// copied into the lane: the playback page, the jaywalker's case, the frames in a temp dir). Key X stages one (traffic/accident.js
// GORE.jay); when its walker starts out the camera comes in close beside it, looking up the road at the car coming; the clip runs from
// 1.5 s before the walker's first step to 7 s after the hit. Frames come from CDP's screencast (their own timestamps), assembled with
// ffmpeg. It changes nothing in the page's code.
//   node style/city/tools/gorevideo.mjs --port <p> [--mode rec1|rec10|live] [--tod day|night] [--hits 3] [--view fitstreet] --out <file.mp4>
// LIMITS (slime, 11-04: "limit the ammount of recording so we dont use up tons of space"): ≤ 30 fps, ≤ 15 s a clip, ≤ 3 clips a run,
// cropped (the page's top bar and the player's controls), CRF 27, the frames on disk only while ffmpeg encodes, the Chrome profile
// removed on every exit
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// LIMITS (slime, 11-04: "limit the ammount of recording so we dont use up tons of space"): ≤ 30 fps, ≤ 15 s a clip (≈ 450 frames, ~70 MB
// in memory), ≤ 3 clips a run, the frames on disk only while ffmpeg encodes (cropped, CRF 27: a few MB a clip), the Chrome profile removed
// on every exit
const MAXCLIPS = 3, MAXS = 15;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), MODE = arg('mode', 'rec1'), TOD = arg('tod', 'day'), N = String(Math.min(MAXCLIPS, +arg('hits', 3))), VIEW = arg('view', 'fitstreet'), OUTF = arg('out', null), W = 1280, H = 720;
if (!PORT || !OUTF) { console.error('gorevideo: --port <p> --out <file.mp4>'); process.exit(2); }
const q = new URLSearchParams(); if (MODE.startsWith('rec')) { q.set('sim', 'record'); q.set('feed', '/core/runs/404-A/feed.jsonl'); q.set('tv', '0'); } if (TOD === 'night') q.set('tod', 'night');
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'gorevideo-'));
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
// the Chrome profile, removed only once Chrome has exited (its 'exit' event, at most 10 s), the removal tried again once if it fails
// (rmSync straight after SIGKILL, while Chrome was still writing, failed silently: 135 profiles, 8.2 GB, the 11-04 disk audit)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const exited = new Promise(r => ch.once('exit', r));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await rmProfile(ch, prof, exited); process.exit(130); });
let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
if (!port) { console.error('gorevideo: chrome did not start'); await rmProfile(ch, prof, exited); process.exit(1); }
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const wait = new Map(); let rec = null; const ring = [];
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === 'Page.screencastFrame') { const f = { t: m.params.metadata.timestamp, data: m.params.data }; ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
    // (at most 30 frames a second kept)
    const buf = rec ?? ring, last = buf.at(-1); if (last && f.t - last.t < 1 / 30) return;
    if (rec) rec.push(f); else { ring.push(f); while (ring.length && f.t - ring[0].t > 1.5) ring.shift(); } } };
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const key = async () => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code: 'KeyX', key: 'x', windowsVirtualKeyCode: 88 }); };
const clips = [];
try {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html${[...q].length ? '?' + q : ''}` });
  for (let t0 = Date.now(); Date.now() - t0 < 150000; await sleep(500)) if (await ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents)`).catch(() => false)) break;
  if (MODE.startsWith('rec')) await ev(`(() => { const s = document.querySelector('#record-player select'); s.value = '${MODE.slice(3) || 1}'; s.dispatchEvent(new Event('change')); return true; })()`);
  await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H });
  for (let k = 0; k < +N; k++) {
    await ev(`(() => { const c = window.__city; if (c.cam?.view) c.cam.view(${JSON.stringify(VIEW)}); else c.setView(${JSON.stringify(VIEW)}); return true; })()`); await sleep(5000);
    const h0 = await ev(`__city.traffic.accidents.stats().hits`); let started = null, hitAt = null;
    for (let tries = 0; tries < 3 && hitAt === null; tries++) { await key(); const t1 = Date.now();
      while (Date.now() - t1 < 62000 && hitAt === null) { await sleep(100);
        const s = await ev(`(() => { const A = __city.traffic.accidents, n = A.now().find(c => c.road && !c.hit); return { hits: A.stats().hits, n }; })()`);
        if (!started && s.n) { started = s.n; rec = [...ring];
          // (in close, over the road: 7 m out from the walker across the road and 7 m down it, 5 m up, looking back at the kerb it goes out
          // from and up the road the car comes along — never over a sidewalk, where the awnings and the trees are)
          // (the first of a few spots, down the road and up it, nearer and further, lower and higher, with a clear line from the lens to
          // the walker and to the road 5 m up from it: a signal head or a lamp post beside the lens filled the frame)
          const [rx, rz] = s.n.dir, [ux, uz] = s.n.lane;
          await ev(`(() => { const c = __city, T = c.THREE, x = ${s.n.x}, z = ${s.n.z}, rx = ${rx}, rz = ${rz}, ux = ${ux}, uz = ${uz}, rc = new T.Raycaster(); rc.camera = c.camera;
            const clear = (p, q) => { const d = q.clone().sub(p), L = d.length(); rc.set(p, d.normalize()); rc.far = L - .8; return !rc.intersectObjects(c.scene.children, true).some(h => h.object.visible !== false && h.distance > .3); };
            const tgt = new T.Vector3(x + rx * 1.5 - ux * 1.5, .8, z + rz * 1.5 - uz * 1.5), up = new T.Vector3(x + rx * 2 - ux * 5, .8, z + rz * 2 - uz * 5), w = new T.Vector3(x, 1, z);
            let pick = null; for (const [al, ac, h] of [[7, 7, 5], [9, 6, 4], [-7, 7, 5], [11, 8, 6], [-9, 6, 4], [6, 5, 3.5], [13, 9, 7], [-12, 8, 6]]) { const p = new T.Vector3(x + rx * ac + ux * al, h, z + rz * ac + uz * al); if (clear(p, w) && clear(p, up)) { pick = p; break; } }
            pick ??= new T.Vector3(x + rx * 7 + ux * 7, 5, z + rz * 7 + uz * 7);
            c.camera.position.copy(pick); c.camera.fov = 55; c.camera.updateProjectionMatrix(); c.controls.target.copy(tgt); c.controls.update(); return true; })()`); }
        // (at most 8 s before the hit: a slow case kept every frame)
        if (rec) { const cap = hitAt === null ? 8 : MAXS; while (rec.length > 1 && rec.at(-1).t - rec[0].t > cap) rec.shift(); }
        if (s.hits > h0) hitAt = Date.now(); else if (started && !(await ev(`__city.traffic.accidents.now().some(c => c.road)`))) { started = null; rec = null; } } }
    if (hitAt === null) { console.log(`hit ${k + 1}: none`); rec = null; continue; }
    await sleep(7000); const fr = rec; rec = null; clips.push(fr); console.log(`hit ${k + 1}: ${fr.length} frames, ${(fr.at(-1).t - fr[0].t).toFixed(1)} s`);
  }
  await send('Page.stopScreencast');
} catch (e) { console.log('error', e.message); }
try { ws.close(); } catch {} await rmProfile(ch, prof, exited);
if (!clips.length) process.exit(1);
// frames → files and a concat list with each frame's own duration; one title card's worth of black between clips
const FD = fs.mkdtempSync(path.join(os.tmpdir(), 'gorevideo-frames-')); let list = '', n = 0;
for (const fr of clips) { for (let i = 0; i < fr.length; i++) { const f = path.join(FD, `f${String(n++).padStart(5, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(fr[i].data, 'base64')); const d = i + 1 < fr.length ? Math.min(.25, Math.max(.005, fr[i + 1].t - fr[i].t)) : .6; list += `file '${f}'\nduration ${d.toFixed(4)}\n`; } }
list += `file '${path.join(FD, `f${String(n - 1).padStart(5, '0')}.jpg`)}'\n`; fs.writeFileSync(path.join(FD, 'list.txt'), list);
try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(FD, 'list.txt'), '-vf', 'crop=1280:496:0:60,fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', path.resolve(OUTF)]);
} finally { fs.rmSync(FD, { recursive: true, force: true }); }
console.log('wrote', path.resolve(OUTF), (fs.statSync(path.resolve(OUTF)).size / 1e6).toFixed(2), 'MB');
