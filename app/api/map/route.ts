import { INKS, renderMap, Unavailable, type Ink, type MapStyle } from "@/lib/map";

/**
 * Map of where an artist comes from, as a PNG in the panel's inks. Cached by the CDN forever.
 * ?artist=Balthazar&hint=Belgium&w=696&h=445&box=x0,y0,x1,y1&bg=blue&ink=white
 * `hint` is the origin given by the feed; without `artist`, that is what gets mapped.
 * &s=4.5&tone=seen: the HD wallpaper version (strokes scaled, antialiased, in the tones the panel shows).
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const hint = q.get("hint")?.trim() || q.get("origin")?.trim() || undefined;
  const artist = q.get("artist")?.trim() || undefined;
  const w = Math.min(Number(q.get("w")) || 800, 3840);
  const h = Math.min(Number(q.get("h")) || 480, 2160);
  const style: MapStyle = {
    s: Math.min(Math.max(Number(q.get("s")) || 1, 1), 6),
    tone: q.get("tone") === "seen" ? "seen" : "ink",
  };
  const [x0, y0, x1, y1] = (q.get("box") ?? `0,0,${w},${h}`).split(",").map(Number);
  const bg = (q.get("bg") ?? "white") as Ink;
  const ink = (q.get("ink") ?? "black") as Ink;
  if (!(hint || artist) || !(bg in INKS) || !(ink in INKS) || [x0, y0, x1, y1].some(Number.isNaN)) {
    return new Response("Bad request", { status: 400 });
  }

  let map;
  try {
    map = await renderMap({ artist, hint }, w, h, { x0, y0, x1, y1 }, bg, ink, style);
  } catch (e) {
    // MusicBrainz busy: a temporary failure, never cached, so the frame can simply ask again
    if (e instanceof Unavailable) return new Response("Try again", { status: 503, headers: { "Cache-Control": "no-store" } });
    throw e;
  }
  if (!map) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(map.png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, s-maxage=31536000, immutable",
      "X-Place": encodeURIComponent(map.label),
    },
  });
}
