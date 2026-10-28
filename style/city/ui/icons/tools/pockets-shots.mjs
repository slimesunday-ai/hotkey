// HUMAN LAYER · ITEM ICONS · shots of the dossier's Pockets (the icon grid) in the three skins, against a paused replay.
//   node style/city/ui/icons/tools/pockets-shots.mjs [--base http://127.0.0.1:5343/style/city/] [--replay http://127.0.0.1:5272] [--as xXbadvibesXx]
//        [--tape p2p_papi,dialog.box] [--out style/city/shots/human-layer/icons]
// YOURS: ?as=<handle> (your own agent, live). TAPE: the other handles (another agent's pockets, a game day late). Only reads the replay.
import { open, sleep } from '../../tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5343/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5272'), AS = opt('as', 'xXbadvibesXx'), TAPE = opt('tape', 'p2p_papi,dialog.box').split(',').filter(Boolean);
const OUT = opt('out', 'style/city/shots/human-layer/icons'), SKINS = ['clean', '98', 'zine'], W = 1280, H = 800, port = new URL(REPLAY).port;
const READY = 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading';
const skin = s => `(() => { const want = ${JSON.stringify(s)}; for (let k = 0; k < 3 && __ui.skin() !== want; k++) __ui.nextSkin(); return __ui.skin(); })()`;
const S = await open({ w: W, h: H });
try {
  await S.go(`${BASE}?sim=live&simport=${port}&as=${encodeURIComponent(AS)}`, { until: READY, ms: 180000 }); await sleep(5000);
  for (const [h, tag] of [[AS, 'yours'], ...TAPE.map(t => [t, 'tape'])]) {
    await S.ev(`(() => { __ui.dossier.open(${JSON.stringify(h)}); const t = document.getElementById('k-tab-pockets'); t && t.click(); return 1; })()`); await sleep(2500);
    for (const sk of SKINS) { await S.ev(skin(sk)); await sleep(900);
      const r = await S.ev(`(() => { const p = __ui.dossier.el.getBoundingClientRect(); const sc = __ui.dossier.el.querySelector('.k-scroll'); const s = document.querySelector('#k [aria-labelledby="k-tab-pockets"]'); if (sc && s) sc.scrollTop = Math.max(0, s.offsetTop - 120); return { x: p.x, y: p.y, w: p.width, h: p.height, slots: document.querySelectorAll('#k .k-slot').length }; })()`);
      await sleep(300); const f = `${OUT}/pockets-${tag}-${h.replace(/[^\w.-]/g, '_')}-${sk}.png`; await S.shot(f, { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: Math.min(W, r.w + 20), height: Math.min(H - r.y + 10, r.h + 20) }); console.log(' ✓', f, r.slots, 'slots'); }
    await S.ev('(__ui.dossier.close(), 1)'); await sleep(500);
  }
  if (S.errs.length) console.log('page errors:\n  ' + S.errs.slice(0, 8).join('\n  '));
} finally { await S.close(); }
