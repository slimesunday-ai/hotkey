// CAMERA BUILD (2026-10-05) · THE CAMERA PROBE: the acceptance harness of camera/RESEARCH.md §5, grown from its Appendix A probe.
// Headless Chrome on the running page; an in-page instrument measures the camera against GROUND TRUTH (the full tier's quads: every
// non-ground quad as an axis-aligned box, plus its horizontal quads for floors and point-in-solid), independent of solid.js and world.js.
//   node style/city/tools/camprobe.mjs [--only a,l,b,o,c,d,tab,corner,hover,look,inject,units] [--hz 30,60,120] [--out <name>]
//        [--shots <dir>] [--extra 'k=v&k=v'] [--quick] [--rows] [--base http://127.0.0.1:5388/style/city/] [--record] [--live] [--cfg '<json>']
//   --out writes tools/runs/<name>.json (the metrics table + per-scenario summaries; --rows keeps every per-frame row too)
// Scenarios (default: all but units)
//   a       FOLLOW on real walkers: A1 Fit Street, A2 (20, −20), A3 (−30, 60); 30 s each, Tab every 10 s. DETERMINISTIC (camera build
//           2b): the crowd round the subjects (and the subjects, and the switches) as the rig followed them once in real time, recorded in
//           tools/runs/camprobe-crowd.json.gz (--record re-records it and exits), replayed at fixed dt into a private follow on a private
//           collision world at each --hz — the same rows every run. --live: the old real-time run on the live page (varies run to run)
//   l       FOLLOW past 4 real corner lamps (ground.js cornerLamps) at 0 / .3 / .6 / 1.0 m off the lamp line; a scripted walker on the
//           GT sidewalk at 1.35 m/s, from ≤ 7 m before the lamp to ≤ 9 m past it, clipped where its torso would enter a non-THIN solid
//           (camera build 2b: the old 16 s walk went through benches and boxes in all 16 passes); a private follow at each --hz
//   --review --shots <dir> [--follow-src <file>] [--clip] [--snaps 'A3:12.5,17;L1@0:11.6']: before / after renders of the same lamp
//           passes and replays at the given moments (+ a live clip)
//   b       FOLLOW frame-rate: A1's longest single-subject path (recorded) replayed into a private follow controller at each --hz
//   o       FOLLOW orbit: a standing subject on the most open ground found nearby, 2 rad/s orbit input for 1.5 s, at each --hz
//   corner  FOLLOW a scripted walker round a building's corner (the sidewalk 1.2 m in from the slab edge), at each --hz
//   tab     FOLLOW on real walkers (replayed as a): Tab every 2.5 s, six switches (F12: glide clearance ≤ 25 m, a cut beyond)
//   c       FLY, fixed dt (private fly controller): full boost at a wall 75 m off (Y2/Y3), a 30° glancing run (Y4), cruise and release
//           (Y5 glide), descend and release (Y6 floor), at each --hz
//   look    FLY mouse look (Y7): a 100 px delta in one frame at each --hz; and input.js fed a 1,000 px pointer-lock event
//   inject  FLY starting a frame 0.4 m inside a wall (Y8), at each --hz
//   d       FLY, real time, the rig's fly mode with synthetic keys: D1 W along a busy sidewalk, D1b W+Q down it, D2 W+Q down a busy
//           road, D3 boost into the wall
//   hover   FLY, real time: the camera still at 1.6 m over a busy sidewalk for 10 s (Y1)
//   units   world.js query checks against GT on 3 full-tier blocks at Fit Street: inside · floorAt · ray · sweep · distance · THIN · dynamic
//           shapes · query cost (µs) · build cost (worker ms, main-thread ms/frame) — camera/world.js (RESEARCH §4.2)
// Metrics (computed here, in node, from the per-frame rows): F1–F13, Y1–Y8, P1–P5, R1–R2 (R3: tools/flythrough.mjs --only camfly,camfollow).
// Kinematics: finite differences with each row's dt; acceleration and angular acceleration need three valid frames in a row; "no input"
// excludes the 2.5 s after a subject switch (Tab) and any blend. Angular rates come from the view's yaw and pitch (Euler YXZ).
// ADAPTER (in pageProbe): makeFollow / makeFly / followArm are the one place later agents point at the new controllers and world.js.
// The page must be served: node style/serve.mjs 5388
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url)), RUNS = path.join(HERE, 'runs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', process.env.CITY_URL || 'http://127.0.0.1:5388/style/city/'), EXTRA = opt('extra', ''), OUT = opt('out', null), SHOTS = opt('shots', null);
const ALL = ['a', 'l', 'b', 'o', 'corner', 'tab', 'c', 'look', 'inject', 'd', 'hover'];
const ONLY = new Set(opt('only', ALL.join(',')).split(',')), HZ = opt('hz', '30,60,120').split(',').map(Number), QUICK = args.includes('--quick'), ROWS = args.includes('--rows');
// the recorded crowd (A, tab and B replay it): --record re-records it (the rig's own follow on the live page, real time) and exits
const CFG = opt('cfg', null), FSRC = opt('follow-src', null), REVIEW = args.includes('--review');   // --cfg '{"follow":{...}}': deep-merged into the live CAM config before the scenarios (tuning runs)
const RECORD = args.includes('--record'), CROWD = path.join(RUNS, opt('crowd', 'camprobe-crowd') + '.json.gz'), LIVE = args.includes('--live');
const W = 1280, H = 720;

// ══ in the page ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
async function pageProbe() {
  const C = window.__city, THREE = C.THREE, R = C.cam;
  const { P } = await import(new URL('plan.js', location.href).href);
  const { createFly } = await import(new URL('camera/fly.js', location.href).href);
  const { createFollow } = await import(new URL(window.__cpFollowSrc || 'camera/follow.js', location.href).href);   // (--follow-src: another follow.js, e.g. a "before" copy for a review board)
  const { CAM } = await import(new URL('camera/config.js', location.href).href);
  const { cornerLamps, slab: slabOf } = await import(new URL('ground.js', location.href).href);
  const WM = await import(new URL('camera/world.js', location.href).href);
  const { createPeople } = await import(new URL('camera/follow.js', location.href).href);

  // ── DETERMINISM (camera build 2b): every fixed-dt FOLLOW scenario runs a PRIVATE follow on a PRIVATE collision world whose people and
  // cars are a CROWD the probe owns — none (the scripted lamp / corner / orbit walkers), or a recorded crowd replayed (A, tab, B: the
  // real walkers round real subjects, recorded once by --record into tools/runs/camprobe-crowd.json.gz). Nothing live moves in it and
  // the steps are fixed dt with no frames in between, so the same scenario gives the same rows run after run. The GT people / cars
  // (F1, F13) read the same crowd.
  let CROWD = null;
  function makePrivate(crowd = { walkers: [], cars: [] }) { CROWD = crowd; const peds = { sim: { walkers: crowd.walkers } }, traffic = { sim: { cars: crowd.cars }, MODELS: C.traffic?.MODELS };
    const world = WM.createWorld({ get stream() { return C.stream; }, peds, traffic }, { maxBlocks: 160, keepR: 600, copyQuads: 4e6 }), people = createPeople(() => peds);
    return { world, people, fol: createFollow(world, people), done() { world.dispose(); CROWD = null; } }; }
  // ── ADAPTER: later agents point these at the new controllers / world.js (follow: world.js since camera build 2/4; fly: solid.js still)
  let PRIV = null;
  const endPriv = () => { PRIV?.done(); PRIV = null; }, makeFollow = crowd => { endPriv(); PRIV = makePrivate(crowd); return PRIV.fol; };
  const makeFly = () => createFly(R.solids);
  const collTick = (p = null) => { R.solids?.tick?.(); if (PRIV) PRIV.world.tick(p || PRIV.fol.pose.p); else R.world?.invalidate?.(); };   // once per fixed-dt step, as the rig does once a frame (solid.js's rasterising budget; world.js's prefetch and dynamic shapes)
  // the follow arm this frame: [allowed length, wanted length] (HEAD's dbg; else the camera's distance to the look point vs the config)
  const followArm = (fol, s) => { const d = fol.dbg; if (d && d.allowed !== undefined) return { arm: d.allowed, want: d.dist, L: d.L, pitch: d.pitch };
    const p = fol.pose.p, lh = CAM.follow.lookH ?? 1.35; return { arm: Math.hypot(p.x - s[0], p.y - s[1] - lh, p.z - s[2]), want: CAM.follow.dist, L: [s[0], s[1] + lh, s[2]], pitch: CAM.follow.pitch }; };
  // make the collision data around (x, z) current before a fixed-dt run (world.js: its worker builds each block's best tier — frames must
  // run, so this waits; solid.js rasterises a few ms a frame — no frames run inside a fixed loop)
  async function prewarmWorld(x, z, r = 48, x1 = x, z1 = z) { const Wd = PRIV?.world || R.world; if (!Wd?.ready) return 0; const i0 = Math.floor((Math.min(x, x1) - r) / P), i1 = Math.floor((Math.max(x, x1) + r) / P), j0 = Math.floor((Math.min(z, z1) - r) / P), j1 = Math.floor((Math.max(z, z1) + r) / P), t0 = performance.now();
    for (let it = 0; performance.now() - t0 < 30000; it++) { let all = true; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { Wd.entry(i, j); if (C.stream.blocks.get(i + ',' + j) && !Wd.ready(i * P + 16, j * P + 16)) all = false; }
      if (PRIV) PRIV.world.tick({ x: (x + x1) / 2, y: 2, z: (z + z1) / 2 }); if (all && it > 2) break; await new Promise(r => requestAnimationFrame(r)); }
    return performance.now() - t0; }
  function prewarm(x, z, r = 48) { const S = R.solids; if (!S?.slab) return 0; const i0 = Math.floor((x - r) / P), i1 = Math.floor((x + r) / P), j0 = Math.floor((z - r) / P), j1 = Math.floor((z + r) / P);
    let still = 0, it = 0; for (; it < 4000 && still < 80; it++) { const b0 = S.stat.built; S.tick(); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) S.slab(i * P + 16, j * P + 16); still = S.stat.built === b0 ? still + 1 : 0; }
    return it; }

  // ── GROUND TRUTH: per block, every non-ground quad (top ≥ .3 m) of the full tier (else mid, else far) as an AABB, and every horizontal quad
  // with its facing (+1 up, −1 down), both bucketed into 1 m cells. A box is listed in every cell it touches (boundary cells too: a wall face
  // lying exactly on a cell line is in both). Point-in-solid: the faces above a point that contain it, up +1, down −1: > 0 is inside.
  const GT = new Map();
  function gtBlock(i, j) {
    const k = i + ',' + j, r = C.stream.blocks.get(k); if (!r) return null;
    const full = Array.isArray(r.data.full) ? r.data.full.filter(t => t && t.n) : [];
    const src = full.length ? full : r.data.mid?.P ? [r.data.mid] : r.data.far?.P ? [r.data.far] : null; if (!src) return null;
    let g = GT.get(k); if (g && (g.src === src[0] || (g.tier === 'full' && !full.length))) { GT.delete(k); GT.set(k, g); return g; }   // (sticky: the full tier, once seen, stays the GT)
    let nq = 0; for (const t of src) nq += t.n / 4; const B = new Float32Array(nq * 6), HQ = new Float32Array(nq * 6); let m = 0, h = 0;
    const cells = Array.from({ length: P * P }, () => []), hcells = Array.from({ length: P * P }, () => []);
    const reg = (list, ax, bx, az, bz, id) => { const ix0 = Math.max(0, Math.floor(ax - r.x0 - 1e-4)), ix1 = Math.min(P - 1, Math.floor(bx - r.x0 + 1e-4)), iz0 = Math.max(0, Math.floor(az - r.z0 - 1e-4)), iz1 = Math.min(P - 1, Math.floor(bz - r.z0 + 1e-4));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) list[iz * P + ix].push(id); };
    for (const t of src) { const p = t.P, nn = t.N, o = t.o;
      for (let q = 0; q < t.n; q += 4) { let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9, az = 1e9, bz = -1e9;
        for (let v = q * 3, e = v + 12; v < e; v += 3) { const x = p[v] * .01 + o[0], y = p[v + 1] * .01 + o[1], z = p[v + 2] * .01 + o[2];
          if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y; if (z < az) az = z; if (z > bz) bz = z; }
        const ny = nn ? nn[q * 3 + 1] : 0;
        if (by - ay < .005 && Math.abs(ny) > 100 && ay > .02) { const b = h * 6; HQ[b] = ax; HQ[b + 1] = az; HQ[b + 2] = bx; HQ[b + 3] = bz; HQ[b + 4] = ay; HQ[b + 5] = ny > 0 ? 1 : -1; reg(hcells, ax, bx, az, bz, h); h++; }
        if (by < .3) continue; const b = m * 6; B[b] = ax; B[b + 1] = ay; B[b + 2] = az; B[b + 3] = bx; B[b + 4] = by; B[b + 5] = bz; reg(cells, ax, bx, az, bz, m); m++; } }
    g = { src: src[0], B: B.slice(0, m * 6), n: m, H: HQ.slice(0, h * 6), nh: h, cells, hcells, x0: r.x0, z0: r.z0, tier: full.length ? 'full' : r.data.mid?.P ? 'mid' : 'far' };
    GT.set(k, g); while (GT.size > 96) GT.delete(GT.keys().next().value); return g;
  }
  const gtTier = (x, z) => gtBlock(Math.floor(x / P), Math.floor(z / P))?.tier || 'none';
  function cellQuads(x, z, cb) { const i = Math.floor(x / P), j = Math.floor(z / P), g = gtBlock(i, j); if (!g) return; const ix = Math.floor(x - g.x0), iz = Math.floor(z - g.z0);
    if (ix < 0 || iz < 0 || ix >= P || iz >= P) return; for (const q of g.cells[iz * P + ix]) cb(g, q); }
  // first hit of segment a→b (fraction 0…1) against the GT boxes: { f, g, q }
  function segHit(ax, ay, az, bx, by, bz, from = 0) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if (L < 1e-6) return null; let best = 1, bq = -1, bg = null; const done = new Set();
    for (let s = 0; s <= L + .2; s += .25) { const f = Math.min(1, s / L), x = ax + dx * f, z = az + dz * f;
      for (const ox of [-.3, 0, .3]) for (const oz of [-.3, 0, .3]) { const cx = Math.floor(x + ox), cz = Math.floor(z + oz), ck = cx * 100003 + cz; if (done.has(ck)) continue; done.add(ck);
        cellQuads(cx + .5, cz + .5, (g, q) => { const B = g.B, b = q * 6; let t0 = 0, t1 = 1; const e = .005;
          for (let k = 0; k < 3; k++) { const o = k === 0 ? ax : k === 1 ? ay : az, d = k === 0 ? dx : k === 1 ? dy : dz, lo = B[b + k] - e, hi = B[b + 3 + k] + e;
            if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; continue; } let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) { const s2 = ta; ta = tb; tb = s2; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return; }
          if (t0 >= from && t0 < best) { best = t0; bq = q; bg = g; } }); } }
    return bq < 0 ? null : { f: best, g: bg, q: bq };
  }
  // distance from a point to the nearest GT box within rad (and the ground plane y = 0)
  function minDist(x, y, z, rad = .8) { let best = 1e9; for (let cx = Math.floor(x - rad); cx <= Math.floor(x + rad); cx++) for (let cz = Math.floor(z - rad); cz <= Math.floor(z + rad); cz++)
      cellQuads(cx + .5, cz + .5, (g, q) => { const B = g.B, b = q * 6; const ddx = Math.max(B[b] - x, 0, x - B[b + 3]), ddy = Math.max(B[b + 1] - y, 0, y - B[b + 4]), ddz = Math.max(B[b + 2] - z, 0, z - B[b + 5]); const d = Math.hypot(ddx, ddy, ddz); if (d < best) best = d; });
    return Math.min(best, y); }
  // point in solid (the horizontal faces above the point that contain it: up +1, down −1)
  function gtInside(x, y, z) { x += 1.3e-3; z += 1.7e-3; const g = gtBlock(Math.floor(x / P), Math.floor(z / P)); if (!g) return false; const ix = Math.floor(x - g.x0), iz = Math.floor(z - g.z0), HQ = g.H; let s = 0;
    for (const q of g.hcells[iz * P + ix]) { const b = q * 6; if (x < HQ[b] || x > HQ[b + 2] || z < HQ[b + 1] || z > HQ[b + 3] || HQ[b + 4] <= y) continue; s += HQ[b + 5]; } return s > 0; }
  // the floor under (x, z): the highest up-facing quad top ≤ yMax (else 0)
  function gtFloor(x, z, yMax = 1) { x += 1.3e-3; z += 1.7e-3; const g = gtBlock(Math.floor(x / P), Math.floor(z / P)); if (!g) return 0; const ix = Math.floor(x - g.x0), iz = Math.floor(z - g.z0), HQ = g.H; let f = 0;
    for (const q of g.hcells[iz * P + ix]) { const b = q * 6; if (HQ[b + 5] < 0 || x < HQ[b] || x > HQ[b + 2] || z < HQ[b + 1] || z > HQ[b + 3] || HQ[b + 4] > yMax) continue; if (HQ[b + 4] > f) f = HQ[b + 4]; } return f; }
  // is the solid that box q belongs to THIN at height hy (a post, a pole, a sign mast)? Grow its xz footprint through touching boxes within ±.5 m of hy
  function gtThin(g, q, hy) { const B = g.B, b = q * 6; let x0 = B[b], x1 = B[b + 3], z0 = B[b + 2], z1 = B[b + 5];
    for (let it = 0; it < 4; it++) { let grew = false;
      for (let cx = Math.floor(x0 - .6); cx <= Math.floor(x1 + .6); cx++) for (let cz = Math.floor(z0 - .6); cz <= Math.floor(z1 + .6); cz++) cellQuads(cx + .5, cz + .5, (g2, q2) => { const B2 = g2.B, c = q2 * 6;
        if (B2[c + 1] > hy + .5 || B2[c + 4] < hy - .5 || B2[c] > x1 + .05 || B2[c + 3] < x0 - .05 || B2[c + 2] > z1 + .05 || B2[c + 5] < z0 - .05) return;
        if (B2[c] < x0) { x0 = B2[c]; grew = true; } if (B2[c + 3] > x1) { x1 = B2[c + 3]; grew = true; } if (B2[c + 2] < z0) { z0 = B2[c + 2]; grew = true; } if (B2[c + 5] > z1) { z1 = B2[c + 5]; grew = true; } });
      if (Math.max(x1 - x0, z1 - z0) > .75) return false; if (!grew) break; }
    return Math.max(x1 - x0, z1 - z0) <= .75; }

  // ── people and cars (their CPU-side state; walker capsule feet + .3 → + 1.45 m, r .3; car box len × wid × 1.55 m)
  const walkers = () => CROWD ? CROWD.walkers : C.peds?.sim?.walkers || [], cars = () => CROWD ? CROWD.cars : C.traffic?.sim?.cars || [];
  const capD = (w, x, y, z) => { const yy = Math.max(w.p[1] + .3, Math.min(w.p[1] + 1.45, y)); return Math.hypot(x - w.p[0], y - yy, z - w.p[2]) - .3; };
  function nearestPerson(x, y, z, skip = null, extra = null) { let best = 1e9, bw = null; const scan = w => { if (w === skip || w.gone) return; const dx = w.p[0] - x, dz = w.p[2] - z; if (dx * dx + dz * dz > 25) return; const d = capD(w, x, y, z); if (d < best) { best = d; bw = w; } };
    for (const w of walkers()) scan(w); if (extra) for (const w of extra) scan(w); return [best, bw]; }
  function nearestCar(x, y, z) { let best = 1e9; for (const c of cars()) { if (c.gone) continue; const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz > 100) continue; const s = Math.sin(c.h), co = Math.cos(c.h), lz = dx * s + dz * co, lx = dx * co - dz * s;
      const hl = (c.len || 4.4) / 2, hw = (c.wid || 1.9) / 2, ex = Math.max(Math.abs(lx) - hw, 0), ez = Math.max(Math.abs(lz) - hl, 0), ey = Math.max(y - 1.55, 0, -y); let d = Math.hypot(ex, ey, ez);
      if (d === 0) d = -Math.min(hw - Math.abs(lx), hl - Math.abs(lz), 1.55 - y); if (d < best) best = d; } return best; }
  function segPerson(a, b, skip) { let hit = 0; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1;
    for (const w of walkers()) { if (w === skip || w.gone) continue; const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; if ((w.p[0] - mx) ** 2 + (w.p[2] - mz) ** 2 > (L / 2 + 1) ** 2) continue;
      for (let s = .5; s < L - .3; s += .2) { if (capD(w, a.x + dx / L * s, a.y + dy / L * s, a.z + dz / L * s) < 0) { hit++; break; } } } return hit; }
  // subject visibility: 12 rays camera → body (4 heights × 3 lateral); blocked rays are THIN (a post) or WIDE; people on the camera → chest line
  const SV = new THREE.Vector3();
  function visibility(cam, w) { const yaw = Math.atan2(w.p[0] - cam.x, w.p[2] - cam.z), lx = Math.cos(yaw), lz = -Math.sin(yaw); let vis = 0, n = 0, thin = 0, wide = 0;
    for (const h of [.4, .85, 1.25, 1.6]) for (const o of [-.17, 0, .17]) { n++; const tx = w.p[0] + lx * o, ty = w.p[1] + h, tz = w.p[2] + lz * o;
      const dd = Math.hypot(tx - cam.x, ty - cam.y, tz - cam.z), hit = segHit(cam.x, cam.y, cam.z, tx, ty, tz, Math.min(.9, .35 / dd));   // (from .35 m out: a solid round the camera itself is F1's near-clip, not an occluder — back faces are culled)
      if (!hit || hit.f * dd > dd - .35) { vis++; continue; } if (gtThin(hit.g, hit.q, cam.y + (ty - cam.y) * hit.f)) thin++; else wide++; }
    SV.set(w.p[0], w.p[1] + 1.2, w.p[2]); return { vis: vis / n, thin, wide, people: segPerson(cam, SV, w) }; }

  const raf = () => new Promise(r => requestAnimationFrame(r)), ROWS_IN = !!window.__cpRows;   // (--rows: the lamp rows keep the controller's dbg too)
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
  const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100, r5 = v => Math.round(v * 1e5) / 1e5;   // (r5: the camera position — mm rounding alone is ~29 m/s² of second-difference noise at 120 Hz)
  async function settle(maxMs = 15000) { const t0 = performance.now(); let n = 0; while (performance.now() - t0 < maxMs) { await raf(); if (C.stream.settled?.()) { if (++n > 12) break; } else n = 0; } return performance.now() - t0; }
  async function orbitAt(x, z, h = 28) { R.toOrbit({ instant: true }); C.camera.position.set(x + h * .6, h, z + h * .6); C.controls.target.set(x, 0, z); C.controls.update(); for (let k = 0; k < 3; k++) await raf(); return settle(); }
  const shots = [];
  function capture(name, notes = [], mark = null, jpeg = false) { C.renderer.render(C.scene, C.camera); const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d');
    g.drawImage(C.renderer.domElement, 0, 0, 960, 540);
    if (mark) { const v = new THREE.Vector3(...mark).project(C.camera); if (v.z < 1) { g.strokeStyle = '#ff2a6a'; g.lineWidth = 3; g.beginPath(); g.arc((v.x + 1) / 2 * 960, (1 - v.y) / 2 * 540, 22, 0, 7); g.stroke(); } }
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, 0, 960, 18 + notes.length * 17); g.fillStyle = '#fff'; g.font = '13px monospace'; notes.forEach((s, k) => g.fillText(s, 8, 16 + k * 17));
    shots.push({ name, data: jpeg ? c.toDataURL('image/jpeg', .88) : c.toDataURL('image/png') }); }
  let marker = null;
  function mark(p) { if (!marker) { marker = new THREE.Mesh(new THREE.CapsuleGeometry(.28, 1.1, 4, 8), new THREE.MeshBasicMaterial({ color: 0xff2a9a })); C.scene.add(marker); } marker.visible = !!p; if (p) marker.position.set(p[0], p[1] + .85, p[2]); }
  const yawPitch = q => { const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); return [e.y, e.x]; };
  const noInput = { look: { x: 0, y: 0 }, move: { x: 0, y: 0, z: 0 }, rate: { x: 0, y: 0 }, wheel: 0, boost: false, slow: false, pad: false, key: () => false, any: () => false };

  // ── the rig's cost per frame (R1): update (+ late, when the rig has one) wrapped; the sum per frame is read at the probe's rAF
  const PR = { acc: 0 };
  if (R && !R.__cpWrap) { R.__cpWrap = true; const u = R.update; R.update = function (dt) { const t0 = performance.now(); try { return u.call(this, dt); } finally { PR.acc += performance.now() - t0; } };
    if (typeof C.late === 'function') { const l = C.late; C.late = function (dt) { const t0 = performance.now(); try { return l.call(this, dt); } finally { PR.acc += performance.now() - t0; } }; } }
  const takePerf = () => { const v = PR.acc; PR.acc = 0; return v; };
  // the slab grid's rasterising this frame, exactly: its tick() folds `spent` into a decaying max; zero the max first and read it back
  const SP = { last: 0 };
  if (R?.solids?.tick && !R.solids.__cpWrap) { const So = R.solids, t0 = So.tick; So.__cpWrap = true; So.tick = function () { const keep = So.stat.frameMax; So.stat.frameMax = 0; t0.call(this); SP.last = So.stat.frameMax; So.stat.frameMax = Math.max(keep * .995, SP.last); }; }
  // R2: main-thread time building collision data in a frame (world.js when the rig has one, else the slab grid's rasterising)
  const collStat = () => { const w = R.world?.stat; if (w) return { kind: 'world', frameMax: w.mainFrameMax ?? null, ms: w.mainMs ?? null, frames: w.mainFrames ?? null };
    const s = R.solids?.stat; return s ? { kind: 'solids', frameMax: s.frameMax, maxMs: s.maxMs, built: s.built } : null; };
  const collFrame = () => R.world?.stat ? (R.world.stat.mainFrameMax ?? 0) : SP.last;   // (world.js: its own per-frame max; the slab grid: this frame's rasterising)

  // ── A / tab. FOLLOW, real time: the rig's own follow mode on real walkers, Tab every `tab` s; per frame the ground truth
  // rec: also RECORD the crowd each frame (every walker and car within 16 m of the subject or the camera) and the subject's id — the
  // fixture the fixed-dt replays (followReplay) drive; t, sid, walkers [id, x, y, z, yaw, vc, tier | fix·8], cars [id, x, y, z, h, len, wid, model]
  async function followReal({ view = null, at = null, dur = 30, tab = 10, label = 'A', shoot = false, rec = false } = {}) { endPriv();
    R.toOrbit({ instant: true }); if (view) { C.setView(view); await settle(); } else await orbitAt(at[0], at[1]);
    for (let k = 0; k < 90; k++) await raf();
    R.follow.drop?.(); if (!R.setMode('follow')) return { error: 'nobody to follow' };   // (drop: the person nearest this spot, not the last spot's)
    for (let k = 0; k < 10; k++) await raf();
    const F = [], lh = CAM.follow.lookH ?? 1.35, RF = []; let t0 = performance.now(), last = t0, tabs = 0, lastShot = -9, occRun = 0, cmax = 0; takePerf();
    while (true) { const now = await raf(), t = (now - t0) / 1000; if (t > dur) break; const dt = (now - last) / 1000; last = now; const ms = takePerf(); cmax = Math.max(cmax, collFrame());
      if (rec) { const s = R.follow.subject, cp = C.camera.position, sx = s ? s.p[0] : cp.x, sz = s ? s.p[2] : cp.z, near = (x, z) => (x - sx) ** 2 + (z - sz) ** 2 < 256 || (x - cp.x) ** 2 + (z - cp.z) ** 2 < 256;
        RF.push([r3(t), s ? s.id : -1, walkers().filter(o => !o.gone && near(o.p[0], o.p[2])).map(o => [o.id, r3(o.p[0]), r3(o.p[1]), r3(o.p[2]), +(o.yawS ?? o.p[3]).toFixed(4), r3(o.vc ?? 0), (o.tier | 0) + (o.fix ? 8 : 0), ...(o.agent ? [o.aid] : [])]),
          cars().filter(c => !c.gone && near(c.x, c.z)).map(c => [c.id, r3(c.x), r3(c.y || 0), r3(c.z), +c.h.toFixed(4), c.len || 4.4, c.wid || 1.8, c.model ?? 0])]); }
      const w = R.follow.subject; if (!w || R.blending) F.push({ t: r3(t), dt: +dt.toFixed(4), ms: +ms.toFixed(3), blend: 1 });
      else { const cam = C.camera.position, [yaw, pitch] = yawPitch(C.camera.quaternion), v = visibility(cam, w), nc = minDist(cam.x, cam.y, cam.z, .8), [pd] = nearestPerson(cam.x, cam.y, cam.z), cd = nearestCar(cam.x, cam.y, cam.z);
        const a = followArm(R.follow, w.p), Ly = w.p[1] + lh, d3 = Math.hypot(cam.x - w.p[0], cam.y - Ly, cam.z - w.p[2]);
        F.push({ t: r3(t), dt: +dt.toFixed(4), ms: +ms.toFixed(3), c: [cam.x, cam.y, cam.z].map(r5), yaw: +yaw.toFixed(7), pitch: +pitch.toFixed(7), s: [w.p[0], w.p[1], w.p[2]].map(r3), sy: +(w.yawS ?? w.p[3]).toFixed(4), vc: +(w.vc ?? 0).toFixed(3), id: w.id,
          vis: r2(v.vis), thin: v.thin, wide: v.wide, ppl: v.people, nc: r3(nc), inside: gtInside(cam.x, cam.y, cam.z) ? 1 : 0, pd: r3(pd), cd: r3(cd), arm: r3(a.arm), want: r3(a.want), elev: +Math.asin(Math.max(-1, Math.min(1, (cam.y - Ly) / Math.max(1e-3, d3)))).toFixed(4), gt: gtTier(cam.x, cam.z)[0] });
        occRun = v.vis < .5 ? occRun + dt : 0;
        const ins = F[F.length - 1].inside;
        if (shoot && shots.length < 40 && t - lastShot > 2.5 && (occRun > .4 || nc < .12 || pd < 0 || ins)) { lastShot = t;
          capture(`${label}-follow-t${t.toFixed(1)}`, [`FOLLOW t=${t.toFixed(2)}s  ${ins ? 'camera INSIDE a solid (GT) · ' : ''}${v.vis < .5 ? (v.thin >= v.wide ? 'OCCLUDED by a thin prop' : 'OCCLUDED by a wall/mass') : nc < .12 ? 'NEAR-CLIP into geometry' : pd < 0 ? 'camera inside a walker' : ''}`, `visible ${Math.round(v.vis * 100)}% (thin ${v.thin}, wide ${v.wide}, people ${v.people}) · arm ${a.arm.toFixed(2)} of ${a.want.toFixed(2)} m · cam→geom ${nc.toFixed(2)} m · cam→person ${pd.toFixed(2)} m`], [w.p[0], w.p[1] + 1.2, w.p[2]]); } }
      if (t > (tabs + 1) * tab) { tabs++; key('Tab', true); key('Tab', false); } }
    R.toOrbit({ instant: true }); return rec ? { rec: { label, frames: RF } } : { F, coll: collStat(), collFrameMax: cmax };
  }

  // ── REPLAY (A, tab): a recorded crowd into a private follow at fixed dt (1/hz): the subject the rig followed (its switches at the recorded
  // times: fol.set → follow's own glide or cut), every walker and car interpolated between the recorded frames; per step the GT, as followReal
  function crowdOf(rec) { const W = new Map(), Cs = new Map();
    for (const fr of rec.frames) { for (const r of fr[2]) if (!W.has(r[0])) W.set(r[0], { id: r[0], p: [r[1], r[2], r[3], r[4]], yawS: r[4], vc: 0, tier: 1, gone: true, fix: null, ...(r.length > 7 ? { agent: true, aid: r[7] } : {}) });
      for (const c of fr[3]) if (!Cs.has(c[0])) Cs.set(c[0], { id: c[0], x: c[1], y: c[2], z: c[3], h: c[4], len: c[5], wid: c[6], model: c[7], gone: true }); }
    return { walkers: [...W.values()], cars: [...Cs.values()], W, Cs, T: rec.frames.map(f => f[0]), FW: rec.frames.map(f => new Map(f[2].map(r => [r[0], r]))), FC: rec.frames.map(f => new Map(f[3].map(c => [c[0], c]))), k: 0 }; }
  const lerpA = (a, b, f) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * f; };
  function crowdAt(cr, t) { const T = cr.T; let k = cr.k; while (k < T.length - 2 && T[k + 1] <= t) k++; while (k > 0 && T[k] > t) k--; cr.k = k; const f = Math.max(0, Math.min(1, (t - T[k]) / Math.max(1e-6, T[k + 1] - T[k])));
    const A = cr.FW[k], B = cr.FW[k + 1] || A;
    for (const w of cr.walkers) { const a = A.get(w.id); if (!a) { w.gone = true; continue; } const b = B.get(w.id) || a; w.gone = false;
      for (let i = 0; i < 3; i++) w.p[i] = a[1 + i] + (b[1 + i] - a[1 + i]) * f; w.yawS = w.p[3] = lerpA(a[4], b[4], f); w.vc = a[5] + (b[5] - a[5]) * f; w.tier = a[6] & 7; w.fix = a[6] & 8 ? [w.p[0], w.p[1], w.p[2]] : null; }
    const CA = cr.FC[k], CB = cr.FC[k + 1] || CA;
    for (const c of cr.cars) { const a = CA.get(c.id); if (!a) { c.gone = true; continue; } const b = CB.get(c.id) || a; c.gone = false; c.x = a[1] + (b[1] - a[1]) * f; c.y = a[2] + (b[2] - a[2]) * f; c.z = a[3] + (b[3] - a[3]) * f; c.h = lerpA(a[4], b[4], f); } }
  // make the full tier current along a recorded path (orbit over it, settle; the private world copies each block's columns, the GT caches them)
  async function readyPath(pts) { for (const [x, z] of pts) { await orbitAt(x, z, 18); await prewarmWorld(x, z, 40); const i0 = Math.floor((x - 40) / P), j0 = Math.floor((z - 40) / P);
      for (let i = i0; i <= Math.floor((x + 40) / P); i++) for (let j = j0; j <= Math.floor((z + 40) / P); j++) gtBlock(i, j); } }
  // snap: [t, …] s — render the camera's pose at those times (the subject marked: the live page's walkers are not the replayed crowd)
  function poseShot(name, fol, subj, notes) { C.camera.position.copy(fol.pose.p); C.camera.quaternion.copy(fol.pose.q); C.camera.fov = fol.pose.fov || 55; C.camera.updateProjectionMatrix(); mark(subj); capture(name, notes, null, true); mark(null); }
  async function followReplay(rec, hz, { warm = 1, snap = [], label = 'A' } = {}) {
    const cr = crowdOf(rec), fol = makeFollow(cr), dt = 1 / hz, T0 = rec.frames.find(f => f[1] >= 0)?.[0] ?? 0, T1 = rec.frames[rec.frames.length - 1][0];
    // the ground the subjects walk: every 20 m of their path (the recorded subject per frame)
    const pts = []; for (const fr of rec.frames) { const s = fr[2].find(r => r[0] === fr[1]); if (s && !pts.some(([x, z]) => Math.hypot(x - s[1], z - s[3]) < 20)) pts.push([s[1], s[3]]); }
    await readyPath(pts); crowdAt(cr, T0); let sid = rec.frames.find(f => f[1] >= 0)[1]; fol.enter(null, cr.W.get(sid)); const F = [], lh = CAM.follow.lookH ?? 1.35; let kr = 0;
    for (let k = 1; T0 + k * dt <= T1; k++) { const t = T0 + k * dt; crowdAt(cr, t); while (kr < rec.frames.length - 1 && rec.frames[kr + 1][0] <= t) kr++;
      const rs = rec.frames[kr][1]; if (rs >= 0 && rs !== sid) { sid = rs; const x = cr.W.get(rs); if (x && !x.gone) fol.set(x); }
      const t0 = performance.now(); collTick(); fol.update(dt, noInput); const ms = performance.now() - t0; const w = fol.subject;
      for (const ts of snap) if (w && t - T0 >= ts && t - T0 - dt < ts) { const d = fol.dbg; poseShot(`${label}-t${ts.toFixed(1)}`, fol, w.p, [`${label} replay t=${ts.toFixed(1)} s · ${hz} Hz · subject = pink capsule (the live page's walkers are not the replayed crowd)`, `arm ${d.allowed.toFixed(2)} of ${d.dist.toFixed(2)} m · cam→geom ${minDist(fol.pose.p.x, fol.pose.p.y, fol.pose.p.z, .8).toFixed(2)} m · ${gtInside(fol.pose.p.x, fol.pose.p.y, fol.pose.p.z) ? 'INSIDE a solid' : 'clear'}`]); }
      if (!w) { F.push({ t: r3(t - T0), dt, ms: +ms.toFixed(3), blend: 1 }); continue; }
      const cam = fol.pose.p, [yaw, pitch] = yawPitch(fol.pose.q), v = visibility(cam, w), nc = minDist(cam.x, cam.y, cam.z, .8), [pd] = nearestPerson(cam.x, cam.y, cam.z), cd = nearestCar(cam.x, cam.y, cam.z);
      const a = followArm(fol, w.p), Ly = w.p[1] + lh, d3 = Math.hypot(cam.x - w.p[0], cam.y - Ly, cam.z - w.p[2]);
      F.push({ t: r3(t - T0), dt, ms: +ms.toFixed(3), ...(t - T0 < warm ? { blend: 1 } : {}), c: [cam.x, cam.y, cam.z].map(r5), yaw: +yaw.toFixed(7), pitch: +pitch.toFixed(7), s: [w.p[0], w.p[1], w.p[2]].map(r3), sy: +(w.yawS ?? w.p[3]).toFixed(4), vc: +(w.vc ?? 0).toFixed(3), id: w.id,
        vis: r2(v.vis), thin: v.thin, wide: v.wide, ppl: v.people, nc: r3(nc), inside: gtInside(cam.x, cam.y, cam.z) ? 1 : 0, pd: r3(pd), cd: r3(cd), arm: r3(a.arm), want: r3(a.want), elev: +Math.asin(Math.max(-1, Math.min(1, (cam.y - Ly) / Math.max(1e-3, d3)))).toFixed(4), gt: gtTier(cam.x, cam.z)[0],
        cut: fol.dbg?.cuts ?? 0, ...(ROWS_IN ? { dg: fol.dbg } : {}) }); }
    const out = { F, blocks: PRIV.world.stat.blocks, tiers: { full: PRIV.world.stat.full, mid: PRIV.world.stat.mid, far: PRIV.world.stat.far } }; endPriv(); return out; }

  // ── B. FOLLOW, fixed dt: a recorded walker path replayed into a private follow controller (no rendering)
  async function followFixed(path, hz, opts = {}) { const fol = makeFollow(), dt = 1 / hz, fake = { p: [0, 0, 0, 0], yawS: 0, vc: 1.3, id: -1, tier: 1 };
    const at = t => { let k = 0; while (k < path.length - 2 && path[k + 1].t < t) k++; const a = path[k], b = path[k + 1], f = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)));
      for (let i = 0; i < 3; i++) fake.p[i] = a.s[i] + (b.s[i] - a.s[i]) * f; let dy = b.sy - a.sy; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); fake.yawS = a.sy + dy * f; fake.p[3] = fake.yawS; fake.vc = a.vc + (b.vc - a.vc) * f; };
    at(path[0].t); await prewarmWorld(fake.p[0], fake.p[2]); fol.enter(null, fake); const out = []; const T1 = path[path.length - 1].t - path[0].t; let ms = 0;
    for (let k = 0; k * dt <= T1; k++) { const t = k * dt; at(path[0].t + t); collTick(); const t0 = performance.now(); fol.update(dt, noInput); ms += performance.now() - t0; const [yaw, pitch] = yawPitch(fol.pose.q);
      out.push({ t: +t.toFixed(4), c: fol.pose.p.toArray().map(r5), yaw: +yaw.toFixed(7), pitch: +pitch.toFixed(7), s: fake.p.slice(0, 3).map(r3) }); }
    return { hz, out, ms: ms / out.length };
  }
  // ── O. FOLLOW orbit lag: a standing subject on open ground; 1 s still, then the orbit input at `rate` rad/s for `dur` s, then 1 s
  async function orbitFixed(spot, hz, { rate = 2, dur = 1.5 } = {}) { const fol = makeFollow(), dt = 1 / hz, y = gtFloor(spot.x, spot.z), fake = { p: [spot.x, y, spot.z, 0], yawS: 0, vc: 0, id: -2, tier: 1 };
    await prewarmWorld(spot.x, spot.z); fol.enter(null, fake); const out = [], s = CAM.look.base * CAM.look.sens * 1.4;
    for (let k = 0; k * dt <= 2 + dur; k++) { const t = k * dt, I = { ...noInput, look: { x: t >= 1 && t < 1 + dur - 1e-9 ? -rate * dt / s : 0, y: 0 } }; collTick(); fol.update(dt, I);
      out.push({ t: +t.toFixed(4), c: fol.pose.p.toArray().map(v => +v.toFixed(4)), inp: I.look.x ? 1 : 0 }); }
    return { hz, out, s: [spot.x, y, spot.z], rate, dur };
  }
  // ── L. LAMP POSTS: a scripted walker on the GT floor passing a real corner lamp at a lateral offset; the follow controller at fixed dt
  function lampsNear(x, z, r = 90, n = 4) { const out = []; const i0 = Math.floor((x - r) / P), i1 = Math.floor((x + r) / P), j0 = Math.floor((z - r) / P), j1 = Math.floor((z + r) / P);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const [lx, lz, rot] of cornerLamps(i, j)) out.push({ i, j, x: lx, z: lz, rot, d: Math.hypot(lx - x, lz - z) });
    out.sort((a, b) => a.d - b.d); return out.slice(0, n); }
  async function lampPass(lamp, lat, hz, { shoot = false, label = 'L', snap = [] } = {}) {
    const alongZ = lamp.rot === 3 || lamp.rot === 1, inward = lamp.rot === 3 || lamp.rot === 2 ? 1 : -1;
    // the walk (camera build 2b): the stretch of this line the walker's BODY can walk — torso and shoulders (r .3 at 1 and 1.5 m over the
    // ground — the sidewalk, ≤ .25 m — never up on furniture tops) clear of every non-THIN GT solid — from ≤ 7 m before the lamp to ≤ 9 m
    // past it. The old 16 s straight walk crossed street furniture in all 16 passes (the subject inside a solid for 0.6–3.8 s, standing on
    // 0.6–0.9 m tops), something no real walker does and no camera can frame (a box the person walks through ends up between them and the
    // camera). Knee-high things (≤ .7 m: a bench seat, a hydrant, a kerb box) are waded through: they never touch the arm or the view.
    const ux = alongZ ? 0 : 1, uz = alongZ ? 1 : 0, V0 = 1.35, px = s => alongZ ? lamp.x + inward * lat : lamp.x + s, pz = s => alongZ ? lamp.z + s : lamp.z + inward * lat;
    await prewarmWorld(lamp.x, lamp.z);
    const why = s => { const x = px(s), z = pz(s), f = gtFloor(x, z, .25); let best = null; for (const h of [1, 1.5]) for (let cx = Math.floor(x - .6); cx <= Math.floor(x + .6); cx++) for (let cz = Math.floor(z - .6); cz <= Math.floor(z + .6); cz++) cellQuads(cx + .5, cz + .5, (g, q) => { const B = g.B, b = q * 6, y = f + h;
        const d = Math.hypot(Math.max(B[b] - x, 0, x - B[b + 3]), Math.max(B[b + 1] - y, 0, y - B[b + 4]), Math.max(B[b + 2] - z, 0, z - B[b + 5])); if (d < .3 && (!best || d < best.d) && !gtThin(g, q, y)) best = { d: +d.toFixed(2), box: [B[b], B[b + 1], B[b + 2], B[b + 3], B[b + 4], B[b + 5]].map(v => +v.toFixed(2)) }; }); return best; };
    // (posts are passed through, as the lamp itself at 0 m is: the premise of L; the solids a body can't share are the non-THIN ones)
    const clearAt = s => Math.hypot(px(s) - lamp.x, pz(s) - lamp.z) < .9 || !why(s);
    let s0 = 0, s1 = 0; while (s0 > -7 && clearAt(s0 - .1)) s0 -= .1; while (s1 < 9 && clearAt(s1 + .1)) s1 += .1; if (s0 > -7) s0 += .3; if (s1 < 9) s1 -= .3;
    const ends = [s0 > -7 ? why(s0 - .4) : null, s1 < 9 ? why(s1 + .4) : null];
    const ax = px(s0), az = pz(s0), dur = Math.max(0, s1 - s0) / V0;
    const fol = makeFollow(), dt = 1 / hz, fake = { p: [ax, gtFloor(ax, az, .25), az, Math.atan2(ux, uz)], yawS: Math.atan2(ux, uz), vc: V0, id: -7, tier: 1 };
    await prewarmWorld(lamp.x, lamp.z); fol.enter(null, fake); const out = []; let worst = null, worstPull = null;
    for (let k = 0; k * dt <= dur; k++) { const t = k * dt; fake.p[0] = ax + ux * V0 * t; fake.p[2] = az + uz * V0 * t; fake.p[1] = gtFloor(fake.p[0], fake.p[2], .25); collTick(); fol.update(dt, noInput);
      for (const ds of snap) { const ts = (ds - s0) / V0; if (t >= ts && t - dt < ts) { const d = fol.dbg; poseShot(`${label}-lat${lat}-s${ds}`, fol, fake.p, [`lamp pass, walker ${lat} m off the lamp line, ${ds >= 0 ? ds + ' m past' : -ds + ' m before'} the lamp · ${hz} Hz`, `arm ${d.allowed.toFixed(2)} of ${d.dist.toFixed(2)} m · side-step ${d.dodge.toFixed(2)} m · camera ${Math.hypot(fol.pose.p.x - lamp.x, fol.pose.p.z - lamp.z).toFixed(2)} m from the lamp · cam→geom ${minDist(fol.pose.p.x, fol.pose.p.y, fol.pose.p.z, .8).toFixed(2)} m`]); } }
      const cp = fol.pose.p, [yaw, pitch] = yawPitch(fol.pose.q), v = visibility(cp, fake), a = followArm(fol, fake.p), [pd] = nearestPerson(cp.x, cp.y, cp.z, null, [fake]);
      let thinArm = 0; if (a.arm < a.want - .5) { const L = a.L, dx = cp.x - L[0], dz = cp.z - L[2], az0 = Math.atan2(dx, dz), pt = a.pitch, u = [Math.sin(az0) * Math.cos(pt), Math.sin(pt), Math.cos(az0) * Math.cos(pt)];
        const h = segHit(L[0] + u[0] * 1.1, L[1] + u[1] * 1.1, L[2] + u[2] * 1.1, L[0] + u[0] * a.want, L[1] + u[1] * a.want, L[2] + u[2] * a.want);
        const ex = u[0] * a.want, ez = u[2] * a.want, f = Math.max(0, Math.min(1, ((lamp.x - L[0]) * ex + (lamp.z - L[2]) * ez) / (ex * ex + ez * ez || 1))), lampOff = Math.hypot(L[0] + ex * f - lamp.x, L[2] + ez * f - lamp.z);
        // (camera build 2c) what the arm met, in GT: a THIN solid at that height (the pole, a post) → 1; a solid that is not thin there (a sign
        // box or signal head on the pole — solid by RESEARCH §4.2 per height) → 2; nothing in GT on the arm, near the lamp → 1 (as before)
        thinArm = h ? (gtThin(h.g, h.q, L[1] + u[1] * a.want * h.f) ? 1 : 2) : lampOff < 1 ? 1 : 2; }   // 1 thin (the lamp, a post), 2 something else
      const row = { t: +t.toFixed(4), c: [cp.x, cp.y, cp.z].map(r5), yaw: +yaw.toFixed(7), pitch: +pitch.toFixed(7), s: fake.p.slice(0, 3).map(r3), vis: r2(v.vis), thin: v.thin, wide: v.wide, nc: r3(minDist(cp.x, cp.y, cp.z, .8)),
        inside: gtInside(cp.x, cp.y, cp.z) ? 1 : 0, pd: r3(pd), cd: r3(nearestCar(cp.x, cp.y, cp.z)), arm: r3(a.arm), want: r3(a.want), thinArm, sb: r3(Math.min(...[.5, 1, 1.5].map(h => minDist(fake.p[0], fake.p[1] + h, fake.p[2], .6))) - .3), lampD: r2(Math.hypot(cp.x - lamp.x, cp.z - lamp.z)), ...(ROWS_IN ? { dg: fol.dbg } : {}) };
      out.push(row); if (!worst || v.vis < worst.vis) worst = { ...row, q: fol.pose.q.toArray() }; if (!worstPull || a.arm < worstPull.arm) worstPull = { ...row, q: fol.pose.q.toArray() }; }
    if (shoot) for (const [k, w] of [['occl', worst], ['pull', worstPull]]) { if (!w || (k === 'occl' && w.vis > .9) || (k === 'pull' && w.arm > w.want - .3)) continue;
      C.camera.position.set(...w.c); C.camera.quaternion.fromArray(w.q); C.camera.fov = 55; C.camera.updateProjectionMatrix(); mark(w.s);
      capture(`${label}-lamp-lat${lat}-${hz}hz-${k}`, [`FOLLOW past a corner lamp (walker ${lat} m off the lamp line) t=${w.t.toFixed(2)}s ${hz} Hz [${k === 'occl' ? 'least visible' : 'most pulled-in'}]`, `subject visible ${Math.round(w.vis * 100)}% (thin rays ${w.thin}) · arm ${w.arm} of ${w.want} m · camera ${w.lampD} m from the lamp`], null); mark(null); }
    return { lamp: { x: lamp.x, z: lamp.z, rot: lamp.rot }, lat, hz, out, walk: [+s0.toFixed(1), +s1.toFixed(1)], ends, tier: gtTier(lamp.x, lamp.z) };
  }
  // ── CORNER: a scripted walker round a building corner (F7). The path: a leg along one slab edge, a 1 m arc, a leg along the next
  function findCorner(x, z, r = 80) { const i0 = Math.floor((x - r) / P), i1 = Math.floor((x + r) / P), j0 = Math.floor((z - r) / P), j1 = Math.floor((z + r) / P), cand = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const s = slabOf(i, j); if (s.x1 - s.x0 < 16 || s.z1 - s.z0 < 16) continue;
      for (const [cx, cz, sx, sz] of [[s.x0, s.z0, 1, 1], [s.x1, s.z0, -1, 1], [s.x1, s.z1, -1, -1], [s.x0, s.z1, 1, -1]]) cand.push({ i, j, cx, cz, sx, sz, d: Math.hypot(cx - x, cz - z) }); }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) { const kx = c.cx + c.sx * 1.2, kz = c.cz + c.sz * 1.2;   // the turn point on the sidewalk
      let tall = 0; for (let a = 1.6; a <= 6; a += .6) for (let b = 1.6; b <= 6; b += .6) { const px = c.cx + c.sx * a, pz = c.cz + c.sz * b; if (gtInside(px, 5, pz)) tall++; } if (tall < 20) continue;   // a building stands in the corner
      const legs = [[kx + c.sx * 14, kz, -c.sx, 0], [kx, kz + c.sz * 14, 0, -c.sz]];   // walk in along x toward the corner, out along z (away from it)
      let ok = true; for (let s = 0; s <= 14 && ok; s += .5) { if (minDist(kx + c.sx * s, 1, kz, .4) < .3 || minDist(kx, 1, kz + c.sz * s, .4) < .3) ok = false; } if (!ok) continue;
      return { ...c, k: [kx, kz], start: [legs[0][0], legs[0][1]], u1: [legs[0][2], legs[0][3]], u2: [0, c.sz] }; }
    return null; }
  async function cornerPass(cn, hz, { shoot = false } = {}) { const fol = makeFollow(), dt = 1 / hz, V0 = 1.35, L1 = 13, arcR = 1, arcL = Math.PI / 2 * arcR, L2 = 12, total = L1 + arcL + L2;
    const [kx, kz] = cn.k, [u1x, u1z] = cn.u1, [u2x, u2z] = cn.u2;
    const pos = s => { if (s < L1) return [cn.start[0] + u1x * s, cn.start[1] + u1z * s, Math.atan2(u1x, u1z)];   // (the arc's centre sits 1 m in from the turn point)
      const ex = kx - u1x * arcR, ez = kz - u1z * arcR; if (s < L1 + arcL) { const f = (s - L1) / arcL, a = f * Math.PI / 2, cxx = ex + u2x * arcR, czz = ez + u2z * arcR;
        const rx = -u2x, rz = -u2z, x = cxx + (rx * Math.cos(a) + u1x * Math.sin(a)) * arcR, zz = czz + (rz * Math.cos(a) + u1z * Math.sin(a)) * arcR, hx = u1x * Math.cos(a) + u2x * Math.sin(a), hz2 = u1z * Math.cos(a) + u2z * Math.sin(a); return [x, zz, Math.atan2(hx, hz2)]; }
      const s2 = s - L1 - arcL, bx = kx + u2x * arcR, bz = kz + u2z * arcR; return [bx + u2x * s2, bz + u2z * s2, Math.atan2(u2x, u2z)]; };
    const p0 = pos(0), fake = { p: [p0[0], gtFloor(p0[0], p0[1]), p0[1], p0[2]], yawS: p0[2], vc: V0, id: -9, tier: 1 };
    await prewarmWorld(kx, kz); fol.enter(null, fake); const out = []; let worst = null;
    for (let k = 0; k * dt <= total / V0; k++) { const t = k * dt, q = pos(V0 * t); fake.p[0] = q[0]; fake.p[2] = q[1]; fake.p[1] = gtFloor(q[0], q[1]); fake.p[3] = fake.yawS = q[2]; collTick(); fol.update(dt, noInput);
      const cp = fol.pose.p, [yaw, pitch] = yawPitch(fol.pose.q), v = visibility(cp, fake), [pd] = nearestPerson(cp.x, cp.y, cp.z, null, [fake]), a = followArm(fol, fake.p);
      const row = { t: +t.toFixed(4), c: [cp.x, cp.y, cp.z].map(r5), yaw: +yaw.toFixed(7), pitch: +pitch.toFixed(7), s: fake.p.slice(0, 3).map(r3), vis: r2(v.vis), thin: v.thin, wide: v.wide, nc: r3(minDist(cp.x, cp.y, cp.z, .8)), inside: gtInside(cp.x, cp.y, cp.z) ? 1 : 0, pd: r3(pd), arm: r3(a.arm), want: r3(a.want), ...(ROWS_IN ? { dg: fol.dbg } : {}) };
      out.push(row); if (!worst || v.wide > worst.wide) worst = { ...row, q: fol.pose.q.toArray() }; }
    if (shoot && worst && worst.wide > 3) { C.camera.position.set(...worst.c); C.camera.quaternion.fromArray(worst.q); C.camera.fov = 55; C.camera.updateProjectionMatrix(); mark(worst.s);
      capture(`corner-${hz}hz`, [`FOLLOW round a building corner t=${worst.t.toFixed(2)}s ${hz} Hz`, `wall rays ${worst.wide}/12 · visible ${Math.round(worst.vis * 100)}%`], null); mark(null); }
    return { hz, out, corner: { k: cn.k, i: cn.i, j: cn.j } };
  }

  // ── C / look / inject. FLY, fixed dt: a private fly controller on scripted input
  const FLY_SCRIPTS = {
    wall: { dur: 4, at: () => ({ mz: 1, boost: true }) },
    glance: { dur: 4, at: () => ({ mz: 1 }) },
    glide: { dur: 6.5, at: t => t < 2.5 ? { mz: 1 } : {} },
    floor: { dur: 6, at: t => t < 3 ? { keys: ['KeyQ'] } : {} },
    look: { dur: 1, at: () => ({}) },
    inject: { dur: 1, at: () => ({}) },
  };
  function flyFixed(name, hz, start) { const sc = FLY_SCRIPTS[name], fl = makeFly(), dt = 1 / hz; const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(start.pitch || 0, start.yaw, 0, 'YXZ'));
    prewarm(start.p[0], start.p[2], 96); fl.enter({ p: new THREE.Vector3(...start.p), q, fov: 60 }); const out = []; let ms = 0; const k0 = Math.round(.5 * hz);
    const I = { look: { x: 0, y: 0 }, move: { x: 0, y: 0, z: 0 }, rate: { x: 0, y: 0 }, wheel: 0, boost: false, slow: false, pad: false, keys: new Set(), key(c) { return this.keys.has(c); }, any(...c) { return c.some(x => this.keys.has(x)); } };
    for (let k = 0; k * dt <= sc.dur; k++) { const t = k * dt, s = sc.at(t); I.move.x = s.mx || 0; I.move.z = s.mz || 0; I.move.y = s.my || 0; I.boost = !!s.boost; I.keys = new Set(s.keys || []);
      I.look.x = name === 'look' && k === k0 ? 100 : 0; I.look.y = 0; collTick();
      const t0 = performance.now(); fl.update(dt, I); ms += performance.now() - t0; const [yaw, pitch] = yawPitch(fl.pose.q), p = fl.pose.p;
      out.push({ t: +t.toFixed(4), c: [p.x, p.y, p.z].map(v => +v.toFixed(4)), v: +fl.speed.toFixed(3), yaw: +yaw.toFixed(6), pitch: +pitch.toFixed(5), nc: r3(minDist(p.x, p.y, p.z, 1.2)), inside: gtInside(p.x, p.y, p.z) ? 1 : 0, pd: r2(nearestPerson(p.x, p.y, p.z)[0]), inp: I.look.x || I.move.z || I.keys.size ? 1 : 0 }); }
    return { hz, name, out, ms: ms / out.length, k0, start };
  }
  // Y7 (input.js): a 20 px then a 1,000 px pointer-lock delta into a fresh input (a stand-in element, pointer lock faked past the quiet window)
  async function spikeTest() { const { createInput } = await import(new URL('camera/input.js', location.href).href); const el = document.createElement('div'); document.body.appendChild(el);
    const inp = createInput(el, {}); inp.active = true; Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => el }); document.dispatchEvent(new Event('pointerlockchange'));
    await new Promise(r => setTimeout(r, 260)); const mv = x => el.dispatchEvent(new PointerEvent('pointermove', { movementX: x, movementY: 0, pointerType: 'mouse', bubbles: true }));
    inp.take(); mv(20); const a = inp.take().look.x; mv(1000); const b = inp.take().look.x; mv(20); mv(1000); mv(20); const c = inp.take().look.x;
    delete document.pointerLockElement; document.dispatchEvent(new Event('pointerlockchange')); inp.active = false; el.remove();
    return { normal: a, spike: b, mixed: c, ignored: a === 20 && b === 0 && c === 40 }; }

  // ── D / hover. FLY, real time: the rig's own fly mode with synthetic keys
  async function flyReal({ pos, yaw, pitch = 0, keys = ['KeyW'], dur = 5, label = 'D', shoot = false }) { endPriv();
    R.toOrbit({ instant: true }); C.camera.position.set(...pos); C.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(C.camera.quaternion); C.controls.target.copy(C.camera.position).addScaledVector(fwd, 20);
    for (let k = 0; k < 60; k++) { C.camera.position.set(...pos); C.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); await raf(); }
    R.setMode('fly', { lock: false }); await raf(); R.fly.look(yaw, pitch);
    for (const k of keys) key(k, true); const F = []; const t0 = performance.now(); let last = t0, lastShot = -9, cmax = 0; takePerf();
    while (true) { const now = await raf(), t = (now - t0) / 1000; if (t > dur) break; const dt = (now - last) / 1000; last = now; const p = C.camera.position, ms = takePerf(); cmax = Math.max(cmax, collFrame());
      const [pd, pw] = nearestPerson(p.x, p.y, p.z), cd = nearestCar(p.x, p.y, p.z), nc = minDist(p.x, p.y, p.z, 1.2), [yw, pt] = yawPitch(C.camera.quaternion);
      F.push({ t: r3(t), dt: +dt.toFixed(4), ms: +ms.toFixed(3), c: [p.x, p.y, p.z].map(r3), yaw: +yw.toFixed(5), pitch: +pt.toFixed(5), v: r2(R.fly.speed), pd: r2(pd), cd: r2(cd), nc: r3(nc), inside: gtInside(p.x, p.y, p.z) ? 1 : 0 });
      if (shoot && shots.length < 40 && t - lastShot > 1.2 && (pd < 0 || cd < 0)) { lastShot = t; capture(`${label}-fly-t${t.toFixed(1)}`, [`FLY t=${t.toFixed(2)}s speed ${R.fly.speed.toFixed(1)} m/s height ${p.y.toFixed(2)} m`, `camera→person ${pd.toFixed(2)} m (<0 inside) · →car ${cd.toFixed(2)} m · →geometry ${nc.toFixed(2)} m`], pw && pd < 1 ? [pw.p[0], pw.p[1] + 1, pw.p[2]] : null); } }
    for (const k of keys) key(k, false); for (let k = 0; k < 20; k++) await raf(); R.toOrbit({ instant: true }); return { F, coll: collStat(), collFrameMax: cmax };
  }
  // a straight, busy sidewalk run near (x, z): the walker with the most walkers within 25 m ahead along its heading
  function busyRun(x, z, r = 120) { let best = null, bn = -1; for (const w of walkers()) { if (w.gone || !w.tier || (w.vc ?? 0) < .5) continue; if (Math.hypot(w.p[0] - x, w.p[2] - z) > r) continue; const h = w.yawS ?? w.p[3], fx = Math.sin(h), fz = Math.cos(h); let n = 0;
      for (const o of walkers()) { const dx = o.p[0] - w.p[0], dz = o.p[2] - w.p[2], a = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx); if (a > 0 && a < 25 && l < 1.2) n++; } if (n > bn) { bn = n; best = w; } }
    return best ? { p: [best.p[0], best.p[1], best.p[2]], h: best.yawS ?? best.p[3], n: bn } : null; }
  function busyRoad(x, z, r = 150) { let best = null, bn = -1; for (const c of cars()) { if (Math.hypot(c.x - x, c.z - z) > r) continue; let n = 0; const fx = Math.sin(c.h), fz = Math.cos(c.h);
      for (const o of cars()) { const dx = o.x - c.x, dz = o.z - c.z, a = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx); if (a > 0 && a < 60 && l < 2) n++; } if (n > bn) { bn = n; best = c; } } return best ? { p: [best.x, 0, best.z], h: best.h, n: bn } : null; }

  // ── setup searches over the GT
  // the most open ground near (x, z), under open sky: candidates on a 2 m grid, clearance = distance to the nearest GT box below 30 m
  function openSpot(x, z, r = 70) { const occ = []; for (let cx = Math.floor(x - r - 10); cx <= Math.floor(x + r + 10); cx++) for (let cz = Math.floor(z - r - 10); cz <= Math.floor(z + r + 10); cz++) {
      let o = false; cellQuads(cx + .5, cz + .5, (g, q) => { if (!o && g.B[q * 6 + 1] < 30) o = true; }); if (o) occ.push([cx + .5, cz + .5]); }
    let best = null; for (let gx = x - r; gx <= x + r; gx += 2) for (let gz = z - r; gz <= z + r; gz += 2) { if (!gtBlock(Math.floor(gx / P), Math.floor(gz / P))) continue; let d = 1e9; for (const [ox, oz] of occ) { const e = Math.hypot(ox - gx, oz - gz); if (e < d) d = e; } d -= .7;
      if (!best || d > best.clear) best = { x: gx, z: gz, clear: d }; } if (best) best.tier = gtTier(best.x, best.z); return best; }
  // a tall wall 70–90 m ahead of a clear start at height y (axis directions), with the wall continuing along one side (for the glancing run)
  // a building's wall to fly at: walk out of a tall solid (ground to y + 5) along an axis to its face; the face must be solid 12 m across,
  // and the run-up 75 m (else 68, 60) straight back out from it clear (nothing within 2.5 m). Prefers a wall that continues along one side
  // (for the 30° glancing run) and a full 75 m run-up.
  function findWall(x, z, y = 20, r = 64) { let best = null; const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], why = { start: 0, face: 0, nohit: 0, broad: 0, path: 0 };
    for (let gx = -r; gx <= r; gx += 4) for (let gz = -r; gz <= r; gz += 4) { const px = x + gx, pz = z + gz;
      if (!gtBlock(Math.floor(px / P), Math.floor(pz / P)) || !gtInside(px, y, pz) || !gtInside(px, y + 5, pz) || !gtInside(px, 1.5, pz)) { why.start++; continue; }
      for (const [dx, dz] of dirs) {   // (dx, dz): the run's direction, into the wall; walk out of the solid against it
        let e = 0; while (e < 24 && gtInside(px - dx * e, y, pz - dz * e)) e += .5; if (e >= 24) { why.face++; continue; }
        const L0 = e + 2, sx = px - dx * L0, sz = pz - dz * L0, h = segHit(sx, y, sz, px, y, pz); if (!h) { why.nohit++; continue; }
        const hx = sx + dx * h.f * L0, hz = sz + dz * h.f * L0;
        let broad = 0; for (const o of [-6, -3, 0, 3, 6]) for (const yy of [1.5, y, y + 5]) if (gtInside(hx + dx * 1.2 - dz * o, yy, hz + dz * 1.2 + dx * o)) broad++;
        if (broad < 14) { why.broad++; continue; }
        let d = 0, ox = 0, oz = 0;
        for (const dd of [75, 68, 60]) { ox = hx - dx * dd; oz = hz - dz * dd; if (!gtBlock(Math.floor(ox / P), Math.floor(oz / P)) || gtInside(ox, y, oz) || segHit(hx - dx * .3, y, hz - dz * .3, ox, y, oz)) continue;
          let ok = true; for (let s = 0; s < dd - 8 && ok; s += 4) if (minDist(ox + dx * s, y, oz + dz * s, 2.5) < 2.5) ok = false; if (ok) { d = dd; break; } }
        if (!d) { why.path++; continue; }
        const tx = -dz, tz = dx; let side = 0;
        for (const sg of [1, -1]) { let wall = true; for (const s of [3, 6, 9]) { const qx = hx - dx * 3 + tx * s * sg, qz = hz - dz * 3 + tz * s * sg; const w2 = segHit(qx, y, qz, qx + dx * 5, y, qz + dz * 5); if (!w2 || Math.abs(w2.f * 5 - 3) > 1 || minDist(qx, y, qz, 1.5) < 1.5) { wall = false; break; } } if (wall) { side = sg; break; } }
        const sc = (side ? 0 : 10) + (75 - d) / 5 + Math.hypot(hx - x, hz - z) / 100; if (!best || sc < best.sc) best = { sc, start: [ox, y, oz], dir: [dx, dz], hit: [hx, hz], side, t: [tx * side, tz * side], yaw: Math.atan2(-dx, -dz), d, y }; } }
    return best || { none: true, why }; }
  // a clear straight run for the glide: from the open spot, an axis direction with nothing within 6 m for 90 m at height y
  function clearRun(x, z, y) { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let ok = true; for (let s = 0; s <= 90 && ok; s += 3) if (minDist(x + dx * s, y, z + dz * s, 6) < 6) ok = false; if (ok) return { start: [x, y, z], yaw: Math.atan2(-dx, -dz), dir: [dx, dz] }; } return null; }

  // ── UNITS: world.js query checks against GROUND TRUTH (the full tier's quads, independent of world.js) on 3 blocks (RESEARCH §4.2)
  //   inside (points ≥ .36 m from every surface: GT by exact point containment of the horizontal faces) · floorAt · ray (no tunnelling:
  //   never later than GT) · sweep (r .25: no penetration before contact) · distance (never more than GT) · THIN on the corner lamps ·
  //   dynamic shapes (walker capsules, car boxes) · query cost (µs) · build cost (worker ms per block, main-thread ms per frame)
  async function pageUnits({ n = 1500, seed = 7 } = {}) {
    const C = window.__city, base = location.href, { P } = await import(new URL('plan.js', base).href), W = await import(new URL('camera/world.js', base).href);
    const { cornerLamps } = await import(new URL('ground.js', base).href);
    const world = C.cam?.world || (window.__cpWorld ??= W.createWorld(C)), own = !C.cam?.world, raf = () => new Promise(r => requestAnimationFrame(r));
    let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const V = (x, y, z) => ({ x, y, z });
    // at street level on Fit Street (full tiers round it), the stream settled
    C.cam?.toOrbit({ instant: true }); C.setView('fitstreet'); for (let k = 0; k < 900 && !(k > 30 && C.stream.settled?.()); k++) await raf();
    // the 3 full-tier blocks nearest the camera's focus
    const f = C.controls.target, cands = [];
    for (const r of C.stream.blocks.values()) { if (!Array.isArray(r.data.full) || !r.data.full.some(t => t && t.n)) continue; cands.push([Math.hypot(r.x0 + P / 2 - f.x, r.z0 + P / 2 - f.z), r]); }
    cands.sort((a, b) => a[0] - b[0]); const blocks = cands.slice(0, 3).map(c => c[1]); if (blocks.length < 3) return { error: 'fewer than 3 blocks with a full tier near the focus' };
    // make the world build them (the worker), then hold the stream still
    const t0 = performance.now(); for (let it = 0; ; it++) { for (const r of blocks) world.entry(r.i, r.j); if (own) world.tick(C.camera.position); await raf();
      if ((it > 12 && blocks.every(r => world.tierAt(r.x0 + 1, r.z0 + 1) === 'full')) || performance.now() - t0 > 20000) break; }
    const waitMs = performance.now() - t0, tiers = blocks.map(r => world.tierAt(r.x0 + 1, r.z0 + 1));
    // ground truth per block: every quad's AABB (1 m buckets) + the horizontal faces (point containment)
    const GT = new Map();
    function gt(i, j) { const k = i + ',' + j; if (GT.has(k)) return GT.get(k); const r = C.stream.blocks.get(k); let g = null;
      const full = r && Array.isArray(r.data.full) ? r.data.full.filter(t => t && t.n) : []; if (full.length) { let nq = 0; for (const t of full) nq += t.n / 4;
        const B = new Float32Array(nq * 6), H = []; let m = 0; const cells = Array.from({ length: P * P }, () => []);
        for (const t of full) { const p = t.P, nn = t.N, o = t.o; for (let q = 0; q < t.n; q += 4) { let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9, az = 1e9, bz = -1e9;
            for (let v = q * 3, e = v + 12; v < e; v += 3) { const x = p[v] * .01 + o[0], y = p[v + 1] * .01 + o[1], z = p[v + 2] * .01 + o[2]; if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y; if (z < az) az = z; if (z > bz) bz = z; }
            const ny = nn[q * 3 + 1]; if (Math.abs(ny) > Math.abs(nn[q * 3]) && Math.abs(ny) > Math.abs(nn[q * 3 + 2]) && by - ay < .011 && ay > .05) H.push([ax, bx, az, bz, ay, ny > 0 ? 1 : -1]);
            if (by < .05) continue; const b = m * 6; B[b] = ax; B[b + 1] = ay; B[b + 2] = az; B[b + 3] = bx; B[b + 4] = by; B[b + 5] = bz;
            for (let iz = Math.max(0, Math.floor(az - r.z0 - .01)); iz <= Math.min(P - 1, Math.floor(bz - r.z0 + .01)); iz++) for (let ix = Math.max(0, Math.floor(ax - r.x0 - .01)); ix <= Math.min(P - 1, Math.floor(bx - r.x0 + .01)); ix++) cells[iz * P + ix].push(m); m++; } }
        g = { B, cells, H, x0: r.x0, z0: r.z0, maxH: r.maxH }; }
      GT.set(k, g); return g; }
    const gtAt = (x, z) => gt(Math.floor(x / P), Math.floor(z / P));
    function boxesAround(x, z, R, cb) { for (let cx = Math.floor(x - R); cx <= Math.floor(x + R); cx++) for (let cz = Math.floor(z - R); cz <= Math.floor(z + R); cz++) { const g = gtAt(cx + .5, cz + .5); if (!g) continue;
        const ix = cx - g.x0, iz = cz - g.z0; if (ix < 0 || iz < 0 || ix >= P || iz >= P) continue; for (const q of g.cells[iz * P + ix]) cb(g.B, q * 6); } }
    const gtDist = (x, y, z, R = 1.5) => { let best = Math.min(R, Math.max(0, y)); boxesAround(x, z, R, (B, b) => { const d = Math.hypot(Math.max(B[b] - x, 0, x - B[b + 3]), Math.max(B[b + 1] - y, 0, y - B[b + 4]), Math.max(B[b + 2] - z, 0, z - B[b + 5])); if (d < best) best = d; }); return best; };
    const gtInside = (x, y, z) => { const g = gtAt(x, z); if (!g) return null; let c = 0; for (const h of g.H) if (h[4] > y && x > h[0] && x < h[1] && z > h[2] && z < h[3]) c += h[5]; return c > 0; };
    const gtFloor = (x, z, y, R = 0) => { const g = gtAt(x, z); if (!g) return null; let f = 0; for (const h of g.H) if (h[5] > 0 && h[4] <= y + 1e-4 && h[4] > f && x > h[0] - R && x < h[1] + R && z > h[2] - R && z < h[3] + R) f = h[4]; return f; };
    function gtRay(a, b) { const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz); let best = dy < 0 && a.y + dy < 0 ? a.y / -dy : 2; const seen = new Set();
      for (let u = 0; u <= L + .5; u += .5) { const x = a.x + dx * Math.min(1, u / L), z = a.z + dz * Math.min(1, u / L); boxesAround(x, z, .6, (B, o) => { const key = B.length * 1e7 + o; if (seen.has(key)) return; seen.add(key);
          let t0 = 0, t1 = 1; for (let k = 0; k < 3; k++) { const s0 = k === 0 ? a.x : k === 1 ? a.y : a.z, d = k === 0 ? dx : k === 1 ? dy : dz, lo = B[o + k] - .002, hi = B[o + 3 + k] + .002;
            if (Math.abs(d) < 1e-12) { if (s0 < lo || s0 > hi) return; continue; } let ta = (lo - s0) / d, tb = (hi - s0) / d; if (ta > tb) [ta, tb] = [tb, ta]; if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return; }
          if (t0 < best) best = t0; }); }
      return best <= 1 ? best : null; }
    const inBlocks = (x, z, m = 0) => blocks.some(r => x >= r.x0 + m && x < r.x0 + P - m && z >= r.z0 + m && z < r.z0 + P - m);
    const allFull = (a, b) => { for (let k = 0; k <= 8; k++) { const x = a.x + (b.x - a.x) * k / 8, z = a.z + (b.z - a.z) * k / 8; if (!gtAt(x, z) || world.tierAt(x, z) !== 'full') return false; } return true; };
    const randPt = (m = 0) => { const r = blocks[Math.floor(rnd() * 3)]; return V(r.x0 + m + rnd() * (P - 2 * m), .06 + rnd() * Math.min(40, (r.maxH || 30) + 3), r.z0 + m + rnd() * (P - 2 * m)); };
    const out = { blocks: blocks.map((r, k) => ({ key: r.key, tier: tiers[k], quads: r.data.full.reduce((s, t) => s + (t ? t.n / 4 : 0), 0) })), waitMs: Math.round(waitMs) };
    // (a) inside
    { const exIn = []; let n0 = 0, agree = 0, falseSolid = 0, falseFree = 0, near = 0, nearSolidOnly = 0, nearFreeOnly = 0;
      for (let k = 0; k < n * 4; k++) { const p = randPt(); const gi = gtInside(p.x, p.y, p.z); if (gi === null) continue; const d = gtDist(p.x, p.y, p.z, .4), wi = world.inside(p, W.STATIC);
        if (d >= .36) { n0++; if (gi === wi) agree++; else if (wi) { falseSolid++; if (exIn.length < 3) exIn.push([p.x, p.y, p.z].map(v => +v.toFixed(3))); } else falseFree++; } else { near++; if (wi && !gi) nearSolidOnly++; if (!wi && gi) nearFreeOnly++; } }
      // (conservative by design: a column a quad touches is solid; rotated props' faces count by their bounding boxes — false SOLID ≤ 0.1 % allowed, false FREE never)
      out.inside = { far: n0, agree, falseSolid, falseFree, near, nearWorldSolidOnly: nearSolidOnly, nearWorldFreeOnly: nearFreeOnly, ex: exIn, pass: falseFree === 0 && nearFreeOnly === 0 && falseSolid <= n0 * .001 }; }
    // (b) floorAt: between the exact point's floor and the highest floor anywhere in its column
    { let m = 0, exact = 0, below = 0, above = 0;
      for (let k = 0; k < n; k++) { const p = randPt(); if (gtInside(p.x, p.y, p.z) || world.inside(p, W.STATIC)) continue; const wf = world.floorAt(p.x, p.z, p.y), g0 = gtFloor(p.x, p.z, p.y), g1 = gtFloor(p.x, p.z, p.y, .25); if (g0 === null) continue; m++;
        if (Math.abs(wf - g0) < .011) exact++; if (wf < g0 - .011) below++; if (wf > g1 + .011) above++; }
      out.floorAt = { n: m, exactAtPoint: exact, belowPointFloor: below, aboveColumnFloor: above, pass: below === 0 }; }
    // (c) ray: no tunnelling (never later than GT), early by at most a column
    { const d = [], late = [], early = []; let miss = 0, m = 0;
      for (let k = 0; k < n; k++) { const a = randPt(1); if (gtDist(a.x, a.y, a.z, .5) < .4 || gtInside(a.x, a.y, a.z) || world.inside(a, W.STATIC)) continue; const L = 2 + rnd() * 8, th = rnd() * 6.283, ph = (rnd() - .5) * 1.6;
        const b = V(a.x + Math.cos(th) * Math.cos(ph) * L, a.y + Math.sin(ph) * L, a.z + Math.sin(th) * Math.cos(ph) * L); if (!allFull(a, b)) continue; m++;
        const g = gtRay(a, b), w = world.ray(a, b, W.STATIC); const gd = g === null ? null : g * L, wd = w ? w.t * L : null;
        if (gd !== null && wd === null) { miss++; late.push([+a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +gd.toFixed(2), null]); continue; }
        if (gd === null && wd === null) continue; const e = (wd ?? L) - (gd ?? L); d.push(Math.abs(e)); if (e > .02) late.push([+a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), gd === null ? null : +gd.toFixed(2), +wd.toFixed(2)]); if (e < -.5 && early.length < 4) early.push([+e.toFixed(2), [a.x, a.y, a.z, b.x, b.y, b.z].map(v => +v.toFixed(2))]); else if (e < -.5) early.push(0); }
      d.sort((x, y) => x - y); out.ray = { n: m, hits: d.length, medianErr: +(d[d.length >> 1] ?? 0).toFixed(3), p95Err: +(d[Math.floor(d.length * .95)] ?? 0).toFixed(3), late: late.length, missed: miss, earlyOver50cm: early.length, earlyEx: early.slice(0, 4), lateEx: late.slice(0, 4), pass: late.length === 0 && miss === 0 }; }   // (early: a ray grazing within a column of a surface hits it — conservative)
    // (d) sweep r .25: no penetration before contact, and not wildly early
    { const r = .25; let m = 0, pen = 0, earlyN = 0, hits = 0; const ex = [];
      for (let k = 0; k < n; k++) { const a = randPt(1); if (gtDist(a.x, a.y, a.z, .8) < .6 || gtInside(a.x, a.y, a.z)) continue; const L = 2 + rnd() * 8, th = rnd() * 6.283, ph = (rnd() - .5) * 1.2;
        const b = V(a.x + Math.cos(th) * Math.cos(ph) * L, a.y + Math.sin(ph) * L, a.z + Math.sin(th) * Math.cos(ph) * L); if (!allFull(a, b)) continue; m++;
        const w = world.sweep(a, b, r, W.STATIC), T = w ? w.t : 1; let worst = 9; for (let q = 0; q <= 20; q++) { const u = T * q / 20, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, z = a.z + (b.z - a.z) * u; worst = Math.min(worst, gtDist(x, y, z, .6)); }
        if (worst < r - .02) { pen++; if (ex.length < 4) ex.push({ a: [a.x, a.y, a.z].map(v => +v.toFixed(2)), b: [b.x, b.y, b.z].map(v => +v.toFixed(2)), t: +T.toFixed(3), gtMin: +worst.toFixed(3) }); }
        if (w) { hits++; const c = V(a.x + (b.x - a.x) * T, a.y + (b.y - a.y) * T, a.z + (b.z - a.z) * T); if (gtDist(c.x, c.y, c.z, 1) > r + .4) earlyN++; } }
      out.sweep = { n: m, hits, penetrating: pen, earlyOver40cm: earlyN, ex, pass: pen === 0 }; }
    // (e) distance never more than GT (+1 cm), at most a column's diagonal less
    { let m = 0, over = 0, under = 0; for (let k = 0; k < n; k++) { const p = randPt(2); if (gtInside(p.x, p.y, p.z)) continue; const g = gtDist(p.x, p.y, p.z, 2), w = world.distance(p, 2, W.STATIC); if (world.inside(p, W.STATIC)) continue; m++; if (w > g + .011) over++; if (w < g - .36) under++; }
      out.distance = { n: m, overGT: over, underByMoreThan36cm: under, pass: over === 0 }; }
    // (f) THIN: the corner lamps' poles at 1.5 m are THIN; a column inside a tall building is not
    { let lamps = 0, thin = 0, wallCols = 0, wallThin = 0;
      for (const r of blocks) { for (const [x, z] of cornerLamps(r.i, r.j)) { lamps++; const h = world.ray(V(x - .6, 1.5, z), V(x + .6, 1.5, z), W.STATIC); if (h && h.thin) thin++; }
        const e = world.entry(r.i, r.j); for (let c = 0; c < e.flags.length; c += 37) if (e.top[c] > 8) { wallCols++; if (e.flags[c] & W.THIN_FLAG) wallThin++; } }
      out.thin = { lamps, lampThin: thin, tallColumns: wallCols, tallThin: wallThin, pass: thin >= lamps * .75 && wallThin <= wallCols * .01 }; }
    // (g) dynamic shapes: walker capsules and car boxes
    { world.invalidate(); const cp = C.camera.position, ws = (C.peds?.sim?.walkers || []).filter(w => !w.gone && Math.hypot(w.p[0] - cp.x, w.p[2] - cp.z) < 60).slice(0, 60), cs = (C.traffic?.sim?.cars || []).filter(c => !c.gone && Math.hypot(c.x - cp.x, c.z - cp.z) < 60).slice(0, 30); let ok = 0, tot = 0;
      const bad = [], near = (w, x, z, r) => (C.peds?.sim?.walkers || []).some(o => o !== w && !o.gone && Math.hypot(o.p[0] - x, o.p[2] - z) < r);
      for (const w of ws) { tot += 4; const [x, y, z] = w.p;
        if (world.inside(V(x, y + 1, z), W.PEOPLE)) ok++;                                             // inside its own capsule
        if (world.inside(V(x, y + 1, z), W.PEOPLE, w) === near(w, x, z, .32)) ok++; else bad.push(['skip', w.id]);              // skip works
        if (world.inside(V(x + .8, y + 1, z), W.PEOPLE) === near(null, x + .8, z, .32)) ok++; else bad.push(['beside', w.id]);  // .8 m beside: free (unless someone stands there)
        const h = world.ray(V(x - 3, y + 1, z), V(x + 3, y + 1, z), W.PEOPLE); if (h && h.kind === 'person') ok++; }
      for (const c of cs) { tot += 3; if (world.inside(V(c.x, .8, c.z), W.CARS)) ok++; else bad.push(['carIn', c.id]); const fx = Math.sin(c.h), fz = Math.cos(c.h), L = (c.len || 4.4) / 2;
        if (!world.inside(V(c.x + fx * (L + .3), .8, c.z + fz * (L + .3)), W.CARS) || cs.some(o => o !== c && Math.hypot(o.x - c.x - fx * (L + .3), o.z - c.z - fz * (L + .3)) < 3)) ok++;
        const sw = world.sweep(V(c.x + fx * (L + 4), .8, c.z + fz * (L + 4)), V(c.x, .8, c.z), .3, W.CARS); if (sw && sw.kind === 'car') ok++; }
      out.dynamic = { walkers: ws.length, cars: cs.length, checks: tot, ok, bad: bad.slice(0, 6), pass: ok === tot }; }
    // (h) query cost (µs each, 2000 random calls near the camera's blocks) and a follow-like frame
    { const pts = []; for (let k = 0; k < 2000; k++) { const a = randPt(1); a.y = 1 + rnd() * 4; const th = rnd() * 6.283; pts.push([a, V(a.x + Math.cos(th) * 8, a.y + (rnd() - .5) * 2, a.z + Math.sin(th) * 8)]); }
      const time = fn => { const t = performance.now(); for (const [a, b] of pts) fn(a, b); return +((performance.now() - t) / pts.length * 1000).toFixed(2); };
      world.invalidate();
      const cost = { ray8m: time((a, b) => world.ray(a, b, W.STATIC)), rayAll8m: time((a, b) => world.ray(a, b, W.ALL)), sweep8m: time((a, b) => world.sweep(a, b, .25, W.STATIC)), sweepAll8m: time((a, b) => world.sweep(a, b, .25, W.ALL)),
        overlap: time(a => world.overlap(a, .22, W.ALL)), distance2m: time(a => world.distance(a, 2, W.STATIC)), floorAt: time(a => world.floorAt(a.x, a.z, a.y)) };
      // a follow frame (§4.9): 1 sweep ≤ 5 m + 5 rays + an overlap + a people scan, over 2000 frames
      const t = performance.now(); for (const [a, b] of pts) { const c = V(a.x + (b.x - a.x) * .6, a.y + .5, a.z + (b.z - a.z) * .6); world.sweep(a, c, .22, W.STATIC_WIDE | W.CARS); for (let q = 0; q < 5; q++) world.ray(c, V(a.x, a.y + q * .3 - .6, a.z), W.STATIC); world.overlap(c, .22, W.STATIC); world.distance(c, .6, W.PEOPLE); }
      { const t1 = performance.now(); for (let k = 0; k < 200; k++) { world.invalidate(); world.overlap(pts[k][0], .22, W.PEOPLE); } cost.dynGatherUs = +((performance.now() - t1) / 200 * 1000).toFixed(1); }
      // the world's own per-frame work while a mode uses it: tick (rolling walker scan, prefetch, worker feed) + the dynamic shapes packed once
      { const cp = C.camera.position, t1 = performance.now(); for (let k = 0; k < 300; k++) { world.tick(cp); world.overlap(V(cp.x, cp.y, cp.z), .22, W.ALL); } cost.activeFrameUs = +((performance.now() - t1) / 300 * 1000).toFixed(1); }
      cost.followFrameMs = +((performance.now() - t) / pts.length).toFixed(4); out.cost = cost; }
    { const { buildColumns } = await import(new URL('camera/world.worker.js', base).href), r = blocks.find(b => b.data.far?.P) || [...C.stream.blocks.values()].find(b => b.data.far?.P && b.data.far.n > 200), T = [];
      if (r) for (let k = 0; k < 6; k++) { const t = performance.now(); buildColumns({ x0: r.x0, z0: r.z0, size: P, col: 1, parts: [r.data.far], thinMax: 0 }); T.push(+(performance.now() - t).toFixed(2)); }
      out.farFallbackMs = { quads: r ? r.data.far.n / 4 : 0, runs: T }; }
    out.build = { ...world.stat, workerMeanMs: world.stat.built ? +(world.stat.workerMs / world.stat.built).toFixed(2) : null };
    out.pass = ['inside', 'floorAt', 'ray', 'sweep', 'distance', 'thin', 'dynamic'].every(k => out[k]?.pass);
    return out;
  }

  // CLIP: the rig's own follow, real time, on the busiest walker near the view (real walkers drawn); a JPEG every `every` s for `dur` s
  async function liveClip({ view = 'fitstreet', dur = 10, every = .1, label = 'clip' } = {}) { endPriv(); R.toOrbit({ instant: true }); C.setView(view); await settle(); for (let k = 0; k < 120; k++) await raf();
    let run = null, tries = 0;   // (a walker who keeps walking: the busiest run near the view, re-picked while the one followed stands still)
    for (; tries < 8; tries++) { const tg = R.follow.subject ? [R.follow.subject.p[0], R.follow.subject.p[2]] : [C.controls.target.x, C.controls.target.z]; run = busyRun(tg[0], tg[1], 90); const w = run && walkers().find(o => !o.gone && Math.hypot(o.p[0] - run.p[0], o.p[2] - run.p[2]) < .01);
      if (tries === 0) R.follow.drop?.(); if (!R.setMode('follow', w ? { subject: w } : {}) && !R.follow.subject) return { error: 'nobody to follow' }; if (w && R.follow.subject !== w) R.follow.set(w);
      let still = 0; for (let k = 0; k < 150; k++) { await raf(); if ((R.follow.subject?.vc ?? 0) < .4) still++; } if (still < 20) break; }
    const t0 = performance.now(); let n = 0, next = 0; while (true) { await raf(); const t = (performance.now() - t0) / 1000; if (t > dur) break; if (t < next) continue; next += every;
      const s = R.follow.subject, cp = C.camera.position; capture(`${label}-${String(n++).padStart(3, '0')}`, [`FOLLOW (the rig, real time) t=${t.toFixed(1)} s · ${s ? R.people.label(s) : '—'} · ${run ? run.n + ' walkers within 25 m ahead at the start' : ''}`, `cam→geom ${minDist(cp.x, cp.y, cp.z, .8).toFixed(2)} m · arm ${R.follow.dbg?.allowed?.toFixed(2)} m`], null, true); }
    R.toOrbit({ instant: true }); return { frames: n, busy: run?.n, tries }; }
  window.__cp = { liveClip, followReal, followReplay, followFixed, orbitFixed, lampsNear, lampPass, findCorner, cornerPass, flyFixed, spikeTest, flyReal, busyRun, busyRoad, openSpot, findWall, clearRun, orbitAt, settle, prewarm,
    units: pageUnits, gtInside, gtFloor, minDist, segHit, visibility, collStat, CAM,
    pov: () => !!(R.registered?.('pov') || R.pov), target: () => [C.controls.target.x, C.controls.target.z], view: async v => { R.toOrbit({ instant: true }); C.setView(v); await settle(); return [C.controls.target.x, C.controls.target.z]; },
    prewarmWorld, endPriv, shotCount: () => shots.length, shot: k => shots[k], clearShots: () => { shots.length = 0; },
    // (camera build 2c, --eval) the static spans and GT boxes round a point: what the camera met there
    spans: async (x, z, r = .75, y0 = 0, y1 = 4) => { await orbitAt(x, z, 18); makeFollow(); const P2 = PRIV; await prewarmWorld(x, z, 20); const W2 = P2.world, out = [];
      for (let gx = Math.floor((x - r) / .25); gx <= Math.floor((x + r) / .25); gx++) for (let gz = Math.floor((z - r) / .25); gz <= Math.floor((z + r) / .25); gz++) {
        const i = Math.floor(gx * .25 / P), j = Math.floor(gz * .25 / P), e = W2.entry(i, j); if (!e) continue; const c = (gz - j * 128) * 128 + (gx - i * 128), sp = [];
        for (let k = e.off[c]; k < e.off[c + 1]; k += 2) if (e.iv[k + 1] > y0 && e.iv[k] < y1) sp.push([+e.iv[k].toFixed(2), +e.iv[k + 1].toFixed(2), e.ivf ? e.ivf[k >> 1] : -1]);
        if (sp.length) out.push([+(gx * .25).toFixed(2), +(gz * .25).toFixed(2), sp]); }
      const gt = []; for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) cellQuads(cx + .5, cz + .5, (g, q) => { const B = g.B, b = q * 6; if (B[b + 4] < y0 || B[b + 1] > y1 || B[b + 3] < x - r || B[b] > x + r || B[b + 5] < z - r || B[b + 2] > z + r) return; gt.push([...B.slice(b, b + 6)].map(v => +v.toFixed(2)).join(' ')); });
      endPriv(); return { cols: out, gt: [...new Set(gt)].slice(0, 80) }; } };
  return true;
}

// ══ the driver ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
async function session(fn) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-camprobe-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', `--window-size=${W},${H + 88}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
    if (!port) throw new Error('chrome did not start');
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map(), errs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)); };
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    const ev = async (expr, ms = 180000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), sleep(ms).then(() => ({ timeout: true }))]);
      if (r.timeout) throw new Error('page evaluation timed out: ' + expr.slice(0, 80)); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
    await send('Runtime.enable'); await send('Page.enable');
    try { return await fn({ send, ev, errs }); } finally { ws.close(); }
  } finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
}

// ══ metrics (node) ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const quant = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mx = a => a.length ? Math.max(...a) : null, mn = a => a.length ? Math.min(...a) : null, mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const fx = (v, d = 2) => v === null || v === undefined || Number.isNaN(v) ? '–' : typeof v === 'number' ? (Math.abs(v) >= 1000 ? Math.round(v).toString() : v.toFixed(d)) : String(v);
// per-frame kinematics: v (speed), a (|acceleration|), al (|angular acceleration| from yaw/pitch rates), jk (|angular jerk|), each null where
// the frames it spans are not all `ok`
function kinematics(rows, ok, dtOf = k => rows[k].dt) {
  const n = rows.length, V = Array(n).fill(null), Wr = Array(n).fill(null), out = rows.map(() => ({ v: null, a: null, al: null, jk: null, alv: null }));
  for (let k = 1; k < n; k++) { if (!ok(k) || !ok(k - 1)) continue; const dt = dtOf(k); if (!(dt > 0)) continue; const a = rows[k].c, b = rows[k - 1].c;
    V[k] = [(a[0] - b[0]) / dt, (a[1] - b[1]) / dt, (a[2] - b[2]) / dt]; out[k].v = Math.hypot(...V[k]); Wr[k] = [wrapA(rows[k].yaw - rows[k - 1].yaw) / dt, (rows[k].pitch - rows[k - 1].pitch) / dt]; }
  for (let k = 2; k < n; k++) { if (!V[k] || !V[k - 1]) continue; const h = (dtOf(k) + dtOf(k - 1)) / 2; out[k].a = Math.hypot(V[k][0] - V[k - 1][0], V[k][1] - V[k - 1][1], V[k][2] - V[k - 1][2]) / h;
    out[k].alv = [(Wr[k][0] - Wr[k - 1][0]) / h, (Wr[k][1] - Wr[k - 1][1]) / h]; out[k].al = Math.hypot(...out[k].alv); }
  for (let k = 3; k < n; k++) { if (!out[k].alv || !out[k - 1].alv) continue; out[k].jk = Math.hypot(out[k].alv[0] - out[k - 1].alv[0], out[k].alv[1] - out[k - 1].alv[1]) / dtOf(k); }
  return out;
}
// longest run (s) of frames where pred holds
function longestRun(rows, pred, dtOf) { let run = 0, best = 0; for (let k = 0; k < rows.length; k++) { if (pred(rows[k], k)) { run += dtOf(k); if (run > best) best = run; } else run = 0; } return best; }
// FOLLOW real-time rows: mark the frames that count as "same subject, no input" (not a blend, not within 2.5 s after a switch)
// (camera build 2c) a DELIBERATE CUT (follow's dbg.cuts went up, same subject) is a discontinuity, not motion: its frame carries cutF and the
// kinematics skip the differences across it (F2 does not count it; F3 / F4 see no spike from it)
function markFollow(F) { let lastSw = -1e9, prevId = null, lastCut = null; for (const r of F) { if (r.cut !== undefined) { if (lastCut !== null && r.cut !== lastCut) r.cutF = 1; lastCut = r.cut; } if (r.blend) { r.ok = false; continue; } if (prevId !== null && r.id !== prevId) { r.sw = 1; lastSw = r.t; } prevId = r.id; r.ok = r.t - lastSw > 2.5; r.same = !r.sw; } return F; }
function followRealStats(F) {
  markFollow(F); const K = kinematics(F, k => !!F[k].c && !F[k].blend && !F[k].cutF), rows = F.filter(r => r.c), secs = F.reduce((s, r) => s + (r.dt || 0), 0) || 1;
  let snapsLit = 0, snapsX = 0, vmaxLit = 0, vmaxX = 0; const sv = k => { const a = F[k], b = F[k - 1]; return a.s && b.s && a.dt ? Math.hypot(a.s[0] - b.s[0], a.s[2] - b.s[2]) / a.dt : 0; };
  for (let k = 1; k < F.length; k++) { const v = K[k].v; if (v === null || !F[k].c || !F[k - 1].c || F[k].id !== F[k - 1].id) continue; if (v > sv(k) + 6) { snapsLit++; vmaxLit = Math.max(vmaxLit, v); if (F[k].ok) { snapsX++; vmaxX = Math.max(vmaxX, v); } } }
  const okK = K.filter((x, k) => F[k].ok && F[k - 1]?.ok && F[k - 2]?.ok);
  const acc = okK.map(x => x.a).filter(x => x !== null), al = okK.map(x => x.al).filter(x => x !== null), jk = K.filter((x, k) => F[k].ok && F[k - 3]?.ok).map(x => x.jk).filter(x => x !== null);
  const f1 = rows.filter(r => r.nc < .12 || r.inside || r.pd < 0 || r.cd < 0).length, f1by = { geom: rows.filter(r => r.nc < .12).length, inside: rows.filter(r => r.inside).length, insideNcMax: mx(rows.filter(r => r.inside).map(r => r.nc)), insideY: mx(rows.filter(r => r.inside).map(r => r.c[1])), person: rows.filter(r => r.pd < 0).length, car: rows.filter(r => r.cd < 0).length };
  const same = k => F[k]?.c && F[k - 1]?.c && F[k - 2]?.c && F[k].id === F[k - 1].id && F[k - 1].id === F[k - 2].id, litK = K.filter((x, k) => same(k));
  const wideRun = longestRun(F, r => !!r.c && 1 - r.wide / 12 < .5, k => F[k].dt || 0), thinRun = longestRun(F, r => !!r.c && r.vis < .5 && r.thin >= r.wide, k => F[k].dt || 0);
  return { secs: +secs.toFixed(1), frames: F.length, f1, f1by, accMaxLit: mx(litK.map(x => x.a).filter(x => x !== null)), alMaxLit: mx(litK.map(x => x.al).filter(x => x !== null)), snapsLit, vmaxLit, snapsX, vmaxX, accP99: quant(acc, .99), accMax: mx(acc), alMax: mx(al), jkP99: quant(jk, .99), wideRun, thinRun,
    armMin: mn(rows.filter(r => r.ok).map(r => r.arm)), elevMax: mx(rows.filter(r => r.ok).map(r => r.elev)), ppl: rows.length ? rows.filter(r => r.ppl > 0).length / rows.length : null,
    gtFull: rows.length ? rows.filter(r => r.gt === 'f').length / rows.length : null };
}
// F12: switches (id changes) — ≤ 25 m: the least GT clearance in the 2.5 s after; > 25 m: travel frames (camera faster than subject + 6 m/s, after the first frame)
function switchStats(F) { markFollow(F); const out = [];
  for (let k = 1; k < F.length; k++) { if (!F[k].sw || !F[k].c) continue; let j = k - 1; while (j >= 0 && !F[j].s) j--; if (j < 0) continue; const d = Math.hypot(F[k].s[0] - F[j].s[0], F[k].s[2] - F[j].s[2]); let minC = 1e9, travel = 0;
    for (let m = k; m < F.length && F[m].t - F[k].t < 2.5; m++) { const r = F[m]; if (!r.c) continue; minC = Math.min(minC, r.inside ? 0 : r.nc); if (m > k && F[m - 1].c && r.dt) { const v = Math.hypot(r.c[0] - F[m - 1].c[0], r.c[1] - F[m - 1].c[1], r.c[2] - F[m - 1].c[2]) / r.dt; if (v > 7.35) travel++; } }
    out.push({ t: F[k].t, d: +d.toFixed(1), minClear: +minC.toFixed(3), travel }); }
  return out; }
function fixedFollowStats(out, hz, extra = {}) { const dt = 1 / hz, K = kinematics(out, () => true, () => dt), T0 = extra.warm ?? 1;
  let snaps = 0, vmax = 0, stall = 0, stallMax = 0; for (let k = 1; k < out.length; k++) { const v = K[k].v, s = Math.hypot(out[k].s[0] - out[k - 1].s[0], out[k].s[2] - out[k - 1].s[2]) / dt; if (v === null) continue;
    if (v > s + 6) { snaps++; vmax = Math.max(vmax, v); } if (out[k].t > T0 && s > .3) { if (v < .5 * s) { stall += dt; stallMax = Math.max(stallMax, stall); } else stall = 0; } }
  const ks = K.filter((x, k) => out[k].t > .2), acc = ks.map(x => x.a).filter(x => x !== null), al = ks.map(x => x.al).filter(x => x !== null), jk = ks.map(x => x.jk).filter(x => x !== null);
  return { snaps, vmax, stallMax, accP99: quant(acc, .99), accMax: mx(acc), alMax: mx(al), jkP99: quant(jk, .99), f1: out.filter(r => r.nc !== undefined && (r.nc < .12 || r.inside || r.pd < 0 || r.cd < 0)).length,
    wideRun: out[0]?.wide !== undefined ? longestRun(out, r => 1 - r.wide / 12 < .5, () => dt) : null, thinRun: out[0]?.thin !== undefined ? longestRun(out, r => r.vis < .5 && r.thin >= r.wide, () => dt) : null,
    pulled: out.some(r => r.arm !== undefined && r.arm < r.want - .5), thinPulled: out.some(r => r.thinArm === 1), armMin: out[0]?.arm !== undefined ? mn(out.map(r => r.arm)) : null,
    under75: out[0]?.vis !== undefined ? longestRun(out, r => r.vis < .75, () => dt) : null, visMin: out[0]?.vis !== undefined ? mn(out.map(r => r.vis)) : null };
}
// FLY fixed-dt analyses
function flyAccel(out, hz, from = 0) { const dt = 1 / hz, A = [], J = []; let prevA = null;
  for (let k = 2; k < out.length; k++) { const a = out[k].c, b = out[k - 1].c, c = out[k - 2].c, av = [0, 1, 2].map(i => (a[i] - 2 * b[i] + c[i]) / (dt * dt));
    if (k >= from) { A.push(Math.hypot(...av)); if (prevA) J.push(Math.hypot(av[0] - prevA[0], av[1] - prevA[1], av[2] - prevA[2]) / dt); } prevA = av; }
  return { aMax: mx(A), jMax: mx(J) }; }
function wallStats(out, hz) { let kPeak = 0; for (let k = 0; k < out.length; k++) if (out[k].v > out[kPeak].v) kPeak = k; const a = flyAccel(out, hz, kPeak); const last = out[out.length - 1];
  return { vPeak: out[kPeak].v, tPeak: out[kPeak].t, decelPeak: a.aMax, jerkMax: a.jMax, stop: last.c, vEnd: last.v, ncMin: mn(out.map(r => r.nc)), ncEnd: last.nc }; }
// contact: the first frame (after the approach starts) where the speed toward the wall has fallen under 10 % of the approach's; kept =
// the mean tangential speed over the 0.5 s after contact ÷ the mean before the camera came within 7 m of the wall
function glanceStats(out, hz, setup) { const dt = 1 / hz, [dx, dz] = setup.dir, [tx, tz] = setup.t, [hx, hz2] = setup.hit;
  const nd = r => -((r.c[0] - hx) * dx + (r.c[2] - hz2) * dz), vt = k => k ? ((out[k].c[0] - out[k - 1].c[0]) * tx + (out[k].c[2] - out[k - 1].c[2]) * tz) / dt : 0, vn = k => k ? (nd(out[k - 1]) - nd(out[k])) / dt : 0;
  const pre = out.map((r, k) => k).filter(k => k && out[k].t > .4 && nd(out[k]) > 7), before = mean(pre.map(vt)), vn0 = mx(pre.map(vn)) || 1;
  const kc = out.findIndex((r, k) => k && r.t > .4 && nd(r) <= 7 && vn(k) < .1 * vn0); if (kc < 0) return { before, after: null, kept: null, vn0 };
  const after = mean(out.map((r, k) => k).filter(k => k > kc && out[k].t <= out[kc].t + .5).map(vt));
  return { before, after, kept: before ? after / before : null, vn0, dContact: nd(out[kc]), tContact: out[kc].t }; }
function glideStats(out) { const k0 = out.findIndex(r => r.t >= 2.5); const a = out[k0].c, b = out[out.length - 1].c; return { vRelease: out[k0].v, glide: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), vEnd: out[out.length - 1].v }; }
function floorStats(out, floorY) { const rel = out.filter(r => r.t >= 3), held = out.filter(r => r.t > 2 && r.t < 3); return { floorY, heldMin: mn(held.map(r => r.c[1])), heldMax: mx(held.map(r => r.c[1])), peakAfter: mx(rel.map(r => r.c[1])), overshoot: mx(rel.map(r => r.c[1])) - (floorY + 1.4) }; }
function lookStats(out, k0) { const y0 = out[k0 - 1].yaw, yEnd = out[out.length - 1].yaw, tot = wrapA(yEnd - y0), first = wrapA(out[k0].yaw - y0); let k90 = k0; while (k90 < out.length && Math.abs(wrapA(out[k90].yaw - y0)) < .9 * Math.abs(tot)) k90++;
  return { total: tot, sameFrame: tot ? first / tot : null, ms90: k90 < out.length ? (out[k90].t - out[k0].t) * 1000 : null }; }
function injectStats(out, hz) { const dt = 1 / hz; let outT = null, deeper = false; const d0 = out[0].inside ? -out[0].nc : out[0].nc;
  for (let k = 0; k < out.length; k++) { if (!out[k].inside) { if (outT === null) outT = out[k].t; } else if (outT === null && k && out[k - 1].inside && out[k].nc > out[k - 1].nc + .02) deeper = true; }
  return { startInside: !!out[0].inside, startDepth: out[0].inside ? out[0].nc : 0, outT, deeper }; }
function flyRealStats(F) { const bad = F.filter(r => r.pd < 0 || r.cd < 0 || r.nc < .12 || r.inside); return { frames: F.length, person: F.filter(r => r.pd < 0).length, car: F.filter(r => r.cd < 0).length, geom: F.filter(r => r.nc < .12 || r.inside).length, y1: bad.length,
  yMin: mn(F.map(r => r.c[1])), yMax: mx(F.map(r => r.c[1])), pdMin: mn(F.map(r => r.pd)), cdMin: mn(F.map(r => r.cd)) }; }

// ══ run ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const T0 = Date.now(), since = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s', res = { when: new Date().toISOString(), base: BASE, extra: EXTRA, hz: HZ, quick: QUICK, scenarios: {}, setup: {} };
const url = `${BASE}?q=medium&w=${W}&h=${H}&nodyn=1${EXTRA ? '&' + EXTRA : ''}`;
const log = (...a) => console.log(`[${since().padStart(5)}]`, ...a);
await session(async S => {
  await S.send('Page.navigate', { url }); const t0 = Date.now(); let m = null;
  while (Date.now() - t0 < 120000) { await sleep(250); m = await S.ev(`(() => { const c = window.__city; if (!c) return null; return { full: c.marks.full ?? null, cam: !!c.cam, err: document.getElementById('err')?.textContent || '' }; })()`).catch(() => null); if (m?.err || m?.full) break; }
  if (!m?.full) throw new Error('page did not finish streaming: ' + JSON.stringify(m)); if (!m.cam) throw new Error('no camera rig on the page');
  log(`page streamed in ${(m.full / 1000).toFixed(1)} s · ${url}`);
  if (ROWS) await S.ev('window.__cpRows = true'); if (FSRC) await S.ev(`window.__cpFollowSrc = ${JSON.stringify(FSRC)}`); await S.ev(`(${pageProbe.toString()})()`);
  if (opt('eval', null)) { console.log(JSON.stringify(await S.ev(opt('eval'), 600000))); return; }   // (--eval '<expr>': one in-page expression after the probe is installed, printed as JSON; e.g. __cp.spans(x, z))
  if (CFG) { await S.ev(`(() => { const m = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') m(a[k], v); else a[k] = v; } }; m(__cp.CAM, ${CFG}); return true; })()`); log('config override ' + CFG); } res.pov = await S.ev('__cp.pov()'); res.cfgPitch = await S.ev('__cp.CAM.follow.pitch');
  const shotsOut = async prefix => { const n = await S.ev('__cp.shotCount()'); if (SHOTS && n) { await fs.mkdir(SHOTS, { recursive: true }); for (let k = 0; k < n; k++) { const x = await S.ev(`__cp.shot(${k})`); await fs.writeFile(path.join(SHOTS, `${x.name}.${x.data.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`), Buffer.from(x.data.split(',')[1], 'base64')); } } await S.ev('__cp.clearShots()'); };
  const shoot = !!SHOTS, perfFrames = [], collMax = [];
  const keepPerf = F => { for (const r of F) if (r.ms !== undefined) perfFrames.push(r.ms); };

  let FIX = null; const fixture = async () => FIX ??= JSON.parse(zlib.gunzipSync(await fs.readFile(CROWD)).toString()).recs;
  // ── REVIEW (--review --shots <dir> [--follow-src <file>] [--clip]): the same lamp passes and real-walker replays rendered at fixed
  // moments (60 Hz), for a before / after board; --clip adds the rig's live follow of the busiest walker (a JPEG every 0.1 s for 10 s)
  if (REVIEW) { const recs = await fixture(), lamps = await S.ev(`__cp.lampsNear(-70, 10, 90, 4)`); if (args.includes('--clip-only')) lamps.length = 0;
    // --snaps 'A3:12.5,17;L1@0:11.6' (camera build 2c): replays / lamp passes and the moments to render, instead of the defaults
    const SN = opt('snaps', null), spec = SN ? SN.split(';').filter(Boolean).map(e => { const [k, v] = e.split(':'); return [k, v.split(',').map(Number)]; }) : null;
    const LP = spec ? spec.filter(([k]) => k[0] === 'L').map(([k, snap]) => { const [li, lat] = k.slice(1).split('@').map(Number); return [li, lat, snap]; }) : [[1, 0, [0, 2.5, 4.6, 6.5]], [0, .3, [0, 2.5, 4.6, 6.5]], [3, 1, [0, 2.5, 4.6, 6.5]]];
    const RP = spec ? spec.filter(([k]) => k[0] !== 'L') : [['A1', [5, 12.6, 16, 24]], ['A3', [11.8, 12.4, 18, 25.7]], ['T', [4, 8.1, 13]]];
    for (const [li, lat, snap] of lamps.length ? LP : []) { await S.ev(`__cp.orbitAt(${lamps[li].x}, ${lamps[li].z}, 22)`, 60000); await S.ev(`__cp.lampPass(${JSON.stringify(lamps[li])}, ${lat}, 60, ${JSON.stringify({ label: 'L' + li, snap })})`, 240000); await shotsOut(); }
    for (const [lab, snap] of lamps.length ? RP : []) { await S.ev(`__cp.followReplay(${JSON.stringify(recs[lab])}, 60, ${JSON.stringify({ snap, label: lab })})`, 600000); await shotsOut(); }
    if (args.includes('--clip')) { const r = await S.ev(`__cp.liveClip({ dur: 10, every: .1, label: 'clip' })`, 240000); log('clip', JSON.stringify(r)); await shotsOut(); }
    log(`review shots in ${SHOTS}`); return; }
  // ── A (+ tab): --record runs the rig's own follow in real time and keeps the crowd (the fixture); else the fixture replayed per Hz
  const SPOTS = [['A1', { view: 'fitstreet' }], ['A2', { at: [20, -20] }], ['A3', { at: [-30, 60] }]], A = [];
  if (RECORD) { const recs = {};
    for (const [label, o] of SPOTS) { const r = await S.ev(`__cp.followReal(${JSON.stringify({ ...o, dur: 30, tab: 10, label, rec: true })})`, 240000); if (r.error) throw new Error(label + ' ' + r.error); recs[label] = r.rec; log(`recorded ${label}: ${r.rec.frames.length} frames`); }
    const r = await S.ev(`__cp.followReal(${JSON.stringify({ view: 'fitstreet', dur: 16, tab: 2.5, label: 'T', rec: true })})`, 240000); if (r.error) throw new Error('tab ' + r.error); recs.T = r.rec; log(`recorded T: ${r.rec.frames.length} frames`);
    await fs.mkdir(RUNS, { recursive: true }); const buf = zlib.gzipSync(JSON.stringify({ when: new Date().toISOString(), base: BASE, recs }), { level: 9 }); await fs.writeFile(CROWD, buf);
    log(`saved ${path.relative(process.cwd(), CROWD)} (${(buf.length / 1024).toFixed(0)} KB)`); return; }
  if (ONLY.has('a') && LIVE) { for (const [label, o] of SPOTS) { const r = await S.ev(`__cp.followReal(${JSON.stringify({ ...o, dur: QUICK ? 10 : 30, tab: QUICK ? 4 : 10, label, shoot })})`, 240000); if (r.error) { log(label, r.error); continue; }
      keepPerf(r.F); collMax.push(r.collFrameMax); const st = followRealStats(r.F), sw = switchStats(r.F); A.push({ label, hz: 'rt', F: r.F, st, sw, coll: r.coll }); await shotsOut(); } }
  else if (ONLY.has('a')) { const recs = await fixture();
    for (const [label] of SPOTS) for (const hz of HZ) { const r = await S.ev(`__cp.followReplay(${JSON.stringify(recs[label])}, ${hz})`, 600000);
      keepPerf(r.F); const st = followRealStats(r.F), sw = switchStats(r.F); A.push({ label, hz, F: r.F, st, sw, tiers: r.tiers });
      log(`${label} ${hz} Hz replay ${st.secs} s · F1 ${st.f1} ${JSON.stringify(st.f1by)} · snaps ${st.snapsX} (max ${fx(st.vmaxX, 0)} m/s) · acc p99/max ${fx(st.accP99, 0)}/${fx(st.accMax, 0)} · ang acc max ${fx(st.alMax, 0)} jerk p99 ${fx(st.jkP99, 0)} · wide occl ${fx(st.wideRun * 1000, 0)} ms · arm min ${fx(st.armMin)} elev ${fx(st.elevMax)} · ${JSON.stringify(r.tiers)} · sw ${JSON.stringify(sw)}`); } }
  res.scenarios.a = A.map(x => ({ label: x.label, hz: x.hz, stats: x.st, switches: x.sw, tiers: x.tiers, ...(ROWS ? { F: x.F } : {}) }));
  // ── B: A1's longest single-subject stretch (recorded), replayed at each Hz
  let pathB = null;
  if (ONLY.has('b')) { const fr = (await fixture()).A1.frames; let best = [], cur = []; for (const f of fr) { const s0 = f[2].find(r => r[0] === f[1]); if (!s0 || (cur.length && f[1] !== cur[cur.length - 1].id)) { if (cur.length > best.length) best = cur; cur = []; } if (s0) cur.push({ id: f[1], t: f[0], s: [s0[1], s0[2], s0[3]], sy: s0[4], vc: s0[5] }); } if (cur.length > best.length) best = cur;
    pathB = best.slice(0, 60 * 20).map(r => ({ t: r.t, s: r.s, sy: r.sy, vc: r.vc }));
    const B = {}; for (const hz of HZ) B[hz] = await S.ev(`__cp.followFixed(${JSON.stringify(pathB)}, ${hz})`);
    const ref = B[Math.max(...HZ)], dev = {}; for (const hz of HZ) { const o = B[hz].out, rr = ref.out, step = Math.round(Math.max(...HZ) / hz); let m = 0, s = 0, n = 0; for (let k = 0; k < o.length && k * step < rr.length; k++) { const d = Math.hypot(o[k].c[0] - rr[k * step].c[0], o[k].c[1] - rr[k * step].c[1], o[k].c[2] - rr[k * step].c[2]); m = Math.max(m, d); s += d; n++; } dev[hz] = { max: m, mean: s / n }; }
    res.scenarios.b = { path: { secs: +(pathB[pathB.length - 1].t - pathB[0].t).toFixed(1), n: pathB.length }, dev, stats: Object.fromEntries(HZ.map(hz => [hz, fixedFollowStats(B[hz].out, hz)])), ms: Object.fromEntries(HZ.map(hz => [hz, B[hz].ms])) };
    log(`B replay ${res.scenarios.b.path.secs} s · max Δ vs ${Math.max(...HZ)} Hz: ${HZ.map(hz => hz + ' Hz ' + fx(dev[hz].max)).join(' · ')}`); }
  // ── L: 4 lamps near (−70, 10) × 4 offsets × each Hz
  if (ONLY.has('l')) { const lamps = await S.ev(`__cp.lampsNear(-70, 10, 90, ${QUICK ? 2 : 4})`), lats = QUICK ? [0, .6] : [0, .3, .6, 1]; const L = [];
    for (const [li, lamp] of lamps.entries()) { await S.ev(`__cp.orbitAt(${lamp.x}, ${lamp.z}, 22)`, 60000);
      for (const lat of lats) for (const hz of HZ) { const r = await S.ev(`__cp.lampPass(${JSON.stringify(lamp)}, ${lat}, ${hz}, ${JSON.stringify({ shoot: shoot && hz === 60, label: 'L' + li })})`, 240000);
        L.push({ lamp: li, lat, hz, tier: r.tier, walk: r.walk, ends: r.ends, lampAt: [lamp.x, lamp.z, lamp.rot], st: fixedFollowStats(r.out, hz), ...(ROWS ? { out: r.out } : {}) }); }
      await shotsOut(); }
    res.scenarios.l = L; for (const hz of HZ) { const x = L.filter(p => p.hz === hz); log(`L ${hz} Hz · ${x.length} passes · pulled ${x.filter(p => p.st.pulled).length} (by thin ${x.filter(p => p.st.thinPulled).length}) · stalls ${x.filter(p => p.st.stallMax > .3).length} (max ${fx(mx(x.map(p => p.st.stallMax)))} s) · snaps ${x.reduce((s, p) => s + p.st.snaps, 0)} (max ${fx(mx(x.map(p => p.st.vmax)), 0)} m/s) · arm min ${fx(mn(x.map(p => p.st.armMin)))} · GT ${[...new Set(x.map(p => p.tier))].join('/')}`); } }
  // ── O: orbit on open ground
  if (ONLY.has('o')) { const tg = await S.ev(`__cp.view('fitstreet')`, 60000); const spot = await S.ev(`__cp.openSpot(${tg[0]}, ${tg[1]}, 70)`); res.setup.open = spot;
    const O = {}; if (spot) { await S.ev(`__cp.orbitAt(${spot.x}, ${spot.z}, 24)`, 60000); for (const hz of HZ) { const r = await S.ev(`__cp.orbitFixed(${JSON.stringify(spot)}, ${hz})`);
      const o = r.out, s = r.s, az = c => Math.atan2(c[0] - s[0], c[2] - s[2]), rad = c => Math.hypot(c[0] - s[0], c[2] - s[2]), k1 = o.findIndex(x => x.t >= 1), kEnd = o.findIndex(x => x.t >= 1 + r.dur - 1e-6), k15 = o.findIndex(x => x.t >= 2);
      // (input lands in frames k1 … kEnd − 1; frame k's change includes its own input: sum the changes over those same frames — a camera that turns
      // in the frame the input arrives shows 0 lag; summing from k1 + 1 charged it one frame of input, rate × dt)
      let acc = 0; for (let k = k1; k <= kEnd; k++) acc += wrapA(az(o[k].c) - az(o[k - 1].c)); const inp = r.rate * (o[kEnd].t - o[k1].t); let acc1 = 0; for (let k = k1; k < k15; k++) acc1 += wrapA(az(o[k].c) - az(o[k - 1].c));
      O[hz] = { lagEnd: (inp - acc) * 180 / Math.PI, lag1s: (r.rate * (o[k15].t - o[k1].t) - acc1) * 180 / Math.PI, sag: 1 - mn(o.slice(k1, kEnd + 1).map(x => rad(x.c))) / rad(o[k1].c) }; } }
    res.scenarios.o = O; log(`O orbit at (${spot?.x}, ${spot?.z}) clear ${fx(spot?.clear, 1)} m · ${HZ.map(hz => `${hz} Hz lag ${fx(O[hz]?.lagEnd, 1)}° (1 s ${fx(O[hz]?.lag1s, 1)}°) sag ${fx(O[hz]?.sag * 100, 1)}%`).join(' · ')}`); }
  // ── corner
  if (ONLY.has('corner')) { const tg = await S.ev(`__cp.view('fitstreet')`, 60000); const cn = await S.ev(`__cp.findCorner(${tg[0]}, ${tg[1]}, 90)`); res.setup.corner = cn; const Cn = {};
    if (cn) { await S.ev(`__cp.orbitAt(${cn.k[0]}, ${cn.k[1]}, 22)`, 60000); const cn2 = await S.ev(`__cp.findCorner(${cn.k[0]}, ${cn.k[1]}, 4)`) || cn;
      for (const hz of HZ) { const r = await S.ev(`__cp.cornerPass(${JSON.stringify(cn2)}, ${hz}, ${JSON.stringify({ shoot: shoot && hz === 60 })})`, 120000); Cn[hz] = fixedFollowStats(r.out, hz, { warm: 1 }); Cn[hz].wideMax = mx(r.out.map(x => x.wide)); if (ROWS) Cn[hz].F = r.out; } await shotsOut(); }
    res.scenarios.corner = Cn; log(`corner ${cn ? `(${cn.k.map(v => v.toFixed(1))})` : 'NOT FOUND'} · ${HZ.map(hz => `${hz} Hz wide-occl ${fx((Cn[hz]?.wideRun ?? NaN) * 1000, 0)} ms (most wall rays ${Cn[hz]?.wideMax}/12, min vis ${fx(Cn[hz]?.visMin)}, min arm ${fx(Cn[hz]?.armMin)})`).join(' · ')}`); }
  // ── tab (the fixture's T, replayed per Hz; --live: real time)
  if (ONLY.has('tab')) { if (LIVE) { const r = await S.ev(`__cp.followReal(${JSON.stringify({ view: 'fitstreet', dur: QUICK ? 8 : 16, tab: 2.5, label: 'T', shoot })})`, 240000);
      if (r.error) log('tab', r.error); else { keepPerf(r.F); res.scenarios.tab = { rt: { switches: switchStats(r.F), stats: followRealStats(r.F) } }; } await shotsOut(); }
    else { const rec = (await fixture()).T; res.scenarios.tab = {};
      for (const hz of HZ) { const r = await S.ev(`__cp.followReplay(${JSON.stringify(rec)}, ${hz})`, 600000); keepPerf(r.F); const sw = switchStats(r.F), st = followRealStats(r.F); res.scenarios.tab[hz] = { switches: sw, stats: st, ...(ROWS ? { F: r.F } : {}) };
        log(`tab ${hz} Hz ${sw.length} switches · ${sw.map(s => `${s.d} m: clear ${fx(s.minClear)} m, travel ${s.travel}`).join(' · ')} · F1 ${st.f1} ${JSON.stringify(st.f1by)}`); } } }
  // ── C (+ look, inject): the wall and glide setups from the GT round Fit Street
  let wall = null, glide = null, floorAt = null;
  if (ONLY.has('c') || ONLY.has('inject') || ONLY.has('d')) { const tg = await S.ev(`__cp.view('fitstreet')`, 60000); const why = [];
    for (const [cx, cz] of [tg, [16, -16], [48, -48], [-16, 48], [80, 16], [-48, -48], [112, -80]]) { if (cx !== tg[0]) await S.ev(`__cp.orbitAt(${cx}, ${cz}, 80)`, 60000); for (const y of [20, 16, 24, 12]) { wall = await S.ev(`__cp.findWall(${cx}, ${cz}, ${y}, 64)`); if (wall && !wall.none) break; } if (wall && !wall.none) break; why.push([cx, cz, wall?.why]); wall = null; }
    res.setup.wall = wall; res.setup.wallMiss = why;
    if (wall) { await S.ev(`__cp.orbitAt(${(wall.start[0] + wall.hit[0]) / 2}, ${(wall.start[2] + wall.hit[1]) / 2}, 60)`, 60000); const w2 = await S.ev(`__cp.findWall(${(wall.start[0] + wall.hit[0]) / 2}, ${(wall.start[2] + wall.hit[1]) / 2}, ${wall.y}, 64)`); if (w2 && !w2.none) wall = w2; res.setup.wall = wall; }
    log(`wall ${wall ? `hit (${wall.hit.map(v => v.toFixed(1))}) at y ${wall.y} from ${wall.d.toFixed(1)} m, dir ${wall.dir}, slide side ${wall.side}` : 'NOT FOUND ' + JSON.stringify(why)}`); }
  if (ONLY.has('c')) { const Cc = { wall: {}, glance: {}, glide: {}, floor: {} };
    if (wall) for (const hz of HZ) { const r = await S.ev(`__cp.flyFixed('wall', ${hz}, ${JSON.stringify({ p: wall.start, yaw: wall.yaw })})`); Cc.wall[hz] = wallStats(r.out, hz); }
    if (wall?.side) { const [dx, dz] = wall.dir, [tx, tz] = wall.t, c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6), vx = tx * c30 + dx * s30, vz = tz * c30 + dz * s30;
      const kx = wall.hit[0] - tx * 3, kz = wall.hit[1] - tz * 3, start = [kx - vx * 24, wall.y, kz - vz * 24], setup = { ...wall, hit: [kx, kz] }; res.setup.glance = { start, v: [vx, vz] };
      for (const hz of HZ) { const r = await S.ev(`__cp.flyFixed('glance', ${hz}, ${JSON.stringify({ p: start, yaw: Math.atan2(-vx, -vz) })})`); Cc.glance[hz] = glanceStats(r.out, hz, setup); } }
    const tg = await S.ev(`__cp.target()`); const spot = res.setup.open || await S.ev(`__cp.openSpot(${tg[0]}, ${tg[1]}, 70)`); res.setup.open = spot;
    if (spot) { await S.ev(`__cp.orbitAt(${spot.x}, ${spot.z}, 40)`, 60000); glide = await S.ev(`__cp.clearRun(${spot.x}, ${spot.z}, 25)`) || await S.ev(`__cp.clearRun(${spot.x}, ${spot.z}, 60)`); res.setup.glide = glide;
      floorAt = await S.ev(`__cp.gtFloor(${spot.x}, ${spot.z}, 1)`);
      if (glide) for (const hz of HZ) { const r = await S.ev(`__cp.flyFixed('glide', ${hz}, ${JSON.stringify({ p: glide.start, yaw: glide.yaw })})`); Cc.glide[hz] = glideStats(r.out); }
      for (const hz of HZ) { const r = await S.ev(`__cp.flyFixed('floor', ${hz}, ${JSON.stringify({ p: [spot.x, floorAt + 8, spot.z], yaw: 0 })})`); Cc.floor[hz] = floorStats(r.out, floorAt); } }
    res.scenarios.c = Cc; log(`C setups: glide from y ${glide?.start?.[1] ?? '–'} · floor at the open spot ${fx(floorAt)} m (GT ${spot?.tier})`);
    log(`C wall ${HZ.map(hz => `${hz} Hz v ${fx(Cc.wall[hz]?.vPeak, 1)} (t ${fx(Cc.wall[hz]?.tPeak)}) end v ${fx(Cc.wall[hz]?.vEnd)} clear ${fx(Cc.wall[hz]?.ncEnd)} decel ${fx(Cc.wall[hz]?.decelPeak, 0)} jerk ${fx(Cc.wall[hz]?.jerkMax, 0)}`).join(' · ')}`);
    log(`C glance ${HZ.map(hz => `${hz} Hz kept ${fx((Cc.glance[hz]?.kept ?? NaN) * 100, 0)}%`).join(' · ')} · glide ${HZ.map(hz => `${hz} Hz ${fx(Cc.glide[hz]?.glide)} m`).join(' · ')} · floor overshoot ${HZ.map(hz => `${hz} Hz ${fx(Cc.floor[hz]?.overshoot)} m`).join(' · ')}`); }
  if (ONLY.has('look')) { const Lk = {}; const st = res.setup.open || { x: -70, z: 10 }; for (const hz of HZ) { const r = await S.ev(`__cp.flyFixed('look', ${hz}, ${JSON.stringify({ p: [st.x, 30, st.z], yaw: 0 })})`); Lk[hz] = lookStats(r.out, r.k0); }
    const spike = await S.ev('__cp.spikeTest()'); res.scenarios.look = { fixed: Lk, spike }; log(`look ${HZ.map(hz => `${hz} Hz same-frame ${fx(Lk[hz].sameFrame * 100, 0)}% 90% at ${fx(Lk[hz].ms90, 0)} ms`).join(' · ')} · spike ${JSON.stringify(spike)}`); }
  if (ONLY.has('inject') && wall) { const Ij = {}; const [dx, dz] = wall.dir; let p = null; for (const dd of [.6, 1, .4]) { const q = [wall.hit[0] + dx * dd, wall.y, wall.hit[1] + dz * dd]; if (await S.ev(`__cp.gtInside(${q.join(',')})`)) { p = q; break; } }
    res.setup.inject = p; if (p) for (const hz of HZ) { const r = await S.ev(`__cp.flyFixed('inject', ${hz}, ${JSON.stringify({ p, yaw: wall.yaw })})`); Ij[hz] = injectStats(r.out, hz); }
    res.scenarios.inject = Ij; log(`inject ${p ? HZ.map(hz => `${hz} Hz out at ${fx(Ij[hz].outT)} s deeper ${Ij[hz].deeper}`).join(' · ') : 'no inside point found'}`); }
  // ── D / hover: real time, the rig's fly mode
  if (ONLY.has('d') || ONLY.has('hover')) { const tg = await S.ev(`__cp.view('fitstreet')`, 60000); for (let k = 0; k < 2; k++) await S.ev('new Promise(r => setTimeout(r, 1000))');
    const run = await S.ev(`__cp.busyRun(${tg[0]}, ${tg[1]})`), road = await S.ev(`__cp.busyRoad(${tg[0]}, ${tg[1]})`); res.setup.busy = { run, road }; const D = {};
    const fwd = h => [Math.sin(h), Math.cos(h)];
    const runs = [];
    if (ONLY.has('d')) { if (run) { const [fx0, fz0] = fwd(run.h), base = [run.p[0] - fx0 * 10, run.p[1], run.p[2] - fz0 * 10]; runs.push(['D1', { pos: [base[0], base[1] + 2.2, base[2]], yaw: run.h + Math.PI, keys: ['KeyW'], dur: QUICK ? 3 : 5 }], ['D1b', { pos: [base[0], base[1] + 3, base[2]], yaw: run.h + Math.PI, keys: ['KeyW', 'KeyQ'], dur: QUICK ? 3 : 4 }]); }
      if (road) { const [fx0, fz0] = fwd(road.h); runs.push(['D2', { pos: [road.p[0] - fx0 * 12, 3, road.p[2] - fz0 * 12], yaw: road.h + Math.PI, keys: ['KeyW', 'KeyQ'], dur: QUICK ? 3 : 4 }]); }
      if (wall) runs.push(['D3', { pos: wall.start, yaw: wall.yaw, keys: ['KeyW', 'ShiftLeft'], dur: QUICK ? 3 : 5 }]); }
    if (ONLY.has('hover') && run) runs.push(['hover', { pos: [run.p[0], run.p[1] + 1.6, run.p[2]], yaw: run.h + Math.PI, keys: [], dur: QUICK ? 4 : 10 }]);
    for (const [label, o] of runs) { const r = await S.ev(`__cp.flyReal(${JSON.stringify({ ...o, label, shoot })})`, 120000); keepPerf(r.F); collMax.push(r.collFrameMax); D[label] = flyRealStats(r.F); if (label === 'D3') D[label].wall = { ...flyAccel(r.F.map(x => ({ c: x.c })), 60), note: 'real-time rows; accel at a nominal 60 Hz' };
      if (ROWS) D[label].F = r.F; log(`${label.padEnd(5)} ${D[label].frames} fr · inside person ${D[label].person} car ${D[label].car} geometry ${D[label].geom} · y ${fx(D[label].yMin)}–${fx(D[label].yMax)} m · person min ${fx(D[label].pdMin)} car min ${fx(D[label].cdMin)}`); }
    res.scenarios.d = D; await shotsOut(); }
  res.perf = { frames: perfFrames.length, mean: mean(perfFrames), p99: quant(perfFrames, .99), max: mx(perfFrames), collFrameMax: mx(collMax.filter(x => x !== null && x !== undefined)), coll: await S.ev('__cp.collStat()') };
  // ── units
  if (ONLY.has('units')) { res.scenarios.units = await S.ev('__cp.units()', 600000); log('units', JSON.stringify(res.scenarios.units).slice(0, 2000)); }
  res.errors = S.errs.splice(0); if (res.errors.length) log('page errors:', res.errors.slice(0, 5).join(' | '));
});

if (RECORD || REVIEW || opt('eval', null)) process.exit(0);
// ══ the acceptance table (RESEARCH §5) ════════════════════════════════════════════════════════════════════════════════════════════════
// each row: per column (rt = real time, <hz>, all) a display string; ok = PASS / FAIL from the numbers (null: report only)
const T = [], sc = res.scenarios, hzCols = HZ.map(String);
const row = (id, what, vals, target, ok, today) => T.push({ id, what, vals, target, ok, today });
const per = f => Object.fromEntries(HZ.map(hz => [hz, f(hz)]));
const Lh = hz => (sc.l || []).filter(p => p.hz === hz), Aall = sc.a || [];
const sum = a => a.reduce((s, x) => s + (x ?? 0), 0), nn = a => a.filter(x => x !== null && x !== undefined && !Number.isNaN(x));
const all = a => a.length > 0 && a.every(Boolean);
// A and tab per column: the replays per Hz (or 'rt' with --live)
const aCols = [...new Set([...Aall.map(a => a.hz), ...Object.keys(sc.tab || {}).map(k => k === 'rt' ? 'rt' : +k)])], Ah = c => Aall.filter(a => a.hz === c), Tb = c => sc.tab?.[c];
const perA = f => Object.fromEntries(aCols.map(c => [c, f(c)])), hzAll = [...new Set([...aCols, ...HZ])];
const perAll = f => Object.fromEntries(hzAll.map(c => [c, f(c)]));
if (sc.a || sc.l || sc.tab) { const f1 = c => sum(Ah(c).map(a => a.stats.f1)) + (Tb(c)?.stats?.f1 ?? 0) + sum(Lh(c).map(p => p.st.f1));
  row('F1', 'frames camera < .12 m of geometry / inside a walker or car (A + tab + L) [A geom/inside/person/car]', perAll(c => `${f1(c)} [${['geom', 'inside', 'person', 'car'].map(k => sum([...Ah(c), ...(Tb(c) ? [Tb(c)] : [])].map(a => a.stats.f1by[k]))).join('/')}]`), '0', all(hzAll.map(c => f1(c) === 0)), '11 (A2); .01 m in a Tab'); }
if (sc.a || sc.l) { const bst = hz => sc.b?.stats?.[hz];
  const snA = c => sum(Ah(c).map(a => a.stats.snapsX)), snL = c => sum(Lh(c).map(p => p.st.snaps)), vA = c => mx(nn([...Ah(c).map(a => a.stats.vmaxX), ...Lh(c).map(p => p.st.vmax)]));
  row('F2', 'snaps (cam > subject + 6 m/s, same subject, not in the 2.5 s after a switch): A + L n [max m/s]', perAll(c => `${snA(c) + snL(c)} (A ${snA(c)}) [${fx(vA(c), 0)}]`), '0', all(hzAll.map(c => snA(c) + snL(c) === 0)), '23–63 / 30 s (max 175); L 138 (max 181)');
  const aP = c => mx(nn([...Ah(c).map(a => a.stats.accP99), ...Lh(c).map(p => p.st.accP99), bst(c)?.accP99])), aM = c => mx(nn([...Ah(c).map(a => a.stats.accMax), ...Lh(c).map(p => p.st.accMax), bst(c)?.accMax]));
  row('F3', 'position accel, no input: p99 / max m/s² (A + L + B)', perAll(c => `${fx(aP(c), 0)} / ${fx(aM(c), 0)}`), '≤ 25 / ≤ 60', all(hzAll.map(c => aP(c) <= 25 && aM(c) <= 60)), 'max 6,413–10,424');
  const lM = c => mx(nn([...Ah(c).map(a => a.stats.alMax), ...Lh(c).map(p => p.st.alMax), bst(c)?.alMax])), jP = c => mx(nn([...Ah(c).map(a => a.stats.jkP99), ...Lh(c).map(p => p.st.jkP99), bst(c)?.jkP99]));
  row('F4', 'view angular accel max rad/s²; angular jerk p99 rad/s³ (A + L + B)', perAll(c => `${fx(lM(c), 0)}; ${fx(jP(c), 0)}`), '≤ 25; ≤ 400', all(hzAll.map(c => lM(c) <= 25 && jP(c) <= 400)), '158; max 9,491'); }
if (sc.l) { const thinP = hz => Lh(hz).filter(p => p.st.thinPulled).length, stall = hz => mx(Lh(hz).map(p => p.st.stallMax)) ?? 0, l0 = hz => Lh(hz).filter(p => p.lat === 0), thinR = hz => mx(l0(hz).map(p => p.st.thinRun)) ?? 0;
  row('F5', 'lamp passes: arm shortened > .5 m by a THIN column (any cause; min arm)', per(hz => `${thinP(hz)}/${Lh(hz).length} (${Lh(hz).filter(p => p.st.pulled).length}; ${fx(mn(Lh(hz).map(p => p.st.armMin)))} m)`), '0 passes', all(HZ.map(hz => thinP(hz) === 0)), '13/16 pulled to 1.7 m');
  row('F6', 'lamp passes: longest stall s (passes with a stall > .3 s)', per(hz => `${fx(stall(hz))} (${Lh(hz).filter(p => p.st.stallMax > .3).length})`), '0 s', all(HZ.map(hz => stall(hz) <= 1 / hz + 1e-6)), '1.0–1.8 s in 8 passes');
  row('F8', 'thin occlusion (L at 0 m): longest < 50 % visible ms [longest < 75 % s; min vis]', per(hz => `${fx(thinR(hz) * 1000, 0)} [${fx(mx(l0(hz).map(p => p.st.under75)), 1)}; ${fx(mn(l0(hz).map(p => p.st.visMin)))}]`), '≤ 900 ms', all(HZ.map(hz => thinR(hz) <= .9)), '< 75 % for 1.9–5.0 s, reaching 0 %'); }
if (sc.a || sc.corner) { const ra = c => mx(nn(Ah(c).map(a => a.stats.wideRun))), ch = hz => sc.corner?.[hz]?.wideRun ?? null, v = c => mx(nn([ra(c), ch(c)]));
  row('F7', 'wide occlusion: longest < 50 % visible ms (A; corner walk) per Hz', perAll(c => `${fx(ra(c) === null ? null : ra(c) * 1000, 0)}; ${fx(ch(c) === null ? null : ch(c) * 1000, 0)}`), '≤ 250 ms', all(hzAll.map(c => v(c) !== null && v(c) <= .25)), '500 ms (A2)'); }
if (sc.b) { const top = Math.max(...HZ); row('F9', `frame rate: max position Δ vs ${top} Hz, same path (mean) m`, per(hz => hz === top ? 'ref' : `${fx(sc.b.dev[hz].max)} (${fx(sc.b.dev[hz].mean)})`), '≤ .10 m', all(HZ.filter(h => h !== top).map(hz => sc.b.dev[hz].max <= .1)), '.92 m (30 Hz)'); }
if (sc.o) row('F10', 'orbit 2 rad/s 1.5 s: azimuth lag ° (at 1 s); radius sag %', per(hz => sc.o[hz] ? `${fx(sc.o[hz].lagEnd, 1)} (${fx(sc.o[hz].lag1s, 1)}); ${fx(sc.o[hz].sag * 100, 1)}` : null), '≤ 3°; ≤ 2 %', all(HZ.map(hz => sc.o[hz] && Math.abs(sc.o[hz].lagEnd) <= 3 && sc.o[hz].sag <= .02)), '31–37°; ≈ 12 % theory');
if (sc.a) { const arm = c => mn(nn(Ah(c).map(a => a.stats.armMin))), el = c => mx(nn(Ah(c).map(a => a.stats.elevMax))) - (res.cfgPitch ?? .2);
  row('F11', 'min arm m; max auto elevation above the pitch rad (A)', perA(c => `${fx(arm(c))}; ${fx(el(c))}`), '≥ 2.2; ≤ .55', all(aCols.map(c => arm(c) >= 2.2 && el(c) <= .55)), '1.70 m; overhead shots'); }
if (sc.a || sc.tab) { const sw = c => [...Ah(c).flatMap(a => a.switches), ...(Tb(c)?.switches || [])], near = c => sw(c).filter(s => s.d <= 25), far = c => sw(c).filter(s => s.d > 25), mc = c => mn(near(c).map(s => s.minClear)), tr = c => sum(far(c).map(s => s.travel));
  row('F12', 'Tab ≤ 25 m: min GT clearance in the 2.5 s after; > 25 m: travel frames', perA(c => `${near(c).length ? fx(mc(c)) + ' m' : '–'} (${near(c).length} sw); ${far(c).length ? tr(c) + ' fr in ' + far(c).length + ' sw' : 'no > 25 m switch'}`), '≥ .12 m; 0', all(aCols.map(c => (near(c).length ? mc(c) >= .12 : true) && tr(c) === 0)), '.01 m'); }
if (sc.a) row('F13', '(report) frames with another walker on the camera→chest line (A)', perA(c => fx(mean(Ah(c).map(a => a.stats.ppl)) * 100, 0) + ' %'), '≤ 10 %', null, '15–41 %');
if (sc.d) { const D = sc.d; row('Y1', 'fly frames inside walker / car / < .12 m geometry (person/car/geom)', { rt: Object.entries(D).map(([k, v]) => `${k} ${v.person}/${v.car}/${v.geom}`).join(' · ') }, '0', all(Object.values(D).map(v => v.y1 === 0)), 'D1b 4 + 3; D2 10 (car)'); }
if (sc.c) { const Cc = sc.c, w = hz => Cc.wall[hz];
  row('Y2', 'full boost at a wall: peak decel m/s²; jerk max m/s³ (peak speed)', per(hz => w(hz) ? `${fx(w(hz).decelPeak, 0)}; ${fx(w(hz).jerkMax, 0)} (${fx(w(hz).vPeak, 0)} m/s)` : null), '≤ 60; ≤ 3,000', all(HZ.map(hz => w(hz) && w(hz).decelPeak <= 60 && w(hz).jerkMax <= 3000)), '720 / 1,121 / 1,567; ≤ 204,898');
  const stops = nn(HZ.map(hz => w(hz)?.stop)); let spread = 0; for (const a of stops) for (const b of stops) spread = Math.max(spread, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  row('Y3', 'same: stop position spread across Hz m (least clearance per Hz)', { all: stops.length ? `${fx(spread)} (${HZ.map(hz => fx(w(hz)?.ncMin)).join(' / ')})` : null }, '≤ .25 m', stops.length > 1 ? spread <= .25 : null, '≈ .1 m (ok)');
  row('Y4', '30° glancing run: tangential speed kept after contact', per(hz => Cc.glance[hz] ? `${fx(Cc.glance[hz].kept * 100, 0)} % (${fx(Cc.glance[hz].before, 1)} → ${fx(Cc.glance[hz].after, 1)} m/s)` : null), '≥ 80 %', all(HZ.map(hz => Cc.glance[hz] && Cc.glance[hz].kept >= .8)), 'per-axis stop (×.2 a frame)');
  const gl = nn(HZ.map(hz => Cc.glide[hz]?.glide)), gs = gl.length ? (mx(gl) - mn(gl)) / mean(gl) : null;
  row('Y5', 'glide after release: spread across Hz (distances m)', { all: gl.length ? `${fx(gs * 100, 1)} % (${gl.map(v => fx(v)).join(' / ')})` : null }, '≤ 2 %', gs === null ? null : gs <= .02, '15 % (7.49 / 8.62 / 8.84)');
  row('Y6', 'floor approach: overshoot above floor + 1.4 after release m (held while descending)', per(hz => Cc.floor[hz] ? `${fx(Cc.floor[hz].overshoot)} (${fx(Cc.floor[hz].heldMin)}–${fx(Cc.floor[hz].heldMax)})` : null), '≤ .2 m', all(HZ.map(hz => Cc.floor[hz] && Cc.floor[hz].overshoot <= .2)), '+1.8 (to 3.2 m)'); }
if (sc.look) row('Y7', 'look: share of a delta applied in its own frame (90 % after); a 1,000 px event ignored', { ...per(hz => sc.look.fixed[hz] ? `${fx(sc.look.fixed[hz].sameFrame * 100, 0)} % (${fx(sc.look.fixed[hz].ms90, 0)} ms)` : null), all: sc.look.spike?.ignored ? 'spike ignored' : `spike NOT ignored (${sc.look.spike?.spike} px through)` }, 'yes / yes',
  all(HZ.map(hz => sc.look.fixed[hz]?.sameFrame >= .95)) && !!sc.look.spike?.ignored, '33 ms smoothing; no filter');
if (sc.inject) row('Y8', 'start a frame inside a solid: out after s; moved deeper', per(hz => sc.inject[hz] ? `${fx(sc.inject[hz].outT)} s; ${sc.inject[hz].deeper ? 'deeper' : 'no'}` : null), '≤ .25 s; never', all(HZ.map(hz => sc.inject[hz] && sc.inject[hz].outT !== null && sc.inject[hz].outT <= .25 && !sc.inject[hz].deeper)), 'moves freely (solid.js:69)');
for (const id of ['P1', 'P2', 'P3', 'P4', 'P5']) row(id, 'POV (§5)', { all: res.pov ? 'POV present: no probe scenario yet' : 'n/a — no POV mode' }, '§5', null, '—');
if (res.perf.frames) row('R1', 'rig ms a frame: mean / p99 (max) — follow update + world tick over the A + tab replays (+ D: update + late)', { rt: `${fx(res.perf.mean, 3)} / ${fx(res.perf.p99, 3)} (${fx(res.perf.max, 2)})` }, '≤ .3 / ≤ .6', res.perf.mean <= .3 && res.perf.p99 <= .6, '.03–.14 / max 1.6');
if (res.perf.collFrameMax !== null) row('R2', `main-thread collision build ms in a frame (${res.perf.coll?.kind ?? '–'})`, { rt: `max ${fx(res.perf.collFrameMax, 2)}${res.perf.coll?.maxMs !== undefined ? ' · a block ' + fx(res.perf.coll.maxMs, 1) + ' in all' : ''}` }, '≤ .5 (on arrival)', res.perf.collFrameMax <= .5, 'up to 1.5 of rasterising');
row('R3', 'frame-time p95 vs the camera pass', { all: 'see tools/flythrough.mjs --only camfly,camfollow' }, '≤ +.5 ms', null, '—');
res.table = T;
const cols = ['rt', ...hzCols, 'all'].filter(c => T.some(r => r.vals[c] !== undefined && r.vals[c] !== null));
console.log('\n' + ['id ', 'verdict', 'metric', ...cols.map(c => c === 'rt' ? 'real time' : c === 'all' ? 'all Hz' : c + ' Hz'), 'target', 'RESEARCH today'].join(' │ '));
for (const r of T) console.log([r.id.padEnd(3), (r.ok === null || r.ok === undefined ? 'report' : r.ok ? 'PASS' : 'FAIL').padEnd(7), r.what, ...cols.map(c => r.vals[c] === undefined || r.vals[c] === null ? '' : typeof r.vals[c] === 'number' ? fx(r.vals[c]) : r.vals[c]), r.target, r.today].join(' │ '));
console.log(`\nwall time ${since()}`);
if (OUT) { await fs.mkdir(RUNS, { recursive: true }); const f = path.join(RUNS, OUT + '.json'); await fs.writeFile(f, JSON.stringify(res)); console.log('saved ' + path.relative(process.cwd(), f)); }
process.exit(0);   // (the page-evaluation timeouts' timers would otherwise keep node alive for minutes)
