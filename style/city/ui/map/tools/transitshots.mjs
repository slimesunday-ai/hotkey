// MOVEMENT W2 · the transit layer's contact sheet: the paper map with the Transit layer on, the whole island and three close-ins
// (Glasswall's interchange, the docks, the west end), then one JPEG sheet. No sim needed (the map draws without agents).
//   node style/city/ui/map/tools/transitshots.mjs [--base http://127.0.0.1:5346/style/city/] [--out style/city/shots/movement]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5346/style/city/'), OUT = opt('out', 'style/city/shots/movement'), PNG = path.join(os.tmpdir(), 'transit-shots');
await fs.mkdir(PNG, { recursive: true }); await fs.mkdir(OUT, { recursive: true });
const S = await open({ w: 1440, h: 900 }), shots = [];
try {
  await S.go(`${BASE}?sim=live&simport=5399&simtod=0`, { until: 'window.__map && window.__mapTransit', ms: 240000 }); await sleep(3000);
  await S.ev('(__map.open(), 1)'); await sleep(2500); await S.ev('(__mapTransit.set(true), 1)'); await sleep(1500);
  for (const [name, js, cap] of [['transit-island', '__map.fit()', 'The island: the TIDE, NEON, HARBOR and UNION lines, the stands'],
    ['transit-glasswall', '__map.focus(20, 0, 2.6)', 'Glasswall: WASHINGTON, where the lines meet'], ['transit-docks', '__map.focus(60, -170, 2.4)', 'Low Tide Docks, the Heap, Market Av'],
    ['transit-west', '__map.focus(-170, 10, 2.4)', 'The west: Sunny Acres, the mall gate, Grand Ave']]) {
    await S.ev(`(${js}, 1)`); await sleep(2200); const f = path.join(PNG, name + '.png'); await S.shot(f); shots.push([f, cap]); console.log('  ✓', f); }
} finally { await S.close(); }
// the sheet: 2 × 2, captions under each (python + PIL, like the map's own sheets)
const py = `import sys
from PIL import Image, ImageDraw, ImageFont
shots = ${JSON.stringify(shots)}
W, H = 1440 // 2, 900 // 2
sheet = Image.new('RGB', (W * 2 + 30, (H + 34) * 2 + 60), (250, 247, 240)); d = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18); t = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 24)
except Exception: f = t = ImageFont.load_default()
d.text((12, 14), 'AI City · the transit layer on the paper map (movement W2, 2026-10-07)', fill=(23, 23, 27), font=t)
for k, (p, cap) in enumerate(shots):
    im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS); x = 10 + (k % 2) * (W + 10); y = 50 + (k // 2) * (H + 34)
    sheet.paste(im, (x, y)); d.text((x + 2, y + H + 6), cap, fill=(23, 23, 27), font=f)
sheet.save(sys.argv[1], quality=84)
`;
await fs.writeFile(path.join(PNG, 'sheet.py'), py);
execFileSync('python3', [path.join(PNG, 'sheet.py'), path.join(OUT, 'transit-map-sheet.jpg')]);
for (const [f] of shots) execFileSync('python3', ['-c', `from PIL import Image; Image.open('${f}').convert('RGB').save('${path.join(OUT, path.basename(f, '.png') + '.jpg')}', quality=82)`]);
console.log('sheet →', path.join(OUT, 'transit-map-sheet.jpg'));
