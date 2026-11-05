// C2-camera3 · WHAT IS ON THE LINE WITH NOBODY PINNED (lensprobe's `none` row: 2 of 61 depth picks blocked after C2-camera2). lensprobe's
// own set-up (seed 404, a12 home on day 1 at 21:19, the record played at 1× onto its step with the follow on it, then paused there; the
// city keeps drawing), nobody pinned. Every --every ms for --secs s it takes lensprobe's pick (the homes runtime's hitAt at a12's head,
// chest and hips; blocked = all three hit something nearer the camera than a12's body, 0.5 m short of it) and, in the same frame, a ray
// from the camera through each of those three points: every visible mesh it meets nearer than that (its name and its parents', its
// type, the instance / batch id) and the walkers standing where it hit (with the alpha the camera's fade gives them), so a blocked
// pick names what blocked it. The camera's pose and the follow's arm come with each pick.
//   node style/city/tools/lensblockprobe.mjs --port 5963 [--secs 20] [--every 120] [--out <dir>] [--tag before]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5963), SEED = 404, BASE = `http://127.0.0.1:${PORT}`, ID = 'a12', NEAR = 2719, TAG = arg('tag', 'probe'), SECS = +arg('secs', 20), EVERY = +arg('every', 120);
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera3')));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// (lensprobe's open, as it has it)
async function open(B, minute) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=night&simtod=0&recordAt=${minute}&recordPaused=1&recordSpeed=1` });
  let ok = false; for (let t = 0; t < 600 && !ok; t++) { ok = await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1 && window.__city.recordHomes)`, false).catch(() => false); if (!ok) await sleep(400); }
  if (!ok) throw new Error('the record page did not load: ' + (B.errors[0] ?? 'timeout')); await sleep(2500);
}
// lensprobe's pick, and the rays through the same three points, in one evaluation
const PICK = `(async () => { const FD = await import('/style/city/camera/fade.js'), c = window.__city, H = c.recordHomes.H, s = c.cam.subject, T = c.THREE, cam = c.camera.position.clone(), R = c.renderer.domElement.getBoundingClientRect(); if (!s) return null;
  const rc = new T.Raycaster(), vis = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; }, nm = o => { const l = []; for (let x = o; x && l.length < 4; x = x.parent) l.push((x.name || x.type) + (x.userData?.id ? '#' + x.userData.id : '')); return l.join('<'); };
  const g = c.cam.follow?.dbg, pts = [], meshes = []; let blocked = true; c.scene.traverseVisible(o => { if (o.isMesh && o.geometry) meshes.push(o); });
  for (const dy of [.5, 1, 1.45]) { const P = new T.Vector3(s.p[0], s.p[1] + dy, s.p[2]), v = P.clone().project(c.camera); if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
    const h = await H.hitAt(R.left + (v.x + 1) / 2 * R.width, R.top + (1 - v.y) / 2 * R.height), d = Math.hypot(s.p[0] - cam.x, s.p[1] + dy - cam.y, s.p[2] - cam.z), hit = !!h && h.distanceTo(cam) < d - .5;
    rc.set(cam, P.clone().sub(cam).normalize()); rc.far = d - .5;
    const ray = rc.intersectObjects(meshes, false).filter(x => vis(x.object)).slice(0, 4).map(x => ({ t: +x.distance.toFixed(2), o: nm(x.object), type: x.object.type, inst: x.instanceId ?? x.batchId ?? null, at: [x.point.x, x.point.y, x.point.z].map(q => +q.toFixed(2)) }));
    // (the walkers standing where the pick hit: who, and how faded the camera's fade has them — camera/fade.js fadeOfWalker)
    const who = h && hit ? c.peds.sim.walkers.filter(x => !x.gone && Math.hypot(x.p[0] - h.x, x.p[2] - h.z) < .6).map(x => ({ id: x.id, aid: x.aid ?? null, agent: !!x.agent, tier: x.tier, alpha: +FD.fadeOfWalker(x.p, cam, s.p).toFixed(3) })) : [];
    pts.push({ dy, d: +d.toFixed(2), pick: h ? +h.distanceTo(cam).toFixed(2) : null, pickAt: h ? [h.x, h.y, h.z].map(q => +q.toFixed(2)) : null, hit, ray, who }); if (!hit) blocked = false; }
  return { m: +window.__record.player.minute.toFixed(3), blocked: pts.length ? blocked : null, cam: [cam.x, cam.y, cam.z].map(q => +q.toFixed(3)), sub: [s.p[0], s.p[1], s.p[2]].map(q => +q.toFixed(3)), arm: g ? +g.arm.toFixed(3) : null, hold: g?.hold, f: g ? { az: +g.az.toFixed(3), as: g.assist, aim: g.aim, dodge: +g.dodge.toFixed(3), thin: g.thin, lift: +g.lift.toFixed(3), vis: +g.vis.toFixed(2), armColl: +g.armColl.toFixed(2), Ls: +g.dist.toFixed(2), dodges: g.dodges, searches: g.searches, piv: g.pivot.map(q => +q.toFixed(2)), L: g.L.map(q => +q.toFixed(2)) } : null, t: +performance.now().toFixed(0), walk: { hd: +(s.yawS ?? s.p[3]).toFixed(3), vc: +(s.vc ?? 0).toFixed(3), fix: !!s.fix, mode: window.__record.draw.agents?.map.get('a12')?.mode ?? null }, lensNow: c.peds.stats().lensNow, pts }; })()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), rows = [];
  try {
    await open(B, NEAR - 3);
    const arr = await B.ev(`(() => { const D = window.__record.draw; for (let m = ${NEAR - 3}; m < ${NEAR + 3}; m += .05) { const s = D.stateAt(${JSON.stringify(ID)}, m); if (s.trip) return s.trip.arr; } return null; })()`);
    if (arr === null) throw new Error('no trip home near ' + NEAR);
    await B.ev(`window.__record.player.seek(${arr - .33})`); await sleep(2500);
    const on = await B.ev(`(() => { const c = window.__city, w = c.cam.people.byAid(${JSON.stringify(ID)}); return !!w && c.cam.setMode('follow', { subject: w }) !== false && c.cam.subject === w; })()`);
    if (!on) throw new Error('could not follow ' + ID);
    await B.ev('window.__record.player.play()');
    for (let k = 0; k < 400; k++) { const m = await B.ev('window.__record.player.minute'); if (m >= arr - .06) break; await sleep(50); }
    await B.ev('window.__record.player.pause()'); await sleep(2000 + 1200);
    const t0 = Date.now(); let shots = 0;
    while (Date.now() - t0 < SECS * 1000) { const r = await B.ev(PICK); if (r) { rows.push(r);
      if (r.blocked) { console.log('BLOCKED ' + JSON.stringify(r)); if (shots++ < 3) { const sh = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); await fs.writeFile(path.join(OUT, `${TAG}-lensblock-${rows.length}.jpg`), Buffer.from(sh.result.data, 'base64')); } } }
      await sleep(EVERY); }
    const picks = rows.filter(r => r.blocked !== null), blocked = picks.filter(r => r.blocked);
    const by = {}; for (const r of blocked) for (const p of r.pts) for (const x of p.ray.slice(0, 1)) by[x.o] = (by[x.o] || 0) + 1;
    const any = {}; for (const r of picks) for (const p of r.pts) if (p.hit) { const o = p.ray[0]?.o ?? '(no ray hit)'; any[o] = (any[o] || 0) + 1; }
    console.log(`${picks.length} picks, ${blocked.length} blocked · nearest ray hit on the blocked picks' points:`, JSON.stringify(by), '· on every point the pick found blocked:', JSON.stringify(any));
    console.log('camera', JSON.stringify(rows[0]?.cam), '→', JSON.stringify(rows[rows.length - 1]?.cam), 'arm', rows[0]?.arm, '→', rows[rows.length - 1]?.arm);
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
  await fs.writeFile(path.join(OUT, `${TAG}-lensblockprobe.json`), JSON.stringify(rows));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
