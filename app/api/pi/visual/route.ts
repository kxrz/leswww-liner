import { isDevice } from "@/lib/auth";
import { KINDS, saveVisual, type Kind } from "@/lib/store";

/** The frame uploads a picture it just made: PUT /api/pi/visual?guid=…&kind=eink|bw|hd, image body. */
export async function PUT(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const q = new URL(request.url).searchParams;
  const guid = q.get("guid");
  const kind = (q.get("kind") ?? "eink") as Kind;
  const data = await request.arrayBuffer();
  // Vercel functions accept bodies up to 4.5 MB; the 4K wallpaper is a JPEG for that reason
  if (!guid?.startsWith("https://www.320kbps.club/") || !Object.hasOwn(KINDS, kind) || data.byteLength === 0 || data.byteLength > 4_400_000) {
    return new Response("Bad request", { status: 400 });
  }
  return Response.json(await saveVisual(guid, kind, data));
}
