// HUMAN LAYER · ITEM ICONS · the bake: renders every icon (ui/icons/models.js + the worn traits, tools/traits.js) headlessly into the
// sprite atlas, at 1× (64 px cells) and 2× (128 px cells), plus its JSON.
//   node style/city/ui/icons/tools/bake-icons.mjs            → ui/icons/atlas/icons.png, icons@2x.png, icons.json
//   node style/city/ui/icons/tools/bake-icons.mjs --sheet    … and the contact sheets → shots/human-layer/icons/
// A new item: one entry in models.js (or a trait id in traits.js), then re-run this. It serves the worktree itself on a free loopback port
// (read-only) and drives headless Chrome over CDP (ui/tools/cdp.mjs); nothing else is started or killed.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from '../../tools/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../../../..'), ICONS = path.resolve(HERE, '..'), ATLAS = path.join(ICONS, 'atlas');
const SHOTS = path.resolve(HERE, '../../../shots/human-layer/icons'), SHEET = process.argv.includes('--sheet');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer(async (req, res) => {
  try { const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (!p.startsWith(ROOT)) throw 0;
    const b = await fs.readFile(p); res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(b); }
  catch { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
const S = await open({ w: 1400, h: 900 });
try {
  const t0 = Date.now(); await S.go(`${base}/style/city/ui/icons/tools/bake.html`, { until: 'window.__icons && __icons.done', ms: 240000 });
  const r = await S.ev('JSON.stringify({ json: __icons.json, p1: __icons.png1, p2: __icons.png2 })'), { json, p1, p2 } = JSON.parse(r);
  await fs.mkdir(ATLAS, { recursive: true });
  await fs.writeFile(path.join(ATLAS, 'icons.png'), Buffer.from(p1.split(',')[1], 'base64'));
  await fs.writeFile(path.join(ATLAS, 'icons@2x.png'), Buffer.from(p2.split(',')[1], 'base64'));
  await fs.writeFile(path.join(ATLAS, 'icons.json'), JSON.stringify(json, null, 1) + '\n');
  const sz = async f => ((await fs.stat(path.join(ATLAS, f))).size / 1024).toFixed(0) + ' KB';
  console.log(`baked ${json.count} icons in ${((Date.now() - t0) / 1000).toFixed(1)} s · icons.png ${await sz('icons.png')} · icons@2x.png ${await sz('icons@2x.png')}${json.missing.length ? ' · MISSING: ' + json.missing.join(', ') : ''}`);
  if (S.errs.length) console.log('page errors:\n  ' + S.errs.join('\n  '));
  if (SHEET) {   // the contact sheets: the whole set, labelled, at 64 and 32 px, on light and on dark
    await fs.mkdir(SHOTS, { recursive: true });
    for (const [bg, px] of [['light', 64], ['dark', 64], ['light', 32], ['dark', 32]]) {
      await S.go(`${base}/style/city/ui/icons/tools/contact.html?bg=${bg}&px=${px}`, { until: 'document.title === "sheet-ready"', ms: 60000 });
      const h = await S.ev('document.documentElement.scrollHeight'), w = await S.ev('document.documentElement.scrollWidth');
      await S.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      const f = path.join(SHOTS, `contact-${px}-${bg}.png`); await S.shot(f); console.log('sheet →', path.relative(ROOT, f));
      await S.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    }
  }
} finally { await S.close(); srv.close(); }
