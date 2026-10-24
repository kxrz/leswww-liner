#!/usr/bin/env python3
"""Cadre e-ink : un titre de 320kbps.club et la météo de Lille.

Inky Impression 7.3" (Spectra 6), 800x480.
  python3 cadre.py            affiche le prochain titre pas encore vu
  python3 cadre.py --sync     exécute la dernière demande de la page web, s'il y en a une
  python3 cadre.py --preview  dessine seulement (preview.png), sans toucher à l'écran
  python3 cadre.py --soir     force la version du soir (météo du lendemain)

CADRE_URL et CADRE_TOKEN (cadre.env) relient le cadre à la page web ; sans eux, il tourne seul.
"""
import fcntl
import json
import math
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

import qrcode
import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
STATE = HERE / "state.json"
URL = os.environ.get("CADRE_URL", "").rstrip("/")
AUTH = {"Authorization": f"Bearer {os.environ.get('CADRE_TOKEN', '')}"}
FEED = "https://www.320kbps.club/feed.xml"
MEDIA = "{http://search.yahoo.com/mrss/}content"
METEO = ("https://api.open-meteo.com/v1/forecast?latitude=50.6292&longitude=3.0573"
         "&hourly=temperature_2m,precipitation_probability,weather_code"
         "&daily=temperature_2m_max,temperature_2m_min"
         "&timezone=Europe%2FParis&forecast_days=2")

W, H = 800, 480
# Zone visible à travers le passe-partout (mesurée avec une mire), puis marge intérieure
VISIBLE = (52, 35, 748, 480)
PAD = 24
L, T, R, B = VISIBLE[0] + PAD, VISIBLE[1] + PAD, VISIBLE[2] - PAD, VISIBLE[3] - PAD - 4
# Ordre de palette attendu par la lib inky (6 couleurs pures => pas de tramage de sa part)
PALETTE = [0, 0, 0, 255, 255, 255, 255, 255, 0, 255, 0, 0, 0, 0, 255, 0, 255, 0]
BLACK, WHITE, YELLOW, RED, BLUE, GREEN = range(6)
# Couleurs réellement obtenues à l'écran (SATURATED_PALETTE de la lib inky), mêlées à 50 %
# avec les pures comme le fait la lib : sert au tramage de la pochette et à l'aperçu.
INK = [0, 0, 0, 161, 164, 165, 208, 190, 71, 156, 72, 75, 61, 59, 94, 58, 91, 70]
SEEN = [(a + b) // 2 for a, b in zip(PALETTE, INK)]

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]


def sans(size, weight=400):
    f = ImageFont.truetype(str(HERE / "fonts/IBMPlexSans.ttf"), size)
    f.set_variation_by_axes([weight, 100])
    return f


def mono(size, bold=False):
    return ImageFont.truetype(str(HERE / f"fonts/IBMPlexMono-{'Bold' if bold else 'Regular'}.ttf"), size)


# --- Données ---------------------------------------------------------------

def pick_item(seen, guid=None):
    """Le titre demandé, sinon le plus récent pas encore affiché (on repart de zéro quand tout est vu)."""
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
    if is_album:  # « Bitter Better - EP »
        name, _, fmt = title.rpartition(" - ")
        title = name or title
        details = [f"nouvel {fmt if name else 'album'}"]
    else:  # « Album — 2021 », « Label: … », « Pays — Active since … »
        details = [b.removeprefix("Label: ").split(" — Active")[0] for b in blocks[:3]]
    media = item.find(MEDIA)
    return {
        "guid": item.findtext("guid"), "link": item.findtext("link"),
        "artist": artist, "title": title or artist, "details": details,
        "cover": media.get("url") if media is not None else None,
    }


def get_weather(evening):
    d = requests.get(METEO, timeout=20).json()
    day = 1 if evening else 0
    date = (datetime.now() + timedelta(days=day)).strftime("%Y-%m-%d")
    hourly, daily = d["hourly"], d["daily"]
    idx = {t: i for i, t in enumerate(hourly["time"])}
    slots = []
    for h in (8, 12, 16, 20):
        i = idx[f"{date}T{h:02d}:00"]
        slots.append((h, hourly["weather_code"][i], round(hourly["temperature_2m"][i])))
    return {
        "label": "demain" if evening else "aujourd'hui",
        "tmax": round(daily["temperature_2m_max"][day]),
        "tmin": round(daily["temperature_2m_min"][day]),
        "rain": max(hourly["precipitation_probability"][idx[f"{date}T{h:02d}:00"]] for h in range(7, 22)),  # en journée
        "slots": slots,
    }


# --- Dessin ----------------------------------------------------------------

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
    """Pochette tramée (Floyd-Steinberg) sur les 6 encres de l'écran."""
    img = Image.open(BytesIO(requests.get(url, timeout=20).content)).convert("RGB")
    img = ImageOps.fit(img, (size, size), Image.LANCZOS)
    img = ImageEnhance.Color(img).enhance(1.2)  # l'encre couleur est terne : on compense
    pal = Image.new("P", (1, 1))
    pal.putpalette(SEEN)
    return img.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG)


def kind(code):
    if code <= 1: return "sun"
    if code == 2: return "partly"
    if code == 3: return "cloud"
    if code in (45, 48): return "fog"
    if code >= 95: return "storm"
    if 71 <= code <= 77 or code in (85, 86): return "snow"
    return "rain"


def cloud(d, cx, cy, s, w):
    """Nuage en trait : forme noire puis la même, rétrécie, en blanc."""
    for grow, fill in ((w, BLACK), (0, WHITE)):
        for ox, oy, r in ((-0.38, 0.08, 0.30), (0.08, -0.12, 0.42), (0.5, 0.12, 0.26)):
            x, y, rr = cx + ox * s, cy + oy * s, r * s + grow
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=fill)
        d.rounded_rectangle((cx - 0.68 * s - grow, cy + 0.05 * s - grow, cx + 0.76 * s + grow, cy + 0.38 * s + grow),
                            radius=0.16 * s + grow, fill=fill)


def sun(d, cx, cy, s, w):
    r = 0.36 * s
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=YELLOW, outline=BLACK, width=w)
    for k in range(8):
        a = k * math.pi / 4
        d.line((cx + math.cos(a) * 0.55 * s, cy + math.sin(a) * 0.55 * s,
                cx + math.cos(a) * 0.82 * s, cy + math.sin(a) * 0.82 * s), fill=BLACK, width=w)


def icon(d, cx, cy, s, code):
    """Pictos météo au trait, à la manière d'un réveil Mudita. s = demi-largeur."""
    w = max(2, round(s / 7))
    k = kind(code)
    if k == "sun":
        return sun(d, cx, cy, s, w)
    if k == "fog":
        for i, (a, b) in enumerate(((-0.8, 0.6), (-0.6, 0.8), (-0.8, 0.5))):
            y = cy + (i - 1) * 0.4 * s
            d.line((cx + a * s, y, cx + b * s, y), fill=BLACK, width=w)
        return
    if k == "partly":
        sun(d, cx + 0.32 * s, cy - 0.3 * s, 0.7 * s, w)
    lift = 0 if k in ("partly", "cloud") else 0.28 * s
    cloud(d, cx - 0.05 * s, cy - lift, s, w)
    base = cy - lift + 0.38 * s + w
    if k == "rain":
        for x in (-0.35, 0.05, 0.45):
            d.line((cx + x * s, base + 0.14 * s, cx + (x - 0.12) * s, base + 0.42 * s), fill=BLUE, width=w + 2)
    elif k == "snow":
        for x in (-0.35, 0.05, 0.45):
            r = w * 1.2
            d.ellipse((cx + x * s - r, base + 0.3 * s - r, cx + x * s + r, base + 0.3 * s + r), fill=BLUE)
    elif k == "storm":
        x, y = cx, base + 0.08 * s
        d.polygon([(x + 0.1 * s, y), (x - 0.2 * s, y + 0.3 * s), (x, y + 0.3 * s),
                   (x - 0.12 * s, y + 0.58 * s), (x + 0.24 * s, y + 0.22 * s), (x + 0.04 * s, y + 0.22 * s)], fill=YELLOW, outline=BLACK)


def qr(d, url, x, y, size):
    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_L)
    q.add_data(url)
    m = q.get_matrix()
    cell = size // len(m)
    for j, row in enumerate(m):
        for i, v in enumerate(row):
            if v:
                d.rectangle((x + i * cell, y + j * cell, x + (i + 1) * cell - 1, y + (j + 1) * cell - 1), fill=BLACK)


def render(item, wx, now):
    img = Image.new("P", (W, H), WHITE)
    img.putpalette(PALETTE)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"  # pas d'anticrénelage : des pixels nets, comme une liseuse

    # En-tête
    d.text((L, T), f"{JOURS[now.weekday()]} {now.day} {MOIS[now.month - 1]}", font=sans(21, 450), fill=BLACK)
    d.text((R, T + 4), "320kbps.club", font=mono(15, bold=True), fill=RED, anchor="ra")
    d.line((L, T + 36, R, T + 36), fill=BLACK, width=2)

    # Musique : pochette, titre, artiste, une ligne de détails, QR
    top, cs, qs = T + 56, 184, 72
    if item["cover"]:
        img.paste(cover(item["cover"], cs), (L, top))
    else:
        d.rectangle((L, top, L + cs, top + cs), outline=BLACK, width=2)
    tx = L + cs + 28
    tw = R - tx
    for size in range(42, 25, -2):
        f = sans(size, 300)
        lines = wrap(d, item["title"], f, tw)
        if len(lines) <= 2:
            break
    y = top - round(size * 0.18)
    for line in lines[:3]:
        d.text((tx, y), fit(d, line, f, tw), font=f, fill=BLACK)
        y += round(size * 1.1)
    d.text((tx, y + 8), fit(d, item["artist"], sans(22, 550), tw), font=sans(22, 550), fill=RED)
    # « Album · 2021 » puis « Label · Pays », calés en bas de la pochette
    det = item["details"]
    rows = [det[0].replace(" — ", " · ")] + ([" · ".join(det[1:3])] if len(det) > 1 else [])
    for i, row in enumerate(reversed(rows)):
        d.text((tx, top + cs - i * 22), fit(d, row, mono(15), tw - qs - 20), font=mono(15), fill=BLACK, anchor="ls")
    qr(d, item["link"], R - qs, top + cs - qs, qs)

    # Météo : grande température, infos, quatre créneaux
    rule = top + cs + 20
    d.line((L, rule, R, rule), fill=BLACK, width=2)
    wy = rule + 18
    hue = BLUE if wx["tmax"] < 12 else RED if wx["tmax"] >= 24 else BLACK  # frais / doux / chaud
    d.text((L - 4, B), f"{wx['tmax']}°", font=sans(110, 340), fill=hue, anchor="ls")
    ix = L + 204
    d.text((ix, wy - 4), "Lille", font=sans(22, 550), fill=BLACK)
    for i, text in enumerate((wx["label"], f"min {wx['tmin']}°", f"pluie {wx['rain']}%")):
        wet = text.startswith("pluie") and wx["rain"] >= 50
        d.text((ix, wy + 30 + i * 24), text, font=mono(15, bold=wet), fill=BLUE if wet else BLACK)
    col = 64
    for i, (h, code, t) in enumerate(wx["slots"]):
        cx = R - col * (3 - i) - col // 2
        d.text((cx, wy), f"{h}h", font=mono(15), fill=BLACK, anchor="ma")
        icon(d, cx, wy + 52, 15, code)
        d.text((cx, B), f"{t}°", font=sans(24, 500), fill=BLACK, anchor="ms")
    return img


def load_state():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    return state if isinstance(state, dict) else {"seen": state}  # ancien format : la liste seule


def show(guid=None, command=0):
    state = load_state()
    seen = state.get("seen", [])
    now = datetime.now()
    item = pick_item(seen, guid)
    img = render(item, get_weather("--soir" in sys.argv or now.hour >= 15), now)
    preview = img.copy()
    preview.putpalette(SEEN)  # aperçu proche du rendu réel de l'encre
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
    print(f"Affiché : {item['artist']} — {item['title']}")
    if URL:
        try:
            requests.post(f"{URL}/api/pi", headers=AUTH, timeout=20, json={
                "guid": item["guid"], "title": item["title"], "artist": item["artist"], "command": command})
        except requests.RequestException as e:
            print(f"Compte rendu non envoyé : {e}")


def sync():
    """Applique la dernière demande de la page web, si elle est plus récente que la dernière traitée."""
    if not URL:
        return
    r = requests.get(f"{URL}/api/pi", headers=AUTH, timeout=20)
    r.raise_for_status()
    cmd = r.json()
    state = load_state()
    if cmd.get("id", 0) <= state.get("command", 0):
        return
    print(f"Demande reçue : {cmd['action']}")
    if cmd["action"] == "refresh":
        show((state.get("seen") or [None])[-1], cmd["id"])
    else:
        show(cmd.get("guid") if cmd["action"] == "show" else None, cmd["id"])


def main():
    # Une seule mise à jour à la fois : la synchro passe son tour si l'écran est déjà occupé.
    lock = open(HERE / ".lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | (fcntl.LOCK_NB if "--sync" in sys.argv else 0))
    except BlockingIOError:
        return
    sync() if "--sync" in sys.argv else show()


if __name__ == "__main__":
    main()
