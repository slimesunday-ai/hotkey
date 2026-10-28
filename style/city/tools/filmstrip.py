# FILM EMULATION PASS (2026-10-05) · lays out six consecutive film frames from tools/filmshots.mjs --strip (<dir>/f0…f5.jpg):
#   row 1  the whole frame, small · row 2  a 1:1 crop (dust, scratches, grain changing) · row 3  a 3× zoom where the image meets the
#   gate (the weave: the picture moves, the gate edge doesn't)
#   python3 style/city/tools/filmstrip.py <dir> <out.jpg> [crop x,y,w,h] [zoom x,y,w,h] [title]
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
crop = [int(v) for v in (sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != 'auto' else '0,0,360,240').split(',')]
zoom = [int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '240,0,120,80').split(',')]
title = sys.argv[5] if len(sys.argv) > 5 else os.path.basename(d.rstrip('/'))
F = [Image.open(os.path.join(d, f'f{k}.jpg')).convert('RGB') for k in range(6)]
if len(sys.argv) <= 3 or sys.argv[3] == 'auto':   # the 1:1 crop where the frames differ most (dust, hairs, scratches come and go; the city barely moves)
    from PIL import ImageChops
    G = [im.convert('L').resize((im.width // 4, im.height // 4), Image.BOX) for im in F]; hi = G[0]; lo = G[0]
    for g in G[1:]: hi = ImageChops.lighter(hi, g); lo = ImageChops.darker(lo, g)
    ch = ImageChops.subtract(hi, lo).point(lambda v: 0 if v < 24 else v)   # (flicker and grain stay under the floor)
    cw, chh = crop[2] // 4, crop[3] // 4; best = (-1, 0, 0)
    for y0 in range(0, ch.height - chh, 6):
        for x0 in range(0, ch.width - cw, 6):
            sc = sum(ch.crop((x0, y0, x0 + cw, y0 + chh)).resize((1, 1), Image.BOX).getdata()); best = max(best, (sc, x0, y0))
    crop[0], crop[1] = best[1] * 4, best[2] * 4
tw = 360; th = round(tw * F[0].height / F[0].width); zw, zh = zoom[2] * 3, zoom[3] * 3
pad, head = 8, 30; W = 6 * tw + 7 * pad; H = head + th + crop[3] * tw // crop[2] + zh * tw // zw + 4 * pad + 3 * 18
S = Image.new('RGB', (W, H), (14, 14, 16)); dr = ImageDraw.Draw(S)
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 13)
except Exception: font = None
dr.text((pad, 8), f'{title} · six consecutive frames', fill=(255, 210, 60), font=font)
y = head
for row, (name, fn) in enumerate([('frame', lambda im: im.resize((tw, th), Image.LANCZOS)),
                                  ('1:1 crop', lambda im: im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3])).resize((tw, crop[3] * tw // crop[2]), Image.NEAREST)),
                                  ('3× at the gate edge', lambda im: im.crop((zoom[0], zoom[1], zoom[0] + zoom[2], zoom[1] + zoom[3])).resize((tw, zh * tw // zw), Image.NEAREST))]):
    hh = 0
    for k, im in enumerate(F):
        t = fn(im); S.paste(t, (pad + k * (tw + pad), y + 16)); hh = t.height
        dr.text((pad + k * (tw + pad), y), f'frame {k + 1} · {name}', fill=(200, 200, 205), font=font)
    y += hh + 16 + pad
S = S.crop((0, 0, W, y)); S.save(out, quality=90); print('saved', out, S.size)
