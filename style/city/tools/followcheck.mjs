// C2 (a) · FOLLOW THE AGENT YOU CLICKED, on the record path (ui/record/dossier.js's Follow, F): headless Chrome, real input.
//   node style/city/tools/followcheck.mjs --port 5962 [--seed 404] [--out <dir>]
// For two daytime moments of the season: a real click on a drawn agent's walker opens its card; a real click on the card's Follow
// button puts the camera rig in follow mode on THAT agent (cam.mode === 'follow', cam.subject.aid === the agent); then 1 (orbit) and
// F with the card open: following that agent again. Then 10 game minutes of playback at 60×, sampled 4× a real second: at every
// sample the rig follows that agent (and the camera is within 40 m of its walker) unless the agent is hidden (no drawn walker).
// The run passes when every moment does, with the agent drawn at at least half the samples (a follow that is never seen is no pass).
import path from 'node:path';
import { ROOT, PORT, arg, sleep, season, open, serve, chrome, clickAgent, drawnAgent, centre, press, key, choose, click, CAM, report, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-checks/follow')));
if (!PORT) { console.error('usage: node style/city/tools/followcheck.mjs --port <port>'); process.exit(2); }
const S = season(SEED), steps = [], result = { seed: SEED, moments: [] };
// (noon of day 12, the day Nico is mugged that night; mid-afternoon of day 6)
const MOMENTS = [{ minute: 12 * 1440 + 720, prefer: ['a10', 'a13'] }, { minute: 6 * 1440 + 900, prefer: ['a04', 'a10'] }];
const SAMPLE = `(() => { const R = window.__record, c = window.__city, s = c.cam?.subject, id = window.__fc;
  const a = R.draw.agents?.map.get(id), w = a?.w && !a.w.gone ? a.w : null;
  return { minute: R.player.minute, mode: c.cam?.mode ?? null, aid: s?.agent ? s.aid : null, hidden: !w,
    dist: w ? Math.hypot(c.camera.position.x - w.p[0], c.camera.position.z - w.p[2]) : null }; })()`;
const server = await serve(), B = await chrome();
try {
  for (const M of MOMENTS) {
    const o = { minute: M.minute };
    await open(B, SEED, `recordAt=${M.minute}&recordPaused=1&recordSpeed=60&tod=day&simtod=0&tv=0`); await sleep(1500);
    const id = await drawnAgent(B, M.prefer); o.agent = id;
    o.clicked = id ? await clickAgent(B, id) : null;
    await B.ev(`window.__fc = ${JSON.stringify(id)}`);
    // the card's Follow, a real click
    const fb = await centre(B, `document.querySelector('#r-dossier [data-act=follow]')`);
    o.button = !!fb;
    if (fb) { await press(B, fb); await sleep(600); }
    o.afterButton = await B.ev(CAM);
    // 1 (orbit), then F with the card open
    await key(B, '1', 'Digit1', 49); await sleep(400); o.afterOrbit = await B.ev(CAM);
    await key(B, 'f', 'KeyF', 70); await sleep(600); o.afterF = await B.ev(CAM);
    // 10 game minutes at 60×
    await click(B, '#record-player button[aria-label="Play or pause"]');
    const t0 = await B.ev('window.__record.player.minute'), samples = [];
    for (let k = 0; k < 120; k++) { await sleep(250); const s = await B.ev(SAMPLE); samples.push(s); if (s.minute >= t0 + 10) break; }
    const bad = samples.filter(s => !s.hidden && !(s.mode === 'follow' && s.aid === id && s.dist !== null && s.dist < 40));
    o.samples = samples.length; o.span = +(samples.at(-1).minute - t0).toFixed(2); o.drawn = samples.filter(s => !s.hidden).length; o.bad = bad.slice(0, 5);
    o.ok = !!id && o.clicked === id && o.button && o.afterButton.mode === 'follow' && o.afterButton.aid === id && o.afterOrbit.mode === 'orbit'
      && o.afterF.mode === 'follow' && o.afterF.aid === id && o.span >= 10 && !bad.length && o.drawn * 2 >= samples.length;
    result.moments.push(o);
    steps.push({ name: `follow @${M.minute}`, ok: o.ok, detail: { agent: id, clicked: o.clicked, button: o.button, afterButton: o.afterButton, afterF: o.afterF, samples: o.samples, drawn: o.drawn, span: o.span, bad: o.bad } });
  }
} catch (e) { result.error = String(e.stack || e); steps.push({ name: 'run', ok: false, detail: { error: String(e.message || e) } }); }
await B.close(); server?.kill();
result.ok = report('followcheck', steps, await writeResult(OUT, result));
process.exitCode = result.ok ? 0 : 1;
