// C2-CLEANERS round 2 (2026-11-05) · KERBPASS: is there room for the cars to pass what stands at a body, rather than queue behind it?
// (The orchestrator's direction for the cab rule: traffic owns a kerb obstacle and bends a lane's line round it where the road has
// room; where the bend crosses into the oncoming lane or the next lane a car gives way, as at a double-parked car.) GEOMETRY ONLY: no
// traffic is measured and nothing in the city changes. For every bodyland landing (style/city/tools/runs/bodyland-{11,12}.json, 311),
// in a real page (headless Chrome, the record's playback 404-A, this checkout on --port) only so the blocks there stream in (their
// parked cars: the anchors' `parked` boxes, main.js parkedIn's), the road's cross-section is gridded round the body (along the hit
// lane: a, 0.25 m; across: o, 0.05 m, in the hit car's right-hand frame) with what stands on it:
//   the kerbs        the road's edges (|o| > hw)
//   parked cars      the anchors' boxes
//   a FOOTPRINT, one of five (each with the body itself, lie_still's 1.8 × 0.56 m):
//     body           the body alone (a body lying in a lane: the trunk's drive-over)
//     crew           round 1's job: cleaners.md §2–§4's marks (A, B, the lift marks: a Cleaner 0.45 m round, the toon head's half-width),
//                    the bag at rest (2.1 × 1.0 m), the carry's pivot circle round the bag's middle (CARRY_GAP/2 + 0.45 m)
//     carry          the same with a straight carry and no pivot: the bag's line from the feet mark to the head mark, ±0.5 m
//     van            a van at the kerb beside the body: 4.4 × 1.8 m (the fleet's van; the cruiser's size), its side 0.14 m off the kerb
//                    (stage/cruiser.js STOP.kerbGap) on the body's side of the road (the left kerb of a one-way for a kerbside
//                    body), at the nearest place along it (≤ 15 m, either way) clear of the parked cars (0.1 m) and of the body
//                    (0.4 m), within the lane's own stretch (never a zebra or the box)
//     van@0.1        the van alone, kept 0.1 m from as a parked car is (the others: 0.3 m)
//     van+crew       the van and the straight carry's job
// For each lane of the road whose line the footprint (0.3 m round it) leaves no room on, every station: the positions a 1.8 m car's
// middle could take, its body ≥ 0.3 m from the footprint, ≥ 0.1 m from a parked car or a kerb (the clearances the cars keep today:
// an avenue's line passes its parked cars 0.2 m off), the one nearest the lane's line. Each landing × footprint, its worst lane:
//   clear          no lane needs to move
//   own            every station has room on the lane's own side (an avenue's: its half of the road; Route 9's: its lane, the line
//                  between them at 2.1 m; a one-way: the road) — X: the largest move of the line, m
//   give-way       room only across the centre line or into the next lane
//   none           no room: the cars stop
// and the bend: ease in and out at a comfortable lateral acceleration (--lat, 1.0 m/s²; traffic/sim.js's turns take 2.2) on a
// half-cosine, at the lane's speed: each ease T = π·√(X / 2a) s, v·T m; the stretch from the ease in to the ease out runs past
// the lane's own stretch (into a zebra or the box) or not; vFit: the speed at which both eases fit in the lane's own stretch (the room
// before the footprint and after it, each over T) — a car slows to that to pass, as at a double-parked car.
//   node style/city/tools/kerbpass.mjs --port <p> [--par 3] [--lat 1.0] [--json out.json] [--only k,k…]
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = +arg('port', 0), PAR = +arg('par', 3), LAT = +arg('lat', 1.0);
if (!PORT) { console.error('kerbpass: --port <p> (the page served: node style/serve.mjs <p>)'); process.exit(2); }
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), JSONF = arg('json', path.join(ROOT, 'style/city/tools/runs/kerbpass.json'));
const W = 960, H = 600;
const ROWS = ['11', '12'].flatMap(s => JSON.parse(fs.readFileSync(path.join(ROOT, `style/city/tools/runs/bodyland-${s}.json`), 'utf8')).filter(r => !r.err).map(r => ({ seed: +s, i: r.i, d: r.d, place: r.place, cls: r.car.cls, lane: r.car.lane, body: r.body }))).map((r, k) => ({ k, ...r }));
// the Chrome profile, removed only once Chrome has exited (jaycheck.mjs's way)
async function rmProfile(ch, prof, exited) {
  try { ch.kill('SIGKILL'); } catch {}
  await Promise.race([exited, sleep(10000)]);
  for (let k = 0; k < 2; k++) { try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} if (!fs.existsSync(prof)) return true; await sleep(1000); }
  console.error(`could not remove the Chrome profile ${prof}`); return false;
}
const LIVE = new Set(); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await Promise.all([...LIVE].map(f => f())); process.exit(130); });
async function open() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'kerbpass-'));
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
  const c = window.__city, TS = c.traffic.sim, B = new URL('.', location.href).pathname;
  const [CN] = await Promise.all([import(B + 'anim/cast/clips/cleaners.js')]);
  c.pauseLoop(true); c.cover(true); c.traffic.accidents.GORE.on = false; c.traffic.accidents.cleaners.CLEAN.on = false;
  window.__kp = { c, TS, CN }; return { lanes: TS.lanes.length };
};

const RUN = async (V, LAT) => {
  const { c, TS, CN } = window.__kp, row = { k: V.k, seed: V.seed, i: V.i, place: V.place, cls: V.cls }, bx = V.body.x, bz = V.body.z, yaw = V.body.yaw;
  // the camera onto the body (bodyland's), only so the blocks there stream in
  const fx = Math.cos(yaw), fz = -Math.sin(yaw), side = [fz, -fx], q = c.cam; if (q && q.mode !== 'orbit') q.toOrbit({ instant: true });
  c.controls.target.set(bx, .6, bz); c.camera.position.set(bx + side[0] * 20 - fx * 12, 15, bz + side[1] * 20 - fz * 12); c.camera.lookAt(bx, .6, bz); c.controls.update?.(); c.camera.lookAt(bx, .6, bz);
  for (let k = 0; k < 400; k++) { c.tick(.1, 1); if (k > 8 && c.stream.settled()) break; await new Promise(r => setTimeout(r, k < 30 ? 30 : 5)); }
  const Lh = TS.lanes.find(l => l.id === V.lane); if (!Lh) { row.err = 'lane'; return row; }
  const u = [Lh.ux, Lh.uz], r = [-Lh.uz, Lh.ux], A = (x, z) => (x - Lh.x0) * u[0] + (z - Lh.z0) * u[1], O = (x, z) => (x - Lh.x0) * r[0] + (z - Lh.z0) * r[1] + Lh.off, W = (a, o) => [Lh.x0 + u[0] * a + r[0] * (o - Lh.off), Lh.z0 + u[1] * a + r[1] * (o - Lh.off)];
  const hw = Lh.hw, aB = A(bx, bz), oB = O(bx, bz), r9 = Lh.n > 1, one = Lh.n === 1 && !TS.lanes.some(l => l.axis === Lh.axis && l.L === Lh.L && l.ux * Lh.ux + l.uz * Lh.uz < 0);
  // the road's lanes at the body, offsets in this frame
  const rL = []; for (const l of TS.lanes) { if (l.axis !== Lh.axis || l.L !== Lh.L) continue; const ua = (bx - l.x0) * l.ux + (bz - l.z0) * l.uz; if (ua < -3 || ua > l.len + 3) continue; const same = l.ux * Lh.ux + l.uz * Lh.uz > 0; rL.push({ l, same, o: same ? l.off : -l.off, ua }); }
  // ── the shapes, in (a, o): rects { a, o, ha, ho } (axis-aligned with the road: the body lies along it) and discs { a, o, r }
  const bu = [Math.cos(yaw), -Math.sin(yaw)], toW = (p, lx, lz) => [p[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), p[1] - lx * Math.sin(yaw) + lz * Math.cos(yaw)], AO = p => [A(p[0], p[1]), O(p[0], p[1])];
  const rx = bx - bu[0] * .9, rz = bz - bu[1] * .9, A0 = toW([rx, rz], -CN.BODY.at[0], -CN.BODY.at[1]), B0 = toW(A0, 0, CN.BODY.gap), bagO = toW(A0, .2, .65), Al = [bagO[0] - CN.LIFT.at[2] * bu[0], bagO[1] - CN.LIFT.at[2] * bu[1]], Bl = [Al[0] + CN.CARRY_GAP * bu[0], Al[1] + CN.CARRY_GAP * bu[1]], M0 = [(Al[0] + Bl[0]) / 2, (Al[1] + Bl[1]) / 2];
  const [ab, ob] = [aB, oB], body = { a: ab, o: ob, ha: .9, ho: .28 }, disc = (p, rr) => { const [a, o] = AO(p); return { a, o, r: rr }; }, rect = (p, ha, ho) => { const [a, o] = AO(p); return { a, o, ha, ho }; };
  const marks = [disc(A0, .45), disc(B0, .45), disc(Al, .45), disc(Bl, .45), rect(bagO, 1.05, .5)];
  const [aAl, oAl] = AO(Al), [aBl, oBl] = AO(Bl), band = { a: (aAl + aBl) / 2, o: (oAl + oBl) / 2, ha: Math.abs(aBl - aAl) / 2 + .45, ho: .5 + Math.abs(oBl - oAl) / 2 };
  const pivot = disc(M0, CN.CARRY_GAP / 2 + .45);
  // the parked cars near (the anchors' boxes → (a, o) rects)
  const PK = []; for (const an of c.ANCHORS.values()) for (const p of an?.parked || []) { if (p[2] < bx - 50 || p[0] > bx + 50 || p[3] < bz - 50 || p[1] > bz + 50) continue; const cs = [[p[0], p[1]], [p[2], p[3]]].map(([x, z]) => [A(x, z), O(x, z)]); PK.push({ a: (cs[0][0] + cs[1][0]) / 2, o: (cs[0][1] + cs[1][1]) / 2, ha: Math.abs(cs[1][0] - cs[0][0]) / 2, ho: Math.abs(cs[1][1] - cs[0][1]) / 2 }); }
  // the van: at the kerb on the body's side, nearest clear place along it
  const sB = oB >= 0 ? 1 : -1, oV = sB * (hw - .14 - .9); let van = null;
  { const hit = (a) => PK.some(p => Math.abs(p.a - a) < p.ha + 2.2 + .1 && Math.abs(p.o - oV) < p.ho + .9 + .1) || (Math.abs(a - ab) < .9 + 2.2 + .4 && Math.abs(ob - oV) < .28 + .9 + .4);
    for (let d = 0; d <= 15 && !van; d += .25) for (const a of [ab + d, ab - d]) { if (a < 2.2 || a > Lh.len - 2.2 || hit(a)) continue; van = { a, o: oV, ha: 2.2, ho: .9 }; break; } }
  row.van = van ? { da: +(van.a - ab).toFixed(2), o: +oV.toFixed(2) } : null;
  const FP = { body: [body], crew: [body, ...marks, pivot], carry: [body, ...marks, band], van: van ? [body, van] : null, 'van@0.1': van ? [body, { ...van, pad: .1 }] : null, 'van+crew': van ? [body, van, ...marks, band] : null };
  // ── the grid: stations a (0.25 m) over the footprint's stretch ± 40 m, positions o (0.05 m) across the road
  const inShape = (S, a, o, pad) => S.r !== undefined ? Math.hypot(a - S.a, o - S.o) < S.r + pad : Math.abs(a - S.a) < S.ha + pad && Math.abs(o - S.o) < S.ho + pad;
  const NO = Math.round(2 * hw / .05) + 1, oAt = j => -hw + j * .05;
  function blocked(F, a) { const b = new Uint8Array(NO); for (let j = 0; j < NO; j++) { const o = oAt(j); if (Math.abs(o) > hw - .1) { b[j] = 1; continue; } for (const p of PK) if (inShape(p, a, o, .1)) { b[j] = 2; break; } if (b[j]) continue; for (const S of F) if (inShape(S, a, o, S.pad ?? .3)) { b[j] = 3; break; } } return b; }
  // a car's middle at o fits: its body (±0.9) on no blocked position
  const fits = (b, o) => { const j0 = Math.ceil((o - .9 + hw) / .05), j1 = Math.floor((o + .9 + hw) / .05); if (j0 < 0 || j1 >= NO) return false; for (let j = j0; j <= j1; j++) if (b[j]) return false; return true; };
  const sideOf = L => one ? [-hw, hw] : r9 ? (L.o > 0 ? (Math.abs(L.o) < 2 ? [0, 2.1] : [2.1, hw]) : (Math.abs(L.o) < 2 ? [-2.1, 0] : [-hw, -2.1])) : (L.o > 0 ? [0, hw] : [-hw, 0]);
  row.fp = {};
  for (const [name, F] of Object.entries(FP)) { if (!F) { row.fp[name] = { cls: 'novan' }; continue; }
    let a0 = Math.min(...F.map(S => S.a - (S.r ?? S.ha))) - 1, a1 = Math.max(...F.map(S => S.a + (S.r ?? S.ha))) + 1; const stations = []; for (let a = a0; a <= a1; a += .25) stations.push([a, blocked(F, a), blocked([], a)]);
    let worst = { cls: 'clear', X: 0 }; const rank = { clear: 0, own: 1, 'give-way': 2, none: 3 }; const lanes = [];
    for (const L of rL) { const [s0, s1] = sideOf(L); let cls = 'clear', X = 0, aIn = null, aOut = null;
      for (const [a, b, b0] of stations) { if (fits(b, L.o)) continue; // (the line itself is clear here)
        // (where the line is already tight without the footprint — a parked car 0.2 m off an avenue's line — the footprint isn't why)
        if (!fits(b0, L.o) && !F.some(S => Math.abs(a - S.a) < (S.r ?? S.ha) + .3)) continue;
        let bestOwn = null, bestAny = null; for (let j = 0; j < NO; j++) { const o = oAt(j); if (!fits(b, o)) continue; const d = Math.abs(o - L.o); if (o - .9 >= s0 - 1e-6 && o + .9 <= s1 + 1e-6) { if (bestOwn === null || d < bestOwn) bestOwn = d; } if (bestAny === null || d < bestAny) bestAny = d; }
        const k = bestOwn !== null ? 'own' : bestAny !== null ? 'give-way' : 'none'; if (rank[k] > rank[cls]) cls = k; X = Math.max(X, bestOwn ?? bestAny ?? 0); aIn = aIn === null ? a : Math.min(aIn, a); aOut = aOut === null ? a : Math.max(aOut, a); }
      const v = L.l.v0 || 10, T = X > 0 ? Math.PI * Math.sqrt(X / (2 * LAT)) : 0, ease = v * T;
      // (the bend's stretch in the lane's own coordinates: past its start or its end — a zebra, the box — or not)
      let over = false, vFit = null; if (aIn !== null) { const c0 = W(aIn - (L.same ? ease : -ease), oB), c1 = W(aOut + (L.same ? ease : -ease), oB), ua0 = (c0[0] - L.l.x0) * L.l.ux + (c0[1] - L.l.z0) * L.l.uz, ua1 = (c1[0] - L.l.x0) * L.l.ux + (c1[1] - L.l.z0) * L.l.uz; over = Math.min(ua0, ua1) < 0 || Math.max(ua0, ua1) > L.l.len;
        // (the speed at which both eases fit in the lane's own stretch: the room before the footprint and after it, over T)
        const e0 = W(aIn, oB), e1 = W(aOut, oB), u0 = (e0[0] - L.l.x0) * L.l.ux + (e0[1] - L.l.z0) * L.l.uz, u1 = (e1[0] - L.l.x0) * L.l.ux + (e1[1] - L.l.z0) * L.l.uz, roomIn = Math.max(0, Math.min(u0, u1)), roomOut = Math.max(0, L.l.len - Math.max(u0, u1));
        vFit = T > 0 ? +Math.min(v, roomIn / T, roomOut / T).toFixed(1) : +v.toFixed(1); }
      const lab = `${L.same ? 'own' : 'opp'}${r9 ? ':' + (Math.abs(L.o) < 2 ? 'inner' : 'outer') : ''}`;
      lanes.push({ lane: lab, cls, X: +X.toFixed(2), ease: +ease.toFixed(1), len: aIn === null ? 0 : +(aOut - aIn + 2 * ease).toFixed(1), over, vFit });
      if (rank[cls] > rank[worst.cls] || (rank[cls] === rank[worst.cls] && X > worst.X)) worst = { cls, X: +X.toFixed(2), lane: lab, ease: +ease.toFixed(1), len: aIn === null ? 0 : +(aOut - aIn + 2 * ease).toFixed(1), over, vFit }; }
    row.fp[name] = { ...worst, lanes }; }
  row.parked = PK.length; return row;
};

let out = [];
async function worker(list) { const S = await open();
try {
  const qs = new URLSearchParams({ sim: 'record', feed: '/core/runs/404-A/feed.jsonl', tv: '0' });
  await S.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?${qs}` }); const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(500); ready = await S.ev(`!!(window.__city && !window.__city.loading && window.__city.traffic?.accidents)`).catch(() => false); }
  if (!ready) throw new Error('the page did not load');
  await sleep(3000); const info = await S.ev(`(${INSTALL.toString()})()`); console.log(`page up: ${JSON.stringify(info)}`);
  for (const V of list) { let r; try { r = await S.ev(`(${RUN.toString()})(${JSON.stringify(V)}, ${LAT})`); } catch (e) { r = { k: V.k, place: V.place, err: 'page: ' + String(e.message).slice(0, 200) }; } out.push(r); }
} catch (e) { console.error('kerbpass: ' + (e.stack || e.message)); }
if (S.errs.length) console.log('page errors: ' + S.errs.slice(0, 5).join(' | '));
await S.close(); }
const ONLY = arg('only', null), RUNS = ONLY ? ROWS.filter(r => ONLY.split(',').includes(String(r.k))) : ROWS, lists = Array.from({ length: PAR }, (_, k) => RUNS.filter((_, i) => i % PAR === k));
await Promise.all(lists.map(l => worker(l)));
out.sort((a, b) => a.k - b.k); fs.mkdirSync(path.dirname(JSONF), { recursive: true }); fs.writeFileSync(JSONF, JSON.stringify(out).replace(/\},\{"k"/g, '},\n{"k"'));
// ── the counts
const ok = out.filter(r => !r.err), med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; }, p90 = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length * .9)] : null; };
const cnt = (rs, f) => { const m = {}; for (const r of rs) { const k = f(r); m[k] = (m[k] || 0) + 1; } return m; };
console.log(`kerbpass: ${out.length} landings (${out.length - ok.length} could not be read) · lateral ease ${LAT} m/s², a half-cosine at the lane's speed · van placed ${ok.filter(r => r.van).length}/${ok.length} (along from the body median ${med(ok.filter(r => r.van).map(r => Math.abs(r.van.da)))} m)`);
for (const name of ['body', 'crew', 'carry', 'van', 'van@0.1', 'van+crew']) { const F = ok.map(r => r.fp[name]), mv = F.filter(f => f.cls === 'own').map(f => f.X), all = F.filter(f => f.cls === 'own' || f.cls === 'give-way');
  console.log(`  ${name.padEnd(8)} ${JSON.stringify(cnt(F, f => f.cls))} · own-side move X median ${med(mv)} p90 ${p90(mv)} max ${Math.max(0, ...mv)} m · the largest move ${Math.max(0, ...all.map(f => f.X))} m · ease each way median ${med(all.map(f => f.ease))} max ${Math.max(0, ...all.map(f => f.ease))} m · the bend's stretch median ${med(all.map(f => f.len))} max ${Math.max(0, ...all.map(f => f.len))} m · past the lane's stretch (zebra/box) ${all.filter(f => f.over).length} · the speed both eases fit the lane's stretch at: median ${med(all.map(f => f.vFit))} m/s, < 3 m/s ${all.filter(f => f.vFit < 3).length}`);
  console.log(`           by place ${JSON.stringify(cnt(ok, r => r.place + ' ' + r.fp[name].cls))} · the worst lane ${JSON.stringify(cnt(F.filter(f => f.lane), f => f.lane + ' ' + f.cls))}`); }
console.log(`  rows: ${path.relative(ROOT, JSONF)}`);
