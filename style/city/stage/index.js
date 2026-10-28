// STAGE (2026-10-07) · THE SIM'S EVENTS PLAY OUT IN THE CITY. Until now a robbery was only a message (the ticker, City TV, the tape's
// timeline, the map) while the two agents stood at their spots. Now a public event near the camera is staged at its place as a short
// scene (2–6 s, an arrest a little longer), with the agents' own walkers, and everyone goes back to where the sim has them:
//   seen robbery     the robber comes up fast, shoves; the victim stumbles, bills burst out; the robber runs off (a failed one: a scuffle
//                    and the robber backs off)
//   unseen robbery   LIVE: no robber. The victim stumbles and pats their pockets, a "?!" over the head (TAPE: staged as seen, robber and all)
//   arrest           a P9 cruiser pulls up, lights going; hands behind the back; into the car; it drives off (was: a silent vanish)
//   burglary         at the house: a flashlight in a window, the alarm lamp if it has one; the crime tape comes after (layer.holdScar)
//   deal             a brush pass with someone walking by (brush_pass, the pair: the buyer stops, both dap in sync), a baggie one way, a bill the other
//   death            the body falls; a chalk outline and a small memorial stay
// Off screen only the lasting aftermath is staged (bills on the pavement, the chalk and the memorial; the house's tape is the layer's).
// THE CITY'S RULES (STORE.md): LIVE stages only what the store's public lens hands over (sim.on('event')): an unseen robbery comes with
// no robber, a burglary with no burglar, a coarse place (dist:…) is never staged — and the code checks it again here. TAPE stages the
// director's cut at the tape time (ui/tape/state.js), culprits included; at 16× and 60× it skips straight to the aftermath.
// CLIPS (2026-10-07): a vignette asks for an authored clip on an actor with A.clip = '<name>' (A.clip = null blends it out); the gait
// hook plays it on the walker (anim/cast/clips: rob_lunge_grab, hit_stumble_back, run_getaway, hands_up_point, pat_pockets so far), moves
// the actor by a finished clip's root shift, and drops it when the walker is handed back. The procedural stand-ins (an idle held at a
// moment, w.tq tilts) remain only where no clip exists yet (falls, arrests, deals, the scuffle).
// STAGE-A (2026-10-08): the robbery's ending and the shot. Knocked down, the hurt get back up (shove_fall → lie_hurt → get_up at its
// 2 s wrap: A.seam / A.next below) and walk on, or limp off (walk_hurt) when the sim takes them; NOBODY VANISHES IN VIEW (free() waits
// till the camera can't see the body: lingering); the shot is re-staged at 3.5 m with the gun (the aim clips' pistol, props.gunAt), the
// muzzle flash, smoke and a "BANG!" burst; pairs are turned so a fall lands on open ground (occ(): a top-down height map rendered once
// per scene), walkers sidestep (steer), and actors are handed back to a free stand spot (respot). stage/probe.mjs is the gate.
// It never changes the sim: a vignette borrows walkers (simstate/agents.js hold / release) and gives them back where it took them; their
// new orders wait meanwhile. ?stage=0 turns it off (simstate/live.js never loads it). Console: __stage (.stats(), .play(event), .list()).
import * as THREE from 'three';
import { SIDE } from '../style.js';
import { sim as store } from '../simstate/store.js';
import { tape } from '../ui/tape/state.js';
import { createProps } from './props.js';
import { VIGNETTES, aftermath, stepCowers, leaveOnFoot } from './vignettes.js';
import { createRoom } from './crowd.js';   // (2026-10-09: the crowd keeps out of a scene's room — stage/crowd.js)
import { playClip, stopClip, stepClip, clearClip, CLIP as CLIPREG } from '../anim/cast/clips/index.js';   // (the authored clips: anim/cast/clips/CLIPS.md)
import { shotsFor } from '../camera/shots.js';   // (TV plan A2's hook, 2026-10-09: a scene's marks the camera can't see → the shot re-aims: vignettes.js followMarks)

export const STAGE = { viewR: 85, pendS: 2.4, dealGap: 5, maxRun: 3, apart: 7, waitS: 25 };   // m a staged event may be from the camera · s a leaving walker waits for its event · s between two deals · vignettes at once
const TYPES = ['rob', 'burgle', 'arrest', 'death', 'sale', 'hospital', 'shot'];
// (apart, waitS: ONE AT A TIME, handle below — m round a running scene's people a new one waits out · s it waits at most)
const SHOT_RE = /\bshot (during a robbery )?at\b/;   // (sim2 game.mjs kill(): "shot during a robbery at P"; the lens's "shot at P" when the killer is unnamed)

// clipProps (C1-6, the record's show): a staged actor's playing clip draws its own prop (a work tool, the lockpick, the torch), as a
// standing walker's does (movement.js clipProp); off by default, so live and demo stage as before
// clipDt (C1-9b, the record path): (render dt) → the stage's own dt this frame (none while the record is paused), for the clips its
// actors play; null: as ever
export function createStage({ scene, mats, peds, agents, layer, places, camera, night = false, log = () => {}, storeEvents = true, clipProps = false, clipDt = null }) {
  const psim = peds.sim, PL = new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p]));
  const props = createProps({ scene, mats, night, layer }), room = createRoom(psim);
  const S = { staged: {}, aftermath: {}, skipped: {}, held: 0, pendTimeouts: 0, ms: [], maxMs: 0, occ: 0,
    probe: { on: false, removals: 0, removedInView: 0, inView: [], overlapFrames: 0, overlapPairs: 0, insideFrames: 0, insidePairs: 0, minGap: 99, falls: 0, fallHits: 0, fallBad: [], leaves: 0,
      arrests: [], cuffs: [], carIns: [], intoCar: 0 } };   // (probe: stage/probe.mjs · stage-b: each arrest's mode and how it ended, the cuffing pair's wrist gap at the click, the suspect at the door's shut)
  const running = [], busy = new Map(), pend = new Map(), lastPos = new Map(), queue = [], waiting = [];   // (waiting: events held back for a scene there: handle)
  let clock = 0, lastDeal = -1e9, seq = 0, lens = 'live', tapeT = null, tapeAcc = 0, liveMarks = [];
  // ── what the camera sees (the frustum, refreshed each frame) and who it is on (followed, the dossier's agent)
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), V = new THREE.Vector3();
  const inView = (x, z, y = SIDE + 1) => { const c = camera.position; if (Math.hypot(x - c.x, z - c.z) > STAGE.viewR) return false; V.set(x, y, z); if (FR.containsPoint(V)) return true; V.y = y + 1.2; return FR.containsPoint(V); };
  const focusSet = () => { const c = window.__city?.cam, u = window.__ui, s = new Set(); if (c?.mode === 'follow' && c.subject?.aid) s.add(c.subject.aid); const d = u?.dossier?.current; if (d) s.add(d); return s; };
  const coarse = id => typeof id === 'string' && id.startsWith('dist:');
  // ── where things are
  function posOf(h) { const a = agents.map.get(h); if (a?.w) return { x: a.w.p[0], z: a.w.p[2], drawn: true }; const l = lastPos.get(h); if (l && clock - l.t < 10) return { x: l.x, z: l.z, drawn: false }; return null; }
  function placePos(id) { if (!id || coarse(id)) return null; const sp = agents.spots?.get(id)?.[0]; if (sp) return { x: sp.x, z: sp.z };
    const home = String(id).startsWith('lot:') || String(id).startsWith('apt:') ? layer?.homeAt?.(id) : null; if (home?.door) return { x: home.door[0], z: home.door[2] };
    const p = PL.get(id); return p && typeof p.x === 'number' ? { x: p.x, z: p.z } : null; }
  // ── actors: an agent's own walker, borrowed (held), or a stand-in in its look (TAPE: someone indoors on the live map)
  const tq = new THREE.Quaternion(), EU = new THREE.Euler();
  function actor(h, { standIn = null } = {}) {
    if (!h || busy.has(h)) return null; const a = agents.map.get(h); let w = null, kind = null;
    if (a?.w && (a.held ? pend.has(h) : true)) { w = a.held ? a.w : agents.hold(h); if (w) { kind = 'held'; pend.delete(h); } }
    if (!w && standIn) { w = psim.putAgent({ id: `stage:${h}:${++seq}`, look: standIn.look ?? a?.look ?? 0, fix: [standIn.x, SIDE, standIn.z, standIn.ry ?? 0] }); kind = w ? 'standin' : null; }   // (standIn.look: a stand-in in someone else's look — the arrest's patrol cop)
    if (!w) return null;
    const A = { h, w, kind, home: [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]], x: w.p[0], y: w.p[1], z: w.p[2], ry: w.yawS ?? w.p[3], tx: null, tz: null, v: 0, back: false, faceTo: null,
      pose: null, pitch: 0, roll: 0, lift: 0, moving: 0, snap: false, clip: undefined, playing: null };
    w.stagePose = (g, dt) => applyPose(A, g, dt); busy.set(h, A); S.held++; return A; }
  // A SEAM (stage-a, 2026-10-08): A.seam = { from, P, after } holds a requested clip back until the playing clip `from` (or the clip it
  // chains into) crosses a multiple of P s on its own clock, at least `after` s in: lie_hurt → get_up at its 2 s wrap, aim_hold → aim_fire /
  // aim_lower at its 0.8 s seams (anim/cast/clips/CLIPS.md: anywhere else they pop). The switch is made on THAT frame, the new clip started
  // at the old clock mod P. A.now / A.nowT: what plays and its clock (the vignettes read them). The pistol (the aim clips' prop) is posed
  // here, on the walker as it is drawn this frame (props.gunAt), and its muzzle kept in world space for the flash (A.muzzle).
  const leadsTo = (c, name) => { for (let k = 0; c && k < 6; k++, c = c.next ? CLIPREG[c.next] : null) if (c.name === name) return true; return false; };
  function applyPose(A, g, dt) {
    if (A.next && A.clip && A.clip === A.playing && g.clip) { A.clip = A.next.clip; A.seam = A.next.seam || null; A.next = null; }   // (A.next: queued behind the request playing now)
    if (A.clip !== undefined && A.clip !== A.playing) { const s = g.clip, sw = A.seam;
      if (!(sw && s && !s.out && leadsTo(s.c, sw.from))) { if (A.clip) playClip(g, A.clip, { t: A.clipT || 0 }); else stopClip(g); A.playing = A.clip; A.seam = null; } }
    if (g.clip) { if (!g.clip.c.moving) g.w = 0; const n0 = g.clip.name, t0 = g.clip.t, s = stepClip(g, dt || 0);
      if (s?.shiftNow) { const w = A.w, yaw = w.yawS ?? w.p[3], [sx, sz] = s.shiftNow, dx = sx * Math.cos(yaw) + sz * Math.sin(yaw), dz = -sx * Math.sin(yaw) + sz * Math.cos(yaw);   // (the root's end place: the walker moves there, this frame)
        A.x += dx; A.z += dz; w.p[0] += dx; w.p[2] += dz; if (w.gx !== undefined) { w.gx += dx; w.gz += dz; } if (A.tx === null) w.fix = [A.x, A.y, A.z, A.ry]; }
      const sw = A.seam;
      if (sw && g.clip && A.clip && A.clip !== A.playing && !g.clip.out && g.clip.name === sw.from && g.clip.t >= (sw.after || 0)
        && Math.floor(g.clip.t / sw.P) > Math.floor((n0 === sw.from ? t0 : -1e-6) / sw.P)) {   // (on the seam: the new clip from the old one's last pose)
        playClip(g, A.clip, { t: g.clip.t % sw.P }); stepClip(g, 0); A.playing = A.clip; A.seam = null; A.seamAt = clock; }
      if (!g.clip) { A.playing = null; A.clip = undefined; A.now = null; props.gunAt(A, null); return; }
      A.now = g.clip.name; A.nowT = g.clip.t; const pr = g.clip.c.prop;
      if (clipProps && pr && pr.id !== 'pistol') agents.movement?.clipProp?.(A.w, g);
      if (pr?.id === 'pistol') { const w = A.w, show = g.clip.w >= .6 && pr.pose(g.clip.t).show >= .5; props.gunAt(A, show ? w : null, pr, g.clip.t);
        const m = pr.muzzle(g.clip.t), yaw = w.yawS ?? w.p[3], c = Math.cos(yaw), sn = Math.sin(yaw);
        A.muzzle = [w.p[0] + m.p[0] * c + m.p[2] * sn, w.p[1] + m.p[1], w.p[2] - m.p[0] * sn + m.p[2] * c]; A.muzzleD = [m.d[0] * c + m.d[2] * sn, m.d[1], -m.d[0] * sn + m.d[2] * c]; }
      else props.gunAt(A, null);
      return; }
    A.now = null; props.gunAt(A, null);
    const P = A.pose; if (!P) return;
    if (P.w !== undefined) g.w = P.w; if (P.idle !== undefined) { g.idle = P.idle; g.iw = P.iw ?? 1; if (P.it !== undefined) g.it = P.it; }
    if (P.hp !== undefined) g.hp = P.hp; if (P.hr !== undefined) g.hr = P.hr; }
  // STEERING (stage-a): a walking actor sidesteps anyone in its way (a bystander, the scene's other bodies): a sideways push from
  // those within 1.75 m ahead of it — but not the one standing by its target once it is on that one's near side (the partner it walks up to)
  function steer(A, dx, dz, d) { let sx = 0, sz = 0; const ux = dx / d, uz = dz / d;
    for (const o of psim.walkers) { if (o === A.w || o.gone || !o.p) continue; const ox = o.p[0] - A.x, oz = o.p[2] - A.z; if (Math.abs(ox) > 1.8 || Math.abs(oz) > 1.8) continue; const od = Math.hypot(ox, oz); if (od > 1.75 || od < 1e-3) continue;
      if ((ox * ux + oz * uz) / od < .3) continue; const tx = A.tx - o.p[0], tz = A.tz - o.p[2]; if (o.stagePose && !A.path?.length && Math.hypot(tx, tz) < 1.45 && (-ox * tx - oz * tz) > 0) continue;   /* (the one it walks up to, from the side its spot is on: on its last leg) */ const sd = (ox * uz - oz * ux) >= 0 ? -1 : 1, k = (1.75 - od) / 1.75 * (o.stagePose ? 1 : 1.5);
      sx += uz * sd * k; sz += -ux * sd * k; }   // (away from its side of the line; 2026-10-09: a bystander by its target is no partner, nor anyone by a point on the way — the limp off walked into a kerb waiter by its path point, and through another actor — and a bystander is given more room)
    if (!sx && !sz) return [ux, uz]; const nx = ux + sx * 2.4, nz = uz + sz * 2.4, nl = Math.hypot(nx, nz) || 1; return [nx / nl, nz / nl]; }
  function stepActor(A, dt) { const w = A.w;
    if (A.tx !== null) { const dx = A.tx - A.x, dz = A.tz - A.z, d = Math.hypot(dx, dz), st = A.v * dt;
      if (d <= st || d < 1e-3) { A.x = A.tx; A.z = A.tz; A.tx = null; A.moving = 0; } else { const [mx, mz] = d > .5 && !A.back ? steer(A, dx, dz, d) : [dx / d, dz / d]; A.x += mx * st; A.z += mz * st; A.moving = A.v; if (!A.back && !A.faceTo) A.ry = Math.atan2(mx, mz); } }
    else A.moving = 0;
    if (A.faceTo) A.ry = Math.atan2(A.faceTo[0] - A.x, A.faceTo[1] - A.z);
    w.fix = [A.x, A.y, A.z, A.ry]; w.vc = A.moving; w.ph += (A.back ? -1 : 1) * A.moving * dt * 3.1; if (A.snap) { w.yawS = A.ry; w.omega = 0; }   // (backing off: the walk cycle runs backwards)
    if (A.pitch || A.roll || A.lift) { EU.set(A.pitch, 0, A.roll); w.tq = (w.tq || new THREE.Quaternion()).setFromEuler(EU); w.lift = A.lift; } else { w.tq = null; w.lift = 0; } }
  // give the walker back: where it was taken (the vignette walked it there), or removed (the driver places it as the sim says).
  // NOBODY VANISHES IN VIEW (stage-a, 2026-10-08): a removal while the camera can see the body waits — the actor stays held, keeps what
  // it is doing (lying there, limping or running off along its path) and goes only once the camera can't see it (seen() false for 0.4 s;
  // LINGER s at most). `now` (an abort: a tape seek, the lens switching) removes at once.
  const LINGER = 90, lingering = [];
  function seen(A) { const w = A.w, p = w?.p; if (!p || A.inCar) return false; const x = A.x ?? p[0], z = A.z ?? p[2], y = A.y ?? p[1];
    for (const [dx, dy, dz] of [[0, .1, 0], [0, 2.1, 0], [.9, .3, 0], [-.9, .3, 0], [0, .3, .9], [0, .3, -.9], [0, 1.2, 0]]) { if (Math.hypot(x - camera.position.x, z - camera.position.z) > STAGE.viewR) return false; V.set(x + dx, y + dy, z + dz); if (FR.containsPoint(V)) return true; }
    return false; }
  function free(A, { remove = false, now = false } = {}) { if (!A || A.freed) return;
    if (remove && !now && seen(A)) { if (!A.linger) { A.linger = { t: 0, out: 0 }; lingering.push(A); } return; }
    A.freed = true; busy.delete(A.h); const w = A.w; w.stagePose = null; w.tq = null; w.lift = 0; clearClip(w.g); props.gunAt(A, null);
    if (remove) { S.probe.removals++; if (seen(A)) { S.probe.removedInView++; S.probe.inView.push({ h: A.h, now, linger: A.linger ? +A.linger.t.toFixed(1) : 0 }); if (S.probe.inView.length > 20) S.probe.inView.shift(); } }
    if (A.kind === 'standin') { psim.removeAgent(w.aid); return; }
    if (!remove) { w.fix = A.home.slice(); w.yawS = A.home[3]; } const a = agents.map.get(A.h); if (a?.w === w) agents.release(A.h, { remove }); }
  function stepLinger(dt) { for (let k = lingering.length - 1; k >= 0; k--) { const A = lingering[k]; if (A.freed) { lingering.splice(k, 1); continue; } const L = A.linger; L.t += dt;
    followPath(A); stepActor(A, dt); L.out = seen(A) ? 0 : L.out + dt; if (L.out > .4 || L.t > LINGER) { lingering.splice(k, 1); free(A, { remove: true, now: true }); } } }
  // a path (A.path: [[x, z], …]) walked point by point at A.v
  function followPath(A) { if (A.tx === null && A.path?.length) { const [x, z] = A.path.shift(); A.tx = x; A.tz = z; } }
  // hand an actor back somewhere else: a free stand spot of its place (agents.js: the spot is claimed for it, the hold's fix moved there)
  function respot(A, sp) { const a = agents.map.get(A.h); if (!a?.held || a.held.E || !a.spot || A.kind !== 'held') return false; if (a.spot === sp) return true;
    if (a.spot.taken === a.id) a.spot.taken = null; sp.taken = a.id; a.spot = sp; a.held.fix = [sp.x, sp.y ?? A.home[1], sp.z, sp.ry ?? 0]; A.home = [sp.x, A.home[1], sp.z, sp.ry ?? 0]; return true; }
  // everyone else near a point (crowd and agents, never these actors): [x, z, walker]
  function walkersNear(x, z, r, skip = []) { const out = [], sk = new Set(skip.map(A => A.w)); for (const w of psim.walkers) { if (w.gone || sk.has(w) || !w.p) continue; const d = Math.hypot(w.p[0] - x, w.p[2] - z); if (d < r) out.push([w.p[0], w.p[2], w]); } return out; }
  // ── WHAT'S SOLID round a point (stage-a): a top-down height map of the city's own meshes over a small square (the walkers and the stage's
  // props hidden), rendered ONCE when a scene starts (a 64² float target, an orthographic camera straight down, MeshDepthMaterial: the
  // depth is linear, so it is the height). at(x, z) → the highest surface there (m; −1 where nothing). Cheap: the camera's frustum culls
  // everything but the few meshes there; one small readback.
  // TV PLAN A2 (2026-10-09) · THE SHOTS' MAPS. occAsync(cx, cz, half, { n, top, maxAge }) → Promise<map | null>: the same map, read back
  // WITHOUT A STALL (three's readRenderTargetPixelsAsync: a pixel buffer and a fence, polled; the sync read waits for the GPU to finish
  // everything queued), at most one render a frame and only on a calm one (a queue, pumped from frame(): not right after a slow frame),
  // and CACHED: a map rendered within maxAge ms (30 s by default) that covers the square at the same n and top comes back at once, with
  // no render. occCached(…) → that map or null (never renders). camera/shots.js asks for a wide square (32 m round the event, 256², up
  // to 160 m high, so a tower reads as a tower and not as its hollow, clipped shell). occ() for the vignettes is unchanged: synchronous,
  // 96², capped at 14 m.
  const OCC = { n: 96, top: 14, keep: 8, maxAge: 30000 }; let occCam = null, occMat = null, occWarm = false, occBusy = null, occWait = 0;
  const occRTs = new Map(), occBufs = new Map(), occCache = [], occQ = [];
  // render the square into the n² target (no readback): what is solid there, seen from straight above
  function occDraw(R, cx, cz, half, n, top) {
    let rt = occRTs.get(n); if (!rt) { rt = new THREE.WebGLRenderTarget(n, n, { type: THREE.FloatType, depthBuffer: true }); occRTs.set(n, rt); occBufs.set(n, new Float32Array(n * n * 4)); }
    if (!occMat) { occMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking }); occCam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, top + 4); }
    occCam.left = -half; occCam.right = half; occCam.top = half; occCam.bottom = -half; occCam.near = .1; occCam.far = top + 4; occCam.updateProjectionMatrix();
    occCam.position.set(cx, top, cz); occCam.up.set(0, 0, -1); occCam.lookAt(cx, 0, cz); occCam.updateMatrixWorld();
    const an = peds.anim || {}, hide = [an.batch, an.mid, an.far, ...props.meshes].filter(m => m && m.visible); for (const m of hide) m.visible = false;
    scene.traverseVisible(o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return; if (o.isPoints || o.isLine || o.isSprite || m.transparent || m.depthWrite === false || m.colorWrite === false) { o.visible = false; hide.push(o); } });   // (as interiors/city's pick: glass, glows, the sky)
    const prevT = R.getRenderTarget(), ov = scene.overrideMaterial, bg = scene.background, br = scene.onBeforeRender, cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha(), nu = R.shadowMap.needsUpdate, au = R.shadowMap.autoUpdate, ac = R.autoClear;
    try { scene.overrideMaterial = occMat; scene.background = null; scene.onBeforeRender = () => {}; R.shadowMap.needsUpdate = false; R.shadowMap.autoUpdate = false; R.autoClear = true;
      R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.render(scene, occCam); }
    finally { R.setRenderTarget(prevT); scene.overrideMaterial = ov; scene.background = bg; scene.onBeforeRender = br; R.setClearColor(cc, ca); R.shadowMap.needsUpdate = nu; R.shadowMap.autoUpdate = au; R.autoClear = ac; for (const m of hide) m.visible = true; }
    return rt; }
  // the read-back pixels → the map: at(x, z) → the highest surface there (m; −1 where nothing; null off the square)
  function occMap(buf, cx, cz, half, n, top) {
    const near = .1, far = top + 4, H = new Float32Array(n * n); for (let k = 0; k < n * n; k++) { const v = buf[k * 4]; H[k] = v <= 0 ? -1 : top - (near + (1 - v) * (far - near)); }
    return { cx, cz, half, n, top, H, at(x, z) { const i = Math.floor((x - cx + half) / (2 * half) * n), j = Math.floor((cz + half - z) / (2 * half) * n); return i < 0 || j < 0 || i >= n || j >= n ? null : H[i + j * n]; } }; }
  function occ(cx, cz, half = 6, { n = OCC.n, top = OCC.top } = {}) {   // (n, top: the camera's side, vignettes.js camView — a taller map round the scene)
    const R = window.__city?.renderer; if (!R) return null; const rt = occDraw(R, cx, cz, half, n, top), buf = occBufs.get(n);
    R.readRenderTargetPixels(rt, 0, 0, n, n, buf);
    S.occ++; return occMap(buf, cx, cz, half, n, top); }
  // a cached map that covers the square (same n and top, no coarser), rendered within maxAge ms
  function occCached(cx, cz, half = 6, { n = OCC.n, top = OCC.top, maxAge = OCC.maxAge } = {}) { const now = performance.now();
    for (const c of occCache) if (c.n === n && c.top === top && now - c.at <= maxAge && c.half / c.n <= half / n + 1e-6 && Math.abs(c.cx - cx) + half <= c.half + 1e-6 && Math.abs(c.cz - cz) + half <= c.half + 1e-6) { c.used = now; return c.map; }
    return null; }
  // any cached map, whatever its size, that covers the square and sees at least `top` m up (the shots' 32 m one round a scene: vignettes.js
  // camView reads the stretch between the camera and a scene's marks off it)
  function occCover(cx, cz, half, { top = 20, maxAge = 180000 } = {}) { const now = performance.now();
    for (const c of occCache) if (c.top >= top && now - c.at <= maxAge && Math.abs(c.cx - cx) + half <= c.half + 1e-6 && Math.abs(c.cz - cz) + half <= c.half + 1e-6) { c.used = now; return c.map; }
    return null; }
  function occAsync(cx, cz, half = 6, { n = OCC.n, top = OCC.top, maxAge = OCC.maxAge } = {}) {
    const hit = occCached(cx, cz, half, { n, top, maxAge }); if (hit) { S.occHits = (S.occHits || 0) + 1; return Promise.resolve(hit); }
    const key = `${n}|${top}|${half}|${cx.toFixed(1)}|${cz.toFixed(1)}`, same = occBusy?.key === key ? occBusy : occQ.find(q => q.key === key); if (same) return same.p;
    const q = { key, cx, cz, half, n, top }; q.p = new Promise(res => { q.res = res; }); occQ.push(q); return q.p; }
  // one queued map a frame: drawn now, read back when the GPU is done with it (the frame is never held for it)
  function pumpOcc() {
    if (occBusy || !occQ.length) return; const R = window.__city?.renderer, q = occQ.shift(); if (!R?.readRenderTargetPixelsAsync) { q.res(null); return; }
    occBusy = q; const t0 = performance.now(); let rt = null;
    try { rt = occDraw(R, q.cx, q.cz, q.half, q.n, q.top); } catch (e) { log('stage occ: ' + e.message); occBusy = null; q.res(null); return; }
    const buf = new Float32Array(q.n * q.n * 4); R.readRenderTargetPixelsAsync(rt, 0, 0, q.n, q.n, buf).then(() => {   // (its own buffer: a sync occ() may run meanwhile)
      const map = occMap(buf, q.cx, q.cz, q.half, q.n, q.top), now = performance.now(); occCache.unshift({ ...q, map, at: now, used: now }); if (occCache.length > OCC.keep) { occCache.sort((a, b) => b.used - a.used); occCache.length = OCC.keep; }
      S.occAsync = (S.occAsync || 0) + 1; return map; }).catch(e => { log('stage occ: ' + (e && e.message)); return null; }).then(map => { occBusy = null; q.res(map); });
    S.occDrawMs = Math.max(S.occDrawMs || 0, +(performance.now() - t0).toFixed(2)); }
  const goneSet = new Set(), gone = h => goneSet.has(h) || (() => { const d = agents.map.get(h)?.d; return !!d && (d.kind === 'gone' || !!d.now); })();   // (the sim has taken them off the street: jail, hospital, dead · goneSet: the probe's)
  // ── the hooks the walkers and the layer call
  const hooks = {
    // a drawn agent the sim is taking off the street: held a moment, in case its event is on its way (the two polls race). TAPE races
    // too while it plays: the tape's frame for a minute can land before the stage's look at that minute's events (frame below, every
    // 0.1 s), and an arrestee was on Iron Island before the arrest was staged. agents.js never calls this on a seek's snap.
    leaving(a, d, o) { if ((lens !== 'live' && !(lens === 'tape' && tape.playing)) || !a.w || busy.has(a.id) || pend.has(a.id)) return; lastPos.set(a.id, { x: a.w.p[0], z: a.w.p[2], t: clock });
      if (!inView(a.w.p[0], a.w.p[2]) && !focusSet().has(a.id)) return; if (agents.hold(a.id)) pend.set(a.id, clock + STAGE.pendS); },
    lost(id) { const A = busy.get(id); if (A) { A.freed = true; busy.delete(id); } pend.delete(id); },
    // a house's crime tape came with a diff: hold it back a moment if the house is in view (its burglary may play first)
    newScar(id) { if (lens !== 'live') return 0; const h = layer?.homeAt?.(id); return h?.door && inView(h.door[0], h.door[2]) ? STAGE.pendS * 1000 : 0; },
  };
  agents.setStage(hooks); layer?.setStage?.(hooks);
  // the gait hook: a borrowed walker's pose (idle variant, its clock, the walk weight, the head) after the walk computed its own
  { const anim0 = psim.animate; psim.animate = (w, dt, G, fresh) => { const g = anim0(w, dt, G, fresh); if (w.stagePose) w.stagePose(g, clipDt ? clipDt(dt) : dt); return g; }; }
  // ── events in: LIVE from the store's public lens; TAPE from the director's cut at the tape time
  // (C1-3: the record path stages its fights itself, stage/record.js; its store events are the new core's, not the old sim's)
  if (storeEvents) store.on('event', e => { if (lens === 'live' && !tape.active) queue.push({ e, lens: 'live' }); });
  tape.on('mode', ({ active }) => { abortAll(); props.clearBills(); props.clearMarks(); lens = active ? 'tape' : 'live'; tapeT = null; if (!active) for (const m of liveMarks) props.chalk(m.x, m.z, m.ry, { key: 'live' }); });
  tape.on('seek', ({ t }) => { abortAll(); props.clearBills(); props.clearMarks(); tapeT = t; rebuildTapeMarks(t); });
  function rebuildTapeMarks(t) { for (const e of tape.events({ from: t - 1440, to: t, types: ['death'] })) { const p = placePos(e.at); if (p) props.chalk(p.x + .6, p.z + .4, 0, { key: 'tape' }); } }
  // ── the context the vignettes get
  const ctx = { props, actor, free, stepActor, posOf, placePos, inView, gone, layer, peds, psim, agents, night, SIDE, get clock() { return clock; }, liveMarks, log, lens: () => lens,
    traffic: () => window.__city?.traffic?.sim || null, seen, occ, occAsync, occCached, occCover, respot, walkersNear, camera, probe: S.probe, busy: h => busy.has(h),
    // where the camera is, or where the shot moving it will leave it (camera/shots.js: the scene's axis prefers what it will see)
    camAim() { const h = window.__city?.shots?.current, p = h && !h.over ? (h.reaim || h.plan)?.pos : null; return p ? { x: p[0], y: p[1], z: p[2] } : camera.position; },
    // how many of a body's chest and head at (x, z) are in the camera's frame now (inside 92 % of it: the shots' own check is 95 %); 2
    // while a shot is moving it (its frame isn't this one yet)
    onScreen(x, z, y = SIDE) { const h = window.__city?.shots?.current; if (h && !h.over) return 2; camera.updateMatrixWorld(); let n = 0;
      for (const hy of [1.1, 1.6]) { V.set(x, y + hy, z).project(camera); if (Math.abs(V.x) < .92 && Math.abs(V.y) < .92 && V.z < 1) n++; } return n; },
    shots: () => window.__city ? shotsFor(window.__city) : null,
    // a cop's look for a stand-in (stage-b: the patrol's cop): the arresting cop's own when its walker isn't drawn, else an undrawn cop's
    copLook(h) { const cards = store.agents() || [], cop = c => c?.cls === 'cop', drawn = id => !!agents.map.get(id)?.w, own = h && cards.find(c => c.handle === h);
      if (own && !drawn(h)) return agents.map.get(h)?.look ?? 0; const o = cards.find(c => cop(c) && !drawn(c.handle)); return agents.map.get(o?.handle)?.look ?? agents.map.get(h)?.look ?? 0; } };
  // → 'wait' when the event waits for a running scene (ONE AT A TIME below; frame() keeps it in `waiting` and asks again each frame)
  function handle(e, lensOf, waited = -1) {
    if (!TYPES.includes(e.type)) return;
    const live = lensOf === 'live';
    if (live && (coarse(e.at))) { S.skipped.coarse = (S.skipped.coarse || 0) + 1; return; }   // (somewhere in a district: never staged)
    if (e.type === 'hospital') return;   // (its robbery's vignette takes the hurt one down; any other cause: the walker leaves as ever)
    if (!live && e.type === 'burgle' && e.of != null) { S.skipped.report = (S.skipped.report || 0) + 1; return; }   // (TAPE: a break-in's report — `of`, the street found it hours later, lens.js A BREAK-IN IS FOUND — is no break-in: the tape staged the break-in at its minute, burglar and all. It played a second flashlight then, one per break-in found at once)
    // the city's rules, again: LIVE never names an unseen robber or a burglar, whatever arrived
    const ev = live ? { ...e, who: (e.type === 'rob' && e.seen === false) || e.type === 'burgle' ? null : e.who } : e;
    // a death "shot during a robbery" that comes with its robbery (the same minute, one of the two): the robbery's vignette plays the shot
    if (ev.type === 'rob' && !ev.shot) { const its = q => q.lens === lensOf && q.e.type === 'death' && SHOT_RE.test(q.e.text || '') && Math.abs((q.e.t ?? 0) - (e.t ?? 0)) <= 1 && [e.who, e.to].includes(q.e.who);
      for (const L of [queue, waiting]) { const k = L.findIndex(its); if (k >= 0) { const d = L.splice(k, 1)[0].e; ev.shot = { dead: d.who }; break; } } }   // (or waiting with it: ONE AT A TIME)
    const kind = ev.type === 'rob' ? (ev.who ? 'robSeen' : 'robUnseen') : ev.type === 'burgle' ? 'burglary' : ev.type === 'arrest' ? 'arrest' : ev.type === 'shot' ? 'shot' : ev.type === 'death' ? (SHOT_RE.test(ev.text || '') ? 'shot' : 'death') : 'deal';
    if (kind === 'deal' && (clock - lastDeal < STAGE.dealGap || running.some(r => r.kind === 'deal'))) { S.skipped.deal = (S.skipped.deal || 0) + 1; return; }
    const fast = lensOf === 'tape' && tape.speed >= 16, onFocus = [ev.who, ev.to].some(h => h && focusSet().has(h));
    const where = VIGNETTES[kind].where(ctx, ev);
    // ONE AT A TIME (2026-10-09, the Heap #1136–#1140: three robberies staged at once among its close-set spots, and a victim limping off
    // past another scene's actor): a scene that would play within STAGE.apart m of a running scene's people (or the place an arrest walks
    // to), or that needs one of them, waits for it to end — STAGE.waitS s at most, its people held meanwhile (pend) — then plays. A deal
    // there is skipped; still in the way after the wait: the aftermath, as for a scene out of view
    let late = false;
    // (a deal gives way: one with these people, or within STAGE.apart m of here, is cut short — the dealer back at its spot — rather
    // than a robbery or an arrest waiting on it: Kent St & 1st, the arrest of its dealer waited out his brush pass and played late)
    if (!fast && where && kind !== 'deal' && kind !== 'burglary') for (let k = running.length - 1; k >= 0; k--) { const v = running[k];
      if (v.kind !== 'deal' || !([v.ev.who, v.ev.to].some(h => h && (h === ev.who || h === ev.to)) || (v.actors || []).some(A => !A.freed && Math.hypot(A.x - where.x, A.z - where.z) < STAGE.apart))) continue;
      running.splice(k, 1); try { v.end(true); } catch (err) { log('stage: ' + err.message); } S.dealsCut = (S.dealsCut || 0) + 1; }
    if (!fast && where && kind !== 'burglary' && (inView(where.x, where.z) || onFocus) && inTheWay(where, ev)) {
      if (kind === 'deal') { S.skipped.dealBusy = (S.skipped.dealBusy || 0) + 1; return; }
      if (waited < STAGE.waitS) { for (const h of [ev.who, ev.to]) if (h && pend.has(h)) pend.set(h, Math.max(pend.get(h), clock + STAGE.waitS - Math.max(0, waited) + STAGE.pendS)); return 'wait'; }
      late = true; S.waitedOut = (S.waitedOut || 0) + 1; }
    if (waited >= 0 && !late) S.waited = (S.waited || 0) + 1;
    if (fast || late || !where || (!inView(where.x, where.z) && !onFocus) || running.length >= STAGE.maxRun) { if (where || kind === 'death' || kind === 'shot' || kind === 'robSeen' || kind === 'robUnseen') aftermath(ctx, kind, ev, where); S.aftermath[kind] = (S.aftermath[kind] || 0) + 1; return; }
    const ts = performance.now(), v = VIGNETTES[kind].start(ctx, ev, where); S.startMs = Math.max(S.startMs || 0, +(performance.now() - ts).toFixed(2)); if (!v) { aftermath(ctx, kind, ev, where); S.skipped[kind] = (S.skipped[kind] || 0) + 1; return; }
    v.kind = kind; v.t = 0; v.ev = ev; running.push(v); S.staged[kind] = (S.staged[kind] || 0) + 1; if (kind === 'deal') lastDeal = clock;
  }
  // a running scene in the way of one at `where`: its people (or an arrest's focus, the cruiser's door) within STAGE.apart m, or the same people
  function inTheWay(where, ev) { const near = (x, z) => Math.hypot(x - where.x, z - where.z) < STAGE.apart;
    return running.some(v => v.kind !== 'burglary' && ([v.ev.who, v.ev.to].some(h => h && (h === ev.who || h === ev.to)) || (v.focus && near(v.focus[0], v.focus[1])) || (v.actors || []).some(A => !A.freed && !A.inCar && near(A.x, A.z))))
      || lingering.some(A => !A.freed && !A.inCar && (A.h === ev.who || A.h === ev.to || (A.leaving && near(A.x, A.z)))); }   // (and one limping or running off out of view, still in it)
  // (C1-7d · o.keepLeaving, the record's seek: a stand-in already going on foot out of its finished scene keeps going until the camera can't
  // see it, as it would have, instead of vanishing where it is: at 10× a show's prowler was still in view when the next show was jumped to)
  function abortAll(o = {}) { waiting.length = 0; room.clear(); for (const v of running.splice(0)) { try { v.end(true); } catch (e) { log('stage: ' + e.message); } }
    for (const A of lingering.splice(0)) { if (o.keepLeaving && A.kind === 'standin' && A.leaving && !A.freed) lingering.push(A); else free(A, { remove: true, now: true }); }
    for (const [h] of pend) { const a = agents.map.get(h); if (a?.held) agents.release(h, { remove: true }); } pend.clear(); }
  // ── per frame (simstate/agents.js's driver, before the crowd moves)
  function frame(dt) {
    const t0 = performance.now(); clock += dt; if (!occWarm && clock > 4) { occWarm = true; try { const tg = window.__city?.controls?.target || camera.position; occ(tg.x, tg.z, 8); } catch (e) { log('stage occ: ' + e.message); } }   /* (the depth programs compile once, at load, not at the first scene) */ camera.updateMatrixWorld(); PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM);
    if (occQ.length && !occBusy && (dt < .025 || ++occWait > 8)) { occWait = 0; pumpOcc(); }   // (TV plan A2: one queued height map a frame, on a calm one: not after a slow frame, unless 8 went by)
    if (tape.active) { lens = 'tape'; const t = tape.time(); tapeAcc += dt;
      if (t !== null && tapeAcc > .1) { tapeAcc = 0; if (tapeT === null) tapeT = t; if (tape.playing && t > tapeT) { for (const e of tape.events({ from: Math.floor(tapeT), to: Math.ceil(t), types: TYPES })) if (e.t > tapeT && e.t <= t) queue.push({ e, lens: 'tape' }); } tapeT = t; } }
    for (let k = 0; k < waiting.length; k++) { const q = waiting[k]; let r; try { r = handle(q.e, q.lens, clock - q.t0); } catch (err) { log('stage: ' + (err && err.stack || err)); } if (r !== 'wait') waiting.splice(k--, 1); }   // (ONE AT A TIME: in order)
    while (queue.length) { const q = queue.shift(); let r; try { r = handle(q.e, q.lens); } catch (err) { log('stage: ' + (err && err.stack || err)); } if (r === 'wait') waiting.push({ ...q, t0: clock }); }
    for (const [h, until] of pend) if (clock > until) { S.pendTimeouts++; if (busy.has(h)) { pend.delete(h); continue; }   // (no event came: it goes as before — on foot, out of the camera's view first)
      const A = actor(h); pend.delete(h); if (A) { S.probe.leaves++; leaveOnFoot(ctx, A, { v: 1.35 }); free(A, { remove: true }); } else agents.release(h, { remove: true }); }
    for (const v of running) for (const A of v.actors || []) if (!A.freed && A.w && A.w.tier !== 1) nearFirst(A.w);
    for (let k = running.length - 1; k >= 0; k--) { const v = running[k]; v.t += dt; let on = false; try { on = v.step(v.t, dt); for (const A of v.actors || []) if (!A.freed && !A.linger) { followPath(A); stepActor(A, dt); } } catch (err) { log('stage: ' + (err && err.stack || err)); }
      if (!on) { running.splice(k, 1); try { v.end(false); } catch (err) { log('stage: ' + err.message); } } }
    try { stepLinger(dt); } catch (err) { log('stage: ' + (err && err.stack || err)); }
    try { const L = lingering.filter(A => !A.inCar), W = []; for (const v of running) { for (const A of v.actors || []) if (!A.freed) L.push(A); if (v.way) W.push(...v.way()); } room.step(L, dt, W); } catch (err) { log('stage room: ' + (err && err.stack || err)); }   // (the crowd keeps out of the scenes' room: stage/crowd.js — an arrest's too, never in its way)
    stepCowers(dt); props.frame(dt, camera); if (S.probe.on) probeFrame();
    const ms = performance.now() - t0; S.ms.push(ms); if (S.ms.length > 600) S.ms.shift(); S.maxMs = Math.max(S.maxMs, ms); }
  // THE NEAR TIER (stage-b, 2026-10-08): only near walkers run the gait, so only they play clips. In a crowd the near batch is full and a
  // new walker (a stand-in: the patrol's cop) went to the mid tier — its cuffing never played. A scene's actors are put at the head of
  // the walkers' list with the near tier's mark (peds.js keeps last frame's near walkers first, in list order), so they are drawn near
  // whenever they are in its range; the walker the batch then has no room for is the last in the list, a crowd walker.
  function nearFirst(w) { const W = psim.walkers, i = W.indexOf(w); if (i > 0) { W.splice(i, 1); W.unshift(w); } w.tier = 1; }
  // ── THE PROBE's per-frame checks (stage/probe.mjs turns them on): upright actors' heads (1.0 × 0.8 boxes at their yaw) overlapping, an
  // actor standing inside a standing bystander (bodies closer than 0.6 m); the nearest two upright actors ever got (minGap, m)
  const LOW = new Set(['shove_fall', 'fall_back', 'lie_hurt', 'death_collapse', 'lie_still', 'shot_hit', 'shot_hit_dead', 'get_up']);
  const heads = (a, b) => { const ax = [[Math.cos(a.ry), -Math.sin(a.ry)], [Math.sin(a.ry), Math.cos(a.ry)]], bx = [[Math.cos(b.ry), -Math.sin(b.ry)], [Math.sin(b.ry), Math.cos(b.ry)]], d = [b.x - a.x, b.z - a.z], H = [.5, .4];
    for (const n of [...ax, ...bx]) { const ra = H[0] * Math.abs(n[0] * ax[0][0] + n[1] * ax[0][1]) + H[1] * Math.abs(n[0] * ax[1][0] + n[1] * ax[1][1]), rb = H[0] * Math.abs(n[0] * bx[0][0] + n[1] * bx[0][1]) + H[1] * Math.abs(n[0] * bx[1][0] + n[1] * bx[1][1]);
      if (Math.abs(d[0] * n[0] + d[1] * n[1]) > ra + rb - .02) return false; } return true; };
  const pairSeen = new Set();
  function probeFrame() { const L = [], P = S.probe; for (const v of running) for (const A of v.actors || []) if (!A.freed) L.push(A); for (const A of lingering) if (!A.freed && !L.includes(A)) L.push(A);
    const up = L.filter(A => !LOW.has(A.now) && !A.w.g?.clip?.c?.name?.startsWith?.('lie'));
    for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) { const a = up[i], b = up[j], d = Math.hypot(a.x - b.x, a.z - b.z); if (d < P.minGap) P.minGap = +d.toFixed(3);
      if (heads(a, b)) { P.overlapFrames++; const k = a.h + '|' + b.h + '|' + Math.floor(clock / 5); if (!pairSeen.has(k)) { pairSeen.add(k); P.overlapPairs++; P.lastOverlap = { a: a.h, b: b.h, d: +d.toFixed(2), an: a.now, bn: b.now }; note('overlap', P.lastOverlap, a); } } }
    const mine = new Set(L.map(A => A.w));
    // (2026-10-09) every other walker too, standing or walking — the crowd, other agents: a head box overlapping an upright actor's
    // (crowdHead*), bodies closer than 0.6 m (crowdBody*). Before, only standing bystanders inside 0.6 m counted: a kerb waiter 0.8 m
    // from the robbed one, its head in theirs all scene, passed
    for (const A of up) for (const w of psim.walkers) { if (mine.has(w) || w.gone || !w.p || Math.abs(w.p[0] - A.x) > 1.5 || Math.abs(w.p[2] - A.z) > 1.5) continue; const d = Math.hypot(w.p[0] - A.x, w.p[2] - A.z), k = A.h + '|' + (w.aid || w.id) + '|' + Math.floor(clock / 5);
      if (heads(A, { x: w.p[0], z: w.p[2], ry: w.yawS ?? w.p[3] })) { P.crowdHeadFrames = (P.crowdHeadFrames || 0) + 1; if (!pairSeen.has('h' + k)) { pairSeen.add('h' + k); P.crowdHeadPairs = (P.crowdHeadPairs || 0) + 1; P.lastCrowd = { a: A.h, w: w.aid || 'crowd', d: +d.toFixed(2), vc: +(w.vc || 0).toFixed(2), an: A.now }; note('crowd', P.lastCrowd, A); } }
      if (d < .6) { P.crowdBodyFrames = (P.crowdBodyFrames || 0) + 1; if (!pairSeen.has('b' + k)) { pairSeen.add('b' + k); P.crowdBodyPairs = (P.crowdBodyPairs || 0) + 1; } } }
    for (const A of up) for (const w of psim.walkers) { if (mine.has(w) || w.gone || !w.p || (w.vc || 0) > .1) continue; if (Math.hypot(w.p[0] - A.x, w.p[2] - A.z) < .6) { P.insideFrames++; const k = A.h + '|' + (w.aid || w.id) + '|' + Math.floor(clock / 5); if (!pairSeen.has(k)) { pairSeen.add(k); P.insidePairs++; P.lastInside = { a: A.h, w: w.aid || 'crowd' }; note('inside', P.lastInside, A); } } } }
  // (every pair the probe counts, with where and what the actor was in: the first 300, for finding what to fix — P.pairs)
  function note(kind, o, A) { const L = S.probe.pairs ||= []; if (L.length < 300) L.push({ kind, ...o, x: +A.x.toFixed(1), z: +A.z.toFixed(1), stand: A.standKind ?? A.kind, t: +clock.toFixed(1) }); }
  const q = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3); };
  const api = { frame, hooks, props, ctx,
    // stage one event by hand (tests, clips): the event as the store or the tape would hand it over
    play(e, lensOf = 'live') { queue.push({ e: { t: store.clock()?.t ?? 0, ...e }, lens: lensOf }); },
    // C1-3 · a scene made elsewhere (stage/record.js: the record's fights) run here like a vignette: { actors, step(t, dt) → on, end(abort) }
    run(v, kind = 'record') { v.kind = kind; v.t = 0; v.ev = v.ev || {}; running.push(v); return v; },
    // C1-3 · stop one running scene now (a late arrest cut to its arrival): ended as an abort, its walkers handed back
    stop(v) { const k = running.indexOf(v); if (k < 0) return false; running.splice(k, 1); try { v.end(true); } catch (e) { log('stage: ' + e.message); } return true; },
    list: () => [...running.map(v => ({ kind: v.kind, t: +v.t.toFixed(2), who: v.ev.who ?? null, to: v.ev.to ?? null, at: v.ev.at ?? null, focus: v.focus ?? null, ph: v.phase?.() ?? null })), ...waiting.map(q => ({ kind: 'waiting', t: +(clock - q.t0).toFixed(2), who: q.e.who ?? null, to: q.e.to ?? null, at: q.e.at ?? null, type: q.e.type }))],   // (focus: where a scene plays — the arrest's walk to the car · waiting: ONE AT A TIME)
    stats: () => ({ ...S, ms: undefined, room: room.stats(), running: running.length, lingering: lingering.length, busy: busy.size, pending: pend.size, p50: q(S.ms, .5), p95: q(S.ms, .95), maxMs: +S.maxMs.toFixed(3), props: props.counts(), lens }),
    abortAll, goneSet, probe: on => { S.probe.on = !!on; return S.probe; }, lingering: () => lingering.map(A => ({ h: A.h, t: +A.linger.t.toFixed(1), now: A.now })),
    // (C1-7d: the walkers of the stand-ins going off on foot, for a new scene's ground to leave out: what it stages never depends on them)
    leavingWalkers: () => new Set(lingering.filter(A => !A.freed && A.kind === 'standin').map(A => A.w)) };
  if (typeof window !== 'undefined') window.__stage = api;
  return api;
}
