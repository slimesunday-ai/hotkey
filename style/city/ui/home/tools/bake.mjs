// HUMAN LAYER · HOME · bakes the dossier's Mainland house pictures (the ?mainland=demo mock): every built Mainland plot, framed from its
// street the way the Mainland's own VISIT frames it (mainland/builder.js visit), the UI hidden, cropped to the house, saved small as JPG.
//   node style/city/ui/home/tools/bake.mjs [--base http://127.0.0.1:5347/] [--only ML-001,ML-002]
// Needs the style server running (node style/serve.mjs <port>). Outputs style/city/ui/home/img/<plot>.jpg (~10 KB each; JPG: *.png is ignored).
import { execFileSync } from 'node:child_process'; import fs from 'node:fs/promises'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { open, sleep } from '../../tools/cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.resolve(HERE, '../img'), args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5347/'), PLAN = JSON.parse(await fs.readFile(path.resolve(HERE, '../../../mainland/plots.json'), 'utf8'));
const ids = opt('only', null)?.split(',') ?? PLAN.plots.filter(p => p.status === 'built').map(p => p.id);
await fs.mkdir(OUT, { recursive: true });
const W = 960, H = 600, S = await open({ w: W, h: H });
try {
  await S.go(new URL('style/city/mainland/index.html?nolock=1', BASE).href, { until: 'window.__ready && window.__mlb', ms: 240000 }); await sleep(4000);
  for (const id of ids) {
    await S.ev(`(__mlb.visit(${JSON.stringify(id)}), 1)`); await sleep(2600);
    await S.ev(`(() => { for (const el of document.querySelectorAll('body > *:not(#stage)')) if (el.tagName !== 'SCRIPT') el.style.visibility = 'hidden'; return 1; })()`); await sleep(400);
    const png = path.join(OUT, id + '.png'), jpg = path.join(OUT, id + '.jpg');
    await S.shot(png, { x: 120, y: 60, width: 640, height: 400 });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '-Z', '280', png, '--out', jpg], { stdio: 'ignore' }); await fs.rm(png);
    await S.ev(`(() => { for (const el of document.querySelectorAll('body > *:not(#stage)')) el.style.visibility = ''; return 1; })()`);
    console.log('✓', jpg);
  }
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 4));
} finally { await S.close(); }
