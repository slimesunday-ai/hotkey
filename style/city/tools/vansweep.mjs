// C2-CLEANERS round 3 (2026-11-05) · VANSWEEP: the Cleaners' van (traffic/cleaners.js) on every real body landing — bodyland.mjs's rows
// (style/city/tools/runs/bodyland-{11,12}.json, 311 bodies thrown by traffic/accident.js itself), by day or at night. In a real page
// (headless Chrome, the record's playback 404-A, tv=0, this checkout served on --port), its loop stopped and its drawing covered (api.tick
// at --dt), for each landing: the camera onto the body (from the kerb side, 20 m off, 15 m up), a body laid there (accidents.lay: a crowd
// walker, its linger run — the Cleaners' at once while the camera sees it), then the job run frame by frame to its end. Real traffic:
// nothing is marked a cab (the playback's own cabs, cruisers, patrols and route cars are the ones that count).
// A landing is CLEAN when the van came, the job was done (bagged and loaded) and the van left unseen, with none of:
//   car       a car's body (its rectangle, 5 cm in each side) over the body's footprint (1.8 × 0.56 m, until it is in the bag), over a
//             Cleaner (a 0.3 m disc, not inside the van) or the bag carried, or over the van (another car: overlapOf < 0)
//   wall · prop · parked   a Cleaner's body (discs at 0.35, 0.95, 1.55 m up) or the bag inside a structure or a prop of the blocks there
//             (the blocks rebuilt with the audit on: jobs.js jobBlock, audit.js REG — cleanercheck.mjs's oracle) or a parked car (main.js
//             parkedIn's boxes)
//   cab       a cab, a cruiser, a patrol or a route car held by the job (cleaners.js stats().held: standing behind its hazards or the
//             van) over 3.5 s (GORE.wreck.cab)
//   vanish · pop  a Cleaner removed or put on the street where the camera sees it (not inside the van), the van appearing or gone in
//             view, the bag gone from the frame while the job holds it
// And prints: the clean share (by place), each failure named, the job time (from the request to the van gone: median, p90), the queue
// behind the job (cars standing on its lanes within 60 m: the most at once, the longest a car stood, and any standing in a zebra or a
// box), every held cab and how long, the crowd walkers held by a Cleaner (the longest a walker stood with one close ahead: max, p90).
// --frames n: the frame time instead, on n landings drawn (cover off, the GPU finished each frame): p95 of --fn frames with the
// cleaning in view (from the bag on) against the same view at once without it (the van, the crew and the bag hidden, the zone kept).
//   node style/city/tools/vansweep.mjs --port <p> [--par 3] [--dt .1] [--tod day|night] [--done 300] [--only k,k…] [--json out.json]
//        [--frames n --fn 90] [--linger s]
// --linger s: the body alone instead — laid fresh, the Cleaners off, s seconds of traffic past it: the cars over it (bodyland's measure).
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), PAR = +arg('par', 3), DT = +arg('dt', .1), TOD = arg('tod', 'day'), DONE = +arg('done', 300), FRAMES = +arg('frames', 0), FN = +arg('fn', 90), LINGER = +arg('linger', 0), VERB = process.argv.includes('--verbose');
if (!PORT) { console.error('vansweep: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), JSONF = arg('json', path.join(ROOT, `style/city/tools/runs/vansweep-${TOD}${FRAMES ? '-frames' : ''}.json`));
const W = 960, H = 600;
const ALL = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err && r.body).map(r => ({ seed: +s, i: r.i, place: r.place, cls: r.car?.cls, d: r.d, body: r.body, laneAhead: r.laneAhead })));
const ROWS = ALL.map((r, k) => ({ k, ...r }));
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'vansweep-'));
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
  window.__vs = { c, A, CL, TS, PS, PL, CR, rec, solid };
  return { lanes: TS.lanes.length, stage: !!window.__record?.draw?.stage?.ctx, van: CL.VAN };
};

const RUN = async (V, DT, DONE, FR, FN, LINGER) => {
  const { c, A, CL, TS, PS, PL, CR, rec, solid } = window.__vs, THREE = c.THREE, T0 = performance.now(), bx = V.body.x, bz = V.body.z, yaw = V.body.yaw;
  const row = { k: V.k, seed: V.seed, i: V.i, place: V.place, cls: V.cls, d: V.d, fails: {}, bad: [] }, fail = (k, d) => { row.fails[k] = (row.fails[k] || 0) + 1; if (row.fails[k] <= 2 && row.bad.length < 8) row.bad.push([k, +T.toFixed(1), d]); };
  let T = 0;
  // the camera onto the body, from the kerb side
  const fx = Math.cos(yaw), fz = -Math.sin(yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(bx, .6, bz); c.camera.position.set(bx + side[0] * 20 - fx * 12, 15, bz + side[1] * 20 - fz * 12); c.camera.lookAt(bx, .6, bz); c.controls.update?.(); c.camera.lookAt(bx, .6, bz);
  for (let k = 0; k < 400; k++) { c.tick(DT, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) c.tick(DT, 1);
  // the frame's view test (cleanercheck's)
  const V3 = new THREE.Vector3(), M = new THREE.Matrix4(), FRU = new THREE.Frustum(), inView = (x, y, z, r = 1) => { const cam = c.camera; cam.updateMatrixWorld(); M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); FRU.setFromProjectionMatrix(M); return FRU.intersectsSphere(new THREE.Sphere(V3.set(x, y, z), r)) && Math.hypot(x - cam.position.x, z - cam.position.z) < 260; };
  // (laid as a throw lands: ahead of its car, with no car over the spot — up to 30 s for one to pass)
  for (let t = 0; t < 30 && TS.cars.some(o => !o.gone && Math.hypot(o.x - bx, o.z - bz) < o.len / 2 + 1.2); t += DT) c.tick(DT, 1);
  if (LINGER) { CL.CLEAN.on = false; const K = A.lay(bx, bz, yaw, { linger: 1 }); if (!K) { row.err = 'lay'; return row; } const bR = { x: bx, z: bz, h: Math.atan2(Math.cos(yaw), -Math.sin(yaw)), len: 1.7, wid: .46 }, over = new Set(); let frames = 0, past = 0, near = new Set();
    for (let t = 0; t < LINGER; t += DT) { c.tick(DT, 1); for (const o of TS.cars) { if (o.gone || Math.abs(o.x - bx) > 8 || Math.abs(o.z - bz) > 8) continue; near.add(o); if (CR.overlapOf({ x: o.x, z: o.z, h: o.h + (o.yawOff || 0), len: o.len - .1, wid: o.wid - .1 }, bR) < 0) { over.add(o.id); frames++; } } }
    row.linger = { secs: LINGER, over: over.size, frames, near: near.size, hazards: (K.bhz || []).length, standing: TS.cars.filter(o => near.has(o) && !o.gone && o.v < .3).length }; CL.CLEAN.on = true; row.clean = !over.size; row.wall = +(performance.now() - T0).toFixed(0); return row; }
  const st0 = CL.stats(), K = A.lay(bx, bz, yaw); if (!K) { row.err = 'lay'; return row; }
  const BL = PL.P, i0 = Math.floor(bx / BL), j0 = Math.floor(bz / BL), RS = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) RS.push(rec(i0 + a, j0 + b));
  const bRect = { x: bx, z: bz, h: Math.atan2(Math.cos(yaw), -Math.sin(yaw)), len: 1.8 - .1, wid: .56 - .1 }, carR = o => ({ x: o.x, z: o.z, h: o.h + (o.yawOff || 0), len: o.len - .1, wid: o.wid - .1 });
  const disc = (o, x, z, r) => { const h = o.h + (o.yawOff || 0), dx = x - o.x, dz = z - o.z, a = dx * Math.sin(h) + dz * Math.cos(h), b = dx * Math.cos(h) - dz * Math.sin(h); return Math.abs(a) < o.len / 2 - .05 + r && Math.abs(b) < o.wid / 2 - .05 + r; };
  const zcars = new Set(); let started = false, job = null, last = null, heldT = new Map(), stand = new Map(), shot = null; const ph = [];
  row.queue = 0; row.waitMax = 0; row.zebra = 0; row.held = 0;
  const zebraOf = o => { const L = o.L; if (!L) return null; if (L.kind !== 'lane') return 'box'; return o.s - o.len < -.2 ? 'zebra' : null; };
  for (let f = 0; f < DONE / DT + 50; f++) { c.tick(DT, 1); T += DT; const C = CL.job;
    if (!started) { if (C && C.K === K) { started = true; job = C; } else if (T > 3) { row.err = 'noJob'; row.noStop = CL.stats().lastNoStop; break; } else continue; }
    if (!C) break;
    if (C.ph !== last) { ph.push([C.ph, +T.toFixed(1)]); last = C.ph; }
    if (T > DONE) { fail('late', C.ph); break; }
    const van = C.ctl?.c && !C.ctl.c.gone && C.vanAt ? C.ctl.c : null;
    // the cars over the body (until the bag), the van, the crew and the bag
    for (const o of TS.cars) { if (o.gone || Math.abs(o.x - bx) > 40 || Math.abs(o.z - bz) > 40) continue;
      if (!K.bagged && Math.abs(o.x - bx) < 6 && Math.abs(o.z - bz) < 6 && CR.overlapOf(carR(o), bRect) < 0) fail('car', `over the body: ${o === van ? 'the van' : o.kind + ' ' + o.id} v ${o.v.toFixed(1)} ${C.ph}`);
      if (van && o !== van && CR.overlapOf(carR(o), carR(van)) < 0) fail('car', `over the van: ${o.kind} ${o.id} ${C.ph}`);
      if (o === van) continue;
      for (const a of [C.A, C.B]) if (a && !a.gone && !a.inside && disc(o, a.x, a.z, .3)) fail('car', `over ${a.role}: ${o.kind} ${o.id} v ${o.v.toFixed(1)} ${C.ph}`);
      if ((C.ph === 'carry' || C.ph === 'load' || C.ph === 'lift') && !C.loaded && C.carryM && disc(o, C.carryM[0], C.carryM[1], .35)) fail('car', `over the bag: ${o.kind} ${o.id} ${C.ph}`); }
    // the crew and the bag: walls, props, parked cars (never inside the van)
    const pts = []; for (const a of [C.A, C.B]) if (a && !a.gone && !a.inside && !(a.clip && /car_get/.test(a.clip))) pts.push([a.x, a.z, a.role]);
    const bagAt = C.restBag ? [C.bagO, C.yaw + Math.PI / 2] : (C.ph === 'lift' || C.ph === 'carry' || C.ph === 'load') && !C.loaded && C.carryM ? [C.carryM, C.carryH] : null;
    if (bagAt) for (const s of [-.6, 0, .6]) pts.push([bagAt[0][0] + Math.sin(bagAt[1]) * s, bagAt[0][1] + Math.cos(bagAt[1]) * s, 'bag']);
    for (const [x, z, who] of pts) { let hit = null;
      for (const y of who === 'bag' ? [.25, .5] : [.35, .95, 1.55]) { for (const [ox, oz] of [[0, 0], [.22, 0], [-.22, 0], [0, .22], [0, -.22]]) { hit = solid(RS, x + ox, y + (PL.kerbOut(x, z) > 0 ? .2 : 0), z + oz); if (hit) break; } if (hit) break; }
      if (hit) fail(hit.startsWith('wall') ? 'wall' : 'prop', `${who} ${hit} ${C.ph} ${x.toFixed(1)},${z.toFixed(1)}`);
      else if (c.parkedIn(x - .2, z - .2, x + .2, z + .2)) fail('parked', `${who} ${C.ph} ${x.toFixed(1)},${z.toFixed(1)}`); }
    // the queue: cars standing on the job's lanes (the van's and the zone's) within 60 m upstream of it, and on the links into them
    if (C.stopped && !C.went) { const Ls = new Map([[C.stop.L, C.stop.s]]); for (const q of C.zone) for (const { L, ua } of q.lanes) Ls.set(L, Math.max(Ls.get(L) ?? -1e9, ua));
      let n = 0; const now = new Set();
      for (const [L, ua] of Ls) { const cand = [...L.cars.filter(o => o.s < ua + 1 && ua - o.s < 60)]; for (const cn of L.feeds || []) { cand.push(...cn.cars); if (cn.inL) cand.push(...cn.inL.cars.filter(o => o.next === cn && cn.inL.len - o.s < 30)); }
        for (const o of cand) { if (o === van || o.gone || o.v > .3) continue; n++; now.add(o); const t = (stand.get(o) || 0) + DT; stand.set(o, t); if (t > row.waitMax) row.waitMax = +t.toFixed(1); const zb = zebraOf(o); if (zb && !zcars.has(o)) { zcars.add(o); row.zebra++; row.zebraKind = zb; } } }
      for (const o of [...stand.keys()]) if (!now.has(o)) stand.delete(o); row.queue = Math.max(row.queue, n); }
    // the crowd: anyone standing with a Cleaner close ahead of it
    for (const w of PS.walkers) { if (w.gone || w.cleaner || w.hide || w.off || !w.p || !w.E || w.E.cross || w.E.len - w.s < 3.5) continue; let near = false;
      for (const [x, z, who] of pts) { if (who === 'bag') continue; const dx = x - w.p[0], dz = z - w.p[2], d = Math.hypot(dx, dz); if (d > 1.9) continue; const h = w.yawS ?? w.p[3]; if (dx * Math.sin(h) + dz * Math.cos(h) > 0) { near = true; break; } }
      if (near && (w.vc || 0) < .05) { const t = (heldT.get(w) || 0) + DT; heldT.set(w, t); row.held = Math.max(row.held, +t.toFixed(1)); } else heldT.delete(w); }
    // the frame time (--frames): from the bag on, FN frames drawn with the cleaning, then FN of the same view without it
    if (FR && !shot && (C.ph === 'ready' || C.ph === 'carry')) { shot = true; const gl = c.renderer.getContext(), px = new Uint8Array(4), one = () => { const t0 = performance.now(); c.tick(DT, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
      c.cover(false); for (let k = 0; k < 10; k++) one(); const w1 = []; for (let k = 0; k < FN; k++) w1.push(one());
      // (the same view without it: the van, the crew and the bag hidden — the job's clock and the zone run on)
      const crew = [C.A, C.B].filter(a => a && !a.gone).map(a => a.w), vis0 = CL.van.root.visible, hide0 = crew.map(w => w.hide), cut = CL.CLEAN.on; CL.van.root.visible = false; for (const w of crew) w.hide = true; const w0 = [];
      for (let k = 0; k < 10; k++) one(); for (let k = 0; k < FN; k++) w0.push(one());
      CL.van.root.visible = vis0; crew.forEach((w, k) => { w.hide = hide0[k]; }); c.cover(true);
      const p95 = a => { const s = a.slice().sort((x, y) => x - y); return +s[Math.floor(s.length * .95)].toFixed(2); }; row.frame = { with: p95(w1), without: p95(w0), inView: inView(bx, .5, bz) }; break; }
  }
  const st = CL.stats(), L = st.last;
  row.ph = ph; row.T = +T.toFixed(1); row.job = L && started ? { kind: L.kind, flip: L.flip, a: L.a, e: L.e, bagged: L.bagged, loaded: L.loaded, vanOut: L.vanOut, guardT: L.guardT, guardWhy: L.guardWhy, guardBy: L.guardBy, driveT: L.driveT, gateT: L.gateT } : null;
  row.heldBad = st.held.slice((st0.held || []).length); row.cabMax = Math.max(0, ...row.heldBad.map(h => h.t)); if (row.cabMax > 3.5) fail('cab', JSON.stringify(row.heldBad));
  for (const [k, n] of [['vanish', st.removedSeen - st0.removedSeen], ['pop', st.spawnSeen - st0.spawnSeen], ['vanPop', st.vanSeen - st0.vanSeen], ['vanGoneSeen', (st.vanSeenGone || 0) - (st0.vanSeenGone || 0)], ['bagGone', (st.bagGone || 0) - (st0.bagGone || 0)]]) if (n > 0) fail(k, String(n));
  const whyD = {}; for (const [k, v] of Object.entries(st.why)) { const d = v - (st0.why[k] || 0); if (d) whyD[k] = d; } row.why = whyD;
  if (!FR) { if (CL.job) { fail('late', CL.job.ph); CL.abort('sweep'); } }
  else if (CL.job) CL.abort('sweep');
  row.done = !!(L && L.bagged && L.loaded && L.vanOut) && started;
  row.clean = row.done && !row.err && !Object.keys(row.fails).length;
  row.wall = +(performance.now() - T0).toFixed(0); return row;
};

let out = [];
async function worker(list) { const S = await open();
try {
  const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' }); if (TOD === 'night') qs.set('tod', 'night');
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.cleaners && window.__record?.draw?.stage?.ctx)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load (or no stage)');
  await sleep(3000); const info = await S.ev(`(${INSTALL.toString()})(${process.argv.includes('--debug')})`); console.log(`page up: ${JSON.stringify(info)}`);
  for (const V of list) { let r; try { r = await S.ev(`(${RUN.toString()})(${JSON.stringify(V)}, ${DT}, ${DONE}, ${FRAMES ? 1 : 0}, ${FN}, ${LINGER})`); } catch (e) { r = { k: V.k, place: V.place, err: 'page: ' + String(e.message).slice(0, 300), fails: {} }; }
    out.push(r); const f = Object.keys(r.fails || {});
    if (VERB || !r.clean) console.log(`#${r.k} (${V.seed}/${V.i}) ${V.place} ${V.cls}: ${r.clean ? 'clean' : 'NOT CLEAN'} ${r.err || ''}${r.err ? ' ' + JSON.stringify(r.why || {}) + ' ' + JSON.stringify(r.noStop || '') : ''} ${r.job ? `${r.job.kind}${r.job.flip ? ' left' : ''} a ${r.job.a} e ${r.job.e}${r.job.guardWhy ? ' guard ' + r.job.guardWhy + JSON.stringify(r.job.guardBy) : ''}` : ''} T ${r.T} · queue ${r.queue} wait ${r.waitMax} zebra ${r.zebra} · held ${r.held} cab ${r.cabMax ?? 0} ${f.length ? 'FAIL ' + JSON.stringify(r.fails) + ' ' + JSON.stringify(r.bad) : ''} · ${(r.ph || []).map(p => p.join('@')).join(' ')}${r.frame ? ' · frame ' + JSON.stringify(r.frame) : ''}${VERB ? ' · why ' + JSON.stringify(r.why) : ''} (${((r.wall || 0) / 1000).toFixed(0)} s)`); }
} catch (e) { console.error('vansweep: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); }
const ONLY = arg('only', null); let RUNS = ONLY ? ROWS.filter(r => ONLY.split(',').includes(String(r.k))) : ROWS;
if (FRAMES && !ONLY) RUNS = Array.from({ length: FRAMES }, (_, k) => ROWS[Math.floor(k * ROWS.length / FRAMES)]);
const lists = Array.from({ length: PAR }, (_, k) => RUNS.filter((_, i) => i % PAR === k)).filter(l => l.length);
await Promise.all(lists.map(l => worker(l)));
out.sort((a, b) => a.k - b.k); fs.mkdirSync(path.dirname(JSONF), { recursive: true }); fs.writeFileSync(JSONF, JSON.stringify(out).replace(/\},\{"k"/g, '},\n{"k"'));
const med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; }, p90 = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length * .9)] : null; };
const cnt = (rs, f) => { const m = {}; for (const r of rs) { const k = f(r); m[k] = (m[k] || 0) + 1; } return m; };
if (FRAMES) { const fr = out.filter(r => r.frame), ratio = fr.map(r => r.frame.with / r.frame.without);
  console.log(`\nvansweep frames ${TOD}: ${fr.length} landings, p95 with a cleaning ${JSON.stringify(fr.map(r => r.frame.with))} ms, without ${JSON.stringify(fr.map(r => r.frame.without))} ms · the ratio median ${med(ratio)?.toFixed(3)} max ${Math.max(...ratio).toFixed(3)} · all p95 with ${med(fr.map(r => r.frame.with))} vs without ${med(fr.map(r => r.frame.without))} (medians)`);
  const pass = fr.length && med(fr.map(r => r.frame.with)) <= 1.05 * med(fr.map(r => r.frame.without)); console.log(`vansweep frames: ${pass ? 'PASS' : 'FAIL'} (the median p95 with ≤ 1.05× without)`); process.exit(pass ? 0 : 1); }
if (LINGER) { for (const r of out) console.log(`#${r.k} ${r.place}: ${JSON.stringify(r.linger || r.err)}`); const n = out.reduce((s, r) => s + (r.linger?.over || 0), 0); console.log(`vansweep linger ${LINGER} s: cars over a body ${n} · ${n || out.some(r => !r.linger) ? 'FAIL' : 'PASS'}`); process.exit(n || out.some(r => !r.linger) ? 1 : 0); }
const clean = out.filter(r => r.clean), fk = {}; for (const r of out) { if (r.err) fk[r.err] = (fk[r.err] || 0) + 1; for (const k of Object.keys(r.fails || {})) fk[k] = (fk[k] || 0) + 1; if (!r.err && !r.done && !Object.keys(r.fails || {}).length) fk.notDone = (fk.notDone || 0) + 1; }
const done = out.filter(r => r.done), heldAll = out.flatMap(r => r.heldBad || []);
console.log(`\nvansweep ${TOD}: ${out.length} landings · CLEAN ${clean.length}/${out.length} (${(100 * clean.length / Math.max(1, out.length)).toFixed(1)}%) · not clean by reason ${JSON.stringify(fk)}`);
console.log(`  clean by place ${JSON.stringify(Object.fromEntries(Object.entries(cnt(out, r => r.place)).map(([k, n]) => [k, `${out.filter(r => r.place === k && r.clean).length}/${n}`])))}`);
console.log(`  stops ${JSON.stringify(cnt(out.filter(r => r.job), r => r.job.kind + (r.job.flip ? ':left' : '')))} · no stop ${out.filter(r => r.err === 'noJob').length}`);
console.log(`  job time (the request to the van gone, done jobs): median ${med(done.map(r => r.T))} s, p90 ${p90(done.map(r => r.T))} s`);
console.log(`  queue behind the job: cars at once median ${med(done.map(r => r.queue))} max ${Math.max(0, ...out.map(r => r.queue || 0))} · the longest a car stood: median ${med(done.map(r => r.waitMax))} s max ${Math.max(0, ...out.map(r => r.waitMax || 0))} s · a car standing in a zebra or a box: ${out.filter(r => r.zebra).length} landings (${JSON.stringify(cnt(out.filter(r => r.zebra), r => r.zebraKind))})`);
console.log(`  cabs, cruisers, patrols, route cars held: ${heldAll.length} (${JSON.stringify(heldAll)}) · over 3.5 s: ${heldAll.filter(h => h.t > 3.5).length}`);
console.log(`  crowd walkers held by a Cleaner: max ${Math.max(0, ...out.map(r => r.held || 0))} s, p90 ${p90(out.map(r => r.held || 0))} s`);
const carF = out.filter(r => r.fails?.car); console.log(`  cars over a body, a Cleaner or the van: ${carF.length} landings${carF.length ? ' ' + JSON.stringify(carF.map(r => [r.k, r.bad.filter(b => b[0] === 'car')[0]?.[2]])) : ''}`);
const pass = clean.length >= .95 * out.length && !carF.length && !heldAll.some(h => h.t > 3.5);
console.log(`vansweep ${TOD}: ${pass ? 'PASS' : 'FAIL'} (clean ≥ 95%, 0 cars over, 0 cabs held over 3.5 s) · rows: ${path.relative(ROOT, JSONF)}`); process.exit(pass ? 0 : 1);
