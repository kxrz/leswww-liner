#!/usr/bin/env python3
"""Synchronise le cadre e-ink avec tekpi.

Le Pi ne décide de rien : il demande au serveur s'il y a un changement à
appliquer, et n'allume la dalle que si la réponse est oui. Un sondage sans
changement ne coûte qu'une requête HTTP de quelques centaines d'octets, ce qui
permet de tourner toutes les minutes.

Installation (cron, toutes les minutes) :

    * * * * * /usr/bin/python3 /home/pi/update_display.py
"""

import json
import sys
from datetime import datetime
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

BASE_URL = "https://tekpi-eink.vercel.app"
STATE_FILE = Path.home() / ".tekpi-state.json"
LOG_FILE = Path.home() / "tekpi.log"
TIMEOUT = 45

# Doit correspondre à PANEL_SATURATION dans lib/panels.ts. Le serveur dithère
# vers les couleurs que la dalle rend à cette saturation ; set_image() les
# retrouve alors à l'identique et se contente de les indexer, sans re-dithérer.
PANEL_SATURATION = 0.5

# On ne se signale pas à chaque sondage : inutile d'écrire dans le Blob toutes
# les minutes. Après un rafraîchissement, une erreur, ou ce délai.
HEARTBEAT_INTERVAL_SECONDS = 600


def log(message: str) -> None:
    with open(LOG_FILE, "a", encoding="utf-8") as handle:
        handle.write(f"{datetime.now().isoformat(timespec='seconds')} {message}\n")


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state))


def now_seconds() -> float:
    return datetime.now().timestamp()


def send_heartbeat(driver: str | None, revision: str | None,
                   refreshed: bool, error: str | None = None) -> None:
    try:
        requests.post(
            f"{BASE_URL}/api/heartbeat",
            json={
                "driver": driver,
                "revision": revision,
                "refreshed": refreshed,
                "error": error,
            },
            timeout=TIMEOUT,
        )
    except Exception as exc:
        log(f"heartbeat échoué: {exc}")


def main() -> int:
    state = load_state()
    driver = state.get("driver")

    response = requests.get(
        f"{BASE_URL}/api/state",
        params={"revision": state.get("revision") or ""},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    decision = response.json()

    heartbeat_due = (
        now_seconds() - state.get("heartbeatAt", 0) > HEARTBEAT_INTERVAL_SECONDS
    )

    if not decision.get("refresh"):
        if heartbeat_due:
            send_heartbeat(driver, state.get("revision"), refreshed=False)
            state["heartbeatAt"] = now_seconds()
            save_state(state)
        return 0

    image_response = requests.get(f"{BASE_URL}/api/next-image", timeout=TIMEOUT)
    image_response.raise_for_status()
    image = Image.open(BytesIO(image_response.content)).convert("RGB")

    # inky.auto() sonde le matériel : on ne l'appelle qu'au moment d'afficher,
    # et le nom du driver est mis en cache pour les sondages suivants.
    from inky.auto import auto

    display = auto()
    driver = type(display).__name__

    try:
        display.set_image(image, saturation=PANEL_SATURATION)
    except TypeError:
        display.set_image(image)

    display.show()

    revision = decision.get("revision")
    save_state({
        "revision": revision,
        "driver": driver,
        "heartbeatAt": now_seconds(),
    })
    send_heartbeat(driver, revision, refreshed=True)
    log(f"affiché {revision} ({decision.get('reason')}) sur {driver}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        log(f"erreur: {exc}")
        cached = load_state()
        send_heartbeat(
            cached.get("driver"), cached.get("revision"),
            refreshed=False, error=str(exc),
        )
        sys.exit(1)
