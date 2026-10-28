// MOVEMENT W2 · THE TRAVEL HELPER (world/export/README.md). Pure JS, no imports: node, the browser or a worker.
//   import { createTravel } from './travel.mjs';  const T = createTravel(JSON.parse(fs.readFileSync(WORLD_EXPORT, 'utf8')));
//   T.matrix(from, to, mode)              → { m, s, fare } from the export's dense table (named nodes only), or null (no such trip)
//   T.best(from, to, mode, opt)           → the same numbers computed live: any place / stop / station / lot / apartment id, or [x, z]
//   T.trip(from, to, mode, { dep, ... })  → the trip in MOVEMENT.md §3's shape (legs with game-minute dep/arr, the line, the path)
// tools/export-world.mjs builds the dense table WITH this file, so the table and a live trip can never disagree.
// Units: metres and REAL seconds everywhere; game minutes only in a trip's dep/arr (1 game min = 2.5 real s, MOVEMENT.md §1).

export const GAME_MIN = 2.5;   // real seconds per game minute
export const MODES = ['walk', 'skate', 'bike', 'scooter', 'subway', 'taxi'];   // (BUSES OUT, 2026-10-09: no 'bus' mode)
const ACCESS_FREE = 15, ACCESS_ROUGH = 1.25;   // a walk off the sidewalk graph (a door, a site, the woods): straight, ×1.25 beyond 15 m
export const access = d => d <= ACCESS_FREE ? d : ACCESS_FREE + (d - ACCESS_FREE) * ACCESS_ROUGH;

// TAXI CLOCK (2026-10-09) · ONE DRIVE, from rest to rest along pieces [{ len (m), v (m/s: the speed it may go there) }]: every DRIVE.step m
// the cap (the slower piece where a step straddles two), pulling away at a and braking at b m/s² (the forward and the backward pass), a
// DRIVE.smooth m running mean (never above the pass: the corners of the acceleration rounded off), ends at rest → { T (s), n, D, v, tk
// (s at each step) }. travel.mjs books a taxi ride with it; the city's cab (style/city/traffic/cabs.js) is driven with it on the same
// pieces and fitted to the booked second — so what the sim books is what the city drives.
export const DRIVE = { step: .25, smooth: 1.5 };
export function driveProfile(segs, a, b) {
  const dist = Math.max(.01, segs.reduce((s, g) => s + g.len, 0)), n = Math.max(2, Math.ceil(dist / DRIVE.step)), D = dist / n;
  const cap = new Float64Array(n + 1), v = new Float64Array(n + 1), sm = new Float64Array(n + 1), tk = new Float64Array(n + 1); let k = 0, c0 = 0;
  const capAt = x => { while (k < segs.length - 1 && c0 + segs[k].len < x) { c0 += segs[k].len; k++; } return segs[k] ? segs[k].v : 1; };
  let prev = capAt(0); for (let i = 0; i <= n; i++) { const hi = capAt(Math.min(dist, (i + .5) * D)); cap[i] = Math.min(prev, hi); prev = hi; }
  for (let i = 1; i < n; i++) v[i] = Math.min(cap[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * a * D));
  v[n] = 0; for (let i = n - 1; i >= 1; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * b * D));
  const w = Math.max(1, Math.round(DRIVE.smooth / D)); for (let i = 1; i < n; i++) { let s = 0, m = 0; for (let j = Math.max(0, i - w); j <= Math.min(n, i + w); j++) { s += v[j]; m++; } sm[i] = Math.min(v[i], s / m); }
  for (let i = 1; i <= n; i++) tk[i] = tk[i - 1] + D / Math.max(.05, (sm[i - 1] + sm[i]) / 2);
  return { T: tk[n], n, D, v: sm, tk };
}

// CAB TRAFFIC (2026-10-10, slime: "cabs can arrive when they arrive like normal traffic") · ONE CAR THROUGH THE FIXED-TIME LIGHTS.
// The city's cab is an ordinary car of its traffic (style/city/traffic/sim.js: IDM, the lights, the box, the zebras; it asks no priority,
// nobody is cleared off its way), so a ride takes what that car takes from rest at the pickup to rest at the drop, red lights included.
// The lights run on ONE fixed clock (traffic/rules.js: every junction the same 44 s cycle at its own offset; the signal clock is the
// movement clock's real seconds, game minute × 2.5: traffic/fleet.js), so the waits are a pure function of the departure second.
// carDrive replays sim.js's step for a car alone on the road — its speed (IDM), the turn ahead, at each signalled line the light, the
// yellow, a straight car's "late" rule (its body past the far zebra before the cross street's WALK), a turner's wait for the WALK on the
// zebra it turns over to end — at the traffic's own step. What it can't know is the rest of the traffic: cars queued ahead, walkers still
// in the road, a box the cross traffic holds. That is the residual (style/city/tools/cabresidual.mjs measures it).
//   links  [{ kind: 'lane', len, v0, sig (its end junction is signalled), ns (its axis is N–S), cyc: [gNS, gEW, offset] }
//          | { kind: 'conn', len, v0, turn (not straight on), bands: [{ s0, s1, ns (its WALK is walkAcrossNS), walk (a crossing there) }],
//            bIn, bOut (of bands, or null), waitIn }]
//   o      { s0: start on links[0], s1: the stop on the last link, t0: the signal clock's second at the start, v: speed at the start (rest: 0),
//            car: { a, b, s0, T, dv, bStop, bMax, turnBrake, len, body }, sig: { yellow, allRed, flash }, step }
//   → { T: s to the stop (sim.js's route stop: within 0.8 m, under 0.4 m/s), stood: s at under 0.3 m/s on the way, lines: [{ at, wait }] }
//   (o.until: a signal-clock second — it stops there and gives where the car is: { at: { i (link), s, v, t } })
export function carDrive(links, o) {
  const C = o.car, Y = o.sig.yellow, R = o.sig.allRed, FL = o.sig.flash, h = o.step || .1, A = C.a, dv = C.dv ?? 1, sq = Math.sqrt(A * C.b);
  const phase = (L, t) => { const [gNS, gEW, off] = L.cyc, len = gNS + gEW + 2 * (Y + R), s = (((t + off) % len) + len) % len; return { s, gNS, gEW, len }; };
  const light = (L, t) => { const { s, gNS, gEW } = phase(L, t), a = gNS, b = a + Y, c = b + R, d = c + gEW, e = d + Y; return L.ns ? (s < a ? 'G' : s < b ? 'Y' : 'R') : (s >= c && s < d ? 'G' : s >= d && s < e ? 'Y' : 'R'); };
  const left = (L, t) => { const { s, gNS, gEW } = phase(L, t); return (L.ns ? gNS + Y : gNS + 2 * Y + R + gEW) - s; };   // (rules.js phaseLeft: s until its red, while green or yellow)
  const walkOn = (Ln, bd, t) => { if (!bd.walk) return false; const { s, gNS, gEW } = phase(Ln, t), c = gNS + Y + R; return bd.ns ? s >= c && s < c + gEW - FL : s < gNS - FL; };
  const idm = (v, v0, gap) => { const ss = C.s0 + Math.max(0, v * C.T), inter = (ss / Math.max(.05, gap)) ** 2; return (v > v0 ? -Math.min(C.b * 1.5, (v - v0) * 2) : A * (1 - (v / Math.max(.1, v0)) ** 4)) - A * inter; };
  const idmStop = (v, gap) => { const g = Math.max(.02, gap), ss = Math.max(0, v * C.T * .5 + v * v / (2 * sq)) + .1; return A * (1 - (ss / g) ** 2) - (v > 0 && g < .3 ? C.bMax : 0); };
  const tReach = (v, D, a, vm) => { if (D <= 0) return 0; vm = Math.max(vm, v, .5); if (v >= vm - .01) return D / vm; const t1 = (vm - v) / a, d1 = v * t1 + a * t1 * t1 / 2; return d1 >= D ? (Math.sqrt(v * v + 2 * a * D) - v) / a : t1 + (D - d1) / vm; };
  const last = links.length - 1, lines = []; let i = 0, s = o.s0, v = o.v || 0, t = o.t0, go = false, yd, stood = 0, held = null;
  const enterLane = k => { const L = links[k]; go = !L.sig && k < last; yd = undefined; };
  enterLane(0);
  for (let n = 0; n < 40000; n++) { if (o.until !== undefined && t >= o.until) return { T: null, at: { i, s, v, t }, stood, lines };
    t += h; const L = links[i]; let v0 = L.kind === 'lane' ? L.v0 * dv : L.v0 * Math.min(1.05, dv), acc = idm(v, v0, 1e9), lim = 1e9;
    if (L.kind === 'lane') { const dist = L.len - s, cn = i < last ? links[i + 1] : null;
      if (cn && !(go && L.sig && light(L, t) !== 'G')) { const vt = cn.v0 * Math.min(1.05, dv); v0 = Math.min(v0, Math.sqrt(vt * vt + 2 * C.turnBrake * Math.max(0, dist - 1))); acc = Math.min(acc, idm(v, v0, 1e9)); }
      if (!cn) { acc = Math.min(acc, idmStop(v, dist)); lim = Math.min(lim, Math.max(0, dist - .05)); }
      else if (L.sig) { const lt = light(L, t), bm = v * v / (2 * C.bMax);
        if (go && lt === 'R' && dist >= bm - .05) go = false;
        const late = lt !== 'R' && !cn.turn && !!cn.bOut && tReach(v, dist + cn.bOut.s1 + Math.max(0, C.len - C.body), .7 * A, cn.v0 * Math.min(1.05, dv)) > left(L, t) + R - .3;
        if (lt === 'G') yd = undefined; else if (lt === 'Y' && yd === undefined) { yd = (!cn.turn ? !late : v > 2 && dist / v < left(L, t) - .15) || dist < bm; if (!yd) go = false; }
        if (go && lt === 'Y' && dist / Math.max(.1, v) > left(L, t) - .05 && dist >= bm - .05) { go = false; yd = false; }
        if (go && late && dist >= v * v / (2 * (lt === 'G' ? C.bStop : C.bMax)) - .05) { go = false; if (lt === 'Y') yd = false; }
        if (!go) { const ok = (lt === 'G' || (lt === 'Y' && yd)) && !late; if (ok && (dist < Math.max(3, v * 1.6 + 2) || lt === 'Y')) go = true; if (!ok) { acc = Math.min(acc, idmStop(v, dist)); lim = Math.min(lim, Math.max(0, dist - .02)); } }
        const bI = cn.bIn, bO = cn.bOut; let g = 1e9;
        if (bO && cn.turn && walkOn(L, bO, t)) g = Math.min(g, bO.s0 - .05 >= (bI ? bI.s1 : 0) + Math.max(0, C.len - C.body) + .1 ? dist + bO.s0 - .2 : dist - .02);
        if (g < 30 && !(go && dist < .3 && v > 2)) { acc = Math.min(acc, idmStop(v, g)); lim = Math.min(lim, Math.max(0, g)); } }
      if (i === last) { const g = o.s1 - s; acc = Math.min(acc, idmStop(v, Math.max(.02, g))); lim = Math.min(lim, Math.max(0, g)); if (g < .8 && v < .4) return { T: t - o.t0, stood, lines }; } }
    else { const Ln = links[i - 1]; for (const bd of L.bands) { if (s > bd.s0 - .01) continue; if (L.turn && Ln?.cyc && walkOn(Ln, bd, t)) { const g = bd.s0 - s - .05; acc = Math.min(acc, idmStop(v, g)); lim = Math.min(lim, Math.max(0, g)); } } }
    let v1 = Math.max(0, v + acc * h), ds = Math.max(0, (v + v1) / 2 * h); if (ds > lim) { ds = lim; v1 = Math.min(v1, ds / h); }
    if (v1 < .3) { stood += h; if (!held && links[i].kind === 'lane' && links[i].sig) held = { at: i, t }; } else if (held) { lines.push({ at: held.at, wait: +(t - held.t).toFixed(2) }); held = null; }
    v = v1; s += ds;
    while (s >= links[i].len && i < last) { s -= links[i].len; i++; if (links[i].kind === 'lane') enterLane(i); } }
  return { T: Infinity, stood, lines };
}

// a small binary heap of [cost, index]
function heap() { const H = [];
  return { get size() { return H.length; },
    push(c, i) { H.push([c, i]); let k = H.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; [H[p], H[k]] = [H[k], H[p]]; k = p; } },
    pop() { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; for (let k = 0; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === k) break; [H[m], H[k]] = [H[k], H[m]]; k = m; } } return top; } }; }

export function createTravel(W) {
  const MODE = W.modes, TM = W.transit.timing, r2 = v => Math.round(v * 100) / 100;
  // ── the sidewalk graph (pedsim.js, one-way rings: the walkers' own graph, by its own edge ids)
  const wg = W.graph.walk, nW = wg.xz.length / 2, WX = i => wg.xz[2 * i], WZ = i => wg.xz[2 * i + 1];
  // (outW[n]: [edge, to]. OPEN RINGS (2026-10-09): an edge with wg.both[e] — outside the one-way rings' strongly connected core: a block
  // ring the sea or the woods leaves open, so pedsim's walkers keep no loop there — is walked either way by a trip. An export without
  // `both` walks every edge one way, as before)
  const nE = wg.edges.length / 3, eA = new Int32Array(nE), eB = new Int32Array(nE), eL = new Float64Array(nE), outW = Array.from({ length: nW }, () => []);
  for (let e = 0; e < nE; e++) { eA[e] = wg.edges[3 * e]; eB[e] = wg.edges[3 * e + 1]; eL[e] = wg.edges[3 * e + 2]; outW[eA[e]].push([e, eB[e]]); }
  if (wg.both) for (let e = 0; e < nE; e++) if (wg.both[e]) outW[eB[e]].push([e, eA[e]]);
  // the road edge (bike, scooter): the same kerb lines ridden BOTH ways (a bike at the kerb isn't bound by the walkers' one-way rings or
  // the cars' one-way streets), so its metres are the street grid's own; one undirected entry per edge pair
  const outU = Array.from({ length: nW }, () => []); for (let e = 0; e < nE; e++) { outU[eA[e]].push([e, eB[e]]); outU[eB[e]].push([e, eA[e]]); }
  // ── the road graph (traffic/sim.js lanes + connectors, by their own link ids)
  const rg = W.graph.road, nL = rg.lanes.length / 6, lane = i => ({ id: rg.lanes[6 * i], x0: rg.lanes[6 * i + 1], z0: rg.lanes[6 * i + 2], ux: rg.lanes[6 * i + 3], uz: rg.lanes[6 * i + 4], len: rg.lanes[6 * i + 5] });
  const L = Array.from({ length: nL }, (_, i) => lane(i)), nC = rg.conns.length / 6, outR = Array.from({ length: nL }, () => []);
  const C = Array.from({ length: nC }, (_, c) => ({ id: rg.conns[6 * c], a: rg.conns[6 * c + 1], b: rg.conns[6 * c + 2], len: rg.conns[6 * c + 3], mx: rg.conns[6 * c + 4], mz: rg.conns[6 * c + 5] }));
  for (let c = 0; c < nC; c++) outR[C[c].a].push(c);
  // TRANSIT SYNC (2026-10-08): a turn costs graph.road.turnM metres in the road choice (not in the metres: `dist` stays real). Without it
  // the search had no reason to prefer an L to a staircase of equal metres, and a cab zigzagged round every block. An old export without
  // turnM routes as before.
  const TURN_M = rg.turnM || 0, turnC = new Uint8Array(nC); for (let c = 0; c < nC; c++) { const a = L[C[c].a], b = L[C[c].b]; turnC[c] = a.ux * b.ux + a.uz * b.uz < .5 ? 1 : 0; }
  // ── nodes: every id the export knows, with its point and its attachments (w: sidewalk [edge, s, d], r: road [lane, s, d])
  const AT = W.attach, POS = new Map();
  for (const k of ['places', 'lots', 'apartments']) for (const p of W[k] || []) POS.set(p.id, [p.x, p.z]);
  for (const s of W.transit.stations.concat(W.transit.stops)) POS.set(s.id, [s.x, s.z]);
  const LINE = new Map(W.transit.lines.map(l => [l.id, l]));
  const STOP_LINES = new Map(); for (const l of W.transit.lines) for (const s of l.stops) { if (!STOP_LINES.has(s)) STOP_LINES.set(s, []); STOP_LINES.get(s).push(l.id); }

  // attachments of an id or a raw point (computed like the export does: nearest sidewalk sides / lanes)
  const near = new Map();
  function attachOf(q) { if (typeof q === 'string') { const a = AT[q]; if (!a) throw new Error(`travel: unknown node ${q}`); return { id: q, x: POS.get(q)[0], z: POS.get(q)[1], w: a.w, r: a.r }; }
    const key = q[0].toFixed(2) + ',' + q[1].toFixed(2); if (near.has(key)) return near.get(key); const o = { id: 'pt:' + key, x: q[0], z: q[1], ...attachPoint(q[0], q[1]) }; near.set(key, o); return o; }
  function attachPoint(x, z) {
    const w = [], r = [];
    for (let e = 0; e < nE; e++) { if (!wg.side[e]) continue; const ax = WX(eA[e]), az = WZ(eA[e]), len = eL[e], m = Math.min(2.1, len / 2), ux = (WX(eB[e]) - ax) / len, uz = (WZ(eB[e]) - az) / len;
      const s = Math.max(m, Math.min(len - m, (x - ax) * ux + (z - az) * uz)); w.push([e, r2(s), r2(Math.hypot(ax + ux * s - x, az + uz * s - z))]); }
    for (let i = 0; i < nL; i++) { if (!rg.live[i]) continue; const l = L[i], s = Math.max(.5, Math.min(l.len - .5, (x - l.x0) * l.ux + (z - l.z0) * l.uz)); r.push([i, r2(s), r2(Math.hypot(l.x0 + l.ux * s - x, l.z0 + l.uz * s - z))]); }
    const pick = (a, slack, n) => { a.sort((p, q) => p[2] - q[2] || p[0] - q[0]); return a.filter(c => c[2] <= a[0][2] + slack).slice(0, n); };
    return { w: pick(w, 6, 3), r: pick(r, 10, 4) }; }

  // ── shortest paths from one attachment, cached: walk → dist to every node; road → dist to every lane's start
  const cacheW = new Map(), cacheR = new Map(), cacheU = new Map(), CAP = 4000;
  function fromWalk(c) { const k = c[0] + ':' + c[1]; let R = cacheW.get(k); if (R) return R; if (cacheW.size > CAP) cacheW.clear();
    // (the first stretch may run either way along its side: a step against the ring to the nearer corner; the rest keeps the ring)
    // (prev: the node each one is reached from — an open ring's edge may be walked backwards)
    const dist = new Float64Array(nW).fill(Infinity), prev = new Int32Array(nW).fill(-1), H = heap(), a = eA[c[0]], b = eB[c[0]]; dist[b] = eL[c[0]] - c[1]; dist[a] = Math.min(dist[a], c[1]); H.push(dist[b], b); H.push(dist[a], a);
    while (H.size) { const [d, n] = H.pop(); if (d > dist[n]) continue; for (const [e, t] of outW[n]) { const nd = d + eL[e]; if (nd < dist[t]) { dist[t] = nd; prev[t] = n; H.push(nd, t); } } }
    cacheW.set(k, R = { dist, prev }); return R; }
  // (cost: the metres + TURN_M a turn; `dist` is always the real metres)
  function fromRoad(c) { const k = c[0] + ':' + c[1]; let R = cacheR.get(k); if (R) return R; if (cacheR.size > CAP) cacheR.clear();
    const cost = new Float64Array(nL).fill(Infinity), dist = new Float64Array(nL).fill(Infinity), prev = new Int32Array(nL).fill(-1), H = heap(), l0 = L[c[0]];
    for (const ci of outR[c[0]]) { const t = C[ci].b, dm = l0.len - c[1] + C[ci].len, nd = dm + TURN_M * turnC[ci]; if (nd < cost[t]) { cost[t] = nd; dist[t] = dm; prev[t] = ci; H.push(nd, t); } }
    while (H.size) { const [d, n] = H.pop(); if (d > cost[n]) continue; for (const ci of outR[n]) { const t = C[ci].b, nd = d + L[n].len + C[ci].len + TURN_M * turnC[ci]; if (nd < cost[t]) { cost[t] = nd; dist[t] = dist[n] + L[n].len + C[ci].len; prev[t] = ci; H.push(nd, t); } } }
    cacheR.set(k, R = { dist, prev }); return R; }
  function fromEdgeU(c) { const k = c[0] + ':' + c[1]; let R = cacheU.get(k); if (R) return R; if (cacheU.size > CAP) cacheU.clear();
    const dist = new Float64Array(nW).fill(Infinity), prev = new Int32Array(nW).fill(-1), H = heap(), a = eA[c[0]], b = eB[c[0]]; dist[b] = eL[c[0]] - c[1]; dist[a] = Math.min(dist[a], c[1]); H.push(dist[b], b); H.push(dist[a], a);
    while (H.size) { const [d, n] = H.pop(); if (d > dist[n]) continue; for (const [e, t] of outU[n]) { const nd = d + eL[e]; if (nd < dist[t]) { dist[t] = nd; prev[t] = e; H.push(nd, t); } } }
    cacheU.set(k, R = { dist, prev }); return R; }
  // the best ride on the road edge (both ways) by time at speed v, the door walks at walk speed → { m: ride metres, wa, wb, a, b }
  function edgeBest(A, B, v) { let best = { t: Infinity };
    for (const a of A.w) { const R = fromEdgeU(a), wa = access(a[2]);
      for (const b of B.w) { const m = a[0] === b[0] ? Math.abs(b[1] - a[1]) : Math.min(R.dist[eA[b[0]]] + b[1], R.dist[eB[b[0]]] + eL[b[0]] - b[1]);
        if (!(m < Infinity)) continue; const wb = access(b[2]), t = (wa + wb) / MODE.walk.speed + m / v; if (t < best.t) best = { t, m, wa, wb, a, b }; } }
    return best.t < Infinity ? best : null; }
  // the best walk between two attachment sets (metres incl. the access bits) → { m, a, b } (a, b: the candidates used)
  function walkBest(A, B) { let best = { m: Infinity, a: null, b: null };
    for (const a of A.w) { const R = fromWalk(a), da = access(a[2]);
      for (const b of B.w) { let m = a[0] === b[0] ? Math.abs(b[1] - a[1]) : Math.min(R.dist[eA[b[0]]] + b[1], R.dist[eB[b[0]]] + eL[b[0]] - b[1]);   // (and the last stretch either way)
        m += da + access(b[2]); if (m < best.m) best = { m, a, b }; } }
    return best; }
  // the best road ride (by time at speed v, the kerb walks at walk speed) → { m: ride metres, wa, wb: the kerb walks, a, b }
  function roadBest(A, B, v) { let best = { t: Infinity };
    for (const a of A.r) { const R = fromRoad(a), wa = access(a[2]);
      for (const b of B.r) { let m = Infinity; if (a[0] === b[0] && b[1] >= a[1]) m = b[1] - a[1]; else if (R.dist[b[0]] < Infinity) m = R.dist[b[0]] + b[1];
        if (m === Infinity) continue; const wb = access(b[2]), t = (wa + wb) / MODE.walk.speed + m / v; if (t < best.t) best = { t, m, wa, wb, a, b }; } }
    return best.t < Infinity ? best : null; }

  // ── walk metres between two named nodes (the transit itineraries need many: cached per pair)
  // (a node to itself is 0 m — SAME NODE, 2026-10-09: it was the access walk out to the graph and back, 119 m at LONG BRIDGE, put on every
  // transit trip that starts or ends at a stop or station)
  const wPair = new Map(), same = (p, q) => p === q || (Array.isArray(p) && Array.isArray(q) && p[0] === q[0] && p[1] === q[1]);
  const walkM = (p, q) => { if (same(p, q)) return 0; const k = (typeof p === 'string' ? p : p.join()) + '>' + (typeof q === 'string' ? q : q.join()); let v = wPair.get(k); if (v === undefined) { v = walkBest(attachOf(p), attachOf(q)).m; wPair.set(k, v); } return v; };

  // ── the lines: per direction, the cumulative run (real s from the first stop's departure) and metres, from the export
  const runOf = (lid, dir) => LINE.get(lid).dirs[dir].run;
  const waitExp = l => l.headwayMin * GAME_MIN / 2;   // the expected wait (real s): half a headway
  // the next departure (game min) of line l, direction dir, from stop index i at or after game minute T. The direction's own offset
  // (dirs[dir].offsetMin, 2026-10-08); an older export without it: the line's offsetMin, rev half a headway on
  const offsetOf = (l, dir) => LINE.get(l.id).dirs[dir].offsetMin ?? l.offsetMin + (dir === 'rev' ? l.headwayMin / 2 : 0);
  function nextDep(l, dir, i, T) { const off = offsetOf(l, dir) + runOf(l.id, dir)[i].dep / GAME_MIN;
    const k = Math.ceil((T - off) / l.headwayMin - 1e-9); return off + k * l.headwayMin; }
  // every ride a line offers from stop index i to j (i < j in direction dir): { m, s }
  const ride = (l, dir, i, j) => { const R = runOf(l.id, dir); return { m: R[j].m - R[i].m, s: R[j].arr - R[i].dep }; };
  const subways = () => W.transit.lines.filter(l => l.kind === 'subway');
  // subway station → station: same line, or one change where two lines meet (TM.transfer + the other line's expected wait)
  function subwayRides(s1, s2) { const out = [];
    for (const l of subways()) for (const dir of ['fwd', 'rev']) { const st = dir === 'fwd' ? l.stops : l.stops.slice().reverse(), i = st.indexOf(s1), j = st.indexOf(s2);
      if (i >= 0 && j > i) out.push({ s: ride(l, dir, i, j).s, m: ride(l, dir, i, j).m, legs: [{ l, dir, i, j }] }); }
    for (const l1 of subways()) for (const l2 of subways()) { if (l1 === l2) continue; for (const X of l1.stops) { if (!l2.stops.includes(X) || X === s1 || X === s2) continue;
      for (const d1 of ['fwd', 'rev']) for (const d2 of ['fwd', 'rev']) { const a = d1 === 'fwd' ? l1.stops : l1.stops.slice().reverse(), b = d2 === 'fwd' ? l2.stops : l2.stops.slice().reverse();
        const i = a.indexOf(s1), x1 = a.indexOf(X), x2 = b.indexOf(X), j = b.indexOf(s2); if (i < 0 || j < 0 || !(x1 > i) || !(j > x2)) continue;
        const r1 = ride(l1, d1, i, x1), rr = ride(l2, d2, x2, j); out.push({ s: r1.s + TM.transfer + waitExp(l2) + rr.s, m: r1.m + rr.m, legs: [{ l: l1, dir: d1, i, j: x1 }, { l: l2, dir: d2, i: x2, j, X }] }); } } }
    return out; }

  // ── the best of one mode between two nodes → { m, s, fare, plan } (plan: what trip() expands into legs), or null
  // a taxi ride's real seconds: measured (the export's taxi mode: t0 + metres / speed + sig × the signalled junctions passed, tools/
  // transit-measure.mjs) when the export has the fit, else metres / speed. The junctions are counted along the ride's own road path.
  const SIG = rg.sig || null, TX = MODE.taxi;
  // (MOVEMENT REVIEW #10: a drop BEHIND the pickup on one lane is the loop round the block — the walk back along the prev links runs at
  // least once, a do-while: it used to stop at once, the lane being its own start, and drew and drove 2 points backwards)
  function sigsOn(r) { if (!SIG || (r.a[0] === r.b[0] && r.b[1] >= r.a[1])) return 0; const R = fromRoad(r.a); let n = 0; for (let k = r.b[0], g = 0; (!g || k !== r.a[0]) && g < 4000; g++) { const ci = R.prev[k]; if (ci < 0) break; if (SIG[ci]) n++; k = C[ci].a; } return n; }
  // TAXI CLOCK (2026-10-09) · a ride booked from the cab's DRIVE (MOVEMENT.md §5: the export's modes.taxi.drive): the ride's road path as
  // pieces { len, v } — each lane at its car speed (graph.road.v0), each connector at the car's speed through it (graph.road.cv: a turn's
  // √(latA · r), a straight one the slower of its two lanes) — driven from rest at the pickup to rest at the drop (driveProfile, below:
  // the same function the city's cab is driven with, traffic/cabs.js), + the drive's `out` s to get out at the kerb.
  const LV = rg.v0 || null, CV = rg.cv || null, TXD = TX.drive && LV && CV ? TX.drive : null;
  // (TAXI_DRIVE's brisk cab: a lane and a straight connector × k, a turn × kT)
  function roadSegs(r) { const a = r.a, b = r.b, k = TXD.k ?? 1, kT = TXD.kT ?? k; if (a[0] === b[0] && b[1] >= a[1]) return [{ len: b[1] - a[1], v: LV[a[0]] * k }];
    const R = fromRoad(a), out = [{ len: b[1], v: LV[b[0]] * k }]; for (let n = b[0], g = 0; (!g || n !== a[0]) && g < 4000; g++) { const ci = R.prev[n]; if (ci < 0) break; const c = C[ci];
      out.push({ len: C[ci].len, v: CV[ci] * (turnC[ci] ? kT : k) }, { len: c.a === a[0] ? L[c.a].len - a[1] : L[c.a].len, v: LV[c.a] * k }); n = c.a; }
    return out.reverse().filter(g => g.len > 1e-6); }
  // CAB TRAFFIC (2026-10-10) · an export that carries the lights (graph.road.sigc: each connector's junction cycle; graph.road.bands: the
  // zebras it crosses; graph.road.signal: the cycle's yellow, all-red and flash; modes.taxi.drive.car: the city's car) books a ride as the
  // city's car drives it alone through the fixed-time lights from its departure second (carDrive, above) + drive.out s to get out; a ride
  // from a stand + drive.pull s (out of its kerb slot back into the lane). With no departure second (best(): the menus, the dense table)
  // it is the mean over drive.phases departures across the 44 s cycle (the lights repeat every 44 s). An older export books as before.
  const SIGC = rg.sigc || null, BANDS = rg.bands || null, SIGT = rg.signal || null, TXC = TXD?.car && SIGC && BANDS && SIGT ? TXD : null;
  const laneOut = new Int32Array(nL).fill(-1); for (let c = 0; c < nC; c++) if (laneOut[C[c].a] < 0 || (SIG && SIG[c])) laneOut[C[c].a] = c;
  const bandOf = (c, k) => { const q = BANDS[6 * c + 3 * k + 2]; return q < 0 ? null : { s0: BANDS[6 * c + 3 * k], s1: BANDS[6 * c + 3 * k + 1], ns: !!(q & 1), walk: !!(q & 2) }; };
  const LREC = new Map(), CREC = new Map();
  const laneRec = i => { let o = LREC.get(i); if (o) return o; const c = laneOut[i], sg = c >= 0 && !!SIG?.[c];
    LREC.set(i, o = { kind: 'lane', i, len: L[i].len, v0: LV[i], sig: sg, ns: Math.abs(L[i].uz) > .5, cyc: sg ? [SIGC[3 * c], SIGC[3 * c + 1], SIGC[3 * c + 2]] : null }); return o; };
  const connRec = c => { let o = CREC.get(c); if (o) return o; const bIn = bandOf(c, 0), bOut = bandOf(c, 1);
    CREC.set(c, o = { kind: 'conn', c, len: C[c].len, v0: CV[c], turn: !!turnC[c], bIn, bOut, bands: [bIn, bOut].filter(Boolean) }); return o; };
  // the ride's links, pickup lane to drop lane, as carDrive reads them → { links, s0, s1 }
  function rideLinks(r) { const a = r.a, b = r.b; if (a[0] === b[0] && b[1] >= a[1]) return { links: [laneRec(a[0])], s0: a[1], s1: b[1] };
    const R = fromRoad(a), seq = [laneRec(b[0])]; for (let n = b[0], g = 0; (!g || n !== a[0]) && g < 4000; g++) { const ci = R.prev[n]; if (ci < 0) break; seq.push(connRec(ci), laneRec(C[ci].a)); n = C[ci].a; }
    return { links: seq.reverse(), s0: a[1], s1: b[1] }; }
  // the drive alone, from its departure second t0 (signal clock: real s, game minute × 2.5) → s to rest at the drop
  const DRV = new Map();
  function driveAt(r, t0) { const q = rideLinks(r); return carDrive(q.links, { s0: q.s0, s1: q.s1, t0, v: 0, car: TXC.car, sig: SIGT, step: TXC.step }).T; }
  function driveMean(r) { const k = r.a.join() + '>' + r.b.join(); let v = DRV.get(k); if (v !== undefined) return v; if (DRV.size > 20000) DRV.clear();
    const n = TXC.phases || 8, per = SIGT.len || 44; let sum = 0; for (let j = 0; j < n; j++) sum += driveAt(r, j * per / n); DRV.set(k, v = sum / n); return v; }
  // a taxi ride's real s (the drive + getting out, + the pull out of a stand's slot); t0: the departure second (undefined: the expected)
  const pullOf = stand => stand && TXC ? (TXC.pull || 0) : 0;
  // CAB FOLLOW-UP (2026-10-10) · THE DROP AT THE KERB: where the drop lane has a kerb lane on its right (graph.road.kerb: an avenue's, a
  // one-way's parking side) and the rider's door — the destination — is on that side, the cab pulls in to the kerb there to let them out
  // (style/city/traffic/cabs.js), drive.pull s more (a cab alone on an empty road finds the kerb free)
  const KERB = rg.kerb || null, dropPull = (r, B) => { if (!TXC || !KERB || !(KERB[r.b[0]] > 0) || !B) return 0; const l = L[r.b[0]], px = l.x0 + l.ux * r.b[1], pz = l.z0 + l.uz * r.b[1];
    return (B.x - px) * -l.uz + (B.z - pz) * l.ux > .3 ? (TXC.pull || 0) : 0; };
  const taxiS = (r, t0, stand, B) => { if (TXC) return (t0 === undefined ? driveMean(r) : driveAt(r, t0 + pullOf(stand))) + TXC.out + pullOf(stand) + dropPull(r, B);
    if (TXD) { const T = driveProfile(roadSegs(r), TXD.a, TXD.b).T; return T + TXD.out + slackOf(r, T); }
    return TX.t0 !== undefined ? TX.t0 + r.m / TX.speed + (TX.sig || 0) * sigsOn(r) : r.m / TX.speed; };
  // TAXI SLACK (2026-10-09, traffic research #1 A; an older export's 'drive' booking only): drive.slack = { sig: s per signalled junction the
  // ride passes, share: × the drive } (none in an export without it)
  const slackOf = (r, T) => TXD.slack ? (TXD.slack.sig || 0) * sigsOn(r) + (TXD.slack.share || 0) * T : 0;
  const fareOf = (mode, rideM, night) => mode === 'taxi' ? Math.round((MODE.taxi.base + MODE.taxi.per100 * rideM / 100) * (night ? MODE.taxi.night : 1) * 10) / 10 : (MODE[mode].fare || 0);
  // SUBWAY PLAN (2026-10-09) · a ride's fare is the HIGHEST fare of the lines it uses (one fare a trip, a change included): a line's own
  // `fare`, else the mode's (modes.subway.fare) — a local only 1 cr, anything that touches TIDE or NEON 2 cr
  const rideFare = legs => Math.max(...legs.map(x => x.l.fare ?? fareOf('subway')));
  function best(p, q, mode, opt = {}) {
    if (same(p, q)) return { m: 0, s: 0, fare: 0, plan: { kind: 'none' } };
    const A = attachOf(p), B = attachOf(q), vw = MODE.walk.speed * (opt.walkMul || 1);
    if (mode === 'walk' || mode === 'skate') { const w = walkBest(A, B); if (w.m === Infinity) return null; const v = mode === 'walk' ? vw : MODE.skate.speed;
      return { m: w.m, s: w.m / v, fare: 0, plan: { kind: mode, w } }; }
    if (mode === 'bike' || mode === 'scooter' || mode === 'taxi') { const v = MODE[mode].speed;
      if (mode !== 'taxi') { const r = edgeBest(A, B, v); if (!r) return null; return { m: r.wa + r.m + r.wb, s: (r.wa + r.wb) / vw + r.m / v, fare: 0, plan: { kind: mode, r, edge: true } }; }
      // a taxi: hailed at the kerb, or from a stand (walk there, a short wait)
      let bestT = null; const r0 = roadBest(A, B, v); if (r0) bestT = { m: r0.wa + r0.m + r0.wb, s: (r0.wa + r0.wb) / vw + taxiS(r0, undefined, false, B) + TM.taxiHailWait, ride: r0.m, plan: { kind: 'taxi', r: r0, hail: true } };
      for (const st of W.transit.taxiStands) { if (st === p) continue; const S = attachOf(st), wm = walkBest(A, S).m, r = roadBest(S, B, v); if (!r || wm === Infinity) continue;
        const s = wm / vw + TM.taxiStandWait + r.wa / vw + taxiS(r, undefined, true, B) + r.wb / vw; if (!bestT || s < bestT.s) bestT = { m: wm + r.wa + r.m + r.wb, s, ride: r.m, plan: { kind: 'taxi', r, stand: st, wm } }; }
      if (!bestT) return null; return { m: bestT.m, s: bestT.s, fare: fareOf('taxi', bestT.ride, opt.night), plan: bestT.plan }; }
    if (mode === 'subway') { let b = null; const S = W.transit.stations.map(s => s.id), w1s = new Map(S.map(s => [s, walkM(p, s)])), w2s = new Map(S.map(s => [s, walkM(s, q)]));
      for (const s1 of S) for (const s2 of S) { if (s1 === s2) continue; const w1 = w1s.get(s1), w2 = w2s.get(s2); if (w1 === Infinity || w2 === Infinity) continue;
        for (const r of subwayRides(s1, s2)) { const s = (w1 + w2) / vw + 2 * TM.stairs + waitExp(r.legs[0].l) + r.s;
          if (!b || s < b.s) b = { m: w1 + r.m + w2, s, fare: rideFare(r.legs), plan: { kind: 'subway', from: s1, to: s2, rides: r.legs } }; } }
      return b; }
    throw new Error(`travel: unknown mode ${mode}`); }

  // ── geometry for a trip's legs
  const lanePt = (i, s) => [r2(L[i].x0 + L[i].ux * s), r2(L[i].z0 + L[i].uz * s)];
  const edgePt = (e, s) => { const a = eA[e], b = eB[e], f = s / eL[e]; return [r2(WX(a) + (WX(b) - WX(a)) * f), r2(WZ(a) + (WZ(b) - WZ(a)) * f)]; };
  // MOVEMENT REVIEW #1 (2026-10-09) · A WALK ENDS ON THE WALKERS' GRAPH. An id's attachment [edge, s, d, in] carries `in` (tools/export-
  // world.mjs): 1 when the straight stretch from the id's own point to that sidewalk point stays off the roads and the sea (a lot's door, an
  // apartment's stoop, a compound's interior: the trailer park's lots, the mall's yard), 0 when it doesn't — a corner's point is its
  // junction's centre; the labs and the woods are over a road and through the trees; the jail is over the bridge and the sea — or the id is
  // an indoor place (in at the sidewalk). A stretch with in 0 isn't drawn: the walk starts or ends at its sidewalk point and the leg says how
  // many of its booked metres were left out at each end (`off: [start, end]`; simstate/movement.js walks the drawn part at the booked
  // pace and keeps a long one — the labs, the jail — out of view). The booked metres and minutes are walkBest's, as ever: only the drawing
  // changed. (An export without the flag draws every stretch, as before. A raw [x, z] point's has none either.)
  const drawn = c => c[3] !== 0;
  function walkPath(A, B, w, a = w.a, b = w.b) { const pts = drawn(a) ? [[A.x, A.z], edgePt(a[0], a[1])] : [edgePt(a[0], a[1])];
    if (a[0] !== b[0]) { const R = fromWalk(a), end = R.dist[eA[b[0]]] + b[1] <= R.dist[eB[b[0]]] + eL[b[0]] - b[1] ? eA[b[0]] : eB[b[0]], mid = [];
      for (let n = end; ;) { mid.push([WX(n), WZ(n)]); const p = R.prev[n]; if (p < 0) break; n = p; } pts.push(...mid.reverse()); }
    pts.push(edgePt(b[0], b[1])); if (drawn(b)) pts.push([B.x, B.z]); return pts; }
  // a walk leg's geometry: the path drawn along the booked walk w and the booked metres it leaves out (the access stretch at an end that
  // isn't drawn)
  const offLeg = o => o[0] || o[1] ? { off: o } : {};
  const walkGeo = (A, B, w) => ({ path: walkPath(A, B, w), ...offLeg([drawn(w.a) ? 0 : r2(access(w.a[2])), drawn(w.b) ? 0 : r2(access(w.b[2]))]) });
  const KERB_W = 8;   // m: a taxi's or a bike's door walk ends at its sidewalk point only within this of the kerb (doorPt)
  function edgePath(r) { const a = r.a, b = r.b, pts = [edgePt(a[0], a[1])];
    if (a[0] !== b[0]) { const R = fromEdgeU(a), viaA = R.dist[eA[b[0]]] + b[1] <= R.dist[eB[b[0]]] + eL[b[0]] - b[1], end = viaA ? eA[b[0]] : eB[b[0]], mid = [];
      for (let n = end; ;) { mid.push([WX(n), WZ(n)]); const e = R.prev[n]; if (e < 0) break; n = eA[e] === n ? eB[e] : eA[e]; } pts.push(...mid.reverse()); }
    pts.push(edgePt(b[0], b[1])); return pts; }
  function roadPath(r) { const a = r.a, b = r.b, pts = [lanePt(a[0], a[1])];
    if (!(a[0] === b[0] && b[1] >= a[1])) { const R = fromRoad(a), mid = []; for (let n = b[0], g = 0; (!g || n !== a[0]) && g < 4000; g++) { const ci = R.prev[n]; if (ci < 0) break; const c = C[ci];
        mid.push(lanePt(n, 0), [r2(c.mx), r2(c.mz)], lanePt(c.a, L[c.a].len)); n = c.a; } pts.push(...mid.reverse()); }
    pts.push(lanePt(b[0], b[1])); return pts; }
  const lineRef = (l, dir) => l.dirs[dir];

  // ── a trip in MOVEMENT.md §3's shape. opt.dep: game minute it leaves (default 0); waits follow the timetable from there.
  function trip(p, q, mode, opt = {}) {
    const B0 = best(p, q, mode, opt); if (!B0) return null; const A = attachOf(p), B = attachOf(q), vw = MODE.walk.speed * (opt.walkMul || 1), P = B0.plan;
    const idOf = o => typeof o === 'string' ? o : o.id, legs = []; let t = opt.dep ?? 0; const dep = t;
    const leg = (kind, from, to, sec, extra = {}) => { const L0 = { kind, from, to, dep: +t.toFixed(3), arr: +(t + sec / GAME_MIN).toFixed(3), ...extra }; t = L0.arr; legs.push(L0); return L0; };
    const walkLeg = (from, to, kind = 'walk', v = vw) => { if (same(from, to)) return null; const X = attachOf(from), Y = attachOf(to), w = walkBest(X, Y); if (!(w.m > 0)) return null;
      return leg(kind, idOf(from), idOf(to), w.m / v, { m: r2(w.m), ...walkGeo(X, Y, w) }); };
    // (a taxi's or a bike's walk to and from the kerb, straight: from the id's own point when its stretch is drawn, else from its sidewalk
    // point — or no drawn walk at all when that is over KERB_W from the kerb: the labs, the jail)
    const doorPt = (X, k, c) => { const n = c || X.w?.[0]; if (!n || drawn(n)) return [X.x, X.z]; const q = edgePt(n[0], n[1]); return Math.hypot(q[0] - k[0], q[1] - k[1]) <= KERB_W ? q : k; };
    const kerbWalk = (m, a, b, door) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), left = r2(Math.max(0, m - len)); return { path: [a, b], ...offLeg(door === 0 ? [left, 0] : door === 1 ? [0, left] : [0, 0]) }; };
    const kerb = (o, c) => ({ id: 'kerb:' + idOf(o), pt: lanePt(c[0], c[1]) });
    if (P.kind === 'walk' || P.kind === 'skate') leg(P.kind, idOf(p), idOf(q), B0.s, { m: r2(B0.m), ...walkGeo(A, B, P.w) });
    else if (P.kind === 'bike' || P.kind === 'scooter' || P.kind === 'taxi') {
      let from = p, X = A, r = P.r;
      if (P.kind === 'taxi' && P.stand) { walkLeg(p, P.stand); from = P.stand; X = attachOf(P.stand); }
      const k1 = P.edge ? { id: 'kerb:' + idOf(from), pt: edgePt(r.a[0], r.a[1]) } : kerb(from, r.a), k2 = P.edge ? { id: 'kerb:' + idOf(q), pt: edgePt(r.b[0], r.b[1]) } : kerb(q, r.b);
      if (r.wa > 0) { const d0 = doorPt(X, k1.pt, P.edge ? r.a : null); leg('walk', idOf(from), k1.id, r.wa / vw, { m: r2(r.wa), ...kerbWalk(r.wa, d0, k1.pt, d0[0] === X.x && d0[1] === X.z ? -1 : 0) }); }
      if (P.kind === 'taxi') leg('wait', k1.id, k1.id, P.stand ? TM.taxiStandWait : TM.taxiHailWait, { at: k1.pt });
      leg(P.kind, k1.id, k2.id, P.kind === 'taxi' ? taxiS(r, opt.dep === undefined ? undefined : t * GAME_MIN, !!P.stand, B) : r.m / MODE[P.kind].speed, { m: r2(r.m), path: P.edge ? edgePath(r) : roadPath(r) });
      if (r.wb > 0) { const d1 = doorPt(B, k2.pt, P.edge ? r.b : null); leg('walk', k2.id, idOf(q), r.wb / vw, { m: r2(r.wb), ...kerbWalk(r.wb, k2.pt, d1, d1[0] === B.x && d1[1] === B.z ? -1 : 1) }); } }
    else if (P.kind === 'subway') { walkLeg(p, P.from); leg('stairs', P.from, P.from, TM.stairs, { dir: 'down' });
      P.rides.forEach((rd, k) => { const l = rd.l, st = rd.dir === 'fwd' ? l.stops : l.stops.slice().reverse(), at = st[rd.i];
        if (k) leg('wait', at, at, TM.transfer, { line: l.id, transfer: true });
        const T0 = nextDep(l, rd.dir, rd.i, t), wait = opt.dep === undefined ? waitExp(l) : (T0 - t) * GAME_MIN; if (wait > 0) leg('wait', at, at, wait, { line: l.id });
        const R = ride(l, rd.dir, rd.i, rd.j), D = lineRef(l, rd.dir); leg('subway', at, st[rd.j], R.s, { line: l.id, dir: rd.dir, m: r2(R.m), path: D.path.slice(D.run[rd.i].pt, D.run[rd.j].pt + 1) }); });
      leg('stairs', P.to, P.to, TM.stairs, { dir: 'up' }); walkLeg(P.to, q); }
    const m = legs.reduce((s, x) => s + (x.m || 0), 0);
    return { mode, from: idOf(p), to: idOf(q), dep, arr: +t.toFixed(3), fare: B0.fare, metres: r2(m), seconds: +((t - dep) * GAME_MIN).toFixed(2), legs }; }

  // the export's dense table
  const TT = W.travel, IX = TT ? new Map(TT.nodes.map((id, k) => [id, k])) : new Map();
  function matrix(p, q, mode) { const a = IX.get(p), b = IX.get(q); if (a === undefined || b === undefined) return null; const k = a * TT.nodes.length + b, m = TT.m[mode][k];
    return m === null ? null : { m, s: TT.s[mode][k], fare: TT.fare[mode][k] }; }
  return { best, trip, matrix, nextDep, taxiS, rideLinks: TXC ? rideLinks : null, attachOf, attachPoint, walkBest, roadBest, edgeBest, walkPath, roadPath, edgePath, fareOf, lines: LINE, stopLines: STOP_LINES, has: id => !!AT[id] };
}
