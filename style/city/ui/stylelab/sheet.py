# UI STYLE LAB · labelled contact sheet from shoot.mjs's frames (its manifest.json: the styles shot, in styles.js order), each style
# cropped to the menu + card corner (920 x 620 of the 1280 x 720 stage), numbered and named.
#   python3 style/city/ui/stylelab/sheet.py <frames dir> <out.jpg> [cell width=600] [columns=4] [ids,comma,separated] [--title "…"]
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
argv = [a for a in sys.argv[1:]]; title = None
if '--title' in argv: k = argv.index('--title'); title = argv[k + 1]; del argv[k:k + 2]
src, out = argv[0], argv[1]
cw = int(argv[2]) if len(argv) > 2 else 600
cols = int(argv[3]) if len(argv) > 3 else 4
only = argv[4].split(',') if len(argv) > 4 else None
man = json.load(open(os.path.join(src, 'manifest.json')))
styles = [s for s in man['styles'] if not only or s['id'] in only]
CROP = (0, 0, 920, 620); ch = round(cw * 620 / 920); lab = 54; pad = 14
rows = (len(styles) + cols - 1) // cols
W, H = pad + cols * (cw + pad), 64 + rows * (ch + lab + pad) + pad
sheet = Image.new('RGB', (W, H), (20, 20, 22)); d = ImageDraw.Draw(sheet)
def font(sz, bold=False):
  for p in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
    if os.path.exists(p): return ImageFont.truetype(p, sz)
  return ImageFont.load_default()
F1, F2, F3 = font(20, True), font(14), font(26, True)
d.text((pad, 18), title or f'AI City · UI style lab · {len(styles)} styles · the same menu + agent card over the {man["bg"]} still', font=F3, fill=(236, 236, 238))
for i, s in enumerate(styles):
  x, y = pad + (i % cols) * (cw + pad), 64 + (i // cols) * (ch + lab + pad)
  im = Image.open(os.path.join(src, s['id'] + '.jpg')).convert('RGB').crop(CROP).resize((cw, ch), Image.LANCZOS); sheet.paste(im, (x, y))
  tag = {'ref': '  [today]', 'lime': '  [lime]', 'mix': '  [hybrid]'}.get(s.get('group'), '')
  d.text((x, y + ch + 7), f"{i + 1:02d}  {s['name']}{tag}", font=F1, fill=(182, 255, 46) if s.get('group') == 'lime' else (236, 236, 238))
  line = s['line'].replace('\u2019', "'")
  while d.textlength(line, font=F2) > cw and len(line) > 10: line = line[:-2]
  d.text((x, y + ch + 32), line, font=F2, fill=(160, 160, 168))
sheet.save(out, quality=84, optimize=True, progressive=True)
print(out, sheet.size, os.path.getsize(out) // 1024, 'KB')
