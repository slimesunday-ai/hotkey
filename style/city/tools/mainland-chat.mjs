// MAINLAND CHAT · the check (2026-10-06): starts its own relay, opens the Mainland's walk mode in two headless Chromes (alice, bob) and
// checks that each sees the other walk, that chat goes both ways with the bubbles over the right heads, that WASD types (not walks) while
// the bar is open, the emotes, the offline page (no relay: the pill says so, no errors), and a perf pass with --bots. Frames and GIFs go
// to style/city/shots/mainland-chat/.
//   node style/city/tools/mainland-chat.mjs [--base http://127.0.0.1:5408] [--port 5461] [--only two|perf|offline|inside|ui] [--bots 10]
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const A_ = process.argv.slice(2), arg = (k, d) => { const i = A_.indexOf('--' + k); return i >= 0 ? A_[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:5408'), PORT = +arg('port', 5461), ONLY = arg('only', ''), NB = +arg('bots', 10);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)), OUT = path.join(ROOT, 'style/city/shots/mainland-chat'), RELAY = path.join(ROOT, 'style/city/mainland/relay.mjs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 1280, H = 800, kids = [];
await fs.mkdir(OUT, { recursive: true });

function relay(extra = []) { const p = spawn(process.execPath, [RELAY, '--port', String(PORT), '--quiet', ...extra], { stdio: ['ignore', 'inherit', 'inherit'] }); kids.push(p); return p; }
async function browser(tag) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'ml-chat-' + tag + '-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--remote-debugging-port=0', `--window-size=${W},${H + 88}`, 'about:blank'], { stdio: 'ignore' });
  kids.push(ch);
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; }); let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log/' + m.params.entry.source + ': ' + m.params.entry.text.slice(0, 200)); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const B = { tag, errors, send,
    async go(url) { await send('Page.navigate', { url }); },
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(tag + ': ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value; },
    async until(expr, ms = 90000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await B.ev(expr)) return true; } catch {} await sleep(250); } throw new Error(tag + ': timed out waiting for ' + expr); },
    async shot(file) { const r = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; },
    async key(key, code, vk, type = 'both', text) { if (type !== 'up') await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(text ? { text, unmodifiedText: text } : {}) }); if (type !== 'down') await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); },
    async type(text) { await send('Input.insertText', { text }); },
    close() { try { ws.close(); } catch {} ch.kill('SIGKILL'); setTimeout(() => fs.rm(prof, { recursive: true, force: true }).catch(() => {}), 500); } };
  return B;
}
const url = (q) => `${BASE}/style/city/mainland/?${q}`;
const ready = `!!(window.__walk && __walk.on && __walk.grid() && window.__chat)`;
async function gif(frames, out, fps = 8, width = 800) { const dir = path.dirname(frames[0]), pat = path.join(dir, path.basename(frames[0]).replace(/\d{3}\.png$/, '%03d.png'));
  await new Promise((res, rej) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', pat, '-vf', `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, out]); p.on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()); }); }
async function sideBySide(a, b, out) { await new Promise((res, rej) => { const p = spawn('python3', ['-c', `
from PIL import Image, ImageDraw
a=Image.open('${a}').convert('RGB'); b=Image.open('${b}').convert('RGB'); w=a.width//2; h=a.height//2
im=Image.new('RGB',(w*2+6,h),(23,23,27)); im.paste(a.resize((w,h)),(0,0)); im.paste(b.resize((w,h)),(w+6,0)); im.save('${out}')`]); p.on('exit', c => c ? rej(new Error('pil ' + c)) : res()); }); }
const report = {};
const done = () => { for (const k of kids) try { k.kill('SIGKILL'); } catch {} };
process.on('exit', done); process.on('SIGINT', () => { done(); process.exit(1); });

try {
  // ── TWO PLAYERS
  if (!ONLY || ONLY === 'two') {
    relay(); await sleep(400);
    const R = `relay=ws://127.0.0.1:${PORT}/mainland&nolock`;
    const [A, B] = await Promise.all([browser('alice'), browser('bob')]);
    await A.go(url(`walk=1&owner=ML-011&as=alice&${R}`)); await A.until(ready);
    await B.go(url(`walk=1&as=bob&${R}`)); await B.until(ready);
    await A.until(`__chat.status() === 'online'`); await B.until(`__chat.status() === 'online' && __chat.peers.all().length === 1`);
    // bob a few metres up the path from alice, facing her; both cameras looking at the other
    const a0 = await A.ev(`({ x: __walk.S.p.x, z: __walk.S.p.z, yaw: __walk.S.body })`);
    const fx = Math.sin(a0.yaw), fz = Math.cos(a0.yaw), bx = a0.x + fx * 6 + fz * 1.2, bz = a0.z + fz * 6 - fx * 1.2;
    await B.ev(`__walk.place(${bx}, ${bz}, ${Math.atan2(a0.x - bx, a0.z - bz)}); __walk.look(${Math.atan2(a0.x - bx, a0.z - bz) + .45}, -.2); true`);   // (alice off bob's shoulder, not behind him)
    await A.ev(`__walk.look(${Math.atan2(bx - a0.x, bz - a0.z)}, -.2); true`);
    await sleep(1800);
    const frames = { A: [], B: [] }, F = (who, k) => path.join(OUT, `f-${who}-${String(k).padStart(3, '0')}.png`);
    let k = 0; const snap = async () => { await Promise.all([A.shot(F('a', k)), B.shot(F('b', k))]); frames.A.push(F('a', k)); frames.B.push(F('b', k)); k++; };
    const film = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const t1 = Date.now(); await snap(); await sleep(Math.max(0, 125 - (Date.now() - t1))); } };
    await snap();
    // alice walks toward bob and past him, then runs back; bob watches (and his view of alice is compared with where she is)
    await A.ev(`__walk.key('KeyW', true); true`);
    const track = []; const t0 = Date.now();
    const sampler = (async () => { while (Date.now() - t0 < 2600) { const [pa, pb] = await Promise.all([A.ev(`[performance.now(), __walk.S.p.x, __walk.S.p.z]`), B.ev(`(() => { const p = __chat.peers.all()[0]; return p ? [p.vis.x, p.vis.z, p.sp, p.b?.gait?.w ?? 0] : null; })()`)]); track.push({ t: Date.now() - t0, a: pa, b: pb }); await sleep(100); } })();
    await film(1400); await A.ev(`__walk.key('KeyW', false); __walk.key('KeyS', true); __walk.key('ShiftLeft', true); true`); await film(1200);
    await A.ev(`__walk.key('KeyS', false); __walk.key('ShiftLeft', false); true`); await sampler; await film(900);
    // chat both ways, through the real keys: Enter opens, the text, Enter sends; WASD typed into the bar must not walk
    const pA = await A.ev(`[__walk.S.p.x, __walk.S.p.z]`);
    await A.key('Enter', 'Enter', 13); await sleep(100);
    for (const ch of 'wasd') await A.key(ch, 'Key' + ch.toUpperCase(), ch.toUpperCase().charCodeAt(0), 'down', ch);
    await sleep(500); for (const ch of 'wasd') await A.key(ch, 'Key' + ch.toUpperCase(), ch.toUpperCase().charCodeAt(0), 'up');
    const typed = await A.ev(`document.querySelector('#mlc-bar input').value`), pA2 = await A.ev(`[__walk.S.p.x, __walk.S.p.z]`);
    report.wasdWhileTyping = { typed, moved: +Math.hypot(pA2[0] - pA[0], pA2[1] - pA[1]).toFixed(3) };
    await A.ev(`document.querySelector('#mlc-bar input').value = ''; true`); await A.type('hey bob! nice lawn you got'); await A.key('Enter', 'Enter', 13);
    await film(900);
    await B.key('t', 'KeyT', 84); await sleep(80); await B.type('yo alice, gazebo at 7?'); await B.key('Enter', 'Enter', 13);
    await film(900);
    await A.ev(`__chat.say('second line stacks above the first'); true`); await film(1000);
    report.peerB = await B.ev(`(() => { const p = __chat.peers.all()[0]; return { fade: p.fade, away: p.away, mode: p.mode, shown: p.shown, late: p.late }; })()`);
    report.bubblesB = await B.ev(`__chat.ents()`); report.bubblesA = await A.ev(`__chat.ents()`);
    await A.shot(path.join(OUT, 'chat-alice-view.png')); await B.shot(path.join(OUT, 'chat-bob-view.png'));
    // the bubbles sit over the right heads: in bob's view, alice's entity (her tag, her bubbles) is where her head projects
    report.headCheck = await B.ev(`(() => { const p = __chat.peers.all()[0], e = __chat.ents().find(e => e.k === p.sid); const v = p.head.clone().project(__ml.camera);
      return { tag: e.tag, bubbles: e.bubbles, head: [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)], ent: e.rect && [Math.round(e.rect.x), Math.round(e.rect.y)] }; })()`);
    // emotes
    await A.ev(`__chat.emote('wave'); true`); await B.ev(`__chat.emote('dance'); true`); await film(1600);
    await A.shot(path.join(OUT, 'emote-alice-view.png')); await B.shot(path.join(OUT, 'emote-bob-view.png'));
    // mute: bob mutes alice; her next line shows nowhere in his view
    await B.ev(`(() => { const p = __chat.peers.all()[0]; __chat.mutes.add(p.pid); return true; })()`);
    await A.ev(`__chat.say('can you hear me?'); true`); await sleep(500);
    report.muted = await B.ev(`__chat.ents().find(e => e.k !== 'me')?.bubbles.includes('can you hear me?') ? 'LEAK' : 'ok'`);
    report.logA = await A.ev(`__chat.log()`); report.logB = await B.ev(`__chat.log()`);
    report.track = track.filter((_, i) => i % 3 === 0).map(s => ({ t: s.t, alice: s.a && [+s.a[1].toFixed(2), +s.a[2].toFixed(2)], bobSees: s.b && [+s.b[0].toFixed(2), +s.b[1].toFixed(2)], sp: s.b && +s.b[2].toFixed(2), gaitW: s.b && +s.b[3].toFixed(2) }));
    // leave: alice closes; bob's view drops her (faded)
    A.close(); await sleep(1500); report.afterLeave = await B.ev(`({ peers: __chat.peers.all().length, ents: __chat.ents().length, log: __chat.log().slice(-1)[0] })`);
    report.errors = { alice: A.errors, bob: B.errors }; B.close();
    for (const [who, fr] of Object.entries(frames)) await gif(fr, path.join(OUT, `two-${who === 'A' ? 'alice' : 'bob'}-view.gif`));
    const sbs = []; for (let i = 0; i < frames.A.length; i++) { const o = path.join(OUT, `s-${String(i).padStart(3, '0')}.png`); await sideBySide(frames.A[i], frames.B[i], o); sbs.push(o); }
    await gif(sbs, path.join(OUT, 'two-side-by-side.gif'), 8, 1286);
    for (const f of [...frames.A, ...frames.B, ...sbs]) await fs.rm(f);
    for (const k of kids.splice(0)) k.kill('SIGKILL'); await sleep(300);
  }
  // ── PERF: one walker, N bots around the spawn (the relay's dev mode)
  if (!ONLY || ONLY === 'perf') {
    relay(['--bots', String(NB), '--bots-at', '-30,-95']); await sleep(400);
    const A = await browser('perf'); await A.go(url(`walk=1&owner=ML-011&as=perf&relay=ws://127.0.0.1:${PORT}/mainland&nolock`)); await A.until(ready);
    await A.until(`__chat.peers.all().length >= ${NB}`); await sleep(2500);
    await A.ev(`__walk.look(Math.PI * .25, -.25); true`); await sleep(600);
    const measure = `new Promise(r => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = t => { const d = t - last; last = t; if (n++ > 2) worst = Math.max(worst, d); if (t - t0 < 5000) requestAnimationFrame(f); else r({ fps: +(n / ((t - t0) / 1000)).toFixed(1), worstMs: +worst.toFixed(1), cpuWalkMs: +(__walk.S.cpu || 0).toFixed(2), calls: __ml.renderer.info.render.calls, peers: __chat.peers.all().filter(p => p.shown).length }); }; requestAnimationFrame(f); })`;
    report.perfBots = await A.ev(measure); await A.shot(path.join(OUT, 'perf-bots.png'));
    const frames = []; for (let i = 0; i < 24; i++) { const f = path.join(OUT, `p-${String(i).padStart(3, '0')}.png`); await A.shot(f); frames.push(f); await sleep(80); }
    await gif(frames, path.join(OUT, 'bots-walking.gif')); for (const f of frames) await fs.rm(f);
    report.perfErrors = A.errors; A.close(); for (const k of kids.splice(0)) k.kill('SIGKILL'); await sleep(300);
    const S = await browser('solo'); await S.go(url(`walk=1&owner=ML-011&as=solo&relay=off&nolock`)); await S.until(ready); await sleep(2500); await S.ev(`__walk.look(Math.PI * .25, -.25); true`); await sleep(600);
    report.perfSolo = await S.ev(measure); S.close();
  }
  // ── OFFLINE: no relay on the port; the page stays quiet, says so, and your chat still pops over your head
  if (!ONLY || ONLY === 'offline') {
    const O = await browser('offline'); await O.go(url(`walk=1&owner=ML-011&as=solo&relay=ws://127.0.0.1:${PORT + 7}/mainland&nolock`)); await O.until(ready); await sleep(1500);
    await O.key('Enter', 'Enter', 13); await O.type('anyone around?'); await O.key('Enter', 'Enter', 13); await sleep(700);
    report.offline = await O.ev(`({ status: __chat.status(), pill: document.querySelector('#mlc-pill').textContent, me: __chat.ents().find(e => e.k === 'me') })`);
    await O.shot(path.join(OUT, 'offline.png')); report.offlineErrors = O.errors; O.close();
  }
  // ── INSIDE: alice goes in a door; bob sees her tag at the door; out again; the builder still opens
  if (!ONLY || ONLY === 'inside') {
    relay(); await sleep(400); const R = `relay=ws://127.0.0.1:${PORT}/mainland&nolock`;
    const [A, B] = await Promise.all([browser('alice'), browser('bob')]);
    await A.go(url(`walk=1&owner=ML-011&as=alice&${R}`)); await A.until(ready); await B.go(url(`walk=1&as=bob&${R}`)); await B.until(ready);
    await B.until(`__chat.peers.all().length === 1`);
    const d = await A.ev(`(() => { const d = __walk.doors().find(d => d.id === 'ML-011') || __walk.doors()[0]; const l = Math.hypot(d.out[0], d.out[1]); __walk.place(d.x + d.out[0] / l * 1.0, d.z + d.out[1] / l * 1.0, Math.atan2(-d.out[0], -d.out[1])); return { id: d.id, x: d.x, z: d.z, ox: d.out[0] / l, oz: d.out[1] / l, addr: d.addr }; })()`);
    await B.ev(`__walk.place(${d.x + d.ox * 7}, ${d.z + d.oz * 7}, ${Math.atan2(-d.ox, -d.oz)}); __walk.look(${Math.atan2(-d.ox, -d.oz)}, -.15); true`);
    await sleep(1200); report.atDoor = await A.ev(`({ hiddenBefore: document.hidden, door: __walk.S.door && __walk.S.door.id, p: [__walk.S.p.x, __walk.S.p.z], d: [${d.x}, ${d.z}] })`);
    await A.key('e', 'KeyE', 69); await A.until(`__walk.S.inside && __walk.S.entered`, 30000).catch(async e => { report.insideFail = { err: String(e), s: await A.ev(`({ inside: __walk.S.inside, entered: __walk.S.entered, door: __walk.S.door && __walk.S.door.id, back: __walk.S.back && __walk.S.back.id, overlays: [...document.body.children].map(e => e.id || e.className).join(' ') })`), errors: A.errors }; await A.shot(path.join(OUT, 'debug-inside.png')); throw e; }); await sleep(2500);
    report.inside = await B.ev(`({ tag: __chat.ents().find(e => e.k !== 'me')?.tag, op: __chat.ents().find(e => e.k !== 'me')?.op, mode: __chat.peers.all()[0]?.mode, away: __chat.peers.all()[0]?.away, fade: __chat.peers.all()[0]?.fade })`); report.aliceIdle = await A.ev(`({ idle: __chat.idle(), hidden: document.hidden })`);
    await B.shot(path.join(OUT, 'inside-bob-view.png'));
    await A.key('Escape', 'Escape', 27); await sleep(1500); const back = await A.ev(`({ inside: __walk.S.inside, over: !document.querySelector('#mlc-over').hidden })`);
    if (back.inside) { await A.ev(`document.querySelector('[data-a=close], .mi-close, button[aria-label*=lose]')?.click(); true`); await sleep(1500); }
    report.outside = await A.ev(`({ inside: __walk.S.inside, over: !document.querySelector('#mlc-over').hidden, pill: !document.querySelector('#mlc-pill').hidden })`);
    await A.ev(`__walk.stop(); true`); await sleep(500);
    await A.go(url(`plot=ML-011&build=1&owner=ML-011&as=alice&${R}`)); await A.until(`window.__ready && document.querySelector('#mb-bar') && !document.querySelector('#mb-bar').hidden`, 90000).catch(e => report.builder = String(e)); await sleep(1200);
    report.builder ??= await A.ev(`({ bar: !!document.querySelector('#mb-bar'), chatPill: document.querySelector('#mlc-pill')?.textContent })`); await A.shot(path.join(OUT, 'builder-with-chat.png'));
    report.insideErrors = { alice: A.errors, bob: B.errors }; A.close(); B.close(); for (const k of kids.splice(0)) k.kill('SIGKILL'); await sleep(300);
  }
  // ── UI: the handle prompt on a first visit, a click on a tag (mute / hide), the people list on the pill
  if (!ONLY || ONLY === 'ui') {
    relay(['--bots', '4', '--bots-at', '-30,-95']); await sleep(400);
    const U = await browser('ui'); await U.go(url(`walk=1&owner=ML-011&relay=ws://127.0.0.1:${PORT}/mainland&nolock`)); await U.until(ready); await U.until(`!document.querySelector('#mlc-prompt').hidden`, 20000);
    await sleep(400); await U.shot(path.join(OUT, 'handle-prompt.png'));
    await U.type('slime'); await U.key('Enter', 'Enter', 13); await sleep(600);
    report.handle = await U.ev(`({ prompt: document.querySelector('#mlc-prompt').hidden ? 'closed' : 'open', stored: localStorage.getItem('ml.handle'), me: __chat.me.name })`);
    await U.until(`__chat.peers.all().length >= 4`);
    // face the nearest bot and wait for its tag to be on screen
    const t = await U.ev(`(() => { const S = __walk.S, ps = __chat.peers.all().filter(p => p.shown).sort((a, b) => Math.hypot(a.vis.x - S.p.x, a.vis.z - S.p.z) - Math.hypot(b.vis.x - S.p.x, b.vis.z - S.p.z)); const p = ps[0]; __walk.look(Math.atan2(p.vis.x - S.p.x, p.vis.z - S.p.z) + .2, -.25); return p.sid; })()`);
    await sleep(900); const r = await U.ev(`(() => { const e = __chat.ents().find(e => e.k === '${t}'); const el = [...document.querySelectorAll('.mlc-tag')].find(x => x.offsetParent && x.textContent.includes(__chat.names.get('${t}').name)); const b = el?.getBoundingClientRect(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    if (r) { for (const type of ['mousePressed', 'mouseReleased']) await U.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 }); await sleep(300); await U.shot(path.join(OUT, 'tag-menu.png'));
      report.menu = await U.ev(`({ open: !document.querySelector('#mlc-menu').hidden, text: document.querySelector('#mlc-menu').textContent })`);
      const mb = await U.ev(`(() => { const b = [...document.querySelectorAll('#mlc-menu button')].find(b => b.textContent === 'mute').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) await U.send('Input.dispatchMouseEvent', { type, x: mb.x, y: mb.y, button: 'left', clickCount: 1 }); await sleep(200);
      report.muteClick = await U.ev(`({ mutes: [...__chat.mutes], stored: localStorage.getItem('ml.mute'), tag: __chat.ents().find(e => e.k === '${t}')?.tag })`); }
    else report.menu = 'no tag on screen';
    await U.ev(`document.querySelector('#mlc-pill').click(); true`); await sleep(300); await U.shot(path.join(OUT, 'people-list.png'));
    report.chipOpensBar = await U.ev(`(() => { document.querySelector('#mlc-pill .k').click(); return !document.querySelector('#mlc-bar').hidden && document.activeElement === document.querySelector('#mlc-bar input'); })()`);
    report.uiErrors = U.errors; U.close();
  }
} finally { console.log(JSON.stringify(report, null, 1)); done(); }
process.exit(0);
