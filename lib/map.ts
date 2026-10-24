import sharp from "sharp";
import countries from "./countries.json";

type Ring = [number, number][];
type Country = { names: string[]; rings: Ring[] };
type Place = { country: Country; label: string; point?: [number, number] };

const COUNTRIES = countries as unknown as Record<string, Country>;
const BY_NAME = new Map(
  Object.values(COUNTRIES).flatMap((c) => c.names.map((n) => [n.toLowerCase(), c] as const)),
);

// Encres pures de la dalle : le Pi les retrouve à l'identique, sans tramage.
export const INKS = { red: "#ff0000", blue: "#0000ff", green: "#00ff00", yellow: "#ffff00", black: "#000000" };

/** « Belgium » est un pays ; « Beverly Hills » est géocodé (Nominatim, mis en cache un mois). */
async function locate(origin: string): Promise<Place | null> {
  const country = BY_NAME.get(origin.toLowerCase());
  if (country) return { country, label: country.names.find((n) => n.length <= 20) ?? origin };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(origin)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "tekpi-eink (https://github.com/kxrz/tekpi-eink)", "Accept-Language": "en" },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  const [hit] = (await res.json()) as { lat: string; lon: string; address?: { country_code?: string; country?: string } }[];
  const found = hit && COUNTRIES[hit.address?.country_code?.toUpperCase() ?? ""];
  if (!found) return null;
  return { country: found, label: `${origin} · ${hit.address?.country ?? found.names[0]}`, point: [Number(hit.lon), Number(hit.lat)] };
}

function bbox(points: [number, number][]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function area(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

/** Le territoire principal et ce qui l'entoure : on écarte l'Alaska, Hawaï ou les DOM, qui écraseraient la carte. */
function mainland(rings: Ring[], point?: [number, number]): Ring[] {
  const main = rings.reduce((a, b) => (area(b) > area(a) ? b : a));
  const m = bbox(main);
  const mx = (m.x1 - m.x0) * 0.3;
  const my = (m.y1 - m.y0) * 0.3;
  const near = (x: number, y: number) => x >= m.x0 - mx && x <= m.x1 + mx && y >= m.y0 - my && y <= m.y1 + my;
  return rings.filter((r) => {
    const b = bbox(r);
    const inside = near((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    const hasPoint = point && point[0] >= b.x0 && point[0] <= b.x1 && point[1] >= b.y0 && point[1] <= b.y1;
    return inside || hasPoint;
  });
}

export async function renderMap(origin: string, w: number, h: number, accent: keyof typeof INKS) {
  const place = await locate(origin);
  if (!place) return null;
  const rings = mainland(place.country.rings, place.point);
  const b = bbox(rings.flat());
  const k = Math.cos((((b.y0 + b.y1) / 2) * Math.PI) / 180); // équirectangulaire corrigée de la latitude
  const pad = 8;
  const scale = Math.min((w - 2 * pad) / ((b.x1 - b.x0) * k), (h - 2 * pad) / (b.y1 - b.y0));
  const ox = (w - (b.x1 - b.x0) * k * scale) / 2;
  const oy = (h - (b.y1 - b.y0) * scale) / 2;
  const at = ([x, y]: [number, number]) => [ox + (x - b.x0) * k * scale, oy + (b.y1 - y) * scale].map((v) => v.toFixed(1)).join(" ");
  const path = rings.map((r) => `M${r.map(at).join("L")}Z`).join("");
  const dot = place.point ? at(place.point).split(" ") : null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">
<defs><pattern id="t" width="5" height="5" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="2" height="2" fill="${INKS[accent]}"/></pattern></defs>
<rect width="${w}" height="${h}" fill="#fff"/>
<path d="${path}" fill="url(#t)" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
${dot ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="10" fill="#fff"/><circle cx="${dot[0]}" cy="${dot[1]}" r="6" fill="${INKS.red}" stroke="#000" stroke-width="2"/>` : ""}
</svg>`;
  return { png: await sharp(Buffer.from(svg)).png().toBuffer(), label: place.label };
}
