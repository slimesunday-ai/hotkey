// CHARACTER AUDIT · a headless Chrome over CDP (the pattern of studio/sweep.mjs). open(url) → { ev(expr, awaitPromise), close() }.
import { spawn } from 'node:child_process'; import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
export async function open(url, { title, timeout = 60000 } = {}) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-chrome-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=800,600', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { ch.kill('SIGKILL'); } catch {} }; for (const sig of ['SIGALRM', 'SIGTERM', 'SIGINT']) process.once(sig, () => { kill(); process.exit(1); }); process.once('exit', kill);
  const close = async () => { try { ch.kill('SIGKILL'); } catch {} await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); };
  try {
    let port = null; for (let t = 0; t < 150 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
    if (!port) throw new Error('chrome did not start');
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map(), errs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    const ev = async (expr, aw = false) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: aw }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed'); return r.result?.result?.value; };
    await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url });
    const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (errs.length) throw new Error('page error: ' + errs[0]); if (await ev('document.title').catch(() => '') === title) break; await sleep(250); }
    if (await ev('document.title') !== title) throw new Error('timeout loading ' + url);
    return { ev, close: async () => { ws.close(); await close(); }, errs };
  } catch (e) { await close(); throw e; }
}
