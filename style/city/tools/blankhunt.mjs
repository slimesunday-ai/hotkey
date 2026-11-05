// C2-camera3 · A BLANK FRAME THAT ONLY A LONG FOLLOW SHOWS (followprobe's blank: the canvas read back at 40×25 right after the render,
// luminance spread < 2.5). followprobe's own way in and its speeds (the page at --from, the agent's card opened with a real click and
// Follow pressed with F, else ?follow=; 10× through the agent's trips and the night's show, 60× between; the page's own day / night
// reloads on the way, the sampler put back after each), but EVERY frame is read back, not every 6th, and each frame keeps blankprobe's
// row (the camera, the follow's state, the agent's drawn state) in a ring: a blank frame writes out the --ring frames before it and
// --after frames after it, with what the camera is in or looking through at that frame (the first 8 blank frames of a page) (the collision world at the lens; the meshes on
// the ray from the lens to the agent's chest, and on the ray ahead: with --rays, the first 2 blank frames of a page: the raycasts can stall it; else the collision world's ray to the chest), and its picture (<out>/<tag>-hunt-<id>-<minute>.png, the first 3).
//   node style/city/tools/blankhunt.mjs --port 5964 --id a05 --from 6110 --to 6662 [--busy 10] [--quiet 60] [--ring 90] [--after 30] [--rays] [--out <dir>] [--tag before]
// window.__bh keeps, never drained, every page's blank frames (blankAt: minute, spread, rgb, held, pivot-to-person m) and its counters.
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5964), SEED = +arg('seed', 404), ID = arg('id', 'a05'), FROM = +arg('from', 6110), TO = +arg('to', 6662), BUSY = +arg('busy', 10), QUIET = +arg('quiet', 60);
const RAYS = process.argv.includes('--rays'), RING = +arg('ring', 90), AFTER = +arg('after', 30), TAG = arg('tag', 'probe'), OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera3'))), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };

// (followprobe's windows, as it has them)
function windows(id, from, to) {
  const D = window.__record.draw, L = D.timeline.segs.get(id) || [], out = [];
  for (let i = 0; i < L.length; i++) { if (L[i].start > to) break; const d = D.rule.at(id, i); if (!d?.trip) continue; const a = d.dep - 1, b = Math.max(d.trip.arr, d.dep) + 1; if (b >= from) out.push([a, b, d.trip.mode]); }
  for (let n = Math.floor(from / 1440); n <= Math.floor(to / 1440); n++) { try { const p = D.planner.night(n); if (p && p.end >= from && p.start <= to) out.push([p.start - 1, p.end + 1, 'show']); } catch {} }
  return out.sort((x, y) => x[0] - y[0]);
}
async function sampler(id, o) {
  const c = window.__city, D = window.__record.draw, P = window.__record.player, gl = c.renderer.domElement, T = c.THREE, FW = new T.Vector3(), Wm = await import('/style/city/camera/world.js');
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 25; const cx = cv.getContext('2d', { willReadFrequently: true });
  const H = window.__bh = { ring: [], out: [], shots: [], done: false, frames: 0, blank: 0, after: 0 };
  const inWin = m => o.win.some(([a, b]) => m >= a && m < b);
  const vis = x => { for (let q = x; q; q = q.parent) if (!q.visible) return false; return true; }, nm = x => { const l = []; for (let q = x; q && l.length < 4; q = q.parent) l.push(q.name || q.type); return l.join('<'); };
  // (what the lens is in or looking through: the collision world at it, the meshes on the ray to the chest and ahead)
  const look = (cam, chest) => { const p = cam.position, rc = new T.Raycaster(), meshes = []; c.scene.traverseVisible(x => { if (x.isMesh && x.geometry) meshes.push(x); });
    const ray = (dir, far) => { rc.set(p, dir.clone().normalize()); rc.far = far; return rc.intersectObjects(meshes, false).filter(h => vis(h.object)).slice(0, 4).map(h => ({ t: +h.distance.toFixed(2), o: nm(h.object), inst: h.instanceId ?? h.batchId ?? null, side: h.object.material?.side, face: h.face ? +h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(dir.clone().normalize()).toFixed(2) : null })); };
    const ov = c.cam.world.overlap(p, .1, Wm.STATIC_WIDE | Wm.CARS);
    return { inWorld: ov ? { depth: +ov.depth.toFixed(2), n: ov.n.map(v => +v.toFixed(2)) } : null, worldDist: +c.cam.world.distance(p, 2, Wm.STATIC_WIDE).toFixed(2),
      toChest: chest ? ray(chest.clone().sub(p), chest.distanceTo(p)) : null, ahead: ray(FW.clone(), 60) }; };
  const f = () => { if (H.done) return; const m = P.minute; H.frames++;
    { const sp = inWin(m) ? o.busy : o.quiet; if (P.running && P.speed !== sp) P.setSpeed(sp); } if (P.running && m >= o.to) { P.pause(); H.done = true; }
    const car = c.subway?.openFor === id ? c.subway.open : null, shown = car?.view?.renderer?.domElement || gl;
    cx.drawImage(shown, 0, 0, 40, 25); const px = cx.getImageData(0, 0, 40, 25).data; let s1 = 0, s2 = 0, r = 0, g = 0, b = 0;
    for (let k = 0; k < px.length; k += 4) { const L = .2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]; s1 += L; s2 += L * L; r += px[k]; g += px[k + 1]; b += px[k + 2]; }
    const sd = Math.sqrt(Math.max(0, s2 / 1000 - (s1 / 1000) ** 2)), cam = c.camera, p = cam.position; FW.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const sub = c.cam.subject, a = D.agents?.map.get(id), w = a?.w, s = D.stateAt(id, m), g2 = c.cam.follow?.dbg;
    const row = { m: +m.toFixed(4), sd: +sd.toFixed(2), rgb: [r / 1000 | 0, g / 1000 | 0, b / 1000 | 0], mode: c.cam.mode, blend: c.cam.blending, on: !!sub && sub.aid === id, speed: P.speed,
      cam: [p.x, p.y, p.z].map(v => +v.toFixed(2)), fwd: [FW.x, FW.y, FW.z].map(v => +v.toFixed(2)), near: cam.near, far: +cam.far.toFixed(1), fov: +cam.fov.toFixed(1),
      fog: c.scene.fog ? [+c.scene.fog.near.toFixed(1), +c.scene.fog.far.toFixed(1)] : null, covered: !!c.covered, car: !!car,
      sub: sub ? [sub.p[0], sub.p[1], sub.p[2]].map(v => +v.toFixed(2)) : null, walker: w ? [w.p[0], w.p[1], w.p[2]].map(v => +v.toFixed(2)) : null,
      state: s.trip ? 'trip:' + s.trip.mode + ' ' + s.trip.from + '>' + s.trip.to : s.hidden ? 'hidden' : 'at ' + s.place, amode: a?.mode, under: !!a?.run?.under,
      f: g2 ? { L: g2.L.map(v => +v.toFixed(2)), piv: g2.pivot.map(v => +v.toFixed(2)), arm: +g2.arm.toFixed(2), want: +g2.want.toFixed(2), Ls: +g2.dist.toFixed(2), armColl: +g2.armColl.toFixed(2), vis: +g2.vis.toFixed(2), pitch: +g2.pitch.toFixed(3), az: +g2.az.toFixed(3), as: g2.assist, aim: g2.aim, dodge: +g2.dodge.toFixed(2), lift: +g2.lift.toFixed(2), hold: g2.hold, held: +g2.held.toFixed(2), room: g2.room?.src, ease: g2.room?.ease, rhold: g2.room?.hold, enter: g2.enter, cuts: g2.cuts, safety: g2.safety, brake: g2.brake } : null };
    H.ring.push(row); if (H.ring.length > o.ring) H.ring.shift(); if (g2) { if (H.cuts !== undefined && g2.cuts > H.cuts && H.lastSp === o.busy) H.cutsBusy = (H.cutsBusy || 0) + g2.cuts - H.cuts; H.cuts = g2.cuts; H.holds = g2.holds; }
    { const dm = m - (H.lastM ?? m); if (H.lastSp === o.busy && dm > 0 && dm < .5) H.minBusy = (H.minBusy || 0) + dm; H.lastM = m; H.lastSp = P.running ? P.speed : 0; } H.minSd = Math.min(H.minSd ?? 1e9, sd); if (sd === H.minSd) H.minAt = row.m;
    if (sd < 2.5) { H.blank++; if ((H.blankAt ??= []).length < 400) H.blankAt.push([row.m, row.sd, row.rgb, row.f?.hold ?? null, row.f ? +Math.hypot(row.f.L[0] - (row.sub?.[0] ?? 0), row.f.L[2] - (row.sub?.[2] ?? 0)).toFixed(1) : null]); H.looks = (H.looks || 0) + 1; const chest = sub ? new T.Vector3(sub.p[0], sub.p[1] + 1.25, sub.p[2]) : null; if (H.looks <= 2 && o.rays) row.look = look(cam, chest); else if (H.looks <= 8) row.look = { inWorld: (q => q ? { depth: +q.depth.toFixed(2) } : null)(c.cam.world.overlap(cam.position, .1, Wm.STATIC_WIDE | Wm.CARS)), toChest: chest ? (h => h ? +(h.t * chest.distanceTo(cam.position)).toFixed(2) : null)(c.cam.world.ray(cam.position, chest, Wm.STATIC_WIDE)) : null };
      if (H.shots.length < 3) H.shots.push({ m: row.m, png: shown.toDataURL('image/png') });
      if (H.after <= 0) H.out.push(...H.ring.slice(0, -1).map(x => ({ ...x, ctx: 'before' }))); H.out.push({ ...row, ctx: 'BLANK' }); H.ring = []; H.after = o.after; }
    else if (H.after > 0) { H.after--; H.out.push({ ...row, ctx: 'after' }); H.ring = []; }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), rows = [], shots = []; const pages = []; let page = { from: null, cuts: 0, holds: 0, cutsBusy: 0, minBusy: 0 }; pages.push(page); let how = null, reloads = 0, frames = 0, blank = 0, cutsNow = 0, holdsNow = 0, cutsBefore = 0, holdsBefore = 0, minSd = 1e9, minAt = null;
  try {
    const url = q => `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=${QUIET}&recordPaused=1${q}`;
    await B.send('Page.navigate', { url: url('') }); await ready(B, 240000); await sleep(4000);
    // (followprobe's way in: a click on the agent opens its card, F presses Follow; else ?follow=)
    const { clickAgent, key } = await import('./c2lib.mjs');
    const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}; })()`);
    let on = false;
    for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, ID).catch(() => null); if (card === ID) { await key(B, 'f', 'KeyF', 70); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(2000); }
    how = on ? 'card + F' : '?follow=';
    if (!on) { B.send('Page.navigate', { url: url('&follow=' + ID) }); await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(2000)]); await ready(B, 240000); await sleep(4000); }
    const inject = async () => { const win = await B.ev(`(${windows})(${JSON.stringify(ID)}, ${FROM}, ${TO})`); return B.ev(`(${sampler})(${JSON.stringify(ID)}, ${JSON.stringify({ win, busy: BUSY, quiet: QUIET, to: TO, ring: RING, after: AFTER, rays: RAYS })})`); };
    await inject(); await B.ev('window.__record.player.play()');
    const DR = '(() => { const H = window.__bh; if (!H) return null; const r = { out: H.out, shots: H.shots, done: H.done, frames: H.frames, blank: H.blank, cuts: H.cuts, holds: H.holds, minSd: H.minSd, minAt: H.minAt, cutsBusy: H.cutsBusy || 0, minBusy: H.minBusy || 0, m: window.__record.player.minute }; H.out = []; H.shots = []; H.frames = 0; H.blank = 0; return r; })()';
    let origin = await B.ev('performance.timeOrigin'), said = Date.now();
    console.log('in', how);
    for (const t0 = Date.now(); Date.now() - t0 < 4 * 3600e3;) { await sleep(400);
      // (a line a minute: where the record is, so a stall shows)
      if (Date.now() - said > 60000) { said = Date.now(); console.log('at', JSON.stringify(await B.ev(`(() => { const P = window.__record?.player, c = window.__city?.cam; return { m: P?.minute, running: P?.running, speed: P?.speed, mode: c?.mode, on: c?.subject?.aid ?? null, frames: window.__bh?.frames }; })()`, false).catch(e => String(e)))); }
      const o = await B.ev('performance.timeOrigin', false).catch(() => null); if (o === null) continue;
      if (o !== origin) { origin = o; reloads++; cutsBefore += cutsNow; holdsBefore += holdsNow; cutsNow = holdsNow = 0; pages.push(page = { from: null, cuts: 0, holds: 0, cutsBusy: 0, minBusy: 0 }); await ready(B, 240000).catch(() => {}); for (let k = 0; k < 40; k++) { if (await B.ev(`window.__city.cam?.subject?.aid === ${JSON.stringify(ID)}`).catch(() => false)) break; await sleep(250); } await inject(); continue; }
      const d = await B.ev(DR, false).catch(() => null); if (!d) continue; if (page.from === null && d.m !== undefined) page.from = d.m; rows.push(...d.out); shots.push(...d.shots); frames += d.frames; blank += d.blank; if (d.cuts !== undefined) { cutsNow = d.cuts; holdsNow = d.holds; page.cuts = d.cuts; page.holds = d.holds; page.cutsBusy = d.cutsBusy; page.minBusy = d.minBusy; page.to = d.m; } if (d.minSd < minSd) { minSd = d.minSd; minAt = d.minAt; }
      for (const r of d.out.filter(x => x.ctx === 'BLANK')) console.log('BLANK', r.m, r.sd, JSON.stringify(r.rgb), JSON.stringify(r.look).slice(0, 900));
      if (d.done) break; }
    console.log(`${ID} ${how}, ${reloads} reloads, ${frames} frames ${FROM} → ${TO}: the follow's cuts ${cutsBefore + cutsNow}, holds ${holdsBefore + holdsNow}, lowest spread ${minSd.toFixed(2)} at ${minAt}: ${blank} blank`);
    // (per page — the follow's counters start again with each page — its cuts while the record played at --busy, per island minute played at --busy)
    for (const [i, p] of pages.entries()) console.log(`page ${i}: ${p.from?.toFixed?.(2)} → ${p.to?.toFixed?.(2)}: cuts ${p.cuts}, holds ${p.holds}; at ${BUSY}×: ${p.cutsBusy} cuts in ${p.minBusy.toFixed(2)} island min = ${(p.cutsBusy / Math.max(1e-9, p.minBusy)).toFixed(2)} per island min`);
    for (const s of shots.slice(0, 3)) { const f = path.join(OUT, `${TAG}-hunt-${ID}-${s.m}.png`); await fs.writeFile(f, Buffer.from(s.png.split(',')[1], 'base64')); console.log('saved', path.relative(ROOT, f)); }
    await fs.writeFile(path.join(OUT, `${TAG}-blankhunt-${ID}.json`), JSON.stringify(rows));
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
