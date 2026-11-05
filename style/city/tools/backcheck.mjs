// C2 (c) · BACK TO WHERE YOU LEFT (the record bar's one way back, ui/record/tape.js): headless Chrome on ?sim=record, real input.
//   node style/city/tools/backcheck.mjs --port 5962 [--seed 404] [--out <dir>]
// Each case sets the viewer up (a moment, a card open or not, the camera following an agent or on the map), leaves it the way a
// viewer does, checks the bar says so (#record-player[data-state] = jumped while away, live before and after), then comes back with
// the bar's back control (#r-back, a real click) or Esc with nothing open, and requires: the playhead at the departure minute (±0.1),
// the camera mode as it was, the follow subject as it was (the same agent), the card as it was (the same agent, or none), and, from
// the map, the camera's target where it was (≤ 1 m).
//   A  Go to show (night picker + "Go to show"), following an agent with its card open, back by the button        (no day/night reload)
//   B  a marker click (a fight's pip), card open, camera on the map, back by the button                              (no reload)
//   C  a marker click with nothing open, back by Esc                                                                 (no reload)
//   D  Go to show from the afternoon into the night (the page reloads into night) and back by the button (the reload back to day),
//      following an agent with its card open
import path from 'node:path';
import { ROOT, PORT, arg, sleep, season, open, serve, chrome, ready, uiReady, clickAgent, drawnAgent, centre, press, key, choose, clickText, CAM, placeXZ, tod, report, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-checks/back')));
if (!PORT) { console.error('usage: node style/city/tools/backcheck.mjs --port <port>'); process.exit(2); }
const S = season(SEED), steps = [], result = { seed: SEED, cases: [] };
const STATE = `(() => { const R = window.__record, U = window.__recordUI, c = window.__city, s = c.cam?.subject, bar = document.getElementById('record-player');
  return { minute: R.player.minute, mode: c.cam?.mode ?? null, aid: s?.agent ? s.aid : null, card: U.dossier.current ?? null, tgt: c.controls.target.toArray(),
    state: bar?.dataset.state ?? null, back: !!document.querySelector('#r-back:not([hidden])'), night: new URLSearchParams(location.search).get('tod') }; })()`;
const st = () => B.ev(STATE).catch(() => null);
const pipOf = id => `[...document.querySelectorAll('#record-player .r-tape-mk')].find(b => b.dataset.ids.split(',').includes('${id}'))`;
async function clickMarker(id) {
  const p = await centre(B, pipOf(id)); if (!p) return false;
  await press(B, p); await sleep(400);
  const n = await B.ev(`(${pipOf(id)})?.dataset.ids.split(',').length ?? 0`);
  if (n > 1) { const q = await centre(B, `document.querySelector('#r-tape-pop [data-marker="${id}"]')`); if (!q) return false; await press(B, q); }
  return true;
}
// until the page is back (a reload may come first) and the playhead has settled near `minute`
async function settle(minute, ms = 30000) {
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < ms) { await sleep(400); try { await ready(B, 5000); await uiReady(B, 5000); } catch { continue; } s = await st(); if (s && Math.abs(s.minute - minute) <= .1 && s.state === 'live') { await sleep(1500); return (await st()) ?? s; } }
  return s;
}
async function follow(id) {
  const fb = await centre(B, `document.querySelector('#r-dossier [data-act=follow]')`);
  if (fb) { await press(B, fb); await sleep(700); }
  return (await B.ev(CAM)).aid === id;
}
function judge(name, dep, away, back, { cardWant, followWant, modeWant, tgtWant = null }) {
  const errs = [];
  if (!dep || dep.state !== 'live') errs.push(`state before leaving: ${dep?.state}`);
  if (!away || away.state !== 'jumped' || !away.back) errs.push(`state while away: ${away?.state}, back control ${away?.back}`);
  if (!back) errs.push('page never came back');
  else {
    if (Math.abs(back.minute - dep.minute) > .1) errs.push(`minute ${back.minute.toFixed(3)} ≠ departure ${dep.minute.toFixed(3)}`);
    if (back.mode !== modeWant) errs.push(`camera mode ${back.mode} ≠ ${modeWant}`);
    if (followWant && back.aid !== followWant) errs.push(`following ${back.aid} ≠ ${followWant}`);
    if (back.card !== cardWant) errs.push(`card ${back.card} ≠ ${cardWant}`);
    if (back.state !== 'live') errs.push(`state after back: ${back.state}`);
    if (tgtWant && Math.hypot(back.tgt[0] - tgtWant[0], back.tgt[2] - tgtWant[2]) > 1) errs.push(`camera target ${back.tgt.map(v => v.toFixed(1))} ≠ ${tgtWant.map(v => v.toFixed(1))}`);
  }
  const o = { name, dep: dep && { minute: dep.minute, mode: dep.mode, aid: dep.aid, card: dep.card }, away: away && { minute: away.minute, state: away.state }, back: back && { minute: back.minute, mode: back.mode, aid: back.aid, card: back.card, state: back.state }, errs, ok: !errs.length };
  result.cases.push(o); steps.push({ name, ok: o.ok, detail: { dep: o.dep, back: o.back, errs } });
}
const server = await serve(), B = await chrome();
const pick = (kind, before) => S.reader.markersAt(S.stateAt(before)).filter(m => m.kind === kind && m.place).at(-1);
try {
  // A · Go to show (night 12), following, card open, no reload
  {
    const m0 = 11 * 1440 + 900;
    await open(B, SEED, `recordAt=${m0}&recordPaused=1&tod=day&simtod=0&tv=0`); await sleep(1500);
    const id = await drawnAgent(B, ['a10', 'a13']); await clickAgent(B, id); await follow(id);
    const dep = await st();
    await choose(B, '#record-player select[aria-label="Night to replay"]', 12); await clickText(B, 'Go to show'); await sleep(2500);
    const away = await st();
    const p = await centre(B, `document.querySelector('#r-back')`); if (p) await press(B, p);
    const back = await settle(dep.minute);
    judge('A go to show → back button', dep, away, back, { cardWant: id, followWant: id, modeWant: 'follow' });
  }
  // B · a fight marker, card open, on the map, no reload
  {
    const m0 = 12 * 1440 + 600, mk = pick('fight', m0);
    await open(B, SEED, `recordAt=${m0}&recordPaused=1&tod=day&simtod=0&tv=0`); await sleep(1500);
    const id = await drawnAgent(B, ['a10']); await clickAgent(B, id);
    const dep = await st();
    const ok = await clickMarker(mk.id); await sleep(3000);
    const away = await st();
    const p = await centre(B, `document.querySelector('#r-back')`); if (p) await press(B, p);
    const back = await settle(dep.minute);
    judge(`B marker ${mk.id} (fight) → back button`, dep, ok ? away : null, back, { cardWant: id, modeWant: 'orbit', tgtWant: dep.tgt });
  }
  // C · a marker with nothing open, back by Esc
  {
    const m0 = 12 * 1440 + 600, mk = pick('fight', m0);
    await open(B, SEED, `recordAt=${m0}&recordPaused=1&tod=day&simtod=0&tv=0`); await sleep(1500);
    const dep = await st();
    const ok = await clickMarker(mk.id); await sleep(3000);
    const away = await st();
    await key(B, 'Escape', 'Escape', 27);
    const back = await settle(dep.minute);
    judge(`C marker ${mk.id} → Esc`, dep, ok ? away : null, back, { cardWant: null, modeWant: 'orbit', tgtWant: dep.tgt });
  }
  // D · Go to show across the day/night reload and back, following, card open
  {
    const m0 = 12 * 1440 + 840;
    await open(B, SEED, `recordAt=${m0}&recordPaused=1&tod=day&tv=0`); await sleep(1500);
    const id = await drawnAgent(B, ['a10', 'a13']); await clickAgent(B, id); await follow(id);
    const dep = await st();
    await choose(B, '#record-player select[aria-label="Night to replay"]', 12); await clickText(B, 'Go to show');
    await sleep(1500); await ready(B); await uiReady(B); await sleep(2500);
    const away = await st();
    const p = await centre(B, `document.querySelector('#r-back')`); if (p) await press(B, p);
    const back = await settle(dep.minute, 45000);
    judge('D go to show (reload into night) → back button (reload into day)', dep, away && away.night === 'night' ? away : null, back, { cardWant: id, followWant: id, modeWant: 'follow' });
  }
} catch (e) { result.error = String(e.stack || e); steps.push({ name: 'run', ok: false, detail: { error: String(e.message || e) } }); }
await B.close(); server?.kill();
result.ok = report('backcheck', steps, await writeResult(OUT, result));
process.exitCode = result.ok ? 0 : 1;
