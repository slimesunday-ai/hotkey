// UI STYLE LAB · headless shots: every style's 1280 x 720 stage (index.html?shot=<id>) as a JPG, in one headless Chrome.
//   node style/city/ui/stylelab/shoot.mjs --base http://127.0.0.1:5345/ --out <dir> [--bg street|night|calm] [--round 1|2] [--only id,id] [--page]
// --page also shoots the curation page itself (grid + one full view). Then sheet.py makes the labelled contact sheet.
import { spawn } from 'node:child_process'; import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { STYLES } from './styles.js';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5345/'), OUT = path.resolve(opt('out', 'stylelab-shots')), BG = opt('bg', 'street'), ONLY = opt('only', null)?.split(','), ROUND = opt('round', null);
const LAB = new URL('style/city/ui/stylelab/', BASE).href;

const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'stylelab-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--remote-debugging-port=0', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
const kill = () => { try { ch.kill('SIGKILL'); } catch {} }; process.on('exit', kill);
let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
if (!port) throw new Error('chrome did not start');
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const wait = new Map(), errors = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300)); };
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
async function go(url, ready) { await send('Page.navigate', { url }); for (let t = 0; t < 150; t++) { await sleep(100); if (await ev(ready)) return true; } console.warn('not ready: ' + url); return false; }
async function shot(file, clip) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: !!clip });
  await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); }

await fs.mkdir(OUT, { recursive: true });
await size(1280, 720);
const shot_ = [];
for (const s of STYLES) { if (ONLY && !ONLY.includes(s.id)) continue; if (ROUND && String(s.round || 1) !== ROUND) continue; shot_.push(s);
  await go(`${LAB}?shot=${s.id}&bg=${BG}`, `document.title === 'ready'`); await sleep(250); await shot(path.join(OUT, `${s.id}.jpg`)); process.stdout.write(s.id + ' '); }
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ bg: BG, styles: shot_ }, null, 1));   // (sheet.py reads it)
if (args.includes('--page')) {
  await size(1440, 900); await go(LAB + (ROUND ? '?round=' + ROUND : ''), `!!document.querySelector('.card .mk') && document.fonts.status === 'loaded'`); await sleep(800); await shot(path.join(OUT, '_page-grid.jpg'));
  await go(LAB + '?style=' + (opt('view', shot_[0]?.id || 'clean')), `!!document.querySelector('#vstage .mk') && document.fonts.status === 'loaded'`); await sleep(800); await shot(path.join(OUT, '_page-view.jpg'));
}
console.log('\n' + (errors.length ? 'errors:\n' + errors.join('\n') : 'no page errors'));
ws.close(); kill(); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {});
