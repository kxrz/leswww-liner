import { INKS, renderMap } from "@/lib/map";

/** Carte de l'origine d'un artiste, en PNG aux encres de la dalle. Mise en cache par le CDN, pour toujours. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const origin = q.get("origin")?.trim() ?? "";
  const w = Math.min(Number(q.get("w")) || 240, 800);
  const h = Math.min(Number(q.get("h")) || 180, 480);
  const accent = (q.get("accent") ?? "red") as keyof typeof INKS;
  if (!origin || !(accent in INKS)) return new Response("Bad request", { status: 400 });

  const map = await renderMap(origin, w, h, accent);
  if (!map) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
  return new Response(new Uint8Array(map.png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, s-maxage=31536000, immutable",
      "X-Place": encodeURIComponent(map.label),
    },
  });
}
