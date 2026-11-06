// C2-lock2 · A LOCKED PERSON IS WATCHED AS A FOLLOWED ONE IS: on the subway, in a cab and going home. Headless
// Chrome on ?sim=record, per case and per camera (Follow, then Lock): the page loaded paused a little before the trip, the agent's card
// opened with a real click and its Follow or Lock pressed with a real click, the card closed, the record played at --speed× through the
// trip. Read each frame from the page (never from the code it checks):
//   watched   the camera's subject in its mode (follow or lock) is the agent (its walker, or a ride's stand-in under its id) on every frame
//   subway    the carriage opens on the agent (window.__city.subway.openFor)
//   cab       the rig's person becomes the cab's stand-in (ride) while the agent rides, and the camera rides with it: its distance to the
//             stand-in never over twice the distance it had at the start of the trip
//   home      the record homes open the agent's room (recordHomes open = the trip's lot)
// PASS when every case shows under Lock what it shows under Follow, and Follow shows it.
//   node style/city/tools/lockridecheck.mjs --port 5970 [--seed 404] [--id a10] [--speed 10]
//     [--cases subway:6780:6782.6,cab:6420:6421.8,home:6840:6841.3:lot:80,111]
// It serves this checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import { chrome, ready, serve } from './recordscenario.mjs';
import { arg, sleep, FEED, tod, clickAgent, centre, press, BASE } from './c2lib.mjs';

const SEED = +arg('seed', 404), ID = arg('id', 'a10'), SPEED = +arg('speed', 10);
const CASES = String(arg('cases', 'subway:6780:6782.6,cab:6420:6421.8,home:6840:6841.3:lot:80/111')).split(',').map(c => { const [kind, dep, arr, ...lot] = c.split(':'); return { kind, dep: +dep, arr: +arr, lot: lot.length ? lot.join(':').replace('/', ',') : null }; });

function sampler(id, o) {
  const city = window.__city, P = window.__record.player, W = window.__lr = { frames: 0, watched: 0, off: [], carriage: false, ride: 0, d0: null, dMax: 0, homes: false, done: false };
  const f = () => { if (W.done) return; const c = city.cam, s = c && (c.mode === 'follow' || c.mode === 'lock') ? c.subject : null, cp = city.camera.position;
    if (P.running && P.minute >= o.to) { P.pause(); W.done = true; return; }
    if (P.minute >= o.dep) { W.frames++;
      if (s && s.aid === id) W.watched++; else if (W.off.length < 8) W.off.push([+P.minute.toFixed(3), c?.mode, s ? (s.aid ?? 'walker#' + s.id) : null]);
      if (city.subway?.openFor === id) W.carriage = true;
      if (s && s.aid === id) { const d = Math.hypot(s.p[0] - cp.x, s.p[1] - cp.y, s.p[2] - cp.z); if (W.d0 === null) W.d0 = d; if (s.ride) { W.ride++; W.dMax = Math.max(W.dMax, d); } }
      if (o.lot && city.recordHomes?.open === o.lot) W.homes = true; }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); return true;
}

async function run(B, cs, how) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(SEED)}&tod=${tod(cs.dep)}&recordAt=${cs.dep - .4}&recordSpeed=${SPEED}&recordPaused=1&simtod=0` });
  await ready(B, 240000); await sleep(4000);
  const isOn = () => B.ev(`(() => { const c = window.__city.cam; return c?.mode === ${JSON.stringify(how)} && c.subject?.aid === ${JSON.stringify(ID)}; })()`);
  let on = false;
  for (let k = 0; k < 3 && !on; k++) { const card = await clickAgent(B, ID).catch(() => null);
    if (card === ID) { const b = await centre(B, `document.querySelector('#r-dossier [data-act=${how}]')`); if (b) await press(B, b); for (let j = 0; j < 10 && !(on = await isOn()); j++) await sleep(300); }
    if (!on) await sleep(1500); }
  if (!on) return { error: `could not ${how} ${ID}` };
  await B.ev(`(window.__recordUI?.dossier?.close?.(), true)`); await sleep(800);
  const to = cs.arr + (cs.kind === 'home' ? 2 : .5);
  await B.ev(`(${sampler})(${JSON.stringify(ID)}, ${JSON.stringify({ dep: cs.dep, to, lot: cs.lot })})`); await B.ev('window.__record.player.play()');
  for (let t0 = Date.now(); Date.now() - t0 < 600e3;) { await sleep(500); if (await B.ev('window.__lr?.done', false).catch(() => false)) break; }
  const W = await B.ev(`(() => { const W = window.__lr; return { ...W, d0: W.d0 && +W.d0.toFixed(2), dMax: +W.dMax.toFixed(2) }; })()`);
  const shown = cs.kind === 'subway' ? W.carriage : cs.kind === 'cab' ? W.ride > 0 && W.dMax <= 2 * W.d0 : W.homes;
  return { ...W, shown, all: W.frames > 0 && W.watched === W.frames };
}

async function main() {
  const served = await serve(), B = await chrome(); let bad = false;
  try {
    for (const cs of CASES) { const r = {};
      for (const how of ['follow', 'lock']) { r[how] = await run(B, cs, how); const x = r[how];
        console.log(`  ${cs.kind.padEnd(6)} ${how.padEnd(6)} ${x.error ? 'ERROR ' + x.error : `watched ${x.watched}/${x.frames}${x.off.length ? ' off ' + JSON.stringify(x.off) : ''} · carriage ${x.carriage} · stand-in frames ${x.ride} (camera ${x.d0} → max ${x.dMax} m) · homes ${x.homes} → shown ${x.shown}`}`); }
      const ok = !r.follow.error && !r.lock.error && r.follow.shown && r.lock.shown && r.lock.all;
      if (!ok) bad = true; console.log(`${ok ? 'PASS' : 'FAIL'} ${cs.kind} (${ID} ${cs.dep} → ${cs.arr}): under Lock as under Follow`); }
    if (B.errors.length) console.log('page errors:', B.errors.slice(0, 5));
  } finally { await B.close(); if (served) served.kill(); console.log(bad ? 'LOCKRIDECHECK FAIL' : 'LOCKRIDECHECK PASS'); process.exitCode = bad ? 1 : 0; }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
