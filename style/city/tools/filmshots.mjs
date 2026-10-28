// FILM EMULATION PASS (2026-10-05) · film look shots, frame strips, clips and the film stack's GPU cost, in one headless Chrome.
//   node style/city/tools/filmshots.mjs [--looks a,b] [--views downtown:overhead,strip:night,downtown:street-1] [--out shots/film]
//        [--w 1920 --h 1080] [--clip 36] [--strip <look>] [--bench] [--base http://127.0.0.1:5389/style/city/]
// Per view: the page loads once (?shot=1&view=…; a view ending :night adds &tod=night), then per look: post.look(name), a still
// (<out>/<look>/<view>.jpg), a clip of --clip film frames at 24 fps (api.tick(1/24) per frame: the city moves and the film clock steps
// one film frame) → <look>/<view>.mp4. --strip <look>: six consecutive film frames side by side (strip-<look>-<view>.jpg).
// --bench: per look, the GPU cost of the film stack at the shot size: each post pass rendered 120× from the same input, synced with a
// 1-pixel readPixels (ms per pass; the scene render is not included), with every film section on vs off.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5389/style/city/'), W = +opt('w', 1920), H = +opt('h', 1080), CLIP = +opt('clip', 36), STRIP = opt('strip', null), BENCH = args.includes('--bench');
const LOOKS = opt('looks', 'camcorder-98').split(','), VIEWS = opt('views', 'downtown:overhead,strip:night,downtown:street-1').split(','), OUT = path.resolve(CITY, opt('out', 'shots/film'));
const EXTRA = opt('q', ''), DEBUG = args.includes('--debug');

async function chrome() {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-film-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars',
    '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) throw new Error('chrome did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, ms = 90000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), sleep(ms).then(() => { throw new Error(`timeout ${ms} ms: ${expr.slice(0, 120)}`); })]); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  const kill = () => { try { ch.kill('SIGKILL'); } catch {} }; process.on('exit', kill); process.on('SIGINT', () => { kill(); process.exit(130); }); process.on('SIGALRM', () => { kill(); process.exit(142); });
  return { send, ev, errors, close: async () => { try { ws.close(); } catch {} ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); } };
}
// (the canvas as a data URL, fetched in 1 MB slices: one big CDP message stalls the channel, and captureScreenshot waits forever for a
// compositor frame in a page with no requestAnimationFrame running)
const grab = async (B, format = 'png', quality = 92) => { const n = await B.ev(`(window.__u = __city.renderer.domElement.toDataURL('image/${format}', ${quality / 100})).length`); let u = '';
  for (let k = 0; k < n; k += 1e6) u += await B.ev(`window.__u.slice(${k}, ${k + 1e6})`); await B.ev('window.__u = null, 1'); return Buffer.from(u.split(',')[1], 'base64'); };

const B = await chrome(), report = { when: new Date().toISOString(), w: W, h: H, bench: {}, errors: [] };
try {
  for (const view of VIEWS) {
    const night = view.endsWith(':night') || view.includes('night');
    const url = `${BASE}?shot=1&view=${encodeURIComponent(view)}${night ? '&tod=night' : ''}&w=${W}&h=${H}${EXTRA ? '&' + EXTRA : ''}`, t0 = Date.now();
    await B.send('Page.navigate', { url }); let title = ''; while (Date.now() - t0 < 240000 && title !== 'ready') { await sleep(500); title = await B.ev('document.title').catch(() => ''); }
    if (title !== 'ready') { console.log(`✗ ${view}: not ready in 240 s`); report.errors.push(`${view}: not ready`); continue; }
    console.log(`· ${view} ready (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    for (const look of LOOKS) {
      const dir = path.join(OUT, look), vname = view.replace(/:/g, '-'); await fs.mkdir(dir, { recursive: true });
      if (DEBUG) console.log('  look…'); await B.ev(`__city.post.look(${JSON.stringify(look)}).then(() => 1)`); if (DEBUG) console.log('  tick…'); await B.ev('__city.tick(1 / 24, 2), 1'); if (DEBUG) console.log('  grab…');
      await fs.writeFile(path.join(dir, vname + '.jpg'), await grab(B, 'jpeg', 93));
      if (CLIP > 0) { const fd = await fs.mkdtemp(path.join(os.tmpdir(), 'film-clip-'));
        for (let k = 0; k < CLIP; k++) { await B.ev('__city.tick(1 / 24, 1)'); await fs.writeFile(path.join(fd, `f${String(k).padStart(3, '0')}.jpg`), await grab(B, 'jpeg', 90)); }
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', path.join(fd, 'f%03d.jpg'), '-vf', `scale=${Math.min(W, 1280)}:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-movflags', '+faststart', path.join(dir, vname + '.mp4')]);
        if (STRIP === look) { const sd = path.join(OUT, `strip-${look}-${vname}`); await fs.rm(sd, { recursive: true, force: true }); await fs.mkdir(sd, { recursive: true });
          for (let k = 0; k < 6; k++) await fs.copyFile(path.join(fd, `f${String(k + 12).padStart(3, '0')}.jpg`), path.join(sd, `f${k}.jpg`)); }   // (tools/filmstrip.py lays them out)
        await fs.rm(fd, { recursive: true, force: true }); }
      console.log(`  ✓ ${look} · ${vname}`);
      if (BENCH && !report.bench[look]) report.bench[look] = await B.ev(`__city.post.bench ? __city.post.bench(120) : null`);
    }
  }
} finally { report.errors.push(...B.errors); await B.close(); }
await fs.mkdir(OUT, { recursive: true });
if (BENCH) await fs.writeFile(path.join(OUT, 'bench.json'), JSON.stringify(report, null, 2) + '\n');
console.log(BENCH ? JSON.stringify(report.bench, null, 1) : '', report.errors.length ? '\nerrors:\n' + report.errors.join('\n') : '\nno page errors');
