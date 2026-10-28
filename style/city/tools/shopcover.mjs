// Hardening (2026-10-05) · SHOP-WINDOW COVERAGE: every shop window the city draws, and whether a stocked room stands behind it.
// Builds every block a kit builds (the woods and the sea skipped: no shops) in headless Chrome with interiors/store/fill.js FIT.fronts
// on: each generated shopfront (signage/shop.js), each Gatehill display niche (districts/estates/shops.js) and each kit window
// (fill.js fitWindow) reports { where, room, w, x, z }. Prints the windows with no room, by district and kind.
//   node style/city/tools/shopcover.mjs [--out <label>] [--vs <label>] [--district a,b] [--list]
// The page must be served: node style/serve.mjs <port>; CITY_URL=http://127.0.0.1:<port>/style/city/
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), RUNS = path.join(HERE, 'runs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', BASE = process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/';
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-shops-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=400,300', 'about:blank'], { stdio: 'ignore' });
let data;
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) throw new Error('chrome did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const k = ++id; wait.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable'); await send('Page.navigate', { url: `${BASE}?audit=1&report=1&shot=1&blocks=0,0&walk=0&w=400&h=300` });
  const t0 = Date.now(); let title = '';
  while (Date.now() - t0 < 300000) { await sleep(1000); const r = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }); title = r.result?.result?.value || ''; if (title.startsWith('audit-ready')) break; }
  if (!title.startsWith('audit-ready')) throw new Error('page did not finish: ' + title);
  const only = opt('district') ? JSON.stringify(opt('district').split(',')) : 'null';
  const expr = `(async () => { const J = await import('./jobs.js'), F = await import('./interiors/store/fill.js'), M = await import('./main.js'), Mo = await import('./modules.js');
    const only = ${only}, skip = new Set(['forest', 'sea']);
    const list = M.worldBlocks().filter(([i, j]) => Mo.buildsBlock(i, j) && !skip.has(Mo.kitFor(i, j).district) && (!only || only.includes(Mo.kitFor(i, j).district)));
    const out = [], errs = [], t = performance.now(); F.FIT.fronts = []; const r0 = F.FIT.rooms, o0 = F.FIT.objects;
    for (const [i, j] of list) { const n0 = F.FIT.fronts.length, d = Mo.kitFor(i, j).district;
      try { const res = J.jobBlock({ i, j, night: false, audit: false, chars: false }); if (res.errors?.length) errs.push(...res.errors.map(e => i + '_' + j + ' ' + e.error)); } catch (e) { errs.push(i + '_' + j + ' ' + e); }
      for (const f of F.FIT.fronts.slice(n0)) out.push({ ...f, blk: i + '_' + j, district: d }); }
    F.FIT.fronts = null; return JSON.stringify({ blocks: list.length, ms: Math.round(performance.now() - t), rooms: F.FIT.rooms - r0, objects: F.FIT.objects - o0, fronts: out, errors: errs.slice(0, 20) }); })()`;
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 1500000 });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  data = JSON.parse(r.result.result.value); ws.close();
} finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }

const F = data.fronts, miss = F.filter(f => !f.room), by = (L, k) => L.reduce((m, f) => (m[f[k]] = (m[f[k]] || 0) + 1, m), {});
console.log(`${data.blocks} blocks in ${(data.ms / 1000).toFixed(1)} s · ${F.length} shop windows · ${F.length - miss.length} with a room · ${miss.length} WITHOUT · rooms built ${data.rooms}, objects ${data.objects}`);
const dist = [...new Set(F.map(f => f.district))].sort();
for (const d of dist) { const a = F.filter(f => f.district === d), m = a.filter(f => !f.room); console.log(`  ${d.padEnd(10)} ${String(a.length).padStart(4)} windows · ${String(m.length).padStart(4)} without  ${JSON.stringify(by(m, 'where'))}`); }
if (argv.includes('--list')) for (const f of miss) console.log(`    ${f.district} ${f.blk} ${f.where} w=${f.w} at ${f.x},${f.z} ${f.side}`);
if (data.errors.length) console.log('errors:', data.errors.join('\n  '));
const label = opt('out'); if (label) { await fs.mkdir(RUNS, { recursive: true }); await fs.writeFile(path.join(RUNS, label + '.shops.json'), JSON.stringify(data)); console.log('→ tools/runs/' + label + '.shops.json'); }
const vs = opt('vs'); if (vs) { const B = JSON.parse(await fs.readFile(path.join(RUNS, vs + '.shops.json'), 'utf8')), bm = B.fronts.filter(f => !f.room).length;
  console.log(`vs ${vs}: windows ${B.fronts.length} → ${F.length} · without a room ${bm} → ${miss.length}`); }
