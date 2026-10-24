import sharp from "sharp";
import countries from "./countries.json";

type Pt = [number, number];
type Ring = Pt[];
type Country = { names: string[]; rings: Ring[] };
type Place = { country: Country; label: string; point?: Pt };
type Box = { x0: number; y0: number; x1: number; y1: number };

const COUNTRIES = countries as unknown as Record<string, Country>;
const BY_NAME = new Map(
  Object.values(COUNTRIES).flatMap((c) => c.names.map((n) => [n.toLowerCase(), c] as const)),
);
const UA = { "User-Agent": "tekpi-eink (https://github.com/kxrz/tekpi-eink)", "Accept-Language": "en" };
const MONTH = 60 * 60 * 24 * 30;

// Encres pures de la dalle : le Pi les retrouve à l'identique, sans tramage.
export const INKS = {
  black: "#000000", white: "#ffffff", yellow: "#ffff00", red: "#ff0000", blue: "#0000ff", green: "#00ff00",
};
export type Ink = keyof typeof INKS;

function countryLabel(c: Country): string {
  return c.names.reduce((a, b) => (b.length < a.length ? b : a));
}

/** « Belgium » est un pays ; « Beverly Hills » est géocodé (Nominatim). */
async function locate(origin: string): Promise<Place | null> {
  const country = BY_NAME.get(origin.toLowerCase());
  if (country) return { country, label: countryLabel(country) };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(origin)}`;
  const res = await fetch(url, { headers: UA, next: { revalidate: MONTH } });
  const [hit] = (await res.json()) as { lat: string; lon: string; address?: { country_code?: string } }[];
  const found = hit && COUNTRIES[hit.address?.country_code?.toUpperCase() ?? ""];
  if (!found) return null;
  return {
    country: found,
    label: `${origin.split(",")[0]}, ${countryLabel(found)}`,
    point: [Number(hit.lon), Number(hit.lat)],
  };
}

/** Origine d'un artiste selon MusicBrainz : ville de naissance ou de formation, sinon pays. */
async function artistOrigin(artist: string): Promise<string | null> {
  for (const name of [artist, ...artist.split(/\s*(?:&|,| feat\.? | x )\s*/i)]) {
    const url = `https://musicbrainz.org/ws/2/artist?fmt=json&limit=1&query=${encodeURIComponent(`artist:"${name}"`)}`;
    let res = await fetch(url, { headers: UA, next: { revalidate: MONTH } });
    if (res.status === 503) {
      // MusicBrainz limite à une requête par seconde et répond « occupé » au-delà : on retente une fois
      await new Promise((r) => setTimeout(r, 1200));
      res = await fetch(url, { headers: UA, cache: "no-store" });
    }
    if (!res.ok) continue;
    const [a] = ((await res.json()) as { artists?: { score: number; country?: string; area?: { name: string }; "begin-area"?: { name: string } }[] }).artists ?? [];
    if (!a || a.score < 90) continue;
    const country = a.country ? COUNTRIES[a.country] : undefined;
    const city = a["begin-area"]?.name;
    if (city && BY_NAME.has(city.toLowerCase())) return city; // né dans un pays, installé ailleurs : le pays natal
    if (city && country) return `${city}, ${countryLabel(country)}`;
    if (country) return countryLabel(country);
    if (a.area) return a.area.name;
  }
  return null;
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

/** Le territoire principal et ce qui l'entoure : on écarte l'Alaska, Hawaï ou les DOM, qui écraseraient la carte. */
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
 * Carte en duotone sur toute la toile (w × h) : fond uni, graticule en pointillés, pays voisins au trait fin,
 * pays d'origine au trait épais et tramé, cercle sur la ville. Le pays est cadré dans `box`.
 */
export async function renderMap(
  q: { origin?: string; artist?: string },
  w: number, h: number, box: Box, bg: Ink, ink: Ink,
) {
  const origin = q.origin || (q.artist ? await artistOrigin(q.artist) : null);
  const place = origin ? await locate(origin) : null;
  if (!place) return null;

  const main = mainland(place.country.rings, place.point);
  const b = bbox(main.flat());
  const k = Math.cos((((b.y0 + b.y1) / 2) * Math.PI) / 180); // équirectangulaire corrigée de la latitude
  const scale = Math.min((box.x1 - box.x0) / ((b.x1 - b.x0) * k), (box.y1 - box.y0) / (b.y1 - b.y0));
  const ox = (box.x0 + box.x1) / 2 - ((b.x0 + b.x1) / 2) * k * scale;
  const oy = (box.y0 + box.y1) / 2 + ((b.y0 + b.y1) / 2) * scale;
  const px = (x: number) => ox + x * k * scale;
  const py = (y: number) => oy - y * scale;
  const path = (rings: Ring[]) => rings.map((r) => `M${r.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join("L")}Z`).join("");

  // Ce que la toile montre, en degrés : pour le graticule et le choix des voisins
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
  const fg = INKS[ink];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">
<defs><pattern id="t" width="6" height="6" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="2" height="2" fill="${fg}"/></pattern></defs>
<rect width="${w}" height="${h}" fill="${INKS[bg]}"/>
<path d="${grid}" stroke="${fg}" stroke-width="1" stroke-dasharray="2 5" fill="none"/>
<path d="${path(neighbours)}" stroke="${fg}" stroke-width="1" fill="none"/>
<path d="${path(place.country.rings)}" fill="url(#t)" stroke="${fg}" stroke-width="3" stroke-linejoin="round"/>
${city ? `<circle cx="${city[0]}" cy="${city[1]}" r="9" fill="${INKS[bg]}" stroke="${fg}" stroke-width="3"/><circle cx="${city[0]}" cy="${city[1]}" r="3" fill="${fg}"/>` : ""}
</svg>`;
  return { png: await sharp(Buffer.from(svg)).png().toBuffer(), label: place.label };
}
