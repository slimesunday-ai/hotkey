// C2-indoors2 · A CONTACT SHEET OF A REWIND ACROSS A DISCLOSURE IN AN OPEN ROOM. Headless Chrome on ?sim=record, seed --seed: the
// camera over --id's house from the street side (nobody followed: its room opens as the nearest occupied one), its room open at
// --after (a minute after its holdings receipt of --at is published), then a seek back to --before: shots of the open room, the first
// frame after the seek, and 6 and 13 frames on, each captioned with the receipt the record presents and what the room shows.
//   node style/city/tools/indoorrewindshots.mjs --port 5976 --id a04 --after 5612 --before 4672 [--root <checkout>] [--label after]
//   (one row per run, written to --rows <dir>; --sheet a.json,b.json composes the rows of earlier runs into style/city/shots/c2-indoors2/rewind-<id>.jpg)
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chrome } from './recordscenario.mjs';

const HERE = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5976), SEED = +arg('seed', 404), ROOT = path.resolve(arg('root', HERE)), ID = arg('id', 'a04'), AFTER = +arg('after', 5612), BEFORE = +arg('before', 4672);
const LABEL = arg('label', path.basename(ROOT)), SHEET = arg('sheet', null), OUT = path.join(HERE, 'style/city/shots/c2-indoors2'), BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function answers() { try { return (await fetch(BASE + '/style/city/index.html', { method: 'HEAD' })).ok; } catch { return false; } }

async function sheet(B, rows) {
  const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#eee;font:13px system-ui">${rows.map(r => `<h3 style="margin:8px 6px 0">${r.label}</h3><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${
    r.tiles.map(t => `<figure style="margin:0"><img src="data:image/jpeg;base64,${t.b64}" style="width:100%"><figcaption>${t.cap}</figcaption></figure>`).join('')}</div>`).join('')}</body></html>`;
  const tmp = path.join(OUT, `rewind-${ID}.html`); await fs.writeFile(tmp, html);
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: rows.length * 330 + 20, deviceScaleFactor: 1, mobile: false });
  await B.send('Page.navigate', { url: 'file://' + tmp }); await sleep(1500);
  const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true }); const file = path.join(OUT, `rewind-${ID}.jpg`); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); await fs.rm(tmp);
  console.log('sheet', path.relative(HERE, file));
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const B = await chrome();
  if (SHEET) { try { await sheet(B, await Promise.all(SHEET.split(',').map(async f => JSON.parse(await fs.readFile(f, 'utf8'))))); } finally { await B.close(); } return; }
  const served = (await answers()) ? null : spawn(process.execPath, [path.join(ROOT, 'style/serve.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let k = 0; k < 80 && !(await answers()); k++) await sleep(100);
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=day&simtod=0&recordAt=${AFTER}&recordPaused=1` });
    for (let t = 0; t < 300; t++) { if (await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1 && window.__city.recordHomes)`, false).catch(() => false)) break; await sleep(400); }
    await sleep(2000);
    const fr = n => `new Promise(r => { let k = 0; const f = () => (++k >= ${n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`;
    // what the record presents and what the open room shows (the catalogue's names of its filled slots)
    // (the modules loaded first, so the record and the room are read on the very frame a seek lands, the shot taken right after)
    await B.ev(`(async () => { window.__rs = { HO: await import('/style/city/interiors/home/index.js'), PD: await import('/style/city/simstate/record/panel-data.js') }; return true; })()`);
    const state = `(() => { const D = window.__record.draw, P = window.__record.player, RH = window.__city.recordHomes, { HO, PD } = window.__rs;
      const r = PD.tapeAt(P.snapshot(), ${JSON.stringify(ID)}, P.minute).holdings, p = D.indoors.planOf(${JSON.stringify(ID)}); let e = null; for (const x of RH.H.cache.values()) if (x.g.parent && x.g.visible) e = x;
      const open = RH.H.current?.id === p.lot && e; return { m: P.minute, receipt: r ? '#' + r.id + ' (min ' + r.minute + '): cash ' + (r.fields.cash ?? 0) + ', ' + JSON.stringify(r.fields.goods ?? {}) : 'none',
        shows: open ? e.fills.filter(Boolean).map(f => HO.byId.get(f.id)?.name + (f.state ? ' (' + f.state + ')' : '')).join(', ') || '(nothing in its slots)' : '(no room open)' }; })()`;
    const shot = async (cap, pre = '') => { const s = await B.ev(pre + state); const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); return { b64: r.result.data, cap: `${cap} · minute ${s.m.toFixed(2)}<br>record: ${s.receipt}<br>room: ${s.shows}` }; };
    await B.ev(`(async () => { const D = window.__record.draw, c = window.__city, p = D.indoors.planOf(${JSON.stringify(ID)}), f = p.door.face; c.cam?.setMode?.('orbit');
      for (let k = 0; k < 150 && c.recordHomes.H.current?.id !== p.lot; k++) { c.controls.target.set(p.h.cx, .8, p.h.cz); c.camera.position.set(p.h.cx + f[0] * 8 + f[1] * 3, 8.5, p.h.cz + f[1] * 8 - f[0] * 3); c.controls.update?.(); await ${fr(1)}; } await ${fr(10)}; return true; })()`);
    const tiles = [await shot(`${ID}: its room open after the receipt`)];
    tiles.push(await shot('the seek back, as it lands', `window.__record.player.seek(${BEFORE}), `));
    await B.ev(`${fr(5)}.then(() => true)`); tiles.push(await shot('6 frames after the seek'));
    await B.ev(`${fr(7)}.then(() => true)`); tiles.push(await shot('13 frames after the seek'));
    const row = { label: `${LABEL}: ${ID}, rewind from ${AFTER} to ${BEFORE}`, tiles }, file = path.join(path.resolve(arg('rows', OUT)), `rewind-${ID}-${LABEL}.json`);
    await fs.writeFile(file, JSON.stringify(row)); console.log('row', file);
  } finally { await B.close(); if (served) served.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
