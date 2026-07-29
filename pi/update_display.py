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

try:
    headers = {}
    etag_path = Path(ETAG_FILE)
    if etag_path.exists():
        headers["If-None-Match"] = etag_path.read_text().strip()

    response = requests.get(API_URL, headers=headers, timeout=TIMEOUT)

    # 304 : image inchangée, on s'épargne un refresh ACeP (~30 s de flashs).
    if response.status_code == 304:
        sys.exit(0)

    response.raise_for_status()

    from inky.auto import auto

    inky_display = auto()
    img = Image.open(BytesIO(response.content))
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
