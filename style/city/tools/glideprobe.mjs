// C2-camera2 · THE ENTER GLIDE INTO FOLLOW, FRAME BY FRAME (docs/redesign/camera-20261103.md: the glide owns the arm while it runs).
// Headless Chrome on ?sim=record, seed 404, the record paused (the agent still; the crowd and the camera live). From an orbit camera on a
// ring round the agent (--r m out, at --heights, on 8 bearings: beside the buildings of its street, some with a wall onto the glide's
// path), F's way into follow (the rig's setMode('follow')), and for --secs s every frame: how it went in (glide or cut), the camera's
// move from the frame before (m), and whether a wall capped the arm while it glided (follow dbg armColl < its length). Per trial and
// in all: the largest per-frame move while gliding and in the second after, and the trials a wall capped.
//   node style/city/tools/glideprobe.mjs --port 5965 [--id a12] [--at 2716] [--tod night] [--r 22,40] [--heights 2.5,7] [--secs 3.5] [--tag after]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5965), SEED = 404, ID = arg('id', 'a12'), AT = +arg('at', 2716), TOD = arg('tod', 'night'), SECS = +arg('secs', 3.5), TAG = arg('tag', 'probe');
const RS = arg('r', '22,40').split(',').map(Number), HS = arg('heights', '2.5,7').split(',').map(Number), OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera2')));
const BASE = `http://127.0.0.1:${PORT}`, sleep = ms => new Promise(r => setTimeout(r, ms));

const TRIAL = (id, r, h, b, secs) => `(async () => { const c = window.__city, w = c.cam.people.byAid(${JSON.stringify(id)}); if (!w) return null;
  c.cam.toOrbit({ instant: true }); const x = w.p[0] + Math.sin(${b}) * ${r}, z = w.p[2] + Math.cos(${b}) * ${r};
  c.camera.position.set(x, ${h}, z); c.controls.target.set(w.p[0], 1, w.p[2]); c.controls.update?.();
  for (let k = 0; k < 20; k++) await new Promise(q => requestAnimationFrame(q));
  const how = c.cam.setMode('follow', { subject: w }), rows = [], P = c.camera.position, t0 = performance.now(); let last = [P.x, P.y, P.z];
  while (performance.now() - t0 < ${secs * 1000}) { await new Promise(q => requestAnimationFrame(q)); const g = c.cam.follow?.dbg; if (!g) continue;
    rows.push({ t: performance.now() - t0, d: Math.hypot(P.x - last[0], P.y - last[1], P.z - last[2]), enter: g.enter, capped: g.enter && g.armColl < g.dist - .05, arm: g.arm, L: g.dist }); last = [P.x, P.y, P.z]; }
  return { how: String(how), from: [x, ${h}, z].map(v => +v.toFixed(1)), rows }; })()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), out = [];
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${TOD}&simtod=0&recordAt=${AT}&recordPaused=1&recordSpeed=1` });
    let ok = false; for (let t = 0; t < 600 && !ok; t++) { ok = await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1)`, false).catch(() => false); if (!ok) await sleep(400); }
    if (!ok) throw new Error('the record page did not load'); await sleep(4000);
    for (const r of RS) for (const h of HS) for (let k = 0; k < 8; k++) {
      const b = k * Math.PI / 4, T = await B.ev(TRIAL(ID, r, h, b, SECS)); if (!T) { console.log('no walker for', ID); continue; }
      const g = T.rows.filter(x => x.enter), after = T.rows.filter(x => !x.enter && x.t < (g.at(-1)?.t ?? 0) + 1000);
      const R = { r, h, bearing: +b.toFixed(2), how: T.how, from: T.from, glideFrames: g.length, capped: g.filter(x => x.capped).length, maxGlide: +Math.max(0, ...g.map(x => x.d)).toFixed(3), maxAfter: +Math.max(0, ...after.map(x => x.d)).toFixed(3), armEnd: +(T.rows.at(-1)?.arm ?? 0).toFixed(2), Lend: +(T.rows.at(-1)?.L ?? 0).toFixed(2) };
      out.push(R); console.log(JSON.stringify(R));
    }
    const glides = out.filter(x => x.glideFrames > 0), capped = glides.filter(x => x.capped > 0);
    console.log(`glideprobe ${TAG}: ${glides.length} glides of ${out.length} trials, ${capped.length} capped by a wall; largest per-frame move: gliding ${Math.max(0, ...glides.map(x => x.maxGlide))} m (capped trials ${Math.max(0, ...capped.map(x => x.maxGlide))} m), the second after ${Math.max(0, ...glides.map(x => x.maxAfter))} m; arm at the end over its length in ${out.filter(x => x.armEnd > x.Lend + .3).length} trials`);
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
  await fs.writeFile(path.join(OUT, `${TAG}-glideprobe.json`), JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
