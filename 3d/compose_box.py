"""v40: the box picture: our render of Ember and the sticker (ember_scene.py mode=box, without our cable) with the
team's USB-C cable (team/box-cable.webp, from matsdr/Ember-Scroll-Website-Design assets) composited on the left.
Scale: the render is 264 mm over 2400 px (9.09 px/mm); the coiled cable is about 90 mm high, its plugs end level with
Ember's bottom, centred where the cable's name sits (21.1 % of the width).
  python3 compose_box.py out/box40/box.png ../v40/assets/img/box.webp"""
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
box = Image.open(src).convert('RGBA')
W, H = box.size; pxmm = W / 264.0
cable = Image.open('team/box-cable.webp').convert('RGBA'); cable = cable.crop(cable.getbbox())
h = round(90 * pxmm); w = round(cable.width * h / cable.height)
cable = cable.resize((w, h), Image.LANCZOS)
# Ember's lowest point in the render: the bottom of its alpha column at its centre (54.6 % of the width)
a = box.getchannel('A'); ex = round(W * 0.546); col = [a.getpixel((ex, y)) for y in range(H)]
bottom = max(y for y, v in enumerate(col) if v > 20)
x = round(W * 0.211 - w / 2); y = bottom - h
out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.alpha_composite(cable, (max(0, x), y)); out.alpha_composite(box)
out.save(dst, 'WEBP', quality=88, method=6)
print('cable', w, h, 'at', x, y, 'ember bottom', bottom)
