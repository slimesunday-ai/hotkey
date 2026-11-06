// C2-CLEANERS round 2 (2026-11-05) · BODYLAND: where the street's bodies really land, and what is round each one — the measurement
// the Cleaners' redesign is priced on (docs/redesign/stage-20261105-cleaners.md). No behaviour of the city changes: this only watches.
// In a real page (headless Chrome, the record's playback — ?sim=record, the viewer's own camera, tv=0 — this checkout served on --port:
// node style/serve.mjs <p>), its loop stopped and its drawing covered (api.cover: every frame stepped at --dt by api.tick), for each view
// (a traffic lane in every district, every class of street: one-way, avenue, Route 9, a seeded round-robin):
//   THE HIT     by traffic/accident.js itself, nothing laid: 'jay' arms key X's jaywalker (accidents.arm: it picks its own car and walker
//               in the frame, near lane or far); 'shove' hands the shove hook (pedsim hooks.shove, as movement.js does for an agent held
//               up) every crowd walker whose own road plan (accidents.plan: roadPlan) has a car it can't miss, GORE.often for the view.
//               The car (the one traffic/sim.js made a wreck) and its lane are read off the traffic; the body's rest off accidents.now()
//               once it is 'down'. GORE is off again from the landing on (no second hit in the window); the Cleaners off throughout
//               (CLEAN.on = false: the body lies in view, nothing comes).
//   WHERE       its middle against the road's lanes (traffic/sim.js lanesOf, the lanes of that road at that point): in a travel lane's
//               car path (|offset| < 0.9 m half a car + 0.3 m half a body) — the hit car's own direction or the other, inner or outer;
//               else the parking strip, the one-way's kerbside (no parking there), Route 9's shoulder; a zebra band (hw … hw + 2 from a
//               node) or the box, whatever the lane. rank: the hit lane's place from the walker's kerb (0 the near lane).
//   DOORS       cleaners.js's own planner (cleaners.plan) on the body: 'door' (a door within CLEAN.doorR that the whole job fits), 'walk'
//               (round 1's walk-in fallback), 'none'; the same planner on the FACING side (pedsim laneNear answered, for this one call,
//               with the facing kerb); round the corner: the blocks' doors (ANCHORS) on another side of the body's own block, by the
//               L-path along the walk (not planned: cleaners.js plans one side only).
//   KERB        the free kerb (main.js parkedIn: the blocks' parked cars) in the parking strip or shoulder each side, along the lane's
//               own extent (never a zebra or the box), the body's footprint taken out: the nearest place a 5.5 m vehicle fits with
//               0.5 m each end (6.5 m), as m from the body's middle to that vehicle's middle (vanD: either way; ahead: downstream, the
//               way the carry walks); laneAhead: m of the hit lane left past the body (room to stop in it, double-parked, ahead of it).
//   THE MARKS   cleaners.md §2–§4's marks for this body (A, B, the bag at rest, the lift marks, the carry's first pivot circle) against
//               the travel lanes' car paths: which lanes the job puts someone into.
//   LINGER      GORE.body.linger s from the landing: each car whose body (its rectangle) is ever over the body's footprint, by kind,
//               moving or not (accident.js drops the walker's hazard at the hit: nothing in traffic/sim.js stops for a body).
//   TRAFFIC     the next 60 s: cars past the body's station on every lane of the road, by kind (car · cab: a route car asCar · cruiser:
//               the stage's · patrol · route: a bus or a stage route car), and on the lanes the marks touch: the share of the minute a
//               work zone over them could be granted (every car coming can stop comfortably short of it: front gap > v²/2b + 2 m,
//               b = CAR.b), the first moment it could, and how often a cab, cruiser or patrol is within GORE.wreck.cab s of it.
// Prints the counts and keeps one row per landing (--json, default style/city/tools/runs/bodyland-<seed>.json).
// (live: the cabs, cruisers, patrols and route cars in the whole traffic sim at the hit, wherever they are — the playback's own census)
//   node style/city/tools/bodyland.mjs --port <p> [--views 240] [--seed 11] [--par 3] [--dt .1] [--tod day|night] [--cls oneway,ave,r9]
//        [--gap 25 (m between views)] [--json out.json]
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), VIEWS = +arg('views', 240), SEED = +arg('seed', 11), PAR = +arg('par', 3), DT = +arg('dt', .1), TOD = arg('tod', 'day'), CLS = arg('cls', 'oneway,ave,r9'), GAP = +arg('gap', 25);
if (!PORT) { console.error('bodyland: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), JSONF = arg('json', path.join(ROOT, `style/city/tools/runs/bodyland-${SEED}.json`));
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
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'bodyland-'));
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  const exited = new Promise(r => ch.once('exit', r)), kill = () => { LIVE.delete(kill); return rmProfile(ch, prof, exited); }; LIVE.add(kill);
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
  if (!port) { await kill(); throw new Error('chrome did not start'); }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr, timeout = 600000) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errs, async close() { try { ws.close(); } catch {} await kill(); } };
}

// ── in the page (serialized): the views and the helpers
const INSTALL = async (SEED, CLS, GAP) => {
  const c = window.__city, A = c.traffic.accidents, CL = A.cleaners, TS = c.traffic.sim, PS = c.peds.sim, B = new URL('.', location.href).pathname;
  const [PL, CN, SIMM] = await Promise.all([import(B + 'plan.js'), import(B + 'anim/cast/clips/cleaners.js'), import(B + 'traffic/sim.js')]);
  c.pauseLoop(true); c.cover(true); CL.CLEAN.on = false;
  let s32 = SEED >>> 0; const rnd = () => { s32 = (Math.imul(s32 ^ (s32 >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s32 / 4294967296; };
  const P = PL.P, cls = L => PL.isHwy(L.axis, L.L) ? 'r9' : PL.isAve(L.axis, L.L) ? 'ave' : 'oneway';
  // the views: a lane point in every district × class of street, round-robin, a sidewalk beside it, 25 m apart at least
  function views(n) { const by = new Map(); for (const L of TS.lanes) { if (L.len < 20 || !CLS.split(',').includes(cls(L))) continue; const mx = L.x0 + L.ux * L.len / 2, mz = L.z0 + L.uz * L.len / 2; if (!PS.laneNear(mx, mz, 12)) continue;
      const d = PL.distOf(PL.kindAt(Math.floor(mx / P), Math.floor(mz / P))), k = d + '|' + cls(L); if (!by.has(k)) by.set(k, []); by.get(k).push(L); }
    const ks = [...by.keys()].sort(), out = []; let g = 0;
    while (out.length < n && g++ < n * 40) { const k = ks[g % ks.length], Ls = by.get(k), L = Ls[(rnd() * Ls.length) | 0], ua = 8 + rnd() * (L.len - 16), x = L.x0 + L.ux * ua, z = L.z0 + L.uz * ua;
      if (out.some(v => Math.hypot(v.x - x, v.z - z) < GAP)) continue; out.push({ i: out.length, d: k.split('|')[0], cls: k.split('|')[1], L: L.id, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +Math.atan2(-L.uz, L.ux).toFixed(4), mode: out.length % 2 ? 'shove' : 'jay' }); }
    return out; }
  const kindOf = o => o.stage ? 'cruiser' : o.kind === 'patrol' ? 'patrol' : o.route && o.asCar ? 'cab' : o.route ? 'route' : o.kind === 'car' ? 'car' : String(o.kind);
  const bad = o => !!(o.route || o.stage || o.asCar || o.kind !== 'car');
  // the lanes of the road lane Lh is on, at along-point (x, z): each with its offset in Lh's right-hand frame (r = (−uz, ux))
  function roadLanes(Lh, x, z) { const out = []; for (const l of TS.lanes) { if (l.axis !== Lh.axis || l.L !== Lh.L) continue; const ua = (x - l.x0) * l.ux + (z - l.z0) * l.uz; if (ua < -3 || ua > l.len + 3) continue;
      const same = l.ux * Lh.ux + l.uz * Lh.uz > 0; out.push({ l, ua, o: same ? l.off : -l.off, same }); } return out; }
  // every car coming to ua on lane L (on it, the connectors into it, the lanes before them): the nearest [car, m from its middle]
  function coming(L, ua, fn) { for (const o of L.cars) if (o.s < ua) fn(o, ua - o.s);
    for (const cn of L.feeds) { for (const o of cn.cars) fn(o, cn.len - o.s + ua); for (const o of cn.inL.cars) if (!o.next || o.next === cn) fn(o, cn.inL.len - o.s + cn.len + ua); } }
  const carOver = (o, x, z, yaw, hl, hw) => { // a car's rectangle over the body's (middle x, z, along yaw: half-length hl, half-width hw): separating axes
    const h = o.h + (o.yawOff || 0), cu = [Math.sin(h), Math.cos(h)], cv = [Math.cos(h), -Math.sin(h)], bu = [Math.cos(yaw), -Math.sin(yaw)], bv = [Math.sin(yaw), Math.cos(yaw)], d = [x - o.x, z - o.z];
    const ext = (ax, u, v, a, b) => Math.abs(ax[0] * u[0] + ax[1] * u[1]) * a + Math.abs(ax[0] * v[0] + ax[1] * v[1]) * b;
    for (const ax of [cu, cv, bu, bv]) { const sep = Math.abs(d[0] * ax[0] + d[1] * ax[1]); if (sep > ext(ax, cu, cv, o.len / 2, o.wid / 2) + ext(ax, bu, bv, hl, hw)) return false; } return true; };
  window.__bl = { c, A, CL, TS, PS, PL, CN, SIMM, views, roadLanes, coming, carOver, kindOf, bad, cls };
  return { lanes: TS.lanes.length };
};

// one view, its hit, its body, its measurements (in the page) → a row
const RUN = async (V, DT) => {
  const { c, A, CL, TS, PS, PL, CN, SIMM, roadLanes, coming, carOver, kindOf, bad, cls } = window.__bl, G = A.GORE, row = { ...V }, T0 = performance.now();
  const tick = () => c.tick(DT, 1);
  // the camera onto it (cleanercheck's: 26 m off, from one side, looking down)
  const fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(V.x, .6, V.z); c.camera.position.set(V.x + side[0] * 20 - fx * 12, 15, V.z + side[1] * 20 - fz * 12); c.camera.lookAt(V.x, .6, V.z); c.controls.update?.(); c.camera.lookAt(V.x, .6, V.z);
  for (let k = 0; k < 400; k++) { tick(); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) tick();
  // ── the hit
  G.on = true; const h0 = A.stats().hits, wr0 = new Set(TS.cars.filter(o => o.wreck)), fake = new Map(); let car = null, t = 0;
  if (V.mode === 'jay') A.arm(40); else G.often = true;
  for (; t < 30 && !car; t += DT) {
    if (V.mode === 'shove' && ((t / DT) | 0) % 2 === 0) for (const w of PS.walkers) { if (w.agent || w.gone || w.off || w.gore || !w.E || w.E.cross || w.tier !== 1 || Math.hypot(w.p[0] - V.x, w.p[2] - V.z) > 45) continue;
      const pl = A.plan(w); if (!pl || !pl.hit) continue; let a = fake.get(w); if (!a) fake.set(w, a = { p: [0, 0, 0] }); a.p[0] = w.p[0]; a.p[1] = w.p[1]; a.p[2] = w.p[2]; PS.hooks.shove(w, a, 0, 0, 1); if (w.gore) break; }
    tick(); if (A.stats().hits > h0) car = TS.cars.find(o => o.wreck && !wr0.has(o)) || null; }
  G.often = false; A.arm(0);
  if (!car) { G.on = false; row.err = 'nohit'; row.why = Object.fromEntries(Object.entries(A.stats().why).filter(([k]) => /^j/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 4)); row.wall = +(performance.now() - T0).toFixed(0); return row; }
  const Lh = car.L, vHit = +car.v.toFixed(1); row.live = {}; for (const o of TS.cars) if (!o.gone && bad(o)) { const k = kindOf(o); row.live[k] = (row.live[k] || 0) + 1; } row.tHit = +t.toFixed(1); row.car = { id: car.id, kind: kindOf(car), lane: Lh.id, k: Lh.k, n: Lh.n, off: Lh.off, cls: cls(Lh), hw: Lh.hw, v: vHit };
  // the body: the case the car hit, to its rest
  const near = () => A.now().filter(k => k.hit).sort((a, b) => Math.hypot(a.x - car.x, a.z - car.z) - Math.hypot(b.x - car.x, b.z - car.z))[0];
  let K = near(); for (let k = 0; k < 80 && K && K.ph !== 'down'; k++) { tick(); K = near(); }
  G.on = false; if (!K || K.ph !== 'down') { row.err = 'nobody'; return row; }
  row.by = K.by; const dir = K.dir, x = K.x, z = K.z, yaw = Math.atan2(-Lh.uz, Lh.ux); row.body = { x, z, yaw: +yaw.toFixed(4) };
  // ── where: against the road's lanes (offsets in the hit car's right-hand frame)
  const rL = roadLanes(Lh, x, z), oB = (x - Lh.x0) * -Lh.uz + (z - Lh.z0) * Lh.ux + Lh.off; row.o = +oB.toFixed(2);
  // the walker's kerb: dir is its way out (kerb → road); the hit lane's rank from that kerb
  const along = l => (l.l.x0 * dir[0] + l.l.z0 * dir[1]); const byK = rL.slice().sort((a, b) => along(a) - along(b)); row.rank = byK.findIndex(l => l.l === Lh); row.nLanes = rL.length;
  let inLane = null, clear = 1e9; for (const l of rL) { const d = Math.abs(oB - l.o) - .9 - .3; if (d < clear) clear = d; if (d < 0 && (!inLane || Math.abs(oB - l.o) < Math.abs(oB - inLane.o))) inLane = l; }
  row.clear = +clear.toFixed(2); const hw = Lh.hw, r9 = cls(Lh) === 'r9', one = cls(Lh) === 'oneway';
  row.place = inLane ? `lane:${inLane.same ? 'own' : 'opp'}${r9 ? (Math.abs(inLane.o) < 2 ? ':inner' : ':outer') : ''}` : r9 ? (Math.abs(oB) > 4.3 ? 'shoulder' : 'between') : one ? (oB > 0 ? 'parking' : 'kerbside') : 'parking';
  // the zebra or the box: the body's along extent (±0.9 m) against each end node's band
  { const n0 = Lh.from, n1 = Lh.to, hc = n => Lh.axis === 'x' ? n.hz : n.hx, crossed = n => Lh.axis === 'x' ? (n.arms.W || n.arms.E) : (n.arms.N || n.arms.S);
    let zone = null; for (const n of [n0, n1]) { if (!crossed(n)) continue; const d = Math.abs((x - n.x) * Lh.ux + (z - n.z) * Lh.uz), lo = d - .9, hi = d + .9, hcn = hc(n); if (lo < hcn) zone = 'box'; else if (lo < hcn + 2 && hi > hcn) zone = zone || 'zebra'; }
    row.zone = zone; if (zone) row.place += '+' + zone; }
  // ── the marks (cleaners.md §2–§4, as cleaners.js plan() lays them out) against the car paths
  { const rx = x - Math.cos(yaw) * .9, rz = z + Math.sin(yaw) * .9, toW = (o, lx, lz) => [o[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), o[1] - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    const A0 = toW([rx, rz], -CN.BODY.at[0], -CN.BODY.at[1]), B0 = toW(A0, 0, CN.BODY.gap), bagO = toW(A0, .2, .65), dB = [Math.cos(yaw), -Math.sin(yaw)], Al = [bagO[0] - CN.LIFT.at[2] * dB[0], bagO[1] - CN.LIFT.at[2] * dB[1]], Bl = [Al[0] + CN.CARRY_GAP * dB[0], Al[1] + CN.CARRY_GAP * dB[1]], M0 = [(Al[0] + Bl[0]) / 2, (Al[1] + Bl[1]) / 2];
    const off = p => (p[0] - Lh.x0) * -Lh.uz + (p[1] - Lh.z0) * Lh.ux + Lh.off, hits = (pts) => rL.filter(l => pts.some(([p, r]) => Math.abs(off(p) - l.o) < .9 + r)).map(l => `${l.same ? 'own' : 'opp'}${l.l.n > 1 ? ':' + (Math.abs(l.o) < 2 ? 'inner' : 'outer') : ''}`);
    row.marks = hits([[A0, .3], [B0, .3], [bagO, .5], [Al, .3], [Bl, .3]]); row.pivot = hits([[M0, CN.CARRY_GAP / 2 + .3]]); row.marksO = [A0, B0].map(p => +off(p).toFixed(2));
    row._work = rL.filter(l => [[A0, .3], [B0, .3], [bagO, .5], [Al, .3], [Bl, .3]].some(([p, r]) => Math.abs(off(p) - l.o) < .9 + r)).map(l => l.l.id); }
  // ── the doors: cleaners.js's own planner, the body's side and the facing side; round the corner from the blocks' doors
  const fakeK = { rest: { x, z, rx: x - Math.cos(yaw) * .9, rz: z + Math.sin(yaw) * .9, yaw, gy: 0 } };
  const plan = () => { const w0 = { ...CL.stats().why }, J = CL.plan(fakeK), w1 = CL.stats().why, d = {}; for (const k in w1) if ((w1[k] || 0) > (w0[k] || 0)) d[k] = w1[k] - (w0[k] || 0); return { J, why: d }; };
  const ln0 = PS.laneNear(x, z, 16); row.sideE = ln0 ? `${ln0.E.i},${ln0.E.j},${ln0.E.side}` : null;
  { const { J, why } = plan(); row.door = J ? (J.walk ? 'walk' : 'door') : 'none'; row.doorWhy = why; if (J && !J.walk) { row.doorD = +Math.abs(J.door.u - J.uB).toFixed(1); row.doorId = J.door.id; } }
  // (the facing side: the body's middle mirrored across the road's centre line answers laneNear for the planner's one call)
  { const cx = x - (-Lh.uz) * oB, cz = z - Lh.ux * oB, mx = 2 * cx - x, mz = 2 * cz - z, orig = PS.laneNear;
    PS.laneNear = (qx, qz, r) => (qx === x && qz === z) ? orig(mx, mz, r) : orig(qx, qz, r); let res; try { res = plan(); } finally { PS.laneNear = orig; }
    const lf = orig(mx, mz, 16); row.faceE = lf ? `${lf.E.i},${lf.E.j},${lf.E.side}` : null; row.faceDoor = res.J ? (res.J.walk ? 'walk' : 'door') : 'none'; row.faceWhy = res.why; if (res.J && !res.J.walk) row.faceDoorD = +Math.abs(res.J.door.u - res.J.uB).toFixed(1); }
  // (round the corner: a door on another side of the body's own block, by the L-path from the body's kerb point to it)
  if (ln0) { const E0 = ln0.E; let best = null, nSame = 0;
    for (const a of c.ANCHORS.values()) { const ds = []; for (const l of Object.values(a?.lots || {})) if (l.door && l.face) ds.push(l.door); for (const b of a?.buildings || []) if (b.entrance?.door && b.face) ds.push(b.entrance.door);
      for (const d of ds) { if (Math.abs(d[0] - x) > 60 || Math.abs(d[2] - z) > 60) continue; const e = PS.laneNear(d[0], d[2], 8); if (!e) continue; const m = Math.abs(d[0] - x) + Math.abs(d[2] - z);
        if (e.E === E0 || (e.E.i === E0.i && e.E.j === E0.j && e.E.side === E0.side)) { if (Math.abs(Lh.ux) > .5 ? Math.abs(d[0] - x) < 34 : Math.abs(d[2] - z) < 34) nSame++; continue; }
        if (e.E.i === E0.i && e.E.j === E0.j && (!best || m < best)) best = m; } }
    row.cornerD = best === null ? null : +best.toFixed(1); row.sameDoors = nSame; }
  // ── the free kerb, each side: the parking strip's (or the shoulder's) middle line, every 0.25 m along the lane's extent
  { const pin = c.parkedIn, u = [Lh.ux, Lh.uz], rr = [-Lh.uz, Lh.ux], a0 = (x - Lh.x0) * u[0] + (z - Lh.z0) * u[1], res = {};
    for (const s of [1, -1]) { const has = r9 || !one || s > 0; if (!has) { res[s] = null; continue; } const oc = s * (r9 ? hw - 1.35 : hw - SIMM.KERB_IN), runs = []; let st = null;
      for (let a = 0; a <= Lh.len; a += .25) { const px = Lh.x0 + u[0] * a + rr[0] * (oc - Lh.off), pz = Lh.z0 + u[1] * a + rr[1] * (oc - Lh.off), hx = Math.abs(rr[0]) * .95 + Math.abs(u[0]) * .125, hz = Math.abs(rr[1]) * .95 + Math.abs(u[1]) * .125;
        const onBody = Math.abs(oB - oc) < .95 + .3 && Math.abs(a - a0) < .9 + .4, free = !onBody && !pin(px - hx, pz - hz, px + hx, pz + hz);
        if (free && st === null) st = a; if ((!free || a + .25 > Lh.len) && st !== null) { runs.push([st, free ? a : a - .25]); st = null; } }
      let vanD = null, ahead = null, beside = 0; for (const [p, q] of runs) { if (a0 >= p - .5 && a0 <= q + .5) beside = Math.max(beside, q - p); if (q - p < 6.5) continue; const lo = p + 3.25, hi = q - 3.25, cx = Math.max(lo, Math.min(hi, a0)), d = Math.abs(cx - a0); if (vanD === null || d < vanD) vanD = d;
        // (ahead: downstream of the body, the way the carry walks — cleaners.md §4–§5: the pair faces along the bag's +x, the hit car's way)
        if (hi >= a0) { const da = Math.max(lo, a0) - a0; if (ahead === null || da < ahead) ahead = da; } }
      res[s] = { vanD: vanD === null ? null : +vanD.toFixed(1), ahead: ahead === null ? null : +ahead.toFixed(1), beside: +beside.toFixed(1), bodyIn: Math.abs(oB - oc) < .95 + .3 }; }
    const bs = oB >= 0 ? 1 : -1; row.kerb = { body: res[bs], face: res[-bs] }; row.laneAhead = +(Lh.len - a0).toFixed(1); }
  // ── the linger: cars over the body; then a minute of traffic past it, and the work zone's grant
  const lin = G.body.linger, over = new Map(), pass = { all: {}, lane: {} }, prev = new Map(), work = rL.filter(l => row._work.includes(l.l.id)); delete row._work;
  const inL = new Set(inLane ? [inLane.l] : []); let grantT = 0, firstGrant = null, badT = 0, n = 0, overMoving = 0;
  const ST = { linger: { all: {}, lane: {} }, minute: { all: {}, lane: {} } };
  for (let tt = 0; tt < lin + 60; tt += DT) { tick(); const ph = tt < lin ? 'linger' : 'minute';
    for (const o of TS.cars) { if (o.gone || Math.abs(o.x - x) > 40 || Math.abs(o.z - z) > 40) continue;
      if (Math.abs(o.x - x) < 6 && Math.abs(o.z - z) < 6 && carOver(o, x, z, yaw, .9, .28)) { if (!over.has(o.id)) over.set(o.id, { kind: kindOf(o), t: +tt.toFixed(1), v: +o.v.toFixed(1), wreck: !!o.wreck, hit: o === car }); if (o.v > .3) overMoving++; }
      const L = o.L; if (L?.kind !== 'lane' || !rL.some(l => l.l === L)) { prev.delete(o); continue; } const s = (x - L.x0) * L.ux + (z - L.z0) * L.uz - o.s, p = prev.get(o); prev.set(o, s);
      if (p !== undefined && p > 0 && s <= 0) { const k = kindOf(o); ST[ph].all[k] = (ST[ph].all[k] || 0) + 1; if (inL.has(L) || work.some(l => l.l === L)) ST[ph].lane[k] = (ST[ph].lane[k] || 0) + 1; } }
    if (ph === 'minute' && work.length) { n++; let ok = true, b = false;
      for (const l of work) { const ua = l.ua - 3; coming(l.l, Math.max(0, ua), (o, d) => { if (o.gone) return; const v = Math.max(0, o.v), gap = d - o.len / 2; if (gap < v * v / (2 * SIMM.CAR.b) + 2 || (v < .3 && gap < 2)) ok = false; if (bad(o) && gap / Math.max(v, 1) < G.wreck.cab) b = true; }); }
      if (ok) { grantT += DT; if (firstGrant === null) firstGrant = +(tt - lin).toFixed(1); } if (b) badT += DT; } }
  row.over = [...over.values()]; row.overMoving = +(overMoving * DT).toFixed(1); row.traffic = ST; row.work = work.map(l => `${l.same ? 'own' : 'opp'}${l.l.n > 1 ? ':' + (Math.abs(l.o) < 2 ? 'inner' : 'outer') : ''}`);
  if (work.length) { row.grant = +(grantT / (n * DT)).toFixed(2); row.firstGrant = firstGrant; row.badShare = +(badT / (n * DT)).toFixed(2); }
  row.wall = +(performance.now() - T0).toFixed(0); return row;
};

let out = [];
async function worker(list) { const S = await open();
try {
  const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' }); if (TOD === 'night') qs.set('tod', 'night');
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents?.cleaners)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load');
  await sleep(3000); const info = await S.ev(`(${INSTALL.toString()})(${SEED}, ${JSON.stringify(CLS)}, ${GAP})`);
  if (!list) { const v = await S.ev(`__bl.views(${VIEWS})`); console.log(`page up: ${info.lanes} lanes, ${v.length} views`); await S.close(); return v; }
  for (const V of list) { let r; try { r = await S.ev(`(${RUN.toString()})(${JSON.stringify(V)}, ${DT})`); } catch (e) { r = { ...V, err: 'page: ' + String(e.message).slice(0, 200) }; }
    out.push(r); console.log(`#${V.i} ${V.d} ${V.cls} ${V.mode}: ${r.err ? r.err + ' ' + JSON.stringify(r.why || '') : `${r.car.cls} rank ${r.rank}/${r.nLanes} ${r.place} o ${r.o} · door ${r.door}${r.doorD !== undefined ? ' ' + r.doorD : ''} face ${r.faceDoor} corner ${r.cornerD} · van ${r.kerb.body?.vanD ?? '-'}/${r.kerb.face?.vanD ?? '-'} · over ${r.over.length} · grant ${r.grant ?? '-'}`} (${(r.wall / 1000).toFixed(0)} s)`); }
} catch (e) { console.error('bodyland: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); }
const v0 = await worker(null) || []; const lists = Array.from({ length: PAR }, (_, k) => v0.filter((_, i) => i % PAR === k));
await Promise.all(lists.map(l => worker(l)));
out.sort((a, b) => a.i - b.i); fs.mkdirSync(path.dirname(JSONF), { recursive: true }); fs.writeFileSync(JSONF, JSON.stringify(out, null, 0).replace(/\},\{"i"/g, '},\n{"i"'));
// ── the counts
const L = out.filter(r => !r.err), cnt = (rs, f) => { const m = {}; for (const r of rs) { const k = f(r); m[k] = (m[k] || 0) + 1; } return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1])); };
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '-', med = a => { const s = a.filter(v => v !== null && v !== undefined).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; }, p90 = a => { const s = a.filter(v => v !== null && v !== undefined).sort((p, q) => p - q); return s.length ? s[Math.floor(s.length * .9)] : null; };
const caseOf = r => r.by === 'agent' ? 'shove' : `X:${r.rank === 0 ? 'near' : 'far'}`, caseR9 = r => r.car.cls === 'r9' ? `${caseOf(r)}:r9-${Math.abs(r.car.off) < 2 ? 'inner' : 'outer'}` : `${caseOf(r)}:${r.car.cls}`;
console.log(`\nbodyland ${TOD} seed ${SEED}: ${out.length} views, ${L.length} bodies (${cnt(out.filter(r => r.err), r => r.err + ':' + r.mode) ? JSON.stringify(cnt(out.filter(r => r.err), r => r.err + ':' + r.mode)) : ''} no body)`);
console.log(`  by case ${JSON.stringify(cnt(L, caseR9))}`);
console.log(`  by district ${JSON.stringify(cnt(L, r => r.d))}`);
console.log(`  where ${JSON.stringify(cnt(L, r => r.place))}`);
console.log(`  where × case ${JSON.stringify(cnt(L, r => caseOf(r) + ' ' + r.car.cls + ' → ' + r.place))}`);
console.log(`  in a travel lane ${L.filter(r => r.place.startsWith('lane')).length}/${L.length} · the marks put someone in a travel lane ${L.filter(r => r.marks.length).length}/${L.length} · the carry's pivot ${L.filter(r => r.pivot.length).length}/${L.length}`);
console.log(`  door (body's side, the whole job fits) ${L.filter(r => r.door === 'door').length}/${L.length} · walk ${L.filter(r => r.door === 'walk').length} · none ${L.filter(r => r.door === 'none').length} · a door on the side at all (≤ 34 m) ${L.filter(r => r.sameDoors > 0).length}`);
console.log(`  facing side door fits ${L.filter(r => r.faceDoor === 'door').length}/${L.length} · either side ${L.filter(r => r.door === 'door' || r.faceDoor === 'door').length} · round the corner ≤ 34 m (L-path, unplanned) ${L.filter(r => r.cornerD !== null && r.cornerD <= 34).length} · any of the three ${L.filter(r => r.door === 'door' || r.faceDoor === 'door' || (r.cornerD !== null && r.cornerD <= 34)).length}`);
const vb = L.map(r => r.kerb.body?.vanD ?? null), vf = L.map(r => r.kerb.face?.vanD ?? null), vAny = L.map(r => { const a = [r.kerb.body?.vanD, r.kerb.face?.vanD].filter(v => v !== null && v !== undefined); return a.length ? Math.min(...a) : null; });
const va = L.map(r => r.kerb.body?.ahead ?? null), la = L.map(r => r.laneAhead);
console.log(`  the gap downstream (the carry's way) on the body's side: median ${med(va)} m p90 ${p90(va)} m (no strip or none ${va.filter(v => v === null).length}) · lane left past the body median ${med(la)} m, < 8 m ${la.filter(v => v < 8).length}`);
console.log(`  a 6.5 m kerb gap (5.5 m vehicle): body's side median ${med(vb)} m p90 ${p90(vb)} m (none ${vb.filter(v => v === null).length}) · facing median ${med(vf)} m (none ${vf.filter(v => v === null).length}) · within 0 m (beside) ${vb.filter(v => v === 0).length}, ≤ 6 m ${vb.filter(v => v !== null && v <= 6).length}, ≤ 15 m ${vb.filter(v => v !== null && v <= 15).length}, ≤ 15 m either side ${vAny.filter(v => v !== null && v <= 15).length} of ${L.length}`);
const lanes = L.filter(r => r.place.startsWith('lane'));
console.log(`  driven over during the linger: ${L.filter(r => r.over.some(o => !o.hit)).length}/${L.length} bodies (in a lane: ${lanes.filter(r => r.over.some(o => !o.hit)).length}/${lanes.length}); cars over a body ${L.reduce((s, r) => s + r.over.filter(o => !o.hit).length, 0)} (moving s ${L.reduce((s, r) => s + r.overMoving, 0).toFixed(1)}), by kind ${JSON.stringify(cnt(L.flatMap(r => r.over.filter(o => !o.hit)), o => o.kind))}`);
const kinds = ['car', 'cab', 'cruiser', 'patrol', 'route'], per = (k, w) => L.map(r => r.traffic.minute[w][k] || 0);
console.log(`  past it the minute after the linger (the road, every lane): ${kinds.map(k => `${k} median ${med(per(k, 'all'))} p90 ${p90(per(k, 'all'))} max ${Math.max(0, ...per(k, 'all'))}`).join(' · ')}`);
console.log(`    with a cab, cruiser or patrol at all: ${L.filter(r => ['cab', 'cruiser', 'patrol'].some(k => r.traffic.minute.all[k])).length}/${L.length}; on the lanes the marks touch: ${kinds.map(k => `${k} median ${med(per(k, 'lane'))} max ${Math.max(0, ...per(k, 'lane'))}`).join(' · ')}`);
const wz = L.filter(r => r.grant !== undefined);
console.log(`  a work zone over the lanes the marks touch (${wz.length} bodies): grantable share of the minute median ${med(wz.map(r => r.grant))} p10 ${(() => { const s = wz.map(r => r.grant).sort((a, b) => a - b); return s[Math.floor(s.length * .1)]; })()} · first grant median ${med(wz.map(r => r.firstGrant))} s p90 ${p90(wz.map(r => r.firstGrant))} s (never ${wz.filter(r => r.firstGrant === null).length}) · a cab/cruiser/patrol within ${3.5} s: share median ${med(wz.map(r => r.badShare))} max ${Math.max(0, ...wz.map(r => r.badShare))}`);
console.log(`  the whole traffic at each hit (anywhere): ${kinds.filter(k => k !== 'car').map(k => `${k} median ${med(L.map(r => r.live?.[k] || 0))} max ${Math.max(0, ...L.map(r => r.live?.[k] || 0))}`).join(' · ')}`);
console.log(`  rows: ${path.relative(ROOT, JSONF)}`);
