// HUMAN LAYER · SECTION 4 · the menu's shots: the bar in the three skins, People (all, searched, filtered), a hovered row with its beacon,
// Where's the action (twice: the newest, then the one before), Settings — and the clip: / → type a name → Enter → the camera flies and
// follows, the dossier opens. Against YOUR OWN replay (it pauses and seeks it, and sets the speed back to 1 at the end).
//   node style/city/ui/menu/tools/shots.mjs [--base http://127.0.0.1:5339/style/city/] [--replay http://127.0.0.1:5271] [--at "D4 16:40"]
//        [--out style/city/shots/human-layer/menu] [--only shots,clip] [--w 1440 --h 900]
// Then: python3 style/city/ui/menu/tools/sheet.py <out> (the contact sheet). Shots are JPEG (the committed set stays small).
import { open, sleep } from '../../tools/cdp.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5339/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5271'), OUT = path.resolve(opt('out', 'style/city/shots/human-layer/menu')), AT = opt('at', 'D4 16:40');   // (absolute: ffmpeg's concat list resolves relative names against its own folder)
const W = +opt('w', 1440), H = +opt('h', 900), ONLY = new Set(opt('only', 'shots,clip').split(','));
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null);
const READY = 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading && __ui.menu';
const KEYS = { slash: ['Slash', '/', 191], period: ['Period', '.', 190], comma: ['Comma', ',', 188], back: ['Backquote', '`', 192], esc: ['Escape', 'Escape', 27], enter: ['Enter', 'Enter', 13], down: ['ArrowDown', 'ArrowDown', 40] };
const key = (S, k) => S.key(KEYS[k][0], KEYS[k][1], { keyCode: KEYS[k][2] });
const type = async (S, text, gap = 110) => { for (const ch of text) { await S.send('Input.insertText', { text: ch }); await sleep(gap); } };
async function shot(S, name) { const r = await S.send('Page.captureScreenshot', { format: 'jpeg', quality: 86 }); const f = path.join(OUT, name + '.jpg'); await fs.writeFile(f, Buffer.from(r.result.data, 'base64')); console.log('  ✓', f); return f; }
const skin = s => `(() => { for (let k = 0; k < 3 && __ui.skin() !== ${JSON.stringify(s)}; k++) __ui.nextSkin(); return __ui.skin(); })()`;
// a busy street: the drawn player with the most drawn agents within 22 m; framed from 46 m back, 30 up
const busy = `(() => { const s = __ui.sim, L = s.agents().map(c => ({ c, w: s.where(c.handle) })).filter(x => x.w && x.w.drawn && !x.c.retired);
  let best = null; for (const a of L) { if (a.c.npc) continue; const near = L.filter(b => Math.hypot(b.w.x - a.w.x, b.w.z - a.w.z) < 22); if (!best || near.length > best.n) best = { h: a.c.handle, n: near.length, c: [a.w.x, a.w.y, a.w.z] }; } return best; })()`;
const frame = (c, back = 46, up = 30, side = .5) => `(() => { const C = __city, [x, y, z] = ${JSON.stringify(c)}; C.cam && C.cam.mode !== 'orbit' && C.cam.toOrbit({ instant: true }); C.controls.target.set(x, y + 1, z); C.camera.position.set(x + ${back} * ${side}, y + ${up}, z + ${back}); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`;
const thumbsReady = async (S, n = 9, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const k = await S.ev('__ui.portraits.stats().thumbs || 0'); if (k >= n) return k; await sleep(300); } return -1; };
const closeAll = S => S.ev(`(() => { const m = __ui.menu; m.people.close(); m.action.close(); m.settings.close(); __ui.dossier.close(); __ui.info.close(); if (__ui.map.isOpen) __ui.map.close(); return 1; })()`);

await fs.mkdir(OUT, { recursive: true });
const S = await open({ w: W, h: H });
const report = { at: AT, w: W, h: H, shots: [], clip: null };
try {
  await R('/seek?t=' + encodeURIComponent(AT)); await R('/speed?x=0');
  await S.go(`${BASE}?sim=live&simport=${port}`, { until: READY, ms: 180000 }); await sleep(5000);
  const b = await S.ev(busy); console.log('busy street', JSON.stringify(b)); await S.ev(frame(b.c)); await sleep(2500);
  if (ONLY.has('shots')) {
    // the bar in each skin, and People open in each skin
    for (const sk of ['clean', '98', 'zine']) {
      await S.ev(skin(sk)); await S.move(W - 4, H / 2); await sleep(1600); await shot(S, `bar-${sk}`);
      await S.ev('(__ui.menu.people.open(), 1)'); await thumbsReady(S); await sleep(1200); await shot(S, `people-${sk}`); await closeAll(S); await sleep(500);
    }
    await S.ev(skin('clean')); await sleep(800);
    // searched: / then type
    await key(S, 'slash'); await sleep(500); await type(S, 'dial'); await sleep(900); await shot(S, 'people-search');
    // filtered: Active + a crew, sorted nearest
    await S.ev(`(() => { const p = __ui.menu.people; p.set({ q: '', status: 'out', crew: '', sort: 'near' }); return 1; })()`); await sleep(1000); await shot(S, 'people-filter-near');
    await S.ev(`(() => { const p = __ui.menu.people, crews = [...new Set(__ui.sim.agents().map(c => c.crew).filter(Boolean))].filter(c => !/Locals/.test(c)); p.set({ status: 'all', crew: crews[0] || '', sort: 'busy' }); return crews[0]; })()`); await sleep(1000); await shot(S, 'people-filter-crew');
    // a hovered row: an agent drawn on screen, its beacon on the pin
    await S.ev(`(__ui.menu.people.set({ q: '', status: 'all', crew: '', cls: '', wanted: false, starred: false, mine: false, sort: 'near' }), 1)`); await sleep(1000);
    const row = await S.ev(`(() => { for (const hh of __ui.menu.people.shown) { const s = __ui.city.screenOf(hh); if (s && s.x > 520 && s.x < innerWidth - 60 && s.y > 120 && s.y < innerHeight - 120) { const el = document.querySelector('.pp-row[data-h="' + CSS.escape(hh) + '"]'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { h: hh, x: r.left + r.width / 2, y: r.top + r.height / 2 }; } } return null; })()`);
    console.log('hover row', JSON.stringify(row));
    if (row) { await S.move(row.x, row.y); await sleep(900); await shot(S, 'people-hover-beacon'); }
    // a hovered row whose agent is off screen: the beacon at the edge, pointing
    const far = await S.ev(`(() => { for (const hh of __ui.menu.people.shown.slice().reverse()) { const w = __ui.sim.where(hh); if (w && w.drawn && !__ui.city.screenOf(hh)) { const el = document.querySelector('.pp-row[data-h="' + CSS.escape(hh) + '"]'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { h: hh, x: r.left + r.width / 2, y: r.top + r.height / 2 }; } } return null; })()`);
    if (far) { await S.move(far.x, far.y); await sleep(900); await shot(S, 'people-hover-edge'); }
    await S.move(W - 4, H / 2); await closeAll(S); await sleep(600);
    // where's the action: . (the newest), . again (the one before)
    await key(S, 'period'); await sleep(3200); await shot(S, 'action-1');
    await key(S, 'period'); await sleep(3200); await shot(S, 'action-2');
    report.action = await S.ev('__ui.menu.action.stats()');
    await key(S, 'esc'); await sleep(400);
    // settings
    await S.ev(frame(b.c)); await sleep(1500); await key(S, 'back'); await sleep(900); await shot(S, 'settings'); await key(S, 'esc'); await sleep(300);
    // the developer bar back (Shift+`)
    await S.key('Backquote', '~', { keyCode: 192, modifiers: 8 }); await sleep(700); await shot(S, 'dev-bar'); await S.key('Backquote', '~', { keyCode: 192, modifiers: 8 }); await sleep(300);
  }
  if (ONLY.has('clip')) {
    // the clip: an agent on the street 120–480 m from the camera, at the run's own pace
    await closeAll(S); await S.ev(frame(b.c, 120, 95, .4)); await R('/speed?x=1'); await sleep(2500);
    const who = await S.ev(`(() => { const s = __ui.sim, T = __city.controls.target; const L = s.agents().filter(c => !c.npc && !c.retired && c.status !== 'dead').map(c => ({ h: c.handle, w: s.where(c.handle) })).filter(x => x.w && x.w.drawn && __city.cam.people.byAid(x.h)).map(x => ({ h: x.h, d: Math.hypot(x.w.x - T.x, x.w.z - T.z) })); L.sort((a, b) => Math.abs(a.d - 260) - Math.abs(b.d - 260)); return L[0] || null; })()`);
    console.log('clip agent', JSON.stringify(who));
    await S.move(W - 300, H / 2); await sleep(400);
    await S.cast(true, { quality: 80 }); await sleep(900);
    await key(S, 'slash'); await sleep(900); await type(S, who.h.slice(0, Math.min(6, who.h.length)), 170); await sleep(900);
    await key(S, 'enter'); await sleep(6500);
    await S.cast(false); await sleep(300);
    const st = await S.ev(`({ mode: __city.cam.mode, subject: __city.cam.subject?.aid || null, dossier: __ui.dossier.current, people: __ui.menu.people.isOpen })`); console.log('after Enter', JSON.stringify(st));
    report.clip = { agent: who, after: st };
    const frames = S.frames.slice(); console.log(`${frames.length} frames`);
    const tmp = await fs.mkdtemp(path.join(OUT, '.clip-')), list = [];
    for (let k = 0; k < frames.length; k++) { const f = path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`); await fs.writeFile(f, Buffer.from(frames[k].data, 'base64')); const d = k + 1 < frames.length ? Math.max(.01, frames[k + 1].t - frames[k].t) : .1; list.push(`file '${f}'\nduration ${d.toFixed(4)}`); }
    list.push(`file '${path.join(tmp, `f${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`); await fs.writeFile(path.join(tmp, 'list.txt'), list.join('\n'));
    const webm = path.join(OUT, 'clip-people-type-enter-follow.webm');
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'fps=30,scale=1280:-2,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '1.8M', webm]); }
    catch (e) { console.log('ffmpeg failed; the frames are in', tmp); throw e; }
    // three stills from the clip for the sheet: typing, just after Enter, following
    const pick = t => frames.reduce((b2, f, k) => Math.abs(f.t - frames[0].t - t) < Math.abs(frames[b2].t - frames[0].t - t) ? k : b2, 0);
    for (const [n, t] of [['clip-a-typing', 2.6], ['clip-b-enter', 4.2], ['clip-c-following', 8.6]]) await fs.copyFile(path.join(tmp, `f${String(pick(t)).padStart(4, '0')}.jpg`), path.join(OUT, n + '.jpg'));
    await fs.rm(tmp, { recursive: true, force: true }); console.log('→', webm);
  }
  report.stats = await S.ev('__ui.stats()').catch(() => null);
  if (S.errs.length) { console.log('page errors:', S.errs.slice(0, 5)); report.errors = S.errs.slice(0, 10); }
  await fs.writeFile(path.join(OUT, 'shots.json'), JSON.stringify(report, null, 1));
} finally { await R('/speed?x=1'); await S.close(); }
