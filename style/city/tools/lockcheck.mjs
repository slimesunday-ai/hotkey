// C2-lock · WHAT LOCK PROMISES, WITH REAL INPUT (camera/lock.js, slime 11-04: "another setting just locked onto a subject and you could
// rotate and zoom around them instead of the camera trying to avoid everything and move so much"; walls: "see through is way better").
// Headless Chrome on ?sim=record, seed 404, day 4: a05 walking between corners (6360, 6420, 6480). Every step is the player's own input
// (a click on the walker, the card's Follow and Lock, a drag and the wheel on the canvas, Tab, Esc, 3 and 6, the player's speed box and
// minute box), and every measure is read from the page's camera and drawing — the angle and the distance from the camera's position round
// the person's pivot (their feet, CAM.lock.anchorH × their height) — never from lock.js's own state.
//   card       a click on a05 opens its card; Follow, then Lock: the rig locks on a05, and the camera does not jump at the switch (its
//              offset from the person moves ≤ 5 cm a frame)
//   drag       a drag across the canvas turns the angle round them (and nothing else), a wheel step zooms; both stay where they were left
//   carried    at 10×, 1× and 60× while a05 walks: no input, so the bearing, the pitch and the distance round them stay put (≤ 1e-3) every
//              frame (it never turns when they turn, no automatic zoom), the camera's step is at most theirs (+ 1 cm), and their chest is
//              on screen every frame. Each speed after a seek with the minute box: the camera is on them at once, at the same angle and
//              distance (no glide)
//   through    turned (a real drag) to where a wall stands between the lens and their chest (camera/world.js says so): the depth pick at
//              their chest (what the screen draws) hits them or nothing nearer. And, if a bearing puts the lens inside a building, the same
//              there. A still of each (≤ 2 jpegs)
//   switch     Tab: the lock on someone else, at the same angle and distance; a hop that moves the camera over several frames only along a
//              clear line between them (no glide through walls). Shift+Tab: back on a05
//   follow     the card's Follow from Lock, then 6 from Follow: no jump either way (through the hand-off into follow — the switch frame
//              and the rig's blend — no frame's step of the camera's offset from the person stands out from its neighbours' (over 3 × the
//              larger + 5 cm: a cut); at the switch to Lock ≤ 5 cm a frame). The blend ends on follow's own live pose, so at 10× follow's
//              own swings show at its end: the max speed is reported; and a cut of follow's own (its hold / cut at 10×, follow.js's
//              cut counter up that frame) that lands inside the blend is reported apart, not counted as the hand-off's jump. Follow's own motion after its hand-off is reported, not judged (follow.js is not this check's)
//   key        the card closed (Esc), 3 then 6: Lock on the person followed
//   reload     the page loaded with ?follow=a05&lock=1 (the day / night reload's way): Lock on a05 at the viewer's kept angle and distance
//   frames     frame time p95, Lock on with the hole cutting a wall in that dense block at 10×, vs the same view with no sim, back to back
//              (rerun once on a miss): directorscenario's bar, ≤ 16.8 ms or ≤ 1.15 × no-sim
// Exit 1 on any failure.
//   node style/city/tools/lockcheck.mjs --port 5971 [--out tmp/c2-lock/check] [--only card,drag,carried,through,switch,follow,key,reload,frames]
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, PORT, BASE, arg, sleep, open, serve, chrome, clickAgent, centre, press, key, report, writeResult } from './c2lib.mjs';
import { choose, click, typeMinute, ready } from './recordscenario.mjs';

const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-lock/check'))), ONLY = arg('only', null)?.split(','), ID = 'a05', SEED = 404;
if (!PORT) { console.error('usage: node style/city/tools/lockcheck.mjs --port <port>'); process.exit(2); }
const want = s => !ONLY || ONLY.includes(s);

// ── in the page: the camera round the person (geometry only), and a per-frame sampler of it
const GEO = `const geo = () => { const c = window.__city, s = c.cam.subject, p = c.camera.position; if (!s) return { mode: c.cam.mode, aid: null };
    const h = c.peds?.heightOf?.(s) || 1.75, px = s.p[0], py = Math.max(s.p[1], c.cam.config.follow.floorY) + c.cam.config.lock.anchorH * h, pz = s.p[2];
    const dx = p.x - px, dy = p.y - py, dz = p.z - pz, d = Math.hypot(dx, dy, dz), v = new c.THREE.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]).project(c.camera);
    return { mode: c.cam.mode, aid: s.aid ?? 'w' + s.id, obj: s, az: Math.atan2(dx, dz), el: Math.asin(Math.max(-1, Math.min(1, dy / d))), d, off: [dx, p.y - s.p[1], dz], feet: [s.p[0], s.p[1], s.p[2]], cam: [p.x, p.y, p.z], piv: [px, py, pz],
      scr: [v.x, v.y, v.z], m: window.__record.player.minute }; };`;
const NOW = `(() => { ${GEO} const g = geo(); delete g.obj; return g; })()`;
const START = `(() => { ${GEO} const S = window.__lc = { rows: [], on: true }; let last = null, t0 = performance.now();
  const f = t => { if (!S.on) return; const g = geo(), dt = (t - t0) / 1000; t0 = t; if (g.aid) { const r = { m: g.m, mode: g.mode, blend: window.__city.cam.blending, fcuts: window.__city.cam.follow.dbg.cuts, aid: g.aid, az: g.az, el: g.el, d: g.d, scr: g.scr, cam: g.cam, feet: g.feet, piv: g.piv };
      if (last) { r.same = last.obj === g.obj; r.camStep = Math.hypot(g.cam[0] - last.cam[0], g.cam[1] - last.cam[1], g.cam[2] - last.cam[2]); r.subStep = Math.hypot(g.feet[0] - last.feet[0], g.feet[1] - last.feet[1], g.feet[2] - last.feet[2]);
        r.relStep = Math.hypot(g.off[0] - last.off[0], g.off[1] - last.off[1], g.off[2] - last.off[2]); r.relSpeed = dt > 0 ? r.relStep / dt : 0; }
      S.rows.push(r); last = g; } else last = null; requestAnimationFrame(f); };
  requestAnimationFrame(f); return true; })()`;
const STOP = `(() => { const S = window.__lc; if (!S) return []; S.on = false; return S.rows; })()`;
const wrap = a => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
const max = (rows, k) => rows.reduce((x, r) => Math.max(x, r[k] ?? 0), 0);
const r4 = x => +(+x).toFixed(4);
// a jump: a frame whose offset step (camera against the person) is over 3 × the larger of its neighbours' + 5 cm — a cut stands alone,
// a glide's steps grow and shrink together (whatever the frame rate: headless frames come 16–100 ms apart)
// (each with whether follow.js cut that frame — its own cut counter went up: follow's hold / cut at 10×, not the hand-off's)
const spikes = rows => rows.map((r, i) => i > 0 && i < rows.length - 1 && r.relStep > 3 * Math.max(rows[i - 1].relStep, rows[i + 1].relStep) + .05 ? [r4(r.m), r4(r.relStep), r.fcuts > rows[i - 1].fcuts ? 'follow cut' : 'hand-off'] : null).filter(Boolean);
const handJumps = rows => spikes(rows).filter(x => x[2] === 'hand-off');

async function drag(B, x0, y0, dx, dy, n = 12) {
  await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
  await B.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= n; i++) { await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + dx * i / n, y: y0 + dy * i / n, button: 'left', buttons: 1 }); await sleep(16); }
  await B.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + dx, y: y0 + dy, button: 'left', buttons: 0, clickCount: 1 });
}
const wheel = (B, x, y, deltaY) => B.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
async function keyMod(B, k, code, vk, modifiers = 0) { for (const type of ['keyDown', 'keyUp']) await B.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }); }
const card = (B, act) => centre(B, `document.querySelector('#r-dossier [data-act=${act}]')`);
// the angle and distance the viewer left, against a later geometry: bearing, pitch (rad) and distance (m) apart
const apart = (a, b) => ({ az: r4(Math.abs(wrap(a.az - b.az))), el: r4(Math.abs(a.el - b.el)), d: r4(Math.abs(a.d - b.d)) });
const still = x => x.az <= 1e-3 && x.el <= 1e-3 && x.d <= 1e-3;
// (the canvas's middle, clear of the card on the right and the player bar below)
const CX = 470, CY = 300;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome(), steps = [], step = (name, ok, detail) => { steps.push({ name, ok: !!ok, detail }); console.log(`… ${name} ${ok ? 'ok' : 'NOT ok'}`); };
  const shots = [];
  const shot = async name => { if (shots.length >= 2) return null; const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); const f = path.join(OUT, name + '.jpg'); await fs.writeFile(f, Buffer.from(r.result.data, 'base64')); shots.push(path.relative(ROOT, f)); return path.relative(ROOT, f); };
  let view = null;
  try {
    await open(B, SEED, 'tod=day&recordAt=6359.6&recordPaused=1&recordSpeed=10'); await sleep(3000);
    // ── card: Follow, then Lock
    const opened = await clickAgent(B, ID);
    let b = await card(B, 'follow'); if (b) await press(B, b); await sleep(1800);
    const afterFollow = JSON.parse(JSON.stringify(await B.ev(NOW)));
    await B.ev(START); await sleep(300); b = await card(B, 'lock'); if (b) await press(B, b); await sleep(1500);
    let rows = await B.ev(STOP); const g1 = await B.ev(NOW), btn = await B.ev(`document.querySelector('#r-dossier [data-act=lock]')?.getAttribute('aria-pressed')`);
    const i0 = rows.findIndex(r => r.mode === 'lock'), sw = i0 < 0 ? [] : rows.slice(i0).filter(r => r.same), relMax = max(sw, 'relStep');   // (from the switch frame on: before it, follow's own hand-in may still be settling)
    if (want('card')) step('card', opened === ID && afterFollow.mode === 'follow' && g1.mode === 'lock' && g1.aid === ID && btn === 'true' && relMax <= .05, { opened, before: afterFollow.mode, after: g1.mode, aid: g1.aid, button: btn, frames: sw.length, maxOffsetStep: r4(relMax) });
    // ── drag and wheel (on the canvas, real input)
    if (want('drag')) {
      const a0 = await B.ev(NOW); await drag(B, CX, CY, 200, 0); await sleep(200); const a1 = await B.ev(NOW); await sleep(1000); const a2 = await B.ev(NOW);
      await wheel(B, CX, CY, 240); await sleep(400); const a3 = await B.ev(NOW); await sleep(1000); const a4 = await B.ev(NOW);
      const turned = wrap(a1.az - a0.az), zoom = a3.d / a2.d;
      step('drag', a1.mode === 'lock' && Math.abs(turned) > .3 && Math.abs(a1.el - a0.el) < .02 && Math.abs(a1.d - a0.d) < 1e-3 && still(apart(a1, a2)) && zoom > 1.1 && Math.abs(a3.az - a2.az) < 1e-3 && still(apart(a3, a4)),
        { turned: r4(turned), pitchMoved: r4(a1.el - a0.el), distMoved: r4(a1.d - a0.d), keptAfterDrag: apart(a1, a2), zoom: r4(zoom), keptAfterWheel: apart(a3, a4) });
    }
    // ── carried, at 10×, 1× and 60× (no input; a seek with the minute box before each)
    const carried = [];
    for (const [sp, at, secs] of [[10, 6359.9, 11], [1, 6420.2, 5], [60, 6479.95, 4]]) {
      if (!want('carried') && carried.length) break;
      if (await B.ev('window.__record.player.running')) await click(B, '#record-player button[aria-label="Play or pause"]');
      const before = await B.ev(NOW); await B.ev(START); await typeMinute(B, at); await sleep(1500);
      if (await B.ev('window.__record.player.speed') !== sp) await choose(B, '#record-player select[aria-label="Playback speed"]', sp);
      const seekRows = await B.ev(STOP), placed = seekRows.find(r => r.m >= at - .01 && r.aid === ID);
      const g0 = await B.ev(NOW); await B.ev(START); await click(B, '#record-player button[aria-label="Play or pause"]'); await sleep(secs * 1000);
      await click(B, '#record-player button[aria-label="Play or pause"]'); rows = await B.ev(STOP);
      const on = rows.filter(r => r.mode === 'lock' && r.aid === ID), same = on.filter(r => r.same);
      const drift = on.reduce((x, r) => ({ az: Math.max(x.az, Math.abs(wrap(r.az - g0.az))), el: Math.max(x.el, Math.abs(r.el - g0.el)), d: Math.max(x.d, Math.abs(r.d - g0.d)) }), { az: 0, el: 0, d: 0 });
      const excess = same.reduce((x, r) => Math.max(x, r.camStep - r.subStep), 0), walked = same.reduce((x, r) => x + r.subStep, 0), offScreen = on.filter(r => !(r.scr[2] < 1 && Math.abs(r.scr[0]) < .9 && Math.abs(r.scr[1]) < .9)).length;
      const atSeek = placed ? apart(placed, before) : null;
      carried.push({ speed: sp, frames: rows.length, on: on.length, walked: r4(walked), drift: { az: r4(drift.az), el: r4(drift.el), d: r4(drift.d) }, maxExcess: r4(excess), maxStep: r4(max(same, 'camStep')), offScreen, seekAt: at, onAtSeek: atSeek,
        ok: on.length === rows.length && on.length > 20 && walked > 1 && still(drift) && excess <= .01 && offScreen === 0 && !!atSeek && still(atSeek) });
    }
    if (want('carried')) step('carried', carried.length === 3 && carried.every(c => c.ok), carried);
    // ── see-through: turned to a bearing where a wall stands between the lens and the chest (camera/world.js), with a real drag
    const FIND = `(() => { ${GEO} const c = window.__city, g = geo(), T = c.THREE, W = c.cam.world, s = g.obj, ch = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), out = { wall: null, inside: null };
      for (let k = 1; k <= 72; k++) for (const sg of [1, -1]) { const a = g.az + sg * k * Math.PI / 36, ce = Math.cos(g.el), P = new T.Vector3(g.piv[0] + Math.sin(a) * ce * g.d, g.piv[1] + Math.sin(g.el) * g.d, g.piv[2] + Math.cos(a) * ce * g.d);
        const inside = W.inside(P, 8), h = !inside && W.ray(P, ch, 8);
        if (!out.wall && h && h.t * P.distanceTo(ch) < P.distanceTo(ch) - 1 && h.t * P.distanceTo(ch) > 1.2) out.wall = { da: sg * k * Math.PI / 36, at: +(h.t * P.distanceTo(ch)).toFixed(2) };
        if (!out.inside && inside) out.inside = { da: sg * k * Math.PI / 36 }; }
      return out; })()`;
    const PICK = `(async () => { ${GEO} const c = window.__city, g = geo(), T = c.THREE, s = g.obj, ch = new T.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), cam = c.camera.position.clone(), R = c.renderer.domElement.getBoundingClientRect();
      const v = ch.clone().project(c.camera); if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return { onScreen: false };
      const h = await c.recordHomes.H.hitAt(R.left + (v.x + 1) / 2 * R.width, R.top + (1 - v.y) / 2 * R.height), d = cam.distanceTo(ch), W = c.cam.world, wall = W.ray(cam, ch, 8), inside = W.inside(cam, 8);
      const fade = await import('/style/city/camera/fade.js');
      return { onScreen: true, chestM: +d.toFixed(2), hitM: h ? +h.distanceTo(cam).toFixed(2) : null, visible: !h || h.distanceTo(cam) >= d - .5 || (Math.hypot(h.x - s.p[0], h.z - s.p[2]) < .75 && h.y > s.p[1] - .1 && h.y < s.p[1] + 2.1), hitOnPerson: !!h && Math.hypot(h.x - s.p[0], h.z - s.p[2]) < .75, wallM: wall ? +(wall.t * d).toFixed(2) : null, lensInside: inside, hole: fade.holeState() }; })()`;
    const turnTo = async da => { const s = 1 / (.0022 * 1.4 * (await B.ev('window.__city.cam.config.look.sens'))); let px = -da * s; while (Math.abs(px) > 1) { const k = Math.max(-380, Math.min(380, px)); await drag(B, CX - k / 2, CY, k, 0, 16); px -= k; await sleep(150); } };
    if (want('through')) {
      let f = await B.ev(FIND), wheels = 0; const res = {};
      // (no wall round them at this distance: zoom out a step with the wheel, real input, and look again)
      while (!f.wall && wheels < 6) { await wheel(B, CX, CY, 240); wheels++; await sleep(300); f = await B.ev(FIND); }
      res.wheels = wheels;
      if (f.wall) { await turnTo(f.wall.da); await sleep(1200); res.wall = await B.ev(PICK); res.wall.shot = await shot('lock-through-wall'); }
      if (f.inside) { const g = await B.ev(NOW); const f2 = await B.ev(FIND); if (f2.inside) { await turnTo(f2.inside.da); await sleep(1200); res.inside = await B.ev(PICK); res.inside.shot = await shot('lock-lens-inside'); } }
      const ok = !!res.wall && res.wall.onScreen && res.wall.wallM !== null && res.wall.visible && res.wall.hole.on && (!res.inside || (res.inside.onScreen && res.inside.visible));
      step('through', ok, { found: f, ...res });
    }
    // ── switch: Tab (the canvas has the focus: a click on empty ground first would follow nobody; the body has it after the drags)
    if (want('switch')) {
      await B.ev('(document.activeElement?.blur?.(), true)'); const s0 = await B.ev(NOW); await B.ev(START); await keyMod(B, 'Tab', 'Tab', 9); await sleep(1800); rows = await B.ev(STOP); const s1 = await B.ev(NOW);
      const moving = rows.filter((r, i) => i > 0 && r.camStep > .02 && r.same !== false), hop = { from: s0.piv, to: s1.piv };
      const clear = await B.ev(`(() => { const c = window.__city, T = c.THREE; return !c.cam.world.ray(new T.Vector3(...${JSON.stringify(s0.piv)}), new T.Vector3(...${JSON.stringify(s1.piv)}), 1); })()`);
      const glided = rows.filter(r => r.aid === s1.aid).length > 1 && moving.length > 2;
      await keyMod(B, 'Tab', 'Tab', 9, 8); await sleep(1800); const s2 = await B.ev(NOW);
      step('switch', s1.mode === 'lock' && s1.aid !== s0.aid && still(apart(s1, s0)) && (!glided || clear) && s2.mode === 'lock' && s2.aid === ID,
        { from: s0.aid, to: s1.aid, kept: apart(s1, s0), glided, lineClear: clear, hopM: r4(Math.hypot(hop.to[0] - hop.from[0], hop.to[2] - hop.from[2])), back: s2.aid });
    }
    // ── follow ↔ lock with the person walking (10×)
    if (want('follow')) {
      if (await B.ev('window.__record.player.speed') !== 10) await choose(B, '#record-player select[aria-label="Playback speed"]', 10);
      await typeMinute(B, 6479.95); await sleep(1500); await click(B, '#record-player button[aria-label="Play or pause"]');
      await B.ev(START); b = await card(B, 'follow'); if (b) await press(B, b); await sleep(1500); const f1 = await B.ev(NOW); rows = await B.ev(STOP);
      // (the hand-off: the switch frame and the rig's blend into follow; after it, follow's own motion — its holds and cuts at 10×,
      // follow.js's, unchanged here — is reported, not judged)
      const j0 = rows.findIndex(r => r.mode === 'follow'), j1 = j0 < 0 ? -1 : rows.findIndex((r, i) => i > j0 && !r.blend);
      const toF = j0 < 0 ? [] : rows.slice(j0, j1 < 0 ? rows.length : j1).filter(r => r.same && r.aid === ID), afterF = j1 < 0 ? [] : rows.slice(j1).filter(r => r.same && r.aid === ID);
      await B.ev(START); await key(B, '6', 'Digit6', 54); await sleep(1200); const f2 = await B.ev(NOW); const rows2 = await B.ev(STOP);
      const toL = rows2.filter(r => r.same && r.aid === ID && r.mode === 'lock');
      await click(B, '#record-player button[aria-label="Play or pause"]');
      step('follow', f1.mode === 'follow' && f1.aid === ID && f2.mode === 'lock' && f2.aid === ID && toF.length > 0 && handJumps(toF).length === 0 && max(toL, 'relStep') <= .05,
        { toFollow: { mode: f1.mode, spikes: spikes(toF), maxOffsetStep: r4(max(toF, 'relStep')), maxOffsetSpeed: r4(max(toF, 'relSpeed')), frames: toF.length, followOwnAfter: { spikes: spikes(afterF), maxOffsetStep: r4(max(afterF, 'relStep')), maxOffsetSpeed: r4(max(afterF, 'relSpeed')), frames: afterF.length } }, toLock: { mode: f2.mode, maxOffsetStep: r4(max(toL, 'relStep')), frames: toL.length } });
    }
    // ── 3 and 6 with the card closed
    if (want('key')) {
      await key(B, 'Escape', 'Escape', 27); await sleep(400); const cardOpen = await B.ev('window.__recordUI.dossier.isOpen');
      await key(B, '3', 'Digit3', 51); await sleep(800); const k1 = await B.ev(NOW); await key(B, '6', 'Digit6', 54); await sleep(800); const k2 = await B.ev(NOW);
      step('key', !cardOpen && k1.mode === 'follow' && k1.aid === ID && k2.mode === 'lock' && k2.aid === ID, { cardOpen, after3: [k1.mode, k1.aid], after6: [k2.mode, k2.aid] });
    }
    // the view for the frames step: Lock on with the hole cutting a wall (the see-through bearing)
    if (want('frames')) { const f = await B.ev(FIND); if (f.wall) { await turnTo(f.wall.da); await sleep(800); }
      view = await B.ev(`(() => { const c = window.__city, p = c.camera.position, s = c.cam.subject, fade = null; return { cam: [p.x, p.y, p.z].map(v => +v.toFixed(2)), look: [s.p[0], s.p[1] + 1.4, s.p[2]].map(v => +v.toFixed(2)), wall: !!c.cam.world.ray(p, new c.THREE.Vector3(s.p[0], s.p[1] + 1.25, s.p[2]), 8) }; })()`); }
    // ── reload: the keeper's way back (?follow=&lock=1): Lock at the viewer's kept angle and distance
    if (want('reload')) {
      const r0 = await B.ev(NOW); await sleep(600);
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=day&recordAt=6420.1&recordPaused=1&recordSpeed=1&follow=${ID}&lock=1` });
      await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(1500)]); await ready(B, 240000);
      let r1 = null; for (let t = 0; t < 60; t++) { r1 = await B.ev(NOW); if (r1.mode === 'lock' && r1.aid === ID) break; await sleep(250); } await sleep(500); r1 = await B.ev(NOW);
      const k = apart(r1, r0);
      step('reload', r1.mode === 'lock' && r1.aid === ID && k.az <= 2e-3 && k.el <= 2e-3 && k.d <= 2e-3, { mode: r1.mode, aid: r1.aid, kept: k, url: await B.ev(`location.search.match(/(follow|lock)=[^&]*/g)`) });
    }
    // ── frames: Lock on (hole cutting a wall) at 10× vs the same view with no sim
    if (want('frames') && view) {
      const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`);
      const pair = async () => {
        await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=day&recordAt=6479.95&recordSpeed=10&follow=${ID}&lock=1` });
        await sleep(1500); await Promise.race([B.send('Page.handleJavaScriptDialog', { accept: true }), sleep(1500)]); await ready(B, 240000);
        for (let t = 0; t < 60 && (await B.ev(NOW)).mode !== 'lock'; t++) await sleep(250); await sleep(3000);
        const lockOn = { ...(await measure()), mode: (await B.ev(NOW)).mode, hole: await B.ev(`import('/style/city/camera/fade.js').then(m => m.holeState())`) };
        await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?cam=${view.cam.join(',')}&look=${view.look.join(',')}&tod=day` });
        for (let t = 0; t < 240 && !(await B.ev(`document.title`, false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
        await sleep(5000); return { lock: lockOn, noSim: await measure() };
      };
      const pass = x => x.lock.mode === 'lock' && (x.lock.p95 <= 16.8 || x.lock.p95 <= 1.15 * x.noSim.p95);
      let f = await pair(); const first = f; if (!pass(f)) f = await pair();
      step('frames', pass(f), { lock: f.lock, noSim: f.noSim, firstTry: first === f ? null : first, view, bar: '≤ 16.8 ms or ≤ 1.15 × no-sim' });
    }
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } catch (e) { step('run', false, { error: String(e?.stack || e) }); }
  finally { await B.close(); if (served) served.kill(); }
  const ok = report('lockcheck', steps, await writeResult(OUT, { steps, shots }));
  process.exitCode = ok ? 0 : 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
