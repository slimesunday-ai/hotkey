#!/usr/bin/env python3
# HUMAN LAYER · SECTION 2a · the tape player's contact sheets (JPEG) from tapeshots.mjs's PNGs:
#   python3 style/city/ui/tape/tools/tapesheet.py <png dir> [out dir = style/city/shots/human-layer/s2]
#   → sheet-tape.jpg (the transport, the city on tape, the dossier on tape) · sheet-skins.jpg (the same moments in clean, 98, zine)
import sys, os
from PIL import Image, ImageDraw, ImageFont
SRC = sys.argv[1]; OUT = sys.argv[2] if len(sys.argv) > 2 else 'style/city/shots/human-layer/s2'
BG, INK, MUTED, GOLD = (23, 23, 27), (247, 247, 242), (160, 160, 170), (255, 182, 46)
def font(sz, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Black.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F_T, F_C = font(28, True), font(17)
def sheet(rows, title, sub, out, W=1960):
    pad, cap, top = 16, 26, 72; laid = []; y = top
    for row in rows:
        n = len(row); cw = (W - pad * (n + 1)) // n; ims = []
        for f, label in row:
            p = os.path.join(SRC, f); im = Image.open(p).convert('RGB') if os.path.exists(p) else None
            if im: im = im.resize((cw, int(im.height * cw / im.width)), Image.LANCZOS)
            ims.append((im, label))
        rh = max((im.height if im else 120) for im, _ in ims); laid.append((y, cw, ims)); y += cap + rh + pad
    sh = Image.new('RGB', (W, y), BG); d = ImageDraw.Draw(sh)
    d.text((pad, 14), title, fill=GOLD, font=F_T); d.text((pad, 48), sub, fill=MUTED, font=F_C)
    for y0, cw, ims in laid:
        for k, (im, label) in enumerate(ims):
            x = pad + k * (cw + pad); d.text((x, y0 + 3), label, fill=INK, font=F_C)
            if im: sh.paste(im, (x, y0 + cap))
            else: d.rectangle([x, y0 + cap, x + cw, y0 + cap + 120], outline=MUTED); d.text((x + 10, y0 + cap + 10), 'missing', fill=MUTED, font=F_C)
    os.makedirs(OUT, exist_ok=True); sh.save(os.path.join(OUT, out), quality=84, optimize=True, progressive=True); print(os.path.join(OUT, out), sh.size, os.path.getsize(os.path.join(OUT, out)) // 1024, 'KB')
sheet([[('clean-transport-idle.png', 'Transport · idle (TAPE, 4×)'), ('clean-transport-scrub.png', 'Transport · scrubbing (drag)')],
       [('clean-transport-hover.png', 'Transport · hovering an event marker'), ('clean-transport-wall.png', 'The horizon wall: the rest is still live')],
       [('clean-live-dossier.png', 'LIVE · the dossier, before Watch tape'), ('clean-tape-open.png', 'TAPE · opened at the agent: selected, followed, as of the scrub time')],
       [('clean-tape-dm.png', 'TAPE · a DM: the arc and its bubble (+ a thought)'), ('clean-tape-thoughts.png', 'TAPE · thought bubbles + a deal chip (nearest few, capped)')],
       [('clean-dossier-pockets.png', 'Dossier on tape · Pockets, as of …'), ('clean-dossier-head.png', 'Dossier on tape · Head, as of …'), ('98-transport-idle.png', 'Transport · 98'), ('zine-transport-idle.png', 'Transport · zine')]],
      'AI City · the tape player (human layer s2a)', 'Replay 2026-09-29 mixed, a live season at D4 12:00 → the tape ends a game day back (the horizon). 1280×720 headless, real pixels.', 'sheet-tape.jpg')
sheet([[(f'{s}-tape-open.png', f'TAPE opened at an agent · {s}') for s in ['clean', '98', 'zine']],
       [(f'{s}-tape-thoughts.png', f'Thought bubbles · {s}') for s in ['clean', '98', 'zine']],
       [(f'{s}-transport-hover.png', f'Marker hover · {s}') for s in ['clean', '98', 'zine']],
       [(f'{s}-transport-scrub.png', f'Scrubbing · {s}') for s in ['clean', '98', 'zine']]],
      'AI City · the tape player in the three skins', 'Same markup, the kit\'s tokens + the tape\'s own (ui/tape/tape.css): ?ui=clean | 98 | zine', 'sheet-skins.jpg')
