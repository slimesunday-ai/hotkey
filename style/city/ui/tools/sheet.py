#!/usr/bin/env python3
# HUMAN LAYER · contact sheets from ui/tools/shots.mjs: one per skin (<out>/sheet-<skin>.jpg) and one comparison of the three skins side by
# side (<out>/sheet-compare.jpg: a row per moment, a column per skin).   python3 style/city/ui/tools/sheet.py [out-dir]
import sys, os
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'style/city/shots/human-layer/s1'
SKINS = ['clean', '98', 'zine']
MOMENTS = [('crowd-hover', 'Hover label in a crowd'), ('pins-street', 'Pins on, a busy street'), ('crowd-chooser', 'A crowd marker clicked: choose who'),
           ('dossier-pending', 'Dossier · TAPE pending (Day 1)'), ('dossier-asof', 'Dossier · TAPE as of a day ago (Day 3)'), ('dossier-head', 'Dossier · Head tab, as of'),
           ('dossier-yours', 'Dossier · your own agent (YOURS, ?as=)')]
BG, INK, MUTED = (23, 23, 27), (247, 247, 242), (160, 160, 170)
def font(sz, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Black.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F_T, F_C = font(30, True), font(18)

def grid(cells, cols, cw, title, sub=''):
    ch = int(cw * 720 / 1280); pad, cap, top = 18, 30, 74
    rows = (len(cells) + cols - 1) // cols
    W, H = pad + cols * (cw + pad), top + rows * (ch + cap + pad)
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.text((pad, 16), title, fill=(255, 194, 26), font=F_T); d.text((pad, 52), sub, fill=MUTED, font=F_C)
    for k, (path, label) in enumerate(cells):
        x, y = pad + (k % cols) * (cw + pad), top + (k // cols) * (ch + cap + pad)
        d.text((x, y + 4), label, fill=INK, font=F_C)
        if path and os.path.exists(path): im.paste(Image.open(path).convert('RGB').resize((cw, ch), Image.LANCZOS), (x, y + cap))
        else: d.rectangle([x, y + cap, x + cw, y + cap + ch], outline=MUTED); d.text((x + 12, y + cap + 12), 'missing', fill=MUTED, font=F_C)
    return im

for s in SKINS:
    cells = [(os.path.join(OUT, s, m + '.png'), t) for m, t in MOMENTS]
    grid(cells, 2, 900, f'AI City · human layer s1 · skin: {s}', f'?ui={s} · U cycles skins · 1280×720 · recorded run 2026-09-29 mixed, paused').save(os.path.join(OUT, f'sheet-{s}.jpg'), quality=88)
cells = []
for m, t in MOMENTS:
    for s in SKINS: cells.append((os.path.join(OUT, s, m + '.png'), f'{s} · {t}'))
grid(cells, 3, 760, 'AI City · human layer s1 · the three skins side by side', 'columns: clean · 98 · zine — same moments, same frame').save(os.path.join(OUT, 'sheet-compare.jpg'), quality=86)
print('sheets →', OUT)
