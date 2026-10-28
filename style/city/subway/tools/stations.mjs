// MOVEMENT W3b · a contact sheet of the stations and the route boards: each subway kiosk (its TIDE / NEON bullets and line maps) and a few
// bus shelters, framed from the street (?cam=…&look=…, shot mode) → JPGs + a sheet. Dev tool.
//   node style/city/subway/tools/stations.mjs [--base http://127.0.0.1:5351/style/city/] [--out style/city/shots/movement/w3b/stations] [--only id,id]
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../ui/tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5351/style/city/'), OUT = path.resolve(opt('out', 'style/city/shots/movement/w3b/stations')), ONLY = opt('only', '');
const W = JSON.parse(await fs.readFile(new URL('../../../../world/export/world.json', import.meta.url), 'utf8'));
const res = JSON.parse(await fs.readFile(new URL('../../simstate/reserved.json', import.meta.url), 'utf8'));
const items = [];
for (const s of W.transit.stations) { const f = s.face === '-z' ? -1 : 1; items.push({ id: s.id, label: s.name + ' · ' + s.lines.join('+').toUpperCase(), cam: [s.x - 2, 4.4, s.z + f * 11.5], look: [s.x - 2.5, 1.6, s.z + f * 2] }); }
for (const id of ['bus-mall-gate', 'bus-central-ivy', 'bus-route-9-motel', 'bus-sunny-acres', 'bus-jackson-kent', 'bus-union-gatehill']) { const t = res.transit.find(t => t.id === id); if (!t) continue;
  const rot = t.rot ?? 0, nx = [0, 1, 0, -1][rot], nz = [1, 0, -1, 0][rot]; items.push({ id, label: `${t.name} · ${t.route || 'NO SVC'}`, cam: [t.x + nx * 7 + nz * 3, 2.6, t.z + nz * 7 - nx * 3], look: [t.x, 2.2, t.z] }); }
await fs.mkdir(OUT, { recursive: true });
const S = await open({ w: 960, h: 600 }), done = [];
try {
  for (const it of items) { if (ONLY && !ONLY.split(',').includes(it.id)) continue;
    const u = `${BASE}?shot=1&peds=0&cars=0&w=960&h=600&cam=${it.cam.map(v => v.toFixed(1)).join(',')}&look=${it.look.map(v => v.toFixed(1)).join(',')}`;
    try { await S.go(u, { until: "document.title === 'ready'", ms: 240000 }); } catch (e) { console.log(it.id, 'not ready', e.message); continue; }
    await sleep(400); const f = path.join(OUT, it.id + '.png'); await S.shot(f); execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', f, '--out', f.replace('.png', '.jpg')], { stdio: 'ignore' }); await fs.rm(f);
    done.push({ ...it, file: f.replace('.png', '.jpg') }); console.log('shot', it.id); }
} finally { await S.close(); }
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify(done.map(d => ({ id: d.id, label: d.label, file: path.basename(d.file) })), null, 1));
