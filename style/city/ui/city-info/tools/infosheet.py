#!/usr/bin/env python3
# HUMAN LAYER · SECTION 3a · contact sheets from infoshots.mjs (JPEG, the shots dir stays small):
#   info-sheet-live.jpg (the ticker, City TV, every board) · info-sheet-tape.jpg · info-sheet-skins.jpg (one board + the bar, three skins)
#   python3 style/city/ui/city-info/tools/infosheet.py <png dir> <out dir>
import sys, os
from PIL import Image, ImageDraw, ImageFont
SRC, OUT = sys.argv[1], sys.argv[2]
BG, INK, MUTED = (23, 23, 27), (247, 247, 242), (160, 160, 170)
def font(sz, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Black.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F_T, F_C = font(30, True), font(18)
def grid(cells, cols, cw, title, sub, aspect=720 / 1280):
    ch = int(cw * aspect); pad, cap, top = 18, 30, 74; rows = (len(cells) + cols - 1) // cols
    im = Image.new('RGB', (pad + cols * (cw + pad), top + rows * (ch + cap + pad)), BG); d = ImageDraw.Draw(im)
    d.text((pad, 16), title, fill=(255, 194, 26), font=F_T); d.text((pad, 52), sub, fill=MUTED, font=F_C)
    for k, (name, label, crop) in enumerate(cells):
        x, y = pad + (k % cols) * (cw + pad), top + (k // cols) * (ch + cap + pad); d.text((x, y + 4), label, fill=INK, font=F_C); p = os.path.join(SRC, name + '.png')
        if os.path.exists(p): img = Image.open(p).convert('RGB'); img = img.crop(crop) if crop else img; img.thumbnail((cw, ch), Image.LANCZOS); im.paste(img, (x, y + cap))
        else: d.rectangle([x, y + cap, x + cw, y + cap + ch], outline=MUTED); d.text((x + 12, y + cap + 12), 'missing', fill=MUTED, font=F_C)
    return im
os.makedirs(OUT, exist_ok=True)
SUB = 'replay 2026-09-29 mixed, a live season paused at D4 12:00 · 1280×720 headless, real pixels'
P = (880, 40, 1280, 720)   # the panel, right
grid([('live-tv-story', 'City TV (N) · a headline card', P), ('live-tv-top', 'City TV · top stories', P), ('live-tv-drop', 'City TV · the Fit Street drop', P), ('live-tv-lists', 'City TV · the lists: the Director, yesterday on tape', P),
      ('live-ladders', 'The City (L) · Ladders', P), ('live-ladders-richest', 'Ladders · Longest survivor, Richest (TAPE only)', P), ('live-turf', 'Turf', P),
      ('live-economy', 'Economy', P), ('live-economy-money', 'Economy · loans, the city’s money (TAPE)', P), ('live-crime', 'Crime · today, the secret ones (yesterday’s)', P), ('live-dead', 'The dead', P)],
     4, 420, 'AI City · human layer s3a · LIVE: City TV and the boards', SUB, 680 / 400).save(os.path.join(OUT, 'info-sheet-live.jpg'), quality=86)
grid([('live-ticker', 'LIVE · full screen', None), ('live-tv-story', 'LIVE · City TV open', None)], 2, 900, 'AI City · human layer s3a · the screen', SUB).save(os.path.join(OUT, 'info-sheet-screen.jpg'), quality=86)
grid([('tape-ticker', 'TAPE · the ticker under the transport, tape stories in the tape colour', None), ('tape-tv', 'TAPE · City TV as of the tape time', None),
      ('tape-ladders', 'TAPE · Ladders as of the tape time', None), ('tape-crime', 'TAPE · Crime as of the tape time', None)], 2, 900, 'AI City · human layer s3a · TAPE', 'the Tape chip → TAPE two hours before the horizon · everything follows the tape time').save(os.path.join(OUT, 'info-sheet-tape.jpg'), quality=86)
grid([('skin-ladders-clean', 'clean · Ladders', P), ('skin-ladders-98', '98 · Ladders', P), ('skin-ladders-zine', 'zine · Ladders', P)], 3, 520, 'AI City · human layer s3a · one board, three skins', '?ui=clean | 98 | zine (U cycles)', 680 / 400).save(os.path.join(OUT, 'info-sheet-skins.jpg'), quality=86)
grid([('skin-bar-clean', 'clean · the bar', None), ('skin-bar-98', '98 · the bar', None), ('skin-bar-zine', 'zine · the bar', None)], 1, 1280, 'AI City · human layer s3a · the ticker + clock, three skins', 'the bottom 120 px of the screen', 120 / 1280).save(os.path.join(OUT, 'info-sheet-bar.jpg'), quality=88)
print('sheets →', OUT)
