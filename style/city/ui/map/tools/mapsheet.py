#!/usr/bin/env python3
# HUMAN LAYER · SECTION 3b · the map's contact sheets from ui/map/tools/mapshots.mjs:
#   map-sheet.jpg        every moment (clean skin): the island, a district, a place card, agents + hover, events, trails 1 and 3, heat ×3,
#                        turf, the map in TAPE
#   map-sheet-skins.jpg  the three skins side by side (the island, and close in)
#   python3 style/city/ui/map/tools/mapsheet.py <png dir> [out dir]
import sys, os
from PIL import Image, ImageDraw, ImageFont

PNG = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'style/city/shots/human-layer/s3'
MOMENTS = [('map-island', 'The whole island (LIVE)'), ('map-district', 'Zoomed in: Pleasantview, property lines'), ('map-card', 'A place card: Precinct 9'),
           ('map-agents-hover', 'Agent pins + a hover'), ('map-events', 'Event stamps (fade with age)'), ('map-trail-1', 'One trail'), ('map-trail-3', 'Three trails'),
           ('map-heat-presence', 'Heat: presence (LIVE)'), ('map-heat-crimes', 'Heat: crimes (LIVE)'), ('map-heat-deals', 'Heat: deals (TAPE: yesterday)'),
           ('map-turf', 'Turf layer (off by default)'), ('map-tape', 'The map in TAPE (as of the tape time)')]
SKINS = [('map-skin-clean-island', 'clean · island'), ('map-skin-98-island', '98 · island'), ('map-skin-zine-island', 'zine · island'),
         ('map-skin-clean-zoom', 'clean · close in'), ('map-skin-98-zoom', '98 · close in'), ('map-skin-zine-zoom', 'zine · close in')]
BG, INK, MUTED = (23, 23, 27), (247, 247, 242), (160, 160, 170)
def font(sz, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Black.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F_T, F_C = font(30, True), font(18)

def grid(cells, cols, cw, title, sub=''):
    first = next((p for p, _ in cells if os.path.exists(p)), None); ar = 900 / 1440
    if first: w, h = Image.open(first).size; ar = h / w
    ch = int(cw * ar); pad, cap, top = 18, 30, 74
    rows = (len(cells) + cols - 1) // cols
    W, H = pad + cols * (cw + pad), top + rows * (ch + cap + pad)
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.text((pad, 16), title, fill=(255, 194, 26), font=F_T); d.text((pad, 52), sub, fill=MUTED, font=F_C)
    for k, (path, label) in enumerate(cells):
        x, y = pad + (k % cols) * (cw + pad), top + (k // cols) * (ch + cap + pad)
        d.text((x, y + 4), label, fill=INK, font=F_C)
        if os.path.exists(path): im.paste(Image.open(path).convert('RGB').resize((cw, ch), Image.LANCZOS), (x, y + cap))
        else: d.rectangle([x, y + cap, x + cw, y + cap + ch], outline=MUTED); d.text((x + 12, y + cap + 12), 'missing', fill=MUTED, font=F_C)
    return im

os.makedirs(OUT, exist_ok=True)
grid([(os.path.join(PNG, m + '.png'), t) for m, t in MOMENTS], 3, 760, 'AI City · human layer s3b · the city map', 'B opens it · recorded run 2026-09-29 mixed, D4, paused · 1440×900 · skin clean').save(os.path.join(OUT, 'map-sheet.jpg'), quality=84)
grid([(os.path.join(PNG, m + '.png'), t) for m, t in SKINS], 3, 760, 'AI City · human layer s3b · the map in the three skins', 'clean: a Thomas Guide page · 98: a gas-station fold-out · zine: a photocopy').save(os.path.join(OUT, 'map-sheet-skins.jpg'), quality=84)
print('sheets →', OUT)
