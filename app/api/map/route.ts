import { INKS, renderMap, type Ink } from "@/lib/map";

/**
 * Carte de l'origine d'un artiste, en PNG aux encres de la dalle. Mise en cache par le CDN, pour toujours.
 * ?artist=Balthazar&hint=Belgium&w=696&h=445&box=x0,y0,x1,y1&bg=blue&ink=white
 * `hint` est l'origine donnée par le flux ; sans `artist`, c'est elle qui est cartographiée.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const hint = q.get("hint")?.trim() || q.get("origin")?.trim() || undefined;
  const artist = q.get("artist")?.trim() || undefined;
  const w = Math.min(Number(q.get("w")) || 800, 800);
  const h = Math.min(Number(q.get("h")) || 480, 480);
  const [x0, y0, x1, y1] = (q.get("box") ?? `0,0,${w},${h}`).split(",").map(Number);
  const bg = (q.get("bg") ?? "white") as Ink;
  const ink = (q.get("ink") ?? "black") as Ink;
  if (!(hint || artist) || !(bg in INKS) || !(ink in INKS) || [x0, y0, x1, y1].some(Number.isNaN)) {
    return new Response("Bad request", { status: 400 });
  }

  const map = await renderMap({ artist, hint }, w, h, { x0, y0, x1, y1 }, bg, ink);
  if (!map) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=600" } });
  return new Response(new Uint8Array(map.png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, s-maxage=31536000, immutable",
      "X-Place": encodeURIComponent(map.label),
    },
  });
}
