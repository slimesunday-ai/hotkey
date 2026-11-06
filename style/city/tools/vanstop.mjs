// C2-CLEANERS round 2 (2026-11-05) · VANSTOP: the deciding test of docs/redesign/stage-20261105-cleaners.md §5 (D-van). No art, no crew,
// no behaviour of the city changed: the arrest's stage car (stage/cruiser.js planStop + driveCar, used as they are; the cruiser is
// 4.4 × 1.8 m, the fleet's Qwik Kargo van's size) is driven, as a stand-in for the Cleaners' van, to real body landings —
// bodyland.mjs's rows (style/city/tools/runs/bodyland-{11,12}.json): 40 kerbside, 15 parking strip, 5 Route 9 shoulder, spread over
// the rows in order. In a real page (headless Chrome, the record's playback 404-A, tv=0, this checkout served on --port), its loop stopped
// and its drawing covered (api.tick at --dt), for each row: the camera onto the body (bodyland's), a body laid there (accidents.lay;
// the Cleaners off: CLEAN.on = false), a tenth of the ordinary cars marked as cabs (asCar; cleanercheck.mjs's marking, every frame),
// then:
//   THE STOP     planStop(stage ctx, the body's middle) → at the kerb or double-parked, which lane, where along it.
//   THE START    (a stop that holds its lane: double-parked, or at a kerb too near to leave the lane) the van commits — driveCar
//                spawns it — only when no cab-marked car, cruiser, patrol or route car is coming to the stop as far as the city knows:
//                on its lane short of the stop, on a connector into it, on a lane into one of those with that connector chosen (c.next)
//                within --look m by the way (capped at the stay at the lane's speed), or any route car whose remaining route takes it
//                onto the stop's lane. Beyond that no car has chosen yet: the holds below measure what the rule can't see.
//                --rule any: every such car on the lanes into those connectors whatever it has chosen, and on the lanes and
//                connectors one junction further back (the wait's price for seeing further).
//                wait: s from the request to the commit (never: --cap s).
//   THE DRIVE    driveCar from out of view upstream to the stop (step() every frame, park() once stopped): drive s to stopped.
//   THE STAY     --job s stopped (the estimate of the job at a van: note §4), then go() until it is back in its lane, then on until it is
//                gone or 40 s, dropped. Every frame of the stay and the leaving:
//     overlaps   a traffic car's body over the van's (overlapOf < 0, 5 cm in each, as carsThrough) · over the body: the van's over the
//                body's footprint (1.8 × 0.56 m; planStop's maps carry the body at 0.5 m, 0.4 m round it, below)
//     cab hold   a cab-marked car, cruiser, patrol or route car standing (v < 0.3) as the next car behind the van on its lane (the van
//                in the lane's list: stopped there, or pulling in or out), its nose within 15 m: the longest such hold (GORE.wreck.cab,
//                3.5 s, is the rule)
//     queue      the cars standing behind the van on its lane, nose to tail (gaps < 10 m): the longest; reroutes (while the van is in
//                its lane's list): a car on a lane into the van's whose next connector led onto it and then changes to another (traffic/sim.js's full-exit rule)
//   WHERE IT STANDS  its body (stopped pose ± 2.2 m along) against the zebra bands (hw … hw + 2 from a node) and the boxes (< hw) of its
//                road; upstream of the body, beside it, or past it (by the stop lane's direction); m from the body's middle to its rear.
//   THE ZONE     the lanes the marks touch (bodyland's labels, recomputed as its lanes) that the van does not shield — shielded: the
//                van standing in that lane (in its list: the cars behind it stop), its rear 1.9 m or more upstream of the body's middle
//                (the carry's pivot circle, 1.575 m + 0.3) — need a zone piece: granted when every car coming to it can stop
//                comfortably short (front gap > v²/2b + 2 m, bodyland's rule); within 10 s of the van's stop, or not.
// Prints each row and the criteria (note §5 plus the orchestrator's: 0 cab holds over 3.5 s, 0 stops in a zebra or box); keeps the rows.
//   node style/city/tools/vanstop.mjs --port <p> [--par 3] [--dt .1] [--job 45] [--cap 180] [--look 400] [--rule chosen|any] [--json out.json] [--only k,k…]
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), PAR = +arg('par', 3), DT = +arg('dt', .1), JOB = +arg('job', 45), CAP = +arg('cap', 180), LOOK = +arg('look', 400), RULE = arg('rule', 'chosen');
if (!PORT) { console.error('vanstop: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), JSONF = arg('json', path.join(ROOT, `style/city/tools/runs/vanstop-${arg('rule', 'chosen')}.json`));
const W = 960, H = 600;
// ── the rows: 40 kerbside, 15 parking, 5 shoulder, evenly through bodyland's rows (both seeds, in order)
const ALL = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err).map(r => ({ ...r, seed: +s })));
const pick = (place, n) => { const rs = ALL.filter(r => r.place === place); return Array.from({ length: Math.min(n, rs.length) }, (_, k) => rs[Math.floor(k * rs.length / n)]); };
const ROWS = [...pick('kerbside', 40), ...pick('parking', 15), ...pick('shoulder', 5)].map((r, k) => ({ k, seed: r.seed, i: r.i, d: r.d, place: r.place, cls: r.car.cls, lane: r.car.lane, body: r.body, marks: r.marks, pivot: r.pivot }));
// the Chrome profile, removed only once Chrome has exited (jaycheck.mjs's way)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'vanstop-'));
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

const INSTALL = async () => {
  const c = window.__city, A = c.traffic.accidents, TS = c.traffic.sim, B = new URL('.', location.href).pathname;
  const [CR, PR, SIMM] = await Promise.all([import(B + 'stage/cruiser.js'), import(B + 'stage/props.js'), import(B + 'traffic/sim.js')]);
  c.pauseLoop(true); c.cover(true); A.cleaners.CLEAN.on = false; A.GORE.on = false;
  const mark = () => { for (const o of TS.cars) if (o.kind === 'car' && !o.route && !o.stage && o.id % 10 === 0) o.asCar = true; };
  window.__vs = { c, A, TS, CR, HALF: PR.CRUISER.half, HW: PR.CRUISER.hw, SIMM, mark };
  return { lanes: TS.lanes.length, stage: !!window.__record?.draw?.stage?.ctx, half: PR.CRUISER.half, hw: PR.CRUISER.hw };
};

const RUN = async (V, DT, JOB, CAP, LOOK, RULE) => {
  const { c, A, TS, CR, HALF, HW, SIMM, mark } = window.__vs, C = window.__record.draw.stage.ctx, row = { k: V.k, seed: V.seed, i: V.i, place: V.place, cls: V.cls }, T0 = performance.now();
  const tick = () => { mark(); c.tick(DT, 1); }, bx = V.body.x, bz = V.body.z, yaw = V.body.yaw;
  const bad = o => !!(o.route || o.stage || o.asCar || o.kind !== 'car');
  // the camera onto the body (bodyland's)
  const fx = Math.cos(yaw), fz = -Math.sin(yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(bx, .6, bz); c.camera.position.set(bx + side[0] * 20 - fx * 12, 15, bz + side[1] * 20 - fz * 12); c.camera.lookAt(bx, .6, bz); c.controls.update?.(); c.camera.lookAt(bx, .6, bz);
  for (let k = 0; k < 400; k++) { tick(); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  for (let k = 0; k < 30; k++) tick();
  const K = A.lay(bx, bz, yaw); row.laid = !!K;
  // ── the stop
  // (the body on the ground is under the height map's 0.35 m: stamped into planStop's maps at 0.5 m, with 0.4 m round it for the crew,
  // so the stop never lands on it — the tool's obstacle, cruiser.js unchanged; at 0.5 m the walk still crosses it, as a body may)
  const bu = [Math.cos(yaw), -Math.sin(yaw)], bv = [Math.sin(yaw), Math.cos(yaw)], onBody = (x, z) => { const dx = x - bx, dz = z - bz; return Math.abs(dx * bu[0] + dz * bu[1]) < .9 + .4 && Math.abs(dx * bv[0] + dz * bv[1]) < .28 + .4; };
  const C2 = Object.create(C); C2.occ = (...a) => { const O = C.occ(...a); if (!O) return O; const { cx, cz, half, n } = O, H = Float32Array.from(O.H);
    for (let k = 0; k < n * n; k++) { const x = cx - half + ((k % n) + .5) * 2 * half / n, z = cz + half - (Math.floor(k / n) + .5) * 2 * half / n; if (onBody(x, z)) H[k] = Math.max(H[k], .5); }
    return { ...O, H, at(x, z) { const i = Math.floor((x - cx + half) / (2 * half) * n), j = Math.floor((cz + half - z) / (2 * half) * n); return i < 0 || j < 0 || i >= n || j >= n ? null : H[i + j * n]; } }; };
  const P = CR.planStop(C2, { x: bx, z: bz, y: 0, ry: 0 }); if (!P.plan) { row.err = 'noStop'; row.why = P.why; return row; }
  const pl = P.plan, L = pl.L; row.kind = pl.kind; row.stopLane = L.id; row.hitLane = V.lane; row.sameLane = L.id === V.lane; row.walkLen = +pl.walkLen.toFixed(1); row.lat = +pl.lat.toFixed(2);
  // ── the start (a double-park: nothing bad coming in the window)
  const sStop = pl.s + HALF, holdsLane = pl.kind === 'double' || !pl.out, look = Math.min(LOOK, (12 + JOB) * (L.v0 || 10) * 1.1);
  // (what the city knows is coming: a car's way is chosen one lane at a time — c.next at its lane's start — so beyond the lanes whose
  // cars have already chosen the stop's lane only a route car's way is known; the cars that choose later are the rule's blind spot,
  // and the holds measure it)
  function badComing() { let hit = null;
    for (const o of L.cars) if (o.s < sStop + 1 && bad(o)) hit = 'on';
    for (const cn of L.feeds || []) { for (const o of cn.cars) if (bad(o)) hit = hit || 'conn'; const I = cn.inL; if (!I) continue;
      for (const o of I.cars) if (bad(o) && (RULE === 'any' || o.next === cn) && I.len - o.s + cn.len + sStop < look) hit = hit || 'up';
      // (--rule any: also the lanes before those, whatever way their cars will choose)
      if (RULE === 'any') for (const c2 of I.feeds || []) { for (const o of c2.cars) if (bad(o)) hit = hit || 'up2'; const I2 = c2.inL; if (I2) for (const o of I2.cars) if (bad(o) && I2.len - o.s + c2.len + I.len + cn.len + sStop < look) hit = hit || 'up2'; } }
    if (!hit) for (const o of TS.cars) if (o.route && !o.gone && o.route.links.indexOf(L, o.route.i) >= 0) hit = 'routed';
    return hit; }
  let wait = 0; const waitWhy = {}; if (holdsLane) for (; wait < CAP; wait += DT) { const b = badComing(); if (!b) break; waitWhy[b] = (waitWhy[b] || 0) + 1; tick(); }
  row.wait = +wait.toFixed(1); row.waitWhy = waitWhy; if (wait >= CAP) { row.err = 'never'; return row; }
  // ── the drive
  const ctl = CR.driveCar(C2, pl); if (!ctl) { row.err = 'noDrive'; return row; } const van = ctl.c;
  let t = 0, stopped = false; for (; t < 60; t += DT) { tick(); ctl.step(); if (ctl.stopped()) { ctl.park(); stopped = true; break; } }
  row.drive = +t.toFixed(1); if (!stopped) { row.err = 'late'; ctl.drop(); return row; }
  for (let k = 0; k < 5; k++) { tick(); ctl.step(); ctl.park(); }
  // ── where it stands
  const pose = ctl.step(), ux = Math.sin(pose.h), uz = Math.cos(pose.h);
  { let zone = null; for (const n of [L.from, L.to]) { const crossed = L.axis === 'x' ? (n.arms.W || n.arms.E) : (n.arms.N || n.arms.S); if (!crossed) continue; const hc = L.axis === 'x' ? n.hz : n.hx, d = Math.abs((pose.x - n.x) * L.ux + (pose.z - n.z) * L.uz), lo = d - HALF, hi = d + HALF; if (lo < hc) zone = 'box'; else if (lo < hc + 2 && hi > hc) zone = zone || 'zebra'; }
    row.zone = zone; }
  const aB = (bx - pose.x) * ux + (bz - pose.z) * uz; row.at = aB > HALF + .9 ? 'upstream' : aB < -HALF - .9 ? 'past' : 'beside';
  const rear = [pose.x - ux * HALF, pose.z - uz * HALF]; row.rearD = +Math.hypot(bx - rear[0], bz - rear[1]).toFixed(1);
  // ── the zone: the marks' lanes (bodyland's labels → the hit lane's road lanes at the body) not shielded by the van
  const Lh = TS.lanes.find(l => l.id === V.lane), need = [];
  if (Lh) for (const l of TS.lanes) { if (l.axis !== Lh.axis || l.L !== Lh.L) continue; const ua = (bx - l.x0) * l.ux + (bz - l.z0) * l.uz; if (ua < -3 || ua > l.len + 3) continue; const same = l.ux * Lh.ux + l.uz * Lh.uz > 0, o = same ? l.off : -l.off;
    const lab = `${same ? 'own' : 'opp'}${l.n > 1 ? ':' + (Math.abs(o) < 2 ? 'inner' : 'outer') : ''}`; if (![...V.marks, ...V.pivot].includes(lab)) continue;
    const shield = l === van.L && van.L.cars.includes(van) && ((bx - pose.x) * l.ux + (bz - pose.z) * l.uz) + HALF >= 1.9; if (!shield) need.push({ l, ua, lab }); }
  row.zoneNeed = need.map(n => n.lab); let granted = need.length ? null : 0;
  // ── the stay and the leaving
  const vRect = () => ({ x: pose.x, z: pose.z, h: pose.h, len: 2 * HALF - .1, wid: 2 * HW - .1 }), bRect = { x: bx, z: bz, h: Math.atan2(Math.cos(yaw), -Math.sin(yaw)), len: 1.8, wid: .56 };
  const hold = new Map(); let ovF = 0, ovCars = new Set(), overBody = 0, qMax = 0, reroutes = 0, holdMax = 0, holdKind = null; const nexts = new Map();
  const feedIns = (L.feeds || []).map(cn => cn.inL).filter(Boolean);
  function measure(tt, staying) { ctl.step(); const R = vRect();
    for (const o of TS.cars) { if (o === van || o.gone || Math.abs(o.x - R.x) > 9 || Math.abs(o.z - R.z) > 9) continue; if (CR.overlapOf(R, { x: o.x, z: o.z, h: o.h, len: o.len - .1, wid: o.wid - .1 }) < 0) { ovF++; ovCars.add(o.id); } }
    if (staying && CR.overlapOf(R, bRect) < 0) overBody++;
    // (a bad car standing with the van ahead in its way, within 15 m)
    // (the van in its lane's list — the traffic's stopped car — and this one the next behind it on that lane, standing within 15 m)
    const inList = !van.gone && van.L?.cars?.includes(van), next = inList ? van.L.cars.filter(o => o !== van && o.s < van.s).sort((a, b) => b.s - a.s)[0] : null;
    for (const o of TS.cars) { if (o === van || o.gone || !bad(o)) continue;
      if (o === next && o.v < .3 && van.s - van.len - o.s < 15) { const h = (hold.get(o) || 0) + DT; hold.set(o, h); if (h > holdMax) { holdMax = h; holdKind = o.stage ? 'cruiser' : o.kind === 'patrol' ? 'patrol' : o.asCar ? 'cab' : 'route'; } } else hold.delete(o); }
    // (the queue behind it on its lane, nose to tail)
    if (van.L === L && !van.gone) { const behind = L.cars.filter(o => o !== van && o.s < van.s).sort((a, b) => b.s - a.s); let n = 0, front = van.s - van.len; for (const o of behind) { if (o.v > .5 || front - o.s > 10) break; n++; front = o.s - o.len; } qMax = Math.max(qMax, n); }
    if (L.cars.includes(van)) for (const I of feedIns) for (const o of I.cars) { const p = nexts.get(o); if (p && p.out === L && o.next && o.next !== p && o.next.out !== L) reroutes++; nexts.set(o, o.next); }
    if (staying && granted === null && tt <= 10) { let ok = true; for (const { l, ua } of need) { const sp = Math.max(0, ua - 3); for (const o of l.cars) { if (o.s >= sp || o === van) continue; const v = Math.max(0, o.v), gap = sp - o.s - o.len / 2; if (gap < v * v / (2 * SIMM.CAR.b) + 2 || (v < .3 && gap < 2)) ok = false; }
        for (const cn of l.feeds || []) for (const o of cn.cars) { const v = Math.max(0, o.v), gap = cn.len - o.s + sp - o.len / 2; if (gap < v * v / (2 * SIMM.CAR.b) + 2) ok = false; } }
      if (ok) granted = +tt.toFixed(1); } }
  for (let tt = 0; tt < JOB; tt += DT) { tick(); measure(tt, true); }
  let goW = 0; for (; goW < 60; goW += DT) { if (ctl.go(goW)) break; tick(); measure(JOB + goW, false); } row.goWait = +goW.toFixed(1);
  for (let tt = 0; tt < 40 && !van.gone; tt += DT) { tick(); measure(1e9, false); }
  ctl.drop();
  Object.assign(row, { granted, overlapFrames: ovF, overlapCars: ovCars.size, overBody, queue: qMax, reroutes, holdMax: +holdMax.toFixed(1), holdKind, wall: +(performance.now() - T0).toFixed(0) });
  return row;
};

let out = [];
async function worker(list) { const S = await open();
try {
  const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' });
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents && window.__record?.draw?.stage?.ctx)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load (or no stage)');
  await sleep(3000); const info = await S.ev(`(${INSTALL.toString()})()`); console.log(`page up: ${JSON.stringify(info)}`);
  for (const V of list) { let r; try { r = await S.ev(`(${RUN.toString()})(${JSON.stringify(V)}, ${DT}, ${JOB}, ${CAP}, ${LOOK}, ${JSON.stringify(RULE)})`); } catch (e) { r = { k: V.k, place: V.place, err: 'page: ' + String(e.message).slice(0, 200) }; }
    out.push(r); console.log(`#${r.k} ${V.place} ${V.cls}: ${r.err ? r.err + ' ' + JSON.stringify(r.why || r.waitWhy || '') : `${r.kind}${r.sameLane ? '' : ' (another lane)'} ${r.at} rear ${r.rearD} m${r.zone ? ' IN ' + r.zone : ''} · wait ${r.wait} drive ${r.drive} s · queue ${r.queue} reroutes ${r.reroutes} · hold ${r.holdMax}${r.holdKind ? ' ' + r.holdKind : ''} · overlaps ${r.overlapCars}${r.overBody ? ' OVER BODY' : ''} · zone ${r.zoneNeed.join('+') || '-'} ${r.zoneNeed.length ? 'granted ' + r.granted : ''}`} (${((r.wall || 0) / 1000).toFixed(0)} s)`); }
} catch (e) { console.error('vanstop: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); }
const ONLY = arg('only', null), RUNS = ONLY ? ROWS.filter(r => ONLY.split(',').includes(String(r.k))) : ROWS, lists = Array.from({ length: PAR }, (_, k) => RUNS.filter((_, i) => i % PAR === k));
await Promise.all(lists.map(l => worker(l)));
out.sort((a, b) => a.k - b.k); fs.mkdirSync(path.dirname(JSONF), { recursive: true }); fs.writeFileSync(JSONF, JSON.stringify(out).replace(/\},\{"k"/g, '},\n{"k"'));
// ── the counts and the criteria
const ok = out.filter(r => !r.err), med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; }, p90 = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length * .9)] : null; };
const cnt = (rs, f) => { const m = {}; for (const r of rs) { const k = f(r); m[k] = (m[k] || 0) + 1; } return m; };
console.log(`\nvanstop (start rule ${RULE}): ${out.length} rows (${JSON.stringify(cnt(out, r => r.place))}), job ${JOB} s, look ≤ ${LOOK} m, cab-marked 1 in 10 ordinary cars`);
console.log(`  stops: ${JSON.stringify(cnt(out, r => r.err || r.kind))} · on the hit lane ${ok.filter(r => r.sameLane).length}/${ok.length} · where ${JSON.stringify(cnt(ok, r => r.at))} · by place ${JSON.stringify(cnt(ok, r => r.place + ' ' + r.kind + ' ' + r.at))}`);
console.log(`  the door spot's walk to the body (planStop's walkLen): median ${med(ok.map(r => r.walkLen))} m, p90 ${p90(ok.map(r => r.walkLen))} m, > 10 m ${ok.filter(r => r.walkLen > 10).length} · on another lane than the hit lane: ${JSON.stringify(cnt(ok.filter(r => !r.sameLane), r => r.place))}`);
console.log(`  the body's middle to the van's rear: median ${med(ok.map(r => r.rearD))} m, p90 ${p90(ok.map(r => r.rearD))} m`);
const dbl = out.filter(r => r.kind === 'double' || r.err === 'never'), ws = dbl.filter(r => r.err !== 'never').map(r => r.wait);
console.log(`  the start rule's wait (a lane held: ${dbl.length}): median ${med(ws)} s, p90 ${p90(ws)} s, never (≥ ${CAP} s) ${out.filter(r => r.err === 'never').length}`);
console.log(`  drive to stopped: median ${med(ok.map(r => r.drive))} s, p90 ${p90(ok.map(r => r.drive))} s · request to stopped: median ${med(ok.map(r => r.wait + r.drive))} s, p90 ${p90(ok.map(r => r.wait + r.drive))} s`);
console.log(`  queue behind it: median ${med(ok.map(r => r.queue))} max ${Math.max(0, ...ok.map(r => r.queue))} · double-parked median ${med(ok.filter(r => r.kind === 'double').map(r => r.queue))} · reroutes ${ok.reduce((s, r) => s + r.reroutes, 0)} (rows with any ${ok.filter(r => r.reroutes).length}) · back into its lane: wait median ${med(ok.map(r => r.goWait))} s max ${Math.max(0, ...ok.map(r => r.goWait))} s`);
const crit = [
  ['a stop found (≥ 57/60)', out.filter(r => !['noStop', 'noDrive', 'late'].includes(r.err)).length >= 57, `${out.filter(r => !['noStop', 'noDrive', 'late'].includes(r.err)).length}/${out.length} (no stop ${out.filter(r => r.err === 'noStop').length}, no drive ${out.filter(r => r.err === 'noDrive').length}, late ${out.filter(r => r.err === 'late').length})`],
  ['median request to stopped ≤ 15 s', (med(ok.map(r => r.wait + r.drive)) ?? 99) <= 15, `${med(ok.map(r => r.wait + r.drive))} s`],
  ['0 overlaps', ok.every(r => !r.overlapCars), `${ok.filter(r => r.overlapCars).length} rows, ${ok.reduce((s, r) => s + r.overlapCars, 0)} cars, ${ok.reduce((s, r) => s + r.overlapFrames, 0)} frames`],
  ['≤ 2 zone pieces not granted within 10 s', ok.filter(r => r.zoneNeed.length && r.granted === null).length <= 2, `${ok.filter(r => r.zoneNeed.length && r.granted === null).length} (needing one ${ok.filter(r => r.zoneNeed.length).length}, granted at median ${med(ok.filter(r => r.granted !== null && r.zoneNeed.length).map(r => r.granted))} s)`],
  ['0 cab-marked holds over 3.5 s', ok.every(r => r.holdMax <= 3.5), `longest ${Math.max(0, ...ok.map(r => r.holdMax))} s; over 3.5 s ${ok.filter(r => r.holdMax > 3.5).length} (${JSON.stringify(cnt(ok.filter(r => r.holdMax > 3.5), r => r.holdKind))})`],
  ['0 stops in a zebra or box', ok.every(r => !r.zone), `${ok.filter(r => r.zone).length}`],
  ['(also) never over the body', ok.every(r => !r.overBody), `${ok.filter(r => r.overBody).length}`]];
for (const [k, p, m] of crit) console.log(`  ${p ? 'PASS' : 'FAIL'}  ${k}: ${m}`);
console.log(`vanstop: ${crit.every(c => c[1]) ? 'PASS' : 'FAIL'} · rows: ${path.relative(ROOT, JSONF)}`); process.exit(crit.every(c => c[1]) ? 0 : 1);
