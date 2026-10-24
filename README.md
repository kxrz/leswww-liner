# Liner

**An e-ink frame that hangs one track at a time from [320kbps.club](https://www.320kbps.club), like a work in a museum.**

The cover and its liner notes sit on a museum label, laid over a map of where the artist comes from.
A new track every morning and evening, and a small web page to change it from your phone.

<p>
  <img src="docs/balthazar.png" width="49%" alt="Balthazar, Linger On: label over a green map of Belgium, Kortrijk circled">
  <img src="docs/bangalter.png" width="49%" alt="Thomas Bangalter, Circonvolutions: label over a blue map of France, Paris circled">
  <img src="docs/magugu.png" width="49%" alt="Magugu & Le Motel, Bitter Better: label over a red map of Nigeria">
  <img src="docs/the-verve.png" width="49%" alt="The Verve, Bitter Sweet Symphony: label over a black and white map of the United Kingdom, Wigan circled">
</p>

## What is on the wall

- **A duotone map** of the artist's home country, with its neighbours and a dotted graticule; a ring marks the city
  when there is one. The duotone comes from the cover's dominant ink: blue and white, red and white, green and white,
  yellow and black, or black and white when the cover has no strong colour.
- **A museum label** on top: the cover, dithered onto the panel's six inks, then artist, title, album, year, label
  and origin.
- **Where the artist comes from**, not where they live: Thomas Bangalter is from Paris, even if the feed says
  Beverly Hills (see [Origins](#origins)).

## Hardware

| | |
|---|---|
| Computer | Raspberry Pi Zero 2 W, Raspberry Pi OS Bookworm (Lite is enough) |
| Screen | [Pimoroni Inky Impression 7.3"](https://shop.pimoroni.com/products/inky-impression-7-3) **Spectra 6** (800 × 480; black, white, yellow, red, blue, green) |
| Frame | Any photo frame with a mat. The mat hides the edges of the panel, so the layout stays inside the [visible area](#visible-area) |

Two panels are sold as "Inky Impression 7.3"": this code targets the 2025 Spectra 6 (no orange ink).

## How it works

```
   phone                    Vercel                        Raspberry Pi
 ┌───────────┐ request ┌────────────────┐  GET /api/pi   ┌──────────────────┐
 │ web page  │ ──────► │ command.json   │ ◄───────────── │ liner.py --sync  │  every minute, 7:00–midnight
 └─────┬─────┘         │ (Vercel Blob)  │                └────────┬─────────┘
       │ ◄──────────── │ status.json    │ ◄── POST ───────────────┤ after each redraw,
       │  picture, PNG │ pictures/*.png │ ◄── PUT  ───────────────┤ with the picture
       │               └───────┬────────┘                         │
       │                       │ GET /api/map  ◄──────────────────┤ map of the artist's origin
       │                       ▼                         ┌────────┴─────────┐
       │                 MusicBrainz, Nominatim          │ liner.py         │  7:00 and 19:00
       │                 Natural Earth outlines          └──────────────────┘
```

- The Pi sits behind a home router, so Vercel cannot reach it: **the Pi polls** the page every minute. A request
  takes up to a minute to be picked up, then about 30 seconds of e-ink redraw. The page follows along and flashes
  when the frame is done.
- **The Pi draws the layout** (Python, Pillow). **Vercel draws the map** (`/api/map`, SVG rasterised by sharp, cached
  by the CDN for good), so outlines, geocoding and MusicBrainz stay off the Pi Zero.
- Every picture the frame draws is uploaded, shown on the page in a frame mockup, and **downloadable as a PNG**.
- Without the web page (no `liner.env`), the frame still runs on its own, twice a day, without maps.

## Repository

```
app/                  web page (Next.js) and API routes
  NowPlaying.tsx      frame mockup, request tracking, flash when the frame is done
  api/pi/             the frame: poll for requests, report a redraw, upload its picture
  api/map/            duotone map of an artist's origin, as a PNG in the panel's inks
  api/status/         polled by the page while a request is on its way
lib/
  feed.ts             320kbps.club RSS feed
  map.ts              origin lookup (MusicBrainz, Nominatim) and map drawing
  store.ts            requests, status and pictures in Vercel Blob
  frame.ts            panel size and visible area, shared with the mockup
  countries.json      country outlines (Natural Earth 1:50m, simplified)
pi/
  liner.py            the frame: data, layout, display, sync
  fonts/              IBM Plex Sans (variable) and IBM Plex Mono
  systemd/            liner.timer (7:00, 19:00) and liner-sync.timer (every minute)
  install.sh          installs dependencies and services
docs/                 sample pictures
```

## Set up the frame

```sh
git clone https://github.com/kxrz/tekpi-eink.git ~/tekpi-eink
cd ~/tekpi-eink/pi
cp liner.env.example liner.env   # then fill in LINER_TOKEN
./install.sh
```

Enable SPI and I2C first (`sudo raspi-config` › Interface Options). Update with
`cd ~/tekpi-eink && git pull && pi/install.sh`.

| | |
|---|---|
| Next track now | `sudo systemctl start liner` |
| What happened | `journalctl -u liner -u liner-sync -n 30` |
| Next runs | `systemctl list-timers 'liner*'` |
| Try a layout without touching the screen | `python3 liner.py --preview`, then open `preview.png` |

`state.json` remembers the tracks already shown and the last request handled; delete it to start again from the
newest track.

## Deploy the web page

The Vercel project is linked to this repository: every push to `main` deploys. Connect a Blob store, then set:

| Variable | |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Set by Vercel when the Blob store is connected |
| `SITE_PASSWORD` | Password for the page. Without it, the page is open to anyone |
| `DEVICE_TOKEN` | The frame's token, same as `LINER_TOKEN` in `pi/liner.env`. Without it, `/api/pi` is open |

On a phone, "Add to Home Screen" turns the page into a small app. Locally: `npm install && npm run dev`, with a
`.env.local` (see `.env.example`).

## Design notes

### Inks

- **Text is never antialiased** (`fontmode = "1"`). Grey edge pixels would snap to the nearest ink, often blue,
  and every letter would get a coloured fringe.
- **Only the cover is dithered** (Floyd-Steinberg), towards the colours the panel *actually* shows: the 50/50 blend
  of the Pimoroni driver's `SATURATED_PALETTE` and `DESATURATED_PALETTE`, as `set_image()` does by default. The
  final image goes to the driver as a six-colour palette image, so it does not dither again.
- **The map** is an SVG drawn with `shape-rendering="crispEdges"` in pure inks, mapped back to the palette without
  dithering on the Pi.
- **Previews and downloads** use the ink colours, so their greyish white is the panel's real white.

### Origins

The 320kbps.club feed gives the place an artist is *based* (MusicBrainz "area"). Liner looks for where they were
*born or formed* ("begin-area"):

1. Search MusicBrainz for the exact artist name; the feed's origin picks between namesakes
   (Deluxe from Aix-en-Provence, not Samy Deluxe from Hamburg).
2. Use the begin-area when it is a city, or the country when it is one (Magugu, born in Nigeria, based in the UK).
   A region ("England") falls back to the country.
3. A collaboration ("A & B") resolves to the first artist found.
4. Failing that, the feed's origin; failing that, a plain background.

### Visible area

The mat hides part of the panel. Measured with a test grid: x 52 → 748, y 35 → 480. Everything is laid out inside
`VISIBLE` (top of `pi/liner.py`, mirrored in `lib/frame.ts` for the mockup). If the Pi moves in its frame, that is
the only value to change.

## Credits

- Music: [320kbps.club](https://www.320kbps.club) feed and album pages
- Outlines: [Natural Earth](https://www.naturalearthdata.com) 1:50m, public domain
- Origins: [MusicBrainz](https://musicbrainz.org) (CC0); cities: [Nominatim](https://nominatim.openstreetmap.org), © OpenStreetMap contributors
- Fonts: [IBM Plex](https://github.com/IBM/plex), SIL Open Font License
