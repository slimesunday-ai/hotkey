// Cleanup pass · FIRST-VIEW TIMES per view, cold and cached (the load budget: first view ≲ 2 s cold, ≲ 1 s cached).
//   node style/city/tools/loadtime.mjs [view …] [--q medium] [--w 1920 --h 1080] [--runs 1] [--out <label>]
// Views: overview (the default camera) or <district>:overhead | street-1 | … (any ?view= key). With no views: the default view and
// every loaded kit's overhead. Per view: a fresh Chrome profile loads the page with an empty block cache (cold: every block is built
// by the workers), waits until it is fully streamed and the cache writes have drained, then reloads (cached: IndexedDB).
// Prints first view / fully streamed (seconds from navigation start), draw calls and tiers; --out saves tools/runs/<label>.load.json.
// The page must be served: node style/serve.mjs 5320
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), RUNS = path.join(HERE, 'runs'), BASE = process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080), Q = opt('q', 'medium'), RUNS_N = +opt('runs', 1), extra = opt('extra', '');
let views = args.filter((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--')));
if (!views.length) views = ['overview', 'downtown:overhead', 'strip:overhead', 'industrial:overhead', 'docks:overhead', 'junkyard:overhead', 'trailer:overhead', 'mall:overhead', 'suburbs:overhead'];

async function session(fn) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-load-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', `--window-size=${W},${H + 88}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
    if (!port) throw new Error('chrome did not start');
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map(), logs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
      if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value ?? a.description).join(' ')); if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300)); };
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
    await send('Runtime.enable'); await send('Page.enable');
    try { return await fn({ send, ev, logs }); } finally { ws.close(); }
  } finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
}
// load a URL, wait for the first view and full streaming (max 60 s), return the page's own marks
async function load(S, url) {
  S.logs.length = 0; await S.send('Page.navigate', { url }); const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < 60000) { await sleep(150); r = await S.ev(`(() => { const c = window.__city; if (!c) return null; const m = c.marks; return { first: m.first ?? null, full: m.full ?? null, workers: m.workers ?? null, err: document.getElementById('err')?.textContent || '', mod: document.getElementById('modfail')?.textContent || '' }; })()`).catch(() => null);
    if (r?.err) break; if (r?.full) break; }
  const d = await S.ev(`(() => { const c = window.__city; if (!c) return null; const k = c.stream.counts(); return { calls: c.info.render.calls, tris: +(c.info.render.triangles / 1e6).toFixed(2), tiers: [k.full, k.mid, k.far].join('/'), jobs: { ...c.stream.stat }, cache: { ...c.cache().stats }, peds: c.peds?.stats?.() || null }; })()`).catch(() => null);
  return { ...(r || {}), ...(d || {}), logs: S.logs.filter(l => /first view|fully streamed|failed|error|EXC/i.test(l)).slice(0, 8) };
}
const f2 = v => v === null || v === undefined ? '  –  ' : (v / 1000).toFixed(2);
const out = { when: new Date().toISOString(), q: Q, size: `${W}x${H}`, views: {} };
for (const v of views) for (let n = 0; n < RUNS_N; n++) {
  const url = `${BASE}?view=${encodeURIComponent(v)}&q=${Q}&w=${W}&h=${H}&nodyn=1${extra ? '&' + extra : ''}`;
  const res = await session(async S => { const cold = await load(S, url);
    // the cache writes drain one per frame after the stream settles: wait until they stop (max 30 s) so the reload is a cached load
    let last = -1, same = 0; for (let t = 0; t < 60 && same < 3; t++) { await sleep(500); const p = await S.ev('window.__city?.cache().stats.puts ?? -1').catch(() => -1); same = p === last ? same + 1 : 0; last = p; }
    const warm = await load(S, url); return { cold, warm }; });
  (out.views[v] ??= []).push(res);
  const { cold: c, warm: w } = res;
  console.log(`${v.padEnd(22)} cold first ${f2(c.first)} s · full ${f2(c.full)} s · ${c.calls ?? '?'} calls · tiers ${c.tiers ?? '?'} · jobs ${c.jobs ? c.jobs.jobsFar + ' far / ' + c.jobs.jobsBlock + ' block' : '?'}   ||   cached first ${f2(w.first)} s · full ${f2(w.full)} s · idb ${w.jobs?.idb ?? '?'} · jobs ${w.jobs ? w.jobs.jobsFar + '/' + w.jobs.jobsBlock : '?'}${c.err || w.err ? '  ERR ' + (c.err || w.err).slice(0, 200) : ''}${c.mod ? '  MOD ' + c.mod.slice(0, 200) : ''}`);
}
if (opt('out')) { await fs.mkdir(RUNS, { recursive: true }); await fs.writeFile(path.join(RUNS, opt('out') + '.load.json'), JSON.stringify(out, null, 1)); console.log('saved tools/runs/' + opt('out') + '.load.json'); }
