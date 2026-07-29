import sys
from datetime import datetime
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

API_URL = "https://tekpi-eink.vercel.app/api/next-image"
LOG_FILE = "/home/pi/display_error.log"
ETAG_FILE = "/home/pi/.tekpi_etag"
TIMEOUT = 45

# Palette ACeP dans l'ordre des index du contrôleur (driver inky_ac073tc1a.py :
# BLACK=0, WHITE=1, GREEN=2, BLUE=3, RED=4, YELLOW=5, ORANGE=6). L'image reçue
# est déjà dithée sur ces couleurs exactes côté serveur.
ACEP_PALETTE = [
    0, 0, 0,
    255, 255, 255,
    0, 255, 0,
    0, 0, 255,
    255, 0, 0,
    255, 255, 0,
    255, 128, 0,
]


def to_panel_palette(img: Image.Image) -> Image.Image:
    """Convertit en mode "P" avec l'ordre de palette du contrôleur.

    set_image() utilise une image "P" telle quelle, sans re-quantization ni
    re-dithering : les pixels pré-dithés arrivent donc intacts sur le panneau.
    Le passage par RGB neutralise l'ordre de palette arbitraire du PNG indexé.
    """
    palette_image = Image.new("P", (1, 1))
    palette_image.putpalette(ACEP_PALETTE + [0, 0, 0] * 249)
    return img.convert("RGB").quantize(palette=palette_image, dither=Image.Dither.NONE)


try:
    headers = {}
    etag_path = Path(ETAG_FILE)
    if etag_path.exists():
        headers["If-None-Match"] = etag_path.read_text().strip()

    response = requests.get(API_URL, headers=headers, timeout=TIMEOUT)

    # 304 : image inchangée, on s'épargne un refresh ACeP (~40 s de flashs).
    if response.status_code == 304:
        sys.exit(0)

    response.raise_for_status()

    from inky.auto import auto

    inky_display = auto()
    img = to_panel_palette(Image.open(BytesIO(response.content)))
    inky_display.set_image(img)
    inky_display.show()

    # L'ETag n'est persisté qu'après un affichage réussi : en cas d'échec,
    # la prochaine exécution retentera le refresh.
    new_etag = response.headers.get("ETag")
    if new_etag:
        etag_path.write_text(new_etag)
except Exception as e:
    with open(LOG_FILE, "a", encoding="utf-8") as log:
        log.write(f"{datetime.now().isoformat()} {e}\n")
    sys.exit(1)
