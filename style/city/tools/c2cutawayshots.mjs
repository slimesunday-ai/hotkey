// C2-camera · WHAT A FOLLOWER SEES GOING HOME (GAME.md §41, slime 10-31: "Rise to the cutaway"). Headless Chrome on ?sim=record at 1x:
// the viewer clicks the agent on the street and its card's Follow (real input, cutawaycheck's way), the record plays it home, and the
// screen is shot as it plays: on the street, through its door (a burst through the rise), about its room, then, sought to a little
// before it leaves, through its door going out (a burst through the ease back down) and back on the street. One contact sheet per
// agent in --out (the single frames go unless --keep).
//   node style/city/tools/c2cutawayshots.mjs --port 5984 --follow a02:2104,a12:2719:night [--out style/city/shots/c2-camera] [--every 220]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5984), SEED = 404, BASE = `http://127.0.0.1:${PORT}`, EVERY = +arg('every', 220);
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-camera')));
const FOLLOW = arg('follow', 'a02:2104').split(',').map(s => { const [id, m, n] = s.split(':'); return { id, near: +m, night: n === 'night' }; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}:${String(Math.floor((x % 1) * 60)).padStart(2, '0')}`; };

async function open(B, minute, night) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${night ? 'night' : 'day'}&simtod=0&recordAt=${minute}&recordPaused=1&recordSpeed=1` });
  let ok = false; for (let t = 0; t < 600 && !ok; t++) { ok = await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1 && window.__city.recordHomes)`, false).catch(() => false); if (!ok) await sleep(400); }
  if (!ok) throw new Error('the record page did not load'); await sleep(2500);
}
const press = async (B, q) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: q.x, y: q.y, button: 'left', clickCount: 1, pointerType: 'mouse' }); };
async function followByCard(B, id) {
  await B.ev(`(() => { const D = window.__record.draw, a = D.agents.map.get(${JSON.stringify(id)}), p = D.indoors?.planOf(${JSON.stringify(id)}), c = window.__city; if (c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true }); if (!a?.w) return false;
    const f = p ? p.door.face : [0, 1], q = [a.w.p[0], a.w.p[2]], k = 1.4; c.controls.target.set(q[0], .8, q[1]); c.camera.position.set(q[0] + f[0] * 8 * k + f[1] * 3 * k, 8.5 * k, q[1] + f[1] * 8 * k - f[0] * 3 * k); c.controls.update?.(); return true; })()`);
  await sleep(1200);
  const p = await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(id)}), c = window.__city; if (!a?.w) return null; const v = new c.THREE.Vector3(a.w.p[0], a.w.p[1] + 1.1, a.w.p[2]).project(c.camera), r = c.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; })()`);
  if (!p) return false; await press(B, p); await sleep(900);
  const f = await B.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => /^\\s*follow\\s*f\\s*$/i.test(b.textContent || '') && b.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (f) await press(B, f); await sleep(1200);
  // (the card closed again: the room is the picture)
  await B.ev(`(() => { const x = [...document.querySelectorAll('#k button')].find(b => /close|×/i.test(b.getAttribute('aria-label') || b.textContent || '') && b.offsetParent); x?.click(); return !!x; })()`);
  return B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(id)}; })()`);
}
const state = (B, id) => B.ev(`(() => { const D = window.__record.draw, P = D.indoors.inside.get(${JSON.stringify(id)}), st = D.indoors.stays.get(${JSON.stringify(id)}), g = window.__city.cam.follow.dbg.room; return { m: window.__record.player.minute, inside: !!P?.inside, door: P?.door ?? 0, act: P?.act ?? null, tOut: st ? st.stay.tOut / 60 : null, cam: g ? g.src + (g.ease < 1 ? ' ' + Math.round(g.ease * 100) + '%' : '') : '' }; })()`);
async function shot(B, file) { const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
async function sheet(B, tiles, file, cols = 4) {
  const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#eee;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">${
    (await Promise.all(tiles.map(async t => `<figure style="margin:0"><img src="data:image/jpeg;base64,${(await fs.readFile(t.file)).toString('base64')}" style="width:100%"><figcaption>${t.label}</figcaption></figure>`))).join('')}</div></body></html>`;
  const tmp = file.replace(/\.jpg$/, '.html'); await fs.writeFile(tmp, html);
  await B.send('Emulation.setDeviceMetricsOverride', { width: 400 * cols, height: Math.max(400, Math.ceil(tiles.length / cols) * 250 + 20), deviceScaleFactor: 1, mobile: false });
  await B.send('Page.navigate', { url: 'file://' + tmp }); await sleep(1500);
  const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); await fs.rm(tmp);
  await B.send('Emulation.clearDeviceMetricsOverride'); console.log('sheet', path.relative(ROOT, file));
  if (!process.argv.includes('--keep')) for (const t of tiles) await fs.rm(t.file, { force: true });
}

async function main() {
  const served = await serve(), B = await chrome(); await fs.mkdir(OUT, { recursive: true });
  try {
    for (const F of FOLLOW) {
      const tiles = [], base = path.join(OUT, `${SEED}-${F.id}`); let n = 0;
      const take = async label => { const s = await state(B, F.id); tiles.push({ file: await shot(B, `${base}-${String(n++).padStart(2, '0')}.jpg`), label: `${F.id} · ${hhmm(s.m)} · ${label} · ${s.cam}` }); return s; };
      await open(B, F.near - 3, F.night);
      const arr = await B.ev(`(() => { const D = window.__record.draw; for (let m = ${F.near - 3}; m < ${F.near + 3}; m += .05) { const s = D.stateAt(${JSON.stringify(F.id)}, m); if (s.trip) return s.trip.arr; } return null; })()`);
      await B.ev(`window.__record.player.seek(${arr - .3})`); await sleep(2500);
      console.log(F.id, 'followed by its card:', await followByCard(B, F.id));
      await B.ev(`window.__record.player.play()`); await sleep(4000); await take('on the street');
      // through its door: a burst from the door opening to 2 s past the rise (its stay may start minutes after it got home: after a show)
      let s = null; const t0 = Date.now(); while (Date.now() - t0 < 300000) { s = await state(B, F.id); if (s.door > .3 || s.inside) break; await sleep(50); }
      const tb = Date.now(); while (Date.now() - tb < 3200) { s = await take(s.inside ? 'inside, the rise' : 'at its door'); await sleep(EVERY); }
      await sleep(2500); await take('about its room');
      await sleep(5000); await take('about its room');
      s = await state(B, F.id); if (!Number.isFinite(s.tOut)) { console.log(F.id, 'no stay to leave'); continue; } await B.ev(`window.__record.player.seek(${s.tOut - .3})`); await sleep(1500); await take('a little before it leaves');
      const t1 = Date.now(); while (Date.now() - t1 < 40000) { s = await state(B, F.id); if (!s.inside) break; await sleep(50); }
      const tc = Date.now(); while (Date.now() - tc < 2600) { await take('out its door, easing down'); await sleep(EVERY); }
      await sleep(2500); await take('back on the street');
      await B.ev(`window.__record.player.pause()`);
      await sheet(B, tiles, `${base}-sheet.jpg`, 4);
    }
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
