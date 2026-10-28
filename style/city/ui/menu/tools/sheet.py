#!/usr/bin/env python3
# HUMAN LAYER · SECTION 4 · the contact sheet from ui/menu/tools/shots.mjs: the bar in three skins (strips), then People, the beacons,
# Where's the action, Settings, the other skins and three stills of the clip.   python3 style/city/ui/menu/tools/sheet.py [out-dir]
import sys, os
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'style/city/shots/human-layer/menu'
CELLS = [('people-clean', 'People (/): everyone, live; busiest first'), ('people-search', 'Search as you type: "dial"'), ('people-filter-near', 'Filter: Active · sort: Nearest'),
         ('people-filter-crew', 'Filter: one crew'), ('people-hover-beacon', 'A row hovered: the beacon on their pin'), ('people-hover-edge', 'Off screen: the beacon at the edge, pointing'),
         ('action-1', 'Where\'s the action (.): the newest'), ('action-2', 'Again (.): the one before'), ('settings', 'Settings (`)'),
         ('people-98', 'People · 98'), ('people-zine', 'People · zine'), ('dev-bar', 'Shift+`: the developer bar is back'),
         ('clip-a-typing', 'Clip 1/3: / then type'), ('clip-b-enter', 'Clip 2/3: Enter → the camera flies'), ('clip-c-following', 'Clip 3/3: following, the dossier open')]
BG, INK, MUTED = (23, 23, 27), (247, 247, 242), (160, 160, 170)
def font(sz, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Black.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F_T, F_C = font(30, True), font(18)
CW, COLS, PAD, CAP = 600, 3, 18, 30
cells = [(n, c) for n, c in CELLS if os.path.exists(os.path.join(OUT, n + '.jpg'))]
CH = int(CW * 900 / 1440)
strips = [(s, Image.open(os.path.join(OUT, f'bar-{s}.jpg')).crop((0, 0, 900, 62))) for s in ['clean', '98', 'zine'] if os.path.exists(os.path.join(OUT, f'bar-{s}.jpg'))]
SW = COLS * CW + (COLS - 1) * PAD; top = 76; strip_h = int(62 * SW / 900 * .62)
rows = (len(cells) + COLS - 1) // COLS
H = top + len(strips) * (strip_h + CAP) + PAD + rows * (CH + CAP + PAD) + PAD
img = Image.new('RGB', (SW + 2 * PAD, H), BG); d = ImageDraw.Draw(img)
d.text((PAD, 20), 'AI City · section 4 · the menu bar, People, Where\'s the action, Settings', font=F_T, fill=INK)
y = top
for s, im in strips:
    d.text((PAD, y + 4), f'The menu bar · {s}', font=F_C, fill=MUTED); y += CAP
    w = int(SW * .62); img.paste(im.resize((w, strip_h), Image.LANCZOS), (PAD, y)); y += strip_h
y += PAD
for k, (n, c) in enumerate(cells):
    col, row = k % COLS, k // COLS; x = PAD + col * (CW + PAD); yy = y + row * (CH + CAP + PAD)
    d.text((x, yy + 4), c, font=F_C, fill=MUTED)
    img.paste(Image.open(os.path.join(OUT, n + '.jpg')).convert('RGB').resize((CW, CH), Image.LANCZOS), (x, yy + CAP))
f = os.path.join(OUT, 'sheet-menu.jpg'); img.save(f, quality=82, optimize=True); print('→', f, img.size)
