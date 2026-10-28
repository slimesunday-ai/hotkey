// HUMAN LAYER · SECTION 2a · the tape player's shots and clip, on your own replay (headless Chrome, raw CDP: ui/tools/cdp.mjs).
//   node style/city/ui/tape/tools/tapeshots.mjs [--base http://127.0.0.1:5334/style/city/] [--replay http://127.0.0.1:5265] [--out <dir>] [--png <dir>]
//        [--skins clean,98,zine] [--no-clip] [--from "D4 12:00"]
// The replay is put at --from and played at its own pace (a live season: the tape ends a game day back). PNGs go to --png (scratch);
// tapesheet.py makes the JPEG contact sheet from them; the clip (LIVE → Watch tape → scrub → play → back to LIVE) is written as webm to --out.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../tools/cdp.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5334/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5265'), OUT = path.resolve(opt('out', 'style/city/shots/human-layer/s2')), PNG = path.resolve(opt('png', path.join(os.tmpdir(), 'tape-shots')));
const SKINS = opt('skins', 'clean,98,zine').split(','), FROM = opt('from', 'D4 12:00'), CLIP = !args.includes('--no-clip'), W = 1280, H = 720;
const R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null), port = new URL(REPLAY).port;
await fs.mkdir(PNG, { recursive: true }); await fs.mkdir(OUT, { recursive: true });
const J = JSON.stringify, rect = async (S, sel) => S.ev(`(() => { const e = document.querySelector(${J(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
const clickSel = async (S, sel) => { const r = await rect(S, sel); if (!r) throw new Error('no ' + sel); await S.click(r.x + r.width / 2, r.y + r.height / 2); };
const pad = (r, p = 10) => ({ x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: Math.min(W, r.width + 2 * p), height: Math.min(H, r.height + 2 * p) });
// the camera over a point (an orbit pose: the rig takes it as its own)
const frameOn = (x, z, d = 1, y = 0) => `(() => { const C = __city; C.cam?.setMode?.('orbit', { instant: true }); C.controls.target.set(${x}, ${y} + 1, ${z}); C.camera.position.set(${x} + 9 * ${d}, ${y} + 8 * ${d}, ${z} + 12 * ${d}); C.camera.lookAt(C.controls.target); C.controls.update(); return 1; })()`;
async function load(S, skin) {
  await S.go(`${BASE}?sim=live&simport=${port}&ui=${skin}`, { until: 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading', ms: 180000 }); await sleep(5000); }
// a drawn (non-Local) agent with others around it, live
const busy = `(() => { const s = __ui.sim, L = s.agents().map(c => ({ c, w: s.where(c.handle) })).filter(x => x.w && x.w.drawn && !x.c.retired); let best = null;
  for (const a of L) { if (a.c.npc) continue; const n = L.filter(b => Math.hypot(b.w.x - a.w.x, b.w.z - a.w.z) < 16).length; if (!best || n > best.n) best = { h: a.c.handle, n, x: a.w.x, z: a.w.z }; } return best; })()`;
// on tape: a drawn agent with a fresh thought and the most thinkers round it
const thinky = `(() => { const sec = __ui.tape.secrets, M = window.__simlive.agents.map, t = __tape.time(); if (!sec) return null; const L = sec.thinks.filter(x => t - x.t < 80).map(x => ({ h: x.h, p: M.get(x.h)?.w?.p })).filter(x => x.p); let best = null;
  for (const a of L) { const n = L.filter(b => Math.hypot(b.p[0] - a.p[0], b.p[2] - a.p[2]) < 22).length; if (!best || n > best.n) best = { h: a.h, n, x: a.p[0], z: a.p[2] }; } return best; })()`;
const findThoughts = async S => { const H0 = await S.ev('__tape.window().horizon'); for (const back of [200, 420, 640, 900, 1200]) { await S.ev(`(__tape.seek(${H0 - back}, 'shot'), 1)`); await sleep(900); const b = await S.ev(thinky); if (b && b.n >= 2) return b; } return S.ev(thinky); };
const waitTape = async S => { for (let k = 0; k < 60; k++) { await sleep(250); const st = await S.ev('__ui.tape.stats()'); if (st.frames > 0) break; } };
const report = { shots: [], notes: [] };
for (const skin of SKINS) {
  const S = await open({ w: W, h: H });
  try {
    await R('/seek?t=' + encodeURIComponent(FROM)); await R('/speed?x=1');
    await load(S, skin);
    const a = await S.ev(busy); if (!a) throw new Error('no drawn agent');
    await S.ev(frameOn(a.x, a.z)); await sleep(1500);
    if (skin === 'clean') { await S.ev(`(__ui.dossier.open(${J(a.h)}), 1)`); await sleep(1600); await S.shot(path.join(PNG, `${skin}-live-dossier.png`)); report.shots.push('live-dossier'); }
    else { await S.ev(`(__ui.dossier.open(${J(a.h)}), 1)`); await sleep(1200); }
    // Watch tape (the dossier's button: a real click)
    const btn = await S.ev(`(() => { const b = [...document.querySelectorAll('.k-panel .d-actions .k-btn')].find(x => /Watch tape/.test(x.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await S.click(btn.x, btn.y); await waitTape(S); await sleep(3500);
    await S.shot(path.join(PNG, `${skin}-tape-open.png`));
    const bar = await rect(S, '.tp-bar'); await S.shot(path.join(PNG, `${skin}-transport-idle.png`), pad(bar));
    // hover a marker (the latest robbery, arrest or death if there is one)
    const ms = await S.ev('__ui.tape.transport.placed()'), pick = [...ms].reverse().find(m => ['rob', 'arrest', 'death'].includes(m.kind)) || ms[ms.length - 1];
    if (pick) { await S.move(pick.x, pick.y); await sleep(500); await S.shot(path.join(PNG, `${skin}-transport-hover.png`), pad({ ...bar, y: bar.y - 90, height: bar.height + 90 })); await S.move(pick.x, pick.y - 200); await sleep(200); }
    // the horizon wall, close up
    const tr = await S.ev('__ui.tape.transport.trackRect()'); { const wx = Math.max(0, tr.xh - 170); await S.shot(path.join(PNG, `${skin}-transport-wall.png`), { x: wx, y: bar.y - 4, width: Math.min(W - wx, tr.x + tr.w - wx + 14), height: bar.height + 8 }); }
    // scrubbing: press on the track, drag, shoot while the button is held
    const y = tr.y + tr.h / 2, x0 = tr.x0 + (tr.xh - tr.x0) * .55, x1 = tr.x0 + (tr.xh - tr.x0) * .62;
    await S.mouse('mouseMoved', x0, y); await S.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y, button: 'left', clickCount: 1, buttons: 1 });
    for (let k = 1; k <= 8; k++) { await S.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * k / 8, y, button: 'left', buttons: 1 }); await sleep(60); }
    const lat = await S.ev(`(() => { const t0 = performance.now(); return new Promise(res => { const tt = __tape.time(); const w = () => { const f = __ui.tape.stats(); if (performance.now() - t0 > 400 || (f.frames && Math.abs(f.t - tt) < 1)) res({ ms: +(performance.now() - t0).toFixed(1), rtt: f.rttMs }); else requestAnimationFrame(w); }; w(); }); })()`);
    report.notes.push({ skin, scrubLatency: lat }); await sleep(300);
    await S.shot(path.join(PNG, `${skin}-transport-scrub.png`), pad(bar));
    await S.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y, button: 'left', clickCount: 1, buttons: 0 }); await sleep(600);
    if (skin === 'clean') {
      // a DM with both parties on the street: seek there and frame them
      const dm = await S.ev(`(async () => { const L = __tape.events({ types: ['say'] }).filter(e => e.dm && e.to && e.to !== 'here').reverse();
        for (const e of L.slice(0, 40)) { __tape.seek(e.t + 2, 'shot'); await new Promise(r => setTimeout(r, 700)); const M = window.__simlive.agents.map, A = M.get(e.who)?.w?.p, B = M.get(e.to)?.w?.p;
          if (A && B && Math.hypot(A[0] - B[0], A[2] - B[2]) < 40) return { t: e.t, from: e.who, to: e.to, x: (A[0] + B[0]) / 2, z: (A[2] + B[2]) / 2, d: Math.hypot(A[0] - B[0], A[2] - B[2]) }; } return null; })()`);
      if (dm) { await S.ev('(__ui.dossier.close(), 1)'); await S.ev(frameOn(dm.x, dm.z, Math.max(1, dm.d / 12))); await sleep(2200); await S.shot(path.join(PNG, `${skin}-tape-dm.png`)); report.shots.push('tape-dm'); report.notes.push({ dm }); }
      else report.notes.push('no DM with both parties on the street within 40 m');
      // thought bubbles in a crowd: back at the busy agent, playing
      const b2 = await findThoughts(S); report.notes.push({ thoughtsAt: b2 }); if (b2) await S.ev(frameOn(b2.x, b2.z, 1.5)); await S.ev('(__tape.setSpeed(1), __tape.play(), 1)'); await sleep(2500); await S.shot(path.join(PNG, `${skin}-tape-thoughts.png`)); await S.ev('(__tape.pause(), 1)');
      // the dossier in tape mode: Pockets and Head, as of the scrub time
      await S.ev(`(__ui.dossier.open(${J(a.h)}), 1)`); await sleep(900);
      for (const tab of ['pockets', 'head']) { await clickSel(S, '#k-tab-' + tab); await sleep(700); const pr = await rect(S, '.k-panel.is-open'); await S.shot(path.join(PNG, `${skin}-dossier-${tab}.png`), pad(pr, 6)); }
      await clickSel(S, '#k-tab-record'); await sleep(300);
      // the frame time: bench while playing vs. live (rAF intervals, same camera)
      const perf = async () => S.ev(`(() => new Promise(res => { const d = []; let l = performance.now(), n = 0; const f = now => { d.push(now - l); l = now; if (++n < 240) requestAnimationFrame(f); else { d.sort((p, q) => p - q); res({ p50: +d[120].toFixed(2), p95: +d[228].toFixed(2), max: +d[239].toFixed(1) }); } }; requestAnimationFrame(f); }))()`);
      await S.ev('(__tape.setSpeed(4), __tape.play(), 1)'); report.notes.push({ framesTapePlaying4x: await perf(), tapeStats: await S.ev('__ui.tape.stats()') }); await S.ev('(__tape.pause(), 1)');
      await S.ev('(__ui.tape.close(), 1)'); await sleep(2500); report.notes.push({ framesLive: await perf(), afterClose: await S.ev('({ cam: __city.cam.mode, tape: __tape.active, map: __ui.tape.stats().map })') });
    } else {
      await S.ev('(__ui.dossier.close(), 1)'); const b2 = await findThoughts(S); if (b2) await S.ev(frameOn(b2.x, b2.z, 1.5)); await S.ev('(__tape.setSpeed(1), __tape.play(), 1)'); await sleep(2500);
      await S.shot(path.join(PNG, `${skin}-tape-thoughts.png`)); await S.ev('(__tape.pause(), 1)'); }
    if (S.errs.length) report.notes.push({ skin, errors: S.errs.slice(0, 5) });
  } finally { await S.close(); }
}
// ── the clip: LIVE → Watch tape → scrub → play → back to LIVE (clean)
if (CLIP) { const S = await open({ w: W, h: H });
  try {
    await R('/seek?t=' + encodeURIComponent(FROM)); await R('/speed?x=1'); await load(S, 'clean');
    const a = await S.ev(busy); await S.ev(frameOn(a.x, a.z)); await sleep(1500);
    const before = await S.ev('({ p: __city.camera.position.toArray().map(v => +v.toFixed(2)), t: __city.controls.target.toArray().map(v => +v.toFixed(2)), pins: __ui.city.pins })');
    await S.cast(true, { quality: 78 }); await sleep(700);
    const sc = await S.ev(`__ui.city.screenOf(${J(a.h)})`); if (sc) { await S.move((sc.x + sc.fx) / 2, (sc.y + sc.fy) / 2); await sleep(700); await S.click((sc.x + sc.fx) / 2, (sc.y + sc.fy) / 2); } else await S.ev(`(__ui.dossier.open(${J(a.h)}), 1)`);
    await sleep(1800);
    const btn = await S.ev(`(() => { const b = [...document.querySelectorAll('.k-panel .d-actions .k-btn')].find(x => /Watch tape/.test(x.textContent)); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await S.move(btn.x, btn.y); await sleep(500); await S.click(btn.x, btn.y); await sleep(4500);
    const tr = await S.ev('__ui.tape.transport.trackRect()'), y = tr.y + tr.h / 2, xs = tr.x0 + (tr.xh - tr.x0) * .985, xe = tr.x0 + (tr.xh - tr.x0) * .80;
    await S.mouse('mouseMoved', xs, y); await sleep(300); await S.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: xs, y, button: 'left', clickCount: 1, buttons: 1 });
    for (let k = 1; k <= 40; k++) { await S.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: xs + (xe - xs) * k / 40, y, button: 'left', buttons: 1 }); await sleep(45); }
    await S.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: xe, y, button: 'left', clickCount: 1, buttons: 0 }); await sleep(900);
    await S.key('Space', ' ', { keyCode: 32 }); await sleep(5000);
    const sp = await rect(S, '.tp-speeds button[data-x="16"]'); await S.click(sp.x + sp.width / 2, sp.y + sp.height / 2); await sleep(3500);
    await S.key('Space', ' ', { keyCode: 32 }); await sleep(600);
    await S.key('ArrowRight', 'ArrowRight', { keyCode: 39 }); await sleep(1200);
    const lb = await rect(S, '.tp-live'); await S.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await sleep(500); await S.click(lb.x + lb.width / 2, lb.y + lb.height / 2); await sleep(3500);
    await S.cast(false); await sleep(300);
    const after = await S.ev('({ p: __city.camera.position.toArray().map(v => +v.toFixed(2)), t: __city.controls.target.toArray().map(v => +v.toFixed(2)), pins: __ui.city.pins, dossier: __ui.dossier.current, tape: __tape.active })');
    report.notes.push({ clipCamera: { before, after } });
    const frames = S.frames.slice(), tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tape-clip-')), list = [];
    for (let k = 0; k < frames.length; k++) { const f = path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`); await fs.writeFile(f, Buffer.from(frames[k].data, 'base64')); const d = k + 1 < frames.length ? Math.max(.01, frames[k + 1].t - frames[k].t) : .1; list.push(`file '${f}'\nduration ${d.toFixed(4)}`); }
    list.push(`file '${path.join(tmp, `f${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`); await fs.writeFile(path.join(tmp, 'list.txt'), list.join('\n'));
    const webm = path.join(OUT, 'clip-live-tape-scrub-play-live.webm');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'fps=30,scale=1280:-2,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '1600k', webm]);
    report.notes.push({ clip: webm, frames: frames.length, bytes: (await fs.stat(webm)).size }); await fs.rm(tmp, { recursive: true, force: true });
    if (S.errs.length) report.notes.push({ clipErrors: S.errs.slice(0, 5) });
  } finally { await S.close(); } }
await fs.writeFile(path.join(PNG, 'report.json'), J(report, null, 1)); console.log(J(report, null, 1));
