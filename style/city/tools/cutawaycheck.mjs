// C2-camera · FOLLOWING AN AGENT HOME, THE CAMERA (GAME.md §41, slime 10-31: "Rise to the cutaway": while the followed agent is inside,
// the camera rises to its room's own three-quarter view from the street side and eases back down at the door). Headless Chrome on
// ?sim=record (&simtod=0), seed 404, the record at 1x. Each STAY below follows one agent through a stay at home the way a player does
// (a real click on the walker, its card's Follow; a drag and the wheel as real input; G as a page key event — CDP key input stops
// headless Chrome's frames, on 5e2ed4e as here) and counts, per stay, from the page's
// own drawing and render, never from the camera code it checks:
//   cutaway   frames in the cutaway framing / frames inside (settled: 2 s after it crossed its door, a seek or a switch). The framing,
//             geometric: the camera on the street side of its house's front wall (its lot frame), above the room's floor + 2.2 m, and
//             the room's four floor corners and the agent on screen (draw.js indoors.planOf: the room's frame in the lot)
//   hidden    while it is inside or crossing its door, sampled through the render (the homes runtime's depth pick, hitAt: opaque
//             meshes, the cut applied): the agent off screen, or something opaque nearer the camera than its body at its head, chest
//             and hips (all three); BLANK: 3 or more of 5 points over the frame hit within 0.6 m of the camera (a wall in the lens).
//             Samples begun within 300 ms of a seek, a reload or a switch (the camera held still while the new room opens: the agent
//             elsewhere) are counted apart, as held / heldHidden
//   after     3 s after it came out: the viewer's own angle, pitch and distance (follow dbg az, vpitch, want) against theirs before
//             it went in (drift: must be 0), and, reported, the camera against the follow's own pose at those (camAt from its pivot: m
//             and degrees; at a step between walls the follow's own wall assists — a swing, a pull-in, a hold — are in it, before as after)
//   fly-in    after a seek or a reload into a stay: frames the camera moved (> 5 cm) while not in the cutaway framing, before it got there
//   seek out  after a seek out of the stay: frames still in the room's framing
// Exit 1 on any failure. It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
//   node style/city/tools/cutawaycheck.mjs --port 5984 [--only day,night,leave,seek,reload,switch] [--out f.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5984), SEED = 404, BASE = `http://127.0.0.1:${PORT}`, ONLY = arg('only', null)?.split(','), OUT = arg('out', null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the stays (seed 404): [name, agent, about when it gets home (island minute), night]
const STAYS = [
  { name: 'day', id: 'a02', near: 2104, night: false, exit: true },   // day 1 11:04, out again at 12:58
  { name: 'night', id: 'a12', near: 2719, night: true, exit: true, input: true },   // day 1 21:19, out at 05:58; the viewer drags and zooms inside
  { name: 'leave', id: 'a10', near: 3542, after: .03, night: false, exit: true },   // day 2 11:02 (out of its cab: followed from the kerb), out at 11:58
  { name: 'seek', id: 'a05', at: 4100, seekIn: 4400, seekOut: 4700, night: true },   // followed outside, sought into its night stay, then out of it
  { name: 'reload', id: 'a05', reload: 4400, night: true },   // the page loaded with ?follow=a05 mid-stay
  { name: 'switch', id: 'a03', paused: 2940, night: true },   // paused at night inside, G onto the next agent (a04, inside its own home)
].filter(s => !ONLY || ONLY.includes(s.name));

async function open(B, minute, night, extra = '') {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${night ? 'night' : 'day'}&simtod=0&recordAt=${minute}&recordPaused=1&recordSpeed=1${extra}` });
  let ok = false; for (let t = 0; t < 600 && !ok; t++) { ok = await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1 && window.__city.recordHomes)`, false).catch(() => false); if (!ok) await sleep(400); }
  if (!ok) throw new Error('the record page did not load: ' + (B.errors[0] ?? 'timeout')); await sleep(2500);
}
const press = async (B, q) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: q.x, y: q.y, button: 'left', clickCount: 1, pointerType: 'mouse' }); };
// the orbit camera over the agent from its house's street side, a real click on its walker, then on its card's Follow (indoorprobe's way)
async function followByCard(B, id) {
  await B.ev(`(() => { const D = window.__record.draw, a = D.agents.map.get(${JSON.stringify(id)}), p = D.indoors?.planOf(${JSON.stringify(id)}), c = window.__city; if (c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true }); if (!a?.w) return false;
    const f = p ? p.door.face : [0, 1], q = [a.w.p[0], a.w.p[2]], k = 1.4; c.controls.target.set(q[0], .8, q[1]); c.camera.position.set(q[0] + f[0] * 8 * k + f[1] * 3 * k, 8.5 * k, q[1] + f[1] * 8 * k - f[0] * 3 * k); c.controls.update?.(); return true; })()`);
  await sleep(1200);
  const p = await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(id)}), c = window.__city; if (!a?.w) return null; const v = new c.THREE.Vector3(a.w.p[0], a.w.p[1] + 1.1, a.w.p[2]).project(c.camera), r = c.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; })()`);
  if (!p) return false; await press(B, p); await sleep(900);
  const f = await B.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => /^\\s*follow\\s*f\\s*$/i.test(b.textContent || '') && b.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (process.env.DBG) console.log('follow by card', id, p, f, await B.ev(`[...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.textContent || '').trim().slice(0, 16)).join(' | ')`));
  if (f) await press(B, f); await sleep(1200);
  return B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(id)}; })()`);
}
// per frame: the subject's indoor state (draw.js), the cutaway framing (geometric, from its plan), the camera, the follow's own numbers;
// and, as often as the render allows, the depth-pick samples while it is inside or at its door
const SAMPLER = `(() => { if (window.__cw) { window.__cw.on = false; } const D = window.__record.draw, I = D.indoors, c = window.__city, T = c.THREE, H = c.recordHomes.H, W = window.__cw = { on: true, rows: [], occ: [], marks: [] };
  const V = new T.Vector3(), r0 = () => c.renderer.domElement.getBoundingClientRect();
  const subj = () => { const s = c.cam.mode === 'follow' ? c.cam.subject : null; return s?.agent ? s.aid : null; };
  function cutOf(id) { const p = I.planOf(id); if (!p) return false; const h = p.h, F = p.F, cam = c.camera.position, dx = cam.x - h.cx, dz = cam.z - h.cz, lz = dx * Math.sin(h.th) + dz * Math.cos(h.th);
    if (!(lz > h.fd / 2 - .1) || !(cam.y > F.origin[1] + 2.2)) return false;
    for (const [x, z] of [[0, 0], [F.W, 0], [0, F.D], [F.W, F.D]]) { const [X, Z] = F.toWorld(x, z); V.set(X, F.origin[1], Z).project(c.camera); if (V.z > 1 || Math.abs(V.x) > 1 || Math.abs(V.y) > 1) return false; }
    return true; }
  function onScreen(w, dy) { V.set(w.p[0], w.p[1] + dy, w.p[2]).project(c.camera); return V.z < 1 && Math.abs(V.x) <= 1 && Math.abs(V.y) <= 1 ? { x: V.x, y: V.y } : null; }
  const f = () => { if (!W.on) return; const id = subj(), a = id && D.agents.map.get(id), w = a?.w, P = id ? I.inside.get(id) : null, g = c.cam.follow.dbg, cam = c.camera.position;
    W.rows.push({ t: performance.now(), m: window.__record.player.minute, id, mode: c.cam.mode, inside: !!P?.inside, door: P?.door ?? 0, cut: id ? cutOf(id) && !!(w && onScreen(w, 1)) : false,
      cam: [cam.x, cam.y, cam.z], az: g.az, want: g.want, vp: g.vpitch, L: g.L, room: g.room ? g.room.src + ':' + g.room.ease + (g.room.hold ? ':hold' : '') : null, hold: g.hold, as: g.assist?.az ?? 0, arm: g.arm, dodge: g.dodge, lift: g.lift, rv: g.room ? [+g.room.yaw.toFixed(3), +g.room.pitch.toFixed(3), +g.room.zoom.toFixed(3)] : null });
    requestAnimationFrame(f); };
  requestAnimationFrame(f);
  if (!${!!process.env.NOOCC}) (async () => { while (W.on) { const id = subj(), a = id && D.agents.map.get(id), w = a?.w, P = id ? I.inside.get(id) : null;
      if (w && P && (P.inside || P.door > 0)) { const t0 = performance.now(), R = r0(), cam = c.camera.position.clone(), m = window.__record.player.minute, px = s => ({ x: R.left + (s.x + 1) / 2 * R.width, y: R.top + (1 - s.y) / 2 * R.height });
        let seen = false, any = false;
        for (const dy of [.5, 1, 1.45]) { const s = onScreen(w, dy); if (!s) continue; any = true; const hit = await H.hitAt(px(s).x, px(s).y), d = Math.hypot(w.p[0] - cam.x, w.p[1] + dy - cam.y, w.p[2] - cam.z);
          if (!hit || hit.distanceTo(cam) >= d - .5) { seen = true; break; } }
        let near = 0; for (const s of [[0, 0], [-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) { const hit = await H.hitAt(px({ x: s[0], y: s[1] }).x, px({ x: s[0], y: s[1] }).y); if (hit && hit.distanceTo(cam) < .6) near++; }
        W.occ.push({ t: t0, m, id, inside: P.inside, out: !any, hidden: !seen, blank: near >= 3 }); }
      await new Promise(r => requestAnimationFrame(r)); } })();
  return true; })()`;
const mark = (B, k) => B.ev(`(window.__cw.marks.push({ k: ${JSON.stringify(k)}, t: performance.now() }), true)`);
const stateOf = (B, id) => B.ev(`(() => { const D = window.__record.draw, P = D.indoors.inside.get(${JSON.stringify(id)}), st = D.indoors.stays.get(${JSON.stringify(id)}); return { m: window.__record.player.minute, inside: !!P?.inside, door: P?.door ?? 0, tIn: st?.stay.tIn / 60, tOut: st?.stay.tOut / 60, aid: window.__city.cam.subject?.aid ?? null, mode: window.__city.cam.mode }; })()`);
async function until(B, id, pred, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await stateOf(B, id); if (pred(s)) return s; await sleep(100); } return null; }
const deg = r => r * 180 / Math.PI;
// the follow's own pose at the viewer's angle, pitch and distance from its pivot (follow.js camAt; config shoulder / dist)
function expected(row, cfg) { const a = row.az, p = row.vp, L = row.want, lat = cfg.shoulder * Math.min(1, L / cfg.dist), cp = Math.cos(p), s = Math.sin(a), co = Math.cos(a), O = row.L;
  return [O[0] + s * cp * L + co * lat, O[1] + Math.sin(p) * L, O[2] + co * cp * L - s * lat]; }
function poseErr(row, cfg) { const e = expected(row, cfg), O = row.L, u = row.cam.map((v, i) => v - O[i]), v = e.map((x, i) => x - O[i]), nu = Math.hypot(...u), nv = Math.hypot(...v);
  return { m: +Math.hypot(...row.cam.map((x, i) => x - e[i])).toFixed(3), deg: +deg(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv || 1))))).toFixed(2), dist: +Math.abs(nu - nv).toFixed(3) }; }

// ── the numbers of one stay, from the page's rows
function score(S, W, cfg) {
  const rows = W.rows.filter(r => r.id === S.id || S.name === 'switch'), occ = W.occ, marks = Object.fromEntries(W.marks.map(m => [m.k, m.t]));
  // settled inside: 2 s past its latest way in (a crossing, a seek, a switch: any frame whose state or subject changed)
  let since = -1e9, prev = null, settled = 0, cut = 0; const fromT = marks.settleFrom ?? 0;
  for (const r of rows) { if (!prev || r.inside !== prev.inside || r.id !== prev.id || Math.abs(r.m - prev.m) > .05) since = r.t; prev = r;
    if (r.inside && r.t - since >= 2000 && r.t >= fromT) { settled++; if (r.cut) cut++; } }
  // (within 300 ms of a seek, a reload or a switch — the camera holding still while the new room opens — counted apart: held)
  const jumps = ['seekIn', 'seekOut', 'reload', 'switch'].map(k => marks[k]).filter(t => t !== undefined), held = o => jumps.some(t => o.t >= t && o.t < t + 300);
  const near = occ.filter(o => o.t >= fromT), out = { stay: S.name, agent: S.id, settledInside: settled, cutaway: cut, cutawayPct: settled ? +(100 * cut / settled).toFixed(1) : null,
    samples: near.length, hidden: near.filter(o => o.hidden && !held(o)).length, offScreen: near.filter(o => o.out && !held(o)).length, held: near.filter(o => held(o)).length, heldHidden: near.filter(o => o.hidden && held(o)).length, blank: near.filter(o => o.blank).length };
  const fails = [];
  if (!settled) fails.push('never settled inside');
  else if (cut / settled < .95) fails.push(`cutaway ${out.cutawayPct}% < 95%`);
  if (!near.length) fails.push('no render samples while inside');
  if (out.hidden || out.blank) fails.push(`hidden ${out.hidden} (off screen ${out.offScreen}) · blank ${out.blank} of ${near.length}`);
  if (S.exit) { const before = rows.find(r => r.t >= (marks.ref ?? 0) && r.mode === 'follow' && !r.inside && r.door === 0), ex = rows.findIndex((r, i) => i > 0 && rows[i - 1].inside && !r.inside && r.t >= (marks.exit ?? 0));
    const after = ex >= 0 ? rows.find(r => r.t >= rows[ex].t + 3000) : null;
    if (!before || !after) fails.push('no before / after rows (' + !!before + ', ' + !!after + ')');
    else { out.drift = { az: +deg(Math.abs(Math.atan2(Math.sin(after.az - before.az), Math.cos(after.az - before.az)))).toFixed(3), pitch: +deg(Math.abs(after.vp - before.vp)).toFixed(3), dist: +Math.abs(after.want - before.want).toFixed(3) };
      out.before = poseErr(before, cfg); out.after = poseErr(after, cfg);
      if (out.drift.az > 1e-3 || out.drift.pitch > 1e-3 || out.drift.dist > 1e-3) fails.push('the viewer\'s angle / pitch / distance changed: ' + JSON.stringify(out.drift));
      // (reported, not gated: 3 s out the follow's own wall assists at its step — a swing, a pull-in, a hold — are the follow's)
      } }
  // (the viewer's drag and wheel inside: where the camera went, and the room view's own offsets after — null where the follow has none)
  if (marks.input !== undefined) { const a = rows.find(r => r.t >= marks.input), b = rows.find(r => r.t >= marks.input + 2500); out.input = a && b ? { moved: +Math.hypot(...b.cam.map((v, i) => v - a.cam[i])).toFixed(2), roomView: b.rv, stillCutaway: b.cut } : null; }
  for (const k of ['seekIn', 'reload']) if (marks[k] !== undefined) {
    // fly-in: frames the camera moved while not yet in the cutaway framing, from the seek (or the follow taking hold after the reload)
    const L = rows.filter(r => r.t >= marks[k] && r.mode === 'follow'); let fly = 0, to = null;
    for (let i = 1; i < L.length; i++) { if (L[i].cut) { to = L[i].t - marks[k]; break; } if (Math.hypot(...L[i].cam.map((v, j) => v - L[i - 1].cam[j])) > .05) fly++; }
    out[k] = { flyFrames: fly, msToCutaway: to === null ? null : Math.round(to) }; if (fly) fails.push(`${k}: the camera flew ${fly} frames before the cutaway`); if (to === null || to > 2500) fails.push(`${k}: no cutaway within 2.5 s (${to})`); }
  if (marks.seekOut !== undefined) { const L = rows.filter(r => r.t >= marks.seekOut + 50); const stuck = L.slice(0, 120).filter(r => r.cut).length; out.seekOut = { roomFrames: stuck }; if (stuck > 2) fails.push(`seek out: ${stuck} frames still on the room`); }
  if (marks.switch !== undefined) { const L = rows.filter(r => r.t >= marks.switch); const to = L.find(r => r.id !== S.id && r.cut); out.switch = { to: to?.id ?? null, msToCutaway: to ? Math.round(to.t - marks.switch) : null }; if (!to || to.t - marks.switch > 2500) fails.push('switch: the next agent\'s room not framed within 2.5 s'); }
  out.ok = !fails.length; out.fails = fails; return out;
}

async function runStay(B, S) {
  const log = (...a) => process.env.DBG && console.log(S.name, ...a);
  if (S.reload) { await open(B, S.reload, S.night, `&follow=${S.id}`); await B.ev(SAMPLER); await mark(B, 'reload'); await mark(B, 'settleFrom');
    await until(B, S.id, s => s.mode === 'follow' && s.aid === S.id, 20000); await sleep(6000); return; }
  if (S.paused) { await open(B, S.paused, S.night); await B.ev(`(() => { const c = window.__city, w = c.cam.people.byAid(${JSON.stringify(S.id)}); return c.cam.setMode('follow', { subject: w }); })()`);
    log('following'); await sleep(3000); await B.ev(SAMPLER); log('sampling'); await mark(B, 'settleFrom'); await sleep(3000); await mark(B, 'switch'); log('switch'); await B.ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true }))`); await sleep(5000); return; }
  if (S.seekIn) { await open(B, S.at, S.night); const ok = await followByCard(B, S.id); if (!ok) throw new Error(S.name + ': the card did not follow ' + S.id);
    await B.ev(SAMPLER); await B.ev(`window.__record.player.play()`); await sleep(3000);
    await B.ev(`(window.__record.player.seek(${S.seekIn}), window.__cw.marks.push({ k: 'seekIn', t: performance.now() }, { k: 'settleFrom', t: performance.now() }), true)`); await sleep(7000);
    await B.ev(`(window.__record.player.seek(${S.seekOut}), window.__cw.marks.push({ k: 'seekOut', t: performance.now() }), true)`); await sleep(3000); return; }
  // a played way in: the minute it gets home, from its trip (draw.js stateAt), the viewer on it by its card 20 s before
  await open(B, S.near - 3, S.night);
  const arr = await B.ev(`(() => { const D = window.__record.draw; for (let m = ${S.near - 3}; m < ${S.near + 3}; m += .05) { const s = D.stateAt(${JSON.stringify(S.id)}, m); if (s.trip) return s.trip.arr; } return null; })()`);
  if (arr === null) throw new Error(S.name + ': no trip home near ' + S.near);
  await B.ev(`window.__record.player.seek(${arr + (S.after ?? -.33)})`); await sleep(2500);
  const ok = await followByCard(B, S.id); if (!ok) throw new Error(S.name + ': the card did not follow ' + S.id); log('following', arr);
  await B.ev(SAMPLER); await B.ev(`window.__record.player.play()`); await sleep(4000); await mark(B, 'ref');
  // (on its step: its stay at home may start later — after the show it is in: on to a little before it goes in)
  const st = await until(B, S.id, s => s.inside || Number.isFinite(s.tIn), 240000);
  log('on its step', JSON.stringify(st));
  if (st && !st.inside && st.tIn - st.m > .5) { await B.ev(`window.__record.player.seek(${st.tIn - .25})`); await sleep(500); }
  const inn = await until(B, S.id, s => s.inside, 60000); if (!inn) throw new Error(S.name + ': never went in');
  log('inside', JSON.stringify(inn)); await sleep(6000);
  if (S.input) { await mark(B, 'input'); const c = await B.ev(`(() => { const r = window.__city.renderer.domElement.getBoundingClientRect(); return { x: r.left + r.width * .4, y: r.top + r.height * .5 }; })()`);
    await B.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    for (let k = 1; k <= 12; k++) { await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x - k * 10, y: c.y + k * 2, button: 'left', buttons: 1 }); await sleep(16); }
    await B.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x - 120, y: c.y + 24, button: 'left', clickCount: 1 });
    for (let k = 0; k < 4; k++) { await B.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: 120 }); await sleep(40); }
    await sleep(3000); }
  if (S.exit) { const s = await stateOf(B, S.id); log('to the exit', JSON.stringify(s)); await mark(B, 'exit'); await B.ev(`window.__record.player.seek(${s.tOut - .4})`);
    log('out', JSON.stringify(await until(B, S.id, x => x.m > s.tOut - .39 && !x.inside && x.m < s.tOut + 1, 60000))); await sleep(4500); log('done'); }
}

async function main() {
  const served = await serve(), B = await chrome(), results = [];
  try {
    for (const S of STAYS) {
      try { await runStay(B, S);
        // (the rows in chunks: one large return stalls the page's answer)
        const n = await B.ev(`(window.__cw.on = false, window.__cw.rows.length)`, false), W = { rows: [], ...await B.ev(`({ occ: window.__cw.occ, marks: window.__cw.marks })`, false) };
        if (process.env.DBG) console.log(S.name, 'rows', n, 'samples', W.occ.length);
        for (let i = 0; i < n; i += 1500) W.rows.push(...await B.ev(`JSON.parse(JSON.stringify(window.__cw.rows.slice(${i}, ${i + 1500})))`, false));
        const cfg = await B.ev(`(() => { const f = window.__city.cam.config.follow; return { shoulder: f.shoulder, dist: f.dist }; })()`);
        if (arg('raw', null)) await fs.writeFile(path.resolve(arg('raw'), `cutaway-${S.name}.json`), JSON.stringify(W));
        results.push(score(S, W, cfg)); }
      catch (e) { results.push({ stay: S.name, agent: S.id, ok: false, fails: [String(e && e.message || e)] }); }
      const r = results.at(-1); console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.stay} ${JSON.stringify(r)}`);
    }
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
  if (OUT) await fs.writeFile(path.resolve(OUT), JSON.stringify(results, null, 1));
  const ok = results.length && results.every(r => r.ok); console.log(ok ? 'CUTAWAYCHECK PASS' : 'CUTAWAYCHECK FAIL'); process.exitCode = ok ? 0 : 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
