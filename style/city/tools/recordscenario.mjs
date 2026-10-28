// C1-3 · THE FIRST MILESTONE, WATCHED: one headless-Chrome run of seed 404's recorded season on the record path, driven with real
// input on the player's own controls (the night picker, "Go to show", the speed, play/pause, the minute box).
//   node style/city/tools/recordscenario.mjs --port 5941 [--seed 404] [--out <dir>] [--quick]
// Steps, in order; the first that fails stops the run (no shots of a broken state):
//   1 boot      ?sim=record&feed=/core/runs/<seed>-A/feed.jsonl loads, the walkers are made (window.__record.draw)
//   2 shows     at every show of the seed: "Go to show", 60×, Play until 9:17 p.m., Pause; then placecheck's checkDrawn with the
//               walkers' drawn positions and the staged fights (ok, or the errors)
//   3 network   every request the page and its workers made: only GETs of this server's static files and the feed (and the import
//               map's pinned three.js module); anything else fails
//   4 frames    frame time p95 on the record path vs the same view with no sim (index.html without ?sim), against the 16.8 ms bar
//   5 shots     the moments for slime (day-0 arrival at the docks, a grab at the docks, a break-in at its address, Iron Island, a
//               quiet daytime street), each with its step's pass/fail, on 2×2 sheets (tools/board via python3 + PIL)
// It serves this checkout itself (style/serve.mjs on --port) unless the port already answers, and stops only what it started.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), SEED = +arg('seed', 404), QUICK = process.argv.includes('--quick');
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c1-3')));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = `http://127.0.0.1:${PORT}`, FEED = `/core/runs/${SEED}-A/feed.jsonl`;
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/';
const W = 1280, H = 800;

// ── the static server and Chrome (CDP, flat sessions: the page and every worker it starts)
async function answers() { try { return (await fetch(BASE + '/style/city/index.html', { method: 'HEAD' })).ok; } catch { return false; } }
async function serve() {
  if (await answers()) return null;
  const child = spawn(process.execPath, [path.join(ROOT, 'style/serve.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let k = 0; k < 50 && !(await answers()); k++) await sleep(100);
  return child;
}
async function chrome() {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'c13-chrome-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist',
    '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let port = null; for (let t = 0; t < 150 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) throw new Error('chrome did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), requests = [], errors = [], logs = [];
  const send = (method, params = {}, sessionId) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params, ...(sessionId ? { sessionId } : {}) })); });
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
    if (m.method === 'Network.requestWillBeSent') requests.push({ url: m.params.request.url, method: m.params.request.method, from: m.sessionId ? 'worker' : 'page', type: m.params.type });
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Target.attachedToTarget') { const s = m.params.sessionId;
      send('Network.enable', {}, s).then(() => send('Runtime.runIfWaitingForDebugger', {}, s)); } };
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  for (const d of ['Runtime.enable', 'Page.enable', 'Network.enable']) await send(d);
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  // (every evaluation is bounded: a page that stops answering fails its step instead of hanging the run)
  const ev = async (expr, aw = true, ms = 60000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: aw }),
    sleep(ms).then(() => { throw new Error('page did not answer in ' + ms / 1000 + ' s: ' + expr.slice(0, 80)); })]);
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed'); return r.result?.result?.value; };
  const close = async () => { try { ws.close(); } catch {} try { ch.kill('SIGKILL'); } catch {} await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); };
  process.once('exit', () => { try { ch.kill('SIGKILL'); } catch {} });
  return { send, ev, close, requests, errors, logs };
}

// ── real input: the player's controls, by their labels
async function rectOf(B, sel) {
  const r = await B.ev(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); if (!n) return null; n.scrollIntoView({ block: 'nearest' }); const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  if (!r) throw new Error('no control ' + sel); return r;
}
async function click(B, sel) { const p = await rectOf(B, sel); for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); }
async function key(B, k, code, vk) { for (const type of ['keyDown', 'keyUp']) await B.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); }
// a <select>: focus it with a click (Escape closes its popup), then type the option's label (the select's own type-ahead)
async function choose(B, sel, value) {
  const label = await B.ev(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); const o = [...s.options].find(o => o.value === ${JSON.stringify(String(value))}); return o ? o.text : null; })()`);
  if (label === null) throw new Error(`no option ${value} in ${sel}`);
  if (await B.ev(`document.querySelector(${JSON.stringify(sel)}).value`) === String(value)) return;
  // (a click opens the select's popup, which stops headless Chrome's frames: reach it with Tab from the minute box instead)
  await click(B, '#record-player input[type=number]');
  for (let k = 0; k < 12; k++) {
    if (await B.ev(`document.activeElement === document.querySelector(${JSON.stringify(sel)})`)) break;
    const back = await B.ev(`(() => { const all = [...document.querySelectorAll('#record-player input, #record-player select, #record-player button')]; return all.indexOf(document.querySelector(${JSON.stringify(sel)})) < all.indexOf(document.activeElement); })()`);
    await B.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: back ? 8 : 0 });
    await B.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: back ? 8 : 0 });
  }
  for (const ch of label) { await B.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch }); await B.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); }
  const now = await B.ev(`document.querySelector(${JSON.stringify(sel)}).value`);
  if (now !== String(value)) throw new Error(`could not choose ${value} (${now})`);
}
async function typeMinute(B, minute) {
  await click(B, '#record-player input[type=number]');
  await B.ev(`document.querySelector('#record-player input[type=number]').select()`);
  // (the number box commits its change when focus leaves it: Tab)
  await B.send('Input.insertText', { text: String(minute) }); await key(B, 'Tab', 'Tab', 9);
  const now = await B.ev('window.__record?.player.minute', false).catch(() => null);
  if (now !== null && Math.abs(now - minute) > .01) throw new Error(`the minute box did not seek to ${minute} (${now})`);
}

// the page is up and its walkers are made (after a load or a day/night reload)
async function ready(B, timeout = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (B.errors.length) throw new Error('page error: ' + B.errors[0]);
    const s = await B.ev(`(() => { const r = window.__record; return r && r.draw && r.clock.pageT > 1 && !window.__city?.loading ? { minute: r.player.minute, night: new URLSearchParams(location.search).get('tod') } : null; })()`, false).catch(() => null);
    if (s) return s;
    await sleep(400);
  }
  throw new Error('timeout waiting for the record page');
}
async function minuteNow(B) { return B.ev('window.__record?.player.minute ?? null', false).catch(() => null); }
// play at 60× (the page may reload into night or day on the way: the reload keeps the playhead) until the island minute reaches `until`
async function playUntil(B, until, timeout = 120000) {
  const t0 = Date.now();
  await ready(B);
  if (await B.ev(`window.__record.player.speed`) !== 60) await choose(B, '#record-player select[aria-label="Playback speed"]', 60);
  if (!(await B.ev('window.__record.player.running'))) await click(B, '#record-player button[aria-label="Play or pause"]');
  while (Date.now() - t0 < timeout) {
    const m = await minuteNow(B);
    if (m === null) { await ready(B); continue; }
    if (m >= until) { if (await B.ev('window.__record.player.running')) await click(B, '#record-player button[aria-label="Play or pause"]'); return m; }
    if (!(await B.ev('window.__record?.player.running ?? true', false).catch(() => true))) await click(B, '#record-player button[aria-label="Play or pause"]');
    await sleep(250);
  }
  throw new Error(`timeout playing to minute ${until}`);
}
// (a wall-clock wait: headless Chrome may hold back requestAnimationFrame for a page it isn't painting)
const settleWalkers = () => sleep(1500);
const CHECK = `(async () => { const m = await import('/style/city/tools/placecheck.mjs'), R = window.__record, s = R.player.snapshot();
  const agents = R.draw.drawn(), fights = R.draw.fights(), res = m.checkDrawn(s, R.player.minute, { agents, fights });
  const why = res.errors.map(e => { const id = e.split(':')[0].split(' ')[1], a = R.draw.agents?.map.get(id), r = agents.find(x => x.agent === id);
    return { e, r, spot: a?.spot ? [a.spot.place, a.spot.k, +a.spot.x.toFixed(1), +a.spot.z.toFixed(1), !!a.spot.over, a.spot.real] : null, p: a?.w ? [+a.w.p[0].toFixed(1), +a.w.p[2].toFixed(1)] : null, mode: a?.mode ?? null, life: a?.lf ?? null }; });
  return { ...res, why, minute: R.player.minute, agents: agents.length, withXZ: agents.filter(a => 'x' in a).length, hidden: agents.filter(a => a.hidden).length, onTrip: agents.filter(a => a.trip).length,
    fights: fights.map(f => ({ id: f.eventId, kind: f.kind, at: f.cityPlace, standIns: f.standIns })), stage: window.__stage?.stats?.().staged ?? null }; })()`;
// (out: the side to look from, e.g. a house's street side; else from the south-east)
const aim = (B, x, z, { h = 22, back = 26, side = 10, out = null } = {}) => { const [cx, cz] = out ? [x + out[0] * back - out[1] * side, z + out[1] * back + out[0] * side] : [x + side, z + back];
  return B.ev(`(() => { const c = window.__city; c.controls.target.set(${x}, 0.6, ${z}); c.camera.position.set(${cx}, ${h}, ${cz}); c.controls.update?.(); return true; })()`); };
async function shot(B, file) { const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/recordscenario.mjs --port <port>'); process.exit(2); }
  const feed = path.join(ROOT, FEED.slice(1));
  if (!fss.existsSync(feed)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(SEED), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  await fs.mkdir(OUT, { recursive: true });
  const server = await serve(), B = await chrome(), result = { seed: SEED, steps: [], shots: [] };
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`); if (!ok) throw Object.assign(new Error(name + ' failed'), { step: true }); };
  const shotsDue = [];
  try {
    // 1 · boot (the docks: everyone off the ferry, day 1 06:00 is the record's first frame)
    const url = `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=day&cam=108,24,-236&look=88,0.6,-262`;
    await B.send('Page.navigate', { url });
    const boot = await ready(B);
    const nShows = await B.ev('window.__record.player.shows().length');
    step('boot', true, { minute: boot.minute, shows: nShows, timeline: await B.ev('window.__record.draw.timeline.cands.length') });
    // the day-0 arrival: twenty seconds in, they leave the docks
    await playUntil(B, boot.minute + 0.3); await aim(B, 88, -262, { h: 13, back: 17, side: 7 }); await settleWalkers(B);
    shotsDue.push({ key: 'arrival', label: 'Day 1 06:00 · off the ferry at the docks', file: await shot(B, path.join(OUT, 'arrival.png')), step: 'boot' });
    // 2 · every show
    const shows = await B.ev('window.__record.player.shows()'), checks = [];
    for (const s of QUICK ? shows.slice(0, 3) : shows) {
      console.log(`  night ${s.night}: go to show`);
      await ready(B);
      await choose(B, '#record-player select[aria-label="Night to replay"]', s.night);
      await clickText(B, 'Go to show');
      await ready(B);
      await playUntil(B, s.minute + 12); await settleWalkers(B);
      const c = await B.ev(CHECK);
      checks.push({ night: s.night, ok: c.ok, errors: c.errors.slice(0, 6), why: c.why.slice(0, 6), agents: c.agents, withXZ: c.withXZ, hidden: c.hidden, fights: c.fights });
      console.log(`  night ${s.night} @${c.minute.toFixed(2)}: ${c.ok ? 'ok' : 'FAIL'} · ${c.agents} rows (${c.withXZ} with x/z, ${c.hidden} hooded) · fights ${JSON.stringify(c.fights)}${c.ok ? '' : ' · ' + c.errors.slice(0, 4).join(' | ')}`);
      result[`night${s.night}`] = c;
      // the moments for slime, while the scene is on
      for (const f of c.fights) {
        if (f.kind === 'grab' && !shotsDue.some(x => x.key === 'grab')) shotsDue.push({ key: 'grab', night: s.night, fight: f.id, step: 'shows' });
        if (f.kind === 'breakin' && !shotsDue.some(x => x.key === 'breakin')) shotsDue.push({ key: 'breakin', night: s.night, fight: f.id, step: 'shows' });
      }
    }
    step('shows', checks.every(c => c.ok), { checked: checks.length, failed: checks.filter(c => !c.ok).map(c => ({ night: c.night, errors: c.errors })) });
    // 3 · network
    const bad = B.requests.filter(r => {
      if (r.url.startsWith('data:') || r.url.startsWith('blob:')) return false;
      if (r.url.startsWith(THREE_CDN) && r.method === 'GET') return false;
      const u = new URL(r.url);
      if (u.origin !== BASE || r.method !== 'GET') return true;
      if (u.pathname.startsWith('/core/')) return u.pathname !== FEED;
      return /^\/(state|tape|events|api|__bake)\b/.test(u.pathname) || u.search.includes('since=');
    });
    step('network', bad.length === 0, { requests: B.requests.length, fromWorkers: B.requests.filter(r => r.from === 'worker').length, feedLoads: B.requests.filter(r => r.url.endsWith(FEED)).length, bad: bad.slice(0, 8) });
    // 4 · frame time, the same view: the record path playing at 60× vs no sim
    const measure = async () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`);
    const view = 'cam=108,24,-236&look=88,0.6,-262&tod=day&simtod=0';
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordAt=${shows[1].minute - 40}&recordSpeed=60&${view}` });
    await ready(B); await sleep(6000);
    const rec = await measure();
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}` });
    for (let t = 0; t < 240 && !(await B.ev(`document.title`, false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
    await sleep(6000);
    const none = await measure();
    step('frames', true, { record: rec, noSim: none, bar: 16.8, recordUnderBar: rec.p95 <= 16.8 });
    // 5 · the moments, each re-found by seeking with the minute box
    const go = async (minute, tod, x, z, o) => { await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=${tod}&recordAt=${minute - 0.5}` }); await ready(B);
      await typeMinute(B, minute); await ready(B); await aim(B, x, z, o); await settleWalkers(B); await sleep(1500); await settleWalkers(B); };
    for (const d of shotsDue.filter(s => !s.file)) {
      const show = shows.find(s => s.night === d.night), m = show.minute + 7;
      const loc = await (async () => { await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=night&recordAt=${m}` }); await ready(B); await settleWalkers(B);
        return B.ev(`window.__record.draw.fights().find(f => f.eventId === ${d.fight})`); })();
      if (!loc) { d.label = `night ${d.night}: scene ${d.fight} not drawn`; d.ok = false; continue; }
      await go(m, 'night', loc.x, loc.z, d.key === 'grab' ? { h: 11, back: 8, side: 3 } : { h: 7, back: 11, side: 4, out: loc.out });
      d.label = `Night ${d.night} 21:12 · ${d.key === 'grab' ? 'the grab at the docks' : 'the break-in at ' + loc.cityPlace}`; d.file = await shot(B, path.join(OUT, d.key + '.png'));
    }
    // Iron Island: the first night with an arrest, the next noon
    const jailMinute = 3 * 1440 + 720; await go(jailMinute, 'day', 0, 0);
    const jail = await B.ev(`(() => { const R = window.__record, rows = R.draw.drawn(), j = rows.filter(r => r.cityPlace === 'jail' && 'x' in r); return j.length ? { n: j.length, x: j[0].x, z: j[0].z, ids: j.map(r => r.agent) } : null; })()`);
    if (jail) { await aim(B, jail.x, jail.z, { h: 10, back: 14, side: 6 }); await settleWalkers(B); await sleep(1200); shotsDue.push({ key: 'jail', label: `Day 3 12:00 · Iron Island (${jail.ids.join(', ')})`, file: await shot(B, path.join(OUT, 'jail.png')), step: 'shows' }); }
    else shotsDue.push({ key: 'jail', label: 'Day 3 12:00 · nobody drawn on Iron Island', ok: false });
    // a quiet daytime street: day 3, 11:00, a held corner (or a doorstep)
    await go(3 * 1440 + 660, 'day', 0, 0);
    const corner = await B.ev(`(() => { const rows = window.__record.draw.drawn().filter(r => 'x' in r && r.cityPlace.startsWith('corner')); const by = {}; for (const r of rows) (by[r.cityPlace] ||= []).push(r); const best = Object.values(by).sort((a, b) => b.length - a.length)[0]; return best ? { x: best[0].x, z: best[0].z, n: best.length, at: best[0].cityPlace } : null; })()`);
    if (corner) { await aim(B, corner.x, corner.z, { h: 12, back: 18, side: 8 }); await settleWalkers(B); await sleep(1200); shotsDue.push({ key: 'street', label: `Day 3 11:00 · ${corner.at}, ${corner.n} on the corner`, file: await shot(B, path.join(OUT, 'street.png')), step: 'shows' }); }
    // ?sim=demo still boots (one shot)
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=demo&shot=1` });
    for (let t = 0; t < 240 && (await B.ev('document.title', false).catch(() => '')) !== 'ready'; t++) await sleep(500);
    const demo = (await B.ev('document.title', false)) === 'ready';
    if (demo) await shot(B, path.join(OUT, 'demo.png'));
    step('demo', demo, { title: await B.ev('document.title', false) });
  } catch (e) { result.error = String(e.message || e); if (!e.step) console.log('FAIL ' + result.error); }
  finally {
    result.pageErrors = B.errors.slice(0, 5);
    // the sheets: at most 2×2 tiles, each labelled with its moment and its step's pass/fail
    const passed = n => result.steps.find(s => s.name === n)?.ok;
    const tiles = shotsDue.filter(s => s.file).map(s => ({ file: s.file, label: `${s.label} · ${s.step} ${passed(s.step) ? 'PASS' : 'FAIL'}` }));
    result.shots = tiles; const sheets = [];
    for (let k = 0; k < tiles.length; k += 4) {
      const sheet = path.join(OUT, `sheet-${k / 4 + 1}.jpg`), py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(tiles.slice(k, k + 4))], { encoding: 'utf8' });
      if (py.status) console.log('sheet: ' + py.stderr); else sheets.push(sheet);
    }
    result.sheets = sheets;
    await fs.writeFile(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
    await B.close(); server?.kill();
    const ok = !result.error && result.steps.length >= 5 && result.steps.every(s => s.ok);
    console.log(`${ok ? 'RECORDSCENARIO PASS' : 'RECORDSCENARIO FAIL'} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
    process.exitCode = ok ? 0 : 1;
  }
}
async function clickText(B, text) {
  const p = await B.ev(`(() => { const n = [...document.querySelectorAll('#record-player button')].find(b => b.textContent === ${JSON.stringify(text)}); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  if (!p) throw new Error('no button ' + text);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
}
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 600, 12, 44
cols = 2 if len(tiles) > 1 else 1; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * (th + bar) + (rows + 1) * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
export { chrome, ready, choose, click, clickText, typeMinute, playUntil, serve, CHECK };
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
