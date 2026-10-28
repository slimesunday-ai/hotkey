// HUMAN LAYER · SECTION 3b · a quick look at the map (dev loop): load the live page, open the map, run a few steps, screenshot.
//   node style/city/ui/map/tools/maplook.mjs [--base http://127.0.0.1:5337/style/city/] [--simport 5269] [--q 'ui=98'] [--out file.png] [--js '<expr after open>'] [--w 1440 --h 900]
import { open, sleep } from '../../tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5337/style/city/'), PORT = opt('simport', '5269'), Q = opt('q', ''), OUT = opt('out', '/tmp/map-look.png'), W = +opt('w', 1440), H = +opt('h', 900);
const S = await open({ w: W, h: H });
try {
  await S.go(`${BASE}?sim=live&simport=${PORT}${Q ? '&' + Q : ''}`, { until: 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && window.__map && !__city.loading', ms: 180000 });
  await sleep(3000);
  await S.key('KeyB', 'b'); await sleep(1200);
  if (opt('js', null)) { console.log('js →', JSON.stringify(await S.ev(opt('js'))).slice(0, 600)); await sleep(+opt('wait', 1500)); }
  await S.shot(OUT); console.log('→', OUT, JSON.stringify(await S.ev('__map.stats()')));
  if (S.errs.length) console.log('errors:', S.errs.slice(0, 5)); const err = await S.ev(`document.getElementById('err').textContent + document.getElementById('modfail').textContent`); if (err) console.log('page err:', err.slice(0, 600));
  const logs = S.logs.filter(l => /map|error|Error/.test(l)); if (logs.length) console.log('logs:', logs.slice(0, 8));
} finally { await S.close(); }
