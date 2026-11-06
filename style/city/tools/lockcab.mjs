// C2-lock2 · THE CAB A LOCKED PERSON RIDES IN (slime's call: whether it goes see-through). Headless Chrome on ?sim=record, one Chrome:
//   1. at --from, paused: the agent's card opened with a real click and its Lock pressed (lockprobe's way in: lockprobe's angle and distance)
//   2. each of the agent's cab trips between --from and --to (the drawing's own trips: a taxi leg), the page loaded a little before it
//      with ?follow=<id>&lock=1 and played at --speed× through it. lockprobe's pick every --every frames while the lock is on the agent
//      (its rule, its body box), each sample marked ridden (the rig's subject is the ride's stand-in) or not, and a blocked one marked
//      THE CAB when the pick's point is within 2.6 m of the car the stand-in rides (lockprobe's own "car" reach)
//   3. stills, paused mid-ride on the first trip: A the cab drawn as now (fade.js's line dissolves it: it is a body on the line to the
//      ride's stand-in); then two PREVIEWS, not changes, put back after: C the cab drawn whole (the line leaves its bodies drawn:
//      CAM.fade.lineAlpha 1, for the still only); B the cab drawn with a hole through its roof (C, and the cars' body materials marked
//      gpu.js holeStatic, so the lock hole cuts every car body on its cone: the cab ridden in is the one on it)
//   node style/city/tools/lockcab.mjs --port 5973 --id a19 [--from 6110] [--to 7570] [--seed 404] [--speed 10] [--every 6] [--out dir]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chrome, ready, serve } from './recordscenario.mjs';
import { ROOT, arg, sleep, FEED, tod, clickAgent, centre, press, BASE } from './c2lib.mjs';

const SEED = +arg('seed', 404), ID = arg('id', 'a19'), FROM = +arg('from', 4 * 1440 + 350), TO = +arg('to', 5 * 1440 + 370), SPEED = +arg('speed', 10), EVERY = +arg('every', 6);
const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-lock2')));

const TRIPS = (id, from, to) => `(() => { const D = window.__record.draw, L = D.timeline.segs.get(${JSON.stringify(id)}) || [], out = [];
  for (let i = 0; i < L.length; i++) { const d = D.rule.at(${JSON.stringify(id)}, i); if (!d?.trip || d.dep < ${from} || d.dep > ${to}) continue; const t = d.trip.legs.find(l => l.kind === 'taxi');
    if (t) out.push({ dep: d.dep, arr: d.trip.arr, taxi: [t.dep, t.arr] }); } return out; })()`;
function sampler(id, o) {
  const city = window.__city, T = city.THREE, H = city.recordHomes?.H, P = window.__record.player, W = window.__lc = { s: { all: 0, vis: 0, ride: 0, rideVis: 0, cab: 0, other: 0 }, done: false, mid: null };
  let fno = 0, busy = 0;
  const f = () => { if (W.done) return; fno++;
    if (P.running && P.speed !== o.speed) P.setSpeed(o.speed);
    if (P.running && P.minute >= o.to) { P.pause(); W.done = true; return; }
    const c = city.cam, s = c?.subject, on = c?.mode === 'lock' && !!s && s.aid === id && !s.gone;
    if (on && H && fno % o.every === 0 && !busy) { const chest = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), v = chest.clone().project(city.camera), lens = city.camera.position.clone(), d = lens.distanceTo(chest), fp = [s.p[0], s.p[1], s.p[2]], ride = !!s.ride, car = s.car;
      if (!(v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1)) { const r = city.renderer.domElement.getBoundingClientRect(); busy = 1;
        H.hitAt(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height).then(h => { busy = 0; const S = W.s; S.all++; if (ride) S.ride++;
          if (!h || h.distanceTo(lens) >= d - .5 || (Math.hypot(h.x - fp[0], h.z - fp[2]) < .75 && h.y > fp[1] - .1 && h.y < fp[1] + 2.1)) { S.vis++; if (ride) S.rideVis++; return; }
          if (ride && car && Math.hypot(car.x - h.x, car.z - h.z) < 2.6 && h.y < 2.4) S.cab++; else S.other++; }).catch(() => { busy = 0; }); } }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}
const isOn = B => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'lock' && c.subject?.aid === ${JSON.stringify(ID)}; })()`);
async function load(B, at, q = '') { B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(at)}&recordAt=${at}&recordSpeed=${SPEED}&recordPaused=1${q}` });
  await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(2000)]); await ready(B, 240000); await sleep(4000); }
const shot = async (B, f) => { const s = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); await fs.writeFile(f, Buffer.from(s.result.data, 'base64')); return f; };

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome();
  try {
    await load(B, FROM); let on = false;
    for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, ID).catch(() => null);
      if (card === ID) { const b = await centre(B, `document.querySelector('#r-dossier [data-act=lock]')`); if (b) await press(B, b); for (let j = 0; j < 10 && !(on = await isOn(B)); j++) await sleep(300); }
      if (!on) await sleep(2000); }
    if (!on) throw new Error('could not lock on ' + ID);
    const trips = await B.ev(TRIPS(ID, FROM, TO)); await sleep(600);
    console.log(`lockcab · seed ${SEED} · ${ID} · cab trips ${JSON.stringify(trips)}`);
    const tot = { all: 0, vis: 0, ride: 0, rideVis: 0, cab: 0, other: 0 };
    for (const [n, t] of trips.entries()) {
      await load(B, t.dep - .2, `&follow=${ID}&lock=1`); for (let j = 0; j < 30 && !(await isOn(B)); j++) await sleep(300);
      await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`);
      await B.ev(`(${sampler})(${JSON.stringify(ID)}, ${JSON.stringify({ to: t.arr + .2, speed: SPEED, every: EVERY })})`); await B.ev('window.__record.player.play()');
      for (let t0 = Date.now(); Date.now() - t0 < 900e3;) { await sleep(500); if (await B.ev('window.__lc?.done', false).catch(() => false)) break; }
      const s = await B.ev('window.__lc.s'); for (const k in tot) tot[k] += s[k];
      console.log(`  trip ${t.dep}→${t.arr} (taxi ${t.taxi.map(x => x.toFixed(2)).join('→')}): samples ${s.all}, visible ${s.vis}; ridden ${s.ride} (visible ${s.rideVis}); blocked by the cab ridden in ${s.cab}, by anything else ${s.other}`);
      if (n === 0) { // the stills, paused mid-ride
        const mid = (t.taxi[0] + t.taxi[1]) / 2; await load(B, mid, `&follow=${ID}&lock=1`); for (let j = 0; j < 30 && !(await isOn(B)); j++) await sleep(300);
        await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`); await sleep(2500);
        const ride = await B.ev(`(() => { const s = window.__city.cam.subject; return { ride: !!s?.ride, at: s ? [s.p[0], s.p[1], s.p[2]].map(v => +v.toFixed(2)) : null, minute: window.__record.player.minute }; })()`);
        const a = await shot(B, path.join(OUT, `cab-${SEED}-${ID}-A-as-now.jpg`));
        // (C: the cab drawn whole — fade.js's line leaves the bodies on it drawn, CAM.fade.lineAlpha 1, for the still only; B: that, and
        // the lock hole through the cars' bodies on the cone, the cab's roof)
        const la = await B.ev(`(() => { const k = window.__city.cam.config.fade, v = k.lineAlpha; k.lineAlpha = 1; return v; })()`); await sleep(1200);
        const c = await shot(B, path.join(OUT, `cab-${SEED}-${ID}-C-whole-preview.jpg`));
        const marked = await B.ev(`(async () => { const { holeStatic } = await import('/style/city/gpu.js'); const ms = new Set(); window.__city.scene.traverse(o => { const m = o.material; if (m && !Array.isArray(m) && m._camFade && (o.isBatchedMesh || o.isInstancedMesh)) ms.add(m); });
          const cars = [...ms].filter(m => /car|wheel/.test(m.customProgramCacheKey?.() || '')); window.__lcKeep = cars.map(m => [m, m.defines, m._holeStatic]); for (const m of cars) holeStatic(m); return cars.length; })()`);
        await sleep(1500); const b = await shot(B, path.join(OUT, `cab-${SEED}-${ID}-B-roof-hole-preview.jpg`));
        await B.ev(`(() => { for (const [m, d, h] of window.__lcKeep) { m.defines = d; m._holeStatic = h; m.needsUpdate = true; } window.__city.cam.config.fade.lineAlpha = ${la}; return true; })()`);
        console.log(`  stills at ${ride.minute.toFixed(3)} (subject the ride's stand-in: ${ride.ride}, at ${JSON.stringify(ride.at)}; ${marked} car materials marked for B): A ${a} · B ${b} · C ${c}`); }
    }
    const pct = x => tot.all ? (100 * x / tot.all).toFixed(2) + ' %' : '-';
    console.log(`total: samples ${tot.all}, visible ${tot.vis} (${pct(tot.vis)}); ridden ${tot.ride}; blocked by the cab ridden in ${tot.cab} (${pct(tot.cab)}), by anything else ${tot.other}`);
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
