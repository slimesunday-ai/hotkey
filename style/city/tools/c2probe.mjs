// C2 · FOLLOWING AN AGENT ACROSS 9:05 (GAME.md §41, slime 10-30: "you go to follow an agent from the start and they just vanish... no one
// wants to watch people drop off screen"). Headless Chrome on ?sim=record, the record played at --speed from just before a night's show
// to after its last ride, the camera following each agent in --ids in turn (camera/rig.js follow, the viewer's own mode). Per frame, for
// every followed agent: where its walker is drawn, whether it is drawn at all, its look's outfit, and what the drawing says it is doing
// (draw.js stateAt: a trip, a ride, hidden). It counts, per agent:
//   jumps     a walker drawn further from its last frame's place than its travel allows (2 m, plus 20 m/s on a trip's legs or 3 m/s
//             otherwise, times the frame's island seconds: seekscenario's own allowance), seeks excluded
//   vanished  frames with no walker drawn while the drawing has the agent on the street (not hidden, not riding the cruiser), by what it
//             was doing then (a trip's mode: a subway or a cab ride is movement.js's to draw)
//   hood      the minutes its outfit was 'hooded'
// and shoots the moments --at lists for each (labels from the drawing: departure, mid-trip, arrival, the mask-up, its scenes, the ride,
// the yard) into --out, one 2×4 contact sheet per agent (tools/sheet: a page of the shots, captioned).
//   node style/city/tools/c2probe.mjs --port 5987 --seed 404 --night 4 --ids a04,a05 [--speed 10] [--cam follow|over] [--out style/city/shots/c2-continuity]
//     [--legs] (C2-follow: also the middle of each leg ridden: the stairs, the platform, the subway, a board, a scooter, a cab)
//     [--press] (C2-follow: follow the player's way: a real click on the agent opens its card, F presses Follow)
// --cam over: each shot from the orbit camera put over the agent (the follow cam's own framing is its builder's and slime's)
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const CAM = arg('cam', 'follow'), PORT = +arg('port', 5987), SEED = +arg('seed', 404), NIGHT = +arg('night', 4), IDS = arg('ids', 'a04').split(','), SPEED = +arg('speed', 10);
const LEGS = process.argv.includes('--legs'), PRESS = process.argv.includes('--press');
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-continuity'))), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}:${String(Math.floor((x % 1) * 60)).padStart(2, '0')}`; };

// the moments to shoot for one agent, from the drawing itself (draw.js: its timeline, trip rule, masks and the night's plan)
const MOMENTS = (id, n) => `(() => { const D = window.__record.draw, plan = D.planner.night(${n}), L = D.timeline.segs.get(${JSON.stringify(id)}) || [], out = [];
  const i0 = L.findIndex(s => s.start >= plan.start - 1e-6); if (i0 < 0) return out;
  for (let i = i0; i < L.length && L[i].start <= plan.end + 1e-6; i++) { const d = D.rule ? D.rule.at(${JSON.stringify(id)}, i) : (() => { const s = D.stateAt(${JSON.stringify(id)}, L[i].start + .01); return s.trip ? { dep: s.trip.dep, trip: s.trip, jail: false } : null; })();
    if (d?.trip) { const lab = d.jail ? 'the cruiser' : d.trip.mode;
      out.push({ m: d.dep + .03, label: (d.jail ? 'cuffed, to the cruiser' : 'departure (' + lab + ')') });
      out.push({ m: d.jail ? Math.min(d.trip.arr - .05, d.dep + .3 + (d.trip.arr - d.dep - .3) / 2) : (d.dep + d.trip.arr) / 2, label: d.jail ? 'riding to Iron Island' : 'mid-trip (' + lab + ')' });
      out.push({ m: d.trip.arr + .08, label: d.jail ? 'Iron Island' : 'arrived' });
      // (C2-follow, --legs: the middle of each leg a follower rides through: the stairs, the platform, the ride, a board or a scooter)
      if (${LEGS} && !d.jail) for (const l of d.trip.legs || []) if (['stairs', 'wait', 'subway', 'skate', 'scooter', 'bike', 'taxi'].includes(l.kind)) {
        const lab = l.kind === 'stairs' ? (l.dir === 'up' ? 'up the stairs' : 'down the stairs') : l.kind === 'wait' ? 'waiting (' + d.trip.mode + ')' : l.kind === 'subway' ? 'riding the subway' : l.kind;
        if (l.kind === 'subway') { out.push({ m: l.dep + (l.arr - l.dep) * .3, label: lab }); out.push({ m: l.dep + (l.arr - l.dep) * .7, label: lab }); } else out.push({ m: (l.dep + l.arr) / 2, label: lab }); } } }
  for (const w of D.masks?.get(${JSON.stringify(id)}) || []) if (w.night === ${n}) out.push({ m: w.on + .01, label: 'the mask-up' });
  for (const sc of plan.scenes) { const cast = D.casts?.get(${n})?.byScene.get(sc.id) || [];
    if ((sc.publicActors.includes(${JSON.stringify(id)}) || cast.includes(${JSON.stringify(id)})) && sc.kind !== 'arrival') out.push({ m: sc.start + (sc.end - sc.start) * .45, label: sc.kind + (cast.includes(${JSON.stringify(id)}) ? ', hooded' : '') }); }
  return out.sort((a, b) => a.m - b.m); })()`;
// per frame: the followed agents' walkers and what the drawing says
const SAMPLER = ids => `(() => { const D = window.__record.draw, P = window.__record.player, W = window.__c2 = { rows: {}, done: false, last: {} }, ids = ${JSON.stringify(ids)};
  for (const id of ids) W.rows[id] = { frames: 0, jumps: [], vanished: {}, hood: 0, drawn: 0, maxStep: 0 };
  let m0 = P.minute, t0 = performance.now(); W.long = [];
  const f = () => { if (W.done) return; const m = P.minute, dm = m - m0, now = performance.now(); m0 = m; if (now - t0 > 120) W.long.push([+m.toFixed(3), Math.round(now - t0)]); t0 = now;
    for (const id of ids) { const R = W.rows[id], a = D.agents.map.get(id), s = D.stateAt(id, m), w = a?.w, last = W.last[id]; R.frames++;
      if (a?.rec?.outfit === 'hooded') R.hood += Math.max(0, dm);
      const street = !s.hidden;
      if (w) { R.drawn++; const p = [w.p[0], w.p[2]];
        if (last && dm >= 0 && dm < .05) { const d = Math.hypot(p[0] - last[0], p[1] - last[1]), allow = 2 + (a.mode === 'leg' || s.trip ? 20 : 3) * dm * 60;
          R.maxStep = Math.max(R.maxStep, d); if (d > allow) R.jumps.push([+m.toFixed(3), +d.toFixed(2), a.mode, s.trip ? s.trip.mode : s.ride ? 'ride' : 'place', last.map(v => +v.toFixed(1)), p.map(v => +v.toFixed(1)), +(dm * 60).toFixed(2)]); }
        W.last[id] = p; }
      else { W.last[id] = null; if (street) { const k = s.trip ? 'trip:' + s.trip.mode : s.ride ? 'ride:walk-to-car' : 'at ' + s.place; R.vanished[k] = (R.vanished[k] || 0) + 1; } } }
    requestAnimationFrame(f); }; requestAnimationFrame(f); return true; })()`;

async function main() {
  const served = await serve(); const B = await chrome(); const report = {};
  try {
    await fs.mkdir(OUT, { recursive: true });
    const start = NIGHT * 1440 + 1265 - .5;
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=night&recordAt=${start}&recordSpeed=${SPEED}&recordPaused=1` });
    await ready(B, 180000); await sleep(3000);
    for (const id of IDS) {
      const moments = await B.ev(MOMENTS(id, NIGHT)); const files = [], refollows = [];
      // (back to just before the show, paused; follow the agent; then play through its moments)
      await B.ev(`(() => { const P = window.__record.player; P.pause(); P.seek(${start}); return true; })()`); await sleep(2500);
      // (--press: the player's way, a real click on the agent opens its card and F presses Follow; c2lib's clickAgent)
      if (CAM === 'follow' && PRESS) { const { clickAgent, key } = await import('./c2lib.mjs'); let on = false;
        for (let k = 0; k < 3 && !on; k++) { if (await clickAgent(B, id).catch(() => null) === id) { await key(B, 'f', 'KeyF', 70); await sleep(1200); }
          on = await B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(id)}; })()`); }
        console.log(id, on ? 'followed: card + F' : 'card + F did not follow'); }
      else if (CAM === 'follow') { await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(id)}); if (!a?.w) return false; window.__city.cam.setMode('follow', { subject: a.w }); return true; })()`); await sleep(2500); }
      else await B.ev(`(() => { window.__city.cam?.setMode?.('orbit'); return true; })()`);
      await B.ev(SAMPLER([id]));
      await B.ev(`window.__record.player.play()`);
      const t0 = Date.now(), end = Math.max(...moments.map(x => x.m)) + .3;
      for (const [k, mo] of moments.entries()) {
        while (Date.now() - t0 < 900000) { const m = await B.ev('window.__record.player.minute'); if (m >= mo.m) break; await sleep(m < mo.m - .5 ? 200 : 30); }
        // (a camera that lost its subject — the agent gone from view, a subway's kiosk — has gone on to someone else: the viewer finds
        // the agent again, as a click on it would; counted)
        // (--cam over: the orbit camera put over the agent, 7 m up and 9 m back — its walker, else the cruiser it rides in)
        if (CAM === 'over') { await B.ev(`(() => { const D = window.__record.draw, a = D.agents.map.get(${JSON.stringify(id)}), car = D.scenes?.rides?.get(${JSON.stringify(id)})?.car;
          const p = a?.w ? [a.w.p[0], a.w.p[2]] : car?.visible ? [car.position.x, car.position.z] : null; if (!p) return false; const c = window.__city;
          c.controls.target.set(p[0], .6, p[1]); c.camera.position.set(p[0] + 4, 7, p[1] + 9); c.controls.update?.(); return true; })()`); await sleep(700); }
        const re = CAM === 'follow' && await B.ev(`(() => { const c = window.__city.cam, a = window.__record.draw.agents.map.get(${JSON.stringify(id)}); if (c.subject?.aid === ${JSON.stringify(id)} || !a?.w) return false; c.setMode('follow', { subject: a.w }); return true; })()`);
        if (re) { refollows.push(+(await B.ev('window.__record.player.minute')).toFixed(2)); await sleep(1200); }
        const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }), file = path.join(OUT, `${SEED}-n${NIGHT}-${id}-${CAM}-${String(k).padStart(2, '0')}.jpg`);
        await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); const m = await B.ev('window.__record.player.minute');
        const sub = await B.ev(`(() => { const c = window.__city.cam; return c.mode + ':' + (c.subject?.aid ?? c.subject?.id ?? null) + (c.subject?.ride ? ' (its ride\'s stand-in: the cruiser, a cab, the subway)' : ''); })()`);
        files.push({ file, label: `${id} · ${hhmm(m)} · ${mo.label}`, cam: sub });
      }
      while (Date.now() - t0 < 900000 && await B.ev('window.__record.player.minute') < end) await sleep(200);
      await B.ev(`window.__record.player.pause()`);
      const W = await B.ev(`(() => { window.__c2.done = true; for (const k in window.__c2.rows) { window.__c2.rows[k].long = window.__c2.long.slice(0, 20); window.__c2.rows[k].lateSnaps = (window.__record.draw.lateSnaps || []).filter(x => x[0] === k); } return window.__c2.rows; })()`);
      report[id] = { ...W[id], hood: +W[id].hood.toFixed(2), jumps: W[id].jumps.slice(0, 12), nJumps: W[id].jumps.length, maxStep: +W[id].maxStep.toFixed(2), refollows, shots: files };
      console.log(id, JSON.stringify({ frames: W[id].frames, drawn: W[id].drawn, nJumps: W[id].jumps.length, jumps: W[id].jumps.slice(0, 6), vanished: W[id].vanished, hoodMinutes: +W[id].hood.toFixed(2), maxStep: +W[id].maxStep.toFixed(2), refollows, longFrames: W[id].long, lateSnaps: W[id].lateSnaps }));
      for (const f of files) console.log('   ', path.relative(ROOT, f.file), '·', f.label, '·', f.cam);
    }
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
    const logs = B.logs.filter(l => /record c2|record ride|record scene|not cast/.test(l)).slice(0, 12); if (logs.length) console.log('page log:', logs);
    await fs.writeFile(path.join(OUT, `${SEED}-n${NIGHT}-${CAM}-probe.json`), JSON.stringify(report, null, 1));
    // the contact sheet: one page of every shot, captioned, shot by the same Chrome
    const tiles = Object.values(report).flatMap(r => r.shots);
    const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#eee;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${tiles.map(t => `<figure style="margin:0"><img src="data:image/jpeg;base64,${''}" data-f="${path.basename(t.file)}" style="width:100%"><figcaption>${t.label}</figcaption></figure>`).join('')}</div></body></html>`;
    const sheet = path.join(OUT, `${SEED}-n${NIGHT}-${CAM}-sheet.html`);
    let page = html; for (const t of tiles) page = page.replace(`src="data:image/jpeg;base64," data-f="${path.basename(t.file)}"`, `src="data:image/jpeg;base64,${(await fs.readFile(t.file)).toString('base64')}"`);
    await fs.writeFile(sheet, page);
    const rows = Math.ceil(tiles.length / 4);
    await B.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: Math.max(400, rows * 290 + 20), deviceScaleFactor: 1, mobile: false });
    await B.send('Page.navigate', { url: 'file://' + sheet }); await sleep(1500);
    const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true });
    await fs.writeFile(path.join(OUT, `${SEED}-n${NIGHT}-${CAM}-sheet.jpg`), Buffer.from(r.result.data, 'base64')); await fs.rm(sheet);
    console.log('sheet', path.relative(ROOT, path.join(OUT, `${SEED}-n${NIGHT}-${CAM}-sheet.jpg`)));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
