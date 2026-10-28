// MOVEMENT W3b · quick looks at the carriage: ?subway=1 at a few moments of the demo ride → JPGs (dev tool)
//   node style/city/subway/tools/look.mjs [--base http://127.0.0.1:5351/style/city/] [--out <dir>] [--at 2,14,22,40] [--q "&from=trailer&to=docks"]
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../ui/tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5351/style/city/'), OUT = path.resolve(opt('out', '/tmp/sbw')), ATS = opt('at', '2,14,22,40').split(',').map(Number), XQ = opt('q', '');
const W = +opt('w', 1280), H = +opt('h', 720);
await fs.mkdir(OUT, { recursive: true });
const S = await open({ w: W, h: H });
try {
  for (const at of ATS) {
    await S.go(`${BASE}?subway=1&peds=0&cars=0&speed=0.0001&at=${at}${XQ}`, { until: "document.querySelector('.sbw') && window.__city && __city.subway && __city.subway.open", ms: 240000 });
    await sleep(+opt('wait', 3500));
    const st = await S.ev('JSON.stringify(__city.subway.open.state())'); console.log(at, st);
    const f = path.join(OUT, `at-${String(at).padStart(3, '0')}.png`); await S.shot(f); execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', f, '--out', f.replace('.png', '.jpg')], { stdio: 'ignore' }); await fs.rm(f);
  }
  if (S.errs.length) console.log('ERRORS', S.errs.slice(0, 5));
} finally { await S.close(); }
