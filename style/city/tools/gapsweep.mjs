// C2-GAPS (2026-11-05) · GAPSWEEP: who takes each real body (traffic/accident.js: the van where its job fits, else the birds or decay —
// slime, 11-05: "i think just the gaps we fill with birds and decay, max gore lol, birds (pigeons and gulls) 1/3 and  then that last 1/3rd
// is  decay over time. both leave stains"), on every one of bodyland.mjs's 311 landings (style/city/tools/runs/bodyland-{11,12}.json), by
// day or at night. vansweep.mjs's harness (headless Chrome, the record's playback 404-A, tv=0, this checkout served on --port; its loop
// stopped and its drawing covered, api.tick at --dt; the camera onto the body from the kerb side, 20 m off, 15 m up; the body laid there
// with its linger run) — vansweep.mjs itself is left as it is (an existing check). For each landing, frame by frame to the take's end:
//   THE TAKER   the one the body got (K.taker, decided once: the van's fit test cleaners.fit, else the body's hash) and the one that took it
//               (a van job given up before the bag falls to the body's gap taker; birds with no way in fall to decay)
//   THE VAN     §9's clean: the van came, the bag went in, the van left unseen, with none of vansweep's failures (a car over the body, a
//               Cleaner, the bag or the van; a Cleaner or the bag in a wall, a prop or a parked car; a cab held over 3.5 s; a Cleaner
//               or the van appearing or gone in view; the bag gone from the frame)
//   BIRDS · DECAY  the body gone (the take ended, the walker under the remains) and a stain left, with none of:
//     car       a car's body (its rectangle, 5 cm in each side) over the body (1.8 × 0.56 m) or over what is drawn of the remains, until
//               the take ends; a car's box (its rectangle and birds.js carHeight, the tallest of its class) round a bird
//     wall · prop · parked   a bird (its middle, 0.15 m over its feet, ±0.08 m) inside a structure or a prop of the blocks (the audit's
//               records, vansweep's oracle) or a parked car
//     cab       a cab, a cruiser, a patrol or a route car standing within 15 m behind the body's stop hazards in its lane over 3.5 s
//     pop · vanish   a bird put out or taken off where the camera sees it; the walker hidden before the remains' shell is whole, or back
//               on the street, in view; a stain or the remains taken off in view
// And prints: the takers (and the share of the gaps each of birds and decay took), the van's clean share of its jobs, the fit test's
// refusals by reason, each failure named, the take times, the bird kinds, the flushes.
// --seek: a seek instead, on each gap take half way (birds: the wounds half over it; decay: 0.4 of its clock), through the record's
// player (a cut): two frames on, no bird left, the take ended, the remains at their end (eaten down / collapsed), the walker hidden and
// the stain there — nothing half-eaten, no stray bird.
// --frames n: the frame time instead, on the first n gap takes of evenly spread landings (cover off, the GPU finished each frame): p95 of
// --fn frames with the flock or the rotting body in view against the same view at once without it (the birds, the remains and the flies
// hidden) — the van's frames are vansweep.mjs's.
//   node style/city/tools/gapsweep.mjs --port <p> [--par 3] [--dt .1] [--tod day|night] [--done 420] [--only k,k…] [--json out.json]
//        [--frames n --fn 90] [--split birds|decay] (--split: every gap to one taker — for stills and looking, not the sweep)
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEEK = process.argv.includes('--seek'), PORT = +arg('port', 0), PAR = +arg('par', 3), DT = +arg('dt', .1), TOD = arg('tod', 'day'), DONE = +arg('done', 420), FRAMES = +arg('frames', 0), FN = +arg('fn', 90), SPLIT = arg('split', ''), VERB = process.argv.includes('--verbose');
if (!PORT) { console.error('gapsweep: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), JSONF = arg('json', path.join(ROOT, `style/city/tools/runs/gapsweep-${TOD}${FRAMES ? '-frames' : ''}.json`));
const W = 960, H = 600;
const ALL = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err && r.body).map(r => ({ seed: +s, i: r.i, place: r.place, cls: r.car?.cls, d: r.d, body: r.body })));
const ROWS = ALL.map((r, k) => ({ k, ...r }));
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'gapsweep-'));
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
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning') && /cleaners|accident|birds|decay|remains/i.test(JSON.stringify(m.params.args).slice(0, 2000))) errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, timeout = 600000) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errs, async close() { try { ws.close(); } catch {} await kill(); } };
}

// ── in the page: the oracle (cleanercheck.mjs's: the blocks' audit records) and the helpers
const INSTALL = async (DBG) => {
  const c = window.__city, A = c.traffic.accidents, CL = A.cleaners, TS = c.traffic.sim, PS = c.peds.sim, B = new URL('.', location.href).pathname;
  const [PL, J, AU, CR] = await Promise.all([import(B + 'plan.js'), import(B + 'jobs.js'), import(B + 'audit.js'), import(B + 'stage/cruiser.js')]);
  c.pauseLoop(true); c.cover(true); A.GORE.on = false; await CL.prepare(); if (DBG) globalThis.__cleanDbg = true;
  const REG = AU.REG, end0 = REG.end; let CAP = null; REG.end = function (cc, g) { CAP = this.blk; return end0.call(this, cc, g); };
  const ROT = [[1, 0], [0, 1], [-1, 0], [0, -1]], recs = new Map(), flags = { neutral: true, pass2: true, faces: true, letters: 'new' };
  function rec(i, j) { const k = i + ',' + j; if (recs.has(k)) return recs.get(k); CAP = null; try { J.jobBlock({ i, j, night: false, audit: true, chars: false, flags }); } catch (e) { recs.set(k, null); return null; }
    const b = CAP; recs.set(k, b ? { pls: b.pls.filter(p => p.kind !== 'bags'), structs: b.structs } : null); return recs.get(k); }
  const solidAt = (pl, x, y, z) => { const V = pl.V; let lx = x - pl.t[0], lz = z - pl.t[2]; const ly = y - pl.t[1];
    if (pl.rot) { const [cc, s] = ROT[pl.rot & 3], ux = lx * cc - lz * s, uz = lx * s + lz * cc; lx = ux; lz = uz; }
    const i = Math.floor((lx - V.org[0]) / V.s), j = Math.floor((ly - V.org[1]) / V.s), k = Math.floor((lz - V.org[2]) / V.s);
    return i >= 0 && j >= 0 && k >= 0 && i < V.nx && j < V.ny && k < V.nz && V.d[i + k * V.nx + j * V.sxz] !== 0; };
  const inBox = (b, x, y, z, e = 0) => x > b[0] + e && x < b[3] - e && y > b[1] + e && y < b[4] - e && z > b[2] + e && z < b[5] - e;
  function solid(rs, x, y, z) { for (const r of rs) { if (!r) continue; for (const q of r.structs) if (inBox(q.box, x, y, z, .02) && (!q.V || solidAt(q, x, y, z))) return 'wall:' + (q.kind || q.id || ''); for (const q of r.pls) if (inBox(q.box, x, y, z) && solidAt(q, x, y, z)) return q.kind || 'prop'; } return null; }
  window.__vs = { c, A, CL, TS, PS, PL, CR, rec, solid, BI: await import(B + 'traffic/birds.js') };
  return { lanes: TS.lanes.length, stage: !!window.__record?.draw?.stage?.ctx, van: CL.VAN, vanId: CL.CLEAN.van.id, gaps: !!A.gaps };
};


const RUN = async (V, DT, DONE, FR, FN, SPLIT, SEEK) => {
  const { c, A, CL, TS, PS, PL, CR, rec, solid, BI } = window.__vs, G = A.gaps, THREE = c.THREE, T0 = performance.now(), bx = V.body.x, bz = V.body.z, yaw = V.body.yaw;
  if (SPLIT) G.GAPS.birds = SPLIT === 'birds' ? 1 : 0;
  const row = { k: V.k, seed: V.seed, i: V.i, place: V.place, cls: V.cls, d: V.d, fails: {}, bad: [] }, fail = (k, d) => { row.fails[k] = (row.fails[k] || 0) + 1; if (row.fails[k] <= 2 && row.bad.length < 10) row.bad.push([k, +T.toFixed(1), d]); };
  let T = 0;
  // the camera onto the body, from the kerb side (vansweep's)
  const fx = Math.cos(yaw), fz = -Math.sin(yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(bx, .6, bz); c.camera.position.set(bx + side[0] * 20 - fx * 12, 15, bz + side[1] * 20 - fz * 12); c.camera.lookAt(bx, .6, bz); c.controls.update?.(); c.camera.lookAt(bx, .6, bz);
  for (let k = 0; k < 400; k++) { c.tick(DT, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) c.tick(DT, 1);
  const V3 = new THREE.Vector3(), M = new THREE.Matrix4(), FRU = new THREE.Frustum(), inView = (x, y, z, r = 1) => { const cam = c.camera; cam.updateMatrixWorld(); M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); FRU.setFromProjectionMatrix(M); return FRU.intersectsSphere(new THREE.Sphere(V3.set(x, y, z), r)) && Math.hypot(x - cam.position.x, z - cam.position.z) < 260; };
  for (let t = 0; t < 30 && TS.cars.some(o => !o.gone && Math.hypot(o.x - bx, o.z - bz) < o.len / 2 + 1.2); t += DT) c.tick(DT, 1);
  const st0 = CL.stats(), bs0 = G.birds.stats(), K = A.lay(bx, bz, yaw); if (!K) { row.err = 'lay'; return row; }
  const recAt = new Map(), recsFor = (x, z) => { const i0 = Math.floor(x / PL.P), j0 = Math.floor(z / PL.P), key = i0 + ',' + j0; if (!recAt.has(key)) { const RS = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) RS.push(rec(i0 + a, j0 + b)); recAt.set(key, RS); } return recAt.get(key); };
  const RS = recsFor(bx, bz);
  const bRect = { x: bx, z: bz, h: Math.atan2(Math.cos(yaw), -Math.sin(yaw)), len: 1.8 - .1, wid: .56 - .1 }, carR = o => ({ x: o.x, z: o.z, h: o.h + (o.yawOff || 0), len: o.len - .1, wid: o.wid - .1 });
  const disc = (o, x, z, r) => { const h = o.h + (o.yawOff || 0), dx = x - o.x, dz = z - o.z, a = dx * Math.sin(h) + dz * Math.cos(h), b = dx * Math.cos(h) - dz * Math.sin(h); return Math.abs(a) < o.len / 2 - .05 + r && Math.abs(b) < o.wid / 2 - .05 + r; };
  const isBad = o => !!(o.route || o.stage || o.asCar || o.kind !== 'car');
  let jobSeen = null, last = null, take = null, hid = false, ph = [], prevBirds = new Map(), stainsSeen = new Map(), standBad = new Map(), shot = false; row.held = 0; row.cabMax = 0;
  for (const s of G.stains) stainsSeen.set(s, true);
  for (let f = 0; f < DONE / DT + 50; f++) { c.tick(DT, 1); T += DT;
    if (!row.taker0 && K.taker) { row.taker0 = K.taker; row.fitWhy = K.fitWhy || null; row.fitHits = K.vanFit?.hits || null; }
    if (T > DONE) { fail('late', K.take ? K.take.kind : CL.job?.ph || K.taker); break; }
    // ── THE VAN (vansweep's checks, its job's frames)
    const C = CL.job;
    if (C && C.K === K) { jobSeen = C; if (C.ph !== last) { ph.push([C.ph, +T.toFixed(1)]); last = C.ph; }
      const van = C.ctl?.c && !C.ctl.c.gone && C.vanAt ? C.ctl.c : null;
      if (C.ph === 'leave' && van) row.leave = { went: !!C.went, v: +van.v.toFixed(2), d: +Math.hypot(van.x - C.stop.x, van.z - C.stop.z).toFixed(1), L: van.L?.kind, held: !!C.ctl.hold, s: +van.s.toFixed(1), len: van.L ? +van.L.len.toFixed(1) : null, next: !!van.next, ahead: (() => { const out = []; let L = van.L, s0 = van.s, k = 0; while (L && k < 4 && out.length < 6) { for (const o of L.cars.filter(q => q !== van && q.s > s0).sort((a2, b2) => a2.s - b2.s)) { if (out.length >= 6) break; out.push({ id: o.id, kind: o.kind, L: L.kind + '#' + L.id, s: +o.s.toFixed(1), v: +o.v.toFixed(2), hold: o.hold || null, go: !!o.go, wreck: !!o.wreck, kin: !!o.kin, stage: !!o.stage, route: !!o.route, next: o.next?.id ?? null }); }
            const nx = L === van.L ? van.next : L.kind === 'conn' ? L.out : (L.next?.find(q => q.turn === 'S') || L.next?.[0]); L = nx; s0 = -1; k++; } return out; })(), vanHold: van.hold || null, vanGo: !!van.go, vanNext: van.next?.id ?? null, vanRouteI: van.route ? [van.route.i, van.route.links.length, van.route.stops.length] : null, hz: TS.hazards.filter(h => Math.hypot(h.x - van.x, h.z - van.z) < 12).map(h => [+h.x.toFixed(1), +h.z.toFixed(1), h.soft, !!h.body, !!h.cleaner]) };
      for (const o of TS.cars) { if (o.gone || Math.abs(o.x - bx) > 40 || Math.abs(o.z - bz) > 40) continue;
        if (!K.bagged && Math.abs(o.x - bx) < 6 && Math.abs(o.z - bz) < 6 && CR.overlapOf(carR(o), bRect) < 0) fail('car', `over the body: ${o === van ? 'the van' : o.kind + ' ' + o.id} ${C.ph}`);
        if (van && o !== van && CR.overlapOf(carR(o), carR(van)) < 0) fail('car', `over the van: ${o.kind} ${o.id} ${C.ph} · it ${o.L?.kind}#${o.L?.id} s ${o.s?.toFixed(1)} v ${o.v.toFixed(1)} next ${o.next?.id ?? '-'} · van ${van.L?.kind}#${van.L?.id} s ${van.s?.toFixed(1)} v ${van.v.toFixed(1)} next ${van.next?.id ?? '-'} hold ${!!C.ctl?.hold}`);
        if (o === van) continue;
        for (const a of [C.A, C.B]) if (a && !a.gone && !a.inside && disc(o, a.x, a.z, .3)) fail('car', `over ${a.role}: ${o.kind} ${o.id} ${C.ph}`);
        if ((C.ph === 'carry' || C.ph === 'load' || C.ph === 'lift') && !C.loaded && C.carryM && disc(o, C.carryM[0], C.carryM[1], .35)) fail('car', `over the bag: ${o.kind} ${o.id} ${C.ph}`); }
      const pts = []; for (const a of [C.A, C.B]) if (a && !a.gone && !a.inside && !(a.clip && /car_get/.test(a.clip))) pts.push([a.x, a.z, a.role]);
      const bagAt = C.restBag ? [C.bagO, C.yaw + Math.PI / 2] : (C.ph === 'lift' || C.ph === 'carry' || C.ph === 'load') && !C.loaded && C.carryM ? [C.carryM, C.carryH] : null;
      if (bagAt) for (const s of [-.6, 0, .6]) pts.push([bagAt[0][0] + Math.sin(bagAt[1]) * s, bagAt[0][1] + Math.cos(bagAt[1]) * s, 'bag']);
      for (const [x, z, who] of pts) { let hit = null;
        for (const y of who === 'bag' ? [.25, .5] : [.35, .95, 1.55]) { for (const [ox, oz] of [[0, 0], [.22, 0], [-.22, 0], [0, .22], [0, -.22]]) { hit = solid(RS, x + ox, y + (PL.kerbOut(x, z) > 0 ? .2 : 0), z + oz); if (hit) break; } if (hit) break; }
        if (hit) fail(hit.startsWith('wall') ? 'wall' : 'prop', `${who} ${hit} ${C.ph} ${x.toFixed(1)},${z.toFixed(1)}`);
        else if (c.parkedIn(x - .2, z - .2, x + .2, z + .2)) fail('parked', `${who} ${C.ph} ${x.toFixed(1)},${z.toFixed(1)}`); } }
    else if (jobSeen && !K.take && !K.clean) { // (the job is over: done, or given up — then the body's gap taker comes next)
      const L = CL.stats().last; row.van = { done: !!(L && L.bagged && L.loaded && L.vanOut), bagged: L?.bagged, loaded: L?.loaded, vanOut: L?.vanOut, T: +T.toFixed(1) };
      if (row.van.done || K.bagged) break; if (K.taker === 'van' && T > 8 + row.van.T) { fail('van', 'gave up with no gap taker'); break; } }
    // ── BIRDS · DECAY
    if (K.take) { const tk = K.take, R = tk.R; if (!take) { take = tk; row.take = tk.kind; row.takeT = +T.toFixed(1); row.kind = tk.F?.kind; row.cells = R.cells.length; row.captured = R.captured; row.inPath = R.pathPts.length; }
      if (!tk.ended) {
        // the cars over the body and over what is drawn of the remains
        const ex = [Math.cos(yaw), -Math.sin(yaw)], ez = [Math.sin(yaw), Math.cos(yaw)];
        for (const o of TS.cars) { if (o.gone || Math.abs(o.x - bx) > 6 || Math.abs(o.z - bz) > 6) continue;
          if (!hid && CR.overlapOf(carR(o), bRect) < 0) fail('car', `over the body: ${o.kind} ${o.id}`);
          const h = o.h + (o.yawOff || 0), sh = Math.sin(h), ch = Math.cos(h);
          for (let i = 0; i < R.nx; i += 1) for (let j = 0; j < R.nz; j += 1) { const bxx = -.98 + (i + .5) * .07, bzz = -.49 + (j + .5) * .07; if (R.heightAt(bxx, bzz) < .03) continue; const wx = bx + ex[0] * bxx + ez[0] * bzz, wz = bz + ex[1] * bxx + ez[1] * bzz, dx = wx - o.x, dz = wz - o.z;
            if (Math.abs(dx * sh + dz * ch) < o.len / 2 - .05 && Math.abs(dx * ch - dz * sh) < o.wid / 2 - .05) { fail('car', `over the remains: ${o.kind} ${o.id}`); i = R.nx; break; } } }
        // the walker hidden only under a whole shell
        if (!hid && K.w.hide) { hid = true; row.hideT = +T.toFixed(1); if (!R.whole() && inView(bx, .5, bz, 1.2)) fail('vanish', 'the body hidden before the shell was whole'); }
        // the cabs (and cruisers, patrols, route cars) held by the body's hazards
        // (and every car: the queue behind the body — its stop hazards, and those over its own columns in a car path)
        const hz = K.bhz || []; let nq = 0; if (hz.length) for (const o of TS.cars) { if (o.gone || o.L?.kind !== 'lane') { standBad.delete(o); continue; } const L = o.L;
          const by = o.v < .3 && hz.some(h2 => { const dx = h2.x - L.x0, dz = h2.z - L.z0, al = dx * L.ux + dz * L.uz, lat = Math.abs(dx * -L.uz + dz * L.ux); return lat < o.wid / 2 + h2.r && al > o.s && al - o.s < 15; });
          if (by) { nq++; const t = (standBad.get(o) || 0) + DT; standBad.set(o, t); row.qMax = Math.max(row.qMax || 0, +t.toFixed(1)); if (isBad(o)) row.cabMax = Math.max(row.cabMax, +t.toFixed(1)); } else standBad.delete(o); }
        row.qN = Math.max(row.qN || 0, nq); row.hz = hz.length;
      }
      // the birds: in a car, in a wall or a prop, in a parked car; put out or taken off in view
      if (tk.F) { const now = new Map(); for (const b of tk.F.birds) { if (b.gone || !b.shown) continue; now.set(b, [b.x, b.y, b.z]); const y = b.y + .15;
          for (const o of TS.cars) { if (o.gone || Math.abs(o.x - b.x) > 6 || Math.abs(o.z - b.z) > 6) continue; if (y - .1 < BI.carHeight(o) && disc(o, b.x, b.z, -.05)) fail('car', `over a bird: ${o.kind} ${o.id} ${b.st} y ${b.y.toFixed(2)} · car len ${o.len.toFixed(1)} h ${BI.carHeight(o)} v ${o.v.toFixed(1)} · bird hold ${b.hold ? b.hold.map(v => +v.toFixed(1)) : '-'} hov ${b.hovT?.toFixed(2)}`); }
          let hit = null; for (const [ox, oz] of [[0, 0], [.08, 0], [-.08, 0], [0, .08], [0, -.08]]) { hit = solid(recsFor(b.x, b.z), b.x + ox, y, b.z + oz); if (hit) break; }
          if (hit) fail(hit.startsWith('wall') ? 'wall' : 'prop', `a bird (${b.st}) in ${hit} ${b.x.toFixed(1)},${y.toFixed(1)},${b.z.toFixed(1)}`);
          else if (y < 1.7 && c.parkedIn(b.x - .1, b.z - .1, b.x + .1, b.z + .1)) fail('parked', `a bird (${b.st}) ${b.x.toFixed(1)},${b.z.toFixed(1)}`);
          if (!prevBirds.has(b) && inView(b.x, b.y, b.z, .5)) fail('pop', `a bird put out in view (${b.st})`); }
        // (taken off where it is now: it flew there this frame, from where it was seen)
        for (const [b] of prevBirds) if (!now.has(b) && inView(b.x, b.y, b.z, .5)) fail('vanish', `a bird taken off in view (${b.st})`);
        prevBirds = now; }
      if (tk.ended) { row.endT = +T.toFixed(1); row.gone = !!K.w.hide || !A.now().some(o => Math.hypot(o.x - bx, o.z - bz) < .2); row.stain = G.stains.some(s => s.R === R); row.remainsLeft = +R.left().toFixed(2); break; } }
    // the stains (every one this page has): taken off only out of view
    for (const [s] of stainsSeen) if (!G.stains.includes(s)) { stainsSeen.delete(s); if (inView(s.at[0], s.at[1] + .2, s.at[2], 1.2)) fail('vanish', 'a stain taken off in view'); }
    for (const s of G.stains) if (!stainsSeen.has(s)) stainsSeen.set(s, true);
    // a seek half way (--seek): a cut, then two frames
    if (SEEK && K.take && !K.take.ended && ((K.take.F && K.take.F.cover >= .5) || (K.take.D && K.take.D.k >= .4))) { const pl = window.__record.player, tk = K.take; pl.seek(pl.minute + 1); c.tick(DT, 1); c.tick(DT, 1);
      const P = tk.R.P; row.seek = { birds: tk.F ? tk.F.birds.filter(b => !b.gone).length : 0, flying: G.birds.stats().flying, ended: !!tk.ended, end: tk.F ? P.eat >= 1 : P.sink >= 1, hidden: !!K.w.hide, stain: G.stains.some(s => s.R === tk.R) };
      row.seek.ok = !row.seek.birds && !row.seek.flying && row.seek.ended && row.seek.end && row.seek.hidden && row.seek.stain; row.take = tk.kind; break; }
    // the frame time (--frames): with the flock or the rot in view, then the same view without it
    if (FR && !shot && K.take && !K.take.ended && ((K.take.F && K.take.F.cover > .4 && K.take.F.birds.filter(b => b.st === 'eat').length >= K.take.F.birds.length / 2) || (K.take.D && K.take.D.k > .4))) { shot = true;
      const gl = c.renderer.getContext(), px = new Uint8Array(4), one = () => { const t0 = performance.now(); c.tick(DT, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
      c.cover(false); for (let k = 0; k < 10; k++) one(); const w1 = []; for (let k = 0; k < FN; k++) w1.push(one());
      const hide = [...Object.values(G.birds.meshes), K.take.R.mesh, G.decay.points], vis0 = hide.map(m => m.visible); for (const m of hide) m.visible = false; const w0 = [];
      for (let k = 0; k < 10; k++) one(); for (let k = 0; k < FN; k++) w0.push(one()); hide.forEach((m, k) => { m.visible = vis0[k]; }); c.cover(true);
      const p95 = a => { const s = a.slice().sort((x, y) => x - y); return +s[Math.floor(s.length * .95)].toFixed(2); }; row.frame = { with: p95(w1), without: p95(w0), take: K.take.kind, inView: inView(bx, .5, bz) }; break; }
  }
  // the van's own counters (vansweep's): a Cleaner or the van appearing or gone in view, the bag gone from the frame, cabs held
  const st = CL.stats(); row.ph = ph;
  if (jobSeen) { row.heldBad = st.held.slice((st0.held || []).length); row.vanCab = Math.max(0, ...row.heldBad.map(h => h.t)); if (row.vanCab > 3.5) fail('cab', JSON.stringify(row.heldBad));
    for (const [k, n] of [['vanish', st.removedSeen - st0.removedSeen], ['pop', st.spawnSeen - st0.spawnSeen], ['vanPop', st.vanSeen - st0.vanSeen], ['vanGoneSeen', (st.vanSeenGone || 0) - (st0.vanSeenGone || 0)], ['bagGone', (st.bagGone || 0) - (st0.bagGone || 0)]]) if (n > 0) fail(k, String(n));
    if (CL.job) CL.abort('sweep'); }
  if (row.cabMax > 3.5) fail('cab', 'held by the body ' + row.cabMax + ' s');
  const bs = G.birds.stats(); row.flushes = bs.flushes - bs0.flushes; row.birdsNoWay = (A.stats().birdsNoWay || 0);
  if (K.take && !K.take.ended) A.gaps.endTake(K);
  row.taker = row.van?.done ? 'van' : row.take || (K.bagged ? 'van' : null); row.path = [row.taker0, row.take && row.taker0 !== row.take ? row.take : null].filter(Boolean).join('>');
  if (SEEK) { row.clean = !!row.seek?.ok; A.clear(K); row.T = +T.toFixed(1); return row; }
  if (!FR) { if (row.taker === 'van') row.clean = !!row.van?.done && !Object.keys(row.fails).length; else if (row.take) { if (!row.gone) fail('notGone', '1'); if (!row.stain) fail('noStain', '1'); row.clean = !Object.keys(row.fails).length; } else { row.clean = false; row.err = row.err || 'noTaker'; } }
  // (the body off this landing, whatever is left: the next landing is far)
  A.clear(K);
  row.T = +T.toFixed(1); row.wall = +(performance.now() - T0).toFixed(0); return row;
};

let out = [];
async function worker(list) { const S = await open();
try {
  const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' }); if (TOD === 'night') qs.set('tod', 'night');
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.cleaners && window.__record?.draw?.stage?.ctx)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load (or no stage)');
  await sleep(3000); const info = await S.ev(`(${INSTALL.toString()})(false)`); console.log(`page up: ${JSON.stringify(info)}`);
  for (const V of list) { if (FRAMES && out.filter(r => r.frame).length >= FRAMES) break; let r; try { r = await S.ev(`(${RUN.toString()})(${JSON.stringify(V)}, ${DT}, ${DONE}, ${FRAMES ? 1 : 0}, ${FN}, ${JSON.stringify(SPLIT)}, ${SEEK})`); } catch (e) { r = { k: V.k, place: V.place, err: 'page: ' + String(e.message).slice(0, 300), fails: {} }; }
    out.push(r); const f = Object.keys(r.fails || {});
    if (VERB || !r.clean) console.log(`#${r.k} (${V.seed}/${V.i}) ${V.place} ${V.cls}: ${r.frame ? 'frame ' + JSON.stringify(r.frame) : r.clean ? 'clean' : 'NOT CLEAN'} ${r.err || ''} ${r.path || ''} fit ${r.fitWhy || '-'}${r.kind ? ' ' + r.kind : ''} T ${r.T}${r.take ? ` take@${r.takeT} hide@${r.hideT} end@${r.endT} gone ${r.gone} stain ${r.stain} cells ${r.cells}${r.captured ? '' : ' standIn'} flushes ${r.flushes}` : ''}${r.van ? ' van ' + JSON.stringify(r.van) : ''} cab ${r.cabMax} ${f.length ? 'FAIL ' + JSON.stringify(r.fails) + ' ' + JSON.stringify(r.bad) : ''}${r.ph?.length ? ' · ' + r.ph.map(p => p.join('@')).join(' ') : ''} (${((r.wall || 0) / 1000).toFixed(0)} s)`); }
} catch (e) { console.error('gapsweep: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); }
const ONLY = arg('only', null); let RUNS = ONLY ? ROWS.filter(r => ONLY.split(',').includes(String(r.k))) : ROWS;
if (FRAMES && !ONLY) RUNS = Array.from({ length: FRAMES * 3 }, (_, k) => ROWS[Math.floor(k * ROWS.length / (FRAMES * 3))]);
const lists = Array.from({ length: PAR }, (_, k) => RUNS.filter((_, i) => i % PAR === k)).filter(l => l.length);
await Promise.all(lists.map(l => worker(l)));
out.sort((a, b) => a.k - b.k); fs.mkdirSync(path.dirname(JSONF), { recursive: true }); fs.writeFileSync(JSONF, JSON.stringify(out).replace(/\},\{"k"/g, '},\n{"k"'));
const med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; }, p90 = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length * .9)] : null; };
const cnt = (rs, f) => { const m = {}; for (const r of rs) { const k = f(r); m[k] = (m[k] || 0) + 1; } return m; };
if (FRAMES) { const fr = out.filter(r => r.frame).slice(0, FRAMES), ratio = fr.map(r => r.frame.with / r.frame.without);
  console.log(`\ngapsweep frames ${TOD}: ${fr.length} landings (${JSON.stringify(cnt(fr, r => r.frame.take))}), p95 with ${JSON.stringify(fr.map(r => r.frame.with))} ms, without ${JSON.stringify(fr.map(r => r.frame.without))} ms · the ratio median ${med(ratio)?.toFixed(3)} max ${Math.max(...ratio).toFixed(3)} · all p95 with ${med(fr.map(r => r.frame.with))} vs without ${med(fr.map(r => r.frame.without))} (medians)`);
  const pass = fr.length && med(fr.map(r => r.frame.with)) <= 1.05 * med(fr.map(r => r.frame.without)); console.log(`gapsweep frames: ${pass ? 'PASS' : 'FAIL'} (the median p95 with ≤ 1.05× without)`); process.exit(pass ? 0 : 1); }
if (SEEK) { const sk = out.filter(r => r.seek), ok = sk.filter(r => r.seek.ok); console.log(`\ngapsweep seek ${TOD}: ${sk.length} gap takes cut half way (${JSON.stringify(cnt(sk, r => r.take))}) · settled ${ok.length}/${sk.length} · not: ${JSON.stringify(sk.filter(r => !r.seek.ok).map(r => [r.k, r.seek]))}`);
  const pass = sk.length && ok.length === sk.length; console.log(`gapsweep seek: ${pass ? 'PASS' : 'FAIL'}`); process.exit(pass ? 0 : 1); }
const fk = {}; for (const r of out) { if (r.err) fk[r.err] = (fk[r.err] || 0) + 1; for (const k of Object.keys(r.fails || {})) fk[k] = (fk[k] || 0) + 1; }
const takers = cnt(out, r => r.taker || 'none'), one = out.filter(r => r.taker && !r.err).length, vans = out.filter(r => r.taker0 === 'van'), vanJobs = out.filter(r => r.van), vanClean = out.filter(r => r.taker === 'van' && r.clean);
const gaps = out.filter(r => r.take), birds = gaps.filter(r => r.take === 'birds'), decay = gaps.filter(r => r.take === 'decay'), gapOk = gaps.filter(r => r.gone && r.stain);
console.log(`\ngapsweep ${TOD}: ${out.length} landings · one taker each ${one}/${out.length} · takers ${JSON.stringify(takers)} · paths ${JSON.stringify(cnt(out, r => r.path || 'none'))}`);
console.log(`  the van: fit ${vans.length}, its jobs ${vanJobs.length}, clean ${vanClean.length}/${vanJobs.length} (${(100 * vanClean.length / Math.max(1, vanJobs.length)).toFixed(1)}%) · the fit test's refusals ${JSON.stringify(cnt(out.filter(r => r.taker0 && r.taker0 !== 'van'), r => (r.fitWhy || '?').split(':')[0]))}`);
console.log(`  the gaps: ${gaps.length} · birds ${birds.length} (${(100 * birds.length / Math.max(1, gaps.length)).toFixed(1)}%) ${JSON.stringify(cnt(birds, r => r.kind))} · decay ${decay.length} (${(100 * decay.length / Math.max(1, gaps.length)).toFixed(1)}%) · body gone and a stain left ${gapOk.length}/${gaps.length}`);
console.log(`  take time (the take to its end): birds median ${med(birds.filter(r => r.endT).map(r => r.endT - r.takeT).map(v => +v.toFixed(1)))} s p90 ${p90(birds.filter(r => r.endT).map(r => +(r.endT - r.takeT).toFixed(1)))} s · decay median ${med(decay.filter(r => r.endT).map(r => +(r.endT - r.takeT).toFixed(1)))} s · flushes per flock median ${med(birds.map(r => r.flushes))} · remains read off the body ${gaps.filter(r => r.captured).length}/${gaps.length}`);
const q = gaps.filter(r => r.qMax); console.log(`  the queue behind a body (cars standing at its stop hazards — a body in a lane, or its own columns in a car path): ${q.length}/${gaps.length} takes (${gaps.filter(r => r.inPath).length} with columns in a car path) · the longest a car stood median ${med(q.map(r => r.qMax))} s max ${Math.max(0, ...q.map(r => r.qMax))} s · cars at once max ${Math.max(0, ...q.map(r => r.qN || 0))}`);
console.log(`  failures by kind ${JSON.stringify(fk)} · clean ${out.filter(r => r.clean).length}/${out.length}`);
const carF = out.filter(r => r.fails?.car), inF = out.filter(r => r.fails?.wall || r.fails?.prop || r.fails?.parked), popF = out.filter(r => r.fails?.pop || r.fails?.vanish || r.fails?.vanPop || r.fails?.vanGoneSeen), cabF = out.filter(r => r.fails?.cab);
console.log(`  cars over a body, a bird, a Cleaner, the bag or the van: ${carF.length} · birds or the crew in a car, a wall, a prop: ${inF.length} · appearing or vanishing in view: ${popF.length} · cabs held over 3.5 s: ${cabF.length}`);
const bars = { oneTaker: one === out.length, van: vanClean.length >= .95 * vanJobs.length, gapsEnd: gapOk.length === gaps.length, cars: !carF.length, birdsIn: !out.some(r => r.fails?.wall || r.fails?.prop || r.fails?.parked || (r.fails?.car && r.bad.some(b => /bird/.test(b[2])))), view: !popF.length, cabs: !cabF.length, split: gaps.length > 0 && birds.length >= .4 * gaps.length && birds.length <= .6 * gaps.length && decay.length >= .4 * gaps.length && decay.length <= .6 * gaps.length };
const pass = Object.values(bars).every(Boolean);
console.log(`gapsweep ${TOD}: ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(bars)} · rows: ${path.relative(ROOT, JSONF)}`); process.exit(pass ? 0 : 1);
