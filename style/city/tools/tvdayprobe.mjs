// C2-tvday · WHAT THE DAY DIRECTOR'S CAMERA SAW: directorscenario.mjs's day step (its windows, its page, its SEEN test, its credit:
// the establishing view showing the place or a subject, the close-up showing a subject 0.5 island minutes or more after the cut),
// with the reason for each cut it does not credit: per sample, each subject's sight from the camera (seen / out of frame / a STATIC
// solid between: blocked), whether draw.js has it INSIDE its home (C2-indoors) and which room the homes runtime has open. A subject inside
// is also sampled through the render (the homes runtime's depth pick with the cut applied, cutawaycheck's test): the collision world keeps
// the cut-open house solid, so its rays call a subject in its open room blocked. Both credits are printed. Measures only.
//   node style/city/tools/tvdayprobe.mjs --port <p> [--seeds 404] [--out <file.json>] [--shots <dir>]
//   --shots: a contact sheet of TV mode by day (an indoor close-up, a street close-up, an indoor moment's establishing view) into <dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), BASE = `http://127.0.0.1:${PORT}`, SEEDS = arg('seeds', '404').split(',').map(Number), OUT = arg('out', null), SHOTS = arg('shots', null), DAY = 1440;
const FEED = s => `/core/runs/${s}-A/feed.jsonl`, sleep = ms => new Promise(r => setTimeout(r, ms));
function windows(seed) { let x = seed * 2654435761 % 4294967296; const rnd = () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return [0, 1].map(() => { const d = 1 + Math.floor(rnd() * 13); return d * DAY + 360 + Math.floor(rnd() * 880); }); }
// (directorscenario.mjs's SEEN, with the reason per figure)
const SEEN = `(figs) => { const C = window.__city, T = C.THREE, cam = C.camera, W = C.cam?.world, r = C.renderer.domElement.getBoundingClientRect();
  let floor = r.bottom; for (const id of ['r-tv-cap', 'r-ticker', 'record-player']) { const el = document.getElementById(id), b = el && !el.hidden ? el.getBoundingClientRect() : null; if (b && b.height > 0) floor = Math.min(floor, b.top); }
  const V = new T.Vector3(); return figs.map(f => { let why = 'out';
    for (const dy of [1.1, 1.6]) { V.set(f.x, (f.y || 0) + dy, f.z).project(cam); const py = r.top + (1 - V.y) / 2 * r.height;
      if (V.z > 1 || Math.abs(V.x) > .96 || Math.abs(V.y) > .96 || py > floor - 6) continue;
      if (!W?.ready?.(f.x, f.z)) { why = 'unknown'; continue; }
      if (W.ray(cam.position, { x: f.x, y: (f.y || 0) + dy, z: f.z }, 1)) { why = 'blocked'; continue; }
      return 'seen'; }
    return why; }); }`;
const SAMPLE = `(async () => { const d = window.__recordUI.director, c = d.current, R = window.__record, m = R.player.minute; if (!c || c.kind !== 'day' || c.moving) return { m, c: null };
  const P = window.__placesForCheck, place = c.place, lot = place && P.HOUSE_LOTS.find(l => l.id === place.cityPlace), q = place && (lot ?? P.CITY_PLACES[place.standPlace] ?? P.CITY_PLACES[place.cityPlace]);
  const est = q ? window.__tvSeen([{ x: q.x, y: -.1, z: q.z }])[0] : 'none', I = R.draw.indoors;
  const subj = c.subjects.map(id => { const a = R.draw.agents?.map.get(id), P2 = I?.inside?.get(id); return a?.w ? { id, x: a.w.p[0], y: a.w.p[1], z: a.w.p[2], inside: P2 ? !!P2.inside : false, door: P2?.door ?? 0 } : { id, none: true }; });
  const sight = window.__tvSeen(subj.filter(s => !s.none));
  const cam = window.__city.camera.position, H = window.__city.recordHomes?.H, C = window.__city, r = C.renderer.domElement.getBoundingClientRect();
  // (a subject inside, also through the render: the homes runtime's depth pick, the cut applied, as cutawaycheck samples it)
  for (const s of subj) { if (s.none || !s.inside || !H?.hitAt) continue; s.render = 'out';
    for (const dy of [.5, 1, 1.45]) { const V = new C.THREE.Vector3(s.x, s.y + dy, s.z).project(C.camera); if (V.z > 1 || Math.abs(V.x) > .96 || Math.abs(V.y) > .96) continue;
      const hit = await H.hitAt(r.left + (V.x + 1) / 2 * r.width, r.top + (1 - V.y) / 2 * r.height), d = Math.hypot(s.x - cam.x, s.y + dy - cam.y, s.z - cam.z);
      if (!hit || hit.distanceTo(cam) >= d - .5) { s.render = 'seen'; break; } s.render = 'hidden'; } }
  return { m, c: { id: c.id, phase: c.phase, start: c.minute, place: place?.cityPlace ?? null, lot: !!lot }, est, subj: subj.map((s, i) => ({ id: s.id, inside: s.inside ?? null, door: s.door ?? 0, sight: s.none ? 'none' : sight.shift(), render: s.render ?? null, d: s.none ? null : +Math.hypot(cam.x - s.x, cam.z - s.z).toFixed(1) })),
    room: window.__city.recordHomes?.open ?? null, cam: [cam.x, cam.y, cam.z].map(v => +v.toFixed(1)) }; })()`;

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/tvdayprobe.mjs --port <port>'); process.exit(2); }
  const server = await serve(), B = await chrome(), all = [], tiles = new Map();
  if (SHOTS) await fs.mkdir(path.resolve(SHOTS), { recursive: true });
  try {
    for (const seed of SEEDS) for (const w0 of windows(seed)) {
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&recordAt=${w0}&recordSpeed=10&tod=day&simtod=0&tv=1` }); await ready(B);
      for (let t = 0; t < 100 && !(await B.ev('!!window.__recordUI?.director', false).catch(() => false)); t++) await sleep(200);
      await B.ev(`(async () => { window.__placesForCheck = await import('/style/city/simstate/record/places.js'); window.__tvSeen = ${SEEN}; return true; })()`); await sleep(800);
      await B.ev(`window.__record.player.seek(${w0}); window.__record.player.play(); true`);
      const cuts = new Map(), t0 = Date.now();
      while (Date.now() - t0 < 64000) {
        const s = await B.ev(SAMPLE);
        if (SHOTS && s.c && s.m >= w0) { const inn = s.subj.find(x => x.inside), k = s.c.phase === 'close' ? (inn ? (inn.render === 'seen' ? 'indoor' : null) : s.subj.some(x => x.sight === 'seen') ? 'street' : null) : inn && s.c.lot ? 'indoor-est' : null;
          if (k && !tiles.has(k)) { const r = await B.send('Page.captureScreenshot', { format: 'png' }), f = path.join(path.resolve(SHOTS), `${k}.png`); await fs.writeFile(f, Buffer.from(r.result.data, 'base64'));
            const who = s.subj.map(x => `${x.id}${x.inside ? ' inside' : ''}`).join(', '), clock = `${String(Math.floor(s.m % DAY / 60)).padStart(2, '0')}:${String(Math.floor(s.m % 60)).padStart(2, '0')}`;
            tiles.set(k, { file: f, label: `Seed ${seed} day ${Math.floor(s.m / DAY)} ${clock} · TV ${s.c.phase === 'close' ? 'close-up' : 'establishing'} · ${s.c.place} · ${who}` }); } }
        if (s.m >= w0 + 10) break;
        if (s.c && s.m >= w0) { const e = cuts.get(s.c.id) ?? { start: s.c.start, place: s.c.place, lot: s.c.lot, est: null, close: null, estR: null, closeR: null, samples: [] }; cuts.set(s.c.id, e);
          const sub = s.subj.some(x => x.sight === 'seen'), subR = s.subj.some(x => x.sight === 'seen' || x.render === 'seen');
          if (s.c.phase === 'est' && (s.est === 'seen' || sub) && e.est === null) e.est = s.m; if (s.c.phase === 'close' && sub && e.close === null) e.close = s.m;
          if (s.c.phase === 'est' && (s.est === 'seen' || subR) && e.estR === null) e.estR = s.m; if (s.c.phase === 'close' && subR && e.closeR === null) e.closeR = s.m;
          e.samples.push([+(s.m - s.c.start).toFixed(2), s.c.phase, s.est, s.subj.map(x => `${x.id}${x.inside ? '(in)' : x.door ? '(door)' : ''}:${x.sight}${x.render ? '/render ' + x.render : ''}@${x.d}`).join(' '), s.room, s.cam.join(',')]); }
        await sleep(500);
      }
      const moves = await B.ev(`(() => { const L = window.__recordUI.director.log; return { moves: L.moves, reframes: L.reframes, blocked: L.blocked }; })()`);
      const logged = await B.ev(`window.__recordUI.director.log.cuts.filter(c => c.kind === 'day' && c.minute >= ${w0} && c.minute < ${w0 + 10}).map(c => c.id)`);
      const rows = logged.map(id => { const e = cuts.get(id); const ok = !!e && e.est !== null && e.close !== null && e.close - e.start >= .5 - 1e-6;
        const okR = !!e && e.estR !== null && e.closeR !== null && e.closeR - e.start >= .5 - 1e-6;
        return { id, ok, okR, place: e?.place ?? null, lot: e?.lot ?? null, est: e?.est ?? null, close: e?.close ?? null, samples: e?.samples ?? [] }; });
      all.push({ seed, window: w0, director: moves, cuts: rows.length, credited: rows.filter(r => r.ok).length, creditedRender: rows.filter(r => r.okR).length, rows });
      console.log(`seed ${seed} window ${w0}: ${rows.filter(r => r.ok).length}/${rows.length} (collision rays, directorscenario's) · ${rows.filter(r => r.okR).length}/${rows.length} (an indoor subject through the render) · director moves ${moves.moves}, sight blocked ${moves.blocked}, reframes ${moves.reframes}`);
      for (const r of rows) { const last = r.samples.filter(x => x[1] === 'close'), why = last.length ? last[Math.floor(last.length / 2)] : r.samples.at(-1);
        console.log(`  ${r.ok ? 'credited ' : r.okR ? 'render   ' : 'MISSED   '} ${r.id.split(':').slice(2).join(':').slice(0, 44).padEnd(44)} ${String(r.place).padEnd(22)} est ${r.est === null ? '-' : 'ok'} close ${r.close === null ? '-' : 'ok'} · ${why ? `${why[1]} place:${why[2]} ${why[3]} room:${why[4]}` : 'no samples'}`); }
    }
  } finally { await B.close(); server?.kill(); }
  if (SHOTS && tiles.size) { const T = ['indoor-est', 'indoor', 'street'].filter(k => tiles.has(k)).map(k => tiles.get(k)), sheet = path.join(path.resolve(SHOTS), 'sheet.jpg');
    const py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(T)], { encoding: 'utf8' }); console.log(py.status ? 'sheet: ' + py.stderr : 'sheet ' + sheet); }
  if (OUT) await fs.writeFile(path.resolve(OUT), JSON.stringify(all, null, 1));
  const n = all.reduce((a, w) => a + w.cuts, 0), k = all.reduce((a, w) => a + w.credited, 0), kR = all.reduce((a, w) => a + w.creditedRender, 0);
  console.log(`TVDAYPROBE credited ${k}/${n} by the collision world's rays (directorscenario's test) · ${kR}/${n} with an indoor subject seen through the render`);
}
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 600, 12, 44
cols = 2 if len(tiles) > 1 else 1; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * (th + bar) + (rows + 1) * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S)
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(40, 46, 60)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
