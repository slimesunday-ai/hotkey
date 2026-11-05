// C2-transit · THE CARRIAGE ON THE RECORD, WITH THE TRANSPORT IN HAND (GAME.md §41, slime 10-31: "We already created an inside the carriage
// subway scene"). Headless Chrome on ?sim=record: the agent's card opened with a real click, F pressed (Follow), the record played at
// --speed until the agent is underground and the carriage is open on it, then the record's own transport (#record-player) used with real
// input while it is open:
//   pause      a real click on the bar's Pause: the record stops, the carriage's program second stands still (over 1 s), the carriage
//              stays open; a real click on Play: it runs on
//   speed      the speed box set to 1× (its own change handler): the carriage stays open and its second runs at about 1 s a real s
//   seek in    the minute box typed with real keys (Tab commits it) to the middle of the ride: the carriage closes and opens again at the
//              program second playing there would have (within 1.5 s of (minute − program start) × 60), on the same agent
//   seek out   the minute box typed back to before the trip: the carriage closes and stays closed; the camera still follows the agent
//   on top     at each click, the element under the pointer is the transport's own (not the carriage)
// Exit 1 when any step fails.
//   node style/city/tools/carriagecheck.mjs --port 5984 [--seed 404] [--id a04] [--night 4] [--speed 10]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import { chrome, ready, serve } from './recordscenario.mjs';
import { clickAgent, key, press, centre } from './c2lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5984), SEED = +arg('seed', 404), NIGHT = +arg('night', 4), ID = arg('id', 'a04'), SPEED = +arg('speed', 10), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tod = m => { const r = ((m % 1440) + 1440) % 1440; return r >= 360 && r < 1200 ? 'day' : 'night'; };
const url = (at, q = '') => `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${tod(at)}&recordAt=${at}&recordSpeed=${SPEED}&recordPaused=1${q}`;
const RIDE = `(() => { const D = window.__record.draw, L = D.timeline.segs.get(${JSON.stringify(ID)}) || [], a = ${NIGHT * 1440 + 360}, b = a + 1440;
  for (let i = 0; i < L.length; i++) { const d = D.rule.at(${JSON.stringify(ID)}, i); if (d?.trip?.legs?.some(l => l.kind === 'subway') && d.dep >= a && d.dep < b) return { dep: d.dep, arr: d.trip.arr, legs: d.trip.legs.map(l => ({ kind: l.kind, dep: l.dep, arr: l.arr, dir: l.dir ?? null })) }; } return null; })()`;
const ST = `(() => { const sub = window.__city.subway, P = window.__record.player, c = window.__city.cam, o = sub?.openFor === ${JSON.stringify(ID)} ? sub.open.state() : null;
  return { m: P.minute, running: P.running, speed: P.speed, open: sub?.openFor ?? null, t: o ? o.t : null, dur: o ? o.dur : null, follow: c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}, stats: sub?.stats?.() }; })()`;
const until = async (B, js, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await B.ev(js, false).catch(() => null); if (v) return v; await sleep(50); } return null; };
const BAR = sel => `document.querySelector('#record-player ${sel}')`;
// what is under the pointer there: the transport's own element?
const hit = (B, p) => B.ev(`(() => { const e = document.elementFromPoint(${p.x}, ${p.y}); return e ? (e.closest('#record-player') ? 'transport' : e.closest('.sbw') ? 'carriage' : e.tagName) : null; })()`);
async function typeMinute(B, m) {
  const p = await centre(B, BAR('input[type=number]')); await press(B, p); const where = await hit(B, p);
  await B.ev(`(() => { const n = ${BAR('input[type=number]')}; n.focus(); n.select(); return true; })()`);
  for (const ch of m.toFixed(3)) await B.send('Input.dispatchKeyEvent', { type: 'char', text: ch });
  await key(B, 'Tab', 'Tab', 9); return where;
}

async function main() {
  const served = await serve(), B = await chrome(), steps = []; let bad = false;
  const step = (name, ok, info) => { steps.push({ name, ok, info }); if (!ok) bad = true; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(info)}`); };
  try {
    await B.send('Page.navigate', { url: url(NIGHT * 1440 + 360) }); await ready(B, 240000); await sleep(2000);
    const R = await B.ev(RIDE); if (!R) throw new Error(`${ID} has no subway trip on day ${NIGHT}`);
    const sub = R.legs.filter(l => l.kind === 'subway'), up = [...R.legs].reverse().find(l => l.kind === 'stairs' && l.dir === 'up'), downEnd = R.legs.find(l => l.kind === 'stairs' && l.dir !== 'up').arr;
    await B.send('Page.navigate', { url: url(R.dep - .3) }); await ready(B, 240000); await sleep(4000);
    let on = false; for (let k = 0; k < 3 && !on; k++) { if (await clickAgent(B, ID).catch(() => null) === ID) { await key(B, 'f', 'KeyF', 70); on = !!await until(B, `(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(ID)}; })()`, 4000); } }
    step('follow (card + F)', on, { id: ID });
    await B.ev('window.__record.player.play()');
    const o1 = await until(B, `(() => window.__city.subway?.openFor === ${JSON.stringify(ID)} && window.__record.player.minute)()`, 120000);
    step('the carriage opens underground', !!o1, { minute: o1, stairsDownEnd: downEnd });
    if (!o1) return;
    // ── pause / play with real clicks on the bar
    const pb = await centre(B, `[...document.querySelectorAll('#record-player button')].find(n => /^(Pause|Play)$/.test(n.textContent.trim()))`); await sleep(400);
    let w = await hit(B, pb); await press(B, pb); await sleep(150);
    const a = await B.ev(ST); await sleep(1000); const b = await B.ev(ST);
    step('pause (a real click on the bar)', w === 'transport' && !a.running && a.open === ID && b.open === ID && a.t === b.t, { under: w, running: a.running, t: [a.t, b.t] });
    w = await hit(B, pb); await press(B, pb); await sleep(1000); const c = await B.ev(ST);
    step('play (a real click on the bar)', w === 'transport' && c.running && c.open === ID && c.t > b.t, { under: w, running: c.running, t: [b.t, c.t] });
    // ── the speed box to 1×
    await B.ev(`(() => { const s = ${BAR('select')}; s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    const d = await B.ev(ST); await sleep(2000); const e = await B.ev(ST);
    step('speed 1× while open', e.speed === 1 && e.open === ID && e.t - d.t > 1.2 && e.t - d.t < 3, { speed: e.speed, programSecondsIn2s: e.t != null && d.t != null ? +(e.t - d.t).toFixed(2) : null });
    // ── seek into the middle of the ride (the minute box, typed)
    const mid = (sub[0].dep + sub[sub.length - 1].arr) / 2; w = await typeMinute(B, mid);
    const f = await until(B, `(() => { const s = ${ST}; return s.open === ${JSON.stringify(ID)} && s.t !== null && Math.abs(s.m - ${mid}) < .5 ? s : null; })()`, 20000);
    const P0 = R.legs.find(l => l.kind === 'wait' || l.kind === 'subway').dep, want = f ? (f.m - P0) * 60 : null;
    step('seek into the ride: opens where playing there would', !!f && w === 'transport' && Math.abs(f.t - want) < 1.5 && f.stats.ends.seek >= 1, { under: w, minute: f?.m, t: f?.t, want: want && +want.toFixed(2), ends: f?.stats?.ends });
    // ── seek back before the trip: closed, and the follow kept
    w = await typeMinute(B, R.dep - .2); await sleep(2500); const g = await B.ev(ST);
    step('seek out (before the trip): closed', w === 'transport' && g.open === null && g.follow && g.m < R.dep, { under: w, minute: g.m, open: g.open, follow: g.follow });
    // ── and a seek past the ride (up the stairs, the walk out): closed
    w = await typeMinute(B, up.arr + .1); await sleep(2500); const h = await B.ev(ST);
    step('seek past the ride: closed', h.open === null && h.m > up.arr, { minute: h.m, open: h.open, follow: h.follow });
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
  } finally { await B.close(); if (served) served.kill(); console.log(bad ? 'CARRIAGECHECK FAIL' : 'CARRIAGECHECK PASS'); process.exitCode = bad ? 1 : 0; }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
