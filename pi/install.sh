#!/bin/sh
# Install or update Liner's services. Run on the Pi from ~/liner/pi.
set -e
cd "$(dirname "$0")"
sudo apt-get install -y -qq python3-requests python3-pil >/dev/null
python3 -c "import inky" 2>/dev/null || sudo pip3 install --break-system-packages "inky[rpi]"

# Earlier installs called everything "cadre"
if [ -f /etc/systemd/system/cadre.timer ]; then
  sudo systemctl disable --now cadre.timer cadre-sync.timer 2>/dev/null || true
  sudo rm -f /etc/systemd/system/cadre*.service /etc/systemd/system/cadre*.timer
  [ -f cadre.env ] && [ ! -f liner.env ] && sed 's/^CADRE_/LINER_/' cadre.env > liner.env && chmod 600 liner.env && rm cadre.env
fi

sudo cp systemd/*.service systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now liner.timer
if [ -f liner.env ]; then
  sudo systemctl enable --now liner-sync.timer
else
  echo "No liner.env: the web page link is off (see liner.env.example)."
fi
systemctl list-timers 'liner*' --no-pager
