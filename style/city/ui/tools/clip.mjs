// HUMAN LAYER · the section 1 clip: hover → open → follow → close, on a recorded run (your own replay), as webm + gif. First it measures
// the frame with the dossier closed and open in every skin (rAF intervals and the UI's own per-frame ms), so "zero cost when closed"
// and "no dent when open" are numbers, not claims.
//   node style/city/ui/tools/clip.mjs [--out style/city/shots/human-layer/s1] [--replay http://127.0.0.1:5264] [--skin clean] [--no-measure]
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from './cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5332/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5264'), OUT = path.resolve(opt('out', 'style/city/shots/human-layer/s1')), SKIN = opt('skin', 'clean');
const port = new URL(REPLAY).port, R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null), W = 1280, H = 720;
const S = await open({ w: W, h: H });
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
try {
  await R('/seek?t=' + encodeURIComponent('D1 13:00')); await R('/speed?x=1');
  await S.go(`${BASE}?sim=live&simport=${port}&ui=${SKIN}`, { until: 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading', ms: 180000 }); await sleep(6000);
  const crowd = await S.ev(`(() => { const s = __ui.sim, L = s.agents().map(c => ({ c, w: s.where(c.handle) })).filter(x => x.w && x.w.drawn && !x.c.retired); let best = null;
    for (const a of L) { if (a.c.npc) continue; const n = L.filter(b => Math.hypot(b.w.x - a.w.x, b.w.z - a.w.z) < 14).length; if (!best || n > best.n) best = { h: a.c.handle, n, w: a.w }; } return best; })()`);
  const frameOn = `(() => { const C = __city, w = __ui.sim.where(${JSON.stringify(crowd.h)}); C.controls.target.set(w.x, w.y + 1, w.z); C.camera.position.set(w.x + 10, w.y + 8, w.z + 14); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`;
  await S.ev(frameOn); await sleep(1500);
  const measure = ms => S.ev(`new Promise(res => { const f = [], u0 = __ui.stats().frameMs; let last = performance.now(); const t0 = last; const step = () => { const n = performance.now(); f.push(n - last); last = n; if (n - t0 < ${ms}) requestAnimationFrame(step); else res({ f, ui: __ui.stats() }); }; requestAnimationFrame(step); })`);
  const report = { when: new Date().toISOString(), agent: crowd.h, rows: [] };
  if (!args.includes('--no-measure')) for (const sk of ['clean', '98', 'zine']) {
    await S.ev(`(() => { for (let k = 0; k < 3 && __ui.skin() !== ${JSON.stringify(sk)}; k++) __ui.nextSkin(); __ui.dossier.close(); return 1; })()`); await sleep(800);
    const a = await measure(4000); await S.ev(`(__ui.dossier.open(${JSON.stringify(crowd.h)}), 1)`); await sleep(2500); const b = await measure(4000); await S.ev(`(__ui.dossier.close(), 1)`); await sleep(500);
    const row = { skin: sk, closedP50: q(a.f, .5), closedP95: q(a.f, .95), openP50: q(b.f, .5), openP95: q(b.f, .95), uiFrameMs: b.ui.frameMs, uiFrameMax: b.ui.frameMax };
    report.rows.push(row); console.log(JSON.stringify(row)); }
  await fs.mkdir(OUT, { recursive: true }); await fs.writeFile(path.join(OUT, 'dossier-cost.json'), JSON.stringify(report, null, 1));
  // ── the clip
  await S.ev(`(() => { for (let k = 0; k < 3 && __ui.skin() !== ${JSON.stringify(SKIN)}; k++) __ui.nextSkin(); return 1; })()`); await S.ev(frameOn); await S.move(200, 600); await sleep(1200);
  await S.cast(true, { quality: 82 }); await sleep(600);
  let p = await S.ev(`__ui.city.screenOf(${JSON.stringify(crowd.h)})`); const to = { x: p.x, y: (p.y + p.fy) / 2 };
  for (let k = 1; k <= 18; k++) { const t = k / 18, e = t * t * (3 - 2 * t); await S.move(200 + (to.x - 200) * e, 600 + (to.y - 600) * e); await sleep(35); }
  await sleep(900); p = await S.ev(`__ui.city.screenOf(${JSON.stringify(crowd.h)})`); await S.click(p.x, (p.y + p.fy) / 2); await sleep(1800);
  await S.key('KeyF', 'f', { keyCode: 70 }); await sleep(4200);
  await S.key('Escape', 'Escape', { keyCode: 27 }); await sleep(1000);
  await S.key('Escape', 'Escape', { keyCode: 27 }); await sleep(2200);
  await S.cast(false); await sleep(300);
  const frames = S.frames.slice(); console.log(`${frames.length} frames`);
  const tmp = await fs.mkdtemp(path.join(OUT, '.clip-')), list = [];
  for (let k = 0; k < frames.length; k++) { const f = path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`); await fs.writeFile(f, Buffer.from(frames[k].data, 'base64')); const d = k + 1 < frames.length ? Math.max(.01, frames[k + 1].t - frames[k].t) : .1; list.push(`file '${f}'\nduration ${d.toFixed(4)}`); }
  list.push(`file '${path.join(tmp, `f${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`); await fs.writeFile(path.join(tmp, 'list.txt'), list.join('\n'));
  const webm = path.join(OUT, `clip-hover-open-follow-close-${SKIN}.webm`), gif = path.join(OUT, `clip-hover-open-follow-close-${SKIN}.gif`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '3M', webm]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'fps=10,scale=600:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
  await fs.rm(tmp, { recursive: true, force: true }); console.log('→', webm, '\n→', gif);
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5));
} finally { await S.close(); }
