#!/usr/bin/env python3
"""Synchronise le cadre e-ink avec tekpi.

Le Pi ne décide de rien : il demande au serveur s'il y a un changement à
appliquer, et n'allume la dalle que si la réponse est oui.

Le cron tourne toutes les minutes, mais la cadence réelle de sondage est
dictée par le serveur (`pollSeconds`) : le script s'arrête aussitôt si le
délai n'est pas écoulé. Régler la fréquence depuis le site ne demande donc
aucune intervention sur le crontab.

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

# Doit correspondre à DEVICE_TOKEN côté Vercel. Laisser vide si le site n'est
# pas protégé : le serveur laisse alors passer sans jeton.
DEVICE_TOKEN = ""

STATE_FILE = Path.home() / ".tekpi-state.json"
LOG_FILE = Path.home() / "tekpi.log"
TIMEOUT = 45

# Doit correspondre à PANEL_SATURATION dans lib/panels.ts. Le serveur dithère
# vers les couleurs que la dalle rend à cette saturation ; set_image() les
# retrouve alors à l'identique et se contente de les indexer, sans re-dithérer.
PANEL_SATURATION = 0.5

# Cadence de repli, si le serveur est injoignable et n'a donc rien pu dicter.
FALLBACK_POLL_SECONDS = 300

# On ne se signale pas à chaque sondage : inutile d'écrire dans le Blob à
# chaque passage. Après un rafraîchissement, une erreur, ou ce délai.
HEARTBEAT_INTERVAL_SECONDS = 600

# Événements du cycle courant, remontés au serveur avec le heartbeat pour
# être consultables depuis le site.
EVENTS: list[dict] = []


def log(level: str, message: str) -> None:
    """Journalise localement et prépare la remontée vers le site."""
    stamp = datetime.now()
    EVENTS.append(
        {"at": int(stamp.timestamp() * 1000), "level": level, "message": message}
    )
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as handle:
            handle.write(f"{stamp.isoformat(timespec='seconds')} [{level}] {message}\n")
    except OSError:
        pass


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state))


def now_seconds() -> float:
    return datetime.now().timestamp()


def auth_headers() -> dict:
    return {"X-Tekpi-Token": DEVICE_TOKEN} if DEVICE_TOKEN else {}


def send_heartbeat(driver, revision, refreshed: bool, error=None) -> None:
    try:
        requests.post(
            f"{BASE_URL}/api/heartbeat",
            headers=auth_headers(),
            json={
                "driver": driver,
                "revision": revision,
                "refreshed": refreshed,
                "error": error,
                "events": EVENTS,
            },
            timeout=TIMEOUT,
        )
    except Exception as exc:
        # Pas de log() ici : l'événement ne partirait nulle part.
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as handle:
                handle.write(
                    f"{datetime.now().isoformat(timespec='seconds')} [error] "
                    f"heartbeat échoué: {exc}\n"
                )
        except OSError:
            pass


def main() -> int:
    state = load_state()
    driver = state.get("driver")

    # Cadence dictée au sondage précédent : on n'interroge pas le serveur avant.
    poll_seconds = state.get("pollSeconds", FALLBACK_POLL_SECONDS)
    since_last_poll = now_seconds() - state.get("polledAt", 0)

    if since_last_poll < poll_seconds:
        return 0

    response = requests.get(
        f"{BASE_URL}/api/state",
        params={"revision": state.get("revision") or ""},
        headers=auth_headers(),
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    decision = response.json()

    state["polledAt"] = now_seconds()
    state["pollSeconds"] = decision.get("pollSeconds", FALLBACK_POLL_SECONDS)

    heartbeat_due = (
        now_seconds() - state.get("heartbeatAt", 0) > HEARTBEAT_INTERVAL_SECONDS
    )

    if not decision.get("refresh"):
        if heartbeat_due:
            reason = decision.get("reason")
            if reason not in ("up-to-date", None):
                log("info", f"Sondage : {reason}")
            send_heartbeat(driver, state.get("revision"), refreshed=False)
            state["heartbeatAt"] = now_seconds()
        save_state(state)
        return 0

    image_response = requests.get(
        f"{BASE_URL}/api/next-image", headers=auth_headers(), timeout=TIMEOUT
    )
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
    log("info", f"Écran rafraîchi ({decision.get('reason')}) sur {driver}.")

    state.update(
        {
            "revision": revision,
            "driver": driver,
            "heartbeatAt": now_seconds(),
        }
    )
    save_state(state)
    send_heartbeat(driver, revision, refreshed=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        log("error", str(exc))
        cached = load_state()
        send_heartbeat(
            cached.get("driver"),
            cached.get("revision"),
            refreshed=False,
            error=str(exc),
        )
        sys.exit(1)
