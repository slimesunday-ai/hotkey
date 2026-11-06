// C2-lock2 · THE GHOSTS ON LOCK'S LINE, STILLED FOR slime (slime 11-05: "we cant do see through for people near the camera line? like
// drop their opacitiy or something, similar to what we did with buildings?" · "ghost the cars, lock only"). Headless Chrome on
// ?sim=record, per case id:minute: the agent's card opened with a real click at --from and its Lock pressed (lockprobe's way in, so the
// viewer's angle and distance are lockprobe's), the page loaded paused at the minute with ?follow=<id>&lock=1 (the record's reload, that
// angle restored), and the SAME frame stilled at each --alphas value of CAM.lock.lineAlpha (set on the live config, the frame held
// paused; put back after). With each still, what the homes' depth pick at the person's chest reads (lockprobe's rule: visible or not)
// and the walkers and cars the line touches (fade.js's own CPU rule for walkers: their alpha).
//   node style/city/tools/lockghost.mjs --port 5971 [--cases a10:6130,a10:6722:car] [--alphas .2,.35,.5] [--from 6110] [--seed 404] [--out dir]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chrome, ready, serve } from './recordscenario.mjs';
import { ROOT, arg, sleep, FEED, tod, clickAgent, centre, press, BASE } from './c2lib.mjs';

const SEED = +arg('seed', 404), FROM = +arg('from', 4 * 1440 + 350), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-lock2/ghost')));
const CASES = String(arg('cases', 'a10:6130,a10:6722:car')).split(',').map(c => { const [id, m, car] = c.split(':'); return { id, m: +m, car: car === 'car' }; });
// (a case id:minute:car plays on from the minute at 10× until a car of the traffic crosses the line from the lens to the person — its
// centre within 2.5 m of the segment's middle 15–90 % — and pauses there: the traffic stands still while the record is paused)
const CATCH = id => `new Promise(res => { const c = window.__city, P = window.__record.player, t0 = performance.now();
  const f = () => { const s = c.cam.subject, L = c.camera.position; if (!s || performance.now() - t0 > 120000) { P.pause(); return res(null); }
    for (const k of c.traffic?.sim?.cars || []) { if (!k || k.gone) continue; const ux = s.p[0] - L.x, uz = s.p[2] - L.z, l2 = ux * ux + uz * uz, t = ((k.x - L.x) * ux + (k.z - L.z) * uz) / l2;
      if (t > .15 && t < .9 && Math.hypot(L.x + ux * t - k.x, L.z + uz * t - k.z) < 2.5 && !(s.car && s.car === k)) { P.pause(); return res({ minute: +P.minute.toFixed(3), car: [+k.x.toFixed(2), +k.z.toFixed(2)] }); } }
    requestAnimationFrame(f); }; P.setSpeed(10); P.play(); requestAnimationFrame(f); })`;
const ALPHAS = String(arg('alphas', '.2,.35,.5')).split(',').map(Number);

const READ = id => `(async () => { const city = window.__city, T = city.THREE, s = city.cam.subject, H = city.recordHomes?.H, F = await import('/style/city/camera/fade.js');
  const chest = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), v = chest.clone().project(city.camera), lens = city.camera.position.clone(), d = lens.distanceTo(chest), fp = s.p;
  const r = city.renderer.domElement.getBoundingClientRect(), h = await H.hitAt(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height);
  const vis = !h || h.distanceTo(lens) >= d - .5 || (Math.hypot(h.x - fp[0], h.z - fp[2]) < .75 && h.y > fp[1] - .1 && h.y < fp[1] + 2.1);
  const line = []; for (const w of city.peds?.sim?.walkers || []) { if (w.gone || w === s) continue; const a = F.fadeOfWalker(w.p, lens, s.p); if (a < .999) line.push([w.agent ? w.aid : 'walker#' + w.id, +a.toFixed(3)]); }
  return { minute: +window.__record.player.minute.toFixed(3), on: city.cam.mode === 'lock' && s.aid === ${JSON.stringify(id)}, ride: !!s.ride, lineAlpha: city.cam.config.lock.lineAlpha, uLine: [...Object.values(F.FADE_UNIFORMS.uCfLine.value)].map(x => +x.toFixed(3)),
    pick: h ? [h.x, h.y, h.z].map(x => +x.toFixed(2)) : null, visible: vis, walkersOnLine: line }; })()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(); let bad = false;
  try {
    for (const { id, m, car } of CASES) { const B = await chrome();
      try {
        const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'lock' && c.subject?.aid === ${JSON.stringify(id)}; })()`);
        await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=60&recordPaused=1` }); await ready(B, 240000); await sleep(4000);
        let on = false; for (let k = 0; k < 3 && !on; k++) { if (await clickAgent(B, id).catch(() => null) === id) { const b = await centre(B, `document.querySelector('#r-dossier [data-act=lock]')`); if (b) await press(B, b); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(2000); }
        if (!on) { console.log(`${id}: could not lock`); bad = true; continue; } await sleep(600);
        B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(m)}&recordAt=${m}&recordSpeed=10&recordPaused=1&follow=${id}&lock=1` });
        await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(2000)]); await ready(B, 240000); await sleep(4000);
        for (let j = 0; j < 30 && !(await isOn()); j++) await sleep(300); await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`); await sleep(2500);
        if (car) { const got = await B.ev(CATCH(id), true, 180000); console.log(`${id} @${m}: a car on the line ${JSON.stringify(got)}`); if (!got) { bad = true; continue; } await sleep(2000); }
        const keep = await B.ev('window.__city.cam.config.lock.lineAlpha');
        for (const a of ALPHAS) { await B.ev(`(window.__city.cam.config.lock.lineAlpha = ${a}, true)`); await sleep(1200);
          const r = await B.ev(READ(id)), s = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }), f = path.join(OUT, `ghost-${SEED}-${id}-${m}${car ? "-car" : ""}-alpha${a}.jpg`);
          await fs.writeFile(f, Buffer.from(s.result.data, 'base64')); console.log(`${id} @${m} lineAlpha ${a}: ${JSON.stringify(r)}\n   ${f}`); }
        await B.ev(`(window.__city.cam.config.lock.lineAlpha = ${keep}, true)`);
        if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
      } finally { await B.close(); } }
  } finally { if (served) served.kill(); process.exitCode = bad ? 1 : 0; }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
