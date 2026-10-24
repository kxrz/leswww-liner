import { isDevice } from "@/lib/auth";
import { saveVisual } from "@/lib/store";

/** Le Pi dépose le visuel qu'il vient d'afficher : PUT /api/pi/visual?guid=…, corps image/png. */
export async function PUT(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const guid = new URL(request.url).searchParams.get("guid");
  const png = await request.arrayBuffer();
  if (!guid?.startsWith("https://www.320kbps.club/") || png.byteLength === 0 || png.byteLength > 4_000_000) {
    return new Response("Bad request", { status: 400 });
  }
  return Response.json(await saveVisual(guid, png));
}
