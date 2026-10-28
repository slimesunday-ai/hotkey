// HUMAN LAYER · SECTION 3b · the map's contact sheets and its clip, from a recorded run on YOUR replay (it pauses and seeks it).
//   node style/city/ui/map/tools/mapshots.mjs [--png <scratch dir>] [--out style/city/shots/human-layer/s3] [--replay http://127.0.0.1:5269]
//        [--base http://127.0.0.1:5337/style/city/] [--only island,district,card,agents,events,trail1,trail3,heat,turf,tape,skins,clip] [--w 1440 --h 900]
// Then python3 style/city/ui/map/tools/mapsheet.py <png dir> <out dir> lays the PNGs out as JPEG sheets (map-sheet.jpg, map-sheet-skins.jpg);
// the clip (open the map → zoom → click a place → Go there) is written as webm straight to --out.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../tools/cdp.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5337/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5269'), OUT = opt('out', 'style/city/shots/human-layer/s3'), PNG = opt('png', path.join(os.tmpdir(), 'map-shots'));
const ONLY = new Set(opt('only', 'island,district,card,agents,events,trail1,trail3,heat,turf,tape,skins,clip').split(',')), W = +opt('w', 1440), H = +opt('h', 900);
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null);
const READY = 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && window.__map && !__city.loading';
const report = { shots: [], notes: [] };
await fs.mkdir(PNG, { recursive: true }); await fs.mkdir(OUT, { recursive: true });
const shot = async (S, name) => { const f = path.join(PNG, name + '.png'); await S.shot(f); report.shots.push(f); console.log('  ✓', f); };
const skin = s => `(() => { const want = ${JSON.stringify(s)}; for (let k = 0; k < 3 && __ui.skin() !== want; k++) __ui.nextSkin(); return __ui.skin(); })()`;
const ev = (S, js) => S.ev(js).catch(e => { console.log('  ! ' + String(e).slice(0, 200)); return null; });
// a spot to look at: the busiest place, the district centre, etc. (asked of the page)
const busiest = `(() => { const A = __ui.sim.agents().map(c => ({ c, w: __ui.sim.where(c.handle) })).filter(x => x.w); let best = null;
  for (const a of A) { const n = A.filter(b => Math.hypot(b.w.x - a.w.x, b.w.z - a.w.z) < 60).length; if (!best || n > best.n) best = { n, x: a.w.x, z: a.w.z }; } return best; })()`;

async function page(S, q = '') { await S.go(`${BASE}?sim=live&simport=${port}${q}`, { until: READY, ms: 200000 }); await sleep(5000); }
async function openMap(S) { await ev(S, '__map.isOpen || __map.open()'); await sleep(1600); }
async function hoverAgent(S) { const p = await ev(S, `(() => { const m = __map, d = m.data(); for (const h of __ui.sim.agents().map(c => c.handle)) { const w = __ui.sim.where(h); if (!w) continue; const s = m.screenOf(w.x, w.z); if (s && s[0] > 120 && s[0] < innerWidth - 360 && s[1] > 80 && s[1] < innerHeight - 160) { const r = document.querySelector('.mp').getBoundingClientRect(); const hit = m.hit(s[0], s[1]); if (hit && hit.kind === 'agent') return { x: s[0] + r.left, y: s[1] + r.top, h: hit.a.h }; } } return null; })()`);
  if (p) { await S.move(p.x - 20, p.y - 20); await sleep(100); await S.move(p.x, p.y); await sleep(700); } return p; }

const S = await open({ w: W, h: H });
try {
  await R('/speed?x=0');
  await page(S);
  await ev(S, skin('clean'));
  report.notes.push({ start: await ev(S, '({ clock: __ui.sim.clock(), agents: __ui.sim.agents().length, map: __map.stats() })') });
  if (ONLY.has('island')) { await openMap(S); await ev(S, '__map.fit()'); await sleep(1200); await shot(S, 'map-island');
    report.notes.push({ island: await ev(S, '__map.stats()') }); }
  if (ONLY.has('district')) { await openMap(S); await ev(S, '__map.focus(-40, 150, 3.2)'); await sleep(1500); await shot(S, 'map-district'); }
  if (ONLY.has('card')) { await openMap(S); await ev(S, `__map.place('police')`); await sleep(1500); await shot(S, 'map-card'); await ev(S, `(document.querySelector('.mp-card-x')?.click(), 1)`); }
  if (ONLY.has('agents')) { await openMap(S); const b = await ev(S, busiest); if (b) await ev(S, `__map.focus(${b.x}, ${b.z}, 2.4)`); await sleep(1500); const p = await hoverAgent(S); report.notes.push({ hover: p }); await shot(S, 'map-agents-hover'); await S.move(4, H - 4); }
  if (ONLY.has('events')) { await openMap(S); const e = await ev(S, `(() => { const d = __map.data(); return d; })()`); report.notes.push({ events: e });
    await ev(S, '__map.fit()'); await sleep(1300); await shot(S, 'map-events'); }
  if (ONLY.has('trail1') || ONLY.has('trail3')) {
    const who = await ev(S, `(() => { const s = __ui.sim, n = h => s.events({ handle: h, types: ['move'] }).length; return s.agents().filter(c => !c.npc).map(c => [c.handle, n(c.handle)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]); })()`);
    report.notes.push({ trails: who });
    if (ONLY.has('trail1') && who?.length) { await ev(S, `(__toys.trails.add(${JSON.stringify(who[0])}), 1)`); await sleep(4000); await openMap(S); await ev(S, `(() => { const d = __toys.trails.data(${JSON.stringify(who[0])}); if (!d || !d.stops.length) return __map.fit(); const xs = [...d.stops.map(s => s.x), ...d.legs.flatMap(L => [L.x0, L.x1])], zs = [...d.stops.map(s => s.z), ...d.legs.flatMap(L => [L.z0, L.z1])], sp = Math.max(80, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)), s = Math.max(.9, Math.min(3.2, 640 / sp)); __map.focus((Math.min(...xs) + Math.max(...xs)) / 2 + 150 / s, (Math.min(...zs) + Math.max(...zs)) / 2, s); })()`); await sleep(1600); await shot(S, 'map-trail-1'); }
    if (ONLY.has('trail3') && who?.length >= 3) { await ev(S, `(${JSON.stringify(who.slice(1))}.forEach(h => __toys.trails.add(h)), 1)`); await sleep(5000); await ev(S, '__map.fit()'); await sleep(1600); await shot(S, 'map-trail-3'); }
    await ev(S, '(__toys.trails.clear(), 1)'); await sleep(500);
  }
  if (ONLY.has('heat')) { await openMap(S); await ev(S, '__map.fit()'); for (const m of ['presence', 'crimes', 'deals']) { await ev(S, `(__toys.heat.set(${JSON.stringify(m)}), __map.setLayer('heat', true), 1)`); await sleep(4500); await shot(S, 'map-heat-' + m); } await ev(S, '(__toys.heat.set(null), 1)'); await sleep(600); }
  if (ONLY.has('turf')) { await openMap(S); await ev(S, `(__map.setLayer('turf', true), 1)`); await ev(S, '__map.fit()'); await sleep(1500); await shot(S, 'map-turf'); await ev(S, `(__map.setLayer('turf', false), 1)`); }
  if (ONLY.has('tape')) { await ev(S, '__map.close()'); await ev(S, '(__ui.tape.open({}), 1)'); await S.ev('new Promise(r => { const t0 = Date.now(); const k = () => (__tape.time() !== null || Date.now() - t0 > 30000) ? r(1) : setTimeout(k, 300); k(); })'); await sleep(3000);
    await openMap(S); await ev(S, '__map.fit()'); await sleep(2500); report.notes.push({ tape: await ev(S, '({ t: __tape.clock().label, map: __map.data() })') }); await shot(S, 'map-tape');
    await ev(S, '__map.close()'); await ev(S, '(__ui.tape.close(), 1)'); await sleep(2500); }
  if (ONLY.has('skins')) { await openMap(S); for (const sk of ['clean', '98', 'zine']) { await ev(S, skin(sk)); await sleep(2200); await ev(S, '__map.fit()'); await sleep(1200); await shot(S, 'map-skin-' + sk + '-island'); await ev(S, '__map.focus(40, -60, 2.6)'); await sleep(1500); await shot(S, 'map-skin-' + sk + '-zoom'); } await ev(S, skin('clean')); await sleep(800); }
  report.notes.push({ stats: await ev(S, '__map.stats()') });
  // ── the clip: open the map (B) → zoom in (wheel) → click a place → Go there (the camera flies)
  if (ONLY.has('clip')) {
    await openMap(S); await ev(S, '__map.setView({ cx: 157, cz: -5, s: .9 })'); await sleep(800); await ev(S, '__map.close()'); await ev(S, `(__city.cam && __city.cam.view('overview'), 1)`); await sleep(3500);
    await S.cast(true, { quality: 72 }); await sleep(800);
    await S.key('KeyB', 'b', { keyCode: 66 }); await sleep(1400);
    const tgt = await ev(S, `(() => { const p = __map.data && document.querySelector('.mp').getBoundingClientRect(); const s = __map.screenOf(161, -33); return { x: s[0] + p.left, y: s[1] + p.top }; })()`);
    for (let k = 0; k < 8; k++) { await S.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: tgt.x, y: tgt.y, deltaX: 0, deltaY: -60 }); await sleep(90); }
    await sleep(900);
    const p2 = await ev(S, `(() => { const r = document.querySelector('.mp').getBoundingClientRect(), s = __map.screenOf(161, -33); return { x: s[0] + r.left, y: s[1] + r.top }; })()`);
    await S.move(p2.x - 30, p2.y + 20); await sleep(250); await S.move(p2.x, p2.y); await sleep(700); await S.click(p2.x, p2.y); await sleep(2200);
    const go = await ev(S, `(() => { const b = [...document.querySelectorAll('.mp-card-go .k-btn')][0]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (go) { await S.move(go.x, go.y); await sleep(500); await S.click(go.x, go.y); }
    await sleep(6500); await S.cast(false); await sleep(300);
    report.notes.push({ clipAfter: await ev(S, '({ cam: __city.camera.position.toArray().map(v => +v.toFixed(1)), tgt: __city.controls.target.toArray().map(v => +v.toFixed(1)), map: __map.isOpen })') });
    const frames = S.frames.slice(), tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'map-clip-')), list = [];
    for (let k = 0; k < frames.length; k++) { const f = path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`); await fs.writeFile(f, Buffer.from(frames[k].data, 'base64')); const d = k + 1 < frames.length ? Math.max(.01, frames[k + 1].t - frames[k].t) : .1; list.push(`file '${f}'\nduration ${d.toFixed(4)}`); }
    list.push(`file '${path.join(tmp, `f${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`); await fs.writeFile(path.join(tmp, 'list.txt'), list.join('\n'));
    const webm = path.join(OUT, 'map-clip-open-zoom-place-go.webm');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'fps=30,scale=1280:-2,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '1800k', webm]);
    report.notes.push({ clip: webm, frames: frames.length, bytes: (await fs.stat(webm)).size }); await fs.rm(tmp, { recursive: true, force: true });
  }
  if (S.errs.length) report.notes.push({ errors: S.errs.slice(0, 8) });
} finally { await R('/speed?x=1'); await S.close(); }
await fs.writeFile(path.join(PNG, 'report.json'), JSON.stringify(report, null, 1)); console.log(JSON.stringify(report.notes, null, 1).slice(0, 4000));
