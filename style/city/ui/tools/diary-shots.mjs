// HUMAN LAYER · SECTION 2b · the shots: trails (one agent, three), the heat map in each mode, the dossier's entry points, the diary
// room (title, captions, pending, YOURS), one exported diary clip and one tape clip (webm), plus the toys' cost on the frame.
//   node style/city/ui/tools/diary-shots.mjs [--out style/city/shots/human-layer/s2] [--replay http://127.0.0.1:5266] [--base http://127.0.0.1:5335/style/city/]
//        [--at "D4 14:00"] [--skins clean,98,zine] [--only dossier,trail1,trail3,heat,diary,yours,clips,cost]
// It pauses and seeks the replay: run it only against your own. Then it lays the frames out with python3 (PIL) into sheet-*.jpg.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from './cdp.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5335/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5266'), OUT = path.resolve(opt('out', 'style/city/shots/human-layer/s2')), AT = opt('at', 'D4 14:00');
const SKINS = opt('skins', 'clean,98,zine').split(','), ONLY = new Set(opt('only', 'dossier,trail1,trail3,heat,diary,yours,clips,cost').split(',')), W = 1280, H = 720;
const ONE = 'tamagotchi.mom', THREE = ['tamagotchi.mom', 'pop.up.ad', 'xXbadvibesXx'], DIARY = 'tamagotchi.mom';
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null);
const READY = 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && window.__toys && !__city.loading';
const FRAMES = path.resolve(opt('frames', path.join(OUT, 'toys-frames'))); await fs.mkdir(FRAMES, { recursive: true });   // (PNG frames: not committed; the sheets are)
const made = [];
async function readBlob(S, expr) {   // expr: a page expression giving a Blob (or null) → Buffer, read back in 512 KB base64 slices
  const n = await S.ev(`(async () => { const b = ${expr}; if (!b) return 0; window.__rb = new Uint8Array(await b.arrayBuffer()); return __rb.length; })()`); if (!n) return null; const parts = [];
  for (let i = 0; i < n; i += 524288) parts.push(Buffer.from(await S.ev(`(() => { const u = __rb.subarray(${i}, ${i + 524288}); let s = ''; for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode(...u.subarray(k, k + 32768)); return btoa(s); })()`), 'base64'));
  await S.ev('(window.__rb = null, 1)'); return Buffer.concat(parts); }
async function shot(S, name) { const f = path.join(FRAMES, name + '.png'); await S.shot(f); made.push(f); console.log('  ✓', name); return f; }
async function page(S, q = '') { await S.go(`${BASE}?sim=live&simport=${port}${q}`, { until: READY, ms: 200000 }); await sleep(5000); }
const skin = s => `(() => { for (let k = 0; k < 3 && __ui.skin() !== ${JSON.stringify(s)}; k++) __ui.nextSkin(); return __ui.skin(); })()`;
// frame the camera on the trails' bounds (or a point), from above at an angle
const frameTrails = (hs, k = 1) => `(() => { const P = []; for (const h of ${JSON.stringify(hs)}) { const d = __toys.trails.data(h); if (!d) continue; for (const s of d.stops) P.push([s.x, s.z]); for (const L of d.legs) P.push([L.x0, L.z0], [L.x1, L.z1]); }
  if (!P.length) return null; const xs = P.map(p => p[0]), zs = P.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, span = Math.max(70, Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.5) * ${k};
  const C = __city; if (C.cam && C.cam.mode !== 'orbit' && C.cam.setMode) C.cam.setMode('orbit'); const up = Math.min(150, span * .7), back = Math.min(200, span * .62); C.controls.target.set(cx - span * .1, 0, cz - back * .15); C.camera.position.set(cx - span * .1 + back * .2, up, cz + back * .85); C.camera.lookAt(C.controls.target); C.controls.update(); return [Math.round(cx), Math.round(cz), Math.round(span)]; })()`;
const overview = `(() => { const C = __city; C.controls.target.set(-70, 0, -40); C.camera.position.set(-40, 150, 110); C.camera.fov = 50; C.camera.updateProjectionMatrix(); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`;
const waitTrails = n => `new Promise(r => { const t0 = performance.now(); const f = () => { const s = __toys.trails.stats(); if ((s.on >= ${n} && document.querySelectorAll('#k .tr-rows li').length >= ${n} && !document.querySelector('#k .tr-busy')) || performance.now() - t0 > 8000) r(s); else setTimeout(f, 200); }; f(); })`;

await R('/seek?t=' + encodeURIComponent(AT)); await R('/speed?x=0');
const report = { when: new Date().toISOString(), at: AT, frames: [], cost: null, clips: {} };
const S = await open({ w: W, h: H });
try {
  await page(S);
  for (const sk of SKINS) {
    await S.ev(skin(sk)); await sleep(1200);
    if (ONLY.has('dossier')) { await S.ev(`(__ui.dossier.open(${JSON.stringify(ONE)}), 1)`); await sleep(2500); await shot(S, `${sk}-dossier`); }
    if (ONLY.has('trail1')) { await S.ev(`(__toys.trails.clear(), __toys.trails.add(${JSON.stringify(ONE)}), 1)`); await S.ev(waitTrails(1)); await S.ev(`(__ui.dossier.render(true), 1)`);
      console.log('    frame', await S.ev(frameTrails([ONE], 1))); await sleep(2500); await shot(S, `${sk}-trail1`);
      if (sk === SKINS[0]) { await S.ev(frameTrails([ONE], .45)); await sleep(2000); await shot(S, `${sk}-trail1-close`); } }
    if (ONLY.has('trail3')) { await S.ev(`(__ui.dossier.close(), __toys.trails.clear(), ${JSON.stringify(THREE)}.forEach(h => __toys.trails.add(h)), 1)`); await S.ev(waitTrails(3));
      console.log('    frame', await S.ev(frameTrails(THREE, 1))); await sleep(2500); await shot(S, `${sk}-trail3`); await S.ev(`(__toys.trails.clear(), 1)`); }
    if (ONLY.has('heat')) { await S.ev(`(__toys.tools(true), 1)`); for (const m of ['presence', 'crimes', 'deals']) { await S.ev(`(__toys.heat.set(${JSON.stringify(m)}), 1)`); await S.ev(overview); await sleep(2600); await shot(S, `${sk}-heat-${m}`); if (sk !== SKINS[0]) break; } await S.ev(`(__toys.heat.set(null), 1)`); }
    if (ONLY.has('diary')) {
      await S.ev(`(__ui.dossier.open(${JSON.stringify(DIARY)}), __toys.diary.show(${JSON.stringify(DIARY)}, { day: 2 }), 1)`); await sleep(900); await shot(S, `${sk}-diary-title`);
      await sleep(2600); await shot(S, `${sk}-diary-line1`);
      if (sk === SKINS[0]) { await S.ev(`(__toys.diary.skip(1), __toys.diary.skip(1), __toys.diary.skip(1), 1)`); await sleep(1400); await shot(S, `${sk}-diary-line3`);
        await S.ev(`(__toys.diary.go(3), 1)`); await sleep(700); await shot(S, `${sk}-diary-partial`);
        await S.ev(`(__toys.diary.go(4), 1)`); await sleep(1500); await shot(S, `${sk}-diary-pending`); }
      report.frames.push({ skin: sk, diary: await S.ev(`__toys.stats().diary`) }); await S.ev(`(__toys.diary.close(), __ui.dossier.close(), 1)`); await sleep(500); }
  }
  // the diary clip (clean): play day 3 into a webm, read the blob back
  if (ONLY.has('clips')) {
    await S.ev(skin('clean')); await sleep(800);
    await S.ev(`(__toys.diary.show(${JSON.stringify(DIARY)}, { day: 2 }), 1)`); await sleep(1500);
    await S.ev(`(__toys.diary.saveClip(), 1)`); let d = null;
    for (let k = 0; k < 60 && !d; k++) { await sleep(2000); d = await S.ev(`(() => { const c = __toys.diary.lastClip; return c ? { name: c.name, secs: c.secs, bytes: c.bytes } : null; })()`); }
    if (d) d.buf = await readBlob(S, '__toys.diary.lastClip.blob');
    if (d) { await fs.writeFile(path.join(OUT, 'toys-diary-clip.webm'), d.buf); delete d.buf; report.clips.diary = { name: d.name, secs: d.secs, bytes: d.bytes }; console.log('  ✓ toys-diary-clip.webm', d.secs, 's', d.bytes, 'B'); }
    await S.ev(`(__toys.diary.close(), 1)`);
    // the tape clip: the tape at the agent with its trail, in → out on the timeline (2a's tape), else the next seconds of the live city
    await S.ev(`(__toys.trails.clear(), __toys.trails.add(${JSON.stringify(ONE)}), 1)`); await S.ev(waitTrails(1));
    const hasTape = await S.ev(`!!(__toys.tape && __toys.tape.open && window.__tape && __tape.open)`).catch(() => false);
    let tapeOk = false;
    if (hasTape) { try { await S.ev(`(async () => { await __tape.open({ handle: ${JSON.stringify(ONE)} }); return 1; })()`, 60000); await sleep(6000); tapeOk = await S.ev(`__tape.active`); } catch (e) { console.log('    tape open failed:', e.message); } }
    report.clips.tapeMode = tapeOk;
    await S.ev(frameTrails([ONE], .7)); await sleep(1500);
    if (tapeOk) { await S.ev(`(() => { const t = __tape.time(); __tape.seek(t - 120); __tape.setSpeed && __tape.setSpeed(4); return 1; })()`); await sleep(1500); await S.key('KeyI', 'i'); await S.ev(`(__tape.seek(__tape.time() + 75), 1)`); await sleep(600); await S.key('KeyO', 'o'); await sleep(400);
      await S.ev(`(__tape.seek(__toys.clips.marks.in + 30), 1)`); await sleep(1500);
      await shot(S, 'clean-tape-marks'); }
    const clip = await S.ev(`(async () => { const r = ${tapeOk ? `await __toys.clips.cut()` : `await __toys.clips.start({ seconds: 6 })`}; if (!r) return null; window.__clipBlob = r.blob; return { name: r.name, secs: r.secs, bytes: r.bytes, w: r.w, h: r.h, frames: r.frames }; })()`, 120000).catch(e => { console.log('    clip failed', e.message); return null; });
    if (clip) { await fs.writeFile(path.join(OUT, 'toys-tape-clip.webm'), await readBlob(S, 'window.__clipBlob')); report.clips.tape = clip; console.log('  ✓ toys-tape-clip.webm', JSON.stringify(clip)); }
    if (tapeOk) await S.ev(`(__tape.close(), 1)`).catch(() => {}); await S.ev(`(__toys.trails.clear(), 1)`);
  }
  // the cost on the frame: off (nothing), three trails + presence heat on, the diary open (rAF intervals + the trails' own per-frame ms)
  if (ONLY.has('cost')) {
    const measure = ms => S.ev(`new Promise(res => { const f = []; let last = performance.now(); const t0 = last; const step = () => { const n = performance.now(); f.push(n - last); last = n; if (n - t0 < ${ms}) requestAnimationFrame(step); else res(f); }; requestAnimationFrame(step); })`);
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
    await S.ev(frameTrails(THREE, 1)).catch(() => {}); await S.ev(`(() => { const C = __city; C.controls.target.set(-60, 0, -20); C.camera.position.set(-30, 150, 90); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`); await sleep(1500);
    const rows = [];
    let f = await measure(5000); rows.push({ state: 'toys off', p50: q(f, .5), p95: q(f, .95), scene: await S.ev(`__city.scene.children.filter(o => /^ui-(trail|heat)/.test(o.name)).length`) });
    await S.ev(`(${JSON.stringify(THREE)}.forEach(h => __toys.trails.add(h)), __toys.heat.set('presence'), 1)`); await S.ev(waitTrails(3)); await sleep(2000);
    f = await measure(5000); rows.push({ state: '3 trails + heat (presence)', p50: q(f, .5), p95: q(f, .95), toys: await S.ev(`__toys.stats()`) });
    await S.ev(`(__toys.trails.clear(), __toys.heat.set(null), __toys.diary.show(${JSON.stringify(DIARY)}, { day: 3 }), 1)`); await sleep(2500);
    f = await measure(5000); rows.push({ state: 'diary room open', p50: q(f, .5), p95: q(f, .95) });
    await S.ev(`(__toys.diary.close(), 1)`); await sleep(800); f = await measure(5000); rows.push({ state: 'toys off again', p50: q(f, .5), p95: q(f, .95), scene: await S.ev(`__city.scene.children.filter(o => /^ui-(trail|heat)/.test(o.name)).length`) });
    report.cost = rows; for (const r of rows) console.log('  cost', JSON.stringify(r).slice(0, 400));
  }
  if (S.errs.length) { console.log('page errors:', S.errs.slice(0, 5)); report.errors = S.errs.slice(0, 10); }
  // YOURS: a page claiming the agent, its diary live (today)
  if (ONLY.has('yours')) { await page(S, `&as=${encodeURIComponent(DIARY)}&ui=clean`); await S.ev(`(__ui.dossier.open(${JSON.stringify(DIARY)}), 1)`); await sleep(2000); await shot(S, 'clean-yours-dossier');
    await S.ev(`(__toys.diary.show(${JSON.stringify(DIARY)}), 1)`); await sleep(4300); await shot(S, 'clean-yours-diary'); report.frames.push({ yours: await S.ev(`__toys.stats().diary`) }); }
} finally { await S.close(); await R('/speed?x=1'); }
await fs.writeFile(path.join(OUT, 'toys-report.json'), JSON.stringify(report, null, 1));
console.log('frames:', made.length);
// the contact sheets: one per toy, labelled tiles (PIL)
const groups = { trails: ['clean-dossier', '98-dossier', 'zine-dossier', 'clean-trail1', 'clean-trail1-close', 'clean-trail3', '98-trail3', 'zine-trail3', 'clean-tape-marks'],
  heat: ['clean-heat-presence', 'clean-heat-crimes', 'clean-heat-deals', '98-heat-presence', 'zine-heat-presence'],
  diary: ['clean-diary-title', 'clean-diary-line1', 'clean-diary-line3', 'clean-diary-partial', 'clean-diary-pending', 'clean-yours-diary', '98-diary-line1', 'zine-diary-line1', 'clean-yours-dossier'] };
const py = `import sys, json, os
from PIL import Image, ImageDraw, ImageFont
g = json.loads(sys.argv[1]); F = sys.argv[2]; O = sys.argv[3]
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 18)
except Exception: font = ImageFont.load_default()
for name, keys in g.items():
  fs = [k for k in keys if os.path.exists(os.path.join(F, k + '.png'))]
  if not fs: continue
  cols = 3; rows = (len(fs) + cols - 1) // cols; tw, th = 640, 360
  S = Image.new('RGB', (tw * cols, th * rows), (18, 18, 20)); d = ImageDraw.Draw(S)
  for i, k in enumerate(fs):
    im = Image.open(os.path.join(F, k + '.png')).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y))
    d.rectangle([x, y + th - 28, x + 8 + 11 * len(k), y + th], fill=(0, 0, 0)); d.text((x + 6, y + th - 25), k, fill=(255, 255, 255), font=font)
  S.save(os.path.join(O, 'toys-sheet-' + name + '.jpg'), quality=80); print('sheet', name, len(fs))`;
console.log(execFileSync('python3', ['-c', py, JSON.stringify(groups), FRAMES, OUT]).toString().trim());
