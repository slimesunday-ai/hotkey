// Streaming pass · THE FLYTHROUGH: scripted camera paths through the running page (headless Chrome, real frames), measuring how well
// streaming keeps up with movement. The paths are fixed (a function of path time), so two runs are comparable frame for frame.
//   node style/city/tools/flythrough.mjs [--q medium] [--out <label>] [--only walk,drive,fly,goto] [--shots <dir>] [--warm]
//                                        [--w 1920 --h 1080] [--extra 'k=v&k=v'] [--base http://127.0.0.1:5320/style/city/]
// Scenarios (one page session, fresh Chrome profile: the block cache starts empty, as after any code change):
//   load   the page's own first view and full stream from navigation
//   walk   street level (2.9 m) down Central Ave from the west fringe through downtown at 8 m/s, a look to the side on the way
//   drive  street level (2 m) along 1st St from the west edge through downtown and the east fringe at 22 m/s, then north up Maple St
//   fly    elevated (120 m) across the woods, the mall, downtown and the hospital at 100 m/s, then north over the docks to Iron Island
//   zoom   the fidelity pass's zoom: from high over Glasswall Plaza, a 60 m dolly toward it in 2.5 s
//   goto   six teleports with the Go-to menu (the page's own <select>), each held until the stream settles (max 20 s)
// Camera pass (2026-10-05) · the camera rig's own modes, driven by its input (synthetic keys), opt-in: --only camfly,camfollow
//   camfly     FLY mode: from the west fringe at 40 m, W + Shift east over downtown for 9 s (the rig's velocity, governor, altitude speed)
//   camfollow  FOLLOW mode: from Fit Street, follow the nearest walker 10 s, Tab to the next one every 3 s
//   each also reports the rig's own cost per frame (__city.cam.stats(): update ms, mean and max)
// Before each path the camera waits at the path's start until the stream settles (max 30 s), and after it stays at the end until it
// settles again (max 20 s). Per frame (every requestAnimationFrame):
//   debt    visible blocks (in the frustum, wanted) shown below the tier the stream wants for them ("pop debt")
//   empty   visible blocks showing nothing   · farOnly  visible blocks that want mid or full detail and show only their far massing
//   frame time (rAF interval) p50 / p95 / max, hitches over 50 ms, draw calls, the stream's queue, and walkers (__city.peds.stats());
//   per path, the people popping on or off screen in view and range (__city.stream.charStats(), the fidelity pass's continuity check)
//   bands   in-view blocks by distance (0–50–100–150–250 m+) and the tier they show: a yardstick that does not depend on the preset
// Settle: time from arriving (end of a path, or a teleport) until nothing visible is in debt ("clean") and until the stream has
// nothing left to do ("settled"). --shots writes fly-over frames at fixed path times (the same moments in every run) as PNGs.
// --only goto alone is the cold-teleport test (nothing around the places has been visited). Rows of --extra: nobake=1 (the page without
// the baked city), q=… Saves tools/runs/<label>.fly.json (--out). The page must be served: node style/serve.mjs 5320
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), RUNS = path.join(HERE, 'runs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080), Q = opt('q', 'medium'), extra = opt('extra', ''), BASE = opt('base', process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/');
const ONLY = (opt('only', 'walk,drive,fly,zoom,goto')).split(','), SHOTS = opt('shots', null), WARM = args.includes('--warm');

// ── the paths: waypoints [x, z] walked at a constant speed; the camera looks `ahead` metres further along the path at height `ty`
// (it turns with the path), `yaw` adds a look to the side: [t0, t1, degrees] (a smooth there-and-back)
export const PATHS = {
  walk: { pts: [[-150, -1.3], [60, -1.3]], speed: 8, y: 2.9, ahead: 30, ty: 4, fov: 54, yaw: [9, 15, 75] },
  drive: { pts: [[-170, -30], [98, -30], [98, -200]], speed: 22, y: 2, ahead: 36, ty: 2.8, fov: 58 },
  fly: { pts: [[-440, 40], [180, -10], [270, -330]], speed: 100, y: 120, ahead: 150, ty: 0, fov: 50, shots: [1.5, 3.5, 5.5, 7.5, 9] },
  // the fidelity pass's zoom: park high over Glasswall Plaza, then dolly 60 m toward it in 2.5 s (ease-out, like a scroll zoom)
  zoom: { cam: [16, 70, 90], tgt: [16, 0, -16], D: 60, dur: 2.5, speed: 1, fov: 50 },
};
export const GOTO = [[240, 176, 'Motel 9'], [256, -338, 'Iron Island'], [-400, -150, 'the west shack'], [-208, -49, 'Sunny Acres'], [80, -240, 'Low Tide Docks'], [-16, 176, 'Pleasantview Park']];

// ── in the page: the driver (a requestAnimationFrame loop of its own; the page's loop renders the frame)
function driver() {
  const C = window.__city, RK = { far: 1, mid: 2, full: 3 }, BANDS = [50, 100, 150, 250, 1e9];
  const measure = () => { const S = C.stream; let vis = 0, debt = 0, empty = 0, farOnly = 0; const band = BANDS.map(() => [0, 0, 0, 0]);   // [none, far, mid, full]
    for (const r of S.blocks.values()) { if (!r.want || !r.inView) continue; vis++; const w = RK[r.want], s = r.shown ? RK[r.shown] : 0, done = (r.want === 'far' && r.emptyFar) || r.failed;
      if (!r.shown && !done) empty++; if (s < w && !done) debt++; if (s === 1 && w >= 2) farOnly++;
      if (!done) band[BANDS.findIndex(b => r.d < b)][s]++; }
    return { vis, debt, empty, farOnly, band, q: S.queueSize(), pend: S.stat.pending, calls: C.info.render.calls, tris: C.info.render.triangles }; };
  const at = (P, t) => { if (P.cam) { const u = Math.min(1, t / P.dur), e = 1 - Math.pow(1 - u, 3), d = P.tgt.map((v, k) => v - P.cam[k]), l = Math.hypot(...d);
      return { pos: P.cam.map((v, k) => v + d[k] / l * P.D * e), tgt: P.tgt, fov: P.fov, len: P.dur * P.speed }; }
    const L = [0]; for (let k = 1; k < P.pts.length; k++) L.push(L[k - 1] + Math.hypot(P.pts[k][0] - P.pts[k - 1][0], P.pts[k][1] - P.pts[k - 1][1]));
    const pt = s => { let k = 1; while (k < P.pts.length - 1 && s > L[k]) k++; const a = P.pts[k - 1], b = P.pts[k], f = (s - L[k - 1]) / (L[k] - L[k - 1]); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    const s = Math.min(t * P.speed, L[L.length - 1]), p = pt(s), q = pt(s + P.ahead); let dx = q[0] - p[0], dz = q[1] - p[1];
    if (P.yaw && t > P.yaw[0] && t < P.yaw[1]) { const a = P.yaw[2] * Math.PI / 180 * Math.sin(Math.PI * (t - P.yaw[0]) / (P.yaw[1] - P.yaw[0])), c = Math.cos(a), n = Math.sin(a); [dx, dz] = [dx * c - dz * n, dx * n + dz * c]; }
    return { pos: [p[0], P.y, p[1]], tgt: [p[0] + dx, P.ty, p[1] + dz], fov: P.fov, len: L[L.length - 1] }; };
  const place = v => { const { camera, controls } = C; camera.position.set(...v.pos); camera.fov = v.fov; camera.updateProjectionMatrix(); controls.target.set(...v.tgt); camera.lookAt(controls.target); };
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const pedStats = () => { try { return C.peds?.stats?.() || null; } catch { return null; } };
  const settledNow = m => C.stream.settled() && !m.debt && !m.empty;
  // record frames until `until(elapsed ms, m)` says stop; `step(t s)` moves the camera first
  async function record(o) { const F = [], peds = []; let last = null, skip = false; const t0 = performance.now(); let tClean = null, tSettled = null;
    for (;;) { const now = await raf(), el = now - t0;
      if (o.step) o.step(el / 1000); const m = measure();
      if (last !== null) F.push([Math.round(el), +(now - last).toFixed(1), m.debt, m.empty, m.farOnly, m.vis, m.q, m.pend, m.calls, skip ? 1 : 0, m.band.map(b => b.join(':')).join('|')]);
      skip = false; last = now;
      if (o.shoot && o.shoot(el / 1000)) skip = true;   // (a capture costs a frame: that frame is left out of the frame-time stats)
      if (F.length % 30 === 0) { const p = pedStats(); if (p) peds.push(p); }
      if (tClean === null && !m.debt && !m.empty && el >= (o.cleanFrom || 0)) tClean = el;
      if (tSettled === null && settledNow(m) && el >= (o.cleanFrom || 0)) tSettled = el;
      if (o.until(el, m, tSettled)) break; }
    return { F, peds, tClean, tSettled }; }
  // the characters' continuity counters (stream.js charStats, the fidelity pass): people popping on or off screen while in view and range
  const charStats = () => { try { return C.stream.charStats?.() || null; } catch { return null; } };
  const charDelta = c0 => { const c1 = charStats(); return c0 && c1 ? { onScreenRemovals: c1.onScreenRemovals - c0.onScreenRemovals, onScreenSpawns: c1.onScreenSpawns - c0.onScreenSpawns, dissolvedIn: c1.dissolvedIn - c0.dissolvedIn } : null; };
  // and the walkers' (peds.stats(), the pedestrian round): walkers leaving or arriving on screen
  const pedDelta = p0 => { const p1 = pedStats(); return p0 && p1 && p1.onScreenRemovals !== undefined ? { onScreenRemovals: p1.onScreenRemovals - p0.onScreenRemovals, onScreenSpawns: p1.onScreenSpawns - p0.onScreenSpawns } : null; };
  const shots = [];
  const capture = (v, name) => { place(v); C.renderer.render(C.scene, C.camera); const c = document.createElement('canvas'); c.width = 960; c.height = 540;
    c.getContext('2d').drawImage(C.renderer.domElement, 0, 0, 960, 540); shots.push({ name, data: c.toDataURL('image/png') }); };
  window.__fly = {
    async path(name, P) { C.controls.enabled = false; C.clearFixedShadow?.(); const v0 = at(P, 0); place(v0);
      const prep = await record({ step: () => place(v0), until: (el, m, ts) => ts !== null || el > 30000 }), c0 = charStats(), p0 = pedStats();
      const dur = at(P, 0).len / P.speed, pend = [...(P.shots || [])];
      const move = await record({ step: t => place(at(P, Math.min(t, dur))), until: el => el >= dur * 1000,
        shoot: t => { if (pend.length && t >= pend[0]) { const T = pend.shift(); capture(at(P, T), `${name}-t${T}`); return true; } return false; } });
      const end = at(P, dur); const hold = await record({ step: () => place(end), until: (el, m, ts) => (ts !== null && el > 300) || el > 20000 });
      return { prepMs: prep.tSettled, move: move.F, peds: move.peds, chars: charDelta(c0), walkers: pedDelta(p0), holdClean: hold.tClean, holdSettled: hold.tSettled, hold: hold.F }; },
    async goto(list) { const sel = document.getElementById('goto'), out = []; C.controls.enabled = true;
      for (let k = 0; k < 100 && sel.options.length < 2; k++) await new Promise(r => setTimeout(r, 100));
      for (const [x, z, label] of list) { const opt = [...sel.options].find(o => o.value === x + ',' + z), c0 = charStats(); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); } else C.nav.goTo(x, z);
        const r = await record({ until: (el, m, ts) => (ts !== null && el > 300) || el > 20000, cleanFrom: 50 }); out.push({ label, x, z, menu: !!opt, clean: r.tClean, settled: r.tSettled, frames: r.F, peds: r.peds, chars: charDelta(c0) }); }
      return out; },
    // camera pass · the rig's modes driven by its own input (synthetic key events: the rig's input reads keydown / keyup)
    async rig(name) { const R = C.cam; if (!R) return { error: 'no camera rig on this page' }; const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
      C.controls.enabled = true; R.toOrbit({ instant: true });
      if (name === 'camfly') { place({ pos: [-300, 40, -10], tgt: [-200, 30, -10], fov: 60 }); C.controls.update(); }
      else { C.setView('fitstreet'); }
      const prep = await record({ until: (el, m, ts) => ts !== null || el > 30000 }), c0 = charStats(), p0 = pedStats(); let r0 = R.stats();
      if (name === 'camfly') { R.setMode('fly', { lock: false }); key('KeyW', true); key('ShiftLeft', true); }
      else { if (!R.setMode('follow')) return { error: 'nobody to follow', prepMs: prep.tSettled }; }
      let tabs = 0; const dur = name === 'camfly' ? 9 : 10;
      const move = await record({ step: t => { if (name === 'camfollow' && t > (tabs + 1) * 3) { tabs++; key('Tab', true); key('Tab', false); } }, until: el => el >= dur * 1000 });
      if (name === 'camfly') { key('ShiftLeft', false); key('KeyW', false); }
      const r1 = R.stats(); const hold = await record({ until: (el, m, ts) => (ts !== null && el > 300) || el > 20000 }); R.setMode('orbit'); await new Promise(r => setTimeout(r, 2500));
      return { prepMs: prep.tSettled, move: move.F, peds: move.peds, chars: charDelta(c0), walkers: pedDelta(p0), holdClean: hold.tClean, holdSettled: hold.tSettled, hold: hold.F, rig: { updateMs: r1.updateMs, updateMax: r1.updateMax, solids: r1.solids, world: r1.world && { blocks: r1.world.blocks, full: r1.world.full, mainFrameMax: r1.world.mainFrameMax }, subject: r1.subject, mode: r1.mode } }; },
    shotCount: () => shots.length, shot: k => shots[k], clearShots: () => { shots.length = 0; },
  };
  return true;
}

async function session(fn) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-fly-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', `--window-size=${W},${H + 88}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
    if (!port) throw new Error('chrome did not start');
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map(), errs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300)); };
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    const ev = async (expr, ms = 120000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), sleep(ms).then(() => ({ timeout: true }))]);
      if (r.timeout) throw new Error('page evaluation timed out: ' + expr.slice(0, 80)); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
    await send('Runtime.enable'); await send('Page.enable');
    try { return await fn({ send, ev, errs }); } finally { ws.close(); }
  } finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
}

// ── summaries
const qt = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
export function summarize(F) {
  const ft = F.filter(f => !f[9]).map(f => f[1]), secs = F.reduce((s, f) => s + f[1], 0) / 1000 || 1, bs = k => F.reduce((s, f) => s + f[k] * f[1], 0) / 1000;
  const band = [0, 1, 2, 3, 4].map(b => { const t = [0, 0, 0, 0]; for (const f of F) f[10].split('|')[b].split(':').forEach((v, k) => t[k] += +v); const n = t.reduce((s, x) => s + x, 0) || 1; return t.map(x => +(x / n).toFixed(3)); });
  return { frames: F.length, secs: +secs.toFixed(1), ftP50: qt(ft, .5), ftP95: qt(ft, .95), ftMax: qt(ft, 1), hitches: ft.filter(x => x > 50).length,
    debtMean: +(bs(2) / secs).toFixed(2), debtMax: Math.max(0, ...F.map(f => f[2])), debtFrames: +(F.filter(f => f[2] > 0).length / Math.max(1, F.length)).toFixed(3), debtBlockSec: +bs(2).toFixed(1),
    emptyMean: +(bs(3) / secs).toFixed(2), emptyMax: Math.max(0, ...F.map(f => f[3])), emptyBlockSec: +bs(3).toFixed(1), farOnlyMean: +(bs(4) / secs).toFixed(2), farOnlyMax: Math.max(0, ...F.map(f => f[4])),
    visMean: +(bs(5) / secs).toFixed(1), callsP50: qt(F.map(f => f[8]), .5), callsMax: Math.max(0, ...F.map(f => f[8])),
    // share of in-view blocks at each tier [none, far, mid, full], per distance band 0–50, 50–100, 100–150, 150–250, 250+ m
    bands: band };
}
const f1 = v => v === null || v === undefined ? '–' : (+v).toFixed(1), sec = v => v === null || v === undefined ? ' >max' : (v / 1000).toFixed(2);

const out = { when: new Date().toISOString(), q: Q, size: `${W}x${H}`, base: BASE, extra, passes: [] };
const url = `${BASE}?q=${Q}&w=${W}&h=${H}&nodyn=1${extra ? '&' + extra : ''}`;
await session(async S => {
  for (let pass = 0; pass < (WARM ? 2 : 1); pass++) {
    const P = { cache: pass ? 'warm' : 'cold', scenarios: {} }; out.passes.push(P);
    await S.send('Page.navigate', { url }); const t0 = Date.now(); let m = null;
    while (Date.now() - t0 < 90000) { await sleep(150); m = await S.ev(`(() => { const c = window.__city; if (!c) return null; return { first: c.marks.first ?? null, full: c.marks.full ?? null, ready: c.marks.ready ?? null, workers: c.marks.workers ?? null, err: document.getElementById('err')?.textContent || '' }; })()`).catch(() => null);
      if (m?.err || m?.full) break; }
    P.load = m; P.preset = await S.ev(`({ name: __city.PR.name, auto: !!__city.PR.auto, gpu: __city.PR.gpu, R: __city.R })`).catch(() => null);
    P.loadMemory = await S.ev('__city.stream.memory ? __city.stream.memory() : null').catch(() => null); P.loadBaked = await S.ev('__city.baked ? { ...__city.baked.stats } : null').catch(() => null);
    console.log(`\n[${P.cache}] ${Q} · preset ${P.preset?.name} · gpu ${P.preset?.gpu} · first view ${sec(m?.first)} s · fully streamed ${sec(m?.full)} s${m?.ready ? ' · load-in released ' + sec(m.ready) + ' s' : ''}${m?.err ? ' · ERR ' + m.err.slice(0, 200) : ''}`);
    await S.ev(`(${driver.toString()})()`);
    for (const name of ['walk', 'drive', 'fly', 'zoom', 'camfly', 'camfollow']) { if (!ONLY.includes(name)) continue;
      const r = name.startsWith('cam') ? await S.ev(`__fly.rig(${JSON.stringify(name)})`, 180000) : await S.ev(`__fly.path(${JSON.stringify(name)}, ${JSON.stringify(PATHS[name])})`, 180000);
      if (r.error) { console.log(`${name.padEnd(6)} ${r.error}`); continue; } const s = summarize(r.move);
      P.scenarios[name] = { ...r, summary: s, memory: await S.ev('__city.stream.memory ? __city.stream.memory() : null').catch(() => null), baked: await S.ev('__city.baked ? { ...__city.baked.stats } : null').catch(() => null) };
      console.log(`${name.padEnd(6)} prep ${sec(r.prepMs)} s | ${s.secs} s ${s.frames} fr · frame p50 ${f1(s.ftP50)} p95 ${f1(s.ftP95)} max ${f1(s.ftMax)} ms · hitches ${s.hitches} | debt mean ${s.debtMean} max ${s.debtMax} (${(s.debtFrames * 100).toFixed(0)}% of frames, ${s.debtBlockSec} block·s) · empty mean ${s.emptyMean} max ${s.emptyMax} · far-only mean ${s.farOnlyMean} max ${s.farOnlyMax} · vis ${s.visMean} · calls ${s.callsP50}/${s.callsMax} | end: clean ${sec(r.holdClean)} s, settled ${sec(r.holdSettled)} s`);
      if (r.rig) console.log(`       camera rig (${r.rig.mode}${r.rig.subject ? ', ' + r.rig.subject : ''}): update ${r.rig.updateMs} ms mean, ${r.rig.updateMax} ms max · ${r.rig.solids ? `solids ${r.rig.solids.blocks} blocks rasterised (max ${(+r.rig.solids.maxMs).toFixed(2)} ms)` : `world ${r.rig.world?.blocks} blocks (${r.rig.world?.full} full; main thread max ${(+(r.rig.world?.mainFrameMax ?? 0)).toFixed(2)} ms a frame)`}`);
      const pw = r.peds?.length ? r.peds.map(x => x.walkers || 0) : null; if (pw || r.chars) console.log(`       walkers ${pw ? Math.min(...pw) + '–' + Math.max(...pw) : '–'}${r.chars ? ` · people popping on screen: ${r.chars.onScreenRemovals} off, ${r.chars.onScreenSpawns} on (${r.chars.dissolvedIn} dissolved in)` : ''}${r.walkers ? ` · walkers popping on screen: ${r.walkers.onScreenRemovals} off, ${r.walkers.onScreenSpawns} on` : ''}`);
      console.log(`       in view, share at full by distance: ${s.bands.map((b, k) => ['<50', '<100', '<150', '<250', '250+'][k] + ' ' + (b[3] * 100).toFixed(0) + '%').join(' · ')}   (empty <150: ${((s.bands[0][0] + s.bands[1][0] + s.bands[2][0]) / 3 * 100).toFixed(1)}%)`);
      const nShots = await S.ev('__fly.shotCount()'); if (SHOTS && nShots) { await fs.mkdir(SHOTS, { recursive: true }); for (let k = 0; k < nShots; k++) { const x = await S.ev(`__fly.shot(${k})`); await fs.writeFile(path.join(SHOTS, `${opt('prefix', '')}${x.name}.png`), Buffer.from(x.data.split(',')[1], 'base64')); } console.log(`       ${nShots} shots → ${path.relative(process.cwd(), SHOTS)}`); }
      await S.ev('__fly.clearShots()'); }
    if (ONLY.includes('goto')) { const g = await S.ev(`__fly.goto(${JSON.stringify(GOTO)})`, 300000); P.scenarios.goto = g.map(x => ({ ...x, summary: summarize(x.frames) }));
      for (const x of P.scenarios.goto) { const s = x.summary; console.log(`goto ${x.label.padEnd(18)} ${x.menu ? 'menu' : 'nav '} · clean ${sec(x.clean)} s · settled ${sec(x.settled)} s · frame p95 ${f1(s.ftP95)} max ${f1(s.ftMax)} ms · hitches ${s.hitches} · empty max ${s.emptyMax} · debt max ${s.debtMax}`); }
      const gs = P.scenarios.goto; P.gotoSummary = { cleanMean: Math.round(gs.reduce((s, x) => s + (x.clean ?? 20000), 0) / gs.length), settledMean: Math.round(gs.reduce((s, x) => s + (x.settled ?? 20000), 0) / gs.length), hitches: gs.reduce((s, x) => s + x.summary.hitches, 0) };
      console.log(`goto   mean clean ${sec(P.gotoSummary.cleanMean)} s · mean settled ${sec(P.gotoSummary.settledMean)} s · hitches ${P.gotoSummary.hitches}`); }
    const pageErr = await S.ev(`document.getElementById('err')?.textContent || ''`).catch(() => ''); P.errors = [...S.errs.splice(0), ...(pageErr ? [pageErr] : [])];
    if (P.errors.length) console.log('page errors:', P.errors.slice(0, 5).join(' | '));
  }
});
if (opt('out')) { await fs.mkdir(RUNS, { recursive: true }); const f = path.join(RUNS, opt('out') + '.fly.json'); await fs.writeFile(f, JSON.stringify(out)); console.log('saved ' + path.relative(process.cwd(), f)); }
