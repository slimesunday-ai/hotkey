// C2-camera4 · A BLANK FRAME ON A CLOCK OF OUR OWN (followprobe's blank: the canvas read back at 40×25 right after the render, luminance
// spread < 2.5). followprobe's blank comes and goes with the page's frame timing (a05 at 6661.18–6661.27: 3 of 3 full runs on one tree,
// 0 of 3 on another). Here the page's frame clock is ours: every requestAnimationFrame callback is handed a VIRTUAL timestamp that
// advances by --dt ms a frame (and, with --drop p, by 2 × --dt on a seeded share p of frames: a missed vsync), whatever the machine does,
// (the drops counted from the press of play, so the frames a load takes don't move them), so a run is the same run again under any load, and a sweep over --seed / --dt / --drop walks through the frame timings a real page meets.
// The page is opened at --from with ?follow=<id> (or, with --card, the agent's card and F, followprobe's way), played at followprobe's
// speeds (--busy on the agent's trips and the show, --quiet between) to --to. Every frame is read back; from --w0 each frame keeps a row
// (the camera, the follow's state, the person, the collision world at the lens and on the line to the chest).
//   node style/city/tools/blankrepro.mjs --port 5960 --id a05 --from 6655 --to 6661.5 [--w0 6660.6] [--dt 16.667] [--drop 0] [--seed 1]
//     [--ids a04,a05 (in place of --id: each agent --runs times)] [--wins a18:6181.6-6181.9,…: rows kept in these minutes too] [--runs 1] [--par 1] [--card] [--real] [--busy 10] [--quiet 60] [--stills a,b] [--out <dir>] [--tag repro]
// Prints per run: blank frames (first, last minute), the follow's cuts and holds, its cuts by the wall test (follow dbg `walled`, C2-camera4) and
// those under 1 s apart, and writes <out>/<tag>-<id>-s<seed>.json (the rows).
// Exit 1 when any run has a blank frame. It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5960), SEED = +arg('seed', 1), ID = arg('id', 'a05'), FROM = +arg('from', 6655), TO = +arg('to', 6661.5), W0 = +arg('w0', TO - .9);
const DT = +arg('dt', 1000 / 60), DROP = +arg('drop', 0), RUNS = +arg('runs', 1), PAR = +arg('par', 1), CARD = process.argv.includes('--card'), REAL = process.argv.includes('--real');
const WINS = (arg('wins', '') || '').split(',').filter(Boolean).map(x => { const [id, r] = x.split(':'); const [a, b] = r.split('-').map(Number); return [id, a, b]; }), STILLS = arg('stills', null)?.split(',').map(Number) ?? null, BUSY = +arg('busy', 10), QUIET = +arg('quiet', 60), TAG = arg('tag', 'repro'), OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera4'))), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };

// (in the page, before its own scripts: the virtual frame clock. One timestamp per real frame — every callback of a frame gets the same)
const CLOCK = (dt, drop, seed) => `(() => { const real = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
  let rng = (${seed} * 2654435761) >>> 0 || 1; const rnd = () => { rng ^= rng << 13; rng >>>= 0; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0; return rng / 4294967296; };
  const V = window.__vclock = { t: null, n: 0, drops: 0, lastReal: null, on: false, go() { rng = (${seed} * 2654435761) >>> 0 || 1; V.on = true; V.n = 0; V.drops = 0; } };
  const at = ts => { if (ts !== V.lastReal) { V.lastReal = ts; if (V.t === null) V.t = ts; else { const k = V.on && ${drop} > 0 && rnd() < ${drop} ? 2 : 1; if (k > 1) V.drops++; V.t += ${dt} * k; } V.n++; } return V.t; };
  window.requestAnimationFrame = cb => real(ts => cb(at(ts)));
  window.cancelAnimationFrame = id => cancel(id); })();`;

// (followprobe's windows, as it has them)
function windows(id, from, to) {
  const D = window.__record.draw, L = D.timeline.segs.get(id) || [], out = [];
  for (let i = 0; i < L.length; i++) { if (L[i].start > to) break; const d = D.rule.at(id, i); if (!d?.trip) continue; const a = d.dep - 1, b = Math.max(d.trip.arr, d.dep) + 1; if (b >= from) out.push([a, b, d.trip.mode]); }
  for (let n = Math.floor(from / 1440); n <= Math.floor(to / 1440); n++) { try { const p = D.planner.night(n); if (p && p.end >= from && p.start <= to) out.push([p.start - 1, p.end + 1, 'show']); } catch {} }
  return out.sort((x, y) => x[0] - y[0]);
}
async function sampler(id, o) {
  const c = window.__city, D = window.__record.draw, P = window.__record.player, gl = c.renderer.domElement, T = c.THREE, FW = new T.Vector3(), Wm = await import('/style/city/camera/world.js');
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 25; const cx = cv.getContext('2d', { willReadFrequently: true });
  const H = window.__br = { rows: [], blank: [], ev: [], done: false, frames: 0, cutsBusy: 0, minBusy: 0, holdsBusy: 0 };
  const inWin = m => o.win.some(([a, b]) => m >= a && m < b), r2 = v => +v.toFixed(2);
  let lastCuts = null, lastHolds = null, lastWalled = null, lastWC = null, lastM = null, lastSp = 0;
  const f = () => { if (H.done) return; const m = P.minute; H.frames++;
    { const sp = inWin(m) ? o.busy : o.quiet; if (P.running && P.speed !== sp) P.setSpeed(sp); } if (P.running && m >= o.to) { P.pause(); H.done = true; }
    const car = c.subway?.openFor === id ? c.subway.open : null, shown = car?.view?.renderer?.domElement || gl;
    cx.drawImage(shown, 0, 0, 40, 25); const px = cx.getImageData(0, 0, 40, 25).data; let s1 = 0, s2 = 0, r = 0, g = 0, b = 0;
    for (let k = 0; k < px.length; k += 4) { const L = .2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]; s1 += L; s2 += L * L; r += px[k]; g += px[k + 1]; b += px[k + 2]; }
    const sd = Math.sqrt(Math.max(0, s2 / 1000 - (s1 / 1000) ** 2)), g2 = c.cam.follow?.dbg;
    if (g2) { if (lastCuts !== null && lastSp === o.busy) { H.cutsBusy += g2.cuts - lastCuts; H.holdsBusy += g2.holds - lastHolds; }
      // (every cut and every cut of the wall test, C2-camera4: the minute and the page's own clock, s)
      const ps = +((window.__vclock?.t ?? performance.now()) / 1000).toFixed(3);
      if (lastCuts !== null && g2.cuts > lastCuts) H.ev.push(['cut', +m.toFixed(4), ps, P.speed]); if (lastWalled !== null && (g2.walled ?? 0) > lastWalled) H.ev.push(['walled', +m.toFixed(4), ps, P.speed, (g2.walledCut ?? g2.walled) > (lastWC ?? 0) ? 'cut' : 'snap', +(g2.snapM ?? 0).toFixed(2)]);
      // (--stills a,b: the frame before and the frame of the first snap onto the arm between minutes a and b, as the viewer saw them)
      if (o.stills && m >= o.stills[0] && m <= o.stills[1]) { const snap = lastWalled !== null && (g2.walled ?? 0) > lastWalled && !((g2.walledCut ?? g2.walled) > (lastWC ?? 0));
        if (snap && !H.stillDone) { H.stillDone = true; H.stills = [{ m: H.prevPng?.m ?? null, png: H.prevPng?.png ?? null, what: 'before' }, { m: +m.toFixed(4), png: shown.toDataURL('image/png'), what: 'after' }]; }
        else if (!H.stillDone) H.prevPng = { m: +m.toFixed(4), png: shown.toDataURL('image/png') }; }
      lastCuts = g2.cuts; lastHolds = g2.holds; lastWalled = g2.walled ?? 0; lastWC = g2.walledCut ?? g2.walled ?? 0; }
    { const dm = m - (lastM ?? m); if (lastSp === o.busy && dm > 0 && dm < .5) H.minBusy += dm; lastM = m; lastSp = P.running ? P.speed : 0; }
    const blank = sd < 2.5;
    const kept = m >= o.w0 || (o.wins || []).some(([a, b]) => m >= a && m <= b);
    if (kept || blank) {
      const cam = c.camera, p = cam.position; FW.set(0, 0, -1).applyQuaternion(cam.quaternion); const sub = c.cam.subject, W = c.cam.world;
      const chest = sub ? { x: sub.p[0], y: sub.p[1] + 1.25, z: sub.p[2] } : null, dC = chest ? Math.hypot(chest.x - p.x, chest.y - p.y, chest.z - p.z) : 0;
      const hit = chest && W ? W.ray(p, chest, Wm.STATIC_WIDE) : null, ov = W ? W.overlap(p, .1, Wm.STATIC_WIDE | Wm.CARS) : null;
      const pv = g2?.Pv, hitPv = pv && chest && W ? W.ray({ x: pv[0], y: pv[1], z: pv[2] }, chest, Wm.STATIC_WIDE) : null;
      const row = { m: +m.toFixed(4), vt: window.__vclock?.t ?? null, sd: r2(sd), rgb: [r / 1000 | 0, g / 1000 | 0, b / 1000 | 0], mode: c.cam.mode, blend: !!c.cam.blending, on: !!sub && sub.aid === id, speed: P.speed,
        cam: [p.x, p.y, p.z].map(r2), fwd: [FW.x, FW.y, FW.z].map(r2), sub: sub ? [sub.p[0], sub.p[1], sub.p[2]].map(r2) : null, vc: sub ? r2(sub.vc ?? 0) : null,
        world: W ? { tier: W.tierAt(p.x, p.z), ready: W.ready(p.x, p.z), inWall: ov ? r2(ov.depth) : null, dist: r2(W.distance(p, 2, Wm.STATIC_WIDE)), toChest: hit ? r2(hit.t * dC) : null, chestD: r2(dC), pvToChest: hitPv ? r2(hitPv.t) : null } : null,
        f: g2 ? { L: g2.L.map(r2), Pv: g2.Pv?.map(r2), piv: g2.pivot.map(r2), arm: r2(g2.arm), Ls: r2(g2.dist), armColl: r2(g2.armColl), vis: r2(g2.vis), hold: g2.hold, coupled: g2.coupled, held: r2(g2.held), hOcc: r2(g2.hOcc ?? 0), relT: r2(g2.relT ?? 0), cool: r2((g2.now ?? 0) - (g2.cutAt ?? 0)), aim: g2.aim, as: g2.assist, dodge: r2(g2.dodge), lift: r2(g2.lift), cuts: g2.cuts, holds: g2.holds, enter: g2.enter, room: g2.room?.src } : null };
      if (kept) H.rows.push(row);
      if (blank) H.blank.push(row); }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}

async function one(seed, ID) {
  const B = await chrome(), R = { seed, blank: [], rows: [], ev: [], how: null, reloads: 0 };
  try {
    if (!REAL) await B.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK(DT, DROP, seed) });
    const url = q => `${BASE}/style/city/index.html?sim=record&feed=/core/runs/404-A/feed.jsonl&tod=${tod(FROM)}&recordAt=${FROM}&recordSpeed=${QUIET}&recordPaused=1${q}`;
    if (CARD) { await B.send('Page.navigate', { url: url('') }); await ready(B, 240000); await sleep(3000);
      const { clickAgent, key } = await import('./c2lib.mjs'); const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}; })()`);
      let on = false; for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, ID).catch(() => null); if (card === ID) { await key(B, 'f', 'KeyF', 70); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(2000); }
      R.how = on ? 'card + F' : null; }
    if (!R.how) { await B.send('Page.navigate', { url: url('&follow=' + ID) }); await ready(B, 240000); await sleep(3000);
      for (let k = 0; k < 40; k++) { if (await B.ev(`window.__city.cam?.mode === 'follow' && window.__city.cam?.subject?.aid === ${JSON.stringify(ID)}`).catch(() => false)) break; await sleep(250); } R.how = '?follow='; }
    const inject = async () => { const win = await B.ev(`(${windows})(${JSON.stringify(ID)}, ${FROM}, ${TO})`); R.win = win.filter(w => w[1] >= FROM && w[0] <= TO); return B.ev(`(${sampler})(${JSON.stringify(ID)}, ${JSON.stringify({ win, busy: BUSY, quiet: QUIET, to: TO, w0: W0, stills: STILLS, wins: WINS.filter(w => w[0] === ID).map(w => [w[1], w[2]]) })})`); };
    await inject(); await B.ev('window.__vclock?.go(); window.__record.player.play()');
    let origin = await B.ev('performance.timeOrigin');
    for (const t0 = Date.now(); Date.now() - t0 < 3600e3;) { await sleep(500);
      const o = await B.ev('performance.timeOrigin', false, 20000).catch(() => null); if (o === null) continue;
      if (o !== origin) { origin = o; R.reloads++; R.prev = { cutsBusy: R.cutsBusy ?? 0, holdsBusy: R.holdsBusy ?? 0, minBusy: R.minBusy ?? 0 }; await ready(B, 240000).catch(() => {}); await inject(); continue; }
      const d = await B.ev('(() => { const H = window.__br; if (!H) return null; const r = { rows: H.rows, blank: H.blank, ev: H.ev, stills: H.stills || null, done: H.done, cutsBusy: H.cutsBusy, holdsBusy: H.holdsBusy, minBusy: H.minBusy, m: window.__record.player.minute, vc: window.__vclock && { n: window.__vclock.n, drops: window.__vclock.drops } }; H.rows = []; H.blank = []; H.ev = []; H.stills = null; return r; })()', false, 20000).catch(() => null);
      // (a page whose minute stops moving for 60 s, or whose sampler stopped: given up, with its errors)
      if (d && d.m !== R.mSeen) { R.mSeen = d.m; R.mAt = Date.now(); } else if (Date.now() - (R.mAt ?? Date.now()) > 60000) { R.error = `stalled at ${R.mSeen}: ${JSON.stringify(B.errors.slice(0, 2))} ${JSON.stringify(B.logs.slice(-3))}`; break; }
      if (!d) continue; R.rows.push(...d.rows); R.blank.push(...d.blank); R.ev.push(...d.ev); if (d.stills) R.stills = d.stills; R.cutsBusy = (R.prev?.cutsBusy ?? 0) + d.cutsBusy; R.holdsBusy = (R.prev?.holdsBusy ?? 0) + d.holdsBusy; R.minBusy = (R.prev?.minBusy ?? 0) + d.minBusy; R.vc = d.vc; R.m = d.m; if (d.done) break; }
    R.errors = B.errors.slice(0, 3);
  } catch (e) { R.error = String(e?.message || e); }
  finally { await B.close(); }
  return R;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), IDS = arg('ids', ID).split(','), seeds = IDS.flatMap(id => Array.from({ length: RUNS }, (_, i) => [id, SEED + i])), res = []; let next = 0, bad = false;
  try {
    await Promise.all(Array.from({ length: Math.min(PAR, seeds.length) }, async () => { while (next < seeds.length) { const [ID, s] = seeds[next++], t0 = Date.now(); const R = await one(s, ID); R.secs = Math.round((Date.now() - t0) / 1000); res.push(R);
      const b = R.blank, f = b[0], l = b[b.length - 1]; if (b.length || R.error) bad = true;
      console.log(`${ID} seed ${s} ${R.how} ${R.secs} s → ${R.m?.toFixed?.(3)}${R.error ? ' ERROR ' + R.error : ''} · vclock ${REAL ? 'off' : `${DT.toFixed(3)} ms, drop ${DROP} (${R.vc?.drops ?? '?'} of ${R.vc?.n ?? '?'} frames)`} · blank ${b.length}${b.length ? ` (${f.m} → ${l.m}, rgb ${JSON.stringify(f.rgb)}, sd ${f.sd})` : ''} · at ${BUSY}×: ${R.cutsBusy} cuts, ${R.holdsBusy} holds in ${(R.minBusy ?? 0).toFixed(2)} island min`);
      { const W = R.ev.filter(e => e[0] === 'walled'), WC = W.filter(e => e[4] === 'cut'), gap = L => L.filter((e, i) => i && e[2] - L[i - 1][2] < 1 && e[2] > L[i - 1][2]), loops = L => L.filter((e, i) => i >= 2 && e[2] - L[i - 2][2] < 1 && e[2] > L[i - 2][2]).map(e => e[1]);
        console.log(`  ${ID} cuts ${R.ev.filter(e => e[0] === 'cut').length} · the wall test fired ${W.length} (at ${BUSY}×: ${W.filter(e => e[3] === BUSY).length}): ${WC.length} cuts, ${W.length - WC.length} snaps onto the arm${W.length ? ' at ' + JSON.stringify(W.slice(0, 12).map(e => [e[1], e[4]])) : ''}; under 1 s after the last (the page's clock): firings ${gap(W).length}, cuts ${gap(WC).length}${gap(WC).length ? ' ' + JSON.stringify(gap(WC).slice(0, 8).map(e => e[1])) : ''}; largest snap ${Math.max(0, ...W.filter(e => e[4] === 'snap').map(e => e[5] ?? 0))} m; 3+ snaps within 1 s: ${loops(W.filter(e => e[4] === 'snap')).length}${loops(W.filter(e => e[4] === 'snap')).length ? ' at ' + JSON.stringify(loops(W.filter(e => e[4] === 'snap')).slice(0, 6)) : ''}`);
        for (const x of R.stills || []) if (x.png) { const f = path.join(OUT, `${TAG}-${ID}-s${s}-${x.what}-${x.m}.png`); await fs.writeFile(f, Buffer.from(x.png.split(',')[1], 'base64')); console.log('  saved', f); delete x.png; } }
      await fs.writeFile(path.join(OUT, `${TAG}-${ID}-s${s}.json`), JSON.stringify({ args: { FROM, TO, W0, DT, DROP, REAL, CARD, BUSY, QUIET }, ...R })); } }));
  } finally { if (served) served.kill(); }
  console.log(`${bad ? 'BLANKREPRO BLANK' : 'BLANKREPRO CLEAR'} · ${res.filter(r => r.blank.length).length} of ${res.length} runs with a blank frame · ${path.relative(ROOT, OUT)}/${TAG}-${ID}-s*.json`);
  process.exitCode = bad ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
