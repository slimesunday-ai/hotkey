// TRAIT STUDIO · the headless gate: loads the studio in headless Chrome (the page server must be up), checks the console is clean,
// then runs window.__sweep(): every trait, in every colourway, worn on the stage, baked (walk v2 segments), animated in idle,
// walk-in-place, circle and the check-phone idle (grip), drawn, its GL error flag read, and its thumbnail built. Also times the
// trait switch (bake + batch + draw + GPU finish) and the interactive page's lazy thumbnails.
//   node style/city/studio/sweep.mjs [--quick]        (exit 1 on any failure)
import { spawn } from 'node:child_process'; import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
const BASE = process.env.STUDIO_URL || 'http://127.0.0.1:5320/style/city/studio/', CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-sweep-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
let code = 1;
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) throw new Error('chrome did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map(), consoleErr = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') consoleErr.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) consoleErr.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    if (m.method === 'Log.entryAdded' && (m.params.entry.level === 'error')) consoleErr.push('log: ' + m.params.entry.text.slice(0, 200) + ' ' + (m.params.entry.url || '')); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, await_ = false) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: await_ }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed'); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return true; await sleep(250); } throw new Error('timeout: ' + what); };
  // 1 · the interactive page: loads clean, the visible thumbnails render lazily, a click switches under the budget
  await send('Page.navigate', { url: BASE + '?mode=tread' });
  await until(() => ev('document.title === "Trait Studio" && !!window.__studio'), 60000, 'page load');
  const t0 = Date.now(); await until(() => ev('window.__studio.thumbStats.rendered + window.__studio.thumbStats.fromDisk >= 12'), 60000, 'first thumbnails');
  const firstThumbs = Date.now() - t0; await sleep(2500);
  const ui = await ev(`(() => { const s = window.__studio, it = s.items(), t = []; for (let k = 0; k < 24; k++) { const c = document.querySelectorAll('#grid .card')[(k * 7) % it.length]; const a = performance.now(); c.click(); t.push(performance.now() - a); }
    t.sort((a, b) => a - b); return { cards: it.length, catalog: s.CAT.length, thumbs: s.thumbStats, clickMs: { p50: +t[12].toFixed(1), max: +t[23].toFixed(1) }, errors: window.__errors.length }; })()`);
  console.log(`1 · page: ${ui.catalog} traits, ${ui.cards} cards · first 12 thumbnails in ${firstThumbs} ms · ${ui.thumbs.rendered} rendered (${(ui.thumbs.ms / Math.max(1, ui.thumbs.rendered)).toFixed(1)} ms each), ${ui.thumbs.fromDisk} from cache · click → worn: p50 ${ui.clickMs.p50} ms, max ${ui.clickMs.max} ms`);
  // reload: the thumbnails come back from the IndexedDB cache
  await send('Page.reload'); await until(() => ev('document.title === "Trait Studio" && !!window.__studio'), 60000, 'reload');
  await until(() => ev('window.__studio.thumbStats.fromDisk + window.__studio.thumbStats.rendered >= 12'), 30000, 'cached thumbnails'); await sleep(800);
  const cached = await ev('window.__studio.thumbStats'); console.log(`  reload: ${cached.fromDisk} thumbnails from the cache, ${cached.rendered} rendered`);
  // 2 · the sweep (its own page: no frame loop)
  await send('Page.navigate', { url: BASE + '?sweep=1' }); await until(() => ev('document.title === "sweep-ready"'), 60000, 'sweep page');
  const r = await ev(`window.__sweep({ thumbs: ${!process.argv.includes('--quick')} })`, true);
  console.log(`2 · sweep: ${r.traits} traits, ${r.variants} trait × colourway variants worn, baked, animated (idle · walk in place · circle · phone grip) and drawn; ${r.thumbs} thumbnails built`);
  console.log(`  switch (bake + batch + draw + GPU finish): p50 ${r.switchMs.p50} ms · p95 ${r.switchMs.p95} ms · max ${r.switchMs.max} ms · GL errors ${r.glErrors}`);
  for (const f of r.fail.slice(0, 20)) console.log('  ✗ ' + f);
  const errs = [...new Set(consoleErr)]; console.log(`3 · console: ${errs.length ? errs.length + ' error(s)' : 'clean'}`); for (const e of errs.slice(0, 10)) console.log('  ✗ ' + e);
  const ok = !r.fail.length && !errs.length && !ui.errors && r.switchMs.p95 < 150;
  console.log(ok ? `\nSWEEP OK: ${r.traits} traits / ${r.variants} variants, 0 errors` : '\nSWEEP FAILED'); code = ok ? 0 : 1; ws.close();
} catch (e) { console.log('SWEEP FAILED: ' + (e.stack || e)); }
finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
process.exit(code);
