import sharp from "sharp";
import countries from "./countries.json";
import { readOrigin, writeOrigin } from "./store";

type Pt = [number, number];
type Ring = Pt[];
type Country = { names: string[]; rings: Ring[] };
type Place = { country: Country; label: string; point?: Pt };
type Box = { x0: number; y0: number; x1: number; y1: number };

const COUNTRIES = countries as unknown as Record<string, Country>;
const BY_NAME = new Map(
  Object.values(COUNTRIES).flatMap((c) => c.names.map((n) => [n.toLowerCase(), c] as const)),
);
const UA = { "User-Agent": "Liner by LesWWW (https://github.com/kxrz/leswww-liner)", "Accept-Language": "en" };

// The panel's pure inks: the frame maps them back exactly, without dithering.
export const INKS = {
  black: "#000000", white: "#ffffff", yellow: "#ffff00", red: "#ff0000", blue: "#0000ff", green: "#00ff00",
};
export type Ink = keyof typeof INKS;

// What the panel actually shows: the inky driver's saturated palette blended 50/50 with the pure inks
// (SEEN in pi/liner.py). Used for the HD wallpaper, which should look like the frame, only sharper.
const SEEN: Record<Ink, string> = {
  black: "#000000", white: "#d0d1d2", yellow: "#e7de23", red: "#cd2425", blue: "#1e1dae", green: "#1dad23",
};

/** `s` scales every stroke and dot for a larger canvas; above 1 the map is antialiased and drawn in ink tones. */
export type MapStyle = { s: number; tone: "ink" | "seen" };

function countryLabel(c: Country): string {
  return c.names.reduce((a, b) => (b.length < a.length ? b : a));
}

/**
 * "Belgium" is a country; "Beverly Hills" gets geocoded (Nominatim). External lookups are not cached, or a
 * transient error would stick: the CDN keeps the final image instead.
 */
async function locate(origin: string): Promise<Place | null> {
  const country = BY_NAME.get(origin.toLowerCase());
  if (country) return { country, label: countryLabel(country) };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(origin)}`;
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  const [hit] = (await res.json()) as { lat: string; lon: string; address?: { country_code?: string } }[];
  const found = hit && COUNTRIES[hit.address?.country_code?.toUpperCase() ?? ""];
  if (!found) return null;
  return {
    country: found,
    label: `${origin.split(",")[0]}, ${countryLabel(found)}`,
    point: [Number(hit.lon), Number(hit.lat)],
  };
}

type MbArea = { name: string; type?: string };
type MbArtist = { name: string; score: number; country?: string; area?: MbArea; "begin-area"?: MbArea };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[‐‑–]/g, "-").toLowerCase().trim();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** MusicBrainz could not be reached: not the same as "this artist has no known origin". */
export class Unavailable extends Error {}

async function searchArtist(name: string): Promise<MbArtist[]> {
  const url = `https://musicbrainz.org/ws/2/artist?fmt=json&limit=5&query=${encodeURIComponent(`artist:"${name}"`)}`;
  // MusicBrainz allows about one request per second and often answers "busy" from shared cloud addresses
  for (const delay of [0, 1500, 3500]) {
    await wait(delay);
    const res = await fetch(url, { headers: UA, cache: "no-store" }).catch(() => null);
    if (res?.ok) return ((await res.json()) as { artists?: MbArtist[] }).artists ?? [];
    if (res && res.status !== 503 && res.status !== 429) break;
  }
  throw new Unavailable(`MusicBrainz did not answer for ${name}`);
}

/**
 * Where the artist comes from. The 320kbps.club feed gives where they *live* (MusicBrainz "area": Beverly Hills
 * for Thomas Bangalter); we want where they were born or formed ("begin-area": Paris).
 * `hint`, the feed's origin, picks the right namesake (Deluxe from Aix-en-Provence, not Samy Deluxe).
 * A collaboration "A & B" resolves to the first known artist. Failing all that, `hint` it is.
 */
async function artistOrigin(artist: string, hint?: string): Promise<string | null> {
  const names = [artist, ...artist.split(/\s*(?:&|,|\+| feat\.? | x )\s*/i)].filter((n, i, all) => n && all.indexOf(n) === i);
  for (const [i, name] of names.entries()) {
    if (i > 0) await wait(1100);
    const exact = (await searchArtist(name)).filter((a) => a.score >= 90 && norm(a.name) === norm(name));
    if (!exact.length) continue;
    const fits = (a: MbArtist) =>
      [a.area?.name, a["begin-area"]?.name, ...(a.country ? COUNTRIES[a.country]?.names ?? [] : [])]
        .some((n) => n && hint && norm(n) === norm(hint));
    const a = exact.find(fits) ?? exact[0];
    const country = a.country ? COUNTRIES[a.country] : undefined;
    const begin = a["begin-area"];
    if (begin?.type === "Country") return begin.name; // born in one country, living in another: the home country
    // The city alone: adding the country they live in would skew it (Julia Kent, born in Vancouver, lives in the US)
    if (begin && ["City", "Municipality", "District"].includes(begin.type ?? "")) return begin.name;
    if (country) return countryLabel(country);
    if (a.area) return a.area.name;
  }
  return hint || null;
}

/** An origin, once found, is kept: the next lookups for that artist (and the HD version) need no MusicBrainz. */
async function cachedOrigin(artist: string, hint?: string): Promise<string | null> {
  const key = `${artist}|${hint ?? ""}`;
  const known = await readOrigin(key);
  if (known) return known;
  let origin: string | null;
  try {
    origin = await artistOrigin(artist, hint);
  } catch (e) {
    // MusicBrainz down: the feed's origin will do for now, but is not kept, so a later lookup can do better
    if (e instanceof Unavailable && hint) return hint;
    throw e;
  }
  if (origin) await writeOrigin(key, origin);
  return origin;
}

function bbox(points: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

function area(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

/** The main territory and what lies near it: Alaska, Hawaii or overseas departments would squash the map. */
function mainland(rings: Ring[], point?: Pt): Ring[] {
  const m = bbox(rings.reduce((a, b) => (area(b) > area(a) ? b : a)));
  const mx = (m.x1 - m.x0) * 0.3;
  const my = (m.y1 - m.y0) * 0.3;
  return rings.filter((r) => {
    const b = bbox(r);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const near = cx >= m.x0 - mx && cx <= m.x1 + mx && cy >= m.y0 - my && cy <= m.y1 + my;
    const hasPoint = point && point[0] >= b.x0 && point[0] <= b.x1 && point[1] >= b.y0 && point[1] <= b.y1;
    return near || hasPoint;
  });
}

/**
 * Duotone map over the whole canvas (w × h): flat background, dotted graticule, neighbours in a thin line,
 * the home country in a thick line with a dot screen, a ring on the city. The country is fitted inside `box`.
 */
export async function renderMap(
  q: { artist?: string; hint?: string },
  w: number, h: number, box: Box, bg: Ink, ink: Ink,
  style: MapStyle = { s: 1, tone: "ink" },
) {
  const origin = q.artist ? await cachedOrigin(q.artist, q.hint) : q.hint;
  const place = origin ? await locate(origin) : null;
  if (!place) return null;

  const main = mainland(place.country.rings, place.point);
  const b = bbox(main.flat());
  const k = Math.cos((((b.y0 + b.y1) / 2) * Math.PI) / 180); // equirectangular, corrected for latitude
  const scale = Math.min((box.x1 - box.x0) / ((b.x1 - b.x0) * k), (box.y1 - box.y0) / (b.y1 - b.y0));
  const ox = (box.x0 + box.x1) / 2 - ((b.x0 + b.x1) / 2) * k * scale;
  const oy = (box.y0 + box.y1) / 2 + ((b.y0 + b.y1) / 2) * scale;
  const px = (x: number) => ox + x * k * scale;
  const py = (y: number) => oy - y * scale;
  const path = (rings: Ring[]) => rings.map((r) => `M${r.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join("L")}Z`).join("");

  // What the canvas shows, in degrees: for the graticule and picking neighbours
  const view = { x0: -ox / (k * scale), x1: (w - ox) / (k * scale), y0: (oy - h) / scale, y1: oy / scale };
  const span = Math.max(view.x1 - view.x0, view.y1 - view.y0);
  const step = [0.5, 1, 2, 5, 10, 15, 30].find((s) => span / s <= 9) ?? 30;
  let grid = "";
  for (let x = Math.ceil(view.x0 / step) * step; x <= view.x1; x += step) grid += `M${px(x).toFixed(1)} 0V${h}`;
  for (let y = Math.ceil(view.y0 / step) * step; y <= view.y1; y += step) grid += `M0 ${py(y).toFixed(1)}H${w}`;

  const neighbours = Object.values(COUNTRIES)
    .filter((c) => c !== place.country)
    .flatMap((c) => c.rings)
    .filter((r) => {
      const rb = bbox(r);
      return rb.x1 >= view.x0 && rb.x0 <= view.x1 && rb.y1 >= view.y0 && rb.y0 <= view.y1;
    });

  const city = place.point ? [px(place.point[0]), py(place.point[1])] : null;
  const colours = style.tone === "seen" ? SEEN : INKS;
  const fg = colours[ink];
  const back = colours[bg];
  const u = style.s; // one panel pixel, in canvas pixels
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="${u > 1 ? "geometricPrecision" : "crispEdges"}">
<defs><pattern id="t" width="${6 * u}" height="${6 * u}" patternUnits="userSpaceOnUse"><rect x="${2 * u}" y="${2 * u}" width="${2 * u}" height="${2 * u}" fill="${fg}"/></pattern></defs>
<rect width="${w}" height="${h}" fill="${back}"/>
<path d="${grid}" stroke="${fg}" stroke-width="${u}" stroke-dasharray="${2 * u} ${5 * u}" fill="none"/>
<path d="${path(neighbours)}" stroke="${fg}" stroke-width="${u}" fill="none"/>
<path d="${path(place.country.rings)}" fill="url(#t)" stroke="${fg}" stroke-width="${3 * u}" stroke-linejoin="round"/>
${city ? `<circle cx="${city[0]}" cy="${city[1]}" r="${9 * u}" fill="${back}" stroke="${fg}" stroke-width="${3 * u}"/><circle cx="${city[0]}" cy="${city[1]}" r="${3 * u}" fill="${fg}"/>` : ""}
</svg>`;
  return { png: await sharp(Buffer.from(svg)).png().toBuffer(), label: place.label };
}
