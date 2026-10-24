#!/usr/bin/env python3
"""Cadre e-ink : un titre de 320kbps.club, son vinyle qui sort de la pochette, et la carte d'où vient l'artiste.

Inky Impression 7.3" (Spectra 6), 800x480.
  python3 cadre.py            affiche le prochain titre pas encore vu
  python3 cadre.py --sync     exécute la dernière demande de la page web, s'il y en a une
  python3 cadre.py --preview  dessine seulement (preview.png), sans toucher à l'écran

CADRE_URL et CADRE_TOKEN (cadre.env) relient le cadre à la page web ; sans eux, il tourne seul.
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

import qrcode
import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
STATE = HERE / "state.json"
URL = os.environ.get("CADRE_URL", "").rstrip("/")
AUTH = {"Authorization": f"Bearer {os.environ.get('CADRE_TOKEN', '')}"}
FEED = "https://www.320kbps.club/feed.xml"
MEDIA = "{http://search.yahoo.com/mrss/}content"

W, H = 800, 480
# Zone visible à travers le passe-partout (mesurée avec une mire), puis marge intérieure
VISIBLE = (52, 35, 748, 480)
L, T, R, B = VISIBLE[0] + 20, VISIBLE[1] + 16, VISIBLE[2] - 20, VISIBLE[3] - 16
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
    info = {"kind": "titre", "album": "", "year": "", "label": "", "country": ""}
    if is_album:  # « Bitter Better - EP » ; la description est un texte éditorial
        name, _, fmt = title.rpartition(" - ")
        title = name or title
        info["kind"] = fmt.lower() if name else "album"
        info.update(album_page(item.findtext("link")))
    elif blocks:  # « Album - Single — 2021 », « Label: … », « Pays — Active since … »
        head, _, year = blocks[0].rpartition(" — ")
        if not re.fullmatch(r"\d{4}", year):
            head, year = blocks[0], ""
        name, _, fmt = head.rpartition(" - ")
        if fmt in ("Single", "EP"):
            head, info["kind"] = name, fmt.lower()
        info["album"] = "" if head == title else head
        info["year"] = year
        for b in blocks[1:]:  # l'ordre et la présence de ces blocs varient d'un titre à l'autre
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
    """Année, style et tracklist d'un album, lus sur sa page (le flux ne donne qu'un texte éditorial)."""
    try:
        page = requests.get(link, timeout=20).text
    except requests.RequestException:
        return {}
    page = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    words = [w for w in (html.unescape(x).strip() for x in re.split(r"<[^>]+>", page)) if w]
    after = lambda key: words[words.index(key) + 1] if key in words[:-1] else ""
    tracks = [(words[i - 2], words[i]) for i in range(2, len(words) - 1)
              if words[i - 1] == "." and words[i - 2].isdigit() and re.fullmatch(r"\d+:\d\d", words[i + 1])]
    return {"year": after("Year"), "style": after("Styles"), "tracks": tracks}


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


INK_NAMES = {RED: "red", BLUE: "blue", GREEN: "green", YELLOW: "yellow"}


def origin_map(origin, w, h, ink):
    """Carte rendue par la page web (PNG aux encres pures), ramenée à la palette sans tramage."""
    if not (URL and origin):
        return None, origin
    try:
        r = requests.get(f"{URL}/api/map", timeout=30,
                         params={"origin": origin, "w": w, "h": h, "accent": INK_NAMES[ink]})
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"Carte indisponible pour {origin} : {e}")
        return None, origin
    pal = Image.new("P", (1, 1))
    pal.putpalette(PALETTE)
    img = Image.open(BytesIO(r.content)).convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE)
    return img, unquote(r.headers.get("X-Place", origin))


def accent(img):
    """L'encre de couleur la plus présente sur la pochette, pour teinter le macaron du disque."""
    total = img.width * img.height
    for n, i in sorted(img.getcolors(), reverse=True):
        if i in (RED, BLUE, GREEN, YELLOW) and n > total * 0.05:
            return i
    return RED


def vinyl(d, cx, cy, r, label):
    """Disque noir, sillons bleu nuit (discrets sur l'encre), deux reflets, macaron coloré."""
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLACK)
    lr = round(r * 0.34)
    for rr in range(lr + 8, r - 4, 6):
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=BLUE, width=1)
    for start in (200, 20):  # reflets en vis-à-vis
        for rr in range(lr + 16, r - 10, 6):
            d.arc((cx - rr, cy - rr, cx + rr, cy + rr), start, start + 26, fill=WHITE, width=1)
    d.ellipse((cx - lr, cy - lr, cx + lr, cy + lr), fill=label)
    ring = BLACK if label == YELLOW else WHITE
    d.ellipse((cx - lr + 5, cy - lr + 5, cx + lr - 5, cy + lr - 5), outline=ring, width=1)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=WHITE)


def qr(d, url, right, bottom):
    """QR calé en bas à droite, modules de 3 px : lisible au téléphone quelle que soit la longueur de l'URL."""
    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_L)
    q.add_data(url)
    m = q.get_matrix()
    cell = 3
    x, y = right - len(m) * cell, bottom - len(m) * cell
    for j, row in enumerate(m):
        for i, v in enumerate(row):
            if v:
                d.rectangle((x + i * cell, y + j * cell, x + (i + 1) * cell - 1, y + (j + 1) * cell - 1), fill=BLACK)
    return len(m) * cell


def render(item, now):
    img = Image.new("P", (W, H), WHITE)
    img.putpalette(PALETTE)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"  # pas d'anticrénelage : des pixels nets, comme une liseuse

    # Le disque d'abord, la pochette par-dessus : il a l'air d'en glisser
    cs, r = 260, 118
    art = cover(item["cover"], cs) if item["cover"] else None
    ink = accent(art) if art else RED
    vx = L + cs + 20
    vinyl(d, vx, T + cs // 2, r, ink)
    d.rectangle((L + 7, T + 7, L + cs + 7, T + cs + 7), fill=BLACK)  # ombre portée franche
    if art:
        img.paste(art, (L, T))
    else:
        d.rectangle((L, T, L + cs, T + cs), fill=WHITE, outline=BLACK, width=2)

    # Colonne de droite : d'où vient l'artiste
    cx = vx + r + 22
    cw = R - cx
    d.text((cx, T), "320kbps.club", font=mono(14, bold=True), fill=RED)
    d.text((cx, T + 19), f"{JOURS[now.weekday()]} {now.day} {MOIS[now.month - 1]}", font=mono(13), fill=BLACK)
    mh = cs - 92
    carte, place = origin_map(item["country"], cw, mh, ink)
    if carte:
        img.paste(carte, (cx, T + 50))
        d.text((cx, T + cs), fit(d, place, sans(18, 550), cw), font=sans(18, 550), fill=BLACK, anchor="ls")
    elif item.get("tracks"):  # les albums n'ont pas d'origine dans le flux : leur tracklist
        y = T + 56
        head = " · ".join(x for x in (item["kind"], item["year"], item.get("style", "")) if x)
        d.text((cx, y), fit(d, head, mono(13, bold=True), cw), font=mono(13, bold=True), fill=BLACK)
        d.line((cx, y + 22, R, y + 22), fill=BLACK, width=2)
        y += 34
        for n, name in item["tracks"][:8]:
            d.text((cx, y), n.rjust(2), font=mono(13), fill=RED)
            d.text((cx + 26, y - 2), fit(d, name, sans(16, 400), cw - 26), font=sans(16, 400), fill=BLACK)
            y += 24

    # Bandeau du bas : titre en grand, artiste en rouge, une ligne de détails, QR
    tw = R - L - qr(d, item["link"], R, B) - 24
    for size in range(50, 25, -2):
        f = sans(size, 300)
        if d.textlength(item["title"], font=f) <= tw:
            break
    base = T + cs + 26 + size  # titre, artiste et détails serrés en un bloc
    d.text((L - 2, base), fit(d, item["title"], f, tw), font=f, fill=BLACK, anchor="ls")
    d.text((L, base + 36), fit(d, item["artist"], sans(24, 600), tw), font=sans(24, 600), fill=RED, anchor="ls")
    details = " · ".join(x for x in (item["album"], item["year"], item["label"]) if x)
    if details:
        d.text((L, base + 62), fit(d, details, mono(13), tw), font=mono(13), fill=BLACK, anchor="ls")
    return img


# --- Affichage et synchro --------------------------------------------------

def load_state():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    return state if isinstance(state, dict) else {"seen": state}  # ancien format : la liste seule


def show(guid=None, command=0):
    state = load_state()
    seen = state.get("seen", [])
    item = pick_item(seen, guid)
    img = render(item, datetime.now())
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
