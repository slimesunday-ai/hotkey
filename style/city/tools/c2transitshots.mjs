// C2-transit · WHAT A FOLLOWER SEES ON THE SUBWAY (GAME.md §41, slime 10-31: "We already created an inside the carriage subway scene").
// Headless Chrome on ?sim=record: the agent's card opened with a real click and Follow pressed with F (the player's way; ?follow= if it is
// not drawn), then the record played at --speed without a seek through the agent's first subway trip on --night, shot at the moments a
// follower meets: the walk to the station, down the stairs, the platform (the carriage opening), mid-ride, each change, the last stretch,
// up the stairs, the walk out — the record paused at each (the viewer's Pause) for the shot, then played on. Per shot: what the camera is
// on and whether the carriage is open on this agent (its program second). One contact sheet.
//   node style/city/tools/c2transitshots.mjs --port 5984 [--seed 404] [--night 4] [--id a04] [--speed 10] [--out style/city/shots/c2-transit]
//     [--only platform,mid-ride: the moments whose label has one of these words] [--tag <name>: in the files' names]
// Per shot also: what is under the pointer at the carriage's × and at the agent's card and the ticker (the record's panels over the car)
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5984), SEED = +arg('seed', 404), NIGHT = +arg('night', 4), ID = arg('id', 'a04'), SPEED = +arg('speed', 10);
const ONLY = arg('only', null)?.split(',') ?? null, TAG = arg('tag', '');
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-transit'))), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };
const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}:${String(Math.floor((x % 1) * 60)).padStart(2, '0')}`; };
const url = (at, q = '') => `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(at)}&recordAt=${at}&recordSpeed=${SPEED}&recordPaused=1${q}`;

// the agent's first subway trip departing on that night's island day (from 06:00 that day to 06:00 the next), from the drawing itself
const RIDE = `(() => { const D = window.__record.draw, L = D.timeline.segs.get(${JSON.stringify(ID)}) || [], a = ${NIGHT * 1440 + 360}, b = a + 1440;
  for (let i = 0; i < L.length; i++) { const d = D.rule.at(${JSON.stringify(ID)}, i); if (d?.trip?.legs?.some(l => l.kind === 'subway') && d.dep >= a && d.dep < b) return { dep: d.dep, arr: d.trip.arr, legs: d.trip.legs.map(l => ({ kind: l.kind, dep: l.dep, arr: l.arr, dir: l.dir ?? null, from: l.from, to: l.to, transfer: !!l.transfer, line: l.line ?? null })) }; } return null; })()`;
const STATE = `(() => { const c = window.__city.cam, s = c?.subject, sub = window.__city.subway, a = window.__record.draw.agents.map.get(${JSON.stringify(ID)});
  const under = sel => { const n = document.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); if (!r.width) return null; const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e ? (e.closest('.sbw') ? 'carriage' : e.closest('#k, #record-player') ? 'panels' : e.tagName) : null; };
  return { hits: { x: under('.sbw-x'), card: under('#k .k-panel, #k .r-panel:not(#r-ticker)'), ticker: under('#r-ticker') }, m: window.__record.player.minute, cam: (c?.mode ?? '-') + ':' + (s?.aid ?? s?.id ?? '-') + (s?.ride ? ' (stand-in)' : ''), carriage: sub?.openFor === ${JSON.stringify(ID)} ? sub.open.state() : null, drawn: !!a?.w, leg: a?.run ? (a.run.trip.legs[a.run.k]?.kind ?? 'end') : a?.mode }; })()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const served = await serve(), B = await chrome();
  try {
    await B.send('Page.navigate', { url: url(NIGHT * 1440 + 360) }); await ready(B, 240000); await sleep(3000);
    const R = await B.ev(RIDE); if (!R) throw new Error(`${ID} has no subway trip on day ${NIGHT}`);
    const L = R.legs, down = L.find(l => l.kind === 'stairs' && l.dir !== 'up'), up = [...L].reverse().find(l => l.kind === 'stairs' && l.dir === 'up'), subs = L.filter(l => l.kind === 'subway'), changes = L.filter(l => l.kind === 'wait' && l.transfer);
    const walk0 = L[L.indexOf(down) - 1], walk1 = L[L.indexOf(up) + 1];
    // (the moments, in island minutes: the flight down takes about 6.6 s of the stairs leg, the flight up the last 6.4 s of its leg)
    const M = [];
    if (walk0) M.push({ m: walk0.arr - .05, label: 'the walk to the station' });
    M.push({ m: down.dep + 4 / 60, label: 'down the stairs' });
    M.push({ m: down.arr + .02, label: 'the platform (the carriage open)' });
    subs.forEach((s, k) => { M.push({ m: (s.dep + s.arr) / 2, label: `mid-ride ${k + 1} (${s.line} ${s.from.replace('subway-', '')} → ${s.to.replace('subway-', '')})` }); });
    for (const c of changes) M.push({ m: (c.dep + c.arr) / 2, label: 'the change at ' + c.from.replace('subway-', '') });
    M.push({ m: subs[subs.length - 1].arr - .03, label: 'pulling in' });
    M.push({ m: up.arr - 3 / 60, label: 'up the stairs' });
    if (walk1) M.push({ m: walk1.dep + .05, label: 'the walk out' });
    M.sort((a, b) => a.m - b.m); if (ONLY) for (let k = M.length - 1; k >= 0; k--) if (!ONLY.some(w => M[k].label.includes(w))) M.splice(k, 1);
    const at = R.dep - .4;
    await B.send('Page.navigate', { url: url(at) }); await ready(B, 240000); await sleep(4000);
    const { clickAgent, key } = await import('./c2lib.mjs');
    const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}; })()`);
    let on = false, how = 'card + F';
    for (let k = 0; k < 3 && !on; k++) { if (await clickAgent(B, ID).catch(() => null) === ID) { await key(B, 'f', 'KeyF', 70); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); } if (!on) await sleep(1500); }
    if (!on) { await B.send('Page.navigate', { url: url(at, '&follow=' + ID) }); await ready(B, 240000); await sleep(5000); on = await isOn(); how = '?follow='; }
    console.log(`${ID} followed (${how}): ${on}; trip ${R.dep} → ${R.arr}:`, L.map(l => `${l.kind}${l.dir ? ':' + l.dir : ''} ${l.dep.toFixed(2)}-${l.arr.toFixed(2)}`).join(' · '));
    await B.ev('window.__record.player.play()');
    const shots = [], t0 = Date.now();
    for (const [k, mo] of M.entries()) {
      // (the record paused at the moment, as a viewer's Pause: the carriage stands still with it; then played on)
      while (Date.now() - t0 < 900000) { const m = await B.ev(`(() => { const P = window.__record.player; if (P.minute >= ${mo.m}) P.pause(); return P.minute; })()`); if (m >= mo.m) break; await sleep(m < mo.m - .2 ? 100 : 10); }
      await sleep(400);
      const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }), st = await B.ev(STATE), file = path.join(OUT, `${SEED}-n${NIGHT}-${ID}-${SPEED}x${TAG}-${String(k).padStart(2, '0')}.jpg`);
      await B.ev('window.__record.player.play()');
      await fs.writeFile(file, Buffer.from(r.result.data, 'base64'));
      const car = st.carriage ? `carriage open: ${st.carriage.seg} at ${st.carriage.st}, agent ${st.carriage.agent}, ${st.carriage.t}/${st.carriage.dur} s` : 'no carriage';
      shots.push({ file, label: `${ID} · ${SPEED}× · ${hhmm(st.m)} · ${mo.label}`, cam: st.cam, car, leg: st.leg, drawn: st.drawn });
      console.log(`  ${path.relative(ROOT, file)} · ${hhmm(st.m)} · ${mo.label} · leg ${st.leg} · walker ${st.drawn ? 'drawn' : 'not drawn'} · cam ${st.cam} · ${car} · under the pointer: × ${st.hits.x}, card ${st.hits.card}, ticker ${st.hits.ticker}`);
    }
    await B.ev('window.__record.player.pause()');
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
    const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#eee;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${shots.map(t => `<figure style="margin:0"><img data-f="${path.basename(t.file)}" style="width:100%"><figcaption>${t.label}<br><span style="color:#9ab">${t.car} · cam ${t.cam}</span></figcaption></figure>`).join('')}</div></body></html>`;
    let page = html; for (const t of shots) page = page.replace(`data-f="${path.basename(t.file)}"`, `src="data:image/jpeg;base64,${(await fs.readFile(t.file)).toString('base64')}"`);
    const sheet = path.join(OUT, `${SEED}-n${NIGHT}-${ID}-${SPEED}x${TAG}-sheet.html`); await fs.writeFile(sheet, page);
    await B.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: Math.max(400, Math.ceil(shots.length / 4) * 300 + 20), deviceScaleFactor: 1, mobile: false });
    await B.send('Page.navigate', { url: 'file://' + sheet }); await sleep(1500);
    const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true }), out = path.join(OUT, `${SEED}-n${NIGHT}-${ID}-${SPEED}x${TAG}-sheet.jpg`);
    await fs.writeFile(out, Buffer.from(r.result.data, 'base64')); await fs.rm(sheet);
    console.log('sheet', path.relative(ROOT, out));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
