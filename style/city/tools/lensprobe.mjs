// C2-camera2 · A CROWD WALKER AT THE LENS (GAME.md §41, slime 10-30: "no one wants to watch people drop off screen"). Headless Chrome on
// ?sim=record (&simtod=0), seed 404: cutawaycheck's night stay (a12 home on day 1 at 21:19, its step on the sidewalk), the record played
// at 1× onto its step with the follow on it, then paused there (the city keeps drawing; the follow keeps framing it). For each --at
// distance a crowd walker (the nearest stranger) is pinned standing on the camera's line to a12's chest, that many metres from the lens
// (pin.sub: the lens to a12's chest, m)
// (w.fix, set before every crowd update; 'none': nobody pinned), and for --secs s it counts, per frame:
//   ms        the page's frame time (rAF to rAF; headless Chrome holds it to 60 Hz) · pedsMs: the crowd's own update (peds.stats().updateMs:
//             its sim step, tiers, batches and, since C2-camera2, the line's clear pass), mean over the frames
//   gone      frames the pinned body was out of its batch (peds.stats().lensNow > 0; the field is absent before C2-camera2: '-')
//   blocked   depth-pick samples (the homes runtime's hitAt, the cut applied, cutawaycheck's own reader) at a12's head, chest and hips that
//             all hit something nearer the camera than a12's body (0.5 m short of it): cutawaycheck's `hidden`
// and a screenshot of the frame for the contact sheet (<out>/<tag>-<at>.jpg).
//   node style/city/tools/lensprobe.mjs --port 5963 [--at none,0.6,1,1.5,1.9] [--secs 8] [--out style/city/shots/c2-camera2] [--tag after]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5963), SEED = 404, BASE = `http://127.0.0.1:${PORT}`, ID = 'a12', NEAR = 2719, TAG = arg('tag', 'probe'), SECS = +arg('secs', 8);
const AT = arg('at', 'none,0.6,1,1.5,1.9').split(','), OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera2')));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(B, minute) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=night&simtod=0&recordAt=${minute}&recordPaused=1&recordSpeed=1` });
  let ok = false; for (let t = 0; t < 600 && !ok; t++) { ok = await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1 && window.__city.recordHomes)`, false).catch(() => false); if (!ok) await sleep(400); }
  if (!ok) throw new Error('the record page did not load: ' + (B.errors[0] ?? 'timeout')); await sleep(2500);
}
// in the page: the pin (a stranger standing on the line, `d` m from the lens) and the per-frame counts
const SETUP = `(() => { const c = window.__city, P = c.peds, L = window.__lp = { d: null, w: null, rows: [], on: false, picks: [] };
  const orig = P.update; P.update = function (...a) { const s = c.cam.subject, cam = c.camera.position;
    if (L.d !== null && s) { if (!L.w || L.w.gone) { let b = null, bd = 1e9; for (const w of P.sim.walkers) { if (w.agent || w.gone || w.stagePose || w === s) continue; const d = Math.hypot(w.p[0] - s.p[0], w.p[2] - s.p[2]); if (d < bd) { bd = d; b = w; } } L.w = b; }
      if (L.w) { const tx = s.p[0] - cam.x, ty = s.p[1] + 1.25 - cam.y, tz = s.p[2] - cam.z, n = Math.hypot(tx, ty, tz) || 1, k = L.d / n; L.w.fix = [cam.x + tx * k, s.p[1], cam.z + tz * k, L.w.p[3]]; } }
    return orig.apply(this, a); };
  let t0 = null; const f = t => { if (L.on && t0 !== null) { const st = P.stats(); L.rows.push({ ms: t - t0, gone: st.lensNow, up: st.updateMs }); } t0 = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  return true; })()`;
const PICK = `(async () => { const c = window.__city, H = c.recordHomes.H, s = c.cam.subject, T = c.THREE, cam = c.camera.position.clone(), R = c.renderer.domElement.getBoundingClientRect(); if (!s) return null;
  let blocked = true; for (const dy of [.5, 1, 1.45]) { const v = new T.Vector3(s.p[0], s.p[1] + dy, s.p[2]).project(c.camera); if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
    const h = await H.hitAt(R.left + (v.x + 1) / 2 * R.width, R.top + (1 - v.y) / 2 * R.height), d = Math.hypot(s.p[0] - cam.x, s.p[1] + dy - cam.y, s.p[2] - cam.z); if (!h || h.distanceTo(cam) >= d - .5) { blocked = false; break; } }
  return blocked; })()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), out = [];
  try {
    await open(B, NEAR - 3);
    const arr = await B.ev(`(() => { const D = window.__record.draw; for (let m = ${NEAR - 3}; m < ${NEAR + 3}; m += .05) { const s = D.stateAt(${JSON.stringify(ID)}, m); if (s.trip) return s.trip.arr; } return null; })()`);
    if (arr === null) throw new Error('no trip home near ' + NEAR);
    await B.ev(`window.__record.player.seek(${arr - .33})`); await sleep(2500);
    const on = await B.ev(`(() => { const c = window.__city, w = c.cam.people.byAid(${JSON.stringify(ID)}); return !!w && c.cam.setMode('follow', { subject: w }) !== false && c.cam.subject === w; })()`);
    if (!on) throw new Error('could not follow ' + ID);
    await B.ev(SETUP); await B.ev('window.__record.player.play()');
    // (onto its step: a moment before it crosses its door, then paused there)
    for (let k = 0; k < 400; k++) { const m = await B.ev('window.__record.player.minute'); if (m >= arr - .06) break; await sleep(50); }
    await B.ev('window.__record.player.pause()'); await sleep(2000);
    const cam0 = await B.ev(`(() => { const c = window.__city, p = c.camera.position, s = c.cam.subject; return { m: +window.__record.player.minute.toFixed(3), cam: [p.x, p.y, p.z].map(v => +v.toFixed(2)), sub: s ? [s.p[0], s.p[1], s.p[2]].map(v => +v.toFixed(2)) : null, mode: c.cam.mode }; })()`);
    console.log('paused on its step', JSON.stringify(cam0));
    for (const a of AT) {
      const d = a === 'none' ? null : +a;
      await B.ev(`(window.__lp.d = ${d === null ? 'null' : d}, window.__lp.rows = [], true)`); await sleep(1200);
      await B.ev('(window.__lp.on = true, true)'); const t0 = Date.now(); let picks = 0, blocked = 0;
      while (Date.now() - t0 < SECS * 1000) { const b = await B.ev(PICK); if (b !== null) { picks++; if (b) blocked++; } await sleep(120); }
      await B.ev('(window.__lp.on = false, true)');
      const rows = await B.ev('window.__lp.rows'), ms = rows.map(r => r.ms).sort((x, y) => x - y), gone = rows.some(r => r.gone !== undefined) ? rows.filter(r => r.gone > 0).length : '-';
      const pin = await B.ev(`(() => { const L = window.__lp, w = L.w, p = window.__city.camera.position, s = window.__city.cam.subject, sub = s ? +Math.hypot(s.p[0] - p.x, s.p[1] + 1.25 - p.y, s.p[2] - p.z).toFixed(2) : null; if (!w || L.d === null) return { sub, cam: [p.x, p.y, p.z].map(v => +v.toFixed(2)) }; return { sub, cam: [p.x, p.y, p.z].map(v => +v.toFixed(2)), id: w.id, axis: +Math.hypot(w.p[0] - p.x, w.p[2] - p.z).toFixed(2), feet: w.p.slice(0, 3).map(v => +v.toFixed(2)) }; })()`);
      const shot = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }), file = path.join(OUT, `${TAG}-${a}.jpg`); await fs.writeFile(file, Buffer.from(shot.result.data, 'base64'));
      const r = { at: a, frames: rows.length, msMean: +(ms.reduce((x, y) => x + y, 0) / Math.max(1, ms.length)).toFixed(2), msP95: +(ms[Math.floor(ms.length * .95)] ?? 0).toFixed(2), pedsMs: +(rows.reduce((x, r) => x + r.up, 0) / Math.max(1, rows.length)).toFixed(3), gone, picks, blocked, pin, shot: path.relative(ROOT, file) };
      out.push(r); console.log(JSON.stringify(r));
    }
    // (nobody pinned again: the walker goes back to its lane)
    await B.ev(`(() => { const L = window.__lp; L.d = null; if (L.w) L.w.fix = null; return true; })()`);
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
  await fs.writeFile(path.join(OUT, `${TAG}-lensprobe.json`), JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
