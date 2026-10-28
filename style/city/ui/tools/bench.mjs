// HUMAN LAYER · the bench before/after: the city's own ?bench=1 path (bench.js: overview, avenue, side street, stress fly-over) on the
// running page, printed per segment. Run it on the same machine, same size, same query, with and without the UI:
//   node style/city/ui/tools/bench.mjs [--base http://127.0.0.1:5332/style/city/] [--q 'sim=live&simport=5264'] [--w 1280 --h 720] [--runs 2] [--out file.json]
import fs from 'node:fs/promises';
import { open, sleep } from './cdp.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5332/style/city/'), Q = opt('q', 'sim=live&simport=5264'), W = +opt('w', 1280), H = +opt('h', 720), RUNS = +opt('runs', 2), OUT = opt('out', null);
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const all = [];
for (let r = 0; r < RUNS; r++) {
  const S = await open({ w: W, h: H });
  try {
    await S.go(`${BASE}?${Q}&bench=1`, { until: 'window.__bench', ms: 240000 });
    const segs = await S.ev(`__bench.segs.map(s => ({ name: s.name, ft: s.ft, calls: s.calls }))`);
    const ui = await S.ev(`window.__ui ? __ui.stats() : null`).catch(() => null);
    const row = segs.map(s => ({ seg: s.name, p50: +q(s.ft, .5).toFixed(2), p95: +q(s.ft, .95).toFixed(2), worst: +q(s.ft, 1).toFixed(1), calls: q(s.calls, .5), n: s.ft.length }));
    all.push({ run: r, row, ui, errs: S.errs.slice(0, 5) });
    console.log(`run ${r + 1}/${RUNS} · ${Q}`); for (const x of row) console.log(`  ${x.seg.padEnd(16)} p50 ${x.p50.toFixed(2).padStart(6)}  p95 ${x.p95.toFixed(2).padStart(6)}  worst ${x.worst.toFixed(1).padStart(6)} ms · calls ${x.calls} · ${x.n} fr`);
    if (ui) console.log('  ui', JSON.stringify(ui)); if (S.errs.length) console.log('  errors', S.errs.slice(0, 3));
  } finally { await S.close(); await sleep(500); }
}
if (OUT) await fs.writeFile(OUT, JSON.stringify({ when: new Date().toISOString(), base: BASE, q: Q, size: `${W}x${H}`, runs: all }, null, 1));
