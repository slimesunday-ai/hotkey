// STAGE · the vignette clips: real events of a recorded run, filmed from a watcher's height, as webm + a contact sheet of key frames.
//   node style/city/stage/clips.mjs [--base http://127.0.0.1:5344/style/city/] [--replay http://127.0.0.1:5273] [--out style/city/shots/human-layer/stage] [--only robbery-seen,…]
// Each scene: the replay paused a few game minutes before the event, the page loaded fresh, the camera on the place, the replay
// played; the screencast runs from just before the vignette to its end. Deaths: the run has none, so one is played by hand
// (__stage.play) on a drawn agent: the only staged-by-hand scene. Needs your own replay of 2026-09-29T23-18-20-641Z-mixed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../ui/tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5344/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5273'), OUT = path.resolve(opt('out', 'style/city/shots/human-layer/stage')), ONLY = opt('only', null)?.split(',');
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null), W = 1280, H = 720;
// cam: [dx, dy, dz] from the focus (a watcher's height: 6–9 m up, 10–16 m off); focus: an agent (its walker), or a home's door
const SCENES = [
  { name: 'robbery-seen', at: 'D2 18:49', focus: 'rawr_means_404', kind: 'robSeen', cam: [-7, 5.5, 8], extra: 'geocities.ghost' },
  { name: 'robbery-failed', at: 'D2 18:34', focus: 'tamagotchi.mom', kind: 'robSeen', cam: [-7, 5.5, 8], extra: 'strip.local1' },
  { name: 'robbery-unseen', at: 'D2 20:18', focus: 'tamagotchi.mom', kind: 'robUnseen', cam: [-6, 5, 7.5], tod: 'night', auto: true },
  { name: 'arrest', at: 'D2 18:23', focus: 'www.girl', kind: 'arrest', cam: [-11, 9, 13], auto: true },
  { name: 'burglary', at: 'D2 15:19', home: 'lot:-239,-90', kind: 'burglary', cam: [7, 6.5, 12] },
  { name: 'deal', at: 'D2 18:18', focus: 'tamagotchi.mom', kind: 'deal', cam: [-6, 5, 7.5] },
  { name: 'death', at: 'D2 18:16', focus: 'geocities.ghost', kind: 'death', cam: [-6, 5, 7.5], play: { type: 'death', who: 'geocities.ghost', at: 'corner--8_-2' } },
];
await fs.mkdir(OUT, { recursive: true });
const sheet = [];
for (const sc of SCENES) {
  if (ONLY && !ONLY.includes(sc.name)) continue;
  const S = await open({ w: W, h: H });
  try {
    await R('/speed?x=0'); await R('/seek?t=' + encodeURIComponent(sc.at));
    await S.go(`${BASE}?sim=live&simport=${port}${sc.tod ? '&tod=' + sc.tod : ''}`, { until: 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading && window.__stage', ms: 240000 });
    await sleep(2500);
    const focus = `(() => { const C = __city; let p = null; ${sc.home ? `const h = __simlive.layer.homeAt(${JSON.stringify(sc.home)}); p = h && { x: h.door[0], y: .2, z: h.door[2] };` : `const w = __ui.sim.where(${JSON.stringify(sc.focus)}); p = w && { x: w.x, y: w.y, z: w.z };`}
      if (!p) return null; ${sc.extra ? `const e = __ui.sim.where(${JSON.stringify(sc.extra)}); if (e && e.drawn) { p.x = (p.x + e.x) / 2; p.z = (p.z + e.z) / 2; }` : ''}
      let off = [${sc.cam[0]}, ${sc.cam[1]}, ${sc.cam[2]}];
      ${sc.auto ? `{ const T = C.THREE, from = new T.Vector3(p.x, p.y + 1.2, p.z), R = Math.hypot(off[0], off[2]), a0 = Math.atan2(off[0], off[2]); let best = null;   // (auto: the first way round with a clear line of sight)
        for (let k = 0; k < 16 && !best; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, o = [Math.sin(a) * R, off[1], Math.cos(a) * R], to = new T.Vector3(p.x + o[0], p.y + o[1], p.z + o[2]), d = to.clone().sub(from), L = d.length();
          const hits = new T.Raycaster(from, d.normalize(), 1.5, L).intersectObjects(C.scene.children, true).filter(h => h.object.visible && !h.object.isInstancedMesh && h.object !== C.peds?.anim?.batch && h.object !== C.peds?.anim?.mid); if (!hits.length) best = o; }
        if (best) off = best; }` : ''}
      C.controls.target.set(p.x, p.y + 1, p.z); C.camera.position.set(p.x + off[0], p.y + off[1], p.z + off[2]); C.camera.lookAt(C.controls.target); C.controls.update(); return p; })()`;
    const p = await S.ev(focus); if (!p) { console.log(sc.name, ': focus not found'); continue; }
    await sleep(4000); await S.ev(focus); await R('/speed?x=1'); await sleep(600);
    await S.cast(true, { quality: 80 }); const t0 = Date.now(); let seen = false, tEnd = null;
    if (sc.play) { await sleep(1200); await S.ev(`(__stage.play(${JSON.stringify(sc.play)}), 1)`); }
    while (Date.now() - t0 < 30000) { await sleep(200); const L = await S.ev('__stage.list()');
      const on = L.some(v => v.kind === sc.kind); if (on) seen = true; if (seen && !on && tEnd === null) tEnd = Date.now(); if (tEnd && Date.now() - tEnd > 1200) break; }
    await S.cast(false); const st = await S.ev('__stage.stats()'); console.log(sc.name, seen ? 'staged' : 'NOT STAGED', JSON.stringify({ staged: st.staged, aftermath: st.aftermath, skipped: st.skipped, p95: st.p95, max: st.maxMs }));
    const frames = S.frames.slice(); if (!frames.length) continue;
    // keep from 1.2 s before the vignette's first frame (the whole clip when it never staged)
    const tmp = await fs.mkdtemp(path.join(OUT, '.clip-')), list = [];
    for (let k = 0; k < frames.length; k++) { const f = path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`); await fs.writeFile(f, Buffer.from(frames[k].data, 'base64')); const d = k + 1 < frames.length ? Math.max(.01, frames[k + 1].t - frames[k].t) : .1; list.push(`file '${f}'\nduration ${d.toFixed(4)}`); }
    list.push(`file '${path.join(tmp, `f${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`); await fs.writeFile(path.join(tmp, 'list.txt'), list.join('\n'));
    const webm = path.join(OUT, `${sc.name}.webm`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'fps=30,scale=960:-2,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '1100k', webm]);
    // key frames for the sheet: six, evenly over the clip
    const dur = frames[frames.length - 1].t - frames[0].t, picks = [];
    for (let k = 0; k < 6; k++) { const tt = frames[0].t + dur * (.08 + .84 * k / 5); let best = 0; frames.forEach((f, i) => { if (Math.abs(f.t - tt) < Math.abs(frames[best].t - tt)) best = i; }); picks.push(path.join(tmp, `f${String(best).padStart(4, '0')}.jpg`)); }
    const row = path.join(OUT, `.${sc.name}-row.jpg`); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...picks.flatMap(f => ['-i', f]), '-filter_complex', picks.map((_, i) => `[${i}:v]scale=400:-2[v${i}]`).join(';') + ';' + picks.map((_, i) => `[v${i}]`).join('') + `hstack=inputs=${picks.length}`, row]);
    sheet.push({ name: sc.name, row }); await fs.rm(tmp, { recursive: true, force: true }); console.log('→', webm);
    if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5));
  } finally { await S.close(); }
}
// the contact sheet: one row per scene, its name on the left
if (sheet.length) { const py = `
from PIL import Image, ImageDraw
import sys, json
rows = json.loads(sys.argv[1]); ims = [Image.open(r['row']) for r in rows]; w = max(i.width for i in ims) + 150; h = sum(i.height + 8 for i in ims)
S = Image.new('RGB', (w, h), (18, 18, 22)); d = ImageDraw.Draw(S); y = 0
for r, im in zip(rows, ims): S.paste(im, (150, y)); d.text((10, y + im.height // 2 - 6), r['name'], fill=(240, 230, 200)); y += im.height + 8
S.save(sys.argv[2], quality=85)`;
  const out = path.join(OUT, ONLY ? `contact-sheet-${ONLY.join('-')}.jpg` : 'contact-sheet.jpg'); execFileSync('python3', ['-c', py, JSON.stringify(sheet), out]); for (const s of sheet) await fs.rm(s.row, { force: true }); console.log('→', out); }
