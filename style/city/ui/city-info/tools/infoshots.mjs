// HUMAN LAYER · SECTION 3a · the shots: the ticker + clock (LIVE and TAPE), City TV, every board tab, one board in the three skins, and
// the bar close up in the three skins. From a PAUSED recorded run (simreplay.mjs: /speed?x=0, /seek): run it only against your own replay.
//   node style/city/ui/city-info/tools/infoshots.mjs [--out <png dir>] [--replay http://127.0.0.1:5268] [--base http://127.0.0.1:5336/style/city/]
//   then python3 style/city/ui/city-info/tools/infosheet.py <png dir> style/city/shots/human-layer/s3
import { open, sleep } from '../../tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5336/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5268'), OUT = opt('out', '/tmp/info-shots'), AT = opt('at', 'D4 12:00');
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null);
const READY = 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading && window.__cityinfo';
const skin = s => `(() => { for (let k = 0; k < 3 && __ui.skin() !== ${JSON.stringify(s)}; k++) __ui.nextSkin(); return __ui.skin(); })()`;
const tab = id => `(async () => { if (__cityinfo.open !== 'city') await __cityinfo.show('city'); await new Promise(r => setTimeout(r, 300)); __cityinfo.sheets.city.ui.select(${JSON.stringify(id)}); document.querySelector('.ci-sheet-city .k-scroll').scrollTop = 0; return 1; })()`;
// a quiet frame of the city: the overview of downtown
const frame = `(() => { const C = __city; C.cam && C.cam.mode !== 'orbit' && C.cam.toOrbit({ instant: true }); C.controls.target.set(20, 0, -10); C.camera.position.set(110, 95, 120); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`;
async function shot(S, name, clip) { const f = `${OUT}/${name}.png`; await S.shot(f, clip); console.log('  ✓', f); }
const S = await open({ w: 1280, h: 720 });
try {
  await R('/seek?t=' + encodeURIComponent(AT)); await R('/speed?x=0');
  await S.go(`${BASE}?sim=live&simport=${port}&ui=clean`, { until: READY, ms: 180000 }); await S.ev(frame); await sleep(7000);
  // LIVE: the ticker, City TV, every tab
  await shot(S, 'live-ticker');
  await S.ev(`(__cityinfo.show('tv'), 1)`); await sleep(2500);
  const cards = await S.ev(`__cityinfo.sheets.tv.ui.cards.map(c => c.type)`); console.log('cards', cards.join(' '));
  const pick = t => Math.max(0, cards.indexOf(t));
  await S.ev(`(__cityinfo.sheets.tv.ui.show(${pick('story')}), 1)`); await sleep(700); await shot(S, 'live-tv-story');
  await S.ev(`(__cityinfo.sheets.tv.ui.show(${pick('top')}), 1)`); await sleep(700); await shot(S, 'live-tv-top');
  if (cards.includes('drop')) { await S.ev(`(__cityinfo.sheets.tv.ui.show(${pick('drop')}), 1)`); await sleep(700); await shot(S, 'live-tv-drop'); }
  await S.ev(`document.querySelector('.ci-sheet-tv .k-scroll').scrollTop = 400`); await sleep(400); await shot(S, 'live-tv-lists');
  for (const id of ['ladders', 'turf', 'economy', 'crime', 'dead']) { await S.ev(tab(id)); await sleep(2600); await shot(S, 'live-' + id); }
  await S.ev(tab('ladders')); await sleep(1500); await S.ev(`document.querySelector('.ci-sheet-city .k-scroll').scrollTop = 99999`); await sleep(500); await shot(S, 'live-ladders-richest');
  await S.ev(tab('economy')); await sleep(2500); await S.ev(`document.querySelector('.ci-sheet-city .k-scroll').scrollTop = 99999`); await sleep(500); await shot(S, 'live-economy-money');
  // the three skins: one board (Ladders) and the bar close up
  for (const sk of ['clean', '98', 'zine']) { await S.ev(skin(sk)); await S.ev(tab('ladders')); await sleep(2500); await shot(S, 'skin-ladders-' + sk);
    await S.ev(`(__cityinfo.close(), 1)`); await sleep(1200); await shot(S, 'skin-bar-' + sk, { x: 0, y: 600, width: 1280, height: 120 }); }
  await S.ev(skin('clean')); await sleep(800);
  // TAPE: the ticker under the transport, City TV and a board as of the tape time
  await S.ev(`(__ui.tape.open({}), 1)`); await sleep(9000); await shot(S, 'tape-ticker');
  await S.ev(`(__cityinfo.show('tv'), 1)`); await sleep(2500); await shot(S, 'tape-tv');
  await S.ev(tab('ladders')); await sleep(3000); await shot(S, 'tape-ladders');
  await S.ev(tab('crime')); await sleep(3000); await shot(S, 'tape-crime');
  console.log(JSON.stringify(await S.ev('__cityinfo.stats()')));
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5));
} finally { await R('/speed?x=1'); await S.close(); }
