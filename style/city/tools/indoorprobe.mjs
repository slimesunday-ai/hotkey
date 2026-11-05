// C2-indoors · WHAT A PLAYER SEES FOLLOWING AN AGENT HOME (GAME.md §41, slime 10-30: "if the agent goes into a house, we should watch them
// enter the house, then be inside the house with the agent"). Headless Chrome on ?sim=record; for each --follow agent:minute (the
// minute its trip home ends), the orbit camera is put over it a little before, the viewer clicks the person and its card's Follow
// (real pointer clicks), the record plays at --speed, and shots are taken at moments read from the drawing: on its step, at
// the door, inside, at what it does there, and, when it leaves again before --until, at the door on its way out and back on the street.
// Each moment is shot twice: the follow cam as the viewer has it (its angle and zoom are the rig's and slime's) and --over, the orbit
// camera put over the house from the street side (the room cut open). One sheet per agent in --out.
//   --homes N: one more sheet, the rooms of N agents asleep at night (the camera over each house), their layouts and skins named
//   node style/city/tools/indoorprobe.mjs --port 5974 [--seed 404] --follow a03:1860.61,a12:2719.04,a24:2100.67:2220 [--homes 10] [--keep]
//   (agent:minute its trip home ends[:minute it leaves again]; --keep keeps the single frames beside the sheets)
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chrome, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5974), SEED = +arg('seed', 404), SPEED = +arg('speed', 1), HOMES = +arg('homes', 0), BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-indoors')));
const FOLLOW = (arg('follow', '') || '').split(',').filter(Boolean).map(s => { const [id, m, until] = s.split(':'); return { id, arr: +m, until: until ? +until : null }; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hhmm = m => { const x = ((m % 1440) + 1440) % 1440; return `day ${Math.floor(m / 1440)} ${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}`; };

async function open(B, minute, night) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=${night ? 'night' : 'day'}&simtod=0&recordAt=${minute}&recordPaused=1&recordSpeed=${SPEED}` });
  let ok = false; for (let t = 0; t < (+process.env.LOADN || 600) && !ok; t++) { ok = await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1)`, false).catch(() => false); if (!ok) await sleep(400); }
  if (!ok) throw new Error('the record page did not load: ' + (B.errors[0] ?? 'timeout') + ' ' + JSON.stringify(await B.ev('[location.href, !!window.__record, !!window.__city, window.__city?.loading, window.__record?.clock?.pageT, document.title]', false).catch(e => String(e))) + ' ' + B.logs.slice(-5).join(' / ')); await sleep(2500);
}
// the orbit camera over a point from the street side of the house (its door's face), and back off `k`
const over = (B, id, k = 1, house = false) => B.ev(`(() => { const D = window.__record.draw, a = D.agents.map.get(${JSON.stringify(id)}), p = D.indoors?.planOf(${JSON.stringify(id)}), c = window.__city; if (!p) return false;
  const q = ${house} || !a?.w ? [p.h.cx, p.h.cz] : [a.w.p[0], a.w.p[2]], f = p.door.face, k = ${k}; c.controls.target.set(q[0], .8, q[1]); c.camera.position.set(q[0] + f[0] * 8 * k + f[1] * 3 * k, 8.5 * k, q[1] + f[1] * 8 * k - f[0] * 3 * k); c.controls.update?.(); return true; })()`);
// a real click on the agent's walker (its head projected to the screen), then on its card's Follow
async function clickOn(B, id) {
  const p = await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(id)}), c = window.__city; if (!a?.w) return null; const v = new c.THREE.Vector3(a.w.p[0], a.w.p[1] + 1.1, a.w.p[2]).project(c.camera), r = c.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; })()`);
  if (!p) return false;
  const press = async q => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: q.x, y: q.y, button: 'left', clickCount: 1, pointerType: 'mouse' }); };
  // (on the record path a click on a person opens its card; the card's Follow puts the camera on it)
  await press(p); await sleep(900);
  const f = await B.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => /^\\s*follow\\s*f\\s*$/i.test(b.textContent || '') && b.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (process.env.DBG) console.log('buttons', await B.ev(`[...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.textContent || '').trim().slice(0, 20)).join(' | ')`), f);
  if (f) await press(f);
  await sleep(1500); return B.ev(`(() => { const c = window.__city.cam; return c?.mode === 'follow' && c.subject?.aid === ${JSON.stringify(id)} ? true : [c?.mode, c?.subject?.aid ?? null]; })()`);
}
const state = (B, id) => B.ev(`(() => { const D = window.__record.draw, a = D.agents.map.get(${JSON.stringify(id)}), P = D.indoors?.inside.get(${JSON.stringify(id)}); return { m: window.__record.player.minute, mode: a?.mode ?? null, inside: !!P?.inside, door: P?.door ?? 0, act: P?.act ?? null, clip: P?.clip ?? null, walking: !!P?.v, open: window.__city.recordHomes?.stats.open ?? null }; })()`);
async function shot(B, file) { const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
// both cameras at one paused moment: the follow cam as it is, then the orbit over the house (and back on the agent after)
async function both(B, id, base, label) {
  const files = [{ file: await shot(B, base + '-follow.jpg'), label: label + ' · follow cam' }];
  const cam = await B.ev(`(() => { const c = window.__city; return [c.camera.position.toArray(), c.controls.target.toArray()]; })()`);
  await B.ev(`window.__city.cam.setMode('orbit')`); await sleep(400); await over(B, id, 1, true); await sleep(900);
  files.push({ file: await shot(B, base + '-over.jpg'), label: label + ' · over the house' });
  await B.ev(`(() => { const c = window.__city, w = c.cam.people.byAid(${JSON.stringify(id)}); if (w) c.cam.setMode('follow', { subject: w }); return true; })()`); await sleep(700);
  void cam; return files;
}
async function sheet(B, tiles, file, cols = 4) {
  const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#eee;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">${
    (await Promise.all(tiles.map(async t => `<figure style="margin:0"><img src="data:image/jpeg;base64,${(await fs.readFile(t.file)).toString('base64')}" style="width:100%"><figcaption>${t.label}</figcaption></figure>`))).join('')}</div></body></html>`;
  const tmp = file.replace(/\.jpg$/, '.html'); await fs.writeFile(tmp, html);
  await B.send('Emulation.setDeviceMetricsOverride', { width: 400 * cols, height: Math.max(400, Math.ceil(tiles.length / cols) * 270 + 20), deviceScaleFactor: 1, mobile: false });
  await B.send('Page.navigate', { url: 'file://' + tmp }); await sleep(1500);
  const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); await fs.rm(tmp);
  await B.send('Emulation.clearDeviceMetricsOverride'); console.log('sheet', path.relative(ROOT, file));
  // (the sheet holds every shot: the single frames go unless --keep)
  if (!process.argv.includes('--keep')) for (const t of tiles) await fs.rm(t.file, { force: true });
}

async function main() {
  const served = await serve(), B = await chrome(); await fs.mkdir(OUT, { recursive: true });
  try {
    for (const F of FOLLOW) {
      const night = (F.arr % 1440) >= 1260 || (F.arr % 1440) < 360, tiles = [], base = path.join(OUT, `${SEED}-${F.id}`);
      await open(B, F.arr - .4, night); await B.ev(`window.__city.cam.setMode('orbit')`); await sleep(300); await over(B, F.id, 1.4); await sleep(1200);
      const followed = await clickOn(B, F.id); console.log(F.id, 'followed by a click:', followed);
      // the moments, as the drawing reaches them: on the step, the door open on the way in, inside walking, at its activity; and leaving
      const want = [['on its step', s => s.mode === 'stand' && !s.inside && s.door === 0 && s.m > F.arr], ['the door, going in', s => s.door > .5 && !s.inside], ['inside', s => s.inside && s.walking],
        ['at home', s => s.inside && !s.walking && !!s.act], ...(F.until ? [['the door, going out', s => s.door > .5 && s.m > F.until - 1], ['back on the street', s => s.mode !== 'stand' && s.m > F.until]] : [])];
      await B.ev(`window.__record.player.play()`);
      const t0 = Date.now(); let k = 0, jumpTo = null;
      while (k < want.length && Date.now() - t0 < 240000) {
        const s = await state(B, F.id);
        // (a moment passed between two looks is skipped: the next one that holds is shot)
        const j = want.findIndex((w, i) => i >= k && w[1](s)); if (j > k) { console.log(F.id, 'passed:', want.slice(k, j).map(w => w[0]).join(', ')); k = j; }
        if (j >= 0) { await B.ev(`window.__record.player.pause()`); await sleep(500); const s2 = await state(B, F.id);
          tiles.push(...await both(B, F.id, `${base}-${k}`, `${F.id} · ${hhmm(s2.m)} · ${want[k][0]}${s2.act ? ' (' + s2.act + ')' : ''}`)); k++;
          // (the stay's middle is skipped: on to a little before it leaves)
          if (k < want.length && want[k][0] === 'the door, going out' && !jumpTo) { jumpTo = F.until - 1.2; await B.ev(`window.__record.player.seek(${jumpTo})`); await sleep(1500); }
          await B.ev(`window.__record.player.play()`); continue; }
        await sleep(60);
      }
      await B.ev(`window.__record.player.pause()`);
      if (k < want.length) console.log(F.id, 'missed moments:', want.slice(k).map(w => w[0]).join(', '), JSON.stringify(await state(B, F.id)));
      await sheet(B, tiles, `${base}-sheet.jpg`, 2);
    }
    if (HOMES) {
      const m = 2 * 1440 + 60; await open(B, m, true);
      const ids = await B.ev(`(() => { const D = window.__record.draw, I = D.indoors; const L = [...I.inside.keys()].sort(); const seen = new Set(), out = []; for (const id of L) { const p = I.planOf(id); const k = p.name + JSON.stringify(p.skin); if (seen.has(k)) continue; seen.add(k); out.push([id, p.name, p.skin.N + ' / ' + p.skin.E + ' / ' + p.skin.floor]); } return out; })()`);
      const tiles = [];
      for (const [id, name, skin] of ids.slice(0, HOMES)) { await over(B, id, 1, true); await sleep(2200); tiles.push({ file: await shot(B, path.join(OUT, `${SEED}-home-${id}.jpg`)), label: `${id} · ${name} · ${skin}` }); }
      await sheet(B, tiles, path.join(OUT, `${SEED}-homes-sheet.jpg`), 5);
    }
    if (B.errors.length) console.log('page errors', B.errors.slice(0, 3));
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
