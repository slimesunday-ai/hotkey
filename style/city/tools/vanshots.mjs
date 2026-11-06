// C2-VAN · THE CLEANERS' VAN, ITS PICTURES AND ITS PROOF (lane C2-van, 2026-11-05), from headless Chrome:
//   lineup   the fleet lineup (vehicles/lineup.html, its default rows: the 12 trunk models) drawn by this checkout and by <rev>'s
//            vehicles code (--trunk, default a084874: served from git on --port + 1, every other file this checkout's), day and night:
//            a pixel diff of the two, printed (the differing pixels, the largest channel step); writes lineup-<tod>.jpg (this checkout)
//   van      the Cleaners' van beside the Qwik Kargo van (lineup.html?mode=van), day and night: van-<tod>.jpg
//   beat     the three crew beats in the Cleaners studio (studio/cleaners.html?mode=beat&set=van): a contact sheet per beat, beat-<name>.jpg
//   clip     the van beat as one clip (≤ 15 s, 30 fps, 960 × 540, VP9 CRF 27; the frames go to a temp folder and are deleted)
//   node style/city/tools/vanshots.mjs --port 5977 [--only lineup,van,beat,clip] [--out style/city/shots/c2-van] [--trunk a084874] [--face visor]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started; Chrome's profile is a temp
// folder removed after Chrome has exited (recordscenario.mjs chrome()).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { ROOT, PORT, arg, chrome, serve } from './c2lib.mjs';

const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-van'))), ONLY = arg('only', 'lineup,van,beat,clip').split(','), REV = arg('trunk', 'a084874'), FACE = arg('face', 'visor');
if (!PORT) { console.error('usage: node style/city/tools/vanshots.mjs --port <n>'); process.exit(2); }
await fsp.mkdir(OUT, { recursive: true });
// <rev>'s copy of every file under style/city/vehicles/ that differs from this checkout: served in their place on --port + 1
function trunkServer() {
  const git = a => spawnSync('git', a, { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 26 });
  const names = git(['diff', '--name-only', REV, '--', 'style/city/vehicles']).stdout.toString().trim().split('\n').filter(Boolean), over = new Map();
  for (const n of names) { const r = git(['show', `${REV}:${n}`]); if (!r.status) over.set('/' + n, r.stdout); }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const srv = http.createServer(async (req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    try { const body = over.get(u) ?? await fsp.readFile(f); res.writeHead(200, { 'Content-Type': mime[path.extname(u)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); }
    catch { res.writeHead(404); res.end(); } });
  return new Promise(r => srv.listen(PORT + 1, '127.0.0.1', () => r({ srv, names: [...over.keys()] })));
}
const srv = await serve(), B = await chrome();
// a page up: the studio says so in its title ('ready'); the lineup has drawn once its document is complete and a few frames have run
const open = async (url, w, h) => { await B.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await B.send('Page.navigate', { url }); await new Promise(r => setTimeout(r, 300)); const studio = url.includes('/studio/');
  for (let k = 0; k < 600; k++) { await new Promise(r => setTimeout(r, 100)); const t = await B.ev(`document.readyState + '|' + document.title`, false).catch(() => '');
    if (t.endsWith('|error')) throw new Error('page error: ' + url + ' ' + await B.ev(`document.getElementById('err')?.textContent`, false).catch(() => ''));
    if (studio ? t.endsWith('|ready') : t.startsWith('complete')) break; }
  await new Promise(r => setTimeout(r, studio ? 200 : 2500)); };
const shot = async (file, fmt = 'png', q = 88) => { const r = await B.send('Page.captureScreenshot', fmt === 'png' ? { format: 'png' } : { format: 'jpeg', quality: q }); await fsp.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; };
const py = (src, args) => { const r = spawnSync('python3', ['-c', src, ...args], { encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); return r.stdout; };
const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'c2van-'));
try {
  if (ONLY.includes('lineup')) {
    const T = await trunkServer(); console.log(`lineup: ${REV}'s vehicles files served on ${PORT + 1}: ${T.names.join(', ') || '(none differ)'}`);
    try { for (const tod of ['day', 'night']) { const files = [];
      for (const [who, port] of [['lane', PORT], ['trunk', PORT + 1]]) { await open(`http://127.0.0.1:${port}/style/city/vehicles/lineup.html?tod=${tod}`, 1400, 800); files.push(await shot(path.join(tmp, `lineup-${tod}-${who}.png`))); }
      console.log(`lineup ${tod}: ` + py(`import sys
from PIL import Image, ImageChops
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB'); d=ImageChops.difference(a,b)
px=sum(1 for p in d.getdata() if p!=(0,0,0)); print(f"{a.size[0]}x{a.size[1]} px, differing pixels {px}, largest channel step {max(max(p) for p in d.getdata())} (this checkout vs ${REV})", end='')
a.save(sys.argv[3], quality=86)`, [...files, path.join(OUT, `lineup-${tod}.jpg`)])); } }
    finally { T.srv.close(); }
  }
  if (ONLY.includes('van')) for (const tod of ['day', 'night']) { await open(`http://127.0.0.1:${PORT}/style/city/vehicles/lineup.html?mode=van&tod=${tod}`, 1400, 800); await shot(path.join(OUT, `van-${tod}.jpg`), 'jpeg'); console.log('wrote', `van-${tod}.jpg`); }
  // the beats: a contact sheet each (eight stills, 4 × 2, the clock under each), from the studio's van set
  const STUDIO = `http://127.0.0.1:${PORT}/style/city/studio/cleaners.html?mode=beat&set=van&face=${FACE}`;
  const sheet = async (beat, times, q = '') => { const files = [], W = 640, H = 360;
    for (const t of times) { await open(`${STUDIO}&beat=${beat}&t=${t}&fw=${W}&fh=${H}${q}`, W, H); files.push(await shot(path.join(tmp, `${beat}-${files.length}.png`))); }
    const out = path.join(OUT, `beat-${beat}${q ? '-' + q.replace(/[&=]/g, '') : ''}.jpg`);
    py(`import sys
from PIL import Image, ImageDraw
out, ts, fs = sys.argv[1], sys.argv[2].split(','), sys.argv[3:]; ims = [Image.open(f).convert('RGB') for f in fs]; w, h = ims[0].size; c = Image.new('RGB', (w * 4, h * 2), (20, 20, 24)); d = ImageDraw.Draw(c)
for k, (im, t) in enumerate(zip(ims, ts)): x, y = (k % 4) * w, (k // 4) * h; c.paste(im, (x, y)); d.rectangle([x + w - 74, y + h - 24, x + w - 4, y + h - 4], fill=(23, 23, 27)); d.text((x + w - 68, y + h - 20), f't {float(t):.1f} s', fill=(255, 194, 26))
c.save(out, quality=86)`, [out, times.join(','), ...files]); console.log('wrote', path.relative(ROOT, out)); };
  if (ONLY.includes('beat')) {
    await sheet('out', [0, .5, 1.1, 1.6, 2.1, 2.6, 3.3, 5.0]);
    await sheet('in', [0, 1.6, 3.2, 4.0, 5.2, 6.4, 7.6, 9.4]);
    await sheet('back', [0, .6, 1.1, 1.8, 2.4, 2.9, 3.5, 6.0]);
    await sheet('in', [3.2, 4.4, 5.6, 7.6], '&tod=night');
  }
  // one clip: the carry's last metre into bag_in, then the last one in and the van away (≤ 15 s at 30 fps, VP9 CRF 27, frames deleted)
  if (ONLY.includes('clip')) { const W = 960, H = 540, FPS = 30, parts = [['in', 2.2, 9.6], ['back', 0, 6.6]]; let n = 0;
    for (const [beat, t0, t1] of parts) { await open(`${STUDIO}&beat=${beat}&t=${t0}&fw=${W}&fh=${H}`, W, H);
      for (let t = t0; t < t1 - 1e-9; t += 1 / FPS) { await B.ev(`window.__cl.seek(${t.toFixed(5)})`, false); const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 }); await fsp.writeFile(path.join(tmp, `f${String(n++).padStart(4, '0')}.jpg`), Buffer.from(r.result.data, 'base64')); } }
    if (n / FPS > 15) throw new Error('the clip is over 15 s: ' + n / FPS);
    const out = path.join(OUT, `beat-${FACE}.webm`), r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.jpg'), '-c:v', 'libvpx-vp9', '-crf', '27', '-b:v', '0', '-pix_fmt', 'yuv420p', '-row-mt', '1', out], { encoding: 'utf8' });
    if (r.status) throw new Error('ffmpeg: ' + r.stderr);
    console.log('wrote', path.relative(ROOT, out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB', `${(n / FPS).toFixed(2)} s at ${FPS} fps, ${W}×${H}, VP9 CRF 27; frames deleted`); }
} finally { await B.close(); if (srv) srv.kill(); await fsp.rm(tmp, { recursive: true, force: true }); }
