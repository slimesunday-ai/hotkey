// HUMAN LAYER · a quick look: load the live page, frame a drawn agent, screenshot (dev loop).
//   node style/city/ui/tools/look.mjs [--q 'ui=zine'] [--out file.png] [--open] [--hover] [--w 1280 --h 720]
import { open, sleep } from './cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5332/style/city/'), Q = opt('q', ''), OUT = opt('out', '/tmp/hl-look.png'), W = +opt('w', 1280), H = +opt('h', 720);
const S = await open({ w: W, h: H });
try {
  await S.go(`${BASE}?sim=live&simport=5264${Q ? '&' + Q : ''}`, { until: 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length', ms: 150000 });
  await sleep(2500);
  const info = await S.ev(`(() => { const s = __ui.sim, list = s.agents().map(c => ({ h: c.handle, w: s.where(c.handle) })).filter(x => x.w && x.w.drawn); return { n: s.agents().length, drawn: list.map(x => x.h), first: list[0] || null, err: document.getElementById('err').textContent, mod: document.getElementById('modfail').textContent }; })()`);
  console.log(JSON.stringify(info).slice(0, 800));
  const pick = opt('agent', null) || info.drawn[0];
  if (pick) {
    await S.ev(`(() => { const w = __ui.sim.where(${JSON.stringify(pick)}), c = __city; c.camera.position.set(w.x + 9, w.y + 7, w.z + 11); c.controls.target.set(w.x, w.y + 1, w.z); c.camera.lookAt(c.controls.target); c.controls.update(); return 1; })()`);
    await sleep(1500);
    if (args.includes('--hover') || args.includes('--open')) { const p = await S.ev(`(() => { const p = __ui.city.screenOf(${JSON.stringify(pick)}); return p; })()`); console.log('screen', p);
      if (p) { await S.move((p.x + p.fx) / 2, (p.y + p.fy) / 2); await sleep(400); if (args.includes('--open')) { await S.click((p.x + p.fx) / 2, (p.y + p.fy) / 2); await sleep(2200); } } }
  }
  await S.shot(OUT); console.log('→', OUT, JSON.stringify(await S.ev('__ui.stats()')));
  if (S.errs.length) console.log('errors:', S.errs.slice(0, 5));
} finally { await S.close(); }
