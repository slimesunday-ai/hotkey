// MOVEMENT W3b · the clips: going down a station's stairs, a carriage ride with stops and riders (the ?subway=1 demo: SUNNY ACRES → FIT ST
// → WASHINGTON, change for the TIDE → … → LOW TIDE), coming up at the other end → webm (+ a few stills), under shots/movement/w3b/.
//   node style/city/subway/tools/clips.mjs [--base http://127.0.0.1:5351/style/city/] [--only down,ride,up] [--ride 40]
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../ui/tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5351/style/city/'), OUT = path.resolve(opt('out', 'style/city/shots/movement/w3b')), ONLY = opt('only', 'down,ride,up').split(','), W = 960, H = 540;
await fs.mkdir(OUT, { recursive: true });
async function record(S, name, secs, during = async () => {}) {
  const dir = path.join(OUT, '.frames-' + name); await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(dir, { recursive: true });
  await S.cast(true, { quality: 72 }); const t0 = Date.now(); await during(); while (Date.now() - t0 < secs * 1000) await sleep(200); await S.cast(false); await sleep(300);
  const F = S.frames.slice(); if (F.length < 2) throw new Error(name + ': no frames');
  let list = ''; for (let k = 0; k < F.length; k++) { const f = path.join(dir, String(k).padStart(5, '0') + '.jpg'); await fs.writeFile(f, Buffer.from(F[k].data, 'base64')); const d = k + 1 < F.length ? Math.max(.01, F[k + 1].t - F[k].t) : .04; list += `file '${f}'\nduration ${d.toFixed(3)}\n`; }
  await fs.writeFile(path.join(dir, 'list.txt'), list);
  const out = path.join(OUT, name + '.webm'); execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', `scale=${W}:-2,fps=24`, '-c:v', 'libvpx-vp9', '-b:v', '900k', '-deadline', 'realtime', '-cpu-used', '8', out]);
  // three stills from the clip
  for (const [k, u] of [[0, .15], [1, .5], [2, .85]]) { const f = F[Math.floor(F.length * u)]; await fs.writeFile(path.join(OUT, `${name}-${k + 1}.jpg`), Buffer.from(f.data, 'base64')); }
  await fs.rm(dir, { recursive: true, force: true }); const st = await fs.stat(out); console.log(name, F.length, 'frames →', out, (st.size / 1e6).toFixed(2), 'MB');
}
const S = await open({ w: W, h: H });
try {
  const station = opt('station', 'subway-washington'), Wd = JSON.parse(await fs.readFile(new URL('../../../../world/export/world.json', import.meta.url), 'utf8')), st = Wd.transit.stations.find(s => s.id === station), f = st.face === '-z' ? -1 : 1;
  const cam = `&cam=${(st.x + 1.2).toFixed(1)},3.4,${(st.z + f * 8.2).toFixed(1)}&look=${st.x.toFixed(1)},.2,${(st.z + f * 1.2).toFixed(1)}`;
  for (const dir of ['down', 'up']) { if (!ONLY.includes(dir)) continue;
    await S.go(`${BASE}?subway=stairs&sim=0&cars=0&rig=0&ui=0${cam}`, { until: '__city.marks.first && __city.subway && __city.peds && __city.peds.ready', ms: 400000 }); await sleep(6000); await S.ev("(document.body.classList.add('shot'), document.querySelectorAll('.ui,.hint,#bench').forEach(e => e.style.display = 'none'), 1)"); 
    await S.ev(`(() => { const C = __city, f = ${f}; let d = null; for (const A of C.ANCHORS.values()) { const t = (A && A.transit || []).find(t => t.id === ${JSON.stringify(station)}); if (t) d = t; } if (!d) return 0;   // (frame the kiosk's opening: its door anchor)
      C.camera.position.set(d.x + 2.6, 4.4, d.z + f * 7.8); C.controls.target.set(d.x, .2, d.z - f * 1.0); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`); await sleep(2500);
    await record(S, 'stairs-' + dir, 11, () => S.ev(`(__city.subway.stairsDemo(${JSON.stringify(station)}, '${dir}', 9), 1)`)); }
  if (ONLY.includes('ride')) {
    await S.go(`${BASE}?subway=1&peds=0&cars=0&ui=0&at=${opt('at', '2')}`, { until: "__city.subway && __city.subway.open", ms: 300000 }); await sleep(1500);
    await record(S, 'carriage-ride', +opt('ride', 46)); }
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 4));
} finally { await S.close(); }
