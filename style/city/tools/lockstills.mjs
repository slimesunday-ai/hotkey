// C2-lock · STILLS FOR slime: the lock camera's see-through (camera/lock.js, gpu.js HOLE), day and night, seed 404's record. Three cases,
// each found in the page from the collision world (camera/world.js), never placed by hand:
//   building   a person with a building between the lens and their chest (the first solid on the line ≥ 1.5 m from the lens, the lens clear)
//   awning     a person under something (an awning, a sign, a balcony: a solid 2.2–5 m over their feet), the camera high enough that it is
//              on the line
//   tree       a person beside a tree on the line: a slender column (THIN in the world) under a crown (solid 1.4 m across both ways,
//              2.4–5 m up over it: a sign on a post is flat, a crown is not)
// For each: Lock on that person at a bearing where the case holds (the viewer's angle, set the way a hand-off sets it: from a pose), a
// still of the frame with the hole off and on (jpeg, the record paused: an agent stands still), and what the depth pick at the chest
// reads. Agents only. Two stills per case and time of day: twelve files.
//   node style/city/tools/lockstills.mjs --port 5971 [--out tmp/c2-lock/stills] [--day 6362] [--night 7050]
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, PORT, arg, sleep, open, serve, chrome } from './c2lib.mjs';

const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-lock/stills'))), DAYM = +arg('day', 6362), NIGHTM = +arg('night', 7050);
if (!PORT) { console.error('usage: node style/city/tools/lockstills.mjs --port <port>'); process.exit(2); }

// in the page: the best person and bearing for a case (agents first, then the crowd), and Lock onto them there
const FIND = kind => `(() => { const c = window.__city, T = c.THREE, W = c.cam.world, out = [];
  const all = c.cam.people.all().filter(w => w.agent && w.tier && !w.gone && Math.hypot(w.p[0] - c.controls.target.x, w.p[2] - c.controls.target.z) < 30);
  const ok = (w, a, el, d) => { const h = c.peds?.heightOf?.(w) || 1.75, P = new T.Vector3(w.p[0], Math.max(w.p[1], 0) + .82 * h, w.p[2]), ce = Math.cos(el),
      L = new T.Vector3(P.x + Math.sin(a) * ce * d, P.y + Math.sin(el) * d, P.z + Math.cos(a) * ce * d), ch = new T.Vector3(w.p[0], w.p[1] + 1.25, w.p[2]);
    if (W.inside(L, 8) || W.distance(L, .4, 8) < .35) return null; const D = L.distanceTo(ch), hit = W.ray(L, ch, 8), hT = W.ray(L, ch, 1);
    if (${JSON.stringify(kind)} === 'building') return hit && hit.t * D > 1.5 && hit.t * D < D - .8 && hit.kind === 'static' ? { L, P, at: hit.t * D } : null;
    if (${JSON.stringify(kind)} === 'awning') { const top = W.ceilAt(w.p[0], w.p[2], w.p[1] + 1.9); return top > w.p[1] + 2.2 && top < w.p[1] + 5 && hit && hit.t * D < D - .5 ? { L, P, at: hit.t * D, top } : null; }
    if (${JSON.stringify(kind)} === 'tree') { if (!hT || !hT.thin || hT.t * D > D - .4) return null; const q = L.clone().lerp(ch, hT.t); for (let dy = 2.4; dy <= 5; dy += .4) { const C = new T.Vector3(q.x, w.p[1] + dy, q.z); if ([[0, 0], [.7, 0], [-.7, 0], [0, .7], [0, -.7]].every(([x, z]) => W.inside(new T.Vector3(C.x + x, C.y, C.z + z), 8))) return { L, P, at: hT.t * D }; } return null; }
    return null; };
  for (const w of all) for (let k = 0; k < 36; k++) { const a = k * Math.PI / 18; for (const [el, d] of ${kind === 'awning' ? '[[.6, 8], [.75, 8], [.95, 7]]' : '[[.3, 8], [.2, 10], [.35, 6]]'}) { const r = ok(w, a, el, d); if (r) out.push({ w, a, el, d, r }); } }
  out.sort((x, y) => (y.w.agent ? 1 : 0) - (x.w.agent ? 1 : 0)); const b = out[0]; if (!b) return null;
  const m = new T.Matrix4().lookAt(b.r.L, b.r.P, new T.Vector3(0, 1, 0)), q = new T.Quaternion().setFromRotationMatrix(m);
  c.cam.setMode('lock', { subject: b.w }); c.cam.lock.enter({ p: b.r.L, q, fov: 55 }, { subject: b.w });
  return { who: b.w.agent ? b.w.aid : 'walker #' + b.w.id, at: +b.r.at.toFixed(2), top: b.r.top ? +b.r.top.toFixed(2) : undefined, az: +b.a.toFixed(3), el: b.el, d: b.d, found: out.length }; })()`;
const PICK = `(async () => { const c = window.__city, T = c.THREE, s = c.cam.subject, ch = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), cam = c.camera.position.clone(), R = c.renderer.domElement.getBoundingClientRect(), v = ch.clone().project(c.camera);
  const h = await c.recordHomes.H.hitAt(R.left + (v.x + 1) / 2 * R.width, R.top + (1 - v.y) / 2 * R.height), d = cam.distanceTo(ch); return { chestM: +d.toFixed(2), hitM: h ? +h.distanceTo(cam).toFixed(2) : null, visible: !h || h.distanceTo(cam) >= d - .5 || (Math.hypot(h.x - s.p[0], h.z - s.p[2]) < .75 && h.y > s.p[1] - .1 && h.y < s.p[1] + 2.1), hitOnPerson: !!h && Math.hypot(h.x - s.p[0], h.z - s.p[2]) < .75 }; })()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), rows = [];
  try {
    for (const [tod, m] of [['day', DAYM], ['night', NIGHTM]]) {
      await open(B, 404, `tod=${tod}&recordAt=${m}&recordPaused=1&recordSpeed=1`); await sleep(4000);
      await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`);
      // (the collision world is built round the camera: visit each drawn agent in turn, from the map's height, and look round them)
      const ids = await B.ev(`[...window.__record.draw.agents.map].filter(([, a]) => a.w && !a.w.gone).map(([id]) => id)`);
      for (const kind of ['building', 'awning', 'tree']) {
        let f = null;
        for (const id of ids) { await B.ev(`(() => { const c = window.__city, a = window.__record.draw.agents.map.get(${JSON.stringify(id)}); if (!a?.w || a.w.gone) return false; if (c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true }); c.controls.target.set(a.w.p[0], .6, a.w.p[2]); c.camera.position.set(a.w.p[0] + 7, 9, a.w.p[2] + 11); c.controls.update?.(); return true; })()`);
          await sleep(1500); f = await B.ev(FIND(kind)); if (f) break; }
        if (!f) { rows.push({ tod, kind, found: 0 }); console.log(tod, kind, 'none found'); continue; }
        // (the same frame with the hole off first — what Follow's walls would hide — then on; the record is paused, an agent stands still)
        await sleep(1800); await B.ev('(window.__city.cam.config.lock.hole.on = false, true)'); await sleep(600);
        const off = path.join(OUT, `lock-${tod}-${kind}-off.jpg`), on = path.join(OUT, `lock-${tod}-${kind}.jpg`);
        let r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 78 }); await fs.writeFile(off, Buffer.from(r.result.data, 'base64'));
        await B.ev('(window.__city.cam.config.lock.hole.on = true, true)'); await sleep(1200); const p = await B.ev(PICK);
        r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 78 }); await fs.writeFile(on, Buffer.from(r.result.data, 'base64'));
        rows.push({ tod, kind, ...f, ...p, file: path.relative(ROOT, on), off: path.relative(ROOT, off) }); console.log(JSON.stringify(rows.at(-1)));
      }
    }
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
  await fs.writeFile(path.join(OUT, 'stills.json'), JSON.stringify(rows, null, 1));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
