#!/usr/bin/env python3
"""Liner, a LesWWW project: one track from 320kbps.club at a time on an e-ink frame, hung like a work in a museum.

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
import time
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


# The 4K wallpaper: the 800×480 layout scaled ×4.5 (3600×2160), centred on a 16:9 canvas
HD_SIZE, HD_SCALE = (3840, 2160), 4.5
HD_X = (HD_SIZE[0] - round(W * HD_SCALE)) // 2


def fetch_cover(url):
    return Image.open(BytesIO(requests.get(url, timeout=20).content)).convert("RGB") if url else None


def dither(raw, size, bw=False):
    """The cover, dithered (Floyd-Steinberg) onto the panel's six inks, or onto black and white."""
    img = ImageOps.fit(raw, (size, size), Image.LANCZOS)
    if bw:
        bits = ImageOps.autocontrast(img.convert("L"), cutoff=1).convert("1")
        return Image.frombytes("P", bits.size, bytes(WHITE if p else BLACK for p in bits.getdata()))
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


def origin_map(item, box, bg, ink, hd=False):
    """The map, drawn by the web page: panel-sized in pure inks, or 4K and smooth in the panel's tones."""
    if not URL:
        return None, item["country"]
    w, h = HD_SIZE if hd else (VISIBLE[2] - VISIBLE[0], VISIBLE[3] - VISIBLE[1])
    style = {"s": HD_SCALE, "tone": "seen"} if hd else {}
    params = {"artist": item["artist"], "hint": item["country"], "v": 4, "w": w, "h": h, **style,
              "box": ",".join(str(v) for v in box), "bg": INK_NAMES[bg], "ink": INK_NAMES[ink]}
    # The server works out where the artist comes from (the feed's origin helps it pick between namesakes).
    # It answers 503 when MusicBrainz is busy: worth a second try.
    for attempt in (1, 2):
        try:
            r = requests.get(f"{URL}/api/map", timeout=90, params=params)
            r.raise_for_status()
            break
        except requests.RequestException as e:
            busy = isinstance(e, requests.HTTPError) and e.response.status_code == 503
            if attempt == 2 or not busy:
                print(f"No map: {e}")
                return None, item["country"]
            time.sleep(10)
    img = Image.open(BytesIO(r.content)).convert("RGB")
    if not hd:
        pal = Image.new("P", (1, 1))
        pal.putpalette(PALETTE)
        img = img.quantize(palette=pal, dither=Image.Dither.NONE)
    return img, unquote(r.headers.get("X-Place", ""))


def render(item, now, mode="eink", raw=None):
    """Draw the picture: "eink" for the colour panel, "bw" for a black and white panel, "hd" for the 4K wallpaper.

    The layout is the same in all three; coordinates are in panel pixels and scaled for the wallpaper.
    """
    hd = mode == "hd"
    k, ox = (HD_SCALE, HD_X) if hd else (1, 0)
    z = lambda v: round(v * k)  # panel pixels → canvas pixels
    X = lambda x: ox + z(x)
    colour_art = dither(raw, 220) if raw else None
    bg, ink = (WHITE, BLACK) if mode == "bw" else DUOTONES[accent(colour_art) if colour_art else None]
    tone = (lambda i: tuple(SEEN[3 * i:3 * i + 3])) if hd else (lambda i: i)

    if hd:
        img = Image.new("RGB", HD_SIZE, tone(bg))
    else:
        img = Image.new("P", (W, H), bg)
        img.putpalette(PALETTE)
    d = ImageDraw.Draw(img)
    if not hd:
        d.fontmode = "1"  # no antialiasing: crisp pixels, like an e-reader

    # Museum label: a white card on the left, with a hard drop shadow
    cw, pad = 248, 14  # 248 - 2×14 = 220, the width of the cover
    x0, x1 = L, L + cw
    inner = cw - 2 * pad

    # The map first: the country is fitted right of the label, its neighbours run underneath
    box = (x1 + 30 - VISIBLE[0], 24, VISIBLE[2] - VISIBLE[0] - 24, VISIBLE[3] - VISIBLE[1] - 24)
    if hd:  # the wallpaper's map covers the whole canvas
        box = (X(VISIBLE[0] + box[0]), z(VISIBLE[1] + box[1]), X(VISIBLE[0] + box[2]), z(VISIBLE[1] + box[3]))
    picture, place = origin_map(item, box, bg, ink, hd)
    item["place"] = place
    if picture:
        img.paste(picture, (0, 0) if hd else VISIBLE[:2])

    # The label's text, measured before drawing the card (line heights in panel pixels)
    lines = [(item["artist"], sans(z(21), 600), BLACK, 25)]  # (text, font, colour, line height)
    title = wrap(d, item["title"], sans(z(18), 300), z(inner))
    if len(title) > 2:
        title = [title[0], " ".join(title[1:])]  # fit() trims the end
    lines += [(line, sans(z(18), 300), BLACK, 22) for line in title]
    lines.append(("", None, None, 8))
    work = ", ".join(x for x in (item["album"] or item["kind"], item["year"]) if x)
    for text in (" · ".join(x for x in (work, item.get("style", "")) if x), item["label"], place):
        if text:
            lines.append((text, mono(z(12)), BLACK, 16))
    lines.append(("", None, None, 10))
    stamp = f"320kbps.club · {now.day:02d}.{now.month:02d}.{now.year}"
    lines.append((stamp, mono(z(11)), BLACK if mode == "bw" else RED, 14))

    text_h = sum(lh for *_, lh in lines)
    card_h = pad + inner + 14 + text_h + pad
    y0 = max(T, (T + B - card_h) // 2)
    d.rectangle((X(x0 + 8), z(y0 + 8), X(x1 + 8), z(y0 + card_h + 8)), fill=tone(BLACK if bg != BLACK else WHITE))
    d.rectangle((X(x0), z(y0), X(x1), z(y0 + card_h)), fill=tone(WHITE), outline=tone(BLACK), width=max(1, z(1)))
    if raw:
        if mode == "eink":
            art = colour_art
        elif mode == "bw":
            art = dither(raw, 220, bw=True)
        else:  # the wallpaper keeps the cover as it is, full definition
            art = ImageOps.fit(raw, (z(inner), z(inner)), Image.LANCZOS)
        img.paste(art, (X(x0 + pad), z(y0 + pad)))
    y = y0 + pad + inner + 14
    for text, font, colour, lh in lines:
        if font:
            d.text((X(x0 + pad), z(y)), fit(d, text, font, z(inner)), font=font, fill=tone(colour))
        y += lh
    return img


def as_seen(img):
    """A panel image in the colours the ink really shows."""
    rgb = img.copy()
    rgb.putpalette(SEEN)
    return rgb.convert("RGB")


def encode(img, kind):
    """PNG for the panel pictures (doubled, crisp pixels); JPEG for the wallpaper, small enough to upload."""
    out = BytesIO()
    if kind == "hd":
        for quality in (90, 82, 74):  # Vercel functions take bodies up to 4.5 MB
            out = BytesIO()
            img.save(out, "JPEG", quality=quality, subsampling=0)
            if out.tell() < 4_300_000:
                break
    else:
        as_seen(img).resize((W * 2, H * 2), Image.NEAREST).save(out, "PNG", optimize=True)
    return out.getvalue()


# --- Display and sync ------------------------------------------------------

def load_state():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    return state if isinstance(state, dict) else {"seen": state}  # older format: just the list


def show(guid=None, command=0):
    state = load_state()
    seen = state.get("seen", [])
    item = pick_item(seen, guid)
    now = datetime.now()
    raw = fetch_cover(item["cover"])
    img = render(item, now, "eink", raw)
    as_seen(img).save(HERE / "preview.png")
    if "--preview" in sys.argv:
        as_seen(render(item, now, "bw", raw)).save(HERE / "preview-bw.png")
        render(item, now, "hd", raw).save(HERE / "preview-4k.jpg", quality=90)
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
        report(item, img, raw, now, command)


def upload(item, kind, img):
    r = requests.put(f"{URL}/api/pi/visual", params={"guid": item["guid"], "kind": kind}, timeout=120,
                     headers={**AUTH, "Content-Type": "image/jpeg" if kind == "hd" else "image/png"},
                     data=encode(img, kind))
    r.raise_for_status()
    return r.json()["url"]


def report(item, img, raw, now, command):
    """Upload what is on the wall and tell the page; then make and upload the black and white and 4K versions."""
    try:
        visual = upload(item, "eink", img)
        requests.post(f"{URL}/api/pi", headers=AUTH, timeout=20, json={
            "guid": item["guid"], "title": item["title"], "artist": item["artist"], "command": command,
            "place": item["place"], "visual": visual}).raise_for_status()
        for kind in ("bw", "hd"):  # after the report, so the page is not kept waiting
            upload(item, kind, render(item, now, kind, raw))
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
