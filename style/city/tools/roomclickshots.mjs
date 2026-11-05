// C2-tvday · A CLICK ON AN AGENT INSIDE AN OPEN ROOM (docs/redesign/camera-20261031.md design A): headless Chrome on ?sim=record,
// seed 404, the record paused at --at (default 2259: a04 at home). The camera is put at that room's own cutaway framing (interiors'
// frameOf, the follow cam's and TV mode's), then a real mouse click (CDP Input.dispatchMouseEvent) lands on the agent's chest. Reports
// what the page did with it (the record's card it opened: .r-head-card's @id; or the rig's follow and its subject) and the world's ray from the camera to the agent, and shoots the frame
// before and after into a two-frame sheet. --worldcut 0 runs the same with the world's cut off (?worldcut=0), for comparison.
//   node style/city/tools/roomclickshots.mjs --port <p> [--id a04] [--at 2259] [--worldcut 0] [--out style/city/shots/c2-tvday]
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), ID = arg('id', 'a04'), AT = +arg('at', 2259), WC = arg('worldcut', '1'), OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c2-tvday')));
const sleep = ms => new Promise(r => setTimeout(r, ms)), tag = WC === '0' ? '-nocut' : '';
async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/roomclickshots.mjs --port <port>'); process.exit(2); }
  await fs.mkdir(OUT, { recursive: true });
  const server = await serve(), B = await chrome(); let res = null;
  try {
    await B.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?sim=record&feed=/core/runs/404-A/feed.jsonl&recordAt=${AT}&recordPaused=1&tod=day&simtod=0&tv=0&worldcut=${WC}` }); await ready(B);
    for (let t = 0; t < 100 && !(await B.ev('!!window.__recordUI?.director', false).catch(() => false)); t++) await sleep(200);
    await sleep(4000);
    // (aim at its house so the homes runtime opens its room, then put the camera at the room's frame)
    let house = null;
    for (let t = 0; t < 30; t++) { const c = await B.ev(`(() => { const c = window.__city.recordHomes?.cutaway?.(${JSON.stringify(ID)}); return c ? { inside: c.inside, frame: !!c.frame, house: c.house } : null; })()`);
      if (c?.frame) break; if (c?.house && !house) { house = c.house; await B.ev(`(() => { const C = window.__city, h = ${JSON.stringify(c.house)}; C.controls.target.set(h.cx, 0, h.cz); C.camera.position.set(h.cx + 10, 25, h.cz + 10); C.controls.update(); return 1; })()`); } await sleep(500); }
    await B.ev(`(() => { const C = window.__city, f = C.recordHomes.cutaway(${JSON.stringify(ID)}).frame(); C.camera.position.copy(f.pos); C.controls.target.copy(f.tgt); C.controls.update(); return 1; })()`);
    await sleep(2500);
    const before = await B.ev(`(() => { const C = window.__city, a = window.__record.draw.agents.map.get(${JSON.stringify(ID)}), r = C.renderer.domElement.getBoundingClientRect(), V = new C.THREE.Vector3(a.w.p[0], a.w.p[1] + 1, a.w.p[2]).project(C.camera);
      const h = C.cam.world.ray(C.camera.position, { x: a.w.p[0], y: a.w.p[1] + 1, z: a.w.p[2] }, C.cam.world.STATIC_WIDE);
      return { x: r.left + (V.x + 1) / 2 * r.width, y: r.top + (1 - V.y) / 2 * r.height, inside: !!window.__record.draw.indoors.inside.get(${JSON.stringify(ID)})?.inside, room: C.recordHomes.open, cut: C.cam.world.cut?.() ?? null, rayToChest: h ? { t: +h.t.toFixed(3), kind: h.kind } : null, mode: C.cam.mode }; })()`);
    const f0 = path.join(OUT, `roomclick-before${tag}.png`); await fs.writeFile(f0, Buffer.from((await B.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: Math.round(before.x), y: Math.round(before.y), button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    await sleep(2500);
    const after = await B.ev(`(() => { const C = window.__city, s = C.cam.subject; return { mode: C.cam.mode, subject: s?.aid ?? s?.id ?? null, card: [...document.querySelectorAll('.r-head-card')].filter(e => e.offsetParent).map(e => (e.textContent.match(/@a\\d+/) || [null])[0]).filter(Boolean) }; })()`);
    const f1 = path.join(OUT, `roomclick-after${tag}.png`); await fs.writeFile(f1, Buffer.from((await B.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    res = { id: ID, at: AT, worldcut: WC, before, after, ok: (after.mode === 'follow' && after.subject === ID) || after.card.includes('@' + ID), errors: B.errors.slice(0, 3) };
    const T = [{ file: f0, label: `${ID} inside its open room (worldcut ${WC}): the click lands on its chest · ray to it ${before.rayToChest ? 'blocked' : 'clear'}` },
      { file: f1, label: `after the click: ${after.card.length ? 'the card of ' + after.card.join(', ') : after.mode + (after.subject ? ' ' + after.subject : '')}${res.ok ? ' · PASS' : ' · not picked'}` }];
    const py = spawnSync('python3', ['-c', SHEET_PY, path.join(OUT, `roomclick${tag}.jpg`), JSON.stringify(T)], { encoding: 'utf8' }); if (py.status) console.log('sheet: ' + py.stderr);
  } finally { await B.close(); server?.kill(); }
  console.log(JSON.stringify(res));
  console.log(res?.ok ? 'ROOMCLICK PASS' : 'ROOMCLICK FAIL'); process.exitCode = res?.ok ? 0 : 1;
}
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 600, 12, 44
S = Image.new('RGB', (2 * tw + 3 * pad, th + bar + 2 * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 19)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + i * (tw + pad); y = pad
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); d.rectangle([x, y, x + tw, y + bar - 4], fill=(40, 46, 60)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
