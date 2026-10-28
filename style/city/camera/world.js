// CAMERA BUILD (2026-10-05) · THE COLLISION WORLD (RESEARCH.md §4.2): what the camera must not enter and what it must see past. Replaces
// solid.js's 1 m slab grid once follow and fly move over (agents 2 and 3). Two kinds of solid:
//   STATIC   per block, exact 0.25 m COLUMN INTERVALS built from the block's FULL tier (else mid, else far) in a worker
//            (world.worker.js), with the THIN flag on posts, poles, masts and trunks — PER SPAN (camera build 2c): only the slender
//            part of a column is thin; a sign box, signal head or lamp head on a pole is solid at its height (STATIC_WIDE sees it). The main thread only copies the quads over, in
//            chunks of ≤ copyQuads a frame. Blocks round the camera (prefetch ring) are queued at once — their far massing first (a quick
//            job), then the full tier; a query that reaches a block with nothing built yet gets its far massing at 1 m columns on the
//            spot (≈ 0.4 ms, at most one a frame, within keepR), so a loading block is never empty. Kept within keepR of the camera, LRU,
//            at most maxBlocks; rebuilt when a better tier arrives (never downgraded). The ground plane y = 0 is solid too.
//   DYNAMIC  the walkers (peds.sim.walkers: a capsule feet + .1 … head, r .32; peds.heightOf(w) when it exists, else 1.75 m) and the
//            cars (traffic.sim.cars: an oriented box len × wid × the model's height at c.x, c.z, heading c.h), read live from their
//            simulations: candidates within dynR of the camera by a rolling scan in tick() (idle when nobody queries them), packed
//            once per epoch — tick() and invalidate() start one; the rig's late step calls invalidate() after the walkers moved.
// MASKS: STATIC 1 · PEOPLE 2 · CARS 4 · STATIC_WIDE 8 (static without the THIN spans) · STATIC_THIN 16 (only them: overlap and
// distance) · ALL 7. A query may skip walkers: `skip` is one
// walker or an array of them (the followed person). Segments run a → b, t ∈ [0, 1]; results are fresh objects (null: nothing hit).
//   ray(a, b, mask, skip)          → { t, n: [x, y, z], thin, kind: 'static'|'ground'|'person'|'car', who }  first hit along a → b
//   sweep(a, b, r, mask, skip)     → { t, n, thin, kind, who }  first contact of a sphere of radius r moving a → b (exact rounded box)
//   overlap(p, r, mask, skip)      → { depth, n, kind, who }    deepest penetration of a sphere at p, and the way out
//   inside(p, mask, skip)          → bool                       the point is in a solid
//   distance(p, R, mask, skip)     → metres to the nearest solid within R (R when none)
//   nearestFree(p, r, mask, maxR, skip) → { x, y, z, d } the nearest spot (≤ maxR) where a sphere of radius r overlaps nothing
//   fan(a, pts, mask, skip)        → { vis, wide, thin, people, hits } line of sight from a to each point (THIN-only blocks tolerated)
//   floorAt(x, z, y) / ceilAt(x, z, y) → the nearest solid top ≤ y (0: the ground) / bottom ≥ y (Infinity)
//   topAt(x, z) → the column's highest solid top · ready(x, z) → its columns are the real ones (not the far fallback) · tierAt(x, z)
//   tick(camPos) once a frame (eviction, prefetch round the camera, one block to the worker) · invalidate() · stat · clear()
import { buildColumns, THIN } from './world.worker.js';
import { P } from '../plan.js';

export const STATIC = 1, PEOPLE = 2, CARS = 4, STATIC_WIDE = 8, ALL = 7, STATIC_THIN = 16, THIN_FLAG = THIN;
const RANK = { far: 1, mid: 2, full: 3 };
// car heights by placeholder model (traffic/render.js PLACEHOLDER); registry models read vehicles/index.js dims.h once it is loaded
const PH = { sedan: 1.45, hatch: 1.5, van: 1.95, taxi: 1.7 };
let byId = null; import('../vehicles/index.js').then(m => { byId = m.byId; }).catch(() => {});

export function createWorld(api, o = {}) {
  const cfg = { col: .25, farCol: 1, dynR: 80, dynScan: 6, syncFarPerFrame: 1, copyQuads: 8000, keepR: 96, maxBlocks: 24, thinMax: .6, thinBand: [.8, 2.4], fallbackFar: true, prefetch: 1, inflight: 2, walkerR: .32, walkerH: 1.75, ...o };
  const CS = cfg.col, INV = 1 / CS, G = Math.round(P / CS);
  const E = new Map(), misses = new Map(), pend = new Map(), queue = [];
  const stat = { blocks: 0, full: 0, mid: 0, far: 0, pending: 0, posted: 0, built: 0, stale: 0, errors: 0, workerMs: 0, workerMax: 0, mainMs: 0, mainFrameMax: 0, mainFrames: 0, copyMax: 0, copyMs: 0, copyN: 0, copyOver: 0, farBuilds: 0, farMax: 0, evicted: 0, lastBuild: null };
  let worker = null, inflight = 0, frame = 0, spent = 0, epoch = 0, LK = NaN, LE = null, jobId = 0, syncFar = 0, sending = null;
  const cam = { x: 0, y: 0, z: 0 }, pre = { i: 1e9, j: 1e9 };
  const keyOf = (i, j) => (i + 4096) * 8192 + (j + 4096);
  const stream = () => api.stream;

  // ── static columns: entries, the far fallback, the worker
  function srcOf(r) { const d = r.data; if (!d) return null;
    if (Array.isArray(d.full) && d.full.some(t => t && t.n)) return { tier: 'full', obj: d.full, parts: d.full.filter(t => t && t.n) };
    if (d.mid?.P && d.mid.n) return { tier: 'mid', obj: d.mid, parts: [d.mid] };
    if (d.far?.P && d.far.n) return { tier: 'far', obj: d.far, parts: [d.far] };
    return null; }
  const nOf = parts => parts.reduce((s, t) => s + t.n, 0);
  function install(i, j, k, tier, obj, n, r) { const e = { i, j, x0: i * P, z0: j * P, tier, rank: RANK[tier], obj, n, off: r.off, iv: r.iv, ivf: r.ivf || new Uint8Array(r.iv.length >> 1), top: r.top, flags: r.flags, gc: r.G, sh: Math.round(Math.log2(r.col / CS)), used: frame, chk: frame };
    E.set(k, e); misses.delete(k); LK = NaN; return e; }
  function enqueue(i, j, k, s) { const p = pend.get(k); if (p && p.obj === s.obj) return; pend.set(k, { i, j, obj: s.obj, tier: s.tier, n: nOf(s.parts), posted: false }); if (!queue.includes(k)) queue.push(k); }
  // the block's entry; on the first touch a frame: the far fallback at once if nothing is there, and a job when a better tier exists
  function ensure(i, j, k, sync = true) {
    let e = E.get(k); if (e && e.chk === frame) { e.used = frame; return e; }
    const r = stream()?.blocks.get(i + ',' + j);
    if (!r) { if (e) { e.used = e.chk = frame; } return e || null; }
    const s = srcOf(r);
    if (e) { e.used = e.chk = frame;
      if (s && (RANK[s.tier] > e.rank || (RANK[s.tier] === e.rank && s.obj !== e.obj)) && Math.hypot((i + .5) * P - cam.x, (j + .5) * P - cam.z) < cfg.keepR) { const n = nOf(s.parts); if (RANK[s.tier] === e.rank && n === e.n) e.obj = s.obj; else enqueue(i, j, k, s); }
      return e; }
    if (misses.get(k) === frame) return null; if (sync) misses.set(k, frame);
    if (!s) return null;
    const near = Math.hypot((i + .5) * P - cam.x, (j + .5) * P - cam.z) < cfg.keepR, far = r.data.far?.P && r.data.far.n ? r.data.far : null;
    const farJob = far && { tier: 'far', obj: far, parts: [far] };
    if (near) { if (!sync && far && s.tier !== 'far') enqueue(i, j, -k, farJob); if (s.tier !== 'far' || !sync) enqueue(i, j, k, s); } else if (far) enqueue(i, j, -k, farJob);   // (key −k: the far massing's own quick job, ahead of the full one)
    if (!sync || !near || syncFar >= cfg.syncFarPerFrame) return null;   // (beyond keepR, or a second miss this frame: the worker builds it, a frame or two)
    if (far && (s.tier === 'far' || cfg.fallbackFar)) { syncFar++; const t0 = performance.now(); const b = buildColumns({ x0: i * P, z0: j * P, size: P, col: cfg.farCol, parts: [far], thinMax: 0 });
      const ms = performance.now() - t0; spent += ms; stat.farBuilds++; stat.farMax = Math.max(stat.farMax, ms); return install(i, j, k, 'far', far, far.n, b); }
    return null;
  }
  function entryAt(i, j) { const k = keyOf(i, j); if (k === LK) return LE; LE = ensure(i, j, k); LK = k; return LE; }
  function startWorker() { if (worker !== null) return worker; try { worker = new Worker(new URL('./world.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = onBuilt; worker.onerror = e => { stat.errors++; console.warn('collision world worker:', e.message || e); }; } catch (e) { worker = false; } return worker; }
  function onBuilt(ev) { const m = ev.data; inflight = Math.max(0, inflight - 1); const p = pend.get(m.key);
    if (m.error) { stat.errors++; console.warn('collision world build failed', m.key, m.error.slice(0, 200)); pend.delete(m.key); return; }
    if (!p || p.id !== m.id) { stat.stale++; return; }
    pend.delete(m.key); const bk = Math.abs(m.key), cur = E.get(bk); if (cur && cur.rank > RANK[p.tier]) return; const t0 = performance.now(); install(p.i, p.j, bk, p.tier, p.obj, p.n, m); spent += performance.now() - t0;
    stat.built++; stat.workerMs += m.ms; stat.workerMax = Math.max(stat.workerMax, m.ms); stat.lastBuild = { tier: p.tier, quads: m.quads, hq: m.hq, intervals: m.intervals, thin: m.thin, ms: +m.ms.toFixed(2) }; }
  // one block at a time to the worker, its quads copied in chunks of ≤ copyQuads a frame (the copy is the only main-thread cost)
  function post() {
    if (sending) { pump(); return; }
    if (!queue.length || inflight >= cfg.inflight) return;
    let bi = -1, bd = 1e18; for (let q = 0; q < queue.length; q++) { const p = pend.get(queue[q]); if (!p) { queue.splice(q--, 1); continue; } const d = ((p.i + .5) * P - cam.x) ** 2 + ((p.j + .5) * P - cam.z) ** 2; if (d < bd) { bd = d; bi = q; } }
    if (bi < 0) return; const k = queue.splice(bi, 1)[0], p = pend.get(k), r = stream()?.blocks.get(p.i + ',' + p.j), s = r && srcOf(r);
    const ok = s && (s.obj === p.obj || (p.tier === 'far' && r.data.far === p.obj)); if (!ok) { pend.delete(k); return; }
    const parts = p.tier === 'far' ? [p.obj] : s.parts, id = ++jobId; p.id = id; p.posted = true; inflight++;
    const head = { key: k, id, x0: p.i * P, z0: p.j * P, size: P, col: p.tier === 'far' ? cfg.farCol : CS, thinMax: p.tier === 'far' ? 0 : cfg.thinMax, band: cfg.thinBand };
    if (!startWorker()) { const t0 = performance.now(); const b = buildColumns({ ...head, parts }); onBuilt({ data: { key: k, id, ...b } }); spent += performance.now() - t0; return; }   // (no workers: build here)
    worker.postMessage({ type: 'begin', ...head }); stat.posted++; sending = { id, parts, part: 0, q: 0 }; pump();
  }
  function pump() { const t0 = performance.now(), S = sending; let budget = cfg.copyQuads;
    while (S.part < S.parts.length && budget > 0) { const t = S.parts[S.part], nq = t.n >> 2, q1 = Math.min(nq, S.q + budget), a = S.q * 12, b = q1 * 12;
      const part = { P: t.P.slice(a, b), N: t.N.slice(a, b), o: t.o, n: (q1 - S.q) * 4 }; worker.postMessage({ type: 'part', id: S.id, part }, [part.P.buffer, part.N.buffer]);
      budget -= q1 - S.q; S.q = q1; if (S.q >= nq) { S.part++; S.q = 0; } }
    if (S.part >= S.parts.length) { worker.postMessage({ type: 'end', id: S.id }); sending = null; }
    const ms = performance.now() - t0; spent += ms; stat.copyMax = Math.max(stat.copyMax, ms); stat.copyMs += ms; stat.copyN++; if (ms >= .5) stat.copyOver++; }
  function evict() {
    if (E.size <= cfg.maxBlocks) { for (const [k, e] of E) if (e.used < frame - 120 && Math.hypot(e.x0 + P / 2 - cam.x, e.z0 + P / 2 - cam.z) > cfg.keepR + P) { E.delete(k); stat.evicted++; LK = NaN; } return; }
    const list = [...E.entries()].sort((a, b) => a[1].used - b[1].used || Math.hypot(b[1].x0 - cam.x, b[1].z0 - cam.z) - Math.hypot(a[1].x0 - cam.x, a[1].z0 - cam.z));
    for (const [k, e] of list) { if (E.size <= cfg.maxBlocks) break; if (e.used >= frame - 1 && Math.hypot(e.x0 + P / 2 - cam.x, e.z0 + P / 2 - cam.z) < cfg.keepR) continue; E.delete(k); stat.evicted++; LK = NaN; }
  }

  // ── columns: CE / CC are the entry and column index of the last col() call
  let CE = null;
  function col(gx, gz) { const i = Math.floor(gx / G), j = Math.floor(gz / G), e = entryAt(i, j); if (!e) return -1; CE = e; return e.sh ? ((gz - j * G) >> e.sh) * e.gc + ((gx - i * G) >> e.sh) : (gz - j * G) * G + (gx - i * G); }

  // ── dynamic shapes, gathered once per epoch
  let dynEpoch = -1; const WK = { n: 0, a: new Float32Array(4 * 512), ref: [] }, CR = { n: 0, a: new Float32Array(9 * 128), ref: [] };
  function heightOfCar(c, tr) { const m = tr?.MODELS?.[c.model], nm = m?.name; const h = (nm && byId?.[nm]?.dims?.h) || (nm && PH[nm]) || (c.len > 6.5 ? 3.2 : 1.6); return h; }
  // candidates within dynR of the camera, refreshed by a rolling scan (1/dynScan of the walkers a frame; all at once after a jump), so a
  // frame packs a few hundred shapes instead of reading every walker in the city
  const candW = new Set(), candC = new Set(), last = { x: 1e9, z: 1e9 }; let scanW = 0, dynUsed = -1e9;
  // (idle — no dynamic query for 30 frames — the scan stops; the next dynamic query rescans everything at once)
  function scan(all = false) { if (!all && frame - dynUsed > 30) { last.x = 1e9; return; } const ws = api.peds?.sim?.walkers || [], cs = api.traffic?.sim?.cars || [], R2 = cfg.dynR * cfg.dynR, jump = Math.hypot(cam.x - last.x, cam.z - last.z) > 20;
    const n = jump || all ? ws.length : Math.ceil(ws.length / cfg.dynScan); if (jump || all) { last.x = cam.x; last.z = cam.z; candW.clear(); scanW = 0; }
    for (let q = 0; q < n && ws.length; q++) { scanW = scanW % ws.length; const w = ws[scanW++]; if (!w.gone && (w.p[0] - cam.x) ** 2 + (w.p[2] - cam.z) ** 2 < R2) candW.add(w); else candW.delete(w); }
    if (Math.hypot(cam.x - last.x, cam.z - last.z) > 4) { last.x = cam.x; last.z = cam.z; }
    candC.clear(); const RC = (cfg.dynR + 20) ** 2; for (const c of cs) if (!c.gone && (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 < RC) candC.add(c); }
  function dyn() { if (dynEpoch === epoch) return; dynEpoch = epoch; if (frame - dynUsed > 30) scan(true); dynUsed = frame;
    const hOf = api.peds?.heightOf; let n = 0;
    if (WK.a.length < candW.size * 4) WK.a = new Float32Array(candW.size * 8); WK.ref.length = 0;
    for (const w of candW) { if (w.gone) continue; const y = w.p[1], h = (hOf && hOf(w)) || cfg.walkerH, b = n * 4; WK.a[b] = w.p[0]; WK.a[b + 1] = w.p[2]; WK.a[b + 2] = y + .1; WK.a[b + 3] = y + h; WK.ref[n++] = w; }
    WK.n = n;
    const tr = api.traffic; let m = 0; if (CR.a.length < candC.size * 9) CR.a = new Float32Array(candC.size * 18); CR.ref.length = 0;
    for (const c of candC) { if (c.gone) continue; const b = m * 9, y = c.y || 0; CR.a[b] = c.x; CR.a[b + 1] = c.z; CR.a[b + 2] = Math.cos(c.h); CR.a[b + 3] = Math.sin(c.h); CR.a[b + 4] = (c.len || 4.4) / 2; CR.a[b + 5] = (c.wid || 1.8) / 2; CR.a[b + 6] = y; CR.a[b + 7] = y + heightOfCar(c, tr); CR.a[b + 8] = 0; CR.ref[m++] = c; }
    CR.n = m; }
  const skipped = (w, skip) => skip && (skip === w || (Array.isArray(skip) && skip.includes(w)));

  // ── primitives
  const NRM = [0, 0, 0];
  // segment (a + t·d, t ∈ [0, 1]) against a capsule pa–pb of radius R: first t, or −1 (iq's capIntersect on the normalised direction)
  function capsule(ax, ay, az, dx, dy, dz, pax, pay, paz, pbx, pby, pbz, R) {
    const L = Math.hypot(dx, dy, dz); if (L < 1e-9) return -1; const rx = dx / L, ry = dy / L, rz = dz / L;
    const bax = pbx - pax, bay = pby - pay, baz = pbz - paz, oax = ax - pax, oay = ay - pay, oaz = az - paz;
    const baba = bax * bax + bay * bay + baz * baz, bard = bax * rx + bay * ry + baz * rz, baoa = bax * oax + bay * oay + baz * oaz, rdoa = rx * oax + ry * oay + rz * oaz, oaoa = oax * oax + oay * oay + oaz * oaz;
    const a = baba - bard * bard; let b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - R * R * baba, h = b * b - a * c;
    if (a > 1e-12 && h >= 0) { const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard; if (y > 0 && y < baba) return t >= 0 && t <= L ? t / L : -1; }
    else if (a > 1e-12) return -1;
    // the caps (and a direction along the axis)
    let best = -1;
    for (let s = 0; s < 2; s++) { const ocx = s ? ax - pbx : oax, ocy = s ? ay - pby : oay, ocz = s ? az - pbz : oaz; b = rx * ocx + ry * ocy + rz * ocz; c = ocx * ocx + ocy * ocy + ocz * ocz - R * R; h = b * b - c;
      if (h > 0) { const t = -b - Math.sqrt(h); if (t >= 0 && t <= L && (best < 0 || t / L < best)) best = t / L; } }
    return best;
  }
  const segDist2 = (px, py, pz, ax, ay, az, bx, by, bz) => { const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz; let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = px - ax - dx * t, ey = py - ay - dy * t, ez = pz - az - dz * t; return ex * ex + ey * ey + ez * ez; };
  // a sphere of radius r moving a → a + d against the box [x0, x1] × [y0, y1] × [z0, z1] (Ericson, RTCD 5.5.7): first t, or −1; NRM = normal.
  // Starting in contact: 0 if moving deeper, −1 if moving out (never stuck).
  function sphereBox(ax, ay, az, dx, dy, dz, r, x0, y0, z0, x1, y1, z1) {
    const qx = ax < x0 ? x0 : ax > x1 ? x1 : ax, qy = ay < y0 ? y0 : ay > y1 ? y1 : ay, qz = az < z0 ? z0 : az > z1 ? z1 : az;
    let ex = ax - qx, ey = ay - qy, ez = az - qz; const d2 = ex * ex + ey * ey + ez * ez;
    if (d2 < r * r) { if (d2 > 1e-12) { const d = Math.sqrt(d2); ex /= d; ey /= d; ez /= d; } else { const k = exitAxis(ax, ay, az, x0, y0, z0, x1, y1, z1); ex = k[0]; ey = k[1]; ez = k[2]; }
      NRM[0] = ex; NRM[1] = ey; NRM[2] = ez; return dx * ex + dy * ey + dz * ez < 0 ? 0 : -1; }
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-12) { if (ax < x0 - r || ax > x1 + r) return -1; } else { let ta = (x0 - r - ax) / dx, tb = (x1 + r - ax) / dx; if (ta > tb) { const s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return -1; }
    if (Math.abs(dy) < 1e-12) { if (ay < y0 - r || ay > y1 + r) return -1; } else { let ta = (y0 - r - ay) / dy, tb = (y1 + r - ay) / dy; if (ta > tb) { const s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return -1; }
    if (Math.abs(dz) < 1e-12) { if (az < z0 - r || az > z1 + r) return -1; } else { let ta = (z0 - r - az) / dz, tb = (z1 + r - az) / dz; if (ta > tb) { const s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return -1; }
    const px = ax + dx * t0, py = ay + dy * t0, pz = az + dz * t0; let u = 0, v = 0;
    if (px < x0) u |= 1; if (px > x1) v |= 1; if (py < y0) u |= 2; if (py > y1) v |= 2; if (pz < z0) u |= 4; if (pz > z1) v |= 4;
    const m = u | v; let t = t0;
    const cx = n => n & 1 ? x1 : x0, cy = n => n & 2 ? y1 : y0, cz = n => n & 4 ? z1 : z0;
    if (m === 7) { t = -1; for (const f of [1, 2, 4]) { const w = v ^ f, s = capsule(ax, ay, az, dx, dy, dz, cx(v), cy(v), cz(v), cx(w), cy(w), cz(w), r); if (s >= 0 && (t < 0 || s < t)) t = s; } if (t < 0) return -1; }
    else if (m & (m - 1)) { const w = u ^ 7; t = capsule(ax, ay, az, dx, dy, dz, cx(w), cy(w), cz(w), cx(v), cy(v), cz(v), r); if (t < 0) return -1; }
    const sx = ax + dx * t, sy = ay + dy * t, sz = az + dz * t, nx = sx - (sx < x0 ? x0 : sx > x1 ? x1 : sx), ny = sy - (sy < y0 ? y0 : sy > y1 ? y1 : sy), nz = sz - (sz < z0 ? z0 : sz > z1 ? z1 : sz), l = Math.hypot(nx, ny, nz);
    if (l > 1e-9) { NRM[0] = nx / l; NRM[1] = ny / l; NRM[2] = nz / l; } else { NRM[0] = m & 1 ? (u & 1 ? -1 : 1) : 0; NRM[1] = m & 2 ? (u & 2 ? -1 : 1) : 0; NRM[2] = m & 4 ? (u & 4 ? -1 : 1) : 0; }
    return t;
  }
  // a point inside a box: the face it is nearest to leave by
  const EX = [0, 0, 0];
  function exitAxis(px, py, pz, x0, y0, z0, x1, y1, z1) { const d = [px - x0, x1 - px, py - y0, y1 - py, pz - z0, z1 - pz]; let k = 3; for (let q = 0; q < 6; q++) if (d[q] < d[k]) k = q;
    EX[0] = k === 0 ? -1 : k === 1 ? 1 : 0; EX[1] = k === 2 ? -1 : k === 3 ? 1 : 0; EX[2] = k === 4 ? -1 : k === 5 ? 1 : 0; return EX; }
  // a ray (segment) against a box: entry t (0 when it starts inside) or −1; NRM = the face crossed
  function rayBox(ax, ay, az, dx, dy, dz, x0, y0, z0, x1, y1, z1) { let t0 = 0, t1 = 1, ax_ = -1;
    const D = [dx, dy, dz], A = [ax, ay, az], LO = [x0, y0, z0], HI = [x1, y1, z1];
    for (let k = 0; k < 3; k++) { if (Math.abs(D[k]) < 1e-12) { if (A[k] < LO[k] || A[k] > HI[k]) return -1; continue; } let ta = (LO[k] - A[k]) / D[k], tb = (HI[k] - A[k]) / D[k]; if (ta > tb) { const s = ta; ta = tb; tb = s; } if (ta > t0) { t0 = ta; ax_ = k; } if (tb < t1) t1 = tb; if (t0 > t1) return -1; }
    NRM[0] = NRM[1] = NRM[2] = 0; if (ax_ >= 0) NRM[ax_] = D[ax_] > 0 ? -1 : 1; return t0; }

  // ── static queries on the columns
  const R = { t: 2, n: [0, 0, 0], thin: false, kind: null, who: null };
  const take = (t, kind, thin = false, who = null) => { if (t >= 0 && t < R.t) { R.t = t; R.n[0] = NRM[0]; R.n[1] = NRM[1]; R.n[2] = NRM[2]; R.kind = kind; R.thin = thin; R.who = who; } };
  const reset = () => { R.t = 2; R.kind = null; R.thin = false; R.who = null; R.n[0] = R.n[1] = R.n[2] = 0; };
  const result = () => R.t <= 1 ? { t: R.t, n: R.n.slice(), thin: R.thin, kind: R.kind, who: R.who } : null;
  // Amanatides & Woo over the columns, each column's spans tested against the ray's y-span inside it
  function rayStatic(ax, ay, az, dx, dy, dz, wide) {
    let gx = Math.floor(ax * INV), gz = Math.floor(az * INV); const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sz = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    const tdx = sx ? CS / Math.abs(dx) : Infinity, tdz = sz ? CS / Math.abs(dz) : Infinity;
    let tmx = sx > 0 ? ((gx + 1) * CS - ax) / dx : sx < 0 ? (gx * CS - ax) / dx : Infinity, tmz = sz > 0 ? ((gz + 1) * CS - az) / dz : sz < 0 ? (gz * CS - az) / dz : Infinity;
    let tIn = 0, axis = -1;
    for (let guard = 0; guard < 1e6; guard++) {
      if (R.t <= tIn) return;
      const tOut = Math.min(tmx, tmz, 1), c = col(gx, gz);
      if (c >= 0) { const off = CE.off, iv = CE.iv, ivf = CE.ivf; let best = 2, how = 0, bt = 0;
        for (let k = off[c], e = off[c + 1]; k < e; k += 2) { if (wide && ivf[k >> 1]) continue; const lo = iv[k], hi = iv[k + 1]; let t0 = tIn, t1 = tOut, yh = 0;
          if (dy > 1e-12) { const ta = (lo - ay) / dy, tb = (hi - ay) / dy; if (ta > t0) { t0 = ta; yh = -1; } if (tb < t1) t1 = tb; }
          else if (dy < -1e-12) { const ta = (hi - ay) / dy, tb = (lo - ay) / dy; if (ta > t0) { t0 = ta; yh = 1; } if (tb < t1) t1 = tb; }
          else if (ay < lo || ay > hi) continue;
          if (t0 <= t1 && t0 < best) { best = t0; how = yh; bt = ivf[k >> 1]; } }
        if (best <= tOut) { NRM[0] = NRM[1] = NRM[2] = 0; if (how) NRM[1] = how; else if (axis === 0) NRM[0] = -sx; else if (axis === 1) NRM[2] = -sz; take(best, best === 0 && !how && axis < 0 ? 'inside' : 'static', !!bt); return; } }
      if (tOut >= 1) return;
      if (tmx < tmz) { gx += sx; tIn = tmx; tmx += tdx; axis = 0; } else { gz += sz; tIn = tmz; tmz += tdz; axis = 1; }
    }
  }
  // the sphere sweep over the columns: slabs along the major axis in the direction of motion; in each, only the columns the swept
  // sphere's footprint can reach; stops once no later slab can be met earlier than the best contact
  function sweepStatic(ax, ay, az, dx, dy, dz, r, wide) {
    const X = Math.abs(dx) >= Math.abs(dz), au = X ? ax : az, du = X ? dx : dz, av = X ? az : ax, dv = X ? dz : dx;
    const ylo = Math.min(ay, ay + dy) - r, yhi = Math.max(ay, ay + dy) + r;
    const g0 = Math.floor((Math.min(au, au + du) - r) * INV), g1 = Math.floor((Math.max(au, au + du) + r) * INV), st = du >= 0 ? 1 : -1;
    for (let gu = st > 0 ? g0 : g1, n = 0; n <= g1 - g0; gu += st, n++) {
      let tA = 0, tB = 1; if (Math.abs(du) > 1e-9) { let a = (gu * CS - r - au) / du, b = ((gu + 1) * CS + r - au) / du; if (a > b) { const s = a; a = b; b = s; } tA = Math.max(0, a); tB = Math.min(1, b); if (tA > tB) continue; }
      if (R.t <= tA) break;
      const v0 = av + dv * tA, v1 = av + dv * tB, gv0 = Math.floor((Math.min(v0, v1) - r) * INV), gv1 = Math.floor((Math.max(v0, v1) + r) * INV);
      for (let gv = gv0; gv <= gv1; gv++) { const gx = X ? gu : gv, gz = X ? gv : gu, c = col(gx, gz); if (c < 0) continue;
        const off = CE.off, iv = CE.iv, ivf = CE.ivf, bx = gx * CS, bz = gz * CS;
        for (let k = off[c], e = off[c + 1]; k < e; k += 2) { const lo = iv[k], hi = iv[k + 1]; if (hi < ylo || lo > yhi) continue; const th = ivf[k >> 1]; if (wide && th) continue;
          const t = sphereBox(ax, ay, az, dx, dy, dz, r, bx, lo, bz, bx + CS, hi, bz + CS); if (t >= 0) take(t, 'static', !!th); } } }
  }
  // the static boxes within reach of a point (cb(x0, lo, z0, x1, hi, z1, thin) → true stops)
  function boxesNear(px, py, pz, R_, sm, cb) {   // (sm 1: every span · 2: not the thin ones · 3: only the thin ones)
    const gx0 = Math.floor((px - R_) * INV), gx1 = Math.floor((px + R_) * INV), gz0 = Math.floor((pz - R_) * INV), gz1 = Math.floor((pz + R_) * INV);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) { const c = col(gx, gz); if (c < 0) continue; const off = CE.off, iv = CE.iv, ivf = CE.ivf;
      for (let k = off[c], e = off[c + 1]; k < e; k += 2) { if (iv[k + 1] < py - R_ || iv[k] > py + R_) continue; const th = !!ivf[k >> 1]; if (sm === 2 ? th : sm === 3 && !th) continue; if (cb(gx * CS, iv[k], gz * CS, gx * CS + CS, iv[k + 1], gz * CS + CS, th)) return; } }
  }
  // a point inside the column grid: which way out is shortest (up, down to a free span, or sideways to a column free at this height)
  function freeAt(gx, gz, y) { const c = col(gx, gz); if (c < 0) return true; const off = CE.off, iv = CE.iv; for (let k = off[c]; k < off[c + 1]; k += 2) if (iv[k] <= y && y <= iv[k + 1]) return false; return true; }

  // ── dynamic primitives
  function rayPeople(ax, ay, az, dx, dy, dz, rr, skip, sweep) { dyn(); const a = WK.a, Rw = cfg.walkerR + rr, L2 = dx * dx + dz * dz;
    const mx = Math.min(ax, ax + dx) - Rw - .1, Mx = Math.max(ax, ax + dx) + Rw + .1, mz = Math.min(az, az + dz) - Rw - .1, Mz = Math.max(az, az + dz) + Rw + .1;
    for (let q = 0; q < WK.n; q++) { const b = q * 4, x = a[b], z = a[b + 1]; if (x < mx || x > Mx || z < mz || z > Mz) continue; const w = WK.ref[q]; if (skipped(w, skip)) continue;
      const y0 = a[b + 2] + cfg.walkerR, y1 = Math.max(y0, a[b + 3] - cfg.walkerR);
      const d2 = segDist2(ax, ay, az, x, y0, z, x, y1, z);
      if (d2 < Rw * Rw) { if (sweep) { const yy = Math.max(y0, Math.min(y1, ay)); let nx = ax - x, ny = ay - yy, nz = az - z; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; if (dx * nx + dy * ny + dz * nz >= 0) continue; NRM[0] = nx; NRM[1] = ny; NRM[2] = nz; }
        else { NRM[0] = NRM[1] = NRM[2] = 0; } take(0, 'person', false, w); continue; }
      const t = capsule(ax, ay, az, dx, dy, dz, x, y0, z, x, y1, z, Rw); if (t < 0 || t >= R.t) continue;
      const sx = ax + dx * t, sy = ay + dy * t, sz = az + dz * t, yy = Math.max(y0, Math.min(y1, sy)), l = Math.hypot(sx - x, sy - yy, sz - z) || 1;
      NRM[0] = (sx - x) / l; NRM[1] = (sy - yy) / l; NRM[2] = (sz - z) / l; take(t, 'person', false, w); } }
  function rayCars(ax, ay, az, dx, dy, dz, rr) { dyn(); const a = CR.a;
    for (let q = 0; q < CR.n; q++) { const b = q * 9, x = a[b], z = a[b + 1], co = a[b + 2], si = a[b + 3], hl = a[b + 4], hw = a[b + 5], y0 = a[b + 6], y1 = a[b + 7], ext = hl + hw + rr + .2;
      if (Math.max(ax, ax + dx) < x - ext || Math.min(ax, ax + dx) > x + ext || Math.max(az, az + dz) < z - ext || Math.min(az, az + dz) > z + ext) continue;
      const ox = ax - x, oz = az - z, lx = ox * co - oz * si, lz = ox * si + oz * co, ldx = dx * co - dz * si, ldz = dx * si + dz * co;
      const t = rr > 0 ? sphereBox(lx, ay, lz, ldx, dy, ldz, rr, -hw, y0, -hl, hw, y1, hl) : rayBox(lx, ay, lz, ldx, dy, ldz, -hw, y0, -hl, hw, y1, hl);
      if (t < 0 || t >= R.t) continue; const nx = NRM[0], nz = NRM[2]; NRM[0] = nx * co + nz * si; NRM[2] = -nx * si + nz * co; take(t, 'car', false, CR.ref[q]); } }
  function groundHit(ay, dy, r) { if (ay < r) { if (dy < 0 || r === 0) { NRM[0] = NRM[2] = 0; NRM[1] = 1; take(0, 'ground'); } return; } if (ay + dy < r) { NRM[0] = NRM[2] = 0; NRM[1] = 1; take((ay - r) / -dy, 'ground'); } }

  // ── the public queries
  const statMask = m => m & STATIC ? 1 : m & STATIC_WIDE ? 2 : m & STATIC_THIN ? 3 : 0;   // (STATIC_THIN: overlap / distance only)
  const bad = (...v) => { for (const p of v) if (!(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) { stat.nonFinite = (stat.nonFinite || 0) + 1; return true; } return false; };   // (a NaN point would walk the DDA to its guard: refuse it)
  function ray(a, b, mask = STATIC, skip = null) { reset(); if (bad(a, b)) return null; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, sm = statMask(mask);
    if (sm && sm < 3) { groundHit(a.y, dy, 0); rayStatic(a.x, a.y, a.z, dx, dy, dz, sm === 2); }
    if (mask & PEOPLE) rayPeople(a.x, a.y, a.z, dx, dy, dz, 0, skip, false); if (mask & CARS) rayCars(a.x, a.y, a.z, dx, dy, dz, 0); return result(); }
  function sweep(a, b, r, mask = STATIC, skip = null) { reset(); if (bad(a, b)) return null; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, sm = statMask(mask);
    if (sm && sm < 3) { groundHit(a.y, dy, r); sweepStatic(a.x, a.y, a.z, dx, dy, dz, r, sm === 2); }
    if (mask & PEOPLE) rayPeople(a.x, a.y, a.z, dx, dy, dz, r, skip, true); if (mask & CARS) rayCars(a.x, a.y, a.z, dx, dy, dz, r); return result(); }
  function overlap(p, r, mask = STATIC, skip = null) { let best = null; if (bad(p)) return null; const sm = statMask(mask);
    const keep = (depth, nx, ny, nz, kind, who = null) => { if (depth > 0 && (!best || depth > best.depth)) best = { depth, n: [nx, ny, nz], kind, who }; };
    if (sm) { if (p.y < r && sm < 3) keep(r - p.y, 0, 1, 0, 'ground');
      boxesNear(p.x, p.y, p.z, r, sm, (x0, y0, z0, x1, y1, z1) => { const qx = Math.max(x0, Math.min(x1, p.x)), qy = Math.max(y0, Math.min(y1, p.y)), qz = Math.max(z0, Math.min(z1, p.z)), ex = p.x - qx, ey = p.y - qy, ez = p.z - qz, d = Math.hypot(ex, ey, ez);
        if (d >= r) return false; if (d > 1e-9) { keep(r - d, ex / d, ey / d, ez / d, 'static'); return false; }
        // inside the box: the shortest way out through a free neighbour (a span's top or bottom, or a column free at this height)
        const gx = Math.floor(p.x * INV), gz = Math.floor(p.z * INV); let bd = y1 - p.y, n = [0, 1, 0];
        if (y0 > .05 && p.y - y0 < bd) { bd = p.y - y0; n = [0, -1, 0]; }
        for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let s = 1; s <= 8; s++) { const dd = sx > 0 ? (gx + s) * CS - p.x : sx < 0 ? p.x - (gx - s + 1) * CS : sz > 0 ? (gz + s) * CS - p.z : p.z - (gz - s + 1) * CS; if (dd >= bd) break;
          if (freeAt(gx + sx * s, gz + sz * s, p.y)) { bd = dd; n = [sx, 0, sz]; break; } }
        keep(r + bd, n[0], n[1], n[2], 'static'); return false; }); }
    if (mask & PEOPLE) { dyn(); const a = WK.a, Rw = cfg.walkerR + r; for (let q = 0; q < WK.n; q++) { const b = q * 4, x = a[b], z = a[b + 1]; if (Math.abs(x - p.x) > Rw || Math.abs(z - p.z) > Rw) continue; const w = WK.ref[q]; if (skipped(w, skip)) continue;
        const y0 = a[b + 2] + cfg.walkerR, y1 = Math.max(y0, a[b + 3] - cfg.walkerR), yy = Math.max(y0, Math.min(y1, p.y)), ex = p.x - x, ey = p.y - yy, ez = p.z - z, d = Math.hypot(ex, ey, ez);
        if (d < Rw) { const hd = Math.hypot(ex, ez); keep(Rw - d, d > 1e-6 ? ex / d : 1, d > 1e-6 ? ey / d : 0, d > 1e-6 ? ez / d : 0, 'person', w); } } }
    if (mask & CARS) { dyn(); const a = CR.a; for (let q = 0; q < CR.n; q++) { const b = q * 9, x = a[b], z = a[b + 1], co = a[b + 2], si = a[b + 3], hl = a[b + 4], hw = a[b + 5], y0 = a[b + 6], y1 = a[b + 7]; if (Math.abs(x - p.x) > hl + hw + r || Math.abs(z - p.z) > hl + hw + r) continue;
        const ox = p.x - x, oz = p.z - z, lx = ox * co - oz * si, lz = ox * si + oz * co, qx = Math.max(-hw, Math.min(hw, lx)), qy = Math.max(y0, Math.min(y1, p.y)), qz = Math.max(-hl, Math.min(hl, lz)), ex = lx - qx, ey = p.y - qy, ez = lz - qz, d = Math.hypot(ex, ey, ez);
        let nx, ny, nz, depth; if (d > 1e-9) { if (d >= r) continue; depth = r - d; nx = ex / d; ny = ey / d; nz = ez / d; } else { const k = exitAxis(lx, p.y, lz, -hw, y0, -hl, hw, y1, hl); nx = k[0]; ny = k[1]; nz = k[2]; depth = r + Math.min(hw - Math.abs(lx), hl - Math.abs(lz), y1 - p.y); }
        keep(depth, nx * co + nz * si, ny, -nx * si + nz * co, 'car', CR.ref[q]); } }
    return best; }
  const inside = (p, mask = STATIC, skip = null) => !!overlap(p, 1e-4, mask, skip);
  function distance(p, R_, mask = STATIC, skip = null) { let best = R_; if (bad(p)) return R_; const sm = statMask(mask);
    if (sm) { if (sm < 3) best = Math.min(best, Math.max(0, p.y)); boxesNear(p.x, p.y, p.z, best, sm, (x0, y0, z0, x1, y1, z1) => { const d = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(y0 - p.y, 0, p.y - y1), Math.max(z0 - p.z, 0, p.z - z1)); if (d < best) best = d; return best === 0; }); }
    if (mask & PEOPLE) { dyn(); const a = WK.a; for (let q = 0; q < WK.n; q++) { const b = q * 4, x = a[b], z = a[b + 1]; if (Math.abs(x - p.x) > best + 1 || Math.abs(z - p.z) > best + 1) continue; if (skipped(WK.ref[q], skip)) continue;
        const y0 = a[b + 2] + cfg.walkerR, y1 = Math.max(y0, a[b + 3] - cfg.walkerR), d = Math.sqrt(segDist2(p.x, p.y, p.z, x, y0, z, x, y1, z)) - cfg.walkerR; if (d < best) best = Math.max(0, d); } }
    if (mask & CARS) { dyn(); const a = CR.a; for (let q = 0; q < CR.n; q++) { const b = q * 9, x = a[b], z = a[b + 1], hl = a[b + 4], hw = a[b + 5]; if (Math.abs(x - p.x) > best + hl + hw || Math.abs(z - p.z) > best + hl + hw) continue;
        const co = a[b + 2], si = a[b + 3], ox = p.x - x, oz = p.z - z, lx = ox * co - oz * si, lz = ox * si + oz * co, d = Math.hypot(Math.max(Math.abs(lx) - hw, 0), Math.max(a[b + 6] - p.y, 0, p.y - a[b + 7]), Math.max(Math.abs(lz) - hl, 0)); if (d < best) best = d; } }
    return best; }
  // out of whatever the sphere is in: push out along the deepest overlap (4 rounds), else search rings outward (and up) for a free spot
  function nearestFree(p, r, mask = STATIC, maxR = 3, skip = null) { const q = { x: p.x, y: p.y, z: p.z };
    for (let k = 0; k < 4; k++) { const o = overlap(q, r, mask, skip); if (!o) return { ...q, d: Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) }; const s = o.depth + .01; q.x += o.n[0] * s; q.y += o.n[1] * s; q.z += o.n[2] * s; }
    for (let s = .25; s <= maxR + 1e-6; s += .25) { let best = null; const n = Math.max(8, Math.round(s * 12));
      for (let k = 0; k <= n; k++) { const c = k === n ? { x: p.x, y: p.y + s, z: p.z } : { x: p.x + Math.cos(k / n * 6.2832) * s, y: p.y, z: p.z + Math.sin(k / n * 6.2832) * s }; if (!overlap(c, r, mask, skip)) { best = c; break; } }
      if (best) return { ...best, d: s }; }
    return null; }
  // line of sight from a to each point: wide (a non-thin static column or a car), thin (only thin columns), people (another walker)
  function fan(a, pts, mask = STATIC | PEOPLE, skip = null) { let clear = 0, wide = 0, thin = 0, people = 0; const hits = [];
    for (const b of pts) { let h = ray(a, b, (mask & ~PEOPLE & ~STATIC) | STATIC_WIDE, skip), kind = 'clear';
      if (h) { kind = 'wide'; wide++; }
      else if ((mask & STATIC) && (h = ray(a, b, STATIC, skip))) { kind = 'thin'; thin++; }
      else if ((mask & PEOPLE) && (h = ray(a, b, PEOPLE, skip))) { kind = 'people'; people++; }
      else clear++; hits.push(kind); }
    return { vis: pts.length ? clear / pts.length : 1, wide, thin, people, hits }; }
  function column(x, z) { const c = col(Math.floor(x * INV), Math.floor(z * INV)); return c; }
  function floorAt(x, z, y) { const c = column(x, z); if (c < 0) return 0; let f = 0; const off = CE.off, iv = CE.iv; for (let k = off[c]; k < off[c + 1]; k += 2) if (iv[k + 1] <= y + 1e-4 && iv[k + 1] > f) f = iv[k + 1]; return f; }
  function ceilAt(x, z, y) { const c = column(x, z); if (c < 0) return Infinity; const off = CE.off, iv = CE.iv; for (let k = off[c]; k < off[c + 1]; k += 2) if (iv[k] >= y - 1e-4) return iv[k]; return Infinity; }
  function topAt(x, z) { const c = column(x, z); return c < 0 ? 0 : CE.top[c]; }
  function tierAt(x, z) { const e = entryAt(Math.floor(x / P), Math.floor(z / P)); return e ? e.tier : null; }
  const ready = (x, z) => { const t = tierAt(x, z); if (!t) return false; const r = stream()?.blocks.get(Math.floor(x / P) + ',' + Math.floor(z / P)), s = r && srcOf(r); return !s || RANK[t] >= RANK[s.tier]; };

  function tick(p) {
    if (p) { cam.x = p.x; cam.y = p.y; cam.z = p.z; }
    stat.mainMs += spent; if (spent > 0) stat.mainFrames++; stat.mainFrameMax = Math.max(stat.mainFrameMax, spent); stat.lastFrameMs = spent; spent = 0;
    frame++; epoch++; LK = NaN; syncFar = 0; scan();
    const ci = p ? Math.floor(p.x / P) : 0, cj = p ? Math.floor(p.z / P) : 0, moved = ci !== pre.i || cj !== pre.j; if (moved) { pre.i = ci; pre.j = cj; }
    if (cfg.prefetch >= 0 && p && (moved || frame % 8 === 0)) { const n = cfg.prefetch; for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) { const k = keyOf(i, j); if (!E.has(k)) ensure(i, j, k, false); else entryAt(i, j); } }
    if (frame % 30 === 0 || E.size > cfg.maxBlocks + 4) evict(); post();
    stat.blocks = E.size; stat.full = stat.mid = stat.far = 0; for (const e of E.values()) stat[e.tier]++; stat.pending = pend.size;
  }
  return {
    STATIC, PEOPLE, CARS, STATIC_WIDE, STATIC_THIN, ALL, THIN, cfg, stat,
    ray, sweep, overlap, inside, distance, nearestFree, fan, floorAt, ceilAt, topAt, tierAt, ready, tick,
    invalidate() { epoch++; },
    entry: (i, j) => entryAt(i, j), size: () => E.size,
    clear() { E.clear(); pend.clear(); queue.length = 0; misses.clear(); LK = NaN; },
    dispose() { worker && worker.terminate(); worker = null; },
  };
}
