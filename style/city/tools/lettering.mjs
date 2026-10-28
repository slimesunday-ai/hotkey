// Fidelity pass · THE LETTERING CHECK: does every lettered surface read at the mid tier as it does near? For every text run (a sign, a
// name, a plaque: V.rec) and every piece of wall paint (walls/: ads, murals, tags) in every block a kit builds, vox.js LOD.check compares
// what its face shows at mid with what it shows near, pixel by pixel along its viewer direction: `lost` = pixels of the run showing
// another colour, `bleed` = pixels of the 0.1 ring round it showing the run's colours at mid but not near (ink running into a gap). A
// surface BREAKS when (lost + bleed) / its pixels > --t (0.15). The same numbers for pass 2's mid tier (downVol) are the "before" column.
//   node style/city/tools/lettering.mjs [district …] [--night] [--t 0.15] [--worst 20]
// The page must be served: node style/serve.mjs 5320
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', BASE = process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, T = +opt('t', .15), WORST = +opt('worst', 20), NIGHT = args.includes('--night');
const list = args.filter((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--') && args[k - 1] !== '--night'));
const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-lettering-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=400,338', 'about:blank'], { stdio: 'ignore' });
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; }); let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: `${BASE}?audit=1&report=1&shot=1&blocks=0,0&walk=0&w=400&h=250` });
  for (let t = 0; t < 600 && (await ev('document.title').catch(() => '')) !== 'audit-ready'; t++) await sleep(500);
  const runs = JSON.parse(await ev(`(async () => {
    const J = await import('./jobs.js'), M = await import('./main.js'), { MODS } = await import('./modules.js'), VX = await import('./vox.js'), want = ${JSON.stringify(list)};
    const kits = want.length ? want.map(d => MODS.kits.get(d)).filter(Boolean) : [...MODS.kits.values()], out = [];
    for (const k of kits) for (const [i, j] of M.kitBlocks(k)) { VX.LOD.check = { runs: [] };
      J.jobBlock({ i, j, night: ${NIGHT}, audit: false, chars: false, flags: { neutral: true, pass2: true, faces: true } });
      for (const r of VX.LOD.check.runs) out.push({ d: k.district, b: i + '_' + j, ...r }); }
    VX.LOD.check = null; return JSON.stringify(out); })()`));
  ws.close();
  const ok = runs.filter(r => !r.hidden && r.ink >= 6), err = r => (r.lost + r.bleed) / r.ink, errO = r => (r.lostOld + r.bleedOld) / r.ink, by = {};
  for (const r of ok) { const o = by[r.d + ' ' + r.kind] ??= { n: 0, now: 0, before: 0 }; o.n++; if (err(r) > T) o.now++; if (errO(r) > T) o.before++; }
  let N = 0, B = 0, BO = 0; console.log('district · kind        surfaces   break now   break before');
  for (const [k, o] of Object.entries(by).sort()) { N += o.n; B += o.now; BO += o.before; console.log(`${k.padEnd(22)} ${String(o.n).padStart(8)} ${String(o.now).padStart(11)} ${String(o.before).padStart(14)}`); }
  console.log(`TOTAL ${N} lettered surfaces checked (${runs.filter(r => r.hidden).length} hidden near, ${runs.filter(r => !r.hidden && r.ink < 6).length} under 6 px: not counted) · break now ${B} · before ${BO}`);
  const worst = ok.filter(r => err(r) > T).sort((a, b) => err(b) - err(a)).slice(0, WORST);
  if (worst.length) console.log('worst now:'); for (const r of worst) console.log(`  ${r.d} ${r.b} ${r.kind} "${r.label}" at ${r.at.join(',')} face ${r.f}: ${r.ink} px, lost ${r.lost}, bleed ${r.bleed} (before ${r.lostOld} / ${r.bleedOld})`);
} finally { ch.kill('SIGKILL'); await sleep(200); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
