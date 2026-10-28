// Pass 1d · debugging aid: open a page in headless Chrome, wait until its title says it is done, print the console and errors.
//   node style/city/tools/probe.mjs "<url>" [seconds=90] [expression]
// Shots for the record still come from style/shoot.sh; this only tells you why a page is slow or blank.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const [url, secs = '90', expr = ''] = process.argv.slice(2), sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-probe-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=1600,1088', 'about:blank'], { stdio: 'ignore' });
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; }); let id = 0; const wait = new Map(), t0 = Date.now();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m.params.type}:`, m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400));
    if (m.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url });
  let title = '';
  while (Date.now() - t0 < +secs * 1000) { await sleep(1000); title = (await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result?.result?.value || '';
    if (/^(ready|audit-ready|AI City · live|bench done)$/.test(title)) break; }
  console.log(`title after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${title}`);
  if (expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); console.log(r.result?.result?.value ?? JSON.stringify(r.result).slice(0, 400)); }
  ws.close();
} finally { ch.kill('SIGKILL'); await sleep(200); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
