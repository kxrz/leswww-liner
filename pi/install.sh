#!/bin/sh
# Installe (ou met à jour) les services du cadre. À lancer sur le Pi depuis ~/tekpi-eink/pi.
set -e
cd "$(dirname "$0")"
sudo apt-get install -y -qq python3-requests python3-pil >/dev/null
python3 -c "import inky" 2>/dev/null || sudo pip3 install --break-system-packages inky[rpi]
sudo cp systemd/*.service systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cadre.timer
if [ -f cadre.env ]; then
  sudo systemctl enable --now cadre-sync.timer
else
  echo "Pas de cadre.env : synchronisation avec la page web désactivée (voir cadre.env.example)."
fi
systemctl list-timers 'cadre*' --no-pager
