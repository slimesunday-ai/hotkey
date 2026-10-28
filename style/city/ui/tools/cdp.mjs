// HUMAN LAYER · a tiny headless-Chrome driver (raw CDP, as the city's other tools: smoke.mjs, flythrough.mjs). No puppeteer.
//   const S = await open({ w: 1280, h: 720 }); await S.go(url); await S.ev('1+1'); await S.shot('a.png'); await S.close();
// Page.captureScreenshot grabs the composited page: the WebGL canvas AND the DOM overlay (the UI kit), which a canvas grab would miss.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function open({ w = 1280, h = 720, dpr = 1 } = {}) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-hl-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars',
    '--remote-debugging-port=0', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) { ch.kill('SIGKILL'); throw new Error('chrome did not start'); }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errs = [], logs = [], frames = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    if (m.method === 'Page.screencastFrame') { frames.push({ data: m.params.data, t: m.params.metadata.timestamp }); send('Page.screencastFrameAck', { sessionId: m.params.sessionId }); } };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, ms = 120000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), sleep(ms).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error('timed out: ' + expr.slice(0, 100)); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  const S = {
    send, ev, errs, logs, frames,
    async go(url, { until = 'window.__city && __city.marks.full', ms = 120000 } = {}) { await send('Page.navigate', { url }); const t0 = Date.now();
      while (Date.now() - t0 < ms) { await sleep(250); const ok = await ev(`!!(${until})`).catch(() => false); if (ok) return Date.now() - t0; } throw new Error('page never got ready: ' + until); },
    async shot(file, clip) { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; },
    async mouse(type, x, y, button = 'none', clickCount = 0) { await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, buttons: button === 'left' && type === 'mousePressed' ? 1 : 0 }); },
    async move(x, y) { await S.mouse('mouseMoved', x, y); },
    async click(x, y) { await S.mouse('mouseMoved', x, y); await S.mouse('mousePressed', x, y, 'left', 1); await sleep(40); await S.mouse('mouseReleased', x, y, 'left', 1); },
    async key(code, key = code, opts = {}) { const kc = opts.keyCode ?? 0; await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: kc, ...opts }); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: kc, ...opts }); },
    async cast(on, { quality = 70, every = 1 } = {}) { if (on) { frames.length = 0; await send('Page.startScreencast', { format: 'jpeg', quality, everyNthFrame: every }); } else await send('Page.stopScreencast'); },
    async close() { try { ws.close(); } catch {} ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); },
  };
  return S;
}
