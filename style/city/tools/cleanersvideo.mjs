// C2-CLEANERS (2026-11-05) · CLEANERSVIDEO: a short clip of a cleaning for slime (traffic/cleaners.js), in the city's own page: the camera
// onto a spot (cleanercheck.mjs's spots, or --at), a body laid there (accident.js lay), the job run covered at 0.1 s to the state named
// (--from bag|ready|lift|carry|train|inside|mopOut|mop), then each frame drawn at 1/fps s and read off the canvas (the 3D view only:
// no page UI), cut by 4 % top and bottom, encoded with ffmpeg; stills of the states --stills names (their frame 1.5 s in).
// LIMITS (slime, 11-04: "limit the ammount of recording"): ≤ 15 s a clip, ≤ 30 fps, CRF 27, the frames on disk only while ffmpeg
// encodes, the Chrome profile removed once Chrome has exited (jaycheck.mjs's way).
//   node style/city/tools/cleanersvideo.mjs --port <p> (--spot <i> [--spots 240 --seed 7] | --at x,z,yaw) [--tod day|night]
//        [--from bag] [--secs 15] [--fps 30] [--cam dist,height,angle] [--stills mop,carry] --out <file.mp4>
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), SPOTS = +arg('spots', 240), SEED = +arg('seed', 7), PACE = 1, TOD = arg('tod', 'day'), DONE = 400, SPOT = arg('spot', null), AT = arg('at', null), FROM = arg('from', 'bag'), LEAD = +arg('lead', 0), SECS = Math.min(15, +arg('secs', 15)), FPS = Math.min(30, +arg('fps', 30)), OUTF = arg('out', null), STILLS = (arg('stills', '') || '').split(',').filter(Boolean), CAMA = (arg('cam', '13,7,35') || '').split(',').map(Number);
if (!PORT || !OUTF) { console.error('cleanersvideo: --port <p> --out <file.mp4> (--spot <i> | --at x,z,yaw)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), SHOTS = path.join(ROOT, 'style/city/shots/c2-cleaners');
const W = 1280, H = 720;
// the Chrome profile, removed only once Chrome has exited (jaycheck.mjs's way)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanersvideo-'));
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  const exited = new Promise(r => ch.once('exit', r)), kill = () => { LIVE.delete(kill); return rmProfile(ch, prof, exited); }; LIVE.add(kill);
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
  if (!port) { await kill(); throw new Error('chrome did not start'); }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning') && /cleaners|accident/i.test(JSON.stringify(m.params.args).slice(0, 2000))) errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, timeout = 600000) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errs, async close() { try { ws.close(); } catch {} await kill(); } };
}

// ── in the page (serialized): the harness — the spots, the oracle (the blocks' audit records), the frame checks
const INSTALL = async (SEED, PACE, DONE) => {
  const c = window.__city, THREE = c.THREE, A = c.traffic.accidents, CL = A.cleaners, TS = c.traffic.sim, PS = c.peds.sim, B = new URL('.', location.href).pathname;
  const [PL, J, AU, CN] = await Promise.all([import(B + 'plan.js'), import(B + 'jobs.js'), import(B + 'audit.js'), import(B + 'anim/cast/clips/cleaners.js')]);
  c.pauseLoop(true); c.cover(true);
  let s32 = SEED >>> 0; const rnd = () => { s32 = (Math.imul(s32 ^ (s32 >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s32 / 4294967296; };
  // a third of the ordinary cars are cabs for the run (by id: any spawned later too)
  const mark = () => { for (const o of TS.cars) if (o.kind === 'car' && !o.route && !o.stage && o.id % 10 === 0) o.asCar = true; };
  // the cars' pace (the playback's k×): their tick takes k page-seconds' worth
  if (PACE !== 1 && !TS._paced) { const t0 = TS.tick; TS.tick = dt => t0(dt * PACE); TS._paced = true; }
  // ── the spots: drawn from the traffic's lanes, by district, by kind of place (lane · kerb · corner · zebra), along each lane's travel
  // (as accident.js throws a body: its +x with the car), on the road and clear of parked cars
  const kinds = ['lane', 'kerb', 'kerb', 'corner', 'zebra'];
  function spots(n) { const byD = new Map(); for (const L of TS.lanes) { if (L.len < 14) continue; const mx = L.x0 + L.ux * L.len / 2, mz = L.z0 + L.uz * L.len / 2, d = PL.distOf(PL.kindAt(Math.floor(mx / PL.P), Math.floor(mz / PL.P))); if (!byD.has(d)) byD.set(d, []); byD.get(d).push(L); }
    const ds = [...byD.keys()].sort(), out = []; let guard = 0;
    while (out.length < n && guard++ < n * 60) { const d = ds[out.length % ds.length], Ls = byD.get(d), L = Ls[(rnd() * Ls.length) | 0], kind = kinds[(out.length / ds.length | 0) % kinds.length];
      const rx = -L.uz, rz = L.ux, ua = kind === 'corner' ? 4 + rnd() * 3 : kind === 'zebra' ? (rnd() < .5 ? 2.6 + rnd() * 1.2 : L.len - 4.5 - rnd()) : 6 + rnd() * (L.len - 12);
      let lat = kind === 'lane' ? rnd() * .8 : 1.3 + rnd() * 1.4; const lx = L.x0 + L.ux * ua, lz = L.z0 + L.uz * ua;
      // (at the kerb: its middle clear of the kerb by a body's depth, as the throw keeps it)
      if (kind !== 'lane') { let k = 0; for (; k < 8; k += .1) if (PL.kerbOut(lx + rx * k, lz + rz * k) > 0) break; lat = Math.min(lat, k - .55); if (lat < .2) continue; }
      const x = lx + rx * lat, z = lz + rz * lat; if (PL.kerbOut(x, z) > 0) continue; const yaw = Math.atan2(-L.uz, L.ux);
      // (where accident.js lets a body land: not on a parked car — its footprint, lie_still's, and a body's depth round it, clear)
      if (c.parkedIn(x - 1.9, z - 1.9, x + 1.9, z + 1.9)) continue;
      // (and beside a sidewalk: a body is a crowd walker's, and the crowd walks only where there is one — no woods, no sea road)
      if (!PS.laneNear(x, z, 9)) continue;
      if (out.some(s => Math.hypot(s.x - x, s.z - z) < 8)) continue;
      out.push({ i: out.length, d, kind, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(4) }); }
    return out; }
  // ── the oracle: a block's audit record (structures as boxes, props voxel by voxel), built once per block
  const REG = AU.REG, end0 = REG.end; let CAP = null; REG.end = function (cc, g) { CAP = this.blk; return end0.call(this, cc, g); };
  const ROT = [[1, 0], [0, 1], [-1, 0], [0, -1]], recs = new Map(), flags = { neutral: true, pass2: true, faces: true, letters: 'new' };
  function rec(i, j) { const k = i + ',' + j; if (recs.has(k)) return recs.get(k); CAP = null; try { J.jobBlock({ i, j, night: false, audit: true, chars: false, flags }); } catch (e) { recs.set(k, null); return null; }
    const b = CAP; recs.set(k, b ? { pls: b.pls.filter(p => p.kind !== 'bags'), structs: b.structs } : null); return recs.get(k); }
  const solidAt = (pl, x, y, z) => { const V = pl.V; let lx = x - pl.t[0], lz = z - pl.t[2]; const ly = y - pl.t[1];
    if (pl.rot) { const [cc, s] = ROT[pl.rot & 3], ux = lx * cc - lz * s, uz = lx * s + lz * cc; lx = ux; lz = uz; }
    const i = Math.floor((lx - V.org[0]) / V.s), j = Math.floor((ly - V.org[1]) / V.s), k = Math.floor((lz - V.org[2]) / V.s);
    return i >= 0 && j >= 0 && k >= 0 && i < V.nx && j < V.ny && k < V.nz && V.d[i + k * V.nx + j * V.sxz] !== 0; };
  const inBox = (b, x, y, z, e = 0) => x > b[0] + e && x < b[3] - e && y > b[1] + e && y < b[4] - e && z > b[2] + e && z < b[5] - e;
  // what solid is at (x, y, z): 'wall' (a structure) · '<kind>' (a prop) · null
  function solid(rs, x, y, z) { for (const r of rs) { if (!r) continue; for (const q of r.structs) if (inBox(q.box, x, y, z, .02) && (!q.V || solidAt(q, x, y, z))) return 'wall:' + (q.kind || q.id || ''); for (const q of r.pls) if (inBox(q.box, x, y, z) && solidAt(q, x, y, z)) return q.kind || 'prop'; } return null; }
  // ── the frame checks for the running job
  const V3 = new THREE.Vector3(), M = new THREE.Matrix4(), FR = new THREE.Frustum();
  const inView = (x, y, z, r = 1) => { const cam = c.camera; cam.updateMatrixWorld(); M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); FR.setFromProjectionMatrix(M); return FR.intersectsSphere(new THREE.Sphere(V3.set(x, y, z), r)) && Math.hypot(x - cam.position.x, z - cam.position.z) < 260; };
  const carHit = (o, x, z, r) => { const h = o.h + (o.yawOff || 0), dx = x - o.x, dz = z - o.z, a = dx * Math.sin(h) + dz * Math.cos(h), b = dx * Math.cos(h) - dz * Math.sin(h); return Math.abs(a) < o.len / 2 + r && Math.abs(b) < o.wid / 2 + r; };
  window.__cc = { spots, rec, solid, inView, mark, carHit, CN, stats: () => CL.stats(), A, CL, TS, PS, PL, c };
  return { lanes: TS.lanes.length, carry: CN.CARRY_GAP };
};

// one job filmed (in the page): run covered at 0.1 s to the moment (--from: a state of cleaners.js, less --lead s of it), then each
// frame drawn at 1/FPS s and read back; stills at the states named (--stills mop,carry: their middle frame)
const FILM = async (sp, FROM, LEAD, SECS, FPS, STILLS, CAMA) => {
  const { c, A, CL } = window.__cc; const yaw = sp.yaw, fx = Math.cos(yaw), fz = -Math.sin(yaw);
  const [dist, hgt, ang] = CAMA, a = ang * Math.PI / 180, side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  const aim = () => { const C = CL.job; const t = C?.door && !C.door.end ? [(sp.x + C.door.x) / 2, (sp.z + C.door.z) / 2] : [sp.x, sp.z]; return t; };
  const put = t => { const G = CL.job?.G, ox = G ? -G.A[0] : side[0], oz = G ? -G.A[1] : side[1], ux = G ? (G.ns ? 1 : 0) : -fx, uz = G ? (G.ns ? 0 : 1) : -fz, dx = ox * Math.cos(a) + ux * Math.sin(a), dz = oz * Math.cos(a) + uz * Math.sin(a); c.controls.target.set(t[0], .8, t[1]); c.camera.position.set(t[0] + dx * dist, hgt, t[1] + dz * dist); c.camera.lookAt(t[0], .8, t[1]); c.controls.update?.(); c.camera.lookAt(t[0], .8, t[1]); if (q?.toOrbit) q.toOrbit({ view: { pos: [c.camera.position.x, c.camera.position.y, c.camera.position.z], tgt: [t[0], .8, t[1]], fov: c.camera.fov } }); };
  put([sp.x, sp.z]); for (let k = 0; k < 400; k++) { c.tick(.1, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) c.tick(.1, 1);
  const K = A.lay(sp.x, sp.z, sp.yaw); if (!K) return { err: 'lay' }; let T = 0, started = false;
  for (; T < 400; T += .1) { c.tick(.1, 1); const C = CL.job; if (C && C.K === K) started = true; if (started && !C) return { err: 'ended before ' + FROM, log: [CL.stats().last?.log, CL.stats().why, CL.stats().lastGiveUp] };
    if (C && C.ph === FROM && C.t >= Math.max(0, -LEAD)) break; if (!started && T > 4) return { err: 'no job', why: CL.stats().why }; }
  const C0 = CL.job; if (!C0) return { err: 'no job at ' + FROM }; put(aim()); c.cover(false);
  for (let k = 0; k < 20; k++) await new Promise(r => setTimeout(r, 30));
  window.__film = { n: 0, seen: {}, stills: {}, door: C0.door.end ? 'walk' : 'door', over: false }; return { ok: true };
};
const S = await open(); let code = 1;
try {
  const url = `http://127.0.0.1:${PORT}/style/city/index.html${TOD === 'night' ? '?tod=night' : ''}`;
  await S.send('Page.navigate', { url }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 180000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.cleaners)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load');
  await sleep(3000); await S.ev(`(${INSTALL.toString()})(${SEED}, 1, 400)`); await S.ev(`__cc.CL.prepare()`);
  const sp = AT ? { x: +AT.split(',')[0], z: +AT.split(',')[1], yaw: +(AT.split(',')[2] || 0) } : (await S.ev(`__cc.spots(${SPOTS})`))[+SPOT];
  const r = await S.ev(`(${FILM.toString()})(${JSON.stringify(sp)}, ${JSON.stringify(FROM)}, ${LEAD}, ${SECS}, ${FPS}, ${JSON.stringify(STILLS)}, ${JSON.stringify(CAMA)})`);
  if (r.err) throw new Error(r.err + ' ' + JSON.stringify(r.log || r.why || ''));
  // (the page's own loop runs the job now, in real time; its frames are read with CDP's screenshot, at most FPS a second)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanersvideo-frames-')); let nf = 0; const stills = {}, seenS = {};
  try { await S.ev(`(() => { const c = window.__cc.c; c.cover(false); c.pauseLoop(false); return true; })()`); const t0 = Date.now();
    while (Date.now() - t0 < SECS * 1000) { const t1 = Date.now(), shot = await S.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); const d = shot.result?.data; if (d) { fs.writeFileSync(path.join(dir, String(nf++).padStart(4, '0') + '.jpg'), Buffer.from(d, 'base64'));
        const ph = await S.ev(`window.__cc.CL.job?.ph ?? null`); if (!ph) break; seenS[ph] = (seenS[ph] || 0) + 1; if (STILLS.includes(ph) && !stills[ph] && seenS[ph] > 8) stills[ph] = d; }
      const w = 1000 / FPS - (Date.now() - t1); if (w > 0) await sleep(w); }
    const secs = (Date.now() - t0) / 1000; await S.ev(`(() => { const c = window.__cc.c; c.pauseLoop(true); c.cover(true); return true; })()`);
    r.stills = stills; r.ph = Object.keys(seenS); r.door = await S.ev('window.__film.door'); r.frames = { length: nf }; r.fps = Math.min(FPS, nf / secs);
    const { execFileSync } = await import('node:child_process'); fs.mkdirSync(path.dirname(path.resolve(OUTF)), { recursive: true });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', r.fps.toFixed(2), '-i', path.join(dir, '%04d.jpg'), '-vf', 'crop=in_w:in_h-2*trunc(in_h*0.04):0:trunc(in_h*0.04),scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '27', '-pix_fmt', 'yuv420p', '-r', '30', OUTF]);
    for (const [k, d] of Object.entries(r.stills)) fs.writeFileSync(OUTF.replace(/\.mp4$/, `-${k}.jpg`), Buffer.from(d, 'base64'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`cleanersvideo: ${OUTF} · ${r.frames.length} frames at ${r.fps.toFixed(1)} fps (${(r.frames.length / r.fps).toFixed(1)} s) · ${r.door} · states ${r.ph.join(' ')} · stills ${Object.keys(r.stills).join(' ') || '-'}`); code = 0;
} catch (e) { console.error('cleanersvideo: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); process.exit(code);
