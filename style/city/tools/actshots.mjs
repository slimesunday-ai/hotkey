// C2 · WHAT A FOLLOWER SEES OF THE DAY'S ERRANDS (stage/acts.js). Headless Chrome on ?sim=record, two contact sheets:
//   burst   one agent followed (?follow=, the player's own follow) through a morning burst, played at 10x without a seek: a frame at the
//           middle of each of its acts and one on the way between, each captioned with the minute, the act's kind and its place. The
//           page's frame time over the burst (rAF): --tag names the run (before / after) for the scorecard
//   kinds   one frame of each act kind the seed has (the first act of each), sought there, the camera put beside its actor
//   node style/city/tools/actshots.mjs --port 5960 [--seed 404] [--id a02] [--day 11] [--from 9.7] [--to 10.45] [--out style/city/shots/c2-acts]
//     [--tag after] [--only burst,kinds]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, PORT, arg, sleep, chrome, ready, serve } from './c2lib.mjs';

const SEED = +arg('seed', 404), ID = arg('id', 'a02'), DAY = +arg('day', 11), FROM = DAY * 1440 + +arg('from', 9.7) * 60, TO = DAY * 1440 + +arg('to', 10.45) * 60;
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-acts'))), TAG = arg('tag', 'after'), ONLY = arg('only', 'burst,kinds').split(',');
const load = name => import(pathToFileURL(path.join(ROOT, 'style/city', name)).href);
const [{ parseFeed }, { createRoutinePlanner }] = await Promise.all([load('simstate/record/adapter.js'), load('simstate/record/routines.js')]);
const ACTS = await load('stage/acts.js').catch(() => null);
const frames = parseFeed(fs.readFileSync(path.join(ROOT, `core/runs/${SEED}-A/feed.jsonl`), 'utf8')), routines = createRoutinePlanner(frames);
const days = [...new Set(frames.map(f => f.day))], all = days.flatMap(d => routines.day(d).acts.filter(c => !c.blocked));
const hhmm = m => { const r = ((m % 1440) + 1440) % 1440; return `d${Math.floor(m / 1440)} ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(Math.floor(r % 60)).padStart(2, '0')}`; };
const BASE = `http://127.0.0.1:${PORT}`, FEED = `/core/runs/${SEED}-A/feed.jsonl`;
await fsp.mkdir(OUT, { recursive: true });
const shot = async (B, file) => { const r = await B.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); await fsp.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; };
// the sheet: frames in a grid, each with its caption under it (PIL)
function sheet(items, out, title) {
  const py = `import json,sys
from PIL import Image, ImageDraw, ImageFont
items=json.load(open(sys.argv[1])); out=sys.argv[2]; title=sys.argv[3]
W,H=480,300; cols=3; rows=(len(items)+cols-1)//cols; cap=38
S=Image.new('RGB',(cols*W,rows*(H+cap)+44),(18,19,24)); d=ImageDraw.Draw(S)
try: F=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15); T=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',20)
except Exception: F=T=ImageFont.load_default()
d.text((12,10),title,fill=(240,236,220),font=T)
for k,it in enumerate(items):
  x=(k%cols)*W; y=44+(k//cols)*(H+cap); im=Image.open(it['file']).convert('RGB').resize((W,H)); S.paste(im,(x,y))
  d.text((x+8,y+H+4),it['caption'][:62],fill=(235,230,215),font=F); d.text((x+8,y+H+20),it.get('sub','')[:62],fill=(170,168,160),font=F)
S.save(out,quality=86)`;
  const tmp = out + '.json'; fs.writeFileSync(tmp, JSON.stringify(items));
  const r = spawnSync('python3', ['-c', py, tmp, out, title], { encoding: 'utf8' }); fs.rmSync(tmp);
  if (r.status) throw new Error(r.stderr);
  return out;
}
const server = await serve();
const report = { seed: SEED, tag: TAG };
try {
  if (ONLY.includes('burst')) {
    const mine = all.filter(c => c.participants.includes(ID) && c.minute >= FROM && c.minute < TO).sort((a, b) => a.minute - b.minute);
    const marks = [];
    for (let i = 0; i < mine.length; i++) { const c = mine[i]; marks.push({ m: c.minute + Math.min(.6, c.minimum / 2), cue: c });
      const n = mine[i + 1]; if (n && n.departure > c.minute + c.minimum + .3) marks.push({ m: (c.minute + c.minimum + n.minute) / 2, way: n }); }
    const B = await chrome();
    try {
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&tod=day&recordAt=${FROM}&recordSpeed=10&recordPaused=1&follow=${ID}` });
      await ready(B, 240000); await sleep(5000);
      await B.ev(`(() => { window.__actsMs = []; const A = window.__record.draw.scenes?.acts; if (A) { const f = A.frame; A.frame = () => { const t = performance.now(); f(); window.__actsMs.push(performance.now() - t); }; } window.__actsFt = []; let last = performance.now(); const f = t => { window.__actsFt.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); window.__record.player.play(); return true; })()`);
      const items = [];
      for (const k of marks) {
        for (let t = 0; t < 2000; t++) { const m = await B.ev('window.__record.player.minute'); if (m >= k.m) break; await sleep(30); }
        await B.ev('window.__record.player.pause()'); await sleep(450);
        const st = await B.ev(`(() => { const r = window.__record, s = r.draw.scenes?.acts?.state?.() ?? [], c = window.__city.cam; return { minute: r.player.minute, acts: s.filter(x => x.participants.includes(${JSON.stringify(ID)})), cam: c?.mode, on: c?.subject?.aid ?? null }; })()`);
        const file = path.join(OUT, `${TAG}-burst-${String(items.length).padStart(2, '0')}.jpg`); await shot(B, file);
        const a = st.acts[0], c = k.cue ?? k.way;
        items.push({ file, caption: `${hhmm(st.minute)} ${k.cue ? `${c.kind} at ${c.place.cityPlace}` : `on the way to ${c.kind} (${c.place.cityPlace})`}`,
          sub: a ? `staged: ${a.figures.map(f => `${f.id} ${f.clip}`).join(', ')}${a.tag ? ' · tag ' + a.tag : ''}` : `${k.cue ? 'NOT staged' : 'travelling'} · camera ${st.cam} on ${st.on}` });
        await B.ev('window.__record.player.play()');
      }
      await B.ev('window.__record.player.pause()');
      const ft = (await B.ev('window.__actsFt')).slice(30).sort((a, b) => a - b), q = p => +ft[Math.min(ft.length - 1, Math.floor(ft.length * p))].toFixed(1);
      // (the page's frame time, rAF; the loops' cost per frame, life.js stats; the acts' marks per frame, act-marks.js frame)
      const life = await B.ev('window.__record.draw.agents.life.stats()'), am = (await B.ev('window.__actsMs')).sort((a, b) => a - b), qa = p => am.length ? +am[Math.min(am.length - 1, Math.floor(am.length * p))].toFixed(3) : null;
      report.burst = { id: ID, from: hhmm(FROM), to: hhmm(TO), acts: mine.length, frames: ft.length, p50: q(.5), p95: q(.95), p99: q(.99), max: +ft.at(-1).toFixed(1),
        lifeMs: { p50: life.p50, p95: life.p95, max: life.maxMs }, marksMs: { p50: qa(.5), p95: qa(.95), max: am.length ? +am.at(-1).toFixed(3) : null }, items: items.map(i => [i.caption, i.sub]) };
      report.burst.sheet = sheet(items, path.join(OUT, `${TAG}-burst-${ID}-d${DAY}.jpg`), `seed ${SEED} · following ${ID} · ${hhmm(FROM)}–${hhmm(TO)} at 10x · ${TAG}`);
      console.log(JSON.stringify(report.burst, null, 1));
    } finally { await B.close(); }
  }
  if (ONLY.includes('kinds')) {
    const first = [...new Map([...all].reverse().map(c => [c.kind, c])).values()].sort((a, b) => a.minute - b.minute);
    const B = await chrome(), items = [];
    try {
      let tod = null;
      for (const c of first) {
        // (its own beat: a hand-over's pass, the parcel over the fence's counter, the dose; the rest half a minute in)
        const set = ACTS?.setOf(c.kind), m = c.minute + ({ handover: 7.2, fence: 1, precinct: 1, dose: 1.2, dress: 2 }[set] ?? 30) / 60;
        if (tod === null) { await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&tod=day&recordAt=${m}&recordPaused=1` }); await ready(B, 240000); await sleep(3000); tod = 'day'; }
        await B.ev(`(() => { const p = window.__record.player; p.pause(); p.seek(${m}); return true; })()`); await sleep(1500);
        const p = await B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(c.agent)}); return a?.w ? [a.w.p[0], a.w.p[2], a.w.yawS ?? a.w.p[3]] : null; })()`);
        if (p) { await B.ev(`(() => { const c = window.__city; if (c.cam && c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true }); const s = Math.sin(${p[2] + (set === 'fence' ? Math.PI * .75 : 0)}), k = Math.cos(${p[2] + (set === 'fence' ? Math.PI * .75 : 0)}); c.controls.target.set(${p[0]}, 1.0, ${p[1]}); c.camera.position.set(${p[0]} + s * 6 + k * 2, 6.5, ${p[1]} + k * 6 - s * 2); c.controls.update?.(); return true; })()`); }
        await sleep(1200);
        const st = await B.ev(`(() => (window.__record.draw.scenes?.acts?.state?.() ?? []).find(x => x.eventId === ${c.eventId}) ?? null)()`);
        const file = path.join(OUT, `${TAG}-kind-${c.kind}.jpg`); await shot(B, file);
        items.push({ file, caption: `${c.kind} · ${c.agent}${c.participants.length > 1 ? ' + ' + c.participants.filter(x => x !== c.agent).join(',') : ''} · ${c.place.cityPlace}`,
          sub: st ? `${hhmm(m)} · ${st.figures.map(f => `${f.id} ${f.clip}${f.prop ? ' [' + f.prop + ']' : ''}${f.where && f.where !== 'spot' ? ' (' + f.where + ')' : ''}`).join(', ')}${st.tag ? ' · tag ' + st.tag : ''}` : `${hhmm(m)} · NOT staged` });
        console.log(items.at(-1).caption, '|', items.at(-1).sub);
      }
      report.kinds = { n: items.length, sheet: sheet(items, path.join(OUT, `${TAG}-kinds.jpg`), `seed ${SEED} · one frame of each act kind · ${TAG}`) };
    } finally { await B.close(); }
  }
} finally { server?.kill?.(); }
fs.writeFileSync(path.join(OUT, `${TAG}-report.json`), JSON.stringify(report, null, 1));
console.log(`ACTSHOTS ${TAG} · ${path.relative(ROOT, OUT)}`);
