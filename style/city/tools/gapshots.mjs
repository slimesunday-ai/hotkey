// C2-GAPS · THE GAPS' PICTURES for slime (2026-11-05): who takes the bodies the van can't reach (slime, 11-05: "i think just the gaps we
// fill with birds and decay, max gore lol, birds (pigeons and gulls) 1/3 and  then that last 1/3rd is  decay over time. both leave
// stains"). For each taker a contact sheet of its stages, by day (top row) and at night (bottom row), on a real landing (bodyland.mjs's
// rows) in the record's page (404-A, tv=0), the camera from the road side 9 m off and 6 m up; and one clip (the day run as a time-lapse,
// at most 15 s at 20 fps, 720 × 405, VP9 CRF 44: frames to a temp folder, deleted after encoding):
//   pigeons.jpg · gulls.jpg · decay.jpg     (+ pigeons.webm · gulls.webm · decay.webm with --clips)
//   node style/city/tools/gapshots.mjs --port 5993 [--out style/city/shots/c2-gaps] [--only pigeons,gulls,decay] [--clips]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, PORT, arg, chrome, serve } from './c2lib.mjs';

const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-gaps'))), ONLY = arg('only', 'pigeons,gulls,decay').split(','), CLIPS = process.argv.includes('--clips');
if (!PORT) { console.error('usage: node style/city/tools/gapshots.mjs --port <n>'); process.exit(2); }
const ALL = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err && r.body).map(r => ({ place: r.place, d: r.d, body: r.body })));
// the landings (gapsweep's numbering): a suburb's one-way kerb (pigeons), a docks one-way kerb by the bay (gulls), another suburb kerb (decay)
const TAKERS = { pigeons: { k: 180, split: 'birds' }, gulls: { k: 128, split: 'birds' }, decay: { k: 4, split: 'decay' } };
// the stages each sheet shows: [label, test on the page's state]
const STAGES = {
  birds: [['in from out of view', s => s.inN >= 3], ['the first wounds', s => s.cover >= .3], ['torn open', s => s.cover >= 1 && s.eat >= .03], ['eaten down', s => s.eat >= .5], ['to the bones', s => s.eat >= .97], ['the stain (and the bones)', s => s.ended]],
  decay: [['fresh', s => s.k >= .01], ['bloat', s => s.k >= .2], ['discolour', s => s.k >= .4], ['flies', s => s.k >= .58], ['collapse', s => s.k >= .8], ['the stain (and the bones)', s => s.ended]],
};
const W = 960, H = 600, CW = 960, CH = 540;
const STEP = (V, split) => `(async () => { const c = window.__city, A = c.traffic.accidents, G = A.gaps, B = ${JSON.stringify(V.body)};
  if (!window.__gs) { c.pauseLoop(true); A.GORE.on = false; A.cleaners.CLEAN.on = false; G.GAPS.birds = ${split === 'birds' ? 1 : 0};
    for (const el of document.body.children) if (el.id !== 'stage') el.style.visibility = 'hidden';
    if (c.cam && c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true });
    const fx = Math.cos(B.yaw), fz = -Math.sin(B.yaw), side = [-fz, fx]; c.controls.target.set(B.x, .4, B.z); c.camera.position.set(B.x + side[0] * 9 - fx * 4.5, 6, B.z + side[1] * 9 - fz * 4.5); c.camera.lookAt(B.x, .4, B.z); c.controls.update?.(); c.camera.lookAt(B.x, .4, B.z);
    for (let k = 0; k < 400; k++) { c.tick(.1, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
    for (let t = 0; t < 30 && c.traffic.sim.cars.some(o => !o.gone && Math.hypot(o.x - B.x, o.z - B.z) < o.len / 2 + 1.2); t += .1) c.tick(.1, 1);
    window.__gs = { K: A.lay(B.x, B.z, B.yaw) }; c.cover(false); }
  return true; })()`;
const ADV = n => `(async () => { const c = window.__city, K = window.__gs.K; for (let k = 0; k < ${n}; k++) c.tick(.1, 1); await new Promise(r => requestAnimationFrame(() => r()));
  const T = K.take; return { taker: K.taker, ended: !!T?.ended, cover: T?.F?.cover ?? 0, eat: T?.F?.eat ?? 0, k: T?.D?.k ?? 0, inN: T?.F ? T.F.birds.filter(b => b.shown && !b.gone && b.st === 'in' && b.pi >= 1).length : 0, kind: T?.F?.kind ?? null }; })()`;

await fsp.mkdir(OUT, { recursive: true });
const srv = await serve(); const made = [];
try {
  for (const name of ONLY) { const tk = TAKERS[name], V = { ...ALL[tk.k], k: tk.k }, kind = tk.split, rows = [];
    for (const tod of ['day', 'night']) { const B = await chrome(); const stills = []; let clipDir = null, nf = 0;
      try { await B.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
        await B.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?sim=record&feed=/core/runs/404-A/feed.jsonl&tv=0${tod === 'night' ? '&tod=night' : ''}` });
        for (let t = 0; t < 480; t++) { await new Promise(r => setTimeout(r, 500)); if (await B.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.gaps && window.__record?.draw?.stage?.ctx)`, false).catch(() => false)) break; }
        await new Promise(r => setTimeout(r, 3000)); await B.ev(STEP(V, kind), true, 240000);
        if (CLIPS && tod === 'day') clipDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gapshots-clip-'));
        const st = STAGES[kind]; let si = 0, s = null;
        for (let n = 0; n < 2400 && si < st.length; n++) { s = await B.ev(ADV(3), true, 60000);
          if (clipDir && nf < 300) { const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip: { x: 0, y: (H - CH) / 2, width: CW, height: CH, scale: 1 } }); await fsp.writeFile(path.join(clipDir, `f${String(nf++).padStart(4, '0')}.jpg`), Buffer.from(r.result.data, 'base64')); }
          while (si < st.length && st[si][1](s)) { const r = await B.send('Page.captureScreenshot', { format: 'png' }); const f = path.join(os.tmpdir(), `gapshots-${name}-${tod}-${si}.png`); await fsp.writeFile(f, Buffer.from(r.result.data, 'base64')); stills.push([f, st[si][0]]); si++; } }
        console.log(`${name} ${tod}: landing #${tk.k} (${V.place}, ${V.d}) taker ${s?.taker}${s?.kind ? ' (' + s.kind + ')' : ''} · ${stills.length} stills`);
        if (clipDir && nf) { const clip = path.join(OUT, `${name}.webm`), r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '20', '-i', path.join(clipDir, 'f%04d.jpg'), '-t', '15', '-vf', 'scale=720:-2', '-c:v', 'libvpx-vp9', '-crf', '44', '-b:v', '0', '-pix_fmt', 'yuv420p', clip], { encoding: 'utf8' });
          if (r.status) console.error('ffmpeg: ' + r.stderr); else { made.push(clip); console.log(`  clip ${path.relative(ROOT, clip)}: ${nf} frames, ${(nf / 20).toFixed(1)} s`); } }
      } finally { if (clipDir) await fsp.rm(clipDir, { recursive: true, force: true }); await B.close(); }
      rows.push([tod, stills]); }
    // the sheet: a row per time of day, a still per stage, each labelled
    const sheet = path.join(OUT, `${name}.jpg`), py = `
import sys, json
from PIL import Image, ImageDraw
rows = json.loads(sys.argv[2]); title = sys.argv[3]; tw, th = 480, 300
cols = max(len(r[1]) for r in rows); S = Image.new('RGB', (tw * cols, 28 + (th + 22) * len(rows)), (18, 18, 20)); d = ImageDraw.Draw(S); d.text((8, 8), title, fill=(235, 230, 220))
for ri, (tod, stills) in enumerate(rows):
  for ci, (f, label) in enumerate(stills):
    im = Image.open(f).convert('RGB').resize((tw, th)); y = 28 + ri * (th + 22); S.paste(im, (ci * tw, y)); d.text((ci * tw + 6, y + th + 5), f'{tod} · {ci + 1} · {label}', fill=(235, 230, 220))
S.save(sys.argv[1], quality=86)`;
    const r = spawnSync('python3', ['-c', py, sheet, JSON.stringify(rows), `${name} — landing #${tk.k} (${V.place}, ${V.d}) · the stages by day (top) and at night (bottom)`], { encoding: 'utf8' });
    if (r.status) throw new Error(r.stderr); made.push(sheet); for (const [, st] of rows) for (const [f] of st) await fsp.rm(f, { force: true }); console.log(`  sheet ${path.relative(ROOT, sheet)}`); }
} finally { if (srv) srv.kill(); }
console.log('gapshots: ' + made.map(f => path.relative(ROOT, f)).join(' · '));
