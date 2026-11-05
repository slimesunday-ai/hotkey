// C2-camera2 · ONE BLANK FRAME, LOOKED INTO (followprobe's blank: the canvas read back at 40×25 right after the render, luminance spread
// < 2.5, one flat colour). Headless Chrome on ?sim=record, seed 404, the page loaded with ?follow=<id> a little before --at and played at
// followprobe's speeds (--busy 10× on the agent's trips and the show, --quiet 60× between) or a fixed --speed. Every frame from --at − --pre to --at + --post it reads the canvas the same
// way and logs, with it, what the frame was made of: the camera (position, where it looks, near / far, the fog), the follow's own state
// (its subject, pivot, arm, hold, room), the agent's drawn state (draw.js stateAt) and walker, and the carriage. The first blank frame is
// saved whole (<out>/<tag>-blank-<id>-<minute>.png, read back in the same frame), and the next one, and the frame at --at.
//   node style/city/tools/blankprobe.mjs --port 5964 --id a05 --at 6361.82 [--card] [--speed 10] [--pre .4] [--post .6] [--out style/city/shots/c2-camera2]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5964), SEED = 404, ID = arg('id', 'a05'), AT = +arg('at', 6361.82), SPEED = arg('speed', null), BUSY = +arg('busy', 10), QUIET = +arg('quiet', 60), PRE = +arg('pre', .4), POST = +arg('post', .6), LEAD = +arg('lead', 3);
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera2'))), BASE = `http://127.0.0.1:${PORT}`, TAG = arg('tag', 'probe');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };

// (followprobe's speeds unless --speed: --busy through the agent's trips and the show, --quiet between — its windows(), as it has them)
function windows(id, from, to) {
  const D = window.__record.draw, L = D.timeline.segs.get(id) || [], out = [];
  for (let i = 0; i < L.length; i++) { if (L[i].start > to) break; const d = D.rule.at(id, i); if (!d?.trip) continue; const a = d.dep - 1, b = Math.max(d.trip.arr, d.dep) + 1; if (b >= from) out.push([a, b, d.trip.mode]); }
  for (let n = Math.floor(from / 1440); n <= Math.floor(to / 1440); n++) { try { const p = D.planner.night(n); if (p && p.end >= from && p.start <= to) out.push([p.start - 1, p.end + 1, 'show']); } catch {} }
  return out.sort((x, y) => x[0] - y[0]);
}
function sampler(id, o) {
  const c = window.__city, D = window.__record.draw, P = window.__record.player, gl = c.renderer.domElement, T = c.THREE, FW = new T.Vector3();
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 25; const cx = cv.getContext('2d', { willReadFrequently: true });
  const W = window.__bp = { rows: [], shots: [], done: false };
  const inWin = m => o.win.some(([a, b]) => m >= a && m < b);
  const f = () => { if (W.done) return; const m = P.minute; if (m >= o.to) { W.done = true; return; }
    { const sp = o.speed ?? (inWin(m) ? o.busy : o.quiet); if (P.running && P.speed !== sp) P.setSpeed(sp); }
    if (m >= o.from) {
      const car = c.subway?.openFor === id ? c.subway.open : null, shown = car?.view?.renderer?.domElement || gl;
      cx.drawImage(shown, 0, 0, 40, 25); const px = cx.getImageData(0, 0, 40, 25).data; let s1 = 0, s2 = 0, r = 0, g = 0, b = 0;
      for (let k = 0; k < px.length; k += 4) { const L = .2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]; s1 += L; s2 += L * L; r += px[k]; g += px[k + 1]; b += px[k + 2]; }
      const sd = Math.sqrt(Math.max(0, s2 / 1000 - (s1 / 1000) ** 2)), cam = c.camera, p = cam.position; FW.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const sub = c.cam.subject, a = D.agents?.map.get(id), w = a?.w, s = D.stateAt(id, m), g2 = c.cam.follow?.dbg;
      const row = { m: +m.toFixed(4), sd: +sd.toFixed(2), rgb: [r / 1000 | 0, g / 1000 | 0, b / 1000 | 0], mode: c.cam.mode, on: !!sub && sub.aid === id, stand: !!sub && sub !== w && !!sub?.ride,
        cam: [p.x, p.y, p.z].map(v => +v.toFixed(2)), fwd: [FW.x, FW.y, FW.z].map(v => +v.toFixed(2)), near: cam.near, far: +cam.far.toFixed(1), fov: +cam.fov.toFixed(1),
        fog: c.scene.fog ? [+c.scene.fog.near.toFixed(1), +c.scene.fog.far.toFixed(1)] : null, covered: !!c.covered, car: !!car,
        sub: sub ? [sub.p[0], sub.p[1], sub.p[2]].map(v => +v.toFixed(2)) : null, walker: w ? [w.p[0], w.p[1], w.p[2]].map(v => +v.toFixed(2)) : null,
        state: s.trip ? 'trip:' + s.trip.mode + ' ' + s.trip.from + '>' + s.trip.to : s.hidden ? 'hidden' : 'at ' + s.place, amode: a?.mode, under: !!a?.run?.under,
        f: g2 ? { L: g2.L.map(v => +v.toFixed(2)), arm: +g2.arm.toFixed(2), want: +g2.want.toFixed(2), Ls: +g2.dist.toFixed(2), armColl: +g2.armColl.toFixed(2), vis: +g2.vis.toFixed(2), pitch: +g2.pitch.toFixed(3), hold: g2.hold, room: g2.room?.src, ease: g2.room?.ease, enter: g2.enter, cuts: g2.cuts } : null,
        canvas: [gl.width, gl.height] };
      W.rows.push(row);
      if ((sd < 2.5 && (W.nShot = (W.nShot || 0) + 1) <= 2) || (m >= o.at && !W.atShot)) { if (m >= o.at && !W.atShot) W.atShot = true; W.shots.push({ m: row.m, png: shown.toDataURL('image/png') }); } }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome();
  try {
    const at0 = AT - LEAD;
    // (--card: the player's way in, followprobe's: a click on the agent opens its card, F presses Follow; else ?follow=)
    const CARD = process.argv.includes('--card');
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(at0)}&recordAt=${at0}&recordSpeed=${SPEED ?? QUIET}&recordPaused=1${CARD ? '' : '&follow=' + ID}` });
    await ready(B, 240000); await sleep(4000);
    if (CARD) { const { clickAgent, key } = await import('./c2lib.mjs'); const card = await clickAgent(B, ID).catch(() => null); if (card === ID) await key(B, 'f', 'KeyF', 70); console.log('card', card); }
    for (let k = 0; k < 40; k++) { if (await B.ev(`window.__city.cam?.subject?.aid === ${JSON.stringify(ID)}`)) break; await sleep(500); }
    const inject = async () => { const win = await B.ev(`(${windows})(${JSON.stringify(ID)}, ${at0}, ${AT + POST})`);
      return B.ev(`(${sampler})(${JSON.stringify(ID)}, ${JSON.stringify({ from: AT - PRE, to: AT + POST, at: AT, win, busy: BUSY, quiet: QUIET, speed: SPEED === null ? null : +SPEED })})`); };
    await inject(); await B.ev(`window.__record.player.play()`);
    // (drained as it goes; the page's own day / night reload on the way gets the sampler again — followprobe's way)
    const rows = [], shots = [], DR = '(() => { const W = window.__bp; if (!W) return null; const r = { rows: W.rows, shots: W.shots, done: W.done }; W.rows = []; W.shots = []; return r; })()';
    let origin = await B.ev('performance.timeOrigin'), reloads = 0;
    for (const t0 = Date.now(); Date.now() - t0 < 600000;) { await sleep(400);
      const o = await B.ev('performance.timeOrigin', false).catch(() => null); if (o === null) continue;
      if (o !== origin) { origin = o; reloads++; await ready(B, 240000).catch(() => {}); for (let k = 0; k < 40; k++) { if (await B.ev(`window.__city.cam?.subject?.aid === ${JSON.stringify(ID)}`).catch(() => false)) break; await sleep(250); } await inject(); continue; }
      const d = await B.ev(DR, false).catch(() => null); if (!d) continue; rows.push(...d.rows); shots.push(...d.shots); if (d.done) break; }
    console.log('reloads on the way', reloads);
    for (const s of shots) { const f = path.join(OUT, `${TAG}-blank-${ID}-${s.m}.png`); await fs.writeFile(f, Buffer.from(s.png.split(',')[1], 'base64')); console.log('saved', path.relative(ROOT, f)); }
    const blank = rows.filter(r => r.sd < 2.5);
    console.log(`${ID} ${rows.length} frames from ${AT - PRE} to ${AT + POST}: ${blank.length} blank`);
    // (the frames round each blank run: the one before, the run, the one after)
    for (let i = 0; i < rows.length; i++) { const r = rows[i], b = r.sd < 2.5, nb = (rows[i - 1]?.sd < 2.5) || (rows[i + 1]?.sd < 2.5); if (b || nb || i % 30 === 0) console.log((b ? 'BLANK ' : '      ') + JSON.stringify(r)); }
    await fs.writeFile(path.join(OUT, `${TAG}-blankprobe-${ID}.json`), JSON.stringify(rows));
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
