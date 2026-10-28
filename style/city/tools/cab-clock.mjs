// TAXI CLOCK (2026-10-09) · the cabs' gate IN THE PAGE (the replay moving at the 60-min day + movemock):
//   node style/city/tools/cab-clock.mjs --port 5381 --simport 5382 --legs 8 [--skip 0] [--out runs/cab-clock.json]
//   · synthetic taxi riders, one at a time (trips travel.mjs books from now on): the booked arrival vs the moment the drawn rider is on the
//     kerb (movement.js S.vlegs late, game min) → drift median / p90; the whole trip's arrival drift too
//   · every frame: cab–car body overlaps (a cab: a kin car of the fleet's cabs; the traffic's own rectangles, 5 cm inset), cab–cab · at
//     the end: cabs past their clock still held (orphans), route cars left in the traffic, the fleet's cab counters
//   (BUSES OUT, 2026-10-09: the bus–car and cab–bus counts went with the buses)
import { open, sleep } from '../ui/tools/cdp.mjs';
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = arg('port', '5381'), SIMPORT = arg('simport', '5382'), NL = +arg('legs', 8), SKIP = +arg('skip', 0), OUT = arg('out', null), MAXW = +arg('max', 200);
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); if (!a.length) return NaN; const f = (a.length - 1) * p, i = Math.floor(f); return a[i] + (a[Math.min(a.length - 1, i + 1)] - a[i]) * (f - i); };
const MON = `(() => { if (window.__cabclock) return; const T = () => window.__city.traffic.sim, MV = () => window.__simlive.agents.movement;
  const P = { frames: 0, car: 0, carFrames: 0, cab: 0, pairs: [], fps: [], err: null };
  const obb = (A, B) => { const ax = [[Math.sin(A.h), Math.cos(A.h)], [Math.cos(A.h), -Math.sin(A.h)], [Math.sin(B.h), Math.cos(B.h)], [Math.cos(B.h), -Math.sin(B.h)]], dx = B.x - A.x, dz = B.z - A.z;
    const ext = (C, u) => (C.len / 2 - .05) * Math.abs(Math.sin(C.h) * u[0] + Math.cos(C.h) * u[1]) + (C.wid / 2 - .05) * Math.abs(Math.cos(C.h) * u[0] - Math.sin(C.h) * u[1]);
    for (const u of ax) if (Math.abs(dx * u[0] + dz * u[1]) > ext(A, u) + ext(B, u)) return false; return true; };
  let last = performance.now(), fn = 0, ft = 0;
  function loop(ts) { P.frames++; fn++; ft += (ts - last) / 1000; last = ts; if (ft > 5) { P.fps.push(+(fn / ft).toFixed(1)); fn = 0; ft = 0; }
    try { const S = T(); if (S) { const cabs = S.cars.filter(c => c.cab); let n = 0;
        for (const c of cabs) for (const o of S.cars) { if (o === c || Math.abs(o.x - c.x) > 9 || Math.abs(o.z - c.z) > 9 || !obb(c, o)) continue;
          if (o.cab) { if (o.id > c.id) P.cab++; continue; } n++;
          if (P.pairs.length < 40) P.pairs.push({ at: [+c.x.toFixed(1), +c.z.toFixed(1)], car: o.L ? (o.L.kind === 'conn' ? 'conn' + o.L.turn + '@' + o.L.node.k : 'lane ' + o.L.axis + o.L.L) + ' s' + o.s.toFixed(1) : '?', hold: o.hold || null, v: +o.v.toFixed(1), cv: +c.v.toFixed(1) }); }
        if (n) { P.car += n; P.carFrames++; } } } catch (e) { P.err = String(e.message || e); }
    requestAnimationFrame(loop); }
  requestAnimationFrame(loop); window.__cabclock = P; })()`;
const S = await open({ w: 960, h: 540 }); const res = { legs: [], t0: Date.now() };
try {
  await S.go(`http://127.0.0.1:${PORT}/style/city/?sim=live&simport=${SIMPORT}&movemock=1&ui=0`, { until: 'window.__simlive?.agents?.movement && window.__city && !window.__city.loading && window.__city.traffic && window.__simlive.agents.moveNow != null', ms: 240000 });
  await S.ev(MON); await sleep(3000);
  await S.ev(`(async () => { const TV = await import('/world/export/travel.mjs'), MT = await import('/style/city/simstate/movetune.mjs'), W = await (await fetch((await import('/world/city.js')).sdata('/world/export/world.json'))).json(); window.__ccT = TV.createTravel(MT.tuneWorld(W)); window.__ccW = W; return 1; })()`);
  // the trips: place and lot pairs a cab takes 25–75 s to drive (every one booked by travel.mjs from the moment it is asked)
  const pairs = await S.ev(`(() => { const W = window.__ccW, T = window.__ccT, ids = [...W.places.map(p => p.id), ...W.lots.filter((l, k) => k % 6 === 0).map(l => l.id)], out = [];
    for (let k = 0; out.length < ${NL + SKIP} && k < 3000; k++) { const a = ids[(k * 7919) % ids.length], b = ids[(k * 104729 + 13) % ids.length]; if (a === b) continue; const tr = T.trip(a, b, 'taxi', { dep: 600 }), L = tr?.legs.find(l => l.kind === 'taxi');
      if (!L || L.path.length < 2) continue; const s = (L.arr - L.dep) * 2.5; if (s >= 25 && s <= 75) out.push([a, b]); } return out.slice(${SKIP}); })()`);
  let k = 0;
  for (const [from, to] of pairs) { k++;
    const info = await S.ev(`(() => { const now = window.__simlive.agents.moveNow, tr = window.__ccT.trip('${from}', '${to}', 'taxi', { dep: Math.ceil(now * 10) / 10 + .4 }); if (!tr) return null; const v = tr.legs.find(l => l.kind === 'taxi'); if (!v) return { skip: 1 };
      const a = { id: 'cc:${k}:' + Date.now(), look: 3 }, R = window.__simlive.agents.movement.run(a, tr); window.__ccR = { a, R, done: false, tr }; let last = performance.now();
      const step = ts => { const B = window.__ccR; if (!B || B.a !== a) return; const dt = Math.min(.1, (ts - last) / 1000); last = ts; try { B.R.frame(window.__simlive.agents.moveNow, dt, a); } catch (e) { B.err = e.message; } if (!B.R.done) requestAnimationFrame(step); else B.done = true; }; requestAnimationFrame(step);
      return { now, dep: v.dep, arr: v.arr, tdep: tr.dep, tarr: tr.arr }; })()`);
    if (!info || info.skip) { console.log(from, to, 'skipped'); continue; }
    const t0 = Date.now(), realS = (info.tarr - info.now) * 2.5; let r = null;
    while (Date.now() - t0 < Math.min(MAXW, realS + 40) * 1000) { await sleep(1500); r = await S.ev(`(() => { const B = window.__ccR, st = window.__simlive.agents.movement.stats(), v = st.vlegs.filter(x => x.id === B.a.id && x.kind === 'taxi'), ar = st.arrivals.filter(x => x.id === B.a.id); return B.done || ar.length ? { late: v[0]?.late ?? null, drift: ar[0]?.drift ?? null, err: B.err || null } : null; })()`); if (r) break; }
    const row = { from, to, booked: +((info.arr - info.dep) * 2.5).toFixed(1), late: r ? r.late : null, tripDrift: r ? r.drift : null, err: r?.err || null }; res.legs.push(row);
    const mon = await S.ev(`(() => { const P = window.__cabclock, F = window.__simlive.agents.movement.fleet, TS = window.__city.traffic.sim, c = F?.cabs?.stats() || {}; return { car: P.car, carFrames: P.carFrames, cab: P.cab, frames: P.frames, orphans: c.orphans, queued: c.queued, routeCars: TS.cars.filter(q => q.route && !q.stage).length, pushes: c.pushes, pushM: +(c.pushM || 0).toFixed(1), planned: c.planned, released: c.released, winSkipped: c.winSkipped, ms: +(c.msMax || 0).toFixed(1) }; })()`).catch(e => ({ err: e.message }));
    row.mon = mon; console.log(`${((Date.now() - res.t0) / 1000).toFixed(0)}s ${from} → ${to} ride ${row.booked} s · late ${row.late} · trip drift ${row.tripDrift} · so far ${JSON.stringify(mon)}`);
    await S.ev(`(() => { try { window.__ccR.R.release(window.__ccR.a); } catch {} window.__ccR = null; return 1; })()`); }
  await sleep(4000);
  const P = await S.ev(`(() => { const P = window.__cabclock, F = window.__simlive.agents.movement.fleet, TS = window.__city.traffic.sim; return { frames: P.frames, car: P.car, carFrames: P.carFrames, cab: P.cab, pairs: P.pairs.slice(0, 20), fps: P.fps, err: P.err,
    cabs: F?.cabs?.stats() || null, routeCars: TS.cars.filter(c => c.route && !c.stage).length, kinCabs: TS.cars.filter(c => c.cab).length, heldRiders: TS.cars.filter(c => c.cab?.rider).length, traffic: TS.stat.overlaps }; })()`);
  const lates = res.legs.filter(l => l.late != null).map(l => l.late), ad = lates.map(Math.abs);
  res.summary = { legs: res.legs.length, ridden: lates.length, driftMedian: +q(lates, .5).toFixed(3), absMedian: +q(ad, .5).toFixed(3), absP90: +q(ad, .9).toFixed(3), max: lates.length ? +Math.max(...ad).toFixed(3) : null,
    cabCar: { overlaps: P.car, frames: P.carFrames }, cabCab: P.cab, frames: P.frames, orphans: P.cabs?.orphans ?? null, routeCars: P.routeCars, kinCabsLeft: P.kinCabs, heldRiders: P.heldRiders, cabs: P.cabs, fps: P.fps, err: P.err };
  res.pairs = P.pairs; console.log(JSON.stringify(res.summary, null, 1)); if (P.pairs.length) console.log('pairs', JSON.stringify(P.pairs.slice(0, 8)));
  console.log('errors', S.errs.slice(0, 5));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
} finally { await S.close(); }
