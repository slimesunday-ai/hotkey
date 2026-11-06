// C2 · THE CLEANERS' PICTURES for slime (lane C2-cleaners-art, 2026-11-04): the look sheets and the one beat clip, from the Cleaners
// studio (style/city/studio/cleaners.html) in headless Chrome.
//   look-day.jpg, look-night.jpg   both face variants (visor, respirator), front and back three-quarter, at the near, mid and far
//                                  tiers (14, 70, 200 m through a long lens: the tier's geometry and colours, not its pixel size)
//   beat.webm                      the whole beat on a stand-in body, ≤ 15 s at 30 fps, 960 × 540, VP9 CRF 27 (slime 11-04: "limit the
//                                  ammount of recording"): the frames are written to a temp folder and deleted after encoding
//   node style/city/tools/cleanersshots.mjs --port 5971 [--out style/city/shots/c2-cleaners] [--only look,beat] [--face visor|mask]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started; Chrome's profile is a
// temp folder removed on exit (recordscenario.mjs chrome()).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, PORT, arg, chrome, serve } from './c2lib.mjs';

const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-cleaners'))), ONLY = arg('only', 'look,beat').split(','), FACE = arg('face', 'visor');
const BASE = `http://127.0.0.1:${PORT}/style/city/studio/cleaners.html`;
if (!PORT) { console.error('usage: node style/city/tools/cleanersshots.mjs --port <n>'); process.exit(2); }
await fsp.mkdir(OUT, { recursive: true });
const srv = await serve(), B = await chrome();
const open = async (q, w, h) => { await B.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await B.send('Page.navigate', { url: `${BASE}?${q}&fw=${w}&fh=${h}` });
  for (let k = 0; k < 600; k++) { await new Promise(r => setTimeout(r, 100)); const t = await B.ev('document.title', false).catch(() => ''); if (t === 'ready') return; if (t === 'error') break; }
  throw new Error('the studio did not draw: ' + (await B.ev(`document.getElementById('err').textContent`, false).catch(() => '?'))); };
const jpeg = async (file, q = 85) => { const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: q }); await fsp.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; };
const py = (src, args) => { const r = spawnSync('python3', ['-c', src, ...args], { encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); };
try {
  if (ONLY.includes('look')) {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cleaners-look-'));
    for (const tod of ['day', 'night']) { const files = [];
      for (const tier of ['near', 'mid', 'far']) { await open(`mode=look&tier=${tier}&tod=${tod}`, 1200, 420); files.push(await jpeg(path.join(tmp, `${tod}-${tier}.jpg`))); }
      const out = path.join(OUT, `look-${tod}.jpg`);
      py(`import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w=ims[0].width; c=Image.new('RGB',(w,sum(i.height for i in ims)))
y=0
for i in ims: c.paste(i,(0,y)); y+=i.height
c.save(sys.argv[1], quality=84)`, [out, ...files]);
      console.log('wrote', path.relative(ROOT, out)); }
    await fsp.rm(tmp, { recursive: true, force: true });
  }
  if (ONLY.includes('beat')) {
    const W = 960, H = 540, FPS = 30, DUR = 15, tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cleaners-beat-'));
    await open(`mode=beat&t=0&face=${FACE}`, W, H);
    for (let k = 0; k < DUR * FPS; k++) { await B.ev(`window.__cl.seek(${(k / FPS).toFixed(5)})`, false); await jpeg(path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`), 90); }
    const out = path.join(OUT, `beat-${FACE}.webm`);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.jpg'), '-c:v', 'libvpx-vp9', '-crf', '27', '-b:v', '0', '-pix_fmt', 'yuv420p', '-row-mt', '1', out], { encoding: 'utf8' });
    await fsp.rm(tmp, { recursive: true, force: true });   // (the frames go: slime 11-04, the space rule)
    if (r.status) throw new Error('ffmpeg: ' + r.stderr);
    console.log('wrote', path.relative(ROOT, out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB', `${DUR} s at ${FPS} fps, ${W}×${H}, VP9 CRF 27; frames deleted`);
  }
} finally { await B.close(); if (srv) srv.kill(); }
