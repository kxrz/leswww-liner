#!/usr/bin/env python3
"""Show a test grid on the panel, to measure how much of it your frame's mat leaves visible.

Each nested rectangle is 20 px further in, labelled on every edge. Photograph the frame and note, for each edge, the
smallest number you can read in full: that is the margin hidden by the mat. Then set, in liner.env,

    LINER_VISIBLE=left,top,800-right,480-bottom      e.g. LINER_VISIBLE=52,35,748,480

and the same values in lib/frame.ts for the web page's mockup.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 800, 480
FONTS = Path(__file__).resolve().parent / "fonts"

img = Image.new("P", (W, H), 1)
img.putpalette([0, 0, 0, 255, 255, 255, 255, 255, 0, 255, 0, 0, 0, 0, 255, 0, 255, 0])
d = ImageDraw.Draw(img)
d.fontmode = "1"
label = ImageFont.truetype(str(FONTS / "IBMPlexMono-Bold.ttf"), 14)
for v in range(0, 101, 20):
    if v:
        d.rectangle((v, v, W - 1 - v, H - 1 - v), outline=0)
    d.text((W // 2, v + 2), str(v), font=label, fill=0, anchor="ma")
    d.text((W // 2, H - 1 - v - 2), str(v), font=label, fill=0, anchor="md")
    d.text((v + 3, H // 2), str(v), font=label, fill=0, anchor="lm")
    d.text((W - 1 - v - 3, H // 2), str(v), font=label, fill=0, anchor="rm")
d.rectangle((0, 0, W - 1, H - 1), outline=0)
d.text((W // 2, H // 2), "Liner · test grid · 20 px per step", font=ImageFont.truetype(str(FONTS / "IBMPlexMono-Regular.ttf"), 18), fill=0, anchor="mm")

from inky.auto import auto  # noqa: E402  (only on the Pi)

display = auto()
display.set_image(img)
display.show()
print("Test grid on the panel. Photograph it, then set LINER_VISIBLE in liner.env.")
