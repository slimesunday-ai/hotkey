// C2-lock2 · WHAT STANDS BETWEEN THE LOCK CAMERA AND THE PERSON, BY NAME (lockprobe says where and how often; this says what). Headless
// Chrome on ?sim=record, one Chrome for the run:
//   1. at --from, paused: the agent's card opened with a real click and its Lock pressed (lockprobe's way in, so the viewer's angle and
//      distance, kept in this browser, are lockprobe's)
//   2. each --win a-b: the page loaded at a with ?follow=<id>&lock=1 (the record's own reload, restoring that angle and distance), played
//      at --speed× to b. lockprobe's pick every --every frames while the lock is on the agent: the homes runtime's depth pick at the
//      person's chest (what the screen draws: the cut and the lock hole applied), VISIBLE by lockprobe's own rule. On a BLOCKED pick, three's
//      Raycaster from that lens to that chest, every mesh it meets in front of the person: its kind (mesh, instanced, batched), its name
//      and its parents', its material and what that material carries (tierize, the hole, fade.js's per-body line), the instance or batch
//      item. Nothing is hidden or moved (an instanced mesh's bounding sphere is refreshed for the ray and put back)
//   Out: per window, the blocked picks grouped by the nearest mesh the ray met before the pick's point, with a count and an example, and one
//   jpeg at the first blocked pick of each group.
//   node style/city/tools/lockwho.mjs --port 5971 --id a10 --win 6122-6180,6425-6475 [--from 6110] [--seed 404] [--speed 10] [--every 6] [--out dir]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chrome, ready, serve } from './recordscenario.mjs';
import { ROOT, arg, sleep, FEED, tod, clickAgent, centre, press, BASE } from './c2lib.mjs';

const SEED = +arg('seed', 404), ID = arg('id', 'a10'), FROM = +arg('from', 4 * 1440 + 350), SPEED = +arg('speed', 10), EVERY = +arg('every', 6);
const WIN = String(arg('win', '6122-6180')).split(',').map(w => w.split('-').map(Number)), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-lock2')));

// in the page: the pick (lockprobe's rule) and, when it is blocked, the ray
function sampler(id, o) {
  const city = window.__city, T = city.THREE, H = city.recordHomes?.H, P = window.__record.player, W = window.__lw = { samples: 0, visible: 0, blocked: [], done: false };
  const chain = x => { const n = []; for (let y = x; y && n.length < 5; y = y.parent) n.push(y.name || y.type); return n.join(' < '); };
  function rayAt(lens, chest, until) { const dir = chest.clone().sub(lens), d = dir.length(), ray = new T.Raycaster(lens, dir.normalize(), 0, d + .5), list = [], hits = [];
    city.scene.traverseVisible(x => { if (x.isMesh || x.isInstancedMesh || x.isBatchedMesh) list.push(x); });
    for (const x of list) { const keep = x.boundingSphere, inst = x.isInstancedMesh || x.isBatchedMesh; if (inst) x.boundingSphere = null;
      try { hits.push(...ray.intersectObject(x, false)); } catch {} finally { if (inst) x.boundingSphere = keep; } }
    return hits.filter(h => h.distance < until + .3).sort((a, b) => a.distance - b.distance).slice(0, 4).map(h => { const x = h.object, m = Array.isArray(x.material) ? x.material[0] : x.material;
      return { t: +h.distance.toFixed(2), at: [h.point.x, h.point.y, h.point.z].map(v => +v.toFixed(2)), kind: x.isBatchedMesh ? 'batched' : x.isInstancedMesh ? 'instanced' : 'mesh', name: chain(x),
        item: h.batchId ?? h.instanceId ?? null, mat: m?.type, tier: !!m?._tierOpts, hole: !!m?._hole, camFade: !!m?._camFade, uuid: x.uuid.slice(0, 8) }; }); }
  let fno = 0, busy = 0;
  const f = () => { if (W.done) return; fno++;
    if (P.running && P.speed !== o.speed) P.setSpeed(o.speed);
    if (P.running && P.minute >= o.to) { P.pause(); W.done = true; return; }
    const c = city.cam, s = c?.subject, on = c?.mode === 'lock' && !!s && s.aid === id && !s.gone;
    if (on && H && fno % o.every === 0 && !busy) { const chest = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), v = chest.clone().project(city.camera), lens = city.camera.position.clone(), d = lens.distanceTo(chest), m = P.minute, fp = [s.p[0], s.p[1], s.p[2]];
      if (!(v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1)) { const r = city.renderer.domElement.getBoundingClientRect(); busy = 1; W.samples++;
        H.hitAt(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height).then(h => { busy = 0;
          if (!h || h.distanceTo(lens) >= d - .5 || (Math.hypot(h.x - fp[0], h.z - fp[2]) < .75 && h.y > fp[1] - .1 && h.y < fp[1] + 2.1)) { W.visible++; return; }
          const hm = h.distanceTo(lens); let wk = null; for (const w of city.peds?.sim?.walkers || []) { if (w.gone || w === s) continue; const dh = Math.hypot(w.p[0] - h.x, w.p[2] - h.z); if (!wk || dh < wk[0]) wk = [+dh.toFixed(2), +(h.y - w.p[1]).toFixed(2), w.agent ? w.aid : 'walker#' + w.id]; }
          W.blocked.push({ wk, minute: +m.toFixed(3), pick: [h.x, h.y, h.z].map(x => +x.toFixed(2)), pickM: +hm.toFixed(2), chestM: +d.toFixed(2), feet: fp.map(x => +x.toFixed(2)), ray: rayAt(lens, chest, hm) }); }).catch(() => { busy = 0; W.samples--; }); } }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}
const isOn = B => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'lock' && c.subject?.aid === ${JSON.stringify(ID)}; })()`);

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome();
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=60&recordPaused=1` });
    await ready(B, 240000); await sleep(4000);
    let on = false;
    for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, ID).catch(() => null);
      if (card === ID) { const b = await centre(B, `document.querySelector('#r-dossier [data-act=lock]')`); if (b) await press(B, b); for (let j = 0; j < 10 && !(on = await isOn(B)); j++) await sleep(300); }
      if (!on) await sleep(2000); }
    if (!on) throw new Error('could not lock on ' + ID + ' at ' + FROM);
    const angles = await B.ev('window.__city.cam.lock.angles'); await sleep(600);
    console.log(`lockwho · seed ${SEED} · ${ID} locked at ${FROM} by the card's Lock · az ${angles.az.toFixed(4)} el ${angles.el.toFixed(4)} d ${angles.d.toFixed(3)}`);
    for (const [a, b] of WIN) {
      B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(a)}&recordAt=${a}&recordSpeed=${SPEED}&recordPaused=1&follow=${ID}&lock=1` });
      await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(2000)]);
      await ready(B, 240000); await sleep(4000);
      for (let j = 0; j < 30 && !(await isOn(B)); j++) await sleep(300);
      await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`);
      await B.ev(`(${sampler})(${JSON.stringify(ID)}, ${JSON.stringify({ to: b, speed: SPEED, every: EVERY })})`); await B.ev('window.__record.player.play()');
      const groups = new Map();
      for (let t0 = Date.now(); Date.now() - t0 < 1800e3;) { await sleep(500);
        const st = await B.ev(`(() => { const W = window.__lw; if (!W) return null; const b = W.blocked.splice(0); return { done: W.done, b, n: W.samples, v: W.visible, m: window.__record.player.minute }; })()`, false).catch(() => null);
        if (!st) continue;
        for (const x of st.b) { const r = x.ray.find(h => h.t < x.pickM + .3) || null, key = r ? `${r.kind} ${r.name} [${r.mat}${r.tier ? ' tier' : ''}${r.hole ? ' hole' : ''}${r.camFade ? ' camFade' : ''}] ${r.uuid}` : 'nothing on the ray';
          let g = groups.get(key); if (!g) { g = { n: 0, first: x, shot: null, at: new Set() }; groups.set(key, g);
            const s = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); g.shot = path.join(OUT, `who-${SEED}-${ID}-${x.minute}.jpg`); await fs.writeFile(g.shot, Buffer.from(s.result.data, 'base64')); }
          g.n++; g.at.add(x.pick.map(v => Math.round(v)).join(',')); }
        if (st.done) { console.log(`\nwindow ${a}-${b}: ${st.v}/${st.n} visible, ${st.n - st.v} blocked`); break; } }
      for (const [k, g] of [...groups].sort((x, y) => y[1].n - x[1].n)) { console.log(`  ${String(g.n).padStart(4)} × ${k}`); console.log('       at', [...g.at].slice(0, 8).join(' · ')); console.log('       e.g.', JSON.stringify(g.first)); console.log('       shot', g.shot); }
    }
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
