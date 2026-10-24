# Build your own Liner

About an afternoon, no soldering if you buy the Pi with its header already on.

## Parts

| Part | Notes |
|---|---|
| Raspberry Pi Zero 2 **WH** | The "H" has the GPIO header soldered. Any Pi with a 40-pin header works; the Zero fits behind a frame |
| [Pimoroni Inky Impression 7.3"](https://shop.pimoroni.com/products/inky-impression-7-3) **Spectra 6** | 800 × 480, six inks. The older ACeP 7-colour version also exists: this code targets Spectra 6 |
| microSD card | 16 GB is plenty |
| 5 V micro-USB power supply | 2.5 A, with a long, thin cable to run down the wall |
| A photo frame with a mat | The mat's opening should be a little smaller than the panel's active area (about 160 × 96 mm), so it hides the edges |
| Double-sided foam tape or standoffs | To hold the panel against the mat |

## 1. Prepare the Pi

1. Flash **Raspberry Pi OS Lite (64-bit, Bookworm)** with [Raspberry Pi Imager](https://www.raspberrypi.com/software/). In its settings, set a hostname, a user, your Wi-Fi and your SSH key.
2. Plug the Inky Impression onto the Pi's header, then power up and connect: `ssh <user>@<hostname>.local`.
3. Turn on SPI and I2C: `sudo raspi-config nonint do_spi 0 && sudo raspi-config nonint do_i2c 0`, then reboot.
4. Get the code:

   ```sh
   git clone https://github.com/kxrz/leswww-liner.git ~/liner
   cd ~/liner/pi
   ```

## 2. Fit it in the frame and calibrate

Mount the panel behind the mat, then show a test grid:

```sh
python3 calibrate.py
```

Each rectangle is 20 px further in, numbered on every edge. Photograph the frame: for each edge, the smallest number
you can read in full is the margin the mat hides. Write them down as `left,top,800-right,480-bottom`, for instance
`52,35,748,480` if the mat hides 52 px on the left and right, 35 at the top and nothing at the bottom.

## 3. Run it on its own

```sh
cp liner.env.example liner.env
# edit liner.env: LINER_VISIBLE=52,35,748,480, and LINER_FEED if you want another feed than 320kbps.club
./install.sh
sudo systemctl start liner   # first picture now
```

The frame now redraws at 7:00 and 19:00. Without the web page there are no maps (they are drawn in the cloud) and no
remote control.

## 4. Add the web page (optional, recommended)

The page draws the maps, relays requests from your phone, keeps the pictures and shows the frame's health.

1. Fork this repository and import it in [Vercel](https://vercel.com/new).
2. In the project, **Storage → Create → Blob**, and connect it to the project.
3. Set the environment variables:

   | Variable | Value |
   |---|---|
   | `SITE_PASSWORD` | Password for the control room |
   | `DEVICE_TOKEN` | A long random string: `openssl rand -hex 24` |
   | `NEXT_PUBLIC_LINER_VISIBLE` | Your visible area, same as `LINER_VISIBLE` |

4. On the Pi, add the page to `liner.env`, then reinstall to turn on the sync:

   ```
   LINER_URL=https://your-project.vercel.app
   LINER_TOKEN=<the same DEVICE_TOKEN>
   ```

   ```sh
   ./install.sh
   ```

5. Open `/control` on your phone, sign in, and "Add to Home Screen".

The landing page (`app/page.tsx`) and the gallery describe the LesWWW frame: rewrite them for yours, or point `/`
to `/control`.

## Feeds

Liner follows any RSS feed whose items have a title and a cover image. It reads 320kbps.club best: titles in the form
"Artist — Title", and the artist's origin in the description. Change the feed from the control room (it suggests
every 320kbps.club curator and playlist), or set `LINER_FEED` on the Pi.

## Updating

```sh
cd ~/liner && git pull && pi/install.sh
```
