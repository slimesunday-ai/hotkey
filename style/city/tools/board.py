#!/usr/bin/env python3
"""A contact board from shots (the committed record: PNGs are git-ignored, boards are not).
  python3 style/city/tools/board.py OUT.jpg "TITLE" "subtitle" COLS "caption=path.png" ... ["notes=@line one|line two|..."]
A tile whose value starts with @ is a text cell (lines split on |). Paths are relative to style/city/ (or absolute)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
CITY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, G, CAP = 560, 350, 16, 30
def font(n):
    for f in ('/System/Library/Fonts/Supplemental/Arial Black.ttf', '/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Menlo.ttc'):
        try: return ImageFont.truetype(f, n)
        except Exception: pass
    return ImageFont.load_default()
big, mid, small = font(34), font(17), font(15)
out, title, sub, cols, tiles = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), [a.split('=', 1) for a in sys.argv[5:]]
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + (cols + 1) * G, 96 + rows * (H + CAP + G) + G), (250, 250, 247)); d = ImageDraw.Draw(sheet)
d.text((G, 16), title, font=big, fill=(10, 10, 10)); d.text((G, 62), sub, font=small, fill=(90, 90, 90))
for k, (cap, src) in enumerate(tiles):
    x, y = G + (k % cols) * (W + G), 96 + (k // cols) * (H + CAP + G)
    if src.startswith('@'):
        d.rectangle((x, y, x + W, y + H + CAP), fill=(20, 20, 26)); d.text((x + 16, y + 12), cap, font=mid, fill=(255, 226, 58))
        for n, line in enumerate(src[1:].split('|')): d.text((x + 16, y + 44 + n * 22), line, font=small, fill=(240, 240, 235))
        continue
    p = src if os.path.isabs(src) else os.path.join(CITY, src)
    if os.path.exists(p):
        im = Image.open(p).convert('RGB'); s = max(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        ox, oy = (im.width - W) // 2, (im.height - H) // 2; sheet.paste(im.crop((ox, oy, ox + W, oy + H)), (x, y))
    else: d.rectangle((x, y, x + W, y + H), outline=(200, 0, 0), width=3); d.text((x + 16, y + 16), 'missing ' + src, font=small, fill=(200, 0, 0))
    d.rectangle((x, y + H, x + W, y + H + CAP), fill=(255, 79, 163)); d.text((x + 10, y + H + 6), cap, font=mid, fill=(10, 10, 10))
sheet.save(out if os.path.isabs(out) else os.path.join(CITY, out), quality=86); print(out, sheet.size)
