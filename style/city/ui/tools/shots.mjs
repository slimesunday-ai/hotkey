// HUMAN LAYER · the section 1 contact sheets: the same moments in every skin, from a paused recorded run (simreplay.mjs on --replay).
//   node style/city/ui/tools/shots.mjs [--out style/city/shots/human-layer/s1] [--replay http://127.0.0.1:5264] [--base http://127.0.0.1:5332/style/city/]
//        [--skins clean,98,zine] [--only crowd,pins,pending,asof,yours] [--w 1280 --h 720]
// Moments: crowd (hover label in a crowd) · pins (pins on in a busy street) · pending (dossier, TAPE pending: D1) · asof (dossier, TAPE as of
// a day before: D3) · head (the Head tab, as of) · yours (?as=<handle>: your own agent, YOURS). Then ui/tools/sheet.py lays them out.
// It pauses the replay (/speed?x=0) and seeks it (/seek): run it only against your own replay. It sets the speed back to 1 at the end.
import { open, sleep } from './cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5332/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5264'), OUT = opt('out', 'style/city/shots/human-layer/s1');
const SKINS = opt('skins', 'clean,98,zine').split(','), ONLY = new Set(opt('only', 'crowd,pins,chooser,pending,asof,head,yours').split(',')), W = +opt('w', 1280), H = +opt('h', 720);
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null);
const READY = 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading';

async function page(S, q = '') { await S.go(`${BASE}?sim=live&simport=${port}${q}`, { until: READY, ms: 180000 }); await sleep(6000); }
const inPage = {
  // the drawn player (not a Local) with the most drawn agents within 14 m: { h, n, c: [x, y, z] }
  crowd: `(() => { const s = __ui.sim, L = s.agents().map(c => ({ c, w: s.where(c.handle) })).filter(x => x.w && x.w.drawn && !x.c.retired);
    let best = null; for (const a of L) { if (a.c.npc) continue; const near = L.filter(b => Math.hypot(b.w.x - a.w.x, b.w.z - a.w.z) < 14); if (!best || near.length > best.n) best = { h: a.c.handle, n: near.length, near: near.map(b => b.c.handle), c: [near.reduce((s, b) => s + b.w.x, 0) / near.length, a.w.y, near.reduce((s, b) => s + b.w.z, 0) / near.length] }; }
    return best; })()`,
  frame: (c, back, up, side = .55) => `(() => { const C = __city, [x, y, z] = ${JSON.stringify(c)}; C.cam && C.cam.mode !== 'orbit' && C.cam.toOrbit({ instant: true }); C.controls.target.set(x, y + 1, z); C.camera.position.set(x + ${back} * ${side}, y + ${up}, z + ${back}); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`,
  screen: h => `__ui.city.screenOf(${JSON.stringify(h)})`,
  skin: s => `(() => { const want = ${JSON.stringify(s)}; for (let k = 0; k < 3 && __ui.skin() !== want; k++) __ui.nextSkin(); return __ui.skin(); })()`,
};
async function hoverAt(S, h) { const p = await S.ev(inPage.screen(h)); if (!p) return null; const x = p.x, y = (p.y + p.fy) / 2; await S.move(x, y); await sleep(500); return { x, y }; }
async function openDossier(S, h, tab) {
  await S.ev(`(() => { __ui.dossier.open(${JSON.stringify(h)}); const t = document.getElementById('k-tab-${tab}'); t && t.click(); return 1; })()`); await sleep(2600); }
async function closeAll(S) { await S.ev(`(__ui.dossier.close(), 1)`); await S.move(2, H - 2); await sleep(400); }
async function eachSkin(S, name, fn) { for (const sk of SKINS) { await S.ev(inPage.skin(sk)); await sleep(900); await fn(sk); const f = `${OUT}/${sk}/${name}.png`; await S.shot(f); console.log('  ✓', f); } }

const S = await open({ w: W, h: H });
try {
  let crowd = null;
  if (['crowd', 'pins', 'chooser', 'pending'].some(k => ONLY.has(k))) {
    await R('/seek?t=' + encodeURIComponent('D1 13:00')); await R('/speed?x=0'); await page(S);
    crowd = await S.ev(inPage.crowd); console.log('D1 13:00 crowd', JSON.stringify(crowd));
    if (ONLY.has('crowd')) { await S.ev(inPage.frame(crowd.c, 16, 9)); await sleep(1500); await eachSkin(S, 'crowd-hover', async () => { await hoverAt(S, crowd.h); }); await S.move(2, H - 2); }
    if (ONLY.has('pins')) { await S.ev(inPage.frame(crowd.c, 30, 19, .45)); await sleep(2000); await eachSkin(S, 'pins-street', async () => { await S.move(2, H - 2); await sleep(200); }); }
    if (ONLY.has('chooser')) { await S.ev(inPage.frame(crowd.c, 40, 27, .45)); await sleep(2000); await eachSkin(S, 'crowd-chooser', async () => { await S.ev(`document.querySelector('.k-chooser')?.remove()`);
      const cl = (await S.ev('__ui.city.clusters()'))[0]; if (cl) { await S.click(cl.x, cl.y - 10); await sleep(500); await S.ev(`(() => { const b = document.querySelector('.k-chooser button:nth-of-type(2)'); b && b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); return 1; })()`); await S.move(cl.x + 30, cl.y + 60); await sleep(300); } }); await S.key('Escape', 'Escape', { keyCode: 27 }); }
    if (ONLY.has('pending')) { await S.ev(inPage.frame(crowd.c, 15, 8, .7)); await sleep(1500); await eachSkin(S, 'dossier-pending', async () => { await openDossier(S, crowd.h, 'pockets'); }); await closeAll(S); }
  }
  if (ONLY.has('asof') || ONLY.has('head') || ONLY.has('yours')) {
    await R('/seek?t=' + encodeURIComponent('D3 13:00')); await R('/speed?x=0'); await page(S);
    const c3 = await S.ev(inPage.crowd); console.log('D3 13:00 crowd', JSON.stringify(c3));
    await S.ev(inPage.frame(c3.c, 15, 8, .7)); await sleep(1500);
    if (ONLY.has('asof')) await eachSkin(S, 'dossier-asof', async () => { await openDossier(S, c3.h, 'pockets'); });
    if (ONLY.has('head')) await eachSkin(S, 'dossier-head', async () => { await openDossier(S, c3.h, 'head'); });
    await closeAll(S);
    if (ONLY.has('yours')) { await page(S, '&as=' + encodeURIComponent(c3.h)); await S.ev(inPage.frame(c3.c, 15, 8, .7)); await sleep(2500);
      await eachSkin(S, 'dossier-yours', async () => { await openDossier(S, c3.h, 'pockets'); }); }
  }
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5));
} finally { await R('/speed?x=1'); await S.close(); }
