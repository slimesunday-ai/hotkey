// C2-lock2 · FOLLOW'S LINE IS WHAT IT WAS (Lock's ghosts are Lock's only: camera/fade.js CAM.lock.lineAlpha). Headless Chrome on
// ?sim=record: the agent's card opened with a real click and its Follow pressed with a real click, the record played at --speed×. Every
// frame, for every walker within --r m of the lens: its alpha by this checkout's fadeOfWalker and by --ref's (the same file at a git
// revision, e.g. trunk before the ghosts: copied under tmp/ and loaded by the page as a module of its own), the camera at the lens and
// the subject's feet as the rig hands them to setFade; and the fade's own line uniform (uCfLine) and the lock hole's strength, which
// under Follow must stay (0, 0, 0, 0) and 0. PASS when every alpha is equal (to 1e-12) and the uniforms never move, over > 0 walkers.
//   node style/city/tools/followlinecheck.mjs --port 5973 [--ref 8ed8f8d] [--seed 404] [--id a10] [--at 6122] [--frames 900] [--speed 10] [--r 30]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chrome, ready, serve } from './recordscenario.mjs';
import { ROOT, arg, sleep, FEED, tod, clickAgent, centre, press, BASE } from './c2lib.mjs';

const REF = arg('ref', '8ed8f8d'), SEED = +arg('seed', 404), ID = arg('id', 'a10'), AT = +arg('at', 6122), FRAMES = +arg('frames', 900), SPEED = +arg('speed', 10), R = +arg('r', 30);
const REFDIR = path.join(ROOT, 'tmp/c2-lock2/ref', REF);

async function main() {
  // the reference: fade.js with the two files it imports, at REF
  for (const f of ['style/city/camera/fade.js', 'style/city/camera/config.js', 'style/city/gpu.js']) {
    const r = spawnSync('git', ['show', `${REF}:${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }); if (r.status) throw new Error(r.stderr);
    await fs.mkdir(path.dirname(path.join(REFDIR, f)), { recursive: true }); await fs.writeFile(path.join(REFDIR, f), r.stdout); }
  const refUrl = '/' + path.relative(ROOT, path.join(REFDIR, 'style/city/camera/fade.js'));
  const served = await serve(), B = await chrome(); let ok = false;
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(AT)}&recordAt=${AT}&recordSpeed=${SPEED}&recordPaused=1&simtod=0` });
    await ready(B, 240000); await sleep(4000);
    const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}; })()`);
    let on = false; for (let k = 0; k < 3 && !on; k++) { if (await clickAgent(B, ID).catch(() => null) === ID) { const b = await centre(B, `document.querySelector('#r-dossier [data-act=follow]')`); if (b) await press(B, b); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(1500); }
    if (!on) throw new Error('could not follow ' + ID);
    await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`);
    const r = await B.ev(`(async () => { const F = await import('/style/city/camera/fade.js'), G = await import('/style/city/gpu.js'), T = await import(${JSON.stringify(refUrl)}), c = window.__city, P = window.__record.player;
      const W = { frames: 0, follow: 0, walkers: 0, maxDiff: 0, unequal: [], uniforms: [], minAlpha: 1, onLine: 0 };
      P.play(); await new Promise(res => { const f = () => { if (W.frames >= ${FRAMES}) { P.pause(); return res(); } W.frames++;
        const s = c.cam.mode === 'follow' ? c.cam.subject : null, p = c.camera.position;
        if (s) { W.follow++; const u = F.FADE_UNIFORMS.uCfLine.value, h = G.HOLE.a.value.w; if ((u.x || u.y || u.z || u.w || h) && W.uniforms.length < 8) W.uniforms.push([u.x, u.y, u.z, u.w, h]);
          for (const w of c.peds?.sim?.walkers || []) { if (w.gone || Math.hypot(w.p[0] - p.x, w.p[2] - p.z) > ${R}) continue; const a = F.fadeOfWalker(w.p, p, s.p), b = T.fadeOfWalker(w.p, p, s.p); W.walkers++;
            if (a < W.minAlpha) W.minAlpha = a; if (a < .999) W.onLine++; const d = Math.abs(a - b); if (d > W.maxDiff) W.maxDiff = d; if (d > 1e-12 && W.unequal.length < 8) W.unequal.push([w.id, a, b]); } }
        requestAnimationFrame(f); }; requestAnimationFrame(f); }); return W; })()`, true, 600000);
    ok = r.follow > 0 && r.walkers > 0 && r.unequal.length === 0 && r.uniforms.length === 0;
    console.log(`followlinecheck · seed ${SEED} · ${ID} from ${AT} at ${SPEED}× · this checkout against ${REF}: ${JSON.stringify(r)}`);
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
  } finally { await B.close(); if (served) served.kill(); console.log(ok ? 'FOLLOWLINECHECK PASS' : 'FOLLOWLINECHECK FAIL'); process.exitCode = ok ? 0 : 1; }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
