// RIDERS AVOID (2026-10-08) · THE RIDER PROBE, in-page half (tools/riderprobe.mjs loads it into ?audit=1&report=1&shot=1&blocks=0,0&walk=0).
// Sim movers — skate, bike and scooter legs and some walking ones, drawn by simstate/movement.js exactly as the page draws them
// (agents.js legTrip's few lines, below) — through the crowd (pedsim.js on the lanes the page walks: every block round each route built
// here with the audit on, as walkcheck.js does, so what a walker can run into is kept for the test). Fixed routes and seeds: a run is
// deterministic, so before and after are the same routes, the same clock and the same crowd seed.
//   mover–walker     a mover's centre closer than 0.6 m to a background walker's (onsets per minute, and the seconds spent so)
//   mover–mover      the same between two sim movers (both true sync: their weave is all that can part them)
//   mover–obstacle   walkcheck.js's test at the walker's size (audit.js walkBlockIn .24 / .37, its road rule): onsets and seconds
//   walker–obstacle  the crowd stepping aside must not step into anything: every background walker within 5 m of a mover, tested so
//   walker–walker    nor into each other: background pairs closer than 2 × PED.body within 5 m of a mover (as walkcheck.js counts)
//   tracks           each mover's path position (without the weave) at 10 Hz and every leg's last drawn point: before vs after must agree
import * as J from '../jobs.js';
import { MODS } from '../modules.js';
import { createPedSim, PED } from '../pedsim.js';
import { createMovement, GAME_MIN, MOVE } from '../simstate/movement.js';
import { walkBlockIn } from '../audit.js';
import { P } from '../plan.js';
import { sdata, remap, SPREAD } from '../../../world/city.js';   // (SPREAD: the data this spread reads; the scenarios' focus is today's metres, through remap)
import { slab } from '../ground.js';
import { SIDE } from '../style.js';
import { createTravel } from '../../../world/export/travel.mjs';
import { tuneWorld } from '../simstate/movetune.mjs';

export const SCN = {
  downtown: { focus: remap(16, -16), night: false, rush: { dist: 'downtown', mult: 2 }, R: 72, n: { skate: 12, bike: 7, scooter: 7, walk: 6 } },   // (at its busiest: a Director rush, 22 walkers per 100 m)
  residential: { focus: remap(32, 176), night: false, rush: null, R: 64, n: { skate: 8, bike: 5, scooter: 5, walk: 4 } },
  neon: { focus: remap(-32, 48), night: true, rush: null, R: 64, n: { skate: 10, bike: 6, scooter: 6, walk: 6 } },   // (Neon Row at night: 24.5 per 100 m)
};
const FLAGS = { neutral: true, pass2: true, faces: true, letters: 'new' };
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r3 = v => Math.round(v * 1000) / 1000;

export async function probe({ scenarios = Object.keys(SCN), seconds = 75, dt = 1 / 60, seed = 0x51ade, keepTracks = true, avoid = true, parts = 'all' } = {}) {
  MOVE.avoid = avoid !== false; PED.yieldOn = avoid !== false && (parts === 'all' || parts === 'yield'); MOVE.weaveOn = parts === 'all' || parts === 'weave';   // (avoid false: as before the riders-avoid work — the A/B in the same build; parts: geom · yield · weave · all)
  const room = avoid !== false ? await fetch(new URL(sdata('../simstate/room.json'), import.meta.url), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null) : null;
  const world = await (await fetch(new URL(sdata('../../../world/export/world.json'), import.meta.url), { cache: 'no-store' })).json(), T = createTravel(tuneWorld(world));
  const densityOf = d => MODS.kits.get(d)?.peds?.density ?? 1, out = {};
  for (const name of scenarios) out[name] = await one(name, SCN[name], { T, world, densityOf, seconds, dt, seed, keepTracks, room });
  return out;
}

let TRACE = null; const res0 = {};
async function one(name, sc, { T, world, densityOf, seconds, dt, seed, keepTracks, room }) {
  const [fx, fz] = sc.focus, t0 = performance.now(); TRACE = globalThis.__riderTrace || null; delete res0.trace;
  // ── the blocks round the routes, built here with the audit on (their lanes are the page's; snap: what a walker can run into)
  const own = new Map(), reach = sc.R + 40;
  for (let i = Math.floor((fx - reach) / P); i <= Math.floor((fx + reach) / P); i++) for (let j = Math.floor((fz - reach) / P); j <= Math.floor((fz + reach) / P); j++) {
    if (Math.hypot((i + .5) * P - fx, (j + .5) * P - fz) > reach) continue;
    let res = null; try { res = J.jobBlock({ i, j, night: sc.night, audit: true, chars: false, flags: FLAGS }); } catch (e) { continue; }
    if (res?.lanes) own.set(i + ',' + j, { i, j, lanes: res.lanes }); }
  const tBuild = performance.now() - t0;
  const sim = createPedSim({ night: sc.night, seed: seed ^ 0x9ed5, densityOf }); sim.looks = 24; for (const b of own.values()) sim.addLanes(b.i + ',' + b.j, b.lanes); if (room) sim.setRoom?.(room);
  if (sc.rush) sim.setDemand(null, sc.rush);
  const MV = createMovement({ peds: { sim }, log: () => {} });
  // ── the routes: from lots near the focus (their doors: the straight walk across the sidewalk) and from sidewalk points, 45–150 m
  let s32 = seed >>> 0; const rnd = () => { s32 = (Math.imul(s32 ^ (s32 >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s32 / 4294967296; };
  const lots = (world.lots || []).filter(l => T.has(l.id) && Math.hypot(l.x - fx, l.z - fz) < sc.R * .85).map(l => l.id);
  const sides = sim.edges.filter(E => !E.cross && !E.joint && E.len > 8 && Math.hypot((E.a.x + E.b.x) / 2 - fx, (E.a.z + E.b.z) / 2 - fz) < sc.R * .8 && own.has(E.i + ',' + E.j));
  const ptOf = () => { const E = sides[(rnd() * sides.length) | 0], s = 3 + rnd() * (E.len - 6), f = s / E.len; return [+(E.from.x + (E.to.x - E.from.x) * f).toFixed(2), +(E.from.z + (E.to.z - E.from.z) * f).toFixed(2)]; };
  const endOf = () => lots.length && rnd() < .4 ? lots[(rnd() * lots.length) | 0] : ptOf();
  const xz = p => typeof p === 'string' ? (() => { const a = T.attachOf(p); return [a.x, a.z]; })() : p;
  const list = []; for (const [mode, n] of Object.entries(sc.n)) for (let k = 0; k < n; k++) list.push(mode);
  for (let k = list.length - 1; k > 0; k--) { const q = (rnd() * (k + 1)) | 0; [list[k], list[q]] = [list[q], list[k]]; } const spread = Math.min(40, seconds * .55), movers = [];
  list.forEach((mode, k) => { for (let tries = 0; tries < 60; tries++) { const p = endOf(), q = endOf(), d = Math.hypot(xz(p)[0] - xz(q)[0], xz(p)[1] - xz(q)[1]); if (d < 45 || d > 150) continue;
      const dep = (1 + k * spread / list.length) / GAME_MIN; let tr = null; try { tr = T.trip(p, q, mode, { dep }); } catch { tr = null; } if (!tr || !tr.legs.some(l => l.kind === mode)) continue;
      movers.push({ id: `probe-${name}-${k}`, mode, trip: tr, a: { id: `probe-${name}-${k}`, look: 0 }, run: null, done: false, samples: [], ends: [], lastK: -1, last: null }); break; } });
  // ── the clock
  const EVN = {}, evN = k => (EVN[k] = (EVN[k] || 0) + 1) <= (k === 'mw' ? 4000 : 40);   // (the first 40 events of each kind; crowd hold: every mover–walker one, for where they happen)
  const steps = Math.round(seconds / dt), C = { mw: 0, mm: 0, mo: 0, wo: 0, ww: 0, mwS: 0, mmS: 0, moS: 0, woS: 0 }, ev = [], seen = { mw: new Set(), mo: new Set(), wo: new Set(), ww: new Set() }, stepMs = [], moveMs = [];
  let moverS = 0, crowdN = 0, crowdF = 0;
  const blockedAt = (x, y, z) => { const i = Math.floor(x / P), j = Math.floor(z / P), L = own.get(i + ',' + j)?.lanes; if (!L?.snap) return null; const s = slab(i, j), road = y < SIDE - .05;
    if (road ? (x < s.x0 - 1.5 || x > s.x1 + 1.5 || z < s.z0 - 1.5 || z > s.z1 + 1.5) : (x < s.x0 - .01 || x > s.x1 + .01 || z < s.z0 - .01 || z > s.z1 + .01)) return null;
    return walkBlockIn(L.snap, x, z, road ? [] : L.people, .24, .37, road ? 0 : SIDE); };
  const inOwn = (x, z) => own.has(Math.floor(x / P) + ',' + Math.floor(z / P));
  const pieceOf = m => { const R = m.run, G = R?.G?.[R.k], L = m.trip.legs[R?.k]; if (!G || !L) return '?'; if (G.plan) { const tau = (m.now - R.delay - L.dep) * GAME_MIN, p = G.plan.pieces.find(q => tau < q.t1) || G.plan.pieces[G.plan.pieces.length - 1]; return 'skate:' + p.kind; }
    const sg = G.segs[Math.min(G.k, G.segs.length - 1)]; return L.kind + ':' + (sg?.E ? (sg.E.cross ? 'crossing' : 'side') : 'straight'); };
  const segKind = m => { const R = m.run, G = R?.G?.[R.k]; if (!G) return '?'; const sg = G.segs[Math.min(G.k, G.segs.length - 1)], E = sg?.E; if (!E) return 'straight'; if (E.cross) return E.from.detour || E.to.detour ? 'cross-det' : 'cross'; if (E.joint) return 'joint';
    if (E.from.detour || E.to.detour) return 'side-det'; return 'side'; };   // (crowd hold: the stretch the mover is on, for why it could or couldn't weave)
  const grid = new Map(), cellKey = (x, z) => (Math.floor(x) + 4096) * 8192 + (Math.floor(z) + 4096);
  for (let f = 0; f < steps; f++) {
    const t = f * dt, now = t / GAME_MIN, tm = performance.now();
    MV.frame(now);
    for (const m of movers) { m.now = now; if (m.done) continue; if (!m.run) { if (now < m.trip.dep) continue; m.run = MV.run(m.a, m.trip); }
      const o = m.run.frame(now, dt, m.a);
      if (m.run.k !== m.lastK) { if (m.last && m.lastK >= 0) { const G = m.run.G[m.lastK], e = G && G.len ? MV.at(G, G.len, [0, 0, 0, 0]) : null; m.ends.push([m.lastK, r3(m.last.t), r3(e ? e[0] : m.last.x), r3(e ? e[2] : m.last.z)]); } m.lastK = m.run.k; }
      if (m.run.done) { if (m.a.w) { sim.removeAgent(m.a.id); m.a.w = null; } m.done = true; m.arrived = r3(t); continue; }
      if (!o.show) { if (m.a.w) { sim.removeAgent(m.a.id); m.a.w = null; } m.o = null; continue; }
      if (!m.a.w) { m.a.w = sim.putAgent({ id: m.a.id, look: 0, fix: [o.x, o.y, o.z, o.yaw] }); if (!m.a.w) continue; m.a.w.yawS = o.yaw; }
      const w = m.a.w; w.fix = [o.x, o.y, o.z, o.yaw]; w.vc = o.vc; w.mv = o.prop || o.clip || o.stand ? o : null;
      m.o = { x: o.x, y: o.base ?? o.y, z: o.z, bx: o.bx ?? o.x, bz: o.bz ?? o.z, mode: o.mode, vc: o.vc };
      m.last = { t, x: o.x, z: o.z };
      if (TRACE && m.id === TRACE[0] && t >= TRACE[1] && t <= TRACE[2]) { const R = m.run, G = R.G[R.k], sg = G?.segs?.[G.k]; (res0.trace ??= []).push([r3(t), r3(o.x), r3(o.z), r3(o.bx ?? o.x), r3(o.bz ?? o.z), segKind(m), sg?.E ? [sg.E.i, sg.E.j, sg.E.side || sg.E.key, r3(sg.s0), r3(sg.s1)] : null, R.wv ? [r3(R.wv.off), R.wv.has ? 1 : 0, r3(R.wv.lo), r3(R.wv.hi)] : null, r3(G?.bo ?? 0), o.clip, o.snap ? 1 : 0]); }
      if (f % 6 === 0) m.samples.push([r3(t), r3(m.o.bx), r3(m.o.bz)]); }
    moveMs.push(performance.now() - tm);
    if (f % Math.round(2 / dt) === 0) sim.populate({ x: fx, z: fz }, f === 0);
    sim.step(dt); stepMs.push(sim.stat.ms);
    for (const w of sim.walkers) sim.where(w);
    // ── the counts
    grid.clear(); for (const w of sim.walkers) { const k = cellKey(w.p[0], w.p[2]); let L = grid.get(k); if (!L) grid.set(k, L = []); L.push(w); }
    const act = movers.filter(m => m.o && !m.done && m.a.w && inOwn(m.o.x, m.o.z)), nowS = { mw: new Set(), mo: new Set(), wo: new Set(), ww: new Set() };
    if (act.length) moverS += dt * act.length;
    for (const m of act) { const { x, y, z } = m.o, cx = Math.floor(x), cz = Math.floor(z), near = [];
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) for (const w of grid.get((cx + a + 4096) * 8192 + (cz + b + 4096)) || []) { if (w === m.a.w) continue; const d = Math.hypot(w.p[0] - x, w.p[2] - z); if (d < 5) near.push(w);
        if (d < .6 && Math.abs(w.p[1] - y) < .5) { const mover = movers.find(q => q.a.w === w), key = mover ? [m.id, mover.id].sort().join('|') : m.id + '|' + w.id, kind = mover ? 'mm' : 'mw';
          if (nowS.mw.has(key)) continue; nowS.mw.add(key); C[kind + 'S'] += dt; if (!seen.mw.has(key)) { C[kind]++; if (evN(kind)) ev.push({ k: kind, t: r3(t), mode: m.mode, piece: pieceOf(m), d: r3(d), x: r3(x), z: r3(z), w: mover ? mover.mode : (w.E?.cross ? 'crossing' : w.E?.side || 'joint') + (w.vc < .05 ? ' standing' : ''), off: r3(m.run?.wv?.off ?? 0), has: !!m.run?.wv?.has, wdg: r3(w.dg || 0),
            ws: w.E ? r3(Math.min(w.s, w.E.len - w.s)) : null, wk: w.kx ? 1 : 0, wl: w.lat ? 1 : 0, wf: w.fix ? 1 : 0, sx: segKind(m), wlo: r3(m.run?.wv?.lo ?? 0), whi: r3(m.run?.wv?.hi ?? 0), wtg: r3(m.run?.wv?.tg ?? 0), bo: r3(m.run?.G?.[m.run.k]?.bo ?? 0) }); } } }
      const hit = blockedAt(x, y, z); if (hit) { nowS.mo.add(m.id); C.moS += dt; if (!seen.mo.has(m.id)) { C.mo++; if (evN('mo')) ev.push({ k: 'mo', t: r3(t), id: m.id, mode: m.mode, piece: pieceOf(m), what: hit, x: r3(x), z: r3(z), seg: segKind(m), wv: m.run?.wv ? [r3(m.run.wv.off), r3(m.run.wv.lo), r3(m.run.wv.hi), r3(m.run.wv.tg), r3(m.run.G?.[m.run.k]?.bo ?? 0), m.run.wv.has ? 1 : 0] : null }); } }
      for (const w of near) { if (w.agent) continue; crowdF++;
        if (!nowS.wo.has(w.id) && inOwn(w.p[0], w.p[2])) { const h = blockedAt(w.p[0], w.p[1], w.p[2]); if (h) { nowS.wo.add(w.id); C.woS += dt; if (!seen.wo.has(w.id)) { C.wo++; if (evN('wo')) ev.push({ k: 'wo', t: r3(t), what: h, x: r3(w.p[0]), z: r3(w.p[2]), dodge: r3(w.dg || 0), lane: w.E && !w.E.cross ? r3(w.s) : null, vc: r3(w.vc || 0) }); } } }
        for (const o of near) { if (o.agent || o.id <= w.id) continue; if (Math.hypot(o.p[0] - w.p[0], o.p[2] - w.p[2]) < 2 * PED.body && Math.abs(o.p[1] - w.p[1]) < .5) { const key = w.id + '|' + o.id; if (nowS.ww.has(key)) continue; nowS.ww.add(key); if (!seen.ww.has(key)) { C.ww++; if (evN('ww')) ev.push({ k: 'ww', t: r3(t), x: r3(w.p[0]), z: r3(w.p[2]) }); } } } } }
    for (const k of Object.keys(seen)) seen[k] = nowS[k];
    crowdN += sim.walkers.length - sim.agents.length; }
  const min = seconds / 60, mm = moverS / 60;
  const res = { scenario: name, night: sc.night, rush: sc.rush, blocks: own.size, buildMs: Math.round(tBuild), seconds, dt, movers: movers.length, modes: Object.fromEntries(Object.keys(sc.n).map(k => [k, movers.filter(m => m.mode === k).length])),
    crowd: Math.round(crowdN / steps), moverMinutes: +mm.toFixed(2), arrived: movers.filter(m => m.arrived !== undefined).length,
    counts: C, perMin: Object.fromEntries(['mw', 'mm', 'mo', 'wo', 'ww'].map(k => [k, +(C[k] / min).toFixed(2)])), perMoverMin: Object.fromEntries(['mw', 'mm', 'mo'].map(k => [k, +(C[k] / Math.max(1e-6, mm)).toFixed(3)])),
    cost: { stepAvg: +(stepMs.reduce((s, v) => s + v, 0) / stepMs.length).toFixed(3), stepP95: +pct(stepMs, .95).toFixed(3), moveAvg: +(moveMs.reduce((s, v) => s + v, 0) / moveMs.length).toFixed(3), moveP95: +pct(moveMs, .95).toFixed(3) },
    events: ev, mvStats: (({ ms, arrivals, vlegs, ...s }) => s)(MV.stats()), ...(res0.trace ? { trace: res0.trace } : {}) };
  if (keepTracks !== false) res.tracks = Object.fromEntries(movers.map(m => [m.id, { mode: m.mode, dep: m.trip.dep, arr: m.trip.arr, arrived: m.arrived ?? null, ends: m.ends, samples: m.samples }]));
  for (const m of movers) if (m.a.w) sim.removeAgent(m.a.id);
  return res;
}

// ── THE SIDE ROOM TABLE (simstate/room.json): for every sidewalk side, the clear strip round its lane every 0.2 m — [lo, hi], metres from the
// curb, between which a walker-sized body (audit.js walkBlockIn .24 / .37: the walk check's size) touches nothing the block's build left
// there. The lanes carry one clear line (engine.js lanesOf c); a mover weaving round a walker and a walker stepping aside need the strip
// round it, which only the build knows. Made from the blocks' own builds here (REG.end is wrapped to keep what a walker can run into, as
// the audit's lanes.snap does), and keyed by a hash of the lane itself: a side whose lane the page has changed is not used (pedsim.js).
// (The proper home is engine.js lanesOf — one more pair of arrays per side — on a rebake; this table stands in until then.)
import { REG, walkObstacles } from '../audit.js';
import { urbanBlocks } from '../plan.js';
export const laneHash = c => { let h = 2166136261; for (let k = 0; k < c.length; k++) h = Math.imul(h ^ (Math.round(c[k] * 100) & 0xffff), 16777619); return (h >>> 0).toString(36); };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', q20 = c => B64[Math.max(0, Math.min(63, Math.round(c * 20) + 16))];   // (c −0.8 … 2.35 in 5 cm: one character)
// CROWD HOLD (2026-10-08) · version 2, at a spread: a 3–4 m walk doesn't fit −0.8 … 2.35 (an avenue's lane rests 2.4 m out, past the top), so
// one character is 7.5 cm over −0.8 … 3.925. Version 1 (today's 2 m walks, room.s0.json) is unchanged.
const ENC = SPREAD ? { version: 2, base: -.8, res: .075 } : { version: 1, base: -.8, res: .05 }, HMAX = ENC.version === 1 ? 2.35 : ENC.base + 63 * ENC.res, FAR = ENC.version === 1 ? 3.2 : HMAX + .85;
const qc = c => ENC.version === 1 ? q20(c) : B64[Math.max(0, Math.min(63, Math.round((c - ENC.base) / ENC.res)))];
function sideRoom(L, snap, people, i, j) {
  const s = slab(i, j), obs = walkObstacles(snap, people.filter(p => (p.y ?? SIDE) < SIDE + .4)), rb = .24, rh = .37, out = {}, ST = .2;
  for (const [k, sd] of Object.entries(L.sides)) { const n = sd.c.length, u1 = sd.u0 + (n - 1) * sd.step, ax = k === 'N' || k === 'S' ? 'x' : 'z', cur = { N: s.z0, S: s.z1, W: s.x0, E: s.x1 }[k], dir = k === 'N' || k === 'W' ? 1 : -1;
    const m = Math.floor((u1 - sd.u0) / ST + 1e-6) + 1, lo = new Float32Array(m), hi = new Float32Array(m), iv = Array.from({ length: m }, () => []);
    for (const o of obs) { let bu0, bu1, bc0, bc1, ya, yb, r0 = 0;
      if (o.disc) { const [x, z, r] = o.disc, u = ax === 'x' ? x : z, cc = dir > 0 ? (ax === 'x' ? z : x) - cur : cur - (ax === 'x' ? z : x); bu0 = bu1 = u; bc0 = bc1 = cc; ya = o.y[0]; yb = o.y[1]; r0 = r; }
      else { const bx = o.box; [bu0, bu1] = ax === 'x' ? [bx[0], bx[3]] : [bx[2], bx[5]]; const [p0, p1] = ax === 'x' ? [bx[2], bx[5]] : [bx[0], bx[3]]; [bc0, bc1] = dir > 0 ? [p0 - cur, p1 - cur] : [cur - p1, cur - p0]; ya = bx[1]; yb = bx[4]; }
      if (bu1 < sd.u0 - 1 || bu0 > u1 + 1 || bc1 < -1 || bc0 > FAR) continue;
      const y0 = SIDE + .1, yh = SIDE + 1.25, y1 = SIDE + 1.9, body = ya < yh && yb > y0, head = ya < y1 && yb > yh; if (!body && !head) continue;
      const r = r0 + (head ? rh : rb);
      for (let q = Math.max(0, Math.floor((bu0 - r - sd.u0) / ST)); q <= Math.min(m - 1, Math.ceil((bu1 + r - sd.u0) / ST)); q++) { const u = sd.u0 + q * ST, du = Math.max(bu0 - u, 0, u - bu1); if (du >= r) continue; const dc = Math.sqrt(r * r - du * du); iv[q].push([bc0 - dc, bc1 + dc]); } }
    let a = '', b = '';
    for (let q = 0; q < m; q++) { const f = (q * ST) / sd.step, i0 = Math.min(n - 1, Math.floor(f)), c = sd.c[i0] + (sd.c[Math.min(n - 1, i0 + 1)] - sd.c[i0]) * (f - i0); let l = ENC.base, h = HMAX;
      for (const [p0, p1] of iv[q]) { if (p1 <= c) l = Math.max(l, p1); else if (p0 >= c) h = Math.min(h, p0); else { l = h = c; } }   // (the lane itself blocked here — a pinch: no room either way)
      lo[q] = l; hi[q] = h; a += qc(Math.min(c, l + ENC.res / 2)); b += qc(Math.max(c, h - ENC.res / 2)); }   // (rounded inward: never wider than measured)
    out[k] = [+sd.u0.toFixed(2), laneHash(sd.c), a, b]; }
  return out; }
export async function roomTable({ nights = [false, true], only = null } = {}) {
  const list = only || urbanBlocks(), T = { version: ENC.version, ...(ENC.version > 1 ? { base: ENC.base, res: ENC.res } : {}), step: .2, made: new Date().toISOString(), day: {}, night: {} }, t0 = performance.now(); let built = 0, skipped = 0;
  const end0 = REG.end; let cap = null; REG.end = function (persons, ground) { if (this.blk) cap = { snap: this.walkSnap(), people: persons || [] }; return end0.call(this, persons, ground); };
  try { for (const night of nights) for (const [i, j] of list) { cap = null; let res = null; try { res = J.jobBlock({ i, j, night, audit: !!SPREAD, chars: false, flags: FLAGS }); } catch (e) { skipped++; continue; }   // (crowd hold: at a spread, the audit's build — what the walk check and the probe test against, facades' parts and all)
      if (!res?.lanes || !cap?.snap) { skipped++; continue; } const sides = sideRoom(res.lanes, cap.snap, cap.people, i, j), key = i + ',' + j;
      if (night) { const d = T.day[key], diff = {}; for (const [k, v] of Object.entries(sides)) if (!d?.[k] || d[k][1] !== v[1] || d[k][2] !== v[2] || d[k][3] !== v[3]) diff[k] = v; if (Object.keys(diff).length) T.night[key] = diff; }
      else T.day[key] = sides; built++; } }
  finally { REG.end = end0; }
  return { T, built, skipped, ms: Math.round(performance.now() - t0) }; }

// ── THE SHOTS (tools/riderprobe.mjs --shots): a few fixed trips run through the live page itself — its streamed blocks, its crowd, its
// renderer — by the same few lines agents.js uses to draw a sim agent on its legs (peds.driver: a page without the live sim has none).
// hero: { mode, from, to } (from/to: [x, z] or a place id); extras: more of the same, each with its own start (at, s); cam: 'follow'
// (the follow cam on the hero) or [px, py, pz, tx, ty, tz] (a fixed view).
// (crowd hold: today: true — every [x, z] given in today's metres, carried into the spread world by remap; cam 'eye': a skater's-eye chase
// cam, 3.2 m behind the hero and 2.35 up — just over its big head — looking 9 m ahead along its smoothed heading)
export async function stage({ hero, extras = [], cam = 'follow', lead = 1.2, today = false } = {}) {
  const C = window.__city, peds = C.peds, sim = peds.sim, world = await (await fetch(new URL(sdata('../../../world/export/world.json'), import.meta.url), { cache: 'no-store' })).json(), T = createTravel(tuneWorld(world));
  const MV = createMovement({ peds, log: () => {} }); MV.setScene(C.scene); let clock = 0; const movers = [], RM = p => today && Array.isArray(p) ? remap(p[0], p[1]) : p;
  if (today && Array.isArray(cam)) { const [a, b] = [remap(cam[0], cam[2]), remap(cam[3], cam[5])]; cam = [a[0], cam[1], a[1], b[0], cam[4], b[1]]; }
  let eyeH = null;
  const add = (sp, k) => { let tr = null; try { tr = T.trip(RM(sp.from), RM(sp.to), sp.mode, { dep: (sp.at ?? lead) / GAME_MIN }); } catch { tr = null; } if (!tr) return null;
    const m = { id: 'shot-' + k, trip: tr, a: { id: 'shot-' + k, look: sp.look ?? (k * 7 + 3) }, run: null, done: false }; movers.push(m); return m; };
  const H = add(hero, 0); extras.forEach((e, k) => add(e, k + 1)); if (!H) return { error: 'no hero trip' };
  peds.driver = (t, dt) => { clock += dt; const now = clock / GAME_MIN; MV.frame(now);
    for (const m of movers) { if (m.done) continue; if (!m.run) { if (now < m.trip.dep) continue; m.run = MV.run(m.a, m.trip); }
      const o = m.run.frame(now, dt, m.a); if (m.run.done) { if (m.a.w) { sim.removeAgent(m.a.id); m.a.w = null; } m.done = true; continue; }
      if (!o.show) { if (m.a.w) { sim.removeAgent(m.a.id); m.a.w = null; } continue; }
      if (!m.a.w) { m.a.w = sim.putAgent({ id: m.a.id, look: m.a.look, fix: [o.x, o.y, o.z, o.yaw] }); if (!m.a.w) continue; m.a.w.yawS = o.yaw; m.a.w.aid = m.a.id; }
      const w = m.a.w; w.fix = [o.x, o.y, o.z, o.yaw]; w.vc = o.vc; w.ph += (o.cad || o.vc) * dt * 3.1; w.mv = o.prop || o.clip || o.stand ? o : null; if (o.snap) { w.yawS = o.yaw; w.omega = 0; }
      if (o.prop) MV.prop(o.prop, o.x, o.base ?? (o.y - .12), o.z, w.yawS ?? o.yaw, w, o); }
    MV.flushProps(); if (cam === 'follow' && H.a.w && !H.cam) { H.cam = true; try { C.cam.setMode('follow', { subject: H.a.w }); } catch (e) { H.camErr = String(e); } }
    if (cam === 'eye' && H.a.w && !H.done) { const p = H.a.w.p, yaw = H.a.w.yawS ?? p[3]; eyeH = eyeH === null ? yaw : eyeH + Math.atan2(Math.sin(yaw - eyeH), Math.cos(yaw - eyeH)) * Math.min(1, dt * 2.5);
      const fx = Math.sin(eyeH), fz = Math.cos(eyeH); C.controls.target.set(p[0] + fx * 9, .8, p[2] + fz * 9); C.camera.position.set(p[0] - fx * 3.2, 2.35 + (p[1] || 0), p[2] - fz * 3.2); C.camera.lookAt(C.controls.target); C.controls.update(); } };
  if (Array.isArray(cam)) { const [px, py, pz, tx, ty, tz] = cam; C.controls.target.set(tx, ty, tz); C.camera.position.set(px, py, pz); C.camera.lookAt(tx, ty, tz); C.controls.update(); }
  window.__riderShot = { H, movers, get clock() { return clock; }, done: () => movers.every(m => m.done), stats: () => ({ peds: peds.stats(), mv: MV.stats() }) };
  return { legs: H.trip.legs.map(l => ({ kind: l.kind, dep: l.dep, arr: l.arr, n: l.path?.length })), arr: H.trip.arr, movers: movers.length };
}

// ── CROWD HOLD (2026-10-08) · the generated people on the ground, per block (tools/riderprobe.mjs --people): the cast a block's build leaves
// below SIDE + 0.4 (engine.js lanesOf's people — talk pairs, stands, leaners, a scene's sitters; the retired crowd is not in it), split into
// the sidewalk (on the slab, outside the block's interior) and the rest, by district and by act. The SPREAD crowd hold compares runs of it.
import { kindAt, distOf } from '../plan.js';
import { interior } from '../../../world/city.js';
export async function people({ blocks = null, night = false } = {}) {
  const list = blocks || urbanBlocks(), out = { blocks: 0, skipped: 0, dist: {}, per: {}, who: {} }, t0 = performance.now();
  for (const [i, j] of list) { let res = null; try { res = J.jobBlock({ i, j, night, audit: true, chars: false, flags: FLAGS }); } catch (e) { out.skipped++; continue; }
    const L = res?.lanes, P = L?.people; if (!P) { out.skipped++; continue; } out.blocks++;
    const s = slab(i, j), I = interior(i, j), d = distOf(kindAt(i, j)), D = out.dist[d] ??= { blocks: 0, walk: 0, rest: 0, acts: {} }; D.blocks++; let nw = 0;
    for (const p of P) { const onSlab = p.x >= s.x0 - .01 && p.x <= s.x1 + .01 && p.z >= s.z0 - .01 && p.z <= s.z1 + .01, inside = p.x > I.x0 && p.x < I.x1 && p.z > I.z0 && p.z < I.z1;
      if (onSlab && !inside) { nw++; D.walk++; D.acts[p.act] = (D.acts[p.act] || 0) + 1; D.src ??= {}; const k = p.act + '/' + p.src; D.src[k] = (D.src[k] || 0) + 1; (out.who[i + ',' + j] ??= []).push(k + '@' + p.x.toFixed(1) + ',' + p.z.toFixed(1)); } else D.rest++; }
    out.per[i + ',' + j] = [d, nw, P.length - nw]; }
  out.ms = Math.round(performance.now() - t0); return out; }
