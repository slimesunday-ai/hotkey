// TV PLAN A2 (2026-10-09) · THE SHOTS: one shot grammar for everything that sends the camera to something: the tape's events
// (ui/tape/index.js), Action (ui/menu/action.js), Go there (ui/goto.js) and next the director (camera/director.js, plan A5).
//   establishing  the place, about 26 m out, 32–57° down (the lowest that sees it), from the side the scene is shot from; a place
//                 nothing that low sees (the woods' canopy): the Go-to's old high view, 44 m out at 66–72°
//   two           one or two people: 8–14 m (sized so they fill about half the frame), a 3/4 view (20–55° off the perpendicular to the
//                 line between them, 35–50° first), 25–35° down. Candidate angles are ray-cast to each actor's chest and head (in
//                 frame, nothing in the way); a blocked one is dropped; among the clear ones, the most open round them (a step to each
//                 side, a ring round the action, the way one walks in from) at the least cost. Never from above
//   group         three or more: the same at 10–24 m; the line is their widest pair
//   wide          a coarse place (STORE.md rule 5: a district, someone else's lot): 120 m out at 0.62 rad, never a spot
//   SCENE         the 180° rule. A caller's key (the tape: the place and the pair, so the payback two minutes later is the same scene)
//                 keeps every shot of the scene on the side of the line its first shot took. The line runs between the two actors in
//                 handle order, so a payback with the roles swapped keeps it. A scene lasts SHOT.sceneTTL real s after its last shot,
//                 and SHOT.sceneWindow on the caller's clock (spec.sceneT: the same place and pair hours later on the tape is new)
// TRANSITIONS. Near (the camera and the shot ≤ SHOT.near m apart): a flight, smootherstep (ease-in-out), 0.8–1.4 s by distance, a low
// arc on long hops. Far: the load-in's gate comes down first and the cut happens behind it (api.goTo: the streets are built before they
// are seen), the camera waits there at the shot's own angle, pulled back, and when the gate lifts it settles into the shot in 0.8 s.
// The flight is this module's own (the rig in orbit, MapControls held, the pose written each frame), so its end can be re-aimed on the
// way: a plan made from afar sees only the height map; once the collision world has the real blocks round the shot it is checked, and
// if a wall or a sign the map missed is in the way the end eases over to a clear pose (no stop, no jump). Blocks that only come in
// after it landed: checked then (≤ 0.9 s), and a blocked shot moves to the clear pose in 0.6 s, as part of its arrival.
// OCCLUSION. The stage's top-down height map round the event (stage/index.js occAsync: rendered once, read back without a stall,
// cached), and where the collision world has the real blocks (camera/world.js, within SHOT.worldR m of the camera) its rays as well.
// No sim (no stage): the world alone; neither: the preferred angle.
// PRIVACY. A shot frames exactly the points it is handed: the callers apply the lens (an unseen robbery: the victim alone).
// THE VIEWER KEEPS THE ZOOM (slime 10-09: "camera shouldn't drift back, human controls zoom level"). A shot hands MapControls a camera
// that is already there and never touches it again; a follow the viewer set up keeps its own arm (ui/goto.js followAgent: a far cut,
// then follow.js, no settle). Nothing runs per frame unless a shot is moving (then one rAF callback).
//   const shots = shotsFor(api)
//   shots.go(spec, { label, settle = true }) → handle { state, over, plan, far, done: Promise<bool>, cancel() }
//   shots.reframe(spec) → handle | null   (the pre-roll: a 0.6 s move only if someone in it can't be seen from where the camera is)
//   shots.plan(spec, { fresh }) → Promise<plan>   (the height map round it first)   shots.planNow(spec) → plan (with what is cached)
//   spec  { kind: 'auto' | 'two' | 'group' | 'establishing' | 'wide', at: { x, z }, actors: [{ x, z, y?, h?, from? }], coarse, scene,
//         sceneT, label }   (from: where an actor framed at its mark is now; sceneT: the scene's clock, e.g. the tape's game minute)
//   plan  { kind, pos, tgt, fov, d, pitch, hd, side, vis, clear, how, ms }   shots.last() · shots.stats() · shots.scenes()
import { Vector3 } from 'three';
import { STATIC, STATIC_WIDE } from './world.js';

const DEG = Math.PI / 180;
export const SHOT = {
  establishing: { d: 26, pitch: [.56, .66, .78, .9, 1], high: [1.15, 1.25], aimY: 0 },
  two: { d: [8, 14], base: 10.5, pitch: [30, 26, 34].map(a => a * DEG), high: [40, 45].map(a => a * DEG), aimY: 1, frame: .5, reach: 14 },   // (high: the fallback only, below)
  group: { d: [10, 24], base: 12 },
  wide: { d: 120, pitch: .62 },
  offs: [35, 50, 20, 55].map(a => a * DEG),   // the 3/4 views: off the perpendicular, each to both hands (8 candidates a side; ≥ 35° off the line)
  fov: 50, near: 300, fly: [.8, 1.4], settle: .8, arc: [.15, 45], pull: [1.35, 3],
  sceneTTL: 180, sceneWindow: 20, worldR: 90, budgetMs: 3, loadMs: 14000, coverMs: 400, verifyMs: 900, fix: .6,
  occ: { half: 32, n: 256, top: 160, maxAge: 30000 },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const raf = () => new Promise(r => requestAnimationFrame(() => r())), smooth = x => x * x * x * (x * (x * 6 - 15) + 10);   // (smootherstep: ease-in-out)

export function shotsFor(api) { if (!api.shots) api.shots = createShots(api); return api.shots; }

export function createShots(api) {
  const scenes = new Map(), st = { plans: 0, flights: 0, cuts: 0, settles: 0, reaims: 0, fixes: 0, reframes: 0, cancelled: 0, planMax: 0, occWaitMax: 0, lastPlan: null, lastSpec: null };
  let cur = null;
  const rig = () => api.cam, cam = () => api.camera, ctl = () => api.controls;
  const stageCtx = () => (typeof window !== 'undefined' && (window.__simlive?.stage?.ctx || window.__stage?.ctx)) || null;
  const photo = () => { const r = rig(); return !!r && (r.mode === 'photo' || document.body.classList.contains('cam-photo')); };
  const aspect = () => (typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 16 / 9);

  // ── the spec, made whole: the kind, the framing set (actors within reach of the action), its centre, spread and line
  function norm(spec) {
    const s = { ...spec }, A = (s.actors || []).filter(a => a && Number.isFinite(a.x) && Number.isFinite(a.z));
    const at = s.at && Number.isFinite(s.at.x) ? s.at : A[0] || null; s.at = at;
    if (s.coarse || s.kind === 'wide') { s.kind = 'wide'; s.actors = []; return s; }
    const reach = SHOT.two.reach, near = at ? A.filter(a => Math.hypot(a.x - at.x, a.z - at.z) <= reach) : A;
    if (!s.kind || s.kind === 'auto') s.kind = near.length >= 3 ? 'group' : near.length ? 'two' : 'establishing';
    s.actors = near; s.all = A;
    // framed: the actors, the action, and the way one walks in (up to 6 m out toward where they are now: a.from), so they enter the shot
    const way = near.flatMap(a => { const fx = a.from?.x - a.x, fz = a.from?.z - a.z, fl = Math.hypot(fx, fz); return fl > 3 ? [{ x: a.x + fx / fl * Math.min(6, fl), z: a.z + fz / fl * Math.min(6, fl) }] : []; });
    const pts = [...near, ...way, ...(at ? [at] : [])];
    if (pts.length) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      s.c = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 }; s.spread = Math.max(...pts.map(p => 2 * Math.hypot(p.x - s.c.x, p.z - s.c.z))); }
    else s.c = null;
    // the line: the two actors (handle order) of everyone handed over, near or not (a robber walking in from 20 m sets the line too:
    // a.from, where an actor framed at its place is now); a group: its widest pair
    let a = null, b = null; const L = A.length >= 2 ? A.map(q => q.from && Number.isFinite(q.from.x) ? { ...q, x: q.from.x, z: q.from.z } : q) : null;
    if (L) { let best = -1; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z); if (d > best) { best = d; a = L[i]; b = L[j]; } }
      if (best < .25) a = b = null; else if (String(a.h ?? '') > String(b.h ?? '')) [a, b] = [b, a]; }
    s.line = a ? (() => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l, mx: (a.x + b.x) / 2, mz: (a.z + b.z) / 2 }; })() : null;
    return s;
  }
  const sideOf = (line, x, z) => Math.sign(line.x * (z - line.mz) - line.z * (x - line.mx)) || 1;

  // ── what can be seen: the height map (2.5D: solid from the ground up to its top) and the collision world's rays
  // (a line through the map, widened by 0.2 m to each side: a wall or a sign seen edge-on from above is a pixel thin, or missed)
  function occBlocked(M, P, C) {
    const dx = C.x - P.x, dz = C.z - P.z, L = Math.hypot(dx, dz); if (L < .01) return false; const step = Math.max(.15, M.half * 2 / M.n * .6), wx = -dz / L * .2, wz = dx / L * .2;
    for (let s = .35; s < L; s += step) { const k = s / L, y = P.y + (C.y - P.y) * k + .05, x = P.x + dx * k, z = P.z + dz * k, h = M.at(x, z); if (h === null) return false;
      if (h > y || M.at(x + wx, z + wz) > y || M.at(x - wx, z - wz) > y) return true; }
    return false; }
  const camRoomOcc = (M, C) => { const h = M.at(C.x, C.z); if (h !== null && h > C.y - .9) return false;
    for (const [ox, oz] of [[.9, 0], [-.9, 0], [0, .9], [0, -.9]]) { const g = M.at(C.x + ox, C.z + oz); if (g !== null && g > C.y - .3) return false; } return true; };
  // check: { P, pts } — judging one camera pose (the re-aim, the arrival, the pre-roll): any cached map that covers it and those points,
  // and the world wherever its blocks along those lines are the real ones
  function tests(s, check = null) {
    const r = rig(), W = r?.world, c = cam(), ctx = stageCtx(), O = SHOT.occ;
    if (check) { const Q = [check.P, ...check.pts]; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const q of Q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
      const half = Math.max(x1 - x0, z1 - z0) / 2 + 2, M = ctx?.occCached ? ctx.occCached((x0 + x1) / 2, (z0 + z1) / 2, half, { n: Math.max(8, Math.round(O.n * half / O.half)), top: O.top, maxAge: O.maxAge }) : null;
      const ok = W?.ready && Math.hypot(check.P.x - c.position.x, check.P.z - c.position.z) < SHOT.worldR && check.pts.every(q => [0, .5, 1].every(k => W.ready(q.x + (check.P.x - q.x) * k, q.z + (check.P.z - q.z) * k)));
      return { M, W: ok ? W : null, how: (M ? 'occ' : '') + (M && ok ? '+' : '') + (ok ? 'world' : '') || 'none' }; }
    const M = ctx?.occCached && s.c ? ctx.occCached(Math.round(s.c.x / 2) * 2, Math.round(s.c.z / 2) * 2, O.half, { n: O.n, top: O.top, maxAge: O.maxAge }) : null;
    // the world close to the camera (beyond keepR its rays see nothing and say "clear"); see() casts a ray only where the blocks along
    // it are the real ones. full: every block the shot's rays can cross is (a corner is where four meet; one still on its far massing has
    // no awnings, signs or posts): what the re-aim and the arrival wait for
    const near = !!(W?.ready && s.c && c && Math.hypot(s.c.x - c.position.x, s.c.z - c.position.z) < SHOT.worldR), R = SHOT.two.reach;
    const full = near && [[0, 0], [R, R], [R, -R], [-R, R], [-R, -R]].every(([dx, dz]) => W.ready(s.c.x + dx, s.c.z + dz));
    return { M, W: near ? W : null, full, how: (M ? 'occ' : '') + (M && full ? '+' : '') + (full ? 'world' : '') || 'none' };
  }

  // what a camera at P looking at T sees: { P, vis (the share of the hard points seen and in frame; −1: no room for the camera there),
  // open (the share of the soft ones: a step to each side of each actor as seen from P, a ring round the action, the way an actor walks
  // in: people move in a scene) }. M: the height map, W: the collision world (a post square on a face counts against a hard point;
  // walls only against a soft one)
  const A = { x: 0, y: 0, z: 0 }, B = { x: 0, y: 0, z: 0 };
  function framer(P, T) { const fx = T.x - P.x, fy = T.y - P.y, fz = T.z - P.z, fl = Math.hypot(fx, fy, fz) || 1, f = [fx / fl, fy / fl, fz / fl];
    const rl = Math.hypot(f[2], f[0]) || 1, r = [-f[2] / rl, 0, f[0] / rl], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const tv = Math.tan(SHOT.fov / 2 * DEG) * .9, th = tv * aspect();
    return t => { const vx = t.x - P.x, vy = t.y - P.y, vz = t.z - P.z, z = vx * f[0] + vy * f[1] + vz * f[2]; if (z < .5) return false;
      return Math.abs((vx * r[0] + vz * r[2]) / z) <= th && Math.abs((vx * u[0] + vy * u[1] + vz * u[2]) / z) <= tv; }; }
  function see(s, pts, P, M, W, T = null) { let seen = 0, hard = 0, soft = 0, sn = 0; const inFrame = T ? framer(P, T) : () => true;
    if (M && !camRoomOcc(M, P)) return { P, vis: -1, open: 0 };
    if (W) { A.x = P.x; A.y = P.y; A.z = P.z; if (W.distance(A, .7, STATIC) < .45) return { P, vis: -1, open: 0 }; }
    const lat = s.actors.flatMap(a => { const dx = P.x - a.x, dz = P.z - a.z, l = Math.hypot(dx, dz) || 1, y = (Number.isFinite(a.y) ? a.y : 0) + 1.1;
      return [1, -1].map(g => ({ x: a.x - dz / l * .9 * g, y, z: a.z + dx / l * .9 * g, hard: false })); });
    const real = t => W.ready(t.x, t.z) && W.ready((t.x + P.x) / 2, (t.z + P.z) / 2) && W.ready(P.x, P.z);   // (this ray's blocks are the real ones)
    for (const t of pts.concat(lat)) { let bl = !inFrame(t) || (M ? occBlocked(M, t, P) : false);
      if (!bl && W && real(t)) { B.x = t.x; B.y = t.y; B.z = t.z; bl = !!W.ray(A, B, t.hard ? STATIC : STATIC_WIDE); }
      if (t.hard) { hard++; if (!bl) seen++; } else { sn++; if (bl) soft++; } }
    return { P, vis: hard ? seen / hard : 1, open: sn ? 1 - soft / sn : 1, soft }; }

  // ── the plan: candidate poses in preference order, the first clear one (else the one that sees the most). opts.check: a pose
  // ({ pos }) to judge instead, with what can be seen now → { vis, soft, how }
  function planNow(spec, opts = {}) { const { commit = false } = opts;
    const t0 = performance.now(), s = norm(spec), c = cam(), T = ctl()?.target, fov = SHOT.fov; st.plans++;
    const h0 = c && T ? Math.atan2(c.position.x - T.x, c.position.z - T.z) : 0;
    const out = p => { p.ms = +(performance.now() - t0).toFixed(2); st.planMax = Math.max(st.planMax, p.ms); st.lastPlan = p; st.lastSpec = spec; if (commit) remember(s, p); return p; };
    if (!s.at && !s.c) return null;
    if (s.kind === 'wide') { const W = SHOT.wide, hz = W.d * Math.cos(W.pitch); return out({ kind: 'wide', pos: [s.at.x + Math.sin(h0) * hz, W.d * Math.sin(W.pitch), s.at.z + Math.cos(h0) * hz], tgt: [s.at.x, 0, s.at.z], fov, d: W.d, pitch: W.pitch, hd: h0, side: 0, vis: 1, clear: true, how: 'none' }); }
    const sc = s.scene ? scene(s.scene, s.sceneT) : null, line = s.line || sc?.line || null, est = s.kind === 'establishing';
    const C = s.c || s.at, aimY = est ? SHOT.establishing.aimY : SHOT.two.aimY;
    // distances: the framing (people about half the frame wide: Cinemachine group framing), within the kind's range
    let Ds; if (est) Ds = [SHOT.establishing.d];
    else { const K = s.kind === 'group' ? SHOT.group : SHOT.two, tH = Math.tan(fov / 2 * DEG) * aspect(), base = Math.max(K.base, (s.spread || 0) / (2 * SHOT.two.frame * tH) + 3), D0 = clamp(base, K.d[0], K.d[1]);
      Ds = [...new Set([D0, Math.min(K.d[1], D0 + 2.5), Math.max(K.d[0], D0 - 1.5)].map(v => +v.toFixed(2)))]; }
    const pitches = est ? SHOT.establishing.pitch : SHOT.two.pitch;
    // headings (target → camera): on a line, its perpendicular's 3/4 views on the scene's side (both sides for a first shot, the side
    // the camera is on first); no line: round the scene's last heading, else the camera's own
    const heads = [];
    if (line) { const sides = sc?.side ? [sc.side] : (() => { const cs = c ? sideOf(line, c.position.x, c.position.z) : 1; return [cs, -cs]; })();
      for (const sd of sides) { const hn = Math.atan2(-line.z * sd, line.x * sd); for (const o of (est ? [SHOT.offs[0], 0, SHOT.offs[1], SHOT.offs[3]] : SHOT.offs)) for (const g of (o ? [1, -1] : [1])) heads.push({ hd: hn + g * o, side: sd, off: o }); } }
    else if (sc) for (const o of [0, 20, -20, 40, -40]) heads.push({ hd: sc.hd + o * DEG, side: 0, off: Math.abs(o) * DEG * 2, round: true });   // (a scene with no line yet keeps its heading: ≤ 40° off)
    else for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) heads.push({ hd: h0 + k * Math.PI / 4, side: 0, off: Math.abs(k) * Math.PI / 4 });
    const cands = [];
    for (const H of heads) for (const p of pitches) for (const D of Ds) {
      const turn = Math.abs(wrap(H.hd - (sc?.hd ?? h0))), first = line && !sc?.side && H.side !== heads[0].side;
      const cost = (line ? Math.abs(H.off - 40 * DEG) / (45 * DEG) : H.off / Math.PI) + .6 * turn / Math.PI + (first ? 1.2 : 0) + (est ? (p - pitches[0]) * 2 : Math.abs(p - pitches[0]) / (5 * DEG) * .5) + Math.abs(D - Ds[0]) / 3 * .3;
      cands.push({ ...H, p, D, cost }); }
    // a place nothing low sees (the woods' canopy): the Go-to's old high view, 44 m out at 1.15–1.25 rad (nav.js), last
    if (est) for (const H of heads.slice(0, 4)) for (const p of SHOT.establishing.high) cands.push({ ...H, p, D: 44, cost: 10 + p });
    cands.sort((a, b) => a.cost - b.cost);
    // what has to be seen: each actor's chest and head (a place: its point and a ring round it)
    const pts = [];
    for (const a of s.actors) { const y = Number.isFinite(a.y) ? a.y : 0; pts.push({ x: a.x, y: y + 1.1, z: a.z, hard: true }, { x: a.x, y: y + 1.6, z: a.z, hard: true });
      const fx = a.from?.x - a.x, fz = a.from?.z - a.z, fl = Math.hypot(fx, fz); if (fl > 3) pts.push({ x: a.x + fx / fl * 3, y: y + 1.1, z: a.z + fz / fl * 3, hard: false }, { x: a.x + fx / fl * 6, y: y + 1.1, z: a.z + fz / fl * 6, hard: false }); }   // (the way they walk in)
    if (!s.actors.length || est) { pts.push({ x: s.at.x, y: 1, z: s.at.z, hard: true }); if (est) for (let k = 0; k < 4; k++) pts.push({ x: s.at.x + 4 * Math.sin(k * Math.PI / 2), y: 1, z: s.at.z + 4 * Math.cos(k * Math.PI / 2), hard: false }); }
    else for (let k = 0; k < 8; k++) pts.push({ x: C.x + 1.6 * Math.sin(k * Math.PI / 4), y: 1.1, z: C.z + 1.6 * Math.cos(k * Math.PI / 4), hard: false });   // (the stage round them: the robber comes in, the victim stumbles)
    const chkP = opts.check ? { x: opts.check.pos[0], y: opts.check.pos[1], z: opts.check.pos[2] } : null, { M, W, how } = tests(s, chkP && { P: chkP, pts: pts.filter(t => t.hard) });
    const poseOf = q => { const hz = q.D * Math.cos(q.p); return { x: C.x + Math.sin(q.hd) * hz, y: aimY + q.D * Math.sin(q.p), z: C.z + Math.cos(q.hd) * hz }; };
    const Tt = opts.check?.tgt ? { x: opts.check.tgt[0], y: opts.check.tgt[1], z: opts.check.tgt[2] } : { x: C.x, y: aimY, z: C.z };
    if (opts.check) return M || W ? { ...see(s, pts, chkP, M, W, Tt), how } : { vis: null, open: null, how };   // (nothing to judge it by yet: unknown)
    // ranked: every hard point seen (and in frame) first, then how open it is less half its cost (a less preferred angle has to see two
    // or so more of the soft points). Two passes: all candidates on the height map (cheap; within budgetMs), then the best few again with
    // the collision world's rays as well
    const rank = e => e.r.open - .5 * e.q.cost, better = (a, b) => !b || a.r.vis > b.r.vis + 1e-6 || (Math.abs(a.r.vis - b.r.vis) < 1e-6 && rank(a) > rank(b) + 1e-9);
    const first = []; let n = 0;
    for (const q of cands) { if (n > 0 && performance.now() - t0 > SHOT.budgetMs) break; n++; const r = see(s, pts, poseOf(q), M, M ? null : W, Tt); if (r.vis >= 0) first.push({ q, r }); if (!M && !W && n >= 1) break; }
    first.sort((a, b) => better(a, b) ? -1 : better(b, a) ? 1 : 0);
    let best = null; for (const e of (W && M ? first.slice(0, 6) : first.slice(0, 1))) { const r = W && M ? see(s, pts, e.r.P, M, W, Tt) : e.r; if (r.vis < 0) continue; const x = { q: e.q, r }; if (better(x, best)) best = x; }
    // THE PITCH FALLBACK (2026-10-09, the stage's hook: stage/vignettes.js followMarks). A two-shot (or a group) that can't see all its
    // people from 25–35° on its side looks again from higher, 40° then 45° (the scene's side and the same headings, the first distance),
    // before settling for less: over the 3.3 m structure at Kent St & 1st that the 180° rule kept the camera behind. Never otherwise
    if (!est && best && best.r.vis < 1) for (const p of SHOT.two.high) { for (const H of heads.slice(0, 8)) { const q = { ...H, p, D: Ds[0], cost: (line ? Math.abs(H.off - 40 * DEG) / (45 * DEG) : H.off / Math.PI) + 2 + (p - pitches[0]) * 2 };
        const r = see(s, pts, poseOf(q), M, W, Tt); if (r.vis < 0) continue; const x = { q, r }; if (better(x, best)) best = x; } if (best.r.vis === 1) break; }
    if (!best) best = { q: cands[0], r: { P: poseOf(cands[0]), vis: 0, open: 0 } };
    const { q, r } = best, P = r.P, side = line ? sideOf(line, P.x, P.z) : 0;
    return out({ kind: s.kind, pos: [P.x, P.y, P.z], tgt: [C.x, aimY, C.z], fov, d: q.D, pitch: q.p, hd: wrap(q.hd), side, off: q.off, vis: +r.vis.toFixed(2), open: +(r.open ?? 1).toFixed(2), soft: r.soft || 0, clear: r.vis === 1, how, tried: n, line: !!line, scene: s.scene || null });
  }
  function remember(s, p) { if (!s.scene) return; const old = scene(s.scene, s.sceneT), line = s.line || old?.line || null;
    scenes.set(s.scene, { line, side: line ? (old?.side || p.side || null) : null, hd: p.hd, t: performance.now(), sceneT: s.sceneT ?? old?.sceneT ?? null, n: (old?.n || 0) + 1 });
    if (scenes.size > 40) { const now = performance.now(); for (const [k, v] of scenes) if (now - v.t > SHOT.sceneTTL * 1000) scenes.delete(k); } }
  // a scene is over SHOT.sceneTTL real s after its last shot, or (spec.sceneT: the caller's clock, the tape's game minutes) more than
  // SHOT.sceneWindow of that clock from it: the same place and pair hours later on the tape is a new scene
  function scene(key, t = null) { const v = scenes.get(key); if (!v) return null;
    if (performance.now() - v.t > SHOT.sceneTTL * 1000 || (Number.isFinite(t) && Number.isFinite(v.sceneT) && Math.abs(t - v.sceneT) > SHOT.sceneWindow)) { scenes.delete(key); return null; } return v; }
  // the plan after the height map round the action is in (one render, read back without a stall; cached for the next shot there)
  async function plan(spec, { fresh = false, commit = false } = {}) {
    const s = norm(spec), ctx = stageCtx(), O = SHOT.occ;
    if (s.kind !== 'wide' && s.c && ctx?.occAsync) { const t0 = performance.now();
      try { await Promise.race([ctx.occAsync(Math.round(s.c.x / 2) * 2, Math.round(s.c.z / 2) * 2, O.half, { n: O.n, top: O.top, maxAge: fresh ? 0 : O.maxAge }), new Promise(r => setTimeout(r, 600))]); } catch {}
      st.occWaitMax = Math.max(st.occWaitMax, +(performance.now() - t0).toFixed(1)); }
    return planNow(spec, { commit }); }

  // ── moving there
  // THE FLIGHT to p over dur s (smootherstep; a rise of `arc` m at the middle): the rig in orbit, MapControls held, the pose written
  // each frame (then controls.update: the camera looks at the target the same frame). Re-aimed once on the way (spec, the plan was made
  // without the collision world): when the world has the real blocks round the shot and says p is blocked, the end eases over to the
  // new plan for the rest of the flight. A mode switch on the way (the viewer pressed 1–5, clicked a person) ends it: theirs now.
  function flight(p, dur, arc, h, spec = null) {
    const r = rig(), c = cam(), C = ctl(); if (r && (r.mode !== 'orbit' || r.blending)) r.toOrbit({ instant: true });
    C._sphericalDelta?.set(0, 0, 0); C._panOffset?.set(0, 0, 0); if (C._scale !== undefined) C._scale = 1;   // (no leftover drag inertia: as the rig's finishOrbit)
    const F = { p: c.position.clone(), t: C.target.clone(), fov: c.fov }, D = { p: new Vector3(...p.pos), t: new Vector3(...p.tgt), fov: p.fov };
    let re = null, t = 0, last = performance.now(); C.enabled = false; h.reaim = null;
    const write = (k, Dp, Dt, Df) => { c.position.lerpVectors(F.p, Dp, k); if (arc) c.position.y += arc * 4 * k * (1 - k); C.target.lerpVectors(F.t, Dt, k);
      const fv = F.fov + (Df - F.fov) * k; if (Math.abs(c.fov - fv) > 1e-3) { c.fov = fv; c.updateProjectionMatrix(); } C.update(); };
    return new Promise(resolve => {
      const done = ok => { C.enabled = !api.loading; resolve(ok); };
      const step = () => {
        if (h.cancelled) return done(false); if (r && r.mode !== 'orbit') return done(false);
        const now = performance.now(); t += Math.min(.1, (now - last) / 1000); last = now;
        if (spec && !re && !h.reaim && t < dur * .8 && !/world/.test(p.how || '')) { const q = reaim(spec, p); if (q) { h.reaim = q; h.plan = q;
          re = { t0: t, d: Math.max(.25, dur - t), p0: D.p.clone(), t0v: D.t.clone(), f0: D.fov, p1: new Vector3(...q.pos), t1: new Vector3(...q.tgt), f1: q.fov }; } }
        let Dp = D.p, Dt = D.t, Df = D.fov;
        if (re) { const u = smooth(Math.min(1, (t - re.t0) / re.d)); Dp = re.p0.clone().lerp(re.p1, u); Dt = re.t0v.clone().lerp(re.t1, u); Df = re.f0 + (re.f1 - re.f0) * u; }
        const k = smooth(Math.min(1, t / dur)); write(k, Dp, Dt, Df);
        if (t >= dur) return done(true); requestAnimationFrame(step); };
      requestAnimationFrame(step); }); }
  // the re-aim: null while the world can't see round the shot yet, or when p is clear in it; else the better plan (same scene side)
  function reaim(spec, p) { const s = norm(spec); if (!tests(s).full) return null; const v = planNow(spec, { check: p }); if (v.vis === null) return null;
    if (v.vis === 1 && v.open >= .75) { p.how = v.how; return null; } const q = planNow(spec);
    return q && (q.vis > v.vis + 1e-6 || (q.vis === v.vis && q.open > v.open + .2)) ? q : (p.how = v.how, null); }
  // ON ARRIVAL, a plan the world never checked (its blocks came in after the flight): checked once they are in (≤ verifyMs), and when
  // a wall the height map missed is in the way, a short move (SHOT.fix s) to the clear pose. The shot's own settle, not a drift: once it
  // is there the camera is the viewer's
  async function verify(spec, h) { const p = h.plan; if (!p || /world/.test(p.how || '') || p.kind === 'wide') return true; const s = norm(spec);
    if (!await until(() => tests(s).full, SHOT.verifyMs, h)) return !h.cancelled; const q = reaim(spec, p); if (!q || h.cancelled) return !h.cancelled;
    h.plan = q; st.fixes++; remember(s, q); h.state = 'fix'; return flight(q, SHOT.fix, 0, h, null); }
  // set the camera there now (behind the gate): MapControls takes it as it is
  // (api.goTo has put the rig in orbit already: toOrbit again would hand the held controls back)
  function place(p) { const c = cam(), T = ctl().target, r = rig(); if (r && (r.mode !== 'orbit' || r.blending)) r.toOrbit({ instant: true });
    c.position.set(...p.pos); T.set(...p.tgt); if (c.fov !== p.fov) { c.fov = p.fov; c.updateProjectionMatrix(); } ctl().update(); }
  const pulled = p => { const [k, add] = SHOT.pull, d = p.d * k + add, hz = d * Math.cos(p.pitch); return { ...p, pos: [p.tgt[0] + Math.sin(p.hd) * hz, p.tgt[1] + d * Math.sin(p.pitch), p.tgt[2] + Math.cos(p.hd) * hz] }; };
  // the load-in's gate down before the cut (main.js lifts it when the view is built): only when the overlay is in use and up
  function cover(label) {
    const el = typeof document !== 'undefined' ? document.getElementById('loadin') : null, Q = new URLSearchParams(location.search);
    if (!el || !el.classList.contains('off') || getComputedStyle(el).display === 'none' || Q.get('loadin') === '0' || ['shot', 'bake', 'hash'].some(k => Q.has(k))) return false;   // (no load-in on this page: main.js never holds)
    dispatchEvent(new CustomEvent('city:loading', { detail: { kind: 'goto', phase: 'data', progress: 0, label, done: 0, total: 0, walkers: { done: 0, total: 0 } } }));
    el.classList.remove('off'); return el; }
  const until = async (pred, ms, h) => { const t0 = performance.now(); while (!pred() && performance.now() - t0 < ms) { if (h?.cancelled) return false; await raf(); } return pred(); };

  // REFRAME, the pre-roll's: the actors have taken their marks (the tape plays a beat before the event). When the camera, where it is,
  // no longer sees one of them (in frame, nothing in the way), a short move (SHOT.fix s) to a pose that does, on the scene's side; else
  // nothing (null). Never while a shot is moving.
  // (the scene's first shot only, nothing has played yet: the move may take the other side of the line; after that the side holds)
  function reframe(spec) { if ((cur && !cur.over) || photo() || !cam()) return null; const c = cam(), T = ctl().target;
    const v = planNow(spec, { check: { pos: [c.position.x, c.position.y, c.position.z], tgt: [T.x, T.y, T.z] } }); if (!v || v.vis === null || v.vis === 1) return null;
    const sc = spec.scene ? scene(spec.scene, spec.sceneT) : null; if (sc && sc.n <= 1) sc.side = null;
    st.reframes++; return go(spec, { quick: true }); }
  function go(spec, { label = spec?.label || '', settle = true, quick = false } = {}) {
    if (cur && !cur.over) cur.cancel();
    let res; const h = { state: 'plan', over: false, cancelled: false, plan: null, far: false, gate: null, done: new Promise(r => { res = r; }) };
    const end = ok => { if (h.over) return; h.over = true; h.state = ok ? 'done' : 'cancelled'; if (cur === h) cur = null; res(ok); };
    h.cancel = () => { if (h.over) return; h.cancelled = true; st.cancelled++; if (h.gate && h.state === 'cover') h.gate.classList.add('off'); end(false); };
    cur = h;
    (async () => {
      if (photo() || !cam()) return end(false);
      const p0 = await plan(spec); if (h.cancelled) return; if (!p0) return end(false);
      h.plan = p0; const c = cam(), T = ctl().target, d = Math.hypot(T.x - p0.tgt[0], T.z - p0.tgt[2]);
      h.far = !quick && d > SHOT.near && !!api.goTo;
      if (!h.far) { const hop = c.position.distanceTo({ x: p0.pos[0], y: p0.pos[1], z: p0.pos[2] }), dur = quick ? SHOT.fix : SHOT.fly[0] + (SHOT.fly[1] - SHOT.fly[0]) * clamp(hop / SHOT.near, 0, 1);
        remember(norm(spec), p0); h.state = 'fly'; st.flights++; const ok = await flight(p0, dur, hop > 80 ? Math.min(SHOT.arc[1], hop * SHOT.arc[0]) : 0, h, spec);
        if (h.reaim) { st.reaims++; remember(norm(spec), h.reaim); } const ok2 = ok && await verify(spec, h); return end(ok2 && !h.cancelled); }
      // far: the gate down, the cut behind it, the camera at the shot's angle (pulled back), the build, then the settle
      h.state = 'cover'; h.gate = cover(label); if (h.gate) { await new Promise(r => setTimeout(r, SHOT.coverMs)); if (h.cancelled) return; }
      h.state = 'cut'; st.cuts++; api.goTo(p0.tgt[0], p0.tgt[2], label); place(pulled(p0));
      h.state = 'load'; await raf(); await until(() => !api.loading, SHOT.loadMs, h); if (h.cancelled) return;
      if (h.gate && !api.loading && !h.gate.classList.contains('off')) h.gate.classList.add('off');   // (the hold ended without lifting it)
      if (!settle) return end(true);
      const p1 = (await plan(spec, { fresh: true })) || p0; if (h.cancelled) return; h.plan = p1; remember(norm(spec), p1);
      h.state = 'settle'; st.settles++; const ok = await flight(p1, SHOT.settle, 0, h, spec); if (h.reaim) { st.reaims++; remember(norm(spec), h.reaim); }
      end(ok && await verify(spec, h) && !h.cancelled);
    })().catch(e => { console.warn('[shots]', e); end(false); });
    return h;
  }

  return { go, reframe, plan, planNow, scene, endScene: k => scenes.delete(k), SHOT, get current() { return cur; },
    last: () => st.lastPlan ? { ...st.lastPlan } : null, lastSpec: () => st.lastSpec,
    scenes: () => [...scenes].map(([k, v]) => ({ key: k, side: v.side, hd: +v.hd.toFixed(2), n: v.n })),
    stats: () => ({ plans: st.plans, flights: st.flights, cuts: st.cuts, settles: st.settles, reaims: st.reaims, fixes: st.fixes, reframes: st.reframes, cancelled: st.cancelled, planMax: st.planMax, occWaitMax: st.occWaitMax, scenes: scenes.size, moving: cur ? cur.state : null }) };
}
