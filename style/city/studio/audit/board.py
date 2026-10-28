# CHARACTER AUDIT · lays out style/city/board-audit.jpg from renders/tiles.json (board.mjs writes both)
import json, os
from PIL import Image, ImageDraw, ImageFont
H = os.path.dirname(os.path.abspath(__file__)); tiles = json.load(open(os.path.join(H, 'renders/tiles.json')))
def font(s):
    for f in ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/SFNS.ttf']:
        try: return ImageFont.truetype(f, s)
        except Exception: pass
    return ImageFont.load_default()
ROWS = [('slime', "slime's five examples, reproduced (magenta = the defect voxels)"), ('a', 'a · SEAMS: clothing cut by the walk v2 segments'), ('b', 'b · LAYERING: no clip / occlusion / neckline model'),
        ('c', 'c · DEPTH: no relief budget per category'), ('other', 'other · floating, diagonal-only, one-sided bits')]
TW, TH, CAP, HEAD, PAD = 360, 440, 40, 44, 12; cols = 5
W = cols * TW + (cols + 1) * PAD; Ht = 70 + len(ROWS) * (HEAD + TH + CAP + PAD)
B = Image.new('RGB', (W, Ht), (246, 245, 240)); d = ImageDraw.Draw(B); f1, f2, f3 = font(30), font(22), font(15)
d.text((PAD, 18), 'AI City · character audit (2026-09-29) · checker: style/city/studio/audit/run.mjs · poses from the real walk v2 shader', fill=(20, 20, 20), font=f1)
y = 70
for key, title in ROWS:
    d.text((PAD, y + 10), title, fill=(160, 20, 130) if key == 'slime' else (30, 30, 30), font=f2); y += HEAD
    for i, t in enumerate([t for t in tiles if t['row'] == key][:cols]):
        x = PAD + i * (TW + PAD); im = Image.open(os.path.join(H, t['file'])).convert('RGB'); B.paste(im, (x, y))
        d.rectangle([x, y, x + TW - 1, y + TH - 1], outline=(180, 180, 175))
        cap = t['cap']; lines = [cap[:52], cap[52:104]] if len(cap) > 52 else [cap]
        for j, ln in enumerate(lines): d.text((x + 2, y + TH + 3 + j * 17), ln, fill=(40, 40, 40), font=f3)
    y += TH + CAP + PAD
out = os.path.join(H, '../../board-audit.jpg'); B.save(out, quality=88); print('saved', os.path.normpath(out), B.size)
