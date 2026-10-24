#!/usr/bin/env python3
"""Liner, by 320kbps.club: one track at a time on an e-ink frame, hung like a work in a museum.

The cover and its liner notes sit on a museum label, laid over a map of where the artist comes from.
Pimoroni Inky Impression 7.3" (Spectra 6), 800x480.

  python3 liner.py            draw the newest track not shown yet
  python3 liner.py --sync     carry out the latest request from the web page, if there is a new one
  python3 liner.py --preview  draw preview.png only, leave the screen alone

LINER_URL and LINER_TOKEN (liner.env) link the frame to its web page; without them it runs on its own, without maps.
"""
import fcntl
import html
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote

import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
STATE = HERE / "state.json"
URL = os.environ.get("LINER_URL", "").rstrip("/")
AUTH = {"Authorization": f"Bearer {os.environ.get('LINER_TOKEN', '')}"}
FEED = "https://www.320kbps.club/feed.xml"
MEDIA = "{http://search.yahoo.com/mrss/}content"

W, H = 800, 480
# The part of the panel the frame's mat leaves visible (measured with a test grid), then an inner margin
VISIBLE = (52, 35, 748, 480)
L, T, R, B = VISIBLE[0] + 20, VISIBLE[1] + 16, VISIBLE[2] - 20, VISIBLE[3] - 16
# Palette order the inky library expects (six pure inks, so it does not dither again)
PALETTE = [0, 0, 0, 255, 255, 255, 255, 255, 0, 255, 0, 0, 0, 0, 255, 0, 255, 0]
BLACK, WHITE, YELLOW, RED, BLUE, GREEN = range(6)
# What the panel actually shows (the inky library's SATURATED_PALETTE), blended 50/50 with the pure inks
# as the library does: used to dither the cover and to render the preview.
INK = [0, 0, 0, 161, 164, 165, 208, 190, 71, 156, 72, 75, 61, 59, 94, 58, 91, 70]
SEEN = [(a + b) // 2 for a, b in zip(PALETTE, INK)]
INK_NAMES = {BLACK: "black", WHITE: "white", YELLOW: "yellow", RED: "red", BLUE: "blue", GREEN: "green"}
# Duotones (background, line), picked from the cover's dominant ink
DUOTONES = {BLUE: (BLUE, WHITE), RED: (RED, WHITE), GREEN: (GREEN, WHITE), YELLOW: (YELLOW, BLACK), None: (WHITE, BLACK)}


def sans(size, weight=400):
    f = ImageFont.truetype(str(HERE / "fonts/IBMPlexSans.ttf"), size)
    f.set_variation_by_axes([weight, 100])
    return f


def mono(size, bold=False):
    return ImageFont.truetype(str(HERE / f"fonts/IBMPlexMono-{'Bold' if bold else 'Regular'}.ttf"), size)


# --- Data ------------------------------------------------------------------

def pick_item(seen, guid=None):
    """The requested track, otherwise the newest one not shown yet (starting over once all have been shown)."""
    root = ET.fromstring(requests.get(FEED, timeout=20).content)
    items = [i for i in root.iter("item") if "/playlist/" not in i.findtext("link")]
    item = next((i for i in items if i.findtext("guid") == guid), None) if guid else None
    if item is None:
        item = next((i for i in items if i.findtext("guid") not in seen), None)
    if item is None:
        seen.clear()
        item = items[0]

    raw = item.findtext("title")
    is_album = raw.startswith("New album: ")
    artist, _, title = raw.removeprefix("New album: ").partition(" — ")
    blocks = [b.strip() for b in item.findtext("description", "").split("\n\n") if b.strip()]
    info = {"kind": "track", "album": "", "year": "", "label": "", "country": ""}
    if is_album:  # "Bitter Better - EP"; the description is an editorial text
        name, _, fmt = title.rpartition(" - ")
        title = name or title
        info["kind"] = fmt.lower() if name else "album"
        info.update(album_page(item.findtext("link")))
    elif blocks:  # "Album - Single — 2021", "Label: …", "Country — Active since …"
        head, _, year = blocks[0].rpartition(" — ")
        if not re.fullmatch(r"\d{4}", year):
            head, year = blocks[0], ""
        name, _, fmt = head.rpartition(" - ")
        if fmt in ("Single", "EP"):
            head, info["kind"] = name, fmt.lower()
        info["album"] = "" if head == title else head
        info["year"] = year
        for b in blocks[1:]:  # which of these blocks are there, and in what order, varies from track to track
            if b.startswith("Label: "):
                info["label"] = b.removeprefix("Label: ")
            elif len(b) < 60:
                info["country"] = b.split(" — ")[0]
    media = item.find(MEDIA)
    return {
        "guid": item.findtext("guid"), "link": item.findtext("link"),
        "artist": artist, "title": title or artist, **info,
        "cover": media.get("url") if media is not None else None,
    }


def album_page(link):
    """An album's year and style, read from its page (the feed only carries an editorial text)."""
    try:
        page = requests.get(link, timeout=20).text
    except requests.RequestException:
        return {}
    page = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    words = [w for w in (html.unescape(x).strip() for x in re.split(r"<[^>]+>", page)) if w]
    after = lambda key: words[words.index(key) + 1] if key in words[:-1] else ""
    return {"year": after("Year"), "style": after("Styles")}


# --- Drawing ---------------------------------------------------------------

def wrap(draw, text, font, width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if not line or draw.textlength(test, font=font) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    return lines + [line] if line else lines


def fit(draw, text, font, width):
    while draw.textlength(text, font=font) > width and len(text) > 1:
        text = text[:-2].rstrip() + "…"
    return text


def cover(url, size):
    """The cover, dithered (Floyd-Steinberg) onto the panel's six inks."""
    img = Image.open(BytesIO(requests.get(url, timeout=20).content)).convert("RGB")
    img = ImageOps.fit(img, (size, size), Image.LANCZOS)
    img = ImageEnhance.Color(img).enhance(1.2)  # colour e-ink is dull: compensate a little
    pal = Image.new("P", (1, 1))
    pal.putpalette(SEEN)
    return img.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG)


def accent(img):
    """The colour ink covering at least 12% of the cover, if there is one."""
    total = img.width * img.height
    for n, i in sorted(img.getcolors(), reverse=True):
        if i in (RED, BLUE, GREEN, YELLOW) and n > total * 0.12:
            return i
    return None


def origin_map(item, box, bg, ink):
    """The map, drawn by the web page over the whole visible area, mapped back to the palette without dithering."""
    if not URL:
        return None, item["country"]
    w, h = VISIBLE[2] - VISIBLE[0], VISIBLE[3] - VISIBLE[1]
    try:  # the server works out where the artist comes from; the feed's origin helps it pick between namesakes
        r = requests.get(f"{URL}/api/map", timeout=60, params={
            "artist": item["artist"], "hint": item["country"], "v": 3, "w": w, "h": h,
            "box": ",".join(str(v) for v in box), "bg": INK_NAMES[bg], "ink": INK_NAMES[ink]})
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"No map: {e}")
        return None, item["country"]
    pal = Image.new("P", (1, 1))
    pal.putpalette(PALETTE)
    img = Image.open(BytesIO(r.content)).convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE)
    return img, unquote(r.headers.get("X-Place", ""))


def render(item, now):
    art = cover(item["cover"], 220) if item["cover"] else None
    bg, ink = DUOTONES[accent(art) if art else None]
    img = Image.new("P", (W, H), bg)
    img.putpalette(PALETTE)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"  # no antialiasing: crisp pixels, like an e-reader

    # Museum label: a white card on the left, with a hard drop shadow
    cw, pad = 248, 14  # 248 - 2×14 = 220, the width of the cover
    x0, x1 = L, L + cw
    inner = cw - 2 * pad

    # The map first: the country is fitted right of the label, its neighbours run underneath
    box = (x1 + 30 - VISIBLE[0], 24, VISIBLE[2] - VISIBLE[0] - 24, VISIBLE[3] - VISIBLE[1] - 24)
    picture, place = origin_map(item, box, bg, ink)
    item["place"] = place
    if picture:
        img.paste(picture, VISIBLE[:2])

    # The label's text, measured before drawing the card
    lines = [(item["artist"], sans(21, 600), BLACK, 25)]  # (text, font, colour, line height)
    title = wrap(d, item["title"], sans(18, 300), inner)
    if len(title) > 2:
        title = [title[0], " ".join(title[1:])]  # fit() trims the end
    lines += [(line, sans(18, 300), BLACK, 22) for line in title]
    lines.append(("", None, None, 8))
    work = ", ".join(x for x in (item["album"] or item["kind"], item["year"]) if x)
    for text in (" · ".join(x for x in (work, item.get("style", "")) if x), item["label"], place):
        if text:
            lines.append((text, mono(12), BLACK, 16))
    lines.append(("", None, None, 10))
    lines.append((f"320kbps.club · {now.day:02d}.{now.month:02d}.{now.year}", mono(11), RED, 14))

    text_h = sum(lh for *_, lh in lines)
    card_h = pad + inner + 14 + text_h + pad
    y0 = max(T, (T + B - card_h) // 2)
    d.rectangle((x0 + 8, y0 + 8, x1 + 8, y0 + card_h + 8), fill=BLACK if bg != BLACK else WHITE)
    d.rectangle((x0, y0, x1, y0 + card_h), fill=WHITE, outline=BLACK, width=1)
    if art:
        img.paste(art, (x0 + pad, y0 + pad))
    y = y0 + pad + inner + 14
    for text, font, colour, lh in lines:
        if font:
            d.text((x0 + pad, y), fit(d, text, font, inner), font=font, fill=colour)
        y += lh
    return img


# --- Display and sync ------------------------------------------------------

def load_state():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    return state if isinstance(state, dict) else {"seen": state}  # older format: just the list


def show(guid=None, command=0):
    state = load_state()
    seen = state.get("seen", [])
    item = pick_item(seen, guid)
    img = render(item, datetime.now())
    preview = img.copy()
    preview.putpalette(SEEN)  # close to what the ink really looks like
    preview.convert("RGB").save(HERE / "preview.png")
    if "--preview" in sys.argv:
        return
    from inky.auto import auto
    display = auto()
    display.set_image(img)
    display.show()
    state["seen"] = [g for g in seen if g != item["guid"]] + [item["guid"]]
    state["command"] = max(command, state.get("command", 0))
    STATE.write_text(json.dumps(state))
    print(f"On the wall: {item['artist']} — {item['title']} ({item['place'] or 'origin unknown'})")
    if URL:
        report(item, preview, command)


def report(item, preview, command):
    """Upload the picture (doubled, crisp pixels, for downloading) then tell the page what is on the wall."""
    try:
        png = BytesIO()
        preview.convert("RGB").resize((W * 2, H * 2), Image.NEAREST).save(png, "PNG", optimize=True)
        r = requests.put(f"{URL}/api/pi/visual", headers={**AUTH, "Content-Type": "image/png"},
                         params={"guid": item["guid"]}, data=png.getvalue(), timeout=60)
        r.raise_for_status()
        requests.post(f"{URL}/api/pi", headers=AUTH, timeout=20, json={
            "guid": item["guid"], "title": item["title"], "artist": item["artist"], "command": command,
            "place": item["place"], "visual": r.json()["url"]}).raise_for_status()
    except requests.RequestException as e:
        print(f"Report not sent: {e}")


def sync():
    """Carry out the page's latest request, if it is newer than the last one handled."""
    if not URL:
        return
    r = requests.get(f"{URL}/api/pi", headers=AUTH, timeout=20)
    r.raise_for_status()
    cmd = r.json()
    state = load_state()
    if cmd.get("id", 0) <= state.get("command", 0):
        return
    print(f"Request: {cmd['action']}")
    if cmd["action"] == "refresh":
        show((state.get("seen") or [None])[-1], cmd["id"])
    else:
        show(cmd.get("guid") if cmd["action"] == "show" else None, cmd["id"])


def main():
    # One redraw at a time: the sync skips its turn if the screen is busy.
    lock = open(HERE / ".lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | (fcntl.LOCK_NB if "--sync" in sys.argv else 0))
    except BlockingIOError:
        return
    sync() if "--sync" in sys.argv else show()


if __name__ == "__main__":
    main()
