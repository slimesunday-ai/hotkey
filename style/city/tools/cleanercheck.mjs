// C2-CLEANERS (2026-11-05) · CLEANERCHECK: the Cleaners (traffic/cleaners.js) swept round the whole city. In a real page (headless
// Chrome, this checkout served on --port: node style/serve.mjs <p>), its loop stopped and its drawing covered (api.cover: the city runs on
// undrawn, every frame stepped at --dt by api.tick), for each spot: the camera onto it, the blocks there streamed in, a body laid there
// (traffic/accident.js lay: a crowd walker, its linger run), then the cleaning run frame by frame to its end. The spots: every district,
// every kind of place a body can lie — in a travel lane, at the kerb, by a corner, at a junction's zebra — near and far from doors,
// drawn from the traffic's own lanes (a seeded pick). A tenth of the ordinary cars are marked as cabs (asCar) for the run, so the cab
// rule is tried everywhere; --pace k runs the cars k× the page clock (the playback at 10× and 60×: the accidents' and the Cleaners'
// clock is the page's, the cars' the tape's).
// Each frame, measured against what the city is built of — not against the Cleaners' own plan:
//   wall · prop   a Cleaner's body (a disc of 0.22 m at 0.35, 0.95 and 1.55 m up) or the bag's inside a structure or a prop of the blocks
//                 there, rebuilt with the audit on (jobs.js jobBlock, audit.js REG: structures as boxes, props voxel by voxel; bags are
//                 soft) — but the door the job goes in by (its way through the wall)
//   car           a car's body (its rectangle) over a Cleaner (0.45 m: the head) or the bag
//   cab           a cab-marked car stopped behind the Cleaners (one of their hazards ahead in its lane, within 15 m) for over 3.5 s
//   bag           while the pair carries it: their gap off CARRY_GAP by over 1 cm, their headings apart, their gaits out of step (g.u
//                 apart by over 0.005 of a cycle), either off the near tier while in view, or the bag not drawn while the lead is
//   vanish · pop  a Cleaner removed or put on the street where the camera sees it (and not inside a building), the bag gone from the
//                 frame while its job still holds it, the body back on the crowd where the camera sees it
//   limit         a state over its time (cleaners.js CLEAN.lim; the walk in's own, by its length) · late: the cleaning not over within
//                 --done s · route: a body in view that no cleaning took (no door, no way in along the walk) · gaveUp: a cleaning that
//                 ended before the bag (its way out: the body is accident.js's again)
//   held          (reported) the longest a crowd walker or an agent stood still with a Cleaner in its way (within 1.6 m ahead)
// Prints the counts (by district and kind of place), each failing spot, and keeps a contact sheet of a sample (--sheet n: frames of n
// spots drawn mid-job, style/city/shots/c2-cleaners/sweep-*.jpg). Exit 1 on any failure.
//   node style/city/tools/cleanercheck.mjs --port <p> [--spots 240] [--seed 7] [--dt .1] [--pace 1] [--tod day|night] [--done 150]
//        [--sheet 12] [--only <i>] [--at x,z,yaw] [--json out.json]
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), SPOTS = +arg('spots', 240), SEED = +arg('seed', 7), DT = +arg('dt', .1), PACE = +arg('pace', 1), TOD = arg('tod', 'day'), DONE = +arg('done', 240), SHEET = +arg('sheet', 12), ONLY = arg('only', null), AT = arg('at', null), JSONF = arg('json', null), VERB = process.argv.includes('--verbose');
if (!PORT) { console.error('cleanercheck: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), SHOTS = path.join(ROOT, 'style/city/shots/c2-cleaners');
const W = 960, H = 600;
// the Chrome profile, removed only once Chrome has exited (jaycheck.mjs's way)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanercheck-'));
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
// one spot, run to its end (in the page): → its record
const RUN = async (sp, DT, DONE, sheet) => {
  const { c, A, CL, TS, PS, PL, rec, solid, inView, mark, carHit, CN } = window.__cc, THREE = c.THREE, G = { start: performance.now() };
  // the camera onto it: 26 m off, from the kerb side of the road, looking down at 30°
  const yaw = sp.yaw, fx = Math.cos(yaw), fz = -Math.sin(yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(sp.x, .6, sp.z); c.camera.position.set(sp.x + side[0] * 20 - fx * 12, 15, sp.z + side[1] * 20 - fz * 12); c.camera.lookAt(sp.x, .6, sp.z); c.controls.update?.(); c.camera.lookAt(sp.x, .6, sp.z);
  for (let k = 0; k < 400; k++) { c.tick(DT, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) c.tick(DT, 1); mark();
  const st0 = CL.stats(), K = A.lay(sp.x, sp.z, sp.yaw); if (!K) return { ...sp, err: 'lay' };
  const R = { ...sp, fails: {}, n: 0, T: 0, held: 0, heldA: 0, ph: [], door: null, kinds: {}, bad: [] }, fail = (k, d) => { R.fails[k] = (R.fails[k] || 0) + 1; if (R.fails[k] <= 2 && R.bad.length < 8) R.bad.push([k, +R.T.toFixed(1), d]); };
  const BL = PL.P, i0 = Math.floor(sp.x / BL), j0 = Math.floor(sp.z / BL), RS = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) RS.push(rec(i0 + a, j0 + b));
  let started = false, last = null, bagWas = false, heldT = new Map(), cabT = new Map(), was = new Set(), shot = null;
  const lim = CL.CLEAN.lim;
  for (let f = 0; f < DONE / DT + 400; f++) { c.tick(DT, 1); R.T += DT; mark(); const C = CL.job;
    if (!started) { if (C && C.K === K) { started = true; R.door = C.door.end ? 'end' : 'door'; } else if (R.T > 3) { fail('route', JSON.stringify(CL.stats().why)); break; } else continue; }
    if (!C) { // the job over: the body back on the crowd somewhere unseen (a job given up: the body never bagged — a failure here)
      if (!K.bagged) { fail('gaveUp', JSON.stringify(CL.stats().last?.log || [])); break; }
      if (K.w.gone || !K.w.hide) break; if (R.T > DONE + 60) { fail('late', 'body hidden at ' + R.T.toFixed(0)); break; } continue; }
    if (C.K !== K && C.K) { fail('other', 'another job'); break; }
    R.n++; if (C.ph !== last) { R.ph.push([C.ph, +R.T.toFixed(1)]); last = C.ph; }
    if (R.T > DONE) { fail('late', C.ph); break; }
    if (C.t > (C.limNow ?? lim[C.ph] ?? lim.all) + 1 && !R.limHit) { R.limHit = true; fail('limit', C.ph + ' ' + C.t.toFixed(1)); }
    // the Cleaners and the bag: walls, props, cars
    // (a Cleaner walking the crowd's lanes as one of the crowd — pedsim's own walk — is checked as the crowd is: not here)
    const pts = []; for (const a of [C.A, C.B]) if (a && !a.gone && !a.lane) pts.push([a.x, a.z, a.role, .45]);
    const bagAt = C.restBag ? [C.bagO, C.yaw + Math.PI / 2] : (C.ph === 'lift' || C.ph === 'carry' || C.ph === 'train' || C.ph === 'inside') && C.carryM ? [C.carryM, C.carryH] : null;
    if (bagAt) for (const s of [-.6, 0, .6]) pts.push([bagAt[0][0] + Math.sin(bagAt[1]) * s, bagAt[0][1] + Math.cos(bagAt[1]) * s, 'bag', .35]);
    const door = C.door.end ? null : C.door, G2 = C.G;
    for (const [x, z, who, r] of pts) {
      const [u, cc] = G2.uc(x, z), inDoor = door && Math.abs(u - door.u) < .75 && cc > door.c - .35;
      if (!inDoor) for (const y of who === 'bag' ? [.25, .5] : [.35, .95, 1.55]) { let hit = null; for (const [ox, oz] of [[0, 0], [.22, 0], [-.22, 0], [0, .22], [0, -.22]]) { hit = solid(RS, x + ox, y + (PL.kerbOut(x, z) > 0 ? .2 : 0), z + oz); if (hit) break; }
        if (hit) { fail(hit.startsWith('wall') ? 'wall' : 'prop', `${who} ${hit} ${C.ph} ${x.toFixed(1)},${z.toFixed(1)}`); break; } }
      for (const o of TS.cars) if (!o.gone && Math.abs(o.x - x) < 6 && Math.abs(o.z - z) < 6 && carHit(o, x, z, r)) { fail('car', `${who} car ${o.id} v ${o.v.toFixed(1)} ${C.ph}`); break; }
    }
    // the cab rule: a cab-marked car stopped behind a Cleaners' hazard
    const hs = TS.hazards.filter(h => h.cleaner); for (const o of TS.cars) { if (!o.asCar || o.v > .3 || o.L?.kind !== 'lane') { cabT.delete(o); continue; } const L = o.L;
      if (!hs.some(h => { const dx = h.x - L.x0, dz = h.z - L.z0, al = dx * L.ux + dz * L.uz, lat = Math.abs(dx * -L.uz + dz * L.ux); return lat < o.wid / 2 + h.r && al > o.s && al - o.s < 15; })) { cabT.delete(o); continue; }
      const t = (cabT.get(o) || 0) + DT; cabT.set(o, t); if (t > 3.5 && t - DT <= 3.5) fail('cab', `car ${o.id} held ${t.toFixed(1)} s ${C.ph}`); R.cabMax = Math.max(R.cabMax || 0, +t.toFixed(1)); }
    // the carry: the pair on the bag's line, in step, on the near tier while in view, the bag drawn
    if ((C.ph === 'carry' || C.ph === 'lift' || C.ph === 'train') && C.A && C.B && !C.A.gone && !C.B.gone) { const a = C.A, b = C.B, gap = Math.hypot(b.x - a.x, b.z - a.z);
      if (Math.abs(gap - CN.CARRY_GAP) > .01) fail('bag', 'gap ' + gap.toFixed(3)); if (Math.abs(Math.atan2(Math.sin(a.w.yawS - b.w.yawS), Math.cos(a.w.yawS - b.w.yawS))) > .01) fail('bag', 'yaw');
      const vis = inView(a.x, 1, a.z, 1) || inView(b.x, 1, b.z, 1);
      if (vis && (a.w.tier !== 1 || b.w.tier !== 1)) fail('bag', `tier ${a.w.tier}/${b.w.tier}`);
      if (vis && a.w.g && b.w.g && a.w.tier === 1 && b.w.tier === 1) { const du = Math.abs(((a.w.g.u - b.w.g.u) % 1 + 1.5) % 1 - .5); if (du > .005) fail('bag', 'step ' + du.toFixed(3)); }
    }
    // the crowd: anyone standing with a Cleaner close ahead of it
    for (const w of PS.walkers) { if (w.gone || w.cleaner || w.hide || w.off || !w.p || !w.E || w.E.cross || w.E.len - w.s < 3.5) continue; let near = false;
      for (const [x, z, who] of pts) { if (who === 'bag' && false) continue; const dx = x - w.p[0], dz = z - w.p[2], d = Math.hypot(dx, dz); if (d > 1.9) continue; const h = w.yawS ?? w.p[3]; if (dx * Math.sin(h) + dz * Math.cos(h) > 0) { near = true; break; } }
      if (near && (w.vc || 0) < .05) { const t = (heldT.get(w) || 0) + DT; heldT.set(w, t); if (w.agent) R.heldA = Math.max(R.heldA, +t.toFixed(1)); else R.held = Math.max(R.held, +t.toFixed(1)); } else heldT.delete(w); }
    // a contact sheet frame, mid-job
    if (sheet && !shot && (C.ph === 'carry' && C.t > 2 || C.ph === 'mop' && C.t > 1)) { shot = C.ph; c.cover(false); c.tick(DT, 1); R.T += DT; R.frame = c.renderer.domElement.toDataURL('image/jpeg', .8); c.cover(true); }
  }
  const st = CL.stats(); R.removedSeen = st.removedSeen - st0.removedSeen; R.spawnSeen = (st.spawnSeen || 0) - (st0.spawnSeen || 0); R.bagSeenGone = (st.bagGone || 0) - (st0.bagGone || 0);
  if (R.removedSeen > 0) fail('vanish', 'removed in view ' + R.removedSeen); if (R.spawnSeen > 0) fail('pop', 'out in view ' + R.spawnSeen); if (R.bagSeenGone > 0) fail('vanish', 'bag gone in view');
  R.why = st.why; R.wall = performance.now() - G.start; return R;
};

let out = []; const PAR = +arg('par', 1);
async function worker(list) { const S = await open();
try {
  const url = `http://127.0.0.1:${PORT}/style/city/index.html${TOD === 'night' ? '?tod=night' : ''}`;
  await S.send('Page.navigate', { url }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 180000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.cleaners)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load');
  await sleep(3000); const info = await S.ev(`(${INSTALL.toString()})(${SEED}, ${PACE}, ${DONE})`); console.log(`page up: ${info.lanes} lanes`);
  // the look baked before the first job (accident.js prepares it on the first body)
  await S.ev(`__cc.CL.prepare()`);
  if (!list) { list = AT ? [{ i: 0, d: 'at', kind: 'at', x: +AT.split(',')[0], z: +AT.split(',')[1], yaw: +(AT.split(',')[2] || 0) }] : await S.ev(`__cc.spots(${SPOTS})`); if (ONLY !== null) list = list.filter(s => String(s.i) === ONLY); await S.close(); return list; }
  const every = Math.max(1, Math.floor(SPOTS / Math.max(1, SHEET)));
  for (const sp of list) { const r = await S.ev(`(${RUN.toString()})(${JSON.stringify(sp)}, ${DT}, ${DONE}, ${SHEET > 0 && sp.i % every === 0})`); out.push(r);
    const f = Object.keys(r.fails || {}); if (VERB || f.length) console.log(`#${sp.i} ${sp.d} ${sp.kind} [${sp.x}, ${sp.z}] ${r.err || ''} ${r.door ?? '-'} T ${r.T?.toFixed(1)} s held ${r.held ?? '-'}/${r.heldA ?? '-'} cab ${r.cabMax ?? 0} ${f.length ? 'FAIL ' + JSON.stringify(r.fails) + ' ' + JSON.stringify(r.bad) : 'ok'} · ${(r.ph || []).map(p => p.join('@')).join(' ')}${VERB ? ' · why ' + JSON.stringify(r.why) : ''}`); }
} catch (e) { console.error('cleanercheck: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); }
// the spots (one page), then the runs (--par pages, the spots dealt round them)
const spots0 = await worker(null) || []; const lists = Array.from({ length: PAR }, (_, k) => spots0.filter((_, i) => i % PAR === k));
await Promise.all(lists.map(l => worker(l)));
out.sort((a, b) => a.i - b.i);
// the counts
const all = out.filter(r => !r.err), failed = all.filter(r => Object.keys(r.fails).length), by = (k) => { const m = {}; for (const r of all) { const q = m[r[k]] ??= { n: 0, fail: 0 }; q.n++; if (Object.keys(r.fails).length) q.fail++; } return m; };
const fk = {}; for (const r of all) for (const [k, v] of Object.entries(r.fails)) fk[k] = (fk[k] || 0) + 1;
const Ts = all.filter(r => r.door).map(r => r.T).sort((a, b) => a - b), held = all.map(r => r.held || 0).sort((a, b) => a - b), heldA = all.map(r => r.heldA || 0).sort((a, b) => a - b);
console.log(`cleanercheck ${TOD} pace ${PACE}×: ${all.length} spots (${out.length - all.length} could not be laid) · ${all.filter(r => r.door === 'door').length} by a door, ${all.filter(r => r.door === 'end').length} from the kerb's end · failing ${failed.length}: ${JSON.stringify(fk)}`);
console.log(`  by district ${JSON.stringify(by('d'))}`); console.log(`  by place ${JSON.stringify(by('kind'))}`);
console.log(`  a job's time median ${Ts[Ts.length >> 1] ?? '-'} s, max ${Ts.at(-1) ?? '-'} s (limit ${DONE} s) · the longest cab hold ${Math.max(0, ...all.map(r => r.cabMax || 0))} s · a crowd walker held by a Cleaner: max ${held.at(-1) ?? 0} s (p90 ${held[Math.floor(held.length * .9)] ?? 0}) · an agent: max ${heldA.at(-1) ?? 0} s`);
// the contact sheet
const shots = all.filter(r => r.frame); if (shots.length) { fs.mkdirSync(SHOTS, { recursive: true }); for (const r of shots) fs.writeFileSync(path.join(SHOTS, `sweep-${TOD}-${String(r.i).padStart(3, '0')}.jpg`), Buffer.from(r.frame.split(',')[1], 'base64')); console.log(`  contact sheet: ${shots.length} frames in ${path.relative(ROOT, SHOTS)}/sweep-${TOD}-*.jpg`); }
if (JSONF) fs.writeFileSync(JSONF, JSON.stringify(out.map(({ frame, ...r }) => r), null, 1));
const pass = all.length > 0 && failed.length === 0;
console.log(`cleanercheck: ${pass ? 'PASS' : 'FAIL'}`); process.exit(pass ? 0 : 1);
