"""Builds the site's sprite sheets from a render set (v40):
  python3 build_sheets.py 40 ../v40/assets/img
  flip<N>/f00..f15 (900 x 1800)      -> ember-flip.webp  7200 x 3600 (8 x 2)
  turn<N>/turn/f00..f35 (420 x 1260) -> ember-turn.webp  2520 x 7560 (6 x 6)
  hero<N>/f00 (1350 x 2700)          -> ember-hero.webp
  box<N>/box.png + team cable        -> box.webp (compose_box.py)"""
import sys, os, subprocess
from PIL import Image
n, dst = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(base, 'out')
sh = Image.new('RGBA', (7200, 3600), (0, 0, 0, 0))
for i in range(16):
    f = Image.open(os.path.join(out, 'flip' + n, 'f%02d.png' % i)).convert('RGBA'); assert f.size == (900, 1800), f.size
    sh.paste(f, ((i % 8) * 900, (i // 8) * 1800))
sh.save(os.path.join(dst, 'ember-flip.webp'), 'WEBP', quality=88, method=6)
tn = Image.new('RGBA', (2520, 7560), (0, 0, 0, 0))
for i in range(36):
    f = Image.open(os.path.join(out, 'turn' + n, 'turn', 'f%02d.png' % i)).convert('RGBA'); assert f.size == (420, 1260), f.size
    tn.paste(f, ((i % 6) * 420, (i // 6) * 1260))
tn.save(os.path.join(dst, 'ember-turn.webp'), 'WEBP', quality=88, method=6)
Image.open(os.path.join(out, 'hero' + n, 'f00.png')).convert('RGBA').save(os.path.join(dst, 'ember-hero.webp'), 'WEBP', quality=90, method=6)
subprocess.check_call([sys.executable, os.path.join(base, 'compose_box.py'), os.path.join(out, 'box' + n, 'box.png'), os.path.join(dst, 'box.webp')], cwd=base)
print('sheets written to', dst)
