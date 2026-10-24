# CLAUDE.md

Read `README.md` first: architecture, setup, design notes. Liner is a LesWWW project, fed by 320kbps.club:
user-facing text, code and commits are in English.

## Ground rules

- **The Pi draws the layout** (`pi/liner.py`, Pillow). The web side relays requests, stores pictures and draws
  only the map (`/api/map`).
- **Two pages**: `/` is the public landing (rebuilt every 10 minutes), `/control` the password-protected control
  room. The web follows the LesWWW charter (repo kxrz/leswww2026-euracreative): Big Shoulders / Public Sans /
  IBM Plex Mono, black and white, lemon `--accent` for interactive things only, cyan `--pop3` for real data.
- **Keep it small.** One Python script on the Pi; on the web, one page, a few routes, a few JSON files and PNGs in
  Blob. No database, no CSS framework, no dependency that is not essential.
- **Text is never antialiased or dithered** (`d.fontmode = "1"`), pure inks only. Only the cover is dithered.
- **Spectra 6 panel**: black, white, yellow, red, blue, green. No orange.
- **Visible area**: nothing outside `VISIBLE` (the mat hides the edges). Keep `pi/liner.py` and `lib/frame.ts` in sync.
- **Maps are rasterised with resvg** (`@resvg/resvg-js`, a server external package), not sharp: sharp 0.35 cannot load libvips on Vercel and older versions carry CVEs.
- The Pi runs from `/home/pi/liner` (a clone of this repo); `pi/liner.env` and `pi/state.json` are not tracked.
- Check a new layout with `python3 liner.py --preview` before a real redraw: each one takes 30 seconds and a panel
  cycle. With `liner.env` loaded, the preview includes the map.

## Access

`ssh pi@raspberrypi.local` (SSH key), passwordless sudo.
